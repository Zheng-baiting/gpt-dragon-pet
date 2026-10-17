const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
if(process.platform!=='win32'){console.error('This desktop companion requires Windows 10/11.');process.exit(1);}
if(Number(process.versions.node.split('.')[0])<24){console.error('Node.js 24 or newer is required.');process.exit(1);}
const root=path.resolve(__dirname,'..'),temp=path.join(root,'work/temp');
fs.mkdirSync(temp,{recursive:true});
const env={...process.env,TEMP:temp,TMP:temp};
const build=spawnSync(process.execPath,[path.join(__dirname,'build.mjs')],{cwd:root,stdio:'inherit',windowsHide:true,env});
if(build.status!==0)process.exit(build.status||1);
const args=['-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',path.join(__dirname,'start-native.ps1')];
const smoke=process.argv.includes('--smoke-test'),report=path.join(root,'work/qa/smoke.json');
if(smoke){args.push('-SmokeTest');fs.rmSync(report,{force:true});}
const result=spawnSync('powershell.exe',args,{cwd:root,stdio:'inherit',windowsHide:true,env});
if(result.error)console.error(result.error.message);
if(smoke&&result.status===0){try{if(!JSON.parse(fs.readFileSync(report,'utf8')).ok)throw Error('Native UI checks failed.');}catch(error){console.error(error.message);process.exit(1);}}
process.exit(result.status??1);
