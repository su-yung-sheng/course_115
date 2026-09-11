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

# ⚠️⚠️ Windows 的繁中主控台預設是 cp950，**編不出 ✅ ❌ ⚠️ 這些字元**，
#    連 cell 6 自己在模組層 print 的 📚 也一樣。
#    印一個勾勾就 UnicodeEncodeError → 整支 crash → 離開碼非 0，
#    而 check.py 的 check_py_tests() 只看離開碼 —— 它會回報成
#    「這支測試沒過」，於是 **pre-commit 取消提交**。
#    ★ 老師看到的是「提交前檢查 檢查沒過」，完全看不出是「印字印掛了」。
#    ⚠️ check.py 是用 subprocess 跑這些測試的，**子程序不會繼承這個修正**，
#      所以每一支都要自己加（backend_parse.test.py 已經有了）。
# ⛔ 2026-09-11 實際發生過：badge_shape / grade_retry / revoke_pass 三支同時
#    被回報「沒過」，而在 Linux 上三支全綠 —— 差別只在主控台編碼。
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass          # 舊 Python 沒有 reconfigure；印不出來也不該中斷檢查

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


class _FakeAnthropicMsg(object):
    def __init__(self, text, tin=111, tout=22):
        self.content = [type("B", (), {"text": text})()]
        self.usage = type("U", (), {"input_tokens": tin, "output_tokens": tout})()


def _install_fake_anthropic():
    """假的 anthropic 模組。⚠️ 一定要真的跑 Claude 那條路 ——
       它和 Gemini 的 SDK、訊息格式、用量欄位全都不一樣，
       靜態檢查看不出「system 有沒有帶進去」「max_tokens 有沒有給」。"""
    m = _pytypes.ModuleType("anthropic")

    class _Messages(object):
        def create(self, **kw):
            _CLAUDE_CALLS.append(kw)
            return _FakeAnthropicMsg(GOOD_TEXT)

    class _Anthropic(object):
        def __init__(self, api_key=None):
            _CLAUDE_CALLS.append({"_api_key": api_key})
            self.messages = _Messages()
    m.Anthropic = _Anthropic
    sys.modules["anthropic"] = m


_CLAUDE_CALLS = []
GOOD_TEXT = json.dumps({"creative_highlights": "無", "score": 88,
                        "comments": "不錯", "deducted_items": "無"},
                       ensure_ascii=False)

_install_fake_genai()
_install_fake_anthropic()
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

section("③b 同一個模型連續兩次 500 也要換模型")
# ⛔⛔ 2026-09-09 實際批改紀錄：13:54~13:56 同一位學生連續四次 500 INTERNAL
#    （3.2／1.1／48.5／46.5 秒）然後失敗 —— 而備援模型**一次都沒被試過**。
#    原本只有 503 會換模型，理由是「500 多半是暫時的」。連續四次就不是。
def _s3b(m, n):
    if m == "gemma-4-31b-it":
        raise Exception("500 INTERNAL. {'error': {'code': 500, 'message': "
                        "'Internal error encountered.', 'status': 'INTERNAL'}}")
    return _FakeResp(GOOD)


res, calls, clock = run(_s3b, step=5.0)
ok(res.get("score") == 88,
   "★★★ 連續 500 之後要換到備援模型並評出分數　←　%r" % res.get("score"))
ok(calls.count("gemma-4-31b-it") == 2,
   "★★★ 第一次還當它是暫時的（重試划算），**第二次**就要換 —— "
   "不可以四次都賭同一個模型　←　打了 %d 次" % calls.count("gemma-4-31b-it"))
ok("gemini-2.5-flash" in calls, "★★ 要真的打到備援模型　←　%r" % (calls,))
ok("連續 2 次 500" in "\n".join(core.GRADE_LOG),
   "★★ 紀錄要講明為什麼換模型")

# ⚠️ 只算**連續**的：中間夾到別種錯誤要重新計數，否則整場累積下來
#    會在不相干的時候誤觸。
def _s3c(m, n):
    if n == 1:
        raise Exception("500 INTERNAL. status INTERNAL")
    if n == 2:
        raise Exception("429 RESOURCE_EXHAUSTED")
    if n == 3:
        raise Exception("500 INTERNAL. status INTERNAL")
    return _FakeResp(GOOD)


res, calls, clock = run(_s3c, step=2.0)
ok(calls.count("gemma-4-31b-it") == 4 and res.get("score") == 88,
   "★★★ 500 → 429 → 500 不算連續兩次，不可以換模型　←　主要模型打了 %d 次"
   % calls.count("gemma-4-31b-it"))

section("④ 退避不可以等太久（等待也要從預算裡扣）")
def _s4(m, n):
    raise Exception("429 RESOURCE_EXHAUSTED")


res, calls, clock = run(_s4, model="gemini-2.5-flash", step=1.0)
ok(clock.slept and max(clock.slept) <= 12.0,
   "★★★ 單次退避不可以超過 12 秒（8 秒上限 × 抖動 1.5）　←　最久等了 %.1f 秒"
   % (max(clock.slept) if clock.slept else 0))
ok(len(clock.slept) >= 1, "★ 還是要有退避與抖動（thundering herd）")

section("④b 省輸出：不叫模型寫學生看不到的 logic_analysis")
# ⛔ 2026-09-09 清點 shared/grader.html 實際顯示的欄位：
#    creative_highlights / comments / deducted_items 有，logic_analysis **沒有**。
#    而它的描述是「深度邏輯分析」—— 多半是最長的一個欄位。
#    ★ LLM 逐字生成 ⇒ 砍掉最長的輸出，時間幾乎等比例下降。
ok(core.GRADE_WANT_ANALYSIS is False,
   "★★★ 預設不要 logic_analysis（學生端一個字都沒顯示）")
# ⚠️ 要用**挖出來的儲存格原始碼**比對，不可以讀 .ipynb 的原始 JSON ——
#    那裡面的引號是跳脫的（\\"），字串永遠對不上，而且看起來像功能沒做。
_core_txt = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][6]["source"])
ok('不要輸出 logic_analysis 這個欄位' in _core_txt,
   "★★★ 純文字那一條要**明講**不要輸出它 —— Gemma 走的是純文字，"
   "改 response_schema 對它完全沒有作用")
ok('_req.insert(0, "logic_analysis")' in _core_txt,
   "★★ schema 那一條也要跟著走，否則換成 Gemini 系列時行為會不一致")
ok('usage_metadata' in _core_txt and 'token/秒' in _core_txt,
   "★★★ 要記 token 用量 —— 「時間花在讀輸入還是寫輸出」是決定"
   "砍 prompt 還是砍回覆的唯一依據")
ok('getattr(response, "usage_metadata", None)' in _core_txt,
   "★★ 用 getattr 取：不同 SDK／模型不一定有這個欄位，"
   "拿不到也不可以讓已經成功的批改失敗")

section("④c 付費 Claude 備援（老師 2026-09-09 已有付費金鑰）")
# ★ 梯子：老師設的模型 → gemini-2.5-flash → claude（付費，墊底）。
#   免費的好用時照常省額度，撞牆才動用到會計費的那一個。
def _s4c(m):
    if not m.startswith("claude"):
        raise Exception("503 UNAVAILABLE. 'This model is currently "
                        "experiencing high demand.'")
    raise AssertionError("Claude 不該走 genai 這條路")


_CLAUDE_CALLS[:] = []
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
_FakeClient.keys_used = []
_FakeClient.script = _s4c
res = core.single_agent_grading(
    KEYS, "規則", "主題", "學生碼", "空白不一樣", "解答",
    "gemma-4-31b-it", True, claude_key="sk-ant-TESTKEY000000000000")
ok(res.get("score") == 88,
   "★★★ 免費的兩個都撞牆時，要能靠付費 Claude 把這節課跑完　←　%r"
   % res.get("score"))
_kw = [c for c in _CLAUDE_CALLS if "model" in c]
ok(bool(_kw) and _kw[0]["model"].startswith("claude"),
   "★★ 要真的打到 Claude　←　%r" % (_kw[0].get("model") if _kw else None))
ok(bool(_kw) and _kw[0].get("system"),
   "★★★ 評分規則要放進 system —— Claude 的訊息格式和 Gemini 不一樣，"
   "放錯地方會變成「AI 沒看到評分標準」而且完全看不出來")
ok(bool(_kw) and _kw[0].get("max_tokens"),
   "★★★ max_tokens 是必填的（Gemini 那邊不是）—— 沒給會被截成半截 JSON，"
   "症狀是「模型產生了無效的 JSON」，很難聯想到這裡")
ok("輸入 111 token" in "\n".join(core.GRADE_LOG),
   "★★ Claude 這條路也要記 token 用量（兩邊各印各的話，"
   "遲早只有一邊有數字，而那正是要拿來比較的東西）")

# 沒有付費金鑰時：梯子要把 Claude 濾掉，不要白白失敗一次
_CLAUDE_CALLS[:] = []
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
_FakeClient.script = _s4c
res = core.single_agent_grading(KEYS, "規則", "主題", "學生碼", "空白不一樣",
                                "解答", "gemma-4-31b-it", True)
ok(res.get("ok") is False and not _CLAUDE_CALLS,
   "★★★ 沒設 ANTHROPIC_API_KEY 就完全不要碰 Claude —— "
   "留在梯子上只會在最後一階白白失敗一次（而那次可能又掛住幾十秒）")

section("④d 每一次批改都要留一筆摘要（跨 Colab 重啟）")
# ⛔ 2026-09-10 老師問「今天批改使用的不是新版?」—— 我答不出來，因為
#    批改紀錄只在記憶體、重啟就清空，最後靠「logic_analysis 空不空」反推。
#    而那一次的 token 數字與秒數已經永遠沒了。
#    ⇒ 老師：「不然怎麼追蹤比對與調整」。
_FakeClient.script = lambda m: _FakeResp(GOOD)
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
res = core.single_agent_grading(KEYS, "老師的規則很長很長很長", "主題",
                                "學生碼", "空白不一樣", "參考解答",
                                "gemma-4-31b-it", True, rules_source="第 1 關自己的")
_st = res.get("_stat") or {}
ok(bool(_st), "★★★ 成功時要把摘要掛在結果上帶出去　←　%r" % list(_st)[:6])
ok(_st.get("ok") is True and _st.get("model") == "gemma-4-31b-it",
   "★★ 要記下成敗與**實際用的模型**（備援與否是要比較的重點）")
ok(_st.get("attempts") == 1 and _st.get("seconds") is not None,
   "★★ 要記下試了幾次、總共幾秒")
ok(_st.get("chars_rules") and _st.get("chars_student"),
   "★★ 字數要分項留著 —— 「輸入重還是輸出重」要靠它判斷")
ok(_st.get("want_analysis") is False,
   "★★★ 要記下當時有沒有叫模型寫 logic_analysis —— "
   "這正是老師這次分不出版本的那個變數")
ok(_st.get("rules_source") == "第 1 關自己的",
   "★★ 評分標準來源也要留（分數怪怪的時候第一個要查的就是它）")

# 失敗的也要留 —— 失敗率與原因分布正是要追蹤的東西
def _s4d(m):
    raise Exception("500 INTERNAL. status INTERNAL")


_FakeClient.script = _s4d
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
res = core.single_agent_grading(KEYS, "規則", "主題", "學生碼", "空白不一樣",
                                "解答", "gemma-4-31b-it", True)
_st = res.get("_stat") or {}
ok(res.get("ok") is False and _st.get("ok") is False and _st.get("error"),
   "★★★ 失敗的更要留（失敗那幾次往往花掉最多時間）　←　%r"
   % str(_st.get("error"))[:40])

_src2 = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][8]["source"])
ok('result.pop("_stat", None)' in _src2,
   "★★★ 回給學生之前一定要 pop 掉 —— 那是內部觀測資料，"
   "而且不可以跟著 record_submission 寫進成績")
ok('def record_grade_stat' in "".join(
      json.load(io.open(NB, encoding="utf-8"))["cells"][6]["source"]),
   "★★ core 要有 record_grade_stat（寫失敗吞例外，不影響批改）")
ok('/api/grade-stats' in _src2,
   "★★ 要有讀得回來的端點，不然存了也看不到")

section("⑤ 和空白範本完全一樣仍然直接 0 分，不打 API")
_FakeClient.script = lambda m: (_ for _ in ()).throw(AssertionError("不該呼叫 API"))
core.time = _Clock()
res = core.single_agent_grading(KEYS, "規則", "主題", "一模一樣", "一模一樣",
                                "參考解答", "gemini-2.5-flash", True)
ok(res.get("score") == 0, "★★ 交空白範本＝0 分（這條規則不可以被重試邏輯改掉）")

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
