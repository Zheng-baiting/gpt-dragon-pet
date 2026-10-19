import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const upstream = join(root, 'node_modules', 'dsh-pet');
export const runtime = join(root, '.runtime');
export const prefix = '/dsh-pet-7340';
export const profile = (preview) => join(runtime, preview ? 'preview' : 'pet');
export const json = (value) => JSON.stringify(value, null, 2) + '\n';

export function animationNames(config) {
  const a = config.animations;
  return [...new Set([
    ...a.idle, ...a.turn, ...a.drag, ...a.clicks,
    ...a.moves.actions.map((action) => action.name),
    ...a.categories.flatMap((category) => category.actions),
    ...Object.values(a.events).flat(2),
  ])].sort();
}
