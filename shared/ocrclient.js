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

  /* ══════════════════════════════════════════════════════════
     雲端路徑：圖片直接傳到 GAS，Colab 有空再取來辨識
     ══════════════════════════════════════════════════════════
     ⚠️⚠️ 2026-09-03 老師：「圖片都上傳到雲端了，為什麼還會滿載
        讓使用者無法上傳？」—— 因為上傳這個動作原本**還是打在 Colab 上**。
        Colab 一忙，/health 回得慢、判離線、鎖按鈕，學生連傳都傳不出去。
     ★ 這條路把上傳打到 GAS：Colab 掛掉、滿載都不影響學生上傳。
       圖在雲端等著，後端有空再處理。

     ⚠️ 進度和結果仍然問 Colab（讀它的記憶體快取，很快）——
        Colab 掛掉時看不到進度，但**圖已經安全**，之後會處理完，
        學生下次登入也會自動補記。這是刻意的取捨：
        上傳不能依賴 Colab，顯示可以。

     ★ 「還在暫存區」＝「還沒處理完」。所以判斷「我好了沒」的方式是
       「我的檔案從排隊清單消失了」，不必另外做狀態機。 */

  function fileToBase64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result || '');
        var i = s.indexOf(',');
        res(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = function () { rej(new Error('讀不到這個檔案')); };
      r.readAsDataURL(file);
    });
  }

  /* opt = { gasUrl, gasKey, term, sid, file, base（Colab）, onQueue, signal } */
  async function submitViaCloud(opt) {
    var fname = (opt.file && opt.file.name) || 'shot.png';
    /* ⚠️ 檔名前面加學號 —— 後端靠它認出是誰傳的，
       而關卡靠原檔名本身（「滑梯公園 - Google Chrome ….png」）。
       ★ 只加一個「-」：後端用 partition('-') 切第一個，
         關卡名和時間戳裡的「-」不會被切壞。 */
    var upName = (String(opt.sid || '').trim() ? opt.sid + '-' : '') + fname;

    var b64 = await fileToBase64(opt.file);
    var r = await fetch(opt.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        kind: 'temp', key: opt.gasKey, term: String(opt.term || ''),
        fileName: upName,
        mimeType: (opt.file && opt.file.type) || 'image/png',
        base64: b64
      }),
      signal: opt.signal
    });
    var j = null;
    try { j = await r.json(); } catch (e) { }
    if (!j || !j.success) {
      /* ⚠️ 上傳失敗是**唯一**會讓學生白做的一步，訊息要具體。 */
      return { ok: false, status: 'upload_failed',
               data: { status: 'error',
                       message: '截圖沒有上傳成功 —— ' +
                                ((j && j.message) || '請檢查網路，再試一次。') } };
    }
    return { ok: true, status: 'queued', data: j, upName: upName };
  }

  /* 等雲端那條路的結果。
     ★ 判斷「我好了沒」＝「我的檔案從排隊清單消失了」——
       不必另外做狀態機，因為後端處理完就刪檔。
     opt = { base, sid, term, level, onQueue, signal } */
  async function waitViaCloud(opt, upName) {
    var started = Date.now();
    var wait = POLL_START_MS;
    var seenInQueue = false;      /* ⚠️ 見下 */
    var gone = 0;

    while (true) {
      if (Date.now() - started > GIVE_UP_MS) {
        return { ok: false, status: 'timeout', data: { status: 'error',
          message: '等超過 20 分鐘還沒有結果。⚠️ 你的截圖已經在雲端，'
                 + '不會不見 —— 請告訴老師，之後會自動補記。' } };
      }
      await sleep(wait, opt.signal);
      wait = Math.min(POLL_MAX_MS, Math.round(wait * 1.3));

      var list = null;
      try {
        var qr = await fetch(opt.base + '/api/queue-list',
                             { headers: H, cache: 'no-store', signal: opt.signal });
        var qj = await qr.json();
        list = (qj && qj.queue) || [];
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        /* ⚠️ 問不到排隊清單**不算失敗**：Colab 可能忙或掛了，
           但圖在雲端，之後照樣會被處理。繼續等就好。 */
        continue;
      }

      if (opt.onQueue) opt.onQueue(list);

      var mine = list.some(function (x) {
        return ((x.student_id ? x.student_id + '-' : '') + x.name) === upName;
      });
      if (mine) { seenInQueue = true; gone = 0; continue; }

      /* ⚠️⚠️ 還沒在清單裡出現過 → **不能當成處理完了**。
         後端每 8 秒才掃一次暫存區，剛上傳的那幾秒清單裡本來就沒有。
         沒有這個判斷的話，學生一送出就會被告知「沒過」。 */
      if (!seenInQueue) continue;

      /* 消失了 —— 但成績寫入和刪檔之間有時間差，多確認一輪再下結論 */
      gone += 1;
      if (gone < 2) continue;

      var passed = [];
      try {
        var pr = await fetch(opt.base + '/api/my-passed?student_id='
                   + encodeURIComponent(opt.sid) + '&term='
                   + encodeURIComponent(opt.term),
                   { headers: H, cache: 'no-store', signal: opt.signal });
        var pj = await pr.json();
        passed = (pj && Array.isArray(pj.passed)) ? pj.passed : [];
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        continue;
      }

      var ok2 = passed.map(String).indexOf(String(opt.challengeId)) >= 0;
      if (ok2) {
        return { ok: true, status: 'done',
                 data: { status: 'success', pass: true, level: opt.level } };
      }

      /* ══════════════════════════════════════════════════════
         沒過的時候，去問後端**真正的**理由
         ══════════════════════════════════════════════════════
         ⚠️⚠️ 2026-09-03 老師：「如果失敗就直接換下一張嗎？」
            —— 後端處理完（含判定不通過）就刪檔換下一張，那是對的；
            問題是這裡看不到後端的回應，所以以前**寫死**一句
            「這張截圖上找不到『挑戰成功』」。
         ★ 但學生實際上可能是**截錯關卡**、或截圖沒含網址列 ——
           被指去重截徽章，照著錯的指示做，第二次還是不會過。
           而後端那幾句訊息是實戰一次次調出來的，最有診斷價值。
         ⇒ 後端把最近一次判定留在記憶體（/api/my-verdict），這裡去拿。
         ⚠️ 拿不到就退回原本那句 —— 後端重啟過、或舊版沒有這支，
            都不可以因此讓學生看到一個錯誤畫面。 */
      var fallback = ['這張截圖上找不到「挑戰成功」',
                      '請先在遊戲裡完成挑戰，看到成功畫面之後再截圖。'
                      + '⚠️ 截圖要包含中間那塊成功標示。'];
      var reasons = fallback;
      try {
        var vr = await fetch(opt.base + '/api/my-verdict?student_id='
                   + encodeURIComponent(opt.sid),
                   { headers: H, cache: 'no-store', signal: opt.signal });
        var vj = await vr.json();
        if (vj && vj.found && vj.verdict && vj.verdict.pass === false
            && Array.isArray(vj.verdict.reasons) && vj.verdict.reasons.length) {
          reasons = vj.verdict.reasons;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        /* 問不到就用 fallback —— 這是「講得更準」的加分，不是必要條件 */
      }

      return {
        ok: true, status: 'done',
        data: { status: 'success', pass: false, level: opt.level, reasons: reasons }
      };
    }
  }

  /* ══════════════════════════════════════════════════════════
     檔名 -> 關卡（學生端這一份）
     ══════════════════════════════════════════════════════════
     ⚠️⚠️ 2026-09-03「不用選關卡」之後，關卡完全由**檔名**決定。
        後端認不出檔名時，沒有任何人知道那是哪一關 ——
        兜底的關卡辨識也沒有 title 可以比對，成績會記不下去。
     ★ 所以要在「學生選檔案的當下」就擋，不要讓他傳出去白等：
       傳了才發現，他已經排了 20 分鐘的隊，而且圖還佔了暫存區。

     ⚠️ 規則要和後端 scratch_grader_core.level_from_filename **完全一樣**：
        ① 先看檔名開頭是不是關卡名
        ② 再看檔名任何位置有沒有關卡名（學號前綴、老師另存的檔名）
        兩邊寫得不一樣的話，會出現「學生端說可以、後端說不行」
        這種最難查的落差。⇒ 改一邊就要改另一邊，
        shared/tests/levelmap.test.py 盯著後端那一份和關卡表。

     challenges = thinking.html 的那個陣列（[{id, title, ...}]）。
     認不出來回 null —— 呼叫端要當成「這張不能傳」，不是「隨便挑一關」。 */
  function levelFromFilename(name, challenges) {
    var text = String(name || '');
    var list = challenges || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].title && text.indexOf(list[i].title) === 0) return list[i];
    }
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].title && text.indexOf(list[i].title) >= 0) return list[i];
    }
    return null;
  }

  window.levelFromFilename = levelFromFilename;
  window.waitViaCloud = waitViaCloud;
  window.submitViaCloud = submitViaCloud;
  window.fileToBase64 = fileToBase64;
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
