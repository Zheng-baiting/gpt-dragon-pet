"""Build two small, transparent keyframe animations; no video service is used."""
import json
import math
import os
import subprocess
import sys
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'work' / 'tools' / 'python'))
import numpy as np
from PIL import Image, ImageChops, ImageDraw
from motion import prepare_pair, interpolate
FPS = 120
FFMPEG = os.environ.get("GPT_PET_FFMPEG", "ffmpeg")


def cell_frame(cell):
    im = cell.convert("RGBA")
    alpha = im.getchannel("A")
    # Isolate the connected character, including softly antialiased edges.
    from PIL import ImageFilter
    solid = alpha.point(lambda v: 255 if v >= 32 else 0).filter(ImageFilter.MaxFilter(3))
    a = np.asarray(solid)
    ys, xs = np.where(a > 0)
    if not len(xs):
        raise RuntimeError("Empty animation cell")
    index = np.argmin((xs - im.width / 2) ** 2 + (ys - im.height / 2) ** 2)
    ImageDraw.floodfill(solid, (int(xs[index]), int(ys[index])), 128)
    keep = solid.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(5))
    alpha = ImageChops.multiply(alpha, keep).point(lambda v: 0 if v < 16 else v)
    im.putalpha(alpha)
    im.paste((0, 0, 0, 0), (0, 0), alpha.point(lambda v: 255 if v == 0 else 0))
    bounds = alpha.point(lambda v: 255 if v > 32 else 0).getbbox()
    if not bounds:
        raise RuntimeError("Character extraction failed")
    pixels = np.asarray(alpha)
    foot_y, foot_x = np.where((pixels > 128) & (np.indices(pixels.shape)[0] >= bounds[3] - 6))
    anchor = float(np.mean(foot_x)) if len(foot_x) else (bounds[0] + bounds[2]) / 2
    crop = im.crop(bounds)
    scale = 260 / crop.height
    scaled = crop.resize((round(crop.width * scale), 260), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (640, 360))
    canvas.alpha_composite(scaled, (round(320 - (anchor - bounds[0]) * scale), 330 - scaled.height))
    return canvas


def sheet_frames(name, columns, rows):
    sheet = Image.open(ROOT / "assets" / "sheets" / name).convert("RGBA")
    result = []
    for row in range(rows):
        for column in range(columns):
            box = (round(column * sheet.width / columns), round(row * sheet.height / rows),
                   round((column + 1) * sheet.width / columns), round((row + 1) * sheet.height / rows))
            result.append(cell_frame(sheet.crop(box)))
    return result


def animate(frames, timeline, folder, output, breathe=False):
    folder.mkdir(parents=True, exist_ok=True)
    premultiplied = [frame.convert('RGBa') for frame in frames]
    flow_cache = {}
    count = round(timeline[-1][0] * FPS)
    rendered = []
    hashes = set()
    command = [FFMPEG, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                    "-f", "rawvideo", "-pixel_format", "rgba", "-video_size", "640x360",
                    "-framerate", str(FPS), "-i", "pipe:0", "-frames:v", str(count),
                    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "18",
                    "-deadline", "good", "-cpu-used", "4", "-tile-columns", "1",
                    "-auto-alt-ref", "0", "-row-mt", "1", "-threads", "2", "-an", str(output)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for number in range(count):
            time = number / FPS
            interval = next(i for i in range(len(timeline) - 1) if timeline[i + 1][0] > time)
            left, right = timeline[interval], timeline[interval + 1]
            progress = (time - left[0]) / (right[0] - left[0])
            progress = (1 - math.cos(math.pi * progress)) / 2
            lidx, ridx = left[1], right[1]
            if lidx == ridx:
                frame = premultiplied[lidx]
            else:
                pair = (lidx, ridx)
                if pair not in flow_cache:
                    flow_cache[pair] = prepare_pair(frames[lidx], frames[ridx])
                frame = interpolate(flow_cache[pair], progress)
            if breathe:
                # Continuous subpixel breathing: no integer resize or position steps.
                pulse = math.sin(2*math.pi*time/timeline[-1][0])
                sx, sy = 1-0.003*pulse, 1+0.008*pulse
                frame = frame.transform((640,360), Image.Transform.AFFINE,
                    (1/sx,0,320*(1-1/sx),0,1/sy,330*(1-1/sy)), Image.Resampling.BICUBIC)
            frame = frame.convert('RGBA')
            data = frame.tobytes()
            hashes.add(hashlib.sha256(data).digest())
            process.stdin.write(data)
            if number in {0, round(count/4), round(count/2), round(count*3/4), count-1}:
                frame.save(folder / f'{number:04}.png')
            if number % (FPS//10) == 0:
                rendered.append(frame.resize((480,270), Image.Resampling.LANCZOS))
        process.stdin.close()
        error = process.stderr.read().decode('utf-8', errors='replace')
        if process.wait() != 0:
            raise RuntimeError(error)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)
    return count, rendered, len(hashes)


def main():
    out = ROOT / "assets" / "basic"
    out.mkdir(parents=True, exist_ok=True)
    idle = sheet_frames("chibi-idle.png", 4, 2)
    wave = sheet_frames("chibi-wave.png", 3, 2)
    idle_timeline = [(0, 0), (1.5, 0), (1.55, 2), (1.61, 3), (1.69, 3), (1.75, 4), (1.82, 0), (4.5, 0)]
    wave_timeline = [(0, 0), (0.25, 1), (0.55, 2), (0.85, 3), (1.1, 4), (1.35, 3), (1.6, 4), (2.0, 5), (2.4, 0)]
    info = []
    preview_frames = []
    for name, frames, timeline, breath in [
        ("Q版-眨眼呼吸", idle, idle_timeline, True),
        ("Q版-点击招手", wave, wave_timeline, False),
    ]:
        folder = ROOT / "work" / "basic-frames" / name
        output = out / f"{name}.webm"
        count, gif_frames, unique = animate(frames, timeline, folder, output, breath)
        info.append({"name": name, "file": output.name, "frames": count, "fps": FPS,
                     "duration": count / FPS, "uniqueRenderedFrames": unique,
                     "interpolation": "bidirectional-optical-flow", "originalKeyframes": len(frames)})
        preview_frames += gif_frames
    # First idle frame is the reference used on the desktop, so the artwork matches.
    idle[0].resize((1920, 1080), Image.Resampling.LANCZOS).save(ROOT / "assets" / "gpt-reference.png", optimize=True)
    palette_source = Image.new("RGB", (480, 810))
    for row, index in enumerate([0, 15, len(preview_frames) - 8]):
        palette_source.paste(preview_frames[index].convert("RGB"), (0, row * 270))
    palette = palette_source.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    gif_frames = []
    for frame in preview_frames:
        indexed = frame.convert("RGB").quantize(palette=palette)
        indexed.putpalette(palette.getpalette()[:765] + [0, 0, 0])
        indexed.paste(255, (0, 0), frame.getchannel("A").point(lambda value: 255 if value < 128 else 0))
        indexed.info["transparency"] = 255
        gif_frames.append(indexed)
    gif_frames[0].save(ROOT / "assets" / "basic-preview.gif", save_all=True,
                       append_images=gif_frames[1:], duration=100, loop=0, disposal=2,
                       transparency=255, optimize=False)
    (out / "manifest.json").write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(info, ensure_ascii=False))


if __name__ == "__main__":
    main()
