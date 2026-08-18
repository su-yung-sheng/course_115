/* 兩學期的關卡小卡：資訊要齊、層次要一致
   跑法：node shared/tests/unitcard.test.js   （需要 jsdom）

   ★ 為什麼有這一份（老師 2026-08-17）
     「比起 11502，11501 的入口小卡過於簡約？少了資訊提示與設計感？」
     查下來有一個現成的浪費：關卡資料裡本來就有一整段 desc
     （「用『清單（陣列）』當成班級置物櫃…」），
     而卡片只印了一行 subtitle，還加了 truncate 會被截斷。
     ★ 資訊早就在，只是沒放上去。

   ⚠️ 這份測試要盯的是**資訊有沒有到學生眼前**，不是 CSS 好不好看：
     ① 完整說明有印出來（而且沒有 truncate）
     ② 兩軌的進度各自看得到
     ③ 底部有「現在該做什麼」
     ④ 沒開的關卡不可以偽裝成可以點
     ⑤ 11501 特有的三樣東西（icon、代號、去程式設計的捷徑）不可以在改版時掉了 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const HTML = read('11501/flowchart.html');
/* ⚠️ 只看畫小卡的那一段：整份檔案裡還有閱讀頁、程式頁、測驗頁，
   全部混在一起掃的話，任何一條「畫面上要有 X」都會被別頁的字掩護。 */
const i0 = HTML.indexOf('const cards = UNITS.map');
const i1 = HTML.indexOf(".join('');", i0);
const CARD = HTML.slice(i0, i1);
/* 去註解 —— 註解裡正好會寫「原本只印 subtitle、還 truncate」。 */
const CODE = CARD.replace(/\/\*[\s\S]*?\*\//g, ' ');

section('★★ 11501 小卡：資訊要到學生眼前');
{
  ok(/u\.desc/.test(CODE), '★★ 印的是完整的 desc（關卡資料裡本來就有的那一段）');
  ok(!/truncate/.test(CODE), '★★ 沒有 truncate —— 說明不可以被截斷');
  ok(/第 \$\{u\.no\} 關 · \$\{u\.id\}/.test(CODE), '★ 保留關卡代號（下學期沒有這個）');
  ok(/u\.icon/.test(CODE), '★ 保留 icon 方塊（下學期沒有這個）');
  ok(/go-prog/.test(CODE),
     '★★ 保留「直接去程式設計」捷徑 —— 它解決的是「流程圖排完要去哪」這個真問題');
}

section('★★ 兩軌的進度各自看得到');
{
  ok(/🧩/.test(CODE) && /🐱/.test(CODE), '流程圖與程式各有一個標記');
  ok(/★/.test(CODE) && /☆/.test(CODE), '★ 用實心／空心星，不是只有文字');
  ok(/progStars/.test(CODE), '程式那一軌讀的是批改給的星數');
  ok(/state\.done\[u\.id\]/.test(CODE), '流程圖那一軌讀的是排對了沒');
  /* ⚠️ 兩軌不可以混在同一行小字裡 —— 那正是改版前的樣子。 */
  ok(/text-right/.test(CODE), '★★ 星星靠右對齊成一欄（改版前是混在一排小字裡）');
}

section('★★ 底部要講「現在該做什麼」');
{
  ok(/nextLine/.test(CODE), '有一句「下一步」');
  ['排流程圖', '去寫程式', '重做', '完成前一關'].forEach(t => {
    ok(CARD.indexOf(t) >= 0, '　　涵蓋狀態：' + t);
  });
  /* ★ 三種狀態要有三句不同的話 —— 都寫「點進去」等於沒講。 */
  const lines = (CARD.match(/'[^']*點進去[^']*'/g) || []);
  ok(new Set(lines).size >= 2, '★ 不同狀態講不同的話（不是一句「點進去」打死）');
}

section('★★ 沒開的關卡不可以偽裝成可以點');
{
  ok(/cursor-not-allowed/.test(CODE), '鎖住的卡片游標會變（看得出不能點）');
  ok(/🔒/.test(CARD), '★ 而且顯示鎖頭');
  /* ⚠️ 但它仍然要點得到 —— 點了會說明為什麼還沒開。
     那是刻意的：一張完全死掉的灰卡，學生只會以為系統壞了。 */
  ok(/data-unit=/.test(CODE), '★★ 仍然掛著 data-unit（點了要能說明原因，不是死卡）');
}

section('★ 設計：克制，而且要能關掉');
{
  const css = HTML.slice(0, HTML.indexOf('</head>'));
  ok(/\.unit-btn\.c-/.test(css), '★ 左緣有關卡色帶');
  ok(!/linear-gradient[^;]*unit-btn/.test(css), '   色帶用純色，不是漸層（投影機打漸層是糊的）');
  ok(/prefers-reduced-motion/.test(css),
     '★★ 系統開了「減少動態效果」就不要動 —— 會暈車的人要能關掉');
  ok(/animation-delay/.test(css), '★ 卡片一張一張進場（不是十張同時閃出來）');
}

section('★★ 和下學期的層次對得起來');
{
  /* ⚠️ 不是要兩邊長得一樣 —— 是要**同樣的四層資訊**都在。
     下學期已經有的：關卡編號、標題、說明、星星、行動提示。 */
  const S2 = read('11502/scratch.html');
  const j0 = S2.indexOf("stage-grid').innerHTML");
  const j1 = S2.indexOf('function renderTotal');
  const C2 = S2.slice(j0, j1).replace(/\/\*[\s\S]*?\*\//g, ' ');
  [['關卡編號', /第 \$\{/, /第 \$\{/],
   ['完整說明', /u\.desc/, /u\.desc/],
   ['星星欄', /★/, /★/],
   ['行動提示', /點進去/, /點進去/]
  ].forEach(([name, re1, re2]) => {
    ok(re1.test(CODE) && re2.test(C2), '兩學期都有：' + name);
  });
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
