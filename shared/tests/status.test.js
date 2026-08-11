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
  /* 沒接 AI 引導不算壞 —— 學生端少一顆「問問看」，關卡照樣走得完。 */
  ok(/'warn', '沒有設定'/.test(CODE),
     '★ 沒設定 GAS_URL 是警告不是錯誤（AI 引導本來就可以不接）');
  /* ⚠️ 不可以把期望版本寫死在這一頁。
     寫死的話，每次改 aiguide.gs 都要記得回來改這裡 ——
     而忘記的那一次會變成假紅燈，然後大家開始忽略它。 */
  ok(!/EXPECT_VERSION/.test(CODE),
     '★ 不寫死期望的版本 —— 忘了同步就會變成假紅燈');
  ok(/aiguide\.gs/.test(CODE), '   而是叫你自己和 shared/aiguide.gs 的 VERSION 比一眼');
}

section('卡片與說明對得起來');
{
  const cards = (CODE.match(/card\('/g) || []).length;
  ok(cards === 6, '六張卡（' + cards + '）');
  ['後端離線', '後端是舊版', '沒有 Gemini 金鑰', '批改標準未設定',
   'Apps Script 版本不對', '安全規則到底有沒有發布成功'].forEach(t => {
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

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
