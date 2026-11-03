/* 教師端名冊：修改座號／姓名（11501、11502 teacher.html）
   跑法：node shared/tests/rosteredit.test.js

   ⛔ 老師 2026-11-02：「學生名冊只能新增、刪除，無法修改姓名？」
      以前唯一的改名方法是「用同一個學號再新增一次」—— 名冊改了，
      但運算思維的紀錄用「班級_座號_姓名」當文件 id，**不會跟著搬**：
      學生下次進運算思維，通關紀錄和證書截圖全部「不見」，而且沒有任何錯誤。
   ★ 這一份用假的 Firestore 真的把名冊那一段程式跑起來。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

function boot(term) {
  const H = fs.readFileSync(path.join(ROOT, term, 'teacher.html'), 'utf8');
  const s = H.indexOf('<script>', H.indexOf('學生名冊管理邏輯')) + 8;
  const js = H.slice(s, H.indexOf('</script>', s));
  const docs = {};                       // 'col/id' -> data
  const ops = [];
  const ref = (col, id) => ({
    get: async () => ({ exists: (col + '/' + id) in docs, data: () => docs[col + '/' + id] }),
    set: async (d, o) => { ops.push(['set', col + '/' + id]);
      docs[col + '/' + id] = (o && o.merge) ? Object.assign({}, docs[col + '/' + id] || {}, d) : Object.assign({}, d); },
    delete: async () => { ops.push(['delete', col + '/' + id]); delete docs[col + '/' + id]; }
  });
  let snapCb = null;
  const db = {
    collection: col => ({
      doc: id => ref(col, id),
      where: (f, op, v) => ({ onSnapshot: cb => { snapCb = () => cb({ docs: Object.keys(docs)
        .filter(k => k.startsWith(col + '/') && String(docs[k][f]) === v)
        .map(k => ({ id: k.split('/').pop(), data: () => docs[k] })) }); snapCb(); return () => {}; } }),
      get: async () => ({ forEach: () => {} })
    }),
    batch: () => ({ set() {}, commit: async () => {} })
  };
  const els = {};
  const el = id => els[id] || (els[id] = { value: '', innerHTML: '', innerText: '', options: [], classList: { add() {}, remove() {} } });
  const toasts = [];
  const ctx = {
    window: { CONFIG: { COLLECTIONS: { ROSTER: 'roster' }, SHARED: { SECRET: 'secret', SESSION: 'session' }, TERM: term } },
    firebase: { firestore: () => db }, document: { getElementById: el },
    showToast: (m, bad) => toasts.push((bad ? '✗ ' : '✓ ') + m), showCustomDialog() {},
    setTimeout: f => f(), console: { warn() {}, error() {}, log() {} }, Date, JSON, Object, String, Number, Promise, Set, Math
  };
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  return { ctx, docs, ops, el, toasts, refresh: () => snapCb && snapCb(), W: ctx.window };
}
const tick = () => new Promise(r => setImmediate(r));

(async () => {
for (const [term, CT] of [['11501', 'artifacts/comp-think-app/public/data/progress'],
                          ['11502', 'artifacts/comp-think-app/public/data/progress_sem2']]) {
  section(term + '　① 改姓名：運算思維紀錄跟著搬');
  const t = boot(term);
  t.docs['roster/1410305'] = { studentId: '1410305', cls: '803', no: '5', name: '王小名', key: '803_5_王小名', unlocks_json: '{"2-1-3":{}}' };
  t.docs['roster/1410306'] = { studentId: '1410306', cls: '803', no: '6', name: '林六', key: '803_6_林六' };
  t.docs[CT + '/803_5_王小名'] = { sid: '1410305', completed: [1, 2, 3], certificateUrls: { 1: 'u1' }, name: '王小名', seatNo: '5', classRoom: '803' };
  t.el('roster-class').value = '803';
  t.W.openRosterModal ? t.W.openRosterModal() : null;
  await tick(); await tick();
  t.W.editRosterRow('1410305');
  ok(/id="ed-name"/.test(t.el('roster-list').innerHTML) && /saveRosterEdit\('1410305'\)/.test(t.el('roster-list').innerHTML),
     '★★ 按「修改」⇒ 那一列變成可編輯的座號／姓名，有「儲存」');
  t.el('ed-no').value = '5'; t.el('ed-name').value = '王小明';
  await t.W.saveRosterEdit('1410305');
  const r = t.docs['roster/1410305'];
  ok(r.name === '王小明' && r.key === '803_5_王小明', '★★ 名冊改好了，key 也跟著換　←　' + r.key);
  ok(r.unlocks_json === '{"2-1-3":{}}', '★★★ 名冊上別人的欄位（開放關卡）沒有被洗掉');
  const nw = t.docs[CT + '/803_5_王小明'];
  ok(nw && JSON.stringify(nw.completed) === '[1,2,3]' && nw.certificateUrls[1] === 'u1' && nw.name === '王小明',
     '★★★ 運算思維的通關紀錄、證書截圖搬到新的 id（姓名也更新）');
  ok(!(CT + '/803_5_王小名' in t.docs), '★ 舊的那一份刪掉了（不會留兩份）');
  const seq = t.ops.map(o => o[0] + ' ' + o[1].split('/').pop());
  ok(seq.indexOf('set 803_5_王小明') < seq.indexOf('set 1410305') && seq.indexOf('set 1410305') < seq.indexOf('delete 803_5_王小名'),
     '★★ 順序：先複製 → 再改名冊 → 最後刪舊的（中途失敗也不會丟資料）　←　' + seq.join('、'));
  ok(t.toasts.some(m => /✓ .*王小明.*一起搬過去/.test(m)), '畫面告訴老師紀錄搬過去了');

  section(term + '　② 擋下會出事的修改');
  t.refresh();
  t.W.editRosterRow('1410305'); t.el('ed-no').value = '6'; t.el('ed-name').value = '王小明';
  t.toasts.length = 0;
  await t.W.saveRosterEdit('1410305');
  ok(t.docs['roster/1410305'].no === '5' && t.toasts.some(m => /6 號已經是 林六/.test(m)), '★★ 座號撞到同班別人 ⇒ 不改，講出是誰');
  t.docs[CT + '/803_5_王大明'] = { sid: 'x', completed: [9] };
  t.W.editRosterRow('1410305'); t.el('ed-no').value = '5'; t.el('ed-name').value = '王大明';
  t.toasts.length = 0;
  await t.W.saveRosterEdit('1410305');
  ok(t.docs['roster/1410305'].name === '王小明' && JSON.stringify(t.docs[CT + '/803_5_王大明'].completed) === '[9]',
     '★★★ 新 id 已經有一份運算思維紀錄 ⇒ 整個不改，也不蓋掉那一份');
  t.W.editRosterRow('1410305'); t.el('ed-name').value = '王_小明';
  t.toasts.length = 0;
  await t.W.saveRosterEdit('1410305');
  ok(t.toasts.some(m => /不可以有/.test(m)), '★ 姓名有「_」⇒ 擋（會弄壞「班級_座號_姓名」）');

  section(term + '　③ 用「新增」蓋掉已存在的學號 ⇒ 擋');
  t.el('roster-class').value = '803';
  t.el('add-no').value = '9'; t.el('add-id').value = '1410305'; t.el('add-name').value = '別人';
  t.toasts.length = 0;
  await t.W.addRosterStudent();
  ok(t.docs['roster/1410305'].name === '王小明' && t.toasts.some(m => /已經在名冊裡.*修改/.test(m)),
     '★★★ 已存在的學號按「新增」⇒ 不改，叫老師用「修改」（以前就是這樣悄悄改名、紀錄沒搬）');
  t.el('add-no').value = '7'; t.el('add-id').value = '1410307'; t.el('add-name').value = '新同學';
  await t.W.addRosterStudent();
  ok(t.docs['roster/1410307'] && t.docs['roster/1410307'].name === '新同學', '　真的新學號照常新增');

  section(term + '　④ 沒有運算思維紀錄的學生也能改');
  t.refresh();
  t.W.editRosterRow('1410306'); t.el('ed-no').value = '6'; t.el('ed-name').value = '林小六';
  await t.W.saveRosterEdit('1410306');
  ok(t.docs['roster/1410306'].name === '林小六' && !Object.keys(t.docs).some(k => k.startsWith(CT + '/803_6')),
     '還沒玩過運算思維 ⇒ 只改名冊，不會憑空生出一份空紀錄');
}

})().then(() => {
console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
});
