/* 闖關基地的登入接手：不該叫人「再登入一次」
   跑法：node shared/tests/hublogin.test.js

   ★ 2026-08-10 實際遇到的：按上一頁又要重新登入。

     原因是 sessionStorage 的學號**按學期分開存**（sid11501／sid11502），
     而 hub 只看那一格：沒有就直接畫出登入畫面。
     於是跨學期、或按上一頁回到另一個學期時，
     使用者看到的是「怎麼又要登入」—— 即使 Firebase 那邊根本沒登出。

   ★ 身分的來源是 Firebase 的 email，不是 sessionStorage。
     sessionStorage 只是「這個分頁現在是誰」的快取。
     快取沒有 ≠ 沒登入。 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const hubs = ['11501', '11502'].map(t => ({
  term: t,
  src: fs.readFileSync(path.join(__dirname, '..', '..', t, 'hub.html'), 'utf8')
}));
const auth = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');

section('兩個學期的登入流程要一致');
/* ★ 這幾樣一邊有一邊沒有的話，就會出現「上學期好好的，下學期怪怪的」——
   而那種問題最難查，因為兩邊看起來都「差不多」。 */
['onAdopt', 'attachSession', 'SAVED_KEY', 'sidFromEmail'].forEach(k => {
  ok(hubs.every(h => h.src.indexOf(k) >= 0), '   兩邊都有 ' + k);
});

section('sessionStorage 沒有學號時，不要馬上叫人登入');
hubs.forEach(h => {
  /* 找「saved 沒有」那一段，看它是不是直接跳登入。 */
  const i = h.src.indexOf('const saved = sessionStorage.getItem(SAVED_KEY)');
  const seg = h.src.slice(i, i + 1400);
  ok(i > 0, h.term + '：找得到讀 saved 的那一段');
  ok(/AUTH\.sidFromEmail/.test(seg),
     '★ ' + h.term + '：沒有 saved 時要先問 Firebase 的 email —— 那才是身分的來源');
  ok(/按上一頁|另一個學期|按學期分開存/.test(seg),
     '   ' + h.term + '：註解要講明是跨學期／上一頁才會踩到（不然看起來像多餘的分支）');
});

section('取不出學號時還是要回登入畫面');
/* 匿名登入沒有 email、老師帳號取不出學號 —— 那兩種不能硬闖進學生流程。 */
hubs.forEach(h => {
  const i = h.src.indexOf('const fromEmail');
  const seg = h.src.slice(i, i + 300);
  ok(/else \{ state\.status='login'; render\(\); \}/.test(seg),
     '   ' + h.term + '：取不出學號 → 回登入畫面（匿名／老師帳號走這條）');
});

section('sidFromEmail 本身');
ok(/sidFromEmail: sidFromEmail/.test(auth), 'auth.js 有把它匯出（hub 才叫得到）');
/* 把函式挖出來實際跑一次 —— 只讀原始碼會漏掉「它其實會回什麼」。 */
const fn = new Function('PREFIX', 'DOMAIN',
  auth.match(/function sidFromEmail[\s\S]*?\n  \}/)[0] + '\nreturn sidFromEmail;')('qfm', 'mail.qfm.kh.edu.tw');
ok(fn('qfm1410905@mail.qfm.kh.edu.tw') === '1410905', '學生帳號取得出學號');
ok(fn('suyungsheng@mail.qfm.kh.edu.tw') === '', '★ 老師帳號取不出 —— 所以老師走不進學生流程');
ok(fn('') === '', '匿名登入（沒有 email）取不出');
ok(fn('qfm1410905@gmail.com') === '', '外部網域取不出');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
