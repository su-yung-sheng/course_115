/* 5016B「▶ 執行結果」動畫（老師 2026-11-25）
   跑法：node shared/tests/runanim.test.js
   ★ 老師：「能夠幫程式設計一個執行結果動畫? 以程式當中使用到的元件就好」＋「第 1～4 節」「邊跑邊亮那一行」 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const W = {};
new Function('window', read('shared/runanim.js'))(W);
const A = W.RUNANIM, L = A.LESSONS;
const H = read('11501/5016b.html');

/* 頁面「邏輯解析」裡的程式文字（拿掉標籤、空白壓成一格） */
const norm = t => t.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
function demoOf(title) {
  const a = H.indexOf('title: "' + title), d = H.indexOf('demoHTML: `', a);
  const e = H.indexOf('\n                `', d);
  const codes = H.slice(d, e).match(/<code[\s\S]*?<\/code>/g) || [];
  return codes.map(c => norm(c).replace(/\s+/g, ''));     // ⚠️ 標籤拆掉後標點兩邊會多空白 ⇒ 比對時空白全拿掉
}
const TITLES = { u1: '感應大門', u2: '迎賓走廊', u3: '無段風扇', u4: '情境照明' };

section('① 第 1～4 節都有，程式每一行都和「邏輯解析」一樣');
ok(['u1', 'u2', 'u3', 'u4'].every(u => L[u]) && !L.u5, '第 1～4 節有動畫，第 5 節沒有');
Object.keys(TITLES).forEach(u => {
  const codes = demoOf(TITLES[u]);
  const blocks = [].concat(...L[u].modes.map(m => m.blocks));
  ok(codes.length === blocks.length, u + '：程式段數一樣（' + blocks.length + ' 段）');
  const bad = [];
  blocks.forEach((b, i) => b.lines.forEach(ln => { if (!codes[i] || codes[i].indexOf(norm(ln[1]).replace(/\s+/g, '')) < 0) bad.push(ln[1]); }));
  ok(!bad.length, '★★ ' + u + '：每一行都在頁面的程式碼裡（照順序同一段）' + (bad.length ? '：' + bad.slice(0, 3).join('／') : ''));
});
const comps = { u1: 'sonar,motor,door', u2: 'sonar,strip', u3: 'knob,motor,stage', u4: 'knob,strip' };
Object.keys(comps).forEach(u => ok(L[u].comps.join() === comps[u], u + '：只畫程式用到的元件（' + comps[u] + '）'));

/* 用假的 io 跑程式：回傳每一步 */
function run(u, modeKey, inputs, steps) {
  const m = L[u].modes.filter(x => x.key === modeKey)[0];
  const io = { v: {}, out: { motor: 0, leds: Array.from({ length: 8 }, () => [0, 0, 0]) }, read: () => io.cur };
  io.cur = inputs[0];
  const gens = m.progs.map(p => p(io)), log = [];
  for (let i = 0; i < steps; i++) {
    io.cur = typeof inputs === 'function' ? inputs(i) : inputs[Math.min(i, inputs.length - 1)];
    gens.forEach((g, gi) => log.push({ gi, step: g.next().value, v: Object.assign({}, io.v), motor: io.out.motor, leds: io.out.leds.map(x => x.slice()) }));
  }
  return { log, io };
}

section('② 照程式跑出來的結果');
{
  /* 第一節：近 → 開門；中間地帶 → 不動；遠 → 關門 */
  const near = run('u1', 'main', () => 6, 12).log;
  ok(near.some(s => s.step.l === 4 && s.motor === 250) && near.some(s => s.step.l === 5 && s.step.wait === 2) && near.some(s => s.v['門的狀態'] === '開'),
     'u1：距離 6 ⇒「如果距離 < 10」成立 → 馬達 250、等 2 秒、門的狀態＝開');
  const mid = run('u1', 'main', i => (i < 9 ? 6 : 20), 40).log.slice(12);
  ok(!mid.some(s => s.step.l === 4 || s.step.l === 9) && mid.some(s => s.step.l === 8 && s.step.note === false),
     '★ u1：門開著、退到 20（中間地帶）⇒ 兩個「如果」都不成立，馬達不動');
  const far = run('u1', 'main', i => (i < 9 ? 6 : 50), 30).log;
  ok(far.some(s => s.step.l === 9 && s.motor === -250) && far[far.length - 1].v['門的狀態'] === '關', 'u1：退到 50 ⇒ 馬達 −250、門的狀態＝關');
}
{
  const r = run('u2', '1', () => 1, 6).log;
  ok(r.some(s => s.v['亮度'] === 200) && r[r.length - 1].leds.every(c => c.join() === '200,200,200'), 'u2 模式一：距離 1 ⇒ 亮度 200，整條 (200,200,200)');
  ok(run('u2', '1', () => 55, 6).log.some(s => s.v['亮度'] === 1), '   距離 55 ⇒ 亮度 1');
  const p = run('u2', '2', () => 28, 7).log;
  ok(p.some(s => s.v['燈號'] === 4 && s.leds[3].join() === '50,50,50'), 'u2 模式二：距離 28 ⇒ 燈號 4（4.5 小數捨去），第 4 顆 (50,50,50)');
  ok(p[p.length - 1].step.l === 6 && p[p.length - 1].leds.every(c => c.join() === '0,0,0'), '   最後一行把那一顆設回 (0,0,0)');
  ok(A.amap(2, 55, 1, 1, 8) === 7, '   換算和第二節模擬器一樣（Arduino map()：2 公分 → 第 7 顆）');
}
{
  const r = run('u3', 'main', () => 0, 6).log;
  ok(r.some(s => s.gi === 1 && s.v['轉速'] === -250 && s.motor === -250), 'u3：旋鈕最左 ⇒ 轉速 −250（反轉）');
  ok(run('u3', 'main', () => 512, 6).log.some(s => s.v['轉速'] === 0), '   正中間 ⇒ 0（停）');
  ok(run('u3', 'main', () => 1023, 6).log.some(s => s.v['轉速'] === 250 && s.v['角度'] === 180), '   最右 ⇒ 轉速 250、指針 180 度');
  ok(L.u3.modes[0].progs.length === 2, '★ u3：兩段「當綠旗被點擊」同時跑（兩邊各亮一行）');
}
{
  const r = run('u4', '2', () => 0, 8).log;
  const last = r[r.length - 1];
  ok(last.v['紅'] === 128 && last.v['綠'] === 237 && last.v['藍'] === 18 && last.leds[0].join() === '128,237,18',
     '★ u4 模式二：照程式的 sin 公式（角度）算 —— 顏色 0 ⇒ (128, 237, 18)');
  ok(A.rgbOf(90).join() === '255,64,64' && A.rgbOf(210).join() === '64,64,255', '   顏色 90 ⇒ 偏紅 (255,64,64)、210 ⇒ 偏藍 (64,64,255)');
  { const K = {}; new Function('window', read('shared/labkit.js'))(K);
    ok([0, 45, 90, 180, 270, 359].every(h => K.LABKIT.hueRgb(h).join() === A.rgbOf(h).join()), '   和 LABKIT.hueRgb（模擬器、檢核、暖身用的）算出來一樣'); }
  const m1 = run('u4', '1', () => 1023, 6).log;
  ok(m1.some(s => s.v['燈號'] === 8 && s.leds[7].join() === '50,50,50') && m1[m1.length - 1].leds.every(c => c.join() === '0,0,0'),
     'u4 模式一：最右 ⇒ 第 8 顆亮，等 0.4 秒後整條清掉');
}

section('③ 畫面：邊跑邊亮那一行');
let JSDOM; try { JSDOM = require('jsdom').JSDOM; } catch (e) {}
if (!JSDOM) { console.log('  （沒有 jsdom，略過畫面測試）'); finish(); }
else {
  const dom = new JSDOM('<!doctype html><body><div id="a"></div></body>', { pretendToBeVisual: true });
  const w = dom.window;
  new Function('window', read('shared/runanim.js'))(w);
  const box = w.document.getElementById('a');
  const h = w.RUNANIM.mount(box, 'u1');
  const now = () => [...box.querySelectorAll('.ra-ln.now')].map(n => n.textContent.trim());
  ok(box.querySelectorAll('.ra-ln').length === 13 && /超音波距離感測器/.test(box.textContent) && /直流馬達/.test(box.textContent) && /門/.test(box.textContent),
     'u1：13 行程式、超音波＋馬達＋門');
  ok(now().length === 1 && /門的狀態 設為/.test(now()[0]), '一開始亮第一行');
  for (let i = 0; i < 40; i++) h.step(100);
  ok(now().length === 1, '跑起來之後一次只亮一行');
  let sawYes = false, sawWait = false, opened = false, closedAgain = false;
  for (let i = 0; i < 240; i++) {
    h.step(100); const t = box.textContent;
    if (/✔ 成立/.test(t)) sawYes = true; if (/⏳ \d\.\d 秒/.test(t)) sawWait = true;
    if (h.state().door > 0.95) opened = true; if (opened && h.state().door < 0.05) closedAgain = true;
  }
  ok(sawYes && sawWait, '★「如果」標出成立／不成立；「等待」顯示倒數');
  ok(opened && closedAgain, '   劇本跑一輪：人走近門開到底、走遠門關回去');
  ok(/門的狀態 = <b>/.test(box.querySelector('[data-r="vars"]').innerHTML), '變數即時顯示');
  h.stop();
  const b2 = w.document.createElement('div'); w.document.body.appendChild(b2);
  const h3 = w.RUNANIM.mount(b2, 'u3');
  h3.step(10);
  ok(b2.querySelectorAll('.ra-ln.now').length === 2, '★ u3：兩段程式同時跑 ⇒ 亮兩行');
  const b4 = w.document.createElement('div'); w.document.body.appendChild(b4);
  const h4 = w.RUNANIM.mount(b4, 'u4');
  ok(b4.querySelectorAll('[data-mode]').length === 2 && /燈號 設為 類比對應/.test(b4.textContent), 'u4：按 1／按 2 切換，預設模式一');
  b4.querySelector('[data-mode="2"]').click();
  ok(/sin\(顏色\)/.test(b4.textContent) && b4.querySelectorAll('.ra-ln').length === 7, '   切到模式二：換成混色那段程式');
  ok(/<b>/.test('') || !/<script/.test(b4.innerHTML), '   沒有把文字當 HTML 塞進去');
  w.RUNANIM.stopAll();
  finish();
}

function finish() {
  section('④ 5016b.html 接上');
  ok(H.indexOf('../shared/runanim.js') > 0, '載入 runanim.js');
  const howto = H.indexOf('id="demo-howto"'), anim = H.indexOf('id="run-anim"'), code = H.indexOf('id="detail-demo-container"');
  ok(howto > 0 && howto < anim && anim < code, '★ 位置：最後的實作說明 → ▶ 執行結果 → 程式碼（都在通過動手檢核才打開的那一塊裡）');
  ok(/window\.RUNANIM\.LESSONS\[data\.lab\.unit\]\) window\.RUNANIM\.mount\(animBox, data\.lab\.unit\)/.test(H), '依單元掛動畫（第 5 節沒有就不掛）');
  ok(/window\.RUNANIM\.stopAll\(\)/.test(H.slice(H.indexOf('function clearAnimations'), H.indexOf('function clearAnimations') + 400)), '換單元時動畫停掉');
  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
}
