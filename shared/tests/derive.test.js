/* 推導活動的判定邏輯測試
   跑法：node shared/tests/derive.test.js

   這裡測的都是「會不會誤判」——
   誤判的代價是學生填對了被說錯（會放棄）、或填錯了被說對（帶著誤解走）。 */
'use strict';
const fs = require('fs');
const path = require('path');

const g = { window: {} };
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'derive.js'), 'utf8'))(g.window);
const D = g.window.DERIVE;

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; } else { fail++; console.log('  ✗ ' + label); }
}
function eq(a, b, label) { ok(a === b, label + '（得到 ' + a + '，應該是 ' + b + '）'); }

/* ── 閉合判定 ───────────────────────────────────── */
ok(D._closes(90, 4),   '正方形轉 90 度會閉合');
ok(D._closes(60, 6),   '正六邊形轉 60 度會閉合');
ok(D._closes(36, 10),  '正十邊形轉 36 度會閉合');
ok(!D._closes(90, 6),  '六條邊轉 90 度不閉合');
ok(!D._closes(60, 4),  '四條邊轉 60 度不閉合');
ok(!D._closes(0, 6),   '轉 0 度不算閉合（直線）');
ok(!D._closes(NaN, 6), '沒填數字不算閉合');

/* ★ 最重要的一條：轉兩圈也會回到起點，但那是錯的。
   六條邊轉 120 度＝把三角形描兩遍，圖形看起來是閉合的。
   只看「有沒有回到起點」會放它過關，學生就帶著「轉幾圈都可以」離開。 */
ok(!D._closes(120, 6), '★ 六條邊轉 120 度（三角形描兩遍）不能算過');
eq(D._laps(120, 6), 2, '   而且要講得出它轉了兩圈');
ok(/兩圈|2 圈/.test(D._checkAngle(120, 6).msg), '   訊息要點出「轉了兩圈」');

/* ── 回饋訊息講的是圖形，不是對錯 ─────────────────── */
const openMsg = D._checkAngle(50, 6).msg;
ok(/開口|沒有閉合/.test(openMsg), '沒閉合要說「留了開口」');
ok(/300/.test(openMsg), '   並且算給學生看總共轉了幾度');
ok(/不夠/.test(openMsg), '   6×50=300，要說「不夠一圈」');
ok(/超過/.test(D._checkAngle(80, 6).msg), '6×80=480，要說「超過一圈」');

/* ── 算式（一般化那一步）───────────────────────── */
eq(D._turnFor({ left: 360, right: 'N' }, 6), 60, '360 ÷ N 代入 6');
eq(D._turnFor({ left: 360, right: 'n' }, 4), 90, '小寫 n 也要認得');
eq(D._turnFor({ left: 360, right: 6 }, 10), 60, '右邊寫死 6：代入 10 邊還是算 360÷6＝60（所以畫不出十邊形）');
ok(isNaN(D._turnFor({ left: 360, right: 0 }, 6)), '除以 0 不能炸掉');

ok(D._verdict({ left: 360, right: 'N' }).ok, '360 ÷ N 三種邊數都閉合');
ok(!D._verdict({ left: 180, right: 'N' }).ok, '180 ÷ N 不對');
ok(!D._verdict({ left: 360, right: 'N' }, [5, 7]).ok === false, '換別的邊數來測也要過');

/* ★ 這一關要抓的誤解：右邊寫死一個數字。
   寫死 6 的話，正六邊形那一次會閉合 —— 只測一種邊數就會放它過。
   所以一定要代好幾個數字。 */
const fixed = D._verdict({ left: 360, right: 6 }, [4, 6, 10]);
ok(!fixed.ok, '★ 右邊寫死 6 不能算過（雖然六邊形那次會閉合）');
eq(fixed.bad, 4, '   要指出是代 4 邊形時垮掉');
ok(/寫死|跟著變/.test(fixed.msg), '   訊息要講「不能寫死，要放會跟著變的 N」');
ok(D._closes(D._turnFor({ left: 360, right: 6 }, 6), 6), '   （確認：只測六邊形的話它真的會過）');

ok(/左邊/.test(D._verdict({ left: '', right: 'N' }).msg), '左邊沒填要講左邊');
ok(/右邊/.test(D._verdict({ left: 360, right: '' }).msg), '右邊沒填要講右邊');

/* ── 畫出來的路徑 ───────────────────────────────── */
const sq = D._polyPath(4, 90, 60);
eq(sq.length, 5, '正方形有 4 條邊、5 個點（含起點）');
ok(Math.hypot(sq[4][0] - sq[0][0], sq[4][1] - sq[0][1]) < 0.001, '正方形最後回到起點');
const bad = D._polyPath(6, 90, 60);
ok(Math.hypot(bad[6][0] - bad[0][0], bad[6][1] - bad[0][1]) > 1, '六邊轉 90 度不會回到起點');

/* 右轉是順時針 —— 和 Scratch 一致。第一步朝右，右轉 90 度之後要往下。 */
const cw = D._polyPath(4, 90, 10);
ok(cw[1][0] > 0.001 && Math.abs(cw[1][1]) < 0.001, '第一條邊往右走');
ok(cw[2][1] < -0.001, '右轉 90 度之後往下走（順時針，和 Scratch 一樣）');

/* ── 題目資料本身 ───────────────────────────────── */
const w2 = {};
new Function('window', fs.readFileSync(
  path.join(__dirname, '..', '..', '11502', 'content', 'blocks.js'), 'utf8'))(w2);
const dv = w2.BLOCK_LEVELS['4-2-3'].derive;
ok(!!dv, '4-2-3 有推導活動');
eq(dv.steps.length, 4, '四個步驟');
eq(dv.steps[0].answer, 360, '第一步問的是 360 度');
ok(dv.steps.filter(s => s.kind === 'draw').length === 2, '有兩步是「填了真的畫」');
ok(dv.steps[3].kind === 'formula', '最後一步是寫出算式');
ok(dv.steps[3].tests.length >= 3, '算式要代入至少三種邊數才驗得出寫死的情況');

/* 題目裡不可以先把答案講出來 —— 第 2 步問「每次轉幾度」，
   題目文字若出現 60 就不用想了。 */
/* ⚠️ 不能直接搜「60」—— 題目裡的「360 度」也含有 60，會誤判。
   先把 360 拿掉再找。（我第一次就是這樣自己絆倒自己。） */
const noQ = t => String(t).replace(/360/g, '');
ok(!/60/.test(noQ(dv.steps[1].q)), '第 2 步的題目沒有洩漏答案 60');
ok(!/36(?!0)/.test(noQ(dv.steps[2].q)), '第 3 步的題目沒有洩漏答案 36');
ok(!/360\s*[÷\/]\s*N/.test(dv.steps[3].q), '第 4 步的題目沒有直接寫出 360 ÷ N');
ok(/360/.test(dv.done), '做完之後才把結論講明白');


/* ── 問題拆解（課本的「問題分析」）───────────────── */
const L = w2.BLOCK_LEVELS;
eq(L['4-2-1'].analysis.qs.length, 5, '第 1 關照課本拆成五問');
eq(L['4-2-2'].analysis.qs.length, 8, '第 2 關照課本拆成八問');
ok(L['4-2-1'].analysis.qs.every(x => x.q && x.hint), '每一問都有問句和提示');

/* ★ 第 2 關的重點全在第 6 問：先做出沒有參數的副程式，
   發現畫不出四種大小，才知道參數是來解決什麼的。
   少了這個轉折，學生只學會照抄「定義 畫正方形 (邊長)」。 */
const q6 = L['4-2-2'].analysis.qs[5];
ok(/卡住|畫得出/.test(q6.q), '★ 第 6 問是「沒有參數行不行」的轉折');
ok(/畫不出來/.test(q6.hint), '   提示直接說畫不出來，不繞過去');
ok(/參數/.test(q6.hint), '   並且點出參數是來解決這件事的');

/* 提示不能把整份答案抄出來 —— 那就變成照著拼，拆解就白做了 */
L['4-2-1'].analysis.qs.concat(L['4-2-2'].analysis.qs).forEach((x, i) => {
  ok(String(x.hint).length < 260, '第 ' + (i + 1) + ' 問的提示不要長到變成答案');
});

/* 用詞：說明裡只能出現課本的「副程式」和 Scratch 的「函式積木」 */
const allText = JSON.stringify([L['4-2-1'], L['4-2-2'], L['4-2-3']]);
ok(!/自訂積木/.test(allText), '沒有第三種講法「自訂積木」');
ok(/副程式/.test(JSON.stringify(L['4-2-1'].analysis)), '第 1 關的拆解用課本的「副程式」');

/* ── 追蹤每一輪（選擇排序）───────────────────────
   排序的難處不是步驟順序（課本寫得清清楚楚），
   是「跑完一輪之後資料變成什麼樣」。這一段就是為了那件事。 */
eq(JSON.stringify(D._minAt([5, 2, 8, 1, 9])), '[3]', '找得出最小值的位置');
eq(JSON.stringify(D._minAt([3, 1, 1, 4])), '[1,2]',
   '★ 並列最小值兩個都算對 —— 只認第一個的話，選另一個的學生會被說錯');
ok(D._pickMin([5, 2, 8], 1).ok, '點 2 → 對');
ok(!D._pickMin([5, 2, 8], 0).ok, '點 5 → 錯');
ok(/還有更小的/.test(D._pickMin([5, 2, 8], 0).msg), '★ 錯的時候說「還有更小的」');
ok(!/第 \d|位置|索引/.test(D._pickMin([5, 2, 8], 0).msg),
   '★ 但不洩漏正確位置 —— 直接給的話，學生下一輪照樣不會找');
ok(/152/.test(D._pickMin([{ v: 152, t: '152' }, { v: 141, t: '141' }], 0).msg),
   '身高那種帶標籤的資料，訊息要講得出他點的是哪一個');

/* 第 5 關：排序的觀念導入，沒有積木拼圖 */
const l5 = L['6-1-1'];
ok(!!l5, '第 5 關（排隊比高矮）有資料');
ok(!l5.goal, '★ 這一關沒有積木拼圖 —— 課本用的是圖解，不是程式');
ok(!l5.palette, '   也沒有調色盤');
eq(l5.derive.steps[0].kind, 'sort', '它的活動是「追蹤每一輪」');
eq(l5.derive.steps[0].items.length, 5, '五個人');
const hs = l5.derive.steps[0].items.map(x => x.v);
ok(new Set(hs).size === hs.length, '五個身高不重複（並列會讓「最矮的是誰」有兩個答案，導入不該一開始就碰）');
ok(hs.join() !== hs.slice().sort((a, b) => a - b).join(), '★ 一開始不能是排好的 —— 那就沒得排了');
ok(l5.analysis.qs.some(q => q.pick), '也有圈選題');
ok(!!l5.analysis.write, '也有先寫再對照');

/* ── 問題分析最後那一題：亂打不可以過 ────────────
   ★ 原本只看字數（至少 15 個字）—— 亂打十五個字也會過，
     那等於沒有這一題，而且學生第一次發現的時候就再也不會認真寫了。
   ⇒ 改成用 shared/answer.js 判「有沒有講到概念」。

   ⚠️ 但這一題不是關卡的鎖（真正的門檻在概念檢測），
      所以：講到任何一個概念就算過（full: 1），
      而且 answer.js 沒載到時要**放行** —— 少載一支 js
      就讓所有人卡在這裡，是最不划算的擋法。 */
{
  const w2 = { window: {} };
  ['ai-guide.js', 'answer.js', 'derive.js'].forEach(f =>
    new Function('window', fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))(w2.window));
  const D2 = w2.window.DERIVE;
  global.window = w2.window;          // judgeWrite 讀的是 window.ANSWER

  const W = {
    min: 15,
    keys: [
      { name: '不用重複寫', any: ['不用', '不必', '重複', '一直寫', '很多次', '省'] },
      { name: '改起來比較快', any: ['改', '修改', '除錯', '出錯', '有錯', '維護', '好修'] }
    ]
  };
  const lv = t => D2._judgeWrite(t, W).level;

  ok(lv('ㄅㄅㄅㄅㄅㄅㄅㄅㄅㄅㄅㄅㄅㄅㄅㄅ') === 'none', '★ 亂打十六個字不會過');
  ok(lv('阿阿阿阿阿阿阿阿阿阿阿阿阿阿阿阿阿') === 'none', '★ 同一個字灌長度也不會過');
  ok(lv('我覺得應該就是這樣沒錯吧我不知道啦') === 'none', '★ 全是空話也不會過');
  /* ↓ 這幾句都要放行。這一題的目的是「講出自己的理由」，不是寫作文。 */
  ok(lv('不用一直重複寫同樣的積木') === 'full', '講到重點就過（短也沒關係）');
  ok(lv('之後要改的時候只要改一個地方') === 'full', '★ 講到另一個概念也算過（full: 1）');
  ok(lv('省事啊') === 'full', '★ 三個字但講到了 —— 字數限制不套用在講到重點的人身上');

  /* answer.js 不在的時候要放行（只看字數的舊行為） */
  const w3 = { window: {} };
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'derive.js'), 'utf8'))(w3.window);
  global.window = w3.window;
  ok(w3.window.DERIVE._judgeWrite('隨便寫一段十五個字以上的話看看會不會過關', W).level === 'full',
     '★ answer.js 沒載到時放行 —— 這一題不是關卡的鎖，不該因為少一支 js 卡住全班');
  global.window = undefined;
}

/* ── ★ 抄提示不算「自己的話」 ─────────────────────
   提示（以及「回頭看問題分析」引出來的那一段）裡面，本來就含有
   這一題想聽到的說法 —— 不擋的話整個流程會變成
   「按提示 → 複製 → 貼上 → 通過」，這一題就沒有意義了。
   ⚠️ 但門檻要夠寬：學生用到題目裡的詞是正常的
      （「副程式」「正方形」本來就只有那個講法）。 */
{
  const w4 = { window: {} };
  ['ai-guide.js', 'answer.js'].forEach(f =>
    new Function('window', fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))(w4.window));
  const A = w4.window.ANSWER;
  const HINT = '六個正方形，「畫一個正方形」那一段做了六次 —— 一直重複的那一段就是模組。';
  const SPEC = {
    need: [{ name: '會重複做', any: ['重複', '一直', '很多次', '六次'] }],
    full: 1, min: 8, src: [HINT]
  };
  ok(A.judge(HINT, SPEC).level === 'none', '★ 整句抄提示 → 不算');
  ok(A.judge('嗯我覺得' + HINT + '就這樣', SPEC).level === 'none',
     '★ 加了頭尾、中間還是原文 → 一樣不算');
  ok(/用你自己的話/.test(A.judge(HINT, SPEC).why), '   而且要說清楚為什麼，不是只說「錯」');
  /* ↓ 這幾句都用到了提示裡的詞。用到不等於抄 —— 一句都不可以誤判。 */
  ok(A.judge('因為那一段會做六次，包起來比較好用', SPEC).level === 'full',
     '★ 用到「六次」但不是抄 → 要算過');
  ok(A.judge('同樣的積木一直重複拼很麻煩', SPEC).level === 'full',
     '★ 用到「一直重複」但不是抄 → 要算過');
  /* ★ 門檻：8 個中文字連續一模一樣。
     ⚠️ 上下限都要盯著 ——
       太高（12）學生少貼幾個字就繞過去；太低（5）會誤傷正常說法。
       warmup.js 那邊是 12，因為它比的是「整段題目原文」，情境不同。 */
  ok(A._COPY_RUN >= 7 && A._COPY_RUN <= 10,
     '★ 抄題門檻在 7～10 之間（現在 ' + A._COPY_RUN + '）');
  ok(A._longestRun('完全不一樣的一句話', HINT) < 6, '沒重疊時算出來就是很短');
}

/* ── ★ 回饋不可以把答案講出來 ───────────────────── */
{
  const w5 = { window: {} };
  ['ai-guide.js', 'answer.js'].forEach(f =>
    new Function('window', fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))(w5.window));
  const A = w5.window.ANSWER;
  const SPEC = {
    need: [
      { name: '不用重複寫', any: ['不用', '重複'] },
      { name: '改起來比較快', any: ['改', '維護'] }
    ]
  };
  const r = A.judge('因為不用一直重複寫同樣的積木', SPEC);
  ok(r.level === 'part', '講到一個概念 → 一半');
  ok(!/改起來比較快/.test(r.why),
     '★ 回饋不可以寫出「還差：改起來比較快」—— 那六個字就是答案，貼上去就過了');
  ok(/還有 1 個重點/.test(r.why), '   只講「還有幾個沒講到」');
  ok(/不用重複寫/.test(r.why), '   但「你已經講到的」可以講 —— 那是他自己說的');
  const r0 = A.judge('這題我完全沒有想法欸怎麼辦才好', SPEC);
  ok(!/不用重複寫|改起來比較快/.test(r0.why), '★ 完全沒講到時也不可以順便把答案說出來');
}

/* ── 問題分析：不能一路按下一步，也不能貼提示 ───────── */
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'derive.js'), 'utf8');
  ok(/asks/.test(src) && /先選出正確的那一個/.test(src),
     '★ 每一問要先答一題小判斷題才給「下一題」');
  ok(/3 題抽 1|Math\.random\(\) \* bank\.length/.test(src),
     '   而且是從那一問的題庫抽一題 —— 隔壁同學拿到的不一樣');
  ok(/shuffleArr/.test(src), '★ 選項要洗牌 —— 正解固定在第一個的話，第二次就變成「背 A」');
  /* ⚠️ 為什麼從「寫一句」改成選擇題：寫一句擋不住複製貼上。 */
  ok(/寫一句擋不住/.test(src), '   程式裡要寫明為什麼改（寫一句擋不住貼提示）');
  ok(/答錯不鎖死/.test(src), '★ 答錯可以再選 —— 這一段是「想一想」不是考試');
  /* 沒寫 asks 的那幾問退回「寫一句」，但那條路一樣要擋抄襲 */
  ok(/ANSWER\._copied/.test(src),
     '★ 退回「寫一句」的那條路也要擋抄襲 —— 2026-08-10 這裡漏掉過');
  ok(/user-select:none/.test(src), '★ 提示不給滑鼠反白 —— 提高複製貼上的摩擦');
  ok(/不是安全機制/.test(src), '   而且要寫明它不是安全機制（F12 一開就繞過了）');
}

/* 4-2-1 的每一問都要有題庫（沒有 pick 的那幾問） */
{
  const x = {};
  new Function('window', fs.readFileSync(
    path.join(__dirname, '..', '..', '11502', 'content', 'blocks.js'), 'utf8'))(x.window = {});
  const qs = x.window.BLOCK_LEVELS['4-2-1'].analysis.qs;
  qs.forEach((q, i) => {
    if (q.pick) { ok(true, '4-2-1 第 ' + (i + 1) + ' 問是圈選題'); return; }
    ok((q.asks || []).length >= 3,
       '4-2-1 第 ' + (i + 1) + ' 問有 ' + ((q.asks || []).length) + ' 題可以抽（至少 3）');
    ok((q.asks || []).every(a => a.options.length === 4 && a.why),
       '   每題四個選項，而且答對時說得出「為什麼是它」');
  });
}

/* ── ★ 真的把問題分析畫出來一次 ─────────────────────
   ⚠️ 2026-08-10 的教訓：改成「一題一題」之後，整段變成**一片空白**，
      而 derive／levelpage／quiz 三份測試全綠。
      原因是 `var chosen = {}` 寫在 draw() 呼叫**之後** ——
      var 會提升但**指派不會**，所以第一次畫的時候它是 undefined，
      askHtml 一讀就炸，然後 innerHTML 停在半路。

   ★ 前面那些測試測的都是「有沒有寫這段程式」。
     這一條測的是「畫出來到底有沒有東西」——
     而那正是學生第一眼看到的唯一一件事。 */
/* ⚠️ 這一段要 await（等換題的 0.9 秒），所以包成 async 立即函式。
   直接在最外層寫 await 的話，Node 會把整支檔案當成 ES module，
   然後 require 整個掛掉 —— 錯誤訊息是 ERR_AMBIGUOUS_MODULE_SYNTAX，
   完全看不出和「我加了一行 await」有關。 */
(async function () {
  let JSDOM2;
  try { ({ JSDOM: JSDOM2 } = require('jsdom')); } catch (e) { JSDOM2 = null; }
  if (!JSDOM2) {
    console.log('  （需要 jsdom 才能畫，跳過這一段）');
  } else {
    const dom = new JSDOM2('<div id="h"></div>');
    const w6 = dom.window;
    global.window = w6; global.document = w6.document;
    ['ai-guide.js', 'answer.js', 'derive.js'].forEach(f =>
      new Function('window', fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))(w6));
    new Function('window', fs.readFileSync(
      path.join(__dirname, '..', '..', '11502', 'content', 'blocks.js'), 'utf8'))(w6);

    const host = w6.document.getElementById('h');
    let crashed = '';
    try {
      w6.DERIVE.renderAnalysis(host, w6.BLOCK_LEVELS['4-2-1'].analysis,
        { unit: '4-2-1', onDone: function () {} });
    } catch (e) { crashed = e.message; }

    ok(!crashed, '★ 畫得出來，不會炸（' + (crashed || '沒有例外') + '）');
    const text = host.textContent.replace(/\s+/g, ' ').trim();
    ok(text.length > 60, '★ **畫面上真的有東西**（' + text.length + ' 個字）—— 空白是最糟的壞法');
    ok(/第 1 題/.test(text), '   看得到「第 1 題 / 共 5」');
    ok(host.querySelectorAll('.dv-opt').length === 4, '   第一問有四個選項');
    ok(!!host.querySelector('#dv-nx'), '   有「下一題」的按鈕');
    ok(host.querySelector('#dv-nx').disabled === true, '★ 還沒答對之前按不下去');

    /* ── ★ 答錯要換一題，不是把錯的劃掉讓他再選 ──────────
       ⚠️ 劃掉重選是四選一 → 三選一 → 二選一，
          完全不懂的人也保證會過，而他學到的是刪去法。
       ⇒ 答錯之後：整組選項鎖住、回饋說「換一題」，
         約 0.9 秒後換上另一題，而且又是完整的四個選項。 */
    const qOf = () => host.querySelector('.dv-ask-q').textContent;
    const optsNow = () => [...host.querySelectorAll('.dv-opt')];
    const nx = () => host.querySelector('#dv-nx');
    const before = qOf();
    let sawWrong = false;
    for (const b of optsNow()) {
      b.dispatchEvent(new w6.window.Event('click', { bubbles: true }));
      const fb = host.querySelector('.dv-fb');
      if (fb && /✗/.test(fb.textContent)) { sawWrong = true; break; }
      if (nx() && !nx().disabled) break;                 // 第一下就對了
    }
    if (sawWrong) {
      ok(optsNow().every(b => b.disabled),
         '★ 答錯之後整組選項鎖住 —— 不讓他在剩下三個裡面挑');
      ok(/換一題/.test(host.querySelector('.dv-fb').textContent),
         '   而且說清楚接下來會換一題');
      await new Promise(r => setTimeout(r, 1200));
      ok(qOf() !== before, '★ 真的換了一題（' + qOf().slice(0, 18) + '…）');
      ok(optsNow().length === 4 && optsNow().every(b => !b.disabled),
         '★ 新的一題又是完整的四選一 —— 刪去法沒有累積效果');
    } else {
      ok(true, '（這一次第一下就答對，換題的路徑由下一輪測）');
    }

    /* 答對之後才解鎖 —— 走真正的點擊路徑，不要偷改內部狀態。
       ⚠️ 不要用「一個一個試到對為止」。答錯現在會換一題，
          所以那個寫法變成隨機亂點，四選一 ——
          它**大部分時候會過，偶爾紅一次**，而那種測試最糟：
          紅的時候沒有人相信是真的壞了，久了就變成按重跑。
       ⇒ 從關卡資料查出正解的文字，直接點那一顆。
         這樣測的還是真的點擊路徑，但結果是確定的。 */
    const bank = w6.BLOCK_LEVELS['4-2-1'].analysis.qs[0].asks || [];
    const one = bank.filter(a => a.q === qOf())[0];
    ok(!!one, '畫面上這一題找得回題庫裡的那一筆（' + qOf().slice(0, 16) + '…）');
    if (one) {
      const want = one.options[one.answer];
      const right = optsNow().filter(b => b.textContent === want)[0];
      ok(!!right, '   四個選項裡有正解');
      if (right) right.dispatchEvent(new w6.window.Event('click', { bubbles: true }));
    }
    ok(nx() && nx().disabled === false,
       '★ 答對之後「下一題」才亮起來');

    /* ── ★ 4-2-2 也要真的畫一次 ──────────────────────
       它和 4-2-1 不一樣：八問、圈選題在第 2 問（不是第 1 問）。
       ⚠️ 只畫範本那一關的話，等於只驗證了一種形狀 ——
          而 2026-08-11 補完 4-2-2 之前，它有七問是「寫一句」，
          畫出來完全是另一條路徑。 */
    const host2 = w6.document.createElement('div');
    w6.document.body.appendChild(host2);
    let crash2 = '';
    try {
      w6.DERIVE.renderAnalysis(host2, w6.BLOCK_LEVELS['4-2-2'].analysis,
        { unit: '4-2-2', onDone: function () {} });
    } catch (e) { crash2 = e.message; }
    ok(!crash2, '★ 4-2-2 也畫得出來（' + (crash2 || '沒有例外') + '）');
    const t2 = host2.textContent.replace(/\s+/g, ' ').trim();
    ok(t2.length > 60, '★ 4-2-2 畫面上真的有東西（' + t2.length + ' 個字）');
    ok(/共 8/.test(t2), '   八問都算進去了（' + (t2.match(/第 \d+ 題[^日]{0,8}/) || [''])[0].trim() + '）');
    ok(host2.querySelectorAll('.dv-opt').length === 4, '   第一問有四個選項');
    ok(host2.querySelector('#dv-nx') && host2.querySelector('#dv-nx').disabled === true,
       '★ 4-2-2 第一問也是答對才放行 —— 一路按下一步不可以整段跳過');

    global.window = undefined; global.document = undefined;
  }

  console.log('通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
