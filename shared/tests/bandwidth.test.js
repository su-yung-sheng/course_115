/* ngrok 流量／請求數：學生端不可以一直打後端
   跑法：node shared/tests/bandwidth.test.js

   ⛔⛔⛔ 2026-09-22 ERR_NGROK_725「Network bandwidth exceeded」——
   免費 ngrok 一個月 1 GB、2 萬次請求，Scratch 那台用光了，全班連不上。
   兩個原因疊在一起：
     ① shared/grader.html 每 20 秒打一次 /api/student/config，**連上了也照打**。
        它嵌在程式設計每一關裡，學生開著就一直打：30 人 × 3 次／分 × 40 分
        ≈ 3,600 次／節課 ⇒ 光次數五、六節課就用完一個月。
     ② 那支 API 回的是**整份設定**（十關的規則＋參考解答＋空白範本），
        每次數百 KB ⇒ 流量一節課就燒掉大半個 GB。
        而且十關的參考解答全送到學生瀏覽器，F12 就看得到。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const G = fs.readFileSync(path.join(ROOT, 'shared', 'grader.html'), 'utf8');
const GC = strip(G);

section('★★★ grader.html：連上之後不再輪詢');
ok(!/setInterval\(\s*loadTask/.test(GC),
   '★★★ 不可以再 setInterval(loadTask, …) —— 那就是每節課幾千次請求的來源');

/* 抽出 loadTask 與啟動迴圈，真的跑一次 */
const lt = (G.match(/async function loadTask\(\)\{[\s\S]*?\n\}\n/) || [''])[0];
const loop = (G.match(/\(async function taskLoop\(\)\{[\s\S]*?\}\)\(\);/) || [''])[0];
ok(lt.length > 0 && loop.length > 0, '找得到 loadTask 與 taskLoop');

async function simulate(responses) {
  const calls = [], timers = [];
  const el = () => ({ textContent: '', innerHTML: '' });
  const ctx = {
    UNIT: '2-1-1A', H: {}, window: { CONFIG: { TERM: '11501' } }, showScore: true,
    base: () => 'https://x', $: el, setLight: () => {}, encodeURIComponent,
    fetch: async (u) => { calls.push(u); const r = responses[Math.min(calls.length - 1, responses.length - 1)];
                          if (r === 'down') throw new Error('offline'); return { json: async () => r }; },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(lt.replace('async function loadTask', 'var loadTask = async function'), ctx);
  await vm.runInContext(loop.replace(/\)\(\);$/, ')()'), ctx);
  // 把排定的重試一個一個跑完（最多 6 次，避免無限）
  for (let i = 0; i < 6 && timers.length; i++) { const t = timers.shift(); await t.fn(); }
  return { calls: calls.length, pending: timers.length };
}
const OK = { ok: true, config: { theme: 't', rules: 'r', student_show_score: true, has_api_key: true } };
const NOKEY = { ok: true, config: { theme: 't', rules: 'r', has_api_key: false } };

(async () => {
  {
    const r = await simulate([OK]);
    ok(r.calls === 1 && r.pending === 0,
       '★★★ 一連上就停：整節課只問 **1 次**（原本 40 分鐘要問 120 次）　實際 ' + r.calls + ' 次');
  }
  {
    const r = await simulate(['down', 'down', OK]);
    ok(r.calls === 3 && r.pending === 0,
       '★★★ 連不上時要一直重試，連上之後就停　實際 ' + r.calls + ' 次');
  }
  {
    const r = await simulate([NOKEY, NOKEY, OK]);
    ok(r.calls === 3,
       '★★ 連上但沒有金鑰（不能批改）也要繼續重試 —— 老師補好金鑰重開 Colab 之後要能自己發現');
  }
  {
    const r = await simulate(['down']);
    ok(r.calls >= 2, '★ 一直連不上時會持續重試（不會問一次就放棄）');
  }
  {
    const lt2 = (G.match(/async function loadTask\(\)\{[\s\S]*?\n\}\n/) || [''])[0];
    ok(/setTimeout\(taskLoop,\s*20000\)/.test(loop),
       '★ 重試間隔維持 20 秒（不要因為改成重試就變成狂打）');
  }

  section('★★★ 後端 /api/student/config 只回學生用得到的欄位');
  const nb = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'backend.ipynb'), 'utf8'));
  const c8 = nb.cells[8].source.join('');
  const sc = (c8.match(/def student_config\(\):[\s\S]*?\n\n\n/) || [''])[0];
  const scCode = sc.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
  ok(sc.length > 0, '找得到 student_config');
  ok(!/"config":\s*core\.public_config\(cfg\)/.test(scCode),
     '★★★ 不可以再把 public_config 整份回給學生 —— 裡面有十關的參考解答');
  const m = scCode.match(/_STUDENT_FIELDS\s*=\s*\(([^)]*)\)/);
  const fields = m ? m[1].match(/"([a-z_]+)"/g).map(x => x.replace(/"/g, '')) : [];
  ok(fields.length > 0, '★★ 用白名單（_STUDENT_FIELDS）—— 黑名單的問題是新增欄位時忘了加就會漏');
  for (const bad of ['units_json', 'example_code', 'template_code', 'api_key_1', 'anthropic_key'])
    ok(!fields.includes(bad), '★★★ 白名單裡不可以有 ' + bad);
  /* 白名單和前端實際用到的欄位要對得上：少給會壞，多給會漏 */
  const used = [...new Set((G.match(/\bc\.([a-z_]+)/g) || []).map(x => x.slice(2)))]
    .filter(k => ['theme', 'rules', 'student_show_score', 'has_api_key'].includes(k) || !['length'].includes(k));
  const need = ['theme', 'rules', 'student_show_score', 'has_api_key'];
  ok(need.every(k => fields.includes(k)),
     '★★★ 前端用到的四個欄位都要在白名單裡（少一個學生端就會壞）：' + need.join('、'));

  section('★★ 教師端 GET /api/teacher/config 不回金鑰');
  const tg = (c8.match(/def teacher_get_config\(\):[\s\S]*?\n\n\n/) || [''])[0];
  const tgCode = tg.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
  ok(/_SENSITIVE_KEYS/.test(tgCode) && !/jsonify\(\{"ok": True, "config": cfg,/.test(tgCode),
     '★★★ 這支沒有密碼、ngrok 網址又是公開的 ⇒ 不可以整份連金鑰欄位回傳');
  const ts = (c8.match(/def teacher_save_config\(\):[\s\S]*?\n\n\n/) || [''])[0];
  ok(/_SENSITIVE_KEYS[\s\S]{0,200}incoming\.pop/.test(ts),
     '★★ 儲存時金鑰欄位是空白就不要覆蓋 —— GET 不回金鑰之後，舊工具的欄位會是空的');

  console.log('\n通過 ' + pass + '／失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})();
