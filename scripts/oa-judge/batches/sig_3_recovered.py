#!/usr/bin/env python3
"""SIG skeleton recovery with explicit replacement enumeration oracle."""
from pathlib import Path
from itertools import product
from collections import Counter
import hashlib
import json
import random
import runpy
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-sig-3'
BATCH='sig-3-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='1bc0eec1622a653e259ae45abdb33aa74303a0408b7124138905983703ec8fec'
SEED=20261025
SOURCES=[
 ('OA LIST/SIG_OA/008_QQ_1751157647571.txt','1b365c56df3ea3b0cc73621e27be02bad05c2050','75e7f7cdf3ebd817c0294ccd3d1b5afd8aa8990288bbc22af9f699ae85e59a1f'),
 ('OA LIST/SIG_OA/009_QQ_1751157655502.txt','3eb48513253ab2fb4ea4454e0d49b9ecf331e8aa','224974ce0cb4b767da8e21e547ceed1a851d628a2c862d2c7a192f6be63cdb64'),
 ('OA LIST/SIG_OA/010_QQ_1751157661798.txt','8f8f6ec6fa23ffd458d2736381199bdcae432896','f5a26d1fc4d5776552f50afcd1b9db8ff54555c13014d8087fac3d7bc5a1e8f6'),
]
REFERENCE='''import sys

def solve(raw):
    tokens=raw.split()
    word=tokens[0]
    count=int(tokens[1])
    answer=[]
    for skeleton in tokens[2:2+count]:
        letters=set(skeleton)-{'-'}
        if all((a==b if a!='-' else b in letters) for a,b in zip(skeleton,word)):
            answer.append(skeleton)
    return str(len(answer))+'\\n'+'\\n'.join(answer)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANT_LIMITED='''import sys
from collections import Counter
def solve(raw):
    t=raw.split(); word=t[0]; answer=[]
    for s in t[2:2+int(t[1])]:
        supply=Counter(s.replace('-','')); demand=Counter(b for a,b in zip(s,word) if a=='-')
        if all(a=='-' or a==b for a,b in zip(s,word)) and all(demand[c]<=supply[c] for c in demand):
            answer.append(s)
    return str(len(answer))+'\\n'+'\\n'.join(answer)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''
MUTANTS=[{'name':'错误限制每个来源字符仅复制一次','code':MUTANT_LIMITED},
 {'name':'错误允许短横线替换为任意字母','code':REFERENCE.replace('b in letters','True')}]
EDITORIAL='''## 固定原始来源与纠错

固定提交e66f809f4c953bce129f68491726176615db6afc的SIG原OCR008定义：只替换短横线，替换字符来自同一个原skeleton；其余位置不能改变。原例he-lo变hello时原来的l仍保留，说明是复制字符而非搬走字符。每个短横线服从相同替换规则，来源未规定消耗或使用次数限制，不能额外添加只能复制一次的规则。因此一个原有字母可以填多个短横线；所有短横线都没有来源字母的骨架不匹配任何非空word。

008列表误写he-o（长度4），但保证每个骨架和hello等长；009明确写he--o且说明两个短横线都需要l而骨架没有l，故依据009恢复为he--o，不凭猜测补字符。保留原word=hello、骨架[he-lo,he--o,-ell-,hello]和原输出[he-lo,hello]。另两个公开例为本站补充。

009/010给出完整域：word仅小写英文字母，长度1..100；骨架数1..100，每个骨架与word等长，只含小写字母和短横线。结果保留原顺序和重复项，无匹配返回空列表。本站输入为word、骨架数量及各骨架；输出先给匹配数量，再逐行给原骨架，0表示空列表。这只是明确数组序列化，不改变返回值。未执行上游代码。

## 正确性证明

逐个骨架先构建原有字母集合。逐位置检查：固定字母必须等于word对应字母；短横线所需字母必须在该集合中。任一失败，该位置无法合法变为目标，所以整个骨架无解。全部通过时，独立复制每个所需字母填充短横线就能得到word，所以条件也充分。按输入顺序追加原骨架，自然保留顺序和重复，不输出替换后的word。

设骨架数m、word长度n，时间O(mn)，额外工作空间O(26)，保存返回值需O(mn)字符，完整100×100范围很小。

## 独立验证

小域oracle先枚举每个短横线的所有来源字母替换组合，构造完整候选串再与word比较，不调用集合逐位判定。163唯一oracle含原例、重复复制、全短横线、重复骨架及固定位置冲突。另穷举二字母域长度1..4的所有word和骨架组合。

大域使用另一判定：统计短横线目标需求的字符频数，并与原骨架正频数的支持集合对照，同时检查固定位置；不限制需求次数。正式输入含多组100个长度100骨架、全26字母、单一来源复制99次、空结果和顺序重复混合。两个负控分别错误限制来源字符复制次数、允许任意字母替换；必须在全部正式例正常退出后才计击杀。
'''

def sha(v):
    return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()

def put(folder,name,value):
    p=OA/folder/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def encode(word,skeletons):
    assert 1<=len(word)<=100 and all('a'<=x<='z' for x in word)
    assert 1<=len(skeletons)<=100
    assert all(len(s)==len(word) and all(c=='-' or 'a'<=c<='z' for c in s) for s in skeletons)
    return word+'\n'+str(len(skeletons))+'\n'+'\n'.join(skeletons)+'\n'

def output(items):
    return str(len(items))+'\n'+''.join(s+'\n' for s in items)

def enumeration(word,s):
    positions=[i for i,c in enumerate(s) if c=='-']
    alphabet=sorted(set(s)-{'-'})
    for replacement in product(alphabet,repeat=len(positions)):
        candidate=list(s)
        for i,c in zip(positions,replacement):candidate[i]=c
        if ''.join(candidate)==word:return True
    return False

def histogram(word,s):
    supply=Counter(s)
    demand=Counter()
    for i in range(len(word)):
        if s[i]=='-':demand[word[i]]+=1
        elif s[i]!=word[i]:return False
    return all(supply[c]>0 for c in demand)

def run(path,raw):
    p=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,timeout=10,check=True)
    assert not p.stderr
    return p.stdout.split()

def main():
    started=time.perf_counter()
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    for path,blob,digest in SOURCES:
        raw=subprocess.check_output(['git','show',f'{COMMIT}:{path}'],cwd=ROOT)
        assert sha(raw)==digest
        assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==blob
    ref=OA/f'references/{PID}.py';ref.write_text(REFERENCE)
    own=runpy.run_path(str(ref))['solve']
    digest=hashlib.sha256(); exhaustive=0
    for length in range(1,5):
        for chars in product('ab',repeat=length):
            word=''.join(chars)
            for symbols in product('ab-',repeat=length):
                s=''.join(symbols);expected=[s] if enumeration(word,s) else []
                raw=encode(word,[s]);assert own(raw).split()==output(expected).split()
                assert histogram(word,s)==bool(expected)
                digest.update((raw+output(expected)).encode());exhaustive+=1
    specs=[('hello',['he-lo','he--o','-ell-','hello']),('aaaa',['a---','----','a---','aaaa']),('ab',['--','aa','-b'])]
    rng=random.Random(SEED);keys={encode(*s) for s in specs}
    while len(specs)<163:
        n=rng.randint(1,6);word=''.join(rng.choice('abc') for _ in range(n))
        skeletons=[''.join(rng.choice('abc-') for _ in range(n)) for _ in range(rng.randint(1,12))]
        if rng.randrange(2):skeletons.append(word)
        raw=encode(word,skeletons)
        if raw not in keys:keys.add(raw);specs.append((word,skeletons))
    oracles=[]
    for word,ss in specs:
        expected=output([s for s in ss if enumeration(word,s)])
        raw=encode(word,ss);assert run(ref,raw)==expected.split()
        oracles.append({'input':raw,'expectedOutput':expected})
    cases=[{'name':'原OCR纠正漏横线例' if i==0 else f'替换枚举{i}',**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    letters='abcdefghijklmnopqrstuvwxyz';full=(letters*4)[:100]
    stress=[('单源复制99次','a'*100,['a'+'-'*99]*100),('满域全横线无解','a'*100,['-'*100]*100),
      ('满域全部原词重复','z'*100,['z'*100]*100),('满域固定不匹配','a'*100,['b'+'a'*99]*100),
      ('26字母全部来源',full,[full[:26]+'-'*74]*100),('需求字母不存在','z'*100,['a'+'-'*99]*100),
      ('来源只在末尾','a'*100,['-'*99+'a']*100),('长度1空与匹配保序','a',['-','a','b','a']*25),
      ('两来源重复复制','ab'*50,['ab'+'-'*98,'a-'*50,'-b'*50,'ab'*50]*25),
      ('混合保序保重','a'*100,['a'+'-'*99,'-'*100,'-'*99+'a','b'+'-'*99]*25)]
    for i in range(4):
        word=''.join(rng.choice(letters) for _ in range(100));ss=[]
        for _ in range(100):
            s=''.join('-' if rng.randrange(3)==0 else c for c in word)
            if rng.randrange(4)==0:s=rng.choice(letters)+s[1:]
            ss.append(s)
        stress.append((f'完整字母随机{i+1}',word,ss))
    evidence=[]
    for name,word,ss in stress:
        expected=output([s for s in ss if histogram(word,s)]);raw=encode(word,ss)
        assert run(ref,raw)==expected.split()
        cases.append({'name':name,'input':raw,'expectedOutput':expected,'hidden':True,'weight':1})
        evidence.append({'name':name,'wordLength':len(word),'skeletonCount':len(ss),'expectedSha256':sha(expected),'oracle':'character-demand histogram and fixed-position equality'})
    assert len({c['input'] for c in cases})==len(cases)<=64
    killed=[]
    for i,m in enumerate(MUTANTS,1):
        path=OA/f'negative-controls/{PID}-{i}.py';path.write_text(m['code'])
        rejected=[j for j,c in enumerate(cases) if run(path,c['input'])!=c['expectedOutput'].split()]
        assert rejected
        killed.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'复制骨架已有字母匹配目标词','difficulty':'简单','tags':['OA','SIG','字符串','集合'],
     'description':'给定小写目标word和等长骨架列表。骨架只含小写字母和短横线。每个短横线可替换为该原骨架已有的任意字母；复制不消耗字母，同一字母可重复用于多个短横线。其他位置保持不变。返回能够变成word的原骨架，保持输入顺序和重复项；无匹配返回空列表。',
     'input':'第一行word，第二行骨架数量m，随后m行各一个骨架。1≤word长度≤100，1≤m≤100，所有骨架与word等长。word仅a..z，骨架仅a..z和-。',
     'output':'第一行匹配数量，随后逐行输出匹配的原骨架。没有匹配时仅输出0，不输出替换后的word。',
     'explanation':'原OCR008误写he-o，009明确为he--o（两个横线且缺l），按009修复。hello的四个原骨架he-lo、he--o、-ell-、hello中只有he-lo和hello符合。原l仍保留且复制填横线；原文没有消耗或次数限制。另两公开例为本站补充，aaaa可由a---重复复制得到，全部横线因没有来源字母而失败。',
     'hints':['固定位置必须逐位相同。','每个短横线只能复制原骨架已有的字母，没有次数限制。','输出原骨架，保留重复和顺序。'],
     'timeLimit':2,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    parsed=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True)
    assert parsed.returncode==0,parsed.stderr
    normalized=parsed.stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'固定位置与原字符集合','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    path,blob,digest_source=SOURCES[0]
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':path,'gitBlobSha':blob,'rawSha256':digest_source,'sources':[{'path':p,'gitBlobSha':b,'sha256':h} for p,b,h in SOURCES],'upstreamCodeExecuted':False,'recoveredConstraints':['word length1..100 lowercase','skeleton count1..100','equal length and lowercase or hyphen','preserve order and duplicates'],'correction':'008 he-o is corrected by009 explicit he--o and explanation of two missing l letters. Copy is not moving or consumable; no invented quota.','siteAdded':'Count-prefixed output array and word/count/skeleton input; two supplemental public examples.'}}})
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'008/009说明原字母保留并复制，原文不存在次数消耗限制；010完整100×100域。依009纠正漏横线，替换穷举及满域频数oracle通过，仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'referenceFormalCases':len(cases),'publicCases':3,'hiddenCases':len(cases)-3,'referenceSha256':sha(REFERENCE),'negativeControls':killed,'oracleMethod':'Explicit Cartesian enumeration of all hyphen replacements then whole-string equality; large-domain demand histogram.','exhaustiveSmallDomain':{'alphabet':'ab','lengthMin':1,'lengthMax':4,'cases':exhaustive,'inputExpectedDigest':digest.hexdigest()},'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'allInputsSourceLegal':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(json.dumps({'batch':BATCH,'formal':len(cases),'oracles':163,'exhaustive':exhaustive,'packageChecksum':sha(normalized),'referenceSha256':sha(REFERENCE),'negativeControls':killed},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
