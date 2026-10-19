import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {takeDesktopCommands,hasPluginClients,followPaused} from '../src/plugin-client.mjs';

test('plugin negotiates MCP, retains its own lease and removes it when unloaded',async()=>{
  const data=fs.mkdtempSync(path.join(process.cwd(),'work/plugin-test-'));
  fs.writeFileSync(path.join(data,'follow.json'),JSON.stringify({enabled:true,paused:true}));
  const child=spawn(process.execPath,['src/plugin.mjs'],{env:{...process.env,GPT_DRAGON_DATA:data,GPT_DRAGON_PLUGIN_TEST:'1'},windowsHide:true});
  const responses=new Map();
  const lines=readline.createInterface({input:child.stdout});lines.on('line',line=>{const message=JSON.parse(line);responses.set(message.id,message);});
  let id=0;
  async function call(method,params){const request=++id;child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:request,method,params})+'\n');for(let i=0;i<100;i++){if(responses.has(request))return responses.get(request);await delay(10);}throw Error('Plugin response timeout');}
  try{
    const initialized=await call('initialize',{protocolVersion:'2024-11-05'});assert.equal(initialized.result.serverInfo.name,'gpt-dragon-pet');
    assert.equal(followPaused(data),true,'automatic initialization must respect an explicit exit');
    assert.equal(hasPluginClients(data),true);
    const list=await call('tools/list');assert.equal(list.result.tools.length,3);
    const status=await call('tools/call',{name:'get_dragon_pet_status',arguments:{}});assert.deepEqual(JSON.parse(status.result.content[0].text),{running:false});
    const shown=await call('tools/call',{name:'show_dragon_pet',arguments:{settings:true}});assert.equal(shown.error,undefined);assert.deepEqual(takeDesktopCommands(data),[{type:'command',name:'settings'}]);
    assert.equal(followPaused(data),false,'explicit show resumes the follower');
    await call('tools/call',{name:'hide_dragon_pet',arguments:{}});assert.equal(followPaused(data),true);
    const rejected=await call('tools/call',{name:'show_dragon_pet',arguments:{sessionFile:'unselected.jsonl'}});assert.ok(rejected.error);
    child.stdin.end();await new Promise(resolve=>child.once('exit',resolve));assert.equal(child.exitCode,0);assert.equal(hasPluginClients(data),false);
  }finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}lines.close();fs.rmSync(data,{recursive:true,force:true});}
});

test('desktop command inbox rejects stale or unauthorized session and preference writes',()=>{
  const data=fs.mkdtempSync(path.join(process.cwd(),'work/plugin-inbox-')),folder=path.join(data,'plugin-commands');fs.mkdirSync(folder);
  const write=value=>fs.writeFileSync(path.join(folder,randomUUID()+'.json'),JSON.stringify(value));
  try{
    write({name:'close',expiresAt:Date.now()+8000});write({name:'settings',expiresAt:Date.now()-1});
    write({name:'session',file:'unselected.jsonl',expiresAt:Date.now()+8000});write({name:'preferences',patch:{sessionFile:'unselected.jsonl'},expiresAt:Date.now()+8000});
    assert.deepEqual(takeDesktopCommands(data),[{type:'command',name:'close'}]);assert.equal(fs.readdirSync(folder).length,0);
  }finally{fs.rmSync(data,{recursive:true,force:true});}
});
