/* 🌟 晨星勇者：整合進 11501 程式設計（完成十關後開放）
   跑法：node shared/tests/morningstar.test.js

   ★ 老師 2026-10-09 的決定
     ‧ 開放條件：10 關都通關（和依序開放同一套；老師手動開放的不算）
     ‧ 存在學生自己的 {學期}-progress/{學號}.games.morningstar（不在 modules ⇒ 不算星）
     ‧ 只用雲端（不留 localStorage 備援）；不算星、教師端不顯示
   ★ 也守「刻意的設計，不要改回去」那幾條（老師交代）——
     整合時最容易被順手「修好」的就是它們。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const noComments = t => String(t).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/^\s*\/\/[^\n]*$/gm, ' ');

const w = {};
new Function('window', read('shared/grading.js'))(w);
new Function('window', read('11501/content/flowchart.js'))(w);
new Function('window', read('shared/gamesave.js'))(w);
const GS = w.GAMESAVE, GATE = w.GRADING.GATE, UNITS = w.FLOW_UNITS;
const PAGE = read('11501/morningstar.html');
const CODE = noComments(PAGE);

section('① 開放條件：10 關都通關');
{
  const ids = UNITS.map(u => u.id);
  const all = {}, stars = {};
  ids.forEach(id => { all[id] = true; stars[id] = 2; });
  ok(UNITS.length === 10, '十個單元');
  ok(GS.unlocked(UNITS, all, stars, GATE, false).ok === true, '★★ 十關流程圖都排對、作品都 ≥ 2⭐ ⇒ 開放');
  const s9 = Object.assign({}, stars, { [ids[9]]: 1 });
  const r9 = GS.unlocked(UNITS, all, s9, GATE, false);
  ok(r9.ok === false && r9.done === 9 && r9.total === 10, '★★ 第 10 關只有 1⭐ ⇒ 還沒開放（9 / 10）');
  const f9 = Object.assign({}, all); delete f9[ids[3]];
  ok(GS.unlocked(UNITS, f9, stars, GATE, false).ok === false, '★ 有一關流程圖沒排 ⇒ 還沒開放');
  ok(GS.unlocked(UNITS, {}, {}, GATE, false).done === 0, '一關都沒過 ⇒ 0 / 10');
  ok(GS.unlocked(UNITS, {}, {}, GATE, true).ok === true, '★ 備課模式（OPEN_ALL）⇒ 開放，老師可以試玩');
  ok(GS.unlocked([], {}, {}, GATE, false).ok === false, '沒有單元資料 ⇒ 不開放（不可以 0 = 0 就放行）');
  /* ⚠️ 老師手動開放的關卡是「通行證、不是成就」—— 第五個參數一定要是 null。 */
  ok(/GATE\.cleared\(units\[i\]\.id, flowDone \|\| \{\}, unitStars \|\| \{\}, null, null\)/.test(read('shared/gamesave.js')),
     '★★★ 老師手動開放（unlocks）不算通關');
}

section('② 存檔資料的整理');
{
  const b = GS.blank();
  ok(b.trained === false && b.save === null && Object.keys(b.cards).length === 0 && b.clears.length === 0, '空白存檔');
  const n = GS.normalize({ trained: 'yes', save: { v: 1 }, cards: { add: 1, hack: 1, sync: 1 }, clears: 'x', clearCount: 'abc' });
  ok(n.trained === false, '★ trained 只認 true（字串不算）');
  ok(n.save === null, '★ 不是 v2 的存檔不讀（原作 readSave 也是這樣）');
  ok(n.cards.add === 1 && n.cards.sync === 1 && !n.cards.hack, '★ 觀念卡只收那 14 張');
  ok(Array.isArray(n.clears) && n.clearCount === 0, '壞掉的欄位補成預設值');
  ok(GS.CARD_KEYS.length === 14, '觀念卡共 14 張');
  const r = GS.blank();
  ok(GS.addCards(r, { add: 1, del: 1 }) === true && GS.addCards(r, { add: 1 }) === false, '★ 收藏只增不減，沒有新卡就回 false（不白寫）');
  for (let i = 0; i < 25; i++) GS.addClear(r, { time: 600.4 + i, lv: 5, kills: 80, deaths: 2, gold: 40, maxHp: 22, cards: { add: 1, ins: 1 } }, 1000 + i);
  ok(r.clears.length === 20 && r.clearCount === 25, '★ 通關紀錄留最近 20 筆，總次數另外記');
  const last = r.clears[19];
  ok(last.time === 624 && last.lv === 5 && last.kills === 80 && last.deaths === 2 && last.cards === 2 && last.at === 1024,
     '★★ 通關紀錄：時間（秒，四捨五入）、等級、打倒數、倒下次數、觀念卡數');
}

section('③ 雲端存檔：延遲寫入、失敗要講、讀不到不可以寫');
(async () => {
  const timers = [];
  const fakeTimer = { set: (f) => { timers.push(f); return timers.length; }, clear: (h) => { timers[h - 1] = null; } };
  const runTimers = async () => { const fs_ = timers.splice(0); for (const f of fs_) if (f) f(); await new Promise(r => setTimeout(r, 0)); };
  const writes = [], states = [];
  let failNext = false;
  const st = GS.createStore({
    load: async () => ({ trained: true, save: { v: 2, area: 2 }, cards: { add: 1 } }),
    write: async rec => { if (failNext) { failNext = false; throw { code: 'unavailable' }; } writes.push(rec); },
    onState: (s, why) => states.push([s, why]),
    timer: fakeTimer
  });
  ok(st.update(r => { r.trained = false; }) === false, '★★★ 還沒讀到雲端就不可以寫（不然會用空白存檔蓋掉雲端那份）');
  await st.load();
  ok(st.get().trained === true && st.get().save.area === 2, '讀回來的存檔');
  st.update(r => { r.save = { v: 2, area: 3 }; });
  st.update(r => { GS.addCards(r, { ins: 1 }); });
  ok(writes.length === 0, '改動先不寫');
  await runTimers();
  ok(writes.length === 1 && writes[0].save.area === 3 && writes[0].cards.ins === 1 && writes[0].updatedAt > 0,
     '★★ 一小段時間內的多次改動只寫一次，而且是整份');
  failNext = true;
  st.update(r => { r.trained = true; });
  await runTimers();
  ok(states.some(([s, why]) => s === 'error' && /unavailable/.test(why)), '★★★ 寫不進去要回報 error（不可以安靜失敗）');
  st.update(r => { r.clearCount = 1; });
  await runTimers();
  ok(writes.length === 2 && writes[1].clearCount === 1, '★ 下一次改動時再寫一次（上一次失敗的內容也一起帶上）');
  st.update(r => { r.save = null; });
  await st.flush();
  ok(writes.length === 3 && writes[2].save === null, '★ flush() 不等延遲，馬上寫（通關、關分頁時用）');

  const st2 = GS.createStore({ load: async () => { throw { code: 'permission-denied' }; }, write: async () => { writes.push('x'); }, timer: fakeTimer,
                               onState: (s, why) => states.push([s, why]) });
  let threw = false;
  try { await st2.load(); } catch (e) { threw = true; }
  ok(threw && !st2.isLoaded() && st2.update(() => {}) === false, '★★ 雲端讀不到 ⇒ 不開始、也不寫');

  section('④ 遊戲頁：存檔改走雲端');
  ok(/<script src="\.\.\/shared\/guard\.js"><\/script>/.test(PAGE) && /<script src="\.\.\/shared\/auth\.js"><\/script>/.test(PAGE),
     '★★ 要先從闖關基地登入（guard.js），沿用登入身分（auth.js）');
  ['config.js', '../shared/grading.js', 'content/flowchart.js', '../shared/gamesave.js'].forEach(f =>
    ok(PAGE.indexOf('<script src="' + f + '"></script>') > 0 && PAGE.indexOf('<script src="' + f + '"></script>') < PAGE.indexOf('const HINT_KEY'),
       '　載入 ' + f + '（在遊戲程式之前）'));
  const ls = CODE.match(/localStorage\.[a-zA-Z]+\(([^)]*)\)/g) || [];
  ok(ls.length === 2 && ls.every(x => /HINT_KEY/.test(x)), '★★★ localStorage 只剩「觀念提示開關」（只用雲端，老師的決定）　←　' + ls.join(' ｜ '));
  ok(!/SAVE_KEY|TRAINED_KEY/.test(CODE), '★★ 原本的 localStorage 存檔鍵都拿掉了');
  ok(!/window\.__game\s*=/.test(CODE) && !/claude\?\.hot/.test(CODE), '★ 測試掛鉤 window.__game、編輯器熱重載都拿掉了');
  ok(/mergeFields:\s*\['studentId', 'games\.morningstar'\]/.test(CODE), '★★★ 寫入用 mergeFields 整欄覆寫 games.morningstar');
  ok(/games:\s*\{\s*morningstar:\s*rec\s*\}/.test(CODE) && !/modules:\s*\{\s*morningstar/.test(CODE),
     '★★★ 寫在 games 底下、不是 modules（不算星）');
  ok(/function isTrained\(\) \{ return !!\(STORE && STORE\.get\(\)\.trained\); \}/.test(CODE), '★★ 新手訓練完成：讀雲端');
  ok(/if \(G\.idx === 0\) setTrained\(\);/.test(CODE), '　走出訓練場才記成完成（原作的時機不變）');
  ok(/data-go="skip" \$\{isTrained\(\) \? '' : 'disabled'\}/.test(CODE) && /if \(go === 'skip'\) \{ if \(!isTrained\(\)\) return;/.test(CODE),
     '★★★ 第一次玩不能跳過序章（按鈕灰、硬按也沒用）');
  ok(/function writeSave\(\) \{ if \(STORE\) STORE\.update\(r => \{ r\.save = snapshot\(\);/.test(CODE) && /function loadArea[\s\S]{0,4000}writeSave\(\);/.test(CODE),
     '★★ 每章開頭存一份（snapshot v2 整份）');
  ok(/return \{v:2, area:G\.idx/.test(CODE) && /s && s\.v === 2 \? s : null/.test(CODE), '　存檔格式維持 v2');
  ok(/P\.cards\[key\] = 1;\s*syncCards\(\);/.test(CODE) && /P\.cards\.avg = 1;\s*syncCards\(\);/.test(CODE), '★★ 拿到觀念卡就記進收藏（包括過關結算那張「平均」）');
  ok(/GAMESAVE\.addClear\(r, P\)[\s\S]{0,40}STORE\.flush\(\)/.test(CODE), '★★ 通關：記一筆通關紀錄、馬上寫回');
  ok(/if \(!g\.ok\) showLocked\(g\); else showTitle\(\);/.test(CODE), '★★★ 直接貼網址進來也要擋（遊戲頁自己再查一次十關）');
  ok(/if \(!api \|\| api\.error\) \{ showOffline/.test(CODE) && /e => showOffline/.test(CODE), '★★ 雲端讀不到 ⇒ 講清楚、不開始');
  ok(/cloudState[\s\S]{0,200}toast\('⚠️ 存檔沒有存進雲端/.test(CODE), '★★ 遊戲中寫不進去 ⇒ 跳提示');
  ok(/href="flowchart\.html"/.test(CODE), '標題畫面有回程式設計的出口');
  ok(/addEventListener\('pagehide', \(\) => \{ if \(STORE\) STORE\.flush\(\); \}\)/.test(CODE), '關分頁前把存檔送出去');

  section('⑤ 刻意的設計，不要改回去（老師交代）');
  ok(/function bagDel\(i, quiet\) \{ P\.bag\.splice\(i, 1\); P\.bag\.push\(null\);/.test(CODE), '★★ 背包是真正的清單：刪除後面往前補');
  ok(/data-a="ins">插到第 1 格/.test(CODE) && /P\.bag\.splice\(sel\.i, 1\)\[0\]; P\.bag\.unshift\(id\)/.test(CODE), '★★ 「插到第 1 格」＝插入');
  ok(/const lost = Math\.ceil\(P\.gold \/ 2\); P\.gold -= lost;/.test(CODE) && /function dropGear\(\)/.test(CODE) && /lost:true/.test(CODE),
     '★★ 倒下：金幣少一半撿不回來、三件裝備掉在原地可撿回');
  ok(/const lost = G\.items\.filter\(i => i\.lost\);\s*if \(lost\.length\) \{ openExitAsk\(lost\); return; \}/.test(CODE), '★★ 裝備沒撿就走向出口 ⇒ 先確認');
  ok(/const needXp = lv => 6 \+ 4 \* lv;/.test(CODE) && /const xpRate = lv => 3 \/ \(lv \+ 2\);/.test(CODE), '★★ 升級經驗一級比一級多、打怪經驗倍率 3/(Lv+2)');
  const ccode = CODE.slice(CODE.indexOf('const CARDS = {'), CODE.indexOf('const CARD_ORDER'));
  const units = (ccode.match(/\{u:(\d+),/g) || []).map(x => +x.match(/\d+/)[0]);
  ok(units.length === 14, '★ 觀念卡 14 張（' + units.length + '）');
  ok(!units.includes(3) && !units.includes(6), '★★ 單元 3 演奏小星星、單元 6 撲克發牌刻意沒做');
  ok(JSON.stringify((ccode.match(/^  ([a-z]+):\{u:/gm) || []).map(x => x.trim().split(':')[0])) === JSON.stringify(GS.CARD_KEYS),
     '★ 遊戲的 CARD_ORDER 和存檔認得的 14 張一致');
  /* 用語照 content/flowchart.js 的單元名稱 —— 內容檔改了，遊戲也要跟著改。 */
  const um = CODE.match(/const UNITS = \[([\s\S]*?)\];/);
  const gameUnits = um ? (um[1].match(/\[(\d+), '([^']+)', '([^']+)'\]/g) || []).map(x => x.match(/\[(\d+), '([^']+)', '([^']+)'\]/).slice(1)) : [];
  ok(gameUnits.length === 10 && gameUnits.every(([n, t, s], i) => +n === UNITS[i].no && t === UNITS[i].title && s === UNITS[i].subtitle),
     '★★ 觀念卡的單元名稱、主題和 content/flowchart.js 一字不差');
  ok(['添加', '插入', '替換', '刪除'].every(t => new RegExp("n:'" + t + "'").test(ccode)), '★ 清單積木用語照 whatislist.html（添加／插入／替換／刪除）');

  section('⑥ 程式設計頁的入口');
  const FC = read('11501/flowchart.html');
  ok(/<script src="\.\.\/shared\/gamesave\.js"><\/script>/.test(FC), '程式設計頁載入 gamesave.js');
  ok(/G\.unlocked\(UNITS, state\.done, state\.progStars, GATE, OPEN_ALL\)/.test(FC), '★★ 入口和遊戲頁用同一支判斷');
  ok(/\$\{morningstarCard\(\)\}/.test(FC) && /href="morningstar\.html"/.test(FC), '★ 關卡列表最下面放入口');
  ok(/🔒[\s\S]{0,400}晨星勇者[\s\S]{0,300}\$\{g\.done\} \/ \$\{g\.total\}/.test(FC), '★ 還沒開放時顯示「目前 n / 10 關」');

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
