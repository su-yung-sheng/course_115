/* =====================================================================
   匯出「模擬器判定資料」給下學期後端（11502/backend.ipynb 的 sim_judge）
   ---------------------------------------------------------------------
   ★ 2026-11-18：下學期模擬器拼對＝通關（2⭐），由後端重新判定後寫入（防 F12 假造）。
     後端要知道：每一關的正確答案（goal、其他解法 alts、座標寬鬆 loose、幾個角色），
     以及判定用到的積木定義（形狀、預設參數、哪些欄位是「名字」）。
   ⇒ 這支從題目（11502/content/blocks.js）與模擬器（shared/blocks.js）匯出成一份 JSON，
     後端從 GitHub Pages 抓這一份。題目只有一份，不另外手抄。
   用法：
     node shared/tools/export-sim-judge.js          只檢查（和現有檔案不同就列出來）
     node shared/tools/export-sim-judge.js --write  寫入 11502/content/blocks.judge.json
   ⚠️ 改了題目（goal／alts／loose／sprites）或積木定義之後要重跑 --write 再推送；
      shared/tests/simjudge.test.js 會擋沒同步的版本。
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, '11502', 'content', 'blocks.judge.json');

function build() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'shared', 'blocks.js'), 'utf8'))(w);
  new Function('window', fs.readFileSync(path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8'))(w);
  const DEFS = w.BLOCKS.DEFS, LV = w.BLOCK_LEVELS || {};
  const defs = {};
  Object.keys(DEFS).sort().forEach(id => {
    const d = DEFS[id], o = {};
    ['shape', 'args', 'idArgs', 'idNs'].forEach(k => { if (d[k] != null) o[k] = d[k]; });
    defs[id] = o;
  });
  const levels = {};
  Object.keys(LV).sort().forEach(u => {
    const lv = LV[u] || {};
    const sprites = (lv.sprites && lv.sprites.length)
      ? lv.sprites.map(s => ({ goal: s.goal || [], alts: (s.alts || []).map(a => ({ goal: a.goal || [] })) }))
      : (lv.goal ? [{ goal: lv.goal, alts: (lv.alts || []).map(a => ({ goal: a.goal || [] })) }] : null);
    if (!sprites) return;                                  // 沒有拼圖的關（第 5、10 關）
    levels[u] = { loose: lv.loose || [], sprites };
  });
  return JSON.stringify({ note: '由 shared/tools/export-sim-judge.js 產生，不要手改', defs, levels }, null, 1) + '\n';
}

if (require.main === module) {
  const want = build();
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUT, want);
    console.log('✅ 已寫入 ' + path.relative(ROOT, OUT) + '（' + Object.keys(JSON.parse(want).levels).length + ' 關）');
  } else {
    console.log(cur === want ? '✅ 已同步' : '⚠️ 和題目不同步，請加 --write 重新產生');
    process.exit(cur === want ? 0 : 1);
  }
}
module.exports = { build, OUT };
