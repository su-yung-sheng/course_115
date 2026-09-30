# -*- coding: utf-8 -*-
"""資訊倫理 闖關排行賽（後端）—— 真的跑一場、真的算分

跑法：python3 shared/tests/arena.test.py

★ 老師 2026-09-30 的規格：20 題、★1 起跳、答對升答錯降、全對 1000 分、
  每天重分難易度、全期取最高、同分用時短的在前、一天兩次、後端算分。
★ 這一份把 core 的 arena_* 真的執行起來（假的 Firestore），不是 grep。
"""
import io
import json
import os
import random
import glob
import shutil
import subprocess
import sys
import types as _pytypes
import urllib.error

for _s in (sys.stdout, sys.stderr):
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
_NB = json.load(io.open(NB, encoding="utf-8"))
_SRC6 = "".join(_NB["cells"][6]["source"])
_SRC8 = "".join(_NB["cells"][8]["source"])
core = _pytypes.ModuleType("core_under_test")
exec(compile("\n".join(_SRC6.split("\n")[1:]), "<cell6>", "exec"), core.__dict__)
RAW = json.load(io.open(os.path.join(ROOT, "11501", "content", "ethics.arena.json"), encoding="utf-8"))

section("① 題目 id 與答案雜湊：和前端（qstat.js／anskey.js）逐題一模一樣")
js = r"""
const fs=require('fs'),path=require('path');const R=process.env.COURSE_ROOT;
const w={};new Function('window',fs.readFileSync(path.join(R,'shared/qstat.js'),'utf8'))(w);
const A=require(path.join(R,'shared/anskey.js'));
const bank=JSON.parse(fs.readFileSync(path.join(R,process.env.ARENA_BANK),'utf8'));
const extra=['a　b c﻿ d','<b>粗體</b>？','𠮷野家（測試）','',' \t\n'];
const out=bank.items.map(i=>[i.q,w.QSTAT.id(i.q),i.options.map(o=>A.of(i.q,o))]).concat(extra.map(s=>[s,w.QSTAT.id(s),[A.of(s,s)]]));
process.stdout.write(JSON.stringify(out));
"""


def _find_node():
    """找 node —— 不要只靠 PATH（和 shared/check.py 的 _find_node 同一份清單）。
    ⛔ 2026-09-30 老師實際遇到：GitHub Desktop 提交時 hook 的 PATH 裡**沒有 node**，
       這一支直接寫 ["node", …] 就丟 FileNotFoundError，整個測試算失敗、提交被擋。"""
    p = shutil.which("node")
    if p:
        return p
    cands = [r"C:\Program Files\nodejs\node.exe", r"C:\Program Files (x86)\nodejs\node.exe",
             os.path.expanduser(r"~\AppData\Local\Programs\nodejs\node.exe"),
             os.path.expanduser(r"~\AppData\Local\Volta\bin\node.exe"),
             os.path.expanduser(r"~\scoop\apps\nodejs\current\node.exe"),
             "/usr/local/bin/node", "/opt/homebrew/bin/node", "/usr/bin/node"]
    cands += sorted(glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin/node")), reverse=True)
    return next((c for c in cands if os.path.isfile(c)), None)


NODE = _find_node()
if not NODE:
    # 缺套件不算失敗（和 check.py 一致），但要講明白：這一段沒測到
    print("  ⚠️ 找不到 node，略過這一段（沒測到，不是通過）")
else:
    # ⚠️ 腳本從 stdin 餵、根目錄走環境變數：不把中文與換行塞進命令列參數
    # ★ 兩學期的題庫都驗（11502 媒體與社會議題，2026-09-30 加）
    for _bank in ("11501/content/ethics.arena.json", "11502/content/social.arena.json"):
        _raw = json.load(io.open(os.path.join(ROOT, *_bank.split("/")), encoding="utf-8"))
        _r = subprocess.run([NODE, "-"], input=js, capture_output=True, text=True,
                            encoding="utf-8", errors="replace",
                            env=dict(os.environ, COURSE_ROOT=ROOT, ARENA_BANK=_bank))
        try:
            res = json.loads(_r.stdout)
        except ValueError:
            res = []
        ok(len(res) == _raw["count"] + 5, "%s：node 算得出前端那一份（%d 筆）%s"
           % (_bank, len(res), "" if res else "　←　" + (_r.stderr or "")[:200]))
        bad_id = [r[0][:20] for r in res if core.arena_qid(r[0]) != r[1]]
        ok(res and not bad_id, "★★★ %s：題目 id 全部對得上（%d 題＋5 個怪字串；對不上的：%s）"
           % (_bank, len(res), bad_id[:3]))
        bad_a = 0
        for i, r in enumerate(res):
            opts = _raw["items"][i]["options"] if i < len(_raw["items"]) else [r[0]]
            for o, h in zip(opts, r[2]):
                if core.arena_ans_of(r[0], o) != h:
                    bad_a += 1
        ok(res and bad_a == 0, "★★★ %s：答案雜湊全部對得上（對不上 %d 個）—— 對不上的話後端會把對的判成錯"
           % (_bank, bad_a))

BANK = core.arena_prepare_bank(RAW)
ok(len(BANK) == RAW["count"] == 141, "★★ 141 題都反查得到正確選項（%d）" % len(BANK))
RAW2 = json.load(io.open(os.path.join(ROOT, "11502", "content", "social.arena.json"), encoding="utf-8"))
ok(len(core.arena_prepare_bank(RAW2)) == RAW2["count"] == 185 and RAW2["term"] == "11502",
   "★★ 11502 媒體與社會議題：185 題都反查得到正確選項")
ok(core.ARENA_BANK_URLS.get("11502", "").endswith("/11502/content/social.arena.json"),
   "★★ 後端知道 11502 的題庫在哪裡")
ok(RAW2["units"] == ["5-1", "5-2", "5-3", "5-4", "5-5", "5-all", "6-1", "6-2", "6-3", "6-all"],
   "★★ 11502 的參賽資格也是 10 個章節")

section("② 每天的難易度分級")
qids = sorted(BANK)
stats = {k: {"n": 20, "ok": 20 - (i % 20)} for i, k in enumerate(qids[:100])}   # 前 100 題有資料
tiers = core.arena_tiers(qids, stats)
ok(set(tiers.values()) == {1, 2, 3, 4, 5}, "分成五級")
ok(all(tiers[k] == 3 for k in qids[100:]), "★★ 資料不足（少於 10 人次）的放 ★3")
easy = max(qids[:100], key=lambda k: stats[k]["ok"])
hard = min(qids[:100], key=lambda k: stats[k]["ok"])
ok(tiers[easy] == 1 and tiers[hard] == 5, "★★★ 答對率最高的是 ★1、最低的是 ★5")
cnt = [sum(1 for k in qids[:100] if tiers[k] == t) for t in range(1, 6)]
ok(max(cnt) - min(cnt) <= 1, "五級平均分（%s）" % cnt)
docs = {"a": {"fields": {"modules": {"ethics": {"qstat": {"q1": {"n": 3, "ok": 1}}}}}},
        "b": {"fields": {"modules": {"ethics": {"qstat": {"q1": {"n": 2, "ok": 2}}}}}},
        "c": {"fields": {}}}
ok(core.arena_stats_from_progress(docs) == {"q1": {"n": 5, "ok": 3}},
   "★★ 全班的 qstat 加總（和教師端題目分析頁同一份資料）")

section("③ 一場比賽：全對剛好 1000 分")
ok(sum(core.ARENA_POINTS[t] for t in [1, 2, 3, 4] + [5] * 16) == 1000,
   "★★★ 配分：15＋25＋35＋45＋55×16 ＝ 1000")
rnd = random.Random(7)
run, q = core.arena_new_run("1410101", BANK, tiers, rnd, 0.0)
ok(q["tier"] == 1 and q["index"] == 1 and q["points"] == 15, "★★ 第一題是 ★1、15 分")
ok(set(q) == {"index", "total", "tier", "points", "score", "q", "options"},
   "★★★ 給瀏覽器的只有題目與選項 —— 沒有答案、沒有雜湊")
seen, t = set(), 0.0
path = []
while True:
    cur = run["cur"]
    seen.add(cur["qid"])
    right = cur["options"].index(BANK[cur["qid"]]["right"])
    t += 5
    out = core.arena_answer(run, BANK, right, rnd, t)
    path.append(out["tier_from"])
    if out["done"]:
        break
ok(run["score"] == 1000 and run["correct"] == 20, "★★★ 20 題全對 ＝ 1000 分（實得 %d）" % run["score"])
ok(path[:5] == [1, 2, 3, 4, 5] and set(path[5:]) == {5}, "★★ 路線是 ★1→★5，之後都在 ★5")
ok(len(seen) == 20, "★★ 同一場 20 題不重複")
r = core.arena_result(run, t)
ok(r["seconds"] == 100.0 and r["max_tier"] == 5 and not r["robot"], "用時由後端量（100 秒）、最高 ★5")

section("④ 答錯降級、0 分；最低就是 ★1")
run, q = core.arena_new_run("1410101", BANK, tiers, random.Random(1), 0.0)
cur = run["cur"]
wrong = next(i for i, o in enumerate(cur["options"]) if o != BANK[cur["qid"]]["right"])
out = core.arena_answer(run, BANK, wrong, random.Random(1), 3.0)
ok(not out["right"] and out["points"] == 0 and out["tier_to"] == 1, "★★ ★1 答錯：0 分、還是 ★1")
cur = run["cur"]
out = core.arena_answer(run, BANK, cur["options"].index(BANK[cur["qid"]]["right"]), random.Random(1), 6.0)
ok(out["tier_to"] == 2 and out["points"] == 15, "答對：+15、升到 ★2")
cur = run["cur"]
wrong = next(i for i, o in enumerate(cur["options"]) if o != BANK[cur["qid"]]["right"])
out = core.arena_answer(run, BANK, wrong, random.Random(1), 9.0)
ok(out["tier_to"] == 1 and out["score"] == 15, "★★ ★2 答錯：降回 ★1、分數不變")
for bad in (-1, 4, "x", None):
    try:
        core.arena_answer(run, BANK, bad, random.Random(1), 10.0)
        ok(False, "亂送選項 %r 應該被擋" % (bad,))
    except ValueError:
        ok(True, "★ 亂送選項 %r ⇒ 擋下（不會當成答錯扣掉一題）" % (bad,))

section("⑤ 離開畫面換題：不扣分、不算作答、同一級")
run, q = core.arena_new_run("1410101", BANK, tiers, random.Random(3), 0.0)
old = run["cur"]["qid"]
nq = core.arena_swap(run, BANK, random.Random(4), 1.0)
ok(run["cur"]["qid"] != old and nq["index"] == 1 and run["score"] == 0 and run["swaps"] == 1,
   "★★★ 換成另一題，還是第 1 題、0 分、記一次換題")
ok(nq["tier"] == 1, "同一級（★1）")
ok(old in run["used"], "★ 換掉的那一題這一場不會再出現")

section("⑥ 腳本節奏不進排行")
ok(core.arena_is_robot([1, 0.5, 1, 1, 0.8]) and not core.arena_is_robot([1, 1, 1, 1, 12]),
   "★★ 每題都 1 秒內 ⇒ 腳本；有一題想了 12 秒 ⇒ 人（和可疑紀錄頁同一條規則）")
ok(not core.arena_is_robot([1, 1, 1]), "少於 5 題不判")

section("⑦ 排行：分數高 → 用時短 → 先達成；30 名外看得到自己")
rows = [{"sid": "14%05d" % i, "score": 1000 - i * 10, "seconds": 100, "at": "t"} for i in range(40)]
rows.append({"sid": "1499998", "score": 990, "seconds": 90, "at": "t"})    # 同 990 分、比較快
b = core.arena_ranking(rows, "1400039")
ok(len(b["top"]) == 30 and b["players"] == 41, "★★ 前 30 名")
ok(b["top"][1]["sid"] == "1499998" and b["top"][2]["sid"] == "1400001",
   "★★★ 同分（990）用時短的在前")
ok(b["me"]["rank"] == 41 and b["me"]["sid"] == "1400039", "★★★ 30 名外也拿得到自己的名次（第 41 名）")
ok(core.arena_ranking(rows, "1411111")["me"] is None, "沒玩過 ⇒ 沒有名次")
ok(core.arena_better({"score": 900, "seconds": 50}, {"score": 900, "seconds": 60})
   and not core.arena_better({"score": 890, "seconds": 10}, {"score": 900, "seconds": 60}),
   "★★ 取最高：同分快的算更好；分數低再快也不算")


class FakeFS(object):
    def __init__(self):
        self.docs = {}
        self.calls = []

    def __call__(self, method, url, body=None, _retry=True):
        self.calls.append((method, url))
        path = url.split("/documents/")[1].split("?")[0]
        if method == "GET":
            if path.count("/") == 0:                        # 整個集合
                docs = [{"name": "x/" + p, "fields": d["fields"]} for p, d in self.docs.items()
                        if p.startswith(path + "/")]
                return {"documents": docs}
            if path not in self.docs:
                raise urllib.error.HTTPError(url, 404, "nf", None, None)
            return {"fields": self.docs[path]["fields"], "updateTime": "U%d" % self.docs[path]["v"]}
        if method == "PATCH":
            d = self.docs.get(path)
            if "currentDocument.exists=false" in url and d:
                raise urllib.error.HTTPError(url, 400, "pre", None, None)
            if "currentDocument.updateTime=" in url:
                want = url.split("currentDocument.updateTime=")[1].split("&")[0]
                if not d or want != "U%d" % d["v"]:
                    raise urllib.error.HTTPError(url, 400, "pre", None, None)
            nd = {"fields": dict((d or {}).get("fields") or {}), "v": ((d or {}).get("v") or 0) + 1}
            nd["fields"].update(body["fields"])
            self.docs[path] = nd
            return {}
        raise AssertionError(method)


section("⑧ 一天兩次（開始就算一次）")
fs = FakeFS()
core._fs_http = fs
core.FIREBASE.update({"enabled": True, "project_id": "p", "api_key": "k"})
core.arena_day_key = lambda: "2026-10-01"
ok(core.arena_take_try("11501", "1410101") == 1, "第 1 次")
ok(core.arena_take_try("11501", "1410101") == 2, "第 2 次")
try:
    core.arena_take_try("11501", "1410101")
    ok(False, "第 3 次應該被擋")
except ValueError as e:
    ok("用完" in str(e), "★★★ 第 3 次擋下，講清楚「明天再來」")
core.arena_day_key = lambda: "2026-10-02"
ok(core.arena_take_try("11501", "1410101") == 1, "★★ 隔天重新計算")
f, _ = core.arena_board_doc("11501", "1410101")
ok(list((f.get("days") or {}).keys()) == ["2026-10-02"], "舊日期不累積")

section("⑨ 記成績：取最高、同分快的贏、腳本不進排行")
res = {"sid": "1410101", "score": 800, "correct": 17, "total": 20, "max_tier": 5, "swaps": 0,
       "seconds": 200.0, "robot": False, "steps": []}
ok(core.arena_record("11501", "r1", res)["best_updated"], "第一場 800 ⇒ 最佳")
ok(not core.arena_record("11501", "r2", dict(res, score=700))["best_updated"], "★★ 700 分不會蓋掉 800")
ok(core.arena_record("11501", "r3", dict(res, seconds=150.0))["best_updated"], "★★ 同 800 分、比較快 ⇒ 更新")
ok(not core.arena_record("11501", "r4", dict(res, score=1000, robot=True))["best_updated"],
   "★★★ 腳本節奏的 1000 分不進排行")
ok("11501-arena-runs/r4" in fs.docs, "★ 但那一場照樣留紀錄（老師查得到）")
f, _ = core.arena_board_doc("11501", "1410101")
ok(f["best"]["score"] == 800 and f["best"]["seconds"] == 150.0 and f["days"] == {"2026-10-02": 1},
   "★★ 最佳成績與今天的次數在同一份文件，互不蓋掉")
core.arena_record("11501", "r5", dict(res, sid="1410102", score=900))
b = core.arena_board("11501", "1410101")
ok([r["sid"] for r in b["top"]] == ["1410102", "1410101"] and b["me"]["rank"] == 2, "排行讀得出來")

section("⑨-2 參賽資格：資訊倫理 10 / 10 章節通關")
ok(RAW.get("units") == ["1-1", "1-2", "1-3", "1-4", "ch1-all", "3-1", "3-2", "3-3", "ch3-all", "review-all"],
   "★★ 題庫帶著 10 個章節 id（和章節選單「已通關 n / 10」同一份）")
need = RAW["units"]
full = {k: {"star": 3} for k in need}
ok(core.arena_passed(full, need) == 10, "10 章都有星 ⇒ 10")
ok(core.arena_passed(dict(full, **{"review-all": {"star": 0}}), need) == 9,
   "★★ 0 星不算通關（和章節選單同一個判斷）")
ok(core.arena_passed(dict(full, **{"old-id": {"star": 3}}, **{"1-1": None}), need) == 9,
   "★ 清單外的舊 id 不算、壞掉的資料不丟例外")
core._ARENA_BANK["11501"] = {"bank": BANK, "units": need, "at": 1e18}
fs = FakeFS()
core._fs_http = fs
e = core.arena_eligibility("11501", "1410101")
ok(e == {"passed": 0, "need": 10, "ok": False}, "★★ 沒有進度文件 ⇒ 0 / 10、沒資格")
fs.docs["11501-progress/1410101"] = {"fields": {"modules": core._fs_encode(
    {"ethics": {"units": dict({k: {"star": 2} for k in need[:9]})}})}, "v": 1}
ok(core.arena_eligibility("11501", "1410101")["passed"] == 9 and not core.arena_eligibility("11501", "1410101")["ok"],
   "★★★ 9 / 10 ⇒ 還不能挑戰")
fs.docs["11501-progress/1410101"]["fields"]["modules"] = core._fs_encode({"ethics": {"units": full}})
ok(core.arena_eligibility("11501", "1410101")["ok"], "★★★ 10 / 10 ⇒ 可以挑戰")
core._ARENA_BANK["11501"]["units"] = []
ok(core.arena_eligibility("11501", "1410102")["ok"], "★ 題庫沒帶章節清單（舊版 JSON）⇒ 不擋（寧可放行，不要整班卡住）")
core._ARENA_BANK["11501"]["units"] = need

section("⑩ 伺服器")
for route in ("/api/arena/today", "/api/arena/start", "/api/arena/answer",
              "/api/arena/swap", "/api/arena/board"):
    ok(('@app.route("%s"' % route) in _SRC8, "有 " + route)
i = _SRC8.find("def arena_start")
seg = _SRC8[i:i + 1800]
ok(seg.find("arena_take_try") > 0 and seg.find("arena_take_try") < seg.find("arena_new_run"),
   "★★★ 先用掉一次機會，才出題（開始就算一次）")
ok("/roster/" in seg, "★★ 查名冊（亂打的學號上不了排行）")
ok(0 < seg.find("arena_eligibility") < seg.find("arena_take_try"),
   "★★★ 先查參賽資格、才用掉一次機會 —— 沒資格的人按開始不可以被扣次數")
i2 = _SRC8.find("def arena_today")
ok('"eligible": elig["ok"]' in _SRC8[i2:i2 + 1400], "★★ 開始畫面拿得到「有沒有資格、目前幾 / 10」")
i = _SRC8.find("def arena_board")
seg = _SRC8[i:i + 900]
ok('"sid": r["sid"], "score": r["score"]' in seg and "name" not in seg.split("slim")[1][:200],
   "★★ 排行只給學號、分數、用時、名次")
ok("secrets" in _SRC8 and "token_urlsafe" in _SRC8, "★ 每一場的代號猜不到")
i = _SRC8.find("def arena_answer")
ok('run["bank"]' in _SRC8[i:i + 900] and "core.arena_bank(" not in _SRC8[i:i + 900],
   "★★ 作答用這一場開始時的題庫 —— 中途重抓題庫，進行中的題目可能找不到")

print("\n通過 %d／失敗 %d" % (_pass[0], _fail[0]))
sys.exit(1 if _fail[0] else 0)
