/* 繳交審核：不符合加分條件 ⇒ 退件、學生看得到、補交後老師看得到
   跑法：node shared/tests/reviewreject.test.js

   ★ 老師 2026-09-22：「如果附檔不符合加分條件，要如何讓學生知道並重新補件？
     否則會認為教師都沒批改」。
   ⚠️ Classroom API 退不回「在 Classroom 網頁上建的作業」（只能退同一個
      API 專案建的），所以退件訊息放在我們自己的闖關頁面。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const R = fs.readFileSync(path.join(ROOT, 'shared', 'review.html'), 'utf8');
const fn = name => (R.match(new RegExp('(async )?function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')) || [''])[0];
const KINDS_SRC = (R.match(/const KINDS = \{[\s\S]*?\n\};\n/) || [''])[0];

const DEL = { __delete: true };
function makeCtx(progress, opts = {}) {
  const writes = [];
  const ctx = {
    FLOW: [{ id: '2-1-1A', no: 1 }], PROG: [{ id: '2-1-1A', no: 1 }],
    state: { no: 1, progress, who: { email: 't@school' }, msg: '', busy: '',
             cr: { works: [{ id: 'w1', title: '1.班級置物櫃 (2-1-1A)' }], workId: 'w1' } },
    GRADING: { BONUS: { img: 1, vid: 1 }, hasBonus: (m, u) => !!((m || {})[u]) },
    window: { GRADING: { BONUS: { img: 1, vid: 1 } } },
    db: {}, PROGRESS: '11501-progress', doc: (db, c, id) => ({ c, id }),
    setDoc: async (ref, data, o) => { writes.push({ ref, data, o }); },
    deleteField: () => DEL, arrayUnion: x => ({ union: x }),
    render: () => {}, confirm: () => true, students: () => [],
    Date, Object, String, Number, console,
  };
  vm.createContext(ctx);
  vm.runInContext(KINDS_SRC.replace('const KINDS', 'var KINDS') + fn('unitIdOf') + fn('award') + fn('reject'), ctx);
  return { ctx, writes };
}
const mods = w => w.data.modules;

(async () => {
  ok(KINDS_SRC && fn('award') && fn('reject'), '找得到 KINDS、award、reject');

  section('★★★ 取消加分真的會刪掉（修掉既有的 bug）');
  {
    const { ctx, writes } = makeCtx({ S1: { modules: { flowchart: { imgUnits: {
      '2-1-1A': { at: 1 }, '2-1-2': { at: 2 } } } } } });
    await ctx.award('S1', 'img', false);
    const m = writes[0] && mods(writes[0]).flowchart;
    ok(m && m.imgUnits && m.imgUnits['2-1-1A'] === DEL,
       '★★★ 取消要寫 deleteField() —— 原本寫「整份 map 少一格」再 merge，'
       + 'Firestore 對巢狀 map 是逐欄合併，少掉的那格根本不會被刪（重新整理加分又回來）');
    ok(m && !('2-1-2' in m.imgUnits), '★★ 只動這一關，不要把別關的加分整份重寫一次');
    ok(writes[0].data.history.union.stars === -1, '週成績那一筆照樣記 −1');
  }

  section('★★★ 退件');
  {
    const { ctx, writes } = makeCtx({ S1: { modules: {} } });
    await ctx.reject('S1', 'vid', '影片沒有展示程式執行的過程');
    const w = writes[0];
    const r = w && mods(w).scratch && mods(w).scratch.vidReview && mods(w).scratch.vidReview['2-1-1A'];
    ok(!!r && r.reason === '影片沒有展示程式執行的過程', '★★★ 退件寫進 vidReview，帶著原因（學生會照字看到）');
    ok(r && r.work === '1.班級置物櫃 (2-1-1A)', '★★ 記下是哪一份 Classroom 作業 —— 學生才知道要去哪裡重交');
    ok(w && !('vidUnits' in mods(w).scratch),
       '★★★ 退件**不可以**寫進 vidUnits —— GRADING.bonusStars 會把那裡每一筆都算成一顆星');
    ok(w && !('history' in w.data), '★★ 退件不是加減星，不寫 history（週成績不動）');
    ok(ctx.state.progress.S1.modules.scratch.vidReview['2-1-1A'], '本機狀態同步更新，畫面立刻變色');
  }
  {
    const { ctx, writes } = makeCtx({ S1: { modules: { scratch: { vidUnits: { '2-1-1A': { at: 1 } } } } } });
    await ctx.reject('S1', 'vid', '不是這一關的作品');
    ok(writes.length === 0 && /先取消加分/.test(ctx.state.msg),
       '★★ 已經給過分的不可以直接退件 —— 要先取消加分，星星才不會留在那裡');
  }
  {
    const { ctx, writes } = makeCtx({ S1: { modules: { flowchart: { imgReview: { '2-1-1A': { reason: 'x', at: 1 } } } } } });
    await ctx.reject('S1', 'img', '');
    ok(writes[0] && mods(writes[0]).flowchart.imgReview['2-1-1A'] === DEL, '★★ 撤回退件＝deleteField()');
  }
  {
    const { ctx, writes } = makeCtx({ S1: { modules: { flowchart: { imgReview: { '2-1-1A': { reason: 'x', at: 1 } } } } } });
    await ctx.award('S1', 'img', true);
    const m = writes[0] && mods(writes[0]).flowchart;
    ok(m && m.imgUnits['2-1-1A'] && m.imgUnits['2-1-1A'].by === 't@school', '補交後給分：加分照寫');
    ok(m && m.imgReview && m.imgReview['2-1-1A'] === DEL,
       '★★★ 給分時要把退件一起清掉 —— 不然學生拿到星星了，畫面還寫著「還差一點」');
  }

  section('★★ 審核頁看得出「退件後重交了」');
  {
    const st = fn('students');
    ok(/rej: uid \?/.test(st) && /k\.rfield/.test(st), 'students() 讀退件（從 rfield 讀）');
    ok(/per\[kk\]\.resub = !!\(per\[kk\]\.rej && subAt && subAt > \(Number\(per\[kk\]\.rej\.at\)/.test(st),
       '★★★ Classroom 的繳交時間比退件晚 ⇒ 標成「重交了，請再看一次」—— 不然老師不知道要回來審');
    const blk = fn('block');
    ok(/p\.rej && !p\.resub\) \? 'bg-rose-50/.test(blk), '★ 退件（還沒重交）是玫瑰色框，和沒交／可審／已加分分得開');
    ok(/退件後已重新繳交，請再看一次/.test(blk) && /已退件：\$\{esc\(p\.rej\.reason\)\}/.test(blk), '★★ 卡片上寫出退件原因與重交狀態');
  }
  {
    const code = R.replace(/\/\*[\s\S]*?\*\//g, '');
    ok(/if \(!reason\) \{/.test(code) && /請先選一個原因或自己寫一句/.test(code),
       '★★★ 沒寫原因不能送 —— 學生只看到「被退件」卻不知道為什麼，比沒退件更糟');
    ok(/modal-reject/.test(code) && /openRejectPanel/.test(code), '預覽視窗裡有「不符合，請補件」');
    ok(/data-reason/.test(code), '★ 常見原因一鍵選');
  }

  section('★★★ 學生看得到（11501 流程圖／程式設計地圖）');
  {
    const F = fs.readFileSync(path.join(ROOT, '11501', 'flowchart.html'), 'utf8');
    ok(/state\.imgReview = \(mods\.flowchart && mods\.flowchart\.imgReview\)/.test(F)
       && /state\.vidReview = \(mods\.scratch && mods\.scratch\.vidReview\)/.test(F), '讀出兩種退件');
    ok(/const imgRej = !imgOn && /.test(F) && /const vidRej = !vidOn && /.test(F),
       '★★ 已經拿到加分的不顯示退件（萬一沒清乾淨也不會自相矛盾）');
    ok(/老師看過你的\$\{lab\}，還差一點：<\/b>\$\{esc\(r\.reason/.test(F), '★★★ 那一關的卡片上寫出原因');
    ok(/Google Classroom/.test(F) && /重新繳交/.test(F), '★★★ 告訴他要去哪裡、做什麼（到 Classroom 重交）');
    ok(/有 \$\{n\} 關需要補件/.test(F), '★★ 最上面講一次總共幾關要補 —— 不要讓他一關一關翻');
  }
  section('★★★ 學生看得到（11502 程式設計地圖）');
  {
    const S = fs.readFileSync(path.join(ROOT, '11502', 'scratch.html'), 'utf8');
    ok(/window\.applyStars = function \(obj, pre, quiz, play, vid, rev\)/.test(S)
       && /mods\.scratch\.vidReview/.test(S), '讀出退件（applyStars 多帶一個參數）');
    ok(/const rej = !vidUnits\[u\.id\] && vidReview\[u\.id\]/.test(S), '已加分的不顯示退件');
    ok(/老師看過你的程式錄影，還差一點/.test(S) && /escR\(rej\.reason\)/.test(S), '★★★ 卡片寫出原因（有跳脫）');
    ok(/id="review-note"/.test(S) && /有 \$\{n\} 關需要補件/.test(S), '★★ 最上面講總共幾關要補');
  }

  section('★★ 規則：學生改不動退件');
  {
    const RU = fs.readFileSync(path.join(ROOT, 'shared', 'firestore.rules'), 'utf8');
    const bu = (RU.match(/function bonusUnchanged\(\) \{[\s\S]*?\n    \}/) || [''])[0];
    ok(/imgReviewOf\(request\.resource\.data\) == imgReviewOf\(resource\.data\)/.test(bu)
       && /vidReviewOf\(request\.resource\.data\) == vidReviewOf\(resource\.data\)/.test(bu),
       '★★ 學生不能刪掉自己的退件 —— 刪了老師的審核頁會以為還沒審');
    const be = (RU.match(/function bonusEmpty\(\) \{[\s\S]*?\n    \}/) || [''])[0];
    ok(/imgReviewOf/.test(be) && /vidReviewOf/.test(be), '建立文件時也不可以夾帶退件');
  }

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
