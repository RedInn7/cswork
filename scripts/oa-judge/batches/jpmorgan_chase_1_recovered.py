#!/usr/bin/env python3
"""Negate range updates: XOR difference parity versus sorted-endpoint sweep and direct simulation."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-jpmorgan-chase-1';BATCH='jpmorgan-chase-1-recovered';SEED=20261013
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCES=[
 ('OA LIST/JPMorganChase/001_image.txt','dd14f263c88a547503264914098b6000ae1e3a03','b42fd405b8d03026463e4622d9e8cd70ffa0a37bfdf16ca92291573a07017479'),
 ('OA LIST/JPMorganChase/_chapter.md','802462b46fe6dade7a4ee17e8d99ee14b8397091','06059c18ad83e13a70798c3075279edf64b8922f303976d27206d8201d736501'),
 ('web/content/docs/companies/jpmorgan-chase.mdx','7da508eca40149d8b3286f8c562de5b7e4369026','9868cecc5d03f1be98340af271adf376bcc586b74aac5042a4b0d454e2d6a429'),
]
HASH='dd0671189338da8df11490e9a9810dbe586808e198d9ffaf8d592e9f44e0dabd'
MAXN=MAXK=1000000;MAXV=10**9
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <string>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<long long> a(n);for(auto &x:a)scanf("%lld",&x);
int k;scanf("%d",&k);vector<unsigned char> flip(n+1,0);
for(int i=0;i<k;i++){int l,r;scanf("%d %d",&l,&r);flip[l-1]^=1;flip[r]^=1;}
string out;out.reserve((size_t)n*12);unsigned char cur=0;char buf[24];
for(int i=0;i<n;i++){cur^=flip[i];long long v=cur?-a[i]:a[i];int len=snprintf(buf,sizeof buf,"%lld",v);if(i)out+=' ';out.append(buf,len);}
out+='\n';fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误把右端点当作开区间','language':'cpp','code':REFERENCE.replace('flip[r]^=1;','flip[r-1]^=1;')},
 {'name':'错误被覆盖过就取反而不看奇偶','language':'cpp','code':REFERENCE.replace('vector<unsigned char> flip(n+1,0);','vector<int> flip(n+1,0);').replace('flip[l-1]^=1;flip[r]^=1;','flip[l-1]++;flip[r]--;').replace('unsigned char cur=0;','int cur=0;').replace('cur^=flip[i];','cur+=flip[i];')},
 {'name':'错误按0下标处理区间','language':'cpp','code':REFERENCE.replace('vector<unsigned char> flip(n+1,0);','vector<unsigned char> flip(n+2,0);').replace('flip[l-1]^=1;flip[r]^=1;','flip[l]^=1;flip[r+1]^=1;')},
 {'name':'错误把取反写成取绝对值的相反数','language':'cpp','code':REFERENCE.replace('long long v=cur?-a[i]:a[i];','long long v=cur?-(a[i]<0?-a[i]:a[i]):a[i];')},
]
for x in MUTANTS:assert x['code']!=REFERENCE,x['name']
EDITORIAL='''## 思路：只关心取反次数的奇偶

把一个数取反两次等于没变，所以每个位置的最终值只取决于它被多少个更新区间覆盖：覆盖次数为奇数就取反，为偶数就保持原值。逐个区间逐个元素地取反是 O(n·k)，在 n、k 都到 10^6 时太慢。

用异或差分：对区间 [l, r]（1 下标），令 flip[l−1] ^= 1、flip[r] ^= 1。之后从左到右做前缀异或 cur ^= flip[i]，cur 就是位置 i 被覆盖次数的奇偶。cur=1 时输出 −data[i]，否则输出 data[i]。

## 正确性

区间 [l, r] 只在前缀异或经过下标 l−1 时把 cur 翻转一次，在经过下标 r 时再翻转回来，因此恰好让下标 l−1..r−1（即 1 下标的 l..r）的奇偶各翻转一次，其他位置不受影响。所有区间的贡献按异或叠加，得到的就是每个位置被覆盖次数的奇偶。

注意 0 取反仍是 0；|data[i]| ≤ 10^9，取反不会溢出 32 位整数。

## 复杂度

O(n + k) 时间，O(n) 额外空间。输入输出各约 10^6 个数，建议使用快速读写。

## 独立验证

oracle 把所有区间端点排序后扫描线计数覆盖次数，不使用差分数组；小数据另外直接逐次模拟取反。穷举 n≤3 时由全部区间组成、长度不超过 3 的更新序列并逐个运行参考程序。四个正常退出的错误程序（右端点开区间、只要被覆盖就取反、按 0 下标处理、用 −|x| 代替取反）都在正式数据上被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(data,ups):
 n=len(data);assert 1<=n<=MAXN and 1<=len(ups)<=MAXK and all(-MAXV<=v<=MAXV for v in data) and all(1<=l<=r<=n for l,r in ups)
 return f'{n}\n'+' '.join(map(str,data))+f'\n{len(ups)}\n'+''.join(f'{l} {r}\n' for l,r in ups)
def sweep(data,ups):
 ev=sorted([(l-1,1) for l,_ in ups]+[(r,-1) for _,r in ups]);out=[];j=0;c=0
 for i,v in enumerate(data):
  while j<len(ev) and ev[j][0]<=i:c+=ev[j][1];j+=1
  out.append(-v if c&1 else v)
 return ' '.join(map(str,out))+'\n'
def simulate(data,ups):
 a=list(data)
 for l,r in ups:
  for i in range(l-1,r):a[i]=-a[i]
 return ' '.join(map(str,a))+'\n'
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout,round(time.perf_counter()-start,5)
def tokens(s):return s.split()
def rint(rng,n):
 l=rng.randint(1,n);r=rng.randint(1,n);return (min(l,r),max(l,r))
def main():
 started=time.perf_counter();bound=[]
 for path,blob,raw_sha in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==raw_sha,path
  assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==blob
  bound.append({'path':path,'gitBlobSha':blob,'rawSha256':raw_sha})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 ex1=([1,-4,-5,2],[(2,4),(1,2)]);ex2=([1,2,3,4,5],[(1,3),(2,4)]);ex3=([0,-7,MAXV],[(1,3),(1,3),(2,2)])
 assert simulate(*ex1)=='-1 -4 5 -2\n' and simulate(*ex2)=='-1 2 3 -4 5\n' and simulate(*ex3)=='0 7 1000000000\n'
 small=[ex1,ex2,ex3,([5],[(1,1)]),([5],[(1,1),(1,1)]),([-MAXV,MAXV],[(1,2)]),([0,0,0],[(1,3),(2,2)]),([1,2,3,4],[(4,4)]),([1,2,3,4],[(1,1)]),([1,2,3,4,5,6],[(1,6),(2,5),(3,4)]),([7,-7,7],[(1,2),(2,3)]),([1,1,1,1],[(1,4)]*3)]
 rng=random.Random(SEED);keys={encode(*a) for a in small};assert len(keys)==len(small)
 while len(small)<180:
  n=rng.randint(1,12);data=[rng.randint(-20,20) if rng.random()<0.8 else rng.choice([-MAXV,MAXV,0]) for _ in range(n)]
  a=(data,[rint(rng,n) for _ in range(rng.randint(1,10))]);key=encode(*a)
  if key not in keys:keys.add(key);small.append(a)
 for a in small:assert sweep(*a)==simulate(*a)
 oracles=[{'input':encode(*a),'expectedOutput':simulate(*a)} for a in small]
 cases=[];large=[]
 def add(name,a,hidden=True,big=False):
  cases.append({'name':name,'input':encode(*a),'expectedOutput':sweep(*a),'hidden':hidden,'weight':1})
  if big:large.append(name)
 names=['原样例（OCR）','原样例（整理版）','重复区间与零','单元素一次','单元素两次','最大绝对值','零取反仍为零','只改最后一个','只改第一个','嵌套区间','相邻重叠','全区间三次']
 for i,a in enumerate(small[:len(names)]):add(names[i],a,i>=3)
 for i in range(len(names),len(names)+16):add(f'小规模随机{i-len(names)+1}',small[i])
 for t in range(3):
  n=rng.randint(1000,50000);add(f'中等规模随机{t+1}',([rng.randint(-MAXV,MAXV) for _ in range(n)],[rint(rng,n) for _ in range(rng.randint(1000,50000))]))
 n=20000;add('中等规模单点更新',([rng.randint(-9,9) for _ in range(n)],[(i,i) for i in rng.sample(range(1,n+1),n)]))
 print(f'JPM1 small/medium ready: {len(cases)} formal, {len(oracles)} oracle',flush=True)
 N=MAXN
 add('n与k均为上限且数值满宽',([rng.choice([-1,1])*rng.randint(10**8,MAXV) for _ in range(N)],[rint(rng,N) for _ in range(MAXK)]),big=True)
 add('上限次数全区间偶数次',([rng.randint(-999,999) for _ in range(N)],[(1,N)]*MAXK),big=True)
 add('一次全区间取反',([rng.randint(-9,9) for _ in range(N)],[(1,N)]),big=True)
 add('单元素奇数次',([-MAXV],[(1,1)]*(MAXK-1)),big=True)
 add('层层嵌套区间',([rng.choice([0,1,-1]) for _ in range(N)],[(i,N-i+1) for i in range(1,N//2+1)]+[rint(rng,N) for _ in range(MAXK-N//2)]),big=True)
 print(f'JPM1 prepared {len(cases)} formal ({len(large)} large), {len(oracles)} oracle; testing native programs',flush=True)
 assert 35<=len(cases)<=64 and len(oracles)>=160 and len(large)<=6
 big_stats=[]
 with tempfile.TemporaryDirectory(prefix='jpm1-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++17','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(1,4):
   data=[0,-5,7][:n];iv=[(l,r) for l in range(1,n+1) for r in range(l,n+1)]
   for k in range(1,4):
    for ups in product(iv,repeat=k):
     a=(data,list(ups));e=simulate(*a);assert sweep(*a)==e and execute(binary,encode(*a))[0]==e;exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput']
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'],case['name']
   if case['name'] in large:big_stats.append({'name':case['name'],'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++17','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if tokens(execute(mb,case['input'])[0])!=tokens(case['expectedOutput']):rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
   print(f'mutant {i+1} rejected on {len(rejected)} cases',flush=True)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'JPMorgan Chase OA #1：区间取反更新','difficulty':'中等','tags':['OA','JPMorgan Chase','差分','前缀异或','数组'],
 'description':'一名数据分析师拿到一个长度为 n 的数组 data，表示 n 天的数据。他依次执行 k 次更新，每次更新为 [l, r]，表示把下标 l 到 r（含两端，下标从 1 开始）的元素全部取反（x 变为 −x）。\n\n求所有更新完成后的数组。',
 'input':'第一行整数 n，第二行 n 个整数 data[1..n]。第三行整数 k，接下来 k 行每行两个整数 l r。\n\n1≤n≤10^6，1≤k≤10^6，|data[i]|≤10^9，1≤l≤r≤n。',
 'output':'输出一行 n 个整数，为最终的数组，用空格分隔。',
 'explanation':'样例 1：第一次更新 [2,4] 后为 [1,4,5,−2]，第二次更新 [1,2] 后为 [−1,−4,5,−2]。\n样例 2：[1,3] 后为 [−1,−2,−3,4,5]，[2,4] 后为 [−1,2,3,−4,5]。\n样例 3：[1,3] 做了两次相当于没变，再对第 2 个元素取反；0 取反仍是 0。',
 'hints':['取反两次等于不变，只需要知道每个位置被覆盖次数的奇偶。','对区间 [l,r] 在差分数组的 l−1 与 r 处各异或 1。','从左到右做前缀异或，奇数则取反。'],
 'timeLimit':2,'memoryLimit':262144,'outputLimit':16384,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 total=len(normalized.encode());assert total<=95*1024*1024,total
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'异或差分统计取反奇偶','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':bound,'upstreamCodeExecuted':False,
  'rangeDisclosure':'Sources conflict: original OCR (OA LIST 001_image.txt) gives 1<=n<=10^8, 1<=k<=10^5, "length of data[i]<=10^9" (OCR for |data[i]|<=10^9); the organized chapter and OAMaster MDX give 1<=n,k<=10^6, |data[i]|<=10^9. n=10^8 needs ~1.2GB input/output. Adopted 1<=n<=10^6 (largest that fits 32MiB input with k=10^6 updates; OCR n reduced 100x) and 1<=k<=10^6 (MDX/chapter bound, covers OCR k<=10^5). Value domain |data[i]|<=10^9 unchanged; 1<=l<=r<=n.',
  'corrections':['OCR example ([1,-4,-5,2], [[2,4],[1,2]] -> [-1,-4,5,-2]) and MDX example ([1,2,3,4,5], [[1,3],[2,4]] -> [-1,2,3,-4,5]) both kept as public samples; third sample authored.','OCR "length of data[i]" read as |data[i]| per chapter/MDX.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'区间取反规则与OCR、MDX两例一致；取能容纳的n,k≤1e6；异或差分参考解，端点排序扫描线与逐次模拟独立核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Direct per-update negation simulation for oracle inputs; sorted-endpoint sweep counting coverage for formal expectations; both cross-checked on all oracle and exhaustive inputs.','exhaustiveSmallDomain':{'cases':exhaustive,'nMax':3,'data':[0,-5,7],'updateSequences':'all sequences of 1..3 intervals'},'largeBoundaries':big_stats,'packageBytes':total,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'JPM1 frozen: {len(cases)} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} bytes={total}',flush=True)
if __name__=='__main__':main()
