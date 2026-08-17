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

  /** 條件裡有什麼（只取關鍵字，給性質比對用，不求精確） */
  function condOf(b) {
    const seen = [];
    (function w(x, d) {
      if (!x || d > 6) return;
      if (typeof x === 'string' && bl[x]) { w(bl[x], d + 1); return; }
      if (x.opcode) {
        seen.push(x.opcode);
        Object.values(x.inputs || {}).forEach(v => w(v[1], d + 1));
        Object.values(x.fields || {}).forEach(v => seen.push(String(v[0])));
      }
    })(b, 0);
    return seen;
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
        /* ⚠️ 不認得就原樣留下，**不要丟錯**。
           第 6～9 關用的是清單與變數積木（data_*），
           系統那邊把它們包成一塊一塊的教學積木（例如
           「變數 二分位置 設為（開始＋結束）÷2 的整數部分」＝ Scratch 的三塊橢圓）。
           那幾關本來就不做逐塊比對 —— 見下面的「性質比對」。
           ★ 但前四關**必須**全部認得：出現 raw 就是漏了對照，要紅。 */
        out.push({ id: o, raw: true, args: condOf(b) });
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

/* ── 第 6～9 關：性質比對 ─────────────────────────────
   ⚠️ 這四關**不能**逐塊比對。
      系統把 Scratch 的好幾塊包成一塊教學積木
      （例如「變數 二分位置 設為（開始＋結束）÷2 的整數部分」
        在 Scratch 是三顆橢圓疊起來），
      逐塊比對必然對不上 —— 那不是錯，是刻意的簡化。
   ⇒ 改成比**結構性質**：停止條件幾個、報告寫在迴圈裡還是外面、
     插入和刪除誰先誰後。那幾件事才是這四關的教學重點，
     也正是 2026-08-17 老師上傳範例檔之後抓到的三個差異。 */
const SEMANTIC = {
  '11502_單元六.sb3': { uid: '6-2-1', name: '選擇排序',
    checks: [
      ['副程式包起來', t => /procedures_definition/.test(t)],
      ['兩個變數都先設成 1', t => (t.match(/data_setvariableto/g) || []).length >= 2],
      ['重複「清單長度」次', t => /control_repeat[\s\S]*data_lengthoflist/.test(t)],
      ['迴圈裡有一個「如果」', t => /control_if\b/.test(t)],
      ['★ 位置改變 1 在「如果」外面（不然沒換人時就不往下走）',
        t => /control_if[\s\S]*data_changevariableby/.test(t) &&
             !/control_if\s+data_setvariableto\s+data_changevariableby/.test(t)]
    ]},
  '11502_單元七.sb3': { uid: '6-2-2', name: '插入排序',
    checks: [
      ['★ 主程式是「當角色被點擊」', t => /event_whenthisspriteclicked/.test(t)],
      ['外圈重複固定次數', t => /control_repeat\b/.test(t)],
      ['內圈是「重複直到」', t => /control_repeat_until/.test(t)],
      ['★ 內圈的停止條件是「或」（兩個）', t => /operator_or/.test(t)],
      ['★ 先插入、才刪除第 1 項',
        t => t.indexOf('data_insertatlist') < t.indexOf('data_deleteoflist')]
    ]},
  '11502_單元八.sb3': { uid: '6-3-1', name: '循序搜尋',
    checks: [
      ['★ 主程式是「當角色被點擊」', t => /event_whenthisspriteclicked/.test(t)],
      ['有詢問', t => /sensing_askandwait/.test(t)],
      ['★ 停止條件是「或」（兩個）', t => /control_repeat_until[\s\S]*operator_or/.test(t)],
      ['★★ 報告結果在迴圈**外面**（找不到也要說話）',
        t => t.indexOf('control_if_else') > t.indexOf('control_repeat_until')],
      ['★ 有「沒有符合的數字」那一句', t => /沒有符合/.test(t)]
    ]},
  '11502_單元九.sb3': { uid: '6-3-2', name: '二元搜尋',
    checks: [
      ['有詢問', t => /sensing_askandwait/.test(t)],
      ['★★ 收斂用 ±1（2026-08-17 老師修正版）',
        t => /operator_add/.test(t) && /operator_subtract/.test(t)],
      ['★★ 停止條件是「開始位置 > 結束位置」，不是「開始位置 = 位置」',
        t => /operator_gt\s+開始位置\s+結束位置|開始位置\s+結束位置/.test(t) &&
             !/operator_equals\s+開始位置\s+位置/.test(t)],
      ['算二分位置用無條件捨去', t => /operator_mathop/.test(t)],
      ['★ 停止條件是「或」（兩個）', t => /control_repeat_until[\s\S]*operator_or/.test(t)],
      ['★★ 報告結果在迴圈**外面**',
        t => t.lastIndexOf('control_if_else') > t.indexOf('control_repeat_until')],
      ['★ 有「沒有符合的數字」那一句', t => /沒有符合/.test(t)]
    ]}
};

section('★★ 第 6～9 關：和範例檔比「結構性質」（不逐塊）');
Object.keys(SEMANTIC).forEach(fn => {
  const spec = SEMANTIC[fn];
  const p = path.join(refdir, fn);
  ok(fs.existsSync(p), fn + ' 在 reference 資料夾裡（' + spec.uid + ' ' + spec.name + '）');
  if (!fs.existsSync(p)) return;
  const json = JSON.parse(readZipEntry(fs.readFileSync(p), 'project.json').toString('utf8'));
  /* 直接看 opcode 的順序字串 —— 性質比對不需要精確的樹 */
  let t = '';
  json.targets.filter(x => !x.isStage).forEach(x => {
    const bl = x.blocks;
    const tops = Object.keys(bl).filter(k => bl[k].topLevel);
    tops.forEach(top => {
      (function w(k, d) {
        while (k) {
          const b = bl[k]; if (!b) break;
          t += b.opcode + ' ';
          Object.values(b.inputs || {}).forEach(v => {
            (function sub(id, dd) {
              if (typeof id !== 'string' || !bl[id] || dd > 6) return;
              t += bl[id].opcode + ' ';
              Object.values(bl[id].fields || {}).forEach(f => { t += f[0] + ' '; });
              Object.values(bl[id].inputs || {}).forEach(vv => {
                if (Array.isArray(vv[1])) t += String(vv[1][1]) + ' ';
                else sub(vv[1], dd + 1);
              });
            })(v[1], 0);
          });
          Object.values(b.fields || {}).forEach(f => { t += f[0] + ' '; });
          if ((b.inputs || {}).SUBSTACK) w(b.inputs.SUBSTACK[1], d + 1);
          if ((b.inputs || {}).SUBSTACK2) w(b.inputs.SUBSTACK2[1], d + 1);
          k = b.next;
        }
      })(top, 0);
    });
  });
  spec.checks.forEach(([label, fn2]) => {
    ok(fn2(t), '   ' + spec.uid + '　' + label);
  });
});

section('★★ 系統的目標程式要有同樣的性質');
{
  /* ⚠️ 上面那圈只確認**範例檔**長什麼樣。
     系統這邊要跟得上，不然對照了等於沒對照。 */
  const flatOf = id => flat(L[id].goal).join(' ');
  const CASES = [
    ['6-2-1', '★ 位置改變 1 在「如果」外面',
      t => /control\.ifsmaller[\s\S]*list\.setmin[\s\S]*list\.changeidx/.test(t)],
    ['6-2-2', '★ 先插入、才刪除第 1 項',
      t => t.indexOf('list.insertfirst') < t.indexOf('list.delfirst')],
    ['6-2-2', '★ 不再用「取出即刪除」那一塊（那是舊版）',
      t => t.indexOf('list.takenext') < 0],
    ['6-3-1', '★★ 報告結果在迴圈外面（找不到也會說話）',
      t => t.indexOf('control.ifover') > t.indexOf('control.untilfound')],
    ['6-3-1', '★ 有「沒有符合的數字」', t => /looks\.saynone/.test(t)],
    ['6-3-1', '★ 「說出找到了」不在迴圈裡面（那是舊版的寫法）',
      t => t.indexOf('looks.sayfound') > t.indexOf('control.ifover')],
    ['6-3-2', '★★ 報告結果在迴圈外面',
      t => t.indexOf('control.iffoundmid') > t.indexOf('control.untilhalf')],
    ['6-3-2', '★ 有「沒有符合的數字」', t => /looks\.saynone/.test(t)],
    /* ⚠️⚠️ 這一條是刻意和範例檔**不一樣**的地方，要釘死。
       範例檔用「開始位置 ← 二分位置」（不加減 1），
       接上它自己那 50 筆資料跑，有 2 個數字找不到
       （第 25 項的 50、第 50 項的 100）——
       範圍剩兩格時，(開始＋結束)÷2 取整數永遠等於開始位置，
       最後一項永遠輪不到被比較。
       ⇒ 以後有人「照範例修正」把 ±1 拿掉的話，這條會紅。 */
    /* ⚠️ 2026-08-17 傍晚：老師改好範例檔重傳了 ——
       ±1、開始 > 結束、迴圈末尾那塊多餘的「再算一次」也刪掉了，
       還加了「位置 ← 0」。重跑同一份 50 筆資料：全部找得到，最多 6 次。
       ⇒ 這條從「刻意不一樣」變成「兩邊一樣」，但還是要釘 —— 拿掉就會漏答案。 */
    ['6-3-2', '★★ 收斂用 ±1（少了它，範圍剩兩格時最後一項永遠比不到）',
      t => /list\.tolo/.test(t) && /list\.tohi/.test(t)],
    ['6-3-2', '★ 先把「位置」歸零（停止條件第一次檢查時它還沒算過）',
      /* ⚠️ 比對前兩邊都要去空白 —— flat() 印出來是「list.setidx ["位置",0]」，
         regex 裡若還留著那個空白就永遠對不上（第一版就是這樣紅的）。
         ⚠️ 變數名 2026-08-17 傍晚從「二分位置」改成「位置」（跟範例檔）。 */
      t => /list\.setidx\["位置",0\]/.test(t.replace(/\s/g, ''))],
    /* ★ 三關的主程式都是「當角色被點擊」—— 綠旗那一塊在範例裡是建立資料用的 */
    ['6-2-2', '★ 主程式是「當角色被點擊」', t => /events\.whenclicked/.test(t)],
    ['6-3-1', '★ 主程式是「當角色被點擊」', t => /events\.whenclicked/.test(t)],
    ['6-3-2', '★ 主程式是「當角色被點擊」', t => /events\.whenclicked/.test(t)]
  ];
  CASES.forEach(([id, label, fn]) => ok(fn(flatOf(id)), '   ' + id + '　' + label));
}

section('★★ 還沒有範例檔的關卡要列出來（不可以安靜跳過）');
{
  /* ⚠️ 「不知道對不對」和「對」是兩件事。
     2026-08-17 之前這件事沒有任何地方寫著，
     所以八關的目標程式是我猜的，而畫面上一片綠。 */
  const ORDER = ['4-2-1', '4-2-2', '4-2-3', '4-3-1', '6-1-1',
                 '6-2-1', '6-2-2', '6-3-1', '6-3-2', '6-3-3'];
  const covered = Object.values(PAIRS)
                    .concat(Object.values(SEMANTIC).map(v => v.uid));
  const missing = ORDER.filter(id => L[id] && L[id].goal && covered.indexOf(id) < 0);
  console.log('     目前有範例檔可對的：' + covered.join('、'));
  console.log('     ⚠️ 還沒有的：' + (missing.join('、') || '（沒有了）'));
  ok(true, '（這一條不判成敗 —— 它的工作是把「還沒對過」講出來）');
  ok(missing.length <= 0,
     '★ 還沒對照的關卡剩 ' + missing.length + ' 關' +
     (missing.length ? '（' + missing.join('、') + '）' : ''));
}

section('★★ 用詞一律跟範例檔（老師 2026-08-17 決定）');
{
  /* ★ 學生在拼圖上看到的清單與變數名字，回 Scratch 要找得到同一個東西。
     系統原本自己取了一套（「數列」「二分位置」），
     於是同一件事有兩個名字 —— 那一層翻譯是白費的認知負擔。
     ⚠️ 這裡掃的是**積木的標籤**（DEFS.label）與關卡資料，
        不掃註解 —— 註解裡寫著「原本叫數列」是刻意留的歷史。 */
  global.window = {};
  (0, eval)(fs.readFileSync(path.join(ROOT, 'shared', 'blocks.js'), 'utf8'));
  const DEFS = global.window.BLOCKS.DEFS;
  const labels = Object.keys(DEFS).map(k => k + '：' + (DEFS[k].label || '')).join('\n');

  const BAD = [
    ['數列', '範例檔的清單叫「原始資料」「已排序資料」'],
    ['二分位置', '範例檔的變數叫「位置」（課本才叫二分位置）']
  ];
  BAD.forEach(([w, why]) => {
    const hit = labels.split('\n').filter(l => l.indexOf(w) >= 0);
    ok(hit.length === 0,
       '★★ 積木標籤裡沒有「' + w + '」—— ' + why +
       (hit.length ? '\n       ' + hit.join('\n       ') : ''));
  });

  /* 反過來：範例檔的名字要真的用上 */
  [['原始資料', '第 6～8 關'], ['已排序資料', '第 7、9 關'],
   ['開始位置', '第 9 關'], ['結束位置', '第 9 關'],
   ['資料位置', '第 6 關'], ['最小值位置', '第 6 關'], ['插入位置', '第 7 關']
  ].forEach(([w, where]) => {
    ok(labels.indexOf(w) >= 0, '   用得到範例檔的名字「' + w + '」（' + where + '）');
  });

  /* 那幾個名字要真的在範例檔裡（不是我自己編的） */
  const NAMES = {};
  ['11502_單元六.sb3', '11502_單元七.sb3', '11502_單元八.sb3', '11502_單元九.sb3']
    .forEach(fn => {
      const j = JSON.parse(readZipEntry(fs.readFileSync(path.join(refdir, fn)),
                                        'project.json').toString('utf8'));
      j.targets.forEach(t => {
        Object.values(t.lists || {}).forEach(l => { NAMES[l[0]] = 1; });
        Object.values(t.variables || {}).forEach(v => { NAMES[v[0]] = 1; });
      });
    });
  ['原始資料', '已排序資料', '位置', '開始位置', '結束位置',
   '資料位置', '最小值位置', '插入位置'].forEach(w => {
    ok(!!NAMES[w], '★ 「' + w + '」真的是範例檔裡的名字（不是我自己取的）');
  });
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
