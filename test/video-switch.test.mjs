import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { upstream } from '../src/paths.mjs';
import { switchVideo, patchVideoSwitch } from '../src/video-switch.mjs';

function fixture() {
  let id = 0;
  const timers = new Map();
  const video = () => ({
    readyState: 2, style: {}, paused: false, frames: new Map(), listeners: new Map(),
    classList: { front: false, add() { this.front = true; }, remove() { this.front = false; } },
    addEventListener(name, cb) { this.listeners.set(name, cb); },
    removeEventListener(name, cb) { if (this.listeners.get(name) === cb) this.listeners.delete(name); },
    requestVideoFrameCallback(cb) { this.frames.set(++id, cb); return id; },
    cancelVideoFrameCallback(key) { this.frames.delete(key); },
    load() {}, play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    present() { [...this.frames.values()].forEach(cb => cb()); },
  });
  const context = { S: {}, console: { warn() {} }, window: {
    setTimeout(cb, delay) { timers.set(++id, { cb, delay }); return id; },
    clearTimeout(key) { timers.delete(key); }, requestAnimationFrame(cb) { cb(); },
  } };
  const sprite = { front: 0, gen: 0, pending: null, assetBase: 'assets/',
    videoA: video(), videoB: video(), facing: 'right',
    handleEnded() { this.ended = true; }, startSquash() { this.squashed = true; },
    startMoveDrive() { this.moved = true; },
  };
  sprite.videoA.classList.front = true;
  sprite.switchTo = vm.runInNewContext('(' + switchVideo.toString() + ')', context);
  const fire = delay => {
    for (const [key, timer] of [...timers]) if (timer.delay === delay) {
      timers.delete(key); timer.cb();
    }
  };
  return { sprite, fire };
}

test('handoff waits for a presented frame and keeps both clips moving during the fade', () => {
  const { sprite, fire } = fixture();
  sprite.pendingSquash = true;
  sprite.pendingMove = {};
  sprite.switchTo('点击', true);
  assert.equal(sprite.front, 0);
  assert.equal(sprite.videoA.classList.front, true);
  assert.equal(sprite.videoB.classList.front, false);
  assert.equal(sprite.squashed, undefined);
  sprite.videoB.present();
  assert.equal(sprite.front, 1);
  assert.equal(sprite.videoB.style.transform, 'scaleX(-1)');
  assert.equal(sprite.videoA.paused, false);
  assert.equal(sprite.squashed, true);
  assert.equal(sprite.moved, true);
  sprite.videoB.onended();
  assert.equal(sprite.ended, true);
  fire(180);
  assert.equal(sprite.videoA.paused, true);
});

test('rapid replacement cancels old callbacks; a retired timer cannot pause a reused video', () => {
  const { sprite, fire } = fixture();
  sprite.switchTo('first', true);
  const stale = [...sprite.videoB.frames.values()][0];
  sprite.switchTo('latest', true);
  assert.equal(sprite.videoB.frames.size, 1);
  stale();
  assert.equal(sprite.front, 0);
  sprite.videoB.present();
  sprite.switchTo('third', true);
  sprite.videoA.present();
  fire(180);
  assert.equal(sprite.front, 0);
  assert.equal(sprite.videoA.paused, false);
  assert.equal(sprite.videoB.paused, true);
});

test('failure and timeout keep the current clip visible and allow retrying the same action', () => {
  for (const failure of ['error', 'timeout']) {
    const { sprite, fire } = fixture();
    sprite.switchTo('missing', true);
    const stale = [...sprite.videoB.frames.values()][0];
    if (failure === 'error') sprite.videoB.onerror();
    else fire(10000);
    assert.equal(sprite.pending, null);
    stale();
    assert.equal(sprite.front, 0);
    assert.equal(sprite.videoA.classList.front, true);
    sprite.switchTo('missing', true);
    sprite.videoB.present();
    assert.equal(sprite.front, 1);
  }
});

test('the pinned upstream sprite accepts the scoped patch and retains unrelated methods', async () => {
  const source = await readFile(join(upstream, 'runtime/electron-helper/sprite.js'), 'utf8');
  const patched = patchVideoSwitch(source);
  new vm.Script(patched);
  assert(patched.endsWith(source.slice(source.indexOf('\n  playOnce(name) {'))));
  assert.match(patched, /dispose\(\) \{\n    this.pending\?\.cancel/);
  assert.throws(() => patchVideoSwitch('changed upstream'), /入口已变化/);
});
