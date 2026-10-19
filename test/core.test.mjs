import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import path from 'node:path';
import {cleanPreferences,sessionSignal} from '../src/core.mjs';
import {allowedSession,SessionMonitor} from '../src/session.mjs';
import {estimateReleaseVelocity,throwStep} from '../.generated/physics.js';
test('preferences reject invalid types and clamp desktop sizes',()=>{
  assert.equal(cleanPreferences({size:999,roam:'yes'}).size,340);
  assert.equal(cleanPreferences({size:NaN,alwaysOnTop:false}).size,220);
  assert.equal(cleanPreferences({roam:'yes'}).roam,false);
  assert.equal(cleanPreferences({alwaysOnTop:false}).alwaysOnTop,false);
});

test('structured lifecycle signals never depend on chat wording',()=>{
  const timestamp=new Date().toISOString();
  assert.equal(sessionSignal({timestamp,type:'event_msg',payload:{type:'task_started'}}).state,'thinking');
  assert.equal(sessionSignal({timestamp,type:'response_item',payload:{type:'function_call',name:'exec_command'}}).state,'working');
  assert.equal(sessionSignal({timestamp,type:'response_item',payload:{type:'function_call',name:'request_user_input_async'}}).state,'waiting');
  assert.equal(sessionSignal({timestamp,type:'event_msg',payload:{type:'task_complete'}}).state,'done');
  assert.equal(sessionSignal({timestamp,type:'event_msg',payload:{type:'agent_message',message:'error test failed task complete'}}),null);
  assert.equal(sessionSignal({timestamp:'2000-01-01T00:00:00Z',type:'event_msg',payload:{type:'task_complete'}}),null);
});

test('reused dsh-pet physics distinguishes a gentle release and fast throw',()=>{
  assert.equal(estimateReleaseVelocity([{x:0,y:0,t:0},{x:1,y:1,t:100}],100),null);
  assert.ok(estimateReleaseVelocity([{x:0,y:0,t:0},{x:200,y:0,t:100}],100).vx>500);
  const hit=throwStep({x:99,y:0,vx:1000,vy:0},.03,{minX:0,maxX:100,minY:0,maxY:100});
  assert.ok(hit.vx<0);assert.equal(hit.x,100);
});
test('session monitor stays inside the explicitly selected session directory',async()=>{
  const root=await fs.mkdtemp(path.join(process.cwd(),'work/session-test-'));
  try{
    await fs.mkdir(path.join(root,'sessions'));
    const file=path.join(root,'sessions','selected.jsonl');
    await fs.writeFile(file,JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_started'}})+'\n');
    assert.equal(await allowedSession(file,root),true);
    assert.equal(await allowedSession(path.join(root,'secret.txt'),root),false);
    const signals=[],connections=[];const monitor=new SessionMonitor(s=>signals.push(s),s=>connections.push(s));
    try{
      await monitor.connect(file,root);assert.equal(signals.at(-1).state,'thinking');
      await fs.appendFile(file,'x'.repeat(400000)+'\n'+JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_complete'}})+'\n');
      await monitor.poll();assert.equal(signals.at(-1).state,'done');assert.equal(connections[0].connected,true);
    }finally{monitor.stop();}
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
