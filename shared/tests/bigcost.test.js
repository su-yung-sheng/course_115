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
  return { host, sim, btn, act, size, put, s: () => sim._s(),
           txt: () => host.textContent, done: () => { sim.destroy(); host.remove(); } };
}

section('★ 四段走得完');
{
  const v = mount();
  ok(v.s().at === 0 && /排序有多貴/.test(v.txt()), '從「排序有多貴」開始');
  ok(v.s().n === 100, '預設 100 筆');

  /* ① 排序有多貴 */
  v.put(99); v.act('ans');
  ok(!v.s().cleared.sort, '★ 答 99（那是找一個最小值）→ 不算對');
  ok(/找一個/.test(v.txt()), '★★ 而且指出那是第 5 關「找一個」的次數');
  v.put(4950); v.act('ans');
  ok(v.s().cleared.sort, '★ 答 4950 → 過');
  ok(/做 99 遍|遍/.test(v.txt()), '★ 解釋：排序＝把「找最小值」做很多遍');
  v.act('next');

  /* ② 兩種排序 */
  ok(v.s().at === 1, '走到第 ② 段');
  v.act('sel');
  ok(!v.s().cleared.twosort, '★ 答「選擇排序比較省」→ 不算對');
  v.act('tie');
  ok(v.s().cleared.twosort, '★★ 答「一樣」→ 過（最壞情況兩種一樣）');
  ok(/本來就排好/.test(v.txt()), '★ 而且補上真正的差別：插入排序的最好情況');
  v.act('next');

  /* ③ 搜尋差幾倍 */
  ok(v.s().at === 2, '走到第 ③ 段');
  v.put(50); v.act('ans');
  ok(!v.s().cleared.search, '答錯不算');
  v.put(7); v.act('ans');
  ok(v.s().cleared.search, '★ 答 7 → 過');
  ok(/倍/.test(v.txt()), '★ 講出差幾倍');
  ok(/但是|但先別急/.test(v.txt()),
     '★★ 而且**先擋一句**：別急著說二元比較好 —— 下一段就是那個「但是」');
  v.act('next');

  /* ④ 先排序划不划算：兩個情境 */
  ok(v.s().at === 3, '走到第 ④ 段');
  ok(v.s().planK === null, '第一題是「查 1 次」');
  v.act('sorted');
  ok(!v.s().cleared.plan, '★ 查 1 次答「先排序」→ 不對');
  v.act('plain');
  const want2 = B.breakEven(100) * 2;
  ok(v.s().planK === want2,
     '★★ 答對第一題 → 自動換成「查 ' + want2 + ' 次」的情境（現算，不是寫死 50）');
  ok(!v.s().cleared.plan, '   但還沒過（要兩題都對）');
  v.act('plain');
  ok(!v.s().cleared.plan, '★ 查 ' + want2 + ' 次答「不排」→ 不對');
  v.act('sorted');
  ok(v.s().cleared.plan, '★★ 兩題都對 → 過');
  ok(v.s().done, '★ 四段全過');
  ok(/答案卻不一樣/.test(v.txt()),
     '★★ 而且點破：同一批資料、同樣兩種方法，答案卻不一樣');
  v.done();
}

section('★★ 換資料量要重答（不然用 10 筆過關就看不到差距）');
{
  const v = mount();
  v.put(4950); v.act('ans');
  ok(v.s().cleared.sort, '100 筆答對了');
  v.size(1000);
  ok(!v.s().cleared.sort,
     '★★ 換成 1000 筆 → 那一段要重答（不然學生用小資料過關，' +
     '就看不到「資料愈多愈可怕」那件事）');
  ok(v.s().n === 1000, '   資料量真的換了');
  v.put(499500); v.act('ans');
  ok(v.s().cleared.sort, '★ 1000 筆答 499500 → 過');
  v.done();
}

section('★★ 完成之後要把四關綁起來');
{
  const v = mount();
  v.put(4950); v.act('ans'); v.act('next');
  v.act('tie'); v.act('next');
  v.put(7); v.act('ans'); v.act('next');
  v.act('plain'); v.act('sorted');
  ok(v.s().done, '四段都過了');
  const t = v.txt();
  ok(/看你要查幾次/.test(t), '★★ 結論是「看你要查幾次」');
  ok(/不必排序/.test(t) && /先排序划算/.test(t), '★ 兩種情況都講');
  ok(/第 6、7 關/.test(t), '★★ 而且接回排序那兩關 —— 這一段的工作就是把四關綁起來');
  ok(!!v.btn(/完成/), '出現「完成，回闖關地圖」');

  let passed = false;
  const v2 = mount({ onPass: () => { passed = true; } });
  v2.put(4950); v2.act('ans'); v2.act('next');
  v2.act('tie'); v2.act('next');
  v2.put(7); v2.act('ans'); v2.act('next');
  v2.act('plain'); v2.act('sorted');
  v2.act('finish');
  ok(passed, '★★ 按完成才呼叫 onPass（那一步會寫紀錄、開下一關）');
  v.done(); v2.done();
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
  ok(/control\.iffound/.test(g8) && /children2/.test(g8),
     '★ 而且是「如果…否則」—— 否則那格要把位置往下移');
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
