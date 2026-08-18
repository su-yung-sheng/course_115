/* 實作體驗：資料大爆炸（第 10 關的最後一步）
   跑法：node shared/tests/bigcost.test.js

   ★ 這一關的定位（老師 2026-08-17 決定）
     原本叫「搜尋大比拼」，還要學生再拼一支循序搜尋 ——
     但這一關比的是**第 8、9 關寫過的那兩支程式**，自己不該再寫一支。
     它其實是**第 6 章的總結**：排序（6、7 關）＋ 搜尋（8、9 關）。
     ⇒ 改名「資料大爆炸」，最後一步換成成本試算體驗。

   ★★ 這一份最要緊的一條
     結論**不可以**是「二元搜尋比較快」。
     那句話有前提：資料要先排好，而排序是先付掉的成本。
     真正的答案是「看你要查幾次」——
       查 1 次 → 不必排；查很多次 → 先排划算。
     所以測試要釘住：**同一批資料、不同的查詢次數，答案要不一樣**。 */
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
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), l + '（得到 ' + JSON.stringify(a) + '）');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
W.eval(read('shared/bigcost.js'));
const B = W.BIGCOST;
ok(!!B, '模組載得起來');

section('★ 次數算得對（和前面幾關對得起來）');
{
  ok(B.selCompares(5) === 10, '5 個人選擇排序比 10 次');
  ok(B.selCompares(100) === 4950, '★ 100 筆要比 4950 次');
  /* ⚠️ 一定要和第 5 關對得起來：那一關「找一個最小值」是 n-1 次。
     排序就是把那件事做 n-1 遍（每遍愈來愈短）。 */
  ok(B.selCompares(100) > 100 - 1,
     '★★ 排序（4950）遠比「只找一個最矮的」（99）貴 —— 這一段的第一個衝擊');

  ok(B.seqWorst(100) === 100, '循序搜尋最壞比 100 次');
  ok(B.binWorst(100) === 7, '★ 二元搜尋最壞比 7 次（100→50→25→12→6→3→1→空）');
  ok(B.binWorst(1024) === 11, '★ 1024 筆二元只要 11 次（和第 9 關的說明一致）');
  ok(B.binWorst(13) === 4, '   13 筆要 4 次（課本那一列）');
}

section('★★ 兩種排序：最壞情況一樣，差別在最好情況');
{
  /* ⚠️ 這一段刻意不問「哪一種比較快」—— 那個問題沒有答案。
     要問的是「最壞情況一樣嗎」，答案是一樣。 */
  ok(B.selCompares(100) === B.insWorst(100),
     '★★ 最壞情況兩種一樣（都是 4950）');
  ok(B.insBest(100) === 99,
     '★★ 但插入排序**最好情況**只要 99 次（資料本來就排好）');
  ok(B.selCompares(100) > B.insBest(100) * 10,
     '★ 而選擇排序不管資料長怎樣都是 4950 —— 那才是兩者真正的差別');
}

section('★★ 先排序划不划算：答案要「看情況」');
{
  const n = 100;
  ok(B.costPlain(n, 1) === 100, '查 1 次不排序 = 100');
  ok(B.costSorted(n, 1) === 4950 + 7, '查 1 次先排序 = 4950 + 7');
  ok(B.better(n, 1) === 'plain', '★★ 查 1 次 → **不要排**');
  /* ⚠️ 不可以寫死 50 —— 100 筆的損益兩平點是 54 次，查 50 次其實**不該排**。
     （第一版的程式就是這樣寫錯的：題目問「查 50 次要不要排」，
       而正確答案是「不要」，可是文案講的是「先排划算」。）
     ⇒ 一律從 breakEven() 推。 */
  const k2 = B.breakEven(n) * 2;
  ok(B.better(n, k2) === 'sorted',
     '★★ 查 ' + k2 + ' 次（損益兩平的兩倍）→ **先排划算**');
  ok(B.better(n, 50) === 'plain',
     '★★ 而查 50 次其實**還不該排**（兩平點是 ' + B.breakEven(n) + ' 次）—— ' +
     '這正是第一版寫錯的地方');
  /* ★ 這一條是整段的重點：同一批資料，答案會反過來。 */
  ok(B.better(n, 1) !== B.better(n, k2),
     '★★ 同一批資料、不同的查詢次數，答案**不一樣** —— 那才是這一章的結論');

  const be = B.breakEven(n);
  ok(be > 1 && be < 200, '★ 算得出損益兩平點（查 ' + be + ' 次以上就值得排序）');
  ok(B.better(n, be) === 'sorted' && B.better(n, be - 1) === 'plain',
     '★★ 損益兩平點前後真的會翻轉（' + (be - 1) + ' 次不排、' + be + ' 次要排）');

  /* 資料量愈大，先排序愈早開始划算嗎？ */
  ok(B.breakEven(1000) > 0, '1000 筆也算得出來（' + B.breakEven(1000) + ' 次）');
}

section('★★ 結論不可以是「二元搜尋比較快」');
{
  const src = read('shared/bigcost.js');
  ok(/看你要查幾次|看情況/.test(src),
     '★★ 原始碼裡把結論寫成「看你要查幾次」');
  ok(/前提/.test(src),
     '★★ 而且點明「二元搜尋比較快」是**有前提的**（資料要先排好）');
  const g = B.goal();
  ok(/不是「二元搜尋比較快」|有前提/.test(g.why),
     '★★ 連橫幅的目標都先把那句話擋掉');
}

/* ── UI ───────────────────────────────────────────── */
function mount(opts) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = B.mount(host, opts || {});
  const btn = re => [...host.querySelectorAll('[data-a]')].filter(b => re.test(b.textContent))[0];
  const act = a => { const el = host.querySelector('[data-a="' + a + '"]'); if (el) el.onclick(); };
  const size = v => { const el = host.querySelector('[data-n="' + v + '"]'); if (el) el.onclick(); };
  const put = v => { const el = host.querySelector('#bc-g'); if (el) el.value = v; };
  /* ⚠️ 排序方案那三顆用的是 data-pick，不是 data-a ——
     用 act() 去點是點不到的（第一版就是這樣紅了一輪）。 */
  const pick = k => { const el = host.querySelector('[data-pick="' + k + '"]'); if (el) el.onclick(); };
  return { host, sim, btn, act, size, put, pick, s: () => sim._s(),
           txt: () => host.textContent, done: () => { sim.destroy(); host.remove(); } };
}

section('★★ 兩段走得完（老師 2026-08-18：實作體驗太弱了）');
{
  /* ★★ 為什麼從四段變兩段
     「動手試一次」被加厚之後（600 根長條的排序動畫、整排格子的搜尋動畫），
     這一步原本的前三段就變成**實驗室的弱化重播**：
       排序有多貴（100 筆 4,950 次）→ 排序大比拼選 100 筆就是這個數字
       兩種排序比一比 → 大比拼三種資料長相跑完就是這件事
       搜尋差幾倍 → 搜尋大比拼＋賽跑動畫
     ⇒ 收斂成：把數字擺在一起（回顧）→ 用那些數字算一筆帳（結帳）。
     ⚠️ 老師給的時間是「一節課的尾巴，5～10 分鐘」。 */
  eq(B.STEPS.length, 2, '★★ 只剩兩段（原本四段，前三段和實驗室重複）');
  eq(B.STEPS.map(s => s.key), ['recap', 'plan'], '★★ 回顧 → 結帳');
  /* ⚠️ 資料量要和排序大比拼對齊 —— 這一步是拿學生剛量過的數字算帳，
     數字對不上的話「你剛才量過」就是假的。 */
  eq(B.SIZES, [10, 100, 600], '★★ 資料量和「排序大比拼」對齊（10／100／600）');

  const v = mount();
  ok(v.s().at === 0 && /擺在一起/.test(v.txt()), '從「把四關的數字擺在一起」開始');
  ok(v.s().n === 100, '預設 100 筆');
  /* 三個數字要同時看得到 —— 這一段的重點就是「擺在一起」 */
  const t0 = v.txt();
  ok(/4,950/.test(t0), '★★ 看得到排序的成本（100 筆 4,950 次）');
  ok(/循序搜尋/.test(t0) && /二元搜尋/.test(t0), '★★ 兩種搜尋也在同一個畫面上');

  /* ── 可讀性（老師 2026-08-18：「調整為更有可讀性」）────────
     ⚠️ 前一版是三張並排的數字卡：4,950／100／7 **字級一樣大**，
        而這一段唯一要傳達的就是「排序遠比搜尋貴」——
        三個一樣大的數字正好把那件事藏起來
        （和搜尋那邊「進度條看不出量級」是同一個毛病）。
     ⇒ 按比例的橫條：排序滿出去，另外兩條擠在最左邊。 */
  /* ★★ 老師 2026-08-18：「排序成本不是還有插入排序？」
     ⚠️ 漏掉它等於把第 7 關的結論丟掉：插入排序的成本**看資料長相**。
     ★ 而且它不是一個數字，是一段範圍（n−1 ～ n(n−1)/2）——
       寫一個平均值會讓學生以為它也是固定的，那正是要打破的。 */
  const lines = [...v.host.querySelectorAll('.bc-line')];
  eq(lines.length, 4, '★★ 四條橫條：選擇排序、插入排序、循序搜尋、二元搜尋');
  ok(/選擇排序/.test(lines[0].textContent) && /插入排序/.test(lines[1].textContent),
     '★★ 兩種排序法都有（第 6 關、第 7 關各一條）');
  ok(!!lines[1].querySelector('.fill.rng'),
     '★★ 插入排序那一條畫成**範圍**（不是一根實心的）');
  ok(/99～4,950|99～4,950/.test(lines[1].querySelector('.vv').textContent),
     '★★ 而且標出兩端（' + lines[1].querySelector('.vv').textContent + '）');
  const w = i => parseFloat((lines[i].querySelector('.fill') || {}).style.width);
  eq(w(0), 100, '★★ 選擇排序那一條滿格（它是最大的那個）');
  ok(w(2) < 5 && w(3) < 5,
     '★★ 兩條搜尋擠在最左邊（' + w(2).toFixed(1) + '%／' + w(3).toFixed(1) +
     '%）—— 那個對比就是這一段要給的');
  /* ⚠️ 最短的那一條不可以短到看不見：二元 7 次照比例是 0.14%，
     畫出來會是一條沒有寬度的線，學生會以為那一項沒有資料。 */
  ok(w(3) >= 1, '★★ 但最短的那一條仍然看得見（實得 ' + w(3).toFixed(1) + '%）');
  /* 每一條要標出「這個數字是哪一關量到的」 */
  ok(lines.every(l => /第 \d/.test(l.querySelector('.src').textContent)),
     '★★ 每一條都標著它來自第幾關');

  /* ★ 回顧也要目標式引導（同一個回饋）：
     三顆一樣的資料量按鈕不會告訴學生「下一顆該按哪一顆」。 */
  const sizeBtn = v => v.host.querySelectorAll('.bc-sizes button');
  ok([...sizeBtn(v)].filter(b => /還沒看/.test(b.textContent)).length === 2,
     '★★ 還沒看過的資料量標著「還沒看」（一進來有兩顆）');
  ok(!!v.host.querySelector('.bc-sizes button.todo'),
     '　　而且用顏色分出來（不是三顆長一樣）');
  /* ⚠️ 兩條搜尋被壓到看不出差別 —— 那個被壓掉的差距要用**字**補回來。
     ★ 不可以為了畫得出來去動比例尺，那會讓排序那一條的震撼消失。 */
  ok(/其實差/.test(t0), '★★ 而且把被壓掉的差距用字講出來（循序 vs 二元差幾倍）');

  /* ★★ 切資料量要看得到「變了多少」——
     原本切過去只是數字換了，沒有任何東西告訴他差多少，等於白切。 */
  ok(!v.host.querySelector('.bc-grow'), '★ 第一次進來沒有比較（還沒有上一個）');
  v.size(600);
  const grow = v.host.querySelector('.bc-grow');
  ok(!!grow, '★★ 切到 600 筆 → 出現「和上一個比」');
  const g = grow.textContent;
  ok(/36 倍/.test(g), '★★ 排序漲 36 倍（n² 的樣子）');
  ok(/只多 .?3.? 次/.test(g), '★★ 二元只多 3 次 —— 兩個長大的速度完全不同');
  v.size(100);

  /* ⚠️ 這一段不問答，但也不可以一鍵跳過：
     只看 10 筆的話 45 對 9 —— 學生會覺得「好像也沒差多少」。 */
  ok(!v.host.querySelector('[data-a="recapdone"]'),
     '★★ 只看過一種資料量 → 還不能往下（不然那個「跳法」他沒看到）');
  ok(/沒看過/.test(v.txt()), '　　而且畫面上寫著還差哪幾種');
  v.size(10); v.size(600);
  ok(!!v.host.querySelector('[data-a="recapdone"]'), '★★ 三種都看過 → 出現「開始結帳」');
  ok(/179,700/.test(v.txt()), '★ 600 筆的排序成本是 179,700 次（和排序大比拼同一個數字）');
  v.act('recapdone'); v.act('next');

  /* ── 結帳：兩張收據，一次加一筆 ──────────────────────
     ★★ 老師 2026-08-18：「🧾 結帳還是不太會操作，總覺得流程不太順手，
       公式也不太好理解，操作後還是不太理解。」
     ⚠️ 前一版壞在兩件事：
       ① 一進來就要他猜「查幾次以上先排序才划算」——
          那是兩條直線的交點，國中生手上沒有可以依靠的直覺，
          只能亂填一個數字然後被告知答案。**猜不出來的猜測沒有教學功能。**
       ② 畫面上是「4,950 ＋ 7 × 100 ＝ 5,650」這種算式 ——
          那是**結果**的寫法，不是**過程**的寫法。
     ⇒ 兩張並排的收據，按「＋」一次加一筆；分界點那一題搬到最後。 */
  ok(v.s().at === 1, '走到「結帳」');

  /* ── 先選一個排序方案（老師 2026-08-18）────────────────
     「這樣就可以在下一階段來組合，先讓學生選擇後再出現帳單比對。」
     ⚠️ 之前帳單直接用選擇排序的成本，等於替學生做了決定 ——
        而「用哪一種排序法、資料本來長什麼樣」正是第 6、7 關教的事。 */
  ok(!v.host.querySelector('.bc-bill'), '★★ 還沒選方案之前**不出現**帳單');
  const plans = [...v.host.querySelectorAll('[data-pick]')].filter(b => b.dataset.pick);
  eq(plans.length, 3, '★★ 三個排序方案');
  ok(plans.every(b => /排序費/.test(b.textContent)),
     '★★ 每一個都看得到排序費 —— 那是這個決定的全部依據');
  /* ★ 三個方案的排序費要差很多，分界點才會跟著差很多 */
  const fees = B.PLANS.map(p => B.feeOf(100, p.key));
  eq(fees, [4950, 2475, 99], '★★ 100 筆的三種排序費（選擇／插入很亂／插入接近排好）');
  eq(B.PLANS.map(p => B.breakEvenBy(100, p.key)), [54, 27, 2],
     '★★ 分界點跟著垮下來：54 → 27 → 2 次　←　這一章真正的結論');
  v.pick('sel');
  ok(!!v.host.querySelector('.bc-bill'), '★★ 選完才出現帳單');
  ok(/選擇排序法/.test(v.txt()), '　　而且訊息說出他選了哪一個');

  const bills = () => [...v.host.querySelectorAll('.bc-bill')];
  eq(bills().length, 2, '★★ 兩張收據並排（不排序一張、先排序一張）');
  const billTxt = v.txt();
  ok(/排序費/.test(billTxt) && /查詢費/.test(billTxt),
     '★★ 帳單拆成「排序費」和「查詢費」兩筆（不是一條算式）');
  ok(/只付一次/.test(billTxt),
     '★★ 而且直接寫「只付一次」—— 那正是學生看不出來的地方');
  ok(!v.host.querySelector('#bc-g'),
     '★★ 一開始**不問**分界點（沒按過的話，那一題只能亂猜）');
  ok(!!v.host.querySelector('[data-add="1"]'), '★ 有「＋1 次」');
  ok(!!v.host.querySelector('[data-add="100"]'),
     '★★ 也有「＋100 次」—— 只有 ＋1 的話要按五十幾下才看得到換邊');

  /* ── 目標式引導（老師 2026-08-18）────────────────────
     「兩個階段目前太開放式了，感覺會亂按，是不是有個目標式的按鍵引導，
       例如按鈕提示或是達到什麼平衡，數字之類的。」
     ⚠️ 前一版畫面上只有三顆「＋」和兩張收據 ——
        學生不知道要按到什麼時候，也不知道按下去要看什麼，那就只能亂按。 */
  const goal = () => v.host.querySelector('.bc-goal');
  ok(!!goal(), '★★ 有一條「目標」橫幅（不是叫他自己摸索）');
  ok(/讓「先排序」那一張變便宜/.test(goal().textContent),
     '★★ 目標寫得很具體：讓「先排序」那一張變便宜');
  const leftOf = () => Number((goal().textContent.match(/還差 ([\d,]+) 次/) || [0, '0'])[1]
    .replace(/,/g, ''));
  ok(leftOf() > 0, '★★ 而且現算「還差幾次」（' + leftOf() + '）—— 有數字在跳就不是亂按');
  /* ⚠️ 不可以直接把分界點寫出來 —— 那是最後一題的答案。
     只講「還差幾次」，他按到 0 的時候自己就知道了。 */
  ok(goal().textContent.indexOf(String(B.breakEven(v.s().n))) < 0,
     '★★ 但**不**直接寫出分界點（那是最後一題的答案）');
  /* ★ 建議按哪一顆：還差很多推 ＋100，快到了推 ＋1 —— 只是加亮，不鎖住其他顆 */
  const hint = () => v.host.querySelector('.bc-kbar button.hint');
  ok(!!hint(), '★★ 而且標出「現在建議按哪一顆」');
  ok(v.host.querySelectorAll('.bc-kbar button:not(.hint):not(.ghost)').length >= 2,
     '★ 其他顆照樣按得動（只是加亮，不是鎖住）');
  const before = leftOf();
  v.host.querySelector('[data-add="1"]').onclick();
  eq(leftOf(), before - 1, '★★ 按一下「＋1」，還差的次數真的少 1');

  /* 查 1 次：不排序贏（排序費還沒被攤平） */
  ok(/不排序比較省/.test(v.txt()), '★★ 查 1 次 → 不排序比較省');
  ok(/還沒被攤平|划不來/.test(v.txt()),
     '★★ 而且講出**為什麼**（那筆排序費還沒被攤平）');
  ok(!v.host.querySelector('#bc-g'), '　　這時候還沒有最後那一題');

  /* 一路加上去，看它換邊 */
  const add = k => { const el = v.host.querySelector('[data-add="' + k + '"]'); if (el) el.onclick(); };
  /* ⚠️ 回顧那一段最後停在 600 筆，它的分界點是 305 ——
     用 ＋10 按十次只到 101，永遠等不到換邊（第一版就是這樣紅的）。
     ★ 這也正好說明「＋100」那一顆為什麼非有不可。 */
  let flip = '';
  for (let i = 0; i < 10 && !flip; i++) {
    add(100);
    const m = v.host.querySelector('.bc-msg');
    if (m && /換邊/.test(m.textContent)) flip = m.textContent;
  }
  ok(!!flip, '★★ 按「＋」按到換邊（不必按到煩）');
  ok(/你要查幾次/.test(flip), '　　而且點破：差別只在你要查幾次');
  ok(/先排序比較省/.test(v.txt()), '★ 換邊之後是先排序比較省');
  ok(/查愈多次賺愈多|降到/.test(v.txt()),
     '★★ 也講出**為什麼**（排序費只付一次，但每次查詢都變便宜）');

  /* ★★ 兩邊都看過了 → 最後一題才出現 */
  ok(!!v.host.querySelector('#bc-g'),
     '★★ 兩邊各贏過一次之後，最後那一題才出現');
  ok(/最後一題/.test(v.txt()), '　　而且標明是最後一題');
  const be = B.breakEvenBy(v.s().n, v.s().pick);
  v.put(be + 5); v.act('guess');          // ±20 都算對
  ok(/對了/.test(v.txt()), '★★ 答在分界點附近就算對（±20，不必算到剛好那一格）');
  ok(v.s().done, '★ 兩段全過');
  v.done();
}

section('★★ 換資料量要重來（分界點會跟著跑）');
{
  /* ⚠️ 10 筆的分界點是 8 次、600 筆是 305 次 ——
     換了資料量還留著上一輪按到的次數與結論，等於用錯的帳單過關。 */
  const v = mount();
  v.size(10); v.size(600);
  v.act('recapdone'); v.act('next');
  v.pick('sel');
  const add = k => { const el = v.host.querySelector('[data-add="' + k + '"]'); if (el) el.onclick(); };
  for (let i = 0; i < 6; i++) add(100);
  ok(v.s().won.sorted, '按到「先排序比較省」了');
  v.size(10);
  /* ⚠️ 方案也要清：排序費跟著資料量跑，
     留著的話帳單上會是新的 n 配舊的排序費。 */
  ok(v.s().pick === null, '★★ 換資料量 → 連選好的排序方案也清掉');
  ok(!v.s().won.sorted && !v.s().won.plain,
     '★★ 換資料量 → 兩邊各贏一次的紀錄要清掉（帳單整份換了）');
  ok(v.s().planK === 1, '★★ 查詢次數回到 1（不然帶著上一輪的次數看新帳單）');
  ok(v.s().guess === null, '★ 猜過的分界點也不算數');
  ok(!v.s().cleared.plan, '   那一段要重走');
  ok(B.breakEven(10) !== B.breakEven(600),
     '★ 兩種資料量的分界點真的不一樣（' + B.breakEven(10) + ' vs ' +
     B.breakEven(600) + '）');
  v.done();
}

section('★★ 完成之後要把四關綁起來');
{
  /* 走完整條路的捷徑（後面幾段共用）：
     回顧切三種資料量 → 結帳按到換邊 → 回答分界點。 */
  const walk = v => {
    v.size(10); v.size(600);
    v.act('recapdone'); v.act('next');
    v.pick('sel');
    const add = k => { const el = v.host.querySelector('[data-add="' + k + '"]'); if (el) el.onclick(); };
    for (let i = 0; i < 10 && !v.s().won.sorted; i++) add(100);
    v.put(B.breakEvenBy(v.s().n, 'sel')); v.act('guess');
  };
  const v = mount();
  walk(v);
  ok(v.s().done, '兩段都過了');
  const t = v.txt();
  ok(/看你要查幾次/.test(t), '★★ 結論是「看你要查幾次」');
  ok(/不必排序/.test(t) && /先排序划算/.test(t), '★ 兩種情況都講');
  ok(/第 6、7 關/.test(t), '★★ 而且接回排序那兩關 —— 這一段的工作就是把四關綁起來');
  ok(!!v.btn(/完成/), '出現「完成」的按鈕');

  /* ★★ 老師 2026-08-18：「實作體驗結束後，為什麼是『完成，回闖關地圖』？
     不是應該進入 🏁 期末檢核？」
     ⚠️ 行為本來就是對的（關卡頁會 advance），**錯的是按鈕上的字**。
        學生照著字判斷「這一關結束了」，按下去卻跳到一個他以為不存在的步驟；
        更糟的是他以為按了會離開，所以**不敢按**。
     ★ 模組不知道自己後面還有沒有東西 —— 那是關卡頁才知道的，所以字要傳進去。 */
  {
    const v3 = mount({ nextLabel: '完成，進入 🏁 期末檢核 →' });
    walk(v3);
    ok(/進入 🏁 期末檢核/.test(v3.btn(/完成/).textContent),
       '★★ 後面還有期末檢核時，按鈕就要這樣寫（不是「回闖關地圖」）');
    v3.done();
    const v4 = mount();
    walk(v4);
    ok(/回闖關地圖/.test(v4.btn(/完成/).textContent),
       '★ 沒傳的話維持原本的「回闖關地圖」（第 5 關就是這種）');
    v4.done();
    /* 關卡頁真的有傳 —— 只驗模組不算數，那一頁才是決定文字的人 */
    const src = read('11502/level.html');
    ok(/nextLabel:/.test(src), '★★ 關卡頁真的把 nextLabel 傳下去了');
    ok(/期末檢核 →/.test(src), '★★ 而且傳的是「進入 🏁 期末檢核」');
  }

  /* ★ 結論要畫螢光筆（老師 2026-08-18）——
     ⚠️ 但最多兩三處：這一塊是收尾，畫成一片黃就沒有重點了。 */
  const done = v.host.querySelector('.bc-done');
  const marks = done.querySelectorAll('.hl, .hl-b').length;
  ok(marks >= 2, '★★ 結論畫了螢光筆（' + marks + ' 處）');
  ok(marks <= 4, '★★ 而且沒有畫成一片黃');
  ok(!/\.hl\s*\{/.test(read('shared/bigcost.js').replace(/',\s*'/g, '')),
     '★★ 模組沒有自己再寫一份 .hl（樣式只能有一份，在 theme.css）');

  let passed = false;
  const v2 = mount({ onPass: () => { passed = true; } });
  walk(v2);
  v2.act('finish');
  ok(passed, '★★ 按完成才呼叫 onPass（那一步會寫紀錄、開下一關）');
  v.done(); v2.done();
}

section('★★ 不可以再重複實驗室做過的事');
{
  /* ⚠️ 這一條是這次改版的**理由本身**，所以要釘住：
     哪天有人「順手把那三段加回來」，這裡要紅。
     ★ 判的是**步驟**，不是字眼 —— 回顧那一段本來就會出現
       「排序」「搜尋」這些字，掃字串會誤殺。 */
  const keys = B.STEPS.map(s => s.key);
  ok(keys.indexOf('sort') < 0 && keys.indexOf('twosort') < 0 && keys.indexOf('search') < 0,
     '★★ 沒有「排序有多貴／兩種排序比一比／搜尋差幾倍」那三段' +
     '（動手試一次已經用動畫做過了）');
  const g = B.goal();
  ok(/要不要先排序|算出來/.test(g.why),
     '★★ 橫幅講的是「要不要先排序」這筆帳，不是再講一次成本');
  ok(/都找出來|兩種畫面/.test(g.pass),
     '★★ 過關標準寫明「兩邊都要看到」');
}

section('★★ 第 10 關的關卡設定');
{
  global.window = W;
  W.eval(read('11502/content/blocks.js'));
  W.eval(read('shared/grading.js'));
  W.eval(read('11502/config.js'));
  const L = W.BLOCK_LEVELS, GATE = W.GRADING.GATE;

  ok(!L['6-3-3'].goal, '★★ 第 10 關**沒有程式拼圖**了');
  ok(!L['6-3-3'].palette, '   調色盤也拿掉了');
  ok(L['6-3-3'].finish && L['6-3-3'].finish.kind === 'bigcost',
     '★ 最後一步指定掛 bigcost');
  ok(L['6-1-1'].finish && L['6-1-1'].finish.kind === 'bigfind',
     '★ 第 5 關掛的是 bigfind（兩關的體驗不一樣）');

  ok(GATE.needsUpload('6-3-3') === false, '★★ 第 10 關不必上傳作品');
  ok(GATE.needsUpload('6-3-1') === true, '   第 8 關要');

  /* ★★ 那支「兩個停止條件」的程式要真的搬到第 8 關 */
  const g8 = JSON.stringify(L['6-3-1'].goal);
  ok(/control\.untilfound/.test(g8),
     '★★ 第 8 關的拼圖現在是**完整版**（兩個停止條件）');
  ok(/sensing\.ask/.test(g8), '   含「詢問」那一段');
  /* ⚠️ 2026-08-17 依老師的範例檔改寫第 8 關之後，判斷從迴圈**裡面**
     搬到迴圈**外面**：原本是 control.iffound（相等就說找到了、否則往下移），
     現在是 control.ifover（位置超過長度嗎 → 沒有／找到了）。
     ★ 這一條紅了一段時間我才發現 —— 那次我沒跑 bigcost。
       教訓：改關卡資料要跑**所有**讀那份資料的測試，不是印象中相關的幾支。 */
  ok(/control\.ifover/.test(g8) && /children2/.test(g8),
     '★★ 而且報告結果在迴圈**外面**（找不到也要說話）');
  ok(/looks\.saynone/.test(g8), '   有「沒有符合的數字」那一句');
  ok(L['6-3-1'].palette.indexOf('control.until') >= 0,
     '★★ 只有一個條件的舊版留在調色盤裡當**誘餌**');
  ok(/永遠停不下來|無窮迴圈/.test(JSON.stringify(L['6-3-1'].tips)),
     '★ 而且 tips 講明拿那個誘餌會怎樣');

  /* 名稱 */
  const nm = (W.CONFIG.UNITS || []).filter(u => u[0] === '6-3-3')[0];
  /* ⚠️ 名稱要**五個字** —— 第 5～9 關都是五字
     （排隊比高矮／選擇排序法／插入排序法／循序搜尋法／二元搜尋法）。
     一度取名「資料變多會怎樣」（七字），老師指出破了節奏。 */
  ok(nm && nm[1] === '資料大爆炸',
     '★★ 關卡改名成「資料大爆炸」（實際：' + (nm ? nm[1] : '找不到') + '）');
  ok(nm && [...nm[1]].length === 5,
     '★★ 而且是**五個字**，和第 5～9 關同一個節奏');
  ok(nm && !/搜尋大比拼/.test(nm[1]),
     '   不再叫「搜尋大比拼」—— 它現在也含排序');

  /* ★★ 情境解說要**同時**講排序和搜尋 ─────────────────
     ⚠️ 老師 2026-08-17 抓到的：關卡改成總複習了，情境解說卻沒改 ——
        整段只講循序 vs 二元，第 6、7 關的排序完全沒出現。
        那會把學生帶回「二元搜尋比較快」那個錯誤結論，
        因為排序的成本從頭到尾沒有進到畫面上。
     ★ 這裡檢查的是**資料物件**（eval 之後的），不是原始碼字串 ——
        註解掩護不了。 */
  {
    const sc = L['6-3-3'].scene || {};
    const why = sc.why || '';
    ok(/選擇排序/.test(why) && /插入排序/.test(why),
       '★★ 情境有提到排序那兩關（選擇排序、插入排序）');
    ok(/循序搜尋/.test(why) && /二元搜尋/.test(why),
       '★★ 情境有提到搜尋那兩關（循序搜尋、二元搜尋）');
    ok(/4950/.test(why),
       '★★ 而且把**排序的成本**寫進畫面（4950 次）—— 少了它就只剩「二元比較快」');
    ok(/前提|先排好|要先排/.test(why),
       '★★ 點明二元搜尋的前提');
    ok(/查幾次/.test(why),
       '★★ 情境最後收在「你要查幾次？」—— 那是這一關真正的問題');
    ok(/第 6|六/.test(why) && /第 9|九/.test(why),
       '★ 講明白這是第 6～9 關的總複習');

    const all = JSON.stringify(L['6-3-3']);
    ok(/划算|划不划算/.test(L['6-3-3'].task || ''),
       '★★ 任務目標寫的是「先排序划不划算」，不是「哪一種搜尋比較快」');

    /* 概念檢測也要跨四關 */
    const qs = L['6-3-3'].quiz || [];
    const qt = JSON.stringify(qs);
    ok(qs.length >= 5, '概念檢測至少 5 題（滿分要拿 3⭐ 得答到 5 題）');
    ok(/選擇排序/.test(qt) && /插入排序/.test(qt),
       '★★ 題目考到排序那兩關');
    ok(/循序搜尋/.test(qt) && /二元搜尋/.test(qt),
       '★★ 題目考到搜尋那兩關');
    ok(/查<b>一次<\/b>|查一次|查\s?1\s?次/.test(qt) && /很多次/.test(qt),
       '★★ 有「查一次」和「查很多次」兩題 —— 同一批資料、相反的答案');
    /* ⚠️ 「循序搜尋的兩個停止條件」是第 8 關的事，程式已經搬回去了。
          題目留在這裡的話，學生會在第 10 關被問一個第 8 關的細節。 */
    ok(!/停止條件|停不下來/.test(qt),
       '★★ 不再問「循序搜尋的兩個停止條件」—— 那兩題跟著程式搬回第 8 關了');
    ok(/停|結束/.test(JSON.stringify(L['6-3-1'].quiz)),
       '   而第 8 關本來就在問「什麼時候停」');

    /* 引用框：ref 只認得這幾種，寫錯不會報錯，只會安靜地不顯示 */
    const REFS = ['scene', 'write', 'lab'];
    const bad = qs.filter(q => q.ref !== undefined && q.ref !== null &&
                               typeof q.ref !== 'number' && REFS.indexOf(q.ref) < 0);
    ok(bad.length === 0,
       '★★ 每一題的 ref 都是認得的（' + qs.map(q => q.ref).join('、') + '）' +
       (bad.length ? '　⚠️ 認不得：' + bad.map(q => q.ref).join('、') : ''));
  }

  /* 分母 */
  const ids = (W.CONFIG.UNITS || []).map(u => u[0]);
  ok(W.GRADING.moduleMax(10, ids).scratch === 32,
     '★★ 作品星滿分變成 32（8 關 × 4）—— 第 5、10 關都不交作品');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
