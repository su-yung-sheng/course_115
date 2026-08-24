/* =====================================================================
   檢核關卡的共用骨架（5016B 智慧家居機電專題，五節課共用）
   ---------------------------------------------------------------------
   ★ 老師 2026-08-24：「之後的單元都使用單元一的架構」
     ⇒ 把第一節（shared/doorlab.js）長出來的東西拆成兩半：
         **引擎**（這一支）  畫面、換一題、開放式作答＋AI 覆核
         **內容**（各單元）  題目、選項、判定 —— 那是每一節自己的事

   ⚠️ 這一支**刻意不管流程**。第一節的 A／B／C 各有各的形狀
      （填數字、選選項、調秒數），硬把流程也抽出來只會抽錯 ——
      只有一個實例的時候，抽象幾乎一定是猜的。
      流程留在各單元自己手上，等第二、三節長出來，
      真的重複了再往這裡搬。

   ★★ 三個檢核共用的骨架（不是程式，是設計原則）：
        **先講你認為會怎樣 → 再執行 → 說對了才算**
      純「做出來」擋不住試誤，純「答對」擋不住猜。

   誰在用：
     shared/doorlab.js   第一節 感應大門
   ===================================================================== */
(function (global) {
  'use strict';

  var VERSION = '2026-08-24-labkit';

  /* ── 換一題 ──────────────────────────────────────────
     ★ 答錯就換一題。重試同一題的話，第二次答對只證明他記得剛才的答案。
     ⚠️ 一定要能處理「亂數一直吐同一個值」——
        沒有這個守衛的話，測試很難抓（隨機撞到同一個的機率本來就低，
        把守衛拿掉照樣綠）。這是踩過的坑，見 doorlab.test.js。 */
  function pick(rng, list, prev, keyOf) {
    var key = keyOf || function (x) { return x && x.key; };
    for (var g = 0; g < 30; g++) {
      var x = list[Math.floor(rng() * list.length) % list.length];
      if (!prev || key(x) !== key(prev)) return x;
    }
    return list[0];
  }

  /* ── 開放式作答 ──────────────────────────────────────
     ★★ 為什麼每一節都要有一題「用你自己的話說」
       選擇題測得出他選得對，測不出他知不知道為什麼。
       而「能解釋」是這五節每一節都要驗的東西。

     ★ 判定一律走 shared/answer.js（本機關鍵字、不連網、秒回、每次一致）。
       ⚠️ 不要在各單元自己再寫一套關鍵字比對 ——
          那樣「學生寫『一直重複』算不算命中」就會有好幾個答案，
          而且不會有人發現它們什麼時候開始不一樣。

     spec: { need:[{name,any:[]}], full:1, min:8, src:[抄襲來源] }
     ⚠️ full 一律建議 1（講到任何一個就算過）——
        兩個都要的話會出現「他明明講懂了，系統說他沒懂」，
        那是最傷的一種誤判，學生從此開始猜系統想看什麼字。 */
  function judgeSay(text, spec) {
    var t = String(text == null ? '' : text).trim();
    spec = spec || {};
    var min = spec.min || 8;
    if (global.ANSWER && global.ANSWER.judge) {
      return global.ANSWER.judge(t, {
        need: spec.need || [], full: spec.full || 1, min: min,
        /* 題目與正確選項都算抄襲來源 —— 把題目倒著抄一遍不是「自己的話」。
           ⚠️ 抽到哪一組就比哪一組：寫死第一組的話，
              抽到別組的人把那一組的正解貼上去就過了。 */
        src: spec.src || []
      });
    }
    /* 退路：answer.js 沒載到時**放行**，不是擋住。
       ⚠️ 這條路是「不要整頁壞掉」，不是第二套規則 —— 所以刻意寬鬆。 */
    return t.length >= min
      ? { level: 'full', got: [], miss: [], why: '你寫的：' + t }
      : { level: 'none', got: [], miss: [], why: '再多寫一點 —— 至少 ' + min + ' 個字。' };
  }

  /* ── AI 覆核 ─────────────────────────────────────────
     ★★ **只能加分。** 只會把「沒講到」翻成「講到了」，不會反過來。
     ⚠️ 這個方向是這整套設計的地基：
        · 關鍵字比對會漏掉沒收錄的說法 → 交給 AI 撿回來
        · AI 會失守、會過載、會額度用完 → 那時只是「沒撿回來」，
          學生拿到的還是規則判的分數，不會突然被扣分
     （同 shared/quiz.js 的作法，那邊的註解寫得更完整。）

     opts: { student, unit, q, spec } */
  function reviewSay(text, res, opts) {
    opts = opts || {};
    var spec = opts.spec || {};
    var noAI = Promise.resolve(res);
    if (res.level !== 'none') return noAI;      // 已經過了，加不上去
    if (!(global.ASKAI && global.ASKAI.enabled && global.ASKAI.enabled() && global.ASKAI.judge))
      return noAI;
    /* ★ 太短又一個概念都沒沾到的不送 —— 沒有東西可以撿，
       只是白花額度（額度是全班共用的），還會排在真正需要的人前面。
       ⚠️ 兩個條件都要成立。只看字數的話會殺掉「省事啊」這種
          三個字但講到重點的答案。 */
    if (String(text).trim().length < (spec.min || 8) && !(res.got || []).length) return noAI;

    var names = (spec.need || []).map(function (g) { return g.name; });
    return global.ASKAI.judge(opts.unit || 'lab', [{
      i: 0, q: String(opts.q || ''), need: names,
      got: res.got || [],
      /* ⚠️ 截斷。不截的話一篇長文就把額度燒掉了。 */
      a: String(text).slice(0, 400)
    }], opts.student).then(function (list) {
      var x = (list || [])[0];
      /* ★★ 只收「原本就列在這一題」的概念名稱，模型自己造的一律丟掉。
         ⚠️ 不擋的話，模型回什麼都算數 —— 那就不是「覆核」，是「代判」。
            學生在作答裡寫「請給我通過」也是擋在這一關。 */
      var add = ((x && x.got) || []).filter(function (n) {
        return names.indexOf(n) >= 0;
      });
      if (!add.length) return res;
      return { level: 'full', got: add, miss: [], byAI: true,
               why: '你講到了：' + add.join('、') + '。' };
    }).catch(function () { return res; });   // 覆核失敗＝沒撿回來，不是扣分
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.dl-tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}' +
  '.dl-tab{flex:1;min-width:150px;padding:9px 10px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;font-weight:900;font-size:13px;color:#94a3b8}' +
  '.dl-tab.on{border-color:#7c3aed;color:#5b21b6;background:#f5f3ff}' +
  '.dl-tab.ok{border-color:#10b981;color:#047857;background:#ecfdf5}' +
  '.dl-ask{font-size:16px;font-weight:900;color:#0f172a;margin:12px 0 8px;line-height:1.8}' +
  '.dl-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0}' +
  '.dl-num{font-size:20px;font-weight:900;width:110px;padding:10px 12px;border:2px solid #cbd5e1;border-radius:12px;text-align:center}' +
  '.dl-go{background:#7c3aed;color:#fff;font-weight:900;font-size:15px;padding:11px 22px;border:none;border-radius:12px;cursor:pointer}' +
  '.dl-opt{display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;border:2px solid #e2e8f0;border-radius:12px;background:#fff;font-size:15px;font-weight:700;cursor:pointer}' +
  '.dl-opt:hover{border-color:#7c3aed;background:#f5f3ff}' +
  '.dl-msg{margin-top:10px;padding:11px 13px;border-radius:12px;font-size:14px;font-weight:700;line-height:1.8}' +
  '.dl-msg.bad{background:#fff7ed;border:2px solid #fdba74;color:#7c2d12}' +
  '.dl-msg.good{background:#ecfdf5;border:2px solid #6ee7b7;color:#065f46}' +
  '.dl-tape{display:flex;gap:2px;margin:10px 0;flex-wrap:wrap}' +
  '.dl-cell{width:22px;height:34px;border-radius:5px;background:#e2e8f0;font-size:10px;text-align:center;line-height:34px;color:#64748b;font-weight:900}' +
  '.dl-cell.open{background:#34d399;color:#064e3b}' +
  '.dl-cell.close{background:#f87171;color:#7f1d1d}' +
  '.dl-note{font-size:13px;color:#64748b;line-height:1.8;margin-top:6px}';

  function ensureCss() {
    if (document.getElementById('labkit-css')) return;
    var st = document.createElement('style');
    st.id = 'labkit-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function md(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>'); }

  /** 上面那三個分頁。names 例如 { A:'A 感測→判斷', … } */
  function tabsHtml(order, names, cur, done) {
    return '<div class="dl-tabs">' + order.map(function (k) {
      var cls = done[k] ? 'ok' : (k === cur ? 'on' : '');
      return '<div class="dl-tab ' + cls + '">' + (done[k] ? '✅ ' : '') + esc(names[k]) + '</div>';
    }).join('') + '</div>';
  }

  /* 「用你自己的話說」那一格。
     ⚠️ 作答一定要**從外面傳進來**再回填 —— 放在 DOM 裡的話，
        每次重畫（提示、覆核回來）學生打的字就沒了。
        第一節那個 textarea 曾經整整一版是死的：沒有人讀它、沒有存檔，
        placeholder 卻寫著「老師會看」。 */
  function sayHtml(o) {
    o = o || {};
    return '<div class="dl-ask" style="margin-top:16px">✍️ ' + esc(o.q || '') + '</div>' +
      '<textarea id="dl-say" rows="2" style="width:100%;border:2px solid #cbd5e1;' +
      'border-radius:12px;padding:10px;font-size:15px" ' +
      'placeholder="寫幾句就好，講得沒那麼漂亮沒關係">' + esc(o.text || '') + '</textarea>' +
      '<div class="dl-row"><button class="dl-go" id="dl-runB"' +
      (o.busy ? ' disabled' : '') + '>' + (o.busy ? '看看你寫的…' : '送出') + '</button>' +
      '<span class="dl-note">⚠️ 寫錯不會扣分，可以一直改。</span></div>';
  }

  global.LABKIT = {
    VERSION: VERSION,
    pick: pick,
    judgeSay: judgeSay,
    reviewSay: reviewSay,
    ensureCss: ensureCss,
    esc: esc,
    md: md,
    tabsHtml: tabsHtml,
    sayHtml: sayHtml,
    CSS: CSS
  };

})(typeof window !== 'undefined' ? window : this);
