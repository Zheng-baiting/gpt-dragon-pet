import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadArtifact } from '@electron/get';
import extract from '@electron-internal/extract-zip';
import { root, upstream, runtime, profile, json } from './paths.mjs';

export const electronPath = join(runtime, 'electron', process.platform === 'win32' ? 'electron.exe' : 'electron');

export async function installElectron() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw Error('本项目的启动包装目前只验证了 Windows x64。');
  }
  try { await access(electronPath); return electronPath; } catch {}
  await mkdir(join(runtime, 'electron'), { recursive: true });
  console.log('下载 Electron 43.3.0（约 138 MB），运行时和缓存仅放在项目目录。');
  let nextLog = 0;
  const zip = await downloadArtifact({
    version: '43.3.0', artifactName: 'electron', platform: 'win32', arch: 'x64',
    cacheRoot: join(root, 'work/electron-cache'),
    mirrorOptions: { mirror: process.env.GPT_PET_ELECTRON_MIRROR || 'https://github.com/electron/electron/releases/download/' },
    downloadOptions: { quiet: true, getProgressCallback: async ({ transferred, total }) => {
      if (Date.now() > nextLog) {
        nextLog = Date.now() + 5000;
        console.log(`Electron ${(transferred / 1048576).toFixed(1)} / ${total ? (total / 1048576).toFixed(1) : '?'} MB`);
      }
    } },
  });
  await extract(zip, { dir: join(runtime, 'electron') });
  await access(electronPath);
  return electronPath;
}

export async function prepareEngine(preview) {
  const base = profile(preview);
  const engine = join(base, 'engine');
  for (const folder of ['engine/assets', 'profile', 'session', 'logs', 'temp', 'data']) {
    await mkdir(join(base, folder), { recursive: true });
  }
  // Copy only the original runtime, not the blue whale's animations or account features.
  for (const part of ['package.json', 'lib', 'runtime/electron-helper', 'assets/fonts', 'assets/pic']) {
    await cp(join(upstream, part), join(engine, part), { recursive: true });
  }
  const helper = join(engine, 'runtime/electron-helper/main.js');
  const text = await readFile(helper, 'utf8');
  const marker = "app.setName('dsh-pet-electron-helper');";
  if (text.split(marker).length !== 2) throw Error('上游启动入口已变化；停止修改，避免不完整替换。');
  const isolation = `app.setName('gpt-dragon-pet');
const gptProfile = process.env.GPT_PET_PROFILE;
if (!gptProfile) throw new Error('GPT_PET_PROFILE is required');
app.setPath('userData', path.join(gptProfile, 'profile'));
app.setPath('sessionData', path.join(gptProfile, 'session'));
app.setPath('logs', path.join(gptProfile, 'logs'));
app.setPath('temp', path.join(gptProfile, 'temp'));
if (process.env.GPT_PET_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  app.commandLine.appendSwitch('remote-debugging-port', process.env.GPT_PET_DEBUG_PORT);
}`;
  await writeFile(helper, text.replace(marker, isolation));
  const config = JSON.parse(await readFile(join(root, preview ? 'config/preview.json' : 'config/gpt.json'), 'utf8'));
  await writeFile(join(engine, 'assets/config.jsonc'), json(config));
  const data = join(base, 'data/dsh-pet/main-animation/webm');
  await mkdir(data, { recursive: true });
  if (preview) {
    await cp(join(runtime, 'reference-preview.webm'), join(data, '角色定稿（静态预览）.webm'));
  } else {
    await cp(join(root, 'assets/webm'), data, { recursive: true });
  }
  return { base, engine, env: {
    ...process.env, GPT_PET_PROFILE: base,
    DSH_HOME: join(base, 'data'), DSH_PET_ELECTRON_PATH: electronPath,
    DSH_PET_ELECTRON_VERSION: '43.3.0', TEMP: join(base, 'temp'), TMP: join(base, 'temp'),
  } };
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--install-electron')) {
  try { console.log(await installElectron()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
