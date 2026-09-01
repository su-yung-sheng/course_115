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

/* ═══════════════════════════════════════════════════════
   排隊位置與「一人一次」
   -------------------------------------------------------
   ⚠️⚠️ 老師 2026-08-26 兩個問題：
     ①「同一個人開兩個上傳，排隊也可以？」→ 以前可以，完全沒擋。
        /analyze 收到的資料裡**沒有學號**，後端根本不知道是誰。
     ②「有顯示排隊人數，但為什麼會變多？有人插隊？」→ 沒有人插隊，
        是拿 pending（此刻同時在場人數）當「你前面還有幾個」用。
        後面進來的人也被算進去，先送出的反而看到數字變大。
   ═══════════════════════════════════════════════════════ */
for (const term of ['11501', '11502']) {
  section('★★ ' + term + '：排隊位置要用號碼牌');
  const SRC = fs.readFileSync(path.join(ROOT, term, 'thinking.html'), 'utf8');
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');

  ok(/formData\.append\("student_id"/.test(CODE),
     '★★ 上傳要帶學號（後端才擋得掉同一人開兩個分頁）');
  ok(/myTicket/.test(CODE) && /q\.served/.test(CODE),
     '★★ 用「我的號碼 − 已完成」算位置，不是用 pending');
  ok(/shownAhead/.test(CODE) && /Math\.min\(shownAhead/.test(CODE),
     '★★ 顯示的數字只准變小（變大就是又一次「被插隊」的錯覺）');
  ok(/j\.message/.test(CODE),
     '★ 429 的原因要透出來，不可以被「伺服器拒絕連線」蓋掉');
  /* ⚠️ 後端如果還是舊版（沒有 served），要能退回舊的顯示方式，
     不可以整個壞掉 —— Colab 那本不一定跟前端同時更新。 */
  ok(/q\.pending/.test(CODE),
     '★ 舊後端沒有 served 時要有退路');
}

section('★★ 後端：一人一次 ＋ 已完成數');
{
  const NBSRC = fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8');
  const NBCODE = JSON.parse(NBSRC).cells
    .map(c => (c.source || []).join(''))
    .join('\n')
    .split('\n').filter(l => !l.trim().startsWith('#')).join('\n');

  ok(/"served"/.test(NBCODE), '★ 佇列狀態要有 served（已完成數）');
  ok(/_ocr_qstate\["served"\] \+= 1/.test(NBCODE), '★ 每完成一張要 +1');
  ok(/_ocr_busy_sids/.test(NBCODE), '★★ 有「同一學號同時只能一張」的名單');
  /* ⚠️ 這一條原本只檢查「有 _OCR_BUSY_TTL 這個名字」——太寬：
     把它改名成 _OCR_BUSY_TTL_X（等於停用）測試照樣綠，
     突變測試才發現。⇒ 要檢查**清理迴圈真的在用它**。 */
  ok(/>\s*_OCR_BUSY_TTL\b/.test(NBCODE) && /_ocr_busy_sids\.pop\(_k/.test(NBCODE),
     '★★ 名單要有逾時自動釋放且真的在清 —— '
     + '否則一次異常就讓那個學生整堂課傳不了');
  ok(/429/.test(NBCODE), '★ 重複上傳要回 429，讓前端分得出來');
  /* ⚠️ 429 提早 return 時**不可以**走到 finally 的清理，
     不然會把別人（其實是自己第一張）的鎖解掉、pending 也算錯。 */
  const an = NBCODE.slice(NBCODE.indexOf('def ocr_analyze'));
  const i429 = an.indexOf('429'), iTry = an.indexOf('\n    try:');
  ok(i429 > 0 && iTry > 0 && i429 < iTry,
     '★★ 擋下重複上傳的 return 要在 try 之前（否則會誤觸 finally 的清理）');
}

section('★ 後端：要分得出「排隊久」和「每張變慢」');
{
  /* ⚠️ 老師 2026-08-26：「全班同時排隊時，為什麼平均下來的時間
     會比單人測試多很多？」
     ★ OCR 執行緒只做 predict()，解碼／縮放／字串比對全在各自的
       HTTP 執行緒 —— 30 個一起搶 2 個 vCPU。
     ⚠️ 但「是排隊久還是每張變慢」不能用猜的，要量得出來。 */
  const NBCODE = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'))
    .cells.map(c => (c.source || []).join('')).join('\n')
    .split('\n').filter(l => !l.trim().startsWith('#')).join('\n');

  ok(/queue_wait_seconds/.test(NBCODE),
     '★★ timing 要分開記「排隊等待」，否則分不出瓶頸在哪');
  ok(/def ocr_run\(img, timeout=180, stats=None\)/.test(NBCODE),
     '★ ocr_run 要能把等待時間回報給呼叫端');
  ok(/box\["waited"\]/.test(NBCODE), '★ OCR 執行緒要記下這張等了多久');
  ok(/_ocr_cpu_sem/.test(NBCODE) && /with _ocr_cpu_sem:/.test(NBCODE),
     '★ 解碼與縮放要有並發閘門');
  ok(/cpu_count/.test(NBCODE),
     '★ 閘門跟著核心數走，不要寫死（不同機器核心數不同）');
  /* ⚠️ 閘門不可以包住等待 OCR 的時間 —— 那會讓佇列前面的人
     擋住後面的人做前處理，比不加閘門更慢。 */
  /* ⚠️ 這一條原本用 /with _ocr_cpu_sem:[^]{0,200}?ocr_run/ ——
     那個正規式會**跨越 with 區塊**，分不出「在裡面」和「在後面」，
     程式明明是對的卻judge成錯。⇒ 改用縮排判斷，那才是 Python 的語意。 */
  const lines = NBCODE.split('\n');
  const si = lines.findIndex(l => l.includes('def _ocr_scaled'));
  let verdict = false;
  if (si >= 0) {
    const body = lines.slice(si + 1, si + 12);
    const wi = body.findIndex(l => l.includes('with _ocr_cpu_sem:'));
    const ri = body.findIndex(l => l.includes('ocr_run('));
    const ind = l => l.length - l.trimStart().length;
    // ocr_run 的縮排必須「不深於」with 那一行 → 代表它在 with 之外
    verdict = wi >= 0 && ri >= 0 && ind(body[ri]) <= ind(body[wi]);
  }
  ok(verdict, '★★ 閘門只包 CPU 動作，不可以包住等待 OCR 的時間');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
