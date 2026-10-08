#!/usr/bin/env python3
"""Goldman Sachs #32 threshold alerts; trailing-window definition and example recovered from the source image."""
from pathlib import Path
from itertools import product
from fractions import Fraction
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-goldman-sachs-32';BATCH='goldman-sachs-32-recovered';SEED=20261008032
PATH='fastprep/Goldman Sachs/threshold-alerts.md'
N=100000;V=100000
REFERENCE=r'''#include <cstdio>
#include <vector>
int main(){int k;long long th;int n;if(scanf("%d %lld %d",&k,&th,&n)!=3)return 0;std::vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
long long s=0;int c=0;for(int i=0;i<n;i++){s+=a[i];if(i>=k)s-=a[i-k];if(i>=k-1&&s>th*k)c++;}
printf("%d\n",c);}
'''
MUTANTS=[
 {'name':'错误平均值用整数除法','language':'cpp','code':REFERENCE.replace('s>th*k','s/k>th')},
 {'name':'错误平均值等于阈值也报警','language':'cpp','code':REFERENCE.replace('s>th*k','s>=th*k')},
 {'name':'错误窗口不满时也按已有分钟平均','language':'cpp','code':REFERENCE.replace('if(i>=k-1&&s>th*k)c++;','int len=i+1<k?i+1:k;if(s>th*len)c++;')},
 {'name':'错误32位累计','language':'cpp','code':REFERENCE.replace('long long s=0;','int s=0;').replace('s>th*k','s>(int)(th*k)')},
]
EDITORIAL='''## 题意

第T分钟（从1开始）的平均值取T−(k−1)..T共k分钟的通话量的平均（k=precedingMinutes），平均值严格大于alertThreshold时发一次警报；T<k时窗口不完整，不发警报。求警报总数。

## 思路

滑动窗口维护最近k分钟的通话量之和s。平均值s/k>threshold等价于s>threshold·k，全部用64位整数比较，避免浮点和整数除法带来的误差。

## 正确性

窗口从T=k开始才完整；每个T恰好检查一次。不等式两边同乘正数k不改变大小关系，所以与实数平均的比较完全一致。

## 复杂度

O(n)。窗口和最大10^10，threshold·k最大10^10，需要64位。

## 独立验证

oracle对每个T用分数精确计算平均值再与阈值比较（O(nk)，仅小数据），不使用滑动和或移项。穷举n=1..5、k=1..n、通话量0..3、阈值1..3的全部组合并逐个真实运行参考程序。错误解覆盖整数除法、等于也报警、窗口不满也计算和32位累计。
'''
def encode(k,th,a):
 assert 1<=len(a)<=N and 1<=k<=len(a) and 1<=th<=V and all(0<=x<=V for x in a)
 return f'{k}\n{th}\n{len(a)}\n'+'\n'.join(map(str,a))+'\n'
def oracle(k,th,a):return sum(1 for T in range(k,len(a)+1) if Fraction(sum(a[T-k:T]),k)>th)
def fast(k,th,a):
 s=0;c=0
 for i,x in enumerate(a):
  s+=x
  if i>=k:s-=a[i-k]
  if i>=k-1 and s>th*k:c+=1
 return c
def main():
 rng=random.Random(SEED)
 ex=(3,4,[2,2,2,2,5,5,5,8])
 assert oracle(*ex)==2
 small=[ex,(3,10,[0,11,10,10,7]),(1,1,[0]),(1,1,[2]),(1,1,[1]),(2,1,[1,2]),(2,1,[2,1,3]),(5,1,[1,1,1,1,2]),(3,1,[1,1,2])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(1,12);a=[rng.randint(0,rng.choice([5,V])) for _ in range(n)];k=rng.randint(1,n)
  t=(k,rng.randint(1,max(1,max(a))) if max(a)>0 else 1,a)
  if encode(*t) not in keys:keys.add(encode(*t));small.append(t)
 for t in small:assert oracle(*t)==fast(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False,closed=2);add('平均值不是整数',(2,3,[3,4,3,3]),False,closed=2);add('窗口为1',(1,5,[5,6,4,7]),False,closed=2)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,t,closed=None):add(nm,t,f=fast,closed=closed)
 big('满规模全为最大值k为n',(N,V-1,[V]*N),closed=1)
 big('满规模全为最大值阈值最大',(N//2,V,[V]*N),closed=0)
 big('满规模平均略高于阈值',(3,V-1,[V,V-1,V-1]*(N//3)+[V]),closed=N-2)
 big('满规模大窗口和超过32位',(50000,14956,[V]*N),closed=N-50000+1)
 big('满规模随机',(rng.randint(1,1000),50000,[rng.randint(0,V) for _ in range(N)]))
 big('满规模整除边界',(7,3,[rng.choice([3,3,3,4,2]) for _ in range(N)]))
 big('满规模k为1',(1,V//2,[rng.randint(0,V) for _ in range(N)]))
 big('满规模递增',(100,V//2,[i*V//N for i in range(N)]))
 def exhaustive(run):
  c=0
  for n in range(1,6):
   for a in product(range(4),repeat=n):
    if n==5 and a[0]!=1:continue
    for k in range(1,n+1):
     for th in (1,2,3):
      e=oracle(k,th,list(a));assert run(encode(k,th,list(a))).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':5,'calls':[0,3],'thresholds':[1,2,3],'k':'1..n','note':'n=5 restricted to numCalls[0]=1'}
 P=problem(PID,'Goldman Sachs OA #32：阈值警报','简单',['滑动窗口','前缀和'],
  '一个合规系统监控通话量。每当最近若干分钟的平均通话量超过阈值时，就发出一次警报。设precedingMinutes=k，在时刻T（从1开始计数），取时刻T−(k−1)、T−(k−2)、…、T共k个时刻的通话量求平均值；平均值严格大于alertThreshold时发出一次警报。T<k时数据不足，不发警报。\n\n给定每分钟的通话量，求整个时间段内发出的警报总数。',
  '第一行precedingMinutes；第二行alertThreshold；第三行n；随后n行，每行一个整数numCalls[i]，表示第i+1分钟的通话量。1≤precedingMinutes≤n，1≤alertThreshold≤10^5，1≤n≤10^5，0≤numCalls[i]≤10^5。',
  '输出一个整数，表示警报总数。',
  '样例1：k=3，阈值4，numCalls=[2,2,2,2,5,5,5,8]。T=3时平均(2+2+2)/3=2；T=4..8的平均依次为2,3,4,5,6，最后两个超过4，共2次警报（平均等于4时不报警）。\n样例2：k=2，阈值3，平均依次为3.5,3.5,3，前两个超过3，共2次。\n样例3：k=1时就是逐分钟比较，6和7超过5，共2次。',
  ['T从k开始窗口才完整。','平均值是实数，比较时可以把不等式两边同乘k。','用滑动窗口维护最近k分钟的和。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'滑动窗口和与移项比较','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent exact Fraction average per complete window compared with the threshold; Python sliding sum for formal large cases; exhaustive n<=5, all k, calls 0..3, thresholds 1..3.',
  'imageProvenance':IMAGE_PROVENANCE+' HackerRank screenshot with window definition T-(k-1)..T, example, constraints and HackerRank stdin layout; Sample Case 0 output is cut off.',
  'rangeDisclosure':'Full original bounds preserved from the image: 1<=k<=n<=1e5, 1<=threshold<=1e5, 0<=numCalls<=1e5. Original HackerRank stdin layout (k, threshold, n, then n lines). The average is the mathematical (real) mean as written ("average ... exceeds"); the visible example cannot distinguish real from integer division, and the truncated Sample Case 0 (k=3, threshold 10, [0,11,10,10,7]) whose output is not visible would give 1 under this reading (31/3>10) and 0 under integer division. It is used only as a hidden oracle input, not presented as an original sample.',
  'corrections':['Upstream md window "T-5(T-1)...T-5(5)" is garbled; image gives T-(5-1)...T-(5-5).','Upstream md says averages "from T=3 to T=8 are 2,2,3,4,5,6"; image says T=4..8 are 2,3,4,5,6 (T=3 stated separately). Output 2 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出窗口T−(k−1)..T、T≥k才报警、严格大于与完整约束；平均值按题面实数含义比较（可见样例无法区分整除），截断的Sample Case 0未作公开样例；滑动窗口，独立分数平均核验。'})
if __name__=='__main__':main()
