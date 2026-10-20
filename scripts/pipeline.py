"""Run the original dsh-pet material pipeline, then interpolate to 120 fps."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'work/tools/python'))
from PIL import Image, ImageDraw
import numpy as np
from motion import prepare_pair, interpolate

FFMPEG = shutil.which(os.environ.get('GPT_PET_FFMPEG', 'ffmpeg'))
if not FFMPEG:
    raise SystemExit('找不到 FFmpeg；可在当前进程设置 GPT_PET_FFMPEG。')
FFPROBE = os.environ.get('GPT_PET_FFPROBE') or str(Path(FFMPEG).with_name('ffprobe.exe' if os.name == 'nt' else 'ffprobe'))
if not Path(FFPROBE).is_file():
    raise SystemExit('找不到 FFprobe；可在当前进程设置 GPT_PET_FFPROBE。')


def bounded(args):
    if str(args[0]) == FFMPEG:
        # Bound both input/output codecs and filter pools, without changing upstream files.
        return [args[0], '-hide_banner', '-nostdin', '-threads', '2',
                '-filter_threads', '2', '-filter_complex_threads', '2',
                *args[1:-1], '-threads', '2', args[-1]]
    return args


def run(args, **options):
    return subprocess.run(bounded(args), **options)


def original(filename):
    spec = importlib.util.spec_from_file_location(filename.removesuffix('.py'), ROOT / 'vendor/dsh-pet' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.FFMPEG, module.FFPROBE = FFMPEG, FFPROBE
    module.subprocess = SimpleNamespace(run=run, Popen=lambda args, **kw: subprocess.Popen(bounded(args), **kw),
                                        PIPE=subprocess.PIPE, DEVNULL=subprocess.DEVNULL)
    return module


def info(file):
    result = run([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                  'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', str(file)],
                 check=True, capture_output=True, encoding='utf-8')
    data = json.loads(result.stdout)
    return {**data['streams'][0], 'duration': float(data['format']['duration'])}


def assert_alpha(file):
    # Validate the source before letterboxing could introduce misleading transparency.
    result = run([FFMPEG, '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', str(file), '-an', '-vf',
                  'select=not(mod(n\\,24)),alphaextract,signalstats,metadata=print:file=-', '-f', 'null', '-'],
                 check=True, capture_output=True, encoding='utf-8')
    import re
    minima = [int(n) for n in re.findall(r'YMIN=(\d+)', result.stdout)]
    maxima = [int(n) for n in re.findall(r'YMAX=(\d+)', result.stdout)]
    if not any(n < 250 for n in minima) or not any(n > 10 for n in maxima):
        raise ValueError('素材须同时有可见人物与透明背景。')


def reference():
    source = Image.open(ROOT / 'assets/gpt-video-reference.png').convert('RGBA')
    bounds = source.getchannel('A').point(lambda n: 255 if n > 32 else 0).getbbox()
    if not bounds:
        raise ValueError('角色参考图为空。')
    character = source.crop(bounds)
    pixels = np.asarray(source.getchannel('A'))
    foot_y, foot_x = np.where((pixels > 128) & (np.indices(pixels.shape)[0] >= bounds[3]-6))
    anchor = float(foot_x.mean())-bounds[0] if len(foot_x) else character.width/2
    factor = 468/character.height
    width = round(character.width * 468 / character.height)
    character = character.resize((width, 468), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (1280, 720), (0, 255, 0, 255))
    canvas.alpha_composite(character, (round(640-anchor*factor), 612-468))
    target = ROOT / 'work/generation/gpt-source-reference.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert('RGB').save(target)
    print(str(target))


def retime(source, target, despill=False):
    metadata = info(source)
    size = (metadata['width'], metadata['height'])
    if size not in ((640, 360), (1280, 720)) or metadata['r_frame_rate'] != '24/1':
        raise ValueError('补帧输入必须是 640×360 或 1280×720、24 fps 的透明成品。')
    frame_bytes = size[0]*size[1]*4
    decoder = subprocess.Popen(bounded([FFMPEG, '-loglevel', 'error', '-c:v', 'libvpx-vp9',
        '-i', str(source), '-an', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']), stdout=subprocess.PIPE)
    encoder = subprocess.Popen(bounded([FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo',
        '-pix_fmt', 'rgba', '-s', f'{size[0]}x{size[1]}', '-r', '120', '-i', '-', '-an', '-c:v', 'libvpx-vp9',
        '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '18', '-deadline', 'good', '-cpu-used', '4',
        '-auto-alt-ref', '0', '-tile-columns', '1', '-row-mt', '1', str(target)]), stdin=subprocess.PIPE)
    read_exact = original('chroma_step02.py').read_exact
    count = 0
    try:
        data = read_exact(decoder.stdout, frame_bytes)
        if len(data) != frame_bytes:
            raise ValueError('视频没有完整帧。')
        first = clean_edge(data, size) if despill else Image.frombytes('RGBA', size, data)
        while True:
            data = read_exact(decoder.stdout, frame_bytes)
            if not data:
                break
            if len(data) != frame_bytes:
                raise ValueError('视频帧不完整。')
            second = clean_edge(data, size) if despill else Image.frombytes('RGBA', size, data)
            pair = prepare_pair(first, second)
            for phase in range(5):
                frame = first if phase == 0 else interpolate(pair, phase/5).convert('RGBA')
                encoder.stdin.write(frame.tobytes())
                count += 1
            first = second
        for _ in range(5):
            encoder.stdin.write(first.tobytes())
            count += 1
        decoder.stdout.close()
        encoder.stdin.close()
        if decoder.wait() != 0 or encoder.wait() != 0:
            raise RuntimeError('120 fps 视频编解码失败。')
    finally:
        for process in (decoder, encoder):
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
    assert_alpha(target)
    return count


def clean_edge(data, size=(640, 360)):
    # This white/lavender character has no green parts. Remove key/4:2:0 spill
    # before optical flow so green contours cannot spread into intermediate frames.
    frame = np.frombuffer(data, np.uint8).reshape(size[1], size[0], 4).copy()
    frame[..., 1] = np.minimum(frame[..., 1], np.maximum(frame[..., 0], frame[..., 2]))
    return Image.fromarray(frame)


def review(video, target):
    duration = info(video)['duration']
    canvas = Image.new('RGB', (1280, 750), '#ededf3')
    draw = ImageDraw.Draw(canvas)
    for index, time in enumerate([0, duration*.2, duration*.4, duration*.6, duration*.8, max(0, duration-.05)]):
        decoded = run([FFMPEG, '-loglevel', 'error', '-ss', str(time), '-c:v', 'libvpx-vp9', '-i', str(video),
                       '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], check=True, capture_output=True)
        from io import BytesIO
        frame = Image.open(BytesIO(decoded.stdout)).convert('RGBA')
        x, y = index % 2 * 640, index // 2 * 250
        frame.thumbnail((600, 220), Image.Resampling.LANCZOS)
        canvas.paste(frame, (x+20, y+20), frame)
        draw.text((x+20, y+238), f'{time:.2f} s', fill='#4a4864')
    canvas.save(target)


def process(name, source, green, region=None, output_height=360):
    if output_height not in (360, 720):
        raise ValueError('输出高度只能为 360 或 720。')
    actions = json.loads((ROOT / 'assets/actions.json').read_text(encoding='utf-8'))
    if name not in {action['name'] for action in actions}:
        raise ValueError('未知动作名。')
    source = Path(source).resolve(strict=True)
    metadata = info(source)
    if not .2 <= metadata['duration'] <= 10.2:
        raise ValueError('原项目配方要求约 10 秒；素材时长必须在 0.2～10.2 秒内。')
    if abs(metadata['width']/metadata['height'] - 16/9) > .01:
        raise ValueError('素材必须为 16:9；请按原项目构图生成，避免拉伸角色。')
    if region:
        x, y, width, height = region
        if not green or min(x, y) < 0 or min(width, height) <= 0 or x+width > metadata['width'] or y+height > metadata['height']:
            raise ValueError('提取范围须位于绿幕源视频内部；请先检查完整动作不会被裁切。')
    folder = ROOT / ('work/pipeline' if output_height == 360 else 'work/pipeline-hd') / name
    folder.mkdir(parents=True, exist_ok=True)
    keyed = folder / 'step02.webm'
    normalized = folder / 'step03.webm'
    original_clip = folder / 'step04-24fps.webm'
    final = folder / 'video-120fps.webm'
    candidate = folder / 'video-120fps.pending.webm'
    if green:
        prepared = folder / 'step01.mp4'
        filters = []
        if region:
            filters.append(f'crop=w={width}:h={height}:x={x}:y={y}:exact=1,pad={metadata["width"]}:{metadata["height"]}:{x}:{y}:color=0x00FF00')
        filters += ['scale=1280:720', 'fps=24']
        run([FFMPEG, '-y', '-loglevel', 'error', '-i', str(source), '-vf', ','.join(filters),
             '-an', '-c:v', 'libx264', '-crf', '18', str(prepared)], check=True)
        chroma = original('chroma_step02.py')
        # This white/lavender character has no green parts. Include dark green
        # generated floor shadows without removing neutral black line work.
        chroma.VAL_MIN = 0.0
        chroma.convert_video(prepared, keyed, chroma.sample_background_color(prepared))
    elif source.suffix.lower() == '.webm':
        assert_alpha(source)
        shutil.copyfile(source, keyed)
    else:
        original('pr_import_step02.py').convert_video(source, keyed)
        assert_alpha(keyed)
    normalization = original('normalize_step03.py')
    keyed_info = info(keyed)
    normalization.SRC_W, normalization.SRC_H = keyed_info['width'], keyed_info['height']
    standing = normalization.measure_standing(keyed)
    union = normalization.measure_content_union(keyed)
    scale = normalization.TARGET_HEIGHT / standing['height']
    dx = normalization.CANVAS_W/2 - standing['center_x']*scale
    dy = normalization.FEET_Y - standing['max_y']*scale
    bounds = [union[0]*scale+dx, union[1]*scale+dy, union[2]*scale+dx, union[3]*scale+dy]
    if bounds[0] < 0 or bounds[1] < 0 or bounds[2] >= normalization.CANVAS_W or bounds[3] >= normalization.CANVAS_H:
        raise ValueError('按原项目脚底/身高对齐后动作会被裁切，请调整源视频构图。')
    # Matroska timestamps are millisecond-rounded. Align to the 24 fps frame grid
    # before overlay so shortest=1 does not discard the final standing frame.
    filters = normalization.build_filter(scale, standing).replace(
        '[0:v]scale=', '[0:v]fps=24,settb=1/24,setpts=N,scale=')
    normalization.convert_video(keyed, normalized, filters)
    encoding = original('encode_thumbs.py')
    encoding.TARGET_W, encoding.TARGET_H = output_height*16//9, output_height
    encoding.CRF = 18
    encoding.convert_video(normalized, original_clip)
    frames = retime(original_clip, candidate, despill=green)
    review(candidate, folder / 'review.png')
    report = {'name': name, 'upstream': 'dsh-pet@0.3.7', 'sourceFPS': 24, 'fps': 120, 'frames': frames,
              'duration': info(candidate)['duration'], 'standing': standing, 'contentUnion': union,
              'scale': scale, 'extractionRegion': region, 'greenEdgeDespill': green,
              'darkGreenShadowRemoval': green,
              'outputWidth': encoding.TARGET_W, 'outputHeight': encoding.TARGET_H, 'manualReviewRequired': True}
    candidate.replace(final)
    (folder / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'video': str(final), 'review': str(folder / 'review.png'), **report}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('reference')
    media = sub.add_parser('process')
    media.add_argument('name')
    media.add_argument('source')
    media.add_argument('--green', action='store_true')
    media.add_argument('--height', type=int, choices=(360, 720), default=360)
    media.add_argument('--region', type=int, nargs=4, metavar=('X', 'Y', 'WIDTH', 'HEIGHT'))
    args = parser.parse_args()
    try:
        if args.command == 'reference':
            reference()
        else:
            process(args.name, args.source, args.green, args.region, args.height)
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
