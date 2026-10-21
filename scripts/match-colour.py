"""Rebuild a reviewed colour correction from its source JSON and prior WebM."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

from pipeline import ROOT, FFMPEG, bounded, info, original
import numpy as np

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('name')
parser.add_argument('input',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
assert args.input.resolve()!=args.output.resolve(), 'Keep the input unchanged'
record=json.loads((ROOT/'assets/sources'/(args.name+'.json')).read_text(encoding='utf-8'))['colourMatch']
assert hashlib.sha256(args.input.read_bytes()).hexdigest()==record['inputSha256'], 'Use the pre-correction WebM identified in the source JSON'
assert hashlib.sha256((ROOT/record['reference']).read_bytes()).hexdigest()==record['referenceSha256'], 'Reference changed; review the calibration again'
meta=info(args.input)
assert meta['r_frame_rate']=='120/1'
w,h=meta['width'],meta['height']
expected=round(meta['duration']*120)
lut=np.empty((256,3),np.uint8)
source=np.array(record['sourceQuantiles'])
target=np.array(record['targetQuantiles'])
for c in range(3):
    lut[:,c]=np.rint(np.interp(np.arange(256),[0,64,*source[:,c],255],[0,64,*target[:,c],255])).astype(np.uint8)
identity=np.repeat(np.arange(256,dtype=float)[:,None],3,axis=1)
ramps=[np.rint(identity*(1-t)+lut*t).astype(np.uint8) for t in np.linspace(0,1,37)]
read=original('chroma_step02.py').read_exact
args.output.parent.mkdir(parents=True,exist_ok=True)
pending=args.output.with_suffix('.pending.webm')
decoder=subprocess.Popen(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-i',str(args.input),
    '-an','-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
encoder=subprocess.Popen(bounded([FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba',
    '-s',f'{w}x{h}','-r','120','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p',
    '-b:v','0','-crf','18','-deadline','good','-cpu-used','4','-auto-alt-ref','0',
    '-tile-columns','1','-row-mt','1',str(pending)]),stdin=subprocess.PIPE)
count=0
try:
    while True:
        raw=read(decoder.stdout,w*h*4)
        if not raw: break
        assert len(raw)==w*h*4
        frame=np.frombuffer(raw,np.uint8).reshape(h,w,4).copy()
        table=lut
        if record['preserveCommonStanding']:
            phase=min(36,max(0,count-18),max(0,expected-19-count))
            t=phase/36
            table=ramps[round(t*t*(3-2*t)*36)]
        for c in range(3): frame[...,c]=table[frame[...,c],c]
        encoder.stdin.write(frame.tobytes())
        count+=1
        if count%240==0: print(f'{count}/{expected}',flush=True)
finally:
    decoder.stdout.close()
    encoder.stdin.close()
    assert decoder.wait()==0 and encoder.wait()==0
assert count==expected
pending.replace(args.output)
print(json.dumps({'output':str(args.output),'frames':count,'format':info(args.output)}))
