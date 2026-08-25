/* 整套 5016B 的用語一致性
   跑法：node shared/tests/glossary.test.js

   ★ 老師 2026-08-25：「整合一下整套課程的用語與元件，
     不要重複也不要有前後不一的寫法」。

   ⚠️⚠️ 為什麼這值得一支測試
     同一顆零件，第一節叫「超音波感測器」、第五節叫「超音波距離感測器」、
     材料表又寫「距離感測器」—— 大人看得出是同一個，**國中生不會**。
     他會以為那是三種不同的東西，然後在教具箱裡找第三種。
     ★ 這種錯不會報錯、不會壞掉，只會讓學生覺得「我是不是漏學了什麼」。

   ⇒ 這一份釘死一張對照表：每顆零件**一個全名、一個簡稱**，沒有第三種寫法。 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
/* ⚠️ 一律**先剝註解**再檢查 —— 註解裡引用老師的原話（例如
   「暖身活動不是應該在最前面?」）是備課紀錄，不是學生看到的字。
   這個專案已經被自己的註解判紅過八次。 */
const read = f => fs.readFileSync(path.join(root, f), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')      // JS 註解
  .replace(/<!--[\s\S]*?-->/g, '');        // ⚠️ HTML 註解也要剝
                                            //    （備課紀錄就寫在那裡面）

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const PAGE = '11501/5016b.html';
const MODS = fs.readdirSync(path.join(root, 'shared'))
  .filter(f => /^(ultra|door|map|light|pot|fan|rgb|mix|plan|proj)lab\.js$/.test(f))
  .map(f => 'shared/' + f);
const FILES = [PAGE].concat(MODS, ['shared/labkit.js']);
const ALL = FILES.map(f => read(f)).join('\n');

section('★★ 每顆零件只有一個寫法');
{
  /* 全名（材料表、第一次出現用）／簡稱（句子裡用）—— 沒有第三種。 */
  const PARTS = [
    { full: '超音波距離感測器', short: '超音波',
      bad: ['超音波感測器', '超音波模組', '測距感測器', '超聲波'] },
    { full: '可變電阻（旋鈕）', short: '旋鈕',
      bad: ['可變電阻旋鈕', '旋鈕式可變電阻', '電位器', '轉鈕'] },
    { full: 'RGB 全彩燈條', short: '燈條',
      bad: ['燈帶', 'LED 燈條', '彩色燈條'] },
    /* ⚠️ 全名是「直流馬達」，不加「（風扇）」——
       第一節拿它開車庫門和窗簾，那時候它不是風扇。
       ★ 「風扇」是**用途**，第三節之後當簡稱可以，不能當全名。 */
    { full: '直流馬達', short: '馬達',
      bad: ['直流減速馬達', '減速馬達', '電機', '直流馬達（風扇）'] }
  ];
  PARTS.forEach(p => {
    ok(ALL.indexOf(p.full) >= 0, '★ 有全名「' + p.full + '」');
    p.bad.forEach(b => {
      /* ⚠️⚠️ 第一版在這裡「扣掉」全名裡的重疊 —— 但
         「超音波感測器」**不是**「超音波距離感測器」的子字串（中間多了「距離」），
         扣了之後變成負數，於是明明一個都沒有，測試卻一直紅。
         ★ 補償一個不存在的問題，比原本的問題更難查。
         ⇒ 真的會重疊的（例如簡稱包含在全名裡）才需要處理，這裡不需要。 */
      const hits = ALL.split(b).length - 1;
      ok(hits === 0, '★★ 沒有「' + b + '」這種寫法（一律用「' + p.full + '」）');
    });
    /* ⚠️ 簡稱**必須**是全名的一部分 —— 不然學生連不起來
       （「超音波」在「超音波距離感測器」裡面，所以連得起來）。 */
    ok(p.full.indexOf(p.short) >= 0,
       '★ 簡稱「' + p.short + '」看得出是「' + p.full + '」的一部分');
  });
  /* ⚠️「全彩燈條」前面一定要有 RGB —— 半個名字也是第三種寫法。 */
  ok(!/(?<!RGB )全彩燈條/.test(ALL), '★★ 「全彩燈條」前面一定接 RGB');
}

section('★★ 積木名稱只有一套');
{
  ok(ALL.indexOf('類比對應') >= 0, '★ 換算那塊叫「類比對應」');
  /* ⚠️⚠️ 同一塊積木曾經有**三個名字**：積木上印的「類比對應」、
     舊草稿的「數值對應」、教材裡的「映射 (Map)」。
     ★ 學生看著積木找「映射」，找不到就以為自己漏學了。 */
  ['數值對應', '映射', 'Map)', 'GetMap'].forEach(b => {
    ok(ALL.indexOf(b) < 0, '★★ 沒有「' + b + '」這個別名（一律「類比對應」）');
  });
}

section('★★ 三個範圍不可以互相污染');
{
  /* ★ 這門課有三個容易混的範圍，加上馬達那一組共四個。
     ⚠️ 每一個都必須綁著它的用途出現，不可以只寫一個數字。 */
  const page = read(PAGE);
  ok(/1023/.test(page) && /A7 讀到/.test(page), '★ 1023 要綁著「A7 讀到的」');
  ok(/359/.test(page), '★ 359（色環一圈）');
  ok(/−250|-250/.test(page + ALL), '★★ 馬達是 −250 ～ 250（不是百分比）');
  /* ⚠️ 老師 2026-08-25：「風扇轉速 42% 數值應該是 -250 ~ 250」。 */
  ok(!/風扇轉速 ' \+ \w+ \+ '%/.test(ALL) && !/轉速 [0-9]+%/.test(ALL),
     '★★ 轉速不可以用百分比表示（那等於發明第五個範圍）');
}

section('★★ 節次與區塊的叫法一致');
{
  const page = read(PAGE);
  /* 「第一節課」只出現在徽章；內文一律「第一節」。 */
  ok(!/單元[一二三四五]/.test(page), '★★ 內文不用「單元一」，一律「第一節」');
  ok(!/暖身活動/.test(page), '★★ 一律「暖身關卡」，不用「暖身活動」');
  ok(/暖身關卡/.test(page), '   有「暖身關卡」');
  /* ★ 第五節那一塊不叫檢核（老師 2026-08-25：「第五課不用動手檢核」）。 */
  const u5 = page.slice(page.indexOf('title: "自己的專案'),
                        page.indexOf('function openCourseDetail'));
  ok(!/動手檢核/.test(u5), '★★ 第五節沒有「動手檢核」這四個字');
  ok(/成果發表/.test(u5), '   第五節那一塊叫「成果發表」');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
