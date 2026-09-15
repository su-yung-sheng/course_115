/* =====================================================================
   課表與停課：算「某一週，這個班有哪幾天上課」
   ---------------------------------------------------------------------
   資料存在 {學期}-config/schedule：

     base : { "星期-節次": "班級" }        例 { "3-2": "801" } = 週三第 2 節上 801
     off  : { "YYYY-MM-DD": ["3-2", …] }   該日期哪幾節停課
     move : { "YYYY-MM-DD": { "3-2": "5-4" } } 該週把某節課調到別的時段

   ★ 為什麼獨立成一支（2026-08-19）
     老師決定「這週有登入但沒拿星 → 60 分，缺席 → 0 分」，
     而「有沒有出席」是照**該班上課日**判定的。
     這件事教師端本來就會算，現在學生端的本週成績卡也要算 ——
     ⚠️ 如果把教師端那段複製一份到 hub，就又多一個「同一個規則兩份實作」。
        這個專案這幾天修的問題幾乎都是這樣來的（星數、加分、週分數）。
     ⇒ 規則只留一份在這裡，兩邊都呼叫。

   ⚠️ 學生端讀得到這份課表嗎？
      {學期}-config 本來只有老師讀得到。shared/firestore.rules 為此開了
      **單筆、唯讀、只限 schedule 這一份**的例外（allow get）。
      改了規則要記得去 Firebase Console 按發布，否則學生端拿到
      permission-denied，症狀是「本週成績卡永遠當成缺席」。
   ===================================================================== */
(function (global) {
  'use strict';

  var PERIODS = 7;                    // 一天七節
  var WEEK_MS = 7 * 86400000;

  /** 這個日期所在那一週的星期一（00:00） */
  function mondayOf(d) {
    var x = new Date(d);
    var wd = (x.getDay() + 6) % 7;    // 星期一 = 0
    x.setHours(0, 0, 0, 0);
    return new Date(x.getTime() - wd * 86400000);
  }

  /** Date → 'YYYY-MM-DD'（用本地時間，和老師看到的日期一致） */
  function key(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /** 這一週的星期 wd（1～5）是幾號 */
  function dateOf(monday, wd) {
    return new Date(monday.getTime() + (wd - 1) * 86400000);
  }

  /**
   * 某一週的某一格是哪個班的課、有沒有停課。
   * ⚠️ 調課（move）是「這一週的事」：move 的鍵是日期，
   *    所以判斷「從別處調來」時，要確認來源那一格的日期也落在同一週，
   *    否則上上週的一次調課會影響到這一週。
   */
  function cellInfo(sched, monday, wd, period) {
    sched = sched || {};
    var base = sched.base || {}, off = sched.off || {}, move = sched.move || {};
    var slot = wd + '-' + period;
    var dateKey = key(dateOf(monday, wd));

    var movedAway = Object.keys(move[dateKey] || {}).some(function (from) {
      return from === slot;
    });

    var movedIn = null;
    Object.keys(move).forEach(function (dk) {
      var mp = move[dk] || {};
      Object.keys(mp).forEach(function (from) {
        if (mp[from] !== slot) return;
        var wdFrom = Number(String(from).split('-')[0]);
        if (key(dateOf(monday, wdFrom)) === dk) movedIn = base[from] || null;
      });
    });

    var cls = movedIn || (movedAway ? null : (base[slot] || null));
    return { cls: cls, off: (off[dateKey] || []).indexOf(slot) >= 0,
             slot: slot, dateKey: dateKey,
             movedIn: !!movedIn, movedAway: movedAway };
  }

  /**
   * 這一週這個班有哪幾天要上課（'YYYY-MM-DD' 陣列，可能不只一天）。
   * 全部停課或那一週沒課 → 空陣列。
   * @param weekStart 那一週裡的任何一天都可以（會自己找星期一）
   */
  function classDatesOfWeek(sched, cls, weekStart) {
    var monday = mondayOf(weekStart);
    var out = [];
    for (var wd = 1; wd <= 5; wd++) {
      for (var p = 1; p <= PERIODS; p++) {
        var info = cellInfo(sched, monday, wd, p);
        if (info.cls === cls && !info.off) {
          var k = key(dateOf(monday, wd));
          if (out.indexOf(k) < 0) out.push(k);
        }
      }
    }
    return out;
  }

  /**
   * 這一週算不算「有出席」：該班上課日裡，有任何一天在 attendance 裡。
   * @param attendance { 'YYYY-MM-DD': 時間戳 }（hub 每日首次登入寫的）
   *
   * ⚠️ 這是「那天有沒有登入系統」，不是點名。
   *    人來了但沒登入 → 算缺席；在家登入但不是上課日 → 也不算。
   *    老師 2026-08-19 選的就是這個定義（比「那週有登入就算」嚴格）。
   */
  function attended(sched, cls, weekStart, attendance) {
    var days = classDatesOfWeek(sched, cls, weekStart);
    var att = attendance || {};
    return days.some(function (d) { return !!att[d]; });
  }

  /**
   * 這一週的分數（老師 2026-08-19 定的規則）
   *   有拿星       → base + 星數 × per（上限 100）
   *   0 星但有出席 → base（人來了、也登入了，只是這節沒拿到星）
   *   0 星又缺席   → 0
   * ⚠️ 學生端與教師端一律呼叫這一支。
   *    「0 星要給幾分」以前兩邊寫的不一樣（學生端 0 分、教師端 60 分），
   *    同一個學生在兩個畫面看到不同分數 —— 這種事發生過太多次了。
   */
  function weekScore(stars, wasHere, base, per) {
    var s = Number(stars) || 0;
    var b = Number(base), p = Number(per);
    if (!isFinite(b)) b = 60;
    if (!isFinite(p)) p = 4;
    if (s > 0) return Math.min(100, b + s * p);
    return wasHere ? b : 0;
  }

  /* ══════════════════════════════════════════════════════════
     模組的開放日（老師 2026-09-15）
     ══════════════════════════════════════════════════════════
     「智慧家居機電專題」11 月底才上，但那張卡從開學就掛在闖關基地上。
     ⇒ 未到開放日就畫成灰色、點不進去，並寫明**預計哪一天開放**。

     ★ 存在 {學期}-config/schedule 的 open_json 欄位（一個 JSON 字串）：
         { "arduino": "2026-11-30" }
       ⚠️ 為什麼硬要塞進 schedule 這一份：學生端讀得到的 config
          **只有 schedule 這一個文件**（見這支開頭的說明）。
          另開一份文件就得改安全規則、重新發布 —— 沒必要。
       ★ 順帶的好處：hub 本來就會讀這份課表，多這個欄位不多花一次讀取。
     ⚠️ 用 JSON 字串而不是巢狀 map：和 roster 的 unlocks_json 同一個作法，
        寫入時一次覆蓋整份，不會有「巢狀欄位各自合併」的意外。

     ⚠️⚠️ 讀不到課表時一律當成**已開放**（見 moduleOpen 的 !d 分支）。
        設定讀失敗就把教材鎖住，是拿學生的課去賭一個設定檔 ——
        寧可讓人看到還沒完成的頁面，也不要整班進不去。
     ⚠️ 這是**把入口藏起來**，不是把頁面鎖起來。知道網址的人照樣打得開，
        和這個系統其他的前端判斷一樣。要真的擋住得做在後端。 */
  function openMap(sched) {
    var raw = (sched || {}).open_json;
    if (!raw) return {};
    try { var o = JSON.parse(raw); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }

  /** 這個模組的開放日（'YYYY-MM-DD'）；沒設定回空字串 */
  function openDateOf(sched, moduleId) {
    var d = openMap(sched)[String(moduleId || '')];
    return (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d : '';
  }

  /** 現在可以進去了嗎？沒設定、設錯、讀不到 → 一律可以。 */
  function moduleOpen(sched, moduleId, now) {
    var d = openDateOf(sched, moduleId);
    if (!d) return true;
    var t = new Date(d + 'T00:00:00');
    if (isNaN(t)) return true;                 // 日期壞掉也不要擋人
    var n = now ? new Date(now) : new Date();
    n.setHours(0, 0, 0, 0);
    return n.getTime() >= t.getTime();         // 當天就算開放
  }

  /** 給學生看的那一句：'預計於 2026/11/30 開放' */
  function openLabel(sched, moduleId) {
    var d = openDateOf(sched, moduleId);
    return d ? ('預計於 ' + d.replace(/-/g, '/') + ' 開放') : '';
  }

  global.SCHEDULE = {
    PERIODS: PERIODS, WEEK_MS: WEEK_MS,
    mondayOf: mondayOf, key: key, dateOf: dateOf,
    cellInfo: cellInfo, classDatesOfWeek: classDatesOfWeek,
    attended: attended, weekScore: weekScore,
    openMap: openMap, openDateOf: openDateOf,
    moduleOpen: moduleOpen, openLabel: openLabel
  };

})(window);
