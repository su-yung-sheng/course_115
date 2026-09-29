/* 管理頁的返回鍵要回教師端，不是學生的闖關基地
   跑法：node shared/tests/teachernav.test.js

   ⛔ 2026-09-29 老師：「教師端的操作頁面『← 返回基地』會回到學生登入端，
      所有管理功能頁面都是回到管理主頁才對」—— 狀態檢查頁（status.html）
      是用學生頁的範本做的，返回鍵一路指到 {學期}/hub.html。
   ★ 這裡把「教師端連出去的每一個 shared/ 頁面」都抓出來逐一檢查，
     之後新增管理頁忘了改返回鍵，這支會紅。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');

const pages = new Set();
for (const t of ['11501', '11502']) {
  (read(t + '/teacher.html').match(/\.\.\/shared\/([a-z0-9_-]+\.html)/g) || [])
    .forEach(m => pages.add(m.replace('../shared/', '')));
}
console.log('\n── 教師端連出去的管理頁：' + [...pages].join('、') + ' ──');
ok(pages.size >= 5 && pages.has('status.html'), '找得到教師端的管理頁（含狀態檢查）');

for (const p of pages) {
  const s = strip(read('shared/' + p));
  ok(!/返回基地|返回闖關基地|data-hub|HUB_PAGE|hub\.html/.test(s),
     `★★★ ${p}：沒有「返回基地」／指到 hub.html 的返回鍵（那是學生的登入端）`);
  ok(/回教師端/.test(s) && /'\.\.\/' \+ (TERM|t) \+ '\/teacher\.html'/.test(s),
     `★★ ${p}：有「← 回教師端」，目標是 ../{學期}/teacher.html（學期不寫死）`);
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
