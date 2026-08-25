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
  ok(!!el.querySelector('#rg-hue'), '   ③ 是填空');

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
}

section('★ 第四節接上頁面了');
{
  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/rgblab\.js"><\/script>/.test(page), '頁面載入 rgblab');
  ok(/lab: \{ unit: 'u4', warm: 'RGBLAB', checks: null \}/.test(page),
     '★ 第四節：暖身 RGBLAB，檢核先留 null');

  const u4 = page.slice(page.indexOf('title: "情境照明'), page.indexOf('title: "智慧中樞'));
  /* ⚠️ 舊草稿寫 A1、0~1023→0~255 色相、還有一塊不存在的「色相填滿」積木。 */
  ok(!/類比 A1|0, 1023, 0, 255|色相為/.test(u4),
     '★★ 舊草稿那組（A1、0~1023→0~255、色相填滿）已經清掉');
  ok(/A7/.test(u4), '★ 腳位是 A7');
  ok(/類比對應/.test(u4), '★ 用「類比對應」這塊積木（和第三節同一塊）');
  ok(/359/.test(u4), '★★ 色環範圍是 0～359');
  /* 兩個模式都要寫出來 —— 這一節是二＋三的整合。 */
  ok(/燈號移動/.test(u4) && /混色/.test(u4), '★★ 兩種模式都寫出來（燈號移動／混色）');
  ok(/第二節/.test(u4) && /第三節/.test(u4), '★ 而且點出它接在前兩節的哪裡');
  /* ★★ 這一節的重點：RGB 混色，而且公式不解釋。 */
  ok(/不必看懂/.test(u4), '★★ 明講那三行 sin 不必看懂（老師：公式有點難，不解釋）');
  ok(/光不是顏料|越混越暗/.test(u4), '★★ 點出「光不是顏料」那個迷思');
  ok(/紅 ＋ 綠/.test(u4) && /三盞全開/.test(u4), '★ 有一張三原色混色的對照');
  ok(/沒有光/.test(u4), '   而且講清楚「黑色不是一種光，是沒有光」');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
