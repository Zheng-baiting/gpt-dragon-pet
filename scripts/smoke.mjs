import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { root, upstream, json } from '../src/paths.mjs';
import { stop } from '../src/control.mjs';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function measurePlayback(evaluate, milliseconds) {
  return evaluate(`new Promise(resolve => {
    const elements = [...document.querySelectorAll('video')];
    const started = performance.now(); const callbacks = new Map();
    let displayed = 0; let finished = false;
    const samples = new Map();
    const current = sprites[0];
    const initialFront = current.front === 0 ? current.videoA : current.videoB;
    const qualityBefore = initialFront.getVideoPlaybackQuality();
    function next(video) {
      callbacks.set(video, video.requestVideoFrameCallback((now, metadata) => {
        if (finished) return;
        const sprite = sprites[0];
        const front = sprite.front === 0 ? sprite.videoA : sprite.videoB;
        if (video === front) {
          displayed++;
          const sample = samples.get(video) || { first: metadata, last: metadata, callbacks: 0 };
          sample.last = metadata; sample.callbacks++;
          samples.set(video, sample);
        }
        next(video);
      }));
    }
    elements.forEach(next);
    setTimeout(() => {
      finished = true;
      for (const [video, callback] of callbacks) video.cancelVideoFrameCallback(callback);
      const qualityAfter = initialFront.getVideoPlaybackQuality();
      const elapsed = (performance.now() - started) / 1000;
      // A paused outgoing video may count discarded queued frames as dropped.
      // Restrict quality counters to the video under measurement.
      const total = Math.max(0, qualityAfter.totalVideoFrames-qualityBefore.totalVideoFrames);
      const dropped = Math.max(0, qualityAfter.droppedVideoFrames-qualityBefore.droppedVideoFrames);
      // Callbacks may be coalesced. Use the compositor's presentedFrames counter,
      // not the number of JavaScript callbacks, to measure video presentation.
      const segments = [...samples.values()].map(s => ({
        frames: s.last.presentedFrames - s.first.presentedFrames,
        seconds: (s.last.presentationTime - s.first.presentationTime) / 1000,
        callbackCount: s.callbacks, first: s.first, last: s.last
      }));
      const observedFrames = segments.reduce((sum,s) => sum+s.frames,0);
      const observedSeconds = segments.reduce((sum,s) => sum+s.seconds,0);
      resolve({ seconds: elapsed, presentedCallbacks: displayed, callbackFPS: displayed / elapsed,
        observedFPS: observedSeconds ? observedFrames / observedSeconds : 0, segments, totalVideoFrames: total,
        droppedVideoFrames: dropped, dropPercent: total ? dropped / total * 100 : 0 });
    }, ${milliseconds});
  })`);
}
const port = await new Promise((resolve) => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(() => resolve(value));
  });
});
const child = spawn(process.execPath, [join(root, 'src/run.mjs'), '--preview'], {
  cwd: root, windowsHide: true, stdio: 'ignore',
  env: { ...process.env, GPT_PET_DEBUG_PORT: String(port) },
});
let socket;
try {
  let target;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((item) => item.type === 'page');
      if (target) break;
    } catch {}
    await pause(250);
  }
  assert(target, 'Electron debugging target did not start.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const value = JSON.parse(data);
    if (!value.id) return;
    const request = pending.get(value.id);
    if (!request) return;
    pending.delete(value.id);
    clearTimeout(request.timer);
    if (value.error) request.reject(Error(JSON.stringify(value.error)));
    else request.resolve(value.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`Timed out: ${method}`)); }, 12000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const value = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) throw Error(JSON.stringify(value.exceptionDetails));
    return value.result.value;
  };
  let ready = false;
  for (let i = 0; i < 60; i++) {
    ready = await evaluate('window.__dshPetDebug?.configOk === true && [...document.querySelectorAll("video")].some(v => v.readyState >= 2)');
    if (ready) break;
    await pause(200);
  }
  assert(ready, 'Original renderer did not load the reference preview video.');
  const main = await readFile(join(upstream, 'runtime/electron-helper/main.js'), 'utf8');
  const marker = 'const dump = await first.webContents.executeJavaScript(`';
  const start = main.indexOf(marker);
  assert(start >= 0, 'Pinned upstream smoke test changed.');
  let expression = main.slice(start + marker.length).split('`);')[0];
  // The published smoke test predates the lost-pointerup guard: a held drag
  // must report buttons=1, otherwise the renderer correctly treats it as release.
  const corrected = expression.replace(/(pointerId: 94 \}\)\);\s*window\.dispatchEvent\(new MouseEvent\('mousemove', \{)/,
    '$1 buttons: 1,');
  assert.notEqual(corrected, expression, 'Upstream synthetic drag event changed.');
  expression = corrected;
  const dump = await evaluate(expression);
  await mkdir(join(root, 'work'), { recursive: true });
  await writeFile(join(root, 'work/smoke-raw.json'), json(dump));
  assert.equal(dump.errorVisible, false);
  assert.equal(dump.sprites, 1);
  assert.equal(dump.releaseKeptPosition?.kept, true);
  assert.equal(dump.interactiveFlip?.inside, true);
  assert.equal(dump.interactiveFlip?.outside, true);
  assert.equal(dump.interactiveFlip?.duringDragForced, true);
  assert.equal(dump.menuSmoke?.menuMounted, true);
  assert.equal(dump.menuSmoke?.errsNew, 0);
  assert(dump.menuSmoke.lvl3SurvivedAfterReenter >= 3);
  await mkdir(join(root, 'work'), { recursive: true });
  const menuImage = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(root, 'work/native-menu.png'), Buffer.from(menuImage.data, 'base64'));
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true');
  const cleanImage = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(root, 'work/native-preview.png'), Buffer.from(cleanImage.data, 'base64'));
  await pause(250);
  await evaluate('document.querySelector(".pet-hit").click(); true');
  let playedWave = false;
  for (let i = 0; i < 30; i++) {
    playedWave = await evaluate('sprites[0].anim === "Q版-点击招手"');
    if (playedWave) break;
    await pause(100);
  }
  assert(playedWave, 'Click did not play the chibi wave clip.');
  await pause(100);
  const wavePlayback = await measurePlayback(evaluate, 1800);
  const waveImage = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(root, 'work/native-wave.png'), Buffer.from(waveImage.data, 'base64'));
  let returnedToIdle = false;
  for (let i = 0; i < 45; i++) {
    returnedToIdle = await evaluate('sprites[0].anim === "Q版-眨眼呼吸"');
    if (returnedToIdle) break;
    await pause(100);
  }
  assert(returnedToIdle, 'Wave did not return to blinking idle.');
  const playback = await measurePlayback(evaluate, 3000);
  const frameTiming = await evaluate(`new Promise(resolve => {
    const frames = []; let last; function tick(now) {
      if (last !== undefined) frames.push(now - last); last = now;
      if (frames.length < 120) requestAnimationFrame(tick);
      else { const sorted = frames.toSorted((a,b) => a-b); resolve({ medianMs: sorted[60], p95Ms: sorted[114] }); }
    } requestAnimationFrame(tick);
  })`);
  const report = { renderer: 'dsh-pet@0.3.7', previewIsStatic: false, playedWave, returnedToIdle, dump, frameTiming, playback, wavePlayback };
  await writeFile(join(root, 'work/smoke-report.json'), json(report));
  if (process.env.GPT_PET_MIN_FPS) {
    const minimum = Number(process.env.GPT_PET_MIN_FPS);
    assert(playback.observedFPS >= minimum, `Idle playback below ${minimum} fps.`);
    assert(wavePlayback.observedFPS >= minimum, `Wave playback below ${minimum} fps.`);
  }
  console.log(JSON.stringify({ ok: true, releaseKeptPosition: dump.releaseKeptPosition,
    interactiveFlip: dump.interactiveFlip, menu: dump.menuSmoke, playedWave, returnedToIdle, frameTiming, playback, wavePlayback }, null, 2));
} finally {
  socket?.close();
  await stop();
  await pause(1200);
  if (child.exitCode === null) child.kill('SIGTERM');
}
