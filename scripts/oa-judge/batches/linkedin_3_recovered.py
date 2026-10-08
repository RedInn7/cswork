#!/usr/bin/env python3
"""LinkedIn #3 minimax path with at most K edges; rule recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
from collections import deque
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-linkedin-3';BATCH='linkedin-3-recovered';SEED=20261008003
PATH='fastprep/LinkedIn/linkedin-find-the-path.md'
NM=100000;MM=200000;W=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int n,m,K;vector<int>eu,ev,ew,head,nxt,to,wt;
bool ok(int lim){vector<int>d(n+1,-1);vector<int>q;q.reserve(n);q.push_back(1);d[1]=0;
 for(size_t i=0;i<q.size();i++){int u=q[i];if(d[u]>=K)continue;for(int e=head[u];e>=0;e=nxt[e])if(wt[e]<=lim&&d[to[e]]<0){d[to[e]]=d[u]+1;q.push_back(to[e]);}}
 return d[n]>=0&&d[n]<=K;}
int main(){if(scanf("%d %d %d",&n,&m,&K)!=3)return 0;head.assign(n+1,-1);vector<int>ws;
for(int i=0;i<m;i++){int a,b,w;scanf("%d %d %d",&a,&b,&w);ws.push_back(w);
 to.push_back(b);wt.push_back(w);nxt.push_back(head[a]);head[a]=to.size()-1;
 to.push_back(a);wt.push_back(w);nxt.push_back(head[b]);head[b]=to.size()-1;}
sort(ws.begin(),ws.end());ws.erase(unique(ws.begin(),ws.end()),ws.end());
int lo=0,hi=ws.size()-1;while(lo<hi){int mid=(lo+hi)/2;if(ok(ws[mid]))hi=mid;else lo=mid+1;}
printf("%d\n",ws[lo]);}
'''
MUTANTS=[
 {'name':'错误忽略边数上限','language':'cpp','code':REFERENCE.replace('if(d[u]>=K)continue;','').replace('return d[n]>=0&&d[n]<=K;','return d[n]>=0;')},
 {'name':'错误边数必须小于K','language':'cpp','code':REFERENCE.replace('return d[n]>=0&&d[n]<=K;','return d[n]>=0&&d[n]<K;').replace('if(d[u]>=K)continue;','')},
 {'name':'错误当作有向图','language':'cpp','code':REFERENCE.replace('to.push_back(a);wt.push_back(w);nxt.push_back(head[b]);head[b]=to.size()-1;','')},
 {'name':'错误用DFS深度代替最少边数','language':'cpp','code':REFERENCE.replace('for(size_t i=0;i<q.size();i++){int u=q[i];','while(!q.empty()){int u=q.back();q.pop_back();')},
]
EDITORIAL='''## 题意

无向带权图，结点1..N。在从1到N、边数不超过K的所有路径中，使路径上最大边权尽量小，输出这个最小的最大边权。数据保证至少存在一条边数不超过K的路径。

## 思路

答案具有单调性：如果只用权值≤w的边就能在K步内从1走到N，那么任何更大的阈值也可以。所以对排序去重后的边权二分阈值w，每次只保留权值≤w的边做BFS，求1到N的最少边数，判断是否≤K。

## 正确性

若某条路径边数≤K且最大边权为w*，则阈值w*下BFS的最短边数≤K；反之阈值w下BFS找到的最短路径只用≤w的边，最大边权≤w。所以最小可行阈值等于答案，且答案一定是某条边的权值。

## 复杂度

O((N+M) log M)。

## 独立验证

oracle用“按边数分层”的极小化最大值DP：f[k][v]为恰好走k步到v的最小可能最大边权，逐层松弛到K层，不使用二分与BFS。更小的数据再枚举所有边数≤K的路径（允许重复点）直接取最小最大边权。穷举3个结点上所有边子集（边权取1..2）与K=1..2并逐个真实运行参考程序。错误解覆盖忽略K、边数必须严格小于K、当作有向图和用DFS深度代替最少边数。
'''
def encode(n,K,edges):
 assert 2<=n<=NM and 1<=len(edges)<=MM and 1<=K<=n-1 and all(1<=a<=n and 1<=b<=n and a!=b and 1<=w<=W for a,b,w in edges)
 return f'{n} {len(edges)} {K}\n'+''.join(f'{a} {b} {w}\n' for a,b,w in edges)
def oracle(n,K,edges):
 INF=float('inf');f=[INF]*(n+1);f[1]=0;best=INF
 for _ in range(K):
  g=f[:]
  for a,b,w in edges:
   if f[a]<INF:g[b]=min(g[b],max(f[a],w))
   if f[b]<INF:g[a]=min(g[a],max(f[b],w))
  f=g;best=min(best,f[n])
 return -1 if best==INF else best
def paths(n,K,edges):
 adj=[[] for _ in range(n+1)]
 for a,b,w in edges:adj[a].append((b,w));adj[b].append((a,w))
 best=None;st=[(1,0,0)]
 while st:
  u,k,mx=st.pop()
  if u==n and k>0:best=mx if best is None else min(best,mx)
  if k<K:
   for v,w in adj[u]:st.append((v,k+1,max(mx,w)))
 return -1 if best is None else best
def bisect_bfs(n,K,edges):
 ws=sorted({w for _,_,w in edges});adj=[[] for _ in range(n+1)]
 for a,b,w in edges:adj[a].append((b,w));adj[b].append((a,w))
 def ok(lim):
  d=[-1]*(n+1);d[1]=0;q=deque([1])
  while q:
   u=q.popleft()
   for v,w in adj[u]:
    if w<=lim and d[v]<0:d[v]=d[u]+1;q.append(v)
  return 0<=d[n]<=K
 assert ok(ws[-1]),'infeasible'
 lo,hi=0,len(ws)-1
 while lo<hi:
  mid=(lo+hi)//2
  if ok(ws[mid]):hi=mid
  else:lo=mid+1
 return ws[lo]
def main():
 rng=random.Random(SEED)
 ex=(4,3,[(1,2,4),(1,3,2),(2,4,5),(2,3,6)])
 assert oracle(*ex)==5==paths(*ex)
 small=[ex,(2,1,[(1,2,7)]),(2,1,[(1,2,7),(2,1,3)]),(3,1,[(1,3,9),(1,2,1),(2,3,1)]),(3,2,[(1,3,9),(1,2,1),(2,3,1)]),(4,2,[(1,2,1),(2,3,1),(3,4,1),(1,4,100)]),(4,3,[(1,2,1),(2,3,1),(3,4,1),(1,4,100)])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(2,8);es=[]
  for _ in range(rng.randint(1,14)):
   a,b=rng.sample(range(1,n+1),2);es.append((a,b,rng.randint(1,rng.choice([5,W]))))
  t=(n,rng.randint(1,n-1),es)
  if oracle(*t)<0:continue
  k=encode(*t)
  if k not in keys:keys.add(k);small.append(t)
 for t in small:assert oracle(*t)==paths(*t)==bisect_bfs(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False,closed=5);add('K限制迫使走重边',(4,2,[(1,2,1),(2,3,1),(3,4,1),(1,3,8),(3,4,2)]),False,closed=8);add('直接相连',(2,1,[(1,2,7),(1,2,3)]),False,closed=3)
 used={c['input'] for c in cases};rest=[t for t in small[1:] if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,t,closed=None):add(nm,t,f=bisect_bfs,closed=closed)
 n=NM
 chain=[(i,i+1,rng.randint(1,1000)) for i in range(1,n)]
 big('满规模长链K恰好够',(n,n-1,chain+[(1,n,W)]),max(w for _,_,w in chain))
 big('满规模长链与重捷径',(n,n-2,chain+[(1,n,W)]),W)
 es=[]
 for _ in range(MM-1):
  a,b=rng.sample(range(1,n+1),2);es.append((a,b,rng.randint(1,W)))
 es.append((1,n,W))
 big('满规模随机图大K',(n,n-1,es))
 big('满规模随机图小K',(n,3,es))
 grid=[]
 side=300
 for r in range(side):
  for c in range(side):
   v=r*side+c+1
   if c+1<side:grid.append((v,v+1,rng.randint(1,W)))
   if r+1<side:grid.append((v,v+side,rng.randint(1,W)))
 gn=side*side
 big('满规模网格K等于曼哈顿距离',(gn,2*(side-1),grid))
 big('满规模网格K宽松',(gn,gn-1,grid))
 star=[(1,i,rng.randint(1,W)) for i in range(2,n+1)]+[(i,n,rng.randint(1,W)) for i in range(2,n)]
 big('满规模双星两步',(n,2,star))
 def exhaustive(run):
  c=0;pairs=[(1,2),(1,3),(2,3)]
  for ws in product([0,1,2],repeat=3):
   es=[(a,b,w) for (a,b),w in zip(pairs,ws) if w]
   for K in (1,2):
    if not es or oracle(3,K,es)<0:continue
    e=paths(3,K,es);assert e==oracle(3,K,es);assert run(encode(3,K,es)).split()==[str(e)];c+=1
  for ws in product([0,1,3],repeat=6):
   ps=[(1,2),(1,3),(1,4),(2,3),(2,4),(3,4)];es=[(a,b,w) for (a,b),w in zip(ps,ws) if w]
   for K in (1,2,3):
    if not es or oracle(4,K,es)<0:continue
    e=paths(4,K,es);assert e==oracle(4,K,es)==bisect_bfs(4,K,es);assert run(encode(4,K,es)).split()==[str(e)];c+=1
  return c,{'nodes':[3,4],'edgeWeights':'each possible edge absent or weight in {1,2} (n=3) / {1,3} (n=4)','K':'1..n-1','onlyFeasible':True}
 P=problem(PID,'LinkedIn OA #3：边数受限的最小瓶颈路径','中等',['二分答案','BFS','图'],
  '给定一张无向带权图，结点编号1..N，共M条边。在所有从结点1到结点N、并且经过的边数不超过K的路径中，找出“路径上最大边权”最小的那一条，输出这个最小的最大边权。数据保证至少存在一条这样的路径。',
  '第一行三个整数N、M、K。随后M行，每行三个整数u、v、w，表示u与v之间有一条权为w的无向边（可能有重边，没有自环）。2≤N≤100000，1≤M≤200000，1≤K≤N−1，1≤w≤10^9。',
  '输出一个整数，表示最小的最大边权。',
  '样例1：N=4，K=3。路径1→2→4的最大边权为5；路径1→3→2→4的最大边权为6。答案5。\n样例2：K=2时不能走1→2→3→4（3条边），只能走1→3→4，最大边权为8。\n样例3：1和2之间有两条边，选权值3的那条。',
  ['答案一定是某条边的权值，并且关于阈值单调。','二分阈值，只保留不超过阈值的边。','用BFS求1到N的最少边数，判断是否不超过K。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'二分瓶颈阈值与BFS边数检查','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent layered minimax Bellman-Ford over exactly k steps (k<=K); explicit DFS over all walks with at most K edges on small graphs; Python threshold bisection with BFS for formal large cases.',
  'imageProvenance':IMAGE_PROVENANCE+' Text screenshot giving N nodes 1..N, M bidirectional weighted edges, the minimax objective with at most K edges, and the sample.',
  'rangeDisclosure':'Source image gives no constraints and no rule for an unreachable target; inputs are guaranteed to contain at least one 1->N path with at most K edges, so no sentinel output is needed. Chosen: 2<=N<=1e5, 1<=M<=2e5, 1<=K<=N-1, 1<=w<=1e9, multi-edges allowed, no self-loops. Stdin: "N M K" then M lines "u v w".',
  'corrections':['Image and upstream md list "1->2->3" as a possible route; the explanation shows it is 1->2->4. Output 5 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出终点为N、K为边数上限的极小化最大边权规则；无解输出未给出，故数据保证存在可行路径；原图无约束，自选N≤1e5、M≤2e5；二分+BFS，独立分层极小化DP与路径枚举核验。'})
if __name__=='__main__':main()
