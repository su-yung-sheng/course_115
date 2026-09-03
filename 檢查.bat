@echo off
rem ── 手動跑一次「提交前檢查」，看完整訊息 ──────────────
rem  GitHub Desktop 按 Commit 失敗時，對話框只會顯示前面幾行，
rem  真正指出問題的那幾行常常被截掉。這支跑的是**同一支** check.py，
rem  但會把完整輸出留在畫面上等你看完。
rem  ⚠️ chcp 65001：把主控台切成 UTF-8。繁中預設的 cp950 編不出
rem     勾勾和叉叉，畫面會變成一堆亂碼（甚至讓檢查自己掛掉）。
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo == 提交前檢查（和按 Commit 時跑的是同一支）==
echo.
set PY=
where python  >nul 2>&1 && set PY=python
if "%PY%"=="" where python3 >nul 2>&1 && set PY=python3
if "%PY%"=="" where py      >nul 2>&1 && set PY=py
if "%PY%"=="" (
  echo 找不到 Python -- 請先安裝，或改用 Git Bash 執行：python shared/check.py
  pause
  exit /b 1
)
"%PY%" shared\check.py
echo.
echo == 上面就是完整訊息；有錯的話整段複製給 Claude ==
pause
