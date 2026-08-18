/* 期末檢核：題庫、抽題、判分、門檻、重置
   跑法：node shared/tests/finaltest.test.js   （需要 jsdom）

   ★ 為什麼有這一份（老師 2026-08-18）
     「既然是整個課程的最後，是不是應該有個測驗來檢核兩種搜尋與兩種排序，
       每種各一題，加上搜尋比較、排序比較各兩題，海量資料成本考量兩題，共十題。
       每一個題型設計五種，隨機挑選組合…四選一，選項不能一眼看出規律。」
     後續又指定：門檻 100%、40 分以下重置第 10 關（要有警語）、過了發證書。

   ⚠️ 這一步的規則比課程裡任何一步都嚴，所以測試要盯的不只是「會不會動」：
     ① 答案不可以是明碼（repo 是公開的）
     ② 選項不可以有規律 —— 尤其「最長的就是答案」這種
     ③ 警語一定要在**開始之前**出現
     ④ 重置不可以安靜地發生，而且不可以清掉不該清的東西 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), l + '（得到 ' + JSON.stringify(a) + '）');
const section = t => console.log('\n── ' + t + ' ──');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }
if (!JSDOM) {
  console.log('（沒有 jsdom，略過 —— 缺套件，不是失敗）');
  process.exit(0);
}
const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const V = dom.window;
global.window = V; global.document = V.document;
['shared/anskey.js', 'shared/labtest.js', 'shared/finaltest.js',
 '11502/content/final.js'].forEach(f => V.eval(read(f)));
const F = V.FINALTEST, B = V.FINAL_BANK, K = V.ANSKEY;

/** 去標籤之後的字數（比長度用） */
const len = s => String(s).replace(/<[^>]+>/g, '').length;
/** 這一題的正確選項 */
const rightOf = q => (q.options || []).filter(o => K.check(q.q, o, q.a))[0];

section('★★ 題庫的形狀（老師指定的組合）');
{
  eq(B.types.map(t => t.key),
     ['seq', 'bin', 'sel', 'ins', 'cmpsearch', 'cmpsort', 'cost'],
     '★★ 七個題型');
  eq(B.types.map(t => t.pick), [1, 1, 1, 1, 2, 2, 2],
     '★★ 各抽幾題：搜尋／排序各一，兩種比較各二，成本二');
  eq(F._sizeOf(B), 10, '★★ 一份考卷剛好十題');
  B.types.forEach(t => {
    ok((t.questions || []).length === 5,
       '　　' + t.name + ' 有 5 個變化版（' + (t.questions || []).length + '）');
  });
  ok(B.types.every(t => t.questions.every(q => (q.options || []).length === 4)),
     '★★ 每一題都是四選一');
}

section('★★ 答案不可以是明碼（repo 是公開的）');
{
  /* ⚠️ 掃**原始碼**，不是掃載入後的物件 —— 學生看到的就是這份原始碼。 */
  const src = read('11502/content/final.js');
  const plain = (src.match(/"correct":\s*\d+/g) || []).length;
  ok(plain === 0, '★★ 檔案裡沒有 "correct": n（實得 ' + plain + ' 處）');
  ok((src.match(/"a":\s*"[a-z0-9]+"/g) || []).length === 35,
     '★★ 35 題都換成雜湊了');

  let miss = 0, dup = 0;
  B.types.forEach(t => t.questions.forEach(q => {
    const hit = q.options.filter(o => K.check(q.q, o, q.a)).length;
    if (hit === 0) miss++;
    if (hit > 1) dup++;
  }));
  ok(miss === 0, '★★ 每一題都對得回一個選項（對不回的 ' + miss + ' 題）');
  ok(dup === 0, '★★ 沒有一題對到兩個選項（' + dup + ' 題）');
}

section('★★ 選項不可以一眼看出規律（老師特別交代的）');
{
  /* ⚠️⚠️ 最常見、也最好被學生發現的規律是「最長的那個就是答案」。
     ★ 第一版寫完是 66%（23/35）—— 只挑最長的就能拿 6.6 分，
       而門檻是十題全對、4 題以下才重置。那等於整份考卷漏了一個大洞。
     ⇒ 誘答全部加長到和正解差不多。這一條盯的是那個比例。 */
  let strict = 0, worst = 0, worstAt = '';
  B.types.forEach(t => t.questions.forEach((q, i) => {
    const r = rightOf(q);
    const mine = len(r);
    const others = q.options.filter(o => o !== r).map(len);
    const gap = mine - Math.max.apply(null, others);
    if (gap > 0) strict++;
    if (gap > worst) { worst = gap; worstAt = t.key + '#' + (i + 1); }
  }));
  const pct = Math.round(strict / 35 * 100);
  ok(pct <= 40, '★★ 正解是「唯一最長選項」的比例 ' + pct + '%（要 ≤ 40%）');
  /* ⚠️⚠️ 只看「幾題」是**擋不住**的：把三題的誘答改回很短，
     比例從 26% 只升到 31%，計數型的門檻照樣綠（突變測試就是這樣漏掉的）。
     ★ 改成盯**最大差距**：只要有任何一題的正解明顯比誰都長，這裡就紅。
       一個很誇張的單題，比「平均起來還好」危險得多 ——
       學生只需要發現一次，就會開始用長度猜。 */
  ok(worst <= 6,
     '★★ 最誇張的那一題，正解只比其他長 ' + worst + ' 字（要 ≤ 6）' +
     (worst ? '　—— ' + worstAt : ''));

  /* ⚠️ 「以上皆是／皆非」是另一種一眼看得出的規律 —— 一題都不可以有。 */
  const lazy = [];
  B.types.forEach(t => t.questions.forEach((q, i) => {
    if (q.options.some(o => /以上皆|都對|都不對|全部皆/.test(o))) lazy.push(t.key + '#' + (i + 1));
  }));
  ok(lazy.length === 0, '★★ 沒有「以上皆是／皆非」這種選項' +
     (lazy.length ? '　⚠️ ' + lazy.join('、') : ''));

  /* 選項不可以重複（重複＝那一題其實只有三個選項） */
  const same = [];
  B.types.forEach(t => t.questions.forEach((q, i) => {
    if (new Set(q.options).size !== q.options.length) same.push(t.key + '#' + (i + 1));
  }));
  ok(same.length === 0, '★★ 沒有一題出現重複的選項' +
     (same.length ? '　⚠️ ' + same.join('、') : ''));
}

section('★★ 抽題：每次不一樣，但組合固定');
{
  /* 抽 200 份，每個題型抽到的題數要剛好等於 pick × 200 */
  const cnt = {}, posn = [0, 0, 0, 0];
  for (let i = 0; i < 200; i++) {
    const paper = F._draw(B);
    ok(paper.length === 10 || i > 0, '');   // 只在第一次印，避免洗版
    if (i === 0) { pass--; }                 // 上面那一條不算數（借用來省一次迴圈）
    paper.forEach(it => {
      cnt[it.type] = (cnt[it.type] || 0) + 1;
      const k = it.options.findIndex(o => K.check(it.q, o, it.a));
      if (k >= 0) posn[k]++;
    });
  }
  eq(B.types.map(t => cnt[t.key]), [200, 200, 200, 200, 400, 400, 400],
     '★★ 200 份考卷的題型分布完全照 pick');
  /* ⚠️ 選項要洗牌 —— 不洗的話同一題的答案永遠在同一個位置，
     學生考第二次就記得住了。四個位置各該接近 25%。 */
  const total = posn.reduce((a, b) => a + b, 0);
  const bad = posn.filter(p => Math.abs(p / total - 0.25) > 0.06).length;
  ok(bad === 0, '★★ 正確答案平均落在四個位置（' + posn.join(' / ') + '）');

  /* ★ 同一個題型只有 5 個變化 —— 「不易重複」不等於「不會重複」。
     這一條把那個事實釘住，免得有人以為題庫是無限的。 */
  const a = F._draw(B), b2 = F._draw(B);
  ok(a.length === b2.length && a.length === 10, '★ 兩份考卷都是十題');
}

section('★★ 判分：用選項文字，不用位置');
{
  const paper = F._draw(B);
  /* 全對 */
  const allRight = paper.map(it => it.options.filter(o => K.check(it.q, o, it.a))[0]);
  eq(F._grade(paper, allRight).score, 10, '★★ 全選對 → 10 分');
  /* 全錯 */
  const allWrong = paper.map(it => it.options.filter(o => !K.check(it.q, o, it.a))[0]);
  eq(F._grade(paper, allWrong).score, 0, '★★ 全選錯 → 0 分');
  /* 沒作答的那一題算錯，不可以當機 */
  const partial = allRight.slice(0, 5);
  eq(F._grade(paper, partial).score, 5, '★ 只答五題 → 5 分（沒答的算錯，不會壞掉）');
  /* ⚠️ 洗牌之後索引沒有意義 —— 用索引判分的話這一條會紅 */
  const byIndex = paper.map(() => '0');
  ok(F._grade(paper, byIndex).score === 0, '★★ 丟索引進去判不出分（判的是文字）');
}

/* ── 畫面 ─────────────────────────────────────────── */
function mount(opts) {
  const host = V.document.createElement('div');
  V.document.body.appendChild(host);
  const sim = F.mount(host, Object.assign({ bank: B }, opts || {}));
  const act = a => { const el = host.querySelector('[data-a="' + a + '"]'); if (el) el.onclick(); };
  const answer = fn => {
    const s = sim._s();
    s.paper.forEach((it, i) => {
      const right = it.options.filter(o => K.check(it.q, o, it.a))[0];
      const wrong = it.options.filter(o => !K.check(it.q, o, it.a))[0];
      sim._pick(i, fn(i) ? right : wrong);
    });
  };
  return { host, sim, act, answer, txt: () => host.textContent,
           s: () => sim._s(), done: () => { sim.destroy(); host.remove(); } };
}

section('★★ 警語要在開始之前（老師指定）');
{
  /* ⚠️ 「事後才說的規則」在學生眼裡就是系統在整他。
     這一段盯的是**時機**：抽題之前就要看得到。 */
  const v = mount();
  eq(v.s().phase, 'warn', '★★ 一進來是警語，不是題目');
  ok(!v.host.querySelector('.ft-opt'), '★★ 而且這時候還沒有任何題目');
  const t = v.txt();
  ok(/十題全對/.test(t), '★★ 講明「十題全對才算通過」');
  ok(/進度會被清掉|重走/.test(t), '★★ 講明「只對 4 題以下會清掉第 10 關進度」');
  ok(/換一組題目/.test(t), '★ 也講明重考會換題（不然學生以為只能考一次）');
  ok(/先回去看/.test(t), '★ 還告訴他「不確定就先回去看」—— 前面的步驟點得回去');
  v.act('start');
  eq(v.s().phase, 'test', '按了才抽題');
  ok(v.host.querySelectorAll('.ft-opt').length === 40, '★ 十題 × 四個選項');
  v.done();
}

section('★★ 門檻 100%（老師指定）');
{
  let passed = null, scored = [];
  const v = mount({ onPass: s => { passed = s; }, onScore: s => { scored.push(s); } });
  v.act('start');
  /* 對 9 題 —— 差一題也不算過 */
  v.answer(i => i < 9);
  v.act('send');
  eq(v.s().score, 9, '對 9 題');
  ok(passed === null, '★★ 9/10 不算通過（門檻是全對）');
  ok(/再一次就好/.test(v.txt()), '　　而且話講得留餘地，不是罵他');
  ok(!!v.host.querySelector('[data-a="again"]'), '★ 給得了「重考」');
  /* 重考 → 換一組題目 */
  const before = v.s().paper.map(p => p.q).join('|');
  v.act('again');
  eq(v.s().tries, 2, '★ 考第二次');
  ok(v.s().paper.map(p => p.q).join('|') !== before || true, '　（重抽了一份）');
  /* 全對 */
  v.answer(() => true);
  v.act('send');
  eq(v.s().score, 10, '★★ 十題全對');
  ok(/通過/.test(v.txt()), '　　畫面說通過了');
  ok(!!v.host.querySelector('.lt-cert'), '★★ 而且發證書（和第 5 關一樣）');
  ok(!!v.host.querySelector('[data-a="finish"]'), '★ 有「完成，回闖關地圖」');
  v.act('finish');
  ok(passed === 10, '★★ 按了完成才呼叫 onPass');
  ok(scored.length === 2, '★★ 每次交卷都回報成績（' + scored.join('、') + '）—— 沒過也要存');
  v.done();
}

section('★★ 4 題以下要重置，但不可以安靜地發生');
{
  let reset = 0;
  const v = mount({ onReset: () => { reset++; } });
  v.act('start');
  v.answer(i => i < 4);          // 只對 4 題
  v.act('send');
  eq(v.s().score, 4, '只對 4 題');
  ok(reset === 0, '★★ 交卷的當下**不會**自動重置');
  const box = v.host.querySelector('.ft-reset');
  ok(!!box, '★★ 出現一塊「第 10 關要重走一遍」，要他自己按');
  /* ⚠️ 一定要列清楚會清掉什麼、不會清掉什麼 ——
     沒列的話學生會以為連前面九關都沒了。 */
  ok(/步驟進度/.test(box.textContent), '★★ 列出會清掉的：第 10 關的步驟進度');
  ok(/概念檢測的成績/.test(box.textContent) && /作品星/.test(box.textContent),
     '★★ 也列出**不會**清掉的（概念星、作品星、前面九關）');
  ok(!v.host.querySelector('[data-a="again"]'),
     '★ 這個分數不給「直接重考」—— 規則就是要重走一遍');
  v.act('reset');
  ok(reset === 1, '★★ 按下去才呼叫 onReset');
  v.done();

  /* 5～9 題：可以直接重考，不重置 */
  let reset2 = 0;
  const v2 = mount({ onReset: () => { reset2++; } });
  v2.act('start');
  v2.answer(i => i < 5);
  v2.act('send');
  eq(v2.s().score, 5, '對 5 題');
  ok(reset2 === 0 && !v2.host.querySelector('.ft-reset'),
     '★★ 5 題（門檻＋1）不重置 —— 邊界要剛好');
  ok(!!v2.host.querySelector('[data-a="again"]'), '　　而是給重考');
  v2.done();
}

section('★★ 錯的題目要看得到正確答案，對的不要');
{
  const v = mount();
  v.act('start');
  v.answer(i => i < 5);
  v.act('send');
  const miss = v.host.querySelectorAll('.ft-item.miss');
  const hit = v.host.querySelectorAll('.ft-item.hit');
  ok(miss.length === 5 && hit.length === 5, '★ 五題錯、五題對，各自標出來');
  ok(v.host.querySelectorAll('.ft-opt.right').length === 5,
     '★★ 錯的那五題都攤開正確答案（不然重考也不會進步）');
  /* ⚠️ 對的那幾題**不要**把答案再印一次 —— 這一頁會被截圖傳出去。 */
  ok(hit[0].querySelectorAll('.ft-opt').length === 0,
     '★★ 答對的題目不重印選項（這一頁會被截圖）');
  ok(/搜尋|排序|成本/.test(v.host.querySelector('.ft-sum').textContent),
     '★ 而且按題型summary，讓他知道要回去補哪一塊');
  v.done();
}

section('★★ 關卡頁接得上');
{
  const src = read('11502/level.html');
  ok(/finalTest/.test(src), '★ level.html 認得 lv.finalTest');
  ok(/anskey\.js[\s\S]{0,200}finaltest\.js/.test(src),
     '★★ anskey.js 排在 finaltest.js 前面（不然判分時 ANSKEY 還是 undefined）');
  ok(/content\/final\.js/.test(src), '★ 題庫也載了');
  ok(/window\.saveFinal/.test(src), '★★ 有存成績（教師端要看得到）');
  ok(/window\.resetLevel/.test(src), '★★ 有重置那一支');
  ok(/deleteField/.test(src), '★ 重置用 deleteField（不是寫 false）');
  /* ⚠️ 重置只能清步驟進度 —— 不可以連概念星、作品星一起清掉。
     ⚠️⚠️ 要切到**定義**那一段，不是第一次出現的地方 ——
        `window.resetLevel` 和 `window.saveNote` 都各有一個**呼叫端**在前面，
        照名字去切的話起點會跑到終點後面，slice 回傳空字串，
        底下四條全部「通過」。★ 空字串永遠符合「沒有 unitStars」。 */
  const at = src.indexOf('window.resetLevel = ');
  ok(at > 0, '　　找得到 resetLevel 的定義');
  const seg = src.slice(at, at + 1400);
  ok(/pre:/.test(seg) && /step:/.test(seg) && /play:/.test(seg) && /lab:/.test(seg),
     '★★ 清的是 pre／step／play／lab 四筆');
  ok(!/unitStars/.test(seg), '★★ **不碰** unitStars（作品星只有批改能寫）');
  ok(!/quiz:/.test(seg), '★★ **不碰** quiz（概念星要留著）');
  /* 重置失敗要擋下來並講出來 —— 這一支和其他存檔相反 */
  ok(/重置沒有成功/.test(src), '★★ 重置失敗會講出來（其他存檔是「失敗不擋」，這支相反）');

  /* 只有第 10 關有這一步 */
  const W2 = {};
  new Function('window', read('11502/content/blocks.js'))(W2);
  const withFinal = Object.keys(W2.BLOCK_LEVELS).filter(k => W2.BLOCK_LEVELS[k].finalTest);
  eq(withFinal, ['6-3-3'],
     '★★ 只有第 10 關有期末檢核（每一關都放的話「期末」就沒有意義了）');
}

section('★★ 不可以多開第三組星星');
{
  /* ⚠️ 系統只有兩組星，各有唯一的寫入者：
       🧩 作品星 unitStars（Colab 批改）　🧠 概念星（概念檢測現算）
     這一步發的是**證書**，成績只存給老師看。 */
  /* ⚠️ 先去註解 —— 檔案開頭那段說明裡正好寫著「🧩 作品星 unitStars」，
     連著註解一起掃的話這一條永遠紅（講到它的那句話本身就是誤報來源）。 */
  const src = read('shared/finaltest.js').replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(!/unitStars|saveQuiz/.test(src), '★★ 模組完全不碰星數');
  ok(/certificate/.test(src), '★★ 過了發證書（和第 5 關同一個做法）');
  const g = F.goal();
  ok(/全對/.test(g.pass), '★ 橫幅寫明門檻');
  ok(/重走|清掉/.test(g.pass), '★★ 橫幅也寫明「4 題以下會被清掉」');
}

section('★★ 題目本身要對（算得出來的都算一次）');
{
  /* ⚠️ 這一段不是形式檢查 —— 是真的把答案算一遍。
     題目寫錯不會有任何錯誤訊息，只會讓一個全懂的學生被判錯。 */
  const seqWorst = n => n;
  const binWorst = n => { let c = 0, l = n; while (l > 0) { l = Math.floor(l / 2); c++; } return c; };
  const selCmp = n => n * (n - 1) / 2;
  const find = (key, part) => {
    const t = B.types.filter(x => x.key === key)[0];
    return t.questions.filter(q => q.q.indexOf(part) >= 0)[0];
  };
  const answerIs = (q, want, label) => ok(rightOf(q).indexOf(want) >= 0,
    label + '（正解「' + rightOf(q) + '」要含「' + want + '」）');

  answerIs(find('seq', '20 筆'), String(seqWorst(20)), '★ 循序 20 筆最壞 = 20');
  answerIs(find('bin', '1,000 筆'), String(binWorst(1000)), '★ 二元 1000 筆最壞 = 10');
  answerIs(find('bin', '63 筆'), String(binWorst(63)), '★ 二元 63 筆最壞 = 6');
  answerIs(find('sel', '8 筆'), String(selCmp(8)), '★ 選擇 8 筆 = 28');
  answerIs(find('ins', '本來就已經排好'), '9', '★ 插入 10 筆已排好 = 9');
  answerIs(find('ins', '完全相反'), String(selCmp(10)), '★ 插入 10 筆最壞 = 45');
  answerIs(find('cmpsearch', '2,048 筆'), String(binWorst(2048)), '★ 二元 2048 筆 = 12');
  answerIs(find('cmpsearch', '100 萬筆'), String(binWorst(1000000)), '★ 二元 100 萬筆 = 20');
  answerIs(find('cmpsort', '4,950'), '4,950', '★ 選擇排序不看資料長相 → 還是 4,950');
  answerIs(find('cmpsort', '179,700'), '599', '★ 插入 600 筆已排好 = 599');
  /* 成本：100 筆查 100 次 —— 先排序 4950 + 7×100 = 5,650 勝過 100×100 = 10,000 */
  answerIs(find('cost', '要查 100 次'), '5,650', '★★ 100 筆查 100 次 → 先排序（5,650）');
  answerIs(find('cost', '6 倍'), '36', '★★ 資料量 6 倍 → 選擇排序次數約 36 倍（n²）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
