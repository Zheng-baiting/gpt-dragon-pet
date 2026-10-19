import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {ACTIONS} from '../src/actions.mjs';

test('host coordinates all actions without per-frame IPC, preserves sleep and selected-session boundaries',async()=>{
 const root=await fs.mkdtemp(path.join(process.cwd(),'work/host-test-'));
 await fs.mkdir(path.join(root,'sessions'));const selected=path.join(root,'sessions','selected.jsonl');
 await fs.writeFile(selected,JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_started'}})+'\n');
 const child=spawn(process.execPath,['src/host.mjs'],{cwd:process.cwd(),env:{...process.env,GPT_DRAGON_DATA:root,GPT_DRAGON_SMOKE:'1',CODEX_HOME:root},windowsHide:true});
 const messages=[];let errors='';child.stderr.on('data',s=>errors+=s);const lines=readline.createInterface({input:child.stdout});lines.on('line',s=>messages.push(JSON.parse(s)));
 const send=value=>child.stdin.write(JSON.stringify(value)+'\n');
 async function until(predicate,after=0){for(let i=0;i<200;i++){const value=messages.slice(after).find(predicate);if(value)return value;if(child.exitCode!==null)throw Error(errors||'Host stopped early');await delay(15);}throw Error('IPC timeout: '+errors);}
 async function command(value,predicate){const after=messages.length;send(value);return until(predicate,after);}
 try{
  await until(m=>m.type==='view');
  const prefs=await command({type:'preferences',patch:{size:999,sessionFile:'not-permitted',alwaysOnTop:false}},m=>m.type==='view'&&m.preferences.size===340);
  assert.equal(prefs.preferences.sessionFile,null);assert.equal(prefs.preferences.alwaysOnTop,false);
  await command({type:'session',file:selected},m=>m.type==='view'&&m.connection.connected&&m.state==='thinking');
  await command({type:'action',name:'sleep'},m=>m.type==='view'&&m.state==='sleep');
  await fs.appendFile(selected,JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_complete'}})+'\n');
  await delay(1200);assert.equal(messages.filter(m=>m.type==='view').at(-1).state,'sleep');
  await command({type:'action',name:'auto'},m=>m.type==='view'&&m.state==='done');
  await command({type:'session',file:null},m=>m.type==='view'&&m.preferences.sessionFile===null&&m.state==='idle');
  for(const action of ACTIONS){const view=await command({type:'action',name:action.id},m=>m.type==='view'&&m.animation.id===action.id);assert.ok(view.animation.sheet);}
  let previous='';for(let i=0;i<8;i++){const view=await command({type:'interaction',name:'click'},m=>m.type==='view'&&m.animation.category==='点击回应');assert.notEqual(view.animation.id,previous);previous=view.animation.id;}
  await command({type:'interaction',name:'drag-start'},m=>m.type==='view'&&m.animation.category==='拖拽');
  await command({type:'interaction',name:'land'},m=>m.type==='view'&&m.state==='idle');
  send({type:'position',x:-650,y:300});
  assert.equal(messages.some(m=>m.type==='frame'),false);
  send({type:'quit'});await new Promise(resolve=>child.once('exit',resolve));assert.equal(child.exitCode,0);
  const saved=JSON.parse(await fs.readFile(path.join(root,'preferences.json'),'utf8'));assert.equal(saved.sessionFile,null);assert.equal(saved.x,-650);assert.equal(saved.y,300);
 }finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}lines.close();await fs.rm(root,{recursive:true,force:true});}
});
