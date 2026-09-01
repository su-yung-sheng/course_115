/* 運算思維的「伺服器連線中」輪詢：多人上線時不可以把自己打掛
   跑法：node shared/tests/health-poll.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

console.log('── 運算思維：/health 輪詢 ──');

/* ⚠️⚠️ 2026-08-26 老師回報：「後端有執行，多人連線後會出現『伺服器連線中...』」。
   三個原因疊在一起：
     ① 每 5 秒輪詢一次 —— 一個班 30 人就是每分鐘 360 次打到 ngrok
     ② setIsOnline(res.ok) 一次失敗就判離線，上傳按鈕跟著鎖死
        （disabled={!isOnline...}），但後端其實還活著
     ③ 沒有逾時，慢的請求會一直堆積
   ★ 而且「還在連」和「連不上」顯示同一句話，老師分不出是哪一種。 */
for (const term of ['11501', '11502']) {
  section('★ ' + term + '/thinking.html');
  const SRC = fs.readFileSync(path.join(ROOT, term, 'thinking.html'), 'utf8');
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');

  /* ⚠️ 這一條原本抓 setInterval(checkHealth, N) —— 釘的是**實作細節**。
     後來為了做退避改成 setTimeout 遞迴，這條就失效了（找不到就當沒事）。
     ⇒ 改抓 BASE_MS 這個「基礎間隔」，那才是真正要守住的行為。 */
  const iv = (CODE.match(/BASE_MS\s*=\s*(\d+)/)
              || CODE.match(/setInterval\(checkHealth,\s*(\d+)\)/) || [])[1];
  ok(!!iv && Number(iv) >= 20000,
     '★★ 基礎輪詢間隔至少 20 秒（目前 ' + (iv ? iv / 1000 + ' 秒' : '找不到') +
     '；30 人 × 每分鐘 ' + (iv ? Math.floor(30 * 60000 / iv) : '?') + ' 次）');

  ok(/MISS_LIMIT/.test(CODE) && !/setIsOnline\(res\.ok\)/.test(CODE),
     '★★ 要連續失敗數次才判離線，不可以一次失敗就鎖住上傳按鈕');

  ok(/AbortController/.test(CODE) && /ctl\.abort\(\)/.test(CODE),
     '★ 請求要有逾時（否則慢的請求會堆積）');

  ok(/document\.hidden/.test(CODE),
     '★ 分頁在背景時不輪詢（不要浪費 ngrok 配額）');

  ok(/netNote/.test(CODE) && /OFFLINE_NOTE/.test(CODE),
     '★★ 「還在連」和「連不上」要顯示不同的話');

  /* ⚠️ 清理要確實：元件重繪時舊的輪詢沒停掉會愈積愈多。 */
  ok(/alive\s*=\s*false/.test(CODE)
     && /clear(Interval|Timeout)\(interval\)/.test(CODE),
     '★ 卸載時要停掉輪詢並標記失效');
}

/* ═══════════════════════════════════════════════════════
   後端當掉時，前端要自己安靜下來
   -------------------------------------------------------
   ⚠️⚠️ 老師 2026-08-26：「有一次後端當機，無法重啟，
      前端還一直送要求進來。」
      判定離線之後仍然固定每 25 秒敲一次，30 台瀏覽器一起敲，
      網域一恢復就被打爆 —— 反而更難把後端救回來。
   ═══════════════════════════════════════════════════════ */
for (const term of ['11501', '11502']) {
  section('★★ ' + term + '：後端掛掉後要退避');
  const SRC = fs.readFileSync(path.join(ROOT, term, 'thinking.html'), 'utf8');
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');

  ok(/nextDelay/.test(CODE) && /Math\.pow\(2/.test(CODE),
     '★★ 連續失敗要指數退避，不可以固定頻率一直敲');
  ok(/MAX_MS\s*=\s*(\d+)/.test(CODE) && Number(CODE.match(/MAX_MS\s*=\s*(\d+)/)[1]) >= 120000,
     '★ 退避上限至少兩分鐘（給老師空間重啟後端）');
  ok(/setTimeout\(loop/.test(CODE) && !/setInterval\(checkHealth/.test(CODE),
     '★ 改用 setTimeout 遞迴（setInterval 的間隔改不動）');
  ok(/__retryHealth/.test(CODE),
     '★★ 要有「立刻再試」的出口，不然後端救回來還要等最長 5 分鐘');

  /* ⚠️ 辨識期間的排隊輪詢才是最大的流量來源：
     30 人同時等、每 3 秒一次 = 每分鐘 600 次，
     而且正好發生在後端最忙的時候。 */
  const qi = SRC.slice(SRC.indexOf('/queue'), SRC.indexOf('/queue') + 3000);
  const ms = [...qi.matchAll(/\}, (\d+)\);|setInterval\(pollQueue, (\d+)\)/g)]
             .map(m => Number(m[1] || m[2]));
  ok(ms.length > 0 && Math.min(...ms) >= 8000,
     '★★ 排隊輪詢至少 8 秒（目前最小 ' + (ms.length ? Math.min(...ms) / 1000 + ' 秒' : '找不到') + '）');

  /* ⚠️ 上傳沒有逾時的話，後端當掉時學生會停在永遠轉不完的圈圈上。 */
  ok(/upCtl/.test(CODE) && /upCtl\.abort\(\)/.test(CODE),
     '★★ /analyze 的上傳要有逾時');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
