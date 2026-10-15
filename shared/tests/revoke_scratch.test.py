# -*- coding: utf-8 -*-
"""取消程式成績：批改紀錄、檔案雜湊、星星三個地方都要處理

跑法：python3 shared/tests/revoke_scratch.test.py

⛔⛔ 為什麼有這一份（老師 2026-10-15）
   1410108、1410110 的第 4 關（2-1-3）交了同一個 .sb3（雜湊 9e4c0affb94c…）。
   老師確認後要取消 1410110 那一關的成績，而原本沒有工具做得到。
   查資料流時發現三個「只做一半就會自己回來」的坑：
     ① 只改星星、沒標記批改紀錄 ⇒ 老師按一次「重建」就全部算回來
     ② 沒在檔案雜湊上記一筆 ⇒ 同一個檔案再交一次，命中批改快取，0 秒拿回 100 分
     ③ 星星整份重寫 ⇒ 會把其他關卡（甚至開學前的合法星星）一起洗掉
★★ 這一份用假的 Firestore **真的把 revoke_scratch_unit 跑起來**。
"""
import io
import json
import os
import sys
import types as _pytypes
import urllib.parse

# ⚠️ Windows 繁中主控台是 cp950，印 ✅ 會讓整支 crash（見 revoke_pass.test.py 的說明）
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

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
    t.Type = type("T", (), {"OBJECT": "O", "STRING": "S", "INTEGER": "I",
                            "NUMBER": "N", "ARRAY": "A", "BOOLEAN": "B"})
    g = _pytypes.ModuleType("google")
    g.genai = genai
    sys.modules["google"], sys.modules["google.genai"] = g, genai
    sys.modules["google.genai.types"] = t


_install_fake_genai()
_nb = json.load(io.open(NB, encoding="utf-8"))
src = "".join(_nb["cells"][6]["source"])
core = _pytypes.ModuleType("core_under_test")
exec(compile("\n".join(src.split("\n")[1:]), "<cell6>", "exec"), core.__dict__)
SRV = "".join(_nb["cells"][8]["source"])


# ══════════════════════════════════════════════════════════
# 假的 Firestore：清單分頁、updateMask（含巢狀與刪除）都照真的行為
# ══════════════════════════════════════════════════════════
def _split_path(p):
    out, cur, q = [], "", False
    for ch in p:
        if ch == "`":
            q = not q
        elif ch == "." and not q:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


class FakeFS(object):
    def __init__(self, page=2):
        self.docs = {}          # "集合/文件ID" -> fields
        self.calls = []
        self.page = page        # 故意很小：逼程式一定要跟著分頁讀

    def http(self, method, url, body=None, _retry=True):
        import urllib.error
        path, _, qs = url.partition("?")
        path = path.replace("BASE/", "")
        q = urllib.parse.parse_qs(qs)
        self.calls.append((method, path, q, body))
        if method == "GET":
            if path in self.docs:
                return {"name": path, "fields": self.docs[path]}
            kids = sorted(k for k in self.docs if k.rsplit("/", 1)[0] == path)
            if not kids:
                raise urllib.error.HTTPError(url, 404, "nf", None, None)
            start = int((q.get("pageToken") or ["0"])[0])
            chunk = kids[start:start + self.page]
            resp = {"documents": [{"name": "projects/x/databases/(default)/documents/" + k,
                                   "fields": self.docs[k]} for k in chunk]}
            if start + self.page < len(kids):
                resp["nextPageToken"] = str(start + self.page)
            return resp
        if method == "PATCH":
            cur = self.docs.setdefault(path, {})
            mask = q.get("updateMask.fieldPaths")
            fields = (body or {}).get("fields", {})
            if not mask:
                cur.update(fields)
                return {"fields": cur}
            for m in mask:
                segs = _split_path(m)
                src_v = {"mapValue": {"fields": fields}}
                for s in segs:
                    src_v = ((src_v or {}).get("mapValue") or {}).get("fields", {}).get(s)
                    if src_v is None:
                        break
                dst = cur
                for s in segs[:-1]:
                    node = dst.setdefault(s, {"mapValue": {"fields": {}}})
                    dst = node.setdefault("mapValue", {}).setdefault("fields", {})
                if src_v is None:
                    dst.pop(segs[-1], None)
                else:
                    dst[segs[-1]] = src_v
            return {"fields": cur}
        if method == "POST":
            self.docs[path + "/auto%03d" % len(self.calls)] = (body or {}).get("fields", {})
            return {}
        raise Exception("沒處理的 method " + method)


SUB = "11501-scratch-submissions"
HASH = "11501-work-hashes"
PROG = "11501-progress"


def setup():
    fs = FakeFS()
    core.FIREBASE = {"enabled": True, "api_key": "K"}
    core._fs_docs_base = lambda: "BASE"
    core._fs_http = fs.http

    def sub(i, sid, unit, score, at):
        fs.docs["%s/s%02d" % (SUB, i)] = core._to_fs_fields({
            "student_id": sid, "unit": unit, "score": score, "created_at": at, "theme": ""})
    sub(1, "1410110", "2-1-1A", 100, "2026-09-23 08:50:13")
    sub(2, "1410110", "2-1-1B", 100, "2026-09-30 08:50:44")
    sub(3, "1410110", "2-1-2", 100, "2026-10-07 08:47:17")
    sub(4, "1410110", "2-1-3", 100, "2026-10-07 08:56:18")
    sub(5, "1410108", "2-1-3", 100, "2026-10-07 08:57:17")
    sub(6, "1410110", "2-1-3", 100, "2026-10-07 08:58:00")    # 同一份又交一次（快取那一筆）
    # 雜湊：2-1-3 那個檔案兩個人都交過；另一個檔案是他自己的 2-1-2
    fs.docs[HASH + "/9e4c0affb94cAAAA"] = core._to_fs_fields({"owners_json": json.dumps([
        {"sid": "1410110", "cid": "2-1-3", "at": "x"}, {"sid": "1410108", "cid": "2-1-3", "at": "y"}])})
    fs.docs[HASH + "/1111222233334444"] = core._to_fs_fields({"owners_json": json.dumps([
        {"sid": "1410110", "cid": "2-1-2", "at": "x"}])})
    # 進度：前端 4 關都 3⭐，另外有一關 2-1-4 是「前端有、批改紀錄沒有」（不可以被順手洗掉）
    built = core.build_scratch_verified_from_submissions(
        [core._from_fs_fields(fs.docs[k]) for k in sorted(fs.docs) if k.startswith(SUB)
         and core._from_fs_fields(fs.docs[k])["student_id"] == "1410110"], now_ms=1)["1410110"]
    fs.docs[PROG + "/1410110"] = {
        "scratchVerified": core._fs_encode(built),
        "modules": core._fs_encode({"scratch": {
            "unitStars": {"2-1-1A": 3, "2-1-1B": 3, "2-1-2": 3, "2-1-3": 3, "2-1-4": 3},
            "unitScores": {"2-1-1A": 100, "2-1-1B": 100, "2-1-2": 100, "2-1-3": 100, "2-1-4": 95},
            "unitFiles": {"2-1-2": "https://drive/x"},
            "stars": 15, "level": 5}, "ethics": {"stars": 7}}),
        "studentId": {"stringValue": "1410110"},
    }
    return fs


def dec(fs, path):
    return {k: core._fs_decode(v) for k, v in fs.docs[path].items()}


section("① 三個地方都處理到")
fs = setup()
res = core.revoke_scratch_unit("1410110", "2-1-3", term="11501",
                               reason="與 1410108 的檔案完全相同", now_ms=999)
ok(res.get("ok") is True, "★★ 整體回報成功　←　%r" % res)
s4 = core._from_fs_fields(fs.docs[SUB + "/s04"])
s6 = core._from_fs_fields(fs.docs[SUB + "/s06"])
ok(s4.get("revoked") is True and s6.get("revoked") is True,
   "★★★ 他這一關的**每一筆**批改紀錄都標成 revoked（含快取那一筆）")
ok(s4.get("score") == 100 and s4.get("revoked_reason") == "與 1410108 的檔案完全相同",
   "★★ 標記不是刪除：原本的分數還在，原因也寫進去了（稽核查得到）")
ok(not core._from_fs_fields(fs.docs[SUB + "/s05"]).get("revoked"),
   "★★★ 另一位同學（1410108）同一關的紀錄**不動**")
ok(not core._from_fs_fields(fs.docs[SUB + "/s03"]).get("revoked"),
   "★★ 他自己其他關卡的紀錄不動")
ok("已取消 2 筆" in res["submissions"], "回報寫出取消了幾筆　←　" + res["submissions"])

h = core._from_fs_fields(fs.docs[HASH + "/9e4c0affb94cAAAA"])
revs = json.loads(h.get("revoked_json") or "[]")
ok(len(revs) == 1 and revs[0]["sid"] == "1410110" and revs[0]["cid"] == "2-1-3",
   "★★★ 那個檔案的雜湊上記下「1410110 的 2-1-3 取消了」")
ok(len(json.loads(h["owners_json"])) == 2, "　擁有者清單照舊（稽核頁還看得到兩個人）")
ok("revoked_json" not in fs.docs[HASH + "/1111222233334444"], "★ 他其他關卡的檔案不受影響")

p = dec(fs, PROG + "/1410110")
m = p["modules"]["scratch"]
ok("2-1-3" not in m["unitStars"] and "2-1-3" not in m["unitScores"],
   "★★★ 學生頁面上這一關的星星和分數拿掉了　←　%r" % m["unitStars"])
ok(m["unitStars"].get("2-1-4") == 3 and m["unitStars"].get("2-1-1A") == 3,
   "★★★ 其他關卡一格都不動（連批改紀錄找不到的 2-1-4 也不可以被順手洗掉）")
ok(m["stars"] == 12 and m["level"] == 4, "總星數 15 → 12、通關 5 → 4 關　←　%r/%r" % (m["stars"], m["level"]))
ok(m.get("unitFiles") == {"2-1-2": "https://drive/x"}, "★ 作品備份連結不動")
ok(p["modules"].get("ethics") == {"stars": 7}, "★★ 別的模組（資訊倫理）不動")
v = p["scratchVerified"]
ok("2-1-3" not in v["unitStars"] and v["stars"] == 9 and v.get("rebuiltAt") == 999,
   "★★ 後端星星用剩下的紀錄重算（9 顆），並標上 rebuiltAt　←　%r" % v.get("unitStars"))
ok(all(g["unit"] != "2-1-3" for g in v["gains"]), "★ 每週評分用的得星紀錄裡也沒有這一關了")
ok(res["before"] == {"star": 3, "score": 100} and res["after"]["star"] == 0,
   "回報寫出前後的星數　←　%r → %r" % (res["before"], res["after"]))
aud = [k for k in fs.docs if k.startswith("11501-scratch-revoked/")]
ok(len(aud) == 1 and core._from_fs_fields(fs.docs[aud[0]])["reason"] == "與 1410108 的檔案完全相同",
   "★★ 稽核紀錄寫進 {學期}-scratch-revoked")

section("② 之後按「重建」也不會算回來")
allsubs = [core._from_fs_fields(fs.docs[k]) for k in sorted(fs.docs) if k.startswith(SUB + "/")]
rb = core.build_scratch_verified_from_submissions(allsubs)
ok("2-1-3" not in rb["1410110"]["unitStars"],
   "★★★ 重建時跳過 revoked ⇒ 取消的星星不會被重建加回來")
ok(rb["1410108"]["unitStars"].get("2-1-3") == 3, "　另一位同學照算")

section("③ 同一個檔案再交 ⇒ 擋下；自己重做的新檔案 ⇒ 照常")
import hashlib
raw = b"the-same-sb3"
hh = hashlib.sha256(raw).hexdigest()
fs.docs[HASH + "/" + hh] = core._to_fs_fields({
    "owners_json": json.dumps([{"sid": "1410110", "cid": "2-1-3"}]),
    "revoked_json": json.dumps([{"sid": "1410110", "cid": "2-1-3", "reason": "r"}])})
ok(core.work_revoked("1410110", "2-1-3", raw, "11501") is not None, "★★★ 被取消的同一個檔案 ⇒ 擋")
ok(core.work_revoked("1410108", "2-1-3", raw, "11501") is None, "★★★ 同一個檔案在**別人**名下 ⇒ 不擋")
ok(core.work_revoked("1410110", "2-1-4", raw, "11501") is None, "★ 交到別的關卡 ⇒ 不擋（照常評分）")
ok(core.work_revoked("1410110", "2-1-3", b"rewritten-by-himself", "11501") is None,
   "★★★ 自己重做的新檔案 ⇒ 不擋（不可以把他永遠卡在這一關）")
core._fs_http = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("Firestore 掛了"))
ok(core.work_revoked("1410110", "2-1-3", raw, "11501") is None,
   "★★ 讀不到 Firestore ⇒ 放行（不可以變成全班交不出作業）")
core._fs_http = fs.http

section("④ 再取消一次是安全的；資料不對要講出來")
res2 = core.revoke_scratch_unit("1410110", "2-1-3", term="11501", reason="再按一次", now_ms=1000)
ok(res2.get("ok") is True and "已取消 0 筆" in res2["submissions"] and "之前就取消了" in res2["submissions"],
   "再按一次不會重複標記　←　" + res2["submissions"])
ok(len(json.loads(core._from_fs_fields(fs.docs[HASH + "/9e4c0affb94cAAAA"])["revoked_json"])) == 1,
   "　雜湊上的取消紀錄不重複疊")
ok(core.revoke_scratch_unit("141011", "2-1-3", reason="x")["ok"] is False, "學號不是 7 位數 ⇒ 不做")

fs = setup()
_real = fs.http


def _sub_patch_fails(method, url, body=None, _retry=True):
    if method == "PATCH" and SUB in url:
        raise RuntimeError("寫不進批改紀錄")
    return _real(method, url, body, _retry)


core._fs_http = _sub_patch_fails
res3 = core.revoke_scratch_unit("1410110", "2-1-3", term="11501", reason="測試", now_ms=5)
ok(res3["ok"] is False and "失敗" in res3["submissions"], "★★ 批改紀錄寫不進去 ⇒ 回報失敗，不可以假裝成功")
ok(dec(fs, PROG + "/1410110")["modules"]["scratch"]["unitStars"].get("2-1-3") == 3,
   "★★★ 而且**不動星星**：紀錄沒標記就改星星，下一次重建又會算回來")
core._fs_http = fs.http

section("⑤ 端點與批改流程")
ok('@app.route("/api/teacher/revoke-scratch", methods=["POST"])' in SRV, "★ 端點只收 POST")
_ep = SRV[SRV.index("def teacher_revoke_scratch"):]
_ep = _ep[:_ep.index("@app.route")]
ok("len(reason) < 2" in _ep, "★★ 沒寫原因就拒絕")
_g = SRV[SRV.index("def student_grade"):]
ok(_g.index("core.work_revoked(") < _g.index("core.grade_project_file("),
   "★★★ 被取消的檔案在**評分之前**就擋（走到快取就會 0 秒拿回分數）")
_blk = _g[_g.index("core.work_revoked("):_g.index("core.grade_project_file(")]
ok("if _rv:" in _blk and "}), 403" in _blk.split("if _rv:")[1],
   "★★★ 查到被取消 ⇒ 直接回 403、不往下評分")
ok("reason" not in _blk.split("return jsonify")[1].split("}), 403")[0],
   "★★ 回給學生的訊息**不帶**取消原因（裡面可能有別的同學的學號）")

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
