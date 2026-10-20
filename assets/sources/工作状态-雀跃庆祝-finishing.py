"""Replace the verified blurred celebration pose with its clear neighbour, then interpolate."""
import argparse
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root/'scripts'))
from pipeline import FFMPEG, bounded, clean_edge, info
from motion import prepare_pair, interpolate
import cv2
import numpy as np
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input', type=Path, default=root/'work/pipeline-hd/工作状态-雀跃庆祝/step04-24fps.webm')
parser.add_argument('--output', type=Path, default=root/'work/pipeline-hd/工作状态-雀跃庆祝/video-120fps.webm')
args = parser.parse_args()
metadata = info(args.input)
w,h = metadata['width'],metadata['height']
assert (w,h) in ((640,360),(1280,720)) and metadata['r_frame_rate']=='24/1'

def body(frame):
    alpha = np.asarray(frame)[...,3]
    _,_,stats,_ = cv2.connectedComponentsWithStats((alpha>64).astype(np.uint8),8)
    x,y,bw,bh,area = max(stats[1:],key=lambda row:row[4])
    return x+bw/2,y+bh/2,float(bh)

def place(frame,box,target):
    cx,cy,bh = box
    tx,ty,th = target
    scale = th/bh
    matrix = np.float32([[scale,0,tx-scale*cx],[0,scale,ty-scale*cy]])
    pixels = cv2.warpAffine(np.asarray(frame.convert('RGBa')),matrix,(w,h),flags=cv2.INTER_CUBIC)
    pixels[...,:3] = np.minimum(pixels[...,:3],pixels[...,3,None])
    return Image.frombytes('RGBa',(w,h),pixels.tobytes()).convert('RGBA')

decoded = subprocess.run(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-i',str(args.input),
    '-an','-f','rawvideo','-pix_fmt','rgba','-']),capture_output=True,check=True)
size = w*h*4
frames = [clean_edge(decoded.stdout[i:i+size],(w,h)) for i in range(0,len(decoded.stdout),size)]
del decoded
assert len(frames)==121,len(frames)
left,right = body(frames[32]),body(frames[34])
frames[33] = place(frames[34],right,tuple((a+b)/2 for a,b in zip(left,right)))

encoder = subprocess.Popen(bounded([FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba',
    '-s',f'{w}x{h}','-r','120','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p',
    '-b:v','0','-crf','18','-deadline','good','-cpu-used','4','-auto-alt-ref','0',
    '-tile-columns','1','-row-mt','1',str(args.output)]),stdin=subprocess.PIPE)
count = 0
try:
    for index,(first,second) in enumerate(zip(frames,frames[1:])):
        pair = prepare_pair(first,second)
        boxes = body(first),body(second)
        for phase in range(5):
            t = phase/5
            if phase==0:
                frame = first
            elif index in (32,33):
                pose = 0 if t<.5 else 1
                center = tuple(a*(1-t)+b*t for a,b in zip(*boxes))
                frame = place((first,second)[pose],boxes[pose],center)
            else:
                frame = interpolate(pair,t).convert('RGBA')
            encoder.stdin.write(frame.tobytes())
            count += 1
        if count%120==0:
            print(f'Celebration HD: {count}/605',flush=True)
    for _ in range(5):
        encoder.stdin.write(frames[-1].tobytes())
        count += 1
finally:
    encoder.stdin.close()
    assert encoder.wait()==0
assert count==605,count
print(str(args.output))
