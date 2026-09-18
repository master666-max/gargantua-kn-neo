' Started at logon: brings the server up HIDDEN and does NOT open a browser.
Option Explicit
Dim sh, fso, url, up, tries
Set sh = CreateObject("WScript.Shell")
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
  Set fso = CreateObject("Scripting.FileSystemObject")
  sh.CurrentDirectory = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
  sh.Run "node tools\serve.mjs 8241", 0, False
  tries = 0
  Do While tries < 25 And Not up
    WScript.Sleep 200
    up = Probe(url)
    tries = tries + 1
  Loop
End If
