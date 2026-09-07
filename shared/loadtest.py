#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scratch AI 批改後端 —— 多人同時上線壓力測試
================================================================
⚠️⚠️ 這支**不可以**在正在服務的那一台 Colab 上跑。
   理由：壓測程式和 Flask 搶同一顆 CPU，量到的延遲會是被自己拖慢的，
   而且判讀不出來是「後端不行」還是「壓測程式太吵」。
   ⇒ 另開一個**空白 Colab**（或用 🧠 OCR 那一台空著的時候）貼上執行，
     這樣網路路徑才和學生一樣：客戶端 → ngrok 邊緣 → 通道 → Colab。

為什麼需要這一支（老師 2026-09-08）：
   「Scratch 是即時線上評測，多人連線目前還沒有壓力測試過。」
   ★ 算得出來的部分：同時 8 份進 Gemini（_GRADE_CONCURRENCY），
     一份約 86 秒 ⇒ 30 人 ≈ 4 批 ≈ 6 分鐘。這不需要測。
   ★ 算不出來、只能實際打的是**輪詢量**：
     30 個人等待時，光是 /api/student/queue 每 4 秒一次就是 450 次／分鐘。
     ngrok 免費方案的每分鐘連線上限官方沒有公布數值（錯誤頁只寫
     THRESHOLD），Gemini 免費層的 TPM 也改成「去 AI Studio 看自己的」。
     ⇒ 查不到就量。

用法（在 Colab 的程式碼儲存格）：
    !python loadtest.py --phase 1                    # 連線層，不花 AI 額度
    !python loadtest.py --phase 2 --yes              # 全鏈路，會花 10 次額度
    !python loadtest.py --phase 2 --dry-run          # 全鏈路，但不真的送出

⚠️ 階段二會**寫進 Firestore 的 progress 紀錄**（用測試學號）。
"""
import argparse, io, json, random, statistics, sys, threading, time, zipfile
from collections import Counter, defaultdict

try:
    import requests
except ImportError:                      # pragma: no cover
    sys.exit("請先 pip install requests（Colab 內建，本機才需要裝）")

DEFAULT_URL = "https://flanking-snort-cyclic.ngrok-free.dev"
SB3_URL = ("https://raw.githubusercontent.com/su-yung-sheng/course_115/main/"
           "11501/scratch/11501_01_%E7%AC%AC%E4%B8%80%E9%97%9C_%E8%A7%A3%E7%AD%94.sb3")
# ⚠️ 老師 2026-09-05 說明：1410100 ~ 1411200 是測試帳號。
#    ★ 這裡**寫死**成測試區間內的固定十個，不要用亂數 ——
#      亂數有機會撞到真實學號，而那會把學生的成績蓋掉。
TEST_IDS = ["141010%d" % i for i in range(1, 10)] + ["1410110"]

HDRS = {"ngrok-skip-browser-warning": "1",
        "User-Agent": "course115-loadtest/1.0"}


class Rec:
    """一次請求的結果。分開記 http 碼和連不上，兩者的意義完全不同。"""
    __slots__ = ("ep", "sec", "code", "err")

    def __init__(self, ep, sec, code=None, err=None):
        self.ep, self.sec, self.code, self.err = ep, sec, code, err


_recs, _lock = [], threading.Lock()


def _hit(sess, url, ep, timeout=20):
    t0 = time.time()
    try:
        r = sess.get(url, headers=HDRS, timeout=timeout)
        body = r.text[:400]
        # ⚠️ ngrok 擋掉的時候回的是**一頁 HTML**，HTTP 碼可能還是 200／502。
        #    只看狀態碼會把「被 ngrok 限流」記成「後端正常」。
        err = None
        if "ERR_NGROK_" in body:
            err = "NGROK:" + body.split("ERR_NGROK_")[1][:3]
        rec = Rec(ep, time.time() - t0, r.status_code, err)
    except requests.exceptions.Timeout:
        rec = Rec(ep, time.time() - t0, None, "TIMEOUT")
    except Exception as e:
        rec = Rec(ep, time.time() - t0, None, type(e).__name__)
    with _lock:
        _recs.append(rec)
    return rec


def _pct(vals, p):
    if not vals:
        return 0.0
    s = sorted(vals)
    k = min(len(s) - 1, int(round((p / 100.0) * (len(s) - 1))))
    return s[k]


def report(title, elapsed):
    print("\n" + "═" * 62)
    print("📊 %s（實際跑了 %.1f 秒）" % (title, elapsed))
    print("═" * 62)
    by_ep = defaultdict(list)
    with _lock:
        snap = list(_recs)
    for r in snap:
        by_ep[r.ep].append(r)
    for ep in sorted(by_ep):
        rs = by_ep[ep]
        good = [r for r in rs if r.code == 200 and not r.err]
        lat = [r.sec for r in good]
        print("\n── %s ──" % ep)
        print("   請求 %d 次（%.0f 次／分鐘）　成功 %d（%.1f%%）"
              % (len(rs), len(rs) / max(elapsed, 1) * 60, len(good),
                 100.0 * len(good) / max(len(rs), 1)))
        if lat:
            print("   延遲 中位數 %.0f ms／p90 %.0f ms／p99 %.0f ms／最慢 %.0f ms"
                  % (_pct(lat, 50) * 1000, _pct(lat, 90) * 1000,
                     _pct(lat, 99) * 1000, max(lat) * 1000))
        bad = Counter()
        for r in rs:
            if r.err:
                bad[r.err] += 1
            elif r.code != 200:
                bad["HTTP %s" % r.code] += 1
        if bad:
            print("   ⚠️ 失敗明細：" + "、".join("%s×%d" % kv for kv in bad.most_common()))
        else:
            print("   ✅ 全數成功")
    # ⚠️ 結論要講白話。只丟數字，老師還是不知道「這樣算不算過關」。
    allbad = [r for r in snap if r.err or (r.code and r.code != 200)]
    ngrok = [r for r in snap if r.err and r.err.startswith("NGROK")]
    print("\n" + "─" * 62)
    if ngrok:
        print("⛔ 有 %d 次被 ngrok 擋掉（%s）——"
              % (len(ngrok), Counter(r.err for r in ngrok).most_common(1)[0][0]))
        print("   這代表免費方案的每分鐘連線上限**真的會在上課時撞到**。")
        print("   最省事的解法是把學生端的輪詢間隔拉長（4 秒 → 10 秒），")
        print("   不必改後端，也不影響批改速度。")
    elif not allbad:
        print("✅ 這個量級下連線層沒有問題：沒有被限流，也沒有逾時。")
    else:
        print("⚠️ 有 %d 次失敗，但不是 ngrok 限流 —— 看上面的明細判斷。" % len(allbad))


# ══════════════════════════════════════════════════════════
# 階段一：連線層（完全不呼叫 Gemini）
# ══════════════════════════════════════════════════════════
def phase1(base, n, seconds, term, unit):
    print("🔌 階段一：模擬 %d 位學生同時等待，持續 %d 秒" % (n, seconds))
    print("   節奏照學生端實際的：queue 每 4 秒、config 每 20 秒")
    print("   ⚠️ 不會呼叫 Gemini，不花任何 AI 額度。\n")

    q_url = base + "/api/student/queue"
    c_url = base + "/api/student/config?unit=" + unit + "&term=" + term

    # ── 開場：30 個人**同一秒**打開頁面（每人一條全新連線，不共用）──
    print("① 突發測試：%d 條全新連線同時打進來…" % n)
    t0 = time.time()
    ths = []
    for _ in range(n):
        s = requests.Session()
        s.headers.update({"Connection": "close"})   # 不用 keep-alive＝真的各開一條
        t = threading.Thread(target=_hit, args=(s, q_url, "burst /queue"))
        t.daemon = True
        ths.append(t)
    for t in ths:
        t.start()
    for t in ths:
        t.join(30)
    print("   完成，%.1f 秒\n" % (time.time() - t0))

    # ── 持續：每人一條長連線，照真實節奏輪詢 ──
    print("② 持續測試：%d 條長連線輪詢 %d 秒…" % (n, seconds))
    stop = threading.Event()

    def student(i):
        sess = requests.Session()
        time.sleep(random.random() * 4)          # 錯開，不要整點齊發
        last_cfg = 0.0
        while not stop.is_set():
            _hit(sess, q_url, "sustain /queue")
            now = time.time()
            if now - last_cfg > 20:
                _hit(sess, c_url, "sustain /config")
                last_cfg = now
            # ⚠️ 抖動一定要留：真實的 30 台電腦不會分毫不差地同時發送，
            #    寫死 4.0 秒會製造出現實不存在的尖峰。
            stop.wait(4.0 + random.uniform(-0.5, 0.5))

    t0 = time.time()
    ths = []
    for i in range(n):
        t = threading.Thread(target=student, args=(i,))
        t.daemon = True
        t.start()
        ths.append(t)
    try:
        while time.time() - t0 < seconds:
            time.sleep(1)
    except KeyboardInterrupt:
        print("   （手動中斷）")
    stop.set()
    for t in ths:
        t.join(25)
    report("階段一：連線層", time.time() - t0)


# ══════════════════════════════════════════════════════════
# 階段二：全鏈路（會真的批改，會花額度）
# ══════════════════════════════════════════════════════════
def phase2(base, ids, term, unit, sb3_bytes, dry):
    print("🧪 階段二：%d 個測試學號同時送出 .sb3（%d KB）"
          % (len(ids), len(sb3_bytes) // 1024))
    print("   學號：" + "、".join(ids))
    if dry:
        print("   （--dry-run：只跑輪詢監看，不會真的送出）")
    print()

    results = {}
    curve = []
    stop = threading.Event()

    def monitor():
        sess = requests.Session()
        t0 = time.time()
        while not stop.is_set():
            try:
                q = sess.get(base + "/api/student/queue", headers=HDRS,
                             timeout=15).json()
                curve.append((round(time.time() - t0, 1),
                              q.get("pending"), q.get("avg_seconds")))
            except Exception:
                curve.append((round(time.time() - t0, 1), None, None))
            stop.wait(4)

    def submit(sid):
        t0 = time.time()
        try:
            if dry:
                time.sleep(0.1)
                results[sid] = ("DRY", 0.0, None)
                return
            r = requests.post(
                base + "/api/student/grade", headers=HDRS, timeout=300,
                files={"file": ("%s.sb3" % sid, io.BytesIO(sb3_bytes),
                                "application/octet-stream")},
                data={"student_id": sid, "unit": unit, "term": term})
            sec = time.time() - t0
            try:
                j = r.json()
            except Exception:
                j = {"raw": r.text[:200]}
            results[sid] = (r.status_code, sec, j)
        except Exception as e:
            results[sid] = ("ERR", time.time() - t0, str(e)[:200])

    mon = threading.Thread(target=monitor)
    mon.daemon = True
    mon.start()
    t0 = time.time()
    ths = [threading.Thread(target=submit, args=(s,)) for s in ids]
    for t in ths:
        t.daemon = True
        t.start()
    for t in ths:
        t.join(320)
    stop.set()
    mon.join(10)
    total = time.time() - t0

    print("\n" + "═" * 62)
    print("📊 階段二：全鏈路（總共 %.0f 秒）" % total)
    print("═" * 62)
    okn = 0
    for sid in ids:
        code, sec, j = results.get(sid, ("?", 0, None))
        score = (j or {}).get("score") if isinstance(j, dict) else None
        err = (j or {}).get("error") if isinstance(j, dict) else None
        if code == 200 and err is None:
            okn += 1
        print("   %s　%-4s　%6.1f 秒　分數 %-5s %s"
              % (sid, code, sec, score if score is not None else "－",
                 ("← " + str(err)) if err else ""))
    secs = [s for (_c, s, _j) in results.values() if s > 1]
    print("\n   成功 %d／%d" % (okn, len(ids)))
    if secs:
        print("   單人耗時 中位數 %.0f 秒／最慢 %.0f 秒" % (_pct(secs, 50), max(secs)))
    print("   排隊人數變化：" +
          "、".join("%ss=%s" % (t, p) for t, p, _a in curve[:20]) +
          ("…" if len(curve) > 20 else ""))
    peak = max([p for _t, p, _a in curve if p is not None] or [0])
    print("   最高同時在批改：%s 人" % peak)
    # ⚠️ 這一段是整個階段二的重點：號誌到底有沒有在擋。
    print("\n" + "─" * 62)
    if okn == len(ids):
        print("✅ %d 人同時送出全部成功。最慢一位 %.0f 秒 —— "
              "整班 30 人依同樣速度推估約 %.0f 分鐘。"
              % (len(ids), max(secs or [0]), (max(secs or [0]) * 30 / 8) / 60))
    else:
        print("⚠️ 有 %d 位沒有成功。先看上面的 error 文字：" % (len(ids) - okn))
        print("   · 429 且訊息提到「已經有一份在批改」＝ 學號守門，正常")
        print("   · 500 INTERNAL ＝ 模型端問題（見 ask_agent 的重試紀錄）")
        print("   · TIMEOUT／連不上 ＝ 連線層，回去跑階段一")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--phase", type=int, default=1, choices=(1, 2))
    ap.add_argument("--students", type=int, default=30, help="階段一模擬人數")
    ap.add_argument("--seconds", type=int, default=180, help="階段一持續秒數")
    ap.add_argument("--term", default="11501")
    ap.add_argument("--unit", default="")
    ap.add_argument("--sb3", default="", help="階段二用的 .sb3；留空就抓 GitHub 上的範例")
    ap.add_argument("--ids", default="", help="階段二的學號，逗號分隔")
    ap.add_argument("--yes", action="store_true", help="階段二確認：知道會花 AI 額度")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    base = a.url.rstrip("/")

    print("🎯 目標：" + base)
    try:
        h = requests.get(base + "/api/health", headers=HDRS, timeout=20).json()
    except Exception as e:
        sys.exit("❌ 連不上後端：%s\n   先確認那一台 Colab 還活著、ngrok 網域沒被搶走。" % e)
    # ⚠️ concurrency 不在 /api/health 裡，是在 /api/student/queue。
    #    寫錯地方的話這裡會一直印「?」，看起來像後端沒回報，
    #    然後就會有人跑去 health 加欄位 —— 白工。
    try:
        q = requests.get(base + "/api/student/queue", headers=HDRS,
                         timeout=20).json()
    except Exception:
        q = {}
    print("   後端版本 %s（core %s／server %s）"
          % (h.get("fingerprint"),
             (h.get("fingerprints") or {}).get("core"),
             (h.get("fingerprints") or {}).get("server")))
    print("   網域 %s｜同時批改上限 %s｜目前在批改 %s 人"
          % (h.get("domain"), q.get("concurrency", "?"), q.get("pending", "?")))
    # ★ 模型決定階段二的每一份要跑多久（Gemma 走純文字約 86 秒，
    #   Flash 快得多）。不印出來的話，兩次測試的數字沒辦法互相比較。
    print("   批改模型 %s%s｜%s"
          % (h.get("model_name"),
             "（⚠️ 是預設值，代表 Colab 重開後沒吃到教師端設定）"
             if h.get("model_is_default") else "",
             "有金鑰" if h.get("has_api_key") else "⛔ 沒有 Gemini 金鑰"))
    if h.get("keys_identical"):
        print("   ⚠️ 兩把金鑰字串一模一樣 —— 等於只有一把，輪替不會生效。")

    if a.phase == 1:
        phase1(base, a.students, a.seconds, a.term, a.unit)
        return

    ids = [s.strip() for s in a.ids.split(",") if s.strip()] or TEST_IDS
    if not (a.yes or a.dry_run):
        sys.exit("⚠️ 階段二會真的呼叫 Gemini（%d 次額度）並寫進 progress 紀錄。\n"
                 "   確定的話加上 --yes；想先空跑加上 --dry-run。" % len(ids))
    if a.sb3:
        sb3 = open(a.sb3, "rb").read()
    else:
        print("   下載範例 .sb3…")
        sb3 = requests.get(SB3_URL, timeout=60).content
    # ⚠️ 一定要驗這是不是真的 zip。抓錯網址會拿到一頁 HTML，
    #    然後十個學號全部得到「讀檔失敗」，看起來像後端壞掉。
    if not zipfile.is_zipfile(io.BytesIO(sb3)):
        sys.exit("❌ 拿到的不是 .sb3（不是 zip）——確認 --sb3 路徑或網路。")
    phase2(base, ids, a.term, a.unit, sb3, a.dry_run)


if __name__ == "__main__":
    main()
