/* 實作體驗：一百個人（第 5 關的最後一步）
   跑法：node shared/tests/bigfind.test.js

   ★ 為什麼這一段存在
     課本 6-1 是觀念導入，第 5 關**沒有程式作品要交** ——
     但每一關的最後一步都叫學生「在 Scratch 做出來並上傳」，
     他會卡在那裡找一個不存在的作業。
     ⇒ 換成一段體驗，而且是這一關唯一做得到、前面幾步做不到的事：
       **把資料量放大**。

   ★★ 要讓學生撞到的那句話
     概念檢測寫著「五個人你看一眼就好，五萬個人呢？」
     五個人的實驗室證明不了它 —— 五個人**真的**一眼就看完。
     一百個人才會痛。所以這一份最要緊的檢查是：
       · 真的是 100 個
       · 身高不可以重複（不然「最矮的」有兩個答案，學生被判錯是系統的鍋）
       · 三題都要走得完，而且會擋 */
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
W.eval(read('shared/bigfind.js'));
const B = W.BIGFIND;
ok(!!B, '模組載得起來');

section('★★ 出題：一百個人，身高不可以重複');
{
  const it = B.makeCase(100);
  ok(it.length === 100, '★ 真的是 100 個（' + it.length + '）');
  const hs = it.map(p => p.h);
  ok(new Set(hs).size === 100,
     '★★ 身高全部不一樣 —— 有兩個並列最矮的話，' +
     '「最矮的是誰」有兩個答案，學生點到另一個會被判錯，那是系統的鍋');
  ok(hs.every(h => h >= 120 && h <= 199.5), '身高落在 120～199.5 公分');
  /* 五個人和一百個人是不同的體驗 —— 這一段的全部意義就在數量 */
  ok(B.makeCase(100).length > B.makeCase(5).length * 10,
     '★ 這一段給的是「一大片」，不是實驗室那種五個');

  /* 多跑幾次，確認每次都不重複（洗牌寫錯的話會偶爾撞號） */
  let dup = 0;
  for (let k = 0; k < 30; k++) {
    const c = B.makeCase(100);
    if (new Set(c.map(p => p.h)).size !== 100) dup++;
  }
  ok(dup === 0, '★★ 跑 30 次都沒有重複的身高（' + dup + ' 次出問題）');
}

section('★ 三題的答案算得對');
{
  const it = [{ id: 0, h: 150 }, { id: 1, h: 141 }, { id: 2, h: 160 },
              { id: 3, h: 148 }, { id: 4, h: 155 }];
  ok(B.minOf(it) === 1, '最矮的是第 2 個（141）');
  const low2 = B.lowestK(it, 2);
  ok(low2[1] && low2[3], '★ 最矮的兩個是 141 和 148');
  ok(!low2[0] && !low2[2] && !low2[4], '   其他三個不在裡面');
  ok(B.minOf(it, low2) === 0,
     '★★ 排掉最矮的兩個之後，下一個該搬的是 150 —— 那就是選擇排序的下一回合');
  ok(B.compares(100) === 99, '★ 100 個人要比 99 次（第一個直接記住）');
  ok(B.compares(5) === 4, '   5 個人比 4 次，和第 5 關的實驗室對得起來');
}

section('★ 三題的定義');
{
  ok(B.TASKS.length === 3, '三題');
  const keys = B.TASKS.map(t => t.key);
  ok(keys.join() === 'min,next,race',
     '★ 順序：找最矮 → 找下一個 → 比速度（' + keys.join('→') + '）');
  ok(/選擇排序/.test(B.TASKS[1].why),
     '★★ 第 2 題要點破「這就是選擇排序的第 11 回合」—— 直接接到第 6 關');
  /* ⚠️ 這一段的結論**不是**「電腦比較快」。
     國中生按幾下就知道電腦快，那不必教。 */
  ok(/不會漏看|沒有跳過|不是誰|不是快慢|重點不是/.test(B.TASKS[2].why),
     '★★ 比速度那一題的結論是「電腦不會漏看」，不是「電腦比較快」');
}

/* ── UI：同一個實例從頭走到尾 ─────────────────────── */
function mount(opts) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = B.mount(host, Object.assign({ n: 100 }, opts || {}));
  const cells = () => [...host.querySelectorAll('[data-i]')];
  const btn = re => [...host.querySelectorAll('[data-a]')].filter(b => re.test(b.textContent))[0];
  return { host, sim, cells, btn, s: () => sim._s(), txt: () => host.textContent,
           done: () => { sim.destroy(); host.remove(); } };
}

section('★★ 畫成一整片站著的人（不是一格一個數字）');
{
  /* ⚠️ 老師 2026-08-17：「太沒有遊戲性了，有很多人形圖案、站著的畫面，
     頭上有身高顯示」。
     ★ 這不只是好看：一格一個數字會變成「找最小的數字」——
       那是算術題。畫成人、而且**身高真的畫出來**，
       學生才會像在人群裡找人：先用看的掃，然後發現
       「有幾個好像差不多高，我分不出來」—— 那個瞬間就是這一關。 */
  const v = mount({ big: true });
  /* ⚠️⚠️ 一百個人**一定要一屏塞得下**（老師 2026-08-17：
     「不在同一個頁面內顯示全部的人，不好選擇與比對」）。
     ★ 這一關的動作就是「掃一遍、比一比」——
       要捲動的話學生看不到全部，也就無從比較。
     ⇒ 20 欄 × 5 排，而不是 10 欄 × 10 排。 */
  const rows = v.host.querySelectorAll('.bf-row');
  ok(rows.length === 5, '★★ 只排 5 排（' + rows.length + '）—— 一屏看得完');
  ok(rows[0].querySelectorAll('[data-i]').length === 20, '★ 每排 20 個人');

  /* ⚠️ 每排幾個人是寫在兩個地方的：JS 的 per 和 CSS 的 grid-template-columns。
     對不上的話最後一排會歪掉，而且沒有人看得出為什麼。 */
  const src0 = read('shared/bigfind.js');
  ok(/var per = 20;/.test(src0) && /repeat\(20,minmax/.test(src0),
     '★★ JS 的每排人數和 CSS 的欄數一致（都是 20）');

  /* 總高度要壓在一屏內：最高的人 + 數字 + 間距，乘以 5 排 */
  const tallest = Math.max(...[...v.host.querySelectorAll('.bf-body')]
    .map(b => Number((b.getAttribute('style') || '').replace(/\D/g, ''))));
  const rowH = tallest + 11 + 10 + 8;          // 身體 + 頭 + 數字 + 間距
  ok(rowH * 5 < 420,
     '★★ 五排總高約 ' + (rowH * 5) + 'px —— 壓在一屏內（不必捲動）');

  const one = v.cells()[0];
  ok(!!one.querySelector('.bf-hd'), '★ 每個人有頭');
  ok(!!one.querySelector('.bf-body'), '★ 有身體');
  ok(/^\d/.test(one.querySelector('.ht').textContent), '★★ 頭上有身高數字');

  /* ★★ 最要緊的一條：人形高度要**跟著身高變**。
     全部一樣高的話，畫成人形就只是裝飾，
     「用看的分不出來」會變成系統的問題，不是學生的體驗。 */
  const st = v.s();
  const lo = st.items.reduce((a, b) => (a.h < b.h ? a : b));
  const hi = st.items.reduce((a, b) => (a.h > b.h ? a : b));
  const px = i => Number((v.cells()[i].querySelector('.bf-body')
                          .getAttribute('style') || '').replace(/\D/g, ''));
  ok(px(hi.id) > px(lo.id),
     '★★ 最高的人畫得比最矮的高（' + px(hi.id) + 'px > ' + px(lo.id) + 'px）');
  ok(px(hi.id) - px(lo.id) >= 25,
     '★ 而且差距夠明顯（' + (px(hi.id) - px(lo.id)) + 'px）—— 差幾像素等於沒畫');

  /* 中間值也要落在中間，不是只有兩端對 */
  const mid = st.items.slice().sort((a, b) => a.h - b.h)[50];
  ok(px(mid.id) > px(lo.id) && px(mid.id) < px(hi.id),
     '★ 中等身高的人畫出來也在中間（比例是連續的，不是分三級）');

  /* ⚠️ .bf-head 是**步驟列**的容器，人的頭一定要叫別的名字。
     撞名的話步驟列會被套上 9×9 圓形整條壞掉 ——
     而 jsdom 不套 CSS，測試照樣全綠。 */
  const src = read('shared/bigfind.js');
  ok(!/'\.bf-p:hover \.bf-head/.test(src) && /\.bf-hd\{/.test(src),
     '★★ 人的頭叫 .bf-hd，沒有和步驟列的 .bf-head 撞名');
  v.done();
}

section('★★ 第 1 題：找最矮的');
{
  const v = mount();
  ok(v.cells().length === 100, '★ 畫面上真的畫出 100 個');
  ok(/最矮/.test(v.txt()), '題目寫著找最矮的');
  const st = v.s();
  const want = B.minOf(st.items);
  /* 先點一個錯的 */
  const wrong = (want + 7) % 100;
  v.cells()[wrong].onclick();
  ok(!v.s().cleared.min, '★ 點錯 → 不算過');
  ok(/還有人比他矮/.test(v.txt()), '★★ 而且告訴他「還差幾公分」，不是只說錯');
  v.cells()[wrong === 0 ? 1 : 0].onclick();
  if (!v.s().cleared.min) {
    ok(/一個一個看很累/.test(v.txt()),
       '★★ 錯第二次 → 點破「一個一個看很累對不對？那正是這一關要你體會的事」');
  } else { ok(true, '（第二下剛好點中，跳過這一條）'); }

  v.cells()[want].onclick();
  ok(v.s().cleared.min, '★ 點對 → 過第 1 題');
  ok(/五個人|一百個人|掃了好幾遍/.test(v.txt()),
     '★★ 過關之後把那句話講出來（五個人一眼就看完，一百個呢）');
  ok(!!v.btn(/下一題/), '出現「下一題」');
  v.done();
}

section('★★ 第 2 題：已排好 10 個，找下一個該搬的');
{
  const v = mount();
  const st0 = v.s();
  v.cells()[B.minOf(st0.items)].onclick();
  v.btn(/下一題/).onclick();
  ok(v.s().at === 1, '走到第 2 題');
  const st = v.s();
  ok(Object.keys(st.doneSet).length === 10, '★ 有 10 個被標成「已排序」');
  ok(/打勾/.test(v.txt()) || /✔/.test(v.host.innerHTML), '★ 畫面上看得出是哪 10 個');

  /* 點已排好的那些 → 要擋下來並說明 */
  const doneIdx = st.items.findIndex(p => st.doneSet[p.id]);
  v.cells()[doneIdx].onclick();
  ok(/已經排好/.test(v.txt()), '★★ 點打勾的 → 明講「那些已經排好了」，不是靜靜不動');
  ok(!v.s().cleared.next, '   而且不算答對');

  const want = B.minOf(st.items, st.doneSet);
  ok(!st.doneSet[st.items[want].id], '★ 正解不在已排序那 10 個裡面');
  v.cells()[want].onclick();
  ok(v.s().cleared.next, '★ 點對 → 過第 2 題');
  ok(/第 11 回合/.test(v.txt()), '★★ 而且直接點破：這就是選擇排序的第 11 回合');
  v.done();
}

section('★★ 第 3 題：比速度，而且要先按開始計時');
{
  const v = mount();
  v.cells()[B.minOf(v.s().items)].onclick();
  v.btn(/下一題/).onclick();
  const st1 = v.s();
  v.cells()[B.minOf(st1.items, st1.doneSet)].onclick();
  v.btn(/下一題/).onclick();
  ok(v.s().at === 2, '走到第 3 題');

  const want = B.minOf(v.s().items);
  v.cells()[want].onclick();
  ok(!v.s().cleared.race, '★ 還沒按開始就點 → 不算');
  ok(/先按/.test(v.txt()), '   而且告訴他要先按開始計時');

  v.btn(/開始計時/).onclick();
  v.cells()[want].onclick();
  ok(v.s().cleared.race, '★ 按了開始、再點對 → 過第 3 題');
  ok(v.s().mySec >= 0, '   有記到花了幾秒');

  ok(!!v.btn(/讓電腦做一次/), '★★ 出現「讓電腦做一次」');
  v.done();
}

section('★★ 三題都過才給「完成」（這一步會擋）');
{
  const v = mount();
  ok(!v.btn(/完成/), '★ 一開始沒有「完成」按鈕');
  v.cells()[B.minOf(v.s().items)].onclick();
  ok(!v.btn(/完成/), '★ 只過第 1 題 → 還是沒有');
  v.btn(/下一題/).onclick();
  const s1 = v.s();
  v.cells()[B.minOf(s1.items, s1.doneSet)].onclick();
  ok(!v.btn(/完成/), '★ 過兩題 → 還是沒有');
  v.btn(/下一題/).onclick();
  v.btn(/開始計時/).onclick();
  v.cells()[B.minOf(v.s().items)].onclick();
  ok(v.s().done, '★★ 三題都過 → 完成');
  ok(!!v.btn(/完成/), '★★ 這時候才出現「完成，回闖關地圖」');

  let passed = false;
  const v2 = mount({ onPass: () => { passed = true; } });
  v2.cells()[B.minOf(v2.s().items)].onclick();
  v2.btn(/下一題/).onclick();
  const q = v2.s();
  v2.cells()[B.minOf(q.items, q.doneSet)].onclick();
  v2.btn(/下一題/).onclick();
  v2.btn(/開始計時/).onclick();
  v2.cells()[B.minOf(v2.s().items)].onclick();
  v2.btn(/完成/).onclick();
  ok(passed, '★★ 按「完成」才呼叫 onPass —— 那一步會把紀錄寫進去、開啟第 6 關');
  v.done(); v2.done();
}

section('★★ 每次進來要不一樣，而且第 ③ 題要換一批人');
{
  /* ⚠️⚠️ 老師問「位置每次相同嗎」—— 查下來第 ①③ 題**是同一批人、同一個答案**。
     第 ③ 題是計時題：學生記得剛才點哪裡，一秒就點完，
     量到的是記憶力不是找人。
     ★ 這和 searchlab 那個「換一題永遠出同一題」是同一種錯：
       畫面看起來換了，其實沒換 —— 而且不走 UI 就抓不到。 */

  /* ① 每次掛載都是不同的人群 */
  const sets = new Set();
  for (let k = 0; k < 20; k++) {
    sets.add(B.makeCase(100).map(p => p.h).join(','));
  }
  ok(sets.size === 20, '★ 每次出題都不一樣（20 次都不同）');

  /* ② 答案的位置也要散開，不可以老是在同一區 */
  const spots = new Set();
  for (let k = 0; k < 40; k++) {
    spots.add(B.minOf(B.makeCase(100)));
  }
  ok(spots.size >= 25,
     '★ 最矮的落點夠散（40 次落在 ' + spots.size + ' 個不同位置）');

  /* ③★★ 走完第 ①② 題進到第 ③ 題時，人群要換掉 */
  let changed = 0;
  for (let k = 0; k < 15; k++) {
    const v = mount();
    const before = v.s().items.map(p => p.h).join(',');
    const a1 = B.minOf(v.s().items);
    v.cells()[a1].onclick();
    v.btn(/下一題/).onclick();
    const s2 = v.s();
    v.cells()[B.minOf(s2.items, s2.doneSet)].onclick();
    v.btn(/下一題/).onclick();
    const after = v.s().items.map(p => p.h).join(',');
    if (before !== after) changed++;
    v.done();
  }
  /* ⚠️ 要釘的是「**人群換掉了**」，不是「答案不在同一格」。
     新的一群人，最矮的**剛好**又落在同一個位置的機率是 1/100 ——
     那是巧合，不是 bug。把它算成失敗的話，
     這條測試每七、八次就會無故紅一次。
     ★ 會隨機紅的測試，紅的時候沒有人相信是真的壞了。 */
  ok(changed === 15,
     '★★ 第 ③ 題**每次都換一批人**（15 次裡換了 ' + changed + ' 次）—— ' +
     '不換的話計時量到的是記憶力');

  /* ④ 但第 ② 題**不該**換：它要沿用同一群人，
     學生才看得出「已經搬走 10 個」是怎麼回事 */
  const v = mount();
  const before2 = v.s().items.map(p => p.h).join(',');
  v.cells()[B.minOf(v.s().items)].onclick();
  v.btn(/下一題/).onclick();
  ok(v.s().items.map(p => p.h).join(',') === before2,
     '★★ 第 ② 題**沿用同一群人** —— 換掉的話「已經搬走 10 個」就沒有來由');
  ok(Object.keys(v.s().doneSet).length === 10, '   而且那 10 個是從這一群裡挑的');
  v.done();
}

section('★ 目標與過關標準');
{
  const g = B.goal({ n: 100 });
  ok(!!g.why && !!g.pass, '兩個欄位都有');
  ok(/100/.test(g.why), '★ 目標裡講到 100 個人');
  ok(/五個人|5 個人/.test(g.why),
     '★★ 而且解釋為什麼不是五個 —— 五個人證明不了「為什麼需要演算法」');
  ok(/三題/.test(g.pass) && /①/.test(g.pass), '★ 標準列出三題');
}

section('★★ 閘門：這一步沒做完，第 6 關不開');
{
  const G = {};
  new Function('window', read('shared/grading.js'))(G);
  const GATE = G.GRADING.GATE;
  const U = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-1-1',
             '6-2-1', '6-2-2', '6-3-1', '6-3-2', '6-3-3'].map((id, i) => ({ no: i + 1, id }));
  const four = { '4-2-1': 3, '4-2-2': 3, '4-2-3': 3, '4-3-1': 3 };
  ok(GATE.needsUpload('6-1-1') === false, '★ 第 5 關不必上傳作品');
  ok(GATE.needsUpload('6-2-1') === true, '   其他關要');
  ok(GATE.openUpTo(U, true, null, four, {}) === 5,
     '★★ 體驗沒做完 → 只開到第 5 關');
  ok(GATE.openUpTo(U, true, null, four, { '6-1-1': true }) === 6,
     '★★ 體驗做完了 → 第 6 關開了');
  ok(/實作體驗/.test(GATE.reason(6, U, true, null, four, {})),
     '★★ 而且卡住時講的是「把實作體驗做完」，不是叫他去上傳一個不存在的作業');
  /* ⚠️ 沒傳 playDone 進來要當作沒做 —— 寧可多擋，不要「以為擋著其實沒擋」 */
  ok(GATE.cleared('6-1-1', null, {}) === false,
     '★★ 沒傳紀錄進來就當作沒做（不可以預設放行）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
