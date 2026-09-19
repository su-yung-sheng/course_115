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
    # ⚠️ 這一份要跟真的 google.genai.types.Type 一樣齊全，
    #    少一個就會在這裡爆 AttributeError，而正式環境其實是好的。
    t.Type = type("Type", (), {"OBJECT": "OBJECT", "STRING": "STRING",
                               "INTEGER": "INTEGER", "NUMBER": "NUMBER",
                               "ARRAY": "ARRAY", "BOOLEAN": "BOOLEAN"})
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
            # ⛔⛔ 2026-09-14 真的發生過：Colab 上裝的 anthropic 版本
            #    messages.create() **不吃 temperature**。於是 flash 撞 503
            #    之後換到 Claude 立刻 TypeError —— 連續五次批改全掛，
            #    學生等了一分多鐘只拿到錯誤訊息。
            # ★★ 為什麼原本的測試沒抓到：這個假模組的 create(**kw)
            #    什麼參數都收 —— **替身比真貨寬容**。
            #    替身寬容的地方，就是測試看不見的地方。
            if _CLAUDE_REJECT[0] and _CLAUDE_REJECT[0] in kw:
                raise TypeError("Messages.create() got an unexpected "
                                "keyword argument '%s'" % _CLAUDE_REJECT[0])
            _CLAUDE_CALLS.append(kw)
            # _CLAUDE_TEXT 是一個「接下來每次要回什麼」的清單，
            # 用完之後回正常的 JSON。給「第一次回散文、第二次才對」用。
            if _CLAUDE_TEXT:
                return _FakeAnthropicMsg(_CLAUDE_TEXT.pop(0))
            return _FakeAnthropicMsg(GOOD_TEXT)

    class _Anthropic(object):
        def __init__(self, api_key=None):
            _CLAUDE_CALLS.append({"_api_key": api_key})
            self.messages = _Messages()
    m.Anthropic = _Anthropic
    sys.modules["anthropic"] = m


_CLAUDE_CALLS = []
# 設成某個參數名，假的 Claude 就會像真的那樣拒絕它（None ＝ 照單全收）
_CLAUDE_REJECT = [None]
# 接下來幾次要回的原始文字（空的就回正常 JSON）
_CLAUDE_TEXT = []
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


def run(script, model="gemma-4-31b-it", step=0.0, no_fallback=False):
    """跑一次批改。script(model) 回 _FakeResp 或丟例外；step＝每次呼叫花幾秒。

    no_fallback：校正用的「不准降級」。預設 False，既有呼叫端行為不變。
    """
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
        model, True, no_fallback=no_fallback)
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


section("①b 校正時**不准**降級（no_fallback）")
# ⛔⛔ 2026-09-16 老師第一次按「📐 跨模型校正」就踩到：
#    要求 flash → flash 回 503 → 梯子自動降級到 haiku
#    ⇒ 兩列都是 haiku 回答的，三個模型的比較塌成一個。
# ★ 校正問的是「**這個模型自己**會給幾分」，降級等於偷換受測者。
#   而且若少了 matched 檢查，畫面會印出「差 0 分，標準夠明確」——
#   一個完全錯誤而且讓人安心的結論。
# ⚠️ 這一條和上面①是**互相衝突**的需求（平常要降級、校正不准降級），
#    所以兩邊都要有測試釘住，不然改一邊會把另一邊弄壞。
res_nf, calls_nf, _ = run(_s1, step=60.0, no_fallback=True)
ok(calls_nf == ["gemma-4-31b-it"],
   "★★★ 只准打**被指定的那一個**模型、而且只問一次　←　實際打了 %r" % (calls_nf,))
# ⚠️ 「只問一次」不是順便：第一版只砍了梯子沒砍重試，於是 503 之後
#    在同一個模型上重試三次、吃光時間預算，後面的模型根本輪不到 ——
#    畫面上會變成「校正只跑得出一列」，看起來像那些模型壞了。
ok("gemini-2.5-flash" not in calls_nf,
   "★★★ 絕對不可以偷偷換成備援模型 —— 換了就不是在量這個模型的尺")
ok(res_nf.get("ok") is False and res_nf.get("score") is None,
   "★★ 問不到就老實回失敗，**不可以**拿別人的分數充數")
ok("503" in str(res_nf.get("error") or ""),
   "★★★ 要把失敗原因帶出來（校正頁要印「這次沒問到，原因：503 忙線」）"
   "　←　%r" % str(res_nf.get("error"))[:60])
# ★ 平常那條路不可以被這次改動弄壞 —— 再跑一次①的情境確認還會降級
_res_dn, _calls_dn, _ = run(_s1, step=60.0)
ok("gemini-2.5-flash" in _calls_dn,
   "★★★ 學生批改那條路**照樣要降級**（no_fallback 預設關閉）")

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

section("④e 備援的 SDK 參數不合也要跑得完（2026-09-14 上課實況）")
# ⛔⛔ 那天的完整經過（/api/grade-log 撈出來的）：
#       09:38  flash 等了 65.8 秒回 503
#       09:38  → 換備援 claude-haiku
#       09:38  → Messages.create() got an unexpected keyword argument 'temperature'
#     連續五次批改都是這個形狀。
# ★★★ 這裡最貴的一課不是「參數寫錯」，是**備援平常不會被走到**——
#     它的 bug 只在主力模型已經掛掉的時候現形，也就是最需要它的那一刻。
#     ⇒ 備援路徑的測試要比主路徑更兇，不可以只測「快樂路徑」。
_CLAUDE_REJECT[0] = "temperature"
_CLAUDE_CALLS[:] = []
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
_FakeClient.keys_used = []
_FakeClient.script = _s4c
res = core.single_agent_grading(
    KEYS, "規則", "主題", "學生碼", "空白不一樣", "解答",
    "gemini-2.5-flash", True, claude_key="sk-ant-TESTKEY000000000000")
ok(res.get("score") == 88,
   "★★★ SDK 不吃 temperature 時要自己退一步再打一次，不可以整次批改陣亡　←　%r"
   % res.get("score"))
_kw = [c for c in _CLAUDE_CALLS if "model" in c]
ok(bool(_kw) and "temperature" not in _kw[0],
   "★★ 重試那一次不可以再帶 temperature")
ok(bool(_kw) and _kw[0].get("system") and _kw[0].get("max_tokens"),
   "★★★ 退一步只能拿掉 temperature —— system 和 max_tokens 一個都不能少")
ok(any("不吃 temperature" in l for l in core.GRADE_LOG),
   "★★ 要留一行紀錄 —— 不然下次還是要花一節課才知道是這件事")

# ★ 但不可以變成「TypeError 一律吞掉」：真的把參數名寫錯時要看得見
_CLAUDE_REJECT[0] = "max_tokens"
_CLAUDE_CALLS[:] = []
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
_FakeClient.script = _s4c
_res_bad = core.single_agent_grading(
    KEYS, "規則", "主題", "學生碼", "空白不一樣", "解答",
    "gemini-2.5-flash", True, claude_key="sk-ant-TESTKEY000000000000")
ok(_res_bad.get("ok") is False and "max_tokens" in str(_res_bad.get("error") or ""),
   "★★★ 只吞 temperature 那一種 TypeError —— 別的參數寫錯要照樣浮上來，"
   "全吞的話會變成安靜地跑不動　←　%r" % (_res_bad.get("error") or "")[:60])
_CLAUDE_REJECT[0] = None

# ★ health 要看得到裝的是哪一版 —— 那天查不出原因就是因為沒有這個數字
_nb8 = "".join(json.load(io.open(NB, encoding="utf8"))["cells"][8]["source"])
ok('"sdk"' in _nb8 and "_pkg_version" in _nb8,
   "★★ /api/health 要報出 anthropic 的版本（備援出事時第一個要查的東西）")
# ⛔ 2026-09-14：後端斷線後重跑三次才連得上 —— ERR_NGROK_334／108 的
#    自動清除要 NGROK_API_KEY，而「有沒有設」以前看不出來。
#    ★ 它真正在驗的是 Secrets 的**筆記本存取權**有沒有打開（最常漏的一步）。
ok('"NGROK_API_KEY"' in _nb8,
   "★★ /api/health 要報出 NGROK_API_KEY 設了沒（斷線自動清除靠它）")
# ⚠️ 只可以報「有沒有」。把金鑰本身放進 health 等於公開它 ——
#    health 是不用任何驗證就打得開的端點。
_ks = _nb8[_nb8.index('"keys"'):]
_ks = _ks[:_ks.index("},") + 2]
ok(_ks.count("bool(") >= 4 and "_SENSITIVE" not in _ks,
   "★★★ keys 裡每一項都是 bool(...)，不可以把金鑰本身吐出來")


section("④f 測試備援的端點：要驗真的那一條，而且不可以把降級當成功")
# ⛔⛔ 2026-09-14 的教訓有兩層：
#    ① 備援平常不會被走到 ⇒ 壞了沒人知道，要能隨時主動驗
#    ② 當初的單元測試是綠的，因為假的 SDK 什麼參數都收 ——
#       **替身比真貨寬容的地方，就是測試看不見的地方**
#    ⇒ 所以那支端點一定要呼叫 single_agent_grading **本人**。
#      另外寫一條「測試專用」的呼叫，測到的就不是真正在跑的那一條。
_nb8b = "".join(json.load(io.open(NB, encoding="utf8"))["cells"][8]["source"])
_mc = _nb8b[_nb8b.index("def teacher_model_check"):]
_mc = _mc[:_mc.index("\n@app.route")] if "\n@app.route" in _mc else _mc
ok("core.single_agent_grading(" in _mc,
   "★★★ 測試端點要呼叫 single_agent_grading 本人，不可以另外寫一條呼叫路徑")
ok('"answered"' in _mc and '"matched"' in _mc,
   "★★★ 要回報**實際回答的是哪個模型** —— 要求 Claude 卻由 Gemini 回答"
   "是降級、是失敗，只看有沒有分數會把它當成功")
ok("_MODEL_CHECK_MIN_GAP" in _mc and "429" in _mc,
   "★★ 要節流：這支會花付費額度，而教師端沒有密碼、ngrok 網址是公開的")
ok("_allowed" in _mc,
   "★★ 只能測梯子上的模型 —— 不然有人可以指定最貴的那一個來燒額度")
ok("anthropic_key" in _mc,
   "★ 沒設金鑰時直接講明白，不要讓它跑一次才失敗")

# ★ 指定 Claude 而 Claude 壞掉時，**不可以**被 Gemini 的成功蓋過去。
#   （TypeError 不是 503／500，本來就不該降級 —— 這一條把它釘住。）
_CLAUDE_REJECT[0] = "max_tokens"
_CLAUDE_CALLS[:] = []
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
_FakeClient.keys_used = []
_FakeClient.script = lambda m: _FakeResp(GOOD)      # Gemini 這邊是好的
_res_cl = core.single_agent_grading(
    KEYS, "規則", "主題", "學生碼", "空白不一樣", "解答",
    "claude-haiku-4-5-20251001", False,
    claude_key="sk-ant-TESTKEY000000000000")
ok(_res_cl.get("ok") is False,
   "★★★ 指定 Claude 而它壞掉時要如實失敗，不可以被 Gemini 的成功蓋過去　←　%r"
   % _res_cl.get("score"))
_CLAUDE_REJECT[0] = None


section("④g 沒有 schema 的模型要被告知格式，回錯了也要重試")
# ⛔⛔ 2026-09-14 第二次踩到同一個坑（第一次是 temperature）：
#    按下「測試備援」→「模型產生了無效的 JSON 字串」。
#    原因是 Claude 那條路 system=prompt，**沒有帶格式規格** ——
#    而格式規格當時寫在 Gemini 分支裡面，只有 Gemma 那條路吃得到。
#    ⇒ Claude 根本不知道要回什麼，回了一段散文。
# ★★ 諷刺的是正確答案就寫在那段程式旁邊的註解：「沒有這一段，
#    降級只會產生垃圾，然後每一次批改都在 JSONDecodeError 上失敗」。
#    我加 Claude 分支時沒有把那個教訓帶過去 ——
#    **同一個教訓寫在註解裡，不代表下一個人（我）會讀到。**
_CLAUDE_REJECT[0] = None
_CLAUDE_TEXT[:] = []
_CLAUDE_CALLS[:] = []
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
_FakeClient.keys_used = []
_FakeClient.script = _s4c
res = core.single_agent_grading(
    KEYS, "規則", "主題", "學生碼", "空白不一樣", "解答",
    "claude-haiku-4-5-20251001", False,
    claude_key="sk-ant-TESTKEY000000000000")
_kw = [c for c in _CLAUDE_CALLS if "model" in c]
ok(bool(_kw) and "回傳格式" in (_kw[0].get("system") or ""),
   "★★★ Claude 沒有 response_schema ⇒ system 一定要帶格式規格，"
   "否則它不知道要回 JSON")
ok(bool(_kw) and "score" in (_kw[0].get("system") or ""),
   "★★ 規格裡要列出欄位名（score／comments／deducted_items）")

# ★ 就算真的回了散文，也不可以一次就放棄 —— 那是備援，最不該當場陣亡
_CLAUDE_TEXT[:] = ["我覺得這位同學寫得不錯，建議再加上迴圈。"]
_CLAUDE_CALLS[:] = []
clock = _Clock(); core.time = clock; core.GRADE_LOG.clear()
_FakeClient.script = _s4c
res2 = core.single_agent_grading(
    KEYS, "規則", "主題", "學生碼", "空白不一樣", "解答",
    "claude-haiku-4-5-20251001", False,
    claude_key="sk-ant-TESTKEY000000000000")
ok(res2.get("score") == 88,
   "★★★ 回了散文要重試，不可以一次就放棄整次批改　←　%r" % res2.get("score"))
ok(len([c for c in _CLAUDE_CALLS if "model" in c]) >= 2,
   "★★ 真的有再打一次（第一次解析失敗）")
ok(any("它實際回了" in l for l in core.GRADE_LOG),
   "★★★ 解析失敗一定要印出**模型到底回了什麼** —— "
   "「無效的 JSON」這五個字本身沒有任何診斷價值")
ok(any("我覺得這位同學" in l for l in core.GRADE_LOG),
   "★★ 印的是真的那段內容，不是佔位字串")
_CLAUDE_TEXT[:] = []


section("④h 同一份程式 → 同一個分數（批改結果快取）")
# ⛔⛔ 2026-09-15 老師實測：1410213 連送三次**一模一樣**的程式
#    （chars_student 都是 3277），拿到 65 → 85 → 80。通過門檻是 75
#    ⇒ 第一次不過、第二次一樣的東西就過了。
# ★ temp 早就是 0.0 了 —— temperature=0 **不保證**每次一樣。
#   這不是 bug，是 LLM 評分的固有變異，調參數解不掉。
#   ⇒ 改成「同一份程式不重新評分」，直接回上次的結果。
_cfg_a = {"rules": "規則A", "theme": "主題", "template_code": "空白",
          "example_code": "解答", "extension_rules": ""}
_k1 = core.grade_cache_key(_cfg_a, "學生程式")
ok(_k1 == core.grade_cache_key(dict(_cfg_a), "學生程式"),
   "★★★ 同一份程式＋同一份規則 → 同一把鑰匙（不然快取形同虛設）")
ok(_k1 != core.grade_cache_key(_cfg_a, "學生程式改了一點"),
   "★★ 程式改了 → 鑰匙要變（改了就該重新評）")
ok(_k1 != core.grade_cache_key(dict(_cfg_a, rules="規則B"), "學生程式"),
   "★★★ **老師改了評分標準 → 鑰匙要變**，否則改完規則分數不會跟著動，"
   "而且完全看不出原因")
ok(_k1 != core.grade_cache_key(dict(_cfg_a, example_code="別的解答"), "學生程式"),
   "★★ 參考解答換了也要重評")
# ★★★ 這一條是整件事的目的：不管哪個模型，同一份程式就是同一個分數。
#     把模型包進鑰匙的話，降級一次就又會重骰 —— 那就白做了。
_src_key = "".join(json.load(io.open(NB, encoding="utf8"))["cells"][6]["source"])
_kf = _src_key[_src_key.index("def grade_cache_key"):]
_kf = _kf[:_kf.index("\ndef ")]
ok("model" not in _kf,
   "★★★ 鑰匙裡不可以有模型名稱 —— 「不管哪個模型都給同一個分數」正是目的")

# ── 鑰匙要認人（2026-09-16）────────────────────────────────
# ⛔⛔ 上面那幾條當初全部是綠的，洞照樣存在 ——
#    因為它們從頭到尾沒有問過一句「換一個學生會怎樣？」
#    實際後果：1420121 08:51 被評 100 分；1420120 08:53 按送出，
#    **0 秒**拿到同一份 100 分，而他從來沒有被評分過一次。
# ★ 這一組測試就是那句沒被問出口的問題。
_cfg_s1 = dict(_cfg_a, _student_id="1420121")
_cfg_s2 = dict(_cfg_a, _student_id="1420120")
ok(core.grade_cache_key(_cfg_s1, "學生程式")
   == core.grade_cache_key(dict(_cfg_s1), "學生程式"),
   "★★ 同一個學生＋同一份程式 → 同一把鑰匙（原本的需求要保住：不重骰）")
ok(core.grade_cache_key(_cfg_s1, "學生程式")
   != core.grade_cache_key(_cfg_s2, "學生程式"),
   "★★★ **不同學號、一模一樣的程式 → 不同鑰匙**。少了這一條，"
   "後按送出的人會 0 秒撿到前一個人的分數（2026-09-16 實際發生）")
ok(core.grade_cache_key(_cfg_s1, "學生程式")
   != core.grade_cache_key(_cfg_a, "學生程式"),
   "★ 有帶學號和沒帶學號不可以算出同一把鑰匙（不然舊資料會被誤命中）")

# ── 寫入：失敗的不可以存，不然錯誤會被記住 ──────────────
_calls = []
_old_http, _old_fb = core._fs_http, core.FIREBASE
_old_base = core._fs_docs_base
core._fs_http = lambda m, u, b=None: (_calls.append((m, u, b)) or {})
# ⚠️ _fs_docs_base 會去讀 FIREBASE 裡的專案設定 —— 測試沒有那些欄位，
#    不換掉的話會丟例外、被 write_grade_cache 的 except 吞掉，
#    於是「沒有寫入」看起來像是規則正確，其實是壞掉了。
core._fs_docs_base = lambda: "https://fake/documents"
core.FIREBASE = {"enabled": True, "api_key": "k"}
try:
    core.write_grade_cache("K1", {"ok": False, "score": None, "comments": "壞了"})
    ok(len(_calls) == 0,
       "★★★ 評分失敗的**不可以**存進快取 —— 存了的話那位學生這份程式"
       "永遠拿不到分數，而且他不知道為什麼")
    core.write_grade_cache("K1", {"score": 88, "comments": "不錯",
                                  "deducted_items": "無",
                                  "creative_highlights": "無"}, "some-model")
    ok(len(_calls) == 1 and _calls[0][0] == "PATCH",
       "★★ 成功的要存（用 PATCH 寫到固定的文件 id，重複寫不會長出新文件）")
    ok("K1" in _calls[0][1] and "grade-cache" in _calls[0][1],
       "★ 存到 {學期}-grade-cache/{鑰匙}")
finally:
    core._fs_http, core.FIREBASE = _old_http, _old_fb
    core._fs_docs_base = _old_base

# ── 接線：查、存、告訴學生、老師試評不走快取 ──────────────
_gpf = _src_key[_src_key.index("def grade_project_file"):]
_gpf = _gpf[:_gpf.index("\ndef ")]
ok("read_grade_cache" in _gpf and "write_grade_cache" in _gpf,
   "★★ grade_project_file 要真的有查、也有存")
ok("和你上次送出的完全一樣" in _gpf,
   "★★★ 命中時一定要**告訴學生**沒有重新評分 —— 不講的話他會一直重送，"
   "而重送永遠不會改變結果")
ok("修改程式" in _gpf,
   "★★ 而且要講清楚下一步是什麼（改程式，不是再按一次）")
ok("_student_id" in _gpf and "not _sid" in _gpf,
   "★★★ 沒有學號的時候要**完全不查快取** —— 退回原本的全域鑰匙，"
   "等於在那條路徑上把洞原樣打開，而且不會有任何徵兆")
_src8 = "".join(json.load(io.open(NB, encoding="utf8"))["cells"][8]["source"])
_tt = _src8[_src8.index("def teacher_test"):]
_tt = _tt[:_tt.index("\n@app.route")]
ok('cfg["no_cache"] = True' in _tt,
   "★★★ 老師試評不可以走快取 —— 他是在調規則，看到上次的分數會以為沒生效")
_sg = _src8[_src8.index("def student_grade"):]
_sg = _sg[:_sg.index("\n@app.route")]
ok('cfg["_student_id"] = student_id' in _sg,
   "★★★ 路由一定要把學號帶進 cfg —— 漏掉的話快取整個失效（每次都重評），"
   "而且畫面上完全看不出來，只會覺得「怎麼又變慢了」")


section("④i 成績要看得出是誰在什麼條件下給的（2026-09-16）")
# ⛔⛔ 老師 2026-09-16 問「搜集的資料能提供改善方向嗎」，查下去才發現：
#    成績（{學期}-submissions）裡**沒有**模型、關卡代號、是否走快取。
#    ★ 那天要回答「同一份程式 flash 給 50、claude 給 95」，
#      我是拿觀測用的 grade-stats 去對時間戳兜出來的 ——
#      兩份獨立寫入的資料，隨時可能對不起來。
# ⚠️ 補欄位愈晚做愈虧：之前的紀錄補不回來。
_calls2 = []
_old_http, _old_fb, _old_base = core._fs_http, core.FIREBASE, core._fs_docs_base
core._fs_http = lambda m, u, b=None: (_calls2.append((m, u, b)) or {})
core._fs_docs_base = lambda: "https://fake/documents"
core.FIREBASE = {"enabled": True, "api_key": "k"}
try:
    rec = core.record_submission("1420120", {"score": 100, "comments": "好"},
                                 theme="[2-1-1A] 班級置物櫃", term="11501",
                                 unit="2-1-1A", model="gemini-2.5-flash",
                                 cached=True)
    ok(rec is not None and rec.get("unit") == "2-1-1A",
       "★★ 成績要記關卡代號 —— theme 裡那個「[2-1-1A]」是給人看的字串，不是欄位")
    ok(rec is not None and rec.get("model") == "gemini-2.5-flash",
       "★★★ 成績要記**是誰給的分數**。flash 和 claude 的尺差到 45 分，"
       "沒有這一欄就永遠回答不了「他那天是被哪把尺量的」")
    ok(rec is not None and rec.get("cached") is True,
       "★★ 快取命中的那一筆不是重新評的，統計時要分得出來")
    rec2 = core.record_submission("1410105", {"score": 75, "comments": "x"})
    ok(rec2 is not None and rec2.get("unit") == "" and rec2.get("model") == ""
       and rec2.get("cached") is False,
       "★ 沒帶的時候要留空，不可以丟例外（舊呼叫端不會因此壞掉）")
finally:
    core._fs_http, core.FIREBASE = _old_http, _old_fb
    core._fs_docs_base = _old_base

# ── 接線：順序錯了會安靜地少一欄 ──────────────────────────
_sg2 = _src8[_src8.index("def student_grade"):]
_sg2 = _sg2[:_sg2.index("\n@app.route")]
ok("_st_keep" in _sg2 and "model=_st_keep" in _sg2,
   "★★ 路由要真的把模型傳進 record_submission")
ok(_sg2.index("_st_keep = dict(") < _sg2.index('result.pop("_stat"'),
   "★★★ **順序**：_stat 要在 pop 之前留下來。pop 完再讀就是空的，"
   "而空字串寫進成績不會報錯，只會安靜地少一欄")


section("④j 跨模型校正（2026-09-16）")
# ⛔⛔ 為什麼要有這支端點：實測資料顯示 flash 自己很穩（同一份程式 50/50/50），
#    真正的變異在**模型之間**（flash 50 ↔ claude 95），而且跨過 75 這條及格線。
#    ⇒ 學生過不過關，取決於那天 flash 有沒有塞車。
_cal = _src8[_src8.index("def teacher_calibrate"):]
_cal = _cal[:_cal.index("\n@app.route")]
ok(_cal.count("clean_json_for_ai") == 1 and
   _cal.index("clean_json_for_ai") < _cal.index("for _m in _models"),
   "★★★ clean_code 只算**一次**，再餵給每個模型 —— "
   "每個模型各自重解一次 .sb3 的話，量到的就不只是模型的差異")
ok('r.get("matched")' in _cal and "_got = [" in _cal,
   "★★★ 只有「真的由它自己回答」的那幾格可以拿去算差距 —— "
   "降級過的那一格量到的不是它自己的尺")
# ⛔⛔ 2026-09-18 第一次真的跑出結果就打臉了：flash 95／haiku 85，
#    畫面說「還沒跨過 75」，語氣像是「還好」——
#    但 95 是**三星**、85 是**兩星**。同一份程式，抽到哪個模型
#    決定他拿 2 顆還是 3 顆星。
#    ★ 錯在原本判的是「有沒有跨過 75」這條**寫死的線**，
#      而會改變星數的門檻不只一條（75 通關、90 三星）。
# ⚠️⚠️ 「這段程式**不可以**出現 X」的檢查，一定要先把註解拿掉。
#    這個 repo 已經栽在同一件事上**五次**了：註解為了解釋「原本哪裡錯」
#    而引用那段錯的東西，於是檢查比對到註解，在程式正確時變紅。
#    ★ 假警報比沒有警報更糟 —— 它教人放寬檢查，而下次真的壞掉時，
#      同一個動作會把真警報一起消音。
_cal_code = "\n".join(l for l in _cal.split("\n") if not l.strip().startswith("#"))
ok("crosses_pass_line" not in _cal_code and "75" not in _cal_code,
   "★★★ 後端**不可以**自己判「有沒有跨過 75」—— 會改變星數的門檻不只一條，"
   "而且星等規則只有 GRADING.scratchStar 那一份")
ok('"score_min"' in _cal and '"score_max"' in _cal,
   "★★★ 只回最高最低分，星數的判斷留給前端（規則抄第二份遲早走鐘）")
ok("_calib_last[0] = _now" in _cal and
   _cal.index("_calib_last[0] = _now") < _cal.index("_save_upload_to_temp"),
   "★★ 節流要**先蓋章再開跑**：放在後面的話，兩個人同時按就兩邊都過關"
   "（這一支每按一次都會用到付費額度）")
ok("_CALIB_BUDGET" in _cal,
   "★ 要有時間上限 —— 三個模型接力可能超過瀏覽器的等待時間")
ok("no_fallback=True" in _cal,
   "★★★ 校正端點一定要傳 no_fallback=True —— 少了它，503 一來就會"
   "把三個模型的比較塌成一個，而且畫面看起來一切正常")
# ★ 2026-09-19：分數改由後端加總之後，校正多了一種壞法——
#    模型把 deductions 回成不能用的形狀，後端只好退回用它自己填的分。
#    那一格的差距是**加法壞掉**，不是規則模糊，改規則永遠治不好。
ok('"score_source"' in _cal and '"score_model"' in _cal,
   "★★★ 校正每一格要回報分數是誰算的 —— 不回的話，"
   "模型自己加錯的格子會被當成規則問題，白改一輪規則")

# ★ 2026-09-19 第三種來源：這一關自己的參考解答。
# ⭐ 動機：樣本庫是空的（只收 50～99 分，而有記關卡的作品幾乎都是
#    100 分，56 筆繳交裡只有 6 筆有 unit），十關剛改完規則卻一份可測的
#    程式都沒有。參考解答每一關都有。
_cal2 = _src8[_src8.index("def teacher_calibrate"):]
_cal2 = _cal2[:_cal2.index("\n@app.route")]
ok('source") or "").strip() == "example"' in _cal2 or '_use_example' in _cal2,
   "★★ 校正端點要認得 source=example")
ok('_use_example and not _sample_id and "file" not in request.files' in _cal2,
   "★★ 用參考解答時不該再要求上傳檔案或挑樣本")
# ⛔⛔ 這一條是整個功能的命門：
#    prompt 第 4 條寫著「若與【老師參考解答】完全一致，必須給予滿分，
#    不可扣分」。把參考解答同時當「受測程式」和「對照答案」送進去，
#    等於叫模型拿一份東西和它自己比 —— 兩邊一定都回 100，
#    畫面會顯示「✅ 只差 0 分」，而那個 0 什麼也沒有證明。
ok('"" if _use_example else cfg.get("example_code"' in _cal2,
   "★★★ 用參考解答當受測程式時，**不可以**再把它當對照答案送進去 —— "
   "送了兩邊都會回 100，變成一個永遠通過、什麼也測不到的測試")
ok('False if _use_example else cfg.get("is_standard_answer"' in _cal2,
   "★★ is_standard_answer 要跨成 False：那一版的指示是「不可以因為相似就"
   "給滿分，必須嚴格逐條檢查評分法律」，正是這一模式要測的行為")
ok('"source": ("example" if _use_example' in _cal2,
   "★★ 回傳要標明來源 —— 三種來源的結果不能混著看")
ok('example_code") or "")' in _cal2 and "還沒有填參考解答" in _cal2,
   "★ 這一關沒填參考解答時要講清楚，不是丟一個空結果")


section("④m 校正樣本庫（2026-09-17）")
# ★ 老師提的，而且理由比我原本的設計好：「因為目前也在進行系統調整」——
#   系統還在調，**正是**要趁現在開始存的理由：等評分標準改細之後，
#   可以用**同一份程式**重跑，那是唯一能證明「差距真的變小」的方法。
# ⛔⛔ 在這之前整個系統沒有任何地方留下學生的程式（四支寫入都沒存
#    clean_code，而 .sb3 是暫存檔），所以事後想重評任何一份都辦不到。

# ── 桶：邊界要對齊 75，而且滿分／0 分不收 ──────────────────
ok(core.calib_bucket(100) is None and core.calib_bucket(0) is None,
   "★★★ 滿分和 0 分**不收** —— 每個模型都會給一樣的分數，量不到分歧"
   "（實測：2-1-1A 十一筆全部 100 分）")
ok(core.calib_bucket(49) is None,
   "★★ 50 分以下不收（那是「幾乎沒做」，量不到評分的細節）")
# ⛔ 2026-09-18 老師：「2-1-1A 曾經有一份打錯字變成 95 分」——
#    查出兩筆：'elephant' 拼成 'elephent'、'apple' 拼成 'appie'，各扣 5 分。
#    ★ 那種「只差一個字」的作品**最能考驗評分的一致性**：同樣是名稱不符規定，
#      實際扣過 5 分、7.5 分、也扣過 15 分。
#    原本上限 89 剛好把 90～99 整段漏掉 —— 而那正是最該收的。
ok(core.calib_bucket(95) == "90-99" and core.calib_bucket(90) == "90-99"
   and core.calib_bucket(99) == "90-99",
   "★★★ 90～99 要收 —— 「只差一個字」的作品最能考驗評分一致性"
   "（老師 2026-09-18 指出的那兩筆 95 分就是）")
ok(core.calib_bucket(89) != core.calib_bucket(90),
   "★ 89 和 90 要分在不同桶（90 是三星的門檻）")
ok(core.calib_bucket(74) != core.calib_bucket(75),
   "★★★ 桶的邊界要切在 **75**（及格線）—— 分歧最有後果的就是這一條線附近")
ok(core.calib_bucket(50) == core.calib_bucket(64)
   and core.calib_bucket(85) == core.calib_bucket(89),
   "★ 同一個桶內要一致")

# ── 寫入：範圍外不寫、沒關卡不寫、同一份不重複 ──────────────
_cal2 = []
_old_http, _old_fb, _old_base = core._fs_http, core.FIREBASE, core._fs_docs_base
core._fs_docs_base = lambda: "https://fake/documents"
core.FIREBASE = {"enabled": True, "api_key": "k"}
try:
    core._fs_http = lambda m, u, b=None: (_cal2.append((m, u, b)) or {})
    core.save_calib_sample("1410105", "2-1-1B", 100, "flash", "程式碼")
    ok(not [c for c in _cal2 if c[0] == "PATCH"],
       "★★★ 100 分的**不可以**收進樣本庫（收了只是佔掉額度，量不到東西）")
    _cal2.clear()
    core.save_calib_sample("1410105", "", 70, "flash", "程式碼")
    ok(not [c for c in _cal2 if c[0] == "PATCH"],
       "★★ 沒有關卡代號的不收 —— 樣本要配關卡的評分標準才有意義")
    _cal2.clear()
    core.save_calib_sample("1410105", "2-1-1B", 70, "flash", "程式碼")
    _w = [c for c in _cal2 if c[0] == "PATCH"]
    ok(len(_w) == 1 and "2-1-1B__65-74__0" in _w[0][1],
       "★★ 70 分要收進 2-1-1B 的 65-74 桶　←　%r" % (_w[0][1][-40:] if _w else None))
    ok("calib-samples" in (_w[0][1] if _w else ""),
       "★ 存進 {學期}-calib-samples")
    _sent = _w[0][2]["fields"] if _w else {}
    ok("clean_code" in _sent,
       "★★★ 一定要存**程式本身** —— 這整件事就是為了事後能重評，"
       "只存字數的話和現在的觀測資料沒有兩樣")
finally:
    core._fs_http, core.FIREBASE = _old_http, _old_fb
    core._fs_docs_base = _old_base

# ── 清單不可以把程式內容一起吐出來 ─────────────────────────
_lc = _src_key[_src_key.index("def list_calib_samples"):]
_lc = _lc[:_lc.index("\ndef ")]
ok('pop("clean_code"' in _lc,
   "★★ 清單要把 clean_code 拿掉 —— 那是 2～4 KB × N，下拉選單用不到")

# ── 接線 ─────────────────────────────────────────────────
ok("save_calib_sample" in _sg2,
   "★★ 批改成功後要真的去收樣本")
ok('"cached"' in _sg2[_sg2.index("save_calib_sample") - 400:_sg2.index("save_calib_sample")],
   "★★ 快取命中的不收 —— 那一次沒有真的評分，而且同一份先前就收過了")
_cl = _src8[_src8.index("def teacher_calibrate"):]
_cl = _cl[:_cl.index("\n@app.route")]
ok('_unit = str(_sample.get("unit")' in _cl,
   "★★★ 用樣本校正時，評分標準要用**樣本自己的關卡** —— "
   "拿 B 關的程式套 A 關的規則，量到的東西沒有意義，而且畫面看不出來")
ok("overrides and not _sample" in _cl,
   "★★★ 用樣本時不可以吃畫面上的 overrides —— 那是另一關的規則")


section("④l 自動配對：降級後背景補跑（2026-09-17）")
# ★ 老師問「只要有學生走到 Claude，就會自動啟動校正嗎？」—— 原本不會。
#   走到 Claude 只是「用 haiku 評了那一份」，沒有第二個分數就沒得比。
#   ⇒ 改成主動製造：降級發生時，背景用主要模型再評一次同一份程式。
# ⛔⛔ 這三條是紅線，錯了**都不會有徵兆**：
_pp = _src8[_src8.index("def _pair_probe"):]
_pp = _pp[:_pp.index("\n@app.route")]
ok("record_submission" not in _pp and "record_grade_stat" in _pp,
   "★★★ 補跑的那一次**絕對不可以寫進成績** —— 它不是學生交的，"
   "只能進 grade-stats 觀測")
ok("grade_project_file" not in _pp,
   "★★★ 不可以走 grade_project_file —— 那會查／寫快取，"
   "把觀測資料汙染成「學生的分數」")
ok("_grade_sem" not in _pp and "_PAIR_SEM" in _pp,
   "★★★ 不可以佔用學生的並發名額 —— 上課尖峰多 30 條背景批改去搶那 8 個"
   "名額，症狀是「大家一起變慢」，最難查的那一種")
ok("blocking=False" in _pp,
   "★★★ 搶不到自己的名額就**直接放棄** —— 這是加分資料，不是非拿到不可")
ok('claude_key=""' in _pp,
   "★★★ 補跑**不可以帶 Claude 金鑰** —— 帶了就可能又走到付費那一階，"
   "變成每次降級都多花一次錢")
ok("no_fallback=True" in _pp,
   "★★ 補跑也不准降級 —— 降級就不是在量這個模型的尺了")
ok('"probe": True' in _pp,
   "★★★ 要標 probe —— 觀測頁靠這一格把它排除在「學生的批改」之外")
# ── 觸發條件 ──────────────────────────────────────────────
ok("_pair_probe" in _sg2 and "_threading.Thread" in _sg2,
   "★★ 路由要真的在背景起這一條")
ok('_used != _primary' in _sg2,
   "★★★ 只有**降級發生時**才補跑（用的模型 != 主要模型）")
ok('_st_keep.get("cached")' in _sg2,
   "★★ 快取命中的不補 —— 那一次根本沒有評分")
ok("_is_claude(_primary)" in _sg2,
   "★★★ 主要模型本身是 Claude 的話不補 —— 不然每次降級都多花一次錢")
ok(_sg2.index("_clean_keep = ") < _sg2.index('result.pop("clean_code"'),
   "★★ clean_code 要在 pop 之前留下來（和 _stat 同一個道理）")
ok(_sg2.index("_threading.Thread") < _sg2.index('return jsonify({"ok": True'),
   "★ 執行緒在回傳前起來，學生的回應不必等它")


section("④k anthropic 的 temperature（2026-09-16）")
# ⛔⛔ anthropic **1.x 把 temperature 整個拿掉了**（把 1.6.0 的 wheel 拆開
#    看過：整個套件裡 temperature 出現 0 次，top_p／top_k 也沒了）。
#    ★ 症狀不是報錯，是**安靜地換了行為**：
#      gemini 是 temp=0（固定），Claude 變成用模型預設值 ——
#      也就是備援模型一直在「會抖」的狀態下評分。
#      而評分最不該有的就是「同一份程式給不同分數」。
_src2 = "".join(json.load(io.open(NB, encoding="utf8"))["cells"][2]["source"])
ok('"anthropic<1"' in _src2 or "'anthropic<1'" in _src2,
   "★★★ 安裝那一行要把 anthropic 釘在 1.0 以下 —— 1.x 沒有 temperature，"
   "備援模型會用預設溫度評分")
ok("temperature" in _src2,
   "★★ 而且要在原地寫清楚為什麼釘版本 —— 不然下次有人「順手升級」就壞了")
ok("_anthropic_has_temperature" in _src8 and "anthropic_temperature" in _src8,
   "★★★ 健康檢查要直接回報「溫度有沒有生效」—— 只報版本號不夠，"
   "這種不會報錯、只是行為變了的狀況一定要看得見")
_ant = _src_key[_src_key.index("def single_agent_grading"):]
ok("不是**在固定溫度" in _ant or "不是**在固定溫度下評分" in _ant,
   "★★ TypeError 那一行的訊息要講**後果**（分數會抖），不是只講相容性")


section("④n 分數改由後端加總，模型只負責標價（2026-09-19）")
# ⛔⛔ 這一節原本測的是「叫模型自己再算一次」（③）。那個做法**失敗了**，
#    留著這段歷史是為了不要再走一次：
#      2026-09-18 flash 97／haiku 87：兩邊找到的問題和該扣的分一模一樣，
#      haiku 卻少 10 分，沒有任何扣分項目對應 ⇒ 不是規則模糊，是加減法。
#      於是在 prompt 裡寫了「輸出前自己算一次、以 deducted_items 為準」。
#      隔天同一份程式，haiku 在 deducted_items 裡**自己寫下正確結論**：
#        「重新檢視：…但功能對應正確。扣分調整：僅扣初始化拼寫錯誤 3 分。」
#      然後 score 填 82（＝100－3－15，那 15 分是它推理途中扣掉、
#      最後又說不該扣的）。flash 同一份 97。
# ★★ 結論：模型知道答案、也寫出來了，就是不會把它換算成分數。
#    叫它「再算一次」等於再賭一次。⇒ 加法交給程式（②）。
# ⚠️ 對帳過歷史紀錄：56 筆裡 15 筆扣分寫得出數字，14 筆算術吻合 ——
#    偶發，但每次都落在 90（三星線）上，而且不展開扣分明細看不出來。
_prompt = _src_key[_src_key.index("🔥【評分嚴格度指示】🔥"):]
_prompt = _prompt[:_prompt.index("🛡️【全域防禦規則")]
ok("deductions" in _prompt,
   "★★★ prompt 要叫模型把扣分寫進 deductions 陣列（後端只看得懂這個）")
ok('"points"' in _prompt,
   "★★★ 每一條要標價（points），不然後端沒東西可以加")
ok("會被忽略" in _prompt,
   "★★★ 要明講 score 欄位**會被忽略** —— 不講的話模型仍然會為了湊分數"
   "而去動扣分項目（③ 就是這樣壞的）")
ok("不存在" in _prompt,
   "★★★ 要禁止「隱形扣分」：沒寫進 deductions 的扣分等於不存在")
ok("bonus_points" in _prompt,
   "★★ 加分題要有自己的欄位，不然加分的作品會被算成漏扣")
ok("100" in _prompt and ("作弊" in _prompt or "抄襲" in _prompt),
   "★★★ 0 分（作弊／空白）要寫成 points:100 的扣分 —— "
   "否則後端加總會把一份作弊作業算成 100 分")
_fs = _src_key[_src_key.index("def _format_spec"):]
_fs = _fs[:_fs.index("\ndef ")]
ok("deductions" in _fs and "bonus_points" in _fs,
   "★★★ 沒有 schema 的模型（Claude／Gemma）靠 _format_spec 才知道欄位，"
   "漏掉就永遠退回模型自己的分數")
_sch = _src_key[_src_key.index("grading_schema = types.Schema"):]
_sch = _sch[:_sch.index("\n    def ask_agent")]
ok("deductions" in _sch and "bonus_points" in _sch,
   "★★★ Gemini 吃 response_schema；schema 沒有這兩欄就不會生成")
ok(_sch.index("deductions") < _sch.index('"score"'),
   "★★ deductions 要排在 score 前面：Gemini 照 properties 順序生成，"
   "先列扣分再寫分數比較不會打架")


section("④o 後端加總本身要算對（2026-09-19）")
_ad = core.apply_deductions

def _ad_case(label, res, want_score, want_src):
    _s, _m = _ad(res)
    ok(res.get("score") == want_score and _s == want_src,
       "%s（拿到 %s／%s，預期 %s／%s）" % (label, res.get("score"), _s,
                                        want_score, want_src))

# ★ 老師 2026-09-19 貼回來的那一份：haiku 自己說只扣 3 分，score 卻填 82。
_ad_case("★★★ haiku 那份 82 分要被改成 97",
         {"score": 82, "bonus_points": 0,
          "deductions": [{"rule": "(8) 物品名稱", "points": 3,
                          "why": "elephent 應為 elephant"}],
          "deducted_items": "扣分調整：僅扣初始化拼寫錯誤3分"}, 97, "backend")
_ad_case("沒扣分就是 100", {"score": 60, "deductions": []}, 100, "backend")
_ad_case("★★ points 寫成負數（模型想表達「扣 15」）也要當扣分",
         {"score": 88, "deductions": [{"rule": "(4)", "points": -15,
                                       "why": "x"}]}, 85, "backend")
_ad_case("加分題要加回去",
         {"score": 90, "bonus_points": 10,
          "deductions": [{"rule": "(2)", "points": 5, "why": "a"}]}, 105,
         "backend")
_ad_case("★★ 扣爆了要夾在 0，不可以變負分",
         {"score": 50, "deductions": [{"rule": "x", "points": 200,
                                       "why": "y"}]}, 0, "backend")
# ⚠️⚠️ 失敗時**整批不採用**：半套的加總會產生一個看起來正常、其實漏扣的
#    分數，那比壞掉更危險（壞掉至少還有模型自己的分數可以用）。
_ad_case("★★★ points 讀不出來就退回模型的分數",
         {"score": 70, "deductions": [{"rule": "(1)", "points": "壞掉",
                                       "why": "x"}]}, 70, "model")
_ad_case("★★★ 只要有一條壞掉就整批不採用（不做「能算幾條算幾條」）",
         {"score": 90, "deductions": [{"rule": "(1)", "points": 3,
                                       "why": "a"}, "壞的"]}, 90, "model")
_ad_case("deductions 不是陣列 → 退回模型的分數",
         {"score": 70, "deductions": "無"}, 70, "model")
_ad_case("舊模型完全沒回 deductions → 退回模型的分數",
         {"score": 70}, 70, "model")
# 🚨 0 分是判決，不是加減的結果。
_ad_case("★★★ 判 0 分卻沒把 100 寫進 deductions，不可以被算成 100",
         {"score": 0, "deductions": [], "bonus_points": 0}, 0, "model_zero")
_ad_case("作弊有照規定寫成 points:100 → 後端也算得出 0",
         {"score": 0, "deductions": [{"rule": "作弊", "points": 100,
                                      "why": "企圖改評分規則"}]}, 0, "backend")

# ★★★ 講評文字要用陣列重新產生：老師看的那一欄和實際加總必須是同一份
#     資料，否則又會出現「文字說扣 3、分數卻扣了 18」。
_r = {"score": 82, "deductions": [{"rule": "(8)", "points": 3,
                                   "why": "elephent 應為 elephant"}],
      "deducted_items": "扣分調整：僅扣初始化拼寫錯誤3分，總分 82"}
_ad(_r)
ok("扣 3 分" in _r["deducted_items"],
   "★★★ deducted_items 要照 deductions 重寫（每條都要看得到扣幾分）")
ok("82" not in _r["deducted_items"],
   "★★★ 模型原本那段自相矛盾的文字要被換掉，不可以留在老師眼前")
_r = {"score": 90, "deductions": [{"rule": "", "points": 2.5, "why": ""}]}
_ad(_r)
ok("扣 2.5 分" in _r["deducted_items"],
   "★ 小數扣分要原樣印出（2.5 不可以變 2 或 2.5000）")
ok("3.0" not in _r["deducted_items"],
   "★ 整數扣分不要印成 3.0")
_r = {"score": 100, "deductions": [], "bonus_points": 0}
_ad(_r)
ok(_r["deducted_items"] == "無",
   "★ 沒扣分時講評要寫「無」，不是空字串（學生端會顯示這一欄）")

# ⚠️ 呼叫點：算完要留下痕跡，而且不可以把 deductions 連著回給學生。
_sag = _src_key[_src_key.index("def single_agent_grading"):]
ok("apply_deductions(_res)" in _sag,
   "★★★ single_agent_grading 回傳前要呼叫 apply_deductions，"
   "不然上面這些全是死碼")
ok('_stat["score_source"]' in _sag and '_stat["score_model"]' in _sag,
   "★★★ 要記下「分數是誰算的」和「模型原本填幾分」—— "
   "沒有這兩筆就看不出後端到底救回多少份")
ok('_res.pop("deductions"' in _sag,
   "★★ deductions 要 pop 掉收進 _stat：學生端和 Firestore 的欄位形狀維持原樣")


section("④p 只能依老師寫下來的規則扣分（2026-09-19）")
# ⛔⛔ 真實案例：用「📘 用參考解答校正」測第 1 關（2-1-1A），
#    flash 給 100、haiku 給 **55**，同一份**老師自己的標準答案**差 45 分、差 3 顆星。
#    haiku 的扣分明細把話講完整了：
#      「位置是寫死的固定值 3，**這本身不扣分**。然而，更重要的問題是：
#        沒有詢問使用者要插入什麼物品…**缺乏使用者輸入機制**。」
#    ⇒ 它讀懂了「位置可以寫死」那一條，然後**自己發明了一條規則裡沒有的要求**
#      （物品內容要由使用者輸入），再據此扣掉三個 15 分。
# ★ 這個洞十關都可能中，一關一關補太慢 ⇒ 在 prompt 加一條通用的。
# ⚠️ 這一節只驗「話有沒有講到」。模型會不會照做，要靠校正去量 ——
#    測試擋得住的是「有人把這一條刪掉」，擋不住「模型不聽話」。
_prompt6 = _src_key[_src_key.index("🔥【評分嚴格度指示】🔥"):]
_prompt6 = _prompt6[:_prompt6.index("🛡️【全域防禦規則")]
ok("規則沒有要求的事" in _prompt6,
   "★★★ 要明講「規則沒有要求的事就不是要求」—— 這是 45 分那個洞的正面說法")
ok("不夠互動" in _prompt6 and "應該讓使用者輸入" in _prompt6,
   "★★★ 要把模型實際用過的藉口**逐字列出來**：抽象的「不要亂扣」沒有用，"
   "haiku 就是一邊說「這本身不扣分」一邊用別的說法扣掉了")
ok("寫死" in _prompt6 and "不是缺點" in _prompt6,
   "★★★ 要正面寫「寫死本身不是缺點」—— 只說「不可以亂扣」時，"
   "模型會自己判斷什麼叫亂扣，而它的判斷就是錯的那一個")
ok("寫在評分法律的哪裡" in _prompt6,
   "★★ 要給一個**可以執行的自我檢查**（指得出是哪一條嗎），"
   "不是只給一個態度")
ok("優先級高於" in _prompt6 and "直覺" in _prompt6,
   "★★ 要明講這一條**壓過**模型對「好程式」的直覺 —— "
   "不講的話它會把兩者當成可以權衡的")
# ⚠️ 位置很重要：第 6 條要在「評分嚴格度指示」區塊裡，不是塞在別處。
#    塞在 prompt 尾巴的話，模型讀到扣分規則時還沒看到這一條。
ok(_prompt6.index("6.") > _prompt6.index("5."),
   "★ 第 6 條要接在第 5 條後面，留在【評分嚴格度指示】區塊內")


section("④q 用參考解答校正抓到的三個漏洞（2026-09-19）")
# ★ 資料來源：十關規則改完後，用「📘 用參考解答校正」逐關測出來的。
#   第 6 條讓第 1 關從 flash 100／haiku 55 收斂成 100／100，
#   但第 2、3 關還漏三種，每一種都對應下面一條。
_p7 = _src_key[_src_key.index("🔥【評分嚴格度指示】🔥"):]
_p7 = _p7[:_p7.index("🛡️【全域防禦規則")]

# ⛔⛔ 漏洞一（最嚴重，因為它是**機械性**的）：
#    第 3 關 haiku 把加分題「小毛驢播放邏輯是孤兒積木」寫進 deductions 扣 10 分。
#    第 3 條本來就寫了「絕對不可列入扣分項目」，但那是在②之前寫的 ——
#    現在分數由後端加總 deductions，寫進去是**真的從 100 分裡扣掉**。
#    ⇒ 規則要講到「陣列」這個層級，光說「不可列入扣分項目」模型不覺得矛盾。
ok("deductions" in _p7[:_p7.index("4. 抄襲")],
   "★★★ 第 3 條要講到 deductions 陣列 —— 分數改由後端加總之後，"
   "把加分題寫進去是真的倒扣，不再只是措辭問題")
ok("bonus_points 不加" in _p7 and "不是扣分" in _p7,
   "★★★ 要正面說「沒做到＝bonus_points 不加」，給它一個**該做什麼**的指示；"
   "只說「不可以扣」時它還是得自己想該怎麼表達")

# ⛔ 漏洞二：第 3 關 haiku 自己寫「雖然最終效果達成，但實現方式不符合
#    規則精神」然後扣 10 分。這直接牴觸第 1 條（鼓勵多元演算法）。
ok("不符合規則的精神" in _p7 or "規則的精神" in _p7,
   "★★★ 要明文禁止用「不符合規則精神／原意」扣分")
ok("雖然最終效果達成" in _p7,
   "★★★ 要把它自己會寫的那句話當成**自我檢查的觸發語**："
   "寫得出「雖然最終效果達成，但是…」就代表不可以扣。"
   "抽象的原則它會繞過去，具體的句型繞不過")

# ⛔ 漏洞三：第 2 關 haiku 扣「未驗證輸入有效性」「未檢查威利是否在清單中」。
#    第 6 條已經寫了「不可以用『沒有防呆』扣分」，它卻改口說
#    「規則要求『能正確顯示該位置的同學編號』，**邏輯不完整**」——
#    把發明的要求包裝成「既有的那一條沒被完整滿足」，繞過了禁令。
# ★ 老師的決定（2026-09-19）：以正常操作為準，防呆不扣分。
ok("正常操作" in _p7,
   "★★★ 要給一個**判斷基準**（以正常操作為準），不是只列禁止事項 —— "
   "只列禁止事項時，模型會換一個說法達成同樣的扣分")
ok("邏輯不完整" in _p7,
   "★★★ 要堵住它實際用過的那個包裝說法（「邏輯不完整」）—— "
   "第 6 條原本只禁止「沒有防呆」，它改口就繞過去了")
ok("除非規則明確要求" in _p7,
   "★★ 要留出口：老師某一關真的想考防呆時，寫進規則就算數")


section("⑤ 和空白範本完全一樣仍然直接 0 分，不打 API")
_FakeClient.script = lambda m: (_ for _ in ()).throw(AssertionError("不該呼叫 API"))
core.time = _Clock()
res = core.single_agent_grading(KEYS, "規則", "主題", "一模一樣", "一模一樣",
                                "參考解答", "gemini-2.5-flash", True)
ok(res.get("score") == 0, "★★ 交空白範本＝0 分（這條規則不可以被重試邏輯改掉）")

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
