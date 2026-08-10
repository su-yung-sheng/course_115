/* =====================================================================
   問問看：把「問題拆解」的某一問接上 AI 助教
   ---------------------------------------------------------------------
   這一支只做「前端那一半」：畫出對話框、送出去、把回來的話顯示出來。
   提示詞、題目、不可以說出口的內容、回覆檢查，全部在 GAS
   （shared/aiguide.gs）—— 學生按 F12 也改不到。

   ★ 三件非做不可的事，每一件都是實測踩出來的

     ① 逾時
        2026-08-07 實測，一則回覆最慢 9.4 秒。而 GAS 的網頁應用程式
        回應太久會被切斷，被切斷的回應是一頁 HTML，跨來源讀不到 ——
        瀏覽器只會說「Failed to fetch」，完全查不出原因。
        （那個症狀查了一整個下午。）
        所以這裡自己設逾時，時間到就當作「這次問不到」，走備援。

     ② 等待狀態
        3 到 9 秒沒有任何回饋，學生一定會再按一次 ——
        而每人一天只有 3 次，按第二下就少掉三分之一。
        所以按下去就要鎖住按鈕，而且要看得出來「它在動」。

     ③ 失敗就退回課本的提示
        額度、過載、網路、GAS 掛掉 —— 失敗的方式很多，而且都會發生。
        學生不該因為「AI 今天不舒服」就卡在那一關。
        失敗時直接把 hint（課本的說法）展開給他，
        雖然不是引導，但至少他走得下去。

   ★ 為什麼先在瀏覽器裡判一次關鍵概念
     全部講到就不必問 AI —— 省一次額度、省三秒等待，
     而且回饋是老師寫的、每次都一樣。
     ⚠️ 這不是「安全檢查」，只是省額度。伺服器端會再判一次，
        學生改前端也騙不到那邊。
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-07-askai';

  /* 逾時。
     ★ 為什麼是 20 秒不是 10：實測最慢 9.4 秒，
       上課時十幾個人同時按會更慢，切太早會把「本來會成功」的判成失敗。
     ★ 為什麼不是 60：學生等超過 20 秒就會去按別的地方了，
       等到回來也沒意義。 */
  var TIMEOUT_MS = 20000;

  function cfg() {
    return ((global.CONFIG || {}).AIGUIDE) || {};
  }

  /** 這個功能有沒有開（沒填 GAS_URL 或通行碼就是關的） */
  function enabled() {
    var c = cfg();
    return !!(c.GAS_URL && c.KEY);
  }

  /* 送出去。
     ⚠️ 一律用 GET。GAS 的 /exec 會 302 轉址，跨來源的 POST 在轉址之後
        會掉 CORS 標頭；而 application/json 會觸發預檢（OPTIONS），
        GAS 又不處理預檢。這兩個坑 2026-08-07 都踩過了。
     ⚠️ 參數不可以叫 sid —— 那是 Google 的保留參數，
        帶著它的請求根本到不了指令碼。學號用 student。 */
  function ask(unit, qi, answer, student) {
    var c = cfg();
    var url = c.GAS_URL + '?action=ask'
            + '&key=' + encodeURIComponent(c.KEY)
            + '&unit=' + encodeURIComponent(unit)
            + '&qi=' + encodeURIComponent(qi)
            + '&student=' + encodeURIComponent(student || '')
            + '&answer=' + encodeURIComponent(answer);

    /* AbortController 才切得斷 fetch。沒有它的話，逾時只是「不再理它」，
       請求還在跑、額度還是會被算走。 */
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);

    /* ★ 用 global.fetch 不用裸的 fetch。
       global 就是 window，兩者在瀏覽器裡是同一個東西 ——
       但寫成裸的 fetch 就沒辦法在測試裡替換掉它，
       於是「AI 不回應」「回來不是 JSON」「逾時」這幾條路一條都測不到。
       而那幾條路正是這一支存在的理由。 */
    return global.fetch(url, ctl ? { signal: ctl.signal } : {})
      .then(function (r) { return r.text(); })
      .then(function (t) {
        clearTimeout(timer);
        var j;
        try { j = JSON.parse(t); }
        catch (e) {
          /* 回來的不是 JSON，多半是 GAS 的登入頁或錯誤頁。
             把原文吞掉 —— 學生看到一整頁 HTML 只會更慌。 */
          throw new Error('AI 助教現在連不上。');
        }
        if (!j.ok) {
          var err = new Error(j.error || 'AI 助教現在有點忙。');
          err.cooling = !!j.cooling;
          err.capped = !!j.capped;
          err.retryAfter = j.retryAfter || 0;
          throw err;
        }
        return j;
      })
      .catch(function (e) {
        clearTimeout(timer);
        if (e && e.name === 'AbortError') throw new Error('等太久了，AI 助教沒有回應。');
        throw e;
      });
  }

  /* ── 畫面 ─────────────────────────────────────────
     掛在某一問底下。keys 是這一問希望學生講到的概念。 */
  function mount(host, o) {
    o = o || {};
    if (!host) return;
    if (!enabled()) { host.style.display = 'none'; return; }
    ensureStyle();

    var busy = false, cooling = false;

    host.className = 'ai-box';
    host.innerHTML =
      '<details class="ai-d"><summary>💬 講不出來？跟 AI 助教說說看</summary>' +
      '<div class="ai-in">' +
        '<p class="ai-tip">寫你<b>現在的想法</b>就好，不必完整 —— ' +
          '它不會給你答案，只會再問你一個問題。</p>' +
        '<textarea class="ai-ta" rows="2" placeholder="例如：我覺得那一段一直重複…"></textarea>' +
        '<div class="ai-row">' +
          '<button class="ai-btn" type="button">問問看</button>' +
          '<span class="ai-note"></span>' +
        '</div>' +
        '<div class="ai-out" style="display:none"></div>' +
      '</div></details>';

    var ta = host.querySelector('.ai-ta');
    var btn = host.querySelector('.ai-btn');
    var note = host.querySelector('.ai-note');
    var out = host.querySelector('.ai-out');

    btn.onclick = function () {
      if (busy) return;
      var text = ta.value.trim();
      if (text.length < 4) {
        show('bad', '先寫幾個字 —— 哪怕只是「我覺得…」也好。AI 要看得到你的想法才問得出東西。');
        return;
      }

      /* ① 先在本機判一次：全部講到就不必問 AI。
         省一次額度、省三秒 —— 而且回饋是老師寫的，每次都一樣。 */
      var k = global.AIGUIDE ? global.AIGUIDE.hitKeys(text, o.keys) : { done: false };
      if (k.done) {
        show('good', '你講到了：<b>' + esc(k.hit.join('、')) + '</b>。這一題想通了，往下做吧。');
        note.textContent = '（這次沒有用到 AI）';
        return;
      }

      busy = true;
      lock(true);
      show('wait', '<span class="ai-dot"></span> AI 助教正在想…最多等 20 秒，不要重複按。');

      ask(o.unit, o.qi, text, o.student)
        .then(function (j) {
          if (j.byKeys) { show('good', esc(j.reply)); note.textContent = '（這次沒有用到 AI）'; return; }
          show('ai', esc(j.reply));
          note.textContent = '';
          if (o.onAsked) o.onAsked(text, j.reply);
        })
        .catch(function (e) {
          /* ★ 失敗分三種，學生要看得出差別：
               冷卻   —— 等幾秒就好，是我們自己的規則
               用完   —— 今天不會再有了，別再等
               其他   —— 額度／過載／網路，等一下可能就好
             ⚠️ 但不管哪一種，都要把課本的提示端出來 ——
                學生不該因為 AI 不舒服就卡在那裡。 */
          var kind = e.cooling ? 'wait' : 'bad';
          show(kind, esc(e.message) +
            (o.hint
              ? '<div class="ai-fb"><b>先看看課本怎麼說：</b><br>' + o.hint + '</div>'
              : ''));
          if (e.cooling && e.retryAfter) countdown(e.retryAfter);
        })
        /* ⚠️ 收尾不可以無條件解鎖。
           冷卻那條路剛剛才把按鈕鎖起來倒數，這一行跑在它後面，
           會把鎖直接蓋掉 —— 畫面說「等 7 秒」，按鈕卻是亮的，
           學生當然馬上再按一次，然後再被擋一次。 */
        .then(function () { busy = false; if (!cooling) lock(false); });
    };

    function lock(on) {
      btn.disabled = on;
      btn.textContent = on ? '問了，等一下…' : '問問看';
      ta.disabled = on;
    }

    function countdown(sec) {
      var n = sec;
      cooling = true;
      lock(true);
      var t = setInterval(function () {
        n--;
        btn.textContent = n + ' 秒後可以再問';
        if (n <= 0) { clearInterval(t); cooling = false; lock(false); }
      }, 1000);
    }

    function show(kind, html) {
      out.style.display = '';
      out.className = 'ai-out ai-' + kind;
      out.innerHTML = html;
    }
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/[&<>"]/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
      });
  }

  var styled = false;
  function ensureStyle() {
    if (styled || typeof document === 'undefined') return;
    styled = true;
    var css = [
      '.ai-box{margin-top:9px}',
      '.ai-d{border:2px dashed #c7d2fe;border-radius:11px;background:#eef2ff}',
      '.ai-d>summary{cursor:pointer;padding:8px 12px;font-weight:700;font-size:13px;color:#3730a3}',
      '.ai-d[open]>summary{border-bottom:1px dashed #c7d2fe}',
      '.ai-in{padding:10px 12px 12px}',
      '.ai-tip{margin:0 0 7px;font-size:12px;color:#4f46e5;line-height:1.7}',
      '.ai-ta{width:100%;box-sizing:border-box;padding:8px 10px;border:2px solid #c7d2fe;',
      '  border-radius:9px;font-family:inherit;font-size:13.5px;line-height:1.7;resize:vertical}',
      '.ai-ta:focus{outline:none;border-color:#6366f1}',
      '.ai-ta:disabled{background:#f8fafc;color:#64748b}',
      '.ai-row{display:flex;align-items:center;gap:9px;margin-top:7px;flex-wrap:wrap}',
      '.ai-btn{background:#4f46e5;color:#fff;border:0;border-radius:9px;padding:7px 16px;',
      '  font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}',
      '.ai-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.ai-note{font-size:11.5px;color:#6b7280}',
      '.ai-out{margin-top:9px;padding:9px 11px;border-radius:9px;font-size:13.5px;line-height:1.85}',
      '.ai-ai{background:#fff;border:2px solid #a5b4fc;color:#312e81}',
      '.ai-good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}',
      '.ai-bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}',
      '.ai-wait{background:#f8fafc;border:2px solid #cbd5e1;color:#475569}',
      '.ai-fb{margin-top:8px;padding-top:8px;border-top:1px solid #fdba74;font-size:13px}',
      '.ai-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#6366f1;',
      '  animation:aiPulse 1s ease-in-out infinite}',
      '@keyframes aiPulse{0%,100%{opacity:.25}50%{opacity:1}}'
    ].join('\n');
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  global.ASKAI = {
    VERSION: VERSION,
    TIMEOUT_MS: TIMEOUT_MS,
    enabled: enabled,
    mount: mount,
    _ask: ask
  };

})(typeof window !== 'undefined' ? window : this);
