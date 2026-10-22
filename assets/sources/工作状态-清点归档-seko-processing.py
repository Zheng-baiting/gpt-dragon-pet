"""Keep archive sparkles in the safe area; never change character poses.
Input: the retained Seko 1280x720/24fps MP4, or its keyed WebM.
The MP4 route extracts x=256..1024 at original coordinates before HSV keying.
"""
from pathlib import Path
import argparse,subprocess,sys,json,hashlib
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'scripts'))
from pipeline import FFMPEG,bounded,original,info,clean_edge,run
import cv2
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
assert a.input.resolve()!=a.output.resolve()
a.output.parent.mkdir(parents=True,exist_ok=True)
source=a.input
if source.suffix.lower()=='.mp4':
 folder=a.output.parent/'archive-keying';folder.mkdir(parents=True,exist_ok=True)
 prepared=folder/'source-crop.mp4';keyed=folder/'source-keyed.webm'
 assert source.resolve() not in (prepared.resolve(),keyed.resolve())
 run([FFMPEG,'-y','-v','error','-i',str(source),'-vf','crop=w=768:h=720:x=256:y=0:exact=1,pad=1280:720:256:0:color=0x00FF00,scale=1280:720,fps=24','-an','-c:v','libx264','-crf','18',str(prepared)],check=True)
 chroma=original('chroma_step02.py');chroma.VAL_MIN=0
 chroma.convert_video(prepared,keyed,chroma.sample_background_color(prepared));source=keyed
m=info(source);assert (m['width'],m['height'],m['r_frame_rate'])==(1280,720,'24/1')
w,h=1280,720;a.output.parent.mkdir(parents=True,exist_ok=True)
dec=subprocess.Popen(bounded([FFMPEG,'-v','error','-c:v','libvpx-vp9','-i',str(source),'-an','-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
enc=subprocess.Popen(bounded([FFMPEG,'-y','-v','error','-f','rawvideo','-pix_fmt','rgba','-s','1280x720','-r','24','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','18','-deadline','good','-cpu-used','4','-auto-alt-ref','0',str(a.output)]),stdin=subprocess.PIPE)
read=original('chroma_step02.py').read_exact;n=changed=0
while True:
 raw=read(dec.stdout,w*h*4)
 if not raw:break
 im=clean_edge(raw,(w,h));pix=np.asarray(im).copy()
 if n/24>=6.5:
  total,labels,stats,_=cv2.connectedComponentsWithStats((pix[...,3]>0).astype(np.uint8),8)
  move=[]
  for i in range(1,total):
   x,y,cw,ch,area=stats[i]
   if x+cw<420 or x>900 or y+ch<125 or y>625:move.append(i)
  mask=np.isin(labels,move)
  if mask.any():
   layer=np.zeros_like(pix);layer[mask]=pix[mask];base=pix.copy();base[mask]=0
   factor=.6;cx,cy=640,400
   effect=Image.fromarray(layer).convert('RGBa').transform((w,h),Image.Transform.AFFINE,
    (1/factor,0,cx*(1-1/factor),0,1/factor,cy*(1-1/factor)),Image.Resampling.BICUBIC)
   fade=max(0,min(1,(9.4-n/24)/1.0))
   result=np.rint(np.asarray(effect).astype(float)*fade).astype(np.uint8)
   result=np.asarray(Image.frombytes('RGBa',(w,h),result.tobytes()).convert('RGBA')).copy()
   keep=base[...,3]>0;result[keep]=base[keep]
   assert np.array_equal(result[keep],pix[keep]),'Character pixels changed before encoding'
   pix=result;changed+=1
 enc.stdin.write(pix.tobytes());n+=1
dec.stdout.close();enc.stdin.close();assert dec.wait()==0 and enc.wait()==0;assert n==241
report={'frames':n,'fps':24,'inputSha256':hashlib.sha256(a.input.read_bytes()).hexdigest(),'keyedInputSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(a.output.read_bytes()).hexdigest(),'framesWithDetachedEffectAdjustment':changed,'protectedBodyRegion':[420,125,900,625],'scale':.6,'effectCentre':[640,400],'fade':[8.4,9.4],'characterRGBAChangesBeforeEncoding':0,'despill':'G=min(G,max(R,B))'}
a.output.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
