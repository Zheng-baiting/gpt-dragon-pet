param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$node=(Get-Command node.exe -ErrorAction Stop).Source
$codex=(Get-Command codex.exe -ErrorAction Stop).Source
$package=Join-Path $root '.generated\plugin-package'
$allowed=@('.mcp.json','.codex-plugin\plugin.json','assets\gpt-reference.png')
if(Test-Path -LiteralPath $package){
 foreach($item in (Get-ChildItem -LiteralPath $package -Recurse -Force -File)){
  if($item.FullName.Substring($package.Length+1)-notin $allowed){throw 'Unexpected file in generated plugin package.'}
 }
}
foreach($folder in @($package,(Join-Path $package '.codex-plugin'),(Join-Path $package 'assets'))){New-Item -ItemType Directory -Path $folder -Force|Out-Null}
$config=@{mcpServers=@{'gpt-dragon-pet'=@{command=$node;args=@((Join-Path $root 'src\plugin.mjs'))}}}
[IO.File]::WriteAllText((Join-Path $package '.mcp.json'),($config|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
foreach($file in @('.codex-plugin\plugin.json','assets\gpt-reference.png')){Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $package $file) -Force}
if($CheckOnly){Write-Output 'Thin plugin package verified: 3 files.';return}
& $codex plugin marketplace add $root --json
if($LASTEXITCODE-ne 0){throw 'Could not register this project marketplace.'}
& $codex plugin add 'gpt-dragon-pet@gpt-dragon-local' --json
if($LASTEXITCODE-ne 0){throw 'Could not install the GPT pet plugin.'}
Write-Output 'GPT pet plugin installed. Static preview is opt-in; production videos are not yet available.'
