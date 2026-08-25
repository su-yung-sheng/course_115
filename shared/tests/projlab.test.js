/* 第五節「自己的專案」：設計單（planlab）＋ 分層任務卡與成果發表（projlab）
   跑法：node shared/tests/projlab.test.js   （需要 jsdom）

   ★ 老師 2026-08-25 指定的三關與發表三句，文字不可以改。
   ★ 過關方式：自我勾選＋**必須寫出證據**（老師選的）。

   ⚠️⚠️ 這一節電腦看不到硬體，所以「判定」唯一擋得住的就是**敷衍**：
      空白、太短、照抄設計單、「沒有遇到問題」。
      這一支測的就是那幾道門真的關得起來。 */
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

section('★★ 設計單：元件只列教具上真的有的');
{
  ok(P.INPUTS.length === 3 && P.OUTPUTS.length === 3, '三個輸入、三個輸出');
  ok(P.INPUTS.map(i => i.key).join() === 'btn,us,pot',
     '★★ 輸入＝按鈕／超音波／可變電阻（前四節用過的）');
  ok(P.OUTPUTS.map(o => o.key).join() === 'led,strip,moto',
     '★★ 輸出＝LED／RGB 燈條／馬達（前四節用過的）');
  /* ⚠️ 憑空多一個教具上沒有的，學生會找半天。 */
  ok(!/光敏|溫濕度|土壤|紅外線|蜂鳴/.test(JSON.stringify(P.INPUTS) + JSON.stringify(P.OUTPUTS)),
     '★★ 沒有偷渡教具上不存在的元件');
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
  /* ⚠️ 少一格就不算 —— 半張設計單等於沒有。 */
  ok(!P.planReady(Object.assign({}, full, { scene: '' })), '   沒選情境 → 不過');
  ok(!P.planReady(Object.assign({}, full, { value: '' })), '   沒填門檻 → 不過');
  ok(!P.planReady(Object.assign({}, full, { act: '' })), '   沒選動作 → 不過');
  /* 按鈕型沒有數字，改問「按一下還是按著」。 */
  const btn = { scene: '衣櫃感應燈', input: 'btn', output: 'led', act: '亮起來', press: '' };
  ok(!P.planReady(btn), '★ 按鈕型：沒選「按一下／按著」→ 不過');
  ok(P.planReady(Object.assign({}, btn, { press: 'tap' })), '   選了就過');
  ok(/按一下/.test(P.planLine(Object.assign({}, btn, { press: 'tap' }))),
     '   而且句子裡看得出來是哪一種');
  /* ★★ 門檻超出感測器讀得到的範圍 —— 永遠不會觸發，是最難查的錯。 */
  ok(/永遠不會觸發/.test(P.sayPlan(Object.assign({}, full, { value: '900' }))),
     '★★ 門檻填在範圍外 → 明講「永遠不會觸發」');
}

section('★★ 證據句：擋得住敷衍（這一節唯一的門）');
{
  const line = '如果　超音波距離小於 15 公分　那麼　RGB 全彩燈條就整條亮起指定顏色。';
  ok(J.judgeEvidence('把手放到感測器前面 10 公分', '燈條整條亮起來，手拿開就暗了', line).ok,
     '★ 寫得具體 → 過');
  ok(!J.judgeEvidence('', '', line).ok, '   空白 → 不過');
  ok(J.judgeEvidence('', '', line).how === 'empty', '   而且分得出是空白');
  ok(!J.judgeEvidence('有', '會亮', line).ok, '★ 太短 → 不過');
  ok(J.judgeEvidence('有', '會亮', line).how === 'short', '   分得出是太短');
  /* ⚠️⚠️ 照抄設計單是最常見的敷衍：那句話證明的是「我會複製」。 */
  const r = J.judgeEvidence('超音波距離小於 15 公分', 'RGB 全彩燈條就整條亮起指定顏色', line);
  ok(!r.ok && r.how === 'copy', '★★ 照抄設計單 → 擋下來');
  ok(/設計單/.test(J.sayEvidence(r)) && /實際操作/.test(J.sayEvidence(r)),
     '★★ 而且要講清楚「打算怎樣」和「實際發生什麼」是兩件事');
  ok(!J.judgeEvidence('把手放上去', '把手放上去', line).ok, '★ 兩格一模一樣 → 不過');
  const hows = ['empty', 'short', 'copy', 'same'].map(h => J.sayEvidence({ how: h }));
  ok(new Set(hows).size === 4, '★★ 四種回饋各不相同');
}

section('★★ 挑戰關：三件事都要交代');
{
  const good = { from: '15', to: '30', in2: '加一顆按鈕切換自動手動', out2: '再加一顆 LED 提醒' };
  ok(J.judgeLevel2(good).ok, '三件事都寫 → 過');
  ok(!J.judgeLevel2(Object.assign({}, good, { from: '' })).ok, '   沒寫改之前 → 不過');
  ok(!J.judgeLevel2(Object.assign({}, good, { in2: '' })).ok, '   沒寫第二個輸入 → 不過');
  ok(!J.judgeLevel2(Object.assign({}, good, { out2: '' })).ok, '   沒寫第二個輸出 → 不過');
  /* ⚠️ 改之前＝改之後 → 那就是沒調整。這種「有填但等於沒做」最容易漏掉。 */
  const same = J.judgeLevel2(Object.assign({}, good, { to: '15' }));
  ok(!same.ok && same.miss.indexOf('nochange') >= 0, '★★ 改之前和改之後一樣 → 擋下來');
  ok(/沒有調整/.test(J.sayLevel2(same)), '★★ 而且要點破「那就是沒有調整」');
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
  /* ⚠️⚠️ 「沒有遇到問題」是第三句最常見的敷衍，而那一格最值錢。 */
  /* ⚠️⚠️ 而且**短的那幾個也要判成 notrouble**，不可以只回「太短」——
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
  const html = J.cardHtml(v, { scene: '玄關迎賓燈', team: '2 年 3 班第 4 組', date: '2026/8/25' });
  ok(/玄關迎賓燈/.test(html) && /2 年 3 班第 4 組/.test(html), '★ 卡片上有題目和組別');
  ok(/我們要解決的問題是/.test(html) && /系統會/.test(html) && /最後用/.test(html),
     '★★ 三句話都在卡片上');
  /* ⚠️ 學生自己打的字要跳脫 —— 這是唯一會出現使用者輸入的地方。 */
  const bad = J.cardHtml(Object.assign({}, v, { problem: '<img src=x onerror=alert(1)>' }), {});
  ok(!/<img/.test(bad) && /&lt;img/.test(bad), '★★ 學生打的字有跳脫（這裡是使用者輸入）');
  /* ⚠️ 情境名稱和組別**也是學生自己打的**（設計單可以自訂情境）——
     第一版只測 problem 那一格，漏掉這兩個（突變測試當場抓到）。 */
  ['scene', 'team', 'line'].forEach(k => {
    const m = { scene: 'x', team: 'x', line: 'x' };
    m[k] = '<img src=x onerror=alert(1)>';
    const h = J.cardHtml(v, m);
    ok(!/<img/.test(h), '★★ ' + k + ' 也要跳脫（設計單的情境可以自訂）');
  });
  ['when', 'then', 'trouble', 'fix'].forEach(k => {
    const w = Object.assign({}, v); w[k] = '<img src=x onerror=alert(1)>';
    ok(!/<img/.test(J.cardHtml(w, {})), '   ' + k + ' 也要跳脫');
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

section('★★ 三關真的走得完，而且不能跳關');
{
  const el = W.document.getElementById('x');
  let done = null, said = null;
  const line = '如果　超音波距離小於 15 公分　那麼　RGB 全彩燈條就整條亮起指定顏色。';
  const api = J.mount(el, {
    line: line, plan: { scene: '玄關迎賓燈' },
    onDone: i => { done = i; }, onSay: (t, r) => { said = r; }
  });
  const set = (id, v) => {
    const e = el.querySelector('#' + id);
    if (e) { if (e.type === 'checkbox') e.checked = v; else e.value = v; }
    return !!e;
  };
  const click = id => el.querySelector('#' + id)
    .dispatchEvent(new W.Event('click', { bubbles: true }));

  ok(api.step() === 'L1', '★★ 一進來就是基礎關（老師：每組都從基礎關開始）');
  ok(/玄關迎賓燈/.test(el.textContent) && /15 公分/.test(el.textContent),
     '★★ 畫面上一直掛著設計單那一句（整節課的錨）');
  /* ⚠️ 不能跳關 —— **每一關都要試**，只試最後一關的話，
     「L2 忘了鎖」這種錯會整個漏掉（突變測試當場證實）。 */
  ['L2', 'L3', 'SHOW'].forEach(s => {
    el.querySelector('[data-go="' + s + '"]')
      .dispatchEvent(new W.Event('click', { bubbles: true }));
    ok(api.step() === 'L1', '★★ 基礎關還沒過，點「' + s + '」跳不過去');
  });

  /* ── L1：先不勾 → 擋 ── */
  set('pj-e1a', '把手放到感測器前面 10 公分');
  set('pj-e1b', '燈條整條亮起來，手拿開就暗了');
  click('pj-r1');
  ok(api.step() === 'L1' && /實際操作/.test(el.textContent),
     '★★ 沒勾「我操作過」→ 擋下來');
  set('pj-ok1', true);
  set('pj-e1a', '把手放到感測器前面 10 公分');
  set('pj-e1b', '燈條整條亮起來，手拿開就暗了');
  click('pj-r1');
  ok(api.step() === 'L2', '★ L1 完成 → 進到挑戰關');

  /* ── L2 ── */
  set('pj-from', '15'); set('pj-to', '15');
  set('pj-in2', '加一顆按鈕切換自動手動'); set('pj-out2', '再加一顆 LED 提醒');
  set('pj-ok2', true);
  set('pj-e2a', '按下按鈕切到手動'); set('pj-e2b', '提醒燈亮起來，距離就不管了');
  click('pj-r2');
  ok(api.step() === 'L2' && /沒有調整/.test(el.textContent),
     '★★ 數值前後一樣 → 擋下來');
  set('pj-from', '15'); set('pj-to', '30');
  set('pj-in2', '加一顆按鈕切換自動手動'); set('pj-out2', '再加一顆 LED 提醒');
  set('pj-ok2', true);
  set('pj-e2a', '按下按鈕切到手動'); set('pj-e2b', '提醒燈亮起來，距離就不管了');
  click('pj-r2');
  ok(api.step() === 'L3', '★ L2 完成 → 進到創意關');

  /* ── L3 ── */
  ok(!!el.querySelector('#dl-say'), '★ 創意關有「說明修改原因」的填空');
  set('pj-feat', '離開之後燈慢慢變暗');
  set('pj-test', '走進來停三秒再走開，看燈是不是花五秒才暗');
  set('pj-ok3', true);
  set('dl-say', '本來燈會突然全黑，走廊很嚇人，所以改成慢慢變暗比較安全');
  click('pj-r3');
  ok(api.step() === 'SHOW', '★★ 三關都過 → 進到成果發表');
  ok(!!said, '   而且回報 onSay（老師看得到全班怎麼說）');
  /* ★ 走回頭路要放行 —— 學生本來就會回去改。 */
  el.querySelector('[data-go="L1"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.step() === 'L1', '★ 已經過的關卡可以回去改');
  ok(el.querySelector('#pj-e1a').value === '把手放到感測器前面 10 公分',
     '★★ 而且回去的時候**填過的字還在**（不然沒人敢回頭改）');
  /* ⚠️⚠️ 回頭看一眼之後**要回得去成果發表** ——
     第一版的規則是「只能往回走」，結果三關都過的人一點基礎關就被鎖死，
     而且那個分頁看起來還是可以點的，按了卻沒反應（測試當場抓到）。 */
  el.querySelector('[data-go="SHOW"]').dispatchEvent(new W.Event('click', { bubbles: true }));
  ok(api.step() === 'SHOW', '★★ 回頭看過之後，還回得去成果發表（不可以被鎖死）');

  /* ── 成果發表 ── */
  set('pj-team', '2 年 3 班第 4 組');
  set('pj-problem', '晚上回家玄關太暗，開燈要摸半天');
  set('pj-when', '有人走到門口一公尺內'); set('pj-then', '燈條慢慢亮成暖黃色');
  set('pj-trouble', '沒有'); set('pj-fix', '把門檻改成兩個數字');
  click('pj-make');
  ok(!done && /最值錢/.test(el.textContent), '★★ 第三句寫「沒有」→ 擋下來，不給出卡');
  set('pj-trouble', '距離一直跳，燈會閃個不停');
  set('pj-fix', '把門檻改成進 15 出 25 兩個數字');
  click('pj-make');
  ok(!!done, '★ 三句都寫好 → 產生成果卡');
  ok(!!el.querySelector('#pj-card'), '   卡片畫出來了');
  ok(!!el.querySelector('#pj-print') && !!el.querySelector('#pj-png'),
     '★★ 兩顆按鈕都在：列印／存成 PDF、下載成圖片');
  ok(/另存為 PDF/.test(el.textContent), '★ 而且教學生怎麼存成 PDF（在印表機那一欄選）');
  ok(!!done.work && done.work.problem, '★ 回報 onDone 時把整份內容帶出去（要存起來）');
}

section('★ 規矩');
{
  const plan = read('shared/planlab.js'), proj = read('shared/projlab.js');
  ok(/if \(!global\.LABKIT\) throw new Error/.test(plan) &&
     /if \(!global\.LABKIT\) throw new Error/.test(proj),
     '★★ labkit 沒載到要明講（靜默半殘的症狀是「按了沒反應」）');
  /* ⚠️⚠️ 設計單在暖身、任務卡在檢核 —— 兩支不可以互相呼叫。 */
  ok(!/PLANLAB/.test(proj), '★★ projlab 不直接呼叫 PLANLAB（相依只能單向）');
  ok(!/PROJLAB/.test(plan), '★★ planlab 也不知道 projlab');
  ok(!/PLANLAB|PROJLAB/.test(read('shared/labkit.js')), '★★ labkit 不知道它們的存在');
  ok(!/stars/.test(plan) && !/stars/.test(proj), '★★ 不碰 stars —— 5016B 不計星');
  ok(/LK\(\)\.reviewSay\(/.test(proj), '★ AI 覆核走 labkit');
  ok(!/global\.ASKAI/.test(proj), '★★ 自己不碰 ASKAI');
  ok(/unit: '5016b-u5-L3'/.test(proj), '   AI 覆核標明是哪一關');
}

section('★★ 第五節接上頁面了');
{
  const page = read('11501/5016b.html');
  ok(/<script src="\.\.\/shared\/planlab\.js"><\/script>/.test(page) &&
     /<script src="\.\.\/shared\/projlab\.js"><\/script>/.test(page), '頁面載入兩支');
  ok(/lab: \{ unit: 'u5', warm: 'PLANLAB', checks: 'PROJLAB' \}/.test(page),
     '★ 第五節：設計單當進場券，任務卡當檢核');
  /* ⚠️ 又要剝註解：我在程式碼裡寫了「舊草稿（狀態機…）已整塊清掉」，
     不剝的話這兩條永遠是紅的（同一輪裡第二次踩到）。 */
  const u5 = page.slice(page.indexOf('title: "自己的專案'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  /* ⚠️ 舊草稿（狀態機／自動手動）裡把燈條色相寫成 0~255，整塊已清掉。 */
  ok(!/狀態機|State Machine/.test(u5), '★★ 舊草稿那組（狀態機）已經清掉');
  ok(!/0, 1023, 0, 255/.test(u5), '★★ 舊草稿那個 (0,1023,0,255) 的色相 bug 也一併消失');
  /* 老師指定的三關名稱與發表三句，文字不可以改。 */
  ok(/基礎關/.test(u5) && /挑戰關/.test(u5) && /創意關/.test(u5), '★★ 三張任務卡都在');
  ok(/先讓它動/.test(u5) && /讓它更聰明/.test(u5) && /讓它解決問題/.test(u5),
     '★★ 三個副標一字不改');
  ok(/我們要解決的問題是/.test(u5) && /當＿＿＿＿時，系統會＿＿＿＿/.test(u5) &&
     /我們遇到＿＿＿＿，最後用＿＿＿＿解決/.test(u5),
     '★★ 發表三句一字不改（老師指定）');
  ok(/每組都從基礎關開始/.test(u5), '★ 而且寫明「每組都從基礎關開始」');
  /* ★ 骨架虛擬碼要提醒「否則」—— 第一節那個老問題。 */
  ok(/否則/.test(u5) && /再也不會暗/.test(u5),
     '★★ 骨架裡點出「否則」不能省（第一節「門開了沒」的老問題）');
  ok(/1023/.test(u5) && /255/.test(u5) && /359/.test(u5),
     '★★ 卡關檢查表把三個範圍列出來（這門課最容易混的地方）');

  /* 設計單要傳得到任務卡 —— ⚠️ 由頁面當中間人，不是模組互相呼叫。 */
  ok(/planRec = info\.plan/.test(page), '★★ 暖身做完把設計單存起來');
  ok(/line: planLine\(\)/.test(page), '★★ 掛任務卡時把那一句傳進去');
  ok(/save\.save\(UNIT, 'plan'/.test(page), '★ 設計單存進紀錄（每次覆寫 —— 改主意是正常的）');
  ok(/save\.save\(UNIT, 'work'/.test(page),
     '★★ 任務卡的內容也要存（電腦教室關機會還原，不存就要重打）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
