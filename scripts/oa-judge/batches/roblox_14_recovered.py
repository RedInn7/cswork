#!/usr/bin/env python3
"""Roblox #14 cyclic shift pairs; rule recovered from source image original-1 (original-0 is a different problem)."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-roblox-14';BATCH='roblox-14-recovered';SEED=20261008014
PATH='fastprep/Roblox/roblox-shift-ops.md'
N=100000;V=10**9
REFERENCE=r'''#include <cstdio>
#include <string>
#include <unordered_map>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;unordered_map<string,long long>cnt;cnt.reserve(2*n+1);long long ans=0;
for(int i=0;i<n;i++){long long v;scanf("%lld",&v);string s=to_string(v),best=s;for(size_t k=1;k<s.size();k++){string t=s.substr(k)+s.substr(0,k);if(t<best)best=t;}
 ans+=cnt[best]++;}
printf("%lld\n",ans);}
'''
MUTANTS=[
 {'name':'错误按数字排序判定（排列而非循环移位）','language':'cpp','code':REFERENCE.replace('string s=to_string(v),best=s;for(size_t k=1;k<s.size();k++){string t=s.substr(k)+s.substr(0,k);if(t<best)best=t;}','string best=to_string(v);sort(best.begin(),best.end());')},
 {'name':'错误只统计数值相等的对','language':'cpp','code':REFERENCE.replace('for(size_t k=1;k<s.size();k++){string t=s.substr(k)+s.substr(0,k);if(t<best)best=t;}','')},
 {'name':'错误去掉数字0后再比较','language':'cpp','code':REFERENCE.replace('string s=to_string(v),best=s;','string s=to_string(v);s.erase(remove(s.begin(),s.end(),\'0\'),s.end());string best=s;')},
 {'name':'错误32位计数','language':'cpp','code':REFERENCE.replace('long long ans=0;','int ans=0;').replace('printf("%lld\\n",ans);','printf("%d\\n",ans);')},
]
EDITORIAL='''## 题意

循环移位：把一个十进制数末尾的若干位（可以是0位）移到最前面，其余数字依次后移。统计下标对i<j，使a[i]与a[j]位数相同且a[i]等于a[j]的某个循环移位。

## 思路

同长度的两个数字串互为循环移位，当且仅当它们的“最小表示”（所有旋转中字典序最小的那个）相同；循环移位关系是等价关系。于是对每个数取其数字串的最小旋转作为键（键的长度就是位数，自动保证位数相同），用哈希表计数，每个新数与此前同键的数都构成一对。

## 正确性

旋转的复合仍是旋转，所以“互为循环移位”是等价关系，同一等价类有唯一的最小旋转。a[i]的数字串没有前导零，若某个旋转以0开头，它不可能等于另一个正整数的数字串，用字符串比较即可正确处理（例如4560与456位数不同，5604与4560是同一类）。

## 复杂度

每个数最多10位，O(n·D²)，D≤10。答案最多约n²/2，使用64位整数。

## 独立验证

oracle对每对i<j直接检查位数相同且str(a[i])出现在str(a[j])+str(a[j])中（O(n²)，仅小数据），不使用最小表示。穷举由{1,10,11,12,21,101,110,2}组成的长度1..4全部数组并逐个真实运行参考程序。错误解覆盖用数字排序代替旋转、只看相等、去掉0后比较和32位计数。
'''
def encode(a):
 assert 1<=len(a)<=N and all(1<=x<=V for x in a)
 return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def oracle(a):
 s=list(map(str,a))
 return sum(1 for i in range(len(s)) for j in range(i+1,len(s)) if len(s[i])==len(s[j]) and s[i] in s[j]*2)
def canon(a):
 from collections import Counter
 c=Counter(min(t[k:]+t[:k] for k in range(len(t))) for t in map(str,a))
 return sum(v*(v-1)//2 for v in c.values())
def main():
 rng=random.Random(SEED)
 ex=[13,5604,31,2,13,4560,546,654,456]
 assert oracle(ex)==5==canon(ex)
 small=[ex,[1],[1,1],[10,1],[100,10,1],[101,110,11],[1212,2121,1221],[V,1],[123,231,312,132],[7,7,7]]
 keys={encode(a) for a in small}
 pool=[12,21,102,120,201,210,1001,1010,1100,11,111,5,50,505,550]
 while len(small)<170:
  a=[rng.choice(pool) if rng.random()<0.7 else rng.randint(1,rng.choice([100,V])) for _ in range(rng.randint(1,12))]
  if encode(a) not in keys:keys.add(encode(a));small.append(a)
 for a in small:assert oracle(a)==canon(a)
 oracles=[{'input':encode(a),'expectedOutput':f'{oracle(a)}\n'} for a in small]
 cases=[]
 def add(nm,a,hidden=True,f=oracle,closed=None):
  e=f(a)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(a),f'{e}\n',hidden))
 add('样例1',ex,False,closed=5);add('位数不同不算',[10,1,100,10],False,closed=1);add('三个互为循环移位',[123,231,312],False,closed=3)
 used={c['input'] for c in cases};rest=[a for a in small if encode(a) not in used]
 for i,a in enumerate(rest[:26]):add(f'小规模{i+1}',a)
 def big(nm,a,closed=None):add(nm,a,f=canon,closed=closed)
 big('满规模全相同',[123456789]*N,closed=N*(N-1)//2)
 big('满规模九位旋转类',[int(str(123456789)[k:]+str(123456789)[:k]) for k in range(9)]*(N//9)+[1]*(N%9))
 big('满规模随机大数',[rng.randint(1,V) for _ in range(N)])
 big('满规模含零旋转',[rng.choice([1000000000,100000000,10000000,1000000,100000,10000,1000,100,10,1,100000001,100000010,110000000]) for _ in range(N)])
 big('满规模周期数字',[rng.choice([121212,212121,112112,121121,211211,123123,231231]) for _ in range(N)])
 big('满规模数字排列非旋转',[rng.choice([123,132,213,231,312,321]) for _ in range(N)])
 big('满规模随机小数',[rng.randint(1,999) for _ in range(N)])
 def exhaustive(run):
  c=0;vals=[1,10,11,12,21,101,110,2]
  for n in range(1,5):
   for a in product(vals,repeat=n):
    e=oracle(list(a));assert e==canon(list(a));assert run(encode(list(a))).split()==[str(e)];c+=1
  return c,{'nMin':1,'nMax':4,'values':vals}
 P=problem(PID,'Roblox OA #14：循环移位数对','中等',['哈希表','字符串','最小表示'],
  '循环移位是指：把一个数（十进制）末尾的若干位数字移到最前面，其余数字按原顺序依次后移。对两个位数相同的整数a和b，如果a经过循环移位（移动0位或更多位）可以变成b，就称a与b构成循环对。\n\n给定正整数数组a，统计满足0≤i<j<n、a[i]与a[j]位数相同并且a[i]等于a[j]的某个循环移位的下标对(i,j)的个数。',
  '第一行n；第二行n个正整数a[0..n−1]。1≤n≤100000，1≤a[i]≤10^9。',
  '输出一个整数，表示循环对的个数。',
  '样例1：a=[13,5604,31,2,13,4560,546,654,456]，循环对为(0,2)、(0,4)、(2,4)（13与31）、(1,5)（5604与4560）、(6,7)（546与654），共5对。546只能与546、465、654配对，所以与456不构成循环对；4560与456位数不同。\n样例2：[10,1,100,10]只有两个10构成一对。\n样例3：123、231、312两两互为循环移位，共3对。',
  ['循环移位关系是等价关系。','取数字串所有旋转中字典序最小的一个作为代表。','用哈希表统计每个代表出现的次数。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'最小旋转表示计数','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent O(n^2) pair check with equal length and doubled-string containment; Python Counter over minimal rotations for formal large cases; exhaustive arrays over a digit-rotation-rich value set.',
  'imageProvenance':IMAGE_PROVENANCE+' original-1 (FastPrep rendering containing the full original "Cyclic Shift Pairs" text, rule, counting convention i<j and the example) is the only evidence used. original-0 is a different CodeSignal problem (suffix pairs over string words) and is bound here only because it is listed for this page; it is not used.',
  'rangeDisclosure':'Source images give no constraints. Chosen: 1<=n<=1e5, 1<=a[i]<=1e9; answer reported as exact 64-bit (can exceed 32-bit at this n). Stdin: n then n integers.',
  'corrections':['Upstream md and image explanation list (0,4) twice and omit (0,2); the real pairs are (0,2),(0,4),(2,4),(1,5),(6,7). Output 5 unchanged.','Image original-0 belongs to another problem and is ignored.','Second and third public examples are authored.'],
  'reason':'原图2完整给出循环移位定义与i<j计数口径（原图1是另一道后缀对题，已排除）；样例解释重复项为笔误，输出5与规则一致；原图无约束，自选n≤1e5、a≤1e9；最小旋转计数，独立两两倍串检查核验。'})
if __name__=='__main__':main()
