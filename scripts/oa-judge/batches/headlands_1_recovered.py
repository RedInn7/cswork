#!/usr/bin/env python3
"""Disaster recovery log: union-find over shared (path, opaque id) anchors versus bipartite BFS oracle."""
from pathlib import Path
from itertools import product
from collections import defaultdict,deque
from bisect import bisect_left,bisect_right
import hashlib,json,random,re,subprocess,tempfile,time,string
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-headlands-1';BATCH='headlands-1-recovered';SEED=20261010
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCES=[
 ('fastprep/Headlands/headlands-disaster-recovery.md','e3edbc731a727a605ccf46a90903585019c869c8','da9c37943aa6c9601f6473d4760d3935bd6ef1fc3070c0fed6adc80ffb9a98c5'),
 ('web/content/docs/companies/headlands.mdx','1e518cac7e52f9c46320c8795da82dd9834e8672','4faa326aaa049b114a7a968930e8c9bb63bad450687523f02a259dde4d9a368f'),
]
HASH='0d247b628103ceff6ce66a730a0f25675f7d5391d343ee71859138ffe0094ce3'
MAXN,MAXR,MAXIN,MAXIDS,I63=200000,100000,30000000,2000000,(1<<63)-1
AMB='AMBIGUOUS INPUT!'
REFERENCE=r'''#include <cstdio>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <numeric>
using namespace std;
static vector<int> par;
static int findRoot(int x){while(par[x]!=x){par[x]=par[par[x]];x=par[x];}return x;}
static bool digits(string_view s){if(s.empty()||s.size()>19)return false;for(char c:s)if(c<'0'||c>'9')return false;return true;}
static uint64_t num(string_view s){uint64_t v=0;for(char c:s)v=v*10+uint64_t(c-'0');return v;}
static bool dupKeys(const vector<string_view>&t){vector<string_view> k;for(size_t i=0;i<t.size();i+=2)k.push_back(t[i]);sort(k.begin(),k.end());return adjacent_find(k.begin(),k.end())!=k.end();}
struct Commit{uint64_t id,ts;size_t pb,pe;};
int main(){string in;char buf[1<<16];size_t r;while((r=fread(buf,1,sizeof buf,stdin))>0)in.append(buf,r);
size_t p=0;auto nextLine=[&]()->string_view{size_t e=in.find('\n',p);if(e==string::npos)e=in.size();string_view s(in.data()+p,e-p);p=e<in.size()?e+1:e;return s;};
auto split=[&](string_view s,vector<string_view>&t){t.clear();size_t a=0;while(a<=s.size()){size_t b=s.find(' ',a);if(b==string_view::npos)b=s.size();t.push_back(s.substr(a,b-a));a=b+1;}};
long N=atol(string(nextLine()).c_str());vector<Commit> cs;vector<pair<string_view,string_view>> pairs;vector<string_view> tok;
for(long i=0;i<N;i++){split(nextLine(),tok);
 if(tok.size()<4||tok.size()%2||tok[0]!="id"||tok[2]!="timestamp"||!digits(tok[1])||!digits(tok[3]))continue;
 if(dupKeys(tok))continue;
 size_t pb=pairs.size();for(size_t j=4;j+1<tok.size();j+=2)pairs.push_back({tok[j],tok[j+1]});cs.push_back({num(tok[1]),num(tok[3]),pb,pairs.size()});}
int C=cs.size();par.resize(C);iota(par.begin(),par.end(),0);
unordered_map<string,int> anchor;anchor.reserve(pairs.size()*2+1);
for(int c=0;c<C;c++)for(size_t j=cs[c].pb;j<cs[c].pe;j++){string key(pairs[j].first);key+=' ';key+=pairs[j].second;
 auto it=anchor.try_emplace(move(key),c).first;int a=findRoot(c),b=findRoot(it->second);if(a!=b)par[a]=b;}
bool amb=false;{unordered_map<string,string_view> owner;owner.reserve(pairs.size()*2+1);
 for(int c=0;c<C&&!amb;c++){string pre=to_string(findRoot(c))+' ';for(size_t j=cs[c].pb;j<cs[c].pe;j++){auto it=owner.try_emplace(pre+string(pairs[j].first),pairs[j].second).first;if(it->second!=pairs[j].second){amb=true;break;}}}}
if(amb){fputs("AMBIGUOUS INPUT!\n",stdout);return 0;}
vector<vector<int>> group(C);for(int c=0;c<C;c++)group[findRoot(c)].push_back(c);
for(auto &g:group)sort(g.begin(),g.end(),[&](int a,int b){return cs[a].ts!=cs[b].ts?cs[a].ts<cs[b].ts:cs[a].id<cs[b].id;});
long R=atol(string(nextLine()).c_str());string out;
for(long q=0;q<R;q++){split(nextLine(),tok);uint64_t lo=num(tok[0]),hi=num(tok[1]);string key(tok[2]);key+=' ';key+=tok[3];
 auto it=anchor.find(key);if(it!=anchor.end()){const auto &g=group[findRoot(it->second)];
  auto s=lower_bound(g.begin(),g.end(),lo,[&](int c,uint64_t v){return cs[c].ts<v;});
  for(;s!=g.end()&&cs[*s].ts<=hi;++s){out+=to_string(cs[*s].id);out+=' ';}}
 out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误接受奇数个词的行并丢弃末尾词','language':'cpp','code':REFERENCE.replace('tok.size()<4||tok.size()%2||','tok.size()<4||')},
 {'name':'错误不检查同一行重复键','language':'cpp','code':REFERENCE.replace(' if(dupKeys(tok))continue;\n','')},
 {'name':'错误区间内只按提交编号排序','language':'cpp','code':REFERENCE.replace('for(;s!=g.end()&&cs[*s].ts<=hi;++s){out+=to_string(cs[*s].id);out+=\' \';}','vector<uint64_t> w;for(;s!=g.end()&&cs[*s].ts<=hi;++s)w.push_back(cs[*s].id);sort(w.begin(),w.end());for(auto x:w){out+=to_string(x);out+=\' \';}')},
 {'name':'错误忽略歧义直接回答查询','language':'cpp','code':REFERENCE.replace('if(amb){fputs("AMBIGUOUS INPUT!\\n",stdout);return 0;}','')},
 {'name':'错误把结束时间当作开区间','language':'cpp','code':REFERENCE.replace('cs[*s].ts<=hi','cs[*s].ts<hi')},
]
for x in MUTANTS:assert x['code']!=REFERENCE,x['name']
EDITORIAL='''## 题意整理

先筛掉格式错误的日志行，再把剩下的提交按“共享同一个 (路径, 不透明标识) 对”连成连通块，每个连通块就是一个仓库。若某个连通块里同一路径出现了两个不同的标识，整份输入有歧义，只输出 AMBIGUOUS INPUT!。否则对每个查询，找到包含该 (路径, 标识) 的仓库，输出时间戳落在闭区间 [start, end] 内的提交编号，按 (时间戳, 编号) 升序，每个编号后面跟一个空格。

## 合法行判定

按单个空格切词。合法行至少 4 个词且词数为偶数；第 1、3 个词分别是 id 和 timestamp；第 2、4 个词全是数字；所有键（id、timestamp 以及每一对里的路径）互不相同。任何一条不满足就整行丢弃，它的路径对既不参与连通也不参与歧义判断。

## 算法

1. 对合法提交逐一编号，用并查集维护连通块。用哈希表记录每个 (路径, 标识) 第一次出现的提交，之后再出现就和它合并。
2. 全部合并结束后，再扫描每个提交的每个路径对，以 (根, 路径) 为键记录标识；遇到不同标识即判定歧义。必须在合并完成后再检查，因为两条提交可能先各自属于不同块、之后才被第三条提交连通。
3. 每个连通块的提交按 (时间戳, 编号) 排序。查询时用哈希表找到锚点所在块，二分找到第一个时间戳 ≥ start 的位置，向后输出直到时间戳 > end。

## 正确性

并查集合并的边恰好是“共享同一路径对”的关系，因此最终的集合就是题目定义的连通块。歧义只取决于最终连通块里每条路径的标识集合，第 2 步对每个块检查了全部路径对。排序后时间戳在区间内的提交是连续的一段，二分加顺序扫描恰好输出它们，且顺序与要求一致。

## 复杂度

设合法行里的路径对总数为 P，查询输出编号总数为 K。合并与歧义检查期望 O(P·α)，排序 O(N log N)，每个查询 O(log N + 答案数)，总计 O((N+P)·α + N log N + R log N + K)。

## 独立验证

oracle 用正则表达式判定合法行，用“提交—路径对”二部图 BFS 求连通块，再按块逐路径收集标识集合判歧义，查询时对整个块过滤后排序，不使用并查集或二分。穷举 1..3 条合法提交、路径 {f,g}、标识 {1,2}、时间戳 {1,2} 的全部组合并逐个运行参考程序；随机数据混入各种格式错误行（前缀错误、非数字、奇数词数、重复键、过短）。五个错误程序（接受奇数词行、不查重复键、只按编号排序、忽略歧义、结束时间开区间）都正常退出并被正式数据判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
VALID=re.compile(r'id (0|[1-9][0-9]*) timestamp (0|[1-9][0-9]*)((?: [^ ]+ [^ ]+)*)')
def parse(line):
 m=VALID.fullmatch(line)
 if not m:return None
 rest=m.group(3).split(' ')[1:] if m.group(3) else []
 keys=['id','timestamp']+rest[0::2]
 if len(set(keys))!=len(keys):return None
 return int(m.group(1)),int(m.group(2)),list(zip(rest[0::2],rest[1::2]))
WORD=re.compile(r'[!-~]+')
NUM=re.compile(r'0|[1-9][0-9]*')
def encode(logs,queries):
 assert 0<=len(logs)<=MAXN and 0<=len(queries)<=MAXR
 ids=set();anchors=set()
 for line in logs:
  ws=line.split(' ');assert all(WORD.fullmatch(w) for w in ws),line
  for w in ws:
   if w.isdigit():assert NUM.fullmatch(w) and int(w)<=I63,line
  c=parse(line)
  if c:assert c[0] not in ids,'duplicate valid id';ids.add(c[0]);anchors.update(c[2]);assert 'id' not in [p for p,_ in c[2]] and 'timestamp' not in [p for p,_ in c[2]]
 for s,e,pth,o in queries:assert 0<=s<=I63 and 0<=e<=I63 and (pth,o) in anchors and WORD.fullmatch(pth) and WORD.fullmatch(o)
 raw=f'{len(logs)}\n'+''.join(l+'\n' for l in logs)+f'{len(queries)}\n'+''.join(f'{s} {e} {pth} {o}\n' for s,e,pth,o in queries)
 assert len(raw)<=MAXIN
 return raw
def solve(logs,queries):
 commits=[c for c in map(parse,logs) if c]
 by_anchor=defaultdict(list)
 for i,(_,_,pairs) in enumerate(commits):
  for pr in pairs:by_anchor[pr].append(i)
 comp=[-1]*len(commits);members=[]
 for s in range(len(commits)):
  if comp[s]>=0:continue
  k=len(members);comp[s]=k;dq=deque([s]);mem=[];used=set()
  while dq:
   x=dq.popleft();mem.append(x)
   for pr in commits[x][2]:
    if pr in used:continue
    used.add(pr)
    for y in by_anchor[pr]:
     if comp[y]<0:comp[y]=k;dq.append(y)
  members.append(mem)
 for mem in members:
  seen=defaultdict(set)
  for x in mem:
   for pth,o in commits[x][2]:seen[pth].add(o)
  if any(len(v)>1 for v in seen.values()):return AMB+'\n'
 ordered=[sorted((commits[x][1],commits[x][0]) for x in mem) for mem in members];keys_ts=[[t for t,_ in o] for o in ordered]
 out=[];total=0
 for s,e,pth,o in queries:
  k=comp[by_anchor[(pth,o)][0]];ts=keys_ts[k];hit=ordered[k][bisect_left(ts,s):bisect_right(ts,e)] if s<=e else []
  total+=len(hit);out.append(''.join(f'{cid} ' for _,cid in hit)+'\n')
 assert total<=MAXIDS
 return ''.join(out)
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw.encode(),capture_output=True,check=True,timeout=30);assert not p.stderr
 return p.stdout.decode(),round(time.perf_counter()-start,5)
def vline(cid,ts,pairs):return f'id {cid} timestamp {ts}'+''.join(f' {a} {b}' for a,b in pairs)
def malformed(rng,cid,ts,pairs):
 kind=rng.randrange(7)
 if kind==0:return vline(cid,ts,pairs).replace('id',rng.choice(['ID','Id','idx','commit']),1)
 if kind==1:return vline(cid,ts,pairs).replace('timestamp',rng.choice(['time','ts','Timestamp']),1)
 if kind==2:return rng.choice([f'id {cid} timestamp',f'id {cid}','id',f'timestamp {ts}',f'{cid} {ts}'])
 if kind==3:
  bad=rng.choice([f'{cid}a',f'a{cid}','x','1.5','0x1f',f'{cid}-'])
  return f'id {bad} timestamp {ts}'+''.join(f' {a} {b}' for a,b in pairs) if rng.random()<0.5 else f'id {cid} timestamp {bad}'+''.join(f' {a} {b}' for a,b in pairs)
 if kind==4:return vline(cid,ts,pairs)+' '+rng.choice(['dangling','f','zz'])
 if kind==5:
  ps=list(pairs) or [('f','1')]
  a=rng.choice(ps);return vline(cid,ts,ps+[(a[0],rng.choice(['1','2','zz',a[1]]))])
 return vline(cid,ts,pairs).replace(' timestamp ',' ',1)
def rand_case(rng,ncommit,paths,opaques,tsmax,bad_rate,pair_max,ambiguity_ok=True):
 logs=[];ids=rng.sample(range(10*ncommit+10),ncommit)
 for cid in ids:
  k=rng.randint(0,pair_max);ps=rng.sample(paths,min(k,len(paths)));pairs=[(p,rng.choice(opaques)) for p in ps]
  logs.append(vline(cid,rng.randint(0,tsmax),pairs))
  if rng.random()<bad_rate:
   ps=rng.sample(paths,min(rng.randint(0,pair_max),len(paths)));logs.append(malformed(rng,rng.choice(ids),rng.randint(0,tsmax),[(p,rng.choice(opaques)) for p in ps]))
 rng.shuffle(logs);return logs
def queries_for(rng,logs,count,tsmax):
 anchors=sorted({pr for c in map(parse,logs) if c for pr in c[2]})
 if not anchors:return []
 out=[]
 for _ in range(count):
  a,b=rng.randint(0,tsmax),rng.randint(0,tsmax)
  if rng.random()<0.85:a,b=min(a,b),max(a,b)
  out.append((a,b)+rng.choice(anchors))
 return out
def main():
 started=time.perf_counter();bound=[]
 for path,blob,raw_sha in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==raw_sha,path
  assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==blob
  bound.append({'path':path,'gitBlobSha':blob,'rawSha256':raw_sha})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 ex1=(['id 0 timestamp 10 foo a bar b','id 1 timestamp 20 bar b baz c','id 2 timestamp 15 qux d'],[(0,30,'bar','b'),(0,12,'foo','a'),(0,30,'qux','d')])
 ex2=(['id 0 timestamp 10 foo a bar b','id 1 timestamp 20 bar b baz c','id 2 timestamp 30 baz c foo x'],[(0,30,'foo','a')])
 ex3=(['id 7 timestamp 5 src/a.go v1','ID 8 timestamp 6 src/a.go v1','id 9 timestamp 5 src/a.go v1 lib v3','id 3 timestamp x lib v3','id 4 timestamp 8 lib v3 lib v4','id 5 timestamp 9 lib'],[(0,9,'lib','v3'),(6,6,'src/a.go','v1'),(9,0,'lib','v3')])
 assert solve(*ex1)=='0 1 \n0 \n2 \n' and solve(*ex2)==AMB+'\n' and solve(*ex3)=='7 9 \n\n\n'
 small=[ex1,ex2,ex3,
  ([],[]),(['id 1 timestamp 1'],[]),(['id 1 timestamp 1 a x','id 2 timestamp 1 a y'],[(0,5,'a','x'),(0,5,'a','y')]),
  (['id 5 timestamp 3 a x','id 2 timestamp 3 b y','id 9 timestamp 3 a x b y'],[(3,3,'a','x'),(0,2,'b','y'),(4,9,'a','x')]),
  (['id 1 timestamp 1 a x','id 2 timestamp 2 b y','id 3 timestamp 3 b y a z'],[(0,9,'a','x')]),
  (['id 1 timestamp 1 a x','id 1 timestamp 2 a x a y','idd 2 timestamp 2 a x a q'],[(0,9,'a','x')]),
  (['id 1 timestamp 1 a x','id 2 timestamp 2 a x b','id 3 timestamp 3 b y'],[(0,9,'a','x'),(0,9,'b','y')]),
  (['id 1 timestamp 1 a x','id 2 timestamp 2 c q a x a y','id 3 timestamp 3 a y'],[(0,9,'a','x'),(0,9,'a','y')]),
  ([f'id {I63} timestamp {I63} p q','id 0 timestamp 0 p q',f'id {I63-1} timestamp {I63} p q'],[(0,I63,'p','q'),(I63,I63,'p','q'),(1,I63-1,'p','q')]),
  (['id 4 timestamp 2 a x','id 3 timestamp 2 a x','id 10 timestamp 1 a x','id 2 timestamp 3 a x'],[(0,5,'a','x'),(2,2,'a','x'),(3,1,'a','x')]),
  (['id 1 timestamp 5 a x','id 2 timestamp 1a a x b y','id 3 timestamp 5 b z'],[(0,9,'a','x'),(0,9,'b','z')]),
  (['id 1 timestamp 1 m n','id 2 timestamp 2 o p','id 3 timestamp 3 m n o p','id 4 timestamp 4 o q'],[(0,9,'m','n')]),
  (['id 1 timestamp 1 k v','time 2 timestamp 2 k v','id 2 ts 2 k v','id 2 timestamp 2'],[(0,9,'k','v')]),
 ]
 rng=random.Random(SEED);keys={encode(*a) for a in small};assert len(keys)==len(small)
 while len(small)<185:
  n=rng.randint(1,9);paths=['f','g','h','src/x'][:rng.randint(1,4)];ops=['1','2','a'][:rng.randint(1,3)]
  logs=rand_case(rng,n,paths,ops,rng.choice([3,10]),0.4,3);qs=queries_for(rng,logs,rng.randint(0,5),10)
  a=(logs,qs);key=encode(*a)
  if key not in keys:keys.add(key);small.append(a)
 oracles=[{'input':encode(*a),'expectedOutput':solve(*a)} for a in small]
 namb=sum(o['expectedOutput']==AMB+'\n' for o in oracles);assert 20<=namb<=len(oracles)-60,namb
 cases=[];large=[]
 def add(name,a,hidden=True,big=False):
  raw=encode(*a);cases.append({'name':name,'input':raw,'expectedOutput':solve(*a),'hidden':hidden,'weight':1})
  if big:large.append(name)
 names=['原样例1','原样例2歧义','格式错误行被丢弃','空日志无查询','单提交无查询','不同标识不相连','三条提交经桥接连通','间接连通导致歧义','错误行不连通也不致歧义','奇数词行不连通','同行重复键','最大64位编号与时间戳','同时间戳按编号排序','非数字时间戳','链式连通','前缀与关键字错误']
 for i,a in enumerate(small[:len(names)]):add(names[i],a,i>=3)
 for i in range(len(names),len(names)+12):add(f'小规模随机{i-len(names)+1}',small[i])
 for t in range(4):
  groups=rng.randint(5,60);per=rng.randint(3,12);tsmax=10**rng.randint(3,12)
  table={(g,j):f'{g}x{rng.randrange(2)}' for g in range(groups) for j in range(per)}
  logs=[];ids=rng.sample(range(10**6),rng.randint(300,2000))
  for cid in ids:
   g=rng.randrange(groups);pairs=[(f'p{j}',table[g,j]) for j in rng.sample(range(per),rng.randint(0,2))]
   logs.append(vline(cid,rng.randrange(tsmax),pairs))
   if rng.random()<0.3:logs.append(malformed(rng,rng.choice(ids),rng.randrange(tsmax),[(f'p{j}',table[g,j]+rng.choice(['','y'])) for j in rng.sample(range(per),2)]))
  rng.shuffle(logs);add(f'中等规模多仓库{t+1}',(logs,queries_for(rng,logs,rng.randint(100,800),tsmax)))
 paths=[f'p{j}' for j in range(30)];logs=rand_case(rng,1500,paths,['o1','o2'],10**6,0.3,2)
 add('中等规模随机歧义',(logs,queries_for(rng,logs,300,10**6)))
 print(f'Headlands1 small/medium ready: {len(cases)} formal, {len(oracles)} oracle ({namb} ambiguous)',flush=True)
 # L1: max output ids with 19-digit ids/timestamps
 G=1000;S=200;ids=rng.sample(range(10**18,I63),MAXN);logs=[];comps=[]
 for g in range(G):
  base=rng.randrange(10**18,I63-10**17);tss=sorted(rng.randrange(base,base+10**17) for _ in range(S));comps.append(tss)
  for j in range(S):logs.append(vline(ids[g*S+j],tss[j],[(f'r{g}','k')]))
 rng.shuffle(logs);qs=[]
 for i in range(MAXR):
  g=rng.randrange(G);tss=comps[g];j=rng.randrange(S-15);qs.append((tss[j],tss[j+14],f'r{g}','k'))
 add('一百五十万个19位编号输出',(logs,qs),big=True);del logs,qs,comps
 # L2: heavy malformed mix, many components
 paths=[f'src/m{j}.go' for j in range(3000)];ops=['a','b']
 logs=[];pid=0
 for cid in rng.sample(range(10**9),150000):
  g=rng.randrange(30000);pairs=[(f'd{g}/x','h')]+([(f'd{rng.randrange(30000)}/y','h')] if rng.random()<0.05 else [])
  logs.append(vline(cid,rng.randrange(10**6),pairs))
 for _ in range(MAXN-150000):
  logs.append(malformed(rng,rng.randrange(10**9),rng.randrange(10**6),[(f'd{rng.randrange(30000)}/x',rng.choice(['h','q']))]))
 rng.shuffle(logs);add('五万格式错误行混入',(logs,queries_for(rng,logs,MAXR,10**6)),big=True);del logs
 # L3: ambiguity created only by the last valid line through a long chain
 n=100000;logs=[vline(i,i,[(f'c{i}','v'),(f'c{i+1}','v'),('root','r')] if i==0 else [(f'c{i}','v'),(f'c{i+1}','v')]) for i in range(n-1)]
 logs.append(vline(n-1,n-1,[(f'c{n-1}','v'),('root','s')]));add('长链末端引入歧义',(logs,[(0,3,'c5','v')]*10000),big=True);del logs
 # L4: single giant chain component, narrow windows
 n=MAXN;perm=rng.sample(range(n),n);logs=[vline(perm[i],rng.randrange(10**9),[(f'e{i}','z'),(f'e{i+1}','z')]) for i in range(n)]
 rng.shuffle(logs);qs=[]
 for _ in range(MAXR):
  lo=rng.randrange(10**9);qs.append((lo,lo+rng.randrange(20000),f'e{rng.randrange(n+1)}','z'))
 add('二十万提交单一连通块窄区间',(logs,qs),big=True);del logs,qs
 # L5: equal timestamps, ties by id, plus pairless commits
 logs=[];ids=rng.sample(range(10**12),MAXN)
 for i,cid in enumerate(ids):logs.append(vline(cid,rng.randrange(5),[(f'w{i%500}','t')] if i%7 else []))
 rng.shuffle(logs);qs=[(rng.randrange(5),rng.randrange(5,7),f'w{rng.randrange(500)}','t') for _ in range(2000)]
 add('大量相同时间戳与无路径提交',(logs,qs),big=True);del logs,qs
 print(f'Headlands1 prepared {len(cases)} formal ({len(large)} large), {len(oracles)} oracle; testing native programs',flush=True)
 assert 35<=len(cases)<=64 and len(oracles)>=160 and len(large)<=6
 big_stats=[]
 with tempfile.TemporaryDirectory(prefix='headlands1-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++17','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0;choices=[[]]+[[('f',o)] for o in '12']+[[('g',o)] for o in '12']+[[('f',a),('g',b)] for a in '12' for b in '12']
  for k in range(1,4):
   for combo in product(choices,repeat=k):
    for tss in product((1,2),repeat=k):
     logs=[vline(i,tss[i],combo[i]) for i in range(k)]
     anchors=sorted({pr for c in combo for pr in c})
     qs=[(a,b)+pr for pr in anchors for a,b in ((1,1),(1,2),(2,2),(2,1))]
     raw=encode(logs,qs);assert execute(binary,raw)[0]==solve(logs,qs);exhaustive+=1
  print(f'{exhaustive} exhaustive passed',flush=True)
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput']
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'],case['name']
   if case['name'] in large:big_stats.append({'name':case['name'],'logLinesAndQueries':[case['input'].split('\n',1)[0],str(case['input'].count('\n'))],'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++17','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput']:rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
   print(f'mutant {i+1} rejected on {len(rejected)} cases',flush=True)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Headlands OA #1：灾难恢复','difficulty':'困难','tags':['OA','Headlands','并查集','哈希表','字符串解析'],
 'description':'一次损坏的迁移之后，只剩一份全局日志记录了多个仓库上的提交。合法日志行的格式是 `id <commitId> timestamp <ts>`，后面跟零个或多个“文件路径 不透明标识”对，所有词之间用一个空格分隔。\n\n合法行必须同时满足：词数为偶数且至少为 4；第 1 个词是 id，第 3 个词是 timestamp；commitId 和 ts 是十进制非负整数；同一行中的键（id、timestamp 以及每一对中的文件路径）互不相同。不满足的行是格式错误行，直接丢弃，它既不连接任何提交，也不会导致歧义。\n\n如果两个合法提交含有完全相同的 (文件路径, 不透明标识) 对，它们属于同一个仓库；这种关系可以传递，仓库就是由此得到的连通块。如果某个连通块中同一个文件路径出现了两个不同的不透明标识，则整个输入有歧义。\n\n处理完所有日志后回答查询 `start end path opaqueId`：找到包含 (path, opaqueId) 的仓库，取其中时间戳在闭区间 [start, end] 内的提交，按时间戳升序、相同时按提交编号升序输出编号。若输入有歧义，忽略所有查询，只输出一行 AMBIGUOUS INPUT!。',
 'input':'第一行整数 N，接下来 N 行，每行一条日志（非空，词之间恰好一个空格，行首行尾没有空格）。然后一行整数 R，接下来 R 行，每行一个查询 `start end path opaqueId`。\n\n0≤N≤200000，0≤R≤100000，输入总长度不超过 3·10^7 字节。每个词由 ASCII 可见字符组成；由纯数字组成的词没有多余前导零且不超过 2^63−1。合法行中的 commitId 互不相同（格式错误行中的编号可能与之重复）。每个查询的 start、end 是 0..2^63−1 的整数，(path, opaqueId) 至少在一条合法日志行中出现。若输入无歧义，所有查询输出的编号总数不超过 2·10^6。',
 'output':'若输入有歧义，只输出一行 AMBIGUOUS INPUT!。否则输出 R 行，第 i 行依次输出第 i 个查询的提交编号，每个编号后面紧跟一个空格；没有符合条件的提交时输出空行。输出按字符逐一比较。',
 'explanation':'样例 1：提交 0 和 1 共享 bar b，属于同一仓库；提交 2 单独成库。第一个查询输出 "0 1 "，第二个查询区间 [0,12] 只含提交 0，第三个输出 "2 "。\n样例 2：三条提交通过 bar b、baz c 连通，但 foo 同时对应 a 和 x，输入有歧义。\n样例 3：第 2 行首词是 ID、第 4 行时间戳不是数字、第 5 行重复了键 lib、第 6 行词数为奇数，都被丢弃。提交 7 与 9 共享 src/a.go v1 而连通；第二个查询区间 [6,6] 内没有提交，第三个查询 start>end，都输出空行。',
 'hints':['先严格判断每行是否合法，再处理连通关系。','用哈希表记录每个 (路径, 标识) 第一次出现的提交，并查集合并。','合并全部完成后再检查歧义；每个块按 (时间戳, 编号) 排序，查询时二分。'],
 'timeLimit':3,'memoryLimit':524288,'outputLimit':65536,'checker':'exact','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 total=len(normalized.encode());assert total<=95*1024*1024,total
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'严格解析 + 并查集连通块 + 块内二分','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':bound,'upstreamCodeExecuted':False,
  'rangeDisclosure':'Original: 0<=N<=10^7 log lines, 0<=R<=10^5 queries, no bound on line length, total tokens or total answer size (R*N ids possible). Reduced: N<=2*10^5, R<=10^5 kept, total input<=3*10^7 bytes (fits 32MiB), total ids over all query answers<=2*10^6 (19-digit ids -> ~40MB, fits 64MiB). Value domain kept: ids/timestamps 0..2^63-1 (the conservative reading of "non-negative 64-bit"), digit words without redundant leading zeros.',
  'ruleFormalization':['Valid line = single-space separated words, even count>=4, word1=="id", word3=="timestamp", words2/4 decimal digits, all keys (id, timestamp, every path) distinct; anything else is malformed and discarded (source: "space-delimited words with unique keys per line", "first two keys are always id and timestamp", "non-negative 64-bit integers", "Malformed log entries should be discarded").','Ambiguity is evaluated on the final connected components.','Every response line keeps the trailing space after each id ("0 1 "), an empty answer is an empty line; exact checker.','Inputs guarantee every query anchor occurs in a valid line, avoiding the unspecified behaviour for unknown anchors; tests never use path names id/timestamp.'],
  'corrections':['Third public sample is authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'连通/歧义/过滤规则与两例一致；N缩到2e5并限定输入总长与答案编号总数；并查集参考解，正则解析+二部图BFS oracle独立核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'ambiguousOracleCases':namb,'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Regex full-match line validation; bipartite commit/anchor BFS components; per-component path->opaque sets for ambiguity; per-query full component filter and sort.','exhaustiveSmallDomain':{'cases':exhaustive,'commits':'1..3','paths':['f','g'],'opaque':['1','2'],'timestamps':[1,2]},'largeBoundaries':big_stats,'packageBytes':total,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Headlands1 frozen: {len(cases)} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} bytes={total}',flush=True)
if __name__=='__main__':main()
