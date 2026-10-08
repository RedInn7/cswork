#!/usr/bin/env python3
"""SIG #2 diff pairs; counting condition (i<=j, a[i]-b[j]==a[j]-b[i]) recovered from the source images."""
from pathlib import Path
from itertools import product
import random,sys
from collections import Counter
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-susquehanna-international-group-2';BATCH='susquehanna-international-group-2-recovered';SEED=20261008202
PATH='fastprep/Susquehanna International Group/sig-diff-pairs.md'
N=200000;V=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <unordered_map>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>a(n),b(n);for(auto&x:a)scanf("%lld",&x);for(auto&x:b)scanf("%lld",&x);
unordered_map<long long,long long>cnt;cnt.reserve(2*n+1);long long ans=0;
for(int i=0;i<n;i++){long long key=a[i]+b[i];ans+=++cnt[key];}
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误要求i<j不含i=j','language':'cpp','code':REFERENCE.replace('ans+=++cnt[key];','ans+=cnt[key]++;')},
 {'name':'错误按a[i]-b[i]分组','language':'cpp','code':REFERENCE.replace('long long key=a[i]+b[i];','long long key=a[i]-b[i];')},
 {'name':'错误32位计数','language':'cpp','code':REFERENCE.replace('long long ans=0;','int ans=0;').replace('printf("%lld\\n",ans);','printf("%d\\n",ans);')},
 {'name':'错误统计有序对','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",ans);','printf("%lld\\n",2*ans-n);')},
]
EDITORIAL='''## 题意

两个等长数组a、b，统计满足i≤j且a[i]−b[j]=a[j]−b[i]的下标对(i,j)个数。

## 思路

移项：a[i]−b[j]=a[j]−b[i] ⇔ a[i]+b[i]=a[j]+b[j]。令c[i]=a[i]+b[i]，问题变为统计i≤j且c[i]=c[j]的对数（i=j恒成立）。从左到右扫描，用哈希表记录每个值已出现次数，处理到i时把该值计数加一后整体加到答案里（包含i自己）。

## 正确性

等式变形可逆；每个满足条件的(i,j)恰好在扫描到j时被计入一次。

## 复杂度

O(n)期望。c[i]可达±2×10^9，答案可达约2×10^10，都需要64位整数。

## 独立验证

oracle直接按原式对所有i≤j逐对比较（O(n²)，仅小数据），不做移项。大用例期望值由Counter按Σ cnt·(cnt+1)/2计算。穷举长度1..4、元素−1..1的全部数组对并逐个真实运行参考程序。错误解覆盖漏掉i=j、错用a−b分组、32位计数和统计有序对。
'''
def encode(a,b):
 assert 1<=len(a)==len(b)<=N and all(-V<=x<=V for x in a+b)
 return f'{len(a)}\n'+' '.join(map(str,a))+'\n'+' '.join(map(str,b))+'\n'
def oracle(a,b):return sum(1 for i in range(len(a)) for j in range(i,len(a)) if a[i]-b[j]==a[j]-b[i])
def fast(a,b):return sum(v*(v+1)//2 for v in Counter(x+y for x,y in zip(a,b)).values())
def main():
 rng=random.Random(SEED)
 ex1=([2,-2,5,3],[1,5,-1,1]);ex2=([25,0],[0,25])
 assert oracle(*ex1)==6 and oracle(*ex2)==3
 small=[ex1,ex2,([0],[0]),([1,2],[2,1]),([V,-V],[V,-V]),([V,V],[V,-V]),([1,1,1],[1,1,1])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  n=rng.randint(1,12);m=rng.choice([2,10,V])
  t=([rng.randint(-m,m) for _ in range(n)],[rng.randint(-m,m) for _ in range(n)])
  if encode(*t) not in keys:keys.add(encode(*t));small.append(t)
 for t in small:assert oracle(*t)==fast(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',ex1,False,closed=6);add('样例2',ex2,False,closed=3);add('单个元素',([7],[-3]),False,closed=1)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:26]):add(f'小规模{i+1}',t)
 def big(nm,a,b,closed=None):add(nm,(a,b),f=fast,closed=closed)
 big('满规模和全相同',[i-N//2 for i in range(N)],[N//2-i for i in range(N)],closed=N*(N+1)//2)
 big('满规模和全不同',list(range(N)),[0]*N,closed=N)
 big('满规模随机大值',[rng.randint(-V,V) for _ in range(N)],[rng.randint(-V,V) for _ in range(N)])
 big('满规模随机小值',[rng.randint(-3,3) for _ in range(N)],[rng.randint(-3,3) for _ in range(N)])
 big('满规模和溢出32位',[V]*(N//2)+[-V]*(N//2),[V]*(N//2)+[-V]*(N//2),closed=2*((N//2)*(N//2+1)//2))
 big('满规模差相同和不同',list(range(N)),list(range(N)),closed=N)
 big('满规模两类交替',[V if i%2 else -V for i in range(N)],[0]*N)
 def exhaustive(run):
  c=0
  for n in range(1,5):
   for a in product((-1,0,1),repeat=n):
    for b in product((-1,0,1),repeat=n):
     if n==4 and (a[0]!=0):continue
     e=oracle(list(a),list(b));assert run(encode(list(a),list(b))).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':4,'values':[-1,0,1],'note':'n=4 restricted to a[0]=0'}
 P=problem(PID,'SIG OA #2：差值相等的下标对','简单',['哈希表','数学'],
  '给定两个长度相同的整数数组a和b，求满足i≤j并且a[i]−b[j]=a[j]−b[i]的下标对(i,j)的个数。',
  '第一行n；第二行n个整数a[0..n−1]；第三行n个整数b[0..n−1]。1≤n≤200000，−10^9≤a[i],b[i]≤10^9。',
  '输出一个整数，表示满足条件的下标对个数。',
  '样例1：a=[2,−2,5,3]，b=[1,5,−1,1]。成立的对为(0,0)、(0,1)、(1,1)、(2,2)、(2,3)、(3,3)，共6个；例如(0,1)：a[0]−b[1]=−3，a[1]−b[0]=−3。\n样例2：a=[25,0]，b=[0,25]，(0,0)、(0,1)、(1,1)都成立，答案3。\n样例3：只有(0,0)，答案1。',
  ['把等式移项。','条件等价于a[i]+b[i]=a[j]+b[j]。','i=j时条件总成立，别漏掉。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'移项后按和分组计数','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent O(n^2) evaluation of the original equality for every i<=j; Counter-based closed form sum cnt*(cnt+1)/2 for formal large cases; exhaustive arrays over {-1,0,1}.',
  'imageProvenance':IMAGE_PROVENANCE+' original-1 is the CodeSignal screenshot giving the condition i<=j and a[i]-b[j]==a[j]-b[i] with both examples fully explained; original-0 is a consistent transcription.',
  'rangeDisclosure':'Source images give no constraints (TO-DO). Chosen: 1<=n<=2e5, -1e9<=a[i],b[i]<=1e9; 64-bit sums and answer. Stdin: n, a, b.',
  'corrections':['Upstream md lacks the counting condition and example 2 explanation; both taken from the image. Outputs 6 and 3 unchanged.','Third public example is authored.'],
  'reason':'原图给出i≤j且a[i]−b[j]=a[j]−b[i]的计数条件与两个样例完整解释；原图无约束，自选n≤2e5、|值|≤1e9；移项按和计数，独立逐对比较核验。'})
if __name__=='__main__':main()
