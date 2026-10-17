import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

test('native IPC follows selected events, isolates preferences and keeps thrown positions on screen',async()=>{
  const root=await fs.mkdtemp(path.join(process.cwd(),'work/host-test-'));
  await fs.mkdir(path.join(root,'sessions'));const selected=path.join(root,'sessions','selected.jsonl');
  await fs.writeFile(selected,JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_started'}})+'\n');
  const child=spawn(process.execPath,['src/host.mjs'],{cwd:process.cwd(),env:{...process.env,GPT_DRAGON_DATA:root,GPT_DRAGON_SMOKE:'1',CODEX_HOME:root},windowsHide:true});
  const messages=[];let errors='';child.stderr.on('data',s=>errors+=s);const lines=readline.createInterface({input:child.stdout});lines.on('line',s=>messages.push(JSON.parse(s)));
  const send=value=>child.stdin.write(JSON.stringify(value)+'\n');
  async function until(predicate){for(let i=0;i<200;i++){const value=messages.find(predicate);if(value)return value;if(child.exitCode!==null)throw Error(errors||'Host stopped early');await delay(20);}throw Error('IPC timeout: '+errors);}
  try{
    await until(m=>m.type==='view');
    send({type:'geometry',areas:[{x:-1000,y:0,width:1000,height:900}],width:300,height:401});
    const frame=await until(m=>m.type==='frame'&&m.position);assert.deepEqual(frame.position,{x:-960,y:499});
    send({type:'preferences',patch:{size:999,sessionFile:'not-permitted',alwaysOnTop:false}});
    const prefs=await until(m=>m.type==='view'&&m.preferences.size===340);assert.equal(prefs.preferences.sessionFile,null);assert.equal(prefs.preferences.alwaysOnTop,false);
    send({type:'session',file:selected});await until(m=>m.type==='view'&&m.connection.connected&&m.state==='thinking');
    send({type:'action',name:'sleep'});await until(m=>m.type==='view'&&m.state==='sleep');
    await fs.appendFile(selected,JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_complete'}})+'\n');
    await delay(1200);assert.equal(messages.filter(m=>m.type==='view').at(-1).state,'sleep');
    send({type:'action',name:'auto'});await until(m=>m.type==='view'&&m.state==='done');
    send({type:'session',file:null});await until(m=>m.type==='view'&&m.preferences.sessionFile===null&&m.state==='done');
    send({type:'cursor',x:-900,y:550});send({type:'drag-start'});
    for(let i=1;i<=5;i++){await delay(35);send({type:'cursor',x:-900+i*130,y:550-i*30});}
    await delay(40);send({type:'drag-end'});await until(m=>m.type==='view'&&m.state==='error');await delay(250);
    for(const m of messages.filter(m=>m.type==='frame'&&m.position)){assert.ok(Number.isFinite(m.position.x)&&Number.isFinite(m.position.y));assert.ok(m.position.x>=-1000&&m.position.x<=-300);assert.ok(m.position.y>=0&&m.position.y<=499);}
    send({type:'quit'});await new Promise(resolve=>child.once('exit',resolve));assert.equal(child.exitCode,0);
    const saved=JSON.parse(await fs.readFile(path.join(root,'preferences.json'),'utf8'));assert.equal(saved.sessionFile,null);assert.ok(saved.x>=-1000&&saved.x<=-300);
  }finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}lines.close();await fs.rm(root,{recursive:true,force:true});}
});
