@echo off
rem ============================================================
rem  Stop the gargantua-kn-neo static server.
rem  Pure cmd + netstat + taskkill: no PowerShell, no admin needed.
rem
rem  Usage:
rem      tools\stop-server.cmd                 stop the listener on 8241
rem      tools\stop-server.cmd -n              dry run, kills nothing
rem      set KN_PORT=9000 ^& tools\stop-server.cmd     use another port
rem
rem  Exit code: 0 = port is free when we are done, 1 = still busy.
rem ============================================================
setlocal
set "PORT=8241"
if not "%KN_PORT%"=="" set "PORT=%KN_PORT%"
set "DRY="
if /i "%~1"=="-n" set "DRY=1"
if /i "%~1"=="/dry" set "DRY=1"

set "TARGET=:%PORT% "
set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano -p TCP ^| findstr /R /C:"%TARGET%.*LISTENING"') do (
  set "FOUND=1"
  if defined DRY (
    echo   [dry run] would stop PID %%p
  ) else (
    taskkill /F /PID %%p >nul 2>&1
    if errorlevel 1 (
      echo   FAILED to stop PID %%p -- try running this file as administrator
    ) else (
      echo   stopped PID %%p
    )
  )
)

if not defined FOUND (
  echo   Nothing is listening on 127.0.0.1:%PORT% -- the service is already off.
  endlocal & exit /b 0
)
if defined DRY (
  echo   Dry run only -- nothing was killed.
  endlocal & exit /b 0
)

netstat -ano -p TCP | findstr /R /C:"%TARGET%.*LISTENING" >nul 2>&1
if errorlevel 1 (
  echo   Port %PORT% is now free.
  endlocal & exit /b 0
) else (
  echo   Port %PORT% is STILL busy -- try running this file as administrator.
  endlocal & exit /b 1
)
