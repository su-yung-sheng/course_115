/* 程式作品檔名 → 看得出是別關的作品就在選檔當下擋（2026-11-17）
   跑法：node shared/tests/sb3name.test.js
   起因：1410605 把第 2 關（2-1-1B）的檔案交到第 3 關（2-1-2），模型給 100。
   老師：「也能比照運算思維，先檢查檔名？」—— 老師發的範本檔名帶關卡代號或名稱。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const w = {}; new Function('window', 'globalThis', read('shared/sb3name.js'))(w, w);
const S = w.SB3NAME;
const unitsOf = term => { const c = {}; new Function('window', read(term + '/config.js'))(c); return c.CONFIG.UNITS; };
const U1 = unitsOf('11501'), U2 = unitsOf('11502');

section('① 11501');
const bad = (f, u) => !S.check(f, u, U1).ok;
ok(bad('2-1-1B 集合點名.sb3', '2-1-2') && S.check('2-1-1B 集合點名.sb3', '2-1-2', U1).others[0] === '2-1-1B',
   '★★★ 今天這一件：第 2 關的檔案交到第 3 關 ⇒ 擋，而且講得出是哪一關的');
ok(!bad('2-1-2 演奏小星星 (1).sb3', '2-1-2') && !bad('演奏小星星.sb3', '2-1-2') && !bad('2-1-2.sb3', '2-1-2'),
   '★★ 檔名是這一關（代號或名稱都算；瀏覽器加的「(1)」不影響）⇒ 放行');
ok(bad('Scratch 專案.sb3', '2-1-2') && bad('Scratch Project.sb3', '2-1-2') && bad('我的作品.sb3', '2-1-2')
   && S.check('我的作品.sb3', '2-1-2', U1).others.length === 0,
   '★★★ 檔名看不出是哪一關 ⇒ 也擋（老師 11-17 定案：一定要有這一關的代號或名稱）');
ok(bad('2-1-1A.sb3', '2-1-1B') && bad('2-1-1B.sb3', '2-1-1A'), '★★ 2-1-1A／2-1-1B 分得開（不會互相算到）');
ok(!bad('11501_2-1-2.sb3', '2-1-2') && !bad('２－１－２ 演奏小星星.sb3', '2-1-2') && !bad('2_1_2.sb3', '2-1-2'),
   '★ 前面有學期碼、全形、底線都認得出這一關');
ok(bad('撲克發牌.sb3', '2-2-1') && bad('動物點點名.sb3', '2-1-1B'), '★ 只有名稱沒有代號也認得（1410615 那一件：撲克牌交到第 7 關）');
ok(!bad('2-1-1B改2-1-2.sb3', '2-1-2'), '★ 檔名同時有別關和這一關 ⇒ 放行（有這一關就不擋）');
ok(S.unitsIn('2-1-21.sb3', U1).indexOf('2-1-2') < 0, '★ 「2-1-21」不算 2-1-2（代號後面不可以緊接數字）');
ok(S.check('2-1-1B.sb3', '', U1).ok, '沒有指定關卡 ⇒ 不擋');
section('② 11502（同一份規則）');
ok(!S.check('6-2-1 選擇排序法.sb3', '6-2-2', U2).ok && S.check('6-2-2 插入排序法.sb3', '6-2-2', U2).ok, '★★ 選擇／插入排序分得開');
ok(!S.check('二元搜尋法.sb3', '6-3-1', U2).ok && S.check('循序搜尋法.sb3', '6-3-1', U2).ok, '★ 循序／二元搜尋分得開');
section('③ 接進自評頁');
const g = read('shared/grader.html');
ok(/<script src="sb3name\.js"><\/script>/.test(g), '★ 自評頁載入 sb3name.js');
const pk = g.slice(g.indexOf('function pick(f)'), g.indexOf('function pick(f)') + 600);
ok(/const bad = nameMismatch\(f\.name\);\s*if\(bad\)\{ chosen=null;/.test(pk), '★★★ 選檔當下就擋（不讓他送出去白花額度）');
const gr = g.slice(g.indexOf('async function grade()'), g.indexOf('async function grade()') + 300);
ok(/nameMismatch\(chosen\.name\)/.test(gr), '★★ 選完檔案才換關卡也擋（送出前再查一次）');
ok(/window\.CONFIG && window\.CONFIG\.UNITS/.test(g), '★ 關卡清單用 config.js 的 UNITS，不另外手打');
ok(/這個檔名看不出是哪一關，先不要傳/.test(g) && /檔名要含「/.test(g), '★★ 看不出是哪一關時，告訴他檔名要怎麼改');
console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
