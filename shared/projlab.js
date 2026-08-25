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

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
  /* ── 兩種模式 ────────────────────────────────────────
     ⚠️⚠️ 老師 2026-08-25：「前面複習已經有配合了，那後面的兩種模式目的是?」
     ★ 問得對 —— 第一版這裡又放了一組滑桿讓學生拉，
       和上面的複習盤在做**同一件事**（輸入動一動、看輸出）。
       重複的互動不會多教到什麼，只會讓人以為自己走錯地方。
     ⇒ 改成一張**對照表**，而且給它一個複習盤沒有的目的：
       「**你的程式裡，條件判斷在哪裡？**」
         自動：如果…那麼…否則…　—— 判斷寫在中間，這是第一節那一課
         手動：直接換算，**沒有條件判斷** —— 所以要自己補一個
     ★ 這正好接上成果發表第二句要寫的東西。 */
  /* ⚠️⚠️ 老師 2026-08-25：「自動版本使用超音波，手動版版使用可變電阻，
     所以一個輸入＋兩個輸出完成這個專案」。
     ★ 所以**輸入從頭到尾只有一個**，挑戰關加的是第二個**輸出**。
       兩個輸入的版本已經拿掉 —— 那會讓學生同時應付兩種讀值，
       而這一節要練的是「同一個判斷，讓兩樣東西一起動」。 */
  var MODES = [
    { key: 'auto', t: '自動', by: '超音波距離感測器',
      d: '人一靠近就亮、就轉；走遠了自己停。',
      good: '★ 好處：不用動手。⚠️ 代價：想要它「現在別亮」也做不到。',
      cond: '**有**條件判斷',
      code: '如果　距離 < 30　那麼\n　　燈條亮起來\n　　風扇開始轉\n否則\n　　兩個都關掉',
      note: '★ 那個 30 就是**你要自己決定的門檻**。' +
            '⚠️ 「否則」不能省 —— 少了它，燈亮起來就再也不會暗（第一節那一課）。' },
    { key: 'manual', t: '手動', by: '可變電阻（旋鈕）',
      d: '轉到哪就是哪 —— 顏色和轉速都自己說了算。',
      good: '★ 好處：完全可控。⚠️ 代價：得一直自己轉。',
      cond: '⚠️ **沒有**條件判斷',
      code: '轉速 ← 類比對應（A7，−250，250）\n設定馬達 = 轉速\n燈條顏色 ← 類比對應（A7，0，359）',
      note: '⚠️ 這樣寫從頭到尾**沒有一個「如果」** —— 它只是照著換算。' +
            '★ 所以做手動的組別要**自己補一個條件**，例如：' +
            '「如果 旋鈕 < 5%，那麼 兩個都關掉」。' }
  ];

  /* ⚠️ 原本這裡有 LEDS／NEAR／FULL／HUE_MAX／SPD 和 autoOf()／manualOf()
     —— 那是給第二組滑桿算畫面用的。滑桿收掉之後它們就沒人用了。
     ★ 留著死碼比刪掉更糟：下一個人會以為它被測過。
     （那些換算現在只在複習盤 shared/planlab.js 裡，一份就好。） */

  /* ── 成果發表的三句 ────────────────────────────────
     ★ 老師指定，一字不改。 */
  var SHOW_Q = [
    /* ★ 老師 2026-08-25：前面改成「研發人員」（單數），
       所以三句的主詞一律用「我」。 */
    { key: 's1', t: '我要解決的問題是：', slots: ['problem'],
      ph: ['例：晚上回家玄關太暗，開燈要摸半天'] },
    /* ★ 老師 2026-08-25：「加註 如果 那麼 或者 如果 那麼 否則
       一定要有條件判斷」。
       ⚠️ 這一句不是在描述「我們做了什麼」，它就是**程式裡那個判斷**。
          寫不出條件的組別，通常是程式裡也沒有 —— 那才是要抓的。 */
    /* ★★ 老師 2026-08-25（追加）：「要有兩種條件(如果 那麼 否則)」。
       ⚠️ 所以第二句多一格「否則」—— 而且那一格是**擋得住最多錯**的地方：
          第一節整節課在講的「門開了沒」，病根就是少了否則。
          少了它，燈亮起來就再也不會暗。 */
    { key: 's2', t: '當＿＿＿＿時，系統會＿＿＿＿；否則＿＿＿＿。',
      slots: ['when', 'then', 'els'],
      hint: '＝ <b>如果</b>（條件）<b>那麼</b>（動作）<b>否則</b>（另一個動作）<br>' +
            '⚠️ 「否則」那一格不能空 —— 少了它，動作做了就<b>回不去</b>。',
      ph: ['例：距離小於 30 公分', '例：燈條亮起來、風扇開始轉', '例：兩個都關掉'] },
    /* ★★ 老師 2026-08-25：「我遇到＿＿，最後用＿＿解決，我學到＿＿」。
       ⚠️ 多的那一格是**反思** —— 前兩格講的是「事情經過」，
          第三格才是「所以呢」。
       ★ 沒有它的話，發表就停在「我修好了」；有了它，
         學生得回頭想「這件事以後還能用在哪」。 */
    { key: 's3', t: '我遇到＿＿＿＿，最後用＿＿＿＿解決，我學到＿＿＿＿。',
      slots: ['trouble', 'fix', 'learn'],
      ph: ['例：距離一直跳來跳去，燈會閃',
           '例：把門檻改成兩個數字（進 15 出 25）',
           '例：感測器讀到的數字會抖，門檻不能只設一個'] }
  ];
  /* ⚠️ 第三句最常見的敷衍就是「沒有遇到問題」。
     ★ 那句話一寫出來，這一節最有價值的部分（怎麼卡住、怎麼解掉）就沒了。 */
  var NO_TROUBLE = /^(沒有|沒|無|都很順利|很順利|沒問題|沒遇到|一切順利|none|no)/;
  /* ★★ 老師 2026-08-25：「一定要有條件判斷」。
     ⚠️ 「當我們做好的時候」不是條件 —— 條件要**看得出是拿什麼在比**。
        ⇒ 要有數字，或一個比較／臨界的說法。
     ⚠️ 刻意放寬到「靠近／碰到／轉到底」這種生活講法 ——
        國中生講得出那個意思就算，不必寫成數學式。 */
  var COND = new RegExp('[0-9０-９]|小於|大於|超過|低於|高於|以內|以下|以上|不到|' +
                        '靠近|接近|太近|太遠|碰到|轉到|滿|到達|超出|距離|公分|%');
  function judgeShow(v) {
    /* ⚠️⚠️ 這一條要**排在長度檢查前面**。
       第一版先查長度 —— 但學生實際上打的就是「沒有」兩個字，
       兩個字不到門檻，於是他收到的是「太短，至少寫 4 個字」。
       ★ 那句話會把他推向**更糟的方向**：他只會補成「沒有遇到問題」，
         剛好長度過關，而這一格最值錢的東西還是沒寫。 */
    if (NO_TROUBLE.test(norm(v.trouble))) return { ok: false, how: 'notrouble' };
    var miss = [];
    ['problem', 'when', 'then', 'els', 'trouble', 'fix', 'learn'].forEach(function (k) {
      if (norm(v[k]).length < MIN) miss.push(k);
    });
    if (miss.length) return { ok: false, how: 'short', miss: miss };
    if (!COND.test(String(v.when || ''))) return { ok: false, how: 'nocond' };
    return { ok: true, how: 'fit' };
  }
  var LABEL = { problem: '要解決的問題', when: '當…時', then: '系統會…',
                els: '否則…', trouble: '我遇到…', fix: '最後用…解決',
                learn: '我學到…' };
  function sayShow(r) {
    if (r.how === 'nocond')
      return '⚠️ 第二句的「當＿＿時」要是一個**條件** —— ' +
             '也就是程式裡那個「**如果**」。\n' +
             '★ 條件要看得出**拿什麼在比**：' +
             '「距離小於 30 公分」「旋鈕轉到底」「太近的時候」都可以；\n' +
             '⚠️ 「當我們做好的時候」不算 —— 那不是程式判斷得出來的事。';
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
  /* ⚠️⚠️ cardLines() 是**下載 PNG 那一版的唯一版面來源** ——
     網頁上的 cardHtml() 有自己的一份。
     ★ 兩份要一起改：突變測試把這裡的「我學到」刪掉，
       網頁版照樣正確、測試也照樣綠，**只有下載下來的圖少一句**。
       ⇒ 所以這支要匯出，讓測試直接盯它。 */
  function cardLines(v) {
    return [
      { k: '我要解決的問題是', v: v.problem },
      { k: '當　' + v.when + '　時', v: '系統會　' + v.then + '；否則　' + v.els },
      { k: '我遇到　' + v.trouble, v: '最後用　' + v.fix + '　解決' },
      { k: '我學到', v: v.learn }
    ];
  }
  function cardHtml(v, meta) {
    var esc = LK().esc;
    var m = meta || {};
    return '<div class="pj-card" id="pj-card">' +
      '<div class="pj-hd"><span>智慧家居機電專題　成果發表</span>' +
        '<span>' + esc(m.date || '') + '</span></div>' +
      '<div class="pj-title">' + esc(m.scene || '我的專題') + '</div>' +
      (m.team ? '<div class="pj-team">' + esc(m.team) + '</div>' : '') +
      (m.mode ? '<div class="pj-mode">模式：' + esc(m.mode) + '</div>' : '') +
      (m.line ? '<div class="pj-line">' + esc(m.line) + '</div>' : '') +
      '<ol class="pj-ol">' +
        '<li><b>我要解決的問題是：</b><br>' + esc(v.problem) + '</li>' +
        '<li><b>當</b> ' + esc(v.when) + ' <b>時，系統會</b> ' + esc(v.then) +
          '<b>；否則</b> ' + esc(v.els) + '。</li>' +
        '<li><b>我遇到</b> ' + esc(v.trouble) +
          ' <b>，最後用</b> ' + esc(v.fix) + ' <b>解決。</b><br>' +
          '<b>我學到</b> ' + esc(v.learn) + '。</li>' +
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
    wrapText(c, m.scene || '我的專題', W - pad * 2).forEach(function (l) {
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

  '.pj-read{text-align:center;color:#94a3b8;font-weight:900;font-size:14px;margin-top:10px;' +
    'font-variant-numeric:tabular-nums}' +
  '.pj-sl{display:flex;align-items:center;gap:10px;font-weight:900;font-size:15px;margin:10px 0}' +
  '.pj-sl input{flex:1;height:30px;cursor:pointer}' +
  '.pj-fill{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-weight:900;' +
    'font-size:15px;margin:8px 0}' +
  '.pj-t{flex:1;min-width:150px;font-size:15px;font-weight:800;padding:9px 12px;' +
    'border:2px solid #cbd5e1;border-radius:10px;box-sizing:border-box}' +
  '.pj-note{font-size:13px;color:#64748b;font-weight:700;line-height:1.8;margin-top:6px}' +
  '.pj-hint{font-size:13px;font-weight:800;color:#7c3aed;background:#f5f3ff;' +
    'border-radius:10px;padding:7px 10px;margin-top:5px;line-height:1.8}' +
  /* 兩種模式的對照表 */
  '.pj-cmp{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}' +
  '.pj-col{border:2px solid #e2e8f0;border-radius:14px;padding:13px;background:#fff}' +
  '.pj-col.on{border-color:#7c3aed;background:#faf5ff;box-shadow:0 0 0 3px #ede9fe}' +
  '.pj-col-h{font-size:17px;font-weight:900;color:#0f172a;margin-bottom:6px}' +
  '.pj-col-b{font-size:14px;font-weight:800;color:#334155;line-height:1.8}' +
  '.pj-code{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px 12px;' +
    'font-family:monospace;font-size:13px;line-height:1.9;margin:8px 0}' +
  '.pj-cond{font-size:14px;font-weight:900;color:#7c3aed;margin-bottom:4px}' +
  '.pj-col-n{font-size:13px;font-weight:700;color:#64748b;line-height:1.8;margin-bottom:6px}' +
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
    var scene = (opts.plan && opts.plan.scene) || '我的專題';
    var tab = 'demo';                 // demo（兩種模式）／show（成果發表）
    /* ★ 自動帶入班級座號姓名（頁面從 SSO 拿）。
       ⚠️ 只在「學生還沒自己填過」的時候帶入 —— 不然他改了名字（加組員）
          會被下一次重新掛載蓋掉。 */
    var f = Object.assign({ team: '', mode: '', problem: '', when: '', then: '', els: '',
                            trouble: '', fix: '', learn: '' }, opts.work || {});
    if (!f.team && opts.who) f.team = opts.who;
    /* 三態：已帶入／還在問名冊／問不到。⚠️ 不可以靜默留白。 */
    var whoState = f.team ? 'got' : 'wait';
    function whoNote() {
      if (whoState === 'got')
        return '★ 已自動帶入你的班級座號姓名（可以自己改，例如加上組員）。';
      if (whoState === 'wait')
        return '⏳ 正在讀你的班級座號姓名…（讀到會自動填，也可以先自己打）';
      return '⚠️ <b>這一頁沒問到你的班級座號姓名</b>，請自己填。' +
             '（不影響其他紀錄 —— 但**成果卡上不能沒有名字**。）';
    }
    /* ★ 頁面問到名冊之後補進來。
       ⚠️ 學生自己填過就不覆蓋 —— 他可能加了組員。 */
    function setWho(t) {
      if (!t) { whoState = 'miss'; }
      else {
        whoState = 'got';
        if (!norm(f.team)) {
          f.team = t;
          var e = el.querySelector('#pj-team');
          if (e) e.value = t;
        }
      }
      var n = el.querySelector('#pj-whonote');
      if (n) n.innerHTML = whoNote();
    }

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

    /* ── 兩種模式：對照表（不再放第二組滑桿）── */
    function viewDemo(msg, cls) {
      view(
        '<div class="pj-ask">🎛️ 同一組硬體，<b>兩種寫法</b>　—— ' +
        '⚠️ 你的作品<b>挑一種做就好</b>。<br>' +
        '★ 不管挑哪一種，都是 <b>一個輸入 ＋ 兩個輸出</b>：' +
        '輸入從頭到尾不換，挑戰關加的是<b>第二個輸出</b>。</div>' +
        '<div class="pj-cmp">' + MODES.map(function (m) {
          return '<div class="pj-col' + (f.mode === m.t ? ' on' : '') + '">' +
            '<div class="pj-col-h">' + esc(m.t) + '模式</div>' +
            '<div class="pj-col-b">靠 <b>' + esc(m.by) + '</b><br>' + esc(m.d) + '</div>' +
            '<div class="pj-code">' + esc(m.code).replace(/\n/g, '<br>') + '</div>' +
            '<div class="pj-cond">' + md(m.cond) + '</div>' +
            '<div class="pj-col-n">' + md(m.note) + '</div>' +
            '<div class="pj-col-n">' + md(m.good) + '</div>' +
            '<button class="dl-go" data-pick="' + esc(m.t) + '"' +
              (f.mode === m.t ? '' : ' style="background:#94a3b8"') + '>' +
              (f.mode === m.t ? '✅ 我做這一種' : '選這一種') + '</button>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="pj-pick">🧩 <b>不管做哪一種，程式裡一定要有一個「如果」。</b><br>' +
          '自動那一種本來就有；手動那一種要自己補 —— ' +
          '想想看：<b>什麼情況下它應該整個停下來？</b><br>' +
          '★ 這一句等一下就是成果發表的第二句。</div>' +
        '<div class="dl-row"><button class="dl-go" id="pj-go-show">去填成果發表 →</button></div>',
        msg, cls);
    }

    /* ── 成果發表 ── */
    function viewShow(msg, cls) {
      view(
        '<div class="pj-ask">🎤 <b>成果發表</b>　—— 固定講這三句就好。</div>' +
        /* ★ 老師 2026-08-25：「組別／組員」改成「研發人員」，
           而且班級座號姓名要由系統自動填入。
           ⚠️⚠️ 老師追問：「不是要在名冊內才能登入?」—— 對。
              ★ 所以「讀不到」**不是**沒登入、也不是名冊沒建 ——
                那兩種情況根本進不到這一頁。
              ⇒ 真正會發生的只有「**還沒問到**」：SSO 讀的是快取，
                直接開網址或新分頁進來時快取是空的，要去問一次名冊。
              ⚠️ 第一版把原因寫成「可能是沒登入」—— 那是**猜的，而且猜錯**。
                 錯的原因比沒有原因更糟：學生會跑去重新登入，然後發現沒用。 */
        '<div class="pj-fill">研發人員：<input class="pj-t" id="pj-team" value="' +
          esc(f.team) + '" placeholder="例：二年三班　13 號　王小明"></div>' +
        '<div class="pj-note" id="pj-whonote">' + whoNote() + '</div>' +
        '<div class="pj-ask" style="margin-top:10px">1. 我要解決的問題是：</div>' +
        '<div class="pj-fill"><input class="pj-t" id="pj-problem" value="' + esc(f.problem) +
          '" placeholder="' + esc(SHOW_Q[0].ph[0]) + '"></div>' +
        '<div class="pj-ask" style="margin-top:10px">2. 當＿＿時，系統會＿＿；否則＿＿。' +
          '<div class="pj-hint">' + SHOW_Q[1].hint + '</div></div>' +
        '<div class="pj-fill">當　<input class="pj-t" id="pj-when" value="' + esc(f.when) +
          '" placeholder="' + esc(SHOW_Q[1].ph[0]) + '">　時</div>' +
        '<div class="pj-fill">系統會　<input class="pj-t" id="pj-then" value="' + esc(f.then) +
          '" placeholder="' + esc(SHOW_Q[1].ph[1]) + '"></div>' +
        '<div class="pj-fill">否則　<input class="pj-t" id="pj-els" value="' + esc(f.els) +
          '" placeholder="' + esc(SHOW_Q[1].ph[2]) + '"></div>' +
        '<div class="pj-ask" style="margin-top:10px">' +
          '3. 我遇到＿＿，最後用＿＿解決，我學到＿＿。</div>' +
        '<div class="pj-fill">我遇到　<input class="pj-t" id="pj-trouble" value="' +
          esc(f.trouble) + '" placeholder="' + esc(SHOW_Q[2].ph[0]) + '"></div>' +
        '<div class="pj-fill">最後用　<input class="pj-t" id="pj-fix" value="' + esc(f.fix) +
          '" placeholder="' + esc(SHOW_Q[2].ph[1]) + '">　解決</div>' +
        '<div class="pj-fill">我學到　<input class="pj-t" id="pj-learn" value="' + esc(f.learn) +
          '" placeholder="' + esc(SHOW_Q[2].ph[2]) + '"></div>' +
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
       ['pj-then', 'then'], ['pj-els', 'els'],
       ['pj-trouble', 'trouble'], ['pj-fix', 'fix'],
       ['pj-learn', 'learn']].forEach(function (x) {
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
      el.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () { f.mode = b.getAttribute('data-pick'); viewDemo('', ''); });
      });
    }

    show('demo');
    return { tab: function () { return tab; }, work: function () { return f; },
             setWho: setWho, whoState: function () { return whoState; },
             show: show, card: function () { return cardHtml(f, meta()); } };
  }

  global.PROJLAB = {
    MIN: MIN, MODES: MODES, SHOW_Q: SHOW_Q,
    judgeShow: judgeShow, sayShow: sayShow,
    cardHtml: cardHtml, cardLines: cardLines, drawCard: drawCard, printCard: printCard, downloadPng: downloadPng,
    mount: mount
  };

})(window);
