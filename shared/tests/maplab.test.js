/* 第二節課的暖身關卡：換算（對應）
   跑法：node shared/tests/maplab.test.js   （需要 jsdom：真的把互動點一遍）

   ★ 老師 2026-08-24：「第二節先不要超音波，重點改放在燈條上」
     「主要概念為距離數值換算」「強調反向轉換概念」

   ⚠️ 這一支盯的是**出題**和**判定**，不是版面。
      出題出壞掉的症狀是「學生卡在除法，而不是卡在概念」——
      那在畫面上完全看不出來，只有這種測試抓得到。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const dom = new JSDOM('<!DOCTYPE html><body><div id="x"></div></body>',
  { url: 'https://x/course_115/11501/5016b.html' });
const W = dom.window;
global.document = W.document; global.window = W;
['shared/ultralab.js', 'shared/labkit.js', 'shared/maplab.js']
  .forEach(f => new Function('window', read(f))(W));
const M = W.MAPLAB;
/* ★ ② 進場先是拉桿體驗（老師 2026-08-24），要先把它走完才會出題。
   ⚠️ 這個小工具讓後面每一段不必各自重寫一次。 */
function passPlay(el) {
  const sl = el.querySelector('#mp-slider');
  if (!sl) return false;
  sl.value = 0;  sl.dispatchEvent(new W.Event('input', { bubbles: true }));
  sl.value = 50; sl.dispatchEvent(new W.Event('input', { bubbles: true }));
  el.querySelector('#mp-done').dispatchEvent(new W.Event('click', { bubbles: true }));
  return true;
}

section('換算本身');
{
  ok(M.mapv(25, 0, 50, 0, 100) === 50, '正向：0～50 的一半 → 0～100 的一半');
  ok(M.mapv(25, 50, 0, 0, 100) === 50, '   正中間的時候，正向反向剛好同值');
  ok(M.mapv(10, 50, 0, 0, 100) === 80,
     '★★ 反向：距離 10（靠近）→ 80（亮）—— 這就是「越近越亮」');
  ok(M.mapv(40, 50, 0, 0, 100) === 20, '   距離 40（遠）→ 20（暗）');
  /* 真實程式用的那一組：對應(距離, 55→1, 1→200) */
  ok(M.mapv(55, 55, 1, 1, 200) === 1 && M.mapv(1, 55, 1, 1, 200) === 200,
     '★ 課本那組 55→1 對 1→200：最遠 1、最近 200');
}

section('★★ 出題：數字一定要好算');
{
  /* ⚠️⚠️ 第一版是「取四分之一、四分之二…再四捨五入」，
     結果 50 公分那把尺切出 12.5 → 13、37.5 → 38，換算變成 74、24。
     ★ 學生會卡在除法，而不是卡在「方向」—— 那是第一節就踩過的坑。 */
  let bad = 0, ends = 0, same = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const rng = M.rngFrom('s' + i);
    let prev = null;
    for (const node of [1, 2]) {
      const c = M.caseFor(node, rng, prev); prev = c; n++;
      if (!Number.isInteger(c.answer) || !Number.isInteger(c.d)) bad++;
      if (c.d === 0 || c.d === c.hi) ends++;
      if (node === 2 && c.answer === M.mapv(c.d, 0, c.hi, 0, c.out)) same++;
    }
  }
  ok(bad === 0, '★★ 距離與答案都是整數（' + n + ' 題全查過）');
  ok(ends === 0, '★ 距離不落在兩端 —— 0 和滿格太好猜，答對不代表懂');
  ok(same === 0,
     '★★ 反向題不出「正反同值」的位置（正中間就是那樣）—— 答對不代表知道箭頭轉了');
}

section('★★ 判定：方向錯不可以過');
{
  const c = M.caseFor(2, M.rngFrom('t'), null);
  const fwd = M.mapv(c.d, 0, c.hi, 0, c.out);
  ok(M.judge(2, c, c.answer), '答對過關（' + c.hi + '→0，距離 ' + c.d + ' → ' + c.answer + '）');
  ok(!M.judge(2, c, fwd),
     '★★ 答「正向的值」不過關（' + fwd + '）—— 那是這一節最典型的錯');
  ok(!M.judge(2, c, ''), '   空白不過關');
  ok(!M.judge(2, c, '  '), '   只有空白也不過關');
  /* ⚠️ 空白之所以擋得住，真正的原因是**答案永遠不會是 0**
     （Number('') 是 0）。所以要釘的是那個前提，不是那兩行。 */
  {
    let zero = 0;
    for (let i = 0; i < 200; i++) {
      const rng = M.rngFrom('z' + i);
      for (const node of [1, 2]) if (M.caseFor(node, rng, null).answer === 0) zero++;
    }
    ok(zero === 0, '★★ 答案永遠不是 0 —— 不然「什麼都不填」就會過（Number(\'\') 是 0）');
  }

  /* 提示要**點破那個錯**，而且不可以直接講出答案。 */
  const h = M.hintFor(2, c, fwd);
  ok(/正向/.test(h), '★ 答錯正向時，提示要點破「這是正向的答案」');
  ok(h.indexOf(String(c.answer)) < 0, '★★ 提示裡不出現正解');

  const c1 = M.caseFor(1, M.rngFrom('u'), null);
  ok(M.judge(1, c1, c1.answer) && !M.judge(1, c1, c1.answer + 1), '① 也是答對才過');
  ok(/反向/.test(M.hintFor(1, c1, M.mapv(c1.d, c1.hi, 0, 0, c1.out))),
     '   ① 答成反向時，提示點破「你算的是反向的那一種」');
}

section('★★ ③ 選出「越近越亮」的寫法');
{
  const c = M.caseFor(3, M.rngFrom('v'), null);
  const opts = M.optsFor(c);
  ok(opts.length === 3, '三個選項');
  ok(M.judge(3, c, 'rev'), '★ 把**輸入**倒過來（' + c.hi + '→0）→ 過');
  ok(!M.judge(3, c, 'fwd'), '★★ 正向（越遠越亮）→ 不過');
  ok(!M.judge(3, c, 'half'), '★ 把**輸出**倒過來 → 不過（效果對，但改錯邊）');

  /* ⚠️ 這一節最要命的地方：寫反了，燈**照樣會亮**。
     所以錯的選項一定要講出「你看不出來」這件事。 */
  ok(/一樣會亮|照樣會亮/.test(M.hintFor(3, c, 'fwd')),
     '★★ 答錯正向的提示要講：燈一樣會亮，所以光看畫面看不出錯');
  ok(/輸出/.test(M.hintFor(3, c, 'half')), '   答錯 half 的提示要指出他動的是輸出那一邊');
}

section('★★ ④ 除不盡（老師 2026-08-24：「換算一定是整數嗎? 無法整除怎麼寫答案?」）');
{
  /* ⚠️ ①②③ 刻意只出整除的（那三關測的是方向，不是除法）——
     但課本那組 55 個整數距離裡**只有頭尾兩個**算得出整數。
     ★ 這個落差要正面講，不能靠學生自己在實機上撞到。 */
  let clean = 0;
  for (let d = 1; d <= M.REAL.hi; d++) if (Number.isInteger(M.realMap(d))) clean++;
  ok(clean === 2, '★★ 課本那組（55→1、1→8）只有 ' + clean + ' 個距離算得出整數 —— 除不盡才是常態');

  /* ⚠️⚠️ 出題只能取小數部分 < 0.5 的位置。
     小數 > 0.5 的時候「無條件捨去」和「四捨五入」答案不同
     （距離 2 → 7.870：一個 7、一個 8）。
     老師回報「實機亮燈位置正確」，但沒說是哪一種取法 ——
     ★ 沒驗過的事就不要教：取小數 < 0.5 的題目，兩種取法答案一樣。 */
  let risky = 0, tooFlat = 0, n = 0, ds = new Set();
  for (let i = 0; i < 300; i++) {
    const c = M.caseFor(4, M.rngFrom('d' + i), null); n++;
    ds.add(c.d);
    const f = c.raw - Math.floor(c.raw);
    if (Math.floor(c.raw) !== Math.round(c.raw)) risky++;
    if (f < 0.1) tooFlat++;
  }
  ok(risky === 0,
     '★★ 出的題「無條件捨去」和「四捨五入」答案一定相同 —— ' +
     '不替機器沒驗過的實作方式背書（' + n + ' 題全查過）');
  ok(tooFlat === 0, '★ 小數不會小到看起來像整數（不然學生以為本來就整除）');
  ok(ds.size > 5, '   距離會換（' + ds.size + ' 種）');

  const c = M.caseFor(4, M.rngFrom('q'), null);
  ok(!Number.isInteger(c.raw), '★★ ④ 出的一定是除不盡的（' + c.d + ' → ' + c.raw.toFixed(3) + '）');
  ok(M.judge(4, c, 'floor'), '★ 「機器自己把小數去掉」→ 過');
  ok(!M.judge(4, c, 'none'), '★★ 「一顆都不亮」→ 不過');
  ok(!M.judge(4, c, 'both'), '★ 「兩顆各亮一點點」→ 不過');
  ok(M.optsD(c).length === 3, '   三個選項');
  ok(M.optsD(c).filter(o => o.k === 'floor')[0].t.indexOf(String(Math.floor(c.raw))) >= 0,
     '   正確選項要講出「亮第幾顆」');
  /* 提示要點破，而且不可以講成「都不亮」那種學生已經被否定的話。 */
  ok(/實機測過|照樣會亮/.test(M.hintFor(4, c, 'none')),
     '★ 答「都不亮」的提示要直接否定它（老師實機測過位置是對的）');
  ok(/亮一半|要嘛/.test(M.hintFor(4, c, 'both')), '   答「兩顆一起亮」的提示要講燈珠不能亮一半');
}

section('★ 換一題（重試同一題只證明他記得剛才的答案）');
{
  /* ⚠️ 不可以用「跑很多次看有沒有撞到」—— 統計式斷言擋不住罕見事件。
     ⇒ 餵一個**會故意重複**的亂數：有守衛才換得掉。 */
  /* ⚠️ 餵的值要讓「第二次抽到和第一次一模一樣」才測得到守衛。
     第一版是 [0,0,0,0.7,…]，第二次抽的是 (0, 0.7) —— 本來就不一樣，
     把守衛拿掉照樣綠（突變測試當場抓到）。
     ⇒ 前兩次完全相同，第三次才換。 */
  const vals = [0, 0, 0, 0, 0.7, 0.7];
  let i = 0;
  const stub = () => vals[i++ % vals.length];
  const p = M.caseFor(1, stub, null);
  const q = M.caseFor(1, stub, p);
  ok(JSON.stringify(p) !== JSON.stringify(q),
     '★★ 亂數吐同一個值時也換得掉（' + p.d + ' → ' + q.d + '）');
}

section('★ seed');
{
  const a = M.caseFor(1, M.rngFrom('1234'), null);
  const b = M.caseFor(1, M.rngFrom('1234'), null);
  const c = M.caseFor(1, M.rngFrom('9999'), null);
  ok(JSON.stringify(a) === JSON.stringify(b), '★ 同一個 seed 一定同一題（全班同題靠這個）');
  ok(JSON.stringify(a) !== JSON.stringify(c), '   不同 seed 不一樣');
  /* ⚠️ Math.random() 沒有種子，不可以拿來出題。 */
  const code = read('shared/maplab.js')
    .replace(/(^|[\s;{(=])\/\*[\s\S]*?\*\//gm, '$1')
    .replace(/^\s*\/\/.*$/gm, '');
  ok(!/Math\.random\(\)/.test(code.replace(/return Math\.random;/, '')),
     '★ 出題不用 Math.random（只有「沒有 ultralab 時」拿它當退路）');
}

section('真的掛得起來');
{
  const el = W.document.getElementById('x');
  const api = M.mount(el, { seed: '1234' });
  ok(el.innerHTML.length > 200 && api.node() === 1, '畫得出來，從節點 1 開始');
  ok(!!el.querySelector('#mp-ans'), '① 是填空');
  ok(el.querySelectorAll('.mp-ruler').length === 2, '★ 畫出兩把尺（換算就是兩把尺對齊）');

  el.querySelector('#mp-ans').value = api.here().answer;
  el.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 2, '★ 答對進節點 2');
  /* ⚠️ 用詞要和畫面一致。舊版寫「箭頭轉過來了」，但畫面上已經沒有箭頭 ——
     現在是交叉的配對線。說明和圖對不起來，學生會去找一個不存在的東西。 */
  ok(/反向/.test(el.textContent), '★★ 節點 2 一進場就要講「反向」，不能只換數字');
  ok(!/箭頭/.test(read('shared/maplab.js').replace(/\/\*[\s\S]*?\*\//g, '')),
     '★★ 全篇不再出現「箭頭」—— 畫面上已經改成交叉線了');

  ok(passPlay(el), '★★ ② 先是拉桿體驗（先體驗再作答）');
  el.querySelector('#mp-ans').value = api.here().answer;
  el.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 3, '★ 答對進節點 3');
  ok(el.querySelectorAll('.mp-opt').length === 3, '   節點 3 是三選一');
  el.querySelector('[data-k="rev"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 4, '★ 答對進節點 4');

  let done = null;
  const el2 = W.document.createElement('div');
  W.document.body.appendChild(el2);
  const api2 = M.mount(el2, { seed: '77', onDone: info => { done = info; } });
  for (const node of [1, 2]) {
    passPlay(el2);          // ② 要先把體驗走完
    el2.querySelector('#mp-ans').value = api2.here().answer;
    el2.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  }
  el2.querySelector('[data-k="rev"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  el2.querySelector('[data-k="floor"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!done, '★ 四個節點都過 → 回報 onDone');
  ok(/照樣會亮/.test(el2.textContent),
     '★★ 結尾要再提醒一次：寫反了燈照樣會亮，要靠近才看得出來');
}

section('★ 答錯的時候');
{
  const el = W.document.createElement('div');
  W.document.body.appendChild(el);
  const api = M.mount(el, { seed: '55' });
  const first = JSON.stringify(api.here());
  el.querySelector('#mp-ans').value = api.here().answer + 7;
  el.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 1, '   答錯還留在節點 1');
  ok(JSON.stringify(api.here()) !== first, '★ 答錯換一題');
  /* ⚠️ 但不可以馬上把新題目畫出來 —— 他還沒看完剛才那張圖。 */
  ok(!el.querySelector('#mp-ans') && /下一題/.test(el.textContent),
     '★★ 先把剛才那一題的尺畫給他看，由他按「下一題」才往下');
  ok(el.querySelectorAll('.mp-pin').length === 2 && !/？/.test(
       el.querySelector('.mp-pin.out').textContent),
     '★★ 而且那張圖要**把答案標出來** —— 只說「答錯了」學不到東西');
  ok(el.querySelectorAll('.mp-now').length === 1,
     '   連同「這一題是怎麼對過去的」那條線一起畫出來');
}

section('★★ 尺標上的字不可以互相重疊（老師 2026-08-24）');
{
  /* 老師回報：「換算出來的值如果太靠近左邊會與提示說明的字重疊」。
     ⚠️ jsdom 沒有版面計算，量不到「有沒有重疊」——
        所以這裡盯的是**造成重疊的那兩個條件**：
          ① 說明文字（.mp-cap）和尺標上的數字**在同一層**
             （cap 本來是 position:absolute、top:2px，數字在 top:-15px，
              垂直本來就重疊，只差水平上有沒有撞到）
          ② 數字用 translateX(-50%)，pin 在 0% 時有一半跑到框外
        ★ 只治一個沒用 —— 第一節「35 公分被裁掉」就是這樣多修了一次。 */
  const src = read('shared/maplab.js');

  /* ① cap 不可以再是絕對定位 */
  ok(!/\.mp-cap\{[^']*position:absolute/.test(src),
     '★★ 說明文字不再是絕對定位 —— 它要自己佔一行，不跟數字擠在同一層');
  ok(/\.mp-cap\{[^']*margin-bottom/.test(src), '   而且和下面那把尺留了間距');

  /* ② 靠邊時要換對齊方式 */
  ok(/\.mp-pin\.at-l b\{left:0;transform:none\}/.test(src) &&
     /\.mp-pin\.at-r b\{left:auto;right:0;transform:none\}/.test(src),
     '★★ 靠左端／右端時改成貼邊對齊（不然一半會跑到框外）');

  /* 真的畫出來看看：找一題 pin 很靠左的，看有沒有掛上 at-l */
  let hit = null;
  for (let i = 0; i < 120 && !hit; i++) {
    const c = M.caseFor(2, M.rngFrom('e' + i), null);
    const pos = c.d / c.hi * 100;
    if (pos < 12 || (100 - pos) < 12) hit = { i, c, pos };
  }
  ok(!!hit, '找得到「靠邊」的題目（' + (hit ? hit.c.d + '/' + hit.c.hi : '—') + '）');
  if (hit) {
    const el = W.document.createElement('div');
    W.document.body.appendChild(el);
    M.mount(el, { seed: 'e' + hit.i });
    const pins = [...el.querySelectorAll('.mp-pin')];
    /* ⚠️ 作答中只有**一支**指標（下面那把尺不放，放了就等於給答案）。 */
    ok(pins.length === 1 && pins.every(p => /at-l|at-r/.test(p.className)),
       '★★ 靠邊的題目，指標掛上了貼邊對齊');
    /* ★ cap 要在 .mp-rulers 底下、而不是包在 .mp-ruler 裡面 —— 那才是「自己一行」。 */
    ok(el.querySelectorAll('.mp-rulers > .mp-cap').length === 2,
       '★★ 兩個說明文字都在尺標**外面**（各自佔一行）');
    ok(el.querySelectorAll('.mp-ruler .mp-cap').length === 0,
       '   而且沒有任何一個還留在尺標裡面');
  }
}

section('★★ 反向不可以靠「把數線倒過來標」（老師 2026-08-24）');
{
  /* 老師：「反向轉換也會有數線，這樣感覺會誤導理解?」
     ⚠️⚠️ 而且不只是誤導 —— 舊版把下面那把尺標成「左 100、右 0」，
        指標卻還是照正向的位置畫：值 70 畫在 70%，而那裡照刻度讀是 30。
        **畫面上的數字和它自己的刻度差了 40 個百分點。**
     ★ 病根是「倒過來標刻度」本身：刻度一反，位置的算法就得跟著反，
       那是很容易漏掉的地方；而且左大右小和數學課教的數線衝突。
     ⇒ 兩把尺一律左小右大，反向改用**交叉的配對線**表示。 */
  const src = read('shared/maplab.js');
  ok(!/c\.rev \? c\.out : 0/.test(src) && !/c\.rev \? 0 : c\.out/.test(src),
     '★★ 尺的兩端不再依方向對調 —— 刻度一律左小右大');

  /* 逐題檢查：指標的位置一定要和刻度讀出來的一致。 */
  let bad = 0, revs = 0;
  for (let i = 0; i < 200; i++) {
    for (const node of [1, 2]) {
      const c = M.caseFor(node, M.rngFrom('r' + i), null);
      if (c.rev) revs++;
      const el = W.document.createElement('div');
      W.document.body.appendChild(el);
      /* 直接借用畫面：先答錯一次讓它把答案畫出來。 */
      const api = M.mount(el, { seed: 'r' + i });
      if (node === 2) { /* ② 要先過體驗那一關 */ }
      const cur = api.here();
      el.querySelector('#mp-ans').value = cur.answer + 1;
      el.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true }));
      const pin = el.querySelector('.mp-pin.out');
      if (!pin) { bad++; continue; }
      const at = parseFloat(pin.getAttribute('style').replace(/[^0-9.]/g, ''));
      const should = cur.answer / cur.out * 100;
      /* ★★ 這一條就是舊版會紅的地方（70% vs 30%）。 */
      if (Math.abs(at - should) > 0.5) bad++;
      if (pin.textContent.indexOf(String(cur.answer)) < 0) bad++;
      el.remove();
    }
  }
  ok(bad === 0, '★★ 指標畫的位置和刻度讀出來的值一致（400 題全查過）');
  ok(revs > 0, '   （其中有反向題 ' + revs + ' 次）');

  /* 交叉線：反向才交叉。 */
  const rev = M.caseFor(2, M.rngFrom('cross'), null);
  const fwd = M.caseFor(1, M.rngFrom('cross'), null);
  const draw = (c, seed, node) => {
    const el = W.document.createElement('div');
    W.document.body.appendChild(el);
    const api = M.mount(el, { seed: seed });
    if (node === 2) { el.querySelector('#mp-ans').value = api.here().answer;
      el.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true })); }
    return el;
  };
  {
    const el = draw(fwd, 'cross', 1);
    const pair = [...el.querySelectorAll('.mp-pair')];
    ok(pair.length === 2, '正向：畫出兩條端點配對線');
    /* 正向 → 兩條都是垂直的（x1 === x2） */
    ok(pair.every(l => l.getAttribute('x1') === l.getAttribute('x2')),
       '★ 正向時兩條配對線**平行**（垂直往下）');
    ok(/平行/.test(el.querySelector('.mp-note').textContent), '   而且文字也講「平行」');

    const el2 = draw(rev, 'cross', 2);
    const pair2 = [...el2.querySelectorAll('.mp-pair')];
    ok(pair2.every(l => l.getAttribute('x1') !== l.getAttribute('x2')),
       '★★ 反向時兩條配對線**交叉**（0 接到另一端）—— 這就是反向的視覺標誌');
    ok(/交叉/.test(el2.querySelector('.mp-note').textContent), '   而且文字也講「交叉」');
  }

  /* ⚠️ 還沒作答時不可以把連線畫出來 —— 它落在哪裡就是答案。 */
  {
    const el = W.document.createElement('div');
    W.document.body.appendChild(el);
    M.mount(el, { seed: 'hide' });
    ok(el.querySelectorAll('.mp-now').length === 0,
       '★★ 還沒作答時不畫那條連線 —— 它落在哪裡就是答案');
    ok(el.querySelectorAll('.mp-pin.out').length === 0, '   下面那把尺也不放指標');
    ok(/？/.test(el.textContent), '   改成在標題寫「= ？」');
  }
}

section('★★ ② 先拉一遍再答題（老師 2026-08-24 指定的互動體驗）');
{
  const el = W.document.createElement('div');
  W.document.body.appendChild(el);
  const api = M.mount(el, { seed: 'play' });
  el.querySelector('#mp-ans').value = api.here().answer;
  el.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true }));

  ok(api.node() === 2 && !!el.querySelector('#mp-slider'),
     '★ 進到 ② 先看到拉桿，不是直接出題');
  ok(!el.querySelector('#mp-ans'), '★★ 這時候還沒有填空框 —— 先體驗再作答');

  const sl = el.querySelector('#mp-slider');
  const pins = () => [...el.querySelectorAll('.mp-pin')].map(p =>
    ({ v: Number(p.querySelector('b').textContent),
       at: parseFloat(p.getAttribute('style').replace(/[^0-9.]/g, '')) }));

  sl.value = 5; sl.dispatchEvent(new W.Event('input', { bubbles: true }));
  const near = pins();
  sl.value = 45; sl.dispatchEvent(new W.Event('input', { bubbles: true }));
  const far = pins();

  /* ★★ 這就是整個體驗要讓他看見的事：上面往右，下面往左。 */
  ok(near[0].at < far[0].at, '   上面那支：拉遠 → 往右跑');
  ok(near[1].at > far[1].at, '★★ 下面那支：拉遠 → 往**左**跑（反向）');
  ok(near[1].v > far[1].v, '★★ 而且數字變小（近 ' + near[1].v + ' → 遠 ' + far[1].v + '）');
  ok(el.querySelectorAll('.mp-now').length === 1,
     '★ 體驗時**要**畫那條連線（這裡不是考題，就是要他看見對應關係）');
  ok([...el.querySelectorAll('.mp-pair')].every(l => l.getAttribute('x1') !== l.getAttribute('x2')),
     '   而且兩條配對線是交叉的');

  /* ⚠️ 兩端都碰過才放行 —— 拉一下就跳過的話，他沒看到全貌。 */
  {
    const el2 = W.document.createElement('div');
    W.document.body.appendChild(el2);
    const a2 = M.mount(el2, { seed: 'play2' });
    el2.querySelector('#mp-ans').value = a2.here().answer;
    el2.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(el2.querySelector('#mp-done').disabled, '★★ 還沒拉過 → 「出題」是鎖著的');
    const s2 = el2.querySelector('#mp-slider');
    /* ⚠️ 先拉**遠**的那一端。第一版先拉近端，結果「不管拉到哪裡都算碰過」
       這種寫法照樣綠（突變測試當場抓到）——
       因為近端本來就會被滿足，看不出判斷有沒有生效。 */
    s2.value = 49; s2.dispatchEvent(new W.Event('input', { bubbles: true }));
    ok(el2.querySelector('#mp-done').disabled, '★★ 只拉到遠端 → 還是鎖著（近端還沒碰）');
    s2.value = 25; s2.dispatchEvent(new W.Event('input', { bubbles: true }));
    ok(el2.querySelector('#mp-done').disabled, '   拉回中間也不算 —— 要真的碰到那一端');
    s2.value = 2; s2.dispatchEvent(new W.Event('input', { bubbles: true }));
    ok(!el2.querySelector('#mp-done').disabled, '★ 兩端都拉到 → 才解鎖');
    el2.querySelector('#mp-done').dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(!!el2.querySelector('#mp-ans') && a2.node() === 2, '★ 按下去才出題');

    /* ⚠️ 反過來再驗一次：只拉到**近**端。
       兩端要各驗一次 —— 只驗一種順序的話，
       「另一端不管拉到哪都算碰過」這種寫法會躲掉（突變測試抓到的）。 */
    const el3 = W.document.createElement('div');
    W.document.body.appendChild(el3);
    const a3 = M.mount(el3, { seed: 'play3' });
    el3.querySelector('#mp-ans').value = a3.here().answer;
    el3.querySelector('#mp-run').dispatchEvent(new W.Event('click', { bubbles: true }));
    const s3 = el3.querySelector('#mp-slider');
    s3.value = 1; s3.dispatchEvent(new W.Event('input', { bubbles: true }));
    ok(el3.querySelector('#mp-done').disabled, '★★ 只拉到近端 → 還是鎖著（遠端還沒碰）');
  }

  /* ⚠️⚠️ 出題那把尺不可以和體驗那把一樣 ——
     不然學生在體驗裡拉到題目那個距離，答案直接讀出來。 */
  let same = 0;
  for (let i = 0; i < 200; i++) {
    const c = M.caseFor(2, M.rngFrom('p' + i), null);
    if (c.hi === 50 && c.out === 100) same++;
  }
  ok(same === 0, '★★ ② 出題永遠不用體驗那一把尺（50→100）—— 不然答案讀得到');

  /* 拖曳時只換尺標那一塊：整個重畫會讓拉桿失焦，手指還按著就斷了。 */
  const src = read('shared/maplab.js');
  ok(/var st = el\.querySelector\('#mp-stage'\);[\s\S]{0,120}st\.innerHTML/.test(src),
     '★★ 拖曳只更新尺標那一塊（整個重畫會讓拉桿失焦）');
}

section('★ 第二節真的接上頁面了');
{
  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/maplab\.js"><\/script>/.test(page), '頁面載入 maplab');
  ok(page.indexOf('shared/labkit.js') < page.indexOf('shared/maplab.js'),
     '   labkit 排在前面（maplab 開場就會去拿它）');

  /* ★★ 暖身與檢核要**分開指定**。
     ⚠️ 綁在一起的話，第二節（換了暖身、檢核還沒做）會什麼都掛不上 ——
        而畫面上只是「那一塊不見了」，不會報錯。 */
  ok(/lab: \{ unit: 'u1', warm: 'ULTRALAB', checks: 'DOORLAB' \}/.test(page),
     '★ 第一節：暖身 ULTRALAB ＋ 檢核 DOORLAB');
  ok(/lab: \{ unit: 'u2', warm: 'MAPLAB', checks: 'LIGHTLAB' \}/.test(page),
     '★★ 第二節：暖身換成 MAPLAB、檢核是 LIGHTLAB');
  ok(!/data\.lab === 'door1'/.test(page),
     '★ 掛載邏輯不再寫死 door1（資料驅動，之後每一節只要填 lab）');
  /* ⚠️ 條件只能看暖身。寫成 warmMod && chkMod 的話，
     第二節（檢核還沒做）連暖身都掛不上 —— 而畫面上只是「那一塊不見了」。 */
  ok(/\n            if \(warmMod\) \{/.test(page),
     '★★ 有暖身就掛，不必等檢核（第二節的檢核還沒做）');
  ok(/if \(!chkMod\) \{/.test(page),
     '★★ 沒有檢核的單元要**講出來**，不要留一塊空白讓學生以為沒載完');

  /* 完成紀錄要記在自己的單元底下，不可以兩節共用一格。 */
  ok(/const UNIT   = labCfg\.unit;/.test(page),
     '★★ 紀錄用各單元自己的 unit（u1／u2）—— 共用一格的話做完第一節第二節就跳過去了');

  /* 生活應用：老師 2026-08-24 選的兩個 */
  /* 老師 2026-08-24 把「倒車距離指示燈條」換成「迎賓燈」——
     ⚠️ 因為這一支程式**只亮一顆**，而倒車指示條讓人聯想到「亮一整排」。 */
  ok(/迎賓燈/.test(page) && /走廊感應夜燈/.test(page),
     '★ 第二節的生活應用是「迎賓燈」與「走廊感應夜燈」');
  ok(/對應/.test(page.slice(page.indexOf('迎賓燈"'), page.indexOf('迎賓燈"') + 900)),
     '   而且點出這一節為什麼需要新積木「對應」');

  /* ★★ desc 不可以再說「亮越多」—— 那是**累積**（長度條），
     而這一支程式做的是**只亮一顆**（位置）。舊草稿和程式行為是反的。 */
  /* ⚠️ 要從 courseData 那一筆抓，不是從頁面第一次出現「迎賓走廊」的地方 ——
     課程總覽的卡片也有同一個標題，抓到的會是**第一節**的 desc。 */
  const at2 = page.indexOf('title: "迎賓走廊：超音波與燈條"');
  const desc = (page.slice(at2).match(/desc: "([^"]*)"/) || [])[1] || '';
  ok(desc && !/亮越多|越亮越多/.test(desc),
     '★★ 第二節的說明不再寫「越靠近亮越多」（那是長度條，不是這支程式做的事）');
  ok(/亮度/.test(desc) && /位置/.test(desc),
     '   而是講清楚兩種模式：亮度與位置');

  /* ★★ 老師 2026-08-24：「表示這是兩種效果，讓學生使用比較」 */
  ok(/同一段程式，兩種效果/.test(page), '★★ 程式說明裡有「兩種效果」的比較區塊');
  ok(/只亮一顆（位置）/.test(page) && /亮到第 N 顆（長度）/.test(page),
     '   兩種都畫出來（位置／長度）');
  ok(/不一定是壞掉/.test(page),
     '★★ 而且要講明「走過的燈都留著」**不一定是壞掉** —— 那是另一種做法');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
