/* =====================================================================
   程式作品（.sb3）的檔名 → 看得出是哪一關嗎？（2026-11-17）
   ---------------------------------------------------------------------
   ⛔ 起因：老師「今天程式設計第三關上傳第二關程式，結果評為 100」（1410605）。
      後端已經會擋「同一個檔案在別關拿過 75 分以上」（backend.ipynb work_home_unit），
      但那只認位元組完全相同的檔案。老師問「也能比照運算思維，先檢查檔名？」
   ★ 老師發的範本檔名帶關卡代號或名稱（例如「2-1-2 演奏小星星.sb3」），
     學生在 Scratch 存檔時會沿用 ⇒ 檔名是一條線索。
   ★ 老師 2026-11-17 定案：「檔名一定要符合關卡代碼或關卡名才放行，不會有自定義名稱的問題」
      ⇒ 和運算思維一樣嚴：
        · 檔名寫的是**這一關**（代號或名稱）⇒ 放行
        · 檔名寫的是**別的關卡** ⇒ 擋，並說出是哪一關
        · 檔名**看不出**是哪一關（「Scratch 專案」「我的作品」）⇒ 也擋，請他把檔名改成這一關的名稱
      （第一版是「看不出就放行」，老師確認範本檔名都有代號或名稱，學生不會自訂檔名。）
   ⚠️ 關卡清單只認 config.js 的 UNITS（代號＋名稱），不另外手打一份。
   ===================================================================== */
(function (global) {
  'use strict';

  /* 只留字母、數字、中文（全形轉半形、去空白和標點、不分大小寫）：
     「2-1-2 演奏小星星 (1).sb3」→「212演奏小星星1」 */
  function compact(s) {
    var t = String(s || '');
    try { t = t.normalize('NFKC'); } catch (e) { /* 舊瀏覽器 */ }
    t = t.toLowerCase().replace(/\.sb3$/, '');
    try { return t.replace(/[^\p{L}\p{N}]+/gu, ''); }
    catch (e) { return t.replace(/[\s\-_.,，、（）()【】\[\]~～·]+/g, ''); }
  }

  function lower(s) {
    var t = String(s || '');
    try { t = t.normalize('NFKC'); } catch (e) { /* 舊瀏覽器 */ }
    return t.toLowerCase().replace(/\.sb3$/, '');
  }

  /* 關卡代號 → 正規表示式。字元之間可以有空白、-、_、.（「2-1-2」「2_1_2」「2 1 2」都算），
     前後不可以緊接字母數字：「2-1-1a」不算進「2-1-1b」，「11501_2-1-2」的 2-1-2 要認得出來。
     ⚠️ 不可以拿 compact 過的字串比代號：「11501_2-1-2」會黏成「11501212」，前面的 1 擋住了邊界。 */
  function idRe(id) {
    var cs = compact(id).split('');
    if (!cs.length) return null;
    return new RegExp('(^|[^0-9a-z])' + cs.join('[\\s\\-_.]*') + '(?![0-9a-z])');
  }

  /** 檔名裡提到哪些關卡 → 代號陣列（照 UNITS 的順序） */
  function unitsIn(fileName, units) {
    var f = compact(fileName), raw = lower(fileName);
    if (!f) return [];
    var hits = [];
    (units || []).forEach(function (u) {
      var name = compact(u[1]), re = idRe(u[0]);
      var byId = !!re && re.test(raw);
      var byName = name.length >= 2 && f.indexOf(name) >= 0;
      if (byId || byName) hits.push(u[0]);
    });
    return hits;
  }

  /** 這個檔名可以交到 unit 嗎？→ { ok, others:[代號…] }
      檔名要提到**這一關**才放行；others 是檔名提到的別的關卡（看不出是哪一關時是空陣列）。 */
  function check(fileName, unit, units) {
    var hits = unitsIn(fileName, units);
    if (!unit || hits.indexOf(unit) >= 0) return { ok: true, others: [] };
    return { ok: false, others: hits };
  }

  global.SB3NAME = { compact: compact, unitsIn: unitsIn, check: check };
})(typeof window !== 'undefined' ? window : globalThis);
