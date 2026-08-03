#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
推送前的檔案完整性檢查
==========================================================
擋下幾種最容易出包、又最難事後發現的情形：

  1. 0 KB 空檔          → 學生點進去看到白畫面
  2. HTML 結構壞掉      → 缺 <html>/<body>/</html>、標籤數量對不上
  3. <script> 語法錯誤  → 整頁 JS 停擺，畫面卡在「載入中」
  4. 死連結             → 參照到不存在的 .html / .js / .css
  5. 名冊設定不一致     → 會讓全班被當成首次登入
  6. .bat 換行是 LF     → Windows 批次檔會出現「找不到指定的路徑」

用法：
  python shared/check.py            檢查後回報，有錯回傳碼 1
  python shared/check.py --quiet    只在有錯時輸出

由 git 的 pre-commit hook 自動呼叫，所以 GitHub Desktop 按 Commit 也會跑。
"""

import os
import re
import sys
import glob
import shutil
import subprocess
import tempfile

# 這支放在 shared/ 底下，要檢查的是它的上一層（repo 根目錄）
_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(_HERE) if os.path.basename(_HERE) == 'shared' else _HERE
QUIET = '--quiet' in sys.argv

# 學期資料夾（新增學年度時加進來）
TERMS = ['11501', '11502']

# 允許為空的檔案（GitHub Pages 用的旗標檔）
ALLOW_EMPTY = {'.nojekyll'}

# 不做「參照檔案是否存在」檢查的頁面：
#   範本檔的路徑是以「複製到學期資料夾之後」的視角寫的，
#   放在 shared/ 裡當然對不上，不是錯誤。
SKIP_REF_CHECK = {'shared/template.html'}

errors = []
warns = []


def log(msg):
    if not QUIET:
        print(msg)


def rel(path):
    return os.path.relpath(path, ROOT).replace('\\', '/')


def case_exact(target):
    """
    大小寫是否與實際檔名完全一致。

    ★ 為什麼需要這個：Windows 的檔案系統不分大小寫，`os.path.exists('Hub.html')`
      在本機是 True；但 GitHub Pages 分大小寫，推上去就是 404。
      這種錯在本機測不出來，只能靠逐層核對目錄列表。
    """
    cur = ROOT
    for part in os.path.relpath(target, ROOT).replace('\\', '/').split('/'):
        if part in ('', '.'):
            continue
        try:
            if part not in os.listdir(cur):
                return False
        except (FileNotFoundError, NotADirectoryError):
            return False
        cur = os.path.join(cur, part)
    return True


def all_pages():
    """repo 裡所有要檢查的 HTML：根目錄、shared/、各學期資料夾"""
    pats = [os.path.join(ROOT, '*.html'),
            os.path.join(ROOT, 'shared', '*.html')]
    pats += [os.path.join(ROOT, t, '*.html') for t in TERMS]
    out = []
    for p in pats:
        out += sorted(glob.glob(p))
    return out


def all_scripts():
    pats = [os.path.join(ROOT, 'shared', '*.js')]
    pats += [os.path.join(ROOT, t, '*.js') for t in TERMS]
    pats += [os.path.join(ROOT, t, 'content', '*.js') for t in TERMS]
    out = []
    for p in pats:
        out += sorted(glob.glob(p))
    return out


# ── 1. 空檔檢查 ─────────────────────────────────────────
def check_empty():
    bases = [ROOT, os.path.join(ROOT, 'shared')] + [os.path.join(ROOT, t) for t in TERMS]
    for base in bases:
        for path in glob.glob(os.path.join(base, '*')):
            name = os.path.basename(path)
            if not os.path.isfile(path) or name in ALLOW_EMPTY:
                continue
            if os.path.getsize(path) == 0:
                errors.append(f'空檔（0 KB）：{rel(path)}')


# ── 2. HTML 結構與死連結 ────────────────────────────────
def check_html():
    for path in all_pages():
        name = rel(path)
        if os.path.getsize(path) == 0:
            continue                      # 已在空檔檢查回報過
        try:
            s = open(path, encoding='utf-8').read()
        except UnicodeDecodeError:
            errors.append(f'{name}：不是 UTF-8 編碼')
            continue

        low = s.lower()
        for tag in ('<html', '<head', '<body', '</body>', '</html>'):
            if tag not in low:
                errors.append(f'{name}：缺少 {tag}')

        for tag in ('div', 'script', 'section', 'main'):
            opens = len(re.findall(r'<%s[\s>]' % tag, low))
            closes = low.count('</%s>' % tag)
            if opens != closes:
                errors.append(f'{name}：<{tag}> 開合不對稱（開 {opens}／關 {closes}）')

        if name in SKIP_REF_CHECK:
            continue

        # 相對路徑以「這個 HTML 自己的位置」為基準解析
        #
        # ★ 不只看 href=/src= 屬性，也看「引號裡的檔名」——
        #   hub.html 的 MODULES 是 JS 物件（href:'social.html'），
        #   只檢查 HTML 屬性會整批漏掉，實際上就發生過：
        #   頁面檔名改了但 MODULES 沒跟，登入後每個課程連結都是 404。
        here = os.path.dirname(path)
        refs = set(re.findall(r'href=[\'"]([^\'"#?:]+\.html)[\'"]', s))
        refs |= set(re.findall(r'src=[\'"]([^\'"#?:]+\.js)[\'"]', s))
        refs |= set(re.findall(r'href=[\'"]([^\'"#?:]+\.css)[\'"]', s))
        refs |= set(re.findall(r'[\'"]([A-Za-z0-9_\-./]+\.html)(?:\?[^\'"]*)?[\'"]', s))

        for ref in refs:
            # 略過：外部網址、絕對路徑、以及 JS 字串拼接的片段（例如 term + '/hub.html'）
            if ref.startswith(('http', '//', 'mailto:', '/')):
                continue
            target = os.path.normpath(os.path.join(here, ref))
            if not os.path.exists(target):
                errors.append(f'{name}：參照到不存在的檔案 {ref}')
            elif not case_exact(target):
                errors.append(f'{name}：{ref} 的大小寫與實際檔名不符 '
                              '（本機可以開，GitHub Pages 會 404）')


# ── 3. JS 語法檢查（需要 node；沒有就跳過並提醒）────────
def check_js():
    node = shutil.which('node')
    if not node:
        warns.append('找不到 node，跳過 JS 語法檢查')
        return

    def node_check(code, label, is_module=False):
        fd, tmp = tempfile.mkstemp(suffix='.mjs' if is_module else '.js')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                f.write(code)
            r = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
            if r.returncode:
                line = next((l for l in r.stderr.splitlines()
                             if 'Error' in l or 'error' in l), r.stderr.strip()[:120])
                errors.append(f'{label}：JS 語法錯誤 — {line.strip()}')
        finally:
            os.unlink(tmp)

    for path in all_scripts():
        node_check(open(path, encoding='utf-8').read(), rel(path))

    for path in all_pages():
        name = rel(path)
        s = open(path, encoding='utf-8').read()
        n = 0
        for attrs, code in re.findall(r'<script([^>]*)>(.*?)</script>', s, re.S):
            if 'src=' in attrs or 'babel' in attrs or not code.strip():
                continue
            n += 1
            node_check(code, f'{name} 第 {n} 個 script', is_module='module' in attrs)


# ── 4. 關鍵檔案是否齊全 ─────────────────────────────────
def check_required():
    required = ['index.html', '.nojekyll',
                'shared/guard.js', 'shared/grading.js',
                'shared/sso.js', 'shared/report.js']
    for t in TERMS:
        required += [f'{t}/config.js', f'{t}/hub.html']
    for r in required:
        if not os.path.exists(os.path.join(ROOT, r)):
            errors.append(f'缺少必要檔案：{r}')


# ── 5. 名冊設定一致性（★ 會讓全班登不進去的那種錯）──────
def check_roster():
    """
    hub 的登入判斷看的是 roster 的 `hasCode` 旗標，
    所以 config 的 COLLECTIONS.ROSTER 必須指向共用的 roster 集合。
    指到舊的 {學期}-roster 會讓全班被判定成首次登入。
    """
    for t in TERMS:
        hub = os.path.join(ROOT, t, 'hub.html')
        cfg_path = os.path.join(ROOT, t, 'config.js')
        if not os.path.exists(hub) or not os.path.exists(cfg_path):
            continue
        if 'hasCode' not in open(hub, encoding='utf-8').read():
            continue                       # 還是舊版 hub，不適用

        cfg = open(cfg_path, encoding='utf-8').read()
        m_col = re.search(r"ROSTER:\s*'([^']+)'", cfg)
        m_shared = re.search(r"SHARED:\s*\{[^}]*?ROSTER:\s*'([^']+)'", cfg, re.S)
        if not m_col or not m_shared:
            continue
        if m_col.group(1) != m_shared.group(1):
            errors.append(
                f'{t}/config.js：hub 已改用 hasCode 判斷，但 COLLECTIONS.ROSTER 還是 '
                f'「{m_col.group(1)}」，應為「{m_shared.group(1)}」，'
                '否則全班會被當成首次登入。')


# ── 6. 批次檔換行（Windows 的 .bat 必須是 CRLF）──────────
def check_bat_crlf():
    """
    .bat 只要變成 LF 換行，cmd 解析 goto／標籤／括號區塊就會錯亂，
    典型症狀是莫名其妙的「系統找不到指定的路徑」。
    """
    for path in glob.glob(os.path.join(ROOT, '*.bat')):
        raw = open(path, 'rb').read()
        if b'\n' in raw and b'\r\n' not in raw:
            errors.append(f'{os.path.basename(path)}：換行是 LF，Windows 批次檔必須用 CRLF')


# ── 7. 學期鎖：測試帳號清單前後端必須一致 ───────────────
def check_test_ids():
    """
    測試帳號豁免清單在兩個地方各有一份：
      shared/semester.js     前端（擋畫面）
      shared/firestore.rules 後端（擋寫入）
    安全規則沒辦法載入 JS，所以只能複製。只改一邊會出現
    「畫面進得去但存不了進度」這種很難查的狀況，這裡守住。
    """
    js = os.path.join(ROOT, 'shared', 'semester.js')
    rl = os.path.join(ROOT, 'shared', 'firestore.rules')
    if not (os.path.exists(js) and os.path.exists(rl)):
        return

    m = re.search(r'TEST_IDS\s*=\s*\[([^\]]*)\]', open(js, encoding='utf-8').read())
    n = re.search(r'isTestAccount\(sid\)\s*\{[^}]*?sid in \[([^\]]*)\]',
                  open(rl, encoding='utf-8').read(), re.S)
    if not m or not n:
        warns.append('找不到 TEST_IDS 或 isTestAccount，略過測試帳號一致性檢查')
        return

    ids = lambda t: sorted(x.strip().strip('\'"') for x in t.split(',') if x.strip())
    a, b = ids(m.group(1)), ids(n.group(1))
    if a != b:
        errors.append('學期鎖的測試帳號清單不一致：\n'
                      f'     semester.js     → {a}\n'
                      f'     firestore.rules → {b}\n'
                      '     兩邊必須相同，否則畫面進得去但進度存不了。')


# ── 8. 每週評分的起算日 ─────────────────────────────────
def check_term_start():
    """
    TERM_START 是「第 1 週的星期一」，每週評分與出席週次都以它為準。

    擋兩件事：
      ① 兩學期填成同一天 —— 幾乎一定是複製忘了改，
         下學期的週次會從上學期開始算，成績全錯。
      ② 不是星期一 —— 週次會整個偏移。
    """
    seen = {}
    for t in TERMS:
        p = os.path.join(ROOT, t, 'config.js')
        if not os.path.exists(p):
            continue
        m = re.search(r"TERM_START:\s*'(\d{4}-\d{2}-\d{2})'", open(p, encoding='utf-8').read())
        if not m:
            continue
        d = m.group(1)
        seen.setdefault(d, []).append(t)

        try:
            import datetime
            if datetime.date.fromisoformat(d).weekday() != 0:
                errors.append(f'{t}/config.js：TERM_START {d} 不是星期一，週次會整個偏移')
        except ValueError:
            errors.append(f'{t}/config.js：TERM_START {d} 不是合法日期')

    for d, terms in seen.items():
        if len(terms) > 1:
            errors.append('／'.join(terms) + f' 的 TERM_START 都是 {d}。'
                          '兩學期不可能同一天開學，八成是複製忘了改 —— '
                          '週次算錯會讓每週評分整批失準。')


def main():
    log('檢查中…\n')
    check_empty()
    check_required()
    check_html()
    check_js()
    check_roster()
    check_bat_crlf()
    check_test_ids()
    check_term_start()

    if warns:
        for w in warns:
            log(f'  ⚠️  {w}')
        log('')

    if errors:
        print('❌ 檢查沒過，先修好再推送：\n')
        for e in errors:
            print(f'   • {e}')
        print(f'\n共 {len(errors)} 個問題。')
        return 1

    log('✅ 檢查通過，可以推送。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
