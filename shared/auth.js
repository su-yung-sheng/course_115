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

  /**
   * 沒有任何登入紀錄時才匿名登入。
   *
   * ⚠️ 為什麼不能直接呼叫 signInAnonymously：
   *    Firebase 的登入狀態是「整個網域共用」的（存在 localStorage）。
   *    學生在闖關基地用學校 Google 帳號登入後，只要任何一頁再跑一次
   *    signInAnonymously，就會把 Google 身分換成匿名的——
   *    安全規則的 isOwner() 立刻失效，而且畫面上完全看不出來。
   *
   * ⚠️ 也不能只判斷 auth.currentUser：頁面剛載入時 Firebase 還在
   *    非同步還原登入狀態，currentUser 可能暫時是 null，
   *    判斷完就搶先匿名登入，一樣會蓋掉。所以要等第一次
   *    onAuthStateChanged 回報之後再決定。
   *
   * 各頁的 SDK 版本不同，所以函式由呼叫端傳進來。
   *
   * @returns {Promise<user|null>} 目前的使用者（匿名登入失敗時回 null）
   */
  function anonIfNeeded(auth, signInAnonymously, onAuthStateChanged) {
    return new Promise(function (resolve) {
      var stop = onAuthStateChanged(auth, function (user) {
        stop();                                   // 只看第一次回報
        if (user) return resolve(user);           // 已經有身分（Google 或先前的匿名）
        signInAnonymously(auth)
          .then(function (cred) { resolve(cred && cred.user); })
          .catch(function (e) { console.error('匿名登入失敗', e); resolve(null); });
      });
    });
  }

  global.AUTH = {
    DOMAIN: DOMAIN,
    PREFIX: PREFIX,
    TEACHER_EMAIL: TEACHER,
    configure: configure,
    signIn: signIn,
    signOut: signOut,
    anonIfNeeded: anonIfNeeded,
    sidFromEmail: sidFromEmail,
    emailFromSid: emailFromSid,
    isTeacherEmail: isTeacherEmail,
    hintFor: hintFor
  };

})(window);
