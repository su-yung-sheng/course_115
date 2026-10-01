/* 程式錄影加分要 3⭐：沒有 3⭐ ⇒ 不提供加分、自動退件、學生看得到提醒
   跑法：node shared/tests/vidstars.test.js

   ★ 老師 2026-10-01：「程式設計如果因為輸出被扣分，那是不是達不到三星，
     這樣就不達加分原則了，如果沒有三星，自動幫忙回覆訊息，提醒學生三星後
     再錄影繳交，教師後端直接不提供加分選項，也自動設定為退件狀態」
   ★ 這一支把 review.html 的 autoRejectShort／reject／award 真的跑起來（假的 Firestore），
     規則本身用真的 shared/grading.js。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const gw = {}; new Function('window', read('shared/grading.js'))(gw);
const G = gw.GRADING;
const R = read('shared/review.html');
const fn = name => (R.match(new RegExp('(async )?function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')) || [''])[0];
const KINDS_SRC = (R.match(/const KINDS = \{[\s\S]*?\n\};\n/) || [''])[0];
const DEL = { __delete: true };

section('① 規則（shared/grading.js）');
ok(G.VID_NEED_STARS === 3, '★★★ 錄影加分的門檻是 3⭐');
const P = s => ({ modules: { scratch: { unitStars: { '2-1-2': s } } } });
ok(G.vidEligible(P(3), '2-1-2').ok && !G.vidEligible(P(2), '2-1-2').ok && !G.vidEligible({}, '2-1-2').ok,
   '★★ 3⭐ 可以；2⭐、沒成績都不行');
ok(G.vidEligible(P(2), '2-1-2').stars === 2, '回報目前幾顆');
const why = G.vidShortReason(2);
ok(/目前 2⭐/.test(why) && /3⭐/.test(why) && /重新錄影/.test(why) && /Classroom/.test(why),
   '★★ 給學生看的那一句：目前幾顆、要 3⭐、改好再重新錄影上傳 Classroom');

function makeCtx(progress, studs) {
  const writes = [];
  const ctx = {
    FLOW: [{ id: '2-1-2', no: 1 }], PROG: [{ id: '2-1-2', no: 1 }],
    state: { no: 1, progress, who: { email: 't@school' }, msg: '', busy: '',
             cr: { works: [{ id: 'w1', title: '演奏小星星 (2-1-2)' }], workId: 'w1' } },
    GRADING: G, window: { GRADING: G },
    CLASSROOM: { handedIn: () => true },
    db: {}, PROGRESS: '11501-progress', doc: (db, c, id) => ({ c, id }),
    setDoc: async (ref, data, o) => { writes.push({ ref, data, o }); },
    deleteField: () => DEL, arrayUnion: x => ({ union: x }),
    render: () => {}, confirm: () => true, students: () => studs,
    Date, Object, String, Number, console,
  };
  vm.createContext(ctx);
  vm.runInContext(KINDS_SRC.replace('const KINDS', 'var KINDS') + fn('unitIdOf') + fn('award')
                  + fn('reject') + fn('autoRejectShort'), ctx);
  return { ctx, writes };
}
const vidOf = w => (((w.data.modules || {}).scratch || {}).vidReview || {})['2-1-2'];
const stu = (sid, per) => ({ sid, sub: { updateTime: 'x' }, per: { vid: Object.assign(
  { short: true, vstars: 2, given: false, atts: [{ link: 'v' }], rej: null, resub: false }, per) } });

(async () => {
  ok(fn('autoRejectShort') && fn('reject') && fn('award'), '找得到 autoRejectShort、reject、award');

  section('② 讀完繳交就自動退件');
  {
    const studs = [
      stu('A', {}),                                                       // 2⭐、交了錄影 ⇒ 退
      stu('B', { short: false }),                                         // 3⭐ ⇒ 不動
      stu('C', { given: true }),                                          // 已給過分 ⇒ 不動
      stu('D', { atts: [] }),                                             // 沒交錄影 ⇒ 不動
      stu('E', { rej: { reason: 'x', at: 5 }, resub: false }),            // 已退過、沒重交 ⇒ 不再寫
      stu('F', { rej: { reason: 'x', at: 5 }, resub: true, vstars: 0 })   // 退過、重交了、還是不夠 ⇒ 再退
    ];
    const prog = {}; studs.forEach(s => { prog[s.sid] = { modules: {} }; });
    const { ctx, writes } = makeCtx(prog, studs);
    await ctx.autoRejectShort();
    const who = writes.map(w => w.ref.id).sort().join(',');
    ok(who === 'A,F', '★★★ 只退「不到 3⭐、交了錄影、沒給過分、還沒退過（或退了又重交）」的（實得 ' + who + '）');
    const a = writes.find(w => w.ref.id === 'A');
    ok(a && vidOf(a) && /目前 2⭐/.test(vidOf(a).reason) && vidOf(a).auto === 'vid-stars',
       '★★ 退件原因就是給學生看的提醒，並標明是系統自動退的');
    const f = writes.find(w => w.ref.id === 'F');
    ok(f && /目前 0⭐/.test(vidOf(f).reason), '重交了還是不夠 ⇒ 再退一次（原因跟著目前的星數）');
    ok(writes.every(w => !((w.data.modules.scratch || {}).vidUnits)), '★★★ 自動退件絕對不碰加分欄位');
    ok(/已自動退件 2 份/.test(ctx.state.msg), '★ 畫面上告訴老師退了幾份');
  }

  section('③ 不提供加分');
  {
    const studs = [stu('A', {})];
    const { ctx, writes } = makeCtx({ A: { modules: {} } }, studs);
    await ctx.award('A', 'vid', true);
    ok(writes.length === 0 && /3⭐/.test(ctx.state.msg), '★★★ 不到 3⭐ 硬按加分也寫不進去（畫面上本來就沒有按鈕）');
  }
  {
    const studs = [stu('A', { given: true })];
    const { ctx, writes } = makeCtx({ A: { modules: { scratch: { vidUnits: { '2-1-2': { at: 1 } } } } } }, studs);
    await ctx.award('A', 'vid', false);
    ok(writes.length === 1 && writes[0].data.modules.scratch.vidUnits['2-1-2'] === DEL
       && writes[0].data.history.union.stars === -1,
       '★★★ 10/1 前給的、程式不到 3⭐ 的加分，老師要收回 ⇒ 取消照樣寫得進去（擋的只有「給」）');
  }
  {
    const pw = fn('pickWork');
    ok(/await autoRejectShort\(\);/.test(pw), '★★ 讀完這一關的繳交就自動做，不必老師按');
    const prev = R.slice(R.indexOf('function openPreview'), R.indexOf('function openRejectPanel'));
    const iShort = prev.indexOf("s.per[kk].short"), iBtn = prev.indexOf('id="modal-award"');
    ok(iShort > 0 && iShort < iBtn && /未達 \$\{GRADING\.VID_NEED_STARS\}⭐，錄影不能加分/.test(prev),
       '★★★ 預覽視窗：不到 3⭐ 就不畫加分按鈕，改寫一句原因');
    const blk = fn('block');
    ok(/p\.short && has/.test(blk) && /不能加分/.test(blk), '★★ 學生小卡上直接標「未達 3⭐ 不能加分」');
  }

  section('③-2 真的 students()：星數從學生進度算出來');
  {
    const prog = {
      S2: { modules: { scratch: { unitStars: { '2-1-2': 2 } } } },
      S3: { modules: { scratch: { unitStars: { '2-1-2': 3 } } } }
    };
    const { ctx, writes } = makeCtx(prog, null);
    ctx.state.roster = { S2: { name: '甲' }, S3: { name: '乙' } };
    ctx.state.klass = '';
    ctx.state.cr.rows = { S2: { updateTime: '2026-10-01T00:00:00Z', attachments: [] },
                          S3: { updateTime: '2026-10-01T00:00:00Z', attachments: [] } };
    ctx.clsOf = () => '801'; ctx.noOf = () => 1;
    ctx.attOf = (sub, kind) => kind === 'video' ? [{ link: 'v' }] : [];
    ctx.CLASSROOM.guessKind = () => 'video';
    vm.runInContext(fn('students') + 'var students = students;', ctx);
    const list = ctx.students();
    const by = {}; list.forEach(s => { by[s.sid] = s.per.vid; });
    ok(by.S2 && by.S2.short === true && by.S2.vstars === 2 && by.S3 && by.S3.short === false,
       '★★★ 2⭐ 的標成不能加分、3⭐ 的可以（從 unitStars 算，不是寫死）');
    await ctx.autoRejectShort();
    ok(writes.map(w => w.ref.id).join(',') === 'S2', '★★ 串起來跑：只退 2⭐ 那一位');
  }

  section('④ 學生端看得到');
  ok(/拿到 '\+\(\(\(window\.GRADING\|\|\{\}\)\.VID_NEED_STARS\)\|\|3\)\+'⭐ 才能錄影繳交/.test(read('11501/flowchart.html')),
     '★ 11501 關卡卡片：最後一顆錄影加分寫明「拿到 3⭐ 才能錄影繳交」');
  ok(/<b>拿到 3⭐ 之後<\/b>再交程式錄影/.test(read('11502/scratch.html')), '★ 11502 說明也寫明');
  ok(/vidRej/.test(read('11501/flowchart.html')) && /vidReview/.test(read('11502/scratch.html')),
     '★★ 兩學期的闖關頁本來就會顯示退件原因（自動退件的提醒就從這裡出來）');

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ❌ 測試本身出錯：' + e.stack); process.exit(1); });
