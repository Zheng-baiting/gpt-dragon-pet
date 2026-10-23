"""Shorten only the excessive upper tuft, anchored at row 58; preserve all other pixels."""
from pathlib import Path
import hashlib,json,subprocess,sys
r=Path(__file__).resolve().parents[2];sys.path.insert(0,str(r/'scripts'))
from pipeline import FFMPEG,bounded,info,original
import numpy as np,cv2
from PIL import Image
cv2.setNumThreads(2)
source,target=Path(sys.argv[1]),Path(sys.argv[2]);meta=info(source)
assert source.resolve()!=target.resolve()
assert (meta['width'],meta['height'],meta['r_frame_rate'])==(640,360,'24/1')
decoder=subprocess.Popen(bounded([FFMPEG,'-v','error','-c:v','libvpx-vp9','-i',str(source),'-an','-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
encoder=subprocess.Popen(bounded([FFMPEG,'-y','-v','error','-f','rawvideo','-pix_fmt','rgba','-s','640x360','-r','24','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','18','-deadline','good','-cpu-used','4','-auto-alt-ref','0',str(target)]),stdin=subprocess.PIPE)
read=original('chroma_step02.py').read_exact;changes=[];at=0
try:
    while True:
        raw=read(decoder.stdout,640*360*4)
        if not raw:break
        assert len(raw)==640*360*4
        before=np.frombuffer(raw,np.uint8).reshape(360,640,4);after=before.copy()
        # Horns are separate components in this band; only the central strand can qualify.
        solid=(before[:58,:,3]>16).astype(np.uint8)
        n,labels,stats,centres=cv2.connectedComponentsWithStats(solid,8)
        selected=[j for j in range(1,n) if stats[j,1]<36 and stats[j,1]+stats[j,3]==58
                  and 290<=centres[j,0]<=340 and stats[j,2]<=40 and stats[j,4]>=20]
        assert len(selected)<=1
        if selected:
            j=selected[0];x,y,w,h,area=map(int,stats[j]);x0,x1=max(0,x-2),min(640,x+w+2);y0=max(0,y-2)
            # Never include a horn or any other visible component in the selected rectangle.
            assert not np.any((solid[y0:58,x0:x1]>0)&(labels[y0:58,x0:x1]!=j))
            patch=Image.fromarray(before[y0:58,x0:x1]).convert('RGBa').resize((x1-x0,21),Image.Resampling.BICUBIC).convert('RGBA')
            after[y0:58,x0:x1]=0;after[37:58,x0:x1]=np.asarray(patch)
            protected=np.ones((360,640),bool);protected[y0:58,x0:x1]=False
            assert np.array_equal(after[protected],before[protected])
            changes.append({'frame':at,'sourceRectangle':[x0,y0,x1,58],'destinationRectangle':[x0,37,x1,58]})
        encoder.stdin.write(after.tobytes());at+=1
finally:
    decoder.stdout.close();encoder.stdin.close();assert decoder.wait()==encoder.wait()==0
assert at==241 and 0<len(changes)<72,(at,len(changes))
record={'inputSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
    'frames':at,'framesAdjusted':len(changes),'protectedPixelChangesBeforeEncoding':0,'changes':changes,
    'method':'Compress only the isolated upper central tuft within rows 0..57, bottom anchored at 58, to destination rows 37..57. Premultiplied-alpha resampling. Assert no other visible component inside each selected rectangle and every pixel outside unchanged before encoding. No face, horn, body, tail, timing or frame-count changes before re-encoding.'}
target.with_suffix('.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'frames':at,'adjusted':len(changes)}))
