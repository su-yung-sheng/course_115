/* 手動排序挑戰的規則
   跑法：node shared/tests/sortlab.test.js

   ★ 這一份最重要的一條：選擇排序法要和課本一致（兩個清單），
     不是原地交換。同一個名字兩種做法，學生只會覺得自己記錯。 */
'use strict';
const fs = require('fs');
const path = require('path');
const W = {};
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8'))(W);
const S = W.SORTLAB;

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : (fail++, console.log('  ✗ ' + l)); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), l + '（得到 ' + JSON.stringify(a) + '）');

/* ── 選擇排序：課本版（未排序 → 已排序）───────────── */
eq(S._bestOf([5, 2, 8, 1], 'asc'), [3], '由小到大找最小');
eq(S._bestOf([5, 2, 8, 1], 'desc'), [2], '由大到小找最大');
eq(S._bestOf([3, 1, 1, 4], 'asc'), [1, 2], '★ 並列的都算對 —— 只認第一個會判錯另一半學生');
ok(S._checkSelection([5, 2, 8], 1, 'asc').ok, '點最小的 → 對');
ok(!S._checkSelection([5, 2, 8], 0, 'asc').ok, '點 5 → 錯');
ok(/更小/.test(S._checkSelection([5, 2, 8], 0, 'asc').msg), '講「還有更小的」');
ok(/更大/.test(S._checkSelection([5, 2, 8], 1, 'desc').msg), '由大到小要講「更大的」');
ok(!/第 \d|位置|索引/.test(S._checkSelection([5, 2, 8], 0, 'asc').msg),
   '★ 不洩漏正確位置 —— 講了下一回合他照樣不會找');

/* ★ 版本一致性：這裡不能有「和邊界那一格對調」那種原地交換的痕跡 */
const src = fs.readFileSync(path.join(__dirname, '..', 'sortlab.js'), 'utf8');
ok(/加到「已排序」的最後一項/.test(src), '★ 選擇排序照課本：加到已排序的最後一項');
ok(/從「未排序」刪掉|從未排序數列裡刪掉/.test(src), '★ 並且從未排序刪掉');
ok(/未排序/.test(S.INFO.selection.why) && /已排序/.test(S.INFO.selection.why),
   '說明文字也是兩個清單的講法');

/* ── 氣泡：只能換相鄰 ─────────────────────────────── */
ok(S._checkBubble(1, 2).ok, '相鄰 → 可以換');
ok(S._checkBubble(2, 1).ok, '反過來點也一樣');
ok(!S._checkBubble(0, 2).ok, '隔一個 → 不行');
ok(/相鄰/.test(S._checkBubble(0, 3).msg), '要講清楚是「只能相鄰」');
ok(!S._checkBubble(1, 1).ok, '點同一個兩次不算');

/* ── 插入：插到對的位置 ───────────────────────────── */
//  已排好 [20, 50]，新牌 30 → 只有插在中間（pos=1）才對
const a = [20, 50, 30];
ok(!S._checkInsertion(a, 2, 0, 'asc').ok, '30 插在 20 前面 → 錯');
ok(S._checkInsertion(a, 2, 1, 'asc').ok, '30 插在 20 與 50 之間 → 對');
ok(!S._checkInsertion(a, 2, 2, 'asc').ok, '30 插在 50 後面 → 錯');
ok(/20/.test(S._checkInsertion(a, 2, 0, 'asc').msg), '錯的時候要指出是跟誰比出問題');
ok(!S._checkInsertion(a, 2, 3, 'asc').ok, '★ 不能插到還沒排序的那一段去');
eq(S._doInsert([20, 50, 30], 2, 1), [20, 30, 50], '插進去之後的排列');
//  邊界情況：最小的新牌要插最前面
ok(S._checkInsertion([20, 50, 10], 2, 0, 'asc').ok, '最小的新牌插最前面 → 對');
//  由大到小
ok(S._checkInsertion([50, 20, 30], 2, 1, 'desc').ok, '由大到小時 30 插在 50 與 20 之間 → 對');

/* ── 出題 ─────────────────────────────────────────── */
ok(S._sorted([1, 2, 3], 'asc'), '判得出已經排好');
ok(!S._sorted([1, 3, 2], 'asc'), '判得出還沒排好');
ok(S._sorted([3, 2, 1], 'desc'), '由大到小也判得出來');
for (let i = 0; i < 40; i++) {
  const it = S._makeItems(6, 'asc');
  ok(it.length === 6 && new Set(it).size === 6 && !S._sorted(it, 'asc'),
     '★ 出的題目：六個不重複、而且一開始不是排好的（第 ' + (i + 1) + ' 次）');
  if (fail) break;
}

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
