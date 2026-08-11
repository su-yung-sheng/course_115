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
   ['my.definep2', '定義 [畫圖形] ([N]) ([邊長])'],
   ['my.callp2', '[畫圖形] [4] [30]'],
   ['motion.point', '面朝 [90] 度'],
   ['motion.setx', 'x 設為 [0]'],
   ['my.callp', '[畫正方形] [50]'],
   ['data.var', '[我的變數]'],
   ['op.div', '[360] / [4]']
  ].forEach(([id, want]) => is(drawnLabel(id), want, id));
  is(drawnLabel('events.whenflag').includes('▶'), false, '綠旗不是播放三角形');

  section('橢圓的回報值積木（函式參數 vs 一般變數）');
  /* 參數橢圓只有在「定義」積木上宣告了參數之後才會出現在調色盤，
     所以要先放一塊定義進去（這正是下一節要驗的行為）。 */
  function repEl(id) {
    document.getElementById('sim').innerHTML = '';
    const s2 = B.mount(document.getElementById('sim'),
      { palette: [id, 'my.definep'], goal: [] });
    if (id === 'arg.param') s2.load(build([{ id: 'my.definep', args: ['A', '邊長'] }]));
    return [...document.querySelectorAll('.bk-pal .bk-rep')].find(n => n.dataset.id === id);
  }
  is(!!repEl('arg.param'), true, '參數畫成橢圓（.bk-rep），不是方塊');
  is(repEl('arg.param').querySelector('input').value, '邊長',
    '橢圓上寫的就是定義裡宣告的參數名');
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

  section('兩個參數要靠名字分辨，不是靠順序');
  const g3 = L['2-1-3'].goal;
  is(B._same(build(g3), g3), true, '照參考答案 → 通過');
  is(B._same(build(g3, { N: '邊數', 邊長: 's', 畫圖形: 'poly' }), g3), true,
    '積木名和兩個參數名全部改掉 → 一樣通過');
  // 把定義裡兩個參數的名字對調，但橢圓積木沒跟著換 → 形狀和大小會顛倒
  const swapped = build(g3);
  const dfn = swapped.find(n => n.id === 'my.definep2');
  dfn.args[1] = '邊長'; dfn.args[2] = 'N';
  is(B._same(swapped, g3), false, '★ 只把定義的兩個參數名對調 → 判錯（N 和 邊長 指到相反的東西）');

  section('調色盤跟著「定義」上打的參數名走');
  document.getElementById('sim').innerHTML = '';
  const simP = B.mount(document.getElementById('sim'), { palette: L['2-1-3'].palette, goal: g3 });
  const ovals = () => [...document.querySelectorAll('.bk-pal .bk-rep')]
    .filter(n => n.dataset.id === 'arg.param').map(n => n.querySelector('input').value);
  is(ovals(), [], '函式區還是空的 → 沒有參數橢圓');
  is(!!document.querySelector('.bk-parahint'), true,
    '改成一句提示，而不是給一顆空橢圓讓學生亂猜名字');
  simP.load(build(g3));
  is(ovals(), ['N', '邊長'], '放好「定義 畫圖形 (N) (邊長)」→ 兩顆橢圓自動出現');
  is(document.querySelector('.bk-parahint'), null, '有參數之後提示收起來');

  // 在定義上改名字：調色盤與「定義裡已經放好的橢圓」都要跟著改
  const box = [...document.querySelectorAll('.bk-defarea input')].find(i => i.value === 'N');
  box.value = '邊數'; box.dispatchEvent(new W.Event('input'));
  is(ovals(), ['邊數', '邊長'], '改名後調色盤的橢圓跟著變');
  const used = [];
  (function w(l) {
    (l || []).forEach(n => {
      (n.args || []).forEach(a => {
        if (a && typeof a === 'object') { if (a.id === 'arg.param') used.push(a.args[0]); w([a]); }
      });
      w(n.children);
    });
  })(simP.program);
  is(used.sort(), ['邊數', '邊數', '邊長'], '★ 定義裡已經放好的橢圓也一起改名（否則會默默指向不存在的參數）');
  const asTree = l => (l || []).map(x => {
    const d = B.DEFS[x.id], a = v => (v && typeof v === 'object') ? asTree([v])[0] : v;
    return { uid: 'u', id: x.id, args: (x.args || []).map(a),
             children: x.children ? asTree(x.children) : (d.shape === 'c' ? [] : null) };
  });
  is(B._same(asTree(simP.program), g3), true, '★ 改完名字，整段程式仍判定通過');

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
  /* ⚠️ 不是每一關都有積木拼圖。
     第 5 關「排隊比高矮」是排序的觀念導入（課本用圖解不是程式），
     它有拆解和追蹤活動，但沒有 goal／palette ——
     這裡只檢查有拼圖的關卡，否則會在 lv.palette 上炸掉。 */
  const puzzles = ids.filter(id => L[id].goal);
  is(puzzles, ['2-1-1', '2-1-2', '2-1-3'], '目前有拼圖的是這三關');
  is(ids.filter(id => !L[id].goal), ['2-3-1'], '第 5 關有內容但沒有拼圖');
  puzzles.forEach(id => {
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

  section('第 3 關：畫圖形 (邊數) (邊長)，三列（來自老師的參考程式）');
  const SIDES = [].concat(
    Array(6).fill(4), Array(6).fill(6), Array(6).fill(10));   // 4×6 + 6×6 + 10×6 = 120 段
  let pg = shapes(await draw('2-1-3', 120), SIDES);
  is(pg.filter(Boolean).length, 18, '畫出十八個（三列各 6 個）');
  is(pg.map(s => s.n), SIDES, '邊數 4／6／10 —— 同一塊自訂積木畫出三種形狀');
  is(pg.map(s => s.len), [].concat(Array(6).fill(30), Array(6).fill(40), Array(6).fill(40)),
    '邊長 30／40／40 —— 形狀和大小各由一個參數決定');
  is(pg.every(onStage), true, '十八個都在舞台內');
  const rows3 = [0, 1, 2].map(r => pg.slice(r * 6, r * 6 + 6));
  is(rows3.map(r => r.every((s, i) => i === 0 || s.x0 > r[i - 1].x0)), [true, true, true],
    '每一列由左往右');
  is(rows3.map(r => Math.round(r[1].x0 - r[0].x0)), [60, 60, 60], '間隔都是 60');
  is([0, 1].every(i => rows3[i][0].y0 < rows3[i + 1][0].y0), true, '一列比一列低');
  // 第二、三列刻意交疊成花紋 —— 確認「不重疊」不是誤以為的需求
  is(rows3[2].some((s, i) => i > 0 && s.x0 < rows3[2][i - 1].x1), true,
    '第三列相鄰有交疊（老師的設計就是要疊出花紋，不是版面沒算好）');

  section('空格裡打數字就過不了（這一關的重點）');
  const lv3 = L['2-1-3'];
  const fixedN = build(lv3.goal);
  fixedN.find(n => n.id === 'my.definep2').children[1].args[0] = '4';   // 重複 4 次
  is(B._same(fixedN, lv3.goal), false, '重複的空格打死 4 → 判錯');
  const fixedT = build(lv3.goal);
  fixedT.find(n => n.id === 'my.definep2').children[1].children[1].args[0] = '90';
  is(B._same(fixedT, lv3.goal), false, '右轉的空格打死 90 → 判錯');
  const fixed2 = build(L['2-1-2'].goal);
  fixed2.find(n => n.id === 'my.definep').children[1].children[0].args[0] = '50';
  is(B._same(fixed2, L['2-1-2'].goal), false, '第 2 關「移動」的空格打死 50 → 判錯');

  /* ═══ 五、長程式要快轉，不然學生等到不想按第二次 ═══ */
  section('執行速度');
  const speed = n => Math.max(14, Math.min(280, 3000 / Math.max(1, n)));
  is(speed(3), 280, '三塊積木 → 每步 280ms，慢慢演給你看');
  is(speed(125) < 40, true, '一百多步 → 每步 < 40ms（整段約 3 秒，固定 280ms 要 35 秒）');


  /* ═══ 六、相同問題可以有不同的解法 ═══
     課本 p.135 教學叮嚀：學生把下筆停筆放在重複積木中「執行結果也正確」，
     並且「相同問題可以有不同的解法」。
     判定只認一種寫法的話，說明裡那句話就是假的 ——
     學生完全做對卻被說錯，比沒有回饋更糟。 */
  section('多種正確解法');
  const l1 = L['2-1-1'], l2 = L['2-1-2'], l3 = L['2-1-3'];

  is(!!(l1.alts && l1.alts.length), true, '第 1 關有登記另解');
  is(B._same(l1.alts[0].goal, l1.alts[0].goal, l1.loose), true, '另解對得上自己');
  is(B._same(l1.alts[0].goal, l1.goal), false, '★ 另解和參考解答結構真的不同（不是抄一份）');
  is(/不同的解法|一模一樣/.test(l1.alts[0].note), true, '另解要說明「這樣也對」，不是默默放行');
  is(/4 次|1 次/.test(l1.alts[0].note), true, '   並且講出差在哪（放筆收筆做幾次）');

  /* 定位座標換個數字仍然算對 —— 課本 p.136：
     「坐標數值不一定要一樣，目的是定出起始位置，避免圖形超出畫面。」 */
  const moved = JSON.parse(JSON.stringify(l1.goal));
  moved.find(n => n.id === 'motion.goto').args = [-150, -30];
  is(B._same(moved, l1.goal, l1.loose), true, '★ 定位改成 -150,-30 仍然算對');
  is(B._same(moved, l1.goal), false, '   （不給 loose 就會判錯 —— 確認 loose 真的有作用）');

  /* 寬鬆只給定位，別的數字不能跟著鬆掉 */
  const w1 = JSON.parse(JSON.stringify(l1.goal));
  w1[w1.length - 1].args = [8];
  is(B._same(w1, l1.goal, l1.loose), false, '重複 6 次改成 8 次還是判錯');
  const w2 = JSON.parse(JSON.stringify(l1.goal));
  w2[0].children[1].children[0].args = [40];
  is(B._same(w2, l1.goal, l1.loose), false, '邊長 30 改成 40 還是判錯');
  is(B._same(l1.goal.slice(0, -1), l1.goal, l1.loose), false, '少一塊還是判錯');
  is(B._same(l1.goal.concat([{ id: 'pen.up' }]), l1.goal, l1.loose), false, '多一塊還是判錯');

  is(!!(l2.alts && l2.alts.length), true, '第 2 關也有另解');
  is(B._same(l2.alts[0].goal, l2.goal), false, '第 2 關的另解結構也不同');
  is(/arg\.param/.test(JSON.stringify(l2.alts[0].goal)), true,
     '★ 第 2 關的另解仍然要用參數（不能順手放行沒有參數的寫法）');

  /* 第 3 關維持嚴格：三列的座標互相咬合，換列要回到起點那一欄，
     起點放寬會讓三列對不齊。 */
  is(!l3.loose, true, '★ 第 3 關不寬鬆（三列座標互相咬合）');

  /* 拼到一半時，「差在哪」要拿最接近的那一份來比，
     不然會指著學生根本沒打算寫的地方叫他改。 */
  const half = B._canon(l1.alts[0].goal.slice(0, 3));
  is(B._score(half, B._canon(l1.alts[0].goal), []) >= B._score(half, B._canon(l1.goal), []),
     true, '拼另解拼到一半，比較像另解');

  /* ── ★ 拼圖要的每一個數字，都要有交代 ────────────────
     ⚠️ 2026-08-11 實際踩到：
        第 1 關的 goal 要學生產出 4、30、90、6、60 五個數字，
        但畫面上只寫過「邊長 30」和「六個」——
        **間隔 60 從頭到尾沒有人告訴他**。
        拼圖是照 goal 的參數逐一比對的，所以那一關其實只能靠猜。
        更糟的是第 3 關：loose 是空的（三列座標互相咬合），
        -180 / 120 / -80 / 60 / 30 / 40 全都要精準，而一個都沒說。

     ★ 一個數字只有兩種身分，二選一：
         規格 —— 我出的題目（大小、間隔、位置、秒數）→ 一定要寫在 task/build 裡
         演算法 —— 他要學的東西（幾條邊、轉幾度、重複幾次）→ 列進 mustDerive[]
       兩種都不是的話，那就是漏了。

     ⚠️ mustDerive 不是白名單（★ 不要叫 derive —— 那個名字已經被「推導」那一步用掉了），是**回答**。每加一個數字進去，
        等於在說「這個我刻意不講，要他自己想出來」——
        寫不出這句話的數字，就是該寫進 build 的。 */
  console.log('\n── ★ 拼圖要的數字都有交代 ──');
  ['2-1-1', '2-1-2', '2-1-3'].forEach(id => {
    const lv = L[id];
    if (!lv || !lv.goal) return;
    const loose = lv.loose || [];
    const need = new Set();
    (function walk(list) {
      (list || []).forEach(b => {
        /* 寬鬆的積木（例如可以自己決定起點的定位）不必比數字，也就不必交代 */
        if (loose.indexOf(b.id) < 0) {
          (b.args || []).forEach(a => {
            if (typeof a === 'number') need.add(a);
            else if (a && typeof a === 'object') walk([a]);
          });
        }
        walk(b.children);
      });
    })(lv.goal);

    /* 說過的話：題目 ＋ 拼圖說明。去掉標籤只留文字。 */
    const said = ((lv.task || '') + ' ' + (lv.build || []).join(' ')).replace(/<[^>]*>/g, '');
    const told = n => new RegExp('(^|[^\\d.-])' + String(n).replace('-', '-?') + '($|[^\\d])')
      .test(said.replace(/−/g, '-'));
    const derive = new Set(lv.mustDerive || []);
    const miss = [...need].filter(n => !derive.has(n) && !told(n));
    is(miss.length === 0, true,
       `★ ${id} 的每個數字都有交代（規格寫在說明裡、演算法列進 mustDerive）` +
       (miss.length ? `　←　沒交代：${miss.join('、')}` : ''));

    /* derive 裡不該出現「其實已經寫在說明裡」的數字 ——
       那表示我一邊說了、一邊又宣稱要他自己想，自相矛盾。 */
    const both = [...derive].filter(n => told(n));
    is(both.length === 0, true,
       `   ${id} 的 mustDerive 沒有和說明打架` + (both.length ? `　←　${both.join('、')}` : ''));
  });

  console.log(`\n通過 ${pass}／失敗 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
