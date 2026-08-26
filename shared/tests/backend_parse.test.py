# -*- coding: utf-8 -*-
"""
Colab 後端：.sb3 → 虛擬碼 的三個「會影響學生分數」的坑
跑法：python shared/tests/backend_parse.test.py
（check.py 會自動跑 shared/tests/*.test.py，所以提交前一定會經過這裡）

★ 為什麼這支測試是 Python 而不是 JS
  被測的東西住在 shared/backend.ipynb（Colab 後端），是 Python。
  ⚠️ 而 pre-commit 只跑 shared/tests/*.test.js —— Python 測試放進去
     不會被執行。所以改成掛在 check.py 底下（那支 hook 一定會跑）。
     這樣也不必請老師重跑「安裝檢查掛鉤.bat」。

★ 這支**不複製** backend.ipynb 的程式碼，是直接把 notebook 裡的函式
  原始碼抽出來 exec。抄一份出來測，測的就會是抄本，
  正本改壞了測試照樣綠 —— 這個 repo 已經吃過好幾次這種虧。

─────────────────────────────────────────────────────────────
老師 2026-08-26 回報（上次健檢的 B-1／B-2／B-3，course_115 這份也還在）：

  B-1  else 分支消失
       學生寫「如果〔空〕否則〔做事〕」→ 整段 else 不會送給 AI。
       學生的邏輯其實是對的，分數卻不見了。

  B-2  空積木無 END 標記
       評分規則的「空條件判斷鐵律」是靠
       「control_if 和 END control_if 之間沒有任何積木」判定的。
       END 不出現 → 找不到依據 → 空殼反而拿得到分。

  B-3  擴充積木誤判
       pen_stamp、music_playNoteForBeats 拖在旁邊沒接回去，
       卻被當成合法帽子，各自變成一條「▶ 執行序列」送給 AI，
       AI 就以為學生真的有蓋印、有演奏音符 —— 白送分。

  ★ B-1 和 B-2 是**同一個根因**：SUBSTACK2 與 END 兩段本來都巢狀在
    `if "SUBSTACK" in substacks:` 底下，if 分支一空，整段就跳過。
─────────────────────────────────────────────────────────────
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NB = os.path.join(ROOT, 'shared', 'backend.ipynb')

# 只抽這幾支：它們是純函式，只依賴 json / re / os。
# ⚠️ 不要抽整個 cell —— 裡面有 `from google import genai`，本機沒有。
WANT = ('_proc_signature', 'get_input_readable', 'parse_chain_recursive',
        'extract_asset_manifest', '_scan_unknown_extensions', '_scan_api_keys',
        'clean_json_for_ai')

pass_n = 0
fail_n = 0


def ok(cond, label):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print('  ✅ ' + label)
    else:
        fail_n += 1
        print('  ❌ ' + label)


def section(t):
    print('\n── ' + t + ' ──')


def load_funcs():
    """把 notebook 裡的目標函式原始碼抽出來 exec，回傳命名空間。"""
    nb = json.load(io.open(NB, encoding='utf8'))
    src = None
    for cell in nb['cells']:
        body = ''.join(cell.get('source', []))
        if 'def parse_chain_recursive' in body:
            src = body
            break
    if src is None:
        print('❌ backend.ipynb 裡找不到 parse_chain_recursive —— '
              '是不是搬到別的 cell 或改名了？')
        sys.exit(1)

    lines = src.split('\n')
    starts = []
    for i, line in enumerate(lines):
        m = re.match(r'def (\w+)\(', line)
        if m:
            starts.append((m.group(1), i))

    chunks = ['import json, re, os']
    found = set()
    for k, (name, i) in enumerate(starts):
        if name not in WANT:
            continue
        j = starts[k + 1][1] if k + 1 < len(starts) else len(lines)
        chunks.append('\n'.join(lines[i:j]))
        found.add(name)

    missing = [w for w in WANT if w not in found]
    if missing:
        print('❌ 抽不到這幾支函式：' + '、'.join(missing))
        sys.exit(1)

    ns = {}
    exec('\n'.join(chunks), ns)
    return ns


NS = load_funcs()
parse_chain = NS['parse_chain_recursive']
clean_json = NS['clean_json_for_ai']

print('── Colab 後端：.sb3 → 虛擬碼 ──')

# ═══════════════════════════════════════════════════════════
section('B-1 「如果〔空〕否則〔做事〕」的 else 不可以消失')
# ═══════════════════════════════════════════════════════════
blocks = {
    'hat': {'opcode': 'event_whenflagclicked', 'topLevel': True,
            'parent': None, 'next': 'ifel'},
    # ⚠️ 關鍵：只有 SUBSTACK2，沒有 SUBSTACK（if 分支是空的）
    'ifel': {'opcode': 'control_if_else', 'topLevel': False, 'parent': 'hat',
             'next': None, 'inputs': {'SUBSTACK2': [2, 'say']}},
    'say': {'opcode': 'looks_say', 'topLevel': False, 'parent': 'ifel',
            'next': None, 'inputs': {'MESSAGE': [1, [10, '不及格']]}},
}
out = parse_chain('hat', 0, blocks)
ok('(ELSE)' in out, 'else 標記要出現')
ok('looks_say' in out, 'else 裡面的積木要出現（不然 AI 看不到就不會給分）')
ok('END control_if_else' in out, 'else 之後要收尾')

# 反過來：只有 if、沒有 else 內容時，ELSE 標記照出但裡面留空
blocks_b = {
    'hat': {'opcode': 'event_whenflagclicked', 'topLevel': True,
            'parent': None, 'next': 'ifel'},
    'ifel': {'opcode': 'control_if_else', 'topLevel': False, 'parent': 'hat',
             'next': None, 'inputs': {'SUBSTACK': [2, 'mv']}},
    'mv': {'opcode': 'motion_movesteps', 'topLevel': False, 'parent': 'ifel',
           'next': None, 'inputs': {'STEPS': [1, [4, '10']]}},
}
out_b = parse_chain('hat', 0, blocks_b)
ok('(ELSE)' in out_b and 'motion_movesteps' in out_b,
   'if 有內容、else 空的時候，兩邊都要看得出來')
# ⚠️ ELSE 和 END 之間必須是空的 —— 見 B-2 的理由。
#    ⚠️ 要**按行**切，不可以用字元位置：字元位置會切到
#       「--> (END …」的前半截「--> (」，永遠不是空白。
rows = out_b.split('\n')
i_els = next(k for k, r in enumerate(rows) if '(ELSE)' in r)
i_end = next(k for k, r in enumerate(rows) if 'END control_if_else' in r)
ok(all(not r.strip() for r in rows[i_els + 1:i_end]),
   '★ 空的 else 裡面**不可以**補一行「(空)」字樣（會讓 AI 以為有東西）')

# ═══════════════════════════════════════════════════════════
section('B-2 空的條件判斷也要有 END 標記')
# ═══════════════════════════════════════════════════════════
blocks2 = {
    'hat': {'opcode': 'event_whenflagclicked', 'topLevel': True,
            'parent': None, 'next': 'ifb'},
    # ⚠️ 條件、內容全空 —— 這正是評分規則要抓的「空殼」
    'ifb': {'opcode': 'control_if', 'topLevel': False, 'parent': 'hat',
            'next': 'mv', 'inputs': {}},
    'mv': {'opcode': 'motion_movesteps', 'topLevel': False, 'parent': 'ifb',
           'next': None, 'inputs': {'STEPS': [1, [4, '10']]}},
}
out2 = parse_chain('hat', 0, blocks2)
ok('END control_if' in out2, 'END 標記要出現，評分規則才有判斷依據')

# ★ 鐵律的判定方式是「control_if 和 END control_if 之間沒有任何積木」，
#   所以這兩行之間必須真的空白。
i_if = out2.index('control_if (')
i_end = out2.index('--> (END control_if)')
between = out2[i_if:i_end].split('\n')[1:]
ok(all(not b.strip() for b in between),
   '★ control_if 與 END 之間要真的空白（鐵律就是這樣判的）')

# 迴圈也要收尾
blocks3 = {
    'hat': {'opcode': 'event_whenflagclicked', 'topLevel': True,
            'parent': None, 'next': 'rep'},
    'rep': {'opcode': 'control_repeat', 'topLevel': False, 'parent': 'hat',
            'next': None, 'inputs': {'TIMES': [1, [6, '10']]}},
}
ok('END control_repeat' in parse_chain('hat', 0, blocks3),
   '空的重複積木一樣要有 END')

# ═══════════════════════════════════════════════════════════
section('B-3 擴充的動作積木拖在旁邊，不可以算成執行序列')
# ═══════════════════════════════════════════════════════════
raw = {'targets': [{
    'name': '角色1', 'isStage': False,
    'costumes': [{'name': 'a'}, {'name': 'b'}], 'sounds': [],
    'variables': {}, 'lists': {},
    'blocks': {
        'hat': {'opcode': 'event_whenflagclicked', 'topLevel': True,
                'parent': None, 'next': None},
        # ⚠️ 這兩個含底線但**不是帽子** —— 以前會被當成合法執行序列
        'stamp': {'opcode': 'pen_stamp', 'topLevel': True,
                  'parent': None, 'next': None},
        'note': {'opcode': 'music_playNoteForBeats', 'topLevel': True,
                 'parent': None, 'next': None,
                 'inputs': {'NOTE': [1, [4, '60']], 'BEATS': [1, [4, '0.25']]}},
    }}]}
out3 = clean_json(raw)

# ⚠️ 不可以用 out3.find('pen_stamp') 判位置：它在前面的
#    「平台原生擴充積木說明」區塊也出現過一次，find 抓到的是那一個。
i_orphan = out3.find('【孤兒積木警告】')
ok(i_orphan >= 0, '要有孤兒積木警告')
head, tail = out3[:i_orphan], out3[i_orphan:]
ok('pen_stamp' in tail, 'pen_stamp 要歸為孤兒')
ok('music_playNoteForBeats' in tail, 'music_playNoteForBeats 要歸為孤兒')
ok(head.count('▶ 執行序列') == 1,
   '★ 合法執行序列只剩綠旗那一條（實際 %d 條）'
   % head.count('▶ 執行序列'))
ok('event_whenflagclicked' in head, '綠旗仍然是合法帽子')

# ★ 擴充積木的**帽子**不可以被誤殺
raw2 = {'targets': [{
    'name': '角色1', 'isStage': False, 'costumes': [{'name': 'a'}],
    'sounds': [], 'variables': {}, 'lists': {},
    'blocks': {
        'h1': {'opcode': 'videoSensing_whenMotionGreaterThan',
               'topLevel': True, 'parent': None, 'next': None},
        'h2': {'opcode': 'gandi_iot_whenReceived',
               'topLevel': True, 'parent': None, 'next': None},
        'h3': {'opcode': 'makeymakey_whenMakeyKeyPressed',
               'topLevel': True, 'parent': None, 'next': None},
    }}]}
out4 = clean_json(raw2)
ok('【孤兒積木警告】' not in out4,
   '★ 擴充積木的帽子（帶 when）不可以被誤殺')
ok(out4.count('▶ 執行序列') == 3, '三個擴充帽子都算合法執行序列')

# ═══════════════════════════════════════════════════════════
section('三個坑不可以再長回來（釘住原始碼的形狀）')
# ═══════════════════════════════════════════════════════════
nb_src = io.open(NB, encoding='utf8').read()
# ⚠️ 這兩條比對的是**帶跳脫的 JSON 文字**（ipynb 裡的程式碼長這樣：
#    `elif \\"_when\\" in opcode:`）。檔案裡的中文註解不會出現這種形狀，
#    所以不必先剝註解 —— 「註解自傷」那個坑在這裡踩不到。
ok('elif \\"_when\\" in opcode' in nb_src,
   '★ 擴充帽子是靠 when 判斷，不是「有沒有底線」')
ok('SUBSTACK2\\" in substacks and opcode ==' not in nb_src,
   '★ SUBSTACK2 不可以再和 SUBSTACK 綁在同一個 if 底下')

print('\n通過 %d／失敗 %d' % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
