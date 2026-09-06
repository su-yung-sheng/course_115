/* 入口卡片的星數：unitStars 是空的時候不可以把匯總值蓋掉
   跑法：node shared/tests/hubstars.test.js

   ★ 為什麼有這一份（老師 2026-09-06）
     「1410500 程式設計有星星，但入口 hub.html 沒有看到，要點入才會顯示。」
     查下來是這一行：

         if (id === 'scratch' && dd.unitStars) { st = 重算; }

     `{}` 在 JavaScript 是 **truthy**。所以 unitStars 存在但**是空的、
     或每一關都是 0** 時，重算出來的 0 會把本來好好的 dd.stars 蓋掉 ——
     入口顯示 0 顆星，而內頁（flowchart.html）不走這條路，照常顯示。
     ⇒ 症狀就是「有星星但入口看不到，點進去才有」。

   ⚠️ 這一份**真的把 cardData 執行起來**，不是 grep。
      這種 bug 是「條件寫得對、但邊界值不對」——
      grep 看得到那一行存在，看不到它算錯。
   ⚠️ 兩個學期各有一份 hub.html，兩邊都要測：
      11501 的程式設計是 combines 卡（flowchart＋scratch），
      11502 是一般卡，兩條分支都踩過同一個坑。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/* 從 hub.html 把 cardData 這一支的原始碼挖出來（用大括號配對，
   不要用 regex 去猜結尾 —— 函式裡有樣板字串和巢狀括號）。 */
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('找不到 function ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error(name + ' 的大括號沒有配對');
}

function loadCardData(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const body = extractFn(src, 'cardData');
  /* bonusOf 由這裡代打：它讀 window.GRADING，那是另一支的責任，
     混進來只會讓這份測試在無關的地方紅。 */
  const factory = new Function(
    'return (function(){ function bonusOf(){ return 0; } ' + body + ' return cardData; })()'
  );
  return factory();
}

section('11501：程式設計是 combines 卡（flowchart ＋ scratch）');
{
  const cardData = loadCardData('11501/hub.html');
  const M = { id: 'listprog', combines: ['flowchart', 'scratch'] };

  // 老師 2026-09-06 回報的那一個
  const empty = cardData(M, {
    flowchart: { stars: 0 },
    scratch: { stars: 12, unitStars: {} },
  });
  ok(empty.stars === 12,
    '★★★ unitStars 是空的 {} 時要沿用 stars　←　算出 ' + empty.stars + '（應為 12）');

  const allZero = cardData(M, {
    flowchart: { stars: 0 },
    scratch: { stars: 12, unitStars: { '1': 0, '2': 0 } },
  });
  ok(allZero.stars === 12,
    '★★★ 每一關都是 0 時也要沿用 stars　←　算出 ' + allZero.stars + '（應為 12）');

  const real = cardData(M, {
    flowchart: { stars: 3 },
    scratch: { stars: 99, unitStars: { '1': 3, '2': 2 } },
  });
  ok(real.stars === 8,
    '★★ 有各關資料時以各關為準（3＋2＋流程圖 3）　←　算出 ' + real.stars + '（應為 8）');

  const noField = cardData(M, { flowchart: { stars: 1 }, scratch: { stars: 7 } });
  ok(noField.stars === 8,
    '★ 完全沒有 unitStars 時用 stars　←　算出 ' + noField.stars + '（應為 8）');

  const none = cardData(M, {});
  ok(none.stars === 0, '★ 什麼都沒有時是 0 顆，不可以炸掉');
}

section('11502：程式設計是一般卡');
{
  const cardData = loadCardData('11502/hub.html');
  const M = { id: 'scratch' };

  const empty = cardData(M, { scratch: { stars: 12, unitStars: {} } });
  ok(empty.stars === 12,
    '★★★ unitStars 是空的 {} 時要沿用 stars　←　算出 ' + empty.stars + '（應為 12）');

  const allZero = cardData(M, { scratch: { stars: 12, unitStars: { '1': 0 } } });
  ok(allZero.stars === 12,
    '★★★ 每一關都是 0 時也要沿用 stars　←　算出 ' + allZero.stars + '（應為 12）');

  const real = cardData(M, { scratch: { stars: 99, unitStars: { '1': 3, '2': 2 } } });
  ok(real.stars === 5,
    '★★ 有各關資料時以各關為準　←　算出 ' + real.stars + '（應為 5）');
}

section('★ 不可以改成「取兩者較大」');
{
  /* ⚠️ 直覺的修法是 Math.max(重算, 匯總)，但那會讓
     「老師把某一關的星數調低」永遠生效不了 —— 舊的匯總值會一直贏。
     要的是「有各關資料就以各關為準，沒有才退回匯總」。 */
  const a = loadCardData('11501/hub.html')(
    { id: 'listprog', combines: ['flowchart', 'scratch'] },
    { flowchart: {}, scratch: { stars: 20, unitStars: { '1': 1 } } });
  ok(a.stars === 1,
    '★★★ 各關算出 1 顆時就是 1 顆，不可以被舊的匯總值 20 蓋過去　←　算出 ' + a.stars);
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
