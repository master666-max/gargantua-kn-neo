@echo off
rem ============================================================
rem  Double-click this ONCE to REMOVE the auto-start entry that
rem  "install auto-start at logon.cmd" created.  After that the
rem  server only runs when you start it yourself.
rem
rem  This does NOT stop a server that is running right now --
rem  use tools\stop-server.cmd (or the stop launcher) for that.
rem ============================================================
setlocal
set "DST=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\gargantua-kn-neo server.vbs"

echo.
if not exist "%DST%" (
  echo   Auto-start is not installed -- nothing to remove.
  echo.
  pause
  exit /b 0
)

del /F /Q "%DST%" >nul 2>&1
if exist "%DST%" (
  echo   FAILED to remove:
  echo     %DST%
  echo   Try right-clicking this file and choosing 'Run as administrator'.
) else (
  echo   Removed:
  echo     %DST%
  echo.
  echo   The server will no longer start automatically at logon.
)
echo.
pause
