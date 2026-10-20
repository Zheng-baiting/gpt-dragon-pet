"""Keep the generated sleeper, fit its separated bubbles above the head, and fade them out."""
from io import BytesIO
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'scripts'))
from pipeline import FFMPEG, bounded, original, run
import cv2
import numpy as np
from PIL import Image, ImageDraw

cv2.setNumThreads(2)
chroma = original('chroma_step02.py')
source = root/'assets/sources/原地小憩沉眠-kling.mp4'
if not source.is_file():
    source = root/'work/generation/kling-sleep10-sample.mp4'
folder = root/'work/video-edit/sleep-effects'
folder.mkdir(parents=True,exist_ok=True)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9))

def edited(rgb,index):
    hue,sat,val = chroma._rgb_to_hsv(rgb)
    lo,hi = chroma.GREEN_HUE_MIN-chroma.HUE_FEATHER,chroma.GREEN_HUE_MAX+chroma.HUE_FEATHER
    strength = np.clip((hue-lo)/chroma.HUE_FEATHER,0,1)*np.clip((hi-hue)/chroma.HUE_FEATHER,0,1)
    green = (sat >= chroma.SAT_MIN) & (hue >= lo) & (hue <= hi)
    alpha = np.where(green,(1-strength)*255,255).astype(np.uint8)
    alpha[:,:256] = 0
    alpha[:,1024:] = 0
    count,labels,stats,_ = cv2.connectedComponentsWithStats((alpha>128).astype(np.uint8),8)
    body_id = 1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
    assert stats[body_id,cv2.CC_STAT_AREA] > 20000
    body_top = int(stats[body_id,cv2.CC_STAT_TOP])
    body_mask = cv2.dilate((labels==body_id).astype(np.uint8),kernel)>0
    fx_ids = [i for i in range(1,count) if i != body_id and stats[i,cv2.CC_STAT_AREA] >= 20
              and stats[i,cv2.CC_STAT_TOP]+stats[i,cv2.CC_STAT_HEIGHT] < body_top+120]
    fx_mask = cv2.dilate(np.isin(labels,fx_ids).astype(np.uint8),kernel)>0
    fx_mask &= ~body_mask
    rgba = np.dstack((rgb.copy(),alpha))
    rgba[...,1] = np.minimum(rgba[...,1],np.maximum(rgba[...,0],rgba[...,2]))
    body = rgba.copy()
    body[...,3] = np.where(body_mask,alpha,0)
    result = Image.fromarray(body)
    fade = np.clip((8.5-index/24)/1.5,0,1)
    if fx_ids and fade > 0:
        fx = rgba.copy()
        fx[...,3] = np.where(fx_mask,alpha*fade,0).astype(np.uint8)
        effect = Image.fromarray(fx)
        bounds = effect.getbbox()
        if bounds:
            effect = effect.crop(bounds)
            factor = min(1,70/effect.height,160/effect.width)
            effect = effect.resize((max(1,round(effect.width*factor)),max(1,round(effect.height*factor))),Image.Resampling.LANCZOS)
            result.alpha_composite(effect,(640-effect.width//2,max(40,body_top-14-effect.height)))
    return result

if '--preview' in sys.argv:
    sheet = Image.new('RGB',(1280,720),'#e1e4ed')
    draw = ImageDraw.Draw(sheet)
    for index,moment in enumerate([0,3.6,7.5,9.5]):
        raw = run([FFMPEG,'-loglevel','error','-ss',str(moment),'-i',str(source),'-frames:v','1','-f','image2pipe','-c:v','png','-'],check=True,capture_output=True).stdout
        frame = edited(np.asarray(Image.open(BytesIO(raw)).convert('RGB')),round(moment*24))
        frame.thumbnail((640,330),Image.Resampling.LANCZOS)
        x,y = index%2*640,index//2*360
        sheet.paste(frame,(x,y),frame)
        draw.text((x+20,y+340),f'{moment:.1f}s',fill='#222833')
    sheet.save(folder/'preview.png')
    print(str(folder/'preview.png'))
else:
    target = folder/'prepared-24fps.webm'
    decoder = subprocess.Popen(bounded([FFMPEG,'-loglevel','error','-i',str(source),'-vf','fps=24','-an','-f','rawvideo','-pix_fmt','rgb24','-']),stdout=subprocess.PIPE)
    encoder = subprocess.Popen(bounded([FFMPEG,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s','1280x720','-r','24','-i','-','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','18','-deadline','good','-cpu-used','4','-auto-alt-ref','0',str(target)]),stdin=subprocess.PIPE)
    index = 0
    try:
        while True:
            raw = chroma.read_exact(decoder.stdout,1280*720*3)
            if not raw:
                break
            assert len(raw) == 1280*720*3
            frame = edited(np.frombuffer(raw,np.uint8).reshape(720,1280,3),index)
            encoder.stdin.write(frame.tobytes())
            index += 1
    finally:
        decoder.stdout.close()
        encoder.stdin.close()
        assert decoder.wait() == 0 and encoder.wait() == 0
    assert index == 241,index
    record = {'source':source.relative_to(root).as_posix(),'prepared':target.relative_to(root).as_posix(),
              'frames':index,'fps':24,'extractionRegion':[256,0,768,720],
              'effectCorrection':'Separate the largest connected character component from detached sleep bubbles after HSV keying, including dark green shadows. Keep the character motion, fit the original detached bubbles within 160x70 source pixels above the head, and fade them from 7s to 8.5s. Do not draw new bubbles.'}
    (folder/'report.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(record))
