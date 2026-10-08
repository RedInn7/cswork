#!/usr/bin/env python3
"""Synchronous letter substitution; matrix reference vs polynomial recurrence oracle."""
from pathlib import Path
from functools import lru_cache
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,sys,re
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-bny-mellon-1';BATCH='bny-1-recovered';SEED=20261110
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='f361e083f3399dcdb051874c1fdecac72f747fb36dabdf5b6b92e1021c0873fc'
SOURCE='fastprep/BNY Mellon/bnymellon-calculate-string-transformations-length.md'
BLOB='fd0198ddd4864d33ebef220f9dc41c6057cdbfa9'
SOURCE_SHA='739c081dab5e3a0354caaf7dd237941153eec5d65f265ae2a25989c7f8a60de7'
MOD=1000000007;INPUT_LIMIT=32*1024*1024;MAX_T=2147483647
REFERENCE=r'''#include <cstdio>
#include <cstdint>
using namespace std;
const long long MOD=1000000007;
struct Matrix{long long x[26][26]{};};
Matrix multiply(const Matrix&a,const Matrix&b){
 Matrix c;
 for(int i=0;i<26;i++)for(int k=0;k<26;k++)if(a.x[i][k])
  for(int j=0;j<26;j++)c.x[i][j]=(c.x[i][j]+a.x[i][k]*b.x[k][j])%MOD;
 return c;
}
int main(){
 long long counts[26]{};int ch;
 while((ch=getchar_unlocked())!=EOF && ch!='\n')if(ch>='a'&&ch<='z')counts[ch-'a']++;
 unsigned long long t=0;scanf("%llu",&t);
 Matrix base,result;
 for(int i=0;i<26;i++)result.x[i][i]=1;
 for(int i=0;i<25;i++)base.x[i+1][i]=1;
 base.x[0][25]=1;base.x[1][25]=1;
 while(t){if(t&1)result=multiply(result,base);base=multiply(base,base);t>>=1;}
 long long answer=0;
 for(int i=0;i<26;i++)for(int j=0;j<26;j++)answer=(answer+result.x[i][j]*(counts[j]%MOD))%MOD;
 printf("%lld\n",answer);
}
'''
MUTANTS=[
 {'name':'错误多执行一轮转换','language':'cpp','code':REFERENCE.replace('Matrix base,result;','t++;Matrix base,result;')},
 {'name':'错误把z替换为a而遗漏b','language':'cpp','code':REFERENCE.replace('base.x[1][25]=1;','base.x[1][25]=0;')},
 {'name':'错误使用1000000009模数','language':'cpp','code':REFERENCE.replace('MOD=1000000007','MOD=1000000009')},
 {'name':'错误在当前轮继续转换新生ab为bc','language':'cpp','code':REFERENCE.replace('base.x[0][25]=1;base.x[1][25]=1;','base.x[1][25]=1;base.x[2][25]=1;')},
]
EDITORIAL='''## 原文规则、补全样例与范围披露

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/BNY Mellon/bnymellon-calculate-string-transformations-length.md说明每轮对字符串的每个原字符替换：z变成ab，其余小写字母变为下一个字母。正文明确azbk经过一轮得到babcl，足以证明本轮产生的新字符不能在同一轮继续转换；旧阻断理由认为同步语义不明并不成立。

第一公开例来自正文azbk,t=1，结果babcl长度5；第二保留原例输入abczy,t=2，第一轮bcdabz，第二轮应为cdebcab，长度7。原输出栏是TO-DO而非一个可保留的原答案，原第二轮解释漏了z并给出错误字符串cdedbc。本站明确把7作为按原规则推导补全，不谎称原文已提供7。第三公开例z,t=0为本站边界补充。

原文未给数值约束。t采用原Java接口int结合非负转换次数，解释为0..2147483647，这是类型及语义推导，不是原文列出的十进制约束。word由小写英文字母组成，本站不额外发明长度100000上限，而覆盖现有每例32MiB标准输入预算内的全部可传输字符串。空word也接受且返回0，明确属于本站空串数学扩展。输入固定两行：word、t；第一行为空即空串。输出数学长度对1000000007取模，不需要输出指数增长的实际字符串。

## 思路

用26维列向量记录每个字符的数量。构造转移矩阵M：对于a..y，其一份贡献给下一字母；z的一份同时贡献给a和b。每轮转换后向量为M乘原向量，因此t轮后是M^t乘初始向量。使用二进制快速幂，最后把26个计数求和并取模。参考逐字节统计输入而不保留完整word。

## 正确性证明

一次转换时不同原字符独立贡献，不会互相合并。同一字母的所有副本有完全相同的后代，所以按字符计数不会丢失长度所需信息。矩阵第j列恰好是字母j进行一轮同步转换的产物计数，矩阵乘法逐列加权即为全部原字符贡献之和，故一步转移正确。

由归纳，重复t轮得到M^t乘初始计数向量。快速幂维护尚未使用的二进制幂次及已选幂次乘积；读到置位就乘入，移位并平方，终止时乘积为M^t。t=0时结果矩阵为单位阵，输出原长度。最终各字母数量之和就是转换后字符串总长度；加乘与取模兼容，因此中途取模不影响最终余数。空串初始向量全0，任意轮后仍为0。

## 复杂度与整数安全

字母表大小固定26，时间O(|word|+26³log(t+1))，也可记作固定字母表下O(|word|+log(t+1))；空间O(26²)，不存输入字符串或展开串。矩阵每次乘加后立即取模，单项积加当前余数小于(1000000007−1)²+1000000006，远小于64位有符号上限。输入计数也受32MiB字节预算约束。使用64位计算乘法，不能用32位中间结果。

## 独立验证

小oracle直接构造新字符串，每轮遍历旧串、z追加ab、其它追加后继；不调用矩阵算法。163唯一小输入真实运行原生参考。另对字母表abyz长度0..4及轮数0..6全部2387组直接展开，并对照独立线性递推oracle。

大轮数oracle不使用矩阵：令f(s)为单个a经过s轮的长度，f(0)..f(25)=1；a经过26轮成为ab，而b等于a提前一轮，故f(s)=f(s−26)+f(s−25)。使用多项式模x²⁶−x−1快速求x^s，把结果系数与26个初值点乘。起始字母下标j的长度为f(t+j)，对输入频数加权求和。多项式乘法后从高次向低次按x^26=x+1消去，是与26×26矩阵乘法独立的实现。

两个接近32MiB案例分别t=0的全a串及t=2147483647的循环字母串。前者答案由长度直接给出；后者字符频数由整周期与余数闭式计算，并与逐字符计数校验，再使用多项式oracle。中小例覆盖z分裂、轮数25/26边界、取模、大轮数每个单字母、空串与全字母。四个正常退出负控测试轮数偏移、漏掉z的b、错误模数、提前转换本轮产生的ab。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(word,t):
 assert all('a'<=c<='z' for c in word) and 0<=t<=MAX_T
 raw=word+'\n'+str(t)+'\n';assert len(raw)<=INPUT_LIMIT;return raw
def expand(word,t):
 for _ in range(t):word=''.join('ab' if c=='z' else chr(ord(c)+1) for c in word)
 return len(word)%MOD
def poly_mul(a,b):
 c=[0]*51
 for i,x in enumerate(a):
  if x:
   for j,y in enumerate(b):c[i+j]=(c[i+j]+x*y)%MOD
 for i in range(50,25,-1):
  c[i-26]=(c[i-26]+c[i])%MOD;c[i-25]=(c[i-25]+c[i])%MOD
 return c[:26]
@lru_cache(None)
def weights(t):
 a=[1]+[0]*25;b=[0,1]+[0]*24;e=t
 while e:
  if e&1:a=poly_mul(a,b)
  b=poly_mul(b,b);e//=2
 result=[]
 for _ in range(26):
  result.append(sum(a)%MOD)
  last=a[-1];a=[last,(a[0]+last)%MOD]+a[1:-1]
 return tuple(result)
def recurrence(word,t):
 counts=[0]*26
 for c in word:counts[ord(c)-97]+=1
 return sum(c*w for c,w in zip(counts,weights(t)))%MOD
def execute(binary,raw,profile=False):
 cmd=[str(binary)]
 if profile:cmd=['/usr/bin/time','-l' if sys.platform=='darwin' else '-v']+cmd
 start=time.perf_counter();p=subprocess.run(cmd,input=raw,text=True,capture_output=True,check=True,timeout=20)
 metrics={'wallSeconds':round(time.perf_counter()-start,5)}
 if profile:
  pattern=r'(\d+)\s+maximum resident set size' if sys.platform=='darwin' else r'Maximum resident set size \(kbytes\):\s*(\d+)';m=re.search(pattern,p.stderr);assert m,p.stderr
  metrics.update({'peakResidentBytes':int(m[1])*(1 if sys.platform=='darwin' else 1024),'hostPlatform':sys.platform,'method':'native /usr/bin/time','notLinuxSandboxEvidence':True})
 else:assert not p.stderr
 return p.stdout.strip(),metrics
def main():
 start=time.perf_counter();raw_source=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
 assert sha(raw_source)==SOURCE_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw_source).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=[('azbk',1),('abczy',2),('z',0),('',0),('',60),('a',0),('z',1),('z',2),('y',1),('y',2),('a',25),('a',26),('ab',51)]
 rng=random.Random(SEED);keys={encode(w,t) for w,t in small}
 while len(small)<163:
  word=''.join(rng.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(rng.randrange(1,15)));t=rng.randrange(61);raw=encode(word,t)
  if raw not in keys:keys.add(raw);small.append((word,t))
 exhaustive=0
 for n in range(5):
  for chars in product('abyz',repeat=n):
   word=''.join(chars)
   for t in range(7):assert expand(word,t)==recurrence(word,t);exhaustive+=1
 assert exhaustive==2387
 cases=[];oracles=[];large=[]
 with tempfile.TemporaryDirectory(prefix='bny1-native-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  for i,(word,t) in enumerate(small):
   raw=encode(word,t);expected=expand(word,t);assert expected==recurrence(word,t)
   assert execute(binary,raw)[0]==str(expected);oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
   if i<25:cases.append({'name':f'来源及公开补充{i+1}' if i<3 else f'直接展开{i-2}','input':raw,'expectedOutput':str(expected)+'\n','hidden':i>=3,'weight':1})
  print('BNY1:163 unique subprocess oracles and2387 exhaustive expansions passed',flush=True)
  specs=[('a',MAX_T),('z',MAX_T),('abcdefghijklmnopqrstuvwxyz',MAX_T),('abcdefghijklmnopqrstuvwxyz',MAX_T-25),('zyxwvutsrqponmlkjihgfedcba',MAX_T-26),('abczy',MAX_T-1),('',MAX_T),('zzzz',1000),('a',100000),('azbycx',1000000000),('abcdefghijklmnopqrstuvwxyz',26),('abcdefghijklmnopqrstuvwxyz',25),('z',100),('z',10000)]
  for word,t in specs:
   raw=encode(word,t);expected=recurrence(word,t);assert execute(binary,raw)[0]==str(expected)
   cases.append({'name':f'递推独立核验-{t}-{word[:6] or "empty"}','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  for t,mode in [(0,'all-a'),(MAX_T,'alphabet-cycle')]:
   length=INPUT_LIMIT-len(str(t))-2
   if mode=='all-a':word='a'*length;counts=[length]+[0]*25;expected=length%MOD
   else:
    alphabet='abcdefghijklmnopqrstuvwxyz';word=alphabet*(length//26)+alphabet[:length%26];counts=[length//26+int(i<length%26) for i in range(26)]
    assert counts==[word.count(chr(97+i)) for i in range(26)]
    expected=sum(c*w for c,w in zip(counts,weights(t)))%MOD
   raw=encode(word,t);del word;assert len(raw)==INPUT_LIMIT
   out,metrics=execute(binary,raw,True);assert out==str(expected)
   cases.append({'name':f'完整32MiB-{mode}','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
   large.append({'name':mode,'wordLength':length,'t':t,'inputBytes':len(raw),'expected':expected,'letterCounts':counts,'oracle':'t0 length identity; otherwise periodic counts and polynomial recurrence modulo x^26-x-1','localMetrics':metrics})
   print(f'BNY1:{mode} length={length},expected={expected},metrics={metrics}',flush=True)
  kills=[]
  for i,m in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{i}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(m['code']);binary_m=Path(td)/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(binary_m)],check=True)
   rejected=[j for j,c in enumerate(cases) if execute(binary_m,c['input'])[0]!=c['expectedOutput'].strip()];assert rejected
   kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 assert len({c['input'] for c in cases})==len(cases)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'同步字母转换后的长度','difficulty':'困难','tags':['OA','BNY Mellon','矩阵快速幂','计数'],
 'description':'对小写英文字符串恰好进行t轮同步转换：每个z替换为ab，其余字母替换为字母表中的下一个字母。本轮产生的字符要到下一轮才继续转换。输出最终字符串长度对1000000007的余数。',
 'input':'固定两行：第一行word，仅含a..z；第二行非负整数t。依原Java int接口和轮数语义，本站明确解释0≤t≤2147483647，此范围是类型推导而非原约束栏给出的数字。原文没有word长度上限，本站覆盖单例32MiB标准输入预算内所有合法可传输字符串，不另外缩小长度。允许第一行为空，作为本站空串数学扩展。',
 'output':'输出最终长度模1000000007的一个整数。t=0返回原长度的余数，空串始终返回0。',
 'explanation':'原正文azbk一轮变babcl，长度5。原例abczy,t=2先变bcdabz，再变cdebcab，长度7；原输出是TO-DO，7为本站按明确规则推导补全，原解释cdedbc有误。第三公开例z,t=0→1为本站边界补充。',
 'hints':['用26个计数代替展开字符串。','同步转换是线性变换，可以矩阵快速幂。','大轮数不能按轮迭代，乘法中间值需要64位。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'同步线性变换与矩阵幂','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':SOURCE_SHA}],'upstreamCodeExecuted':False,'corrections':['azbk->babcl explicitly demonstrates synchronous substitution.','abczy t2 becomes cdebcab length7; source output is TO-DO, site derives rather than claims original numeric answer.'],'rangeDisclosure':'Nonnegative Java int t interpreted as0..2147483647. No invented word-length bound: full32MiB transport domain. Empty string explicitly a site mathematical extension.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'原正文azbk→babcl明确同步转换；按规则补全TO-DO例为7并纠正第二轮解释。非负Java int轮数与32MiB可传输字符串域明确披露，原生矩阵幂和独立多项式递推支持完整范围。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Literal synchronous string expansion for small t; polynomial reduction modulo x^26-x-1 and initial f0..25=1 for huge t, no matrix oracle.','exhaustiveSmallDomain':{'cases':exhaustive,'alphabet':'abyz','wordLengthMin':0,'wordLengthMax':4,'tMin':0,'tMax':6},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
 print(f'BNY1 frozen:{len(cases)}formal,163oracle,2387exhaustive,4mutants;normalizedBytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
