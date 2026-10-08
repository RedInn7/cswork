#!/usr/bin/env python3
"""Final prices: reverse reference, literal forward oracle, forward lazy tree at scale."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-weride-1';BATCH='weride-1-recovered';SEED=20261115
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='c03717e5ddb978388ce85e7ba31e60cea385b7381e4aa3fbd65ba3fd4b94ea4d'
SOURCES=[('OA LIST/WeRide_OA/001_image.txt','e2d0711aaabad71c9fae303e99dc336402d799db','b22ca00eeb2c11c5fab0681c990650756648753083284cac3f448bc92d5a40d8'),('OA LIST/WeRide_OA/005_image.txt','e2b126399cebead00039f748005bca516d4b6257','07279a0003bf4cbd0c90828e8e25d9072f51b59e1191c184945172cccf2d0340'),('OA LIST/WeRide_OA/006_image.txt','8a07e1e22741fd28adbc23ee7347b4f6f6a985f7','df8c8168f61e6a5ba1abddeca39756d8fb32066cc3175e0ff52d196832019e90')]
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
long long readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();bool negative=c=='-';if(negative)c=getchar_unlocked();long long x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return negative?-x:x;}
struct Query{int type,x,value;};
int main(){int n=readNumber();vector<int>a(n);for(int &x:a)x=readNumber();int q=readNumber();vector<Query>queries(q);for(auto &x:queries){x.type=readNumber();x.x=readNumber();x.value=readNumber();}
vector<unsigned char>done(n,0);int floor=0;
for(int i=q-1;i>=0;i--){auto x=queries[i];if(x.type==2)floor=max(floor,x.x);else if(!done[x.x-1]){a[x.x-1]=max(x.value,floor);done[x.x-1]=1;}}
for(int i=0;i<n;i++){if(!done[i])a[i]=max(a[i],floor);printf("%d%c",a[i],i==n-1?'\n':' ');}}
'''
MUTANTS=[
 {'name':'错误使用全局查询第三占位字段作为阈值','language':'cpp','code':REFERENCE.replace('floor=max(floor,x.x)','floor=max(floor,x.value)')},
 {'name':'错误让更早单点赋值覆盖更晚赋值','language':'cpp','code':REFERENCE.replace('else if(!done[x.x-1])','else if(true)')},
 {'name':'错误把所有历史全局下限应用于最终单点价格','language':'cpp','code':REFERENCE.replace('if(!done[i])a[i]=max(a[i],floor);','a[i]=max(a[i],floor);')},
]
EDITORIAL='''## 原始来源、完整范围与协议适配

固定提交e66f809f4c953bce129f68491726176615db6afc的OA LIST/WeRide_OA/001、005、006给出getFinalPrice：操作1 x v把第x件商品价格直接赋值为v，可以降低价格；操作2 v r把所有小于v的价格提高到v，相当于对每个价格取max(price,v)。操作按输入顺序执行。

005完整约束：1≤n,q≤200000，0≤price[i],v≤1000000000，1≤x≤n。不能借同义题的本站100000/正数界缩小范围。每个查询始终三列；001把type2写为2 v v，005明确写2 v r，006的说明也出现2 11 1。因此第二列是阈值，第三列不参与所定义的全局操作，不能额外要求第三列等于第二列。原函数为int queries[q][3]且没有为r列提供范围，本站明确按Java int解释这个占位字段为−2147483648..2147483647并忽略，不冒称原题列出了此十进制约束。

本站标准输入明确整理为：n、一行n个价格、q、q行三整数查询。保留原数组和查询参数，省略OCR排版中固定列数3等元数据，不将破损STDIN表格当成新的查询。索引1-based。

公开例1保留001的[7,5,4]及三查询，输出[8,9,8]。公开例2保留006 Sample0的五查询：第一步把第三项3变4，第二步把末项5变1，第三步全局下限3后应为[3,3,4,4,3]；随后单点1赋1、单点2赋2，最终[1,2,4,4,3]。原输出第三项写3错误，原中间步骤也漏更新/错写，本站依据明确操作纠正，不修改输入来迎合错例。公开例3采用006 Sample1实际STDIN的2 8 8、2 11 11，输出四个11不变；说明另写2 11 1与STDIN不一致，但第三列无效，两种均应得到四个11，绝不把末项保留1。另用隐藏例覆盖这个不同占位。

## 思路

从后往前扫描查询，维护目前已遇到的所有全局提高阈值的最大值floor。对每个商品，只处理逆序中第一次遇到的单点赋值，它就是正序最后一次单点赋值，最终价格为max(该赋值,floor)。更早的单点赋值忽略。全部扫描结束后，从未被赋值的商品取max(初始价格,floor)。

## 正确性证明

对一个固定商品，如果有单点赋值，正序最后一次赋值会覆盖该商品此前所有状态，因此此前初始价格、其它单点和全局操作都不再影响它。该最后赋值之后只剩全局提高；依次与多个阈值取max，等于与其中最大阈值取max。逆序遇到该最后赋值时，floor恰好包含它之后的全局阈值，得到正确最终值；标记完成后忽略更早操作也正确。

若商品从未单点赋值，则它的初始值只经历全局取max。逆序扫描结束的floor包含全部全局阈值，与初始值取max即最终结果。所有商品分别满足上述两种情况，故输出数组正确。初始floor=0合法，因为价格和有效阈值均非负；第三占位字段完全不参与floor。

## 复杂度

参考时间O(n+q)，空间O(n+q)用于价格、完成标记和原查询数组，不递归。所有有效价格始终位于0..1000000000，32位可表示；解析第三列用64位中间数，避免解析INT_MIN绝对值时溢出，再存原int字段。完整n/q范围下远低于256MiB；题包3秒、输出64MiB以容纳20万项结果。

## 独立验证

小oracle按正序逐个执行：单点直接改数组，type2直接扫描全部价格取max。不复用逆序算法。163唯一小例真实执行参考，另穷举n=1..2、初始值0..2、最多3个查询的正序状态，并与独立懒标记树对照。

大域oracle仍按正序，使用仅含全局下限懒标记的二叉树：全局提高只更新根标记；单点赋值前将沿途祖先标记下推，然后覆盖该叶，最后向下传播取所有叶值。这与参考逆序最后赋值/后缀最大值实现不同。满n=q=200000覆盖全局提高、每点赋值、反复覆盖同点、全局1e9后末尾赋0、无单点、随机全部范围及INT_MIN/INT_MAX占位；结构化数据另做闭式核对。三个负控分别误用占位阈值、取较早单点赋值、将过去全局下限错误套到后来低价，均在全部正式例上正常退出才计击杀。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(a,queries):
 n=len(a);assert 1<=n<=200000 and 1<=len(queries)<=200000 and all(0<=v<=10**9 for v in a)
 for t,x,v in queries:
  assert (t==1 and 1<=x<=n and 0<=v<=10**9) or (t==2 and 0<=x<=10**9 and -2**31<=v<2**31)
 return str(n)+'\n'+' '.join(map(str,a))+'\n'+str(len(queries))+'\n'+''.join(f'{t} {x} {v}\n' for t,x,v in queries)
def brute(a,queries):
 a=a[:]
 for t,x,v in queries:
  if t==1:a[x-1]=v
  else:a=[max(z,x) for z in a]
 return a
def lazy(a,queries):
 n=len(a);size=1
 while size<n:size*=2
 tree=[0]*(2*size);tree[size:size+n]=a
 for t,x,v in queries:
  if t==2:tree[1]=max(tree[1],x)
  else:
   node=1;left=0;right=size
   while node<size:
    floor=tree[node];tree[node*2]=max(tree[node*2],floor);tree[node*2+1]=max(tree[node*2+1],floor);tree[node]=0
    mid=(left+right)//2
    if x-1<mid:node*=2;right=mid
    else:node=node*2+1;left=mid
   tree[node]=v
 for node in range(1,size):
  tree[node*2]=max(tree[node*2],tree[node]);tree[node*2+1]=max(tree[node*2+1],tree[node])
 return tree[size:size+n]
def output(a):return ' '.join(map(str,a))+'\n'
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def main():
 start=time.perf_counter();evidence=[]
 for path,blob,h in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==h
  assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==blob;evidence.append({'path':path,'gitBlobSha':blob,'rawSha256':h})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=[([7,5,4],[(2,6,6),(1,2,9),(2,8,8)]),([1,2,3,4,5],[(1,3,4),(1,5,1),(2,3,3),(1,1,1),(1,2,2)]),([9,6,3,1],[(2,8,8),(2,11,11)]),([9,6,3,1],[(2,8,8),(2,11,1)]),([0],[(2,0,-2**31)]),([0],[(2,10**9,2**31-1),(1,1,0)]),([10**9],[(1,1,0),(1,1,1),(1,1,0)]),([1,2],[(2,0,10**9)]),([0,0],[(2,10**9,-1)])]
 rng=random.Random(SEED);keys={encode(a,q) for a,q in small}
 while len(small)<163:
  n=rng.randint(1,8);a=[rng.choice([0,1,2,100,10**9]) for _ in range(n)];queries=[]
  for _ in range(rng.randint(1,12)):
   queries.append((1,rng.randint(1,n),rng.choice([0,1,9,10**9])) if rng.randrange(2) else (2,rng.choice([0,1,9,10**9]),rng.choice([-2**31,-1,0,1,2**31-1])))
  raw=encode(a,queries)
  if raw not in keys:keys.add(raw);small.append((a,queries))
 exhaustive=0
 for n in (1,2):
  choices=[(1,x,v) for x in range(1,n+1) for v in range(3)]+[(2,v,-1) for v in range(3)]
  for initial in product(range(3),repeat=n):
   for count in (1,2,3):
    for queries in product(choices,repeat=count):assert brute(list(initial),queries)==lazy(list(initial),queries);exhaustive+=1
 cases=[];oracles=[];large=[]
 with tempfile.TemporaryDirectory(prefix='weride1-native-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  for i,(a,queries) in enumerate(small):
   raw=encode(a,queries);expected=brute(a,queries);assert expected==lazy(a,queries);assert execute(binary,raw)[0]==output(expected).strip();oracles.append({'input':raw,'expectedOutput':output(expected)})
   if i<31:cases.append({'name':f'原OCR公开例{i+1}' if i<3 else f'正序独立模型{i}','input':raw,'expectedOutput':output(expected),'hidden':i>=3,'weight':1})
  print(f'WeRide1:163 unique subprocess oracles and{exhaustive} exhaustive states passed',flush=True)
  for mode in ('all-global','all-assign','repeated-low-last','global-then-lower','zero-floor','random-full-domain','single-item-full-q'):
   n=1 if mode=='single-item-full-q' else 200000;a=[rng.randrange(10**9+1) for _ in range(n)];q=200000;closed=None
   if mode=='all-global':queries=[(2,10**9-i,-2**31 if i%2 else 2**31-1) for i in range(q)];closed=[10**9]*n
   elif mode=='all-assign':queries=[(1,i+1,10**9-i) for i in range(q)];closed=[10**9-i for i in range(n)]
   elif mode=='repeated-low-last':queries=[(2,10**9,0) if i%2==0 else (1,1,0) for i in range(q)];closed=[0]+[10**9]*(n-1)
   elif mode=='global-then-lower':queries=[(2,10**9,-1)]+[(1,i,0) for i in range(1,n)];closed=[0]*(n-1)+[10**9]
   elif mode=='zero-floor':a=[0]*n;queries=[(2,0,2**31-1 if i%2 else -2**31) for i in range(q)];closed=[0]*n
   elif mode=='single-item-full-q':queries=[(2,10**9,-2**31) if i%2==0 else (1,1,i) for i in range(q)];closed=[q-1]
   else:queries=[(1,rng.randint(1,n),rng.randrange(10**9+1)) if rng.randrange(2) else (2,rng.randrange(10**9+1),rng.randrange(-2**31,2**31)) for _ in range(q)]
   raw=encode(a,queries);expected=lazy(a,queries)
   if closed is not None:assert expected==closed
   out,seconds=execute(binary,raw);assert out==output(expected).strip();cases.append({'name':f'完整范围-{mode}','input':raw,'expectedOutput':output(expected),'hidden':True,'weight':1})
   large.append({'name':mode,'n':n,'q':q,'inputBytes':len(raw),'outputSha256':sha(output(expected)),'closedFormChecked':closed is not None,'oracle':'forward lazy binary tree: global chmax tag, push-to-leaf before overwrite','localSeconds':seconds})
  kills=[]
  for i,m in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{i}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(m['code']);mb=Path(td)/f'mutant{i}';subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True)
   rejected=[j for j,c in enumerate(cases) if execute(mb,c['input'])[0]!=c['expectedOutput'].strip()];assert rejected;kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 assert len({c['input'] for c in cases})==len(cases)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'单点赋值与全局价格下限','difficulty':'中等','tags':['OA','WeRide','逆序处理','数组'],
 'description':'给定商品价格数组，按顺序执行三列查询。1 x v：将第x件商品价格直接赋为v，可以降低；2 v r：将所有价格取max(price,v)，第三列r为不使用的占位。输出全部查询后的价格。',
 'input':'依次输入n、n个初始价格、q、q行三整数查询。完整原范围1≤n,q≤200000，0≤初始价格及有效v≤1000000000，单点索引1≤x≤n。type2第三占位原文未单列数值界，本站按原Java int[][]解释为−2147483648..2147483647，忽略其值，不要求等于阈值。标准输入是对原函数参数的明确整理。',
 'output':'按商品原顺序输出n个最终价格，以空白分隔。',
 'explanation':'001原例保留8 9 8。006 Sample0原输出第三项3错误，按原五查询应为1 2 4 4 3；全局下限3的中间状态应为3 3 4 4 3，后续单点可再降低。Sample1四个11正确，原解释最后保留1错误；type2第三列写1或11均不影响结果。完整纠错依据见题解。',
 'hints':['只需关心每个商品最后一次单点赋值。','逆序扫描时，全局阈值只影响尚未确定的商品。','第三占位字段不是索引，也不是阈值。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':65536,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'最后赋值与其后的最大下限','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':evidence,'upstreamCodeExecuted':False,'corrections':['006 Sample0 final third entry corrected3->4; global-floor intermediate and subsequent assignment explanations corrected.','006 Sample1 final four11 preserved; erroneous final1 in explanation corrected.','001type2 v v,005type2 v r,006mixed third field: unused third integer must not be constrained to equal second.'],'rangeDisclosure':'005 original n,q1..200000, prices/effective v0..1e9, x1..n preserved. Unspecified type2 placeholder uses full signed Java int range explicitly; no narrower bounds borrowed from other site problems.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'固定001/005/006完整定义单点赋值与全局max及20万/零值范围，明确第三占位并纠正确定错例。逆序O(n+q)与正序逐元素/懒标记树独立核验覆盖完整域。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Literal forward array updates; independently forward lazy binary tree with global tags pushed before point overwrite; structured full-scale closed forms.','exhaustiveSmallDomain':{'cases':exhaustive,'nMin':1,'nMax':2,'initialValues':[0,1,2],'qMin':1,'qMax':3},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
 print(f'WeRide1 frozen:{len(cases)}formal,163oracle,{exhaustive}exhaustive,3mutants;normalizedBytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
