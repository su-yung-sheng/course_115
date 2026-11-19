/* =====================================================================
   模擬器通關 → 送給後端確認（下學期，老師 2026-11-18）
   ---------------------------------------------------------------------
   ★ 下學期程式設計：系統內的積木模擬器拼對＝通關（2⭐）。
     「不接受 F12 假造」⇒ 通關不由學生的瀏覽器寫，而是把拼出來的程式送給後端
     （11502/backend.ipynb 的 /api/sim/verify）：後端確認是本人、重新判定一次，
     對了才寫進學生改不了的欄位。
   ★ 後端沒開（Colab 還沒啟動、ngrok 斷了）時不可以讓學生白拼：
     程式先記在自己的進度文件（modules.scratch.simPending，學生寫得進去，但那**不是星星**），
     下次打開闖關地圖或這一關時自動補送；後端確認後會把那一筆刪掉。
   用法：
     SIMSUBMIT.send({ sid, unit, programs, log, getToken })  → 後端的回覆（code：ok／wrong／auth／offline…）
     SIMSUBMIT.shouldQueue(r)                                 → 這個結果要不要先記著、之後再送
     SIMSUBMIT.pendingOf(progressDoc)                         → 還沒送成功的 [{unit, programs, log}]
     SIMSUBMIT.retryPending(progressDoc, { sid, getToken })   → 補送全部，回傳每一筆的結果
   ===================================================================== */
(function (global) {
  'use strict';

  function base() { return String((global.CONFIG || {}).SERVER_URL || '').replace(/\/+$/, ''); }

  async function send(o) {
    o = o || {};
    var tok = '';
    try { tok = o.getToken ? (await o.getToken()) || '' : ''; } catch (e) { tok = ''; }
    if (!base()) return { ok: false, code: 'offline', msg: '沒有設定批改伺服器網址' };
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    try {
      var r = await fetch(base() + '/api/sim/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ sid: o.sid, unit: o.unit, programs: o.programs, log: o.log || {}, idToken: tok }),
        signal: ctl ? ctl.signal : undefined
      });
      var j = null;
      try { j = await r.json(); } catch (e) { j = null; }
      /* ⚠️ ngrok 離線時回的是一頁 HTML（r.json() 會丟例外），不是我們的後端 —— 當成「沒開」 */
      if (!j || typeof j.ok !== 'boolean') return { ok: false, code: 'offline', msg: '批改伺服器沒有回應（可能還沒開）' };
      return j;
    } catch (e) {
      return { ok: false, code: 'offline', msg: '連不上批改伺服器（可能還沒開）' };
    } finally { if (timer) clearTimeout(timer); }
  }

  /** 伺服器沒開、資料庫忙、題目暫時讀不到 ⇒ 先記著、之後再送。沒拼對、不是本人 ⇒ 不記（記了也不會過） */
  function shouldQueue(r) { return !!r && !r.ok && ['offline', 'db_error', 'no_judge'].indexOf(r.code) >= 0; }

  function pendingOf(doc) {
    var m = ((doc || {}).modules || {}).scratch || {};
    var pend = m.simPending || {}, sim = (((doc || {}).scratchVerified) || {}).sim || {};
    var out = [];
    Object.keys(pend).forEach(function (unit) {
      if (sim[unit]) return;                     // 後端已經確認過了（只是 pending 還沒刪到）
      var rec = pend[unit] || {}, programs = null;
      try { programs = JSON.parse(rec.p || 'null'); } catch (e) { programs = null; }
      if (Array.isArray(programs)) out.push({ unit: unit, programs: programs, log: rec.log || {} });
    });
    return out;
  }

  async function retryPending(doc, o) {
    var list = pendingOf(doc), res = [];
    for (var i = 0; i < list.length; i++) {
      var r = await send({ sid: o.sid, unit: list[i].unit, programs: list[i].programs, log: list[i].log, getToken: o.getToken });
      res.push({ unit: list[i].unit, r: r });
      if (r.code === 'offline') break;           // 伺服器沒開就不用一筆一筆試了
    }
    return res;
  }

  /** 要存進 simPending 的那一筆（⚠️ Firestore 不能存「陣列裡的陣列」，程式要先轉成字串） */
  function pendingRecord(programs, log) { return { p: JSON.stringify(programs || []), log: log || {}, at: Date.now() }; }

  global.SIMSUBMIT = { send: send, shouldQueue: shouldQueue, pendingOf: pendingOf,
                       retryPending: retryPending, pendingRecord: pendingRecord };
})(typeof window !== 'undefined' ? window : globalThis);
