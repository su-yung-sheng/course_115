@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0course_11502"

REM ==========================================================
REM  開啟「名冊合併與驗證碼搬家」轉換工具
REM
REM  為什麼要開本機伺服器？
REM    直接雙擊 migrate.html 會是 file:// 來源，部分環境下 Firebase 會擋。
REM    localhost 預設就在 Firebase 的授權網域清單裡，最保險。
REM
REM  用完按 Ctrl+C，或直接關掉這個視窗。
REM ==========================================================

echo.
echo ============================================
echo   名冊合併與驗證碼搬家 · 轉換工具
echo ============================================
echo.

REM ---------- 找 Python ----------
set PY=
where py >nul 2>&1 && set PY=py
if "%PY%"=="" ( where python3 >nul 2>&1 && set PY=python3 )
if "%PY%"=="" ( where python >nul 2>&1 && set PY=python )

if "%PY%"=="" goto :nopython

REM 確認不是 Microsoft Store 的空殼（會直接跳商店、不會執行）
%PY% -c "print(1)" >nul 2>&1
if errorlevel 1 goto :nopython

echo [1/3] Python 就緒：%PY%

REM ---------- 找一個沒被佔用的連接埠 ----------
set PORT=
for %%P in (8000 8080 8888 5500) do (
  if "!PORT!"=="" (
    netstat -ano | findstr /r /c:"LISTENING" | findstr /c:":%%P " >nul 2>&1
    if errorlevel 1 set PORT=%%P
  )
)
if "%PORT%"=="" (
  echo [X] 8000 / 8080 / 8888 / 5500 都被佔用了。
  echo     請關掉其他本機伺服器再試一次。
  goto :end
)
echo [2/3] 使用連接埠：%PORT%

REM ---------- 先起伺服器，等它真的在聽了再開瀏覽器 ----------
REM  （上一版是先開瀏覽器才起伺服器，所以第一下必定「拒絕連線」）
set URL=http://localhost:%PORT%/shared/migrate.html
start "" cmd /c "timeout /t 3 /nobreak >nul & start "" "%URL%""

echo [3/3] 啟動伺服器中，約 3 秒後瀏覽器會自動打開：
echo.
echo        %URL%
echo.
echo     操作順序：教師登入 → ①掃描並預覽 → ②執行轉換 → ③驗證結果
echo.
echo     ★ 掃描後請把「紅色的衝突列」逐筆看過再執行。
echo     ★ 舊集合不會被刪除，出事可以退回去。
echo.
echo     若瀏覽器沒自動開，手動貼上上面那個網址即可。
echo     結束請按 Ctrl+C 或關閉本視窗。
echo ============================================
echo.

%PY% -m http.server %PORT%
goto :end

:nopython
echo [X] 找不到可用的 Python。
echo.
echo     替代方案：直接雙擊 course_11502\shared\migrate.html 開啟。
echo     多數情況下 file:// 也可以正常運作；
echo     若登入時出現 auth/unauthorized-domain，才需要本機伺服器。
echo.

:end
echo.
pause
