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
  ['grading.js','readhold.js','blocks.js','derive.js','ai-guide.js','askai.js','combo.js','answer.js','quiz.js']
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
  /* ⚠️ 2026-08-10 第 1 關多了「套餐工廠」，同一天「確認理解」併回問題分析
     （圈選題和寫作題本來就是那一段的一部分，搬到另一頁等於把一件事切兩半）。 */
  const want = ['情境解說','套餐工廠','問題分析','概念檢測','程式拼圖','實作測試'];
  ok(s.length === want.length, '第 1 關有六步（' + s.join(' ') + '）');
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

/* ── 🖍️ 情境解說的螢光筆 ─────────────────────────
   ★ 為什麼要畫
     情境是一段純文字，而學生讀純文字時眼睛是滑過去的。
     畫起來的那一句，是「這一關真正在講的事」。
   ⚠️ 一段最多兩三處。畫太多等於沒畫 ——
      學生會直接略過所有黃色的東西。
   ⚠️ 不可以畫在答案上（例如「右轉 90 度」），那等於把解法圈給他看。 */
section('🖍️ 情境解說的重點提示');
{
  const x = {};
  new Function('window', fs.readFileSync(path.join(root, '11502', 'content', 'blocks.js'), 'utf8'))(x);
  const count = t => (String(t).match(/class="hl"/g) || []).length;
  ['2-1-1','2-1-2','2-1-3'].forEach(id => {
    const sc = x.BLOCK_LEVELS[id].scene;
    const n = count(sc.why) + count(JSON.stringify(sc.shots || []));
    ok(n >= 1, id + ' 的情境有畫重點（' + n + ' 處）');
    ok(n <= 4, '   ' + id + ' 沒有畫太多（' + n + ' 處）—— 畫太多等於沒畫');
    /* 螢光筆裡面不可以是積木答案 */
    const marked = (sc.why + JSON.stringify(sc.shots || []))
      .match(/class="hl">([^<]*)</g) || [];
    ok(!marked.some(m => /右轉 90|重複 4 次|移動 30 點|移動 60 點/.test(m)),
       '   ★ ' + id + ' 沒有把積木答案圈起來');
  });
}
{
  /* ★ 樣式只能有一份。兩份會慢慢長得不一樣，而且沒有人會發現是哪一天開始的。 */
  const theme = fs.readFileSync(path.join(root, 'shared', 'theme.css'), 'utf8');
  ok(/\.hl\s*\{/.test(theme), '螢光筆的樣式在 shared/theme.css');
  ok(!/^\s*\.hl\{/m.test(levelSrc), '★ 關卡頁不要再自己寫一份 .hl');
  ok(/theme\.css/.test(levelSrc), '   而且關卡頁真的載了 theme.css');
}

/* ── ★ 08 範本的規矩，每一關都要守 ─────────────────
   （見 shared/docs/08_關卡製作範本.md）

   ⚠️ 2026-08-11 之前這一段只檢查 2-1-1。
      結果是：2-1-2 的八問裡有七問沒有選擇題（貼提示就通關）、
      六問連 keys 都沒有（AI 引導掛不上去）、
      收尾的寫作題沒有 keys（只剩字數，亂打十五個字就過）——
      **測試全綠**，因為它只看範本那一關。
      範本守得再好，沒有人照著做也沒有用。

   ★ 「上線中」的定義：有 scene ＋ quiz ＋ goal 三樣。
     這不是名單，是資料自己說了算 —— 新關卡一寫完就自動被納入檢查，
     不必記得回來加名字（會忘的那一步就是漏洞會長出來的地方）。
     還在寫的關卡（例如 2-3-1 只有 analysis）印一行提醒，不算失敗。 */
section('★ 08 範本的規矩：每一關都要守');
{
  const x = {};
  new Function('window', fs.readFileSync(path.join(root, '11502', 'content', 'blocks.js'), 'utf8'))(x);
  const ALL = x.BLOCK_LEVELS;
  const live = Object.keys(ALL).filter(id => ALL[id].scene && ALL[id].quiz && ALL[id].goal);
  const wip = Object.keys(ALL).filter(id => live.indexOf(id) < 0);

  ok(live.indexOf('2-1-1') >= 0 && live.indexOf('2-1-2') >= 0,
     '上線中的關卡：' + live.join('、'));
  if (wip.length) console.log('     （還在寫，先不檢查：' + wip.join('、') + '）');

  ok(ALL['2-1-1'].combo === true, '第 1 關開著套餐工廠');

  const len = t => String(t).replace(/[\s，。、？！]/g, '').length;
  const bad = { keys: [], hint: [], ask: [], pick: [], opt: [], len: [] };

  live.forEach(id => {
    const a = ALL[id].analysis;
    if (!a) return;                       // 2-1-3 課本用推導，本來就沒有問題分析
    a.qs.forEach((q, i) => {
      const at = id + ' 第' + (i + 1) + '問';
      /* ★ 每一問都要有 keys —— 沒有的話「問問看」掛不上去，
         因為 AI 不知道要往哪個方向引導。 */
      if (!(q.keys || []).length) bad.keys.push(at);
      if (!q.hint || q.hint.length <= 10) bad.hint.push(at);
      /* ★ 要嘛有圈選題，要嘛有 3 題以上可以抽。
         都沒有就退回「寫一句」，而那**擋不住把提示貼上來**。 */
      if (!q.pick && (q.asks || []).length < 3) bad.ask.push(at);
      (q.asks || []).forEach((k, j) => {
        const w = at + '第' + (j + 1) + '題';
        if (k.options.length !== 4 || !k.why) bad.opt.push(w);
        /* ★ 選項的**長度**不可以出賣答案。
           ⚠️ 第一版每一題的正解都是描述最詳細、字最多的那一個 ——
              學生用「選最長的」就能過關，那和瞎猜沒差多少，
              而且他學到的是「猜題技巧」不是這一關的概念。
           ⇒ 兩條：四個選項字數差 ≤ 4；正解不可以比別人長 2 字以上。
           ⚠️ 這只擋得住「最明顯的那種洩題」。真正要靠的還是
              「錯的選項要是像樣的誤解」—— 那沒辦法自動測，只能自己念一遍。 */
        const L = k.options.map(len);
        const spread = Math.max(...L) - Math.min(...L);
        const lead = L[k.answer] - Math.max(...L.filter((_, y) => y !== k.answer));
        if (spread > 4) bad.len.push(w + ' 字數差 ' + spread);
        if (lead >= 2) bad.len.push(w + ' 正解長 ' + lead + ' 字');
      });
    });
    /* ⚠️ 一整關只放一題圈選 —— 每一問都要圈會變成問卷。 */
    if (a.qs.filter(q => q.pick).length !== 1) bad.pick.push(id);
  });

  const say = (arr, label) => ok(arr.length === 0, label + (arr.length ? '　←　' + arr.join('、') : ''));
  say(bad.keys, '★ 每一問都有 keys（沒有的話 AI 引導掛不上去）');
  say(bad.hint, '   每一問都有提示');
  say(bad.ask, '★ 每一問有圈選題或 3 題以上可以抽 —— 都沒有就退回「寫一句」，而那擋不住貼提示');
  say(bad.pick, '★ 一整關只放一題圈選');
  say(bad.opt, '   每題判斷題四個選項，而且說得出「為什麼是它」');
  say(bad.len, '★ 選項長度不出賣答案（字數差 ≤4、正解沒有明顯較長）');

  /* 收尾的寫作題。⚠️ 沒有 keys 的話它只剩字數，亂打十五個字就通關。 */
  live.forEach(id => {
    const a = ALL[id].analysis;
    if (!a) return;
    ok(a.write && a.write.keys && a.write.hintText && a.write.sample,
       '★ ' + id + ' 收尾的寫作題有 keys／hintText／sample');
    /* ⚠️ hintText 只能講方向，不可以把 keys 的名稱寫進去 —— 那就是答案。 */
    ok(!(a.write.keys || []).some(g => a.write.hintText.indexOf(g.name) >= 0),
       '   ' + id + ' 的 hintText 沒有把 keys 的名稱寫出來（那就是答案，貼上去就過了）');
  });

  const lv = ALL['2-1-1'];
  const a = lv.analysis;
  ok(!!lv.task && !!lv.scene && !!lv.analysis && !!lv.quiz && !!lv.goal,
     '範本 2-1-1 七個步驟的資料都在（task／scene／analysis／quiz／goal）');

  ok((lv.quiz || []).length >= 6, '概念檢測題庫 ' + lv.quiz.length + ' 題（抽 5，建議 6 題以上）');
  ok(lv.quiz.every(q => q.ref !== undefined), '★ 每一題都指得回問題分析或情境（ref）');
  ok((lv.tips || []).length >= 3, '有給老師的提示（tips）');

  const doc = fs.readFileSync(path.join(root, 'shared', 'docs', '08_關卡製作範本.md'), 'utf8');
  ok(/2-1-1/.test(doc) && /檢查清單/.test(doc),
     '★ 範本文件存在，而且指名 2-1-1 是那個範本');
  ok(/亂按、亂貼、貼提示/.test(doc),
     '   最後一條是「自己扮演一次想混過去的學生」—— 前幾輪的洞全是這樣發現的');
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
  ok(/\（\d+\）/.test(go.textContent),
     '   按鈕上看得到秒數（' + go.textContent.trim() + '）');
  /* ★ 只給數字，不要解釋規則。
     「這一段沒有題目所以請讀 30 秒」讀起來像在說「我知道你不會讀」，
     而且那句話本身就佔掉了要讀的注意力。 */
  ok(!w.document.getElementById('holdmsg'),
     '★ 不對學生解釋「為什麼要等」—— 只顯示秒數');
  /* ⚠️ 釘「畫面上沒有」，不是「原始碼裡不准提」——
     註解正是在說明為什麼不給學生看，把註解也一起禁掉是搞錯對象。 */
  ok(!/至少讀 |切到別的分頁或視窗，倒數會停下來/.test(
       levelSrc.replace(/\/\*[\s\S]*?\*\//g, '')),
     '   而且註解以外的地方（真的會顯示的字串）也沒有那種說明');
  /* ★ 按不下去就是按不下去：把 disabled 的按鈕點下去不可以前進。 */
  go.dispatchEvent(new w.Event('click'));
  ok(w.document.querySelectorAll('.stp')[0].className.indexOf('stp-now') >= 0,
     '★ 硬按也不會跳到下一步');
}
ok(/HOLD_SEC = 30/.test(levelSrc), '停留 30 秒');
{
  /* ★ 規則本身在 shared/readhold.js（readhold.test.js 顧），
     這裡只釘「這一頁真的有接上去、而且沒有自己再判一次」。
     ⚠️ 自己再判一次正是這次出事的原因：11501 和 11502 各寫一套，
        兩邊各自對一半、各自錯一半，而且沒有人會發現。 */
  const code = levelSrc.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');
  ok(/readhold\.js/.test(levelSrc), '★ 有載入 shared/readhold.js');
  ok(/READHOLD\.start\(/.test(code), '   而且真的用它，不是自己另寫一個計時器');
  ok(!/visibilityState|hasFocus|setInterval/.test(code),
     '★ 這一頁不可以自己再判一次「有沒有在讀」—— 兩份規則一定會走鐘');
  /* 沒載到就放行：少讀 30 秒的代價遠小於整節課卡在一個不會動的按鈕前面 */
  ok(/!window\.READHOLD/.test(code),
     '★ 沒載到 readhold.js 要直接放行，不是把學生鎖死');
}
{
  const hold = levelSrc.slice(levelSrc.indexOf('function nextBtn'), levelSrc.indexOf('function draw'));
  /* 畫面文字歸這一頁管：11502 只給數字，11501 講得詳細，
     那是兩邊刻意的選擇。但「重來」兩邊都要說出口。 */
  ok(/暫停/.test(hold), '短暫離開只是暫停（通知、輸入法、被老師叫一下）');
  ok(/離開太久/.test(hold),
     '★ 重來要說出口 —— 秒數自己跳回 30 而沒有說明，看起來就是系統壞了');
}
{
  /* ★ 已經通關的關卡回來查資料，不該再被鎖 30 秒。
     強制停留是為了「第一次別亂點」，不是懲罰。
     這一條原本只有 11501 有（readSecondsFor），11502 漏掉。 */
  const w = level('2-1-1', { '2-1-1': 3 });
  const go = w.document.getElementById('go');
  ok(go && go.disabled === false,
     '★ 已經拿到作品星的關卡 → 不必再等（回來查資料被鎖 30 秒只會讓人覺得在找麻煩）');
  ok(!/（\d+）|暫停/.test(go.textContent),
     '   按鈕直接是可以按的（' + go.textContent.trim() + '）');
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

section('📐 版面：步驟多了也不可以被切掉');
{
  /* ⚠️ 步驟從五個長到七個之後，原本的 max-w-3xl 放不下 ——
     而且步驟列是 overflow-x:auto，最後一個會被切掉一半。
     ★ 捲動比「切掉」更糟的地方在於：沒有捲軸提示，
       學生不會知道右邊還有東西，他看到的只是一個壞掉的畫面。 */
  ok(/flex-wrap:wrap/.test(levelSrc.slice(levelSrc.indexOf('.steps-bar{'), levelSrc.indexOf('.stp{'))),
     '★ 步驟列會換行，不靠橫向捲動');
  ok(!/overflow-x:auto/.test(levelSrc), '   不要再用捲動的版本');
  /* ★ 步驟列要包成一張滿版卡片。
     只是一排 chip 的話寬度跟著內容走，和底下滿版的白卡一比
     就變成「上面短、下面長」，看起來像跑版。 */
  ok(/\.steps-bar\{[^}]*background:#fff/.test(levelSrc.replace(/\s+/g, '')) ||
     /steps-bar\{[\s\S]{0,200}background:#fff/.test(levelSrc),
     '★ 步驟列是一張滿版卡片 —— 和底下的內容對齊同一條邊');
  /* ★ 釘的是「兩頁同寬」，不是「一定要某個數字」——
     從地圖點進關卡會「跳一下」的話，看起來像兩個網站。 */
  const wOf = src => (src.match(/<main class="(max-w-\w+)/) || [])[1];
  ok(wOf(levelSrc) && wOf(levelSrc) === wOf(mapSrc),
     '★ 關卡頁和闖關地圖同寬（都是 ' + wOf(levelSrc) + '）—— 不同寬會像兩個網站');
  ok(/@media \(max-width:520px\)/.test(levelSrc),
     '   手機上縮小字和內距 —— 一列塞得下比較多個');
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
  ok(/（1）/.test(go().textContent), '★ 一秒之後真的少一秒（' + go().textContent.trim() + '）');
  await new Promise(r => setTimeout(r, 1500));
  ok(go().disabled === false, '★ 時間到就解鎖');
  ok(!/（\d+）|暫停/.test(go().textContent),
     '   而且按鈕文字要變回正常（' + go().textContent.trim() + '）');
  go().dispatchEvent(new w.Event('click'));
  const nowStep = [...w.document.querySelectorAll('.stp')]
    .find(b => b.className.indexOf('stp-now') >= 0).textContent.replace(/\s+/g, '');
  ok(nowStep.indexOf('情境解說') < 0, '★ 解鎖之後按下去真的會前進（現在在「' + nowStep + '」）');

  /* ★ 上面這一段順便證明了一條退路：jsdom 的 document.hasFocus()
     從頭到尾回 false，秒數照樣走完了 ——
     也就是「這個環境報不出焦點時，不准拿失焦當作離開」有生效。
     那一條寫錯的話，倒數會永遠停在原地，而畫面上只有一個不動的
     「（暫停）」，沒有任何錯誤訊息。 */

  /* 焦點真的接上去了沒。
     ⚠️ 完整的行為（寬限期、重算、保險絲）在 readhold.test.js ——
        那些是規則，規則只有一份，不要在兩邊各測一次。
        這裡只確認「這一頁真的把規則接上了」。 */
  section('🪟 並列視窗：焦點跑掉這一頁也停得下來');
  {
    const w2 = level('2-1-1', null, src => src.replace('HOLD_SEC = 30', 'HOLD_SEC = 20'));
    const b = () => w2.document.getElementById('go').textContent;
    let focus = true;
    w2.document.hasFocus = () => focus;      // 這一下讓 sawFocus 閂起來
    await new Promise(r => setTimeout(r, 1200));
    ok(/（19|18）/.test(b()), '有焦點時正常倒數（' + b().trim() + '）');
    /* 視窗還看得見（visibilityState 仍是 'visible'），只是焦點跑掉 ——
       這正是「並排兩個視窗、在另一邊做事」的樣子。 */
    focus = false;
    await new Promise(r => setTimeout(r, 1200));
    ok(/暫停/.test(b()),
       '★ 頁面看得見但焦點在別的視窗 → 停（' + b().trim() + '）');
  }

  console.log('\n（含套餐與倒數）通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
