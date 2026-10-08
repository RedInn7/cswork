#!/usr/bin/env python3
"""Amazon #340 schedule requests to the least busy allowed server; rule recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-amazon-340';BATCH='amazon-340-recovered';SEED=20261008340
PATH='fastprep/Amazon/amazon-schedule-requests-to-servers.md'
S=100000;N=200000
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <string>
using namespace std;
int sz;vector<long long>t;
long long key(long long cnt,int idx){return cnt*(1LL<<20)+idx;}
int main(){int s,n;if(scanf("%d %d",&s,&n)!=2)return 0;sz=1;while(sz<s)sz<<=1;t.assign(2*sz,1LL<<62);
for(int i=0;i<s;i++)t[sz+i]=key(0,i);for(int i=sz-1;i>0;i--)t[i]=min(t[2*i],t[2*i+1]);
string out;out.reserve(n*7);
for(int k=0;k<n;k++){int r;scanf("%d",&r);long long best=1LL<<62;int lo=sz,hi=sz+r+1;
 while(lo<hi){if(lo&1)best=min(best,t[lo++]);if(hi&1)best=min(best,t[--hi]);lo>>=1;hi>>=1;}
 int idx=best&((1<<20)-1);int p=sz+idx;t[p]+=1LL<<20;for(p>>=1;p;p>>=1)t[p]=min(t[2*p],t[2*p+1]);
 out+=to_string(idx);out+=k+1<n?' ':'\n';}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误并列时取编号最大','language':'cpp','code':REFERENCE.replace('return cnt*(1LL<<20)+idx;','return cnt*(1LL<<20)+((1<<20)-1-idx);').replace('int idx=best&((1<<20)-1);','int idx=(1<<20)-1-(int)(best&((1<<20)-1));')},
 {'name':'错误忽略允许范围','language':'cpp','code':REFERENCE.replace('hi=sz+r+1;','hi=sz+s;')},
 {'name':'错误允许范围不含requests[i]','language':'cpp','code':REFERENCE.replace('hi=sz+r+1;','hi=sz+(r>0?r:1);')},
 {'name':'错误忙碌度不累加','language':'cpp','code':REFERENCE.replace('t[p]+=1LL<<20;','')},
]
EDITORIAL='''## 题意

有servers台服务器（编号0..servers−1）。按顺序处理请求，第i个请求只能分配给编号0..requests[i]的服务器，选当前最不忙的一台；并列时选编号最小的。服务器的忙碌度是它已经分配到的请求数（请求不会完成或释放）。输出每个请求分配到的服务器编号。

## 思路

需要支持“前缀区间内取（分配数，编号）最小者”和“单点加一”。把(分配数,编号)编码成一个整数cnt·2^20+idx，用线段树维护区间最小值：查询[0,requests[i]]的最小值得到服务器编号，再把该叶子加2^20并向上更新。

## 正确性

编码后的整数大小顺序与“先比分配数、再比编号”的字典序一致（编号<2^20）。线段树每次给出前缀中的最小编码，即满足规则的服务器；更新后树中保存的仍是真实分配数。

## 复杂度

建树O(servers)，每个请求O(log servers)。

## 独立验证

oracle逐个请求在0..requests[i]中线性扫描计数数组，按（计数,编号）取最小，不使用线段树。大用例的期望值由另一份Python自底向上线段树（元组比较）计算。穷举servers=1..3、请求数1..4的全部请求序列并逐个真实运行参考程序。错误解覆盖并列取最大编号、忽略允许范围、范围不含右端点和忙碌度不累加。
'''
def encode(s,req):
 assert 1<=s<=S and 1<=len(req)<=N and all(0<=r<s for r in req)
 return f'{s} {len(req)}\n'+' '.join(map(str,req))+'\n'
def oracle(s,req):
 cnt=[0]*s;out=[]
 for r in req:
  b=min(range(r+1),key=lambda j:(cnt[j],j));cnt[b]+=1;out.append(b)
 return out
def segtree(s,req):
 size=1
 while size<s:size*=2
 t=[(float('inf'),0)]*(2*size)
 for i in range(s):t[size+i]=(0,i)
 for i in range(size-1,0,-1):t[i]=min(t[2*i],t[2*i+1])
 out=[]
 for r in req:
  lo,hi=size,size+r+1;b=(float('inf'),0)
  while lo<hi:
   if lo&1:b=min(b,t[lo]);lo+=1
   if hi&1:hi-=1;b=min(b,t[hi])
   lo//=2;hi//=2
  i=b[1];p=size+i;t[p]=(t[p][0]+1,i);p//=2
  while p:t[p]=min(t[2*p],t[2*p+1]);p//=2
  out.append(i)
 return out
def fmt(o):return ' '.join(map(str,o))+'\n'
def main():
 rng=random.Random(SEED)
 small=[(5,[3,1,0,2,1]),(1,[0]),(1,[0,0,0]),(3,[2,2,2,2,2,2]),(3,[0,1,2]),(4,[3,0,3,0,3]),(2,[1,0,1,0]),(5,[4,4,4,4,4,0,0])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  s=rng.randint(1,8);t=(s,[rng.randint(0,s-1) for _ in range(rng.randint(1,15))]);k=encode(*t)
  if k not in keys:keys.add(k);small.append(t)
 for t in small:assert oracle(*t)==segtree(*t)
 assert oracle(5,[3,1,0,2,1])==[0,1,0,2,1]
 oracles=[{'input':encode(*t),'expectedOutput':fmt(oracle(*t))} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle):cases.append(case(nm,encode(*t),fmt(f(*t)),hidden))
 add('样例1',small[0],False);add('全部可用轮流分配',(3,[2,2,2,2]),False);add('只能用服务器0',(4,[0,0,3,3]),False)
 used={c['input'] for c in cases};rest=[t for t in small[1:] if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,s,req):add(nm,(s,req),f=segtree)
 big('满规模全范围轮转',S,[S-1]*N)
 big('满规模只用前缀小',S,[rng.randint(0,10) for _ in range(N)])
 big('满规模随机',S,[rng.randint(0,S-1) for _ in range(N)])
 big('满规模递增范围',S,[min(S-1,i//2) for i in range(N)])
 big('满规模递减范围',S,[max(0,S-1-i//2) for i in range(N)])
 big('满规模两台服务器',2,[rng.randint(0,1) for _ in range(N)])
 big('满规模混合大小范围',S,[rng.choice([0,S-1,rng.randint(0,S-1)]) for _ in range(N)])
 def exhaustive(run):
  c=0
  for s in range(1,4):
   for n in range(1,5):
    for req in product(range(s),repeat=n):
     e=oracle(s,list(req));assert e==segtree(s,list(req));assert run(encode(s,list(req))).split()==list(map(str,e));c+=1
  return c,{'serversMin':1,'serversMax':3,'requestsMin':1,'requestsMax':4}
 P=problem(PID,'Amazon OA #340：分配请求到服务器','中等',['线段树','模拟'],
  '有servers台服务器，编号0..servers−1。按顺序处理n个请求：第i个请求只能分配给编号0到requests[i]（含）之间的服务器，并且要分配给其中最不忙的那台；如果有多台同样最不忙，选编号最小的。服务器的忙碌程度是它已经被分配的请求数，请求分配后不会释放。输出每个请求被分配到的服务器编号。',
  '第一行两个整数servers和n；第二行n个整数requests[0..n−1]。1≤servers≤100000，1≤n≤200000，0≤requests[i]<servers。',
  '输出一行n个整数，第i个为第i个请求分配到的服务器编号，空格分隔。',
  '样例1：servers=5，requests=[3,1,0,2,1]。请求0在0..3中都空闲，选0；请求1在0..1中服务器1更闲，选1；请求2只能选0；请求3在0..2中服务器2分配数为0，选2；请求4在0..1中服务器0有2个、服务器1有1个，选1。输出0 1 0 2 1。\n样例2：三台服务器都可用，依次分配到0、1、2，第四个请求时三台各有1个，选0。\n样例3：前两个请求只能用服务器0；之后服务器1分配数最少，选1，再选2。',
  ['服务器的忙碌度就是已分配的请求数。','需要在前缀区间内查询（分配数,编号）的最小值。','线段树可以同时支持前缀最小值查询和单点更新。'],outputLimit=4096)
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'前缀最小值线段树','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent linear scan of per-server assignment counts with (count,index) minimum; separate Python bottom-up tuple segment tree for formal large cases; exhaustive request sequences for servers 1..3 and up to 4 requests.',
  'imageProvenance':IMAGE_PROVENANCE+' Text screenshot giving the allowed range 0..requests[i] inclusive, least-busy choice and least-index tie rule, and the example.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=servers<=1e5, 1<=n<=2e5, 0<=requests[i]<servers. "Busy" is not defined in words; with no durations or completion events in the problem, the number of requests already assigned is the only available measure, and the sample is reproduced exactly by it. Stdin: "servers n" then n integers.',
  'corrections':['Upstream md statement truncated and explanation says the rule is unknown; rule supplied by the image. Sample output unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出允许范围0..requests[i]、取最不忙、并列取最小编号的规则；忙碌度在无时间维度时只能是已分配请求数，样例精确吻合；原图无约束，自选servers≤1e5、n≤2e5；线段树，独立线性扫描核验。'})
if __name__=='__main__':main()
