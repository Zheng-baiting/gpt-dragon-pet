param([switch]$Preview)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$node=(Get-Command node.exe -ErrorAction Stop).Source
$arguments=@(('"'+(Join-Path $root 'src\run.mjs')+'"'))
if($Preview){$arguments+='--preview'}
Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden
