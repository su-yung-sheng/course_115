/* 審核頁「未評分」統計
   跑法：node shared/tests/reviewtodo.test.js

   ★ 老師 2026-10-01：「已對到作業：…能不能加一個統計未評分，以便快速了解數量，
     已給分：流程圖 0、程式 0，對應上面的資訊」
   ★ 數字一定要和卡片對得上：這裡把 needsReview 和 block() 都真的跑起來，
     逐一比對「算成未評分」⇔「卡片是藍／琥珀框、寫著點圖示看過再給分」。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const R = fs.readFileSync(path.join(ROOT, 'shared/review.html'), 'utf8');
const fn = name => (R.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')) || [''])[0];
const gw = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'shared/grading.js'), 'utf8'))(gw);

const ctx = { FLOW: [], PROG: [], GRADING: gw.GRADING, state: { cr: { on: true } }, CLASSROOM: { guessKind: () => 'video' },
              esc: s => String(s == null ? '' : s) };
vm.createContext(ctx);
vm.runInContext((R.match(/const KINDS = \{[\s\S]*?\n\};\n/) || [''])[0].replace('const KINDS', 'var KINDS')
  + (R.match(/const ATT_ICON = [^\n]*\n/) || [''])[0].replace('const ', 'var ')
  + fn('needsReview') + fn('block') + fn('link'), ctx);
ok(typeof ctx.needsReview === 'function' && typeof ctx.block === 'function', '找得到 needsReview、block');

const att = [{ link: 'L', title: 't.mp4' }];
const base = { done: true, label: '' };
const V = o => Object.assign({ atts: att, given: false, rej: null, resub: false, short: false, vstars: 3,
                               base, warn: '' }, o);
const cases = {
  '交了、還沒看':            [V({}), true],
  '交了、有疑慮（琥珀）':    [V({ warn: '附件比完成時間早' }), true],
  '退件後重交了':            [V({ rej: { reason: 'x', at: 1 }, resub: true }), true],
  '已給分':                  [V({ given: true }), false],
  '退件、等學生重交':        [V({ rej: { reason: 'x', at: 1 } }), false],
  '程式不到 3⭐（自動退件）': [V({ short: true, vstars: 2 }), false],
  '沒交':                    [V({ atts: [] }), false],
};
for (const [label, [p, want]] of Object.entries(cases)) {
  const html = ctx.block({ sid: 'S', per: { vid: p } }, 'vid');
  const card = /點圖示看過再給分/.test(html) && !/bg-rose-50/.test(html);
  ok(ctx.needsReview(p) === want && card === want, (want ? '★★ 算' : '★★ 不算') + '：' + label + '（卡片對得上）');
}
{
  const html = ctx.block({ sid: 'S', per: { vid: V({ given: true, short: true, vstars: 2 }) } }, 'vid');
  ok(/⚠️ 程式目前 2⭐，這筆是 10\/1 前給的加分/.test(html), '★★ 已加分但程式不到 3⭐ ⇒ 卡片上提醒（可以點取消收回）');
  const ok3 = ctx.block({ sid: 'S', per: { vid: V({ given: true }) } }, 'vid');
  ok(!/10\/1 前給的加分/.test(ok3), '3⭐ 的已加分不提醒');
}
ok(ctx.needsReview(null) === false, '沒有這一關（per 為空）⇒ 不算');

const sum = R.slice(R.indexOf('已給分：流程圖'), R.indexOf('Classroom 顯示已繳交'));
ok(/未評分：流程圖 <b[^>]*>\$\{todo\('img'\)\}<\/b>、程式 <b[^>]*>\$\{todo\('vid'\)\}<\/b>/.test(sum),
   '★★★ 「已給分」那一行後面接「未評分：流程圖 n、程式 n」');
ok(/state\.cr\.on \? `｜未評分/.test(sum), '★ 沒讀 Classroom 時不顯示（不然永遠是 0，看起來像都評完了）');
ok(/const todo = k => list\.filter\(s => needsReview\(s\.per\[k\]\)\)\.length;/.test(R), '★★ 只數目前這一班、這一關');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
