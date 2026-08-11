/* 11502/scratch.html 的「思考關卡」流程
   跑法：node shared/tests/scratchpage.test.js

   這一頁擋在「上傳作品」前面，擋錯的代價是整班交不了作業 ——
   所以這裡測的重點是「什麼情況下不可以擋」。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, '11502', 'scratch.html'), 'utf8');
/* ★ 2026-08-10：思考關卡（拆解／推導／拼圖／上傳）搬到 level.html —— 一關一頁。
   這一份原本有一半在測那些流程，它們的**意圖仍然成立**，只是換了地方，
   所以改成讀 level.html，不是把測試刪掉。
   ⚠️ 「功能搬家了就把測試刪掉」是最容易失去保護的方式 ——
      刪掉的那一刻沒有人會發現，直到那個行為壞掉。 */
const lvHtml = fs.readFileSync(path.join(ROOT, '11502', 'level.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : (fail++, console.log('  ✗ ' + l)); };

/* ★ 最重要的一條：第 4～10 關還沒有積木題目。
   無條件擋的話那七關會永遠上傳不了 —— 開學就炸。 */
ok(/lv && lv\.analysis/.test(lvHtml) && /lv && lv\.goal/.test(lvHtml),
   '★ 沒有題目的關卡要直接放行（步驟依資料有無決定）');
   ok(/實作測試/.test(lvHtml), '   而且最後一定有實作測試那一步');

const W = { CONFIG: {}, BLOCK_LEVELS: {} };
new Function('window', fs.readFileSync(
  path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8'))(W);
const ids = Object.keys(W.BLOCK_LEVELS);
const units = ['4-2-1','4-2-2','4-2-3','4-3-1','6-1-1','6-2-1','6-2-2','6-3-1','6-3-2','6-3-3'];
const missing = units.filter(u => ids.indexOf(u) < 0);
ok(missing.length === 0,
   '★ 十關都有關卡資料了' + (missing.length ? '（還缺：' + missing.join('、') + '）' : ''));
/* ⚠️ 2026-08-12：這一條原本寫的是「目前有幾關**沒有**題目」，
      因為那時候第 4～10 關還是空的，無條件擋的話那七關會永遠上傳不了。
      現在十關都補完了，那個前提不存在了 —— 所以改成反過來釘：
      少掉任何一關就變紅。

   ★ 但「沒有資料的步驟不出現」這條規則**沒有跟著消失**，
     而且比以前更重要：現在每一關都有資料，卻不是每一關都有每一步
     （第 5 關沒有拼圖、第 3 關沒有拆解、第 6 章那五關才有實驗室）。
     下面那幾條就是在釘這件事。 */
ok(ids.every(id => units.indexOf(id) >= 0),
   '★ 沒有多出 config.js 以外的關卡代號（多出來的學生永遠走不到）');

/* 步驟數要跟著關卡有什麼而變，不能寫死三步 */
const steps = lv => {
  const out = [];
  if (lv.analysis) out.push('analysis');
  if (lv.derive) out.push('derive');
  if (lv.lab) out.push('lab');           // ← 第 6 章那幾關的互動實驗室
  if (lv.goal) out.push('blocks');       // ← 和頁面同一條規則
  return out;
};
const s1 = steps(W.BLOCK_LEVELS['4-2-1']);
const s3 = steps(W.BLOCK_LEVELS['4-2-3']);
ok(s1.join() === 'analysis,blocks', '第 1 關兩步：拆解 → 拼圖（沒有推導）');
ok(s3.join() === 'derive,blocks', '第 3 關兩步：推導 → 拼圖（沒有拆解）');

/* ★ 第 5 關有拆解也有追蹤，但沒有積木拼圖（課本用圖解不是程式）。
   preSteps 若無條件加上 'blocks'，這一關會停在一個空的積木區，
   而且永遠上傳不了 —— 和第 4～10 關那個坑是同一個。 */
const l5 = W.BLOCK_LEVELS['6-1-1'];
ok(!!l5 && !l5.goal, '第 5 關有內容但沒有 goal');
ok(steps(l5).join() === 'analysis,derive', '★ 所以它的步驟裡沒有拼圖');
   ok(/if \(lv && lv\.goal\)   out\.push/.test(lvHtml), '   程式裡確實是看有沒有 goal 才加拼圖');
   ok(/markPre\(\)/.test(lvHtml), '   沒有拼圖的關卡也要標記得了完成（markPre）');
   ok(/out\.push\(\{ key:'test'/.test(lvHtml), '   一步都沒有時也還有實作測試，不會變空白');

/* ★ 第 6 章那五關（6-2-1／6-2-2／6-3-1／6-3-2／6-3-3）才有互動實驗室。
   ⚠️ 第 4 章那四關**不可以**有 —— 它們的主角是程式拼圖。
      每一關都掛實驗室的話，它就從「這一關的重點」變成點擊過場。 */
const withLab = ids.filter(id => W.BLOCK_LEVELS[id].lab).sort();
ok(withLab.join() === '6-2-1,6-2-2,6-3-1,6-3-2,6-3-3',
   '★ 只有第 6 章那五關有互動實驗室（實得：' + withLab.join('、') + '）');
ok(withLab.every(id => (W.BLOCK_LEVELS[id].lab.kind === 'sort' ||
                        W.BLOCK_LEVELS[id].lab.kind === 'search')),
   '   每一個 lab 都指定得出要掛哪一支模組（sort／search）');
/* 第 5 關是排序的觀念導入，用的是 derive 裡的手動追蹤，不是 lab。
   ⚠️ 兩個都放的話，學生會連續做兩次一模一樣的事。 */
ok(!l5.lab && (l5.derive.steps || []).some(s => s.kind === 'sort'),
   '★ 第 5 關用 derive 裡的手動排序，不另外掛 lab（不然會連做兩次同一件事）');

/* ── ★ 補充教材：三支互動頁收進關卡 ────────────────────
   ⚠️ 2026-08-12 之前它們掛在闖關基地的入口，沒有任何關卡連得到。
      問題不是「連不到」，是**時機錯了**：學生會先自己玩過一次，
      等真正上到那一關時就沒有「第一次看到」的效果了 ——
      而那個效果正是這幾個互動存在的理由。
   ★ 現在改由 material 欄位掛進對應的關卡。
     這幾條要釘住「掛對關」，掛錯關等於沒掛。 */
/* ⚠️ 6-2-2 原本掛 sort.html，2026-08-12 改寫進 sortlab.js 之後原檔已刪。
   剩下兩支也會照同樣的方式處理掉。 */
const MAT = { '4-3-1': 'logic.html', '6-2-1': 'search.html' };
Object.keys(MAT).forEach(id => {
  const m = W.BLOCK_LEVELS[id].material;
  ok(!!m && m.href === MAT[id],
     '★ ' + id + ' 掛的補充教材是 ' + MAT[id] + '（實得：' + ((m && m.href) || '沒有') + '）');
  ok(!!m && m.title && m.note,
     '   ' + id + ' 的補充教材有標題和一句說明（沒說明學生不會點）');
});
ok(ids.filter(id => W.BLOCK_LEVELS[id].material).length === 2,
   '★ 還沒改寫完的補充教材剩 2 支（改寫完要歸零）');
/* ⚠️ material 和 quiz 題目裡的 ref 是兩件事，別混用。
   ref 指回「這一題在問哪個步驟」，material 是外部教材。 */
ok(/materialPanel\(\)/.test(lvHtml), '關卡頁畫得出補充教材面板');
ok(/let materialOpen = false/.test(lvHtml),
   '★ 預設收合 —— 十關都嵌一個模擬器會很慢，展開才載');
ok(/toggle-material/.test(lvHtml), '   面板點得開');
/* ⚠️ 三支頁面各有一顆「← 返回基地」。嵌進關卡頁的 iframe 之後，
   那顆按鈕會把 iframe 導到闖關基地 —— 學生會看到「關卡裡面有一個入口」。
   11501 的 music.html／whatislist.html 早就處理過同一件事，這裡照同一個做法。 */
Object.values(MAT).forEach(f => {
  const src = fs.readFileSync(path.join(ROOT, '11502', f), 'utf8');
  ok(/window\.self!==window\.top/.test(src) && /back-to-hub/.test(src),
     '★ ' + f + ' 被嵌進 iframe 時會把「返回基地」藏起來');
});
ok(!/out\.push\('analysis'\);\s*out\.push\('derive'\)/.test(html), '步驟不是寫死的');

/* ── ★ 卡片上的說明只能有一個來源 ─────────────────
   ⚠️ 2026-08-11 實際看到：第 2、3 關的卡片掛著**別的單元的介紹**
      （「照著清單裡的音階播出來」「把全班分數加起來再除以人數」）。
      那是一份手寫的 EXTRA 對照表，內容是上學期的 ——
      當初把 11501 的 config 複製過來時留下的，
      而且鍵值 2-1-1A／2-1-1B／2-1-4 在下學期根本不存在。
      第 1 關沒有對應鍵值所以什麼都沒有 —— 三張卡三種行為。

   ★ 說明只該來自關卡資料自己的 task。手抄一份到頁面裡，
     改了關卡就得記得回來改 —— 而那次一定會忘。 */
console.log('\n── ★ 闖關地圖的說明來自關卡資料 ──');
{
  const code = html.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');
  ok(/BLOCK_LEVELS/.test(code) && /\.task/.test(code),
     '★ 卡片說明取自 BLOCK_LEVELS[…].task');
  ok(!/const EXTRA\s*=/.test(code),
     '★ 沒有手寫的說明對照表（那份一定會和關卡資料走鐘）');
  /* 那幾句上學期的文案不可以再出現在畫面上。
     ⚠️ 比對 code（已去註解），不是 html ——
        scratch.html 的註解裡正好引用了這幾句來說明「為什麼不要它們」。
        拿原始檔比對的話，那段說明會自己把測試打成紅字。
        這已經是今天第八次同一種錯了：**「不可以再出現」的檢查，
        一律先去註解。** */
  ['清單裡的音階', '全班分數加起來', '幸運兒'].forEach(t => {
    ok(code.indexOf(t) < 0, '   沒有殘留上學期的文案「' + t + '」');
  });
  /* 還沒寫內容的關卡要講「內容準備中」，不是留一片空白 ——
     空白看起來像壞掉，而這幾關本來就還沒做。 */
  ok(/內容準備中/.test(code), '   還沒寫的關卡顯示「內容準備中」，不是空白');
}

/* 一次只出現一步 —— 攤開的話後面的題目會洩漏前面的答案 */
   ok(/const s = S\[at\];/.test(lvHtml), '一次只畫目前這一步');
   ok(/get\('unit'\)/.test(lvHtml), '換關卡＝換網址，天然從第一步重來');

/* ★ 拆解那一步的關卡是「真的做了兩件事」，不是讀秒。
   讀秒等於承認這一步沒東西可判 —— 學生乾等 20 秒再按下一步，什麼也沒發生。
   現在要圈對「哪一段一直重複」，而且要寫下自己的想法。 */
ok(!/countdown\(foot, 20,/.test(html), '★ 拆解那一步不再用讀秒充數');
   /* ⚠️ 2026-08-11 起前進統一走 advance()（它會順便存記錄點）——
      原本七個地方各寫一次 `ready[at]=true; at++; render()`，
      漏掉哪一個都不會有症狀：學生走得過去，只是那一步沒被記下來。 */
   ok(/onDone: \(\) => \{ advance\(\)/.test(lvHtml), '   往下一步由那一步自己決定（走 advance()）');
/* ⚠️ 2026-08-10：「確認理解」併回問題分析，改成一題一題走。
   ★ 這裡要釘的是「只能有一顆往下走的按鈕」——
     原本 renderAnalysis 自己畫一顆、關卡頁又補一顆，
     畫面上同時出現「想清楚了，開始動手」和「分析完了，往下走」。 */
ok(!/only:/.test(lvHtml), '★ 不再把分析切成兩頁（只傳 unit，不傳 only）');
ok(!/nextBtn\('分析完了/.test(lvHtml),
   '★ 分析那一步不補按鈕 —— 兩顆功能一樣的按鈕，學生只會想「這兩個有什麼不同」');
   ok(/window\.saveNote/.test(lvHtml), '   寫的內容會存起來');
   ok(/DERIVE\.mount\(body, lv\.derive/.test(lvHtml), '推導做完就往下，不必再等');

/* 每一關的拆解裡，那個「值得動手圈」的題目要真的有 */
['4-2-1', '4-2-2'].forEach(id => {
  const a = W.BLOCK_LEVELS[id].analysis;
  ok(a.qs.filter(q => q.pick).length === 1, id + ' 有一題要動手圈（不是每一問都要作答，那會變問卷）');
  ok(!!a.write, id + ' 有「先寫再對照」');
  const pk = a.qs.find(q => q.pick).pick;
  ok(pk.answer && pk.answer.length >= 1, id + ' 的圈選題有標準答案');
  ok(!!pk.tooMany && !!pk.tooFew, id + ' 多選、少選要給不同的話 —— 講反了會把學生推向反方向');
  ok(!/答案|正確/.test(pk.prompt), id + ' 題目本身不暗示答案');
  ok(a.write.min >= 10, id + ' 寫作有字數下限（一個字就過等於沒有）');
  ok(a.write.sample.length > 40, id + ' 課本的說法要夠具體，不然對照不出東西');
});

/* ★ 學生寫的字會存進 Firestore，一定要有長度上限 */
ok(/slice\(0, 500\)/.test(html), '★ 存的字數有上限（不能讓人往資料庫塞小說）');
ok(/想法沒存成功（不影響闖關）/.test(html), '存失敗不擋人');

/* 完成紀錄 */
ok(/modules: \{ scratch: \{ pre: \{ \[unitId\]: true \} \} \}/.test(html),
   '完成紀錄寫進 modules.scratch.pre');
ok(/\{ merge: true \}/.test(html), '用 merge 寫，不會蓋掉星數');
ok(/catch \(e\) \{[\s\S]{0,200}不影響上傳/.test(html),
   '★ 存檔失敗不能擋人 —— 那只是「省得下次重做」，不是成績');
   ok(/canGo\(i\)/.test(lvHtml), '做完之後還能點回去重看');

/* 這一頁載入了模擬器需要的東西 */
['../shared/blocks.js', '../shared/derive.js', 'content/blocks.js'].forEach(f => {
  ok(html.indexOf('src="' + f + '"') > -1, '有載入 ' + f);
});

/* 重複定義的函式（同一個 renderTotal 貼了兩次）要清掉 */
ok((html.match(/function renderTotal/g) || []).length === 1, 'renderTotal 只定義一次');

console.log('通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
