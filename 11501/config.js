/* =====================================================================
   全站共用設定（單一來源 Single Source of Truth）
   ---------------------------------------------------------------------
   ★ 換後端網址、換學期、改單元名稱……都只改這一支，其他頁面自動跟著變。
   ★ 每個網頁在其他 <script> 之前先載入：
        <script src="config.js"></script>
   ★ 計分規則另見 shared/grading.js；身分守門見 shared/guard.js
   ===================================================================== */
window.CONFIG = {

  // ── 學期 ────────────────────────────────────────────────
  TERM: '11501',
  //   第 1 週的星期一。每週評分與出席週次都以它為準。
  //   ⚠️ 這與 shared/semester.js 的學期界線（2026-08-01）是兩回事：
  //      界線決定「現在算哪個學期」，TERM_START 決定「這是第幾週」。
  TERM_START: '2026-08-31',

  //   闖關基地的檔名：guard.js／sso.js 導回登入時用這個
  //   兩學期都是 hub.html（學期由資料夾表達），保留這個設定是為了讓
  //   shared/ 底下的頁面也能取得正確的入口
  HUB_PAGE: 'hub.html',

  // ── Firebase（與 hub／教師端同一個專案）────────────────
  FIREBASE: {
    apiKey: "AIzaSyC7VHP2O52poMDEprwQyrpglVmbxhoteT0",
    authDomain: "suyungsheng-5f948.firebaseapp.com",
    projectId: "suyungsheng-5f948",
    storageBucket: "suyungsheng-5f948.firebasestorage.app",
    messagingSenderId: "85509938573",
    appId: "1:85509938573:web:1c67c8f28ca9b83c6771c4",
    measurementId: "G-QZWM1F3FWX"
  },

  // Firestore 集合名稱
  /* Google Classroom（繳交審核頁 shared/review.html 用，可以留空）
     留空的話審核頁仍然能用，只是不會列出繳交狀況，要自己開 Classroom 看。

     GAS_URL 是 shared/classroom.gs 部署出來的網頁應用程式網址（結尾 /exec）。
     部署步驟寫在那支 .gs 的開頭，約五分鐘。

     ⚠️ 通行碼（QUERY_KEY）**不要**寫在這裡 —— 這個 repo 是公開的。
        在審核頁上輸入一次就好，會記在那台瀏覽器裡。 */
  CLASSROOM: {
    GAS_URL: 'https://script.google.com/macros/s/AKfycbzGQQWlGGUKmyBR6gETbbEluFl_jjyE4Rd7W24HgizSfYHP8LJ3thIF9kCtHb4TAYzf7A/exec'        // 例：https://script.google.com/macros/s/AKfy…/exec
  },

  COLLECTIONS: {
    PROGRESS: '11501-progress',
    // ★ 2026-07-29 名冊已合併為跨學期共用的 roster（見 shared/docs/03）
    //   驗證碼不在這裡，本體在 secret 集合，學生讀不到
    ROSTER:   'roster',
    CONFIG:   '11501-config',
    GRADER:   '11501-grader',
    SUBMISSIONS: '11501-scratch-submissions'
  },

  // 跨學期共用的集合（同一批學生，只需要一份）
  //   ★ 2026-08-04：驗證碼備援整套移除，secret／session／config-auth
  //     都不再使用（Firebase 已停用匿名登入，那套本來就不能用了）。
  SHARED: {
    ROSTER: 'roster'      // 名冊：姓名／班級／座號
  },

  // ── 後端服務 ────────────────────────────────────────────
  //   Colab（shared/backend.ipynb）啟動後的固定網域。
  //   換網域時只改這一行，運算思維與 Scratch 批改都會跟著改。
  SERVER_URL: 'https://flanking-snort-cyclic.ngrok-free.dev',

  //   班級密碼：需與 Colab Secrets 的 CLASS_PASSCODE 一致（留空 = 後端不檢查）
  CLASS_PASS: '1501class',

  //   前端需要後端具備的功能（對應 /api/health 回傳的 features）
  //   ⚠️ 只在「前端新寫的功能依賴新的後端端點」時才加一項；
  //      單純改後端內部邏輯不必動這裡，版本號也不必寫進前端。
  //      教師端發現後端少了任一項，會提示老師去 Colab 重跑 notebook。
  BACKEND_FEATURES: ['queue', 'ocr_queue', 'models_from_secrets', 'term_param', 'fs_auth', 'sa_auth'],

  //   作品備份用的 Google Apps Script（shared/filebackup.gs 部署後的網址）
  //   ★ 上下學期共用同一支部署：路徑為 <根>/學期/單元/班級/座號/檔名，
  //     學期由請求帶的 term 決定（腳本內有白名單，亂傳會被擋下）。
  //     兩支 config.js 這一行必須完全相同。
  GAS_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycbw561cen7oZg-OnuWjLTMRRs1IRy0eQI8LL-X3vyz0I_bVxxAhLhisHaokI6kiz3YjxYA/exec',

  //   上傳通行碼：需與 Apps Script「指令碼屬性」的 UPLOAD_KEY 一致。
  //   ⚠️ 這是公開值（學生按 F12 看得到），作用是擋掉不知道網址的外人隨機掃描，
  //      不是拿來擋學生的。兩學期填同一個值。
  GAS_UPLOAD_KEY: 'c115-upload',

  /* AI 助教（開放式作答的覆核）
     ---------------------------------------------------------------
     ★ 2026-08-24 補上 —— 這一份原本**整塊都沒有**，所以上學期的
       開放式作答只有本機關鍵字判定，沒有覆核那一段。

     ⚠️⚠️ 下面這個 KEY **不是** Gemini／Claude 的 API 金鑰。
        它是「通行碼」（GAS 那邊的指令碼屬性 QUERY_KEY），
        自己想一組字串，兩個地方貼同一組：
          ① Apps Script →「專案設定 → 指令碼屬性」新增 QUERY_KEY
          ② 下面這一行
        ★ 這組碼**學生看得到**（repo 公開）。它擋的是「別人拿你的部署
          網址亂用」，不是擋學生 —— 真正的防線是 GAS 那邊的
          DAILY_CAP / PER_SID_CAP / DAILY_TOKEN_CAP。
        ⚠️ Gemini／Claude 的金鑰**絕對不要**寫在這裡，只放 GAS 的指令碼屬性。

     ⚠️ 留空 ＝ 覆核整塊不啟用（askai.js 的 enabled() 要 GAS_URL 和 KEY
        兩個都有）。那時學生拿到的是本機關鍵字判的結果 —— 課照上，
        只是「用了沒收錄的說法」那種答案沒有人幫他撿回來。
        （狀態檢查頁的第 ⑥ 張卡會把這件事講出來。） */
  AIGUIDE: {
    /* ★ 和下學期**同一支部署** —— aiguide.gs 不分學期（參數只有 unit／qi／student），
       所以兩學期共用一支，額度也共用一份。
       ⚠️ 兩支 config.js 的這兩行要一模一樣，改一邊忘一邊的症狀是
          「上學期問得到、下學期問不到」，而且完全沒有錯誤訊息。 */
    GAS_URL: 'https://script.google.com/macros/s/AKfycbzK3CRfHHPgw8YbP5EBOtmxJQ4GbTt1NG5UqxqCsH17q0_gUvbP9kzNfSJc25J9PrrZBw/exec',
    KEY: 'scratch'
  },

  /* 備課用的總開關：把「依序開放」整個關掉，十關全部打開。
     ---------------------------------------------------------------
     2026-08-11 開了一次，用來把十關的內容從頭確認一遍
     （不開的話得先把每一關都排對流程圖、上傳作品批改到 2⭐ 才看得到下一關）。
     ★ 當天就確認完並關回來了 —— 這學期的鎖從頭到尾沒有真的鬆過。

     要再開的時候：改成 true，並把 OPEN_ALL_UNTIL 設成一個近期的日期。
     ⚠️ 一定要留到期日。過了那天 GRADING.openAll() 會自己回 false ——
        「記得關掉」不是一個機制，是一個願望，
        而願望在忙起來的第一週就會失效，那正是最不能失效的一週。
     ⇒ 開著的時候闖關地圖會掛一條橘色橫幅（含到期日），不會安靜生效。
     --------------------------------------------------------------- */
  OPEN_ALL_UNITS: false,

  // ── 10 個程式設計單元（流程圖／程式設計／自評站／教師端共用）──
  //   [單元代號, 名稱]；順序即關卡編號 01～10（作品備份的檔名依此）
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
