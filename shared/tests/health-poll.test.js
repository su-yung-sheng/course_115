/* 運算思維的「伺服器連線中」輪詢：多人上線時不可以把自己打掛
   跑法：node shared/tests/health-poll.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

console.log('── 運算思維：/health 輪詢 ──');

/* ⚠️⚠️ 2026-08-26 老師回報：「後端有執行，多人連線後會出現『伺服器連線中...』」。
   三個原因疊在一起：
     ① 每 5 秒輪詢一次 —— 一個班 30 人就是每分鐘 360 次打到 ngrok
     ② setIsOnline(res.ok) 一次失敗就判離線，上傳按鈕跟著鎖死
        （disabled={!isOnline...}），但後端其實還活著
     ③ 沒有逾時，慢的請求會一直堆積
   ★ 而且「還在連」和「連不上」顯示同一句話，老師分不出是哪一種。 */
for (const term of ['11501', '11502']) {
  section('★ ' + term + '/thinking.html');
  const SRC = fs.readFileSync(path.join(ROOT, term, 'thinking.html'), 'utf8');
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');

  const iv = (CODE.match(/setInterval\(checkHealth,\s*(\d+)\)/) || [])[1];
  ok(!!iv && Number(iv) >= 20000,
     '★★ 輪詢間隔至少 20 秒（目前 ' + (iv ? iv / 1000 + ' 秒' : '找不到') +
     '；30 人 × 每分鐘 ' + (iv ? Math.floor(30 * 60000 / iv) : '?') + ' 次）');

  ok(/MISS_LIMIT/.test(CODE) && !/setIsOnline\(res\.ok\)/.test(CODE),
     '★★ 要連續失敗數次才判離線，不可以一次失敗就鎖住上傳按鈕');

  ok(/AbortController/.test(CODE) && /ctl\.abort\(\)/.test(CODE),
     '★ 請求要有逾時（否則慢的請求會堆積）');

  ok(/document\.hidden/.test(CODE),
     '★ 分頁在背景時不輪詢（不要浪費 ngrok 配額）');

  ok(/netNote/.test(CODE) && /OFFLINE_NOTE/.test(CODE),
     '★★ 「還在連」和「連不上」要顯示不同的話');

  /* ⚠️ 清理要確實：元件重繪時舊的輪詢沒停掉會愈積愈多。 */
  ok(/alive\s*=\s*false/.test(CODE) && /clearInterval\(interval\)/.test(CODE),
     '★ 卸載時要停掉輪詢並標記失效');
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
