function Import-DragonNative([string]$Root) {
 Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Windows.Forms,System.Drawing
 if('DragonAnimator' -as [type]){return}
 $references=@('System.dll','System.Core.dll','System.Xaml.dll','System.Drawing.dll','System.Windows.Forms.dll',[Windows.Window].Assembly.Location,[Windows.Media.Imaging.BitmapSource].Assembly.Location,[Windows.Point].Assembly.Location)
 $source=Join-Path $Root 'src\DragonAnimator.cs'
 $hash=[Security.Cryptography.SHA256]::Create()
 try{$identity=[IO.File]::ReadAllText($source,[Text.Encoding]::UTF8)+[Environment]::Version.ToString()+[IntPtr]::Size+[Windows.Window].Assembly.FullName;$key=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($identity)))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
 $directory=Join-Path $Root '.generated\native';$null=New-Item -ItemType Directory -Path $directory -Force
 $compiled=Join-Path $directory ('dragon-'+$key+'.dll')
 $guard=[Threading.Mutex]::new($false,('Local\GptDragonNative_'+$key));$owned=$false
 try{
  try{$owned=$guard.WaitOne(30000)}catch [Threading.AbandonedMutexException]{$owned=$true}
  if(!$owned){throw 'Native build is busy. Retry shortly.'}
  if(!(Test-Path -LiteralPath $compiled)){
   $temporary=Join-Path $directory ([Guid]::NewGuid().ToString('N')+'.dll')
   try{Add-Type -Path $source -ReferencedAssemblies $references -OutputAssembly $temporary -OutputType Library;Move-Item -LiteralPath $temporary -Destination $compiled}
   finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary}}
  }
  Add-Type -Path $compiled
 }finally{if($owned){$guard.ReleaseMutex()};$guard.Dispose()}
}
