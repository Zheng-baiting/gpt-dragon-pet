"""Preserve this Jimeng export's 241 VFR frames one-to-one at CFR24.

Usage: python assets/sources/打瞌睡被惊醒-jimeng-processing.py SOURCE.mp4 OUTPUT_DIR
Then use the processing commands recorded in 打瞌睡被惊醒.json. No interpolation.
"""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'scripts'))
from pipeline import FFMPEG, FFPROBE, run

source, folder = Path(sys.argv[1]), Path(sys.argv[2])
assert hashlib.sha256(source.read_bytes()).hexdigest() == '9438c19051bf1816acd09a294aaae51bd26237ffc865d58c8476d818aa1f0e4e'
metadata = json.loads(run([FFPROBE, '-v', 'error', '-select_streams', 'v:0',
    '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(source)],
    check=True, capture_output=True).stdout)
v = metadata['streams'][0]
assert (v['width'], v['height'], int(v['nb_read_frames'])) == (1280, 720, 241)
folder.mkdir(parents=True, exist_ok=True)
target = folder / 'source-cfr24.mp4'
assert source.resolve() != target.resolve()
run([FFMPEG, '-y', '-v', 'error', '-i', str(source), '-vf', 'settb=1/24,setpts=N',
    '-r', '24', '-fps_mode', 'cfr', '-an', '-c:v', 'libx264', '-crf', '18', str(target)], check=True)
prepared = json.loads(run([FFPROBE, '-v', 'error', '-select_streams', 'v:0',
    '-count_frames', '-show_streams', '-of', 'json', str(target)],
    check=True, capture_output=True).stdout)['streams'][0]
assert int(prepared['nb_read_frames']) == 241 and prepared['r_frame_rate'] == '24/1'
(folder / 'source-metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(target))
