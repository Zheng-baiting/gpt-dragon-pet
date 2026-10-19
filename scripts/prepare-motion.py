"""Build clean, registered animation frames from the approved source atlases.

Development only: Pillow, numpy and opencv-python-headless. No runtime dependency.
Original atlases remain untouched. Run from the project root.
"""
from pathlib import Path
import sys, json, math

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'work/tools/python'))
import cv2
import numpy as np
from PIL import Image

cv2.setNumThreads(2)
OUT = ROOT / 'assets/animation'
QA = ROOT / 'work/qa/motion'
W, H, STEPS, COLS = 216, 288, 12, 8


def clean(source):
    a = np.array(source.convert('RGBA'))
    # Separate the opaque silhouette from the generator's disconnected white grit.
    solid = (a[:, :, 3] >= 180).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(solid, 8)
    if count < 2:
        raise ValueError('No character silhouette')
    main = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # Fill enclosed pinholes, preserve the exterior silhouette and smooth alpha.
    holes = main.copy(); cv2.floodFill(holes, None, (0, 0), 2)
    main[holes == 0] = 1
    distance = cv2.distanceTransform(main, cv2.DIST_L2, 3)
    edge = np.clip((distance - .45) * 255, 0, 255).astype(np.uint8)
    a[:, :, 3] = np.minimum(a[:, :, 3], edge)
    a[a[:, :, 3] == 0, :3] = 0
    return Image.fromarray(a)


def register(source):
    source = clean(source)
    box = source.getbbox()
    if not box:
        raise ValueError('Empty frame')
    crop = source.crop(box)
    silhouette = np.array(crop)[:, :, 3] > 180
    head_y, head_x = np.nonzero(silhouette[:round(crop.height * .6)])
    head_width = int(head_x.max() - head_x.min() + 1)
    head_center = (int(head_x.max()) + int(head_x.min())) / 2
    # Leave working room for the forward/backward deformation at tail tips.
    scale = min(168 / head_width, (W - 40) / crop.width, (H - 40) / crop.height)
    crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (W, H))
    x = round(W / 2 - head_center * scale)
    x = max(16, min(W - 16 - crop.width, x))
    canvas.alpha_composite(crop, (x, H - 20 - crop.height))
    return np.array(canvas)


def cells(file):
    source = Image.open(file).convert('RGBA')
    if file.name == 'source-idle.png':
        # This generation drifted away from an equal grid. Measured whitespace
        # boundaries preserve the first three complete rows; row four is unused.
        if source.size!=(1278,1230):raise ValueError('New idle source requires remeasuring cell boundaries')
        xs, ys = [0, 330, 650, 970, 1278], [0, 339, 671, 998, 1230]
        return [register(source.crop((xs[i % 4], ys[i // 4], xs[i % 4 + 1], ys[i // 4 + 1]))) for i in range(16)]
    return [register(source.crop((round((i % 4) * source.width / 4), round((i // 4) * source.height / 4),
                                  round((i % 4 + 1) * source.width / 4), round((i // 4 + 1) * source.height / 4))))
            for i in range(16)]


def premultiply(frame):
    a = frame.astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    return a


def gray(frame):
    a = premultiply(frame)
    rgb = a[:, :, :3] + np.array([.22, .20, .26], np.float32) * (1 - a[:, :, 3:4])
    return cv2.cvtColor(np.uint8(np.clip(rgb * 255, 0, 255)), cv2.COLOR_RGB2GRAY)


def flow_pair(a, b):
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0)
    ga, gb = gray(a), gray(b)
    def stable(flow):
        flow=cv2.GaussianBlur(flow,(0,0),.65)
        flow[:,:,0]=np.clip(flow[:,:,0],-W*.22,W*.22)
        flow[:,:,1]=np.clip(flow[:,:,1],-H*.22,H*.22)
        return flow
    return stable(dis.calc(ga, gb, None)), stable(dis.calc(gb, ga, None))


GRID = np.stack(np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32)), axis=-1)


def interpolate(a, b, forward, backward, t):
    # Backward sampling with two fixed-point refinements, then premultiplied blend.
    # This moves edges before blending instead of dissolving two displaced bodies.
    def warp(frame, flow, amount):
        sample = GRID.copy()
        for _ in range(5):
            vectors = cv2.remap(flow, sample, None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            sample = .5*sample + .5*(GRID - amount * vectors)
        return cv2.remap(premultiply(frame), sample, None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    left, right = warp(a, forward, t), warp(b, backward, 1 - t)
    # Occluded limbs / changing eyelids cannot safely be dissolved. Use the
    # nearer warped key in high-disagreement regions, with a feathered boundary.
    # Low-disagreement regions retain smooth temporal interpolation.
    disagreement=np.max(np.abs(left-right),axis=2)
    sharp=cv2.GaussianBlur((disagreement>.13).astype(np.float32),(0,0),.6)[:,:,None]
    weight=t*(1-sharp)+(1. if t>=.5 else 0.)*sharp
    result = left * (1-weight) + right * weight
    alpha = result[:, :, 3:4]
    result[:, :, :3] = np.divide(result[:, :, :3], alpha, out=np.zeros_like(result[:, :, :3]), where=alpha > .001)
    result = np.uint8(np.clip(result * 255, 0, 255))
    result[result[:, :, 3] < 4] = 0
    count, labels, stats, _=cv2.connectedComponentsWithStats((result[:,:,3]>24).astype(np.uint8),8)
    if count>1:
        main=(labels==1+np.argmax(stats[1:,cv2.CC_STAT_AREA])).astype(np.uint8)
        support=cv2.dilate(main,np.ones((3,3),np.uint8))
        result[support==0]=0
    return result


def make_clip(name, keys, times, neutral, settle):
    frames = []
    for i, a in enumerate(keys):
        b = keys[(i + 1) % len(keys)]
        f, r = flow_pair(a, b)
        for step in range(STEPS):
            frames.append(a if step == 0 else interpolate(a, b, f, r, step / STEPS))
    # Entry/exit are actual warped frames from/to a shared neutral pose.
    entry_f, entry_b = flow_pair(neutral, keys[0])
    entry = [interpolate(neutral, keys[0], entry_f, entry_b, s / STEPS) for s in range(STEPS)]
    exit_f, exit_b = flow_pair(keys[-1], neutral)
    exit_frames = [interpolate(keys[-1], neutral, exit_f, exit_b, (s + 1) / STEPS) for s in range(STEPS)]
    all_frames = entry + frames + exit_frames
    atlas = Image.new('RGBA', (W * COLS, H * math.ceil(len(all_frames) / COLS)))
    for i, frame in enumerate(all_frames):
        atlas.paste(Image.fromarray(frame), ((i % COLS) * W, (i // COLS) * H))
    # One RGBA palette for the whole clip avoids per-frame palette flicker and
    # keeps distributable PNGs small; no optical-flow library ships at runtime.
    packed=atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    palette=packed.getpalette('RGBA')
    for i in range(3,len(palette),4):
        if palette[i]>=250:palette[i]=255
        elif palette[i]<4:palette[i]=0
    packed.info.pop('transparency',None);packed.putpalette(palette,'RGBA')
    packed.save(OUT / (name + '.png'), optimize=True)
    # The last cycle segment returns to the initial pose. One-shots use all but it,
    # then the explicit neutral exit; loops keep every segment.
    result = dict(file=name + '.png', width=W, height=H, columns=COLS, steps=STEPS,
                  keys=len(keys), times=times, entry=.22, exit=.28, settle=settle,
                  frames=len(all_frames))
    samples = [Image.fromarray(v) for v in all_frames[::max(1, len(all_frames) // 12)]]
    contact = Image.new('RGB', (W * 4, H * math.ceil(len(samples) / 4)), '#272530')
    for i, sample in enumerate(samples):
        background = Image.new('RGBA', sample.size, '#272530');background.alpha_composite(sample)
        contact.paste(background.convert('RGB'), ((i % 4) * W, (i // 4) * H))
    contact.save(QA / (name + '.jpg'))
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True); QA.mkdir(parents=True, exist_ok=True)
    source = {name: cells(ROOT / 'assets/motion' / (name + '.png')) for name in ['core', 'emotion', 'life', 'move']}
    idle_source = cells(ROOT / 'assets/source-idle.png')
    idle = [idle_source[i] for i in [0, 1, 2, 3, 4, 6, 8, 10]]
    neutral = idle[0]
    Image.fromarray(neutral).save(OUT / 'neutral.png')
    clips = {}
    timing = {
        'core': [[1.5, 1.4, .8, .10, .12, 1., 1.2, 1.1], [.25, .25, .32, .40], [.65, .50, .45, .60], [.22, .22, .22, .22]],
        'emotion': [[.35, .55, .55, .35], [.28, .36, .45, .35], [.22, .22, .28, .30], [.32, .35, .32, .35]],
        'life': [[.85, .85, .85, .85], [.60, .65, .75, .60], [.38, .55, .65, .45], [.45, .45, .55, .45]],
        'move': [[.22, .22, .22, .22], [.16, .16, .16, .16], [.32, .32, .32, .32], [.42, .42, .42, .42]],
    }
    for sheet, rows in timing.items():
        for row, times in enumerate(rows):
            name = f'{sheet}-{row}'
            keys = idle if name == 'core-0' else source[sheet][row * 4:row * 4 + 4]
            clips[f'{sheet}:{row}'] = make_clip(name, keys, times, neutral, name not in ['core-0', 'core-2', 'core-3', 'emotion-3', 'life-0', 'move-0', 'move-1'])
            print(f'Prepared {name}: {clips[f"{sheet}:{row}"]["frames"]} frames', flush=True)
    manifest = dict(version=1, algorithm='registered bidirectional DIS flow; premultiplied RGBA', clips=clips)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # A small native-readable index avoids adding a JSON library to the desktop.
    lines = ['# key\tfile\twidth\theight\tcolumns\tsteps\tkeys\ttimes\tentry\texit\tsettle']
    for key, c in clips.items():
        lines.append('\t'.join(map(str, [key, c['file'], W, H, COLS, STEPS, c['keys'], ','.join(map(str, c['times'])), c['entry'], c['exit'], int(c['settle'])])))
    (OUT / 'index.tsv').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('All source atlases preserved. Assets ready.', flush=True)


if __name__ == '__main__':
    main()
