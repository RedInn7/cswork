#!/usr/bin/env python3
"""Streaming log throttling; original OCR semantics, bounded transport not invented n cap."""
from pathlib import Path
import hashlib,json,random,subprocess,tempfile,time,sys,io,re
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-akuna-capital-8';BATCH='akuna-8-recovered';SEED=20261106
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='471737f56a7cfe94240ec874f313d9113b89a0dc02d8faa0f5fc4bc5d2b04565'
U32=2**32-1;U64=2**64-1;INPUT_LIMIT=32*1024*1024
SOURCES=[
 ('OA LIST/Akuna_Capital_OA/018_image.txt','b0f3ddb542f3f172d896cdd654a45fcb44d35e33','9bdfc1f1449e3329ca0da86881e0ee20a621de0438ef14d79c24ae211bcae113'),
 ('OA LIST/Akuna_Capital_OA/019_image.txt','79e4483af9f1633a18395978481b3731c5422408','25884ba2de699b4a66bec4ef2f1cf32bd85dda9c2ee18d71d3ab5c91fc09bbc3'),
 ('OA LIST/Akuna_Capital_OA/020_image.txt','8a39182fa886da2880b8aa2af8985e8916a0f704','e92d11c4a716f860b3a05102bed1b08a62de023569f6208000d8863d53daff3d'),
]
REFERENCE=r'''#include <cstdio>
#include <cstdint>
#include <deque>
using namespace std;
uint64_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();uint64_t x=0;while(c>32&&c!=EOF){x=x*10+uint64_t(c-'0');c=getchar_unlocked();}return x;}
struct Entry{uint64_t time;uint32_t size;};
int main(){
 uint64_t limit=readNumber(),window=readNumber(),n=readNumber(),sum=0,total=0;
 deque<Entry> accepted;
 for(uint64_t i=0;i<n;i++){
  uint64_t t=readNumber(),size=readNumber();
  while(!accepted.empty() && t-accepted.front().time>window){sum-=accepted.front().size;accepted.pop_front();}
  if(sum+size<=limit){sum+=size;total+=size;if(size)accepted.push_back({t,uint32_t(size)});}
 }
 printf("%llu\n",static_cast<unsigned long long>(total));
}
'''
MUTANTS=[
 {'name':'错误将左端点按开区间过期','language':'cpp','code':REFERENCE.replace('time>window','time>=window')},
 {'name':'错误使用32位加法判断窗口总量','language':'cpp','code':REFERENCE.replace('if(sum+size<=limit)','if(uint32_t(sum+size)<=limit)')},
 {'name':'错误将被拒日志也加入限额历史','language':'cpp','code':REFERENCE.replace('if(sum+size<=limit){sum+=size;total+=size;if(size)accepted.push_back({t,uint32_t(size)});}','if(sum+size<=limit)total+=size;sum+=size;if(size)accepted.push_back({t,uint32_t(size)});')},
]
EDITORIAL='''## 原OCR恢复与整理版本纠正

固定提交e66f809f4c953bce129f68491726176615db6afc，OA LIST/Akuna_Capital_OA/018_image.txt给出throttleLogs接口，返回实际发布的日志总字节数，不是成功日志下标列表。019明确窗口双闭：时刻t考虑[t−window,t]内已成功发布的日志，等于字节上限仍允许发布。020保证尝试时间升序且同一timestamp至多一条，因此严格递增；被拒日志不占后续发布额度。原例limit10、window5、日志(0,2),(3,4),(5,5),(7,5)，第三条被拒，最终总字节11。本站保留原输入和11，公开纠正catalog返回indices的不同题义，不执行原附代码。

018的size/bytesLimit/window类型为unsigned int、timestamp和返回总量为unsigned long，020保证数字符合所需精度。本站明确按Linux64位C++接口解释为uint32的0..4294967295与uint64的0..18446744073709551615，不声称源另列十进制上下限。零大小、零限额、零窗口与空日志集合均保留。原文没有给n数值上限；本站只受现有每例32MiB标准输入传输预算约束，不另设n≤100000等小上限。给定输入格式与019一致，按顺序为limit、window、n，再n行timestamp size。

原文是在线限流，不是离线挑选日志使总发布字节最大：若当前加上新日志未超额便发布，否则整条丢弃；不能为接纳未来日志而主动丢掉当前符合限额的日志。原例逐条说明就是此规则。

## 思路

维护成功发布且尚在当前窗口内的日志队列及其大小总和sum。每到时刻t，弹出所有t−old_time>window的队首，减去其大小。若sum+size≤limit，累加发布总量并将此日志入队，否则不改变队列。大小为0的日志对计费没有影响，可不存入队列。时间严格递增，所以已过期的日志以后不会再进入窗口。

## 正确性证明

处理第一条前成功历史为空，队列和sum均正确。假设处理前一条后队列记录所有可能仍贡献额度的正大小成功日志。对于新时刻t，因为时间单调，过期元素构成队首前缀；用严格大于window弹出恰好移除[t−window,t]外的历史，不会错删左端点。零大小省略不改变总量。弹出后sum正是当前窗口历史成功字节数。

当sum+size≤limit时，原限流规则允许并要求发布，入队和累加维护正确历史与总量；否则整条被拒，不入队符合仅成功日志占用额度。由归纳，每条决策与原文一致，最后total是所有成功发布字节之和。

## 复杂度与整数安全

每条成功正大小日志至多入队、出队各一次，时间O(n)，空间O(k)，k为最大活动成功日志数。输入逐条读取，不先装载完整日志数组。判断t−old_time>window而不是old_time+window<t，避免时间戳加法溢出，也避免t<window时计算t−window下溢。严格递增保证减法非负。sum和size相加使用uint64，不能在uint32中相加后比较。

成功活动sum始终≤uint32上限；任意单例32MiB文本至少为每条日志提供两个数字与分隔符，因此n<2^24，total<n·(2^32−1)<2^56，uint64可安全表示所有可传输输入的总量。这里使用平台字节预算推导，不伪造源n界。题包3秒、256MiB、输出64KiB，只有一个总量整数。具体Linux运行证据须另行验证，本地计时不是沙箱证据。

## 独立验证

小例oracle保存全部成功历史，每次直接扫描此前所有成功记录重新求双闭窗口和，不用队列过期算法。163唯一输入真实运行参考并对照该模型。正式40+案例覆盖原11、空集、零值、左端点恰相等、过期一秒、拒绝记录不能占额度、单值uint32最大、累计超过uint32、时间uint64边界与加法溢出。

两组各接近32MiB压力：连续整数时间且每条大小1，最大window/limit使所有日志保留，期望为n，检验活动队列最坏量级；另一组连续整数时间每条大小3、limit4/window1，恰好隔条发布，期望3·ceil(n/2)，独立闭式检验持续过期和拒绝。逐组生成、逐组实际执行，不并行积累大输入或子进程。三个正常退出负控覆盖左端点误开、32位加法溢出和拒绝日志占额度。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(limit,window,logs):
 assert 0<=limit<=U32 and 0<=window<=U32
 assert all(0<=t<=U64 and 0<=s<=U32 for t,s in logs)
 assert all(logs[i-1][0]<logs[i][0] for i in range(1,len(logs)))
 return f'{limit}\n{window}\n{len(logs)}\n'+''.join(f'{t} {s}\n' for t,s in logs)
def oracle(limit,window,logs):
 history=[];total=0
 for t,size in logs:
  used=sum(s for old,s in history if t-window<=old<=t)
  if used+size<=limit:history.append((t,size));total+=size
 return total
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20)
 assert not p.stderr
 return p.stdout.strip(),time.perf_counter()-start
def profile(binary,raw):
 start=time.perf_counter();darwin=sys.platform=='darwin'
 p=subprocess.run(['/usr/bin/time','-l' if darwin else '-v',str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20)
 pattern=r'(\d+)\s+maximum resident set size' if darwin else r'Maximum resident set size \(kbytes\):\s*(\d+)'
 matched=re.search(pattern,p.stderr);assert matched,p.stderr
 metrics={'method':'native /usr/bin/time '+('-l' if darwin else '-v'),'hostPlatform':sys.platform,'peakResidentBytes':int(matched[1])*(1 if darwin else 1024),'wallSeconds':round(time.perf_counter()-start,5),'notLinuxSandboxEvidence':True}
 return p.stdout.strip(),metrics
def pressure(limit,window,size):
 def digits(n):
  # Sum decimal lengths of0..n-1 without constructing any logs.
  answer=1;lo=1;width=1
  while lo<n:
   count=min(n,lo*10)-lo;answer+=count*width;lo*=10;width+=1
  return answer if n else 0
 def length(n):return len(f'{limit}\n{window}\n{n}\n')+digits(n)+3*n
 lo,hi=1,INPUT_LIMIT//4
 while lo<hi:
  middle=(lo+hi+1)//2
  if length(middle)<=INPUT_LIMIT:lo=middle
  else:hi=middle-1
 n=lo;assert length(n)<=INPUT_LIMIT<length(n+1)
 buffer=io.StringIO();buffer.write(f'{limit}\n{window}\n{n}\n')
 for i in range(n):buffer.write(f'{i} {size}\n')
 raw=buffer.getvalue();assert len(raw.encode())==length(n)
 return n,raw
def main():
 started=time.perf_counter();evidence=[]
 for path,blob,h in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==h
  assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==blob
  evidence.append({'path':path,'gitBlobSha':blob,'rawSha256':h})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.write_text(REFERENCE)
 values=[(10,5,[(0,2),(3,4),(5,5),(7,5)]),(4,1,[(0,3),(1,3),(2,3)]),(0,0,[]),
 (U32,U32,[(0,U32),(1,U32),(U32,U32),(U32+1,U32)]),(U32,0,[(U64-1,U32),(U64,U32)]),
 (1,1,[(0,1),(1,1),(2,1)]),(1,1,[(0,2),(1,1)]),(0,U32,[(0,0),(1,1),(2,0)]),
 (10,5,[(U64-5,6),(U64,5)]),(10,4,[(U64-5,6),(U64,5)]),
 (U32,U32,[(0,0),(U64,U32)]),(U32,0,[(0,U32),(1,U32)]),
 (0,0,[(U64,0)]),(0,0,[(U64,U32)])]
 rng=random.Random(SEED);keys={encode(*v) for v in values}
 while len(values)<163:
  n=rng.randrange(21);times=sorted(rng.sample(range(201),n));shift=U64-200 if len(values)%3==0 else 0
  limit=rng.choice([0,1,10,20,U32]);window=rng.choice([0,1,5,100,U32])
  logs=[(t+shift,rng.choice([0,1,2,5,10,U32])) for t in times];v=(limit,window,logs);raw=encode(*v)
  if raw not in keys:keys.add(raw);values.append(v)
 oracles=[];cases=[];large=[]
 with tempfile.TemporaryDirectory(prefix='akuna8-authored-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  for v in values:
   expected=oracle(*v);raw=encode(*v);assert execute(binary,raw)[0]==str(expected)
   oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
  assert oracles[0]['expectedOutput']=='11\n'
  cases=[{'name':['原OCR发布总量11','本站双闭端点与隔条发布','本站空日志集合'][i] if i<3 else f'独立历史扫描{i-2}',**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:43])]
  print('Akuna8:163 independent history-scan subprocess oracles passed; generating near32MiB cases serially',flush=True)
  for name,limit,window,size in [('近32MiB活动队列最坏量级',U32,U32,1),('近32MiB交替接受与过期',4,1,3)]:
   n,raw=pressure(limit,window,size);expected=n if size==1 else 3*((n+1)//2)
   actual,metrics=profile(binary,raw);assert actual==str(expected)
   cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
   large.append({'name':name,'n':n,'inputBytes':len(raw.encode()),'distanceTo32MiB':INPUT_LIMIT-len(raw.encode()),'expected':expected,'maxPositiveActiveEntries':n if size==1 else 1,'oracle':'all logs accepted' if size==1 else 'exactly even indexed timestamps accepted','inputSha256':sha(raw),'localResourceMeasurement':metrics})
   print(name,n,len(raw.encode()),'bytes passed',flush=True)
  n=10000;window=6;limit=11;size=3
  logs=[(U64-n+1+i,size) for i in range(n)];raw=encode(limit,window,logs)
  expected=size*((n//(window+1))*3+min(3,n%(window+1)))
  assert execute(binary,raw)[0]==str(expected)
  assert oracle(limit,window,logs)==expected
  cases.append({'name':'UINT64末端平移固定周期独立闭式','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  kills=[]
  for i,m in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{i}.cpp';path.write_text(m['code']);mb=Path(td)/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True)
   rejected=[j for j,c in enumerate(cases) if execute(mb,c['input'])[0]!=c['expectedOutput'].strip()]
   assert rejected;kills.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
 assert len({c['input'] for c in cases})==len(cases)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'双闭时间窗口内的日志限流','difficulty':'中等','tags':['OA','Akuna Capital','队列','滑动窗口'],
 'description':'按时间顺序尝试发布日志。时刻t检查双闭窗口[t−window,t]内已成功发布的字节总和，加上当前日志size若不超过bytesLimit则发布，否则整条丢弃。被丢弃日志不占后续额度。返回所有成功发布日志的总字节数，不是成功日志下标，也不是离线选择最大总量。',
 'input':'依次三行bytesLimit、window、n，随后n行timestamp size。依原OCR无符号接口并明确采用Linux64位模型，bytesLimit/window/size均0..4294967295，timestamp为0..18446744073709551615。时间戳严格递增。n为非负日志条数；原文无其数值上限，本站不设额外小上限，支持整个现有每例32MiB输入预算内的合法可传输实例。',
 'output':'输出一个非负整数，即实际发布的总字节数；使用64位整数。零大小、零限额、零窗口及空日志集合均合法。',
 'explanation':'第一例来自原OCR019：limit10/window5，时刻0、3分别发布2和4；时刻5的5会使双闭窗口总量11，故拒绝；时刻7发布5，总量11。catalog整理版返回下标列表与018真实接口不符，本站以018–020恢复总字节。其他公开例为本站推导，范围类型解释与n无额外上限详见题解。',
 'hints':['窗口左端点仍属于窗口。','只将成功发布的正大小日志放入活动队列。','用t−old_time比较窗口长度，并用64位计算sum+size。'],'timeLimit':3,'memoryLimit':262144,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'仅成功日志占据双闭窗口','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':evidence,'upstreamCodeExecuted':False,'corrections':['Return total published bytes, not catalogue indices. Original example total11 retained.','Doubly inclusive window and strictly increasing timestamps are explicit in019/020.'],'rangeDisclosure':'Original unsigned interfaces interpreted as Linux uint32/uint64; no original n upper bound invented. Site32MiB input budget is explicit. Zero values and empty logs retained.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'固定OCR018–020完整双闭窗口/返回总量/严格时间序列，纠正catalog不同接口。流式O(n)覆盖32MiB可传输域且不伪造n上限；独立历史扫描与大域闭式验证恢复后的计算规则。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Recompute accepted-history sum by scanning all prior accepted logs for each timestamp; full-scale expectations independent closed forms.','largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Akuna8 frozen:{len(cases)} formal,163 oracle,3 normal-exit mutants; normalizedBytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
