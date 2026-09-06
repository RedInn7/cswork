import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.GO_JUDGE_URL,token=process.env.GO_JUDGE_TOKEN;
if(!base||!token)throw new Error('Missing sandbox config');
const limits=(input='',compile=false)=>({env:['PATH=/usr/bin:/bin','HOME=/w','LANG=C.UTF-8'],files:[{content:input},{name:'stdout',max:65536,pipe:true},{name:'stderr',max:65536,pipe:true}],cpuLimit:(compile?30:3)*1e9,clockLimit:(compile?60:9)*1e9,memoryLimit:(compile?1024:256)*1048576,procLimit:64});
async function execute(cmd){const r=await fetch(base+'/run',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({cmd:[cmd]}),signal:AbortSignal.timeout(75000)});if(!r.ok)throw new Error(`Sandbox HTTP ${r.status}`);return (await r.json())[0];}
const report=[];
for(const item of JSON.parse(readFileSync('pipeline.json','utf8'))){
 const c=await execute({...limits('',true),args:['/usr/bin/g++','-std=c++20','-O2','-pipe','main.cpp','-o','main'],copyIn:{'main.cpp':{content:readFileSync(`lc-${item.id}.cpp`,'utf8')}},copyOutCached:['main'],copyOutMax:16777216});
 if(c.status!=='Accepted'){console.log(c);throw new Error(`Compile ${item.id}`);}
 const fileId=c.fileIds.main;
 const run=async(input,custom=false)=>{const r=await execute({...limits(input),args:['/usr/bin/python3','-I','bridge.py',...(custom?['--leetcode-input']:[])],copyIn:{main:{fileId},'bridge.py':{content:readFileSync(`lc-${item.id}.py`,'utf8')}}});if(r.status!=='Accepted'){console.log(item.id,r);throw new Error('Pipeline runtime');}report.push({id:item.id,custom,time:r.time,memory:r.memory});return r.files.stdout;};
 try {
  for(const test of item.runs||[]){const output=await run(test.input,test.custom);assert.deepEqual(output.trim().split(/\s+/),test.tokens);console.log('PASS pipeline',item.id,test.custom?'custom':'formal');}
  if(item.codecTrees){const encoded=JSON.parse(await run(JSON.stringify({operation:'serialize',trees:item.codecTrees})));assert.equal(encoded.length,item.codecTrees.length);assert(encoded.every(s=>typeof s==='string'));const decoded=JSON.parse(await run(JSON.stringify({operation:'deserialize',data:encoded})));assert.deepEqual(decoded,item.codecTrees);console.log('PASS pipeline',item.id,'two isolated codec phases');}
 }finally{await fetch(base+'/file/'+encodeURIComponent(fileId),{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});}
}
writeFileSync('pipeline-report.json',JSON.stringify(report,null,2));
