#!/usr/bin/env python3
"""Rubrik #18 Human Resources; tree and sample rows recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys,heapq
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-rubrik-18';BATCH='rubrik-18-recovered';SEED=20261008018
PATH='fastprep/Rubrik/rubrik-maximize-happiness.md'
NMAX=100000;MMAX=10**9;LMAX=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <queue>
#include <algorithm>
using namespace std;
int main(){int T;if(scanf("%d",&T)!=1)return 0;while(T--){int n;long long M;scanf("%d %lld",&n,&M);
vector<int>R(n+1);vector<long long>C(n+1),L(n+1);for(int i=1;i<=n;i++)scanf("%d %lld %lld",&R[i],&C[i],&L[i]);
vector<priority_queue<long long>>h(n+1);vector<long long>sum(n+1,0);vector<int>id(n+1);long long best=0;
for(int i=1;i<=n;i++){id[i]=i;h[i].push(C[i]);sum[i]=C[i];}
for(int v=n;v>=1;v--){auto &H=h[id[v]];long long &S=sum[id[v]];
 while(S>M){S-=H.top();H.pop();}
 best=max(best,L[v]*(long long)H.size());
 int p=R[v];if(p>0){int a=id[p],b=id[v];if(h[a].size()<h[b].size())swap(a,b);
  while(!h[b].empty()){h[a].push(h[b].top());sum[a]+=h[b].top();h[b].pop();}sum[b]=0;id[p]=a;}}
printf("%lld\n",best);}}
'''
MUTANTS=[
 {'name':'错误经理不能雇佣自己','language':'cpp','code':REFERENCE.replace('for(int i=1;i<=n;i++){id[i]=i;h[i].push(C[i]);sum[i]=C[i];}','for(int i=1;i<=n;i++){id[i]=i;}').replace('int p=R[v];if(p>0){','int p=R[v];if(p>0){h[id[v]].push(C[v]);sum[id[v]]+=C[v];')},
 {'name':'错误超预算时去掉最便宜的','language':'cpp','code':REFERENCE.replace('priority_queue<long long>','priority_queue<long long,vector<long long>,greater<long long>>')},
 {'name':'错误32位乘积','language':'cpp','code':REFERENCE.replace('best=max(best,L[v]*(long long)H.size());','best=max(best,(long long)(int)(L[v]*(long long)H.size()));')},
 {'name':'错误只有直接下属可被雇佣','language':'cpp','code':r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int T;scanf("%d",&T);while(T--){int n;long long M;scanf("%d %lld",&n,&M);vector<int>R(n+1);vector<long long>C(n+1),L(n+1);
vector<vector<long long>>ch(n+1);for(int i=1;i<=n;i++){scanf("%d %lld %lld",&R[i],&C[i],&L[i]);ch[i].push_back(C[i]);if(R[i])ch[R[i]].push_back(C[i]);}
long long best=0;for(int v=1;v<=n;v++){sort(ch[v].begin(),ch[v].end());long long s=0,c=0;for(long long x:ch[v]){if(s+x>M)break;s+=x;c++;}best=max(best,c*L[v]);}
printf("%lld\n",best);}}
'''},
]
EDITORIAL='''## 题意

公司是一棵以CEO为根的树。选一个经理v，再从v的子树（含v自己）中雇佣若干员工，总成本不超过M，幸福度为L[v]×雇佣人数。求最大幸福度。

## 思路

经理固定为v后，只需要在v的子树中雇佣尽可能多的人，显然应该按成本从小到大取。于是对每个结点维护一个大根堆，存子树中“当前被保留的”成本，并维护其和；和超过M就弹出最大的成本。每个结点处理完后把它的堆合并进父亲的堆（小堆合并入大堆）。由于R[i]<i，按编号从大到小处理即可保证子结点先于父结点。

## 正确性

若某个成本在子树v中因为超预算被弹出，它是当时保留集合中最贵的；对任何祖先u，其子树的成本多重集合包含v的子树，且预算相同，最优保留集合（最便宜的若干个）也不会包含它，所以弹出是永久安全的。对每个v，堆中剩下的正是子树内最便宜且总和不超过M的最大前缀，人数即该经理可雇佣的最大人数。

## 复杂度

启发式合并O(n log² n)。答案可达10^5×10^9=10^14，使用64位整数。

## 独立验证

oracle对每个结点收集子树成本排序后贪心取前缀（O(n² log n)，不依赖堆合并）；小数据再枚举经理和雇佣子集的全部组合直接求最大值。穷举结点数1..4的所有父亲数组、成本{1,2}、领导力{1,3}、预算1..3，按每组10个测试打包后真实运行参考程序。错误解覆盖经理不能雇自己、超预算时弹出最便宜者、32位乘积和只看直接下属。
'''
def encode(tests):
 assert 1<=len(tests)<=10
 out=[str(len(tests))]
 for M,rows in tests:
  n=len(rows);assert 1<=n<=NMAX and 1<=M<=MMAX
  out.append(f'{n} {M}')
  for i,(r,c,l) in enumerate(rows,1):
   assert (r==0)==(i==1) and 0<=r<i and 1<=c<=M and 1<=l<=LMAX
   out.append(f'{r} {c} {l}')
 return '\n'.join(out)+'\n'
def oracle_one(M,rows):
 n=len(rows);kids=[[] for _ in range(n+1)]
 for i,(r,_,_) in enumerate(rows,1):
  if r:kids[r].append(i)
 best=0
 for v in range(1,n+1):
  st=[v];costs=[]
  while st:
   u=st.pop();costs.append(rows[u-1][1]);st+=kids[u]
  costs.sort();s=c=0
  for x in costs:
   if s+x>M:break
   s+=x;c+=1
  best=max(best,c*rows[v-1][2])
 return best
def brute_one(M,rows):
 n=len(rows);anc=[set() for _ in range(n+1)]
 for i in range(1,n+1):
  r=rows[i-1][0];anc[i]={i}|(anc[r] if r else set())
 best=0
 for mask in range(1,1<<n):
  sel=[i+1 for i in range(n) if mask>>i&1]
  if sum(rows[i-1][1] for i in sel)>M:continue
  common=set.intersection(*(anc[i] for i in sel))
  best=max(best,len(sel)*max(rows[v-1][2] for v in common))
 return best
def fast_one(M,rows):
 n=len(rows);heaps=[None]+[[-rows[i][1]] for i in range(n)];sums=[0]+[rows[i][1] for i in range(n)];best=0
 for v in range(n,0,-1):
  H=heaps[v]
  while sums[v]>M:sums[v]+=heapq.heappop(H)
  best=max(best,len(H)*rows[v-1][2]);p=rows[v-1][0]
  if p:
   a,b=heaps[p],H
   if len(a)<len(b):a,b=b,a
   for x in b:heapq.heappush(a,x)
   heaps[p]=a;sums[p]+=sums[v]
 return best
def expect(tests,f):return ''.join(f'{f(M,rows)}\n' for M,rows in tests)
def main():
 rng=random.Random(SEED)
 ex=(20,[(0,10,400),(1,10,300),(2,15,100),(1,10,60),(1,15,800),(2,5,100),(2,5,100)])
 assert brute_one(*ex)==oracle_one(*ex)==fast_one(*ex)==1200
 def rand_tree(n,cmax,lmax,M,shape='rand'):
  rows=[]
  for i in range(1,n+1):
   r=0 if i==1 else (i-1 if shape=='chain' else 1 if shape=='star' else rng.randint(max(1,i-3) if shape=='deep' else 1,i-1))
   rows.append((r,rng.randint(1,min(cmax,M)),rng.randint(1,lmax)))
  return (M,rows)
 small=[[ex],[(5,[(0,5,7)])],[(1,[(0,1,1),(1,1,5)])],[(10,[(0,3,1),(1,3,2),(2,3,3),(3,3,4)])],[(6,[(0,2,9),(1,2,1),(1,2,1),(1,2,1)])]]
 keys={encode(t) for t in small}
 while len(small)<170:
  t=[rand_tree(rng.randint(1,10),rng.choice([3,10,1000]),rng.choice([3,100,LMAX]),rng.randint(1,30),rng.choice(['rand','chain','star','deep'])) for _ in range(rng.randint(1,4))]
  k=encode(t)
  if k not in keys:keys.add(k);small.append(t)
 for t in small:
  for M,rows in t:assert oracle_one(M,rows)==brute_one(M,rows)==fast_one(M,rows)
 oracles=[{'input':encode(t),'expectedOutput':expect(t,oracle_one)} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=fast_one):cases.append(case(nm,encode(t),expect(t,f),hidden))
 add('样例1',[ex],False)
 add('经理雇佣自己',[(10,[(0,4,50),(1,7,3),(1,7,3)])],False)
 add('多组测试',[(3,[(0,1,2),(1,1,1),(2,1,1)]),(2,[(0,2,10),(1,1,1),(1,1,1)])],False)
 for i,t in enumerate(small[1:29]):add(f'小规模{i+1}',t)
 N=NMAX
 add('满规模链',[rand_tree(N,MMAX,LMAX,MMAX,'chain')])
 add('满规模星形',[rand_tree(N,10**4,LMAX,MMAX,'star')])
 add('满规模全部可雇最大答案',[(MMAX,[(0 if i==1 else i-1,1,LMAX) for i in range(1,N+1)])])
 add('满规模随机树',[rand_tree(N,10**5,LMAX,10**8)])
 add('满规模深树小预算',[rand_tree(N,1000,LMAX,5000,'deep')])
 add('满规模十组中等树',[rand_tree(10000,rng.choice([10,10**6]),LMAX,rng.randint(1,10**7),rng.choice(['rand','chain','star','deep'])) for _ in range(10)])
 add('满规模随机树大成本',[rand_tree(N,MMAX,10**6,MMAX)])
 def exhaustive(run):
  c=0;batch=[]
  def flush():
   if batch:
    assert run(encode(batch)).split()==expect(batch,brute_one).split()
    batch.clear()
  for n in range(1,5):
   parents=list(product(*[range(1,i) for i in range(2,n+1)]))
   for par in parents:
    for cs in product((1,2),repeat=n):
     for ls in product((1,3),repeat=n):
      for M in (2,3) if n>1 else (2,3):
       rows=[(0 if i==0 else par[i-1],cs[i],ls[i]) for i in range(n)]
       assert brute_one(M,rows)==oracle_one(M,rows)
       batch.append((M,rows));c+=1
       if len(batch)==10:flush()
  flush();return c,{'nMin':1,'nMax':4,'costs':[1,2],'leadership':[1,3],'budgets':[2,3],'testsPerRun':10}
 P=problem(PID,'Rubrik OA #18：人力资源','困难',['树','堆','启发式合并','贪心'],
  '公司有N名员工，编号1..N。除CEO（员工1）外，每名员工都有一位直属经理RM。员工只接受来自RM、RM的RM……（即其祖先）的任务分配。员工i的雇佣成本为C[i]，领导力为L[i]。\n\n你要为客户雇佣一组员工，总成本不超过预算M，并选择一名经理：经理必须能给所有被雇佣员工分配任务，即每个被雇员工要么是经理本人，要么是经理的下属（子树中的员工）。经理可以被雇佣也可以不被雇佣，不被雇佣时不付费。\n\n客户的幸福度为（经理的领导力×被雇佣人数）。求幸福度的最大值。',
  '第一行T，表示测试组数。每组第一行N和M；随后N行，第i行三个整数R[i]、C[i]、L[i]，分别为员工i的RM、成本和领导力（CEO的R为0）。1≤T≤10，1≤N≤100000，1≤M≤10^9，0≤R[i]<i（仅i=1时R[i]=0），1≤C[i]≤M，1≤L[i]≤10^9。',
  '每组测试输出一行，为最大幸福度。',
  '样例1：员工1为CEO，2、4、5汇报给1，3、6、7汇报给2，预算20。选1为经理，雇佣2、6、7或4、6、7（成本20），幸福度400×3=1200。\n样例2：经理1雇佣自己（成本4），幸福度50×1=50；雇佣2或3只能得3。\n样例3：第一组选员工1为经理雇佣全部3人，得2×3=6；第二组员工1雇佣自己得10，雇佣两名下属得20。',
  ['固定经理后，应在其子树中按成本从小到大雇佣。','子树中因超预算被舍弃的最贵员工，对所有祖先同样不会被选。','用大根堆维护保留的成本，并把子结点的堆合并到父结点。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'子树大根堆的启发式合并','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent per-node subtree cost collection with sorted greedy prefix; brute force over all hire subsets and their common-ancestor managers on small trees; Python heapq small-to-large merge for formal cases.',
  'imageProvenance':IMAGE_PROVENANCE+' Single screenshot with statement, organisation tree figure (i,cost,leadership), stdin format, constraints, subtasks and the full sample input/output.',
  'rangeDisclosure':'Full original bounds preserved from the image: 1<=T<=10, 1<=N<=1e5, 1<=M<=1e9, 0<=R[i]<i, 1<=C[i]<=M, 1<=L[i]<=1e9. Original multi-test stdin format kept.',
  'corrections':['Upstream md sample row1 [2,10,400] corrected to image 0 10 400 (CEO has RM 0).','Upstream md sample row5 [2,5,800] corrected to image 1 15 800 (matches the tree figure). Output 1200 unchanged.','Image input format text "contains an integer 7" read as T.','Second and third public examples are authored.'],
  'reason':'原图给出组织树、完整输入格式、约束和样例原文，修正md两行样例转录错误；子树大根堆启发式合并，独立子树排序贪心与子集枚举核验。'})
if __name__=='__main__':main()
