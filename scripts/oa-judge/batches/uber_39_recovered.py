#!/usr/bin/env python3
"""First unique IP stream: first-appearance pointer reference versus ordered-dict oracle and history brute force."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-uber-39';BATCH='uber-39-recovered';SEED=20261204
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='web/content/docs/companies/uber.mdx'
RAW_SHA='6ab55dc6ebb1486ee72776561a824b35579f87e50cb4953baa882ad0da6fff29'
BLOB='e7f6ba66bd8c83d46cc6392e5550e001da075bed'
HASH='d3cad26d71cc08f991be8ae288e7365fe142ee19782d1ab236dd26f2c88f0528'
MAXQ=1500000;MAXD=1000000;MAXL=15
VISIBLE=''.join(chr(c) for c in range(33,127))
REFERENCE=r'''#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <unordered_map>
using namespace std;
int main(){int q;if(scanf("%d",&q)!=1)return 0;unordered_map<string,int> id;id.reserve(size_t(q)+1);
vector<string> order;vector<int> cnt;size_t p=0;char cmd[16],ip[32];string out;
for(int i=0;i<q;i++){scanf("%15s",cmd);
if(cmd[0]=='A'){scanf("%31s",ip);auto r=id.try_emplace(ip,(int)order.size());if(r.second){order.push_back(ip);cnt.push_back(0);}cnt[r.first->second]++;}
else{while(p<order.size()&&cnt[p]>=2)p++;if(p<order.size())out+=order[p];out+='\n';}}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误忽略次数总返回最早出现的IP','language':'cpp','code':REFERENCE.replace('while(p<order.size()&&cnt[p]>=2)p++;','')},
 {'name':'错误出现三次才算不唯一','language':'cpp','code':REFERENCE.replace('cnt[p]>=2','cnt[p]>=3')},
 {'name':'错误空答案不输出空行','language':'cpp','code':REFERENCE.replace("if(p<order.size())out+=order[p];out+='\\n';","if(p<order.size()){out+=order[p];out+='\\n';}")},
 {'name':'错误IP忽略大小写','language':'cpp','code':REFERENCE.replace('scanf("%31s",ip);','scanf("%31s",ip);for(char *c=ip;*c;c++)if(*c>=65&&*c<=90)*c+=32;')},
]
for m in MUTANTS:assert m['code']!=REFERENCE,m['name']
EDITORIAL='''## 题意

服务器按顺序收到命令。ADD ip记录ip的一次访问；FIRST_UNIQUE询问：在到目前为止的所有访问中，恰好出现过一次的IP里，最早出现的是哪一个；没有则答案为空串。按顺序输出每次FIRST_UNIQUE的答案，每个答案占一行，空串输出为空行。

## 关键观察

一个IP的出现次数只会增加。它第一次被ADD时次数为1，成为“唯一”；第二次被ADD后次数变为2，此后永远不再唯一。因此“唯一IP”按首次出现顺序排列时，失去唯一性的IP只会被永久剔除，不会重新加入。

## 算法

给每个不同IP按首次出现顺序编号，记录出现次数，并维护指针p指向“可能是答案的最早编号”。查询时，只要编号p的IP次数≥2就把p后移；停下时若p未越界，答案就是该IP，否则为空串。

## 正确性

不变式：编号小于p的IP次数都≥2，因而永远不是唯一IP。查询时指针跳过的IP次数≥2，同样永远不会再成为答案，所以后移安全。停下的位置是编号≥p中第一个次数为1的IP（新IP次数至少为1），结合不变式，它就是所有唯一IP中首次出现最早的那个；越界说明不存在唯一IP，答案为空串。

## 复杂度

每个ADD一次哈希查询；指针总共最多移动“不同IP数”次，所以总时间期望O(总字符数)，空间O(不同IP总长度)。

## 独立验证

oracle用有序字典保存当前唯一IP（第二次出现时删除），查询取第一个键，不复用指针做法。小域另写历史暴力：每次查询重新统计此前全部ADD的次数，按首次出现顺序找第一个次数为1的IP；在三个IP（含大小写不同的两个）上穷举长度1..6的全部命令序列，并逐个真实运行参考程序。正式用例覆盖原样例、空答案、大小写、指针长距离跳跃、百万个不同IP、高冲突随机等。四个正常退出的错误程序（忽略次数、三次才算不唯一、空答案不输出空行、忽略大小写）在正式用例上各自被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(cmds):
 assert 1<=len(cmds)<=MAXQ and any(c is None for c in cmds)
 assert len({c for c in cmds if c is not None})<=MAXD
 assert all(1<=len(c)<=MAXL and set(c)<=set(VISIBLE) for c in cmds if c is not None)
 return str(len(cmds))+'\n'+''.join('FIRST_UNIQUE\n' if c is None else 'ADD '+c+'\n' for c in cmds)
def ordered(cmds):
 cnt={};uniq={};out=[]
 for c in cmds:
  if c is None:out.append(next(iter(uniq),''))
  else:
   k=cnt.get(c,0)+1;cnt[c]=k
   if k==1:uniq[c]=True
   elif k==2:del uniq[c]
 return out
def history(cmds):
 out=[]
 for i,c in enumerate(cmds):
  if c is None:
   seen=[x for x in cmds[:i] if x is not None];firsts=list(dict.fromkeys(seen))
   out.append(next((x for x in firsts if seen.count(x)==1),''))
 return out
def expect(cmds):return ''.join(x+'\n' for x in ordered(cmds))
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout,round(time.perf_counter()-start,5)
def ipv4(rng):return '.'.join(str(rng.randrange(256)) for _ in range(4))
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 assert '## 39. First Unique IP Hitting the Server' in raw.decode()
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 F=None;A,B,C='1.1.1.1','2.2.2.2','3.3.3.3'
 ex1=[A,B,A,F];ex2=[A,B,A,C,F,B,F]
 assert ordered(ex1)==[B] and ordered(ex2)==[B,C]
 ex3=[F,A,F,A,F,'x',F,'X',F,'x',F]
 small=[ex1,ex2,ex3,[F],[A,F],[A,A,F],[A,A,A,F],[A,B,C,A,B,C,F],[A,B,F,A,F,B,F],['a'*15,F,'a'*14,F,'a'*15,F],['!',F,'~',F,'!',F],
  [A,B,C,C,B,F,A,F],['192.168.0.1',F,'192.168.0.10',F,'192.168.0.1',F]]
 rng=random.Random(SEED);keys={encode(a) for a in small};assert len(keys)==len(small)
 while len(small)<180:
  pool=[''.join(rng.choice(rng.choice([VISIBLE,'aAb','0123456789.'])) for _ in range(rng.randint(1,4))) for _ in range(rng.randint(1,6))]
  cmds=[F if rng.random()<0.35 else rng.choice(pool) for _ in range(rng.randint(1,30))]
  if F not in cmds:cmds.append(F)
  key=encode(cmds)
  if key not in keys:keys.add(key);small.append(cmds)
 for a in small:assert ordered(a)==history(a)
 oracles=[{'input':encode(a),'expectedOutput':expect(a)} for a in small]
 cases=[];large=[]
 def add(name,cmds,hidden=True,check=None):
  out=ordered(cmds)
  if check:check(out)
  cases.append({'name':name,'input':encode(cmds),'expectedOutput':''.join(x+'\n' for x in out),'hidden':hidden,'weight':1})
 names=['原样例1','原样例2','本站补充：空答案与大小写']
 for i,a in enumerate(small[:3]):add(names[i],a,i>=3)
 for i,a in enumerate(small[3:32]):add(f'小规模{i+1}',a)
 def distinct(count):
  s=set()
  while len(s)<count:s.add(''.join(rng.choice(VISIBLE) for _ in range(MAXL)))
  return sorted(s,key=lambda _:rng.random())
 D=distinct(MAXD)
 cmds=[]
 for i,ip in enumerate(D):
  cmds.append(ip)
  if i%2:cmds.append(F)
 add('百万个不同最长IP交替查询',cmds,check=lambda o:o[0]==D[0] and len(o)==MAXD//2);cmds=None
 half=D[:200000];cmds=list(half)
 for ip in half:cmds+=[ip,F]
 add('二十万IP首次出现顺序逐个失效',cmds,check=lambda o:o[-1]=='' and o[0]==half[1]);cmds=half=None
 E=D[:5000];cmds=[]
 for _ in range(MAXQ//2):
  cmds+=[rng.choice(E),F]
 add('一百五十万命令中等基数随机',cmds);cmds=None
 cmds=[A,A]+[F]*199998
 add('二十万次查询全为空',cmds,check=lambda o:set(o)=={''})
 v4=list(dict.fromkeys(ipv4(rng) for _ in range(100500)))[:100000];cmds=v4+v4[:-1]+[F]
 add('十万IPv4仅最后一个唯一',cmds,check=lambda o:o==[v4[-1]])
 cmds=[]
 for _ in range(200000):cmds.append(F if rng.random()<0.4 else rng.choice('aAbB'))
 cmds.append(F)
 add('二十万命令高冲突大小写',cmds)
 D=E=None
 assert len({c['input'] for c in cases})==len(cases)
 print(f'Uber39 prepared {len(cases)} formal, {len(oracles)} oracle; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='uber39-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(1,7):
   for seq in product(['a','A','b',F],repeat=n):
    seq=list(seq)
    if F not in seq:continue
    e=history(seq);assert e==ordered(seq);assert execute(binary,encode(seq))[0]==''.join(x+'\n' for x in e);exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput']
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'],case['name']
   q=int(case['input'].split('\n',1)[0])
   if q>=100000:large.append({'name':case['name'],'commands':q,'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput']:rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Uber OA #39：First Unique IP Hitting the Server','difficulty':'中等','tags':['哈希表','队列','设计'],
 'description':'服务器按顺序收到一串命令，需要支持两种操作：\n\nADD ip：记录一次来自ip的访问。\nFIRST_UNIQUE：在到目前为止的所有访问中，找出恰好出现过一次的IP里最早出现的那个并返回；如果不存在，返回空串。\n\nIP按普通字符串处理，不需要校验格式，大小写不同视为不同的IP。按顺序处理全部命令，输出每次FIRST_UNIQUE的结果。',
 'input':'第一行q，表示命令数。随后q行，每行为ADD ip或FIRST_UNIQUE。1≤q≤1.5×10^6，至少有一条FIRST_UNIQUE；不同IP的数量不超过10^6；每个ip是长度1..15、由ASCII可见字符（编码33..126）组成的串。',
 'output':'对每条FIRST_UNIQUE按顺序输出一行结果；结果为空串时输出一个空行。每行（包括最后一行）都以换行结尾，输出需与标准答案逐字节一致。',
 'explanation':'样例1：三次ADD后1.1.1.1出现两次，唯一的是2.2.2.2。样例2：第一次查询时唯一的有2.2.2.2和3.3.3.3，最早的是2.2.2.2；再次ADD 2.2.2.2后它不再唯一，答案为3.3.3.3。样例3：第一次查询时还没有访问，输出空行；ADD 1.1.1.1后答案为1.1.1.1，它第二次出现后又为空行；之后x成为答案，X是另一个IP，x再次出现后答案变为X。',
 'hints':['一个IP一旦出现第二次，就永远不再唯一。','按首次出现顺序给IP编号，用一个只向前移动的指针跳过失效的IP。','空答案也要输出一行。'],
 'timeLimit':4,'memoryLimit':262144,'outputLimit':32768,'checker':'exact','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 payload=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False);ncases=len(cases);total_case_bytes=sum(len(c['input'])+len(c['expectedOutput']) for c in cases);cases=None
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=payload,text=True,capture_output=True,check=True).stdout;payload=None
 assert len(normalized.encode())<128*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'首次出现顺序加单调指针','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'section':'## 39. First Unique IP Hitting the Server','gitBlobSha':BLOB,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,
  'rangeDisclosure':'Original constraints: total events up to 10^7, distinct IPs up to 10^6, IPs are opaque strings without validation. 10^7 commands cannot fit the 32MiB per-case input (even ADD a plus newline is 6 bytes each), so the command count is capped at 1.5*10^6; distinct IPs keep the original 10^6 bound. To make the stdin protocol unambiguous and bounded, each IP is a whitespace-free token of 1..15 visible ASCII characters (33..126; covers dotted IPv4). Longest ADD line is 20 bytes -> at most 30MB input; each answer at most 16 bytes -> at most 24MB output. At least one FIRST_UNIQUE is guaranteed so the expected output is never empty. The empty-string answer is serialized as an empty line, judged with the exact checker.',
  'corrections':['None to the two original examples. Third public example is authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'ADD/FIRST_UNIQUE语义与两例一致；按用户指定范围政策把命令数上限收到1.5×10^6，不同IP上限保持10^6，IP限定为1..15个可见ASCII字符，空答案输出空行并用exact判题（原范围记录在source evidence）；单调指针参考解与有序字典oracle、历史暴力穷举核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':ncases-3,'referenceFormalCases':ncases,'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Independent insertion-ordered dict of currently unique IPs; per-query history recount brute force on every oracle input and exhaustive small domain.','exhaustiveSmallDomain':{'cases':exhaustive,'lengthMin':1,'lengthMax':6,'tokens':['ADD a','ADD A','ADD b','FIRST_UNIQUE'],'requireQuery':True},'largeBoundaries':large,'caseBytes':total_case_bytes,'packageBytes':len(normalized.encode()),'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Uber39 frozen: {ncases} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
