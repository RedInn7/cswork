#!/usr/bin/env python3
"""Amazon #306 minimum arbitrary swaps to make a binary palindrome; rule recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
from collections import deque
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-amazon-306';BATCH='amazon-306-recovered';SEED=20261008306
PATH='fastprep/Amazon/amazon-minimum-swaps-to-make-palindrome.md'
N=1000000
REFERENCE=r'''#include <cstdio>
#include <cstring>
static char s[1000005];
int main(){if(scanf("%1000004s",s)!=1)return 0;int n=strlen(s),m=0;for(int i=0;i<n/2;i++)if(s[i]!=s[n-1-i])m++;
if(m%2==0)printf("%d\n",m/2);else if(n%2==1)printf("%d\n",(m+1)/2);else printf("-1\n");}
'''
MUTANTS=[
 {'name':'错误每个不匹配对都要一次交换','language':'cpp','code':REFERENCE.replace('if(m%2==0)printf("%d\\n",m/2);else if(n%2==1)printf("%d\\n",(m+1)/2);else printf("-1\\n");','if(m%2==1&&n%2==0)printf("-1\\n");else printf("%d\\n",m);')},
 {'name':'错误奇数个不匹配一律无解','language':'cpp','code':REFERENCE.replace('else if(n%2==1)printf("%d\\n",(m+1)/2);','')},
 {'name':'错误忽略无解情况','language':'cpp','code':REFERENCE.replace('else if(n%2==1)printf("%d\\n",(m+1)/2);else printf("-1\\n");','else printf("%d\\n",(m+1)/2);')},
 {'name':'错误奇数个不匹配向下取整','language':'cpp','code':REFERENCE.replace('printf("%d\\n",(m+1)/2);','printf("%d\\n",m/2);')},
]
EDITORIAL='''## 题意

一次操作交换任意两个位置的字符（不要求相邻）。求把01串变成回文的最少交换次数，做不到输出−1。

## 思路

把位置i与n−1−i配成一对，设不相等的对数为m。

- 一次交换最多改变两个位置，因此最多修好两对；m为偶数时，把一个“01”对的0与另一个“10”对的1交换（或类似配对），每次修好两对，答案m/2。
- m为奇数且长度为奇数时，最后剩下的一对可以与中间字符交换修好（中间字符取什么都行），答案(m+1)/2。
- m为奇数且长度为偶数时，1的个数与m同奇偶，即为奇数；偶数长度回文中1的个数必为偶数，交换又不改变1的个数，所以无解。

## 正确性

下界：每次交换只动两个位置，最多让两对从不等变相等，所以至少需要⌈m/2⌉次；上面的构造恰好达到下界。无解条件由1的个数奇偶性给出。

## 复杂度

O(n)。

## 独立验证

oracle用1的个数、0的个数与长度奇偶性推导可行性，并按“不匹配的01对和10对分别计数”的方式重新推出答案；小数据另以BFS在交换图上求最短步数。穷举长度1..9的全部01串，BFS结果与公式逐一比对并逐个真实运行参考程序。原样例按规则为2（先交换(4,5)，再交换(1,2)得到1001001）。错误解覆盖每对一次交换、奇数m一律无解、忽略无解与向下取整。
'''
def encode(s):
 assert 1<=len(s)<=N and set(s)<={'0','1'}
 return s+'\n'
def oracle(s):
 n=len(s);ones=s.count('1')
 if n%2==0 and ones%2==1:return -1
 a=sum(1 for i in range(n//2) if s[i]=='0' and s[n-1-i]=='1');b=sum(1 for i in range(n//2) if s[i]=='1' and s[n-1-i]=='0')
 m=a+b;return m//2+(m%2)
def bfs(s):
 if s==s[::-1]:return 0
 seen={s};q=deque([(s,0)]);n=len(s)
 while q:
  t,d=q.popleft()
  for i in range(n):
   for j in range(i+1,n):
    if t[i]!=t[j]:
     u=t[:i]+t[j]+t[i+1:j]+t[i]+t[j+1:]
     if u not in seen:
      if u==u[::-1]:return d+1
      seen.add(u);q.append((u,d+1))
 return -1
def main():
 rng=random.Random(SEED)
 small=['0100101','0','1','01','10','11','0011','0110','001','010','1100','100','1010','10101','11101']
 keys={encode(s) for s in small}
 while len(small)<170:
  s=''.join(rng.choice('01') for _ in range(rng.randint(1,40)))
  if encode(s) not in keys:keys.add(encode(s));small.append(s)
 for s in small:
  if len(s)<=10:assert oracle(s)==bfs(s),s
 oracles=[{'input':encode(s),'expectedOutput':f'{oracle(s)}\n'} for s in small]
 cases=[]
 def add(nm,s,hidden=True,closed=None):
  e=oracle(s)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(s),f'{e}\n',hidden))
 add('样例1',small[0],False,2);add('无法成为回文','10',False,-1);add('两对互相交换','0011',False,1)
 used={c['input'] for c in cases};rest=[s for s in small[1:] if encode(s) not in used]
 for i,s in enumerate(rest[:26]):add(f'小规模{i+1}',s)
 add('满长偶数全不匹配','0'*(N//2)+'1'*(N//2),closed=N//4)
 add('满长奇数全不匹配','0'*(N//2-1)+'1'+'1'*(N//2-1),closed=N//4)
 add('满长偶数无解','1'+'0'*(N-1),closed=-1)
 add('满长奇数长度借中间字符','1'+'0'*(N-2),closed=1)
 add('满长随机',''.join(rng.choice('01') for _ in range(N)))
 add('满长随机奇数长度',''.join(rng.choice('01') for _ in range(N-1)))
 add('满长已是回文',('0110'*(N//8))+('0110'*(N//8))[::-1],closed=0)
 def exhaustive(run):
  c=0
  for n in range(1,10):
   for t in product('01',repeat=n):
    s=''.join(t);e=oracle(s)
    if n<=8:assert e==bfs(s),s
    assert run(encode(s)).split()==[str(e)];c+=1
  return c,{'lengthMin':1,'lengthMax':9,'bfsUpTo':8}
 P=problem(PID,'Amazon OA #306：交换成回文','中等',['字符串','贪心','数学'],
  '给定一个只含字符0和1的字符串s。每次操作可以交换任意两个位置i、j上的字符（不要求相邻）。求把s变成回文串所需的最少交换次数；如果无论如何都做不到，输出−1。\n\n回文串是正读反读都相同的字符串，例如"0"、"111"、"010"、"10101"是回文，"001"、"10"、"11101"不是。',
  '一行01字符串s。1≤s的长度≤10^6。',
  '输出一个整数，表示最少交换次数，无解时输出−1。',
  '样例1：s="0100101"（下标从1开始）。交换(4,5)得到"0101001"，再交换(1,2)得到"1001001"，共2次；一次交换无法完成，答案2。\n样例2："10"中只有一个1，偶数长度的回文需要偶数个1，答案−1。\n样例3："0011"交换第1个和第3个字符得到"1001"，一次即可，答案1。',
  ['把第i个字符和倒数第i个字符配成一对，统计不相等的对数。','一次交换最多修好两对。','长度为奇数时可以借用中间字符；长度为偶数时1的个数必须为偶数。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'不匹配对计数与奇偶可行性','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满长',
  'oracleMethod':'Independent formula via ones-parity feasibility and separate 01/10 mismatch counts; breadth-first search over arbitrary swaps on all binary strings up to length 8 (and oracle strings up to 10).',
  'imageProvenance':IMAGE_PROVENANCE+' Forum screenshot of the statement: arbitrary two-position swap, -1 when impossible, palindrome examples, sample 0100101 with only the first optimal step (4,5) visible before truncation.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=|s|<=1e6, characters 0/1. Stdin: one line s.',
  'corrections':['Upstream sample output 1 is an explicit placeholder; by the image rule the minimum is 2 (verified by BFS): swap (4,5) then (1,2) giving 1001001. Statement uses 2.','Second and third public examples are authored.'],
  'reason':'原图给出任意两位置交换、不可行返回−1的规则；样例输出按规则BFS复算为2；原图无约束，自选|s|≤1e6；不匹配对计数公式，独立奇偶推导与BFS穷举核验。'})
if __name__=='__main__':main()
