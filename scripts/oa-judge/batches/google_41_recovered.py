#!/usr/bin/env python3
"""Google #41 maximize points with forward blocking; rule recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-google-41';BATCH='google-41-recovered';SEED=20261008041
PATH='fastprep/Google/google-maximize-points.md'
N=200000;V=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>p(n);for(auto&x:p)scanf("%lld",&x);
vector<long long>dp(n+1,0);
for(int i=n-1;i>=0;i--){long long nx=min<long long>(n,i+p[i]+1);dp[i]=max(dp[i+1],p[i]+dp[nx]);}
printf("%lld\n",dp[0]);}
'''
MUTANTS=[
 {'name':'错误只屏蔽后面v-1个下标','language':'cpp','code':REFERENCE.replace('i+p[i]+1','max<long long>(i+1,i+p[i])')},
 {'name':'错误屏蔽后面v+1个下标','language':'cpp','code':REFERENCE.replace('i+p[i]+1','i+p[i]+2')},
 {'name':'错误从左到右贪心取能取的最大值','language':'cpp','code':r'''#include <cstdio>
#include <vector>
using namespace std;
int main(){int n;scanf("%d",&n);vector<long long>p(n);for(auto&x:p)scanf("%lld",&x);long long s=0;long long i=0;
while(i<n){long long b=i;for(long long j=i;j<n&&j<=i+2;j++)if(p[j]>p[b])b=j;s+=p[b];i=b+p[b]+1;}printf("%lld\n",s);}
'''},
 {'name':'错误当作相邻不可同取','language':'cpp','code':REFERENCE.replace('i+p[i]+1','i+2')},
]
EDITORIAL='''## 题意

数组points中下标i的值v=points[i]既是得分，也是代价：取了它之后，紧随其后的v个下标i+1..i+v都不能再取。只向后屏蔽。求最大总分。

## 思路

从右往左DP：dp[i]表示只考虑下标i..n−1时的最大得分。不取i则为dp[i+1]；取i则得到points[i]+dp[min(n,i+points[i]+1)]。答案dp[0]。

## 正确性

取了下标i后，下一个能取的下标至少是i+points[i]+1，而之后的选择不受i以前任何决策的影响（屏蔽只向后），因此子问题独立，转移覆盖了i取或不取两种情况。样例中先取1（屏蔽3），再取99得到100，如果屏蔽是双向的，99会屏蔽前面的1，样例就不成立。

## 复杂度

O(n)。取一个值v要占用v+1个位置，所以总分不超过n。

## 独立验证

oracle采用“推”式DP：best[j]表示下一个可取下标为j时的最大得分，从左到右向后转移，与参考解的拉式后缀DP方向不同；更小的数据另枚举所有下标子集并检查屏蔽条件。穷举长度1..6、取值0..3的全部数组并逐个真实运行参考程序。错误解覆盖屏蔽个数少1、多1、局部贪心和误当作“相邻不能同取”。
'''
def encode(a):
 assert 1<=len(a)<=N and all(0<=v<=V for v in a)
 return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def oracle(a):
 n=len(a);best=[-1]*(n+1);best[0]=0
 for i in range(n):
  if best[i]<0:continue
  best[i+1]=max(best[i+1],best[i])
  j=min(n,i+a[i]+1);best[j]=max(best[j],best[i]+a[i])
 return best[n]
def brute(a):
 n=len(a);b=0
 for m in range(1<<n):
  idx=[i for i in range(n) if m>>i&1]
  if all(idx[k+1]>idx[k]+a[idx[k]] for k in range(len(idx)-1)):b=max(b,sum(a[i] for i in idx))
 return b
def main():
 rng=random.Random(SEED)
 small=[[25,1,3,99,4],[5],[0],[0,0,0],[1,1,1,1],[2,2,2,2],[1,100],[100,1],[3,1,1,1,9],[1,2,3,4,5],[5,4,3,2,1]]
 keys={encode(a) for a in small}
 while len(small)<170:
  a=[rng.randint(0,rng.choice([3,10,V])) for _ in range(rng.randint(1,14))];k=encode(a)
  if k not in keys:keys.add(k);small.append(a)
 for a in small:assert oracle(a)==brute(a)
 oracles=[{'input':encode(a),'expectedOutput':f'{oracle(a)}\n'} for a in small]
 cases=[]
 def add(nm,a,hidden=True,closed=None):
  e=oracle(a)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(a),f'{e}\n',hidden))
 add('样例1',small[0],False,100);add('取0不屏蔽',[0,4,0,5],False,5);add('跳过大值',[2,1,1,1,6],False,8)
 for i,a in enumerate(small[1:28]):add(f'小规模{i+1}',a)
 add('满规模全为1',[1]*N,closed=N//2)
 add('满规模全为0',[0]*N,closed=0)
 add('满规模全为最大值',[V]*N,closed=V)
 add('满规模随机小值',[rng.randint(0,5) for _ in range(N)])
 add('满规模随机大值',[rng.randint(0,V) for _ in range(N)])
 add('满规模尾部大值',[1]*(N-1000)+[V-i for i in range(1000)])
 add('满规模随机中值',[rng.randint(0,300) for _ in range(N)])
 def exhaustive(run):
  c=0
  for n in range(1,7):
   for a in product(range(4),repeat=n):
    e=brute(a);assert e==oracle(list(a));assert run(encode(a)).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':6,'values':[0,1,2,3]}
 P=problem(PID,'Google OA #41：屏蔽后续下标的最大得分','中等',['动态规划','数组'],
  '给定数组points，每个下标上的值就是该位置的得分。如果取了某个下标上值为v的得分，那么紧接着它之后的v个下标都不能再取（只影响后面的下标）。求能取得的最大总得分。',
  '第一行n；第二行n个整数points[0..n−1]。1≤n≤200000，0≤points[i]≤10^9。',
  '输出一个整数，表示最大总得分。',
  '样例1：[25,1,3,99,4]，取下标1的1（屏蔽下标2），再取下标3的99，共100。\n样例2：[0,4,0,5]，取值为0的位置不屏蔽任何下标；取5（以及两个0）得5，取4会屏蔽后面的0和5。\n样例3：[2,1,1,1,6]，取下标0的2屏蔽下标1、2，再取下标4的6，共8。',
  ['取了下标i以后，下一个可以取的下标是i+points[i]+1。','从右向左做动态规划。','值为0的位置不会屏蔽任何下标。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'只向后屏蔽的后缀动态规划','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent forward push DP over the next-allowed index; subset enumeration with explicit blocking check on small arrays; closed forms for uniform arrays.',
  'imageProvenance':IMAGE_PROVENANCE+' Interview-report text screenshot with the rule and one example; no constraints.',
  'rangeDisclosure':'Source image gives no constraints. Chosen bounds: 1<=n<=2e5, 0<=points[i]<=1e9. Forward-only blocking is literal ("next v index") and is the only reading consistent with the sample. Stdin: n then n integers.',
  'corrections':['Upstream md statement truncated after "Given a"; rule supplied by the image. Sample output 100 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出“取值v则屏蔽后面v个下标”的规则，样例唯一支持只向后屏蔽；原图无约束，自选n≤2e5、0≤值≤1e9；后缀DP，独立推式DP与子集枚举核验。'})
if __name__=='__main__':main()
