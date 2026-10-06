/* 教師端「🏆 排行賽」：全部參賽者的名次
   跑法：node shared/tests/arenarank.test.js

   ★ 老師 2026-10-06：「教師端看不到排行賽排名」。
     學生頁只給前 30 名的學號；老師這一頁直接從 Firestore 讀全部（規則開給老師讀），
     加上班級、座號、姓名、場數、離開／超時、像腳本的場次。 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const R = require(path.join(ROOT, 'shared', 'arenarank.js'));

section('① 排序和學生看到的一樣（= 後端 arena_ranking）');
const board = {
  '1410101': { best: { score: 800, seconds: 200, at: '2026-10-05 10:00:00', correct: 17, max_tier: 5 }, days: { '2026-10-06': 1 } },
  '1410102': { best: { score: 800, seconds: 150, at: '2026-10-05 11:00:00', correct: 17, max_tier: 5 } },
  '1410201': { best: { score: 900, seconds: 300, at: '2026-10-04 09:00:00', correct: 18, max_tier: 5 } },
  '1410103': { best: { score: 800, seconds: 150, at: '2026-10-05 09:00:00', correct: 17, max_tier: 5 } },
  '1410104': { days: { '2026-10-06': 2 } }                      // 玩過但沒有成績（例如只有像腳本的場次）
};
const runs = [
  { sid: '1410101', day: '2026-10-06', at: '2026-10-06 10:00:00', swaps: 2, steps: [{ why: 'timeout' }, { why: 'late' }, {}] },
  { sid: '1410101', day: '2026-10-05', at: '2026-10-05 10:00:00', swaps: 1, steps: [] },
  { sid: '1410104', day: '2026-10-06', at: '2026-10-06 11:00:00', robot: true, steps: [] }
];
const roster = { '1410101': { cls: '801', no: '1', name: '甲' }, '1410102': { cls: '801', no: '2', name: '乙' },
                 '1410103': { cls: '801', no: '3', name: '丙' }, '1410201': { cls: '802', no: '1', name: '丁' },
                 '1410104': { cls: '801', no: '4', name: '戊' } };
const rows = R.build(board, runs, roster, '2026-10-06');
const order = rows.map(r => r.sid + ':' + r.rank).join(',');
ok(order === '1410201:1,1410103:2,1410102:3,1410101:4,1410104:null',
   '★★★ 分數高 → 用時短 → 先達成；沒成績的排最後　←　' + order);
const back = read('shared/backend.ipynb');
ok(/key=lambda r: \(-int\(r\[\\"score\\"\]\), float\(r\.get\(\\"seconds\\"\) or 0\),/.test(back),
   '★★ 後端的排序條件沒變（兩邊要一致；改了後端就要一起改這裡）');
const a = rows.find(r => r.sid === '1410101');
ok(a.name === '甲' && a.cls === '801' && a.no === '1', '★★ 帶名冊的班級、座號、姓名');
ok(a.runs === 2 && a.todayUsed === 1 && a.leaves === 3 && a.timeouts === 2,
   '★★ 場數 2、今天用了 1 次、離開 3 題、超時 2 題（timeout＋late）');
ok(rows.find(r => r.sid === '1410104').robot === 1, '★ 像腳本的場次數得出來');
ok(rows.find(r => r.sid === '1410103').clsRank === 1 && rows.find(r => r.sid === '1410101').clsRank === 3
   && rows.find(r => r.sid === '1410201').clsRank === 1, '★★ 班內名次（801：丙 1、乙 2、甲 3；802：丁 1）');
ok(JSON.stringify(R.classes(rows)) === '["801","802"]', '班級清單');
ok(R.todayTW(Date.UTC(2026, 9, 5, 17, 0)) === '2026-10-06', '★ 今天用台灣時間（UTC 17:00 ＝ 台灣隔天 01:00）');
ok(R.build({}, [], {}, 'x').length === 0, '沒有人參賽不出錯');

section('② 頁面：只有老師、只讀、直接讀 Firestore（不經 Colab）');
const P = read('shared/arenaboard.html');
ok(!/setDoc|updateDoc|deleteDoc|addDoc|writeBatch/.test((P.match(/^import[\s\S]*?;$/gm) || []).join('\n')) && /^import/m.test(P),
   '★★★ 只讀：import 裡沒有任何寫入函式');
ok(/const BOARD = TERM \+ '-arena-board'/.test(P) && /const RUNS = TERM \+ '-arena-runs'/.test(P),
   '★★ 讀的集合名和後端一樣（{學期}-arena-board／-arena-runs）');
ok(/AUTH\.isTeacherEmail/.test(P), '★★ 只有老師帳號能看');
ok(!/SERVER_URL|\/api\/arena/.test(P), '★★ 不打後端（Colab 沒開也看得到，也不吃 ngrok 請求額度）');
ok(/ARENARANK\.build\(/.test(P), '名次用 arenarank.js 算（排序只有一份）');
ok(/permission/.test(P) && /firestore\.rules/.test(P), '★ 讀不到（規則沒發布）時講清楚要做什麼');
for (const term of ['11501', '11502']) {
  ok(read(term + '/teacher.html').includes('../shared/arenaboard.html?term=' + term), `★★ ${term} 教師端有「🏆 排行賽」入口`);
}

section('③ 規則：老師可讀、學生不行、沒有人能從前端寫');
const RULES = read('shared/firestore.rules');
for (const term of ['11501', '11502']) {
  for (const c of ['arena-board', 'arena-runs']) {
    const m = RULES.match(new RegExp('match /' + term + '-' + c + '/\\{\\w+\\} \\{([\\s\\S]*?)\\}'));
    ok(m && /allow read: if isTeacher\(\);/.test(m[1]) && !/write|create|update|delete/.test(m[1]),
       `★★★ ${term}-${c}：只有老師讀，沒有任何寫入`);
  }
}
ok(!/match \/115\d\d-arena-days/.test(RULES), '★ -arena-days 不開（老師用不到）');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
