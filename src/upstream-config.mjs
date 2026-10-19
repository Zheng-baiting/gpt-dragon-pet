import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { upstream, runtime } from './paths.mjs';

// Node's native TypeScript support excludes node_modules. Keep an unchanged,
// project-local copy of this self-contained upstream validator instead.
await mkdir(runtime, { recursive: true });
const file = join(runtime, 'upstream-config.ts');
await copyFile(join(upstream, 'src/host/config.ts'), file);
export const { readAllConfig } = await import(pathToFileURL(file).href);
