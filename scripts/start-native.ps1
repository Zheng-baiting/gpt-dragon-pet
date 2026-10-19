param([switch]$SmokeTest,[switch]$FollowCodex)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$source=[IO.File]::ReadAllText((Join-Path $root 'src\desktop.ps1'),[Text.Encoding]::UTF8)
& ([ScriptBlock]::Create($source)) -Root $root -SmokeTest:$SmokeTest -FollowCodex:$FollowCodex
