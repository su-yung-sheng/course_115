/* =====================================================================
   全站共用計分規則（單一來源 Single Source of Truth）
   ---------------------------------------------------------------------
   ★ 只要修改這個檔案，「學生端」與「教師端一鍵重算星星」都會自動套用。
   ★ 學生端(cyberethics.html / thinking.html) 與
     教師端(teacher.html) 都以 <script src="grading.js"></script>
     載入，並呼叫 window.GRADING 內的函式，不要在各頁自行寫死門檻。
   ===================================================================== */
window.GRADING = {
  // 資訊倫理：依「單一章節最佳正確率(%)」給星（各章累加）
  //   三星 ≥ 90%、二星 ≥ 75%、一星 < 75%（完成即至少 1 星）
  ethicsStar: function (rate) {
    rate = Number(rate) || 0;
    if (rate >= 90) return 3;
    if (rate >= 75) return 2;
    return 1;
  },

  // 運算思維：每完成一小關 +2 星（10 關滿 20 星）
  thinkingStars: function (completedCount) {
    return (Number(completedCount) || 0) * 2;
  },

  // 流程圖：每排完一關 +2 星（10 關滿 20 星）
  FLOWCHART_PER_UNIT: 2,
  flowchartStars: function (completedCount) {
    return (Number(completedCount) || 0) * this.FLOWCHART_PER_UNIT;
  },

  /* ===================================================================
     繳交加分（老師人工審核後給）
     -------------------------------------------------------------------
     學生把流程圖轉成的圖片、以及程式執行過程的錄影，上傳到 Google
     Classroom；老師看過確認無誤，才給這一分。

     · 流程圖圖片  每關 +1★（排對 2★ ＋ 交圖 1★ ＝ 單關最高 3★）
     · 程式錄影    每關 +1★（AI 批改 2～3★ ＋ 交影片 1★ ＝ 單關最高 4★）

     ★ 為什麼另外存一個欄位，而不是直接把星數加上去：
       學生端每完成一關就會用 merge 寫入 modules.flowchart.stars，
       那是「自動算出來的」。若把老師給的加分也寫進同一格，
       學生下次通關時整格會被自己的自動值覆蓋掉 —— 加分默默消失，
       而且沒有任何人會發現。所以加分存在**學生寫不到的欄位**，
       顯示時才把兩者相加。
       安全規則上，這些欄位只有老師寫得動（學生連自己的都不能改）。

     資料長這樣（存在 {學期}-progress/{學號}）：
       modules.flowchart.imgUnits = { '2-1-1A': { at: 1690000000000, by: '老師email' } }
       modules.scratch.vidUnits   = { '2-1-1':  { at: …, by: … } }
     用物件而不是陣列：同一關重複審核不會變成兩筆，也記得住時間與是誰給的。
     =================================================================== */
  /* 一關交了各值幾顆星。改這裡就好，教師端的星數上限也是從這裡算出來的。

     ★ 為什麼影片是 1 不是 2（2026-08-06 決定）：
       AI 批改給 2～3★。影片若給 2★，「程式 75 分＋交影片」＝4★ 會贏過
       「程式 95 分沒交影片」＝3★ —— 等於告訴學生「與其把程式改好，
       不如去錄一段影片」。給 1★ 時兩者打平，錄影仍然有價值，
       但不會蓋過程式本身的品質。
       錄影確實比截圖費工，它換到的是「證明程式真的跑得起來」——
       那是 AI 讀靜態程式碼看不出來的事，值得給分，
       不值得給到比寫好程式更划算。 */
  BONUS: {
    img: 1,        // 流程圖圖片（單關上限 2＋1 ＝ 3★）
    vid: 1         // 程式執行錄影（單關上限 3＋1 ＝ 4★）
  },

  /** 這個模組拿到幾顆加分星（單元數 × 該項的加分） */
  bonusStars: function (unitsMap, kind) {
    var per = this.BONUS[kind || 'img'];
    if (per == null) per = 1;
    var n = 0;
    for (var k in (unitsMap || {})) {
      if (Object.prototype.hasOwnProperty.call(unitsMap, k) && unitsMap[k]) n++;
    }
    return n * per;
  },

  /** 各模組的星數上限（教師端顯示 x / y 用；關卡數 × 每關上限） */
  moduleMax: function (units) {
    units = units || 10;
    return {
      flowchart: units * (this.FLOWCHART_PER_UNIT + this.BONUS.img),
      scratch:   units * (3 + this.BONUS.vid)      // AI 批改單關最高 3★
    };
  },

  /** 流程圖模組的總星數：排對的自動星 ＋ 老師給的交圖加分 */
  flowchartTotalWithBonus: function (completedCount, imgUnits) {
    return this.flowchartStars(completedCount) + this.bonusStars(imgUnits, 'img');
  },

  /**
   * 從一份 progress 文件算出「顯示用」的各模組星數（含加分）。
   * 教師端與學生端都該用這一支，不要各自把加分再加一次或漏加。
   */
  starsWithBonus: function (progress) {
    var m = (progress || {}).modules || {};
    var flow = m.flowchart || {}, scr = m.scratch || {};
    var flowBonus = this.bonusStars(flow.imgUnits, 'img');
    var scrBonus  = this.bonusStars(scr.vidUnits, 'vid');
    return {
      flowchart: (Number(flow.stars) || 0) + flowBonus,
      scratch:   (Number(scr.stars) || 0) + scrBonus,
      bonus:     flowBonus + scrBonus,
      flowchartBonus: flowBonus,
      scratchBonus:   scrBonus
    };
  },

  /* ===================================================================
     加分的合理性檢查
     -------------------------------------------------------------------
     ★ 這件事的前提：學生要先把流程圖排對，才生得出 Mermaid 圖片；
       要先把程式寫到會動，才錄得出執行過程。所以
         「沒有原始分數，卻有附件」
         「附件的時間比完成時間還早」
       兩者都代表哪裡不對 —— 可能是交錯關卡、交了舊檔、或根本不是自己做的。

     ★ 為什麼只警告、不硬擋（2026-08-06 決定）
       流程圖那一邊，硬擋大致沒問題（圖片只有完成畫面生得出來）。
       但程式那一邊不行：AI 批改可能因為 Colab 沒開而根本沒跑，
       學生的程式明明會動、影片也錄了，老師卻給不了分 ——
       那是把後端的故障轉嫁到學生身上。
       這個專案已經因為「不留手動解鎖後門」吃過一次苦頭。

       所以做成：把可疑的地方講清楚，讓老師按之前先看到，
       但最後決定權還是在老師手上。整個功能本來就是人工審核。
     =================================================================== */

  /** 這一關的「原始分數」狀態：拿到了沒、什麼時候拿到的 */
  baseFor: function (progress, kind, unitId) {
    var p = progress || {}, m = p.modules || {};
    var hist = p.history || [];
    function timeOf(module) {
      var t = 0;
      hist.forEach(function (h) {
        if (h && h.module === module && h.unit === unitId) t = Math.max(t, Number(h.at) || 0);
      });
      return t;
    }
    if (kind === 'img') {
      var units = (m.flowchart || {}).units || [];
      var done = units.indexOf(unitId) >= 0;
      return { done: done, stars: done ? this.FLOWCHART_PER_UNIT : 0,
               label: done ? '流程圖已排對' : '流程圖還沒排對',
               at: timeOf('flowchart') };
    }
    var stars = Number(((m.scratch || {}).unitStars || {})[unitId]) || 0;
    var ok = stars >= this.GATE.PASS_STARS;
    return { done: ok, stars: stars,
             label: ok ? ('程式 ' + stars + '⭐')
                       : (stars ? ('程式只有 ' + stars + '⭐') : '程式還沒通過'),
             at: timeOf('scratch') };
  },

  /**
   * 給這一分之前，有什麼值得先看一眼的？
   * 回空字串＝沒問題。有字＝畫面上要顯示，而且按下去前要再確認一次。
   *
   * submittedAt 是 Classroom 的繳交時間（毫秒；沒有就傳 0）。
   */
  bonusWarning: function (base, submittedAt) {
    base = base || {};
    if (!base.done) return '這一關的原始分數還沒拿到（' + (base.label || '') + '）';
    var sub = Number(submittedAt) || 0;
    if (base.at && sub && sub < base.at) {
      return '附件的時間比完成時間還早 —— 交的可能是別關或舊的檔案';
    }
    return '';
  },

  /** 這一關的圖片／影片加分給過了嗎（教師端用來顯示勾勾） */
  hasBonus: function (unitsMap, unitId) {
    return !!((unitsMap || {})[unitId]);
  },

  // 程式設計（Scratch）：依 AI 批改分數給星（每單元 2–3 星，10 單元滿 30 星）
  //   三星 ≥ 90 分、二星 ≥ 75 分；未滿 75 分不給星，代表這一關還沒通關，要修改後重傳
  scratchStar: function (score) {
    score = Number(score) || 0;
    if (score >= 90) return 3;
    if (score >= 75) return 2;
    return 0;                    // 0 星＝未通關
  },

  // 由「各單元最佳星數」的物件算出總星數與已通關單元數（0 星不算通關）
/* ── 概念檢測：自己一組星星 ──────────────────────
     ★ 兩組星星，各自算各自的
         🧩 作品星（unitStars）—— Scratch 作品的批改給，Colab 寫入
         🧠 概念星（由 quiz 的分數算出來）—— 五題開放式作答

       這和 11501 的「流程圖星星 ＋ Scratch 星星」是同一個做法：
       兩件不同的能力，就給兩個看得見的成果。

     ⚠️ **依序開放只看作品星**，不看概念星。
        概念檢測可以一直重寫到過為止 —— 拿它當開關的鑰匙等於沒有鎖。
        所以概念星是「成就」，不是「通行證」。

     ⚠️ 概念星不寫進 unitStars。
        unitStars 只有一個寫入者（批改），這條規則沒有例外 ——
        兩個地方都能改星數的話，之後沒有人說得出這一顆星是誰給的。
        概念星是**每次讀進度時從 quiz 的分數現算的**，
        沒有第二份資料，也就沒有兩份會不一致的問題。 */
  QUIZ_PASS: 3,          // 五題講到幾題才能往下走
  QUIZ_FULL: 4,          // 講到幾題才拿得到第 2 顆概念星

  /** 這一關的概念星（0～3）。沒考過就是 0 —— 那不是懲罰，是還沒做。 */
  quizStars: function (quiz, unitId) {
    var q = (quiz || {})[unitId];
    var n = q && typeof q.score === 'number' ? q.score : -1;
    if (n < 0) return 0;
    if (n >= 5) return 3;                 // 五題全講到
    if (n >= this.QUIZ_FULL) return 2;    // 4 題
    if (n >= this.QUIZ_PASS) return 1;    // 3 題（剛好過門檻）
    return 0;                             // 沒過門檻，本來也走不下去
  },

  /** 概念星的總數與已完成關數 */
  quizTotal: function (quiz) {
    var total = 0, done = 0, self = this;
    Object.keys(quiz || {}).forEach(function (k) {
      var s = self.quizStars(quiz, k);
      if (s > 0) { total += s; done++; }
    });
    return { stars: total, done: done };
  },

  scratchTotal: function (unitStars) {
    var total = 0, done = 0;
    for (var k in (unitStars || {})) {
      var s = Number(unitStars[k]) || 0;
      if (s > 0) { total += s; done++; }
    }
    return { stars: total, done: done };
  },

  /* ===================================================================
     依序開放（闖關順序）
     -------------------------------------------------------------------
     規則：
       ① 前導教材「Scratch 清單學習機」沒過 → 一關都不能進。
          因為第 1～6 關全是清單題，沒有清單概念硬做只會亂猜。
       ② 第 N 關要「流程圖排對 ＋ 程式拿到 2⭐ 以上」兩件都完成，
          才會開第 N+1 關。不能跳著學。

     ⚠️ 刻意沒有留「老師手動解鎖」的後門（2026-08-03 決定）。
        代價是：若 AI 批改後端沒開，學生卡在「程式未達 2⭐」就前進不了。
        真的要救，只能到 Firebase Console 直接改該生的
        modules.scratch.unitStars。上課前先確認 Colab 有跑起來。

     為什麼放在 shared/：這是課程規則不是版面，兩學期同一套，
     只該有一份。各頁只呼叫，不要自己寫死門檻。
     =================================================================== */
  /* ── 備課模式：暫時把「依序開放」整個關掉 ────────────
     ★ 為什麼需要
       關卡內容還在寫。要調第 7 關卻得先把前六關全部通關一次
       （每一關都要上傳作品讓 Colab 批改到 2⭐）——
       那不是謹慎，是讓人乾脆不改。

     ★ 為什麼要有到期日（OPEN_ALL_UNTIL）
       「記得開學前關掉」不是一個機制，是一個願望。
       這個開關忘了關的代價是：學生第一天就能跳到最後一關，
       而依序開放是這幾個模組唯一的節奏控制。
       ⇒ 過了那一天它**自己失效**。忘記的成本從「整學期沒有鎖」
         降成「某一天開始學生要照順序走」——後者頂多被問一句。
       ⇒ shared/tests/openall.test.js 會在過期後變紅，提醒你把設定清掉。

     ⚠️ 開著的時候，每一個受影響的頁面都要掛橘色橫幅。
        安靜地生效，就等於哪天忘了關也不會有人發現。 */
  openAll: function (cfg, today) {
    cfg = cfg || {};
    if (cfg.OPEN_ALL_UNITS !== true) return false;
    var until = cfg.OPEN_ALL_UNTIL;
    if (!until) return true;                 // 沒寫到期日就一直開著（不建議）
    var end = new Date(String(until) + 'T23:59:59');
    if (isNaN(end.getTime())) return true;   // 日期寫壞了不要反而把人鎖住
    return (today ? new Date(today) : new Date()) <= end;
  },

  GATE: {
    // 程式作品要幾顆星才算通過這一關
    //   （scratchStar 未滿 75 分回 0 星，所以 2 顆＝有拿到星）
    PASS_STARS: 2,

    /**
     * 這一關完成了嗎？
     *
     * flowDone 傳 null＝這個學期沒有「逐關流程圖」這件事，只看程式星數。
     *   （下學期的 flowchart.html 是一份綜合測驗，不是逐關排流程圖，
     *     沒有 per-unit 的完成紀錄可以查。）
     */
    cleared: function (unitId, flowDone, unitStars) {
      var flow = (flowDone === null) ? true : !!(flowDone || {})[unitId];
      var stars = Number((unitStars || {})[unitId]) || 0;
      return flow && stars >= this.PASS_STARS;
    },

    /**
     * 目前最多可以進到第幾關（1 起算；0＝一關都不能進）
     *
     * @param units      依序的單元陣列，每項要有 id
     * @param leadDone   前導教材是否完成
     * @param flowDone   { 單元id: true } 流程圖已排對的
     * @param unitStars  { 單元id: 星數 } AI 批改給的程式星數
     *
     * 回傳「第一個還沒完成的關卡編號」——那一關可以進，再下一關不行。
     * 全部完成就回傳總關數（都可以回去重看）。
     */
    openUpTo: function (units, leadDone, flowDone, unitStars) {
      if (!leadDone) return 0;
      units = units || [];
      for (var i = 0; i < units.length; i++) {
        if (!this.cleared(units[i].id, flowDone, unitStars)) return i + 1;
      }
      return units.length;
    },

    /** 第 no 關現在能不能進去（no 從 1 起算） */
    isOpen: function (no, units, leadDone, flowDone, unitStars) {
      return Number(no) <= this.openUpTo(units, leadDone, flowDone, unitStars);
    },

    /**
     * 進不去的原因（給學生看的白話說明）。可以進去就回空字串。
     * 訊息要講「還缺什麼」，不是只說「被鎖住」——
     * 學生看到「被鎖住」只會來問老師，看到「還差程式作品」就知道要做什麼。
     */
    reason: function (no, units, leadDone, flowDone, unitStars) {
      if (!leadDone) return '要先完成上面的前導教材「Scratch 清單學習機」，才能開始闖關。';
      no = Number(no);
      if (this.isOpen(no, units, leadDone, flowDone, unitStars)) return '';
      var open = this.openUpTo(units, leadDone, flowDone, unitStars);
      var u = units[open - 1] || {};
      var flow = (flowDone === null) ? true : !!(flowDone || {})[u.id];
      var stars = Number((unitStars || {})[u.id]) || 0;
      var lack = !flow
        ? '排出正確的流程圖'
        : '上傳程式作品並拿到 ' + this.PASS_STARS + '⭐ 以上（目前 ' + stars + '⭐）';
      return '關卡要照順序闖。請先完成第 ' + open + ' 關「' + (u.title || '') + '」：' + lack + '。';
    }
  }
};
