// Native rendering and input keep all per-frame work in one UI thread.
// Spring, release-velocity and bounce equations adapted from PC2005-cloud/dsh-pet (MIT).
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Interop;

public static class DragonNative {
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point p);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int z,uint flags);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
 [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW")] public static extern IntPtr SetWindowLongPtr(IntPtr h,int index,IntPtr value);
 [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr c);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
}
public sealed class DragonFrame {
 public BitmapSource Image; public byte[] Pixels; public int Width,Height;
 public DragonFrame(BitmapSource bitmap) { Image=bitmap; Width=bitmap.PixelWidth; Height=bitmap.PixelHeight;
  var alpha=new FormatConvertedBitmap(bitmap,PixelFormats.Bgra32,null,0); Pixels=new byte[Width*Height*4];alpha.CopyPixels(Pixels,Width*4,0); }
}
public sealed class DragonAnimator : IDisposable {
 readonly Window window; readonly Image girl,previous; readonly DragonEffects effects; readonly Border bubble; readonly IntPtr hwnd;
 readonly ScaleTransform scale=new ScaleTransform(); readonly RotateTransform rotate=new RotateTransform(); readonly TranslateTransform translate=new TranslateTransform();
 readonly Dictionary<string,DragonFrame[]> sheets=new Dictionary<string,DragonFrame[]>(); readonly Queue<string> events=new Queue<string>();
 readonly Stopwatch clock=Stopwatch.StartNew(); readonly List<double[]> trail=new List<double[]>(); readonly List<double> frameTimes=new List<double>();
 System.Windows.Forms.Screen[] screens; DragonFrame current; string sheet="core",motion="idle",prop=""; int row,lastX=int.MinValue,lastY=int.MinValue;
 double started,lastRender,fadeStart,squashStart=-100,squashDepth=.82,px,py,vx,vy,offsetX,offsetY,downX,downY,travelEnd,actualWidth=300,actualHeight=401;
 bool positioned,down,dragging,flying,transparent,disposed; int facing=1;
 public bool Reduced {get;set;} public bool Roam {get;set;} public double X {get{return px;}} public double Y {get{return py;}}
 public bool Busy {get{return down||flying;}} public int FrameCount {get{return sheets.Values.Sum(a=>a.Length);}}
 public double Fps {get {return frameTimes.Count>2?1000.0/frameTimes.Average():0;}}
 public double P95Ms {get {if(frameTimes.Count==0)return 0;var a=frameTimes.OrderBy(v=>v).ToArray();return a[(int)((a.Length-1)*.95)];}}
 public string[] Drain(){var a=events.ToArray();events.Clear();return a;}
 void Event(string value){events.Enqueue(value);}
 void PositionEvent(){Event("{\"type\":\"position\",\"x\":"+px.ToString("F2",CultureInfo.InvariantCulture)+",\"y\":"+py.ToString("F2",CultureInfo.InvariantCulture)+"}");}
 void Interaction(string name){Event("{\"type\":\"interaction\",\"name\":\""+name+"\"}");}
 public DragonAnimator(Window window,Canvas canvas,Image girl,Image previous,Border bubble,string root) {
  this.window=window;this.girl=girl;this.previous=previous;this.bubble=bubble;hwnd=new WindowInteropHelper(window).EnsureHandle();
  foreach(string name in new[]{"core","emotion","life","move"}){
   string file=Path.Combine(root,"assets","motion",name+".png");var bitmap=new BitmapImage();bitmap.BeginInit();bitmap.CacheOption=BitmapCacheOption.OnLoad;bitmap.UriSource=new Uri(file);bitmap.EndInit();bitmap.Freeze();
   int w=bitmap.PixelWidth/4,h=bitmap.PixelHeight/4;var frames=new DragonFrame[16];for(int i=0;i<16;i++){var crop=new CroppedBitmap(bitmap,new Int32Rect((i%4)*w,(i/4)*h,w,h));crop.Freeze();frames[i]=new DragonFrame(crop);}sheets[name]=frames;
  }
  current=sheets["core"][0];girl.Source=current.Image;
  var transform=new TransformGroup();transform.Children.Add(scale);transform.Children.Add(rotate);transform.Children.Add(translate);girl.RenderTransform=transform;previous.RenderTransform=transform;girl.RenderTransformOrigin=previous.RenderTransformOrigin=new System.Windows.Point(.5,.9);
  effects=new DragonEffects();effects.IsHitTestVisible=false;canvas.Children.Add(effects);Canvas.SetLeft(effects,40);Canvas.SetTop(effects,86);
  var ex=DragonNative.GetWindowLongPtr(hwnd,-20).ToInt64()|0x08000000|0x80;DragonNative.SetWindowLongPtr(hwnd,-20,new IntPtr(ex));
  HwndSource.FromHwnd(hwnd).AddHook(Hook);RefreshGeometry();
  window.MouseLeftButtonDown+=OnDown;window.MouseLeftButtonUp+=OnUp;window.LostMouseCapture+=OnLost;CompositionTarget.Rendering+=Render;
 }
 public BitmapSource Portrait {get{return sheets["core"][0].Image;}}
 public void Resize(double size){girl.Width=previous.Width=effects.Width=size;girl.Height=previous.Height=effects.Height=Math.Round(size*4/3);window.Width=size+80;window.Height=Math.Round(size*4/3)+108;window.UpdateLayout();RefreshGeometry();}
 public void RefreshGeometry(){DragonNative.Rect r;DragonNative.GetWindowRect(hwnd,out r);actualWidth=Math.Max(1,r.Right-r.Left);actualHeight=Math.Max(1,r.Bottom-r.Top);screens=System.Windows.Forms.Screen.AllScreens;if(positioned)Clamp();}
 public void InitializePosition(double x,double y){if(positioned)return;positioned=true;if(double.IsNaN(x)||double.IsNaN(y)){Reset();return;}px=x;py=y;Clamp();MoveWindow();}
 System.Drawing.Rectangle Area(double x,double y){var closest=screens[0].WorkingArea;double distance=double.MaxValue;foreach(var s in screens){var a=s.WorkingArea;if(a.Contains((int)x,(int)y))return a;double dx=x-Math.Max(a.Left,Math.Min(a.Right,x)),dy=y-Math.Max(a.Top,Math.Min(a.Bottom,y)),d=dx*dx+dy*dy;if(d<distance){distance=d;closest=a;}}return closest;}
 void Clamp(){var a=Area(px+actualWidth/2,py+actualHeight/2);px=Math.Max(a.Left,Math.Min(Math.Max(a.Left,a.Right-actualWidth),px));py=Math.Max(a.Top,Math.Min(Math.Max(a.Top,a.Bottom-actualHeight),py));}
 public void Reset(){var a=System.Windows.Forms.Screen.PrimaryScreen.WorkingArea;px=a.Left+40;py=a.Bottom-actualHeight;flying=false;travelEnd=0;positioned=true;Clamp();MoveWindow();PositionEvent();}
 void MoveWindow(){int x=(int)Math.Round(px),y=(int)Math.Round(py);if(x==lastX&&y==lastY)return;DragonNative.SetWindowPos(hwnd,IntPtr.Zero,x,y,0,0,0x15);lastX=x;lastY=y;}
 public bool Hit(double sx,double sy){
  var point=new System.Windows.Point(sx,sy);
  if(bubble.Visibility==Visibility.Visible){var b=bubble.PointFromScreen(point);if(b.X>=0&&b.Y>=0&&b.X<bubble.ActualWidth&&b.Y<bubble.ActualHeight)return true;}
  var p=girl.PointFromScreen(point);if(p.X<0||p.Y<0||p.X>=girl.ActualWidth||p.Y>=girl.ActualHeight||girl.ActualWidth<=0)return false;
  int x=(int)(p.X/girl.ActualWidth*current.Width),y=(int)(p.Y/girl.ActualHeight*current.Height);return current.Pixels[(y*current.Width+x)*4+3]>25;
 }
 IntPtr Hook(IntPtr h,int msg,IntPtr w,IntPtr l,ref bool handled){
  if(msg==0x21){handled=true;return new IntPtr(3);}
  if(msg==0x84&&!down){long p=l.ToInt64();int x=(short)(p&65535),y=(short)((p>>16)&65535);if(!Hit(x,y)){handled=true;return new IntPtr(-1);}}
  if(msg==0x02e0||msg==0x007e)window.Dispatcher.BeginInvoke(new Action(RefreshGeometry));return IntPtr.Zero;
 }
 void OnDown(object sender,MouseButtonEventArgs e){DragonNative.Point p;DragonNative.GetCursorPos(out p);if(!Hit(p.X,p.Y))return;BeginPointer(p.X,p.Y);window.CaptureMouse();e.Handled=true;}
 public void BeginPointer(double x,double y){down=true;dragging=false;flying=false;travelEnd=0;downX=x;downY=y;offsetX=x-px;offsetY=y-py;vx=vy=0;trail.Clear();trail.Add(new[]{clock.Elapsed.TotalSeconds,x,y});squashStart=clock.Elapsed.TotalSeconds;squashDepth=.82;}
 void OnUp(object sender,MouseButtonEventArgs e){if(!down)return;EndPointer(false);window.ReleaseMouseCapture();e.Handled=true;}
 void OnLost(object sender,MouseEventArgs e){if(down)EndPointer(true);}
 public void EndPointer(bool cancelled){
  if(!down)return;down=false;double now=clock.Elapsed.TotalSeconds;
  if(!dragging){if(!cancelled)Interaction("click");return;}
  dragging=false;vx=vy=0;
  var samples=trail.Where(a=>now-a[0]<=.15).ToArray();
  if(!cancelled&&!Reduced&&samples.Length>=2){var first=samples[0];var last=samples[samples.Length-1];double span=last[0]-first[0],dx=last[1]-first[1],dy=last[2]-first[2];if(span>=.02&&now-last[0]<=.15){double baseSpeed=Math.Sqrt(dx*dx+dy*dy)/span,peak=baseSpeed;for(int i=1;i<samples.Length;i++){double dt=samples[i][0]-samples[i-1][0];if(dt>=.008)peak=Math.Max(peak,Math.Sqrt(Math.Pow(samples[i][1]-samples[i-1][1],2)+Math.Pow(samples[i][2]-samples[i-1][2],2))/dt);}double speed=3600*(1-Math.Exp(-(.5*baseSpeed+.5*peak)/3600));double distance=Math.Sqrt(dx*dx+dy*dy);if(speed>=500&&distance>0){vx=dx/distance*speed;vy=dy/distance*speed;flying=true;}}}
  if(!flying){Interaction("release");squashStart=now;squashDepth=.85;}PositionEvent();
 }
 public void Play(string sheet,int row,string motion,string prop,double duration){
  if(!sheets.ContainsKey(sheet)||row<0||row>3)throw new ArgumentException("Unknown animation frames.");
  this.sheet=sheet;this.row=row;this.motion=motion;this.prop=prop;started=clock.Elapsed.TotalSeconds;
  if(motion=="turn")facing*=-1;
  if(motion=="run"||motion=="crabwalk"||motion=="float"||motion=="pace")travelEnd=Reduced?0:started+Math.Min(duration,5);else travelEnd=0;
 }
 public void Squash(){squashStart=clock.Elapsed.TotalSeconds;squashDepth=.72;}
 public void ValidateAction(string actionSheet,int actionRow,string actionMotion,string actionProp){
  Play(actionSheet,actionRow,actionMotion,actionProp,10);Paint(started+.7);
  effects.Measure(new Size(girl.Width,girl.Height));effects.Arrange(new Rect(0,0,girl.Width,girl.Height));
  var bitmap=new RenderTargetBitmap((int)girl.Width,(int)girl.Height,96,96,PixelFormats.Pbgra32);bitmap.Render(effects);
 }
 void Render(object sender,EventArgs e){
  if(disposed||!positioned)return;double now=clock.Elapsed.TotalSeconds,raw=now-lastRender;if(raw<.001)return;
  if(lastRender>0){frameTimes.Add(raw*1000);if(frameTimes.Count>180)frameTimes.RemoveAt(0);}lastRender=now;
  double dt=Math.Min(.05,raw);DragonNative.Point mouse;DragonNative.GetCursorPos(out mouse);
  StepMotion(dt,now,mouse.X,mouse.Y);Paint(now);MoveWindow();
  bool menu=window.ContextMenu!=null&&window.ContextMenu.IsOpen;
  bool pass=!down&&!menu&&!Hit(mouse.X,mouse.Y);if(pass!=transparent){long ex=DragonNative.GetWindowLongPtr(hwnd,-20).ToInt64();DragonNative.SetWindowLongPtr(hwnd,-20,new IntPtr(pass?ex|0x20:ex&~0x20));transparent=pass;}
 }
 void StepMotion(double dt,double now,double mouseX,double mouseY){
  if(down){
   
   if(!dragging&&Math.Sqrt(Math.Pow(mouseX-downX,2)+Math.Pow(mouseY-downY,2))>4){dragging=true;Interaction("drag-start");}
   if(dragging){trail.Add(new[]{now,mouseX,mouseY});trail.RemoveAll(sample=>now-sample[0]>.2);
    // Same damped spring equation, with tighter 60+ Hz tracking. Substeps avoid frame-spike instability.
    double remaining=dt;while(remaining>0){double step=Math.Min(1.0/120,remaining);vx+=((mouseX-offsetX-px)*680-vx*42)*step;vy+=((mouseY-offsetY-py)*680-vy*42)*step;px+=vx*step;py+=vy*step;remaining-=step;}
    var a=Area(mouseX,mouseY);px=Math.Max(a.Left,Math.Min(a.Right-actualWidth,px));py=Math.Max(a.Top,Math.Min(a.Bottom-actualHeight,py));
   }return;
  }
  if(flying){
   var a=Area(px+actualWidth/2,py+actualHeight/2);double bottom=Math.Max(a.Top,a.Bottom-actualHeight),right=Math.Max(a.Left,a.Right-actualWidth);
   vy+=1400*dt;px+=vx*dt;py+=vy*dt;
   if(px<a.Left){px=a.Left;vx=Math.Abs(vx)*.78;}if(px>right){px=right;vx=-Math.Abs(vx)*.78;}if(py<a.Top){py=a.Top;vy=Math.Abs(vy)*.78;}
   if(py>=bottom){py=bottom;double impact=Math.Abs(vy);vx*=Math.Max(0,1-2.5*dt);vy=impact<45?0:-impact*.65;if(impact>150){squashStart=now;squashDepth=Math.Max(.62,1-impact/2200);}if(Math.Abs(vx)<15&&Math.Abs(vy)<1){flying=false;vx=vy=0;Interaction("land");PositionEvent();}}
   return;
  }
  if(now<travelEnd&&!Reduced){double speed=motion=="run"?95:motion=="float"?22:35;if(motion=="pace")speed*=Math.Cos((now-started)*2);px+=facing*speed*dt;var a=Area(px+actualWidth/2,py+actualHeight/2);if(px<a.Left||px+actualWidth>a.Right)facing*=-1;Clamp();}
  else if(travelEnd>0){travelEnd=0;PositionEvent();}
 }
 void Paint(double now){
  double t=now-started;string activeSheet=sheet;int activeRow=row;string kind=motion;
  if(dragging||flying){activeSheet="emotion";activeRow=3;kind="drag";}
  double frameSeconds=kind=="idle"?.95:kind=="sleep"?.85:kind=="run"?.11:kind=="type"?.32:kind=="think"?.65:.27;
  int phase=Reduced?0:(int)(t/frameSeconds)%4;
  if(kind=="idle")phase=(t%6.4>5.8?2:(int)(t/2.9)%2);
  int index=activeRow*4+phase;var next=sheets[activeSheet][index];
  if(current!=next){previous.Source=girl.Source;previous.Opacity=1;current=next;girl.Source=next.Image;fadeStart=now;}
  double fade=Reduced?1:Math.Min(1,(now-fadeStart)/.085);girl.Opacity=fade;previous.Opacity=1-fade;
  double sx=1,sy=1,y=0,angle=0;double speed=Math.Sqrt(vx*vx+vy*vy);
  if(!Reduced){
   double breath=Math.Sin(t*2.1)*.008;sx=1-breath;sy=1+breath;y=Math.Sin(t*2.1)*1.0;
   switch(kind){
    case "jump":case "celebrate":y=-Math.Abs(Math.Sin(t*3.5))*14;break;
    case "tickle":angle=Math.Sin(t*13)*3.8;y=-Math.Abs(Math.Sin(t*7))*3;break;
    case "pout":angle=Math.Sin(t*9)*2*(.5+.5*Math.Cos(t));break;
    case "shy":angle=Math.Sin(t*2)*3;break;
    case "dance":angle=Math.Sin(t*4)*7;y=-Math.Abs(Math.Sin(t*4))*7;break;
    case "sway":angle=Math.Sin(t*3)*6;break;
    case "stretch":sy=1+Math.Sin(t*1.2)*.04;break;
    case "squat":sy=.85+Math.Cos(t*2)*.1;sx=1+(1-sy)*.3;break;
    case "float":y=-8-Math.Sin(t*2)*7;break;
    case "bow":angle=Math.Sin(t*1.5)*2;sy=.98+Math.Sin(t*1.5)*.02;break;
    case "sleep":sy=1+Math.Sin(t)*.01;break;
    case "drag":angle=Math.Max(-18,Math.Min(18,vx*.012));sy=1+Math.Min(.05,speed/25000);break;
    case "spin":sx=.7+.3*Math.Abs(Math.Cos(t*3));break;
    case "wake":if(t%5>3){y=-Math.Abs(Math.Sin(t*8))*9;angle=Math.Sin(t*18)*2;}break;
    case "tail":angle=Math.Sin(t*5)*4;break;
    case "ride":y=Math.Sin(t*5)*7;angle=Math.Sin(t*2.5)*4;break;
    case "swing":angle=Math.Sin(t*1.6)*12;y=-Math.Abs(Math.Sin(t*1.6))*10;break;
    case "surprise":y=-Math.Abs(Math.Sin(t*3))*10;break;
   }
   double u=(now-squashStart)/.28;if(u>=0&&u<1){double q=u<.35?1-(1-squashDepth)*Math.Pow(u/.35,2):squashDepth+(1-squashDepth)*(1+2.70158*Math.Pow((u-.35)/.65-1,3)+1.70158*Math.Pow((u-.35)/.65-1,2));sy*=q;sx*=1/Math.Sqrt(Math.Max(.5,q));}
  }
  scale.ScaleX=sx*facing;scale.ScaleY=sy;rotate.Angle=angle;translate.Y=y;
  effects.Prop=(dragging||flying)?"":prop;effects.Time=Reduced?0:t;effects.Kind=kind;effects.InvalidateVisual();
 }
 public bool HitTestCheck(){var empty=girl.PointToScreen(new System.Windows.Point(0,0));bool emptyOK=!Hit(empty.X,empty.Y);int pixel=0;for(int i=3;i<current.Pixels.Length;i+=4)if(current.Pixels[i]>240){pixel=(i-3)/4;break;}var opaque=girl.PointToScreen(new System.Windows.Point((pixel%current.Width+.5)/current.Width*girl.ActualWidth,(pixel/current.Width+.5)/current.Height*girl.ActualHeight));return emptyOK&&Hit(opaque.X,opaque.Y);}
 public double[] TestMotion(){
  double startX=px,startY=py;var a=Area(px,py);px=a.Left+20;py=a.Top+50;BeginPointer(px+100,py+100);
  double now=clock.Elapsed.TotalSeconds,target=px+100,mouseY=py+100;
  for(int i=0;i<120;i++){target+=1;StepMotion(1.0/120,now+i/120.0,target,mouseY);}
  double lag=(target-offsetX)-px;EndPointer(true);
  flying=true;vx=2500;vy=-1100;bool bounded=true;
  for(int i=0;i<2000&&flying;i++){
   StepMotion(1.0/120,now+1+i/120.0,0,0);
   bounded=bounded&&px>=a.Left-.01&&py>=a.Top-.01&&px<=Math.Max(a.Left,a.Right-actualWidth)+.01&&py<=Math.Max(a.Top,a.Bottom-actualHeight)+.01;
  }
  bool landed=!flying;flying=false;px=startX;py=startY;MoveWindow();return new[]{lag,bounded?1:0,landed?1:0};
 }
 public void Dispose(){if(disposed)return;disposed=true;CompositionTarget.Rendering-=Render;window.MouseLeftButtonDown-=OnDown;window.MouseLeftButtonUp-=OnUp;window.LostMouseCapture-=OnLost;PositionEvent();}
}

public sealed class DragonEffects : FrameworkElement {
 public string Prop="",Kind="";public double Time;
 static SolidColorBrush B(string color){var b=new SolidColorBrush((Color)ColorConverter.ConvertFromString(color));b.Freeze();return b;}
 static readonly Brush Ink=B("#705885"),White=B("#FFFDF8"),Purple=B("#B79BD4"),Pink=B("#E8AFCB"),Gold=B("#F5D283"),Green=B("#A4BF87"),Blue=B("#9ECADD");
 static Brush Volume(string light,string dark){var b=new LinearGradientBrush((Color)ColorConverter.ConvertFromString(light),(Color)ColorConverter.ConvertFromString(dark),65);b.Freeze();return b;}
 static void Ell(DrawingContext c,Brush b,double x,double y,double rx,double ry){c.DrawEllipse(b,new Pen(Ink,.6),new System.Windows.Point(x,y),rx,ry);}
 static void Box(DrawingContext c,Brush b,double x,double y,double w,double h,double r){c.DrawRoundedRectangle(b,new Pen(Ink,.7),new Rect(x,y,w,h),r,r);}
 static void Line(DrawingContext c,Brush b,double x,double y,double xx,double yy,double width){c.DrawLine(new Pen(b,width),new System.Windows.Point(x,y),new System.Windows.Point(xx,yy));}
 static void Text(DrawingContext c,string s,double x,double y,double size,Brush b){c.DrawText(new FormattedText(s,CultureInfo.InvariantCulture,FlowDirection.LeftToRight,new Typeface("Microsoft YaHei UI"),size,b,1.0),new System.Windows.Point(x,y));}
 static void Poly(DrawingContext c,Brush b,params double[] points){var g=new StreamGeometry();using(var x=g.Open()){x.BeginFigure(new System.Windows.Point(points[0],points[1]),true,true);for(int i=2;i<points.Length;i+=2)x.LineTo(new System.Windows.Point(points[i],points[i+1]),true,false);}g.Freeze();c.DrawGeometry(b,new Pen(Ink,.6),g);}
 static void Star(DrawingContext c,double x,double y,double r,Brush color){var pts=new double[20];for(int i=0;i<10;i++){double a=-Math.PI/2+i*Math.PI/5,rr=i%2==0?r:r*.43;pts[i*2]=x+Math.Cos(a)*rr;pts[i*2+1]=y+Math.Sin(a)*rr;}Poly(c,color,pts);}
 static void Flower(DrawingContext c,double x,double y,Brush color){for(int i=0;i<5;i++){double a=i*Math.PI*2/5;Ell(c,color,x+Math.Cos(a)*4,y+Math.Sin(a)*4,3.2,3.2);}Ell(c,Gold,x,y,2,2);}
 static void Bowl(DrawingContext c,double x,double y,string type){Ell(c,Volume("#FEF8FF","#B5A0CD"),x,y+5,18,10);Ell(c,White,x,y,18,5);if(type=="rice"||type=="porridge"||type=="noodles"||type=="tangyuan"||type=="dumplings"){for(int i=0;i<6;i++)Ell(c,type=="porridge"?Pink:White,x-10+i*4,y+Math.Sin(i)*1.5,type=="dumplings"?3.5:2.6,2.5);}else{Ell(c,Green,x-6,y,6,3);Ell(c,Gold,x+5,y,7,3);}}
 static void Cat(DrawingContext c,double x,double y,Brush color){Ell(c,color,x,y+4,11,12);Poly(c,color,x-10,y-2,x-10,y-15,x-1,y-6);Poly(c,color,x+10,y-2,x+10,y-15,x+1,y-6);Ell(c,color,x,y-4,11,9);Ell(c,Ink,x-4,y-5,.7,1);Ell(c,Ink,x+4,y-5,.7,1);Line(c,Ink,x-2,y,x,y+1,.6);}
 protected override void OnRender(DrawingContext c){base.OnRender(c);if(string.IsNullOrEmpty(Prop)||ActualWidth<1)return;c.PushTransform(new ScaleTransform(ActualWidth/100,ActualHeight/133.333));double t=Time,x=50,y=91+Math.Sin(t*3)*1.2;
  string p=Prop;
  if(p=="hearts"||p=="sparkles"||p=="stars"||p=="starbreak"||p=="notes"||p=="sleep"||p=="thought"||p=="foodthought"||p=="sweat"||p=="dust"){
   for(int i=0;i<4;i++){double phase=(t*.3+i*.25)%1,xx=18+i*21+Math.Sin(t+i)*3,yy=48-phase*28;
    c.PushOpacity(Math.Sin(phase*Math.PI)*.9);
    if(p=="hearts")Text(c,"♥",xx,yy,8,Pink);else if(p=="notes")Text(c,i%2==0?"♪":"♫",xx,yy,10,Purple);else if(p=="sleep")Text(c,"z",xx,yy,5+phase*5,Purple);else if(p=="thought"||p=="foodthought"){Ell(c,White,xx,yy,3+phase*3,3+phase*2);if(p=="foodthought")Text(c,"?",xx-2,yy-5,7,Purple);}else if(p=="sweat")Ell(c,Blue,xx,yy,1.3,3.5);else if(p=="dust")Ell(c,White,xx,123-phase*10,4,1.5);else Star(c,xx,yy,3+phase*3,Gold);c.Pop();
   }c.Pop();return;
  }
  if(p=="bubbles"){for(int i=0;i<9;i++){double a=(t*.22+i*.11)%1;Ell(c,new SolidColorBrush(Color.FromArgb(60,150,205,240)),12+i*10+Math.Sin(t+i)*4,110-a*85,2+a*4,2+a*4);}c.Pop();return;}
  if(p=="animals"||p=="flowers"||p=="fireworks"||p=="leaves"){
   for(int i=0;i<5;i++){double a=t*1.2+i*1.256,xx=50+Math.Cos(a)*39,yy=58+Math.Sin(a)*30;
    if(p=="flowers")Flower(c,xx,yy,i%2==0?Pink:Purple);else if(p=="animals"){c.PushTransform(new ScaleTransform(.55,.55,xx,yy));Cat(c,xx,yy,i%2==0?Gold:White);c.Pop();}else if(p=="leaves"){c.PushTransform(new RotateTransform(t*60+i*40,xx,yy));Ell(c,i%2==0?Gold:Pink,xx,yy,2,6);c.Pop();}else{double spread=(t*.7+i*.2)%1*13;for(int j=0;j<8;j++){double b=j*Math.PI/4;Star(c,xx+Math.Cos(b)*spread,yy+Math.Sin(b)*spread,1.3,i%2==0?Pink:Gold);}}}
   c.Pop();return;
  }
  if(p=="dragon"){c.PushTransform(new TranslateTransform(22*Math.Sin(t*.8),-35+Math.Sin(t*2)*4));Ell(c,Volume("#FFFFFF","#CBB9EB"),50,70,29,10);Ell(c,White,73,62,10,10);Poly(c,White,67,56,65,41,73,54);Poly(c,White,77,54,84,41,82,59);Poly(c,Purple,32,67,30,44,49,63);Ell(c,Purple,77,61,1.8,2.5);c.Pop();c.Pop();return;}
  if(p=="kite"||p=="balloon"||p=="lantern"||p=="bird"){
   double xx=70+Math.Sin(t)*8,yy=15+Math.Sin(t*1.7)*5;if(p!="bird")Line(c,Ink,52,87,xx,yy+12,.6);
   if(p=="kite")Poly(c,Volume("#F4E7FF","#A987C7"),xx,yy-12,xx+10,yy,xx,yy+13,xx-10,yy);else if(p=="balloon")Ell(c,Volume("#FFF0F8","#D898C0"),xx,yy,9,12);else if(p=="lantern"){Box(c,Volume("#FFE8B8","#E7A47F"),xx-9,yy-10,18,23,4);Ell(c,Gold,xx,yy+10,7,2);}else{Ell(c,White,xx,yy,8,4);Poly(c,White,xx-3,yy,xx-14,yy-10*Math.Sin(t*7),xx-1,yy-2);Poly(c,Gold,xx+7,yy,xx+13,yy+1,xx+7,yy+3);}c.Pop();return;
  }
  if(p=="swing"){Line(c,Purple,25,0,32+Math.Sin(t*1.6)*4,108,1.3);Line(c,Purple,75,0,70+Math.Sin(t*1.6)*4,108,1.3);Box(c,Gold,29,107,45,4,1);c.Pop();return;}
  if(p=="tree"){Poly(c,Green,81,57,63,94,99,94);Poly(c,Green,81,48,68,75,94,75);Box(c,Gold,78,94,6,17,1);Star(c,81,48,5,Gold);for(int i=0;i<5;i++)Ell(c,i%2==0?Pink:Gold,73+(i%3)*7,72+(i/3)*13,2,2);c.Pop();return;}
  if(p=="snowman"){Ell(c,White,78,105,17,17);Ell(c,White,78,81,12,12);Ell(c,Ink,74,79,1,1);Ell(c,Ink,81,79,1,1);Poly(c,Gold,78,82,91,85,78,86);Line(c,Pink,65,91,90,93,3);c.Pop();return;}
  if(p=="ghost"){Ell(c,Volume("#FFFFFF","#DAD2EC"),50,79,26,30);Ell(c,Ink,42,71,2,3);Ell(c,Ink,59,71,2,3);c.Pop();return;}
  c.PushTransform(new RotateTransform((Kind=="play"||Kind=="inspect"||Kind=="craft"||Kind=="eat")?Math.Sin(t*4)*5:0,x,y));
  switch(p){
   case "cube":c.PushTransform(new RotateTransform(t*35,x,y));Box(c,Volume("#FDF5FE","#B8A3D3"),x-12,y-12,24,24,2);for(int i=0;i<3;i++)for(int j=0;j<3;j++)Box(c,new[]{Pink,Gold,Green,Blue,Purple,White}[(i+j*2)%6],x-11+i*8,y-11+j*8,7,7,1);c.Pop();break;
   case "car":y=119;x=50+Math.Sin(t*2)*28;Box(c,Blue,x-14,y-8,29,9,3);Box(c,White,x-8,y-15,16,9,3);Ell(c,Ink,x-8,y+1,4,4);Ell(c,Ink,x+9,y+1,4,4);break;
   case "game":Box(c,Volume("#E9E0F8","#927BAB"),x-20,y-5,40,15,6);Line(c,Ink,x-11,y-1,x-11,y+6,2);Line(c,Ink,x-15,y+2,x-7,y+2,2);Ell(c,Pink,x+11,y+1,2,2);Ell(c,Gold,x+15,y+5,2,2);break;
   case "watergun":Box(c,Blue,x-19,y-7,33,10,3);Box(c,Pink,x-10,y+1,8,13,2);Ell(c,Gold,x-5,y-9,7,5);for(int i=0;i<7;i++)Ell(c,Blue,x+15+(t*25+i*4)%29,y-3+Math.Sin(i)*1,1.5,1);break;
   case "violin":c.PushTransform(new RotateTransform(-35,x,y));Ell(c,Volume("#EFD0A8","#B98A70"),x,y,8,15);Ell(c,Gold,x,y-10,5,10);Line(c,Ink,x,y-15,x,y-33,3);Line(c,White,x,y-23,x,y+10,.6);Line(c,Ink,x-17+Math.Sin(t*5)*4,y-8,x+16+Math.Sin(t*5)*4,y+11,1);c.Pop();break;
   case "flute":Line(c,Gold,x-19,y-7,x+20,y-15,4);for(int i=0;i<5;i++)Ell(c,Ink,x-9+i*5,y-9-i,1,1);break;
   case "mirror":Line(c,Gold,x+10,y,x+14,y+21,3);Ell(c,Volume("#FFF5CA","#BC9B67"),x+8,y-7,12,16);Ell(c,Volume("#FDFDFF","#B3C9DD"),x+8,y-7,9,12);break;
   case "palette":Ell(c,Volume("#FFF5DD","#D6B8AE"),x,y,20,11);for(int i=0;i<5;i++)Ell(c,new[]{Pink,Gold,Green,Blue,Purple}[i],x-14+i*7,y-2+Math.Sin(i)*3,2.6,2.6);break;
   case "notebook":case "archive":Box(c,White,x-19,y-12,36,26,2);Line(c,Purple,x-3,y-12,x-3,y+14,1);for(int i=0;i<4;i++)Line(c,Purple,x+1,y-7+i*5,x+12,y-7+i*5,.7);Line(c,Gold,x+5+Math.Sin(t*7)*2,y-5,x+21,y-23,2);break;
   case "desk":Box(c,Volume("#EFDAC4","#C6ABC5"),x-29,y+7,58,6,2);Line(c,Ink,x-24,y+13,x-24,y+31,2);Line(c,Ink,x+24,y+13,x+24,y+31,2);Box(c,White,x+Math.Sin(t*4)*14-5,y,12,6,2);break;
   case "fan":c.PushTransform(new RotateTransform(Math.Sin(t*6)*18,x,y+9));for(int i=0;i<8;i++){double a=(i/7.0)*Math.PI;Line(c,i%2==0?Pink:Purple,x,y+9,x+Math.Cos(a)*24,y+9-Math.Sin(a)*24,6);}c.Pop();break;
   case "toothbrush":Line(c,Pink,x+Math.Sin(t*12)*2,y-34,x+18,y-13,3);Box(c,White,x-3,y-37,10,5,2);for(int i=0;i<4;i++)Ell(c,White,x-5+i*3,y-35+Math.Sin(i+t),2,2);break;
   case "gift":Box(c,Volume("#F9E5F3","#D3ACCC"),x-18,y-6,36,25,2);Box(c,Purple,x-20,y-10-Math.Abs(Math.Sin(t*2))*13,40,6,2);Line(c,Gold,x,y-7,x,y+18,4);break;
   case "cards":for(int i=0;i<4;i++){c.PushTransform(new RotateTransform((i-1.5)*15,x,y+16));Box(c,White,x-8,y-15,17,28,2);Text(c,i%2==0?"♦":"♠",x-4,y-8,11,i%2==0?Pink:Ink);c.Pop();}break;
   case "top":c.PushTransform(new RotateTransform(t*200,x,y+23));Poly(c,Purple,x-12,y+18,x+12,y+18,x,y+32);Ell(c,Pink,x,y+18,12,4);c.Pop();break;
   case "cat":Cat(c,x,y,Volume("#FFF7EA","#C6B1C7"));break;
   case "flower":case "chrysanthemum":Line(c,Green,x,y-10,x,y+22,2);Flower(c,x,y-14,p=="flower"?Pink:Gold);break;
   case "horse":Ell(c,Gold,x,y+22,25,13);Line(c,Ink,x-17,y+15,x-17,y-5,5);Ell(c,Gold,x-12,y-5,10,7);Ell(c,Purple,x,y+39,29,3);Line(c,Ink,x+16,y+28,x+21,y+39,3);Line(c,Ink,x-16,y+28,x-21,y+39,3);break;
   case "balls":for(int i=0;i<3;i++){double a=t*4+i*2.094;Ell(c,new[]{Gold,Pink,Blue}[i],50+Math.Cos(a)*23,70-Math.Abs(Math.Sin(a))*24,4,4);}break;
   case "shuttle":x=55+Math.Sin(t*3)*16;y=112-Math.Abs(Math.Sin(t*3))*36;Ell(c,Pink,x,y,4,3);for(int i=0;i<4;i++)Line(c,White,x,y-1,x-5+i*3,y-12,2);break;
   case "chess":Box(c,Gold,x-24,y,48,32,1);for(int i=0;i<6;i++){Line(c,Ink,x-21+i*8,y+2,x-21+i*8,y+30,.5);Line(c,Ink,x-23,y+3+i*5,x+23,y+3+i*5,.5);}for(int i=0;i<7;i++)Ell(c,i%2==0?Ink:White,x-13+(i%4)*8,y+8+(i/4)*10,2,2);break;
   case "rice":case "breakfast":case "lunch":case "dinner":case "porridge":case "tangyuan":case "dumplings":case "noodles":Bowl(c,x,y,p);Line(c,Gold,x+10+Math.Sin(t*5)*2,y-5,x+22,y-24,1.5);if(p=="noodles")for(int i=0;i<4;i++)Line(c,Gold,x+5+i*2,y-3,x+10+i*2,y-22,1);break;
   case "snacks":Box(c,Volume("#F9E2F0","#C1A0D2"),x-12,y-9,24,29,3);for(int i=0;i<4;i++)Ell(c,Gold,x-7+i*5,y-10+Math.Sin(i)*2,4,2);Star(c,x,y+5,7,White);break;
   case "token":for(int i=0;i<5;i++){double yy=y-8+i*5;Ell(c,Gold,x,yy,13,4);Text(c,"✧",x-4,yy-6,9,Ink);}break;
   case "icecream":Poly(c,Gold,x-9,y,x+9,y,x,y+25);Ell(c,Volume("#FFF2FD","#D5A5D0"),x,y-5,12,11);Ell(c,White,x-3,y-14,8,7);break;
   case "crab":Ell(c,Volume("#F6CE9D","#DA957F"),x,y,14,9);for(int i=0;i<4;i++){Line(c,Pink,x-10,y-5+i*4,x-22,y-11+i*7,2);Line(c,Pink,x+10,y-5+i*4,x+22,y-11+i*7,2);}Ell(c,Ink,x-5,y-5,1,1);Ell(c,Ink,x+5,y-5,1,1);break;
   case "tanghulu":Line(c,Gold,x,y-25,x,y+24,1.5);for(int i=0;i<4;i++)Ell(c,Volume("#FFCFD7","#D77D91"),x,y-19+i*10,6,6);break;
   case "watermelon":Poly(c,Green,x-23,y-7,x+23,y-7,x,y+18);Poly(c,Pink,x-20,y-6,x+20,y-6,x,y+14);for(int i=0;i<5;i++)Ell(c,Ink,x-10+i*5,y+(i%2)*4,1,1.7);break;
   case "hotpot":Ell(c,Volume("#FCF2FF","#A9A0BA"),x,y+10,24,14);Ell(c,Pink,x,y+4,23,7);for(int i=0;i<5;i++)Ell(c,i%2==0?Green:Gold,x-15+i*8,y+3,4,2);for(int i=0;i<4;i++)Ell(c,new SolidColorBrush(Color.FromArgb(80,245,238,250)),x-14+i*9,y-9-(t*8+i*5)%20,3,6);break;
   case "moon":Ell(c,Gold,78,23,15,15);Ell(c,Volume("#F5D7AD","#B58B72"),x,y,13,9);Star(c,x,y-1,5,Pink);break;
   case "zongzi":Poly(c,Volume("#D4E6AC","#91B076"),x,y-19,x+17,y+9,x-17,y+9);Line(c,Gold,x-10,y,x+10,y,1.5);break;
   case "niangao":case "qingtuan":case "chongyang":Ell(c,White,x,y+12,20,5);for(int i=0;i<3;i++)Ell(c,p=="qingtuan"?Green:p=="chongyang"?Pink:White,x-10+i*10,y+5-Math.Sin(i)*5,7,7);break;
   case "redpacket":Box(c,Volume("#F4BDCA","#D9849E"),x-10,y-18,20,32,2);Star(c,x,y-1,6,Gold);break;
   case "fu":c.PushTransform(new RotateTransform(45,x,y));Box(c,Pink,x-15,y-15,30,30,1);c.Pop();Text(c,"福",x-10,y-13,21,Gold);Line(c,Ink,x+9,y,x+24,y-20,2);break;
   case "needle":Ell(c,White,x,y,17,11);Line(c,Pink,x-9,y-5,x+10,y+4,1);Line(c,Ink,x+Math.Sin(t*4)*6,y-6,x+13,y-21,1);break;
   case "lion":Ell(c,Volume("#FFE0AE","#D9A4A6"),x,y-10,25,19);Ell(c,White,x-12,y-13,10,10);Ell(c,White,x+12,y-13,10,10);Ell(c,Ink,x-12,y-13,3,4);Ell(c,Ink,x+12,y-13,3,4);Star(c,x,y-28,6,Gold);break;
   case "pumpkin":Ell(c,Volume("#FFD8AF","#DE9C79"),x,y,19,16);Line(c,Green,x,y-15,x+3,y-23,4);Poly(c,Ink,x-12,y-3,x-6,y-8,x-3,y-1);Poly(c,Ink,x+12,y-3,x+6,y-8,x+3,y-1);Line(c,Ink,x-8,y+7,x+9,y+7,2);break;
   case "riverlantern":Ell(c,Blue,x,y+21,26,3);for(int i=0;i<5;i++){c.PushTransform(new RotateTransform((i-2)*18,x,y+10));Ell(c,Pink,x,y+5,5,14);c.Pop();}Ell(c,Gold,x,y+1,3,6);break;
   default:if(p.StartsWith("purse-")){Ell(c,Volume("#FBECC6","#CBB085"),x,y+3,p=="purse-zero"?10:19,p=="purse-empty"?9:18);Box(c,Purple,x-8,y-15,16,5,1);if(p!="purse-zero"&&p!="purse-empty")for(int i=0;i<(p=="purse-full"?7:p=="purse-count"?2:4);i++)Ell(c,Gold,x-12+i*5,y-16-Math.Abs(Math.Sin(t*3+i))*7,4,2);if(p=="purse-zero")Text(c,"0",x-4,y-4,12,Ink);}else{throw new ArgumentException("Unknown action prop: "+p);}break;
  }
  c.Pop();c.Pop();
 }
}
