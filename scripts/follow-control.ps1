param([ValidateSet('Start','Restore','Stop','Status','EnableStartup','DisableStartup')][string]$Action='Status',[switch]$CheckOnly)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$data=Join-Path $root '.state'
$configFile=Join-Path $data 'follow.json'
$startup=Join-Path ([Environment]::GetFolderPath('Startup')) 'GPT Dragon Pet.lnk'
$wscript=Join-Path $env:WINDIR 'System32\wscript.exe'
$arguments='"'+(Join-Path $root 'follow-codex.vbs')+'"'
function Read-Config {try{return ([IO.File]::ReadAllText($configFile,[Text.Encoding]::UTF8)|ConvertFrom-Json)}catch{return @{enabled=$false;paused=$false}}}
function Write-Config([bool]$Enabled,[bool]$Paused){
 $null=New-Item -ItemType Directory -Path $data -Force
 [IO.File]::WriteAllText($configFile,(@{enabled=$Enabled;paused=$Paused}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
}
function Read-Health {
 try{
  $health=[IO.File]::ReadAllText((Join-Path $data 'runtime.json'),[Text.Encoding]::UTF8)|ConvertFrom-Json
  if(([DateTimeOffset]::UtcNow-[DateTimeOffset]::Parse($health.updatedAt)).TotalSeconds-gt 15){return $null}
  $null=Get-Process -Id $health.pid -ErrorAction Stop;$null=Get-Process -Id $health.hostPid -ErrorAction Stop
  return $health
 }catch{return $null}
}
function Send-Control([string]$Name){
 $folder=Join-Path $data 'plugin-commands';$null=New-Item -ItemType Directory -Path $folder -Force
 $file=Join-Path $folder ([Guid]::NewGuid().ToString()+'.json')
 [IO.File]::WriteAllText(($file+'.tmp'),(@{name=$Name;expiresAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+10000}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 Move-Item -LiteralPath ($file+'.tmp') -Destination $file
}
function Own-Shortcut {
 if(!(Test-Path -LiteralPath $startup)){return $false}
 $shell=New-Object -ComObject WScript.Shell
 try{$shortcut=$shell.CreateShortcut($startup);return ($shortcut.TargetPath-eq $wscript -and $shortcut.Arguments-eq $arguments)}finally{[Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)|Out-Null}
}
if($CheckOnly){@{action=$Action;startupShortcut=$startup;target=$wscript;arguments=$arguments;exists=(Test-Path -LiteralPath $startup);owned=(Own-Shortcut);root=$root}|ConvertTo-Json;return}
if($Action-eq 'Status'){@{config=(Read-Config);runtime=(Read-Health);startup=(Own-Shortcut)}|ConvertTo-Json -Depth 5;return}
if($Action-eq 'EnableStartup'){
 if((Test-Path -LiteralPath $startup)-and !(Own-Shortcut)){throw 'Startup shortcut belongs to another installation. It was not changed.'}
 $shell=New-Object -ComObject WScript.Shell
 try{$shortcut=$shell.CreateShortcut($startup);$shortcut.TargetPath=$wscript;$shortcut.Arguments=$arguments;$shortcut.WorkingDirectory=$root;$shortcut.Description='White dragon follows Codex windows';$shortcut.WindowStyle=7;$shortcut.Save()}finally{[Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)|Out-Null}
 $Action='Start'
}
if($Action-eq 'DisableStartup'){
 if(Test-Path -LiteralPath $startup){if(!(Own-Shortcut)){throw 'Refusing to remove an unrelated startup shortcut.'};Remove-Item -LiteralPath $startup}
 Write-Config $false $true;$Action='Stop'
}
if($Action-eq 'Stop'){
 $configuration=Read-Config;Write-Config ([bool]$configuration.enabled) $true
 $health=Read-Health
 if($health){
  Send-Control 'close'
  for($attempt=0;$attempt-lt 50;$attempt++){if(!(Get-Process -Id $health.pid -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 100}
  if(Get-Process -Id $health.pid -ErrorAction SilentlyContinue){throw 'Follower did not stop within 5 seconds. No unrelated process was terminated.'}
 }
 Write-Output 'Dragon follower stopped. Project and settings are preserved.';return
}
if($Action-eq 'Restore'){$configuration=Read-Config;if(!$configuration.enabled-or $configuration.paused){Write-Output 'Automatic follow is disabled or paused.';return}}
Write-Config $true $false
$health=Read-Health
if($health){Send-Control 'follow'}else{
 $temporary=Join-Path $root 'work\temp';$null=New-Item -ItemType Directory -Path $temporary -Force
 $env:TEMP=$temporary;$env:TMP=$temporary
 Start-Process -FilePath (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList @('-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"'+(Join-Path $PSScriptRoot 'start-native.ps1')+'"'),'-FollowCodex') -WorkingDirectory $root -WindowStyle Hidden|Out-Null
}
for($attempt=0;$attempt-lt 100;$attempt++){
 Start-Sleep -Milliseconds 150;$health=Read-Health
 if($health-and $health.mode-eq 'follow'){$health|ConvertTo-Json;return}
}
throw 'Dragon follower did not become ready. Check work/native-error.log.'
