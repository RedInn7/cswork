#!/usr/bin/env python3
"""D. E. Shaw #1 Subarray Removal; non-decreasing semantics fixed by the source image table."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-the-d-e-shaw-group-1';BATCH='the-d-e-shaw-group-1-recovered';SEED=20261008101
PATH='fastprep/The D. E. Shaw Group/akuna-get-num-subarrays.md'
N=200000;V=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
int P=1;while(P<n&&a[P-1]<=a[P])P++;
if(P==n){printf("%lld\n",(long long)n*(n+1)/2-1);return 0;}
int S=n-1;while(S>0&&a[S-1]<=a[S])S--;
long long ans=n-max(1,S); // l=0: next kept index r+1 in [max(1,S), n-1]
for(int l=1;l<=P;l++){int lo=max(l+1,S);int j=lower_bound(a.begin()+lo,a.end(),a[l-1])-a.begin();ans+=n-j+1;}
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误要求严格递增','language':'cpp','code':REFERENCE.replace('a[P-1]<=a[P]','a[P-1]<a[P]').replace('a[S-1]<=a[S]','a[S-1]<a[S]').replace('lower_bound(','upper_bound(')},
 {'name':'错误把删除整个数组也计入','language':'cpp','code':REFERENCE.replace('(long long)n*(n+1)/2-1','(long long)n*(n+1)/2').replace('long long ans=n-max(1,S);','long long ans=n-max(1,S)+1;')},
 {'name':'错误衔接处要求严格大于','language':'cpp','code':REFERENCE.replace('lower_bound(','upper_bound(')},
 {'name':'错误32位计数','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",(long long)n*(n+1)/2-1);','printf("%d\\n",n*(n+1)/2-1);')},
]
EDITORIAL='''## 题意

删除一个非空连续子数组后，剩余部分（左段+右段拼接）必须非空且非降序（允许相等，原题表格中[1,1,2]、[1,2,2]判为有序）。统计这样的子数组个数。

## 思路

设删除区间为[l,r]。剩余数组有序当且仅当：前缀arr[0..l−1]非降，后缀arr[r+1..n−1]非降，并且两段都非空时arr[l−1]≤arr[r+1]；另外不能删掉整个数组。

令P为最长非降前缀长度。若P=n，任意非空区间（除整个数组）都合法，答案n(n+1)/2−1。否则令S为最长非降后缀的起点。l只能取0..P；右段起点j=r+1必须满足j≥max(l+1,S)。l=0时j取[max(1,S),n−1]（j=n表示删光）；l≥1时，j=n总是合法，其余j要求arr[j]≥arr[l−1]，后缀有序，所以用二分找第一个满足的位置。

## 正确性

每个合法区间由(l,j)唯一确定，上述条件正是剩余数组非降的充要条件；在有序后缀上满足arr[j]≥arr[l−1]的j构成一段连续后缀，二分得到其起点，计数不重不漏。

## 复杂度

O(n log n)。答案最多约2×10^10，使用64位整数。

## 独立验证

oracle预先计算每个前缀/后缀是否非降，O(n²)枚举(l,r)判定，不使用二分；更小的数据再直接拼出剩余数组检查。穷举长度1..7、取值1..3的全部数组并逐个真实运行参考程序。错误解包括严格递增语义、把删光也计入、衔接处严格大于以及32位计数。
'''
def encode(a):
 assert 1<=len(a)<=N and all(1<=v<=V for v in a)
 return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def oracle(a):
 n=len(a);pre=[True]*(n+1);suf=[True]*(n+1)
 for i in range(2,n+1):pre[i]=pre[i-1] and a[i-2]<=a[i-1]
 for i in range(n-2,-1,-1):suf[i]=suf[i+1] and a[i]<=a[i+1]
 c=0
 for l in range(n):
  if not pre[l]:break
  for r in range(l,n):
   if (l,r)==(0,n-1) or not suf[r+1]:continue
   if l>0 and r+1<n and a[l-1]>a[r+1]:continue
   c+=1
 return c
def brute(a):
 n=len(a);c=0
 for l in range(n):
  for r in range(l,n):
   b=list(a[:l])+list(a[r+1:])
   if b and all(x<=y for x,y in zip(b,b[1:])):c+=1
 return c
def main():
 rng=random.Random(SEED)
 small=[[1,2,1,2],[3,1,2],[1,2,2,6,1,3],[1],[5,5],[2,1],[1,2,3],[3,2,1],[1,1,1,1],[1,3,2,4],[4,1,2,3],[2,3,4,1],[V,1,V],[2,2,1,1]]
 keys={encode(a) for a in small}
 while len(small)<175:
  a=[rng.randint(1,rng.choice([3,6,V])) for _ in range(rng.randint(1,14))]
  if rng.random()<0.4:a=sorted(a[:len(a)//2])+[rng.randint(1,6)]+sorted(a[len(a)//2:])
  k=encode(a)
  if k not in keys:keys.add(k);small.append(a)
 for a in small:assert oracle(a)==brute(a)
 oracles=[{'input':encode(a),'expectedOutput':f'{oracle(a)}\n'} for a in small]
 def fast(a):
  n=len(a);P=1
  while P<n and a[P-1]<=a[P]:P+=1
  if P==n:return n*(n+1)//2-1
  S=n-1
  while S>0 and a[S-1]<=a[S]:S-=1
  import bisect
  ans=n-max(1,S)
  for l in range(1,P+1):ans+=n-bisect.bisect_left(a,a[l-1],max(l+1,S),n)+1
  return ans
 for a in small:assert fast(a)==oracle(a)
 cases=[]
 def add(name,a,hidden=True,closed=None):
  e=fast(a)
  if closed is not None:assert e==closed,(name,e)
  cases.append(case(name,encode(a),f'{e}\n',hidden))
 add('样例1',[1,2,1,2],False,7);add('样例2',[3,1,2],False,3);add('样例3',[1,2,2,6,1,3],False,10)
 for i,a in enumerate(small[3:26]):add(f'小规模{i+1}',a)
 add('满规模已非降',sorted(rng.randint(1,V) for _ in range(N)),closed=N*(N+1)//2-1)
 add('满规模全相等',[7]*N,closed=N*(N+1)//2-1)
 add('满规模严格降序',list(range(N,0,-1)),closed=2)
 h=N//2
 add('满规模两段有序交错',list(range(1,2*h,2))+list(range(2,2*h+1,2)))
 add('满规模两段有序含相等',[x//2+1 for x in range(h)]+[x//2+1 for x in range(h)])
 add('满规模中间一个坏点',list(range(1,h))+[1]+list(range(h,N)))
 add('满规模随机',[rng.randint(1,V) for _ in range(N)])
 add('满规模前后长有序中间乱',sorted(rng.randint(1,V) for _ in range(N//3))+[rng.randint(1,V) for _ in range(N//3)]+sorted(rng.randint(1,V) for _ in range(N-2*(N//3))))
 add('满规模尾部极小值',list(range(1,N))+[1])
 add('满规模首部极大值',[V]+list(range(1,N)))
 def exhaustive(run):
  c=0
  for n in range(1,8):
   for a in product(range(1,4),repeat=n):
    e=brute(a);assert e==oracle(list(a))==fast(list(a));assert run(encode(a)).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':7,'values':[1,2,3]}
 P=problem(PID,'D. E. Shaw OA #1：删除子数组后有序','中等',['双指针','二分查找','数组'],
  '给定长度为n的整数数组arr。统计有多少个子数组（连续的一段，按位置区分），删除它之后剩下的数组非空并且按非降序排列（相邻元素允许相等）。',
  '第一行一个整数n；第二行n个整数arr[0..n−1]。1≤n≤200000，1≤arr[i]≤10^9。',
  '输出一个整数，表示满足条件的子数组个数。',
  '样例1：arr=[1,2,1,2]，共10个子数组。删除后得到[1,2]、[2]、[1,1,2]、[1,2]、[1]、[1,2,2]、[1,2]的7个满足条件；删除[1]得[2,1,2]、删除最后的[2]得[1,2,1]不有序，删除整个数组得到空数组，也不满足。\n样例2：删除[3]、[3,1]或[1,2]满足条件，答案3。\n样例3：满足条件的子数组为[1,2,2,6]、[1,2,2,6,1]、[2,2,6]、[2,2,6,1]、[2,2,6,1,3]、[2,6,1]、[2,6,1,3]、[6,1]、[6,1,3]、[1,3]，答案10。',
  ['剩余数组由一段前缀和一段后缀拼成。','前缀和后缀都必须非降，且衔接处左边不大于右边。','后缀有序，可以二分找到第一个可以衔接的位置。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'有序前缀与有序后缀的二分衔接','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent O(n^2) enumeration with precomputed prefix/suffix sortedness; literal removal-and-check brute force on small inputs; Python bisect implementation for formal cases; closed forms for sorted, constant and strictly decreasing arrays.',
  'imageProvenance':IMAGE_PROVENANCE+' original is the HackerRank statement with Table 1, constraints and two samples; example illustration is the same Table 1.',
  'rangeDisclosure':'Full original bounds preserved from the image: 1<=n<=2e5, 1<=arr[i]<=1e9. Stdin: n then n integers.',
  'corrections':['Image Table 1 marks [1,1,2] and [1,2,2] as sorted, fixing non-decreasing semantics.','Upstream md example 1 explanation copied example 2 text; replaced by the Table 1 enumeration.','Upstream md example 3 explanation listed [2,6],[6],[1] which do not leave a sorted array; image list ([2,2,6,1,3],[2,6,1,3],[6,1,3] instead) used. All outputs 7/3/10 unchanged.'],
  'reason':'原图表格确定非降序语义并给出完整约束与三样例；全范围有序前后缀二分，独立O(n²)枚举与直接删除检查核验。'})
if __name__=='__main__':main()
