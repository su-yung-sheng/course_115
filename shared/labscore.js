/* =====================================================================
   5016B 智慧家居機電專題：成績與開放規則（老師 2026-11-24）
   ---------------------------------------------------------------------
   ★ 這是**另一個成績**，不跟星星合計（作品星、概念星、每週評分都不受影響）。
     百分制，滿分 100（老師 2026-11-24 第二版：每一節都有 Classroom 作業、都要實作驗收）：
       第 1～4 節  各 15 分 ＝ 暖身 3 ＋ 動手檢核 6 ＋ 老師實作驗收 6
       第 5 節     40 分   ＝ 設計單 10 ＋ 成果卡 15 ＋ 老師實作驗收 15
   ★ 實作驗收在「5016B 繳交審核」頁（shared/labreview.html）看 Classroom 繳交後打勾、或退件；
     教師端「🔧 5016B 專題」進度表也可以直接打勾。兩邊寫的是同一格。
   ★ 依序開放：前一節**老師通關**（實作驗收打勾）才開下一節。
     ⚠️ 2026-11-25 老師改：原本是「暖身＋檢核都過就開」，教師端會看到「第 1 節待檢查、第 2 節已經開了」——
        老師要的是：檢查過學生的程式和裝置、按了通關，下一節才開。
     老師可以手動放行到第 n 節（卡住、斷網沒寫進去的時候）。
   ★ 規則只有這一份：5016b.html（學生頁）、hub.html（專題卡）、teacher.html（進度表）都呼叫這裡。

   資料在哪裡
     · 學生做到哪：{學期}-progress/{學號}.modules.arduino.{u1…u5}.{warm|checks|say|plan|work}
       （5016b.html 的 LABSAVE 寫的，學生自己寫得動 —— 和其他模組一樣是前端判定）
     · 老師的放行、實作驗收、退件：roster/{學號}.arduino_json ＝
         '{"open":3,"ok":{"u1":{"at":…,"by":…}},"rej":{"u2":{"reason":…,"at":…}}}'
       ⚠️ 放在名冊：名冊只有老師寫得動，學生改不了驗收和放行。
   ⚠️ 不寫 stars、不寫 status —— 專題卡的 maxStars 是 0，寫了星星總進度會超過 100%。
   ===================================================================== */
(function (global) {
  'use strict';

  var LESSONS = ['u1', 'u2', 'u3', 'u4', 'u5'];
  var POINTS = {
    u1: { warm: 3, checks: 6, verify: 6 },
    u2: { warm: 3, checks: 6, verify: 6 },
    u3: { warm: 3, checks: 6, verify: 6 },
    u4: { warm: 3, checks: 6, verify: 6 },
    u5: { warm: 10, checks: 15, verify: 15 }
  };
  /* 每一節的名稱（＝5016b.html 卡片標題，測試會比對）與 Classroom 作業名稱裡的「專題一～五」。
     老師的作業名稱長這樣：「2026/11/27 專題一：感應大門：超音波與馬達」 */
  var TITLES = {
    u1: '感應大門：超音波與馬達', u2: '迎賓走廊：超音波與燈條', u3: '無段風扇：可變電阻與馬達',
    u4: '情境照明：可變電阻與燈條', u5: '自己的專案：從想法到成果'
  };
  var NUM_ZH = { u1: '一', u2: '二', u3: '三', u4: '四', u5: '五' };
  var PART_NAME = { warm: '暖身', checks: '動手檢核', verify: '老師實作驗收' };
  var U5_NAME = { warm: '設計單', checks: '成果卡', verify: '老師實作驗收' };

  /** 名冊那一筆 → { open: 老師放行到第幾節（0＝沒放行）, ok: { u1: {at,by} }, rej: { u2: {reason,at} } } */
  function fromRoster(roster) {
    var raw = roster && roster.arduino_json, o = {};
    if (raw) { try { o = JSON.parse(raw) || {}; } catch (e) { o = {}; } }
    var open = Math.max(0, Math.min(LESSONS.length, Math.floor(Number(o.open) || 0)));
    var ok = (o.ok && typeof o.ok === 'object') ? o.ok : {};
    var rej = (o.rej && typeof o.rej === 'object') ? o.rej : {};
    return { open: open, ok: ok, rej: rej };
  }
  /** Classroom 作業名稱裡找這一節用的字：先比整個標題，再比「專題一」 */
  function workIds(u) { return [TITLES[u], '專題' + NUM_ZH[u]].filter(Boolean); }

  /** 這一節完成了沒（暖身＋檢核都過）。第 5 節不需要老師驗收也算「完成」—— 驗收只影響分數。 */
  function lessonDone(arduino, u) {
    var r = (arduino || {})[u] || {};
    return !!(r.warm && r.checks);
  }

  /** 分數。arduino ＝ modules.arduino；info ＝ fromRoster(名冊) */
  function score(arduino, info) {
    arduino = arduino || {};
    info = info || { open: 0, ok: {} };
    var parts = {}, total = 0, done = 0;
    LESSONS.forEach(function (u) {
      var r = arduino[u] || {}, pts = POINTS[u], got = 0, max = 0, row = {};
      Object.keys(pts).forEach(function (k) {
        var has = k === 'verify' ? !!(info.ok && info.ok[u]) : !!r[k];
        row[k] = has;
        max += pts[k];
        if (has) got += pts[k];
      });
      row.pts = got; row.max = max; row.done = lessonDone(arduino, u);
      if (row.done) done++;
      parts[u] = row;
      total += got;
    });
    return { total: total, max: 100, done: done, parts: parts };
  }

  /** 這一節老師通關了沒（＝實作驗收打勾，名冊 arduino_json.ok.uN） */
  function passed(info, u) { return !!(info && info.ok && info.ok[u]); }

  /** 學生可以進到第幾節（1～5）：第 1 節一定開；前一節**老師通關**才開下一節；老師放行取較大；備課模式全開。
      ★ 2026-11-25 老師：「要老師通關才開下一節」（原本是暖身＋檢核過了就開）。 */
  function openUpTo(arduino, info, openAll) {
    if (openAll) return LESSONS.length;
    var n = 1;
    for (var i = 0; i < LESSONS.length - 1; i++) {
      if (passed(info, LESSONS[i])) n = i + 2; else break;
    }
    return Math.max(n, Math.min(LESSONS.length, (info && info.open) || 0));
  }

  /** 專題卡、闖關基地用的狀態：todo／in-progress／pass（滿分才算 pass） */
  function status(arduino, info) {
    var s = score(arduino, info);
    if (s.total >= s.max) return 'pass';
    var any = LESSONS.some(function (u) { var r = (arduino || {})[u] || {}; return r.warm || r.checks || r.say || r.plan || r.work; });
    return any || s.total > 0 ? 'in-progress' : 'todo';
  }

  /** 鎖住的原因。有給 arduino 的話分兩種：前一節還沒做完／做完了在等老師通關。 */
  function lockText(no, arduino) {
    var prev = LESSONS[no - 2];
    if (arduino && prev && lessonDone(arduino, prev))
      return '⏳ 第 ' + (no - 1) + ' 節等老師檢查實作 —— 老師按「通關」後才會開放第 ' + no + ' 節';
    return '🔒 第 ' + (no - 1) + ' 節要先完成（暖身＋動手檢核＋老師通關）才會開放第 ' + no + ' 節';
  }

  function partName(u, k) { return (u === 'u5' ? U5_NAME : PART_NAME)[k] || k; }

  var api = { LESSONS: LESSONS, POINTS: POINTS, TITLES: TITLES, NUM_ZH: NUM_ZH, workIds: workIds,
              fromRoster: fromRoster, lessonDone: lessonDone, passed: passed,
              score: score, openUpTo: openUpTo, status: status, lockText: lockText, partName: partName };
  try {
    Object.keys(POINTS).forEach(function (k) { Object.freeze(POINTS[k]); });
    Object.freeze(POINTS); Object.freeze(LESSONS); Object.freeze(TITLES); Object.freeze(NUM_ZH); Object.freeze(api);
  } catch (e) {}
  global.LABSCORE = api;
})(typeof window !== 'undefined' ? window : globalThis);
