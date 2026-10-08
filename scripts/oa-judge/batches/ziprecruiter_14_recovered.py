#!/usr/bin/env python3
"""ZipRecruiter #14 triplets with unique characters, full statement recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys,string
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-ziprecruiter-14';BATCH='ziprecruiter-14-recovered';SEED=20261008114
PATH='fastprep/ZipRecruiter/ziprecruiter-triplets-with-unique-chars.md'
L=string.ascii_lowercase
REFERENCE=r'''#include <cstdio>
#include <cstring>
int main(){static char s[2048];if(scanf("%2047s",s)!=1)return 0;int n=strlen(s),c=0;
for(int i=0;i+2<n;i++)if(s[i]!=s[i+1]&&s[i]!=s[i+2]&&s[i+1]!=s[i+2])c++;printf("%d\n",c);}
'''
MUTANTS=[
 {'name':'错误只比较相邻两对','language':'cpp','code':REFERENCE.replace('&&s[i]!=s[i+2]','')},
 {'name':'错误按不同三元组字符串去重计数','language':'cpp','code':r'''#include <cstdio>
#include <cstring>
#include <set>
#include <string>
int main(){static char s[2048];scanf("%2047s",s);int n=strlen(s);std::set<std::string>t;
for(int i=0;i+2<n;i++)if(s[i]!=s[i+1]&&s[i]!=s[i+2]&&s[i+1]!=s[i+2])t.insert(std::string(s+i,3));printf("%d\n",(int)t.size());}
'''},
 {'name':'错误漏掉最后一个三元组','language':'cpp','code':REFERENCE.replace('i+2<n','i+3<n')},
 {'name':'错误统计三字符全相同的反面','language':'cpp','code':REFERENCE.replace('if(s[i]!=s[i+1]&&s[i]!=s[i+2]&&s[i+1]!=s[i+2])','if(!(s[i]==s[i+1]&&s[i+1]==s[i+2]))')},
]
EDITORIAL='''## 题意

统计下标i的个数，使s[i]、s[i+1]、s[i+2]两两不同。长度小于3时答案为0。

## 思路

滑动长度为3的窗口，逐个检查三对字符是否都不相等。

## 正确性

每个合法下标恰对应一个窗口，三对比较等价于“两两不同”。只比较相邻两对会把aba这类首尾相同的窗口算进去，按不同子串去重会少算重复出现的窗口。

## 复杂度

O(n)。

## 独立验证

oracle用len(set(s[i:i+3]))==3判断，与逐对比较不同。穷举字母表{a,b,c}上长度1..7的全部字符串并逐个真实运行参考程序；正式用例覆盖原样例、长度1和2、全同、周期abc、周期aba、随机满长等。错误解覆盖漏比首尾、按子串去重、漏最后一个窗口和只排除三字符全同。
'''
def encode(s):
 assert 1<=len(s)<=1000 and set(s)<=set(L)
 return s+'\n'
def oracle(s):return sum(len(set(s[i:i+3]))==3 for i in range(len(s)-2))
def pairwise(s):return sum(1 for i in range(len(s)-2) if s[i]!=s[i+1] and s[i]!=s[i+2] and s[i+1]!=s[i+2])
def main():
 rng=random.Random(SEED)
 small=['abcdaaae','abacaba','abc','a','ab','aaa','aba','abcabc','zyxzyx','aabbcc','abab','qwertyuiop','abca']
 keys={encode(s) for s in small}
 while len(small)<175:
  s=''.join(rng.choice(L[:rng.choice([2,3,4,26])]) for _ in range(rng.randint(1,20)))
  if encode(s) not in keys:keys.add(encode(s));small.append(s)
 for s in small:assert oracle(s)==pairwise(s)
 oracles=[{'input':encode(s),'expectedOutput':f'{oracle(s)}\n'} for s in small]
 cases=[]
 def add(nm,s,hidden=True,closed=None):
  e=oracle(s)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(s),f'{e}\n',hidden))
 add('样例1',small[0],False,3);add('样例2',small[1],False,2);add('恰好一个三元组','xyz',False,1)
 for i,s in enumerate(small[3:28]):add(f'小规模{i+1}',s)
 add('满长全同','a'*1000,closed=0)
 add('满长周期abc',('abc'*334)[:1000],closed=998)
 add('满长周期aba',('ab'*500),closed=0)
 add('满长二十六字母循环',(L*39)[:1000],closed=998)
 add('满长随机三字母',''.join(rng.choice('abc') for _ in range(1000)))
 add('满长随机全字母',''.join(rng.choice(L) for _ in range(1000)))
 add('满长成对重复',''.join(c*2 for c in (L*20)[:500]),closed=0)
 add('满长abca周期',('abca'*250),)
 def exhaustive(run):
  c=0
  for n in range(1,8):
   for t in product('abc',repeat=n):
    s=''.join(t);e=pairwise(s);assert e==oracle(s);assert run(encode(s)).split()==[str(e)];c+=1
  return c,{'lengthMin':1,'lengthMax':7,'alphabet':'abc'}
 P=problem(PID,'ZipRecruiter OA #14：字符互不相同的连续三元组','简单',['字符串','滑动窗口'],
  '给定只含小写英文字母的字符串s，统计s中由互不相同字符组成的连续三元组个数。换言之，统计满足s[i]、s[i+1]、s[i+2]两两不同的下标i的个数。',
  '一行字符串s。1≤s的长度≤1000，只含小写英文字母。',
  '输出一个整数。',
  '样例1：s="abcdaaae"，i=0（abc）、i=1（bcd）、i=2（cda）满足；i=3（daa）中s[4]与s[5]相同，之后的三元组也都含重复字符，答案3。\n样例2：s="abacaba"，只有i=1（bac）和i=3（cab）满足，其他三元组都含两个a，答案2。\n样例3：s="xyz"只有一个三元组且满足，答案1。',
  ['只需检查每个长度为3的窗口。','三个字符两两不同需要比较三对，别漏掉首尾两个字符。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'长度为3的滑动窗口','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满长',
  'oracleMethod':'Independent set-size test on each 3-slice; explicit pairwise comparison cross-check; exhaustive strings over {a,b,c} of length 1..7; closed forms for periodic strings.',
  'imageProvenance':IMAGE_PROVENANCE+' Phone photo of the CodeSignal statement with both worked examples and the guaranteed constraint 1<=s.length<=1000.',
  'rangeDisclosure':'Full original bound preserved: 1<=|s|<=1000, lowercase letters. Stdin: one line s.',
  'corrections':['Upstream md starter signature tripletsWithUniqueChars(int[][] grid) does not match the image input string s; string input used.','Third public example is authored.'],
  'reason':'原图补全了截断的题面、两个样例的逐项解释和约束；窗口逐对比较，独立集合大小判定与穷举核验。'})
if __name__=='__main__':main()
