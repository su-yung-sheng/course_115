/* 闖關基地的登入接手：不該叫人「再登入一次」
   跑法：node shared/tests/hublogin.test.js

   ★ 2026-08-10 實際遇到的：按上一頁又要重新登入。

     原因是 sessionStorage 的學號**按學期分開存**（sid11501／sid11502），
     而 hub 只看那一格：沒有就直接畫出登入畫面。
     於是跨學期、或按上一頁回到另一個學期時，
     使用者看到的是「怎麼又要登入」—— 即使 Firebase 那邊根本沒登出。

   ★ 身分的來源是 Firebase 的 email，不是 sessionStorage。
     sessionStorage 只是「這個分頁現在是誰」的快取。
     快取沒有 ≠ 沒登入。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const hubs = ['11501', '11502'].map(t => ({
  term: t,
  src: fs.readFileSync(path.join(__dirname, '..', '..', t, 'hub.html'), 'utf8')
}));
const auth = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');

section('兩個學期的登入流程要一致');
/* ★ 這幾樣一邊有一邊沒有的話，就會出現「上學期好好的，下學期怪怪的」——
   而那種問題最難查，因為兩邊看起來都「差不多」。 */
['onAdopt', 'attachSession', 'SAVED_KEY', 'sidFromEmail'].forEach(k => {
  ok(hubs.every(h => h.src.indexOf(k) >= 0), '   兩邊都有 ' + k);
});

section('sessionStorage 沒有學號時，不要馬上叫人登入');
hubs.forEach(h => {
  /* 找「saved 沒有」那一段，看它是不是直接跳登入。 */
  const i = h.src.indexOf('const saved = sessionStorage.getItem(SAVED_KEY)');
  const seg = h.src.slice(i, i + 1400);
  ok(i > 0, h.term + '：找得到讀 saved 的那一段');
  ok(/AUTH\.sidFromEmail/.test(seg),
     '★ ' + h.term + '：沒有 saved 時要先問 Firebase 的 email —— 那才是身分的來源');
  ok(/按上一頁|另一個學期|按學期分開存/.test(seg),
     '   ' + h.term + '：註解要講明是跨學期／上一頁才會踩到（不然看起來像多餘的分支）');
});

section('取不出學號時還是要回登入畫面');
/* 匿名登入沒有 email、老師帳號取不出學號 —— 那兩種不能硬闖進學生流程。 */
hubs.forEach(h => {
  const i = h.src.indexOf('const fromEmail');
  const seg = h.src.slice(i, i + 300);
  ok(/else \{ state\.status='login'; render\(\); \}/.test(seg),
     '   ' + h.term + '：取不出學號 → 回登入畫面（匿名／老師帳號走這條）');
});

section('sidFromEmail 本身');
ok(/sidFromEmail: sidFromEmail/.test(auth), 'auth.js 有把它匯出（hub 才叫得到）');
/* 把函式挖出來實際跑一次 —— 只讀原始碼會漏掉「它其實會回什麼」。 */
const fn = new Function('PREFIX', 'DOMAIN',
  auth.match(/function sidFromEmail[\s\S]*?\n  \}/)[0] + '\nreturn sidFromEmail;')('qfm', 'mail.qfm.kh.edu.tw');
ok(fn('qfm1410905@mail.qfm.kh.edu.tw') === '1410905', '學生帳號取得出學號');
ok(fn('suyungsheng@mail.qfm.kh.edu.tw') === '', '★ 老師帳號取不出 —— 所以老師走不進學生流程');
ok(fn('') === '', '匿名登入（沒有 email）取不出');
ok(fn('qfm1410905@gmail.com') === '', '外部網域取不出');

/* ── ★ 進度條的分母要和真正的星數上限對得起來 ─────────
   ⚠️ 2026-08-11 抓到：hub 卡片的 maxStars 沒有把「老師審核給的加分星」
      算進去（流程圖交圖 +1⭐／關、程式交錄影 +1⭐／關，各最多 10 顆）。
        11501 程式設計：寫 50，實際上限 70
        11502 程式設計：寫 30，實際上限 40
      學生把加分拿滿的話，進度條會超過 100%。

   ★ 上限的算法只有一份：GRADING.moduleMax()。
     hub 自己抄一個數字進去，改門檻時就會有一邊忘記 ——
     而「進度條超過 100%」不會有人回報，只會覺得這系統怪怪的。 */
section('★ hub 的 maxStars 對得上 GRADING.moduleMax()');
{
  const W = {};
  new Function('window', fs.readFileSync(path.join(root, 'shared', 'grading.js'), 'utf8'))(W);
  const MAX = W.GRADING.moduleMax(10);

  /* ⚠️⚠️ 11502 要**帶關卡代號**進去。
     第 5 關（6-1-1）是觀念導入，沒有程式作品要交
     （見 GRADING.GATE.NO_UPLOAD），那 4 顆星永遠拿不到 ——
     算進分母的話學生會卡在 36/40，怎麼做都到不了 100%。
     ★ 11501 十關都要交作品，所以照舊不帶。 */
  const CFG = {};
  new Function('window', fs.readFileSync(path.join(root, '11502', 'config.js'), 'utf8'))(CFG);
  const ids02 = (CFG.CONFIG.UNITS || []).map(u => u[0]);
  const MAX02 = W.GRADING.moduleMax(10, ids02);
  ok(MAX02.scratch < MAX.scratch,
     '★★ 11502 的程式上限比十關全交少（' + MAX02.scratch + ' < ' + MAX.scratch +
     '）—— 第 5 關沒有作品要交');

  /* 11501 的程式設計卡把流程圖與 Scratch 合成一張（combines），
     所以分母是兩個模組的上限相加。十關都要交作品，寫死沒問題。 */
  {
    const src = fs.readFileSync(path.join(root, '11501/hub.html'), 'utf8');
    const line = (src.split('\n').filter(l => l.indexOf("id:'listprog'") >= 0)[0]) || '';
    const m = line.match(/maxStars:\s*(\d+)/);
    ok(!!m, '11501/hub.html 的 listprog 卡片找得到 maxStars');
    if (m) ok(Number(m[1]) === MAX.flowchart + MAX.scratch,
      '★ 11501 的 listprog maxStars = ' + m[1] +
      '（應該是 ' + (MAX.flowchart + MAX.scratch) + '）');
  }

  /* ⚠️⚠️ 11502 **不可以寫死數字**。
     作品星的滿分＝「要交作品的關卡數 × (3 + 錄影加分)」，
     而那份名單是 GRADING.GATE.NO_UPLOAD 決定的
     （第 5 關是觀念導入，沒有作品要交 → 9 關 × 4 = 36）。
     ★ 老師 2026-08-17 問「第五關與第十關都沒有程式，總數是不是會改變」——
       會。名單再改一關就變 32。
     ⇒ 寫死的話那一天不會有人記得回來改，
       而症狀是「進度條停在 32/36，怎麼做都到不了 100%」，
       沒有人會回報這種事。所以要**現算**。 */
  {
    const src = fs.readFileSync(path.join(root, '11502/hub.html'), 'utf8');
    const line = (src.split('\n').filter(l => l.indexOf("id:'scratch'") >= 0)[0]) || '';
    ok(!/maxStars:\s*\d+/.test(line),
       '★★ 11502 的 scratch 卡片**沒有寫死** maxStars');
    ok(/maxStars:\s*scratchMax\(\)/.test(line),
       '★★ 而是呼叫 scratchMax() 現算');
    const fn = src.slice(src.indexOf('function scratchMax'),
                         src.indexOf('const MODULES'));
    ok(/GRADING\.moduleMax/.test(fn), '★ scratchMax() 走的是共用的 GRADING.moduleMax()');
    ok(/CONFIG\.UNITS/.test(fn),
       '★★ 而且**有把關卡代號傳進去** —— 不傳的話免交那幾關會被算進分母');

    /* 真的跑一次，確認算出來的和 GRADING 一致 */
    const W2 = {};
    new Function('window', fs.readFileSync(path.join(root, '11502', 'config.js'), 'utf8'))(W2);
    new Function('window', fs.readFileSync(path.join(root, 'shared', 'grading.js'), 'utf8'))(W2);
    const f = new Function('window', fn + '; return scratchMax();');
    ok(f(W2) === MAX02.scratch,
       '★★ 實際算出來是 ' + f(W2) + '，和 GRADING.moduleMax() 的 ' + MAX02.scratch + ' 一致');
  }

  /* 加分星要真的被算進卡片顯示的數字裡，不是只有分母變大。
     ⚠️ 只改分母的話，進度條會永遠差那幾顆，看起來像「怎麼樣都補不滿」。 */
  const h1 = fs.readFileSync(path.join(root, '11501', 'hub.html'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(/starsWithBonus/.test(h1),
     '★ 11501 hub 有把加分星算進顯示的星數（老師給了分，學生要看得到）');
}

/* ── ★ 學期一開始不可以整頁都是霧的 ─────────────────
   ⚠️ 2026-08-11 實際看到：11502 的四張卡看起來霧霧的。
      原因是「尚未開始」的卡片會套 opacity-70 ——
      而學期第一天**每一張都是尚未開始**，於是整頁都半透明。

   ★ 半透明 ＋ hover 才變亮，是「這個不能點」的慣用寫法。
     但那四張明明都點得進去 —— 等於用視覺語言說了相反的話。
     狀態由徽章講（尚未開始／進行中／已通關），
     「接下來做哪一個」由 👉 下一關 的外框講，兩者都已經有了。

   ⚠️ 而且調暗會和「下一關」打架：該最顯眼的正是那張還沒做的。 */
section('★ 尚未開始的卡片不可以整張調暗');
hubs.forEach(h => {
  const m = h.src.match(/'todo':\s*\{[^}]*dim:\s*(true|false)/);
  ok(!!m, h.term + '：找得到 todo 的顯示設定');
  if (m) ok(m[1] === 'false',
    '★ ' + h.term + '：todo 的 dim 是 false —— 學期第一天每張都是 todo，' +
    'true 的話整頁都會霧掉，看起來像不能點');
});

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
