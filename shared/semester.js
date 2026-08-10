/* =====================================================================
   學期判定（單一來源）
   ---------------------------------------------------------------------
   全站「現在是哪個學期」都以這一支為準，不要各頁自己用月份猜。

   ⚠️ 月份判斷是不夠的：2026-07 用「2～7 月＝下學期」會判成 11502，
      但那時候 115 學年度根本還沒開始。所以用明確的日期區間。

   載入順序：config.js → semester.js → guard.js
   （index.html 沒有 config.js，可以單獨載入這一支，日期表不依賴 CONFIG）

   ---------------------------------------------------------------------
   ★ 學期鎖（LOCK = true）

     學生開到非當學期的頁面 → 擋下並導向當學期，不可能累積到錯誤學期的星星。

     這一層擋的是「走錯 + 手動改網址」。真正的防線在 shared/firestore.rules：
     那裡用 request.time（伺服器時間）限制 {學期}-progress 的寫入期間，
     改前端繞不過去。兩層要一起看。

     不受鎖影響：
       ‧ 教師端（teacher.html 刻意不載入這一支）
       ‧ 狀態檢查、轉換工具（shared/ 底下，推導不出學期）
       ‧ TEST_IDS 裡的測試帳號
   ===================================================================== */
(function (global) {
  'use strict';

  var LOCK = true;         // 學期鎖：學生只能使用當學期

  /* 測試帳號：不受學期鎖限制，任何時候都能進出兩個學期。
     ⚠️ 這份清單在 shared/firestore.rules 裡有一份**一模一樣**的複製
        （安全規則沒辦法載入 JS）。改這裡就要改那裡，兩邊都改才有效。
        搜尋 firestore.rules 裡的 isTestAccount 就找得到。 */
  var TEST_IDS = ['1410905'];
  /* 1410905：老師自己的測試帳號（qfm1410905@mail.qfm.kh.edu.tw）。
     ★ 為什麼一定要有一個「真的登得進去」的學號
       老師帳號（suyungsheng@）進不了學生流程 ——
       auth.js 的 sidFromEmail() 認的是「qfm ＋ 7 位數字」，
       老師的信箱取不出 sid，會被判成 notstudent 直接導走。
       所以「用老師帳號走一遍學生流程」是做不到的，
       只能用一個格式正確、而且**不在任何班級名單裡**的帳號。
     ★ 這個帳號不在名冊裡，所以班級／座號是從學號推出來的（809 班 5 號），
       不會和真的學生混在一起。 */

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

  function isTestAccount(sid) {
    return TEST_IDS.indexOf(String(sid || '')) >= 0;
  }

  global.SEMESTER = {
    TABLE: TABLE,
    LOCK: LOCK,
    TEST_IDS: TEST_IDS,
    isTestAccount: isTestAccount,
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

  /* ── 還不知道你是誰的時候，不要擋 ────────────────
     ⚠️ 2026-08-10 實際踩到：測試帳號被自己的學期鎖擋在門外。

     原因是**順序**：
       config.js → semester.js（這支，同步執行）→ auth.js（非同步登入）
     這一段跑的時候，sessionStorage 裡還沒有 sid ——
     登入根本還沒開始。於是 isTestAccount(null) 永遠是 false，
     「測試帳號豁免」這個出口實際上打不開。

     ⇒ 沒有 sid ＝ 還沒登入 ＝ 現在擋他沒有意義（他還不是任何人，
       也還沒有進度可以記錯學期）。
       等 auth.js 把 sid 寫進去，下一次頁面載入這道鎖才有判斷的依據。

     ★ 這樣會不會放水？不會，因為要記錯進度得先登入：
       · 沒登入 → guard.js 會把他送去登入
       · 登入後 → sid 有了，這道鎖照常擋
       · 而真正的防線本來就在 firestore.rules（用伺服器時間），
         那一層改前端繞不過去。 */
  var sid = null;
  try { sid = sessionStorage.getItem('sid' + mine); } catch (e) {}
  if (!sid) return;                                // 還沒登入，等下一次

  // 測試帳號豁免：開學前要驗下學期、學期中要回頭驗上學期，都需要這個出口
  if (isTestAccount(sid)) {
    console.warn('[SEMESTER] 測試帳號 ' + sid + '：略過學期鎖（現在是' + name(active) + '）');
    return;
  }

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
