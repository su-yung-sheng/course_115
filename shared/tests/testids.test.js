/* 測試帳號清單：兩個檔案必須一模一樣
   跑法：node shared/tests/testids.test.js

   ★ 為什麼需要這一份
     同一份清單存在兩個地方：

       shared/semester.js    前端的學期鎖（TEST_IDS）
       shared/firestore.rules 安全規則（isTestAccount）

     安全規則沒辦法載入 JS，所以只能複製一份 —— 這是沒得選的重複。
     而**沒得選的重複，就要有東西盯著它**。

   ★ 不一致會怎樣（兩個方向都很難查）
     · 只加在 semester.js  → 前端放行，寫進 Firestore 被規則擋下。
       畫面上是「做完了但星星沒出現」，主控台一行 permission-denied，
       而學生（或你）看到的只是「它壞了」。
     · 只加在 rules       → 規則放行，但前端的學期鎖先把人導走，
       根本走不到寫入那一步。

     兩種都不會有明確的錯誤訊息，只會「怪怪的」。 */
'use strict';
const fs = require('fs');
const path = require('path');

const js = fs.readFileSync(path.join(__dirname, '..', 'semester.js'), 'utf8');
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };

/** 從一段程式碼裡把 ['a','b'] 這種清單抓出來 */
function ids(src, re) {
  const m = src.match(re);
  if (!m) return null;
  return (m[1].match(/'(\d+)'/g) || []).map(x => x.replace(/'/g, '')).sort();
}

const a = ids(js, /TEST_IDS = \[([^\]]*)\]/);
const b = ids(rules, /sid in \[([^\]]*)\]/);

ok(!!a, 'semester.js 找得到 TEST_IDS');
ok(!!b, 'firestore.rules 找得到 isTestAccount 的清單');
ok(a && b && a.join() === b.join(),
   '★ 兩邊必須一模一樣（semester.js: ' + (a || []).join('、') +
   '／rules: ' + (b || []).join('、') + '）');

/* 學號格式：auth.js 的 sidFromEmail() 只認「qfm ＋ 7 位數字」，
   而 guard.js 另外要求開頭是 14。格式不對的話，那個帳號
   **根本登不進學生流程**，加進清單也沒用。 */
(a || []).forEach(id => {
  ok(/^14\d{5}$/.test(id),
     '   ' + id + ' 的格式登得進去（guard.js 要 14 開頭、共 7 碼）');
});

/* ⚠️ 不可以留著範例值。
   1400000 是這個專案原本的佔位符 —— 它不是真的帳號，
   留著等於「以為設好了其實沒有」。 */
ok(!(a || []).includes('1400000'),
   '★ 不可以留著佔位符 1400000（那不是一個真的登得進去的帳號）');

ok((a || []).length >= 1, '至少要有一個 —— 沒有的話你沒辦法在學期外測下學期');
ok((a || []).length <= 3, '不要太多 —— 每一個都是「不受學期鎖限制」的帳號');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
