/* Arduino 智慧專題（11502 延伸挑戰）：五張課程小卡
   跑法：node shared/tests/arduino.test.js

   ★ 版面沿用 11501/5016b.html —— 五張卡 → 點進去是
     【學習目標 ｜ 這一節要決定的事 ｜ 互動體驗區 ｜ 積木邏輯】。
     所以這一份有一段在比對「兩學期的骨架是不是真的一樣」：
     骨架走鐘的話，學生要重新學怎麼用這個頁面。

   ⚠️ 內容上最要緊的幾條，都在釘「不要退回成照著做的課」：
        · 不可以出現接線與型號
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
const SRC01 = fs.readFileSync(path.join(ROOT, '11501', '5016b.html'), 'utf8');
/** 去掉註解的版本 —— 「不可以再出現」的檢查一律用這個。
    ⚠️ 註解裡正好會解釋「為什麼從家居改成專題」「為什麼不給型號」，
       忘了去註解就會自己打自己。 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

/** 開一份新的頁面。
    ⚠️ Tailwind 和 Lucide 是 CDN，jsdom 不會去載 —— 要自己補一個空殼，
       不然 lucide.createIcons() 一叫就整頁掛掉。 */
function open() {
  const dom = new JSDOM(SRC, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.lucide = { createIcons: function () {} };
      w.tailwind = {};
      w.scrollTo = function () {};
    }
  });
  const D = dom.window.document, W = dom.window;
  const $ = s => D.querySelector(s);
  const all = s => [...D.querySelectorAll(s)];
  const ev = el => el.dispatchEvent(new W.Event('input'));
  const pg = () => $('#interactive-playground');
  const find = (s, re) => [...pg().querySelectorAll(s)].filter(b => re.test(b.textContent))[0];
  const go = n => W.openCourseDetail(n);
  return { D, W, $, all, ev, find, pg, go };
}

section('★ 改名：智慧家居 → 智慧專題');
{
  ok(/<title>Arduino 智慧專題/.test(SRC), '頁面標題是「智慧專題」');
  const hub = fs.readFileSync(path.join(ROOT, '11502', 'hub.html'), 'utf8');
  ok(/title:'Arduino 智慧專題'/.test(hub), '★ 入口卡片也改了（不然兩邊叫法不同）');
  /* ⚠️ 不是「整份都不能出現智慧家居」——
     hero 裡那句「上學期照著做的是同一個智慧家居」是**刻意**留的對比，
     學生要知道這學期和上學期差在哪。
     要釘的是：這一頁**自稱**的地方（標題列、頁尾、footer）不可以再叫智慧家居。 */
  ok(!/<title>[^<]*智慧家居/.test(SRC), '★ 標題沒有殘留「智慧家居」');
  const nav = (SRC.match(/<nav[\s\S]*?<\/nav>/) || [''])[0];
  const foot = (SRC.match(/<footer[\s\S]*?<\/footer>/) || [''])[0];
  ok(!/智慧家居/.test(nav) && /Arduino 智慧專題/.test(nav), '★ 上方標題列改好了');
  ok(!/智慧家居/.test(foot) && /Arduino 智慧專題/.test(foot), '★ 頁尾也改好了');
  ok(/上學期[^。]*智慧家居/.test(SRC),
     '★ 但保留一句對比 —— 學生要知道這學期和上學期差在哪');
  ok(!/智慧家居/.test(hub.replace(/\/\*[\s\S]*?\*\//g, ' ')), '   入口也沒有殘留');
  ok(/11501/.test(SRC) && /照著做/.test(SRC),
     '★ 檔案開頭寫明和 11501 那一支的差別（不然下一個人會以為是重複的）');
}

section('★★ 骨架要和 11501 一樣（學生不必重新學怎麼用）');
{
  /* ⚠️ 這一段是這次改版的起點：本來寫成一頁式的逐步精靈，
     和上學期完全不同 —— 老師要的是同一個模版。 */
  ['id="about"', 'id="curriculum"', 'id="detail-view"', 'id="detail-badge"',
   'id="detail-title"', 'id="detail-desc"', 'id="detail-objectives"',
   'id="detail-materials"', 'id="interactive-playground"', 'id="detail-demo-container"']
    .forEach(k => ok(SRC.indexOf(k) >= 0 && SRC01.indexOf(k) >= 0,
                     '★ 兩學期都有 ' + k));
  ['openCourseDetail', 'closeCourseDetail', 'scrollToCurriculum', 'clearAnimations']
    .forEach(f => ok(SRC.indexOf('function ' + f) >= 0 && SRC01.indexOf('function ' + f) >= 0,
                     '   兩學期都有 ' + f + '()'));
  ok(/unit-card/.test(SRC), '用的是同一組 .unit-card 樣式');
  ok(/href="hub.html"/.test(SRC), '★ 保留「返回基地」（少了學生會回不去）');
  ok(/shared\/guard\.js/.test(SRC), '★ 保留身分守門');
}

section('★ 五張課程小卡');
{
  const { all, $ } = open();
  const cards = all('.unit-card');
  ok(cards.length === 5, '總覽上有五張卡（實際 ' + cards.length + '）');
  const titles = cards.map(c => c.querySelector('h3').textContent.trim());
  ok(/找問題/.test(titles[0]) && /拆解/.test(titles[1]) && /選元件/.test(titles[2]) &&
     /做原型/.test(titles[3]) && /發表/.test(titles[4]),
     '★ 順序：找問題 → 拆解 → 選元件 → 做原型 → 發表');
  ok(cards.every((c, i) => c.getAttribute('onclick') === 'openCourseDetail(' + (i + 1) + ')'),
     '★ 五張都點得開，而且編號沒有接錯');
  ok(/lg:col-span-2/.test(cards[4].className), '   第五節是總結，跨兩欄（同 11501）');
  ok($('#detail-view').classList.contains('hidden'), '一進來詳細頁是收起來的');
  ok(cards.every(c => /含.{2,12}(器|台|盤)/.test(c.textContent)),
     '★ 每張卡都標了裡面有什麼互動（學生才知道值得點進去）');
}

section('★ 點開／關閉：詳細頁換得對，也回得來');
{
  const { $, go, W } = open();
  go(3);
  ok(!$('#detail-view').classList.contains('hidden'), '點第三節 → 詳細頁出現');
  ok($('#about').classList.contains('hidden'), '   首屏收起來');
  ok(/第三節課/.test($('#detail-badge').textContent), '   徽章是第三節');
  ok(/選元件/.test($('#detail-title').textContent), '   標題是選元件');
  ok($('#detail-objectives').children.length === 3, '   學習目標三條');
  ok($('#detail-materials').children.length === 3, '   「要決定的事」三條');
  ok($('#interactive-playground').children.length > 0, '★ 互動區有東西（不是空的）');
  ok($('#detail-demo-container').children.length > 0, '★ 右邊的說明也有東西');

  go(1);
  ok(/找問題/.test($('#detail-title').textContent), '★ 直接切到第一節，內容整個換掉');
  ok(!/選元件/.test($('#detail-title').textContent), '   沒有殘留上一節的標題');

  W.closeCourseDetail();
  ok($('#detail-view').classList.contains('hidden'), '★ 關掉之後回到總覽');
  ok($('#interactive-playground').innerHTML === '', '   互動區清乾淨（不然回來會疊兩份）');
}

section('★★ 不指定硬體 —— 不可以出現接線與型號');
{
  /* ⚠️ 這是這一支和上學期最大的差別。
     出現型號的那一刻，學生就從「我要解決什麼」變成「這顆能做什麼」。 */
  ['HC-SR04', 'L298N', 'WS2812', 'Trig', 'Echo', 'PWM', '接腳', '杜邦', '麵包板']
    .forEach(t => ok(CODE.indexOf(t) < 0, '★ 沒有出現「' + t + '」'));
  ok(SRC01.indexOf('HC-SR04') > 0,
     '   （對照：上學期本來就有型號 —— 那一支是照著做，給型號是對的）');
  ok(/不指定硬體/.test(SRC), '★★ 而且畫面上要**講明**不給 —— 不講的話學生會以為是漏掉了');
  ok(/查得到/.test(SRC), '   同時告訴他「型號查得到」，不是不重要');
  ok(/使用硬體模組/.test(SRC01) && !/使用硬體模組/.test(CODE),
     '★ 上學期那欄「使用硬體模組」換成「這一節你要決定的事」');
  ok(/這一節你要決定的事/.test(SRC), '   標題確實換了');
}

section('★★ 第一節：問題庫要留做不到的問題');
{
  /* ★ 學生要學的不是「選對」，是**判斷一個問題做不做得出來**。
     全部都做得到的話，這一節就變成隨便點一個。 */
  const { go, pg, find } = open();
  go(1);
  const bad = find('[data-p]', /書包|課本/);
  ok(!!bad, '問題庫裡有「早上出門常常忘了帶課本」這種做不到的');
  bad.onclick();
  const say = () => pg().querySelector('#prob-say');
  ok(/做不到/.test(say().textContent), '★★ 選到做不到的 → 明講做不到');
  ok(/卡在/.test(say().textContent) && /感測/.test(say().textContent),
     '★★ 而且講清楚**卡在哪一步**（感測不到，不是驅動不了）');
  ok(/改題目|重量/.test(say().textContent),
     '★ 還要給一條改法 —— 「先別換題目，先改題目」');

  find('[data-p]', /講話/).onclick();
  ok(/判斷/.test(say().textContent),
     '★ 第二個做不到的卡在**判斷**（不是感測）—— 兩種卡法都讓學生遇到');

  const good = find('[data-p]', /走廊/);
  good.onclick();
  ok(/做得到/.test(say().textContent), '選到做得到的 → 說做得到');
  ok(/pick-on/.test(good.className) && !/pick-on/.test(bad.className),
     '★ 選起來的那張看得出被選中，而且只有一張');
}

section('★ 第二節：三步拆解，即時變成積木');
{
  const { go, pg, ev, $ } = open();
  go(2);
  const t = $('#detail-demo-container').textContent;
  ok(/那麼/.test(t) && /否則/.test(t), '右邊講「那麼」和「否則」的差別');
  ok(/小鳥吃蟲/.test(t), '★ 接回第 4 關小鳥吃蟲 —— 學生已經學過的東西');
  ok(/需要復原嗎/.test(t), '★ 給一條判準（要不要否則），不是只列兩種寫法');

  const q = s => pg().querySelector(s);
  ok(/還沒在第一節選題目/.test(q('#p2-from').textContent),
     '★ 沒選題目就進來 → 明講要回第一節（不是留白）');
  ['#f-sense', '#f-cond', '#f-act'].forEach((id, i) => {
    q(id).value = ['走廊亮不亮', '很暗而且有人', '把燈打開'][i]; ev(q(id));
  });
  const pv = q('#f-preview').textContent.replace(/\s+/g, ' ');
  ok(/一直重複/.test(pv) && /如果/.test(pv) && /那麼/.test(pv),
     '★ 三格會即時組成一段積木的樣子');
  ok(/走廊亮不亮/.test(pv) && /很暗而且有人/.test(pv) && /把燈打開/.test(pv),
     '   填的字真的長在程式裡（' + pv.trim().slice(0, 26) + '…）');
  ok(/變得成數字/.test(q('#f-say').textContent),
     '★ 填完之後提醒他「那個東西變得成數字嗎」—— 這是第三節挑不到元件的主因');
}

section('★ 第一 → 第二節：決定會帶著走');
{
  const { go, pg, find } = open();
  go(1);
  find('[data-p]', /走廊/).onclick();
  go(2);
  ok(/走廊晚上沒人卻整晚亮著/.test(pg().querySelector('#p2-from').textContent),
     '★★ 第二節看得到第一節選的題目');
  ok(pg().querySelector('#f-sense').value === '走廊亮不亮',
     '★ 而且「要偵測什麼」先幫他填好了（可以改）');
}

section('★ 第三節：元件用「感覺得到什麼」分類');
{
  const { go, pg, find } = open();
  go(3);
  const parts = [...pg().querySelectorAll('[data-part]')];
  ok(parts.length === 12, '六個感測器＋六個致動器（實際 ' + parts.length + '）');
  ok(parts.every(b => /感覺得到：|做得到：/.test(b.textContent)),
     '★★ 每張元件卡都寫「它感覺得到／做得到什麼」，沒有一張寫型號');
  const say = () => pg().querySelector('#p3-say');

  find('[data-part]', /光線感測器/).onclick();
  ok(/還差一個致動器/.test(say().textContent),
     '★ 只挑感測器 → 明講還差什麼（不是靜靜不動）');
  const led = find('[data-part]', /燈（LED/);
  led.onclick();
  ok(/你的組合/.test(say().textContent), '兩邊都挑了 → 給出組合');
  ok(/真的感覺得到/.test(say().textContent),
     '★ 而且要他回頭想「這個感測器真的感覺得到嗎」');
  ok(/力氣夠不夠/.test(say().textContent),
     '★ 提醒致動器的力氣上限 —— 收衣架那種題目就是卡在這裡');

  led.onclick();
  ok(/還差一個致動器/.test(say().textContent), '★ 再點一次可以取消選取');
}

section('★★ 第四節：測試情境一定要有「不該動」的那一種');
{
  /* ⚠️ 只測「該動的時候動不動」的話，門檻設 95 也會過 ——
     那學生學到的是「讓它動」，不是「讓它在對的時候動」。 */
  const { go, pg, ev } = open();
  go(4);
  const q = s => pg().querySelector(s);
  ok(/不該動的時候不動/.test(pg().textContent), '★★ 開宗明義說「會動不算成功」');

  const say = () => q('#p4-say').textContent;
  ok(/三個情境都要測過/.test(say()), '一開始要求三個都測');

  const v = q('#v');
  v.value = 15; ev(v);
  ok(/三個情境都要測過/.test(say()), '   只測一個還不算');
  v.value = 80; ev(v);
  v.value = 45; ev(v);
  const marks = [...q('#cases').children].map(x => (x.textContent.match(/✅|❌|🤔|⬜/) || [''])[0]);
  ok(marks[0] === '✅' && marks[1] === '✅', '★ 該動的會動、不該動的不會動（門檻 40）');
  ok(marks[2] === '🤔', '★★ 第三個（門檻附近）**不判對錯** —— 那是學生的設計決定');
  ok(/不判對錯/.test(q('#cases').textContent), '   而且畫面上明講不判對錯');
  ok(/這才叫做完成/.test(say()), '★ 三個都測過且沒錯 → 過關');

  /* 門檻設錯要抓得到 */
  const w = open();
  w.go(4);
  const wq = s => w.pg().querySelector(s);
  [15, 80, 45].forEach(x => { wq('#v').value = x; w.ev(wq('#v')); });
  wq('#on').value = 95; w.ev(wq('#on'));          // 門檻拉到 95 → 大白天也會亮
  ok(/門檻/.test(wq('#p4-say').textContent) && /不對/.test(wq('#p4-say').textContent),
     '★★ 門檻設 95（白天也亮）→ 抓得到');
  ok(/大白天/.test(wq('#p4-say').textContent), '   而且指出是哪一個情境錯了');
  ok(/往.{0,6}小.{0,6}調/.test(wq('#p4-say').textContent.replace(/<[^>]+>/g, '')),
     '★ 還告訴他要往哪個方向調');
  ok(/❌/.test(wq('#cases').textContent), '   那一列也打了叉');
}

section('★★ 第五節：作品卡把前四節串起來');
{
  const { go, pg, ev, find } = open();
  go(1); find('[data-p]', /走廊/).onclick();
  go(2);
  ['#f-sense', '#f-cond', '#f-act'].forEach((id, i) => {
    const el = pg().querySelector(id);
    el.value = ['走廊亮不亮', '很暗而且有人', '把燈打開'][i]; ev(el);
  });
  go(3);
  find('[data-part]', /光線感測器/).onclick();
  find('[data-part]', /燈（LED/).onclick();
  go(4);
  const vv = pg().querySelector('#v');
  [15, 80, 45].forEach(x => { vv.value = x; ev(vv); });
  const on = pg().querySelector('#on');
  on.value = 30; ev(on);
  go(5);

  const card = pg().querySelector('#card').textContent.replace(/\s+/g, ' ');
  ok(/走廊晚上沒人卻整晚亮著/.test(card), '★ 帶著第一節選的問題');
  ok(/走廊亮不亮/.test(card) && /很暗而且有人/.test(card) && /把燈打開/.test(card),
     '★ 帶著第二節寫的三步');
  ok(/光線感測器/.test(card) && /燈/.test(card), '★ 帶著第三節挑的元件');
  ok(/小於 30/.test(card), '★ 帶著第四節設的門檻');
  ok(!/還缺東西/.test(pg().textContent), '   四節都做過了，不再提示缺東西');

  const t = pg().querySelector('#note');
  ok(!t.value, '設計說明一開始是空的');
  const say = () => pg().querySelector('#p5-say').textContent;
  t.value = '設 60'; ev(t);
  ok(/再寫幾個字/.test(say()), '★ 太短不算完成');
  t.value = '一開始設 60 白天也會亮，改成 30 才正常'; ev(t);
  ok(/完成/.test(say()), '寫夠了 → 完成');
  ok(/同學/.test(say()), '★ 完成之後要他去找同學看 —— 作品要有人看得懂才算做完');
}

section('★ 第五節：前面沒做完也不留白');
{
  const { go, pg } = open();
  go(5);
  ok(/還缺東西/.test(pg().textContent), '★ 直接跳到第五節 → 明講作品卡還缺什麼');
  ['第一節', '第二節', '第三節'].forEach(n =>
    ok(pg().textContent.indexOf(n) >= 0, '   點名要回「' + n + '」'));
  ok(/回課程總覽補齊/.test(pg().textContent), '★ 而且給一顆按鈕直接回去');
  ok(/第一節還沒選/.test(pg().querySelector('#card').textContent),
     '   作品卡照樣畫出來（空欄寫「還沒選」，不是一片空白）');
}

section('★ 兩種交法都寫出來了');
{
  const { go, $ } = open();
  go(5);
  const t = $('#detail-demo-container').textContent;
  ok(/模擬器版/.test(t) && /實體版/.test(t), '★★ 模擬器版（全班都交得出來）＋ 實體版（有器材的組）');
  ok(/沒有實體零件不代表沒做出東西/.test(t), '★ 講明模擬器版不是次一等的');
  ok(/還沒接上傳/.test(t), '⚠️ 老實講「這一頁還沒接上傳」—— 不要讓學生按一顆假的按鈕');
  ok(/截圖/.test(t), '   並告訴他先截圖');
}

section('★★ 學生打的字要逸出');
{
  /* ⚠️ 作品卡是用 innerHTML 拼的。少了 esc()，
     有人在說明裡打一個「<」整張卡就會壞掉 —— 而且畫面上不會報錯。 */
  const { go, pg, ev, find } = open();
  go(1); find('[data-p]', /走廊/).onclick();
  go(2);
  const el = pg().querySelector('#f-cond');
  el.value = '<img src=x onerror=alert(1)>'; ev(el);
  ok(pg().querySelector('#f-preview').innerHTML.indexOf('&lt;img') >= 0,
     '★★ 第二節的程式預覽逸出了');
  go(5);
  const html = pg().querySelector('#card').innerHTML;
  ok(html.indexOf('&lt;img') >= 0, '★★ 作品卡也逸出了');
  ok(!pg().querySelector('#card img'), '★★ 沒有真的長出一個 <img>');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
