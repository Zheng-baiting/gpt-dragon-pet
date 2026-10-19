import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIONS,GROUPS,pickAction,pickIdle,findAction} from '../src/actions.mjs';
import {DEFAULTS} from '../src/core.mjs';

test('catalog covers the pinned whale action list with distinct playable descriptors',()=>{
 assert.equal(ACTIONS.length,106);assert.equal(GROUPS.length,13);assert.equal(new Set(ACTIONS.map(a=>a.upstream)).size,106);
 for(const a of ACTIONS){assert.ok(['core','emotion','life','move'].includes(a.sheet));assert.ok(Number.isInteger(a.row)&&a.row>=0&&a.row<4);assert.ok(a.motion);assert.ok(a.duration>0);}
 assert.equal(new Set(ACTIONS.filter(a=>a.category==='点击回应').map(a=>a.motion)).size,5);
});
test('idle sampling respects movement and reduced-motion preferences without repeat clicks',()=>{
 const clicks=ACTIONS.filter(a=>a.category==='点击回应');assert.notEqual(pickAction(clicks,clicks[0].id,()=>0).id,clicks[0].id);
 for(let i=0;i<100;i++){const a=pickIdle({...DEFAULTS,roam:false},'',()=>i/100);assert.notEqual(a.category,'移动');}
 assert.equal(pickIdle({...DEFAULTS,reducedMotion:true},'').id,findAction('待机').id);
 assert.equal(pickIdle({...DEFAULTS,idleActions:false},'').id,findAction('待机').id);
});
