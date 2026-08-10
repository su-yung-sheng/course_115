/* 概念檢測（開放式作答）＋ 套餐工廠
   跑法：node shared/tests/quiz.test.js

   ★ 這一份守的是四件事，每一件壞掉都不會有錯誤訊息：

     ① 不可以錯殺
        學生用自己的說法寫，關鍵字群沒收錄就會被判「沒講到」。
        誤判兩次，他就會開始猜系統想看什麼字、堆關鍵字 ——
        那和我們要測的東西正好相反。
        所以下面「應該要過」的例子比「應該擋下」的多很多，這是刻意的。

     ② AI 只能加分
        覆核失敗、覆核亂回、覆核被學生的作答帶著走 ——
        三種情況學生拿到的分數都不可以比規則判的低。

     ③ 兩組星星，各自算各自的
        作品星只有一個寫入者（Colab 批改）；
        概念星是每次從 quiz 的分數現算的，不另外存一份。

     ④ 不到門檻要真的帶他回去讀 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

function win() {
  const w = {};
  ['ai-guide.js', 'grading.js', 'answer.js', 'quiz.js'].forEach(f =>
    new Function('window', fs.readFileSync(path.join(root, 'shared', f), 'utf8'))(w));
  new Function('window', fs.readFileSync(path.join(root, '11502', 'content', 'blocks.js'), 'utf8'))(w);
  return w;
}
const W = win();
const A = W.ANSWER;
const Q = id => W.BLOCK_LEVELS[id].quiz;
/** 應該判「講到重點」 */
const yes = (spec, t, label) =>
  ok(A.judge(t, spec).level === 'full', '（要算過）' + label + '　「' + t + '」');
/** 至少要算「講到一半」—— 認真寫的不可以掉到 none */
const half = (spec, t, label) =>
  ok(A.judge(t, spec).level !== 'none', '（不可判零）' + label + '　「' + t + '」');
const no = (spec, t, label) =>
  ok(A.judge(t, spec).level === 'none', '（要擋下）' + label + '　「' + t + '」');

(async () => {

section('題庫本身');
['2-1-1', '2-1-2', '2-1-3'].forEach(id => {
  const bank = Q(id);
  ok(bank.length >= W.QUIZ.N_TOTAL,
     id + ' 至少 ' + W.QUIZ.N_TOTAL + ' 題（' + bank.length + '）—— 抽 5 題還要留得下變化');
  ok(bank.every(x => x.q && (x.need || []).length), '   ' + id + ' 每題都有題目和「要講到的概念」');
  ok(bank.every(x => x.hint && x.hint.length > 6), '   ' + id + ' 每題都有提示（卡住時給方向，不是給答案）');
  ok(bank.every(x => x.why && x.why.length > 8), '   ' + id + ' 每題都說得出「答不到的人還沒懂什麼」');
  ok(bank.every(x => (x.need || []).every(g => (g.any || []).length >= 3)),
     '   ★ ' + id + ' 每個概念至少有 3 種說法 —— 只收一種寫法等於在考默寫');
  ok(bank.every(x => !(x.full > (x.need || []).length)),
     '   ' + id + ' 的 full 沒有超過概念數（那會變成永遠拿不到滿分）');
  ok(bank.every(x => (x.min || 8) <= 14), '   ' + id + ' 沒有把最少字數設得太長');
});
ok(!W.BLOCK_LEVELS['2-3-1'].quiz, '★ 沒寫題庫的關卡就是沒有（寧可不辦，也不要湊題目）');

section('★ 不可以錯殺：同一個意思的各種說法');
{
  const q1 = Q('2-1-1')[0];   // 為什麼不包成副程式不好
  yes(q1, '因為六個正方形都一樣，同一段要拼六遍太麻煩了', '標準說法');
  yes(q1, '不然一樣的積木要一直拼，之後要改也很煩', '★ 完全沒用到題目的字');
  yes(q1, '同樣的東西複製好幾次，想改的時候每個都要動', '★ 用「複製」「每個都要動」');
  half(q1, '會一直重複做同樣的事情', '只講到一半也不可以判零');
  half(q1, '要拼很多次好累喔', '口語、字少 —— 一樣不可以判零');
  no(q1, '不知道', '真的什麼都沒寫');
  no(q1, '我覺得應該就是這樣吧', '★ 字數夠了，但拿掉空話什麼都不剩');
}
{
  const q = Q('2-1-2')[1];    // 參數是什麼
  yes(q, '就是呼叫的時候才決定的數字，每次可以不一樣', '標準說法');
  yes(q, '外面傳進來的值，可以換成別的大小', '★ 換一組完全不同的詞');
  half(q, '你要填一個數字進去', '講到一半');
}
{
  const q = Q('2-1-3')[0];    // 正六邊形轉幾度
  yes(q, '60度，因為360除以6', '算式');
  yes(q, '轉六十度 一整圈三百六十 分給六個角', '★ 國字數字也要認得');
  yes(q, '360/6=60', '★ 只寫式子也算 —— 他確實會算');
}

/* ── ★ 另一個方向的誤判：空話不可以被判成「講到重點」──
   前面那一段測的是「不可以錯殺」，這一段測的是它的反面。
   ⚠️ 這幾條是真的抓到過東西的：
     · 「知道」當同義詞 → 學生寫「我不知道」就命中了「一看就知道在做什麼」
     · 「不」當同義詞   → 幾乎每一句中文都有「不」
     · 「別的」        → 被「特別的」命中
   單獨一個字的同義詞最容易出這種事，加新題目時要特別小心。 */
section('★ 空話不可以被判成「講到重點」');
{
  const JUNK = [
    '我覺得應該就是這樣吧我不知道啦',
    '不知道耶老師這個好難喔我不會',
    '這個東西真的很難我都不懂啦怎麼辦',
    '隨便啦反正就是那樣子沒什麼特別的',
    '哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈'
  ];
  let bad = [];
  ['2-1-1', '2-1-2', '2-1-3'].forEach(id => Q(id).forEach((q, i) => JUNK.forEach(t => {
    const r = A.judge(t, q);
    if (r.level !== 'none') bad.push(id + ' 第' + (i + 1) + '題 ← 「' + t + '」命中「' + r.got.join('、') + '」');
  })));
  ok(bad.length === 0, '★ 五種空話 × 所有題目，一個都不可以過' +
     (bad.length ? '（' + bad[0] + ' 等 ' + bad.length + ' 個）' : ''));
}

section('常見誤解：只降一級，不歸零');
{
  const q1 = Q('2-1-1')[0];
  const r = A.judge('因為程式碼太長了，看起來很亂', q1);
  ok(r.level === 'none' && r.warn.length === 1, '只講誤解 → 沒講到重點，而且抓得出是哪個誤解');
  ok(/長度不是重點/.test(r.why), '   ★ 回饋要講明那個誤解錯在哪，不是只說「沒碰到重點」');

  const r2 = A.judge('因為同一段要拼六遍，而且程式碼會變得太長', q1);
  ok(r2.level === 'part', '★ 重點和誤解都講了 → 降一級，不是歸零');
  ok(r2.score === 0.5, '   拿得到半分 —— 打成零分等於教他「寫多了會被扣分」');
}

section('太短與空白');
{
  const q = Q('2-1-1')[2];    // min: 8
  const r = A.judge('好', q);
  ok(r.level === 'none' && /至少 8 個字/.test(r.why), '太短要說清楚為什麼，不是說他答錯');
  ok(/還沒寫/.test(A.judge('', q).why), '空白有自己的說法');
  ok(!/錯|失敗|不及格/.test(A.judge('', q).why + A.judge('好', q).why),
     '★ 回饋裡不出現「錯／失敗／不及格」—— 這不是考試');
}

section('分數');
ok(A.SCORE.full === 1 && A.SCORE.part === 0.5 && A.SCORE.none === 0, '全對 1 分、一半 0.5 分');
ok(A.total([{score:1},{score:1},{score:0.5},{score:0},{score:0}]) === 3,
   '2.5 分 → 四捨五入成 3（★ 邊界一律往學生那邊倒）');
ok(A.total([]) === 0, '什麼都沒有就是 0');

section('★ AI 覆核只能加分');
{
  const w = win();
  const items = Q('2-1-1').slice(0, 5);
  const ans = items.map(() => '我覺得就是把一直重複的那一段收起來');
  const base = await w.QUIZ._grade(items, ans, '2-1-1', 'x');
  const baseScore = w.ANSWER.total(base.results);

  // ① AI 亂造一個不存在的概念名稱
  w.ASKAI = { enabled: () => true, judge: (u, p) => Promise.resolve(p.map(x => ({ i: x.i, got: ['亂造的概念'] }))) };
  const r1 = await w.QUIZ._grade(items, ans, '2-1-1', 'x');
  ok(r1.ai === 0 && w.ANSWER.total(r1.results) === baseScore,
     '★ AI 回一個題目裡沒有的概念 → 完全不採用');

  // ② AI 說「他什麼都沒講到」
  w.ASKAI = { enabled: () => true, judge: (u, p) => Promise.resolve(p.map(x => ({ i: x.i, got: [] }))) };
  const r2 = await w.QUIZ._grade(items, ans, '2-1-1', 'x');
  ok(w.ANSWER.total(r2.results) === baseScore, '★ AI 說沒講到 → 不理它（規則已經判過了，只能加不能減）');

  // ③ AI 整個掛掉
  w.ASKAI = { enabled: () => true, judge: () => Promise.reject(new Error('額度用完了')) };
  const r3 = await w.QUIZ._grade(items, ans, '2-1-1', 'x');
  ok(w.ANSWER.total(r3.results) === baseScore, '★ AI 掛掉 → 分數和純規則一樣，不是零分');

  // ④ AI 撿回一個規則漏掉的說法
  const target = items.map((it, i) => ({ it, i })).filter(x => x.it.need.length >= 2)[0];
  const nm = target.it.need[0].name;
  w.ASKAI = { enabled: () => true, judge: (u, p) => Promise.resolve([{ i: target.i, got: [nm] }]) };
  const r4 = await w.QUIZ._grade(items, ans, '2-1-1', 'x');
  ok(w.ANSWER.total(r4.results) >= baseScore, '★ 撿回來只會讓分數變高或不變');
  const t4 = r4.results[target.i];
  ok(t4.got.indexOf(nm) >= 0, '   撿回來的概念要進到 got 裡');
  ok(!t4.miss.length || t4.miss.indexOf(nm) < 0, '   而且要從 miss 移掉，不然回饋會自相矛盾');

  // ⑤ 規則已經滿分的題目不送出去
  let sent = null;
  w.ASKAI = { enabled: () => true, judge: (u, p) => { sent = p; return Promise.resolve([]); } };
  const good = items.map((it) => (it.need || []).map(g => (g.any || [])[0]).join('，') + '，就是這樣沒錯');
  await w.QUIZ._grade(items, good, '2-1-1', 'x');
  ok(!sent || sent.length < items.length, '★ 規則已經給滿分的題目不送 AI —— 加不上去了，送出去是白花錢');

  // ⑥ 沒接 AI
  const w2 = win();
  const r6 = await w2.QUIZ._grade(items, ans, '2-1-1', 'x');
  ok(r6.ai === 0 && w2.ANSWER.total(r6.results) === baseScore,
     '★ 完全沒接 AI 也考得成 —— 這是預設狀態，不是壞掉');
}

/* ── 提示要接回問題分析 ─────────────────────────
   ★ 概念檢測問的，本來就是問題分析想過的 ——
     兩邊各講各的話，學生會覺得那是兩件事、要各背一次。
   ⚠️ 但引的是那一問的**提示**，不是正解。
     引錯來源（例如把圈選題的答案端出來）會直接毀掉這一題。 */
section('💡 提示回頭引問題分析');
{
  const lv = W.BLOCK_LEVELS['2-1-1'];
  const box = r => W.QUIZ._refBox(lv, r);
  ok(/問題分析第 4 題/.test(box(3)), '數字 → 指到 analysis.qs 的那一問');
  ok(/副程式要怎麼設定/.test(box(3)), '   而且帶出那一問的題目與提示');
  ok(/問題分析最後那一題/.test(box('write')), "'write' → 指到那一段的收尾");
  ok(/情境解說/.test(box('scene')) && /套餐/.test(box('scene')), "'scene' → 指回情境解說");
  ok(box(99) === '' && box(undefined) === '', '★ 指不到的就不顯示 —— 不要留一塊空的提示框');

  /* ★ 引用不可以把積木答案端出來。 */
  let leak = [];
  ['2-1-1', '2-1-2'].forEach(id => {
    const L2 = W.BLOCK_LEVELS[id];
    (L2.quiz || []).forEach((q, i) => {
      const html = W.QUIZ._refBox(L2, q.ref);
      ['右轉 90', '重複 4 次', '移動 30 點', '移動 60 點'].forEach(k => {
        if (html.indexOf(k) >= 0) leak.push(id + ' 第' + (i + 1) + '題 ←「' + k + '」');
      });
    });
  });
  ok(leak.length === 0, '★ 引用出來的內容沒有洩漏積木答案' +
     (leak.length ? '（' + leak.join('、') + '）' : ''));

  /* 2-1-1／2-1-2 每一題都該指得到來源；2-1-3 沒有 analysis（它走推導），所以不強求。 */
  ['2-1-1', '2-1-2'].forEach(id => {
    const L2 = W.BLOCK_LEVELS[id];
    ok((L2.quiz || []).every(q => W.QUIZ._refBox(L2, q.ref) !== ''),
       '   ' + id + ' 每一題都指得回問題分析或情境');
  });
  ok(!W.BLOCK_LEVELS['2-1-3'].analysis,
     '   2-1-3 沒有 analysis（它走推導）—— 所以那一關的題目沒有 ref 是對的');
}
{
  const L3 = fs.readFileSync(path.join(root, 'shared', 'quiz.js'), 'utf8');
  ok(/回頭看問題分析/.test(L3),
     '★ 按鈕上要講明它會給什麼 —— 只寫「提示」的話，學生不知道值不值得按');
}

section('抽題');
{
  const lv = W.BLOCK_LEVELS['2-1-1'];
  const seen = {};
  for (let i = 0; i < 60; i++) {
    const s = W.QUIZ._pick(lv);
    ok0(s.length === W.QUIZ.N_TOTAL, '每次都抽 5 題');
    ok0(new Set(s.map(x => x.q)).size === s.length, '同一份不會出現重複題');
    seen[s.map(x => x.q).join('|')] = 1;
  }
  ok(true, '每次都抽 5 題、不重複');
  ok(Object.keys(seen).length > 1, '★ 重寫時會換一批題目（不是同五題再看一遍）');
  ok(W.QUIZ._pick({ quiz: [{ q: 'x', need: [] }] }) === null,
     '★ 題庫不到 5 題 → 這一關不辦概念檢測');
}
function ok0(c, l) { if (!c) { fail++; console.log('  ❌ ' + l); } }

section('🧠 概念星（shared/grading.js）');
const G = W.GRADING;
ok(G.QUIZ_PASS === 3 && G.QUIZ_FULL === 4, '五題：3 題過門檻、4 題拿第 2 顆星');
ok(G.quizStars({ '2-1-1': { score: 5 } }, '2-1-1') === 3, '五題全講到 → 3 顆概念星');
ok(G.quizStars({ '2-1-1': { score: 4 } }, '2-1-1') === 2, '4 題 → 2 顆');
ok(G.quizStars({ '2-1-1': { score: 3 } }, '2-1-1') === 1, '3 題（剛好過門檻）→ 1 顆');
ok(G.quizStars({ '2-1-1': { score: 2 } }, '2-1-1') === 0, '沒過門檻 → 0 顆（他本來也走不下去）');
ok(G.quizStars({}, '2-1-1') === 0, '還沒寫 → 0 顆（那不是懲罰，是還沒做）');
ok(G.quizTotal({ a: { score: 5 }, b: { score: 3 } }).stars === 4, '總數會加起來');
/* ★ 概念星是「現算」的，不另外存一份。
   存第二份的話，兩份遲早會不一致，而且不會有人發現是哪一天開始的。 */
ok(!G.cappedStars && !G.starCap && !G.effectiveStars,
   '★ 封頂那一套已經拆掉 —— 改成兩組星星之後它就是死程式碼');
{
  const gs = fs.readFileSync(path.join(root, 'shared', 'grading.js'), 'utf8');
  ok(/依序開放只看作品星|依序開放\*\*只看作品星/.test(gs),
     '★ 程式裡要寫明「依序開放只看作品星」—— 概念檢測可以重寫到過為止，' +
     '拿它當鑰匙等於沒有鎖');
}

section('接進關卡頁');
const L = fs.readFileSync(path.join(root, '11502', 'level.html'), 'utf8');
['answer.js', 'quiz.js', 'combo.js'].forEach(f => ok(L.indexOf(f) > 0, 'level.html 載入 ' + f));
{
  const iQuiz = L.indexOf("key:'quiz'"), iBlocks = L.indexOf("key:'blocks'");
  ok(iQuiz > 0 && iBlocks > 0 && iQuiz < iBlocks,
     '★ 概念檢測排在程式拼圖**之前** —— 反過來的話，拼對了就沒人會回頭讀');
}
ok(/onFail:[\s\S]{0,240}at = 0/.test(L),
   '★ 不到門檻 → 回到第 1 步。留在原地的話他只會亂猜到過為止');
ok(/window\.saveQuiz/.test(L) && /saveQuiz = async/.test(L), '★ saveQuiz 有呼叫也有定義');
{
  const save = L.slice(L.indexOf('window.saveQuiz'), L.indexOf('window.saveNote'));
  ok(!/unitStars/.test(save), '★ 存成績時完全不碰 unitStars —— 星數只有批改那一個寫入者');
}
ok(!/cappedStars/.test(L), '★ 關卡頁不再封頂（兩組星星各自算）');
ok(/window\.GRADING\.quizStars/.test(L), '   重寫畫面顯示的是概念星');
ok(!/[^.\w]GRADING\./.test(L.replace(/window\.GRADING\./g, 'window_G.')),
   '★ 跨檔案的全域一律寫 window.GRADING（裸的全域在測試環境直接 ReferenceError，咬過四次）');
const S = fs.readFileSync(path.join(root, '11502', 'scratch.html'), 'utf8');
ok(!/cappedStars/.test(S) && /quizTotal/.test(S),
   '★ 闖關地圖分開顯示兩組星星（🧩 作品 · 🧠 概念），不要加成一個數字');

section('伺服器端覆核（shared/aiguide.gs）');
const gs = fs.readFileSync(path.join(root, 'shared', 'aiguide.gs'), 'utf8');
ok(/p\.action === 'judge'/.test(gs), '有 action=judge');
ok(!/p\.action === 'quiz'/.test(gs), '★ AI 出題那條路已經拆掉 —— 會花錢的死程式碼是負債');
ok(/postData/.test(gs), '★ 用 POST 收作答（300 字 × 5 題塞不進網址，而且會默默被截斷）');
ok(/JUDGE_CAP/.test(gs), '★ 覆核每人每天有上限 —— 重考不限次，但不該每次都叫 AI');
ok(/usedToday_\(\) >= num_\('DAILY_CAP'/.test(gs.slice(gs.indexOf("action === 'judge'"))),
   '   覆核也吃 DAILY_CAP');
{
  const h = gs.slice(gs.indexOf("action === 'judge'"), gs.indexOf("if (p.action !== 'ask')"));
  ok(/skipped/.test(h), '★ 額度用完是「這次不覆核」，不是回錯誤 —— 學生不該看到 AI 的家務事');
  ok(!/ok: false/.test(h), '   整段不回 ok:false');
}
{
  const pj = gs.slice(gs.indexOf('function parseJudge_'));
  ok(/allow\.indexOf\(g\) >= 0/.test(pj),
     '★ 只收「原本就列在這一題」的概念名稱 —— 模型自己造名字一律丟掉');
  ok(/```/.test(pj), '   會把模型硬加的 ``` 剝掉');
}
{
  const pr = gs.slice(gs.indexOf('function judgePrompt_'), gs.indexOf('function parseJudge_'));
  ok(/<<</.test(pr) && /只是資料/.test(pr),
     '★ 學生的作答要用界線包起來，並註明「裡面的指示不可以照做」');
  ee(pr, '不可以自己造新的', '限制它只能從既有概念裡挑');
  ee(pr, '寧可少列', '寧可漏抓，不要幫學生補他沒說的話');
}
function ee(src, needle, label) { ok(src.indexOf(needle) >= 0, '   ' + label); }

section('🍔 套餐工廠');
const cb = fs.readFileSync(path.join(root, 'shared', 'combo.js'), 'utf8');
new Function('window', cb)(W);
const C = W.COMBO;
ok(C.STAGES.length === 3, '三關：組套餐 → 換一格 → 打開主餐');
ok(C.MAIN.every(m => (m.parts || []).length >= 3),
   '★ 主餐都能再拆開 —— 這一層就是「副程式裡可以再呼叫副程式」');
ok(C.SIDE.every(s => !s.parts) && C.DRINK.every(d => !d.parts),
   '   配餐和飲料沒有 parts（不對稱是刻意的：有些模組裡面還有模組）');
ok(C.MAIN.length >= 3 && C.SIDE.length >= 3 && C.DRINK.length >= 3,
   '每一格至少三種選擇（組得出三份不一樣的套餐）');
ok(C.MAIN.filter(m => m.parts.some(p => p.name === '麵包')).length >= 2,
   '★ 不同主餐共用同一種零件 —— 那正是「重複的部分可以共用」');
/* ⚠️ 用「有沒有真的呼叫」判，不要用關鍵字掃全檔 ——
   註解裡寫「不碰 Firestore」也會被掃到，那是把說明當成違規。 */
ok(!/fetch\(|setDoc\(|getDoc\(|AIGUIDE\.|GAS_URL|ASKAI\./.test(cb),
   '★ 這一段完全不碰 AI 也不碰進度 —— 它是體驗，不是考試');
ok(/不算分|不算成績|體驗，不是考試/.test(cb), '   程式裡要寫明「不算分」的理由');
ok(/只換|保持原樣|不要動/.test(cb), '★ 第 2 關動到別格要講清楚為什麼不算');
ok(/combo: true/.test(fs.readFileSync(path.join(root, '11502', 'content', 'blocks.js'), 'utf8')),
   '2-1-1 打開了套餐工廠');
{
  const b = fs.readFileSync(path.join(root, '11502', 'content', 'blocks.js'), 'utf8');
  ok((b.match(/combo: true/g) || []).length === 1,
     '★ 只有一關有 —— 每一關都放的話它就變成點擊過場');
}
/* ⚠️ 2026-08-10：套餐既不給跳過，也不加倒數 ——
   三關本來就要動手才過得去，再加時間是雙重處罰。 */
{
  const combo = L.slice(L.indexOf("s.key === 'combo'"), L.indexOf("s.key === 'analysis'"));
  ok(!/先跳過|nextBtn/.test(combo),
     '★ 套餐那一步沒有跳過鍵、也沒有倒數 —— 它本來就要動手才過得去');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);

})();
