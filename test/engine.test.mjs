import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { root, upstream, animationNames } from '../src/paths.mjs';
import { runVideo, assertAlpha } from '../scripts/media.mjs';

test('all original menu actions are mapped once; basic preview uses real clips', async () => {
  const config = JSON.parse(await readFile(join(root, 'config/gpt.json'), 'utf8'));
  const actions = JSON.parse(await readFile(join(root, 'assets/actions.json'), 'utf8'));
  assert.equal(actions.length, 106);
  assert.deepEqual(animationNames(config), actions.map((a) => a.name).sort());
  const preview = JSON.parse(await readFile(join(root, 'config/preview.json'), 'utf8'));
  assert.match(preview.pets[0].name, /Q版基础动画/);
  assert.equal(preview.pets[0].size, 462);
  assert.deepEqual(animationNames(preview), ['Q版-点击招手', 'Q版-眨眼呼吸']);
  const context = { window: {} };
  vm.runInNewContext(await readFile(join(upstream, 'runtime/electron-helper/shared-core.js'), 'utf8'), context);
  const tree = context.PetShared.buildMenuTree(config.animations);
  assert.equal(tree[0].label, '动作');
  assert(tree[0].children.some((group) => group.label === '点击回应' && group.children.length === 5));
  assert(tree[0].children.some((group) => group.label === '时节'));
});

test('transparent clips decode at 120 fps with changing in-between frames; opaque video is rejected', async () => {
  const folder = join(root, 'work/test-media');
  await mkdir(folder, { recursive: true });
  const opaque = join(folder, 'opaque.webm');
  runVideo(['-y', '-f', 'lavfi', '-i', 'color=white:size=64x36:rate=1', '-t', '1',
    '-c:v', 'libvpx-vp9', '-threads', '1', opaque]);
  assert.throws(() => assertAlpha(opaque));
  const manifest = JSON.parse(await readFile(join(root, 'assets/basic/manifest.json'), 'utf8'));
  for (const [name, frames] of [['Q版-眨眼呼吸', 540], ['Q版-点击招手', 288]]) {
    const file = join(root, 'assets/basic', name + '.webm');
    assertAlpha(file);
    const decoded = runVideo(['-c:v', 'libvpx-vp9', '-i', file, '-an', '-f', 'framemd5', '-']).stdout;
    assert.match(decoded, /#tb 0: 1\/120\s/);
    const rows = decoded.split('\n').filter((line) => line && !line.startsWith('#'));
    assert.equal(rows.length, frames);
    const hashes = rows.map(line => line.split(',').at(-1).trim());
    // Four copies of each 30 fps frame would have at most 25% unique frames.
    assert(new Set(hashes).size > frames / 2, 'Interpolation must produce changing intermediate frames.');
    const entry = manifest.find(item => item.name === name);
    assert.equal(entry.fps, 120);
    assert.equal(entry.frames, frames);
    assert.equal(entry.duration, frames / 120);
  }
});

test('MCP initialization does not start a pet; unfinished production returns an error', () => {
  const messages = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'show_gpt_pet', arguments: { preview: false } } },
  ];
  const result = spawnSync(process.execPath, [join(root, 'src/plugin.mjs')], {
    input: messages.map(JSON.stringify).join('\n') + '\n', encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const responses = result.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(responses[0].result.serverInfo.name, 'gpt-dragon-pet');
  assert.equal(responses[1].result.tools.length, 3);
  assert.equal(responses[2].result.isError, true);
  assert.match(responses[2].result.content[0].text, /尚未齐全/);
});
