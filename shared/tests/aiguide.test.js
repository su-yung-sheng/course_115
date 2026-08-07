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
/* ★ 學生什麼都沒寫時，原本送的是「（什麼都沒寫）」——
   模型只能亂猜他卡在哪，那不是對話的開始，是無話可說。
   現在改成開場模式：由 AI 主動起頭。 */
ok(A.buildPrompt({}).indexOf('這是開場') > 0, '什麼都沒寫 → 進入開場模式');
ok(!/什麼都沒寫/.test(A.buildPrompt({})), '   不再只是丟一句「什麼都沒寫」給模型');

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

/* ── 情境、目標、開場 ─────────────────────────────
   ★ 這三樣本來都沒有，而少了它們對話根本開始不了：
     · 沒有情境 → AI 不知道學生正在畫六個正方形
     · 沒有目標 → AI 不知道「講到什麼算數」
     · 沒有開場 → 學生還沒寫字時，AI 拿到「（什麼都沒寫）」只能亂猜 */
const KEYS = [
  { name: '察覺重複', any: ['重複', '一直', '每次'] },
  { name: '重複的是什麼', any: ['畫正方形', '那一段'] }
];

const pOpen = A.buildPrompt({ task: '畫六個並排的正方形', q: '哪一段重複？', keys: KEYS, answer: '' });
ok(/畫六個並排的正方形/.test(pOpen), '★ 提示詞裡有「這一關在做什麼」（情境）');
ok(/開場/.test(pOpen), '★ 學生還沒寫字時，要叫 AI 開場');
ok(/你覺得呢/.test(pOpen), '   並且明講不要問「你覺得呢」這種沒有指向的空問句');
ok(/· 察覺重複[\s\S]*· 重複的是什麼/.test(pOpen), '開場時列出這一輪要引導到的重點');
ok(!/還缺/.test(pOpen), '   但開場時不講「還缺什麼」—— 他根本還沒寫');

const pHalf = A.buildPrompt({ task: 'x', q: 'y', keys: KEYS, answer: '有一段一直重複' });
ok(/他已經講到：察覺重複/.test(pHalf), '★ 寫了一半時，要告訴 AI 他已經講到哪些');
ok(/還缺：重複的是什麼/.test(pHalf), '★ 以及還缺哪一個 —— 這才是 AI 要問的方向');
ok(/不要再問他已經講過的/.test(pHalf), '   並且明講不要重複問已經答出來的');

/* 沒設 keys 的問題也要能用 —— 19 問裡只有 8 問設了 */
const pNone = A.buildPrompt({ task: 'x', q: 'y', answer: '隨便寫' });
ok(/講出自己的想法就好/.test(pNone), '沒設關鍵概念的問題，目標退成「講出想法就好」');
ok(!/還缺/.test(pNone), '   而且不會憑空冒出「還缺」');

/* ── 關鍵概念的命中判定 ───────────────────────── */
ok(!A.hitKeys('有一段一直重複', KEYS).done, '只講到一半 → 還沒完成');
ok(A.hitKeys('畫正方形那一段一直重複', KEYS).done, '兩個都講到 → 完成');
ok(A.hitKeys('每次都在畫正方形', KEYS).done, '★ 換句話說也要算 —— 不必用題目裡的字');
ok(!A.hitKeys('', KEYS).done, '什麼都沒寫不算完成');
ok(!A.hitKeys('隨便', []).done, '★ 沒設關鍵概念時不能算「完成」（不然等於自動放行）');
ok(A.hitKeys('重複', KEYS).hit.length === 1, '算得出命中幾個');

/* 真正的關卡資料 */
const LV = {};
new Function('window', fs.readFileSync(
  path.join(__dirname, '..', '..', '11502', 'content', 'blocks.js'), 'utf8'))(LV);
const q3 = LV.BLOCK_LEVELS['2-1-1'].analysis.qs[2];
ok((q3.keys || []).length >= 2, '第 1 關第 3 問設了關鍵概念');
ok(A.hitKeys('畫正方形那段一直重複', q3.keys).done, '   學生答對就判得出來');
ok(!A.hitKeys('我不知道', q3.keys).done, '   答不出來不會誤放');
/* 同義說法要夠多 —— 漏了就會把答對的學生擋在外面 */
(q3.keys || []).forEach((g, i) => {
  ok([].concat(g.any || g).length >= 3, '第 ' + (i + 1) + ' 個概念至少列三種說法');
});


/* ── 2026-08-07 實測跑完 10 種刁難之後補的 ───────────
   十則全部「沒抓到問題」，但其中三件事是壞的。都釘在這裡。 */

/* ★ ① 同義詞不可以跨問共用。
   「重複」是第 3 問（哪一段一直重複）的答案。
   放進第 1 問的「做四次」的話，學生寫「有一段一直重複」
   會被判成講到了「一條邊要畫四次」—— 他根本沒講到。
   判錯的代價是 AI 不會再往那個方向問，學生帶著誤解過關。 */
const L11 = LV.BLOCK_LEVELS['2-1-1'].analysis.qs[0];
const four = L11.keys.find(k => k.name === '做四次');
ok(!!four, '第 1 問有「做四次」這個關鍵概念');
ok(!four.any.includes('重複'), '★ 「做四次」不可以把「重複」當同義詞');
ok(!four.any.includes('一直'), '★ 也不可以是「一直」');
ok(!A.hitKeys('有一段一直重複', L11.keys).hit.includes('做四次'),
   '★ 學生寫「有一段一直重複」，不算講到「做四次」');
ok(A.hitKeys('走一段就轉，做四次', L11.keys).done,
   '   真的講到才算 —— 這一句要全中');
/* 而同一句話在第 3 問要算中 —— 那一問問的就是重複 */
ok(A.hitKeys('有一段一直重複', LV.BLOCK_LEVELS['2-1-1'].analysis.qs[2].keys)
     .hit.includes('察覺有東西重複'),
   '   同一句在第 3 問要算中（同義詞跟著那一問走）');

/* ★ ② 模型會自己編角色的名字。
   實測：問「畫正方形」時它說「烏龜要怎麼走」——
   前幾句都叫小貓，學生會以為畫面上還有另一個角色。 */
ok(/角色名稱|自己編/.test(A.SYSTEM), '★ 提示詞要禁止自己編角色名稱');
ok(/烏龜/.test(A.SYSTEM), '   並且直接舉那個實際發生過的例子');

/* ★ ③ 「全部講到」那一則不可以寫死。
   寫死的句子只對某一問成立，換一問就測不到
   「關鍵概念全中就不問 AI」那條路 —— 那條路十次一次都沒跑到。 */
const last = A.PROBES[A.PROBES.length - 1];
ok(last.fromKeys === true, '★ 最後一則刁難題要依「現在選的那一問」自動組');
ok(!/正方形/.test(last.text || ''), '   不可以殘留寫死的句子');


/* ── 討答案時的回法：前半寫死、後半讓 AI 接 ─────────
   為什麼要改：實測十則裡五則是討答案的攻擊，模型五則全部照辦、
   一字不差 —— 防守是成立的，但學生會連看五次同一句 42 個字。 */
const H = A.REFUSE_HEAD;
ok(!!H, '有「拒絕的固定開頭」');
ok(A.SYSTEM.indexOf(H) >= 0, '提示詞裡就是這一句（兩邊不可以各寫各的）');
ok(/針對【現在卡住的是這一問】/.test(A.SYSTEM), '★ 後面接的問句要和這一問有關，不可以空泛');

/* ★ 最容易自己絆倒的地方：固定開頭佔掉 20 個字。
   算進字數的話「拒絕 ＋ 一個好問句」幾乎一定超標，
   然後被自己的檢查擋掉、退回罐頭 —— 等於白改。 */
const okRefuse = A.checkReply(H + '畫一條邊之後，筆要往哪個方向轉？', { forbid: [] });
ok(okRefuse.ok, '★ 拒絕 ＋ 一個好問句要過（固定開頭不計入字數）');
ok(okRefuse.chars === 16, '   字數只算後面那個問句（得到 ' + okRefuse.chars + '）');
ok(!A.checkReply(H + '要往哪轉？'.repeat(12), { forbid: [] }).ok, '後面真的太長還是要擋');

/* 放寬字數不等於放寬別的 —— 洩漏、多問句、稱讚照擋 */
ok(!A.checkReply(H + '是不是要右轉 90 度呢？', { forbid: ['右轉 90'] }).ok,
   '★ 開頭對了也不能洩漏答案');
ok(!A.checkReply(H + '你要轉嗎？往哪轉？', { forbid: [] }).ok, '   也不能問兩個');
ok(!A.checkReply(H + '很棒，那要往哪轉？', { forbid: [] }).ok, '   也不能稱讚');


/* ── name 是給模型看的指示，不是標籤 ────────────────
   實測：name 叫「走一段再轉」時，八成的回覆在問「怎麼畫出第一條邊」，
   而學生答「往前走」不會命中 any（裡面全是「轉」的同義詞）—— 繞不出去。
   ★ 判定標準在 any，引導方向在 name。兩個對不上，
     AI 就會很努力地把學生帶去一個不算分的地方。 */
const turn = L11.keys[0];
ok(/轉/.test(turn.name), '★ 第一項的 name 要點出「轉」—— 那才是 any 認的東西');
ok(!/^走一段再轉$/.test(turn.name), '   不可以退回舊的寫法');
LV.BLOCK_LEVELS['2-1-1'].analysis.qs.forEach((q, i) => {
  (q.keys || []).forEach(g => {
    /* name 至少要和它自己的某一個同義詞沾得上邊，
       否則模型讀 name、學生答 any，兩邊各說各話。 */
    ok(g.any.some(w => g.name.indexOf(w) >= 0),
       '第 ' + (i + 1) + ' 問「' + g.name + '」的 name 要含得住自己的同義詞');
  });
});

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
