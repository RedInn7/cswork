#!/usr/bin/env python3
"""Source-linked LC42 recovery: two pointers versus prefix/suffix and level cells."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-zolostays-2';BATCH='zolostays-2-recovered';SEED=20261117
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='fastprep/Zolostays/zolostays-trapping-rain-water.md'
RAW_SHA='1c114107a47579e823beae43124d6634c231c30deb6470a5bf72efa9bb5f91cc'
BLOB='0a6b8ad1cb53e98c4b1e9db9fd127d05660d75d2'
HASH='9972af7f32fd57f3ef16b4e350818394b8fb48cdf6642cd5f3ba8c1a8b53bd9c'
URL='https://leetcode.com/problems/trapping-rain-water/description/'
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;scanf("%d",&n);vector<int> h(n);for(int &x:h)scanf("%d",&x);
int left=0,right=n-1,leftMax=0,rightMax=0;long long answer=0;
while(left<=right){if(leftMax<=rightMax){leftMax=max(leftMax,h[left]);answer+=leftMax-h[left];++left;}else{rightMax=max(rightMax,h[right]);answer+=rightMax-h[right];--right;}}
printf("%lld\n",answer);}
'''
WRONG_PREFIX=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int main(){int n;scanf("%d",&n);vector<int>h(n),l(n),r(n);for(int &v:h)scanf("%d",&v);
for(int i=0;i<n;i++)l[i]=max(h[i],i?l[i-1]:0);for(int i=n-1;i>=0;i--)r[i]=max(h[i],i+1<n?r[i+1]:0);
long long answer=0;for(int i=0;i<n;i++)answer+=max(l[i],r[i])-h[i];printf("%lld\n",answer);}
'''
MUTANTS=[
 {'name':'错误取左右最高墙的较大者','language':'cpp','code':WRONG_PREFIX},
 {'name':'错误忘记扣除柱子占用高度','language':'cpp','code':REFERENCE.replace('answer+=leftMax-h[left]','answer+=leftMax').replace('answer+=rightMax-h[right]','answer+=rightMax')},
 {'name':'错误只看紧邻两根柱子','language':'cpp','code':r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;int main(){int n;scanf("%d",&n);vector<int>h(n);for(int &v:h)scanf("%d",&v);long long answer=0;for(int i=1;i+1<n;i++)answer+=max(0,min(h[i-1],h[i+1])-h[i]);printf("%lld\n",answer);}
'''},
]
EDITORIAL='''## 来源恢复与完整范围

固定上游 fastprep/Zolostays/zolostays-trapping-rain-water.md 的正文在“Given n non-negative integers repres”处截断，不能仅凭残文猜测宽度。它的starter明确提示“refert to LC42”，两组完整输入输出分别是[0,1,0,2,1,0,1,3,2,1,2,1]→6和[4,2,0,3,2,5]→9，且完整约束与官方LeetCode 42一致。本站沿这条明确交叉引用核对官方题面 https://leetcode.com/problems/trapping-rain-water/description/ ，恢复每根柱宽1、求雨后可接水总量的缺失定义。这不是凭同名题拼接规则，不声称截断raw本身保留了完整正文，也没有执行上游代码。

完整原范围1≤n≤20000、0≤height[i]≤100000保留，不扩展空数组。标准输入改编为n后跟n个高度，以空白分隔；输出积水的单位体积总数。两个原样例6/9保持，第三例[2,0,2]→2明确是本站补充。最大值由[100000,0,...,0,100000]达到，为19998×100000=1999800000，原int返回足够；参考使用64位累计以便清楚表达求和。

## 思路

某个位置能接的水等于min(左侧最高柱,右侧最高柱)−当前柱高（最高值包含当前柱）。一个方向没有更高墙时，水会流出，不能只看邻居或取两侧较大墙。

参考从左右两端相向处理，leftMax和rightMax分别是已处理前缀和后缀的最高柱，初值0。当leftMax≤rightMax，处理左侧下一根：若它超过leftMax，它不接水并更新左最高；否则其水位已经被左最高限定，而右边已有足够高的墙，贡献leftMax−height[left]。另一种情况对称处理右侧。直到全部位置处理完。

## 正确性证明

若leftMax≤rightMax且当前左柱不高于leftMax，则已处理右侧存在高度rightMax的墙（leftMax=rightMax=0时水量本来就是0），未知中间位置只可能增加另一侧最高值，不能降低它。因此左右最高值的较小者确定为leftMax，当前位置贡献被精确计算。若当前左柱高于leftMax，则左侧包含自身的最高值就是自身高度，所以该位置贡献0，更新leftMax正确。rightMax较小时完全对称。

每轮处理一个此前未处理的位置，不会漏算或重复。上述结论表明每轮贡献均正确；结束时所有位置已处理，累计值等于总积水量。

## 复杂度

读取和双指针遍历均为O(n)，存储输入数组O(n)，双指针额外空间O(1)。没有按高度逐层扫描参考算法，完整高度100000与长度20000可直接处理。

## 独立验证

oracle分别构建完整前缀/后缀最高值数组再逐点求和，不复用双指针状态。小域另逐层逐格检查左右是否各有一根达到该层的墙，直接计数水格；穷举长度1..6、高度0..2并逐个真实运行参考。163唯一oracle包含两个原例、本站例、固定种子随机与边界。正式满长用例覆盖零、最高平台、单调、最高双墙盆地、相邻峰/宽盆地、多盆地及随机高度；最大盆地用独立闭式1999800000复核。三个正常退出错误程序分别取较大墙、漏扣柱高、只看紧邻墙，每个都在全部正式例执行并记录反例。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(a):
 assert 1<=len(a)<=20000 and all(0<=v<=100000 for v in a)
 return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def prefix(a):
 left=[];m=0
 for v in a:m=max(m,v);left.append(m)
 right=[0]*len(a);m=0
 for i in range(len(a)-1,-1,-1):m=max(m,a[i]);right[i]=m
 return sum(min(x,y)-v for x,y,v in zip(left,right,a))
def cells(a):
 return sum(a[i]<level and any(v>=level for v in a[:i]) and any(v>=level for v in a[i+1:]) for level in range(1,max(a)+1) for i in range(len(a)))
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=10);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=[[0,1,0,2,1,0,1,3,2,1,2,1],[4,2,0,3,2,5],[2,0,2],[0],[100000],[0,100000],[100000,0],[100000,0,100000],[2,0,0,2],[3,0,1,0,3],[1,2,3],[3,2,1],[2,2,2],[0,2,0,0]]
 rng=random.Random(SEED);keys={encode(a) for a in small}
 while len(small)<163:
  a=[rng.randrange(11) for _ in range(rng.randint(1,18))];key=encode(a)
  if key not in keys:keys.add(key);small.append(a)
 oracles=[{'input':encode(a),'expectedOutput':str(prefix(a))+'\n'} for a in small]
 for a in small:
  if max(a)<=10:assert prefix(a)==cells(a)
 cases=[];large=[]
 def add(name,a,hidden=True,closed=None):
  expected=prefix(a)
  if closed is not None:assert expected==closed
  cases.append({'name':name,'input':encode(a),'expectedOutput':str(expected)+'\n','hidden':hidden,'weight':1})
 for i,a in enumerate(small[:28]):add(('原样例' if i<2 else '本站补充')+str(i+1),a,i>=3)
 add('完整上界最高盆地',[100000]+[0]*19998+[100000],closed=1999800000)
 add('完整长度全零',[0]*20000,closed=0)
 add('完整长度最高平台',[100000]*20000,closed=0)
 add('完整长度严格升序',list(range(20000)),closed=0)
 add('完整长度严格降序',list(range(19999,-1,-1)),closed=0)
 add('完整长度交替高峰',[100000,0]*10000,closed=999900000)
 add('完整长度多宽盆地',([100000]+[0]*9)*2000)
 add('完整长度中间高峰',[0]*9999+[100000]+[0]*10000,closed=0)
 add('完整长度非对称边墙',[99999]+[1]*19998+[100000],closed=19998*99998)
 add('完整长度随机全部高度',[rng.randrange(100001) for _ in range(20000)])
 add('完整长度锯齿宽平台',([100000]*30+[50000]*30+[0]*30)*222+[100000]*20)
 print(f'Zolostays2 prepared {len(cases)} formal; source-linked official statement checked; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='zolostays2-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(1,7):
   for a in product(range(3),repeat=n):
    expected=cells(a);assert expected==prefix(a);assert execute(binary,encode(a))[0]==str(expected);exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput'].strip()
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'].strip(),case['name']
   if case['name'].startswith('完整'):large.append({'name':case['name'],'n':20000,'inputBytes':len(case['input']),'expectedOutput':case['expectedOutput'].strip(),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, 163 unique oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput'].strip():rejected.append(j)
   assert rejected;kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Zolostays OA #2：接雨水','difficulty':'困难','tags':['双指针','前缀最大值','数组'],
 'description':'给定n根相邻柱子的非负高度，每根柱宽1，计算下雨后这些柱子之间能接住的水的总单位体积。两端没有额外墙，水可以流出。原始快照正文截断，但starter明确引用LC42；本站依据该官方题面补全宽度和积水定义，两个原样例及完整约束均与官方一致。',
 'input':'输入n，随后n个高度，空白分隔。完整原范围1≤n≤20000，0≤height[i]≤100000，不接收空数组。标准输入是本站对数组参数的适配。',
 'output':'输出所接雨水的总单位体积，精确整数，无取模。',
 'explanation':'两个原样例保留6和9；第三例[2,0,2]→2是本站补充。来源正文截断而非规则另有定义；补全依据为原starter明确引用的https://leetcode.com/problems/trapping-rain-water/description/，不是只凭题名推测。',
 'hints':['每个位置的水位由左右最高墙的较小值限制。','先算前后缀最高值可以得到独立的线性解法。','双指针每次结算已知较低边界的一端。'],
 'timeLimit':2,'memoryLimit':262144,'outputLimit':1024,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'左右最高边界与双指针结算','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'gitBlobSha':BLOB,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,'explicitCrossReference':{'rawLocation':'Starter Code comment explicitly mentions LC42','officialUrl':URL,'checkedDate':'2026-10-07','factsChecked':['Each bar has width1 and output is trapped water volume.','Original examples match [0,1,0,2,1,0,1,3,2,1,2,1]->6 and [4,2,0,3,2,5]->9.','Constraints match n1..20000 and heights0..100000.'],'provenanceNote':'Live official page checked directly, not represented as content of the fixed Git snapshot.'},'rangeDisclosure':'Full original bounds preserved. No empty-array extension or narrower maximum.','corrections':['Truncated raw statement is supplemented only through its explicit official LC42 reference. No original sample output changed. Third public sample is authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'原starter明确引用LC42，两个原例及完整约束与官方一致，沿可核查交叉引用补全截断的每柱宽1积水定义；全域双指针与独立前后缀/逐层水格核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Independent complete prefix/suffix maxima; exhaustive unit water cells with explicit left/right wall existence; maximum-basin closed form.','exhaustiveSmallDomain':{'cases':exhaustive,'nMin':1,'nMax':6,'heights':[0,1,2]},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Zolostays2 frozen: {len(cases)} formal,163 oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
