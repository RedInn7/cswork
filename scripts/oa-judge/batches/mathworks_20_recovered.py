#!/usr/bin/env python3
"""MathWorks #20 balancing teams; missing-player semantics and 10000 cap recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-mathworks-20';BATCH='mathworks-20-recovered';SEED=20261008020
PATH='fastprep/MathWorks/mathworks-balancing-teams.md'
N=100000;CAP=10000
REFERENCE=r'''#include <cstdio>
#include <algorithm>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;long long sa=0,sb=0,za=0,zb=0,x;
for(int i=0;i<n;i++){scanf("%lld",&x);sa+=x;za+=x==0;}for(int i=0;i<m;i++){scanf("%lld",&x);sb+=x;zb+=x==0;}
long long loA=sa+za,hiA=sa+10000*za,loB=sb+zb,hiB=sb+10000*zb;long long lo=max(loA,loB),hi=min(hiA,hiB);
printf("%lld\n",lo<=hi?lo:-1);}
'''
MUTANTS=[
 {'name':'错误补位球员技能可以为0','language':'cpp','code':REFERENCE.replace('loA=sa+za,','loA=sa,').replace('loB=sb+zb;','loB=sb;')},
 {'name':'错误忽略技能上限10000','language':'cpp','code':REFERENCE.replace('hiA=sa+10000*za,','hiA=za?(long long)4e18:sa,').replace('hiB=sb+10000*zb;','hiB=zb?(long long)4e18:sb;')},
 {'name':'错误取两队下界的较小值','language':'cpp','code':REFERENCE.replace('long long lo=max(loA,loB)','long long lo=min(loA,loB)')},
 {'name':'错误技能上限写成9999','language':'cpp','code':REFERENCE.replace('10000*za','9999*za').replace('10000*zb','9999*zb')},
]
EDITORIAL='''## 题意

两队技能数组中0表示该位置缺人，每个空位都必须补一名球员，补上的技能在1..10000之间（0代表缺人，所以补位不能是0；任何球员技能上限为10000）。求两队总技能相等时的最小可能和，做不到输出−1。

## 思路

一队已有技能和为s、空位数为z时，补完后的总和可以取到[s+z, s+10000z]内的任意整数（每个空位独立取1..10000，和覆盖整个区间）；z=0时只能是s。两队区间求交集，交集非空则答案是交集下界，否则−1。

## 正确性

z个取值在[1,10000]内的整数之和恰好取遍[z,10000z]的每个整数，所以可达集合是区间。相等和必须同时属于两个区间，最小者就是交集的下界。

## 复杂度

O(n+m)。总和最多约10^9，用64位更稳妥。

## 独立验证

oracle用Python大整数位集合表示每队可达的总和集合：对每个空位把集合按1..10000的所有位移取并（倍增实现），再求两队交集的最低位，不使用区间公式。穷举两队长度1..3、元素取{0,3,10000}的所有组合并逐个真实运行参考程序。错误解覆盖补位可为0、忽略上限、取较小下界和上限写错。
'''
def encode(A,B):
 assert 1<=len(A)<=N and 1<=len(B)<=N and all(0<=x<=CAP for x in A+B)
 return f'{len(A)} {len(B)}\n'+' '.join(map(str,A))+'\n'+' '.join(map(str,B))+'\n'
def reach(T):
 mask=1<<sum(T)
 for x in T:
  if x:continue
  res=mask<<1;cover=1
  while cover<CAP:
   step=min(cover,CAP-cover);res|=res<<step;cover+=step
  mask=res
 return mask
def oracle(A,B):
 m=reach(A)&reach(B)
 return (m&-m).bit_length()-1 if m else -1
def formula(A,B):
 la=sum(A)+A.count(0);ha=sum(A)+CAP*A.count(0);lb=sum(B)+B.count(0);hb=sum(B)+CAP*B.count(0)
 lo=max(la,lb);return lo if lo<=min(ha,hb) else -1
def main():
 rng=random.Random(SEED)
 ex=([5,10,0,4],[2,4,0,5,0])
 assert oracle(*ex)==20==formula(*ex)
 small=[ex,([0],[0]),([5],[5]),([5],[6]),([0],[10000]),([0],[10001-1,1]),([1,2],[0,0,0]),([10000,10000],[0]),([0,0],[1]),([7],[0,0])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  A=[rng.choice([0,rng.randint(0,rng.choice([10,CAP]))]) for _ in range(rng.randint(1,5))];B=[rng.choice([0,rng.randint(0,rng.choice([10,CAP]))]) for _ in range(rng.randint(1,5))]
  if encode(A,B) not in keys:keys.add(encode(A,B));small.append((A,B))
 for t in small:assert oracle(*t)==formula(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False,closed=20);add('无空位且不等',([3,4],[8]),False,closed=-1);add('空位补满上限仍不够',([0],[10000,1]),False,closed=-1)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,A,B,closed=None):add(nm,(A,B),f=formula,closed=closed)
 big('满规模全为空位',[0]*N,[0]*N,closed=N)
 big('满规模一队满上限一队全空位',[CAP]*N,[0]*N,closed=CAP*N)
 big('满规模一队满上限一队一个空位',[CAP]*N,[CAP]*(N-1)+[0],closed=CAP*N)
 big('满规模一队满上限另一队少一',[CAP]*N,[CAP]*(N-2)+[CAP-1,0],closed=-1)
 big('满规模无法达到',[CAP]*N,[0]+[1]*(N-1),closed=-1)
 big('满规模随机',[rng.choice([0,rng.randint(1,CAP)]) for _ in range(N)],[rng.choice([0,rng.randint(1,CAP)]) for _ in range(N)])
 big('满规模无空位相等',[CAP//2]*N,[CAP]*(N//2),closed=CAP//2*N)
 big('满规模无空位不等',[CAP//2]*N,[CAP]*(N//2)+[1],closed=-1)
 def exhaustive(run):
  c=0;vals=(0,3,CAP);arrs=[list(t) for n in range(1,4) for t in product(vals,repeat=n)]
  for A in arrs:
   for B in arrs:
    e=oracle(A,B);assert e==formula(A,B);assert run(encode(A,B)).split()==[str(e)];c+=1
  return c,{'lengthMin':1,'lengthMax':3,'values':list(vals)}
 P=problem(PID,'MathWorks OA #20：平衡两队','简单',['数学','贪心'],
  'A、B两队分别有n、m名球员，技能值存放在数组teamA和teamB中。值为0表示该队这个位置缺少球员。\n\n教练要在每个空位都补上一名球员，使两队的技能总和相等。任何球员的技能值最大为10000（补上的球员技能值至少为1）。求可能的最小相等总和；如果做不到，输出−1。',
  '第一行两个整数n和m；第二行n个整数teamA；第三行m个整数teamB。1≤n,m≤100000，0≤teamA[i],teamB[i]≤10000。',
  '输出一个整数：最小相等总和，或−1。',
  '样例1：teamA=[5,10,0,4]，teamB=[2,4,0,5,0]。A补1，B补3和6，得到[5,10,1,4]与[2,4,3,5,6]，总和都是20，这是最小的相等总和。\n样例2：两队都没有空位，总和7和8不相等，输出−1。\n样例3：A只有一个空位，最多补到10000，而B的总和是10001，输出−1。',
  ['一队补完后的总和可以取到一个连续区间。','区间下界是已有和加空位数，上界是已有和加10000乘空位数。','两个区间求交集。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'可达总和区间求交','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent Python big-integer bitset of reachable team sums (OR over shifts 1..10000 per empty slot via doubling), intersection lowest bit; exhaustive teams of length 1..3 over {0,3,10000}.',
  'imageProvenance':IMAGE_PROVENANCE+' Phone photo of the HackerRank statement: 0 means a missing player, every empty position is filled, maximum skill 10000, minimum equal sum or -1, example and constraints.',
  'rangeDisclosure':'Full original bounds preserved from the image: 1<=n,m<=1e5, 0<=skill<=1e4. Filled players have skill 1..10000 (0 denotes a missing player, so a filled player cannot be 0). Stdin: "n m", teamA, teamB.',
  'corrections':['Upstream md statement truncated after "A value of"; semantics supplied by the image. Example output 20 unchanged.','Second and third public examples are authored.'],
  'reason':'原图补全0表示缺人、每个空位都补、技能上限10000、求最小相等和或−1；完整约束保留；区间求交，独立位集合可达和核验。'})
if __name__=='__main__':main()
