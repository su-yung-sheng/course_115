/* =====================================================================
   身分守門（上下學期共用，兩個學期的檔案內容完全相同）
   ---------------------------------------------------------------------
   規則：所有關卡頁一律要「先從闖關基地登入」才能進入。
   直接貼網址進來（沒有登入紀錄）→ 自動導回闖關基地，
   並帶上 ?next=原本要去的頁面，登入成功後會自動回到那一頁。

   ★ 被嵌入 iframe 時（例如程式設計頁裡的清單學習機、音階、作品評分）
     不做檢查，交由外層頁負責，避免在框內誤跳轉。

   ★ 學期怎麼判斷：優先用 window.CONFIG.TERM；
     但很多關卡頁只載入本檔、沒有載入 config.js，
     所以讀不到時改用網址檔名推導（flowchart.html → 11502）。
   ===================================================================== */
(function () {
  try {
    if (window.self !== window.top) return;          // 嵌入模式 → 略過

    var page = location.pathname.split('/').pop() || '';
    var term = (window.CONFIG && window.CONFIG.TERM)
            || (page.match(/^(115\d{2})_/) || [])[1]
            || '11501';                              // 都判斷不出來就用上學期

    var sid = null;
    try { sid = localStorage.getItem('sid' + term); } catch (e) { sid = null; }
    if (sid && /^14\d{5}$/.test(sid)) return;        // 已從闖關基地登入過

    location.replace(term + '_hub.html?next=' + encodeURIComponent(page + location.search));
  } catch (e) { /* 出錯就不擋，避免整頁打不開 */ }
})();
