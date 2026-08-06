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
  grab(/function classFromCourseName[\s\S]*?\n\}/) + '\n' +
  'return { clsOf, noOf, classFromCourseName };'
)();
const { clsOf, noOf, classFromCourseName } = API;

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

section('從 Classroom 課名抓班級');
is(classFromCourseName('資訊科技 801'), '801', '「資訊科技 801」→ 801');
is(classFromCourseName('八年級資訊科技812'), '812', '沒空格也抓得到');
is(classFromCourseName('資訊科技 801 (上)'), '801', '後面還有字也沒問題');
is(classFromCourseName('資訊科技'), '', '★ 課名沒寫班級就不要猜 —— 猜錯會篩掉整班');
is(classFromCourseName('社會 2024'), '', '不是 8xx 的數字不算');
is(classFromCourseName(null), '', 'null 不會爆掉');

section('十二個班都認得');
const all = [];
for (let i = 1; i <= 12; i++) {
  const c = '8' + String(i).padStart(2, '0');
  const sid = '141' + String(i).padStart(2, '0') + '07';
  all.push(clsOf(sid, {}) === c && classFromCourseName('資訊科技 ' + c) === c);
}
is(all.every(Boolean), true, '801～812 的學號推算與課名比對都對');

console.log(`\n通過 ${pass}／失敗 ${fail}`);
process.exit(fail ? 1 : 0);
