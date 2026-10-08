#!/usr/bin/env python3
"""Effective role privileges over a grant DAG: bitset topological propagation versus ancestor search."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,string
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-snowflake-24';BATCH='snowflake-24-recovered';SEED=20261008
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCES=[
 ('fastprep/Snowflake/snowflake-effective-role-privileges.md','57e33e55736f4bc94a8f2f8fa8d76ac12d378bc5','28dcf8f6d5fb95f05416361fc880ac39a038114c2e9055f0f2386638bbdeb68b'),
 ('web/content/docs/companies/snowflake.mdx','1091a782a0f60117925eb1a9a96ee4cf9df4e5bb','a2cd5b9918339feb1b7715d70c79a1cbf064f9a5358fe7f97bebeb5b5bb171c0'),
]
HASH='380aa48c67723ecba4e049ab69a72bf1f9b7ea6339d6eee0f13e05c596a195a7'
MAXN,MAXM,MAXK,MAXP,MAXL=2000,200000,200000,2000,10
REFERENCE=r'''#include <cstdio>
#include <cstdint>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;
vector<vector<string>> own(n);vector<string> all;char buf[64];
for(int i=0;i<n;i++){int k;scanf("%d",&k);own[i].resize(k);for(auto &s:own[i]){scanf("%63s",buf);s=buf;all.push_back(s);}}
sort(all.begin(),all.end());all.erase(unique(all.begin(),all.end()),all.end());
int P=all.size(),W=(P+63)/64;vector<uint64_t> bits((size_t)n*W+1,0);
for(int i=0;i<n;i++)for(auto &s:own[i]){int id=lower_bound(all.begin(),all.end(),s)-all.begin();bits[(size_t)i*W+id/64]|=1ULL<<(id%64);}
vector<vector<int>> g(n);vector<int> indeg(n,0);
for(int j=0;j<m;j++){int u,v;scanf("%d %d",&u,&v);g[u].push_back(v);indeg[v]++;}
vector<int> order;order.reserve(n);for(int i=0;i<n;i++)if(!indeg[i])order.push_back(i);
for(size_t h=0;h<order.size();h++){int u=order[h];for(int v:g[u]){uint64_t *a=&bits[(size_t)v*W];const uint64_t *b=&bits[(size_t)u*W];for(int w=0;w<W;w++)a[w]|=b[w];if(--indeg[v]==0)order.push_back(v);}}
string out;
for(int i=0;i<n;i++){const uint64_t *b=&bits[(size_t)i*W];int c=0;for(int w=0;w<W;w++)c+=__builtin_popcountll(b[w]);out+=to_string(c);
 for(int w=0;w<W;w++){uint64_t x=b[w];while(x){int t=__builtin_ctzll(x);x&=x-1;out+=' ';out+=all[w*64+t];}}out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
'''
CASEFOLD_SORT=REFERENCE.replace('#include <algorithm>','#include <algorithm>\n#include <cctype>\nstatic bool lessFold(const std::string&a,const std::string&b){std::string x=a,y=b;for(auto&c:x)c=tolower(c);for(auto&c:y)c=tolower(c);return x!=y?x<y:a<b;}').replace('sort(all.begin(),all.end());','sort(all.begin(),all.end(),lessFold);').replace('lower_bound(all.begin(),all.end(),s)','lower_bound(all.begin(),all.end(),s,lessFold)')
MUTANTS=[
 {'name':'错误只继承直接父角色的直属权限','language':'cpp','code':REFERENCE.replace('const uint64_t *b=&bits[(size_t)u*W];','const uint64_t *b=&base[(size_t)u*W];').replace('vector<vector<int>> g(n);','vector<uint64_t> base=bits;vector<vector<int>> g(n);')},
 {'name':'错误按输入顺序逐条合并授权边','language':'cpp','code':REFERENCE.replace('g[u].push_back(v);indeg[v]++;}','uint64_t *a=&bits[(size_t)v*W];const uint64_t *b=&bits[(size_t)u*W];for(int w=0;w<W;w++)a[w]|=b[w];}').replace('for(size_t h=0;h<order.size();h++)','for(size_t h=order.size();h<order.size();h++)')},
 {'name':'错误把继承方向反过来','language':'cpp','code':REFERENCE.replace('scanf("%d %d",&u,&v);','scanf("%d %d",&v,&u);')},
 {'name':'错误按忽略大小写的顺序输出','language':'cpp','code':CASEFOLD_SORT},
]
for x in MUTANTS:assert x['code']!=REFERENCE,x['name']
EDITORIAL='''## 题意

每个角色的有效权限 = 自身直属权限 ∪ 所有祖先角色的直属权限。授权边 u→v 表示 v 继承 u，图保证无环，因此“祖先”沿边反向可达即可确定。每个角色输出去重后按字典序（ASCII 顺序）排列的权限。

## 思路：拓扑序 + 位集合并

把全部出现过的权限串排序去重，得到编号 0..P−1，编号顺序就是字典序。每个角色用一个 P 位的位集表示当前已知的权限，初值为直属权限。

用 Kahn 算法按拓扑序处理角色：取出入度为 0 的角色 u 时，它的所有父角色都已处理完，u 的位集已经是最终答案；对每条出边 u→v，把 u 的位集按字或并到 v 上，并把 v 的入度减一。

输出时按位从低到高枚举，编号顺序即字典序，天然去重。

## 正确性

对拓扑序归纳：u 出队时，所有边 w→u 的 w 都已出队并把自己的最终集合并入 u，因此 u 的集合等于直属权限 ∪ 每个父角色的有效权限，而父角色的有效权限又包含其全部祖先，所以恰好是 u 的全部祖先权限之并。重复的授权边只会重复做幂等的并集，不影响结果。

## 复杂度

排序权限串 O(S log S)，S 为直属权限总个数；每条边一次位集合并 O(P/64)，共 O(m·P/64)；输出与答案规模成正比。逐个元素合并哈希集合的做法在边多、权限多时会达到 O(m·P) 次插入，明显更慢。

## 独立验证

oracle 对每个角色沿反向边做 BFS 找出全部祖先，再直接求并集排序，不使用拓扑序；大数据另用 Python 大整数位集按父角色记忆化 DFS 计算。穷举 3 个角色上全部 25 种有标号 DAG 与每个角色 {∅,A,a,Aa} 四种直属权限组合，并逐个真实运行参考程序。错误程序（只看直接父角色、按输入顺序合并边、继承方向反向、忽略大小写排序）都正常退出且在正式数据上被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
PRINT=set(chr(c) for c in range(33,127))
def validate(n,privs,edges):
 assert 1<=n<=MAXN and len(privs)==n and 0<=len(edges)<=MAXM and sum(map(len,privs))<=MAXK
 distinct=set()
 for row in privs:
  for s in row:assert 1<=len(s)<=MAXL and set(s)<=PRINT;distinct.add(s)
 assert len(distinct)<=MAXP
 indeg=[0]*n;g=[[] for _ in range(n)]
 for u,v in edges:assert 0<=u<n and 0<=v<n and u!=v;g[u].append(v);indeg[v]+=1
 q=[i for i in range(n) if not indeg[i]]
 for u in q:
  for v in g[u]:
   indeg[v]-=1
   if not indeg[v]:q.append(v)
 assert len(q)==n,'not a DAG'
def encode(n,privs,edges):
 validate(n,privs,edges)
 return f'{n} {len(edges)}\n'+''.join(' '.join([str(len(r))]+list(r))+'\n' for r in privs)+''.join(f'{u} {v}\n' for u,v in edges)
def fmt(sets):return ''.join(' '.join([str(len(s))]+sorted(s))+'\n' for s in sets)
def brute(n,privs,edges):
 parents=[[] for _ in range(n)]
 for u,v in edges:parents[v].append(u)
 res=[]
 for v in range(n):
  seen={v};stack=[v]
  while stack:
   x=stack.pop()
   for p in parents[x]:
    if p not in seen:seen.add(p);stack.append(p)
  res.append(set().union(*(set(privs[x]) for x in seen)))
 return res
def closure_text(n,privs,edges):
 names=sorted({s for r in privs for s in r});idx={s:i for i,s in enumerate(names)}
 own=[0]*n
 for i,r in enumerate(privs):
  for s in r:own[i]|=1<<idx[s]
 parents=[[] for _ in range(n)]
 for u,v in edges:parents[v].append(u)
 memo=[None]*n
 for s in range(n):
  if memo[s] is not None:continue
  stack=[(s,0)]
  while stack:
   v,i=stack.pop()
   if i<len(parents[v]):
    stack.append((v,i+1));p=parents[v][i]
    if memo[p] is None:stack.append((p,0))
   else:
    acc=own[v]
    for p in parents[v]:acc|=memo[p]
    memo[v]=acc
 out=[]
 for b in memo:
  bs=bin(b)[2:][::-1];items=[names[i] for i,c in enumerate(bs) if c=='1']
  out.append(' '.join([str(len(items))]+items)+'\n')
 return ''.join(out)
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout,round(time.perf_counter()-start,5)
def tokens(s):return s.split()
def rand_word(rng,lo=1,hi=MAXL,alpha=string.ascii_letters+string.digits+'_.:-*'):return ''.join(rng.choice(alpha) for _ in range(rng.randint(lo,hi)))
def words(rng,count,lo=1,hi=MAXL,alpha=string.ascii_letters+string.digits+'_.:-*'):
 s=set()
 while len(s)<count:s.add(rand_word(rng,lo,hi,alpha))
 return sorted(s,key=lambda _:rng.random())
def random_dag(rng,n,m,allow_dup=False,tree=False,first=None):
 perm=list(range(n));rng.shuffle(perm)
 if first is not None:perm.remove(first);perm.insert(0,first)
 edges=[];seen=set()
 if tree:
  for i in range(1,n):
   u=perm[rng.randrange(i)];v=perm[i];edges.append((u,v));seen.add((u,v))
 tries=0
 while len(edges)<m and tries<50*m+100:
  tries+=1;i,j=rng.randrange(n),rng.randrange(n)
  if i==j:continue
  if i>j:i,j=j,i
  e=(perm[i],perm[j])
  if e in seen and not allow_dup:continue
  seen.add(e);edges.append(e)
 rng.shuffle(edges);return edges
def all_dags3():
 pairs=[(u,v) for u in range(3) for v in range(3) if u!=v];out=[]
 for mask in range(1<<len(pairs)):
  es=[pairs[i] for i in range(len(pairs)) if mask>>i&1]
  try:validate(3,[[],[],[]],es);out.append(es)
  except AssertionError:pass
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
 ex1=(3,[['A'],['B'],['C']],[(0,1),(1,2)])
 ex2=(4,[['READ'],['WRITE'],['DEPLOY'],['AUDIT']],[(0,2),(1,2),(2,3)])
 ex3=(3,[['A','A'],['A'],[]],[(0,1),(1,2)])
 assert fmt(brute(*ex1))=='1 A\n2 A B\n3 A B C\n'
 assert fmt(brute(*ex2))=='1 READ\n1 WRITE\n3 DEPLOY READ WRITE\n4 AUDIT DEPLOY READ WRITE\n'
 assert fmt(brute(*ex3))=='1 A\n1 A\n1 A\n'
 small=[ex1,ex2,ex3,
  (1,[[]],[]),(1,[['x','x','x']],[]),
  (3,[['b'],['a'],['B']],[(2,0),(1,0)]),
  (4,[['p'],['q'],['r'],['s']],[(3,2),(2,1),(1,0)]),
  (4,[['A'],[],[],['Z']],[(0,1),(0,2),(1,3),(2,3)]),
  (5,[['k'],['k'],['k'],['k'],[]],[(0,4),(0,4),(1,4),(2,4),(3,4)]),
  (3,[['a_'],['aZ'],['a']],[(0,1),(1,2)]),
  (4,[['*'],['-'],['9'],['~']],[(0,3),(1,3),(2,3)]),
  (6,[['x1'],['x2'],['x3'],[],[],[]],[(0,3),(1,4),(2,5)]),
  (4,[['C','B'],['B','A'],[],['D']],[(1,2),(0,2)]),
  (5,[[],[],[],[],['only']],[(4,3),(3,2),(2,1),(1,0)]),
 ]
 rng=random.Random(SEED);keys={encode(*a) for a in small};assert len(keys)==len(small)
 pool=['A','B','a','b','_','Ab','aB','z9','Z','~x']
 while len(small)<180:
  n=rng.randint(1,9);m=rng.randint(0,min(16,n*(n-1)//2+3))
  privs=[[rng.choice(pool) for _ in range(rng.randint(0,3))] for _ in range(n)]
  a=(n,privs,random_dag(rng,n,m,allow_dup=rng.random()<0.3));key=encode(*a)
  if key not in keys:keys.add(key);small.append(a)
 for a in small:assert closure_text(*a)==fmt(brute(*a))
 oracles=[{'input':encode(*a),'expectedOutput':fmt(brute(*a))} for a in small]
 cases=[];large=[]
 def add(name,a,hidden=True,big=False):
  raw=encode(*a);exp=closure_text(*a)
  cases.append({'name':name,'input':raw,'expectedOutput':exp,'hidden':hidden,'weight':1})
  if big:large.append(name)
 names=['原样例1','原样例2','原样例3','单角色无权限','单角色重复权限','多父角色与大小写顺序','边逆序给出的链','菱形继承','重复授权边','前缀与下划线顺序','符号字符顺序','互不相关的三条边','两个父角色合并','逆向编号的长链']
 for i,a in enumerate(small[:len(names)]):add(names[i],a,i>=3)
 for i in range(len(names),len(names)+12):add(f'小规模随机{i-len(names)+1}',small[i])
 # medium cases
 for t in range(4):
  n=rng.randint(30,200);P=words(rng,rng.randint(5,60),1,6)
  privs=[[rng.choice(P) for _ in range(rng.randint(0,4))] for _ in range(n)]
  add(f'中等规模随机DAG{t+1}',(n,privs,random_dag(rng,n,rng.randint(n,4*n),allow_dup=t%2==0)))
 n=300;P=words(rng,300,1,4);add('中等规模全部独立角色',(n,[[P[i]] for i in range(n)],[]))
 n=400;perm=list(range(n));rng.shuffle(perm);ch=[(perm[i],perm[i+1]) for i in range(n-1)];rng.shuffle(ch)
 P=words(rng,n,1,10);add('中等规模打乱编号的链',(n,[[P[i]] for i in range(n)],ch))
 print(f'Snowflake24 small/medium ready: {len(cases)} formal, {len(oracles)} oracle',flush=True)
 # large cases (6 max)
 N=MAXN
 P=words(rng,MAXP,MAXL,MAXL)
 root=rng.randrange(N);privs=[[] for _ in range(N)];privs[root]=list(P)
 add('全体角色继承全部2000个最长权限',(N,privs,random_dag(rng,N,MAXM,tree=True,first=root)),big=True)
 P=words(rng,MAXP,1,MAXL);perm=list(range(N));rng.shuffle(perm)
 ch=[(perm[i],perm[i+1]) for i in range(N-1)]
 seen=set(ch)
 while len(ch)<MAXM:
  i,j=sorted(rng.sample(range(N),2));e=(perm[i],perm[j])
  if e not in seen:seen.add(e);ch.append(e)
 rng.shuffle(ch);add('长链加稠密前向边',(N,[[P[i]] for i in range(N)],ch),big=True)
 P=words(rng,200,1,5);privs=[[rng.choice(P) for _ in range(100)] for _ in range(N)]
 add('稠密随机DAG与重复直属权限',(N,privs,random_dag(rng,N,MAXM)),big=True)
 P=words(rng,MAXP,1,3,string.ascii_letters+string.digits+'!#$%&*+-./:;<=>?@[]^_{|}~');privs=[[rng.choice(P) for _ in range(100)] for _ in range(N)]
 add('无授权边且直属权限含大量重复',(N,privs,[]),big=True)
 P=words(rng,500,1,4,'AaBbZz_09');tops=rng.sample(range(N),50);privs=[[] for _ in range(N)]
 for i,t in enumerate(tops):privs[t]=P[i*10:(i+1)*10]
 add('大量重复授权边的树形继承',(N,privs,random_dag(rng,N,MAXM,allow_dup=True,tree=True)),big=True)
 print(f'Snowflake24 prepared {len(cases)} formal ({len(large)} large), {len(oracles)} oracle; testing native programs',flush=True)
 assert 35<=len(cases)<=64 and len(oracles)>=160 and len(large)<=6
 big_stats=[]
 with tempfile.TemporaryDirectory(prefix='snowflake24-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++17','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0;letters=[[],['A'],['a'],['A','a']]
  for es in all_dags3():
   for combo in product(letters,repeat=3):
    a=(3,[list(c) for c in combo],es);e=fmt(brute(*a));assert closure_text(*a)==e
    assert execute(binary,encode(*a))[0]==e;exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput']
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'],case['name']
   if case['name'] in large:big_stats.append({'name':case['name'],'header':case['input'].split('\n',1)[0],'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++17','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if tokens(execute(mb,case['input'])[0])!=tokens(case['expectedOutput']):rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
   print(f'mutant {i+1} rejected on {len(rejected)} cases',flush=True)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Snowflake OA #24：角色有效权限','difficulty':'中等','tags':['OA','Snowflake','拓扑排序','位集','图'],
 'description':'有 n 个角色，编号 0..n−1，角色 i 有一组直属权限。授权关系 [u, v] 表示角色 v 继承角色 u 的全部权限，继承可以传递，授权关系构成有向无环图。\n\n一个角色的有效权限是它自己的直属权限加上它所有祖先角色的直属权限。对每个角色，求去重后的有效权限，并按字典序升序排列。',
 'input':'第一行两个整数 n 和 m。接下来 n 行，第 i 行先是整数 k，再是角色 i−1 的 k 个直属权限串（可能重复，k 可以为 0）。接下来 m 行，每行两个整数 u v，表示角色 v 继承角色 u。\n\n1≤n≤2000，0≤m≤200000，所有 k 之和不超过 200000；0≤u,v<n，授权图无环，同一授权可能重复出现。权限串是长度 1..10、由 ASCII 可见字符（33..126）组成的不含空格的串，不同权限串最多 2000 个。',
 'output':'输出 n 行，第 i 行对应角色 i−1：先输出有效权限个数 c，再按字典序（ASCII 顺序）输出 c 个互不相同的权限串，用空格分隔。',
 'explanation':'样例 1：角色 1 继承角色 0，角色 2 通过角色 1 间接继承角色 0，所以有效权限分别是 {A}、{A,B}、{A,B,C}。\n样例 2：角色 2 同时继承角色 0 和 1，角色 3 继承角色 2，因而得到全部四个权限。\n样例 3：角色 0 的直属权限 A 重复出现，去重后只保留一个；角色 2 没有直属权限，但继承得到 A。',
 'hints':['先把所有权限串排序编号，编号顺序就是输出顺序。','按拓扑序处理，父角色处理完后再把它的集合并给子角色。','用位集表示集合，一次合并只需 P/64 次字或。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':65536,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 total=len(normalized.encode());assert total<=95*1024*1024,total
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'拓扑序上的位集合并','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':bound,'upstreamCodeExecuted':False,
  'rangeDisclosure':'Original: 1<=privileges.length<=2*10^5, 0<=grants.length<=2*10^5, per-role list length, total privilege count and string length unbounded; output must list every inherited privilege explicitly, so a 2*10^5-role chain with distinct privileges needs ~2*10^10 output tokens. Reduced to fit the 64MiB per-case output budget: n<=2000 roles, distinct privilege strings<=2000, length<=10 (worst output 2000*2000*11 bytes ~44MB). Grant count bound 2*10^5 kept; total direct privileges capped at 2*10^5 to bound input. Privilege alphabet fixed to visible ASCII 33..126 (original: non-empty tokens without spaces), lexicographic = ASCII byte order.',
  'corrections':['Stdin/stdout adaptation: each output row is prefixed by its count so empty rows stay unambiguous under the tokens checker.','Duplicate grant edges are permitted (original does not forbid them; union is idempotent).']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'DAG继承语义与三例一致；为容纳显式输出把角色数与不同权限串数缩到2000，授权边保留2e5；位集拓扑传播参考解，反向BFS与记忆化大整数位集独立核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Per-role reverse BFS over parents with explicit set union; Python big-int bitset memoized DFS over parents cross-checked on every oracle input and used for formal expectations.','exhaustiveSmallDomain':{'cases':exhaustive,'roles':3,'labeledDags':25,'directPrivilegeChoices':[[],['A'],['a'],['A','a']]},'largeBoundaries':big_stats,'packageBytes':total,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Snowflake24 frozen: {len(cases)} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} bytes={total}',flush=True)
if __name__=='__main__':main()
