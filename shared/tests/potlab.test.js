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
  ok(api.node() === 1 && !!el.querySelector('#pt-knob'), '① 進場先看到旋鈕');
  ok(!el.querySelector('[data-k]'),
     '★★ 還沒轉過就不出題 —— 光看圖沒有感覺，要自己轉一遍');

  const k = el.querySelector('#pt-knob');
  k.value = 2;  k.dispatchEvent(new W.Event('input', { bubbles: true }));
  ok(!el.querySelector('[data-k]'), '   只轉到一端 → 還是不出題');
  k.value = 98; k.dispatchEvent(new W.Event('input', { bubbles: true }));
  ok(!!el.querySelector('[data-k]'), '★ 兩端都轉到 → 才出題');

  el.querySelector('[data-k="' + api.q1().opts.filter(o => o.good)[0].k + '"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 2, '★ ① 答對 → 進到接線');
  ok(el.querySelectorAll('.pt-pick').length === 3, '   三個孔各一個下拉');

  /* 先故意接錯：照順序 G1 P2 S3 */
  const set = (h, v) => {
    const s = el.querySelector('.pt-pick[data-hole="' + h + '"]');
    s.value = String(v); s.dispatchEvent(new W.Event('change', { bubbles: true }));
  };
  set('G', 1); set('P', 2); set('S', 3);
  el.querySelector('#pt-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 2, '★★ 照順序接（G1 P2 S3）→ 不過');
  ok(/發熱/.test(el.textContent), '   而且畫面上要講出「會發熱」');
  /* ⚠️ 接錯之後選的東西要留著 —— 重畫就清空的話，他得三個重選一次。 */
  ok(el.querySelector('.pt-pick[data-hole="G"]').value === '1',
     '★★ 接錯重畫之後，剛才選的還留著（不然三個都要重選）');

  set('P', 3); set('S', 2);
  el.querySelector('#pt-run').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 3, '★ 接對 → 進到最後一題');
  ok(el.querySelectorAll('[data-w]').length === 3, '   三個選項');

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
  ok(/var b = el\.querySelector\('#pt-bar'\);[\s\S]{0,80}b\.innerHTML/.test(src),
     '★★ 轉旋鈕時只更新那一塊（整個重畫會讓旋鈕失焦）');
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
