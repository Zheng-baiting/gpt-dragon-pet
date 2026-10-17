param([Parameter(Mandatory=$true)][string]$Root,[switch]$SmokeTest)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Windows.Forms,System.Drawing
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public static class DragonNative {
 [StructLayout(LayoutKind.Sequential)]public struct Point{public int X,Y;}
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]public static extern bool GetCursorPos(out Point p);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int z,uint flags);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")]public static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
 [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW")]public static extern IntPtr SetWindowLongPtr(IntPtr h,int index,IntPtr value);
 [DllImport("user32.dll")]public static extern bool SetProcessDpiAwarenessContext(IntPtr c);
 [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
}
'@
try{[DragonNative]::SetProcessDpiAwarenessContext([IntPtr](-4))|Out-Null;[DragonNative]::SetThreadDpiAwarenessContext([IntPtr](-4))|Out-Null}catch{}
$script:root=$Root;$script:smoke=[bool]$SmokeTest;$script:closing=$false;$script:down=$null;$script:dragging=$false;$script:sync=$false;$script:settings=$null;$script:view=$null;$script:currentCell='';$script:currentSprite=$null
$data=Join-Path $Root '.state';if($SmokeTest){$data=Join-Path $Root 'work\smoke-state'}
$null=New-Item -ItemType Directory -Path $data -Force
$mutexName='Local\GptDragonPet_'+([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Root))).Replace('/','_').Replace('+','-')+$(if($SmokeTest){'_test'}else{''})
$mutex=[Threading.Mutex]::new($false,$mutexName);$owned=$false
try{$owned=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$owned=$true}
if(!$owned){$mutex.Dispose();return}
function Send-Dragon($Value){if($script:hostProcess -and !$script:hostProcess.HasExited){try{$script:hostProcess.StandardInput.WriteLine(($Value|ConvertTo-Json -Depth 6 -Compress));$script:hostProcess.StandardInput.Flush()}catch{}}}
function Read-Bitmap([string]$File){$bitmap=New-Object Windows.Media.Imaging.BitmapImage;$bitmap.BeginInit();$bitmap.CacheOption=[Windows.Media.Imaging.BitmapCacheOption]::OnLoad;$bitmap.UriSource=[Uri]$File;$bitmap.EndInit();$bitmap.Freeze();return $bitmap}
$atlas=Read-Bitmap (Join-Path $Root 'assets\atlas.png');$walk=Read-Bitmap (Join-Path $Root 'assets\walk.png');$script:sprites=@{}
foreach($index in 0..11){
  $source=$atlas;$columns=4;$rows=2;$cell=$index
  if($index-ge 8){$source=$walk;$rows=1;$cell=$index-8}
  $width=[int]($source.PixelWidth/$columns);$height=[int]($source.PixelHeight/$rows)
  $rect=[Windows.Int32Rect]::new(($cell%4)*$width,[Math]::Floor($cell/4)*$height,$width,$height)
  $bitmap=[Windows.Media.Imaging.CroppedBitmap]::new($source,$rect);$bitmap.Freeze()
  $alpha=[Windows.Media.Imaging.FormatConvertedBitmap]::new($bitmap,[Windows.Media.PixelFormats]::Bgra32,$null,0);$pixels=New-Object byte[] ($width*$height*4);$alpha.CopyPixels($pixels,$width*4,0)
  $script:sprites[$index]=@{bitmap=$bitmap;alpha=$pixels;width=$width;height=$height}
}
$xaml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="龙娘" Width="300" Height="401" WindowStyle="None" ResizeMode="NoResize" AllowsTransparency="True" Background="{x:Null}" ShowInTaskbar="False" ShowActivated="False" Topmost="True" FontFamily="Microsoft YaHei UI">
 <Canvas x:Name="Canvas">
  <Border x:Name="Bubble" Canvas.Left="24" Canvas.Top="14" Width="252" MinHeight="46" MaxHeight="65" Padding="12,10" CornerRadius="18" Background="#FFFCFAFF" BorderBrush="#D3C7E7" BorderThickness="1" Visibility="Hidden"><TextBlock x:Name="BubbleCopy" TextAlignment="Center" TextWrapping="Wrap" FontSize="12" Foreground="#655177"/></Border>
  <Ellipse x:Name="Tail" Canvas.Left="188" Canvas.Top="62" Width="7" Height="7" Fill="#FFFCFAFF" Stroke="#D3C7E7" Visibility="Hidden"/>
  <Image x:Name="Girl" Canvas.Left="40" Canvas.Top="86" Width="220" Height="293" Stretch="Fill" Cursor="Hand" RenderTransformOrigin="0.5,1"><Image.RenderTransform><TransformGroup><ScaleTransform x:Name="PetScale"/><RotateTransform x:Name="PetRotate"/><TranslateTransform x:Name="PetTranslate"/></TransformGroup></Image.RenderTransform></Image>
 </Canvas>
</Window>
'@
$script:window=[Windows.Markup.XamlReader]::Parse($xaml);$script:ui=@{}
foreach($name in @('Canvas','Bubble','BubbleCopy','Tail','Girl','PetScale','PetRotate','PetTranslate')){$script:ui[$name]=$script:window.FindName($name)}
$script:ui.Girl.Source=$script:sprites[0].bitmap;$script:currentSprite=$script:sprites[0]
$interop=[Windows.Interop.WindowInteropHelper]::new($script:window);$script:handle=$interop.EnsureHandle()
$baseEx=[DragonNative]::GetWindowLongPtr($script:handle,-20).ToInt64()-bor 0x08000000-bor 0x80
[DragonNative]::SetWindowLongPtr($script:handle,-20,[IntPtr]$baseEx)|Out-Null
$script:transparent=$false
function Test-DragonHit([Windows.Point]$ScreenPoint){
  if($script:ui.Bubble.Visibility-eq [Windows.Visibility]::Visible){$p=$script:ui.Bubble.PointFromScreen($ScreenPoint);if($p.X-ge 0 -and $p.Y-ge 0 -and $p.X-le $script:ui.Bubble.ActualWidth -and $p.Y-le $script:ui.Bubble.ActualHeight){return $true}}
  $p=$script:ui.Girl.PointFromScreen($ScreenPoint)
  if($p.X-lt 0 -or $p.Y-lt 0 -or $p.X-ge $script:ui.Girl.ActualWidth -or $p.Y-ge $script:ui.Girl.ActualHeight){return $false}
  $x=[int][Math]::Floor($p.X/$script:ui.Girl.ActualWidth*$script:currentSprite.width);$y=[int][Math]::Floor($p.Y/$script:ui.Girl.ActualHeight*$script:currentSprite.height)
  return $script:currentSprite.alpha[($y*$script:currentSprite.width+$x)*4+3]-gt 25
}
$script:messageHook=[Windows.Interop.HwndSourceHook]{param($hwnd,$msg,$w,$l,[ref]$handled)
  if($msg-eq 0x21){$handled.Value=$true;return [IntPtr]3}
  if($msg-eq 0x84 -and !$script:down){$packed=$l.ToInt64();$x=[int]($packed-band 65535);$y=[int](($packed-shr 16)-band 65535);if($x-ge 32768){$x-=65536};if($y-ge 32768){$y-=65536};if(!(Test-DragonHit ([Windows.Point]::new($x,$y)))){$handled.Value=$true;return [IntPtr](-1)}}
  if($msg-eq 0x02E0 -and $script:hostProcess){$script:geometryDue=$true}
  return [IntPtr]::Zero
}
[Windows.Interop.HwndSource]::FromHwnd($script:handle).AddHook($script:messageHook)
function Send-Geometry {
  $rect=[DragonNative+Rect]::new();[DragonNative]::GetWindowRect($script:handle,[ref]$rect)|Out-Null
  $areas=@([Windows.Forms.Screen]::AllScreens|ForEach-Object{$a=$_.WorkingArea;@{x=$a.X;y=$a.Y;width=$a.Width;height=$a.Height}})
  Send-Dragon @{type='geometry';areas=$areas;width=$rect.Right-$rect.Left;height=$rect.Bottom-$rect.Top}
}
function Invoke-DragonAction([string]$Name){Send-Dragon @{type='action';name=$Name}}
function Show-Workroom {
  if($script:settings){$script:settings.Show();$script:settings.Activate()|Out-Null;return}
  $source=[IO.File]::ReadAllText((Join-Path $script:root 'src\workroom.xaml'),[Text.Encoding]::UTF8)
  $script:settings=[Windows.Markup.XamlReader]::Parse($source);$script:controls=@{}
  foreach($name in @('Portrait','Status','Size','SizeValue','Roam','Topmost','Bubbles','Reduced','Connection','Connect','Disconnect','Reset','Auto','Think','Work','Wait','Done','Pet','Sleep')){$script:controls[$name]=$script:settings.FindName($name)}
  $script:controls.Portrait.Source=$script:sprites[0].bitmap
  foreach($name in @('Think','Work','Wait','Done','Pet','Sleep')){$script:controls[$name].Add_Click({param($sender,$event)Invoke-DragonAction ([string]$sender.Tag)})}
  $script:controls.Auto.Add_Click({Invoke-DragonAction 'auto'})
  $script:controls.Reset.Add_Click({Invoke-DragonAction 'reset'})
  foreach($pair in @(@('Roam','roam'),@('Topmost','alwaysOnTop'),@('Bubbles','bubbles'),@('Reduced','reducedMotion'))){$control=$script:controls[$pair[0]];$control.Tag=$pair[1];$control.Add_Click({param($sender,$event)if(!$script:sync){$patch=@{};$patch[[string]$sender.Tag]=[bool]$sender.IsChecked;Send-Dragon @{type='preferences';patch=$patch}}})}
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
  $script:settings.Show();$script:settings.Activate()|Out-Null
}
function Update-DragonView($Value){
  if(!$Value){return};$script:view=$Value;$p=$Value.preferences;$size=[double]$p.size
  $changed=[Math]::Abs($script:ui.Girl.Width-$size)-gt 0.5
  $script:window.Width=$size+80;$script:window.Height=[Math]::Round($size*4/3)+108;$script:ui.Girl.Width=$size;$script:ui.Girl.Height=[Math]::Round($size*4/3);$script:window.Topmost=[bool]$p.alwaysOnTop
  $script:ui.Bubble.Width=$size+32;[Windows.Controls.Canvas]::SetLeft($script:ui.Tail,($size+80)*.62)
  if($changed){$script:geometryDue=$true}
  if($script:controls){
    $script:sync=$true
    try{$script:controls.Size.Value=$size;$script:controls.SizeValue.Text=$size.ToString()+' px';$script:controls.Roam.IsChecked=[bool]$p.roam;$script:controls.Topmost.IsChecked=[bool]$p.alwaysOnTop;$script:controls.Bubbles.IsChecked=[bool]$p.bubbles;$script:controls.Reduced.IsChecked=[bool]$p.reducedMotion
      $labels=@{idle='在这里陪你';thinking='认真想一想';working='正在努力工作';waiting='等你一下';done='这一件，做好了';error='遇到一点问题';sleep='休息一下';walk='出去走两步'};$script:controls.Status.Text=$labels[[string]$Value.state]
      $script:controls.Connection.Text=if($Value.connection.connected){'已连接，只跟随这个会话的状态。'}elseif($Value.connection.error){[string]$Value.connection.error}else{'选择一个 Codex 会话，跟随工作状态。'}
      $script:controls.Connect.Content=if($Value.connection.connected){'切换会话'}else{'选择会话'};$script:controls.Disconnect.IsEnabled=[bool]$Value.connection.connected
    }finally{$script:sync=$false}
  }
}
function Update-DragonFrame($Value){
  $index=if($Value.state-eq 'walk'){8+[int]$Value.pose.walkFrame}else{[int]$Value.pose.cell}
  if($script:currentCell-ne [string]$index){$script:currentCell=[string]$index;$script:currentSprite=$script:sprites[$index];$script:ui.Girl.Source=$script:currentSprite.bitmap}
  $factor=if($Value.facing-eq 'left'){-1}else{1};$pressed=if($script:down){.94}else{1}
  $script:ui.PetScale.ScaleX=[double]$Value.pose.sx/$pressed*$factor;$script:ui.PetScale.ScaleY=[double]$Value.pose.sy*$pressed;$script:ui.PetRotate.Angle=[double]$Value.pose.angle;$script:ui.PetTranslate.Y=[double]$Value.pose.y
  if($Value.position){[DragonNative]::SetWindowPos($script:handle,[IntPtr]::Zero,[int]$Value.position.x,[int]$Value.position.y,0,0,0x15)|Out-Null}
  $visible=$script:view.preferences.bubbles -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-lt $script:view.messageUntil
  $script:ui.Bubble.Visibility=if($visible){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Hidden};$script:ui.Tail.Visibility=$script:ui.Bubble.Visibility;$script:ui.BubbleCopy.Text=[string]$script:view.message
}
$menu=New-Object Windows.Controls.ContextMenu
foreach($item in @(@('打开工作间','settings'),@('摸摸脑袋','pet'),@('休息一下','sleep'),@('回到自动状态','auto'),@('回到屏幕角落','reset'),@('退出龙娘','quit'))){$entry=New-Object Windows.Controls.MenuItem;$entry.Header=$item[0];$entry.Tag=$item[1];$entry.Add_Click({param($sender,$event)switch([string]$sender.Tag){'settings'{Show-Workroom};'quit'{$script:window.Close()};default{Invoke-DragonAction ([string]$sender.Tag)}}});$menu.Items.Add($entry)|Out-Null}
$script:window.ContextMenu=$menu
$script:window.Add_MouseLeftButtonDown({$point=[DragonNative+Point]::new();[DragonNative]::GetCursorPos([ref]$point)|Out-Null;if(Test-DragonHit ([Windows.Point]::new($point.X,$point.Y))){$script:down=@{x=$point.X;y=$point.Y};$script:dragging=$false;$script:window.CaptureMouse()|Out-Null}})
$script:window.Add_MouseLeftButtonUp({if($script:down){Send-Dragon @{type='drag-end'};if(!$script:dragging){Invoke-DragonAction 'pet'};$script:down=$null;$script:dragging=$false;$script:window.ReleaseMouseCapture()}})
$script:window.Add_LostMouseCapture({if($script:down){Send-Dragon @{type='drag-cancel'};$script:down=$null;$script:dragging=$false}})
$info=New-Object Diagnostics.ProcessStartInfo;$info.FileName=(Get-Command node.exe).Source;$info.Arguments='"'+(Join-Path $Root 'src\host.mjs')+'"';$info.WorkingDirectory=$Root;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.StandardOutputEncoding=[Text.UTF8Encoding]::new($false);$info.StandardErrorEncoding=[Text.UTF8Encoding]::new($false)
$info.EnvironmentVariables['GPT_DRAGON_DATA']=$data;if($SmokeTest){$info.EnvironmentVariables['GPT_DRAGON_SMOKE']='1'}
$script:hostProcess=New-Object Diagnostics.Process;$script:hostProcess.StartInfo=$info;$script:hostProcess.Start()|Out-Null;$script:hostProcess.StandardInput.AutoFlush=$true
$script:runtimeFile=Join-Path $data 'runtime.json';$script:runtimeTicks=0
$script:nextLine=$script:hostProcess.StandardOutput.ReadLineAsync();$script:errors=$script:hostProcess.StandardError.ReadToEndAsync();$script:geometryDue=$true
$script:tray=New-Object Windows.Forms.NotifyIcon
$iconBitmap=[Drawing.Bitmap]::new((Join-Path $Root 'assets\reference.png'));$script:tray.Icon=[Drawing.Icon]::FromHandle($iconBitmap.GetHicon());$script:tray.Text='龙娘 · 在这里陪你';$script:tray.Visible=!$SmokeTest
$trayMenu=New-Object Windows.Forms.ContextMenuStrip
$trayMenu.Items.Add('打开工作间').Add_Click({Show-Workroom});$trayMenu.Items.Add('回到屏幕角落').Add_Click({Invoke-DragonAction 'reset'});$trayMenu.Items.Add('退出龙娘').Add_Click({$script:window.Close()});$script:tray.ContextMenuStrip=$trayMenu;$script:tray.Add_DoubleClick({Show-Workroom})
function Save-DragonPreview($Element,[string]$File){$Element.UpdateLayout();$width=[int][Math]::Ceiling($Element.ActualWidth);$height=[int][Math]::Ceiling($Element.ActualHeight);$bitmap=[Windows.Media.Imaging.RenderTargetBitmap]::new($width,$height,96,96,[Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($Element);$encoder=[Windows.Media.Imaging.PngBitmapEncoder]::new();$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$stream=[IO.File]::Create($File);try{$encoder.Save($stream)}finally{$stream.Dispose()}}
$script:smokeTicks=0;$script:timer=New-Object Windows.Threading.DispatcherTimer;$script:timer.Interval=[TimeSpan]::FromMilliseconds(33)
$script:timer.Add_Tick({
  if($script:hostProcess.HasExited){$script:window.Close();return}
  $lastFrame=$null;$count=0
  while($script:nextLine.IsCompleted -and $count-lt 20){$line=$script:nextLine.Result;if($null-eq $line){$script:window.Close();return};$script:nextLine=$script:hostProcess.StandardOutput.ReadLineAsync();$count++;try{$value=$line|ConvertFrom-Json;if($value.type-eq 'view'){Update-DragonView $value}elseif($value.type-eq 'frame'){$lastFrame=$value}}catch{}}
  if($lastFrame){Update-DragonFrame $lastFrame}
  $script:runtimeTicks++
  if($script:runtimeTicks%30-eq 0 -and $script:view){$health=@{pid=$PID;hostPid=$script:hostProcess.Id;state=$script:view.state;connected=[bool]$script:view.connection.connected;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')};[IO.File]::WriteAllText($script:runtimeFile,($health|ConvertTo-Json))}
  if($script:geometryDue){$script:window.UpdateLayout();Send-Geometry;$script:geometryDue=$false}
  $cursor=[DragonNative+Point]::new();[DragonNative]::GetCursorPos([ref]$cursor)|Out-Null
  $hit=Test-DragonHit ([Windows.Point]::new($cursor.X,$cursor.Y))
  if($script:down){Send-Dragon @{type='cursor';x=$cursor.X;y=$cursor.Y};if(!$script:dragging -and [Math]::Sqrt([Math]::Pow($cursor.X-$script:down.x,2)+[Math]::Pow($cursor.Y-$script:down.y,2))-gt 5){$script:dragging=$true;Send-Dragon @{type='drag-start'}}}
  $transparent=!$hit -and !$script:down -and !$script:window.ContextMenu.IsOpen
  if($transparent-ne $script:transparent){$ex=[DragonNative]::GetWindowLongPtr($script:handle,-20).ToInt64();$ex=if($transparent){$ex-bor 0x20}else{$ex-band (-bnot 0x20)};[DragonNative]::SetWindowLongPtr($script:handle,-20,[IntPtr]$ex)|Out-Null;$script:transparent=$transparent}
  if($script:smoke -and $script:view){
    $script:smokeTicks++
    if($script:smokeTicks-eq 8){Show-Workroom;$script:controls.Work.RaiseEvent([Windows.RoutedEventArgs]::new([Windows.Controls.Button]::ClickEvent))}
    if($script:smokeTicks-eq 16){$script:controls.Size.Value=280}
    if($script:smokeTicks-eq 24){$script:resizePassed=($script:view.preferences.size-eq 280 -and $script:window.ActualWidth-eq 360);$script:controls.Size.Value=220}
    if($script:smokeTicks-eq 35){
      $qa=Join-Path $script:root 'work\qa';$null=New-Item -ItemType Directory -Path $qa -Force
      Save-DragonPreview $script:ui.Canvas (Join-Path $qa 'pet.png');Save-DragonPreview $script:settings.Content (Join-Path $qa 'settings.png')
      $empty=$script:ui.Girl.PointToScreen([Windows.Point]::new(0,0));$transparentPass=!(Test-DragonHit $empty)
      $sprite=$script:currentSprite;$opaqueIndex=0;for($i=3;$i-lt $sprite.alpha.Length;$i+=4){if($sprite.alpha[$i]-gt 200){$opaqueIndex=[int](($i-3)/4);break}}
      $opaque=$script:ui.Girl.PointToScreen([Windows.Point]::new((($opaqueIndex%$sprite.width)+.5)/$sprite.width*$script:ui.Girl.ActualWidth,([Math]::Floor($opaqueIndex/$sprite.width)+.5)/$sprite.height*$script:ui.Girl.ActualHeight));$opaquePass=Test-DragonHit $opaque
      $test=@{ok=($script:view.state-eq 'working' -and $script:resizePassed -and $transparentPass -and $opaquePass);sprites=$script:sprites.Count;state=$script:view.state;windowWidth=$script:window.ActualWidth;resizePassed=$script:resizePassed;transparentPass=$transparentPass;opaquePass=$opaquePass;settingsControls=$script:controls.Count};[IO.File]::WriteAllText((Join-Path $qa 'smoke.json'),($test|ConvertTo-Json));$script:window.Close()
    }
  }
})
$script:window.Add_Closed({
  if($script:closing){return};$script:closing=$true;$script:timer.Stop();if($script:settings){$script:settings.Close()};$script:tray.Visible=$false;$script:tray.Dispose();$iconBitmap.Dispose()
  Send-Dragon @{type='quit'};if(!$script:hostProcess.WaitForExit(1500)){$script:hostProcess.Kill()};$script:hostProcess.Dispose()
  [Windows.Threading.Dispatcher]::CurrentDispatcher.InvokeShutdown()
})
try{
  if($SmokeTest){$script:window.Opacity=0}
  $script:window.Show();$script:timer.Start()
  [Windows.Threading.Dispatcher]::Run()
}finally{if(!$script:closing){$script:window.Close()};if($owned){$mutex.ReleaseMutex()};$mutex.Dispose()}
