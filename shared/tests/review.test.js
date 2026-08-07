/* =====================================================================
   shared/review.html 的班級處理
   ---------------------------------------------------------------------
       node shared/tests/review.test.js

   只測純函式（班級／座號怎麼算、課名怎麼抓班級）。
   ★ 這幾支最容易出的錯是「欄位名寫錯」—— 名冊存的是 cls／no，
     寫成 class／seat 不會報錯，只會讓那一欄永遠空白。
     這種錯眼睛看不出來，要靠測試盯。
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.resolve(__dirname, '..', 'review.html'), 'utf8');
const grab = re => s.match(re)[0];
const API = new Function(
  grab(/function clsOf[\s\S]*?\n\}/) + '\n' +
  grab(/function noOf[\s\S]*?\n\}/) + '\n' +
  'return { clsOf, noOf };'
)();
const { clsOf, noOf } = API;
// classFromCourseName 已經搬到 shared/classroom.js（兩邊都用得到），
// 它的測試在 classroom.test.js

let pass = 0, fail = 0;
const is = (g, w, l) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `　期望 ${JSON.stringify(w)} 實得 ${JSON.stringify(g)}`));
};
const section = t => console.log('\n── ' + t + ' ──');

section('名冊的欄位是 cls／no（不是 class／seat）');
is(clsOf('1410112', { cls: '801', no: '12' }), '801', '名冊有填就用名冊的');
is(noOf('1410112', { cls: '801', no: '12' }), '12', '座號同理');
is(clsOf('1410112', { class: '999', seat: '99' }), '801',
   '★ 寫成 class／seat 的舊欄位不會被誤用（會退回從學號推算）');

section('名冊沒填時從學號推算（1410112 → 801 12 號）');
is(clsOf('1410112', {}), '801', '後四碼 0112 → 班級 801');
is(noOf('1410112', {}), '12', '後兩碼 → 座號 12');
is(clsOf('1411235', {}), '812', '1411235 → 812 班');
is(noOf('1411235', {}), '35', '→ 35 號');
is(clsOf('', {}), '', '學號是空的就不要亂猜');

section('十二個班都認得');
const all = [];
for (let i = 1; i <= 12; i++) {
  const c = '8' + String(i).padStart(2, '0');
  const sid = '141' + String(i).padStart(2, '0') + '07';
  all.push(clsOf(sid, {}) === c);
}
is(all.every(Boolean), true, '801～812 的學號推算都對');

section('學生寫的想法');
/* ── 學生寫的想法（動手之前那一步）─────────────────
   這不是成績，是下一節課的討論素材。所以：看得到、但沒有加分按鈕。 */
{
  const h = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'review.html'), 'utf8');
  is(/modules \|\| \{\}\)\.scratch \|\| \{\}\)\.notes/.test(h), true, '從 modules.scratch.notes 讀出來');
  is(/unitIdOf\('vid'\)/.test(h), true, '照目前選的關卡取，不是整包倒出來');
  is(/他寫的想法/.test(h), true, '卡片上看得到');
  is(/<details/.test(h.slice(Math.max(0, h.indexOf('他寫的想法') - 300))), true, '預設收起來，不然卡片會被長文撐爛');
  is(/whitespace-pre-wrap/.test(h), true, '學生打的換行要留著');
  is(!/data-award[^>]*note|note[^>]*data-award/.test(h), true, '★ 想法旁邊沒有加分按鈕（這不是成績）');
  is(/esc\(s\.note\)/.test(h), true, '★ 學生打的字要跳脫 —— 不然打 <script> 就出事了');
}

console.log(`\n通過 ${pass}／失敗 ${fail}`);
process.exit(fail ? 1 : 0);

