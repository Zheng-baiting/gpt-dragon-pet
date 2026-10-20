"""Close the sleep pose and remove small detached bubble ghosts at the top edge."""
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'scripts'))
from pipeline import FFMPEG,bounded,original,review
from motion import prepare_pair,interpolate
import cv2
import numpy as np
from PIL import Image

cv2.setNumThreads(1)
folder = root/'work/pipeline-hd/原地小憩沉眠'
source = folder/'video-120fps.webm'
target = folder/'sleep-finished.pending.webm'
decoder = subprocess.Popen(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-i',str(source),'-an','-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
encoder = subprocess.Popen(bounded([FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s','1280x720','-r','120','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','18','-deadline','good','-cpu-used','4','-auto-alt-ref','0','-tile-columns','1','-row-mt','1',str(target)]),stdin=subprocess.PIPE)
read_exact = original('chroma_step02.py').read_exact
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))
first = pair = None
index = removed = 0
try:
    while True:
        raw = read_exact(decoder.stdout,1280*720*4)
        if not raw:
            break
        assert len(raw) == 1280*720*4
        frame = Image.frombytes('RGBA',(1280,720),raw)
        if first is None:
            first = frame.copy()
        if index == 1140:
            pair = prepare_pair(frame,first)
        if index >= 1140:
            t = min(1,(index-1140)/60)
            frame = interpolate(pair,t*t*(3-2*t)).convert('RGBA') if t < 1 else first
        rgba = np.array(frame)
        alpha = rgba[...,3]
        edge = np.concatenate((alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]))
        if np.any(edge > 16):
            _,labels,stats,_ = cv2.connectedComponentsWithStats((alpha>16).astype(np.uint8),8)
            ids = set(map(int,labels[0]))-{0}
            largest = 1 + int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
            for component in ids:
                bottom = stats[component,cv2.CC_STAT_TOP] + stats[component,cv2.CC_STAT_HEIGHT]
                if component != largest and bottom <= 128 and stats[component,cv2.CC_STAT_AREA] <= 4096 and int(alpha[labels==component].max()) <= 160:
                    mask = cv2.dilate((labels==component).astype(np.uint8),kernel)>0
                    alpha[mask] = 0
                    removed += 1
        encoder.stdin.write(rgba.tobytes())
        index += 1
finally:
    decoder.stdout.close()
    encoder.stdin.close()
    assert decoder.wait() == 0 and encoder.wait() == 0
assert index == 1205,index
target.replace(source)
report_path = folder/'report.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
report['standingReturnCorrection'] = 'After the sleep bubbles have disappeared, estimate the final 0.5s return from frame 1140 to the first clean standing pose with eased bidirectional optical flow; preserve 1205 frames.'
previous = report.get('edgeGhostCleanup',{}).get('removedComponents',0)
report['edgeGhostCleanup'] = {'removedComponents':previous+removed,'maximumAlpha':160,'maximumAreaPixels':4096,
                            'maximumBottomY':128,
                            'scope':'Only small detached bubble components touching the top edge above the character; the largest character component and opaque character line work are retained.'}
report['postprocessingScript'] = 'assets/sources/原地小憩沉眠-finishing.py'
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
review(source,folder/'review.png')
print(json.dumps({'frames':index,'removedEdgeGhostComponents':removed}))
