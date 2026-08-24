/* 教師端「各科關卡進度」矩陣：橫式四欄，往下列出所有關卡
   跑法：node shared/tests/matrix.test.js   （純 JS，不需要 jsdom）

   ★ 老師 2026-08-19：「點選學生後的面版排列改為橫式
     『法律倫理』『運算思維』『流程圖』『程式設計』，往下列出所有關卡，
     這樣可以一眼看出每位學生的進度狀態。」

   ⚠️ 這一支**真的把函式跑起來**，不是比對字串。
      關卡矩陣最容易錯的地方是「哪一格幾顆星」——
      字串比對看不出 2 顆和 3 顆的差別，但學生看得出來。

   ⚠️ 三個容易寫錯、而且錯了看起來很正常的地方：
      ① 各科的滿星上限不同（倫理 3／思維 2／流程圖 2+1／程式 3+1）。
         用同一個上限畫，流程圖會永遠看起來差一顆。
      ② 加分只有在「這一關真的有做」的時候才加 ——
         沒做卻有 imgUnits（交錯關卡）不可以憑空生出星星。
      ③ 運算思維沒有 units，只有 history 裡的 challenge。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/** 從 teacher.html 挖出那三支函式，接上真的 grading／content／config 跑 */
function boot(term, contentFiles, subjects) {
  const src = read(term + '/teacher.html');
  let code = '';
  ['unitColumns', 'unitStarOf', 'unitMatrixHtml'].forEach(n => {
    const i = src.indexOf('    function ' + n + '(');
    if (i < 0) throw new Error(term + ' 找不到 ' + n);
    /* 函式結尾抓「\n    }\n」——這幾支都縮排四格，結尾唯一。
       ⚠️ 抓錯範圍不會報錯，只會少半個函式，所以下面有一條長度斷言。 */
    const j = src.indexOf('\n    }\n', i);
    code += src.slice(i, j + 7) + '\n';
  });
  if (code.length < 2000) throw new Error(term + ' 挖出來的程式太短，切錯範圍了');

  const win = {};
  new Function('window', read('shared/grading.js'))(win);
  contentFiles.forEach(f => new Function('window', read(f))(win));
  new Function('window', read(term + '/config.js'))(win);

  const api = new Function('window', 'GRADING', 'QUIZ_CONTENT', 'FLOW_UNITS', 'subjects',
    code + '; return { unitColumns, unitStarOf, unitMatrixHtml };'
  )(win, win.GRADING, win.QUIZ_CONTENT, win.FLOW_UNITS, subjects);
  return { api, G: win.GRADING, CFG: win.CONFIG };
}

section('11501：四欄，每欄十關');
{
  const subjects = [{ key: 'ethics', label: '資訊倫理' }, { key: 'thinking' },
                    { key: 'flowchart' }, { key: 'scratch' }];
  const { api, G } = boot('11501', ['11501/content/ethics.js', '11501/content/flowchart.js'], subjects);
  const cols = api.unitColumns();

  ok(cols.length === 4, '四個欄位（' + cols.map(c => c.name).join('、') + '）');
  ok(cols.every(c => c.units.length === 10), '每一欄都是 10 關（' +
     cols.map(c => c.units.length).join('/') + '）');

  /* ★ 上限各不相同 —— 這一條就是「用同一個上限畫」會紅的地方 */
  const cap = {}; cols.forEach(c => cap[c.key] = c.cap);
  ok(cap.ethics === 3, '資訊倫理上限 3');
  ok(cap.thinking === 2, '運算思維上限 2（每題固定 2 顆）');
  ok(cap.flowchart === G.FLOWCHART_PER_UNIT + G.BONUS.img, '★ 流程圖上限 2＋1 加分 = ' + cap.flowchart);
  ok(cap.scratch === 3 + G.BONUS.vid, '★ 程式設計上限 3＋1 加分 = ' + cap.scratch);

  /* 資訊倫理的欄位順序：小節 → 整章 */
  const e = cols.find(c => c.key === 'ethics');
  ok(e.units[0].id === '1-1' && e.units[4].label === '整章',
     '★ 資訊倫理照課本順序（1-1…1-4、整章、3-1…3-3、整章、總整理）');

  section('11501：每一格幾顆星');
  const stu = {
    __modules: {
      ethics: { units: { '1-1': { star: 3 }, '1-2': { star: 2 } } },
      flowchart: { units: ['2-1-1A', '2-1-1B'], imgUnits: { '2-1-1A': { at: 1 }, '2-1-2': { at: 1 } } },
      scratch: { unitStars: { '2-1-1A': 3, '2-1-1B': 2 }, vidUnits: { '2-1-1A': { at: 1 }, '2-2-1': { at: 1 } } }
    },
    history: [{ module: 'thinking', challenge: 1 }, { module: 'thinking', challenge: 3 }]
  };
  const st = (k, id) => api.unitStarOf(stu, k, id);

  ok(st('ethics', '1-1') === 3, '資訊倫理 1-1 → 3');
  ok(st('ethics', '3-1') === 0, '沒做的章節 → 0');
  ok(st('flowchart', '2-1-1A') === 3, '★ 流程圖排對 2 ＋ 交圖加分 1 = 3');
  ok(st('flowchart', '2-1-1B') === 2, '   排對但沒交圖 = 2');
  ok(st('scratch', '2-1-1A') === 4, '★ 程式 3⭐ ＋ 錄影加分 1 = 4');
  ok(st('scratch', '2-1-1B') === 2, '   2⭐ 沒交錄影 = 2');

  /* ⚠️⚠️ 這兩條擋的是「加分憑空生出星星」：
     學生交錯關卡（交了 2-1-2 的圖，但那一關根本還沒排對），
     或是後端沒批改到（unitStars 沒有這一關）。
     加分是「附加」在原始分數上的，沒有原始分數就不該有加分。 */
  ok(st('flowchart', '2-1-2') === 0,
     '★★ 沒排對卻有交圖紀錄 → 還是 0（加分不會自己長出星星）');
  ok(st('scratch', '2-2-1') === 0,
     '★★ 沒批改卻有錄影紀錄 → 還是 0');

  ok(st('thinking', '1') === 2 && st('thinking', '3') === 2, '運算思維第 1、3 題 → 各 2');
  ok(st('thinking', '2') === 0, '   沒做的第 2 題 → 0');

  section('11501：畫出來的表格');
  const html = api.unitMatrixHtml(stu);
  ok((html.match(/<tr/g) || []).length === 11, '10 列 ＋ 表頭 = 11 個 <tr>');
  ok(/5 \/ 30⭐/.test(html), '資訊倫理小計 3＋2 = 5 / 30');
  ok(/5 \/ 30⭐/.test(html), '   流程圖 3＋2 = 5 / 30');
  ok(/6 \/ 40⭐/.test(html), '   程式設計 4＋2 = 6 / 40');
  ok(/4 \/ 20⭐/.test(html), '   運算思維 2＋2 = 4 / 20');
  /* ⚠️ 星條要「拿到幾顆＋空幾顆」＝ 該科上限，不是固定三顆。
     程式設計上限 4：2⭐ 沒交錄影 → ★★☆☆；流程圖上限 3：2⭐ → ★★☆ */
  ok(html.indexOf('★★☆☆') > 0, '★ 程式設計那一欄的空位補到 4 顆（★★☆☆）');
  ok(html.indexOf('★★☆<') > 0 || /★★☆[^☆]/.test(html), '   流程圖那一欄補到 3 顆（★★☆）');
}

section('11502：三欄（沒有流程圖模組）');
{
  const subjects = [{ key: 'ethics', label: '媒體與社會議題' }, { key: 'thinking' }, { key: 'scratch' }];
  const { api } = boot('11502', ['11502/content/social.js'], subjects);
  const cols = api.unitColumns();
  ok(cols.length === 3, '三個欄位（' + cols.map(c => c.name).join('、') + '）');
  ok(!cols.some(c => c.key === 'flowchart'),
     '★ 下學期沒有流程圖 —— 欄位由 subjects 決定，不是寫死四欄');
  ok(cols.every(c => c.units.length === 10), '每一欄 10 關');
  const e = cols.find(c => c.key === 'ethics');
  ok(e.name === '媒體與社會議題', '欄名跟著這學期的科目名稱走');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
