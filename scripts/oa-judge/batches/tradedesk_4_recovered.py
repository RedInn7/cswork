#!/usr/bin/env python3
"""TradeDesk threshold triples with explicit cross-company OCR evidence."""
from pathlib import Path
from itertools import product
import hashlib
import json
import random
import runpy
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-tradedesk-4'
BATCH='tradedesk-4-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='5a9c0fcf238eff9ef96065fed7e906936a32ec6b752fde3f584e704457bc43d2'
SOURCES=[
    ('fastprep/Trade Desk/tdesk-buddies-greater-than-threshold.md','a55bec0ba9b9f0580d1b64452ce98624ce1b1a42','89f937b7ac4aecb34cc2503536d633bdeefdefdb5f9f7070f4b0314feb76e3a0'),
    ('OA LIST/TikTok_OA_(新版CodeSignal)/060_QQ_1755908365513.txt','1a0c440393f6f3be64c5b6285b96a7016e32124b','b4a8c704bfda409a8a5dfb2d97f7f3dfbfabb60fabe45a6b4212e645f8ca7b40'),
    ('OA LIST/TikTok_OA_(新版CodeSignal)/061_image.txt','802f24ae242baa8e4ebe8555355b0859e497385c','ae1652d1074d3032dd841d2b79eef3c4ee60aaaa0efab4f11b3a34f9bf6a51d4'),
]
SEED=20261025
REFERENCE='''import sys

def solve(raw):
    values=list(map(int,raw.split()))
    n,threshold=values[:2]
    streak=0
    for index,value in enumerate(values[2:]):
        streak=streak+1 if value>threshold else 0
        if streak==3:
            return str(index-2)
    return '-1'

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
    {'name':'错误将严格大于改为大于等于','code':REFERENCE.replace('value>threshold','value>=threshold')},
    {'name':'错误返回最后一个匹配起点','code':REFERENCE.replace('streak=0','streak=0\n    answer=-1',1).replace('if streak==3:\n            return str(index-2)', 'if streak>=3:\n            answer=index-2').replace("return '-1'",'return str(answer)')},
]
EDITORIAL='''## 固定来源与跨公司同题范围

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Trade Desk/tdesk-buddies-greater-than-threshold.md明确要求：寻找首个下标i，使连续三个值numbers[i]、numbers[i+1]、numbers[i+2]全都严格大于threshold；无解返回−1。原例[0,1,4,3,2,5]、threshold=1输出2正确。i=1时原解释称只有4超过1，遗漏了3；正确理由是三元组[1,4,3]中的1不严格大于1，因此仍不合格。不修改原输入或输出。

TradeDesk raw的Constraints是none，没有数字范围。本题明确采用完全同题OCR的范围，而不声称TradeDesk原文自带：OA LIST/TikTok_OA_(新版CodeSignal)/060_QQ_1755908365513.txt与raw的任务、最早起点、严格比较、无解−1、完整输入[0,1,4,3,2,5]、threshold=1、输出2及逐窗口说明一致；061_image.txt补全3≤n≤1000、−1000≤numbers[i]≤1000、−1000≤threshold≤1000。这个来源连接基于完整规则和样例，不仅是相似标题。

公开第一例保留TradeDesk原例；第二例[-9,95,94,4,5]、threshold=42、输出−1来自同题OCR060，明确标出来源，不冒称TradeDesk原例；第三例[−999,−999,−999]、threshold=−1000、输出0为本站补充。本站序列化为n threshold与n个数组值，输出0-based起点。未执行上游代码。

## 思路

从左到右扫描，维护当前位置结尾、连续严格大于threshold的元素个数streak。当前值合格则加1，否则清零。当streak第一次达到3，返回当前位置减2；扫描结束仍未达到则返回−1。大于等于不符合规则，计数遇到不合格值必须重置，不能累计分散的合格元素。

## 正确性证明

归纳维护不变量：处理下标j后，streak恰是以j结尾的最长全合格连续后缀长度。初始为空成立；当前值合格时旧后缀延长1，不合格时不存在非空合格后缀，重置为0，所以不变量一直成立。

以j结尾的三元组全合格，当且仅当streak至少3。首次达到3时，j−2是一个合法起点；所有更早结束的位置都未形成三连，因此不存在更早合法起点。立即返回即得到最小起点。若一直未达到3，则每个连续三元组均不合格，返回−1正确。

## 复杂度与边界

扫描O(n)时间、O(1)算法额外空间；读取输入需要O(n)空间。完整n≤1000直接处理。合法输出为−1或0..n−3，最末匹配必须能返回n−3。threshold=1000时所有合法输入均无解；threshold=−1000时值等于−1000仍不合格。连续4个或更多合格元素时返回最早位置，而非最后一个三元组。

## 独立验证

oracle显式枚举全部长度3窗口，逐一比较其最小值是否严格大于threshold，并取最小合格起点；不使用连续计数递推。163个唯一输入通过真实参考子进程。额外穷举n=3..7、值域{−1,0,1}、三个阈值的全部9801种组合，对照原创参考与窗口oracle。

正式案例包含完整n=1000、阈值和数组值正负端点、首个与最后三元组、多匹配、长合格段、恰等阈值、不连续三次合格、每两次合格被阻断，以及固定种子随机。两个负控分别将>写成≥、返回最后而非最早匹配，均在所有正式数据正常退出后才计击杀。
'''

def sha(x):
    return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()

def put(folder,name,value):
    p=OA/folder/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def encode(a,t):
    assert 3<=len(a)<=1000 and -1000<=t<=1000 and all(-1000<=x<=1000 for x in a)
    return f'{len(a)} {t}\n'+' '.join(map(str,a))+'\n'

def oracle(a,t):
    matches=[i for i in range(len(a)-2) if min(a[i:i+3])>t]
    return min(matches) if matches else -1

def run(path,raw):
    start=time.perf_counter()
    result=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=10)
    assert not result.stderr
    return result.stdout.strip(),time.perf_counter()-start

def main():
    started=time.perf_counter()
    for p,b,h in SOURCES:
        raw=subprocess.check_output(['git','show',f'{COMMIT}:{p}'],cwd=ROOT)
        assert sha(raw)==h
        assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==b
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    path=OA/f'references/{PID}.py'
    path.write_text(REFERENCE)
    own=runpy.run_path(str(path))['solve']
    digest=hashlib.sha256()
    count=0
    for n in range(3,8):
        for a in product((-1,0,1),repeat=n):
            for t in (-1,0,1):
                expected=oracle(a,t)
                raw=encode(a,t)
                assert int(own(raw))==expected
                digest.update((raw+str(expected)+'\n').encode())
                count+=1
    assert count==9801
    specs=[([0,1,4,3,2,5],1),([-9,95,94,4,5],42),([-999]*3,-1000)]
    keys={encode(a,t) for a,t in specs}
    rng=random.Random(SEED)
    while len(specs)<163:
        t=rng.randint(-1000,1000)
        a=[rng.choice((max(-1000,t-1),t,min(1000,t+1),-1000,1000)) for _ in range(rng.randint(3,35))]
        if encode(a,t) not in keys:
            keys.add(encode(a,t));specs.append((a,t))
    oracles=[]
    for a,t in specs:
        expected=oracle(a,t)
        raw=encode(a,t)
        assert run(path,raw)[0]==str(expected)
        oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
    assert [c['expectedOutput'] for c in oracles[:3]]==['2\n','-1\n','0\n']
    print(f'{PID}:9801 exhaustive checks and163 subprocess oracles passed',flush=True)
    names=['TradeDesk原例','同题TikTok原例','本站负数边界补充例']
    cases=[{'name':names[i] if i<3 else f'独立窗口{i-2}',**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    stress=[
        ('最大阈值全等',[1000]*1000,1000,-1),
        ('最小阈值全等',[-1000]*1000,-1000,-1),
        ('完整全合格',[1000]*1000,-1000,0),
        ('只有最后三项合格',[-1000]*997+[1000]*3,0,997),
        ('只有最前三项合格',[1000]*3+[-1000]*997,0,0),
        ('多个分离匹配',[1]*3+[0]*991+[1]*6,0,0),
        ('每两项即重置',[1,1,0]*333+[1],0,-1),
        ('仅不连续合格',[1,0]*500,0,-1),
        ('阈值相等打断',[1000,1000,999]*333+[1000],999,-1),
        ('末尾四项合格',[0]*996+[1]*4,0,996),
        ('端点负数',[-1000]*500+[-999]*500,-1000,500),
        ('严格递增',list(range(-500,500)),496,997),
        ('严格递减',list(range(500,-500,-1)),497,0),
    ]
    for i in range(3):
        stress.append((f'完整随机{i}',[rng.randint(-1000,1000) for _ in range(1000)],rng.randint(-1000,1000),None))
    evidence=[]
    for name,a,t,closed in stress:
        expected=oracle(a,t)
        if closed is not None:assert expected==closed,name
        raw=encode(a,t)
        actual,elapsed=run(path,raw)
        assert actual==str(expected)
        cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
        evidence.append({'name':name,'n':len(a),'threshold':t,'expected':expected,'independentOracle':'explicit length3 window minimum','closedFormChecked':closed is not None,'localSeconds':round(elapsed,5)})
    assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
    for c in cases:assert run(path,c['input'])[0]==c['expectedOutput'].strip()
    killed=[]
    for i,m in enumerate(MUTANTS,1):
        p=OA/f'negative-controls/{PID}-{i}.py'
        p.write_text(m['code'])
        rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].strip()]
        assert rejected
        killed.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'首个连续三个数都严格超过阈值的位置','difficulty':'简单','tags':['OA','TradeDesk','数组','模拟'],
        'description':'给定整数数组numbers和整数threshold。找到最小的0-based下标i，使numbers[i]、numbers[i+1]、numbers[i+2]均严格大于threshold。不存在这样的三元组则返回−1。三个位置必须连续，等于阈值不算合格。',
        'input':'第一行n threshold，第二行n个数组值。3≤n≤1000，−1000≤numbers[i]≤1000，−1000≤threshold≤1000。TradeDesk原始raw没有数值范围；这里采用任务、完整原例及逐窗口解释一致的同题TikTok OCR060/061所给完整范围，并明确披露来源。',
        'output':'输出首个合法起点i；没有则输出−1。不是返回最后起点或符合条件的数量。',
        'explanation':'第一例保留TradeDesk原输入[0,1,4,3,2,5]、threshold=1和答案2。原解释i=1时说只有4超过1，遗漏3；正确原因是三元组[1,4,3]中1不严格超过1，仍不能选。第二例[-9,95,94,4,5]、threshold=42来自同题TikTok OCR060，输出−1。第三例为本站补充，三个−999都严格超过−1000，输出0。',
        'hints':['按起点从小到大检查长度3窗口。','也可维护当前连续合格元素数，遇到不合格值重置。','第一次形成三连时立即返回。'],
        'timeLimit':2,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized))
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'连续合格后缀首次达到三个的位置','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCES[0][0],'gitBlobSha':SOURCES[0][1],'rawSha256':SOURCES[0][2],'sources':[{'path':p,'gitBlobSha':b,'sha256':h,'role':r} for (p,b,h),r in zip(SOURCES,['TradeDesk rule and first original example; no numeric bounds','identical rule, full first example, step explanations; second OCR example','complete same-problem numeric bounds'])],'upstreamCodeExecuted':False,'sameProblemEvidence':'Identical first input[0,1,4,3,2,5],threshold1,result2,earliest strict triple rule,default-1 and per-window explanations. Not based on title alone.','recoveredConstraints':['3<=n<=1000','-1000<=numbers[i]<=1000','-1000<=threshold<=1000'],'rangeDisclosure':'TradeDesk raw constraints are none. Adopt full bounds from fixed same-problem TikTok061; never claim TradeDesk supplied them.','correction':'Original output2 preserved. Explain i1 rejection by value1, not false claim only4 exceeds1.','siteAdded':'n threshold and array serialization; third public example authored, second transparently from corroboratingOCR.'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'raw规则已完整且原答案2正确，同题TikTok060/061通过完整输入/输出/逐步过程对应提供数值界。公开披露跨公司范围并修解释笔误，9801穷举与163oracle通过，仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':killed,'oracleMethod':'Explicit all length3 windows and minimum comparison, independent of reference running streak.','exhaustiveSmallDomain':{'cases':count,'nMin':3,'nMax':7,'values':[-1,0,1],'thresholds':[-1,0,1],'inputExpectedDigest':digest.hexdigest(),'referenceExecution':'in-process own authored reference, plus163 separate subprocess oracles'},'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}:{len(cases)} formal cases,16 fulln1000 cases,2 normal-exit mutants; candidate frozen',flush=True)

if __name__=='__main__':main()
