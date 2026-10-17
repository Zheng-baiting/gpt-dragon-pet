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
  constructor(onSignal,onConnection){this.onSignal=onSignal;this.onConnection=onConnection;this.file=null;this.offset=0;this.partial='';this.busy=false;this.timer=null;}
  async connect(file,home){
    this.stop();
    if(!file){this.onConnection({connected:false});return;}
    if(!await allowedSession(file,home))throw new Error('请选择 Codex sessions 目录中的会话 JSONL 文件。');
    this.file=file;const stat=await fs.stat(file);this.offset=Math.max(0,stat.size-131072);this.discard=this.offset>0;
    this.onConnection({connected:true});await this.poll();this.timer=setInterval(()=>this.poll(),1000);
  }
  async poll(){
    if(this.busy||!this.file)return;this.busy=true;
    try{
      const stat=await fs.stat(this.file);
      if(stat.size<this.offset){this.offset=0;this.partial='';this.discard=false;}
      if(stat.size-this.offset>262144){this.offset=stat.size-262144;this.partial='';this.discard=true;}
      const length=stat.size-this.offset;if(!length)return;
      const handle=await fs.open(this.file,'r');let data;
      try{const buffer=Buffer.alloc(length);const read=await handle.read(buffer,0,length,this.offset);data=buffer.subarray(0,read.bytesRead).toString('utf8');this.offset+=read.bytesRead;}finally{await handle.close();}
      const lines=(this.partial+data).split('\n');this.partial=lines.pop();
      if(this.discard){lines.shift();this.discard=false;}
      if(this.partial.length>262144){this.partial='';this.discard=true;}
      let latest=null;
      for(const line of lines){if(line.length>262144)continue;try{const signal=sessionSignal(JSON.parse(line));if(signal)latest=signal;}catch{}}
      if(latest)this.onSignal(latest);
    }catch{this.onConnection({connected:false,error:'会话暂时不可读，等待恢复'});}finally{this.busy=false;}
  }
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;this.file=null;this.partial='';}
}
