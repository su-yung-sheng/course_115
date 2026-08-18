/* 把題庫裡的明碼答案換成雜湊
   跑法：node shared/tools/hash-answers.js            （檢查，不改檔）
         node shared/tools/hash-answers.js --write    （真的改檔）

   ★ 為什麼要有這支工具（老師 2026-08-17）
     選擇題的題庫寫成 { "q": …, "options": […], "correct": 2 }，
     而這個 repo 是公開的 —— 學生 F12 一開就看得到答案。
     這支把每一題的 correct 換成 a（雜湊），資料檔裡不再有「哪一個是答案」。

   ★ 以後加題目怎麼辦
     照舊寫 "correct": n，寫完跑一次這支加 --write 就換好了。
     ⚠️ 忘了跑也不會壞掉（quiz-engine 兩種都吃），
        但 anskey.test.js 會紅字提醒你「還有明碼答案沒換」。

   ⚠️ 這支**不重新序列化整個檔案**。
     資料檔裡有大量註解、跳脫過的 HTML 教材（notes），
     JSON.parse 之後再 stringify 會把那些全部改寫掉 ——
     那是「為了改一個欄位而動到整份檔案」，太危險。
     ⇒ 改成用正規表示式抓出每一題那個**單行 JSON 物件**，逐題替換。
       題庫是機器產生的，格式一致，這樣最小侵入。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const ANSKEY = require(path.join(ROOT, 'shared', 'anskey.js'));

const FILES = [
  '11501/content/ethics.js',
  '11502/content/social.js',
  /* 第 6 章期末檢核（第 10 關最後一步）—— 結構不一樣（types/questions），
     但每一題還是同一個單行 JSON 物件，所以同一支工具吃得下。 */
  '11502/content/final.js'
];

const write = process.argv.indexOf('--write') >= 0;
let totalDone = 0, totalLeft = 0, bad = 0;

/* 一題就是一個 {"q": …, "options": […], "correct": n} 的單行物件。
   ⚠️ 非貪婪，而且一定要收在 "correct": 數字 } —— 不然會吃掉整個陣列。 */
const RE = /\{"q":\s*"(?:[^"\\]|\\.)*",\s*"options":\s*\[(?:[^\[\]\\]|\\.)*\],\s*"correct":\s*\d+\}/g;

FILES.forEach(rel => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { console.log('（找不到）' + rel); return; }
  let src = fs.readFileSync(p, 'utf8');

  const hits = src.match(RE) || [];
  let done = 0;
  const out = src.replace(RE, m => {
    let it;
    try { it = JSON.parse(m); }
    catch (e) { bad++; console.log('  ⚠️ 解不開：' + m.slice(0, 60) + '…'); return m; }
    const opt = it.options[it.correct];
    if (opt === undefined) {
      bad++; console.log('  ⚠️ correct 指到不存在的選項：' + it.q.slice(0, 30));
      return m;
    }
    done++;
    /* 只換掉 correct 這一欄，其他原樣保留（連鍵的順序都不動） */
    const a = ANSKEY.of(it.q, opt);
    return m.replace(/,\s*"correct":\s*\d+\}$/, ', "a": "' + a + '"}');
  });

  /* 還剩幾題是明碼（例如格式不一樣、regex 沒抓到的） */
  const left = (out.match(/"correct":\s*\d+/g) || []).length;
  totalDone += done; totalLeft += left;

  console.log(rel + '：換掉 ' + done + ' 題' + (left ? '，還剩 ' + left + ' 題明碼 ⚠️' : ''));

  if (write && done) {
    fs.writeFileSync(p, out, 'utf8');
    /* ★ 換完立刻驗一次：載進來，每一題都要能用 a 反查回正確選項。
       ⚠️ 資料檔開頭是註解、內容是 `window.QUIZ_CONTENT = {…}`，
          所以要先給一個 window 再 eval —— 第一版寫成
          `.replace(/^window\./, 'g.')` 只換得到「檔案開頭」那一個字，
          而檔案開頭是註解，於是照樣丟 window is not defined。 */
    /* ⚠️ 不可以用 (0, eval)：那是**間接 eval**，在全域範疇跑，
       看不到這裡的區域變數（第二版就是這樣丟 g is not defined）。
       new Function 把 window 當參數傳進去，乾淨也沒有這個問題。 */
    const w = {};
    new Function('window', fs.readFileSync(p, 'utf8'))(w);
    const C = w.QUIZ_CONTENT || {};
    let n = 0, ok = 0;
    const walk = qs => (qs || []).forEach(q => {
      n++; if (ANSKEY.find(q.q, q.options, q.a) >= 0) ok++;
    });
    (C.chapters || []).forEach(c => {
      if (c.challenge) walk(c.challenge.questions);
      (c.sections || []).forEach(s => walk(s.questions));
    });
    /* ⚠️ 期末檢核的題庫是另一種結構（FINAL_BANK.types[].questions[]）。
       不走這一段的話，寫回之後的檢查會報「0 題」——
       那不是「沒問題」，是「什麼都沒驗到」，而且看起來一模一樣。 */
    ((w.FINAL_BANK || {}).types || []).forEach(t => walk(t.questions));
    console.log('  ' + (n === ok ? '✅' : '❌') +
                ' 寫回後檢查：' + n + ' 題，反查得回答案的 ' + ok + ' 題');
    if (n !== ok) bad++;
  }
});

console.log('\n合計換掉 ' + totalDone + ' 題' +
            (totalLeft ? '，仍有 ' + totalLeft + ' 題明碼' : '') +
            (bad ? '，' + bad + ' 題有問題' : ''));
if (!write) console.log('（這是檢查模式，沒有改檔。要真的換請加 --write）');
process.exit(bad ? 1 : 0);
