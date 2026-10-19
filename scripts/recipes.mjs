import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root } from '../src/paths.mjs';

export const upstreamRef = 'cc623c7e78aaab7e708f5aede783c3de01b11964';

function dragon(text) {
  return text.replaceAll('鲸鱼尾巴', '白龙尾巴').replaceAll('鲸鱼尾', '白龙尾')
    .replaceAll('鲸尾', '龙尾').replaceAll('蓝鲸', '白龙').replaceAll('鲸鱼', '白龙')
    .replaceAll('蓝发', '白发').replaceAll('蓝毛', '白毛')
    .replaceAll('蓝色长发', '白色长发').replaceAll('女仆', '白龙娘')
    .replaceAll('围裙', '裙边').replaceAll('鱼鳍', '小翼').replaceAll('鳍饰', '翼饰')
    .replaceAll('参考图最左侧', '参考图中的');
}

export async function recipes() {
  const source = await readFile(join(root, 'vendor/dsh-pet/action-prompts.md'), 'utf8');
  const matches = [...source.matchAll(/^## (.+)\r?$/gm)];
  const sections = new Map();
  for (let i = 0; i < matches.length; i++) {
    const heading = matches[i][1].trim();
    if (sections.has(heading)) throw Error(`原项目动作配方重复：${heading}`);
    sections.set(heading, source.slice(matches[i].index + matches[i][0].length,
      matches[i + 1]?.index ?? source.length).trim().replace(/\n---\s*$/, '').trim());
  }
  const common = sections.get('通用前缀');
  if (!common) throw Error('原项目通用前缀缺失。');
  const character = await readFile(join(root, 'prompts/character.md'), 'utf8');
  const actions = JSON.parse(await readFile(join(root, 'assets/actions.json'), 'utf8'));
  return actions.map(action => {
    const body = sections.get(action.sourceName);
    if (!body) throw Error(`原项目动作配方缺失：${action.sourceName}`);
    return { name: action.name, sourceName: action.sourceName, duration: 10,
      sourceVideoFPS: 24, outputFPS: 120,
      prompt: `${character.trim()}\n\n${dragon(common)}\n\n## ${action.name}\n\n${dragon(body)}\n` };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, name] = process.argv.slice(2);
    const all = await recipes();
    if (command === 'export') {
      const folder = join(root, 'work/recipes');
      await mkdir(folder, { recursive: true });
      for (const recipe of all) await writeFile(join(folder, recipe.name + '.md'), recipe.prompt);
      console.log(`已导出 ${all.length} 个原项目配方（GPT 白龙娘角色）到 work/recipes/。尚未生成视频。`);
    } else if (command === 'show' && name) {
      const recipe = all.find(item => item.name === name);
      if (!recipe) throw Error('未知动作名，请执行 npm run media:list。');
      process.stdout.write(recipe.prompt);
    } else throw Error('用法：recipes.mjs show <动作名> | export');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
