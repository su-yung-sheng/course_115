/* 第三節課的三個檢核（無段風扇）
   跑法：node shared/tests/fanlab.test.js   （需要 jsdom）

   ★ 老師 2026-08-24：「重點在於風扇的轉動與可變電阻的讀取轉換」

   ⚠️⚠️ 這一節的核心是**負數**：實際程式寫的是
        轉速 ← 類比對應(A7, -250, 250)
      所以旋鈕**正中間 = 0 = 停**。
      ★ 舊草稿寫成 0～255，那是錯的 —— 中間那個「停」會整個不見。
      這一支的斷言就是釘死那件事。 */
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
['shared/ultralab.js', 'shared/ai-guide.js', 'shared/answer.js',
 'shared/labkit.js', 'shared/fanlab.js'].forEach(f => new Function('window', read(f))(W));
const F = W.FANLAB, U = W.ULTRALAB;

section('★★ 範圍：−250 ～ 250（不是 0～255）');
{
  ok(F.LO === -250 && F.HI === 250, '★★ 課本那組是 ' + F.LO + ' ～ ' + F.HI);
  ok(F.LO < 0, '★★ 下限是**負的** —— 這一節的核心');
  ok(F.PIN === 'A7', '★ 腳位 A7（不是舊草稿寫的 A0）');

  /* ★★ 最重要的一格：旋鈕正中間 = 0 = 停。 */
  ok(F.speedAt(50) === 0, '★★ 旋鈕正中間 → 0');
  ok(F.stateOf(F.speedAt(50)) === 'stop', '★★ 而 0 代表**停止**（不是「一半的速度」）');
  ok(F.speedAt(0) === -250 && F.stateOf(-250) === 'back', '★ 最左 → −250（反轉）');
  ok(F.speedAt(100) === 250 && F.stateOf(250) === 'fwd', '★ 最右 → 250（正轉）');
  ok(F.stateOf(-1) === 'back' && F.stateOf(1) === 'fwd', '   只有剛好 0 才算停');
}

section('★★ A：出題與判定');
{
  /* 出題要涵蓋三種狀態 —— 只出正轉的話，「中間會停」永遠考不到。 */
  const seen = {};
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    const c = F.caseA(U.rngFrom('a' + i), null);
    seen[c.state] = (seen[c.state] || 0) + 1;
    if (!Number.isInteger(c.answer)) bad++;
    if (c.pct === 0 || c.pct === 100) bad++;      // 兩端太好猜
    if (c.answer !== F.speedAt(c.pct)) bad++;
  }
  ok(bad === 0, '★ 答案都是整數、不出兩端、而且和 speedAt 一致');
  ok(seen.back && seen.fwd && seen.stop,
     '★★ 三種狀態都會出（反轉 ' + seen.back + '／停 ' + (seen.stop || 0) +
     '／正轉 ' + seen.fwd + '）—— 不出「停」的話，這一節的重點就考不到');

  const c = { pct: 25, answer: -125, state: 'back' };
  ok(F.judgeA(-125, c).ok, '答對過關');
  ok(!F.judgeA(125, c).ok, '★★ 漏了負號 → 不過');
  ok(!F.judgeA('', c).ok, '   空白不過');
  ok(!F.judgeA(63, c).ok, '★★ 照「0～250」算 → 不過');

  /* ⚠️ 回饋要指出**是哪一種想錯**。 */
  ok(/少了負號/.test(F.sayA(125, c)), '★★ 漏負號 → 點破「少了負號」');
  ok(/反方向/.test(F.sayA(125, c)), '   而且講清楚負號代表什麼');
  ok(/0 到 250|下限是/.test(F.sayA(63, c)), '★ 照 0～250 算 → 點破下限是負的');
  const mid = F.sayA(200, { pct: 50, answer: 0, state: 'stop' });
  ok(/正中間/.test(mid), '★ 中間那一題答錯 → 提示指向「正中間會是哪個數字」');
  ok(mid.indexOf('是 0') < 0, '★★ 而且提示裡不直接把 0 講出來');
}

section('★★ B：三組情境，壞的都是「下限寫成 0」');
{
  ok(F.CASES_B.length === 3, '三組（' + F.CASES_B.map(c => c.key).join('／') + '）');
  ok(F.CASES_B.every(c => c.fixes.filter(f => f.good).length === 1 &&
                          c.fixes.filter(f => f.good)[0].key === 'neg'),
     '★★ 每一組的正解都是「把下限改成負的」—— 那是概念，沒得換');
  ok(F.CASES_B.every(c => c.fixes.length === 3 && c.fixes.every(f => f.after && f.after.length > 10)),
     '★★ 每一個選項都有「執行後會看到什麼」');
  /* 和前兩節同一個原則：症狀先講「這一支要做的是什麼」。 */
  ok(F.CASES_B.every(c => /這一支要做的是/.test(c.symptom)),
     '★★ 症狀先講「要做的是什麼」，不是直接說它壞了');
  /* ★ 「0 也可能是對的」要老實講 —— 只往一個方向轉時，0 就是正解。 */
  ok(/如果你要的是/.test(F.CASES_B[0].fixes[0].after),
     '★★ 正解要補一句「只往一邊轉的話，0 就是對的」—— 不可以把 0 講成絕對的錯');
  /* 錯的選項要講這一組自己的東西。 */
  ok(/倒車|後退/.test(F.CASES_B[1].symptom) && /升降|下降/.test(F.CASES_B[2].symptom),
     '★ 三組是不同的東西（風扇／遙控車／升降台）');
}

section('★★ B：用自己的話說（每一節都保留）');
{
  const c = F.CASES_B[0];
  ok(F.SAY.full === 1, '★★ 講到任一個概念就算過');
  ok(F.judgeSay('因為負數代表馬達會反過來轉', c).level !== 'none', '「負數＝反轉」→ 過');
  ok(F.judgeSay('這樣旋鈕轉到中間才會停下來', c).level !== 'none', '「中間才會停」→ 過');
  ok(F.judgeSay('', c).level === 'none', '   空白 → 不過');
  ok(F.judgeSay('我覺得就是這樣啊', c).level === 'none', '   空話 → 不過');
  ok(F.judgeSay(c.fixes[0].after, c).level === 'none', '★★ 抄「執行結果」→ 不過');

  const src = read('shared/fanlab.js');
  ok(!/global\.ANSWER|global\.ASKAI/.test(src), '★★ 不自己碰 ANSWER／ASKAI，一律經過 labkit');
  ok(/unit: '5016b-u3-B'/.test(src), '★ AI 覆核帶自己的單元代號');
}

section('★★ C：自己填兩個數字');
{
  const both = F.GOALS.filter(g => g.key === 'both')[0];
  ok(F.judgeC(-250, 250, both).ok, '★ 中間停、兩邊轉 → −250／250');
  ok(F.judgeC(250, -250, both).how === 'swap', '★★ 對調 → 判 swap');
  ok(F.judgeC(-100, 100, both).how === 'range', '★★ 方向對但沒用滿 → 判 range');
  ok(F.judgeC(0, 250, both).how === 'dir', '★★ 下限寫 0 → 判 dir（方向不對）');
  ok(F.judgeC('', 250, both).how === 'bad', '   沒填 → 判 bad');
  ok(F.judgeC('abc', 250, both).how === 'bad', '   非數字不當成 0');

  /* ★★ 目標會換 —— 而且「只往一邊轉」那一組的正解是 0～250。 */
  const one = F.GOALS.filter(g => g.key === 'oneway')[0];
  ok(F.judgeC(0, 250, one).ok, '★★ 換成「只往一邊轉」時，0～250 反而是對的');
  ok(!F.judgeC(-250, 250, one).ok, '   這時候 −250～250 就不對了');
  const rev = F.GOALS.filter(g => g.key === 'rev')[0];
  ok(F.judgeC(-250, 0, rev).ok, '★ 「只往反邊轉」→ −250／0');
  ok(F.GOALS.length === 3, '三種目標');

  /* 四種錯的回饋要分得開。 */
  const msgs = ['swap', 'range', 'dir', 'bad'].map(h => F.sayC({ how: h }, both));
  ok(new Set(msgs).size === 4, '★★ 四種錯的回饋各不相同');
  ok(/對調/.test(msgs[0]) && /沒有用滿/.test(msgs[1]) && /停在哪裡/.test(msgs[2]),
     '   而且各自指出該往哪裡調');
}

section('★★ 三階段真的走得完');
{
  const box = W.document.getElementById('x');
  let said = null, done = null;
  const d = F.mount(box, { seed: 'zz', onSay: (t, r) => { said = { t, r }; },
                                       onDone: i => { done = i; } });
  ok(d.step() === 'A' && !!box.querySelector('#fn-pred'), '從 A 開始，先填「你猜轉速多少」');
  ok(/❓/.test(box.textContent), '★ 還沒按之前不先把答案畫出來');

  box.querySelector('#fn-pred').value = d.aCase().answer;
  box.querySelector('#fn-runA').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(d.step() === 'B', '★ A 過了進到 B');

  box.querySelector('[data-fix="neg"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!box.querySelector('#dl-say'), '★★ 選對了**還不能寫** —— 中間還有「先講會發生什麼」');
  ok(box.querySelectorAll('[data-pred]').length === 3, '   預測題有三個候選結果');
  box.querySelector('[data-pred="neg"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!box.querySelector('#dl-say'), '★ 兩個都對 → 才出現作答框');

  box.querySelector('#dl-say').value = '因為負數代表馬達會反過來轉';
  box.querySelector('#dl-runB').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(d.step() === 'C', '★ 說得出來 → 進到 C');
  ok(said && /負數/.test(said.t), '★★ onSay 把原文交出去');

  const g = d.cCase();
  box.querySelector('#fn-lo').value = g.want[0];
  box.querySelector('#fn-hi').value = g.want[1];
  box.querySelector('#fn-runC').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!!done, '★ C 也過 → 回報 onDone');
  ok(!/\*\*/.test(box.textContent), '★ 結尾有過 md()（不然 **粗體** 會原樣顯示）');
}

section('★ 骨架與頁面');
{
  const src = read('shared/fanlab.js');
  ok(/LK\(\)\.pick\(/.test(src), '★ 換一題走 labkit 的 pick');
  ok(/if \(!global\.LABKIT\) throw new Error/.test(src), '★★ labkit 沒載到要明講');
  ok(!/FANLAB/.test(read('shared/labkit.js')), '★★ labkit 不知道 fanlab（相依單向）');
  ok(!/stars/.test(src), '★★ 不碰 stars');
  /* ★ 停的時候風扇圖不可以還在轉 —— 畫面和數字自相矛盾最糟。 */
  ok(/s === 'stop' \? '🌀'/.test(src), '★ 停止時的圖示和轉動時不一樣');

  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/fanlab\.js"><\/script>/.test(page), '頁面載入 fanlab');
  ok(new RegExp("lab: \\{ unit: 'u3', warm: 'POTLAB', checks: 'FANLAB'").test(page),
     '★ 第三節：暖身 POTLAB ＋ 檢核 FANLAB');

  /* ⚠️ 虛擬碼要和 .sb3 一致 —— 舊草稿寫 A0、0~1023、0~255，全是錯的。 */
  const u3 = page.slice(page.indexOf('title: "無段風扇：可變電阻與馬達"'),
                        page.indexOf('title: "情境照明'));
  ok(/類比對應/.test(u3), '★★ 虛擬碼用「類比對應」這塊專用積木（不是上一節的「對應」）');
  ok(/-250/.test(u3) && /250/.test(u3), '★★ 範圍寫 −250～250');
  ok(!/0～255|0~255|0, 1023|0~1023 對應/.test(u3),
     '★★ 不再出現舊草稿那組（0～255、自己換算 0～1023）');
  ok(/A7/.test(u3) && !/類比腳位 A0/.test(u3), '★ 腳位是 A7，不是 A0');
  ok(/面向/.test(u3) && /設定馬達/.test(u3), '★ 兩個角色（指針、風扇）都寫出來');
  ok(/正中間/.test(u3) && /停/.test(u3), '★★ 要點出「旋鈕正中間 = 0 = 停」');
  ok(/÷ 5|除以 5/.test(u3), '   而且說明「÷5」只是畫面上的風扇圖，和馬達無關');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
