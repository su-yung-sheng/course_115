/* 臨時工具頁：取消程式成績（11501/revoke.html）
   跑法：node shared/tests/revokepage.test.js

   ★ 老師 2026-10-15：「不要使用 F12，設計成『臨時開放關卡』單網頁的形態」。
   ★★ 和 unlock.html 一樣是**刻意**可以隨時刪掉的頁面：檔案不存在就直接通過。

   守的幾件事：
     · 這一頁**不可以自己寫成績**（progress／批改紀錄）—— 只改一份會被另一份無聲地加回來，
       一定要走後端一次改三個地方（backend.ipynb 的 revoke_scratch_unit）
     · 一定要寫原因、一定要先確認
     · 三步的結果要分開顯示 —— 只成功一部分是最危險的狀態 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const FILE = '11501/revoke.html';

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const abs = path.join(root, FILE);
if (!fs.existsSync(abs)) {
  console.log('\n（' + FILE + ' 不在了 —— 那一頁本來就是暫時的，略過這份測試。）');
  console.log('\n通過 0／失敗 0');
  process.exit(0);
}
const html = fs.readFileSync(abs, 'utf8');
const js = (html.match(/<script>\n([\s\S]*?)<\/script>/) || [, ''])[1];

section('★★★ 這一頁不可以自己寫成績');
{
  ok(!/(doc|collection)\([^)]*\)\.(set|update|add|delete)\(|\.batch\(|runTransaction/.test(js),
     '★★★ 沒有任何 Firestore 寫入（set／update／add／delete）—— 取消一定要走後端一次改三個地方');
  ok(/\/api\/teacher\/revoke-scratch/.test(js), '★★ 取消是呼叫後端 /api/teacher/revoke-scratch');
  ok(/method:\s*'POST'/.test(js), '★ 用 POST（後端也只收 POST）');
  ok(/COL\.SUBMISSIONS/.test(js) && /COL\.PROGRESS/.test(js), '★ 集合名走 CONFIG.COLLECTIONS（不寫死）');
}

section('★★ 原因與確認');
{
  ok(/reason\.length\s*<\s*2/.test(js), '★★ 沒寫原因就不送出');
  ok(/confirm\(/.test(js), '★★ 送出前要再確認一次（按下去就改成績）');
  ok(/學生看不到/.test(html), '★ 畫面講明原因學生看不到（可以放心寫另一位同學的學號）');
  ok(/後面的關卡會跟著鎖住/.test(html), '★★ 畫面講明後面的關卡會跟著鎖住');
}

section('★★ 結果三步分開顯示');
{
  ok(/j\.submissions/.test(js) && /j\.files/.test(js) && /j\.progress/.test(js),
     '★★★ 批改紀錄／同一個檔案再交／星星三步分開印 —— 看得出是哪一步沒做到');
  ok(/esc\(j\.submissions/.test(js), '★ 後端回來的文字有跳脫再放進畫面');
}

section('★ 教師身分、關卡清單、語法、可刪除性');
{
  ok(/AUTH\.isTeacherEmail/.test(js) && /signOut\(\)/.test(js), '★★ 只有老師能用；非教師身分登出');
  ok(/FLOW_UNITS/.test(js) && !/['"]2-1-\d[AB]?['"]/.test(js), '★★ 關卡下拉從 FLOW_UNITS 生，沒有手打關卡代號');
  let syntaxOk = true, err = '';
  try { new Function(js); } catch (e) { syntaxOk = false; err = String(e.message || e); }
  ok(syntaxOk, '★★ 內嵌的 JS 語法正確' + (syntaxOk ? '' : '　←　' + err));
  const refs = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) {
      if (['node_modules', '.git', '_archive', 'tests', 'Claude outputs'].includes(e.name)) return;
      walk(path.join(d, e.name));
    } else if (/\.(html|js|py|json)$/.test(e.name)) {
      if (fs.readFileSync(path.join(d, e.name), 'utf8').includes('revoke.html')) {
        refs.push(path.relative(root, path.join(d, e.name)).replace(/\\/g, '/'));
      }
    }
  });
  walk(root);
  const others = refs.filter(f => f !== FILE);
  ok(others.length === 0, '★★ 沒有任何頁面連到它 —— 不用時直接刪檔' + (others.length ? '　←　' + others.join('、') : ''));
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
