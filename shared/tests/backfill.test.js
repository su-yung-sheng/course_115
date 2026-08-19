/* 舊資料相容：小卡有星星，章節頁卻一個都沒亮
   跑法：node shared/tests/backfill.test.js   （需要 jsdom）

   ★ 2026-08-19 老師回報：
     「11501 資訊倫理學習系統 小卡顯示三星，點進去卻沒看到那一個單元獲得？」

   ⚠️ 病根在資料格式，不在畫面
     2026-08-11 以前的舊章節測驗頁
     （_archive/2026-08-11-舊版章節測驗頁/11501_cyberethics.html）
     寫進 11501-progress 的是

       modules.ethics = { status, score, stars, level, source, updatedAt }

     **沒有 units**。「哪一章過了」它存在另一個集合 quiz_records，
     而且用「班級＋座號＋姓名」比對，不是用學號。
     新的 quiz-engine 只認 modules.{id}.units ——
     hub 讀 stars（3 顆）、章節頁讀 units（空的），兩邊各說各話。

   ★ 救得回來：history 那一筆帶著 chapter（舊欄位名）。
     ⇒ report.js 的 backfillUnits() 從 history 重建 units。

   ⚠️⚠️ 這一支盯的重點是**不要抄錯欄位**
     舊 history 的 stars 存的是「這次比上次多拿幾顆」（舊程式的變數就叫
     gained），同一章重考第二次通常是 0。直接抄會把三星章節記成 0 星 ——
     名字對、型別對、數字也很合理，是最容易通過人眼的那種錯。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.log('這份測試需要 jsdom：先執行  npm install jsdom'); process.exit(0); }

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

/** 起一份 REPORT，接上假的 Firestore。
    @param doc 進度文件目前的內容 */
function boot(doc) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>',
    { url: 'https://x/course_115/11501/cyberethics.html' });
  const w = dom.window;
  w.CONFIG = { TERM: '11501', COLLECTIONS: { PROGRESS: '11501-progress' } };
  w.SSO = { sid: () => '1410112', me: () => ({ name: '測試學生' }), embedded: () => false };
  /* ⚠️ report.js 的外殼是 (function (global) {…})(window)，
     可是裡面有幾處寫的是**裸的 SSO**（在瀏覽器裡就是 window.SSO）。
     少接這一行的症狀是 ReferenceError: SSO is not defined ——
     和 semlock.test.js 當初漏接 document／sessionStorage 是同一個坑。 */
  global.SSO = w.SSO;
  new Function('window', read('shared/report.js'))(w);

  const writes = [];
  w.REPORT.configure({
    db: {}, doc: () => ({}),
    getDoc: () => Promise.resolve({ exists: () => true, data: () => doc }),
    setDoc: (r, payload) => { writes.push(payload); return Promise.resolve(); },
    arrayUnion: (x) => ({ __union: x })
  });
  return { R: w.REPORT, writes };
}

/* 章節測驗的星等門檻是 GRADING 的事，這裡照它的規則給一支替身：
   90 以上 3 星、80 以上 2 星、60 以上 1 星（實際門檻以 grading.js 為準，
   這一支只要「同一支函式進去、同一個結果出來」就夠了）。 */
const starOf = r => (r >= 90 ? 3 : r >= 80 ? 2 : r >= 60 ? 1 : 0);

/* 老師那份資料的形狀：小卡 3 顆星、沒有 units、history 有 chapter。
   ⚠️ history 的 stars 是 gained —— ch1-1 重考第二次那筆是 0。 */
const OLD = () => ({
  studentId: '1410112',
  modules: { ethics: { status: 'in-progress', stars: 3, level: 1, score: 92, source: 'auto' } },
  history: [
    { module: 'ethics', chapter: 'ch1-1', score: 78, stars: 1, at: 1 },
    { module: 'ethics', chapter: 'ch1-1', score: 92, stars: 0, at: 2 },
    { module: 'thinking', unit: 'p1', score: 100, stars: 3, at: 3 }
  ]
});

(async function main() {
  section('舊資料：有星星、沒有 units');
  {
    const { R, writes } = boot(OLD());
    const mod = await (R.backfillUnits('ethics', starOf));
    ok(!!mod, '補得回來（history 裡還有 chapter）');
    const u = (mod && mod.units) || {};
    ok(Object.keys(u).length === 1, '只補 ethics 的章節，不會把別的模組混進來（' +
       Object.keys(u).join('、') + '）');
    ok(!!u['ch1-1'], '★ 認得舊欄位 chapter（新的叫 unit，兩個都要收）');

    /* ⚠️ 這一條就是整支測試的重點 */
    ok(u['ch1-1'] && u['ch1-1'].score === 92,
       '★ 取同一章的**最佳分數**（78 與 92 取 92）');
    ok(u['ch1-1'] && u['ch1-1'].star === 3,
       '★★ 星數用 score 重算（3 星）—— 不可以抄 history 的 stars，' +
       '那是「這次多拿幾顆」，最後一筆是 0');

    const w0 = writes[0] || {};
    ok(w0.modules && w0.modules.ethics && w0.modules.ethics.backfilled === true,
       '寫回時留下 backfilled 記號（之後查資料看得出來這是補的）');
  }

  section('★ 星數只准往上，不准往下');
  {
    /* history 有長度上限，而且是後來才開始寫的 —— 它不是完整的歷史。
       重算出來比原本少的時候，要留原本的數字。
       學生看到星星變少會以為成績被吃掉，那比「明細不全」嚴重得多。 */
    const d = OLD();
    d.modules.ethics.stars = 12;          // 舊頁面算出來的總星數（history 湊不齊）
    const { R } = boot(d);
    const mod = await (R.backfillUnits('ethics', starOf));
    ok(mod && mod.stars === 12, '重算只有 3，但保留原本的 12（' + (mod && mod.stars) + '）');
    ok(mod && mod.units && Object.keys(mod.units).length === 1,
       '   units 照樣補上去 —— 補的是明細，不是重新打分數');
  }

  section('不該動的時候不要動');
  {
    const d = OLD();
    d.modules.ethics.units = { 'ch1-2': { star: 2, score: 85 } };
    const { R, writes } = boot(d);
    const mod = await (R.backfillUnits('ethics', starOf));
    ok(mod && mod.units && mod.units['ch1-2'] && !mod.units['ch1-1'],
       '★ units 已經有東西就原樣回傳，不覆蓋');
    ok(writes.length === 0, '   而且完全不寫入（不要為了沒事做而寫一次資料庫）');
  }
  {
    const { R, writes } = boot({ modules: { ethics: { stars: 3 } }, history: [] });
    ok(await (R.backfillUnits('ethics', starOf)) === null,
       '連 history 都沒有 → 回 null（救不回來就老實說，不要編一個空的 units）');
    ok(writes.length === 0, '   一樣不寫入');
  }
  {
    const { R } = boot(OLD());
    ok(await (R.backfillUnits('ethics', null)) === null,
       '沒給 starOf 就不做 —— 星等門檻是 GRADING 的事，這支不自己訂');
  }

  section('history() 要認得舊欄位');
  {
    const { R } = boot(OLD());
    const list = await (R.history('ethics', 'ch1-1'));
    ok(list.length === 2, '★ 指定章節查得到舊紀錄（chapter/unit 都要收，得到 ' +
       list.length + ' 筆）');
    ok(list[0] && list[0].at === 2, '   由新到舊');
    /* ⚠️ 不要寫成 await R.history(…).length —— 那會先取 Promise 的 .length
       （undefined）再 await，永遠不等於 2，而且長得非常像是功能壞了。 */
    const all = await R.history('ethics');
    ok(all.length === 2, '不指定章節就取整個模組');
  }

  /* ── 畫面：有星星卻對不上章節時，不可以說「還沒有通關」 ────────
     ⚠️ 這是老師實際看到的畫面。小卡三顆星、進來寫「還沒有通關的章節」，
        兩句話互相打臉，學生只會覺得成績不見了。 */
  section('★ 章節頁的文案（連 history 都救不回來時）');
  {
    const src = read('shared/quiz-engine.js');
    ok(/backfillUnits\(C\.moduleId, window\.GRADING\.ethicsStar\)/.test(src),
       '★ paintBadges 會先試著補 units（星等函式從 GRADING 拿）');
    ok(/mod\.stars > 0/.test(src) && /舊版/.test(src),
       '★ 補不回來時改口說「舊版留下的紀錄」，不說「還沒有通關」');
    ok(/星數不會消失/.test(src),
       '   而且要講明星星不會消失 —— 學生最怕的是這個');
    ok(/Object\.keys\(u0\)\.length \|\| !mod \|\| !\(mod\.stars > 0\)/.test(src),
       '   units 已經有、或根本沒星星，就不要多跑一次補救');
  }


  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
