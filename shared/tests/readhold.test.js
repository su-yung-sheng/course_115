/* 閱讀停留的規則（shared/readhold.js）
   跑法：node shared/tests/readhold.test.js

   ★ 為什麼這一份要真的讓時間走
     這裡每一條壞掉，都**不會有錯誤訊息**：
       · 判斷寫錯 → 倒數永遠停著，畫面上只有一個不動的秒數
       · 保險絲沒了 → 某些環境的學生永遠過不去這一步
       · 寬限期沒了 → 被通知打斷的學生從頭讀，而他是認真的那一個
       · 重算沒了 → 並排掛著零成本，這整個機制等於不存在
     結構測試（「有沒有寫這段程式」）一條都抓不到，
     所以底下用假的 document、把秒數縮到 1～10 秒，真的跑一遍。

   ★ 為什麼規則只有一份
     兩學期各有一套閱讀倒數，而它們已經走鐘過一次：
       11502 只判 visibilityState → 並列視窗完全繞得過去
       11501 判了兩件事但沒有保險絲 → 報不出焦點的環境永遠卡死
     兩邊各自對一半、各自錯一半，沒有人會發現。
     ⇒ 規則集中在 readhold.js，這一份就是它的守門員。
       頁面只負責畫面文字（11501 講得詳細、11502 只給數字，
       那是刻意的差別，不是不一致）。

   ⚠️ 所有情境**同時**跑（Promise.all），不是一個接一個。
      每個情境各有自己的假 document 和自己的計時器，本來就互不相干；
      排隊跑的話這一份要 40 秒，而 pre-commit hook 要跑二十幾份 ——
      慢到會讓人養成 --no-verify 的習慣，那比沒有測試更糟。
      印出來的順序仍然照情境排（結果先收齊再印）。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(root, 'shared', 'readhold.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const W = {};
new Function('window', SRC)(W);
const RH = W.READHOLD;

/** 一個可以隨手擺弄的假 document */
function fakeDoc(o) {
  o = o || {};
  return {
    visibilityState: o.vis || 'visible',
    hasFocus: o.noApi ? undefined : function () { return this._focus !== false; },
    _focus: true
  };
}
/** 開一個計時器，把每一秒的狀態記下來 */
function run(doc, opts) {
  const log = [];
  let done = false;
  const c = RH.start(Object.assign({
    doc: doc,
    onTick: v => log.push(v),
    onDone: () => { done = true; }
  }, opts || {}));
  return { c, log, last: () => log[log.length - 1] || {}, done: () => done };
}

/* 一個情境 = 一段 async，回傳 [[條件, 說明], …]。全部同時開跑。 */
const SCENES = [

['預設值', async () => [
  [RH.SEC === 30, '預設停留 30 秒'],
  [RH.AWAY_RESET === 5, '離開超過 5 秒才從頭算'],
  [RH.FUSE === 3, '保險絲是 SEC 的 3 倍']
]],

['① 正常情況：秒數真的會走', async () => {
  const r = run(fakeDoc(), { sec: 3 });
  await sleep(1200);
  const a = [
    [r.last().left === 2, '一秒之後真的少一秒（' + r.last().left + '）'],
    [r.last().state === 'run', '   狀態是 run']
  ];
  await sleep(2400);
  a.push([r.done(), '★ 時間到會呼叫 onDone']);
  r.c.stop();
  return a;
}],

['② 不用等的情況（已經通關的關卡回來查資料）', async () => {
  const r = run(fakeDoc(), { sec: 0 });
  return [
    [r.done(), '★ sec = 0 → 立刻完成'],
    /* ⚠️ 不可以「開一個計時器，一秒後才發現其實不用等」——
       那一秒學生會看到按鈕先鎖起來再放開，看起來像壞掉。 */
    [r.log.length === 0, '   而且不會先閃一下秒數']
  ];
}],

['③ 切分頁／最小化 → 停', async () => {
  const d = fakeDoc();
  const r = run(d, { sec: 10 });
  await sleep(1200);
  const before = r.last().left;
  d.visibilityState = 'hidden';
  await sleep(2200);
  const a = [
    [r.last().state === 'pause', '★ hidden → 暫停'],
    [r.last().left === before, '   秒數不動（' + before + ' → ' + r.last().left + '）']
  ];
  r.c.stop();
  return a;
}],

/* ★ 這一段是 2026-08-11 的主角。
   視窗並排時這一頁還「看得見」，visibilityState 就是 'visible' ——
   只判 visibility 的話秒數照走，旁邊要做什麼都行。
   而且它把兩件事判反了：切分頁去開 Scratch 看題目（我們要的）
   反而被暫停，並列視窗在旁邊玩（我們不要的）照常倒數。 */
['④ ★ 並列視窗：看得見但焦點在別的視窗 → 也要停', async () => {
  const d = fakeDoc();
  const r = run(d, { sec: 10 });
  await sleep(1200);
  const before = r.last().left;
  d._focus = false;                       // visibilityState 還是 'visible'
  await sleep(2200);
  const a = [
    [d.visibilityState === 'visible', '（前提：頁面確實還看得見）'],
    [r.last().state === 'pause', '★ 焦點跑掉 → 暫停'],
    [r.last().left === before, '   秒數不動（' + before + ' → ' + r.last().left + '）']
  ];
  r.c.stop();
  return a;
}],

['⑤ ★ 寬限期：短暫離開只是暫停，回來接著算', async () => {
  const d = fakeDoc();
  const r = run(d, { sec: 10, awayReset: 4 });
  await sleep(1200);                       // 剩 9
  d._focus = false;
  await sleep(2200);                       // 離開 2 秒（< 4）
  d._focus = true;
  await sleep(1200);                       // 回來扣 1 秒
  const n = r.last().left;
  r.c.stop();
  return [[n >= 7 && n <= 9,
    '★ 接著算，不是從頭（剩 ' + n + '）—— ' +
    '通知跳出來、輸入法搶焦點、被老師叫一句話回頭，都在幾秒內結束，' +
    '而且發生在認真的學生身上最多']];
}],

['⑥ ★ 離開太久 → 從頭算', async () => {
  const d = fakeDoc();
  const r = run(d, { sec: 10, awayReset: 3 });
  await sleep(1200);                       // 剩 9
  d._focus = false;
  await sleep(4200);                       // 離開 4 秒（≥ 3）
  const a = [
    [r.last().state === 'reset', '★ 超過寬限期 → 狀態變成 reset（頁面要把這件事說出口）'],
    [r.last().left === 10, '   而且真的回到滿秒（' + r.last().left + '）']
  ];
  d._focus = true;
  await sleep(1200);
  a.push([r.last().left === 9, '   回來之後從滿秒開始扣（' + r.last().left + '）']);
  r.c.stop();
  return a;
}],

/* ⚠️ 下面兩條是「不可以擋錯人」，比上面所有條都重要。
   擋錯人的症狀是：畫面上一個不動的秒數，沒有錯誤訊息，
   學生只會覺得「它壞了」，而老師在講台上完全看不出發生什麼事。 */
['⑦ ★ 環境報不出焦點 → 當作有焦點（寧可放過）', async () => {
  /* jsdom 的 document.hasFocus() 永遠回 false；
     內嵌瀏覽器、看板模式也可能一直回 false。
     直接信的話倒數永遠停在原地。 */
  const d = fakeDoc();
  d._focus = false;                        // 從頭到尾沒有焦點
  const r = run(d, { sec: 3 });
  const d2 = fakeDoc({ noApi: true });      // 根本沒有 hasFocus 這個 API
  const r2 = run(d2, { sec: 2 });
  await sleep(2400);
  const a = [[r.last().state === 'run',
    '★ 從來沒回報過有焦點 → 不准拿失焦當離開（狀態 ' + r.last().state + '）']];
  await sleep(1400);
  a.push([r.done(), '   而且真的會走完']);
  a.push([r2.done(), '★ 沒有 hasFocus 這個 API 的環境也走得完']);
  r.c.stop(); r2.c.stop();
  return a;
}],

['⑧ ★ 保險絲：不管發生什麼事最久都會放行', async () => {
  /* sec × FUSE = 1 × 3 = 3 秒之後，就算還在「離開」狀態也照樣倒數。
     ★ 這也是「離開座位」的出口 ——
       一個被叫去辦公室的學生不該永遠回不來。 */
  const d = fakeDoc();
  const r = run(d, { sec: 1 });
  d.visibilityState = 'hidden';             // 從頭到尾都躲起來
  await sleep(5000);
  r.c.stop();
  return [[r.done(),
    '★ 一直是 hidden，超過 sec × FUSE 秒之後仍然放行 —— ' +
    '擋錯人的代價遠大於少讀 30 秒']];
}],

['⑨ stop() 之後不可以再動', async () => {
  const r = run(fakeDoc(), { sec: 10 });
  await sleep(1200);
  const n = r.log.length;
  r.c.stop();
  await sleep(2200);
  return [[r.log.length === n,
    '★ 停掉就是停掉（' + n + ' → ' + r.log.length + '）—— ' +
    '不停的話每重繪一次就多一個計時器，倒數會愈跳愈快而且看不出原因']];
}],

['接上去的人有沒有自己再判一次', async () => {
  const a = [];
  ['11502/level.html', '11501/flowchart.html'].forEach(f => {
    const src = fs.readFileSync(path.join(root, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');
    a.push([/READHOLD\.start\(/.test(src), f + ' 用的是共用規則']);
    /* ⚠️ 自己再判一次正是這次出事的原因。兩份規則一定會走鐘，
       而且走鐘的那一份不會有人發現 —— 它「看起來還在運作」。 */
    a.push([!/visibilityState|hasFocus/.test(src),
      '★ ' + f + ' 沒有自己再判一次「有沒有在讀」']);
  });
  return a;
}]

];

(async () => {
  const results = await Promise.all(SCENES.map(s => s[1]()));
  SCENES.forEach((s, i) => {
    console.log('\n── ' + s[0] + ' ──');
    results[i].forEach(r => ok(r[0], r[1]));
  });
  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
