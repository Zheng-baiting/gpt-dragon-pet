Option Explicit
Dim shell,fso,root,command,code
Set shell=CreateObject("WScript.Shell")
Set fso=CreateObject("Scripting.FileSystemObject")
root=fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory=root
command="powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & root & "\scripts\follow-control.ps1"" -Action Restore"
code=shell.Run(command,0,True)
If code <> 0 Then MsgBox "Dragon follower could not start. Run npm run follow:start in the project folder.",48,"GPT Dragon Pet"
