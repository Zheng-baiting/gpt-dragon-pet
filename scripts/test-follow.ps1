$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'load-native.ps1')
$clock=[Diagnostics.Stopwatch]::StartNew();Import-DragonNative $root;$loadMs=$clock.ElapsedMilliseconds
function Pump-Until([ScriptBlock]$Condition){
 $watch=[Diagnostics.Stopwatch]::StartNew()
 while(!$Condition.InvokeReturnAsIs()){
  if($watch.ElapsedMilliseconds-gt 2000){throw 'Follower did not react within 2 seconds.'}
  $frame=[Windows.Threading.DispatcherFrame]::new();$tick=[Windows.Threading.DispatcherTimer]::new();$tick.Interval=[TimeSpan]::FromMilliseconds(5)
  $tick.Tag=$frame;$tick.Add_Tick({param($sender,$event)$sender.Stop();$sender.Tag.Continue=$false});$tick.Start();[Windows.Threading.Dispatcher]::PushFrame($frame)
 }
 return $watch.ElapsedMilliseconds
}
function New-Fixture {
 $value=[Windows.Window]::new();$value.Width=1;$value.Height=1;$value.Left=-32000;$value.Top=-32000;$value.ShowActivated=$false;$value.Opacity=0
 $handle=[Windows.Interop.WindowInteropHelper]::new($value).EnsureHandle()
 # A test-only unowned normal window, invisible and off-screen.
 $extended=[DragonNative]::GetWindowLongPtr($handle,-20).ToInt64()-band (-bnot 0x80)-band (-bnot 0x08000000)
 [DragonNative]::SetWindowLongPtr($handle,-20,[IntPtr]$extended)|Out-Null
 return $value
}
$pet=[Windows.Window]::new();$pet.Width=1;$pet.Height=1;$pet.Left=-32000;$pet.Top=-32000;$pet.ShowInTaskbar=$false;$pet.ShowActivated=$false;$pet.Opacity=0
$handle=[Windows.Interop.WindowInteropHelper]::new($pet).EnsureHandle();$extended=[DragonNative]::GetWindowLongPtr($handle,-20).ToInt64()-bor 0x08000000-bor 0x80
[DragonNative]::SetWindowLongPtr($handle,-20,[IntPtr]$extended)|Out-Null
$fixture=$null;$second=$null;$follower=$null
try{
 $follower=[DragonFollower]::new($pet,$PID)
 if($pet.IsVisible){throw 'No host should leave the pet hidden.'}
 $fixture=New-Fixture;$fixture.Show();$shown=Pump-Until {$pet.IsVisible}
 $fixture.WindowState=[Windows.WindowState]::Minimized;$hidden=Pump-Until {!$pet.IsVisible}
 $fixture.WindowState=[Windows.WindowState]::Normal;$restored=Pump-Until {$pet.IsVisible}
 $fixture.Close();$closed=Pump-Until {!$pet.IsVisible}
 $second=New-Fixture;$second.Show();$reopened=Pump-Until {$pet.IsVisible}
 $second.Close();$null=Pump-Until {!$pet.IsVisible}
 if(![DragonFollower]::TrustedProcess('ChatGPT','C:\Program Files\WindowsApps\OpenAI.Codex_test\app\ChatGPT.exe')){throw 'Store Codex detection failed.'}
 if([DragonFollower]::TrustedProcess('Codex','C:\unrelated\Codex.exe')){throw 'Unrelated executable was accepted.'}
 $report=@{ok=$true;nativeLoadMs=$loadMs;showMs=$shown;minimizeMs=$hidden;restoreMs=$restored;closeMs=$closed;reopenMs=$reopened;noTaskbar=(!$pet.ShowInTaskbar);samePetWindow=$true}
 $folder=Join-Path $root 'work\qa';$null=New-Item -ItemType Directory -Path $folder -Force
 [IO.File]::WriteAllText((Join-Path $folder 'follow.json'),($report|ConvertTo-Json));$report|ConvertTo-Json
}finally{if($follower){$follower.Dispose()};if($fixture){$fixture.Close()};if($second){$second.Close()};$pet.Close()}
