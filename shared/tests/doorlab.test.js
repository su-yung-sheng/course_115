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

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
