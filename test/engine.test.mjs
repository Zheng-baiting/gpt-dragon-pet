import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { root, upstream, animationNames } from '../src/paths.mjs';
import { runVideo, assertAlpha } from '../scripts/media.mjs';

test('all original menu actions are mapped once; preview is explicitly static', async () => {
  const config = JSON.parse(await readFile(join(root, 'config/gpt.json'), 'utf8'));
  const actions = JSON.parse(await readFile(join(root, 'assets/actions.json'), 'utf8'));
  assert.equal(actions.length, 106);
  assert.deepEqual(animationNames(config), actions.map((a) => a.name).sort());
  const preview = JSON.parse(await readFile(join(root, 'config/preview.json'), 'utf8'));
  assert.match(preview.pets[0].name, /静态定稿预览/);
  assert.deepEqual(animationNames(preview), ['角色定稿（静态预览）']);
  const context = { window: {} };
  vm.runInNewContext(await readFile(join(upstream, 'runtime/electron-helper/shared-core.js'), 'utf8'), context);
  const tree = context.PetShared.buildMenuTree(config.animations);
  assert.equal(tree[0].label, '动作');
  assert(tree[0].children.some((group) => group.label === '点击回应' && group.children.length === 5));
  assert(tree[0].children.some((group) => group.label === '时节'));
});

test('transparent VP9 decodes correctly and opaque video is rejected', async () => {
  const folder = join(root, 'work/test-media');
  await mkdir(folder, { recursive: true });
  const opaque = join(folder, 'opaque.webm');
  runVideo(['-y', '-f', 'lavfi', '-i', 'color=white:size=64x36:rate=1', '-t', '1',
    '-c:v', 'libvpx-vp9', '-threads', '1', opaque]);
  assert.throws(() => assertAlpha(opaque));
  assertAlpha(join(root, '.runtime/reference-preview.webm'));
});

test('MCP initialization does not start a pet; unfinished production returns an error', () => {
  const messages = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'show_gpt_pet', arguments: {} } },
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
