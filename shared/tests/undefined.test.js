/* 有沒有 undefined／NaN 漏到畫面上
   跑法：node shared/tests/undefined.test.js

   ★ 為什麼有這一份
     2026-08-17 老師回報：第 5 關的問題分析寫著
       「先寫下你現在的想法（至少 <b>undefined</b> 個字）」
     而且說「**之前有幾次更新後，檢查字數都會變成 undefined 字**」——
     也就是這個錯**反覆出現過**。

   ★ 根因：var 會被提升，但**指派不會**
       function renderAnalysis() {
         …
         draw();              ← 這裡就會用到 SAY_MIN
         …
         var SAY_MIN = 6;     ← 但要跑到這一行才有值
       }
     SAY_MIN 在第一次畫的時候是 undefined。
     ⚠️ 它**不會報錯**：沒有 ReferenceError、console 乾淨，
        只是字串裡多了五個字母。
     derive.js 第 802 行早就寫著「狀態變數一律放在第一次 draw() 之前」——
     規則寫了，但每次有人在下面新增一個常數就再犯一次。
     ⇒ 光靠註解擋不住，要有測試。

   ★ 這份測試怎麼做
     把每一關的每一個步驟**真的渲染出來**，
     然後檢查產生的 HTML 裡有沒有 undefined／NaN／[object Object]。
     ⚠️ 這是一道很寬的網：它不管那個值該是什麼，
        只管「有沒有東西漏到學生眼前」。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.error('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(2); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
/* jsdom 沒有 canvas —— 補一個什麼都不做的 2D context，
   不然推導那幾步一畫就爆。 */
W.HTMLCanvasElement.prototype.getContext = function () {
  const noop = function () {};
  return new Proxy({}, { get: function (t, k) { return k === 'canvas' ? null : noop; } });
};
['ai-guide', 'answer', 'derive', 'combo', 'labtest',
 'sortlab', 'searchlab', 'logiclab', 'minlab', 'grading', 'blocks', 'quiz']
  .forEach(m => { try { W.eval(read('shared/' + m + '.js')); } catch (e) { /* 有些不需要 */ } });
W.eval(read('11502/content/blocks.js'));
const L = W.BLOCK_LEVELS;
const ORDER = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-1-1',
               '6-2-1', '6-2-2', '6-3-1', '6-3-2', '6-3-3'];

/* 要抓的東西。⚠️ 大小寫都要 —— 'Undefined' 也是漏出來的。 */
const LEAKS = [
  ['undefined', /undefined/i],
  ['NaN', /\bNaN\b/],
  ['[object Object]', /\[object Object\]/]
];

/** 把一段 HTML 檢查一遍，回傳漏出來的清單 */
function leaksIn(html) {
  const out = [];
  LEAKS.forEach(([name, re]) => {
    const m = html.match(re);
    if (!m) return;
    const i = html.search(re);
    out.push(name + '（…' +
      html.slice(Math.max(0, i - 70), i + 30).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') +
      '…）');
  });
  return out;
}

function host() {
  const h = W.document.createElement('div');
  W.document.body.appendChild(h);
  return h;
}

section('★★ 問題分析：十關逐關渲染');
ORDER.forEach(id => {
  const a = L[id].analysis;
  if (!a) return;
  const h = host();
  let err = '';
  try { W.DERIVE.renderAnalysis(h, a, { unit: id, onDone: function () {} }); }
  catch (e) { err = e.message; }
  ok(!err, id + ' 畫得出來' + (err ? '（' + err + '）' : ''));
  const bad = leaksIn(h.innerHTML);
  ok(bad.length === 0, '★★ ' + id + ' 的問題分析沒有漏值' +
     (bad.length ? '\n       ' + bad.join('\n       ') : ''));
  h.remove();
});

section('★★ 推導：十關逐關渲染');
ORDER.forEach(id => {
  const d = L[id].derive;
  if (!d) return;
  const h = host();
  let err = '';
  try { W.DERIVE.mount(h, d, { onDone: function () {} }); }
  catch (e) { err = e.message; }
  ok(!err, id + ' 畫得出來' + (err ? '（' + err + '）' : ''));
  const bad = leaksIn(h.innerHTML);
  ok(bad.length === 0, '★★ ' + id + ' 的推導沒有漏值' +
     (bad.length ? '\n       ' + bad.join('\n       ') : ''));
  h.remove();
});

/* ⚠️ 一關可以掛**兩個**實驗室（第 10 關：先比排序、再比搜尋）——
   lv.lab 那時候是一個**陣列**，lab.kind 會是 undefined。
   ★ 2026-08-18 查到這一份就是這樣紅著的：第 10 關的實驗室從頭到尾
     沒有被掃過，而那正是最近改最多的一關。
   ⇒ 一律攤平成一份清單再掃。 */
const labsOf = lab => (!lab ? [] : (Array.isArray(lab) ? lab : [lab]));

section('★★ 互動實驗室：每一種模式都畫一次');
{
  const MODS = { sort: W.SORTLAB, search: W.SEARCHLAB, logic: W.LOGICLAB, min: W.MINLAB };
  ORDER.forEach(id => {
    labsOf(L[id].lab).forEach((lab, n) => {
      const tag = id + (Array.isArray(L[id].lab) ? '（第 ' + (n + 1) + ' 個）' : '');
      const mod = MODS[lab.kind];
      ok(!!mod, tag + ' 的實驗室模組載得到（' + lab.kind + '）');
      if (!mod) return;
      const h = host();
      let err = '';
      let sim = null;
      try { sim = mod.mount(h, Object.assign({}, lab, { onPass: function () {} })); }
      catch (e) { err = e.message; }
      ok(!err, tag + ' 的實驗室畫得出來' + (err ? '（' + err + '）' : ''));
      const bad = leaksIn(h.innerHTML);
      ok(bad.length === 0, '★★ ' + tag + ' 的實驗室沒有漏值' +
         (bad.length ? '\n       ' + bad.join('\n       ') : ''));
      if (sim && sim.destroy) sim.destroy();
      h.remove();
    });
  });
}

section('★★ 每一步的「目標＋過關標準」橫幅');
{
  /* 橫幅的文字是拼出來的（模組的 goal() ＋ 關卡頁的 STEP_GOAL），
     一樣可能漏值。 */
  const MODS = { sort: W.SORTLAB, search: W.SEARCHLAB, logic: W.LOGICLAB, min: W.MINLAB };
  ORDER.forEach(id => {
    labsOf(L[id].lab).forEach((lab, n) => {
      const tag = id + (Array.isArray(L[id].lab) ? '（第 ' + (n + 1) + ' 個）' : '');
      const g = MODS[lab.kind] && MODS[lab.kind].goal(lab);
      ok(!!g, tag + ' 的實驗室給得出 goal()');
      if (!g) return;
      const bad = leaksIn(g.why + ' ' + g.pass);
      ok(bad.length === 0, '★★ ' + tag + ' 的橫幅沒有漏值' +
         (bad.length ? '　' + bad.join('；') : ''));
    });
  });
  const SRC = read('11502/level.html');
  const goalSrc = SRC.slice(SRC.indexOf('const STEP_GOAL'), SRC.indexOf('function stepGoal'));
  ok(!/undefined/.test(goalSrc), '★ 關卡頁的 STEP_GOAL 裡沒有 undefined');
}

section('★★ 字數門檻：每一個「至少 N 個字」都要有 N');
{
  /* ⚠️ 這就是老師遇到的那一個。
     字數提示是拼字串拼出來的，值沒有的時候會安靜地變成 undefined。 */
  let checked = 0, bad = [];
  ORDER.forEach(id => {
    const a = L[id].analysis;
    if (!a) return;
    const h = host();
    try { W.DERIVE.renderAnalysis(h, a, { unit: id, onDone: function () {} }); } catch (e) {}
    const hits = h.innerHTML.match(/至少\s*([^\s<]+)\s*個字/g) || [];
    hits.forEach(t => {
      checked++;
      if (!/至少\s*\d+\s*個字/.test(t)) bad.push(id + '：「' + t + '」');
    });
    h.remove();
  });
  ok(checked > 0, '真的檢查到字數提示（' + checked + ' 處）');
  ok(bad.length === 0,
     '★★ 每一處的字數都是數字' + (bad.length ? '\n       ' + bad.join('\n       ') : ''));

  /* 寫作題的 min 也要每一關都有 */
  ORDER.forEach(id => {
    const w = L[id].analysis && L[id].analysis.write;
    if (!w) return;
    ok(typeof w.min === 'number' && w.min > 0,
       '★ ' + id + ' 的寫作題有字數下限（min = ' + w.min + '）');
  });
}

section('★★ 釘住根因：常數要宣告在第一次 draw() 之前');
{
  /* ⚠️ 上面那幾條是「結果」的檢查。這一條檢查「原因」——
     因為結果的檢查只涵蓋得到我想得到的畫面，
     而下一次犯規的地方可能是我沒渲染到的那一塊。 */
  const src = read('shared/derive.js');
  const fn = src.slice(src.indexOf('function renderAnalysis('));
  const drawAt = fn.indexOf('\n    draw();');
  ok(drawAt > 0, '找得到 renderAnalysis 裡第一次 draw()');
  /* 取 draw() 之後、到函式結束前的區段，找還有沒有 `var 大寫常數 =` */
  const after = fn.slice(drawAt);
  const late = [...after.matchAll(/^\s{4}var ([A-Z][A-Z0-9_]{2,})\s*=/gm)].map(m => m[1]);
  ok(late.length === 0,
     '★★ draw() 之後沒有再宣告常數' +
     (late.length ? '（' + late.join('、') + ' —— 第一次畫的時候會是 undefined）' : ''));
  ok(/var SAY_MIN = 6/.test(fn.slice(0, drawAt)),
     '★★ SAY_MIN 宣告在 draw() **之前**（這次修的就是它）');
  ok(/第一次 draw\(\) 之前/.test(src),
     '★ 原始碼裡寫著這條規則 —— 下一個人加常數時看得到');
}

section('★★ 同一條規則掃過所有 shared 模組');
{
  /* ⚠️ 老師問「其他地方是不是也有一樣的問題」。
     ★ 只掃**大寫常數**（SAY_MIN、HOLD_SEC 這一類）——
       那才是會被拼進文案、少了就變 undefined 的東西。
     ⚠️ 一開始我連 var box、var m 那種也掃，結果吐出 170 條全是雜訊：
        巢狀函式自己的區域變數，執行到那一行才需要有值，本來就沒問題。
        **會叫的測試沒有人會看** —— 收窄到真的會出事的那一類才有用。 */
  const files = fs.readdirSync(path.join(ROOT, 'shared'))
    .filter(f => f.endsWith('.js'));
  ok(files.length > 5, '掃得到 shared 底下的模組（' + files.length + ' 支）');
  const bad = [];
  files.forEach(f => {
    const code = read('shared/' + f).replace(/\/\*[\s\S]*?\*\//g, ' ');
    /* 每一個「同一層縮排的 render()/draw()/body()」之後，
       同一層縮排就不可以再宣告大寫常數。 */
    [...code.matchAll(/^([ \t]*)(render|draw|body|paint)\(\);[ \t]*$/gm)].forEach(m => {
      /* ⚠️ 一定要停在**這個函式的結尾**。
         第一版沒停，於是 mount() 裡的 render() 配上檔案後面
         renderAnalysis() 裡的 SAY_MIN —— 跨了兩個函式，報了一個假警報。
         ★ 假警報比漏抓更容易毀掉一份測試：
           下一個人只會把整條檢查刪掉。
         ⇒ 用「下一個模組層級的 function（兩格縮排）」當邊界。 */
      let after = code.slice(m.index + m[0].length);
      const end = after.search(/^ {2}function /m);
      if (end > 0) after = after.slice(0, end);
      const re = new RegExp('^' + m[1] + 'var ([A-Z][A-Z0-9_]{2,})\\s*=', 'gm');
      [...after.matchAll(re)].forEach(v => {
        bad.push(f + '：' + m[2] + '() 之後才宣告 ' + v[1]);
      });
    });
  });
  ok(bad.length === 0,
     '★★ 沒有模組把大寫常數宣告在第一次繪製之後' +
     (bad.length ? '\n       ' + bad.join('\n       ') : ''));
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
