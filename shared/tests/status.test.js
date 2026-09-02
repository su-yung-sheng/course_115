/* 系統狀態檢查頁（shared/status.html）
   跑法：node shared/tests/status.test.js

   ★ 這一頁的價值全在「它說綠燈的時候，真的是綠的」。
     一張會說謊的卡比沒有那張卡糟得多 ——
     沒有卡的時候你還會去查，有綠燈就不會了。

   ⚠️ 2026-08-11 抓到的假綠燈：
     「⑤ Firestore 安全規則」本來只驗一件事 ——
     未登入撈名冊會不會被擋。而那件事在**舊規則裡本來就成立**。
     2026-08-06 的規則改版有兩支函式忘了寫，整份編譯失敗、
     五天沒有真的上線，而這張卡從頭到尾都是綠的。

   ⇒ 現在它只敢說「整批下載擋住了」，並且明講自己證明不了
     「你最後那一版有沒有發布成功」。
     這一份就是盯著那句話不要被拿掉。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(root, 'shared', 'status.html'), 'utf8');
/** 去掉註解：這一份要驗的是「畫面上寫了什麼」，不是註解裡寫了什麼 */
const CODE = SRC.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

section('每一段 script 語法要正確');
{
  /* ⚠️ 這一頁沒有任何測試在跑它的程式碼 —— 語法打錯的話，
     整頁會安靜地什麼都不檢查，而畫面上只有幾張空卡片。 */
  const blocks = SRC.match(/<script>[\s\S]*?<\/script>/g) || [];
  ok(blocks.length >= 2, '找得到內嵌的 script（' + blocks.length + ' 段）');
  let bad = '';
  blocks.forEach((b, i) => {
    const js = b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    try { new Function(js); } catch (e) { bad = '第 ' + (i + 1) + ' 段：' + e.message; }
  });
  ok(!bad, '★ 每一段都編譯得過' + (bad ? '　←　' + bad : ''));
}

section('★ 安全規則那張卡不可以再說謊');
{
  ok(!/set\(el, 'ok', '已生效'/.test(CODE),
     '★ 不再宣稱「已生效」—— 它驗不到「最後那一版有沒有發布成功」');
  ok(/整批下載擋住了/.test(CODE),
     '   改成只說它真的驗到的事（整批下載被擋）');
  /* 這幾句是給老師的出口。拿掉的話，這張卡又會變成
     「看起來什麼都檢查過了」，而那正是上次五天沒發現的原因。 */
  ok(/最後發布時間/.test(CODE),
     '★ 有告訴老師真正該去看哪裡（Console 的最後發布時間）');
  ok(/舊版規則一樣會擋|舊版.*也.*擋/.test(CODE),
     '★ 有明講「舊版規則也會擋」—— 不講的話綠燈還是會被當成全部都好');
  ok(/未定義的函式/.test(CODE),
     '   有提到「未定義的函式會讓整份規則發布失敗」（上次就是這個）');
}

section('★ Apps Script 的版本要看得到');
{
  /* GAS 編輯器裡的程式碼和「部署出去的版本」是兩回事。
     貼了新程式卻沿用舊部署，編輯器測起來一切正常，/exec 還是舊行為。 */
  ok(/function checkGas/.test(CODE), '有一張卡在檢查 Apps Script');
  ok(/action=ping/.test(CODE), '   用 ping 問它自己回報的版本');
  ok(/AIGUIDE/.test(CODE) && /GAS_URL/.test(CODE), '   網址從 config 取，不寫死');
  /* ⚠️ 三種狀態要分清楚，不可以都叫「沒有設定」。
     2026-08-11 被問了：上學期的狀態頁顯示「沒有設定」，看起來像少設了什麼 ——
     其實上學期本來就沒有用 AI 引導（只有 11502 的三個頁面會載 ai-guide.js）。
     「本來就不用」和「該設卻沒設」長得一樣的話，
     前者會被當成待辦追半天，後者則會被當成正常而一直沒設。 */
  ok(/這個學期沒有用到/.test(CODE),
     '★ config 沒有 AIGUIDE 那一區 → 說「這個學期沒有用到」，不是「沒有設定」');
  ok(/沒有填網址/.test(CODE),
     '   有 AIGUIDE 但沒填網址 → 另一種說法（那才是真的漏了）');
  /* 通行碼空著＝整塊功能關閉。學生端完全看不到「問問看」，
     而畫面上不會有任何說明 —— 所以狀態頁一定要講出來。 */
  ok(/通行碼還沒填/.test(CODE),
     '★ 有網址但 KEY 空著 → 要講明「問問看整塊不會出現」');
  ok(/QUERY_KEY/.test(CODE), '   並且告訴他去哪裡設（指令碼屬性的 QUERY_KEY）');
  /* 沒接 AI 引導不算壞 —— 學生端少一顆「問問看」，關卡照樣走得完。
     ⚠️ 只看 checkGas 這一段。整份掃的話會命中 ① Colab 後端那張卡的
        「沒有設定網址」—— 那裡是真的錯誤（後端是必要的），
        兩件事同名不同義。我第一版就這樣自己絆倒自己。 */
  const gas = CODE.slice(CODE.indexOf('function checkGas'));
  const gasFn = gas.slice(0, gas.indexOf('\n  }\n') + 4);
  ok(!/'bad',\s*'沒有/.test(gasFn),
     '   「沒設定」這幾種都是警告或正常，不是紅色錯誤（AI 引導本來就可以不接）');
  ok(/'bad', '連不上'/.test(gasFn),
     '   但「填了網址卻連不上」是錯誤 —— 那表示部署真的有問題');
  /* ★ GAS 自己回的錯誤訊息寫得比我們好（它會算給你看：
     伺服器的通行碼幾個字、你送來幾個字、是長度不同還是內容不同）。
     ⚠️ 包成一句「回應不正常」再附一坨 JSON，等於把答案藏起來。 */
  ok(/j\.error/.test(gasFn),
     '★ 直接端出 GAS 回的 error 文字（它寫得比「回應不正常」有用）');
  ok(/通行碼對不起來/.test(gasFn),
     '   通行碼不符時講明是哪一種問題，並指出兩邊要一模一樣');
  /* ⚠️ 不可以把期望版本寫死在這一頁。
     寫死的話，每次改 aiguide.gs 都要記得回來改這裡 ——
     而忘記的那一次會變成假紅燈，然後大家開始忽略它。 */
  ok(!/EXPECT_VERSION/.test(CODE),
     '★ 不寫死期望的版本 —— 忘了同步就會變成假紅燈');
  ok(/aiguide\.gs/.test(CODE), '   而是叫你自己和 shared/aiguide.gs 的 VERSION 比一眼');
}

section('卡片與說明對得起來');
{
  /* ⚠️⚠️ 2026-09-02：這一條寫死「六張卡」，而 ⑦ 截圖辨識效能加進來之後
     它就一直是紅的 —— 沒有人發現，因為 pre-commit 在老師的環境
     找不到 node 會**靜默略過**所有 *.test.js（見 hook 裡那段 if）。
     ★ 寫死數量的斷言每次加卡片都要手動改，遲早會漏。
     ⇒ 改成「每張卡都要有對應的自救說明」——
       這才是這一節本來想保護的事，而且加卡片時它會自己要求你補說明。 */
  const cards = [...CODE.matchAll(/card\('(\w+)',\s*'([^']+)'/g)].map(m => m[2]);
  ok(cards.length >= 7, '至少七張卡（目前 ' + cards.length + '）');
  const helpTitles = [...SRC.matchAll(/<dt class="font-bold text-slate-800">([^<]+)<\/dt>/g)]
    .map(m => m[1]);
  ok(helpTitles.length >= cards.length,
     '★★ 「檢查不過時怎麼辦」的條目不可以少於卡片數　←　說明 ' +
     helpTitles.length + ' 條 / 卡片 ' + cards.length + ' 張');
  ['後端離線', '後端是舊版', '沒有 Gemini 金鑰', '批改標準未設定',
   'Apps Script 版本不對', '安全規則到底有沒有發布成功',
   '截圖辨識變慢'].forEach(t => {
    ok(SRC.indexOf(t) >= 0, '「檢查不過時怎麼辦」有寫：' + t);
  });
}

section('★ 沒有殘留合併前的路徑');
{
  /* 2026-08-11 修掉的：讀不到 config 時，畫面教老師去開
     course_11501/shared/status.html —— 那是兩個 repo 合併**之前**的路徑。
     讀不到設定已經夠慌了，再照著一條死路走一遍只會更糟。 */
  ok(!/course_115\d\d\//.test(CODE),
     '★ 沒有 course_11501/ 這種合併前的路徑（那些資料夾已經不存在）');
  ok(/\?term=11501/.test(CODE) || /term=/.test(CODE),
     '   改用 ?term= 的說法');
}

section('★★ 後端連不上時，不可以說成別的原因');
{
  /* ⚠️⚠️ 2026-09-02 老師的檢查結果：
       ① 連不上　②③「後端連不上，跳過」
       ④「後端沒回報 → Colab 跑的是舊版 notebook，請重新上傳並全部執行」
     ★ 後端根本沒開的時候，④ 把老師支使去做一件完全不相干的事。
       而且它聽起來很具體 —— 比「不知道」更容易被相信，也更浪費時間。
     ⚠️ 根因：那一項只判斷「有沒有 criteria」，沒有先判斷「有沒有 health」。
       連不上 → health 是 null → 一路掉進「舊版」那個分支。
     ⇒ 每一個吃 health 的檢查都必須先擋 !health 才能談別的原因。
       這一條是結構性的：以後新增檢查項漏擋，這裡就會紅。 */
  const bodies = [...CODE.matchAll(/function (check\w+)\(el, health\)([\s\S]{0,700})/g)];
  ok(bodies.length >= 4,
     '找得到吃 health 的檢查項（' + bodies.length + ' 個）');
  const missing = bodies
    .filter(m => m[2].indexOf('if (!health)') < 0)
    .map(m => m[1]);
  ok(missing.length === 0,
     '★★ 每個吃 health 的檢查都要先擋「後端連不上」　←　' +
     (missing.length ? '漏掉：' + missing.join('、') : '都有擋'));

  // ★ 而且「舊版 notebook」這種具體指示，一定要在擋完 health 之後才出現
  const crit = /function checkCriteria\(el, health\)([\s\S]*?)\n  \}/.exec(CODE);
  ok(!!crit, '找得到 checkCriteria');
  if (crit) {
    const iGuard = crit[1].indexOf('if (!health)');
    const iOld = crit[1].indexOf('舊版 notebook');
    ok(iGuard >= 0 && iOld > iGuard,
       '★★ 「請重新上傳 notebook」必須排在「後端連不上」之後');
  }
}

section('★ 失敗原因要講人話，不要丟瀏覽器的原生訊息');
{
  /* ⚠️ 老師看到的原因是「signal is aborted without reason」——
     那是 AbortController 的原生說法，對人沒有意義，
     而且把「等太久」講得像程式當掉。 */
  ok(/function whyFetchFailed/.test(CODE),
     '★ 有一支把 fetch 例外翻成人話的函式');
  ok(/等了 .*秒沒有回應/.test(CODE),
     '★★ 逾時要講成「等了 N 秒沒有回應」');
  ok(/AbortError|abort/i.test(CODE),
     '   而且真的有認出 AbortError');
  // 秒數要從實際的逾時算出來，不可以寫死（寫死就會和 getJSON 的設定不一致）
  ok(/waitMs|wait \|\| 12000/.test(CODE),
     '★ 秒數要從實際逾時算，不是寫死的數字');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
