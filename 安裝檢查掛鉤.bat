@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM ==========================================================
REM  安裝「提交前自動檢查」
REM
REM  裝好之後用 GitHub Desktop 按 Commit 就會自動跑 shared\check.py，
REM  沒過就不會提交。
REM
REM  什麼時候要重跑？
REM    - 第一次設定
REM    - 換電腦或重新 clone 之後（.git 不會被版控，掛鉤會不見）
REM ==========================================================

echo.
echo ============================================
echo   安裝提交前自動檢查（git hook）
echo ============================================
echo.

if not exist ".git\hooks\" (
  echo   [X] 找不到 .git\hooks 資料夾
  echo       這個資料夾是 git repo 嗎？請先用 GitHub Desktop 加入或 clone。
  goto :end
)

copy /Y "shared\hooks\pre-commit" ".git\hooks\pre-commit" >nul
if errorlevel 1 (
  echo   [X] 安裝失敗
) else (
  echo   [OK] 已安裝到 .git\hooks\pre-commit
  echo.
  echo   接下來照常用 GitHub Desktop：改檔案 - 按 Commit - 檢查自動執行
  echo   檢查沒過時 Desktop 會跳出訊息並取消提交
)

:end
echo.
pause
