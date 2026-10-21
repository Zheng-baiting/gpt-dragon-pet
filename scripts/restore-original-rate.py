"""Make reviewable 640x360/24fps candidates from reviewed 120fps product clips.

Use the assets from Git 4013488 as input to reproduce this migration. Retains
colour and local motion repairs; selects each fifth frame, never invents new
intermediate frames. Does not import candidates or change raw sources.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from pipeline import FFMPEG, info, run

args=argparse.ArgumentParser(description=__doc__)
args.add_argument('--input',type=Path,required=True)
args.add_argument('--output',type=Path,required=True)
args.add_argument('--common-standing',action='store_true')
options=args.parse_args()
assert options.input.resolve()!=options.output.resolve()
options.output.mkdir(parents=True,exist_ok=True)
files=sorted(options.input.glob('*.webm'),key=lambda p:(p.stem!='待机呼吸休闲',p.name))
assert files,'No input clips'
records=[]
for source in files:
    meta=info(source)
    assert meta['r_frame_rate']=='120/1'
    target=options.output/source.name
    assert not target.exists(),f'Review existing candidate first: {target}'
    base=target.with_suffix('.base.webm') if options.common_standing and source.stem!='待机呼吸休闲' else target
    run([FFMPEG,'-y','-loglevel','error','-c:v','libvpx-vp9','-i',str(source),
         '-vf','select=not(mod(n\\,5)),setpts=N/(24*TB),scale=640:360:flags=lanczos',
         '-r','24','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','18',
         '-deadline','good','-cpu-used','4','-auto-alt-ref','0','-row-mt','1',str(base)],check=True)
    if base!=target:
        subprocess.run([sys.executable,str(Path(__file__).with_name('finish-common-standing.py')),source.stem,
            '--input',str(base),'--output',str(target),'--reference',str(options.output/'待机呼吸休闲.webm'),
            '--bridge-frames','9','--hold-frames','0'],check=True)
    result=info(target)
    assert (result['width'],result['height'],result['r_frame_rate'])==(640,360,'24/1')
    records.append({'name':source.stem,'inputSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'inputBytes':source.stat().st_size,
        'outputBytes':target.stat().st_size,'format':result,'commonStanding':base!=target})
    (options.output/'migration.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'{len(records)}/{len(files)} {source.stem}',flush=True)
