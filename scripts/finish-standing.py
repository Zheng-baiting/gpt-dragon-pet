"""Finish the existing complete action with a short estimated return to its first pose."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'scripts'))
from pipeline import FFMPEG, bounded, original, info, review
from motion import prepare_pair, interpolate
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('name', help='Action name already processed at 720p/120 fps, 1205 frames')
name = parser.parse_args().name
folder = root/'work/pipeline-hd'/name
source = folder/'video-120fps.webm'
target = folder/'video-standing.pending.webm'
metadata = info(source)
w,h = metadata['width'],metadata['height']
expected = round(metadata['duration']*120)
start = expected-65
assert expected == 1205 and (w,h) == (1280,720)
decoder = subprocess.Popen(bounded([FFMPEG,'-loglevel','error','-c:v','libvpx-vp9','-i',str(source),'-an','-f','rawvideo','-pix_fmt','rgba','-']),stdout=subprocess.PIPE)
encoder = subprocess.Popen(bounded([FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s',f'{w}x{h}','-r','120','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','18','-deadline','good','-cpu-used','4','-auto-alt-ref','0','-tile-columns','1','-row-mt','1',str(target)]),stdin=subprocess.PIPE)
read_exact = original('chroma_step02.py').read_exact
first = pair = None
count = 0
try:
    while True:
        data = read_exact(decoder.stdout,w*h*4)
        if not data:
            break
        assert len(data) == w*h*4
        frame = Image.frombytes('RGBA',(w,h),data)
        if first is None:
            first = frame.copy()
        if count == start:
            pair = prepare_pair(frame,first)
        if count >= start:
            t = min(1,(count-start)/60)
            frame = interpolate(pair,t*t*(3-2*t)).convert('RGBA') if t < 1 else first
        encoder.stdin.write(frame.tobytes())
        count += 1
finally:
    decoder.stdout.close()
    encoder.stdin.close()
    assert decoder.wait() == 0 and encoder.wait() == 0
assert count == expected
target.replace(source)
report_path = folder/'report.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
report['standingReturnCorrection'] = 'After the complete generated action has finished, replace the final 0.5 seconds with an eased bidirectional-flow estimate from playback frame 1140 to the first clean standing pose; keep 1205 frames and the original duration.'
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
review(source,folder/'review.png')
print(json.dumps({'name':name,'frames':count,'correctionStartSeconds':start/120}))
