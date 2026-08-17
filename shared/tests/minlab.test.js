/* 找最小值實驗室（第 5 關 蒙眼比高矮）
   跑法：node shared/tests/minlab.test.js

   ★ 這一關要教的是**變數**，不是排序。
     所以測試盯的不是「排得對不對」，而是：
       · 身高在通關前**真的看不到**（蒙眼壞掉的話整關的意義就沒了）
       · 沒有「記住」那一格就走不下去
       · 每個人都要比過，不能跳
       · 挑戰的答案是 n-1，不是 n

   ⚠️ UI 走查一律**用同一個實例從頭走到尾**。
      上次 searchlab 就是分兩個實例各掛一次，
      漏掉了「換一題永遠出同一題」—— 那一關學生根本過不了，而測試全綠。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.error('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(2); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
global.setTimeout = W.setTimeout = function (f) { return 0; };   // 閃爍的計時器不要真的跑

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* ⚠️ labtest.js 一定要先載 —— 少了它挑戰整段會靜靜地不做事，然後測試全綠。
   sortlab 和 searchlab 都各犯過一次同樣的錯。 */
W.eval(read('shared/labtest.js'));
W.eval(read('shared/minlab.js'));
const M = W.MINLAB, LT = W.LABTEST;

ok(!!M, '模組載得起來');
ok(!!LT, '★ LABTEST 也載進來了（少了它挑戰會靜靜地不做事）');

/* 固定亂數：測試要能重跑出一樣的結果 */
function seeded(seq) {
  let i = 0;
  return function () { const v = seq[i % seq.length]; i++; return v; };
}

/* ── ① 純函式 ─────────────────────────────────────── */
section('★ 出題');
{
  const it = M.makeCase({ n: 5 }, seeded([0.1, 0.5, 0.9, 0.3, 0.7]));
  ok(it.length === 5, '五個人');
  ok(it.every(p => p.v >= 138 && p.v <= 167), '身高都在 138～167 之間');
  const vs = it.map(p => p.v);
  ok(new Set(vs).size === 5,
     '★★ 身高不可以重複 —— 一樣高的話「誰比較矮」沒有答案，那一步就卡住了');
  ok(it.every(p => p.name), '每個人都有代號（不用真名，班上會有同名同姓）');

  /* ★ 最矮的不可以固定在第 1 個 */
  let firstIsMin = 0;
  for (let k = 0; k < 300; k++) {
    const c = M.makeCase({ n: 5 });
    if (M.minOf(c) === 0) firstIsMin++;
  }
  ok(firstIsMin === 0,
     '★★ 最矮的永遠不在第 1 個（' + firstIsMin + '/300）—— ' +
     '在第 1 個的話「先記住第一個」就直接過關，學生永遠遇不到「要換」那一步');
}

section('★ 比一下與判斷');
{
  const it = [{ id: 0, name: '甲', v: 150 }, { id: 1, name: '乙', v: 141 },
              { id: 2, name: '丙', v: 160 }];
  ok(M.minOf(it) === 1, '最矮的是乙');
  ok(M.shorter(it, 0, 1) === 1, '甲和乙比 → 乙比較矮');
  ok(M.shorter(it, 0, 2) === 0, '甲和丙比 → 甲比較矮');

  ok(M.judge(it, 0, 1, true).ok, '記住甲、比到乙（更矮）→ 換　＝ 對');
  ok(!M.judge(it, 0, 1, false).ok, '記住甲、比到乙（更矮）→ 不換 ＝ 錯');
  ok(/應該.*換成他|換成他/.test(M.judge(it, 0, 1, false).msg),
     '★ 而且要說「應該換成他」，不是只說錯');
  ok(/弄丟/.test(M.judge(it, 1, 0, true).msg),
     '★ 換錯的時候要講後果：把已經找到的矮子弄丟了');
  ok(M.judge(it, 1, 0, false).ok, '記住乙、比到甲（比較高）→ 不換 ＝ 對');
}

section('★★ 最少要比幾次 = n-1');
{
  ok(M.need(5) === 4, '五個人比 4 次');
  ok(M.need(3) === 2, '三個人比 2 次');
  ok(M.need(8) === 7, '八個人比 7 次');
  /* ⚠️ 這是這一關唯一的挑戰題，答案錯了整關就白做。
     兩個常見的錯答要分得出來：n（忘了第一個沒比）、n(n-1)/2（兩兩都比）。 */
  ok(M.need(5) !== 5, '★ 不是 5 —— 第一個人是直接記住的，沒有比');
  ok(M.need(5) !== 10, '★ 也不是 10（那是每兩個人都互比一次）');
}

section('★ 逐步示範');
{
  const it = [{ id: 0, name: '甲', v: 152 }, { id: 1, name: '乙', v: 141 },
              { id: 2, name: '丙', v: 160 }, { id: 3, name: '丁', v: 148 },
              { id: 4, name: '戊', v: 155 }];
  const s = M.demoSteps(it);
  ok(s.length === 5 + 1, '五個人 → 1 個起手 + 4 次比較 + 1 個結尾＝' + s.length + ' 步');
  ok(/直接記住/.test(s[0].note), '★ 第一步講明「第一個人直接記住，沒有比」');
  ok(s[0].at === -1, '   第一步不是比較');
  ok(s[s.length - 1].keep === 1, '★ 最後記住的是乙（141，最矮）');
  ok(/4/.test(s[s.length - 1].note), '   結尾報出總共比了 4 次');
  ok(s.slice(1, 5).every(x => /換/.test(x.note)),
     '★ 每一次比較都講「換」或「不換」—— 那正是要拼的那塊積木');
  const swaps = s.filter(x => x.swap).length;
  ok(swaps === 1, '   152→141 換一次，之後都不換（實際換 ' + swaps + ' 次）');
}

/* ── ② UI：從頭走到尾（同一個實例）───────────────── */
function mount(opts) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = M.mount(host, Object.assign({ n: 5 }, opts || {}));
  const cells = () => [...host.querySelectorAll('[data-i]')];
  const txt = () => host.textContent;
  const btn = re => [...host.querySelectorAll('button')].filter(b => re.test(b.textContent))[0];
  return { host, sim, cells, txt, btn, s: () => sim._s(),
           done: () => { sim.destroy(); host.remove(); } };
}

section('★★ 蒙眼：通關前身高一個字都不能露');
{
  const v = mount();
  ok(/\? \? \?/.test(v.txt()), '★★ 身高顯示成「? ? ?」');
  const nums = v.s().items.map(p => p.v);
  const leaked = nums.filter(x => v.host.innerHTML.indexOf(String(x)) >= 0);
  ok(leaked.length === 0,
     '★★ HTML 裡也找不到任何一個身高數字' +
     (leaked.length ? '（漏了：' + leaked.join('、') + '）' : '') +
     ' —— 漏出去的話 F12 一開就破功了');
  ok(/公分/.test(v.txt()) === false, '   連「公分」都還沒出現');
  v.done();
}

section('★★ 沒有「記住」那一格就走不下去');
{
  const v = mount();
  ok(/還是空的/.test(v.txt()), '★ 一開始「記住的最矮」是空的，而且說明為什麼要有它');
  ok(/沒有這一格/.test(v.txt()), '★★ 明講「沒有這一格，比出來的結果沒地方放」');
  ok(v.s().keep === null, '   狀態上也還沒記住任何人');

  v.cells()[2].onclick();
  ok(v.s().keep === 2, '★ 點一個人 → 進到「記住」那一格');
  ok(/記住/.test(v.txt()), '   畫面上看得到');
  ok(v.s().cmps === 0, '★★ 這一步**不算一次比較** —— 挑戰答案 n-1 就是從這裡來的');
  ok(/變數/.test(v.txt()), '★ 而且要點破：這一格就是變數');
  v.done();
}

section('★ 比一下：只講誰矮，不講身高');
{
  const v = mount();
  v.cells()[0].onclick();                    // 記住第 0 個
  const other = 1;
  v.cells()[other].onclick();                // 跟第 1 個比
  ok(v.s().pick === other, '選到了要比的那一個');
  ok(v.s().cmps === 1, '★ 比較次數 +1');
  ok(/比較矮/.test(v.txt()), '★ 畫面告訴你誰比較矮');
  const nums = v.s().items.map(p => p.v);
  ok(nums.every(x => v.host.innerHTML.indexOf(String(x)) < 0),
     '★★ 但**還是**看不到身高 —— 比一次就露數字的話，蒙眼就沒意義了');
  ok(!!v.btn(/換成他/) && !!v.btn(/不換/), '★ 出現「換成他／不換」兩顆按鈕');
  ok(v.s().seen[other] !== true,
     '★ 還沒回答之前不算「比過了」—— 不然按了不回答就能跳過');
  v.done();
}

section('★ 答錯不生效，而且要說清楚錯在哪');
{
  const v = mount();
  v.cells()[0].onclick();
  const st = v.s();
  /* 找一個比記住的更矮的人 —— 這種情況正確答案是「換」 */
  let target = -1;
  for (let i = 1; i < 5; i++) if (st.items[i].v < st.items[0].v) { target = i; break; }
  ok(target > 0, '找得到一個比第一個更矮的人（出題保證最矮的不在第 1 個）');
  v.cells()[target].onclick();
  v.btn(/不換/).onclick();                    // 故意答錯
  ok(v.s().keep === 0, '★★ 答錯 → 記住的**沒有**被改掉');
  ok(v.s().errs === 1, '   記一次失誤');
  ok(v.s().seen[target] !== true, '★ 也不算比過 —— 他還要再答一次');
  ok(/應該/.test(v.txt()), '★ 訊息講「應該怎樣」，不是只說你錯了');

  v.btn(/換成他/).onclick();                  // 這次答對
  ok(v.s().keep === target, '★ 答對 → 記住的換過去了');
  ok(v.s().seen[target] === true, '   這才算比過');
  v.done();
}

section('★★ 每個人都要比過才算找完（不能跳）');
{
  const v = mount();
  const st = v.s();
  v.cells()[0].onclick();
  /* 只比其中兩個，剩下的不管 */
  for (const i of [1, 2]) {
    v.cells()[i].onclick();
    const cur = v.s().keep;
    v.btn(v.s().items[i].v < v.s().items[cur].v ? /換成他/ : /不換/).onclick();
  }
  ok(!v.s().passed, '★★ 還有人沒比過 → 不算通關');
  ok(/還沒比過的有 /.test(v.txt()), '★ 畫面上明講還有幾個沒比過');
  ok(/\? \? \?/.test(v.txt()), '   身高也還沒公開');

  /* 已經比過的再點一次，要擋掉並說明。
     ⚠️ 不可以寫死點第 1 個 —— 他有可能剛好被換進「記住」那一格，
        那樣走到的是「自己跟自己比」那條分支，測試會**隨機**紅一次。
        （這一條本來就是這樣寫的，跑了三遍才紅一次。）
     ⇒ 挑一個「比過了、但不是記住的」。 */
  const seenNotKeep = [1, 2].filter(i => i !== v.s().keep)[0];
  ok(seenNotKeep !== undefined, '找得到一個比過但不是記住的人');
  v.cells()[seenNotKeep].onclick();
  ok(/已經比過/.test(v.txt()), '★ 點已經比過的 → 明講，不是靜靜沒反應');
  ok(v.s().cmps === 2, '   而且不會多算一次比較');
  v.cells()[v.s().keep].onclick();
  ok(/自己跟自己比/.test(v.txt()), '★ 點記住的那一個 → 也擋掉並說明');
  v.done();
}

section('★★ 全部比完：通關、公開身高、找到的真的是最矮的');
{
  const v = mount();
  v.cells()[0].onclick();
  for (let i = 1; i < 5; i++) {
    v.cells()[i].onclick();
    const cur = v.s().keep;
    v.btn(v.s().items[i].v < v.s().items[cur].v ? /換成他/ : /不換/).onclick();
  }
  const s = v.s();
  ok(s.passed, '★ 五個人都比過 → 通關');
  ok(s.cmps === 4, '★★ 總共比了 4 次（= n-1，和挑戰的答案對得起來）');
  ok(s.keep === M.minOf(s.items),
     '★★ 記住的**真的是**最矮的那一個');
  ok(/公分/.test(v.txt()), '★ 通關之後身高才公開');
  ok(v.host.innerHTML.indexOf(String(s.items[0].v)) >= 0, '   數字真的畫出來了');
  ok(/第 6 關/.test(v.txt()), '★ 而且接到下一關：這就是第 6 關要拼的東西');
  v.done();
}

section('★★ 驗收挑戰：答案是 4，不是 5');
{
  const v = mount();
  v.cells()[0].onclick();
  for (let i = 1; i < 5; i++) {
    v.cells()[i].onclick();
    const cur = v.s().keep;
    v.btn(v.s().items[i].v < v.s().items[cur].v ? /換成他/ : /不換/).onclick();
  }
  ok(v.s().lvNow === 1, '★ 通關之後挑戰自動打開');
  ok(/最少/.test(v.txt()), '★ 問的是「最少」要比幾次，不是「你剛才比了幾次」');
  const g = () => v.host.querySelector('#ml-g');
  const send = () => [...v.host.querySelectorAll('[data-g]')][0].onclick();

  g().value = 5; send();
  ok(v.s().stars === 0, '★★ 答 5 → 不算對');
  ok(/第一個人/.test(v.txt()),
     '★★ 而且要點出**為什麼**不是 5：第一個人是直接記住的，沒有比');

  g().value = 10; send();
  ok(v.s().stars === 0, '答 10（兩兩都比）→ 也不對');
  ok(/互相比|每兩個/.test(v.txt()), '★ 而且說明 10 是哪一種比法的次數');

  g().value = 4; send();
  ok(v.s().stars === 1, '★★ 答 4 → 過關，拿到徽章');
  ok(/★/.test(v.host.innerHTML), '   證書畫出來了');
  v.done();
}

section('★★ 只有一關的證書，不可以叫學生去挑戰下一關');
{
  /* ⚠️ 第 5 關只有一個挑戰。沿用三關的證書文案的話，
     學生會在畫面上找一個**不存在**的下一關。 */
  const one = LT.certificate(1, { title: '找出最小值　驗收挑戰', single: true });
  ok(!/升級/.test(one), '★★ single 的證書沒有「再挑戰下一關就能升級」');
  ok(/過了就是過了/.test(one), '★ 換成「這一關是前導關，挑戰只有這一題」');
  ok((one.match(/★/g) || []).length === 1, '★★ 只畫一顆星（不是 ★☆☆）');
  ok(!/☆/.test(one), '★★ 也沒有空心星 —— 他其實全過了，不該看起來像只拿三分之一');
  ok(!/銅牌/.test(one), '   不標銅銀金（那是三關制的說法）');

  /* 三關制的沒有被改壞 */
  const three = LT.certificate(1, { title: '選擇排序法　驗收挑戰' });
  ok(/升級/.test(three), '★ 三關制的證書照樣寫「再挑戰下一關」');
  ok((three.match(/★/g) || []).length === 1 && /☆/.test(three),
     '   三關制拿 1 顆畫成 ★☆☆');
  ok(/銅牌/.test(three), '   而且標銅牌');
}

section('★ 換一組人：題目真的會變，徽章不會被清掉');
{
  const v = mount();
  v.cells()[0].onclick();
  for (let i = 1; i < 5; i++) {
    v.cells()[i].onclick();
    const cur = v.s().keep;
    v.btn(v.s().items[i].v < v.s().items[cur].v ? /換成他/ : /不換/).onclick();
  }
  v.host.querySelector('#ml-g').value = 4;
  [...v.host.querySelectorAll('[data-g]')][0].onclick();
  ok(v.s().stars === 1, '先拿到徽章');

  const before = v.s().items.map(p => p.v).join(',');
  let changed = false;
  for (let k = 0; k < 12 && !changed; k++) {
    v.btn(/換一組人/).onclick();
    if (v.s().items.map(p => p.v).join(',') !== before) changed = true;
  }
  ok(changed, '★★ 「換一組人」真的換了一組（searchlab 就栽在這裡：永遠是同一題）');
  ok(v.s().stars === 1, '★★ 而且徽章沒有被清掉 —— 想再玩一次不該賠掉已經拿到的');
  ok(!v.s().passed, '   新的一組要重新走');
  ok(/\? \? \?/.test(v.txt()), '★ 新的一組身高又蓋起來了');
  v.done();
}

section('★ 逐步示範：通關才給看');
{
  const v = mount();
  ok(!v.btn(/一步一步/), '★★ 還沒通關看不到逐步示範 —— 先看答案的話那只是一串沒來由的動作');
  v.cells()[0].onclick();
  for (let i = 1; i < 5; i++) {
    v.cells()[i].onclick();
    const cur = v.s().keep;
    v.btn(v.s().items[i].v < v.s().items[cur].v ? /換成他/ : /不換/).onclick();
  }
  ok(!!v.btn(/一步一步/), '★ 通關之後出現');
  ok(/記住的 ←/.test(v.txt()), '★ 而且直接畫出對應的積木');
  ok(/如果/.test(v.txt()) && /那麼/.test(v.txt()), '   看得到「如果…那麼」');

  v.btn(/一步一步/).onclick();
  ok(/第 1 步／6/.test(v.txt()), '★ 按一下走到第 1 步（共 6 步）');
  ok(/直接記住/.test(v.txt()), '   第 1 步講「第一個人直接記住」');
  for (let k = 0; k < 5; k++) v.btn(/下一步|從頭再看/).onclick();
  ok(/第 6 步／6/.test(v.txt()), '★ 走得完六步');
  ok(!!v.btn(/從頭再看/), '   到最後一步變成「從頭再看一次」');
  v.done();
}

section('★★ 隨機走查一百遍：照規則走一定找得到最矮的');
{
  /* ⚠️ 上面那幾段都是我挑好的路徑。
     真正要保證的是：**任何**出題、任何順序，只要每一步都答對，
     最後記住的一定是最小值。 */
  let bad = 0, notFour = 0;
  for (let k = 0; k < 100; k++) {
    const v = mount();
    const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
    v.cells()[order[0]].onclick();
    for (let j = 1; j < 5; j++) {
      const i = order[j];
      v.cells()[i].onclick();
      const cur = v.s().keep;
      v.btn(v.s().items[i].v < v.s().items[cur].v ? /換成他/ : /不換/).onclick();
    }
    const s = v.s();
    if (!s.passed || s.keep !== M.minOf(s.items)) bad++;
    if (s.cmps !== 4) notFour++;
    v.done();
  }
  ok(bad === 0, '★★ 一百遍都找到最矮的（失敗 ' + bad + ' 次）');
  ok(notFour === 0, '★★ 而且不管從誰開始，都剛好比 4 次（例外 ' + notFour + ' 次）');
}

section('★ 說明講的東西畫面上要有');
{
  /* ⚠️ 說明叫學生按一顆不存在的按鈕，是最難發現的一種錯 ——
     學生在畫面上找不到，而系統不會報任何錯。 */
  const v = mount();
  ok(/點一個人/.test(v.txt()), '說明叫他「點一個人」');
  ok(v.cells().length === 5, '   畫面上真的有五個點得到的人');
  v.cells()[0].onclick(); v.cells()[1].onclick();
  const btns = [...v.host.querySelectorAll('button')].map(b => b.textContent.trim());
  ok(/要不要換|要換成/.test(v.txt()), '說明講「你要自己決定要不要換」');
  ok(btns.some(b => b === '換成他') && btns.some(b => b === '不換'),
     '★ 兩顆按鈕的字和說明用的詞一模一樣');
  const src = read('shared/minlab.js');
  ok(/記住的最矮/.test(src) && /🧠/.test(src), '「記住的最矮」那一格有標示');
  v.done();
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
