/* 學生總星數：闖關基地與教師端即時看板用同一個函式（GRADING.totalStars / moduleStars）
   跑法：node shared/tests/totalstars.test.js

   ⛔ 2026-11-09 老師：「教師端的『即時看板』中的星星數比登錄系統檢視狀態的星星數少？為什麼？」
      原因：即時看板只把 modules.{科}.stars 相加，漏了繳交加分（流程圖交圖片、程式交錄影各 +1⭐）。
   ⇒ 這份測試守：① 算法本身（加分、各關星數優先）② 四個頁面真的都改用它。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const w = {}; new Function('window', read('shared/grading.js'))(w);
const G = w.GRADING;

section('① 算法');
{
  const doc = { modules: {
    ethics: { stars: 12 }, thinking: { stars: 8 },
    flowchart: { stars: 10, imgUnits: { '1': 1, '2': 1, '3': 0 } },
    scratch: { stars: 4, unitStars: { a: 3, b: 3, c: 0 }, vidUnits: { a: 1 } }
  } };
  ok(G.moduleStars(doc.modules, 'flowchart') === 10 + 2 * G.BONUS.img, '★★ 流程圖：星數＋交圖片的加分（只算有交的關）');
  ok(G.moduleStars(doc.modules, 'scratch') === 6 + 1 * G.BONUS.vid, '★★ 程式設計：各關星數加總（3＋3）優先於匯總 4，再加錄影加分');
  ok(G.totalStars(doc) === 12 + 8 + (10 + 2 * G.BONUS.img) + (6 + G.BONUS.vid), '★★★ 總星數＝四科（含加分）');
  ok(G.totalStars(doc) > ['ethics', 'thinking', 'flowchart', 'scratch'].reduce((a, k) => a + (doc.modules[k].stars || 0), 0),
     '★ 比「只把 stars 相加」多（這就是即時看板以前少掉的部分）');
  ok(G.moduleStars({ scratch: { stars: 5, unitStars: {} } }, 'scratch') === 5, '★★ 各關星數是空的 ⇒ 沿用匯總值（`{}` 是 truthy 的那個坑）');
  ok(G.moduleStars({ scratch: { stars: 9, unitStars: { a: 3 } } }, 'scratch') === 3, '★ 有各關資料就以各關為準（老師扣掉一關的星要生效）');
  ok(G.totalStars({}) === 0 && G.totalStars(null) === 0, '沒有資料 ⇒ 0，不丟例外');
  ok(G.totalStars(doc, ['ethics', 'thinking', 'scratch']) === G.totalStars(doc) - G.moduleStars(doc.modules, 'flowchart'), '★ 可以指定只算哪幾科（11502 沒有流程圖）');
  ok(/GRADING\.totalStars\(d\|\|\{\}, \['ethics','thinking','scratch'\]\)/.test(read('11502/teacher.html')), '★★ 11502 即時看板不算舊資料裡的流程圖（和闖關基地一致）');
}
section('①b 匯總欄位比逐關少（2026-11-10，1410202：各科都滿、總計 114 / 120）');
{
  const all = n => Object.fromEntries([...Array(10)].map((_, i) => [n + i, 1]));
  const units = Object.fromEntries([...Array(10)].map((_, i) => ['u' + i, { star: 3 }]));
  const full = { modules: {
    ethics: { stars: 30, units }, thinking: { stars: 20, level: 10 },
    flowchart: { stars: 14, units: [...Array(10)].map((_, i) => 'f' + i), imgUnits: all('f') },   // ← 匯總只記 14
    scratch: { stars: 30, unitStars: Object.fromEntries([...Array(10)].map((_, i) => ['s' + i, 3])), vidUnits: all('s') }
  } };
  ok(G.totalStars(full) === 120, '★★★ 流程圖匯總記成 14，但 10 關都完成 ⇒ 以逐關為準，總計 120');
  ok(G.moduleStars({ ethics: { stars: 21, units } }, 'ethics') === 30, '★★ 資訊倫理：以各章最佳星數加總為準');
  ok(G.moduleStars({ thinking: { stars: 14, level: 7 } }, 'thinking', [...Array(10)].map((_, i) => ({ module: 'thinking', challenge: i + 1 }))) === 20,
     '★★ 運算思維：history 裡完成 10 題 ⇒ 20（和教師端關卡進度同一套）');
  ok(G.moduleStars({ ethics: { stars: 99, units: { a: { star: 9 } } } }, 'ethics') === 3 && G.moduleStars({ flowchart: { units: [...Array(15)].map((_, i) => i) } }, 'flowchart') === 20,
     '★ 每章最多 3、每科不超過上限（不含加分）');
  ok(G.moduleStars({ flowchart: { stars: 6, units: [] } }, 'flowchart') === 6, '沒有逐關資料 ⇒ 退回匯總欄位');
  for (const t of ['11501', '11502']) {
    const src = read(t + '/teacher.html');
    ok(/function detailStars\(data, key\)/.test(src) && (src.match(/detailStars\((studentData|student), sub\.key\)/g) || []).length >= 3,
       '★★ ' + t + ' 教師端成績表的總計、分組小計、明細都依逐關資料（detailStars）');
  }
}

section('② 四個頁面都用它');
{
  for (const t of ['11501', '11502']) {
    ok(/GRADING\.totalStars\(d\|\|\{\}(, \['ethics','thinking','scratch'\])?\)/.test(read(t + '/teacher.html')), '★★★ ' + t + ' 教師端即時看板用 GRADING.totalStars');
    ok(/GRADING\.moduleStars\(mods,\s*(id|m\.id)(,[^)]*)?\)/.test(read(t + '/hub.html')), '★★ ' + t + ' 闖關基地用 GRADING.moduleStars');
  }
}
section('③ 闖關基地實際算出來的數字＝GRADING.totalStars（即時看板）');
{
  function extractFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    let i = src.indexOf('{', start), depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
    }
  }
  const mods = {
    ethics: { stars: 15 }, thinking: { stars: 6 },
    flowchart: { stars: 12, imgUnits: { '1': 1, '4': 1 } },
    scratch: { stars: 2, unitStars: { a: 3, b: 2 }, vidUnits: { a: 1, b: 1 } }
  };
  const doc = { modules: mods };
  for (const [t, cards] of [['11501', [{ id: 'ethics' }, { id: 'thinking' }, { id: 'listprog', combines: ['flowchart', 'scratch'] }]],
                            ['11502', [{ id: 'ethics' }, { id: 'thinking' }, { id: 'scratch' }]]]) {
    const body = extractFn(read(t + '/hub.html'), 'cardData');
    const cardData = new Function('GRADING', 'return (function(){ function bonusOf(){ return 0; } ' + body + ' return cardData; })()')(G);
    const hubTotal = cards.reduce((a, m) => a + (Number(cardData(m, mods).stars) || 0), 0);
    const want = t === '11502' ? G.totalStars(doc, ['ethics', 'thinking', 'scratch']) : G.totalStars(doc);   // 11502 沒有流程圖卡：舊資料的 flowchart 兩邊都不算
    ok(hubTotal === want, '★★★ ' + t + ' 闖關基地各卡加總 ' + hubTotal + ' ＝ 即時看板 ' + want);
  }
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
