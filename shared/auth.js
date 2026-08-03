/* =====================================================================
   學校 Google 帳號登入（單一來源）
   ---------------------------------------------------------------------
   帳號格式  學生：qfm{7 位學號}@mail.qfm.kh.edu.tw
             老師：suyungsheng@mail.qfm.kh.edu.tw（固定）

   為什麼值得改用 Google 帳號：
     email 直接由學號組出來，安全規則就能寫出「只有本人能寫自己的進度」——
     這是匿名登入時期做不到的事（規則認不出誰是誰）。
     順帶把驗證碼整套（secret／session／忘記重設）都省掉。

   ⚠️ 這裡的判斷與 shared/firestore.rules 的 isOwner()／isTeacher() 必須一致。
      前端這一份只是為了「早點給使用者正確的訊息」，
      真正把關的是安全規則 —— 前端怎麼改都繞不過去。

   ---------------------------------------------------------------------
   用法（各頁的 Firebase SDK 版本不同，所以由頁面把函式注入進來）：

     AUTH.configure({ auth, GoogleAuthProvider, signInWithPopup, signOut });
     const me = await AUTH.signIn();     // { sid, email, name, isTeacher }
   ===================================================================== */
(function (global) {
  'use strict';

  var DOMAIN = 'mail.qfm.kh.edu.tw';
  var PREFIX = 'qfm';
  var TEACHER = 'suyungsheng@' + DOMAIN;

  var fb = null;      // { auth, GoogleAuthProvider, signInWithPopup, signOut }

  function configure(deps) { fb = deps; }

  /** email → 學號。不是學校學生帳號就回空字串。 */
  function sidFromEmail(email) {
    email = String(email || '').toLowerCase().trim();
    if (email.indexOf('@' + DOMAIN) < 0) return '';
    var local = email.split('@')[0];
    if (local.indexOf(PREFIX) !== 0) return '';
    var sid = local.slice(PREFIX.length);
    return /^\d{7}$/.test(sid) ? sid : '';
  }

  /** 學號 → email（規則裡 isOwner() 就是這樣組的） */
  function emailFromSid(sid) {
    return PREFIX + String(sid || '') + '@' + DOMAIN;
  }

  function isTeacherEmail(email) {
    return String(email || '').toLowerCase().trim() === TEACHER;
  }

  /* 錯誤碼 → 白話說明。
     出錯時使用者最需要知道的不是代碼，而是「這是誰的問題、該找誰」。 */
  var HINT = {
    'auth/operation-not-allowed':
      '系統還沒開啟 Google 登入，請聯絡老師。',
    'auth/unauthorized-domain':
      '這個網址還沒被授權，請聯絡老師。',
    'auth/popup-blocked':
      '瀏覽器擋掉了登入視窗。請允許彈出視窗後再試一次。',
    'auth/popup-closed-by-user':
      '登入視窗被關閉了，請再試一次。',
    'auth/cancelled-popup-request':
      '有另一個登入視窗還開著，關掉它再試一次。',
    'auth/network-request-failed':
      '網路連線有問題，請確認網路後再試。',
    'auth/internal-error':
      '登入被中斷。若一直失敗，可能是學校帳號的權限設定，請聯絡老師。'
  };

  function hintFor(code) {
    return HINT[code] || ('登入失敗（' + code + '），請聯絡老師。');
  }

  /**
   * 用學校 Google 帳號登入。
   * @returns {Promise<{sid,email,name,isTeacher}>}
   *          非學校帳號會被擋下並自動登出，丟出帶 friendly 訊息的錯誤。
   */
  function signIn() {
    if (!fb) return Promise.reject(new Error('AUTH 尚未 configure()'));

    var provider = new fb.GoogleAuthProvider();
    // hd 只是請 Google 優先顯示學校帳號，不是安全限制；
    // 真正的把關在下面的網域檢查與安全規則。
    provider.setCustomParameters({ hd: DOMAIN, prompt: 'select_account' });

    return fb.signInWithPopup(fb.auth, provider).then(function (cred) {
      var u = cred.user;
      var email = String(u.email || '').toLowerCase();

      if (!u.emailVerified) {
        return reject(u, '這個帳號的 email 尚未驗證，請聯絡老師。');
      }
      if (isTeacherEmail(email)) {
        return { sid: '', email: email, name: u.displayName || '老師', isTeacher: true };
      }

      var sid = sidFromEmail(email);
      if (!sid) {
        return reject(u,
          '請用學校的帳號登入（' + PREFIX + '學號@' + DOMAIN + '）。\n' +
          '你剛才用的是：' + email);
      }
      return { sid: sid, email: email, name: u.displayName || '', isTeacher: false };
    });
  }

  /** 擋下不該進來的帳號時，順手把它登出，免得殘留在瀏覽器裡造成困惑 */
  function reject(user, message) {
    var done = fb.signOut ? fb.signOut(fb.auth) : Promise.resolve();
    return done.catch(function () {}).then(function () {
      var e = new Error(message);
      e.friendly = message;
      throw e;
    });
  }

  function signOut() {
    if (!fb || !fb.signOut) return Promise.resolve();
    return fb.signOut(fb.auth);
  }

  /* ===================================================================
     分頁的身分維護（每一頁進站時呼叫一次）
     -------------------------------------------------------------------
     核心觀念：**Google 登入時，身分以 Firebase 為準，不以分頁為準。**

     Firebase 的登入狀態存在 localStorage，是「整個瀏覽器一份」，
     而且會自動同步到所有分頁；
     我們自己的 sessionStorage 學號卻是「每個分頁一份」。
     兩者不同步就會出事 —— 2026-08-03 實測到的情形：
       在第二個分頁登入另一個帳號，Firebase 那邊已經換人了，
       第一個分頁卻毫不知情，看起來一切正常，
       實際上它手上拿的是別人的令牌；再加上規則裡舊的匿名路徑還在
       （isSignedIn 就能寫），它照樣寫得進去，等於 isOwner() 白裝。

     所以這裡讓 sessionStorage 一律跟著 Firebase 走：

       ① 完全沒有登入紀錄 → 匿名登入（舊的驗證碼流程還要能用）。
          不能直接呼叫 signInAnonymously，會把既有的 Google 身分蓋掉。
          也不能只判斷 auth.currentUser：頁面剛載入時 Firebase 還在
          非同步還原，currentUser 可能暫時是 null，判斷完就搶先登入，
          一樣會蓋掉。要等第一次 onAuthStateChanged 回報之後再決定。

       ② Firebase 是學校 Google 帳號：
          · 分頁原本是別人 → 強制換成新的人並重新整理。
            這不是選擇題：令牌已經換了，畫面不跟著換只會騙人。
          · 分頁原本沒有身分 → **不自動登入**，只回報「偵測到誰」。
            ⚠️ 電腦教室是共用的：Google 的登入狀態存在 localStorage，
               關掉分頁不會消失。若這裡自動沿用，
               前一位同學沒按登出就走人，下一位打開就變成他了。
               所以交給闖關基地問一句「是你嗎？」，一鍵繼續或換帳號。

       ③ Firebase 是老師帳號（或不是學校帳號）→ 這個分頁沒有學生身分，
          清掉並導回闖關基地說明原因。

     各頁的 SDK 版本不同，所以函式由呼叫端傳進來。

     @returns {Promise<user|null>} 目前的使用者（匿名登入失敗時回 null）
     =================================================================== */
  function attachSession(auth, signInAnonymously, onAuthStateChanged, opts) {
    opts = opts || {};
    var cfg  = global.CONFIG || {};
    var term = opts.term || cfg.TERM ||
               (String(global.location && global.location.pathname || '').match(/\/(115\d{2})\//) || [])[1];
    var hub  = opts.hub || cfg.HUB_PAGE || 'hub.html';
    var first = true;

    return new Promise(function (resolve) {
      onAuthStateChanged(auth, function (user) {
        // 每次狀態變動都要同步，不只第一次 —— 別的分頁換人時就是靠這個
        if (user && user.email) {
          var r = syncSid(user, term);
          if (r === 'changed')    { reload(opts); return; }    // 換人了，畫面要重來
          if (r === 'notstudent') { toHubSwitched(user, term, hub, opts); return; }
          if (r === 'detected' && typeof opts.onDetect === 'function') {
            opts.onDetect(user, sidFromEmail(user.email));
          }
        }

        if (!first) return;
        first = false;
        if (user) return resolve(user);
        signInAnonymously(auth)
          .then(function (cred) { resolve(cred && cred.user); })
          .catch(function (e) { console.error('匿名登入失敗', e); resolve(null); });
      });
    });
  }

  /**
   * 把 Firebase 的 Google 身分同步到這個分頁的 sessionStorage。
   * @returns 'same' 沒變／'detected' 這個分頁還沒身分（交給呼叫端問）／
   *          'changed' 分頁原本是別人（已強制換掉）／'notstudent' 不是學生帳號
   */
  function syncSid(user, term) {
    var sid = sidFromEmail(user.email);
    if (!sid) return 'notstudent';              // 老師或外部帳號

    var tabSid = null;
    try { tabSid = sessionStorage.getItem('sid' + term); } catch (e) {}
    if (tabSid === sid) return 'same';

    // 分頁還沒有身分：不擅自登入，只回報偵測到誰（理由見上面的說明）
    if (!tabSid) return 'detected';

    try {
      sessionStorage.setItem('sid' + term, sid);
      sessionStorage.removeItem('me' + term);   // 姓名快取是前一個人的，一定要清
    } catch (e) {}
    return 'changed';
  }

  /* 換人之後重新整理。
     不會無限重整：sessionStorage 已經寫成新學號，下一次載入就是 'same'。
     ⚠️ 也因此「登出」一定要連 Firebase 一起登出，否則清掉 sessionStorage
        之後這裡會立刻把身分再撿回來，看起來像登不出去。 */
  function reload(opts) {
    if (typeof opts.onSwitch === 'function') { opts.onSwitch(); return; }
    try { global.location.reload(); } catch (e) {}
  }

  /** 不是學生帳號（老師或外部帳號）：這個分頁沒有身分可用 */
  function toHubSwitched(user, term, hub, opts) {
    try {
      sessionStorage.removeItem('sid' + term);
      sessionStorage.removeItem('me'  + term);
    } catch (e) {}
    if (typeof opts.onMismatch === 'function') { opts.onMismatch(user); return; }
    try {
      global.location.replace(hub + '?switched=' + encodeURIComponent(user.email || ''));
    } catch (e) {}
  }

  global.AUTH = {
    DOMAIN: DOMAIN,
    PREFIX: PREFIX,
    TEACHER_EMAIL: TEACHER,
    configure: configure,
    signIn: signIn,
    signOut: signOut,
    attachSession: attachSession,
    sidFromEmail: sidFromEmail,
    emailFromSid: emailFromSid,
    isTeacherEmail: isTeacherEmail,
    hintFor: hintFor
  };

})(window);
