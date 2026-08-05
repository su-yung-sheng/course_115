/* =====================================================================
   Scratch 風積木模擬器（上下學期共用）
   ---------------------------------------------------------------------
   讓學生在網頁上直接把積木拖出一段程式，按執行看角色怎麼動，
   組對了就算通關 —— 不必離開頁面去 Scratch、也不必上傳作品。

   ★ 為什麼自己做而不是嵌 Scratch 官方編輯器：
     官方編輯器沒有「這一關只能用這幾塊積木」也沒有「答案對不對」的概念。
     這裡的重點是**限定積木**與**自動判定**，等於一道結構化的練習題，
     不是一個自由創作環境。自由創作仍然回 Scratch 做。

   ⚠️ 判定跑在瀏覽器裡，所以「通關」是學生的電腦說了算。
      會開 F12 的學生可以直接把自己標成通過。
      這是「取代 AI 批改」這個選擇的必然代價 ——
      安全規則擋得住「寫別人的進度」，擋不住「謊報自己的成績」。

   ---------------------------------------------------------------------
   用法：
     BLOCKS.mount(document.getElementById('sim'), {
       palette : ['motion.move', 'control.repeat', …],   // 這一關給哪些積木
       goal    : [ {id:'motion.move', args:[10]} ],      // 正確答案
       hint    : '把小貓往前移動 10 點',
       onPass  : () => { … }                             // 組對時呼叫
     });

   拖曳用 pointer events 自己實作，不用 HTML5 drag-and-drop ——
   後者在平板／觸控螢幕上不會觸發，而電腦教室有時會用觸控螢幕。
   ===================================================================== */
(function (global) {
  'use strict';

  /* ===== 積木定義 =====
     label 裡的 %n / %s 是參數欄位（數字／文字），順序對應 args。
     shape: 'stack' 一般積木｜'c' 可以包住其他積木｜'hat' 開頭帽子

     ★★ 積木名稱一律照 Scratch 官方繁體中文，一個字都不改 ★★
     來源：scratch-l10n（Scratch 官方翻譯庫）
       積木   https://github.com/scratchfoundation/scratch-l10n/blob/master/editor/blocks/zh-tw.json
       擴充   https://github.com/scratchfoundation/scratch-l10n/blob/master/editor/extensions/zh-tw.json
     學生在這裡練完回去打開 Scratch，看到的必須是同一個名字 ——
     自己取「落筆」「全部擦掉」這種聽起來比較白話的名字，等於逼學生
     學兩套詞彙，那是我們自己製造的障礙。
     每個積木後面都標了官方的訊息代號，之後要對照就從那裡查。
     check.py 會比對常用積木的名稱，改錯會被擋下來。

     下面標「★自訂」的幾塊在 Scratch 裡沒有對應積木（是為了避開
     「回報值積木」而做的簡化），只有那幾塊是我們自己命名的。 */
  /* 宣告順序＝調色盤的分類順序，刻意照真的 Scratch 排：
     動作 → 外觀 → 音效 → 事件 → 控制 → 變數 → 清單 → 函式積木 → 畫筆（擴充）
     顏色也用 Scratch 的原色，學生在這裡看到的藍色，回到 Scratch 還是同一個藍色。 */
  var CATS = {
    motion:  { name: '動作',   color: '#4c97ff', dark: '#3373cc' },  // CATEGORY_MOTION
    looks:   { name: '外觀',   color: '#9966ff', dark: '#774dcb' },  // CATEGORY_LOOKS
    sound:   { name: '音效',   color: '#cf63cf', dark: '#bd42bd' },  // CATEGORY_SOUND
    events:  { name: '事件',   color: '#ffbf00', dark: '#cc9900' },  // CATEGORY_EVENTS
    control: { name: '控制',   color: '#ffab19', dark: '#cf8b17' },  // CATEGORY_CONTROL
    data:    { name: '變數',   color: '#ff8c1a', dark: '#db6e00' },  // CATEGORY_VARIABLES
    list:    { name: '清單',   color: '#ff661a', dark: '#e64d00' },  // Scratch 把清單放在「變數」裡，顏色是這個
    my:      { name: '函式積木', color: '#ff6680', dark: '#ff4d6a' }, // CATEGORY_MYBLOCKS（不是「我的積木」）
    pen:     { name: '畫筆',   color: '#0fbd8c', dark: '#0b8e69' }   // pen.categoryName
  };

  var DEFS = {
    // %flag 會畫成綠旗（就是 Scratch 的那面旗子），不是播放三角形
    'events.whenflag':  { cat:'events',  shape:'hat',   label:'當 %flag 被點擊' },              // EVENT_WHENFLAGCLICKED
    'motion.move':      { cat:'motion',  shape:'stack', label:'移動 %n 點',        args:[10] }, // MOTION_MOVESTEPS
    // ↻ ↺ 是 Scratch 積木上真的有的箭頭圖示（MOTION_TURNRIGHT 的 %1）
    // 預設 15 度也照 Scratch —— 順便讓調色盤不會直接把答案（90）送給學生
    'motion.turnright': { cat:'motion',  shape:'stack', label:'右轉 ↻ %n 度',      args:[15] }, // MOTION_TURNRIGHT
    'motion.turnleft':  { cat:'motion',  shape:'stack', label:'左轉 ↺ %n 度',      args:[15] }, // MOTION_TURNLEFT
    'motion.goto':      { cat:'motion',  shape:'stack', label:'定位到 x:%n y:%n',  args:[0, 0] },// MOTION_GOTOXY（冒號後沒空格）
    'motion.changey':   { cat:'motion',  shape:'stack', label:'y 改變 %n',         args:[10] }, // MOTION_CHANGEYBY
    'looks.say':        { cat:'looks',   shape:'stack', label:'說出 %s',           args:['Hello!'] },     // LOOKS_SAY
    'looks.sayfor':     { cat:'looks',   shape:'stack', label:'說出 %s 持續 %n 秒', args:['Hello!', 2] }, // LOOKS_SAYFORSECS
    'looks.next':       { cat:'looks',   shape:'stack', label:'造型換成下一個' },                // LOOKS_NEXTCOSTUME
    'looks.change':     { cat:'looks',   shape:'stack', label:'尺寸改變 %n',       args:[10] }, // LOOKS_CHANGESIZEBY
    'sound.play':       { cat:'sound',   shape:'stack', label:'播放音效 %s',       args:['喵'] },// SOUND_PLAY
    'control.wait':     { cat:'control', shape:'stack', label:'等待 %n 秒',        args:[1] },  // CONTROL_WAIT
    'control.repeat':   { cat:'control', shape:'c',     label:'重複 %n 次',        args:[10] }, // CONTROL_REPEAT
    'data.setvar':      { cat:'data',    shape:'stack', label:'變數 %s 設為 %n',   args:['分數', 0] }, // DATA_SETVARIABLETO
    'data.changevar':   { cat:'data',    shape:'stack', label:'變數 %s 改變 %n',   args:['分數', 1] }, // DATA_CHANGEVARIABLEBY

    /* 畫筆（擴充積木）：1～3 關畫正方形、正多邊形要用 */
    'pen.clear':        { cat:'pen',     shape:'stack', label:'筆跡全部清除' },                  // pen.clear
    'pen.down':         { cat:'pen',     shape:'stack', label:'下筆' },                          // pen.penDown
    'pen.up':           { cat:'pen',     shape:'stack', label:'停筆' },                          // pen.penUp
    'pen.color':        { cat:'pen',     shape:'stack', label:'筆跡顏色設為 %s', args:['紅'] },  // pen.setHue

    /* 函式積木（Scratch 的「函式積木」分類）：1～3 關的主角
       PROCEDURES_DEFINITION 是「定義 %1」，呼叫時就是積木自己的名字。
       ⚠️ 只支援「一個數字參數」。真正的 Scratch 可以有任意個參數，
          但這裡是結構化練習題，一個參數就分得出「有參數／沒參數」的差別，
          多做只會讓判定與畫面複雜好幾倍。 */
    // idArgs 標出「這一格是學生自己取的名字」，判定時只看定義與呼叫有沒有對上，
    // 不要求跟參考答案同名（詳見下面 canon()）。廣播積木加進來時也要標。
    'my.define':        { cat:'my',      shape:'c',     label:'定義 %s',           args:['畫正方形'], idArgs:[0] },
    'my.definep':       { cat:'my',      shape:'c',     label:'定義 %s (邊長)',    args:['畫正方形'], idArgs:[0] },
    'my.call':          { cat:'my',      shape:'stack', label:'%s',                args:['畫正方形'], idArgs:[0] },
    'my.callp':         { cat:'my',      shape:'stack', label:'%s %n',             args:['畫正方形', 50], idArgs:[0] },
    // 在 Scratch 裡是把橢圓形的參數「邊長」拖進「移動 () 點」，
    // 這裡沒有橢圓積木，所以做成一塊固定的積木，名字照樣是「移動 () 點」
    'my.movearg':       { cat:'my',      shape:'stack', label:'移動 (邊長) 點' },

    /* 清單與判斷：5～10 關的排序、搜尋要用
       ★自訂 —— 這幾塊在 Scratch 裡是好幾塊積木組起來的（要用橢圓形的
       回報值積木塞進另一塊裡）。引擎還不支援巢狀的回報值，先做成單塊，
       名稱盡量沿用官方用詞（「清單 %1 的長度」「%2 的第 %1 項」）。
       等引擎補上回報值積木，這幾塊就該拆回真正的 Scratch 組合。 */
    'list.swap':        { cat:'list',    shape:'stack', label:'交換 數列 的第 %n 項和第 %n 項', args:[1, 2] }, // ★自訂
    'list.say':         { cat:'list',    shape:'stack', label:'說出 數列 的第 %n 項', args:[1] },              // ★自訂
    'list.setidx':      { cat:'list',    shape:'stack', label:'變數 %s 設為 %n',   args:['位置', 1] },         // DATA_SETVARIABLETO
    'list.changeidx':   { cat:'list',    shape:'stack', label:'變數 %s 改變 %n',   args:['位置', 1] },         // DATA_CHANGEVARIABLEBY
    'control.ifless':   { cat:'control', shape:'c',     label:'如果 數列 的第 %n 項 < 數列 的第 %n 項 那麼', args:[1, 2] }, // ★自訂
    'control.repeatlen':{ cat:'control', shape:'c',     label:'重複 清單 數列 的長度 次' },                     // ★自訂
    'control.until':    { cat:'control', shape:'c',     label:'重複直到 找到目標' }                            // ★自訂
  };

  /* ===== 小工具 ===== */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function uid() { return 'b' + Math.random().toString(36).slice(2, 9); }

  /* Scratch 的綠旗與紅色停止鈕。
     用 SVG 而不是 emoji：unicode 裡根本沒有「綠旗」這個字元
     （白旗、黑旗、格子旗都不是），而且 emoji 在不同系統長得不一樣。
     積木上的圖示應該到哪一台電腦都是同一面旗子。 */
  var FLAG_SVG =
    '<svg viewBox="0 0 32 32" width="15" height="15" aria-hidden="true" style="vertical-align:-2px">' +
    '<rect x="4" y="3" width="3" height="26" rx="1.5" fill="#4cbf56"/>' +
    '<path fill="#4cbf56" d="M8 4c6-3 12 3 19 0v12c-7 3-13-3-19 0z"/></svg>';
  var STOP_SVG =
    '<svg viewBox="0 0 32 32" width="15" height="15" aria-hidden="true" style="vertical-align:-2px">' +
    '<path fill="#ec5959" d="M10.5 3h11L29 10.5v11L21.5 29h-11L3 21.5v-11z"/></svg>';

  function svgSpan(svg) {
    var n = document.createElement('span');
    n.innerHTML = svg;
    n.style.cssText = 'display:inline-flex;align-items:center;margin:0 2px';
    return n;
  }

  /** 一次注入樣式（多個模擬器共用同一份） */
  function ensureStyle() {
    if (document.getElementById('blocks-style')) return;
    var s = el('style');
    s.id = 'blocks-style';
    s.textContent = [
      /* ★ 積木形狀：用 clip-path 切出上凹下凸的榫頭。
         這是「像不像 Scratch」最關鍵的一件事 —— 圓角方塊排在一起
         看起來只是清單，有榫頭才看得出「它們是接在一起的」。
         盒子底部多留 4px 給凸榫，所以堆疊時不留任何縫隙。 */
      ':root{--bk-notch:4px}',
      '.bk{position:relative;display:block;color:#fff;font-weight:500;',
      '    font-size:13px;line-height:1.25;padding:8px 12px 12px;margin:0;cursor:grab;',
      '    background:var(--c);user-select:none;touch-action:none;white-space:nowrap;',
      '    clip-path:polygon(0 0, 12px 0, 16px 4px, 26px 4px, 30px 0, 100% 0,',
      '                      100% calc(100% - 4px), 30px calc(100% - 4px), 26px 100%,',
      '                      16px 100%, 12px calc(100% - 4px), 0 calc(100% - 4px))}',
      /* 帽子積木：上緣是圓弧，沒有凹槽 */
      '.bk.hat{padding-top:20px;',
      '    clip-path:polygon(0 14px, 6px 6px, 16px 1px, 30px 0, 44px 1px, 54px 6px, 60px 14px, 100% 14px,',
      '                      100% calc(100% - 4px), 30px calc(100% - 4px), 26px 100%,',
      '                      16px 100%, 12px calc(100% - 4px), 0 calc(100% - 4px))}',
      '.bk-row{display:flex;align-items:center;flex-wrap:wrap;gap:2px}',
      '.bk-ghost{position:fixed;z-index:9999;pointer-events:none;opacity:.92;',
      '          filter:drop-shadow(0 6px 10px rgba(0,0,0,.3))}',
      /* 參數欄位：Scratch 是白色圓角膠囊 */
      '.bk-in{width:42px;border:0;border-radius:12px;padding:3px 8px;margin:0 3px;',
      '       font:inherit;font-size:12px;font-weight:500;color:#1f2937;text-align:center;',
      '       background:#fff;outline:0}',
      '.bk-in.s{width:82px}',
      '.bk-in:focus{box-shadow:0 0 0 2px rgba(0,0,0,.25)}',

      /* ★ C 型積木：左側直條 ＋ 上下臂，中間的嘴巴露出程式區底色 */
      '.bk-c{padding-bottom:0;clip-path:none;border-radius:4px 4px 0 0}',
      '.bk-c>.bk-row{padding-bottom:4px}',
      '.bk-slot{min-height:24px;margin:0 0 0 15px;padding:0;',
      '         background:var(--bk-canvas);border-radius:4px 0 0 4px}',
      '.bk-foot{height:14px;background:var(--c);',
      '         clip-path:polygon(0 0, 100% 0, 100% calc(100% - 4px), 30px calc(100% - 4px),',
      '                           26px 100%, 16px 100%, 12px calc(100% - 4px), 0 calc(100% - 4px))}',

      /* ★ 積木之間不留縫 —— 有榫頭又有縫會很怪 */
      '.bk-stack>.bk{margin:0}',
      '.bk-drop{height:0;margin:0;border-radius:3px;background:transparent;transition:height .1s}',
      'body.bk-dragging .bk-drop{height:8px;background:rgba(100,116,139,.25)}',
      'body.bk-dragging .bk-drop.on{height:20px;background:#ffd400}',

      /* ★ 調色盤：分類清單，積木直向排列（和真的 Scratch 一樣） */
      '.bk-cat{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;',
      '        color:#575e75;margin:10px 0 6px}',
      '.bk-cat:first-child{margin-top:0}',
      '.bk-dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto}',
      '.bk-pal{display:flex;flex-direction:column;gap:8px;align-items:flex-start}',
      '.bk-palbox{background:#f9f9f9;border:1px solid #e5e7eb;border-radius:8px;',
      '           padding:10px;max-height:420px;overflow:auto}',

      /* ★ 程式區：Scratch 的淺灰格點底 */
      '.bk-script{min-height:300px;padding:14px;border-radius:8px;background:#f9f9f9;',
      '           background-image:radial-gradient(#d9d9d9 1px, transparent 1px);',
      '           background-size:22px 22px;border:1px solid #e5e7eb}',
      'body.bk-dragging .bk-script{border-color:#4c97ff}',
      '.bk-defarea{min-height:120px}',
      '.bk-empty{color:#9aa0b4;font-size:13px;text-align:center;padding:34px 8px;pointer-events:none}',

      /* ★ 舞台：白底 ＋ 綠旗／停止列 */
      '.bk-stagebar{display:flex;align-items:center;gap:8px;background:#e6e9ef;',
      '             border:1px solid #d7dbe3;border-bottom:0;border-radius:8px 8px 0 0;padding:5px 9px}',
      '.bk-flag{background:none;border:0;font-size:15px;cursor:pointer;line-height:1;padding:2px}',
      '.bk-stage{background:#fff;border:1px solid #d7dbe3;border-radius:0 0 8px 8px;',
      '          position:relative;overflow:hidden}',
      '.bk-sprite{position:absolute;font-size:34px;line-height:1;',
      '           transition:left .25s,top .25s,transform .25s}',
      '.bk-bubble{position:absolute;background:#fff;border:1px solid #c8cbd6;border-radius:12px;',
      '           padding:5px 10px;font-size:12px;color:#1f2937;max-width:150px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ===== 程式樹 =====
     node = { uid, id, args:[…], children:[node…] }（children 只有 C 型積木有） */
  function makeNode(id) {
    var d = DEFS[id];
    return { uid: uid(), id: id, args: (d.args || []).slice(), children: d.shape === 'c' ? [] : null };
  }

  /** 樹 → 可比對的純資料（丟掉 uid）。這是「原樣」，名稱不動 —— 存進資料庫用這個 */
  function plain(list) {
    return (list || []).map(function (n) {
      var o = { id: n.id, args: n.args.map(function (v) { return String(v).trim(); }) };
      if (n.children) o.children = plain(n.children);
      return o;
    });
  }

  /* ===== 判定用的正規化 =====
     ★ 自訂積木的名字、廣播訊息的名字，由學生自己取，不該影響對錯。

     學生把積木取名「正方形」而不是「畫正方形」，程式一模一樣，
     卻被判錯 —— 那是在考背名字，不是考程式。名字取得好不好可以講評，
     但不該是通不通關的條件。

     真正該檢查的是**對應關係**：定義的那個名字，和呼叫的那個名字，
     是不是同一個。所以這裡把每個名字換成出現順序的代號
     （第一個出現的叫「名稱#1」，第二個叫「名稱#2」…），再比對。
     · 定義 A、呼叫 A → #1、#1 ✔（不管 A 是什麼字）
     · 定義 A、呼叫 B → #1、#2 ✘（正確地判錯：呼叫了沒定義的積木）
     這在程式語言理論裡叫 alpha 等價，就是「換個變數名不算改程式」。

     哪些欄位算「名字」由 DEFS 的 idArgs 指定；沒標的欄位（數字、秒數）
     還是要一字不差。廣播積木之後加進來時，記得也標 idArgs。 */
  function canon(list) {
    var map = {}, seq = 0;
    function nameKey(s) {
      s = String(s).trim();
      // 沒取名字不是「另一種取法」，是還沒做完 —— 給一個永遠對不上的值
      if (s === '') return '(沒有取名字)';
      if (!Object.prototype.hasOwnProperty.call(map, s)) map[s] = '名稱#' + (++seq);
      return map[s];
    }
    function walk(l) {
      return (l || []).map(function (n) {
        var d = DEFS[n.id] || {};
        var args = (n.args != null ? n.args : (d.args || []))
          .map(function (v) { return String(v).trim(); });
        (d.idArgs || []).forEach(function (i) { args[i] = nameKey(args[i]); });
        var o = { id: n.id, args: args };
        if (d.shape === 'c') o.children = walk(n.children);
        return o;
      });
    }
    return walk(list);
  }

  /** 兩棵樹是否一致（順序、參數、巢狀都要對；名字只看對應關係） */
  function same(a, b) {
    return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  }

  /* ===== 主體 ===== */
  function mount(host, opts) {
    ensureStyle();
    opts = opts || {};
    var program = [];
    var goal = opts.goal || [];
    var passed = false;

    host.innerHTML = '';
    var wrap = el('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(150px,185px) minmax(0,1fr) 230px;gap:14px;align-items:start';

    /* ── 左：積木調色盤 ──
       依分類分組、直向排列，和真的 Scratch 一樣。
       原本是一團 flex-wrap 的色塊，看起來像標籤雲不像積木箱。 */
    var palBox = el('div');
    palBox.appendChild(tag('積木'));
    var palWrap = el('div', 'bk-palbox');
    var groups = {};
    (opts.palette || []).forEach(function (id) {
      if (!DEFS[id]) return;
      (groups[DEFS[id].cat] = groups[DEFS[id].cat] || []).push(id);
    });
    Object.keys(CATS).forEach(function (cat) {
      if (!groups[cat]) return;
      var head = el('div', 'bk-cat');
      var dot = el('span', 'bk-dot');
      dot.style.background = CATS[cat].color;
      head.appendChild(dot);
      head.appendChild(el('span', '', CATS[cat].name));
      palWrap.appendChild(head);
      var list = el('div', 'bk-pal');
      groups[cat].forEach(function (id) { list.appendChild(renderBlock(makeNode(id), true)); });
      palWrap.appendChild(list);
    });
    palBox.appendChild(palWrap);

    /* ── 中：程式區 ──
       ★ 有自訂積木的關卡會多切一個「函式區」。
         這不只是為了空間 —— 真實 Scratch 裡「定義」本來就是一段**獨立的腳本**，
         不會跟主程式接在一起。把它們疊成一長條反而不像。
         沒有自訂積木的關卡就不顯示，免得空著讓人困惑。 */
    var hasDefine = (opts.palette || []).some(function (id) {
      return id === 'my.define' || id === 'my.definep';
    });

    var midBox = el('div');
    var defs = [];                 // 函式區的積木（只放定義）
    var defArea = null;

    if (hasDefine) {
      midBox.appendChild(tag('函式區（定義自訂積木）'));
      defArea = el('div', 'bk-script bk-defarea');
      midBox.appendChild(defArea);
      var gap = el('div');
      gap.style.height = '14px';
      midBox.appendChild(gap);
    }

    midBox.appendChild(tag(hasDefine ? '主程式' : '程式區'));
    var script = el('div', 'bk-script');
    midBox.appendChild(script);

    var bar = el('div');
    bar.style.cssText = 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap';
    var runBtn = el('button');
    runBtn.innerHTML = FLAG_SVG + '<span style="margin-left:6px">執行</span>';
    runBtn.style.cssText = btnCss('#16a34a') + ';display:inline-flex;align-items:center';
    var checkBtn = el('button', '', '✓ 檢查答案');
    checkBtn.style.cssText = btnCss('#4f46e5');
    var clearBtn = el('button', '', '🗑 全部清除');
    clearBtn.style.cssText = btnCss('#64748b');
    bar.appendChild(runBtn); bar.appendChild(checkBtn); bar.appendChild(clearBtn);
    midBox.appendChild(bar);

    var msg = el('div');
    msg.style.cssText = 'margin-top:10px;font-size:14px;font-weight:700;line-height:1.7';
    midBox.appendChild(msg);

    /* ── 右：舞台 ── */
    var rightBox = el('div');
    rightBox.appendChild(tag('舞台'));
    var sbar = el('div', 'bk-stagebar');
    var flagBtn = el('button', 'bk-flag');
    flagBtn.innerHTML = FLAG_SVG;
    flagBtn.title = '執行';
    flagBtn.setAttribute('aria-label', '執行');
    var stopBtn = el('button', 'bk-flag');
    stopBtn.innerHTML = STOP_SVG;
    stopBtn.title = '停止';
    stopBtn.setAttribute('aria-label', '停止');
    sbar.appendChild(flagBtn); sbar.appendChild(stopBtn);
    rightBox.appendChild(sbar);
    var stage = el('div', 'bk-stage');
    stage.style.cssText += ';width:100%;aspect-ratio:4/3';
    /* 畫筆軌跡畫在 canvas 上。1～3 關要畫正方形、正多邊形，
       沒有這層的話按「執行」只看得到小貓亂跑，看不出畫了什麼。 */
    var pen = el('canvas');
    pen.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    stage.appendChild(pen);
    var sprite = el('div', 'bk-sprite', '🐱');
    var bubble = el('div', 'bk-bubble');
    bubble.style.display = 'none';
    stage.appendChild(sprite); stage.appendChild(bubble);
    rightBox.appendChild(stage);
    if (opts.hint) {
      var h = el('div', '', '🎯 ' + opts.hint);
      h.style.cssText = 'margin-top:10px;font-size:13px;line-height:1.7;color:#475569;' +
                        'background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px';
      rightBox.appendChild(h);
    }

    wrap.appendChild(palBox); wrap.appendChild(midBox); wrap.appendChild(rightBox);
    host.appendChild(wrap);

    function tag(t) {
      var n = el('div', '', t);
      n.style.cssText = 'font-size:12px;font-weight:900;color:#64748b;margin-bottom:7px';
      return n;
    }
    function btnCss(bg) {
      return 'background:' + bg + ';color:#fff;border:0;border-radius:10px;padding:9px 15px;' +
             'font-weight:700;font-size:14px;cursor:pointer';
    }

    /* ── 畫積木 ── */
    function renderBlock(node, isTemplate) {
      var d = DEFS[node.id], c = CATS[d.cat];
      var b = el('div', 'bk' + (d.shape === 'hat' ? ' hat' : '') + (d.shape === 'c' ? ' bk-c' : ''));
      b.style.setProperty('--c', c.color);
      b.style.setProperty('--bk-canvas', '#f9f9f9');   // C 型積木「嘴巴」露出的底色
      /* ⚠️ 一定要關掉原生拖曳。瀏覽器看到「按住有文字的元素在移動」
         會自己啟動 HTML5 drag，而原生 drag 一開始，pointermove 就不再觸發 ——
         拖曳整個斷掉，放開時當然什麼也沒發生。
         user-select:none 擋不住這件事，要明確設 draggable=false。 */
      b.draggable = false;
      b.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
      b.dataset.uid = node.uid;
      b.dataset.id = node.id;

      // label 裡的 %n / %s 換成輸入框
      var parts = d.label.split(/(%n|%s|%flag)/), ai = 0;
      var head = el('div', 'bk-row');
      parts.forEach(function (p) {
        if (p === '%flag') {
          head.appendChild(svgSpan(FLAG_SVG));
        } else if (p === '%n' || p === '%s') {
          var i = el('input', 'bk-in' + (p === '%s' ? ' s' : ''));
          i.value = node.args[ai];
          if (p === '%n') i.type = 'number';
          var myIdx = ai;
          i.addEventListener('input', function () { node.args[myIdx] = i.value; });
          i.addEventListener('pointerdown', function (e) { e.stopPropagation(); });   // 打字不要觸發拖曳
          head.appendChild(i);
          ai++;
        } else if (p) {
          head.appendChild(el('span', '', p));
        }
      });
      b.appendChild(head);

      if (d.shape === 'c') {
        var slot = el('div', 'bk-slot bk-stack');
        slot.dataset.slot = '1';
        b.appendChild(slot);
        var foot = el('div', 'bk-foot');
        b.appendChild(foot);
        if (!isTemplate) fill(slot, node.children);
      }

      b.addEventListener('pointerdown', function (e) { startDrag(e, node, b, isTemplate); });
      return b;
    }

    /** 把一串 node 畫進容器，中間夾放置點 */
    function fill(box, list) {
      box.innerHTML = '';
      box.appendChild(dropZone(list, 0));
      list.forEach(function (n, i) {
        box.appendChild(renderBlock(n, false));
        box.appendChild(dropZone(list, i + 1));
      });
      if (!list.length) {
        if (box === script) box.appendChild(el('div', 'bk-empty', '把左邊的積木拖到這裡'));
        else if (box === defArea) box.appendChild(el('div', 'bk-empty', '把「定義…」積木拖到這裡'));
      }
    }
    function dropZone(list, idx) {
      var z = el('div', 'bk-drop');
      z._list = list; z._idx = idx;
      return z;
    }
    function redraw() {
      if (defArea) { fill(defArea, defs); defArea.classList.add('bk-stack'); }
      fill(script, program);
      script.classList.add('bk-stack');
    }
    /** 所有程式區（判定與拖曳都要一起看） */
    function areas() { return defArea ? [defArea, script] : [script]; }
    /** 完整的程式 = 函式區 ＋ 主程式（順序固定，goal 也照這個順序寫） */
    function whole() { return defs.concat(program); }

    /* ── 拖曳（pointer events：滑鼠、觸控、觸控筆都能用）── */
    var drag = null;
    var rejected = '';        // 這次拖曳被區域規則擋下的原因（放開時顯示）
    function startDrag(e, node, srcEl, isTemplate) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();

      // 從調色盤拖 = 複製一塊新的；從程式區拖 = 搬移（先摘下來）
      var moving = isTemplate ? makeNode(node.id) : node;
      if (!isTemplate && !detach(program, node)) detach(defs, node);

      var ghost = renderBlock(moving, false);
      ghost.classList.add('bk-ghost');
      ghost.style.width = srcEl.offsetWidth + 'px';
      document.body.appendChild(ghost);

      drag = { node: moving, ghost: ghost, zone: null };
      rejected = '';
      document.body.classList.add('bk-dragging');   // 讓所有縫隙顯形
      document.addEventListener('dragstart', stopNativeDrag);
      moveGhost(e);
      if (!isTemplate) redraw();

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    function moveGhost(e) {
      drag.ghost.style.left = (e.clientX - 30) + 'px';
      drag.ghost.style.top = (e.clientY - 16) + 'px';
    }
    /* 找「該放到哪一道縫」。

       ⚠️ 前兩版都靠 document.elementFromPoint + closest() 去問
          「游標下面是誰」。那在瀏覽器裡很脆弱：只要有任何東西疊在上面
          （拖曳中的分身、transition 進行中的元素、瀏覽器自己的選取層），
          問到的就不是我們要的元素，於是判定成「沒有放置目標」，
          放開後積木就消失了 —— 也就是「拖不進去、放開不會停住」。

       改成純幾何：直接量所有縫隙的座標，挑離游標最近的一道。
       不問瀏覽器任何事，就沒有被誰擋住的問題。
       水平距離只給兩成權重，因為 C 型積木的凹槽是靠縮排區分的，
       主要仍看垂直位置。 */
    function nearestZone(x, y, node) {
      var pad = 48;                                   // 邊緣外一點也算，手不必很準
      var box = null;
      areas().forEach(function (a) {
        var r = a.getBoundingClientRect();
        if (x >= r.left - pad && x <= r.right + pad &&
            y >= r.top - pad  && y <= r.bottom + pad) box = a;
      });
      if (!box) return null;

      /* 放置限制：定義積木只能放函式區的頂層，其他積木不能放函式區頂層。
         這不是刁難 —— 「定義」在真實 Scratch 也不能接在主程式下面，
         而且分開放才看得出「定義」與「呼叫」是兩件事。 */
      var isDef = node && (node.id === 'my.define' || node.id === 'my.definep');
      var all = [].slice.call(box.querySelectorAll('.bk-drop'));
      var zones = all.filter(function (z) {
        var top = z.parentNode === box;               // 頂層（不在 C 型積木的凹槽裡）
        if (!top) return true;                        // 凹槽裡一律可放
        return box === defArea ? isDef : !isDef;
      });
      if (!zones.length) {
        /* 游標在區域內但這塊積木不該放這裡。
           記下原因 —— 積木默默消失是最讓人困惑的失敗方式。 */
        rejected = box === defArea
          ? '函式區只放「定義…」積木，其他積木請放到下面的主程式。'
          : '「定義…」積木要放在上面的函式區，不能接在主程式裡。';
        return null;
      }

      var best = null, bestD = Infinity;
      zones.forEach(function (z) {
        var b = z.getBoundingClientRect();
        var cy = (b.top + b.bottom) / 2;
        var dx = x < b.left ? b.left - x : (x > b.right ? x - b.right : 0);
        var d = Math.abs(y - cy) + dx * 0.2;
        if (d < bestD) { bestD = d; best = z; }
      });
      return best;
    }

    function onMove(e) {
      if (!drag) return;
      e.preventDefault();          // 順手擋掉行動裝置的捲動與長按選字
      moveGhost(e);
      // 不再需要「先把分身藏起來再問瀏覽器」——現在只量座標，分身不影響
      rejected = '';
      var z = nearestZone(e.clientX, e.clientY, drag.node);
      if (drag.zone && drag.zone !== z) drag.zone.classList.remove('on');
      drag.zone = z;
      if (z) z.classList.add('on');
    }
    function stopNativeDrag(ev) { ev.preventDefault(); }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.removeEventListener('dragstart', stopNativeDrag);
      document.body.classList.remove('bk-dragging');
      if (!drag) return;
      var z = drag.zone;
      if (z) { z.classList.remove('on'); z._list.splice(z._idx, 0, drag.node); }
      // 沒放在任何放置點 = 丟掉（等於刪除積木）
      var why = z ? '' : rejected;
      drag.ghost.remove();
      drag = null;
      redraw();
      say(why);
    }
    /** 從樹裡把某個節點摘掉（可能在巢狀裡） */
    function detach(list, node) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] === node) { list.splice(i, 1); return true; }
        if (list[i].children && detach(list[i].children, node)) return true;
      }
      return false;
    }

    /* ── 執行：在小舞台上跑一遍 ── */
    var st, ctx;
    var PEN_COLORS = { '紅':'#e5484d', '藍':'#0090ff', '綠':'#30a46c',
                       '黃':'#ffb224', '紫':'#8e4ec6', '黑':'#333' };
    function resetStage() {
      st = { x: 0, y: 0, dir: 90, size: 1, down: false, color: '#e5484d' };
      // canvas 的像素尺寸要跟著實際版面走，不然畫出來會糊掉或偏移
      var w = stage.clientWidth || 240, h = stage.clientHeight || 180;
      pen.width = w; pen.height = h;
      ctx = pen.getContext ? pen.getContext('2d') : null;
      if (ctx) { ctx.clearRect(0, 0, w, h); ctx.lineWidth = 3; ctx.lineCap = 'round'; }
      paint(); bubble.style.display = 'none';
    }
    /** 舞台座標（中心為原點、y 向上）→ canvas 座標 */
    function toCanvas(x, y) {
      return [pen.width / 2 + x, pen.height / 2 - y];
    }
    function drawTo(x0, y0, x1, y1) {
      if (!ctx || !st.down) return;
      var a = toCanvas(x0, y0), b = toCanvas(x1, y1);
      ctx.strokeStyle = st.color;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    function paint() {
      var w = stage.clientWidth, h = stage.clientHeight;
      sprite.style.left = (w / 2 + st.x - 18) + 'px';
      sprite.style.top = (h / 2 - st.y - 18) + 'px';
      sprite.style.transform = 'rotate(' + (st.dir - 90) + 'deg) scale(' + st.size + ')';   // 90 度＝朝右
      if (bubble.style.display !== 'none') {
        bubble.style.left = Math.min(w - 160, w / 2 + st.x + 10) + 'px';
        bubble.style.top = Math.max(4, h / 2 - st.y - 52) + 'px';
      }
    }
    function speak(t, ms) {
      bubble.textContent = t; bubble.style.display = ''; paint();
      if (ms) setTimeout(function () { bubble.style.display = 'none'; }, ms);
    }

    var running = false;
    function run() {
      if (running) return;
      running = true; runBtn.disabled = true;
      resetStage();
      var steps = [];
      var all = whole();
      flatten(all, steps, collectDefs(all), 0, 0);
      var i = 0;
      stopped = false;
      (function tick() {
        if (stopped || i >= steps.length) { running = false; runBtn.disabled = false; return; }
        var wait = exec(steps[i++]);
        setTimeout(tick, wait);
      })();
    }
    /* 把樹展開成一串動作。
       · 重複 N 次 → 直接展開
       · 自訂積木 → 找到定義，把它的內容接進來（等於 inline）
         參數（邊長）用 argVal 一路傳下去，遇到「移動（邊長）點」才用得到。
       防呆：遞迴深度 8 層、總步數 400 步 —— 學生把自訂積木寫成自己呼叫自己
       是很常見的意外，沒有上限的話瀏覽器會直接當掉。 */
    function collectDefs(list) {
      var m = {};
      (list || []).forEach(function (n) {
        if (n.id === 'my.define' || n.id === 'my.definep') m[String(n.args[0]).trim()] = n;
      });
      return m;
    }
    function flatten(list, out, defs, argVal, depth) {
      depth = depth || 0;
      if (depth > 8) return;
      (list || []).forEach(function (n) {
        if (out.length >= 400) return;
        if (n.id === 'my.define' || n.id === 'my.definep') return;   // 定義本身不執行
        if (n.id === 'my.call' || n.id === 'my.callp') {
          var d = defs[String(n.args[0]).trim()];
          if (!d) return;                                            // 呼叫了不存在的積木 → 略過
          var a = n.id === 'my.callp' ? (parseFloat(n.args[1]) || 0) : argVal;
          flatten(d.children, out, defs, a, depth + 1);
          return;
        }
        if (n.id === 'control.repeat') {
          var t = Math.max(0, Math.min(50, parseInt(n.args[0], 10) || 0));
          for (var k = 0; k < t && out.length < 400; k++) flatten(n.children, out, defs, argVal, depth + 1);
          return;
        }
        out.push({ node: n, arg: argVal });
      });
    }
    function exec(step) {
      var n = step.node, a = n.args;
      var num = function (i) { return parseFloat(a[i]) || 0; };
      var move = function (dist) {
        var x0 = st.x, y0 = st.y;
        // Scratch 的方向：90 = 右、0 = 上
        st.x += Math.sin(st.dir * Math.PI / 180) * dist;
        st.y += Math.cos(st.dir * Math.PI / 180) * dist;
        drawTo(x0, y0, st.x, st.y);
      };
      switch (n.id) {
        case 'motion.move':      move(num(0)); break;
        case 'my.movearg':       move(step.arg || 0); break;
        case 'pen.down':         st.down = true; break;
        case 'pen.up':           st.down = false; break;
        case 'pen.clear':        if (ctx) ctx.clearRect(0, 0, pen.width, pen.height); break;
        case 'pen.color':        st.color = PEN_COLORS[String(a[0]).trim()] || '#e5484d'; break;
        case 'motion.turnright': st.dir += num(0); break;
        case 'motion.turnleft':  st.dir -= num(0); break;
        case 'motion.goto':      st.x = num(0); st.y = num(1); break;   // 定位不留筆跡
        case 'motion.changey': {
          var y0 = st.y; st.y += num(0); drawTo(st.x, y0, st.x, st.y); break;
        }
        case 'looks.say':        speak(a[0]); break;
        case 'looks.sayfor':     speak(a[0], num(1) * 1000); return Math.max(200, num(1) * 1000);
        case 'looks.change':     st.size = Math.max(.3, Math.min(2.5, st.size + num(0) / 100)); break;
        case 'looks.next':       sprite.textContent = sprite.textContent === '🐱' ? '😺' : '🐱'; break;
        case 'sound.play':       speak('♪ ' + a[0], 700); break;
        case 'control.wait':     return Math.max(200, num(0) * 1000);
      }
      paint();
      return 280;
    }

    /* ── 檢查答案 ── */
    function say(t, ok) {
      msg.textContent = t;
      msg.style.color = t ? (ok ? '#16a34a' : '#b45309') : '';
    }
    function check() {
      var all = whole();
      if (!all.length) { say('程式區還是空的，先從左邊拖幾塊積木過來。'); return; }
      if (same(all, goal)) {
        say('✅ 組對了！' + (passed ? '' : ' 這一關通過。'), true);
        if (!passed) { passed = true; if (opts.onPass) opts.onPass(plain(all)); }
      } else {
        say('❌ ' + diffHint(canon(all), canon(goal)));
      }
    }
    /** 給一句「差在哪」，不要只說錯 —— 學生看到「錯了」只會亂試。
        差別藏在 C 型積木裡面時要一路追進去講（「第 5 塊裡面的第 2 塊」）：
        只說「裡面包的積木不對」，等於叫學生自己一塊一塊試。 */
    function diffHint(got, want, where) {
      where = where || '';
      if (got.length < want.length) return where + '積木還不夠，再想想少了哪一步。';
      if (got.length > want.length) return where + '積木太多了，有幾塊是用不到的。';
      for (var i = 0; i < want.length; i++) {
        var at = where + '第 ' + (i + 1) + ' 塊積木';
        if (got[i].id !== want[i].id) return at + '不對。';
        if (JSON.stringify(got[i].args) !== JSON.stringify(want[i].args)) {
          /* 名字對不上要講清楚是「對不上」，不是「取錯字」——
             名字本來就可以自己取，說「文字要再改一下」會害學生
             回頭去猜參考答案到底叫什麼，那正是我們不想考的東西。 */
          var d = DEFS[want[i].id] || {};
          var bad = (d.idArgs || []).filter(function (k) { return got[i].args[k] !== want[i].args[k]; });
          if (bad.length) {
            return got[i].args[bad[0]] === '(沒有取名字)'
              ? at + '還沒取名字。'
              : at + '的名字，和你在別的地方寫的對不起來 —— '
                + '「定義」和「呼叫」要用同一個名字（叫什麼都可以）。';
          }
          return at + '的數字或文字要再改一下。';
        }
        if (want[i].children && JSON.stringify(got[i].children) !== JSON.stringify(want[i].children))
          return diffHint(got[i].children, want[i].children, at + '裡面的');
      }
      return where ? where + '順序不太對。' : '順序好像不太對，再對照一次任務說明。';
    }

    var stopped = false;
    flagBtn.addEventListener('click', run);
    stopBtn.addEventListener('click', function () { stopped = true; });
    runBtn.addEventListener('click', run);
    checkBtn.addEventListener('click', check);
    clearBtn.addEventListener('click', function () {
      program.length = 0; defs.length = 0; redraw(); resetStage(); say('');
    });

    redraw();
    setTimeout(resetStage, 0);

    return {
      reset: function () { program.length = 0; defs.length = 0; redraw(); resetStage(); say(''); },
      /* 載入：自動把「定義」放進函式區、其餘放進主程式 */
      load: function (list) {
        defs.length = 0; program.length = 0;
        (list || []).forEach(function (n) {
          var d = (n.id === 'my.define' || n.id === 'my.definep');
          (d && defArea ? defs : program).push(n);
        });
        redraw();
      },
      get program() { return plain(whole()); }
    };
  }

  global.BLOCKS = {
    CATS: CATS,
    DEFS: DEFS,
    mount: mount,
    _plain: plain,
    _canon: canon,
    _same: same
  };

})(window);
