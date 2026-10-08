#!/usr/bin/env python3
"""Print sentences as a bordered table: byte-exact formatting checked against a structural verifier."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,string
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-airbnb-6';BATCH='airbnb-6-recovered';SEED=20261009
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCES=[
 ('fastprep/Airbnb/airbnb-print-sentences-as-table.md','20e666083aa7be19fee57c32e68f71d08aa91c60','bbf460439bd60711f598a2a2d430da52d7234dbc032d4cb8313065316f605b45'),
 ('web/content/docs/companies/airbnb.mdx','c92f5142a5e3ec28a8945b6d8fb2d7913f4622f3','ebda6bb37536038123e96d08343b027bd8a82c487c3ea3b4929368a30dd99cb3'),
]
HASH='54ed5ba7e3dac6c1628db32155c0483c2c20fe927f5242f807c86c98799e1602'
MAXN,MAXW=100000,300
REFERENCE=r'''#include <cstdio>
#include <string>
using namespace std;
int main(){string in;char buf[1<<16];size_t r;while((r=fread(buf,1,sizeof buf,stdin))>0)in.append(buf,r);
size_t p=0;long n=0,w=0;while(p<in.size()&&in[p]==' ')p++;while(p<in.size()&&in[p]>='0'&&in[p]<='9')n=n*10+(in[p++]-'0');
while(p<in.size()&&in[p]==' ')p++;while(p<in.size()&&in[p]>='0'&&in[p]<='9')w=w*10+(in[p++]-'0');
while(p<in.size()&&in[p]!='\n')p++;if(p<in.size())p++;
string border="+"+string(w+2,'-')+"+\n";string out;out.reserve((size_t)(2*n+1)*(w+5));
for(long i=0;i<n;i++){size_t e=in.find('\n',p);if(e==string::npos)e=in.size();size_t len=e-p;
 out+=border;out+="| ";out.append(in,p,len);out.append(w-len,' ');out+=" |\n";p=e<in.size()?e+1:e;}
if(n>0)out+=border;fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误漏掉最后一条边框','language':'cpp','code':REFERENCE.replace('if(n>0)out+=border;','')},
 {'name':'错误边框只有width个短横线','language':'cpp','code':REFERENCE.replace("string(w+2,'-')","string(w,'-')")},
 {'name':'错误删除句首空格','language':'cpp','code':REFERENCE.replace('size_t len=e-p;','while(p<e&&in[p]==\' \')p++;size_t len=e-p;')},
 {'name':'错误n为0时仍输出一条边框','language':'cpp','code':REFERENCE.replace('if(n>0)out+=border;','out+=border;')},
 {'name':'错误按最长句子而非width补齐','language':'cpp','code':REFERENCE.replace('string border="+"+string(w+2,\'-\')+"+\\n";','{size_t q=p;long mx=0;for(long i=0;i<n;i++){size_t e=in.find(\'\\n\',q);if(e==string::npos)e=in.size();if((long)(e-q)>mx)mx=e-q;q=e<in.size()?e+1:e;}w=mx;}string border="+"+string(w+2,\'-\')+"+\\n";')},
]
for x in MUTANTS:assert x['code']!=REFERENCE,x['name']
EDITORIAL='''## 题意

给定 n 个句子和固定内容宽度 width，把每个句子画成表格的一行：边框行、句子行交替出现，最后再补一条边框收尾，共 2n+1 行；n=0 时什么都不输出。

- 边框行：`+`，width+2 个 `-`，`+`。
- 句子行：`| `，句子原样，补空格到恰好 width 个内容字符，` |`。

## 思路

先构造一次边框串，然后逐行读句子：输出边框，再输出 `| ` + 句子 + (width−len) 个空格 + ` |`。最后若 n>0 再输出一次边框。

句子中的空格（包括开头和结尾的空格）都是内容的一部分，必须原样保留，因此要按“整行”读取，不能按空白分词，也不能去掉首尾空格。空句子对应一整行 width 个空格。

## 正确性

每个句子行的长度为 2+len+(width−len)+2=width+4，与边框行等长；每一行的内容只依赖对应句子和 width，按顺序输出即得到唯一正确的表格。

## 复杂度

输出共 (2n+1)·(width+5) 字节，时间和空间都与输出规模线性相关。逐行多次 print 或频繁刷新在大数据下较慢，建议拼接后一次性写出。

## 独立验证

oracle 用 Python 的格式化补齐（`ljust`）生成表格；另写结构校验器，不构造答案而是逐行检查：行数为 2n+1、偶数行等于边框、奇数行以 `| ` 开头以 ` |` 结尾且中间等于句子加空格。穷举 width≤3、n≤2、句子取自 {空格, a} 的全部输入并逐个运行参考程序。五个正常退出的错误程序（漏最后边框、边框短横线数量错、删除句首空格、n=0 仍输出边框、按最长句子补齐）都被正式数据判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
PRINTABLE=set(chr(c) for c in range(32,127))
def encode(w,sents):
 assert 0<=len(sents)<=MAXN and 1<=w<=MAXW
 for s in sents:assert len(s)<=w and set(s)<=PRINTABLE
 return f'{len(sents)} {w}\n'+''.join(s+'\n' for s in sents)
def table(w,sents):
 if not sents:return ''
 b='+'+'-'*(w+2)+'+\n'
 return b+b.join(f'| {s.ljust(w)} |\n' for s in sents)+b
def verify(w,sents,out):
 lines=out.split('\n')
 if not sents:return out==''
 if lines[-1]!='' or len(lines)!=2*len(sents)+2:return False
 lines=lines[:-1]
 for i,l in enumerate(lines):
  if len(l)!=w+4:return False
  if i%2==0:
   if l[0]!='+' or l[-1]!='+' or set(l[1:-1])!={'-'}:return False
  else:
   s=sents[i//2]
   if l[:2]!='| ' or l[-2:]!=' |' or l[2:2+len(s)]!=s or set(l[2+len(s):-2])-{' '}:return False
 return True
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw.encode(),capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout.decode(),round(time.perf_counter()-start,5)
ALPHA=''.join(chr(c) for c in range(32,127))
def sentence(rng,lo,hi,alpha=ALPHA):return ''.join(rng.choice(alpha) for _ in range(rng.randint(lo,hi)))
def main():
 started=time.perf_counter();bound=[]
 for path,blob,raw_sha in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==raw_sha,path
  assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==blob
  bound.append({'path':path,'gitBlobSha':blob,'rawSha256':raw_sha})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 ex1=(55,['Hello world','How are you today','Bye'])
 ex2=(5,[])
 ex3=(6,['  ab','','x y z ','|-+|-+'])
 assert table(*ex1).split('\n')[0]=='+'+'-'*57+'+' and table(*ex1).count('\n')==7
 small=[ex1,ex2,ex3,(1,['a']),(1,['']),(1,[' ']),(3,['abc','a','']),(4,['   x','x   ',' xx ']),(10,['"quoted"','back\\slash','tab-less~']),(2,['ab']*5),(300,['w'*300]),(300,['']),(7,[' '*7,'       ']),(1,[]),(300,[]),(13,['Hello, World!','#$%&()*+,-./',':;<=>?@[]^_`','{|}~ 0123456'])]
 rng=random.Random(SEED);keys={encode(*a) for a in small};assert len(keys)==len(small)
 while len(small)<175:
  w=rng.choice([rng.randint(1,6),rng.randint(1,40)]);n=rng.randint(0,7)
  alpha=rng.choice([ALPHA,' a',' ab|+-'])
  a=(w,[sentence(rng,0,w,alpha) for _ in range(n)]);key=encode(*a)
  if key not in keys:keys.add(key);small.append(a)
 for a in small:assert verify(a[0],a[1],table(*a))
 oracles=[{'input':encode(*a),'expectedOutput':table(*a)} for a in small]
 cases=[];large=[]
 def add(name,a,hidden=True,big=False):
  exp=table(*a);assert verify(a[0],a[1],exp)
  cases.append({'name':name,'input':encode(*a),'expectedOutput':exp,'hidden':hidden,'weight':1})
  if big:large.append(name)
 names=['原样例','n为0','首尾空格与空句子','宽度1单字符','宽度1空句子','宽度1空格句子','长短混合','首尾空格保留','引号与反斜杠','重复句子','宽度300满行','宽度300空句子','全空格句子','宽度1且n为0','宽度300且n为0','可见符号']
 for i,a in enumerate(small[:len(names)]):add(names[i],a,i>=3)
 for i in range(len(names),len(names)+14):add(f'小规模随机{i-len(names)+1}',small[i])
 add('中等规模满长句子',(MAXW,[sentence(rng,MAXW,MAXW) for _ in range(500)]))
 add('中等规模全空句子',(150,['']*2000))
 add('中等规模宽度递增句长',(MAXW,[' '*(i%3)+'x'*(i-(i%3)) for i in range(MAXW+1)]))
 print(f'Airbnb6 small/medium ready: {len(cases)} formal, {len(oracles)} oracle',flush=True)
 add('最大n与最大width短句',(MAXW,[sentence(rng,0,20) for _ in range(MAXN)]),big=True)
 add('最大n宽度1',(1,[rng.choice(['',' ','a','|','-','+']) for _ in range(MAXN)]),big=True)
 add('最大n宽度40满长句子',(40,[sentence(rng,40,40) for _ in range(MAXN)]),big=True)
 add('宽度300满长句子',(MAXW,[sentence(rng,MAXW,MAXW) for _ in range(4000)]),big=True)
 add('首尾空格随机长度',(100,[' '*rng.randint(0,5)+sentence(rng,0,80)+' '*rng.randint(0,5) for _ in range(20000)]),big=True)
 print(f'Airbnb6 prepared {len(cases)} formal ({len(large)} large), {len(oracles)} oracle; testing native programs',flush=True)
 assert 35<=len(cases)<=64 and len(oracles)>=160 and len(large)<=6
 big_stats=[]
 with tempfile.TemporaryDirectory(prefix='airbnb6-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++17','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for w in range(1,4):
   pool=[''.join(t) for L in range(w+1) for t in product(' a',repeat=L)]
   for n in range(3):
    for sents in product(pool,repeat=n):
     a=(w,list(sents));out=execute(binary,encode(*a))[0];assert out==table(*a) and verify(w,a[1],out);exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput']
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'],case['name']
   if case['name'] in large:big_stats.append({'name':case['name'],'header':case['input'].split('\n',1)[0],'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++17','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput']:rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
   print(f'mutant {i+1} rejected on {len(rejected)} cases',flush=True)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Airbnb OA #6：把句子打印成表格','difficulty':'简单','tags':['OA','Airbnb','字符串','模拟'],
 'description':'给定 n 个句子和固定的表格内容宽度 width，把每个句子作为一行打印在带边框的表格里。\n\n边框行是 `+`，接 width+2 个 `-`，再接 `+`。句子行是 `| `，接句子本身，再补空格使内容恰好占 width 个字符，最后接 ` |`。\n\n按顺序对每个句子先输出一条边框行、再输出它的句子行，最后再输出一条边框行收尾。n=0 时不输出任何内容。',
 'input':'第一行两个整数 n 和 width。接下来 n 行，每行一个句子（整行就是句子内容，可能含空格，也可能为空行）。\n\n0≤n≤100000，1≤width≤300；句子由可打印 ASCII 字符和空格组成，长度不超过 width。',
 'output':'n>0 时输出 2n+1 行表格，每行以换行结尾；n=0 时输出为空。输出按字符逐一比较，句子首尾的空格也必须原样保留。',
 'explanation':'样例 1：width=55，每条边框是 + 加 57 个 - 再加 +；每个句子行把句子补空格到 55 个字符。\n样例 2：n=0，没有输出。\n样例 3：第一句开头的两个空格、第二句的空句子和第三句结尾的空格都按原样计入内容宽度。',
 'hints':['按整行读取句子，不要按空白分词。','先拼出边框串，循环中重复使用。','别忘了表格最后的收尾边框，以及 n=0 的情况。'],
 'timeLimit':2,'memoryLimit':262144,'outputLimit':65536,'checker':'exact','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 total=len(normalized.encode());assert total<=95*1024*1024,total
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'逐行补齐与边框拼接','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':bound,'upstreamCodeExecuted':False,
  'rangeDisclosure':'Original: 0<=n<=10^5, 1<=width<=10^4 (worst ~1GB input, ~2GB output). Reduced to n<=10^5 (original n kept), width<=300: worst output (2n+1)(width+5)=61.2MB fits the 64MiB per-case budget. Chosen over the alternative n<=3000, width<=10^4 because (a) it keeps the original row-count bound, so every large case exercises 10^5 independent rows with all padding amounts 0..width, which is what distinguishes formatting bugs (per-row padding, closing border, leading-space trimming); (b) under either option one max-output case is ~61MB, but with width<=300 input stays small (short sentences still give max output), so several large cases (max n/max width, width 1, width 40 full rows, width 300 full rows, edge-space rows) fit together in one package under ~95MB, whereas n<=3000 width=10^4 full rows already cost ~90MB for a single case. Character set unchanged.',
  'corrections':['The raw statement says the sample output is in a visible example that the snapshot does not contain; sample output is derived from the explicit border/row rules (closing border after the last row, as the bordered-table wording and the catalog solution agree).','Second and third public samples are authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'表格格式规则完整；保留n≤1e5、width缩到300以容纳多个大用例；逐字节exact判题，ljust格式化oracle与结构校验器独立核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Python str.ljust formatter; independent structural verifier (line count 2n+1, border lines, row prefix/suffix, sentence then spaces) applied to every oracle and formal expectation and to reference output in the exhaustive domain.','exhaustiveSmallDomain':{'cases':exhaustive,'widths':[1,2,3],'nMax':2,'alphabet':[' ','a']},'largeBoundaries':big_stats,'packageBytes':total,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Airbnb6 frozen: {len(cases)} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} bytes={total}',flush=True)
if __name__=='__main__':main()
