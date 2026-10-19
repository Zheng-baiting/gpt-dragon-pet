export const STATES=['idle','thinking','working','result','waiting','done','error','sleep','walk'];
export const LABELS={idle:'在这里陪你',thinking:'认真想一想',working:'正在努力工作',result:'整理一下成果',waiting:'等你一下',done:'这一件，做好了',error:'遇到一点问题',sleep:'休息一下',walk:'出去走两步'};
export const DEFAULTS={size:220,alwaysOnTop:true,roam:false,idleActions:true,reducedMotion:false,bubbles:true,sessionFile:null,x:null,y:null};
export function cleanPreferences(input={}){
  const p={...DEFAULTS};
  if(Number.isFinite(input.size))p.size=Math.min(340,Math.max(140,Math.round(input.size)));
  for(const key of ['alwaysOnTop','roam','idleActions','reducedMotion','bubbles'])if(typeof input[key]==='boolean')p[key]=input[key];
  for(const key of ['x','y'])if(Number.isFinite(input[key]))p[key]=Math.round(input[key]);
  if(typeof input.sessionFile==='string'&&input.sessionFile.length<4096)p.sessionFile=input.sessionFile;
  return p;
}
export function sessionSignal(record,now=Date.now()){
  const at=Date.parse(record?.timestamp);
  if(!Number.isFinite(at)||now-at>15*60*1000||at-now>60000)return null;
  const p=record.payload??{};let state=null;
  if(record.type==='event_msg'){
    if(['task_started','turn_started','agent_reasoning'].includes(p.type))state='thinking';
    if(['task_complete','task_completed','turn_complete'].includes(p.type))state='done';
    if(['turn_aborted','task_aborted'].includes(p.type))state='waiting';
    if(['error','task_failed'].includes(p.type))state='error';
  }
  if(record.type==='response_item'){
    if(['function_call','custom_tool_call'].includes(p.type))state=/request_user_input/.test(p.name??'')?'waiting':'working';
    if(['function_call_output','custom_tool_call_output'].includes(p.type))state='result';
    if(p.type==='reasoning')state='thinking';
  }
  return state?{state,at}:null;
}
