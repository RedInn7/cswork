#!/usr/bin/env python3
"""HSBC #2 find ID of soldier; symmetric swap (range reversal) and num<=1e9 recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-hsbc-2';BATCH='hsbc-2-recovered';SEED=20261008222
PATH='fastprep/HSBC/hsbc-find-id-of-soldier.md'
NM=10**9;QM=100000
REFERENCE=r'''#include <cstdio>
int main(){long long num;int q,s;if(scanf("%lld %d %d",&num,&q,&s)!=3)return 0;long long r[100005],c[100005];
for(int i=0;i<q;i++)scanf("%lld %lld",&r[i],&c[i]);long long k;scanf("%lld",&k);long long ans=k;
for(int i=0;i<q;i++)if(r[i]<=k&&k<=c[i])ans=r[i]+c[i]-k;
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误只交换两端','language':'cpp','code':REFERENCE.replace('if(r[i]<=k&&k<=c[i])ans=r[i]+c[i]-k;','if(k==r[i])ans=c[i];else if(k==c[i])ans=r[i];')},
 {'name':'错误区间端点不计入','language':'cpp','code':REFERENCE.replace('r[i]<=k&&k<=c[i]','r[i]<k&&k<c[i]')},
 {'name':'错误翻转映射差一','language':'cpp','code':REFERENCE.replace('ans=r[i]+c[i]-k;','ans=r[i]+c[i]-k+1;')},
 {'name':'错误只处理第一次操作','language':'cpp','code':REFERENCE.replace('for(int i=0;i<q;i++)if(r[i]<=k','for(int i=0;i<1;i++)if(r[i]<=k')},
]
EDITORIAL='''## 题意

N名士兵按ID 1..N排成一排。第i次操作先交换第row_i与第col_i个位置，再交换第row_i+1与第col_i−1个位置……一直向内进行，效果就是把区间[row_i,col_i]整段翻转。保证每个位置最多被一次操作的区间覆盖。求所有操作后第K个位置上的士兵ID。

## 思路

区间互不重叠，各次翻转互不影响，顺序也无关。只需找到覆盖K的那个区间[l,r]：翻转后位置K上是原来位置l+r−K的士兵，其ID就是l+r−K；若没有区间覆盖K，答案就是K。N可达10^9，不能真的模拟数组。

## 正确性

对称交换(l+m, r−m)直到两指针相遇，正是区间翻转，位置K（l≤K≤r）的新内容来自位置l+r−K。区间不重叠保证K至多属于一个区间，且该区间内元素在操作前仍是初始ID。

## 复杂度

O(Q)。

## 独立验证

oracle在小N上真实模拟每次操作的逐对交换（按题面的m从0开始向内交换），再读取第K个位置；不使用l+r−K公式。穷举N=1..5的所有互不重叠区间集合、所有K并逐个真实运行参考程序。错误解覆盖只交换两端、端点不计入、映射差一和只处理第一次操作。
'''
def encode(num,acts,k):
 assert 1<=k<=num<=NM and 1<=len(acts)<=QM and all(1<=r<=c<=num for r,c in acts)
 cov=sorted(acts)
 for (a,b),(c,d) in zip(cov,cov[1:]):assert b<c
 return f'{num}\n{len(acts)} 2\n'+''.join(f'{r} {c}\n' for r,c in acts)+f'{k}\n'
def oracle(num,acts,k):
 line=list(range(1,num+1))
 for r,c in acts:
  m=0
  while r+m<c-m:line[r+m-1],line[c-m-1]=line[c-m-1],line[r+m-1];m+=1
 return line[k-1]
def fast(num,acts,k):
 for r,c in acts:
  if r<=k<=c:return r+c-k
 return k
def disjoint(rng,num,q):
 pts=sorted(rng.sample(range(1,num+1),min(num,2*q)))
 acts=[(pts[i],pts[i+1]) for i in range(0,len(pts)-1,2)]
 rng.shuffle(acts);return acts
def main():
 rng=random.Random(SEED)
 ex=(10,[(1,5),(6,10)],1)
 assert oracle(*ex)==5==fast(*ex)
 small=[ex,(1,[(1,1)],1),(2,[(1,2)],1),(2,[(1,2)],2),(5,[(2,4)],3),(5,[(2,4)],4),(5,[(5,5)],5),(6,[(1,6)],2),(7,[(1,3),(5,7)],4)]
 keys={encode(*t) for t in small}
 while len(small)<170:
  num=rng.randint(1,30);acts=disjoint(rng,num,rng.randint(1,5))
  if not acts:acts=[(1,1)]
  t=(num,acts,rng.randint(1,num))
  if encode(*t) not in keys:keys.add(encode(*t));small.append(t)
 for t in small:assert oracle(*t)==fast(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False,closed=5);add('不被覆盖的位置',(10,[(2,4),(7,9)],5),False,closed=5);add('区间内部',(10,[(3,8)],4),False,closed=7)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,t,closed=None):add(nm,t,f=fast,closed=closed)
 big('满规模整段翻转取首位',(NM,[(1,NM)],1),closed=NM)
 big('满规模整段翻转取末位',(NM,[(1,NM)],NM),closed=1)
 acts=disjoint(rng,NM,QM)
 big('满规模十万区间命中',(NM,acts,(lambda r,c:(r+c)//2+1)(*acts[QM//2])))
 big('满规模十万区间未命中',(NM,[(r,c) for r,c in acts if c<NM-5][:QM],NM))
 big('满规模区间左端点',(NM,acts,acts[-1][0]))
 big('满规模区间右端点',(NM,acts,acts[0][1]))
 single=[(i*10000+1,i*10000+10000) for i in range(QM)]
 big('满规模连续等长区间',(NM,single,999999999),closed=(99999*10000+1)+(99999*10000+10000)-999999999)
 big('满规模单点区间',(NM,[(i*3+1,i*3+1) for i in range(QM)],4),closed=4)
 def exhaustive(run):
  c=0
  for num in range(1,6):
   ivs=[(r,cc) for r in range(1,num+1) for cc in range(r,num+1)]
   from itertools import combinations
   sets=[]
   for m in range(1,3):
    for comb in combinations(ivs,m):
     s=sorted(comb)
     if all(a[1]<b[0] for a,b in zip(s,s[1:])):sets.append(list(comb))
   for acts in sets:
    for k in range(1,num+1):
     e=oracle(num,acts,k);assert e==fast(num,acts,k);assert run(encode(num,acts,k)).split()==[str(e)];c+=1
  return c,{'numMin':1,'numMax':5,'actions':'all sets of 1..2 disjoint ranges','K':'all positions'}
 P=problem(PID,'HSBC OA #2：找出士兵的ID','中等',['模拟','数学'],
  'N名士兵站成一排，ID从1到N按升序排列。他们参加一项由Q次操作组成的训练。第i次操作中，少校喊出两个数row_i和col_i：第row_i个位置与第col_i个位置的士兵交换位置；然后第row_i+1个与第col_i−1个位置的士兵交换位置；如此继续向内，直到(row_i+m)<(col_i−m)不再成立为止。每个位置最多被一次操作的区间[row_i,col_i]覆盖。\n\n求所有操作完成后，第K个位置上士兵的ID。',
  '第一行一个整数num，表示士兵人数N。第二行两个整数actions和numSoldiers，表示操作次数Q和每次喊出的数的个数S（S=2）。接下来Q行，每行S个整数row_i和col_i。最后一行一个整数posSoldier，表示K。1≤posSoldier≤num≤10^9，1≤actions≤10^5，1≤row_i≤col_i≤num，各操作区间互不重叠。',
  '输出一个整数，表示第K个位置上士兵的ID。',
  '样例1：N=10，第1次操作后顺序为5 4 3 2 1 6 7 8 9 10，第2次操作后为5 4 3 2 1 10 9 8 7 6，第1个位置是5。\n样例2：位置5不在任何区间内，ID仍为5。\n样例3：翻转区间[3,8]后，第4个位置上是原第3+8−4=7个位置的士兵，ID为7。',
  ['逐对向内交换的效果就是把区间整段翻转。','区间互不重叠，只需找到覆盖K的那个区间。','N很大，不能真的建数组。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'区间翻转的位置映射','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent literal simulation of the pairwise inward swaps on a real array for small N; exhaustive N<=5 with every set of 1..2 disjoint ranges and every K.',
  'imageProvenance':IMAGE_PROVENANCE+' Screenshot of the HSBC statement with the inward-swap rule, at-most-one-cover guarantee, stdin format, constraints (num<=1e9, row<=col) and example.',
  'rangeDisclosure':'Full original bounds preserved from the image: 1<=K<=num<=1e9, 1<=Q<=1e5, 1<=row<=col<=num, ranges pairwise disjoint (each position covered at most once), S=2. Original stdin layout kept.',
  'corrections':['Upstream md has num<=1e5; image has num<=1e9 (used).','Upstream md drops row<=col and the "(row+1)th and (col-1)th swap" sentence; both taken from the image. Output 5 unchanged.','Second and third public examples are authored.'],
  'reason':'原图明确逐对向内交换（区间翻转）、区间互不覆盖、num≤1e9与row≤col；定位覆盖K的区间按l+r−K映射，独立真实交换模拟与小N穷举核验。'})
if __name__=='__main__':main()
