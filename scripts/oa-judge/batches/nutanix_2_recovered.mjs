import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ojImportSchema } from '../../../lib/oj-types.ts';

const ROOT=resolve(import.meta.dirname,'../../..'), OA=resolve(ROOT,'content/oa-judge');
const ID='oa-nutanix-2', BATCH='nutanix-2-schedule-erratum';
const URL='https://oamaster.com/docs/companies/nutanix#2-work-schedules-for-mts2';
const HASH='8e7a95308c5c01bced8d39537478ab84da7ac569234c64148b83e8ab16968a3a';
const hash=x=>createHash('sha256').update(x).digest('hex');
const put=(folder,file,value)=>writeFileSync(resolve(OA,folder,file),JSON.stringify(value,null,2)+'\n');

const reference=[
  'import json,sys',
  'def solve(raw):',
  ' p=raw.split(); work,limit=map(int,p[:2]); pattern=p[2]',
  ' if not 1<=work<=56 or not 1<=limit<=8 or len(pattern)!=7: raise ValueError("invalid input")',
  ' fixed=sum(int(c) for c in pattern if c!="?"); slots=[i for i,c in enumerate(pattern) if c=="?"]; chars=list(pattern); out=[]',
  ' def visit(i,left):',
  '  if left<0 or left>(len(slots)-i)*limit:return',
  '  if i==len(slots):',
  '   if left==0:out.append("".join(chars))',
  '   return',
  '  pos=slots[i]',
  '  for x in range(limit+1):chars[pos]=str(x);visit(i+1,left-x)',
  '  chars[pos]="?"',
  ' visit(0,work-fixed);return json.dumps(out,separators=(",",":"))',
  'if __name__=="__main__":print(solve(sys.stdin.read()))',
].join('\n')+'\n';

const mutants=[
  {name:'把每日上限错误固定为 8',code:[
    'import json,sys','w,_,p=sys.stdin.read().split();w=int(w);p=list(p);q=[i for i,c in enumerate(p) if c=="?"];f=sum(int(c) for c in p if c!="?");o=[]',
    'def g(i,r):',' if i==len(q):','  if r==0:o.append("".join(p))','  return',' for x in range(9):p[q[i]]=str(x);g(i+1,r-x)','g(0,w-f);print(json.dumps(o,separators=(",",":")))',
  ].join('\n')+'\n'},
  {name:'只返回第一种排班',code:[
    'import json,sys','w,d,p=sys.stdin.read().split();w=int(w);d=int(d);p=list(p);q=[i for i,c in enumerate(p) if c=="?"];f=sum(int(c) for c in p if c!="?");o=[]',
    'def g(i,r):',' if i==len(q):','  if r==0:o.append("".join(p))','  return',' for x in range(d+1):p[q[i]]=str(x);g(i+1,r-x)','g(0,w-f);print(json.dumps(o[:1],separators=(",",":")))',
  ].join('\n')+'\n'},
];
const run=(code,input)=>{const r=spawnSync('python3',['-I','-c',code],{input,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
// Full Cartesian product oracle, independent of the reference's pruning.
function oracle(work,limit,pattern){
 const slots=[...pattern].flatMap((c,i)=>c==='?'?[i]:[]),fixed=[...pattern].filter(c=>c!=='?').reduce((s,c)=>s+Number(c),0),chars=[...pattern],out=[];
 function rec(i,sum){if(i===slots.length){if(sum+fixed===work)out.push(chars.join(''));return;}const pos=slots[i];for(let x=0;x<=limit;x++){chars[pos]=String(x);rec(i+1,sum+x);}chars[pos]='?';}
 rec(0,0);return JSON.stringify(out);
}

function main(){
 const source=JSON.parse(readFileSync(resolve(ROOT,'content/oa-master/catalog.json'),'utf8')).items.find(x=>x.id===ID);
 assert.equal(source?.contentHash,HASH);
 const formal=[
  {name:'原题示例一',w:24,d:4,p:'08??840'},
  {name:'原题示例二',w:56,d:8,p:'???8???'},
  {name:'原题示例三（按解释勘误）',w:3,d:2,p:'??2??00'},
  {name:'验证每日上限为 8',w:3,d:8,p:'??2??00'},
  {name:'验证每日上限为 4',w:8,d:4,p:'??2??00'},
  {name:'七个未知日期的最大结果集',w:28,d:8,p:'???????'},
 ];
 let seed=0x4e757461;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const seen=new Set(formal.map(x=>`${x.w} ${x.d} ${x.p}\n`)),tests=[];
 while(tests.length<160){const d=1+rand(8),s=Array.from({length:7},()=>rand(d+1)),w=Math.max(1,s.reduce((a,b)=>a+b,0)),q=1+rand(4),hidden=new Set();while(hidden.size<q)hidden.add(rand(7));const p=s.map((x,i)=>hidden.has(i)?'?':String(x)).join(''),input=`${w} ${d} ${p}\n`;if(seen.has(input))continue;seen.add(input);tests.push({input,expectedOutput:oracle(w,d,p)+'\n'});}
 for(let i=0;i<20;i++){const test=tests.shift();formal.push({name:`随机隐藏样例 ${i+1}`,witness:true,input:test.input,expectedOutput:test.expectedOutput});}
 const cases=formal.map((x,i)=>{const input=x.input??`${x.w} ${x.d} ${x.p}\n`,expectedOutput=x.expectedOutput??oracle(x.w,x.d,x.p);assert.equal(run(reference,input),expectedOutput.trim(),x.name);return{name:x.name,input,expectedOutput:expectedOutput.endsWith('\n')?expectedOutput:expectedOutput+'\n',hidden:i>0,weight:1};});
 for(const t of tests)assert.equal(run(reference,t.input),t.expectedOutput.trim());
 const killed=mutants.map(m=>({name:m.name,by:cases.flatMap((c,i)=>run(m.code,c.input)!==c.expectedOutput.trim()?[i]:[])}));assert(killed.every(x=>x.by.length));
 const pkg=ojImportSchema.parse({schemaVersion:1,problem:{id:ID,courseId:'gomall',lessonId:'00-overview',title:'Work Schedules',difficulty:'简单',tags:['OA','Nutanix','回溯','枚举'],description:'给定周总工时、每日上限和部分固定的七天排班，列出所有合法排班。',input:'输入 work_hours、day_hours、pattern，空格分隔；pattern 长度为 7，数字为固定工时，? 为待安排日期。',output:'输出紧凑 JSON 字符串数组，按字典序升序排列。',explanation:'按位置枚举问号的 0..day_hours，并按剩余工时和容量剪枝。',hints:['只对 ? 位置填入 0..day_hours。','每日上限是输入参数，不能当作固定值。'],timeLimit:4,memoryLimit:65536,outputLimit:4096,checker:'exact',languages:['python','go','java','cpp']},cases});
 const fence=String.fromCharCode(96).repeat(3),editorial=`# Work Schedules\n\n## 思路\n\n固定日期先求和，再从左到右尝试每个问号的 0 到 day_hours。剩余工时小于 0 或超过剩余位置容量时剪枝。填完且剩余为 0 即为合法排班；递增枚举保证字典序。\n\n## 样例勘误\n\nOAMaster 第三例输入写 day_hours=8，但解释和输出按 2 列出；FastPrep 同题副本也使用 2。本站仅将例子输入更正为 2，算法仍按输入参数工作，并额外验证上限 4 和 8。原题第一例的固定排班包含 8 小时而上限为 4，因此 day_hours 只约束需要填写的问号，固定字符保持不变。\n\n## 正确性\n\n每个问号都枚举全部允许值，只保留总工时相等的结果，因此不漏解也不引入非法排班。\n\n## 复杂度\n\nq 为问号数，时间 O((day_hours+1)^q) 加输出开销，递归空间 O(q)。\n\n## 参考实现\n\n${fence}python\n${reference}${fence}\n`;
 const packageChecksum=hash(JSON.stringify(pkg)),manifest={schemaVersion:1,items:[{id:ID,sourceContentHash:HASH,packageChecksum,editorial,authoredSolutions:[{language:'python',code:reference}],oracleCoverage:{inputs:tests.map(x=>x.input)}}]};
 const manifestBytes=JSON.stringify(manifest,null,2)+'\n';
 let report;try{report=JSON.parse(readFileSync(resolve(OA,'reports',`${BATCH}.json`),'utf8'));}catch{}
 const reportProblem=report?.problems?.find(x=>x.id===ID);
 const reportValid=Boolean(report?.allPassed&&report.batch===BATCH&&report.batchSha256===hash(Buffer.from(manifestBytes))&&reportProblem?.formal===cases.length&&reportProblem?.oracle===tests.length&&reportProblem?.passed===cases.length+tests.length&&reportProblem?.killed?.length===mutants.length);
 for(const f of ['candidate-batches','packages','references','oracles','mutants','editorials','validation','source-evidence','resolutions','negative-controls'])mkdirSync(resolve(OA,f),{recursive:true});
 const batchPath=`${BATCH}.json`;put(reportValid?'batches':'candidate-batches',batchPath,manifest);if(reportValid&&existsSync(resolve(OA,'candidate-batches',batchPath)))unlinkSync(resolve(OA,'candidate-batches',batchPath));put('packages',`${ID}.json`,pkg);writeFileSync(resolve(OA,'references',`${ID}.py`),reference);put('oracles',`${ID}.json`,tests);put('mutants',`${ID}.json`,mutants);mutants.forEach((x,i)=>writeFileSync(resolve(OA,'negative-controls',`${ID}-${i+1}.py`),x.code));
 put('editorials',`${ID}.json`,{schemaVersion:1,id:ID,title:'Work Schedules',explanation:editorial,solutions:[{language:'python',code:reference}],sourceUrl:URL,sourceContentHash:HASH,author:'CSWork'});
 put('validation',batchPath,{schemaVersion:1,note:reportValid?`用户自有 GoJudge 通过 ${reportProblem.passed} 项（${reportProblem.formal} 正式用例 + ${reportProblem.oracle} oracle），两个错误实现均被击杀。`:'160 组独立笛卡尔积 oracle 与剪枝参考程序逐项一致；按解释勘误第三例 day_hours，另测上限 4、8；两个正常退出错误程序均被击杀。',problems:[{id:ID,formalCases:cases.length,oracleCases:tests.length,negativeControls:killed.map(x=>({name:x.name,rejectedByCases:x.by})),referenceSha256:hash(Buffer.from(reference)),oracleSha256:hash(readFileSync(resolve(OA,'oracles',`${ID}.json`)))}]});
 put('source-evidence',batchPath,{schemaVersion:1,repository:'https://github.com/RedInn7/OA-Master',commit:'e66f809f4c953bce129f68491726176615db6afc',catalogContentHash:HASH,pages:[{company:'Nutanix',path:'web/content/docs/companies/nutanix.mdx',gitBlobSha:'e456ebadfeb2ed296ead739808d9cdfb76ce876b'}],items:[{id:ID,title:'Work Schedules (for MTS2)',sourceUrl:URL,sourceContentHash:HASH,previousStatus:'blocked',previousReason:'示例三参数写 day_hours=8，解释却改写为 2；虽该样例输出碰巧相同，未确认源题正确参数含义前暂缓。',evidence:'源页将 day_hours 定义为输入中的每日最大工时，三种参考实现均动态读取该参数。第三例输入写 8，但解释和输出使用 2；FastPrep 对应例子也使用 2。仅作为源样例笔误修正，不改变参数语义。'+(reportValid?` 用户自有 GoJudge 通过 ${reportProblem.passed} 项。`:''),supportingSources:[{url:'https://www.fastprep.io/problems/nutanix-find-schedules',evidence:'第三例使用 day_hours=2，剩余一小时可放在四个问号任一处。'}],siteAdditions:['本站采用空格分隔输入和紧凑 JSON 输出。','原题第三例输入 8 按解释勘误为 2，源文件指纹保持不变。'],status:reportValid?'authored':'candidate',errata:{field:'day_hours',original:8,corrected:2,basis:'题目解释及 FastPrep 对应样例。'}}]});
 put('resolutions',batchPath,{schemaVersion:1,items:[{id:ID,batch:BATCH,sourceContentHash:HASH,previousReason:'示例三参数写 day_hours=8，解释却改写为 2；虽该样例输出碰巧相同，未确认源题正确参数含义前暂缓。',reason:'每日上限是显式动态参数，源页参考解均按参数枚举。依据题目解释及同题副本，把示例输入 8 更正为 2，并覆盖上限 4、8。'}]});
 console.log(JSON.stringify({id:ID,batch:BATCH,formalCases:cases.length,oracleCases:tests.length,mutantsKilled:killed.length,sandboxVerified:reportValid,packageChecksum}));
}
main();
