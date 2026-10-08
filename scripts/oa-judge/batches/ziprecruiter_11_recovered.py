#!/usr/bin/env python3
"""ZipRecruiter #11 lamps and control points; statement taken from the source image (upstream md prose is a different problem)."""
from pathlib import Path
from itertools import product
from bisect import bisect_left,bisect_right
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-ziprecruiter-11';BATCH='ziprecruiter-11-recovered';SEED=20261008211
PATH='fastprep/ZipRecruiter/ziprecruiter-lamp-and-control-points.md'
N=100000;V=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;vector<long long>L(n),R(n);for(int i=0;i<n;i++)scanf("%lld %lld",&L[i],&R[i]);
sort(L.begin(),L.end());sort(R.begin(),R.end());string out;
for(int j=0;j<m;j++){long long p;scanf("%lld",&p);long long a=upper_bound(L.begin(),L.end(),p)-L.begin();long long b=lower_bound(R.begin(),R.end(),p)-R.begin();out+=to_string(a-b);out+=j+1<m?' ':'\n';}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误右端点不含','language':'cpp','code':REFERENCE.replace('lower_bound(R.begin(),R.end(),p)','upper_bound(R.begin(),R.end(),p)')},
 {'name':'错误左端点不含','language':'cpp','code':REFERENCE.replace('upper_bound(L.begin(),L.end(),p)','lower_bound(L.begin(),L.end(),p)')},
 {'name':'错误按控制点排序后输出','language':'cpp','code':REFERENCE.replace('for(int j=0;j<m;j++){long long p;scanf("%lld",&p);','vector<long long>P(m);for(auto&x:P)scanf("%lld",&x);sort(P.begin(),P.end());for(int j=0;j<m;j++){long long p=P[j];')},
 {'name':'错误只统计左端点不超过p的灯','language':'cpp','code':REFERENCE.replace('out+=to_string(a-b);','out+=to_string(a);')},
]
EDITORIAL='''## 题意

每盏灯照亮数轴上的闭区间[lamps[i][0],lamps[i][1]]。对每个控制点points[j]，统计有多少盏灯照亮它（端点也算），按控制点的输入顺序输出。

## 思路

点p被区间[l,r]覆盖⇔l≤p且r≥p。覆盖数=（左端点≤p的灯数）−（右端点<p的灯数），因为右端点<p的灯左端点也一定<p。把所有左端点、右端点分别排序，每个控制点做两次二分。

## 正确性

左端点≤p的灯中，恰好右端点<p的那些不覆盖p，其余都覆盖。两次二分分别给出这两个数量。

## 复杂度

O((n+m) log n)。

## 独立验证

oracle对每个控制点逐盏灯检查l≤p≤r（O(nm)，仅小数据），不排序不二分；大用例用Python差分扫描另算。穷举坐标1..4上的1..2盏灯与全部控制点组合并逐个真实运行参考程序。错误解覆盖右端点或左端点不含、按排序后的控制点输出和忘记减去已结束的灯。
'''
def encode(lamps,pts):
 assert 1<=len(lamps)<=N and 1<=len(pts)<=N and all(-V<=l<=r<=V for l,r in lamps) and all(-V<=p<=V for p in pts)
 return f'{len(lamps)} {len(pts)}\n'+''.join(f'{l} {r}\n' for l,r in lamps)+' '.join(map(str,pts))+'\n'
def oracle(lamps,pts):return [sum(1 for l,r in lamps if l<=p<=r) for p in pts]
def fast(lamps,pts):
 Ls=sorted(l for l,_ in lamps);Rs=sorted(r for _,r in lamps)
 return [bisect_right(Ls,p)-bisect_left(Rs,p) for p in pts]
def fmt(o):return ' '.join(map(str,o))+'\n'
def main():
 rng=random.Random(SEED)
 ex=([(1,7),(5,11),(7,9)],[7,1,5,10,9,15])
 assert oracle(*ex)==[3,1,2,1,2,0]
 small=[ex,([(0,0)],[0,1,-1]),([(-V,V)],[-V,V,0]),([(1,2),(3,4)],[2,3,5]),([(5,5),(5,5)],[5])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  sp=rng.choice([5,50,V]);lamps=[]
  for _ in range(rng.randint(1,8)):
   a,b=rng.randint(-sp,sp),rng.randint(-sp,sp);lamps.append((min(a,b),max(a,b)))
  pts=[rng.choice([rng.randint(-sp,sp)]+[x for lr in lamps for x in lr]) for _ in range(rng.randint(1,8))]
  if encode(lamps,pts) not in keys:keys.add(encode(lamps,pts));small.append((lamps,pts))
 for t in small:assert oracle(*t)==fast(*t)
 oracles=[{'input':encode(*t),'expectedOutput':fmt(oracle(*t))} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle):cases.append(case(nm,encode(*t),fmt(f(*t)),hidden))
 add('样例1',ex,False);add('端点恰好被照亮',([(2,4)],[1,2,4,5]),False);add('相同的灯',([(0,3),(0,3)],[3,0,-1]),False)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,t):add(nm,t,f=fast)
 big('满规模全部覆盖全域',([(-V,V)]*N,[rng.randint(-V,V) for _ in range(N)]))
 big('满规模单点灯查端点',([(i,i) for i in range(N)],[rng.randint(-5,N+5) for _ in range(N)]))
 def rl():
  a,b=rng.randint(-V,V),rng.randint(-V,V);return (min(a,b),max(a,b))
 L=[rl() for _ in range(N)]
 big('满规模随机灯随机点',(L,[rng.randint(-V,V) for _ in range(N)]))
 big('满规模随机灯查端点',(L,[rng.choice(L)[rng.randint(0,1)] for _ in range(N)]))
 big('满规模嵌套灯',([(-i,i) for i in range(N)],[rng.randint(-N,N) for _ in range(N)]))
 big('满规模首尾相接',([(i*10,i*10+10) for i in range(N)],[rng.randint(0,10*N+10) for _ in range(N)]))
 def exhaustive(run):
  c=0;iv=[(l,r) for l in range(1,5) for r in range(l,5)]
  for k in (1,2):
   for lamps in product(iv,repeat=k):
    pts=[0,1,2,3,4,5];e=oracle(list(lamps),pts);assert run(encode(list(lamps),pts)).split()==list(map(str,e));c+=1
  return c,{'lampsMin':1,'lampsMax':2,'coordinates':[1,4],'points':[0,5]}
 P=problem(PID,'ZipRecruiter OA #11：灯与控制点','中等',['排序','二分查找','扫描线'],
  '数轴上有若干盏灯，每盏照亮一段区间：第i盏灯覆盖从lamps[i][0]到lamps[i][1]的线段（含两端）。另给出控制点数组points。对每个控制点points[j]，求有多少盏灯照亮它，即points[j]位于[lamps[i][0],lamps[i][1]]内的灯的数量。按控制点的顺序输出答案。',
  '第一行两个整数n和m；随后n行，每行两个整数l、r表示一盏灯；最后一行m个整数points。1≤n,m≤100000，−10^9≤l≤r≤10^9，−10^9≤points[j]≤10^9。',
  '输出一行m个整数，第j个为照亮points[j]的灯数。',
  '样例1：灯[1,7]、[5,11]、[7,9]。点7被三盏灯照亮，点1被1盏，点5被2盏，点10被1盏，点9被2盏，点15没有灯，输出3 1 2 1 2 0。\n样例2：端点2和4都被照亮，1和5不被照亮。\n样例3：两盏相同的灯[0,3]都计入。',
  ['点p被[l,r]覆盖当且仅当l≤p≤r。','覆盖数=左端点≤p的灯数−右端点<p的灯数。','把左右端点分别排序后二分。'],outputLimit=4096)
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'左右端点排序后二分计数','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent per-point scan over every lamp with l<=p<=r; Python bisect over sorted endpoint lists for formal large cases; exhaustive one or two lamps on coordinates 1..4 with points 0..5.',
  'imageProvenance':IMAGE_PROVENANCE+' CodeSignal screenshot of the lamps/control-points statement (inclusive segments) with the example; this is the authoritative statement because the upstream md prose describes an unrelated ID-check queue problem while its example data matches this image.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=n,m<=1e5, coordinates in [-1e9,1e9], each lamp l<=r. Stdin: "n m", n lines "l r", then m points.',
  'corrections':['Upstream md statement text (event ID-check queue, last guest finish time) does not match its own example or the image; the image lamps/control-points statement is used. Example output unchanged.','Second and third public examples are authored.'],
  'reason':'上游md正文与原图是不同的题，样例数据与原图一致；以原图的灯/控制点闭区间计数为准；原图无约束，自选n、m≤1e5、坐标≤1e9；端点排序二分，独立逐灯扫描核验。'})
if __name__=='__main__':main()
