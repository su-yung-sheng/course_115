@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM ==========================================================
REM  把「提交前自動檢查」安裝到兩個 repo
REM
REM  安裝之後，用 GitHub Desktop 按 Commit 就會自動跑檢查，
REM  沒過就不會提交，不必再記得先雙擊 check.bat。
REM
REM  什麼時候要重跑這支？
REM    ‧ 第一次設定
REM    ‧ 重新 clone repo 之後（.git 資料夾不會被版控，掛鉤會不見）
REM ==========================================================

echo.
echo ============================================
echo   安裝提交前自動檢查（git hooks）
echo ============================================
echo.

set OK=0

for %%R in (course_11501 course_11502) do (
  if exist "%%R\.git\hooks\" (
    copy /Y "_shared\hooks\pre-commit" "%%R\.git\hooks\pre-commit" >nul
    if errorlevel 1 (
      echo   [X] %%R 安裝失敗
    ) else (
      echo   [OK] %%R
      set /a OK+=1
    )
  ) else (
    echo   [X] %%R 找不到 .git\hooks 資料夾（這個資料夾是 git repo 嗎？）
  )
)

echo.
echo ============================================
echo   完成。接下來照常用 GitHub Desktop：
echo     修改檔案 - 按 Commit - 檢查自動執行
echo.
echo   檢查沒過時，Desktop 會跳出錯誤訊息並取消提交，
echo   訊息裡會寫清楚是哪個檔案、哪一行有問題。
echo ============================================
echo.
pause
