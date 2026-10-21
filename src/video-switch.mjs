// Installed only into the project-owned runtime copy. Upstream sources stay intact.
export function switchVideo(next, nextOnce) {
  if (!next) return;
  if (this.pending?.anim === next && this.pending.once === nextOnce) {
    if (this.pendingSquash) {
      this.pendingSquash = false;
      this.startSquash(this.front === 0 ? this.videoA : this.videoB);
    }
    return;
  }
  this.pending?.cancel?.();
  const gen = ++this.gen;
  const el = this.front === 0 ? this.videoB : this.videoA;
  if (!el) return;
  let frameCallback;
  let prepared = false;
  const active = () => this.pending?.gen === gen;
  const cleanup = () => {
    window.clearTimeout(loadTimer);
    el.removeEventListener('loadeddata', ready);
    el.removeEventListener('playing', fallback);
    if (frameCallback !== undefined) el.cancelVideoFrameCallback(frameCallback);
    if (el.onerror === failed) el.onerror = null;
  };
  const failed = () => {
    if (!active()) return;
    cleanup();
    el.pause();
    this.pending = null;
    console.warn('[gpt-pet] Video did not present a frame: ' + next);
  };
  const commit = () => {
    if (!active()) return;
    cleanup();
    const old = this.front === 0 ? this.videoA : this.videoB;
    el.classList.add('is-front');
    if (old && old !== el) {
      old.classList.remove('is-front');
      old.onended = null;
      // Keep the outgoing clip moving during the existing 180 ms opacity fade.
      // A newer switch may reuse it; never pause that newer playback.
      window.setTimeout(() => {
        if (this.gen === gen) old.pause();
      }, 180);
    }
    this.front = this.front === 0 ? 1 : 0;
    this.pending = null;
    el.onended = nextOnce ? () => this.handleEnded() : null;
    if (this.pendingSquash) {
      this.pendingSquash = false;
      this.startSquash(el);
    }
    if (this.pendingMove) this.startMoveDrive(el);
  };
  const fallback = () => window.requestAnimationFrame(() => {
    if (el.readyState >= 2) commit();
  });
  const ready = () => {
    if (!active() || prepared) return;
    prepared = true;
    // loadeddata alone does not establish that a frame reached the compositor.
    if (typeof el.requestVideoFrameCallback === 'function') {
      frameCallback = el.requestVideoFrameCallback(commit);
    } else el.addEventListener('playing', fallback, { once: true });
    el.play().catch(failed);
  };
  const loadTimer = window.setTimeout(failed, 10000);
  this.pending = { anim: next, once: nextOnce, gen, cancel: () => {
    cleanup();
    el.pause();
    if (active()) this.pending = null;
  } };
  el.src = this.assetBase + encodeURIComponent(next) + (S.ANIMATION_EXT || '.webm');
  el.loop = !nextOnce;
  el.muted = true;
  el.autoplay = false;
  el.playsInline = true;
  el.onended = null;
  el.onerror = failed;
  el.style.transform = this.facing === 'right' ? 'scaleX(-1)' : '';
  el.addEventListener('loadeddata', ready);
  el.load();
  if (el.readyState >= 2) ready();
}

export function patchVideoSwitch(source) {
  const begin = source.indexOf('  switchTo(next, nextOnce) {');
  const end = source.indexOf('\n  playOnce(name) {', begin);
  const dispose = '  dispose() {';
  if (begin < 0 || end < begin || source.split(dispose).length !== 2) {
    throw Error('上游视频切换入口已变化，停止修改。');
  }
  const method = switchVideo.toString().replace('function switchVideo', 'switchTo');
  return (source.slice(0, begin) + '  ' + method + '\n' + source.slice(end))
    .replace(dispose, dispose + '\n    this.pending?.cancel?.();\n    ++this.gen;');
}

export function patchVideoComposition(source) {
  const stage = '\n      .pet-stage {';
  const video = '\n      video.pet-video {';
  if (source.split(stage).length !== 2 || source.split(video).length !== 2) {
    throw Error('上游视频样式入口已变化，停止修改。');
  }
  // Source-over fades lose 25% opacity halfway through even for identical frames.
  // Isolated additive blending preserves premultiplied colour and alpha weights.
  return source.replace(stage, stage + '\n        isolation: isolate;')
    .replace(video, video + '\n        mix-blend-mode: plus-lighter;');
}
