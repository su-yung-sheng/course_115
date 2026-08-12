/* 三支互動實驗室：說明文字要和學生真正看到的東西相符
   跑法：node shared/tests/labwording.test.js

   ★ 為什麼要有這一份
     2026-08-12 老師實際操作時發現：插入排序的說明寫「點<b>橘框</b>那張新牌」，
     但點下去顏色沒變 —— 因為 .sl-cell.card（橘）宣告在 .sl-cell.sel（靛藍）**後面**，
     同權重後者輸，點選的樣式整個被蓋掉。
     說明講的顏色、按鈕的名字、格子的稱呼，只要有一個對不上，
     學生就會以為是自己按錯 —— 而畫面上沒有任何錯誤訊息。

   ⚠️ 這種錯不會被前面那些測試抓到：演算法是對的、判定是對的、
      流程也走得完。壞掉的只有「學生看不看得懂要做什麼」。 */
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

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window;
global.window = W; global.document = W.document;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SRC = {
  sort: read('shared/sortlab.js'),
  search: read('shared/searchlab.js'),
  logic: read('shared/logiclab.js')
};
Object.keys(SRC).forEach(k => W.eval(SRC[k]));
const SORT = W.SORTLAB, SEARCH = W.SEARCHLAB, LOGIC = W.LOGICLAB;

/** 掛一個實驗室，回傳畫面上的文字與按鈕 */
function view(mod, opts) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sim = mod.mount(host, opts);
  return { host: host, sim: sim,
           text: host.textContent,
           btns: [...host.querySelectorAll('button')].map(b => b.textContent.trim()),
           done: () => { if (sim.destroy) sim.destroy(); host.remove(); } };
}
/** 某個 CSS 選擇器在原始碼裡第幾個字元（用來比宣告先後） */
const at = (src, sel) => src.indexOf(sel + '{');

/* ── ① 顏色：說明講的顏色要真的是那個顏色 ───────────── */
section('★ 說明講「橘框」，那一格就要真的是橘的');
{
  /* .sl-cell.card 是插入排序那張「新牌」。
     橘色系＝紅通道明顯高於藍通道（#f97316 這種）。 */
  const m = SRC.sort.match(/\.sl-cell\.card\{border-color:#([0-9a-f]{6})/);
  ok(!!m, '找得到 .sl-cell.card 的邊框色');
  if (m) {
    const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16),
          b = parseInt(m[1].slice(4, 6), 16);
    ok(r > 200 && g > 90 && g < 190 && b < 90,
       '★ #' + m[1] + ' 真的是橘色（R' + r + ' G' + g + ' B' + b + '）');
  }
  ok(/橘框/.test(SORT.INFO.insertion.rule), '   插入排序的說明用「橘框」稱呼它');
}

section('★★ 點下去要看得出有點到（CSS 宣告順序）');
{
  /* ⚠️ 同權重的規則，**後面宣告的贏**。
     .card 排在 .sel 後面的話，學生點了那張橘框牌，
     顏色完全沒變 —— 說明叫他點，他點了卻不知道有沒有點到。 */
  const o = ['.sl-cell.done', '.sl-cell.card', '.sl-cell.sel', '.sl-cell.bad']
    .map(s => at(SRC.sort, s));
  ok(o.every(x => x > 0), '四個狀態的樣式都在');
  ok(o[1] < o[2],
     '★★ .card 要排在 .sel **前面** —— 反過來的話點選中的樣式會被橘色蓋掉');
  ok(o[2] < o[3],
     '★ .bad（出錯閃爍）排最後 —— 不然點錯了畫面沒有任何反應');
  /* 真的掛起來點一次：點了橘框那張，class 要多一個 sel */
  const v = view(SORT, { mode: 'insertion', order: 'asc' });
  const cells = () => [...v.host.querySelectorAll('[data-i]')];
  const card = cells().findIndex(c => /card/.test(c.className));
  ok(card >= 0, '   畫面上找得到橘框那一張');
  cells()[card].onclick();
  ok(/sel/.test(cells()[card].className), '★ 點下去之後掛上了「選中」的樣式');
  v.done();
}

section('★ 出錯一律紅色，三支一致');
{
  /* ⚠️ 原本 .sl-cell.bad 是琥珀色 #f59e0b —— 和橘框（#f97316）幾乎一樣。
     學生分不出「這是要處理的那張」和「你點錯了」。 */
  [['sort', '.sl-cell.bad'], ['search', '.qs-cell.bad']].forEach(([k, sel]) => {
    const m = SRC[k].match(new RegExp(sel.replace(/\./g, '\\.') + '\\{border-color:#([0-9a-f]{6})'));
    ok(!!m, k + ' 有 ' + sel);
    if (m) {
      const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16);
      ok(r > 200 && g < 110, '★ ' + sel + ' 是紅色 #' + m[1] + '（不是琥珀色）');
    }
  });
  ok(/\.lg-msg\.bad\{background:#fee2e2/.test(SRC.logic), '   條件判斷的錯誤訊息也是紅色系');
}

section('★ 說明講「虛線框」，那個東西就要真的是虛線');
{
  ok(/虛線框/.test(SRC.sort), '插入排序會講到「虛線框」');
  ok(/\.sl-slot\{[^}]*dashed/.test(SRC.sort),
     '★ .sl-slot 真的是 dashed —— 說虛線就要是虛線');
}

section('★ 「劃掉」就要真的有刪節線');
{
  ok(/劃掉/.test(SRC.search) || /劃掉/.test(read('11502/content/blocks.js')),
     '二元搜尋會講「另一半整個劃掉」');
  ok(/\.qs-cell\.cut\{[^}]*line-through/.test(SRC.search),
     '★ .qs-cell.cut 真的有 line-through');
}

/* ── ② 用詞：同一個東西只能有一個名字 ───────────────── */
section('★ 資料的單位一律叫「項」，不叫「格」');
{
  /* 課本從頭到尾用「第 N 項」，畫面上的標籤也是「第 N 項」——
     說明卻寫「第 1 格」的話，學生會以為那是兩個不同的東西。
     ⚠️ 比對前先去掉註解：註解裡正好會解釋「為什麼不用格」。 */
  const code = SRC.search.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');
  const bad = (code.match(/[一這第][ 　]*[0-9一二三四五六七八九十]*[ 　]*格/g) || []);
  ok(bad.length === 0,
     '★ 搜尋實驗室的文案沒有「格」' + (bad.length ? '（還有：' + bad.join('、') + '）' : ''));
  ok(/第 1 項/.test(SEARCH.INFO.sequential.rule), '   說明開頭就講「第 1 項」');
  const v = view(SEARCH, { mode: 'sequential', course: 'hit' });
  ok(/第 1 項/.test(v.host.textContent), '   畫面上的標籤也是「第 N 項」');
  v.done();
}

/* ── ③ 說明提到的按鈕，畫面上要真的有 ───────────────── */
section('★ 說明叫學生按的按鈕，畫面上找得到');
{
  /* ⚠️ 按鈕改了名字而說明沒跟著改，是最容易發生也最難發現的一種 ——
     學生在畫面上找一個不存在的東西，而系統不會報錯。 */
  const v1 = view(LOGIC, { need: 3 });
  ok(v1.btns.some(b => b.indexOf('慢動作重看') >= 0),
     '★ 條件判斷找得到「慢動作重看」這顆按鈕');
  v1.done();

  /* ⚠️ 大比拼那顆「比一次，砍掉一半」**要先選資料量才會出現** ——
     所以不能一掛上去就找它。
     ★ 而說明本來就是照這個順序寫的：「選一個資料量，然後一直按…」。
       這一條要釘的是那個**先後關係**：說明先講選資料量、再講那顆按鈕。 */
  const rule = SEARCH.INFO.compare.rule;
  ok(rule.indexOf('資料量') >= 0 && rule.indexOf('資料量') < rule.indexOf('比一次'),
     '★ 大比拼的說明先叫學生選資料量，才提那顆按鈕（畫面就是這個順序）');
  const v2 = view(SEARCH, { mode: 'compare' });
  ok(!v2.btns.some(b => b.indexOf('比一次') >= 0), '   還沒選資料量時那顆按鈕不在');
  ok(/先選一個資料量/.test(v2.host.textContent), '   而且畫面上明講「先選一個資料量」');
  v2.host.querySelector('[data-size="13"]').onclick();
  const btns2 = [...v2.host.querySelectorAll('button')].map(b => b.textContent.trim());
  ok(btns2.some(b => b.indexOf('比一次，砍掉一半') >= 0),
     '★ 選了資料量之後，說明講的那顆按鈕就出現了（字一模一樣）');
  v2.done();
  /* 排序的自動播放：說明講「下一步」和「自動播放」 */
  ok(/下一步/.test(SRC.sort) && /自動播放/.test(SRC.sort),
     '   排序的說明講的「下一步」「自動播放」都是按鈕上的字');
}

/* ── ④ 兩清單的名字要和課本一致 ─────────────────────── */
section('★ 兩排的名字：未排序／已排序（課本的用詞）');
{
  const v = view(SORT, { mode: 'selection', order: 'asc' });
  ok(/未排序/.test(v.host.textContent) && /已排序/.test(v.host.textContent),
     '★ 畫面上兩排標著「未排序」「已排序」');
  ok(/未排序/.test(SORT.INFO.selection.rule) && /已排序/.test(SORT.INFO.selection.rule),
     '   說明用的是同兩個詞');
  v.done();
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
