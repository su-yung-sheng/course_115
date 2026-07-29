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
  }
};
