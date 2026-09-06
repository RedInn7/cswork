import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.GO_JUDGE_URL;
const token=process.env.GO_JUDGE_TOKEN;
if(!base||!token)throw new Error('Runner configuration missing');
const limits=(input='')=>({env:['PATH=/usr/bin:/bin','HOME=/w','LANG=C.UTF-8'],files:[{content:input},{name:'stdout',max:65536,pipe:true},{name:'stderr',max:65536,pipe:true}],cpuLimit:30e9,clockLimit:60e9,memoryLimit:1073741824,procLimit:64});
async function execute(cmd){const response=await fetch(base+'/run',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({cmd:[cmd]}),signal:AbortSignal.timeout(75000)});if(!response.ok)throw new Error(`Runner HTTP ${response.status}`);return (await response.json())[0];}
async function remove(id){await fetch(base+'/file/'+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});}
const reports=[];
for(const test of JSON.parse(readFileSync('cases.json','utf8'))){
 const compiled=await execute({...limits(),args:['/usr/bin/g++','-std=c++20','-O2','-pipe','main.cpp','-o','main'],copyIn:{'main.cpp':{content:readFileSync(test.key+'.cpp','utf8')}},copyOutCached:['main'],copyOutMax:16777216});
 if(compiled.status!=='Accepted'){console.log(test.key,compiled);throw new Error('Compilation failed');}
 const id=compiled.fileIds.main;
 try{
  const run=await execute({...limits(JSON.stringify(test.input)),args:['main'],copyIn:{main:{fileId:id}},copyOut:['cswork-result.json'],copyOutMax:16777216});
  if(run.status!=='Accepted'){console.log(test.key,run);throw new Error('Execution failed');}
  const reply=JSON.parse(run.files['cswork-result.json']);
  assert.deepEqual(reply.result,test.expected);
  if(test.id===48)assert.deepEqual(reply.args,[[[2,1],[3,4]]]);
  if(test.id===344)assert.deepEqual(reply.args,[['b','a']]);
  if(test.id===142)assert.equal(reply.nodes.length,2);
  if(test.id===138)assert.deepEqual(reply.nodes[1].fields.random,{$ref:1});
  reports.push({key:test.key,id:test.id,passed:true,memory:run.memory});console.log('PASS',test.key,test.id);
 }finally{await remove(id);}
}
for(const test of JSON.parse(readFileSync('interfaces.json','utf8'))){
 const result=await execute({...limits(),args:['/usr/bin/g++','-std=c++20','-w','-fsyntax-only','main.cpp'],copyIn:{'main.cpp':{content:readFileSync(test.key+'.cpp','utf8')}}});
 if(result.status!=='Accepted'){console.log(test.key,result);throw new Error('Interface compilation failed');}
 reports.push({key:test.key,passed:true,count:test.ids.length,memory:result.memory});console.log('PASS',test.key,test.ids.length);
}
writeFileSync('report.json',JSON.stringify(reports,null,2));
