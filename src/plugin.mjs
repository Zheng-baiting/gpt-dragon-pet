import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {root,data,clientDirectory,desktopStatus,requestDesktop,followEnabled,followPaused,setFollowPaused} from './plugin-client.mjs';

const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const lease=path.join(clientDirectory,process.pid+'-'+randomUUID()+'.json');
let heartbeat,starting;
function retain(){
  if(heartbeat)return;
  fs.mkdirSync(clientDirectory,{recursive:true});
  const touch=()=>fs.writeFileSync(lease,JSON.stringify({pid:process.pid,updatedAt:Date.now()}));
  touch();heartbeat=setInterval(touch,2000);
}
function release(){clearInterval(heartbeat);heartbeat=null;try{fs.unlinkSync(lease);}catch{}}
function show(automatic=false){
  retain();
  if(automatic&&followEnabled()&&followPaused())return Promise.resolve({running:false,paused:true});
  if(!automatic)setFollowPaused(false);
  if(process.env.GPT_DRAGON_PLUGIN_TEST==='1')return Promise.resolve({running:false,testMode:true});
  if(desktopStatus().running)return Promise.resolve(desktopStatus());
  if(starting)return starting;
  starting=(async()=>{
    if(process.platform!=='win32')throw Error('Windows 10/11 is required.');
    const temporary=path.join(root,'work/temp');fs.mkdirSync(temporary,{recursive:true});
    // Windows PowerShell needs its own console lifetime; keep the detached launcher.
    const args=[path.join(root,'scripts/launch.cjs')];
    if(followEnabled())args.push('--follow');
    const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,TEMP:temporary,TMP:temporary,GPT_DRAGON_DATA:data,GPT_DRAGON_PLUGIN:'1'},detached:true,stdio:'ignore',windowsHide:true});
    let error;child.on('error',value=>{error=value;});child.unref();
    for(let i=0;i<120;i++){if(error)throw error;await delay(100);const status=desktopStatus();if(status.running)return status;}
    throw Error('桌宠未能启动，请运行 npm run smoke 检查本机环境。');
  })().finally(()=>{starting=null;});
  return starting;
}
const tools=[
  {name:'show_dragon_pet',description:'显示白龙娘桌宠。直接显示透明角色，不打开网页或设置页。可在用户要求时打开设置。',inputSchema:{type:'object',properties:{settings:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
  {name:'get_dragon_pet_status',description:'只读查看白龙娘桌宠是否运行及当前动作，不读取聊天正文。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
  {name:'hide_dragon_pet',description:'关闭白龙娘桌宠窗口，保留设置和插件。用户下次要求显示时可以恢复。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];
async function handle(message){
  if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')return;
  if(message.id===undefined)return;
  try{
    let result;
    switch(message.method){
      case 'initialize':
        retain();void show(true).catch(error=>process.stderr.write(error.message+'\n'));
        result={protocolVersion:message.params?.protocolVersion??'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'gpt-dragon-pet',version}};break;
      case 'ping':result={};break;
      case 'tools/list':result={tools};break;
      case 'tools/call':{
        const name=message.params?.name,args=message.params?.arguments??{};
        if(!tools.some(tool=>tool.name===name))throw Error('Unknown tool');
        if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>name!=='show_dragon_pet'||key!=='settings')||('settings' in args&&typeof args.settings!=='boolean'))throw Error('Invalid arguments');
        let status=desktopStatus();
        if(name==='show_dragon_pet'){status=await show();if(args.settings)requestDesktop({name:'settings'});}
        if(name==='hide_dragon_pet'){setFollowPaused(true);if(status.running){requestDesktop({name:'close'});status={...status,closing:true};}}
        result={content:[{type:'text',text:JSON.stringify(status)}]};break;
      }
      default:send({jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Method not found'}});return;
    }
    send({jsonrpc:'2.0',id:message.id,result});
  }catch(error){send({jsonrpc:'2.0',id:message.id,error:{code:-32603,message:error.message}});}
}
const input=readline.createInterface({input:process.stdin});
input.on('line',line=>{
  if(line.length>8192)return;
  try{void handle(JSON.parse(line));}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});}
});
input.on('close',()=>{release();process.exit(0);});
process.on('exit',release);process.on('SIGTERM',()=>{release();process.exit(0);});
