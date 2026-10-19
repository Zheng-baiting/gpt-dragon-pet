import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { root } from './paths.mjs';
import { status, stop } from './control.mjs';
import { mediaStatus } from '../scripts/media.mjs';
import { recipes } from '../scripts/recipes.mjs';

const tools = [
  { name: 'get_gpt_pet_status', description: '查看 GPT 娘原版底座的运行状态和已导入视频数量；不读取聊天、账户或额度。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true } },
  { name: 'show_gpt_pet', description: '显示小只 Q 版 GPT 白龙娘，预览优先使用已导入的正式待机，点击时招手。preview=false 请求完整动作模式；缺视频时明确失败。',
    inputSchema: { type: 'object', properties: { preview: { type: 'boolean', default: true } }, additionalProperties: false } },
  { name: 'hide_gpt_pet', description: '关闭本项目的 GPT 娘窗口，保留文件和设置。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
];

async function call(name, args) {
  if (name === 'get_gpt_pet_status') {
    const actions = await mediaStatus();
    return { preview: await status(true), pet: await status(false),
      videos: `${actions.filter((a) => a.available).length}/${actions.length}`, basicAnimations: 2, basicVideoFPS: 120,
      originalActionRecipes: (await recipes()).length, previewIsStatic: false };
  }
  if (name === 'hide_gpt_pet') { await stop(); return { ok: true }; }
  if (name !== 'show_gpt_pet') throw Error('未知工具。');
  if (args.preview !== undefined && typeof args.preview !== 'boolean') throw Error('preview 必须是布尔值。');
  const preview = args.preview !== false;
  const existing = await status(preview);
  if (existing) return { ok: true, preview, port: existing.port };
  if (!preview) {
    const actions = await mediaStatus();
    if (actions.some((a) => !a.available)) throw Error('完整动作视频尚未齐全；preview=true 可以显示已有基础动画的 Q 版 GPT 娘。');
  }
  const child = spawn(process.execPath, [join(root, 'src/run.mjs'), ...(preview ? ['--preview'] : ['--full'])], {
    cwd: root, detached: true, windowsHide: true, stdio: 'ignore',
  });
  let failed;
  child.once('error', (error) => { failed = error; });
  child.unref();
  for (let i = 0; i < 60; i++) {
    if (failed) throw failed;
    const current = await status(preview);
    if (current) return { ok: true, preview, port: current.port, message: preview ? 'Q 版预览：已导入的正式待机优先使用，点击时招手；完整动作库尚未齐全。' : '完整动作模式。' };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error('桌宠尚未就绪。请执行 npm run runtime:install，并检查 .runtime 中的 engine.log。');
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  let request;
  try {
    request = JSON.parse(line);
    if (request.id === undefined) continue;
    let result;
    if (request.method === 'initialize') result = {
      protocolVersion: request.params?.protocolVersion || '2025-03-26',
      capabilities: { tools: {} }, serverInfo: { name: 'gpt-dragon-pet', version: '2.3.0' },
    };
    else if (request.method === 'ping') result = {};
    else if (request.method === 'tools/list') result = { tools };
    else if (request.method === 'tools/call') {
      try { result = { content: [{ type: 'text', text: JSON.stringify(await call(request.params?.name, request.params?.arguments || {})) }] }; }
      catch (error) { result = { isError: true, content: [{ type: 'text', text: error.message }] }; }
    } else {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } }) + '\n');
      continue;
    }
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
  } catch {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
  }
}
