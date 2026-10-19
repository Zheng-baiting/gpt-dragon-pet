param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$node=(Get-Command node.exe -ErrorAction Stop).Source
$codex=(Get-Command codex.exe -ErrorAction Stop).Source
if([int]((& $node --version).TrimStart('v').Split('.')[0])-lt 24){throw 'Node.js 24+ is required.'}
foreach($file in @('src\plugin.mjs','src\plugin-client.mjs','src\desktop.ps1','assets\reference.png','.codex-plugin\plugin.json','.agents\plugins\marketplace.json')){if(!(Test-Path -LiteralPath (Join-Path $root $file))){throw ('Missing plugin file: '+$file)}}
if($CheckOnly){@{ok=$true;root=$root;node=$node;codex=$codex}|ConvertTo-Json;return}
# Local absolute runtime paths are generated here, never committed to Git.
$config=@{mcpServers=@{'gpt-dragon-pet'=@{command=$node;args=@((Join-Path $root 'src\plugin.mjs'))}}}
[IO.File]::WriteAllText((Join-Path $root '.mcp.json'),($config|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
# Codex copies the selected source directory verbatim. Package only the local
# connector, never the repository, .state, development tools or generated frames.
$package=Join-Path $root '.generated\plugin-package'
$allowed=@('.mcp.json','.codex-plugin\plugin.json','assets\reference.png')
if(Test-Path -LiteralPath $package){
 foreach($item in (Get-ChildItem -LiteralPath $package -File -Recurse -Force)){
  $relative=$item.FullName.Substring($package.Length+1)
  if($relative-notin $allowed){throw ('Unexpected file in generated plugin package: '+$relative)}
 }
}
$null=New-Item -ItemType Directory -Force -Path $package,(Join-Path $package '.codex-plugin'),(Join-Path $package 'assets')
foreach($file in $allowed){Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $package $file) -Force}
& $codex plugin marketplace add $root --json
if($LASTEXITCODE-ne 0){throw 'Codex rejected the local plugin source.'}
& $codex plugin add 'gpt-dragon-pet@gpt-dragon-local' --json
if($LASTEXITCODE-ne 0){throw 'Codex rejected the plugin.'}
$catalog=(& $codex plugin list --json)|ConvertFrom-Json
$match=@($catalog.installed|Where-Object{$_.pluginId-eq 'gpt-dragon-pet@gpt-dragon-local' -and $_.installed -and $_.enabled})
if($match.Count-ne 1){throw 'Codex did not report one enabled dragon plugin.'}
Write-Output 'White dragon plugin installed. It displays the pet when its MCP server is loaded; no settings page is required.'
