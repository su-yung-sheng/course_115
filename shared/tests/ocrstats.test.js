/* 截圖辨識效能：教師端狀態檢查與 Colab 統計格必須說同一套話
   跑法：node shared/tests/ocrstats.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const NB = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'));
const cells = NB.cells.map(c => (c.source || []).join(''));
const NBCODE = cells.join('\n').split('\n')
  .filter(l => !l.trim().startsWith('#')).join('\n');
const ST = fs.readFileSync(path.join(ROOT, 'shared', 'status.html'), 'utf8');
const STCODE = ST.replace(/\/\*[\s\S]*?\*\//g, ' ');

console.log('── 截圖辨識效能的統計與判讀 ──');

section('★★ 判讀邏輯只能有一份');
/* ⚠️⚠️ 老師 2026-08-26 要把 Colab 那格搬到教師端的狀態檢查。
   ★ 如果兩邊各寫一份判讀，同一組數字會給出不同建議 ——
     而那種不一致沒有人會發現。這個 repo 已經因為「抄一份」吃過好幾次虧。 */
ok(/def ocr_stats_verdict/.test(NBCODE), '★ 後端有唯一一份判讀函式');
ok((NBCODE.match(/def ocr_stats_verdict/g) || []).length === 1,
   '★★ 判讀函式只定義一次');
/* Colab 統計格要呼叫它，不可以自己再判一次 */
/* ⚠️ 要用 cell_type 過濾：markdown 那格的標題也含同一句話，
   直接 find 會抓到說明文字那格 —— 於是「有沒有呼叫共用判讀」判紅，
   而「有沒有自己的門檻」變成假通過（markdown 本來就沒有）。 */
const statCell = NB.cells
  .filter(c => c.cell_type === 'code')
  .map(c => (c.source || []).join(''))
  .find(c => c.includes('這學期的 OCR 統計'));
ok(!!statCell && /core\.ocr_stats_verdict/.test(statCell),
   '★★ Colab 統計格要呼叫共用的判讀，不可以自己算');
ok(!!statCell && !/avg_level_attempts.*>=.*1\.5/.test(statCell),
   '★★ Colab 統計格裡不可以有自己的門檻判斷（那就是第二份）');
/* 前端也不可以自己判 */
ok(/j\.verdict/.test(STCODE),
   '★★ 教師端顯示後端給的 verdict，不自己判讀');
ok(!/avg_level_attempts\s*>=?\s*1\.5/.test(STCODE),
   '★★ 教師端不可以出現自己的門檻判斷');

section('★ 資料照這一頁的原則走：問後端，不直接讀 Firestore');
/* ⚠️ status.html 第 222 行的既有原則：
   「需要資料庫內容的檢查一律改問 /api/health（後端有服務帳戶）」。
   直接讀 {學期}-ocr-stats 的話，還得為了看統計去改安全規則並重新發布。 */
ok(/\/api\/ocr-stats/.test(STCODE), '★ 教師端問後端的端點');
ok(/@app\.route\("\/api\/ocr-stats"\)/.test(NBCODE), '★ 後端有這個端點');
ok(!/ocr-stats['"]\s*\)/.test(STCODE.replace(/\/api\/ocr-stats/g, '')),
   '★★ 教師端沒有直接去讀 Firestore 的集合');

section('★ 沒有資料、後端太舊時要說得清楚');
ok(/尚無資料|還沒有資料/.test(ST), '★ 沒有資料時要講「要先上一次課」');
ok(/舊版 notebook/.test(ST), '★ 端點不存在時要提示 Colab 版本太舊');

section('★★ 徽章那塊的警語不可以消失');
/* ⚠️ 徽章判定**沒有兜底**（見 backend_parse.test.py 的 C-9）。
   日後有人為了加速想放寬門檻時，這句話是唯一的攔阻。 */
ok(/不可以放寬比對門檻/.test(NBCODE),
   '★★ 判讀裡要保留「徽章不可以放寬門檻」的警告');
ok(/挑戰失敗/.test(NBCODE),
   '★ 而且要講出後果（門檻降到 0.5 會把「挑戰失敗」判成過關）');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
