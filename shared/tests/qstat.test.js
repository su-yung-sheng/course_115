/* 題目統計（shared/qstat.js）
   跑法：node shared/tests/qstat.test.js

   ★ 這一份守的是三件事，壞掉都不會有錯誤訊息：

     ① id 要穩
        id 是由題目文字算出來的。算法一改，**全部歷史統計一次歸零** ——
        而畫面上只會看到「所有題目都只被抽到 0 次」，看起來像沒人做過。

     ② 同一題只能有一個 id
        同一題同時出現在「1-1 節」和「第一章整章挑戰」。
        兩邊拿到不同 id 的話，統計散成兩半，
        每一半的次數都不到門檻，於是那一題永遠不會出現在排行上 ——
        最常錯的題目反而是最看不到的。

     ③ 分母的意思
        n 是「這一題被抽到幾次」，不是「幾個學生做過」。
        搞混的話會拿它當鑑別度指標，而那是錯的。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const W = {};
new Function('window', fs.readFileSync(path.join(root, 'shared', 'qstat.js'), 'utf8'))(W);
const Q = W.QSTAT;

section('id：同一段文字永遠同一個 id');
ok(Q.id('測試題目') === Q.id('測試題目'), '同樣的字 → 同樣的 id');
ok(Q.id('測試題目') !== Q.id('別的題目'), '不同的字 → 不同的 id');
ok(Q.id('') === '', '空字串沒有 id');
/* ★ 排版改動不該讓統計歸零 —— 多一個空格、換一個全形逗號都不算改題目。 */
ok(Q.id('資訊倫理的目的為何？') === Q.id(' 資訊倫理，的目的為何 ？ '),
   '★ 空白與標點不影響 —— 排版微調不該讓歷史統計失效');
ok(Q.id('<b>資訊</b>倫理') === Q.id('資訊倫理'), '   HTML 標籤也不算');
/* ⚠️ 但改寫題目文字＝新題目。這是刻意的（題目改了，舊的答對率本來就不算數），
   代價是舊統計會變成孤兒 —— 所以教師端要把它們列出來，不是安靜丟掉。 */
ok(Q.id('資訊倫理的目的為何') !== Q.id('資訊倫理最主要的目的為何'),
   '★ 改寫題目＝新的一題（舊統計會變孤兒，教師端要看得到）');

/* ⚠️ 這一條是在釘**現在這個算法**。
   有人換掉雜湊的話這裡會紅，而那正是提醒：
   「你正要讓全班的歷史統計歸零，確定嗎？」 */
ok(Q.id('資訊倫理主要目的為何？') === 'qzi82au',
   '★ 算法沒有被換掉（換了的話所有歷史統計會歸零）');

section('累加與合併');
{
  let m = {};
  Q.bump(m, 'A題', true);
  Q.bump(m, 'A題', false);
  Q.bump(m, 'B題', true);
  const a = m[Q.id('A題')];
  ok(a.n === 2 && a.ok === 1, 'A 題兩次、對一次');
  ok(Object.keys(m).length === 2, '兩題兩個 key');

  const merged = Q.merge(m, m);
  ok(merged[Q.id('A題')].n === 4 && merged[Q.id('A題')].ok === 2, '★ 合併是相加，不是取最好');
  ok(m[Q.id('A題')].n === 2, '   而且不會改到原本那一份');
  ok(Object.keys(Q.merge(null, null)).length === 0, '兩邊都空也不會炸');
}

section('★ 同一題出現在多個地方，只能有一個 id');
{
  const w = {};
  new Function('window', fs.readFileSync(path.join(root, '11501', 'content', 'ethics.js'), 'utf8'))(w);
  const bank = Q.bank(w.QUIZ_CONTENT);
  const first = w.QUIZ_CONTENT.chapters[0].sections[0].questions[0];
  const e = bank[Q.id(first.q)];
  ok(!!e, '第一題在對照表裡');
  ok(e.where.length >= 2,
     '★ 同一題的出處記了 ' + e.where.length + ' 個（節＋整章挑戰）—— ' +
     '合併成一筆，統計才不會散成兩半');
  ok(e.q === first.q && e.options.length === 4, '   帶得出題目與選項（教師端要顯示）');
}

section('★ 整個題庫不可以撞號');
{
  const seen = {};
  const clash = [];
  [['11501', 'ethics.js'], ['11502', 'social.js']].forEach(([t, f]) => {
    const w = {};
    new Function('window', fs.readFileSync(path.join(root, t, 'content', f), 'utf8'))(w);
    const b = Q.bank(w.QUIZ_CONTENT);
    Object.keys(b).forEach(k => {
      if (seen[k] && seen[k] !== b[k].q) clash.push(k + '：「' + seen[k].slice(0, 14) + '」與「' + b[k].q.slice(0, 14) + '」');
      seen[k] = b[k].q;
    });
  });
  ok(clash.length === 0,
     '★ 兩學期合計 ' + Object.keys(seen).length + ' 題，沒有兩題共用同一個 id' +
     (clash.length ? '　←　' + clash[0] : ''));
}

section('排行');
{
  const total = {};
  total[Q.id('很難的題')] = { n: 40, ok: 8 };    // 20%
  total[Q.id('普通的題')] = { n: 40, ok: 32 };   // 80%
  total[Q.id('沒人做的題')] = { n: 2, ok: 0 };   // 樣本太少
  const bank = {};
  bank[Q.id('很難的題')] = { q: '很難的題', options: [], correct: 0, where: ['1-1'] };
  bank[Q.id('普通的題')] = { q: '普通的題', options: [], correct: 0, where: ['1-1'] };
  const r = Q.rank(total, bank, 5);
  ok(r.length === 2, '★ 被抽到太少次的不排（樣本太少的名次沒有意義）');
  ok(r[0].q === '很難的題' && r[0].rate === 20, '答對率低的排前面（' + r[0].rate + '%）');
  /* ⚠️ 題庫裡找不到 = 題目被改寫過。要看得出來，不可以安靜丟掉。 */
  const orphan = {};
  orphan[Q.id('已經被改掉的題')] = { n: 30, ok: 5 };
  const r2 = Q.rank(orphan, bank, 5);
  ok(r2.length === 1 && r2[0].q === null,
     '★ 題庫裡找不到的（題目改寫過）照樣列出來，q 是 null —— 安靜丟掉的話你不會知道統計少了一塊');
}

section('★ 分班看：801 和 802 常錯的題目不一樣');
{
  const A = Q.bump(Q.bump({}, '甲題', false), '甲題', false);   // 801 全錯
  const B = Q.bump(Q.bump({}, '甲題', true), '甲題', true);     // 802 全對
  const g = Q.byClass([
    { id: '1', name: '小一', cls: '801', qstat: A },
    { id: '2', name: '小二', cls: '802', qstat: B }
  ]);
  ok(g['801'][Q.id('甲題')].ok === 0 && g['802'][Q.id('甲題')].ok === 2,
     '★ 兩班分開算 —— 全校加總會把班與班的差異抹平，而那正是要看的東西');
  ok(g[''][Q.id('甲題')].n === 4, "   '' 這個 key 是全部加起來");
}

section('點進某一題：是哪幾個學生');
{
  const stus = [
    { id: '1', name: '小一', cls: '801', qstat: Q.bump({}, '甲題', false) },
    { id: '2', name: '小二', cls: '802', qstat: Q.bump({}, '甲題', true) },
    { id: '3', name: '小三', cls: '801', qstat: {} }
  ];
  const list = Q.forQuestion(stus, Q.id('甲題'));
  ok(list.length === 2, '沒遇過這一題的學生不列（他不是答錯，是沒被抽到）');
  ok(list[0].name === '小一' && list[0].rate === 0, '答對率低的排前面');
  ok(Q.forQuestion(stus, Q.id('甲題'), '801').length === 1, '★ 可以只看某一班');
}

section('上限');
{
  let m = {};
  for (let i = 0; i < Q.CAP + 50; i++) m[Q.id('題' + i)] = { n: i + 1, ok: 0 };
  const t = Q.merge(m, {});
  ok(Object.keys(t).length === Q.CAP, '超過上限會裁掉（' + Object.keys(t).length + '）');
  ok(!t[Q.id('題0')], '★ 裁掉的是被抽到最少次的 —— 它們的統計本來就最不可信');
}

section('接上去的地方');
{
  const eng = fs.readFileSync(path.join(root, 'shared', 'quiz-engine.js'), 'utf8');
  const rep = fs.readFileSync(path.join(root, 'shared', 'report.js'), 'utf8');
  ok(/QSTAT\.bump/.test(eng), '答題時有累加');
  /* ⚠️ 一次挑戰要連對 10 題、容錯 20 題，實際作答可能幾十次。
     每答一題就寫一次 Firestore 的話，一堂課三十個人就是上千次寫入。 */
  ok(!/QSTAT\.bump[\s\S]{0,200}REPORT\.qstat/.test(eng),
     '★ 不是每答一題就寫資料庫（累加在記憶體，挑戰結束才寫一次）');
  ok((eng.match(/saveStat\(\)/g) || []).length >= 3,
     '★ 通關和「答錯太多被導去學習警示」兩條路都要存 —— ' +
     '錯 20 題的人正是最需要被統計到的那一個');
  ok(/qstat: qstat/.test(rep), 'REPORT 有把 qstat 匯出去');
  ok(/QSTAT\.merge\(mod\.qstat, add\)/.test(rep),
     '★ 統計是累加，不是像成績那樣「取最好的一次」');
}

/* ── 教師端那一頁 ─────────────────────────────────
   ⚠️ 2026-08-11 實際踩到：班級清單只出現一部分。
      原因是名單跑的是 progress 集合，再回頭去名冊撈姓名 ——
      於是「還沒有人做過測驗的班級」整個班在畫面上不存在，
      而那正是最需要看到的班（一題都還沒做、或全班都卡住）。
   ★ 名冊是「這學期有哪些學生」的唯一正解；
     進度文件只回答「他做過什麼」，沒做過是空的，不是不存在。 */
section('★ 教師端：名單以名冊為準');
{
  const html = fs.readFileSync(path.join(root, 'shared', 'qstat.html'), 'utf8');
  const code = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(/Object\.keys\(roster\)/.test(code),
     '★ 學生名單是從 roster 展開的 —— 從 progress 展開的話，沒做過的班會整個消失');
  ok(!/ps\.forEach\([\s\S]{0,200}out\.push/.test(code),
     '   不是跑 progress 再回頭撈名冊');
  /* 班級用按鈕，不用下拉 —— 和教師成績登錄系統、繳交審核頁同一套操作。
     ⚠️ 也不顯示人數：這一列是用來切換的，不是用來讀數字的。 */
  ok(/data-cls=/.test(code) && !/<select id="cls"/.test(code),
     '★ 班級是一排按鈕，不是下拉選單（和系統其他頁一致）');
  ok(!/data-cls[\s\S]{0,200}人\)/.test(code), '   按鈕上不掛人數');
  /* 一進來就選好第一個班，不必先點一下才看得到東西。 */
  ok(/if \(!state\.cls && cs\.length\) state\.cls = cs\[0\]/.test(code),
     '   一載入就選好第一個班');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
