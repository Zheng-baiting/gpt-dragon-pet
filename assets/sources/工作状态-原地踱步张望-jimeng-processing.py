"""Prepare the retained Jimeng VFR source and relocate its detached hourglass.

Use only for this reviewed waiting clip. Character poses are never warped.
"""
from pathlib import Path
import argparse, hashlib, json, subprocess, sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'scripts'))
from pipeline import FFMPEG, bounded, clean_edge, info, original, run
import cv2
import numpy as np
from PIL import Image
cv2.setNumThreads(2)

p = argparse.ArgumentParser()
p.add_argument('input', type=Path)
p.add_argument('output', type=Path)
a = p.parse_args()
assert a.input.resolve() != a.output.resolve()
a.output.parent.mkdir(parents=True, exist_ok=True)
source = a.input
if source.suffix.lower() == '.mp4':
    folder = a.output.parent / 'waiting-keying'
    folder.mkdir(parents=True, exist_ok=True)
    prepared, keyed = folder / 'source-cfr24-crop.mp4', folder / 'source-keyed.webm'
    assert source.resolve() not in (prepared.resolve(), keyed.resolve())
    run([FFMPEG, '-y', '-v', 'error', '-i', str(source), '-vf',
         'crop=w=768:h=720:x=256:y=0:exact=1,pad=1280:720:256:0:color=0x00FF00,settb=1/24,setpts=N',
         '-r', '24', '-fps_mode', 'cfr', '-an', '-c:v', 'libx264', '-crf', '18', str(prepared)], check=True)
    chroma = original('chroma_step02.py')
    chroma.VAL_MIN = 0
    chroma.convert_video(prepared, keyed, chroma.sample_background_color(prepared))
    source = keyed
m = info(source)
assert (m['width'], m['height'], m['r_frame_rate']) == (1280, 720, '24/1')
w, h = 1280, 720
decoder = subprocess.Popen(bounded([FFMPEG, '-v', 'error', '-c:v', 'libvpx-vp9', '-i', str(source),
    '-an', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']), stdout=subprocess.PIPE)
encoder = subprocess.Popen(bounded([FFMPEG, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba',
    '-s', '1280x720', '-r', '24', '-i', '-', '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
    '-b:v', '0', '-crf', '18', '-deadline', 'good', '-cpu-used', '4', '-auto-alt-ref', '0',
    str(a.output)]), stdin=subprocess.PIPE)
read = original('chroma_step02.py').read_exact
n = changed = 0
active = False
scale, sx, sy, tx, ty = .30, 860, 184, 640, 107
try:
    while True:
        raw = read(decoder.stdout, w*h*4)
        if not raw:
            break
        pix = np.asarray(clean_edge(raw, (w, h))).copy()
        total, labels, stats, centres = cv2.connectedComponentsWithStats((pix[..., 3] > 0).astype(np.uint8), 8)
        body = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        eligible = [i for i in range(1, total) if i != body and centres[i, 0] >= 790
                    and stats[i, 1] + stats[i, 3] <= 330]
        if n/24 >= 2.5 and any(stats[i, 4] > 500 for i in eligible):
            active = True
        if active and n/24 <= 9.5 and eligible:
            mask = np.isin(labels, eligible)
            layer = np.zeros_like(pix)
            layer[mask] = pix[mask]
            base = pix.copy()
            base[mask] = 0
            effect = Image.fromarray(layer).convert('RGBa').transform((w, h), Image.Transform.AFFINE,
                (1/scale, 0, sx-tx/scale, 0, 1/scale, sy-ty/scale), Image.Resampling.BICUBIC)
            fade = max(0, min(1, (9.4-n/24)/.6))
            premultiplied = np.rint(np.asarray(effect).astype(float)*fade).astype(np.uint8)
            result = np.asarray(Image.frombytes('RGBa', (w, h), premultiplied.tobytes()).convert('RGBA')).copy()
            keep = base[..., 3] > 0
            result[keep] = base[keep]
            assert np.array_equal(result[labels == body], pix[labels == body]), 'Character component changed'
            assert np.array_equal(result[keep], pix[keep]), 'Non-effect foreground changed'
            pix = result
            changed += 1
        encoder.stdin.write(pix.tobytes())
        n += 1
finally:
    decoder.stdout.close()
    encoder.stdin.close()
    assert decoder.wait() == 0 and encoder.wait() == 0
assert n == 241
report = {'frames': n, 'fps': 24, 'inputSha256': hashlib.sha256(a.input.read_bytes()).hexdigest(),
    'keyedInputSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'outputSha256': hashlib.sha256(a.output.read_bytes()).hexdigest(),
    'framesWithDetachedEffectAdjustment': changed, 'effectScale': scale,
    'effectOriginalCentre': [sx, sy], 'effectTargetCentre': [tx, ty], 'particleFadeSeconds': [8.8, 9.4],
    'protectedCharacter': 'Largest connected alpha>0 foreground component; all non-selected foreground pixels unchanged before encoding',
    'effectSelection': 'After 2.5s, detached components with centroid x>=790 and bottom<=330; activate only after a component exceeds 500px',
    'characterRGBAChangesBeforeEncoding': 0, 'despill': 'G=min(G,max(R,B))',
    'rawTimingPreparation': 'All 241 frames preserved at CFR24 using settb=1/24,setpts=N; no synthesized frames'}
a.output.with_suffix('.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report))
