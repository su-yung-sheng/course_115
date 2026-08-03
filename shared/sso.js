/* =====================================================================
   全站單一登入（SSO）— 兩學期共用
   ---------------------------------------------------------------------
   規則：登入與登出「只在闖關基地（hub）做」。
        各關卡頁不再有自己的登入表單與登出鈕。

   運作方式：
     1. 學生在 hub 用「學號＋驗證碼」登入 → hub 寫入 sessionStorage['sid' + 學期]
     2. 各關卡頁載入時呼叫 SSO.resolve()，從 {學期}-roster 帶出
        班級／座號／姓名，直接進入內容，不再詢問任何身分資訊
     3. 查不到名冊 → 導回 hub 重新確認身分（不讓學生自己亂填）

   為什麼可以信任 sessionStorage 裡的學號：
     guard.js 已經擋掉「沒登入就直接開網址」的情形；
     能走到這裡代表已經過 hub 驗證，這裡不再重複驗證碼比對。

   ⚠️ 已知限制（2026-08-03 確認）：
     sessionStorage 是「每個分頁各一份」，所以同一台電腦開兩個分頁
     就能同時登入兩個不同學號 —— 這是瀏覽器的規格，不是 bug。
     真正的解法是改用學校 Google 帳號（見 shared/auth.js）：
     Firebase 的 Google session 跨分頁共用，而且安全規則的 isOwner()
     會擋掉「寫別人的進度」。在那之前，前端擋不住知道別人驗證碼的人。

   ---------------------------------------------------------------------
   用法（各頁面自己提供「怎麼讀 Firestore」，因為各頁用的 SDK 版本不同）：

     const me = await SSO.resolve(async (sid) => {
       // 回傳該學號的名冊資料物件，查無則回傳 null
       const snap = await getDoc(doc(db, SSO.ROSTER, sid));
       return snap.exists() ? snap.data() : null;
     });
     // me = { sid, cls, no, name }；失敗時 resolve 會自動導回 hub 並回傳 null
   ===================================================================== */
(function (global) {
  'use strict';

  /* ★ 身分存在 sessionStorage，不是 localStorage：
        關閉瀏覽器（或該分頁）就失效，下一個使用者不會沿用前一個人的身分。
        電腦教室是共用的，這一點比「免得重打」重要。

     舊版存在 localStorage，會一直殘留。這裡順手清掉，
     否則舊的殘留值會讓人以為「沒輸入帳號卻自動登入了」。 */
  try {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && /^(sid|me)115\d{2}$/.test(k)) localStorage.removeItem(k);
    }
  } catch (e) {}

  // 學期一律由 config.js 決定，這支不寫死任何學期編號
  var CFG       = global.CONFIG || {};
  var TERM      = CFG.TERM || (location.pathname.match(/115\d{2}/) || ['11501'])[0];
  var SID_KEY   = 'sid' + TERM;
  var CACHE_KEY = 'me'  + TERM;       // 完整身分快取（hub 登入時就寫好，各頁直接用）
  var HUB       = CFG.HUB_PAGE || 'hub.html';
  var SID_RE    = /^14\d{5}$/;        // 學號：7 位數字、14 開頭
  var MAX_AGE   = 12 * 60 * 60 * 1000;  // 快取 12 小時，過期就在背景重讀一次

  function embedded() {
    return global.self !== global.top;   // 被嵌在 iframe 裡 → 由外層頁負責身分
  }

  /** 取得已登入的學號；沒有或格式不對回傳 null */
  function sid() {
    try {
      var v = sessionStorage.getItem(SID_KEY);
      return (v && SID_RE.test(v)) ? v : null;
    } catch (e) { return null; }
  }

  /** 導回闖關基地確認身分，登入後自動回到原頁 */
  function toHub(reason) {
    if (reason) { try { console.warn('[SSO] ' + reason); } catch (e) {} }
    var here = location.pathname.split('/').pop() + location.search;
    location.replace(HUB + '?next=' + encodeURIComponent(here));
  }

  /* 身分快取和學號一樣放 sessionStorage：
     hub 登入時就寫好完整身分，各關卡頁一進站同步就拿得到，
     不必等 Firestore，也就不會出現「正在確認身分…」的停格畫面。

     ⚠️ 快取一定要跟學號同一種儲存體。放 localStorage 的話，
        關掉分頁學號沒了、姓名班級卻還在，下一個人會看到別人的名字。
        （這段註解原本寫的是 localStorage，與實際程式不符，2026-08-03 更正。） */
  function readCache(id) {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (!c || c.sid !== id) return null;
      c.stale = !c.at || (Date.now() - c.at > MAX_AGE);   // 過期仍可先用，背景再更新
      return c;
    } catch (e) { return null; }
  }

  function writeCache(me) {
    me.at = Date.now();
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(me)); } catch (e) {}
  }

  /** 同步取得身分（有快取才有值）。要立刻畫面就緒的頁面用這支。 */
  function me() {
    var id = sid();
    return id ? readCache(id) : null;
  }

  /**
   * 解析目前登入者的完整身分。
   * @param {function(string): Promise<Object|null>} readRoster 讀 {學期}-roster/{學號}
   * @param {Object} [opts] { silent:true 代表查不到時不要導頁，只回傳 null }
   * @returns {Promise<{sid,cls,no,name}|null>}
   */
  async function resolve(readRoster, opts) {
    opts = opts || {};
    var id = sid();

    if (!id) {
      if (!opts.silent && !embedded()) toHub('尚未登入');
      return null;
    }

    // 有快取就立即回傳（hub 登入時已寫好）；過期的話仍先用，背景默默更新
    var cached = readCache(id);
    if (cached && !cached.stale) return cached;
    if (cached && cached.stale) {
      Promise.resolve()
        .then(function () { return readRoster(id); })
        .then(function (d) { if (d) writeCache(toMe(id, d)); })
        .catch(function () {});
      return cached;
    }

    var data = null;
    try {
      data = await readRoster(id);
    } catch (e) {
      console.error('[SSO] 讀取名冊失敗', e);
      return null;                    // 網路或權限問題：不要把學生踢回 hub 空轉
    }

    if (!data) {
      if (!opts.silent && !embedded()) toHub('名冊查無此學號：' + id);
      return null;
    }

    var profile = toMe(id, data);
    writeCache(profile);
    return profile;
  }

  function toMe(id, data) {
    return {
      sid:  id,
      cls:  String(data.cls  || ''),
      no:   String(data.no   || ''),
      name: String(data.name || ''),
      key:  String(data.key  || ((data.cls || '') + '_' + (data.no || '') + '_' + (data.name || '')))
    };
  }

  /** 登出一律回 hub 處理，各頁不要自己實作 */
  function logout() {
    try { sessionStorage.removeItem(SID_KEY); } catch (e) {}
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
    location.href = HUB;
  }

  global.SSO = {
    sid: sid,
    me: me,               // 同步取身分（有快取才有值）
    resolve: resolve,     // 非同步取身分（沒快取時會讀名冊）
    logout: logout,
    toHub: toHub,
    embedded: embedded,
    SID_KEY: SID_KEY,
    CACHE_KEY: CACHE_KEY,
    ROSTER: (CFG.COLLECTIONS && CFG.COLLECTIONS.ROSTER) || (TERM + '-roster'),
    TERM: TERM
  };
})(window);
