/* =====================================================================
   全站共用設定（單一來源 Single Source of Truth）
   ---------------------------------------------------------------------
   ★ 換後端網址、換學期、改班級密碼……都只改這一支，其他頁面自動跟著變。
   ★ 每個網頁在其他 <script> 之前先載入：
        <script src="config.js"></script>
   ★ 計分規則另見 shared/grading.js；身分守門見 shared/guard.js
   ---------------------------------------------------------------------
   ⚠️ 這支的內容要與 11501/config.js 保持「結構相同、值不同」，
      不要只改一邊。上學期版本改了什麼，這邊通常也要跟。
   ===================================================================== */
window.CONFIG = {

  // ── 學期 ────────────────────────────────────────────────
  TERM: '11502',

  //   第 1 週的星期一。每週評分與出席週次都以它為準。
  //   ⚠️ 這與 shared/semester.js 的學期界線（2027-02-01）是兩回事：
  //      界線決定「現在算哪個學期」，TERM_START 決定「這是第幾週」。
  TERM_START: '2027-02-08',

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
  /* Google Classroom（繳交審核頁 shared/review.html 用，可以留空）
     留空的話審核頁仍然能用，只是不會列出繳交狀況，要自己開 Classroom 看。

     GAS_URL 是 shared/classroom.gs 部署出來的網頁應用程式網址（結尾 /exec）。
     部署步驟寫在那支 .gs 的開頭，約五分鐘。

     ⚠️ 通行碼（QUERY_KEY）**不要**寫在這裡 —— 這個 repo 是公開的。
        在審核頁上輸入一次就好，會記在那台瀏覽器裡。 */
  CLASSROOM: {
    GAS_URL: 'https://script.google.com/macros/s/AKfycbzGQQWlGGUKmyBR6gETbbEluFl_jjyE4Rd7W24HgizSfYHP8LJ3thIF9kCtHb4TAYzf7A/exec'        // 例：https://script.google.com/macros/s/AKfy…/exec
  },

  /* AI 引導（「動手之前」那一步的「問問看」，shared/aiguide.gs）
     留空的話整個功能不出現 —— 圈選、先寫再對照、積木拼圖都照常。

     ⚠️ 這裡的 KEY 和 CLASSROOM 那支不一樣，**必須**寫在這裡。
        因為呼叫的人是學生，不可能叫每個學生自己輸入通行碼。
        而這個 repo 是公開的 → 這組通行碼等於是公開的。

     所以它擋不住有心人，真正的防線在 aiguide.gs 那邊：
       · 題目與「不可以說出口的內容」由 GAS 自己抓，前端改不了
       · 每天總量上限 DAILY_CAP ← ★ 這個才是總閘門
       · 每個學生每天上限 PER_SID_CAP

     ⚠️ PER_SID_CAP 擋不住有心人 —— sid 是前端送的，可以偽造。
        它擋的是「同一個學生一直按」，不是攻擊。
        真的被亂用的話：改掉 GAS 的 QUERY_KEY，再改這裡推一次就好。

     ⚠️ GAS 重新部署時要選「管理部署作業 → 編輯 → 版本：新版本」。
        按「新增部署作業」會產生**另一個網址**，這裡就對不上了。 */
  AIGUIDE: {
    GAS_URL: 'https://script.google.com/macros/s/AKfycbzK3CRfHHPgw8YbP5EBOtmxJQ4GbTt1NG5UqxqCsH17q0_gUvbP9kzNfSJc25J9PrrZBw/exec',
    /* ⚠️ 留空 ＝ 學生端的「問問看」**整塊不會出現**。
       askai.js 的 enabled() 要 GAS_URL 和 KEY 兩個都有才啟用 ——
       只填網址不填通行碼，畫面上不會有任何說明，就只是那顆按鈕不見了。
       （狀態檢查頁的第 ⑥ 張卡會把這件事講出來。）

       怎麼填：Apps Script →「專案設定 → 指令碼屬性」新增一列
       QUERY_KEY，值自己想一組，再把同一組字串貼進下面。

       ★ 這組通行碼會出現在 config.js，也就是**學生看得到**。
         它擋的是「別人拿你的部署網址亂用」，不是擋學生 ——
         真正的防線是 GAS 那邊的 DAILY_CAP / PER_SID_CAP / DAILY_TOKEN_CAP。
       ⚠️ Gemini／Claude 的金鑰**絕對不要**寫在這裡。
         那些只放 GAS 的指令碼屬性，這個 repo 是公開的。 */
    KEY: 'scratch'
  },

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
  //   ★ 2026-08-04：驗證碼備援整套移除，secret／session／config-auth
  //     都不再使用（Firebase 已停用匿名登入，那套本來就不能用了）。
  SHARED: {
    ROSTER: 'roster'      // 名冊：姓名／班級／座號
  },

  // ── 後端服務 ────────────────────────────────────────────
  //   共用後端 shared/backend.ipynb 啟動後的固定網域。
  //   上下學期共用同一本 notebook、同一個網域，靠請求裡的 term 參數分學期。
  //   ⚠️ 換網域時，這裡與 11501/config.js 都要改。
  SERVER_URL: 'https://flanking-snort-cyclic.ngrok-free.dev',

  //   班級密碼：需與 Colab Secrets 的 CLASS_PASSCODE2 一致（留空 = 後端不檢查）
  CLASS_PASS: '1502class',

  //   前端需要後端具備的功能（對應 /api/health 回傳的 features）
  //   ⚠️ 只在「前端新寫的功能依賴新的後端端點」時才加一項；
  //      單純改後端內部邏輯不必動這裡，版本號也不必寫進前端。
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

  // ── 10 個程式設計單元（模擬器關卡／作品備份／教師端共用）──
  //   [單元代號, 名稱]；順序即關卡編號 01～10
  //
  //   ★ 2026-08-04 定案。難度刻意排成連續的：
  //     1–3 函式積木（自訂積木 → 參數 → 綜合）
  //     4   遊戲（事件、偵測、變數）
  //     5   排序的兩個原子動作先單獨練 —— 沒有這一關，
  //         第 6 關要一次跨過「巢狀迴圈」與「交換」兩個新概念
  //     6–7 兩種排序法
  //     8–9 兩種搜尋法（二元搜尋需要「已排序」的前提，所以排在排序之後）
  //     10  效率比較收尾，對應 108 課綱運算思維的「演算法效率」
  /* ⚠️⚠️ 備課用：把「依序開放」整個關掉，十關全部打開。 ⚠️⚠️
     ---------------------------------------------------------------
     ★ 為什麼有這個開關
       十關的內容還在寫。要調第 7 關，卻得先把前六關全部通關一次
       （每一關都要上傳作品讓 Colab 批改到 2⭐）——
       那不是「謹慎」，是讓人乾脆不改。

     ★ 為什麼敢開
       下學期 2027-02-01 才開始。在那之前，安全規則本來就只讓
       測試帳號寫得進 11502-progress，沒有學生在跑這些頁面。

     ★ OPEN_ALL_UNITS 到這一天為止就自己失效
       「記得開學前關掉」不是一個機制，是一個願望。
       過了 OPEN_ALL_UNITS_UNTIL，GRADING.openAll() 就回 false，
       依序開放自動回來 —— 忘記的成本從「整學期沒有鎖」
       降成「某一天開始學生要照順序走」。
       ⇒ 開著的時候，闖關地圖和關卡頁都會掛一條**橘色橫幅**（含到期日），
         不是安靜地生效 —— 那是設計的一部分，不要拿掉。
       ⇒ 過期之後 shared/tests/openall.test.js 會變紅，提醒你把設定清掉。
     --------------------------------------------------------------- */
  OPEN_ALL_UNITS: true,
  OPEN_ALL_UNTIL: '2027-01-25',      // ← 下學期開學前。請改成你自己的日期

  UNITS: [
    ['4-2-1', '平行的正方形'],
    ['4-2-2', '愈畫愈大的正方形'],
    ['4-2-3', '畫圖形（邊數、邊長）'],
    ['4-3-1', '小鳥吃蟲'],
    ['6-1-1', '排隊比高矮'],
    ['6-2-1', '選擇排序法'],
    ['6-2-2', '插入排序法'],
    ['6-3-1', '循序搜尋法'],
    ['6-3-2', '二元搜尋法'],
    ['6-3-3', '資料大爆炸']
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
