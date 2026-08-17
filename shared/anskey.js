/* =====================================================================
   選擇題的答案：不要用明碼放在網頁裡
   ---------------------------------------------------------------------
   ★ 為什麼有這一支（老師 2026-08-17 提出）
     資訊倫理與媒體議題那兩個模組是選擇題，題庫長這樣：
       { "q": "資訊倫理主要目的為何？", "options": [...], "correct": 2 }
     而這個 repo 是**公開**的 GitHub Pages。
     學生按 F12 → Sources，或直接開 GitHub 的原始檔，`correct` 就是答案；
     更快的是在 Console 打一行 `QUIZ_CONTENT`，370 題連答案一次印出來。
     ⇒ 在擋「複製題目去問 AI」之前，這個洞才是最短的那條路。

   ★ 作法
     把 correct（第幾個選項）換成 a（一段雜湊）：
       a = FNV-1a( 題目文字 ＋ 正確選項的文字 ＋ SALT )
     答題時對**學生選的那個選項**算一次雜湊，對得起來就是答對。
     資料檔裡再也沒有「哪一個是答案」這件事。

   ⚠️⚠️ 這是「不可讀」，**不是「不可破」**。
     雜湊函式和 SALT 都在前端，任何人只要對四個選項各算一次雜湊，
     就能反推出答案 —— 教師端的統計頁（qstat.html）用的正是這個方法。
     ★ 它的防護等級是：**不讓答案被直接讀出來**。
       對「隨手按 F12 看一眼」有效；對「會寫程式的人」無效。
       真的要擋死，答案必須放到後端驗證（GAS），那是另一件工程。
       ⇒ 不要因為做了這一層就以為題目安全了。

   ★ 為什麼不直接用 QSTAT.id
     那一支是「題目文字 → 統計用的 id」，公開、也該公開（教師端要對得回題目）。
     答案要另外一把 —— 兩件事混用一把鑰匙，改了一邊就會弄壞另一邊。

   用法：
     ANSKEY.of(q, optionText)          → 雜湊字串
     ANSKEY.check(q, optionText, a)    → true / false
     ANSKEY.find(q, options, a)        → 正確選項的索引（教師端反查用，找不到回 -1）
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-17-anskey';

  /* ⚠️ SALT 在前端，學生看得到 —— 它的作用不是保密，
     而是讓答案雜湊和 QSTAT 的題目 id **算出來不一樣**，
     免得有人拿題目 id 當答案用（那會變成另一種洩漏）。 */
  var SALT = 'ans::115';

  /** 正規化：去標籤、去空白與標點 —— 排版改一個空格不該讓答案對不上 */
  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]*>/g, '')
      .replace(/[\s，。、？！：；「」（）()·,.?!:;"']/g, '');
  }

  /** FNV-1a 32 位元 → 36 進位（和 qstat.js 同一種，但吃的字串不同） */
  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  function of(q, optionText) {
    return fnv(norm(q) + '||' + norm(optionText) + '||' + SALT);
  }

  function check(q, optionText, a) {
    if (!a) return false;
    return of(q, optionText) === String(a);
  }

  /**
   * 反查正確選項的索引。
   * ⚠️ 教師端的統計頁要顯示「哪一個才是對的」，只能這樣做。
   *    這也正好說明了上面那句「不可破」的但書 ——
   *    四次雜湊就能反推，所以它擋的是隨手看，不是有心人。
   */
  function find(q, options, a) {
    for (var i = 0; i < (options || []).length; i++) {
      if (check(q, options[i], a)) return i;
    }
    return -1;
  }

  /**
   * 一題有沒有「還沒換掉的明碼答案」。
   * ★ 轉換腳本與測試都用它 —— 判斷邏輯只有一份。
   */
  function isPlain(item) {
    return !!item && item.correct !== undefined && item.correct !== null;
  }

  global.ANSKEY = {
    VERSION: VERSION,
    of: of, check: check, find: find, isPlain: isPlain,
    _norm: norm, _fnv: fnv
  };

  /* node 也要用得到（轉換腳本與測試） */
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ANSKEY;

})(typeof window !== 'undefined' ? window : globalThis);
