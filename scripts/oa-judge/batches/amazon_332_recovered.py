#!/usr/bin/env python3
"""Reduce Memory Usage: total minus best length-m window; sliding reference versus prefix-sum oracle."""
from pathlib import Path
from itertools import accumulate, product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-amazon-332';BATCH='amazon-332-recovered';SEED=20261202
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='web/content/docs/companies/amazon.mdx'
RAW_SHA='07d33d58794347890f76b4199a9805d5fac529f0702dea6884e6fce484b69985'
BLOB='70650fad830ad60944ae8036fb4f134d9afc3fab'
FP_PATH='fastprep/Amazon/amazon-reduce-memory-usage.md'
HASH='0ab031ee22b8341b5061d93439d70d41e9df2f35246354a934c41c260a4aeb33'
MAXN=3000000;MAXM=99999;LO=2;HI=999999999
REFERENCE=r'''#include <cstdio>
#include <vector>
using namespace std;
static char buf[1<<16];static size_t len=0,pos=0;
static int gc(){if(pos==len){len=fread(buf,1,sizeof buf,stdin);pos=0;if(!len)return -1;}return buf[pos++];}
static long long rd(){int c=gc();while(c!='-'&&(c<'0'||c>'9'))c=gc();long long x=0;while(c>='0'&&c<='9'){x=x*10+(c-'0');c=gc();}return x;}
int main(){long long n=rd(),m=rd();vector<long long> a(n);long long total=0;for(auto &x:a){x=rd();total+=x;}
long long cur=0;for(long long i=0;i<m;i++)cur+=a[i];long long best=cur;
for(long long i=m;i<n;i++){cur+=a[i]-a[i-m];if(cur>best)best=cur;}
printf("%lld\n",total-best);}
'''
MUTANTS=[
 {'name':'错误使用32位整数累加','language':'cpp','code':REFERENCE.replace('long long total=0;','int total=0;').replace('long long cur=0;','int cur=0;').replace('long long best=cur;','int best=cur;').replace('printf("%lld\\n",total-best);','printf("%d\\n",total-best);')},
 {'name':'错误删除和最小的连续段','language':'cpp','code':REFERENCE.replace('if(cur>best)best=cur;','if(cur<best)best=cur;')},
 {'name':'错误窗口长度少一','language':'cpp','code':REFERENCE.replace('for(long long i=0;i<m;i++)cur+=a[i];','m--;for(long long i=0;i<m;i++)cur+=a[i];')},
 {'name':'错误只考虑删除开头或结尾','language':'cpp','code':REFERENCE.replace('if(cur>best)best=cur;','if(i==n-1&&cur>best)best=cur;')},
]
for m in MUTANTS:assert m['code']!=REFERENCE,m['name']
EDITORIAL='''## 题意

给定N个进程的内存占用processes和整数m，必须删除恰好一段长度为m的连续进程，求删除后剩余进程内存总和的最小值。

## 推导

剩余总和 = 全部总和 − 被删除段的和。全部总和固定，所以要让剩余最小，就要让被删除的长度m连续段之和最大。答案是 total − max(长度为m的窗口和)。

## 算法

先求总和，再用滑动窗口：第一个窗口是前m个数之和，此后每右移一位加上新进入的数、减去离开的数，记录最大窗口和。最后输出total−best。

## 正确性

长度为m的连续段恰好有N−m+1个，起点为0..N−m。滑动窗口依次得到每个起点对应窗口的和：从起点i−m到起点i−m+1，窗口失去a[i−m]、得到a[i]。因此best是所有可选删除方案中被删除部分的最大和，total−best就是剩余总和的最小值。m=N时唯一方案是全部删除，答案为0。

## 数值范围

每个数可达999999999，N可达3×10^6，总和约3×10^15，超过32位整数范围，必须用64位整数累加。

## 复杂度

O(N)时间。参考解按块读入并手写整数解析，避免大输入读入成为瓶颈。

## 独立验证

oracle用前缀和数组计算每个窗口和后取最大值，不复用滑动状态；小域另对每个起点直接求剩余元素之和取最小值。穷举N=2..6、m=2..N、每个数取{2,5,999999999}的全部输入，并逐个真实运行参考程序。大用例覆盖最大值全满（闭式答案）、全最小值、最大窗口位于开头/结尾/中间、m=N、随机大值等。四个正常退出的错误程序（32位溢出、删最小段、窗口少一、只删两端）在正式用例上各自被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(a,m):
 assert 2<=len(a)<=MAXN and 2<=m<=min(MAXM,len(a)) and all(LO<=v<=HI for v in a)
 return f'{len(a)} {m}\n'+' '.join(map(str,a))+'\n'
def prefix(a,m):
 p=[0,*accumulate(a)];return p[-1]-max(p[i+m]-p[i] for i in range(len(a)-m+1))
def brute(a,m):return min(sum(a[:i])+sum(a[i+m:]) for i in range(len(a)-m+1))
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 assert '## 332. Reduce Memory Usage' in raw.decode()
 fp=subprocess.check_output(['git','show',f'{COMMIT}:{FP_PATH}'],cwd=ROOT);fp_blob=subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=fp).decode().strip()
 assert b'1 < N < 1000000000' in fp and b'1 < m < 100000' in fp
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 assert prefix([10,4,8,13,20],2)==22
 small=[([10,4,8,13,20],2),([5,9,2,7],3),([3,3],2),([2,2],2),([HI,HI],2),([2,HI,HI,2],2),([HI,2,2,HI],2),([7,1+1,9,9,4],4),([100,2,2,100,100],3),([HI]*5,5),([2,3,4,5,6,7],2),([7,6,5,4,3,2],2),([9,2,9,2,9],2)]
 rng=random.Random(SEED);keys={encode(*x) for x in small};assert len(keys)==len(small)
 while len(small)<180:
  n=rng.randint(2,25);a=[rng.choice([rng.randint(2,20),rng.randint(2,HI)]) for _ in range(n)];x=(a,rng.randint(2,n));key=encode(*x)
  if key not in keys:keys.add(key);small.append(x)
 for a,m in small:assert prefix(a,m)==brute(a,m)
 oracles=[{'input':encode(*x),'expectedOutput':f'{prefix(*x)}\n'} for x in small]
 cases=[];large=[]
 def add(name,a,m,hidden=True,closed=None):
  e=prefix(a,m)
  if closed is not None:assert e==closed,(name,e,closed)
  cases.append({'name':name,'input':encode(a,m),'expectedOutput':f'{e}\n','hidden':hidden,'weight':1})
 names=['原样例','本站补充：删除中间段','本站补充：全部删除']
 for i,x in enumerate(small[:3]):add(names[i],*x,hidden=i>=3)
 for i,x in enumerate(small[3:30]):add(f'小规模{i+1}',*x)
 add('百万随机大值m最大',[rng.randint(2,HI) for _ in range(1000000)],MAXM)
 a=[2]*1000000;a[400000:400000+MAXM]=[HI]*MAXM
 add('百万最大段在中间',a,MAXM,closed=2*(1000000-MAXM))
 a=[rng.randint(2,1000) for _ in range(1000000)];a[-50000:]=[HI]*50000
 add('百万最大段在结尾',a,50000,closed=sum(a[:-50000]))
 a=None
 add('三百万全最大值m最大',[HI]*MAXN,MAXM,closed=(MAXN-MAXM)*HI)
 add('三百万全最小值m为2',[2]*MAXN,2,closed=2*(MAXN-2))
 a=[rng.randint(2,HI) for _ in range(MAXN)];a[:MAXM]=[HI]*MAXM
 add('三百万最大段在开头',a,MAXM,closed=sum(a[MAXM:]));a=None
 assert len({c['input'] for c in cases})==len(cases)
 print(f'Amazon332 prepared {len(cases)} formal, {len(oracles)} oracle; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='amazon332-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(2,7):
   for a in product((2,5,HI),repeat=n):
    for m in range(2,n+1):
     e=brute(list(a),m);assert e==prefix(list(a),m);assert execute(binary,encode(list(a),m))[0]==str(e);exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput'].strip()
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'].strip(),case['name']
   if len(case['input'])>=100000:large.append({'name':case['name'],'n':int(case['input'].split()[0]),'m':int(case['input'].split()[1]),'inputBytes':len(case['input']),'expectedOutput':case['expectedOutput'].strip(),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput'].strip():rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Amazon OA #332：Reduce Memory Usage','difficulty':'简单','tags':['滑动窗口','前缀和','数组'],
 'description':'数据中心里有N个进程，processes[i]是第i个进程占用的内存。你必须从列表中删除恰好m个位置连续的进程，使剩余进程占用的内存总和最小。输出这个最小总和。',
 'input':'第一行两个整数N和m。第二行N个整数processes[0..N-1]，空白分隔。2≤N≤3×10^6，2≤m≤99999且m≤N，2≤processes[i]≤999999999。',
 'output':'输出一个整数：删除一段长度为m的连续进程后，剩余内存总和的最小值。答案可能超过32位整数范围。',
 'explanation':'样例1：删除13和20，剩余10+4+8=22。样例2：[5,9,2,7]删除长度3的连续段，删除5,9,2剩7，删除9,2,7剩5，答案5。样例3：N=m=2时只能全部删除，剩余0。',
 'hints':['剩余总和等于全部总和减去被删除段的和。','被删除段的和越大越好。','用滑动窗口求所有长度为m的窗口和的最大值，注意使用64位整数。'],
 'timeLimit':4,'memoryLimit':262144,'outputLimit':1024,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 payload=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False);ncases=len(cases);total_case_bytes=sum(len(c['input'])+len(c['expectedOutput']) for c in cases);cases=None
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=payload,text=True,capture_output=True,check=True).stdout;payload=None
 assert len(normalized.encode())<128*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'总和减去最大窗口和','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'section':'## 332. Reduce Memory Usage','gitBlobSha':BLOB,'rawSha256':RAW_SHA},{'path':FP_PATH,'gitBlobSha':fp_blob,'rawSha256':sha(fp),'role':'parallel FastPrep page with identical statement, constraints and example'}],'upstreamCodeExecuted':False,
  'rangeDisclosure':'Original constraints: 1<N<10^9, 1<m<10^5, 1<process[i]<10^9 (strict). N up to 999999999 needs gigabytes of explicit text and cannot fit the 32MiB per-case input / 128MiB package budgets, so N is capped at 3*10^6 (each value at most 9 digits plus a separator, about 30MB per maximal input). m and process[i] keep the original integer domains 2..99999 and 2..999999999. m<=N is stated explicitly because deleting m processes from N requires it. Answer can reach about 3*10^15, so 64-bit output is stated.',
  'corrections':['None to the original example ([10,4,8,13,20], m=2 -> 22). Second and third public examples are authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'规则与样例一致；按用户指定的范围政策把N上限收到3×10^6，m与数值域保持原样（原范围记录在source evidence），滑动窗口参考解与前缀和oracle、逐起点暴力穷举交叉核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':ncases-3,'referenceFormalCases':ncases,'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Independent prefix-sum window maximum; direct per-start remaining-sum brute force on every oracle input and on the exhaustive small domain; closed-form answers on structured large cases.','exhaustiveSmallDomain':{'cases':exhaustive,'nMin':2,'nMax':6,'values':[2,5,HI],'mRange':'2..N'},'largeBoundaries':large,'caseBytes':total_case_bytes,'packageBytes':len(normalized.encode()),'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Amazon332 frozen: {ncases} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
