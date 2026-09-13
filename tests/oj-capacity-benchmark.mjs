/** Wrap the isolated latency probe with runner CPU and public-web guardrails.
 * CPU windows include warmups; submission percentiles do not. Requires Linux
 * cgroup v2, TEST_RUNNER_CPU_STAT, and the existing dedicated-runner harness.
 * Never runs against a production runner or mutates the source database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const cpuPath = process.env.TEST_RUNNER_CPU_STAT;
assert(cpuPath?.startsWith('/sys/fs/cgroup/') && cpuPath.endsWith('/cpu.stat'));
const label = process.env.TEST_CAPACITY_LABEL || 'unspecified';
const web = process.env.TEST_WEB_URL || 'http://127.0.0.1:4317/';
const percentile = (values, p) => [...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)] ?? null;
function cpu() {
  return Object.fromEntries(readFileSync(cpuPath,'utf8').trim().split('\n').map(line=>{
    const [key,value]=line.split(/\s+/); return [key,Number(value)];
  }));
}
let prior=cpu(), priorTime=performance.now(), start=prior, startTime=priorTime;
let peak=0, webPending=false, webSamples=[], webErrors=0, text='';
const timer=setInterval(()=>{
  const now=performance.now(), next=cpu();
  peak=Math.max(peak,(next.usage_usec-prior.usage_usec)/((now-priorTime)*1000));
  prior=next; priorTime=now;
},250);
const webTimer=setInterval(async()=>{
  if(webPending) return;
  webPending=true; const before=performance.now();
  try {
    const response=await fetch(web,{signal:AbortSignal.timeout(3000),redirect:'manual'});
    await response.arrayBuffer();
    if(response.status!==200) webErrors++; else webSamples.push(performance.now()-before);
  } catch {webErrors++;} finally {webPending=false;}
},1000);
const child=spawn(process.execPath,process.env.TEST_CPU_ONLY==='1'?['-e','process.exit(0)']:[process.env.TEST_LATENCY_HARNESS || new URL('./oj-latency-load.mjs',import.meta.url).pathname],{env:process.env,stdio:['ignore','pipe','inherit']});
child.stdout.on('data',chunk=>{
  text+=chunk.toString(); const lines=text.split('\n'); text=lines.pop();
  for(const line of lines) {
    console.log(line);
    let report; try {report=JSON.parse(line);} catch {continue;}
    if(report.event!=='probe_group') continue;
    const end=cpu(), elapsed=performance.now()-startTime;
    console.log(JSON.stringify({event:'capacity_group',label,language:report.language,concurrency:report.concurrency,group:report.group,cpuWindowIncludesWarmup:true,windowMs:Math.round(elapsed),runnerAverageCores:(end.usage_usec-start.usage_usec)/(elapsed*1000),runnerPeak250msCores:peak,runnerThrottledMs:(end.throttled_usec-start.throttled_usec)/1000,webSamples:webSamples.length,webP50Ms:percentile(webSamples,.5),webP95Ms:percentile(webSamples,.95),webErrors}));
    start=end; startTime=performance.now(); peak=0; webSamples=[]; webErrors=0;
  }
});
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>child.kill(signal));
try {
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  process.exitCode=code ?? 1;
  if(code===0) {
    const before=cpu(), began=performance.now();
    const command={args:['/usr/bin/python3','-c','import time\nt=time.process_time()\nx=0\nwhile time.process_time()-t<2.0:\n for i in range(10000): x=(x+i)%1000003\nprint("ok")'],env:['PATH=/usr/bin:/bin','HOME=/w','LANG=C.UTF-8'],files:[{content:''},{name:'stdout',max:1024},{name:'stderr',max:1024}],cpuLimit:4e9,clockLimit:30e9,memoryLimit:128*1024*1024,procLimit:16,copyIn:{}};
    const outcomes=await Promise.all(Array.from({length:4},async()=>{
      const response=await fetch(`${process.env.GO_JUDGE_URL}/run`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.GO_JUDGE_TOKEN || ''}`},body:JSON.stringify({cmd:[command]}),signal:AbortSignal.timeout(35000)});
      assert(response.ok); const result=await response.json();
      assert.equal(result[0]?.status,'Accepted'); return result[0];
    }));
    const elapsed=performance.now()-began,after=cpu();
    console.log(JSON.stringify({event:'capacity_cpu_probe',label,tasks:4,allAccepted:true,targetCpuSecondsPerTask:2,wallMs:elapsed,runnerCpuMs:(after.usage_usec-before.usage_usec)/1000,runnerAverageCores:(after.usage_usec-before.usage_usec)/(elapsed*1000),reportedTaskCpuMs:outcomes.map(x=>x.time/1e6),runnerThrottledMs:(after.throttled_usec-before.throttled_usec)/1000,webSamples:webSamples.length,webP95Ms:percentile(webSamples,.95),webErrors}));
  }
} finally {clearInterval(timer);clearInterval(webTimer);}
