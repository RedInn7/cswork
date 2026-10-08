#!/usr/bin/env python3
"""Uber #41 generate array from first letter and next word's last letter; rule recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys,string
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-uber-41';BATCH='uber-41-recovered';SEED=20261008041+1
PATH='fastprep/Uber/uber-generate-array.md'
N=100000;L=string.ascii_lowercase
REFERENCE=r'''#include <cstdio>
#include <string>
#include <vector>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<string>w(n);char buf[32];for(int i=0;i<n;i++){scanf("%31s",buf);w[i]=buf;}
string out;out.reserve(3*n);for(int i=0;i<n;i++){out+=w[i][0];out+=w[(i+1)%n].back();out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误最后一项用自身末字母','language':'cpp','code':REFERENCE.replace('w[(i+1)%n].back()','w[i+1<n?i+1:i].back()')},
 {'name':'错误最后一项不输出','language':'cpp','code':REFERENCE.replace('for(int i=0;i<n;i++){out+=w[i][0];','for(int i=0;i+1<n||(n==1&&i==0);i++){out+=w[i][0];')},
 {'name':'错误取下一个词的首字母','language':'cpp','code':REFERENCE.replace('w[(i+1)%n].back()','w[(i+1)%n][0]')},
 {'name':'错误两个字母顺序颠倒','language':'cpp','code':REFERENCE.replace('out+=w[i][0];out+=w[(i+1)%n].back();','out+=w[(i+1)%n].back();out+=w[i][0];')},
]
EDITORIAL='''## 题意

对长度为n的字符串数组words，输出同样长度的数组：第i项由words[i]的首字母和下一个词words[i+1]的末字母拼成；最后一项的“下一个词”回到words[0]。

## 思路

直接遍历，下一个词的下标取(i+1) mod n。

## 正确性

逐项按定义构造。样例最后一项"bt"中的t只可能来自"cat"的末字母，说明最后一项环绕到第一个词；n=1时下一个词就是它自己。

## 复杂度

O(n)。

## 独立验证

oracle用Python把words向左旋转一位后与原数组逐项配对生成，不使用取模下标。穷举由3个候选词组成的长度1..5的全部数组并逐个真实运行参考程序。错误解覆盖不环绕、漏最后一项、取下一个词首字母和两个字母顺序颠倒。
'''
def encode(w):
 assert 1<=len(w)<=N and all(1<=len(x)<=20 and set(x)<=set(L) for x in w)
 return f'{len(w)}\n'+' '.join(w)+'\n'
def oracle(w):return ''.join(a[0]+b[-1]+'\n' for a,b in zip(w,w[1:]+w[:1]))
def main():
 rng=random.Random(SEED)
 small=[['cat','dog','flower','bed'],['a'],['ab'],['ab','cd'],['x','y','z'],['aa','bb','aa'],['hello','world']]
 keys={encode(w) for w in small}
 def word():return ''.join(rng.choice(L) for _ in range(rng.randint(1,rng.choice([1,3,20]))))
 while len(small)<170:
  w=[word() for _ in range(rng.randint(1,8))]
  if encode(w) not in keys:keys.add(encode(w));small.append(w)
 assert oracle(small[0])=='cg\ndr\nfd\nbt\n'
 oracles=[{'input':encode(w),'expectedOutput':oracle(w)} for w in small]
 cases=[]
 def add(nm,w,hidden=True):cases.append(case(nm,encode(w),oracle(w),hidden))
 add('样例1',small[0],False);add('单个单词',['ab'],False);add('两个单词',['ab','cd'],False)
 used={c['input'] for c in cases};rest=[w for w in small if encode(w) not in used]
 for i,w in enumerate(rest[:26]):add(f'小规模{i+1}',w)
 add('满规模单字母',[rng.choice(L) for _ in range(N)])
 add('满规模最长单词',[''.join(rng.choice(L) for _ in range(20)) for _ in range(N)])
 add('满规模随机长度',[word() for _ in range(N)])
 add('满规模相同单词',['abc']*N)
 add('满规模首尾不同',[c+'x'*5+d for c,d in zip((L*(N//26+1))[:N],(L[::-1]*(N//26+1))[:N])])
 add('满规模首个单词末字母特殊',['abcz']+['qwerty']*(N-1))
 def exhaustive(run):
  c=0
  for n in range(1,6):
   for w in product(['ab','c','xyz'],repeat=n):
    e=oracle(list(w));assert run(encode(list(w))).split()==e.split();c+=1
  return c,{'nMin':1,'nMax':5,'words':['ab','c','xyz']}
 P=problem(PID,'Uber OA #41：生成数组','简单',['字符串','数组'],
  '给定字符串数组words，返回同样长度的数组：第i项由words[i]的首字母与下一个单词words[i+1]的末字母拼接而成。最后一项的下一个单词是words[0]。',
  '第一行n；第二行n个单词，空格分隔。1≤n≤100000，每个单词长度1..20，只含小写英文字母。',
  '输出n行，第i行为结果数组的第i项。',
  '样例1：words=["cat","dog","flower","bed"]，结果为cg（c+dog的g）、dr（d+flower的r）、fd（f+bed的d）、bt（b+cat的t）。\n样例2：只有一个单词ab时，下一个单词就是它自己，结果为ab。\n样例3：["ab","cd"]得到ad和cb。',
  ['第i项的下一个单词下标为(i+1) mod n。','注意最后一项要回到第一个单词。'],outputLimit=4096)
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'循环取下一个单词的末字母','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent zip with a one-step left rotation of the word list; exhaustive arrays of length 1..5 over three candidate words.',
  'imageProvenance':IMAGE_PROVENANCE+' Interview-report text screenshot with the rule and one example.',
  'rangeDisclosure':'Source image gives no constraints. Chosen: 1<=n<=1e5, word length 1..20, lowercase letters. Wrap-around for the last element is not stated in words but uniquely fixed by the example ("bt": t can only be the last letter of "cat"); n=1 follows the same (i+1) mod n rule. Stdin: n then n words.',
  'corrections':['Upstream md statement truncated; rule supplied by the image. Sample output unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出首字母+下一个单词末字母的规则，样例bt唯一确定最后一项环绕到第一个单词；原图无约束，自选n≤1e5、单词长≤20；逐项构造，独立旋转配对与穷举核验。'})
if __name__=='__main__':main()
