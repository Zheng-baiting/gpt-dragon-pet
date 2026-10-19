import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { readAllConfig } from '../src/upstream-config.mjs';
import { root, animationNames } from '../src/paths.mjs';
import { prepareEngine, electronPath } from '../src/engine.mjs';
import { mediaStatus } from './media.mjs';

const actions = await mediaStatus();
const previewIdle = actions.find(action => action.name === '待机呼吸休闲' && action.available)?.name || 'Q版-眨眼呼吸';
for (const preview of [true, false]) {
  const { engine, base } = await prepareEngine(preview);
  const merged = readAllConfig({
    defaultFile: join(engine, 'assets/config.jsonc'),
    userFile: join(base, 'data/dsh-pet/main-config.jsonc'),
    petDir: join(base, 'data/dsh-pet/pet'),
  });
  assert.equal(merged.main.pets[0].id, 'gpt');
  assert.equal(merged.main.pets[0].display, 'desktop');
  assert.equal(merged.main.pets[0].balanceEnabled, false);
  assert.equal(merged.main.pets[0].whisperEnabled, false);
  assert.equal(merged.main.notificationsEnabled, false);
  assert.deepEqual(animationNames(merged.main), preview ? ['Q版-点击招手', previewIdle].sort() : actions.map((a) => a.name).sort());
  if (preview) await access(join(base, 'data/dsh-pet/main-animation/webm', previewIdle + '.webm'));
  const source = await readFile(join(engine, 'runtime/electron-helper/main.js'), 'utf8');
  assert(source.includes('skipTaskbar: true'));
  assert(source.includes("app.setPath('userData', path.join(gptProfile, 'profile'))"));
}
await access(join(root, 'assets/gpt-reference.png'));
let electronReady = true;
try { await access(electronPath); } catch { electronReady = false; }
console.log(JSON.stringify({ configuration: 'ok', engine: 'dsh-pet@0.3.7',
  taskbarIcon: false, automaticModelCalls: false, electronReady,
  videos: `${actions.filter((a) => a.available).length}/${actions.length}`,
  productionReady: actions.every((a) => a.available), basicAnimations: 2, previewIdle, previewIsStatic: false }, null, 2));
