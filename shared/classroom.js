/* =====================================================================
   Google Classroom 讀取（只讀，教師端用）
   ---------------------------------------------------------------------
   用途：老師在審核頁直接看到「這份作業誰交了、交了什麼」，
         確認無誤就按一下給加分，不必在兩個視窗之間來回。

   ★ 為什麼是「老師自己的瀏覽器去要授權」，不是後端服務帳戶：
     服務帳戶不能是 Classroom 的成員，要讀課程資料得由網域管理員開
     「全網域委派」才行。學校的 Google Workspace 管理權多半不在老師手上，
     那條路一卡就整個做不下去。改成老師本人在瀏覽器同意授權，
     用的就是老師自己在 Classroom 的權限 —— 看得到什麼完全一樣，
     而且不需要管理員。

   ★ 只要唯讀權限，而且**不要 Drive 權限**：
     繳交的附件本來就帶著 Drive 的檢視連結（alternateLink），
     老師點開時本來就已經登入 Google，直接看得到。
     為了顯示縮圖而去要 Drive 權限，是拿「敏感權限審查」換一張小圖，
     不划算，也讓學校更可能擋下這個應用。

   ---------------------------------------------------------------------
   一次性設定（老師自己做，約 10 分鐘）
     1. Google Cloud Console → 建立專案（或用 Firebase 那個）
     2. 啟用 API：Google Classroom API
     3. OAuth 同意畫面 → 使用者類型「外部」→ 測試中
        → 測試使用者加入自己的學校信箱
     4. 憑證 → 建立 OAuth 用戶端 ID → 網頁應用程式
        已授權的 JavaScript 來源：
          https://su-yung-sheng.github.io
          http://localhost:8000        （本機測試用）
     5. 把用戶端 ID 填進各學期 config.js 的 CLASSROOM.CLIENT_ID

   ⚠️ 若學校的 Workspace 管理員把「第三方應用程式存取」設成封鎖，
      授權會直接失敗。這時審核頁會退回「手動名冊模式」——
      功能不會消失，只是要自己開 Classroom 看。

   ---------------------------------------------------------------------
   用法：
     CLASSROOM.init(clientId);
     await CLASSROOM.signIn();                 // 跳出 Google 同意畫面
     const courses = await CLASSROOM.courses();
     const works   = await CLASSROOM.coursework(courseId);
     const subs    = await CLASSROOM.submissions(courseId, courseWorkId);
     const roster  = await CLASSROOM.roster(courseId);   // userId → email
   ===================================================================== */
(function (global) {
  'use strict';

  var GIS = 'https://accounts.google.com/gsi/client';
  var API = 'https://classroom.googleapis.com/v1';

  /* 只要唯讀，而且只要真的用得到的那幾項。
     每多一個權限，學校擋下來的機會就多一分。 */
  var SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/classroom.profile.emails'
  ].join(' ');

  var clientId = '';
  var token = '';
  var tokenClient = null;

  function init(id) { clientId = String(id || '').trim(); }

  /* 用戶端 ID 的開頭就是 Google Cloud 的專案編號
     （例：85509938573-abc123.apps.googleusercontent.com → 85509938573）。
     有了它就能給出「直接指到正確專案」的設定連結 ——
     老師手上常常不只一個 Google 專案，叫他「去 Cloud Console 啟用 API」
     而不說是哪一個專案，很容易啟用到另一個然後繼續卡住。 */
  function projectNumber() {
    var m = /^(\d+)-/.exec(clientId);
    return m ? m[1] : '';
  }
  function enableApiUrl() {
    var p = projectNumber();
    return 'https://console.cloud.google.com/apis/library/classroom.googleapis.com'
         + (p ? '?project=' + p : '');
  }
  function ready() { return !!clientId; }
  function signedIn() { return !!token; }

  /** 把 Google 的登入元件載進來（只載一次） */
  function loadGis() {
    if (global.google && global.google.accounts && global.google.accounts.oauth2) {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = GIS; s.async = true; s.defer = true;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error('載入 Google 登入元件失敗 —— 檢查網路，或校內網路是否擋了 accounts.google.com'));
      };
      document.head.appendChild(s);
    });
  }

  /**
   * 要求授權。第一次會跳出 Google 的同意畫面。
   *
   * ★ 錯誤訊息一定要講得出「下一步怎麼辦」：
   *   這一段最常見的失敗不是程式壞掉，是設定沒做完或學校擋掉，
   *   只丟一個 error code 出來，老師完全不知道要去哪裡改。
   */
  function signIn() {
    if (!ready()) {
      return Promise.reject(new Error(
        '還沒設定 Classroom 用戶端 ID。請到 Google Cloud Console 建立「網頁應用程式」型的 OAuth 用戶端 ID，' +
        '再填進這個學期的 config.js（CLASSROOM.CLIENT_ID）。詳細步驟見 shared/classroom.js 開頭。'));
    }
    return loadGis().then(function () {
      return new Promise(function (resolve, reject) {
        tokenClient = global.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: function (resp) {
            if (resp && resp.access_token) { token = resp.access_token; resolve(token); return; }
            reject(new Error(explainAuthError(resp)));
          },
          error_callback: function (err) { reject(new Error(explainAuthError(err))); }
        });
        tokenClient.requestAccessToken({ prompt: token ? '' : 'consent' });
      });
    });
  }

  function signOut() {
    if (token && global.google && global.google.accounts) {
      try { global.google.accounts.oauth2.revoke(token); } catch (e) { /* 撤銷失敗不影響本機登出 */ }
    }
    token = '';
  }

  /** 把 Google 回的錯誤代碼翻成「老師看得懂、知道要做什麼」的話 */
  function explainAuthError(e) {
    var t = (e && (e.type || e.error || e.message)) || '';
    if (/popup_closed|popup_failed/i.test(t)) {
      return '授權視窗被關掉或被瀏覽器擋住了。請允許這個網站開啟彈出視窗，再按一次。';
    }
    if (/access_denied|user_denied/i.test(t)) {
      return '你在同意畫面按了拒絕。要讀 Classroom 的繳交就必須同意這幾項唯讀權限。';
    }
    /* ★ 學校擋第三方應用程式。
       Google 的原話是「貴機構的管理員必須先針對這個應用程式進行審查及設定存取權」。
       這一關**程式端改不動**，只有 Workspace 管理員能開。
       所以訊息要直接寫成「可以整段轉給管理員的請求」——
       只說「請找管理員」等於把問題丟回去，老師還要自己查該講什麼。 */
    if (/admin|policy|disallowed|blocked|org_internal|restricted/i.test(t)) {
      return '學校的 Google Workspace 目前擋下未經核准的第三方應用程式，'
           + '所以這個功能要管理員核准後才能用。\n\n'
           + '把下面這段轉給資訊組／網域管理員：\n'
           + '────────────────\n'
           + '請在 Google 管理控制台將以下應用程式設為「信任」：\n'
           + '　路徑：安全性 → 存取權和資料控管 → API 控管 → 管理第三方應用程式存取權\n'
           + '　→ 設定新的應用程式 → OAuth 應用程式名稱或用戶端 ID\n'
           + '　用戶端 ID：' + (clientId || '（尚未設定）') + '\n'
           + '　用途：教師本人讀取自己 Classroom 課程的作業繳交狀況，供成績登錄使用\n'
           + '　權限：全部唯讀（課程、作業繳交、名單、電子郵件），不含 Drive、不會寫入任何資料\n'
           + '────────────────\n\n'
           + '在管理員核准之前，審核頁仍然可以正常使用 —— '
           + '自己開 Classroom 看過，再回來按給分就好，功能完全不受影響。';
    }
    /* ★ access_not_configured 是最容易卡住又最難看懂的一個。
       Google 的意思是「這個專案沒有啟用 Classroom API」，
       但畫面上只會顯示「發生錯誤 400：access_not_configured」，
       完全看不出要去哪裡開什麼。而且**要啟用在跟用戶端 ID 同一個專案**——
       老師手上常常不只一個專案，啟用錯地方會繼續卡在同一個錯誤。 */
    if (/access_not_configured|accessnotconfigured|api.*not.*enabled/i.test(t)) {
      return '這個 Google Cloud 專案還沒有啟用 Classroom API。'
           + '請開啟下面這個連結（已經指到正確的專案）並按「啟用」，等一兩分鐘再回來重試：\n'
           + enableApiUrl();
    }
    if (/idpiframe|invalid_client|origin/i.test(t)) {
      return 'OAuth 用戶端 ID 設定不符 —— 檢查「已授權的 JavaScript 來源」有沒有填目前這個網址。';
    }
    return '取得 Classroom 授權失敗：' + (t || '未知原因') + '。可以改用手動審核模式先上課。';
  }

  /** 呼叫 Classroom API；把常見的失敗翻成人看得懂的話 */
  function call(path, params) {
    if (!token) return Promise.reject(new Error('還沒授權，請先按「連接 Google Classroom」。'));
    var qs = Object.keys(params || {})
      .filter(function (k) { return params[k] != null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    return fetch(API + path + (qs ? '?' + qs : ''), {
      headers: { Authorization: 'Bearer ' + token }
    }).then(function (r) {
      if (r.status === 401) { token = ''; throw new Error('授權過期了，請再按一次「連接 Google Classroom」。'); }
      /* 400／403 都可能是「API 沒啟用」。Google 兩種都回過，
         而且訊息藏在 body 裡 —— 只看狀態碼會把它誤報成權限問題。 */
      if (r.status === 400 || r.status === 403) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var reason = ((j.error || {}).message || '') + ' ' +
                       (((j.error || {}).errors || []).map(function (x) { return x.reason || ''; }).join(' '));
          if (/access_?not_?configured|not been used in project|is disabled/i.test(reason)) {
            throw new Error('這個 Google Cloud 專案還沒有啟用 Classroom API。'
              + '請開啟下面這個連結（已經指到正確的專案）並按「啟用」，等一兩分鐘再回來重試：\n'
              + enableApiUrl());
          }
          if (r.status === 403) {
            throw new Error('沒有權限讀這份資料。確認你在這門課是「老師」身分。'
              + (reason.trim() ? '\nGoogle 說：' + reason.trim() : ''));
          }
          throw new Error('Classroom 回應 HTTP 400。' + (reason.trim() ? 'Google 說：' + reason.trim() : ''));
        });
      }
      if (!r.ok) throw new Error('Classroom 回應 HTTP ' + r.status);
      return r.json();
    });
  }

  /** 把分頁一次拉完（班級人數與作業數都不大，一次拉完最單純） */
  function callAll(path, params, key) {
    var out = [];
    function page(tokenPage) {
      var p = {};
      for (var k in params) p[k] = params[k];
      p.pageSize = 100;
      if (tokenPage) p.pageToken = tokenPage;
      return call(path, p).then(function (r) {
        out = out.concat(r[key] || []);
        return r.nextPageToken ? page(r.nextPageToken) : out;
      });
    }
    return page('');
  }

  /** 我教的課（只列進行中的） */
  function courses() {
    return callAll('/courses', { teacherId: 'me', courseStates: 'ACTIVE' }, 'courses');
  }

  /** 這門課的作業 */
  function coursework(courseId) {
    return callAll('/courses/' + courseId + '/courseWork', {}, 'courseWork');
  }

  /** 這份作業的所有繳交 */
  function submissions(courseId, courseWorkId) {
    return callAll('/courses/' + courseId + '/courseWork/' + courseWorkId + '/studentSubmissions',
                   {}, 'studentSubmissions');
  }

  /** 這門課的學生：userId → { email, name } */
  function roster(courseId) {
    return callAll('/courses/' + courseId + '/students', {}, 'students').then(function (list) {
      var map = {};
      (list || []).forEach(function (s) {
        var p = s.profile || {};
        map[s.userId] = {
          email: (p.emailAddress || '').toLowerCase(),
          name: (p.name && p.name.fullName) || ''
        };
      });
      return map;
    });
  }

  /* ===== 純資料處理（沒有網路，可以單獨測） ===== */

  /**
   * 把一筆繳交整理成審核頁要的樣子。
   *
   * Classroom 的 studentSubmission 欄位很雜，這裡只挑用得到的，
   * 並把附件統一成 { title, link, kind }：
   *   driveFile / link / youTubeVideo / form 四種都可能出現，
   *   學生用手機錄影上傳多半是 driveFile，貼 YouTube 連結則是 youTubeVideo。
   */
  function normalize(sub, rosterMap) {
    var who = (rosterMap || {})[sub.userId] || {};
    var att = ((sub.assignmentSubmission || {}).attachments) || [];
    return {
      id: sub.id,
      userId: sub.userId,
      // 再轉一次小寫：學號是從 email 換算的，大小寫不一致就對不回名冊
      email: String(who.email || '').toLowerCase(),
      name: who.name || '',
      state: sub.state || '',                       // TURNED_IN / CREATED / RETURNED…
      late: !!sub.late,
      updatedAt: sub.updateTime || '',
      attachments: att.map(function (a) {
        if (a.driveFile) return { kind: 'drive', title: a.driveFile.title || '（未命名檔案）', link: a.driveFile.alternateLink || '' };
        if (a.youTubeVideo) return { kind: 'youtube', title: a.youTubeVideo.title || 'YouTube 影片', link: a.youTubeVideo.alternateLink || '' };
        if (a.link) return { kind: 'link', title: a.link.title || a.link.url || '連結', link: a.link.url || '' };
        if (a.form) return { kind: 'form', title: a.form.title || '表單', link: a.form.formUrl || '' };
        return { kind: 'other', title: '（無法辨識的附件）', link: '' };
      })
    };
  }

  /** 交了沒（有附件而且狀態是已繳交才算） */
  function handedIn(row) {
    return row.state === 'TURNED_IN' && row.attachments.length > 0;
  }

  /**
   * 附件看起來是圖片還是影片。
   *
   * ⚠️ 只是「看起來」—— Classroom 不保證給得到副檔名或 MIME。
   *    所以這只用來排序與提示，最後仍然由老師點開確認再給分。
   *    寧可標成「看不出來」，也不要猜錯讓老師誤以為系統驗過了。
   */
  function guessKind(att) {
    var t = String(att.title || '').toLowerCase();
    if (att.kind === 'youtube') return 'video';
    if (/\.(png|jpe?g|gif|webp|svg|bmp|heic)$/.test(t)) return 'image';
    if (/\.(mp4|mov|avi|mkv|webm|m4v|3gp)$/.test(t)) return 'video';
    return 'unknown';
  }

  global.CLASSROOM = {
    init: init,
    ready: ready,
    signedIn: signedIn,
    signIn: signIn,
    signOut: signOut,
    courses: courses,
    coursework: coursework,
    submissions: submissions,
    roster: roster,
    normalize: normalize,
    handedIn: handedIn,
    guessKind: guessKind,
    _explainAuthError: explainAuthError,
    enableApiUrl: enableApiUrl,
    projectNumber: projectNumber,
    SCOPES: SCOPES
  };

})(window);
