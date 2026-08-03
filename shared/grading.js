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

  // 程式設計（Scratch）：依 AI 批改分數給星（每單元 2–3 星，10 單元滿 30 星）
  //   三星 ≥ 90 分、二星 ≥ 75 分；未滿 75 分不給星，代表這一關還沒通關，要修改後重傳
  scratchStar: function (score) {
    score = Number(score) || 0;
    if (score >= 90) return 3;
    if (score >= 75) return 2;
    return 0;                    // 0 星＝未通關
  },

  // 由「各單元最佳星數」的物件算出總星數與已通關單元數（0 星不算通關）
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
