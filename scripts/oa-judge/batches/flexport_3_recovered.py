#!/usr/bin/env python3
"""Sum of all '+'-insertion expression values mod 1e9+7: prefix DP reference versus per-digit contribution oracle."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-flexport-3';BATCH='flexport-3-recovered';SEED=20261206
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='web/content/docs/companies/flexport.mdx'
RAW_SHA='73b4c8118bf670dcb261e095ff832d71161cf6d6677450568696c9dd955c5a07'
BLOB='71ef7fe7b879adca275af31baf51e090fd70be0c'
FP_PATH='fastprep/Flexport/flexport-get-expression-sums.md'
HASH='84ee3ab9a35b3d1d9847a63164858e36a3af35ac7baae94fd76faa62abe7bda4'
MAXN=30000000;MOD=10**9+7
REFERENCE=r'''#include <cstdio>
#include <cstdint>
int main(){const uint64_t M=1000000007ULL;static char buf[1<<16];size_t k;bool first=true;uint64_t c=0,f=0,g=0;
while((k=fread(buf,1,sizeof buf,stdin))>0)for(size_t i=0;i<k;i++){char ch=buf[i];if(ch<'0'||ch>'9')continue;uint64_t d=ch-'0';
if(first){c=1;f=d;g=d;first=false;continue;}
uint64_t cd=c*d%M;f=(2*f+9*g+2*cd)%M;g=(10*g+2*cd)%M;c=c*2%M;}
printf("%llu\n",(unsigned long long)f);}
'''
MUTANTS=[
 {'name':'错误表达式个数不取模','language':'cpp','code':REFERENCE.replace('c=c*2%M;','c=c*2;')},
 {'name':'错误使用模数998244353','language':'cpp','code':REFERENCE.replace('M=1000000007ULL','M=998244353ULL')},
 {'name':'错误加号分支漏加新数字','language':'cpp','code':REFERENCE.replace('f=(2*f+9*g+2*cd)%M;','f=(2*f+9*g+cd)%M;')},
 {'name':'错误不计不插加号的表达式','language':'cpp','code':REFERENCE.replace('uint64_t c=0,f=0,g=0;','uint64_t c=0,f=0,g=0,v=0;').replace('if(first){c=1;','v=(v*10+d)%M;if(first){c=1;').replace('printf("%llu\\n",(unsigned long long)f);','printf("%llu\\n",(unsigned long long)((f+M-v)%M));')},
]
for m in MUTANTS:assert m['code']!=REFERENCE,m['name']
EDITORIAL='''## 题意

给定数字串num，可以在任意相邻两个字符之间插入'+'（每个空隙至多一个'+'，可以一个都不插）。对所有2^(n−1)种插法，把得到的算式求值，求这些值的总和对10^9+7取模。被'+'分开的每一段按十进制数求值，前导零不影响数值（例如"05"的值为5）。

## 前缀递推

只看前i个字符构成的所有算式，维护三个量：算式个数c、所有算式的值之和f、所有算式最后一段的数值之和g。加入下一位数字d时，每个旧算式有两种延伸：

- 在中间插'+'，d成为新的一段：值增加d，最后一段变为d。
- 不插'+'，d接在最后一段后面：最后一段x变为10x+d，值增加9x+d。

汇总得到：c' = 2c，f' = (f + c·d) + (f + 9g + c·d) = 2f + 9g + 2cd，g' = c·d + (10g + c·d) = 10g + 2cd。初始只有第一位时c=1，f=g=d。最终答案是f。

## 正确性

每个长度为i+1的算式唯一对应“长度为i的算式+最后一个空隙插或不插”，上面两种情况恰好覆盖这两种选择，各自对值与最后一段的影响按十进制定义计算，因此三个量的递推都是精确的（在模意义下同样成立，因为只用了加法和乘法）。归纳到整串即得答案。

## 复杂度

O(n)时间、O(1)额外空间，参考解按块读入，长度三千万的输入也只需一次线性扫描。

## 独立验证

oracle从每一位数字的贡献出发：第i位（0起）在某段中处于从右数第k位时贡献d·10^k，此时它左边的i个空隙任意，它到段尾的k个空隙不插'+'，段尾后的空隙必须插'+'（若段尾不是整串末尾），其余空隙任意。于是第i位的总权重为2^i·(Σ_{k<m} 10^k·2^{m−1−k} + 10^m)，m=n−1−i，由右向左累加，不复用前缀递推。小域另枚举所有插法直接求值。穷举长度1..4的全部数字串并逐个真实运行参考程序。正式用例覆盖原样例、单个数字、全零、前导零、全9、长度三千万随机串等。四个正常退出的错误程序（个数不取模、错误模数、漏加新数字、漏掉不插加号的算式）在正式用例上各自被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(s):
 assert 1<=len(s)<=MAXN and s.isdigit() and s.isascii()
 return s+'\n'
def contribution(s):
 # walk from the right: m=n-1-i, S_m=sum_{k<m}10^k 2^{m-1-k}, weight 2^i*(S_m+10^m); 2^i via inverse of 2
 n=len(s);total=0;S=0;p10=1;p2=pow(2,n-1,MOD);inv2=(MOD+1)//2
 for i in range(n-1,-1,-1):
  d=ord(s[i])-48
  if d:total=(total+d*p2%MOD*((S+p10)%MOD))%MOD
  S=(2*S+p10)%MOD;p10=p10*10%MOD;p2=p2*inv2%MOD
 return total
def brute(s):
 n=len(s);t=0
 for mask in range(1<<(n-1)):
  cur=s[0]
  parts=[]
  for i in range(1,n):
   if mask>>(i-1)&1:parts.append(cur);cur=s[i]
   else:cur+=s[i]
  parts.append(cur);t+=sum(int(x) for x in parts)
 return t%MOD
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 assert '## 3. Sum of All Values' in raw.decode()
 fp=subprocess.check_output(['git','show',f'{COMMIT}:{FP_PATH}'],cwd=ROOT);fp_blob=subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=fp).decode().strip()
 assert b'An unknown myth for now' in fp and b'168' in fp
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 assert contribution('123')==brute('123')==168
 small=['123','105','7','0','00','10','01','99','999','1000','0007','12345','9999999999','1111111111','5050505050505','98765432109876543210']
 rng=random.Random(SEED);keys=set(small);assert len(keys)==len(small)
 while len(small)<180:
  s=''.join(rng.choice(rng.choice(['0123456789','09','01','9'])) for _ in range(rng.randint(1,20)))
  if s not in keys:keys.add(s);small.append(s)
 for s in small:assert contribution(s)==brute(s)
 oracles=[{'input':encode(s),'expectedOutput':f'{contribution(s)}\n'} for s in small]
 cases=[];large=[]
 def add(name,s,hidden=True,closed=None):
  e=contribution(s)
  if closed is not None:assert e==closed,(name,e,closed)
  cases.append({'name':name,'input':encode(s),'expectedOutput':f'{e}\n','hidden':hidden,'weight':1})
 names=['原样例','本站补充：含零','本站补充：单个数字']
 for i,s in enumerate(small[:3]):add(names[i],s,i>=3)
 for i,s in enumerate(small[3:32]):add(f'小规模{i+1}',s)
 add('三千万全零','0'*MAXN,closed=0)
 add('三千万全9','9'*MAXN)
 add('三千万随机数字',''.join(rng.choice('0123456789') for _ in range(MAXN)))
 add('一千万前导零后随机','0'*5000000+''.join(rng.choice('0123456789') for _ in range(5000000)))
 add('百万仅末位为1','0'*999999+'1',closed=pow(2,999999,MOD))
 add('百万仅首位为1','1'+'0'*999999)
 assert len({c['input'] for c in cases})==len(cases)
 print(f'Flexport3 prepared {len(cases)} formal, {len(oracles)} oracle; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='flexport3-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(1,5):
   for t in product('0123456789',repeat=n):
    s=''.join(t);e=brute(s);assert e==contribution(s);assert execute(binary,encode(s))[0]==str(e);exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput'].strip()
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'].strip(),case['name']
   if len(case['input'])>=100000:large.append({'name':case['name'],'n':len(case['input'])-1,'inputBytes':len(case['input']),'expectedOutput':case['expectedOutput'].strip(),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput'].strip():rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Flexport OA #3：Sum of All Values','difficulty':'中等','tags':['动态规划','数学','字符串'],
 'description':'给定只含数字0-9的字符串num。可以在任意相邻两个字符之间插入一个\'+\'，不允许出现相邻的\'+\'，也可以一个都不插。每种插法得到一个算式，被\'+\'分开的每一段按十进制整数求值（前导零不影响数值，例如05的值为5）。求所有可能算式的值之和，答案对10^9+7取模。',
 'input':'一行字符串num。1≤|num|≤3×10^7，只含字符0-9。',
 'output':'输出一个整数：所有算式的值之和对10^9+7取模的结果。',
 'explanation':'样例1："123"的算式有1+23=24、12+3=15、1+2+3=6、123=123，总和168。样例2："105"的算式有105、1+05=6、10+5=15、1+0+5=6，总和132。样例3："7"只有一个算式，值为7。',
 'hints':['依次加入每一位数字，旧算式要么在前面插\'+\'，要么把数字接到最后一段。','维护算式个数、值之和、最后一段数值之和三个量。','所有运算都在模10^9+7下进行。'],
 'timeLimit':4,'memoryLimit':262144,'outputLimit':1024,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 payload=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False);ncases=len(cases);total_case_bytes=sum(len(c['input'])+len(c['expectedOutput']) for c in cases);cases=None
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=payload,text=True,capture_output=True,check=True).stdout;payload=None
 assert len(normalized.encode())<128*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'个数、总和与末段和的前缀递推','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'section':'## 3. Sum of All Values','gitBlobSha':BLOB,'rawSha256':RAW_SHA},{'path':FP_PATH,'gitBlobSha':fp_blob,'rawSha256':sha(fp),'role':'parallel FastPrep page with identical statement, placeholder constraints and example'}],'upstreamCodeExecuted':False,
  'rangeDisclosure':'Both sources state the constraints only as a placeholder ("An unknown myth for now"), so the original length has no upper bound. The length is set to the transport limit: 1<=|num|<=3*10^7 (about 30MB per maximal input within the 32MiB per-case budget); the alphabet stays digits 0-9 with any leading digit. Leading zeros inside a segment are evaluated as ordinary decimal integers (implied by "the value of the expression is then evaluated"; no source text forbids them).',
  'corrections':['None to the original example 123 -> 168. Second and third public examples are authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'插加号求和规则与样例168一致；原约束为占位无上界，按用户指定范围政策把长度上限定为传输容量3×10^7（原情况记录在source evidence）；前缀递推参考解与逐位贡献oracle、全插法枚举穷举核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':ncases-3,'referenceFormalCases':ncases,'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Independent per-digit contribution weights 2^i*(sum_k 10^k 2^(m-1-k)+10^m) accumulated right to left; explicit enumeration of all plus placements on oracle inputs and the exhaustive small domain.','exhaustiveSmallDomain':{'cases':exhaustive,'lengthMin':1,'lengthMax':4,'digits':'0-9'},'largeBoundaries':large,'caseBytes':total_case_bytes,'packageBytes':len(normalized.encode()),'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Flexport3 frozen: {ncases} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
