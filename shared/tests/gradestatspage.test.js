/* 程式批改觀測頁（shared/gradestats.html）
   跑法：node shared/tests/gradestatspage.test.js

   ⛔⛔ 這一頁為什麼存在（老師 2026-09-16）：
      {學期}-grade-stats 從 09-10 就一直在收資料，但整個 repo
      **沒有任何前端在讀它** —— 老師想看今天的批改狀況，
      唯一的辦法是問 Claude。收了看不到，等於沒收。

   ★ 這份測試守的不是「畫面好不好看」，是幾件**錯了不會有人發現**的事：
     顏色用錯類別、把不能比的數字擺在一起比、
     以及把「唯一的補救措施」順手刪掉。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const FILE = path.join(root, 'shared', 'gradestats.html');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const html = fs.readFileSync(FILE, 'utf8');
const js = (html.match(/<script type="module">([\s\S]*?)<\/script>/) || [, ''])[1];

section('★★ 這一頁只讀觀測資料，不碰成績與名冊');
{
  /* ⚠️ 這一頁只需要後端那一支 API。去讀 progress／roster 會多一份
     安全規則的暴露面，而且完全沒有必要 —— 它要的資料後端都有。 */
  ok(/\/api\/grade-stats/.test(js), '資料來源是 /api/grade-stats');
  ok(!/-progress|COLLECTIONS\.ROSTER|getFirestore/.test(js),
     '★★★ 完全沒有碰 Firestore 的成績與名冊集合');
  ok(/AUTH\.isTeacherEmail/.test(js),
     '★★ 有教師守門（畫面上有學號，不可以讓學生打開）');
  ok(/沒有密碼|本身沒有密碼/.test(js),
     '★★ 而且要老實寫明：後端那支 API 本身沒有密碼，這個登入擋的是' +
     '「順手打開這一頁」，不是「拿得到這份資料」');
}

section('★★★ 顏色：分數是序列、模型是類別，而且不可以循環');
{
  /* ⚠️ 分數有大小，要用**同一個色相由淺到深**；
     用四五種不同顏色（彩虹）表示分數高低，是最常見的那個錯。 */
  ok(/--s1:#86b6ef[\s\S]{0,120}--s5:#104281/.test(html),
     '★★ 分數用的是同一個藍色由淺到深（序列色）');
  /* ⚠️ 類別色循環使用＝兩個不同的模型長得一模一樣。
     梯子現在只有三階，但程式不可以預設它永遠只有三階。 */
  ok(!/MODEL_VARS\[[^\]]*%/.test(js),
     '★★★ 類別色**沒有**循環使用（第四個模型不是再回到第一個顏色）');
  ok(/modelVar/.test(js) && /#8a8a84/.test(js),
     '★★ 超出的模型給灰色 —— 寧可沒有顏色，也不要有錯的顏色');
}

section('★★★ 對比不足的補救不可以被刪掉');
{
  /* ⛔ #1baf7a 對背景的對比只有 2.74（低於 3:1）。
     驗色規則說：這種情況**必須**有補救 —— 直接標數字或提供表格版。
     這兩件事看起來只是「裝飾」，刪掉不會壞掉，但刪掉之後
     就只剩顏色在表達意思，色覺缺陷或黑白列印時整頁失效。 */
  ok(/不要把那些數字拿掉/.test(html),
     '★★ 原始碼裡有寫明這是補救措施，不是裝飾');
  ok(/counts\[i\] \+ '<\/span>|>' \+ counts\[i\] \+ '</.test(js) || /counts\[i\]/.test(js),
     '★★★ 每一條長條旁邊都直接標上數字');
  ok(/function tableSection/.test(js) && /逐筆/.test(html),
     '★★★ 一定要有逐筆表格（表格版是顏色之外的第二條路）');
}

section('★★★ 分數的桶要對齊 75 這條及格線');
{
  /* ⚠️ 通過門檻是 75（GATE.PASS_STARS = 2）。桶的邊界如果切在
     「0-20-40-60-80-100」，圖上就看不出誰過了 ——
     而那正是老師看這張圖唯一想知道的事。 */
  ok(/lo:75/.test(js) && /hi:74/.test(js),
     '★★★ 有一個桶的邊界正好切在 75（75–89 和 90–100 就是「過了」）');
  ok(/全部都是/.test(js) && /沒有鑑別度/.test(js),
     '★★★ 一關的分數全部一樣時要講出來 —— 2026-09-16 的資料裡 2-1-1A ' +
     '有 11 筆全是 100 分，那一關的分數等於不帶任何資訊');
}

section('★★★ 不能比的東西不可以擺在一起比');
{
  /* ⛔⛔ 每個模型看到的是**不同學生**的作品，所以「flash 中位數 100、
     haiku 中位數 80」完全不能拿來說哪個模型比較嚴 ——
     那是學生的差異，不是尺的差異。
     ★ 真正能比的只有「同一個人、同一關、同樣長度的程式被兩個模型評過」。
     這條測試守的是那句警語和那段配對比較都還在。 */
  ok(/不能直接比/.test(html),
     '★★★ 中位數那張表旁邊要寫明「不能直接比」（每個模型看到的學生不同）');
  ok(/pairs/.test(js) && /crosses/.test(js),
     '★★★ 要有「同一份程式、不同模型」的配對比較，並標出跨過及格線的');
  /* ⛔⛔ 2026-09-16 第二次拿真資料畫出來才發現：分組的鑰匙原本是
     [學號, 關卡, **字數**]，於是 1410212 的 3488 和 3486（差兩個字）
     被當成兩份不同的程式 —— 整件事裡最嚴重的那一筆
     （flash 50 ↔ haiku 95，差 45 分且跨過及格線）就從畫面上消失了。
     ★ 「用相等去比幾乎相等的東西」是這一頁最容易再犯的錯。 */
  ok(!/\[r\.student_id, r\.unit, r\.chars_student\]/.test(js),
     '★★★ 分組的鑰匙**不可以**含字數 —— 差兩個字就會讓最嚴重的那一筆消失');
  ok(/nearlySameCode/.test(js) && (js.match(/nearlySameCode/g) || []).length >= 3,
     '★★★ ②和③**共用同一個**「幾乎同一份程式」的判準 —— ' +
     '各寫一份的話，同一組資料會在一段裡算「改過了」、另一段算「沒改」，' +
     '而畫面上不會有任何徵兆');
  ok(/!r\.cached/.test(js),
     '★★ 模型比較要排除快取命中的那幾筆 —— 那不是那個模型當場評的');
  ok(/不是雜湊|長度一樣不保證/.test(html),
     '★★ 要講明 chars_student 只是近似值（長度一樣不保證內容一樣）');
}

section('★ 失敗與重送');
{
  ok(/不會<\/b>?寫進成績|不會.{0,6}寫進成績/.test(html),
     '★★ 要講明失敗不寫進成績（故障和交白卷不可以長得一樣）');
  ok(/不知道要改什麼/.test(html),
     '★★ 重送那一段要講明它是教學訊號，不是系統問題');
  ok(/讀不到/.test(html) && /不是「沒有資料」|不是.{0,4}沒有資料/.test(html),
     '★★★ 後端沒開時要說「讀不到」，不可以讓人以為「沒有資料」');
}

section('★★★ 分數變高不一定是進步');
{
  /* ⛔⛔ 2026-09-16：這一段的第一版把每一組都標成「進步 N 分」。
     拿真資料畫出來才發現它在說謊 ——
       1410212  50 → 50 → 50 → 95　標成「進步 45 分」
     但他的程式從 3488 字變成 3486 字，等於沒改；
     分數會跳是因為那一次降級到 claude-haiku。
       1410213  65 → 85 → 80　完全同一份程式（都是 3277 字）。
     ★ 把「換了模型」說成「學生進步了」，是這一頁能犯的最嚴重的錯：
       老師會拿它當教學成效的證據。
     ⚠️ 這個錯**測試抓不到、check.py 也抓不到** —— 每一行程式都是對的，
        錯的是它下的結論。只有把真資料畫出來、然後看一眼，才會發現。 */
  ok(/sameCode/.test(js),
     '★★★ 有判斷「程式到底有沒有改」（字數差不到 1% ＝ 實質同一份）');
  ok(/sameCode && spread > 0/.test(js) && /分數卻差/.test(js),
     '★★★ 程式沒改而分數變了，要說「分數卻差 N 分」，**不可以**說成進步');
  ok(/分數變的是尺，不是他/.test(js),
     '★★★ 而且要指名原因：換過模型的那幾組，變的是尺不是學生');
  ok(/shortModel\(r\.model\)/.test(js) && /seq = g\.map/.test(js),
     '★★ 重送序列的每一步旁邊都要印模型 —— 讓老師自己看得到是不是換了尺');
  ok(/分數變高不一定是進步/.test(html),
     '★★ 說明文字也要講明這件事（圖表旁邊的字和圖表一樣重要）');
}

section('★ 語法');
{
  let syntaxOk = true, err = '';
  try { new Function(js.replace(/^import[\s\S]*?;$/gm, '')); }
  catch (e) { syntaxOk = false; err = String(e.message || e); }
  ok(syntaxOk, '★★ 內嵌的 JS 語法正確' + (syntaxOk ? '' : '　←　' + err));
  ok(/gradestats\.html\?term=11501/.test(fs.readFileSync(path.join(root, '11501', 'teacher.html'), 'utf8')) &&
     /gradestats\.html\?term=11502/.test(fs.readFileSync(path.join(root, '11502', 'teacher.html'), 'utf8')),
     '★★ 兩個學期的教師端都連得過來（不然這一頁等於不存在）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
