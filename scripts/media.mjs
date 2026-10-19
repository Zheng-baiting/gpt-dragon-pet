import { readFile, mkdir, access, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root, runtime } from '../src/paths.mjs';

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
    'fps=1,alphaextract,signalstats,metadata=print:file=-', '-f', 'null', '-']);
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

export async function encodePreview() {
  await mkdir(runtime, { recursive: true });
  const output = join(runtime, 'reference-preview.webm');
  runVideo(['-y', '-loop', '1', '-i', join(root, 'assets/gpt-reference.png'),
    '-t', '2', '-r', '24', '-vf', 'scale=640:360,format=yuva420p',
    '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-lossless', '1',
    '-row-mt', '1', '-threads', '2', '-auto-alt-ref', '0', output]);
  assertAlpha(output);
  return output;
}

export async function importVideo(name, input, chroma) {
  const actions = await mediaStatus();
  const action = actions.find((a) => a.name === name);
  if (!action) throw Error('未知动作名。先执行 npm run media:list 查看允许的名称。');
  if (action.available) throw Error('该动作已经存在；请先核对现有文件，导入不会覆盖素材。');
  if (chroma && !/^0x[0-9a-f]{6}$/i.test(chroma)) throw Error('抠像颜色必须是 0xRRGGBB。');
  input = resolve(input);
  await access(input);
  if (!chroma) {
    if (!input.toLowerCase().endsWith('.webm')) throw Error('无色键导入只接受已有透明 WebM；纯色背景视频需要 --chroma。');
    // Check the source before transparent letterboxing could mask an opaque background.
    assertAlpha(input);
  }
  await mkdir(join(root, 'assets/webm'), { recursive: true });
  const temp = join(runtime, `import-${Date.now()}.webm`);
  await mkdir(runtime, { recursive: true });
  const filters = [
    ...(chroma ? [`chromakey=${chroma}:0.15:0.05`] : []),
    'scale=640:360:force_original_aspect_ratio=decrease',
    'pad=640:360:(ow-iw)/2:(oh-ih)/2:color=0x00000000', 'format=yuva420p',
  ];
  try {
    runVideo(['-y', ...(!chroma && input.toLowerCase().endsWith('.webm') ? ['-c:v', 'libvpx-vp9'] : []),
      '-i', input, '-t', '10', '-vf', filters.join(','), '-an', '-r', '30',
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '25',
      '-auto-alt-ref', '0', '-row-mt', '1', '-threads', '2', temp]);
    assertAlpha(temp);
    await rename(temp, join(root, 'assets/webm', action.file));
  } finally { await unlink(temp).catch(() => {}); }
  return action.file;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, name, input, flag, chroma] = process.argv.slice(2);
    if (command === 'list') {
      const actions = await mediaStatus();
      for (const a of actions) console.log(`${a.available ? '已导入' : '待制作'}  ${a.name}`);
      console.log(`\n${actions.filter((a) => a.available).length}/${actions.length} 段正式动作视频已导入。`);
    } else if (command === 'preview') console.log(await encodePreview());
    else if (command === 'import' && name && input && (!flag || flag === '--chroma')) {
      if (flag && !chroma) throw Error('--chroma 缺少颜色值。');
      console.log('已导入：' + await importVideo(name, input, chroma));
    } else throw Error('用法：media.mjs list | preview | import <动作名> <视频路径> [--chroma 0x00FF00]');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
