#!/usr/bin/env python3
"""Lex-smallest palindrome rearrangement of a palindrome; counting reference versus sorted-half oracle."""
from pathlib import Path
from itertools import permutations, product
import hashlib,json,random,subprocess,tempfile,time,string
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-amazon-44';BATCH='amazon-44-recovered';SEED=20261201
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='web/content/docs/companies/amazon.mdx'
RAW_SHA='07d33d58794347890f76b4199a9805d5fac529f0702dea6884e6fce484b69985'
BLOB='70650fad830ad60944ae8036fb4f134d9afc3fab'
HASH='3bafd9d6ec871ff5f6bbf830a0b1b744b0fe7f7723b8b7aaabee81c1fd697315'
MAXN=30000000
REFERENCE=r'''#include <cstdio>
#include <string>
using namespace std;
int main(){string s;s.reserve(1<<25);char buf[1<<16];size_t k;
while((k=fread(buf,1,sizeof buf,stdin))>0)s.append(buf,k);
long long cnt[26]={0};for(char c:s)if(c>='a'&&c<='z')cnt[c-'a']++;
long long n=0;for(int i=0;i<26;i++)n+=cnt[i];
string out(n,'?');long long l=0,r=n-1;
for(int i=0;i<26;i++){for(long long k2=0;k2<cnt[i]/2;k2++){out[l++]=char('a'+i);out[r--]=char('a'+i);}if(cnt[i]%2)out[n/2]=char('a'+i);}
out+='\n';fwrite(out.data(),1,out.size(),stdout);}
'''
SORTED_ONLY=r'''#include <cstdio>
#include <string>
#include <algorithm>
using namespace std;
int main(){string s;char buf[1<<16];size_t k;while((k=fread(buf,1,sizeof buf,stdin))>0)s.append(buf,k);
while(!s.empty()&&(s.back()=='\n'||s.back()=='\r'))s.pop_back();sort(s.begin(),s.end());s+='\n';fwrite(s.data(),1,s.size(),stdout);}
'''
ECHO=r'''#include <cstdio>
int main(){char buf[1<<16];size_t k;while((k=fread(buf,1,sizeof buf,stdin))>0)fwrite(buf,1,k,stdout);}
'''
MUTANTS=[
 {'name':'错误只排序不构成回文','language':'cpp','code':SORTED_ONLY},
 {'name':'错误原样输出输入回文','language':'cpp','code':ECHO},
 {'name':'错误按字典序最大放置','language':'cpp','code':REFERENCE.replace('for(int i=0;i<26;i++){for(long long k2','for(int i=25;i>=0;i--){for(long long k2')},
 {'name':'错误奇数字符放在首位','language':'cpp','code':REFERENCE.replace("string out(n,'?');long long l=0,r=n-1;","string out(n,'?');long long l=n%2,r=n-1;").replace("out[n/2]=char('a'+i);","out[0]=char('a'+i);")},
]
for m in MUTANTS:assert m['code']!=REFERENCE,m['name']
EDITORIAL='''## 题意

给定一个由小写字母组成、本身就是回文的字符串letters。把它的字符重新排列，在所有仍是回文的排列中输出字典序最小的一个。

## 推导

回文由前一半（长度⌊n/2⌋）和可能存在的中心字符唯一确定，后一半是前一半的反转。输入本身是回文，所以每个字母出现次数中至多一个为奇数：n为奇数时恰有一个奇数次字母，它只能放在中心；n为偶数时没有中心。

两个回文比较字典序时，先比较的正是前一半。前一半的字符多重集固定为“每个字母出现次数的一半”，在多重集固定的所有排列中，按非降序排列字典序最小。中心字符已被唯一确定，所以答案是：前一半按a到z非降序排列，中间放奇数次字母（若有），再接前一半的反转。

## 正确性

任一回文排列中，第i个位置与第n−1−i个位置字符相同，因此每个字母在前一半中恰好出现⌊cnt/2⌋次，中心（若有）只能是唯一的奇数次字母。所以所有回文排列与“前一半的一个排列”一一对应。对这些排列，前一半字典序越小整串字典序越小，而多重集的最小排列就是非降序排列。构造出的串确实是回文且字符多重集与输入一致，故它就是答案。

## 复杂度

统计26个计数O(n)，从两端向中间填写O(n)，额外空间为输出串本身。长度可达三千万，参考解用fread整块读入、一次fwrite输出。

## 独立验证

oracle把输入排序后去掉中心字符，再隔一个取一个得到前一半，不复用计数填充；大用例另外逐项检查输出是回文、字符计数与输入相同、前一半非降序。小域穷举：字母表{a,b,c}上长度1..7的全部回文，对每个输入枚举所有不同排列、筛出回文取最小值，并逐个真实运行参考程序。四个正常退出的错误程序（只排序、原样输出、取字典序最大、奇数字符放首位）在正式用例上各自被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def is_pal(s):return s==s[::-1]
def encode(s):
 assert 1<=len(s)<=MAXN and set(s)<=set(string.ascii_lowercase) and is_pal(s)
 return s+'\n'
def counting(s):
 half=''.join(c*(s.count(c)//2) for c in string.ascii_lowercase)
 mid=''.join(c for c in string.ascii_lowercase if s.count(c)%2)
 assert len(mid)<=1
 return half+mid+half[::-1]
def sorted_half(s):
 t=sorted(s)
 if len(t)%2:
  # the unique odd letter sits at an even index whose pair partner differs
  i=0
  while i+1<len(t) and t[i]==t[i+1]:i+=2
  mid=t.pop(i)
 else:mid=''
 half=''.join(t[0::2]);assert ''.join(t[1::2])==half
 return half+mid+half[::-1]
def brute(s):return min(p for p in {''.join(x) for x in permutations(s)} if is_pal(p))
def check_large(s,o):
 assert len(o)==len(s) and is_pal(o)
 for c in string.ascii_lowercase:assert o.count(c)==s.count(c)
 h=o[:len(o)//2];assert all(h[i]<=h[i+1] for i in range(len(h)-1))
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout,round(time.perf_counter()-start,5)
def pal_from(rng,n,alpha):
 h=''.join(rng.choice(alpha) for _ in range(n//2));return h+(rng.choice(alpha) if n%2 else '')+h[::-1]
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 assert '## 44. Get Encoded Name (Lex-Smallest Palindrome)' in raw.decode()
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 assert counting('yxxy')=='xyyx'
 small=['yxxy','cbabc','zz','a','aba','bab','abccba','cbaabc','zzazz','azza','qwertytrewq','abcdedcba','edcbabcde','mmmmmm','baab','xyzzyx','acbca']
 rng=random.Random(SEED);keys=set(small);assert len(keys)==len(small)
 while len(small)<175:
  n=rng.randint(1,40);s=pal_from(rng,n,rng.choice(['ab','abc','xyz','abcdefgh',string.ascii_lowercase]))
  if s not in keys:keys.add(s);small.append(s)
 for s in small:assert counting(s)==sorted_half(s)
 oracles=[{'input':encode(s),'expectedOutput':sorted_half(s)+'\n'} for s in small]
 cases=[];large=[]
 def add(name,s,hidden=True,fast=False):
  e=counting(s)
  if fast:check_large(s,e)
  else:assert e==sorted_half(s)
  cases.append({'name':name,'input':encode(s),'expectedOutput':e+'\n','hidden':hidden,'weight':1})
 names=['原样例','奇数长度中心字符','偶数长度两种字母']
 for i,s in enumerate(['yxxy','cbabc','baab']):add(names[i],s,False)
 pool=[s for s in small[2:] if s not in('cbabc','baab')]
 for i,s in enumerate(pool[:22]):add(f'小规模{i+1}',s)
 add('单个字母z','z');add('全同字母长串','q'*999)
 add('二十六字母倒序回文',string.ascii_lowercase[::-1]+string.ascii_lowercase)
 add('二十六字母奇中心',string.ascii_lowercase[::-1][:-1]+string.ascii_lowercase)
 add('中心是最大字母','a'*500+'z'+'a'*500)
 add('中心是最小字母','z'*500+'a'+'z'*500)
 for n,label in [(1000001,'百万随机奇数长度'),(999998,'百万随机偶数长度')]:
  add(label,pal_from(rng,n,string.ascii_lowercase),fast=True)
 half=''.join(string.ascii_lowercase[(i*7)%26] for i in range(5000000))
 add('千万长度循环字母偶数',half+half[::-1],fast=True);half=None
 h=''.join(rng.choice('yz') for _ in range(4999999))
 add('千万长度两字母奇数',h+'y'+h[::-1],fast=True);h=None
 h=''.join(rng.choice(string.ascii_lowercase) for _ in range(MAXN//2))
 add('三千万长度随机字母',h+h[::-1],fast=True);h=None
 assert len({c['input'] for c in cases})==len(cases)
 print(f'Amazon44 prepared {len(cases)} formal, {len(oracles)} oracle; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='amazon44-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(1,8):
   for hh in product('abc',repeat=n//2):
    for mid in (('a','b','c') if n%2 else ('',)):
     s=''.join(hh)+mid+''.join(hh)[::-1];e=brute(s);assert e==counting(s)==sorted_half(s)
     assert execute(binary,encode(s))[0]==e+'\n';exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput']
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'],case['name']
   if len(case['input'])>=100000:large.append({'name':case['name'],'n':len(case['input'])-1,'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput']:rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Amazon OA #44：Get Encoded Name（字典序最小回文）','difficulty':'简单','tags':['字符串','计数','贪心'],
 'description':'给定一个只含小写字母、并且本身是回文的字符串letters。将它的字符重新排列，在所有仍为回文的排列中，输出字典序最小的那个。',
 'input':'一行字符串letters。1≤|letters|≤3×10^7，只含小写字母a-z，且letters是回文。',
 'output':'输出一行：字典序最小的回文重排。',
 'explanation':'样例1：yxxy的字符为两个x、两个y，回文重排有xyyx和yxxy，较小的是xyyx。样例2：cbabc中a出现一次，只能放在中心，前一半取b、c，得到bcacb。样例3：baab重排为abba。',
 'hints':['回文由前一半和中心字符确定。','输入是回文，至多一个字母出现奇数次，它必须放在中心。','前一半按字母非降序排列即可。'],
 'timeLimit':4,'memoryLimit':262144,'outputLimit':32768,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 payload=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False);total_case_bytes=sum(len(c['input'])+len(c['expectedOutput']) for c in cases);cases_meta=[c['name'] for c in cases];ncases=len(cases);cases=None
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=payload,text=True,capture_output=True,check=True).stdout;payload=None
 assert len(normalized.encode())<128*1024*1024
 solutions=[{'language':'cpp','code':REFERENCE}]
 pkg=OA/'packages'/(PID+'.json');pkg.parent.mkdir(parents=True,exist_ok=True);pkg.write_text(json.dumps(json.loads(normalized),ensure_ascii=False,indent=2)+'\n')
 put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'前一半升序加唯一中心','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'section':'## 44. Get Encoded Name (Lex-Smallest Palindrome)','gitBlobSha':BLOB,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,
  'rangeDisclosure':'Original constraint 1<=|letters|<=10^8 (lowercase palindrome). A 10^8-character input and output cannot fit the 32MiB per-case input / 64MiB expected-output / 128MiB package budgets, so |letters| is capped at 3*10^7 (about 30MB input and 30MB output per maximal case). Alphabet and palindrome precondition unchanged. Stdin is the string on one line; stdout is the answer on one line.',
  'corrections':['None to the original example yxxy -> xyyx. Second and third public examples (cbabc -> bcacb, baab -> abba) are authored.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'规则与样例完整一致；按用户指定的范围政策把长度上限从10^8收到3×10^7（原范围记录在source evidence），计数构造参考解与排序取半oracle、全排列穷举交叉核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':ncases-3,'referenceFormalCases':ncases,'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Independent sorted-multiset half extraction (remove odd centre, take every other char); large cases checked by palindrome, per-letter count and non-decreasing half properties; exhaustive distinct-permutation brute force on small domain.','exhaustiveSmallDomain':{'cases':exhaustive,'lengthMin':1,'lengthMax':7,'alphabet':'abc'},'largeBoundaries':large,'caseBytes':total_case_bytes,'packageBytes':len(normalized.encode()),'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Amazon44 frozen: {ncases} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
