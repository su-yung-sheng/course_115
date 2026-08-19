/* 繳交加分：分母算了，分子就要算
   跑法：node shared/tests/bonus.test.js   （純字串＋算術，不需要 jsdom）

   ★ 2026-08-19 老師問：「兩個關卡都有檢查到問題，上線前還有沒有可能類似的大問題？」
     盤點的結果就是這一支：**加分只有 11501 闖關基地算進去了**。

   ⚠️ 加分（交流程圖圖片 +1⭐、交程式錄影 +1⭐）是老師在 shared/review.html
      人工審核後給的，寫進 modules.{flowchart|scratch}.{imgUnits|vidUnits}。
      ★ review.html **只寫這兩格，從來不動 stars** —— 這是刻意的：
        stars 由自動流程（排對／AI 批改）負責，加分由人負責，兩個寫入者不打架。
      ⇒ 代價是：**每一個要顯示星數的地方都得自己把加分加回去**。
        漏掉的地方不會壞、不會報錯，只會少算 —— 而分母（moduleMax）
        是含加分的，於是進度條出現天花板：
            11501 教師端最高 83%、11502 hub 的程式卡最高 75%
        「怎麼做都到不了 100%」不會有人回報，只會被當成「系統就是這樣」。

   ⚠️⚠️ 教師端有一個反方向的陷阱
      那一格星數是**可編輯、會存回 modules.{key}.stars** 的。
      把加分併進去的話，存檔就固化，下次讀出來再加一次 ——
      每存一次多一份，數字自己長大。
      ⇒ 教師端只能把加分放在「顯示與百分比」，永遠不進 student[sub.key]。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/* grading.js 是純 IIFE，掛在 window 上 */
const win = {};
new Function('window', read('shared/grading.js'))(win);
const G = win.GRADING;

section('算術：拿滿了就要是 100%');
{
  ok(!!G && !!G.starsWithBonus, 'GRADING.starsWithBonus 存在');

  /* 11502：十關裡有兩關沒有作品要交（GATE.NO_UPLOAD），所以是 8 關。 */
  const ids = ['6-1-1','6-1-2','6-1-3','6-2-1','6-2-2','6-2-3','6-3-1','6-3-2','6-3-3','6-2-4'];
  const max = G.moduleMax(10, ids).scratch;
  const need = ids.filter(id => G.GATE.needsUpload(id));
  ok(max === need.length * (3 + G.BONUS.vid),
     '11502 程式的分母 = 要交作品的關數 ×(3＋錄影加分) = ' + max);

  /* 全部作品 3⭐、全部錄影加分都給 → 應該剛好等於分母 */
  const unitStars = {}, vidUnits = {};
  need.forEach(id => { unitStars[id] = 3; vidUnits[id] = { at: 1, by: 'x' }; });
  const p = { modules: { scratch: { stars: G.scratchTotal(unitStars).stars, unitStars, vidUnits } } };
  const got = G.starsWithBonus(p).scratch;
  ok(got === max, '★ 全部拿滿 = ' + got + ' / ' + max + '（要能到 100%）');

  /* ⚠️ 這一條是重點：**不含加分**的分子會卡在 75%。
     這正是漏算的地方看起來的樣子 —— 沒有錯誤訊息，只是永遠差一截。 */
  const noBonus = G.scratchTotal(unitStars).stars;
  ok(Math.round(noBonus / max * 100) === 75,
     '   漏算加分的話最高只有 ' + Math.round(noBonus / max * 100) + '%（天花板長這樣）');
}

/* ── 四個顯示星數的地方，都要把加分加回去 ────────────────
   ⚠️ 註解掩護：底下幾條在找「有沒有呼叫加分函式」，
      而這些檔案的註解裡本來就寫滿了「加分」兩個字。
      所以一律**剝掉註解**再比對 —— 這個專案已經被自己的註解騙過四次。 */
function code(f) {
  return read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
                .replace(/<!--[\s\S]*?-->/g, '');
}

section('學生端');
{
  const hub01 = code('11501/hub.html'), hub02 = code('11502/hub.html');
  ok(/starsWithBonus/.test(hub01), '11501 闖關基地有算加分（2026-08-11 就修了）');
  ok(/starsWithBonus/.test(hub02), '★ 11502 闖關基地也要算（本來完全沒有）');
  ok(/stars \+= bonusOf\(mods, m\.id\)/.test(hub02),
     '   一般卡（程式設計）把加分加進去');
  ok(/bonusOf\(mods,id\)/.test(hub02), '   合併卡也要（將來若再出現合併卡）');
  /* 兩邊都要用 unitStars 現算，不信任可能過時的匯總欄位 */
  ok(/d\.unitStars/.test(hub02),
     '★ 11502 的卡改用 unitStars 現算 —— 和闖關地圖同一個算法');

  const map02 = code('11502/scratch.html');
  ok(/bonusStars\(vidUnits, 'vid'\)/.test(map02),
     '★ 11502 闖關地圖顯示 🎁 加分（本來連讀都沒讀）');
  ok(/vidUnits = vid \|\| \{\}/.test(map02), '   加分由 applyStars 傳進來');
  ok(!/unitStars\[[^\]]*\] *\+= /.test(map02) && !/unitStars = .*vid/.test(map02),
     '★★ 加分**不可以**混進 unitStars —— 那是依序開放的鑰匙，' +
     '而且只有 Colab 批改寫得動它');

  const flow = code('11501/flowchart.html');
  ok(/bonusStars\(state\.imgUnits,'img'\)/.test(flow),
     '11501 流程圖頁顯示加分（2026-08-19 修）');
}

section('教師端');
['11501/teacher.html', '11502/teacher.html'].forEach(f => {
  const c = code(f);
  ok(/GRADING\.starsWithBonus\(\{ modules: mods \}\)/.test(c),
     f + ' 載入名冊時把加分算出來');
  ok(/student\.__bonusMap = \{/.test(c), '   存成 __bonusMap（和可編輯的星數分開）');
  ok(/totalStars \+= bonusOf\(studentData, sub\.key\)/.test(c),
     '★ ' + f + ' 的總星數含加分（分母含，分子就要含）');
  ok(/groupTotalStars \+= bonusOf\(student, sub\.key\)/.test(c),
     '   分組小計也要含');

  /* ⚠️⚠️ 反方向：加分絕對不可以進到會被存檔的那一格 */
  /* ⚠️ 這一條寫寬一點：**任何**把加分寫進那一格的形狀都要擋。
     第一版只擋 `student[sub.key] += bonus`，
     結果 `student[sub.key] += student.__bonusMap[sub.key]` 照樣過關 ——
     突變測試當場抓到（斷言寫得太窄，等於沒有斷言）。 */
  ok(!/student\[sub\.key\]\s*(\+=|=)[^;\n]*(__bonusMap|bonusOf|Bonus)/.test(c),
     '★★ ' + f + ' 不可以把加分寫進 student[sub.key] —— 存檔會固化，' +
     '下次讀出來再加一次就是雙重計算');
  ok(/modules\[sub\.key\] = \{ stars: \(student\[sub\.key\]/.test(c),
     '   存檔存的還是原始星數（沒有被動過手腳）');
});

section('唯一寫入者');
{
  const rv = code('shared/review.html');
  ok(/field: 'imgUnits'/.test(rv) && /field: 'vidUnits'/.test(rv),
     '審核頁寫的是 imgUnits／vidUnits');
  ok(!/modules: \{ \[k\.mod\]: \{ [^}]*stars/.test(rv),
     '★ 審核頁**不寫** stars —— 加分與自動星數各有各的寫入者，這是刻意的');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
