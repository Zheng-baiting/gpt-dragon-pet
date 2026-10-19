import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export const root=path.resolve(import.meta.dirname,'..');
export const data=process.env.GPT_DRAGON_DATA||path.join(root,'.state');
export const clientDirectory=path.join(data,'plugin-clients');
const commandDirectory=path.join(data,'plugin-commands');

export function desktopStatus(){
  try{
    const value=JSON.parse(fs.readFileSync(path.join(data,'runtime.json'),'utf8'));
    if(!Number.isInteger(value.pid)||!Number.isInteger(value.hostPid)||Date.now()-Date.parse(value.updatedAt)>15000)return {running:false};
    process.kill(value.pid,0);process.kill(value.hostPid,0);
    return {running:true,version:value.version,mode:value.mode,state:value.state,animation:value.animation,connected:value.connected,fps:value.fps};
  }catch{return {running:false};}
}

export function requestDesktop(command){
  fs.mkdirSync(commandDirectory,{recursive:true});
  const name=path.join(commandDirectory,randomUUID()+'.json');
  fs.writeFileSync(name+'.tmp',JSON.stringify({...command,expiresAt:Date.now()+10000}));
  fs.renameSync(name+'.tmp',name);
}

export function takeDesktopCommands(directory=data){
  const folder=path.join(directory,'plugin-commands');
  if(!fs.existsSync(folder))return [];
  const values=[];
  for(const name of fs.readdirSync(folder).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).slice(0,20)){
    const file=path.join(folder,name);
    try{
      const stat=fs.lstatSync(file);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024)continue;
      const value=JSON.parse(fs.readFileSync(file,'utf8'));
      if(value.expiresAt>Date.now()&&value.expiresAt<Date.now()+11000&&['settings','close'].includes(value.name))values.push({type:'command',name:value.name});
    }catch{}finally{try{fs.unlinkSync(file);}catch{}}
  }
  return values;
}

export function hasPluginClients(directory=data){
  const folder=path.join(directory,'plugin-clients');
  if(!fs.existsSync(folder))return false;
  return fs.readdirSync(folder).filter(name=>/^\d+-[a-f0-9-]{36}\.json$/.test(name)).some(name=>{
    try{
      const value=JSON.parse(fs.readFileSync(path.join(folder,name),'utf8'));
      if(!Number.isInteger(value.pid)||!Number.isFinite(value.updatedAt)||value.updatedAt>Date.now()+1000||Date.now()-value.updatedAt>10000)return false;
      process.kill(value.pid,0);return true;
    }catch{return false;}
  });
}
