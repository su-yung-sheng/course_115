/* =====================================================================
   身分守門（上下學期共用，兩個學期的檔案內容完全相同）
   ---------------------------------------------------------------------
   規則：所有關卡頁一律要「先從闖關基地登入」才能進入。
   直接貼網址進來（沒有登入紀錄）→ 自動導回闖關基地，
   並帶上 ?next=原本要去的頁面，登入成功後會自動回到那一頁。

   ★ 被嵌入 iframe 時（例如程式設計頁裡的清單學習機、音階、作品評分）
     不做檢查，交由外層頁負責，避免在框內誤跳轉。

   ★ 學期怎麼判斷：優先用 window.CONFIG.TERM；
     有些頁面只載入本檔、沒有載入 config.js，
     所以讀不到時改用「所在資料夾」推導（/11502/flowchart.html → 11502）。

   ⚠️ 2026-08-03 修正：原本導向 `{學期}_hub.html`（例如 11502_hub.html）。
      整併成單一 repo 時檔名已經去掉學期前綴（改放進 11501/ 11502/ 資料夾），
      那兩個檔案根本不存在，任何「直接貼網址」或「關掉分頁再回來」的學生
      都會吃到 404。現在一律導向同資料夾的 hub.html。
   ===================================================================== */
(function () {
  try {
    if (window.self !== window.top) return;          // 嵌入模式 → 略過

    var page = location.pathname.split('/').pop() || '';
    var term = (window.CONFIG && window.CONFIG.TERM)
            || (location.pathname.match(/\/(115\d{2})\//) || [])[1]
            || '11501';                              // 都判斷不出來就用上學期

    var sid = null;
    try { sid = sessionStorage.getItem('sid' + term); } catch (e) { sid = null; }
    if (sid && /^14\d{5}$/.test(sid)) return;        // 已從闖關基地登入過

    // hub 與關卡頁在同一個學期資料夾裡，用相對檔名即可
    var hub = (window.CONFIG && window.CONFIG.HUB_PAGE) || 'hub.html';
    location.replace(hub + '?next=' + encodeURIComponent(page + location.search));
  } catch (e) { /* 出錯就不擋，避免整頁打不開 */ }
})();
