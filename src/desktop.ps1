param([Parameter(Mandatory=$true)][string]$Root,[switch]$SmokeTest)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Windows.Forms,System.Drawing
$references=@('System.dll','System.Core.dll','System.Xaml.dll','System.Drawing.dll','System.Windows.Forms.dll',[Windows.Window].Assembly.Location,[Windows.Media.Imaging.BitmapSource].Assembly.Location,[Windows.Point].Assembly.Location)
Add-Type -Path (Join-Path $Root 'src\DragonAnimator.cs') -ReferencedAssemblies $references
try{[DragonNative]::SetProcessDpiAwarenessContext([IntPtr](-4))|Out-Null;[DragonNative]::SetThreadDpiAwarenessContext([IntPtr](-4))|Out-Null}catch{}
$script:root=$Root;$script:smoke=[bool]$SmokeTest;$script:closing=$false;$script:sync=$false;$script:settings=$null;$script:view=$null;$script:serial=-1;$script:smokeTicks=0;$script:runtimeTicks=0
$data=if($env:GPT_DRAGON_DATA){$env:GPT_DRAGON_DATA}else{Join-Path $Root '.state'};if($SmokeTest){$data=Join-Path $Root 'work\smoke-state'}
$null=New-Item -ItemType Directory -Path $data -Force
$mutexName='Local\GptDragonPet_'+([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Root))).Replace('/','_').Replace('+','-')+$(if($SmokeTest){'_test'}else{''})
$mutex=[Threading.Mutex]::new($false,$mutexName);$owned=$false
try{$owned=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$owned=$true}
if(!$owned){$mutex.Dispose();return}
function Send-Dragon($Value){if($script:hostProcess -and !$script:hostProcess.HasExited){$script:hostInput.WriteLine(($Value|ConvertTo-Json -Depth 6 -Compress));$script:hostInput.Flush()}}
function Invoke-DragonAction([string]$Name){Send-Dragon @{type='action';name=$Name}}
function Read-Xaml([string]$Name){return [Windows.Markup.XamlReader]::Parse([IO.File]::ReadAllText((Join-Path $script:root ('src\'+$Name)),[Text.Encoding]::UTF8))}
$script:window=Read-Xaml 'pet.xaml';$script:ui=@{}
foreach($name in @('Canvas','Bubble','BubbleCopy','Tail','Girl','Previous')){$script:ui[$name]=$script:window.FindName($name)}
$script:animator=[DragonAnimator]::new($script:window,$script:ui.Canvas,$script:ui.Girl,$script:ui.Previous,$script:ui.Bubble,$Root)
$script:catalog=[IO.File]::ReadAllText((Join-Path $Root 'assets\actions.json'),[Text.Encoding]::UTF8)|ConvertFrom-Json
function New-MenuItem([string]$Label,[string]$Action,[string]$Icon=''){
 $entry=New-Object Windows.Controls.MenuItem;$entry.Header=$Label;$entry.Tag=$Action
 if($Icon){$glyph=New-Object Windows.Controls.TextBlock;$glyph.Text=$Icon;$glyph.Foreground=[Windows.Media.BrushConverter]::new().ConvertFromString('#9273AB');$entry.Icon=$glyph}
 if($Action){$entry.Add_Click({param($sender,$event)$event.Handled=$true;switch([string]$sender.Tag){'settings'{Show-Workroom};'quit'{$script:window.Close()};'roam'{Send-Dragon @{type='preferences';patch=@{roam=[bool]$sender.IsChecked}}};default{Invoke-DragonAction ([string]$sender.Tag)}}})}
 return $entry
}
$script:menu=Read-Xaml 'menu.xaml'
$header=New-Object Windows.Controls.MenuItem;$header.IsEnabled=$false;$header.Padding=[Windows.Thickness]::new(12,9,8,8)
$headerPanel=New-Object Windows.Controls.StackPanel;$title=New-Object Windows.Controls.TextBlock;$title.Text='龙娘的小日常';$title.FontSize=15;$title.FontWeight=[Windows.FontWeights]::SemiBold
$script:menuStatus=New-Object Windows.Controls.TextBlock;$script:menuStatus.Text='在这里陪你';$script:menuStatus.FontSize=11;$script:menuStatus.Margin=[Windows.Thickness]::new(0,5,0,0)
$headerPanel.Children.Add($title)|Out-Null;$headerPanel.Children.Add($script:menuStatus)|Out-Null;$header.Header=$headerPanel;$script:menu.Items.Add($header)|Out-Null
$script:menu.Items.Add((New-Object Windows.Controls.Separator))|Out-Null
$script:actionsMenu=New-MenuItem '动作' '' '◇'
foreach($category in ($script:catalog.category|Select-Object -Unique)){
 $branch=New-MenuItem $category ''
 foreach($action in ($script:catalog|Where-Object category -eq $category)){$branch.Items.Add((New-MenuItem $action.label $action.id))|Out-Null}
 $script:actionsMenu.Items.Add($branch)|Out-Null
}
$script:menu.Items.Add($script:actionsMenu)|Out-Null
foreach($item in @(@('随便来一个','random','✧'),@('摸摸脑袋','pet','♡'),@('睡个小觉','sleep','☾'),@('回到自动状态','auto','↻'))){$script:menu.Items.Add((New-MenuItem $item[0] $item[1] $item[2]))|Out-Null}
$script:menu.Items.Add((New-Object Windows.Controls.Separator))|Out-Null
$script:roamMenu=New-MenuItem '闲时散散步' 'roam';$script:roamMenu.IsCheckable=$true;$script:menu.Items.Add($script:roamMenu)|Out-Null
foreach($item in @(@('打开工作间','settings','⚙'),@('回到屏幕角落','reset','⌂'),@('退出龙娘','quit','×'))){$script:menu.Items.Add((New-MenuItem $item[0] $item[1] $item[2]))|Out-Null}
$script:window.ContextMenu=$script:menu
function Show-Workroom {
 if($script:settings){$script:settings.Show();$script:settings.Activate()|Out-Null;return}
 $script:settings=Read-Xaml 'workroom.xaml';$script:settings.Owner=$script:window;$script:settings.MaxHeight=[Windows.SystemParameters]::WorkArea.Height-36;$script:controls=@{}
 foreach($name in @('Portrait','Status','Size','SizeValue','Roam','IdleActions','Topmost','Bubbles','Reduced','Connection','Connect','Disconnect','Reset','Auto','Think','Work','Wait','Done','Pet','Sleep')){$script:controls[$name]=$script:settings.FindName($name)}
 $script:controls.Portrait.Source=$script:animator.Portrait
 foreach($name in @('Think','Work','Wait','Done','Pet','Sleep')){$script:controls[$name].Add_Click({param($sender,$event)Invoke-DragonAction ([string]$sender.Tag)})}
 $script:controls.Auto.Add_Click({Invoke-DragonAction 'auto'});$script:controls.Reset.Add_Click({Invoke-DragonAction 'reset'})
 foreach($pair in @(@('Roam','roam'),@('IdleActions','idleActions'),@('Topmost','alwaysOnTop'),@('Bubbles','bubbles'),@('Reduced','reducedMotion'))){$control=$script:controls[$pair[0]];$control.Tag=$pair[1];$control.Add_Click({param($sender,$event)if(!$script:sync){$patch=@{};$patch[[string]$sender.Tag]=[bool]$sender.IsChecked;Send-Dragon @{type='preferences';patch=$patch}}})}
 $script:controls.Size.Add_ValueChanged({param($sender,$event)$script:controls.SizeValue.Text=([int]$sender.Value).ToString()+' px';if(!$script:sync){Send-Dragon @{type='preferences';patch=@{size=[int]$sender.Value}}}})
 $script:controls.Connect.Add_Click({
  $dialog=New-Object Microsoft.Win32.OpenFileDialog;$dialog.Title='选择要陪伴的 Codex 会话';$dialog.Filter='Codex 会话 (*.jsonl)|*.jsonl'
  $codexRoot=if($env:CODEX_HOME){$env:CODEX_HOME}else{Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex'};$dialog.InitialDirectory=Join-Path $codexRoot 'sessions'
  if($dialog.ShowDialog($script:settings)){Send-Dragon @{type='session';file=$dialog.FileName}}
 })
 $script:controls.Disconnect.Add_Click({Send-Dragon @{type='session';file=$null}})
 $script:settings.Add_Closed({$script:settings=$null;$script:controls=$null})
 Update-DragonView $script:view
 if($script:smoke){$script:settings.Opacity=0}
 $script:settings.Show();if(!$script:smoke){$script:settings.Activate()|Out-Null}
}
function Update-DragonView($Value){
 if(!$Value){return};$script:view=$Value;$p=$Value.preferences;$size=[double]$p.size
 if([Math]::Abs($script:ui.Girl.Width-$size)-gt .5){$script:animator.Resize($size)}
 $script:animator.Reduced=[bool]$p.reducedMotion;$script:animator.Roam=[bool]$p.roam;$script:window.Topmost=[bool]$p.alwaysOnTop
 $x=if($null-eq $p.x){[double]::NaN}else{[double]$p.x};$y=if($null-eq $p.y){[double]::NaN}else{[double]$p.y};$script:animator.InitializePosition($x,$y)
 $script:ui.Bubble.Width=$size+32;[Windows.Controls.Canvas]::SetLeft($script:ui.Tail,($size+80)*.62)
 if($script:serial-ne $Value.serial){$a=$Value.animation;$script:animator.Play($a.sheet,[int]$a.row,$a.motion,$a.prop,[double]$a.duration);$script:serial=$Value.serial}
 $script:menuStatus.Text=$Value.animation.label;$script:roamMenu.IsChecked=[bool]$p.roam
 if($script:controls){$script:sync=$true
  try{$script:controls.Size.Value=$size;$script:controls.SizeValue.Text=$size.ToString()+' px';$script:controls.Roam.IsChecked=[bool]$p.roam;$script:controls.IdleActions.IsChecked=[bool]$p.idleActions;$script:controls.Topmost.IsChecked=[bool]$p.alwaysOnTop;$script:controls.Bubbles.IsChecked=[bool]$p.bubbles;$script:controls.Reduced.IsChecked=[bool]$p.reducedMotion
   $script:controls.Status.Text=$Value.animation.label
   $script:controls.Connection.Text=if($Value.connection.connected){'已连接，只跟随这个会话的状态。'}elseif($Value.connection.error){[string]$Value.connection.error}else{'选择一个 Codex 会话，跟随工作状态。'}
   $script:controls.Connect.Content=if($Value.connection.connected){'切换会话'}else{'选择会话'};$script:controls.Disconnect.IsEnabled=[bool]$Value.connection.connected
  }finally{$script:sync=$false}
 }
}
$info=New-Object Diagnostics.ProcessStartInfo;$info.FileName=(Get-Command node.exe).Source;$info.Arguments='"'+(Join-Path $Root 'src\host.mjs')+'"';$info.WorkingDirectory=$Root;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.StandardOutputEncoding=[Text.UTF8Encoding]::new($false);$info.StandardErrorEncoding=[Text.UTF8Encoding]::new($false)
$info.EnvironmentVariables['GPT_DRAGON_DATA']=$data;if($SmokeTest){$info.EnvironmentVariables['GPT_DRAGON_SMOKE']='1'}
$script:hostProcess=New-Object Diagnostics.Process;$script:hostProcess.StartInfo=$info;$script:hostProcess.Start()|Out-Null;
# Windows PowerShell otherwise uses the system ANSI code page for child stdin.
$script:hostInput=[IO.StreamWriter]::new($script:hostProcess.StandardInput.BaseStream,[Text.UTF8Encoding]::new($false));$script:hostInput.AutoFlush=$true
$script:runtimeFile=Join-Path $data 'runtime.json';$script:nextLine=$script:hostProcess.StandardOutput.ReadLineAsync();$script:errors=$script:hostProcess.StandardError.ReadToEndAsync()
$script:tray=New-Object Windows.Forms.NotifyIcon
$iconBitmap=[Drawing.Bitmap]::new((Join-Path $Root 'assets\reference.png'));$script:tray.Icon=[Drawing.Icon]::FromHandle($iconBitmap.GetHicon());$script:tray.Text='龙娘 · 在这里陪你';$script:tray.Visible=(!$SmokeTest -and $env:GPT_DRAGON_PLUGIN-ne '1')
$trayMenu=New-Object Windows.Forms.ContextMenuStrip
$trayMenu.Items.Add('打开工作间').Add_Click({Show-Workroom});$trayMenu.Items.Add('回到屏幕角落').Add_Click({Invoke-DragonAction 'reset'});$trayMenu.Items.Add('退出龙娘').Add_Click({$script:window.Close()});$script:tray.ContextMenuStrip=$trayMenu;$script:tray.Add_DoubleClick({Show-Workroom})
function Save-DragonPreview($Element,[string]$File){$Element.UpdateLayout();$width=[int][Math]::Ceiling($Element.ActualWidth);$height=[int][Math]::Ceiling($Element.ActualHeight);$bitmap=[Windows.Media.Imaging.RenderTargetBitmap]::new($width,$height,96,96,[Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($Element);$encoder=[Windows.Media.Imaging.PngBitmapEncoder]::new();$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$stream=[IO.File]::Create($File);try{$encoder.Save($stream)}finally{$stream.Dispose()}}
$script:timer=New-Object Windows.Threading.DispatcherTimer ([Windows.Threading.DispatcherPriority]::Background);$script:timer.Interval=[TimeSpan]::FromMilliseconds(60)
$script:timer.Add_Tick({
 try{
  if($script:hostProcess.HasExited){$script:window.Close();return}
  $count=0
  while($script:nextLine.IsCompleted -and $count-lt 30){$line=$script:nextLine.Result;if($null-eq $line){$script:window.Close();return};$script:nextLine=$script:hostProcess.StandardOutput.ReadLineAsync();$count++;$value=$line|ConvertFrom-Json;if($value.type-eq 'view'){Update-DragonView $value}elseif($value.type-eq 'command'){switch($value.name){'reset'{$script:animator.Reset()};'settings'{Show-Workroom};'close'{$script:window.Close();return}}}}
  foreach($eventLine in $script:animator.Drain()){$script:hostInput.WriteLine($eventLine)}
  if($script:view){$visible=$script:view.preferences.bubbles -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-lt $script:view.messageUntil;$script:ui.Bubble.Visibility=if($visible){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Hidden};$script:ui.Tail.Visibility=$script:ui.Bubble.Visibility;$script:ui.BubbleCopy.Text=[string]$script:view.message}
  $script:runtimeTicks++
  if($script:runtimeTicks%30-eq 0 -and $script:view){$health=@{pid=$PID;hostPid=$script:hostProcess.Id;version='0.2.0';mode=$(if($env:GPT_DRAGON_PLUGIN-eq '1'){'plugin'}else{'standalone'});state=$script:view.state;animation=$script:view.animation.label;connected=[bool]$script:view.connection.connected;fps=[Math]::Round($script:animator.Fps,1);p95Ms=[Math]::Round($script:animator.P95Ms,1);updatedAt=[DateTimeOffset]::UtcNow.ToString('o')};[IO.File]::WriteAllText($script:runtimeFile,($health|ConvertTo-Json))}
  if($script:smoke -and $script:view){
   $script:smokeTicks++
   if($script:smokeTicks-eq 5){Show-Workroom;$script:controls.Work.RaiseEvent([Windows.RoutedEventArgs]::new([Windows.Controls.Button]::ClickEvent))}
   if($script:smokeTicks-eq 13){$script:controls.Size.Value=280}
   if($script:smokeTicks-eq 20){$script:resizePassed=($script:view.preferences.size-eq 280 -and $script:window.ActualWidth-eq 360);$script:controls.Size.Value=220}
   if($script:smokeTicks-eq 27){$script:motionTest=$script:animator.TestMotion();$script:animator.Drain()|Out-Null;foreach($a in $script:catalog){$script:animator.ValidateAction($a.sheet,[int]$a.row,$a.motion,$a.prop)};$script:actionsMenu.Items[3].Items[2].RaiseEvent([Windows.RoutedEventArgs]::new([Windows.Controls.MenuItem]::ClickEvent))}
   if($script:smokeTicks-eq 32){$script:menuActual=$script:view.animation.id;$script:menuExpected=[string]$script:actionsMenu.Items[3].Items[2].Tag;$script:menuPassed=($script:menuActual-eq $script:menuExpected);Invoke-DragonAction 'working'}
   if($script:smokeTicks-eq 80){
    $qa=Join-Path $script:root 'work\qa';$null=New-Item -ItemType Directory -Path $qa -Force
    Save-DragonPreview $script:ui.Canvas (Join-Path $qa 'pet.png');Save-DragonPreview $script:settings.Content (Join-Path $qa 'settings.png')
    $script:hitPassed=$script:animator.HitTestCheck();$script:noTaskbar=(!$script:window.ShowInTaskbar -and !$script:settings.ShowInTaskbar -and $script:settings.Owner-eq $script:window);$script:measuredFps=$script:animator.Fps;$script:measuredP95=$script:animator.P95Ms
    $script:menu.Placement=[Windows.Controls.Primitives.PlacementMode]::AbsolutePoint;$script:menu.HorizontalOffset=80;$script:menu.VerticalOffset=90;$script:menu.Opacity=0;$script:menu.IsOpen=$true
   }
   if($script:smokeTicks-eq 82){Save-DragonPreview ([Windows.Media.VisualTreeHelper]::GetChild($script:menu,0)) (Join-Path $script:root 'work\qa\menu.png');$script:actionsMenu.IsSubmenuOpen=$true}
   if($script:smokeTicks-eq 84){$popup=$script:actionsMenu.Template.FindName('PART_Popup',$script:actionsMenu);Save-DragonPreview $popup.Child (Join-Path $script:root 'work\qa\categories.png');$script:menu.IsOpen=$false
    $test=@{ok=($script:resizePassed -and $script:hitPassed -and $script:menuPassed -and $script:noTaskbar -and $script:animator.FrameCount-eq 64 -and $script:catalog.Count-eq 106 -and $script:motionTest[0]-lt 15 -and $script:motionTest[1]-eq 1 -and $script:motionTest[2]-eq 1);sprites=$script:animator.FrameCount;actions=$script:catalog.Count;categories=$script:actionsMenu.Items.Count;inputEncoding=$script:hostInput.Encoding.WebName;noTaskbar=$script:noTaskbar;menuPassed=$script:menuPassed;menuActual=$script:menuActual;menuExpected=$script:menuExpected;resizePassed=$script:resizePassed;hitPassed=$script:hitPassed;trackingLagPixels=$script:motionTest[0];throwBounded=($script:motionTest[1]-eq 1);landed=($script:motionTest[2]-eq 1);fps=[Math]::Round($script:measuredFps,1);p95Ms=[Math]::Round($script:measuredP95,1)};[IO.File]::WriteAllText((Join-Path $script:root 'work\qa\smoke.json'),($test|ConvertTo-Json));$script:window.Close()
   }
  }
 }catch{[IO.File]::WriteAllText((Join-Path $script:root 'work\native-error.log'),($_|Out-String));$script:window.Close()}
})
$script:window.Add_Closed({
 if($script:closing){return};$script:closing=$true;$script:timer.Stop();$script:menu.IsOpen=$false;if($script:settings){$script:settings.Close()};$script:animator.Dispose();foreach($eventLine in $script:animator.Drain()){$script:hostInput.WriteLine($eventLine)}
 $script:tray.Visible=$false;$script:tray.Dispose();$iconBitmap.Dispose();Send-Dragon @{type='quit'};if(!$script:hostProcess.WaitForExit(1500)){$script:hostProcess.Kill()};$script:hostProcess.Dispose();[Windows.Threading.Dispatcher]::CurrentDispatcher.InvokeShutdown()
})
try{if($SmokeTest){$script:window.Opacity=0};$script:window.Show();$script:animator.Resize(220);$script:timer.Start();[Windows.Threading.Dispatcher]::Run()}
finally{if(!$script:closing){$script:window.Close()};if($owned){$mutex.ReleaseMutex()};$mutex.Dispose()}
