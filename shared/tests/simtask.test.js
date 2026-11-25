/* 5016B「硬體行為模擬」的三個任務（老師 2026-11-25）
   跑法：node shared/tests/simtask.test.js
   ★ 老師：「模擬互動目前沒有強制，加入讓學生互動到特定數值的操作流程，設計三個（數字可在範圍內隨機）」 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/* 假時鐘：「停住多久」不必真的等 */
function load() {
  let now = 1000, seq = 0, timers = [];
  const ctx = {
    Date: { now: () => now },
    setTimeout: (f, ms) => { const id = ++seq; timers.push({ id, at: now + ms, f }); return id; },
    clearTimeout: id => { timers = timers.filter(t => t.id !== id); },
    Math, String, Object, JSON
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('shared/ultralab.js'), ctx);
  vm.runInContext(read('shared/simtask.js'), ctx);
  ctx.tick = ms => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > end) break;
      timers.shift(); now = t.at; t.f();
    }
    now = end;
  };
  return ctx;
}
const C = load(), S = C.SIMTASK;

/* 模擬器的換算（和 5016b.html 同一套；下面第 ⑤ 段會比對頁面原始碼） */
/* 第二節：Arduino map()（整數運算、小數捨去），對應(距離, 55→1, 1→200／1→8) */
const amap = (x, a, b, c, d) => Math.trunc((x - a) * (d - c) / (b - a)) + c;
const brightAt = d => amap(d, 55, 1, 1, 200), ledAt = d => amap(d, 55, 1, 1, 8);
/* 第三、四節：類比對應(A7, 下限, 上限) 四捨五入；第四節紅綠藍照程式的 sin 公式（2026-11-25 模擬器照程式重寫） */
const amapA7 = (v, lo, hi) => Math.round(lo + (v / 1023) * (hi - lo));
const spdOf = v => amapA7(v, -250, 250), angOf = v => amapA7(v, 0, 180), hueOf = v => amapA7(v, 0, 359), ledOf = v => amapA7(v, 1, 8);
const sinD = d => Math.sin(d * Math.PI / 180);
const rgbOf = h => [Math.floor(sinD(h) * 127 + 128), Math.floor(sinD(h + 120) * 127 + 128), Math.floor(sinD(h + 240) * 127 + 128)];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

section('① 每一節三個任務、數字隨機、?seed= 全班同題');
['u1', 'u2', 'u3', 'u4'].forEach(u => ok(S.TASKS[u] && S.TASKS[u].length === 3, u + '：三個任務'));
ok(!S.TASKS.u5, '第 5 節（自己的專案）沒有模擬任務');
const rngA = C.ULTRALAB.rngFrom('7-sim-u1'), rngB = C.ULTRALAB.rngFrom('7-sim-u1');
ok(JSON.stringify(S.makeSet('u1', rngA).map(x => x.p)) === JSON.stringify(S.makeSet('u1', rngB).map(x => x.p)), '同一個 seed ⇒ 同一組數字');
const seen = new Set();
for (let i = 0; i < 40; i++) seen.add(JSON.stringify(S.makeSet('u3', C.ULTRALAB.rngFrom('k' + i)).map(x => x.p)));
ok(seen.size >= 35, '★ 每個人的數字不一樣（40 人 ' + seen.size + ' 種）');

section('② 每一個數字都拉得到（2000 組）');
{
  let bad = [];
  for (let i = 0; i < 2000; i++) {
    const rng = C.ULTRALAB.rngFrom('r' + i);
    const [a, b, c] = S.makeSet('u1', rng).map(x => x.p.x);
    /* 模擬器：距離 5～60；< 10 開門、> 30 關門 ⇒ 任務一要能開、任務二在中間地帶、任務三要能關 */
    if (!(a >= 5 && a < 10 && b >= 10 && b <= 30 && c > 30 && c <= 60)) bad.push('u1 ' + [a, b, c]);
    const u2 = S.makeSet('u2', rng).map(x => x.p.n), D = range(1, 55);
    if (!D.some(d => brightAt(d) === u2[0])) bad.push('u2a ' + u2[0]);
    if (!D.some(d => ledAt(d) === u2[1]) || u2[1] < 1 || u2[1] > 8) bad.push('u2b ' + u2[1]);
    /* 拿掉最後一行、從遠走到近：一公分一公分走，燈號每次最多跳 1 ⇒ 第 1～N 顆一定都會經過 */
    const walk = D.slice().reverse().map(ledAt).filter(n => n <= u2[2]);
    if (range(1, u2[2]).some(n => walk.indexOf(n) < 0)) bad.push('u2c ' + u2[2]);
    const u3 = S.makeSet('u3', rng).map(x => x.p.n), V = range(0, 1023);
    if (!V.some(v => spdOf(v) === u3[0]) || u3[0] === 0) bad.push('u3a ' + u3[0]);
    if (!V.some(v => angOf(v) === u3[1])) bad.push('u3b ' + u3[1]);
    if (!V.some(v => spdOf(v) === u3[2]) || u3[2] <= 0) bad.push('u3c ' + u3[2]);
    const u4 = S.makeSet('u4', rng).map(x => x.p);
    if (!V.some(v => ledOf(v) === u4[0].n)) bad.push('u4a ' + u4[0].n);
    if (!V.some(v => Math.abs(hueOf(v) - u4[1].hue) <= 6)) bad.push('u4b');
    if (!V.some(v => rgbOf(hueOf(v))[u4[2].k] === 255)) bad.push('u4c ' + u4[2].name);
  }
  ok(!bad.length, '★ 任務的數字都在模擬器拉得到的地方、而且拉得到剛好' + (bad.length ? '：' + bad.slice(0, 5).join('／') : ''));
}
ok(range(1, 54).every(d => ledAt(d) - ledAt(d + 1) <= 1) && ledAt(55) === 1 && ledAt(1) === 8 && brightAt(55) === 1 && brightAt(1) === 200,
   '第二節換算：55 公分 → 第 1 顆／亮度 1，1 公分 → 第 8 顆／亮度 200；走一公分燈號最多跳一格');
ok(S.amap(2, 55, 1, 1, 8) === 7 && S.amap(28, 55, 1, 1, 8) === 4, '   小數捨去（2 公分算出 7.87 → 第 7 顆；28 公分 4.5 → 第 4 顆），和 Arduino map() 一樣');
ok(S.COLORS.map(c => c.name + c.hue).join() === '黃色30,紅色90,洋紅色150,藍色210,青色270,綠色330',
   '★ 第四節的顏色照程式的 sin 公式（30 黃、90 紅、150 洋紅、210 藍、270 青、330 綠）');
ok(S.COLORS.every(c => { const x = rgbOf(c.hue), mx = Math.max(...x), mn = Math.min(...x); return mx - mn >= 190; }) &&
   rgbOf(90).join() === '255,64,64' && rgbOf(330).join() === '64,255,64' && rgbOf(210).join() === '64,64,255',
   '   那幾個角度算出來確實是那個顏色（90 → 255,64,64 紅；330 → 綠；210 → 藍）');

/* 掛一組，回傳 { api, box, done } */
function mountOn(u, seed) {
  const box = { innerHTML: '' }, done = { n: 0 };
  const api = S.mount(box, { unit: u, seed: seed, onDone: () => done.n++ });
  return { api, box, done, p: k => api.set[k].p };
}

section('③ 要「停住」才算：一路刷過去不算');
{
  const m = mountOn('u1', 's1'), x = m.p(0).x, y = m.p(1).x, z = m.p(2).x;
  ok(/任務 1/.test(m.box.innerHTML) && /🔒/.test(m.box.innerHTML) && new RegExp(x + ' 公分').test(m.box.innerHTML), '面板：任務 1 顯示題目，後面兩個鎖著');
  ok(!new RegExp(y + ' 公分').test(m.box.innerHTML), '   還沒輪到的任務不先露出數字');
  S.report('u1', { dist: x, open: false, moving: true });
  C.tick(2000);
  ok(m.api.step() === 0, '門還在轉 ⇒ 不算');
  S.report('u1', { dist: x, open: true, moving: false });
  ok(/停住別動/.test(m.box.innerHTML), '★ 對了 ⇒ 提示「停住別動」');
  C.tick(400);
  S.report('u1', { dist: x + 1, open: true, moving: false });
  C.tick(2000);
  ok(m.api.step() === 0, '★★ 碰到就滑走 ⇒ 不算');
  S.report('u1', { dist: x, open: true, moving: false });
  C.tick(S.HOLD - 1);
  ok(m.api.step() === 0, '   停不到 ' + S.HOLD + ' 毫秒 ⇒ 還不算');
  C.tick(1);
  ok(m.api.step() === 1, '★ 停住 ' + S.HOLD + ' 毫秒 ⇒ 任務 1 完成');
  S.report('u1', { dist: y, open: true, moving: false });
  C.tick(S.HOLD);
  ok(m.api.step() === 1, '任務 2（中間地帶門不關）要停久一點（1.5 秒）');
  C.tick(700);
  ok(m.api.step() === 2, '   停 1.5 秒 ⇒ 任務 2 完成');
  S.report('u2', { mode: 2, dist: 20, bright: brightAt(20), led: ledAt(20), keep: false, lit: [ledAt(20)] });
  ok(m.api.step() === 2, '別節的回報不影響這一節');
  S.report('u1', { dist: z, open: true, moving: false });
  C.tick(3000);
  ok(m.api.step() === 2, '★ 退到那裡但門還開著 ⇒ 不算（要等門關）');
  S.report('u1', { dist: z, open: false, moving: false });
  C.tick(S.HOLD);
  ok(m.done.n === 1 && /✅/.test(m.box.innerHTML) && !/👉/.test(m.box.innerHTML), '★ 三個都完成 ⇒ 呼叫 onDone 一次');
  S.report('u1', { dist: z, open: false, moving: false });
  C.tick(3000);
  ok(m.done.n === 1, '   完成之後再動不會重複呼叫');
}

section('④ 每一節的任務');
{
  const m = mountOn('u2', 's2'), [a, b, c] = [0, 1, 2].map(k => m.p(k).n), D = range(1, 55);
  let lit = [];
  const at = (mode, d, keep) => {
    if (!keep) lit = [];
    if (mode === 2 && lit.indexOf(ledAt(d)) < 0) lit = lit.concat(ledAt(d)).sort((x, y) => x - y);
    return { mode, dist: d, bright: brightAt(d), led: ledAt(d), keep: !!keep, lit: mode === 2 ? lit : [] };
  };
  const dB = D.find(d => brightAt(d) === a);
  S.report('u2', at(2, dB)); C.tick(S.HOLD);
  ok(m.api.step() === 0, '★ u2 任務 1：距離對了但在位置模式 ⇒ 不算（要按 1 亮度模式）');
  S.report('u2', at(1, dB)); C.tick(S.HOLD);
  ok(m.api.step() === 1, '   亮度模式、亮度剛好 ' + a + ' ⇒ 算');
  const dL = D.find(d => ledAt(d) === b);
  S.report('u2', at(1, dL)); C.tick(S.HOLD);
  ok(m.api.step() === 1, '★ u2 任務 2：亮度模式 ⇒ 不算');
  S.report('u2', at(2, dL)); C.tick(S.HOLD);
  ok(m.api.step() === 2, '   位置模式、第 ' + b + ' 顆 ⇒ 算');
  const dC = D.find(d => ledAt(d) === c);
  S.report('u2', at(2, dC, false)); C.tick(S.HOLD);
  ok(m.api.step() === 2, '★ u2 任務 3：沒拿掉最後一行（只亮一顆）⇒ 不算');
  lit = [];
  S.report('u2', at(2, 55, true)); S.report('u2', at(2, dC, true)); C.tick(S.HOLD);
  ok(c <= 2 || m.api.step() === 2, '★   直接跳過去（中間的燈沒亮到）⇒ 不算');
  lit = [];
  for (let d = 55; d >= dC; d--) S.report('u2', at(2, d, true));
  C.tick(S.HOLD);
  ok(m.done.n === 1, '   從遠處一公分一公分走到第 ' + c + ' 顆 ⇒ 三個都完成');
}
{
  const m = mountOn('u2', 's2b'), c = m.p(2).n;
  m.api.set[0].done = true;
  const st = (lit, led) => ({ mode: 2, dist: 1, bright: 200, led, keep: true, lit });
  const T = S.TASKS.u2[2];
  ok(!T.ok(st(range(1, c === 8 ? 8 : c + 1), c), { n: c === 8 ? 7 : c }, {}), '   走過頭（多亮了後面的燈）⇒ 不算，要清掉重來');
}
{
  const m = mountOn('u3', 's3'), [a, b, c] = [0, 1, 2].map(k => m.p(k).n);
  const at = v => ({ pot: v, speed: spdOf(v), angle: angOf(v) }), V = range(0, 1023);
  S.report('u3', at(V.find(v => spdOf(v) === a + 1))); C.tick(S.HOLD);
  ok(m.api.step() === 0, 'u3 任務 1：轉速差 1 ⇒ 不算（要剛好）');
  S.report('u3', at(V.find(v => spdOf(v) === -a))); C.tick(S.HOLD);
  ok(m.api.step() === 0, '★   方向相反（' + (-a) + '）⇒ 不算');
  S.report('u3', at(V.find(v => spdOf(v) === a))); C.tick(S.HOLD);
  ok(m.api.step() === 1, '   轉速剛好 ' + a + ' ⇒ 算');
  S.report('u3', at(V.find(v => angOf(v) === b + 1))); C.tick(S.HOLD);
  ok(m.api.step() === 1, 'u3 任務 2：指針差 1 度 ⇒ 不算');
  S.report('u3', at(V.find(v => angOf(v) === b))); C.tick(S.HOLD);
  ok(m.api.step() === 2, '   指針面向 ' + b + ' 度 ⇒ 算');
  S.report('u3', at(V.find(v => spdOf(v) === c))); C.tick(S.HOLD);
  ok(m.api.step() === 2, '★ u3 任務 3：沒有先反轉到最快 ⇒ 不算');
  S.report('u3', at(0)); S.report('u3', at(V.find(v => spdOf(v) === c))); C.tick(S.HOLD);
  ok(m.done.n === 1, '   先反轉到 −250 再轉到正轉 ' + c + ' ⇒ 三個都完成');
}
{
  const m = mountOn('u4', 's4'), p = [0, 1, 2].map(k => m.p(k));
  const V = range(0, 1023);
  const vOf = h => V.reduce((best, v) => Math.abs(hueOf(v) - h) < Math.abs(hueOf(best) - h) ? v : best, 0);
  const m1 = v => ({ mode: 1, pot: v, led: ledOf(v) });
  const m2 = v => ({ mode: 2, pot: v, hue: hueOf(v), rgb: rgbOf(hueOf(v)) });
  const vL = V.find(v => ledOf(v) === p[0].n);
  S.report('u4', m2(vL)); C.tick(S.HOLD);
  ok(m.api.step() === 0, '★ u4 任務 1：在混色模式 ⇒ 不算（要按 1）');
  S.report('u4', m1(vL)); C.tick(S.HOLD);
  ok(m.api.step() === 1, '   按 1、第 ' + p[0].n + ' 顆 ⇒ 算');
  ok(!new RegExp('顏色.{0,20}' + p[1].hue).test(m.box.innerHTML) && m.box.innerHTML.indexOf(p[1].name) > 0, '★ u4 任務 2 只講顏色名稱，度數要自己找');
  S.report('u4', m2(vOf(p[1].hue + 9))); C.tick(S.HOLD);
  ok(m.api.step() === 1, '   差 9 度 ⇒ 不算');
  S.report('u4', m2(vOf(p[1].hue))); C.tick(S.HOLD);
  ok(m.api.step() === 2, '   調成' + p[1].name + '（' + p[1].hue + ' 度）⇒ 算');
  const full = { 0: 90, 1: 330, 2: 210 }[p[2].k];
  S.report('u4', m2(vOf(full + 2))); C.tick(S.HOLD);
  ok(m.api.step() === 2, '★ u4 任務 3：「' + p[2].name + '」差一點點（254 以下）⇒ 不算');
  S.report('u4', m2(vOf(full))); C.tick(S.HOLD);
  ok(m.done.n === 1, '   「' + p[2].name + '」開到 255（顏色 ' + full + '）⇒ 三個都完成');
}
{
  const m = mountOn('u3', 's5');
  S.report('u3', { pot: 0, speed: m.p(0).n, angle: 0 }); S.stop(); C.tick(5000);
  ok(m.api.step() === 0, '★ 離開單元（stop）⇒ 等待中的計時作廢，不會在別的單元完成');
  const m2 = mountOn('u3', 's6');
  S.report('u3', { pot: 0, speed: m2.p(0).n, angle: 0 });
  mountOn('u3', 's7'); C.tick(5000);
  ok(m2.api.step() === 0, '   重新掛（再玩一次）⇒ 舊的那組作廢');
}

section('⑤ 5016b.html：模擬器回報、流程、上鎖');
const H = read('11501/5016b.html');
ok(H.indexOf('../shared/simtask.js') > H.indexOf('../shared/ultralab.js'), '載入 simtask.js（排在 ultralab 後面：亂數用它的 rngFrom）');
const sim = H.indexOf('id="sim-tasks"'), pg = H.indexOf('id="interactive-playground"'), lab = H.indexOf('id="detail-lab"');
ok(sim > 0 && sim < pg && pg < lab, '★ 任務面板在模擬器上方，動手檢核在後面');
ok(/SIMTASK\.report\('u1', \{ dist: curDist, open: doorOpen, moving: dir !== 0 \}\)/.test(H) && /doorOpen = !doorOpen;\s*paint\(\);\s*simReport\(\);/.test(H),
   'u1 回報距離／門／馬達；門轉完那一刻也回報');
ok(/const NEAR = 10, FAR = 30;/.test(H) && /const RUN_MS = 2000;/.test(H), '   第一節模擬器：10／30 公分、轉 2 秒（任務的範圍照這個定）');
ok(/SIMTASK\.report\('u2', \{\s*mode: mode, dist: dist, bright: brightAt\(dist\), led: ledAt\(dist\),\s*keep: keepBox\.checked, lit:/.test(H),
   'u2 回報模式、距離、亮度、燈號、最後一行、亮著的燈');
ok(/function amap\(x, a, b, c, d\) \{ return Math\.trunc\(\(x - a\) \* \(d - c\) \/ \(b - a\)\) \+ c; \}/.test(H) &&
   /const brightAt = d => amap\(d, 55, 1, 1, 200\);/.test(H) && /const ledAt    = d => amap\(d, 55, 1, 1, 8\);/.test(H),
   '★★ u2 模擬器照程式換算：對應(距離, 55→1, 1→200)、(距離, 55→1, 1→8)（和 simtask、測試同一條）');
const prog2 = H.slice(H.indexOf('title: "迎賓走廊'), H.indexOf('title: "無段風扇'));
ok(/對應<\/span> \(<span class="text-sky-600">距離<\/span>, <span class="text-indigo-600">55<\/span> → <span class="text-indigo-600">1<\/span>, <span class="text-indigo-600">1<\/span> → <span class="text-indigo-600">200<\/span>\)/.test(prog2) &&
   /<span class="text-indigo-600">55<\/span> → <span class="text-indigo-600">1<\/span>, <span class="text-indigo-600">1<\/span> → <span class="text-indigo-600">8<\/span>\)/.test(prog2),
   '   程式碼那邊確實是 55→1、1→200／1→8（改程式要一起改模擬器）');
ok(/按 1：亮度模式/.test(prog2) && /按 2：位置模式/.test(prog2) && /拿掉程式最後一行/.test(prog2) && !/10～100/.test(prog2),
   '   模擬器有按 1／按 2、能拿掉最後一行（＝下面「兩種效果」）；舊的 10～100 公分說法拿掉了');
const pg3 = H.slice(H.indexOf('title: "無段風扇'), H.indexOf('title: "情境照明'));
const pg4 = H.slice(H.indexOf('title: "情境照明'), H.indexOf('title: "自己的專案') > 0 ? H.indexOf('title: "自己的專案') : H.length);
ok(/SIMTASK\.report\('u3', \{ pot: val, speed: speed, angle: angle \}\)/.test(pg3) &&
   /speed = amapA7\(val, -MAXS, MAXS\)/.test(pg3) && /const MAXS = 250;/.test(pg3) && /const angle = amapA7\(val, 0, 180\)/.test(pg3) &&
   /const amapA7 = \(v, lo, hi\) => Math\.round\(lo \+ \(v \/ 1023\) \* \(hi - lo\)\)/.test(pg3),
   '★★ u3 模擬器照程式：類比對應(A7, −250, 250) 轉速、(A7, 0, 180) 指針（和任務、動畫同一條）');
ok(!/PWM 輸出|A0\)/.test(pg3.slice(pg3.indexOf('initPlayground'), pg3.indexOf('demoHTML'))), '   舊的「A0 → PWM 0～255」拿掉了');
ok(/SIMTASK\.report\('u4', state\)/.test(pg4) && /state = \{ mode: 1, pot: val, led: n \}/.test(pg4) && /state = \{ mode: 2, pot: val, hue: h, rgb: c \}/.test(pg4) &&
   /const n = amapA7\(val, 1, 8\)/.test(pg4) && /h = amapA7\(val, 0, 359\)/.test(pg4) && /window\.LABKIT\.hueRgb\(h\)/.test(pg4),
   '★★ u4 模擬器照程式：按 1 燈號 (A7, 1, 8)、按 2 顏色 (A7, 0, 359)、紅綠藍用 LABKIT.hueRgb（＝程式的 sin）');
{ const W = {}; new Function('window', read('shared/labkit.js'))(W);
  ok([0, 30, 90, 150, 210, 270, 330, 359].every(h => W.LABKIT.hueRgb(h).join() === rgbOf(h).join()),
     '★★ LABKIT.hueRgb 就是程式那三行 sin（暖身、檢核、模擬器、第五節共用）'); }
ok(/min="5" max="60"/.test(H) && /id="u-led-slider" min="1" max="55"/.test(H) && /dist = 56 - parseInt\(e\.target\.value\)/.test(H),
   '   模擬器拉桿的範圍和任務的檢查一致（第二節 1～55 公分，往右＝走近）');
ok(/getElementById\('u-led-clear'\)\.addEventListener\('click', \(\) => \{ lit = new Set\(\); paint\(\); \}\)/.test(H) && /按「🔄 清掉燈條」/.test(read('shared/simtask.js')),
   '   第二節：「🔄 清掉燈條」按鈕（站太近才勾、或走過頭時重來；任務 3 的提示有寫）');
ok(/if \(!warmOk\) return lockChecks[\s\S]{0,200}if \(!simOk\) return lockChecks\([^)]*三個模擬任務/.test(H), '★★ 動手檢核要暖身＋模擬任務都完成才打開');
ok(/simOn = !!\(window\.SIMTASK && window\.SIMTASK\.TASKS\[labCfg\.unit\] && labCfg\.gate !== false && chkMod\)/.test(H), '   只有第 1～4 節（第 5 節不鎖）');
ok(/if \(rec\.sim \|\| rec\.checks\) \{\s*simOk = true;/.test(H), '★ 之前就通過動手檢核的人不必補做');
ok(/warmOk = true;\s*tryOpenChecks\(rec\);/.test(H) && !/\n\s*openChecks\(rec\);\s*\/\/ ★ 鑰匙已經拿過了/.test(H), '   暖身完成時也要檢查模擬任務（不可以直接打開檢核）');
ok(/if \(!\(rec && rec\.sim\)\) \{[^\n]*\n\s*rec\.sim = \{ at: Date\.now\(\) \};\s*save\.save\(labCfg\.unit, 'sim', \{\}\);/.test(H), '完成寫 modules.arduino.uN.sim；重做不覆寫第一次的時間');
ok(/window\.SIMTASK\.stop\(\)/.test(H.slice(H.indexOf('function clearAnimations'), H.indexOf('function clearAnimations') + 300)), '離開單元時計時作廢');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
