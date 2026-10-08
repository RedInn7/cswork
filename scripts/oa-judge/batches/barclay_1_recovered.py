#!/usr/bin/env python3
"""Barclay #1 maximum GCD after replacing at most one element by X in [1,R]; operation recovered from the source image."""
from pathlib import Path
from itertools import product
from math import gcd
from functools import reduce
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-barclay-1';BATCH='barclay-1-recovered';SEED=20261008111
PATH='fastprep/Barclay/barclay-find-maximum-possible-gcd.md'
N=100000;V=100000
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <numeric>
#include <algorithm>
using namespace std;
int bestDiv(int g,int R){if(g<=R)return g;int b=1;for(int d=1;(long long)d*d<=g;d++)if(g%d==0){if(d<=R)b=max(b,d);if(g/d<=R)b=max(b,g/d);}return b;}
int main(){int n,R;if(scanf("%d %d",&n,&R)!=2)return 0;vector<int>a(n);for(auto&x:a)scanf("%d",&x);
vector<int>pre(n+1,0),suf(n+2,0);for(int i=0;i<n;i++)pre[i+1]=gcd(pre[i],a[i]);for(int i=n-1;i>=0;i--)suf[i]=gcd(suf[i+1],a[i]);
int ans=pre[n];vector<int>seen;
for(int i=0;i<n;i++){int g=gcd(pre[i],suf[i+1]);ans=max(ans,bestDiv(g,R));}
printf("%d\n",ans);}
'''
MUTANTS=[
 {'name':'错误必须执行一次替换','language':'cpp','code':REFERENCE.replace('int ans=pre[n];','int ans=0;')},
 {'name':'错误取min(其余gcd,R)','language':'cpp','code':REFERENCE.replace('ans=max(ans,bestDiv(g,R));','ans=max(ans,min(g,R));')},
 {'name':'错误只尝试替换最大元素','language':'cpp','code':REFERENCE.replace('for(int i=0;i<n;i++){int g=gcd(pre[i],suf[i+1]);','int mi=max_element(a.begin(),a.end())-a.begin();for(int i=mi;i<=mi;i++){int g=gcd(pre[i],suf[i+1]);')},
 {'name':'错误替换值只能取R','language':'cpp','code':REFERENCE.replace('ans=max(ans,bestDiv(g,R));','ans=max(ans,gcd(g,R));')},
]
EDITORIAL='''## 题意

数组A与整数R。最多一次（可以不做）把某个元素替换为1..R中的任意整数X。求整个数组可能的最大GCD。

## 思路

不操作时答案为整体gcd。若替换下标i，其余元素的gcd为g_i，新的gcd为gcd(g_i,X)，它一定是g_i的约数；而对g_i的任意约数d≤R，取X=d即可达到d。所以替换i能得到的最大值是g_i不超过R的最大约数。用前缀gcd与后缀gcd在O(1)内得到每个g_i，再枚举约数到√g_i求不超过R的最大约数（g_i≤R时直接是g_i）。

## 正确性

gcd(g_i,X)整除g_i，且X≤R时gcd(g_i,X)≤X≤R，所以它是g_i不超过R的约数；反之每个这样的约数都可达。答案取不操作与所有i的最大值。注意整体gcd可能大于R，此时不操作更优。

## 复杂度

O(n√V)，V=10^5。

## 独立验证

oracle枚举替换位置i和全部X∈[1,R]直接计算整个数组的gcd，并考虑不替换的情况（O(n²R)，仅小数据），不使用前后缀与约数推理。穷举长度2..3、元素1..6、R=1..6的全部组合并逐个真实运行参考程序。错误解覆盖必须替换、取min(g,R)、只替换最大元素和只能替换为R。
'''
def encode(R,a):
 assert 2<=len(a)<=N and 1<=R<=V and all(1<=x<=V for x in a)
 return f'{len(a)} {R}\n'+' '.join(map(str,a))+'\n'
def oracle(R,a):
 best=reduce(gcd,a)
 for i in range(len(a)):
  for X in range(1,R+1):best=max(best,reduce(gcd,a[:i]+[X]+a[i+1:]))
 return best
def fast(R,a):
 n=len(a);pre=[0]*(n+1);suf=[0]*(n+1)
 for i in range(n):pre[i+1]=gcd(pre[i],a[i])
 for i in range(n-1,-1,-1):suf[i]=gcd(suf[i+1],a[i])
 best=pre[n]
 for i in range(n):
  g=gcd(pre[i],suf[i+1])
  if g<=R:best=max(best,g)
  else:best=max(best,max(d for k in range(1,int(g**0.5)+1) if g%k==0 for d in (k,g//k) if d<=R))
 return best
def main():
 rng=random.Random(SEED)
 ex=(10,[2,3,4])
 assert oracle(*ex)==2==fast(*ex)
 small=[ex,(5,[100,100]),(5,[100,7]),(1,[6,9]),(7,[12,18,7]),(3,[12,18,5]),(4,[30,30,1]),(6,[1,1])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(2,7);R=rng.randint(1,rng.choice([10,60]))
  base=rng.randint(1,12);a=[base*rng.randint(1,8) if rng.random()<0.7 else rng.randint(1,100) for _ in range(n)]
  t=(R,a)
  if encode(*t) not in keys:keys.add(encode(*t));small.append(t)
 for t in small:assert oracle(*t)==fast(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex,False,closed=2);add('不操作更优',(5,[100,100]),False,closed=100);add('取不超过R的最大约数',(7,[12,18,7]),False,closed=6)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,t,closed=None):add(nm,t,f=fast,closed=closed)
 big('满规模全为最大值R=1',(1,[V]*N),closed=V)
 big('满规模一个异类',(V,[99990]*(N-1)+[1]),closed=99990)
 big('满规模异类且R较小',(1000,[99990]*(N-1)+[7]))
 big('满规模随机',(rng.randint(1,V),[rng.randint(1,V) for _ in range(N)]))
 big('满规模公共因子随机',(rng.randint(1,V),[720*rng.randint(1,138) for _ in range(N)]))
 big('满规模两个异类',(V,[83160]*(N-2)+[1,1]))
 big('满规模大质数与R限制',(9000,[99991]*(N-1)+[2]),closed=1)
 big('满规模高约数个数',(997,[83160]*(N-1)+[13]))
 def exhaustive(run):
  c=0
  for n in (2,3):
   for a in product(range(1,7),repeat=n):
    for R in range(1,7):
     e=oracle(R,list(a));assert e==fast(R,list(a));assert run(encode(R,list(a))).split()==[str(e)];c+=1
  return c,{'nMin':2,'nMax':3,'values':[1,6],'R':[1,6]}
 P=problem(PID,'Barclays OA #1：最大可能的GCD','中等',['数论','前缀和','枚举'],
  '给定整数R和由正整数组成的数组A。你最多可以进行一次如下操作（也可以不做）：选择数组中的任意一个元素，把它替换为任意满足1≤X≤R的整数X。求整个数组可能得到的最大GCD。',
  '第一行两个整数N和R；第二行N个整数A[0..N−1]。2≤N≤10^5，1≤R≤10^5，1≤A[i]≤10^5。',
  '输出一个整数，表示最大可能的GCD。',
  '样例1：A=[2,3,4]，R=10。把3改成2，gcd(2,2,4)=2，这是最大可能值。\n样例2：A=[100,100]，R=5。不操作时gcd为100，任何替换都会让gcd不超过5，答案100。\n样例3：A=[12,18,7]，R=7。替换7后其余元素gcd为6≤7，取X=6，答案6。',
  ['替换下标i后，新的gcd一定是其余元素gcd的约数。','用前缀gcd和后缀gcd求去掉一个元素后的gcd。','别忘了可以不操作。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'前后缀gcd与不超过R的最大约数','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent enumeration of every replacement position and every X in [1,R] plus the no-operation case, recomputing the whole-array gcd; exhaustive n=2..3 over values 1..6 and R 1..6.',
  'imageProvenance':IMAGE_PROVENANCE+' Text screenshot with the at-most-once replacement rule, constraints and the example.',
  'rangeDisclosure':'Full original bounds preserved from the image: 2<=N<=1e5, 1<=R<=1e5, 1<=A[i]<=1e5. Stdin: "N R" then N integers.',
  'corrections':['Upstream md statement truncated; operation (at most once, any one element, 1<=X<=R) supplied by the image. Output 2 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出最多一次、替换任一元素为1..R的整数的操作与完整约束；前后缀gcd加约数枚举，独立全替换枚举核验。'})
if __name__=='__main__':main()
