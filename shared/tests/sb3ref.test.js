/* 目標程式要和老師的範例檔（.sb3）逐塊一致
   跑法：node shared/tests/sb3ref.test.js

   ★ 為什麼有這一份
     2026-08-17 老師問「第 3 關不是只要一個副程式就好嗎」，
     我查下來才發現：**只有第 1、2 關比對過老師的實際檔案**，
     第 3 關以後的目標程式全是我照課本文字寫的。
     老師隨即上傳了單元三、單元四 ——
       單元三：完全吻合（我的猜測剛好對）
       單元四：**三處不一樣，其中一處是真的錯**

     ⚠️⚠️ 那個錯：「分身刪除」在 Scratch 是**帽蓋積木**，
        一執行整段就結束，排在它下面的積木永遠不會跑
        （在真的 Scratch 裡也接不上去）。
        我寫成「先刪除分身、再產生蟲」——
        學生照著拼，蟲被吃掉之後**不會補**，吃完十隻場上就空了。
        而系統的拼圖引擎不知道帽蓋這回事，照樣判他過關。

   ★ 這份測試怎麼做
     把 .sb3 解出來（就是一個 zip 裡的 project.json），
     轉成和 blocks.js 同一種結構，然後逐塊比對。
     ⚠️ 沒有範例檔的關卡要**明白列出來**，不可以安靜跳過 ——
        「不知道對不對」和「對」是兩件事。 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

/* 檔名 → 關卡代號。⚠️ 新增範例檔時在這裡加一行。 */
const PAIRS = {
  '11502_單元一.sb3': '4-2-1',
  '11502_單元二.sb3': '4-2-2',
  '11502_單元三.sb3': '4-2-3',
  '11502_單元四.sb3': '4-3-1'
};

/* ── 最小的 zip 讀取器（只為了拿 project.json）───────
   ⚠️ 不裝額外套件：這個 repo 的測試只靠 node 內建 + jsdom。 */
function readZipEntry(buf, name) {
  /* 從結尾找 End of Central Directory */
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 zip');
  let off = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let k = 0; k < n; k++) {
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const cmtLen = buf.readUInt16LE(off + 32);
    const fname = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    const method = buf.readUInt16LE(off + 10);
    const size = buf.readUInt32LE(off + 24);
    const local = buf.readUInt32LE(off + 42);
    if (fname === name) {
      const lNameLen = buf.readUInt16LE(local + 26);
      const lExtraLen = buf.readUInt16LE(local + 28);
      const start = local + 30 + lNameLen + lExtraLen;
      const raw = buf.slice(start, start + (method === 0 ? size : buf.length - start));
      return method === 0 ? raw : zlib.inflateRawSync(raw);
    }
    off += 46 + nameLen + extraLen + cmtLen;
  }
  throw new Error('zip 裡沒有 ' + name);
}

/* ── sb3 → 和 blocks.js 同一種結構 ────────────────── */
const OPS = {
  event_whenflagclicked: 'events.whenflag',
  pen_clear: 'pen.clear', pen_penDown: 'pen.down', pen_penUp: 'pen.up',
  motion_turnright: 'motion.turnright', motion_turnleft: 'motion.turnleft',
  motion_gotoxy: 'motion.goto', motion_setx: 'motion.setx',
  motion_changeyby: 'motion.changey', motion_pointindirection: 'motion.point',
  motion_movesteps: 'motion.move',
  control_repeat: 'control.repeat', control_forever: 'control.forever',
  control_if: 'control.if', control_if_else: 'control.ifelse',
  control_wait: 'control.wait',
  control_create_clone_of: 'control.clone',
  control_start_as_clone: 'control.whenclone',
  control_delete_this_clone: 'control.delclone',
  looks_show: 'looks.show', looks_hide: 'looks.hide',
  looks_switchcostumeto: 'looks.costume',
  sensing_mousedown: 'sensing.mousedown',
  sensing_touchingcolor: 'sensing.touchcolor',
  operator_and: 'op.and', operator_or: 'op.or', operator_divide: 'op.div'
};

function convert(bl) {
  const num = x => {
    const f = parseFloat(x);
    return isFinite(f) && String(f) === String(x).trim() ? f : x;
  };
  /* 一個 input 的值：可能是常數、也可能塞著另一顆積木 */
  function val(b, name) {
    const inp = (b.inputs || {})[name];
    if (!inp) return null;
    const v = inp[1];
    if (Array.isArray(v)) return num(v[1]);
    if (typeof v === 'string') return expr(bl[v]);
    return null;
  }
  /* 回報型（橢圓）積木 */
  function expr(b) {
    if (!b) return null;
    const o = b.opcode;
    if (o === 'argument_reporter_string_number') {
      return { id: 'arg.param', args: [Object.values(b.fields)[0][0]] };
    }
    if (o === 'operator_divide') {
      return { id: 'op.div', args: [val(b, 'NUM1'), val(b, 'NUM2')] };
    }
    if (o === 'operator_and' || o === 'operator_or') {
      return { id: OPS[o], args: [val(b, 'OPERAND1'), val(b, 'OPERAND2')] };
    }
    if (o === 'sensing_mousedown') return { id: 'sensing.mousedown' };
    if (o === 'sensing_touchingcolor') return { id: 'sensing.touchcolor', args: ['*'] };
    return { id: OPS[o] || o };
  }

  function walk(k) {
    const out = [];
    while (k) {
      const b = bl[k];
      if (!b) break;
      const o = b.opcode;
      if (o === 'procedures_definition') {
        const proto = bl[b.inputs.custom_block[1]];
        const code = proto.mutation.proccode;
        let names = [];
        try { names = JSON.parse(proto.mutation.argumentnames || '[]'); } catch (e) {}
        const nArgs = (code.match(/%[sbn]/g) || []).length;
        out.push({
          id: nArgs >= 2 ? 'my.definep2' : (nArgs === 1 ? 'my.definep' : 'my.define'),
          args: [code.split(' %')[0]].concat(names.slice(0, nArgs)),
          children: walk(b.next)
        });
        return out;                                  // 定義底下整串都是它的
      }
      if (o === 'procedures_call') {
        const code = b.mutation.proccode;
        const ids = JSON.parse(b.mutation.argumentids || '[]');
        const as = ids.map(id => {
          const inp = (b.inputs || {})[id];
          return inp ? num(inp[1][1]) : null;
        });
        out.push({
          id: as.length >= 2 ? 'my.callp2' : (as.length === 1 ? 'my.callp' : 'my.call'),
          args: [code.split(' %')[0]].concat(as)
        });
      } else if (o === 'motion_goto') {
        const menu = bl[b.inputs.TO[1]];
        const to = menu ? Object.values(menu.fields)[0][0] : '';
        out.push({ id: to === '_random_' ? 'motion.gotorandom' : 'motion.gotomouse' });
      } else if (o === 'looks_switchcostumeto') {
        const menu = bl[b.inputs.COSTUME[1]];
        out.push({ id: 'looks.costume',
                   args: [menu ? Object.values(menu.fields)[0][0] : ''] });
      } else if (o === 'control_create_clone_of') {
        out.push({ id: 'control.clone' });
      } else if (OPS[o]) {
        const node = { id: OPS[o] };
        if (o === 'motion_gotoxy') node.args = [val(b, 'X'), val(b, 'Y')];
        else if (o === 'motion_setx') node.args = [val(b, 'X')];
        else if (o === 'motion_changeyby') node.args = [val(b, 'DY')];
        else if (o === 'motion_pointindirection') node.args = [val(b, 'DIRECTION')];
        else if (o === 'motion_movesteps') node.args = [val(b, 'STEPS')];
        else if (o === 'motion_turnright' || o === 'motion_turnleft') node.args = [val(b, 'DEGREES')];
        else if (o === 'control_repeat') node.args = [val(b, 'TIMES')];
        else if (o === 'control_wait') node.args = [val(b, 'DURATION')];
        else if (o === 'control_if' || o === 'control_if_else') node.args = [val(b, 'CONDITION')];
        if (o === 'control_repeat' || o === 'control_forever' ||
            o === 'control_if' || o === 'control_if_else') {
          const sub = (b.inputs || {}).SUBSTACK;
          node.children = sub ? walk(sub[1]) : [];
        }
        if (o === 'control_if_else') {
          const s2 = (b.inputs || {}).SUBSTACK2;
          node.children2 = s2 ? walk(s2[1]) : [];
        }
        out.push(node);
      } else {
        throw new Error('沒有對照的積木：' + o);
      }
      k = b.next;
    }
    return out;
  }

  const tops = Object.keys(bl).filter(k => bl[k] && bl[k].topLevel);
  /* 定義排前面 —— 和 blocks.js 的寫法一致 */
  tops.sort((a, b) => (bl[a].opcode === 'procedures_definition' ? 0 : 1) -
                      (bl[b].opcode === 'procedures_definition' ? 0 : 1));
  let r = [];
  tops.forEach(t => { r = r.concat(walk(t)); });
  return r;
}

/** 攤成一行一塊，方便比對與顯示差異 */
function flat(list, depth, out) {
  out = out || []; depth = depth || 0;
  (list || []).forEach(b => {
    const a = b.args ? JSON.stringify(b.args).replace(/"\*"/g, '"（顏色）"') : '';
    out.push('  '.repeat(depth) + (b.id || b.op) + (a ? ' ' + a : ''));
    if (b.children) flat(b.children, depth + 1, out);
    if (b.children2) { out.push('  '.repeat(depth) + '否則'); flat(b.children2, depth + 1, out); }
  });
  return out;
}
/* 顏色參數在 sb3 裡是色碼、在 blocks.js 裡是「紅」—— 不比那一格 */
const norm = s => s.replace(/\["[^"]*"\]/g, m => (/顏色|紅|#/.test(m) ? '["（顏色）"]' : m));

global.window = {};
(0, eval)(fs.readFileSync(path.join(ROOT, '11502', 'content', 'blocks.js'), 'utf8'));
const L = global.window.BLOCK_LEVELS;
const refdir = path.join(ROOT, '11502', 'content', 'reference');

section('★★ 目標程式 vs 老師的範例檔');
Object.keys(PAIRS).forEach(fn => {
  const uid = PAIRS[fn];
  const p = path.join(refdir, fn);
  ok(fs.existsSync(p), fn + ' 在 reference 資料夾裡');
  if (!fs.existsSync(p)) return;
  ok(!!L[uid], '★ ' + fn + ' 對到的關卡代號「' + uid + '」存在');
  if (!L[uid]) return;

  let got, err = '';
  try {
    const json = JSON.parse(readZipEntry(fs.readFileSync(p), 'project.json').toString('utf8'));
    let all = [];
    json.targets.filter(t => !t.isStage).forEach(t => { all = all.concat(convert(t.blocks)); });
    got = all;
  } catch (e) { err = e.message; }
  ok(!err, '   ' + fn + ' 解得開、轉得出來' + (err ? '（' + err + '）' : ''));
  if (err) return;

  const a = flat(L[uid].goal).map(norm);
  const b = flat(got).map(norm);
  const same = a.join('\n') === b.join('\n');
  let diff = '';
  if (!same) {
    const n = Math.max(a.length, b.length);
    const rows = [];
    for (let i = 0; i < n; i++) {
      if (a[i] !== b[i]) rows.push('       第 ' + (i + 1) + ' 塊　系統：' + (a[i] || '（沒有）') +
                                   '　｜　範例：' + (b[i] || '（沒有）'));
    }
    diff = '\n' + rows.slice(0, 8).join('\n') +
           (rows.length > 8 ? '\n       …還有 ' + (rows.length - 8) + ' 處' : '');
  }
  ok(same, '★★ ' + uid + ' 的目標程式和 ' + fn + ' 逐塊一致' +
     '（系統 ' + a.length + ' 塊、範例 ' + b.length + ' 塊）' + diff);
});

section('★★ 還沒有範例檔的關卡要列出來（不可以安靜跳過）');
{
  /* ⚠️ 「不知道對不對」和「對」是兩件事。
     2026-08-17 之前這件事沒有任何地方寫著，
     所以八關的目標程式是我猜的，而畫面上一片綠。 */
  const ORDER = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-1-1',
                 '6-2-1', '6-2-2', '6-3-1', '6-3-2', '6-3-3'];
  const covered = Object.values(PAIRS);
  const missing = ORDER.filter(id => L[id] && L[id].goal && covered.indexOf(id) < 0);
  console.log('     目前有範例檔可對的：' + covered.join('、'));
  console.log('     ⚠️ 還沒有的：' + (missing.join('、') || '（沒有了）'));
  ok(true, '（這一條不判成敗 —— 它的工作是把「還沒對過」講出來）');
  ok(missing.length <= 5,
     '★ 還沒對照的關卡剩 ' + missing.length + ' 關' +
     (missing.length ? '（' + missing.join('、') + '）' : ''));
}

section('★★ 帽蓋積木底下不可以再接東西');
{
  /* ⚠️ 這就是單元四抓到的那個錯。
     「分身刪除」一執行整段就結束 —— 在真的 Scratch 裡它下面根本接不上積木，
     但這個系統的拼圖引擎不知道，照樣讓學生「拼對」。
     ★ 所以要在資料這一層擋住。 */
  const CAP = ['control.delclone', 'control.stopall'];
  const bad = [];
  function scan(id, list, where) {
    (list || []).forEach((b, i) => {
      const k = b.id || b.op;
      if (CAP.indexOf(k) >= 0 && i < list.length - 1) {
        bad.push(id + '：' + where + ' 的「' + k + '」後面還接了 ' +
                 ((list[i + 1].id || list[i + 1].op)) + '，那一塊永遠不會執行');
      }
      if (b.children) scan(id, b.children, where + '→內層');
      if (b.children2) scan(id, b.children2, where + '→否則');
    });
  }
  Object.keys(L).forEach(id => { if (L[id].goal) scan(id, L[id].goal, '主層'); });
  ok(bad.length === 0,
     '★★ 沒有帽蓋積木底下還接東西' +
     (bad.length ? '\n       ' + bad.join('\n       ') : ''));
}

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
