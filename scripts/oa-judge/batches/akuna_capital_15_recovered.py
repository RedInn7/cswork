#!/usr/bin/env python3
"""Akuna Capital #15 Nearest Neighbouring City; tie rule and samples recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys,string
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-akuna-capital-15';BATCH='akuna-capital-15-recovered';SEED=20261008015
PATH='fastprep/Akuna Capital/akuna-find-nearest-cities.md'
N=100000;V=10**9;CH=string.ascii_lowercase+string.digits+'-'
REFERENCE=r'''#include <cstdio>
#include <string>
#include <vector>
#include <map>
#include <unordered_map>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<string>c(n);vector<long long>x(n),y(n);char buf[32];
unordered_map<string,int>id;id.reserve(2*n+1);
for(int i=0;i<n;i++){scanf("%31s %lld %lld",buf,&x[i],&y[i]);c[i]=buf;id[c[i]]=i;}
vector<int>bx(n),by(n);for(int i=0;i<n;i++)bx[i]=by[i]=i;
sort(bx.begin(),bx.end(),[&](int a,int b){return x[a]!=x[b]?x[a]<x[b]:y[a]<y[b];});
sort(by.begin(),by.end(),[&](int a,int b){return y[a]!=y[b]?y[a]<y[b]:x[a]<x[b];});
vector<int>px(n),py(n);for(int i=0;i<n;i++){px[bx[i]]=i;py[by[i]]=i;}
int m;scanf("%d",&m);string out;
for(int k=0;k<m;k++){scanf("%31s",buf);int q=id[buf];int best=-1;long long bd=0;
auto consider=[&](int j){long long d=llabs(x[j]-x[q])+llabs(y[j]-y[q]);if(best<0||d<bd||(d==bd&&c[j]<c[best])){best=j;bd=d;}};
int p=px[q];if(p>0&&x[bx[p-1]]==x[q])consider(bx[p-1]);if(p+1<n&&x[bx[p+1]]==x[q])consider(bx[p+1]);
p=py[q];if(p>0&&y[by[p-1]]==y[q])consider(by[p-1]);if(p+1<n&&y[by[p+1]]==y[q])consider(by[p+1]);
out+=best<0?string("NONE"):c[best];out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误距离相同时取名字较短者','language':'cpp','code':REFERENCE.replace('(d==bd&&c[j]<c[best])','(d==bd&&(c[j].size()!=c[best].size()?c[j].size()<c[best].size():c[j]<c[best]))')},
 {'name':'错误距离相同时保留先找到的','language':'cpp','code':REFERENCE.replace('||(d==bd&&c[j]<c[best])','')},
 {'name':'错误只考虑共享x坐标','language':'cpp','code':REFERENCE.replace('p=py[q];if(p>0&&y[by[p-1]]==y[q])consider(by[p-1]);if(p+1<n&&y[by[p+1]]==y[q])consider(by[p+1]);','')},
 {'name':'错误每条线只看后继城市','language':'cpp','code':REFERENCE.replace('if(p>0&&x[bx[p-1]]==x[q])consider(bx[p-1]);','').replace('if(p>0&&y[by[p-1]]==y[q])consider(by[p-1]);','')},
]
EDITORIAL='''## 题意

城市位于互不相同的整数坐标。对每个查询城市，在与它共享x坐标或共享y坐标的其他城市中找曼哈顿距离最近的；距离相同取名字字典序更小的（如ab<aba<abb）；没有共线城市输出NONE。

## 思路

与查询城市共享x的城市都在同一竖线上，距离只等于|Δy|，所以最近者必是按y排序后与它相邻的两个之一；共享y同理。把城市按(x,y)和(y,x)各排序一次，记录每个城市在两种顺序中的位置。每个查询最多检查4个候选：同x线上的前驱后继、同y线上的前驱后继，取距离最小、再按名字比较。

## 正确性

同一条线上，比相邻城市更远的城市距离严格更大（坐标互不相同），不可能是答案，也不会与相邻者并列；两侧相邻城市可能并列，二者都被检查，名字比较处理并列；竖线和横线上的候选再统一比较。

## 复杂度

排序O(n log n)，每个查询O(1)（哈希定位）。距离最大约2×10^9，用64位。

## 独立验证

oracle对每个查询扫描全部城市直接比较（距离，名字），不依赖排序相邻性。穷举3×3网格上所有至多4个城市的摆放（名字固定为一组含前缀关系的字符串），对每个城市查询并逐个真实运行参考程序。错误解覆盖名字长度优先、并列保留先找到者、只看共享x、只看一侧相邻城市。
'''
def encode(cities,qs):
 assert 1<=len(cities)<=N and 1<=len(qs)<=N
 assert len({c for c,_,_ in cities})==len(cities) and len({(x,y) for _,x,y in cities})==len(cities)
 for c,x,y in cities:assert 1<=len(c)<=10 and set(c)<=set(CH) and 1<=x<=V and 1<=y<=V
 names={c for c,_,_ in cities};assert all(q in names for q in qs)
 return f'{len(cities)}\n'+''.join(f'{c} {x} {y}\n' for c,x,y in cities)+f'{len(qs)}\n'+''.join(q+'\n' for q in qs)
def oracle(cities,qs):
 pos={c:(x,y) for c,x,y in cities};out=[]
 for q in qs:
  qx,qy=pos[q];cand=[(abs(x-qx)+abs(y-qy),c) for c,x,y in cities if c!=q and (x==qx or y==qy)]
  out.append(min(cand)[1] if cand else 'NONE')
 return out
def fast(cities,qs):
 import collections
 bx=collections.defaultdict(list);by=collections.defaultdict(list)
 for c,x,y in cities:bx[x].append((y,c));by[y].append((x,c))
 best={}
 for lines in (bx,by):
  for k,L in lines.items():
   L.sort()
   for i,(v,c) in enumerate(L):
    for j in (i-1,i+1):
     if 0<=j<len(L):
      cand=(abs(L[j][0]-v),L[j][1])
      if c not in best or cand<best[c]:best[c]=cand
 return [best[q][1] if q in best else 'NONE' for q in qs]
def main():
 rng=random.Random(SEED)
 def name(k=None):return ''.join(rng.choice(CH) for _ in range(k or rng.randint(1,10)))
 ex=[([('c1',3,3),('c2',2,2),('c3',1,3)],['c1','c2','c3']),
  ([('fastcity',23,1),('bigbanana',23,10),('xyz',23,20)],['fastcity','bigbanana','xyz']),
  ([('london',1,1),('warsaw',10,10),('hackerland',20,10)],['london','warsaw','hackerland']),
  ([('green',100,100),('red',200,200),('blue',300,300),('yellow',400,400),('pink',500,500)],['green','red','blue','yellow','pink']),
  ([('aba',5,1),('ab',5,9),('abb',1,5),('q',5,5)],['q','ab','aba','abb']),
  ([('only',1,1)],['only','only']),
  ([('z',1,1),('a',3,1),('m',2,1)],['m','z','a'])]
 small=list(ex);keys={encode(*t) for t in small}
 while len(small)<170:
  g=rng.choice([3,5,20]);k=rng.randint(1,min(g*g,12));pts=rng.sample([(i,j) for i in range(1,g+1) for j in range(1,g+1)],k)
  pool=['a','ab','aba','abb','b','b-','0','a0','zz','-']
  ns=rng.sample(pool,k) if k<=len(pool) and rng.random()<0.6 else list({name(rng.randint(1,3)) for _ in range(k*3)})[:k]
  if len(ns)<k:continue
  cities=[(ns[i],x,y) for i,(x,y) in enumerate(pts)];qs=[rng.choice(ns) for _ in range(rng.randint(1,8))]
  t=(cities,qs);kk=encode(*t)
  if kk not in keys:keys.add(kk);small.append(t)
 for t in small:assert oracle(*t)==fast(*t)
 assert oracle(*ex[0])==['c3','NONE','c1'] and oracle(*ex[2])==['NONE','hackerland','warsaw'] and oracle(*ex[1])==['bigbanana','fastcity','bigbanana']
 oracles=[{'input':encode(*t),'expectedOutput':''.join(s+'\n' for s in oracle(*t))} for t in small]
 cases=[]
 def add(nm,t,hidden=True):cases.append(case(nm,encode(*t),''.join(s+'\n' for s in fast(*t)),hidden))
 add('样例1',ex[0],False);add('样例2',ex[1],False);add('样例3',ex[2],False)
 for i,t in enumerate(small[3:30]):add(f'小规模{i+1}',t)
 def uniq(k):
  s=set()
  while len(s)<k:s.add(name())
  return list(s)
 def big(nm,pts,qmode='all'):
  ns=uniq(len(pts));cities=[(ns[i],x,y) for i,(x,y) in enumerate(pts)]
  qs=ns[:N] if qmode=='all' else [rng.choice(ns) for _ in range(N)]
  add(nm,(cities,qs))
 big('满规模同一竖线',[(V,i*10000) for i in range(1,N+1)])
 big('满规模对角线全NONE',[(i,i) for i in range(1,N+1)])
 big('满规模网格',[(i*7,j*7) for i in range(1,317) for j in range(1,317)][:N])
 big('满规模随机稀疏',list({(rng.randint(1,V),rng.randint(1,V)) for _ in range(N)}),'rand')
 big('满规模小值域随机',list({(rng.randint(1,400),rng.randint(1,400)) for _ in range(N+20000)})[:N],'rand')
 # all neighbours equidistant on both lines: centre with 4 neighbours at the same distance, names decide
 pts=[];cities=[];qs=[]
 for b in range(N//5):
  cx=(b%300)*10+5;cy=(b//300)*10+5;base=f'c{b}'
  grp=[(base,cx,cy),(base+'b',cx-1,cy),(base+'a',cx+1,cy),(base+'-',cx,cy-1),(base+'x',cx,cy+1)]
  cities+=grp;qs.append(base)
 add('满规模四邻等距按名字',(cities,qs*5))
 L=[(f'n{i}',1+(i%2)*2,1+i//2*2) for i in range(N)]
 add('满规模两竖线',(L,[c for c,_,_ in L]))
 def exhaustive(run):
  c=0;cells=[(x,y) for x in (1,2,3) for y in (1,2,3)];names=['ab','aba','a','b']
  from itertools import combinations
  for k in range(1,5):
   for pts in combinations(cells,k):
    cities=[(names[i],x,y) for i,(x,y) in enumerate(pts)];qs=[n for n,_,_ in cities]
    e=oracle(cities,qs);assert e==fast(cities,qs);assert run(encode(cities,qs)).split()==e;c+=1
  return c,{'grid':'3x3','citiesMin':1,'citiesMax':4,'names':names}
 P=problem(PID,'Akuna Capital OA #15：最近的共线城市','中等',['排序','哈希表','模拟'],
  '平面上有n座城市，每座城市位于整数坐标(x,y)，名字和坐标都互不相同。对每个查询城市q，在与它共享x坐标或共享y坐标的其他城市中，找出曼哈顿距离（|Δx|+|Δy|）最小的城市。若有多座城市距离相同，取名字字典序最小的（例如ab<aba<abb）。如果没有任何其他城市与它共享x或y坐标，答案为NONE。',
  '第一行n。随后n行，每行一个城市：名字c、x、y，空格分隔。接着一行m，随后m行，每行一个查询城市的名字（保证是已有城市）。1≤n,m≤100000，1≤x,y≤10^9，名字长度1..10，仅含小写字母、数字和-。',
  '输出m行，第i行为第i个查询的答案（城市名或NONE）。',
  '样例1：三座城市c1(3,3)、c2(2,2)、c3(1,3)。c1与c3共享y，距离2，答案c3；c2没有共线城市，答案NONE；c3的答案是c1。\n样例2：三座城市都在x=23上，fastcity(23,1)、bigbanana(23,10)、xyz(23,20)，答案依次为bigbanana、fastcity、bigbanana。\n样例3：london(1,1)无共线城市；warsaw(10,10)与hackerland(20,10)共享y，互为答案。',
  ['共享x的城市都在同一竖线上，最近的一定与它按y排序相邻。','对每个城市最多只需检查4个候选。','距离相同时比较名字的字典序，不是长度。'],outputLimit=4096)
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'按行列排序后检查相邻城市','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent O(n*m) scan over all cities with (distance,name) tuple minimum; Python per-line sorted adjacency for formal cases; exhaustive placements on a 3x3 grid with prefix-related names.',
  'imageProvenance':IMAGE_PROVENANCE+' Single long HackerRank screenshot giving statement, tie rule, constraints, the worked example and Sample Cases 0-2.',
  'rangeDisclosure':'Full original bounds preserved from the image: 1<=n,m<=1e5, 1<=x,y<=1e9, names length 1..10 over [a-z0-9-], unique names and coordinates. Stdin: n lines "name x y", then m query names (each an existing city).',
  'corrections':['Image example lists return array as [\'3\',\'NONE\',\'c1\'] while its own explanation says the nearest city to c1 is c3; expected output uses c3.','Upstream md example 1 explanation uses wrong coordinates (1,1) for c3 and wrong answers; image coordinates (1,3) and answers used.','Upstream md example 3 output [NONE,warsaw,hackerland] contradicts the rule; image Sample Case 1 output [NONE,hackerland,warsaw] used.','Tie rule (alphabetically smaller name) taken from image; md sentence garbled.'],
  'reason':'原图给出并列取字典序更小名字的规则、完整约束和全部样例；原图样例输出"3"为笔误按其解释取c3；排序相邻候选，独立全量扫描与网格穷举核验。'})
if __name__=='__main__':main()
