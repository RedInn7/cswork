#!/usr/bin/env python3
"""Quora #1 count array elements that are powers of k; target operation recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-quora-1';BATCH='quora-1-recovered';SEED=20261008101+1
PATH='fastprep/Quora/quora-count-powers-of-k.md'
N=200000;V=10**18
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
typedef unsigned long long u64;
int main(){int n;u64 k;if(scanf("%d %llu",&n,&k)!=2)return 0;const u64 LIM=1000000000000000000ULL;vector<u64>pw;
for(u64 p=k;;){pw.push_back(p);if(p>LIM/k)break;p*=k;}
long long c=0;for(int i=0;i<n;i++){u64 x;scanf("%llu",&x);if(find(pw.begin(),pw.end(),x)!=pw.end())c++;}
printf("%lld\n",c);}
'''
MUTANTS=[
 {'name':'错误用浮点对数判断','language':'cpp','code':r'''#include <cstdio>
#include <cmath>
int main(){int n;unsigned long long k;scanf("%d %llu",&n,&k);long long c=0;for(int i=0;i<n;i++){unsigned long long x;scanf("%llu",&x);double e=log((double)x)/log((double)k);if(fabs(e-llround(e))<1e-9&&llround(e)>=1)c++;}printf("%lld\n",c);}
'''},
 {'name':'错误只判断能否被k整除','language':'cpp','code':r'''#include <cstdio>
int main(){int n;unsigned long long k;scanf("%d %llu",&n,&k);long long c=0;for(int i=0;i<n;i++){unsigned long long x;scanf("%llu",&x);if(x%k==0)c++;}printf("%lld\n",c);}
'''},
 {'name':'错误只考虑一次和二次幂','language':'cpp','code':REFERENCE.replace('if(p>LIM/k)break;p*=k;}','if(p>LIM/k||pw.size()>=2)break;p*=k;}')},
 {'name':'错误按32位整数读入','language':'cpp','code':r'''#include <cstdio>
int main(){int n,k;scanf("%d %d",&n,&k);long long c=0;for(int i=0;i<n;i++){int x;scanf("%d",&x);int y=x;while(k>1&&y!=0&&y%k==0)y/=k;if(y==1&&x!=1)c++;}printf("%lld\n",c);}
'''},
]
EDITORIAL='''## 题意

给定数组arr和整数k，统计arr中有多少个数是k的幂（k^1、k^2、…）。本题中k与arr的元素都至少为2。

## 思路

k≥2时，不超过10^18的k的幂最多60个。先从k开始不断乘k生成全部幂，乘之前用p>10^18/k判断是否会超过上界，避免溢出；然后对每个元素检查是否在这张表中。

## 正确性

元素都≥2，所以k^0=1不会出现；生成的表恰好包含所有≤10^18的正次幂。逐个比较即得计数。

## 复杂度

O(n·log_k 10^18)，最多约60n次比较。

## 独立验证

oracle对每个元素反复除以k，直到不能整除为止，余下为1则是幂（Python大整数，无溢出），与参考的“生成幂表”方式不同。穷举k=2..4、元素2..20组成的长度1..3数组并逐个真实运行参考程序。正式用例包含接近10^18的幂与非幂（如10^18−1）、k很大只有一次幂、k=2的全部60个幂等。错误解覆盖浮点对数、只判整除、只看一二次幂和32位读入。
'''
def encode(k,a):
 assert 1<=len(a)<=N and 2<=k<=V and all(2<=x<=V for x in a)
 return f'{len(a)} {k}\n'+' '.join(map(str,a))+'\n'
def ispow(x,k):
 while x%k==0:x//=k
 return x==1
def oracle(k,a):return sum(1 for x in a if ispow(x,k))
def powers(k):
 p=k;r=[]
 while p<=V:r.append(p);p*=k
 return r
def main():
 rng=random.Random(SEED)
 ex=(11,[11,121,10])
 small=[ex,(2,[2]),(2,[3]),(2,[4,8,16,6,12]),(10,[10,100,1000,110,V,V-1]),(V,[V,V-1,2]),(3,[3,9,27,81,243,6,18]),(7,[49,343,14,2401,98])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  k=rng.choice([2,3,5,10,rng.randint(2,50),rng.randint(2,10**9)]);pw=powers(k)
  a=[rng.choice(pw) if rng.random()<0.5 else rng.choice([rng.randint(2,100),rng.choice(pw)+rng.choice([-1,1]) if rng.choice(pw)>2 else 5,rng.randint(2,V)]) for _ in range(rng.randint(1,10))]
  a=[max(2,min(V,x)) for x in a]
  t=(k,a)
  if encode(*t) not in keys:keys.add(encode(*t));small.append(t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,closed=None):
  e=oracle(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False,2);add('二的幂',(2,[2,4,6,8,1024]),False,4);add('k本身不在数组',(5,[10,20,30]),False,0)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 p2=powers(2)
 add('满规模二的全部幂循环',(2,[p2[i%len(p2)] for i in range(N)]),closed=N)
 add('满规模十的幂及其邻数',(10,[x+d for x in powers(10) for d in (-1,0,1) if 2<=x+d<=V]*(N//54)))
 add('满规模大k只有一次幂',(10**9,[rng.choice([10**9,10**18,10**9+1,10**18-1,999999999]) for _ in range(N)]))
 add('满规模随机大数',(rng.randint(2,1000),[rng.randint(2,V) for _ in range(N)]))
 k3=3;p3=powers(3)
 add('满规模三的幂与两倍',(3,[rng.choice(p3)*rng.choice([1,1,2]) for _ in range(N)]))
 kb=999999937;add('满规模大质数平方',(kb,[rng.choice([kb,kb*kb,kb*kb-1,kb+1]) for _ in range(N)]))
 add('满规模接近上界的二的幂',(2,[rng.choice([2**59,2**59+1,2**59-1,2**58*3]) for _ in range(N)]))
 def exhaustive(run):
  c=0
  for k in (2,3,4):
   for n in range(1,4):
    for a in product(range(2,21),repeat=n):
     if n==3 and any(x>10 for x in a):continue
     e=oracle(k,list(a));assert run(encode(k,list(a))).split()==[str(e)];c+=1
  return c,{'k':[2,3,4],'nMax':3,'values':'2..20 (n<=2), 2..10 (n=3)'}
 P=problem(PID,'Quora OA #1：统计k的幂','简单',['数学','枚举'],
  '给定一个整数数组arr和一个整数k，统计数组中有多少个数是k的幂，即可以写成k^e（e为正整数）的数。',
  '第一行两个整数n和k；第二行n个整数arr[0..n−1]。1≤n≤200000，2≤k≤10^18，2≤arr[i]≤10^18。',
  '输出一个整数，表示是k的幂的元素个数。',
  '样例1：arr=[11,121,10]，k=11。11=11^1，121=11^2，10不是，答案2。\n样例2：2、4、8、1024都是2的幂，6不是，答案4。\n样例3：10、20、30都不是5的幂，答案0。',
  ['k≥2时，不超过10^18的k的幂不超过60个。','生成幂时先判断是否会超过上界，避免溢出。','不要用浮点对数判断，精度不够。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'生成幂表并逐个比对','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent repeated exact division by k with Python big integers; exhaustive small arrays for k=2..4; closed form for an all-powers array.',
  'imageProvenance':IMAGE_PROVENANCE+' One-sentence interview-report screenshot with the task and example.',
  'rangeDisclosure':'Source image gives no constraints and does not say whether 1=k^0 counts or how k<=1 behaves. Chosen bounds avoid both: 1<=n<=2e5, 2<=k<=1e18, 2<=arr[i]<=1e18 (powers are k^e with e>=1). Stdin: "n k" then n integers.',
  'corrections':['Upstream md statement truncated; target operation (count elements that are powers of k) supplied by the image. Output 2 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出“统计数组中k的幂个数”；k^0与k≤1等边界未说明，范围选k与元素均≥2使其不出现；原图无约束，自选n≤2e5、值≤1e18；幂表比对，独立反复整除核验。'})
if __name__=='__main__':main()
