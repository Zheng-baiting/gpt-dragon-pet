"""Calibrate new 24fps media, refine existing shared-standing palettes, or rebuild a historical 120fps curve."""
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
parser.add_argument('--calibrate',action='store_true',help='Measure a new 24fps candidate against the idle reference; manual review required')
parser.add_argument('--refine-existing',action='store_true',help='With --calibrate, refine an existing 640x360/24fps palette while retaining shared-standing endpoints')
parser.add_argument('--reference',type=Path,default=ROOT/'assets/webm/待机呼吸休闲.webm')
args=parser.parse_args()
assert not args.refine_existing or args.calibrate, '--refine-existing requires --calibrate'
args.reference=args.reference.resolve()
assert args.input.resolve()!=args.output.resolve(), 'Keep the input unchanged'
meta=info(args.input)
fps=24 if args.calibrate else 120
assert meta['r_frame_rate']==f'{fps}/1'
if args.calibrate:
    assert args.reference.resolve()!=args.output.resolve()
    def samples(path):
        samples=[]
        for t in (1,2,4):
            raw=subprocess.run(bounded([FFMPEG,'-v','error','-c:v','libvpx-vp9','-ss',str(t),'-i',str(path),
                '-frames:v','1','-vf','scale=640:360','-f','rawvideo','-pix_fmt','rgba','-']),check=True,capture_output=True).stdout
            arr=np.frombuffer(raw,np.uint8).reshape(360,640,4)
            samples.append(arr)
        return samples
    def quantiles(frames, table=None):
        material=[]
        for arr in frames:
            rgb=arr[...,:3].copy()
            if table is not None:
                for c in range(3): rgb[...,c]=table[rgb[...,c],c]
            rgb=rgb.astype(float)
            mask=(arr[...,3]>245)&(rgb.min(2)>95)&(np.ptp(rgb,axis=2)<65)&(rgb[...,2]>=rgb[...,0]-3)&(rgb[...,1]<=rgb[...,0]+3)
            assert mask.sum()>100, 'Too few pale material pixels for calibration'
            material.append(rgb[mask])
        return np.percentile(np.concatenate(material),[20,50,80],axis=0).tolist()
    source_samples=samples(args.input)
    target_quantiles=quantiles(samples(args.reference))
    record={'inputSha256':hashlib.sha256(args.input.read_bytes()).hexdigest(),
        'reference':args.reference.relative_to(ROOT).as_posix(),'referenceSha256':hashlib.sha256(args.reference.read_bytes()).hexdigest(),
        'sourceQuantiles':quantiles(source_samples),'targetQuantiles':target_quantiles,'preserveCommonStanding':args.refine_existing,
        'sampleSeconds':[1,2,4],'percentiles':[20,50,80],'manualReviewRequired':True,
        'method':'Fixed RGB curves from opaque pale lavender material; anchors 0/64/255. Alpha and motion unchanged before encoding; apply common-standing bridges afterwards.'}
    if args.refine_existing:
        assert (meta['width'],meta['height'])==(640,360)
        identity=np.repeat(np.arange(256,dtype=float)[:,None],3,axis=1)
        refined=identity.astype(np.uint8)
        history=[]
        for iteration in range(6):
            measured=np.array(quantiles(source_samples,refined))
            history.append(measured.tolist())
            if np.abs(measured-np.array(target_quantiles)).max()<=2: break
            proposal=np.empty((256,3),float)
            for c in range(3):
                assert np.all(np.diff(measured[:,c])>0)
                proposal[:,c]=np.interp(refined[:,c],[0,64,*measured[:,c],255],
                    [0,64,*np.array(target_quantiles)[:,c],255])
            # Resample the material mask after each in-memory proposal, but
            # render only one fixed LUT. Never normalize exposure per frame.
            proposed=.2*refined+.8*proposal
            refined=np.maximum.accumulate(np.rint(np.clip(proposed,identity-24,identity+24)).clip(0,255).astype(np.uint8),axis=0)
        record.update(lutHex=refined.tobytes().hex(),lutFormat='256x3 uint8 interleaved RGB, hexadecimal',
            refinementQuantiles=history,maxChannelAdjustment=24,
            standingBridgeFrames=9,
            predictedQuantiles=quantiles(source_samples,refined),
            method='One fixed RGB LUT from three material samples, refined in memory with a 24/255 adjustment bound. Black/white anchors retained; RGB correction eases through existing nine-frame standing bridges. No new motion, geometry change, hold, per-frame exposure or alpha edits before encoding.')
else:
    record=json.loads((ROOT/'assets/sources'/(args.name+'.json')).read_text(encoding='utf-8'))['colourMatch']
    assert hashlib.sha256(args.input.read_bytes()).hexdigest()==record['inputSha256'], 'Use the pre-correction WebM identified in the source JSON'
    assert hashlib.sha256((ROOT/record['reference']).read_bytes()).hexdigest()==record['referenceSha256'], 'Reference changed; review the calibration again'
w,h=meta['width'],meta['height']
expected=round(meta['duration']*fps)
lut=np.empty((256,3),np.uint8)
source=np.array(record['sourceQuantiles'])
target=np.array(record['targetQuantiles'])
for c in range(3):
    lut[:,c]=np.rint(np.interp(np.arange(256),[0,64,*source[:,c],255],[0,64,*target[:,c],255])).astype(np.uint8)
if 'lutHex' in record: lut=np.frombuffer(bytes.fromhex(record['lutHex']),np.uint8).reshape(256,3)
if args.refine_existing:
    assert expected in (121,241)
    assert np.all(lut[0]==0) and np.all(lut[-1]==255)
    assert np.all(np.diff(lut.astype(int),axis=0)>=0)
    assert np.abs(lut.astype(int)-np.arange(256)[:,None]).max()<=24
identity=np.repeat(np.arange(256,dtype=float)[:,None],3,axis=1)
ramps=[np.rint(identity*(1-t)+lut*t).astype(np.uint8) for t in np.linspace(0,1,37)]
read=original('chroma_step02.py').read_exact
args.output.parent.mkdir(parents=True,exist_ok=True)
pending=args.output.with_suffix('.pending.webm')
decoder=subprocess.Popen(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-i',str(args.input),
    '-an','-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
encoder=subprocess.Popen(bounded([FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba',
    '-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p',
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
            if args.refine_existing:
                t=min(1,count/9,(expected-1-count)/9)
            else:
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
if args.calibrate:
    record['outputSha256']=hashlib.sha256(args.output.read_bytes()).hexdigest()
    if args.refine_existing:
        record['measuredOutputQuantiles']=quantiles(samples(args.output))
    args.output.with_suffix('.colour.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'output':str(args.output),'frames':count,'format':info(args.output)}))
