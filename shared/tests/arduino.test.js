/* Arduino 智慧專題（11502 延伸挑戰）：五節課 PBL
   跑法：node shared/tests/arduino.test.js

   ★ 這一支和上學期那份「智慧家居」最大的差別是**不指定硬體**。
     PBL 的重點是「為了解決這個問題，我需要什麼」——
     先給零件清單就變成「這些零件可以做什麼」，方向剛好相反。
   ⚠️ 所以這一份最要緊的幾條，都在釘「不要退回成照著做的課」：
        · 前三節不可以出現接線與型號
        · 問題庫裡一定要留做不到的問題（判斷力才是要教的）
        · 測試情境一定要有「不該動」的那一種 */
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
const SRC = fs.readFileSync(path.join(ROOT, '11502', '5016b.html'), 'utf8');

/** 開一份新的頁面，回傳 document 與小工具 */
function open() {
  const dom = new JSDOM(SRC, { runScripts: 'dangerously', pretendToBeVisual: true });
  const D = dom.window.document, W = dom.window;
  const ev = el => el.dispatchEvent(new W.Event('input'));
  const $ = s => D.querySelector(s);
  const all = s => [...D.querySelectorAll(s)];
  const find = (s, re) => all(s).filter(b => re.test(b.textContent))[0];
  return { D, W, ev, $, all, find };
}

section('★ 改名：智慧家居 → 智慧專題');
{
  ok(/<title>Arduino 智慧專題/.test(SRC), '頁面標題是「智慧專題」');
  const hub = fs.readFileSync(path.join(ROOT, '11502', 'hub.html'), 'utf8');
  ok(/title:'Arduino 智慧專題'/.test(hub), '★ 入口卡片也改了（不然兩邊叫法不同）');
  /* ⚠️ 去掉註解再比對 —— 註解裡正好會解釋「為什麼從家居改成專題」。
     這是這個 repo 一再踩到的坑：「不可以再出現」的檢查一律先去註解。 */
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  ok(!/智慧家居/.test(code), '★ 畫面上沒有殘留「智慧家居」');
  const hubCode = hub.replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(!/智慧家居/.test(hubCode), '   入口也沒有殘留');
  ok(/11501/.test(SRC) && /照著做/.test(SRC),
     '★ 檔案開頭寫明和 11501 那一支的差別（不然下一個人會以為是重複的）');
}

section('★ 五節課的骨架');
{
  const { all, $ } = open();
  const names = all('.lsn').map(b => b.textContent.trim());
  ok(names.length === 5, '五節都畫出來了');
  ok(/找問題/.test(names[0]) && /拆解/.test(names[1]) && /選元件/.test(names[2]) &&
     /做原型/.test(names[3]) && /發表/.test(names[4]),
     '★ 順序是：找問題 → 拆解 → 選元件 → 做原型 → 發表（' + names.join('／') + '）');
  ok(/第 1 節/.test($('#app').textContent), '一進來停在第 1 節');
}

section('★★ 不指定硬體 —— 前三節不可以出現接線與型號');
{
  /* ⚠️ 這是這一支和上學期最大的差別。
     出現型號的那一刻，學生就從「我要解決什麼」變成「這顆能做什麼」。
     ★ 型號留到第 5 節真的要做實體時才提 —— 那時候查得到。 */
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');
  ['HC-SR04', 'L298N', 'WS2812', 'Trig', 'Echo', 'PWM', '接腳', '杜邦'].forEach(t => {
    ok(code.indexOf(t) < 0, '★ 沒有出現「' + t + '」（型號與接線不是這五節的事）');
  });
  ok(/不給型號|不指定硬體|不規定你要用哪個零件/.test(SRC),
     '★★ 而且畫面上要**講明**為什麼不給 —— 不講的話學生會以為是漏掉了');
  ok(/查得到|再查/.test(SRC), '   同時要告訴他「型號查得到」，不是不重要');
}

section('★★ 問題庫要留做不到的問題');
{
  /* ★ 學生要學的不是「選對」，是**判斷一個問題做不做得出來**。
     全部都做得到的話，那一節就變成點一下就過。 */
  const { find, $ } = open();
  const bad = find('[data-p]', /書包/);
  ok(!!bad, '問題庫裡有「書包忘了帶課本」這種做不到的');
  bad.onclick();
  ok(/卡在/.test($('#say').textContent),
     '★★ 選到做不到的 → 要講清楚**卡在哪一步**，不是只說不行');
  ok(/感測/.test($('#say').textContent), '   而且要指出是感測不到（不是驅動不了）');
  ok(!$('#go-next'), '★ 選了做不到的就不給往下走');

  const good = find('[data-p]', /走廊/);
  good.onclick();
  ok(/做得到/.test($('#say').textContent), '選到做得到的 → 放行');
  ok(!!$('#go-next'), '   而且出現往下走的按鈕');
}

section('★ 第 2 節：拆成感測 → 判斷 → 驅動');
{
  const { find, $, ev } = open();
  find('[data-p]', /走廊/).onclick();
  $('#go-next').onclick();
  ok(/感測/.test($('#app').textContent) && /驅動/.test($('#app').textContent),
     '講明三步是感測 → 判斷 → 驅動');
  ok(/如果|那麼/.test($('#app').textContent),
     '★ 而且接回 Scratch 的「如果…那麼」—— 學生已經會的東西');
  ok(!$('#go-next'), '三格還沒填完 → 不給往下走');

  ['f-sense', 'f-cond', 'f-act'].forEach((id, i) => {
    $('#' + id).value = ['走廊亮不亮', '很暗', '開燈'][i];
    ev($('#' + id));
  });
  const pv = $('#f-preview').textContent.replace(/\s+/g, ' ');
  ok(/走廊亮不亮/.test(pv) && /很暗/.test(pv) && /開燈/.test(pv),
     '★ 三格會即時組成一段程式的樣子（' + pv.trim().slice(0, 40) + '）');
  ok(!!$('#go-next'), '三格填完 → 放行');
}

section('★ 第 3 節：元件用「感覺得到什麼」分類，不是型號');
{
  const { find, $, ev, all } = open();
  find('[data-p]', /走廊/).onclick(); $('#go-next').onclick();
  ['f-sense', 'f-cond', 'f-act'].forEach((id, i) => {
    $('#' + id).value = ['亮不亮', '很暗', '開燈'][i]; ev($('#' + id));
  });
  $('#go-next').onclick();
  ok(/感測器/.test($('#app').textContent) && /致動器/.test($('#app').textContent),
     '分成感測器（五官）與致動器（手腳）');
  ok(all('[data-part]').every(b => /感覺得到|：/.test(b.textContent)),
     '★ 每張元件卡都寫「它感覺得到什麼」，不是寫型號');
  ok(!$('#go-next'), '還沒挑 → 不放行');

  find('[data-part]', /光線/).onclick();
  ok(/還差一個致動器/.test($('#say').textContent),
     '★ 只挑感測器 → 明講還差什麼（不是靜靜不放行）');
  find('[data-part]', /燈（LED/).onclick();
  ok(!!$('#go-next'), '兩邊都挑了 → 放行');
  ok(/真的感覺得到/.test($('#say').textContent),
     '★ 而且提醒他回頭想「這個感測器真的感覺得到嗎」');
}

section('★★ 第 4 節：測試情境一定要有「不該動」的那一種');
{
  /* ⚠️ 只測「該動的時候動不動」的話，門檻設 0 也會過 ——
     那學生學到的是「讓它動」，不是「讓它在對的時候動」。 */
  const { find, $, ev, all } = open();
  find('[data-p]', /走廊/).onclick(); $('#go-next').onclick();
  ['f-sense', 'f-cond', 'f-act'].forEach((id, i) => {
    $('#' + id).value = ['亮不亮', '很暗', '開燈'][i]; ev($('#' + id));
  });
  $('#go-next').onclick();
  find('[data-part]', /光線/).onclick();
  find('[data-part]', /燈（LED/).onclick();
  $('#go-next').onclick();

  const txt = $('#app').textContent;
  ok(/不應該/.test(txt), '★★ 情境裡有「這時候**不應該**動」的那一種');
  ok(/會動.*不算|不該動的時候不動/.test(txt),
     '★★ 而且開宗明義說「會動不算成功」');
  ok(!$('#go-next'), '還沒測 → 不放行');

  const v = $('#v');
  [80, 15].forEach(x => { v.value = x; ev(v); });
  ok(!$('#go-next'), '   只測兩個還不夠（第三個是要他自己決定的那一個）');
  v.value = 40; ev(v);
  ok(!!$('#go-next'), '★ 三個都測過 → 放行');
  const marks = all('#cases > div').map(x => (x.textContent.match(/✅|❌|🤔/) || [''])[0]);
  ok(marks[0] === '✅' && marks[1] === '✅', '   前兩個判定對了');
  ok(marks[2] === '🤔', '★ 第三個（門檻附近）不判對錯 —— 那是他的設計決定');

  /* 門檻設錯要抓得到 */
  const w = open();
  w.find('[data-p]', /走廊/).onclick(); w.$('#go-next').onclick();
  ['f-sense', 'f-cond', 'f-act'].forEach((id, i) => {
    w.$('#' + id).value = ['亮不亮', '很暗', '開燈'][i]; w.ev(w.$('#' + id));
  });
  w.$('#go-next').onclick();
  w.find('[data-part]', /光線/).onclick(); w.find('[data-part]', /燈（LED/).onclick();
  w.$('#go-next').onclick();
  w.$('#on').value = 95; w.ev(w.$('#on'));         // 門檻拉到 95 → 白天也會亮
  w.$('#v').value = 80; w.ev(w.$('#v'));
  ok(/不對/.test(w.$('#say').textContent) || /❌/.test(w.$('#cases').textContent),
     '★★ 門檻設錯（白天也會亮）→ 抓得到，不會放行');
  ok(!w.$('#go-next'), '   而且真的擋住');
}

section('★ 第 5 節：作品卡把前四節串起來');
{
  const { find, $, ev, all } = open();
  find('[data-p]', /走廊/).onclick(); $('#go-next').onclick();
  ['f-sense', 'f-cond', 'f-act'].forEach((id, i) => {
    $('#' + id).value = ['走廊亮不亮', '很暗而且有人', '把燈打開'][i]; ev($('#' + id));
  });
  $('#go-next').onclick();
  find('[data-part]', /光線/).onclick(); find('[data-part]', /燈（LED/).onclick();
  $('#go-next').onclick();
  const v = $('#v');
  [80, 15, 40].forEach(x => { v.value = x; ev(v); });
  $('#go-next').onclick();

  const card = $('.border-indigo-200').textContent.replace(/\s+/g, ' ');
  ok(/走廊晚上沒人卻整晚亮著/.test(card), '★ 作品卡帶著第 1 節選的問題');
  ok(/走廊亮不亮/.test(card) && /很暗而且有人/.test(card) && /把燈打開/.test(card),
     '★ 帶著第 2 節寫的三步');
  ok(/光線感測器/.test(card) && /燈/.test(card), '★ 帶著第 3 節挑的元件');
  ok(/小於 40|大於 40/.test(card), '★ 帶著第 4 節設的門檻');

  ok(!$('#note').value, '設計說明一開始是空的');
  const t = $('#note');
  t.value = '一開始設 60 白天也會亮，改成 30 才正常'; ev(t);
  ok(/完成/.test($('#say').textContent), '★ 寫了十個字以上才算完成');
  ok(/同學/.test($('#say').textContent),
     '★ 完成之後要他去找同學看 —— 作品要有人看得懂才算做完');

  /* 兩種交法都要講到（老師 2026-08-12 決定） */
  ok(/模擬器版/.test($('#app').textContent) && /實體版/.test($('#app').textContent),
     '★★ 兩種交法都寫出來（模擬器版全班都交得出來、實體版給有器材的組）');
  ok(/還沒接上傳/.test($('#app').textContent),
     '   而且老實講「目前還沒接上傳」，不要讓學生按一顆假的按鈕');
}

section('★ 五節可以來回跑，不鎖');
{
  /* ⚠️ PBL 本來就會來回 —— 做到第 4 節發現問題不對，要回得去第 1 節改。
     鎖住的話他只能整個重開。 */
  const { find, $, all } = open();
  find('[data-p]', /走廊/).onclick(); $('#go-next').onclick();
  all('.lsn')[0].onclick();
  ok(/第 1 節/.test($('#app').textContent), '★ 點得回前面的節次');
  ok(all('.lsn').every(b => !b.disabled), '★ 五節都沒有被 disabled');

  /* 但跳過前面直接點後面，要講清楚要回哪一節 —— 不能留白畫面 */
  const w = open();
  w.all('.lsn')[3].onclick();
  ok(/回第/.test(w.$('#app').textContent),
     '★ 跳著點到還做不了的那一節 → 明講要回哪一節（不是空白）');
  ok(!!w.$('#go-back'), '   而且給一顆按鈕直接回去');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
