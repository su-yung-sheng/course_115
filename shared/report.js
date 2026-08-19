/* =====================================================================
   進度回報（單一來源）— 兩學期共用
   ---------------------------------------------------------------------
   所有關卡頁通關時，一律呼叫這裡的函式寫入 `{學期}-progress/{學號}`，
   hub 的 onSnapshot 就會即時亮燈。不要各頁自己拼 Firestore 路徑。

   資料格式見《資料格式規格》：
     modules.{id} = { status, stars, score, level, units, source, updatedAt }
     history[]    = { module, stars, score, at }   ← 用 arrayUnion 追加

   ---------------------------------------------------------------------
   用法：各頁 SDK 版本不同，所以由頁面自己注入 Firestore 函式（一次就好）

     REPORT.configure({ db, doc, getDoc, setDoc, arrayUnion });

   然後在通關時擇一呼叫：

     // ① 單純過關（logic / search / sort / arduino 這種一次性關卡）
     await REPORT.pass('logic', { stars: 3, score: 100 });

     // ② 累加型：每完成一個小單元就累加（ethics 章節、flowchart 單元、
     //    thinking 小關、scratch 關卡）。同一單元重複挑戰只留最好的。
     await REPORT.unit('ethics', '5-2', { star: 3, score: 92 });

   兩者都會自動：算 stars 總和、更新 level、追加 history、算 totalStars。
   ===================================================================== */
(function (global) {
  'use strict';

  // 集合名稱一律由 config.js 決定，這支不寫死任何學期編號
  var CFG = global.CONFIG || {};
  var COL = (CFG.COLLECTIONS && CFG.COLLECTIONS.PROGRESS)
            || ((CFG.TERM || '11501') + '-progress');
  var fb = null;              // { db, doc, getDoc, setDoc, arrayUnion }

  /** 各模組的星數上限（與 hub 的 MODULES[].maxStars 一致） */
  var MAX = {
    ethics: 30,      // 10 章節 × 最多 3 星
    thinking: 20, flowchart: 20, scratch: 30,
    logic: 3, search: 3, sort: 3, arduino: 3
  };

  /** 累加型模組的「小關總數」：全部完成才算整個模組通關
      （只過 1 個章節就顯示「已通關」會誤導學生）*/
  //  各學期的小關數量可能不同，允許 config.js 覆寫（沒寫就用下面的預設）
  var UNITS_TOTAL = Object.assign({
    ethics: 10,     // 8 個小節 + 2 個整章測驗
    thinking: 10,
    flowchart: 10,
    scratch: 10
  }, CFG.UNITS_TOTAL || {});

  /** history 陣列的長度上限：超過就把最舊的丟掉，避免單一文件無限長大。
      （原本另外開一個 quiz_records 集合存闖關紀錄，已併入這裡。）*/
  var HISTORY_CAP = CFG.HISTORY_CAP || 400;

  function configure(deps) { fb = deps; }

  function ready() {
    if (!fb) { console.warn('[REPORT] 尚未 configure()，這次回報略過'); return false; }
    if (!global.SSO || !SSO.sid()) { console.warn('[REPORT] 取不到學號，這次回報略過'); return false; }
    if (global.SSO && SSO.embedded()) return false;   // iframe 內由外層頁負責
    return true;
  }

  function ref() { return fb.doc(fb.db, COL, SSO.sid()); }

  async function readDoc() {
    try {
      var snap = await fb.getDoc(ref());
      return snap.exists() ? (snap.data() || {}) : {};
    } catch (e) { console.error('[REPORT] 讀取進度失敗', e); return {}; }
  }

  /** 把 modules 的 stars 加總成 totalStars */
  function sumStars(modules) {
    var t = 0;
    for (var k in (modules || {})) t += Number(modules[k] && modules[k].stars) || 0;
    return t;
  }

  /** 共用寫入：合併 modules.{id}、追加 history、更新 totalStars */
  async function write(moduleId, patch, historyEntry) {
    if (!ready()) return null;

    var now = Date.now();
    var me  = (global.SSO && SSO.me && SSO.me()) || {};
    var cur = await readDoc();
    var modules = cur.modules || {};

    modules[moduleId] = Object.assign({}, modules[moduleId], patch, {
      source: patch.source || 'auto',
      updatedAt: now
    });

    var payload = {
      studentId: SSO.sid(),
      modules: modules,
      totalStars: sumStars(modules),
      updatedAt: now
    };
    if (me.name) payload.name = me.name;
    if (historyEntry) {
      var entry = Object.assign({ module: moduleId, at: now }, historyEntry);
      var old   = cur.history || [];
      if (old.length >= HISTORY_CAP) {
        // 滿了就整批重寫：留最新的 CAP-1 筆再接上這次（arrayUnion 只能加不能刪）
        old = old.slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
        payload.history = old.slice(old.length - (HISTORY_CAP - 1)).concat([entry]);
      } else {
        payload.history = fb.arrayUnion(entry);
      }
    }

    try {
      await fb.setDoc(ref(), payload, { merge: true });   // ★ 一定要 merge
      return modules[moduleId];
    } catch (e) {
      console.error('[REPORT] 寫入進度失敗', e);
      return null;
    }
  }

  /**
   * ① 一次性關卡通關
   * @param {string} moduleId  ethics / thinking / flowchart / scratch / logic / search / sort / arduino
   * @param {Object} opts      { stars, score, status, link }
   */
  async function pass(moduleId, opts) {
    opts = opts || {};
    var stars = Math.min(Number(opts.stars) || 0, MAX[moduleId] || 3);
    return write(moduleId, {
      status: opts.status || (stars > 0 ? 'pass' : 'in-progress'),
      stars:  stars,
      score:  (opts.score === undefined ? undefined : Number(opts.score)),
      link:   opts.link
    }, { stars: stars, score: Number(opts.score) || 0 });
  }

  /**
   * ② 累加型：完成一個小單元
   *    同一單元重複挑戰只保留最佳成績；stars 為各單元最佳星數的總和。
   * @param {string} moduleId
   * @param {string} unitId   章節或關卡代號，例如 '5-2'、'2-1-1'
   * @param {Object} opts     { star: 0–3, score: 0–100 }
   */
  async function unit(moduleId, unitId, opts) {
    if (!ready()) return null;
    opts = opts || {};

    var star  = Number(opts.star)  || 0;
    var score = Number(opts.score) || 0;
    // opts.extra：這次挑戰的額外資訊（耗時、答對題數…），只寫進 history 供事後檢視，
    // 不影響星數與通關判定。原本存在 quiz_records 集合的欄位就是走這裡。
    var extra = opts.extra || {};

    var cur  = await readDoc();
    var mod  = (cur.modules && cur.modules[moduleId]) || {};
    var best = Object.assign({}, mod.units);      // { '5-1': {star, score}, ... }

    var prev = best[unitId];
    // 只在更好時才覆蓋（避免重考考差把星星洗掉）
    if (!prev || star > (prev.star || 0) || (star === (prev.star || 0) && score > (prev.score || 0))) {
      best[unitId] = { star: star, score: score };
    }

    var total = 0, done = 0, sumScore = 0;
    for (var k in best) {
      total += Number(best[k].star) || 0;
      sumScore += Number(best[k].score) || 0;
      if ((Number(best[k].star) || 0) > 0) done++;
    }
    var cap   = MAX[moduleId] || 3;
    var need  = UNITS_TOTAL[moduleId] || 1;

    // ★ 只有「全部小關都完成」才算整個模組通關；
    //   做了一部分是「進行中」，一關都沒過是「尚未開始」。
    var status = done >= need ? 'pass' : (done > 0 ? 'in-progress' : 'todo');

    return write(moduleId, {
      status: status,
      units:  best,
      level:  done,
      total:  need,
      stars:  Math.min(total, cap),
      score:  done ? Math.round(sumScore / done) : 0
    }, Object.assign({ stars: star, score: score, unit: unitId }, extra));
  }

  /**
   * ③ 逐題統計：把這一次挑戰的 { 題id: {n, ok} } 累加進去。
   *
   * ★ 為什麼要獨立一支，不塞進 unit()
   *   unit() 是「成績」—— 只留最好的一次、會影響星數與通關。
   *   統計是「次數」—— 永遠累加、不影響任何判定，
   *   而且累積答錯太多被導去學習警示的人**沒有成績卻最需要被統計到**。
   *   兩件事的合併規則不一樣，混在一起遲早會有人把統計也寫成「取最好」。
   *
   * ⚠️ 這裡不寫 history、不動 stars、不動 status —— 只加 qstat 這一格。
   */
  async function qstat(moduleId, add) {
    if (!ready() || !global.QSTAT) return null;
    if (!add || !Object.keys(add).length) return null;
    var cur = await readDoc();
    var mod = (cur.modules && cur.modules[moduleId]) || {};
    return write(moduleId, { qstat: global.QSTAT.merge(mod.qstat, add) });
  }

  /** 讀出某模組目前的狀態（畫面要顯示已通關單元時用） */
  async function get(moduleId) {
    if (!ready()) return null;
    var cur = await readDoc();
    return (cur.modules && cur.modules[moduleId]) || null;
  }

  /**
   * 讀出闖關紀錄（原本存在 quiz_records 集合的東西，現在就是 history）
   * @param {string} moduleId  只取這個模組的紀錄
   * @param {string} [unitId]  再限定某個單元／章節；省略就取整個模組
   * @returns {Promise<Array>} 由新到舊排序
   */
  async function history(moduleId, unitId) {
    if (!ready()) return [];
    var cur = await readDoc();
    return (cur.history || [])
      .filter(function (h) {
        return h.module === moduleId && (unitId === undefined || unitOf(h) === unitId);
      })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }

  /* ── 舊資料相容 ───────────────────────────────────────────
     ★ 2026-08-19 老師回報：「11501 資訊倫理學習系統小卡顯示三星，
       點進去卻沒看到那一個單元獲得？」

     ⚠️ 病根：2026-08-11 以前的舊章節測驗頁
        （_archive/2026-08-11-舊版章節測驗頁/11501_cyberethics.html）
        寫進 11501-progress 的是

          modules.ethics = { status, score, stars, level, source, updatedAt }

        **沒有 units**。「哪一章過了」它存在另一個集合 quiz_records，
        而且是用「班級＋座號＋姓名」比對，不是用學號。
        新的 quiz-engine 只認 modules.{id}.units ——
        於是 hub 讀 stars（有 3 顆）、章節頁讀 units（空的），
        兩邊各說各話。

     ★ 幸好章節資訊沒有全丟：history 那一筆帶著 chapter。
       欄位名不同（舊 chapter／新 unit），所以上面 unitOf() 兩個都認。 */
  function unitOf(h) { return h && (h.unit || h.chapter); }

  /**
   * 從 history 把 units 補回來（只在 units 是空的時候做）。
   * @param {string}   moduleId
   * @param {Function} starOf  分數 → 星數（由呼叫端給，例如 GRADING.ethicsStar）
   * @returns {Promise<Object|null>} 補完的模組資料；沒東西可補則回 null
   */
  async function backfillUnits(moduleId, starOf) {
    if (!ready() || typeof starOf !== 'function') return null;
    var cur = await readDoc();
    var mod = (cur.modules && cur.modules[moduleId]) || {};
    if (mod.units && Object.keys(mod.units).length) return mod;   // 有就不要動

    /* ⚠️ 這裡**只能用 score 重算星數，不可以抄 history 的 stars**。
       舊頁面那個欄位存的是「這次比上次多拿幾顆」（變數就叫 gained），
       同一章重考第二次通常是 0 —— 直接抄會把三星章節記成 0 星。
       這種欄位最危險：名字對、型別對、數字看起來也很合理。 */
    var best = {};
    (cur.history || []).forEach(function (h) {
      if (h.module !== moduleId) return;
      var id = unitOf(h);
      if (!id) return;
      var sc = Number(h.score) || 0;
      if (!(id in best) || sc > best[id]) best[id] = sc;
    });

    var ids = Object.keys(best);
    if (!ids.length) return null;              // 連 history 都沒有，救不回來

    var units = {}, total = 0, done = 0, sumScore = 0;
    ids.forEach(function (id) {
      var st = Number(starOf(best[id])) || 0;
      units[id] = { star: st, score: best[id] };
      total += st; sumScore += best[id];
      if (st > 0) done++;
    });

    /* ⚠️ 星數只准往上，不准往下。
       history 有長度上限（HISTORY_CAP），而且是後來才開始寫的 ——
       它不是完整的歷史，重算出來的總星數**可能比實際少**。
       學生看到星星變少會以為系統把成績吃掉了，那比「明細不全」嚴重得多。
       ⇒ 補 units 是為了讓畫面對得起來，不是為了重新打分數。 */
    var cap  = MAX[moduleId] || 3;
    var keep = Number(mod.stars) || 0;
    var need = UNITS_TOTAL[moduleId] || 1;

    return write(moduleId, {
      units:  units,
      level:  Math.max(Number(mod.level) || 0, done),
      total:  need,
      stars:  Math.max(keep, Math.min(total, cap)),
      score:  done ? Math.round(sumScore / done) : (Number(mod.score) || 0),
      backfilled: true          // ← 留個記號，之後查資料看得出來這是補的
    });
  }

  global.REPORT = {
    configure: configure,
    pass: pass,
    unit: unit,
    qstat: qstat,
    get: get,
    history: history,
    backfillUnits: backfillUnits,
    MAX: MAX,
    UNITS_TOTAL: UNITS_TOTAL,
    COLLECTION: COL
  };
})(window);
