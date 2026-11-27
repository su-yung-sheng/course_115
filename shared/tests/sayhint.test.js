/* 5016B 檢核 B「用自己的話說」：過關標準＋兩層提示（老師 2026-11-27）
   跑法：node shared/tests/sayhint.test.js   （需要 jsdom）
   ★ 老師：「文字輸入的部份能多一點提示嗎? 不然都會隨便輸入而無法通過? 標準是什麼?」 */
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
['shared/ultralab.js', 'shared/ai-guide.js', 'shared/answer.js', 'shared/labkit.js',
 'shared/doorlab.js', 'shared/lightlab.js', 'shared/fanlab.js', 'shared/mixlab.js']
  .forEach(f => new Function('window', read(f))(W));

const LABS = {
  doorlab: { M: W.DOORLAB, good: '如果程式不知道門已經開了，人沒有離開的時候，它就會一直開門。' },
  lightlab: { M: W.LIGHTLAB, good: '如果不把剛才亮的那顆關掉，燈條會變成整條都亮；可是我們想知道的是人現在在哪裡。' },
  fanlab: { M: W.FANLAB, good: '下限寫成負的，旋鈕轉到左邊時風扇會反轉；轉到正中央時風扇會停下來。' },
  mixlab: { M: W.MIXLAB, good: '顏色的數字代表的是色環上的位置，最多到 359；紅綠藍三盞燈的數字代表的是亮度。' }
};

section('① 每一節都有三層提示，而且提示裡沒有關鍵字');
Object.keys(LABS).forEach(k => {
  const { M } = LABS[k];
  const h = M.SAY.hints || [];
  ok(h.length === 3 && h.every(x => typeof x === 'string' && x.length > 10), k + '：有「先回想」「句型」「想想方向」三層提示');
  const words = [].concat(...M.SAY.need.map(g => g.any));
  const leak = [];
  h.forEach(x => words.forEach(w => { if (x.indexOf(w) >= 0) leak.push(w); }));
  ok(!leak.length, '★★ ' + k + '：提示不含任何關鍵字（不然打兩個字就過）' + (leak.length ? '：' + leak.join('、') : ''));
});

section('② 照貼提示不會過；照句型填完會過');
Object.keys(LABS).forEach(k => {
  const { M, good } = LABS[k];
  M.CASES_B.forEach((c, i) => {
    ok(M.SAY.hints.every(x => M.judgeSay(x, c).level === 'none'), k + ' 情境 ' + (i + 1) + '：把提示（含沒填的句型）貼上 → 不過');
    const r = M.judgeSay(good, c);
    ok(r.level !== 'none', '★ ' + k + ' 情境 ' + (i + 1) + '：照句型填完 → 過（' + (r.why || '').slice(0, 30) + '）');
  });
});

section('③ 畫面：寫出過關標準；答錯 n 次打開前 n 層提示');
{
  const LK = W.LABKIT, hints = ['〔測試提示一〕', '〔測試提示二〕', '〔測試提示三〕'];
  const at = n => { const d = W.document.createElement('div'); d.innerHTML = LK.sayHtml({ q: '為什麼？', hints, fails: n }); return d; };
  const d0 = at(0), d1 = at(1), d2 = at(2), d3 = at(3);
  ok(/過關標準/.test(d0.textContent) && /講中一個重點就過/.test(d0.textContent) && /8 個字/.test(d0.textContent), '輸入框上方寫出過關標準');
  ok(d0.querySelectorAll('.lk-hint.locked').length === 3 && !d0.querySelector('.lk-hint.open') && !d0.querySelector('details,button.lk-hint'), '★★ 一開始三層都鎖著，沒有可以點開的東西（老師 11-27：學生不能自己點開）');
  ok(hints.every(h => d0.innerHTML.indexOf(h) < 0), '★★ 沒解鎖的提示文字不在畫面裡（不是用 CSS 藏起來）');
  ok(d1.querySelectorAll('.lk-hint.open').length === 1 && d1.innerHTML.indexOf(hints[0]) >= 0 && d1.innerHTML.indexOf(hints[1]) < 0 && /已經試了 1 次/.test(d1.textContent), '答錯 1 次 ⇒ 只出現提示 1');
  ok(d2.querySelectorAll('.lk-hint.open').length === 2 && /提示 2/.test(d2.textContent), '答錯 2 次 ⇒ 提示 2 也打開');
  ok(d3.querySelectorAll('.lk-hint.open').length === 3 && /提示 3/.test(d3.textContent) && /想想方向/.test(d3.textContent), '答錯 3 次 ⇒ 提示 3（想想方向）也打開');
  ok(!!d2.querySelector('textarea#dl-say') && !!d2.querySelector('#dl-runB'), '   輸入框和送出鈕還在');
  const none = W.document.createElement('div'); none.innerHTML = LK.sayHtml({ q: 'x' });
  ok(!none.querySelector('.lk-hint') && /過關標準/.test(none.textContent), '   沒給提示的呼叫照樣能用');
}

section('④ 四支檢核都接上');
['doorlab', 'lightlab', 'fanlab', 'mixlab'].forEach(k => {
  const src = read('shared/' + k + '.js');
  ok(/sayFails = 0/.test(src) && /sayFails\+\+/.test(src) && /hints: saySpec\(bCase\)\.hints, fails: sayFails/.test(src),
     k + '：記答錯次數、把提示和次數交給 sayHtml');
  ok(/viewB\('⚠️ ' \+ \(res\.why \|\| ''\)/.test(src), k + '：沒過的時候說出原因（太短／抄的／還沒碰到重點）');
});

section('⑤ 第一節 B 只考感應大門，題目開頭寫出裝置名稱（老師 11-27）');
ok(W.DOORLAB.CASES_B.map(c => c.name).join() === '🚪 感應大門', '只剩感應大門');
ok(W.DOORLAB.CASES_B_ALL.every(c => c.name), '   收起來的兩組也有名稱（恢復時直接能用）');
ok(/bCase\.name/.test(read('shared/doorlab.js')), '   題目開頭顯示裝置名稱');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
