' ============================================================
'  GARGANTUA-KN-NEO  launcher  --  double-click this file
'  (or the .cmd wrapper next to it, which keeps a readable name).
'
'  It does three things and then exits:
'    1. asks http://127.0.0.1:8241/ whether the server is already up;
'    2. if not, starts it HIDDEN (no console window, nothing to close);
'    3. opens the page in your default browser.
'  Running it twice is harmless -- the second run just opens the page.
'
'  The working directory is derived from this script's own location, so the
'  project can live anywhere.
' ============================================================
Option Explicit
Dim sh, fso, url, up, tries
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
url = "http://127.0.0.1:8241/"

Function Probe(u)
  Dim h
  Probe = False
  On Error Resume Next
  Set h = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  h.setTimeouts 800, 800, 800, 800
  h.open "GET", u, False
  h.send
  If Err.Number = 0 Then Probe = True
  Err.Clear
  On Error GoTo 0
End Function

up = Probe(url)
If Not up Then
  sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
  sh.Run "node tools\serve.mjs 8241", 0, False
  tries = 0
  Do While tries < 25 And Not up
    WScript.Sleep 200
    up = Probe(url)
    tries = tries + 1
  Loop
End If
sh.Run url, 1, False
