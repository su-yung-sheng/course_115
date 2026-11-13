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

section('④ 剩下讀星數的地方也都用同一套（2026-11-10 老師：「目前的星星計算都是同一套統計程式了嗎？」）');
{
  const mods = {
    ethics: { stars: 2, units: { '1-1': { star: 3 }, '1-2': { star: 2 }, '2-1': { star: 0 } } },
    thinking: { stars: 0 },
    flowchart: { stars: 2, units: ['1', '2', '3'], imgUnits: { '2': 1 } },
    scratch: { stars: 0, unitStars: { a: 3, b: 2, c: 0 }, vidUnits: { b: 1, c: 1 } }
  };
  const hist = [{ module: 'thinking', challenge: 1 }, { module: 'thinking', challenge: 3 }, { module: 'flowchart', unit: '1' }];
  const sum = (k, ids) => ids.reduce((a, id) => a + G.unitStar(mods, k, id, hist), 0);
  ok(sum('ethics', ['1-1', '1-2', '2-1']) === G.moduleStars(mods, 'ethics', hist), '★★ 資訊倫理：各章加總＝科目合計');
  ok(sum('thinking', [1, 2, 3, 4]) === G.moduleStars(mods, 'thinking', hist), '★★ 運算思維：各題加總＝科目合計');
  ok(sum('flowchart', ['1', '2', '3', '4']) === G.moduleStars(mods, 'flowchart', hist), '★★ 流程圖（含交圖片加分）：各關加總＝科目合計');
  ok(sum('scratch', ['a', 'b', 'c']) === G.moduleStars(mods, 'scratch', hist), '★★ 程式設計（含錄影加分；0 星的關有錄影紀錄也不加，和逐關表一致）：各關加總＝科目合計');
  ok(G.moduleStars({ flowchart: { units: ['1'], imgUnits: { '1': 1, '9': 1 } } }, 'flowchart') === 2 + G.BONUS.img,
     '★★ 交錯關的流程圖加分（第 9 關還沒排對）不算進總計 —— 加分不會自己長出星星');
  ok(G.unitStar({}, 'ethics', 'x') === 0 && G.unitStar(null, 'scratch', 'x') === 0 && G.unitStar(mods, 'nope', 'x') === 0, '沒有資料 ⇒ 0，不丟例外');

  for (const t of ['11501', '11502']) {
    const src = read(t + '/teacher.html');
    ok(/function unitStarOf\(student, key, unitId\) \{[\s\S]{0,200}GRADING\.unitStar\(student\.__modules \|\| \{\}, key, unitId, student\.history \|\| \[\]\)/.test(src),
       '★★ ' + t + ' 教師端「各科關卡進度」改呼叫 GRADING.unitStar');
  }
  ok(/GRADING\.moduleStars\(m, k, p\.data\(\)\.history/.test(read('11501/teacher.html')), '★ 11501 清進度的確認視窗：星數用 moduleStars');
  ok(/GRADING\.moduleStars\(one, C\.moduleId\)/.test(read('shared/quiz-engine.js')), '★★ 資訊倫理章節頁「累積 ⭐」用 moduleStars');
  const rv = read('shared/review.html');
  ok(/moduleStars\(p\.modules \|\| \{\}, 'flowchart'/.test(rv) && /moduleStars\(p\.modules \|\| \{\}, 'scratch'/.test(rv), '★★ 作品回顧頁的流程圖／程式星數用 moduleStars');
  const fc = read('11501/flowchart.html'), fu = fc.slice(fc.indexOf('async function finishUnit'), fc.indexOf('async function finishUnit') + 2000);
  ok(fu.indexOf('getDoc(') > 0 && fu.indexOf('getDoc(') < fu.indexOf('const count') && fu.indexOf('const count') < fu.indexOf('setDoc('),
     '★★★ 流程圖頁寫合計前，先讀資料庫已完成的關卡再數（不再只數這台電腦記得的）');
}

section('⑤ 全部關卡通關（2026-11-12 老師：滿星以外，全通關也要註明、但低調一點）');
{
  const mods = {
    ethics: { units: { '1-1': { star: 1 }, '1-2': { star: 0 } } },
    flowchart: { units: ['a'] },
    scratch: { unitStars: { a: 2, b: 1 }, play: { '6-1-1': 1 } }
  };
  const hist = [{ module: 'thinking', challenge: 2 }];
  ok(G.unitCleared(mods, 'ethics', '1-1') === true && G.unitCleared(mods, 'ethics', '1-2') === false, '★★ 資訊倫理：≥1★ 才算通關');
  ok(G.unitCleared(mods, 'thinking', '2', hist) === true && G.unitCleared(mods, 'thinking', '3', hist) === false, '運算思維：完成就算');
  ok(G.unitCleared(mods, 'flowchart', 'a') === true && G.unitCleared(mods, 'flowchart', 'b') === false, '流程圖：排對就算');
  ok(G.unitCleared(mods, 'scratch', 'a') === true && G.unitCleared(mods, 'scratch', 'b') === false,
     '★★ 程式設計：要到 ' + G.GATE.PASS_STARS + '★（和能不能進下一關同一條線），1★ 不算');
  ok(G.unitCleared(mods, 'scratch', '6-1-1') === true && G.unitCleared({ scratch: {} }, 'scratch', '6-3-3') === false,
     '★★ 不用交作品的關：看實作體驗做完沒（不然永遠全通關不了）');
  ok(G.unitCleared({}, 'ethics', 'x') === false && G.unitCleared(null, 'scratch', 'a') === false, '沒有資料 ⇒ 沒通關，不丟例外');
  for (const t of ['11501', '11502']) {
    const src = read(t + '/teacher.html');
    ok(/let isAllClear = !isMaxStars && allClearedOf\(student\)/.test(src) && /GRADING\.unitCleared\(st\.__modules/.test(src) && /✓全通關/.test(src),
       '★★ ' + t + ' 教師端卡片：全通關（未滿星）有綠框＋✓全通關，用 GRADING.unitCleared 逐關判斷');
    ok(/displaySubjects\.some\(s => s\.key === c\.key\)/.test(src), '★ ' + t + ' 只看目前篩選的科目（和星數分母一致）');
  }
}

section('⑥ 運算思維兩學期寫法不同、證書有但統一進度少一筆（2026-11-13 老師：1411007）');
{
  // 11502 走 REPORT.unit：history {unit} ＋ modules.thinking.units
  const m2 = { thinking: { level: 2, units: { '1': { star: 2 }, '3': { star: 2 } } } };
  const h2 = [{ module: 'thinking', unit: '1', stars: 2 }, { module: 'thinking', unit: '3', stars: 2 }];
  ok(G.unitStar(m2, 'thinking', '1', h2) === 2 && G.unitStar(m2, 'thinking', '3', []) === 2 && G.unitStar(m2, 'thinking', '2', h2) === 0,
     '★★ 11502（history.unit／units）的逐題星數認得出來');
  ok(G.moduleStars(m2, 'thinking', h2) === 4, '★ 同一題在 history 和 units 都有，只算一次');
  ok(G.unitStar({ thinking: {} }, 'thinking', '4', [{ module: 'thinking', challenge: 4 }]) === 2, '11501（history.challenge）照舊');
  const t1 = read('11501/thinking.html');
  ok(/backfill\.push\(\{ module: 'thinking', challenge: n, at: dayOf\(/.test(t1) && /history: fbStore\.arrayUnion\(\.\.\.backfill\)/.test(t1),
     '★★★ 11501 運算思維頁：登入時把「證書有、統一進度 history 沒有」的題目補一筆（日期用通關日）');
  ok(/const have = new Set\(hist\.filter\(h => h && h\.module === 'thinking'\)/.test(t1), '★ 只補 history 沒有的（不重複加）');
  const t2 = read('11502/thinking.html');
  ok(/REPORT\.unit\('thinking', String\(n\), \{ star: GRADING\.thinkingStars\(1\), score: 100, extra: \{ backfill: true \} \}\)/.test(t2)
     && /backfillDone\.current = true;\s*const ids/.test(t2),
     '★★ 11502 運算思維頁：同樣補記，走 REPORT.unit；一登入就鎖上，不和之後的通關同時寫');
  // dayOf 的日期解析
  const m = t1.match(/const dayOf = \(s\) => \{[\s\S]*?\n\s*\};/);
  const dayOf = new Function('return ' + m[0].replace(/^const dayOf = /, '').replace(/;$/, ''))();
  const d = new Date(dayOf('2026年9月11日 星期五'));
  ok(d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() === 11, '★ 「2026年9月11日 星期五」解析成 9/11');
  ok(new Date(dayOf('2026-09-03')).getDate() === 3 && Math.abs(dayOf('') - Date.now()) < 5000, '「2026-09-03」也認得；沒有日期 ⇒ 今天');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
