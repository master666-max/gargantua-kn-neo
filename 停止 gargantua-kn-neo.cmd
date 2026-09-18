@echo off
chcp 65001 >nul
rem ============================================================
rem  Double-click this file to STOP the gargantua-kn-neo server
rem  (the process listening on 127.0.0.1:8241).
rem  No administrator rights needed.  Chinese text is printed
rem  from tools\stop-msg-*.txt because cmd.exe cannot parse
rem  non-ASCII characters inside a .cmd file.
rem
rem  Dry run (kills nothing):   "stop gargantua-kn-neo.cmd" -n
rem  Another port:              set KN_PORT=9000 & <this file>
rem ============================================================
setlocal
set "DRY="
if /i "%~1"=="-n" set "DRY=-n"
if /i "%~1"=="/dry" set "DRY=-n"

echo.
type "%~dp0tools\stop-msg-title.txt"
call "%~dp0tools\stop-server.cmd" %DRY%
echo.
if defined DRY (
  echo   Dry run finished: nothing was closed.
) else (
  type "%~dp0tools\stop-msg-footer.txt"
)
echo.
pause
