/* 第三節課的暖身：可變電阻原理 ＋ 接線練習
   跑法：node shared/tests/potlab.test.js   （需要 jsdom）

   ★ 老師 2026-08-24：「第三關的可變電阻因為開發板沒有，這裡增加了一個接線動作，
     連接到開發板上的 A7。開發板上的腳位順序 G P S 對應可變電阻目前的腳位(1 3 2)」

   ⚠️⚠️ 這一支盯的是**接線對照表**。接線教錯的代價和別的錯不一樣 ——
      學生照著接，硬體是真的會出事。所以這裡的斷言全部釘死在
      老師給的那一組：G→1、P→3、S→2。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const dom = new JSDOM('<!DOCTYPE html><body><div id="x"></div></body>',
  { url: 'https://x/course_115/11501/5016b.html' });
const W = dom.window;
global.document = W.document; global.window = W;
['shared/ultralab.js', 'shared/labkit.js', 'shared/potlab.js']
  .forEach(f => new Function('window', read(f))(W));
const P = W.POTLAB, U = W.ULTRALAB;

section('★★ 接線對照表（老師 2026-08-24 給的，接錯硬體會出事）');
{
  const map = {};
  P.WIRING.forEach(w => { map[w.hole] = w.leg; });
  ok(map.G === 1, '★★ G（接地）→ 腳 1');
  ok(map.P === 3, '★★ P（電源）→ 腳 3');
  ok(map.S === 2, '★★ S（訊號）→ 腳 2 —— 中間那支＝刷片');
  ok(P.PIN === 'A7', '★ 訊號進 A7（老師指定）');
  ok(P.ADC_MAX === 1023, '   類比讀值 0～1023');
  /* 三支腳各接一個孔，不可以重複。 */
  ok(new Set(P.WIRING.map(w => w.leg)).size === 3, '   三支腳各用一次');
  /* ★ 這一份要是**唯一的來源** —— 判定不可以另外寫死一組。 */
  const src = read('shared/potlab.js');
  ok(/WIRING\.filter\(function \(w\) \{ return Number\(pick\[w\.hole\]\) !== w\.leg; \}\)/.test(src),
     '★★ 判定直接讀 WIRING，不另外寫死一份（免得改了一邊忘了另一邊）');
}

section('★★ 接線判定');
{
  ok(P.judgeWire({ G: 1, P: 3, S: 2 }).ok, '★ G1 P3 S2 → 過');
  ok(!P.judgeWire({ G: 1, P: 2, S: 3 }).ok, '★★ G1 P2 S3（照順序接）→ 不過');
  ok(!P.judgeWire({ G: 3, P: 1, S: 2 }).ok, '★ 兩端接反 → 不過');
  ok(!P.judgeWire({ G: 1, P: 3, S: '' }).ok, '   沒接完 → 不過');
  ok(!P.judgeWire({ G: 1, P: 3, S: '' }).done, '   而且「沒接完」和「接錯」要分得出來');
  ok(P.judgeWire({ G: 1, P: 2, S: 3 }).done, '   三個都選了就算接完（即使是錯的）');
  /* 字串型別也要收 —— select 拿到的是字串。 */
  ok(P.judgeWire({ G: '1', P: '3', S: '2' }).ok, '★ 下拉選單給的是字串，一樣要判得對');
}

section('★★ 回饋要講「會發生什麼」，不是只說錯了');
{
  /* ★★ 最危險的那一種：電源接到刷片。 */
  const danger = P.sayWire({ G: 1, P: 2, S: 3 });
  ok(/電源接到中間|發熱/.test(danger),
     '★★ 電源接到刷片 → 要明講會**發熱**，叫他先拔掉');
  ok(/先拔掉/.test(danger), '   而且要給動作：先拔掉再重接');

  /* 訊號沒接刷片 —— 症狀是「完全不會變」。 */
  const noWiper = P.sayWire({ G: 2, P: 3, S: 1 });
  ok(/固定不動|怎麼轉/.test(noWiper), '★ 訊號沒接刷片 → 講「那兩支是固定的，轉了也一樣」');

  /* ⚠️ 兩端接反不會壞，但**看不出來** —— 這一種一定要點破。 */
  const swap = P.sayWire({ G: 3, P: 1, S: 2 });
  ok(/倒過來|相反/.test(swap), '★ 兩端接反 → 講「讀到的數字會倒過來」');
  ok(/不會壞掉|看不出/.test(swap),
     '★★ 而且要點破「它不會壞，所以光看接線看不出問題」—— 要轉一下才發現');

  /* 三種回饋要真的不一樣，不然學生分不出自己錯在哪。 */
  ok(danger !== noWiper && noWiper !== swap && danger !== swap,
     '★★ 三種錯的回饋各不相同');
  ok(/還有線沒接完/.test(P.sayWire({ G: 1 })), '   沒接完是另一種訊息');
}

section('★ 原理：分壓');
{
  ok(P.readAt(0) === 0 && P.readAt(100) === P.ADC_MAX, '兩端 → 0 與 ' + P.ADC_MAX);
  ok(P.readAt(50) === Math.round(P.ADC_MAX / 2), '★ 轉到一半 → 約一半（' + P.readAt(50) + '）');
  ok(P.readAt(-20) === 0 && P.readAt(300) === P.ADC_MAX, '   超出範圍會夾住，不會爆掉');
  /* ★ 讀值和轉的比例成正比 —— 這就是分壓，也接回第二節的「正比」。 */
  const a = P.readAt(20), b = P.readAt(40);
  ok(Math.abs(b - a * 2) <= 1, '★ 轉兩倍讀到兩倍（分壓＝正比，接回第二節）');

  ok(P.Q1.length === 3, '① 有三組問法');
  ok(P.Q1.every(q => q.opts.filter(o => o.good).length === 1), '   每一組都只有一個正解');
  ok(P.Q1.every(q => q.opts.length === 3 && q.why && q.why.length > 8),
     '   每一組都是三選一，而且有「為什麼」');
}

section('★★ ③ 哪一種接錯會「完全沒反應」');
{
  ok(P.judgeWhy('wiper'), '★ 訊號接到兩端 → 完全不會變（正解）');
  ok(!P.judgeWhy('swap'), '★★ 兩端對調 → 不是（它會動，只是反的）');
  ok(!P.judgeWhy('power'), '★★ 電源接刷片 → 不是（很危險，但數字還是會變）');
  ok(/倒過來/.test(P.sayWhy('swap')), '   答 swap 的提示要點破「它還是會變」');
  ok(/危險|發熱/.test(P.sayWhy('power')), '   答 power 的提示要先承認它危險');
  ok(P.optsWhy().filter(o => o.good).length === 1, '三個選項只有一個對');
  ok(P.optsWhy().every(o => o.after && o.after.length > 10),
     '★ 每一個選項都有「會發生什麼」');
}

section('★★ 三個節點真的走得完');
{
  const el = W.document.getElementById('x');
  let done = null;
  const api = P.mount(el, { seed: '1234', onDone: i => { done = i; } });

  /* ── ① 旋鈕（老師 2026-08-24：「真實可變電阻是旋轉式，
     這裡使用左右拉比較無感」）───────────────────── */
  ok(api.node() === 1 && !!el.querySelector('.pt-dial'), '① 進場先看到**旋鈕**');
  ok(!el.querySelector('input[type="range"]'),
     '★★ 不再用左右拉的拉桿 —— 和實物的操作感差太多');
  ok(/rotate\(/.test(el.innerHTML), '★ 指針是用旋轉畫的（真的會轉）');
  ok(!el.querySelector('[data-k]'),
     '★★ 還沒轉過就不出題 —— 光看圖沒有感覺，要自己轉一遍');

  /* ⚠️⚠️ 老師 2026-08-24：「轉轉看不是很好操作，**滑鼠只能點第一下**」
     ★ 病根：paint() 原本是把 #pt-dial 的 innerHTML 整個換掉，
       而那裡面**就是正在被拖曳的那個 SVG** —— 一重畫，
       監聽器和 pointer capture 全沒了，所以只有第一下有效。
     ⚠️ 這種錯不會報錯，只會變成「怎麼拖都沒反應」。
     ⇒ 轉動時只改指針的 transform，SVG 元素從頭到尾不換。 */
  {
    const svgBefore = el.querySelector('.pt-dial');
    const t0 = el.querySelector('#pt-needle').getAttribute('transform');
    api.setPct(30);
    ok(el.querySelector('.pt-dial') === svgBefore,
       '★★ 轉動之後 SVG **還是同一個元素**（不然監聽器會跟著消失，拖第二下就沒反應）');
    ok(el.querySelector('#pt-needle').getAttribute('transform') !== t0,
       '★ 而指針的角度真的變了（只改 transform，不重畫）');
    api.setPct(70);
    ok(el.querySelector('.pt-dial') === svgBefore, '   再轉一次也一樣');
  }

  api.setPct(0);
  ok(!el.querySelector('[data-k]'), '   只轉到一端 → 還是不出題');
  ok(/✅ 轉到最左/.test(el.textContent), '★ 而且達成的那一端要當場打勾（不必等重畫）');
  api.setPct(100);
  ok(!!el.querySelector('[data-k]'), '★ 兩端都轉到 → 才出題');

  /* ★ 用轉的本來就比拉的難 —— 留兩顆「直接轉到底」的退路。 */
  {
    const el3 = W.document.createElement('div');
    W.document.body.appendChild(el3);
    const a3 = P.mount(el3, { seed: 'jump' });
    ok(!!el3.querySelector('#pt-jl') && !!el3.querySelector('#pt-jr'),
       '★ 有「直接轉到最左／最右」兩顆按鈕（拖不順時的退路）');
    el3.querySelector('#pt-jl').dispatchEvent(new W.Event('click', { bubbles: true }));
    el3.querySelector('#pt-jr').dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(!!el3.querySelector('[data-k]'), '   按那兩顆也能把兩端達成、出題');
  }
  /* ⚠️⚠️ 旋鈕只轉 270 度（−135～135）。從最左再往左轉，
     角度會繞到 −170 度那一帶 —— **不夾住的話百分比會跳到另一端**，
     手指還在往左，旋鈕卻彈到最右。
     ★ jsdom 量不到滑鼠座標，所以測的是那個純函式。 */
  ok(P.pctFromAngle(-135) === 0 && P.pctFromAngle(135) === 100, '★ 兩端剛好是 0／100');
  ok(P.pctFromAngle(0) === 50, '   正上方是一半');
  ok(P.pctFromAngle(-170) === 0,
     '★★ 轉過最左（−170 度）→ 夾在 0，**不會跳到另一端**');
  ok(P.pctFromAngle(170) === 100, '★★ 另一端也一樣');
  api.setPct(-30); ok(api.pct() === 0, '   setPct 自己也夾一次（雙保險）');
  api.setPct(300); ok(api.pct() === 100, '   同上');

  el.querySelector('[data-k="' + api.q1().opts.filter(o => o.good)[0].k + '"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 2, '★ ① 答對 → 進到接線');

  /* ── ② 連連看（老師：「接線能類似連連看? 畫出可變電阻，
     不然只寫 1 2 3 很難對照」）──────────────────── */
  ok(el.querySelectorAll('[data-hole]').length === 3 &&
     el.querySelectorAll('[data-leg]').length === 3,
     '★★ 三個孔、三支腳都是可以點的');
  ok(!el.querySelector('select'), '★★ 不再用下拉選單 —— 改成點兩下連一條線');
  ok(/10K/.test(el.innerHTML), '★★ 真的把**可變電阻畫出來**（不是只寫 1 2 3）');
  /* ★ 老師 2026-08-24：「接線圖可變電阻在下，開發板在上」。
     ⚠️ 上下對調不影響重點：正解的 P→3 和 S→2 一樣會交叉。 */
  ok(P.HOLE_Y < P.LEG_Y,
     '★ 開發板在**上**、可變電阻在**下**（孔 y=' + P.HOLE_Y + '、腳 y=' + P.LEG_Y + '）');
  {
    /* 正解那三條線裡，P→3 和 S→2 一定要交叉 —— 那是和「照順序接」最好認的差別。 */
    const cross = (P.HOLE_X.P - P.LEG_X[3]) * (P.HOLE_X.S - P.LEG_X[2]) < 0;
    ok(cross, '★★ 正解的 P→3 與 S→2 是**交叉**的（照順序接則是三條直的）');
    ok(P.HOLE_X.G === P.LEG_X[1], '   而 G→1 是直的');
  }

  api.tapHole('G'); api.tapLeg('1');
  ok(el.querySelectorAll('.pt-wireline').length === 1, '★ 點孔再點腳 → 連一條線');
  /* ⚠️ 一支腳只能接一個孔 —— 不然畫面上會出現「一支腳兩條線」，實物做不到。 */
  api.tapHole('P'); api.tapLeg('1');
  ok(api.pick().G === '' && api.pick().P === '1',
     '★★ 同一支腳接第二條時，前一條自動拆掉（實物上一支腳只能接一條）');
  /* ★★ 點一個**已接的孔** → 拆掉，而且**選起來等著接新的**。
     ⚠️ 第一版是「拆掉但不選起來」，想改接的人點了孔、再點腳完全沒反應，
        得回頭再點一次孔 —— 「我要改這一條」本來就該一步到位。 */
  api.tapHole('P');
  ok(api.pick().P === '', '★ 點已接的孔 → 先拆掉');
  api.tapLeg('3');
  ok(api.pick().P === '3', '★★ 而且拆完直接接得上新的那一支（不必再點一次孔）');

  api.tapHole('G'); api.tapLeg('1');
  api.tapHole('P'); api.tapLeg('2');    // 故意接錯：照順序
  api.tapHole('S'); api.tapLeg('3');
  el.querySelector('#pt-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 2, '★★ 照順序接（G1 P2 S3）→ 不過');
  ok(/發熱/.test(el.textContent), '   而且畫面上要講出「會發熱」');
  ok(el.querySelectorAll('.pt-wireline').length === 3,
     '★★ 接錯之後那三條線還在（不然要整個重連）');

  api.tapHole('P'); api.tapLeg('3');
  api.tapHole('S'); api.tapLeg('2');
  el.querySelector('#pt-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 3, '★ 接對 → 進到最後一題');
  /* ★★ 接對之後要點出「P 和 S 是交叉的」—— 那是和「照順序接」最好認的差別。 */
  ok(/交叉/.test(el.textContent),
     '★★ 接對後要點出「P 和 S 的線是交叉的」（照順序接是三條直的）');

  /* ── ③ 大圖（老師：「第三步驟的圖示可以放大」）──── */
  ok(el.querySelectorAll('.pt-card').length === 3, '★ 三個選項改成三張卡');
  ok(el.querySelectorAll('.pt-card svg').length === 3,
     '★★ 每一張都配一張**圖**（不是只有文字）');
  ok(/藍色＝訊號/.test(el.textContent), '   而且說明顏色代表什麼');

  el.querySelector('[data-w="wiper"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!done, '★ 三個節點都過 → 回報 onDone');
  ok(/G→1/.test(el.textContent) && /S→2/.test(el.textContent),
     '★★ 結尾要再把接線對照複誦一次（上機前的最後提醒）');
  ok(!/\*\*/.test(el.textContent),
     '★ 結尾那段有過 md()（不然 **粗體** 會原樣顯示出來）');
}

section('★ 骨架沒有走鐘（和前兩節同一套）');
{
  const src = read('shared/potlab.js');
  ok(/LK\(\)\.pick\(/.test(src), '★ 換一題走 labkit 的 pick');
  ok(/if \(!global\.LABKIT\) throw new Error/.test(src),
     '★★ labkit 沒載到要明講（靜默半殘的症狀是「按了沒反應」）');
  ok(!/POTLAB/.test(read('shared/labkit.js')), '★★ labkit 不知道 potlab 的存在（相依單向）');
  ok(!/stars/.test(src), '★★ 不碰 stars —— 5016B 不計星');
  /* 拖曳只換那一塊，不整個重畫（重畫會讓旋鈕失焦）。 */
  /* ★★ paint() **不可以**碰 #pt-dial 的 innerHTML —— 那就是正在被拖的 SVG。 */
  const paintFn = src.slice(src.indexOf('function paint()'), src.indexOf('function setPct'));
  ok(/#pt-needle[\s\S]{0,120}setAttribute\('transform'/.test(paintFn),
     '★★ 轉動時只改指針的 transform');
  ok(!/#pt-dial[\s\S]{0,40}innerHTML/.test(paintFn),
     '★★ paint() 不重畫 #pt-dial（那樣會把正在拖的 SVG 換掉）');
  ok(/if \(dragging\) \{ needView = true; return; \}/.test(src),
     '★★ 手指還按著時不重畫整頁，放開之後才畫');
  ok(/addEventListener\('wheel'/.test(src), '★ 滾輪也轉得動（滑鼠使用者用轉的很不順）');
  /* ★ 拖不順的人要有別的路 —— 觸控板上轉圈很不好操作。
     ⚠️ 用「原始碼裡有沒有 ArrowLeft」判斷不夠：拿掉一個還有另一個，
        照樣綠（突變測試抓到）。⇒ 真的按下去看它動不動。 */
  {
    const el2 = W.document.createElement('div');
    W.document.body.appendChild(el2);
    const a2 = P.mount(el2, { seed: 'kb' });
    const dial = el2.querySelector('.pt-dial');
    const before = a2.pct();
    dial.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    ok(a2.pct() > before, '★★ 按 → 真的會往右轉（' + before + ' → ' + a2.pct() + '）');
    dial.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    dial.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    ok(a2.pct() < before, '★★ 按 ← 真的會往左轉');
    dial.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    ok(a2.pct() === 0, '   Home 直接轉到底');
  }
  ok(/setPointerCapture/.test(src), '   手指滑出旋鈕範圍也不會斷（pointer capture）');
}

section('★ 第三節接上頁面了');
{
  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/potlab\.js"><\/script>/.test(page), '頁面載入 potlab');
  ok(/lab: \{ unit: 'u3', warm: 'POTLAB', checks: 'FANLAB' \}/.test(page),
     '★ 第三節：暖身 POTLAB、檢核 FANLAB');
  /* ⚠️ 器材要寫清楚「這一顆不在模組上」，不然學生會找不到。 */
  const mats = page.slice(page.indexOf('title: "無段風扇：可變電阻與馬達"'));
  ok(/不在模組上/.test(mats.slice(0, 2500)), '★★ 器材要註明「這一顆不在模組上，要自己接」');
  ok(/G→腳1/.test(page) && /P→腳3/.test(page) && /S→腳2/.test(page),
     '★★ 器材那裡也把接線對照寫出來（上機時看得到）');
  ok(/A7/.test(mats.slice(0, 2500)), '   而且寫明訊號進 A7');

  /* ★ 生活應用（老師 2026-08-24 選的兩個）。 */
  const u3 = page.slice(page.indexOf('title: "無段風扇：可變電阻與馬達"'), 
                        page.indexOf('title: "情境照明'));
  ok(/DC 變頻電扇/.test(u3) && /遙控車的油門扳機/.test(u3),
     '★ 第三節的生活應用是「DC 變頻電扇」與「遙控車的油門扳機」');
  /* ⚠️⚠️ 兩個都必須真的是「旋鈕→**馬達轉速**」。
     第一版放了「音響的音量旋鈕」—— 那是可變電阻沒錯，但它控制的是**聲音不是馬達**，
     離這一節的主題偏了。 */
  ok(!/音量旋鈕/.test(u3),
     '★★ 不放「音量旋鈕」—— 它是可變電阻，但控制的不是馬達');
  /* ⚠️ 傳統 AC 電扇是三段開關，裡面沒有可變電阻。
     不寫清楚的話，學生拆開會發現和課本講的不一樣。 */
  ok(/傳統電扇不是這樣|三段開關/.test(u3),
     '★★ 要註明「傳統電扇是三段開關，裡面沒有可變電阻」—— 不然學生拆開會發現對不上');
  ok(/無段/.test(u3), '★ 點出兩個應用的共同點是「無段」（開關做不到的那件事）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
