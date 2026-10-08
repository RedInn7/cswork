#!/usr/bin/env python3
"""Visa2 recovery: alternate searches from the fixed nest, full source domain."""
from pathlib import Path
from itertools import product
import hashlib
import json
import random
import runpy
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-visa-2'
BATCH = 'visa-2-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
HASH = '83b2b509734de08414af81deabfb2f736133bbcf7563d6108c1179d0f7d934df'
SOURCES = [
    ('OA LIST/Visa_OA/004_QQ_1741880069560.txt','86f85146a66b195a5161085aeb7dd12aa8ffe262','ea91b2a3994f400483ed9e8106668d1e52e8c9b0cfe4c0a4aa0afdc7c0264f8a'),
    ('OA LIST/Visa_OA/005_QQ_1741880083135.txt','284a6db292b47982983c7da9af1b635b18ea9417','2a02c9adafddadc838adf50667f4da8d0883111a4dc9ddc0b9c602e168efed31'),
    ('OA LIST/Visa_OA/006_QQ_1741880091766.txt','fef24d6d9ce9fa580653e52a622b680f9d04c37d','5b4f43b9732d3ebc8aea6dea7779ca851efe617a911010cea8d6af38a34fafa3'),
    ('OA LIST/Visa_OA/007_QQ_1741880100789.txt','0c4d164aa615976ba0f9c496c3f2e24090682f76','06a1eaffbe9acad0dbbd941d9c90b299ff463f81381cf6673ac3fd8991f3d465'),
]
SEED = 20261017
REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, bird = data[:2]
    forest = data[2:]
    left = [i for i in range(bird-1, -1, -1) if forest[i]]
    right = [i for i in range(bird+1, n) if forest[i]]
    answer = []
    total = 0
    while total < 100:
        side = right if len(answer) % 2 == 0 else left
        index = side[len(answer) // 2]
        answer.append(index)
        total += forest[index]
    return ' '.join(map(str, answer))

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS = [
    {'name':'错误沿用MDX的采集后位置偏移','code':'''import sys
d=list(map(int,sys.stdin.read().split()))
n,bird=d[:2]
f=d[2:]
position=bird
direction=1
total=0
answer=[]
while total<100:
    i=position
    while 0<=i<n and f[i]==0:
        i+=direction
    if not 0<=i<n:
        break
    total+=f[i]
    f[i]=0
    answer.append(i)
    position=i+direction
    direction=-direction
print(' '.join(map(str,answer)))
'''},
    {'name':'达到恰好100后错误继续','code':REFERENCE.replace('while total < 100:', 'while total <= 100:').replace('index = side[len(answer) // 2]', 'if len(answer) // 2 >= len(side):\n            break\n        index = side[len(answer) // 2]')},
]
EDITORIAL = '''## 固定原始OCR与整理页纠错

固定提交e66f809f4c953bce129f68491726176615db6afc的OA LIST/Visa_OA/004_QQ_1741880069560.txt至007_QQ_1741880100789.txt提供完整规则。每根木棒取走后鸟返回初始位置bird，再向相反方向找最近一根；第一次向右。累计木棒长度至少100时立即停止，返回按采集时间排列的原始0-based下标。

007规定3≤forest.length≤1000、0≤forest[i]≤50、0≤bird<forest.length。004保证forest[bird]=0、sum(forest)≥100。004-005还明确保证：整个过程每次需要向右时右侧仍有非零木棒，需要向左时左侧仍有非零木棒；不会在达到100之前因所需方向空了而越界。此保证比总和至少100更强。本站完整保留，不自创缺棒后的换向或终止规则；生成器独立模拟筛查，违反保证的输入不进入评测。

公司MDX遗漏返回初始位置，其代码从上次采集位置继续搜索；其样例还令forest[bird]=3并包含80，违反原文空巢和50上限。本站恢复OCR而不沿用该非法例。原例为[25,0,50,0,0,0,0,15,0,0,45]、bird=4，依次取位置7、2、10，累计15、65、110，输出[7,2,10]。本站将数组返回序列化为一行空格分隔下标；两个另外公开例均明确标为本站补充。未执行上游代码。

## 思路

列出鸟巢左侧所有木棒下标，按下标递减排列；右侧按下标递增排列。这样各列表就是从巢由近及远的采集顺序。交替从右列表、左列表取下一项，把对应长度加入总和，达到100后停止。即使两根木棒长度相同，也按位置先后采集，不能按长度排序或全局距离排序。

## 正确性证明

鸟每次均回到固定鸟巢。考虑任意一侧：已取木棒变空，而其他木棒原位置不变。因此下一次向该侧出发时，找到的恰好是该侧由近到远列表中尚未取出的第一根。归纳可知左右两个列表分别准确表示各侧所有采集次序。

源规则从右开始，每采集一次切换方向。参考程序按答案长度奇偶交替取右、左列表，并按该侧已被访问次数读取下一下标，因此每步所选木棒与原过程相同。累计值也逐步相同，使用total<100控制循环使停止时刻相同。原题保证每次尚未达到阈值时所需侧有棒，所以每次读取都合法。输出下标序列因此完全正确。

## 复杂度与边界

建立两个下标列表O(n)，每根木棒至多取一次，总时间O(n)、空间O(n)。每根正长度至少1，因此最多取100根；停止前总和≤99，最后一根≤50，所以最终总和≤149。恰好100与超过100都须立即结束。n=3时合法数组必须在空巢两侧各有50；n=1000、稀疏两侧、长串0和每根长度1均直接处理。

## 独立验证

163个唯一oracle每次从固定bird位置逐格行走，遇到首个非零值就置0取走，再返回原点并反向；它不建立左右列表、不调用参考程序。所有oracle与正式输入均校验完整源范围及逐轮有棒保证。另枚举n=3..7、值取0/25/50的全部空巢位置：2590个合法输入逐个对照参考，3412个总和虽足但某轮缺棒的输入被独立识别并排除，只记录统计和摘要，不纳入评测。

正式案例覆盖原例、exact100与overshoot、连续100根长度1、两侧稀疏、n1000、最大值50、极端合法巢位置与距离/长度相反的布局。两类错误程序分别沿用MDX的采集后位置偏移（先沿旧方向跨一步再反向搜索，可能误取同侧下一根），以及达到恰好100后仍继续，均要求在全部正式数据正常退出后才记错解击杀。仅从上次木棒处反向逐格搜索本身可能与回巢等价，不能把这种等价实现误算为负控。
'''


def sha(v):
    return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()


def put(folder,name,value):
    p=OA/folder/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def encode(f,b):
    return f'{len(f)} {b}\n'+' '.join(map(str,f))+'\n'


def oracle(f,b):
    assert 3<=len(f)<=1000 and 0<=b<len(f)
    assert f[b]==0 and all(0<=v<=50 for v in f)
    if sum(f)<100:
        return None
    f=list(f)
    total=0
    direction=1
    result=[]
    while total<100:
        i=b+direction
        while 0<=i<len(f) and f[i]==0:
            i+=direction
        if not 0<=i<len(f):
            return None
        total+=f[i]
        f[i]=0
        result.append(i)
        direction=-direction
    return result


def output(indices):
    return ' '.join(map(str,indices))+'\n'


def run(path,raw):
    start=time.perf_counter()
    p=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=10)
    assert not p.stderr
    return p.stdout.split(),time.perf_counter()-start


def main():
    started=time.perf_counter()
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    for p,b,h in SOURCES:
        raw=subprocess.check_output(['git','show',f'{COMMIT}:{p}'],cwd=ROOT)
        assert sha(raw)==h
        assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==b
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    path=OA/f'references/{PID}.py'
    path.write_text(REFERENCE)
    own=runpy.run_path(str(path))['solve']
    digest=hashlib.sha256()
    legal=invalid=0
    for n in range(3,8):
        for f in product((0,25,50),repeat=n):
            if sum(f)<100:
                continue
            for b in range(n):
                if f[b]:
                    continue
                expected=oracle(f,b)
                if expected is None:
                    invalid+=1
                    continue
                raw=encode(f,b)
                assert own(raw).split()==output(expected).split()
                digest.update((raw+output(expected)).encode())
                legal+=1
    assert (legal,invalid)==(2590,3412)
    specs=[([25,0,50,0,0,0,0,15,0,0,45],4),([50,0,50],1),([40,30,0,40,50],2),([50,0,0,50,50],1)]
    rng=random.Random(SEED)
    keys={encode(f,b) for f,b in specs}
    while len(specs)<163:
        n=rng.randint(3,22)
        b=rng.randrange(1,n-1)
        f=[rng.choice((0,1,10,25,30,40,49,50)) for _ in range(n)]
        f[b]=0
        raw=encode(f,b)
        if raw not in keys and oracle(f,b) is not None:
            specs.append((f,b))
            keys.add(raw)
    oracles=[]
    for f,b in specs:
        expected=oracle(f,b)
        assert expected is not None
        text=encode(f,b)
        assert run(path,text)[0]==output(expected).split()
        oracles.append({'input':text,'expectedOutput':output(expected)})
    assert oracles[0]['expectedOutput']=='7 2 10\n'
    print(f'{PID}: 2590 exhaustive legal states, 3412 invalid rejected, 163 subprocess oracles passed',flush=True)
    cases=[{'name':'原始OCR样例' if i==0 else (f'本站补充样例{i}' if i<3 else f'独立逐格模拟{i-2}'),**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    stress=[]
    for name,value,b in [('千格100根长度1',1,500),('千格全50恰好100',50,500),('千格全49超过100',49,500),('千格全25四根',25,500),('千格靠左合法巢',50,1),('千格靠右合法巢',50,998)]:
        f=[value]*1000
        f[b]=0
        stress.append((name,f,b))
    f=[0]*1000
    f[0]=f[999]=50
    stress.append(('千格仅远端两棒',f,499))
    f=[0]*1000
    for i in range(50):
        f[i*8]=1
        f[999-i*8]=1
    stress.append(('千格稀疏100棒',f,500))
    f=[0]*1000
    f[499]=49
    f[501]=1
    f[502]=50
    f[498]=50
    stress.append(('千格exact100后仍有棒',f,500))
    f=[0]*1000
    f[499]=49
    f[501]=50
    f[999]=50
    stress.append(('千格最终149上界',f,500))
    f=[rng.randint(0,50) for _ in range(1000)]
    f[500]=0
    stress.append(('千格全域固定随机',f,500))
    evidence=[]
    for name,f,b in stress:
        expected=oracle(f,b)
        assert expected is not None,name
        text=encode(f,b)
        actual,elapsed=run(path,text)
        assert actual==output(expected).split(),name
        if name=='千格100根长度1':
            assert expected==[i for d in range(1,51) for i in (500+d,500-d)]
        if name=='千格最终149上界':
            assert sum(f[i] for i in expected)==149
        cases.append({'name':name,'input':text,'expectedOutput':output(expected),'hidden':True,'weight':1})
        evidence.append({'name':name,'n':len(f),'bird':b,'sticksCollected':len(expected),'collectedLength':sum(f[i] for i in expected),'allRequiredSidesAvailable':True,'expectedOutput':output(expected),'localSeconds':round(elapsed,5)})
    assert len(cases)<=64 and len({x['input'] for x in cases})==len(cases)
    for c in cases:
        assert run(path,c['input'])[0]==c['expectedOutput'].split()
    killed=[]
    for i,m in enumerate(MUTANTS,1):
        p=OA/f'negative-controls/{PID}-{i}.py'
        p.write_text(m['code'])
        rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].split()]
        assert rejected
        killed.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'从固定鸟巢交替向两侧收集木棒','difficulty':'简单','tags':['OA','Visa','模拟'],
        'description':'forest中的正整数表示该位置木棒长度，0表示空位。鸟巢固定在下标bird，forest[bird]=0。鸟第一次从巢向右逐格寻找最近非零木棒，将其取走（该位置变0），返回初始鸟巢。下一次从巢向左找最近木棒，再返回巢；之后右、左交替。累计木棒长度达到或超过100时立即停止。返回所有取走木棒的原始0-based下标，按采集顺序排列。保证在累计达到100前，每轮当前需要的一侧都仍有木棒，不会搜索越界。',
        'input':'第一行n和bird，第二行n个整数forest[i]。3≤n≤1000，0≤forest[i]≤50，0≤bird<n，forest[bird]=0，sum(forest)≥100。额外原始保证：依照交替过程，未达到100时所需一侧一定存在尚未取走的正长度木棒；仅总和足够但不满足逐轮保证的数组不是合法输入。',
        'output':'一行空格分隔的0-based原下标，顺序必须与实际采集次序相同；不输出方括号或元素个数。',
        'explanation':'第一例来自原始OCR：bird=4，依次取位置7长度15、位置2长度50、位置10长度45，总110，输出7 2 10。第二例[50,0,50]、bird=1为本站补充，取2再0恰好100。第三例[40,30,0,40,50]、bird=2为本站补充，取3、1、4共120。MDX遗漏返回初始位置，且其样例违反原始空巢及长度上限，本题恢复OCR完整规则，不采用该非法例。',
        'hints':['每次搜索都从固定鸟巢开始，不是从上一根木棒处开始。','分别列出两侧由近到远的木棒。','达到恰好100时也应立即停止。'],
        'timeLimit':2,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',normalize],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized))
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'左右木棒各按由近到远排列，再交替采集','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCES[0][0],'gitBlobSha':SOURCES[0][1],'rawSha256':SOURCES[0][2],'sources':[{'path':p,'gitBlobSha':b,'sha256':h,'role':r} for (p,b,h),r in zip(SOURCES,['return-to-initial-position algorithm and empty-nest guarantee','per-side availability guarantee and original example','original example complete trajectory','complete numeric constraints'])],'upstreamCodeExecuted':False,'recoveredConstraints':['3 <= n <= 1000','0 <= forest[i] <= 50','0 <= bird < n','forest[bird] = 0','sum(forest) >= 100','each required side contains a stick until accumulated length >= 100'],'siteAdded':'标准n bird及数组输入，返回数组编排为一行；原例保留，另两公开例本站补充。','correction':'MDX omits return to initial nest and uses an invalid example with nonempty nest and length80. Fixed OCR requires both reset-to-nest and guaranteed availability of each needed direction; no boundary fallback is invented.'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'原OCR004-007明确每次回初始巢与逐轮所需侧必有棒，旧越界歧义仅来自MDX非法例。恢复完整范围、原例与保证，以逐格oracle和2590合法状态穷举验证。仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'negativeControls':killed,'referenceSha256':sha(REFERENCE),'oracleMethod':'Literal cell-by-cell walk from fixed bird each round, mutating picked cells to0; no side-list construction. Reject inputs if needed side is empty before100.','exhaustiveSmallDomain':{'nMin':3,'nMax':7,'values':[0,25,50],'legalCases':legal,'insufficientSideRejected':invalid,'legalInputExpectedDigest':digest.hexdigest(),'referenceExecution':'in-process own authored reference; separate163 subprocess checks'},'allFormalInputsSourceLegal':True,'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}: {len(cases)} formal cases, 163 oracle subprocesses, 2 normal-exit mutants; candidate frozen',flush=True)


if __name__=='__main__':
    main()
