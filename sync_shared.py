#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
共用檔同步（course_115）
==========================================================
`_shared/` 是唯一可以編輯的來源，各 repo 的 `shared/` 都是它的副本。

    python sync_shared.py            把 _shared/ 複製到兩個 repo
    python sync_shared.py --check    只檢查有沒有不一致（不改檔，有差回傳碼 1）

`--check` 給 push.bat 呼叫：只要有人手改了 repo 裡的 shared/ 或忘記同步，
推送就會被擋下來。這樣「改一邊漏另一邊」在流程上就不可能發生。
"""

import os
import sys
import shutil
import filecmp

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, '_shared')
REPOS = ['course_11501', 'course_11502']
CHECK = '--check' in sys.argv

if not os.path.isdir(SRC):
    print('找不到 _shared/，請確認在 course_115 根目錄執行')
    sys.exit(1)

def collect(root):
    """列出 _shared/ 底下所有檔案（含子資料夾，例如 docs/）的相對路徑"""
    out = []
    for base, _dirs, names in os.walk(root):
        for n in names:
            full = os.path.join(base, n)
            out.append(os.path.relpath(full, root).replace('\\', '/'))
    return sorted(out)


files = collect(SRC)
if not files:
    print('_shared/ 是空的，沒有東西可以同步')
    sys.exit(1)

diffs = []
copied = 0

for repo in REPOS:
    dst_dir = os.path.join(ROOT, repo, 'shared')
    if not CHECK:
        os.makedirs(dst_dir, exist_ok=True)

    for name in files:
        src = os.path.join(SRC, name)
        dst = os.path.join(dst_dir, name)

        same = os.path.exists(dst) and filecmp.cmp(src, dst, shallow=False)
        if same:
            continue

        if CHECK:
            reason = '缺少' if not os.path.exists(dst) else '內容不一致'
            diffs.append('%s/shared/%s：%s' % (repo, name, reason))
        else:
            os.makedirs(os.path.dirname(dst), exist_ok=True)   # 子資料夾（docs/）
            shutil.copy2(src, dst)
            copied += 1
            print('  → %s/shared/%s' % (repo, name))

    # 反向檢查：repo 裡有、_shared/ 沒有的孤兒檔
    if os.path.isdir(dst_dir):
        for name in collect(dst_dir):
            if name not in files:
                diffs.append('%s/shared/%s：_shared/ 裡沒有這支，可能是誤放或已刪除' % (repo, name))

if CHECK:
    if diffs:
        print('❌ 共用檔不同步，先執行 python sync_shared.py 再推送：\n')
        for d in diffs:
            print('   • ' + d)
        sys.exit(1)
    print('✅ 共用檔已同步（%d 支）' % len(files))
    sys.exit(0)

if diffs:
    print('\n⚠️ 另外發現：')
    for d in diffs:
        print('   • ' + d)

print('\n✅ 同步完成，更新 %d 個檔案（共用檔 %d 支 × %d 個 repo）'
      % (copied, len(files), len(REPOS)))
