#!/usr/bin/env python3
"""Amazon #311 next greater perfect string; perfect-string definition recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys,string
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-amazon-311';BATCH='amazon-311-recovered';SEED=20261008311
PATH='fastprep/Amazon/amazon-next-greater-perfect-string.md'
N=200000;L=string.ascii_lowercase
REFERENCE=r'''#include <cstdio>
#include <cstring>
static char s[200005];
int main(){if(scanf("%200004s",s)!=1)return 0;int n=strlen(s);int p=n;for(int i=1;i<n;i++)if(s[i]==s[i-1]){p=i;break;}
int start=p<n?p:n-1;
for(int i=start;i>=0;i--){for(char c=s[i]+1;c<='z';c++){if(i>0&&c==s[i-1])continue;s[i]=c;char prev=c;for(int j=i+1;j<n;j++){s[j]=prev=='a'?'b':'a';prev=s[j];}puts(s);return 0;}}
puts("-1");}
'''
MUTANTS=[
 {'name':'错误不检查保留前缀是否完美','language':'cpp','code':REFERENCE.replace('int start=p<n?p:n-1;','int start=n-1;')},
 {'name':'错误后缀全部填a','language':'cpp','code':REFERENCE.replace("s[j]=prev=='a'?'b':'a';","s[j]='a';")},
 {'name':'错误改动字符可与前一个字符相同','language':'cpp','code':REFERENCE.replace('if(i>0&&c==s[i-1])continue;','')},
 {'name':'错误完美串直接返回自身','language':'cpp','code':REFERENCE.replace('int start=p<n?p:n-1;','if(p==n){puts(s);return 0;}int start=p;')},
]
EDITORIAL='''## 题意

相邻字符都不相同的字符串称为完美串。给定小写字母串s（未必完美），求与s等长、字典序严格大于s的最小完美串；不存在输出-1。

## 思路

答案与s的最长公共前缀越长越小。设p为第一个满足s[p]=s[p−1]的位置（s完美时p=n）。答案保留的前缀s[0..i−1]必须完美，因此i≤p；又必须严格变大，所以i≤n−1。从i=min(p,n−1)往前试：在位置i放一个大于s[i]、且不等于s[i−1]的最小字母c；找到后，i之后的位置依次填入最小的合法字母（前一个是a就填b，否则填a），即ababa…交替。所有i都不行则输出-1。

## 正确性

字典序比较由第一个不同位置决定。保留前缀越长、该位置字母越小，结果越小；而之后的部分取逐位最小的合法字母即可，后缀总能用a/b交替填满，不会失败。i>p时保留的前缀含相邻相同字符，不可能完美；s完美时i=n意味着不变，不满足严格大于。

## 复杂度

O(26n)，实际只需O(n+26)。

## 独立验证

oracle对每个位置i、每个可选字母都构造候选串，过滤出完美且大于s的候选后取最小值，不依赖“从右往左第一个可行位置即最优”的结论。小数据另从s开始按26进制逐个递增字符串，直到遇到第一个完美串，直接验证“等长、严格大于、最小”。穷举字母表{a,b,c,y,z}上长度1..4的全部字符串并逐个真实运行参考程序。错误解覆盖不检查前缀完美、后缀填a、忽略与前一字符相同、完美串返回自身。
'''
def encode(s):
 assert 1<=len(s)<=N and set(s)<=set(L)
 return s+'\n'
def perfect(t):return all(a!=b for a,b in zip(t,t[1:]))
def fill(prefix,n):
 t=list(prefix)
 while len(t)<n:t.append('b' if t[-1]=='a' else 'a')
 return ''.join(t)
def oracle(s):
 n=len(s);cands=[]
 for i in range(n):
  for c in L:
   if c>s[i]:
    t=fill(s[:i]+c,n)
    if perfect(t) and t>s:cands.append(t)
 return min(cands) if cands else '-1'
def brute(s):
 n=len(s);v=[ord(c)-97 for c in s]
 while True:
  k=n-1
  while k>=0 and v[k]==25:v[k]=0;k-=1
  if k<0:return '-1'
  v[k]+=1;t=''.join(chr(97+x) for x in v)
  if perfect(t):return t
def main():
 rng=random.Random(SEED)
 small=['abzzzcd','zzab','a','z','ab','ba','zz','aa','zyz','aba','abab','zaz','azaz','yzz','azzz','zzzz','zyx']
 keys={encode(s) for s in small}
 while len(small)<170:
  s=''.join(rng.choice(rng.choice([L,'az','yz','abz','xyz'])) for _ in range(rng.randint(1,12)))
  if encode(s) not in keys:keys.add(encode(s));small.append(s)
 for s in small:
  e=oracle(s)
  if len(s)<=4:assert e==brute(s),s
 assert oracle('abzzzcd')=='acababa' and oracle('zzab')=='-1'
 oracles=[{'input':encode(s),'expectedOutput':oracle(s)+'\n'} for s in small]
 cases=[]
 def add(nm,s,hidden=True,e=None):
  if e is None:e=oracle(s)
  cases.append(case(nm,encode(s),e+'\n',hidden))
 add('样例1','abzzzcd',False);add('样例2','zzab',False);add('本身是完美串','abab',False)
 used={c['input'] for c in cases};rest=[s for s in small if encode(s) not in used]
 for i,s in enumerate(rest[:26]):add(f'小规模{i+1}',s)
 def ref(s):
  n=len(s);p=next((i for i in range(1,n) if s[i]==s[i-1]),n)
  for i in range(min(p,n-1),-1,-1):
   for c in L:
    if c>s[i] and not(i>0 and c==s[i-1]):return fill(s[:i]+c,n)
  return '-1'
 for s in small:assert ref(s)==oracle(s)
 def big(nm,s,e=None):
  r=ref(s)
  if e is not None:assert r==e,nm
  add(nm,s,e=r)
 big('满长全a','a'*N,'ab'+fill('ab',N)[2:])
 big('满长全z','z'*N,'-1')
 big('满长交替yz','yz'*(N//2),'za'+fill('za',N)[2:])
 big('满长交替ab','ab'*(N//2))
 big('满长随机',''.join(rng.choice(L) for _ in range(N)))
 big('满长完美末位z',fill('a',N-1)+'z')
 big('满长首个冲突靠后',fill('c',N//2)+fill('c',N//2)[-1]+fill('a',N-N//2-1))
 acc=[rng.choice(L)]
 while len(acc)<N:acc.append(rng.choice([c for c in L if c!=acc[-1]]))
 big('满长随机完美串',''.join(acc))
 def exhaustive(run):
  c=0
  for n in range(1,5):
   for t in product('abcyz',repeat=n):
    s=''.join(t);e=brute(s);assert e==oracle(s)==ref(s);assert run(encode(s)).split()==[e];c+=1
  return c,{'lengthMin':1,'lengthMax':4,'alphabet':'abcyz','bruteForce':'base-26 increment until first perfect string'}
 P=problem(PID,'Amazon OA #311：下一个完美字符串','中等',['字符串','贪心'],
  '如果一个字符串中任意两个相邻字符都不相同，就称它是完美串。给定一个由小写英文字母组成的字符串s（s本身可能是也可能不是完美串），求与s长度相同、字典序严格大于s的最小完美串。如果不存在，输出-1。',
  '一行字符串s。1≤s的长度≤200000，只含小写英文字母。',
  '输出答案字符串；不存在时输出-1。',
  '样例1：s="abzzzcd"。前缀abz之后的z与它相同，必须在下标≤2处变大；下标2的z无法再变大，于是把下标1的b改成c，后面填最小的交替串ababa，得到"acababa"。\n样例2：s="zzab"，下标0的z无法变大，下标1要变大也必须超过z，因此不存在，输出-1。\n样例3：s="abab"本身是完美串，严格大于它的最小完美串是"abac"。',
  ['答案保留的前缀必须是完美的，所以不能越过第一处相邻相同的位置。','从能保留的最长前缀开始，向左寻找可以变大的位置。','变大位置之后用a和b交替填充即可。'],outputLimit=1024)
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'最长完美前缀与交替填充','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满长',
  'oracleMethod':'Independent minimum over all (position, letter) candidates with explicit perfect/greater filtering; base-26 increment brute force to the first perfect string on short inputs; Python greedy for formal large cases.',
  'imageProvenance':IMAGE_PROVENANCE+' Candidate recollection post (self-reported 11/15 tests) giving the perfect-string definition and both examples; no constraints.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=|s|<=2e5, lowercase a-z. Result length equal to |s| (sample 1 rules out shorter answers such as "ac"; equal length is the standard reading of "next greater string"). Stdin: one line s.',
  'corrections':['Upstream md statement truncated; perfect-string definition (no two adjacent equal characters) supplied by the image. Both sample outputs unchanged.','Third public example is authored.'],
  'reason':'原图给出完美串定义（相邻不同）与两个样例；样例1排除更短答案，按等长理解；原图无约束，自选|s|≤2e5；贪心+交替填充，独立候选枚举与逐个递增暴力核验。'})
if __name__=='__main__':main()
