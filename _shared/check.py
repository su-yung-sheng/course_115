#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
推送前的檔案完整性檢查（兩學期共用）
==========================================================
擋下三種最容易出包、又最難事後發現的情形：
  1. 0 KB 空檔          → 學生點進去看到白畫面
  2. HTML 結構壞掉      → 缺 <html>/<body>/</html>、標籤數量對不上
  3. <script> 語法錯誤  → 整頁 JS 停擺，畫面卡在「載入中」

用法：
  python check.py            檢查後回報，有錯回傳碼 1
  python check.py --quiet    只在有錯時輸出

由 push.bat 自動呼叫（python shared/check.py）；也可以自己單獨執行。
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

# 允許為空的檔案（例如 GitHub Pages 用的旗標檔）
ALLOW_EMPTY = {'.nojekyll'}

# 不做「參照檔案是否存在」檢查的頁面：
#   範本檔的路徑是以「複製到 repo 根目錄之後」的視角寫的，
#   放在 shared/ 裡當然對不上，不是錯誤。
SKIP_REF_CHECK = {'shared/template.html'}

errors = []
warns = []


def log(msg):
    if not QUIET:
        print(msg)


# ── 1. 空檔檢查 ─────────────────────────────────────────
def check_empty():
    for path in glob.glob(os.path.join(ROOT, '*')):
        name = os.path.basename(path)
        if not os.path.isfile(path) or name in ALLOW_EMPTY:
            continue
        if os.path.getsize(path) == 0:
            errors.append(f'空檔（0 KB）：{name}')


# ── 2. HTML 結構檢查 ────────────────────────────────────
def check_html():
    pages = (sorted(glob.glob(os.path.join(ROOT, '*.html')))
             + sorted(glob.glob(os.path.join(ROOT, 'shared', '*.html'))))
    for path in pages:
        name = os.path.relpath(path, ROOT).replace('\\', '/')
        if os.path.getsize(path) == 0:
            continue                      # 已在空檔檢查回報過，不重複洗版
        try:
            s = open(path, encoding='utf-8').read()
        except UnicodeDecodeError:
            errors.append(f'{name}：不是 UTF-8 編碼')
            continue

        low = s.lower()
        for tag in ('<html', '<head', '<body', '</body>', '</html>'):
            if tag not in low:
                errors.append(f'{name}：缺少 {tag}')

        # 開合標籤數量：只檢查最容易漏掉的幾個容器標籤
        for tag in ('div', 'script', 'section', 'main'):
            opens = len(re.findall(r'<%s[\s>]' % tag, low))
            closes = low.count('</%s>' % tag)
            if opens != closes:
                errors.append(f'{name}：<{tag}> 開合不對稱（開 {opens}／關 {closes}）')

        # 常見的死連結：連到不存在的本地檔案
        # ★ 相對路徑要以「這個 HTML 自己的位置」為基準解析，不是 repo 根目錄。
        #   shared/ 底下的頁面寫 config.js 會指到 shared/config.js（不存在），
        #   以前用 ROOT 解析就抓不到這種錯。
        #   例外：template.html 是「複製到 repo 根目錄後才用」的範本，
        #   它的路徑本來就是以根目錄為視角寫的，放在 shared/ 裡當然對不上。
        if name in SKIP_REF_CHECK:
            continue

        here = os.path.dirname(path)
        refs = (re.findall(r'href=[\'"]([^\'"#?:]+\.html)[\'"]', s)
                + re.findall(r'src=[\'"]([^\'"#?:]+\.js)[\'"]', s)
                + re.findall(r'href=[\'"]([^\'"#?:]+\.css)[\'"]', s))
        for ref in set(refs):
            if not os.path.exists(os.path.normpath(os.path.join(here, ref))):
                errors.append(f'{name}：參照到不存在的檔案 {ref}')


# ── 3. JS 語法檢查（需要 node；沒有就跳過並提醒）────────
def check_js():
    node = shutil.which('node')
    if not node:
        warns.append('找不到 node，跳過 JS 語法檢查')
        return

    def node_check(code, label, is_module=False):
        suffix = '.mjs' if is_module else '.js'
        fd, tmp = tempfile.mkstemp(suffix=suffix)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                f.write(code)
            r = subprocess.run([node, '--check', tmp],
                               capture_output=True, text=True)
            if r.returncode:
                line = next((l for l in r.stderr.splitlines()
                             if 'Error' in l or 'error' in l), r.stderr.strip()[:120])
                errors.append(f'{label}：JS 語法錯誤 — {line.strip()}')
        finally:
            os.unlink(tmp)

    # 獨立 .js 檔
    for path in (sorted(glob.glob(os.path.join(ROOT, '*.js')))
                 + sorted(glob.glob(os.path.join(ROOT, 'shared', '*.js')))):
        name = os.path.relpath(path, ROOT).replace('\\', '/')
        node_check(open(path, encoding='utf-8').read(), name)

    # HTML 內嵌 <script>
    for path in (sorted(glob.glob(os.path.join(ROOT, '*.html')))
                 + sorted(glob.glob(os.path.join(ROOT, 'shared', '*.html')))):
        name = os.path.relpath(path, ROOT).replace('\\', '/')
        s = open(path, encoding='utf-8').read()
        blocks = re.findall(r'<script([^>]*)>(.*?)</script>', s, re.S)
        n = 0
        for attrs, code in blocks:
            if 'src=' in attrs or 'babel' in attrs or not code.strip():
                continue
            n += 1
            node_check(code, f'{name} 第 {n} 個 script', is_module='module' in attrs)


# ── 4. 關鍵檔案是否齊全 ─────────────────────────────────
def check_required():
    required = ['index.html', 'config.js', '.nojekyll',
                'shared/guard.js', 'shared/grading.js']
    for r in required:
        if not os.path.exists(os.path.join(ROOT, r)):
            errors.append(f'缺少必要檔案：{r}')
    # 闖關基地：檔名還帶學期前綴，用樣式比對
    if not glob.glob(os.path.join(ROOT, '*hub.html')):
        errors.append('缺少必要檔案：闖關基地（*hub.html）')


# ── 5. 名冊切換一致性（★ 會讓全班登不進去的那種錯）──────
def check_roster_switch():
    """
    hub 的登入判斷改成看 roster 的 `hasCode` 旗標之後，
    名冊來源就必須同時切到共用的 `roster` 集合。

    只推 hub 卻沒切 config，舊名冊裡沒有 hasCode 欄位，
    **全班都會被判定成首次登入**，被帶去重設驗證碼。

    這一條就是為了讓那件事推不上去。
    """
    hubs = glob.glob(os.path.join(ROOT, '*hub.html'))
    cfg_path = os.path.join(ROOT, 'config.js')
    if not hubs or not os.path.exists(cfg_path):
        return

    hub_uses_flag = any('hasCode' in open(h, encoding='utf-8').read() for h in hubs)
    if not hub_uses_flag:
        return                      # 還是舊版 hub，不適用

    cfg = open(cfg_path, encoding='utf-8').read()
    m_col = re.search(r"ROSTER:\s*'([^']+)'", cfg)          # COLLECTIONS.ROSTER
    m_shared = re.search(r"SHARED:\s*\{[^}]*?ROSTER:\s*'([^']+)'", cfg, re.S)
    if not m_col or not m_shared:
        return

    if m_col.group(1) != m_shared.group(1):
        errors.append(
            'hub 已改用 hasCode 判斷，但 config.js 的 COLLECTIONS.ROSTER 還是 '
            f'「{m_col.group(1)}」。\n'
            '     先用 migrate.html 完成名冊轉換，再把它改成 '
            f'「{m_shared.group(1)}」，否則全班會被當成首次登入。')


# ── 6. 批次檔換行（Windows 的 .bat 必須是 CRLF）──────────
def check_bat_crlf():
    """
    .bat 只要變成 LF 換行，cmd 解析 goto／標籤／括號區塊就會錯亂，
    典型症狀是莫名其妙的「系統找不到指定的路徑」。
    用文字編輯器或腳本改過檔案後很容易踩到，所以在這裡守住。
    """
    for path in glob.glob(os.path.join(ROOT, '*.bat')):
        raw = open(path, 'rb').read()
        if b'\n' in raw and b'\r\n' not in raw:
            errors.append(f'{os.path.basename(path)}：換行是 LF，Windows 批次檔必須用 CRLF')


def main():
    log('檢查中…\n')
    check_empty()
    check_required()
    check_html()
    check_js()
    check_roster_switch()
    check_bat_crlf()

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
