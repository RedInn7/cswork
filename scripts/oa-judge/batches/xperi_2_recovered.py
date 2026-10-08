#!/usr/bin/env python3
"""Xperi #2 make numbers equal by repeated subtraction; operation recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-xperi-2';BATCH='xperi-2-recovered';SEED=20261008302
PATH='fastprep/Xperi/xperi-make-numbers-equal.md'
V=10**18
REFERENCE=r'''#include <cstdio>
int main(){unsigned long long a,b;if(scanf("%llu %llu",&a,&b)!=2)return 0;unsigned long long cost=0;
while(a!=b){if(a<b){unsigned long long t=a;a=b;b=t;}unsigned long long q=a/b,r=a%b;if(r==0){cost+=q-1;a=b;}else{cost+=q;a=r;}}
printf("%llu\n",cost);}
'''
MUTANTS=[
 {'name':'错误整除时多算一次','language':'cpp','code':REFERENCE.replace('if(r==0){cost+=q-1;a=b;}','if(r==0){cost+=q;a=b;}')},
 {'name':'错误按辗转相除步数计数','language':'cpp','code':REFERENCE.replace('if(r==0){cost+=q-1;a=b;}else{cost+=q;a=r;}','if(r==0){cost+=1;a=b;}else{cost+=1;a=r;}')},
 {'name':'错误32位读入','language':'cpp','code':r'''#include <cstdio>
int main(){unsigned a,b;scanf("%u %u",&a,&b);unsigned long long cost=0;if(!a)a=1;if(!b)b=1;
while(a!=b){if(a<b){unsigned t=a;a=b;b=t;}unsigned q=a/b,r=a%b;if(r==0){cost+=q-1;a=b;}else{cost+=q;a=r;}}
printf("%llu\n",cost);}
'''},
 {'name':'错误按A/g+B/g-2计算','language':'cpp','code':r'''#include <cstdio>
int main(){unsigned long long a,b;scanf("%llu %llu",&a,&b);unsigned long long x=a,y=b;while(y){unsigned long long t=x%y;x=y;y=t;}printf("%llu\n",a/x+b/x-2);}
'''},
]
EDITORIAL='''## 题意

两个正整数A、B。每次操作：若A>B则A=A−B；若B>A则B=B−A；每次代价1。求使A=B的总代价。

## 思路

操作是确定的，就是“减法版辗转相除”。A,B可达10^18，逐次相减会太慢，要把连续对同一个数的减法合并：设a≥b，若a mod b=r≠0，则连续做a div b次减法后得到(r,b)；若r=0，则只需做a/b−1次就得到(b,b)停止。重复直到相等。

## 正确性

当a≥b且a>b时，每次操作都是从a中减去b，直到a<b或a=b为止，合并后的次数正好是商（整除时少一次，因为减到a=b就停了）。之后两数角色互换，与辗转相除完全一致，所以总步数O(log)。

## 复杂度

O(log min(A,B))。答案可达10^18−1，用64位无符号整数。

## 独立验证

oracle逐次模拟减法（只用于不超过10^4的小数据），不做商的合并；大数据用Python递归按商求和另算。穷举A,B∈[1,40]的全部组合并逐个真实运行参考程序。错误解覆盖整除时多算一次、只数辗转相除步数、32位读入和误用A/g+B/g−2公式。
'''
def encode(a,b):
 assert 1<=a<=V and 1<=b<=V
 return f'{a} {b}\n'
def oracle(a,b):
 c=0
 while a!=b:
  if a>b:a-=b
  else:b-=a
  c+=1
 return c
def fast(a,b):
 c=0
 while a!=b:
  if a<b:a,b=b,a
  q,r=divmod(a,b)
  if r==0:c+=q-1;a=b
  else:c+=q;a=r
 return c
def main():
 rng=random.Random(SEED)
 small=[(7,9),(1,1),(5,5),(1,2),(2,1),(10,1),(1,10),(6,4),(13,8),(100,99)]
 keys={encode(*t) for t in small}
 while len(small)<170:
  t=(rng.randint(1,rng.choice([20,1000,10000])),rng.randint(1,rng.choice([20,1000,10000])))
  if encode(*t) not in keys:keys.add(encode(*t));small.append(t)
 for t in small:assert oracle(*t)==fast(*t)
 oracles=[{'input':encode(*t),'expectedOutput':f'{oracle(*t)}\n'} for t in small]
 cases=[]
 def add(nm,t,hidden=True,f=oracle,closed=None):
  e=f(*t)
  if closed is not None:assert e==closed,(nm,e)
  cases.append(case(nm,encode(*t),f'{e}\n',hidden))
 add('样例1',(7,9),False,closed=5);add('初始相等',(4,4),False,closed=0);add('整除',(12,3),False,closed=3)
 used={c['input'] for c in cases};rest=[t for t in small if encode(*t) not in used]
 for i,t in enumerate(rest[:20]):add(f'小规模{i+1}',t)
 def big(nm,t,closed=None):add(nm,t,f=fast,closed=closed)
 big('大数一与上界',(V,1),closed=V-1)
 big('大数上界与一',(1,V),closed=V-1)
 big('大数相邻斐波那契',(679891637638612258,420196140727489673))
 big('大数相等',(V,V),closed=0)
 big('大数上界与上界减一',(V,V-1),closed=V-1)
 big('大数整除',(V,10**9),closed=10**9-1)
 big('大数随机一',(rng.randint(1,V),rng.randint(1,V)))
 big('大数随机二',(rng.randint(1,V),rng.randint(1,10**6)))
 big('大数随机三',(rng.randint(1,10**9),rng.randint(1,V)))
 big('大数公因子',(2**59,3*2**57))
 big('大数超过32位小差',(2**33+1,2**33))
 big('大数二的幂',(2**59,2))
 def exhaustive(run):
  c=0
  for a in range(1,41):
   for b in range(1,41):
    e=oracle(a,b);assert e==fast(a,b);assert run(encode(a,b)).split()==[str(e)];c+=1
  return c,{'A':[1,40],'B':[1,40]}
 P=problem(PID,'Xperi OA #2：使两数相等','简单',['数学','辗转相除'],
  '有两个正整数A和B，要通过若干次操作使A与B相等。每次操作：如果A大于B，则A=A−B；如果B大于A，则B=B−A。每次操作的代价为1。求使A等于B的总代价。',
  '一行两个空格分隔的整数A和B。1≤A,B≤10^18。',
  '输出一个整数，表示总代价。',
  '样例1：A=7，B=9。B=9−7=2，A=7−2=5，A=5−2=3，A=3−2=1，B=2−1=1，共5次。\n样例2：A与B初始相等，代价0。\n样例3：12→9→6→3，共3次。',
  ['操作是确定的，只需计算次数。','对同一个数的连续减法可以用除法一次算完。','整除时最后一次减到相等就停止，比商少一次。'])
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'减法辗转相除的商合并','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'大数',
  'oracleMethod':'Independent literal one-subtraction-at-a-time simulation for values up to 1e4; Python quotient-merging loop for 1e18-scale formal cases; exhaustive A,B in 1..40.',
  'imageProvenance':IMAGE_PROVENANCE+' Text screenshot with the operation, cost, stdin/stdout format and the worked sample.',
  'rangeDisclosure':'Source image gives no constraints; values must be positive (zero would never terminate). Chosen: 1<=A,B<=1e18, single test per input as in the original stdin format. Answer can reach 1e18-1 (unsigned/signed 64-bit).',
  'corrections':['Upstream md statement truncated; operation supplied by the image. Output 5 unchanged.','Second and third public examples are authored.'],
  'reason':'原图给出确定性的相减操作与输入输出格式；原图无约束且0会死循环，自选正整数A、B≤1e18；按商合并的辗转相除，独立逐次相减模拟与穷举核验。'})
if __name__=='__main__':main()
