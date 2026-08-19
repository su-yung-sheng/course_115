/* 30 個人同時上課會怎樣：整批下載的地方
   跑法：node shared/tests/scale.test.js   （純字串處理）

   ★ 2026-08-19 老師：「先確認 11501 的部份，因為目前都只用少部份帳號
     一個一個測，不確定同時 30 個會有什麼狀況。」

   ⚠️ 這一類問題**一個一個測永遠測不出來**
     單人測試時，「每換一題就整批下載一次全班進度」看起來完全正常 ——
     慢個 0.3 秒而已。人數一多才會撞到額度：

       Firebase 免費方案：每天 50,000 次文件讀取
       整批下載一次 = 該集合的文件數（不是 1 次）

     11501/thinking.html 本來有兩處直接 getDocs 整個
     artifacts/comp-think-app/public/data/progress，其中一處的 useEffect
     相依陣列是 [selectedChallenge, user, completedChallenges] ——
     換一題、完成一題都會再抓一次。

       一個人：10 題 ≈ 20 次 × 文件數
       30 個人同時：600 次 × 文件數

     那個集合的路徑是寫死的 comp-think-app，**跨班級、跨學年累積**，
     文件數只會愈來愈多。
     ⚠️ 額度用完的症狀不是錯誤訊息，是「讀不到進度」——
        全班同時發生，看起來像系統壞了，而且要等隔天自己好。

   ⇒ 這一支盯的是：學生會反覆觸發的路徑上，不可以有整批下載。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
/* ⚠️ 先剝註解再比對 —— 底下在找「有沒有 getDocs」，
   而這些檔案的註解裡就寫著 getDocs（這個專案被自己的註解騙過四次）。 */
/* 剝掉註解再比對。
   ⚠️⚠️ `/*` 不可以無條件當成註解開頭 —— 2026-08-19 真的踩到：
      11501/thinking.html 有 <input accept="image/*">，那個 /* 會和
      一萬兩千字之後的一個真註解結尾配對，中間整段程式全被吃掉。
      後果不是紅字，是**假通過**：要檢查的那段程式根本不在字串裡了。
   ⇒ 只有前面是行首或空白／分號／大括號／等號時才算註解開頭。 */
const code = f => read(f)
  .replace(/(^|[\s;{(=])\/\*[\s\S]*?\*\//gm, '$1')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');


let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

section('11501 學生端不可以整批下載');
{
  /* 學生端的頁面。教師端與統計工具不在此列 ——
     它們是老師一個人在用，而且本來就要看全班。 */
  const PAGES = ['11501/thinking.html', '11501/hub.html', '11501/flowchart.html',
                 '11501/cyberethics.html', '11501/whatislist.html',
                 '11502/hub.html', '11502/scratch.html', '11502/level.html'];
  PAGES.forEach(f => {
    const c = code(f);
    ok(!/getDocs\s*\(\s*(progressCol|col|collection\()/.test(c),
       f + ' 沒有整批下載集合');
  });
}

section('★ 換題／完成一題不可以再連一次線');
{
  const c = code('11501/thinking.html');

  ok(/const classCache = \{ room: '', rows: null \}/.test(c),
     '★ 班級進度有快取（抓一次就好）');
  ok(/async function loadClassRows\(classRoom, force\)/.test(c),
     '   統一由 loadClassRows 取，不要各處自己 getDocs');
  ok(/if \(!force && classCache\.room === classRoom && classCache\.rows\) return classCache\.rows;/.test(c),
     '★ 沒有 force 就吃快取 —— 這一行就是 600 次變 1 次的地方');

  /* 只抓自己班：連線一次的成本也要壓下來。
     跨班級累積的集合，整包抓和只抓一班差好幾倍。 */
  ok(/fbStore\.where\('classRoom', '==', classRoom\)/.test(c),
     '★ 只抓自己班（where classRoom）—— 不要整包抓回來再自己過濾');
  ok(/query, where/.test(c), '   query／where 有從 SDK 匯入（漏了會退回整包抓）');

  /* 自己剛過的關要看得到，但不可以為此重抓 */
  ok(/function noteMyPass\(/.test(c), '★ 自己通關時在本機更新快取');
  ok(/noteMyPass\(user\.classRoom, user\.seatNo, challengeId\)/.test(c),
     '   而且真的有呼叫它（只定義不呼叫的話畫面會少算自己那一票）');

  /* ⚠️ 這一條擋的是「改回去」：
     useEffect 依賴 completedChallenges 是合理的（要重算人數），
     危險的是在那個 effect 裡重新連線。 */
  const eff = c.slice(c.indexOf('const fetchPassCount'), c.indexOf('}, [selectedChallenge'));
  ok(eff.length > 50, '   找得到「算本班通關人數」那一段');
  ok(!/getDocs|collection\(/.test(eff),
     '★★ 那一段裡面不可以有任何連線動作 —— 它每換一題、每完成一題都會跑');
  ok(/loadClassRows\(user\.classRoom, false\)/.test(eff),
     '   它要吃快取（force = false）');
}

section('其他一次性的成本');
{
  /* 這一條不是效能，是「別人的資料」：整包抓回來會連別班的姓名座號
     一起下載到學生的瀏覽器。只抓自己班同時把這件事一起收斂。
     ⚠️ 真正的邊界還是在 firestore.rules —— 這裡只是不主動去要。 */
  const c = code('11501/thinking.html');
  ok(!/snapshot\.forEach\(doc => \{[\s\S]{0,200}d\.classRoom === userClass/.test(c),
     '★ 不再「整包抓回來再自己過濾班級」');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
