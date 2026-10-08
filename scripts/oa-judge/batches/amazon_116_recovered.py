#!/usr/bin/env python3
"""Amazon #116 convert to good string (no 010/101 subsequence); rule recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-amazon-116';BATCH='amazon-116-recovered';SEED=20261008116
PATH='fastprep/Amazon/amazon-convert-to-good-string.md'
N=1000000
REFERENCE=r'''#include <cstdio>
#include <cstring>
#include <algorithm>
static char s[1000005];
int main(){if(scanf("%1000004s",s)!=1)return 0;int n=strlen(s);int ones=0,zeros=0;for(int i=0;i<n;i++)(s[i]=='1'?ones:zeros)++;
int p1=0,p0=0,best=n;for(int k=0;k<=n;k++){int a=p1+(zeros-p0);int b=p0+(ones-p1);best=std::min(best,std::min(a,b));if(k<n)(s[k]=='1'?p1:p0)++;}
printf("%d\n",best);}
'''
MUTANTS=[
 {'name':'错误只考虑先0后1的形式','language':'cpp','code':REFERENCE.replace('best=std::min(best,std::min(a,b));','best=std::min(best,a);(void)b;')},
 {'name':'错误只允许全部变成同一字符','language':'cpp','code':REFERENCE.replace('int p1=0,p0=0,best=n;','printf("%d\\n",std::min(ones,zeros));return 0;int p1=0,p0=0,best=n;')},
 {'name':'错误按段数减二计数','language':'cpp','code':r'''#include <cstdio>
#include <cstring>
static char s[1000005];
int main(){scanf("%1000004s",s);int n=strlen(s),t=0;for(int i=1;i<n;i++)if(s[i]!=s[i-1])t++;printf("%d\n",t>1?t-1:0);}
'''},
 {'name':'错误分界点不含两端','language':'cpp','code':REFERENCE.replace('for(int k=0;k<=n;k++){int a','for(int k=0;k<=n;k++){if(k==0||k==n){if(k<n)(s[k]==\'1\'?p1:p0)++;continue;}int a')},
]
EDITORIAL='''## 题意

01串若不含子序列010也不含子序列101，就是好串。每次操作翻转一个字符，求变成好串的最少操作次数。

## 思路

不含子序列010和101，等价于字符最多切换一次，即形如0…01…1或1…10…0（含全0、全1）。枚举分界点k（0..n）：变成“前k个0、其余1”的代价是前缀中1的个数加后缀中0的个数；变成“前k个1、其余0”的代价是前缀中0的个数加后缀中1的个数。用前缀计数一次扫描，取最小值。

## 正确性

若字符串有两次及以上的切换，必然出现x y x的子序列（x≠y），即010或101；反之至多一次切换时任取三个位置都不会出现x y x。所以好串集合恰为上述2(n+1)个目标串，最少翻转次数等于到这些目标串的最小汉明距离。

## 复杂度

O(n)时间，O(1)额外空间。

## 独立验证

oracle显式构造全部2(n+1)个目标串逐一计算汉明距离（O(n²)，仅小数据）；更小的数据再枚举全部2^n个01串，用子序列检查判定好串后求最小距离，直接验证“至多一次切换”的等价性。穷举长度1..10的全部01串并逐个真实运行参考程序。错误解覆盖只考虑0*1*、只允许全同、按切换次数计数和漏掉全0/全1目标。
'''
def encode(s):
 assert 1<=len(s)<=N and set(s)<={'0','1'}
 return s+'\n'
def oracle(s):
 n=len(s);targets=['0'*k+'1'*(n-k) for k in range(n+1)]+['1'*k+'0'*(n-k) for k in range(n+1)]
 return min(sum(a!=b for a,b in zip(s,t)) for t in targets)
def good(t):
 import re
 return not re.search('0.*1.*0',t) and not re.search('1.*0.*1',t)
def brute(s):
 n=len(s);return min(sum(a!=b for a,b in zip(s,t)) for t in (''.join(p) for p in product('01',repeat=n)) if good(t))
def fast(s):
 ones=s.count('1');zeros=len(s)-ones;p1=p0=0;best=len(s)
 for k in range(len(s)+1):
  best=min(best,p1+zeros-p0,p0+ones-p1)
  if k<len(s):
   if s[k]=='1':p1+=1
   else:p0+=1
 return best
def main():
 rng=random.Random(SEED)
 small=['111101110100','0','1','01','10','010','101','0101','1010','0110','1001','000111','111000','0011001100']
 keys={encode(s) for s in small}
 while len(small)<170:
  s=''.join(rng.choice('01') for _ in range(rng.randint(1,30)))
  if rng.random()<0.4:s=''.join(c*rng.randint(1,5) for c in s)[:40]
  if encode(s) not in keys:keys.add(encode(s));small.append(s)
 for s in small:
  assert oracle(s)==fast(s)
  if len(s)<=12:assert oracle(s)==brute(s)
 oracles=[{'input':encode(s),'expectedOutput':f'{oracle(s)}\n'} for s in small]
 cases=[]
 def add(nm,s,hidden=True,closed=None):
  e=fast(s)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(s),f'{e}\n',hidden))
 add('样例1',small[0],False,2);add('交替串','01010',False,2);add('已是好串','1100',False,0)
 for i,s in enumerate(small[1:27]):add(f'小规模{i+1}',s)
 add('满长交替','01'*(N//2),closed=N//2-1)
 add('满长全1','1'*N,closed=0)
 add('满长随机',''.join(rng.choice('01') for _ in range(N)))
 add('满长三段','0'*(N//3)+'1'*(N//3)+'0'*(N-2*(N//3)),closed=N//3)
 add('满长偏1随机',''.join('1' if rng.random()<0.9 else '0' for _ in range(N)))
 add('满长长段随机',''.join(rng.choice('01')*rng.randint(1,2000) for _ in range(1200))[:N])
 add('满长中间单个0','1'*(N//2)+'0'+'1'*(N//2-1),closed=1)
 def exhaustive(run):
  c=0
  for n in range(1,11):
   for t in product('01',repeat=n):
    s=''.join(t);e=fast(s)
    if n<=8:assert e==brute(s)
    assert e==oracle(s);assert run(encode(s)).split()==[str(e)];c+=1
  return c,{'lengthMin':1,'lengthMax':10,'subsequenceBruteUpTo':8}
 P=problem(PID,'Amazon OA #116：变成好串','中等',['字符串','前缀和','枚举'],
  '给定一个只含0和1的字符串s。如果一个字符串既不含子序列"010"，也不含子序列"101"（子序列不要求连续），就称它是好串。每次操作可以把一个0改成1，或把一个1改成0。求把s变成好串所需的最少操作次数。',
  '一行01字符串s。1≤s的长度≤10^6。',
  '输出一个整数，表示最少操作次数。',
  '样例1：s="111101110100"，把第5位和第9位（从1开始）的0改成1，得到"111111111100"，共2次。\n样例2："01010"可改成"00000"或"01111"等，至少2次。\n样例3："1100"已经是好串，答案0。',
  ['不含这两个子序列，意味着字符最多只切换一次。','好串只可能是0…01…1或1…10…0的形式。','枚举分界点，用前缀计数算翻转次数。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'至多一次切换的目标串枚举','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满长',
  'oracleMethod':'Independent explicit construction of all 2(n+1) target strings with Hamming distance; subsequence-regex brute force over all 2^n binary strings for short inputs; Python prefix-count scan for formal cases.',
  'imageProvenance':IMAGE_PROVENANCE+' Interview-report screenshot giving the forbidden subsequences 010/101, single-flip operation and the example.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=|s|<=1e6, characters 0/1 only ("string containing integers" read as a binary string, as the example and operations imply). "Number of operations required" read as the minimum. Stdin: one line s.',
  'corrections':['Image converted string "1111111111100" has 13 characters (one extra 1); the correct result of flipping positions 5 and 9 of the 12-character input is "111111111100". Output 2 unchanged.','Second and third public examples are authored.'],
  'reason':'原图补出被截断的禁用子序列010/101和单字符翻转操作；原图无约束，自选|s|≤1e6；分界点前缀计数，独立目标串汉明距离与子序列暴力核验。'})
if __name__=='__main__':main()
