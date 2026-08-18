/* 教師端的科目與分母，要和學生端對得起來
   跑法：node shared/tests/gradebook.test.js

   ★ 為什麼有這一份（老師 2026-08-18）
     「11501 教師端是不是有配合學生端調整過單元與星星數了？11502 還沒。」
     查下來：11502 的成績簿停在舊版，列了八個科目，
     其中四個學生端根本不存在（flowchart／logic／search／sort）。

   ⚠️ 這不是「多幾個空欄位」而已 ——
      subjMax 對認不得的鍵會回傳 3，於是分母被灌了十幾顆永遠拿不到的星，
      **學生的百分比再怎麼做都到不了 100%**，而且和 hub 上的數字對不起來。
      ★ 而且症狀很安靜：畫面照樣畫得出來，只是每個人的百分比都偏低。

   ⚠️⚠️ 只改 defaultGradebook 是沒有用的：
      雲端已經存過一份舊設定，程式讀到就直接用，永遠走不到 default 那條路。
      所以一定要有「自動清理」那一段（11501 早就有了，11502 缺）。

   這一份釘四件事
     ① 教師端的科目 = 學生端 hub 真的有星數的模組
     ② 兩邊的**總分母**一樣（教師端的百分比才會等於學生端看到的）
     ③ 分母是**現算**的，不可以寫死（NO_UPLOAD 改了要自己跟上）
     ④ 讀到舊設定時會自動清掉已淘汰的科目 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), l + '（得到 ' + JSON.stringify(a) + '）');
const section = t => console.log('\n── ' + t + ' ──');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const W = {};
new Function('window', read('shared/grading.js'))(W);
const G = W.GRADING;

/** 從教師頁抓出 defaultGradebook 裡的科目鍵 */
function teacherSubjects(html) {
  const i = html.indexOf('function defaultGradebook');
  const j = html.indexOf('customMapping:', i);
  return [...html.slice(i, j).matchAll(/key:\s*'([a-z]+)'/g)].map(m => m[1]);
}
/** 從 hub 抓出「有星數」的模組（maxStars 不是 0 的） */
function hubModules(html) {
  const i = html.indexOf('const MODULES = [');
  const j = html.indexOf('// ===== 狀態呈現對照 =====', i);
  const seg = html.slice(i, j);
  const out = [];
  /* ⚠️ 一行一個模組，逐行看 —— 整段一起抓的話，
     註解裡提到的那些已移除的模組（flowchart／logic／sort…）也會被抓進來。
     ★ 這正是這一份要抓的那種錯，所以自己不能犯。 */
  seg.split('\n').forEach(line => {
    const t = line.trim();
    if (t.indexOf('{ id:') !== 0) return;
    const id = (t.match(/id:\s*'([a-z]+)'/) || [])[1];
    const ms = (t.match(/maxStars:\s*([a-zA-Z0-9()]+)/) || [])[1];
    if (!id) return;
    out.push({ id: id, maxStars: ms, combines: (t.match(/combines:\s*\[([^\]]*)\]/) || [])[1] });
  });
  return out;
}

section('★★ 11502：教師端的科目 = 學生端真的有星的模組');
{
  const t = read('11502/teacher.html');
  const hub = hubModules(read('11502/hub.html'));
  const starred = hub.filter(m => m.maxStars !== '0');
  eq(starred.map(m => m.id), ['ethics', 'thinking', 'scratch'],
     '★ 學生端有星數的模組（Arduino 是延伸體驗，maxStars:0）');
  eq(teacherSubjects(t), ['ethics', 'thinking', 'scratch'],
     '★★ 教師端的科目一模一樣');

  /* ⚠️ 這四個是舊版留下來的，學生端早就沒有了 */
  ['flowchart', 'logic', 'search', 'sort'].forEach(k => {
    ok(teacherSubjects(t).indexOf(k) < 0,
       '★★ 不再列 ' + k + '（學生端沒有這個模組）');
  });
  /* Arduino 不計星 → 不進成績簿（和 11501 一樣） */
  ok(teacherSubjects(t).indexOf('arduino') < 0,
     '★ arduino 也不列（它 maxStars:0，是延伸體驗）');
}

section('★★ 11502：兩邊的總分母要一樣');
{
  const t = read('11502/teacher.html');
  const cfg = {};
  new Function('window', read('11502/config.js'))(cfg);
  const ids = (cfg.CONFIG.UNITS || []).map(u => u[0]);
  const mm = G.moduleMax(ids.length || 10, ids);

  /* 學生端：ethics 30 + thinking 20 + scratch（現算）+ arduino 0 */
  const student = 30 + 20 + mm.scratch;
  ok(student === 82, '學生端 hub 的總分母是 ' + student);

  /* 教師端：MODULE_MAX 三個相加 */
  const seg = t.slice(t.indexOf('const MODULE_MAX'), t.indexOf('function subjMax'));
  ok(/ethics:\s*30/.test(seg) && /thinking:\s*20/.test(seg),
     '★ 教師端的 ethics 30、thinking 20');
  /* ⚠️⚠️ moduleMax() 會**一併回傳 flowchart** ——
     整包 Object.assign 進來的話，分母會多出 30 顆拿不到的星。
     這一學期沒有流程圖模組（2026-08-11 移除）。 */
  ok(!/flowchart/.test(seg),
     '★★ 教師端的分母**沒有** flowchart（整包 assign 會多灌 30 顆）');
  ok(/\.scratch\b/.test(seg),
     '★★ scratch 只取 moduleMax().scratch 那一個欄位');

  /* ③ 分母要現算 —— 不可以寫死 */
  ok(/GRADING\.moduleMax\(/.test(seg), '★★ scratch 的分母是現算的');
  ok(/CONFIG\.UNITS/.test(seg),
     '★★ 而且帶了**關卡代號**進去（第 5、10 關沒有作品要交）');
  /* 真的跑一次：NO_UPLOAD 有兩關，所以是 8 關 × 4 = 32 */
  eq(mm.scratch, 32, '★★ 作品星的分母現算是 32（8 關 × 4，不是 9 關 36 也不是 10 關 40）');
  eq(G.GATE.NO_UPLOAD.length, 2, '　　因為 NO_UPLOAD 有兩關（' +
     G.GATE.NO_UPLOAD.join('、') + '）');
}

section('★★ 讀到舊設定要自動清掉（只改預設值沒有用）');
{
  /* ⚠️⚠️ 雲端已經存過一份八個科目的設定，程式讀到就直接用 ——
     永遠走不到 defaultGradebook 那一條路。
     ★ 所以「改預設值」這件事本身**完全沒有效果**，一定要有清理。 */
  const t = read('11502/teacher.html');
  ok(/VALID_SUBJECTS/.test(t), '★★ 有一份「這學期真的有星的模組」名單');
  const i = t.indexOf('const gbSnap');
  const j = t.indexOf('localStorage.setItem(\'gradeSystemCustomMap\'', i);
  const seg = t.slice(i, j);
  /* ⚠️ 不可以只找 /VALID_SUBJECTS\.includes/ ——
     下面那個清 taskMap 的迴圈也長這樣，把**科目的過濾**整條拿掉，
     這一條照樣綠（突變測試就是這樣漏掉的）。
     ★ 要連「被過濾的是誰」一起比：rawSubjects。 */
  ok(/rawSubjects\.filter\([^)]*VALID_SUBJECTS\.includes/.test(seg),
     '★★ 讀到雲端設定之後，**科目清單本身**會被那份名單過濾');
  ok(/taskMap[\s\S]{0,120}VALID_SUBJECTS\.includes/.test(seg),
     '★ 分類對照表（taskMap）也一起清');
  ok(/11502-config/.test(seg) && /\.set\(/.test(seg),
     '★★ 而且把清乾淨的結果寫回去（不然每次進來都要再清一次）');
  /* ⚠️ 清的是「顯示的科目」，不是學生的星數 —— 舊資料要留著 */
  ok(!/delete .*progress|\.delete\(\)/.test(seg),
     '★★ 只清科目清單，**不刪**學生已經有的星數');

  /* 名單只有一份 —— 兩份會慢慢長得不一樣 */
  const decl = (t.match(/const VALID_SUBJECTS = \[([^\]]*)\]/) || [])[1] || '';
  eq(decl.match(/'[a-z]+'/g), ["'ethics'", "'thinking'", "'scratch'"],
     '★ 名單的內容');
  ok((t.match(/VALID_SUBJECTS\s*=/g) || []).length === 1,
     '★★ 而且只宣告一次（兩份會慢慢長得不一樣）');
}

section('★ 11501 本來就對得起來（別在修 11502 的時候弄壞它）');
{
  const t = read('11501/teacher.html');
  const hub = hubModules(read('11501/hub.html'));
  const starred = hub.filter(m => m.maxStars !== '0');
  /* 11501 的程式設計那張卡把 flowchart 和 scratch 併成一張（listprog 70★）——
     所以科目清單和 hub 的卡片**不是一對一**，比的要是「總分母」。 */
  const mm = G.moduleMax(10);
  const student = starred.reduce(function (a, m) {
    return a + (m.maxStars === 'scratchMax()' ? mm.scratch : Number(m.maxStars) || 0);
  }, 0);
  const teacher = 30 + 20 + mm.flowchart + mm.scratch;
  eq(student, teacher, '★★ 11501 兩邊的總分母一樣（學生端 ' + student +
     '／教師端 ' + teacher + '）');
  eq(teacherSubjects(t), ['ethics', 'thinking', 'flowchart', 'scratch'],
     '★ 而且四個科目都在（11501 有流程圖模組）');
  ok(/VALID/.test(t), '★ 11501 也有自動清理（11502 是照它抄的）');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
