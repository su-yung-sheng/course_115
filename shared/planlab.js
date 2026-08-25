/* =====================================================================
   第五節「自己的專案」— 專題設計單（進場券）
   ---------------------------------------------------------------------
   ★ 老師 2026-08-25：第五節是設計一個自己的專案，分層任務卡，
     每組都從基礎關開始。主題「從情境清單選一個再自訂」。

   ⚠️ 這一節和前四節最大的不同：**電腦看不到學生的硬體**。
      所以這裡不判定「做出來了沒」，只負責一件事 ——
      逼他在動手之前**把要做什麼講清楚**。
      ★ 專題課最常見的卡關不是不會寫程式，是「還沒想好要做什麼」。

   三個節點：
     ① 選一個情境（可以自訂）
     ② 選 1 個輸入 ＋ 1 個輸出
     ③ 把「如果…那麼…」補完整（觸發條件 ＋ 輸出動作）

   ⚠️⚠️ 元件清單只放**前四節真的用過**的那四樣（老師 2026-08-25 更正：
      超音波、可變電阻、RGB 燈條、直流馬達）。憑空多寫一個教具上沒有的，
      學生會找半天，而且那種錯只有上機才會發現。
   ===================================================================== */
(function (global) {
  'use strict';

  function LK() {
    if (!global.LABKIT) throw new Error('planlab 需要 shared/labkit.js（請先載入它）');
    return global.LABKIT;
  }

  /* ── ① 情境清單 ────────────────────────────────────── */
  /* ⚠️ 每一個情境都要**只用那四樣做得出來**（超音波、旋鈕、燈條、馬達）。
     ★ 原本有「衣櫃感應燈：門一打開就亮」—— 那需要門磁或按鈕，教具上沒有。
       說明改成用距離偵測，不然學生照著做會卡在找不到零件。 */
  var SCENES = [
    { key: 'hall',  t: '玄關迎賓燈',   d: '有人走近就亮，離開一會兒自己熄掉' },
    { key: 'desk',  t: '書桌護眼燈',   d: '坐太近就變色提醒，坐好了才恢復' },
    { key: 'closet', t: '衣櫃感應燈',  d: '手伸進去（距離變近）就亮，拿開就暗' },
    { key: 'fan',   t: '房間自動電扇', d: '旋鈕調風速；或人靠近才吹' },
    { key: 'park',  t: '停車距離指示', d: '越靠近亮的顆數越多，太近就整條變紅' },
    { key: 'water', t: '洗手感應計時', d: '手伸過來就亮，燈跑完一圈代表洗夠久了' },
    { key: 'stair', t: '樓梯夜燈',     d: '有人經過才亮，一顆一顆跟著走' },
    { key: 'focus', t: '專注計時燈',   d: '旋鈕設定時間，燈條慢慢跑完就提醒' }
  ];

  /* ── ② 輸入／輸出 ───────────────────────────────────
     ★ 只列前四節用過的。⚠️ 每一個都標出「它給你什麼數字」——
        專題課最容易卡在「我不知道這個能拿來幹嘛」。 */
  /* ⚠️⚠️ 老師 2026-08-25 更正：「只有四個喔」——
     前四節用過的就是**超音波、可變電阻、RGB 燈條、直流馬達**。
     ★ 第一版多列了「按鈕」和「單顆 LED」—— 教具上沒有，
       學生照著設計單去找零件會找半天，而且那種錯只有上機才會發現。 */
  var INPUTS = [
    { key: 'us',  t: '超音波距離感測器', gives: '距離幾公分（數字）',
      from: '第一、二節', unit: '公分', hint: '越近數字越小',
      def: 15, lo: 2, hi: 200 },
    { key: 'pot', t: '可變電阻（旋鈕）', gives: '轉到幾 %（數字）',
      from: '第三、四節', unit: '%', hint: '最左 0、最右 100',
      def: 50, lo: 0, hi: 100 }
  ];
  var OUTPUTS = [
    { key: 'strip', t: 'RGB 全彩燈條', from: '第二、四節',
      acts: ['整條亮起指定顏色', '只亮其中一顆（位置會跑）', '顏色跟著變'] },
    { key: 'moto',  t: '直流馬達（風扇）', from: '第三節',
      acts: ['開始轉動', '停下來', '依比例調整轉速'] }
  ];

  function byKey(list, k) {
    return list.filter(function (x) { return x.key === k; })[0] || null;
  }

  /* 把設計單組成一句「如果…那麼…」。
     ★ 這一句是**整節課的錨**：任務卡、成果發表都回頭指著它。 */
  function planLine(p) {
    if (!p || !p.input || !p.output) return '';
    var i = byKey(INPUTS, p.input), o = byKey(OUTPUTS, p.output);
    if (!i || !o) return '';
    var when = i.t.replace(/（.*/, '') + '讀到的數字 ' +
      (p.dir === 'gt' ? '大於' : '小於') + ' ' + p.value + ' ' + i.unit;
    return '如果　' + when + '　那麼　' + o.t + '就' + p.act + '。';
  }
  /* 設計單填完了沒。⚠️ 少一格就不算 —— 半張設計單等於沒有。 */
  function planReady(p) {
    if (!p || !p.scene || !p.input || !p.output || !p.act) return false;
    var i = byKey(INPUTS, p.input);
    if (!i) return false;
    return p.value !== '' && isFinite(Number(p.value));
  }
  function sayPlan(p) {
    if (!p.scene) return '先選一個情境（或自己寫一個）。';
    if (!p.input) return '選一個**輸入** —— 系統要靠什麼知道「該動作了」？';
    if (!p.output) return '選一個**輸出** —— 你希望它做什麼給你看？';
    var i = byKey(INPUTS, p.input);
    if (i && (p.value === '' || !isFinite(Number(p.value))))
      return '⚠️ 那個門檻要填一個**數字** —— 到多少才算「該動作了」？';
    if (i) {
      var n = Number(p.value);
      if (n < i.lo || n > i.hi)
        return '⚠️ ' + i.t + '只讀得到 ' + i.lo + '～' + i.hi + ' ' + i.unit +
               '，填在範圍外的話**永遠不會觸發**。';
    }
    if (!p.act) return '選一個動作 —— 輸出要「怎麼動」？';
    return '';
  }

  /* ═══ 畫面 ═══════════════════════════════════════════ */
  var CSS = '' +
  '.pl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px}' +
  '.pl-card{text-align:left;padding:12px 13px;border:2px solid #e2e8f0;border-radius:14px;' +
    'background:#fff;cursor:pointer;font-size:14px;font-weight:800;line-height:1.6}' +
  '.pl-card:hover{border-color:#7c3aed;background:#f5f3ff}' +
  '.pl-card.on{border-color:#7c3aed;background:#f5f3ff;box-shadow:0 0 0 3px #ede9fe}' +
  '.pl-card b{display:block;font-size:15px;color:#0f172a;margin-bottom:2px}' +
  '.pl-card span{display:block;font-size:12px;color:#64748b;font-weight:700}' +
  '.pl-tag{display:inline-block;font-size:11px;font-weight:900;color:#7c3aed;' +
    'background:#ede9fe;border-radius:6px;padding:1px 6px;margin-top:4px}' +
  '.pl-line{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:14px 16px;' +
    'font-weight:900;font-size:15px;line-height:1.9;margin:12px 0}' +
  '.pl-line em{color:#fbbf24;font-style:normal}' +
  '.pl-in{font-size:16px;font-weight:900;padding:8px 11px;border:2px solid #cbd5e1;' +
    'border-radius:10px;width:100px;text-align:center}' +
  '.pl-txt{width:100%;font-size:15px;font-weight:800;padding:10px 12px;' +
    'border:2px solid #cbd5e1;border-radius:12px;box-sizing:border-box}' +
  '.pl-row{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:10px 0;' +
    'font-weight:900;font-size:15px}' +
  '.pl-dots{display:flex;gap:6px;margin-bottom:12px}' +
  '.pl-dot{flex:1;height:6px;border-radius:3px;background:#e2e8f0}' +
  '.pl-dot.on{background:#7c3aed}.pl-dot.ok{background:#10b981}';

  function ensureCss() {
    LK().ensureCss();
    if (document.getElementById('planlab-css')) return;
    var st = document.createElement('style');
    st.id = 'planlab-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function mount(el, opts) {
    opts = opts || {};
    ensureCss();
    var esc = LK().esc, md = LK().md;
    var node = 1, tries = 0;
    /* ★ 帶著上次的設計單回來（改主意很正常，不必從頭選）。 */
    var p = Object.assign({ scene: '', input: '', output: '', act: '',
                            value: '', dir: 'lt' }, opts.plan || {});

    function dots() {
      return '<div class="pl-dots">' + [1, 2, 3].map(function (i) {
        return '<div class="pl-dot ' + (node > i ? 'ok' : (node === i ? 'on' : '')) + '"></div>';
      }).join('') + '</div>';
    }
    function preview() {
      var line = planLine(p);
      return '<div class="pl-line">' +
        (p.scene ? '🎯 <em>' + esc(p.scene) + '</em><br>' : '') +
        (line ? esc(line) : '<span style="color:#64748b">選好之後，這一句會自動長出來</span>') +
        '</div>';
    }

    function view(msg, cls) {
      var body;
      if (node === 1) {
        body =
          '<div class="pl-row">📋 <b>第一步：你想解決什麼問題？</b></div>' +
          '<div style="font-size:14px;color:#475569;font-weight:700;margin-bottom:10px">' +
          '⚠️ 先想「誰會用、什麼時候用」，不要先想程式怎麼寫。</div>' +
          '<div class="pl-grid">' +
            SCENES.map(function (s) {
              return '<button class="pl-card' + (p.scene === s.t ? ' on' : '') +
                '" data-scene="' + esc(s.t) + '"><b>' + esc(s.t) + '</b>' +
                '<span>' + esc(s.d) + '</span></button>';
            }).join('') +
          '</div>' +
          '<div class="pl-row" style="margin-top:12px">或自己寫一個：</div>' +
          '<input class="pl-txt" id="pl-own" maxlength="40" ' +
            'placeholder="例：陽台植物缺水提醒燈" value="' +
            (SCENES.some(function (s) { return s.t === p.scene; }) ? '' : esc(p.scene)) + '">' +
          '<div class="pl-row" style="justify-content:center;margin-top:14px">' +
            '<button class="dl-go" id="pl-n1">下一步</button></div>';
      } else if (node === 2) {
        body =
          preview() +
          '<div class="pl-row">🔌 <b>第二步：選 1 個輸入</b>　（系統靠什麼知道該動作了？）</div>' +
          '<div class="pl-grid">' +
            INPUTS.map(function (i) {
              return '<button class="pl-card' + (p.input === i.key ? ' on' : '') +
                '" data-in="' + i.key + '"><b>' + esc(i.t) + '</b>' +
                '<span>給你：' + esc(i.gives) + '</span>' +
                '<span class="pl-tag">' + esc(i.from) + '用過</span></button>';
            }).join('') +
          '</div>' +
          '<div class="pl-row" style="margin-top:14px">💡 <b>再選 1 個輸出</b>　（你要它做什麼給你看？）</div>' +
          '<div class="pl-grid">' +
            OUTPUTS.map(function (o) {
              return '<button class="pl-card' + (p.output === o.key ? ' on' : '') +
                '" data-out="' + o.key + '"><b>' + esc(o.t) + '</b>' +
                '<span class="pl-tag">' + esc(o.from) + '用過</span></button>';
            }).join('') +
          '</div>' +
          '<div class="pl-row" style="justify-content:center;margin-top:14px">' +
            '<button class="dl-go" id="pl-b2" style="background:#94a3b8">上一步</button>' +
            '<button class="dl-go" id="pl-n2">下一步</button></div>';
      } else {
        var i = byKey(INPUTS, p.input), o = byKey(OUTPUTS, p.output);
        body =
          preview() +
          '<div class="pl-row">🧩 <b>第三步：把「如果…那麼…」補完整</b></div>' +
          '<div class="pl-row">如果　' + esc(i.t.replace(/（.*/, '')) +
            '　<select class="pl-in" id="pl-dir" style="width:88px">' +
              '<option value="lt"' + (p.dir === 'lt' ? ' selected' : '') + '>小於</option>' +
              '<option value="gt"' + (p.dir === 'gt' ? ' selected' : '') + '>大於</option>' +
            '</select>　<input class="pl-in" id="pl-val" placeholder="?" value="' +
              esc(String(p.value)) + '">　' + esc(i.unit) +
            '<span style="font-size:13px;color:#64748b;font-weight:700">' +
              '（' + esc(i.hint) + '，' + i.lo + '～' + i.hi + '）</span>' +
          '</div>' +
          '<div class="pl-row">那麼　' + esc(o.t) + '就' +
            '　<select class="pl-in" id="pl-act" style="width:auto;min-width:170px">' +
              '<option value="">選一個…</option>' +
              o.acts.map(function (a) {
                return '<option' + (p.act === a ? ' selected' : '') + '>' + esc(a) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="pl-row" style="justify-content:center;margin-top:14px">' +
            '<button class="dl-go" id="pl-b3" style="background:#94a3b8">上一步</button>' +
            '<button class="dl-go" id="pl-done">完成設計單</button></div>';
      }
      el.innerHTML = '<div class="dl-wrap">' + dots() + body +
        (msg ? '<div class="dl-msg ' + (cls || 'bad') + '">' + md(msg) + '</div>' : '') + '</div>';
      bind();
    }

    function grab() {
      var v = el.querySelector('#pl-val'); if (v) p.value = v.value.trim();
      var d = el.querySelector('#pl-dir'); if (d) p.dir = d.value;
      var a = el.querySelector('#pl-act'); if (a) p.act = a.value;
      var own = el.querySelector('#pl-own');
      if (own && own.value.trim()) p.scene = own.value.trim();
    }

    function bind() {
      el.querySelectorAll('[data-scene]').forEach(function (b) {
        b.addEventListener('click', function () {
          p.scene = b.getAttribute('data-scene'); view('', '');
        });
      });
      el.querySelectorAll('[data-in]').forEach(function (b) {
        b.addEventListener('click', function () {
          grab();
          /* 換了輸入 → 觸發條件要重選（數字型和按鈕型問的不是同一件事）。 */
          if (p.input !== b.getAttribute('data-in')) p.value = '';
          p.input = b.getAttribute('data-in');
          var i = byKey(INPUTS, p.input);
          if (i && p.value === '') p.value = String(i.def);
          view('', '');
        });
      });
      el.querySelectorAll('[data-out]').forEach(function (b) {
        b.addEventListener('click', function () {
          grab();
          if (p.output !== b.getAttribute('data-out')) p.act = '';
          p.output = b.getAttribute('data-out');
          view('', '');
        });
      });
      var n1 = el.querySelector('#pl-n1');
      if (n1) n1.addEventListener('click', function () {
        grab();
        if (!p.scene) return view('先選一個情境，或在下面自己寫一個。', 'bad');
        node = 2; view('', '');
      });
      var n2 = el.querySelector('#pl-n2');
      if (n2) n2.addEventListener('click', function () {
        grab();
        if (!p.input || !p.output) return view(sayPlan(p), 'bad');
        node = 3; view('', '');
      });
      var b2 = el.querySelector('#pl-b2');
      if (b2) b2.addEventListener('click', function () { grab(); node = 1; view('', ''); });
      var b3 = el.querySelector('#pl-b3');
      if (b3) b3.addEventListener('click', function () { grab(); node = 2; view('', ''); });
      var dn = el.querySelector('#pl-done');
      if (dn) dn.addEventListener('click', doDone);
      var ta = el.querySelector('#pl-own');
      if (ta) ta.addEventListener('input', function () { p.scene = ta.value.trim() || p.scene; });
    }

    function doDone() {
      tries++;
      grab();
      if (!planReady(p)) return view(sayPlan(p), 'bad');
      var i = byKey(INPUTS, p.input);
      var n = Number(p.value);
      if (n < i.lo || n > i.hi) return view(sayPlan(p), 'bad');
      el.innerHTML = '<div class="dl-wrap">' + dots() +
        '<div class="pl-line">🎯 <em>' + esc(p.scene) + '</em><br>' + esc(planLine(p)) + '</div>' +
        '<div class="dl-msg good">' + md(
          '🎉 設計單完成 —— **任務卡開了**。\n' +
          '⚠️ 這一句就是你的**基礎關**：先讓它動起來，再想怎麼變聰明。\n' +
          '★ 改主意很正常，隨時可以回來按「再玩一次」改設計單。'
        ).replace(/\n/g, '<br>') + '</div></div>';
      if (typeof opts.onDone === 'function') opts.onDone({ tries: tries, plan: p });
    }

    view('', '');
    return { node: function () { return node; }, plan: function () { return p; },
             tries: function () { return tries; },
             set: function (k, v) { p[k] = v; view('', ''); },
             go: function (n) { node = n; view('', ''); } };
  }

  global.PLANLAB = {
    SCENES: SCENES, INPUTS: INPUTS, OUTPUTS: OUTPUTS,
    byKey: byKey, planLine: planLine, planReady: planReady, sayPlan: sayPlan,
    mount: mount
  };

})(window);
