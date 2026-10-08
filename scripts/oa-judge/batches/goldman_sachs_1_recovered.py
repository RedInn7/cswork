#!/usr/bin/env python3
"""Anagram search results: sorted-signature hash groups versus per-pair letter-count comparison."""
from pathlib import Path
from itertools import product,combinations
import hashlib,json,random,subprocess,tempfile,time,string
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-goldman-sachs-1';BATCH='goldman-sachs-1-recovered';SEED=20261011
COMPANY='Goldman Sachs';TITLE='Goldman Sachs OA #1：自动纠错原型'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCES=[
 ('fastprep/Goldman Sachs/autocorrect-prototype.md','0ba3bce55911f9c655d679d5fadb89245768657f','0941e24f5257efa0ba757b21765167fbb5f2c408d4e8cf1ad7fd4065898c0390'),
 ('web/content/docs/companies/goldman-sachs.mdx','8efc97a5920a15a0815088ee41e197524a0517ca','14ea24f08c2a8fdfb8176adf6107d1ac025a14c49b7463c4f44c0efff63318b7'),
]
HASH='aacb9cf2643a5f45c1f8e1fdf96605572a2d35aff0d185e045e9a21b2d5184dc'
SAME_PROBLEM='oa-jpmorgan-chase-26'
CORRECTIONS=['Raw example query "dpede" is a typo: the example explanation says the only anagram of "speed" is "spede" and the expected output ["speed"] requires an anagram of speed; the public sample uses "spede". Not mentioned in the statement.',
 'Raw example line "n = 2" contradicts the four-element words array (constraints define words[n]); stdin gives the actual counts n and q.',
 'Third public sample is authored.']
MAXN=MAXQ=750;MAXL=100
REFERENCE=r'''#include <cstdio>
#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;static char buf[128];vector<string> w(n);
unordered_map<string,vector<int>> groups;groups.reserve(2*n+1);
for(int i=0;i<n;i++){scanf("%127s",buf);w[i]=buf;string k=w[i];sort(k.begin(),k.end());groups[k].push_back(i);}
for(auto &g:groups)sort(g.second.begin(),g.second.end(),[&](int a,int b){return w[a]<w[b];});
int q;scanf("%d",&q);string out;
for(int i=0;i<q;i++){scanf("%127s",buf);string k=buf;sort(k.begin(),k.end());auto it=groups.find(k);
 if(it==groups.end()){out+="0\n";continue;}
 out+=to_string(it->second.size());for(int j:it->second){out+=' ';out+=w[j];}out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
'''
MUTANTS=[
 {'name':'错误按输入顺序而非字典序输出','language':'cpp','code':REFERENCE.replace('for(auto &g:groups)sort(g.second.begin(),g.second.end(),[&](int a,int b){return w[a]<w[b];});\n','')},
 {'name':'错误只比较字母种类忽略次数','language':'cpp','code':REFERENCE.replace('sort(k.begin(),k.end());groups','sort(k.begin(),k.end());k.erase(unique(k.begin(),k.end()),k.end());groups').replace('sort(k.begin(),k.end());auto it','sort(k.begin(),k.end());k.erase(unique(k.begin(),k.end()),k.end());auto it')},
 {'name':'错误用长度与字符和作签名','language':'cpp','code':REFERENCE.replace('string k=w[i];sort(k.begin(),k.end());','string k=w[i];{long s=0;for(char c:k)s+=c;k=to_string(k.size())+":"+to_string(s);}').replace('string k=buf;sort(k.begin(),k.end());','string k=buf;{long s=0;for(char c:k)s+=c;k=to_string(k.size())+":"+to_string(s);}')},
 {'name':'错误排除与查询完全相同的单词','language':'cpp','code':REFERENCE.replace('out+=to_string(it->second.size());for(int j:it->second){out+=\' \';out+=w[j];}','{int c=0;string t;for(int j:it->second)if(w[j]!=buf){c++;t+=\' \';t+=w[j];}out+=to_string(c);out+=t;}')},
]
for x in MUTANTS:assert x['code']!=REFERENCE,x['name']
EDITORIAL='''## 思路：排序签名分组

两个串互为字母异位词，当且仅当它们包含的每个字母次数都相同，也就是把各自字符排序后得到的串相同。把排序后的串称为签名。

1. 对每个单词求签名，用哈希表把单词按签名分组。
2. 每组内部按字典序排序一次。
3. 对每个查询求签名，直接取出对应组输出。

单词本身与查询完全相同时也算异位词（不重排也是一种排列），应当包含在结果里。

## 正确性

签名相同 ⇔ 字母多重集相同 ⇔ 互为异位词，因此每个查询取到的组恰好是全部异位词。组内已按字典序排好，输出顺序正确。只比较字母种类、或用长度加字符和这样的弱签名都会把不同多重集错误地合并。

## 复杂度

设 L 为最大串长。求签名 O((n+q)·L log L)（也可以用 26 维计数做到 O(L)），组内排序 O(n log n·L)，输出与答案规模成正比。

## 独立验证

oracle 不使用签名哈希，而是对每个（查询, 单词）对直接比较 26 个字母的出现次数，O(n·q) 暴力筛出后排序。字母表 {a,b,c}、长度 1..2 的全部 12 个串，枚举其全部非空子集作为单词表，并用所有有异位词的串作查询，逐个运行参考程序。四个正常退出的错误程序（按输入顺序输出、忽略字母次数、长度加字符和签名、排除与查询相同的单词）都在正式数据上被判错。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
LOW=set(string.ascii_lowercase)
def counts(s):
 c=[0]*26
 for ch in s:c[ord(ch)-97]+=1
 return tuple(c)
def encode(words,queries):
 assert 1<=len(words)<=MAXN and 1<=len(queries)<=MAXQ and len(set(words))==len(words)
 sig={counts(w) for w in words}
 for s in words+queries:assert 1<=len(s)<=MAXL and set(s)<=LOW
 for s in queries:assert counts(s) in sig
 return f'{len(words)}\n'+'\n'.join(words)+f'\n{len(queries)}\n'+'\n'.join(queries)+'\n'
def solve(words,queries):
 wc=[counts(w) for w in words];out=[]
 for q in queries:
  c=counts(q);hit=sorted(w for w,x in zip(words,wc) if x==c)
  out.append(' '.join([str(len(hit))]+hit)+'\n')
 return ''.join(out)
def execute(binary,raw):
 start=time.perf_counter();p=subprocess.run([str(binary)],input=raw,text=True,capture_output=True,check=True,timeout=20);assert not p.stderr
 return p.stdout,round(time.perf_counter()-start,5)
def tokens(s):return s.split()
def shuffled(rng,s):l=list(s);rng.shuffle(l);return ''.join(l)
def perms(rng,base,count):
 s=set();tries=0
 while len(s)<count and tries<count*50:s.add(shuffled(rng,base));tries+=1
 return sorted(s,key=lambda _:rng.random())
def rword(rng,lo,hi,alpha=string.ascii_lowercase):return ''.join(rng.choice(alpha) for _ in range(rng.randint(lo,hi)))
def grouped(rng,groups,size,lo,hi,alpha=string.ascii_lowercase):
 words=[]
 for _ in range(groups):words+=perms(rng,rword(rng,lo,hi,alpha),size)
 words=list(dict.fromkeys(words));rng.shuffle(words);return words
def main():
 started=time.perf_counter();bound=[]
 for path,blob,raw_sha in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==raw_sha,path
  assert subprocess.check_output(['git','hash-object','--stdin'],cwd=ROOT,input=raw).decode().strip()==blob
  bound.append({'path':path,'gitBlobSha':blob,'rawSha256':raw_sha})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.cpp';ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(REFERENCE)
 ex1=(['duel','speed','dule','cars'],['spede','deul'])
 assert solve(*ex1)=='1 speed\n2 duel dule\n'
 ex2=(['listen','silent','enlist','tinsel','google'],['inlets','google','elgoog'])
 ex3=(['aab','abb','ab','ba','b'],['aba','bab','ab','b'])
 small=[ex1,ex2,ex3,(['a'],['a']),(['ab','ba'],['ab']),(['aab','aba','baa','abb'],['bba','aab']),(['ad','bc','da','cb'],['ad','bc']),(['z'*100],['z'*100]),(['abc','acb','bac','bca','cab','cba'],['cba','abc','bca']),(['x','xx','xxx'],['xx','x','xxx'])]
 rng=random.Random(SEED);keys={encode(*a) for a in small};assert len(keys)==len(small)
 while len(small)<180:
  words=grouped(rng,rng.randint(1,5),rng.randint(1,4),1,rng.choice([3,6]),rng.choice(['ab','abc','abcd']))
  qs=[shuffled(rng,rng.choice(words)) for _ in range(rng.randint(1,6))]
  a=(words,qs);key=encode(*a)
  if key not in keys:keys.add(key);small.append(a)
 oracles=[{'input':encode(*a),'expectedOutput':solve(*a)} for a in small]
 cases=[];large=[]
 def add(name,a,hidden=True,big=False):
  cases.append({'name':name,'input':encode(*a),'expectedOutput':solve(*a),'hidden':hidden,'weight':1})
  if big:large.append(name)
 names=['原样例','多个异位词与回文查询','字母次数不同不算异位词','单个字母','两个互为异位词','重复字母多重集','字符和相同但不是异位词','最长单个单词','全排列','相同字母不同长度']
 for i,a in enumerate(small[:len(names)]):add(names[i],a,i>=3)
 for i in range(len(names),len(names)+16):add(f'小规模随机{i-len(names)+1}',small[i])
 for t in range(4):
  words=grouped(rng,rng.randint(20,80),rng.randint(2,8),5,40)[:MAXN]
  add(f'中等规模随机分组{t+1}',(words,[shuffled(rng,rng.choice(words)) for _ in range(rng.randint(100,MAXQ))]))
 print(f'{COMPANY} prepared small/medium {len(cases)} formal, {len(oracles)} oracle',flush=True)
 base=''.join(rng.choice('abcdefghij') for _ in range(MAXL));words=perms(rng,base,MAXN)
 add('全部单词互为异位词且查询全命中',(words,[shuffled(rng,base) for _ in range(MAXQ)]),big=True)
 words=grouped(rng,50,15,MAXL,MAXL)[:MAXN];add('五十组最长单词',(words,[shuffled(rng,rng.choice(words)) for _ in range(MAXQ)]),big=True)
 words=[]
 while len(words)<MAXN:
  k=rng.randint(1,99);x,y=rng.sample('abcdefghij',2);a,b=shuffled(rng,x*k+y*(100-k)),shuffled(rng,x*(100-k)+y*k)
  for s in (a,b):
   if s not in words and len(words)<MAXN:words.append(s)
 words=words[:MAXN];add('同字母种类不同次数',(words,[shuffled(rng,rng.choice(words)) for _ in range(MAXQ)]),big=True)
 words=set()
 while len(words)<MAXN:
  m=rng.randint(2,50);words.add(''.join(rng.choice('ad') for _ in range(m))+''.join(rng.choice('bc') for _ in range(m)))
 words=sorted(words,key=lambda _:rng.random());add('长度与字符和碰撞',(words,[shuffled(rng,rng.choice(words)) for _ in range(MAXQ)]),big=True)
 words=grouped(rng,25,30,60,MAXL)[:MAXN];add('查询多为原词本身',(words,[rng.choice(words) for _ in range(MAXQ)]),big=True)
 print(f'{COMPANY} prepared {len(cases)} formal ({len(large)} large), {len(oracles)} oracle; testing native programs',flush=True)
 assert 35<=len(cases)<=64 and len(oracles)>=160 and len(large)<=6
 big_stats=[]
 with tempfile.TemporaryDirectory(prefix='anagram-native-') as tmp:
  tmp=Path(tmp);binary=tmp/'reference';subprocess.run(['c++','-std=c++17','-O2',str(ref),'-o',str(binary)],check=True)
  universe=[''.join(t) for L in (1,2) for t in product('abc',repeat=L)];exhaustive=0
  for mask in range(1,1<<len(universe)):
   words=[universe[i] for i in range(len(universe)) if mask>>i&1];sig={counts(w) for w in words}
   qs=[u for u in universe if counts(u) in sig];e=solve(words,qs)
   assert execute(binary,encode(words,qs))[0]==e;exhaustive+=1
  for item in oracles:assert execute(binary,item['input'])[0]==item['expectedOutput']
  for case in cases:
   actual,elapsed=execute(binary,case['input']);assert actual==case['expectedOutput'],case['name']
   if case['name'] in large:big_stats.append({'name':case['name'],'inputBytes':len(case['input']),'outputBytes':len(case['expectedOutput']),'elapsedSeconds':elapsed})
  print(f'{exhaustive} exhaustive, {len(oracles)} oracle, {len(cases)} formal passed',flush=True)
  kills=[]
  for i,mutant in enumerate(MUTANTS):
   path=OA/f'negative-controls/{PID}-{i+1}.cpp';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(mutant['code']);mb=tmp/f'mutant{i}'
   subprocess.run(['c++','-std=c++17','-O2',str(path),'-o',str(mb)],check=True);rejected=[]
   for j,case in enumerate(cases):
    if tokens(execute(mb,case['input'])[0])!=tokens(case['expectedOutput']):rejected.append(j)
   assert rejected,mutant['name'];kills.append({'name':mutant['name'],'rejectedCases':len(rejected),'rejectedCaseIndices':rejected,'normalExitCases':len(cases)})
   print(f'mutant {i+1} rejected on {len(rejected)} cases',flush=True)
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':TITLE,'difficulty':'简单','tags':['OA',COMPANY,'哈希表','字符串','排序'],
 'description':'实现一个自动纠错功能：给定单词表 words 和若干查询 queries，对每个查询返回单词表中所有与它互为字母异位词的单词，按字典序升序排列。\n\n字母异位词是指把一个串的字母重新排列得到的串，各字母出现次数必须完全相同；与查询完全相同的单词也算。',
 'input':'第一行整数 n，接下来 n 行每行一个单词。然后一行整数 q，接下来 q 行每行一个查询。\n\n1≤n≤750，1≤q≤750；每个单词和查询的长度为 1..100，只含小写英文字母；单词表中的单词互不相同；保证每个查询在单词表中至少有一个异位词。',
 'output':'输出 q 行，第 i 行先输出第 i 个查询的结果个数 k，再按字典序升序输出这 k 个单词，用空格分隔。',
 'explanation':'样例 1：spede 的异位词只有 speed；deul 的异位词是 duel 和 dule。cars 不是任何查询的异位词。\n样例 2：listen、silent、enlist、tinsel 互为异位词，按字典序输出；google 与 elgoog 都对应 google。\n样例 3：aab 与 abb 字母种类相同但次数不同，不互为异位词；查询 ab 的结果包含与它相同的 ab。',
 'hints':['把单词的字符排序后作为签名，异位词的签名相同。','用哈希表按签名分组，每组只需排序一次。','与查询完全相同的单词也要输出。'],
 'timeLimit':2,'memoryLimit':262144,'outputLimit':65536,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 total=len(normalized.encode());assert total<=95*1024*1024,total
 solutions=[{'language':'cpp','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'排序签名分组检索异位词','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':bound,'upstreamCodeExecuted':False,'sameProblemAs':SAME_PROBLEM,
  'rangeDisclosure':'Original: 1<=n,q<=5000, word/query length 1..100; with distinct length-100 words all anagrams of each other the output reaches 5000*5000*101 ~2.5GB. Reduced to 1<=n,q<=750 (worst output 750*(750*101+4) ~56.8MB, fits 64MiB). Length 1..100 kept. Alphabet fixed to lowercase English letters (source examples; source gives no alphabet).',
  'ruleFormalization':['Words in the list are pairwise distinct (source silent on duplicates; avoids an unspecified multiplicity rule).','A word identical to the query counts as an anagram (identity rearrangement).','Each output row is prefixed by its count; tokens checker.'],
  'corrections':CORRECTIONS}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'异位词检索规则完整；n,q缩到750使最坏输出放入64MiB；排序签名哈希分组参考解，逐对字母计数暴力oracle与子集穷举核验。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(oracles),'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceLanguage':'cpp','referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Brute force O(n*q) comparison of 26-letter count vectors per (query, word) pair, then sort; no signature hashing.','exhaustiveSmallDomain':{'cases':exhaustive,'universe':'all 12 strings over {a,b,c} of length 1..2','wordLists':'every non-empty subset','queries':'every universe string with at least one anagram'},'largeBoundaries':big_stats,'packageBytes':total,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'{COMPANY} frozen: {len(cases)} formal,{len(oracles)} oracle,{exhaustive} exhaustive; package={sha(normalized)} bytes={total}',flush=True)
if __name__=='__main__':main()
