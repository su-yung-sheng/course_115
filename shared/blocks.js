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
     shape: 'stack' 一般積木｜'c' 可以包住其他積木｜'hat' 開頭帽子 */
  var CATS = {
    motion:  { name: '動作', color: '#4c97ff', dark: '#3373cc' },
    looks:   { name: '外觀', color: '#9966ff', dark: '#774dcb' },
    sound:   { name: '音效', color: '#cf63cf', dark: '#bd42bd' },
    control: { name: '控制', color: '#ffab19', dark: '#cf8b17' },
    events:  { name: '事件', color: '#ffbf00', dark: '#cc9900' },
    data:    { name: '變數', color: '#ff8c1a', dark: '#db6e00' },
    pen:     { name: '畫筆', color: '#0fbd8c', dark: '#0b8e69' },
    my:      { name: '函式', color: '#ff6680', dark: '#ff4d6a' },
    list:    { name: '清單', color: '#ff661a', dark: '#e64d00' }
  };

  var DEFS = {
    'events.whenflag':  { cat:'events',  shape:'hat',   label:'當 ▶ 被點擊' },
    'motion.move':      { cat:'motion',  shape:'stack', label:'移動 %n 點',        args:[10] },
    'motion.turnright': { cat:'motion',  shape:'stack', label:'右轉 %n 度',        args:[90] },
    'motion.turnleft':  { cat:'motion',  shape:'stack', label:'左轉 %n 度',        args:[90] },
    'motion.goto':      { cat:'motion',  shape:'stack', label:'定位到 x: %n y: %n', args:[0, 0] },
    'motion.changey':   { cat:'motion',  shape:'stack', label:'y 改變 %n',          args:[10] },
    'looks.say':        { cat:'looks',   shape:'stack', label:'說 %s',              args:['你好！'] },
    'looks.sayfor':     { cat:'looks',   shape:'stack', label:'說 %s 持續 %n 秒',    args:['你好！', 2] },
    'looks.next':       { cat:'looks',   shape:'stack', label:'下一個造型' },
    'looks.change':     { cat:'looks',   shape:'stack', label:'尺寸改變 %n',        args:[10] },
    'sound.play':       { cat:'sound',   shape:'stack', label:'播放音效 %s',        args:['喵'] },
    'control.wait':     { cat:'control', shape:'stack', label:'等待 %n 秒',         args:[1] },
    'control.repeat':   { cat:'control', shape:'c',     label:'重複 %n 次',         args:[10] },
    'data.setvar':      { cat:'data',    shape:'stack', label:'設定 %s 為 %n',      args:['分數', 0] },
    'data.changevar':   { cat:'data',    shape:'stack', label:'%s 改變 %n',         args:['分數', 1] },

    /* 畫筆：1～3 關畫正方形、正多邊形要用 */
    'pen.clear':        { cat:'pen',     shape:'stack', label:'全部擦掉' },
    'pen.down':         { cat:'pen',     shape:'stack', label:'落筆' },
    'pen.up':           { cat:'pen',     shape:'stack', label:'提筆' },
    'pen.color':        { cat:'pen',     shape:'stack', label:'筆的顏色設為 %s', args:['紅'] },

    /* 自訂積木（函式）：1～3 關的主角
       ⚠️ 只支援「一個數字參數」。真正的 Scratch 可以有任意個參數，
          但這裡是結構化練習題，一個參數就分得出「有參數／沒參數」的差別，
          多做只會讓判定與畫面複雜好幾倍。 */
    'my.define':        { cat:'my',      shape:'c',     label:'定義 %s',          args:['畫正方形'] },
    'my.definep':       { cat:'my',      shape:'c',     label:'定義 %s（邊長）',   args:['畫正方形'] },
    'my.call':          { cat:'my',      shape:'stack', label:'%s',               args:['畫正方形'] },
    'my.callp':         { cat:'my',      shape:'stack', label:'%s 邊長 %n',       args:['畫正方形', 50] },
    'my.movearg':       { cat:'my',      shape:'stack', label:'移動（邊長）點' },

    /* 清單與判斷：5～10 關的排序、搜尋要用 */
    'list.swap':        { cat:'list',    shape:'stack', label:'交換第 %n 項和第 %n 項', args:[1, 2] },
    'list.say':         { cat:'list',    shape:'stack', label:'說出第 %n 項',      args:[1] },
    'list.setidx':      { cat:'list',    shape:'stack', label:'設定 %s 為 %n',     args:['位置', 1] },
    'list.changeidx':   { cat:'list',    shape:'stack', label:'%s 改變 %n',        args:['位置', 1] },
    'control.ifless':   { cat:'control', shape:'c',     label:'如果 第 %n 項 < 第 %n 項 那麼', args:[1, 2] },
    'control.repeatlen':{ cat:'control', shape:'c',     label:'重複 清單長度 次' },
    'control.until':    { cat:'control', shape:'c',     label:'重複直到 找到目標' }
  };

  /* ===== 小工具 ===== */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function uid() { return 'b' + Math.random().toString(36).slice(2, 9); }

  /** 一次注入樣式（多個模擬器共用同一份） */
  function ensureStyle() {
    if (document.getElementById('blocks-style')) return;
    var s = el('style');
    s.id = 'blocks-style';
    s.textContent = [
      '.bk{position:relative;display:block;border-radius:6px;color:#fff;font-weight:700;',
      '    font-size:14px;line-height:1.2;padding:9px 12px;margin:0;cursor:grab;',
      '    box-shadow:0 2px 0 rgba(0,0,0,.22);user-select:none;touch-action:none;white-space:nowrap}',
      '.bk.hat{border-radius:16px 16px 6px 6px;padding-top:14px}',
      '.bk.drag{opacity:.45}',
      '.bk-ghost{position:fixed;z-index:9999;pointer-events:none;opacity:.9;transform:rotate(-2deg)}',
      '.bk-in{width:44px;border:0;border-radius:11px;padding:2px 7px;margin:0 3px;',
      '       font:inherit;font-size:13px;color:#1f2937;text-align:center;background:#fff}',
      '.bk-in.s{width:76px}',
      '.bk-c{padding-bottom:0}',
      '.bk-slot{min-height:26px;margin:6px 0 0 16px;padding:3px;border-radius:6px;',
      '         background:rgba(0,0,0,.16)}',
      '.bk-foot{height:12px;margin-left:0;border-radius:0 0 6px 6px}',
      '.bk-stack>*{margin-bottom:3px}',
      '.bk-drop{height:8px;margin:2px 0;border-radius:4px;background:transparent;transition:all .12s}',
      '.bk-drop.on{background:#fbbf24;height:16px}',
      'body.bk-dragging .bk-drop{background:rgba(148,163,184,.35);height:10px}',
      'body.bk-dragging .bk-drop.on{background:#fbbf24;height:16px}',
      'body.bk-dragging .bk-script{border-color:#6366f1;background:#eef2ff}',
      'body.bk-dragging .bk-slot{outline:2px dashed rgba(255,255,255,.55);outline-offset:-2px}',
      '.bk-empty{color:#94a3b8;font-size:13px;font-weight:700;text-align:center;padding:26px 8px;pointer-events:none}',
      '.bk-pal{display:flex;flex-wrap:wrap;gap:7px;align-content:flex-start}',
      '.bk-script{min-height:180px;padding:10px;border-radius:12px;',
      '           background:#f1f5f9;border:2px dashed #cbd5e1}',
      '.bk-stage{background:#fff;border:1px solid #e2e8f0;border-radius:12px;position:relative;overflow:hidden}',
      '.bk-sprite{position:absolute;font-size:36px;line-height:1;transition:left .25s,top .25s,transform .25s}',
      '.bk-bubble{position:absolute;background:#fff;border:2px solid #cbd5e1;border-radius:12px;',
      '           padding:5px 10px;font-size:13px;font-weight:700;color:#1f2937;max-width:150px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ===== 程式樹 =====
     node = { uid, id, args:[…], children:[node…] }（children 只有 C 型積木有） */
  function makeNode(id) {
    var d = DEFS[id];
    return { uid: uid(), id: id, args: (d.args || []).slice(), children: d.shape === 'c' ? [] : null };
  }

  /** 樹 → 可比對的純資料（丟掉 uid） */
  function plain(list) {
    return (list || []).map(function (n) {
      var o = { id: n.id, args: n.args.map(function (v) { return String(v).trim(); }) };
      if (n.children) o.children = plain(n.children);
      return o;
    });
  }

  /** 兩棵樹是否一致（順序、參數、巢狀都要對） */
  function same(a, b) {
    return JSON.stringify(plain(a)) === JSON.stringify(normGoal(b));
  }
  function normGoal(list) {
    return (list || []).map(function (n) {
      var d = DEFS[n.id] || {};
      var args = (n.args != null ? n.args : (d.args || [])).map(function (v) { return String(v).trim(); });
      var o = { id: n.id, args: args };
      if (d.shape === 'c') o.children = normGoal(n.children);
      return o;
    });
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
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(150px,190px) minmax(0,1fr) 200px;gap:12px;align-items:start';

    /* ── 左：積木調色盤 ── */
    var palBox = el('div');
    palBox.appendChild(tag('🧱 可用的積木'));
    var pal = el('div', 'bk-pal');
    (opts.palette || []).forEach(function (id) {
      if (!DEFS[id]) return;
      var b = renderBlock(makeNode(id), true);
      pal.appendChild(b);
    });
    palBox.appendChild(pal);

    /* ── 中：程式區 ── */
    var midBox = el('div');
    midBox.appendChild(tag('🧩 我的程式'));
    var script = el('div', 'bk-script');
    midBox.appendChild(script);

    var bar = el('div');
    bar.style.cssText = 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap';
    var runBtn = el('button', '', '▶ 執行');
    runBtn.style.cssText = btnCss('#16a34a');
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
    rightBox.appendChild(tag('🎬 舞台'));
    var stage = el('div', 'bk-stage');
    stage.style.cssText += ';width:100%;aspect-ratio:4/3';
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
      b.style.background = c.color;
      b.dataset.uid = node.uid;
      b.dataset.id = node.id;

      // label 裡的 %n / %s 換成輸入框
      var parts = d.label.split(/(%n|%s)/), ai = 0;
      var head = el('div');
      head.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:1px';
      parts.forEach(function (p) {
        if (p === '%n' || p === '%s') {
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
        foot.style.background = c.dark;
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
      if (!list.length && box === script) {
        box.appendChild(el('div', 'bk-empty', '把左邊的積木拖到這裡'));
      }
    }
    function dropZone(list, idx) {
      var z = el('div', 'bk-drop');
      z._list = list; z._idx = idx;
      return z;
    }
    function redraw() {
      fill(script, program);
      script.classList.add('bk-stack');
    }

    /* ── 拖曳（pointer events：滑鼠、觸控、觸控筆都能用）── */
    var drag = null;
    function startDrag(e, node, srcEl, isTemplate) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();

      // 從調色盤拖 = 複製一塊新的；從程式區拖 = 搬移（先摘下來）
      var moving = isTemplate ? makeNode(node.id) : node;
      if (!isTemplate) detach(program, node);

      var ghost = renderBlock(moving, false);
      ghost.classList.add('bk-ghost');
      ghost.style.width = srcEl.offsetWidth + 'px';
      document.body.appendChild(ghost);

      drag = { node: moving, ghost: ghost, zone: null };
      document.body.classList.add('bk-dragging');   // 讓所有縫隙顯形
      moveGhost(e);
      if (!isTemplate) redraw();

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }
    function moveGhost(e) {
      drag.ghost.style.left = (e.clientX - 30) + 'px';
      drag.ghost.style.top = (e.clientY - 16) + 'px';
    }
    /* 找「該放到哪一道縫」。
       ⚠️ 原本用 elementFromPoint 直接抓 .bk-drop —— 那些縫只有 8px 高，
          等於要求學生精準命中兩塊積木之間的細線；拖到空白的程式區
          更是完全沒反應（整片空白只有最上面一條是有效區）。
       改成：先看游標落在哪個容器（程式區或某個 C 型積木的凹槽），
       再從那個容器裡挑「垂直距離最近」的一道縫。放哪都有反應。 */
    function nearestZone(x, y) {
      var under = document.elementFromPoint(x, y);
      if (!under || !under.closest) return null;
      var box = under.closest('.bk-slot') || under.closest('.bk-script');
      if (!box || !script.contains(box) && box !== script) return null;

      var zones = [].filter.call(box.children, function (c) {
        return c.classList && c.classList.contains('bk-drop');
      });
      if (!zones.length) return null;

      var best = null, bestD = Infinity;
      zones.forEach(function (z) {
        var r = z.getBoundingClientRect();
        var d = Math.abs((r.top + r.bottom) / 2 - y);
        if (d < bestD) { bestD = d; best = z; }
      });
      return best;
    }

    function onMove(e) {
      if (!drag) return;
      moveGhost(e);
      drag.ghost.style.display = 'none';
      var z = nearestZone(e.clientX, e.clientY);
      drag.ghost.style.display = '';
      if (drag.zone && drag.zone !== z) drag.zone.classList.remove('on');
      drag.zone = z;
      if (z) z.classList.add('on');
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.classList.remove('bk-dragging');
      if (!drag) return;
      var z = drag.zone;
      if (z) { z.classList.remove('on'); z._list.splice(z._idx, 0, drag.node); }
      // 沒放在任何放置點 = 丟掉（等於刪除積木）
      drag.ghost.remove();
      drag = null;
      redraw();
      say('');
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
    var st;
    function resetStage() {
      st = { x: 0, y: 0, dir: 90, size: 1 };
      paint(); bubble.style.display = 'none';
    }
    function paint() {
      var w = stage.clientWidth, h = stage.clientHeight;
      sprite.style.left = (w / 2 + st.x - 18) + 'px';
      sprite.style.top = (h / 2 - st.y - 18) + 'px';
      sprite.style.transform = 'rotate(' + (st.dir - 90) + 'deg) scale(' + st.size + ')';
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
      flatten(program, steps);
      var i = 0;
      (function tick() {
        if (i >= steps.length) { running = false; runBtn.disabled = false; return; }
        var wait = exec(steps[i++]);
        setTimeout(tick, wait);
      })();
    }
    /** 把樹展開成一串動作（重複 N 次直接展開，最多 200 步防呆） */
    function flatten(list, out) {
      list.forEach(function (n) {
        if (n.id === 'control.repeat') {
          var t = Math.max(0, Math.min(50, parseInt(n.args[0], 10) || 0));
          for (var k = 0; k < t && out.length < 200; k++) flatten(n.children, out);
        } else if (out.length < 200) {
          out.push(n);
        }
      });
    }
    function exec(n) {
      var a = n.args, num = function (i) { return parseFloat(a[i]) || 0; };
      switch (n.id) {
        case 'motion.move':
          st.x += Math.cos((st.dir - 90) * Math.PI / 180) * num(0);
          st.y -= Math.sin((st.dir - 90) * Math.PI / 180) * num(0);
          break;
        case 'motion.turnright': st.dir += num(0); break;
        case 'motion.turnleft':  st.dir -= num(0); break;
        case 'motion.goto':      st.x = num(0); st.y = num(1); break;
        case 'motion.changey':   st.y += num(0); break;
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
      if (!program.length) { say('程式區還是空的，先從左邊拖幾塊積木過來。'); return; }
      if (same(program, goal)) {
        say('✅ 組對了！' + (passed ? '' : ' 這一關通過。'), true);
        if (!passed) { passed = true; if (opts.onPass) opts.onPass(plain(program)); }
      } else {
        say('❌ ' + diffHint(plain(program), normGoal(goal)));
      }
    }
    /** 給一句「差在哪」，不要只說錯 —— 學生看到「錯了」只會亂試 */
    function diffHint(got, want) {
      if (got.length < want.length) return '積木還不夠，再想想少了哪一步。';
      if (got.length > want.length) return '積木太多了，有幾塊是用不到的。';
      for (var i = 0; i < want.length; i++) {
        if (got[i].id !== want[i].id) return '第 ' + (i + 1) + ' 塊積木不對。';
        if (JSON.stringify(got[i].args) !== JSON.stringify(want[i].args))
          return '第 ' + (i + 1) + ' 塊積木的數字或文字要再改一下。';
        if (want[i].children && JSON.stringify(got[i].children) !== JSON.stringify(want[i].children))
          return '第 ' + (i + 1) + ' 塊積木「裡面」包的積木不對。';
      }
      return '順序好像不太對，再對照一次任務說明。';
    }

    runBtn.addEventListener('click', run);
    checkBtn.addEventListener('click', check);
    clearBtn.addEventListener('click', function () {
      program.length = 0; redraw(); resetStage(); say('');
    });

    redraw();
    setTimeout(resetStage, 0);

    return {
      reset: function () { program.length = 0; redraw(); resetStage(); say(''); },
      load: function (list) { program = list || []; redraw(); },
      get program() { return plain(program); }
    };
  }

  global.BLOCKS = {
    CATS: CATS,
    DEFS: DEFS,
    mount: mount,
    _plain: plain,
    _normGoal: normGoal,
    _same: same
  };

})(window);
