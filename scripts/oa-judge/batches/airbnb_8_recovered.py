#!/usr/bin/env python3
"""Airbnb #8 round prices to match target with minimum L1 error; full definition recovered from the source images."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-airbnb-8';BATCH='airbnb-8-recovered';SEED=20261008008
PATH='fastprep/Airbnb/airbnb-round-prices-to-match-target.md'
N=100000;PMAX=1000000
REFERENCE=r'''#include <cstdio>
#include <cstring>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;
int main(){int n;long long target;if(scanf("%d %lld",&n,&target)!=2)return 0;vector<long long>fl(n);vector<int>fr(n);char buf[64];long long base=0;
for(int i=0;i<n;i++){scanf("%63s",buf);char*d=strchr(buf,'.');long long ip=atoll(buf);int f=0;if(d){f=(d[1]-'0')*10+(d[2]?d[2]-'0':0);}fl[i]=ip;fr[i]=f;base+=ip;}
long long k=target-base;vector<int>idx;for(int i=0;i<n;i++)if(fr[i]>0)idx.push_back(i);
sort(idx.begin(),idx.end(),[&](int a,int b){return fr[a]!=fr[b]?fr[a]>fr[b]:a<b;});
vector<long long>y=fl;for(long long t=0;t<k;t++)y[idx[t]]++;
string out;for(int i=0;i<n;i++){out+=to_string(y[i]);out+=i+1<n?' ':'\n';}fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误优先进位小数部分最小的','language':'cpp','code':REFERENCE.replace('return fr[a]!=fr[b]?fr[a]>fr[b]:a<b;','return fr[a]!=fr[b]?fr[a]<fr[b]:a<b;')},
 {'name':'错误按下标顺序进位','language':'cpp','code':REFERENCE.replace('return fr[a]!=fr[b]?fr[a]>fr[b]:a<b;','return a<b;')},
 {'name':'错误只看小数点后第一位','language':'cpp','code':REFERENCE.replace("f=(d[1]-'0')*10+(d[2]?d[2]-'0':0);","f=(d[1]-'0')*10;")},
 {'name':'错误先四舍五入不再调整总和','language':'cpp','code':REFERENCE.replace('vector<long long>y=fl;for(long long t=0;t<k;t++)y[idx[t]]++;','vector<long long>y=fl;for(int i=0;i<n;i++)if(fr[i]>=50)y[i]++;')},
]
EDITORIAL='''## 题意

给定价格x1..xn和整数target，每个价格取下整或上整得到yi，使Σyi=target且Σ|xi−yi|最小，输出y。数据保证有解且最优解唯一。

## 思路

先全部取下整，和为base，还需要把k=target−base个非整数价格改为上整。价格xi的小数部分为fi>0时，取下整误差fi，取上整误差1−fi，改为上整使总误差增加1−2fi，fi越大越划算。所以把小数部分最大的k个非整数价格取上整即可。整数价格的上整等于下整，不能用来凑数。

为避免浮点误差，按字符串把价格解析为整数部分与两位小数（单位0.01）。

## 正确性

总误差=Σfi+Σ_{上整集合}(1−2fi)，第一项固定，最小化第二项就是在非整数价格中选k个使(1−2fi)之和最小，即选fi最大的k个。数据保证唯一最优，第k大与第k+1大的小数部分不相等。

## 复杂度

排序O(n log n)。

## 独立验证

oracle枚举每个非整数价格取下整/上整的全部组合（小数据），筛选总和等于target者取误差最小值，并检查最优解唯一，不使用排序贪心。穷举3个价格、小数部分取自{0,.25,.5,.75}的所有组合与所有可行target（仅保留唯一最优的输入）并逐个真实运行参考程序。错误解覆盖优先进位小数最小者、按下标进位、只看小数第一位和四舍五入不调整。
'''
def fmt(c):return f'{c//100}.{c%100:02d}'
def encode(t,cents):
 assert 1<=len(cents)<=N and all(0<=c<=PMAX*100 for c in cents)
 return f'{len(cents)} {t}\n'+' '.join(map(fmt,cents))+'\n'
def brute(t,cents):
 opts=[]
 for choice in product(*[(c//100,)+((c//100+1,) if c%100 else ()) for c in cents]):
  if sum(choice)==t:opts.append((sum(abs(c-100*y) for c,y in zip(cents,choice)),choice))
 if not opts:return None
 opts.sort();return None if len(opts)>1 and opts[0][0]==opts[1][0] else list(opts[0][1])
def greedy(t,cents):
 y=[c//100 for c in cents];k=t-sum(y);idx=sorted((i for i,c in enumerate(cents) if c%100),key=lambda i:-(cents[i]%100))
 assert 0<=k<=len(idx)
 if 0<k<len(idx):assert cents[idx[k-1]]%100!=cents[idx[k]]%100,'not unique'
 for i in idx[:k]:y[i]+=1
 return y
def out(y):return ' '.join(map(str,y))+'\n'
def main():
 rng=random.Random(SEED)
 exA=(18,[120,430,580,640]);exB=(8,[70,280,490])
 assert brute(*exA)==[1,4,6,7]==greedy(*exA) and brute(*exB)==[0,3,5]==greedy(*exB)
 small=[exA,exB,(5,[500]),(0,[0]),(1,[50]),(0,[49]),(3,[150,149]),(3,[100,101,99])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(1,10);cents=[rng.randint(0,rng.choice([3,50,PMAX]))*100+rng.choice([0,rng.randint(1,99)]) for _ in range(n)]
  base=sum(c//100 for c in cents);m=sum(1 for c in cents if c%100);t=base+rng.randint(0,m)
  if brute(t,cents) is None:continue
  k=encode(t,cents)
  if k not in keys:keys.add(k);small.append((t,cents))
 for t in small:assert brute(*t)==greedy(*t)
 oracles=[{'input':encode(*t),'expectedOutput':out(brute(*t))} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=brute):cases.append(case(nm,encode(*t),out(f(*t)),hidden))
 add('样例1',exA,False);add('样例2',exB,False);add('含整数价格',(16,[300,450,520,325]),False)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,cents,k):
  base=sum(c//100 for c in cents);add(nm,(base+k,cents),f=greedy)
 c1=[rng.randint(0,PMAX)*100+(1+i%99) for i in range(N)]
 # choose k so the k-th and (k+1)-th fractions differ: cut between fraction groups
 cnt_ge=lambda f:sum(1 for c in c1 if c%100>=f)
 big('满规模按小数分组切分',c1,cnt_ge(50))
 big('满规模全部取下整',c1,0)
 big('满规模全部取上整',c1,N)
 c2=[rng.randint(0,PMAX)*100 for _ in range(N)]
 big('满规模全为整数',c2,0)
 c3=[rng.randint(0,PMAX)*100+(99 if i<N//3 else 1 if i<2*N//3 else 0) for i in range(N)]
 big('满规模三类小数',c3,N//3)
 c4=[PMAX*100 if i%2 else rng.randint(0,99) for i in range(N)]
 fr4=sorted({c%100 for c in c4 if c%100},reverse=True)
 big('满规模最大价格混合',c4,sum(1 for c in c4 if c%100>=fr4[len(fr4)//2]))
 def exhaustive(run):
  c=0
  for fr in product([0,25,50,75],repeat=3):
   for ip in ((0,1,2),(3,0,1)):
    cents=[a*100+b for a,b in zip(ip,fr)];base=sum(ip);m=sum(1 for b in fr if b)
    for t in range(base,base+m+1):
     e=brute(t,cents)
     if e is None:continue
     assert e==greedy(t,cents);assert run(encode(t,cents)).split()==list(map(str,e));c+=1
  return c,{'prices':3,'fractions':[0,0.25,0.5,0.75],'targets':'all feasible with unique optimum'}
 P=problem(PID,'Airbnb OA #8：价格取整凑目标','中等',['贪心','排序'],
  '给定n个价格prices=[x1,x2,…,xn]和目标值target。要把每个价格取整为yi，其中yi只能是floor(xi)或ceil(xi)，并且y1+y2+…+yn=target。在此前提下使取整误差Σ|xi−yi|最小。输出取整后的数组。\n\n数据保证存在合法且唯一的最优结果。',
  '第一行两个整数n和target；第二行n个价格，每个价格恰好写成两位小数的形式（如3.00、0.70）。1≤n≤100000，0≤xi≤1000000。',
  '输出一行n个整数y1..yn，空格分隔。',
  '样例1：prices=[1.20,4.30,5.80,6.40]，target=18。下整和为16，需要把2个改为上整，选小数部分最大的5.80和6.40，得到[1,4,6,7]，误差1.3。\n样例2：prices=[0.70,2.80,4.90]，target=8。[0,3,5]的误差为0.7+0.2+0.1=1.0，优于[1,2,5]的0.3+0.8+0.1=1.2。\n样例3：prices=[3.00,4.50,5.20,3.25]，target=16。3.00是整数，取上整也不变；下整和为15，还需把1个改为上整，小数部分最大的是4.50，得到[3,5,5,3]。',
  ['先全部取下整，计算还差多少。','把一个价格从下整改为上整，误差变化为1−2×小数部分。','按两位小数解析成整数，避免浮点误差。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'按小数部分从大到小进位','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent enumeration of all floor/ceil choices in integer cents with explicit uniqueness check of the optimum; exhaustive three-price inputs with quarter fractions and every feasible target; Python greedy with uniqueness assertion for formal large cases.',
  'imageProvenance':IMAGE_PROVENANCE+' original-0: short statement with example A; original-1: full "Rounding in Price Breakdown" statement with floor/ceil, L1 error, valid-unique guarantee, no-brute-force note and sample B.',
  'rangeDisclosure':'Images give no numeric bounds. Chosen: 1<=n<=1e5, 0<=price<=1e6 written with exactly two decimals (exact integer-cents arithmetic), integer target; inputs guarantee a valid unique optimum as stated in the image. Stdin: "n target" then n prices.',
  'corrections':['Upstream md has only example A and truncated statement; full definition and sample B taken from image original-1. Both outputs unchanged.','Third public example is authored.'],
  'reason':'原图给出floor/ceil取整、总和等于target、L1误差最小及保证唯一合法最优；原图无数值范围，自选n≤1e5、两位小数价格；小数部分降序贪心，独立全组合枚举与唯一性检查核验。'})
if __name__=='__main__':main()
