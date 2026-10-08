#!/usr/bin/env python3
"""Salesforce #17 maximum sum of strengths, rules recovered from the HackerRank source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-salesforce-17';BATCH='salesforce-17-recovered';SEED=20261008017
PATH='fastprep/Salesforce/salesforce-get-maximum-sum-of-strengths.md'
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>a(n+1);for(int i=1;i<=n;i++)scanf("%lld",&a[i]);
vector<long long>dp(n+1,0);
for(int i=1;i<=n;i++){dp[i]=dp[i-1]+a[i]*i;if(i>=2)dp[i]=max(dp[i],dp[i-2]+a[i]*(i-1)+a[i-1]*i);}
printf("%lld\n",dp[n]);}
'''
MUTANTS=[
 {'name':'错误从左到右贪心交换','language':'cpp','code':r'''#include <cstdio>
#include <vector>
using namespace std;
int main(){int n;scanf("%d",&n);vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
for(int i=0;i+1<n;i++)if(a[i]>a[i+1]){long long t=a[i];a[i]=a[i+1];a[i+1]=t;i++;}
long long s=0;for(int i=0;i<n;i++)s+=a[i]*(i+1);printf("%lld\n",s);}
'''},
 {'name':'错误允许同一元素多次参与交换','language':'cpp','code':r'''#include <cstdio>
#include <vector>
using namespace std;
int main(){int n;scanf("%d",&n);vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
long long s=0;for(int i=0;i<n;i++)s+=a[i]*(i+1);for(int i=0;i+1<n;i++)if(a[i]>a[i+1])s+=a[i]-a[i+1];printf("%lld\n",s);}
'''},
 {'name':'错误32位整数累加','language':'cpp','code':REFERENCE.replace('vector<long long>dp(n+1,0);','vector<int>dp(n+1,0);').replace('dp[i]=max(dp[i],dp[i-2]+a[i]*(i-1)+a[i-1]*i);','dp[i]=max<long long>(dp[i],dp[i-2]+a[i]*(i-1)+a[i-1]*i);').replace('printf("%lld\\n",dp[n]);','printf("%d\\n",dp[n]);')},
 {'name':'错误1-based权重按下标i计','language':'cpp','code':REFERENCE.replace('dp[i]=dp[i-1]+a[i]*i;','dp[i]=dp[i-1]+a[i]*(i-1);').replace('dp[i-2]+a[i]*(i-1)+a[i-1]*i','dp[i-2]+a[i]*(i-2)+a[i-1]*(i-1)')},
]
EDITORIAL='''## 题意

数组每个位置i（0起）的强度为arr[i]×(i+1)。可以交换相邻两元素，但每个元素至多参与一次交换，因此最终做的交换是一组互不重叠的相邻对。求强度和的最大值。

## 思路

交换相邻对(i,i+1)只改变这两项：新值减旧值恰好是arr[i]−arr[i+1]。各对的收益互相独立，唯一限制是所选对不能共享元素。于是用前缀DP：dp[i]表示前i个元素（1起计）的最大强度和，第i个元素要么不交换，dp[i]=dp[i−1]+arr[i]·i；要么与第i−1个元素交换，dp[i]=dp[i−2]+arr[i]·(i−1)+arr[i−1]·i。答案为dp[n]。

## 正确性

任意合法交换集合把数组划分成长度1的单点块和长度2的交换块，块内强度只与块的位置和块内元素有关，块之间互不影响。dp[i]枚举了最后一个块的两种形态，取二者最大值，按归纳即得前缀的最优值。贪心从左往右遇到逆序就交换是错的：[4,3,1]中交换(3,1)收益2，大于交换(4,3)的收益1，但二者共享元素3。

## 复杂度

O(n)时间、O(n)空间。最大值约为10^5×n(n+1)/2≈5×10^14，必须用64位整数。

## 独立验证

oracle先算不交换的强度和，再对收益max(0,arr[i]−arr[i+1])做不相邻选取的最大和，与参考解的块DP形式不同。小域另枚举所有互不重叠的相邻交换集合直接求最大值，穷举长度1..7、取值1..3的全部数组并逐个真实运行参考程序。错误解覆盖左到右贪心、允许元素重复交换、32位溢出和权重错位。
'''
def encode(a):
 assert 1<=len(a)<=100000 and all(1<=v<=100000 for v in a)
 return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def oracle(a):
 base=sum(v*(i+1) for i,v in enumerate(a));take=skip=0
 for i in range(len(a)-1):
  g=max(0,a[i]-a[i+1]);take,skip=skip+g,max(take,skip)
 return base+max(take,skip)
def brute(a):
 n=len(a);best=0
 def rec(i,b):
  nonlocal best
  if i>=n-1:best=max(best,sum(v*(k+1) for k,v in enumerate(b)));return
  rec(i+1,b);c=b[:];c[i],c[i+1]=c[i+1],c[i];rec(i+2,c)
 rec(0,list(a));return best
def main():
 rng=random.Random(SEED)
 small=[[1,9,7,3,2],[2,1,4,3],[1,2,5],[5],[1],[2,1],[1,2],[3,2,1],[4,3,1],[1,3,2,4],[5,4,3,2,1],[1,1,1],[3,1,2],[2,3,1]]
 keys={encode(a) for a in small}
 while len(small)<170:
  a=[rng.randint(1,rng.choice([3,10,100000])) for _ in range(rng.randint(1,12))];k=encode(a)
  if k not in keys:keys.add(k);small.append(a)
 for a in small:assert oracle(a)==brute(a)
 oracles=[{'input':encode(a),'expectedOutput':f'{oracle(a)}\n'} for a in small]
 cases=[]
 def add(name,a,hidden=True,closed=None):
  e=oracle(a)
  if closed is not None:assert e==closed,(name,e)
  cases.append(case(name,encode(a),f'{e}\n',hidden))
 add('样例1',[1,9,7,3,2],False,66);add('样例2',[2,1,4,3],False,30);add('样例3',[1,2,5],False,20)
 for i,a in enumerate(small[3:24]):add(f'小规模{i+1}',a)
 N=100000
 add('满规模全部最大值',[100000]*N,closed=100000*N*(N+1)//2)
 add('满规模严格降序',list(range(N,0,-1)))
 add('满规模严格升序',list(range(1,N+1)),closed=sum(i*i for i in range(1,N+1)))
 add('满规模两两逆序',[x for i in range(N//2) for x in (2*i+2,2*i+1)])
 add('满规模链式冲突',[x for i in range(N//3) for x in (100000,99999,1)]+[1])
 add('满规模随机大值',[rng.randint(1,100000) for _ in range(N)])
 add('满规模随机小值',[rng.randint(1,3) for _ in range(N)])
 add('满规模峰谷交替',[100000 if i%2==0 else 1 for i in range(N)])
 add('边界单个元素',[77777])
 add('边界两元素逆序',[100000,1])
 add('满规模随机块',[rng.randint(1,100000) if (i//50)%2 else 100000-i%50 for i in range(N)])
 add('满规模全一',[1]*N,closed=N*(N+1)//2)
 add('满规模中等随机',[rng.randint(1,1000) for _ in range(N)])
 def exhaustive(run):
  c=0
  for n in range(1,8):
   for a in product(range(1,4),repeat=n):
    e=brute(a);assert e==oracle(list(a));assert run(encode(a)).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':7,'values':[1,2,3]}
 P=problem(PID,'Salesforce OA #17：最大强度和','中等',['动态规划','贪心','数组'],
  '给定长度为n的整数数组arr，可进行任意次（可以为0次）如下操作：选择下标i（0≤i<n−1），交换arr[i]与arr[i+1]。整个过程中数组的每个元素至多参与一次交换。\n\n下标i（0起）的强度定义为arr[i]×(i+1)。求所有操作结束后，Σ arr[i]×(i+1)（i从0到n−1）的最大可能值。',
  '第一行一个整数n；第二行n个整数arr[0..n−1]，以空白分隔。1≤n≤100000，1≤arr[i]≤100000。',
  '输出一个整数，表示最大强度和。',
  '样例1：交换arr[2]与arr[3]得到[1,9,3,7,2]，强度和1×1+2×9+3×3+4×7+5×2=66。\n样例2：交换(arr[0],arr[1])与(arr[2],arr[3])得到[1,2,3,4]，强度和30。\n样例3：无需交换，强度和1×1+2×2+3×5=20。',
  ['交换相邻两个元素只改变这两项的贡献。','每个元素至多交换一次，意味着选出的交换对互不重叠。','对前缀做动态规划：最后一个元素要么不动，要么与前一个交换。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'不重叠相邻交换的前缀动态规划','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent Python base sum plus maximum non-adjacent selection of adjacent-swap gains; explicit enumeration of all non-overlapping adjacent swap sets on small inputs; closed forms for uniform and ascending arrays.',
  'imageProvenance':IMAGE_PROVENANCE+' original-0 is the clean HackerRank statement with operation, 0-based strength, constraints and two samples; original-1 is a low-quality forum OCR copy consistent with it.',
  'rangeDisclosure':'Full original bounds preserved from the source image: 1<=n<=1e5, 1<=arr[i]<=1e5. Stdin: n then n integers.',
  'corrections':['Upstream md "swap arr[i]" with 1<=i<=n is incomplete; image gives swap arr[i] and arr[i+1] with 0<=i<n-1.','Upstream md strength "(arr[i]+1)" with 1-based indexing replaced by image definition arr[i]*(i+1) with 0-based indexing; all three sample outputs (66,30,20) are unchanged and consistent.'],
  'reason':'原图给出相邻交换、每元素至多交换一次与arr[i]×(i+1)强度定义，三样例与规则一致；全范围前缀DP，独立收益不相邻选取与交换集合枚举核验。'})
if __name__=='__main__':main()
