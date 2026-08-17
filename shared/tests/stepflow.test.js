/* 每一步都走得到下一步嗎？（關卡頁 ↔ 各模組的回呼合約）
   跑法：node shared/tests/stepflow.test.js

   ★ 為什麼有這一份
     2026-08-17 老師在第 3 關卡住：推導四步做完了，進不到概念檢測。
     原因是一個**完全不會報錯**的錯：
       shared/derive.js 走完所有步驟時叫的是 opts.onPass
       11502/level.html 傳進去的卻是 onDone
     （旁邊的「問題分析」用的就是 onDone —— 名字是這樣分岔的。）
     而推導那一步**沒有「下一步」按鈕**，回呼是唯一的出路
     ⇒ 所有有推導的關卡（第 3、4、5 關）走到那裡就卡死。

   ⚠️ 這種錯的形狀：模組叫 A、呼叫端傳 B。
      沒有例外、沒有紅字、console 也乾淨 ——
      畫面上只是「我明明做完了，它沒反應」。
      學生不會回報「回呼名字不對」，他只會說系統壞了。

   ★ 這份測試在做什麼
     ① 對每一個步驟，找出關卡頁傳給模組的回呼名字
     ② 對每一個模組，找出它完成時**實際會叫**的回呼名字
     ③ 兩邊必須有交集 —— 沒有交集就是走不下去
     ④ 另外確認：沒有回呼的步驟，一定要有「下一步」按鈕
        （兩者都沒有的話，那一步就是死路） */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const LVL = read('11502/level.html');

/** 去掉註解 —— 註解裡常常寫著「原本叫 onPass」之類的字 */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');

/**
 * 模組完成時實際會叫哪幾個回呼。
 * 只看 `opts.xxx(` 這種呼叫形式 —— 那才是真的會被執行的。
 *
 * ⚠️⚠️ region 一定要指定，**不可以掃整個檔案**。
 *    第一版我掃整份 derive.js，結果：
 *      推導（mount）只叫 onPass，但同一個檔案裡的畫布動畫和
 *      問題分析（renderAnalysis）都叫了 onDone
 *      → 「模組會叫 onDone」成立 → 測試綠燈 → **抓不到今天這個 bug**。
 *    ★ 一個檔案裡有好幾個渲染器的時候，合約是「**這一個**渲染器」的，
 *      不是整個檔案的。
 */
function firedBy(file, from, to) {
  let src = strip(read(file));
  if (from) {
    const i = src.indexOf(from);
    const j = to ? src.indexOf(to, i + 1) : -1;
    src = src.slice(i < 0 ? 0 : i, j < 0 ? src.length : j);
  }
  const names = {};
  [...src.matchAll(/opts\.(on[A-Za-z]+)\s*\(/g)].forEach(m => { names[m[1]] = 1; });
  return Object.keys(names).sort();
}

/**
 * 關卡頁在某一段裡傳了哪幾個回呼。
 * from：那一段的起點字串（例如 'DERIVE.mount'）
 */
function passedIn(from, len) {
  const i = LVL.indexOf(from);
  if (i < 0) return null;
  const seg = strip(LVL.slice(i, i + (len || 900)));
  const names = {};
  [...seg.matchAll(/\b(on[A-Za-z]+)\s*:/g)].forEach(m => { names[m[1]] = 1; });
  return Object.keys(names).sort();
}

/* 步驟 → （關卡頁掛載的那一行, 模組檔, 那一支渲染器在檔案裡的範圍）
   ⚠️ derive.js 一個檔案裡有兩支渲染器（mount＝推導、renderAnalysis＝問題分析），
      各自的回呼名字**不一樣**。範圍不切開的話就會互相掩護。 */
const WIRING = [
  ['問題分析 analysis', 'DERIVE.renderAnalysis', 'shared/derive.js',
   'function renderAnalysis(', null],
  ['推導 derive', 'DERIVE.mount', 'shared/derive.js',
   'function mount(', 'function renderAnalysis('],
  ['套餐工廠 combo', 'COMBO.mount', 'shared/combo.js', null, null],
  ['概念檢測 quiz', 'QUIZ.mount', 'shared/quiz.js', null, null],
  ['程式拼圖 blocks', 'BLOCKS.mount', 'shared/blocks.js', null, null],
  ['實驗室 lab', 'mod.mount', null, null, null]   // 四支，下面單獨處理
];

section('★★ 關卡頁傳的回呼名字，模組要真的會叫');
WIRING.forEach(([name, hook, file, from, to]) => {
  if (!file) return;
  const given = passedIn(hook);
  ok(!!given, name + '：找得到掛載的那一段（' + hook + '）');
  if (!given) return;
  const fired = firedBy(file, from, to);
  const hit = given.filter(g => fired.indexOf(g) >= 0);
  ok(hit.length > 0,
     '★★ ' + name + '：關卡頁傳 [' + given.join('、') + ']，' +
     '模組會叫 [' + fired.join('、') + ']' +
     (hit.length ? ' → 對得上（' + hit.join('、') + '）'
                 : ' → **沒有交集，這一步走不下去**'));
});

section('★★ 四支實驗室都要叫得到 onPass');
{
  /* 關卡頁的 lab 那一步傳的是 onPass（見 mod.mount 那一段）。
     ⚠️ 少一支沒叫的話，那一關的「動手試一次」永遠過不去 ——
        而且完全沒有錯誤訊息。 */
  const given = passedIn('mod.mount', 1400);
  ok(!!given && given.indexOf('onPass') >= 0,
     '關卡頁的實驗室那一步傳 onPass（實際：' + (given || []).join('、') + '）');
  ['sortlab', 'searchlab', 'logiclab', 'minlab'].forEach(m => {
    const fired = firedBy('shared/' + m + '.js');
    ok(fired.indexOf('onPass') >= 0,
       '★★ ' + m + ' 完成時會叫 onPass（實際會叫：' + fired.join('、') + '）');
  });
}

section('★★ 沒有回呼的步驟，一定要有「下一步」按鈕');
{
  /* ★ 一個步驟的出路只有兩種：模組回呼，或畫面上的按鈕。
     兩種都沒有 = 死路。推導那一步就是這樣卡住的
     （它沒有按鈕，而回呼名字又對不上）。 */
  const body = LVL.slice(LVL.indexOf('function draw(s)'));
  /* 把每個 if (s.key === 'xxx') { … } 的區塊切出來 */
  const marks = [...body.matchAll(/s\.key === '([a-z]+)'/g)];
  ok(marks.length >= 5, '切得出各步驟的分支（' + marks.map(m => m[1]).join('、') + '）');
  /* ⚠️ 終點步驟不需要「出路」—— 它本來就是最後一步。
     · test：上傳作品，等批改（沒有下一步）
     · play：沒有作品要交的關卡的最後一步（第 5、10 關的實作體驗）
     ★ 但終點一定要給學生**一條離開的路**，不然他會停在那裡不知道做什麼。 */
  const TERMINAL = ['test', 'play'];
  marks.forEach((m, i) => {
    const from = m.index;
    const to = i + 1 < marks.length ? marks[i + 1].index : body.length;
    const seg = strip(body.slice(from, to));
    const key = m[1];
    if (TERMINAL.indexOf(key) >= 0) {
      ok(/href="scratch\.html"|<iframe/.test(seg),
         '★★ ' + key + ' 是終點，但要有離開的路（回地圖的連結或上傳站）');
      return;
    }
    const hasCb = /\bon[A-Za-z]+\s*:/.test(seg);
    const hasBtn = /nextBtn\(/.test(seg);
    ok(hasCb || hasBtn,
       '★★ ' + key + ' 有出路（' +
       (hasCb ? '回呼' : '') + (hasCb && hasBtn ? '＋' : '') + (hasBtn ? '下一步按鈕' : '') +
       (hasCb || hasBtn ? '' : '**兩種都沒有 —— 死路**') + '）');
  });
}

section('★★ 十關逐關檢查：每一步都接得上');
{
  global.window = {};
  (0, eval)(read('11502/content/blocks.js'));
  const L = global.window.BLOCK_LEVELS;
  (0, eval)(read('shared/grading.js'));
  const GATE = global.window.GRADING.GATE;
  const ORDER = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-1-1',
                 '6-2-1', '6-2-2', '6-3-1', '6-3-2', '6-3-3'];
  ORDER.forEach(id => { if (L[id]) L[id]._id = id; });
  /* 重現 level.html 的 steps()：哪些步驟會出現 */
  const stepsOf = v => {
    const out = ['scene'];
    if (v.combo) out.push('combo');
    if (v.analysis) out.push('analysis');
    if (v.derive) out.push('derive');
    if (v.lab) out.push('lab');
    if (v.quiz) out.push('quiz');
    if (v.goal) out.push('blocks');
    /* ⚠️ 最後一步不一定是「實作測試」：
       沒有作品要交的關卡（GRADING.GATE.NO_UPLOAD）是「實作體驗」。
       ★ 名單只有一份 —— 這裡也要去讀它，不可以自己寫死。 */
    out.push(GATE.needsUpload(v._id) ? 'test' : 'play');
    return out;
  };
  /* 上面那一段已經確認過每一種步驟都接得上；
     這裡確認的是「每一關實際會走到的那幾步」都在清單裡。 */
  const WIRED = ['scene', 'combo', 'analysis', 'derive', 'lab', 'quiz', 'blocks', 'test', 'play'];
  ORDER.forEach((id, i) => {
    const st = stepsOf(L[id]);
    const bad = st.filter(k => WIRED.indexOf(k) < 0);
    ok(bad.length === 0,
       '第 ' + (i + 1) + ' 關 ' + id + '：' + st.join(' → ') +
       (bad.length ? '　⚠️ 沒有接線的步驟：' + bad.join('、') : ''));
  });

  /* ★ 特別盯推導那幾關 —— 這次出事的就是它們 */
  const withDerive = ORDER.filter(id => L[id].derive);
  ok(withDerive.length === 3,
     '★ 有推導的是這三關：' + withDerive.join('、') + '（第 3、4、5 關）');
  const fired = firedBy('shared/derive.js', 'function mount(', 'function renderAnalysis(');
  const given = passedIn('DERIVE.mount');
  ok(given.some(g => fired.indexOf(g) >= 0),
     '★★ 這三關的推導做完之後，真的會往下走');
}

section('★ 推導完成時的回呼（釘死這次的修法）');
{
  const src = read('shared/derive.js');
  const i = src.indexOf('doneBox.className');
  const seg = src.slice(i, i + 900);
  ok(/opts\.onDone/.test(seg),
     '★★ 走完所有步驟時會叫 onDone（level.html 傳的就是這個）');
  ok(/opts\.onPass/.test(seg),
     '★ onPass 也留著 —— 之前若有別的呼叫端傳它，不要順手弄壞');
  ok(/onDone[\s\S]{0,400}onPass|onPass[\s\S]{0,400}onDone/.test(seg),
     '   兩個都在同一段裡');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
