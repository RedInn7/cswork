#!/usr/bin/env python3
"""OpenAI #5 count consecutive ranges avoiding forbidden pairs; rule recovered from the source image."""
from pathlib import Path
from itertools import product,combinations
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-openai-5';BATCH='openai-5-recovered';SEED=20261008005
PATH='fastprep/OpenAI/openai-count-valid-sequences.md'
N=200000;M=200000
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n,m;if(scanf("%d %d",&n,&m)!=2)return 0;vector<int>lim(n+2,n+1);
for(int i=0;i<m;i++){int a,b;scanf("%d %d",&a,&b);if(a>b)swap(a,b);lim[a]=min(lim[a],b);}
long long ans=0;int R=n+1;for(int l=n;l>=1;l--){R=min(R,lim[l]);ans+=R-l;}
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误把数对当作有序只处理a<b','language':'cpp','code':REFERENCE.replace('if(a>b)swap(a,b);lim[a]=min(lim[a],b);','if(a<b)lim[a]=min(lim[a],b);')},
 {'name':'错误允许区间包含禁止对的右端','language':'cpp','code':REFERENCE.replace('ans+=R-l;','ans+=min(R+1,n+1)-l;')},
 {'name':'错误不计长度为1的序列','language':'cpp','code':REFERENCE.replace('ans+=R-l;','ans+=R-l-1;')},
 {'name':'错误32位计数','language':'cpp','code':REFERENCE.replace('long long ans=0;','int ans=0;').replace('printf("%lld\\n",ans);','printf("%d\\n",ans);')},
]
EDITORIAL='''## 题意

在1..n中统计连续整数段[l,r]（长度≥1）的个数，要求段内不同时包含任何一个禁止对的两个数。

## 思路

把每个禁止对规范成a<b。段[l,r]非法当且仅当存在禁止对满足l≤a且b≤r。固定l，合法的r必须小于lim(l)=min{b : 禁止对的a≥l}（没有则为n+1），且所有满足r<lim(l)的r都合法，所以以l为左端点的合法段数为lim(l)−l。从n到1倒序扫描，lim(l)就是后缀最小值。

## 正确性

段[l,r]包含禁止对(a,b)⇔l≤a<b≤r。对固定l，合法性随r增大单调变差，阈值恰为所有a≥l的禁止对中最小的b。逐个l累加即得答案。

## 复杂度

O(n+m)。答案最多n(n+1)/2≈2×10^10，使用64位整数。

## 独立验证

oracle枚举所有[l,r]并对每个禁止对直接检查是否同在段内（O(n²m)，仅小数据），不使用后缀最小值。穷举n=1..5时所有禁止对集合（数对以随机顺序给出）并逐个真实运行参考程序。错误解覆盖只处理a<b的数对、右端点差一、不计单元素段与32位计数。
'''
def encode(n,pairs):
 assert 1<=n<=N and 0<=len(pairs)<=M and all(1<=a<=n and 1<=b<=n and a!=b for a,b in pairs)
 return f'{n} {len(pairs)}\n'+''.join(f'{a} {b}\n' for a,b in pairs)
def oracle(n,pairs):
 return sum(1 for l in range(1,n+1) for r in range(l,n+1) if not any(l<=a<=r and l<=b<=r for a,b in pairs))
def fast(n,pairs):
 lim=[n+1]*(n+2)
 for a,b in pairs:
  a,b=min(a,b),max(a,b);lim[a]=min(lim[a],b)
 R=n+1;ans=0
 for l in range(n,0,-1):R=min(R,lim[l]);ans+=R-l
 return ans
def main():
 rng=random.Random(SEED)
 small=[(4,[(1,3)]),(1,[]),(2,[(1,2)]),(2,[(2,1)]),(5,[]),(5,[(5,1)]),(5,[(1,2),(2,3),(3,4),(4,5)]),(6,[(2,5),(5,2),(3,4)]),(4,[(1,4),(1,4)])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(2,12);ps=[]
  for _ in range(rng.randint(0,8)):
   a,b=rng.sample(range(1,n+1),2);ps.append((a,b))
  t=(n,ps);k=encode(*t)
  if k not in keys:keys.add(k);small.append(t)
 for t in small:assert oracle(*t)==fast(*t)
 assert oracle(4,[(1,3)])==8
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,closed=None,f=oracle):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',small[0],False,8);add('没有禁止对',(3,[]),False,6);add('逆序给出的数对',(3,[(3,2)]),False,4)
 used={c['input'] for c in cases};rest=[t for t in small[1:] if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,t,closed=None):add(nm,t,closed=closed,f=fast)
 big('满规模无禁止对',(N,[]),N*(N+1)//2)
 big('满规模相邻全禁止',(N,[(i+1,i) for i in range(1,N)]),N)
 big('满规模首尾一对',(N,[(1,N)]),N*(N+1)//2-1)
 big('满规模随机远距离对',(N,[tuple(rng.sample(range(1,N+1),2)) for _ in range(M)]))
 big('满规模随机近距离对',(N,[(lambda a:(a,min(N,a+rng.randint(1,1000))) if a<N else (a,a-1))(rng.randint(1,N)) for _ in range(M)]))
 big('满规模重复数对',(N,[(N//2,N//2+5000)]*M))
 big('满规模稀疏宽对',(N,[(rng.randint(1,N//2),rng.randint(N//2+1,N)) for _ in range(1000)]))
 def exhaustive(run):
  c=0
  for n in range(1,6):
   allp=list(combinations(range(1,n+1),2))
   for k in range(len(allp)+1):
    for sub in combinations(allp,k):
     ps=[(b,a) if rng.random()<0.5 else (a,b) for a,b in sub]
     e=oracle(n,ps);assert e==fast(n,ps);assert run(encode(n,ps)).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':5,'pairSets':'all subsets of unordered pairs, random orientation'}
 P=problem(PID,'OpenAI OA #5：不含禁止对的连续段','中等',['前缀/后缀最小值','计数','数组'],
  '给定n和若干禁止对，每个禁止对中的两个数不能出现在同一个序列中。统计由1..n中连续整数构成的序列（即区间[l,r]，长度至少为1）中，有多少个不同时包含任何一个禁止对的两个数。',
  '第一行两个整数n和m；随后m行，每行两个整数a、b表示一个禁止对（顺序任意，可能重复）。1≤n≤200000，0≤m≤200000，1≤a,b≤n，a≠b。',
  '输出一个整数，表示合法序列的个数。',
  '样例1：n=4，禁止对(1,3)。合法序列为(1)、(2)、(3)、(4)、(1,2)、(2,3)、(3,4)、(2,3,4)，共8个；(1,2,3)和(1,2,3,4)同时含1和3，不合法。\n样例2：没有禁止对时，3个数共有6个连续段。\n样例3：禁止对(3,2)与(2,3)相同，只有(2,3)和(1,2,3)不合法，答案4。',
  ['区间[l,r]不合法当且仅当存在禁止对a<b满足l≤a且b≤r。','固定左端点l，右端点必须小于所有a≥l的禁止对中最小的b。','从右往左维护这个最小值。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'后缀最小右端点计数','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent enumeration of every [l,r] with a direct check against every forbidden pair; exhaustive over all pair subsets for n<=5 with random orientation; closed forms for empty/adjacent/endpoint pair sets.',
  'imageProvenance':IMAGE_PROVENANCE+' Single-sentence statement with the example and the full list of valid sequences.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=n<=2e5, 0<=m<=2e5, pair values in 1..n with a!=b, unordered and possibly repeated; exact 64-bit answer, no modulus. "Sub-sequences with consecutive numbers" means contiguous ranges, fixed by the example list. Stdin: "n m" then m lines "a b".',
  'corrections':['Upstream md statement truncated; rule supplied by the image. Sample output 8 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出禁止对与连续段计数规则，样例列表确定为连续区间；原图无约束，自选n、m≤2e5、无取模；后缀最小值计数，独立区间枚举与禁止对子集穷举核验。'})
if __name__=='__main__':main()
