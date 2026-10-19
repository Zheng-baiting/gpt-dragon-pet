"""Check shipped frame geometry, transparent margins and neutral action seams."""
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'work/tools/python'))
import numpy as np
from PIL import Image

manifest=json.loads((ROOT/'assets/animation/manifest.json').read_text(encoding='utf-8'))
frames=0
for key,clip in manifest['clips'].items():
    path=ROOT/'assets/animation'/clip['file']
    image=Image.open(path).convert('RGBA')
    w,h,cols,count=clip['width'],clip['height'],clip['columns'],clip['frames']
    assert image.size==(w*cols,h*((count+cols-1)//cols)),key
    a=np.array(image)
    def frame(index):
        x,y=(index%cols)*w,(index//cols)*h
        return a[y:y+h,x:x+w]
    assert np.array_equal(frame(0),frame(count-1)),key+' has a broken neutral seam'
    for i in range(count):
        alpha=frame(i)[:,:,3]
        assert alpha.max()==255,key+' empty frame'
        assert not alpha[:3].any() and not alpha[-3:].any() and not alpha[:,:3].any() and not alpha[:,-3:].any(),key+' clips a frame border'
    frames+=count
report={'ok':True,'clips':len(manifest['clips']),'frames':frames,'neutralSeams':True,'transparentMargins':True}
assert report['clips']==16 and frames==1200
directory=ROOT/'work/qa';directory.mkdir(parents=True,exist_ok=True)
(directory/'motion-assets.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
