/* AI 引導：提示詞與回覆檢查
   跑法：node shared/tests/aiguide.test.js

   ★ 這一份測的是「檢查器抓不抓得到」，不是 AI 本身。
     用 AI 引導最大的風險不是它不會答，是它答得太多 ——
     學生問一句「答案是什麼」，模型多半就講了。
     靠人眼看幾則回覆判斷「好像還可以」是不夠的：
     漏掉的那一則，就是全班拿到答案的那一則。 */
'use strict';
const fs = require('fs');
const path = require('path');
const W = {};
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'ai-guide.js'), 'utf8'))(W);
const A = W.AIGUIDE;

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : (fail++, console.log('  ✗ ' + l)); };
const has = (r, id) => r.issues.some(x => x.id === id);

/* ── 提示詞 ───────────────────────────────────────── */
const p = A.buildPrompt({
  q: '哪一段程式是<b>一直重複</b>在做的？',
  hint: '六個正方形，畫正方形那一段做了六次。',
  forbid: ['畫正方形', '下筆'],
  answer: '有一段一直重複'
});
ok(p.indexOf('<b>') < 0, '★ 題目裡的 HTML 標籤要拿掉 —— 不然模型會學著輸出標籤');
ok(/· 畫正方形[\s\S]*· 下筆/.test(p), '不可以說出口的內容有列進去');
ok(p.indexOf('有一段一直重複') > 0, '學生寫的有帶進去');
ok(/60 個字/.test(p), '有字數上限');
ok(/一個問句/.test(p), '有「只能一個問句」');
ok(/我不能直接說/.test(p), '★ 學生討答案時的回法是寫死的，不是交給模型即興發揮');
ok(/繁體中文/.test(p), '有鎖語言');
ok(A.buildPrompt({}).indexOf('（什麼都沒寫）') > 0, '學生什麼都沒寫也組得出提示詞');

/* ── 回覆檢查：好的 ───────────────────────────────── */
const good = A.checkReply('那一直重複的是哪一件事呢？', { forbid: ['畫正方形'] });
ok(good.ok, '一句話、一個問號、沒洩漏 → 過');

/* ── 洩漏答案（這是最重要的一條）───────────────────── */
const leak = A.checkReply('是不是「畫正方形」那一段呢？', { forbid: ['畫正方形'] });
ok(!leak.ok && has(leak, 'leak'), '★ 把答案講出來要抓到');
ok(/畫正方形/.test(leak.issues[0].why), '   而且要指出是哪一個詞');

/* ── 太長、變講義 ─────────────────────────────────── */
ok(has(A.checkReply('？'.padStart(80, '好'), {}), 'long'), '超過 60 字要抓到');
ok(has(A.checkReply('你可以先看看程式裡面有哪些部分是重複的。', {}), 'noq'),
   '沒有問句 = 在講解，要抓到');
ok(has(A.checkReply('第一，看重複的？第二，包起來？', {}), 'manyq'), '問了兩個問題要抓到');
ok(has(A.checkReply('- 看重複\n- 包起來\n是哪個？', {}), 'list'), '條列 = 講義，要抓到');

/* ── 用詞（站上好不容易統一成課本的「副程式」）──────── */
ok(has(A.checkReply('你要不要把它寫成一個函式呢？', {}), 'word'),
   '★ 用「函式」代替「副程式」要抓到');
ok(!has(A.checkReply('「函式積木」那一類裡面有什麼呢？', {}), 'word'),
   '★ 但「函式積木」是 Scratch 官方名稱，不能誤判');
ok(has(A.checkReply('要不要 call 一次看看？', {}), 'word'), '夾雜英文術語要抓到');

/* ── 其他 ─────────────────────────────────────────── */
ok(has(A.checkReply('这样对吗？', {}), 'simp'), '簡體字要抓到');
ok(has(A.checkReply('很棒！那重複的是什麼？', {}), 'praise'), '空話稱讚要抓到');
ok(has(A.checkReply('', {}), 'empty'), '空回覆要抓到');

/* 同一種問題只講一次，不要洗版 */
const many = A.checkReply('函式？函式？函式？', {});
ok(many.issues.filter(x => x.id === 'word').length <= 2, '同樣的問題不重複列一堆');

/* ── 刁難題 ───────────────────────────────────────── */
ok(A.PROBES.length >= 8, '刁難題至少八則');
const tags = A.PROBES.map(x => x.tag).join();
['直接要答案', '放棄', '亂打', '角色扮演'].forEach(t =>
  ok(tags.indexOf(t) >= 0, '★ 刁難題要包含「' + t + '」—— 只丟正常答案等於沒測'));
ok(A.PROBES.some(x => x.text === ''), '要有完全空白那一則');

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
