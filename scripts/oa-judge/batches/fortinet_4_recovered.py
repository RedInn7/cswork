#!/usr/bin/env python3
"""Signal snapshots: literal sweeps versus last-zero streaming native reference."""
from pathlib import Path
from itertools import permutations
import hashlib,json,random,subprocess,tempfile,time,sys,re,io,heapq
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-fortinet-4';BATCH='fortinet-4-recovered';SEED=20261113
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='449883ceb1d0b848034e5ae1b0d87f874fea7c70dcbb8ddcbdca3913ed141cd5'
SOURCE='fastprep/Fortinet/fortinet-get-required-sweeps.md'
BLOB='c1fea683b694e17650a77aed7289df4fabe8084d'
SOURCE_SHA='85d322d8e6823cb91966f70a4fec3143da67f3f004f7f16749ff881c5d9d2e9c'
LIMIT=32*1024*1024
REFERENCE=r'''#include <cstdio>
#include <vector>
using namespace std;
int readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();int x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return x;}
int main(){int n=readNumber(),last=n;vector<unsigned char>seen(n+1,0);
for(int k=1;k<=n;k++){int p=readNumber();seen[p]=1;while(last>0&&seen[last])last--;int answer=k-(n-last)+1;printf("%d%c",answer,k==n?'\n':' ');}if(n==0)putchar('\n');}
'''
PERSIST=r'''#include <cstdio>
int main(){int n;scanf("%d",&n);int ones=0;for(int k=1;k<=n;k++){int p;scanf("%d",&p);int answer=1;if(p<=n-ones){ones++;if(p<n-ones+1)answer=2;}printf("%d%c",answer,k==n?'\n':' ');}if(n==0)putchar('\n');}
'''
MUTANTS=[
 {'name':'错误漏计最后无交换的停止轮','language':'cpp','code':REFERENCE.replace('k-(n-last)+1','k-(n-last)')},
 {'name':'错误用最右零的位置代替其前方1的数量','language':'cpp','code':REFERENCE.replace('k-(n-last)+1','last>0?last+1:1')},
 {'name':'错误保留上次排序结果再应用下一次ping','language':'cpp','code':PERSIST},
]
EDITORIAL='''## 原始规则与样例消歧

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Fortinet/fortinet-get-required-sweeps.md说明n个二进制信号初始全0，每个位置恰好ping一次，使其变1。每次评估从左到右顺次检查相邻格，遇10立即交换，完整一轮没有交换才停止。原样例ping=[1,2,4,3]返回[2,3,3,1]，完整保留。

本站明确记录两项由原样例消歧的约定：位置1-based，ping是1..n的排列；每次对截至当前累计ping的位图副本计算排序轮数，排序不永久改变信号位图。若把上次排序结果写回，第一次1000变0001，第二次ping2后0101只需2轮，与原第二项3矛盾。最后一次全1已经有序仍返回1，明确最终无交换的检查轮也计数。左到右交换是原地顺序进行，一个1在一轮内可以连续越过多个0，不是所有相邻交换并行执行。

catalog旧题解声称每个1每轮至多右移一格，与原文左到右原地扫描不符；其附解对原例首项算出3而非2，且漏计停止轮。本站重新编写参考和题解，不沿用该错误实现：1000的一次sweep依次变0100、0010、0001，同一个1在同一轮确实右移三格，下一轮无交换后总轮数2。

原文没有n数值上限。本站不补造100000等限制，而覆盖现有32MiB标准输入预算内的全部合法排列：第一行n，随后n个空白分隔的1..n整数，每个恰出现一次。n=0接受为空排列，输出空行，是本站公开的数学扩展，不声称原文明确给出。其它公开例为本站推导。源图片指向作者本机文件，未作为可访问证据或执行上游代码。

## 思路

维护累计ping的位图、最右侧仍为0的位置last（若已无0则为0）。已ping数量为k，last右侧的n−last个位置都是1，其余k−(n−last)个1位于某个0之前。答案是k−(n−last)+1。每次把新位置置1，持续左移last直至它指向0；指针全程最多移动n次。输入和输出均流式处理，不保存所有答案。

## 正确性证明

固定一次累计位图，考虑任意一个0。在一次从左到右的原地sweep中，如果它左侧仍有1，最靠近它的1会通过沿途0一直向右推进，最终与这个0交换；交换后扫描已越过该0，因此该0在本轮恰好左移一次。如果它左侧没有1，则不会移动。所以该0要消除左侧所有1，所需交换轮数恰等于初始在它左侧的1数量。

数组有序当且仅当所有0的左侧都没有1。每个0每轮按上述规则减少一个阻碍，因此交换轮数等于各0左侧1数量的最大值；这个最大值在最右侧0处取得。再加最终无交换的停止轮即答案。若已经没有0，最大值按0计，答案为1。

处理第k次ping后总共有k个1，而最右零右侧恰有n−last个1，故它左侧有k−(n−last)个1。位图记录所有且仅已ping的位置，指针左移恰好跳过新形成的全1后缀，所以参考实现计算的正是所证明的答案。每轮只在位图副本上定义排序效果，实际算法不破坏原ping状态。

## 复杂度与传输容量

时间O(n)，额外空间O(n)字节，输出逐项打印。每位置写入一次，last最多下降n次。n和答案均能用32位整数表示：32MiB文本中的n项不同正整数形成完整排列，其最大n约4333190，不可能接近Java int上限。原源无上界，这里仅做既有传输预算推导，不把该数写成额外原约束。

对第k<n步，答案≤k+1，最后一步为1。因此各答案的十进制长度总和不大于输入排列1..n的数字长度总和，输出预算不会超过同等输入数字主体。参考3秒/256MiB、输出64MiB；正式题包总字节另受导入和Git文件限制。只保留一组最大输入和输出案例，避免重复堆叠超过100MiB。

## 独立验证

小oracle每次真实复制累计位图，循环执行所有相邻原地交换直到无交换，直接数轮；不使用最右零公式。166唯一输入（6个原例/边界及160个固定种子随机排列）真实运行原生参考，另枚举n=0..6全部874个排列并逐例运行。中规模独立oracle用最大堆追踪剩余0位置、Fenwick树查询其左侧1数量，与参考单调指针实现不同。

最大合法标准编码排列采用递增1..n，答案独立闭式为2,3,…,n,1；逆序排列答案全1。其它压力含十万规模随机、交错及延迟ping末位，检查长后缀跳跃和早期ping边界。所有正式输入验证为排列，三个负控分别漏停止轮、用零位置替代前置1数量、破坏累计位图保留排序结果，必须正常退出才能计为击杀。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(p):
 assert sorted(p)==list(range(1,len(p)+1))
 raw=str(len(p))+'\n'+' '.join(map(str,p))+'\n';assert len(raw)<=LIMIT;return raw
def direct(p):
 a=[0]*len(p);out=[]
 for pos in p:
  a[pos-1]=1;b=a[:];sweeps=0
  while True:
   changed=False;sweeps+=1
   for j in range(len(b)-1):
    if b[j]==1 and b[j+1]==0:b[j],b[j+1]=b[j+1],b[j];changed=True
   if not changed:break
  out.append(sweeps)
 return out
def fenwick(p):
 n=len(p);bit=[0]*(n+1);active=bytearray(n+1);zeros=list(range(-n,0));heapq.heapify(zeros);out=[]
 for x in p:
  active[x]=1;i=x
  while i<=n:bit[i]+=1;i+=i&-i
  while zeros and active[-zeros[0]]:heapq.heappop(zeros)
  i=-zeros[0] if zeros else 0;total=0
  while i:total+=bit[i];i-=i&-i
  out.append(total+1)
 return out
def output(a):return ' '.join(map(str,a))+'\n'
def execute(binary,raw,profile=False):
 cmd=[str(binary)]
 if profile:cmd=['/usr/bin/time','-l' if sys.platform=='darwin' else '-v']+cmd
 start=time.perf_counter();p=subprocess.run(cmd,input=raw,text=True,capture_output=True,check=True,timeout=30);metrics={'wallSeconds':round(time.perf_counter()-start,5)}
 if profile:
  pattern=r'(\d+)\s+maximum resident set size' if sys.platform=='darwin' else r'Maximum resident set size \(kbytes\):\s*(\d+)';m=re.search(pattern,p.stderr);assert m,p.stderr
  metrics.update({'peakResidentBytes':int(m[1])*(1 if sys.platform=='darwin' else 1024),'hostPlatform':sys.platform,'method':'native /usr/bin/time','notLinuxSandboxEvidence':True})
 else:assert not p.stderr
 return p.stdout.strip(),metrics
def digits(n):
 total=0;lo=1;width=1
 while lo<=n:total+=(min(n+1,lo*10)-lo)*width;lo*=10;width+=1
 return total
def main():
 started=time.perf_counter();raw_source=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT);assert sha(raw_source)==SOURCE_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw_source).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=[[1,2,4,3],[4,3,2,1],[1],[],[1,2],[2,1]];keys={encode(p) for p in small};rng=random.Random(SEED)
 while len(small)<166:
  p=list(range(1,rng.randint(3,11)+1));rng.shuffle(p);raw=encode(p)
  if raw not in keys:keys.add(raw);small.append(p)
 cases=[];oracles=[];large=[]
 with tempfile.TemporaryDirectory(prefix='fortinet4-native-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(7):
   for p in permutations(range(1,n+1)):
    expected=direct(p);assert expected==fenwick(p);assert execute(binary,encode(p))[0]==output(expected).strip();exhaustive+=1
  assert exhaustive==874
  for i,p in enumerate(small):
   expected=direct(p);assert expected==fenwick(p);raw=encode(p);assert execute(binary,raw)[0]==output(expected).strip();oracles.append({'input':raw,'expectedOutput':output(expected)})
   if i<31:cases.append({'name':'原始样例' if i==0 else f'本站边界及真实sweep{i}','input':raw,'expectedOutput':output(expected),'hidden':i>=3,'weight':1})
  print('Fortinet4:166 unique literal sweep oracles and874 exhaustive native cases passed',flush=True)
  for mode in ('descending','ascending','random','interleaved','last-delayed'):
   n=100000;p=list(range(1,n+1))
   if mode=='descending':p.reverse()
   if mode=='random':rng.shuffle(p)
   if mode=='interleaved':p=p[::2]+p[1::2]
   if mode=='last-delayed':p=list(range(n-1,0,-1))+[n]
   expected=fenwick(p)
   if mode=='descending':assert expected==[1]*n
   if mode in ('ascending','last-delayed'):assert expected==list(range(2,n+1))+[1]
   raw=encode(p);assert execute(binary,raw)[0]==output(expected).strip();cases.append({'name':f'十万规模-{mode}','input':raw,'expectedOutput':output(expected),'hidden':True,'weight':1})
  del p,expected
  def size(n):return len(str(n))+1+digits(n)+n
  lo,hi=1,LIMIT//2
  while lo<hi:
   mid=(lo+hi+1)//2
   if size(mid)<=LIMIT:lo=mid
   else:hi=mid-1
  n=lo;assert size(n)<=LIMIT<size(n+1)
  buf=io.StringIO();buf.write(f'{n}\n')
  for i in range(1,n+1):buf.write(str(i));buf.write('\n' if i==n else ' ')
  raw=buf.getvalue();buf.close();assert len(raw)==size(n)
  buf=io.StringIO()
  for i in range(2,n+1):buf.write(str(i));buf.write(' ')
  buf.write('1\n');expected=buf.getvalue();buf.close()
  actual,metrics=execute(binary,raw,True);assert actual==expected.strip();del actual
  cases.append({'name':'32MiB预算最大递增排列','input':raw,'expectedOutput':expected,'hidden':True,'weight':1})
  large.append({'name':'largest-canonical-permutation','n':n,'inputBytes':len(raw),'outputBytes':len(expected),'oracle':'ascending permutation:2,3,...,n,1','nextNInputBytes':size(n+1),'localMetrics':metrics})
  print(f'Fortinet4:largest n={n},input={len(raw)},output={len(expected)},metrics={metrics}',flush=True)
  kills=[]
  for i,m in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{i}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(m['code']);mb=Path(td)/f'mutant{i}';subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True)
   rejected=[j for j,c in enumerate(cases) if execute(mb,c['input'])[0]!=c['expectedOutput'].strip()];assert rejected;kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 assert len({c['input'] for c in cases})==len(cases)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'每次信号ping后的冒泡扫描轮数','difficulty':'中等','tags':['OA','Fortinet','数组','双指针'],
 'description':'n个信号初始为0，ping是位置1..n的排列，依次将对应信号置1。每次在累计信号位图的副本上，从左到右原地交换相邻10，直到完整一轮没有交换。输出每次所需轮数，包含最后无交换的停止轮；排序不改变后续ping使用的累计位图。',
 'input':'第一行非负整数n，随后n个空白分隔的1..n整数，每个位置恰好出现一次。原文没有n数字上界，本站覆盖现有每例32MiB输入预算内所有合法可传输排列，不另造小n限制。n=0为空排列，是本站公开数学扩展。',
 'output':'按ping顺序输出n个扫描轮数，以空白分隔。已排序的位图仍需一轮无交换检查；n=0输出空行。',
 'explanation':'原例[1,2,4,3]→[2,3,3,1]保留。累计位图依次1000、1100、1101、1111。最后1证明停止轮计数；第二项3证明每次评估累计位图的副本，而非保留上次排序结果。这两点作为原例推导的本站明确协议披露。其它公开例为本站推导。',
 'hints':['每轮每个尚有1在前的0恰好左移一格。','最右侧0前方的1最多。','维护累计1数及末尾全1后缀。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':65536,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'最右零之前的累计1数量','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':SOURCE_SHA}],'upstreamCodeExecuted':False,'corrections':['Original[1,2,4,3]->[2,3,3,1] retained. Terminal no-swap sweep included.','Cumulative signal snapshot evaluated non-destructively, as implied by sample second answer3; persistent sorted-state interpretation gives2.'],'rangeDisclosure':'No original n numerical maximum; complete32MiB input transport domain, permutation1..n. Empty permutation is disclosed mathematical extension.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'原文明确左到右相邻交换，原样例确定停止轮计数及累计位图副本评估；公开披露样例消歧。原生O(n)覆盖32MiB完整可传输排列，真实sweep独立oracle与最大排列闭式验证。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':166,'uniqueOracleInputs':len(keys),'randomOracleCases':160,'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Literal repeated left-to-right adjacent swapping on cumulative snapshots; medium max-zero heap and Fenwick prefix count; maximum ascending closed form.','exhaustiveSmallDomain':{'cases':exhaustive,'nMin':0,'nMax':6,'nativeReferenceSubprocessCases':exhaustive},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Fortinet4 frozen:{len(cases)}formal,166oracle,874exhaustive,3mutants;normalizedBytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
