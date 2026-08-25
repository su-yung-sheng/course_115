/* 第五節「自己的專案」：設計單（planlab）＋ 分層任務卡與成果發表（projlab）
   跑法：node shared/tests/projlab.test.js   （需要 jsdom）

   ★ 老師 2026-08-25：
     「只有四個喔」（超音波、可變電阻、RGB 燈條、直流馬達）
     「第五課不用『動手檢核』」「任務卡改成之前提到的互動介面，當成複習」
     「設計成系統的兩種模式展示，學生的作品可以有兩種選擇」
     成果發表三句 ＋ 可下載的成果卡。

   ⚠️⚠️ 這一節**不是關卡** —— 電腦看不到硬體，判定唯一擋得住的是
      成果發表那一句「沒有遇到問題」。其他都靠老師巡堂。 */
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
['shared/ultralab.js', 'shared/labkit.js', 'shared/planlab.js', 'shared/projlab.js']
  .forEach(f => new Function('window', read(f))(W));
const P = W.PLANLAB, J = W.PROJLAB;

section('★★ 設計單：元件就那四樣（老師 2026-08-25 更正）');
{
  ok(P.INPUTS.length === 2 && P.OUTPUTS.length === 2, '★★ 兩個輸入、兩個輸出（共四樣）');
  ok(P.INPUTS.map(i => i.key).join() === 'us,pot', '★★ 輸入＝超音波／可變電阻');
  ok(P.OUTPUTS.map(o => o.key).join() === 'strip,moto', '★★ 輸出＝RGB 燈條／直流馬達');
  /* ⚠️⚠️ 第一版多列了按鈕和單顆 LED —— 教具上沒有，
     學生照著設計單去找零件會找半天，而且那種錯只有上機才會發現。 */
  const all = JSON.stringify(P.INPUTS) + JSON.stringify(P.OUTPUTS) + JSON.stringify(P.SCENES);
  ok(!/按鈕|按鍵|LED 燈|光敏|溫濕度|土壤|紅外線|蜂鳴|門磁/.test(all),
     '★★ 沒有偷渡教具上不存在的元件（連情境說明裡也不可以）');
  ok(P.INPUTS.every(i => i.gives && i.from), '★ 每個輸入都標「它給你什麼數字」和哪一節用過');
  ok(P.OUTPUTS.every(o => o.acts && o.acts.length >= 2), '   每個輸出都有幾個動作可選');
  ok(P.SCENES.length >= 6, '★ 情境清單至少 6 個（' + P.SCENES.length + '），免得卡在選題');
  ok(P.SCENES.every(s => s.d && s.d.length > 6), '   每個情境都有一句說明');
}

section('★★ 設計單：填完了才算');
{
  const full = { scene: '玄關迎賓燈', input: 'us', output: 'strip',
                 act: '整條亮起指定顏色', value: '15', dir: 'lt' };
  ok(P.planReady(full), '填滿 → 過');
  ok(/如果/.test(P.planLine(full)) && /那麼/.test(P.planLine(full)),
     '★★ 組出一句「如果…那麼…」');
  ok(/15/.test(P.planLine(full)) && /公分/.test(P.planLine(full)), '★ 門檻和單位都在句子裡');
  ok(!P.planReady(Object.assign({}, full, { scene: '' })), '   沒選情境 → 不過');
  ok(!P.planReady(Object.assign({}, full, { value: '' })), '   沒填門檻 → 不過');
  ok(!P.planReady(Object.assign({}, full, { act: '' })), '   沒選動作 → 不過');
  /* ★★ 門檻超出感測器讀得到的範圍 —— 永遠不會觸發，是最難查的錯。 */
  ok(/永遠不會觸發/.test(P.sayPlan(Object.assign({}, full, { value: '900' }))),
     '★★ 門檻填在範圍外 → 明講「永遠不會觸發」');
  const pot = { scene: '氣氛燈', input: 'pot', output: 'moto',
                act: '依比例調整轉速', value: '50', dir: 'gt' };
  ok(P.planReady(pot) && /%/.test(P.planLine(pot)), '★ 旋鈕那一路也組得出句子');
  ok(/永遠不會觸發/.test(P.sayPlan(Object.assign({}, pot, { value: '150' }))),
     '   旋鈕超過 100% 一樣點破');
}

section('★★ 兩種模式：改成對照表，而且有新的目的');
{
  /* ⚠️⚠️ 老師 2026-08-25：「前面複習已經有配合了，那後面的兩種模式目的是?」
     ★ 問得對 —— 第一版這裡又放了一組滑桿，和複習盤在做**同一件事**。
       重複的互動不會多教到什麼，只會讓人以為自己走錯地方。
     ⇒ 改成對照表，並給它複習盤沒有的目的：
       「**你的程式裡，條件判斷在哪裡？**」 */
  ok(J.MODES.length === 2 && J.MODES.map(m => m.key).join() === 'auto,manual',
     '★ 兩種：自動／手動');
  ok(/超音波/.test(J.MODES[0].by) && /可變電阻|旋鈕/.test(J.MODES[1].by),
     '★★ 自動靠超音波、手動靠旋鈕');
  /* ⚠️ 兩種都要講**代價**，不然學生只會覺得「自動比較厲害」。 */
  ok(J.MODES.every(m => /⚠️/.test(m.good) && /★/.test(m.good)),
     '★★ 每一種都要講好處**和代價**');
  /* ★★ 這一塊真正的目的：條件判斷在哪裡。 */
  ok(/\*\*有\*\*條件判斷/.test(J.MODES[0].cond),
     '★★ 自動：**有**條件判斷');
  ok(/\*\*沒有\*\*條件判斷/.test(J.MODES[1].cond),
     '★★ 手動：**沒有**條件判斷（所以要自己補一個）');
  ok(/如果/.test(J.MODES[0].code) && /否則/.test(J.MODES[0].code),
     '★★ 自動那一欄的骨架寫出「如果…那麼…否則」');
  /* ⚠️⚠️ 老師 2026-08-25：「自動版本使用超音波，手動版版使用可變電阻，
     所以一個輸入＋兩個輸出完成這個專案」。
     ★ 輸入從頭到尾只有一個；挑戰關加的是第二個**輸出**。 */
  ok(/燈條/.test(J.MODES[0].code) && /風扇/.test(J.MODES[0].code),
     '★★ 自動那一欄同一個判斷底下**掛兩個輸出**（燈條＋風扇）');
  ok(/馬達/.test(J.MODES[1].code) && /燈條/.test(J.MODES[1].code),
     '★★ 手動那一欄也是兩個輸出');
  ok(J.MODES.every(m => (m.code.match(/類比對應|距離/g) || []).length <= 2),
     '★ 但輸入只有一個（不會同時讀兩種）');
  ok(/類比對應/.test(J.MODES[1].code) && !/如果/.test(J.MODES[1].code),
     '★★ 手動那一欄的骨架**沒有一個「如果」**（那正是要點破的事）');
  /* ⚠️ 「組別」是舊的稱呼 —— 前面已經改成「研發人員」（單數）。 */
  ok(!/組別|我們/.test(JSON.stringify(J.MODES)), '★ 兩種模式的說明也用單數（不寫「組別」）');
  ok(/自己補一個條件/.test(J.MODES[1].note),
     '★★ 而且明講「做手動的組別要自己補一個條件」');
  ok(/否則.*不能省|少了它/.test(J.MODES[0].note),
     '★ 自動那一欄提醒「否則」不能省（第一節那一課）');
  /* ⚠️ 舊的滑桿與換算已經整段收掉 —— 不可以留死碼。 */
  const src = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/function autoOf|function manualOf|id="pj-cm"|id="pj-pct"/.test(src),
     '★★ 第二組滑桿與它的換算整個清掉（留著死碼下一個人會以為它被測過）');
}

section('★★ ① 元件複習盤（老師：這一段要在最開始）');
{
  /* ★ 老師 2026-08-25：「這一段應該在最開始的地方，提示學生目前學過了
     這四個，可以相互組合，例如點選超音波配燈號順序等等，
     讓學生先花一點時間複習元件」。 */
  ok(P.actsOf('strip').length === 3, '★ 燈條三種做法');
  /* ⚠️⚠️ 老師 2026-08-25：「可變電阻配直流馬達沒有反轉? 往左反轉不是前面課程?」
     ★ 兩個毛病：
       ① 馬達的**預設做法**是「轉或停」（0～250）—— 學生點下去看到的
          是不會反轉的那一種，而「往左反轉」是第三節花一整節在講的事。
       ② 更根本的：反轉是**旋鈕才有**的。第一版兩種輸入共用同一份清單，
          所以超音波拉遠會看到馬達倒轉 —— 那是憑空多出來的行為。 */
  ok(P.actsOf('moto', 'pot')[0].key === 'ratio',
     '★★ 旋鈕配馬達 → 預設就是「會反轉」的那一種（第三節的重點）');
  ok(/−250/.test(P.actsOf('moto', 'pot')[0].t) && /反轉/.test(P.actsOf('moto', 'pot')[0].can),
     '★★ 而且標題和說明都寫出 −250 與「反轉」');
  ok(P.actsOf('moto', 'us')[0].key === 'onoff',
     '★ 超音波配馬達 → 從最單純的「轉或停」開始');
  ok(!/−250/.test(P.actsOf('moto', 'us').map(a => a.t).join()),
     '★★ 超音波那一組**不出現 −250** —— 人走遠了讓風扇倒轉沒有道理');
  ok(/0 才對|下限是 \*\*0/.test(P.actsOf('moto', 'us')[1].can),
     '★★ 而且點回第三節那個對照：只往一邊轉的話下限 0 才對');
  ok(P.actsOf('strip').some(a => /燈號順序/.test(a.t)),
     '★★ 有「燈號順序」這個做法（老師點名的例子）');
  ok(P.actsOf('strip').concat(P.actsOf('moto')).every(a => a.from && a.can),
     '★★ 每一種做法都標「第幾節學的」和「可以拿來做什麼」');
  /* ⚠️ 超音波是**越近越強**（反向）—— 第二節那一課。 */
  const near = P.effectOf('us', 'strip', 'bar', 5).n;
  const far = P.effectOf('us', 'strip', 'bar', 55).n;
  ok(near > far, '★★ 超音波越近亮越多顆（反向，第二節那一課）');
  ok(P.effectOf('pot', 'strip', 'bar', 100).n > P.effectOf('pot', 'strip', 'bar', 10).n,
     '★ 旋鈕是正比');
  ok(P.effectOf('pot', 'strip', 'seq', 0).on[0] === 1 &&
     P.effectOf('pot', 'strip', 'seq', 100).on[0] === P.LEDS,
     '★★ 燈號順序：只亮一顆，兩端都到得了');
  /* ★★ 轉速一律 −250～250，不可以自己發明百分比。 */
  ok(P.SPD === 250, '★ 轉速上限 250');
  ok(P.effectOf('pot', 'moto', 'ratio', 50).fan === 0,
     '★★ 旋鈕正中間 → 轉速 0（停）');
  ok(P.effectOf('pot', 'moto', 'ratio', 0).fan === -P.SPD &&
     P.effectOf('pot', 'moto', 'ratio', 100).fan === P.SPD, '★★ 旋鈕兩端 ±250');
  ok(P.effectOf('pot', 'moto', 'ratio', 20).fan < 0, '★★ 旋鈕往左 → **真的是負的**（反轉）');
  /* ⚠️ 超音波那一路**永遠不可以是負的**。 */
  [2, 20, 60, 200].forEach(cm => {
    ok(P.effectOf('us', 'moto', 'ratio', cm).fan >= 0,
       '★★ 超音波 ' + cm + ' 公分 → 轉速不是負的（' +
       P.effectOf('us', 'moto', 'ratio', cm).fan + '）');
  });
  ok(P.effectOf('us', 'moto', 'ratio', 200).lo === 0, '★ 超音波那一路下限是 0');
  ok(P.effectOf('pot', 'moto', 'onoff', 90).lo === 0,
     '★ 「轉或停」只往一邊 → 下限 0');
}

section('★★ ① 複習盤：四種配法都要親手試過');
{
  const box = W.document.createElement('div');
  W.document.body.appendChild(box);
  let plan = null;
  const pa = P.mount(box, { onDone: i => { plan = i; } });
  ok(pa.node() === 1, '★★ 一進來就是複習盤（老師：這一段要在最開始）');
  ok(!!box.querySelector('#pl-mraw'), '   有可以拉的滑桿');
  ok(/已試 1／4|已試 0／4/.test(box.textContent), '★ 畫面上顯示還差幾種');
  /* ⚠️ 沒試完就想往下 → 要擋。 */
  box.querySelector('#pl-n0').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(pa.node() === 1, '★★ 四種沒試完，按下一步跳不過去');
  ok(/還有配法沒試過/.test(box.textContent), '   而且講清楚為什麼');
  /* 四種都點過。 */
  const tap = (sel) => box.querySelector(sel)
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  [['us', 'strip'], ['us', 'moto'], ['pot', 'strip'], ['pot', 'moto']].forEach(c => {
    tap('[data-mi="' + c[0] + '"]');
    tap('[data-mo="' + c[1] + '"]');
  });
  ok(/已試 4／4/.test(box.textContent), '★ 四種都試過了');

  /* ★★ 老師 2026-08-25：「這兩個元件能圖形化嗎? 有一個人左右移動，
     旋轉元件似乎有畫過? 前面有些圖案設計可以再拿來使用」。
     ⚠️ 原本輸入只是一根滑桿加一個數字 —— 那不叫「複習元件」，
        學生看不出那個數字是從哪個東西來的。 */
  tap('[data-mi="us"]');
  ok(/lk-dist/.test(box.innerHTML) && /🧍/.test(box.innerHTML) && /📡/.test(box.innerHTML),
     '★★ 超音波：畫出感測器和會走的人');
  const manAt = () => Number((box.innerHTML.match(/lk-dist-o" style="left:([\d.]+)%/) || [])[1]);
  /* ⚠️⚠️ 老師 2026-08-25：「超音波距離感測器 與 全彩燈條 燈號順序
     左右位置相反了，人往右移，燈號應該也要右移，超音波起點放右邊」。
     ★ 第一版感測器畫在左邊 → 人往右＝變遠＝燈號往左縮，兩張圖反向。
     ⚠️ 這種錯**單看任何一張圖都是對的**，只有兩張擺在一起才看得出來。
     ⇒ 感測器在右：人往右＝靠近＝燈號也往右。 */
  const ledAt = () => {
    const ds = [...box.querySelectorAll('.pl-led')];
    return ds.findIndex(d => !/#1e293b|rgb\(30, 41, 59\)/.test(d.style.background)) + 1;
  };
  tap('[data-mo="strip"]');
  const sel = box.querySelector('#pl-mact');
  sel.value = 'seq'; sel.dispatchEvent(new W.Event('change', { bubbles: true }));
  pa.setRaw(50);  const farX = manAt(),  farLed = ledAt();
  pa.setRaw(10);  const nearX = manAt(), nearLed = ledAt();
  ok(nearX > farX, '★★ 靠近（10cm）→ **人在比較右邊**（' + farX + '% → ' + nearX + '%）');
  ok(nearLed > farLed,
     '★★ 而且亮的那一顆**也往右**（第 ' + farLed + ' 顆 → 第 ' + nearLed + ' 顆）');
  ok((nearX - farX) * (nearLed - farLed) > 0,
     '★★ 兩張圖同向 —— 人往哪走，燈號就往哪跑');
  ok(/公分/.test(box.innerHTML), '★ 而且尺標上寫著幾公分');

  tap('[data-mi="pot"]');
  ok(/pl-dial/.test(box.innerHTML) && /rotate\(/.test(box.innerHTML),
     '★★ 旋鈕：用第三節那顆真的會轉的（不是再畫一份）');
  /* ★★ 旋鈕配馬達：一切過去就要看得到「會反轉」那一種，而且**先看到它在動**。 */
  {
    tap('[data-mo="moto"]');
    ok(box.querySelector('#pl-mact').value === 'ratio',
       '★★ 旋鈕配馬達 → 預設選到「依比例（−250～250）」');
    ok(!/轉速 0<|停止/.test(box.innerHTML),
       '★★ 而且預設不是停在正中間（不然學生會以為壞掉）');
    pa.setRaw(10);
    ok(/-\d+/.test(box.querySelector('.pl-read').textContent) &&
       /反轉/.test(box.innerHTML),
       '★★ 往左轉 → 轉速是負的、而且畫面上寫「反轉」');
    pa.setRaw(50);
    ok(/停止/.test(box.innerHTML), '★ 正中間 → 停止（第三節那個 0）');
    /* ★★ 同樣選「依比例」，換成超音波之後範圍要自動變成 0～250 ——
       那正好是第三節「只往一邊轉的話下限 0 才對」那個對照。 */
    tap('[data-mi="us"]');
    ok(box.querySelector('#pl-mact').value === 'ratio', '   做法留著（還是「依比例」）');
    ok(/0 ～ 250/.test(box.innerHTML) && !/−250 ～ 250/.test(box.innerHTML),
       '★★ 但範圍自動換成 0 ～ 250（超音波不反轉）');
    tap('[data-mi="pot"]');
    tap('[data-mo="strip"]');
  }
  ok(/LK\(\)\.dialSvg\(/.test(read('shared/planlab.js')) &&
     /LK\(\)\.dialBind\(/.test(read('shared/planlab.js')),
     '★★ 旋鈕的幾何與拖曳都走 labkit（第三、五節同一顆）');
  {
    const svg = box.querySelector('.pl-dial');
    const t0 = box.querySelector('#pl-needle').getAttribute('transform');
    pa.setRaw(90);
    ok(box.querySelector('.pl-dial') === svg,
       '★★ 轉動之後 SVG 還是同一個元素（不然拖第二下就沒反應）');
    ok(box.querySelector('#pl-needle').getAttribute('transform') !== t0,
       '★ 而指針的角度真的變了');
  }
  box.querySelector('#pl-n0').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(pa.node() === 2, '★★ 試完才進得到「選情境」');
  /* ⚠️ 拉滑桿時只換舞台那一塊 —— 整頁重畫會讓滑桿失焦。 */
  ok(/function mixPaint\(\)[\s\S]{0,160}#pl-mstage[\s\S]{0,60}innerHTML/
       .test(read('shared/planlab.js')),
     '★★ 拉滑桿只換舞台那一塊，不整頁重畫');
  ok(!plan, '   複習盤本身不算完成整張設計單');
}

section('★★ 成果發表：三句話（老師指定，文字不可改）');
{
  ok(J.SHOW_Q.length === 3, '三句');
  /* ★ 老師 2026-08-25：前面改成「研發人員」（單數），三句主詞一律「我」。 */
  ok(/^我要解決的問題是/.test(J.SHOW_Q[0].t), '★★ 第一句：我要解決的問題是');
  ok(!J.SHOW_Q.some(q => /我們/.test(q.t)), '★★ 三句都沒有「我們」');
  /* ★★ 老師 2026-08-25（追加）：「要有兩種條件(如果 那麼 否則)」。 */
  /* ★★ 老師 2026-08-25（再追加）：「輸出元件 兩個都要，所以…的反應要分兩種，
     直接幫使用者註明 (燈條)(馬達)」。 */
  ok(/當.*時，（燈條）.*（馬達）.*；否則（燈條）.*（馬達）/.test(J.SHOW_Q[1].t),
     '★★ 第二句：兩個輸出各一格，而且**直接註明（燈條）（馬達）**');
  ok(J.SHOW_Q[1].slots.join() === 'when,thenL,thenM,elsL,elsM', '★★ 五格');
  ok(/玄關燈|電扇/.test(J.SHOW_Q[1].hint),
     '★★ 加註要說「可以讀成你作品裡的東西」（他可能換成電燈、電扇）');
  /* ⚠️⚠️ 拆成四格之後，正確答案自然很短（「熄掉」「停下來」）——
     門檻沒跟著調的話，學生會被逼著寫廢話。 */
  ok(J.MIN_IO < J.MIN, '★★ 輸出那四格的字數門檻要比別格低（' +
     J.MIN_IO + ' < ' + J.MIN + '）');
  ok(/否則/.test(J.SHOW_Q[1].hint) && /回不去/.test(J.SHOW_Q[1].hint),
     '★★ 加註要點破「少了否則，動作做了就回不去」（第一節那一課）');
  /* ★★ 老師 2026-08-25：「我遇到＿＿，最後用＿＿解決，我學到＿＿」。
     ⚠️ 多的那一格是**反思** —— 前兩格講「事情經過」，第三格才是「所以呢」。
        沒有它，發表就停在「我修好了」。 */
  ok(/^我遇到.*最後用.*解決.*我學到/.test(J.SHOW_Q[2].t),
     '★★ 第三句：我遇到＿＿，最後用＿＿解決，**我學到**＿＿');
  ok(J.SHOW_Q[2].slots.join() === 'trouble,fix,learn', '★★ 三格（含我學到）');
  ok(J.SHOW_Q.every(q => q.ph && q.ph.length === q.slots.length), '   每一格都有範例');

  /* ⚠️ 第二句的「當…」現在要看得出是**條件**（老師 2026-08-25：
     「一定要有條件判斷」）—— 範例本身也要合格。 */
  /* ⚠️ 規格（模式＋輸出）現在是必填 —— 一張沒有規格的成果卡
     看不出他做了什麼。 */
  /* ⚠️ 老師 2026-08-25（再追加）：「輸出元件 兩個都要」——
     所以「系統會…」和「否則…」各拆成燈條、馬達兩格。 */
  const v = { mode: '自動',
              problem: '晚上回家玄關太暗', when: '距離小於 30 公分',
              thenL: '亮起暖黃色', thenM: '慢慢開始轉',
              elsL: '熄掉', elsM: '停下來', trouble: '距離一直跳，燈會閃',
              fix: '把門檻改成進 15 出 25 兩個數字',
              learn: '感測器讀到的數字會抖，門檻不能只設一個' };
  ok(J.judgeShow(v).ok, '填滿 → 過');
  ok(!J.judgeShow(Object.assign({}, v, { thenL: '' })).ok, '   少一格 → 不過');
  /* ⚠️⚠️ 「否則」那**兩格**空著都要擋 —— 那正是第一節「門開了沒」的病根。 */
  ok(!J.judgeShow(Object.assign({}, v, { elsL: '' })).ok, '★★ 否則（燈條）空著 → 不過');
  ok(!J.judgeShow(Object.assign({}, v, { elsM: '' })).ok, '★★ 否則（馬達）空著 → 不過');
  ok(/否則（馬達）/.test(J.sayShow(J.judgeShow(Object.assign({}, v, { elsM: '' })))),
     '★★ 回饋分得出是**哪一個輸出**沒填');
  ok(!J.judgeShow(Object.assign({}, v, { learn: '' })).ok, '★★ 「我學到」空著 → 不過');
  ok(J.judgeShow(Object.assign({}, v, { learn: '' })).miss.indexOf('learn') >= 0 &&
     /我學到/.test(J.sayShow(J.judgeShow(Object.assign({}, v, { learn: '' })))),
     '★ 而且點名是「我學到」那一格');
  /* ⚠️ 規格不完整就出不了卡 —— 一張沒有規格的成果卡看不出他做了什麼。 */
  ok(J.judgeShow(Object.assign({}, v, { mode: '' })).how === 'nomode',
     '★★ 沒挑模式 → 擋下來');
  ok(/挑一種模式/.test(J.sayShow({ how: 'nomode' })), '   而且告訴他去哪裡挑');
  /* ⚠️ 老師 2026-08-25（再追加）：「輸出元件 **兩個都要**」——
     所以那個勾選整段拿掉了。留著一個永遠成立的勾選，
     就是補償一個不存在的情況（這幾輪一直在犯的錯）。 */
  const src4 = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/data-out=|f\.outs|'noout'/.test(src4), '★★ 輸出的勾選整段清掉（兩個都要，沒得選）');
  ok(J.specOf({ mode: '自動' }).outs.length === 2, '★★ 規格一律列兩個輸出');
  ok(/兩個輸出/.test(J.specOf({ mode: '自動' }).level),
     '★ 完成階段固定寫「一個輸入 ＋ 兩個輸出」');
  ok(J.judgeShow(Object.assign({}, v, { thenM: '' })).miss.indexOf('thenM') >= 0,
     '★ 而且點名是哪一格');
  /* ⚠️ 回饋要分得出**是哪一個輸出** —— 兩格都叫「系統會…」的話，
     學生看到「還有沒填完的：系統會…」根本不知道要填哪一格。 */
  ok(/（馬達）/.test(J.sayShow(J.judgeShow(Object.assign({}, v, { thenM: '' })))) &&
     !/（燈條）/.test(J.sayShow(J.judgeShow(Object.assign({}, v, { thenM: '' })))),
     '★★ 只點名（馬達）那一格，不會兩個都講');
  /* ⚠️⚠️ 「沒有遇到問題」是第三句最常見的敷衍，而那一格最值錢。
     ⚠️ 而且**短的那幾個也要判成 notrouble**，不可以只回「太短」——
        回「太短」會把他推去補成「沒有遇到問題」，剛好過長度，
        這一格最值錢的東西還是沒寫。 */
  ['沒有', '沒有遇到什麼問題', '都很順利', '無', '沒'].forEach(t => {
    const rr = J.judgeShow(Object.assign({}, v, { trouble: t }));
    ok(!rr.ok && rr.how === 'notrouble', '★★ 「' + t + '」→ 擋下來，而且點破是在敷衍');
  });
  ok(/最值錢|燒錄|插錯/.test(J.sayShow({ how: 'notrouble' })),
     '★★ 而且要給他方向（燒錄、數字、接線都算）');

  /* ★★ 老師 2026-08-25：「加註 如果 那麼 或者 如果 那麼 否則
     一定要有條件判斷」。
     ⚠️ 第二句不是在描述「我們做了什麼」，它就是**程式裡那個判斷**。
        寫不出條件的組別，通常是程式裡也沒有 —— 那才是要抓的。 */
  ok(/如果/.test(J.SHOW_Q[1].hint) && /那麼/.test(J.SHOW_Q[1].hint) &&
     /否則/.test(J.SHOW_Q[1].hint),
     '★★ 第二句旁邊加註「如果…那麼…否則…」');
  ['當我們做好的時候', '大家一起努力', '完成之後'].forEach(t => {
    const rr = J.judgeShow(Object.assign({}, v, { when: t }));
    ok(!rr.ok && rr.how === 'nocond', '★★ 「' + t + '」不是條件 → 擋下來');
  });
  /* ⚠️ 但要**放寬到生活講法** —— 國中生講得出那個意思就算，
     不必寫成數學式，不然會卡在措辭上。 */
  ['距離小於 30 公分', '有人太近的時候', '旋鈕轉到底', '手靠近感測器', '超過 15 公分']
    .forEach(t => {
      ok(J.judgeShow(Object.assign({}, v, { when: t })).ok,
         '★ 「' + t + '」算條件（生活講法也收）');
    });
  ok(/如果/.test(J.sayShow({ how: 'nocond' })) && /拿什麼在比/.test(J.sayShow({ how: 'nocond' })),
     '★★ 擋下來的時候要說清楚「條件要看得出拿什麼在比」');
}

section('★★ 成果卡：帶得走（老師 2026-08-25 追加）');
{
  const v = { mode: '自動', problem: '玄關太暗', when: '有人靠近',
              thenL: '燈亮起來', thenM: '風扇轉', elsL: '燈關掉', elsM: '風扇停',
              trouble: '燈一直閃', fix: '加了兩個門檻', learn: '門檻要兩個' };
  const html = J.cardHtml(v, { scene: '玄關迎賓燈', team: '二年三班第 4 組',
                               mode: '自動', date: '2026/8/25' });
  ok(/玄關迎賓燈/.test(html) && /二年三班第 4 組/.test(html), '★ 卡片上有題目和研發人員');
  /* ★ 老師 2026-08-25：「成果卡應該要有手動或自動系統選擇，
     超音波或可變電阻，配燈條與馬達，完整版本的格式」。 */
  ok(/控制模式/.test(html) && /自動模式/.test(html), '★★ 規格表寫出控制模式');
  ok(/輸入元件/.test(html) && /超音波距離感測器/.test(html),
     '★★ 輸入元件由模式帶出來（自動＝超音波）');
  ok(/Trig = A2/.test(html), '★ 連接腳都寫上去');
  ok(/輸出元件/.test(html) && /RGB 全彩燈條/.test(html) && /直流馬達/.test(html),
     '★★ 輸出元件（燈條＋馬達）');
  ok(/一個輸入 ＋ 兩個輸出/.test(html), '★ 系統架構固定寫「一個輸入 ＋ 兩個輸出」');
  ok(/專題成果報告/.test(html) && /一、系統規格/.test(html) &&
     /二、動作說明/.test(html) && /三、問題與解決/.test(html),
     '★★ 正式文件的版面（抬頭＋三段編號）');
  ok(/研發人員簽名/.test(html) && /教師確認/.test(html), '★ 有簽名欄');
  ok(/我要解決的問題是/.test(html) && /最後用/.test(html) && /我學到/.test(html),
     '★★ 三句話都在卡片上（含「我學到」）');
  /* ★★ 第二句在卡片上要**分兩列**：燈條一列、馬達一列。 */
  /* ⚠️ 要釘在**表格的標題欄**上 —— 只查「頁面某處有『燈條』」的話，
     「否則 燈條」那一列也會讓它過，標題欄漏掉照樣綠。 */
  ok(/<th>燈條<\/th>/.test(html) && /<th>馬達<\/th>/.test(html),
     '★★ 卡片上兩個輸出各自一列（標題欄標明是哪一個）');
  ok(/<th>否則 燈條<\/th>/.test(html) && /<th>否則 馬達<\/th>/.test(html),
     '★★ 「否則」那兩格也各自一列');
  ok(!/我們/.test(html), '★ 卡片上沒有「我們」');
  /* ⚠️⚠️ 下載成 PNG 的那一版**版面是另一份**（cardLines）——
     兩份要一起改。突變測試證實：把 cardLines 的「我學到」刪掉，
     網頁版照樣正確、測試也照樣綠，**只有下載下來的圖少一句**。 */
  const rows = J.cardLines(v);
  const txt = rows.map(r => (r.s || '') + (r.k || '') + (r.v || '')).join('\n');
  ok(rows.filter(r => r.s).length === 3, '★★ 下載版也有三段標題');
  ok(/一、系統規格/.test(txt) && /二、動作說明/.test(txt) && /三、問題與解決/.test(txt),
     '★★ 而且和網頁版同一套段落');
  /* ⚠️⚠️ 老師 2026-08-25：「系統規格中…這個自己一行」。
     ★ 第一版把四項規格擠成兩行文字（「控制模式：…｜輸入：…」）——
       看起來像備註，不像規格表。 */
  const spec = rows.filter(r => r.t === 'spec');
  ok(spec.length >= 4, '★★ 系統規格**一項一行**（' + spec.length + ' 行）');
  ok(spec.map(r => r.k).join() === '控制模式,輸入元件,接腳,輸出元件,系統架構',
     '★★ 四項規格各自一列，欄位名和內容分開');
  ok(spec.every(r => r.v && String(r.v).indexOf('：') < 0),
     '★ 每一格只放**內容**，不再把欄位名塞進同一格');
  /* ⚠️⚠️ 老師 2026-08-25：「使用者自己輸入的文字用不同顏色表示」——
     所以每一格都要標得出**誰填的**。 */
  ok(rows.filter(r => r.own).length >= 7,
     '★★ 學生自己填的那幾格都標了 own（要上色）');
  ok(spec.every(r => !r.own), '★★ 規格那幾行是系統填的，不上色');
  ok(/我要解決的問題是/.test(txt), '★ ① 我要解決的問題是');
  ok(rows.some(r => r.t === 'cond'), '★★ 條件那一列**單獨一種樣式**（它就是程式裡的「如果」）');
  ok(rows.filter(r => r.t === 'io').length === 4,
     '★★ 兩個輸出 ×（那麼／否則）＝ 四列，各自一行');
  ok(/我遇到/.test(txt) && /解決/.test(txt), '★ ③ 我遇到…最後用…解決');
  ok(/我學到/.test(txt) && txt.indexOf(v.learn) >= 0, '★★ ④ 我學到（下載版也要有）');
  ok(!/我們/.test(txt), '★ 下載版也沒有「我們」');
  /* ★ 顏色：畫的時候學生的字要用不同顏色，而且卡片上要有圖例。 */
  /* ⚠️⚠️ 這幾條要**只看 drawCard（PNG 版）那一段**。
     HTML 版和 PNG 版用了同樣的字串（「藍色的字是研發人員自己填的」、
     row('專題名稱', …)），整份原始碼一起搜的話，
     **PNG 版改壞了照樣綠** —— 因為 HTML 版那一份還在。
     ★ 這個教訓這一輪已經是第三次了（先前是 cardLines、<th>燈條）。 */
  const all5 = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  const src5 = all5.slice(all5.indexOf('function drawCard'),
                          all5.indexOf('function downloadPng'));
  ok(/C_OWN = '#1d4ed8'/.test(all5) && /own \? C_OWN : C_TXT/.test(src5),
     '★★ 下載版真的用兩種顏色畫（學生的字 vs 系統填的）');
  ok(/row\('專題名稱', m\.scene, true\)/.test(src5),
     '★★ PNG 版：專題名稱算學生填的（上色）');
  ok(/row\('研發人員', m\.team, false\)/.test(src5), '★ 研發人員是系統填的（不上色）');
  ok(/藍色的字是研發人員自己填的/.test(src5),
     '★★ PNG 版有顏色圖例 —— 不然看的人不知道顏色代表什麼');
  ok(/pj-own/.test(J.cardHtml(v, {})) && /藍色的字/.test(J.cardHtml(v, {})),
     '★ 網頁版也上同一種色、也有圖例');
  /* ⚠️ 卡片上**每一格都是學生自己打的字**，全部都要跳脫。 */
  ['problem', 'when', 'thenL', 'thenM', 'elsL', 'elsM',
   'trouble', 'fix', 'learn'].forEach(k => {
    const w = Object.assign({}, v); w[k] = '<img src=x onerror=alert(1)>';
    ok(!/<img/.test(J.cardHtml(w, {})), '★★ ' + k + ' 有跳脫');
  });
  ['scene', 'team', 'mode', 'line'].forEach(k => {
    const m = { scene: 'x', team: 'x', mode: 'x', line: 'x' };
    m[k] = '<img src=x onerror=alert(1)>';
    ok(!/<img/.test(J.cardHtml(v, m)), '★★ ' + k + ' 也要跳脫（情境可以自訂）');
  });

  /* ⚠️⚠️ jsPDF 那一類的函式庫預設不含中文字型 —— 印出來是一排豆腐字。
     ⚠️ 這一條要**先剝註解**：程式碼的註解裡就寫著「不用 jsPDF」，
        不剝的話這條永遠是紅的（第八次踩到同一族的坑）。 */
  const src = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/jspdf|html2canvas|pdfmake/i.test(src),
     '★★ 不用 jsPDF／html2canvas（中文會變豆腐字，而且電腦教室未必載得到）');
  /* ⚠️ 老師 2026-08-25：「保留下載成圖片就好」。
     ★ 列印那條路整段拿掉了 —— 連 printCard()、@media print、
       #pj-print-root 都清掉。
     ⚠️ 留著一條沒有按鈕會走到的路，比刪掉更糟：
        下一個人會以為它還被用著、還被測過。 */
  ok(!/printCard|global\.print\(\)|@media print|pj-print-root/.test(src),
     '★★ 列印那條路整段清乾淨（沒有留死碼）');
  ok(/toDataURL\('image\/png'\)/.test(src), '★ 只留下載成 PNG');

  /* ★ 老師 2026-08-25：檔名為「成果發表-班級_座號_姓名.png」。 */
  ok(J.fileName({ file: '二年三班_13_王小明' }) === '成果發表-二年三班_13_王小明.png',
     '★★ 檔名＝成果發表-班級_座號_姓名.png');
  /* ⚠️ Windows 不收 \ / : * ? " < > | 那幾個字 —— 有的話整個存不下來。 */
  ok(!/[\\/:*?"<>|]/.test(J.fileName({ file: '二年3班/13*王<小>明' })),
     '★★ 非法字元清掉（不然 Windows 拒存）');
  ok(!/\s/.test(J.fileName({ file: '二年三班 13 王小明' })),
     '★ 空白也拿掉（一整批交上來才排得了序）');
  /* ⚠️ 讀不到身分的時候不要湊出「成果發表-.png」那種檔名。 */
  ok(J.fileName({ scene: '玄關迎賓燈' }) === '成果發表-玄關迎賓燈.png',
     '★★ 沒有身分就退回專題名稱（至少看得出是誰的作品）');
  ok(J.fileName({}) === '成果發表-專題.png', '   什麼都沒有也不會變成「成果發表-.png」');
  ok(/關機會還原/.test(src), '★★ 提醒學生電腦教室關機會還原，記得把檔案帶走');
}

section('★★ 走一遍：展示 → 成果卡');
{
  const el = W.document.getElementById('x');
  let done = null;
  const line = '如果　超音波距離小於 15 公分　那麼　RGB 全彩燈條就整條亮起指定顏色。';
  const api = J.mount(el, { line: line, plan: { scene: '玄關迎賓燈' },
                            onDone: i => { done = i; } });
  const set = (id, v) => { const e = el.querySelector('#' + id); if (e) e.value = v; return !!e; };
  const click = id => el.querySelector('#' + id)
    .dispatchEvent(new W.Event('click', { bubbles: true }));

  ok(api.tab() === 'demo', '★ 一進來是兩種模式的對照（不是關卡）');
  ok(/玄關迎賓燈/.test(el.textContent) && /15 公分/.test(el.textContent),
     '★★ 畫面上一直掛著設計單那一句');
  /* ⚠️ 老師：「第五課不用動手檢核」—— 兩塊都是開的，隨時可以來回。 */
  ok(!!el.querySelector('[data-tab="show"]'), '★★ 成果發表一開始就點得到（沒有鎖）');
  /* ★★ 這一塊的目的是「條件判斷在哪裡」，不是再拉一次滑桿。 */
  ok(!el.querySelector('#pj-cm') && !el.querySelector('#pj-pct'),
     '★★ 沒有第二組滑桿了（那和複習盤重複）');
  ok(el.querySelectorAll('.pj-col').length === 2, '★ 兩欄對照表');
  ok(/一個輸入 ＋ 兩個輸出/.test(el.textContent),
     '★★ 畫面上明講「一個輸入 ＋ 兩個輸出」（老師 2026-08-25）');
  ok(/輸入從頭到尾不換/.test(el.textContent),
     '★★ 而且明講輸入不換 —— 挑戰關加的是第二個輸出');
  ok(/否則/.test(el.textContent), '★★ 自動那一欄看得到「否則」');
  ok(/沒有.{0,2}條件判斷/.test(el.textContent),
     '★★ 手動那一欄明講「沒有條件判斷」');
  ok(/一定要有一個「如果」/.test(el.textContent),
     '★★ 而且收尾要求：不管做哪一種，程式裡一定要有一個「如果」');
  /* ⚠️⚠️ 老師 2026-08-25：「模式 沒有決定應該不能進入 下一步吧?」
     ★ 對 —— 而且不只是出卡時才擋：**沒選模式，第二句的範例就給不出來**。
       讓他先進去看到一組通用範例、寫完才被退回來，比一開始就擋更糟。 */
  ok(!api.work().mode, '   （還沒挑模式）');
  el.querySelector('[data-tab="show"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.tab() === 'demo', '★★ 沒挑模式 → 分頁點不進去');
  ok(/先挑一種模式/.test(el.textContent), '★★ 而且講清楚為什麼');
  click('pj-go-show');
  ok(api.tab() === 'demo', '★★ 「下一步」那顆按鈕也一樣進不去');
  ok(!!el.querySelector('.pj-tab.off'), '★ 那個分頁看得出是暗的（不是按了沒反應）');
  /* ⚠️ 按鈕**自己**也要看得出來 —— 只有點下去才出提示的話，
     學生會以為那顆壞了（第一版就是這樣，突變測試漏掉）。 */
  ok(/先挑一種模式/.test(el.querySelector('#pj-go-show').textContent),
     '★★ 那顆按鈕上就寫著「先挑一種模式」');

  /* ★ 學生要選一種當自己的作品。 */
  el.querySelector('[data-pick="手動"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.work().mode === '手動', '★★ 挑一種模式當自己的作品');
  ok(!el.querySelector('.pj-tab.off'), '★ 挑了之後分頁就亮了');

  click('pj-go-show');
  ok(api.tab() === 'show' && !!el.querySelector('#pj-problem'), '★ 進到成果發表');
  /* ⚠️⚠️ 加註**要真的出現在畫面上** —— 只放在資料裡沒有用。
     ★ 第一版只查 SHOW_Q[1].hint 的內容，把渲染那一行拿掉照樣綠。 */
  {
    const hint = el.querySelector('.pj-hint');
    ok(!!hint, '★★ 第二句旁邊真的印出那行加註');
    const t = hint ? hint.textContent : '';
    ok(/如果/.test(t) && /那麼/.test(t) && /否則/.test(t),
       '★★ 而且「如果…那麼…否則…」三個字都在（老師 2026-08-25 指定）');
  }

  set('pj-problem', '晚上回家玄關太暗，開燈要摸半天');
  /* ⚠️ 這一段前面選的是**手動**，所以條件也要寫旋鈕那一邊的 ——
     不然會（正確地）被提醒「你選手動，條件卻在講自動」。
     ★ 這正是模式和成果卡的關連：測試自己也得對得起來。 */
  set('pj-when', '旋鈕轉到 80% 以上'); set('pj-thenL', '燈條變紅');
  ok(set('pj-thenM', '風扇轉快'), '★★ 畫面上（馬達）也有一格');
  ok(set('pj-elsL', '燈條熄掉') && set('pj-elsM', '風扇停下來'),
     '★★ 「否則」也是兩格');
  set('pj-trouble', '沒有'); set('pj-fix', '把門檻改成兩個數字');
  click('pj-make');
  ok(!done && /最值錢/.test(el.textContent), '★★ 第三句寫「沒有」→ 擋下來，不給出卡');
  set('pj-trouble', '距離一直跳，燈會閃個不停');
  set('pj-fix', '把門檻改成進 15 出 25 兩個數字');
  ok(set('pj-learn', '感測器的數字會抖，門檻不能只設一個'), '★★ 畫面上有「我學到」那一格');
  ok(/輸入元件/.test(el.textContent) && /可變電阻/.test(el.textContent),
     '★★ 規格區：輸入元件由模式自動帶出來（不讓學生選）');
  ok(/RGB 全彩燈條、直流馬達/.test(el.textContent),
     '★★ 輸出**兩個都列**（沒得勾 —— 老師：兩個都要）');
  click('pj-make');
  ok(!!done, '★ 三句都寫好 → 產生成果卡');
  ok(!!el.querySelector('#pj-card'), '   卡片畫出來了');
  ok(/手動模式/.test(el.querySelector('#pj-card').textContent),
     '★★ 卡片上帶著他選的模式');
  ok(/可變電阻/.test(el.querySelector('#pj-card').textContent),
     '★★ 而且輸入元件跟著模式帶出來（手動＝可變電阻）');
  ok(/否則/.test(el.querySelector('#pj-card').textContent),
     '★★ 成果卡上第二句也印出「否則」那一段');
  ok(!el.querySelector('#pj-print') && !!el.querySelector('#pj-png'),
     '★★ 只留「下載成圖片」（老師 2026-08-25：保留下載成圖片就好）');
  ok(/檔名會自動取成/.test(el.textContent) && /成果發表-/.test(el.textContent),
     '★★ 而且先告訴他檔名長什麼樣（一整批交上來才對得起來）');
  /* ⚠️ 列印那條路拿掉之後，**畫面上的句子也要跟著改** ——
     老師 2026-08-25：「這句話也要修改」。 */
  ok(!/列印|另存|PDF/.test(el.textContent),
     '★★ 出卡之後的說明不再提列印／另存 PDF');
  ok(!!done.work && done.work.problem, '★ 回報 onDone 時把整份內容帶出去（要存起來）');
  /* ⚠️ 回頭改的時候字要還在。 */
  click('pj-back');
  ok(el.querySelector('#pj-problem').value === '晚上回家玄關太暗，開燈要摸半天',
     '★★ 回去改的時候填過的字還在');
}

section('★★ 研發人員：系統自動填入（老師 2026-08-25）');
{
  /* ★ 老師：「『組別／組員：』改成『研發人員：』，
     這個班級座號姓名資料能夠由系統自動填入吧」。 */
  const b1 = W.document.createElement('div');
  W.document.body.appendChild(b1);
  const a1 = J.mount(b1, { who: '二年三班　13 號　王小明' });
  /* ⚠️ 沒挑模式進不了成果發表（老師 2026-08-25）—— 先挑一個。 */
  const pick = (box, t) => box.querySelector('[data-pick="' + t + '"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  pick(b1, '自動');
  a1.show('show');
  ok(/研發人員/.test(b1.textContent) && !/組別／組員/.test(b1.textContent),
     '★★ 欄位名稱改成「研發人員」');
  /* ⚠️⚠️ 老師 2026-08-25：「個人資料應該是唯讀，由系統填寫」。
     ★ 能打字就有人會打別人的名字，而這張卡是要交出去的。 */
  ok(!b1.querySelector('#pj-team'), '★★ 那一格**不是輸入框**（唯讀）');
  ok(/二年三班　13 號　王小明/.test(b1.textContent), '★★ 但名字要顯示出來');
  ok(/不可修改/.test(b1.textContent), '★ 而且講明是系統填的、不可修改');
  ok(b1.querySelector('#pj-card') === null, '   （這時還沒出卡）');

  /* ⚠️⚠️ 老師 2026-08-25 追問：「不是要在名冊內才能登入?」—— 對。
     ★ 所以「讀不到」**不是**沒登入、也不是名冊沒建：那兩種進不到這一頁。
       真正會發生的只有「還沒問到」（SSO 讀的是快取，
       直接開網址或新分頁進來時快取是空的）。
     ⚠️ 第一版把原因寫成「可能是沒登入」—— 那是**猜的，而且猜錯**。
        錯的原因比沒有原因更糟：學生會跑去重新登入，然後發現沒用。 */
  const src0 = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/可能是沒登入|名冊還沒建/.test(src0),
     '★★ 不再把原因猜成「沒登入／名冊沒建」（登入就一定在名冊裡）');

  const b2 = W.document.createElement('div');
  W.document.body.appendChild(b2);
  const a2 = J.mount(b2, {});
  pick(b2, '自動');
  a2.show('show');
  ok(a2.whoState() === 'wait' && /正在讀/.test(b2.textContent),
     '★★ 這個時候要說「**正在讀**」，不是說「讀不到」');
  /* ★ 頁面問到名冊之後補進來。 */
  a2.setWho('二年三班　13 號　王小明');
  ok(/二年三班　13 號　王小明/.test(b2.textContent), '★★ 問到之後自動顯示出來');
  ok(a2.whoState() === 'got', '   狀態跟著換');
  /* ⚠️ 真的問不到才講「請自己填」—— 而且要點出成果卡不能沒有名字。 */
  const b4 = W.document.createElement('div');
  W.document.body.appendChild(b4);
  const a4 = J.mount(b4, {});
  pick(b4, '自動');
  a4.show('show');
  a4.setWho('');
  ok(a4.whoState() === 'miss' && /沒問到/.test(b4.textContent),
     '★★ 真的問不到 → 才說「沒問到」');
  /* ⚠️⚠️ 唯讀的欄位問不到的話，學生什麼都做不了 ——
     所以一定要留一條路，不能只留一句抱歉。 */
  let retried = 0;
  const b5 = W.document.createElement('div');
  W.document.body.appendChild(b5);
  const a5 = J.mount(b5, { onRetryWho: () => { retried++; } });
  pick(b5, '自動');
  a5.show('show');
  a5.setWho('');
  ok(!!b5.querySelector('#pj-whoretry'), '★★ 問不到 → 要有一顆「重新讀取」');
  b5.querySelector('#pj-whoretry').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(retried === 1, '★★ 按下去真的再問一次');
  ok(a5.whoState() === 'wait' && /正在讀/.test(b5.textContent), '   而且回到「正在讀」');
  /* ⚠️ 唯讀之後，「會不會蓋掉學生打的」那個問題就不存在了 ——
     留著那段判斷就是補償一個不存在的問題（這幾輪一直犯的錯）。 */
  const src1 = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/if \(!norm\(f\.team\)\)/.test(src1),
     '★★ 沒有殘留「不覆蓋學生打的」那段（唯讀就不會有那個情況）');

  /* ⚠️⚠️ 老師 2026-08-25：「研發人員 是我上次輸入的人名? 不是目前帳號的實際資料」
     ★ 病根：身分原本和學生的作答**混在同一包 work 裡**，
       而那一包會被存下來、下次再載回來 ——
       於是唯讀之前手打的名字就一直跟著跑。
     ⚠️ 前一輪我測的是 setWho()「會覆蓋」，但快取有值的時候
        **根本不會呼叫 setWho()** —— 釘錯層：
        測了修補的動作，沒測真正的來源。
     ⇒ 要測的是 **mount 當下**：舊紀錄裡的 team 一律忽略。 */
  const b3 = W.document.createElement('div');
  W.document.body.appendChild(b3);
  const a3 = J.mount(b3, { who: '二年三班　13 號　王小明',
                           work: { team: '上次手打的別人' } });
  pick(b3, '自動');
  a3.show('show');
  ok(!/上次手打的別人/.test(b3.textContent),
     '★★ 舊紀錄裡的名字**完全不採用**（不是靠事後覆蓋）');
  ok(/二年三班　13 號　王小明/.test(b3.textContent), '★★ 顯示的是目前帳號的資料');
  /* ⚠️ 連沒有 who 的時候也不可以退回舊紀錄 —— 那還是別人的名字。 */
  const b3b = W.document.createElement('div');
  W.document.body.appendChild(b3b);
  const a3b = J.mount(b3b, { work: { team: '上次手打的別人' } });
  pick(b3b, '自動');
  a3b.show('show');
  ok(!/上次手打的別人/.test(b3b.textContent) && a3b.whoState() === 'wait',
     '★★ 沒讀到帳號資料時也不退回舊紀錄（寧可空著等）');
  /* ★ 而且存下去的**作答不含身分** —— 身分每次跟著帳號重新帶。 */
  const src2 = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/team: ''/.test(src2) && !/f\.team/.test(src2),
     '★★ 身分不放進作答那一包（不然又會跟著紀錄跑）');

  /* 頁面那一端：身分從 SSO 的快取拿。 */
  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/sso\.js"><\/script>/.test(page), '頁面載入 sso');
  ok(/who: whoText\(\)/.test(page), '★ 掛載時把身分傳進去');
  ok(/window\.SSO && window\.SSO\.me/.test(page),
     '★★ 先用同步的快取 —— 不為了填一格名字去等 Firestore');
  /* ★★ 快取沒有不代表查不到 —— 那只代表這一頁還沒問過。 */
  ok(/SSO\.resolve\(window\.LABROSTER/.test(page),
     '★★ 快取沒有就去問一次名冊（登入了就一定查得到）');
  /* ⚠️ 光「有寫那個函式」不算 —— 要真的**被呼叫到**。
     突變測試把呼叫刪掉，函式還在，第一版照樣綠（釘錯層）。 */
  ok(/\n\s*fillWhoLater\(\);/.test(page),
     '★★ 而且掛載檢核之後真的呼叫它（不是只定義著）');
  ok(/chkApi\.setWho/.test(page), '★ 問到之後補回畫面');
  /* ⚠️⚠️ 問不到也要**回報** —— 不回報的話畫面會永遠停在「正在讀…」，
     而那比直接說「沒問到」更糟：學生會一直等。 */
  ok(/return tell\(''\)/.test(page) && /catch\(function \(\) \{ tell\(''\); \}\)/.test(page),
     '★★ 沒有 SSO／讀失敗都要回報空值（不可以卡在「正在讀」）');
  ok(/onRetryWho/.test(page), '★ 而且「重新讀取」接得回去再問一次');
  ok(/window\.LABROSTER = async function/.test(page), '   有一支讀名冊的');
  ok(/COLLECTIONS && CFG\.COLLECTIONS\.ROSTER/.test(page) && /-roster/.test(page),
     '★ 名冊的集合名字跟著設定走（不寫死成 11501-roster）');
  ok(/if \(me\.cls\)/.test(page) && /if \(me\.name\)/.test(page),
     '★★ 缺哪一段跳過哪一段（不要印出「undefined 班」）');
}

section('★★ 模式和成果卡要真的有關連（老師 2026-08-25）');
{
  /* ⚠️⚠️ 老師：「自動模式 & 手動模式 對於 成果卡無關連性?」
     ★ 問得對 —— 原本它只是印在卡上的標籤，不影響任何東西。
     ⇒ 現在它決定第二句的**範例**，而且會檢查條件對不對得起來。 */
  ok(J.MODES.every(m => m.ph && m.ph.length && m.words),
     '★★ 每一種模式都有自己的範例和關鍵字');
  ok(/距離|公分/.test(J.MODES[0].ph[0]) && /旋鈕/.test(J.MODES[1].ph[0]),
     '★★ 自動給距離的例子、手動給旋鈕的例子');
  /* ⚠️⚠️ 老師 2026-08-25 回報：「（燈條）會 …有兩種? （馬達）會 …關閉?」
     ★ 病根：第二句拆成五格時，我改了 SHOW_Q 的範例，
       **卻忘了 MODES 裡還有一份**（上一輪為了「模式決定範例」加的）。
       於是（燈條）那格顯示「燈條亮起來、風扇開始轉」（兩種擠在一起），
       （馬達）那格顯示「兩個都關掉」—— 整個錯位。
     ⚠️ 這種錯不會報錯、不影響判定，只有**照著範例填的人**會被誤導。
     ⇒ 釘死「兩份的格數必須一樣」，以後再拆格子就會紅。 */
  ok(J.MODES.every(m => m.ph.length === J.SHOW_Q[1].slots.length),
     '★★ 每一種模式的範例格數要和第二句的格數一樣（' +
     J.SHOW_Q[1].slots.length + '）');
  /* ★ 而且燈條那格只講燈、馬達那格只講馬達 —— 不可以又擠在一起。 */
  ok(!/、/.test(J.MODES[0].ph[1]) && !/、/.test(J.MODES[0].ph[2]),
     '★★ 自動：（燈條）（馬達）各自的範例不會擠在一格');
  ok(!/、/.test(J.MODES[1].ph[1]) && !/、/.test(J.MODES[1].ph[2]),
     '★★ 手動：同上');
  ok(!/兩個都/.test(J.MODES.map(m => m.ph.join()).join()),
     '★★ 沒有殘留「兩個都關掉」那種**合寫**的範例');

  const base = { mode: '自動', problem: '玄關太暗', when: '距離小於 30 公分',
                 thenL: '燈條亮起來', thenM: '風扇開始轉',
                 elsL: '燈條熄掉', elsM: '風扇停下來',
                 trouble: '燈會一直閃', fix: '加了兩個門檻', learn: '門檻要兩個' };
  ok(J.judgeShow(base).ok && !J.judgeShow(base).warn, '★ 對得起來 → 沒有提醒');
  const bad = Object.assign({}, base, { when: '旋鈕轉到 80% 以上' });
  ok(J.judgeShow(bad).ok, '★★ 對不起來還是**過** —— 只提醒，不擋');
  ok(/自動模式/.test(J.judgeShow(bad).warn) && /手動模式/.test(J.judgeShow(bad).warn),
     '★★ 但要點名「你選自動，條件卻在講手動」');
  /* ⚠️ 沒選模式、或條件我看不懂的寫法 → 不要亂提醒。 */
  ok(!J.judgeShow(Object.assign({}, base, { mode: '' })).warn, '   沒選模式就不提醒');
  /* ⚠️⚠️ 這個例子要**先過得了條件檢查**，不然測到的是別的東西。
     第一版用「太暗的時候」—— 它連 COND 都不過，judgeShow 早就
     回 nocond 了（連 warn 這個欄位都沒有），
     於是「不要亂提醒」那條**永遠是綠的**（突變測試當場證實）。
     ⇒ 換成「亮度低於 20」：有比較詞（過得了 COND），
       但兩邊的關鍵字都沾不到。 */
  const vague = Object.assign({}, base, { when: '亮度低於 20' });
  ok(J.judgeShow(vague).ok, '   （先確認這個例子過得了條件檢查）');
  ok(!J.judgeShow(vague).warn,
     '★★ 兩邊關鍵字都沾不到 → **不要亂猜**（學生可能有我沒想到的寫法）');

  /* 畫面上：選了模式，第二句的範例要跟著換。 */
  const b6 = W.document.createElement('div');
  W.document.body.appendChild(b6);
  const a6 = J.mount(b6, {});
  b6.querySelector('[data-pick="手動"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  a6.show('show');
  ok(/旋鈕/.test(b6.querySelector('#pj-when').getAttribute('placeholder')),
     '★★ 選了手動 → 第二句的範例換成旋鈕那一組');
}

section('★★ AI 助教看一遍（老師 2026-08-25：成果發表引入 AI 檢測）');
{
  /* ★ 三個檢查點都是本機關鍵字判不出來的 —— 尤其③的關聯性。 */
  ok(J.AI_NEED.length === 3, '三個檢查點');
  ok(/實際|真的/.test(J.AI_NEED[0].name + J.AI_NEED[0].tip),
     '★★ ① 問題要是**實際存在**的情況');
  ok(/元件/.test(J.AI_NEED[1].name) &&
     /距離/.test(J.AI_NEED[1].tip) && /旋鈕/.test(J.AI_NEED[1].tip) &&
     /燈條/.test(J.AI_NEED[1].tip) && /風扇/.test(J.AI_NEED[1].tip),
     '★★ ② 條件和動作要和選的元件相關（距離／旋鈕／亮燈／轉動）');
  ok(/對得起來|關聯/.test(J.AI_NEED[2].name) && /三個階段|同一件事/.test(J.AI_NEED[2].tip),
     '★★ ③ 遇到／解決／學到要互相關聯');
  ok(J.AI_NEED.every(g => g.tip && g.tip.length > 30),
     '★ 每一點都給**具體**的建議（不是只說「不夠好」）');
  /* ⚠️ 送出去的是三句話串起來的一段，而且要截斷（額度全班共用）。 */
  const v2 = { mode: '自動', problem: '玄關太暗', when: '距離小於 30 公分',
               thenL: '燈亮', thenM: '風扇轉', elsL: '燈關', elsM: '風扇停',
               trouble: '燈會閃', fix: '兩個門檻', learn: '門檻要兩個' };
  const txt = J.aiText(v2);
  ok(/1/.test(txt) && /2/.test(txt) && /3/.test(txt), '★ 三句都送出去（AI 才判得出關聯）');
  ok(/玄關太暗/.test(txt) && /門檻要兩個/.test(txt), '   內容都在');

  /* ⚠️⚠️ 這個專案的鐵律：**AI 不可以有否決權**。
     額度用完、GAS 掛掉、網路不通的時候，全班會卡在這裡交不出成果卡。 */
  const src3 = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/\.catch\(function \(\) \{ return \{ skipped: true \}; \}\)/.test(src3),
     '★★ AI 失敗一律當成「沒看」（不是不給過）');
  /* ⚠️⚠️ 沒設定 AI 的環境下**連那條非同步的路都不要走** ——
     不然「按了就出卡」會變成非同步（差一個 microtask），
     而且按鈕旁還會寫「AI 會先看一遍」，那是騙人的。 */
  ok(!J.aiOn(), '   （測試環境沒有 ASKAI）');
  ok(/if \(aiOn\(\) && !aiSeen\(\) && !aiBusy\)/.test(src3),
     '★★ 沒有 AI 就不繞那條路（按了直接出卡）');
  ok(/aiOn\(\) && !aiSeen\(\)/.test(src3),
     '★ 沒有 AI 的時候也不寫「AI 會先看一遍」');
  ok(/if \(a\.skipped\) return doShow\(\);/.test(src3),
     '★★ AI 不在／失敗 → **直接出卡**（學生不會知道有這一關）');
  ok(/names\.indexOf\(n\) >= 0/.test(src3),
     '★★ 只收原本列出的那三個名稱（模型自己造的丟掉 —— 不然是代判不是覆核）');
  ok(/slice\(0, 400\)/.test(src3), '★ 送出前截斷（額度是全班共用的）');

  /* 走一遍：AI 說有一點不夠 → 給建議、不出卡；再按一次才出卡。 */
  const el7 = W.document.createElement('div');
  W.document.body.appendChild(el7);
  let done7 = null;
  const a7 = J.mount(el7, { onDone: i => { done7 = i; } });
  /* ⚠️ 規格是必填 —— 先挑模式、勾輸出，不然會被本機那一關擋在 AI 之前。 */
  el7.querySelector('[data-pick="自動"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  a7.show('show');

  const put = (id, v) => { const e = el7.querySelector('#' + id); if (e) e.value = v; };
  put('pj-problem', '晚上回家玄關太暗，開燈要摸半天');
  put('pj-when', '距離小於 30 公分');
  put('pj-thenL', '燈條亮起來'); put('pj-thenM', '風扇開始轉');
  put('pj-elsL', '燈條熄掉'); put('pj-elsM', '風扇停下來');
  put('pj-trouble', '距離一直跳，燈會閃'); put('pj-fix', '改成兩個門檻');
  put('pj-learn', '數字會抖，門檻不能只設一個');
  /* 假一個 ASKAI：只認出兩點。 */
  W.ASKAI = { enabled: () => true,
              judge: () => Promise.resolve([{ i: 0, got: [J.AI_NEED[0].name,
                                                          J.AI_NEED[2].name] }]) };
  el7.querySelector('#pj-make').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(/AI 助教看一下/.test(el7.textContent), '★ 送出去的時候看得出在等（按鈕會變）');
  /* ⚠️ AI 是非同步的 —— 後面的斷言要等它回來，
     所以剩下的段落搬進 rest()，由這裡的 setTimeout 叫起來。 */
  setTimeout(function () {
    ok(!done7, '★★ AI 給建議的時候**還不出卡**');
    ok(/AI 助教的建議/.test(el7.textContent), '   而且講明這是建議');
    ok(/元件/.test(el7.textContent), '★★ 只列 AI 覺得沒做到的那一點');
    ok(!/真的會遇到的/.test(el7.textContent), '   做到的那兩點不囉嗦');
    ok(/再按一次就出卡/.test(el7.textContent), '★★ 而且講清楚「不改也可以」');
    el7.querySelector('#pj-make').dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(!!done7 && !!el7.querySelector('#pj-card'),
       '★★ 再按一次 → 出卡（AI 沒有否決權）');
    delete W.ASKAI;
    rest();
  }, 20);
}

function rest() {
section('★★ 檔名帶身分（老師 2026-08-25）');
{
  const b8 = W.document.createElement('div');
  W.document.body.appendChild(b8);
  const a8 = J.mount(b8, { who: '二年三班　13 號　王小明',
                           whoFile: '二年三班_13_王小明' });
  b8.querySelector('[data-pick="自動"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  a8.show('show');
  /* ⚠️ 檔名要**在表單上就先寫出來** —— 出卡之後才看到，
     學生已經沒在注意名字對不對了。 */
  ok(a8.fname() === '成果發表-二年三班_13_王小明.png', '★★ mount 有把身分帶進檔名');
  ok(/成果發表-二年三班_13_王小明\.png/.test(b8.textContent),
     '★★ 而且表單上就先寫出來（不是出卡才看到）');
  /* ⚠️ 顯示用的那一串和檔名**不是同一種格式** ——
     頁面各給一份，不要讓模組去反解字串。 */
  const page2 = read('11501/5016b.html');
  ok(/function fmtFile/.test(page2) && /whoFile: whoFile\(\)/.test(page2),
     '★★ 頁面另外給一份檔名格式（班級_座號_姓名）');
  ok(/\[me\.cls, me\.no, me\.name\].filter\(Boolean\).join\('_'\)/.test(page2),
     '★ 缺哪一段跳過哪一段（不會變成「__王小明」）');
  ok(/chkApi\.setWho\(t, fn\)/.test(page2), '★ 晚一步問到名冊時檔名也跟著補');
}

section('★★ 內容沒改就不再送 AI（老師 2026-08-25）');
{
  /* ⚠️ aiDone 只活在這一次掛載裡 —— 換個分頁回來、重新整理，
     同一份內容會**再送一次**，而額度是全班共用的。 */
  const base2 = { mode: '自動', problem: '玄關太暗', when: '距離小於 30 公分',
                  thenL: '亮起來', thenM: '轉起來', elsL: '熄掉', elsM: '停下來',
                  trouble: '燈會閃', fix: '兩個門檻', learn: '門檻要兩個' };
  ok(J.sig(base2) === J.sig(Object.assign({}, base2)), '★ 一樣的內容 → 一樣的指紋');
  ok(J.sig(base2) !== J.sig(Object.assign({}, base2, { learn: '改了' })),
     '★★ 改了一個字 → 指紋就不一樣');
  /* ⚠️ 指紋要算在**送出去的那段文字**上 ——
     改個模式、換個名字不算「內容變了」。 */
  ok(J.sig(base2) === J.sig(Object.assign({}, base2, { mode: '手動' })),
     '★★ 換模式不算內容變了（那段文字沒變）');
  const src6 = read('shared/projlab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/f\.aiSig && f\.aiSig === sig\(f\)/.test(src6),
     '★★ 內容和上次送審的一樣 → 直接出卡，不送');
  ok(/if \(!a\.skipped\) \{\n\s*f\.aiSig = sig\(f\);/.test(src6),
     '★★ 只有**真的送出去過**才記指紋（AI 不在時記了，恢復也不會再看）');
  /* ⚠️⚠️ 老師 2026-08-25：「每次重新進入都會看到『送給 AI 助教』，
     但是我沒有改字」。
     ★ 病根：「內容和上次一樣」那個判斷**只在按下按鈕時才算** ——
       畫面一載入，那行提示一定會出現，即使一個字都沒改。
     ⇒ 改成每次重畫都重算。 */
  ok(/function aiSeen\(\)/.test(src6) && /aiDone \|\| !!\(f\.aiSig/.test(src6),
     '★★ 「看過了沒」是**每次重畫都重算**，不是一個死變數');
  /* ⚠️ 而且要當下就存 —— 等出卡才存的話，
     學生看完建議跑去改字或直接關掉，指紋就沒留下來。 */
  ok(/opts\.onSave === 'function'/.test(src6), '★★ AI 看過就立刻回存指紋');
  ok(/onSave: function \(work\)/.test(read('11501/5016b.html')),
     '★ 頁面那端接起來');

  /* 走一遍：帶著上次的指紋進來 → 提示不該出現。 */
  const el9 = W.document.createElement('div');
  W.document.body.appendChild(el9);
  W.ASKAI = { enabled: () => true, judge: () => Promise.resolve([{ i: 0, got: [] }]) };
  const same = Object.assign({}, base2);
  same.aiSig = J.sig(base2);
  const a9 = J.mount(el9, { work: same });
  el9.querySelector('[data-pick="自動"]')
    .dispatchEvent(new W.Event('click', { bubbles: true }));
  a9.show('show');
  ok(a9.aiSeen(), '★★ 內容沒改 → 一進來就知道「看過了」');
  ok(/AI 助教看過這一版了/.test(el9.textContent) &&
     !/送出前 AI 助教會先看一遍/.test(el9.textContent),
     '★★ 所以畫面上寫「看過了」，不是「會先看一遍」');
  /* ⚠️⚠️ 那行提示要**跟著打字即時更新**。
     ★ 第一版只在重畫的時候算 —— 但 input 事件不重畫（重畫會讓輸入框失焦），
       所以學生改完字，畫面上還寫著「AI 助教看過這一版了」。
       他會以為不用再送，其實按下去是會送的。 */
  const box9 = el9.querySelector('#pj-learn');
  box9.value = '我改了一個字，門檻要兩個';
  box9.dispatchEvent(new W.Event('input', { bubbles: true }));
  ok(!a9.aiSeen(), '★★ 改了字 → 立刻知道「這一版還沒看過」');
  ok(/送出前 AI 助教會先看一遍/.test(el9.querySelector('#pj-ainote').textContent),
     '★★ 而且那行提示**當下就換回來**（不必等按按鈕）');
  /* ⚠️⚠️ 打字的時候**不可以整頁重畫** —— 輸入框會被換成新的元素，
     學生打到一半就失焦（第三節那顆旋鈕踩過同一族的坑）。
     ★ 測「字還在」抓不到這個：重畫會從資料重建，字確實還在。
       要測的是**元素還是不是同一個**。 */
  ok(el9.querySelector('#pj-learn') === box9,
     '★★ 打字之後輸入框**還是同一個元素**（重畫會讓人打到一半失焦）');
  W.document.body.removeChild(el9);
  delete W.ASKAI;
  ok(/aiSig: ''/.test(src6), '★ 指紋跟著作答一起存（下次載回來才記得）');
}

section('★ 規矩');
{
  const plan = read('shared/planlab.js'), proj = read('shared/projlab.js');
  ok(/if \(!global\.LABKIT\) throw new Error/.test(plan) &&
     /if \(!global\.LABKIT\) throw new Error/.test(proj),
     '★★ labkit 沒載到要明講（靜默半殘的症狀是「按了沒反應」）');
  /* ⚠️⚠️ 設計單在暖身、展示在下面 —— 兩支不可以互相呼叫。 */
  ok(!/PLANLAB/.test(proj), '★★ projlab 不直接呼叫 PLANLAB（相依只能單向）');
  ok(!/PROJLAB/.test(plan), '★★ planlab 也不知道 projlab');
  ok(!/PLANLAB|PROJLAB/.test(read('shared/labkit.js')), '★★ labkit 不知道它們的存在');
  ok(!/stars/.test(plan) && !/stars/.test(proj), '★★ 不碰 stars —— 5016B 不計星');
  /* ★ 顏色的算法在 labkit —— 第五節現在只有**複習盤**在用（燈條舞台收掉了）。 */
  ok(/LK\(\)\.hueRgb\(/.test(read('shared/planlab.js')) &&
     /LK\(\)\.hueRgb\(/.test(read('shared/rgblab.js')),
     '★★ 色相換顏色走 labkit（第四、五節同一份）');
  ok(!/function hueRgb\(/.test(proj) && !/function hueRgb\(/.test(read('shared/planlab.js')),
     '   兩支都沒有自己再寫一份');
}

section('★★ 第五節接上頁面了');
{
  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/planlab\.js"><\/script>/.test(page) &&
     /<script src="\.\.\/shared\/projlab\.js"><\/script>/.test(page), '頁面載入兩支');
  ok(/warm: 'PLANLAB', checks: 'PROJLAB', gate: false/.test(page),
     '★★ 第五節**不上鎖**（老師 2026-08-25：「第五課不用動手檢核」）');
  ok(/checkTitle: '🎛️ 兩種模式 ＋ 成果發表'/.test(page),
     '★★ 那一塊不叫「動手檢核」了');
  /* ⚠️⚠️ 這兩個標題原本寫死在 HTML 裡（「暖身關卡：超音波怎麼量距離」），
     所以第二～四節的暖身明明是換算／旋鈕／混色，標題都寫著超音波。 */
  ok(/id="warm-title"/.test(page) && /T\('warm-title', labCfg\.warmTitle\)/.test(page),
     '★★ 暖身標題跟著單元走（原本寫死，第二～四節都顯示「超音波怎麼量距離」）');
  ['距離怎麼換成亮度', '可變電阻怎麼接', '三盞燈怎麼混色', '專題設計單']
    .forEach(t => ok(page.indexOf(t) > 0, '   有「' + t + '」這個標題'));

  /* ⚠️ 界標要**切到課程資料結束為止**。第一版切到檔案結尾，
     於是頁尾那顆「返回基地按鈕」也被算成第五節的內容，
     「不可以出現按鈕」那條就永遠是紅的 —— 紅的不是第五節，是切法。 */
  const u5 = page.slice(page.indexOf('title: "自己的專案'),
                        page.indexOf('function openCourseDetail'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/狀態機|State Machine/.test(u5), '★★ 舊草稿那組（狀態機）已經清掉');
  ok(!/0, 1023, 0, 255/.test(u5), '★★ 舊草稿那個 (0,1023,0,255) 的色相 bug 也一併消失');
  /* ★★ 老師 2026-08-25：「只有四個喔」 */
  ok(/超音波距離感測器、可變電阻（旋鈕）、RGB 全彩燈條、直流馬達/.test(u5),
     '★★ 教材上的元件清單就那四樣，而且用的是統一過的全名');
  ok(!/按鈕|單顆 LED/.test(u5), '★★ 教材裡也不再出現按鈕或單顆 LED');
  /* ⚠️⚠️ 老師 2026-08-25：「一個輸入＋兩個輸出完成這個專案」。 */
  ok(!/第二個輸入|兩個輸入/.test(u5),
     '★★ 教材裡不再要求「第二個輸入」（自動用超音波、手動用旋鈕，輸入不換）');
  /* ⚠️ 要釘在**挑戰關那張卡上** —— 只要頁面某處有寫就算的話，
     卡片本身寫錯了也不會紅（第一版就是這樣，突變當場漏掉）。 */
  const card2 = u5.slice(u5.indexOf('② 挑戰關'), u5.indexOf('③ 創意關'));
  ok(/一個輸入 ＋ 兩個輸出/.test(card2),
     '★★ 挑戰關那張卡上就寫著「一個輸入 ＋ 兩個輸出」');
  ok(/第二個輸出/.test(card2) && !/第二個輸入/.test(card2),
     '★★ 而且只要求第二個**輸出**');
  ok(/超音波/.test(card2) && /旋鈕/.test(card2),
     '★ 卡片上就說明白輸入怎麼挑（自動用超音波、手動用旋鈕）');
  /* 三張任務卡留在教材區（不是關卡）。 */
  ok(/基礎關/.test(u5) && /挑戰關/.test(u5) && /創意關/.test(u5), '★★ 三張任務卡都在教材區');
  ok(/先讓它動/.test(u5) && /讓它更聰明/.test(u5) && /讓它解決問題/.test(u5),
     '★★ 三個副標一字不改');
  /* ⚠️ 老師 2026-08-25：「這句話也要修改，檢查是否還有需要調整的句子」——
     列印那條路拿掉之後，教材上那句「可以列印（另存 PDF）或下載成圖片」
     也得跟著改。★ 功能刪掉、文字沒跟上，比功能還在更糟：
       學生會去找一顆不存在的按鈕。 */
  ok(!/列印|另存 PDF/.test(u5), '★★ 教材上不再提列印／另存 PDF');
  ok(/下載成圖片/.test(u5) && /成果發表-班級_座號_姓名/.test(u5),
     '★★ 改成講「下載成圖片」，而且寫出檔名長什麼樣');
  ok(/我要解決的問題是/.test(u5) &&
     /當＿＿＿＿時，系統會＿＿＿＿；<b>否則<\/b>＿＿＿＿/.test(u5) &&
     /我遇到＿＿＿＿，最後用＿＿＿＿解決，<b>我學到<\/b>＿＿＿＿/.test(u5),
     '★★ 教材上的三句和模組一致（含否則、我學到）');
  ok(/每組都從基礎關開始/.test(u5), '★ 而且寫明「每組都從基礎關開始」');
  ok(/做自動的用超音波/.test(u5) && /做手動的用旋鈕/.test(u5),
     '★★ 講清楚輸入怎麼挑：自動用超音波、手動用旋鈕');
  ok(/否則/.test(u5) && /再也不會暗/.test(u5),
     '★★ 骨架裡點出「否則」不能省（第一節「門開了沒」的老問題）');
  ok(/1023/.test(u5) && /255/.test(u5) && /359/.test(u5),
     '★★ 卡關檢查表把三個範圍列出來（這門課最容易混的地方）');

  ok(/planRec = info\.plan/.test(page), '★★ 暖身做完把設計單存起來');
  ok(/line: planLine\(\)/.test(page), '★★ 掛下面那一塊時把那一句傳進去');
  ok(/save\.save\(UNIT, 'plan'/.test(page), '★ 設計單存進紀錄（每次覆寫 —— 改主意是正常的）');
  ok(/save\.save\(UNIT, 'work'/.test(page),
     '★★ 成果發表的內容也要存（電腦教室關機會還原，不存就要重打）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
}
