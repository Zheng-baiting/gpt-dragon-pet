export const STATES=['idle','thinking','working','waiting','done','error','sleep','walk'];
export const LABELS={idle:'在这里陪你',thinking:'认真想一想',working:'正在努力工作',waiting:'等你一下',done:'这一件，做好了',error:'遇到一点问题',sleep:'休息一下',walk:'出去走两步'};
export const CELLS={idle:0,blink:1,thinking:2,working:3,waiting:4,done:5,error:6,sleep:7};
export const DEFAULTS={size:220,alwaysOnTop:true,roam:false,reducedMotion:false,bubbles:true,sessionFile:null,x:null,y:null};
export function cleanPreferences(input={}){
  const p={...DEFAULTS};
  if(Number.isFinite(input.size))p.size=Math.min(340,Math.max(140,Math.round(input.size)));
  for(const key of ['alwaysOnTop','roam','reducedMotion','bubbles'])if(typeof input[key]==='boolean')p[key]=input[key];
  for(const key of ['x','y'])if(Number.isFinite(input[key]))p[key]=Math.round(input[key]);
  if(typeof input.sessionFile==='string'&&input.sessionFile.length<4096)p.sessionFile=input.sessionFile;
  return p;
}
export function windowSize(size){return {width:size+80,height:Math.round(size*4/3)+108};}
export function clampPosition(point,area,size){
  return {x:Math.max(area.x,Math.min(area.x+area.width-size.width,Math.round(point.x))),y:Math.max(area.y,Math.min(area.y+area.height-size.height,Math.round(point.y)))};
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
    if(['function_call_output','custom_tool_call_output','reasoning'].includes(p.type))state='thinking';
  }
  return state?{state,at}:null;
}
export function spritePose(state,elapsed,reduced=false){
  const phase=elapsed/1000;
  const cell=state==='idle'&&elapsed%4800>4600?1:(CELLS[state]??0);
  if(reduced)return {cell,walkFrame:0,y:0,angle:0,sx:1,sy:1};
  const breathe=Math.sin(phase*2)*0.008;
  let y=Math.sin(phase*2)*1.4,angle=0;
  if(state==='thinking')angle=Math.sin(phase*1.3)*2;
  if(state==='working')y=Math.sin(phase*5)*1.5;
  if(state==='done')y=-Math.abs(Math.sin(Math.min(elapsed/1600,1)*Math.PI*3))*8*Math.max(0,1-elapsed/5000);
  if(state==='error')angle=Math.sin(phase*24)*3*Math.max(0,1-elapsed/2500);
  if(state==='sleep')y=Math.sin(phase)*1;
  return {cell,walkFrame:Math.floor(elapsed/150)%4,y,angle,sx:1-breathe,sy:1+breathe};
}
