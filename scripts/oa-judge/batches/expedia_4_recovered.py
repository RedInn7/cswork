#!/usr/bin/env python3
"""Inclusive switch parity: native stable radix, direct switch oracle, map oracle."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,re,io,math
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-expedia-4';BATCH='expedia-4-recovered';SEED=20261119
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='fastprep/Expedia/expedia-calculate-the-sum.md'
RAW_SHA='bd18d1e034dcfdc131017631ff7dc1a73406961281ee1a29ad284cf3dae2b1ed'
BLOB='1ab6d2b568112366d351d6b24d0f78232f16b321'
HASH='38cf68da3b811b1b6d48df0c16b31bb55e6086a5c6b714d2591b6c0034d8e971'
BUDGET=32*1024*1024;MAX=2147483647
REFERENCE=r'''#include <cstdio>
#include <cstdint>
#include <vector>
#include <array>
using namespace std;
uint32_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();uint32_t x=0;while(c>32&&c!=EOF){x=x*10+uint32_t(c-'0');c=getchar_unlocked();}return x;}
int main(){uint32_t n=readNumber();vector<uint32_t>a(size_t(n)*2),scratch(size_t(n)*2);
for(uint32_t i=0;i<n;i++){uint32_t left=readNumber(),right=readNumber();a[size_t(i)*2]=left;a[size_t(i)*2+1]=right+uint32_t(1);}
array<uint32_t,65536> count;
for(unsigned shift:{0u,16u}){count.fill(0);for(uint32_t value:a)++count[(value>>shift)&65535u];uint32_t sum=0;
for(uint32_t &v:count){uint32_t old=v;v=sum;sum+=old;}
for(uint32_t value:a)scratch[count[(value>>shift)&65535u]++]=value;a.swap(scratch);}
uint64_t answer=0;for(size_t i=0;i<a.size();i+=2){uint64_t left=a[i],end=a[i+1];answer+=(left+end-1)*(end-left)/2;}
printf("%llu\n",(unsigned long long)answer);}
'''
MUTANTS=[
 {'name':'错误把所有操作当成总包围区间而不翻转','language':'cpp','code':r'''#include <cstdio>
#include <cstdint>
#include <algorithm>
using namespace std;
uint32_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();uint32_t x=0;while(c>32&&c!=EOF){x=x*10+uint32_t(c-'0');c=getchar_unlocked();}return x;}
int main(){uint32_t n=readNumber(),left=2147483647u,right=0;for(uint32_t i=0;i<n;i++){uint32_t a=readNumber(),b=readNumber();left=min(left,a);right=max(right,b);}uint64_t answer=n?(uint64_t(left)+right)*(uint64_t(right)-left+1)/2:0;printf("%llu\n",(unsigned long long)answer);}
'''},
 {'name':'错误把右端点当成不包含','language':'cpp','code':REFERENCE.replace('right+uint32_t(1)','right')},
 {'name':'错误输出开启开关数量而不是编号之和','language':'cpp','code':REFERENCE.replace('(left+end-1)*(end-left)/2','end-left')},
 {'name':'错误把精确结果截为有符号32位','language':'cpp','code':REFERENCE.replace('printf("%llu\\n",(unsigned long long)answer);','uint32_t low=uint32_t(answer);long long wrong=low<2147483648u?low:(long long)low-4294967296LL;printf("%lld\\n",wrong);')},
]
EDITORIAL='''## 原规则、范围与返回值适配

固定原文 fastprep/Expedia/expedia-calculate-the-sum.md 完整说明：开关从1连续编号，全部初始关闭。每个操作给左右端点，把闭区间内每个开关翻转一次，最后求所有开启开关的编号之和。不是开启数量，也不是操作覆盖区间的并集。操作重叠时按奇偶性抵消。原文没有样例，三个公开例均为本站构造。

原约束栏只有颜文字，没有数值上界；参数明确是Java int n和int[][] operations。本站公开按类型解释有效索引为1≤l≤r≤2147483647；不发明更小的端点或操作数上限。n按非负操作数处理，n=0及答案0是本站明确的空操作数学扩展，不称原文给出了n下界。标准输入为n后跟n对端点，接受空白分隔、LF/CRLF及最后数字后直接EOF。所有输入仍受既有32MiB标准传输预算限制；n=8388606且每行1 1的规范LF编码恰好33554432字节，这是预算推导而非来源约束。

原返回int不能覆盖上述完整类型域，例如单次[1,2147483647]结果为2305843008139952128。本站输出精确数学整数，不截断、不取模，并明确将结果提升到64位。所有可能开启位置均在1..INT_MAX，故这个值也是全域最大答案，signed64足够。原整理版本按最大索引开数组，无法覆盖INT_MAX；本站不沿用它来暗中缩域。

公开构造例：操作[1,3]、[2,4]后，仅1与4开启，和为5；两次[2,5]完全抵消，和为0；单次[2147483647,2147483647]的和为2147483647。没有把这些说成来源原样例。

## 思路

把每个闭区间[l,r]变成两个奇偶翻转事件l和r+1。将全部事件排序，保留重复事件。开关状态在每个事件处翻转一次，从关闭开始，所以第0/1、第2/3等相邻配对事件[a,b)对应开启段。两个相同事件形成空段，贡献0；这自然保留偶数次翻转的抵消效果。

开启段a..b−1的编号和为(a+b−1)(b−a)/2。逐对累加即可，不逐个访问开关，不按最大编号分配数组。参考对uint32事件做两趟稳定16位基数排序：先低16位、再高16位。每趟先计数并转为起始偏移，按原顺序散写到另一数组，保证稳定性。

## 正确性证明

对于任意位置x，一个操作[l,r]恰在l≤x<r+1时使它翻转。换成l、r+1两个事件后，截至x的事件总次数与覆盖x的操作数奇偶性相同，故两种表示产生完全相同的开关状态。

排序事件后，相邻事件之间没有状态变化；初始状态关闭，每过一个事件翻转。因此第偶数编号事件到下一事件之间为开启，下一对之前为关闭。重复坐标不含任何开关，配对得到空段，或在同一坐标连续翻转；保留它们正确表达奇偶性。各开启段互不重叠，其并集恰为全部开启位置。对每段使用等差数列求和后相加，正好得到目标编号和。

稳定低位排序使相同高位内按低位有序；第二趟高位稳定排序保持这一低位次序，所以最终是完整32位数值顺序，满足上述配对论证。

## 复杂度与完整输入预算

两趟基数排序和求和为O(n+65536)，空间O(n+65536)。两份2n个uint32数组共16n字节；最大可传输操作数8388606时为134217696字节，再加262144字节计数表及少量运行开销，低于256MiB。流式解析，不另外存输入字符串或操作数组。最大两组输入顺序测试，不并发运行大进程。

r+1在uint32中计算，最大2147483648，不能先用signed int相加。求和将端点先提升为uint64：每段乘积不超过2147483648×2147483647，最终总和不超过2305843008139952128，均无溢出。零操作没有事件，输出0。

## 独立验证

小域oracle直接维护每个开关的开/关状态，逐位置翻转，再求开启位置编号和；穷举索引1..4、0..4个合法区间共11111组。163唯一oracle含随机小输入与完整端点边界。中规模oracle用字典逐事件异或、排序不同坐标并按状态扫描，不使用参考基数排序或直接两两配对。正式至少35组覆盖重复、交叉、相接、嵌套、INT_MAX端点、0操作和各行尾。两组近32MiB输入分别为最多操作数的重复单点（偶数次抵消）和乱序不同单点1..N（闭式N(N+1)/2）；二者期望不由参考生成。四个负控分别忽略翻转、遗漏闭区间右端、把编号和写成数量、32位结果截断；必须在全部正式例正常退出才计击杀。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(q):
 assert all(1<=a<=b<=MAX for a,b in q)
 return str(len(q))+'\n'+''.join(f'{a} {b}\n' for a,b in q)
def direct(q):
 on=set()
 for a,b in q:
  for i in range(a,b+1):
   if i in on:on.remove(i)
   else:on.add(i)
 return sum(on)
def events_oracle(q):
 events={}
 for a,b in q:events[a]=events.get(a,0)^1;events[b+1]=events.get(b+1,0)^1
 result=0;previous=0;on=0
 for pos,change in sorted(events.items()):
  if on:result+=(pos-previous)*(pos+previous-1)//2
  on^=change;previous=pos
 assert not on
 return result
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=30);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def digit_sum(n):
 total=0;start=1;digits=1
 while start<=n:
  end=min(n,start*10-1);total+=(end-start+1)*digits;start*=10;digits+=1
 return total
def shuffled_singletons(n):
 step=65537
 while math.gcd(step,n)!=1:step+=2
 out=io.StringIO();out.write(str(n)+'\n')
 for start in range(0,n,10000):
  out.write(''.join(f'{v} {v}\n' for v in ((i*step)%n+1 for i in range(start,min(n,start+10000)))))
 return out.getvalue()
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=[[(1,3),(2,4)],[(2,5),(2,5)],[(MAX,MAX)],[],[(1,1)],[(1,MAX)],[(1,MAX),(1,MAX)],[(1,2),(3,4)],[(1,4),(2,3)],[(1,2),(2,3)],[(1,3),(1,3),(1,3)],[(MAX-1,MAX),(MAX,MAX)]]
 rng=random.Random(SEED);keys={encode(q) for q in small}
 while len(small)<163:
  q=[]
  for _ in range(rng.randrange(1,10)):
   a=rng.randint(1,20);b=rng.randint(a,20);q.append((a,b))
  key=encode(q)
  if key not in keys:keys.add(key);small.append(q)
 oracles=[]
 for q in small:
  expected=events_oracle(q)
  if all(b-a<100 for a,b in q):assert direct(q)==expected
  oracles.append({'input':encode(q),'expectedOutput':str(expected)+'\n'})
 cases=[];large=[]
 def add_raw(name,raw,expected,hidden=True):
  assert len(raw.encode())<=BUDGET
  cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':hidden,'weight':1})
 def add(name,q,hidden=True,closed=None):
  expected=events_oracle(q)
  if closed is not None:assert closed==expected
  add_raw(name,encode(q),expected,hidden)
 for i,q in enumerate(small[:28]):add(('本站构造公开例' if i<3 else '独立小域')+str(i+1),q,i>=3)
 add_raw('空操作EOF','0',0);add_raw('空操作CRLF','0\r\n',0)
 add_raw('正操作EOF','2\n1 3\n2 4',5);add_raw('正操作CRLF','2\r\n1 3\r\n2 4\r\n',5)
 add('跨符号位的最大右事件',[(1,MAX),(2,MAX)],closed=1)
 add('相接但不重叠高位区间',[(MAX-7,MAX-4),(MAX-3,MAX)],closed=sum(range(MAX-7,MAX+1)))
 add('嵌套高位区间',[(MAX-1000+i,MAX-i) for i in range(501)])
 add('中规模独立事件字典',[(a,min(MAX,a+rng.randrange(1000000))) for a in [rng.randint(1,MAX) for _ in range(20000)]])
 add('同一最大区间奇数次',[(1,MAX)]*10001,closed=MAX*(MAX+1)//2)
 add('同一最大区间偶数次',[(1,MAX)]*10000,closed=0)
 n=8388606;full=str(n)+'\n'+'1 1\n'*n;assert len(full)==BUDGET
 add_raw('32MiB-最大操作数偶数重复',full,0);del full
 lo,hi=1,3000000
 while lo<hi:
  mid=(lo+hi+1)//2
  if len(str(mid))+1+2*digit_sum(mid)+2*mid<=BUDGET:lo=mid
  else:hi=mid-1
 distinct=lo;add_raw('近32MiB-乱序不同单点',shuffled_singletons(distinct),distinct*(distinct+1)//2)
 print(f'Expedia4 prepared {len(cases)} formal; max operations={n}, distinct={distinct}; serial native checks',flush=True)
 with tempfile.TemporaryDirectory(prefix='expedia4-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  ops=[(a,b) for a in range(1,5) for b in range(a,5)];exhaustive=0
  # Exhaustive independent models; actual native runs include all sequences of <=3 operations.
  exhaustive_native=0
  for count in range(5):
   for q in product(ops,repeat=count):
    expected=direct(q);assert expected==events_oracle(q);exhaustive+=1
    if count<=3:assert execute(binary,encode(q))[0]==str(expected);exhaustive_native+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput'].strip()
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'].strip(),case['name']
   if len(case['input'])>100000:
    with tempfile.TemporaryFile(mode='w+') as data:
     data.write(case['input']);data.seek(0);p=subprocess.run(['/usr/bin/time','-l',str(binary)],stdin=data,text=True,capture_output=True,check=True,timeout=30)
    assert p.stdout.strip()==actual;rss=re.search(r'(\d+)\s+maximum resident set size',p.stderr)
    large.append({'name':case['name'],'inputBytes':len(case['input']),'expectedOutput':case['expectedOutput'].strip(),'elapsedSeconds':elapsed,'darwinPeakRssBytes':int(rss.group(1)) if rss else None})
    print(f"formal {case['name']}: {elapsed}s",flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   assert mutant['code']!=REFERENCE
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput'].strip():rejected.append(j)
   assert rejected;kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)});print(f'mutant {i+1}: {len(rejected)} rejected, all normal',flush=True)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Expedia OA #4：区间翻转后的编号之和','difficulty':'困难','tags':['奇偶性','扫描线','基数排序'],
 'description':'开关从1连续编号，全部初始关闭。依次对每个闭区间[l,r]翻转所有开关：关闭变开启，开启变关闭。求最终开启开关的编号之和，不是开启数量；重复操作可抵消。',
 'input':'输入操作数n，随后n对左右端点，空白分隔，支持LF/CRLF及直接EOF。原约束栏无数字，本站按原Java int/int[][]公开适配1≤l≤r≤2147483647；n≥0且受现有32MiB标准输入预算限制，不添加更小操作数上限。n=0为明确的空操作数学扩展。',
 'output':'输出最终开启位置编号之和，精确整数，无取模。原int返回过窄，本站明确使用64位结果，最大2305843008139952128。',
 'explanation':'原文无样例，三公开例均为本站构造：[1,3]和[2,4]后仅1、4开启，和5；[2,5]两次翻转为0；[INT_MAX,INT_MAX]一次为2147483647。闭区间右端必须包含，端点范围来自明确类型适配而非原文数字约束。',
 'hints':['把[l,r]变为l和r+1两个状态翻转事件。','排序事件后按奇偶配对，重复事件不能简单去重。','先把r提升到能表示2147483648的类型，再计算r+1。'],
 'timeLimit':5,'memoryLimit':262144,'outputLimit':1024,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'翻转事件奇偶配对与稳定基数排序','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'gitBlobSha':BLOB,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,'rangeDisclosure':'Raw has no numeric constraints. Explicit positive signed Java int endpoint interpretation1<=l<=r<=INT_MAX, existing32MiB stdin budget with no smaller n cap. n=0 is disclosed empty-operation mathematical extension.','corrections':['Original int return cannot represent full endpoint type domain; exact64bit sum explicitly used.','No original examples; all three public examples authored.','Source solution max-index array not used to restrict full domain.'],'maximumExactAnswer':'2305843008139952128','maximumCanonicalOperationCount':8388606}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'原闭区间NOT与编号求和规则完整，公开按int参数解释全部正索引及现有输入预算，不造小数值界；返回int不足显式提升精确64位。流式稳定基数事件排序覆盖最大操作数，逐开关/字典与闭式独立验证。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Direct switch-set toggling; independent parity dictionary with sorted distinct positions; huge repeated singleton cancellation and affine-permuted singleton arithmetic-series closed form.','exhaustiveSmallDomain':{'cases':exhaustive,'nativeSubprocessCases':exhaustive_native,'indices':[1,4],'operationsMin':0,'operationsMax':4},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Expedia4 frozen: {len(cases)} formal,163 oracle,{exhaustive} model exhaustive/{exhaustive_native} native; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
