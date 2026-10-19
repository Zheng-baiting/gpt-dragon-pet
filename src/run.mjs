import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { createServer } from 'node:net';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { root, runtime, json } from './paths.mjs';
import { status } from './control.mjs';
import { installElectron, prepareEngine } from './engine.mjs';
import { encodePreview, mediaStatus } from '../scripts/media.mjs';

const preview = process.argv.includes('--preview');
try {
  if (await status(preview)) { console.log('本模式的 GPT 娘已在运行。'); process.exit(0); }
  if (!preview) {
    const actions = await mediaStatus();
    const missing = actions.filter((a) => !a.available);
    if (missing.length) throw Error(`还缺 ${missing.length}/${actions.length} 段正式动作视频。用 npm run media:list 查看；npm run preview 可查看静态定稿。`);
  } else {
    try { await access(join(runtime, 'reference-preview.webm')); }
    catch { await encodePreview(); }
  }
  await installElectron();
  const { base, engine, env } = await prepareEngine(preview);
  const port = await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const chosen = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(chosen));
    });
  });
  await mkdir(base, { recursive: true });
  const child = spawn(process.execPath, [join(engine, 'lib/standalone.js'), '--port', String(port)], {
    cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
  let stdout = '';
  let announced = false;
  let hostWrite = Promise.resolve();
  const log = createWriteStream(join(base, 'engine.log'), { flags: 'a' });
  log.on('error', (error) => { console.error(error.message); child.kill('SIGTERM'); });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
    const text = chunk.toString();
    log.write(text);
    process.stdout.write(text);
    if (stream !== child.stdout || announced) return;
    stdout = (stdout + text).slice(-8192);
    const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)\/dsh-pet-7340\//);
    if (match) {
      announced = true;
      hostWrite = writeFile(join(base, 'host.json'), json({
        pid: child.pid, launcherPid: process.pid, port: Number(match[1]), engine, preview,
        project: root, startedAt: new Date().toISOString(),
      }));
      hostWrite.catch((error) => { console.error(error.message); child.kill('SIGTERM'); });
    }
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  const code = await new Promise((resolve) => child.once('close', resolve));
  await hostWrite;
  await new Promise((resolve) => log.end(resolve));
  process.exitCode = code ?? 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
