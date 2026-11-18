/* =====================================================================
   下學期闖關路線：依進度解鎖（老師 2026-11-18 定案）
   ---------------------------------------------------------------------
   一律從程式設計開始，閱讀測驗（媒體與社會議題）和運算思維依程式進度分段開放：

     Stage 1 🎨 程式小畫家：程式 1～4 關
     Stage 2 📊 排序大師  ：先做 運算思維任選 5 題＋閱讀 6-2 → 再做 程式 5～7 關
     Stage 3 🔍 搜尋偵探  ：先做 運算思維剩下 5 題＋閱讀 6-1、6-3 → 再做 程式 8～10 關＋閱讀第五章
     Final   🏆 總複習    ：兩個整章挑戰（Stage 3 全部完成才開）

   ★ 路線的內容（哪幾關、幾題、哪幾節）寫在各學期 config.js 的 ROUTE，
     這一支只負責判斷 —— 闖關基地、程式關卡頁、閱讀測驗、運算思維、教師端
     **全部呼叫同一個 evaluate()**，規則只有一份。
   ★ 沒有 ROUTE 的學期（11501）一律回 null ＝ 不套路線，頁面照舊。
   ★ 備課模式（GRADING.openAll，config.js 的 OPEN_ALL_UNITS）期間全部開放。
   ⚠️ 這是前端的鎖，和既有的「前一關要通關」同一層：擋得住一般操作，擋不住改程式的人。
      老師的放行旗標（stage_pass）存在名冊 roster/{學號}，只有老師寫得動。

   「完成」的定義：
     · 程式：程式 ≥ GATE.PASS_STARS（2⭐ ＝ 75 分）；不交作品的關（GATE.NO_UPLOAD）＝實作體驗做完
     · 閱讀測驗：該小節（或整章挑戰）≥ 1⭐
     · 運算思維：完成題數（題號任選）
   ===================================================================== */
(function (global) {
  'use strict';

  function G() { return global.GRADING || null; }

  /** 這一關程式算不算完成 */
  function unitDone(id, d) {
    var g = G(), need = (g && g.GATE && g.GATE.PASS_STARS) || 2;
    var noUp = g && g.GATE && g.GATE.needsUpload ? !g.GATE.needsUpload(id) : false;
    if (noUp) return !!(d.play || {})[id];
    return (Number((d.unitStars || {})[id]) || 0) >= need;
  }
  function secDone(id, d) { return (Number((d.secStars || {})[id]) || 0) >= 1; }

  function unitLabel(id, units) {
    for (var i = 0; i < (units || []).length; i++) {
      if (units[i][0] === id) return '程式第 ' + (i + 1) + ' 關';
    }
    return '程式 ' + id;
  }

  /**
   * @param route  config.js 的 ROUTE
   * @param d      { unitStars, play, thinking（完成題數）, secStars, stagePass（老師放行到第幾個 Stage）, openAll }
   * @param units  config.js 的 UNITS（顯示「程式第 N 關」用）
   * @returns null（沒有路線）或
   *   { stage, stageInfo, done:{1:bool,…}, final:{open,done},
   *     units:{id:true}（路線允許進入的程式關卡）, assumeCleared:{id:true}（老師放行 ⇒ 前面的關卡當作已通過）,
   *     thinkingMax（運算思維最多可以做到第幾題）, sections:{id:true}（開放的閱讀小節／整章挑戰）,
   *     next:{ title, missing:[…] }（下一道門還差什麼；全部開完是 null）,
   *     openAll, stagePass }
   */
  function evaluate(route, d, units) {
    if (!route || !route.stages || !route.stages.length) return null;
    d = d || {};
    var S = route.stages, pass = Number(d.stagePass) || 0;
    var out = { stage: 1, stageInfo: S[0], done: {}, final: { open: false, done: false },
                units: {}, assumeCleared: {}, thinkingMax: 0, sections: {},
                next: null, openAll: !!d.openAll, stagePass: pass };
    var thinkingCount = Number(d.thinking) || 0;
    var allUnits = [], allSecs = [];
    S.forEach(function (s) {
      allUnits = allUnits.concat(s.units || []);
      allSecs = allSecs.concat(s.sections || [], s.extraSections || []);
    });
    var challenges = (route.final && route.final.challenges) || [];

    if (out.openAll) {
      allUnits.forEach(function (u) { out.units[u] = true; });
      allSecs.concat(challenges).forEach(function (x) { out.sections[x] = true; });
      out.thinkingMax = Infinity;
      out.final.open = true;
    }

    var reached = true;          // 這個 Stage 的門開了沒
    for (var i = 0; i < S.length; i++) {
      var s = S[i], no = i + 1;
      // 老師放行到第 pass 個 Stage ⇒ 之前的 Stage 一律當作完成，這一個 Stage 的門打開
      var passed = no < pass, forced = no <= pass;
      if (!reached && !forced) break;
      out.stage = no; out.stageInfo = s;

      // ── 先做：運算思維上限、閱讀小節 ──
      if ((s.thinking || 0) > out.thinkingMax) out.thinkingMax = s.thinking;
      (s.sections || []).forEach(function (x) { out.sections[x] = true; });

      // ── 再做：程式（Stage 1 沒有「先做」，直接開）──
      var needT = s.thinking || 0;
      var preMissing = [];
      if (thinkingCount < needT) preMissing.push('運算思維再完成 ' + (needT - thinkingCount) + ' 題（目前 ' + thinkingCount + '／' + needT + '）');
      (s.sections || []).forEach(function (x) {
        if (!secDone(x, d)) preMissing.push('閱讀測驗 ' + x + ' 至少 1⭐');
      });
      var preOk = !preMissing.length || passed;
      if (preOk) {
        (s.units || []).forEach(function (u) { out.units[u] = true; });
        (s.extraSections || []).forEach(function (x) { out.sections[x] = true; });
      }

      // ── 這個 Stage 完成了沒 ──
      var unitMissing = (s.units || []).filter(function (u) { return !unitDone(u, d); });
      out.done[no] = preOk && !unitMissing.length;
      if (passed) {
        (s.units || []).forEach(function (u) { out.assumeCleared[u] = true; });
      }

      if (!preOk && !out.next) {
        out.next = { title: (s.icon || '') + ' Stage ' + no + ' 的程式關卡', missing: preMissing };
      } else if (preOk && unitMissing.length && !passed && !out.next) {
        var nxt = S[i + 1];
        out.next = { title: nxt ? ((nxt.icon || '') + ' Stage ' + (no + 1) + ' ' + nxt.name)
                                : ((route.final.icon || '') + ' ' + route.final.name),
                     missing: unitMissing.map(function (u) {
                       var g = G(), noUp = g && g.GATE && g.GATE.needsUpload && !g.GATE.needsUpload(u);
                       return unitLabel(u, units) + (noUp ? ' 完成實作體驗' : ' 達到 2⭐');
                     }) };
      }
      reached = out.done[no] || passed;
    }

    // ── Final：最後一個 Stage 完成，而且全部小節都 ≥1⭐ ──
    var lastDone = !!out.done[S.length] || pass > S.length;
    var secMissing = allSecs.filter(function (x) { return !secDone(x, d); });
    if (lastDone && (!secMissing.length || pass > S.length)) {
      out.final.open = true;
      out.stage = S.length + 1; out.stageInfo = route.final;
    } else if (lastDone && !out.next) {
      out.next = { title: (route.final.icon || '') + ' ' + route.final.name,
                   missing: secMissing.map(function (x) { return '閱讀測驗 ' + x + ' 至少 1⭐'; }) };
    }
    if (out.final.open) challenges.forEach(function (x) { out.sections[x] = true; });
    out.final.done = out.final.open && challenges.every(function (x) { return secDone(x, d); });
    if (out.openAll) out.next = null;
    return out;
  }

  /** 從 {學期}-progress 的文件（＋名冊）整理出 evaluate 要的資料 */
  function fromProgress(doc, roster, cfg) {
    var m = (doc && doc.modules) || {};
    var sc = m.scratch || {}, th = m.thinking || {}, et = m.ethics || {};
    var secStars = {};
    var eu = et.units || {};
    for (var k in eu) if (Object.prototype.hasOwnProperty.call(eu, k)) secStars[k] = Number((eu[k] || {}).star) || 0;
    // 運算思維：11502 走 REPORT.unit（units），舊資料可能只有 history／level —— 和 GRADING.moduleStars 同一個數法
    var seen = {}, cnt = 0;
    var mark = function (id) { if (id != null && !seen[String(id)]) { seen[String(id)] = 1; cnt++; } };
    var tu = th.units || {};
    for (var t in tu) if (Object.prototype.hasOwnProperty.call(tu, t) && (Number((tu[t] || {}).star) || 0) > 0) mark(t);
    ((doc && doc.history) || []).forEach(function (h) {
      if (h && h.module === 'thinking') mark(h.challenge != null ? h.challenge : h.unit);
    });
    cnt = Math.max(cnt, Number(th.level) || 0);
    var g = G();
    return {
      unitStars: sc.unitStars || {}, play: sc.play || {},
      thinking: cnt, secStars: secStars,
      stagePass: Number((roster || {}).stage_pass) || 0,
      openAll: !!(g && g.openAll && g.openAll(cfg || global.CONFIG))
    };
  }

  /** 一步到位：給頁面用 */
  function forDoc(doc, roster, cfg) {
    cfg = cfg || global.CONFIG || {};
    if (!cfg.ROUTE) return null;
    return evaluate(cfg.ROUTE, fromProgress(doc, roster, cfg), cfg.UNITS);
  }

  /** 程式關卡：路線允許進到第幾關（1 起算；沒有路線或備課模式 ⇒ Infinity）。
      units 可以是 config 的 [[id,名稱]…]，也可以是頁面的 [{id,no}…]。
      ⚠️ 只是「路線」這一道門；「前一關要通關」那一道還是 GATE.openUpTo，頁面取兩者較小的。 */
  function unitCap(rt, units) {
    if (!rt || rt.openAll) return Infinity;
    var n = 0;
    for (var i = 0; i < (units || []).length; i++) {
      var id = units[i].id || units[i][0];
      if (rt.units[id]) n++; else break;
    }
    return n;
  }

  /** 給學生看的一句話：「🔒 📊 Stage 2 的程式關卡：還差 運算思維再完成 5 題、閱讀測驗 6-2 至少 1⭐」 */
  function lockText(rt) {
    if (!rt || !rt.next) return '';
    return '🔒 ' + rt.next.title + '：還差 ' + rt.next.missing.join('、');
  }

  global.ROUTE = { evaluate: evaluate, fromProgress: fromProgress, forDoc: forDoc, unitDone: unitDone,
                   unitCap: unitCap, lockText: lockText };
})(typeof window !== 'undefined' ? window : globalThis);
