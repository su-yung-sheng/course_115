/* 可疑紀錄偵測：Scratch 星星 ↔ 批改紀錄、測驗作答過程
   跑法：node shared/tests/audit.test.js

   ★ 老師 2026-09-27：「如何防止類似 Tampermonkey 的攻擊？」
     瀏覽器裡擋不住，所以先做到**看得到**。
     這一份測的是 shared/audit.js 的判斷，和 shared/audit.html 必須「只讀」。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const AUDIT = require(path.join(ROOT, 'shared', 'audit.js'));
global.window = {};                                   // grading.js 掛在 window 上
require(path.join(ROOT, 'shared', 'grading.js'));
const GRADING = global.window.GRADING || global.GRADING;

section('① Scratch：每一顆星都要找得到分數夠的批改紀錄');
ok(GRADING && typeof GRADING.scratchStar === 'function', '載得到 GRADING.scratchStar（星等規則只有那一份）');
const prog = sid => stars => scores => ({ [sid]: { modules: { scratch: { unitStars: stars, unitScores: scores } } } });

// 正常：有 95 分的批改紀錄、紀錄上 3⭐ 95 分
let f = AUDIT.scratch(prog('1410101')({ '2-1-1A': 3 })({ '2-1-1A': 95 }),
                      [{ student_id: '1410101', unit: '2-1-1A', score: 95 }], GRADING);
ok(f.length === 0, '★ 有對應批改紀錄的星星不可以被標出來　←　' + JSON.stringify(f));

// ⛔ 主控台一行 reportScratch(sid, '2-1-3', 100)：後端完全沒有紀錄
f = AUDIT.scratch(prog('1410101')({ '2-1-3': 3 })({ '2-1-3': 100 }), [], GRADING);
ok(f.length === 1 && f[0].kind === 'no-record',
   '★★★ 後端沒有任何批改紀錄的星星要標出來（這就是主控台偽造的形狀）');

// ⛔ 真的交過 60 分（0⭐），卻寫成 3⭐
f = AUDIT.scratch(prog('1410101')({ '2-1-2': 3 })({ '2-1-2': 100 }),
                  [{ student_id: '1410101', unit: '2-1-2', score: 60 }], GRADING);
ok(f.length === 1 && f[0].kind === 'star-exceeds' && f[0].graded === 60,
   '★★★ 批改最高分不夠那個星數要標出來');

// ⛔ 星數對得上（都是 3⭐），但分數被改高
f = AUDIT.scratch(prog('1410101')({ '2-1-2': 3 })({ '2-1-2': 100 }),
                  [{ student_id: '1410101', unit: '2-1-2', score: 92 }], GRADING);
ok(f.length === 1 && f[0].kind === 'score-exceeds', '★★ 分數比批改最高分還高要標出來');

// 取「最高」那一筆，不是最後一筆
f = AUDIT.scratch(prog('1410101')({ '2-1-1B': 3 })({ '2-1-1B': 100 }),
                  [{ student_id: '1410101', unit: '2-1-1B', score: 100 },
                   { student_id: '1410101', unit: '2-1-1B', score: 50 }], GRADING);
ok(f.length === 0, '★★ 重交考差不影響：比的是批改過的**最高**分');

// 0 星的關卡不必對
f = AUDIT.scratch(prog('1410101')({ '2-1-1B': 0 })({ '2-1-1B': 50 }), [], GRADING);
ok(f.length === 0, '★ 沒有星星的關卡不列（沒有東西要對）');

// 2026-09-16 以前的紀錄：關卡代號在 theme 裡
ok(AUDIT.unitOfSubmission({ theme: '[2-1-1B] 集合點名' }) === '2-1-1B',
   '★★★ 舊紀錄沒有 unit 欄位，要從 theme 的「[2-1-1B]」讀出來 —— 不然九月上旬的都會被誤標');
f = AUDIT.scratch(prog('1410101')({ '2-1-1B': 3 })({ '2-1-1B': 100 }),
                  [{ student_id: '1410101', theme: '[2-1-1B] 集合點名', score: 100 }], GRADING);
ok(f.length === 0, '★★ 用 theme 對到的舊紀錄一樣算數');

// 別人的紀錄不算
f = AUDIT.scratch(prog('1410101')({ '2-1-1A': 3 })({ '2-1-1A': 100 }),
                  [{ student_id: '1410102', unit: '2-1-1A', score: 100 }], GRADING);
ok(f.length === 1 && f[0].kind === 'no-record', '★★ 別人的批改紀錄不可以拿來抵');

// 失敗的批改（沒有分數）不算
f = AUDIT.scratch(prog('1410101')({ '2-1-1A': 2 })({ '2-1-1A': 80 }),
                  [{ student_id: '1410101', unit: '2-1-1A', score: null }], GRADING);
ok(f.length === 1, '★ 沒有分數的紀錄不算批改過');

section('② 章節測驗：沒有作答過程、像腳本的速度');
const AT = Date.UTC(2026, 8, 20);
const h = entries => ({ '1410101': { history: entries } });

// 正常：測驗畫面寫的，帶 duration 和 pace（最慢一題 12 秒）
f = AUDIT.quiz(h([{ module: 'ethics', unit: '5-2', at: AT, duration: '02:10',
                    pace: { med: 4, min: 2, max: 12, n: 10 }, score: 100 }]));
ok(f.length === 0, '★ 正常的通關紀錄不可以被標出來');

// ⛔ 主控台 REPORT.unit('ethics','5-2',{star:3,score:100})：沒有任何作答過程
f = AUDIT.quiz(h([{ module: 'ethics', unit: '5-2', at: AT, stars: 3, got: 3, score: 100 }]));
ok(f.length === 1 && f[0].kind === 'no-trace',
   '★★★ 沒有 duration 也沒有 pace 的通關紀錄要標出來（直接寫進去的形狀）');

// ⛔ 自動作答外掛（2026-09-11 真的遇過）
f = AUDIT.quiz(h([{ module: 'ethics', unit: '5-2', at: AT, duration: '00:12',
                    pace: { med: 1, min: 0, max: 1, n: 10 }, score: 100 }]));
ok(f.length === 1 && f[0].kind === 'robot', '★★★ 連最慢一題都在 1 秒內要標出來');

// 手速快但有長尾：不可以冤枉
f = AUDIT.quiz(h([{ module: 'ethics', unit: '5-2', at: AT, duration: '00:40',
                    pace: { med: 1, min: 0, max: 9, n: 10 }, score: 100 }]));
ok(f.length === 0, '★★★ 中位數很快但有一題想很久 ⇒ 是人，不可以標');

// 題數太少沒有統計意義
ok(!AUDIT.isRobotPace({ med: 0, min: 0, max: 1, n: 3 }), '★ 題數少於 5 題不判');
ok(!AUDIT.isRobotPace({ med: 1, min: 0 }), '★ 舊紀錄沒有 max 就不判（寧可漏掉，不可冤枉）');

// 舊格式（2026-08-11 以前的頁面寫 chapter）本來就沒有作答過程
f = AUDIT.quiz(h([{ module: 'ethics', chapter: '5-1', at: AT, stars: 3 }]));
ok(f.length === 0, '★★ 舊版頁面（chapter 格式）本來就沒有作答過程，不可以標');

// 引擎開始記 duration 之前的紀錄
f = AUDIT.quiz(h([{ module: 'ethics', unit: '5-1', at: Date.UTC(2026, 7, 1), stars: 3 }]));
ok(f.length === 0, '★★ 2026-08-18 以前的紀錄不用「沒有作答過程」判');

// 別的模組不歸這裡管
f = AUDIT.quiz(h([{ module: 'scratch', unit: '2-1-1A', at: AT, score: 100 }]));
ok(f.length === 0, '★ Scratch 的 history 不是測驗，不可以用測驗的標準判');

section('②½ 後端星星核對（四步切換的第 ②步）');
{
  const pv = {
    a: { modules: { scratch: { unitStars: { '2-1-1A': 3 } } }, scratchVerified: { unitStars: { '2-1-1A': 3 }, gains: [{}, {}] } },
    /* b：開學時拿過 3⭐（後端還沒上線），上線後重交考 80 分 ⇒ 後端記 2⭐。
       後端比前端少，是正常的。⚠️ 第一版這裡寫成兩邊都是 2⭐，
       根本沒測到「比較少」這件事 —— 突變驗證抓到的。 */
    b: { modules: { scratch: { unitStars: { '2-1-1A': 3, '2-1-1B': 2 } } }, scratchVerified: { unitStars: { '2-1-1A': 2, '2-1-1B': 2 }, gains: [{}] } },
    c: { modules: { scratch: { unitStars: {} } }, scratchVerified: { unitStars: { '2-1-2': 3 }, gains: [{}] } },
    d: { modules: { scratch: { unitStars: { '2-1-1A': 3 } } } }
  };
  const v = AUDIT.verified(pv);
  ok(v.students === 3 && v.gradings === 4, '只算有後端星星的學生（d 還沒被後端批改過）');
  ok(v.behind.length === 1 && v.behind[0].sid === 'c' && v.behind[0].back === 3,
     '★★★ 後端比前端多 ⇒ 前端那一次沒寫進去，要列出來');
  ok(!v.behind.some(x => x.sid === 'b'),
     '★★★ 後端比前端少是**正常的**（後端只從上線那一刻開始記），不可以列');
}

section('③ 頁面：只讀、只有老師、兩個教師端都連得到');
const P = fs.readFileSync(path.join(ROOT, 'shared', 'audit.html'), 'utf8');
const code = P.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');   // 去註解再做負面斷言
ok(!/\b(setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction|arrayUnion|deleteField)\b/.test(code),
   '★★★ 偵測頁不可以有任何寫入 —— 系統上線中也要能放心按');
ok(/AUTH\.isTeacherEmail/.test(code) && /if \(!isTeacher\(u\)\)/.test(code),
   '★★★ 只有老師帳號才讀資料（全班成績不可以讓學生帳號讀）');
ok(/SUBMISSIONS/.test(code) && /COL\.SUBMISSIONS/.test(code),
   '★★ 批改紀錄的集合名稱要從 config.js 來，不寫死學期');
ok(/AUDIT\.verified\(state\.progress\)/.test(code), '★★ 頁面要有後端星星核對（第 ②步用）');
ok(/state\.subErr/.test(code) && /state\.quiz = AUDIT\.quiz/.test(code),
   '★★ 批改紀錄讀不到時，測驗那一半照樣要能看');
ok(/audit\.js/.test(P) && /grading\.js/.test(P), '★ 要載入 audit.js 和 grading.js');
ok(/不是判定/.test(P), '★★ 畫面上要講明「是提醒不是判定」');
ok(!/作弊/.test(code.replace(/<[^>]+>/g, '')) ,
   '★★ 畫面文字不可以寫「作弊」—— 找不到紀錄也可能是後端當時沒寫進去');

section('④ 程式錄影已加分、但程式現在不到 3⭐（老師 2026-10-01）');
{
  const P = {
    A: { modules: { scratch: { unitStars: { '2-1-2': 2, '2-1-3': 3 },
                               vidUnits: { '2-1-2': { at: 5, by: 't@x' }, '2-1-3': { at: 6, by: 't@x' } } } } },
    B: { modules: { scratch: { unitStars: {}, vidUnits: { '2-1-1A': { at: 7 } } } } },   // 沒有程式星星
    C: { modules: { scratch: { unitStars: { '2-1-1A': 2 }, vidUnits: { '2-1-1A': null } } } }, // 取消過（2⭐ 也不列）
    D: { modules: {} }
  };
  const v = AUDIT.vidShort(P, GRADING);
  const key = v.map(x => x.sid + ':' + x.unit + ':' + x.stars).sort().join(',');
  ok(key === 'A:2-1-2:2,B:2-1-1A:0', '★★★ 只列「錄影已加分、那一關程式現在不到 3⭐」的（實得 ' + key + '）');
  ok(v.find(x => x.sid === 'A').at === 5 && v.find(x => x.sid === 'A').by === 't@x', '帶加分時間與誰給的');
  ok(AUDIT.vidShort({}, GRADING).length === 0 && AUDIT.vidShort(null, GRADING).length === 0, '沒資料不出錯');
  const H = fs.readFileSync(path.join(ROOT, 'shared', 'audit.html'), 'utf8');
  ok(/state\.vid = AUDIT\.vidShort\(state\.progress, window\.GRADING\);/.test(H) &&
     /⑤ 程式錄影已加分、但程式不到/.test(H) && /\$\{vs\.length\} 筆/.test(H),
     '★★ 可疑紀錄頁有這一區，顯示筆數');
}

for (const term of ['11501', '11502']) {
  const T = fs.readFileSync(path.join(ROOT, term, 'teacher.html'), 'utf8');
  ok(T.includes(`../shared/audit.html?term=${term}`), `★★ ${term} 教師端要有「可疑紀錄」的入口`);
  ok(T.includes('<script src="../shared/audit.js"></script>'), `★★ ${term} 教師端要載入 audit.js`);
  const tc = T.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/const robot = !!\(window\.AUDIT && AUDIT\.isRobotPace\(p\)\)/.test(tc) &&
     !/p\.max <= 1/.test(tc),
     `★★★ ${term} 學生面板的 ⚠ 要用 AUDIT.isRobotPace —— 門檻只能有一份`);
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
