@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM ==========================================================
REM  本機預覽整個網站
REM
REM  為什麼需要這個？
REM    直接雙擊 HTML 會是 file:// 來源，有兩件事一定會失敗：
REM      - Google 登入（只接受 http / https）
REM      - 部分瀏覽器的模組載入與 fetch
REM    localhost 預設就在 Firebase 的授權網域清單裡，最保險。
REM
REM  用完按 Ctrl+C，或直接關掉這個視窗。
REM ==========================================================

echo.
echo ============================================
echo   本機預覽 - 資訊科技課程系統
echo ============================================
echo.

set PY=
where py >nul 2>&1 && set PY=py
if "%PY%"=="" ( where python3 >nul 2>&1 && set PY=python3 )
if "%PY%"=="" ( where python >nul 2>&1 && set PY=python )
if "%PY%"=="" goto :nopython

%PY% -c "print(1)" >nul 2>&1
if errorlevel 1 goto :nopython
echo [1/3] Python 就緒：%PY%

set PORT=
for %%P in (8000 8080 8888 5500) do (
  if "!PORT!"=="" (
    netstat -ano | findstr /r /c:"LISTENING" | findstr /c:":%%P " >nul 2>&1
    if errorlevel 1 set PORT=%%P
  )
)
if "%PORT%"=="" (
  echo [X] 8000 / 8080 / 8888 / 5500 都被佔用了，請關掉其他本機伺服器。
  goto :end
)
echo [2/3] 使用連接埠：%PORT%

set BASE=http://localhost:%PORT%
start "" cmd /c "timeout /t 3 /nobreak >nul & start "" "%BASE%/index.html""

echo [3/3] 啟動中，約 3 秒後瀏覽器會自動打開總入口。
echo.
echo     常用網址：
echo       總入口          %BASE%/index.html
echo       上學期          %BASE%/11501/hub.html
echo       下學期          %BASE%/11502/hub.html
echo       教師端(上)      %BASE%/11501/teacher.html
echo       教師端(下)      %BASE%/11502/teacher.html
echo       Google 測試     %BASE%/shared/google-test.html
echo       狀態檢查        %BASE%/shared/status.html?term=11501
echo       名冊轉換工具    %BASE%/shared/migrate.html
echo.
echo     結束請按 Ctrl+C 或關閉本視窗。
echo ============================================
echo.

%PY% -m http.server %PORT%
goto :end

:nopython
echo [X] 找不到可用的 Python。
echo     請安裝 Python 後再試：https://www.python.org/downloads/
echo.

:end
echo.
pause
