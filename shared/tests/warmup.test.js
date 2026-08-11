/* 發言品質教程的判定測試
   跑法：node shared/tests/warmup.test.js

   ★ 這一份幾乎全部在測「不可以錯殺」。
     這一頁的每一次誤判，學生感受到的是「我認真寫了，它還說我不對」。
     發生兩次，他就會開始猜系統想看什麼字、為了過關而打字 ——
     那和我們要教的東西正好相反。
     所以下面「應該要過」的例子比「應該擋下」的多很多，這是刻意的。 */
'use strict';
const fs = require('fs');
const path = require('path');

const W = {};
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'warmup.js'), 'utf8'))(W);
const M = W.WARMUP;

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label); }
}
/** 應該要過 */
function yes(fn, text, label) { ok(fn(text).ok, '（可以過）' + label + '　「' + text + '」'); }
/** 應該擋下 */
function no(fn, text, label) { ok(!fn(text).ok, '（要擋下）' + label + '　「' + text + '」'); }

console.log('\n── ① 講具體 ──────────────────────────────');
const C = t => M.checkConcrete(t);
no(C, '我不會', '三個字，沒有任何資訊');
no(C, '不知道', '同上');
no(C, '我完全不會啊啊啊', '字數夠了，但拿掉空話什麼都不剩');
no(C, '這個東西真的很難我都不懂', '★ 長度騙得過去，內容還是空的');
no(C, '', '空白');
/* ↓ 以下每一句都必須放行。錯殺一句，學生就少信任一分。 */
yes(C, '我按綠旗之後角色沒有動', '做了什麼＋看到什麼');
yes(C, '畫出來變成一條直線，沒有轉彎', '講得出畫面');
yes(C, '重複 4 次那邊我不知道要填多少', '★ 有「不知道」但也有具體的位置');
yes(C, '第一個正方形畫好了第二個黏在一起', '講得出症狀');
yes(C, '我不會用參數，那格要填什麼', '★ 以「我不會」開頭但後面有東西');
yes(C, '角色會動可是筆沒有畫出線', '兩件觀察');
yes(C, '正方形歪掉了角度好像不對', '寫得普通，但有內容 —— 要過');

console.log('\n── ② 說出卡在哪一步 ──────────────────────');
const NAMES = ['下筆', '停筆', '重複', '移動', '右轉', '起點', '轉彎'];
const S = t => M.checkStep(t, NAMES);
no(S, '我卡住了', '沒有指出位置');
no(S, '這題好難喔完全做不出來', '抱怨，不是定位');
yes(S, '我卡在第 3 步', '寫編號');
yes(S, '我卡在第三步', '★ 國字數字也要認得');
yes(S, '前面都好了，重複那一段我不會', '講得出步驟名稱');
yes(S, '下筆之後就不知道要做什麼', '用步驟名稱定位');
yes(S, '步驟 4 停筆那裡怪怪的', '編號＋名稱');
yes(S, '轉彎的角度我不確定要填幾', '★ 只講名稱、沒有編號，一樣算指得出位置');

console.log('\n── ③ 用自己的話 ──────────────────────────');
const SRC = '把「畫正方形」這一段包成一個副程式，再用它畫出六個並排的正方形。';
const O = t => M.checkOwnWords(t, SRC);
no(O, '把「畫正方形」這一段包成一個副程式，再用它畫出六個並排的正方形。', '整句照抄');
no(O, '就是把畫正方形這一段包成一個副程式啦', '★ 加了頭尾，中間還是原文');
/* ↓ 這幾句都用到了題目裡的詞。用到不等於抄 —— 一句都不可以誤判。 */
yes(O, '因為那一段會做六次，取個名字比較好用', '完全自己的話');
yes(O, '六個正方形長得一樣，所以包成副程式', '★ 用到「正方形」「副程式」但不是抄');
yes(O, '不包起來的話同樣的積木要拼六遍', '講出題目沒寫的東西');
yes(O, '副程式就像幫那一段取一個名字', '比喻');
yes(O, '因為畫正方形這一段一直重複', '★ 有 8 個字和題目重疊 —— 門檻是 12，要放行');
ok(M._longestRun('完全不一樣的句子', SRC) < 5, '沒重疊時算出來就是很短');
ok(M._COPY_RUN >= 12, '★ 抄題門檻不可以調低到會誤傷正常說法');

console.log('\n── ④ 一次講一件事 ────────────────────────');
const N = t => M.checkOneThing(t);
no(N, '副程式怎麼建立？參數是什麼？', '兩個問號');
no(N, '要怎麼做？還有為什麼會歪掉？', '三件事');
no(N, '副程式怎麼建？還有參數要填什麼？', '「還有」＋問號');
yes(N, '副程式要怎麼建立？', '一個問題');
yes(N, '我想先問參數那一格要填什麼', '★ 沒有問號也算問，不可以因為沒問號就擋');
yes(N, '還有一段我沒做完，等一下再問', '★ 有「還有」但沒有在問問題 —— 要放行');
yes(N, '第 3 步和第 4 步中間那裡我不確定', '★ 提到兩個步驟但只有一個問題');

console.log('\n── ⑤ 綜合（第 5 關）──────────────────────');
/* ⚠️ 2026-08-10：這一關的標題是「四條規則一起用」，
   但 checkAll 原本只用了三條 —— 第 ② 條（說出卡在哪一步）漏掉了。
   結果是「字夠多、不是純空話、沒有兩個問號」就過得了關，
   而這一關要教的正好是「講得出你在哪裡卡住」。
   ★ 這幾句都夠長、也不是空話，但**指不出位置**，一定要擋。 */
{
  const A5 = t => M.checkAll(t, { source: '你想畫六個並排的正方形。第一個畫出來了，但第二個和第一個黏在一起，中間沒有空隙。' });
  ok(!A5('我剛剛做了很多事情然後發現有一個地方好像怪怪的所以我就想說要不要問一下老師').ok,
     '★ 字很多但指不出位置 → 擋下（第 ② 條真的有在跑）');
  ok(!A5('這個題目我看了很久然後想了一下覺得應該是要用某一種方法來處理但是我不太確定').ok,
     '★ 同上 —— 通篇沒有一個具體的位置或動作');
  ok(/卡在哪一步/.test(A5('我剛剛做了很多事情然後發現有一個地方好像怪怪的所以我就想說要不要問').why),
     '   而且回饋要說得出「缺的是位置」，不是只說「不行」');
  /* ★ 但收得要寬 —— 這一關的情境是圖形黏在一起，
     學生講「間隔」「第二個」「畫完」都算指得出位置。 */
  ok(A5('第二個正方形跟第一個疊住了，是不是我沒有先移動？').ok, '★「第二個」也算指得出位置');
  ok(A5('我猜是間隔設得比邊長小，所以才會黏住，這樣想對嗎').ok, '★「間隔」「邊長」也算');
  ok(A5('畫完第一個之後我不知道要走多遠才不會黏在一起').ok, '★「畫完」也算 —— 寧可放過，不可錯殺');
  ok(M._STEP_NAMES_5.length >= 12,
     '   第 5 關的位置詞收得夠多（' + M._STEP_NAMES_5.length + ' 個）—— 太少會錯殺');
}
const SRC5 = '你想畫六個並排的正方形。第一個畫出來了，但第二個和第一個黏在一起，中間沒有空隙。';
const A = t => M.checkAll(t, { source: SRC5 });
no(A, '我不會', '空話擋下');
no(A, '第二個和第一個黏在一起，中間沒有空隙', '★ 抄情境擋下');
no(A, '要怎麼分開？還有間隔要設多少？', '兩件事擋下');
yes(A, '兩個正方形貼在一起，我想問畫完之後要往旁邊走多少', '四條都做到');
yes(A, '第 5 步移到旁邊那裡，我填的數字好像太小了', '定位＋自己的話');
yes(A, '我猜是間隔設得比邊長小，所以才會黏住，這樣想對嗎', '★ 帶著假設來問 —— 最該鼓勵的那種');

console.log('\n── 回饋訊息要說得出「怎麼改」──────────────');
[C('我不會'), S('我卡住了'), O(SRC), N('這樣？那樣？')].forEach((r, i) => {
  ok(r.why && r.why.length > 15, '第 ' + (i + 1) + ' 條的回饋不是只講「錯了」');
  ok(!/錯誤|失敗|不合格/.test(r.why), '   而且不用「錯誤／失敗」這種字眼（' + r.id + '）');
});

console.log('\n── 題目資料本身 ──────────────────────────');
ok(M.STEPS.length === 5, '五個關卡');
ok(M.RULES.length === 4, '四條規則');
M.STEPS.forEach((s, i) => {
  ok(!!s.write, '第 ' + (i + 1) + ' 關要真的動手寫 —— 只讀不寫學不起來');
  ok(typeof s.write.check === 'function', '   而且寫完要有判定');
  ok(!!s.write.hint, '   卡住時要有提示（不然學生只能瞎猜）');
});
M.STEPS.slice(0, 4).forEach((s, i) => {
  ok(!!s.pick, '前四關都要先做一次判斷（第 ' + (i + 1) + ' 關）');
  ok(s.pick.options.filter(o => o.ok).length === 1, '   只有一個正確選項');
  ok(s.pick.options.every(o => o.msg && o.msg.length > 20),
     '★ 選錯的也要解釋為什麼 —— 只說「錯了」等於沒教');
});
ok(!M.STEPS[4].pick, '★ 最後一關沒有選擇題 —— 要自己寫才算學會');

/* 五個關卡的正解都要通得過自己的判定 —— 不然是題目在騙人 */
ok(M.STEPS[2].write.check('六個都一樣，那一段做六次，取名字比較好叫',
   { source: M.STEPS[2].write.source }).ok, '第 3 關的示範答案自己要過得了關');
ok(M.STEPS[4].write.check('我想問畫完一個之後要往右移動多少格',
   { source: M.STEPS[4].write.source }).ok, '第 5 關的示範答案自己要過得了關');


console.log('\n── 頁面與強制導向 ────────────────────────');
const page = fs.readFileSync(path.join(__dirname, '..', '..', '11502', 'warmup.html'), 'utf8');
const scr  = fs.readFileSync(path.join(__dirname, '..', '..', '11502', 'scratch.html'), 'utf8');

ok(/warmup\.js/.test(page), '教程頁載入引擎（判定只有一份）');
ok(!/gemini|GAS_URL|AIGUIDE/i.test(page), '★ 這一頁完全不碰 AI —— 不花額度、每個人看到的一樣');
ok(/warmup: true/.test(page) && /modules: \{ scratch: \{/.test(page),
   '完成紀錄寫進 modules.scratch.warmup');
/* ★ 學生寫的句子也要存 —— 那是「要不要為這一關接 AI」唯一的判斷依據。
   規則擋不住關鍵詞堆砌，而那種句子有多少，只能看真的資料。 */
ok(/warmupSaid/.test(page), '★ 五關寫的內容一起存（warmupSaid）');
ok(/slice\(0, 300\)/.test(page), '   每一則上限 300 字 —— 這是樣本，不是聊天紀錄');
ok(/if \(r\.ok\) said\[s\.id\]/.test(page),
   '   只留「通過的那一句」，不是每一次嘗試');
ok(/merge: true/.test(page), '   用 merge 寫 —— 不動 totalStars，安全規則自然過');
ok(/sessionStorage\.setItem\('warmup'/.test(page), '★ 同時記在 sessionStorage');
ok(/saveWarn|沒存起來/.test(page), '   存不進去要告訴學生，但不可以擋著他');

/* ★ 這一段是整份最危險的地方：擋錯人＝整站進不去。 */
ok(/location\.replace\('warmup\.html'\)/.test(scr), '沒做過就導去新手訓練');
ok(/location\.replace/.test(scr) && !/location\.href\s*=\s*'warmup/.test(scr),
   '★ 用 replace 不用 href —— 按上一頁不會又被彈回去');
ok(/sessionStorage\.getItem\('warmup'/.test(scr),
   '★ 有 sessionStorage 這道保險 —— Firestore 寫失敗不會整節課鬼打牆');

/* 讀進度失敗的那條路（catch）不可以有導向 —— 連線不好已經只開第 1 關，
   不要再罰第二次。 */
const catchBlock = scr.slice(scr.indexOf('} catch (e) {', scr.indexOf('getDoc')));
ok(!/warmup\.html/.test(catchBlock.slice(0, 900)),
   '★ 讀進度失敗時不導向 —— 連線問題不該讓人整站進不去');

/* 第 4～10 關沒有拆解資料，那條路不可以被任何改動弄壞。
   ⚠️ 2026-08-10 思考關卡搬到 level.html（一關一頁），所以改讀那一份 ——
      功能搬家了就把測試刪掉，是最容易在沒人發現的情況下失去保護的方式。 */
const lvPage = fs.readFileSync(path.join(__dirname, '..', '..', '11502', 'level.html'), 'utf8');
ok(/out\.push\(\{ key:'test'/.test(lvPage),
   '第 4～10 關「沒有關卡資料也走得到實作測試」那條路還在');

/* ★ sessionStorage 不是「一定拿得到」—— 跨來源 iframe、無痕模式下讀寫都會 throw。
   教程頁那一行若炸掉，saveWarmup 就跑不到：五關全做完卻什麼都沒存。 */
ok(/try \{ sessionStorage\.setItem/.test(page), '★ 教程頁的 sessionStorage 有包 try');
ok(/try \{ ranThisSession = sessionStorage/.test(scr), '★ 關卡頁的也有包 try');

/* ── ★ 第 5 關通過之後的「選 ＋ 對照」──────────────
   前四關都是「看 → 選 → 寫」，第 5 關原本只有「寫」——
   他寫完就走，沒有機會看到「同一件事還有更好的講法」。

   ⚠️ 這一段**不擋人**：選錯可以再選，對照完直接完成訓練。
      這一關是全站唯一「擋住就整站進不去」的地方，
      不可以在通過之後再長出第二道門檻。 */
{
  const w5 = M.STEPS[4].wrap;
  ok(!!w5, '第 5 關有對照環節');
  ok(w5.options.length === 4, '   四個候選句');
  ok(w5.options.filter(o => o.ok).length === 1, '   只有一個是好的問法');
  ok(w5.options.every(o => o.msg && o.msg.length > 10),
     '★ 每個選項都說得出「為什麼是／不是它」—— 只說錯了等於沒教');
  /* ★ 好的那一句要真的通得過四條規則 —— 不然是題目在騙人。 */
  const best = w5.options.filter(o => o.ok)[0];
  ok(M.checkAll(best.t, { source: M.STEPS[4].write.source }).ok,
     '★ 那個「好的問法」自己要過得了四條規則');
  /* ★ 三個壞的要各自壞在不同的地方 —— 四個選項壞法一樣就只剩兩選一。 */
  const bad = w5.options.filter(o => !o.ok)
    .map(o => M.ruleCheck(o.t, { source: M.STEPS[4].write.source })
                .filter(r => !r.ok).map(r => r.n).join(','));
  ok(new Set(bad).size === bad.length,
     '★ 三個不好的問法各自違反不同的規則（' + bad.join(' ｜ ') + '）');
}

/* 逐條檢查：畫面上打的勾，要和實際判定同一套規則 */
{
  const src5 = M.STEPS[4].write.source;
  const rc = t => M.ruleCheck(t, { source: src5 }).map(r => (r.ok ? 1 : 0)).join('');
  ok(M.ruleCheck('隨便', {}).length === 4, 'ruleCheck 回四條');
  ok(rc('第一個畫好了第二個黏在一起，我想問畫完之後要往旁邊走多少') === '1111',
     '★ 好句子四條全勾');
  ok(rc('我做了很多事情然後發現有一個地方好像怪怪的所以想問一下')[1] === '0',
     '   指不出位置 → 第 ② 條不打勾');
  ok(rc('為什麼會黏住？是不是寫錯了？還是要改邊長？')[3] === '0',
     '   一次問三件 → 第 ④ 條不打勾');
  ok(rc(src5)[2] === '0', '   整段抄情境 → 第 ③ 條不打勾');
}

/* ── ★ AI 的一句話回饋不可以擋到任何人 ───────────── */
{
  const page5 = fs.readFileSync(path.join(__dirname, '..', '..', '11502', 'warmup.html'), 'utf8');
  ok(/window\.ASKAI && window\.ASKAI\.coach/.test(page5),
     '★ 一律寫 window.ASKAI —— 裸的全域在這個 repo 已經咬過五次');
  ok(/if \(!tip\) return;/.test(page5),
     '★ AI 沒回東西就什麼都不顯示（不是顯示一塊空白框）');
  {
    /* 完成鈕要在呼叫 AI **之前**就綁好 —— 反過來的話，
       AI 那一段一炸，學生就按不到「完成訓練」。 */
    const iBtn = page5.indexOf("$('wrapDone').onclick");
    const iAI = page5.indexOf('window.ASKAI.coach');
    ok(iBtn > 0 && iAI > 0 && iBtn < iAI,
       '★ 完成鈕先綁好，才去呼叫 AI —— 順序反了的話 AI 一炸就沒人走得掉');
  }
  const askaiSrc = fs.readFileSync(path.join(__dirname, '..', 'askai.js'), 'utf8');
  const coach = askaiSrc.slice(askaiSrc.indexOf('function coach'), askaiSrc.indexOf('/** 送出去、收回來'));
  ok(/catch\(?[\s\S]{0,40}return ''/.test(coach.replace(/\s+/g, ' ')) || /return '';/.test(coach),
     '★ coach 失敗一律回空字串，不 throw —— 呼叫端不必寫 catch，也就不會有人忘了寫');
  ok(/if \(!enabled\(\)\) return Promise\.resolve\(''\)/.test(coach),
     '   沒設定 KEY 時直接回空字串，不送出任何請求');
  const gs5 = fs.readFileSync(path.join(__dirname, '..', 'aiguide.gs'), 'utf8');
  const h = gs5.slice(gs5.indexOf("p.action === 'coach'"), gs5.indexOf("if (p.action !== 'ask')"));
  ok(/ok: true, tip: ''/.test(h),
     '★ 伺服器端額度用完也回 ok:true —— 學生不該看到 AI 的家務事');
  ok(/COACH_CAP/.test(h), '   每人每天有上限');
  const pr = gs5.slice(gs5.indexOf('function coachPrompt_'));
  ok(/不可以.*打分數|不可以打分數/.test(pr),
     '★ 提示詞明講不可以打分數 —— 這一頁刻意沒有分數，' +
     '一顯示「你得幾分」，學生就會為了分數重寫');
  ok(/<<</.test(pr) && /只是資料/.test(pr), '   學生寫的內容當資料，裡面的指示不照做');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
