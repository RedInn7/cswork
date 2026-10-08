#!/usr/bin/env python3
"""Salesforce #11 find all pairs satisfying the two min/max conditions; conditions recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-salesforce-11';BATCH='salesforce-11-recovered';SEED=20261008011
PATH='fastprep/Salesforce/salesforce-find-all-pairs-of-integers.md'
N=1000;V=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <string>
#include <cstdlib>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long>a(n);for(auto&x:a)scanf("%lld",&x);
string out;long long k=0;
for(int i=0;i<n;i++)for(int j=i+1;j<n;j++){long long p=llabs(a[i]),q=llabs(a[j]);if(max(p,q)<=2*min(p,q)){k++;out+=to_string(a[i]);out+=' ';out+=to_string(a[j]);out+='\n';}}
printf("%lld\n",k);fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误化简时忘记取绝对值','language':'cpp','code':REFERENCE.replace('long long p=llabs(a[i]),q=llabs(a[j]);','long long p=a[i],q=a[j];')},
 {'name':'错误包含同一下标自配对','language':'cpp','code':REFERENCE.replace('for(int j=i+1;j<n;j++)','for(int j=i;j<n;j++)')},
 {'name':'错误数对内按数值从小到大输出','language':'cpp','code':REFERENCE.replace('out+=to_string(a[i]);out+=\' \';out+=to_string(a[j]);','out+=to_string(min(a[i],a[j]));out+=\' \';out+=to_string(max(a[i],a[j]));')},
 {'name':'错误条件1写成严格小于','language':'cpp','code':REFERENCE.replace('max(p,q)<=2*min(p,q)','max(p,q)<2*min(p,q)')},
]
EDITORIAL='''## 题意

在数组中找出所有下标对i<j，使x=arr[i]、y=arr[j]同时满足：
1. min(|x−y|,|x+y|) ≤ min(|x|,|y|)；
2. max(|x−y|,|x+y|) ≥ max(|x|,|y|)。
按i升序、i相同时按j升序输出(arr[i],arr[j])。

## 思路

设a=|x|≤b=|y|。不论符号如何，{|x−y|,|x+y|}={b−a, a+b}。条件2即a+b≥b，恒成立；条件1即b−a≤a，也就是b≤2a。所以只需判断max(|x|,|y|)≤2·min(|x|,|y|)，双重循环按要求的顺序输出即可。

## 正确性

上面的化简对x、y各种符号都成立，因为|x−y|与|x+y|恰好一个等于||x|−|y||、另一个等于|x|+|y|。枚举顺序本身就是要求的输出顺序。

## 复杂度

O(n²)，输出最多n(n−1)/2对。

## 独立验证

oracle直接用Python大整数按原题两个条件逐字计算，不使用b≤2a的化简。穷举长度1..4、取值−3..3的全部数组并逐个真实运行参考程序。错误解覆盖化简时漏掉绝对值、包含自配对、数对内按大小排序输出和条件写成严格小于。
'''
def encode(a):
 assert 1<=len(a)<=N and all(-V<=x<=V for x in a)
 return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def oracle(a):
 r=[(x,y) for i,x in enumerate(a) for y in a[i+1:] if min(abs(x-y),abs(x+y))<=min(abs(x),abs(y)) and max(abs(x-y),abs(x+y))>=max(abs(x),abs(y))]
 return f'{len(r)}\n'+''.join(f'{x} {y}\n' for x,y in r)
def main():
 rng=random.Random(SEED)
 small=[[2,5,-3],[1],[0],[0,0],[0,1],[2,2],[2,4],[2,5],[-2,4],[-2,-5],[3,-6,7,-1],[V,-V],[V,V//2],[V,V//2-1]]
 keys={encode(a) for a in small}
 while len(small)<170:
  a=[rng.randint(-m,m) for m in [rng.choice([3,20,V])] for _ in range(rng.randint(1,12))];k=encode(a)
  if k not in keys:keys.add(k);small.append(a)
 assert oracle([2,5,-3])=='2\n2 -3\n5 -3\n'
 oracles=[{'input':encode(a),'expectedOutput':oracle(a)} for a in small]
 cases=[]
 def add(nm,a,hidden=True):cases.append(case(nm,encode(a),oracle(a),hidden))
 add('样例1',[2,5,-3],False);add('相等元素与零',[4,-4,0],False);add('无合法数对',[1,3,7],False)
 used={c['input'] for c in cases};rest=[a for a in small[1:] if encode(a) not in used]
 for i,a in enumerate(rest[:26]):add(f'小规模{i+1}',a)
 add('满规模全部相同最大值',[V]*N)
 add('满规模正负最大值交替',[V if i%2 else -V for i in range(N)])
 add('满规模随机大值',[rng.randint(-V,V) for _ in range(N)])
 add('满规模二的幂',[(1<<(i%30))*(-1 if i%3==0 else 1) for i in range(N)])
 add('满规模随机小值',[rng.randint(-5,5) for _ in range(N)])
 add('满规模边界倍数',[V,V//2,-(V//2),V//2-1,-(V//2+1)]*(N//5))
 def exhaustive(run):
  c=0
  for n in range(1,5):
   for a in product(range(-3,4),repeat=n):
    e=oracle(list(a));assert run(encode(list(a))).split()==e.split();c+=1
  return c,{'nMin':1,'nMax':4,'values':[-3,3]}
 P=problem(PID,'Salesforce OA #11：满足条件的数对','中等',['数学','枚举'],
  '给定整数数组arr，找出所有满足下列两个条件的数对(x,y)，其中x=arr[i]，y=arr[j]，i<j：\n1. min(|x−y|,|x+y|) ≤ min(|x|,|y|)；\n2. max(|x−y|,|x+y|) ≥ max(|x|,|y|)。\n\n同一个下标不能与自己配对；值相同但下标不同的元素可以配对。',
  '第一行n；第二行n个整数arr[0..n−1]。1≤n≤1000，−10^9≤arr[i]≤10^9。',
  '第一行输出满足条件的数对个数k。随后k行，每行两个整数arr[i] arr[j]，按i升序、i相同时按j升序排列。',
  '样例1：arr=[2,5,−3]。(2,−3)：min(5,1)=1≤2且max(5,1)=5≥3；(5,−3)：min(8,2)=2≤3且max(8,2)=8≥5；(2,5)：min(3,7)=3>2，不满足。\n样例2：[4,−4,0]中(4,−4)满足；含0的数对要求另一个数也为0，不满足。\n样例3：[1,3,7]没有数对满足条件1，输出0。',
  ['设a=|x|≤b=|y|，则|x−y|与|x+y|分别是b−a和a+b。','条件2总是成立。','条件1等价于b≤2a。'],outputLimit=32768)
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'绝对值化简为两倍关系','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent literal evaluation of both original conditions with Python big integers (no b<=2a simplification); exhaustive arrays of length 1..4 over -3..3.',
  'imageProvenance':IMAGE_PROVENANCE+' Text screenshot giving both conditions and the example pairs.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=n<=1000 (output can contain ~5e5 pairs), -1e9<=arr[i]<=1e9. Pairs are index pairs i<j with no self-pairing (the example omits self pairs, which would also satisfy the conditions); output ordered by (i,j) with pair members in array order, matching the example. Stdin: n then n integers; stdout: count line then pairs.',
  'corrections':['Upstream md marks the conditions as an educated guess; the image confirms the identical two conditions. Example pairs unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出两个条件，与md的推测一致；样例确定不含自配对、按下标顺序列出；原图无约束，自选n≤1000、|值|≤1e9；化简为b≤2a，独立逐字条件计算与穷举核验。'})
if __name__=='__main__':main()
