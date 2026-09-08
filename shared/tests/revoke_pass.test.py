# -*- coding: utf-8 -*-
"""取消通關：兩份紀錄都要刪，只刪一份會被學生端自動加回來

跑法：python3 shared/tests/revoke_pass.test.py

⛔⛔ 為什麼有這一份（老師 2026-09-08）
   老師在未通關的圖裡發現有人自己打「挑戰成功」，要一個取消通關的工具。
   查資料流時發現一個**只刪一半就會無聲還原**的坑：
     ① artifacts/…/progress/{key} 的 completed —— 星星是從這裡算的
     ② {學期}-ocr-passed/{學號} 的 passed_json —— thinking.html 下次開頁
        會拿這份去「補記漏掉的關卡」
   只刪 ①：學生一登入，②就把它加回去了，而且完全沒有徵兆。

★★ 這一份用假的 Firestore **真的把 revoke_ocr_pass 跑起來**。
   這種「兩個地方要一起改」的邏輯，grep 只看得到函式在，
   看不出它到底改了幾個地方、型別有沒有被寫壞。
"""
import io
import json
import os
import sys
import types as _pytypes

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NB = os.path.join(ROOT, "shared", "backend.ipynb")
_pass, _fail = [0], [0]


def ok(c, l):
    if c:
        _pass[0] += 1
        print("  ✅ " + l)
    else:
        _fail[0] += 1
        print("  ❌ " + l)


def section(t):
    print("\n── %s ──" % t)


def _install_fake_genai():
    genai = _pytypes.ModuleType("google.genai")
    genai.Client = type("C", (), {"__init__": lambda self, **k: None})
    t = _pytypes.ModuleType("google.genai.types")
    for n in ("Content", "Part", "GenerateContentConfig", "Schema"):
        setattr(t, n, type(n, (), {"__init__": lambda self, *a, **k: None,
                                   "from_text": staticmethod(lambda *a, **k: {})}))
    t.Type = type("T", (), {"OBJECT": "O", "STRING": "S", "INTEGER": "I"})
    g = _pytypes.ModuleType("google")
    g.genai = genai
    sys.modules["google"], sys.modules["google.genai"] = g, genai
    sys.modules["google.genai.types"] = t


_install_fake_genai()
src = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][6]["source"])
core = _pytypes.ModuleType("core_under_test")
exec(compile("\n".join(src.split("\n")[1:]), "<cell6>", "exec"), core.__dict__)


# ══════════════════════════════════════════════════════════
# 假的 Firestore：記下每一次 HTTP，讓斷言看得到「改了哪些文件」
# ══════════════════════════════════════════════════════════
class FakeFS(object):
    def __init__(self):
        self.docs = {}
        self.calls = []

    def http(self, method, url, body=None, _retry=True):
        path = url.split("?")[0].replace("BASE/", "")
        self.calls.append((method, url, body))
        if method == "GET":
            if path not in self.docs:
                raise Exception("404 not found")
            return {"fields": self.docs[path]}
        if method == "PATCH":
            cur = self.docs.setdefault(path, {})
            cur.update((body or {}).get("fields", {}))
            return {"fields": cur}
        if method == "POST":
            self.docs[path + "/auto%d" % len(self.docs)] = (body or {}).get("fields", {})
            return {}
        raise Exception("沒處理的 method " + method)


def setup(passed=("1", "3", "7"), completed_ints=(1, 3, 7), with_key=True):
    fs = FakeFS()
    core.FIREBASE = {"enabled": True, "api_key": "K"}
    core._fs_docs_base = lambda: "BASE"
    core._fs_http = fs.http
    fs.docs["11501-ocr-passed/1410101"] = core._to_fs_fields({
        "student_id": "1410101",
        "passed_json": json.dumps(list(passed)),
        "urls_json": json.dumps({c: "http://img/%s" % c for c in passed}),
        "dates_json": json.dumps({c: "2026-09-01" for c in passed}),
    })
    roster = {"cls": "801", "no": "01", "name": "小明"}
    if with_key:
        roster["key"] = "801_01_小明"
    fs.docs["roster/1410101"] = core._to_fs_fields(roster)
    fs.docs["artifacts/comp-think-app/public/data/progress/801_01_小明"] = {
        "completed": {"arrayValue": {"values": [
            {"integerValue": str(i)} for i in completed_ints]}},
        "name": {"stringValue": "小明"},
    }
    return fs


section("① 兩份紀錄都要刪掉")
fs = setup()
res = core.revoke_ocr_pass("1410101", "3", term="11501", reason="自己打字偽造")
ok(res.get("ok") is True, "★★ 整體要回報成功　←　%r" % res)
left = json.loads(core._from_fs_fields(
    fs.docs["11501-ocr-passed/1410101"])["passed_json"])
ok(left == ["1", "7"],
   "★★★ {學期}-ocr-passed 的 passed_json 要少掉那一關　←　%r" % left)
arr = fs.docs["artifacts/comp-think-app/public/data/progress/801_01_小明"]["completed"]["arrayValue"]["values"]
ok([v["integerValue"] for v in arr] == ["1", "7"],
   "★★★ 星星來源 completed 也要少掉那一關（只刪一邊會被學生端自動補記回來）"
   "　←　%r" % arr)

section("② 型別不可以被寫壞")
ok(all("integerValue" in v for v in arr),
   "★★★ completed 原本是整數陣列，刪完還要是整數 —— "
   "走 _to_fs_fields 會被寫成字串，讀回來就不是陣列了")
_patch = [c for c in fs.calls
          if c[0] == "PATCH" and "comp-think-app" in c[1]]
ok(_patch and "updateMask.fieldPaths=completed" in _patch[0][1],
   "★★★ PATCH 一定要帶 updateMask —— 不帶會把文件其他欄位一起清掉")
ok("name" in fs.docs["artifacts/comp-think-app/public/data/progress/801_01_小明"],
   "★★ 文件裡其他欄位（姓名等）要留著")

section("③ 稽核：成績變更不可以無聲")
_audit = [k for k in fs.docs if k.startswith("11501-ocr-revoked")]
ok(len(_audit) == 1, "★★★ 一定要留一筆稽核　←　%r" % _audit)
_a = core._from_fs_fields(fs.docs[_audit[0]])
ok(_a.get("reason") == "自己打字偽造" and _a.get("student_id") == "1410101"
   and _a.get("challenge_id") == "3",
   "★★★ 稽核要記下學號、關卡、原因　←　%r" % _a)
ok(_a.get("result_ct_progress", "").startswith("已移除"),
   "★★ 稽核要記下「每一份實際做到什麼」，兩份只成功一份時查得出來")

section("④ 本來就沒過的那一關：不可以當成錯誤")
fs = setup()
res = core.revoke_ocr_pass("1410101", "9", term="11501", reason="測試")
ok(res.get("ok") is True and "本來就沒有" in res.get("ocr_passed", ""),
   "★★ 重複取消要安靜地成功（冪等），不要嚇老師　←　%r" % res.get("ocr_passed"))

section("⑤ 名冊查不到進度鍵：要講出來，不可以假裝成功")
fs = setup(with_key=False)
fs.docs["roster/1410101"] = core._to_fs_fields({"cls": "", "no": "", "name": ""})
res = core.revoke_ocr_pass("1410101", "1", term="11501", reason="測試")
ok("名冊查不到" in res.get("ct_progress", ""),
   "★★★ 星星那一份沒動到一定要明講 —— 不然老師以為取消了，星星還在　←　%r"
   % res.get("ct_progress"))

section("⑥ 學期不可以搞錯（11502 是另一個集合）")
ok(core.ct_progress_collection("11501").endswith("/progress")
   and core.ct_progress_collection("11502").endswith("/progress_sem2"),
   "★★★ 11501 用 progress、11502 用 progress_sem2 —— "
   "寫錯會去改另一個學期的資料，而且不會報錯")

section("⑦ 端點：沒寫原因就拒絕")
_srv = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][8]["source"])
ok('methods=["POST"]' in _srv[_srv.index("/api/teacher/revoke-pass"):][:400],
   "★★ 只收 POST —— 不可以是「點一下網址就生效」的東西")
ok("len(reason) < 2" in _srv,
   "★★★ 沒寫原因要擋下來：事後查稽核時「為什麼取消」比「取消了什麼」更重要")

section("⑧ 教師端：兩個學期都要有，而且刻意不做成按鈕")
for _t in ("11501", "11502"):
    _h = io.open(os.path.join(ROOT, _t, "teacher.html"), encoding="utf-8").read()
    _code = _h.replace("/*", "\n/*")            # 只是讓下面好切
    ok("window.revokePass = revokePass" in _h,
       "★★★ %s 要有 revokePass（兩個學期都要，漏掉的那一邊不會有任何錯誤訊息）" % _t)
    ok("'/api/teacher/revoke-pass'" in _h or '"/api/teacher/revoke-pass"' in _h,
       "★★★ %s 要打後端端點 —— 前端寫不進 {學期}-ocr-passed（規則只給讀）" % _t)
    # ⚠️ 不可以做成按鈕：和「重算星星」同一個理由（一按就改成績，會誤觸）
    ok("onclick=\"revokePass" not in _h and "onclick='revokePass" not in _h,
       "★★★ %s 不可以把它做成畫面上的按鈕（重算星星當初就是為此被移除的）" % _t)
    ok("recomputeAllStars()" in _h[_h.index("async function revokePass"):]
       [:2600],
       "★★ %s 要提醒接著跑 recomputeAllStars —— 後端不算星星" % _t)
    ok("reason.length < 2" in _h,
       "★★ %s 前端也要擋沒寫原因（後端會再擋一次，但錯誤要早點講）" % _t)

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
