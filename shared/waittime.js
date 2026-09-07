/* 等待時間的說法（11501／11502、程式批改與截圖辨識共用）
   用法：WaitTime.fmtWait(90) → "約 2 分鐘"

   ★★ 為什麼放在 shared/ 而不是各頁各寫一份
      這個 repo 已經在「同一件事兩個地方各做一次」上吃過好幾次虧：
      2026-09-04 grader.html 把 25 秒寫死一次、後端 AVG_GRADE_SECONDS
      又寫死一次，改一邊另一邊不會跟著動，而且**不會有任何錯誤訊息**。
      ⇒ 說法只留一份。

   ⚠️⚠️ 核心規則：一律**往上**取整，任何情況都不可以低估。
      2026-09-08 老師貼回實測：一份作業 91.6 秒，而畫面說「約 25 秒」。
      學生等到超過就以為當掉、去重按 —— 重按被學號守門擋成 429，
      畫面上只剩一句錯誤，看起來更像壞掉。
      ★ 估多了學生是驚喜，估少了是客訴。這個不對稱是這一份的全部理由。 */
(function (global) {
  'use strict';

  /* 秒數 → 人話。半分鐘一格，一律往上。
     ⚠️ 不輸出「約 2.5 分鐘」——中文不這樣講時間，
        而且小數點會讓人以為那是精確值（它只是平均）。 */
  function fmtWait(sec) {
    sec = Number(sec);
    if (!(sec > 0)) return '一下子';
    if (sec < 50) return '約 ' + Math.ceil(sec / 10) * 10 + ' 秒';
    var half = Math.ceil(sec / 30) / 2;
    return Number.isInteger(half) ? '約 ' + half + ' 分鐘'
      : '約 ' + Math.floor(half) + ' 分半';
  }

  /* 已經過了多久。⚠️ 秒數補零，畫面才不會一直跳寬度。 */
  function fmtElapsed(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    return sec < 60 ? sec + ' 秒'
      : Math.floor(sec / 60) + ' 分 ' + String(sec % 60).padStart(2, '0') + ' 秒';
  }

  /* 真的在排隊時（截圖辨識是一次一張的佇列）要等多久。
     ⚠️⚠️ 這和程式批改**完全相反**，不可以共用同一句話：
        · 程式批改：同時 8 份在跑 ⇒ 時間**不乘**人數
        · 截圖辨識：一次一張 ⇒ 時間**要乘**上前面的張數
        2026-09-04 就是把這兩件事講成同一句，害學生嚴重高估等待時間。 */
  function fmtQueue(countAhead, avgSec) {
    var n = Math.max(0, Number(countAhead) || 0);
    /* ⚠️ 0 張要回一個**可以接在句子裡**的詞。回「現在傳最快」的話，
       呼叫端寫「大約還要 ___」就會變成「大約還要現在傳最快」。
       這種錯誤語法檢查抓不到，只有真的唸一遍才會發現。 */
    if (!n) return '馬上';
    /* ⚠️ 問不到實測平均就不要用寫死的秒數硬估 —— 呼叫端應該先擋掉
       （ocrAvg > 0 才呼叫）。這裡的 24 只是最後的保險，不是預設值。 */
    return fmtWait(n * (Number(avgSec) > 0 ? Number(avgSec) : 24));
  }

  global.WaitTime = { fmtWait: fmtWait, fmtElapsed: fmtElapsed, fmtQueue: fmtQueue };
})(window);
