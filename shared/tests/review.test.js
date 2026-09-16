/* =====================================================================
   shared/review.html 的班級處理
   ---------------------------------------------------------------------
       node shared/tests/review.test.js

   只測純函式（班級／座號怎麼算、課名怎麼抓班級）。
   ★ 這幾支最容易出的錯是「欄位名寫錯」—— 名冊存的是 cls／no，
     寫成 class／seat 不會報錯，只會讓那一欄永遠空白。
     這種錯眼睛看不出來，要靠測試盯。
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.resolve(__dirname, '..', 'review.html'), 'utf8');
const grab = re => s.match(re)[0];
/* 下面「換班的時間差」那一段要用**真的** findWork —— 自己再寫一份假的，
   測到的就只是那份假的，而不是學生實際會跑到的程式。 */
global.window = {};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; },
                        setItem(k, v) { this._d[k] = String(v); },
                        removeItem(k) { delete this._d[k]; } };
require(path.resolve(__dirname, '..', 'classroom.js'));
const CR = global.window.CLASSROOM;
const API = new Function(
  grab(/function clsOf[\s\S]*?\n\}/) + '\n' +
  grab(/function noOf[\s\S]*?\n\}/) + '\n' +
  'return { clsOf, noOf };'
)();
const { clsOf, noOf } = API;
// classFromCourseName 已經搬到 shared/classroom.js（兩邊都用得到），
// 它的測試在 classroom.test.js

let pass = 0, fail = 0;
const is = (g, w, l) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `　期望 ${JSON.stringify(w)} 實得 ${JSON.stringify(g)}`));
};
const section = t => console.log('\n── ' + t + ' ──');

section('名冊的欄位是 cls／no（不是 class／seat）');
is(clsOf('1410112', { cls: '801', no: '12' }), '801', '名冊有填就用名冊的');
is(noOf('1410112', { cls: '801', no: '12' }), '12', '座號同理');
is(clsOf('1410112', { class: '999', seat: '99' }), '801',
   '★ 寫成 class／seat 的舊欄位不會被誤用（會退回從學號推算）');

section('名冊沒填時從學號推算（1410112 → 801 12 號）');
is(clsOf('1410112', {}), '801', '後四碼 0112 → 班級 801');
is(noOf('1410112', {}), '12', '後兩碼 → 座號 12');
is(clsOf('1411235', {}), '812', '1411235 → 812 班');
is(noOf('1411235', {}), '35', '→ 35 號');
is(clsOf('', {}), '', '學號是空的就不要亂猜');

section('十二個班都認得');
const all = [];
for (let i = 1; i <= 12; i++) {
  const c = '8' + String(i).padStart(2, '0');
  const sid = '141' + String(i).padStart(2, '0') + '07';
  all.push(clsOf(sid, {}) === c);
}
is(all.every(Boolean), true, '801～812 的學號推算都對');

section('學生寫的想法');
/* ── 學生寫的想法（動手之前那一步）─────────────────
   這不是成績，是下一節課的討論素材。所以：看得到、但沒有加分按鈕。 */
{
  const h = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'review.html'), 'utf8');
  is(/modules \|\| \{\}\)\.scratch \|\| \{\}\)\.notes/.test(h), true, '從 modules.scratch.notes 讀出來');
  is(/unitIdOf\('vid'\)/.test(h), true, '照目前選的關卡取，不是整包倒出來');
  is(/他寫的想法/.test(h), true, '卡片上看得到');
  is(/<details/.test(h.slice(Math.max(0, h.indexOf('他寫的想法') - 300))), true, '預設收起來，不然卡片會被長文撐爛');
  is(/whitespace-pre-wrap/.test(h), true, '學生打的換行要留著');
  is(!/data-award[^>]*note|note[^>]*data-award/.test(h), true, '★ 想法旁邊沒有加分按鈕（這不是成績）');
  is(/esc\(s\.note\)/.test(h), true, '★ 學生打的字要跳脫 —— 不然打 <script> 就出事了');
}


section('學生和 AI 的對話（教師端看得到）');
/* ★ 為什麼比「他寫的想法」更值得看
   想法是寫給老師看的、會修飾；跟 AI 講的是卡住當下的原話。
   那才看得出他到底哪裡不懂，也看得出他會不會描述問題 ——
   而「會不會描述問題」正是新手訓練那五關教的東西。 */
is(/\.asks \|\| \{\}/.test(s), true, '教師端讀得到 modules.scratch.asks');
is(/他問了 AI/.test(s), true, '卡片上看得到問了幾次');
is(/esc\(a\.q\)/.test(s) && /esc\(a\.a\)/.test(s), true,
   '★ 學生寫的和 AI 回的都要跳脫 —— 那是使用者輸入，直接塞進 HTML 會出事');
is(/不是成績/.test(s.slice(Math.max(0, s.indexOf('const asks') - 500), s.indexOf('const asks'))), true,
   '註解要講明這不是成績（免得日後有人在旁邊加上加分按鈕）');


/* =====================================================================
   換班的時間差：「Requested entity was not found.」
   ---------------------------------------------------------------------
   ⛔⛔ 2026-09-16 老師回報：「偶爾會出現 studentSubmissions.list API
      呼叫失敗（Requested entity was not found.）… 下拉選單看得到作業清單，
      手動選取一次後就能自動讀取了，為什麼？」

   ★ 因為那不是「手動比較可靠」，是**時間差**：
     pickCourse 第一行就把 courseId 換成新課程，但作業清單要等網路。
     那個空窗期裡 state.cr.works 還是**上一門課**的清單，
     而每一班的作業標題都一樣 ⇒ 比對照樣配得到，配到的卻是舊課的 id。
     拿舊課的作業 id 去問新課，Classroom 回的就是 not found。
     老師手動點下拉選單那幾秒，剛好夠新清單載完。

   ★★ 這種 bug 靜態檢查抓不到 —— 程式碼每一行單獨看都是對的，
      錯的是「兩件事完成的先後」。所以這一段是真的把時序跑一遍。
   ===================================================================== */
section('換班的時間差（Requested entity was not found）');

function mkEnv(opts) {
  const state = {
    klass: '801', no: 2, busy: '',
    cr: { on: true, err: '', courses: [{ id: 'C1', name: '資訊科技 801' },
                                       { id: 'C2', name: '資訊科技 802' }],
          works: [{ id: 'W-801', title: '集合點名 (2-1-1B)' }],
          courseId: 'C1', workId: '', rows: {}, matched: '', ambiguous: null }
  };
  const calls = [];
  const CLASSROOM = {
    classFromCourseName: () => '',
    findWork: CR.findWork,                       // ★ 用真的比對邏輯
    coursework: (id) => { calls.push(['coursework', id]); return opts.cw(id); },
    submissions: (cid, wid) => {
      calls.push(['submissions', cid, wid]);
      return (opts.subs || (() => Promise.resolve({ ok: 1 })))(cid, wid);
    }
  };
  const api = new Function(
    'state', 'CLASSROOM', 'KINDS', 'unitIdOf', 'render', 'allClasses',
    grab(/async function pickCourse[\s\S]*?\n\}/) + '\n' +
    grab(/async function loadThisUnit[\s\S]*?\n\}/) + '\n' +
    grab(/async function pickWork[\s\S]*?\n\}/) + '\n' +
    'return { pickCourse, loadThisUnit, pickWork };'
  )(state, CLASSROOM, { img: {}, vid: {} }, () => '2-1-1B', () => {}, () => []);
  return { state, calls, api };
}

(async () => {
  const tick = () => new Promise(r => setTimeout(r, 0));

  /* ── 情境一：換班之後、作業清單還沒回來就按「讀取這一關」 ── */
  {
    let release;
    const env = mkEnv({ cw: () => new Promise(r => { release = r; }) });
    env.api.pickCourse('C2');                 // 故意不 await：模擬還在載
    await env.api.loadThisUnit();             // 老師在空窗期按下去

    is(env.calls.filter(c => c[0] === 'submissions').length, 0,
       '★★★ 清單還沒載完時**完全不可以**去問繳交 —— ' +
       '問了就是拿舊課的作業 id 去問新課，那就是 not found 的來源');
    is(/還沒載完/.test(env.state.cr.err), true,
       '★★ 而且要說「還沒載完」，不可以說「找不到」—— ' +
       '說找不到，老師會跑去改 Classroom 的作業標題，那是白費工');

    release([{ id: 'W-802', title: '集合點名 (2-1-1B)' }]);
    await tick();
    await env.api.loadThisUnit();             // 載完之後再按一次
    const asked = env.calls.filter(c => c[0] === 'submissions');
    is(asked.length === 1 && asked[0][1] === 'C2' && asked[0][2] === 'W-802', true,
       '★★ 載完之後才去問，而且問的是**新課的**作業 id');
  }

  /* ── 情境二：連按兩次換班，第一次的回應比較晚回來 ── */
  {
    const pending = {};
    const env = mkEnv({ cw: (id) => new Promise(r => { pending[id] = r; }) });
    env.api.pickCourse('C2');
    env.api.pickCourse('C1');                 // 老師又換回去
    pending['C1']([{ id: 'W-801', title: '集合點名 (2-1-1B)' }]);
    pending['C2']([{ id: 'W-802', title: '集合點名 (2-1-1B)' }]);   // 舊的晚到
    await tick(); await tick();
    is(env.state.cr.works.map(w => w.id), ['W-801'],
       '★★★ 晚到的舊回應不可以蓋掉新的 —— 蓋掉的話畫面上是 801 的課，' +
       '作業清單卻是 802 的，而且完全看不出來');
  }

  /* ── 情境三：問繳交的途中換了班 ── */
  {
    let release;
    const env = mkEnv({ cw: () => Promise.resolve([]),
                        subs: () => new Promise(r => { release = r; }) });
    env.state.cr.rows = { 舊班的資料: 1 };
    const p = env.api.pickWork('W-801');      // 對 C1 發問
    env.state.cr.courseId = 'C2';             // 途中換班
    release({ 新班的資料: 1 });
    await p;
    is(env.state.cr.rows, { 舊班的資料: 1 },
       '★★★ 換班之後才回來的繳交資料不可以蓋上去 —— ' +
       '蓋上去就是對著 801 的繳交，幫 802 的學生加分');
  }

  console.log(`\n通過 ${pass}／失敗 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

