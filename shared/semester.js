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
       ‧ TEST_IDS 裡的測試帳號（★ 2026-08-19 起這份清單是**空的**，
         也就是現在沒有任何學生帳號能繞過學期鎖）
   ===================================================================== */
(function (global) {
  'use strict';

  var LOCK = true;         // 學期鎖：學生只能使用當學期

  /* 測試帳號：不受學期鎖限制，任何時候都能進出兩個學期。
     ⚠️ 這份清單在 shared/firestore.rules 裡有一份**一模一樣**的複製
        （安全規則沒辦法載入 JS）。改這裡就要改那裡，兩邊都改才有效。
        搜尋 firestore.rules 裡的 isTestAccount 就找得到。 */
  var TEST_IDS = [];
  /* ★ CLOSED 2026-08-19：目前**沒有**開放中的測試帳號。
       這個空清單是**刻意的**，不是漏刪 —— 老師：「11502 測試到此為止，
       可以關閉測試帳號 1410905，已由名單中移除。」
       11502 的內容驗完了，就不該再留一個「不受學期鎖限制」的帳號在線上。
       testids.test.js 會要求這段 CLOSED 註記存在，
       免得日後有人看到空清單以為是不小心刪掉的。

     ★ 「關閉」關掉的是什麼、沒關掉什麼（不要誤會）
       關掉的：跨學期的特權 —— 1410905 現在和一般學生一樣受學期鎖限制，
               2027-02-01 之前碰不到 11502。
       沒關掉的：帳號本身還是登得進**當學期**（規則的 isOwner(sid) 認的是
               「本人寫自己的」，不看名冊）。它已經不在名冊裡，所以教師端
               不會顯示它 —— 教師端是照名冊列學生的（見 teacher.html 的
               rosterSnap.forEach）。真要連登入都擋，需要另做一份黑名單。
       ⚠️ 雲端可能還留著 11501-progress/1410905、11502-progress/1410905
          兩份文件。它們不會出現在教師端，但要清乾淨得去 Firebase Console
          手動刪 —— 程式碼這邊做不到。

     ★ 要重新開一個測試帳號的話（三步，缺一步都會很難查）
       ① 這裡填學號（格式必須是 14 開頭的 7 碼，
          auth.js 的 sidFromEmail() 只認「qfm ＋ 7 位數字」，
          所以老師帳號 suyungsheng@ 走不了學生流程，
          只能用一個格式正確、而且**不在任何班級名單裡**的學號）
       ② shared/firestore.rules 的 isTestAccount() 填一模一樣的
       ③ **去 Firebase Console 按發布**，親眼看到「已發佈」
          —— 規則不在 repo 裡執行，只改檔案等於沒改。 */

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

  /* 測試帳號豁免：開學前要驗下學期、學期中要回頭驗上學期，都需要這個出口。
     ★ 2026-08-19 起 TEST_IDS 是空的 —— 這個出口留著（機制沒拆），
       但現在沒有任何人走得進來。要重開只要把學號填回 TEST_IDS 與規則。 */
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
