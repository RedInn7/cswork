#!/usr/bin/env python3
"""Salesforce #26 maximum pair-propagation operations; operation recovered from the source image."""
from pathlib import Path
from itertools import product
from functools import lru_cache
import random,sys,string
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-salesforce-26';BATCH='salesforce-26-recovered';SEED=20261008026
PATH='fastprep/Salesforce/salesforce-max-number-of-operations.md'
N=200000;L=string.ascii_lowercase
REFERENCE=r'''#include <cstdio>
#include <cstring>
#include <vector>
static char s[200005];
int main(){if(scanf("%200004s",s)!=1)return 0;int n=strlen(s);
std::vector<int>cnt((size_t)(n+1)*26,0);for(int i=0;i<n;i++){for(int c=0;c<26;c++)cnt[(size_t)(i+1)*26+c]=cnt[(size_t)i*26+c];cnt[(size_t)(i+1)*26+s[i]-'a']++;}
long long ans=0;int p=n;char tail=0;int r=n-1;
while(r>=0){int l=r;while(l>0&&s[l-1]==s[r])l--;
 if(r-l+1>=2){char y=s[r];int mid=p-(r+1);int same=cnt[(size_t)p*26+y-'a']-cnt[(size_t)(r+1)*26+y-'a'];ans+=mid-same;if(p<n&&tail!=y)ans+=n-p;p=l;tail=y;}
 r=l-1;}
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误每个成对段只操作一次','language':'cpp','code':REFERENCE.replace('ans+=mid-same;if(p<n&&tail!=y)ans+=n-p;','if(r+1<n)ans+=1;')},
 {'name':'错误右侧相同字符也计数','language':'cpp','code':REFERENCE.replace('ans+=mid-same;if(p<n&&tail!=y)ans+=n-p;','ans+=n-(r+1);')},
 {'name':'错误32位计数','language':'cpp','code':REFERENCE.replace('long long ans=0;','int ans=0;').replace('printf("%lld\\n",ans);','printf("%d\\n",ans);')},
 {'name':'错误从左往右扩展','language':'cpp','code':r'''#include <cstdio>
#include <cstring>
static char s[200005];
int main(){scanf("%200004s",s);int n=strlen(s);long long c=0;
for(int i=0;i+2<n;i++)if(s[i]==s[i+1]&&s[i+1]!=s[i+2]){s[i+2]=s[i];c++;}
printf("%lld\n",c);}
'''},
]
EDITORIAL='''## 题意

对字符串s，一次操作选连续三个字符s[i]、s[i+1]、s[i+2]，当s[i]=s[i+1]且s[i+1]≠s[i+2]时把s[i+2]改成s[i]。求最多能执行多少次操作。

## 思路

操作的效果是：一段长度≥2的同字符段x可以向右“蔓延”，把右边紧挨着的字符改成x，于是这段继续变长、继续向右。遇到已经是x的字符就直接跨过（它与段合并）。所以一段x能贡献的次数，就是它右边当前不等于x的字符个数。

关键是顺序：先让最靠右的可蔓延段把它右边全部改成自己的字符，再让左边下一段蔓延——这样左边的段在经过右边区域时，面对的是全部相同的另一字母，能多改一遍。按段从右往左处理：维护“从位置p起到末尾全部为字符tail”。处理长度≥2的段[l,r]（字符y）时，它的贡献为(r,p)之间原字符中≠y的个数（用26个字母的前缀计数求），加上若tail≠y则再加n−p；然后令p=l、tail=y。长度为1的段不能蔓延，保持原样。

## 正确性

只有长度≥2的同字符段能触发操作，且写入的字符就是该段的字符，所以每次操作把某个位置改成其左侧相邻段的字符。一个位置每被改一次，就要求它左边有一段与它不同的成对段蔓延过来。从右往左的顺序让每个位置被其左侧每一个“与当前值不同”的成对段各改一次，这是可能的最大次数。实现上还用穷举状态搜索在小数据上验证了这个结论。

## 复杂度

O(26n)时间和空间。答案可达约n²/4，使用64位整数。

## 独立验证

oracle在中小数据上逐步模拟“每次执行最右侧的可行操作”，直到无操作可做；更小的数据用记忆化搜索枚举所有操作顺序求最大值，证明这种模拟就是最优。穷举字母表{a,b,c}上长度1..8的全部字符串，三者一致并逐个真实运行参考程序。错误解覆盖每段只操作一次、不区分已相同字符、32位计数和从左往右扫描一遍。
'''
def encode(s):
 assert 1<=len(s)<=N and set(s)<=set(L)
 return s+'\n'
def nexts(s):return [s[:i+2]+s[i]+s[i+3:] for i in range(len(s)-2) if s[i]==s[i+1]!=s[i+2]]
@lru_cache(None)
def brute(s):return max([1+brute(t) for t in nexts(s)],default=0)
def rightmost(s):
 s=list(s);c=0
 while True:
  i=next((i for i in range(len(s)-3,-1,-1) if s[i]==s[i+1]!=s[i+2]),None)
  if i is None:return c
  s[i+2]=s[i];c+=1
def runs(s):
 n=len(s);ans=0;p=n;tail=None;r=n-1
 while r>=0:
  l=r
  while l>0 and s[l-1]==s[r]:l-=1
  if r-l+1>=2:
   y=s[r];ans+=sum(1 for ch in s[r+1:p] if ch!=y)
   if p<n and tail!=y:ans+=n-p
   p=l;tail=y
  r=l-1
 return ans
def main():
 rng=random.Random(SEED)
 small=['accept','aabaab','aabba','a','ab','aa','aab','aaa','aabb','aabbcc','abcdef','zzab','aabbaabb','abba','abccba']
 keys={encode(s) for s in small}
 while len(small)<170:
  s=''.join(rng.choice(L[:rng.choice([2,3,4,26])]) for _ in range(rng.randint(1,16)))
  if rng.random()<0.5:s=''.join(c*rng.randint(1,3) for c in s)[:24]
  if encode(s) not in keys:keys.add(encode(s));small.append(s)
 for s in small:
  assert rightmost(s)==runs(s),s
  if len(s)<=9:assert brute(s)==runs(s)
 assert [runs(x) for x in ('accept','aabaab','aabba')]==[3,2,4]
 oracles=[{'input':encode(s),'expectedOutput':f'{rightmost(s)}\n'} for s in small]
 cases=[]
 def add(nm,s,hidden=True,f=rightmost,closed=None):
  e=f(s)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(s),f'{e}\n',hidden))
 add('样例1','accept',False,closed=3);add('样例2','aabaab',False,closed=2);add('样例3','aabba',False,closed=4)
 used={c['input'] for c in cases};rest=[s for s in small if encode(s) not in used]
 for i,s in enumerate(rest[:26]):add(f'小规模{i+1}',s)
 def big(nm,s,closed=None):add(nm,s,f=runs,closed=closed)
 big('满长交替成对段',('aabb'*(N//4)))
 big('满长开头成对其余互异',('aa'+('bc'*N))[:N],closed=N-2)
 big('满长全同','a'*N,closed=0)
 big('满长无相邻相同','ab'*(N//2),closed=0)
 big('满长随机成对段',''.join(rng.choice(L)*rng.randint(1,3) for _ in range(N))[:N])
 big('满长随机字母',''.join(rng.choice(L) for _ in range(N)))
 big('满长三字母成对循环',('aabbcc'*(N//6+1))[:N])
 def exhaustive(run):
  c=0
  for n in range(1,9):
   for t in product('abc',repeat=n):
    s=''.join(t);e=brute(s);assert e==rightmost(s)==runs(s);assert run(encode(s)).split()==[str(e)];c+=1
  return c,{'lengthMin':1,'lengthMax':8,'alphabet':'abc','bruteForce':'memoized search over all operation orders'}
 P=problem(PID,'Salesforce OA #26：最多操作次数','困难',['字符串','贪心','前缀和'],
  '给定字符串s。一次操作：选择连续的三个字符s[i]、s[i+1]、s[i+2]，当且仅当s[i]=s[i+1]且s[i+1]≠s[i+2]时，把s[i+2]替换为s[i]。操作可以按任意顺序执行任意多次，求最多能执行的操作次数。',
  '一行字符串s。1≤s的长度≤200000，只含小写英文字母。',
  '输出一个整数，表示最多操作次数。',
  '样例1："accept"中cc依次把e、p、t改成c，共3次。\n样例2："aabaab"先用后面的aa把末尾b改成a，再用开头的aa把第3个字符b改成a，共2次。\n样例3："aabba"先用bb把末尾a改成b得到"aabbb"，再用aa依次把三个b改成a，共4次。',
  ['被改写的字符总是变成它左边那段成对字符的字母。','先让右边的成对段向右蔓延，左边的段之后还能再改一遍。','从右往左按段处理，用前缀计数统计不同字母的个数。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'成对段从右往左蔓延','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满长',
  'oracleMethod':'Independent literal simulation always applying the rightmost valid operation; memoized search over every operation order on short strings proving that simulation optimal; Python run-based count for formal large cases.',
  'imageProvenance':IMAGE_PROVENANCE+' Handwritten-style text screenshot with the operation condition and three examples; no constraints.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=|s|<=2e5, lowercase letters; answer up to about n^2/4, exact 64-bit. Stdin: one line s.',
  'corrections':['Upstream md statement truncated; operation supplied by the image. All three sample outputs unchanged.'],
  'reason':'原图给出操作条件与三个样例，规则完整；原图无约束，自选|s|≤2e5；成对段从右往左蔓延计数，独立最右操作模拟与全顺序记忆化搜索核验。'})
if __name__=='__main__':main()
