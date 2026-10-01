/* =====================================================================
   可疑紀錄偵測（教師端「🔍 可疑紀錄」用）—— 純邏輯，不碰畫面、不碰資料庫
   ---------------------------------------------------------------------
   ★ 為什麼有這一支（老師 2026-09-27：「如何防止類似 Tampermonkey 的攻擊？」）
     在瀏覽器裡**擋不住**使用者腳本：送到學生瀏覽器的東西都讀得到，
     瀏覽器送出去的東西也都能偽造。擋不住的東西至少要**看得到**。
     這一支只做「比對」，不擋任何人、不改任何資料。

   ★ 兩種比對，各自對應一條真的存在的偽造路徑：

     ① Scratch 星星 ↔ 後端的批改紀錄
        星星是**學生的瀏覽器**寫進 {學期}-progress 的（grader.html 的
        reportScratch）。在主控台打一行
            reportScratch(學號, '2-1-3', 100)
        就有 3⭐，而且寫出來的形狀和真的一模一樣。
        但批改紀錄 {學期}-scratch-submissions 是**後端用服務帳戶**寫的，
        學生寫不進去（規則：只有老師）。
        ⇒ 每一顆星都應該找得到一筆「分數夠」的批改紀錄。找不到就標出來。

     ② 章節測驗的作答過程
        quiz-engine.js 通關時**一定**會把耗時（duration）和每題秒數（pace）
        一起寫進 history。直接呼叫 REPORT.unit(…) 寫進去的那一筆不會有。
        ⇒ 沒有作答過程的通關紀錄，就不是從測驗畫面來的。
        另外沿用教師端原本的判斷：連最慢的一題都在 1 秒內 ＝ 像腳本。

   ⚠️⚠️ 這些都是「提醒你去看」，**不是判定**。
     · 後端當時寫紀錄失敗（Firestore 忙線）也會變成「找不到紀錄」
     · 老師在教師端手動改的星星也可能對不上
     ⇒ 畫面上一律寫成「值得看一下」，不要寫成「作弊」。

   用法（瀏覽器與 node 都能跑）：
     AUDIT.scratch(progressById, submissions, GRADING) → [發現…]
     AUDIT.quiz(progressById)                          → [發現…]
     AUDIT.isRobotPace(pace)                           → true／false
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-09-27-audit';

  /* 測驗引擎開始一定寫 duration 的日子之後，才用「沒有作答過程」判斷。
     更早的舊版頁面（2026-08-11 以前）寫的是 chapter 格式，本來就沒有這些欄位 ——
     拿它們來判會冤枉人。 */
  var TRACE_SINCE = Date.UTC(2026, 7, 18);   // 2026-08-18（月份從 0 起算）

  /** 批改紀錄是哪一關。
      2026-09-16 以前的紀錄沒有 unit 欄位，關卡代號塞在 theme 的開頭「[2-1-1B] …」。 */
  function unitOfSubmission(s) {
    if (!s) return '';
    var u = String(s.unit || '').trim();
    if (u) return u;
    var m = String(s.theme || '').match(/^\s*\[([^\]]+)\]/);
    return m ? m[1].trim() : '';
  }

  /** 每位學生、每一關，後端批改過的最高分。 */
  function bestGraded(submissions) {
    var best = {};
    (submissions || []).forEach(function (s) {
      if (!s) return;
      var sid = String(s.student_id || '').trim();
      var unit = unitOfSubmission(s);
      var sc = Number(s.score);
      if (!sid || !unit || s.score == null || !isFinite(sc)) return;
      var b = (best[sid] = best[sid] || {});
      b[unit] = b[unit] == null ? sc : Math.max(b[unit], sc);
    });
    return best;
  }

  /**
   * ① Scratch：每一顆星都要找得到分數夠的批改紀錄。
   * @param {Object} progressById  學號 → {學期}-progress 文件
   * @param {Array}  submissions   {學期}-scratch-submissions 的每一筆
   * @param {Object} grading       shared/grading.js 的 GRADING（星等規則只有那一份）
   */
  function scratch(progressById, submissions, grading) {
    var out = [];
    if (!grading || typeof grading.scratchStar !== 'function') return out;
    var best = bestGraded(submissions);
    Object.keys(progressById || {}).forEach(function (sid) {
      var doc = progressById[sid] || {};
      var m = ((doc.modules || {}).scratch) || {};
      var stars = m.unitStars || {};
      var scores = m.unitScores || {};
      Object.keys(stars).forEach(function (unit) {
        var star = Number(stars[unit]) || 0;
        if (star <= 0) return;                       // 沒有星星就沒有要對的
        var claimed = scores[unit] != null ? Number(scores[unit]) : null;
        var g = best[sid] && best[sid][unit] != null ? best[sid][unit] : null;
        var kind = null;
        if (g == null) kind = 'no-record';
        else if (grading.scratchStar(g) < star) kind = 'star-exceeds';
        else if (claimed != null && claimed > g) kind = 'score-exceeds';
        if (!kind) return;
        out.push({ sid: sid, unit: unit, star: star, score: claimed,
                   graded: g, kind: kind });
      });
    });
    return out;
  }

  /** 連最慢的一題都在 1 秒內（而且題數夠多）—— 和教師端學生面板用同一條。
      ⚠️ 真的很熟的學生也可能很快，所以不看平均、看最慢那一題：
         人一定有長尾，腳本每題都一樣快。 */
  function isRobotPace(p) {
    return !!(p && p.max != null && Number(p.max) <= 1 && (Number(p.n) || 0) >= 5);
  }

  /** 這一筆 history 是不是章節測驗的通關紀錄。 */
  function isQuizEntry(h) {
    return !!(h && h.module === 'ethics');
  }

  /**
   * ② 章節測驗：沒有作答過程的通關紀錄、像腳本的作答速度。
   * @param {Object} progressById  學號 → {學期}-progress 文件
   */
  function quiz(progressById) {
    var out = [];
    Object.keys(progressById || {}).forEach(function (sid) {
      var hist = (progressById[sid] || {}).history || [];
      hist.forEach(function (h) {
        if (!isQuizEntry(h)) return;
        var unit = h.unit || h.chapter || '';
        var at = Number(h.at) || 0;
        if (isRobotPace(h.pace)) {
          out.push({ sid: sid, unit: unit, at: at, kind: 'robot', pace: h.pace,
                     score: h.score });
          return;
        }
        var oldFormat = !!h.chapter;                 // 舊版頁面寫的，本來就沒有過程
        var traced = h.duration != null || h.pace != null;
        if (!traced && !oldFormat && at >= TRACE_SINCE) {
          out.push({ sid: sid, unit: unit, at: at, kind: 'no-trace',
                     score: h.score, got: h.got });
        }
      });
    });
    return out;
  }

  /**
   * ③ 四步切換的第 ②步：後端星星（scratchVerified）和前端星星（modules.scratch）核對。
   *
   * ★ 後端是從「上線那一刻」才開始記，前端從開學就在記 ——
   *   所以**後端 ≤ 前端是正常的**（舊的星星後端沒看過）。
   *   要看的是反過來：後端記到的星星比前端多，代表**前端那一次沒寫進去**
   *   （網路斷、規則擋、或 11502 那種寫錯集合的 bug）。
   * 回傳 { students, units, gradings, behind: [{sid, unit, front, back}] }
   */
  function verified(progressById) {
    var out = { students: 0, units: 0, gradings: 0, behind: [] };
    Object.keys(progressById || {}).forEach(function (sid) {
      var doc = progressById[sid] || {};
      var v = doc.scratchVerified;
      if (!v || !v.unitStars) return;
      out.students++;
      out.gradings += (v.gains || []).length;
      var front = (((doc.modules || {}).scratch) || {}).unitStars || {};
      Object.keys(v.unitStars).forEach(function (unit) {
        out.units++;
        var b = Number(v.unitStars[unit]) || 0, f = Number(front[unit]) || 0;
        if (b > f) out.behind.push({ sid: sid, unit: unit, front: f, back: b });
      });
    });
    return out;
  }

  /**
   * ④ 程式錄影已加分、但這一關程式**現在**還不到 3⭐（老師 2026-10-01：
   *    「有沒有之前不小心程式二星加到分的」）。
   *
   * ★ 10-01 起審核頁不到 3⭐ 就不給加分；這一支找的是**之前**給出去的。
   * ★ 看的是「現在」的星數：當時 2⭐、之後重交拿到 3⭐ 的，已經符合規則，不列。
   * ⚠️ 只列出來給老師看；要不要收回加分由老師決定（審核頁點「已加分」可以取消）。
   * 回傳 [{ sid, unit, stars, at, by }]
   */
  function vidShort(progressById, G) {
    var need = (G && G.VID_NEED_STARS) || 3, out = [];
    Object.keys(progressById || {}).forEach(function (sid) {
      var scr = (((progressById[sid] || {}).modules) || {}).scratch || {};
      var vid = scr.vidUnits || {}, stars = scr.unitStars || {};
      Object.keys(vid).forEach(function (unit) {
        if (!vid[unit]) return;
        var s = Number(stars[unit]) || 0;
        if (s < need) out.push({ sid: sid, unit: unit, stars: s,
                                 at: Number(vid[unit].at) || 0, by: String(vid[unit].by || '') });
      });
    });
    return out;
  }

  global.AUDIT = {
    VERSION: VERSION,
    vidShort: vidShort,
    TRACE_SINCE: TRACE_SINCE,
    unitOfSubmission: unitOfSubmission,
    bestGraded: bestGraded,
    scratch: scratch,
    quiz: quiz,
    isRobotPace: isRobotPace,
    verified: verified
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.AUDIT;
})(typeof window !== 'undefined' ? window : this);
