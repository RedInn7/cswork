#!/usr/bin/env python3
"""Trade Desk #3 Earn the Most; window modification rule and example recovered from the source images."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-tradedesk-3';BATCH='tradedesk-3-recovered';SEED=20261008003+1
PATH='fastprep/Trade Desk/tdesk-about-profit.md'
N=100000;R=100000
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n,k;if(scanf("%d %d",&n,&k)!=2)return 0;vector<long long>r(n),s(n);for(auto&x:r)scanf("%lld",&x);for(auto&x:s)scanf("%lld",&x);
vector<long long>P(n+1,0),Q(n+1,0);for(int i=0;i<n;i++){P[i+1]=P[i]+s[i]*r[i];Q[i+1]=Q[i]+r[i];}
long long base=P[n],best=base;int h=k/2;
for(int l=0;l+k<=n;l++){long long v=base-(P[l+k]-P[l])+(Q[l+k]-Q[l+h]);best=max(best,v);}
printf("%lld\n",best);}
'''
MUTANTS=[
 {'name':'错误必须修改一次','language':'cpp','code':REFERENCE.replace('long long base=P[n],best=base;','long long base=P[n],best=-(long long)4e18;')},
 {'name':'错误前半段设为1后半段设为0','language':'cpp','code':REFERENCE.replace('+(Q[l+k]-Q[l+h])','+(Q[l+h]-Q[l])')},
 {'name':'错误窗口内原有操作不清除','language':'cpp','code':REFERENCE.replace('long long v=base-(P[l+k]-P[l])+(Q[l+k]-Q[l+h]);','long long v=base-(P[l+k]-P[l+h])+(Q[l+k]-Q[l+h]);')},
 {'name':'错误32位累计','language':'cpp','code':REFERENCE.replace('vector<long long>P(n+1,0),Q(n+1,0);','vector<int>P(n+1,0),Q(n+1,0);')},
]
EDITORIAL='''## 题意

rates[i]为第i天价格，strategy[i]∈{−1买,0持有,1卖}，利润=卖出价之和−买入价之和。可以（也可以不）选一段恰好k个连续元素，把前一半设为0、后一半设为1。求最大利润。

## 思路

原利润base=Σ strategy[i]·rates[i]。选窗口[l,l+k)后，窗口内原有贡献被清掉，后半段每天都变成卖出，所以新利润=base−Σ_{窗口} strategy[i]·rates[i]+Σ_{后半段} rates[i]。用两个前缀和O(1)计算每个窗口，答案取base与所有窗口值的最大值（因为可以不修改）。

## 正确性

窗口外的元素不变，窗口内的元素被完全覆盖，公式逐项对应。枚举了所有可能的窗口起点以及不修改的情况。

## 复杂度

O(n)。利润绝对值可达10^10，使用64位整数。

## 独立验证

oracle对每个窗口真正构造修改后的strategy数组再整体计算利润（O(nk)，仅小数据），不使用前缀和。穷举n=2..4、k取所有偶数、价格1..2、策略{−1,0,1}的全部组合并逐个真实运行参考程序。错误解覆盖强制修改、前后半段颠倒、不清除窗口前半段原有操作和32位累计。
'''
def encode(r,s,k):
 n=len(r);assert 2<=k<=n<=N and k%2==0 and len(s)==n and all(1<=x<=R for x in r) and set(s)<={-1,0,1}
 return f'{n} {k}\n'+' '.join(map(str,r))+'\n'+' '.join(map(str,s))+'\n'
def profit(r,s):return sum(a*b for a,b in zip(r,s))
def oracle(r,s,k):
 best=profit(r,s)
 for l in range(len(r)-k+1):
  t=list(s);t[l:l+k//2]=[0]*(k//2);t[l+k//2:l+k]=[1]*(k//2);best=max(best,profit(r,t))
 return best
def fast(r,s,k):
 n=len(r);P=[0];Q=[0]
 for a,b in zip(r,s):P.append(P[-1]+a*b);Q.append(Q[-1]+a)
 base=P[n];h=k//2
 return max([base]+[base-(P[l+k]-P[l])+(Q[l+k]-Q[l+h]) for l in range(n-k+1)])
def main():
 rng=random.Random(SEED)
 ex=([2,4,1,5,10,6],[-1,1,0,1,-1,0],4)
 assert oracle(*ex)==18==fast(*ex)
 small=[ex,([1,1],[1,1],2),([5,1],[0,1],2),([3,3,3,3],[1,1,1,1],2),([1,9],[-1,-1],2),([9,1,1,9],[1,0,0,1],4)]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(2,12);k=rng.choice(range(2,n+1,2))
  t=([rng.randint(1,rng.choice([5,R])) for _ in range(n)],[rng.choice([-1,0,1]) for _ in range(n)],k)
  if encode(*t) not in keys:keys.add(encode(*t));small.append(t)
 for t in small:assert oracle(*t)==fast(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False,closed=18);add('不修改更优',([1,1,10,10],[1,1,1,1],2),False,closed=22);add('整段修改',([3,1,4,1],[-1,-1,-1,-1],4),False,closed=5)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,r,s,k,closed=None):add(nm,(r,s,k),f=fast,closed=closed)
 big('满规模全买k为n',[R]*N,[-1]*N,N,closed=R*N//2)
 big('满规模全卖不修改',[R]*N,[1]*N,2,closed=R*N)
 big('满规模随机k=2',[rng.randint(1,R) for _ in range(N)],[rng.choice([-1,0,1]) for _ in range(N)],2)
 big('满规模随机中等k',[rng.randint(1,R) for _ in range(N)],[rng.choice([-1,0,1]) for _ in range(N)],2*rng.randint(100,5000))
 big('满规模全买随机价格',[rng.randint(1,R) for _ in range(N)],[-1]*N,N//2)
 big('满规模递增价格全持有',list(range(1,N+1)),[0]*N,1000)
 big('满规模前卖后买',[rng.randint(1,R) for _ in range(N)],[1]*(N//2)+[-1]*(N//2),N-2)
 def exhaustive(run):
  c=0
  for n in range(2,5):
   for r in product((1,2),repeat=n):
    for s in product((-1,0,1),repeat=n):
     for k in range(2,n+1,2):
      e=oracle(list(r),list(s),k);assert e==fast(list(r),list(s),k);assert run(encode(list(r),list(s),k)).split()==[str(e)];c+=1
  return c,{'nMin':2,'nMax':4,'rates':[1,2],'strategy':[-1,0,1],'k':'all even values <= n'}
 P=problem(PID,'Trade Desk OA #3：赚得最多','中等',['前缀和','滑动窗口','数组'],
  '你在设计一个交易单一货币的算法，每天可以买入一单位、卖出一单位或不操作。rates[i]是第i天的价格（正整数）；strategy[i]表示第i天的操作：−1买入，0持有（不买不卖），1卖出。另给一个偶数k。\n\n为了提升表现，你可以（也可以不）按如下方式修改strategy一次：选择恰好k个连续元素，把其中前一半设为0，后一半设为1。\n\n利润定义为所有卖出价之和减去所有买入价之和，可以为负。假设资金和持仓总是足够。求能得到的最大利润。',
  '第一行两个整数n和k；第二行n个整数rates；第三行n个整数strategy。2≤k≤n≤100000，k为偶数，1≤rates[i]≤100000，strategy[i]∈{−1,0,1}。',
  '输出一个整数，表示最大利润。',
  '样例1：rates=[2,4,1,5,10,6]，strategy=[−1,1,0,1,−1,0]，k=4。不修改时利润为−2+4+5−10=−3；选下标2..5，strategy变为[−1,1,0,0,1,1]，利润−2+4+10+6=18。\n样例2：rates=[1,1,10,10]，全部卖出，原利润22；k=2的任何修改都会把一个卖出变成持有，不修改最优。\n样例3：全部买入，选整段后变为[0,0,1,1]，利润4+1=5。',
  ['先算不修改时的利润。','窗口内原有贡献全部清除，后半段每天按卖出计入。','用前缀和O(1)计算每个窗口，别忘了可以不修改。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'前缀和枚举修改窗口','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent explicit rebuild of the modified strategy for every window and full profit recomputation; exhaustive n=2..4 with rates {1,2}, all strategies and all even k.',
  'imageProvenance':IMAGE_PROVENANCE+' original-0: transcribed CodeSignal statement with the example (explanation truncated after Day 1); original-1: photo of the original statement, consistent.',
  'rangeDisclosure':'Source images give no constraints (TO-DO). Chosen: 2<=k<=n<=1e5, k even, 1<=rates[i]<=1e5, strategy in {-1,0,1}; profit is exact 64-bit. "May change" means the unmodified strategy is also allowed. Stdin: "n k", rates, strategy.',
  'corrections':['Upstream md has no example and paraphrased names (prices/approach/mrK); image names rates/strategy/k and example output 18 used.','Second and third public examples are authored.'],
  'reason':'原图给出买卖持有编码、恰好k个连续元素前半置0后半置1的可选修改与利润定义，样例18；原图无约束，自选n≤1e5、价格≤1e5；前缀和枚举窗口，独立显式重建核验。'})
if __name__=='__main__':main()
