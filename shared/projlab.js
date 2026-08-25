/* =====================================================================
   第五節「自己的專案」— 分層任務卡 ＋ 成果發表
   ---------------------------------------------------------------------
   ★ 老師 2026-08-25：
     ①基礎關｜先讓它動　選 1 個輸入＋1 個輸出，完成一個「如果…那麼…」，
       並能現場操作驗證
     ②挑戰關｜讓它更聰明　調整判斷數值或條件，再加入第二個輸入、第二個輸出
     ③創意關｜讓它解決問題　加入自訂功能，完成一段測試情境，並說明修改的原因
     成果發表固定講三句。
   ★ 老師 2026-08-25（追加）：「成果發表要變成一份文件以供截圖下載，
     還是能下載成 PDF 更方便」

   ⚠️⚠️ 這一節**電腦看不到硬體**，所以判定的方式和前四節完全不同：
      老師選的是「**自我勾選＋必須寫出證據**」。
      ⇒ 勾選很容易，但證據句擋得住空白、太短、和**照抄設計單**。
        ★ 抄設計單是最常見的敷衍：那句話證明的是「我會複製」，
          不是「它真的動了」。所以一定要擋。

   ⚠️ PDF 不用 jsPDF 那一類的函式庫 —— 它們預設不含中文字型，
      印出來會是一整排豆腐字。改用兩條零相依的路：
        ① 瀏覽器原生列印（另存 PDF）—— 中文一定正確
        ② canvas 自己畫成 PNG —— 版面我自己控，適合截圖／貼到作業
   ===================================================================== */
(function (global) {
  'use strict';

  function LK() {
    if (!global.LABKIT) throw new Error('projlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }

  var MIN = 4;                   // 每一格至少幾個字

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }

  /* ── 證據句的判定 ──────────────────────────────────
     ★ 只擋三件事：空白、太短、照抄設計單。
     ⚠️ 不去猜「內容對不對」—— 那是老師巡堂看的，電腦看不到硬體。 */
  function judgeEvidence(a, b, line) {
    var A = norm(a), B = norm(b);
    if (!A || !B) return { ok: false, how: 'empty' };
    if (A.length < MIN || B.length < MIN) return { ok: false, how: 'short' };
    var L = norm(line);
    /* ⚠️ 照抄設計單 —— 那證明的是「我會複製」，不是「它真的動了」。 */
    if (L && L.length > 6 && (L.indexOf(A) >= 0 && L.indexOf(B) >= 0))
      return { ok: false, how: 'copy' };
    if (A === B) return { ok: false, how: 'same' };
    return { ok: true, how: 'fit' };
  }
  function sayEvidence(r) {
    if (r.how === 'empty') return '⚠️ 兩格都要填 —— 這是你「真的做出來了」的證據。';
    if (r.how === 'short')
      return '⚠️ 太短了，看不出你做了什麼。寫具體一點：' +
             '**你的手（或東西）怎麼動**，**你看到什麼**。';
    if (r.how === 'copy')
      return '⛔ 這是把**設計單抄過來**。設計單寫的是「打算怎樣」，' +
             '這裡要寫的是「**實際操作的時候發生了什麼**」—— 那是兩件事。';
    if (r.how === 'same') return '⚠️ 兩格寫了一樣的話。左邊是你做的動作，右邊是它的反應。';
    return '';
  }

  /* ── 挑戰關：三件事都要交代 ────────────────────────
     ★ 老師：「調整判斷數值或條件，再加入第二個輸入，第二個輸出」。 */
  function judgeLevel2(f) {
    var miss = [];
    if (norm(f.from) === '' || norm(f.to) === '') miss.push('num');
    else if (norm(f.from) === norm(f.to)) miss.push('nochange');
    if (norm(f.in2).length < 2) miss.push('in2');
    if (norm(f.out2).length < 2) miss.push('out2');
    return { ok: miss.length === 0, miss: miss };
  }
  function sayLevel2(r) {
    if (r.miss.indexOf('num') >= 0)
      return '⚠️ 那個判斷的數字（或條件）要寫出**改之前**和**改之後**。';
    if (r.miss.indexOf('nochange') >= 0)
      return '⚠️ 改之前和改之後一樣 —— 那就是沒有調整。' +
             '★ 挑戰關的重點是「**數字換了，行為就換了**」，親手試一次才有感覺。';
    if (r.miss.indexOf('in2') >= 0) return '⚠️ 第二個**輸入**是什麼？（讓它多知道一件事）';
    if (r.miss.indexOf('out2') >= 0) return '⚠️ 第二個**輸出**是什麼？（讓它多做一件事）';
    return '';
  }

  /* ── 創意關：說明「為什麼這樣改」──────────────────
     ★ 這是這一節唯一走 AI 覆核的地方（本機關鍵字為主力，AI 只加分）。 */
  var SAY = {
    need: [
      { name: '本來有什麼問題／不夠好',
        any: ['本來', '原本', '之前', 'problem', '不方便', '不夠', '會', '常常',
              '太', '沒辦法', '麻煩', '危險', '忘記', '浪費'] },
      { name: '改了之後好在哪',
        any: ['所以', '就', '才', '變成', '改成', '這樣', '解決', '比較', '方便',
              '安全', '省', '不用', '自動'] }
    ],
    min: 12,
    full: 1
  };
  function saySpec() {
    return { need: SAY.need, full: SAY.full, min: SAY.min,
             q: '為什麼要加這個功能？（本來有什麼不夠好，改了之後好在哪）',
             src: ['為什麼要加這個功能', '本來有什麼問題', '改了之後好在哪'] };
  }
  function judgeSay(text) { return LK().judgeSay(text, saySpec()); }
  function reviewSay(text, res, opts) {
    return LK().reviewSay(text, res, {
      student: opts && opts.student, unit: '5016b-u5-L3', q: saySpec().q, spec: saySpec()
    });
  }

  /* ── 成果發表的三句 ────────────────────────────────
     ★ 老師指定，一字不改。 */
  var SHOW_Q = [
    { key: 's1', t: '我們要解決的問題是：', slots: ['problem'],
      ph: ['例：晚上回家玄關太暗，開燈要摸半天'] },
    { key: 's2', t: '當＿＿＿＿時，系統會＿＿＿＿。', slots: ['when', 'then'],
      ph: ['例：有人走到門口 1 公尺內', '例：燈條慢慢亮成暖黃色'] },
    { key: 's3', t: '我們遇到＿＿＿＿，最後用＿＿＿＿解決。', slots: ['trouble', 'fix'],
      ph: ['例：距離一直跳來跳去，燈會閃', '例：把門檻改成兩個數字（進 15 出 25）'] }
  ];
  /* ⚠️ 第三句最常見的敷衍就是「沒有遇到問題」。
     ★ 那句話一寫出來，這一節最有價值的部分（怎麼卡住、怎麼解掉）就沒了。 */
  var NO_TROUBLE = /^(沒有|沒|無|都很順利|很順利|沒問題|沒遇到|一切順利|none|no)/;
  function judgeShow(v) {
    /* ⚠️⚠️ 「沒有遇到問題」這一條要**排在長度檢查前面**。
       第一版先查長度 —— 但學生實際上打的就是「沒有」兩個字，
       兩個字不到門檻，於是他收到的是「太短，至少寫 4 個字」。
       ★ 那句話會把他推向**更糟的方向**：他只會補成「沒有遇到問題」，
         剛好長度過關，而這一格最值錢的東西還是沒寫。
       ⇒ 先認出「他想說的是沒問題」，再給他方向。 */
    if (NO_TROUBLE.test(norm(v.trouble))) return { ok: false, how: 'notrouble' };
    var miss = [];
    ['problem', 'when', 'then', 'trouble', 'fix'].forEach(function (k) {
      if (norm(v[k]).length < MIN) miss.push(k);
    });
    if (miss.length) return { ok: false, how: 'short', miss: miss };
    return { ok: true, how: 'fit' };
  }
  var LABEL = { problem: '要解決的問題', when: '當…時', then: '系統會…',
                trouble: '我們遇到…', fix: '最後用…解決' };
  function sayShow(r) {
    if (r.how === 'notrouble')
      return '⛔ 「沒有遇到問題」不能算 —— 這一格是整段發表**最值錢**的地方。' +
             '★ 想想看：第一次燒錄成功了嗎？數字第一次就抓對了嗎？' +
             '線有沒有插錯過？那些都算。';
    if (r.how === 'short')
      return '⚠️ 還有沒填完的：**' +
             r.miss.map(function (k) { return LABEL[k]; }).join('、') +
             '**。每一格至少寫 ' + MIN + ' 個字。';
    return '';
  }

  /* ═══ 成果卡：列印（另存 PDF）與下載 PNG ═══════════
     ⚠️ 不用 jsPDF —— 中文會變豆腐字。 */
  function cardLines(v, meta) {
    return [
      { k: '我們要解決的問題是', v: v.problem },
      { k: '當　' + v.when + '　時', v: '系統會　' + v.then },
      { k: '我們遇到　' + v.trouble, v: '最後用　' + v.fix + '　解決' }
    ];
  }
  function cardHtml(v, meta) {
    var esc = LK().esc;
    var m = meta || {};
    return '<div class="pj-card" id="pj-card">' +
      '<div class="pj-hd"><span>智慧家居機電專題　成果發表</span>' +
        '<span>' + esc(m.date || '') + '</span></div>' +
      '<div class="pj-title">' + esc(m.scene || '我們的專題') + '</div>' +
      (m.team ? '<div class="pj-team">' + esc(m.team) + '</div>' : '') +
      (m.line ? '<div class="pj-line">' + esc(m.line) + '</div>' : '') +
      '<ol class="pj-ol">' +
        '<li><b>我們要解決的問題是：</b><br>' + esc(v.problem) + '</li>' +
        '<li><b>當</b> ' + esc(v.when) + ' <b>時，系統會</b> ' + esc(v.then) + '。</li>' +
        '<li><b>我們遇到</b> ' + esc(v.trouble) +
          ' <b>，最後用</b> ' + esc(v.fix) + ' <b>解決。</b></li>' +
      '</ol></div>';
  }

  /* 列印：把成果卡搬到一個獨立容器，@media print 只留它。
     ⚠️ 不開新視窗 —— 會被擋，而且新視窗載不到這頁的樣式。 */
  function printCard(html) {
    var root = document.getElementById('pj-print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'pj-print-root';
      document.body.appendChild(root);
    }
    root.innerHTML = html;
    document.body.classList.add('pj-printing');
    var clean = function () {
      document.body.classList.remove('pj-printing');
      global.removeEventListener('afterprint', clean);
    };
    global.addEventListener('afterprint', clean);
    global.print();
    /* ⚠️ 有些瀏覽器不發 afterprint —— 留一個保險，不然整頁會一直藏著。 */
    global.setTimeout(clean, 1500);
  }

  /* 下載 PNG：canvas 自己畫。★ 用系統字型 fillText，中文不會有問題。 */
  function wrap(ctx, text, max) {
    var out = [], line = '';
    String(text || '').split('').forEach(function (ch) {
      if (ch === '\n') { out.push(line); line = ''; return; }
      if (ctx.measureText(line + ch).width > max) { out.push(line); line = ch; }
      else line += ch;
    });
    if (line) out.push(line);
    return out;
  }
  function drawCard(v, meta) {
    var W = 1000, H = 1414, pad = 70;          // A4 直式的比例
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#7c3aed'; c.fillRect(0, 0, W, 14);

    var y = pad + 30;
    c.fillStyle = '#64748b'; c.font = '600 22px ' + FONT;
    c.fillText('智慧家居機電專題　成果發表', pad, y);
    c.textAlign = 'right';
    c.fillText(String((meta && meta.date) || ''), W - pad, y);
    c.textAlign = 'left';

    y += 62;
    c.fillStyle = '#0f172a'; c.font = '900 46px ' + FONT;
    wrap(c, (meta && meta.scene) || '我們的專題', W - pad * 2).forEach(function (l) {
      c.fillText(l, pad, y); y += 56;
    });
    if (meta && meta.team) {
      c.fillStyle = '#7c3aed'; c.font = '800 26px ' + FONT;
      c.fillText(meta.team, pad, y); y += 44;
    }
    if (meta && meta.line) {
      y += 8;
      c.fillStyle = '#f1f5f9'; c.fillRect(pad, y - 26, W - pad * 2, 6);
      y += 20;
      c.fillStyle = '#475569'; c.font = '700 24px ' + FONT;
      wrap(c, meta.line, W - pad * 2).forEach(function (l) { c.fillText(l, pad, y); y += 36; });
    }

    y += 34;
    cardLines(v).forEach(function (row, i) {
      c.fillStyle = '#ede9fe';
      c.fillRect(pad, y - 34, 46, 46);
      c.fillStyle = '#7c3aed'; c.font = '900 26px ' + FONT;
      c.fillText(String(i + 1), pad + 16, y);
      c.fillStyle = '#0f172a'; c.font = '900 30px ' + FONT;
      wrap(c, row.k, W - pad * 2 - 66).forEach(function (l) {
        c.fillText(l, pad + 66, y); y += 42;
      });
      c.fillStyle = '#334155'; c.font = '700 28px ' + FONT;
      wrap(c, row.v, W - pad * 2 - 66).forEach(function (l) {
        c.fillText(l, pad + 66, y); y += 40;
      });
      y += 34;
    });

    c.fillStyle = '#94a3b8'; c.font = '600 20px ' + FONT;
    c.fillText('⚠️ 電腦教室關機會還原 —— 記得把這張圖傳給自己或交給老師。',
               pad, H - pad + 10);
    return cv;
  }
  function downloadPng(v, meta) {
    var cv = drawCard(v, meta);
    var a = document.createElement('a');
    a.download = '成果發表_' + ((meta && meta.scene) || '專題') + '.png';
    a.href = cv.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ═══ 樣式 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.pj-lv{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}' +
  '.pj-tab{flex:1;min-width:120px;text-align:center;padding:10px 8px;border-radius:12px;' +
    'border:2px solid #e2e8f0;font-weight:900;font-size:14px;color:#64748b;background:#fff}' +
  '.pj-tab.on{border-color:#7c3aed;background:#f5f3ff;color:#5b21b6}' +
  '.pj-tab.ok{border-color:#10b981;background:#ecfdf5;color:#047857}' +
  '.pj-tab span{display:block;font-size:11px;font-weight:800;opacity:.8}' +
  '.pj-goal{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:14px 16px;' +
    'font-weight:900;font-size:15px;line-height:1.9;margin-bottom:12px}' +
  '.pj-goal em{color:#fbbf24;font-style:normal}' +
  '.pj-ask{font-size:15px;font-weight:900;color:#0f172a;line-height:1.9;margin:12px 0 8px}' +
  '.pj-fill{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-weight:900;' +
    'font-size:15px;margin:8px 0}' +
  '.pj-t{flex:1;min-width:150px;font-size:15px;font-weight:800;padding:9px 12px;' +
    'border:2px solid #cbd5e1;border-radius:10px;box-sizing:border-box}' +
  '.pj-s{width:110px;font-size:15px;font-weight:800;padding:9px 10px;text-align:center;' +
    'border:2px solid #cbd5e1;border-radius:10px}' +
  '.pj-chk{display:flex;gap:10px;align-items:flex-start;background:#fffbeb;' +
    'border:2px solid #fcd34d;border-radius:12px;padding:12px 14px;margin:12px 0;' +
    'font-weight:800;font-size:14px;color:#78350f;line-height:1.8;cursor:pointer}' +
  '.pj-chk input{width:22px;height:22px;margin-top:2px;flex:none;cursor:pointer}' +
  '.pj-note{font-size:13px;color:#64748b;font-weight:700;line-height:1.8;margin-top:6px}' +
  /* 成果卡 */
  '.pj-card{background:#fff;border:3px solid #7c3aed;border-radius:18px;padding:24px 26px;' +
    'margin:14px 0;line-height:1.9}' +
  '.pj-hd{display:flex;justify-content:space-between;font-size:12px;font-weight:900;' +
    'color:#7c3aed;letter-spacing:.05em;margin-bottom:10px}' +
  '.pj-title{font-size:26px;font-weight:900;color:#0f172a}' +
  '.pj-team{font-size:15px;font-weight:900;color:#7c3aed;margin-top:2px}' +
  '.pj-line{font-size:14px;font-weight:800;color:#475569;background:#f8fafc;' +
    'border-radius:10px;padding:9px 12px;margin-top:10px}' +
  '.pj-ol{margin:14px 0 0;padding-left:22px}' +
  '.pj-ol li{font-size:16px;font-weight:800;color:#334155;margin-bottom:12px}' +
  '.pj-ol b{color:#0f172a}' +
  '#pj-print-root{display:none}' +
  '@media print{body.pj-printing>*{display:none!important}' +
    'body.pj-printing #pj-print-root{display:block!important}' +
    'body.pj-printing .pj-card{border-width:2px;page-break-inside:avoid}}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('projlab-css')) return;
    var st = document.createElement('style');
    st.id = 'projlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var line = String(opts.line || '');
    var scene = (opts.plan && opts.plan.scene) || '我們的專題';
    var step = 'L1';
    var done = { L1: false, L2: false, L3: false };
    var tries = { L1: 0, L2: 0, L3: 0, SHOW: 0 };
    var sayBusy = false;
    /* 全部的填寫內容。★ 換關不清空 —— 學生會回頭改。 */
    var f = Object.assign({
      ok1: false, ev1a: '', ev1b: '',
      from: '', to: '', in2: '', out2: '', ok2: false, ev2a: '', ev2b: '',
      feat: '', test: '', why: '', ok3: false,
      team: '', problem: '', when: '', then: '', trouble: '', fix: ''
    }, opts.work || {});

    function tabs() {
      var t = [['L1', '①基礎關', '先讓它動'],
               ['L2', '②挑戰關', '讓它更聰明'],
               ['L3', '③創意關', '解決問題'],
               ['SHOW', '成果發表', '三句話']];
      return '<div class="pj-lv">' + t.map(function (x) {
        var cls = done[x[0]] ? 'ok' : (step === x[0] ? 'on' : '');
        return '<div class="pj-tab ' + cls + '" data-go="' + x[0] + '">' +
          (done[x[0]] ? '✅ ' : '') + x[1] + '<span>' + x[2] + '</span></div>';
      }).join('') + '</div>';
    }
    function goal() {
      return '<div class="pj-goal">🎯 <em>' + esc(scene) + '</em>' +
        (line ? '<br>' + esc(line) : '') + '</div>';
    }
    function view(body, msg, cls) {
      el.innerHTML = '<div class="dl-wrap">' + tabs() + goal() + body +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') +
        '</div>';
      bind();
    }
    function evidenceBox(a, b, ida, idb) {
      return '<div class="pj-ask">✍️ 寫下你的<b>證據</b>（老師巡堂會看這一格）：</div>' +
        '<div class="pj-fill">當我　<input class="pj-t" id="' + ida + '" value="' + esc(a) +
          '" placeholder="例：把手放到感測器前面 10 公分"></div>' +
        '<div class="pj-fill">它就　<input class="pj-t" id="' + idb + '" value="' + esc(b) +
          '" placeholder="例：燈條整條亮起來，手拿開就暗了"></div>' +
        '<div class="pj-note">⚠️ 不要抄設計單 —— 設計單寫的是「打算怎樣」，' +
        '這裡要寫「**實際操作的時候發生了什麼**」。</div>';
    }

    /* ── ① 基礎關 ── */
    function viewL1(msg, cls) {
      view(
        '<div class="pj-ask">① <b>先讓它動</b>　—— 把設計單那一句做出來，' +
        '而且要能<b>現場操作給人看</b>。</div>' +
        '<label class="pj-chk"><input type="checkbox" id="pj-ok1"' +
          (f.ok1 ? ' checked' : '') + '>' +
          '我已經<b>實際操作過</b>：輸入一動，輸出真的跟著動了。' +
          '（不是只有程式跑得起來）</label>' +
        evidenceBox(f.ev1a, f.ev1b, 'pj-e1a', 'pj-e1b') +
        '<div class="dl-row"><button class="dl-go" id="pj-r1">完成基礎關</button></div>',
        msg, cls);
    }
    function doL1() {
      tries.L1++; grab();
      if (!f.ok1) return viewL1('⚠️ 先實際操作一次 —— 這一關要的不是程式跑得起來，' +
                                '是**東西真的會動**。', 'bad');
      var r = judgeEvidence(f.ev1a, f.ev1b, line);
      if (!r.ok) return viewL1(sayEvidence(r), 'bad');
      done.L1 = true; step = 'L2';
      viewL2('✅ 基礎關完成 —— 它會動了。接下來讓它**更聰明**一點。', 'good');
    }

    /* ── ② 挑戰關 ── */
    function viewL2(msg, cls) {
      view(
        '<div class="pj-ask">② <b>讓它更聰明</b>　—— 三件事都要做到：</div>' +
        '<div class="pj-ask" style="margin-top:4px">a. 調整<b>判斷的數值或條件</b>：</div>' +
        '<div class="pj-fill">從　<input class="pj-s" id="pj-from" value="' + esc(f.from) +
          '" placeholder="改之前">　改成　<input class="pj-s" id="pj-to" value="' + esc(f.to) +
          '" placeholder="改之後">　（例：15 公分 → 30 公分）</div>' +
        '<div class="pj-ask" style="margin-top:10px">b. 加入<b>第二個輸入</b>：</div>' +
        '<div class="pj-fill"><input class="pj-t" id="pj-in2" value="' + esc(f.in2) +
          '" placeholder="例：加一顆按鈕，用來切換「自動／手動」"></div>' +
        '<div class="pj-ask" style="margin-top:10px">c. 加入<b>第二個輸出</b>：</div>' +
        '<div class="pj-fill"><input class="pj-t" id="pj-out2" value="' + esc(f.out2) +
          '" placeholder="例：再加一顆 LED，手動模式時亮著提醒"></div>' +
        '<label class="pj-chk"><input type="checkbox" id="pj-ok2"' +
          (f.ok2 ? ' checked' : '') + '>' +
          '三件事我都<b>實際做出來並操作過</b>了。</label>' +
        evidenceBox(f.ev2a, f.ev2b, 'pj-e2a', 'pj-e2b') +
        '<div class="dl-row"><button class="dl-go" id="pj-r2">完成挑戰關</button></div>',
        msg, cls);
    }
    function doL2() {
      tries.L2++; grab();
      var r2 = judgeLevel2(f);
      if (!r2.ok) return viewL2(sayLevel2(r2), 'bad');
      if (!f.ok2) return viewL2('⚠️ 三件事都要實際做出來、操作過才算。', 'bad');
      var r = judgeEvidence(f.ev2a, f.ev2b, line);
      if (!r.ok) return viewL2(sayEvidence(r), 'bad');
      done.L2 = true; step = 'L3';
      viewL3('✅ 挑戰關完成。最後一關：讓它**真的解決一個問題**。', 'good');
    }

    /* ── ③ 創意關 ── */
    function viewL3(msg, cls) {
      view(
        '<div class="pj-ask">③ <b>讓它解決問題</b>　—— 加一個<b>你自己想的功能</b>，' +
        '而且要說得出<b>為什麼</b>。</div>' +
        '<div class="pj-ask" style="margin-top:4px">a. 我加的功能是：</div>' +
        '<div class="pj-fill"><input class="pj-t" id="pj-feat" value="' + esc(f.feat) +
          '" placeholder="例：離開之後燈慢慢變暗，不要突然全黑"></div>' +
        '<div class="pj-ask" style="margin-top:10px">b. 我怎麼<b>測</b>的（一段測試情境）：</div>' +
        '<div class="pj-fill"><input class="pj-t" id="pj-test" value="' + esc(f.test) +
          '" placeholder="例：走進來停 3 秒再走開，看燈是不是花 5 秒才暗"></div>' +
        '<div class="pj-ask" style="margin-top:10px">c. ' + esc(saySpec().q) + '</div>' +
        LK().sayHtml({ q: '', text: f.why, busy: sayBusy }) +
        '<label class="pj-chk"><input type="checkbox" id="pj-ok3"' +
          (f.ok3 ? ' checked' : '') + '>' +
          '這個功能我<b>實際做出來並測過</b>了。</label>' +
        '<div class="dl-row"><button class="dl-go" id="pj-r3">完成創意關</button></div>',
        msg, cls);
    }
    function doL3() {
      tries.L3++; grab();
      if (norm(f.feat).length < MIN) return viewL3('⚠️ 先寫出你加了什麼功能。', 'bad');
      if (norm(f.test).length < MIN)
        return viewL3('⚠️ 測試情境要寫出來 —— **你怎麼試的**，' +
                      '不然沒辦法證明它真的有用。', 'bad');
      if (!f.ok3) return viewL3('⚠️ 要實際做出來並測過才算。', 'bad');
      var res = judgeSay(f.why);
      if (res.level !== 'none') return passL3(res);
      sayBusy = true; viewL3('', 'bad');
      reviewSay(f.why, res, opts).then(function (r2) {
        sayBusy = false;
        if (r2.level !== 'none') return passL3(r2);
        viewL3('⚠️ 再想一次：**本來**有什麼不方便（或會出什麼錯）？' +
               '加了這個功能之後**變成怎樣**？兩件事都講到才算。', 'bad');
      });
    }
    function passL3(res) {
      done.L3 = true; step = 'SHOW';
      if (typeof opts.onSay === 'function') opts.onSay(f.why, res);
      viewShow('✅ 三關都完成了！最後把成果整理成**發表卡**。', 'good');
    }

    /* ── 成果發表 ── */
    function viewShow(msg, cls) {
      view(
        '<div class="pj-ask">🎤 <b>成果發表</b>　—— 固定講這三句就好。</div>' +
        '<div class="pj-fill">組別／組員：<input class="pj-t" id="pj-team" value="' +
          esc(f.team) + '" placeholder="例：三年二班　第 4 組　王小明、李小華"></div>' +
        '<div class="pj-ask" style="margin-top:10px">1. 我們要解決的問題是：</div>' +
        '<div class="pj-fill"><input class="pj-t" id="pj-problem" value="' + esc(f.problem) +
          '" placeholder="' + esc(SHOW_Q[0].ph[0]) + '"></div>' +
        '<div class="pj-ask" style="margin-top:10px">2. 當＿＿時，系統會＿＿。</div>' +
        '<div class="pj-fill">當　<input class="pj-t" id="pj-when" value="' + esc(f.when) +
          '" placeholder="' + esc(SHOW_Q[1].ph[0]) + '">　時</div>' +
        '<div class="pj-fill">系統會　<input class="pj-t" id="pj-then" value="' + esc(f.then) +
          '" placeholder="' + esc(SHOW_Q[1].ph[1]) + '"></div>' +
        '<div class="pj-ask" style="margin-top:10px">3. 我們遇到＿＿，最後用＿＿解決。</div>' +
        '<div class="pj-fill">我們遇到　<input class="pj-t" id="pj-trouble" value="' +
          esc(f.trouble) + '" placeholder="' + esc(SHOW_Q[2].ph[0]) + '"></div>' +
        '<div class="pj-fill">最後用　<input class="pj-t" id="pj-fix" value="' + esc(f.fix) +
          '" placeholder="' + esc(SHOW_Q[2].ph[1]) + '">　解決</div>' +
        '<div class="dl-row"><button class="dl-go" id="pj-make">產生成果卡</button></div>',
        msg, cls);
    }
    function meta() {
      return { scene: scene, team: f.team, line: line,
               date: new Date().toLocaleDateString('zh-TW') };
    }
    function doShow() {
      tries.SHOW++; grab();
      var r = judgeShow(f);
      if (!r.ok) return viewShow(sayShow(r), 'bad');
      el.innerHTML = '<div class="dl-wrap">' + tabs() +
        '<div class="dl-msg good">🎉 成果卡好了 —— 下面兩個按鈕都可以帶走。</div>' +
        cardHtml(f, meta()) +
        '<div class="dl-row">' +
          '<button class="dl-go" id="pj-print">🖨️ 列印／存成 PDF</button> ' +
          '<button class="dl-go" id="pj-png" style="background:#0891b2">🖼️ 下載成圖片</button> ' +
          '<button class="dl-go" id="pj-back" style="background:#94a3b8">回去改</button>' +
        '</div>' +
        '<div class="pj-note">⚠️ 電腦教室<b>關機會還原</b> —— ' +
        '記得把檔案傳給自己，或直接交給老師。<br>' +
        '★ 列印的時候在「印表機」那一欄選<b>「另存為 PDF」</b>就會變成一份 PDF。</div>' +
        '</div>';
      bind();
      if (typeof opts.onDone === 'function') opts.onDone({ tries: tries, work: f });
    }

    function grab() {
      var g = function (id) { var e = el.querySelector('#' + id); return e ? e.value : null; };
      var c = function (id) { var e = el.querySelector('#' + id); return e ? e.checked : null; };
      [['pj-e1a', 'ev1a'], ['pj-e1b', 'ev1b'], ['pj-from', 'from'], ['pj-to', 'to'],
       ['pj-in2', 'in2'], ['pj-out2', 'out2'], ['pj-e2a', 'ev2a'], ['pj-e2b', 'ev2b'],
       ['pj-feat', 'feat'], ['pj-test', 'test'], ['dl-say', 'why'], ['pj-team', 'team'],
       ['pj-problem', 'problem'], ['pj-when', 'when'], ['pj-then', 'then'],
       ['pj-trouble', 'trouble'], ['pj-fix', 'fix']].forEach(function (x) {
        var v = g(x[0]); if (v !== null) f[x[1]] = v;
      });
      [['pj-ok1', 'ok1'], ['pj-ok2', 'ok2'], ['pj-ok3', 'ok3']].forEach(function (x) {
        var v = c(x[0]); if (v !== null) f[x[1]] = v;
      });
    }
    /* 這一關開了沒 —— 前面的關過了才開得了。 */
    function reach(s) {
      if (s === 'L1') return true;
      if (s === 'L2') return done.L1;
      if (s === 'L3') return done.L2;
      return done.L3;
    }
    function show(s) {
      step = s;
      if (s === 'L1') viewL1('', ''); else if (s === 'L2') viewL2('', '');
      else if (s === 'L3') viewL3('', ''); else viewShow('', '');
    }

    function bind() {
      var on = function (id, fn) {
        var e = el.querySelector('#' + id); if (e) e.addEventListener('click', fn);
      };
      on('pj-r1', doL1); on('pj-r2', doL2); on('pj-r3', doL3); on('pj-make', doShow);
      on('pj-print', function () { printCard(cardHtml(f, meta())); });
      on('pj-png', function () { downloadPng(f, meta()); });
      on('pj-back', function () { show('SHOW'); });
      /* ⚠️ 不能跳關（老師：「每組都從基礎關開始」），但**過了的關要能自由來回**。
         ⚠️⚠️ 第一版寫成「只能往回走」（`order.indexOf(s) > order.indexOf(step)` 就擋）——
            那會困住學生：三關都過了、回頭看一眼基礎關，
            **就再也回不去成果發表**，因為 SHOW 永遠在 L1 後面。
            ★ 而且畫面上那個分頁看起來還是可以點的，按了卻沒反應。
         ⇒ 判斷「這一關開了沒」，不是「它在前面還是後面」。 */
      el.querySelectorAll('[data-go]').forEach(function (b) {
        b.addEventListener('click', function () {
          var s = b.getAttribute('data-go');
          if (s === step || !reach(s)) return;
          grab(); show(s);
        });
      });
    }

    show('L1');
    return { step: function () { return step; }, work: function () { return f; },
             tries: function () { return tries; }, done: function () { return done; },
             set: function (k, v) { f[k] = v; }, show: show, card: function () {
               return cardHtml(f, meta()); } };
  }

  global.PROJLAB = {
    MIN: MIN, SAY: SAY, SHOW_Q: SHOW_Q,
    judgeEvidence: judgeEvidence, sayEvidence: sayEvidence,
    judgeLevel2: judgeLevel2, sayLevel2: sayLevel2,
    judgeSay: judgeSay, reviewSay: reviewSay,
    judgeShow: judgeShow, sayShow: sayShow,
    cardHtml: cardHtml, drawCard: drawCard, printCard: printCard, downloadPng: downloadPng,
    mount: mount
  };

})(window);
