#!/usr/bin/env python3
"""Star sums: subset enumeration and independent weight-bucket full-domain oracle."""
from pathlib import Path
from itertools import combinations,product
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-akuna-capital-4';BATCH='akuna-4-recovered';SEED=20261107
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='43fc82aa2dcbb35e66d88a1f6cfd7a3cb8c5bb27560cff76c31559815a0cbd0d'
SOURCES=[
 ('OA LIST/Akuna_Capital_OA/007_1f89f5664c05d38034234003c6b487d6.txt','2646f142e6e7d020b6a213c9fbd94a2553e0ac77','b8ba79ca2788365c84c1f5665b80c4cf5eb376009ba75d8f55ee1f7efe5f3a3f'),
 ('OA LIST/Akuna_Capital_OA/012_QQ_1744468305300.txt','23f5b0163c9a959fed8a48f8a0e4b3a9f4d4f2de','0e246c0c722ad845f2c14d332ed6b1752a1a678a28f3615d91c3d1f770e4caf3'),
 ('OA LIST/Akuna_Capital_OA/013_QQ_1744468285462.txt','77511174494a800a84b022121b383f0bf90e7e95','87de68bdf32537c228a5173b95358a870e327720329bb719a7f105e7a537bc5e'),
 ('OA LIST/Akuna_Capital_OA/014_QQ_1744468332840.txt','e748fc8ed7a2bad3b04922adbaabed680c688a1e','1726638ac49d060bab7b0f0b0d7d60b63ec2cf55e639384f43c47f0f1eb2fc3b'),
]
REFERENCE='''import sys

def solve(raw):
    data=list(map(int,raw.split()))
    n,m,k=data[:3]
    values=data[3:3+n]
    neighbors=[[] for _ in range(n)]
    for i in range(3+n,len(data),2):
        u,v=data[i:i+2]
        if values[v]>0: neighbors[u].append(values[v])
        if values[u]>0: neighbors[v].append(values[u])
    answer=max(values)
    for center in range(n):
        neighbors[center].sort(reverse=True)
        answer=max(answer,values[center]+sum(neighbors[center][:k]))
    return str(answer)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
 {'name':'错误把最多k臂变成最多k节点','code':REFERENCE.replace('[:k]','[:max(0,k-1)]')},
 {'name':'错误强制选择负权邻居','code':REFERENCE.replace('if values[v]>0:','if True:').replace('if values[u]>0:','if True:')},
 {'name':'错误将无向边当成单向边','code':REFERENCE.replace('if values[u]>0: neighbors[v].append(values[u])','if False: neighbors[v].append(values[u])')},
]
EDITORIAL='''## 原OCR与编号统一

固定提交e66f809f4c953bce129f68491726176615db6afc的Akuna_Capital_OA/007、012–014给出同一bestSumKStar任务：无向简单图、节点权值、非空星形子图，至多k条臂，求最大节点权值和。012明确端点0..n−1，013正式样例也使用0-based。007早期示意用节点1..5，本站公开将其全部编号减1，保持每个节点对应权值与边不变，答案120不变；不混用两种编号，也不删除或添加节点。

第一公开例为007重编号后的五节点星：中心2权值30，选叶3和4的权值40、50，和120。第二例保留013正式七节点输入及014答案16：中心3权值4，实际应选邻居1（值2）和4（值10）；014解释误写邻居2，2不是中心3的邻居，本站修正这一个节点标签。第三例保留catalog五节点输入[[0,1],[0,2],[1,3],[1,4]]和权值[3,4,−1,2,5]、k2，但将原11纠正为12：中心1应选权值5和3，而非5和2。

012完整约束：2≤n≤100000，1≤m≤100000，0≤k≤100000，−1000≤values[i]≤1000，无自环、无重边。k是臂数上限而非恰选k个节点。非空允许只选中心，k0或所有邻居负权时尤其重要。图无需连通，孤立节点也是合法单节点星。这里是子图而非诱导子图：选定叶子之间即使在原图有边，也可不选这些边，所以不能排除三角形中的两臂星。

原013标准输入先给n m及m条边，再给一次权值数组长度n、n行权值、最后k。本站明确将同一组函数参数重排为n m k、一行n个权值、m行无向边，省略重复的数组长度；不是声称该排版就是原STDIN。参数含义及全部边和值不变，全部端点统一0-based。未执行任何上游解答代码。

## 思路

枚举每个节点作为中心。每个邻居最多出现一次，最多取k个叶子；负权只会降低答案，零权可不选，因此只收集正权邻居，降序取前k个，加上中心权值。对全部中心求最大值。初始答案为最大单节点值，不能从0开始而把空图当答案。

## 正确性证明

固定中心后，合法星只能选该中心的不同直接邻居，且选叶数量不超过k。删去负权叶子不会破坏合法性且严格增大权值，删去零权不改变权值，所以存在最优星只选正权叶子。若选中某个较小权值而漏掉较大正权邻居，交换二者仍是合法星且不减权值；反复交换得到至多k个最大的正权邻居。若正权邻居不足k则全部选择，否则取前k个。因此算法得到该中心的最大值。

任意非空星都存在一个中心；算法检查全部中心且每个计算结果自身合法，最终最大值既不小于任何合法星，也确实能够实现。初始单节点值覆盖0臂和全负权情况，故输出正确。

## 复杂度与完整域

设节点度数为d_i，建图O(n+m)，排序总耗时O(Σ d_i log(d_i+1))，保守为O(n+m log(m+1))；存储O(n+m)。最大可能和不超过100000×1000=100000000，最小最优值至少−1000，32位有符号返回类型足够。k可大于所有度数，不缩成k<n。

## 独立验证

小域穷举中心及其邻居的所有大小≤k子集，直接计算合法星值，不依赖排序贪心；2..4节点所有非空简单图、权值−1/0/1及k0..n共26298组交叉核对。另163唯一随机/边界输入都用该暴力oracle，并真实启动参考程序。

完整规模oracle采用不同实现：将所有正权节点按权值1..1000分桶，从大权值桶到小权值桶遍历节点，沿该节点的每条边给邻居中心提供叶子贡献，中心仅接收最先到的k个贡献。它不排序任何邻接表，也不调用参考程序；复杂度O(n+m+1000)。大域构造还用独立闭式核验纯星、环、全负、全零、匹配和稠密团。满n/m/k、k0、k1、负中心加正邻居、叶子之间有边、重编号随机图均覆盖。三个正常退出负控分别把k当节点数、强制加入负权、丢失无向反向边。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(values,edges,k):
 n=len(values);assert 2<=n<=100000 and 1<=len(edges)<=100000 and 0<=k<=100000
 assert all(-1000<=v<=1000 for v in values)
 assert all(0<=u<n and 0<=v<n and u!=v for u,v in edges)
 assert len({tuple(sorted(e)) for e in edges})==len(edges)
 return f'{n} {len(edges)} {k}\n'+' '.join(map(str,values))+'\n'+''.join(f'{u} {v}\n' for u,v in edges)
def adjacency(n,edges):
 a=[[] for _ in range(n)]
 for u,v in edges:a[u].append(v);a[v].append(u)
 return a
def brute(values,edges,k):
 a=adjacency(len(values),edges)
 return max(values[c]+sum(values[v] for v in leaves) for c in range(len(values)) for size in range(min(k,len(a[c]))+1) for leaves in combinations(a[c],size))
def bucket(values,edges,k):
 n=len(values);a=adjacency(n,edges);groups=[[] for _ in range(1001)];counts=[0]*n;totals=values[:]
 for u,v in enumerate(values):
  if v>0:groups[v].append(u)
 for weight in range(1000,0,-1):
  for leaf in groups[weight]:
   for center in a[leaf]:
    if counts[center]<k:counts[center]+=1;totals[center]+=weight
 return max(totals)
def run(path,raw):
 start=time.perf_counter();p=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,timeout=20,check=True)
 assert not p.stderr
 return p.stdout.strip(),time.perf_counter()-start
def main():
 started=time.perf_counter();sources=[]
 for path,blob,h in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==h
  assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==blob
  sources.append({'path':path,'gitBlobSha':blob,'rawSha256':h})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.py';ref.write_text(REFERENCE)
 own={'__name__':'authored_reference'};exec(compile(REFERENCE,str(ref),'exec'),own);exhaustive=0
 for n in range(2,5):
  pairs=list(combinations(range(n),2))
  for mask in range(1,1<<len(pairs)):
   edges=[e for i,e in enumerate(pairs) if mask>>i&1]
   for vs in product([-1,0,1],repeat=n):
    values=list(vs)
    for k in range(n+1):
     expected=brute(values,edges,k);assert int(own['solve'](encode(values,edges,k)))==expected
     exhaustive+=1
 assert exhaustive==26298
 specs=[([10,20,30,40,50],[(2,0),(2,1),(2,3),(2,4)],2),([1,2,3,4,10,-10,-20],[(0,1),(1,2),(1,3),(3,4),(3,5),(3,6)],2),([3,4,-1,2,5],[(0,1),(0,2),(1,3),(1,4)],2),([-5,-3],[(0,1)],100000),([-10,5,6],[(0,1),(0,2),(1,2)],2),([0,0],[(0,1)],0),([-1000,1000],[(0,1)],1),([1,2,3],[(0,1),(0,2),(1,2)],2),([-1000,-999,1000],[(0,1)],100000)]
 rng=random.Random(SEED);keys={encode(*s) for s in specs}
 while len(specs)<163:
  n=rng.randint(2,8);pairs=list(combinations(range(n),2));rng.shuffle(pairs);edges=pairs[:rng.randint(1,len(pairs))]
  values=[rng.randint(-15,15) for _ in range(n)];k=rng.choice([0,1,2,n,100000]);raw=encode(values,edges,k)
  if raw not in keys:keys.add(raw);specs.append((values,edges,k))
 oracles=[]
 for v,e,k in specs:
  expected=brute(v,e,k);assert bucket(v,e,k)==expected
  raw=encode(v,e,k);assert run(ref,raw)[0]==str(expected)
  oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
 assert [c['expectedOutput'] for c in oracles[:3]]==['120\n','16\n','12\n']
 print('Akuna4:26298 exhaustive and163 unique independent subprocess oracles passed',flush=True)
 cases=[{'name':['原007示意统一减1编号','原013正式例修正解释节点','catalog例11纠正12'][i] if i<3 else f'中心子集枚举{i-2}',**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])];large=[]
 def add(name,values,edges,k,closed=None):
  expected=bucket(values,edges,k)
  if closed is not None:assert expected==closed,name
  raw=encode(values,edges,k);actual,elapsed=run(ref,raw);assert actual==str(expected),name
  cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  large.append({'name':name,'n':len(values),'m':len(edges),'k':k,'oracle':'descending node-weight buckets distribute contributions to centers','closedFormChecked':closed is not None,'expected':expected,'localSeconds':round(elapsed,5)})
 n=100000;star=[(0,i) for i in range(1,n)];star_extra=star+[(1,2)]
 add('满nmk全正星加叶间边',[1000]*n,star_extra,100000,100000000)
 add('满nmk全负仍须非空',[-1000]*n,star_extra,100000,-1000)
 add('满nm且k0',[i%2001-1000 for i in range(n)],star_extra,0,1000)
 add('满nm且k1',[1000]*n,star_extra,1,2000)
 add('满n负中心最优',[-1000]+[1000]*(n-1),star,100000,99998000)
 ring=[(i,i+1) for i in range(n-1)]+[(n-1,0)]
 add('满nm全正环',[1000]*n,ring,100000,3000)
 add('满nm全零环',[0]*n,ring,100000,0)
 add('满nm交替正负环',[1000 if i%2 else -1000 for i in range(n)],ring,2,1000)
 add('满n不连通匹配',[1000]*n,[(i,i+1) for i in range(0,n,2)],100000,2000)
 clique=list(combinations(range(447),2));clique += [(447,i) for i in range(448,448+100000-len(clique))]
 add('满nm稠密团与独立分量',[1000]*n,clique,100000,447000)
 edges=set()
 while len(edges)<100000:
  u,v=rng.sample(range(n),2);edges.add((min(u,v),max(u,v)))
 add('满nm固定随机图',[rng.randint(-1000,1000) for _ in range(n)],sorted(edges),rng.randrange(100001))
 print('Akuna4:11 full-domain graph families passed; running three normal-exit mutants',flush=True)
 assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
 kills=[]
 for i,m in enumerate(MUTANTS,1):
  p=OA/f'negative-controls/{PID}-{i}.py';p.write_text(m['code'])
  rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].strip()]
  assert rejected;kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'至多k臂的最大节点权星形子图','difficulty':'中等','tags':['OA','Akuna Capital','图','排序','贪心'],
 'description':'给定无向简单图，每个节点有一个整数权值。选择非空星形子图：选一个中心和至多k个不同直接邻居作为叶子，只选中心到这些叶子的边。求最大节点权值和。可不选叶子，但必须有中心；不要求是诱导子图，原图叶子之间存在边不妨碍选星。',
 'input':'第一行n m k；第二行n个权值values[0..n−1]；随后m行u v表示无向边。完整原约束2≤n≤100000，1≤m≤100000，0≤k≤100000，−1000≤values[i]≤1000，0≤u,v<n且u≠v，无重复无向边。本站统一采用原012约束与013正式样例的0-based编号；原007示意的1-based端点全部减1，权值对应关系保持。',
 'output':'输出最大权值和，一个整数。k是臂数上限，不是节点数；k=0允许仅中心。全负时不能输出代表空图的0。',
 'explanation':'公开例1保留007图形并统一编号，结果120。例2保留013输入和014答案16，但实际选中心3、叶1和4；014叶2标签笔误。例3保留catalog输入，原11修正为12：中心1选择权值5和3。早期编号差异仅重标号，不改变图或优化目标；所有来源与修正均在题解披露。',
 'hints':['固定中心后只需要考虑正权邻居。','选择至多k个最大正权值，并记得中心本身可以为负。','枚举所有中心，也要允许孤立节点和0臂。'],'timeLimit':3,'memoryLimit':262144,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 solutions=[{'language':'python','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'固定中心后选最大正权邻居','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'catalogContentHash':HASH,'contentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':sources,'upstreamCodeExecuted':False,'constraints':['2<=n<=100000','1<=m<=100000','0<=k<=100000','-1000<=value<=1000','simple undirected graph, endpoints0..n-1'],'corrections':['007 illustrative1-based endpoints relabelled minus1 without changing topology or values, answer120 retained.','013/014 original sample answer16 retained; explanatory leaf2 corrected to leaf1.','Catalog five-node example answer11 corrected to12 using center1, leaves4 and0.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'原012约束和013正式输入明确0-based；007示意统一重标号保持图和值，无语义选择。公开修正catalog11为12及正式例叶标签，完整原域以独立子集穷举及权值分桶验证。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Enumerate every center and leaf subset; large graph oracle processes globally descending weight buckets and distributes each vertex contribution across its edges, without per-adjacency sorting.','exhaustiveSmallDomain':{'cases':exhaustive,'nMin':2,'nMax':4,'weights':[-1,0,1],'k':'0..n','allNonemptySimpleGraphs':True},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Akuna4 frozen:{len(cases)}formal,163oracle,26298exhaustive,11large,3mutants',flush=True)
if __name__=='__main__':main()
