#!/usr/bin/env python3
"""Duplicate-source recovery: exact positive-movement state search, full-size cost bounds."""
from pathlib import Path
from functools import lru_cache
from itertools import product
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OA=ROOT/'content/oa-judge'
PID='oa-akuna-capital-22';BATCH='akuna-22-recovered';SEED=20261108
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='83c4129c97dcd1a6f149fa36c56aa499f7131546594318fa7eddc9047192fdcf'
SOURCES=[
 ('OA LIST/Akuna_Capital_OA/009_b37943bb1a068f4571ff295442ffa707.txt','858568a469cb893569abaf231c41d600cd6f234c','87f86e4c2e40361d061399673ebe935b90a2e6ba3792923e7aa9232b9018a099'),
 ('OA LIST/Akuna_Capital_OA/016_QQ_1744468359444.txt','851bd58fb2ab04d241c2eb5de1f695ef0d1d08f8','f854fcc434c2902f5a5b0d56f16b96ed24a9b929486c1e76b2ddf882460d06ce'),
 ('fastprep/Akuna Capital/akuna-maximize-segregation-cost.md','5e9d1652aa8a48d8f8f73cff16b3a12dc43ed72b','18d47b25ab67885ab64d8371c72bd8dc157ec930c1c2b1bcb5508b6cb90f7ce7'),
]
REFERENCE='''import sys

def solve(raw):
    s=raw.strip()
    ones=0
    cost=0
    i=0
    while i<len(s):
        if s[i]=='1':
            ones+=1
            i+=1
        else:
            end=i
            while end<len(s) and s[end]=='0': end+=1
            cost+=ones*(end-i+1)
            i=end
    return str(cost)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
 {'name':'错误只计移动次数不计距离费用','code':REFERENCE.replace('ones*(end-i+1)','ones')},
 {'name':'错误只计移动距离漏每次基础费','code':REFERENCE.replace('ones*(end-i+1)','ones*(end-i)')},
 {'name':'错误以32位有符号数返回累计费用','code':REFERENCE.replace('return str(cost)','return str((cost+2**31)%2**32-2**31)')},
 {'name':'catalog错误每个1仅收一次费用且有序串仍收费','code':"import sys\ns=sys.stdin.read().strip()\nzeros=0\nanswer=0\nfor c in reversed(s):\n    if c=='0': zeros+=1\n    else: answer+=zeros+1\nprint(answer)\n"},
]
EDITORIAL='''## 原来源、重复题关系与纠正

本题与本站已收录的Akuna5 Binary Circuit是同一原始操作题的另一个来源条目，不宣称新增不同算法。本页保留独立ID供提交，算法和规则以固定提交e66f809f4c953bce129f68491726176615db6afc的Akuna_Capital_OA/009和016原OCR为准；FastPrep akuna-maximize-segregation-cost.md具有相同二进制电路背景、强制移动到最右和1+距离费用定义。

009写明例110100总费用2+2+3×3=13；016最终函数定义明确返回maximum possible cost，且原例10100总费用2+3+3=8，给出完整1≤|s|≤100000。因此正文的maximum number of operations措辞不应解释为只数动作次数，本站公开纠正为最大总费用。长度界来自同题OCR016，不伪称FastPrep的N/A约束栏提供了界限。catalog附解按每个1只收一次基础费也不正确：110100得到11而非13，已经有序的01甚至被收1；本站同时纠正附解而不只改标题，且把它作为负控。

一次合法操作必须实际向右移动至少一格。若某个1右边紧接1或已在末尾，它不能执行零距离收费动作；否则可以原地重复并无限收费，与原例有限最优值13/8及“移动”语义矛盾。已完成分离时不执行操作，费用0。每次选择一个右侧至少有一个连续0的1，将其跨过右侧整段连续0，直到末尾或下一个1之前，不能只移动其中一部分。

## 思路

从左到右扫描，维护遇到的1数量a。对每段连续0，设长度z，这段0之前的a个1都必须跨过它，每个可以独立跨该段一次，贡献a·(z+1)。累加所有0段即可，前导0因a=0不贡献。

## 正确性证明

首先，总移动距离与执行顺序无关：每个原来的1都必须与其右侧每个0交换一次相对顺序，不能向左回退，所以距离总和等于初始逆序对数。最大化总费用等价于在固定距离总和上最大化实际移动次数。

把初始连续0段看作带标签的块。操作把一个1从某零段左侧搬到右侧，不会把零段内部插入1，因此原零段不会分裂，只可能与别的零段合并。一个1与一个原零段之间最多发生一次跨越，且只有原来位于该段左侧的1需要跨越。每次正距离动作至少跨越一个原零段，所以动作数至多为所有零段左侧1数量之和。

这个上界可以达到：按原零段从左到右处理，对当前零段左侧的1从右到左依次移动，每个1只跨越当前零段。尚未处理的右侧零段有原来的1隔开，不会被提前合并；已处理的零段只留在这些1左侧。当前零段的每次跨越都用满其连续长度，满足强制最右规则。这样每对需要跨越的1与零段恰好产生一次动作，达到动作数上界。该段长度z的距离贡献az、动作基础费贡献a，总费用a(z+1)。逐段求和得到全局最优。

## 复杂度与整数边界

每个字符扫描常数次，时间O(|s|)，除输入字符串外额外空间O(1)。动作次数不大于逆序对数，故总费用≤2·#逆序对≤|s|²/2；当长度100000时保守上界5000000000，需要64位有符号整数或任意精度整数。原016返回long与此一致，FastPrep单int接口不足以表达完整范围。例50000个1后接50000个0的答案为50000×50001=2500050000，已经超过32位上限。

## 独立验证

小oracle直接枚举当前串中所有可正距离移动的1，构造完整移动后的新串，递归取max(1+距离+后续最优)。终止态没有合法移动时返回0；每次逆序对严格减少，所以搜索无环。它不调用零段公式。穷举长度1..10所有二进制串共2046个，并为163唯一小输入真实执行参考程序。

完整长度构造使用全0/全1/已分离0、单块a个1+b个0的a(b+1)、交替(10)^r的r(r+1)、(01)^r的r(r−1)、前导后缀填充等闭式。其余大域通过反向扫描：对每个1单独累计右侧0总数和原0段总数，不调用参考的正向按0段累积。三个基本负控分别只数次数、漏基础费、32位溢出，另加catalog错误解法；所有正式案例上均要求正常退出。
'''
def sha(x):return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()
def put(folder,name,x):
 p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
@lru_cache(None)
def brute(s):
 best=0
 for i in range(len(s)-1):
  if s[i:i+2]!='10':continue
  j=i+1
  while j+1<len(s) and s[j+1]=='0':j+=1
  moved=s[:i]+'0'*(j-i)+'1'+s[j+1:]
  best=max(best,1+j-i+brute(moved))
 return best
def suffix(s):
 zeros=blocks=answer=0;right='1'
 for ch in reversed(s):
  if ch=='0':
   zeros+=1
   if right!='0':blocks+=1
  else:answer+=zeros+blocks
  right=ch
 return answer
def run(path,s):
 start=time.perf_counter();p=subprocess.run([sys.executable,'-I',str(path)],input=s+'\n',text=True,capture_output=True,check=True,timeout=10)
 assert not p.stderr
 return p.stdout.strip(),time.perf_counter()-start
def main():
 started=time.perf_counter();sources=[]
 for path,blob,h in SOURCES:
  raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT);assert sha(raw)==h
  assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==blob
  sources.append({'path':path,'gitBlobSha':blob,'rawSha256':h})
 source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID);assert source['contentHash']==HASH
 old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
 ref=OA/f'references/{PID}.py';ref.write_text(REFERENCE)
 own={'__name__':'authored_reference'};exec(compile(REFERENCE,str(ref),'exec'),own);exhaustive=0;digest=hashlib.sha256()
 for length in range(1,11):
  for chars in product('01',repeat=length):
   s=''.join(chars);expected=brute(s);assert expected==int(own['solve'](s))==suffix(s)
   digest.update(f'{s}:{expected}\n'.encode());exhaustive+=1
 assert exhaustive==2046
 strings=['110100','10100','01','0','1','10','111','000','1000','1010','1100','01100','100011','100010','111000']
 rng=random.Random(SEED)
 while len(strings)<163:
  s=''.join(rng.choice('01') for _ in range(rng.randint(1,12)))
  if s not in strings:strings.append(s)
 oracles=[]
 for s in strings:
  expected=brute(s);assert run(ref,s)[0]==str(expected)
  oracles.append({'input':s+'\n','expectedOutput':str(expected)+'\n'})
 assert [c['expectedOutput'] for c in oracles[:3]]==['13\n','8\n','0\n']
 cases=[{'name':['原009费用13','原016费用8','本站已分离串0'][i] if i<3 else f'递归合法移动枚举{i-2}',**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:33])]
 print('Akuna22:2046 exhaustive strings and163 unique recursive-search subprocess oracles passed',flush=True)
 stress=[('满长全0','0'*100000,0),('满长全1','1'*100000,0),('满长已分离','0'*50000+'1'*50000,0),('满长单块超32位','1'*50000+'0'*50000,2500050000),('满长10交替','10'*50000,2500050000),('满长01交替','01'*50000,2499950000),('满长单1跨长零段','1'+'0'*99999,100000),('满长单0被全部1跨越','1'*99999+'0',199998),('满长仅尾1','0'*99999+'1',0),('满长前后填充','0'*10000+'1'*40000+'0'*40000+'1'*10000,1600040000),('满长负控移动次数','1000'*25000,None),('满长三1两0块','11100'*20000,None),('满长长块交替',('1'*1000+'0'*1000)*50,None),('满长固定随机',''.join(rng.choice('01') for _ in range(100000)),None)]
 stress.append(('满长高费用混合块','1'*33333+'01'*33333+'0',3333366666))
 large=[]
 for name,s,closed in stress:
  expected=suffix(s)
  if closed is not None:assert expected==closed,name
  actual,elapsed=run(ref,s);assert actual==str(expected),name
  cases.append({'name':name,'input':s+'\n','expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
  large.append({'name':name,'length':len(s),'expected':expected,'closedFormChecked':closed is not None,'oracle':'right-to-left contribution per one, zero counts and original zero-run counts','localSeconds':round(elapsed,5)})
 assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
 kills=[]
 for i,m in enumerate(MUTANTS,1):
  path=OA/f'negative-controls/{PID}-{i}.py';path.write_text(m['code'])
  rejected=[j for j,c in enumerate(cases) if run(path,c['input'].strip())[0]!=c['expectedOutput'].strip()]
  assert rejected;kills.append({'name':m['name'],'normalExitVerified':True,'rejectedByCases':rejected})
 problem={'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'二进制串分离的最大总费用（同源条目）','difficulty':'中等','tags':['OA','Akuna Capital','贪心','字符串'],
 'description':'给定二进制串s，目标把所有0移到所有1之前。一次操作选择一个右侧紧邻至少一个0的1，必须向右跨过整段连续0，移动到末尾或下一个1前，费用为1+移动距离。求完成分离的最大总费用，不是动作次数。操作必须实际移动至少一格，不能原地收费；已分离串费用0。\n\n本条与本站Akuna5 Binary Circuit是同一原始题的重复来源入口，不宣称新增算法；保留本ID独立提交。',
 'input':'一行二进制字符串s，1≤|s|≤100000，仅含0和1。完整长度界来自同题固定OCR016，而非FastPrep的N/A占位约束。',
 'output':'输出最大总费用，一个非负整数，须使用64位整数或大整数。原最终OCR接口为long；FastPrep int声明不能覆盖完整范围。',
 'explanation':'原009例110100费用13，原016例10100费用8，均保留。原正文maximum number of operations按最终函数和费用样例纠正为最大总费用。catalog附解每个1只收一次基础费会将110100误算11，且将已分离01误算1；正确为13和0。第三公开例01是本站补充。零距离动作若计费可无限重复，故不是合法移动。',
 'hints':['所有执行顺序的总移动距离相同。','想办法让每个1分别跨过每个原来位于它右边的0段。','每段0的贡献为左侧1数量乘以该段长度加1。'],'timeLimit':3,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']}
 script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps({'schemaVersion':1,'problem':problem,'cases':cases},ensure_ascii=False),text=True,capture_output=True,check=True).stdout
 solutions=[{'language':'python','code':REFERENCE}]
 put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
 put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'固定距离加上最多合法移动次数','explanation':EDITORIAL,'solutions':solutions})
 put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
 put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'items':{PID:{'contentHash':HASH,'catalogContentHash':HASH,'sourceUrl':source['sourceUrl'],'sources':sources,'upstreamCodeExecuted':False,'sameProblemAs':'oa-akuna-capital-5','constraints':['1<=length(s)<=100000 from originalOCR016','binary alphabet'],'corrections':['Maximum total cost, not just operation count, proved by original final function description and13/8 outputs.','Positive movement required; allowing charged zero-distance actions can make unfinished cases such as110100 unbounded.','Original long return type preserved mathematically; FastPrep int too narrow.','Catalog per-one one-off fee algorithm wrong on110100 and already-segregated01.']}}})
 put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'batch':BATCH,'previousReason':old.get('reason',''),'reason':'同题原OCR009/016最终目标和费用样例明确最大总费用、完整1e5长度；公开纠正次数措辞、附解及int返回过窄，明示与Akuna5重复来源但独立ID可提交，独立合法移动搜索和完整长度验证规则。'}]})
 put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(set(strings)),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':kills,'oracleMethod':'Memoized recursion enumerating actual maximal positive-distance moves, with cost1+distance; full-scale closed forms and independent reverse per-one scan.','exhaustiveSmallDomain':{'cases':exhaustive,'lengthMin':1,'lengthMax':10,'alphabet':'01','inputExpectedDigest':digest.hexdigest()},'largeBoundaries':large,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
 print(f'Akuna22 frozen:{len(cases)}formal,163oracle,2046exhaustive,{len(stress)}full-length,4mutants',flush=True)
if __name__=='__main__':main()
