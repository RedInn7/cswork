#!/usr/bin/env python3
"""Google #40 longest all-zero subarray with decrement/zero operations; self-decrement rule from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-google-40';BATCH='google-40-recovered';SEED=20261008040
PATH='fastprep/Google/google-max-subarray-filled-with-zeros.md'
N=100000;V=10**9;XM=10**15
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <set>
using namespace std;
int main(){int n;long long X;int Y;if(scanf("%d %lld %d",&n,&X,&Y)!=3)return 0;vector<long long>a(n);for(auto&v:a)scanf("%lld",&v);
multiset<long long>top,rest;long long restSum=0;int best=0,l=0;
auto add=[&](long long v){if(v==0)return;top.insert(v);if((int)top.size()>Y){auto it=top.begin();rest.insert(*it);restSum+=*it;top.erase(it);}};
auto del=[&](long long v){if(v==0)return;auto it=rest.find(v);if(it!=rest.end()){rest.erase(it);restSum-=v;return;}
 top.erase(top.find(v));if(!rest.empty()){auto jt=prev(rest.end());restSum-=*jt;top.insert(*jt);rest.erase(jt);}};
for(int r=0;r<n;r++){add(a[r]);while(restSum>X){del(a[l]);l++;}if(r-l+1>best)best=r-l+1;}
printf("%d\n",best);}
'''
MUTANTS=[
 {'name':'错误操作2用在窗口内最先出现的非零元素','language':'cpp','code':r'''#include <cstdio>
#include <vector>
using namespace std;
int main(){int n;long long X;int Y;scanf("%d %lld %d",&n,&X,&Y);vector<long long>a(n);for(auto&v:a)scanf("%lld",&v);int best=0;
for(int l=0;l<n;l++){long long s=0;int z=0;for(int r=l;r<n;r++){if(a[r]){if(z<Y)z++;else s+=a[r];}if(s>X)break;if(r-l+1>best)best=r-l+1;}}
printf("%d\n",best);}
'''},
 {'name':'错误操作1每次直接清零一个元素','language':'cpp','code':REFERENCE.replace('auto it=top.begin();rest.insert(*it);restSum+=*it;top.erase(it);','auto it=top.begin();rest.insert(*it);restSum+=1;top.erase(it);').replace('rest.erase(it);restSum-=v;return;','rest.erase(it);restSum-=1;return;').replace('restSum-=*jt;','restSum-=1;')},
 {'name':'错误忽略操作1','language':'cpp','code':REFERENCE.replace('while(restSum>X)','while(restSum>0)')},
 {'name':'错误32位累计','language':'cpp','code':REFERENCE.replace('long long restSum=0;','int restSum=0;')},
]
EDITORIAL='''## 题意

操作1把某个元素自身减1，最多X次；操作2把某个元素直接置0，最多Y次。求能变成全0的最长连续子数组长度。

## 思路

固定一个窗口，其中的0不需要处理；每个正数要么花1次操作2，要么花a[i]次操作1。最优做法是把Y次操作2用在窗口内最大的若干个正数上，其余正数之和必须不超过X。

窗口向左扩展时，“除去最大的Y个之后的和”只增不减，所以对每个右端点，合法左端点构成一段后缀，可以用双指针。用两个有序多重集合维护窗口内的正数：top保存最大的至多Y个，rest保存其余并记录其和restSum。右端点加入元素时先放入top，超出Y个就把top中最小的移到rest；左端点移出元素时，若在rest中就直接删，否则从top删并把rest中最大的补回top。restSum>X时左端点右移。

## 正确性

交换论证：若某个较小正数用了操作2而较大的没用，交换二者的处理方式，操作2次数不变，操作1次数不增，因此最优方案一定把操作2给最大的Y个。两个集合始终满足top中每个元素不小于rest中每个元素且|top|=min(Y,正数个数)，所以restSum正是最小代价。单调性保证双指针不漏解。

## 复杂度

O(n log n)。restSum可达10^14级别，使用64位整数。

## 独立验证

oracle对每个窗口排序后直接计算“去掉最大Y个后的和”（O(n² log n)），不使用双指针和集合。更小的数据另做逐次操作的状态搜索（数组、已用X、已用Y），验证“操作2给最大值”的模型本身。穷举长度1..4、元素0..3、X∈0..3、Y∈0..2的全部输入并逐个真实运行参考程序。错误解覆盖把操作2给最先出现的元素、把操作1当成一次清零、忽略操作1和32位累计。
'''
def encode(a,X,Y):
 assert 1<=len(a)<=N and all(0<=v<=V for v in a) and 0<=X<=XM and 0<=Y<=len(a)
 return f'{len(a)} {X} {Y}\n'+' '.join(map(str,a))+'\n'
def oracle(a,X,Y):
 n=len(a);best=0
 for l in range(n):
  for r in range(l,n):
   w=sorted((v for v in a[l:r+1] if v),reverse=True)
   if sum(w[Y:])<=X:best=max(best,r-l+1)
 return best
def search(a,X,Y):
 from functools import lru_cache
 seen=set();st=[(tuple(a),X,Y)];best=0
 while st:
  s=st.pop()
  if s in seen:continue
  seen.add(s);arr,x,y=s;run=0
  for v in arr:
   run=run+1 if v==0 else 0;best=max(best,run)
  for i,v in enumerate(arr):
   if v>0 and x>0:st.append((arr[:i]+(v-1,)+arr[i+1:],x-1,y))
   if v!=0 and y>0:st.append((arr[:i]+(0,)+arr[i+1:],x,y-1))
 return best
def main():
 rng=random.Random(SEED)
 ex=([4,3,0,1],2,1)
 assert oracle(*ex)==3==search(*ex)
 small=[ex,([5],0,0),([5],0,1),([5],5,0),([0,0,0],0,0),([1,1,1,1],2,0),([9,1,9],1,2),([3,0,3,0,3],3,1),([2,2,2],4,1),([1,2,3,4,5],3,2),([7,0,7,1],1,1)]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(1,10);a=[rng.choice([0,rng.randint(1,rng.choice([3,10,V]))]) for _ in range(n)]
  t=(a,rng.choice([0,rng.randint(0,20),rng.randint(0,3*V)]),rng.randint(0,n));k=encode(*t)
  if k not in keys:keys.add(k);small.append(t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,e=None):
  if e is None:e=oracle(*t)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False);add('只用操作1',([2,1,0,3],3,0),False);add('只用操作2',([5,5,0,5],0,2),False)
 for i,t in enumerate(small[1:27]):add(f'小规模{i+1}',t)
 def sliding(a,X,Y):
  # independent of reference code: binary search on L, each check slides a window keeping a sorted list and recomputes the sum of the smallest k-Y via a Fenwick tree over value ranks
  vals=sorted(set(v for v in a if v));rank={v:i+1 for i,v in enumerate(vals)};m=len(vals)
  def check(L):
   cnt=[0]*(m+1);sm=[0]*(m+1);tot=[0,0]
   def upd(v,d):
    i=rank[v];tot[0]+=d;tot[1]+=d*v
    while i<=m:cnt[i]+=d;sm[i]+=d*v;i+=i&-i
   def smallest(k):
    # sum of the k smallest positives
    pos=0;s=0;LOG=1<<(m.bit_length())
    step=LOG
    while step:
     nx=pos+step
     if nx<=m and cnt[nx]<k:pos=nx;k-=cnt[nx];s+=sm[nx]
     step>>=1
    return s+(k*vals[pos] if k>0 else 0)
   for i in range(len(a)):
    if a[i]:upd(a[i],1)
    if i>=L and a[i-L]:upd(a[i-L],-1)
    if i>=L-1:
     k=tot[0]-Y
     if k<=0 or smallest(k)<=X:return True
   return False
  lo,hi=0,len(a)
  while lo<hi:
   mid=(lo+hi+1)//2
   if check(mid):lo=mid
   else:hi=mid-1
  return lo
 for t in small:assert sliding(*t)==oracle(*t)
 def addbig(nm,t):add(nm,t,e=sliding(*t))
 addbig('满规模全为最大值只用操作2',([V]*N,0,N//2))
 addbig('满规模全为最大值大X',([V]*N,XM,0))
 addbig('满规模随机大值',([rng.randint(0,V) for _ in range(N)],rng.randint(0,10**13),rng.randint(0,1000)))
 addbig('满规模随机小值',([rng.randint(0,5) for _ in range(N)],rng.randint(0,20000),rng.randint(0,50)))
 addbig('满规模稀疏非零',([rng.choice([0]*9+[rng.randint(1,V)]) for _ in range(N)],10**9,10))
 addbig('满规模全零',([0]*N,0,0))
 addbig('满规模Y等于n',([rng.randint(1,V) for _ in range(N)],0,N))
 addbig('满规模交替大小',([V if i%2 else 1 for i in range(N)],30000,2000))
 def exhaustive(run):
  c=0
  for n in range(1,5):
   for a in product(range(4),repeat=n):
    for X in range(4):
     for Y in range(0,min(2,n)+1):
      e=oracle(list(a),X,Y)
      if n<=3:assert e==search(list(a),X,Y)
      assert run(encode(list(a),X,Y)).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':4,'values':[0,3],'X':[0,3],'Y':[0,2],'operationSearchUpToN':3}
 P=problem(PID,'Google OA #40：最长全零子数组','中等',['双指针','有序集合','贪心'],
  '给定长度为n的非负整数数组A，以及整数X、Y。可以进行两种操作：\n操作1：任选下标i（0≤i<n），令A[i]=A[i]−1；\n操作2：任选下标i，令A[i]=0。\n操作1最多使用X次，操作2最多使用Y次。求操作后全部由0组成的连续子数组的最大长度。',
  '第一行三个整数n、X、Y；第二行n个整数A[0..n−1]。1≤n≤100000，0≤A[i]≤10^9，0≤X≤10^15，0≤Y≤n。',
  '输出一个整数，表示全0连续子数组的最大长度（可能为0）。',
  '样例1：A=[4,3,0,1]，X=2，Y=1。对下标1使用操作2得到[4,0,0,1]，再对下标3使用一次操作1得到[4,0,0,0]，全0子数组长度为3。\n样例2：只能用操作1，[1,0,3]需要4次，[2,1,0]需要3次，答案3。\n样例3：两次操作2把下标0、1置0，得到[0,0,0,5]，答案3。',
  ['窗口内每个正数要么花一次操作2，要么花等于其值的操作1次数。','操作2应该留给窗口内最大的那些数。','窗口变大时代价不减，可以用双指针配合两个有序集合。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'双指针与最大Y个元素的有序集合','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent per-window sort (sum after removing the Y largest positives); operation-by-operation state search on tiny arrays validating the cost model; binary search on length with a Fenwick tree over value ranks for formal large cases.',
  'imageProvenance':IMAGE_PROVENANCE+' Plain-text interview-report screenshot with both operations, X/Y limits and the worked example.',
  'rangeDisclosure':'Source image gives no constraints. Chosen bounds: 1<=n<=1e5, 0<=A[i]<=1e9 (non-negative), 0<=X<=1e15, 0<=Y<=n. Stdin: "n X Y" then n integers.',
  'corrections':['Upstream md operation 1 a[i]=a[i-1]-1 corrected to image a[i]=a[i]-1 (self decrement), consistent with the sample steps. Output 3 unchanged.','Second and third public examples are authored.'],
  'reason':'原图确认操作1为自减1，样例矛盾消失；原图无约束，自选n≤1e5、非负值≤1e9；双指针+有序集合，独立窗口排序、操作状态搜索与树状数组二分核验。'})
if __name__=='__main__':main()
