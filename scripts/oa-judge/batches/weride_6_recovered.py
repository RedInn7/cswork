#!/usr/bin/env python3
"""Original bounded tree domain; direct path-character oracle and offline mask groups."""
from pathlib import Path
from collections import Counter,deque
from itertools import product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-weride-6';BATCH='weride-6-recovered';SEED=20261112
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='f7af280f6282fa7c9e2cc754dcaa39f0834215ceec9d085d4f40f651dbbc2400'
SOURCES=[
('OA LIST/WeRide_OA/018_image.txt','60e08aa15f26cec1994760590d812c3eda9f9e25','abdffe3274e9e08fffc9091d40b778623b9e692c44b741aabcf03ca8de5a412c'),
('OA LIST/WeRide_OA/019_image.txt','791dde21879a36414a80399dc1216d38572e65f0','0a2068ec96f3d2c5729244c3edfdfc73e6d3e0299cd8406c4569776913be5412'),
('OA LIST/WeRide_OA/020_image.txt','eff18898a415dc151bef25a879fb4cc4688a068d','4a1baf5eeff87735ce88bd972aec0f4ecd5e48a99b2309e6c966453b90dc8eb0'),
('OA LIST/WeRide_OA/021_image.txt','3d697dc276e0f1eadaa97786baf4508f64089730','ca7131c005a287b6cd3db41501619fcc4da688643ea6b951fec84c7166008cdd'),
('OA LIST/WeRide_OA/022_image.txt','cb276ca624f9ab0c3df1c8cf0db2a26c3561adb3','2a8aeb1195ecf413a5ad34907b9c0887231bdcd0c8af7eb17623aac20ce62cff'),
('OA LIST/WeRide_OA/023_image.txt','2c494a438ad9154456419cb4cc9fcf1bf4d5b0eb','d9b53dcbf8db8eb47d37383ab83dccda555379fc2140c643bc00edbb3f86eeab'),
('OA LIST/WeRide_OA/024_image.txt','0e4cfd788ef7c3fb4e910a5f6ac4e186f3638699','211ba80ea640c19d287d019f3c423dc15cda05aa59051f6b8d046e83f71f9d19'),
]
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <unordered_map>
#include <chrono>
#include <cstdint>
using namespace std;
struct Hash{static uint64_t mix(uint64_t x){x+=0x9e3779b97f4a7c15ULL;x=(x^(x>>30))*0xbf58476d1ce4e5b9ULL;x=(x^(x>>27))*0x94d049bb133111ebULL;return x^(x>>31);}size_t operator()(int x)const{static const uint64_t seed=chrono::steady_clock::now().time_since_epoch().count();return mix(uint64_t(x)+seed);}};
int readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();int x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return x;}
struct Edge{int to,weight;};
int main(){
 int n=readNumber(),m=readNumber();vector<vector<Edge>>adj(n);
 for(int i=0;i<m;i++){int u=readNumber()-1,v=readNumber()-1,w=readNumber()-1;adj[u].push_back({v,w});adj[v].push_back({u,w});}
 vector<int>parent(n,-1),mask(n),order(1,0);parent[0]=0;
 for(size_t i=0;i<order.size();i++){int u=order[i];for(auto e:adj[u])if(e.to!=parent[u]){parent[e.to]=u;mask[e.to]=mask[u]^(1<<e.weight);order.push_back(e.to);}}
 unordered_map<int,long long,Hash>seen;seen.reserve(n*2);long long answer=0;
 for(int u:order){int x=mask[u];auto same=seen.find(x);if(same!=seen.end())answer+=same->second;
  for(int b=0;b<26;b++){auto it=seen.find(x^(1<<b));if(it!=seen.end())answer+=it->second;}
  seen[x]++;
 }
 printf("%lld\n",answer);
}
'''
# Wrong no-rearrangement model: only accepts paths consisting of a single repeated letter.
MONO=r'''#include <cstdio>
#include <vector>
#include <numeric>
using namespace std;
struct E{int u,v,w;};
int find(vector<int>&p,int x){while(p[x]!=x){p[x]=p[p[x]];x=p[x];}return x;}
int main(){int n,m;scanf("%d%d",&n,&m);vector<E>edges(m);for(auto &e:edges){scanf("%d%d%d",&e.u,&e.v,&e.w);--e.u;--e.v;}
long long ans=0;vector<int>p(n),size(n);
for(int w=1;w<=26;w++){iota(p.begin(),p.end(),0);fill(size.begin(),size.end(),1);
for(auto e:edges)if(e.w==w){int a=find(p,e.u),b=find(p,e.v);if(a!=b){if(size[a]<size[b])swap(a,b);ans+=1LL*size[a]*size[b];p[b]=a;size[a]+=size[b];}}}
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误把无序点对按两个方向计数','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",answer);','printf("%lld\\n",2*answer);')},
 {'name':'错误加入每个节点与自身的空路径','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",answer);','printf("%lld\\n",answer+n);')},
 {'name':'错误禁止重排并过度限定原路径必须为同一字母','language':'cpp','code':MONO},
]
EDITORIAL='''## 原始OCR、样例与完整范围

固定提交e66f809f4c953bce129f68491726176615db6afc的OA LIST/WeRide_OA/018–024给出完整numNicePairs问题：一棵无向树，边权1..26对应a..z；两个不同节点之间唯一最短路径的边字母可以任意重排，若能成为回文，称为nice pair。统计无序的不同节点对。023/024的五节点全A树给出10并列出全部不同点对，明确排除自配对和双向重复计数。

020/021原始约束完整：1≤n≤100000、m=n−1、端点1..n、边权1..26，树的直径严格小于1000（按边数）。不删除直径限制；因此十万节点长链非法，不能拿它当正式满域测试。输入直接保留021标准协议：n m，然后m行u v w，节点统一1-based。n=1合法且答案0。返回long，最大为100000×99999/2=4999950000，需要64位。

三个公开例分别完整保留019的9、021/022的7、023/024的10。注意018示意树边为1–2、2–3、2–4、3–5，而019示意树为1–2、2–3、3–4、3–5，虽然权值同为2,1,1,1，拓扑不同，不能把019的9套到018。本站把018作为单独隐藏测试，独立逐对计算答案8；公开题解明确区分两图，而不混搭来源。例019中的BAA需要重排为ABA，这直接说明不是仅判断原路径字符串是否已经回文。

## 思路

任意选择根，为每个节点计算根到该节点路径上26种字母出现次数的奇偶掩码。树上u到v路径的掩码等于两根路径掩码的异或，因为公共部分出现两次而抵消。一个字符串可重排成回文，当且仅当奇数频次的字符至多一种，所以两掩码相等或只相差一位时点对合法。

遍历节点，用哈希表保存已经见过的各掩码频数。查询当前掩码及翻转26个位得到的掩码，累加频数，再把当前节点加入表。使用迭代遍历避免递归栈依赖。

## 正确性证明

回文除可能的中间字符外，其余位置均两两对应，因此至多一种字符频次为奇数是必要条件。反之，把每种字符的一半放在左边、反序放在右边，唯一可能的奇数字符放中间，即可构造回文，故条件也充分。

树上两根路径从根到公共祖先的部分被异或两次而消失，剩余边恰为u到v的唯一路径。因此路径奇偶条件等价于mask[u] XOR mask[v]的置位数至多1，也等价于掩码相等或差一个比特。

处理当前节点前哈希表仅包含先前节点，27种查询掩码互不相同，恰好枚举所有与当前节点合法的先前节点。查询后才插入，故不会计自身。每个无序不同节点对只会在后处理端点时检查一次，所以没有遗漏和重复，最终累加值正确。

## 复杂度

遍历和建图O(n)，每节点27次哈希查询，期望时间O(26n)，空间O(n)；采用运行时种子的SplitMix64散列，避免固定整数哈希被预制同桶掩码轻易攻击。哈希复杂度仍是期望值而非确定性最坏界。满n随机树和重编号树检验大量不同掩码，验证记录其实际种类数。掩码只需26位，计数和答案用64位。原生参考题包3秒/256MiB，完整原范围与直径约束不缩减。

## 独立验证

小oracle对每个起点遍历树，显式复制26维路径频次，在到达更大编号端点时直接统计奇数频次，完全不使用根掩码或哈希配对。163唯一小输入真实运行原生参考。额外穷举n≤5的递增父节点树、二字母边权，用独立路径计数验证。

大域oracle从另一个根出发，先计算所有掩码后按频数离线分组：相同掩码贡献f(f−1)/2，差一位的两组只按较小掩码侧贡献f·g，不使用参考的在线先查后插入流程。全单字母树额外用n(n−1)/2闭式，星形树用n−1+ΣC(同字母叶数,2)闭式。全部输入生成时检查连通、无环、边数以及两次BFS得到的真实直径。满n覆盖星形、平衡树、全部26字母、随机重编号，以及直径999的扫帚树，不使用非法满长链。负控包括有序双计、自配对和错误单色路径限制；所有正式负控均须正常退出。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def adjacency(n,edges):
 a=[[] for _ in range(n)]
 for u,v,w in edges:a[u-1].append((v-1,w-1));a[v-1].append((u-1,w-1))
 return a
def diameter(a):
 def far(start):
  d=[-1]*len(a);d[start]=0;q=deque([start]);last=start
  while q:
   u=q.popleft();last=u
   for v,_ in a[u]:
    if d[v]<0:d[v]=d[u]+1;q.append(v)
  assert all(x>=0 for x in d)
  return last,d[last]
 return far(far(0)[0])[1]
def encode(n,edges):
 assert 1<=n<=100000 and len(edges)==n-1
 assert all(1<=u<=n and 1<=v<=n and u!=v and 1<=w<=26 for u,v,w in edges)
 assert len({tuple(sorted((u,v))) for u,v,w in edges})==n-1
 assert diameter(adjacency(n,edges))<1000
 return f'{n} {n-1}\n'+''.join(f'{u} {v} {w}\n' for u,v,w in edges)
def brute(n,edges):
 a=adjacency(n,edges);answer=0
 for start in range(n):
  stack=[(start,-1,[0]*26)]
  while stack:
   u,parent,counts=stack.pop()
   if u>start and sum(x%2 for x in counts)<=1:answer+=1
   for v,w in a[u]:
    if v!=parent:
     nxt=counts[:];nxt[w]+=1;stack.append((v,u,nxt))
 return answer
def grouped(n,edges,stats=None):
 a=adjacency(n,edges);stack=[(n-1,-1,0)];freq=Counter()
 while stack:
  u,parent,mask=stack.pop();freq[mask]+=1
  for v,w in a[u]:
   if v!=parent:stack.append((v,u,mask^(1<<w)))
 if stats is not None:stats['distinctRootMasks']=len(freq)
 answer=sum(f*(f-1)//2 for f in freq.values())
 for mask,f in freq.items():
  for b in range(26):
   other=mask^(1<<b)
   if other>mask:answer+=f*freq.get(other,0)
 return answer
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def main():
 start=time.perf_counter();evidence=[]
 for path,blob,h in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==h
  assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==blob
  evidence.append({'path':path,'gitBlobSha':blob,'rawSha256':h})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=[(5,[(1,2,2),(2,3,1),(3,4,1),(3,5,1)]),(5,[(1,2,1),(1,3,2),(2,4,1),(2,5,2)]),(5,[(1,2,1),(1,3,1),(2,4,1),(2,5,1)]),(5,[(1,2,2),(2,3,1),(2,4,1),(3,5,1)]),(1,[]),(2,[(1,2,26)]),(4,[(1,2,1),(2,3,2),(3,4,1)]),(4,[(1,2,1),(2,3,2),(3,4,3)])]
 assert [brute(n,e) for n,e in small[:4]]==[9,7,10,8]
 rng=random.Random(SEED);keys={encode(n,e) for n,e in small}
 while len(small)<163:
  n=rng.randint(2,14);edges=[(rng.randint(1,v-1),v,rng.choice([1,2,3,25,26])) for v in range(2,n+1)];rng.shuffle(edges);raw=encode(n,edges)
  if raw not in keys:keys.add(raw);small.append((n,edges))
 exhaustive=0
 for n in range(1,6):
  for parents in product(*(range(1,v) for v in range(2,n+1))):
   for labels in product((1,2),repeat=n-1):
    edges=[(p,v,w) for v,(p,w) in enumerate(zip(parents,labels),2)];encode(n,edges)
    assert brute(n,edges)==grouped(n,edges);exhaustive+=1
 cases=[];oracles=[];large=[]
 with tempfile.TemporaryDirectory(prefix='weride6-native-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  for i,(n,edges) in enumerate(small):
   raw=encode(n,edges);expected=brute(n,edges);assert expected==grouped(n,edges);assert execute(binary,raw)[0]==str(expected)
   oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
   if i<30:cases.append({'name':f'原OCR公开例{i+1}' if i<3 else ('018另一拓扑答案8' if i==3 else f'逐对路径核验{i}'),'input':raw,'expectedOutput':str(expected)+'\n','hidden':i>=3,'weight':1})
  print(f'WeRide6:163 unique subprocess oracles and{exhaustive} exhaustive trees passed',flush=True)
  for mode in ('star-one','star-26','balanced-one','balanced-26','broom999-one','broom999-26','random26','relabeled-random'):
   n=100000;closed=None
   if mode.startswith('star'):
    edges=[(1,v,1 if mode.endswith('one') else (v-2)%26+1) for v in range(2,n+1)];freq=Counter(w for _,_,w in edges);closed=n-1+sum(f*(f-1)//2 for f in freq.values())
   elif mode.startswith('balanced'):edges=[(v//2,v,1 if mode.endswith('one') else v%26+1) for v in range(2,n+1)]
   elif mode.startswith('broom'):
    edges=[(v-1,v,1 if mode.endswith('one') else v%26+1) for v in range(2,1000)]
    edges.extend((999,v,1 if mode.endswith('one') else v%26+1) for v in range(1000,n+1))
   else:
    # Parent in earlier half ensures depth at most18 even after relabeling.
    edges=[(rng.randint(1,max(1,v//2)),v,rng.randint(1,26)) for v in range(2,n+1)]
    if mode.startswith('relabeled'):
     labels=list(range(1,n+1));rng.shuffle(labels);edges=[(labels[u-1],labels[v-1],w) for u,v,w in edges];rng.shuffle(edges)
   if mode.endswith('one'):closed=n*(n-1)//2
   raw=encode(n,edges);d=diameter(adjacency(n,edges));stats={};expected=grouped(n,edges,stats)
   if closed is not None:assert closed==expected
   if mode.startswith('broom'):assert d==999
   out,seconds=execute(binary,raw);assert out==str(expected)
   cases.append({'name':f'满n-{mode}','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
   large.append({'name':mode,'n':n,'m':n-1,'diameter':d,'inputBytes':len(raw),'expected':expected,'distinctRootMasks':stats['distinctRootMasks'],'closedFormChecked':closed is not None,'oracle':'offline frequency groups rooted at n; same-mask combinations and one-bit group products','localSeconds':seconds})
  kills=[]
  for i,m in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{i}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(m['code']);mb=Path(td)/f'mutant{i}';subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True)
   rejected=[j for j,c in enumerate(cases) if execute(mb,c['input'])[0]!=c['expectedOutput'].strip()];assert rejected;kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 assert len({c['input'] for c in cases})==len(cases)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'树上可重排回文的无序点对','difficulty':'困难','tags':['OA','WeRide','树','位运算','哈希表'],
 'description':'一棵无向树的边权1..26对应a..z。对两个不同节点，取它们之间唯一路径的全部边字母；若这些字母可以任意重排成回文，则该无序节点对为nice pair。求所有nice pair数量。路径字符串不必原本就是回文，不计自己与自己，也不重复计算两个方向。',
 'input':'第一行n m，之后m行u v w。完整原约束：1≤n≤100000，m=n−1，1≤u,v≤n，1≤w≤26；输入保证构成树，直径按边数严格小于1000。节点编号1-based。',
 'output':'输出无序不同节点nice pair数量，使用64位整数；单节点树输出0。',
 'explanation':'三个公开例分别保留019的9、021/022的7、023/024的10。019中BAA可重排为ABA，因此也计数；五节点全A树有C(5,2)=10对。018另有不同拓扑，真实答案8，本站单独覆盖，不把它和019的9混搭。',
 'hints':['回文重排只需要检查频次奇偶。','两个根路径奇偶掩码异或得到节点间路径掩码。','先查询已见节点，再插入当前节点，排除自身和双计。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'路径奇偶掩码与无序配对','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':evidence,'upstreamCodeExecuted':False,'corrections':['018 and019 have different topology;019=9 retained publicly,018=8 independently derived as separate case.','021/022=7 and023/024=10 preserved. All-A example establishes unordered distinct endpoints, no self-pairs.'],'rangeDisclosure':'020/021 explicitly n1..100000,m=n-1,endpoints1..n,weights1..26,diameter<1000; every generated formal and oracle input checked for these full constraints.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'固定OCR018–024明确可重排回文、无序不同端点及完整范围含直径<1000。分离018/019不同拓扑，保留原9/7/10，逐对频次oracle与满n离线分组/闭式验证支持完整域。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Every pair path with explicit26-letter frequencies; full scale alternate-root offline mask groups and closed forms.','exhaustiveSmallDomain':{'cases':exhaustive,'nMin':1,'nMax':5,'weights':[1,2],'parentOfV':'all choices1..v-1'},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
 print(f'WeRide6 frozen:{len(cases)}formal,163oracle,{exhaustive}exhaustive,3mutants;normalizedBytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
