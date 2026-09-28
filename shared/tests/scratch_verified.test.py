# -*- coding: utf-8 -*-
"""後端確認過的 Scratch 星星（scratchVerified）—— 四步切換的第 ①步

跑法：python3 shared/tests/scratch_verified.test.py

★ 為什麼有這一份（老師 2026-09-27：「如何防止類似 Tampermonkey 的攻擊？」）
  Scratch 星星原本只由學生的瀏覽器寫。這一步讓後端**並行**寫一份
  學生碰不到的星星（第 ④步才用規則鎖），前端完全不變。
★ 這一份**真的把 record_scratch_verified 執行起來**（用假的 Firestore），
  不是 grep —— 「讀 → 算 → 寫」加上前提條件重試，靜態看不出對不對。
"""
import io
import json
import os
import sys
import types as _pytypes
import urllib.error

for _s in (sys.stdout, sys.stderr):      # Windows 繁中主控台（理由見 grade_retry.test.py）
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NB = os.path.join(ROOT, "shared", "backend.ipynb")
_pass, _fail = [0], [0]


def ok(cond, label):
    if cond:
        _pass[0] += 1
        print("  ✅ " + label)
    else:
        _fail[0] += 1
        print("  ❌ " + label)


def section(t):
    print("\n── " + t + " ──")


def _install_fake_genai():
    genai = _pytypes.ModuleType("google.genai")
    genai.Client = type("Client", (), {"__init__": lambda self, *a, **k: None})
    t = _pytypes.ModuleType("google.genai.types")
    for name in ("Content", "Part", "GenerateContentConfig", "Schema"):
        setattr(t, name, type(name, (), {"__init__": lambda self, *a, **k: None,
                                         "from_text": staticmethod(lambda *a, **k: {})}))
    t.Type = type("Type", (), {k: k for k in ("OBJECT", "STRING", "INTEGER", "NUMBER",
                                              "ARRAY", "BOOLEAN")})
    genai.types = t
    google = _pytypes.ModuleType("google")
    google.genai = genai
    sys.modules["google"] = google
    sys.modules["google.genai"] = genai
    sys.modules["google.genai.types"] = t


_install_fake_genai()
_SRC6 = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][6]["source"])
_SRC8 = "".join(json.load(io.open(NB, encoding="utf-8"))["cells"][8]["source"])
core = _pytypes.ModuleType("core_under_test")
exec(compile("\n".join(_SRC6.split("\n")[1:]), "<cell6>", "exec"), core.__dict__)


class FakeFS(object):
    """假的 Firestore：記下每一個請求，GET 回傳目前的文件。"""

    def __init__(self, doc=None, fail_patch_times=0, get_error=None):
        self.doc = doc                   # None ＝ 文件不存在（GET 回 404）
        self.calls = []
        self.fail_patch_times = fail_patch_times
        self.get_error = get_error
        self.ver = 1

    def __call__(self, method, url, body=None, _retry=True):
        self.calls.append((method, url, body))
        if method == "GET":
            if self.get_error:
                raise self.get_error
            if self.doc is None:
                raise urllib.error.HTTPError(url, 404, "not found", None, None)
            return {"fields": self.doc, "updateTime": "T%d" % self.ver}
        if method == "PATCH":
            if self.fail_patch_times > 0:
                self.fail_patch_times -= 1
                self.ver += 1                            # 別人剛寫過
                raise urllib.error.HTTPError(url, 400, "FAILED_PRECONDITION", None, None)
            self.doc = dict(self.doc or {})
            self.doc.update(body["fields"])
            self.ver += 1
            return {}
        raise AssertionError("不該有其他請求：" + method)


def use(fs):
    core._fs_http = fs
    core.FIREBASE["enabled"] = True
    return fs


section("① 星等門檻（和 shared/grading.js 逐分比對在 scratchverified.test.js）")
ok(core.scratch_star(90) == 3 and core.scratch_star(89) == 2, "90 分 3⭐、89 分 2⭐")
ok(core.scratch_star(75) == 2 and core.scratch_star(74) == 0, "75 分 2⭐、74 分 0⭐（未通關）")
ok(core.scratch_star(None) == 0 and core.scratch_star("abc") == 0, "讀不出分數 ⇒ 0⭐，不可以丟例外")

section("② 合併規則：和 grader.html 的 reportScratch 同一個語意")
a = core.merge_scratch_verified({}, "2-1-1A", 95, 1000)
ok(a["unitStars"] == {"2-1-1A": 3} and a["unitScores"] == {"2-1-1A": 95}, "第一次 95 分 ⇒ 3⭐、95 分")
ok(a["gains"] == [{"unit": "2-1-1A", "score": 95, "star": 3, "stars": 3, "at": 1000}],
   "★★★ 得星紀錄記「這次新增幾顆」——每週評分是把它加總的")
b = core.merge_scratch_verified(a, "2-1-1A", 80, 2000)
ok(b["unitStars"]["2-1-1A"] == 3 and b["unitScores"]["2-1-1A"] == 95,
   "★★★ 重測考差不可以把星星和分數洗低（取最佳）")
ok(b["gains"][-1]["stars"] == 0 and b["gains"][-1]["star"] == 2,
   "★★★ 重測沒進步 ⇒ 新增 0 顆（記成 2 顆的話每週分數會重複計算）")
c = core.merge_scratch_verified(b, "2-1-1B", 76, 3000)
ok(c["stars"] == 5 and c["done"] == 2, "總星數 3＋2＝5、通關 2 關")
d = core.merge_scratch_verified(c, "2-1-2", 50, 4000)
ok(d["done"] == 2 and d["unitStars"]["2-1-2"] == 0, "0⭐ 的關卡不算通關")
big = {"gains": [{"unit": "x", "stars": 0, "at": i} for i in range(core.SCRATCH_GAINS_CAP)]}
e = core.merge_scratch_verified(big, "2-1-1A", 95, 9)
ok(len(e["gains"]) == core.SCRATCH_GAINS_CAP and e["gains"][-1]["at"] == 9,
   "★★ 得星紀錄有上限，滿了丟最舊的（Firestore 文件有大小限制）")
ok(e["by"] == "backend", "★ 標明是後端寫的")

section("③ 編碼：巢狀物件和陣列要保住型別")
enc = core._fs_encode(c)
ok("mapValue" in enc and "arrayValue" in enc["mapValue"]["fields"]["gains"],
   "★★★ gains 要是真的陣列（_to_fs_fields 會把它變成字串，那是踩過的坑）")
ok(core._fs_decode(enc) == c, "★★ 編碼再解碼要一模一樣")

section("④ 寫入：只動 scratchVerified 一個欄位")
fs = use(FakeFS(doc={"studentId": {"stringValue": "1410101"},
                     "modules": {"mapValue": {"fields": {}}}}))
r = core.record_scratch_verified("1410101", "2-1-1A", 95, term="11501", now_ms=1000)
ok(r is not None and r["unitStars"] == {"2-1-1A": 3}, "寫進去了")
patch = [c for c in fs.calls if c[0] == "PATCH"]
ok(len(patch) == 1, "只寫一次")
url, body = patch[0][1], patch[0][2]
ok("/11501-progress/1410101" in url, "★★ 寫進**這個學期**的進度、這個學號的文件")
ok("updateMask.fieldPaths=scratchVerified" in url,
   "★★★ 一定要帶 updateMask —— 不帶的話 PATCH 會把學生文件的其他欄位全部清掉")
ok(list(body["fields"].keys()) == ["scratchVerified"], "★★★ 內文只有 scratchVerified 一個欄位")
ok("currentDocument.updateTime=T1" in url, "★★ 帶前提條件：別人先寫了就不可以蓋掉")
ok("studentId" in fs.doc and "modules" in fs.doc, "★★★ 學生文件原本的欄位都還在")

r2 = core.record_scratch_verified("1410101", "2-1-1A", 80, term="11501", now_ms=2000)
ok(r2["unitStars"]["2-1-1A"] == 3 and len(r2["gains"]) == 2,
   "★★ 第二次是**讀出上一次的**再合併，不是從頭算")

fs = use(FakeFS(doc=None))
r = core.record_scratch_verified("1410102", "2-1-1A", 90, term="11502", now_ms=1)
ok(r is not None and "currentDocument.exists=false" in fs.calls[-1][1],
   "★★ 文件還不存在 ⇒ 前提條件改成「必須不存在」")
ok("/11502-progress/1410102" in fs.calls[-1][1], "★★★ 11502 寫進 11502-progress（不可以寫死學期）")

section("⑤ 兩個分頁同時批改：前提條件失敗要重讀重算")
fs = use(FakeFS(doc={}, fail_patch_times=1))
r = core.record_scratch_verified("1410101", "2-1-1A", 95, term="11501", now_ms=1)
gets = [c for c in fs.calls if c[0] == "GET"]
ok(r is not None and len(gets) == 2, "★★★ 第一次被搶先 ⇒ 重讀一次再寫，不是放棄也不是硬蓋")
fs = use(FakeFS(doc={}, fail_patch_times=5))
r = core.record_scratch_verified("1410101", "2-1-1A", 95, term="11501", now_ms=1)
ok(r is None and len([c for c in fs.calls if c[0] == "PATCH"]) == 3,
   "★★ 最多試三次，不可以無限重試")

section("⑥ 不該寫的時候不可以寫，出錯不可以影響評分")
for sid, sc, why in (("未填學號", 95, "學號不是 7 位數字"), ("1410101", None, "沒有分數"),
                     ("", 95, "空學號"), ("141010", 95, "6 位數")):
    fs = use(FakeFS(doc={}))
    ok(core.record_scratch_verified(sid, "2-1-1A", sc, term="11501") is None and not fs.calls,
       "★★ %s ⇒ 一個請求都不發" % why)
fs = use(FakeFS(doc={}))
ok(core.record_scratch_verified("1410101", "", 95) is None and not fs.calls, "★ 沒有關卡代號不寫")
fs = use(FakeFS(doc={}, get_error=urllib.error.HTTPError("u", 500, "boom", None, None)))
try:
    r = core.record_scratch_verified("1410101", "2-1-1A", 95, term="11501")
    ok(r is None, "★★★ Firestore 出錯 ⇒ 回 None，不可以丟例外（評分照常回給學生）")
except Exception as e:                            # noqa: BLE001
    ok(False, "★★★ Firestore 出錯不可以丟例外：%r" % e)
core.FIREBASE["enabled"] = False
fs = use(FakeFS(doc={}))
core.FIREBASE["enabled"] = False
ok(core.record_scratch_verified("1410101", "2-1-1A", 95) is None and not fs.calls,
   "★ Firebase 關閉時不寫")
core.FIREBASE["enabled"] = True

section("⑦ 伺服器：批改完呼叫，而且在「隱藏分數」之前")
i_call = _SRC8.find("core.record_scratch_verified(student_id, unit, result.get(\"score\"), term=term)")
i_hide = _SRC8.find('result["score"] = None')
i_rec = _SRC8.find("core.record_submission(student_id, result,")
ok(i_call > 0, "★★★ /api/student/grade 要呼叫 record_scratch_verified")
ok(i_rec < i_call < i_hide,
   "★★★ 要在寫完批改紀錄之後、「隱藏分數」之前 —— 老師關掉顯示分數時 score 會變 None，全部變 0⭐")
seg = _SRC8[max(0, i_call - 200):i_call]
ok("try:" in seg, "★★ 呼叫要包在 try 裡：並行的第二份紀錄不可以影響評分")

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
