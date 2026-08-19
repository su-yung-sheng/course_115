/* 每週歷程：history 的 stars 是「這一次增減幾顆」
   跑法：node shared/tests/weekly.test.js   （需要 jsdom）

   ★ 2026-08-19 老師：「前面提到的每週歷程分析還需要調整嗎？」—— 需要。

   ⚠️ 每週分數是把 history 裡的 stars 依「發生時間」分週加總，
      再套 60 ＋ 星×4（上限 100，0 星＝0 分）。學生端與教師端同一套規則
      （hub 的 evStars／教師端的 _evStars 都以 ev.stars 優先）。
      ⇒ **那個欄位的語意只要有一處走鐘，登記的成績就會錯。**

   ⚠️⚠️ 找到的 bug：章節測驗重考會灌水
      report.js 的 unit() 本來寫 stars: star（這次考幾顆），
      於是同一章重考一次就再記一筆 3 顆 ——
      總星數沒變（取最佳），每週分數卻多 12 分，重考三章多 36 分。
      ★ 其他寫入者本來就是差值語意，只有這一支走鐘：
          grader.html         stars: Math.max(0, star - prev)
          flowchart.html      只有第一次完成才寫（if (!already)）
          thinking.html       只有第一次完成才寫
      （2026-08-11 之前的舊 cyberethics 頁還算得好好的 —— 變數就叫 gained。）

   ★ 2026-08-19 老師另外決定了兩件事（本來兩者都不進週分數）：
      · 繳交加分 → 要算，記在**老師審核的那一天**（取消寫負的）
      · 概念星   → 要算，比照同一條規則（只算進步的部分）
      ⚠️ 已知代價：補審會全部堆在同一週。這是選這條規則換來的，不是 bug。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/* 剝掉註解再比對。
   ⚠️⚠️ `/*` 不可以無條件當成註解開頭 —— 11501/thinking.html 有
      <input accept="image/*">，那個 /* 會和一萬多字之後的真註解結尾配對，
      中間整段程式全被吃掉，結果不是紅字而是**假通過**。 */
const code = f => read(f)
  .replace(/(^|[\s;{(=])\/\*[\s\S]*?\*\//gm, '$1')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');

/** 起一份 REPORT，接上一個「真的會被寫進去」的假 Firestore */
function boot() {
  const dom = new JSDOM('<!DOCTYPE html><body></body>',
    { url: 'https://x/course_115/11501/cyberethics.html' });
  const w = dom.window;
  w.CONFIG = { TERM: '11501', COLLECTIONS: { PROGRESS: '11501-progress' } };
  w.SSO = { sid: () => '1410112', me: () => ({ name: '測試' }), embedded: () => false };
  global.SSO = w.SSO;                       // report.js 有幾處用裸的 SSO
  new Function('window', read('shared/report.js'))(w);

  const store = { modules: {}, history: [] };
  w.REPORT.configure({
    db: {}, doc: () => ({}),
    getDoc: () => Promise.resolve({ exists: () => true, data: () => JSON.parse(JSON.stringify(store)) }),
    setDoc: (r, payload) => {
      if (payload.modules) store.modules = payload.modules;
      /* arrayUnion 的替身：把那一筆接上去（真的 Firestore 也是這樣） */
      if (payload.history && payload.history.__union) store.history.push(payload.history.__union);
      else if (Array.isArray(payload.history)) store.history = payload.history;
      return Promise.resolve();
    },
    arrayUnion: (x) => ({ __union: x })
  });
  return { R: w.REPORT, store };
}

(async function main() {

  section('★★ 重考不可以灌水（老師 2026-08-19 問到的那個 bug）');
  {
    const { R, store } = boot();
    await R.unit('ethics', 'ch1-1', { star: 3, score: 95 });
    await R.unit('ethics', 'ch1-1', { star: 3, score: 97 });   // 同一章再考一次

    ok(store.history.length === 2, '兩次作答都有留紀錄（明細不該消失）');
    ok(store.history[0].stars === 3, '第一次：新增 3 顆');
    ok(store.history[1].stars === 0,
       '★★ 第二次：新增 0 顆（本來寫 3 —— 那一週就多 12 分）');
    ok(store.modules.ethics.stars === 3,
       '   總星數還是 3（取最佳，沒有因為重考變多）');
    ok(store.history[1].got === 3,
       '   這次實際考幾顆存在 got —— 明細看得到，但不進週分數');
  }
  {
    const { R, store } = boot();
    await R.unit('ethics', 'ch1-1', { star: 1, score: 62 });
    await R.unit('ethics', 'ch1-1', { star: 3, score: 96 });   // 進步了
    ok(store.history[1].stars === 2,
       '★ 進步的部分才算：1 顆 → 3 顆，這一次記 2 顆');
    ok(store.modules.ethics.stars === 3, '   總星數 3');
  }
  {
    const { R, store } = boot();
    await R.unit('ethics', 'ch1-1', { star: 3, score: 95 });
    await R.unit('ethics', 'ch1-1', { star: 1, score: 60 });   // 考差了
    ok(store.history[1].stars === 0, '考差不扣（差值不會是負的）');
    ok(store.modules.ethics.stars === 3, '   也不會把已經拿到的洗掉');
  }

  section('每一個寫入者都要是「增減」語意');
  {
    const g = code('shared/grader.html');
    ok(/stars: Math\.max\(0, star - prev\)/.test(g),
       'AI 批改：差值（這一支本來就對）');

    const f = code('11501/flowchart.html');
    ok(/if\(!already\)\{[\s\S]{0,900}history: arrayUnion/.test(f),
       '流程圖：只有第一次排對才寫 history');

    const t = code('11501/thinking.html');
    ok(/if \(!completedChallenges\.includes\(challengeId\)\)[\s\S]{0,4000}history: fbStore\.arrayUnion/.test(t),
       '運算思維：只有第一次通關才寫 history');

    const r = code('shared/report.js');
    ok(/var gain = Math\.max\(0, star - \(\(prev && prev\.star\) \|\| 0\)\);/.test(r),
       '★ 章節測驗：改成差值');
    ok(/stars: gain, got: star/.test(r), '   而且真的把 gain 寫進 history');
  }

  section('老師決定要算進來的兩項');
  {
    const rv = code('shared/review.html');
    ok(/history: arrayUnion\(\{ module: k\.mod, unit: unitId/.test(rv),
       '★ 繳交加分會寫一筆 history（本來完全不寫，永遠不進週分數）');
    ok(/stars: on \? per : -per/.test(rv),
       '★★ 取消加分要寫**負的** —— 不然收回來的星星還留在那一週');
    ok(/BONUS \|\| \{\}\)\[k\.key\]/.test(rv),
       '   加分值取自 GRADING.BONUS，不要在這裡另外訂');

    const lv = code('11502/level.html');
    ok(/kind: 'quiz'/.test(lv), '★ 概念星會寫一筆 history');
    ok(/const gain = Math\.max\(0, after - before\)/.test(lv),
       '★★ 只算進步的部分 —— 概念檢測可以一直重寫，寫總數等於送分');
    ok(/if \(gain > 0\)/.test(lv), '   沒進步就不寫（不要留一堆 0 顆的紀錄）');
    ok(!/unitStars/.test(lv.slice(lv.indexOf('window.saveQuiz'), lv.indexOf('window.saveFinal'))),
       '   而且仍然不碰 unitStars（作品星只有 Colab 批改寫得動）');
  }

  section('消費端：四個地方同一套規則');
  {
    ['11501/hub.html', '11502/hub.html', '11501/teacher.html', '11502/teacher.html']
      .forEach(f => {
        const c = code(f);
        ok(/typeof ev\.stars === 'number'\) return ev\.stars;/.test(c),
           f + ' 以 ev.stars 為準');
      });
    /* 週分數公式：0 星要是 0 分，不是 60 分 ——
       「沒做也有基本分」會讓這個數字失去意義。 */
    const h = code('11501/hub.html');
    ok(/thisWeekStars > 0 \? Math\.min\(100, WK_BASE \+ thisWeekStars\*WK_PER\) : 0/.test(h),
       '★ 0 星 = 0 分（不是基本分）');
  }

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
