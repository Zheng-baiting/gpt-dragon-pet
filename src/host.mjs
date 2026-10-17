import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import {performance} from 'node:perf_hooks';
import {cleanPreferences,clampPosition,LABELS,STATES,spritePose} from './core.mjs';
import {SessionMonitor} from './session.mjs';
import {springStep,estimateReleaseVelocity,trimTrail,throwStep} from '../.generated/physics.js';
const root=path.resolve(import.meta.dirname,'..'),data=process.env.GPT_DRAGON_DATA||path.join(root,'.state');fs.mkdirSync(data,{recursive:true});
let preferences;try{preferences=cleanPreferences(JSON.parse(fs.readFileSync(path.join(data,'preferences.json'),'utf8')));}catch{preferences=cleanPreferences();}
let state='idle',stateAt=Date.now(),message='你好，我是龙娘。今天也一起加油。',messageUntil=Date.now()+7000,connection={connected:false};
let geometry=null,position=null,cursor=null,drag=null,flight=null,roam=null,facing='right',manualUntil=0,lastSignal=null,nextRoam=Date.now()+12000;
const send=value=>{if(!process.stdout.destroyed)process.stdout.write(JSON.stringify(value)+'\n');};
function snapshot(){return {type:'view',state,stateAt,preferences,connection,message,messageUntil,facing};}
function save(){fs.writeFileSync(path.join(data,'preferences.tmp'),JSON.stringify(preferences,null,2));fs.renameSync(path.join(data,'preferences.tmp'),path.join(data,'preferences.json'));}
function setState(next,text){if(!STATES.includes(next))return;if(state!==next){state=next;stateAt=Date.now();}if(text){message=text;messageUntil=Date.now()+6500;}send(snapshot());}
function areaAt(point){const areas=geometry.areas;return areas.find(a=>point.x>=a.x&&point.x<a.x+a.width&&point.y>=a.y&&point.y<a.y+a.height)??areas.reduce((best,a)=>{const distance=r=>Math.hypot(point.x-Math.max(r.x,Math.min(r.x+r.width,point.x)),point.y-Math.max(r.y,Math.min(r.y+r.height,point.y)));return distance(a)<distance(best)?a:best;},areas[0]);}
function reset(){if(!geometry)return;const a=geometry.areas[0];position={x:a.x+40,y:a.y+a.height-geometry.height};flight=null;roam=null;preferences.x=position.x;preferences.y=position.y;save();}
function action(name){
  if(name==='reset'){reset();return;}
  if(name==='auto'){manualUntil=0;setState(lastSignal?.state??'idle','好，继续陪你。');return;}
  if(name==='pet'){manualUntil=Date.now()+5000;const lines=['我在，慢慢来就好。','今天也陪你把事情做好。','这个摸摸，我记住了。','高性能，也需要休息一下。','代码交给你，陪伴交给我。'];setState('done',lines[Math.floor(Math.random()*lines.length)]);return;}
  if(STATES.includes(name)){manualUntil=name==='sleep'?Infinity:Date.now()+8000;flight=null;roam=null;setState(name,LABELS[name]);}
}
const monitor=new SessionMonitor(signal=>{lastSignal=signal;if(Date.now()>=manualUntil&&!drag&&!flight)setState(signal.state,LABELS[signal.state]);},value=>{connection=value;send(snapshot());});
async function receive(command){
  if(command.type==='geometry'){
    if(!Array.isArray(command.areas)||!command.areas.length||!command.areas.every(a=>['x','y','width','height'].every(k=>Number.isFinite(a[k]))&&a.width>0&&a.height>0))return;
    if(!Number.isFinite(command.width)||!Number.isFinite(command.height)||command.width<100||command.height<100)return;
    geometry=command;
    if(!position){position=preferences.x!==null&&preferences.y!==null?{x:preferences.x,y:preferences.y}:{x:command.areas[0].x+40,y:command.areas[0].y+command.areas[0].height-command.height};}
    position=clampPosition(position,areaAt(position),geometry);return;
  }
  if(command.type==='cursor'&&Number.isFinite(command.x)&&Number.isFinite(command.y)){cursor={x:command.x,y:command.y};return;}
  if(command.type==='drag-start'&&position&&cursor){flight=null;roam=null;drag={x:position.x,y:position.y,vx:0,vy:0,dx:cursor.x-position.x,dy:cursor.y-position.y,trail:[{...cursor,t:performance.now()}]};manualUntil=Date.now()+5000;setState('waiting','轻一点，我的角还在呢。');return;}
  if(['drag-end','drag-cancel'].includes(command.type)&&drag){
    const velocity=command.type==='drag-cancel'||preferences.reducedMotion?null:estimateReleaseVelocity(drag.trail,performance.now());
    if(velocity){flight={...position,...velocity};setState('error','诶——慢一点！');}else setState('idle');
    drag=null;preferences.x=position.x;preferences.y=position.y;save();return;
  }
  if(command.type==='preferences'){
    const safe={};for(const key of ['size','alwaysOnTop','roam','reducedMotion','bubbles'])if(Object.hasOwn(command.patch??{},key))safe[key]=command.patch[key];
    preferences=cleanPreferences({...preferences,...safe});if(!preferences.roam||preferences.reducedMotion){roam=null;if(state==='walk')setState('idle');}save();send(snapshot());return;
  }
  if(command.type==='action'){action(command.name);return;}
  if(command.type==='session'){
    try{await monitor.connect(command.file,process.env.CODEX_HOME||path.join(os.homedir(),'.codex'));preferences.sessionFile=command.file;save();}
    catch{connection={connected:false,error:'请选择 Codex 会话目录中的 JSONL 文件。'};send(snapshot());}return;
  }
  if(command.type==='quit'){shutdown();return;}
}
function motion(dt,now){
  if(!geometry||!position)return;
  if(drag&&cursor){
    drag.trail=trimTrail([...drag.trail,{...cursor,t:now}],now);drag.vx=springStep(drag.vx,drag.x,cursor.x-drag.dx,dt);drag.vy=springStep(drag.vy,drag.y,cursor.y-drag.dy,dt);drag.x+=drag.vx*dt;drag.y+=drag.vy*dt;
    position=clampPosition(drag,areaAt(cursor),geometry);return;
  }
  if(flight){
    const a=areaAt({x:position.x+geometry.width/2,y:position.y+geometry.height/2});
    flight=throwStep(flight,dt,{minX:a.x,maxX:a.x+a.width-geometry.width,minY:a.y,maxY:a.y+a.height-geometry.height});position={x:flight.x,y:flight.y};facing=flight.vx<0?'left':'right';
    if(flight.atRest){flight=null;preferences.x=position.x;preferences.y=position.y;save();setState('idle','着陆成功。');}return;
  }
  if(state==='sleep')return;
  if(manualUntil&&Date.now()>manualUntil){manualUntil=0;setState(lastSignal&&Date.now()-lastSignal.at<15*60000?lastSignal.state:'idle');}
  if(Date.now()>manualUntil&&['done','error'].includes(state)&&Date.now()-stateAt>8000)setState('idle');
  if(!preferences.roam||preferences.reducedMotion||connection.connected&&['thinking','working','waiting'].includes(state))return;
  if(!roam&&state==='idle'&&Date.now()>nextRoam){roam={until:Date.now()+2000+Math.random()*2500,direction:Math.random()<.5?-1:1};setState('walk');}
  if(roam){const a=areaAt(position);position.x+=roam.direction*27*dt;if(position.x<a.x||position.x+geometry.width>a.x+a.width)roam.direction*=-1;position=clampPosition(position,a,geometry);facing=roam.direction<0?'left':'right';if(Date.now()>roam.until){roam=null;nextRoam=Date.now()+16000+Math.random()*14000;preferences.x=position.x;preferences.y=position.y;save();setState('idle');}}
}
let last=performance.now(),lastView=0,closing=false;
const timer=setInterval(()=>{const now=performance.now(),dt=Math.min(.035,(now-last)/1000);last=now;motion(dt,now);send({type:'frame',state,facing,pose:spritePose(state,Date.now()-stateAt,preferences.reducedMotion),position});if(now-lastView>1000){send(snapshot());lastView=now;}},1000/30);
const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});let commands=Promise.resolve();
input.on('line',line=>{if(line.length>8192)return;try{const value=JSON.parse(line);commands=commands.then(()=>receive(value)).catch(()=>{});}catch{}});
function shutdown(){if(closing)return;closing=true;clearInterval(timer);monitor.stop();if(position){preferences.x=position.x;preferences.y=position.y;}save();input.close();process.exit(0);}
input.on('close',shutdown);process.on('SIGTERM',shutdown);send(snapshot());
if(preferences.sessionFile&&!process.env.GPT_DRAGON_SMOKE)receive({type:'session',file:preferences.sessionFile});
