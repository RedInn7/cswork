#!/usr/bin/env python3
"""Original transformed-prefix counting versus direct substring arithmetic."""
from pathlib import Path
from itertools import product
import hashlib,json,random,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-wayfair-2';BATCH='wayfair-2-recovered';SEED=20261118
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
PATH='fastprep/Wayfair/wayfair-number-of-divisible-substrings.md'
RAW_SHA='5fb69db4a22a4b1ae06e8424ad18ddb6b1677e673c4de96ea5eb06dd3ee7f89d'
BLOB='14c8246baab3f4f65c08013712a2725d831c1c77'
HASH='a2e90e672d88cecba4fccc4043779e23123e1ffad5f179e25a3b7e43290674d0'
IMAGE_PATH='content/oa-judge/source-images/wayfair-2-original.jpg'
IMAGE_SHA='63d7c5e6186ab7fd56f35a9c80eda7744b7bb327bf68aa2758c43528439090c8'
IMAGE_URL='https://storage.googleapis.com/fastprepoa.appspot.com/problem_source_images/wayfair-number-of-divisible-substrings.jpg'
GROUPS=['ab','cde','fgh','ijk','lmn','opq','rst','uvw','xyz']
VALUES={c:i+1 for i,group in enumerate(GROUPS) for c in group}
REFERENCE=r'''#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;
int main(){string s;cin>>s;const string mapping="11222333444555666777888999";int n=s.size(),offset=8*n;vector<int>freq(16*n+1);long long answer=0;
for(int average=1;average<=9;average++){fill(freq.begin(),freq.end(),0);int prefix=0;freq[offset]=1;
for(char c:s){prefix+=mapping[c-'a']-'0'-average;answer+=freq[prefix+offset];++freq[prefix+offset];}}
cout<<answer<<'\n';}
'''
MUTANTS=[
 {'name':'错误按每三个字母一组映射','language':'cpp','code':REFERENCE.replace("mapping[c-'a']-'0'","((c-'a')/3+1)")},
 {'name':'错误仅统计平均值等于5的子串','language':'cpp','code':REFERENCE.replace('int average=1;average<=9','int average=5;average<=5')},
 {'name':'错误先登记当前前缀而计入空子串','language':'cpp','code':REFERENCE.replace('answer+=freq[prefix+offset];++freq[prefix+offset];','++freq[prefix+offset];answer+=freq[prefix+offset];')},
]
EDITORIAL='''## 固定原文与缺失映射的恢复依据

固定上游 fastprep/Wayfair/wayfair-number-of-divisible-substrings.md 已完整定义：把字母映射成数字，统计映射值总和可以被长度整除的连续非空子串。长度1..2000且仅小写英文字母，三个原样例asdf→6、bdh→4、abcd→6均完整。原映射图片指向作者本机路径，不能从该路径读取；starter明确引用LC2950。

本站从该FastPrep原问题页公开的Problem Source图片恢复完整映射，实际逐项查看九格表与样例、约束，不凭题名猜表，也不从整理代码反推。来源图网址：https://storage.googleapis.com/fastprepoa.appspot.com/problem_source_images/wayfair-number-of-divisible-substrings.jpg 。保存副本为content/oa-judge/source-images/wayfair-2-original.jpg，SHA256为63d7c5e6186ab7fd56f35a9c80eda7744b7bb327bf68aa2758c43528439090c8。此图是另行取得的公开来源材料，不冒充固定Git快照中的图片。

完整表为：1→ab；2→cde；3→fgh；4→ijk；5→lmn；6→opq；7→rst；8→uvw；9→xyz。注意第一组只有两个字母，不是每组三个，也不是电话九宫格。按位置计数，重复内容出现在不同位置应分别计入；连续且非空，不是子序列或不同字符串去重。

本站输入是一个不加引号的小写字符串，长度1..2000；输出满足条件的子串数量。保留完整原范围，不允许空串，不改变三个原样例。asdf中有效子串为a、s、d、f、as、sdf；bdh为b、d、h、bdh；abcd为a、b、c、d、ab、cd。

## 思路

每个映射值位于1..9，所以一个非空子串的平均值也在1..9。总和被长度整除，当且仅当平均值是整数k∈{1,...,9}。固定k后，将每个值减去k，问题变为统计和为0的子串。

扫描这个变换后的数组，维护前缀和。子串[l,r)的和为0当且仅当前缀和P[l]=P[r]。频次数组先登记空前缀0一次，每得到新的前缀，先把以前相同前缀的次数加入答案，再登记当前前缀。九个k分别扫描，累计答案。每一步的增量绝对值最多8，前缀和位于[−8n,8n]，用加8n的偏移访问数组，不需要哈希。

## 正确性证明

对任意非空子串，设原映射和为S、长度为L>0。若S能被L整除，整数k=S/L必在1..9；在这一轮变换后其和为S−kL=0。若某轮变换后和为0，则S=kL，故该子串满足要求。平均值唯一，所以一个合法子串恰好出现在一轮，不会跨轮重复计数。

固定k，扫描到右端点r时，频次数组只保存严格早于r的前缀。与当前前缀相等的每个左端点l都且仅都对应一个非空零和子串；先查询后登记排除了l=r的空子串。每个子串有唯一右端点，故这一轮精确统计平均值为k的子串。合并九轮，得到所有且仅有合法子串，按不同位置分别计数。

## 复杂度和整数

九轮扫描及频次数组清零均为O(9n)，总时间O(n)，空间O(n)。最大答案为n(n+1)/2，在n=2000时为2001000，可由全部同映射值达到，原int返回足够。参考用64位累计，频次与前缀下标使用int。

## 独立验证

独立oracle按起点和终点双循环，逐个字符加上映射值，再直接判断sum%length==0，不使用平均值枚举或前缀频率。三个原例、163唯一oracle、所有26字母及各组相邻边界均覆盖。另穷举长度1..6、字母acx的1092个字符串并真实运行原生参考。正式满长度覆盖全部九个同值组、全字母周期、反向字母周期、最低/最高交替、相邻映射组、随机全字符和两半极端；同值组用2001000闭式独立复核。三个负控分别错分字母映射、遗漏平均值、错误包含空子串，全部正式例须正常退出才计击杀。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def encode(s):
 assert 1<=len(s)<=2000 and all('a'<=c<='z' for c in s)
 return s+'\n'
def brute(s):
 a=[VALUES[c] for c in s];answer=0
 for left in range(len(a)):
  total=0
  for right in range(left,len(a)):
   total+=a[right];answer+=total%(right-left+1)==0
 return answer
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=10);assert not p.stderr
 return p.stdout.strip(),round(time.perf_counter()-start,5)
def main():
 started=time.perf_counter();raw=subprocess.check_output(['git','show',f'{COMMIT}:{PATH}'],cwd=ROOT);assert sha(raw)==RAW_SHA
 assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==BLOB
 assert sha((ROOT/IMAGE_PATH).read_bytes())==IMAGE_SHA
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 alphabet='abcdefghijklmnopqrstuvwxyz';small=['asdf','bdh','abcd',alphabet,alphabet[::-1],'ab','bc','ef','hi','kl','no','qr','tu','wx','az','aza','aaaa','abab','zzzz']+list(alphabet)
 rng=random.Random(SEED);keys={encode(s) for s in small};assert len(keys)==len(small)
 while len(small)<163:
  s=''.join(rng.choice(alphabet) for _ in range(rng.randint(1,30)));key=encode(s)
  if key not in keys:keys.add(key);small.append(s)
 oracles=[{'input':encode(s),'expectedOutput':str(brute(s))+'\n'} for s in small]
 assert [int(x['expectedOutput']) for x in oracles[:3]]==[6,4,6]
 cases=[];large=[]
 def add(name,s,hidden=True,closed=None):
  expected=brute(s)
  if closed is not None:assert expected==closed
  cases.append({'name':name,'input':encode(s),'expectedOutput':str(expected)+'\n','hidden':hidden,'weight':1})
 for i,s in enumerate(small[:30]):add(('原样例' if i<3 else '本站补充')+str(i+1),s,i>=3)
 for i,group in enumerate(GROUPS):add(f'完整长度同值组{i+1}',(group*2000)[:2000],closed=2001000)
 add('完整长度正向全字母',(alphabet*77)[:2000])
 add('完整长度反向全字母',(alphabet[::-1]*77)[:2000])
 add('完整长度最远映射交替','az'*1000)
 add('完整长度相邻组交替','bc'*1000)
 add('完整长度两半极端','a'*1000+'z'*1000)
 add('完整长度随机全部字符',''.join(rng.choice(alphabet) for _ in range(2000)))
 print(f'Wayfair2 prepared {len(cases)} formal; exact source image hash verified; testing native programs',flush=True)
 with tempfile.TemporaryDirectory(prefix='wayfair2-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++20','-O2',str(ref),'-o',str(binary)],check=True)
  exhaustive=0
  for n in range(1,7):
   for chars in product('acx',repeat=n):
    s=''.join(chars);assert execute(binary,encode(s))[0]==str(brute(s));exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput'].strip()
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'].strip(),case['name']
   if case['name'].startswith('完整'):large.append({'name':case['name'],'length':2000,'expectedOutput':case['expectedOutput'].strip(),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive,163 unique oracle,{len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++20','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if execute(mb,case['input'])[0]!=case['expectedOutput'].strip():rejected.append(j)
   assert rejected;kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'Wayfair OA #2：可整除子串数量','difficulty':'中等','tags':['前缀和','计数','字符串'],
 'description':'将小写字母按以下固定表映射：ab→1，cde→2，fgh→3，ijk→4，lmn→5，opq→6，rst→7，uvw→8，xyz→9。统计连续非空子串中，映射值总和能被子串长度整除的数量。按位置计数，相同内容出现在不同位置分别计算。固定原文的映射图为失效本机路径，本站从原FastPrep页的公开Problem Source原图补全，原文starter同时明确引用LC2950；证据与图片哈希见题解。',
 'input':'输入一个不加引号的小写英文字母字符串word。完整原范围1≤word.length≤2000，不接受空串。',
 'output':'输出符合条件的连续非空子串数量，精确整数，无取模。',
 'explanation':'保留原例：asdf→6，对应a、s、d、f、as、sdf；bdh→4，对应b、d、h、bdh；abcd→6，对应a、b、c、d、ab、cd。第一组ab只有两个字母，不能按每组三个字母或电话键盘映射。',
 'hints':['可整除等价于子串平均映射值为整数。','可能的整数平均值仅有1到9。','固定平均值k后，减去k并统计零和子串。'],
 'timeLimit':2,'memoryLimit':262144,'outputLimit':1024,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'九种整数平均值与相等前缀计数','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':[{'path':PATH,'gitBlobSha':BLOB,'rawSha256':RAW_SHA}],'upstreamCodeExecuted':False,'recoveredSourceImage':{'localPath':IMAGE_PATH,'url':IMAGE_URL,'sha256':IMAGE_SHA,'sourcePage':'https://www.fastprep.io/problems/wayfair-number-of-divisible-substrings','checkedDate':'2026-10-07','visuallyVerified':True,'mappingGroups':GROUPS,'evidenceChain':'Fixed raw contains unavailable local mapping image and explicit LC2950 reference; original FastPrep page Problem Source publicly provides screenshot with all nine mapping groups, same three samples and same constraints.','provenanceNote':'Retrieved public image is separately pinned, not asserted to be present in immutable upstream Git snapshot.'},'rangeDisclosure':'Original lowercase letters and length1..2000 preserved; no empty-string extension.','corrections':['Restore the missing mapping table from actual source image, not inferred code. All three original input/output pairs6/4/6 preserved.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'固定原文规则、范围和样例完整，缺失映射从原FastPrep页公开Problem Source原图逐项核实并单独绑定SHA；九种平均值计数与逐子串求和独立验证覆盖全部字母及满长度。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Direct O(n^2) contiguous substring mapped sums and divisibility; no transformed-prefix counts; same-group full-length triangular closed forms.','exhaustiveSmallDomain':{'cases':exhaustive,'lengthMin':1,'lengthMax':6,'alphabet':'acx'},'mappingLettersChecked':26,'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Wayfair2 frozen: {len(cases)} formal,163 oracle,{exhaustive} exhaustive; package={sha(normalized)} ref={sha(REFERENCE)} bytes={len(normalized.encode())}',flush=True)
if __name__=='__main__':main()
