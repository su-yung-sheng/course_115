/* =====================================================================
   學期判定（單一來源）
   ---------------------------------------------------------------------
   全站「現在是哪個學期」都以這一支為準，不要各頁自己用月份猜。

   ⚠️ 月份判斷是不夠的：2026-07 用「2～7 月＝下學期」會判成 11502，
      但那時候 115 學年度根本還沒開始。所以用明確的日期區間。

   載入順序：config.js → semester.js → guard.js
   （index.html 沒有 config.js，可以單獨載入這一支，日期表不依賴 CONFIG）

   ---------------------------------------------------------------------
   ★ 要「鎖住學期」時，把下面的 LOCK 改成 true。

     鎖住後：學生開到非當學期的頁面，會看到提示並被導向當學期，
             也就不可能在下學期去累積上學期的星星。
     不受影響：教師端（teacher.html 不載入這一支）、狀態檢查、轉換工具。
   ===================================================================== */
(function (global) {
  'use strict';

  var LOCK = false;        // ← 開學前改成 true 就會生效

  /* 學期的日期區間（含頭含尾）。
     這裡是「學期歸屬」的界線，與 config.js 的 TERM_START 不同 ——
     TERM_START 是第 1 週的星期一，用來算週次與出席。 */
  var TABLE = [
    { term: '11501', name: '上學期', start: '2026-08-01', end: '2027-01-31' },
    { term: '11502', name: '下學期', start: '2027-02-01', end: '2027-07-31' }
  ];

  function ymd(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /** 今天（或指定日期）屬於哪個學期。
      早於整個學年 → 回傳第一個學期（開學前的準備期）
      晚於整個學年 → 回傳最後一個學期（學年結束後仍可查看） */
  function current(now) {
    var today = ymd(now ? new Date(now) : new Date());
    for (var i = 0; i < TABLE.length; i++) {
      if (today >= TABLE[i].start && today <= TABLE[i].end) return TABLE[i].term;
    }
    return today < TABLE[0].start ? TABLE[0].term : TABLE[TABLE.length - 1].term;
  }

  function info(term) {
    for (var i = 0; i < TABLE.length; i++) if (TABLE[i].term === term) return TABLE[i];
    return null;
  }

  function name(term) {
    var x = info(term);
    return x ? x.name : term;
  }

  global.SEMESTER = {
    TABLE: TABLE,
    LOCK: LOCK,
    current: current,
    info: info,
    name: name,
    /** 這個學期現在是不是「當學期」 */
    isActive: function (term, now) { return current(now) === term; }
  };

  /** 這個頁面屬於哪個學期。
      優先用 CONFIG.TERM；沒有 config.js 的獨立教材頁就從網址路徑推導
      （/course_115/11502/sort.html → 11502）。 */
  function pageTerm() {
    if (global.CONFIG && global.CONFIG.TERM) return global.CONFIG.TERM;
    var m = location.pathname.match(/\/(115\d{2})\//);
    return m ? m[1] : '';
  }

  global.SEMESTER.pageTerm = pageTerm;

  /* ── 鎖：只在「學期資料夾底下的頁面」執行 ────────────────
     推導不出學期就代表這是總入口或 shared/ 底下的工具頁，不鎖。 */
  if (!LOCK) return;
  if (global.self !== global.top) return;          // 嵌在 iframe 裡由外層頁負責

  var mine = pageTerm();
  if (!mine) return;
  var active = current();
  if (mine === active) return;                     // 正是當學期，放行

  // 走到這裡＝學生開錯學期了。擋下來並指路，不要讓他在這裡累積進度。
  document.addEventListener('DOMContentLoaded', function () {
    document.body.innerHTML =
      '<div style="max-width:520px;margin:16vh auto;padding:32px;background:#fff;'
    + 'border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 12px 32px rgba(0,0,0,.08);'
    + 'font-family:\'Noto Sans TC\',system-ui,sans-serif;text-align:center">'
    + '<div style="font-size:40px;margin-bottom:8px">📅</div>'
    + '<h1 style="font-weight:900;font-size:20px;color:#1e293b;margin:0 0 12px">'
    +   '現在是' + name(active) + '</h1>'
    + '<p style="color:#475569;font-weight:700;line-height:1.8;margin:0 0 24px">'
    +   '你開的是' + name(mine) + '的頁面。<br>'
    +   '為了避免進度記到錯誤的學期，這裡先擋下來。</p>'
    + '<a href="../' + active + '/hub.html" style="display:inline-block;padding:14px 28px;'
    +   'background:#1e293b;color:#fff;font-weight:900;border-radius:14px;text-decoration:none">'
    +   '前往' + name(active) + '的闖關基地 →</a>'
    + '<p style="color:#94a3b8;font-size:12px;margin:20px 0 0;line-height:1.7">'
    +   '要查看' + name(mine) + '的成績，請找老師從教師端查詢。</p>'
    + '</div>';
  });

})(window);
