import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import {cleanPreferences,LABELS,STATES} from './core.mjs';
import {SessionMonitor} from './session.mjs';
import {ACTIONS,findAction,pickAction,pickIdle} from './actions.mjs';
import {takeDesktopCommands,hasPluginClients,setFollowPaused} from './plugin-client.mjs';
const root=path.resolve(import.meta.dirname,'..'),data=process.env.GPT_DRAGON_DATA||path.join(root,'.state');fs.mkdirSync(data,{recursive:true});
let preferences;try{preferences=cleanPreferences(JSON.parse(fs.readFileSync(path.join(data,'preferences.json'),'utf8')));}catch{preferences=cleanPreferences();}
let state='idle',stateAt=Date.now(),message='我来啦，今天想做点什么？',messageUntil=Date.now()+6000,connection={connected:false};
let animation=findAction('待机'),serial=1,animationUntil=Date.now()+6000,manualUntil=0,lastSignal=null,interacting=false,lastClick=null,closing=false;
const send=value=>{if(!process.stdout.destroyed)process.stdout.write(JSON.stringify(value)+'\n');};
function snapshot(){return {type:'view',state,stateAt,preferences,connection,message,messageUntil,animation,serial};}
function save(){fs.writeFileSync(path.join(data,'preferences.tmp'),JSON.stringify(preferences,null,2));fs.renameSync(path.join(data,'preferences.tmp'),path.join(data,'preferences.json'));}
function play(action,text){if(!action)return;animation=action;serial++;animationUntil=Date.now()+action.duration*1000;if(text){message=text;messageUntil=Date.now()+5000;}send(snapshot());}
function automatic(){manualUntil=0;const signal=lastSignal&&Date.now()-lastSignal.at<15*60000?lastSignal:null;setState(signal?.state??'idle',true);}
function setState(next,force=false){
  if(!STATES.includes(next)||!force&&state===next)return;state=next;stateAt=Date.now();
  const work={thinking:0,working:1,result:2,waiting:3,done:4,error:5};
  const action=next==='sleep'?ACTIONS.find(a=>a.motion==='sleep'):next==='walk'?findAction('移动'):Object.hasOwn(work,next)?findAction('工作状态',work[next]):findAction('待机');
  play(action,LABELS[next]);
}
function action(name){
  if(name==='reset'){send({type:'command',name:'reset'});return;}
  if(name==='auto'){interacting=false;automatic();return;}
  if(name==='pet'){const next=pickAction(ACTIONS.filter(a=>a.category==='点击回应'),lastClick);lastClick=next.id;manualUntil=Date.now()+next.duration*1000;play(next,['摸摸收到。','好啦，再摸一下。','今天也一起加油。'][Math.floor(Math.random()*3)]);return;}
  if(name==='random'){const next=pickIdle({...preferences,idleActions:true,reducedMotion:false},animation.id);manualUntil=Date.now()+next.duration*1000;play(next,next.label);return;}
  const chosen=ACTIONS.find(a=>a.id===name);
  if(chosen){manualUntil=Date.now()+chosen.duration*1000;play(chosen,chosen.category==='余额档位'?'动作预览 · '+chosen.label:chosen.label);return;}
  if(STATES.includes(name)){manualUntil=name==='sleep'?Infinity:Date.now()+8000;setState(name,true);}
}
const monitor=new SessionMonitor(signal=>{lastSignal=signal;if(Date.now()>=manualUntil&&!interacting)setState(signal.state);},value=>{connection=value;send(snapshot());});
async function receive(command){
  if(command.type==='position'&&Number.isFinite(command.x)&&Number.isFinite(command.y)){preferences.x=Math.round(command.x);preferences.y=Math.round(command.y);save();return;}
  if(command.type==='interaction'){
    if(command.name==='click'){interacting=false;action('pet');return;}
    if(command.name==='drag-start'){interacting=true;play(findAction('拖拽'),'轻一点，我的角还在呢。');return;}
    if(command.name==='land'||command.name==='release'){interacting=false;automatic();return;}
  }
  if(command.type==='preferences'){
    const safe={};for(const key of ['size','alwaysOnTop','roam','reducedMotion','bubbles','idleActions'])if(Object.hasOwn(command.patch??{},key))safe[key]=command.patch[key];
    preferences=cleanPreferences({...preferences,...safe});save();send(snapshot());return;
  }
  if(command.type==='action'){action(command.name);return;}
  if(command.type==='session'){
    try{lastSignal=null;await monitor.connect(command.file,process.env.CODEX_HOME||path.join(os.homedir(),'.codex'));preferences.sessionFile=command.file;save();if(!command.file&&!interacting&&Date.now()>=manualUntil)setState('idle',true);send(snapshot());}
    catch{connection={connected:false,error:'请选择 Codex 会话目录中的 JSONL 文件。'};send(snapshot());}return;
  }
  if(command.type==='quit'){if(command.pauseFollow)setFollowPaused(true,data);shutdown();}
}
let lastView=Date.now(),lastClients=Date.now(),following=process.env.GPT_DRAGON_FOLLOW==='1';
const timer=setInterval(()=>{
  for(const command of takeDesktopCommands(data)){if(command.name==='follow')following=true;send(command);}
  if(!following&&process.env.GPT_DRAGON_PLUGIN==='1'&&Date.now()-lastClients>2000){lastClients=Date.now();if(!hasPluginClients(data))send({type:'command',name:'close'});}
  if(!interacting&&manualUntil&&Date.now()>=manualUntil)automatic();
  if(!interacting&&Date.now()>=manualUntil){
    if(['done','error'].includes(state)&&Date.now()-stateAt>8000)setState('idle');
    if(state==='idle'&&Date.now()>animationUntil)play(pickIdle(preferences,animation.id));
  }
  if(Date.now()-lastView>2000){send(snapshot());lastView=Date.now();}
},150);
const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});let commands=Promise.resolve();
input.on('line',line=>{if(line.length>8192)return;try{const value=JSON.parse(line);commands=commands.then(()=>receive(value)).catch(()=>{});}catch{}});
function shutdown(){if(closing)return;closing=true;clearInterval(timer);monitor.stop();save();input.close();process.exit(0);}
input.on('close',shutdown);process.on('SIGTERM',shutdown);send(snapshot());
if(preferences.sessionFile&&!process.env.GPT_DRAGON_SMOKE)receive({type:'session',file:preferences.sessionFile});
