# -*- coding: utf-8 -*-
"""十關對照表：後端那一份和兩個 thinking.html 必須逐關一致
跑法：python shared/tests/levelmap.test.py
（check.py 會自動跑 shared/tests/*.test.py，所以提交前一定會經過這裡）

★ 為什麼需要這一支
  2026-09-03 起關卡**由後端從檔名判定**，不再由學生選。
  也就是說，那張對照表從「兜底用的參考」升級成
  「決定成績記在哪一關」的唯一依據 —— 而它同時存在三個地方：

      shared/backend.ipynb   LEVEL_NAMES_BY_TERM   ← 判定＋換算 challenge_id
      11501/thinking.html    challenges / englishMappings
      11502/thinking.html    challenges / englishMappings

  ⚠️⚠️ 這個 repo 已經在**同一件事**上吃過虧：2026-08-26 憑印象另外
     打了一份十關表，十關錯七關，而且完全沒有錯誤訊息 ——
     只會看到「判定全部不過」，然後跑去調 OCR 倍率。
  ⚠️⚠️ 現在錯掉的後果更重：名字對不上 → 認不出關卡 → challenge_id 空的
     → record_ocr_pass 直接 return None → **成績一筆都沒有**，
     而後端日誌乾乾淨淨。⇒ 只能靠這支測試在提交前擋下來。

★ 順序也要對：後端沒有另外存 id，是用「表的第幾個」換算 challenge.id。
  順序錯了，成績會記到別關頭上 —— 那比判不過更難發現。
"""
import ast
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


# ── 把後端的那幾支原封不動抽出來執行 ──────────────────────
#   ⚠️ 不抄一份出來測：抄本測綠了，正本改壞照樣沒人知道
#      （backend_parse.test.py 也是這個原則）。
def load_backend():
    nb = json.load(io.open(NB, encoding='utf-8'))
    src = ''
    for c in nb['cells']:
        if c.get('cell_type') == 'code':
            s = ''.join(c['source'])
            if 'LEVEL_NAMES_BY_TERM' in s and 'def level_from_filename' in s:
                src = s
                break
    if not src:
        print('❌ backend.ipynb 裡找不到 LEVEL_NAMES_BY_TERM —— 表被改名或刪掉了？')
        sys.exit(1)
    # ⚠️ 第一行是 Colab 的 %%writefile 魔法指令，不是 Python
    if src.lstrip().startswith('%%'):
        src = src.split('\n', 1)[1]

    # ⚠️ 用 ast 切，不用正規式：巢狀的大括號、字串裡的括號都會讓
    #    「從 { 找到 }」那種寫法切錯，而切錯的症狀是 SyntaxError ——
    #    看起來像後端壞了，其實是測試自己壞了。
    tree = ast.parse(src)
    want_val = ('LEVEL_NAMES_BY_TERM', 'LEVEL_NAMES', 'VALID_TERMS', 'GRADER_TERM')
    want_fn = ('resolve_term', 'level_names', 'level_id', 'level_from_filename')
    picked, seen = [], set()
    for node in tree.body:
        name = None
        if isinstance(node, ast.Assign) and len(node.targets) == 1 \
                and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name not in want_val:
                name = None
        elif isinstance(node, ast.FunctionDef) and node.name in want_fn:
            name = node.name
        if name:
            seen.add(name)
            picked.append(ast.get_source_segment(src, node))

    missing = [n for n in want_fn if n not in seen]
    if missing:
        print('❌ 後端找不到：' + '、'.join(missing))
        sys.exit(1)

    ns = {}
    exec(compile('\n\n'.join(picked), '<nb>', 'exec'), ns)
    return ns


# ── 從 thinking.html 讀出前端那一份 ────────────────────────
def load_frontend(term):
    p = os.path.join(ROOT, term, 'thinking.html')
    src = io.open(p, encoding='utf-8').read()

    m = re.search(r'const challenges = \[(.*?)\];', src, re.S)
    if not m:
        print('❌ %s/thinking.html 找不到 challenges 陣列' % term)
        sys.exit(1)
    titles = []
    for row in re.finditer(r'\{\s*id:\s*(\d+),\s*title:\s*"([^"]+)"', m.group(1)):
        titles.append((int(row.group(1)), row.group(2)))

    m2 = re.search(r'const englishMappings = \{(.*?)\};', src, re.S)
    eng = {}
    if m2:
        for row in re.finditer(r'"([^"]+)"\s*:\s*"([^"]*)"', m2.group(1)):
            eng[row.group(1)] = row.group(2)
    return titles, eng


def main():
    nb = load_backend()
    print('── 十關對照表：後端 vs 前端 ──')

    for term in ('11501', '11502'):
        section('★ ' + term)
        table = nb['LEVEL_NAMES_BY_TERM'].get(term)
        ok(bool(table), '★★ 後端有 %s 這個學期的表' % term)
        if not table:
            continue
        titles, eng = load_frontend(term)

        ok(len(titles) == 10 and len(table) == 10,
           '★ 兩邊都是十關（前端 %d、後端 %d）' % (len(titles), len(table)))

        back = list(table.keys())
        front = [t for _i, t in titles]
        ok(back == front,
           '★★ 關卡名稱與**順序**完全一致'
           + ('' if back == front else '\n        後端：%s\n        前端：%s'
              % ('、'.join(back), '、'.join(front))))

        # id 換算：後端沒有另存 id，是用表的順序推
        bad_id = [t for i, t in titles if nb['level_id'](t, term) != i]
        ok(not bad_id,
           '★★ level_id() 換出來的編號和 challenge.id 一致'
           + ('' if not bad_id else '　← 對不上：' + '、'.join(bad_id)))

        # ⚠️⚠️ 英文名（OCR 讀不清中文標題時靠網址兜底）**只住在後端**。
        #    2026-09-03 起前端不再自己送 keywords，那份 englishMappings
        #    已經刪掉 —— 它如果又長回來，就是又多了一份會偷偷走鐘的表。
        #    ★ 這一條守的是「不要再有第二份」，不是「兩份要一樣」。
        if eng:
            bad_eng = [k for k in table if eng.get(k) != table[k]]
            ok(not bad_eng,
               '★ 前端還留著英文名表，至少要和後端一致'
               + ('' if not bad_eng else '　← 對不上：' + '、'.join(bad_eng)))
        ok(not eng,
           '★★ 前端不應該再有 englishMappings（英文名只留後端一份）'
           + ('' if not eng else '　← %s/thinking.html 又出現了一份' % term))

        # ⚠️ 放寬成「檔名任何位置含關卡名」之後，名字互相包含就會誤判
        nested = [(a, b) for a in table for b in table if a != b and a in b]
        ok(not nested,
           '★★ 關卡名兩兩不互相包含（否則檔名判定會認錯關）'
           + ('' if not nested else '　← ' + str(nested)))

    section('★ 檔名判定（和學生端 ocrclient.js 同一套規則）')
    ok(nb['level_from_filename']('滑梯公園 - Google Chrome 2026_8_31.png',
                                 '11501') == ('滑梯公園', 'slide park'),
       '★★ 開頭是關卡名 → 認得出')
    ok(nb['level_from_filename']('1410700-滑梯公園 - Google Chrome.png',
                                 '11501') == ('滑梯公園', 'slide park'),
       '★★ 前面加了學號也要認得出（上傳時會加）')
    ok(nb['level_from_filename']('螢幕擷取畫面 2026-09-03 103015.png',
                                 '11501') is None,
       '★★ Win+Shift+S 那種檔名 → 認不出（學生端會在選檔時擋下）')
    ok(nb['level_from_filename']('智慧選卡 - Google Chrome.png', '11502')
       == ('智慧選卡', 'card search'),
       '★★ 下學期的關卡要用下學期那張表')
    ok(nb['level_from_filename']('智慧選卡 - Google Chrome.png', '11501') is None,
       '★★ 學期別的關卡不可以混著認（記錯學期＝成績記錯地方）')

    section('★ 成績記在哪一關')
    ok(nb['level_id']('跳格子', '11501') == 1 and nb['level_id']('拔蘿蔔', '11501') == 10,
       '★ 第一關和第十關都換得出來')
    ok(nb['level_id']('不存在的關', '11501') is None,
       '★★ 認不得要回 None，不可以回 0 或空字串'
       '（那會被寫進成績變成「第 0 關」）')

    print('\n通過 %d／失敗 %d' % (pass_n, fail_n))
    sys.exit(1 if fail_n else 0)


main()
