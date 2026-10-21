"""Create a candidate with a shared neutral head/tail; review before importing."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'scripts'))
from pipeline import FFMPEG,bounded,original,info
from motion import prepare_pair,interpolate
from PIL import Image

args=argparse.ArgumentParser()
args.add_argument('name')
args.add_argument('--input',type=Path)
args.add_argument('--output',type=Path)
args.add_argument('--reference',type=Path,default=root/'assets/webm/待机呼吸休闲.webm')
options=args.parse_args()
name=options.name
source=options.input or root/'work/pipeline-hd'/name/'video-120fps.webm'
meta=info(source)
w,h=meta['width'],meta['height']
assert (w,h)==(1280,720) and meta['r_frame_rate']=='120/1'
count=round(meta['duration']*120)
assert count in (605,1205)
head=54
tail=count-55

def frame_at(path,index):
    result=subprocess.run(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-ss',str(index/120),'-i',str(path),
        '-frames:v','1','-f','rawvideo','-pix_fmt','rgba','-']),capture_output=True,check=True)
    assert len(result.stdout)==w*h*4
    return Image.frombytes('RGBA',(w,h),result.stdout)

common=frame_at(options.reference,0)
head_pair=prepare_pair(common,frame_at(source,head))
tail_pair=prepare_pair(frame_at(source,tail),common)
output=options.output or root/'work/video-edit'/f'{name}-common-standing.webm'
assert source.resolve()!=output.resolve() and options.reference.resolve()!=output.resolve()
output.parent.mkdir(parents=True,exist_ok=True)
decoder=subprocess.Popen(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-i',str(source),'-an',
    '-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
encoder=subprocess.Popen(bounded([FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s',f'{w}x{h}',
    '-r','120','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','18','-deadline','good',
    '-cpu-used','4','-auto-alt-ref','0','-tile-columns','1','-row-mt','1',str(output)]),stdin=subprocess.PIPE)
read=original('chroma_step02.py').read_exact
samples=[]
at=0
try:
    while True:
        raw=read(decoder.stdout,w*h*4)
        if not raw:break
        assert len(raw)==w*h*4
        frame=Image.frombytes('RGBA',(w,h),raw)
        if at<head:
            t=max(0,(at-18)/36)
            frame=common if t==0 else interpolate(head_pair,t*t*(3-2*t)).convert('RGBA')
        elif at>=tail:
            t=min(1,(at-tail)/36)
            frame=common if t==1 else interpolate(tail_pair,t*t*(3-2*t)).convert('RGBA')
        encoder.stdin.write(frame.tobytes())
        if at in (0,18,24,30,36,42,48,54,tail,tail+6,tail+12,tail+18,tail+24,tail+30,tail+36,count-1):
            samples.append((at,frame.copy()))
        at+=1
        if at%240==0:print(f'{at}/{count}',flush=True)
finally:
    decoder.stdout.close()
    encoder.stdin.close()
    assert decoder.wait()==0 and encoder.wait()==0
assert at==count
sheet=Image.new('RGB',(4*480,4*285),'#dddde5')
from PIL import ImageDraw
draw=ImageDraw.Draw(sheet)
for i,(index,frame) in enumerate(samples):
    frame.thumbnail((480,270))
    x,y=(i%4)*480,(i//4)*285
    sheet.paste(frame,(x,y),frame)
    draw.text((x+5,y+270),f'{index/120:.3f}s',fill='black')
sheet.save(output.with_suffix('.png'))
print(json.dumps({'output':str(output),'frames':at,'head_seconds':.45,'tail_seconds':55/120}))
