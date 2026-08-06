/* =====================================================================
   積木模擬器的測試（shared/blocks.js ＋ 11502/content/blocks.js）
   ---------------------------------------------------------------------
   怎麼跑：
       npm install jsdom          （只需要做一次；裝在 repo 外面也可以，
                                    用 NODE_PATH=<裝的位置> node …）
       node shared/tests/blocks.test.js

   ★ 這一份的重點是「真的跑一遍再量結果」，不是只比對資料結構。
     關卡的答案寫得再漂亮，畫出來如果超出舞台、圖形互相重疊、
     或是九個圖形其實一模一樣，學生看到的就是壞的。
     所以下面會假造一個 canvas，把每一段畫出來的線記下來，
     再去量：幾段線、邊長多少、有沒有超出舞台、相鄰有沒有重疊。

   ★ 為什麼放在 repo 裡而不是暫存資料夾：
     測試寫完就丟，下次改壞了沒人知道。這一份會跟著程式一起被改。
     （check.py 不會跑這一支 —— 它要 node 與 jsdom，不是每台電腦都有。
       改過 blocks.js 就手動跑一次。）
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('這份測試需要 jsdom：先執行  npm install jsdom');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;

function is(got, want, label) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + label +
    (ok ? '' : `\n       期望 ${JSON.stringify(want)}\n       實得 ${JSON.stringify(got)}`));
}
function section(t) { console.log('\n── ' + t + ' ──'); }

/* ── 造一個假的瀏覽器 ────────────────────────────────
   舞台故意設成 480×360（和 Scratch 一樣），這樣畫面座標
   就等於舞台座標，量出來的數字可以直接跟關卡裡寫的對照。 */
let lines = [];
const dom = new JSDOM('<!DOCTYPE html><body><div id="sim"></div></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
Object.defineProperty(W.HTMLElement.prototype, 'clientWidth',
  { get() { return this.className === 'bk-stage' ? 480 : 900; } });
Object.defineProperty(W.HTMLElement.prototype, 'clientHeight',
  { get() { return this.className === 'bk-stage' ? 360 : 600; } });
W.HTMLCanvasElement.prototype.getContext = function () {
  let cur = null;
  return {
    clearRect() { lines = []; },
    beginPath() { cur = {}; },
    moveTo(x, y) { cur.a = [x, y]; },
    lineTo(x, y) { cur.b = [x, y]; },
    stroke() { if (cur && cur.a && cur.b) lines.push([...cur.a, ...cur.b]); },
    set lineWidth(v) {}, set lineCap(v) {}, set strokeStyle(v) {}
  };
};

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
W.eval(read('shared/blocks.js'));
W.eval(read('11502/content/blocks.js'));
W.eval(read('11502/config.js'));
const B = W.BLOCKS, L = W.BLOCK_LEVELS, CFG = W.CONFIG;

/** 把關卡的 goal（規格）變成「學生真的組出來的樹」 */
function build(list, rename) {
  const arg = v => (v && typeof v === 'object') ? build([v], rename)[0] : v;
  return (list || []).map(x => {
    const d = B.DEFS[x.id];
    const args = (x.args != null ? x.args : (d.args || [])).map(arg);
    if (rename && d.idArgs) d.idArgs.forEach(i => {
      if (typeof args[i] !== 'object' && rename[args[i]] != null) args[i] = rename[args[i]];
    });
    return {
      uid: 'u' + Math.random(), id: x.id, args,
      children: x.children ? build(x.children, rename) : (d.shape === 'c' ? [] : null)
    };
  });
}

/** 掛上模擬器、載入程式、按綠旗，回傳畫出來的線段 */
async function draw(id, expectLines) {
  document.getElementById('sim').innerHTML = '';
  const lv = L[id];
  const sim = B.mount(document.getElementById('sim'),
    { palette: lv.palette, goal: lv.goal, stepMs: 0 });   // stepMs:0 → 不必真的等
  sim.load(build(lv.goal));
  lines = [];
  document.querySelectorAll('.bk-flag')[0].click();
  // 「等待 N 秒」是程式自己要等的，快轉跳不過 → 給足時間
  for (let k = 0; k < 900 && lines.length < expectLines; k++) {
    await new Promise(r => setTimeout(r, 10));
  }
  return lines.slice();
}

/** 把線段切成一個一個圖形，量它的邊長與外框 */
function shapes(all, sides) {
  const out = []; let at = 0;
  for (const n of sides) {
    const seg = all.slice(at, at + n); at += n;
    if (seg.length < n) { out.push(null); continue; }
    const xs = seg.flatMap(v => [v[0], v[2]]), ys = seg.flatMap(v => [v[1], v[3]]);
    out.push({
      n: seg.length,
      len: Math.round(Math.hypot(seg[0][2] - seg[0][0], seg[0][3] - seg[0][1])),
      x0: Math.min(...xs), x1: Math.max(...xs),
      y0: Math.min(...ys), y1: Math.max(...ys)
    });
  }
  return out;
}
const onStage = s => s.x0 >= 0 && s.x1 <= 480 && s.y0 >= 0 && s.y1 <= 360;

(async function () {

  /* ═══ 一、積木名稱要和 Scratch 官方繁中一樣 ═══════════ */
  section('積木名稱（學生要能回 Scratch 找到同一塊）');
  /* 把畫出來的積木讀成一行字。
     空格用 [值] 表示；空格裡若塞著一顆橢圓積木，用 (…) 包起來 —— 
     這樣「移動 [10] 點」和「移動 (邊長) 點」一眼就分得出來。 */
  function labelOf(box) {
    return [...box.childNodes].map(n => {
      if (n.nodeType === 3) return n.textContent;
      if (n.classList && n.classList.contains('bk-hole')) {
        const inp = n.firstChild;
        if (inp && inp.tagName === 'INPUT') return '[' + inp.value + ']';
        return '(' + labelOf(inp) + ')';           // 裡面是一顆橢圓積木
      }
      if (n.querySelector && n.querySelector('svg')) return '{綠旗}';
      return n.textContent;
    }).join('');
  }
  function drawnLabel(id) {
    document.getElementById('sim').innerHTML = '';
    B.mount(document.getElementById('sim'), { palette: [id], goal: [] });
    const b = document.querySelector('.bk-pal .bk, .bk-pal .bk-rep');
    return labelOf(b.classList.contains('bk-rep') ? b : b.childNodes[0]);
  }
  [['events.whenflag', '當 {綠旗} 被點擊'],
   ['motion.move', '移動 [10] 點'],
   ['motion.turnright', '右轉 ↻ [15] 度'],
   ['motion.goto', '定位到 x:[0] y:[0]'],
   ['motion.changex', 'x 改變 [10]'],
   ['looks.next', '造型換成下一個'],
   ['data.setvar', '變數 [我的變數] 設為 [0]'],
   ['pen.clear', '筆跡全部清除'],
   ['pen.down', '下筆'],
   ['pen.up', '停筆'],
   ['my.define', '定義 [畫正方形]'],
   ['my.definep', '定義 [畫正方形] ([邊長])'],
   ['my.callp', '[畫正方形] [50]'],
   ['arg.param', '[邊長]'],
   ['data.var', '[我的變數]'],
   ['op.div', '[360] / [4]']
  ].forEach(([id, want]) => is(drawnLabel(id), want, id));
  is(drawnLabel('events.whenflag').includes('▶'), false, '綠旗不是播放三角形');

  section('橢圓的回報值積木（函式參數 vs 一般變數）');
  function repEl(id) {
    document.getElementById('sim').innerHTML = '';
    B.mount(document.getElementById('sim'), { palette: [id], goal: [] });
    return document.querySelector('.bk-pal .bk-rep');
  }
  is(!!repEl('arg.param'), true, '參數畫成橢圓（.bk-rep），不是方塊');
  is(!!repEl('data.var'), true, '變數畫成橢圓');
  const cParam = repEl('arg.param').style.getPropertyValue('--c');
  const cVar = repEl('data.var').style.getPropertyValue('--c');
  const cOp = repEl('op.div').style.getPropertyValue('--c');
  is(cParam, '#ff6680', '函式參數是函式積木的紅色');
  is(cVar, '#ff8c1a', '一般變數是變數的橘色');
  is(cParam !== cVar, true, '★ 兩者顏色不同 —— 學生一眼看得出不是同一種東西');
  is(cOp, '#59c059', '運算積木是綠色');
  is(B.DEFS['arg.param'].idNs, ['param'], '參數屬於 param 命名空間');
  is(B.DEFS['data.var'].idNs, ['var'], '變數屬於 var 命名空間');

  section('參數名和變數名是兩套，不能混著算');
  const g3 = L['2-1-3'].goal;
  is(B._same(build(g3), g3), true, '照參考答案（參數和變數剛好同名）→ 通過');
  is(B._same(build(g3, { 邊數: 'n', 畫正N邊形: 'poly' }), g3), true,
    '參數和變數都改名 → 通過');
  // 參考答案裡參數與變數同名，學生取成不同名字也該過（Scratch 本來就是兩套東西）
  const sep = build(g3);
  (function rename(l) {
    (l || []).forEach(n => {
      if (n.id === 'arg.param') n.args[0] = 'n';
      if (n.id === 'my.definep') n.args[1] = 'n';
      (n.args || []).forEach(a => { if (a && typeof a === 'object') rename([a]); });
      rename(n.children);
    });
  })(sep);
  is(B._same(sep, g3), true, '★ 參數叫 n、變數仍叫邊數 → 通過（兩套命名空間分開算）');

  /* ═══ 二、名字由學生自訂，只看對應關係 ═══════════════ */
  section('名字自己取（考的是程式，不是背名字）');
  const g1 = L['2-1-1'].goal;
  is(B._same(build(g1), g1), true, '照參考答案取名 → 通過');
  is(B._same(build(g1, { 畫正方形: 'square' }), g1), true, '改叫 square → 一樣通過');
  const mism = build(g1);
  mism.find(n => n.id === 'control.repeat').children.find(n => n.id === 'my.call').args[0] = '別的';
  is(B._same(mism, g1), false, '定義和呼叫的名字對不上 → 判錯');
  const blank = build(g1); blank[0].args[0] = '';
  is(B._same(blank, g1), false, '名字留空白 → 判錯');
  const num = build(g1); num[0].children[1].children[0].args[0] = '60';
  is(B._same(num, g1), false, '名字自由不代表數字自由：邊長改掉 → 判錯');

  /* ═══ 三、每一關的關卡資料要站得住 ═══════════════════ */
  section('關卡資料');
  const ids = Object.keys(L);
  is(ids, ['2-1-1', '2-1-2', '2-1-3'], '目前三關');
  ids.forEach(id => {
    const lv = L[id], used = new Set();
    (function walk(l) { (l || []).forEach(n => { used.add(n.id); walk(n.children); }); })(lv.goal);
    is([...used].filter(x => !B.DEFS[x]), [], id + '　答案沒有不存在的積木');
    is([...used].filter(x => !lv.palette.includes(x)), [], id + '　答案要的積木調色盤都給了');
    is(lv.palette.filter(x => !B.DEFS[x]), [], id + '　調色盤沒有不存在的積木');
    is(lv.palette.length > used.size, true, id + '　有干擾積木（不能全丟進去就過）');
    is(CFG.UNITS.some(u => u[0] === id), true, id + '　代號在 config.js 裡（星數 key 對得上）');
    is(B._same(build(lv.goal), lv.goal), true, id + '　照答案組 → 通過');
  });

  /* ═══ 四、真的畫出來對不對 ═══════════════════════════ */
  section('第 1 關：六個並排的正方形（來自老師的 .sb3）');
  let sq = shapes(await draw('2-1-1', 24), [4, 4, 4, 4, 4, 4]);
  is(sq.filter(Boolean).length, 6, '畫出六個');
  is(sq.map(s => Math.round(s.x1 - s.x0)), [30, 30, 30, 30, 30, 30], '六個都是邊長 30');
  is(sq.map(s => Math.round(s.x0)), [100, 160, 220, 280, 340, 400], '間隔 60，從 x:-140（畫面 100）開始');
  is(sq.every(onStage), true, '六個都在舞台內');

  section('第 2 關：四個愈來愈大的正方形（來自老師的 .sb3）');
  let gr = shapes(await draw('2-1-2', 16), [4, 4, 4, 4]);
  is(gr.map(s => Math.round(s.x1 - s.x0)), [50, 100, 150, 200], '邊長 50／100／150／200');
  const c0 = gr.map(s => [Math.round(s.x0), Math.round(s.y1)]);
  is(c0.every(c => c[0] === c0[0][0]), true, '四個從同一個角落畫起（一個包一個）');
  is(gr.every(onStage), true, '四個都在舞台內');

  section('第 3 關：自己定義的正 N 邊形，3×3');
  const N = [3, 4, 5, 6, 7, 8, 9, 10, 11];
  let pg = shapes(await draw('2-1-3', 63), N);          // 3+4+…+11 = 63
  is(pg.filter(Boolean).length, 9, '畫出九個');
  is(pg.map(s => s.n), N, '邊數 3 → 11（同一塊自訂積木畫出九種形狀）');
  is(pg.map(s => s.len), N.map(() => 25), '九個的邊長都是 25 —— 變的是邊數，不是邊長');
  is(pg.every((s, i) => i === 0 || (s.x1 - s.x0) >= (pg[i - 1].x1 - pg[i - 1].x0)), true,
    '邊數愈多、圖形愈大');
  is(pg.every(onStage), true, '九個都在舞台內');
  const rows = [0, 1, 2].map(r => pg.slice(r * 3, r * 3 + 3));
  is(rows.map(r => r[0].x0 < r[1].x0 && r[1].x0 < r[2].x0), [true, true, true], '同一列由左往右');
  is(rows.map(r => r.every((s, i) => i === 0 || s.x0 > r[i - 1].x1)), [true, true, true], '同一列不重疊');
  is([0, 1].every(i => Math.max(...rows[i].map(s => s.y1)) < Math.min(...rows[i + 1].map(s => s.y0))),
    true, '上下列不重疊');

  section('空格裡打數字就過不了（這一關的重點）');
  const lv3 = L['2-1-3'];
  const fixedN = build(lv3.goal);
  fixedN.find(n => n.id === 'my.definep').children[1].args[0] = '5';   // 重複 5 次
  is(B._same(fixedN, lv3.goal), false, '重複的空格打死 5 → 判錯');
  const fixedT = build(lv3.goal);
  fixedT.find(n => n.id === 'my.definep').children[1].children[1].args[0] = '72';
  is(B._same(fixedT, lv3.goal), false, '右轉的空格打死 72 → 判錯');
  const fixed2 = build(L['2-1-2'].goal);
  fixed2.find(n => n.id === 'my.definep').children[1].children[0].args[0] = '50';
  is(B._same(fixed2, L['2-1-2'].goal), false, '第 2 關「移動」的空格打死 50 → 判錯');

  /* ═══ 五、長程式要快轉，不然學生等到不想按第二次 ═══ */
  section('執行速度');
  const speed = n => Math.max(14, Math.min(280, 3000 / Math.max(1, n)));
  is(speed(3), 280, '三塊積木 → 每步 280ms，慢慢演給你看');
  is(speed(125) < 40, true, '一百多步 → 每步 < 40ms（整段約 3 秒，固定 280ms 要 35 秒）');

  console.log(`\n通過 ${pass}／失敗 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
