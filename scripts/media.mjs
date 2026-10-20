import { readFile, mkdir, access, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root } from '../src/paths.mjs';

export const ffmpeg = () => process.env.GPT_PET_FFMPEG || 'ffmpeg';
export function runVideo(args) {
  const result = spawnSync(ffmpeg(), ['-hide_banner', '-nostdin', ...args], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw Error('找不到 FFmpeg。请将已有 ffmpeg.exe 路径设为当前进程 GPT_PET_FFMPEG。');
  if (result.status !== 0) throw Error(result.stderr.slice(-2400));
  return result;
}

export function assertAlpha(file) {
  const result = runVideo(['-c:v', 'libvpx-vp9', '-i', file, '-an', '-vf',
    'select=not(mod(n\\,24)),alphaextract,signalstats,metadata=print:file=-', '-f', 'null', '-']);
  const min = [...result.stdout.matchAll(/lavfi\.signalstats\.YMIN=(\d+)/g)].map((v) => Number(v[1]));
  const max = [...result.stdout.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map((v) => Number(v[1]));
  if (!min.some((v) => v < 250) || !max.some((v) => v > 10)) {
    throw Error('视频必须同时含透明背景与可见角色；拒绝全不透明或全透明素材。');
  }
}

export async function mediaStatus() {
  const actions = JSON.parse(await readFile(join(root, 'assets/actions.json'), 'utf8'));
  return Promise.all(actions.map(async (action) => {
    try { await access(join(root, 'assets/webm', action.file)); return { ...action, available: true }; }
    catch { return { ...action, available: false }; }
  }));
}

function probe(input) {
  const binary = process.env.GPT_PET_FFPROBE || join(dirname(ffmpeg()), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
  const result = spawnSync(binary, ['-v', 'error', '-show_entries',
    'stream=codec_type,width,height,r_frame_rate,avg_frame_rate:format=duration', '-of', 'json', input],
  { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw Error('无法读取视频参数，请检查已有 FFprobe 路径。');
  return JSON.parse(result.stdout);
}

async function actionFor(name) {
  const actions = await mediaStatus();
  const action = actions.find((a) => a.name === name);
  if (!action) throw Error('未知动作名。先执行 npm run media:list 查看允许的名称。');
  return action;
}

export async function processVideo(name, input, chroma, region, height = 360) {
  await actionFor(name);
  if (chroma && !/^0x00ff00$/i.test(chroma)) throw Error('原项目 HSV 抠像入口只接受绿幕；其他背景请先手工抠像导出透明 MOV。');
  input = resolve(input);
  await access(input);
  const python = process.env.GPT_PET_PYTHON;
  if (!python) throw Error('制作流程需要已有 Python；请仅在当前进程设置 GPT_PET_PYTHON 为其可执行文件路径。');
  if (region && (region.length !== 4 || !region.every(Number.isInteger))) throw Error('--region 须为 x,y,width,height 四个整数。');
  if (![360, 720].includes(height)) throw Error('--height 只能为 360 或 720。');
  const result = spawnSync(python, [join(root, 'scripts/pipeline.py'), 'process', name, input,
    ...(chroma ? ['--green'] : []), ...(region ? ['--region', ...region.map(String)] : []), '--height', String(height)],
    { cwd: root, env: { ...process.env, PYTHONUTF8: '1' }, windowsHide: true, encoding: 'utf8', maxBuffer: 8*1024*1024 });
  if (result.error || result.status !== 0) throw Error(result.stderr?.slice(-2400) || '素材处理未完成。');
  return JSON.parse(result.stdout.trim());
}

export async function importVideo(name, input) {
  const action = await actionFor(name);
  if (action.available) throw Error('该动作已经存在；请先核对现有文件，导入不会覆盖素材。');
  input = resolve(input);
  await access(input);
  if (!input.toLowerCase().endsWith('.webm')) throw Error('先执行 media:process 制作透明视频，并检查 review.png。');
  const metadata = probe(input);
  const video = metadata.streams.find(stream => stream.codec_type === 'video');
  const rate = value => { const [a,b = 1] = String(value).split('/').map(Number); return a/b; };
  const supportedSize = video && [[640, 360], [1280, 720]].some(([width, height]) => video.width === width && video.height === height);
  if (!supportedSize || rate(video.r_frame_rate) !== 120 || rate(video.avg_frame_rate) !== 120 ||
      metadata.streams.some(stream => stream.codec_type === 'audio') || !(Number(metadata.format.duration) > 0 && Number(metadata.format.duration) <= 10.2)) {
    throw Error('正式素材须为 640×360 或 1280×720、120 fps、无音轨且不超过 10.2 秒；请先执行 media:process。');
  }
  assertAlpha(input);
  await mkdir(join(root, 'assets/webm'), { recursive: true });
  // Preserve interpolated frames exactly; importing must not downsample to 30 fps.
  await copyFile(input, join(root, 'assets/webm', action.file), constants.COPYFILE_EXCL);
  return action.file;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, name, input, ...options] = process.argv.slice(2);
    if (command === 'list') {
      const actions = await mediaStatus();
      for (const a of actions) console.log(`${a.available ? '已导入' : '待制作'}  ${a.name}`);
      console.log(`\n${actions.filter((a) => a.available).length}/${actions.length} 段正式动作视频已导入。`);
    } else if (command === 'process' && name && input) {
      const flags = new Map();
      for (let i = 0; i < options.length; i += 2) {
        if (!['--chroma', '--region', '--height'].includes(options[i]) || !options[i+1] || flags.has(options[i])) throw Error('制作选项为 --chroma <颜色>、--region <x,y,width,height> 和 --height <360|720>，各使用一次。');
        flags.set(options[i], options[i+1]);
      }
      const region = flags.get('--region')?.split(',').map(Number);
      const height = flags.has('--height') ? Number(flags.get('--height')) : 360;
      console.log(JSON.stringify(await processVideo(name, input, flags.get('--chroma'), region, height), null, 2));
    } else if (command === 'import' && name && input && !options.length) {
      console.log('已导入：' + await importVideo(name, input));
    } else throw Error('用法：media.mjs list | process <动作名> <视频路径> [--chroma 0x00FF00] [--region x,y,width,height] [--height 360|720] | import <动作名> <已检查的120fps视频>');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
