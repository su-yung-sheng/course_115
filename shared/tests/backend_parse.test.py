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


def okc(fn, label):
    """斷言「呼叫本身可能拋例外」的情況。

    ⚠️⚠️ 2026-08-26 的突變測試抓到：直接寫 ok(f(x) == y, ...) 的話，
       f(x) 一拋例外就會**中斷整支測試** —— 後面的斷言全部沒跑，
       stdout 也不會出現任何 ❌。於是突變測試看起來「沒紅」，
       我差點以為那條斷言沒作用。
       ⇒ 呼叫包起來：例外一律算失敗，並把例外內容印出來。
    """
    try:
        ok(bool(fn()), label)
    except Exception as e:                      # noqa: BLE001
        ok(False, label + '（拋例外 %s: %s）' % (type(e).__name__, e))


def section(t):
    print('\n── ' + t + ' ──')


def load_funcs(marker='def parse_chain_recursive', want=None):
    """把 notebook 裡的目標函式原始碼抽出來 exec，回傳命名空間。

    marker 用來挑 cell（notebook 有兩個大 cell：批改核心、API 伺服器），
    want 是要抽哪幾支；不給就用預設的 WANT。
    """
    want = want or WANT
    nb = json.load(io.open(NB, encoding='utf8'))
    src = None
    for cell in nb['cells']:
        body = ''.join(cell.get('source', []))
        if marker in body:
            src = body
            break
    if src is None:
        print('❌ backend.ipynb 裡找不到 ' + marker + ' —— '
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
        if name not in want:
            continue
        j = starts[k + 1][1] if k + 1 < len(starts) else len(lines)
        chunks.append('\n'.join(lines[i:j]))
        found.add(name)

    missing = [w for w in want if w not in found]
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
# ⚠️⚠️ 一定要比對**還原後**的原始碼，不可以直接讀檔案文字。
#    ipynb 是 JSON，程式碼裡的 " 在檔案裡長成 \" ——
#    拿 `result.get("ok")` 這種字串去比對原始檔案永遠找不到，
#    而否定斷言（`X not in src`）會因此變成**永遠通過的假保護**。
#    ⇒ 用 json 解析、把 cell 的 source 拼回來，那才是真正的 Python 文字。
NB_CODE = '\n'.join(''.join(c.get('source', []))
                    for c in json.load(io.open(NB, encoding='utf8'))['cells'])

# ⚠️⚠️ **否定斷言**（`X not in …`）一律用這一份，不要用 NB_CODE。
#    我在註解裡寫了「寫成 `not result.get("ok")` 會把成功的也擋掉」，
#    測試就抓到自己的註解 —— 這個 repo 的老坑：註解自傷。
#    釘的是「程式碼不可以長這樣」，那就不該去看註解怎麼說。
NB_NOTE_FREE = '\n'.join(l for l in NB_CODE.split('\n')
                         if not l.strip().startswith('#'))
ok('elif "_when" in opcode' in NB_CODE,
   '★ 擴充帽子是靠 when 判斷，不是「有沒有底線」')
ok('"SUBSTACK2" in substacks and opcode ==' not in NB_NOTE_FREE,
   '★ SUBSTACK2 不可以再和 SUBSTACK 綁在同一個 if 底下')

# ═══════════════════════════════════════════════════════════
section('C-1 巢狀條件不可以被截斷成殘缺的括號')
# ═══════════════════════════════════════════════════════════
# 「重複直到（碰到邊緣 且 按下空白鍵）」—— 條件是兩層巢狀
blocks4 = {
    'hat': {'opcode': 'event_whenflagclicked', 'topLevel': True,
            'parent': None, 'next': 'u'},
    'u': {'opcode': 'control_repeat_until', 'topLevel': False, 'parent': 'hat',
          'next': None, 'inputs': {'CONDITION': [2, 'and'], 'SUBSTACK': [2, 'mv']}},
    'and': {'opcode': 'operator_and', 'topLevel': False, 'parent': 'u',
            'inputs': {'OPERAND1': [2, 't1'], 'OPERAND2': [2, 't2']}},
    't1': {'opcode': 'sensing_touchingobject', 'topLevel': False, 'parent': 'and',
           'inputs': {'TOUCHINGOBJECTMENU': [1, 'm1']}},
    'm1': {'opcode': 'sensing_touchingobjectmenu', 'topLevel': False,
           'parent': 't1', 'fields': {'TOUCHINGOBJECTMENU': ['_edge_', None]}},
    't2': {'opcode': 'sensing_keypressed', 'topLevel': False, 'parent': 'and',
           'inputs': {'KEY_OPTION': [1, 'm2']}},
    'm2': {'opcode': 'sensing_keyoptions', 'topLevel': False, 'parent': 't2',
           'fields': {'KEY_OPTION': ['space', None]}},
    'mv': {'opcode': 'motion_movesteps', 'topLevel': False, 'parent': 'u',
           'next': None, 'inputs': {'STEPS': [1, [4, '10']]}},
}
out5 = parse_chain('hat', 0, blocks4)
ok('_edge_' in out5, '★ and 的第一個條件（碰到邊緣）要看得到')
ok('space' in out5,
   '★ and 的**第二個**條件（按下空白鍵）也要看得到 —— 以前被切掉了')
cond_line = [r for r in out5.split('\n') if 'CONDITION' in r][0]
ok(cond_line.count('[') == cond_line.count(']'),
   '★ 條件的括號要成對（殘缺的括號會讓 AI 更難判讀）')

# 真的過長時要明講被截斷，不可以安靜切掉
long_blocks = {'hat': {'opcode': 'looks_say', 'topLevel': True, 'parent': None,
                       'next': None,
                       'inputs': {'MESSAGE': [1, [10, 'x' * 900]]}}}
out6 = parse_chain('hat', 0, long_blocks)
ok('過長已截斷' in out6 or len(out6) < 200,
   '★ 真的過長時要留下「被截斷」的痕跡，不要安靜切掉')

# ═══════════════════════════════════════════════════════════
section('C-2 系統故障不可以變成學生的 0 分')
# ═══════════════════════════════════════════════════════════
ok('"score": 0, "comments": f"系統異常' not in NB_NOTE_FREE,
   '★ 例外處理不可以再回 score: 0')
ok('"deducted_items": "讀檔失敗"' not in NB_NOTE_FREE,
   '★ 讀檔失敗也不可以記成 0 分')
ok('if result.get("ok") is False or result.get("score") is None:' in NB_CODE,
   '★ record_submission 要擋掉沒評成功的那一筆')
ok(NB_CODE.count('if result.get("ok") is False:') >= 1,
   '★ API 端點要把故障回成 ok:False（前端的 if(!j.ok) 才擋得到）')
# ⚠️ 成功時這個 dict 根本沒有 ok 欄位，寫成 not result.get("ok")
#    會把成功的那些也一起擋掉 —— 釘住「用 is False 比對」。
ok('not result.get("ok")' not in NB_NOTE_FREE,
   '★ 要用 `is False` 明確比對，不可以用 `not ...`（成功時沒有 ok 欄位）')

# ═══════════════════════════════════════════════════════════
section('C-3 學生程式碼要真的被標籤包起來')
# ═══════════════════════════════════════════════════════════
ok('<STUDENT_CODE>' in NB_CODE and '</STUDENT_CODE>' in NB_CODE,
   '★ 開頭和結尾標籤都要有')
ok('user_input_safe = f"[受測代碼]' not in NB_NOTE_FREE,
   '★ 不可以退回「只加一行文字、沒有標籤」的舊寫法')
# G 條裡的標籤名稱要和程式碼實際用的一致，
# 不然 AI 被交代「不要聽標籤內的指令」卻不知道界線在哪。
g_line = [l for l in NB_CODE.split('\n') if '強制包覆' in l or '包在 <STUDENT_CODE>' in l]
ok(bool(g_line) and 'STUDENT_CODE' in g_line[0],
   '★ G 條裡要寫出標籤名稱（以前那兩個位置是空的）')

# ═══════════════════════════════════════════════════════════
section('★★ 護欄：評分規則的七條鐵律不可以被動到')
# ═══════════════════════════════════════════════════════════
# ⚠️ 老師 2026-08-26：「這個批改的對象是 scratch 程式，不要改動到重要概念」。
#    上面修的都是**管線層**（怎麼把 .sb3 印成虛擬碼、故障怎麼處理、
#    怎麼包標籤）。評分規則的內容、配分、判斷標準一個字都不該動。
#    ⇒ 這一節就是那條線的護欄。
for tag, name in [('A.', '孤兒積木與測試工具豁免鐵律'),
                  ('B.', '空條件判斷鐵律'),
                  ('C.', '分身效能鐵律'),
                  ('D.', '變數作用域鐵律'),
                  ('E.', '替代方案積木鐵律'),
                  ('F.', '命名自由鐵律'),
                  ('G.', '惡意指令隔離鐵律')]:
    # ⚠️ 用剝註解版：我在 backend.ipynb 的修復註解裡引用過 B 條的判準，
    #    拿含註解的文字去比對，等於自己的註解讓斷言永遠成立。
    ok(name in NB_NOTE_FREE, '鐵律 ' + tag + ' ' + name + ' 還在')

# ⚠️ 只釘標題是不夠的 —— 標題留著、內文改掉，測試照樣綠。
#    2026-08-26 的突變測試就是這樣抓到的：我把 B 條的判準換成
#    「請自行判斷」，七條鐵律的標題全在，一條都沒紅。
#    ⇒ 每條鐵律要連**判準本身**一起釘。
for phrase, why in [
    ('control_if 和 END control_if 之間沒有任何積木', 'B 條的判準（B-2 修復就靠這句）'),
    ('必須同時檢查其 SUBSTACK', 'B 條要求連內部序列一起看'),
    ('孤兒積木警告', 'A 條靠這個標記判斷'),
    ('鼓勵多元演算法', '不同寫法只要邏輯對就給滿分'),
    ('加分題「絕對不扣分」原則', '加分題不可以變成扣分項'),
    ('必須找到 control_delete_this_clone', '刪除分身才算，隱藏不算'),
    ('都是**學生自己取的**', '名稱和參考解答不同不可以扣分'),
    ('功能是否達成」優先於「積木來源是否正確', '原生積木替代擴充算等效'),
]:
    ok(phrase in NB_NOTE_FREE, '評分標準沒被動到：' + why)

# ═══════════════════════════════════════════════════════════
section('C-4 OCR 結果解析：2.x／3.x 兩種格式都要吃得下')
# ═══════════════════════════════════════════════════════════
# ⚠️ 2026-08-26：Colab 升到 Python 3.13，舊的 paddle 組合再也裝不起來，
#    被迫升到 paddleocr 3.x —— 而 3.x 的回傳格式和 2.x 完全不同。
#    不改解析器的話會變成「套件裝起來了，但一個字都撈不到」，
#    學生每次都判定不通過，卻找不到任何錯誤訊息。
_srv = load_funcs(marker='def _ocr_texts', want=('_ocr_texts',))
ocr_texts = _srv['_ocr_texts']

# 3.x：[OCRResult]，文字在 rec_texts
three = [{'rec_texts': ['跳格子', '挑戰成功']}]
okc(lambda: ocr_texts(three) == ['跳格子', '挑戰成功'],
    '★ 吃得下 3.x 的 rec_texts')

# 2.x：[[ [box, (text, score)], ... ]]
two = [[[[[0, 0], [9, 0], [9, 9], [0, 9]], ('跳格子', 0.99)],
        [[[0, 9], [9, 9], [9, 18], [0, 18]], ('挑戰成功', 0.98)]]]
okc(lambda: ocr_texts(two) == ['跳格子', '挑戰成功'],
    '★ 吃得下 2.x 的巢狀 list')

okc(lambda: ocr_texts([]) == [] and ocr_texts(None) == [], '空結果回空清單')

# 3.x 多頁：兩個 OCRResult 要合起來
okc(lambda: ocr_texts([{'rec_texts': ['甲']}, {'rec_texts': ['乙']}]) == ['甲', '乙'],
    '3.x 多個結果要合併')

# ⚠️⚠️ 最重要的一條：不認得的形狀**不可以安靜回空清單**。
#    回空的話判定會變成「沒通過」，學生以為是自己截圖沒截好，
#    而真正的原因（格式又變了）沒有任何人看得到。
_raised = False
try:
    ocr_texts([42])
except Exception:
    _raised = True
ok(_raised, '★★ 看不懂的格式要丟例外，不可以安靜回空清單')

# ── 安裝清單不可以退回裝不起來的舊組合 ──────────────────
_inst = ''.join(json.load(io.open(NB, encoding='utf8'))['cells'][4]['source'])
_inst_code = '\n'.join(l for l in _inst.split('\n') if not l.strip().startswith('#'))
ok('numpy<2' not in _inst_code,
   '★ 安裝清單不可以再限制 numpy<2（Python 3.13 上無解）')
ok('paddlepaddle>=3' in _inst_code and 'paddleocr>=3' in _inst_code,
   '★ 用 paddle 3.x（有 Python 3.13 的 wheel，且吃 numpy 2.x）')
ok('--only-binary=:all:' in _inst_code,
   '★★ 只裝預編譯 wheel —— 沒有就報錯，不要安靜編譯二十分鐘')
ok('do_shutdown' not in _inst_code,
   '★ 不再需要「自動重啟核心」那一段（numpy 衝突的根源已消失）')

# ── 啟動格不可以讓 OCR 擋住批改 ──────────────────────────
_boot = ''.join(json.load(io.open(NB, encoding='utf8'))['cells'][10]['source'])
_boot_code = '\n'.join(l for l in _boot.split('\n') if not l.strip().startswith('#'))
ok('raise RuntimeError' not in _boot_code,
   '★★ 啟動格不可以因為 OCR 沒就緒就 raise（會連批改一起停擺）')
ok('paddleocr' not in _boot_code.split('import importlib')[0],
   '★ 啟動格的 pip 不可以再裝 PaddleOCR（否則拆格白做）')

# ═══════════════════════════════════════════════════════════
section('C-5 「重啟執行階段」這個建議不可以再出現')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-08-26 老師回報：「numpy 版本：2.1.3 ❌ numpy 是 2.x →
#    重新啟動執行階段 → 全部執行」，照做第二次還是同一行。
#    ★ 因為 paddle 3.x **本來就要** numpy 2.x —— 重啟一百次也不會變 1.x。
#      這個建議在升級之後永遠是錯的，而錯的建議比沒建議更糟。
#    ⚠️ 我當時改了三處（安裝格、啟動格、/analyze），
#       卻漏掉第四處（步驟 5 的自我測試）和第五處（health 的 ocr_note）——
#       同一個概念散落多處，改一半是這個 repo 反覆出現的毛病。
#    ⇒ 用測試把整份 notebook 一次掃過，以後不必靠記性。
_nb_cells = json.load(io.open(NB, encoding='utf8'))['cells']


def _code_of(cell):
    """只取程式碼行（剝掉整行註解）—— 註解裡會提到這些字是正常的。"""
    return '\n'.join(l for l in ''.join(cell.get('source', [])).split('\n')
                      if not l.strip().startswith('#'))


_all_code = '\n'.join(_code_of(c) for c in _nb_cells)
# ⚠️⚠️ 這一條原本寫成「不可以出現『重新啟動執行階段』」——
#    用字串比對代替了意圖，結果把**正當**的重啟建議也擋掉了：
#    關 oneDNN 的 FLAGS_use_mkldnn 必須在 paddle 載入前生效，
#    那種情況下叫人重啟是對的。
#    ⇒ 要禁的其實是「把 numpy 2.x 當成錯誤」這個**主張**，
#      不是「重啟」這個動作。
_bad_np = [l.strip() for l in _all_code.split('\n')
           if 'numpy' in l
           and ('需要 1.x' in l
                or ('是 2.x' in l and 'paddleocr' not in l))]
ok(not _bad_np,
   '★★ 不可以把「numpy 是 2.x」當成錯誤（paddle 3.x 要的就是 numpy 2.x）'
   + ('　←　' + _bad_np[0][:60] if _bad_np else ''))
ok('需要 1.x' not in _all_code,
   '★ 不可以再宣稱 PaddleOCR「需要 numpy 1.x」（paddle 3.x 要的是 2.x）')
# ★ 唯一合法的 numpy 判斷：paddleocr 2.x 配 numpy 2.x 才是壞組合。
ok('paddleocr' in _all_code and 'enable_mkldnn' in _all_code,
   '★ oneDNN 要被關掉（paddle 3.x 的 PIR 執行器在那條路徑上會爆）')

# 步驟 5 的自我測試必須**真的跑**，不可以被版本檢查擋在門外
_self = _code_of(_nb_cells[12])
ok('ocr_run' in _self, '★ 自我測試要真的呼叫 ocr_run')
ok('_ocr_texts' in _self,
   '★★ 自我測試要順便驗解析器 ——「跑得動」和「撈得到字」是兩件事')
# ⚠️ 以前測試主體整個寫在 `if numpy>=2: … else: <測試>` 的 else 裡，
#    numpy 一是 2.x 就完全不執行。釘住：ocr_run 不可以縮在那種分支底下。
_lines = _self.split('\n')
_i_run = next(k for k, l in enumerate(_lines) if 'ocr_run' in l)
_guard = [l for l in _lines[:_i_run]
          if l.strip().startswith('if ') and 'numpy' in l.lower()]
ok(not _guard, '★★ 自我測試不可以被 numpy 版本判斷擋住（' +
   (_guard[0].strip()[:50] if _guard else '無') + '）')

print('\n通過 %d／失敗 %d' % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
