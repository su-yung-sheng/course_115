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
     而且正好發生在後端最忙的時候。
     ⚠️⚠️ 2026-09-03 改成雲端路徑之後，這一頁只剩**一支**背景輪詢
        （/api/queue-list，兼做連線指示燈）；等結果那一段的節奏
        住在 shared/ocrclient.js（POLL_START_MS/POLL_MAX_MS，
        由 ocrclient.test.js 顧）。
     ⇒ 這裡守的是「背景那一支不可以打得太密」。 */
  ok(/\/api\/queue-list/.test(CODE),
     '★★ 排隊清單要問後端的記憶體快取（不可以讓 30 個人直接輪詢 GAS）');
  ok(!/fetch\(API_BASE \+ "\/health"/.test(CODE),
     '★ 不要再另外打一支 /health —— 排隊清單回得來就代表後端活著');

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

  /* ══════════════════════════════════════════════════════
     2026-09-03：上傳改打 GAS，關卡改由檔名判定
     ══════════════════════════════════════════════════════
     ⚠️⚠️ 老師：「圖片都上傳到雲端了，為什麼還會滿載讓使用者無法上傳？」
        —— 因為上傳這個動作原本**還是打在 Colab 上**。Colab 一忙，
        /health 回得慢 → 判離線 → 按鈕鎖住 → 學生連傳都傳不出去。
        那次「全班變成等待連線中」就是這樣來的。
     ★ 下面這幾條全都在守同一件事：**交作業不可以依賴 Colab**。
     ⚠️ 這幾條對兩個學期都跑 —— 這個 repo 已經在
        autoSizeGraderFrame、setResult(null) 上各吃過一次「只改一邊」的虧。 */
  ok(/<script src="\.\.\/shared\/ocrclient\.js">/.test(SRC),
     '★★ 要真的有 <script> 載入共用的 ocrclient.js');
  /* ⚠️ 不可以只檢查字串有沒有出現 —— 註解裡也寫著這些名字，
     把整段刪掉測試照樣綠（2026-09-02 突變時抓到）。⇒ 釘呼叫式本身。 */
  ok(/window\.submitViaCloud\(/.test(CODE),
     '★★ 上傳要走 submitViaCloud（打 GAS，不碰 Colab）');
  ok(/window\.waitViaCloud\(/.test(CODE),
     '★★ 等結果要走 waitViaCloud（靠「從排隊清單消失」判斷）');
  ok(!/fetch\(API_BASE \+ "\/analyze"/.test(CODE)
     && !/analyze-async/.test(CODE),
     '★★ 上傳不可以再打到 Colab（/analyze 或 /analyze-async）');
  ok(/gasUrl:\s*GAS_URL/.test(CODE) && /sid:\s*SID/.test(CODE),
     '★★ 上傳要帶學號（後端靠檔名前綴認出是誰傳的）');

  /* ⚠️⚠️ 這是 2026-09-03 那次故障的**核心教訓**，也是最容易被
     「順手加回去」的一行：上傳按鈕不可以看 isOnline。
     ★ 加回 `!isOnline ||` 的話，Colab 一忙全班的按鈕又會變灰，
       而他們其實可以正常交作業。 */
  const _btn = (CODE.match(/disabled=\{[^}]*\}/g) || []).join(' ');
  ok(!/isOnline/.test(_btn),
     '★★ 上傳按鈕**不准**被 isOnline 鎖住（上傳打的是 GAS，跟 Colab 無關）');
  ok(/!matched/.test(_btn),
     '★★ 要擋的是「檔名認不出關卡」—— 那才是真的不能傳');

  /* ★ 關卡由檔名判定（規則和後端 core.level_from_filename 同一套）。
     ⚠️ 認不出時要在**選檔當下**就講，不要讓學生排完 20 分鐘才知道。 */
  ok(/window\.levelFromFilename\(/.test(CODE),
     '★★ 關卡要用共用的 levelFromFilename 判（不要各寫一份比對規則）');
  ok(/challengeId:\s*matched\.id/.test(CODE),
     '★★ 成績要記在檔名判出來的那一關');
  ok(/這個檔名看不出是哪一關/.test(SRC),
     '★★ 認不出關卡要當場說，而且要教他怎麼重截');

  /* ⚠️⚠️ 截圖備份：雲端這條路後端拿不到班級和座號（檔名裡只有學號），
     gas_upload_shot 缺欄位就不會上傳 ——
     ⇒ 備份只剩前端這一條路。這幾個欄位缺一個，GAS 就拼不出資料夾路徑，
       成績記得到、證書那一格卻是空的。 */
  ['classRoom', 'seatNo', 'challengeId'].forEach(f => {
    ok(new RegExp(f + ':').test(CODE),
       '★★ 截圖備份要帶 ' + f + '（GAS 拼資料夾路徑用，缺一個就不會傳）');
  });

  /* ⚠️ 排隊清單要看得到自己那一列 —— 30 人的清單裡找不到自己
     等於沒有這個功能。 */
  ok(/myUpName/.test(CODE) && /queueLabel/.test(CODE),
     '★ 排隊清單要標出「這一列是我」並顯示學號與關卡');

  ok(/\/api\/my-passed/.test(CODE),
     '★★ 登入後要問後端「我過了哪幾關」');
  /* ★★ 最重要的一條：補記一定要走既有的 handleChallengeComplete。
     另寫一套寫 Firestore 的程式碼，兩邊給出的星星遲早會不一樣，
     而且不一樣時沒有人會發現 —— 十關對照表才剛示範過。 */
  ok(/await handleChallengeComplete\(/.test(CODE),
     '★★ 補記要走既有的 handleChallengeComplete（計分邏輯只有一份）');
  ok(/Number\(id\)/.test(CODE),
     '★ 關卡編號要還原型別，不然 includes() 判不出來會重複補');
  /* ⚠️ 不可以依賴 localStorage 的號碼牌 —— 教室電腦有還原卡，
     關機就重置。這條路只認學號，換一台電腦登入照樣補得回來。 */
  ok(/student_id=/.test(CODE),
     '★★ 要用學號查（不是用 localStorage 的號碼牌）');
  /* ★ 補記時要帶截圖網址，否則證書上那一塊是虛線空框 ——
     圖其實在雲端硬碟裡（後端傳的），只是 Firestore 沒有那個連結。 */
  ok(/urls\[String\(id\)\]/.test(CODE),
     '★★ 補記要帶上後端記下的截圖網址（不然證書少一張圖）');
  /* ⚠️ 後端沒開時要安靜跳過，絕對不可以擋住上課 */
  ok(/catch \(e\) \{[\s\S]{0,400}?安靜跳過/.test(SRC),
     '★★ 後端連不上要安靜跳過（這是附加保障，不能擋住上課）');
  /* ⚠️ 不可以只找 /ctl.abort(), 8000/ —— 健康檢查那邊也有一個同樣的逾時，
     把補記這邊的拿掉照樣綠（2026-09-02 突變時抓到）。
     ⇒ 只看 my-passed 那一段附近。 */
  const _mp = CODE.indexOf('/api/my-passed');
  ok(_mp >= 0 && /ctl\.abort\(\)/.test(CODE.slice(Math.max(0, _mp - 600), _mp + 600)),
     '★ 補記這個查詢要有逾時（後端當掉時不能拖住登入）');
  /* ⚠️ 而且一定要保留「後端沒傳成功就自己傳」這條退路 ——
     老師還沒在 Colab Secrets 設 GAS 金鑰的那段時間，
     drive_url 一直會是 null，那時前端不傳就等於完全沒備份。 */
  /* ⚠️ 不可以用 /finalImageUrl \?/ 這種寬鬆的樣式 —— 11502 在別處
     （顯示訊息那行）也有 `finalImageUrl ?`，把整條退路拿掉照樣綠。
     ⇒ 兩個學期各釘自己那條「後端沒給就自己傳」的分支。 */
  /* ⚠️⚠️ 2026-09-03 之後這條退路變成**唯一**的一條：雲端路徑上
     後端拿不到班級和座號，gas_upload_shot 缺欄位就不會上傳。
     ⇒ 前端不傳＝完全沒有截圖備份，證書那一格永遠是空的。 */
  ok(/!driveUrl && base64Image && GAS_UPLOAD_URL/.test(CODE)
     || /window\.fileToBase64\(selectedFile\)/.test(CODE),
     '★★ 截圖備份一定要有人傳（雲端路徑上後端不會傳，只剩前端這條）');
  /* ⚠️ 這一條原本釘 /j\.message/ —— 那是「直接對 res 呼叫 .json()」時代的寫法。
     2026-09-02 改成號碼牌制之後，後端的話是從 out.data.message 出來的，
     這條就紅了。★ 釘的應該是「後端說得清楚的話要照原樣顯示」這個行為，
     不是它從哪個變數取出來。 */
  /* ★ 釘的是「後端／上傳說得清楚的話要照原樣顯示」這個行為，
     不是它從哪個變數取出來，也不是某一句固定的話。 */
  ok(/isOwn \? raw/.test(CODE) && /err && err\.message/.test(CODE),
     '★ 上傳失敗的具體原因要透出來，不可以被一句通則蓋掉');
  /* ⚠️ 而且反過來：真的斷線時不可以再叫學生去「確認 API 網址」——
     那是講給老師聽的，學生看了只會不知所措。 */
  ok(!/請確認伺服器正在執行，且 API 網址正確/.test(CODE),
     '★★ 不可以再對學生說「確認 API 網址正確」');
  ok(/這不是你的截圖有問題/.test(CODE),
     '★★ 連不上時要明講「不是你的截圖有問題」');
  /* ⚠️ 後端如果還是舊版（/api/queue-list 沒有 worker 欄位），
     不可以就跳出警告 —— Colab 那本不一定跟前端同時更新，
     每次都喊狼來了的話，真的出事時沒有人會理它。 */
  ok(/j\.worker !== false/.test(CODE),
     '★ 舊後端沒有 worker 欄位時要當成正常（undefined ≠ 停擺）');
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
  /* ⚠️ 這一條原本寫死 timeout=180 —— 後來把它換成 OCR_STALE_SECONDS
     常數（讓等待方和佇列丟棄共用同一個數字），這條就紅了。
     釘的應該是「有 stats 這個出口」，不是那個數字長什麼樣。 */
  ok(/def ocr_run\(img, timeout=[^,]+, stats=None\)/.test(NBCODE),
     '★ ocr_run 要能把等待時間回報給呼叫端');
  ok(/box\["waited"\]/.test(NBCODE), '★ OCR 執行緒要記下這張等了多久');
  /* ⚠️ 原本釘 /with _ocr_cpu_sem:/ 這個字面。2026-09-02 把閘門包成
     _CpuGate（為了記下「等了多久」），這條就紅了 ——
     而實際上閘門還在，只是換了進出的方式。
     ★ 釘的應該是「有閘門」和「等待有被記錄」。 */
  ok(/_ocr_cpu_sem/.test(NBCODE) && /_CpuGate\(_q_stats\)/.test(NBCODE),
     '★ 解碼與縮放要有並發閘門');
  /* ⚠️⚠️ 2026-09-03：Colab 只有 2 顆核心，原本允許 2 張同時辨識 ——
     等於兩顆全滿，Flask 排不到 CPU，/health 逾時 → 全班判離線，
     而後端其實好好的。⇒ 一定要留一顆給 Flask。 */
  ok(/cpu_count\(\) or 2\) - 1/.test(NBCODE),
     '★★ OCR 併發要留一顆核心給 Flask（不然 /health 會被餓死）');
  ok(/max\(1,/.test(NBCODE),
     '★ 但至少要有 1（單核機器不能變成 0）');
  ok(/cpu_wait/.test(NBCODE),
     '★★ 等閘門的時間一定要記下來 —— 不記的話它會混進「解碼時間」，'
     + '而 2026-09-02 就是這樣得出「解碼佔 34%、該讓前端裁切」的錯誤結論');
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
    const wi = body.findIndex(l => /with (_ocr_cpu_sem:|_CpuGate\()/.test(l));
    const ri = body.findIndex(l => l.includes('ocr_run('));
    const ind = l => l.length - l.trimStart().length;
    // ocr_run 的縮排必須「不深於」with 那一行 → 代表它在 with 之外
    verdict = wi >= 0 && ri >= 0 && ind(body[ri]) <= ind(body[wi]);
  }
  ok(verdict, '★★ 閘門只包 CPU 動作，不可以包住等待 OCR 的時間');
}

/* ═══════════════════════════════════════════════════════
   等待時間要講得出來，而且要準
   -------------------------------------------------------
   ⚠️ 老師 2026-08-26：「能讓學生理解自己排隊的順位以及可能時間嗎？」
      順位可以，時間本來不行：
        ‧ 11501 完全沒報時間
        ‧ 11502 用寫死的 6 秒，後端常數卻是 3 秒 —— 三個數字互不相同
        ‧ 而且那都是**單人**速度，全班一起用時每張慢很多 ⇒ 一定低估
      說「約 1 分鐘」卻等了 3 分鐘，學生會以為壞掉而重按，比不報更糟。
   ═══════════════════════════════════════════════════════ */
/* ⚠️⚠️ 2026-09-03 把「估計還要幾分鐘」整個拿掉了。
   ★ 為什麼：那個數字是估的，而估低了的後果特別壞 ——
     說「約 1 分鐘」卻等了 3 分鐘，學生會以為系統壞掉而重按，
     重按又讓後端更擠。以前修的方向是「把估算做準」，
     但雲端路徑上根本不必估：**排隊清單就是事實本身**
     （自己那一列還在＝還沒輪到，消失＝好了）。
   ⇒ 這一節現在守的是「不要又長回一個估出來的數字」。 */
for (const term of ['11501', '11502']) {
  section('★★ ' + term + '：不要再估等待時間');
  const SRC = fs.readFileSync(path.join(ROOT, term, 'thinking.html'), 'utf8');
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');

  ok(!/大約還要/.test(CODE.replace(/\\/g, '')),
     '★★ 不可以再對學生報「大約還要幾分鐘」（估低了他會以為壞掉而重按）');
  /* ⚠️ 寫死的數字是更早那次要消滅的東西 —— 兩學期都不可以再出現。 */
  ok(!/\*\s*6\s*\/\s*60/.test(CODE),
     '★★ 不可以再用寫死的 6 秒估時間');
  ok(/queue\.map\(/.test(CODE),
     '★★ 改用排隊清單（清單是事實，估算不是）');
  ok(/不會不見/.test(SRC),
     '★★ 等的時候要講「圖已經在雲端，不會不見」—— '
     + '否則學生會重開視窗再傳一次，那正是故障自我放大的起點');
}

section('★★ 後端：平均秒數要用實測的');
{
  const NBCODE = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'))
    .cells.map(c => (c.source || []).join('')).join('\n')
    .split('\n').filter(l => !l.trim().startsWith('#')).join('\n');

  ok(/_ocr_recent\b/.test(NBCODE) && /def _ocr_avg_seconds/.test(NBCODE),
     '★★ 要維護「最近幾張的實際處理時間」');
  ok(/"avg_seconds"/.test(NBCODE), '★ /queue 要把它回報給前端');
  /* ⚠️ 只能記「真正處理」的時間：把排隊也算進去的話，
     人越多平均越高、估出來的時間會滾雪球，越等越久越報越久。 */
  ok(/total - _q_stats\.get\("wait"/.test(NBCODE),
     '★★ 記的是 total 扣掉排隊等待，不可以把排隊算進平均');
  ok(/del _ocr_recent\[:-_OCR_RECENT_N\]/.test(NBCODE),
     '★ 只留最近 N 筆（否則早上的數字會一直拖累下午）');
  /* ⚠️ 還沒有任何實測資料時要有預設值，不可以除以零或報 0 秒。 */
  ok(/if not _ocr_recent:/.test(NBCODE) && /return float\(AVG_OCR_SECONDS\)/.test(NBCODE),
     '★ 沒有樣本時退回預設值');
}

section('★★ 下課／關機之後，佇列裡沒人等的工作要丟掉');
{
  /* ⚠️ 老師 2026-08-26：「10:00 下課，之前送出的會一直持續下去嗎？
     關機之後，送出的要求還是一直卡住嗎？」—— 本來兩個都是「會」。
     圖片進了佇列，OCR 執行緒就無條件處理，它不知道對面已經
     關機、關分頁、或等到逾時放棄了。白做工還卡住後面的人。 */
  const NBCODE = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'))
    .cells.map(c => (c.source || []).join('')).join('\n')
    .split('\n').filter(l => !l.trim().startsWith('#')).join('\n');

  ok(/OCR_STALE_SECONDS/.test(NBCODE), '★ 有「多久算沒人等了」的常數');
  ok(/def ocr_run\(img, timeout=OCR_STALE_SECONDS/.test(NBCODE),
     '★★ 等待方的逾時和佇列的丟棄用**同一個數字** —— '
     + '兩邊不同步就會出現「這邊放棄了、那邊還留著」');
  ok(/box\["abandoned"\] = True/.test(NBCODE),
     '★ 等待方逾時要標記「我不要了」');
  ok(/box\.get\("abandoned"\)/.test(NBCODE) && /box\["waited"\] > OCR_STALE_SECONDS/.test(NBCODE),
     '★★ 取出時兩種都要檢查：標記放棄的、以及排太久的（關機屬於後者）');

  /* ⚠️ 檢查必須在 predict() **之前**，否則跑完才發現沒人要，等於沒改。 */
  const loop = NBCODE.slice(NBCODE.indexOf('while True:'));
  const iChk = loop.indexOf('box.get("abandoned")');
  const iRun = loop.indexOf('predict(img)');
  ok(iChk > 0 && iRun > 0 && iChk < iRun,
     '★★ 丟棄的判斷要在真的辨識之前');

  /* ⚠️ 兩個逾時的關係：學號鎖必須**比**佇列丟棄晚放開。
     反過來的話，鎖先開、學生重傳，舊的那張卻還在跑，
     等於同一個人真的佔了兩個位置 —— 正是這次要擋掉的事。 */
  const stale = Number((NBCODE.match(/OCR_STALE_SECONDS = (\d+)/) || [])[1]);
  const busy = Number((NBCODE.match(/_OCR_BUSY_TTL = (\d+)/) || [])[1]);
  ok(stale > 0 && busy > 0 && busy >= stale,
     '★★ 學號鎖的 TTL（' + busy + 's）要 >= 佇列丟棄（' + stale + 's）');
}

section('★ 後端：要看得出時間花在哪');
{
  /* ⚠️ 老師 2026-08-26：「處理 30 人，還能有什麼加速建議？」
     ★ 在調參數之前要先知道時間花在哪 —— 不然改一堆卻沒變快。 */
  const NBCODE = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'))
    .cells.map(c => (c.source || []).join('')).join('\n')
    .split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
  ok(/session_stats/.test(NBCODE), '★ /health 要回報這一節課的累計統計');
  ok(/avg_level_attempts/.test(NBCODE),
     '★★ 要記「平均跑了幾次偵測」—— 接近 2 就代表第一發都沒中');
  ok(/avg_decode/.test(NBCODE) && /avg_level/.test(NBCODE),
     '★ 解碼與辨識要分開算，才知道該優化哪一段');

  /* ⚠️ 老師 2026-08-26：「所以要在什麼時候記錄？還是可以自動搜集資料？」
     ★ 只存在記憶體的話，Colab 一重啟就沒了，而且要老師記得在下課前
       去查 /health —— 「忘記」在上課當下幾乎是必然的。
     ⇒ 自動寫進 Firestore。 */
  ok(/def record_ocr_stats/.test(NBCODE) && /def list_ocr_stats/.test(NBCODE),
     '★★ 統計要自動存進 Firestore，不能只留在記憶體');
  ok(/_OCR_STATS_FLUSH_EVERY/.test(NBCODE),
     '★ 每累積幾張就自動存一次（中途斷線也留得住前面的）');
  /* ⚠️⚠️ 寫 Firestore 是網路 I/O，佔著鎖會卡住其他辨識執行緒。 */
  const fl = NBCODE.indexOf('if _flush_payload:');
  const unlock = NBCODE.indexOf('_ocr_stats_flushed["n"] = _n_all');
  ok(fl > 0 && unlock > 0 && fl > unlock,
     '★★ 寫入要放在鎖外面（網路 I/O 佔著鎖會卡住辨識）');
  /* ⚠️ 這是純觀測資料，寫失敗絕不可以影響學生的判定。 */
  ok(/統計沒寫進去（不影響辨識）/.test(NBCODE),
     '★★ 寫失敗要吞掉並說明，不可以讓觀測資料弄壞辨識');
}

section('★★ 驗證成功之後不可以再按一次');
/* ⚠️ 老師 2026-08-26：「不管驗成功或失敗都會重新啟用按鈕，會不會誤按？」
   ★ 會。成功後再按就是又送一次 OCR —— 老師實測一次辨識 17 秒，
     而且會佔掉排隊裡別人的位置。
   ⚠️ 但**失敗要能再按**（那是重試），所以只擋 pass。
   ⚠️⚠️ 而且擋了之後，「換一張圖」一定要能解鎖，
      否則想重驗的學生會被永遠鎖住 —— 11501 原本就漏了 setResult(null)。 */
for (const term of ['11501', '11502']) {
  const T = fs.readFileSync(path.join(ROOT, term, 'thinking.html'), 'utf8');
  const C = T.replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(/disabled=\{[^}]*result\?\.status === 'pass'/.test(C),
     '★★ ' + term + '：驗證成功後要禁用按鈕');
  ok(/已完成（要重驗請重新選圖）/.test(T),
     '★ ' + term + '：按鈕文字要說明怎麼重驗');
  /* ⚠️⚠️ 三種狀態的性質不同，不可以一視同仁（老師 2026-08-26 追問）：
       pass  已經過了
       fail  判定不通過 —— OCR 是確定性的，同一張圖再驗結果一定一樣，
             白等一次辨識（實測約 34 秒）還佔掉別人的位置 ⇒ 也要擋
       error 系統／連線問題 ⇒ **重按有意義，絕對不可以擋** */
  ok(/disabled=\{[^}]*result\?\.status === 'fail'/.test(C),
     '★★ ' + term + '：判定不通過也要擋（同一張圖結果一樣）');
  ok(!/disabled=\{[^}]*result\?\.status === 'error'/.test(C),
     '★★ ' + term + '：系統錯誤**不可以**擋（那是唯一能重試的情況）');
  ok(/請換一張截圖再驗/.test(T),
     '★ ' + term + '：擋住時要說「換一張圖」，不能只是變暗');
  /* 換圖要解鎖 */
  const fc = C.slice(C.indexOf('const handleFileChange'), C.indexOf('const handleFileChange') + 700);
  ok(/setResult\(null\)/.test(fc),
     '★★ ' + term + '：換檔案要清掉上次結果，否則想重驗的學生會被鎖死');
}

section('★ 等待估計的預設值要貼近實測');
{
  const NBCODE = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'))
    .cells.map(c => (c.source || []).join('')).join('\n')
    .split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
  const avg = Number((NBCODE.match(/AVG_OCR_SECONDS = (\d+)/) || [])[1]);
  /* ⚠️ 老師 2026-08-26 實測：純辨識 17 秒 × 2 次 ≈ 34 秒。
     原本寫 3 秒，差十倍以上 —— 學生看到的等待會嚴重低估。 */
  ok(avg >= 10,
     '★★ 沒有樣本時的預設值不可以太樂觀（目前 ' + avg + ' 秒；實測約 34 秒）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
