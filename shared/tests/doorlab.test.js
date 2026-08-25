/* 第一節課的暖身關卡與三個檢核
   跑法：node shared/tests/doorlab.test.js   （需要 jsdom：真的把互動點一遍）

   ★ 老師 2026-08-24：「先完成第一節的課程看看效果如何再進行微調」

   ⚠️ 這一支盯的是**判定**，不是版面。判定寫錯的症狀是「學生明明想錯了卻過關」，
      而那在畫面上完全看不出來 —— 只有這種測試抓得到。

   ★★ 三個檢核共用的骨架：先講你認為會怎樣 → 再執行 → 說對了才算。
      所以每一條「過關」的斷言，都要同時檢查**預測**和**結果**。 */
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

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="a"></div><div id="b"></div></body>',
    { url: 'https://x/course_115/11501/5016b.html' });
  const w = dom.window;
  global.document = w.document; global.window = w;
  new Function('window', read('shared/ultralab.js'))(w);
  /* ★ B 的開放式作答走這兩支（順序不可以反過來：answer 會呼叫 AIGUIDE.hitKeys）。
     ⚠️ askai.js **故意不載** —— 沒有 KEY 的環境就是學生的預設狀態，
        測試要盯的正是「AI 關著的時候，這一題照樣判得出來」。 */
  new Function('window', read('shared/ai-guide.js'))(w);
  new Function('window', read('shared/answer.js'))(w);
  new Function('window', read('shared/labkit.js'))(w);
  new Function('window', read('shared/doorlab.js'))(w);
  return w;
}
const W = boot();
const U = W.ULTRALAB, D = W.DOORLAB;

section('隨機與 seed');
{
  ok(U.rngFrom('1234')() === U.rngFrom('1234')(), '★ 同一個 seed 一定產生同一組（全班同題靠這個）');
  ok(U.rngFrom('1234')() !== U.rngFrom('9999')(), '   不同 seed 不一樣');
  /* ⚠️ Math.random() 沒有種子，所以不可以拿來出題 —— 這一條擋的是「順手改用 Math.random」。 */
  ok(!/Math\.random\(\)/.test(read('shared/ultralab.js').replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/Date\.now\(\) \+ '-' \+ Math\.random\(\)/, '')),
     '★ 出題不用 Math.random（只有「沒給 seed 時」拿它當亂數來源）');

  /* 答錯要換一組 —— 重試同一題的話，第二次答對只證明他記得剛才的答案。
     ⚠️ 這一條第一版是「跑 60 次看有沒有撞到」——**統計式斷言擋不住罕見事件**：
        距離有 56 種，隨機兩次剛好一樣的機率本來就低，
        把守衛整個拿掉測試照樣綠（突變測試當場抓到）。
     ⇒ 改成餵一個**會故意重複**的亂數：前兩次都吐同一個值。
        有守衛 → 它會再抽一次，換到不同的；沒守衛 → 直接回同一組。 */
  {
    const vals = [0, 0, 0.9, 0, 0, 0.9];
    let i = 0;
    const stub = () => vals[i++ % vals.length];
    const p = U.caseFor(2, stub, null);
    const n = U.caseFor(2, stub, p);
    ok(JSON.stringify(p) !== JSON.stringify(n),
       '★★ 亂數吐出同一個值時，換一組仍然換得掉（d ' + p.d + ' → ' + n.d + '）');
  }
}

section('暖身：三個節點的判定');
{
  const r = U.rngFrom('w');
  const c1 = U.caseFor(1, r, null);
  ok(U.judge(1, c1, 'echo') && !U.judge(1, c1, 'obj'),
     '① 只有「感測器自己發出去彈回來」算對');

  const c2 = U.caseFor(2, r, null);
  ok(c2.total === c2.d * 2, '② 來回長度是距離的兩倍（d=' + c2.d + '、來回=' + c2.total + '）');
  ok(U.judge(2, c2, c2.answer), '   答 d 過關');
  ok(!U.judge(2, c2, c2.total),
     '★★ 答「來回長度」不過關 —— 那是最典型的錯（沒除以 2）');
  ok(/總長度/.test(U.hintFor(2, c2, c2.total)),
     '   而且提示要**點破**那個錯，不是直接給答案');
  ok(!/\b' + c2.answer + '\b/.test(U.hintFor(2, c2, c2.total)), '   提示裡不出現正解');

  /* ⚠️ ③ 的數字要好算：t 只取偶數毫秒，答案一定是 34 的倍數。
     不控制的話會出現 51 這種讓學生卡在除法、而不是卡在概念的題目。 */
  let allOk = true, ts = new Set();
  const r3 = U.rngFrom('t');
  for (let i = 0; i < 60; i++) {
    const c = U.caseFor(3, r3, null);
    ts.add(c.t);
    if (c.t % 2 !== 0 || c.answer !== U.SPEED * c.t / 2 || c.answer % U.SPEED !== 0) allOk = false;
  }
  ok(allOk, '★ ③ 時間都是偶數毫秒、答案都是 ' + U.SPEED + ' 的整數倍');
  ok([...ts].every(t => t >= 2 && t <= 6), '   時間落在 2～6 毫秒（' + [...ts].sort().join('／') + '）');
  const c3 = U.caseFor(3, U.rngFrom('t2'), null);
  ok(!U.judge(3, c3, U.SPEED * c3.t), '★★ 答「聲音走的總長」不過關');
  ok(!U.judge(3, c3, ''), '   空白不過關');
}

section('A｜門檻與遲滯');
{
  const clean = D.runDoor(D.SEQ, 10, 20);
  ok(clean.opens === 1 && clean.closes === 1, '★ 10／20 → 乾淨的一開一關');

  const same = D.runDoor(D.SEQ, 10, 10);
  ok(same.opens > 1, '★★ 兩個門檻設一樣 → 門抖了 ' + same.opens + ' 次（這就是整個檢核的重點）');

  /* ⚠️ 窄帶也要抖 —— 序列中段那個 14 就是為了這件事放的。 */
  const narrow = D.runDoor(D.SEQ, 12, 13);
  ok(narrow.opens > 1, '★ 12／13 這種窄帶也會抖（' + narrow.opens + ' 次）');

  const never = D.runDoor(D.SEQ, 8, 25);
  ok(never.closes === 0, '   關門門檻設太遠 → 門一直開著（關 0 次）');

  ok(D.judgeA(2, clean).predOk && D.judgeA(2, clean).cleanOk, '預測 2 次 ＋ 乾淨 → 過');
  ok(!D.judgeA(5, clean).predOk, '★★ 設對了但**猜錯次數** → 不過（先講再做）');
  ok(!D.judgeA(D.judgeA(0, same).total, same).cleanOk,
     '★★ 猜對次數但門在抖 → 也不過（兩個條件都要）');
  ok(!D.judgeA('', clean).predOk, '   沒填預測 → 不過');
}

section('B｜狀態');
{
  const good = D.FIXES.filter(f => f.good);
  ok(good.length === 1 && good[0].key === 'state', '只有「加一個變數記住門開了沒」是對的');
  ok(D.FIXES.every(f => f.after && f.after.length > 10),
     '★★ 每一個選項都要有「執行後會看到什麼」—— 猜錯的代價是眼見為憑，不是一句答錯');
  ok(/再走近一點/.test(D.FIXES.filter(f => f.key === 'tight')[0].after),
     '   改門檻的人會看到：人再走近一點，門又轉了');
  ok(/每 3 秒/.test(D.FIXES.filter(f => f.key === 'wait')[0].after),
     '   加等待的人會看到：門每 3 秒轉一次');
}

section('C｜秒數校準（兩輪）');
{
  const r = U.rngFrom('c');
  let prev = null, ns = [], gap = true, range = true;
  for (let i = 0; i < 40; i++) {
    const n = D.caseC(r, prev);
    if (prev !== null && Math.abs(n - prev) <= 0.3) gap = false;
    if (n < 0.8 || n > 2.4) range = false;
    ns.push(n); prev = n;
  }
  ok(range, '★ N 落在 0.8～2.4 秒');
  ok(gap, '★★ 換一台馬達時和上一台至少差 0.3 秒 —— 不然「換一台」等於沒換');

  ok(D.judgeC(1.4, 1.4).ok && D.judgeC(1.5, 1.4).ok, '誤差 ±' + D.TOL + ' 內算過');
  ok(!D.judgeC(1.7, 1.4).ok, '   超過就不過');
  ok(D.judgeC(1.1, 1.4).how === 'short', '★ 設太短 → 判「門只開一半」');
  ok(D.judgeC(1.8, 1.4).how === 'long', '★ 設太長 → 判「馬達還在推」');
  ok(D.judgeC('abc', 1.4).how === 'bad', '   非數字不當成 0');
  ok(/一半/.test(D.sayC(D.judgeC(1.1, 1.4))) && /還在推/.test(D.sayC(D.judgeC(1.8, 1.4))),
     '★★ 兩種錯的回饋不一樣 —— 學生要從「哪一種錯」學會怎麼調');
}

section('真的掛得起來');
{
  const warm = W.document.getElementById('a');
  const api = U.mount(warm, { mode: 'warmup', seed: '1234' });
  ok(warm.innerHTML.length > 200, '暖身畫得出來');
  ok(api.node() === 1, '   從節點 1 開始');
  ok(warm.querySelectorAll('.ul-opt').length === 3, '   ① 有三個選項');
  warm.querySelector('[data-k="echo"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.node() === 2, '★ 答對就進節點 2');
  ok(!!warm.querySelector('#ul-in'), '   節點 2 是填空（不是選擇題）');

  const box = W.document.getElementById('b');
  const d = D.mount(box, { seed: '1234' });
  ok(box.innerHTML.length > 200 && d.step() === 'A', '三個檢核掛得起來，從 A 開始');
  ok(!!box.querySelector('#dl-pred'), '★ A 一開始就要先填「你猜幾次」');
}


section('★ 頁面順序（老師 2026-08-24：「暖身活動不是應該在最前面?」）');
{
  /* ⚠️ 暖身是**進場券**，不是複習：這一節後面全都建立在「那個距離數字」上。
     放在最後的話，學生是先用了它、最後才知道它怎麼來的。
     ⇒ 順序必須是 生活應用 → 目標／器材 → **暖身** → 模擬 → 解析 → 檢核。 */
  const page = read('11501/5016b.html');
  const at = k => page.indexOf(k);
  const apps  = at('id="detail-apps"');
  const goals = at('id="detail-objectives"');
  const warm  = at('id="detail-warm"');
  const sim   = at('id="interactive-playground"');
  const demo  = at('id="detail-demo-container"');
  const lab   = at('id="detail-lab"');
  ok([apps, goals, warm, sim, demo, lab].every(x => x > 0), '六個區塊都在');
  ok(apps < goals && goals < warm, '★ 暖身排在生活應用與學習目標之後');
  ok(warm < sim && warm < demo, '★★ 暖身在**教材之前** —— 它是進場券，不是複習');
  ok(demo < lab, '★ 三個檢核排在最後（學完才驗）');

  /* 暖身過了之後不可以直接把學生丟到最底下 —— 中間那段教材就跳過去了。 */
  ok(!/onDone: function \(\) \{[\s\S]{0,400}scrollIntoView/.test(page),
     '★★ 暖身完成後不自動捲到檢核（中間的模擬與虛擬碼才是課）');
  ok(/id="lab-locked"/.test(page), '   檢核在暖身完成前顯示鎖住的提示');
}


section('★ 尺標的字不可以被裁掉（老師 2026-08-24）');
{
  /* ⚠️ jsdom 沒有版面計算，量不到「有沒有被裁掉」——
     所以這裡盯的是**造成裁切的那兩個條件**：
       ① 舞台高度要夠（overflow:hidden 之下，太矮就一定裁）
       ② 字要在虛線的**上方**（bottom），不是下方（top）
     只修高度不夠：字仍然貼在線的下緣，加多少都可能再被擠出去。 */
  const css = read('shared/ultralab.js');
  const h = (css.match(/\.ul-stage\{[^']*height:(\d+)px/) || [])[1];
  ok(Number(h) >= 150, '★ 舞台至少 150px（現在 ' + h + 'px）');
  ok(/\.ul-ruler span\{[^']*bottom:\d+px/.test(css),
     '★★ 尺標的字定位在**線的上方**（bottom），不是下方');
  ok(!/\.ul-ruler span\{[^']*top:\d+px/.test(css), '   而且沒有殘留的 top');
  ok(/\.ul-ruler span\{[^']*white-space:nowrap/.test(css),
     '   字不換行（「35 公分」不可以斷成兩行再被裁）');

  /* 那個字真的要畫出來 —— 不是只有 CSS 對。 */
  const box = W.document.getElementById('a');
  U.mount(box, { mode: 'warmup', seed: '77' });
  ok(/ul-ruler[\s\S]*?<span>[^<]*公分<\/span>/.test(box.innerHTML),
     '★ 尺標上真的有「◯◯ 公分」這個字');
}


section('★ 聲音要畫成同心弧線，不是圓球（老師 2026-08-24）');
{
  /* ⚠️ 圓球傳達的是**錯的物理**：看起來像一顆飛出去的子彈，
     學生會以為感測器射出了一個東西 —— 那正好是節點① 要破除的誤解。
     ⇒ 同心弧線（HC-SR04 產品圖、Wi-Fi 圖示都是這個語彙）。 */
  const src = read('shared/ultralab.js');
  ok(!/ul-pulse/.test(src), '★★ 圓球（.ul-pulse）已經整個拿掉');
  const box = W.document.getElementById('a');
  U.mount(box, { mode: 'warmup', seed: '55' });
  const go = box.querySelectorAll('.ul-arc.go').length;
  const back = box.querySelectorAll('.ul-arc.back').length;
  ok(go >= 3 && back >= 3, '★ 去程與回程各有三道弧線（' + go + '／' + back + '）');
  ok(/\.ul-arc\.go\{[^']*border-right-color/.test(src) &&
     /\.ul-arc\.back\{[^']*border-left-color/.test(src),
     '★ 弧線用 border 只畫一邊（去程朝右、回程朝左）');
  ok(/\.ul-arc\.go\{[^']*#0891b2/.test(src) && /\.ul-arc\.back\{[^']*#f97316/.test(src),
     '★★ 去程與回程**不同顏色** —— 去回是同一個聲音，但回來那一趟才是節點② 要算的');

  /* 去程在前半段、回程在後半段：加起來才是「一去一回」。 */
  ok(/@keyframes ularc-back\{0%,48%\{opacity:0/.test(src),
     '★ 回程的動畫要等去程走完才開始（不是兩邊同時噴）');

  /* ⚠️ 這一段是理解的基礎，不可以「播一次就沒了」。 */
  ok(/\.ul-arc\.go\{[^']*infinite/.test(src), '★★ 動畫是 infinite —— 學生看漏了還有下一次');
  ok(/prefers-reduced-motion/.test(src), '   會暈的人放慢，不是直接關掉（那就看不到了）');
}


section('★★ A：題目要變，但問法與答案固定（老師 2026-08-24）');
{
  /* ⚠️ 這一關繞了一圈：
     ① 原版距離序列寫死、門檻預設 10／20，正解永遠 2 —— 學生連數字都不用看。
     ② 中間改成三種走法（開關 0／2／4 次），老師回報「有點怪，還是回到原來的問法」：
        「路過」那一組**不管怎麼設門檻都不該開**，設門檻這個任務就沒意義了；
        而且開關次數會變，**和前面教的觀念搞混**。
     ⇒ ③ 現在：問法回到「乾淨地開一次、關一次」（答案固定 2），
          但**人停在哪一段是隨機的** —— 門檻要讀那排數字才知道怎麼設。
        ★ A 真正要練的是遲滯（兩個門檻要拉開），這樣才對準它。 */
  let nul = 0, bad = 0, notFragile = 0, wrongAns = 0, zones = {};
  for (let i = 0; i < 300; i++) {
    const c = D.caseA(U.rngFrom('k' + i), null);
    if (!c) { nul++; continue; }
    zones[c.zone.join('-')] = 1;
    if (c.answer !== 2) wrongAns++;
    /* ① 存在一組合理門檻，做得出乾淨的一開一關 */
    const good = D.runDoor(c.seq, c.hintNear, c.hintFar);
    if (good.opens !== 1 || good.closes !== 1) bad++;
    /* ② ★★ 門檻設在晃動區中線附近**一定要抖** —— A 唯一教到「門檻要拉開」的地方 */
    const mid = Math.round((c.zone[0] + c.zone[1]) / 2);
    if (D.runDoor(c.seq, mid, mid + 1).opens <= 1) notFragile++;
  }
  ok(nul === 0, '★ 每一次都出得出題');
  ok(wrongAns === 0, '★★ 答案固定是「開關各一次 = 2」—— 不再變成 0 或 4（會和前面的觀念搞混）');
  ok(bad === 0, '★★ 每一題都存在一組門檻做得出乾淨的一開一關（沒有「怎麼設都過不了」的題目）');
  ok(notFragile === 0, '★★ 每一題「門檻靠太近真的會抖」—— 這是 A 的重點');
  ok(Object.keys(zones).length === D.ZONES.length,
     '★★ 人停的位置會換（' + Object.keys(zones).join('／') + '）—— 門檻沒得抄');

  /* ★★ 「10／20 是萬用解」這件事一定要被打破，不然等於沒隨機。 */
  let universal = 0, total = 0;
  for (let i = 0; i < 300; i++) {
    const c = D.caseA(U.rngFrom('u' + i), null);
    if (!c) continue;
    total++;
    const r = D.runDoor(c.seq, 10, 20);
    if (r.opens === 1 && r.closes === 1) universal++;
  }
  ok(universal < total * 0.75,
     '★★ 10／20 不是萬用解（' + universal + '／' + total + ' 才過）—— 學生非讀數字不可');

  /* 問法回到原來的，而且門檻不預填。 */
  const src = read('shared/doorlab.js');
  /* ⚠️ 「不可以出現 X」型的檢查一定要先剝註解 ——
     上面那段註解正好在解釋「不再用『只在該開的時候開』」，
     不剝的話它自己就把自己判紅了（這個專案第六次踩到）。 */
  const code = src
    .replace(/(^|[\s;{(=])\/\*[\s\S]*?\*\//gm, '$1')
    .replace(/^\s*\/\/.*$/gm, '');
  ok(/乾淨地開一次、關一次/.test(code), '★ 問法回到「乾淨地開一次、關一次」');
  ok(!/只在該開的時候開/.test(code), '   不再用含糊的「只在該開的時候開」');
  ok(/id="dl-near" placeholder="\?"/.test(src) && /id="dl-far" placeholder="\?"/.test(src),
     '★★ 門檻**不預填** —— 預填等於送分，學生連數字都不必看');
  ok(!/走進來，退出去|從門口前面走過去/.test(src),
     '★ 折返／路過那兩種走法已經拿掉（老師：會和前面的觀念搞混）');

  /* 三種錯的回饋要分得開 —— 講錯了學生會往錯的方向調。 */
  const c0 = D.caseA(U.rngFrom('fb'), null);
  ok(/抖了好幾次/.test(src) && /從頭到尾沒開/.test(src) && /開了卻沒關起來/.test(src),
     '★★ 抖／沒開／沒關三種錯的回饋分開講');
}

section('★★ B：三組情境（換情境比換數字有用）');
{
  /* ★ 三組**不同的東西**壞掉，但壞的是同一個原因：少了狀態。
     學生得自己認出「這又是那件事」—— 那正是「懂了」和「記住答案」的差別。
     ⚠️ 三組的正解一律是「加一個變數記住狀態」，那是概念，沒得換；
        擋傳答案的是後面「用自己的話說」那一段。 */
  ok(D.CASES_B.length === 3, '★ B 有三組不同的東西壞掉（' +
     D.CASES_B.map(c => c.thing).join('／') + '）');
  ok(D.CASES_B.every(c => c.fixes.filter(f => f.good).length === 1 &&
                          c.fixes.filter(f => f.good)[0].key === 'state'),
     '★★ 每一組的正解都是「加一個變數記住狀態」—— 那是概念，沒得換');
  ok(D.CASES_B.every(c => c.fixes.length === 3 &&
                          c.fixes.every(f => f.after && f.after.length > 10)),
     '★★ 每一組的三個選項都有「執行後會看到什麼」（猜錯的代價是眼見為憑）');
  /* ⚠️ 錯的選項要是**這一組的情境**，不可以三組共用「門又轉了一次」。 */
  ok(/燈/.test(D.CASES_B[1].fixes.map(f => f.after).join()) &&
     /蓋/.test(D.CASES_B[2].fixes.map(f => f.after).join()),
     '★ 錯的選項講的是那一組自己的東西（燈／蓋子），不是三組共用一句');
  {
    const rng = U.rngFrom('bb');
    let prev = null, seen = {};
    for (let i = 0; i < 30; i++) { prev = D.caseB(rng, prev); seen[prev.key] = 1; }
    ok(Object.keys(seen).length === 3, '   三組都會抽到');
    /* 換一組要真的換得掉（餵會重複的亂數） */
    const stub = (() => { const v = [0, 0, 0.5]; let i = 0; return () => v[i++ % v.length]; })();
    const p1 = D.caseB(stub, null), p2 = D.caseB(stub, p1);
    ok(p1.key !== p2.key, '★★ 亂數吐同一個值時也換得掉（' + p1.key + ' → ' + p2.key + '）');
  }
  /* ★★ 抄襲比對要用**抽到的那一組**：寫死第一組的話，
     抽到感應燈的人把「記住燈是亮的還是暗的」貼上去就過了。 */
  const light = D.CASES_B[1];
  ok(D.judgeSay(light.fixes[0].text, light).level === 'none',
     '★★ 抄感應燈那一組的正解 → 不過（抄襲比對跟著情境走）');
  ok(D.judgeSay(D.CASES_B[2].fixes[0].text, D.CASES_B[2]).level === 'none',
     '   抄垃圾桶那一組的正解 → 也不過');
}

section('★ B 的「用自己的話說」真的要有判定（老師 2026-08-24：「這個填充沒有功能吧?」）');
{
  /* ⚠️ 舊版的 #dl-say 從頭到尾沒有人讀它、沒有存檔、每次重畫就清空，
     placeholder 卻寫著「老師會看」—— 那句話是假的。 */
  /* ⚠️ 2026-08-24：引擎搬到 shared/labkit.js（老師：「之後的單元都使用單元一的架構」）。
     ★ 這些條目盯的是「**系統裡**有這個保護」，不是「這個檔案裡有」——
        所以兩支一起讀。
     ⚠️ 不可以因為搬家就把條件放寬：搬過去的每一條，
        在 labkit 裡被改壞一樣要變紅（下面的突變測試驗過）。 */
  const src = read('shared/labkit.js') + '\n' + read('shared/doorlab.js');
  ok(!/老師會看，不會自動評分/.test(src),
     '★★ 不再宣稱「老師會看，不會自動評分」（那是假的：沒判也沒存）');
  ok(/global\.ANSWER && global\.ANSWER\.judge/.test(src),
     '★ 判定走 shared/answer.js —— 不在這裡另寫一套關鍵字規則');
  /* ★ 而且各單元不可以自己再寫一套 —— 那樣「一直重複算不算命中」會有好幾個答案。 */
  ok(!/global\.ANSWER/.test(read('shared/doorlab.js')),
     '★★ doorlab 自己不碰 ANSWER，一律經過 labkit（免得長出第二套規則）');

  /* 講到任一個概念就算過（full: 1）。
     ⚠️ 兩個都要的話會出現「他明明講懂了、系統說他沒懂」，
        那是最傷的一種誤判。 */
  ok(D.SAY.full === 1, '★★ 講到**任一個**概念就算過（寧可放過，不可錯殺）');
  ok(D.judgeSay('因為程式不知道自己已經開過門了').level !== 'none',
     '   「不知道自己已經開過了」→ 過');
  ok(D.judgeSay('要記住門是開的還是關的').level !== 'none', '   「記住狀態」→ 過');
  ok(D.judgeSay('不然它會一直轉個不停').level !== 'none',
     '★ 「一直轉個不停」→ 也過（講的是後果，一樣是懂了）');
  ok(D.judgeSay('').level === 'none', '   空白 → 不過');
  ok(D.judgeSay('我覺得就是這樣啊').level === 'none', '   空話 → 不過');
  /* ★★ 抄來的不算。⚠️ 選項的文字裡本來就含有這一題想聽到的說法 ——
     不擋的話「複製正確選項 → 貼上 → 過關」，這一段就白做了。 */
  ok(D.judgeSay(D.FIXES[0].text).level === 'none',
     '★★ 把正確選項複製貼上 → 不過（不然這一段等於白做）');
  ok(D.judgeSay('為什麼要記住門開了沒').level === 'none', '   把題目倒著抄 → 不過');
  ok(D.judgeSay(D.FIXES[0].after).level === 'none', '   把「執行結果」抄過來 → 也不過');
  /* ⚠️ 提示裡不可以出現正解 —— 講了學生貼上去就過了。 */
  const flow = src.slice(src.indexOf('function doSay'), src.indexOf('function passB'));
  ok(!/記住|狀態/.test((flow.match(/viewB\('⚠️[^']*'/) || [''])[0]),
     '★★ 沒過的提示裡不出現「記住／狀態」這些正解字眼');

  /* ★★ 這一條是整段的重點：選對**不等於**完成。 */
  ok(/bPicked = true;[\s\S]{0,200}最後一步/.test(src),
     '★★ 三選一選對之後 B 還沒完成 —— 還要說得出為什麼');
  ok(!/if \(f && f\.good\) \{\s*done\.B = true/.test(src),
     '   選對不再直接 done.B（那樣「能解釋」就沒地方測了）');

  /* 打的字不可以因為重畫就不見 */
  ok(/var bPicked = false, sayText = ''/.test(src) && /esc\(o\.text \|\| ''\)/.test(src),
     '★ 作答留在變數裡並回填 —— 重畫（提示、覆核）不會清空');
  ok(/addEventListener\('input'/.test(src), '   打字時就記起來');

  /* AI 覆核只加分 */
  ok(/if \(res\.level !== 'none'\) return noAI;/.test(src),
     '★★ 規則已經判過的不送覆核 —— 覆核只能加分，加不上去了');
  ok(/\.catch\(function \(\) \{ return res; \}\)/.test(src),
     '★★ 覆核失敗＝沒撿回來，不是扣分');
  ok(/ASKAI\.enabled\(\)/.test(src), '   KEY 沒填時整塊不啟用（askai 自己判斷）');
  ok(/\.length < \(spec\.min \|\| 8\) && !\(res\.got \|\| \[\]\)\.length/.test(src),
     '★ 太短**而且**什麼都沒沾到的不送（額度全班共用）');
}

section('★★ 答錯要換一題（重猜同一題只證明他記得剛才選什麼）');
{
  const box = W.document.getElementById('b');

  /* A：猜錯次數 → 下一次應該是**另一種走法** */
  {
    const d = D.mount(box, { seed: 'aa' });
    const before = d.aCase().zone.join('-');
    box.querySelector('#dl-near').value = d.aCase().hintNear;
    box.querySelector('#dl-far').value = d.aCase().hintFar;
    /* 故意填一個一定錯的數字 */
    box.querySelector('#dl-pred').value = d.aCase().answer + 1;
    box.querySelector('#dl-runA').dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(d.step() === 'A', '   猜錯了還留在 A');
    ok(d.aCase().zone.join('-') !== before,
       '★★ A 猜錯 → 換一段（' + before + ' → ' + d.aCase().zone.join('-') + '）');
  }

  /* ★★ B：**修法選對、但預測錯** → 一樣不過。
     ⚠️ 這一條是「先講你認為會怎樣」在 B 的整個意義所在：
        少了它，三選一兩次內必中（選一個 → 看結果 → 錯了再選下一個）。
        A 有這一步（先猜開關幾次）、C 有（第二輪先寫下秒數），
        2026-08-24 之前只有 B 沒有。 */
  {
    const d = D.mount(box, { seed: 'cc' });
    box.querySelector('#dl-near').value = d.aCase().hintNear;
    box.querySelector('#dl-far').value = d.aCase().hintFar;
    box.querySelector('#dl-pred').value = d.aCase().answer;
    box.querySelector('#dl-runA').dispatchEvent(new W.Event('click', { bubbles: true }));
    const before = d.bCase().key;
    box.querySelector('[data-fix="state"]').dispatchEvent(new W.Event('click', { bubbles: true }));
    /* 挑一個**不是**自己選的那個修法的結果 */
    const wrongPred = d.bCase().fixes.filter(f => !f.good)[0].key;
    box.querySelector('[data-pred="' + wrongPred + '"]')
       .dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(!box.querySelector('#dl-say'),
       '★★ 修法選對但**預測錯** → 不給寫，這一關還沒過');
    ok(d.step() === 'B', '   還留在 B');
    ok(d.bCase().key !== before, '   而且換一個東西壞掉（' + before + ' → ' + d.bCase().key + '）');
    ok(/先想清楚再按/.test(box.textContent),
       '★ 回饋要點破「你猜的不是這個」，而不是只說答錯');
  }

  /* B：選錯 → 換一個東西壞掉 */
  {
    const d = D.mount(box, { seed: 'bb' });
    box.querySelector('#dl-near').value = d.aCase().hintNear;
    box.querySelector('#dl-far').value = d.aCase().hintFar;
    box.querySelector('#dl-pred').value = d.aCase().answer;
    box.querySelector('#dl-runA').dispatchEvent(new W.Event('click', { bubbles: true }));
    const before = d.bCase().key;
    const wrong = d.bCase().fixes.filter(f => !f.good)[0].key;
    box.querySelector('[data-fix="' + wrong + '"]')
       .dispatchEvent(new W.Event('click', { bubbles: true }));
    /* ★★ 這裡**還沒執行** —— 先問「你認為會發生什麼」（老師 2026-08-24）。 */
    ok(d.bCase().key === before, '★★ 選了之後還沒換題 —— 因為還沒執行');
    ok(!!box.querySelector('[data-pred]'), '★★ 先出現「執行之後會看到什麼」的預測題');
    box.querySelector('[data-pred="' + wrong + '"]')
       .dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(d.step() === 'B', '   選錯了還留在 B');
    ok(d.bCase().key !== before,
       '★★ 預測完才執行、然後換一個東西壞掉（' + before + ' → ' + d.bCase().key + '）');
    ok(/執行結果/.test(box.textContent),
       '   而且先把「選錯會看到什麼」跑給他看，再換題');
  }
}

section('★ B 的兩階段真的掛得起來');
{
  const box = W.document.getElementById('b');
  let said = null;
  const d = D.mount(box, { seed: '1234', onSay: function (t, r) { said = { t: t, r: r }; } });
  box.querySelector('#dl-runA');            // A 還在最前面
  /* 直接跳到 B：先把 A 做完。
     ⚠️ 正解不再是寫死的 2 —— 走法是抽的，答案是 0／2／4。
        測試自己去問這一次抽到什麼（api.aCase()），不可以猜。 */
  box.querySelector('#dl-near').value = d.aCase().hintNear;
  box.querySelector('#dl-far').value = d.aCase().hintFar;
  box.querySelector('#dl-pred').value = d.aCase().answer;
  box.querySelector('#dl-runA').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(d.step() === 'B', 'A 過了進到 B（走法：' + d.aCase().key + '）');

  box.querySelector('[data-fix="state"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(!box.querySelector('#dl-say'), '★★ 選對了**還不能寫** —— 中間還有「先講會發生什麼」');
  ok(box.querySelectorAll('[data-pred]').length === 3, '   預測題有三個候選結果');
  box.querySelector('[data-pred="state"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(d.step() === 'B', '★★ 修法對＋預測對，**還在 B** —— 因為還沒說');
  ok(!!box.querySelector('#dl-say') && !!box.querySelector('#dl-runB'),
     '   這時候才出現作答框與送出鈕');
  ok(!box.querySelector('[data-fix]'), '   選過就不再讓他改選（任務換成「說出來」了）');

  const ta = box.querySelector('#dl-say');
  ta.value = '因為程式要記住門已經開過了';
  box.querySelector('#dl-runB').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(d.step() === 'C', '★ 說得出來 → B 完成，進到 C');
  ok(said && /記住門已經開過/.test(said.t), '★★ onSay 把**原文**交出去（老師要看的是他的說法）');
}

section('★★ 共用骨架（老師 2026-08-24：「之後的單元都使用單元一的架構」）');
{
  const kit  = read('shared/labkit.js');
  const door = read('shared/doorlab.js');
  const page = read('11501/5016b.html');

  /* 載入順序：doorlab 一開場就會去拿 LABKIT。 */
  ok(page.indexOf('shared/labkit.js') > 0 &&
     page.indexOf('shared/labkit.js') < page.indexOf('shared/doorlab.js'),
     '★ 頁面載入 labkit，而且排在 doorlab 之前');

  /* ★★ 相依方向只能是單向：各單元 → labkit。
     ⚠️ 反過來的話（labkit 去讀 DOORLAB 的東西），第二節就搬不動了 ——
        而那正是抽這一支出來的目的。 */
  ok(!/DOORLAB|CASES_B|WALKS/.test(kit),
     '★★ labkit 完全不知道 doorlab 的存在（相依只能單向）');

  /* 各單元不可以自己再接一次 ANSWER／ASKAI —— 那樣規矩會長出第二套。 */
  ok(!/global\.ASKAI/.test(door),
     '★★ doorlab 自己不碰 ASKAI，一律經過 labkit');

  /* ⚠️ labkit 沒載到要**明確報錯**。
     靜默半殘的症狀是「按了沒反應」，那比錯誤訊息難查十倍。 */
  {
    const dom = new JSDOM('<!DOCTYPE html><body><div id="x"></div></body>');
    const w2 = dom.window;
    const savedD = global.document, savedW = global.window;
    global.document = w2.document; global.window = w2;
    new Function('window', read('shared/doorlab.js'))(w2);
    let err = '';
    try { w2.DOORLAB.mount(w2.document.getElementById('x'), {}); }
    catch (e) { err = e.message; }
    global.document = savedD; global.window = savedW;
    ok(/labkit\.js/.test(err),
       '★★ 沒載入 labkit 時直接說清楚（實得：' + (err || '（完全沒報錯）') + '）');
  }

  /* ★ 共用模組裡不可以有沒人用的東西 —— 下一個人會以為它被測過。
     ⚠️ 2026-08-24 就發生過：pick() 抽出來了卻沒接上，
        把它改壞測試照樣綠。 */
  {
    /* ⚠️ 不可以用「行首四個空白」去抓名字 —— 那樣把兩個寫在同一行就躲掉了
       （突變測試當場抓到）。改成把整個匯出區塊切出來再找。 */
    const block = kit.slice(kit.indexOf('global.LABKIT = {'),
                            kit.indexOf('};', kit.indexOf('global.LABKIT = {')));
    const exported = [...block.matchAll(/(\w+)\s*:/g)].map(m => m[1])
      .filter(n => n !== 'VERSION' && n !== 'CSS');
    /* ⚠️⚠️ 第一版只掃 doorlab —— 那時候 labkit 只有第一節在用。
       現在四個單元都靠它（旋鈕是第三、四節共用的），
       再用「doorlab 有沒有用到」當標準就是**釘錯範圍**：
       明明有人在用，測試卻說它是死的。
       ⇒ 掃**所有**用得到 labkit 的單元。
       ⚠️ 而且常數（DIAL_SWEEP）不會被 `(` 呼叫，不可以只找函式呼叫。 */
    /* ⚠️⚠️ 這份名單**每加一個單元就要補一次** —— 2026-08-25 一天之內漏了兩次
       （第一次漏 rgblab 那組，第二次漏 mixlab／planlab／projlab）。
       ★ 症狀是「明明有人在用，測試卻說它是死的」。
       ⇒ 不要用寫死的名單，直接掃 shared/ 底下所有 *lab.js。 */
    const users = fs.readdirSync(path.join(root, 'shared'))
      .filter(f => /lab\.js$/.test(f) && f !== 'labkit.js')
      .map(f => f.replace(/\.js$/, ''))
      .map(f => read('shared/' + f + '.js')).join('\n');
    const dead = exported.filter(n => !new RegExp('LK\\(\\)\\.' + n + '\\b').test(users));
    ok(dead.length === 0,
       '★★ labkit 匯出的每一支都真的有人用' +
       (dead.length ? '（沒人用：' + dead.join('、') + '）' : ''));
  }
}

section('★ 完成要有紀錄（老師 2026-08-24：「每次都要重玩? 要有記錄」）');
{
  const page = read('11501/5016b.html');
  /* 剝掉註解再驗「不可以出現 X」型的條件 ——
     ⚠️ 這個專案已經有五次是註解裡剛好講到 X，害檢查自傷。 */
  const c = page
    .replace(/(^|[\s;{(=])\/\*[\s\S]*?\*\//gm, '$1')
    .replace(/^\s*\/\/.*$/gm, '')       /* ⚠️ 行註解也要剝：不剝的話「把那一行註解掉」這種
                                            突變會穿過去（2026-08-24 突變測試當場抓到）。
                                            只剝**整行**以 // 開頭的 —— 行內的 https:// 不能碰。 */
    .replace(/<!--[\s\S]*?-->/g, '');

  ok(/<script src="config\.js"><\/script>/.test(c),
     '★ 這一頁載入 config.js —— 本來只有 guard.js（知道你是誰，卻寫不了東西）');
  ok(c.indexOf('src="config.js"') < c.indexOf('shared/semester.js'),
     '   而且排在 semester／guard 之前（那兩支要讀 CONFIG.TERM）');
  ok(/window\.LABSAVE/.test(c), '   有 LABSAVE');

  /* ⚠️⚠️ 最危險的一條：這一頁不計星。
     寫進 stars 的話 hub 的整體進度會超過 100%（分子加了、分母沒加）。 */
  ok(!/stars/.test(c.slice(c.indexOf('window.LABSAVE'), c.indexOf('</script>', c.indexOf('window.LABSAVE')))),
     '★★ LABSAVE 完全不碰 stars —— arduino 卡的 maxStars 是 0，寫了星進度就爆表');
  ok(!/REPORT\.(unit|pass)\(/.test(c), '★★ 不走 REPORT.unit()／pass()（那兩支會自己算星）');
  ok(/modules: \{ arduino: \{/.test(c), '   寫在 modules.arduino 底下');
  ok(/\{ merge: true \}/.test(c), '★ 用 merge 寫入 —— 不可以蓋掉學生其他科目的資料');

  /* 教室是共用電腦：關掉瀏覽器就該消失（和全站身分規則一致）。 */
  ok(!/localStorage/.test(c), '★★ 退路用 sessionStorage，不是 localStorage（共用電腦）');
  ok(/sessionStorage\.setItem\(localKey/.test(c), '   斷網／規則沒發布時，本機至少記得住');

  /* 重點：做完的人回來不必重玩。 */
  ok(/if \(rec\.warm\)[\s\S]{0,300}openChecks\(rec\)/.test(c),
     '★★ 暖身已通過 → 檢核直接是開的（鑰匙拿過就不必再拿一次）');
  ok(/doneCard\(wrap, rec\.warm\.at/.test(c), '   暖身顯示「已完成」卡，不是第一題');
  ok(/doneCard\(checks, rec\.checks\.at/.test(c), '   三個檢核也一樣');
  ok(/再玩一次/.test(c), '★ 但要留一個「再玩一次」（想練的人可以練）');
  ok(/if \(!\(rec && rec\.warm\)\) save\.save\(UNIT, 'warm'/.test(c) &&
     /if \(!\(rec && rec\.checks\)\) save\.save\(UNIT, 'checks'/.test(c),
     '★★ 重做**不覆寫**紀錄 —— 老師要看的是第一次做完是什麼時候');

  /* ⚠️ 順序：先讀完再畫。反過來的話已完成的學生會先看到第一題。 */
  ok(/save\.load\(UNIT\)\.then/.test(c) && /讀取上次的紀錄/.test(c),
     '★ 讀取期間先顯示「讀取上次的紀錄…」，不先掛互動');
  ok(!/ULTRALAB\.mount\([^)]*\)[\s\S]{0,80}save\.load/.test(c),
     '   不是「先掛互動、讀完再換掉」');

  /* 沒有 LABSAVE（例如 Firebase CDN 被擋）時整頁不可以死掉。 */
  ok(/window\.LABSAVE \|\| \{ load: \(\) => Promise\.resolve\(\{\}\)/.test(c),
     '★ LABSAVE 起不來時退成空實作 —— 課照上，只是沒紀錄');
}

/* ── ★★ AI 覆核那一段，真的跑一次 ─────────────────────────
   ⚠️ 前面那些條目都是**讀原始碼**判斷的（正則比對）——
      它們擋得住「有人把那段刪掉」，擋不住「那段其實跑不起來」。
      2026-08-24 就在同一個檔案裡踩過：改 doB 時把 doSay 一起刪掉，
      而所有讀原始碼的斷言照樣全綠。
   ⇒ 這一段用**假的 ASKAI** 把整條路徑真的走一遍。 */
function aiCase(name, fake, text, expect) {
  W.ASKAI = fake;
  const local = D.judgeSay(text, D.CASES_B[0]);
  return D.reviewSay(text, local, { student: '1410905' }, D.CASES_B[0])
    .then(r => { ok((r.level !== 'none') === expect, name + '（實得：' + r.level + '）'); });
}
const calls = [];
const fakeOK = {
  enabled: () => true,
  judge: (unit, items, student) => {
    calls.push({ unit, items, student });
    return Promise.resolve([{ i: 0, got: ['不記住就會重複做同一件事'] }]);
  }
};

section('★★ AI 覆核：整條路徑真的走一遍');
Promise.resolve()
  /* ① 本機判不過、AI 說「他其實講到了」→ 撿回來 */
  .then(() => aiCase('★★ 本機沒撿到、AI 撿到了 → 過', fakeOK, '它會做很多很多次一樣的事情', true))
  .then(() => {
    ok(calls.length === 1, '   而且真的送出去了一次');
    ok(calls[0].unit === '5016b-u1-B', '   帶著單元代號（額度分帳用）');
    ok(calls[0].student === '1410905', '   帶著學號（每人每天有自己的上限）');
    ok(/門開了沒/.test(calls[0].items[0].q), '★ 題目跟著抽到的情境走');
  })
  /* ⚠️ 截斷要用**真的很長**的作答去測 —— 拿短句測的話，
     把 slice 整個拿掉也照樣綠（2026-08-24 突變測試當場抓到）。 */
  .then(() => {
    calls.length = 0;
    /* ⚠️ 這一段刻意**本機判不過**（沒有沾到任何概念）——
       挑到會過的句子，reviewSay 會提早返回，根本不會送出去。 */
    const long = '這個東西就是這樣子的啦'.repeat(55);   // 605 字
    return D.reviewSay(long, D.judgeSay(long, D.CASES_B[0]), {}, D.CASES_B[0])
      .then(() => {
        ok(calls.length === 1, '   （前提：這一則有送出去）');
        ok(calls[0].items[0].a.length === 400,
           '★ 作答截斷到 400 字（實得 ' + calls[0].items[0].a.length +
           '）—— 不要拿整篇去燒 token');
      });
  })
  /* ② ★★ 本機已經判過的，不可以再送 —— 覆核只能加分，加不上去了 */
  .then(() => {
    calls.length = 0;
    const good = '因為程式要記住它已經開過門了';
    const local = D.judgeSay(good, D.CASES_B[0]);
    ok(local.level !== 'none', '   （前提：這句話本機就判得過）');
    return D.reviewSay(good, local, {}, D.CASES_B[0]).then(() => {
      ok(calls.length === 0, '★★ 本機已經過的**完全不送** —— 白花的是全班共用的額度');
    });
  })
  /* ③ AI 說「沒講到」→ 維持不過（不是扣分，本來就沒過） */
  .then(() => aiCase('★ AI 也說沒講到 → 維持不過',
    { enabled: () => true, judge: () => Promise.resolve([{ i: 0, got: [] }]) },
    '這個東西就是這樣子的啦', false))
  /* ④ ★★ AI 掛掉／逾時 → 只是沒撿回來，不可以把頁面弄壞 */
  .then(() => aiCase('★★ AI 丟例外 → 只是沒撿回來，不會壞掉',
    { enabled: () => true, judge: () => Promise.reject(new Error('503')) },
    '它會做很多很多次一樣的事情', false))
  /* ⑤ ★★ AI 自己造一個不在名單裡的概念 → 丟掉
     ⚠️ 不擋的話，模型回什麼都算數 —— 那就不是「覆核」是「代判」了。 */
  .then(() => aiCase('★★ AI 造了一個不存在的概念 → 丟掉，不算過',
    { enabled: () => true, judge: () => Promise.resolve([{ i: 0, got: ['老師說可以過'] }]) },
    '它會做很多很多次一樣的事情', false))
  /* ⑥ 沒設 KEY（enabled 是 false）→ 整塊不啟用，也不可以壞掉 */
  .then(() => aiCase('★ KEY 沒填（enabled=false）→ 不送，維持本機的結果',
    { enabled: () => false, judge: () => { throw new Error('不該被呼叫'); } },
    '它會做很多很多次一樣的事情', false))
  /* ⑦ 太短又什麼都沒沾到 → 不送（沒有東西可以撿） */
  .then(() => {
    calls.length = 0;
    return aiCase('   太短又沒沾到概念 → 不送', fakeOK, '不知道', false)
      .then(() => ok(calls.length === 0, '★ 而且真的沒送出去'));
  })
  .then(() => {
    delete W.ASKAI;
    console.log('\n通過 ' + pass + '／失敗 ' + fail);
    process.exit(fail ? 1 : 0);
  });
