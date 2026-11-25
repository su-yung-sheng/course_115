/* 5016B 智慧家居機電專題：百分制成績、依序開放、老師實作驗收、Classroom 繳交審核（老師 2026-11-24）
   跑法：node shared/tests/labscore.test.js
   ★ 老師定的：另一個成績、不跟星星合計；百分制；第 5 節要老師實作驗收；依序開放＋老師手動放行。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const W = {};
new Function('window', read('shared/labscore.js'))(W);
const L = W.LABSCORE;

section('① 配分：滿分 100，第 1～4 節各 15（暖身 3＋檢核 6＋驗收 6）、第 5 節 40');
{
  const sum = L.LESSONS.reduce((a, u) => a + Object.values(L.POINTS[u]).reduce((x, y) => x + y, 0), 0);
  ok(sum === 100, '★★ 加起來剛好 100（' + sum + '）');
  ok(['u1', 'u2', 'u3', 'u4'].every(u => L.POINTS[u].warm === 3 && L.POINTS[u].checks === 6 && L.POINTS[u].verify === 6),
     '★ 第 1～4 節：暖身 3＋動手檢核 6＋老師實作驗收 6（老師 11-24 第二版：每一節都交 Classroom）');
  ok(L.POINTS.u5.warm === 10 && L.POINTS.u5.checks === 15 && L.POINTS.u5.verify === 15, '第 5 節：設計單 10＋成果卡 15＋老師實作驗收 15');
  ok(Object.isFrozen(L) && Object.isFrozen(L.POINTS) && Object.isFrozen(L.POINTS.u1), '★ 規則凍住（主控台改不了配分）');
}

section('② 分數');
{
  const t = Date.now();
  ok(L.score({}, null).total === 0 && L.score({}, null).done === 0, '什麼都沒做 ⇒ 0 分');
  const half = { u1: { warm: { at: t } } };
  ok(L.score(half, null).total === 3 && L.score(half, null).parts.u1.done === false, '只過暖身 ⇒ 3 分、這一節還沒完成');
  const four = { u1: { warm: {}, checks: {} }, u2: { warm: {}, checks: {} }, u3: { warm: {}, checks: {} }, u4: { warm: {}, checks: {} } };
  ok(L.score(four, null).total === 36 && L.score(four, null).done === 4, '前四節網頁全過 ⇒ 36 分、完成 4 節（還沒驗收）');
  const all = Object.assign({}, four, { u5: { warm: {}, checks: {} } });
  ok(L.score(all, null).total === 61 && L.score(all, null).done === 5, '★ 網頁部分全做完 ⇒ 61 分（實作驗收 39 分還沒給）');
  const info5 = L.fromRoster({ arduino_json: JSON.stringify({ ok: { u5: { at: 'x' } } }) });
  ok(L.score(all, info5).total === 76, '第 5 節驗收 ⇒ +15');
  const info = L.fromRoster({ arduino_json: JSON.stringify({ ok: { u1: {}, u2: {}, u3: {}, u4: {}, u5: {} } }) });
  ok(L.score(all, info).total === 100, '★★ 五節都驗收 ⇒ 100 分');
  ok(L.score({}, info).total === 39, '只驗收、網頁沒做 ⇒ 只拿驗收的 39 分（兩邊各算各的）');
  const rj = L.fromRoster({ arduino_json: JSON.stringify({ rej: { u2: { reason: '看不出在動' } } }) });
  ok(rj.rej.u2 && rj.rej.u2.reason === '看不出在動' && L.score(all, rj).parts.u2.verify === false, '退件讀得出原因、不給驗收分');
  ok(L.score({ u5: { say: {}, work: {} } }, null).total === 0, '只存了文字、沒過暖身檢核 ⇒ 不給分');
  ok(L.status({}, null) === 'todo' && L.status(half, null) === 'in-progress' && L.status(all, info) === 'pass', '狀態：沒開始／進行中／滿分才算完成');
  ok(!('stars' in L.score(all, info)), '★★ 不產生星星（專題卡 maxStars 是 0，給星總進度會超過 100%）');
}

section('③ 依序開放＋老師放行');
{
  ok(L.openUpTo({}, null, false) === 1, '一開始只開第 1 節');
  ok(L.openUpTo({ u1: { warm: {} } }, null, false) === 1, '第 1 節只過暖身 ⇒ 還是只開第 1 節');
  /* ★ 2026-11-25 老師：「要老師通關才開下一節」—— 暖身＋檢核過了還不夠 */
  const ok1 = L.fromRoster({ arduino_json: '{"ok":{"u1":{"at":1}}}' });
  ok(L.openUpTo({ u1: { warm: {}, checks: {} } }, null, false) === 1, '★★ 第 1 節暖身＋檢核過了、老師還沒通關 ⇒ 還是只開第 1 節');
  ok(L.openUpTo({ u1: { warm: {}, checks: {} } }, ok1, false) === 2, '★ 老師按了第 1 節通關 ⇒ 開到第 2 節');
  ok(L.openUpTo({}, L.fromRoster({ arduino_json: '{"ok":{"u1":{},"u3":{}}}' }), false) === 2, '跳著通關的不算（第 2 節沒通關就停在第 2 節）');
  ok(L.openUpTo({}, L.fromRoster({ arduino_json: '{"open":3}' }), false) === 3, '★ 老師放行到第 3 節 ⇒ 開到第 3 節');
  ok(L.openUpTo({}, L.fromRoster({ arduino_json: '{"open":2,"ok":{"u1":{},"u2":{},"u3":{}}}' }), false) === 4,
     '放行比自己的進度少 ⇒ 取較大的（放行不會把人關回去）');
  ok(L.openUpTo({}, null, true) === 5, '備課模式 ⇒ 全開');
  ok(L.fromRoster({ arduino_json: '{"open":99}' }).open === 5 && L.fromRoster({ arduino_json: 'x{' }).open === 0 && L.fromRoster(null).open === 0,
     '名冊欄位壞掉、超出範圍都不會出錯');
  ok(/第 1 節要先完成/.test(L.lockText(2)) && /老師通關/.test(L.lockText(2)), '鎖住時講清楚要先完成哪一節（含老師通關）');
  ok(/等老師檢查實作/.test(L.lockText(2, { u1: { warm: {}, checks: {} } })), '★ 前一節做完了 ⇒ 說「等老師檢查實作」，不是叫他再做一次');
  const C = {}; new Function('window', read('shared/classroom.js'))(C);
  const works = [{ id: 'a', title: '2026/11/27 專題一：感應大門：超音波與馬達' }, { id: 'b', title: '2026/12/04 專題二：迎賓走廊：超音波與燈條' },
                 { id: 'c', title: '2026/12/11 專題十一：別的' }, { id: 'd', title: '2026/08/06 任務一：2-1-1A 班級置物櫃' }];
  ok(C.CLASSROOM.findWork(works, L.workIds('u1')).work.id === 'a' && C.CLASSROOM.findWork(works, L.workIds('u2')).work.id === 'b',
     '★ Classroom 作業名稱（「2026/11/27 專題一：感應大門：超音波與馬達」）對得到這一節');
  ok(C.CLASSROOM.findWork([{ id: 'x', title: '專題一' }, { id: 'y', title: '專題十一' }], ['專題一']).work.id === 'x', '「專題一」不會誤認成「專題十一」');
  const H0 = read('11501/5016b.html'), cur0 = H0.slice(H0.indexOf('<section id="curriculum"'), H0.indexOf('<!-- Detailed Unit View'));
  const h3 = [...cur0.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map(m => m[1]);
  ok(JSON.stringify(h3) === JSON.stringify(L.LESSONS.map(u => L.TITLES[u])), '★ labscore 的各節名稱和 5016B 頁面卡片標題一模一樣（作業名稱要靠它對）');
}

section('④ 5016b.html：畫分數、上鎖、讀不到就放行');
{
  const H = read('11501/5016b.html');
  ok(H.indexOf('../shared/labscore.js') > 0 && H.indexOf('../shared/grading.js') > 0, '載入 labscore.js（和備課模式用的 grading.js）');
  ok(/LABPROGRESS && !window\.LABPROGRESS\.canOpen\(unitId\)/.test(H), '★ 點鎖住的節進不去（openCourseDetail 一開始就擋）');
  ok(/if \(!r\.ok\) \{ st = null; return; \}/.test(H) && /function canOpen\(no\) \{ return !st \|\|/.test(H),
     '★★ 讀不到雲端 ⇒ 全部放行（不可以因為一次讀取失敗把整班鎖住）');
  ok(/part === 'warm' \|\| part === 'checks'\) && window\.LABPROGRESS\) window\.LABPROGRESS\.refresh\(\)/.test(H), '暖身、檢核一存好就重算分數和鎖');
  ok(/DOMContentLoaded/.test(H.slice(H.indexOf('window.LABPROGRESS = (function'))), '★ 等 module（LABSAVE）跑完才讀（不然永遠不會畫）');
  ok(!/stars\s*:/.test(H.slice(H.indexOf('async all()'), H.indexOf('async save('))), '讀進度不碰星星');

  /* 真的跑一次：卡片上鎖、分數、拒絕訊息 */
  let JSDOM; try { JSDOM = require('jsdom').JSDOM; } catch (e) {}
  if (JSDOM) {
    const cur = H.slice(H.indexOf('<section id="curriculum"'), H.indexOf('<!-- Detailed Unit View'));
    const dom = new JSDOM('<!doctype html><body>' + cur + '</body>', { runScripts: 'outside-only' });
    const w = dom.window;
    new Function('window', read('shared/labscore.js'))(w);
    let rec = { arduino: { u1: { warm: {}, checks: {} }, u2: { warm: {} } }, roster: { arduino_json: '{"ok":{"u1":{"at":1}}}' }, ok: true };
    w.LABSAVE = { all: async () => rec };
    const code = H.slice(H.indexOf('window.LABPROGRESS = (function'), H.indexOf('function closeCourseDetail()'));
    w.eval(code);
    (async () => {
      await new Promise(r => setTimeout(r, 30));
      const P = w.LABPROGRESS;
      ok(/18/.test(w.document.getElementById('lab-progress').textContent) && /完成 1／5 節/.test(w.document.getElementById('lab-progress').textContent),
         '★ 頁面上方顯示「專題成績 18／100（第 1 節 15＋第 2 節暖身 3）、完成 1／5 節」');
      ok(P.canOpen(1) && P.canOpen(2) && !P.canOpen(3), '★ 第 1 節老師通關 ⇒ 可以進第 2 節、第 3 節鎖住');
      const cards = w.document.querySelectorAll('#curriculum .unit-card');
      ok(cards.length === 5 && /第 2 節要先完成/.test(cards[2].textContent) && cards[2].getAttribute('aria-disabled') === 'true', '第 3 節卡片畫成鎖住、寫明原因');
      ok(/15／15/.test(cards[0].textContent) && /3／15/.test(cards[1].textContent), '每一節卡片顯示自己的分數');
      ok(!/等老師檢查實作/.test(cards[0].textContent), '已通關的那一節不顯示「等老師檢查」');
      P.refuse(3);
      ok(/第 2 節要先完成/.test(w.document.getElementById('lab-lockmsg').textContent), '硬點第 3 節 ⇒ 上方跳出原因');
      /* ★ 第 1 節做完、老師還沒通關 ⇒ 第 2 節鎖住，第 1 節卡片寫「等老師檢查」＋「重新檢查」按鈕 */
      rec = { arduino: { u1: { warm: {}, checks: {} } }, roster: null, ok: true };
      await P.refresh();
      const cw = w.document.querySelectorAll('#curriculum .unit-card');
      ok(!P.canOpen(2) && /等老師檢查實作/.test(cw[0].textContent) && /舉手請老師現場檢查/.test(cw[0].textContent) && cw[0].querySelector('.lab-recheck'),
         '★★ 第 1 節做完、還沒通關 ⇒ 第 2 節鎖住；第 1 節卡片寫「等老師檢查實作：舉手請老師現場檢查」＋「🔄 重新檢查」');
      ok(/等老師檢查實作/.test(cw[1].textContent), '   第 2 節卡片也寫「等老師檢查」，不是叫他再做一次第 1 節');
      rec = { arduino: { u1: { warm: {}, checks: {} } }, roster: { arduino_json: '{"ok":{"u1":{"at":2}}}' }, ok: true };
      cw[0].querySelector('.lab-recheck').click();
      await new Promise(r => setTimeout(r, 20));
      ok(P.canOpen(2), '★ 老師按了通關 → 學生按「重新檢查」⇒ 第 2 節開了');
      rec = { arduino: {}, roster: { arduino_json: '{"open":4,"rej":{"u1":{"reason":"<b>看不出在動</b>"}}}' }, ok: true };
      await P.refresh();
      ok(P.canOpen(4) && !P.canOpen(5), '★ 老師放行到第 4 節 ⇒ 第 4 節打得開');
      const c0 = w.document.querySelectorAll('#curriculum .unit-card')[0];
      ok(/實作作品被退件：<b>看不出在動<\/b>/.test(c0.textContent) && !c0.querySelector('.lab-tag b'), '★ 退件原因顯示在那一節的卡片上（逸出，不會變成 HTML）');
      rec = { arduino: {}, roster: null, ok: false };
      await P.refresh();
      ok(P.canOpen(5), '★★ 讀不到雲端 ⇒ 全部放行');
      done();
    })();
  } else { console.log('  （沒有 jsdom，略過頁面實跑）'); done(); }
}

function done() {
  section('⑤ 闖關基地：專題卡顯示分數，不給星');
  const HB = read('11501/hub.html');
  ok(HB.indexOf('../shared/labscore.js') > 0, '載入 labscore.js');
  ok(/m\.id==='arduino' && typeof LABSCORE!=='undefined'/.test(HB) && /labScore: LABSCORE\.score\(ar, info\)/.test(HB), '專題卡走 LABSCORE');
  ok(!/stars:\s*LABSCORE/.test(HB), '★★ 專題卡不回傳星星（總星數、進度條不受影響）');
  ok(/state\.labInfo = \(typeof LABSCORE!=='undefined'\) \? LABSCORE\.fromRoster\(r\)/.test(HB), '讀名冊時一起拿老師的實作驗收');
  ok(/🔧 專題 \$\{d\.labScore\.total\}／100 分/.test(HB), '卡片顯示「專題 xx／100 分」');

  section('⑥ 教師端：進度表、實作驗收、放行');
  const T = read('11501/teacher.html');
  ok(T.indexOf('../shared/labscore.js') > 0 && /onclick="openLabModal\(\)"/.test(T) && /id="labModal"/.test(T), '有「🔧 5016B 專題」按鈕和視窗');
  const js = T.slice(T.indexOf('let _labRows = []'), T.lastIndexOf('</script>'));
  ok(/where\('cls', '==', cls\)/.test(js) && !/collection\(window\.CONFIG\.COLLECTIONS\.PROGRESS\)\.get\(\)/.test(js),
     '★ 只讀這一班（名冊 1 次＋每人進度 1 次），不掃整個集合（11-17 額度的教訓）');
  ok(/set\(\{ arduino_json: raw \}, \{ merge: true \}\)/.test(js), '★★ 驗收、放行寫名冊的 arduino_json，而且 merge（名冊其他欄位不碰）');
  ok(/_labEsc\(say\.text\)/.test(js) && /_labEsc\(work\[k\]\)/.test(js), '★ 學生寫的文字一律逸出再顯示');
  let JSDOM; try { JSDOM = require('jsdom').JSDOM; } catch (e) {}
  if (!JSDOM) return finish();
  const m0 = T.indexOf('<div id="labModal"');
  const modal = T.slice(m0, T.indexOf('📦 學生程式作品下載', m0));
  const dom = new JSDOM('<!doctype html><body>' + modal.replace(/<!--[\s\S]*$/, '') + '</body>', { runScripts: 'outside-only' });
  const w = dom.window;
  new Function('window', read('shared/labscore.js'))(w);
  w.CONFIG = { COLLECTIONS: { ROSTER: 'roster', PROGRESS: '11501-progress' } };
  const roster = { '1410101': { cls: '801', no: 1, name: '王<小明>' }, '1410102': { cls: '801', no: 2, name: '李小華', arduino_json: '{"open":3}' } };
  const prog = { '1410101': { modules: { arduino: { u1: { warm: {}, checks: { tries: 3 }, say: { text: '<img src=x onerror=alert(1)>記住門' } } } } } };
  const writes = [];
  const col = name => ({
    where: () => ({ get: async () => ({ docs: Object.keys(roster).map(id => ({ id, data: () => roster[id] })) }) }),
    get: async () => ({ forEach: f => Object.keys(roster).forEach(id => f({ data: () => roster[id] })) }),
    doc: id => ({
      get: async () => name === 'roster' ? { exists: !!roster[id], data: () => roster[id] } : { exists: !!prog[id], data: () => prog[id] },
      set: async (d, o) => { writes.push([name, id, d, o]); roster[id] = Object.assign({}, roster[id], d); }
    })
  });
  w.firebase = { firestore: () => ({ collection: col }) };
  w.showToast = () => {};
  w.eval(js);
  (async () => {
    await w.openLabModal();
    /* ★ 老師 11-25：班級藥丸＋關卡圓鈕（和 review.html 同一套），點班級就讀取 */
    ok(w.document.querySelectorAll('#labClassPills [data-lcls]').length === 1 && w.document.querySelectorAll('#labLessonPills [data-lu]').length === 5,
       '★ 班級一排藥丸（名冊有的班）、關卡 1～5 一排圓鈕');
    await w.labPickClass('801');
    ok(/bg-blue-600/.test(w.document.querySelector('[data-lcls="801"]').className), '   點了的班級變藍色、直接讀取（不用再按讀取）');
    const txt = w.document.getElementById('labTable').textContent;
    ok(/9／15/.test(txt) && /試 3 次/.test(txt), '進度表：每節分數、檢核試了幾次');
    ok(/第 3 節/.test(txt), '老師放行到第 3 節的學生，「可進到」顯示第 3 節');
    /* ★ 老師 2026-11-25：通關確認 —— 選班級、關卡，全班頭貼；灰＝未完成、淺綠＝完成待檢查、藍＝老師確認通關 */
    const st = () => [...w.document.querySelectorAll('#labGrid [data-st]')].map(e => e.dataset.st).join(',');
    ok(!w.document.getElementById('labGridWrap').classList.contains('hidden') && w.document.getElementById('labTableWrap').classList.contains('hidden'),
       '★ 打開先看「🎯 通關確認」頭貼，成績表切過去');
    ok(/第 1 節　感應大門/.test(w.document.getElementById('labLessonTitle').textContent), '關卡圓鈕旁邊寫出這一節的名稱');
    ok(st() === 'green,gray', '★ 完成暖身＋檢核 ⇒ 淺綠；還沒完成 ⇒ 灰色');
    ok(!/<img/.test(w.document.getElementById('labGrid').innerHTML), '   頭貼名單的姓名也逸出');
    await w.labPass(1);
    ok(writes.length === 0 && st() === 'green,gray', '★★ 灰色點了不能通關（沒有寫入）');
    w.labPickLesson('u2');
    ok(st() === 'gray,gray' && /第 2 節/.test(w.document.getElementById('labGrid').textContent), '換關卡 ⇒ 不重新讀取，直接換顏色');
    w.labPickLesson('u1');
    w.labSetView('table');
    ok(w.document.getElementById('labGridWrap').classList.contains('hidden'), '切到成績表');
    w.labSetView('grid');
    w.labToggle(0);
    const html = w.document.getElementById('labTable').innerHTML;
    ok(!/<img/.test(html) && /記住門/.test(w.document.getElementById('labTable').textContent), '★★ 點姓名看「用自己的話說」—— 學生寫的 HTML 不會被執行');
    roster['1410101'].arduino_json = JSON.stringify({ rej: { u1: { reason: '舊的退件' } } });
    await w.labVerify(0, 'u1');
    const aj = JSON.parse(writes[0][2].arduino_json);
    ok(writes.length === 1 && writes[0][0] === 'roster' && writes[0][3] && writes[0][3].merge === true && aj.ok.u1 && !aj.rej.u1,
       '★ 實作驗收（任何一節）：寫名冊 arduino_json.ok.u1（merge），之前的退件一併清掉');
    ok(/✔ 已通關/.test(w.document.getElementById('labTable').innerHTML), '   成績表立刻顯示「已通關」');
    ok(!/onclick="labVerify/.test(w.document.getElementById('labTable').innerHTML), '★★ 成績表不能按驗收（老師 11-25：給分只在「🎯 通關確認」）');
    ok(st() === 'blue,gray', '★ 通關＝實作驗收同一格 ⇒ 頭貼立刻變藍');
    w.confirm = () => false;
    await w.labPass(0);
    ok(writes.length === 1 && st() === 'blue,gray', '點藍色會先問；按取消就不動');
    w.confirm = () => true;
    await w.labPass(0);
    ok(writes.length === 2 && !JSON.parse(writes[1][2].arduino_json).ok.u1 && st() === 'green,gray', '確定取消 ⇒ 回到淺綠、分數拿掉');
    await w.labOpen(1, 0);
    ok(!('open' in JSON.parse(roster['1410102'].arduino_json)), '取消放行 ⇒ open 拿掉');
    finish();
  })();
}

function labreview() {
  section('⑦ 5016B Classroom 繳交審核頁（shared/labreview.html）');
  const R = read('shared/labreview.html');
  ok(/'labscore\.js', 'classroom\.js'/.test(R) || (/labscore\.js/.test(R) && /classroom\.js/.test(R)), '用 labscore.js（規則）和 classroom.js（和繳交審核同一支 Apps Script）');
  ok(/CLASSROOM\.findWork\(state\.cr\.works, L\.workIds\(U\(\)\)\)/.test(R), '★ 依「第幾節」自動找 Classroom 作業（課程名稱或「專題一」）');
  ok(/setDoc\(ref, \{ arduino_json: raw \}, \{ merge: true \}\)/.test(R) && /const snap = await getDoc\(ref\)/.test(R),
     '★★ 驗收、退件寫名冊 arduino_json：先讀最新的再改、merge 寫回（和教師端進度表同一格）');
  ok(!/getDocs\(collection\(db, PROGRESS\)\)/.test(R) && /getDoc\(doc\(db, PROGRESS, sid\)\)/.test(R), '★ 只讀選到那一班的進度（不掃整個集合）');
  ok(!/arrayUnion|history|stars/.test(R.slice(R.indexOf('async function writeArduino'), R.indexOf('function students()'))), '★★ 不給星、不寫每週歷程（另一個成績）');
  ok(/if \(reason && info\.ok\[u\]\)/.test(R), '已驗收的不能直接退件（要先取消驗收）');
  ok(/delete cur\.rej\[u\]/.test(R) && /cur\.ok\[u\] = \{ at: Date\.now\(\), by: state\.who\.email/.test(R), '驗收時清掉退件，記下是誰、什麼時候');
  ok(/AUTH\.isTeacherEmail/.test(R), '只有老師帳號能用');
  ok(/esc\(s\.rej\.reason\)/.test(R) && /esc\(a\.title/.test(R), '學生交的檔名、退件原因都逸出');
  ok(/if \(state\.cr\.courseId !== id\) return;/.test(R) && /state\.cr\.works = \[\]/.test(R), '換課時清掉舊的作業清單、過期的回應丟掉（review.html 09-16 的教訓）');
  const T = read('11501/teacher.html');
  /* ⏸️ 2026-11-25 老師：「先 disable，要現場人工通關確認」⇒ 入口拿掉、頁面的程式停用（程式碼留著，要恢復改回 type="module"） */
  ok(!/href="\.\.\/shared\/labreview\.html/.test(T), '★★ 教師端拿掉「📥 Classroom 繳交審核」入口（暫停使用）');
  ok(!/<script type="module">/.test(R) && /<script type="text\/plain" data-disabled=/.test(R) && /暫停使用/.test(R),
     '★★ 繳交審核頁的程式停用（直接打網址也只看到暫停說明，寫不了分數）');
  const opens = (R.match(/<div[\s>]/g) || []).length, closes = (R.match(/<\/div>/g) || []).length;
  ok(opens === closes, 'div 開合數量相同（' + opens + '／' + closes + '）');
}

function codeGate() {
  section('⑧ 程式碼要通過動手檢核才顯示（老師 2026-11-25）');
  const H = read('11501/5016b.html');
  const lab = H.indexOf('id="detail-lab"'), lock = H.indexOf('id="demo-locked"'), demo = H.indexOf('id="detail-demo-container"');
  ok(lab > 0 && lab < lock && lock < demo, '★ 順序：動手檢核 → 🔒 鎖住的程式碼 → 程式碼（拿來做最後的實作）');
  ok(/const codeLock = !!\(data\.lab && data\.lab\.checks && data\.lab\.gate !== false/.test(H),
     '★ 只鎖第 1～4 節（第 5 節的任務卡骨架做專題要用，照舊顯示）');
  ok(/window\.GRADING\.openAll\(window\.CONFIG/.test(H.slice(H.indexOf('const codeLock'), H.indexOf('const codeLock') + 400)), '備課模式全開（老師看得到）');
  ok(/doneCard\(checks, rec\.checks\.at, '三個檢核都通過了'[\s\S]{0,120}window\.LABCODE\(true\)/.test(H), '★ 之前就通過的人一進來就看得到程式碼');
  ok(/onDone: function \(info\) \{[\s\S]{0,300}window\.LABCODE\(true\)/.test(H), '★ 當場通過 ⇒ 程式碼打開並捲過去');
  ok(/最後的實作/.test(H) && /舉手請老師到位子上檢查/.test(H) && !/交到 Classroom/.test(H),
     '程式碼上方說明最後的實作：舉手請老師現場檢查（11-25 起不再叫學生交 Classroom）');
}

function finish() {
  codeGate();
  labreview();
  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
}
