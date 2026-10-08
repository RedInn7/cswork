#!/usr/bin/env python3
"""Trade Desk #2 Illuminated Coordinates, counting unit recovered from the source images."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-tradedesk-2';BATCH='tradedesk-2-recovered';SEED=20261008002
PATH='fastprep/Trade Desk/tdesk-about-lamps.md'
N=100000;C=10**9;R=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<pair<long long,int>>e;e.reserve(2*n);
for(int i=0;i<n;i++){long long x,r;scanf("%lld %lld",&x,&r);e.push_back({x-r,1});e.push_back({x+r+1,-1});}
sort(e.begin(),e.end());long long ans=0;int cov=0;
for(size_t i=0;i<e.size();){long long p=e[i].first;while(i<e.size()&&e[i].first==p)cov+=e[i++].second;
if(i<e.size()&&cov==1)ans+=e[i].first-p;}
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误统计被至少一盏灯照亮的坐标','language':'cpp','code':REFERENCE.replace('cov==1)','cov>=1)')},
 {'name':'错误右端点不含','language':'cpp','code':REFERENCE.replace('e.push_back({x+r+1,-1});','e.push_back({x+r,-1});')},
 {'name':'错误统计恰被一盏灯照亮的区段数','language':'cpp','code':REFERENCE.replace('ans+=e[i].first-p;','ans+=1;')},
 {'name':'错误32位累加','language':'cpp','code':REFERENCE.replace('long long ans=0;','int ans=0;').replace('printf("%lld\\n",ans);','printf("%d\\n",ans);')},
]
EDITORIAL='''## 题意

每盏灯照亮整数闭区间[x−r, x+r]。统计恰好被一盏灯照亮的整数坐标个数（不是区段数）。

## 思路

差分扫描线：每个区间在x−r处+1，在x+r+1处−1。把2n个事件按坐标排序，同一坐标的事件合并处理后得到从该坐标到下一个事件坐标之间（左闭右开）的覆盖次数；覆盖次数为1时把这段长度加入答案。

## 正确性

相邻两个事件坐标之间所有整数点被同一组区间覆盖，覆盖次数恒定且等于此前事件增量之和，因此按段累计等价于逐点计数。右端点用x+r+1表示闭区间的结束，避免漏掉端点。

## 复杂度

排序O(n log n)。坐标可达±2×10^9，答案最大约4×10^9，用64位整数。

## 独立验证

oracle把全部端点离散化，对每个基本段直接数有多少区间完整覆盖它（O(n²)，只用于小数据），与扫描线实现不同；更小的数据再逐个整数点计数。穷举1..3盏灯、坐标−2..2、半径1..2的所有组合并逐个真实运行参考程序。错误解包括统计并集、右端点开区间、只数区段个数（上游文字的误读）和32位累加。
'''
def encode(L):
 assert 1<=len(L)<=N and all(-C<=x<=C and 1<=r<=R for x,r in L)
 return f'{len(L)}\n'+''.join(f'{x} {r}\n' for x,r in L)
def oracle(L):
 pts=sorted({x-r for x,r in L}|{x+r+1 for x,r in L});ans=0
 for a,b in zip(pts,pts[1:]):
  if sum(1 for x,r in L if x-r<=a and b-1<=x+r)==1:ans+=b-a
 return ans
def pointwise(L):
 lo=min(x-r for x,r in L);hi=max(x+r for x,r in L)
 return sum(1 for p in range(lo,hi+1) if sum(1 for x,r in L if x-r<=p<=x+r)==1)
def sweep(L):
 d={}
 for x,r in L:d[x-r]=d.get(x-r,0)+1;d[x+r+1]=d.get(x+r+1,0)-1
 ks=sorted(d);cov=0;ans=0
 for a,b in zip(ks,ks[1:]):
  cov+=d[a]
  if cov==1:ans+=b-a
 return ans
def main():
 rng=random.Random(SEED)
 small=[[(-2,3),(2,3),(2,1)],[(0,1)],[(0,1),(0,1)],[(0,1),(3,1)],[(0,1),(2,1)],[(0,2),(0,1)],[(5,5),(-5,5)],[(0,10),(1,1),(5,1)],[(C,R)],[(-C,R),(C,R-1)],[(1,1),(2,1),(3,1)]]
 keys={encode(L) for L in small}
 while len(small)<175:
  span=rng.choice([5,20,1000]);L=[(rng.randint(-span,span),rng.randint(1,max(1,span//2))) for _ in range(rng.randint(1,10))];k=encode(L)
  if k not in keys:keys.add(k);small.append(L)
 for L in small:
  assert oracle(L)==sweep(L)
  if max(r for _,r in L)<=600:assert oracle(L)==pointwise(L)
 oracles=[{'input':encode(L),'expectedOutput':f'{oracle(L)}\n'} for L in small]
 cases=[]
 def add(name,L,hidden=True,closed=None):
  e=sweep(L)
  if closed is not None:assert e==closed,(name,e)
  cases.append(case(name,encode(L),f'{e}\n',hidden))
 add('样例1',small[0],False,6);add('两盏灯相隔',[(0,1),(4,1)],False,6);add('一盏灯完全包含另一盏',[(0,3),(1,1)],False,4)
 for i,L in enumerate(small[1:24]):add(f'小规模{i+1}',L)
 add('最大坐标两盏灯端点相接',[(-C,R),(C,R)],closed=4*R)
 add('满规模互不相交',[(i*10,1) for i in range(N)],closed=3*N)
 add('满规模同一位置',[(0,R)]*N,closed=0)
 add('满规模嵌套',[(0,R-i) for i in range(N)],closed=2)
 add('满规模链式相邻重叠',[(i*3,2) for i in range(N)])
 add('满规模随机大坐标',[(rng.randint(-C,C),rng.randint(1,R)) for _ in range(N)])
 add('满规模随机小半径',[(rng.randint(-C,C),rng.randint(1,1000)) for _ in range(N)])
 add('满规模密集随机',[(rng.randint(-1000,1000),rng.randint(1,50)) for _ in range(N)])
 add('满规模两两成对',[(i*100+d,5) for i in range(N//2) for d in (0,3)])
 add('满规模覆盖全域一盏加小灯',[(0,R)]+[(rng.randint(-C+5,C-5),rng.randint(1,5)) for _ in range(N-1)])
 add('满规模端点相接',[(i*2,1) for i in range(N)])
 def exhaustive(run):
  c=0;lamps=[(x,r) for x in range(-2,3) for r in (1,2)]
  for n in range(1,4):
   for L in product(lamps,repeat=n):
    e=pointwise(L);assert e==sweep(L);assert run(encode(L)).split()==[str(e)];c+=1
  return c,{'lampsMin':1,'lampsMax':3,'coordinates':[-2,2],'radii':[1,2]}
 P=problem(PID,'Trade Desk OA #2：恰被一盏灯照亮的坐标','中等',['扫描线','差分','排序'],
  '数轴上有n盏灯。第i盏灯的坐标为整数x_i，照明半径为正整数r_i，它照亮从x_i−r_i到x_i+r_i的整个范围（含两端）。\n\n求恰好被1盏灯照亮的整数坐标的个数。',
  '第一行一个整数n。随后n行，每行两个整数x_i和r_i。1≤n≤100000，−10^9≤x_i≤10^9，1≤r_i≤10^9。',
  '输出一个整数，表示恰好被一盏灯照亮的整数坐标个数。',
  '样例1：三盏灯分别照亮[−5,1]、[−1,5]、[1,3]。−6..6上各点被照亮次数依次为0,1,1,1,1,2,2,3,2,2,1,1,0，恰为1的坐标是−5,−4,−3,−2,4,5，共6个。\n样例2：[−1,1]与[3,5]不相交，共6个坐标。\n样例3：[−3,3]包含[0,2]，只有−3,−2,−1,3恰被一盏灯照亮，答案4。',
  ['把每个闭区间写成在左端点+1、右端点后一位−1的差分事件。','排序后相邻事件之间的覆盖次数不变。','答案可能超过32位整数。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'差分扫描线统计覆盖次数为一的长度','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':('满规模','最大坐标'),
  'oracleMethod':'Independent O(n^2) elementary-segment coverage count over compressed endpoints; pointwise integer coverage on small radii; Python dict difference sweep for formal cases; closed forms for disjoint/nested/identical layouts.',
  'imageProvenance':IMAGE_PROVENANCE+' original-0 is a transcribed CodeSignal statement, original-1 a photo of the original with the per-coordinate coverage diagram; the example illustration matches.',
  'rangeDisclosure':'Source images give no constraints (TO-DO). Chosen bounds: 1<=n<=1e5, -1e9<=x<=1e9, 1<=r<=1e9 (answer may exceed 32-bit). Stdin: n then n lines "x r".',
  'corrections':['Upstream md describes the result as "6 distinct sections"; source image defines it as the number of integer coordinates illuminated by exactly one lamp. Sample output 6 unchanged.','Second and third public examples are authored.'],
  'reason':'原图明确计数单位为恰被一盏灯照亮的整数坐标个数并给出逐点示意；原图无约束，自选n≤1e5、坐标与半径≤1e9；差分扫描线，独立离散段计数与逐点计数核验。'})
if __name__=='__main__':main()
