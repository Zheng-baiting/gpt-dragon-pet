import { mkdir, readFile, writeFile, access, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readAllConfig } from '../src/upstream-config.mjs';
import { root, upstream, animationNames, json } from '../src/paths.mjs';

const original = readAllConfig({
  defaultFile: join(upstream, 'assets/config.jsonc'),
  userFile: join(root, 'work/unused-config'),
  petDir: join(root, 'work/unused-pets'),
}).main;
const rename = (value) => value
  .replaceAll('用鲸鱼尾巴', '用龙尾')
  .replaceAll('鲸鱼', '白龙').replaceAll('蓝鲸', '白龙')
  .replaceAll('女仆', '龙娘');
const config = JSON.parse(rename(JSON.stringify(original)));
config.whisperPrompt = '你是白发紫瞳的白龙娘 GPT，是一个非官方同人桌面角色。';
config.memes = {};
config.notificationsEnabled = false;
config.whisperImageEnabled = false;
config.chatImageEnabled = false;
config.font = { family: 'yahei', size: 21, followPet: true };
config.pets = [{
  id: 'gpt', name: 'GPT 白龙娘', size: 462, display: 'desktop',
  balanceEnabled: false, whisperEnabled: false, workStatusEnabled: false,
  fixedEnabled: false, position: { corner: 'bottom-right', marginX: 40, marginY: 28 },
}];
const preview = structuredClone(config);
const idle = 'Q版-眨眼呼吸';
const wave = 'Q版-点击招手';
preview.pets[0].name += ' · Q版基础动画';
preview.pets[0].fixedEnabled = true;
preview.animations = {
  idle: [idle], turn: [], drag: [], clicks: [wave],
  moves: { default: original.animations.moves.default, actions: [] },
  categories: [],
  events: { balance: [idle] },
};
preview.animationWeights = { idle: 100, turn: 0, move: 0 };
const sources = animationNames(original);
const actions = sources.map((sourceName) => ({
  name: rename(sourceName), sourceName,
  file: rename(sourceName) + '.webm', status: 'video-required',
}));
if (new Set(actions.map((a) => a.name)).size !== actions.length) throw Error('动作名称映射存在冲突。');
for (const folder of ['config', 'assets', 'assets/webm', 'docs', 'work', 'test']) {
  await mkdir(join(root, folder), { recursive: true });
}
for (const [file, value] of [
  ['config/gpt.json', config], ['config/preview.json', preview], ['assets/actions.json', actions],
]) {
  // Setup never overwrites the user's later configuration edits.
  try { await access(join(root, file)); }
  catch { await writeFile(join(root, file), json(value)); }
}
await copyFile(join(upstream, 'LICENSE'), join(root, 'docs/DSH-PET-LICENSE.txt'));
console.log(`已准备 dsh-pet@0.3.7 原版配置和 ${actions.length} 个 GPT 娘动作入口。`);
