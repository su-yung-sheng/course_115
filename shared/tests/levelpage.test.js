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
function level(unitId, stars, tweak) {
  const html = (tweak ? tweak(levelSrc) : levelSrc)
    .replace(/<script src="[^"]*"><\/script>/g, '')
    .replace(/<script type="module">[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://x/course_115/11502/level.html?unit=' + unitId });
  const w = dom.window;
  global.document = w.document; global.window = w; global.location = w.location;
  global.sessionStorage = w.sessionStorage; global.URLSearchParams = w.URLSearchParams;
  w.CONFIG = { TERM: '11502', UNITS: UNITS, AIGUIDE: { GAS_URL: 'x', KEY: '' }, COLLECTIONS: {} };
  ['grading.js','blocks.js','derive.js','ai-guide.js','askai.js','combo.js','answer.js','quiz.js']
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

section('步驟的順序');
{
  /* ⚠️ 2026-08-10 多了「概念檢測」，變成六步。
     ★ 順序才是重點，不是步數：
       看懂 → 分析 → 確認 → **考觀念** → 動手拼 → 實作。
       概念檢測一定要在程式拼圖**之前** ——
       排在後面的話，拼對了就沒有人會回頭讀。 */
  const s = stepsOf(level('2-1-1'));
  /* ⚠️ 2026-08-10 第 1 關又多了「套餐工廠」（模組化的生活體驗），變成七步。
     ★ 但套餐只有第 1 關有 —— 每一關都放的話它就變成點擊過場。 */
  const want = ['情境解說','套餐工廠','問題分析','確認理解','概念檢測','程式拼圖','實作測試'];
  ok(s.length === want.length, '第 1 關有七步（' + s.join(' ') + '）');
  want.forEach((n, i) => ok((s[i] || '').indexOf(n) >= 0, '   第 ' + (i + 1) + ' 步是「' + n + '」'));
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
  /* ★ 文字說明和互動體驗要講同一個比喻 ——
     兩邊講不一樣的東西，等於要學生學兩次。 */
  ok(/套餐|點餐|主餐/.test(s1.why),
     '★ 「為什麼要學這個」也用速食店套餐開場（和套餐工廠同一個比喻）');
  ok(s1.why.indexOf('套餐') < s1.why.indexOf('校務行政'),
     '   而且排在校務行政系統前面 —— 從他最熟的東西開始');
}

section('闖關地圖那一頁');
ok(/level\.html\?unit=/.test(mapSrc), '卡片連到 level.html');
ok(!/grader-frame|pre-box/.test(mapSrc), '★ 上傳區與思考關卡已經搬走，不要兩邊各一份');
ok(/const tag = open \? 'a' : 'article'/.test(mapSrc), '只有開放的關卡才是連結');
ok(/window\.applyProgress/.test(levelSrc) && /applyProgress = function/.test(levelSrc),
   '★ applyProgress 要有定義 —— 只呼叫不定義的話，每一關都會停在「只開第 1 關」');
ok(/只有 ① 的話等於沒鎖/.test(mapSrc), '   註解要講明「不畫連結」不是鎖');

section('⏱️ 純閱讀的步驟要停留 30 秒');
{
  const w = level('2-1-1');
  const go = w.document.getElementById('go');
  ok(!!go, '情境解說有「往下走」的按鈕');
  ok(go.disabled === true, '★ 一進來按鈕是鎖著的 —— 沒有判定條件的步驟，按一下就過去等於沒讀');
  ok(/秒/.test(go.textContent), '   而且按鈕上看得到還要等幾秒（' + go.textContent.trim() + '）');
  const msg = w.document.getElementById('holdmsg');
  ok(msg && /離開|分頁|倒數/.test(msg.textContent),
     '★ 要先講清楚「切走會停下來」—— 規則沒說在前面，學生只會覺得被整');
  /* ★ 按不下去就是按不下去：把 disabled 的按鈕點下去不可以前進。 */
  go.dispatchEvent(new w.Event('click'));
  ok(w.document.querySelectorAll('.stp')[0].className.indexOf('stp-now') >= 0,
     '★ 硬按也不會跳到下一步');
}
ok(/HOLD_SEC = 30/.test(levelSrc), '停留 30 秒');
ok(/document\.hidden/.test(levelSrc),
   '★ 分頁不在前面就不扣秒 —— 這就是「不能離開頁面」那條規則的實作');
{
  const hold = levelSrc.slice(levelSrc.indexOf('function nextBtn'), levelSrc.indexOf('function draw'));
  ok(/暫停/.test(hold) && !/重新計時|歸零|重來/.test(hold),
     '★ 離開是「暫停」不是「重來」—— 重來的話被罰的通常是最乖的那一個');
}
ok(/function render\(\) \{\s*\n?\s*stopHold\(\)/.test(levelSrc),
   '★ render 一開始就清掉計時器 —— 不清的話倒數會愈跳愈快，而且看不出原因');
ok(/onFail:[\s\S]{0,300}held = \{\}/.test(levelSrc),
   '★ 概念檢測沒過退回第 1 步時，停留要重新算 —— 按一下就滑過去等於沒有退回');
{
  /* 有判定條件的步驟不必再加時間 —— 那是雙重處罰。 */
  const draw = levelSrc.slice(levelSrc.indexOf('function draw'));
  ok(!/BLOCKS\.mount[\s\S]{0,400}nextBtn\([^)]*true/.test(draw),
     '★ 程式拼圖不加停留 —— 它本來就要拼對才過得去');
}

section('🍔 套餐工廠只掛在第 1 關');
{
  const s2 = stepsOf(level('2-1-2', { '2-1-1': 3 }));
  ok(s2.every(x => x.indexOf('套餐工廠') < 0),
     '★ 第 2 關沒有套餐（' + s2.join(' ') + '）—— 它教的是參數，再玩一次同樣的東西只是過場');
}

/* ★ 真的讓時間走一次。
   前面那些都是「有沒有寫這段程式」，這一條測的是「它會不會動」——
   而 2026-08-10 的教訓正是：倒數看起來寫好了，實際上一秒都沒走
   （判 document.hidden，而 jsdom 的 visibilityState 預設是 'prerender'）。
   ⚠️ 症狀是「還要 30 秒」停在畫面上不動，沒有任何錯誤訊息，
      學生就永遠進不了下一步。**結構測試抓不到這種 bug。** */
(async () => {
  section('⏱️ 倒數真的會走（把 30 秒換成 2 秒跑一次）');
  const w = level('2-1-1', null, src => src.replace('HOLD_SEC = 30', 'HOLD_SEC = 2'));
  const go = () => w.document.getElementById('go');
  ok(go().disabled === true, '一開始鎖著');
  await new Promise(r => setTimeout(r, 1200));
  ok(/還要 1 秒/.test(go().textContent), '★ 一秒之後真的少一秒（' + go().textContent.trim() + '）');
  await new Promise(r => setTimeout(r, 1500));
  ok(go().disabled === false, '★ 時間到就解鎖');
  ok(!/秒/.test(go().textContent), '   而且按鈕文字要變回正常（' + go().textContent.trim() + '）');
  go().dispatchEvent(new w.Event('click'));
  const nowStep = [...w.document.querySelectorAll('.stp')]
    .find(b => b.className.indexOf('stp-now') >= 0).textContent.replace(/\s+/g, '');
  ok(nowStep.indexOf('情境解說') < 0, '★ 解鎖之後按下去真的會前進（現在在「' + nowStep + '」）');

  ok(/visibilityState === 'hidden'/.test(levelSrc),
     '★ 判 visibilityState === hidden，不要判 document.hidden ——' +
     '「沒說看得到就停」會把 prerender 這種沒預期的狀態也算成離開');
  ok(/deadline/.test(levelSrc),
     '★ 要有保險絲：不管發生什麼事最久都會解鎖 —— 擋錯人的代價遠大於少讀 30 秒');

  console.log('\n（含套餐與倒數）通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
