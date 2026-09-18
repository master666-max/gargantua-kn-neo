@echo off
chcp 65001 >nul
rem ============================================================
rem  Double-click this ONCE.  It copies the hidden server launcher
rem  into your Startup folder, so from now on the server is
rem  already running when you log in and you never start anything.
rem  It does NOT open a browser and it does NOT need admin.
rem ============================================================
set "SRC=%~dp0tools\serve-hidden.vbs"
set "DST=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\gargantua-kn-neo server.vbs"
if not exist "%SRC%" ( echo Source not found: %SRC% & pause & exit /b 1 )
copy /Y "%SRC%" "%DST%" >nul
if errorlevel 1 (
  echo.
  echo   FAILED.  Try right-clicking this file and choosing 'Run as administrator'.
  echo.
) else (
  echo.
  echo   Installed:  %DST%
  echo.
  echo   The server will now start hidden at every logon.
  echo   Open http://127.0.0.1:8241/  any time -- no DSH needed.
  echo.
)
pause
