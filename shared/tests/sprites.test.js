/* 一關兩個角色：拼圖要分區，而且各自判定
   跑法：node shared/tests/sprites.test.js

   ★ 為什麼有這一份
     2026-08-17 老師問：「第四關的程式拼圖有兩個角色，是要放在一起嗎？」
     不是。在真的 Scratch 裡，蟲和小鳥是**兩份各自獨立的程式**：
     先點角色，再拼它的積木。
     原本八塊全堆在同一個程式區，結果：
       · 畫面上出現**兩個「當綠旗被點擊」**，看起來像同一個角色有兩個開頭
       · 判定是逐項比對的 ⇒ 還要求學生把蟲排在小鳥前面，
         可是這兩份程式在 Scratch 裡根本沒有先後可言

   ⚠️ 這種錯不會有任何錯誤訊息：學生把小鳥拼在前面，
      每一塊積木都對，卻被說「第 1 塊積木不對」。

   ★ 這份測試釘的四件事
     ① 分區：兩個角色兩個程式區，各有標題
     ② 各自判定：一個角色對、另一個沒拼完 → 不算過，而且要說是**哪一個角色**
     ③ 順序無關：跨角色沒有先後（同一個角色**裡面**的順序仍然要對）
     ④ 其餘九關（單角色）走同一套程式碼，畫面不可以多出角色標題 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const is = (a, b, l) => ok(a === b, l + '（實得 ' + JSON.stringify(a) + '）');
const section = t => console.log('\n── ' + t + ' ──');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.error('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(2); }

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
W.eval(fs.readFileSync(path.join(ROOT, 'shared', 'blocks.js'), 'utf8'));
W.eval(fs.readFileSync(path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8'));
const B = W.BLOCKS, L = W.BLOCK_LEVELS;

/** 把 goal 轉成可以載入工作區的節點（C 型積木要有空的 children 陣列） */
function build(list) {
  return (list || []).map(x => {
    const d = B.DEFS[x.id] || {};
    return {
      id: x.id,
      args: (x.args || (d.args || [])).map(a => (a && typeof a === 'object') ? build([a])[0] : a),
      children: x.children ? build(x.children)
                           : ((d.shape === 'c' || d.shape === 'c2') ? [] : null),
      children2: x.children2 ? build(x.children2) : (d.shape === 'c2' ? [] : null)
    };
  });
}

function mount(id) {
  const host = W.document.createElement('div');
  W.document.body.appendChild(host);
  const lv = L[id];
  let passed = null;
  const sim = B.mount(host, {
    palette: lv.palette, goal: lv.goal, sprites: lv.sprites,
    alts: lv.alts, loose: lv.loose, stepMs: 0,
    onPass: p => { passed = p; }
  });
  const click = t => [...host.querySelectorAll('button')]
                       .filter(b => b.textContent.indexOf(t) >= 0)[0].click();
  /* ⚠️ 訊息列就是那個 font-weight:700 的 div（模組裡的 msg）。
     不要用「開頭是 ✅／❌」去撈 —— 「程式區還是空的」兩個符號都沒有，
     撈不到會變成空字串，而空字串的斷言長得像通過。 */
  const msgEl = () => [...host.querySelectorAll('div')]
                        .filter(d => /font-weight:\s*700/.test(d.getAttribute('style') || ''))[0];
  return { host, sim, lv,
           check: () => { click('檢查答案'); return msgEl(); },
           msg: () => (msgEl() || {}).textContent || '',
           passed: () => passed,
           done: () => host.remove() };
}

section('★★ 第 4 關的關卡資料：兩個角色');
{
  const lv = L['4-3-1'];
  ok(!!lv.sprites && lv.sprites.length === 2, '★★ 有兩個角色（sprites）');
  is(lv.sprites.map(s => s.name).join('、'), '蟲、小鳥', '   角色是蟲和小鳥');
  is(lv.sprites[0].hasDefine, true, '★ 蟲角色有函式區（產生蟲是副程式）');
  ok(!lv.sprites[1].hasDefine, '★ 小鳥角色沒有函式區 —— 它沒有副程式，空著會讓人以為漏拼了');

  /* ⚠️ goal 不可以在關卡資料裡再手抄一份 —— 改了 sprites 忘了 goal 不會報錯 */
  const src = fs.readFileSync(path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8');
  const seg = src.slice(src.indexOf("'4-3-1': {"), src.indexOf("'6-3-1': {"));
  /* ⚠️ 要盯的是**頂層**的 goal（縮排 4 格）。
     sprites 裡每個角色都有自己的 goal（縮排 8 格），那是正常的 ——
     第一版寫成 /^\s*goal:/ 會把角色的 goal 也算進去，於是永遠紅。 */
  ok(!/^ {4}goal: \[/m.test(seg),
     '★★ 那一關**沒有**自己寫一份頂層 goal（由 sprites 串出來，單一真相只有一份）');
  is(lv.goal.length, 9, '★ 但 goal 串得出來（9 塊：蟲 7 ＋ 小鳥 2）—— 舊的讀取端還在用它');
  is(lv.goal.length, lv.sprites[0].goal.length + lv.sprites[1].goal.length,
     '   串接的長度對得起來');

  /* 兩個角色各自有一個「當綠旗被點擊」——原本它們在同一區，看起來像同一個角色有兩個開頭 */
  const flags = s => s.goal.filter(b => b.id === 'events.whenflag').length;
  is(flags(lv.sprites[0]), 1, '★★ 蟲角色只有一個綠旗');
  is(flags(lv.sprites[1]), 1, '★★ 小鳥角色也只有一個綠旗');
}

section('★★ 畫面：兩個角色兩區');
{
  const v = mount('4-3-1');
  is(v.host.querySelectorAll('.bk-sphead').length, 2, '★★ 兩個角色標題');
  const heads = [...v.host.querySelectorAll('.bk-sphead')].map(h => h.textContent);
  ok(/蟲/.test(heads[0]) && /小鳥/.test(heads[1]), '   標題是「🐛 蟲」「🐦 小鳥」：' + heads.join(' / '));
  is(v.host.querySelectorAll('.bk-script:not(.bk-defarea)').length, 2, '★★ 兩個主程式區');
  is(v.host.querySelectorAll('.bk-defarea').length, 1,
     '★★ 只有一個函式區（蟲的）—— 小鳥沒有副程式，多給一個空的會讓人以為漏拼');
  v.done();
}

section('★★ 各自判定');
{
  const v = mount('4-3-1');
  const lv = v.lv;

  /* ① 什麼都沒拼 */
  v.check();
  ok(/空的/.test(v.msg()), '空的時候講「程式區還是空的」：' + v.msg());

  /* ② 只拼對蟲 → 不算過，而且要說是哪一個角色沒拼完 */
  v.sim.loadAll([build(lv.sprites[0].goal), []]);
  v.check();
  ok(v.passed() === null, '★★ 只拼對蟲 → 還不算過');
  ok(/小鳥/.test(v.msg()), '★★ 而且訊息指名是**小鳥**還沒好：' + v.msg());

  /* ③ 反過來：只拼對小鳥 */
  v.sim.loadAll([[], build(lv.sprites[1].goal)]);
  v.check();
  ok(v.passed() === null, '★ 只拼對小鳥 → 還不算過');
  ok(/蟲/.test(v.msg()) && !/小鳥/.test(v.msg()),
     '★★ 訊息指名是**蟲**還沒好：' + v.msg());

  /* ④ 兩個都拼對 */
  v.sim.loadAll([build(lv.sprites[0].goal), build(lv.sprites[1].goal)]);
  v.check();
  ok(v.passed() !== null, '★★ 兩個角色都對 → 這一關通過');
  ok(/✅/.test(v.msg()), '   訊息是通過：' + v.msg());
  v.done();
}

section('★★ 跨角色沒有先後，但角色裡面的順序還是要對');
{
  const lv = L['4-3-1'];
  const worm = build(lv.sprites[0].goal), bird = build(lv.sprites[1].goal);

  /* ★ 這是這次改版的重點：兩份程式擺哪一區才算數，不是誰先誰後。
     ⚠️ 舊版把兩個角色串成一串比對，等於「小鳥拼在前面就判錯」——
        每一塊積木都對，訊息卻說「第 1 塊積木不對」。 */
  const v = mount('4-3-1');
  v.sim.loadAll([worm, bird]);
  v.check();
  ok(v.passed() !== null, '★★ 蟲在上、小鳥在下 → 過');
  v.done();

  /* 放錯區：小鳥的程式拼到蟲那一區（順序看起來一樣，但角色錯了） */
  const v2 = mount('4-3-1');
  v2.sim.loadAll([bird, worm]);
  v2.check();
  ok(v2.passed() === null, '★★ 兩個角色的程式對調 → 判錯（那是放錯角色，不是順序問題）');
  v2.done();

  /* 同一個角色裡面的順序仍然要對：蟲的「顯示」和「隱藏」對調 */
  const v3 = mount('4-3-1');
  const bad = JSON.parse(JSON.stringify(worm));
  const iShow = bad.findIndex(n => n.id === 'looks.show');
  const iHide = bad.findIndex(n => n.id === 'looks.hide');
  const t = bad[iShow]; bad[iShow] = bad[iHide]; bad[iHide] = t;
  v3.sim.loadAll([bad, bird]);
  v3.check();
  ok(v3.passed() === null,
     '★★ 蟲的顯示／隱藏對調 → 判錯（先藏起來的話，十隻分身全是隱形的）');
  ok(/蟲/.test(v3.msg()), '   而且說得出是蟲那一區：' + v3.msg());
  v3.done();
}

section('★★ 其餘九關（單角色）不受影響');
{
  ['4-2-1', '4-2-2', '4-2-3', '6-2-1', '6-3-1'].forEach(id => {
    if (!L[id] || !L[id].goal) return;
    const v = mount(id);
    is(v.host.querySelectorAll('.bk-sphead').length, 0,
       '第 ' + id + '：沒有角色標題（只有一個角色就不要多一層）');
    is(v.host.querySelectorAll('.bk-script:not(.bk-defarea)').length, 1,
       '　　　　　只有一個程式區');
    v.sim.load(build(L[id].goal));
    v.check();
    ok(v.passed() !== null, '★ 　　　照答案拼 → 判對（單角色路徑沒被改壞）');
    v.done();
  });
}

section('★ 關卡頁要真的把 sprites 傳進去');
{
  /* ⚠️ 少傳一個欄位不會報錯 —— 畫面會安靜地退回「一個角色」，
     兩份程式又混在一起，而測試如果只測模組就抓不到。 */
  const lvl = fs.readFileSync(path.join(ROOT, '11502', 'level.html'), 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const i = lvl.indexOf('BLOCKS.mount');
  const seg = lvl.slice(i, i + 400);
  ok(/sprites:\s*lv\.sprites/.test(seg), '★★ level.html 有把 lv.sprites 傳給 BLOCKS.mount');
  ok(/goal:\s*lv\.goal/.test(seg), '   goal 也還在（單角色關卡走它）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
