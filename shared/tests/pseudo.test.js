/* 拼圖那一步的「程式要長這樣」：虛擬碼
   跑法：node shared/tests/pseudo.test.js

   ★ 為什麼有這一份
     2026-08-17 老師：「整個說明太長了，能夠簡介完功能後，
     使用 pseudo code 的文字描述來引導嗎？」
     第 4 關原本是 62 字的任務 ＋ 10 條散文式說明（466 字），
     讀完還是得自己在腦中把它排成程式。

   ★ 作法：虛擬碼**從 goal 算出來**，不手寫。
     手寫等於同一件事寫兩遍 —— 改了 goal 忘了改虛擬碼，
     學生照著虛擬碼拼卻被判錯，而且**不會有任何錯誤訊息**。
     （第 4 關例外：它自己寫了一份，因為要加旁註。
       那一份就必須有測試盯著，見下面「手寫的那一份」。）

   ⚠️ 這份測試釘三件事
     ① 虛擬碼真的畫得出來，而且每一關都有
     ② 算出來的內容和 goal 對得上（積木數、縮排層次）
     ③ 手寫的那一份（第 4 關）不可以和 goal 走鐘 */
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

const WITH_GOAL = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-2-1', '6-2-2', '6-3-1', '6-3-2'];

function mount(id) {
  const host = W.document.createElement('div');
  W.document.body.appendChild(host);
  const lv = L[id];
  B.mount(host, { palette: lv.palette, goal: lv.goal, sprites: lv.sprites,
                  hint: lv.task, steps: lv.build, stepMs: 0 });
  return { host, done: () => host.remove() };
}

section('★★ 每一關都有虛擬碼，而且畫得出來');
WITH_GOAL.forEach(id => {
  const v = mount(id);
  const boxes = v.host.querySelectorAll('.bk-pseudo');
  const want = (L[id].sprites || [1]).length;
  is(boxes.length, want,
     id + '：' + want + ' 份虛擬碼' + (want > 1 ? '（一個角色一份）' : ''));
  const txt = [...boxes].map(b => b.querySelector('pre').textContent).join('\n');
  ok(txt.length > 40, '　　　內容不是空的（' + txt.split('\n').length + ' 行）');
  /* ⚠️ 積木的英文代號漏出來就是沒對到 DEFS —— 學生看到 motion.move 只會愣住 */
  ok(!/[a-z]+\.[a-z]+/.test(txt), '★ 　　沒有漏出積木的英文代號（motion.move 之類）');
  v.done();
});

section('★★ 算出來的虛擬碼要和 goal 對得上');
{
  /* goal 裡有幾塊積木（含巢狀），虛擬碼就要有幾行（不算空行與「否則」）。
     ⚠️ 少一行代表有一塊沒印出來 —— 學生照著拼就會少一塊，然後被判錯。 */
  const count = list => (list || []).reduce((n, b) => {
    const d = B.DEFS[b.id] || {};
    return n + 1 + count(b.children) + (d.shape === 'c2' ? count(b.children2) : 0);
  }, 0);
  WITH_GOAL.forEach(id => {
    const lines = B._pseudo(L[id].goal)
                   .filter(t => t.trim() && t.trim() !== '否則');
    is(lines.length, count(L[id].goal), id + '：行數和積木數一樣');
  });

  /* 縮排要真的有層次：C 型積木裡面的那幾行要比它更右邊 */
  const p1 = B._pseudo(L['4-2-1'].goal);
  const iRep = p1.findIndex(t => /重複 4 次/.test(t));
  ok(iRep >= 0 && /^\s{8}/.test(p1[iRep + 1]),
     '★★ 「重複 4 次」裡面那一行縮得更右邊（縮排＝包在裡面）');
  /* 帽子積木底下那幾塊也要縮 —— 資料結構上它們是平行的，但在 Scratch 裡是接著的 */
  const iFlag = p1.findIndex(t => /當 綠旗 被點擊/.test(t));
  ok(iFlag >= 0 && /^\s{4}\S/.test(p1[iFlag + 1]),
     '★★ 「當綠旗被點擊」下面那一塊有縮排 —— 不然看起來像各自獨立的敘述');

  /* 如果…否則要印得出「否則」那一格 */
  const p2 = B._pseudo(L['6-3-2'].goal);
  ok(p2.some(t => t.trim() === '否則'), '★ 「如果…否則」印得出「否則」那一行');
}

section('★★ 要學生自己想的數字，虛擬碼裡要挖空');
{
  /* ★ 前三關刻意不說「正方形有幾條邊、每次轉幾度、重複幾次」——
     那是那幾關要學生自己推出來的（mustDerive）。
     ⚠️ 虛擬碼要是把它們一起印出來，就等於一邊說「你自己想」、
        一邊把答案寫在旁邊 —— 而且沒有人會發現，因為畫面看起來很正常。 */
  ['4-2-1', '4-2-2', '4-2-3'].forEach(id => {
    const lv = L[id];
    const hide = lv.mustDerive || [];
    ok(hide.length > 0, id + '：有「要自己想」的數字（' + hide.join('、') + '）');
    const txt = B._pseudo(lv.goal, 0, false, hide).join('\n');
    const leaked = hide.filter(n => new RegExp('(^|[^\\d.-])' + n + '($|[^\\d])').test(txt));
    ok(leaked.length === 0,
       '★★ 　' + id + '：這幾個數字在虛擬碼裡是「？」' +
       (leaked.length ? '　⚠️ 漏出來了：' + leaked.join('、') : ''));
    ok(/？/.test(txt), '　　' + id + '：畫面上真的看得到「？」');
    /* 規格數字（大小、間隔、位置）反過來一定要看得見 —— 那是題目，不是他要學的 */
    const spec = { '4-2-1': 30, '4-2-2': 0.2, '4-2-3': 60 }[id];
    ok(txt.indexOf(String(spec)) >= 0, '　　' + id + '：規格數字 ' + spec + ' 照印（那是題目）');
  });

  /* 第 4 關沒有要自己想的數字（它考的是結構），所以不該有問號 */
  const p4 = L['4-3-1'].sprites.map(s => s.pseudo.join('\n')).join('\n');
  ok(!/？/.test(p4), '★ 第 4 關沒有挖空 —— 那一關的 mustDerive 是空的（它考結構，不考數字）');

  /* 關卡頁要真的把 mustDerive 傳成 hide */
  const lvl = fs.readFileSync(path.join(ROOT, '11502', 'level.html'), 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const seg = lvl.slice(lvl.indexOf('BLOCKS.mount'), lvl.indexOf('BLOCKS.mount') + 500);
  ok(/hide:\s*lv\.mustDerive/.test(seg),
     '★★ level.html 有把 lv.mustDerive 當成 hide 傳進去');
}

section('★★ 手寫的那一份（第 4 關）不可以和 goal 走鐘');
{
  const lv = L['4-3-1'];
  lv.sprites.forEach((sp, i) => {
    ok(!!sp.pseudo, '第 ' + (i + 1) + ' 個角色（' + sp.name + '）有手寫的虛擬碼');
    const txt = sp.pseudo.join('\n').replace(/<[^>]+>/g, '');
    /* 每一塊積木的關鍵字都要在虛擬碼裡出現過。
       ⚠️ 只比「有沒有這個詞」是一道地板，不是保證 ——
          但至少「goal 改了、虛擬碼忘了改」會被抓到。 */
    const need = [];
    (function walk(list) {
      (list || []).forEach(b => {
        const d = B.DEFS[b.id] || {};
        const key = String(d.label || '').replace(/%[a-z]+.*/, '').trim();
        if (key) need.push(key);
        (b.args || []).forEach(a => { if (a && typeof a === 'object') walk([a]); });
        walk(b.children); walk(b.children2);
      });
    })(sp.goal);
    const miss = [...new Set(need)].filter(k => txt.indexOf(k) < 0);
    ok(miss.length === 0,
       '★★ 　' + sp.name + '：goal 裡的每一塊都寫進虛擬碼了' +
       (miss.length ? '　⚠️ 漏了：' + miss.join('、') : ''));
  });

  /* 這一關的三個重點要看得到（老師選的是「完整虛擬碼」，所以它們就寫在上面） */
  const all = lv.sprites.map(s => s.pseudo.join('\n')).join('\n').replace(/<[^>]+>/g, '');
  ok(/且/.test(all), '★ 條件寫的是「且」');
  ok(/碰到顏色/.test(all), '★ 用的是「碰到顏色」，不是「碰到 蟲」');
  /* ⚠️ 不可以拿整份來比 indexOf：「產生蟲」在最上面的「定義 產生蟲」就出現過，
     所以不管順序寫成什麼樣，它永遠比「分身刪除」早 —— 那條斷言會永遠綠。
     （突變測試就是這樣抓到的：把兩行對調，測試照樣綠燈。）
     ⇒ 只看「當分身產生」那一段。 */
  const clone = all.slice(all.indexOf('當分身產生'));
  ok(clone.indexOf('產生蟲') > 0 && clone.indexOf('產生蟲') < clone.indexOf('分身刪除'),
     '★★ 先補一隻、再刪掉自己（順序寫對）');
  ok(/否則/.test(all), '★ 小鳥那一份有「否則」');
}

section('★★ 說明變短了');
{
  /* ⚠️ 這幾條是老師那句「整個說明太長了」的量化版本。
     虛擬碼加進來卻沒把散文刪掉的話，畫面只會更長 —— 那就白改了。 */
  WITH_GOAL.forEach(id => {
    const lv = L[id];
    const task = (lv.task || '').replace(/<[^>]+>/g, '');
    const build = (lv.build || []).map(t => t.replace(/<[^>]+>/g, '')).join('');
    ok(task.length <= 60, id + '：任務一句話（' + task.length + ' 字）');
    ok(build.length <= 130 && (lv.build || []).length <= 3,
       '　　　說明剩 ' + (lv.build || []).length + ' 條 / ' + build.length + ' 字');
  });
}

section('★ 縮排與命名的說明寫在模組裡');
{
  /* 每一關自己寫一遍的話，總有幾關會忘記。 */
  const src = fs.readFileSync(path.join(ROOT, 'shared', 'blocks.js'), 'utf8');
  const i = src.indexOf('function pseudoBox');
  const seg = src.slice(i, i + 1200);
  ok(/往右縮排/.test(seg), '★★ 模組固定講「往右縮排＝包在裡面」');
  ok(/可以自己取/.test(seg), '★ 也講了名字可以自己取（判定比的是代號，不是字面）');
  const v = mount('4-2-1');
  ok(/往右縮排/.test(v.host.querySelector('.bk-pseudo').textContent),
     '★ 而且真的畫在畫面上');
  v.done();
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
