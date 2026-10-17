import fs from 'node:fs/promises';
import path from 'node:path';
import {sessionSignal} from './core.mjs';
export async function allowedSession(file,home){
  try{
    const actual=await fs.realpath(file);
    if(!actual.endsWith('.jsonl'))return false;
    for(const sub of ['sessions','archived_sessions']){
      let root;try{root=await fs.realpath(path.join(home,sub));}catch{continue;}
      const relative=path.relative(root,actual);
      if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))return true;
    }
  }catch{}
  return false;
}
export class SessionMonitor{
  constructor(onSignal,onConnection){this.onSignal=onSignal;this.onConnection=onConnection;this.file=null;this.offset=0;this.partial='';this.busy=null;this.timer=null;this.revision=0;this.connected=false;}
  async connect(file,home){
    this.stop();const revision=this.revision;
    if(!file){this.onConnection({connected:false});return;}
    const actual=await fs.realpath(file);
    if(!await allowedSession(actual,home))throw new Error('请选择 Codex sessions 目录中的会话 JSONL 文件。');
    const stat=await fs.stat(actual);if(revision!==this.revision)return;
    this.file=actual;this.offset=Math.max(0,stat.size-131072);this.discard=this.offset>0;
    this.connected=true;this.onConnection({connected:true});await this.poll();
    if(revision===this.revision)this.timer=setInterval(()=>this.poll(),1000);
  }
  async poll(){
    const revision=this.revision,file=this.file;
    if(this.busy===revision||!file)return;this.busy=revision;
    try{
      const stat=await fs.stat(file);if(revision!==this.revision)return;
      let offset=this.offset,partial=this.partial,discard=this.discard;
      if(stat.size<offset){offset=0;partial='';discard=false;}
      if(stat.size-offset>262144){offset=stat.size-262144;partial='';discard=true;}
      const length=stat.size-offset;
      if(length){
        const handle=await fs.open(file,'r');let data;
        try{const buffer=Buffer.alloc(length);const read=await handle.read(buffer,0,length,offset);data=buffer.subarray(0,read.bytesRead).toString('utf8');offset+=read.bytesRead;}finally{await handle.close();}
        if(revision!==this.revision)return;
        const lines=(partial+data).split('\n');partial=lines.pop();
        if(discard){lines.shift();discard=false;}
        if(partial.length>262144){partial='';discard=true;}
        this.offset=offset;this.partial=partial;this.discard=discard;
        let latest=null;
        for(const line of lines){if(line.length>262144)continue;try{const signal=sessionSignal(JSON.parse(line));if(signal)latest=signal;}catch{}}
        if(latest)this.onSignal(latest);
      }
      if(!this.connected){this.connected=true;this.onConnection({connected:true});}
    }catch{if(revision===this.revision){this.connected=false;this.onConnection({connected:false,error:'会话暂时不可读，等待恢复'});}}
    finally{if(this.busy===revision)this.busy=null;}
  }
  stop(){this.revision++;if(this.timer)clearInterval(this.timer);this.timer=null;this.file=null;this.partial='';this.connected=false;}
}
