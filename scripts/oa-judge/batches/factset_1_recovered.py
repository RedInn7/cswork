#!/usr/bin/env python3
"""Original square-matrix contract; streaming native DP and independent square enumeration."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,sys,re
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-factset-1';BATCH='factset-1-recovered';SEED=20261109
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='c157e63731eab25146c95a47315613f2a740630f4bb3fecc3b445ff752272919'
SOURCE='fastprep/FactSet/factset-largest-square-of-1s.md'
BLOB='4e80812a873618e737da8fa5f1dd1831dc9a8ad4'
SOURCE_SHA='dadb36667cd3a53c213397f7d20dbea9830ad31097466011ebf04f7b160b4866'
REFERENCE=r'''#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
int readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();int x=0;while(c>32&&c!=EOF){x=x*10+c-'0';c=getchar_unlocked();}return x;}
int main(){
 int n=readNumber(),answer=0;
 vector<int> dp(n+1,0);
 for(int row=0;row<n;row++){
  int diagonal=0;
  for(int col=1;col<=n;col++){
   int above=dp[col],value=readNumber();
   dp[col]=value?1+min({above,dp[col-1],diagonal}):0;
   answer=max(answer,dp[col]);
   diagonal=above;
  }
 }
 printf("%d\n",answer);
}
'''
MUTANTS=[
 {'name':'错误返回面积而非边长','language':'cpp','code':REFERENCE.replace('printf("%d\\n",answer);','printf("%d\\n",answer*answer);')},
 {'name':'错误递推遗漏左上对角条件','language':'cpp','code':REFERENCE.replace('min({above,dp[col-1],diagonal})','min(above,dp[col-1])')},
 {'name':'错误只记录第一行中的结果','language':'cpp','code':REFERENCE.replace('answer=max(answer,dp[col]);','if(row==0)answer=max(answer,dp[col]);')},
]
EDITORIAL='''## 固定原文恢复与范围披露

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/FactSet/factset-largest-square-of-1s.md明确写two-dimensional square matrix，并给出n行、每行n个整数的输入描述。旧整理过程把HTML小于号之后的文字截断，不应据此认定缺少方阵结构。本题输入是由0、1构成的n×n方阵，1表示缺陷产品，求全部为1的连续正方形子矩阵的最大边长，不是面积，也不是任意选行列。

原文没有给n数值上界。本站不伪称原题有n≤1000等限制，而支持现有单例32MiB标准输入预算以内的全部合法方阵。输入第一行给n，然后n行各n个以空白分隔的0/1；每行结束换行。最紧凑通常编码至少需要2n²字节及首行，因此4095阶测试已紧邻当前预算，4095不是额外声明的原始上界。允许n=0并返回0是本站明确的空矩阵数学扩展，不能归因于原文保证。非空全0矩阵也返回0。

三个公开案例完全保留原输入和答案3、2、1。原例1把3×3区域起点(0,0)的end写成(3,3)，这是半开右下端点；本站统一改用包含端点(2,2)，其它两块对应(3,2)、(4,2)。原例2的(1,1)则已经是包含端点，不能混用两种约定。作者本机图片路径不可访问，不作为额外证据，所有结果均由可读取矩阵独立计算。

## 思路

逐行读取元素。dp[col]表示上一行或本行已更新位置的、以该格为右下角的最大全1正方形边长。当前值为0时置0；为1时取上方、左方、左上方三个边长最小值加1。更新前保存上方旧值，留作下一个格子的左上方。所有位置的最大值就是答案。

## 正确性证明

当当前格为0，任何以它为右下角的全1正方形均不可能，最大边长为0。当当前格为1，设三个相邻子问题值为a、b、c。任何边长s≥2的候选正方形去掉最底行、最右列等后，均包含这三个右下角对应的边长s−1正方形，因此s≤1+min(a,b,c)。反过来，三个相邻位置各有边长d=min(a,b,c)的全1正方形，它们的并集加上当前格覆盖边长d+1的整块区域，故该上界可达到。边长1也成立。

按行列顺序归纳，递推总能得到正确的当前边长。滚动数组读取的上方值尚未覆盖、左方值已经更新、保存的diagonal为上一行左方，所以实现与递推一致。任何全1正方形有唯一右下角，枚举所有格并取最大值覆盖全部候选，输出全局最大边长。

## 复杂度与传输预算

时间O(n²)，额外空间O(n)，标准输入流式读取，不存完整矩阵。零矩阵扩展时间O(1)。输入预算限制下n及dp值远小于32位有符号上限；输出仅一个边长整数。参考使用C++20，题包3秒/256MiB，输出64KiB。不同语言仍须满足同一时间和内存限制。本地性能记录不能替代Linux沙箱验收。

## 独立验证

小oracle枚举每个起点、每个边长，并直接检查该区域全部格，不调用DP。对n=0..3所有二进制方阵共531个进行完整穷举，再用163唯一输入真实运行原生参考。中等方阵采用二维前缀和，按边长从大到小枚举方块检查面积和，独立于最大正方形DP。

两组4095×4095方阵各33538055字节：全1的期望4095，棋盘格的期望1（任何2×2均有0）。这两组用独立闭式，不构造庞大的Python二维整数对象；逐组实际执行参考并测量本机峰值内存。其它边界覆盖全0、孤立1、缺对角、边框、内部洞、条纹、偏移正方形、随机密集矩阵。三个负控分别返回面积、遗漏对角条件、只统计第一行，所有正式输入均必须正常退出才计作有效击杀。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(a):
 n=len(a);assert all(len(row)==n and all(x in (0,1) for x in row) for row in a)
 return str(n)+'\n'+''.join(' '.join(map(str,row))+'\n' for row in a)
def brute(a):
 n=len(a);best=0
 for r in range(n):
  for c in range(n):
   for size in range(1,min(n-r,n-c)+1):
    if all(a[i][j] for i in range(r,r+size) for j in range(c,c+size)):best=max(best,size)
 return best
def prefix_oracle(a):
 n=len(a);p=[[0]*(n+1) for _ in range(n+1)]
 for i in range(n):
  for j in range(n):p[i+1][j+1]=a[i][j]+p[i][j+1]+p[i+1][j]-p[i][j]
 for size in range(n,0,-1):
  for i in range(n-size+1):
   for j in range(n-size+1):
    if p[i+size][j+size]-p[i][j+size]-p[i+size][j]+p[i][j]==size*size:return size
 return 0
def execute(binary,raw,profile=False):
 cmd=[str(binary)]
 if profile:cmd=['/usr/bin/time','-l' if sys.platform=='darwin' else '-v']+cmd
 started=time.perf_counter();p=subprocess.run(cmd,input=raw,text=True,capture_output=True,check=True,timeout=20)
 metrics={'wallSeconds':round(time.perf_counter()-started,5)}
 if profile:
  pattern=r'(\d+)\s+maximum resident set size' if sys.platform=='darwin' else r'Maximum resident set size \(kbytes\):\s*(\d+)'
  m=re.search(pattern,p.stderr);assert m,p.stderr
  metrics.update({'peakResidentBytes':int(m[1])*(1 if sys.platform=='darwin' else 1024),'hostPlatform':sys.platform,'method':'native /usr/bin/time','notLinuxSandboxEvidence':True})
 else:assert not p.stderr
 return p.stdout.strip(),metrics
def main():
 started=time.perf_counter();source_bytes=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
 assert sha(source_bytes)==SOURCE_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=source_bytes).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 examples=[[[1,1,1,1,1],[1,1,1,0,0],[1,1,1,0,0],[1,1,1,0,0],[1,1,1,1,1]],[[1,1,1],[1,1,0],[1,0,1]],[[0,1,1],[1,1,0],[1,0,1]]]
 rng=random.Random(SEED);small=examples+[[],[[0]],[[1]],[[0,1],[1,1]]];keys={encode(a) for a in small}
 while len(small)<163:
  n=rng.randint(2,7);a=[[int(rng.random()<rng.choice([.2,.5,.8])) for _ in range(n)] for _ in range(n)];raw=encode(a)
  if raw not in keys:keys.add(raw);small.append(a)
 cases=[];oracles=[];large=[]
 with tempfile.TemporaryDirectory(prefix='factset1-native-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(4):
   for bits in product((0,1),repeat=n*n):
    a=[list(bits[i*n:(i+1)*n]) for i in range(n)];expected=brute(a);assert prefix_oracle(a)==expected
    assert execute(binary,encode(a))[0]==str(expected);exhaustive+=1
  assert exhaustive==531
  print('FactSet1:531 exhaustive matrices passed native reference and two independent oracles',flush=True)
  for i,a in enumerate(small):
   raw=encode(a);expected=brute(a);assert prefix_oracle(a)==expected
   assert execute(binary,raw)[0]==str(expected)
   oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
   if i<28:cases.append({'name':f'原始样例{i+1}' if i<3 else f'独立小矩阵{i-2}','input':raw,'expectedOutput':str(expected)+'\n','hidden':i>=3,'weight':1})
  patterns=[('全0',lambda i,j,n:0),('全1',lambda i,j,n:1),('棋盘',lambda i,j,n:(i+j)%2),('对角',lambda i,j,n:int(i==j)),('边框',lambda i,j,n:int(i in (0,n-1) or j in (0,n-1))),('单洞',lambda i,j,n:int((i,j)!=(n//2,n//2))),('横条纹',lambda i,j,n:int(i%4!=0)),('竖条纹',lambda i,j,n:int(j%5!=0)),('偏移方块',lambda i,j,n:int(2<=i<n-1 and 3<=j<n-2)),('右下方块',lambda i,j,n:int(i>=n//2 and j>=n//2))]
  for index,(name,fn) in enumerate(patterns):
   n=20+index;a=[[fn(i,j,n) for j in range(n)] for i in range(n)];raw=encode(a);expected=prefix_oracle(a)
   assert execute(binary,raw)[0]==str(expected);cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  for n in (31,45,64):
   a=[[int(rng.random()<.94) for _ in range(n)] for _ in range(n)];raw=encode(a);expected=prefix_oracle(a)
   assert execute(binary,raw)[0]==str(expected);cases.append({'name':f'稠密随机{n}','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  for mode in ('ones','checkerboard'):
   n=4095
   if mode=='ones':raw=f'{n}\n'+('1 '* (n-1)+'1\n')*n;expected=n
   else:
    rows=[' '.join(str((i+j)%2) for j in range(n))+'\n' for i in (0,1)]
    raw=f'{n}\n'+''.join(rows[i%2] for i in range(n));expected=1
   assert len(raw.encode())==33538055 and len(raw.encode())<=32*1024*1024
   out,metrics=execute(binary,raw,True);assert out==str(expected)
   large.append({'name':mode,'n':n,'inputBytes':len(raw.encode()),'expected':expected,'oracle':'closed form: all ones n; checkerboard every2x2 includes zero','localMetrics':metrics})
   cases.append({'name':f'近32MiB-{mode}','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
   print(f'FactSet1:{mode} input={len(raw)} passed; metrics={metrics}',flush=True)
  kills=[]
  for i,m in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{i}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(m['code']);mb=Path(td)/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True)
   rejected=[j for j,c in enumerate(cases) if execute(mb,c['input'])[0]!=c['expectedOutput'].strip()]
   assert rejected;kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 assert len({c['input'] for c in cases})==len(cases)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'全1正方形的最大边长','difficulty':'中等','tags':['OA','FactSet','动态规划','矩阵'],
 'description':'给定n×n二进制方阵，1表示缺陷产品，0表示非缺陷产品。求全部元素为1的连续正方形子矩阵的最大边长；不是面积。不存在1时返回0。',
 'input':'第一行非负整数n，随后n行，每行n个空白分隔的0或1。原文明确方阵和逐行输入，但未给n数值上界；本站支持现有每例32MiB标准输入预算内的全部合法可传输方阵，不额外缩小n。n=0为空矩阵，是本站明确的数学扩展。',
 'output':'输出一个整数，表示最大边长；空矩阵或全0矩阵输出0。',
 'explanation':'三个公开输入和输出3、2、1均保留原始来源。第一例存在边长3的方块；原解释end(3,3)使用半开端点，本站统一为包含端点(2,2)，其余两块右下角为(3,2)、(4,2)。第二例左上2×2全1；第三例没有全1的2×2但存在1。原图片为作者本机路径，不作证据。',
 'hints':['考虑以每个格为右下角的最大边长。','为1时必须同时满足上、左、左上条件。','滚动数组即可流式处理每一行。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'流式滚动数组最大正方形','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':SOURCE_SHA}],'upstreamCodeExecuted':False,'corrections':['Raw explicitly states square matrix and n subsequent rows of n integers; HTML comparison is not missing semantics.','Original outputs3/2/1 retained. First example end coordinates are exclusive; site consistently describes inclusive coordinates.'],'rangeDisclosure':'No original n maximum. Full existing32MiB transport domain, streamed n-by-n input. n0 is explicitly site mathematical extension, not an upstream guarantee.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'固定raw明确方阵及每行n个二进制元素；保留原例3/2/1并说明端点约定。流式O(n²)/O(n)支持完整32MiB可传输输入而不伪造n上界，独立方块枚举与前缀和及近预算闭式压力验证。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Direct square enumeration with cell-by-cell checking; independent prefix-sum square search; largest cases closed forms.','exhaustiveSmallDomain':{'cases':exhaustive,'nMin':0,'nMax':3,'nativeReferenceSubprocessCases':exhaustive},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'FactSet1 frozen:{len(cases)}formal,163oracle,531exhaustive,3mutants;normalizedBytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
