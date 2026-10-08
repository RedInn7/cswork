#!/usr/bin/env python3
"""One pile per move: actual-state oracle and independent large rank closed forms."""
from pathlib import Path
from collections import deque
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,sys,re,io,math
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-bnp-2';BATCH='bnp-2-recovered';SEED=20261111
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='a0c036cb0c22b914da291bda95fafd7b1555215ec8e0c52373149053ba13c305'
SOURCE='fastprep/BNP/bnp-piles-of-boxes.md';BLOB='9d7fe68d1e92dd3cacb36693c201260f29c55c62'
SOURCE_SHA='1d12d4bc837247fb76884d52541723a1789b930e606bef28279e9951bf8c824d'
LIMIT=32*1024*1024;INTMAX=2147483647
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
unsigned readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();unsigned x=0;while(c>32&&c!=EOF){x=x*10+unsigned(c-'0');c=getchar_unlocked();}return x;}
int main(){
 unsigned n=readNumber();vector<unsigned>a(n);
 for(auto &v:a)v=readNumber();
 sort(a.begin(),a.end());
 long long answer=0,rank=0;
 for(unsigned i=0;i<n;i++){
  if(i && a[i]!=a[i-1])rank++;
  answer+=rank;
 }
 printf("%lld\n",answer);
}
'''
MUTANTS=[
 {'name':'错误按移除箱数而非动作数计费','language':'cpp','code':REFERENCE.replace('answer+=rank;','answer+=a[i]-a[0];')},
 {'name':'错误把同一高度所有堆合并成一步','language':'cpp','code':REFERENCE.replace('answer+=rank;','answer=rank;')},
 {'name':'错误把重复高度也当作一个新层级','language':'cpp','code':REFERENCE.replace('if(i && a[i]!=a[i-1])rank++;','if(i)rank++;')},
]
EDITORIAL='''## 原始规则与旧阻断纠正

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/BNP/bnp-piles-of-boxes.md明确规定每步选择当前最高的一堆，把它降低到当前严格低于最高的下一种高度。原例[5,2,1]先将5降到2，得到[2,2,1]；随后两个2各自降到1，需要两步，原文明确说each step is performed on only one pile。因此答案3没有矛盾，不能误读为一次降低整个同高层。目标是让所有堆高度相等，不能跨过当前严格次高直接降到更低高度，也不是逐个箱子计费。

原文没有数字约束。本站按Java int[]接口与箱数非负含义明确解释每堆0..2147483647，不能接受负箱数；0高度视为空堆是公开边界约定。n不增加人为的小上限，仅受现有单例32MiB标准输入传输预算约束。n=0返回0属于本站空集合数学扩展，不声称原文明确提供该保证。原返回long与大规模动作数一致。输入为n以及n个以空白分隔的高度。第一公开样例保留原[5,2,1]→3；另外两个公开样例为本站推导，不宣称来自原文。

## 思路

将高度升序排序。当前高度以下有多少种不同高度，就称为它的等级rank，最小高度的等级为0。扫描排序数组，只有遇到新的高度才把rank加1，把每堆的rank相加。

## 正确性证明

设最初不同高度为h0<h1<…<h(d−1)，第i种高度有ci堆。因为只能降低当前最高堆到当前严格次高，所有高度始终属于原高度集合。最低高度永远不会被降低，且在其上还有任何高度时不会消失；最终所有堆必定等于h0。

在hi为当前最高且尚未全部降低前，下一种严格较低高度hi−1仍有堆存在，因为它不能在更高堆未消失时被操作。所以任何初始高度为hi的堆，必须依次经过hi−1、hi−2、…、h0，每次正好降一层，恰需i步。选择哪个同高堆先降低只改变顺序，不改变总次数。所有合法完成过程总步数均为Σci·i，也即每堆等级之和。排序扫描求出的rank正是该等级，因此输出为所求最少步数。

## 复杂度与完整可传输域

原生排序时间O(nlog(n+1))，数组空间O(n)，排序栈O(log(n+1))。输入逐个解析后存入32位无符号数组，计算答案使用64位。每个高度至少一个数字并需分隔，在32MiB文本预算下n<2^24，原生数组小于64MiB；最坏动作数n(n−1)/2<2^47，64位有符号long long可安全覆盖，不能用32位累计。题包3秒、256MiB；本机实测只证明本地运行，不替代Linux沙箱。

## 独立验证

小oracle用BFS搜索完整有序状态：找当前最高和严格次高，对每个最高堆分别产生降低后的状态，以所有元素相等或空状态为终点，直接计算最少步数，不使用等级求和。穷举长度0..5、值0..2共364个数组，并对163唯一输入真实运行参考。中小正式例也由该状态搜索计算。

两个近32MiB压力使用独立闭式：0和1交替的数组，每个1只能且必须单独降一次，期望为1的数量；另一个输入是0..n−1的仿射排列，乘数与n互质，故每个高度恰出现一次，期望n(n−1)/2，远超32位。数字长度和闭式用于精确计算最大可传输n，不先构造数百万Python整数列表。负控分别把箱数差当次数、把整层视为一次、把重复值当新层级，全部正式例必须正常退出。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(a):
 assert all(0<=v<=INTMAX for v in a)
 raw=str(len(a))+'\n'+' '.join(map(str,a))+'\n';assert len(raw)<=LIMIT;return raw
def brute(a):
 state=tuple(a);queue=deque([(state,0)]);seen={state}
 while queue:
  state,d=queue.popleft();values=set(state)
  if len(values)<=1:return d
  maximum=max(values);second=max(x for x in values if x<maximum)
  for i,v in enumerate(state):
   if v==maximum:
    nxt=state[:i]+(second,)+state[i+1:]
    if nxt not in seen:seen.add(nxt);queue.append((nxt,d+1))
 raise AssertionError('unreachable')
def execute(binary,raw,profile=False):
 cmd=[str(binary)]
 if profile:cmd=['/usr/bin/time','-l' if sys.platform=='darwin' else '-v']+cmd
 start=time.perf_counter();p=subprocess.run(cmd,input=raw,text=True,capture_output=True,check=True,timeout=30);metrics={'wallSeconds':round(time.perf_counter()-start,5)}
 if profile:
  pattern=r'(\d+)\s+maximum resident set size' if sys.platform=='darwin' else r'Maximum resident set size \(kbytes\):\s*(\d+)';m=re.search(pattern,p.stderr);assert m,p.stderr
  metrics.update({'peakResidentBytes':int(m[1])*(1 if sys.platform=='darwin' else 1024),'hostPlatform':sys.platform,'method':'native /usr/bin/time','notLinuxSandboxEvidence':True})
 else:assert not p.stderr
 return p.stdout.strip(),metrics
def digit_sum(n):
 if n==0:return 0
 total=1;start=1;width=1
 while start<n:total+=(min(n,start*10)-start)*width;start*=10;width+=1
 return total
def max_size(mode):
 def size(n):return len(str(n))+1+(2*n if mode=='duplicates' else digit_sum(n)+n)
 lo,hi=1,LIMIT//2
 while lo<hi:
  mid=(lo+hi+1)//2
  if size(mid)<=LIMIT:lo=mid
  else:hi=mid-1
 assert size(lo)<=LIMIT<size(lo+1)
 return lo,size(lo)
def main():
 start=time.perf_counter();raw_source=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
 assert sha(raw_source)==SOURCE_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw_source).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=[[5,2,1],[5,5,2,1],[0,INTMAX],[],[0],[1],[INTMAX],[0,0],[INTMAX,INTMAX],[1,0,1,0],[3,3,3,1,1,0],[0,1,2,3],[3,2,1,0],[INTMAX,1,1,0]]
 keys={encode(a) for a in small};rng=random.Random(SEED)
 while len(small)<163:
  a=[rng.choice([0,1,2,3,10,INTMAX]) for _ in range(rng.randint(2,7))];raw=encode(a)
  if raw not in keys:keys.add(raw);small.append(a)
 cases=[];oracles=[];large=[]
 with tempfile.TemporaryDirectory(prefix='bnp2-native-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(6):
   for a in product(range(3),repeat=n):
    expected=brute(a);assert execute(binary,encode(a))[0]==str(expected);exhaustive+=1
  assert exhaustive==364
  for i,a in enumerate(small):
   raw=encode(a);expected=brute(a);assert execute(binary,raw)[0]==str(expected)
   oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
   if i<34:cases.append({'name':'原始样例' if i==0 else f'本站推导及状态搜索{i}','input':raw,'expectedOutput':str(expected)+'\n','hidden':i>=3,'weight':1})
  print('BNP2:364 exhaustive states and163 unique subprocess oracles passed',flush=True)
  for name,a,expected in [('中规模全等',[INTMAX]*10000,0),('三层重复',[0]*1000+[100]*2000+[INTMAX]*3000,8000),('有序互异',list(range(100000)),4999950000),('逆序互异',list(range(99999,-1,-1)),4999950000)]:
   raw=encode(a);assert execute(binary,raw)[0]==str(expected);cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  del a
  for mode in ('duplicates','distinct'):
   n,length=max_size(mode)
   if mode=='duplicates':raw=f'{n}\n'+('0 1 '* (n//2))+('0 ' if n%2 else '');raw=raw[:-1]+'\n';expected=n//2;extra={'pattern':'alternating0,1'}
   else:
    multiplier=65537
    while math.gcd(multiplier,n)!=1:multiplier+=2
    offset=123456%n;buffer=io.StringIO();buffer.write(f'{n}\n')
    for i in range(n):buffer.write(str((multiplier*i+offset)%n));buffer.write('\n' if i==n-1 else ' ')
    raw=buffer.getvalue();buffer.close();expected=n*(n-1)//2;extra={'multiplier':multiplier,'offset':offset,'gcd':math.gcd(multiplier,n),'bijectionRange':[0,n-1]}
   assert len(raw)==length and length<=LIMIT
   out,metrics=execute(binary,raw,True);assert out==str(expected)
   cases.append({'name':f'近32MiB-{mode}','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
   large.append({'name':mode,'n':n,'inputBytes':length,'expected':expected,'construction':extra,'oracle':'ones count for0/1; n(n-1)/2 for bijection of0..n-1','localMetrics':metrics})
   print(f'BNP2:{mode} n={n},bytes={length},expected={expected},metrics={metrics}',flush=True)
  kills=[]
  for i,m in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{i}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(m['code']);mb=Path(td)/f'mutant{i}';subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True)
   rejected=[j for j,c in enumerate(cases) if execute(mb,c['input'])[0]!=c['expectedOutput'].strip()];assert rejected
   kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 assert len({c['input'] for c in cases})==len(cases)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'逐堆降低到次高高度','difficulty':'中等','tags':['OA','BNP','排序','计数'],
 'description':'给定若干箱子堆。每一步只能选择当前最高的一堆，将它降低到当前严格小于最高高度的下一种高度。求使全部堆等高所需的最少步数。一次只改变一堆，不能整层同时处理，不能直接跳过次高高度。',
 'input':'第一行非负整数n，随后n个空白分隔的高度。依原Java int[]及非负箱数含义，本站解释高度为0..2147483647，0为空堆的公开约定。原文没有n数字上界；本站支持完整单例32MiB标准输入预算内的合法可传输数组，不另造小n上限。n=0为空集合，是本站数学扩展。',
 'output':'输出最少步数，使用64位整数。所有高度已经相同、只有一堆或没有堆时输出0。',
 'explanation':'第一例保留原[5,2,1]→3：5降到2一次，再分别将两个2降到1各一次。第二和第三公开例为本站推导：[5,5,2,1]→5，[0,2147483647]→1，箱子数量差不是动作数量。',
 'hints':['排序后相等的高度具有相同等级。','每堆都必须依次经过所有比它低的不同高度。','答案可能超过32位。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'每堆经过的不同高度层数','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':SOURCE_SHA}],'upstreamCodeExecuted':False,'corrections':['Original example explicitly says each step on only one pile; no simultaneous layer operation. Original[5,2,1]->3 preserved.'],'rangeDisclosure':'Nonnegative Java int heights0..2147483647 interpreted explicitly, zero/empty extensions disclosed. No invented n cap; full32MiB transport domain with native sorting and64bit answer.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'原文和样例明确每步只操作一堆，降低到严格次高，原3与规则一致。完整Java int非负箱数及32MiB可传输域公开披露，独立状态搜索及近预算闭式压力核验排序计数。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'BFS of actual maximum-pile to strict-next-height operations; huge cases independent counts/bijection closed forms.','exhaustiveSmallDomain':{'cases':exhaustive,'lengthMin':0,'lengthMax':5,'values':[0,1,2],'nativeReferenceSubprocessCases':exhaustive},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
 print(f'BNP2 frozen:{len(cases)}formal,163oracle,364exhaustive,3mutants;normalizedBytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
