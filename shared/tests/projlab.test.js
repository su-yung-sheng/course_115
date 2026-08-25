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

section('★★ 兩種模式：同一組硬體，兩種玩法');
{
  ok(J.MODES.length === 2, '兩種模式');
  ok(J.MODES.map(m => m.key).join() === 'auto,manual', '★★ 自動／手動');
  ok(/超音波/.test(J.MODES[0].by) && /可變電阻|旋鈕/.test(J.MODES[1].by),
     '★★ 自動靠超音波、手動靠旋鈕');
  /* ⚠️ 兩種都要講**代價**，不然學生只會覺得「自動比較厲害」。 */
  ok(J.MODES.every(m => /⚠️/.test(m.good) && /★/.test(m.good)),
     '★★ 每一種都要講好處**和代價**（自動不用動手，但也叫不動它）');

  /* 自動：越近越亮、越近越多顆、越近轉越快。 */
  const far = J.autoOf(150), near = J.autoOf(5), edge = J.autoOf(J.NEAR + 1);
  ok(!far.near && far.on === 0 && far.speed === 0, '★ 遠的時候什麼都不動');
  ok(!edge.near, '★★ 剛好超過門檻（' + (J.NEAR + 1) + ' 公分）就不算「有人來了」');
  ok(J.autoOf(J.NEAR).near, '   剛好在門檻上算');
  /* ⚠️⚠️ 「貼著」不可以訂在感測器的最小值（2 公分）——
     超音波在那附近本來就量不準，而且手不可能貼那麼近，
     學生會**永遠拉不到整條亮**（第一版實測只亮到 7 顆）。 */
  ok(near.on === J.LEDS && near.speed > 80, '★★ 貼著（5 公分）就整條亮、轉最快');
  ok(J.autoOf(J.FULL).on === J.LEDS && J.autoOf(2).on === J.LEDS,
     '★★ 比 ' + J.FULL + ' 公分更近一樣是整條（不會因為量不準就掉一顆）');
  ok(J.autoOf(10).on > J.autoOf(25).on, '★ 越近亮越多顆（反向：距離小、數字大）');
  ok(J.autoOf(5).hue < J.autoOf(28).hue, '★ 越近越紅（色相往 0 走）');
  ok(J.autoOf(5).hue === 0, '   貼著的時候是純紅');

  /* 手動：旋鈕直接對應。 */
  ok(J.manualOf(0).on === 1 && J.manualOf(100).on === J.LEDS,
     '★★ 旋鈕兩端 → 第 1 顆／第 ' + J.LEDS + ' 顆（八顆都到得了）');
  ok(J.manualOf(0).hue === 0 && J.manualOf(100).hue === J.HUE_MAX,
     '★★ 色環 0～' + J.HUE_MAX + '（和第四節同一組）');
  /* ⚠️⚠️ 老師 2026-08-25：「風扇轉速 42% 數值應該是 -250 ~ 250」。
     ★ 對 —— 第三節的積木就是 類比對應(A7, −250, 250)。
       寫成百分比等於**自己發明了第五個範圍**
       （這門課已經有 1023／255／359 三個容易混的了）。 */
  ok(J.SPD === 250, '★ 轉速上限 250（第三節那一組）');
  ok(J.manualOf(50).speed === 0, '★★ 旋鈕正中間 → 轉速 0（停）');
  ok(J.manualOf(0).speed === -J.SPD && J.manualOf(100).speed === J.SPD,
     '★★ 兩端是 −' + J.SPD + ' 和 ' + J.SPD + '（不是百分比）');
  ok(J.manualOf(0).lo === -J.SPD, '★ 手動的下限是負的（要能反轉）');
  /* ★ 自動只往一邊轉 → 下限 0（第三節 B 講過的那個對照）。 */
  ok(J.autoOf(J.FULL).speed === J.SPD && J.autoOf(J.FULL).lo === 0,
     '★★ 自動模式只往一邊轉，下限是 0');
  ok(J.autoOf(150).speed === 0, '   遠的時候停著');
  /* 夾住 —— 滑桿以外的值不可以爆掉。 */
  ok(J.manualOf(-30).on === 1 && J.manualOf(300).on === J.LEDS, '   超出範圍會夾住');
  ok(J.autoOf(-5).near && J.autoOf(9999).near === false, '   距離也夾得住');
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
  ok(/我們要解決的問題是/.test(J.SHOW_Q[0].t), '★★ 第一句：我們要解決的問題是');
  ok(/當.*時，系統會/.test(J.SHOW_Q[1].t), '★★ 第二句：當＿＿時，系統會＿＿');
  ok(/我們遇到.*最後用.*解決/.test(J.SHOW_Q[2].t), '★★ 第三句：我們遇到＿＿，最後用＿＿解決');
  ok(J.SHOW_Q.every(q => q.ph && q.ph.length === q.slots.length), '   每一格都有範例');

  const v = { problem: '晚上回家玄關太暗', when: '有人走到門口一公尺內',
              then: '燈條慢慢亮成暖黃色', trouble: '距離一直跳，燈會閃',
              fix: '把門檻改成進 15 出 25 兩個數字' };
  ok(J.judgeShow(v).ok, '填滿 → 過');
  ok(!J.judgeShow(Object.assign({}, v, { then: '' })).ok, '   少一格 → 不過');
  ok(J.judgeShow(Object.assign({}, v, { then: '' })).miss.indexOf('then') >= 0,
     '★ 而且點名是哪一格');
  ok(/系統會/.test(J.sayShow(J.judgeShow(Object.assign({}, v, { then: '' })))),
     '★ 回饋要講出那一格的名字，不是只說「沒填完」');
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
}

section('★★ 成果卡：帶得走（老師 2026-08-25 追加）');
{
  const v = { problem: '玄關太暗', when: '有人靠近', then: '燈亮起來',
              trouble: '燈一直閃', fix: '加了兩個門檻' };
  const html = J.cardHtml(v, { scene: '玄關迎賓燈', team: '二年三班第 4 組',
                               mode: '自動', date: '2026/8/25' });
  ok(/玄關迎賓燈/.test(html) && /二年三班第 4 組/.test(html), '★ 卡片上有題目和組別');
  ok(/模式：自動/.test(html), '★★ 而且標出這一組做的是哪一種模式');
  ok(/我們要解決的問題是/.test(html) && /系統會/.test(html) && /最後用/.test(html),
     '★★ 三句話都在卡片上');
  /* ⚠️ 卡片上**每一格都是學生自己打的字**，全部都要跳脫。 */
  ['problem', 'when', 'then', 'trouble', 'fix'].forEach(k => {
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
  ok(/global\.print\(\)/.test(src), '★ 列印走瀏覽器原生（另存 PDF，中文一定正確）');
  ok(/@media print/.test(src) && /pj-printing/.test(src),
     '★★ 列印時只留成果卡（不然會印出整頁教材）');
  ok(/afterprint/.test(src) && /setTimeout\(clean/.test(src),
     '★★ 印完要把頁面還原，而且**留一個保險** —— 有些瀏覽器不發 afterprint，' +
     '不還原的話整頁會一直是空白的');
  ok(/toDataURL\('image\/png'\)/.test(src), '★ 另一條路：canvas 畫成 PNG（適合截圖／交作業）');
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

  ok(api.tab() === 'demo', '★ 一進來是兩種模式的展示（複習，不是關卡）');
  ok(/玄關迎賓燈/.test(el.textContent) && /15 公分/.test(el.textContent),
     '★★ 畫面上一直掛著設計單那一句');
  /* ⚠️ 老師：「第五課不用動手檢核」—— 兩塊都是開的，隨時可以來回。 */
  ok(!!el.querySelector('[data-tab="show"]'), '★★ 成果發表一開始就點得到（沒有鎖）');
  ok(api.mode() === 'auto' && !!el.querySelector('#pj-cm'), '   自動模式：拉距離');
  const litCount = () => [...el.querySelectorAll('.pj-led')]
    .filter(d => !/#1e293b|rgb\(30, 41, 59\)/.test(d.style.background)).length;
  /* ★ 自動模式也要看得到那張「人走過來」的圖。
     ⚠️ 而且拉滑桿時人**要真的跟著移動** —— 只換燈條的話，
        人站在原地不動，看起來就像壞掉（「找不到動畫」那一族）。 */
  const man = () => Number((el.innerHTML.match(/lk-dist-o" style="left:([\d.]+)%/) || [])[1]);
  ok(/lk-dist/.test(el.innerHTML) && /🧍/.test(el.innerHTML),
     '★★ 自動模式也畫出感測器和人');
  api.setCm(150);
  const farMan = man();
  ok(litCount() === 0, '★★ 拉遠 → **畫面上**全暗');
  api.setCm(J.FULL);
  ok(litCount() === J.LEDS, '★★ 拉近 → **畫面上**整條亮（實得 ' + litCount() + ' 顆）');
  ok(man() > farMan,
     '★★ 而且人真的跟著往右走（靠近感測器：' + farMan + '% → ' + man() + '%）');
  ok(/風扇轉速/.test(el.textContent), '★ 而且風扇也轉起來了（一個輸入、兩個輸出）');
  /* ⚠️ 拉滑桿時只換舞台那一塊 —— 整頁重畫會讓滑桿失焦（第三節踩過）。 */
  ok(!!el.querySelector('#pj-cm'), '   拉完滑桿還在');
  ok(/function paint\(\)[\s\S]{0,160}#pj-stage[\s\S]{0,60}innerHTML/.test(read('shared/projlab.js')),
     '★★ 只換舞台那一塊，不整頁重畫');

  el.querySelector('[data-mode="manual"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.mode() === 'manual' && !!el.querySelector('#pj-pct'), '★ 切到手動：改拉旋鈕');
  api.setPct(0);  ok(litCount() === 1, '★★ 手動只亮**一顆**（位置會跑，第二節那一招）');
  api.setPct(100); ok(litCount() === 1, '   轉到底還是一顆');
  ok(/色相/.test(el.textContent), '★ 而且顏色跟著換（第四節那一招）');

  /* ★ 學生要選一種當自己的作品。 */
  el.querySelector('[data-pick="手動"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.work().mode === '手動', '★★ 挑一種模式當自己的作品（不必兩種都做）');

  click('pj-go-show');
  ok(api.tab() === 'show' && !!el.querySelector('#pj-problem'), '★ 進到成果發表');
  set('pj-team', '二年三班第 4 組');
  set('pj-problem', '晚上回家玄關太暗，開燈要摸半天');
  set('pj-when', '有人走到門口三十公分內'); set('pj-then', '燈條慢慢亮成暖黃色');
  set('pj-trouble', '沒有'); set('pj-fix', '把門檻改成兩個數字');
  click('pj-make');
  ok(!done && /最值錢/.test(el.textContent), '★★ 第三句寫「沒有」→ 擋下來，不給出卡');
  set('pj-trouble', '距離一直跳，燈會閃個不停');
  set('pj-fix', '把門檻改成進 15 出 25 兩個數字');
  click('pj-make');
  ok(!!done, '★ 三句都寫好 → 產生成果卡');
  ok(!!el.querySelector('#pj-card'), '   卡片畫出來了');
  ok(/模式：手動/.test(el.querySelector('#pj-card').textContent),
     '★★ 卡片上帶著他選的模式');
  ok(!!el.querySelector('#pj-print') && !!el.querySelector('#pj-png'),
     '★★ 兩顆按鈕都在：列印／存成 PDF、下載成圖片');
  ok(/另存為 PDF/.test(el.textContent), '★ 而且教學生怎麼存成 PDF（在印表機那一欄選）');
  ok(!!done.work && done.work.problem, '★ 回報 onDone 時把整份內容帶出去（要存起來）');
  /* ⚠️ 回頭改的時候字要還在。 */
  click('pj-back');
  ok(el.querySelector('#pj-problem').value === '晚上回家玄關太暗，開燈要摸半天',
     '★★ 回去改的時候填過的字還在');
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
  /* ★ 顏色的算法在 labkit（第四、五節共用），不可以有兩份。 */
  ok(/LK\(\)\.hueRgb\(/.test(proj) && /LK\(\)\.hueRgb\(/.test(read('shared/rgblab.js')),
     '★★ 色相換顏色走 labkit（第四、五節同一份）');
  ok(!/function hueRgb\(h\) \{\n    var x/.test(proj), '   projlab 自己不再寫一份');
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
  /* 三張任務卡留在教材區（不是關卡）。 */
  ok(/基礎關/.test(u5) && /挑戰關/.test(u5) && /創意關/.test(u5), '★★ 三張任務卡都在教材區');
  ok(/先讓它動/.test(u5) && /讓它更聰明/.test(u5) && /讓它解決問題/.test(u5),
     '★★ 三個副標一字不改');
  ok(/我們要解決的問題是/.test(u5) && /當＿＿＿＿時，系統會＿＿＿＿/.test(u5) &&
     /我們遇到＿＿＿＿，最後用＿＿＿＿解決/.test(u5),
     '★★ 發表三句一字不改（老師指定）');
  ok(/每組都從基礎關開始/.test(u5), '★ 而且寫明「每組都從基礎關開始」');
  ok(/另外那一個/.test(u5),
     '★★ 講清楚「第二個輸入」就是把另外那一個也用上（教具只有四樣）');
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
