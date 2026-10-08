#!/usr/bin/env python3
"""Largest square under a skyline: monotonic-stack reference versus binary-search-on-side oracle."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-plaid-4';BATCH='plaid-4-recovered';SEED=20261205
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='web/content/docs/companies/plaid.mdx'
RAW_SHA='bb53b53407bfc264cf9a84e4a321debe4e32046e87c95b529348e628dac334ea'
BLOB='9a7830ed91760587f401c8a8f1fbfd79fa6ecc59'
HASH='34e4c8f5e0d8aa42f5f0a54dcf548555fc9f693651775e9ba9672d7088634622'
MAXN=3000000;HI=100000000
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
static char buf[1<<16];static size_t len=0,pos=0;
static int gc(){if(pos==len){len=fread(buf,1,sizeof buf,stdin);pos=0;if(!len)return -1;}return buf[pos++];}
static long long rd(){int c=gc();while(c<'0'||c>'9')c=gc();long long x=0;while(c>='0'&&c<='9'){x=x*10+(c-'0');c=gc();}return x;}
int main(){int n=(int)rd();vector<long long> h(n);for(auto &x:h)x=rd();
vector<int> left(n),st;st.reserve(n);
for(int i=0;i<n;i++){while(!st.empty()&&h[st.back()]>=h[i])st.pop_back();left[i]=st.empty()?-1:st.back();st.push_back(i);}
st.clear();long long best=0;
for(int i=n-1;i>=0;i--){while(!st.empty()&&h[st.back()]>=h[i])st.pop_back();int right=st.empty()?n:st.back();st.push_back(i);
long long side=min<long long>(h[i],right-left[i]-1);best=max(best,side);}
printf("%lld\n",best*best);}
'''
MUTANTS=[
 {'name':'错误面积用32位整数相乘','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",best*best);','int s=(int)best;printf("%d\\n",s*s);')},
 {'name':'错误求最大矩形面积','language':'cpp','code':REFERENCE.replace('long long side=min<long long>(h[i],right-left[i]-1);best=max(best,side);','best=max(best,h[i]*(right-left[i]-1));').replace('printf("%lld\\n",best*best);','printf("%lld\\n",best);')},
 {'name':'错误边长只受单柱高度和总宽限制','language':'cpp','code':REFERENCE.replace('long long side=min<long long>(h[i],right-left[i]-1);','long long side=min<long long>(h[i],n);')},
 {'name':'错误输出边长而非面积','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",best*best);','printf("%lld\\n",best);')},
]
for m in MUTANTS:assert m['code']!=REFERENCE,m['name']
EDITORIAL='''## 题意

n栋宽为1的楼房紧挨着排成一行，第i栋高cityLine[i]，它们的外轮廓构成一个直方图。求能完整放进这个轮廓内部的最大正方形面积。

## 推导

轮廓内的正方形可以竖直下移到地面而不越界，所以只需考虑底边贴地、边与坐标轴平行的正方形。边长为s的正方形能放下，当且仅当存在一段连续楼房，宽度≥s且每栋高度≥s。对一段连续楼房[l,r]，能放下的最大边长是min(r−l+1, min h[l..r])。由于宽度和高度都是整数，最优边长是整数，答案为边长的平方。

## 算法

在最优段中取高度最小的楼房i。把以i为最低楼房的段向两侧扩展到第一栋比它矮的楼房为止，宽度只会变大、最小高度不变，因此只需对每个i考虑“以h[i]为最小高度的极大段”，候选边长为min(h[i], 该段宽度)。用单调栈分别求出每栋楼左侧和右侧第一栋更矮楼房的位置即可，答案取所有候选的最大值再平方。

## 正确性

任一可放下边长s的段，其最低楼房i的极大段包含它，故h[i]≥s且极大段宽度≥s，候选值≥s。反过来每个候选值都对应一个真实可放下的正方形。因此最大候选值就是最大边长。

## 数值范围

边长可达min(n,10^8)=3×10^6，面积约9×10^12，必须用64位整数。

## 复杂度

单调栈每个下标进出栈各一次，O(n)时间、O(n)空间。

## 独立验证

oracle对边长二分：边长s可行当且仅当存在长度≥s、高度都≥s的连续段，线性扫描判定，不使用单调栈；小域另枚举所有连续段取min(宽度,最小高度)。穷举n=1..6、高度1..4的全部输入并逐个真实运行参考程序。正式用例覆盖原样例、全最大高度、全为1、递增/递减阶梯、单高塔、随机大值等。四个正常退出的错误程序（32位面积、求最大矩形、忽略段宽、输出边长）在正式用例上各自被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(a):
 assert 1<=len(a)<=MAXN and all(1<=v<=HI for v in a)
 return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def bsearch(a):
 def can(s):
  run=0
  for h in a:
   if h>=s:
    run+=1
    if run>=s:return True
   else:run=0
  return False
 lo,hi=1,min(len(a),max(a))
 while lo<hi:
  mid=(lo+hi+1)//2
  if can(mid):lo=mid
  else:hi=mid-1
 return lo*lo
def brute(a):
 best=0
 for i in range(len(a)):
  m=HI+1
  for j in range(i,len(a)):m=min(m,a[j]);best=max(best,min(j-i+1,m))
 return best*best
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 assert '## 4. Largest Square in Skyscraper Outline' in raw.decode()
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 assert bsearch([3,1,3,2,1])==4 and bsearch([4,3,4])==9
 small=[[3,1,3,2,1],[4,3,4],[1,5,5,5,5,5,1],[1],[HI],[HI,HI],[1,1,1,1],[2,2],[3,3,2],[5,1,5,1,5],[1,2,3,4,5,6],[6,5,4,3,2,1],[2,3,3,2,3,3,3],[HI]*7,[7,7,7,7,7,7,7]]
 rng=random.Random(SEED);keys={encode(a) for a in small};assert len(keys)==len(small)
 while len(small)<180:
  n=rng.randint(1,30);top=rng.choice([3,8,30,HI]);a=[rng.randint(1,top) for _ in range(n)];key=encode(a)
  if key not in keys:keys.add(key);small.append(a)
 for a in small:assert bsearch(a)==brute(a)
 oracles=[{'input':encode(a),'expectedOutput':f'{bsearch(a)}\n'} for a in small]
 cases=[];large=[]
 def add(name,a,hidden=True,closed=None):
  e=bsearch(a)
  if closed is not None:assert e==closed,(name,e,closed)
  cases.append({'name':name,'input':encode(a),'expectedOutput':f'{e}\n','hidden':hidden,'weight':1})
 names=['原样例1','原样例2','本站补充：中间平台']
 for i,a in enumerate(small[:3]):add(names[i],a,i>=3)
 for i,a in enumerate(small[3:31]):add(f'小规模{i+1}',a)
 add('三百万全最大高度',[HI]*MAXN,closed=MAXN*MAXN)
 add('三百万全为1',[1]*MAXN,closed=1)
 add('三百万递增阶梯',list(range(1,MAXN+1)),closed=(MAXN//2)**2)
 add('三百万随机大高度',[rng.randint(1,HI) for _ in range(MAXN)])
 a=[1]*1000000;a[500000]=HI
 add('百万单高塔',a,closed=1);a=None
 a=[rng.randint(1,2000) for _ in range(1000000)];a[300000:304000]=[5000]*4000
 add('百万随机小高度含宽平台',a,closed=4000*4000);a=None
 assert len({c['input'] for c in cases})==len(cases)
 print(f'Plaid4 prepared {len(cases)} formal, {len(oracles)} oracle; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='plaid4-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(1,7):
   for a in product(range(1,5),repeat=n):
    e=brute(list(a));assert e==bsearch(list(a));assert execute(binary,encode(list(a)))[0]==str(e);exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput'].strip()
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'].strip(),case['name']
   if len(case['input'])>=100000:large.append({'name':case['name'],'n':int(case['input'].split()[0]),'inputBytes':len(case['input']),'expectedOutput':case['expectedOutput'].strip(),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput'].strip():rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Plaid OA #4：Largest Square in Skyscraper Outline','difficulty':'中等','tags':['单调栈','二分答案','数组'],
 'description':'城市里有一排摩天大楼，第i栋的高度为cityLine[i]，每栋宽度为1，相邻楼房之间没有空隙。求能完整放进这排楼房外轮廓内部的最大正方形的面积。',
 'input':'第一行n。第二行n个整数cityLine[0..n-1]，空白分隔。1≤n≤3×10^6，1≤cityLine[i]≤10^8。',
 'output':'输出一个整数：最大正方形的面积。答案可能超过32位整数范围。',
 'explanation':'样例1：[3,1,3,2,1]中第3、4栋高3和2，可放下边长2的正方形，面积4。样例2：[4,3,4]三栋都至少高3，可放下边长3的正方形，面积9。样例3：中间五栋高5，可放下边长5的正方形，面积25。',
 'hints':['正方形可以下移到贴地。','边长s可行等价于存在长度至少s、高度都至少s的连续段。','可以二分边长，也可以用单调栈对每栋楼求以它为最低楼的最大宽度。'],
 'timeLimit':4,'memoryLimit':262144,'outputLimit':1024,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 payload=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False);ncases=len(cases);total_case_bytes=sum(len(c['input'])+len(c['expectedOutput']) for c in cases);cases=None
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=payload,text=True,capture_output=True,check=True).stdout;payload=None
 assert len(normalized.encode())<128*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'以最低楼为中心的单调栈','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'section':'## 4. Largest Square in Skyscraper Outline','gitBlobSha':BLOB,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,
  'rangeDisclosure':'Original constraints: 1<=cityLine.length<=10^8, 1<=cityLine[i]<=10^8. 10^8 heights cannot fit the 32MiB per-case input / 128MiB package budgets, so the length is capped at 3*10^6 (each height at most 9 digits plus a separator, about 30MB per maximal input). Height domain 1..10^8 unchanged. Area can reach 9*10^12, so 64-bit output is stated.',
  'corrections':['None to the two original examples. Third public example is authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'最大正方形规则与两例一致；按用户指定范围政策把长度上限从10^8收到3×10^6，高度值域不变（原范围记录在source evidence）；单调栈参考解与二分边长oracle、全段枚举穷举核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':ncases-3,'referenceFormalCases':ncases,'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Independent binary search on side length with linear run check; all-segment min(width,min height) brute force on oracle inputs and exhaustive small domain; closed forms on structured large cases.','exhaustiveSmallDomain':{'cases':exhaustive,'nMin':1,'nMax':6,'heights':[1,2,3,4]},'largeBoundaries':large,'caseBytes':total_case_bytes,'packageBytes':len(normalized.encode()),'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Plaid4 frozen: {ncases} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
