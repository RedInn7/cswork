#!/usr/bin/env python3
"""Diagonal-preserving in-place rotation with independent coordinate oracle."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,re,io
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-capital-one-18';BATCH='capitalone-18-recovered';SEED=20261120
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='fastprep/Capital One/capitalone-rotate-matrix-over-diagonals.md'
RAW_SHA='8e6ca47424674f2f26049d6b71fe31ac3e405ea24c0af3c391bb73251635733e'
BLOB='7ccbc3f25186c213d64b56e10ac9679935eceb65'
HASH='4631be22e5fed9687a71287ca88766e29a33d92a2e74c3c04e755e87583c2453'
IMAGE_HASHES=['78657eb17330d8c43648af650113cf6029cdb0c77b658591ecf9d5bbf42297e2','8f01d13eb3b83dc02c2c1d9f9cfe16ba4cefff3403285cad1d6b53afeaaf33ed']
REFERENCE=r'''#include <cstdio>
#include <cstdint>
#include <vector>
using namespace std;
int64_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();bool negative=c=='-';if(c=='-'||c=='+')c=getchar_unlocked();int64_t value=0;while(c>32&&c!=EOF){value=value*10+c-'0';c=getchar_unlocked();}return negative?-value:value;}
int main(){int n=int(readNumber()),turns=int(readNumber());vector<int32_t>a(size_t(n)*n);for(auto &v:a)v=int32_t(readNumber());turns%=4;
for(int step=0;step<turns;step++)for(int r=0;r<n/2;r++)for(int c=r+1;c<n-1-r;c++){
size_t p=size_t(r)*n+c,q=size_t(c)*n+n-1-r,u=size_t(n-1-r)*n+n-1-c,v=size_t(n-1-c)*n+r;
int32_t saved=a[p];a[p]=a[v];a[v]=a[u];a[u]=a[q];a[q]=saved;}
for(int r=0;r<n;r++)for(int c=0;c<n;c++)printf("%d%c",int(a[size_t(r)*n+c]),c+1==n?'\n':' ');}
'''
ROTATE_ALL=r'''#include <cstdio>
#include <cstdint>
#include <vector>
#include <algorithm>
using namespace std;
int64_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();bool neg=c=='-';if(c=='-'||c=='+')c=getchar_unlocked();int64_t x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return neg?-x:x;}
int main(){int n=readNumber(),t=readNumber();vector<int32_t>a(size_t(n)*n);for(auto &x:a)x=readNumber();for(int k=0;k<t%4;k++){for(int r=0;r<n;r++)for(int c=r+1;c<n;c++)swap(a[size_t(r)*n+c],a[size_t(c)*n+r]);for(int r=0;r<n;r++)reverse(a.begin()+size_t(r)*n,a.begin()+size_t(r+1)*n);}for(int r=0;r<n;r++)for(int c=0;c<n;c++)printf("%d%c",int(a[size_t(r)*n+c]),c+1==n?'\n':' ');}
'''
MUTANTS=[
 {'name':'错误把两条对角线也跟着旋转','language':'cpp','code':ROTATE_ALL},
 {'name':'错误逆时针旋转非对角元素','language':'cpp','code':REFERENCE.replace('a[p]=a[v];a[v]=a[u];a[u]=a[q];a[q]=saved;','a[p]=a[q];a[q]=a[u];a[u]=a[v];a[v]=saved;')},
 {'name':'错误把旋转周期当成2','language':'cpp','code':REFERENCE.replace('turns%=4','turns%=2')},
]
EDITORIAL='''## 原始规则、图片与输入适配

固定 fastprep/Capital One/capitalone-rotate-matrix-over-diagonals.md 定义方阵，两条主对角线上的元素保持原位置，其余四个三角区域顺时针换位。原文请求查看source image，固定快照的示意图是不可访问本机路径。本站亲自查看原FastPrep页面公开的两张Problem Source图：第一张明确两条对角线不动并标出了5×5原矩阵，第二张重复规则；它们都没有数字约束或旋转后的图。另行下载的图保存在content/oa-judge/source-images/capitalone-18-original-0.jpg和-1.jpg，哈希绑定在来源证据，不能冒称这些下载图属于固定Git快照。

单次变换精确为：若r=c或r+c=n−1则元素固定；否则原(r,c)移动到(c,n−1−r)，即顺时针90度。此映射逐项复现固定正文5×5原样例的完整输出，不是仅根据想象添加几何规则。偶数阶同样成立，n=2全部位置都在对角线上，因此始终不变；奇数阶中心固定。

原文没有数值上下界。本站公开采用原Java int[][]与int参数的完整类型范围：元素−2147483648..2147483647，turns为非负次数0..2147483647，矩阵为非空方阵n≥1。负次数与空矩阵原文没有定义，本站不额外扩展。n不发明小上限，由既有32MiB标准输入预算限制。

标准输入首行为n turns，后面n行、每行n个有符号整数（以空白分隔，允许LF/CRLF或末尾直接EOF）；输出变换后n行矩阵，不输出n。最短单数字元素编码、turns为一位且EOF无末尾换行时，输入字节数为2n²+digits(n)+2。因此4095需33538056字节，可传输；4096需33554438字节，超过32MiB。4095是协议预算推导，不是原题给出的矩阵上界；更长数字会降低实际可容纳的阶数。

## 思路

顺时针旋转四次回到原位置，两条对角线每次都固定，所以只需turns%4次。非对角位置分为互不相交的四元轨道。选顶部严格三角r<c<n−1−r，每个轨道恰选一个代表。该代表的四位置为(r,c)、(c,n−1−r)、(n−1−r,n−1−c)、(n−1−c,r)。用一个临时变量顺时针移动四个值，其它轨道独立处理，无需第二份矩阵。

## 正确性证明

旋转映射R(r,c)=(c,n−1−r)将两条对角线的并集映回自身，所以它也把非对角位置映到非对角位置。R四次是恒等变换。非对角位置不可能是中心，不会有一元或二元轨道，因此轨道长度恰为4，分别落在四个三角区域中；顶部严格三角含每个轨道唯一代表。

原地循环把每个代表及其后三个位置的值沿R传递一次，正好实现该轨道的顺时针变换。不同轨道不共享位置，处理顺序不影响结果；两条对角线不在循环中，故其值不变。这证明一轮严格符合原规则。重复turns%4轮与重复turns轮相同，因而最终输出正确。n=1或2没有非对角轨道，保持不变也符合定义。

## 复杂度与完整预算

最多三轮，每轮访问O(n²)个元素，读取和输出也是O(n²)。只存一份连续int32矩阵，额外O(1)空间；n=4095时数组67076100字节，低于256MiB，不缓存整份输出字符串。解析INT_MIN先用64位累计其绝对值再取负，避免signed32溢出；位置乘法用size_t。

输出只是同一组数值的置换，不增减数值或符号；规范十进制输出的数字总字节数不超过输入数字总字节数，分隔符至多每值一个。除末尾换行差异外，输出小于输入减去头部，因此完整可传输矩阵也可输出；题包配置64MiB输出额度。大测试只有一个4095阶实例，避免重复大输入/大期望使总包超限。

## 独立验证

小域oracle为每个原坐标直接计算重复旋转后的目标坐标，写入新矩阵，不复制参考顶部三角原地交换。另核验对角固定及四次恒等。163唯一oracle覆盖有符号极值、奇偶阶、0/1/2/3/4/INT_MAX次；穷举1..3阶二值矩阵与0..7次旋转。正式保留原5×5例，另含偶数阶、中心、反向不对称数据、混合正负极值、各种周期和中规模随机数据。

满4095实例用坐标公式生成非对称0/1值，期望通过目标坐标反求原坐标再代入公式逐行产生，既不保存巨大Python整数矩阵也不调用参考算法。三错误程序分别转动对角线、逆时针、把周期误写为2，所有正式例须正常退出才计击杀。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def output(a):return ''.join(' '.join(map(str,row))+'\n' for row in a)
def encode(a,t):
 n=len(a);assert n>=1 and all(len(row)==n and all(-2**31<=v<2**31 for v in row) for row in a) and 0<=t<2**31
 return f'{n} {t}\n'+output(a)
def oracle(a,t):
 n=len(a);b=[[0]*n for _ in a]
 for r,row in enumerate(a):
  for c,value in enumerate(row):
   x,y=r,c
   if r!=c and r+c!=n-1:
    for _ in range(t%4):x,y=y,n-1-x
   b[x][y]=value
 return b
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=30);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def pattern(r,c):return '1' if (r*17+c*31+(r//16))%7<3 else '0'
def giant(n):
 source=io.StringIO();expected=io.StringIO();source.write(f'{n} 3\n')
 for r in range(n):
  source.write(' '.join(pattern(r,c) for c in range(n)));source.write('\n' if r+1<n else '')
  # Three clockwise turns: inverse destination map is one clockwise turn.
  expected.write(' '.join(pattern(r,c) if r==c or r+c==n-1 else pattern(c,n-1-r) for c in range(n)));expected.write('\n')
 return source.getvalue(),expected.getvalue()
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 images=[]
 for i,h in enumerate(IMAGE_HASHES):
  p=f'content/oa-judge/source-images/capitalone-18-original-{i}.jpg';assert sha((ROOT/p).read_bytes())==h
  images.append({'path':p,'sha256':h,'url':f'https://www.fastprep.io/api/problem-source-images/capitalone-rotate-matrix-over-diagonals/{i}'})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 original=[list(range(r*5+1,r*5+6)) for r in range(5)]
 original_answer=[[1,16,11,6,5],[22,7,12,9,2],[23,18,13,8,3],[24,17,14,19,4],[21,20,15,10,25]];assert oracle(original,1)==original_answer
 small=[(original,1),([[1,2],[3,4]],2147483647),([[-2147483648]],0)]
 for n in [3,4,5]:
  a=[[r*n+c-10 for c in range(n)] for r in range(n)]
  for t in [0,1,2,3,4,2147483647]:small.append((a,t))
 small.append(([[-2147483648,2147483647,0],[1,-1,-2147483648],[2147483647,4,-5]],3))
 rng=random.Random(SEED);keys={encode(a,t) for a,t in small}
 while len(small)<163:
  n=rng.randint(1,7);a=[[rng.choice([-2147483648,2147483647,rng.randint(-100,100)]) for _ in range(n)] for _ in range(n)];t=rng.choice([rng.randrange(12),2147483647]);key=encode(a,t)
  if key not in keys:keys.add(key);small.append((a,t))
 oracles=[{'input':encode(a,t),'expectedOutput':output(oracle(a,t))} for a,t in small]
 cases=[];large=[]
 def add(name,a,t,hidden=True):cases.append({'name':name,'input':encode(a,t),'expectedOutput':output(oracle(a,t)),'hidden':hidden,'weight':1})
 for i,(a,t) in enumerate(small[:30]):add(('原5x5例' if i==0 else '本站补充')+str(i+1),a,t,i>=3)
 cases.append({'name':'CRLF与INT_MIN解析','input':encode(small[-1][0],small[-1][1]).replace('\n','\r\n'),'expectedOutput':output(oracle(*small[-1])),'hidden':True,'weight':1})
 for n,t in [(127,0),(128,1),(129,2),(256,3),(257,4),(511,2147483647),(512,2)]:
  a=[[(-2147483648 if (r+c)%5==0 else 2147483647 if (r+c)%5==1 else r*n-c) for c in range(n)] for r in range(n)];add(f'中规模-{n}-turns{t}',a,t)
 for n in [1,2,3,4,5,8]:
  a=[[int(pattern(r,c)) for c in range(n)] for r in range(n)];s,e=giant(n);assert e==output(oracle(a,3))
 print('CapitalOne18 constructing single maximum matrix and independent formula output',flush=True)
 inp,expected=giant(4095);assert len(inp)==33538056 and len(expected)==33538050
 cases.append({'name':'完整预算4095阶非对称矩阵EOF','input':inp,'expectedOutput':expected,'hidden':True,'weight':1});del inp,expected
 assert all(len(c['input'].encode())<=32*1024*1024 for c in cases)
 print(f'Prepared {len(cases)} formal; native and independent coordinate checks',flush=True)
 with tempfile.TemporaryDirectory(prefix='capitalone18-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(1,4):
   for flat in product([0,1],repeat=n*n):
    a=[list(flat[r*n:(r+1)*n]) for r in range(n)]
    assert oracle(a,4)==a
    for t in range(8):
     b=oracle(a,t);assert all(b[r][c]==a[r][c] for r in range(n) for c in range(n) if r==c or r+c==n-1)
     assert execute(binary,encode(a,t))[0]==output(b).strip();exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput'].strip()
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'].strip(),case['name']
   if len(case['input'])>100000:
    with tempfile.TemporaryFile(mode='w+') as data:
     data.write(case['input']);data.seek(0);p=subprocess.run(['/usr/bin/time','-l',str(binary)],stdin=data,text=True,capture_output=True,check=True,timeout=30)
    assert p.stdout.strip()==actual;rss=re.search(r'(\d+)\s+maximum resident set size',p.stderr)
    large.append({'name':case['name'],'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed,'darwinPeakRssBytes':int(rss.group(1)) if rss else None})
    print(f"formal {case['name']}: {elapsed}s",flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput'].strip():rejected.append(j)
   assert rejected;kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)});print(f'mutant {i+1}: {len(rejected)} rejected, all normal',flush=True)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Capital One OA #18：保持对角线的矩阵旋转','difficulty':'中等','tags':['矩阵','原地算法','周期'],
 'description':'给定非空n×n方阵和非负次数turns。每次两条主对角线上的元素保持原位置，其余四个三角区域顺时针旋转90度：非对角原坐标(r,c)移动到(c,n−1−r)，坐标从0计数。输出重复turns次后的矩阵。此映射与固定原5×5样例逐项一致；原页公开来源图明确顺时针及双对角固定。',
 'input':'首行n turns，随后n行各n个整数，空白分隔；接受LF/CRLF及末尾EOF。原无数值上界，本站公开按Java类型适配：n≥1非空方阵、元素−2147483648..2147483647、turns0..2147483647。n仅受既有32MiB输入预算限制，不另设小上限；4095是最短编码预算推导，不是来源约束。不扩展空矩阵或负次数。',
 'output':'输出旋转后n行矩阵，每行n个整数，不输出n。',
 'explanation':'第一公开例保留原5×5完整输入输出，双对角1/7/13/19/25和5/9/13/17/21均固定。第二、三公开例为本站补充：2×2全是对角，任意次不变；1×1及零次同样不变。来源图另行下载并单独绑定哈希，不冒称固定快照含可访问图片。',
 'hints':['四次旋转恢复原样。','非对角元素形成互不相交的四元轨道。','顶部严格三角r<c<n−1−r恰好包含每轨道一个代表。'],
 'timeLimit':5,'memoryLimit':262144,'outputLimit':65536,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'四元轨道原地旋转与双对角不变性','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'gitBlobSha':BLOB,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,'sourceImages':images,'imageProvenance':'Separately retrieved public original-page Problem Source images, personally viewed. They are not immutable upstream Git assets; neither supplies numerical bounds or after-rotation diagram. Fixed raw numerical sample independently matches the coordinate rule.','rangeDisclosure':'Explicit original Java signed32 elements and nonnegative signed32 turns adaptation, nonempty square matrix only. Full existing32MiB stdin transport budget, no arbitrary smaller n cap.','maximumCanonicalDimension':4095,'corrections':['No original sample changed. Numeric scope and nonempty matrix interpretation explicitly disclosed, not asserted as missing original bounds.','Two additional public examples are authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'原图明确双对角固定及顺时针区域轮换，固定5×5例完整匹配非对角坐标旋转。公开Java类型与完整传输域适配，单数组四循环实现，独立坐标oracle和4095阶输入输出验证。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Out-of-place direct source-to-destination coordinate mapping, diagonal invariants and R^4 identity; maximum procedural asymmetric matrix with inverse-coordinate formula output.','exhaustiveSmallDomain':{'cases':exhaustive,'dimensions':[1,2,3],'values':[0,1],'turns':[0,7]},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'CapitalOne18 frozen: {len(cases)} formal,163 oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
