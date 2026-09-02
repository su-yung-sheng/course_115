/* 運算思維截圖上傳：號碼牌制的前端（11501／11502 共用）
   用法：window.submitScreenshot({ ... }) → Promise<{ok, status, data}>

   ⚠️⚠️ 2026-09-02 實測，一張截圖要 24 秒（2 個 CPU 名額並行時完成一張的間隔），
      而原本的上傳逾時是 180 秒 —— **只夠撐到第 7～8 位**。
      第 9 位以後，後端其實跑完也判過了，前端卻已經放棄連線：
      學生看到「連線錯誤」，那張圖白跑，重傳還要重新排到最後。
   ★ 這不是「等太久」的體驗問題，是「後半班一定失敗」的可靠性問題。

   ⇒ 改成號碼牌：上傳完立刻拿到 ticket，連線就結束（沒有逾時天花板了），
     之後拿 ticket 去 /result 換結果。中途關掉頁面也接得回去。

   ★★ 為什麼放在 shared/ 而不是兩個 thinking.html 各寫一份：
      這個 repo 已經在「同一件事兩個地方各做一次」上吃過好幾次虧 ——
      11501 有 autoSizeGraderFrame、11502 沒有；十關對照表我手打第二份
      結果十關錯七關。漏掉的那一邊**不會有任何錯誤訊息**。 */
(function () {
  'use strict';

  var H = { 'ngrok-skip-browser-warning': '1' };

  /* 輪詢間隔：一開始密一點（快好了的人不必等），之後拉長。
     ⚠️ 30 人同時輪詢，固定 2 秒就是每分鐘 900 次請求，
        而且正好發生在後端最忙的時候。 */
  var POLL_START_MS = 3000;
  var POLL_MAX_MS = 10000;
  /* ⚠️ 一定要有總上限：後端如果卡住不動，不能讓學生無限等下去。
     20 分鐘 ≈ 全班 30 人跑完還有餘裕（實測 24 秒／張）。 */
  var GIVE_UP_MS = 20 * 60 * 1000;
  /* 號碼牌在後端只留 30 分鐘（_JOB_TTL），這邊留短一點，
     免得拿一張後端已經清掉的牌去問。 */
  var TICKET_KEEP_MS = 25 * 60 * 1000;

  function sleep(ms, signal) {
    return new Promise(function (res, rej) {
      var t = setTimeout(res, ms);
      if (signal) {
        signal.addEventListener('abort', function () {
          clearTimeout(t);
          var e = new Error('aborted');
          e.name = 'AbortError';
          rej(e);
        }, { once: true });
      }
    });
  }

  /* ── 號碼牌的暫存（讓學生關掉頁面再回來還接得回去）──────────
     ⚠️ localStorage 讀寫一律包 try：無痕模式或關掉儲存時會直接拋，
        而這只是個方便功能，絕對不可以因此讓上傳失敗。 */
  function saveTicket(key, ticket, challengeId) {
    try {
      localStorage.setItem(key, JSON.stringify({
        t: ticket, at: Date.now(), ch: challengeId || ''
      }));
    } catch (e) { /* 存不了就算了，只是少了「關掉再回來」的便利 */ }
  }

  function clearTicket(key) {
    try { localStorage.removeItem(key); } catch (e) { }
  }

  function loadTicket(key, challengeId) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var j = JSON.parse(raw);
      if (!j || !j.t) return null;
      /* 過期、或這張牌是別關的 → 不要用（拿去問只會得到別關的結果） */
      if (Date.now() - (j.at || 0) > TICKET_KEEP_MS) { clearTicket(key); return null; }
      if (challengeId && j.ch && j.ch !== challengeId) return null;
      return j.t;
    } catch (e) { return null; }
  }

  /* ── 拿號碼牌換結果 ────────────────────────────────── */
  async function waitForResult(opt, ticket) {
    var started = Date.now();
    var wait = POLL_START_MS;
    while (true) {
      if (Date.now() - started > GIVE_UP_MS) {
        clearTicket(opt.storageKey);
        return {
          ok: false, status: 'timeout',
          data: {
            status: 'error',
            message: '等超過 20 分鐘還沒有結果 —— 後端可能中途停掉了。'
              + '⚠️ 這不是你的截圖有問題，請告訴老師，稍後再傳一次。'
          }
        };
      }
      await sleep(wait, opt.signal);
      wait = Math.min(POLL_MAX_MS, Math.round(wait * 1.3));

      var r;
      try {
        r = await fetch(opt.base + '/result/' + encodeURIComponent(ticket), {
          headers: H, cache: 'no-store', signal: opt.signal
        });
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        /* ⚠️ 單次查詢失敗**不算失敗** —— 網路抖一下、或後端正忙著辨識
           回得慢，都會走到這裡。號碼牌還在，繼續問就好。
           這裡如果直接判失敗，就等於把原本要修掉的問題換個地方重演。 */
        continue;
      }

      var j = null;
      try { j = await r.json(); } catch (e) { continue; }

      if (r.status === 404) {
        /* 後端重啟過，或號碼牌過期 */
        clearTicket(opt.storageKey);
        return { ok: false, status: 'gone', data: j || { status: 'error', message: '號碼牌已失效，請重新上傳。' } };
      }
      if (j && (j.status === 'queued' || j.status === 'working')) {
        if (opt.onQueue) {
          opt.onQueue(Math.max(0, Number(j.ahead) || 0), Number(j.avg_seconds) || 0);
        }
        continue;
      }
      /* 到這裡就是有結果了（成功、判不過、或後端回報的錯誤） */
      clearTicket(opt.storageKey);
      return { ok: r.ok, status: 'done', data: j };
    }
  }

  /* ── 主要入口 ──────────────────────────────────────
     opt = { base, formData, signal, storageKey, challengeId, onQueue, onTicket } */
  async function submitScreenshot(opt) {
    var ticket = null;

    try {
      var r = await fetch(opt.base + '/analyze-async', {
        method: 'POST', headers: H, body: opt.formData, signal: opt.signal
      });
      if (r.ok) {
        var j = await r.json();
        if (j && j.ticket) {
          ticket = j.ticket;
          if (opt.onQueue) {
            opt.onQueue(Math.max(0, Number(j.ahead) || 0), Number(j.avg_seconds) || 0);
          }
        }
      } else if (r.status !== 404) {
        /* 400（沒收到圖片）、429（同一人已有一張在跑）這類 ——
           後端把話講得很清楚了，照原樣交給呼叫端顯示。 */
        var jb = null;
        try { jb = await r.json(); } catch (e) { }
        return { ok: false, status: 'rejected', data: jb, httpStatus: r.status };
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      /* 連不上 → 有可能只是這個端點不存在，讓下面的同步流程再試一次 */
    }

    if (!ticket) {
      /* ⚠️⚠️ 舊後端沒有 /analyze-async。**一定要能退回同步流程** ——
         老師還沒重新執行 notebook 的那段時間（可能是一整節課），
         前端不可以壞掉。這條退路比號碼牌本身更重要。 */
      var res = await fetch(opt.base + '/analyze', {
        method: 'POST', headers: H, body: opt.formData, signal: opt.signal
      });
      var data = null;
      try { data = await res.json(); } catch (e) { }
      return { ok: res.ok, status: 'sync', data: data, httpStatus: res.status };
    }

    saveTicket(opt.storageKey, ticket, opt.challengeId);
    if (opt.onTicket) opt.onTicket(ticket);
    return await waitForResult(opt, ticket);
  }

  window.submitScreenshot = submitScreenshot;
  window.resumeScreenshot = function (opt) {
    /* 頁面重開時：如果上次有沒領走的號碼牌，就接回去。
       ⚠️ 沒有的話回 null，呼叫端要當成「沒事發生」，不可以顯示錯誤。 */
    var t = loadTicket(opt.storageKey, opt.challengeId);
    if (!t) return null;
    if (opt.onTicket) opt.onTicket(t);
    return waitForResult(opt, t);
  };
  window.__ocrClientInternals = { loadTicket: loadTicket, clearTicket: clearTicket };
})();
