#!/usr/bin/env python3
"""Fortinet #1 calculate maximum profit (0-1 knapsack with profit 2^i); statement recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-fortinet-1';BATCH='fortinet-1-recovered';SEED=20261008161
PATH='fastprep/Fortinet/fortinet-calculate-maximum-profit.md'
N=100000;C=10**9;X=10**14;MOD=10**9+7
REFERENCE=r'''#include <cstdio>
#include <vector>
int main(){int n;long long x;if(scanf("%d %lld",&n,&x)!=2)return 0;std::vector<long long>c(n);for(auto&v:c)scanf("%lld",&v);
const long long MOD=1000000007LL;std::vector<long long>pw(n);for(int i=0;i<n;i++)pw[i]=i?pw[i-1]*2%MOD:1;
long long rem=x,ans=0;for(int i=n-1;i>=0;i--)if(c[i]<=rem){rem-=c[i];ans=(ans+pw[i])%MOD;}
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误从下标小的物品开始贪心','language':'cpp','code':REFERENCE.replace('for(int i=n-1;i>=0;i--)if(c[i]<=rem)','for(int i=0;i<n;i++)if(c[i]<=rem)')},
 {'name':'错误成本必须严格小于剩余资金','language':'cpp','code':REFERENCE.replace('if(c[i]<=rem)','if(c[i]<rem)')},
 {'name':'错误不取模','language':'cpp','code':REFERENCE.replace('pw[i]=i?pw[i-1]*2%MOD:1;','pw[i]=i?(pw[i-1]*2)%(1LL<<62):1;').replace('ans=(ans+pw[i])%MOD;','ans=(ans+pw[i])%(1LL<<62);')},
 {'name':'错误32位资金','language':'cpp','code':REFERENCE.replace('long long rem=x,ans=0;','int rem=(int)x;long long ans=0;')},
]
EDITORIAL='''## 题意

n件商品，第i件（0起）成本cost[i]，转售利润2^i。总资金x，每件最多买一次，总成本不超过x，求最大利润，对10^9+7取模。

## 思路

2^i大于所有更小下标利润之和（2^0+…+2^(i−1)=2^i−1），所以利润的比较等价于“从高下标往低下标的字典序”比较。从最高下标往下贪心：当前商品成本不超过剩余资金就买，并扣除成本。累加2^i时取模。

## 正确性

设贪心在下标i第一次与某最优解不同。若贪心买了i而最优解没买，则贪心利润在i处多出2^i，大于最优解在更低下标上的全部收益，矛盾；若贪心没买i，说明在已选的更高下标集合下买i超预算，最优解与贪心在更高下标相同，也不能买i。故贪心最优。比较全程用真实利润的结构而不是取模后的数，取模只发生在累加时。

## 复杂度

O(n)。资金可达10^14，使用64位。

## 独立验证

oracle枚举全部子集，以Python大整数计算真实利润取最大值再取模（仅小数据），不使用贪心。穷举n=1..5、成本1..3、x=1..7的所有组合并逐个真实运行参考程序。错误解覆盖从低下标贪心、成本恰等于剩余资金时不买、不取模和32位资金。
'''
def encode(c,x):
 assert 1<=len(c)<=N and 1<=x<=X and all(1<=v<=C for v in c)
 return f'{len(c)} {x}\n'+' '.join(map(str,c))+'\n'
def oracle(c,x):
 best=0;n=len(c)
 for m in range(1<<n):
  if sum(c[i] for i in range(n) if m>>i&1)<=x:best=max(best,m)
 return best%MOD
def greedy(c,x):
 rem=x;ans=0
 for i in range(len(c)-1,-1,-1):
  if c[i]<=rem:rem-=c[i];ans+=pow(2,i,MOD)
 return ans%MOD
def main():
 rng=random.Random(SEED)
 ex=([10,20,14,40,50],70)
 assert oracle(*ex)==20==greedy(*ex)
 small=[ex,([5],5),([5],4),([1,1,1],2),([3,1,1],2),([7,7],7),([1,2,3,4],5),([10,1],1)]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(1,14);c=[rng.randint(1,rng.choice([5,100,C])) for _ in range(n)];x=rng.randint(1,max(1,sum(c)))
  if encode(c,x) not in keys:keys.add(encode(c,x));small.append((c,x))
 for t in small:assert oracle(*t)==greedy(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False,closed=20);add('恰好花完资金',([3,4],7),False,closed=3);add('最高下标买不起',([1,1,9],2),False,closed=3)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,t,closed=None):add(nm,t,f=greedy,closed=closed)
 big('满规模全部买得起',([C]*N,X),closed=(pow(2,N,MOD)-1)%MOD)
 big('满规模只买得起一件',([C]*N,C),closed=pow(2,N-1,MOD))
 big('满规模随机',([rng.randint(1,C) for _ in range(N)],rng.randint(1,X)))
 big('满规模资金超过32位',([rng.randint(1,10**6) for _ in range(N)],5*10**9))
 big('满规模递增成本',([i+1 for i in range(N)],N*(N+1)//4))
 big('满规模递减成本',([N-i for i in range(N)],N*(N+1)//4))
 big('满规模恰好等于剩余',([1]*(N-1)+[N-1],N-1),closed=pow(2,N-1,MOD))
 def exhaustive(run):
  c=0
  for n in range(1,6):
   for cs in product((1,2,3),repeat=n):
    for x in range(1,8):
     e=oracle(list(cs),x);assert e==greedy(list(cs),x);assert run(encode(list(cs),x)).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':5,'costs':[1,2,3],'x':[1,7]}
 P=problem(PID,'Fortinet OA #1：最大利润','中等',['贪心','位运算'],
  '有n件不同的商品可以购买后转售。第i件商品（下标从0开始）的成本为cost[i]，转售利润为2^i。你共有x元资金，每件商品最多购买一次，所购商品总成本不能超过x。求能获得的最大利润。答案可能很大，输出对10^9+7取模的结果。',
  '第一行两个整数n和x；第二行n个整数cost[0..n−1]。1≤n≤100000，1≤cost[i]≤10^9，1≤x≤10^14。',
  '输出一个整数：最大利润对10^9+7取模的值。',
  '样例1：cost=[10,20,14,40,50]，x=70。购买0,1,2（成本44）利润7；0和4（成本60）利润17；1和4（成本70）利润18；2和4（成本64）利润20，这是最大值。\n样例2：两件都买恰好花完7元，利润1+2=3。\n样例3：下标2的商品买不起，买下标0和1，利润3。',
  ['2^i大于所有更小下标的利润之和。','从高下标往低下标贪心，能买就买。','只在累加利润时取模，比较时不要用取模后的值。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'按二进制高位贪心的背包','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent subset enumeration with exact big-integer profit (bitmask value) and final modulo; exhaustive n<=5 with costs 1..3 and x 1..7; closed forms for uniform-cost inputs.',
  'imageProvenance':IMAGE_PROVENANCE+' Screenshot of the full statement (profit 2**i, budget x, modulo 1e9+7) with the example and function signature; no constraints.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=n<=1e5, 1<=cost[i]<=1e9, 1<=x<=1e14. Stdin: "n x" then n costs.',
  'corrections':['Upstream md statement is only "$"; full statement supplied by the image. Output 20 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出成本cost[i]、利润2^i、预算x的0-1选择与取模要求；原图无约束，自选n≤1e5、成本≤1e9、x≤1e14；高位贪心，独立子集枚举核验。'})
if __name__=='__main__':main()
