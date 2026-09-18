@echo off
rem Double-click convenience wrapper: starts the server hidden and opens the page.
rem Kept ASCII-only in the body on purpose: cmd.exe cannot reliably parse a .cmd
rem whose body contains non-ASCII bytes (measured: the parser splits them).
start "" wscript.exe "%~dp0start-server.vbs"
exit /b 0
