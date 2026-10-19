import fs from 'node:fs';
import path from 'node:path';
const clips=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'../assets/animation/manifest.json'),'utf8')).clips;
export const ACTIONS=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'../assets/actions.json'),'utf8')).map(action=>{
  const clip=clips[action.sheet+':'+action.row];
  const oneShot=clip.settle&&!['dance','sway','float','pace','crabwalk'].includes(action.motion);
  const duration=oneShot?clip.entry+clip.times.slice(0,-1).reduce((a,b)=>a+b,0)+clip.exit+.1:action.motion==='idle'?clip.entry+clip.times.reduce((a,b)=>a+b,0):action.duration;
  return {...action,duration};
});
export const GROUPS=[...new Set(ACTIONS.map(a=>a.category))];
export const findAction=(category,index=0)=>ACTIONS.filter(a=>a.category===category)[index];
export function pickAction(pool,previous,random=Math.random){const candidates=pool.filter(a=>a.id!==previous);const choices=candidates.length?candidates:pool;return choices[Math.floor(random()*choices.length)];}
export function pickIdle(preferences,previous,random=Math.random){
  if(preferences.reducedMotion||!preferences.idleActions)return findAction('待机');
  const groups=GROUPS.map(category=>ACTIONS.filter(a=>a.category===category)).filter(pool=>pool[0].weight>0&&(preferences.roam||pool[0].category!=='移动'));
  let roll=random()*groups.reduce((sum,pool)=>sum+pool[0].weight,0);
  const pool=groups.find(pool=>(roll-=pool[0].weight)<0)??groups[0];
  return pickAction(pool,previous,random);
}
