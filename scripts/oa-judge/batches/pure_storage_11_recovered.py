#!/usr/bin/env python3
"""Position-distinct palindromes; single-array Manacher vs brute force/eertree."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time,sys,re
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-pure-storage-11';BATCH='pure-storage-11-recovered';SEED=20261114
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='15b7fd6da33252f54e0a3fa68b3e09e7b271cfc8f5fe192d30243cda949365de'
SOURCE='fastprep/Pure Storage/purestorage-count-different-palindrome-substrings.md'
BLOB='27136d07e18e1b19697e059eebad6ae22b604196'
SOURCE_SHA='695c604aca889347ebdbbd23c661ca47ad3ce363a5e42c662509a60f5ecc46cf'
LIMIT=32*1024*1024
REFERENCE=r'''#include <cstdio>
#include <string>
#include <vector>
#include <algorithm>
#include <cstdint>
using namespace std;
int main(){
 string s;int c;while((c=getchar_unlocked())!=EOF&&c!='\n')s.push_back(char(c));
 if(!s.empty()&&s.back()=='\r')s.pop_back();
 int n=int(s.size());vector<int> radius(n);long long answer=0;
 for(int i=0,l=0,r=-1;i<n;i++){
  int k=i>r?1:min(radius[l+r-i],r-i+1);
  while(i-k>=0&&i+k<n&&s[i-k]==s[i+k])k++;
  radius[i]=k;answer+=k;//odd
  if(i+k-1>r){l=i-k+1;r=i+k-1;}
 }
 fill(radius.begin(),radius.end(),0);
 for(int i=0,l=0,r=-1;i<n;i++){
  int k=i>r?0:min(radius[l+r-i+1],r-i+1);
  while(i-k-1>=0&&i+k<n&&s[i-k-1]==s[i+k])k++;
  radius[i]=k;answer+=k;//even
  if(i+k-1>r){l=i-k;r=i+k-1;}
 }
 printf("%lld\n",answer);
}
'''
MUTANTS=[
 {'name':'错误仅统计奇数长度回文','language':'cpp','code':REFERENCE.replace('answer+=k;//even','answer+=0;//even')},
 {'name':'错误漏掉全部单字符回文','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",answer);','printf("%lld\\n",answer-n);')},
 {'name':'错误把完整计数截断为32位','language':'cpp','code':REFERENCE.replace('printf("%lld\\n",answer);','printf("%lld\\n",static_cast<long long>(static_cast<int32_t>(static_cast<uint32_t>(answer))));')},
]
EDITORIAL='''## 原始计数对象与整理误读纠正

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Pure Storage/purestorage-count-different-palindrome-substrings.md明确举出ll,ll，并写two distinct substrings that only happen to be equal。因此“different ways to pick”按下标区间区分，不能按字符串内容去重。每个非空连续子串只要正反相同就计一次；同内容出现在不同位置仍分别计数。

原例hellolle有8个单字符、2个ll、lol、lloll和ellolle，共13；若内容去重只有8。wowpurerocks有12个单字符，加wow和rer共14；内容去重只有11。两个原答案都正确且完整保留，旧阻断把位置计数误解成内容去重才造成所谓冲突。原定义中的大小写示意不改变函数明确only lowercase letters的输入范围。

原约束栏是占位符，没有字符串长度界。本站不借同公司另一题的本站长度上限，也不伪造原n≤200000等限制，而支持现有单例32MiB文本输入预算内的全部小写字符串。输入一行s，末尾换行可省略，因此无换行时长度可达33554432。空行表示空串，返回0是本站公开数学扩展。原Java int返回类型不能容纳完整计数，本站输出精确数学整数、不取模，使用64位；完整传输域的上界n(n+1)/2≤562949970198528，小于2^50。

## 思路

对每个字符中心统计奇数长度回文半径，对每个字符间隙中心统计偶数长度回文半径。奇半径k包含该中心对应的k个非空回文，偶半径k也对应k个非空回文，因此答案是所有奇偶半径之和。

使用Manacher算法维护当前最右回文区间[l,r]。中心在区间内时，可借用关于区间中心对称的位置已知半径，但截断到右边界；然后只对未知的边界之外继续比较扩展。奇数和偶数分别扫描，两趟复用同一个int半径数组；不构造长度2n的分隔符转换串，也不同时保存两份半径数组。

## 正确性证明

每个非空回文有唯一的奇或偶中心，且其长度由中心及半径唯一确定。某中心最大半径为k时，从1到k的所有同奇偶半径都是回文，更大的不是回文，所以该中心贡献恰为k；对全部中心求和不会遗漏或双计下标区间。

已知区间[l,r]是回文，其内部关于中心对称的字符相等。若当前中心i≤r，对称中心的半径在不越过区间边界的部分可以直接搬到i；若完整镜像半径在边界内结束，决定它不能继续扩张的不等字符也位于区间内，镜像后同样不等。若镜像半径触及边界，只能保证到边界的部分，之后用真实字符比较继续扩展。因此初始化与扩展得到当前最大半径。若扩展超出已知最右边界，则更新[l,r]，保持不变量；左右到右逐中心归纳，两趟所有半径都正确，求和得到答案。

## 复杂度与完整域内存

每趟中镜像可直接确定的部分不重复扩展；成功越界比较会推进r，r最多前进n次，各中心另有常数次失败比较，所以两趟总时间O(n)。额外半径数组为4n字节，字符串为O(n)，不用2n转换串。最大n=32MiB时数组128MiB，字符串及其可能预留容量仍可在原生256MiB限制内运行；必须以实际最大输入内存记录验证，而不是声称所有语言相同内存。题包3秒、256MiB、输出64KiB；本机指标不是Linux沙箱证据。

## 独立验证

小oracle真正枚举每个非空区间并检查该子串与逆序相等，不计算中心半径。163唯一输入（3个公开/补充及160个其它边界与随机输入）真实执行原生参考；另外穷举字母表abc、长度0..6的1093个字符串，对照直接枚举与独立回文树。

回文树为每种不同回文内容建立节点，但每次追加字符时通过suffix-link链上的回文节点数量统计以当前位置结尾的全部回文出现数，再对所有位置求和，所以oracle仍按位置计数，不是节点总数去重计数。中大随机串与周期串通过此不同算法得到期望。两个最大输入分别全a（所有区间，n(n+1)/2）和交替ab（恰好全部奇数长度区间，floor((n+1)²/4)），用独立闭式核验。

三个线性负控分别漏偶数回文、漏单字符、32位溢出，明确不是用naive去重set算法在最大输入上超时来伪造击杀。原例已直接区分位置计数和内容去重。所有正式负控均正常退出才计有效拒绝。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def brute(s):return sum(s[i:j]==s[i:j][::-1] for i in range(len(s)) for j in range(i+1,len(s)+1))
def eertree(s):
 lengths=[-1,0];links=[0,0];nexts=[{},{}];suffix_counts=[0,0];last=1;answer=0
 for pos,ch in enumerate(s):
  node=last
  while pos-1-lengths[node]<0 or s[pos-1-lengths[node]]!=ch:node=links[node]
  if ch not in nexts[node]:
   target=len(lengths);lengths.append(lengths[node]+2);nexts.append({});links.append(0);suffix_counts.append(0);nexts[node][ch]=target
   if lengths[target]==1:links[target]=1
   else:
    suffix=links[node]
    while pos-1-lengths[suffix]<0 or s[pos-1-lengths[suffix]]!=ch:suffix=links[suffix]
    links[target]=nexts[suffix][ch]
   suffix_counts[target]=1+suffix_counts[links[target]]
  last=nexts[node][ch];answer+=suffix_counts[last]
 return answer
def execute(binary,raw,profile=False):
 cmd=[str(binary)]
 if profile:cmd=['/usr/bin/time','-l' if sys.platform=='darwin' else '-v']+cmd
 start=time.perf_counter();p=subprocess.run(cmd,input=raw,text=True,capture_output=True,check=True,timeout=30);metrics={'wallSeconds':round(time.perf_counter()-start,5)}
 if profile:
  pattern=r'(\d+)\s+maximum resident set size' if sys.platform=='darwin' else r'Maximum resident set size \(kbytes\):\s*(\d+)';m=re.search(pattern,p.stderr);assert m,p.stderr
  metrics.update({'peakResidentBytes':int(m[1])*(1 if sys.platform=='darwin' else 1024),'hostPlatform':sys.platform,'method':'native /usr/bin/time','notLinuxSandboxEvidence':True})
 else:assert not p.stderr
 return p.stdout.strip(),metrics
def main():
 start=time.perf_counter();raw_source=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT);assert sha(raw_source)==SOURCE_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw_source).decode().strip()==BLOB
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 small=['hellolle','wowpurerocks','aaa','','a','ab','aa','aba','abba','abcba','abccba','abcdefghijklmnopqrstuvwxyz','zzzzzz'];keys=set(small);rng=random.Random(SEED)
 while len(small)<163:
  s=''.join(rng.choice('abcxyz') for _ in range(rng.randint(1,25)))
  if s not in keys:keys.add(s);small.append(s)
 exhaustive=0
 for n in range(7):
  for chars in product('abc',repeat=n):
   s=''.join(chars);assert brute(s)==eertree(s);exhaustive+=1
 assert exhaustive==1093
 assert [brute(s) for s in small[:3]]==[13,14,6]
 cases=[];oracles=[];large=[]
 with tempfile.TemporaryDirectory(prefix='pure11-native-') as td:
  binary=Path(td)/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  for i,s in enumerate(small):
   raw=s+'\n';expected=brute(s);assert expected==eertree(s);assert execute(binary,raw)[0]==str(expected);oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
   if i<31:cases.append({'name':f'原始样例{i+1}' if i<2 else f'本站补充及暴力核验{i}','input':raw,'expectedOutput':str(expected)+'\n','hidden':i>=3,'weight':1})
  for s in ('hellolle',''):
   raw=s+'\r\n';expected=brute(s);assert execute(binary,raw)[0]==str(expected)
   cases.append({'name':'CRLF行尾-'+('原例' if s else '空串'),'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  print('PureStorage11:163 unique subprocess oracles and1093 exhaustive strings passed',flush=True)
  for name,s in [('随机二字母',''.join(rng.choice('ab') for _ in range(100000))),('随机26字母',''.join(rng.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(200000))),('周期对称','abacaba'*15000),('偶数块','aabb'*25000),('26字母循环','abcdefghijklmnopqrstuvwxyz'*5000),('中等全a','a'*100000)]:
   expected=eertree(s);raw=s+'\n';assert execute(binary,raw)[0]==str(expected);cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  del s
  for n in (65535,65536):
   raw='a'*n+'\n';expected=n*(n+1)//2
   assert eertree(raw[:-1])==expected and execute(binary,raw)[0]==str(expected)
   cases.append({'name':f'32位精确边界全a-{n}','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  for mode in ('all-a-no-final-lf','alternating-with-lf'):
   if mode.startswith('all'):n=LIMIT;raw='a'*n;expected=n*(n+1)//2
   else:n=LIMIT-1;raw=('ab'*(n//2)+'a')+'\n';expected=((n+1)//2)*((n+2)//2)
   assert len(raw)==LIMIT
   out,metrics=execute(binary,raw,True);assert out==str(expected);assert metrics['peakResidentBytes']<256*1024*1024
   cases.append({'name':f'完整32MiB-{mode}','input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
   large.append({'name':mode,'stringLength':n,'inputBytes':len(raw),'expected':expected,'oracle':'all intervals n(n+1)/2; alternating exactly odd intervals floor((n+1)^2/4)','localMetrics':metrics})
   print(f'PureStorage11:{mode} n={n},expected={expected},metrics={metrics}',flush=True)
  kills=[]
  for i,m in enumerate(MUTANTS,1):
   path=OA/f'negative-controls/{PID}-{i}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(m['code']);mb=Path(td)/f'mutant{i}';subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True)
   rejected=[j for j,c in enumerate(cases) if execute(mb,c['input'])[0]!=c['expectedOutput'].strip()];assert rejected;kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 assert len({c['input'] for c in cases})==len(cases)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'按位置计数的回文子串','difficulty':'困难','tags':['OA','Pure Storage','Manacher','字符串'],
 'description':'给定仅含小写英文字母的字符串s，统计所有非空连续回文子串的出现次数。不同下标区间分别计数，即使其内容相同也不去重。',
 'input':'输入一行小写字符串s，支持LF或CRLF行尾，末尾换行也可以省略。行尾不属于字符串。原文无长度数值上界；本站覆盖既有单例32MiB输入预算内的完整字符串域，不借另一题的本站长度上限。无末尾换行时可有33554432个字母。空行表示空串，是本站数学扩展。',
 'output':'输出精确整数，不取模；原Java int接口对完整域过窄，本站明确用64位数学计数。空串输出0。',
 'explanation':'原hellolle有8个单字符、两个位置不同的ll、lol、lloll、ellolle，合计13；wowpurerocks有12个单字符及wow、rer，合计14。原文明确两个ll是不同位置，故不是按内容去重。第三公开例aaa→6为本站推导。',
 'hints':['每个回文有唯一奇数或偶数中心。','最右回文区间内的镜像半径可以复用。','两趟复用一份半径数组，避免2n转换串的内存开销。'],
 'timeLimit':3,'memoryLimit':262144,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 assert len(normalized.encode())<100*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'奇偶中心半径求和且复用存储','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':SOURCE_SHA}],'upstreamCodeExecuted':False,'corrections':['Source explicitly says equal ll at two different positions are distinct substrings. Count occurrences, not distinct content.','Original13/14 both correct and retained. Original int return widened to exact64bit count for transport domain.'],'rangeDisclosure':'Lowercase explicit. No original length maximum; full32MiB existing input domain including no-final-newline case. Empty string is a disclosed mathematical extension; no bounds borrowed from another problem.'}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'固定原文明确相同内容的不同位置分别计数，原13/14正确。原生单数组Manacher覆盖完整32MiB输入，64位数学计数/空串扩展披露，暴力与独立回文树及最大闭式验证解除误读阻断。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Enumerate every substring and compare reversed text; independent eertree suffix-link palindrome count at each position for medium inputs; full-domain closed forms.','exhaustiveSmallDomain':{'cases':exhaustive,'alphabet':'abc','lengthMin':0,'lengthMax':6},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
 print(f'PureStorage11 frozen:{len(cases)}formal,163oracle,1093exhaustive,3mutants;normalizedBytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
