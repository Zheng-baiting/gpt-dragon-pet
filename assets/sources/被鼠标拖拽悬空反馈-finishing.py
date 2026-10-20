"""Repair four verified soft drag poses with adjacent clear poses at the same body trajectory."""
from pathlib import Path
import subprocess
import sys

root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'scripts'))
from pipeline import FFMPEG,bounded,clean_edge,original
import cv2
import numpy as np
from PIL import Image

cv2.setNumThreads(2)
folder=root/'work/pipeline-hd/被鼠标拖拽悬空反馈'
prepared=folder/'step04-24fps.webm'
video=folder/'video-120fps.webm'
target=folder/'clear-poses.pending.webm'
read=original('chroma_step02.py').read_exact
needed={20,23,24,26,196,198}
frames={}
decoder=subprocess.Popen(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-i',str(prepared),
    '-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
index=0
while True:
    raw=read(decoder.stdout,1280*720*4)
    if not raw:break
    if index in needed:frames[index]=clean_edge(raw,(1280,720))
    index+=1
decoder.stdout.close()
assert decoder.wait()==0 and index==241 and set(frames)==needed

def body(frame):
    _,_,stats,_=cv2.connectedComponentsWithStats((np.asarray(frame)[...,3]>64).astype(np.uint8),8)
    x,y,w,h,area=max(stats[1:],key=lambda row:row[4])
    return x+w/2,y+h/2,float(h)

def between(a,b,t):
    return tuple(x*(1-t)+y*t for x,y in zip(a,b))

def place(frame,box,target_box):
    cx,cy,h=box;tx,ty,th=target_box;scale=th/h
    matrix=np.float32([[scale,0,tx-scale*cx],[0,scale,ty-scale*cy]])
    pixels=cv2.warpAffine(np.asarray(frame.convert('RGBa')),matrix,(1280,720),flags=cv2.INTER_CUBIC)
    pixels[...,:3]=np.minimum(pixels[...,:3],pixels[...,3,None])
    return Image.frombytes('RGBa',(1280,720),pixels.tobytes()).convert('RGBA')

boxes={i:body(frame) for i,frame in frames.items()}
for index,left,right,t in [(21,20,23,1/3),(22,20,23,2/3),(25,24,26,.5),(197,196,198,.5)]:
    frames[index]=place(frames[right],boxes[right],between(boxes[left],boxes[right],t))
    boxes[index]=body(frames[index])
intervals={20,21,22,24,25,196,197}
decoder=subprocess.Popen(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-i',str(video),
    '-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
encoder=subprocess.Popen(bounded([FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba',
    '-s','1280x720','-r','120','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p',
    '-b:v','0','-crf','18','-deadline','good','-cpu-used','4','-auto-alt-ref','0',
    '-tile-columns','1','-row-mt','1',str(target)]),stdin=subprocess.PIPE)
count=0
try:
    while True:
        raw=read(decoder.stdout,1280*720*4)
        if not raw:break
        index,phase=divmod(count,5)
        if index in intervals:
            t=phase/5
            pose=index if t<.5 else index+1
            frame=place(frames[pose],boxes[pose],between(boxes[index],boxes[index+1],t))
            raw=frame.tobytes()
        elif index in (23,26,198) and phase==0:
            raw=frames[index].tobytes()
        encoder.stdin.write(raw)
        count+=1
finally:
    decoder.stdout.close();encoder.stdin.close()
    assert decoder.wait()==0 and encoder.wait()==0
assert count==1205,count
target.replace(video)
print('Repaired prepared frames 21,22,25,197 and seven adjacent interpolation intervals; retained 1205 frames')
