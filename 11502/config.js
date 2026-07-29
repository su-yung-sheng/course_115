/* =====================================================================
   全站共用設定（單一來源 Single Source of Truth）
   ---------------------------------------------------------------------
   ★ 換後端網址、換學期、改班級密碼……都只改這一支，其他頁面自動跟著變。
   ★ 每個網頁在其他 <script> 之前先載入：
        <script src="config.js"></script>
   ★ 計分規則另見 shared/grading.js；身分守門見 shared/guard.js
   ---------------------------------------------------------------------
   ⚠️ 這支的內容要與 course_11501/config.js 保持「結構相同、值不同」，
      不要只改一邊。上學期版本改了什麼，這邊通常也要跟。
   ===================================================================== */
window.CONFIG = {

  // ── 學期 ────────────────────────────────────────────────
  TERM: '11502',

  // ⚠️ 待確認：這個日期是從上學期複製過來的，還沒改成下學期的開學日。
  //    每週評分與出席週次都以它為準，開學前務必更新。
  TERM_START: '2026-08-31',        // 第 1 週的星期一

  //   闖關基地的檔名：guard.js／sso.js 導回登入時用這個
  //   兩學期都是 hub.html（學期由資料夾表達），保留這個設定是為了讓
  //   shared/ 底下的頁面也能取得正確的入口
  HUB_PAGE: 'hub.html',

  // ── Firebase（上下學期同一個專案）──────────────────────
  //   決定「連到哪個資料庫、用哪組權限」的是 apiKey / authDomain / projectId，
  //   這幾項全站一致，集中在這裡。
  //   appId 與 measurementId 只影響 Google Analytics 的來源歸屬，
  //   各頁在同一個 Firebase 專案下註冊了不同的 Web App，因此由各頁自行覆蓋：
  //     const cfg = Object.assign({}, window.CONFIG.FIREBASE, { appId: '…', measurementId: '…' });
  FIREBASE: {
    apiKey: "AIzaSyC7VHP2O52poMDEprwQyrpglVmbxhoteT0",
    authDomain: "suyungsheng-5f948.firebaseapp.com",
    projectId: "suyungsheng-5f948",
    storageBucket: "suyungsheng-5f948.firebasestorage.app",
    messagingSenderId: "85509938573",
    appId: "1:85509938573:web:25a2f4459ab4b2c06771c4",   // 預設＝闖關基地／教師端
    measurementId: "G-J5Y45Z3XPW"
  },

  // Firestore 集合名稱
  COLLECTIONS: {
    PROGRESS: '11502-progress',
    // ★ 2026-07-29 名冊已合併為跨學期共用的 roster（見 shared/docs/03）
    //   驗證碼不在這裡，本體在 secret 集合，學生讀不到
    ROSTER:   'roster',
    CONFIG:   '11502-config',
    GRADER:   '11502-grader',
    SUBMISSIONS: '11502-scratch-submissions'
  },

  // 跨學期共用的集合（同一批學生，只需要一份）
  SHARED: {
    ROSTER:  'roster',    // 名冊：姓名／班級／座號（不含驗證碼）
    SECRET:  'secret',    // 驗證碼本體：學生完全讀不到，只有老師看得到
    SESSION: 'session'    // 登入試探：寫得進去＝驗證通過
  },

  // ── 後端服務 ────────────────────────────────────────────
  //   共用後端 shared/backend.ipynb 啟動後的固定網域。
  //   上下學期共用同一本 notebook、同一個網域，靠請求裡的 term 參數分學期。
  //   ⚠️ 換網域時，這裡與 course_11501/config.js 都要改。
  SERVER_URL: 'https://flanking-snort-cyclic.ngrok-free.dev',

  //   班級密碼：需與 Colab Secrets 的 CLASS_PASSCODE2 一致（留空 = 後端不檢查）
  CLASS_PASS: '1502class',

  //   前端需要後端具備的功能（對應 /api/health 回傳的 features）
  //   ⚠️ 只在「前端新寫的功能依賴新的後端端點」時才加一項；
  //      單純改後端內部邏輯不必動這裡，版本號也不必寫進前端。
  BACKEND_FEATURES: ['queue', 'ocr_queue', 'models_from_secrets', 'term_param', 'fs_auth'],

  //   作品備份用的 Google Apps Script（shared/filebackup.gs 部署後的網址）
  //   ★ 上下學期共用同一支部署：路徑為 <根>/學期/單元/班級/座號/檔名，
  //     學期由請求帶的 term 決定（腳本內有白名單，亂傳會被擋下）。
  //     兩支 config.js 這一行必須完全相同。
  GAS_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycbw561cen7oZg-OnuWjLTMRRs1IRy0eQI8LL-X3vyz0I_bVxxAhLhisHaokI6kiz3YjxYA/exec',

  //   上傳通行碼：需與 Apps Script「指令碼屬性」的 UPLOAD_KEY 一致。
  //   ⚠️ 這是公開值（學生按 F12 看得到），作用是擋掉不知道網址的外人隨機掃描，
  //      不是拿來擋學生的。兩學期填同一個值。
  GAS_UPLOAD_KEY: 'c115-upload',

  // ── 10 個程式設計單元（教師端批改標準／自評站／作品備份共用）──
  //   [單元代號, 名稱]；順序即關卡編號 01～10（作品備份的檔名依此）
  //   ⚠️ 待確認：11502_scratch.html 裡另有一份不同的單元清單
  //      （第 6～10 關為 猜數字／找最高分／排隊排好／智慧選卡／期末專題）。
  //      下學期課程內容定案後，兩邊要統一，並同步更新教師端的批改標準。
  UNITS: [
    ['2-1-1A', '班級置物櫃'],
    ['2-1-1B', '集合點名'],
    ['2-1-2',  '演奏小星星'],
    ['2-1-3',  '計算成績'],
    ['2-1-4',  '抽號碼'],
    ['2-1-5',  '撲克發牌'],
    ['2-2-1',  '動物點點名'],
    ['2-2-2',  '戰車王'],
    ['2-3-1',  '分身小貓'],
    ['2-3-2',  '螞蟻搬乳酪']
  ],

  // 帶「第 N 關」前綴的顯示名稱（自評站、教師端下拉選單用）
  unitOptions: function () {
    return this.UNITS.map(function (u, i) {
      return [u[0], '第 ' + (i + 1) + ' 關 ' + u[1]];
    });
  },
  // 由單元代號取得關卡編號（1～10）
  unitNo: function (id) {
    var i = this.UNITS.findIndex(function (u) { return u[0] === id; });
    return i >= 0 ? i + 1 : 0;
  }
};
