/* 闖關基地的「累積總星數」分母（11501／11502 hub.html）
   跑法：node shared/tests/hubmax.test.js

   ⛔ 老師 2026-11-04：「上學期的星星總數是不是有誤？」
      11501 的 summary() 寫 (m.maxStars||3)：智慧家居機電專題是 maxStars:0（不計星），
      0 被 || 當成「沒寫」換成 3 ⇒ 分母 123，全拿滿也只有 120/123。
      11502 早在 2026-08-11 就踩過（90/102）並改成 Number(m.maxStars)||0，11501 漏改。
   守的是：兩學期的分母都 ＝ 各卡片 maxStars 的總和 ＝ 教師端的上限總和。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

global.window = {};
require(path.join(ROOT, 'shared', 'grading.js'));
const G = global.window.GRADING;

for (const term of ['11501', '11502']) {
  section(term);
  const H = fs.readFileSync(path.join(ROOT, term, 'hub.html'), 'utf8');
  const sum = H.slice(H.indexOf('function summary('), H.indexOf('function summary(') + 2000)
    .replace(/\/\*[\s\S]*?\*\//g, '');          // 註解裡會提到舊寫法，先拿掉
  ok(/maxTotal\s*\+=\s*\(Number\(m\.maxStars\)\s*\|\|\s*0\)/.test(sum) && !/maxStars\s*\|\|\s*3\)/.test(sum.split('return')[0]),
     '★★★ 分母用 Number(m.maxStars)||0 —— 寫 0 的卡片（不計星）不可以被當成 3');
  const cards = [...H.matchAll(/\{ id:'([a-z]+)'.*?maxStars:\s*([^,}\s]+)/g)].map(m => [m[1], m[2]]);
  ok(cards.length >= 4, '找得到 ' + cards.length + ' 張卡片的 maxStars：' + cards.map(c => c.join('=')).join('、'));
  ok(cards.some(c => c[0] === 'arduino' && c[1] === '0'), '★ 延伸專題卡寫的是 maxStars:0（不計星）');
}

section('11501 分母 ＝ 教師端上限總和 ＝ 120');
{
  const H = fs.readFileSync(path.join(ROOT, '11501', 'hub.html'), 'utf8');
  const hubTotal = [...H.matchAll(/\{ id:'([a-z]+)'.*?maxStars:\s*(\d+)/g)].reduce((a, m) => a + Number(m[2]), 0);
  const mm = G.moduleMax(10);
  const teacherTotal = 30 + 20 + mm.flowchart + mm.scratch;      // teacher.html 的 MODULE_MAX
  ok(hubTotal === 120 && teacherTotal === 120,
     '★★★ 學生端分母 ' + hubTotal + '、教師端上限總和 ' + teacherTotal + '（資訊倫理 30＋運算思維 20＋流程圖 ' + mm.flowchart + '＋程式 ' + mm.scratch + '）');
  const T = fs.readFileSync(path.join(ROOT, '11501', 'teacher.html'), 'utf8');
  ok(/\{ ethics: 30, thinking: 20 \}/.test(T), '教師端 MODULE_MAX 的資訊倫理 30、運算思維 20 和卡片一致');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
