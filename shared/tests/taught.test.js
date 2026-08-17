/* 「有沒有教過就考」：概念檢測問的東西，前面必須出現過
   跑法：node shared/tests/taught.test.js

   ★ 為什麼會有這一份
     2026-08-17 老師試跑第 4 關時發現：
       概念檢測問「產生蟲被寫成副程式，為什麼？」「當分身產生和當綠旗被點擊差在哪？」
       —— 但**前面完全沒有說明過分身**。
     查下來：「分身」在前三關出現 0 次（前三關都在畫正方形），
     而唯一解釋它的 build 掛在**拼圖**那一步，也就是概念檢測**之後**。
     學生被問到的時候，畫面上從來沒有任何地方講過本尊和分身是兩回事。

   ⚠️ 這種錯不會被任何既有測試抓到：
      題目寫得很好、判定規則正確、關卡也走得完。
      壞掉的只有「他有沒有機會學過」——
      而那正是一份教材最不該壞掉的地方。

   ★ 這份測試的作法
     對每一關，把「概念檢測之前學生看得到的所有文字」湊成一份講義，
     再檢查題目裡的關鍵名詞有沒有在講義裡出現過。
     ⚠️ 講義**不含** build（那是拼圖那一步的文字，在檢測之後才出現）。

   ⚠️⚠️ 這是一道**地板**，不是保證。
      它測的是「這個詞出現過沒」，不是「教得夠不夠」——
      task 裡順帶提一句「產生十隻分身」也會算過。
      （實測：把第 4 關的推導拿掉，「本尊」抓得到，「分身」抓不到，
        因為 task 那句剛好提過。）
      ⇒ 它擋得住「完全沒提過就考」這種硬傷，
        擋不住「提過一句就考」。後者只能靠人看。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

global.window = {};
(0, eval)(fs.readFileSync(path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8'));
const L = global.window.BLOCK_LEVELS;
const ORDER = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-1-1',
               '6-2-1', '6-2-2', '6-3-1', '6-3-2', '6-3-3'];

/** 純文字（去標籤） */
const flat = o => JSON.stringify(o == null ? '' : o).replace(/<[^>]+>/g, '');

/**
 * 這一關走到「概念檢測」為止，學生看得到的所有文字。
 * ⚠️ 刻意**不含** build 與 tips：
 *      build 是拼圖那一步的說明（在概念檢測之後）
 *      tips  是給老師看的，直接寫著答案
 *    把它們算進來的話，這份測試就永遠是綠的 —— 而洞還在。
 */
function taughtText(id) {
  const v = L[id];
  return [flat(v.scene), flat(v.task), flat(v.analysis), flat(v.derive), flat(v.lab)].join(' ');
}

/** 前面所有關卡（含這一關之前）教過的東西 —— 觀念是可以跨關累積的 */
function taughtSoFar(id) {
  const i = ORDER.indexOf(id);
  return ORDER.slice(0, i + 1).map(k =>
    k === id ? taughtText(k) : [taughtText(k), flat(L[k].build)].join(' ')
  ).join(' ');
}

section('★★ 第 4 關：分身（這次抓到的那個洞）');
{
  const v = L['4-3-1'];
  ok(!!v.derive, '★★ 第 4 關現在有推導了（原本只有 情境 → 實驗室 → 檢測）');
  /* ⚠️ 這裡不可以直接讀 v.derive.steps ——
     推導被拿掉的時候整份測試會**當掉**，而不是紅燈。
     當掉的話後面那幾條診斷（到底哪個名詞沒教）就印不出來，
     而那幾條才是真正要給人看的東西。 */
  ok(((v.derive || {}).steps || []).some(s => s.kind === 'clone'),
     '★ 而且有一步是 clone（本尊與分身的互動）');

  const before = taughtText('4-3-1');
  ok(/分身/.test(before), '★★ 「分身」在概念檢測之前就講到了');
  ok(/本尊/.test(before), '★★ 「本尊」也講到了');
  ok(/當分身產生/.test(before),
     '★★ 連「當分身產生」這塊帽子積木的名字都出現過 —— 題 6 問的就是它');
  ok(/隱藏/.test(before) && /顯示/.test(before),
     '★★ 隱藏／顯示都講過 —— 題 5 問的就是這兩塊為什麼不打架');

  /* 前三關真的沒有分身 —— 記錄這個事實，免得日後有人以為是我多慮 */
  const pre3 = ['4-2-1', '4-2-2', '4-2-3']
    .map(k => flat(L[k])).join(' ');
  ok(!/分身/.test(pre3),
     '★ （對照）前三關確實一次都沒提過分身 —— 所以第 4 關非講不可');
  ok(/副程式/.test(pre3),
     '★ （對照）副程式在前三關講過 —— 題 4 本來就有底，只要接回去');
  ok(/第 1、2 關/.test(flat(v.scene)),
     '★ 而情境現在真的把副程式**接回**第 1、2 關（原本只有孤零零一句）');
}

section('★★ 全部十關：檢測問的名詞，前面要出現過');
{
  /* 這些是「不講就一定不會」的專有名詞。
     ⚠️ 只放**名詞**，不放「重複」「如果」這種日常字 ——
        那些字在任何一句話裡都可能出現，測不出東西。 */
  const TERMS = ['分身', '本尊', '副程式', '變數', '造型', '座標',
                 '未排序', '已排序', '中間', '門檻'];
  let holes = [];
  ORDER.forEach(id => {
    const v = L[id];
    if (!v.quiz) return;
    const asked = flat(v.quiz);
    const taught = taughtSoFar(id);
    TERMS.forEach(t => {
      if (asked.indexOf(t) >= 0 && taught.indexOf(t) < 0) {
        holes.push(id + ' 問了「' + t + '」但沒教過');
      }
    });
  });
  ok(holes.length === 0,
     '★★ 沒有「沒教過就考」的名詞' +
     (holes.length ? '\n       ' + holes.join('\n       ') : ''));
}

section('★ 每一關的檢測都要有對應的教學步驟');
{
  /* ⚠️ 只有情境、沒有分析也沒有推導也沒有實驗室的關卡，
     等於「讀一段故事就考試」。第 4 關原本就是這樣。 */
  const thin = ORDER.filter(id => {
    const v = L[id];
    return v.quiz && !v.analysis && !v.derive && !v.lab;
  });
  ok(thin.length === 0,
     '★★ 沒有關卡是「只有情境就直接考」' +
     (thin.length ? '（' + thin.join('、') + '）' : ''));

  ORDER.forEach(id => {
    const v = L[id];
    const n = ['analysis', 'derive', 'lab'].filter(k => v[k]).length;
    ok(n >= 1, '   ' + id + ' 有 ' + n + ' 個教學步驟（分析／推導／實驗室）');
  });
}

section('★ build 不可以是唯一講到某個東西的地方');
{
  /* ★ 這一條就是這次那個洞的**形狀**：
     build 是拼圖那一步的文字，出現在概念檢測**之後**。
     一個名詞如果只在 build 出現，那學生答題的時候一定沒看過。 */
  const holes = [];
  ORDER.forEach(id => {
    const v = L[id];
    if (!v.build || !v.quiz) return;
    const inBuild = flat(v.build);
    const before = taughtSoFar(id);
    ['分身', '本尊', '副程式', '變數'].forEach(t => {
      if (inBuild.indexOf(t) >= 0 && flat(v.quiz).indexOf(t) >= 0 &&
          before.indexOf(t) < 0) {
        holes.push(id + '：「' + t + '」只有 build 講到，但檢測有考');
      }
    });
  });
  ok(holes.length === 0,
     '★★ 沒有「只有 build 講、檢測卻考」的東西' +
     (holes.length ? '\n       ' + holes.join('\n       ') : ''));
}

section('★ 推導的每一步都要能通（欄位齊全）');
{
  /* ⚠️ kind 打錯字的話，那一步會畫成一片空白 —— 而且不會報錯。 */
  const KINDS = ['ask', 'draw', 'formula', 'sort', 'clone'];
  ORDER.forEach(id => {
    const d = L[id] && L[id].derive;
    if (!d) return;
    (d.steps || []).forEach((s, i) => {
      ok(KINDS.indexOf(s.kind) >= 0,
         '   ' + id + ' 第 ' + (i + 1) + ' 步的 kind「' + s.kind + '」是引擎認得的');
      ok(!!s.q, '   ' + id + ' 第 ' + (i + 1) + ' 步有題目');
      if (s.kind === 'ask') {
        ok(typeof s.answer === 'number',
           '   ' + id + ' 第 ' + (i + 1) + ' 步（ask）有數字答案');
        ok(!!s.miss,
           '★ ' + id + ' 第 ' + (i + 1) + ' 步（ask）答錯有話講 —— 不然只會顯示「再想一下」');
      }
      if (s.kind === 'clone') {
        ok(s.n > 0, '   ' + id + ' 第 ' + (i + 1) + ' 步（clone）有指定產生幾隻');
        ok(!!s.ask, '   ' + id + ' 第 ' + (i + 1) + ' 步（clone）有預測題');
      }
    });
  });
  /* 引擎那邊也要真的認得 clone */
  const eng = fs.readFileSync(path.join(ROOT, 'shared', 'derive.js'), 'utf8');
  ok(/st\.kind === 'clone'/.test(eng), '★★ derive.js 真的處理 clone（不然畫面一片空白）');
  ok(/function wireClone/.test(eng), '   而且有接事件的那一支');
  ok(/\.dv-stage\{/.test(eng), '★ 樣式也有（少了的話畫面會散開，但不會報錯）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
