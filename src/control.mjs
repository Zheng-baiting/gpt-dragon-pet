import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, profile } from './paths.mjs';

export async function status(preview) {
  try {
    const data = JSON.parse(await readFile(join(profile(preview), 'host.json'), 'utf8'));
    if (data.project !== root || data.engine !== join(profile(preview), 'engine')) return null;
    const response = await fetch(`http://127.0.0.1:${data.port}/health`, { signal: AbortSignal.timeout(1500) });
    const health = await response.json();
    if (health.plugin?.root?.toLowerCase() !== data.engine.toLowerCase()) return null;
    return data;
  } catch { return null; }
}

export async function stop() {
  for (const preview of [true, false]) {
    const data = await status(preview);
    if (!data) continue;
    const response = await fetch(`http://127.0.0.1:${data.port}/shutdown`, {
      method: 'POST', signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw Error('项目进程没有接受退出请求。');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'stop') { await stop(); console.log('已请求本项目桌宠退出。'); }
    else console.log(JSON.stringify({ preview: await status(true), pet: await status(false) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
