/* 一關一頁：五步驟與依序開放
   跑法：node shared/tests/levelpage.test.js   （需要 jsdom）

   ★ 這一份最重要的一條是「依序開放不能被繞過」。

     拆成兩頁之後，闖關地圖不畫連結只是**不方便**：
     學生把 level.html?unit=2-1-3 打進網址列就繞過去了。
     真正的鎖必須長在 level.html 自己身上（以及 firestore.rules）。 */
'use strict';
const fs = require('fs');
const path = require('path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

const root = path.join(__dirname, '..', '..');
const levelSrc = fs.readFileSync(path.join(root, '11502', 'level.html'), 'utf8');
const mapSrc = fs.readFileSync(path.join(root, '11502', 'scratch.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const UNITS = [['2-1-1','平行的正方形'],['2-1-2','愈畫愈大的正方形'],
               ['2-1-3','畫圖形'],['2-2-1','小鳥吃蟲'],['2-3-1','排隊比高矮']];

/** 開一次 level.html，stars 是已經拿到的星數 */
function level(unitId, stars) {
  const html = levelSrc
    .replace(/<script src="[^"]*"><\/script>/g, '')
    .replace(/<script type="module">[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://x/course_115/11502/level.html?unit=' + unitId });
  const w = dom.window;
  global.document = w.document; global.window = w; global.location = w.location;
  global.sessionStorage = w.sessionStorage; global.URLSearchParams = w.URLSearchParams;
  w.CONFIG = { TERM: '11502', UNITS: UNITS, AIGUIDE: { GAS_URL: 'x', KEY: '' }, COLLECTIONS: {} };
  ['grading.js','blocks.js','derive.js','ai-guide.js','askai.js']
    .forEach(f => new Function('window', fs.readFileSync(path.join(root, 'shared', f), 'utf8'))(w));
  new Function('window', fs.readFileSync(path.join(root, '11502', 'content', 'blocks.js'), 'utf8'))(w);
  const code = html.match(/<script>\n(const \$[\s\S]*?)<\/script>/)[1];
  w.eval(code);
  if (stars) w.applyProgress(stars, {});   // 走真正的入口，不要偷改內部變數
  return w;
}
const stepsOf = w => [...w.document.querySelectorAll('.stp')].map(b => b.textContent.replace(/\s+/g, ''));
const text = w => w.document.getElementById('app').textContent.replace(/\s+/g, ' ');

section('★ 依序開放：直接打網址也要擋得住');
ok(/function unitOpen/.test(levelSrc), 'level.html 自己有 unitOpen()');
ok(/GRADING/.test(levelSrc), '   而且用的是共用的 GRADING 規則，不是自己另寫一套');
{
  const w = level('2-1-3');   // 第 3 關，前面都沒過
  ok(/這一關還沒開/.test(text(w)), '★ 沒過前一關 → 擋下（這是拆成兩頁之後最容易破的地方）');
  ok(stepsOf(w).length === 0, '   而且不畫出任何步驟');
}
{
  const w = level('2-1-1');
  ok(!/這一關還沒開/.test(text(w)), '第 1 關本來就開著');
}
{
  const w = level('2-1-2', { '2-1-1': 3 });
  ok(!/這一關還沒開/.test(text(w)), '★ 前一關拿到星數之後，第 2 關就開了');
}
{
  const w = level('沒有這一關');
  ok(/找不到這一關/.test(text(w)), '亂打 unit → 講清楚，不要白畫面');
}

section('五個步驟');
{
  const s = stepsOf(level('2-1-1'));
  ok(s.length === 5, '第 1 關有五步（' + s.join(' ') + '）');
  ['情境解說','問題分析','確認理解','程式拼圖','實作測試']
    .forEach((n, i) => ok((s[i] || '').indexOf(n) >= 0, '   第 ' + (i + 1) + ' 步是「' + n + '」'));
}
{
  /* ⚠️ 沒有資料的步驟要直接不出現，不要留一個空殼 ——
     第 5 關（排隊比高矮）課本用的是圖解，本來就沒有拼圖。 */
  const s = stepsOf(level('2-3-1', { '2-1-1':3,'2-1-2':3,'2-1-3':3,'2-2-1':3 }));
  ok(s.every(x => x.indexOf('程式拼圖') < 0), '★ 沒有 goal 的關卡不放拼圖那一步');
  ok(s.some(x => x.indexOf('實作測試') >= 0), '   但實作測試一定有');
}
{
  /* 沒有任何思考關卡資料的關（第 4 關）不能變成一片空白 */
  const s = stepsOf(level('2-2-1', { '2-1-1':3,'2-1-2':3,'2-1-3':3 }));
  ok(s.length >= 2, '★ 沒有題目的關卡至少要有「情境 → 實作測試」（' + s.join(' ') + '）');
}

section('步驟之間不能亂跳');
{
  const w = level('2-1-1');
  const btns = [...w.document.querySelectorAll('.stp')];
  ok(btns[0].className.indexOf('stp-now') >= 0, '一進來停在第 1 步');
  ok(btns[2].disabled === true, '★ 還沒走到的步驟按不下去 —— 不然學生會跳過分析直接拼');
  /* ⚠️ 下一步也是鎖著的 —— 要按「看懂了，開始分析」那顆按鈕才會前進。
     這是刻意的：步驟列是進度指示，不是快速選單。 */
  ok(btns[1].disabled === true, '   下一步也要按過按鈕才開（步驟列不是快速選單）');
}

section('情境解說的內容');
{
  const x = {};
  new Function('window', fs.readFileSync(path.join(root, '11502', 'content', 'blocks.js'), 'utf8'))(x);
  ['2-1-1','2-1-2','2-1-3'].forEach(id => {
    const sc = x.BLOCK_LEVELS[id].scene;
    ok(!!sc, id + ' 有情境');
    ok(sc && sc.why && sc.why.length > 40, '   ' + id + ' 講得出「為什麼要學這個」');
    ok(sc && (sc.shots || []).length >= 3, '   ' + id + ' 有畫面描述（先看懂目標再分析）');
  });
  /* ⚠️ 情境不可以把答案講出來 —— 它要讓人看懂目標，不是看到解法。 */
  const s1 = x.BLOCK_LEVELS['2-1-1'].scene;
  ok(!/右轉 90|重複 4 次|移動 30/.test(JSON.stringify(s1)),
     '★ 第 1 關的情境沒有洩漏積木答案');
}

section('闖關地圖那一頁');
ok(/level\.html\?unit=/.test(mapSrc), '卡片連到 level.html');
ok(!/grader-frame|pre-box/.test(mapSrc), '★ 上傳區與思考關卡已經搬走，不要兩邊各一份');
ok(/const tag = open \? 'a' : 'article'/.test(mapSrc), '只有開放的關卡才是連結');
ok(/window\.applyProgress/.test(levelSrc) && /applyProgress = function/.test(levelSrc),
   '★ applyProgress 要有定義 —— 只呼叫不定義的話，每一關都會停在「只開第 1 關」');
ok(/只有 ① 的話等於沒鎖/.test(mapSrc), '   註解要講明「不畫連結」不是鎖');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
