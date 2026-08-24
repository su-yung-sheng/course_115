/* 第二節課的三個檢核（迎賓走廊）
   跑法：node shared/tests/lightlab.test.js   （需要 jsdom：真的把互動點一遍）

   ★★ 骨架和第一節一模一樣：先講你認為會怎樣 → 再執行 → 說對了才算。
      所以每一條「過關」的斷言，都要同時檢查**預測**和**結果**。

   ★ 老師 2026-08-24：「檢核 B 一樣有保留對話輸入當成最後確認吧?」
     ⇒ B 的第三階段是開放式作答（本機關鍵字判定 ＋ AI 覆核只加分）。 */
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
/* ⚠️ askai.js 故意不載 —— 沒有 KEY 就是學生的預設狀態。 */
['shared/ultralab.js', 'shared/ai-guide.js', 'shared/answer.js',
 'shared/labkit.js', 'shared/maplab.js', 'shared/lightlab.js']
  .forEach(f => new Function('window', read(f))(W));
const L = W.LIGHTLAB, U = W.ULTRALAB, M = W.MAPLAB;

section('★★ A：出題一定要出得出來');
{
  /* ⚠️⚠️ 1→8 是八顆燈，但中間只有**七格**間隔。
     第一版的距離上限用 40／50／60／80，d×7/hi 永遠除不盡 ——
     一個乾淨的位置都長不出來，caseA 直接回 null，整關掛掉。
     ★ 那不是「畫面怪怪的」，是「按下去沒反應」—— 只有這種測試抓得到。 */
  let nul = 0, bad = 0, revs = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const c = L.caseA(U.rngFrom('s' + i), null);
    n++;
    if (!c) { nul++; continue; }
    if (!Number.isInteger(c.answer) || c.answer < 1 || c.answer > L.N_LED) bad++;
    if (!Number.isInteger(c.other)) bad++;
    /* 正反同值的位置不可以出 —— 答對不代表他知道方向。 */
    if (c.answer === c.other) bad++;
    if (c.rev) revs++;
  }
  ok(nul === 0, '★★ 每一次都出得出題（' + n + ' 次，null ' + nul + ' 次）');
  ok(bad === 0, '★★ 答案都是 1～' + L.N_LED + ' 的整數，而且和「反過來算」不同值');
  ok(revs > 30 && revs < 270, '★ 正向與反向都會出（反向 ' + revs + '／' + n + '）—— 固定方向就變成背口訣');
}

section('★★ A：判定與回饋');
{
  const c = L.caseA(U.rngFrom('t'), null);
  ok(L.judgeA(c.answer, c).ok, '答對過關（' + L.textA(c) + '，距離 ' + c.d + ' → 第 ' + c.answer + ' 顆）');
  ok(!L.judgeA(c.other, c).ok, '★★ 答「方向相反的那一顆」不過關（' + c.other + '）');
  ok(!L.judgeA('', c).ok, '   空白不過關');
  ok(/方向相反/.test(L.sayA(c.other, c)), '★ 回饋要點破「你算的是方向相反的那一種」');
  ok(L.sayA(c.other, c).indexOf('第 ' + c.answer + ' 顆') < 0, '★★ 回饋裡不直接給正解');
}

section('★★ B：三組情境，壞的是同一件事');
{
  ok(L.CASES_B.length === 3, '三組（' + L.CASES_B.map(c => c.key).join('／') + '）');
  ok(L.CASES_B.every(c => c.fixes.filter(f => f.good).length === 1 &&
                          c.fixes.filter(f => f.good)[0].key === 'off'),
     '★★ 每一組的正解都是「亮完把它關掉」—— 那是概念，沒得換');
  ok(L.CASES_B.every(c => c.fixes.length === 3 && c.fixes.every(f => f.after && f.after.length > 10)),
     '★★ 每一個選項都有「執行後會看到什麼」（猜錯的代價是眼見為憑）');
  /* 錯的選項要講**這一組自己的東西**，不可以三組共用一句。 */
  ok(/格/.test(L.CASES_B[1].fixes.map(f => f.after).join()) &&
     /電量/.test(L.CASES_B[2].fixes.map(f => f.after).join()),
     '★ 錯的選項講的是那一組自己的情境');
  /* ★ 有一個錯的選項其實「畫面會對」（先清整條再亮一顆）——
     要老實講出它為什麼不是這一題要的，不能假裝它是錯的。 */
  ok(/其實會動|畫面是對的/.test(L.CASES_B[1].fixes.map(f => f.after).join()),
     '★★ 那個「其實也行得通」的選項要老實說明，不可以硬拗成錯');

  /* ★★ 老師 2026-08-24：「表示這是兩種效果，讓學生使用比較」
     ⚠️ 教材的比較區塊已經說了「留著不一定是壞掉」——
        B 這裡再講成「錯」，學生會發現前後矛盾，而且他是對的。
     ⇒ 題幹要問的是「這一支**要做的是**位置，可是它做出來的是長度」。 */
  ok(L.CASES_B.every(c => /這一支要做的是/.test(c.symptom)),
     '★★ 每一組的症狀都先講「這一支要做的是什麼」，不是直接說它壞了');
  ok(/兩種都對/.test(L.CASES_B[0].fixes[0].after),
     '★★ 正解的說明要補一句「想做長度就是故意不關」—— 和教材的比較區塊對得上');
}

section('★★ B：用自己的話說（老師 2026-08-24 指定保留）');
{
  const c = L.CASES_B[0];
  ok(L.SAY.full === 1, '★★ 講到任一個概念就算過（寧可放過，不可錯殺）');
  ok(L.judgeSay('不關掉的話走過的燈會全部留著', c).level !== 'none', '「會留著」→ 過');
  ok(L.judgeSay('我們只想知道現在在哪一顆', c).level !== 'none', '「現在在哪一顆」→ 過');
  ok(L.judgeSay('', c).level === 'none', '   空白 → 不過');
  ok(L.judgeSay('我覺得就是這樣啊', c).level === 'none', '   空話 → 不過');
  /* ★★ 抄來的不算，而且要比**抽到的那一組**。 */
  /* ⚠️ 要挑一段「不擋的話**會過**」的文字來測，不然測不到抄襲比對。
     選項的標題本來就不含關鍵字，拿它去測，把比對關掉照樣紅 ——
     真正危險的是「執行結果」那段（裡面有「一顆」「位置」，關鍵字全中）。 */
  ok(L.judgeSay(c.fixes[0].after, c).level === 'none',
     '★★ 把「執行結果」那段複製貼上 → 不過（不然貼一下就過關了）');
  ok(L.judgeSay(c.fixes[0].text, c).level === 'none', '   把正確選項複製貼上 → 也不過');
  ok(L.judgeSay(L.CASES_B[2].fixes[0].text, L.CASES_B[2]).level === 'none',
     '   換一組也一樣（抄襲比對跟著情境走）');
  /* 引擎要走 labkit，不可以自己再寫一套關鍵字規則。 */
  const src = read('shared/lightlab.js');
  ok(!/global\.ANSWER|global\.ASKAI/.test(src),
     '★★ lightlab 自己不碰 ANSWER／ASKAI，一律經過 labkit');
  ok(/LK\(\)\.judgeSay/.test(src) && /LK\(\)\.reviewSay/.test(src), '   判定與覆核都向 labkit 要');
  ok(/unit: '5016b-u2-B'/.test(src), '★ AI 覆核帶自己的單元代號（額度分帳、和第一節分開）');
}

section('★★ C：自己填四個數字');
{
  const c = { hi: 50, out: 200, near: true };     // 目標：越近越亮
  ok(L.judgeC(50, 0, 0, 200, c).ok, '★ 50→0、0→200 → 過（把輸入倒過來）');
  ok(L.judgeC(0, 50, 200, 0, c).ok, '   0→50、200→0 → 也過（把輸出倒過來，效果一樣）');
  ok(L.judgeC(0, 50, 0, 200, c).how === 'dir', '★★ 方向反了 → 判 dir');
  ok(L.judgeC(50, 10, 0, 200, c).how === 'range', '★★ 沒用滿（10 不是 0）→ 判 range');
  ok(L.judgeC(50, 0, 0, 150, c).how === 'range', '   輸出沒用滿 → 也是 range');
  ok(L.judgeC('', 0, 0, 200, c).how === 'bad', '   有格子沒填 → 判 bad');
  ok(L.judgeC('abc', 0, 0, 200, c).how === 'bad', '   非數字不當成 0');

  const far = { hi: 50, out: 200, near: false };  // 目標：越近越暗
  ok(L.judgeC(0, 50, 0, 200, far).ok, '★ 目標是反過來的時候，答案也跟著反過來');
  ok(L.judgeC(50, 0, 0, 200, far).how === 'dir', '   這時候「55→1」反而是錯的');

  /* ⚠️ 三種錯的回饋一定要不一樣 —— 學生要從「哪一種錯」知道往哪裡調。 */
  const dir = L.sayC(L.judgeC(0, 50, 0, 200, c), c);
  const rng2 = L.sayC(L.judgeC(50, 10, 0, 200, c), c);
  ok(/方向反了/.test(dir) && /用滿/.test(rng2) && dir !== rng2,
     '★★ 方向錯和範圍錯的回饋不一樣');
  ok(/一樣會亮|看不出來/.test(dir),
     '★★ 方向錯要提醒「燈一樣會亮，光看畫面看不出來」—— 這一節最要命的地方');

  /* 目標要會換（背不起來） */
  let nears = 0;
  for (let i = 0; i < 200; i++) if (L.caseC(U.rngFrom('c' + i), null).near) nears++;
  ok(nears > 20 && nears < 180, '★ 目標會換（越近越亮 ' + nears + '／200）');
}

section('★★ 三階段真的走得完');
{
  const box = W.document.getElementById('x');
  let said = null, done = null;
  const d = L.mount(box, { seed: 'zz', onSay: (t, r) => { said = { t, r }; },
                                       onDone: i => { done = i; } });
  ok(d.step() === 'A' && !!box.querySelector('#ll-pred'), '從 A 開始，而且先填「你猜第幾顆」');
  ok(box.querySelectorAll('.ll-led').length === L.N_LED, '★ 畫得出一條 ' + L.N_LED + ' 顆的燈條');

  box.querySelector('#ll-pred').value = d.aCase().answer;
  box.querySelector('#ll-runA').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(d.step() === 'B', '★ A 過了進到 B');
  ok(box.querySelectorAll('.ll-led.was').length > 0,
     '★★ B 一開場就把「走過的都留著」畫出來 —— 光用文字說學生沒感覺');

  /* ★★ 選對修法還不算完 —— 中間要先講會發生什麼。 */
  box.querySelector('[data-fix="off"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!box.querySelector('#dl-say'), '★★ 選對了**還不能寫** —— 中間還有「先講會發生什麼」');
  ok(box.querySelectorAll('[data-pred]').length === 3, '   預測題有三個候選結果');

  /* 先測「預測錯」：修法對但猜錯，一樣不過。 */
  const before = d.bCase().key;
  const wrongPred = d.bCase().fixes.filter(f => !f.good)[0].key;
  box.querySelector('[data-pred="' + wrongPred + '"]')
     .dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!box.querySelector('#dl-say') && d.step() === 'B',
     '★★ 修法對但**預測錯** → 不給寫，還留在 B');
  ok(d.bCase().key !== before, '   而且換一個東西壞掉（' + before + ' → ' + d.bCase().key + '）');

  /* 這次兩個都對 */
  box.querySelector('[data-fix="off"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  box.querySelector('[data-pred="off"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!box.querySelector('#dl-say') && !!box.querySelector('#dl-runB'),
     '★ 兩個都對 → 才出現作答框（老師指定保留的那一格）');
  ok(box.querySelectorAll('.ll-led.on').length === 1,
     '★★ 而且要把「修好之後只剩一顆」畫給他看');

  box.querySelector('#dl-say').value = '因為不關掉的話走過的燈會全部留著';
  box.querySelector('#dl-runB').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(d.step() === 'C', '★ 說得出來 → B 完成，進到 C');
  ok(said && /留著/.test(said.t), '★★ onSay 把**原文**交出去（老師要看的是他的說法）');

  const cc = d.cCase();
  const four = ['#ll-a', '#ll-b', '#ll-x', '#ll-y'];
  const vals = cc.near ? [cc.hi, 0, 0, cc.out] : [0, cc.hi, 0, cc.out];
  four.forEach((id, i) => { box.querySelector(id).value = vals[i]; });
  box.querySelector('#ll-runC').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!done, '★ C 也過 → 回報 onDone');
  ok(/三個檢核都完成/.test(box.textContent), '   而且畫面上講清楚完成了');
}

section('★ 骨架沒有走鐘（和第一節同一套）');
{
  const src = read('shared/lightlab.js');
  ok(/LK\(\)\.pick\(rng, CASES_B, prev\)/.test(src), '★ 換一題走 labkit 的 pick（不自己再寫一份）');
  ok(/LK\(\)\.tabsHtml/.test(src) && /LK\(\)\.sayHtml/.test(src), '   版面也走 labkit');
  ok(!/LIGHTLAB/.test(read('shared/labkit.js')), '★★ labkit 不知道 lightlab 的存在（相依單向）');
  ok(/if \(!global\.LABKIT\) throw new Error/.test(src),
     '★★ labkit 沒載到要明講（靜默半殘的症狀是「按了沒反應」）');
  ok(/if \(!global\.MAPLAB\) throw new Error/.test(src), '   maplab 也一樣（換算要用它）');
  /* 不計星（同第一節）。 */
  ok(!/stars/.test(src), '★★ 這一支完全不碰 stars —— 5016B 不計星');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
