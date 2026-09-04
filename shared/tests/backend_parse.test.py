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

# ⚠️⚠️ Windows 的繁中主控台預設是 cp950，**編不出 ✅ ❌ ⚠️ 這些字元**。
#    印一個勾勾就 UnicodeEncodeError → 整支 crash → 離開碼非 0，
#    而 check.py 的 check_py_tests() 只看離開碼 —— 它會回報成
#    「這支測試沒過」，於是 **pre-commit 取消提交**。
#    ★ 老師看到的是「提交前檢查 檢查沒過」，完全看不出是「印字印掛了」。
#    ⚠️ check.py 自己早就這樣修過（見那支開頭的說明），但它是用
#      subprocess 跑這些測試的，**子程序不會繼承那個修正**，要各自修。
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass          # 舊 Python 沒有 reconfigure；印不出來也不該中斷檢查

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

# ═══════════════════════════════════════════════════════════
section('C-6 老師 2026-08-26 在 Colab 實測後的修正，不可以退回去')
# ═══════════════════════════════════════════════════════════
_srv_code = _code_of(_nb_cells[8])
_inst_code2 = _code_of(_nb_cells[4])

# ① 版本要鎖上界：這個後端是針對 3.x 的 predict()/OCRResult 驗證過的，
#    Colab 自動升到 4.x 之後 API 可能又改，屆時會變成安靜的解析失敗。
ok('paddlepaddle>=3.0,<4' in _inst_code2 and 'paddleocr>=3.0,<4' in _inst_code2,
   '★ paddle／paddleocr 要鎖在 3.x（<4），不要跟著升未驗證的主版本')

# ② 3.x 的正式介面是 predict()；ocr() 只當舊版回退。
ok('predict' in _srv_code and 'hasattr(_ocr_model, "predict")' in _srv_code,
   '★ 優先用 predict()，ocr() 保留為 2.x 回退')

# ③ 指定 PP-OCRv5：不指定的話，Colab 更新後預設模型會漂。
ok('PP-OCRv5' in _srv_code, '★ 明確指定 ocr_version，避免模型預設值漂移')

# ④⚠️⚠️ ngrok 的 stop：官方 API 除了路徑上的 id，**本文也必須帶 id**。
#    原本送空 POST —— 看起來有「自動清除舊連線」這個功能，
#    實際上可能從未成功對舊 agent 發出停止指令。
#    這正是這個 repo 最典型的病灶：壞掉和正常長得一模一樣。
ok('{"id": sid}' in _srv_code,
   '★★ ngrok stop 要帶 body {"id": sid}（空 POST 會安靜地什麼都沒做）')
ok('detail or e.reason' in _srv_code,
   '★ ngrok 的 HTTP 400 要把原文讀出來（只印「HTTP 400」查不出哪裡錯）')

# ⑤ 解析器仍然是所有辨識的唯一入口 —— 兩階段 ROI 改寫之後也要維持。
ok(_srv_code.count('_ocr_texts(') >= 2,
   '★ 兩階段辨識都要經過 _ocr_texts（格式相容的唯一入口）')

# ═══════════════════════════════════════════════════════════
section('C-7 兩段 ROI 要蓋得住老師實際截圖的位置')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-08-26 老師回報：明明選了「水餃工廠」卻判「關卡名稱不符合」。
#    量測他四張截圖後找到原因：兩階段優化把裁切框縮得太小。
#      ‧ 分頁標題「水餃工廠」字高只有 13～14px（整張圖最小的字），
#        分頁一多還會被 Chrome 截成「水餃工…」。
#      ‧ 舊版掃 20% 高 × 70% 寬，**網址列在範圍內** ——
#        網址含 portioned-dumplings 這種英文關卡名，是 eng 的來源，
#        中文讀不清時靠它兜底。
#      ‧ 新版縮到 4% 高 × 25% 寬，兜底整條被切掉。
#    ⇒ 用他真實截圖的座標當測資，數字改動就會被擋下來。
_roi = re.search(r'level_roi = _crop\(([\d.,\s]+)\)', _srv_code)
_sroi = re.search(r'success_roi = _crop\(([\d.,\s]+)\)', _srv_code)
ok(bool(_roi and _sroi), '★ 兩段 ROI 都找得到')

if _roi and _sroi:
    lx0, ly0, lx1, ly1 = [float(v) for v in _roi.group(1).split(',')]
    sx0, sy0, sx1, sy1 = [float(v) for v in _sroi.group(1).split(',')]
    # (名稱, 寬, 高, 網址列, 分頁標題, 挑戰成功徽章)  ← 目測自老師的截圖
    SHOTS = [
        ('視窗模式 1024x833', 1024, 833,
         (250, 38, 420, 55), (30, 9, 135, 22), (455, 168, 625, 205)),
        ('全螢幕 1920x1032', 1920, 1032,
         (310, 30, 450, 50), (28, 5, 120, 19), (875, 190, 1045, 222)),
    ]
    for name, W, H, url, title, badge in SHOTS:
        ok(title[2] <= W * lx1 and title[3] <= H * ly1,
           '★ %s：分頁標題在第一段框內' % name)
        ok(url[2] <= W * lx1 and url[3] <= H * ly1,
           '★★ %s：**網址列**也要在框內（中文讀不清時的唯一兜底）' % name)
        ok(badge[0] >= W * sx0 and badge[2] <= W * sx1
           and badge[1] >= H * sy0 and badge[3] <= H * sy1,
           '★ %s：挑戰成功徽章在第二段框內' % name)

# ⚠️ 13px 的字放 1.5 倍才 20px，PaddleOCR 辨識率很低。
# ⚠️⚠️ 這一條原本寫「起跳倍率至少 2.5」，用字串比對 ——
#    而**回退**倍率也是 2.5，所以把起跳降成 1.5 之後測試照樣綠。
#    典型的假通過。⇒ 改成分別抓兩個倍率、比較它們的關係。
# ★ 而且 2026-08-26 的實測推翻了原本的理由：
#      2.5 倍 0.68 MP → 26.9 秒；1.5 倍 0.24 MP → 16.1 秒
#    1.5 倍時中文只錯一字，靠網址兜底仍然判得過 ⇒ 降倍率是划算的。
#    真正要守住的不是某個數字，而是「回退倍率一定比起跳大」。
_scales = [float(x) for x in
           re.findall(r'_ocr_scaled\(level_roi, ([0-9.]+)\)', _srv_code)]
ok(len(_scales) == 2,
   '★ 第一段要有「起跳 ＋ 回退」兩種倍率（找到 %s）' % _scales)
ok(len(_scales) == 2 and _scales[1] > _scales[0],
   '★★ 回退倍率要比起跳大（目前 %s → %s）'
   % (_scales[0] if _scales else '?', _scales[1] if len(_scales) > 1 else '?'))

# ⚠️⚠️ 2026-08-26 實測：一張「本來就判不過」的截圖，
#    第一發 1.5 倍沒中、回退 2.5 倍也沒中，整整 49.24 秒 ——
#    而 2.5 倍正是改動前的設定，所以那 30 秒完全是白跑的。
#    ★ 而截錯關的學生本來就要重截，讓他等 49 秒比等 19 秒更沒道理。
#    ⇒ 回退前要先看「第一發讀到了什麼」：
#      讀到一長串字卻不匹配 → 真的是別關，再放大也一樣 ⇒ 不回退。
ok('_seen_len' in _srv_code and 'if _seen_len <' in _srv_code,
   '★★ 回退前要先看第一發讀到多少字，不可以無條件重試')
_thr_len = re.findall(r'if _seen_len < (\d+):', _srv_code)
ok(bool(_thr_len) and 5 <= int(_thr_len[0]) <= 30,
   '★ 門檻要落在合理範圍（目前 %s；1.5 倍正常會讀到三十幾個字元）'
   % (_thr_len[0] if _thr_len else '找不到'))

# ⚠️ 只說「關卡名稱不符合」的話，沒有人知道問題出在哪。
# ⚠️⚠️ 2026-09-02 更新：原本釘的是「系統在截圖上緣讀到」這句字面。
#    那句話**只是把 OCR 的原始輸出丟給學生**，老師回報學生看到
#    「偵測到 Ddd…」的亂碼 —— 有講出讀到什麼，但沒有下一步。
#    ⇒ 現在改釘「有沒有給可行動的指引」（細節見 C-13）。
#      這裡只保留最低要求：原始文字仍然看得到（給老師稽核用）。
ok('系統讀到' in _srv_code and '一個字都沒讀到' in _srv_code,
   '★★ 關卡不符時仍要看得到系統讀到什麼（老師稽核用）')

# ═══════════════════════════════════════════════════════════
section('C-8 十關交叉驗證：自己要中、別關不可以中')
# ═══════════════════════════════════════════════════════════
# ⚠️ 老師 2026-08-26：「其他關卡尚未大規模測試，能預先防止嗎？」
#    ★ 可以，而且**不需要 OCR** —— 判定邏輯是純函式，
#      把十關的真實關鍵字餵進去交叉跑一遍就知道會不會互相誤中。
#      這支測試每次提交都會跑，等於在災情發生前先掃一遍。
_lv = load_funcs(marker='def _level_matched',
                 want=('_norm_text', '_ordered_match', '_level_matched'))
_norm, _matched = _lv['_norm_text'], _lv['_level_matched']

# 十關的中文名與英文名（取自 11501/thinking.html，不是我編的）
LEVELS = [
    ('跳格子', 'number hopscotch'), ('任意門', 'dokodemo door'),
    ('滑梯公園', 'slide park'), ('水餃工廠', 'portioned dumplings'),
    ('無括號計算機', 'bracketless calculator'), ('遊覽車共乘', 'bus sharing'),
    ('扭蛋轉轉樂', 'spinning gacha'), ('換零錢機', 'exchange machine'),
    ('打地鼠', 'whac mole'), ('拔蘿蔔', 'carrot harvest'),
]

# 每一關的英文名正規化後都要夠長 —— 新規則用 len>=6 當「可單獨成立」的門檻
_short = [(c, e) for c, e in LEVELS if len(_norm(e)) < 6]
ok(not _short, '★ 十關的英文名都夠長，可以當單獨證據' +
   ('　←　太短：%s' % _short if _short else ''))

# ① 自己那一關一定要中（模擬 OCR 讀到分頁標題＋網址）
_self_fail = []
for ch, en in LEVELS:
    seen = ['%s - Google Chrome' % ch,
            'adl.edu.tw/modules/New_CR/ntnu/%s-benjamin-release/index.html'
            % en.replace(' ', '-')]
    if not _matched(seen, _norm(ch), _norm(en)):
        _self_fail.append(ch)
ok(not _self_fail, '★★ 十關各自都判得中' +
   ('　←　沒中：%s' % '、'.join(_self_fail) if _self_fail else ''))

# ②⚠️ 最重要：**別關的截圖不可以判成這一關**。
#    英文名可以單獨成立之後，這條就是防誤放的唯一防線。
_cross = []
for i, (ch_i, en_i) in enumerate(LEVELS):
    seen = ['%s - Google Chrome' % ch_i,
            'adl.edu.tw/modules/New_CR/ntnu/%s-benjamin-release/index.html'
            % en_i.replace(' ', '-')]
    for j, (ch_j, en_j) in enumerate(LEVELS):
        if i == j:
            continue
        if _matched(seen, _norm(ch_j), _norm(en_j)):
            _cross.append('%s 的截圖被判成 %s' % (ch_i, ch_j))
ok(not _cross, '★★ 十關兩兩交叉共 90 組，不可以互相誤中' +
   ('　←　%s' % '；'.join(_cross[:3]) if _cross else ''))

# ③ OCR 誤辨的容錯：中文整個讀壞，但網址完整 → 仍要過
#    （這正是「滑梯公園」失敗率高的情境）
ok(_matched(['滑棒公圈 - Google Chrome',
             'adl.edu.tw/.../slide-park-benjamin-release/index.html'],
            _norm('滑梯公園'), _norm('slide park')),
   '★★ 中文讀壞兩個字、但網址完整時要通過（滑梯公園那個災情）')

# ④ 中文完整、網址沒讀到 → 也要過
ok(_matched(['滑梯公園 - Google Chrome'], _norm('滑梯公園'), _norm('slide park')),
   '★ 只讀到中文標題也要過')

# ⑤⚠️ 什麼都沒讀到 → 一定不可以過
ok(not _matched([], _norm('滑梯公園'), _norm('slide park')),
   '★★ 一個字都沒讀到時不可以放行')
ok(not _matched(['一些不相干的字'], _norm('滑梯公園'), _norm('slide park')),
   '★★ 讀到不相干的字也不可以放行')

# ═══════════════════════════════════════════════════════════
section('C-9 判定的容錯與假陽性（加速之前要先知道能犧牲什麼）')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 老師 2026-08-26：「精準度降低會影響結果嗎？挑戰成功的準確判斷
#    或是關卡名稱的判斷？」
#    ★ 兩者的結構完全不同，這一節就是把差別釘下來：
#        關卡名稱 → 三條路（中文／網址／兩者合計），**網址可以單獨成立**
#        挑戰成功 → **只有一條路**，沒有任何兜底
#      所以「降精度換速度」只能動關卡那一塊，不能動徽章那一塊。
_ns2 = load_funcs(marker='def _level_matched',
                  want=('_norm_text', '_ordered_match', '_level_matched'))
_nt, _om, _lm = _ns2['_norm_text'], _ns2['_ordered_match'], _ns2['_level_matched']
_SUCCESS = _nt('挑戰成功')

# ── 真的過關：容錯要夠（OCR 小字錯一個是常態）──────────
for txt, note in [('挑戰成功', '正確'), ('挑戰成㓛', '錯1字'),
                  ('桃戰成功', '錯1字'), ('挑戰成攻', '錯1字')]:
    ok(_om(_SUCCESS, _nt(txt), 0.75),
       '★ 真的過關要判得過：%s（%s）' % (txt, note))

# ──⚠️⚠️ 假陽性：沒過卻判過，是這裡最嚴重的錯誤 ─────────
#    白給一顆星，而且事後看不出來。
for txt, note in [('挑戰失敗', '真的沒過'), ('挑戰中', '還在進行'),
                  ('挑戰失政', '錯2字'), ('尚可挑戰次數3', '畫面上的其他字'),
                  ('', '什麼都沒讀到')]:
    ok(not _om(_SUCCESS, _nt(txt), 0.75),
       '★★ 沒過就不可以判過：%s（%s）' % (txt or '(空)', note))

# ── 關卡名稱：網址是兜底，中文讀壞也要能過 ──────────────
_ti, _en = _nt('滑梯公園'), _nt('slide park')
ok(_lm(['滑梯公園 - Google Chrome'], _ti, _en), '★ 中文正確要過')
ok(_lm(['滑棒公圈', 'adl.edu.tw/x/slide-park-benjamin-release/'], _ti, _en),
   '★★ 中文錯兩字但網址完整 → 要過（這就是兜底）')
ok(_lm(['', 'adl.edu.tw/x/slide-park-benjamin-release/'], _ti, _en),
   '★★ 中文完全沒讀到、只剩網址 → 仍要過')
ok(not _lm(['滑棒公圈 - Google Chrome'], _ti, _en),
   '★ 中文錯兩字又沒有網址 → 不過（沒有證據就不能放行）')
ok(not _lm(['水餃工廠 - Google Chrome', 'x/portioned-dumplings-y/'], _ti, _en),
   '★★ 截到別關不可以判成這一關')

# ──★ 加速的界線：這兩塊不可以被綁在一起用同一套處理 ──────
#    ⚠️ 關卡那塊有兜底，可以為了速度降倍率或換輕模型；
#       徽章那塊只有一條路，降了就是「學生過關卻被判沒過」。
#       任何把兩塊合成一次辨識的做法，都要保留「各自的放大倍率」。
_srv_src = ''.join(json.load(io.open(NB, encoding='utf8'))['cells'][8]['source'])
ok('_crop(0.38, 0.12, 0.68, 0.30)' in _srv_src,
   '★ 徽章的取樣範圍維持不變（老師實測過的框）')
# ⚠️ 這一條原本只檢查「檔案裡有 0.75 這個字串」——太寬，
#    把 has_success 的門檻改成 0.40 測試照樣綠（別處也有 0.75）。
#    ⇒ 要精確釘住**那一行**。
# ⚠️ 不可以用 [^)]* —— 參數裡的 _norm_text("".join(...)) 有括號，
#    會把比對提前截斷，結果「找不到那一行」而永遠判紅。
#    ⇒ 逐行找，抓那一行最後一個數字。
_thr = [re.findall(r'([0-9]*\.[0-9]+)', ln)[-1]
        for ln in _srv_src.split('\n')
        if 'has_success = _ordered_match' in ln and re.search(r'[0-9]\.[0-9]', ln)]
ok(bool(_thr) and all(float(t) >= 0.70 for t in _thr),
   '★★ 挑戰成功的門檻不可以低於 0.70（實測：0.50 就會把「挑戰失敗」判成過關）'
   + ('　←　目前 %s' % _thr if _thr else '　←　找不到那一行'))

# ═══════════════════════════════════════════════════════════
section('C-10 判讀不可以把「故意的錯圖」算成「倍率不夠」')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-08-26：老師回報 avg_level_attempts=1.5，看起來正是我
#    預先設的警告線（「第一發常沒中 → 把倍率調回去」）。
#    ★ 但老師接著說：「那是我故意上傳錯誤圖片的。」
#      —— 關卡沒對上的截圖**必然跑滿重試**（本來就找不到，
#      放大幾次都一樣）。拿它評估倍率＝用失敗樣本算成功率，
#      得到的結論會剛好相反：真正該說的是「倍率不用動」。
#    ⚠️ 這個坑很陰險：數字沒錯、判讀邏輯也沒錯，
#      錯在**分母裡混進了不該算的樣本**。
_V = load_funcs(marker='def ocr_stats_verdict',
                want=('ocr_stats_verdict',))['ocr_stats_verdict']

_row_bad = {"avg_level_attempts": 1.5, "avg_level_attempts_ok": 1.0,
            "ok_count": 1, "wrong_level_count": 1,
            "avg_success_attempts": 1.0, "avg_decode": 3.0,
            "avg_level": 34.05, "avg_success": 5.0, "avg_total": 42.29}
_said = ' '.join(_V(_row_bad))
ok('倍率不用動' in _said,
   '★★ 兩張裡一張是故意的錯圖 → 結論要是「倍率不用動」')
ok('調高起跳倍率' not in _said,
   '★★ 不可以因為錯圖把平均拉高就建議調倍率')
ok('沒對上' in _said,
   '★ 但要把「幾張關卡沒對上」講出來（那是另一個問題：截圖指引）')

# 反過來：關卡有對上、卻真的常常要重試 → 這才該調倍率
_row_slow = dict(_row_bad, avg_level_attempts_ok=1.8, wrong_level_count=0)
ok('調高起跳倍率' in ' '.join(_V(_row_slow)),
   '★★ 真的是「對上了還要重試」時，仍然要建議調倍率')

# 舊資料沒有新欄位 → 退回舊算法，不可以崩、也不可以無中生有
_row_old = {"avg_level_attempts": 1.5, "avg_success_attempts": 0.5,
            "avg_total": 42.29, "avg_level": 34.05}
okc(lambda: '調高起跳倍率' in ' '.join(_V(_row_old)),
    '★ 舊資料（沒有 avg_level_attempts_ok）要能退回舊算法')

_srv2 = _code_of(_nb_cells[8])
ok('"n_ok"' in _srv2 and 'ok_level_attempts' in _srv2,
   '★★ 伺服器要分開累計「關卡有對上」的樣本')
ok('if result != "wrong_level":' in _srv2,
   '★★ 累加時要把 wrong_level 排除在倍率評估組之外')
ok('wrong_level_count' in _srv2 and 'avg_level_attempts_ok' in _srv2,
   '★ 兩個新欄位都要回報出去（/health 和自動存檔）')


# ═══════════════════════════════════════════════════════════
section('C-11 十關對照表只能有一份，而且要和學生端一致')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-08-26 老師傳「扭蛋轉轉樂」的截圖跑切法實驗，六種切法
#    **關卡欄全部 ❌** —— 看起來像「怎麼切都讀不到」。
#    ★ 實際上那一格的 LEVEL 硬編成 ('滑梯公園',…)：
#      拿 A 關的名字去比對 B 關的截圖，當然全不過。
#      同一張圖在批次自檢裡是「關卡:O 成功標示:O」，兩格結論打架。
#    ⚠️ 更糟的是我接著「順手補一份對照表」，**十關打錯七關** ——
#      憑印象重打的表，錯了沒有人會發現，只會看到判定都不過，
#      然後以為是切法不好、跑去調倍率。
#    ⇒ 表只留在 core.LEVEL_NAMES，其他地方一律引用。
_core_src = _code_of(_nb_cells[6])
ok('LEVEL_NAMES_BY_TERM = {' in _core_src,
   '★ 十關對照表住在 scratch_grader_core（2026-09-03 起依學期分表）')
ok('def level_from_filename' in _core_src,
   '★ 從檔名認關卡的規則也只有一份')
ok('def level_id' in _core_src,
   '★★ 關卡名 -> challenge.id 的換算也在這裡 ——'
   '沒有它，雲端那條路的 challenge_id 會是空的，成績一筆都記不下去')

# 自檢（14）和切法實驗（20）都不可以再自己打一份
_dup = [(i, len(re.findall("'[\u4e00-\u9fff]+': '", _code_of(_nb_cells[i]))))
        for i in (14, 20)]
ok(all(n == 0 for _, n in _dup),
   '★★ 自檢／切法實驗不可以再手打對照表　←　目前 %s' % _dup)
ok('LEVEL = None' in _code_of(_nb_cells[20]),
   '★ 切法實驗改成從檔名判斷關卡（不再硬編成某一關）')
ok('那個 ❌ 是假的' in _code_of(_nb_cells[20]),
   '★ 認不出關卡時要講明「這個 ❌ 是假的」，不然又會去調錯參數')

# ★★ 「對照表和 thinking.html 對不對得起來」交給 shared/tests/levelmap.test.py：
#    那一支會**兩個學期**逐關比對名稱、順序、challenge.id，
#    而這裡原本只比 11501 的英文名 —— 依學期分表之後那個比法已經不夠。
#    ⚠️ 不要在這裡再比一次：同一件事兩支測試各比一次，
#       改規則時一定會有一支被忘記，然後它會安靜地繼續綠。
ok(os.path.exists(os.path.join(ROOT, 'shared', 'tests', 'levelmap.test.py')),
   '★★ 對照表和學生端的一致性由 levelmap.test.py 顧著（那支不見了就沒有人在看了）')


# ═══════════════════════════════════════════════════════════
section('C-12 指紋要算得出來，而且和 repo 端算法一致')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 這個機制只有在「兩邊算出同一個值」時才有用。
#    對不上的話會變成每次都說不一致的**假警報** —— 比沒有更糟，
#    因為老師會開始忽略它。
import hashlib as _hl
import tempfile as _tf

_srv3 = _code_of(_nb_cells[8])
ok('SERVER_FINGERPRINT' in _srv3, '★ 後端有算指紋')
ok('.strip()' in _srv3 and 'sha1' in _srv3,
   '★★ 要先 strip 再算 —— %%writefile 可能差一個結尾換行')
# ⚠️ cell 8 沒有 import io：用 io.open 會 NameError 被 except 吞掉，
#    指紋永遠回 "unknown" 而且完全沒有徵兆。
_fp_body = _srv3[_srv3.index('def _server_fingerprint'):]
_fp_body = _fp_body[:_fp_body.index('SERVER_FINGERPRINT =')]
ok('io.open' not in _fp_body,
   '★★ 指紋函式不可以用 io.open（cell 8 沒 import io，會靜默回 unknown）')

# ★ 真的跑一遍：模擬 %%writefile 寫出檔案，比對兩邊的值
_raw = ''.join(_nb_cells[8]['source'])
_body = '\n'.join(_raw.split('\n')[1:])
_d = _tf.mkdtemp()
_fp_path = os.path.join(_d, 'colab_server.py')
io.open(_fp_path, 'w', encoding='utf8').write(_body)
_ns_fp = {'__file__': _fp_path}
exec(_fp_body, _ns_fp)
_got = _ns_fp['_server_fingerprint']()
_want = _hl.sha1(_body.strip().encode('utf8')).hexdigest()[:8]
ok(_got == _want,
   '★★ 後端算的和 repo 算的要一致　←　後端 %s / repo %s' % (_got, _want))
ok(_got != 'unknown', '★★ 指紋不可以是 unknown（那代表整段被例外吞掉了）')

# 結尾多一個換行也要算出同一個值
io.open(_fp_path, 'w', encoding='utf8').write(_body + '\n')
ok(_ns_fp['_server_fingerprint']() == _want,
   '★ 結尾多一個換行時仍是同一個指紋（不然會變成假警報）')

# 四個端點都要回報
_n_fp = len([l for l in _srv3.split('\n')
             if '"fingerprint": SERVER_FINGERPRINT' in l])
ok(_n_fp >= 4, '★ 每個回報 version 的端點都要一併回報指紋（%d 處）' % _n_fp)

# ★ 拆成兩台之後，光看一份 /health 分不出它是哪一台 ——
#   2026-09-03 為了確認「這份 health 來自哪台」來回問了三次都沒結論。
#   ⇒ 讓它自己講。診斷資訊要能自我識別，不然多台環境下永遠是猜。
ok(_srv3.count('"domain": NGROK_STATIC_DOMAIN') >= 4,
   '★★ 每個健康檢查端點都要回報自己的網域（不然分不出是哪一台）')


# ═══════════════════════════════════════════════════════════
section('C-13 關卡沒對上時，要給學生「可以照做的下一步」')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-09-02 老師回報：學生看到「偵測到 Ddd…」之類的亂碼。
#    ★ 那串亂碼**沒有任何可行動的指引** —— 學生不知道要重截、
#      要換關卡、還是要把視窗放大。而這正是這節課 136 張裡
#      23 張（17%）的學生體驗。
#    ⇒ 分四種情況各給一句話，原始文字降級成括號裡的補充。
_srv4 = _code_of(_nb_cells[8])
for _need, _why in [
        ('這張看起來是「%s」的畫面', '截到別關 → 直接說出那是哪一關'),
        ('一個字都沒讀到', '完全沒讀到 → 叫他截整個視窗'),
        ('分頁標題可能被瀏覽器縮短了', '位置對但名字不對 → 叫他放大視窗'),
        ('不要只截網頁內容那一塊', '⚠️ 老師回報的亂碼 → 叫他連瀏覽器上緣一起截')]:
    ok(_need in _srv4, '★ ' + _why)
ok('_level_matched(level_texts, _norm_text(_cn), _norm_text(_en))' in _srv4,
   '★★ 「這是不是別關」要用同一套比對規則，不可以退化成字面比對')
ok('core.level_names(_term)' in _srv4,
   '★ 關卡清單一樣只用 core 那一份，而且要**依學期**取'
   '（直接讀 core.LEVEL_NAMES 會永遠拿到上學期那十關）')

# ═══════════════════════════════════════════════════════════
section('C-14 加起來超過 100% 的「時間佔比」不可以印出去')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 136 張的實測印出「解碼 34%、關卡 70%、徽章 68%」= 172%。
#    ★ 錯得很有說服力：數字是真的，分母卻不對 ——
#      avg_total 已扣掉排隊，但關卡／徽章的計時包含等 CPU 的時間。
#    ⚠️ 解碼不進閘門，所以只有它的比例可信。
_V2 = load_funcs(marker='def ocr_stats_verdict',
                 want=('ocr_stats_verdict',))['ocr_stats_verdict']
_real = {"avg_decode": 12.07, "avg_level": 24.51, "avg_success": 23.67,
         "avg_total": 35.03, "avg_level_attempts": 1.04,
         "avg_level_attempts_ok": 1.0, "avg_success_attempts": 0.85,
         "ok_count": 113, "wrong_level_count": 23, "cpu_limit": 2}
_said2 = ' '.join(_V2(_real))
ok('關卡 70%' not in _said2 and '徽章 68%' not in _said2,
   '★★ 不可以再印那組加起來 172% 的百分比')
ok('等 CPU 名額' in _said2,
   '★★ 要說明為什麼加起來會超過（不然下次還是會有人拿去算）')
# ⚠️⚠️ 這裡原本有一條「解碼那一項仍然要報 —— 它不進閘門，比例是可信的」。
#    **那條斷言本身是錯的。** 我沒有去讀程式碼就下了結論，
#    實際上解碼那一段也包在 `with _ocr_cpu_sem` 裡（行 1128），
#    12.07 秒裡絕大部分是等名額，不是解圖片。
#    ★ 我還據此建議老師「讓前端先裁切再上傳」——
#      一個建立在錯數字上的優化建議，做了也不會變快。
#    ⇒ 改成反向斷言：舊資料**不可以**再出現那個建議。
ok('值得讓前端先裁切' not in _said2,
   '★★ 舊資料不可以再建議「前端先裁切」（那是我讀錯 decode_seconds 得到的結論）')

# 各段加起來沒有超過時（例如單人測試），照樣印百分比
_solo = dict(_real, avg_level=12.0, avg_success=10.0, avg_decode=11.0,
             avg_total=35.03)
ok('時間佔比' in ' '.join(_V2(_solo)),
   '★ 加起來沒超過時（單人測試）仍然印百分比')


# ═══════════════════════════════════════════════════════════
section('C-15 每一段時間都要扣掉等待，加起來才等於實際處理')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-09-02：136 張實測「解碼 12.07 秒、佔 34%」，
#    我據此建議老師讓前端先裁切再上傳 —— **那個建議是錯的**。
#    decode_seconds 是從 ocr_analyze() 第一行算到解碼完，
#    中間包著 `with _ocr_cpu_sem`：30 人同時、只有 2 個名額，
#    那 12 秒絕大部分在等名額（1920x1032 的 imdecode 只要幾十毫秒）。
#    ★ 三段全都含等待，所以加起來是 172%。
#      不分離等待，任何效能判讀都是猜的 —— 而且會猜錯方向。
import threading as _th
import time as _tm

_srv5 = _code_of(_nb_cells[8])
ok('class _CpuGate' in _srv5, '★ 有把 CPU 閘門包起來計時')
ok('with _ocr_cpu_sem:' not in _srv5,
   '★★ 不可以再有裸的 with _ocr_cpu_sem（那種等待不會被記錄）')
ok(_srv5.count('_CpuGate(_q_stats)') >= 2,
   '★ 解碼和縮放兩處都要走 gate')
ok('def _spent' in _srv5, '★ 有「扣掉等待之後花了多久」的統一算法')
for _seg in ('decode_seconds = _spent()',
             '_level_started = _spent()',
             'level_seconds = _spent() - _level_started',
             '_success_started = _spent()',
             'success_seconds = _spent() - _success_started'):
    ok(_seg in _srv5, '★★ 這一段要用 _spent()：' + _seg)
ok('"cpu_wait_seconds"' in _srv5, '★ /health 要看得到等 CPU 的時間')

# ★ 真的跑一遍：兩個名額、四個並行，三段加起來要等於 busy
_i = _srv5.index('class _CpuGate')
_j = _srv5.index('def _ocr_avg_seconds')
_ns_g = {'_busy_time': _tm, '_threading': _th,
         '_ocr_cpu_sem': _th.Semaphore(2)}
exec(_srv5[_i:_j].split('\ndef ')[0], _ns_g)
_Gate = _ns_g['_CpuGate']
_out = []


def _one():
    st = {}
    t0 = _tm.perf_counter()

    def sp():
        return (_tm.perf_counter() - t0 - st.get("wait", 0.0)
                - st.get("cpu_wait", 0.0))
    with _Gate(st):
        _tm.sleep(0.15)
    d = sp()
    a0 = sp()
    with _Gate(st):
        _tm.sleep(0.10)
    st["wait"] = st.get("wait", 0.0) + 0.20
    _tm.sleep(0.20)
    _tm.sleep(0.15)
    lv = sp() - a0
    b0 = sp()
    with _Gate(st):
        _tm.sleep(0.10)
    sc = sp() - b0
    tot = _tm.perf_counter() - t0
    busy = tot - st.get("wait", 0.0) - st.get("cpu_wait", 0.0)
    _out.append((d + lv + sc, busy, st.get("cpu_wait", 0.0)))


_ths = [_th.Thread(target=_one) for _ in range(4)]
for _t in _ths:
    _t.start()
for _t in _ths:
    _t.join()
ok(all(abs(seg - busy) < 0.06 for seg, busy, _ in _out),
   '★★ 四個並行、兩個名額時，三段加起來要等於 busy　←　'
   + '；'.join('%.2f vs %.2f' % (s, b) for s, b, _ in _out))
ok(any(cw > 0.01 for *_, cw in _out),
   '★★ 等 CPU 的時間真的有被記下來（全是 0 代表 gate 沒作用）')

# 判讀：舊資料要說「不能比較」，新資料才給百分比
_V3 = load_funcs(marker='def ocr_stats_verdict',
                 want=('ocr_stats_verdict',))['ocr_stats_verdict']
_old = ' '.join(_V3({"avg_decode": 12.07, "avg_level": 24.51, "avg_success": 23.67,
                     "avg_total": 35.03, "avg_success_attempts": 0.85,
                     "avg_level_attempts_ok": 1.0, "cpu_limit": 2}))
ok('不能算百分比' in _old and '重跑後端之後' in _old,
   '★★ 舊資料要明講「不能算百分比、要重跑後端才可信」')
ok('值得讓前端先裁切' not in _old,
   '★★ 不可以再對舊資料建議「前端先裁切」—— 那個建議建立在錯的數字上')


# ═══════════════════════════════════════════════════════════
section('C-16 通關紀錄：後端只記事實，而且要冪等')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-09-02 老師問「學生關機還是會持續驗證嗎」——
#    後端會跑完，但**成績是前端寫進 Firestore 的**：學生一關機，
#    辨識白跑、成績沒記，他回來只能重傳、再排一次隊。
#    ★ 號碼牌制讓「中途離開」從意外變成常態，所以這個洞非補不可 ——
#      等於是前一個改動帶出來的後果。
# ★ 設計上只記「過了哪幾關」這個**事實**，不算星星：
#   分數規則留在 shared/grading.js 這個單一來源。
#   兩邊各算一次，遲早會對不上，而且對不上時沒有人會發現。
_store = {}


def _fake_fs(method, url, body=None):
    if method == 'GET':
        if url not in _store:
            raise RuntimeError('404')
        return _store[url]
    _store[url] = body
    return {}


_ns_p = {'json': json, 'FIREBASE': {'enabled': True, 'api_key': 'k',
                                    'project_id': 'p'},
         '_fs_http': _fake_fs, '_fs_docs_base': lambda: 'base',
         # ⚠️ 樁要和真的一樣寬：_now_str(fmt) 是可以帶格式的
         #    （2026-09-03 記通關日期時就是被這個零參數的樁絆到）。
         '_now_str': lambda fmt=None: ('2026-09-03' if fmt == '%Y-%m-%d' else 'now'),
         'resolve_term': lambda t=None: (t or '11501')}
_core_lines = _code_of(_nb_cells[6]).split('\n')
_raw_lines = ''.join(_nb_cells[6]['source']).split('\n')
for _fn in ('_to_fs_fields', '_from_fs_fields', 'ocr_passed_collection',
            'record_ocr_pass', 'list_ocr_passed', 'ocr_passed_urls'):
    _i = next((k for k, l in enumerate(_raw_lines)
               if l.startswith('def ' + _fn)), None)
    if _i is None:
        ok(False, '★ 找不到 ' + _fn)
        continue
    _j = next(k for k in range(_i + 1, len(_raw_lines))
              if _raw_lines[k][:1] not in ('', ' ', '\t'))
    exec('\n'.join(_raw_lines[_i:_j]), _ns_p)

_R = _ns_p['record_ocr_pass']
_L = _ns_p['list_ocr_passed']
ok(_R('1410905', '3') == ['3'], '★ 記下第一關')
ok(_R('1410905', '7') == ['3', '7'], '★ 再記一關')
ok(_R('1410905', '3') == ['3', '7'],
   '★★ 同一關驗兩次不可以重複記（學生一定會重驗）')
ok(_L('1410905') == ['3', '7'], '★★ 讀得回來')
ok(_L('9999999') == [], '★ 沒紀錄的學號回空清單，不可以拋例外')
ok(_R('', '3') is None and _R('1410905', '') is None,
   '★ 缺學號或關卡就不要寫（會生出一份沒有意義的文件）')

# ⚠️ 存成 JSON 字串，不是 arrayValue —— _to_fs_fields 沒有支援陣列，
#    硬塞會變成字串 "['1','2']"，讀回來就不是陣列了。
_doc = list(_store.values())[0]['fields']
ok('passed_json' in _doc and 'stringValue' in _doc['passed_json'],
   '★★ 清單要存成 JSON 字串（_to_fs_fields 不支援 arrayValue）')
ok(json.loads(_doc['passed_json']['stringValue']) == ['3', '7'],
   '   而且讀回來要還原成陣列')

# 寫失敗不可以影響判定
def _boom(*_a, **_k):
    raise RuntimeError('Firestore 掛了')


_ns_p['_fs_http'] = _boom
okc(lambda: _R('1410905', '9') is None,
    '★★ 寫失敗要回 None，不可以往外拋（判定不能被它拖累）')
okc(lambda: _L('1410905') == [],
    '★★ 讀失敗要回空清單，不可以往外拋')

# ★ 截圖網址：學生中途離開時，補記的那一關要靠它才顯示得出圖 ——
#   沒有它，證書上那一塊只會是一個虛線空框（圖其實在雲端硬碟裡，
#   只是 Firestore 沒有那個連結）。
_U = _ns_p['ocr_passed_urls']
_store.clear()
_ns_p['_fs_http'] = _fake_fs
_R('1410905', '3')
ok(_U('1410905') == {}, '★ 還沒傳圖時網址是空的（不可以拋例外）')
_R('1410905', '3', None, 'https://drive/x3')
ok(_U('1410905') == {'3': 'https://drive/x3'}, '★★ 補寫網址')
_R('1410905', '5', None, 'https://drive/x5')
ok(_U('1410905') == {'3': 'https://drive/x3', '5': 'https://drive/x5'},
   '★★ 多關各有各的網址')
ok(_L('1410905') == ['3', '5'], '★ 補網址不可以弄壞關卡清單')
_R('1410905', '3')          # 再驗一次、沒帶網址
ok(_U('1410905').get('3') == 'https://drive/x3',
   '★★ 沒帶網址時不可以把既有的洗掉（重驗一次就沒圖了）')

_srv6 = _code_of(_nb_cells[8])
ok('core.record_ocr_pass(sid' in _srv6, '★ 判定通過時要記下來')
ok('/api/my-passed' in _srv6, '★★ 要有讓前端來問「我漏了哪幾關」的端點')
ok('student_id' in _srv6 and 'list_ocr_passed' in _srv6,
   '★ 那支端點要照學號查')
ok('ocr_passed_urls' in _srv6 and '"urls": urls' in _srv6,
   '★★ 端點要一併回傳截圖網址（不然補記的那一關證書是空框）')
ok('drive_url=_drive_url' in _srv6,
   '★★ 截圖傳好之後要把網址補記回去')
# ⚠️ 不可以提供整批查詢 —— 那等於開放全班成績
ok('pageSize' not in _srv6.split('/api/my-passed')[1][:900],
   '★★ 不可以在這支端點提供整批查詢（等於開放全班成績）')


# ═══════════════════════════════════════════════════════════
section('C-17 colab_server 不可以裸用 core 的名稱')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-09-02 老師回報「GRADER_TERM is not defined」。
#    我在三個地方寫了 request.form.get("term", GRADER_TERM) ——
#    而 GRADER_TERM 定義在 **cell 6（scratch_grader_core）**，
#    cell 8 只有 `import scratch_grader_core as core`，
#    所以那是 NameError。
# ★ 最糟的是它藏在 `if _passed:` 裡：
#   **只有真的通關的學生會踩到** —— 判定過了、卻拿不到證書，
#   而沒過的人一切正常。上課到一半才會發現。
# ⚠️ 而現有的測試全部沒抓到：ocrjobs 用假的 ocr_analyze，
#   根本不會走到那一段。⇒ 改用靜態分析，一次涵蓋這一整類錯誤。
import ast as _ast
import builtins as _bi



def _cell_code(i):
    _L = ''.join(_nb_cells[i]['source']).split('\n')
    return '\n'.join(('pass' if l.startswith(('!', '%%')) else l) for l in _L)


def _toplevel(t):
    out = set()
    for n in t.body:
        if isinstance(n, (_ast.FunctionDef, _ast.AsyncFunctionDef, _ast.ClassDef)):
            out.add(n.name)
        elif isinstance(n, _ast.Assign):
            for x in n.targets:
                if isinstance(x, _ast.Name):
                    out.add(x.id)
        elif isinstance(n, _ast.AnnAssign) and isinstance(n.target, _ast.Name):
            out.add(n.target.id)
        elif isinstance(n, (_ast.Import, _ast.ImportFrom)):
            for a in n.names:
                out.add((a.asname or a.name).split('.')[0])
    return out


def _bound(t):
    """這個 cell 裡任何被綁定過的名稱（含函式內的區域變數與參數）。"""
    out = _toplevel(t)
    for n in _ast.walk(t):
        if isinstance(n, _ast.Name) and isinstance(n.ctx, (_ast.Store, _ast.Del)):
            out.add(n.id)
        elif isinstance(n, (_ast.FunctionDef, _ast.AsyncFunctionDef)):
            out.add(n.name)
            a = n.args
            for x in list(a.args) + list(a.posonlyargs) + list(a.kwonlyargs):
                out.add(x.arg)
            if a.vararg:
                out.add(a.vararg.arg)
            if a.kwarg:
                out.add(a.kwarg.arg)
        elif isinstance(n, (_ast.Import, _ast.ImportFrom)):
            for x in n.names:
                out.add((x.asname or x.name).split('.')[0])
        elif isinstance(n, _ast.ExceptHandler) and n.name:
            out.add(n.name)
    return out


_t6 = _ast.parse(_cell_code(6))
_t8 = _ast.parse(_cell_code(8))
_used = {n.id for n in _ast.walk(_t8)
         if isinstance(n, _ast.Name) and isinstance(n.ctx, _ast.Load)}
_leak = (_used & _toplevel(_t6)) - _bound(_t8) - set(dir(_bi))
ok(not _leak,
   '★★ colab_server 用到 core 的東西一律要加 core. 前綴　←　'
   + ('沒有裸用' if not _leak else '裸用了：' + '、'.join(sorted(_leak))))

# ★ 那三處現在改用 core.resolve_term()：它會驗學期合法性，
#   比直接取 GRADER_TERM 當預設更好（帶了 11503 之類也擋得掉）。
# ⚠️ 2026-09-03：/analyze 裡那幾處收斂成一個 `_term`（算一次、到處用），
#    所以這裡不再數次數 —— 數次數會逼著後面的人為了讓測試綠而重複呼叫。
#    要守的是「**有**走 core.resolve_term」，不是「走了幾次」。
_srv_t = _code_of(_nb_cells[8])
ok('_term = core.resolve_term(request.form.get("term"))' in _srv_t,
   '★ 學期一律走 core.resolve_term（會驗合法性，不是只取預設）')
ok('core.resolve_term(request.form.get("term"))' in _srv_t
   and 'GRADER_TERM' not in _srv_t.split('def ocr_analyze')[-1].split('@app.route')[0],
   '★ /analyze 裡不可以繞過去直接用 GRADER_TERM（前端送的 term 會被忽略）')


# ═══════════════════════════════════════════════════════════
section('C-18 關卡先看檔名，但辨識要留著當兜底')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-09-03 老師提出用檔名取代關卡辨識（省 12.35 秒 ＋ 一次
#    呼叫的 9.3 秒固定成本，一張從 23.27 降到約 11 秒，CPU 佔用減半）。
# ★ 我第一版**直接把關卡辨識刪掉**，14 條測試跟著紅 ——
#   那些斷言記的是實戰踩過的坑（水餃工廠誤判、亂碼訊息、ROI 範圍）。
#   刪掉程式碼等於刪掉退路：萬一檔名方案在課堂上不管用
#   （學生用 Win+Shift+S，檔名是「螢幕擷取畫面…」），就沒得退。
# ⇒ 檔名認得出走快路，認不出**照舊辨識**。這一節盯著兜底不可以被拿掉。
_srv7 = _code_of(_nb_cells[8])
ok('core.level_from_filename(_up_name, _term)' in _srv7,
   '★ 先從檔名認關卡（而且要帶 term —— 兩個學期的關卡表不一樣）')
# ⚠️⚠️ 2026-09-03 的坑：雲端那條路（暫存區工作者）呼叫這一支時
#    **沒有 challenge_id**，而 record_ocr_pass 遇到空的 challenge_id
#    會直接 return None、一個字都不寫。症狀完全不像故障：
#    圖處理完了、暫存區的檔也刪了、日誌乾乾淨淨，
#    但學生端問 /api/my-passed 拿到空的 —— **全班都判「沒過」**。
ok('_cid = (request.form.get("challenge_id") or "").strip()' in _srv7
   and 'core.level_id(_lv_from_name[0], _term)' in _srv7,
   '★★ 沒送 challenge_id 時要從關卡名推出來（不然成績一筆都記不下去）')
ok('core.record_ocr_pass(sid, _cid, _term)' in _srv7,
   '★★ 通關紀錄要用推出來的那個編號')
# ⚠️⚠️ 2026-09-03 老師：「只看檔名判斷關卡，似乎有可能發生改檔名，
#    所以還是要有第二層把關才給證書。」
#    ★ 原本有一條快路：檔名認得出就 has_level = True、**完全不辨識關卡** ——
#      把第 1 關的成功截圖改名成「拔蘿蔔….png」就能拿到第 10 關的證書。
#    ⇒ 快路已移除。檔名只決定「要比對哪一關」，OCR 仍然要驗。
ok('if False:' not in _srv7 and 'has_level = True' not in _srv7,
   '★★★ 不可以有「檔名認得出就直接 has_level = True」的快路'
   '（改檔名就能拿到別關的證書）')
ok('if _lv_from_name and not title:' in _srv7
   and 'title = _norm_text(_lv_from_name[0])' in _srv7,
   '★★★ 檔名要當成「比對目標」餵給 OCR，不是當成結論')
# ⚠️⚠️ 雲端那條路上前端看不到 /analyze 的回應，所以失敗理由要另外留一份。
#    沒有它，學生一律看到「找不到挑戰成功」—— 截錯關卡的人會照著錯的指示重截。
ok('def _remember_verdict' in _srv7 and '/api/my-verdict' in _srv7,
   '★★★ 要把最近一次判定留起來，學生端才拿得到真正的失敗原因')
ok(_srv7.count('_remember_verdict(sid,') >= 3,
   '★★ 三條失敗路徑都要記（尤其「關卡名稱不符合」那條，訊息最有用）'
   '　←　目前 %d 處' % _srv7.count('_remember_verdict(sid,'))
ok('_VERDICT_TTL' in _srv7,
   '★ 要有存活時間（這是給「剛剛那一張」用的，不是紀錄）')

ok('"level_verified": bool(has_level)' in _srv7,
   '★★ 回應要分開講「關卡怎麼決定的」和「有沒有驗過」')
# ⚠️ 不可以只檢查那句訊息在不在 —— 把 if 條件改成 False，
#    訊息還在檔案裡，測試照樣綠（2026-09-03 突變時抓到）。
#    ⇒ 要釘住**判斷式本身**。
ok('if _lv_from_name and _want_lv and _lv_from_name[0] != _want_lv:' in _srv7,
   '★★ 檔名說 A、學生選 B 要當場擋掉（放行會把成績記到別關）')
ok('選的關卡和截圖檔名對不上' in _srv7,
   '   而且要講清楚是哪一關對哪一關')
# ★★ 兜底必須還在 —— 這是這一節最重要的一條
ok('level_roi = _crop(' in _srv7 and '_matches_level(level_texts)' in _srv7,
   '★★ 關卡辨識要留著當兜底（檔名認不出時學生才不會卡住）')
ok('系統在截圖上緣一個字都沒讀到' in _srv7,
   '★ 兜底那條路的訊息也要留著（那是實戰調出來的）')

# ★ 檔名判定本身（老師的檔名格式、學號前綴、認不出時回 None、
#   關卡名不可以互相包含）改由 shared/tests/levelmap.test.py 驗 ——
#   那一支**兩個學期都跑**，而這裡原本只跑得動 11501 那一份。
# ⚠️ 不要在這裡也留一份：同一件事兩支各驗一次，改規則時會有一支被忘記。


# ═══════════════════════════════════════════════════════════
section('C-19 雲端暫存區：每張都留一份，而且不可以拖累判定')
# ═══════════════════════════════════════════════════════════
# ⚠️⚠️ 2026-09-03 老師提的架構：截圖先進雲端暫存區，
#    後端再慢慢取來辨識 —— 工作就脫離 Colab 的生命週期
#    （現在圖放在記憶體，Colab 一重啟排隊中的全丟）。
# ★ 這一步先做「存」：每一張都留下來（不只通過的），
#   這是「相信檔名」的稽核配套；而留在暫存區的 = 還沒處理完的，
#   本身就是一份待處理清單。
_srv8 = _code_of(_nb_cells[8])
ok('def gas_temp_save' in _srv8, '★ 有存進暫存區的函式')
# ⚠️ 一定要背景做：上傳幾 MB 到 GAS 要好幾秒，
#    同步做會把「讀檔名省下的 12 秒」整個吃掉。
ok('target=gas_temp_save' in _srv8 and 'daemon=True' in _srv8,
   '★★ 要用背景執行緒（同步上傳會抵銷掉檔名快路省下的時間）')
ok('args=(raw,' in _srv8,
   '★ 要存原始 bytes（存解碼後的就失去稽核價值）')
# ⚠️ 失敗不可以影響判定 —— 和 record_ocr_stats 同一個原則
_i2 = _srv8.index('def gas_temp_save')
_body2 = _srv8[_i2:_i2 + 2200]
ok('except Exception' in _body2 and 'return None' in _body2,
   '★★ 上傳失敗要吞掉並回 None（附加保障不能拖累判定）')
ok('沒設 GAS' in _srv8 or 'if not (GAS_UPLOAD_URL and GAS_UPLOAD_KEY)' in _body2,
   '★ 沒設 GAS Secrets 時要安靜跳過')

# GAS 那一側
_gs = io.open(os.path.join(ROOT, 'shared', 'filebackup.gs'), encoding='utf8').read()
ok('data.kind === "temp"' in _gs, '★ GAS 要認得 temp 這種上傳')
ok('function tempFolder' in _gs and '[t2, day, fn]' in _gs,
   '★ 路徑是 <根>/學期/日期/檔名')
ok('function safeName' in _gs,
   '★★ 檔名要消毒 —— 直接用學生上傳的檔名，路徑穿越要擋掉')
ok('setTrashed(true)' in _gs and 'temp_delete' in _gs,
   '★ 刪除走垃圾桶（刪錯還撈得回來），不是永久刪除')
# ⚠️⚠️ Apps Script 服務的是「已部署的版本」，不是存檔的程式碼。
#    改完沒重新部署，網址服務的還是舊的 —— 而從外面看不出來。
#    2026-09-03 只能靠「不認得的上傳種類：temp_list」這句間接推理。
ok('features:' in _gs and '"temp_list"' in _gs,
   '★★ doGet 要列出 features，用瀏覽器打開網址就能分辨部署是新是舊')

# ═══════════════════════════════════════════════════════════
# ⚠️⚠️⚠️ 停不下來的迴圈（2026-09-03 讀 /analyze 時抓到，還沒上過課）
# ═══════════════════════════════════════════════════════════
# 暫存區工作者是用 app.test_request_context 重跑 ocr_analyze()，
# 而 ocr_analyze 會把收到的圖**存進暫存區**。所以工作者處理完一張，
# 那張又被寫回去了 —— 而 GAS 的 replaceFile 是
# 「砍掉同名舊檔、**建一個新 fileId**」，
# _temp_seen 又是用 fileId 記的，新 id 完全擋不住：
#     處理 A → 寫回成 B → 刪掉 A → 下一輪撈到 B → 寫回成 C → …
# ★ 學生看到的是「排隊清單裡的自己永遠不會消失」，等到 20 分鐘上限
#   才被告知失敗；後端則一直重跑同一張，CPU 和 GAS 額度一起燒光。
#   **每一張都會這樣**，等於整套不能用。
# ⚠️ 而且它不會有任何錯誤訊息 —— 每一步分開看都「成功」了。
# ⚠️⚠️ 時區：學生端上傳（ocrclient.js）**不送 day**，所以 GAS 用
#    Asia/Taipei 算資料夾。後端這邊如果自己用 time.localtime() 算，
#    那是 Colab 的 UTC —— 台北 00:00~07:59 會差一天，
#    後端就去翻**昨天**的資料夾，列到的永遠是空的。
#    ★ 症狀：圖明明在暫存區，排隊清單卻是空的，學生一直轉圈圈到 20 分鐘
#      上限；而第一節課正好落在那個時段。日誌一樣乾乾淨淨。
ok('strftime("%Y%m%d"' not in _srv8,
   '★★★ 後端不可以自己算暫存區的日期 —— 一律讓 GAS 用台北時間決定'
   '（Colab 是 UTC，早上會差一天）')
ok('body = {"kind": "temp_list", "term": str(term)}' in _srv8,
   '★★ 列清單時不帶 day（GAS 會補台北今天）')

# ⚠️⚠️ 「掃到 0 筆」和「根本掃不到」不可以長得一樣。
#    2026-09-03 老師實測卡在這裡：/api/queue-list 回 worker:true、queue:[]，
#    畫面顯示「目前沒有人在排隊」，圖卻好好地躺在暫存區 ——
#    後端其實每 8 秒都在失敗，而外面**完全看不出來**。
ok('raise RuntimeError' in _srv8 and 'if out is None:' in _srv8,
   '★★★ gas_temp_list 問不到要丟例外，不可以回空清單'
   '（空清單會被顯示成「沒有人在排隊」）')
# ⚠️ 單次失敗不算失敗：GAS 偶爾抖一下，下一輪 8 秒後就好了，
#    不可以因此讓全班的螢幕跳紅字（和健康檢查的 MISS_LIMIT 同一個原則）。
ok('"fails": 0' in _srv8 and '_temp_last_scan["fails"]' in _srv8,
   '★★ 掃描要記**連續**失敗次數，成功要歸零')
ok('_temp_last_scan' in _srv8 and '"scan": scan' in _srv8,
   '★★★ 掃描狀態要露到 /api/queue-list —— 沒有它就分不出'
   '「沒人排隊」和「後端壞了」')
# ⚠️ 這一條原本用「第幾個 except Exception」定位 —— 那是釘**位置**，
#    2026-09-03 加了「撈昨天」的內層 except 之後就指錯地方了（假紅）。
#    ⇒ 改釘內容：失敗時要記 ok=False，而且外層那句訊息要還在。
_ws = _srv8[_srv8.index('def _temp_worker_loop'):]
ok('"ok": False' in _ws and '_temp_last_scan["fails"]' in _ws,
   '★★ 掃描失敗要記下來（連續失敗次數也要）')
# ⚠️ 不要釘註解文字 —— _code_of() 會把整行註解剝掉（我剛剛就這樣假紅一次）。
#    要釘的是行為：失敗那條路裡**不可以**出現清空快取的動作。
ok('掃描出錯，下一輪再試' in _ws,
   '★ 失敗時要在 Colab 印出來（老師才查得到原因）')
_fail_branch = _ws[_ws.rindex('except Exception'):]
ok('_temp_queue_cache[:]' not in _fail_branch,
   '★★ 失敗時不可以清空排隊快取（清空會顯示成「目前沒有人在排隊」，'
   '看起來像一切正常）')

# ⚠️⚠️ 「執行緒起來了」≠「它真的連得上」。2026-09-03 老師看到
#    「✅ 暫存區工作者已啟動」，但它每 8 秒都在失敗 —— 錯誤被後面的
#    輸出洗掉，而他在看的正是那幾行啟動訊息。
ok('_n0 = len(gas_temp_list(' in _srv8,
   '★★★ 啟動時要先探一次暫存區，把結果印在啟動訊息裡')
ok('暫存區**連不上**' in _srv8 and '沒有人會處理' in _srv8,
   '★★ 探測失敗要講清楚後果（學生傳得出去，但沒人處理）')
# ⚠️ 探測失敗也要把執行緒起起來：改完 Secret 重跑就會自己接上。
_st = _srv8[_srv8.index('def start_temp_worker'):]
ok(_st.index('_threading.Thread') > _st.index('except Exception'),
   '★★ 探測失敗仍要啟動執行緒（修好之後要能自己接上）')

# ⚠️⚠️ 「傳完就能走」是這套架構的目標。成績本來就跑不掉（後端自己寫
#    Firestore），但**證書截圖**原本靠學生端在判定通過後自己傳 ——
#    學生一關視窗就沒人傳，證書那格永遠是空的。
#    ⇒ 後端沒收到班級／座號時要用學號去查名冊，自己把圖傳好。
# ⚠️⚠️ 重複通關要保留第一張截圖。GAS 的 replaceFile 是
#    「丟掉同名舊檔、建新 fileId」，而前端已通關的關卡不會再更新網址
#    ⇒ 重驗一次，第一次的證書圖就變破圖（而成績、日期、清單都好好的，
#      要等學生去看證書才會發現）。
# ⚠️⚠️ 暫存區是用**日期**分資料夾的，而工作者只掃今天 ——
#    跨過午夜的那一節課、或後端當掉隔天才重開，昨天那批就沒人處理，
#    學生的成績直接不見，而且今天的清單是空的、看起來一切正常。
# ⚠️ 每一關要記「通關那天」：沒有它，前端補記只能填今天。
ok('dates_json' in _core_src and 'def ocr_passed_dates' in _core_src,
   '★★ 後端要記每一關通關的日期，而且讀得回來')
ok('if cid not in dates:' in _core_src,
   '★★ 日期只記第一次（重複通關維持「保留第一次」）')
ok('"dates": dates' in _srv8,
   '★★ /api/my-passed 要把日期一起回去')

ok('core.taipei_day(-1)' in _srv8,
   '★★★ 要順便撈昨天的殘留（否則跨日的上傳會永遠沒人處理）')
ok('def taipei_day' in _core_src,
   '★★ 日期換算要用台北時間，而且只有一份（Colab 的時鐘是 UTC）')
_yb = _srv8[_srv8.index('core.taipei_day(-1)'):][:400]
ok('except Exception' in _yb,
   '★★ 昨天那批撈不到不可以害今天的停擺')

ok('core.ocr_passed_urls(sid, _term).get(str(_cid))' in _srv8,
   '★★★ 已經有圖的關要沿用第一張，不可以重傳（會把舊檔丟進垃圾桶）')
_pb = _srv8[_srv8.index('if _passed:'):]
ok(_pb.index('gas_upload_shot') > _pb.index('ocr_passed_urls'),
   '★★ 而且要**先查有沒有舊圖**再決定傳不傳')

ok('core.roster_lookup(sid)' in _srv8,
   '★★★ 沒帶班級座號時要查名冊 —— 否則「上傳完可以關掉」不成立'
   '（成績有、證書圖沒有）')
_gu = _srv8[_srv8.index('_drive_url = gas_upload_shot'):][:200]
ok('_room, _seat, _cid' in _gu,
   '★★ 查到的班級座號要真的傳給 gas_upload_shot')

ok('"from_temp": "1"' in _srv8,
   '★★★ 工作者的內部呼叫要帶 from_temp（這張本來就是從暫存區抓下來的）')
ok('if not (request.form.get("from_temp") or "").strip():' in _srv8,
   '★★★ ocr_analyze 看到 from_temp 就不可以再存回暫存區 —— '
   '否則會變成處理不完的迴圈（症狀：排隊清單永遠不會消）')
# ⚠️ 不可以只檢查旗標在不在：存檔那段要真的在 if 底下。
#    把 if 拿掉、旗標留著，上面兩條照樣綠。
_ts = _srv8.index('if not (request.form.get("from_temp") or "").strip():')
_tv = _srv8.index('target=gas_temp_save')
ok(_ts < _tv < _ts + 700,
   '★★ 而且 gas_temp_save 要真的包在那個 if 裡面（不是擺在旁邊）')


# ═══════════════════════════════════════════════════════════
section('C-20 判定出來的關卡要回傳給前端')
# ═══════════════════════════════════════════════════════════
# ⚠️ 2026-09-03 老師：「不用選關卡，關卡由後端判斷。」
#    ⇒ 前端要拿得到「後端認為這是哪一關」才記得了成績。
_srv9 = _code_of(_nb_cells[8])
ok('"level": (_lv_from_name[0] if _lv_from_name else "")' in _srv9,
   '★★ 回應要帶上判定出來的關卡')
ok('"level_source"' in _srv9,
   '★ 也要說是怎麼判的（檔名 or 辨識）—— 之後要看快路命中率')
# ⚠️ 走兜底時 _lv_from_name 是 None，那時要回空字串而不是 null／undefined，
#    否則前端拿去查對照表會炸。
ok('else ""' in _srv9,
   '★★ 認不出時回空字串（前端不可以拿 undefined 去查對照表）')

# ★★ 前端要用關卡名反查 challenge.id，所以兩邊的名稱必須逐字相同。
#    core.LEVEL_NAMES 和 thinking.html 的 englishMappings 已有測試把關（C-11），
#    這裡再確認 challenges 陣列的 title 也對得上 —— 那才是反查用的那一份。
_html2 = io.open(os.path.join(ROOT, '11501', 'thinking.html'), encoding='utf8').read()
_titles = set(re.findall(r'\{ id: \d+, title: "([^"]+)"', _html2))
_ns_t = {}
_rl2 = ''.join(_nb_cells[6]['source']).split('\n')
_i3 = next(k for k, l in enumerate(_rl2) if l.startswith('LEVEL_NAMES'))
_j3 = next(k for k in range(_i3 + 1, len(_rl2))
           if _rl2[k].startswith('def level_from_filename'))
exec('\n'.join(_rl2[_i3:_j3]), _ns_t)
_miss = set(_ns_t['LEVEL_NAMES']) - _titles
ok(len(_titles) == 10, '★ challenges 陣列讀得到十關（讀到 %d）' % len(_titles))
ok(not _miss,
   '★★ 後端的關卡名要和 challenges 的 title 逐字相同（前端靠它反查 id）　←　%s'
   % ('全部對得上' if not _miss else '對不上：' + '、'.join(sorted(_miss))))


print('\n通過 %d／失敗 %d' % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
