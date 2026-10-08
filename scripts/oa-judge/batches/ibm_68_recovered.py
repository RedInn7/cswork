#!/usr/bin/env python3
"""IBM #68 service timeout detection; consecutive-gap rule, ordering and second sample recovered from the source image."""
from pathlib import Path
from itertools import product
import random,sys,string
sys.path.insert(0,str(Path(__file__).resolve().parent))
from b2_recovered_common import freeze,case,problem,IMAGE_PROVENANCE
PID='oa-ibm-68';BATCH='ibm-68-recovered';SEED=20261008068
PATH='fastprep/IBM/ibm-service-timeout-detection.md'
N=200000;T=10**9;CH=string.ascii_lowercase+string.digits
REFERENCE=r'''#include <cstdio>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;long long th;if(scanf("%d %lld",&n,&th)!=2)return 0;vector<pair<string,long long>>a(n);char buf[32];
for(int i=0;i<n;i++){long long t;scanf("%lld %31s",&t,buf);a[i]={buf,t};}
sort(a.begin(),a.end());vector<string>res;
for(int i=1;i<n;i++)if(a[i].first==a[i-1].first&&a[i].second-a[i-1].second>th&&(res.empty()||res.back()!=a[i].first))res.push_back(a[i].first);
string out=to_string(res.size())+"\n";for(auto&s:res){out+=s;out+='\n';}fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误用首尾跨度代替相邻间隔','language':'cpp','code':REFERENCE.replace('for(int i=1;i<n;i++)if(a[i].first==a[i-1].first&&a[i].second-a[i-1].second>th&&(res.empty()||res.back()!=a[i].first))res.push_back(a[i].first);','for(int i=0,j;i<n;i=j){j=i;while(j<n&&a[j].first==a[i].first)j++;if(a[j-1].second-a[i].second>th)res.push_back(a[i].first);}')},
 {'name':'错误间隔等于阈值也算超时','language':'cpp','code':REFERENCE.replace('>th&&','>=th&&')},
 {'name':'错误不按时间排序直接比较输入中相邻心跳','language':'cpp','code':REFERENCE.replace('sort(a.begin(),a.end());','stable_sort(a.begin(),a.end(),[](const pair<string,long long>&x,const pair<string,long long>&y){return x.first<y.first;});').replace('a[i].second-a[i-1].second>th','(a[i].second>a[i-1].second?a[i].second-a[i-1].second:a[i-1].second-a[i].second)>th')},
 {'name':'错误按服务首次出现顺序输出','language':'cpp','code':r'''#include <cstdio>
#include <string>
#include <vector>
#include <map>
#include <algorithm>
using namespace std;
int main(){int n;long long th;scanf("%d %lld",&n,&th);map<string,vector<long long>>g;vector<string>order;char buf[32];
for(int i=0;i<n;i++){long long t;scanf("%lld %31s",&t,buf);if(!g.count(buf))order.push_back(buf);g[buf].push_back(t);}
vector<string>res;for(auto&s:order){auto&v=g[s];sort(v.begin(),v.end());for(size_t i=1;i<v.size();i++)if(v[i]-v[i-1]>th){res.push_back(s);break;}}
printf("%d\n",(int)res.size());for(auto&s:res)printf("%s\n",s.c_str());}
'''},
]
EDITORIAL='''## 题意

每条心跳有时间戳和服务ID。对每个服务把它的心跳按时间排序，只要某两次相邻心跳的间隔严格大于threshold，该服务就算超时过。按字典序输出所有超时过的服务ID。输入中的心跳没有按时间排序；只有一次心跳的服务不会超时。

## 思路

把(服务ID,时间戳)二元组整体排序，同一服务的心跳就连续且按时间递增。扫描相邻两条：属于同一服务且时间差大于threshold，就把该服务加入结果（同一服务只加一次）。排序后服务ID本身就是字典序，结果天然有序。

## 正确性

排序后同一服务的相邻记录恰是该服务按时间排序后的相邻心跳，判定条件与题意完全一致；相同时间戳的间隔为0，不会超过非负阈值。

## 复杂度

O(n log n·L)，L≤10为ID长度。

## 独立验证

oracle用字典按服务分组、组内排序后逐个检查相邻间隔，最后对结果排序，与参考的整体排序扫描不同。穷举2个服务、1..4条心跳、时间戳1..3、阈值0..2的全部组合并逐个真实运行参考程序。错误解覆盖用首尾跨度、间隔等于阈值也算、不按时间排序、按首次出现顺序输出。
'''
def encode(th,beats):
 assert 1<=len(beats)<=N and 0<=th<=T and all(1<=t<=T and 1<=len(s)<=10 and set(s)<=set(CH) for t,s in beats)
 return f'{len(beats)} {th}\n'+''.join(f'{t} {s}\n' for t,s in beats)
def oracle(th,beats):
 g={}
 for t,s in beats:g.setdefault(s,[]).append(t)
 res=sorted(s for s,v in g.items() if any(b-a>th for a,b in zip(sorted(v),sorted(v)[1:])))
 return f'{len(res)}\n'+''.join(x+'\n' for x in res)
def main():
 rng=random.Random(SEED)
 ex1=(30,[(10,'svc1'),(20,'svc1'),(80,'svc1'),(10,'svc2'),(65,'svc2')]);ex2=(1,[(1,'svc1'),(2,'svc2'),(3,'svc1')])
 assert oracle(*ex1)=='2\nsvc1\nsvc2\n' and oracle(*ex2)=='1\nsvc1\n'
 small=[ex1,ex2,(5,[(1,'a')]),(0,[(5,'a'),(5,'a')]),(0,[(5,'a'),(6,'a')]),(10,[(30,'x'),(1,'x'),(20,'x'),(11,'x')]),(3,[(1,'b'),(9,'a'),(5,'a'),(4,'b')]),(0,[(1,'z9'),(2,'z'),(3,'z9'),(4,'z')]),(T,[(1,'a'),(T,'a')]),(0,[(1,'a1'),(T,'a1')])]
 keys={encode(*t) for t in small}
 while len(small)<170:
  ids=list({''.join(rng.choice(CH) for _ in range(rng.randint(1,3))) for _ in range(rng.randint(1,4))})
  beats=[(rng.randint(1,rng.choice([10,100,T])),rng.choice(ids)) for _ in range(rng.randint(1,12))]
  t=(rng.randint(0,rng.choice([5,50,T])),beats);k=encode(*t)
  if k not in keys:keys.add(k);small.append(t)
 oracles=[{'input':encode(*t),'expectedOutput':oracle(*t)} for t in small]
 cases=[]
 def add(nm,t,hidden=True):cases.append(case(nm,encode(*t),oracle(*t),hidden))
 add('样例1',ex1,False);add('样例2',ex2,False);add('无服务超时',(5,[(3,'b'),(1,'a'),(6,'b'),(4,'a')]),False)
 for i,t in enumerate(small[2:28]):add(f'小规模{i+1}',t)
 def uid(k,length=10):
  s=set()
  while len(s)<k:s.add(''.join(rng.choice(CH) for _ in range(rng.randint(1,length))))
  return sorted(s,key=lambda _:rng.random())
 U=uid(N)
 add('满规模每个服务一次心跳',(0,[(rng.randint(1,T),u) for u in U]))
 V=uid(N//2)
 b=[(rng.randint(1,T),v) for v in V for _ in range(2)];rng.shuffle(b)
 add('满规模每个服务两次随机',(T//2,b))
 one=[(i*5+1,'hot') for i in range(N)];rng.shuffle(one)
 add('满规模单服务间隔恰等于阈值',(5,one))
 one2=one[:-1]+[(N*5+100,'hot')];rng.shuffle(one2)
 add('满规模单服务末尾一处超时',(5,one2))
 W=uid(1000,4)
 add('满规模千个服务随机',(rng.randint(0,10**6),[(rng.randint(1,T),rng.choice(W)) for _ in range(N)]))
 add('满规模阈值为0含相同时间',(0,[(rng.randint(1,3),rng.choice(W[:50])) for _ in range(N)]))
 add('满规模阈值最大',(T,[(rng.randint(1,T),rng.choice(W)) for _ in range(N)]))
 def exhaustive(run):
  c=0
  for n in range(1,5):
   for beats in product([(t,s) for t in (1,2,3) for s in ('a','b')],repeat=n):
    for th in (0,1,2):
     e=oracle(th,list(beats));assert run(encode(th,list(beats))).split()==e.split();c+=1
  return c,{'beatsMin':1,'beatsMax':4,'timestamps':[1,2,3],'services':['a','b'],'thresholds':[0,1,2]}
 P=problem(PID,'IBM OA #68：服务超时检测','中等',['排序','哈希表','字符串'],
  '每条心跳记录包含一个时间戳和它所属的服务ID。对每个服务ID，把它的心跳按时间戳排序；如果其中任意两次相邻心跳的时间间隔严格大于threshold，就认为该服务至少超时过一次。只有一次心跳的服务不会超时。注意输入中的心跳没有按时间戳排序。\n\n求所有至少超时过一次的服务ID，按字典序升序输出。',
  '第一行两个整数n和threshold。随后n行，每行一个整数timestamp和一个字符串serviceId。1≤n≤200000，1≤timestamp≤10^9，0≤threshold≤10^9，serviceId长度1..10，只含小写字母和数字。',
  '第一行输出超时服务的个数k；随后k行按字典序升序各输出一个服务ID。',
  '样例1：svc1在20和80之间间隔60，svc2在10和65之间间隔55，都超过30，输出2个服务。\n样例2：svc1在1和3之间间隔2，超过1；svc2只有一次心跳，不超时，输出1个服务svc1。\n样例3：a的心跳1、4，b的心跳3、6，间隔都是3，不超过5，输出0。',
  ['先按服务分组，再在组内按时间排序。','判定看相邻两次心跳的间隔，并且是严格大于。','结果需要按字典序排序。'],outputLimit=4096)
 freeze({'pid':PID,'batch':BATCH,'seed':SEED,'path':PATH,'reference':REFERENCE,'lang':'cpp','mutants':MUTANTS,'editorial':EDITORIAL,'editorialTitle':'分组排序检查相邻间隔','problem':P,
  'oracles':oracles,'cases':cases,'exhaustive':exhaustive,'largePrefix':'满规模',
  'oracleMethod':'Independent dict grouping with per-service sort, adjacent-gap check and final sort; exhaustive over two services, up to four heartbeats, timestamps 1..3 and thresholds 0..2.',
  'imageProvenance':IMAGE_PROVENANCE+' Phone photo of the statement (top line cropped after "service ID it came from"), giving the consecutive-gap rule, lexicographic output, unsorted-input note, both examples and full constraints.',
  'rangeDisclosure':'Full original bounds preserved from the image: n 1..2e5, timestamp 1..1e9, serviceId length 1..10 over [a-z0-9], threshold 0..1e9. Stdin: "n threshold" then n lines "timestamp serviceId"; output count line then sorted IDs (makes the empty result explicit).',
  'corrections':['Upstream md lacks example 2 and serviceId length/charset constraints; both taken from the image. Example 1 output unchanged.','Third public example is authored.'],
  'reason':'原图给出相邻心跳间隔严格大于阈值、字典序输出、输入无序和单次心跳不超时（样例2）以及完整约束；分组排序扫描，独立字典分组与穷举核验。'})
if __name__=='__main__':main()
