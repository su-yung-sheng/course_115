/* 第四節課的暖身：RGB 三原色混色
   跑法：node shared/tests/rgblab.test.js   （需要 jsdom）

   ★ 老師 2026-08-24：「重點強調 R G B 三原色混色原理」
     「公式有點難，不解釋」「複習一下轉換公式」

   ⚠️ 所以這一支盯兩件事：
      ① 混色的判定與回饋（要指出多開了哪一盞、少開了哪一盞）
      ② **那三行 sin 不可以跑進暖身裡** —— 老師明講不解釋 */
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
['shared/ultralab.js', 'shared/labkit.js', 'shared/rgblab.js']
  .forEach(f => new Function('window', read(f))(W));
const R = W.RGBLAB, U = W.ULTRALAB;

section('★★ 混色：光是「加」上去的');
{
  const by = k => R.MIXES.filter(m => m.key === k)[0];
  ok(String(by('yellow').want) === '1,1,0', '★★ 紅 ＋ 綠 ＝ 黃');
  ok(String(by('cyan').want) === '0,1,1', '★ 綠 ＋ 藍 ＝ 青');
  ok(String(by('magenta').want) === '1,0,1', '★ 紅 ＋ 藍 ＝ 洋紅');
  ok(String(by('white').want) === '1,1,1', '★★ 三盞全開 ＝ 白');
  /* ⚠️ 不出「只開一盞」的題 —— 那看不出他懂不懂「混」。 */
  ok(R.MIXES.every(m => m.want.reduce((a, b) => a + b, 0) >= 2),
     '★★ 每一題至少要開兩盞（只開一盞看不出他懂不懂混色）');
  ok(R.MIXES.every(m => m.why && m.why.length > 8), '   每一題都有「為什麼」');
}

section('★★ 判定與回饋');
{
  const yellow = R.MIXES.filter(m => m.key === 'yellow')[0];
  ok(R.judgeMix([255, 255, 0], yellow).ok, '★ 調對 → 過');
  /* ⚠️ 不要求剛好 255／0 —— 卡在最後幾格只會讓人以為自己想錯了。 */
  ok(R.judgeMix([240, 210, 20], yellow).ok, '★★ 差幾格也算過（考的是概念，不是手穩）');
  ok(!R.judgeMix([255, 255, 255], yellow).ok, '   三盞全開 → 不是黃色');
  ok(!R.judgeMix([255, 0, 0], yellow).ok, '   只開紅 → 不過');
  ok(R.judgeMix([255, 128, 0], yellow).how === 'mid',
     '★ 滑桿停在中間 → 判 mid（先只用全開／全關）');

  /* ★★ 回饋要指出**多開了哪一盞、少開了哪一盞**，不是只說「不對」。 */
  const s1 = R.sayMix(R.judgeMix([255, 0, 255], yellow), yellow);
  ok(/藍/.test(s1) && /關掉/.test(s1), '★★ 多開的那一盞要點名叫他關掉');
  ok(/綠/.test(s1) && /打開/.test(s1), '★★ 少開的那一盞要點名叫他打開');
  const s2 = R.sayMix(R.judgeMix([255, 128, 0], yellow), yellow);
  ok(/全開|全關/.test(s2), '★ 停在中間時，講清楚這一關先只用全開／全關');
  ok(s1 !== s2, '   兩種情況的回饋不一樣');
}

section('★★ 光不是顏料（這一關的重點）');
{
  ok(R.Q2.length === 3, '三組問法');
  ok(R.Q2.every(q => q.opts.filter(o => o.good).length === 1), '每一組只有一個正解');
  ok(R.Q2.every(q => q.opts.length === 3 && q.why && q.why.length > 8),
     '   三選一，而且都有「為什麼」');
  /* ★★ 一定要有一題直接對上「美術課的顏料」那個迷思。 */
  const paintQ = R.Q2.filter(q => /美術課|顏料/.test(q.q))[0];
  ok(!!paintQ, '★★ 有一題直接對上「美術課的顏料」那個迷思');
  ok(paintQ && paintQ.opts.some(o => !o.good && /咖啡色/.test(o.t)),
     '★ 而且「一樣是咖啡色」要當成選項（那是學生真的會選的）');
  ok(R.Q2.some(q => /白色|全部開/.test(q.q + q.opts.map(o => o.t).join())),
     '★ 有一題問「三盞全開是什麼顏色」');
  ok(R.Q2.some(q => /黑|不亮/.test(q.q)), '★ 有一題問「黑色怎麼做」（黑＝沒有光）');
  ok(R.Q2.map(q => q.why).join().match(/越混越暗|吃掉/),
     '★★ 解釋要講出「顏料是把光吃掉、燈是把光加上去」');
}

section('★ 複習轉換（只複習類比對應，不碰那三行 sin）');
{
  ok(R.HUE_MAX === 359, '★ 範圍是 0～359（課本那組）');
  ok(R.PIN === 'A7', '   腳位 A7');
  let bad = 0, pcts = new Set();
  for (let i = 0; i < 200; i++) {
    const c = R.caseHue(U.rngFrom('h' + i), null);
    pcts.add(c.pct);
    if (!Number.isInteger(c.answer)) bad++;
    if (c.pct <= 0 || c.pct >= 100) bad++;
  }
  ok(bad === 0, '★ 答案都是整數、不出兩端');
  ok(pcts.size > 3, '   位置會換（' + pcts.size + ' 種）');

  const c = { pct: 20, answer: Math.round(359 * 0.2) };
  ok(R.judgeHue(c.answer, c), '答對過關');
  ok(R.judgeHue(c.answer + 2, c), '★ 容許 ±2（考的是會不會用那塊積木，不是心算精度）');
  ok(!R.judgeHue(c.answer + 9, c), '   差太多就不過');
  ok(!R.judgeHue('', c), '   空白不過');
  /* ⚠️ 最常見的錯：把「旋鈕的百分比」當成答案。 */
  ok(/百分比/.test(R.sayHue(20, c)), '★★ 答成「旋鈕的百分比」→ 要點破');
  ok(/上限|超過/.test(R.sayHue(500, c)), '★ 超出範圍 → 點破上限是 359');

  /* ★★ 老師：「公式有點難，不解釋」。
     ⚠️ 但這一條第一版寫成「全篇不可以出現 sin」—— 那是錯的：
        結尾那句「那三行 sin 不必看懂」**本來就該出現**，
        它正是在告訴學生可以放心跳過。
     ⇒ 要釘的是「暖身**不去算** sin」，不是「不准提到它」。 */
  const src = read('shared/rgblab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/Math\.sin|OPERATOR:sin|sin\(/.test(src),
     '★★ 暖身裡**沒有真的去算 sin** —— 老師明講那個公式不解釋');
  ok(/sin 的公式不必看懂|不必看懂/.test(src),
     '★ 但要明講「那三行 sin 不必看懂」（免得學生卡在公式上）');
}

section('★★ 三個節點真的走得完');
{
  const el = W.document.getElementById('x');
  let done = null;
  const api = R.mount(el, { seed: '1234', onDone: i => { done = i; } });
  ok(api.node() === 1 && el.querySelectorAll('[data-ch]').length === 3,
     '① 三根滑桿（紅綠藍）');
  ok(/rg-lamp/.test(el.innerHTML), '★ 而且畫出三盞疊在一起的燈');
  /* ⚠️⚠️ 這一條要**先剝註解**。
     第一版直接搜整份原始碼，但 stageHtml 的註解裡正好寫著
     「用 mix-blend-mode:screen」—— 把 CSS 裡真正那一行刪掉，
     測試照樣綠（突變測試當場抓到）。
     ★ 這是「註解自傷」的鏡像版：註解不是害它變紅，是**幫它變綠**。
       這個專案已經第七次踩到同一族的坑了。
     ⚠️ 而且那段 CSS 是用 '…' + '…' 串起來的，
     所以要先把相鄰字串接回去，不然規則中間會被引號切斷。 */
  const cssOnly = read('shared/rgblab.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')      // 剝註解
    .replace(/'\s*\+\s*'/g, '');            // 把 '…' + '…' 接成一段
  ok(/\.rg-lamp\{[^{}]*mix-blend-mode:screen/.test(cssOnly),
     '★★ .rg-lamp 真的套了 screen 混色 —— 光要「加」起來，不是蓋過去');

  /* 先故意調錯 */
  api.setRgb([255, 0, 0]);
  el.querySelector('#rg-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 1, '   調錯還留在 ①');
  /* ⚠️ 調錯之後滑桿的值要留著（不然三根都要重調）。 */
  ok(el.querySelector('[data-ch="0"]').value === '255',
     '★★ 調錯重畫之後，滑桿的值還在');

  const want = api.mix().want.map(v => v ? 255 : 0);
  api.setRgb(want);
  el.querySelector('#rg-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 2, '★ 調對 → 進到 ②');

  el.querySelector('[data-k="' + api.q2().opts.filter(o => o.good)[0].k + '"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 3, '★ ② 答對 → 進到 ③');

  /* ── ③ ⚠️⚠️ 老師 2026-08-25：「沒有旋轉可變電阻燈號改變位置的互動操作」
     ★ 第一版的 ③ 只有一格填空 —— 這一節講的兩個模式
       （燈號移動、混色）**都沒有動手的地方**，等於只用讀的。
     ⇒ 這裡放一顆真的旋鈕，轉它燈號會跑、顏色會換。 */
  ok(!!el.querySelector('.rg-dial'), '★★ ③ 有一顆**真的旋鈕**（不是只有填空）');
  ok(!el.querySelector('#rg-hue'),
     '★★ 還沒轉過就不出題 —— 要自己轉一遍才有感覺（同第三節）');
  {
    /* ⚠️⚠️ 這裡本來只測純函式（posAt / hueAt）—— 那**測不到老師抱怨的那件事**。
       「轉了燈不動」的病根從來不在算式，而在畫面沒更新：
       把 paint3() 裡的選擇器打錯一個字，純函式照樣全對，測試照樣綠。
       ⇒ 一定要真的去看**畫面上亮的是第幾顆**。 */
    const litAt = () => {
      const leds = [...el.querySelectorAll('.rg-led')];
      return leds.findIndex(d => !/#1e293b|rgb\(30, 41, 59\)/.test(d.style.background)) + 1;
    };
    api.setPct(0);
    ok(litAt() === 1, '★★ 轉到最左 → **畫面上**亮第 1 顆');
    api.setPct(100);
    ok(litAt() === R.LEDS,
       '★★ 轉到最右 → **畫面上**亮第 ' + R.LEDS + ' 顆（實得第 ' + litAt() + ' 顆）');
    api.setPct(50);
    ok(litAt() > 1 && litAt() < R.LEDS, '★ 轉到一半 → 亮中間那幾顆之一（第 ' + litAt() + '）');
    /* 顏色也要真的跟著換（模式二）。 */
    const colAt = p => { api.setPct(p); return el.querySelector('#rg-live').innerHTML; };
    ok(colAt(20) !== colAt(80), '★★ 轉動時**畫面上**的顏色真的會變');
    api.setPct(0); api.setPct(100);
    ok(R.posAt(50) !== 1 && R.posAt(50) !== R.LEDS, '★ 換算本身也對（' + R.posAt(50) + '）');
    /* ★ 顏色也要跟著換 —— 這是模式二。 */
    ok(R.hueAt(0) === 0 && R.hueAt(100) === R.HUE_MAX, '★ 顏色 0～' + R.HUE_MAX);
    ok(String(R.hueRgb(R.hueAt(0))) !== String(R.hueRgb(R.hueAt(50))),
       '★★ 轉動時顏色真的會變（不是一直同一色）');
  }
  ok(!!el.querySelector('#rg-hue'), '★ 兩端都轉到 → 才出填空題');
  /* ⚠️ 拖曳中不可以重畫整頁（第三節的「滑鼠只能點第一下」）。 */
  {
    const src3 = read('shared/rgblab.js');
    ok(/dialH && dialH\.dragging\(\)/.test(src3),
       '★★ 手指還按著時不重畫整頁（不然會把正在拖的 SVG 換掉）');
    const p3 = src3.slice(src3.indexOf('function paint3()'), src3.indexOf('function setPct'));
    ok(/#rg-needle[\s\S]{0,120}setAttribute\('transform'/.test(p3),
       '★★ 轉動時只改指針的 transform');
    ok(!/rg-dial[\s\S]{0,40}innerHTML/.test(p3), '★★ 不重畫旋鈕那一塊');
  }
  /* 用轉的比拉的難 —— 留兩顆退路（同第三節）。 */
  {
    const el5 = W.document.createElement('div');
    W.document.body.appendChild(el5);
    const a5 = R.mount(el5, { seed: 'jj' });
    a5.setRgb(a5.mix().want.map(v => v ? 255 : 0));
    el5.querySelector('#rg-run').dispatchEvent(new W.Event('click', { bubbles: true }));
    el5.querySelector('[data-k="' + a5.q2().opts.filter(o => o.good)[0].k + '"]')
      .dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(!!el5.querySelector('#rg-jl') && !!el5.querySelector('#rg-jr'),
       '★ 有「直接轉到最左／最右」兩顆按鈕');
    el5.querySelector('#rg-jl').dispatchEvent(new W.Event('click', { bubbles: true }));
    el5.querySelector('#rg-jr').dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(!!el5.querySelector('#rg-hue'), '   按那兩顆也能把兩端達成、出題');
  }

  el.querySelector('#rg-hue').value = api.hue().answer;
  el.querySelector('#rg-runH').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!done, '★ 三個節點都過 → 回報 onDone');
  ok(/不必看懂/.test(el.textContent),
     '★★ 結尾要明講「那三行 sin 不必看懂」—— 免得學生卡在公式上');
  ok(!/\*\*/.test(el.textContent), '★ 結尾有過 md()');

  /* 拖滑桿時只換舞台那一塊（第三節踩過「重畫把元素換掉」那個坑）。 */
  const src = read('shared/rgblab.js');
  ok(/function paint\(\)[\s\S]{0,200}#rg-stage[\s\S]{0,60}innerHTML/.test(src),
     '★★ 拖滑桿時只換舞台那一塊，不整個重畫（重畫會讓滑桿失焦）');

  /* ★ 旋鈕的幾何與拖曳在 labkit（第三、四節共用）——
     ⚠️ 不可以在這裡再寫一份，不然兩節課的手感會不一樣而且看不出來。 */
  ok(/LK\(\)\.dialSvg\(/.test(src) && /LK\(\)\.dialBind\(/.test(src),
     '★★ 旋鈕用 labkit 的那一顆（和第三節同一個，幾何不可以有兩份）');
  ok(!/atan2|SWEEP/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★★ rgblab 自己不算角度（算了就是第二份幾何）');
  ok(!/Math\.sin/.test(src), '★ 連畫顏色都沒用到 sin');
}

section('★ 第四節接上頁面了');
{
  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/rgblab\.js"><\/script>/.test(page), '頁面載入 rgblab');
  /* 檢核已經接上（老師 2026-08-25：「都暖身結束了，動手檢核：沒有開始」）——
     那一關的斷言在 shared/tests/mixlab.test.js。 */
  ok(/lab: \{ unit: 'u4', warm: 'RGBLAB', checks: 'MIXLAB' \}/.test(page),
     '★ 第四節：暖身 RGBLAB ＋ 檢核 MIXLAB');

  const u4 = page.slice(page.indexOf('title: "情境照明'), page.indexOf('title: "智慧中樞'));
  /* ⚠️ 舊草稿寫 A1、0~1023→0~255 色相、還有一塊不存在的「色相填滿」積木。 */
  ok(!/類比 A1|0, 1023, 0, 255|色相為/.test(u4),
     '★★ 舊草稿那組（A1、0~1023→0~255、色相填滿）已經清掉');
  ok(/A7/.test(u4), '★ 腳位是 A7');
  ok(/類比對應/.test(u4), '★ 用「類比對應」這塊積木（和第三節同一塊）');
  ok(/359/.test(u4), '★★ 色環範圍是 0～359');
  /* 兩個模式都要寫出來 —— 這一節是二＋三的整合。 */
  ok(/燈號移動/.test(u4) && /混色/.test(u4), '★★ 兩種模式都寫出來（燈號移動／混色）');
  /* ⚠️ 老師 2026-08-25：「『第二節＋第三節的整合』這個就不用特別寫出來」。
     ★ 第一版反過來釘「一定要點出接在前兩節哪裡」—— 現在要釘相反的事：
       學生看得到的地方**不出現那個框架**（讓他自己覺得熟悉就好）。
     ⚠️ 但「接法同第三節」那種**操作上的指引**留著 —— 那是接線要用的。 */
  ok(!/整合/.test(u4.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★★ 畫面上不寫「整合」（老師 2026-08-25）');
  /* ★★ 這一節的重點：RGB 混色，而且公式不解釋。 */
  ok(/不必看懂/.test(u4), '★★ 明講那三行 sin 不必看懂（老師：公式有點難，不解釋）');
  ok(/光不是顏料|越混越暗/.test(u4), '★★ 點出「光不是顏料」那個迷思');
  ok(/紅 ＋ 綠/.test(u4) && /三盞全開/.test(u4), '★ 有一張三原色混色的對照');
  ok(/沒有光/.test(u4), '   而且講清楚「黑色不是一種光，是沒有光」');

  /* ⚠️⚠️ 老師 2026-08-25：「旋鈕輸入 (Hue): 976　色相角: 343° 這個操作沒有說明?」
     ★ 0～1023 在**第三節**講過（分壓那一段）——
       毛病在第四節這個示範自己沒接上：把原始讀值叫做 (Hue)、
       中間少了換算那一步、還用 360 而不是 359。 */
  const pg = u4.slice(u4.indexOf('initPlayground'), u4.indexOf('demoHTML'));
  ok(!/\(Hue\)/.test(pg),
     '★★ 不再把 A7 的原始讀值叫做 (Hue)（那是換算**之前**的數字）');
  ok(/A7 讀到/.test(pg) && /1023/.test(pg), '★ 標明那個數字是「A7 讀到的，0～1023」');
  ok(/類比對應（A7，0，359）/.test(pg),
     '★★ 中間把**換算那一塊**畫出來（不然 343 像憑空冒出來）');
  ok(/\* 359/.test(pg) && !/\* 360/.test(pg),
     '★★ 換算用 359，和積木裡那一組一致（不是 360）');
  ok(/不必自己除/.test(pg), '★ 明講「不必自己除，積木會換」（同第三節的講法）');
  ok(/i < 8/.test(pg), '★ 燈條畫 8 顆（和程式一致，原本只畫 4 顆）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
