# -*- coding: utf-8 -*-
"""撞到「模型忙線」時的行為：換模型、總時間預算、退避上限

跑法：python3 shared/tests/grade_retry.test.py

⛔⛔ 為什麼有這一份（2026-09-08 上課實況）
   老師：「只有三台連線，就很慢，也有錯誤。」
   從後端讀回來的紀錄：
       503 UNAVAILABLE 'This model is currently experiencing high demand.'
   而且**失敗前會先掛住**：61.8／150.0／72.6 秒才回 503。
   四次重試＝四分鐘起跳，而學生端 fetch 240 秒就放棄 ——
   學生連「失敗」兩個字都看不到，只看到轉圈圈轉到斷線。

★★ 這一份**真的把 single_agent_grading 執行起來**（用假的 genai），
   不是 grep。重試邏輯是那種「每一條分支看起來都對、合起來卻不會停」
   的程式，靜態檢查看不出它會不會換模型、會不會準時收手。
"""
import io
import json
import os
import sys
import types as _pytypes

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NB = os.path.join(ROOT, "shared", "backend.ipynb")

_pass = [0]
_fail = [0]


def ok(cond, label):
    if cond:
        _pass[0] += 1
        print("  ✅ " + label)
    else:
        _fail[0] += 1
        print("  ❌ " + label)


def section(t):
    print("\n── %s ──" % t)


# ══════════════════════════════════════════════════════════
# 假的 google.genai —— 讓 cell 6 可以被 exec 起來
# ══════════════════════════════════════════════════════════
# ⚠️ 一定要在 exec 之前塞進 sys.modules：cell 6 第一行就 from google import genai。
class _FakeResp(object):
    def __init__(self, text):
        self.text = text


class _FakeModels(object):
    def __init__(self, script):
        self.script = script

    def generate_content(self, model=None, contents=None, config=None):
        return self.script(model)


class _FakeClient(object):
    def __init__(self, api_key=None, **kw):
        self.api_key = api_key
        _FakeClient.keys_used.append(api_key)
        self.models = _FakeModels(_FakeClient.script)

    keys_used = []
    script = None


def _install_fake_genai():
    genai = _pytypes.ModuleType("google.genai")
    genai.Client = _FakeClient

    t = _pytypes.ModuleType("google.genai.types")

    def _any(*a, **k):
        return {"_stub": True}
    for name in ("Content", "Part", "GenerateContentConfig", "Schema"):
        setattr(t, name, type(name, (), {
            "__init__": lambda self, *a, **k: None,
            "from_text": staticmethod(_any),
        }))
    t.Part.from_text = staticmethod(_any)
    t.Type = type("Type", (), {"OBJECT": "OBJECT", "STRING": "STRING",
                               "INTEGER": "INTEGER"})
    genai.types = t
    google = _pytypes.ModuleType("google")
    google.genai = genai
    sys.modules["google"] = google
    sys.modules["google.genai"] = genai
    sys.modules["google.genai.types"] = t


def load_core():
    """把 cell 6 執行成一個模組。⚠️ 第一行是 %%writefile，要剝掉。"""
    src = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][6]["source"])
    body = "\n".join(src.split("\n")[1:])
    mod = _pytypes.ModuleType("core_under_test")
    mod.__dict__["__name__"] = "core_under_test"
    exec(compile(body, "<cell6>", "exec"), mod.__dict__)
    return mod


class _Clock(object):
    """假時鐘：sleep 不真的睡，但時間要照走 —— 否則預算永遠不會到。

    ⚠️ 真的 sleep 的話這份測試會跑好幾分鐘，而且量到的是真實時間，
       測不出「模型掛住 60 秒」那種情境。
    """
    def __init__(self):
        self.now = 1000.0
        self.slept = []

    def time(self):
        return self.now

    def sleep(self, s):
        self.slept.append(s)
        self.now += s


_install_fake_genai()
core = load_core()

GOOD = json.dumps({"logic_analysis": "分析", "creative_highlights": "無",
                   "score": 88, "comments": "不錯", "deducted_items": "無"},
                  ensure_ascii=False)
KEYS = ["AIzaTESTKEY0000000001", "AIzaTESTKEY0000000002"]


def run(script, model="gemma-4-31b-it", step=0.0):
    """跑一次批改。script(model) 回 _FakeResp 或丟例外；step＝每次呼叫花幾秒。"""
    clock = _Clock()
    core.time = clock
    core.GRADE_LOG.clear()
    _FakeClient.keys_used = []
    calls = []

    def wrapped(m):
        calls.append(m)
        clock.now += step
        return script(m, len(calls))
    _FakeClient.script = wrapped
    res = core.single_agent_grading(
        KEYS, "評分規則", "主題", "學生的程式碼", "空白範本不一樣", "參考解答",
        model, True)
    return res, calls, clock


section("① 503「模型忙線」要換模型，不是換金鑰")
{}
def _s1(m, n):
    if m == "gemma-4-31b-it":
        raise Exception("503 UNAVAILABLE. {'error': {'code': 503, 'message': "
                        "'This model is currently experiencing high demand.'}}")
    return _FakeResp(GOOD)


res, calls, clock = run(_s1, step=60.0)
log = "\n".join(core.GRADE_LOG)
ok(res.get("score") == 88,
   "★★★ 主要模型 503 之後要換備援模型並且真的評出分數　←　得到 %r" % res.get("score"))
ok("gemini-2.5-flash" in calls,
   "★★★ 第二次要打**備援模型**　←　實際打了 %r" % (calls,))
ok(calls.count("gemma-4-31b-it") == 1,
   "★★★ 不可以對同一個忙線的模型再試一次（換金鑰救不了 503）　←　打了 %d 次"
   % calls.count("gemma-4-31b-it"))
ok("備援模型" in log, "★★ 紀錄要講明「改用備援模型」，老師才知道在用比較耗額度的那個")
ok("備援模型" in [l for l in core.GRADE_LOG if "呼叫成功" in l][0],
   "★★ 成功那一行也要標出是備援 —— 只寫「成功」老師會以為主要模型好了")

section("② 總時間預算：不可以讓學生等到瀏覽器斷線（240 秒）")
def _s2(m, n):
    raise Exception("503 UNAVAILABLE. 'This model is currently experiencing "
                    "high demand.'")


res, calls, clock = run(_s2, step=60.0)
spent = clock.now - 1000.0
ok(res.get("ok") is False and res.get("score") is None,
   "★★★ 全部失敗時 score 必須是 None（不可以記 0 分 —— 那是 Google 的問題，不是學生的）")
ok(spent < 240,
   "★★★ 要在前端放棄（240 秒）之前收手　←　實際花了 %.0f 秒" % spent)
ok("忙線" in res.get("comments", ""),
   "★★★ 要講「服務忙線」而不是丟原始錯誤碼　←　%r" % res.get("comments", "")[:60])
ok("不是你的程式有問題" in res.get("comments", ""),
   "★★★ 一定要講「不是你的程式有問題」—— 學生第一個念頭是自己寫壞了")
ok(core.GRADE_BUDGET_SECONDS < 240,
   "★★ 預算要小於前端的 240 秒　←　現在是 %s" % core.GRADE_BUDGET_SECONDS)

section("③ 500 INTERNAL 要重試，但不必換模型")
def _s3(m, n):
    if n <= 2:
        raise Exception("500 INTERNAL. {'error': {'code': 500, 'message': "
                        "'Internal error encountered.', 'status': 'INTERNAL'}}")
    return _FakeResp(GOOD)


res, calls, clock = run(_s3, model="gemini-2.5-flash", step=3.0)
ok(res.get("score") == 88, "★★ 500 重試之後要評得出分數　←　%r" % res.get("score"))
ok(set(calls) == {"gemini-2.5-flash"},
   "★★ 500 不是容量問題，不必換模型　←　打了 %r" % (calls,))
ok(len(_FakeClient.keys_used) >= 2 and _FakeClient.keys_used[0] != _FakeClient.keys_used[1],
   "★★ 重試要換另一把金鑰（500／429 換金鑰是有意義的）")

section("④ 退避不可以等太久（等待也要從預算裡扣）")
def _s4(m, n):
    raise Exception("429 RESOURCE_EXHAUSTED")


res, calls, clock = run(_s4, model="gemini-2.5-flash", step=1.0)
ok(clock.slept and max(clock.slept) <= 12.0,
   "★★★ 單次退避不可以超過 12 秒（8 秒上限 × 抖動 1.5）　←　最久等了 %.1f 秒"
   % (max(clock.slept) if clock.slept else 0))
ok(len(clock.slept) >= 1, "★ 還是要有退避與抖動（thundering herd）")

section("⑤ 和空白範本完全一樣仍然直接 0 分，不打 API")
_FakeClient.script = lambda m: (_ for _ in ()).throw(AssertionError("不該呼叫 API"))
core.time = _Clock()
res = core.single_agent_grading(KEYS, "規則", "主題", "一模一樣", "一模一樣",
                                "參考解答", "gemini-2.5-flash", True)
ok(res.get("score") == 0, "★★ 交空白範本＝0 分（這條規則不可以被重試邏輯改掉）")

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
