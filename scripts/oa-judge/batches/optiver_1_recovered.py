#!/usr/bin/env python3
"""Original C++ implementation; independent schedule enumeration and closed forms."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-optiver-1';BATCH='optiver-1-recovered';SEED=20261104
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCE='fastprep/Optiver/akuna-print-schedule.md'
BLOB='b12853bd7292850d5e258c9c0d365ee9ab399e07'
RAW_SHA='571a2d84b07f4a5cf3189a16397692f202e720355c5715069abc77687f0b4f04'
HASH='4f47d0f4483ab1bf42c898d93af2cde3d6511e2961507341b523b05a5b1b079b'
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int readInt(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();int x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return x;}
int main(){
 int n=readInt(),m=readInt();
 vector<int>s(n),e(n),head(n,-1),degree(n,0),to(m),next(m),queue(n);
 for(int i=0;i<n;i++){s[i]=readInt();e[i]=readInt();}
 for(int i=0;i<m;i++){int u=readInt()-1,v=readInt()-1;to[i]=v;next[i]=head[u];head[u]=i;degree[v]++;}
 int first=0,last=0;for(int i=0;i<n;i++)if(!degree[i])queue[last++]=i;
 while(first<last){int u=queue[first++];for(int k=head[u];k!=-1;k=next[k]){int v=to[k];s[v]=max(s[v],s[u]+1);e[v]=min(e[v],e[u]-1);if(!--degree[v])queue[last++]=v;}}
 bool ok=last==n;for(int i=0;i<n;i++)if(s[i]>=e[i])ok=false;
 if(!ok){puts("IMPOSSIBLE");return 0;}
 for(int i=0;i<n;i++)printf("%d %d\n",s[i],e[i]);
}
'''
MUTANTS=[
 {'name':'错误允许依赖同时开始结束','language':'cpp','code':REFERENCE.replace('s[u]+1','s[u]').replace('e[u]-1','e[u]')},
 {'name':'错误漏掉结束时刻反向包含约束','language':'cpp','code':REFERENCE.replace('e[v]=min(e[v],e[u]-1);','')},
]
EDITORIAL='''## 原始来源与样例纠正

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Optiver/akuna-print-schedule.md完整说明：每个进程有最早开始S和最晚结束E；依赖u→v要求u严格先开始、严格后结束。时刻为1..1000000整数，每个进程至少运行一个单位，按PID1..N输出全部排程。原文要求尽可能长时间运行，并非任选一个较短可行排程。

原四进程例[[1,2],[100,2100],[110,2200],[200,2330]]和边1→2、3→2不能排程，本站保留全部输入并纠正为IMPOSSIBLE：进程1至多在[1,2]运行，依赖使进程2结束≤1，而自身开始≥100。原输出只列三行，既不可满足这些边，也不符合输出N行的要求。第二公开例是本站明确重建的三进程补充例[[100,2100],[110,2200],[200,2330]]及边1→2、3→2，输出100 2100、201 2099、200 2330；不声称这是原四进程输入的正确输出。第三公开例为本站补充的单进程等时窗口，因至少运行一单位而不可行。

原文自身给出1≤N≤1000000、0≤M≤1000000、1≤S≤E≤1000000，边无自环且有序对不重复。另写跨测试Sum of N,M≤1000000，未明确合计或各自求和；这是原批量接口的总量约束，本站一次输入一个实例，明确完整支持N和M各自百万，不暗缩为N+M≤百万。原文类接口转换为标准输入不改变优化规则。

## 思路

所有依赖使子进程的运行区间严格包含在父进程内。初始化start=S、end=E，按拓扑序从父u向子v传播start[v]=max(start[v],start[u]+1)，end[v]=min(end[v],end[u]−1)。用入度队列和扁平邻接表，避免递归深链及每节点分配容器。存在环或最后任意start≥end，输出IMPOSSIBLE。

## 正确性证明

有向环要求某个开始时刻严格小于自己，故无解。对DAG按拓扑序归纳：任一合法排程开始s[v]≥S[v]且大于每个父的开始，故s[v]≥start[v]；结束e[v]≤E[v]且小于每个父的结束，故e[v]≤end[v]。初始化及每次取max/min恰好累积这些必要界。

若start[v]≥end[v]，任何候选排程都不能让该进程运行至少一单位。反之，所有区间正长且DAG无环时，计算出的端点自身满足窗口及每条依赖，所以全体同时可行。它逐节点包含任意可行排程的区间，因此同时使每个进程的运行时长最大，不存在延长某进程必须缩短另一进程的取舍。要达到最大长度，两个端点必须同时等于这些界，故最优排程唯一，可以精确tokens评测。这是展开原文尽可能长运行的要求，而非引入总利润、字典序或任意选解等新目标。

## 复杂度及资源

拓扑排序每个节点和边各处理一次，时间O(N+M)，空间O(N+M)。五个N长int数组及两个M长int数组，共约20N+8M字节，N=M=百万时约28MB，另外只有标准输入输出缓冲。计算端点落在约[−1000000,2000000]内，32位有符号整数足够；禁止递归，最长链可达百万。题包支持完整范围，以原生C++执行，3秒/256MiB，最终Linux沙箱验收另做，本地耗时不是沙箱证据。

## 独立验证

小域直接枚举每个进程的所有整数正长子区间，过滤所有依赖，再分别取合法集合的最早开始、最晚结束，并验证它们可同时组成合法排程；不调用拓扑传播。163唯一小输入及额外小域穷举均使用此独立枚举。正式满规模以无边窗口不变、链第i节点[i,1000001−i]、超长链不可能、二层完全二部图子层[2,999999]和含环图不可能等数学构造独立给出期望。另有随机重编号DAG用全路径长度闭包求界，独立于参考入度队列。

两负控分别去掉严格差1、漏传播结束界，所有正式输入均需正常退出才算击杀。题面原例纠正、单例序列化、批量范围说明均公开披露。
'''

def sha(s):return hashlib.sha256(s.encode() if isinstance(s,str) else s).hexdigest()
def put(folder,name,value):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def encode(bounds,edges):
 n=len(bounds);assert 1<=n<=1000000 and len(edges)<=1000000
 assert all(1<=s<=e<=1000000 for s,e in bounds)
 assert len(set(edges))==len(edges) and all(0<=u<n and 0<=v<n and u!=v for u,v in edges)
 return f'{n} {len(edges)}\n'+''.join(f'{s} {e}\n' for s,e in bounds)+''.join(f'{u+1} {v+1}\n' for u,v in edges)
def output(intervals):return ''.join(f'{s} {e}\n' for s,e in intervals)
def brute(bounds,edges):
 choices=[[(s,e) for s in range(S,E+1) for e in range(s+1,E+1)] for S,E in bounds]
 best_start=[10**9]*len(bounds);best_end=[-1]*len(bounds);found=False
 for schedule in product(*choices):
  if all(schedule[u][0]<schedule[v][0] and schedule[v][1]<schedule[u][1] for u,v in edges):
   found=True
   for i,(s,e) in enumerate(schedule):best_start[i]=min(best_start[i],s);best_end[i]=max(best_end[i],e)
 if not found:return 'IMPOSSIBLE\n'
 intervals=list(zip(best_start,best_end))
 assert all(intervals[u][0]<intervals[v][0] and intervals[v][1]<intervals[u][1] for u,v in edges)
 return output(intervals)
def closure(bounds,edges):
 n=len(bounds);d=[[-10**6]*n for _ in range(n)]
 for i in range(n):d[i][i]=0
 for u,v in edges:d[u][v]=1
 for k in range(n):
  for i in range(n):
   for j in range(n):d[i][j]=max(d[i][j],d[i][k]+d[k][j])
 if any(d[i][i]>0 for i in range(n)):return 'IMPOSSIBLE\n'
 result=[]
 for v in range(n):
  s=max(bounds[u][0]+d[u][v] for u in range(n) if d[u][v]>=0)
  e=min(bounds[u][1]-d[u][v] for u in range(n) if d[u][v]>=0)
  if s>=e:return 'IMPOSSIBLE\n'
  result.append((s,e))
 return output(result)
def execute(binary,raw):
 t=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20)
 assert not p.stderr
 return p.stdout,time.perf_counter()-t

def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
 assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 reference=OA/f'references/{PID}.cpp';reference.write_text(REFERENCE)
 rng=random.Random(SEED);oracles=[];seen=set();exhaustive=0
 with tempfile.TemporaryDirectory(prefix='optiver1-authored-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(reference),'-o',str(binary)],check=True)
  windows=[(s,e) for s in range(1,5) for e in range(s,5)]
  for bounds in product(windows,repeat=2):
   for edges in [[],[(0,1)],[(1,0)],[(0,1),(1,0)]]:
    expected=brute(bounds,edges);assert expected==closure(bounds,edges)
    assert execute(binary,encode(bounds,edges))[0]==expected;exhaustive+=1
  while len(oracles)<163:
   n=rng.randint(1,4);bounds=[tuple(sorted((rng.randint(1,5),rng.randint(1,5)))) for _ in range(n)]
   edges=[(u,v) for u in range(n) for v in range(n) if u!=v and rng.random()<.24]
   raw=encode(bounds,edges)
   if raw in seen:continue
   seen.add(raw);expected=brute(bounds,edges);assert expected==closure(bounds,edges)==execute(binary,raw)[0]
   oracles.append({'input':raw,'expectedOutput':expected})
  print('Optiver1:400 exhaustive schedule models and163 independent subprocess oracles passed',flush=True)
  cases=[];large=[]
  def add(name,raw,expected,hidden=True,model='direct schedule enumeration'):
   actual,elapsed=execute(binary,raw);assert actual==expected,name
   n,m=map(int,raw.split('\n',1)[0].split())
   assert len(raw.encode())<=32*1024*1024 and len(expected.encode())<=16*1024*1024
   cases.append({'name':name,'input':raw,'expectedOutput':expected,'hidden':hidden,'weight':1})
   if n>=100000 or m>=100000:large.append({'name':name,'n':n,'m':m,'oracle':model,'inputSha256':sha(raw),'expectedSha256':sha(expected),'inputBytes':len(raw.encode()),'outputBytes':len(expected.encode()),'localSeconds':round(elapsed,5)})
  add('原四进程例纠正为不可行',encode([(1,2),(100,2100),(110,2200),(200,2330)],[(0,1),(2,1)]),'IMPOSSIBLE\n',False)
  add('本站三进程补充例',encode([(100,2100),(110,2200),(200,2330)],[(0,1),(2,1)]),'100 2100\n201 2099\n200 2330\n',False)
  add('本站单进程等时窗口',encode([(1000000,1000000)],[]),'IMPOSSIBLE\n',False)
  for i,c in enumerate(oracles[:27]):add(f'独立枚举{i+1}',c['input'],c['expectedOutput'])
  for i in range(5):
   n=50;order=list(range(n));rng.shuffle(order)
   edges=[(order[u],order[v]) for u in range(n) for v in range(u+1,n) if rng.random()<.08]
   bounds=[(rng.randint(1,50),rng.randint(100,200)) for _ in range(n)]
   add(f'随机重编号全路径闭包{i+1}',encode(bounds,edges),closure(bounds,edges),model='all-path max-length closure')
  n=1000000
  add('百万独立进程完整输出',f'{n} 0\n'+'1 1000000\n'*n,'1 1000000\n'*n,model='no dependencies: unchanged windows')
  n=500000
  add('五十万长链恰好正长',f'{n} {n-1}\n'+'1 1000000\n'*n+''.join(f'{i} {i+1}\n' for i in range(1,n)),''.join(f'{i} {1000001-i}\n' for i in range(1,n+1)),model='chain depth gives [i,1000001-i]')
  n=500001
  add('超过可行最大深度',f'{n} {n-1}\n'+'1 1000000\n'*n+''.join(f'{i} {i+1}\n' for i in range(1,n)),'IMPOSSIBLE\n',model='last chain interval nonpositive')
  n=2000;m=1000000
  add('百万互异边双层完全二部图',f'{n} {m}\n'+'1 1000000\n'*n+''.join(f'{u} {v}\n' for u in range(1,1001) for v in range(1001,2001)),'1 1000000\n'*1000+'2 999999\n'*1000,model='independent source layer and common depth-one target layer')
  n=1000000
  add('N和M各百万含环',f'{n} {n}\n'+'1 1000000\n'*n+''.join(f'{i} {i+1}\n' for i in range(1,n))+f'{n} 1\n','IMPOSSIBLE\n',model='whole directed cycle is infeasible')
  print('Optiver1:five full-envelope cases passed; checking normal-exit mutants',flush=True)
  assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
  kills=[]
  for index,mutant in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{index}.cpp';path.write_text(mutant['code']);mb=Path(td)/f'mutant{index}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True)
   rejected=[i for i,c in enumerate(cases) if execute(mb,c['input'])[0]!=c['expectedOutput']]
   assert rejected;kills.append({'name':mutant['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'依赖进程的最长运行排程','difficulty':'困难','tags':['OA','Optiver','拓扑排序','有向图'],
 'description':'每个进程i允许在整数时刻S_i或之后开始，E_i或之前结束，至少运行一个时间单位。依赖u→v要求s_u<s_v且e_v<e_u。按原题要求使进程尽可能长时间运行：本题存在同时使每个进程运行区间最大的唯一排程，无需在不同进程间权衡。输出这个最宽排程；不存在合法排程则输出IMPOSSIBLE。',
 'input':'第一行N M，随后N行S_i E_i，按PID1..N；随后M行u v。完整原范围1≤N≤1000000，0≤M≤1000000，1≤S_i≤E_i≤1000000，1≤u,v≤N且u≠v，所有有序边互异。原文还有跨测试Sum of N,M不超过百万的措辞，本站每次一个实例，支持N和M各百万，不额外限制N+M；不缩减任一原单项范围。',
 'output':'不可行仅输出IMPOSSIBLE；否则按PID升序输出恰好N行s_i e_i，各为整数，且每个进程取同时可行的最早开始、最晚结束。不能省略未参与依赖的进程。',
 'explanation':'第一公开例保留原四进程输入，但原三行输出错误：1→2迫使第2进程结束≤1，而其开始≥100，所以应IMPOSSIBLE。第二例为本站另外明确给出的三进程补充例，不是删除原例进程后冒充原输入。第三例为本站补充，S=E不满足至少运行一个单位。来源及优化唯一性证明见题解。',
 'hints':['依赖是区间严格包含，而非子进程必须在父进程结束后开始。','有向环必不可行；拓扑序传播开始的下界与结束的上界。'],'timeLimit':3,'memoryLimit':262144,'outputLimit':16384,'checker':'tokens','languages':['python','go','java','cpp']}
 package={'schemaVersion':1,'problem':problem,'cases':cases}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'拓扑传播唯一最宽可行区间','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':RAW_SHA,'catalogContentHash':HASH,'contentHash':HASH,'upstreamCodeExecuted':False,'sourceUrl':source['sourceUrl'],'constraints':['N1..1000000','M0..1000000','1<=S<=E<=1000000','unique directed edges without self loops','integer schedules and duration>=1'],'disclosures':['Original four-process example is impossible; all four processes retained. Original three output lines correspond to a separately labelled reconstructed example.','As-long-as-possible objective has a unique coordinatewise maximal interval schedule; tokens does not reject tied optimal solutions.','Ambiguous cross-test sum wording retained as source context; single-instance site protocol supports each N/M bound fully, including N=M=1000000.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'源明确尽可能长运行，传播界同时达到每个进程最大区间且最优唯一，并无多解checker阻断；原例保留四进程纠正IMPOSSIBLE，完整N/M各百万独立构造验证，仅候选待Linux沙箱。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(seen),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Enumerate all positive integer subinterval schedules, filter edges, take coordinatewise extrema; independent all-path closure corroboration. Full-scale expected outputs are closed-form constructions.','exhaustiveSmallDomain':{'cases':exhaustive,'n':2,'times':'1..4','allWindowsAndDirectedGraphs':True},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Optiver1 frozen:{len(cases)} formal,163 oracle,400 exhaustive,5 full-envelope cases,2 mutants; packageBytes={len(normalized.encode())}',flush=True)

if __name__=='__main__':main()
