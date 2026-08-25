/* =====================================================================
   第五節「自己的專案」— 兩種模式展示 ＋ 成果發表
   ---------------------------------------------------------------------
   ★ 老師 2026-08-25：
     「第五課不用『動手檢核』」
     「任務卡改成之前提到的互動介面，當成複習」
     「設計成系統的兩種模式展示，學生的作品可以有兩種選擇」
     「成果發表要變成一份文件以供截圖下載，還是能下載成 PDF 更方便」

   ⚠️⚠️ 所以這一支**不判定學生做出來了沒**（電腦看不到硬體），
      也不是關卡。它做兩件事：
        ① 兩種模式的互動展示 —— 把前四節的東西一次複習過
             自動：超音波接管（近了就亮、就轉）
             手動：旋鈕接管（自己調顏色、調轉速）
           ★ 學生的作品**挑一種做就好**，不必兩種都做，
             也不必做「切換」—— 教具上沒有按鈕。
        ② 成果發表：三句話 → 一張帶得走的成果卡

   ⚠️ 成果卡不用 jsPDF 那一類的函式庫 —— 它們預設不含中文字型，
      印出來會是一整排豆腐字。改用兩條零相依的路：
        ① 瀏覽器原生列印（另存 PDF）—— 中文一定正確
        ② canvas 自己畫成 PNG —— 版面我自己控，適合截圖／貼到作業

   ⚠️ 三張分層任務卡（基礎／挑戰／創意）**不在這裡** ——
      那是課堂進行的節奏，寫在教材區（頁面的 demoHTML）。
      硬做成關卡只會變成「填表格才准往下」，那不是專題課該有的樣子。
   ===================================================================== */
(function (global) {
  'use strict';

  function LK() {
    if (!global.LABKIT) throw new Error('projlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }

  var MIN = 4;                   // 每一格至少幾個字
  var LEDS = 8;
  var NEAR = 30;                 // 自動模式：幾公分以內算「有人來了」
  var FULL = 5;                  // 幾公分以內就算「貼著了」（全開）
  var DIST_MIN = 2, DIST_MAX = 200;
  var HUE_MAX = 359;

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }

  /* ── 兩種模式：同一組硬體，兩種玩法 ────────────────
     ★ 自動＝超音波說了算；手動＝旋鈕說了算。
     ⚠️ 兩種都只用「一個輸入 → 兩個輸出」，學生照著做得出來。 */
  var MODES = [
    { key: 'auto', t: '自動', by: '超音波距離感測器',
      d: '人一靠近就亮、就轉；走遠了自己停。',
      good: '★ 好處：不用動手。⚠️ 代價：想要它「現在別亮」也做不到。' },
    { key: 'manual', t: '手動', by: '可變電阻（旋鈕）',
      d: '轉到哪就是哪 —— 顏色和轉速都自己說了算。',
      good: '★ 好處：完全可控。⚠️ 代價：得一直自己轉。' }
  ];
  /* 自動模式：距離 → 亮幾顆／什麼顏色／轉多快。
     ★ 越近越紅、越近越多顆、越近轉越快（接回第二節的反向換算）。 */
  function autoOf(cm) {
    var d = clamp(cm, DIST_MIN, DIST_MAX);
    if (d > NEAR) return { on: 0, hue: 0, speed: 0, near: false };
    /* ⚠️ 分母用的是 NEAR−FULL，不是 NEAR−DIST_MIN。
       ★ 超音波在 2～3 公分附近本來就量不準，
         把「全開」訂在 2 公分的話，學生**永遠拉不到整條亮**
         （手不可能貼那麼近，實測只會亮到 7 顆）。
       ⇒ 5 公分以內就算貼著了。 */
    var k = Math.min(1, (NEAR - d) / (NEAR - FULL));  // 0（剛好 30cm）～1（貼著）
    return { on: Math.max(1, Math.round(k * LEDS)),
             hue: Math.round(120 - 120 * k),          // 綠 → 紅
             speed: Math.round(k * 100), near: true };
  }
  /* 手動模式：旋鈕 → 顏色／第幾顆／轉速。 */
  function manualOf(pct) {
    var p = clamp(pct, 0, 100);
    return { on: Math.round(1 + (LEDS - 1) * p / 100),
             hue: Math.round(HUE_MAX * p / 100),
             speed: Math.round(p), near: true };
  }

  /* ── 成果發表的三句 ────────────────────────────────
     ★ 老師指定，一字不改。 */
  var SHOW_Q = [
    { key: 's1', t: '我們要解決的問題是：', slots: ['problem'],
      ph: ['例：晚上回家玄關太暗，開燈要摸半天'] },
    { key: 's2', t: '當＿＿＿＿時，系統會＿＿＿＿。', slots: ['when', 'then'],
      ph: ['例：有人走到門口 30 公分內', '例：燈條慢慢亮成暖黃色'] },
    { key: 's3', t: '我們遇到＿＿＿＿，最後用＿＿＿＿解決。', slots: ['trouble', 'fix'],
      ph: ['例：距離一直跳來跳去，燈會閃', '例：把門檻改成兩個數字（進 15 出 25）'] }
  ];
  /* ⚠️ 第三句最常見的敷衍就是「沒有遇到問題」。
     ★ 那句話一寫出來，這一節最有價值的部分（怎麼卡住、怎麼解掉）就沒了。 */
  var NO_TROUBLE = /^(沒有|沒|無|都很順利|很順利|沒問題|沒遇到|一切順利|none|no)/;
  function judgeShow(v) {
    /* ⚠️⚠️ 這一條要**排在長度檢查前面**。
       第一版先查長度 —— 但學生實際上打的就是「沒有」兩個字，
       兩個字不到門檻，於是他收到的是「太短，至少寫 4 個字」。
       ★ 那句話會把他推向**更糟的方向**：他只會補成「沒有遇到問題」，
         剛好長度過關，而這一格最值錢的東西還是沒寫。 */
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

  /* ═══ 成果卡：列印（另存 PDF）與下載 PNG ═══════════ */
  function cardLines(v) {
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
      (m.mode ? '<div class="pj-mode">模式：' + esc(m.mode) + '</div>' : '') +
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
    /* ⚠️ 有些瀏覽器不發 afterprint —— 留一個保險，
       不還原的話整頁會一直是空白的。 */
    global.setTimeout(clean, 1500);
  }

  /* 下載 PNG：canvas 自己畫。★ 用系統字型 fillText，中文不會有問題。 */
  function wrapText(ctx, text, max) {
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
    var m = meta || {};
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#7c3aed'; c.fillRect(0, 0, W, 14);

    var y = pad + 30;
    c.fillStyle = '#64748b'; c.font = '600 22px ' + FONT;
    c.fillText('智慧家居機電專題　成果發表', pad, y);
    c.textAlign = 'right';
    c.fillText(String(m.date || ''), W - pad, y);
    c.textAlign = 'left';

    y += 62;
    c.fillStyle = '#0f172a'; c.font = '900 46px ' + FONT;
    wrapText(c, m.scene || '我們的專題', W - pad * 2).forEach(function (l) {
      c.fillText(l, pad, y); y += 56;
    });
    if (m.team) {
      c.fillStyle = '#7c3aed'; c.font = '800 26px ' + FONT;
      c.fillText(m.team, pad, y); y += 44;
    }
    if (m.mode) {
      c.fillStyle = '#0891b2'; c.font = '800 24px ' + FONT;
      c.fillText('模式：' + m.mode, pad, y); y += 40;
    }
    if (m.line) {
      y += 8;
      c.fillStyle = '#f1f5f9'; c.fillRect(pad, y - 26, W - pad * 2, 6);
      y += 20;
      c.fillStyle = '#475569'; c.font = '700 24px ' + FONT;
      wrapText(c, m.line, W - pad * 2).forEach(function (l) { c.fillText(l, pad, y); y += 36; });
    }

    y += 34;
    cardLines(v).forEach(function (row, i) {
      c.fillStyle = '#ede9fe';
      c.fillRect(pad, y - 34, 46, 46);
      c.fillStyle = '#7c3aed'; c.font = '900 26px ' + FONT;
      c.fillText(String(i + 1), pad + 16, y);
      c.fillStyle = '#0f172a'; c.font = '900 30px ' + FONT;
      wrapText(c, row.k, W - pad * 2 - 66).forEach(function (l) {
        c.fillText(l, pad + 66, y); y += 42;
      });
      c.fillStyle = '#334155'; c.font = '700 28px ' + FONT;
      wrapText(c, row.v, W - pad * 2 - 66).forEach(function (l) {
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
  '.pj-tab{flex:1;min-width:130px;text-align:center;padding:10px 8px;border-radius:12px;' +
    'border:2px solid #e2e8f0;font-weight:900;font-size:14px;color:#64748b;background:#fff;' +
    'cursor:pointer}' +
  '.pj-tab.on{border-color:#7c3aed;background:#f5f3ff;color:#5b21b6}' +
  '.pj-tab span{display:block;font-size:11px;font-weight:800;opacity:.8}' +
  '.pj-goal{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:14px 16px;' +
    'font-weight:900;font-size:15px;line-height:1.9;margin-bottom:12px}' +
  '.pj-goal em{color:#fbbf24;font-style:normal}' +
  '.pj-ask{font-size:15px;font-weight:900;color:#0f172a;line-height:1.9;margin:12px 0 8px}' +
  '.pj-stage{background:#0f172a;border-radius:14px;padding:16px;margin:10px 0}' +
  '.pj-strip{display:flex;gap:5px;justify-content:center;margin-bottom:12px}' +
  '.pj-led{width:28px;height:28px;border-radius:50%;border:2px solid #334155}' +
  '.pj-fan{display:flex;align-items:center;justify-content:center;gap:12px;' +
    'color:#e2e8f0;font-weight:900;font-size:15px}' +
  '.pj-blade{width:46px;height:46px;border-radius:50%;border:3px solid #64748b;' +
    'display:flex;align-items:center;justify-content:center;font-size:20px}' +
  '.pj-read{text-align:center;color:#94a3b8;font-weight:900;font-size:14px;margin-top:10px;' +
    'font-variant-numeric:tabular-nums}' +
  '.pj-sl{display:flex;align-items:center;gap:10px;font-weight:900;font-size:15px;margin:10px 0}' +
  '.pj-sl input{flex:1;height:30px;cursor:pointer}' +
  '.pj-fill{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-weight:900;' +
    'font-size:15px;margin:8px 0}' +
  '.pj-t{flex:1;min-width:150px;font-size:15px;font-weight:800;padding:9px 12px;' +
    'border:2px solid #cbd5e1;border-radius:10px;box-sizing:border-box}' +
  '.pj-note{font-size:13px;color:#64748b;font-weight:700;line-height:1.8;margin-top:6px}' +
  '.pj-pick{background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:12px 14px;' +
    'margin:12px 0;font-weight:800;font-size:14px;color:#78350f;line-height:1.8}' +
  /* 成果卡 */
  '.pj-card{background:#fff;border:3px solid #7c3aed;border-radius:18px;padding:24px 26px;' +
    'margin:14px 0;line-height:1.9}' +
  '.pj-hd{display:flex;justify-content:space-between;font-size:12px;font-weight:900;' +
    'color:#7c3aed;letter-spacing:.05em;margin-bottom:10px}' +
  '.pj-title{font-size:26px;font-weight:900;color:#0f172a}' +
  '.pj-team{font-size:15px;font-weight:900;color:#7c3aed;margin-top:2px}' +
  '.pj-mode{font-size:14px;font-weight:900;color:#0891b2;margin-top:2px}' +
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
    var tab = 'demo';                 // demo（兩種模式）／show（成果發表）
    var mode = 'auto';
    var cm = 60, pct = 50;
    var f = Object.assign({ team: '', mode: '', problem: '', when: '', then: '',
                            trouble: '', fix: '' }, opts.work || {});

    function tabs() {
      var t = [['demo', '🎛️ 兩種模式', '玩玩看，複習前四節'],
               ['show', '🎤 成果發表', '三句話 ＋ 成果卡']];
      return '<div class="pj-lv">' + t.map(function (x) {
        return '<div class="pj-tab ' + (tab === x[0] ? 'on' : '') + '" data-tab="' + x[0] + '">' +
          x[1] + '<span>' + x[2] + '</span></div>';
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

    /* ── 兩種模式的展示 ── */
    function state() { return mode === 'auto' ? autoOf(cm) : manualOf(pct); }
    function stageHtml() {
      var st = state(), col = LK().hexOf(LK().hueRgb(st.hue));
      var leds = '';
      for (var i = 1; i <= LEDS; i++) {
        var on = st.on >= i && (mode === 'auto' ? st.near : true);
        /* 手動只亮一顆（位置會跑）；自動是亮幾顆（越近越多） */
        if (mode === 'manual') on = (i === st.on);
        leds += '<div class="pj-led" style="background:' + (on ? col : '#1e293b') +
          (on ? ';box-shadow:0 0 12px ' + col : '') + '"></div>';
      }
      return '<div class="pj-stage"><div class="pj-strip">' + leds + '</div>' +
        '<div class="pj-fan"><div class="pj-blade" style="color:' +
          (st.speed > 0 ? '#38bdf8' : '#475569') + '">✦</div>' +
          (st.speed > 0 ? '風扇轉速 ' + st.speed + '%' : '風扇停止') + '</div>' +
        '<div class="pj-read">' +
          (mode === 'auto'
            ? '距離 ' + cm + ' 公分　｜　' + (st.near ? '有人來了' : '沒人（超過 ' + NEAR + ' 公分）')
            : '旋鈕 ' + pct + '%　｜　色相 ' + st.hue + '　｜　第 ' + st.on + ' 顆') +
        '</div></div>';
    }
    function viewDemo(msg, cls) {
      var m = MODES.filter(function (x) { return x.key === mode; })[0];
      view(
        '<div class="pj-ask">🎛️ 同一組硬體，<b>兩種玩法</b>　—— ' +
        '⚠️ 你的作品<b>挑一種做就好</b>，不用兩種都做。</div>' +
        '<div class="pj-lv">' + MODES.map(function (x) {
          return '<div class="pj-tab ' + (mode === x.key ? 'on' : '') +
            '" data-mode="' + x.key + '">' + x.t + '模式<span>靠' + esc(x.by) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="pj-note">' + esc(m.d) + '<br>' + md(m.good) + '</div>' +
        '<div id="pj-stage">' + stageHtml() + '</div>' +
        (mode === 'auto'
          ? '<div class="pj-sl"><label>距離</label>' +
            '<input type="range" id="pj-cm" min="' + DIST_MIN + '" max="' + DIST_MAX +
              '" value="' + cm + '"><b>' + cm + ' cm</b></div>' +
            '<div class="pj-note">⚠️ 拉到 ' + NEAR + ' 公分以內才會有反應 —— ' +
            '那個 ' + NEAR + ' 就是<b>你要自己決定的門檻</b>。</div>'
          : '<div class="pj-sl"><label>旋鈕</label>' +
            '<input type="range" id="pj-pct" min="0" max="100" value="' + pct + '"><b>' +
              pct + ' %</b></div>' +
            '<div class="pj-note">★ 這就是第三、四節的「類比對應」—— ' +
            '同一個旋鈕，換算成<b>轉速</b>、<b>顏色</b>、<b>第幾顆</b>。</div>') +
        '<div class="pj-pick">📝 想好了嗎？你的作品要做<b>' +
          MODES.map(function (x) { return x.t; }).join('</b>還是<b>') + '</b>？' +
          '<div class="pj-fill" style="margin-top:8px">' +
            MODES.map(function (x) {
              return '<button class="dl-go" data-pick="' + x.t + '"' +
                (f.mode === x.t ? '' : ' style="background:#94a3b8"') + '>' +
                (f.mode === x.t ? '✅ ' : '') + x.t + '模式</button>';
            }).join(' ') +
          '</div></div>' +
        '<div class="dl-row"><button class="dl-go" id="pj-go-show">去填成果發表 →</button></div>',
        msg, cls);
    }
    /* ⚠️ 拉滑桿時**只換舞台那一塊** —— 整頁重畫會讓滑桿失焦，
       手指還按著就斷了（第三節踩過這個坑）。 */
    function paint() {
      var st = el.querySelector('#pj-stage');
      if (st) st.innerHTML = stageHtml();
      var b = el.querySelector('.pj-sl b');
      if (b) b.textContent = mode === 'auto' ? (cm + ' cm') : (pct + ' %');
    }

    /* ── 成果發表 ── */
    function viewShow(msg, cls) {
      view(
        '<div class="pj-ask">🎤 <b>成果發表</b>　—— 固定講這三句就好。</div>' +
        '<div class="pj-fill">組別／組員：<input class="pj-t" id="pj-team" value="' +
          esc(f.team) + '" placeholder="例：二年三班　第 4 組　王小明、李小華"></div>' +
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
      return { scene: scene, team: f.team, mode: f.mode, line: line,
               date: new Date().toLocaleDateString('zh-TW') };
    }
    function doShow() {
      grab();
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
      if (typeof opts.onDone === 'function') opts.onDone({ work: f });
    }

    function grab() {
      [['pj-team', 'team'], ['pj-problem', 'problem'], ['pj-when', 'when'],
       ['pj-then', 'then'], ['pj-trouble', 'trouble'], ['pj-fix', 'fix']].forEach(function (x) {
        var e = el.querySelector('#' + x[0]);
        if (e) f[x[1]] = e.value;
      });
    }
    function show(t) { tab = t; if (t === 'demo') viewDemo('', ''); else viewShow('', ''); }

    function bind() {
      var on = function (id, fn) {
        var e = el.querySelector('#' + id); if (e) e.addEventListener('click', fn);
      };
      on('pj-make', doShow);
      on('pj-print', function () { printCard(cardHtml(f, meta())); });
      on('pj-png', function () { downloadPng(f, meta()); });
      on('pj-back', function () { show('show'); });
      on('pj-go-show', function () { show('show'); });
      /* ★ 兩塊都是開的，隨時可以來回 —— 這一節不是關卡（老師 2026-08-25）。 */
      el.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (tab === 'show') grab();
          show(b.getAttribute('data-tab'));
        });
      });
      el.querySelectorAll('[data-mode]').forEach(function (b) {
        b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); viewDemo('', ''); });
      });
      el.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () { f.mode = b.getAttribute('data-pick'); viewDemo('', ''); });
      });
      var sc = el.querySelector('#pj-cm');
      if (sc) sc.addEventListener('input', function () { cm = Number(sc.value); paint(); });
      var sp = el.querySelector('#pj-pct');
      if (sp) sp.addEventListener('input', function () { pct = Number(sp.value); paint(); });
    }

    show('demo');
    return { tab: function () { return tab; }, mode: function () { return mode; },
             work: function () { return f; },
             setCm: function (v) { cm = v; paint(); },
             setPct: function (v) { pct = v; paint(); },
             show: show, card: function () { return cardHtml(f, meta()); } };
  }

  global.PROJLAB = {
    MIN: MIN, LEDS: LEDS, NEAR: NEAR, FULL: FULL, HUE_MAX: HUE_MAX, MODES: MODES, SHOW_Q: SHOW_Q,
    autoOf: autoOf, manualOf: manualOf,
    judgeShow: judgeShow, sayShow: sayShow,
    cardHtml: cardHtml, drawCard: drawCard, printCard: printCard, downloadPng: downloadPng,
    mount: mount
  };

})(window);
