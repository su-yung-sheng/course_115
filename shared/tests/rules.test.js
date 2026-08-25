/* 安全規則本身：發布得上去嗎？該擋的有掛上去嗎？
   跑法：node shared/tests/rules.test.js

   ★ 為什麼會有這一份 —— 2026-08-11 的教訓
     2026-08-06 那次改版，allow 條件加了 `bonusEmpty()` 與 `bonusUnchanged()`，
     但**函式本體從頭到尾沒有寫**。

     Firestore 的規則有未定義的函式時，會在「發布」那一步整份編譯失敗。
     也就是說：那天之後這份規則一次都沒有真的上線過，
     線上跑的還是 08-06 以前的舊版（沒有 isTestAccount）。

     學生端看到的只有一行 `permission-denied`，
     頁面上寫的是「可能是網路問題」—— 完全指向錯的方向。
     從那個訊息回推到「規則檔有語法錯誤」，中間隔了五天。

   ★ 這一份**不會**驗證規則的語意（誰擋得住誰）——
     那要 Firebase 模擬器，而電腦教室的機器不見得裝得起來。
     它只做兩件很笨但很有效的事：

       ① 呼叫到的函式都要有定義  → 擋掉「根本發布不上去」
       ② 該掛的條件真的掛在該掛的地方 → 擋掉「發布得上去但門是開的」

     笨檢查抓不到的洞，靠的是發布時 Console 會不會噴紅字；
     而這一份的價值就是**讓你在發布之前就知道會噴**。 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'firestore.rules'), 'utf8');
/** 去掉註解 —— 註解裡常常寫著「已刪除的函式名稱」，會造成假警報 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/* ── ① 發布得上去嗎 ───────────────────────────── */
section('★ 發布得上去嗎（未定義的函式 = 整份編譯失敗）');

const defs = new Set();
const calls = new Set();
let m;
const DEF_RE = /function\s+(\w+)\s*\(/g;
while ((m = DEF_RE.exec(CODE))) defs.add(m[1]);
/* 前面不是 `.` 也不是字母的 `名稱(` 才算「呼叫自己寫的函式」——
   `x.get(...)`、`x.size()` 這些是內建方法，不必有定義。 */
const CALL_RE = /(^|[^.\w])(\w+)\s*\(/gm;
while ((m = CALL_RE.exec(CODE))) calls.add(m[2]);

/* Firestore 規則本身就有的全域函式。這份規則目前一個都沒用到，
   但寫在這裡，之後有人用了 exists() 才不會被誤判成「沒定義」。 */
const BUILTIN = new Set([
  'get', 'getAfter', 'exists', 'existsAfter', 'debug',
  'float', 'int', 'string', 'bool', 'path', 'timestamp', 'duration',
  'math', 'hashing', 'latlng'
]);

const missing = [...calls].filter(n => !defs.has(n) && !BUILTIN.has(n));
ok(missing.length === 0,
   '★ 每一個呼叫到的函式都有定義' +
   (missing.length ? '　←　找不到：' + missing.join('、') : ''));

const unused = [...defs].filter(n => {
  /* 定義那一行本身也會被算成一次「呼叫」，所以要出現兩次以上才算真的有人用 */
  const n2 = (CODE.match(new RegExp('(^|[^.\\w])' + n + '\\s*\\(', 'gm')) || []).length;
  return n2 < 2;
});
ok(unused.length === 0,
   '沒有寫了卻沒人用的函式' +
   (unused.length ? '　←　' + unused.join('、') +
    '（不是錯，但通常表示「改了呼叫端忘了刪」或「寫了忘了掛上去」）' : ''));

/* 括號沒收好也是發布失敗，而且錯誤訊息只會指到最後一行 */
const bal = s => {
  let n = 0;
  for (const c of s) { if (c === '{') n++; else if (c === '}') n--; if (n < 0) return false; }
  return n === 0;
};
ok(bal(CODE), '大括號收得起來');
ok(/^rules_version = '2';/m.test(SRC), "開頭有 rules_version = '2'");

/* ── ② 門真的關著嗎 ─────────────────────────── */
section('★ 該擋的有掛上去嗎');

/** 把某個 match 區塊整段切出來。
    ⚠️ `match /11501-progress/{sid} {` 的第一個 `{` 是萬用字元 `{sid}`，
       不是區塊的開頭 —— 直接數大括號會在 `{sid}` 那裡就以為收完了，
       切出來的區塊只有半行，底下每一條檢查都會變紅字（而規則其實是對的）。
       所以先把 `{名稱}` 換成不含大括號的樣子再數。 */
const FLAT = CODE.replace(/\{(\w+)\}/g, '«$1»');
function block(name) {
  const i = FLAT.indexOf('match /' + name + '/');
  if (i < 0) return '';
  let n = 0;
  for (let k = FLAT.indexOf('{', i); k < FLAT.length; k++) {
    if (FLAT[k] === '{') n++;
    else if (FLAT[k] === '}' && --n === 0) return FLAT.slice(i, k + 1);
  }
  return FLAT.slice(i);
}

['11501-progress', '11502-progress'].forEach(col => {
  const b = block(col);
  ok(!!b, col + ' 有自己的規則區塊');

  /* 加分星（老師審核給的）學生一定要寫不動。
     這是唯一「學生有權寫這份文件，但不可以寫這幾格」的欄位 ——
     沒掛上去的話按 F12 就能自己發十顆「老師確認過」的星。 */
  ok(/allow create:[\s\S]*?bonusEmpty\(\)/.test(b),
     '   ★ ' + col + ' 的 create 有 bonusEmpty()（建立時不可以夾帶加分）');
  ok(/allow update:[\s\S]*?bonusUnchanged\(\)/.test(b),
     '   ★ ' + col + ' 的 update 有 bonusUnchanged()（學生不可以動加分那兩格）');

  /* 整批下載全班成績、刪別人的成績 —— 只有老師 */
  ok(/allow list: if isTeacher\(\)/.test(b), '   ' + col + ' 的 list 只給老師');
  ok(/allow delete: if isTeacher\(\)/.test(b), '   ' + col + ' 的 delete 只給老師');

  /* 學期鎖 */
  const lock = col === '11501-progress' ? 'beforeSpring' : 'afterSpring';
  ok(new RegExp(lock + '\\(\\) \\|\\| isTestAccount\\(sid\\)').test(b),
     '   ' + col + ' 的學期鎖是 ' + lock + '()，測試帳號可以繞過');
  ok(/isOwner\(sid\)/.test(b), '   ' + col + ' 只有本人寫得動（isOwner）');

  /* ★ 名冊＝寫入條件（2026-08-19）
     老師問「禁止不在名單內的使用者登入是無法實現？」——
     前端擋不住：學號存在 sessionStorage，按 F12 塞一個就進得去，
     guard.js 只驗格式。isOwner() 也只問「email 對不對得上學號」，
     所以任何一個學校 Google 帳號都寫得動自己那份進度。
     這一條才是真的擋住的地方。 */
  ok(/allow create:[\s\S]*?inRoster\(sid\)/.test(b),
     '   ★ ' + col + ' 的 create 要 inRoster(sid)（不在名冊就建不了進度）');
  ok(/allow update:[\s\S]*?inRoster\(sid\)/.test(b),
     '   ★ ' + col + ' 的 update 也要 inRoster(sid)');
});

/* inRoster 指到的集合。
   ⚠️ 這裡打錯字不會有錯誤訊息：規則照樣發布得上去，
      只是 exists() 永遠是 false —— **全班都寫不進去**。
   ★ 名冊是跨學期共用的 /roster（2026-07-29 合併）。
      11501-roster / 11502-roster 是等著刪的舊集合，指過去等於全班卡住。
   ⚠️ 只切函式本體來比對，不要對整份原始碼下判斷 ——
      這份規則的註解裡就寫著那兩個舊集合名，
      對整份檔案做「不可以出現 X」會被註解自己蓋掉（這個專案已經中過四次）。 */
{
  const m = CODE.match(/function inRoster\(sid\) \{([\s\S]*?)\}/);
  ok(!!m, 'inRoster() 有函式本體（沒定義的話整份規則發布會編譯失敗）');
  const body = (m && m[1]) || '';
  ok(/exists\(/.test(body), '   用 exists() 判斷（不是 get().data）');
  ok(/documents\/roster\/\$\(sid\)/.test(body),
     '★ 指向跨學期共用的 /roster/{學號}');
  ok(!/1150\d-roster/.test(body),
     '★ 不可以指到 11501-roster／11502-roster —— 那是舊集合，指過去全班寫不進去');
}

/* imgUnits / vidUnits 的欄位名稱必須和 shared/grading.js 對得上。
   ⚠️ 這裡打錯字不會有任何錯誤訊息：規則照樣發布得上去，
      只是它守著一個不存在的欄位，真正的那格門開著。 */
section('加分欄位的名字要和程式對得上');
{
  const g = fs.readFileSync(path.join(__dirname, '..', 'grading.js'), 'utf8');
  ['imgUnits', 'vidUnits'].forEach(f => {
    ok(CODE.indexOf("'" + f + "'") >= 0, "規則裡守著 '" + f + "'");
    ok(g.indexOf(f) >= 0, '   grading.js 也是用這個名字');
  });
  ok(/get\('modules', \{\}\)\.get\('flowchart', \{\}\)/.test(CODE),
     'imgUnits 掛在 modules.flowchart 底下');
  ok(/get\('modules', \{\}\)\.get\('scratch', \{\}\)/.test(CODE),
     'vidUnits 掛在 modules.scratch 底下');
  /* ★ 一定要用 get(欄位, 預設值) 串起來讀。
     直接寫 request.resource.data.modules.flowchart.imgUnits 的話，
     學生第一次建立文件（整棵 modules 都還不存在）會**噴錯**而不是判 false，
     於是連正常的第一筆進度都寫不進去。 */
  ok(!/resource\.data\.modules\./.test(CODE),
     '★ 沒有直接點進 resource.data.modules.…（欄位不存在時那會噴錯，不是判 false）');
}

/* ── ③ 老師的 email ─────────────────────────── */
section('老師身分');
{
  const auth = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
  const dom = (CODE.match(/DOMAIN\(\)\s*\{ return '@([\w.]+)'/) || [])[1];
  ok(!!dom && auth.indexOf(dom) >= 0,
     '★ 規則的網域（' + dom + '）和 auth.js 是同一個 —— 不一樣的話全班都登不進去');
  ok(/TEACHER_EMAIL\(\) \{ return '[\w.]+@/.test(CODE), '老師是 email 白名單，不是靠登入方式');
  ok(!/sign_in_provider/.test(CODE),
     "★ 沒有再靠 sign_in_provider 判老師（師生都是 google.com，那條件等於誰都是老師）");
}

/* ===================================================================
   檔頭的「最後更新」日期
   -------------------------------------------------------------------
   ⚠️⚠️ 這份規則的發布狀態**不在版本控制裡** —— git push 不會帶過去。
      老師唯一能拿來比對「線上跑的是不是最新版」的東西，
      就是檔頭那行日期（Firebase Console 的規則第一段也看得到）。
   ⇒ 那行日期一旦落後，比對起來會誤判成「線上已經是最新的」，
     而這正是 08-06～08-11 那次五天沒上線的同一種安靜失敗。
   ★ 2026-08-25 抓到：08-19 改了三筆，檔頭卻還停在 08-11。
   =================================================================== */
section('★★ 檔頭的「最後更新」不可以落後於內文的日期標記');
{
  const head = SRC.match(/最後更新：(\d{4}-\d{2}-\d{2})/);
  ok(!!head, '★ 檔頭有「最後更新：YYYY-MM-DD」這一行');
  if (head) {
    /* ⚠️ 內文的日期標記要**剝掉檔頭那一行自己**，不然它永遠等於自己。 */
    const body = SRC.replace(head[0], '')
      /* ⚠️⚠️ 我原本在這裡寫「學期界線那個日期不是這個格式，不必排除」——
            測試第一次跑就打臉：`界線：2027-02-01 起為下學期。`
            正是同一個格式，而且是未來的日期，永遠比檔頭新。
         ⇒ 憑印象斷言就是這樣。整行剝掉，只留真正的改版紀錄。
         ★ 將來若再冒出別的未來日期，這條會紅 —— 紅了再處理，
           比放寬成永遠不會紅好。 */
      .split('\n').filter(ln => ln.indexOf('界線') < 0).join('\n');
    const all = (body.match(/\d{4}-\d{2}-\d{2}/g) || []).sort();
    const newest = all[all.length - 1];
    ok(head[1] >= newest,
       '★★ 檔頭 ' + head[1] + ' 不早於內文最新的 ' + newest);
  }
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
