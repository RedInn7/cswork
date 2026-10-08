#!/usr/bin/env python3
"""SIG aligned allocation: immutable OCR, independent bitmask state oracle."""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-sig-5'
BATCH='sig-5-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='3297d349d86f8a7b577d50404c4a50ca0ac25b178469bd8bf5c0b9392d266314'
SOURCES=[
    ('OA LIST/SIG_OA/011_QQ_1751157677750.txt','1711810018fc7f1488e8d2873b7e9f85c98664a3','de42f75e943977e88dd71bcb8b775db5dd7b83ff750c960c5992428b350d22c4'),
    ('OA LIST/SIG_OA/012_QQ_1751157688232.txt','3789a4c13daaa2d8ae32035ae1ce3233c35a08e5','696bc421eaa969c0621a33929171743e2e448f499bcaea7d43d1c9f01fd7eace'),
    ('OA LIST/SIG_OA/014_QQ_1751157713034.txt','5e59599f62d7cc61abf51395a0c4a65a98737c9e','fb278cc1ad778f1c7ade2b20c1ef3fc08c8aea0607cb628379c4721558a97ebe'),
    ('OA LIST/SIG_OA/015_QQ_1751157721182.txt','900d3dfe1eda267894b9f35226aa0de3e1507eaf','1080944f79627d8be01a8101624e91f2cb55f53a8771abf50e7499967cf9a607'),
]
SEED=20261020
REFERENCE='''import sys

def solve(raw):
    values=list(map(int,raw.split()))
    n,q=values[:2]
    cells=[-1 if v else 0 for v in values[2:2+n]]
    counter=0
    answer=[]
    for offset in range(2+n,len(values),2):
        kind,x=values[offset:offset+2]
        if kind==0:
            start=-1
            for i in range(0,n-x+1,8):
                if all(v==0 for v in cells[i:i+x]):
                    start=i
                    break
            if start==-1:
                answer.append(-1)
            else:
                counter+=1
                cells[start:start+x]=[counter]*x
                answer.append(start)
        else:
            removed=0
            for i in range(n):
                if cells[i]==x:
                    cells[i]=0
                    removed+=1
            answer.append(removed if removed else -1)
    return ' '.join(map(str,answer))

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
    {'name':'失败分配也错误消耗ID','code':REFERENCE.replace('if start==-1:\n                answer.append(-1)','if start==-1:\n                counter+=1\n                answer.append(-1)')},
    {'name':'分配起点错误无需8对齐','code':REFERENCE.replace('range(0,n-x+1,8)','range(0,n-x+1)')},
]
EDITORIAL='''## 固定原始OCR与样例恢复

固定提交e66f809f4c953bce129f68491726176615db6afc的OA LIST/SIG_OA/011_QQ_1751157677750.txt明确：alloc寻找最左侧、起点可被8整除、长度为x的连续空闲区间。仅起点需8对齐，长度不必为8的倍数，可以跨段。分配成功给整块赋新ID，从1开始且只在成功时递增；失败返回−1，不耗ID。erase释放对应ID的整个分配块，返回长度；ID不存在或已释放返回−1。释放后不重用旧ID。初始memory中的1只标记已有占用，没有获得本轮alloc的ID，不能通过新ID释放。

015给完整范围：8≤n≤320，n为8倍数；2≤q≤300；alloc长度1..n；erase参数1..q−1。初始0/1可以任意排列，原例本身包含不在8对齐位置开始的初始占用，所以对齐要求针对本次alloc的新块，不擅加初始占用块形状限制。

012列出的原输入只有15项，与长度保证冲突；MDX建议尾部补0没有原文依据。014第一次alloc2明确只将下标8、9设1，给出的完整16位操作后状态是[0,1,0,0,0,1,1,0,1,1,0,0,1,1,1,1]。把仅本次新占用的8、9恢复为0，即唯一还原原输入[0,1,0,0,0,1,1,0,0,0,0,0,1,1,1,1]。后续每一步完整状态均与此一致；不是随意在末尾补位。保留七个原操作及输出[8,0,−1,2,8,−1,−1]。MDX的ID起点说明也不准确，本站采用011与014明确的1-based成功分配计数。另两个公开例为本站补充。未执行上游代码。

## 思路

维护逐单元状态：0表示空闲，−1表示初始占用，正数表示新分配的ID。alloc按0、8、16……枚举能容纳x个单元的候选起点，检查该区间是否全0，第一次成功就标记新ID；找不到则保持状态与ID计数不变。erase遍历所有单元，清空等于指定ID的项，并统计长度。

## 正确性证明

初始状态准确区分空闲与不可通过本轮ID释放的既有占用。假设处理前状态正确：alloc枚举所有且仅所有合法对齐起点，并按递增顺序检查。区间全0当且仅当可以分配，因此首次成功恰好是要求的最左合法块；按成功次数生成新ID并标记全部单元，保持状态正确。不存在成功候选时返回−1且不修改状态，同样符合规则。

erase中所有持有目标ID的单元恰好是尚未释放的那次分配块，清零并计数即正确释放整块。已删除或从未分配的ID没有任何对应单元，返回−1。计数器不会下降，因此释放后的ID不会再分配。归纳得每个操作的状态及返回值均正确。

## 复杂度与完整边界

分配最多检查n/8个起点、每处至多n个单元，最坏O(n²)；释放O(n)。共O(qn²)时间、O(n+q)空间（含输出）。完整n=320、q=300远小于资源限制。操作结果是起点、块长或−1，均可用普通整数表示。长度320可以占满内存；长度9可跨8单元边界；释放后可立即重新使用空间但须获取新ID。

## 独立验证

163个唯一oracle用大整数bitmask表示占用，每个已分配ID映射一个位掩码。分配枚举左移的连续1掩码，按按位与判空；释放从ID表删除掩码，用按位与反码清空。与参考逐单元ID扫描实现不同，不调用参考代码。全部小输入用真实参考子进程比较。

正式数据覆盖16位原例重建、8单元最小内存、320单元/300次查询、全占用、全空、跨段长度9、整段长度320、首尾边界、失败后再成功、重复释放、未知ID上界299、初始占用不可释放、释放后换新ID、碎片化与随机操作。全部输入严格验证范围；两个错误实现分别失败时也递增ID、忽略8对齐，均须全部正式输入正常退出后才计击杀。
'''


def sha(v):
    return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()


def put(folder,name,value):
    p=OA/folder/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def encode(memory,queries):
    return f'{len(memory)} {len(queries)}\n'+' '.join(map(str,memory))+'\n'+'\n'.join(f'{t} {x}' for t,x in queries)+'\n'


def oracle(memory,queries):
    n=len(memory)
    q=len(queries)
    assert 8<=n<=320 and n%8==0 and 2<=q<=300
    assert all(v in (0,1) for v in memory)
    occupied=sum(v<<i for i,v in enumerate(memory))
    blocks={}
    counter=0
    answers=[]
    for kind,x in queries:
        assert kind in (0,1) and 1<=x<=(n if kind==0 else q-1)
        if kind==0:
            choices=[(i,((1<<x)-1)<<i) for i in range(0,n-x+1,8)]
            feasible=[(i,mask) for i,mask in choices if mask&occupied==0]
            if not feasible:
                answers.append(-1)
                continue
            i,mask=min(feasible)
            counter+=1
            blocks[counter]=mask
            occupied|=mask
            answers.append(i)
        else:
            mask=blocks.pop(x,0)
            answers.append(mask.bit_count() if mask else -1)
            occupied&=~mask
    return answers


def output(values):
    return ' '.join(map(str,values))+'\n'


def run(path,raw):
    started=time.perf_counter()
    p=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=15)
    assert not p.stderr
    return p.stdout.split(),time.perf_counter()-started


def main():
    started=time.perf_counter()
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    for p,b,h in SOURCES:
        raw=subprocess.check_output(['git','show',f'{COMMIT}:{p}'],cwd=ROOT)
        assert sha(raw)==h
        assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==b
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    after_first=[0,1,0,0,0,1,1,0,1,1,0,0,1,1,1,1]
    restored=after_first.copy()
    restored[8:10]=[0,0]
    original_queries=[(0,2),(0,1),(0,1),(1,1),(0,3),(1,4),(0,4)]
    specs=[(restored,original_queries),([0]*8,[(0,8),(1,1)]),([0]*8,[(0,8),(0,1),(1,1),(0,1),(1,2)])]
    rng=random.Random(SEED)
    keys={encode(m,q) for m,q in specs}
    while len(specs)<163:
        n=rng.choice((8,16,24,32))
        q=rng.randint(2,25)
        memory=[rng.randrange(2) for _ in range(n)] if rng.randrange(3) else [0]*n
        queries=[]
        for _ in range(q):
            kind=rng.randrange(2)
            queries.append((kind,rng.randint(1,n if kind==0 else q-1)))
        text=encode(memory,queries)
        if text not in keys:
            keys.add(text)
            specs.append((memory,queries))
    path=OA/f'references/{PID}.py'
    path.write_text(REFERENCE)
    oracles=[]
    for memory,queries in specs:
        expected=oracle(memory,queries)
        text=encode(memory,queries)
        assert run(path,text)[0]==output(expected).split()
        oracles.append({'input':text,'expectedOutput':output(expected)})
    assert oracles[0]['expectedOutput']=='8 0 -1 2 8 -1 -1\n'
    assert oracles[2]['expectedOutput']=='0 -1 8 0 1\n'
    print(f'{PID}: 163 independent bitmask oracle subprocess checks passed',flush=True)
    cases=[{'name':'原OCR逐步状态重建样例' if i==0 else (f'本站补充样例{i}' if i<3 else f'独立位掩码{i-2}'),**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    n=320
    allocate_release=[]
    for i in range(150):
        allocate_release.extend([(0,320),(1,i+1)])
    many_success=[(0,1)]*40+[(1,i) for i in range(1,41)]+[(0,9)]*40+[(1,i) for i in range(41,81)]
    many_success+=( [(1,299)]*(300-len(many_success)) )
    stress=[
        ('320全占用300次分配',[1]*n,[(0,1)]*300,[-1]*300),
        ('320全空未知ID上界',[0]*n,[(1,299)]*300,[-1]*300),
        ('320整块反复分配释放',[0]*n,allocate_release,[v for _ in range(150) for v in (0,320)]),
        ('320先填满后重复失败',[0]*n,[(0,1)]*300,list(range(0,n,8))+[-1]*260),
        ('320跨段分配与多ID释放',[0]*n,many_success,None),
        ('320仅末段可用',[1]*312+[0]*8,[(0,8),(1,1)]+[(1,1)]*298,[312,8]+[-1]*298),
        ('320初始占用不获新ID',[1]+[0]*319,[(1,1),(0,1),(1,1)]+[(1,299)]*297,[-1,8,1]+[-1]*297),
        ('320碎片只非对齐空位',[1,0,0,0,0,0,0,0]*40,[(0,1)]*300,[-1]*300),
        ('8最小内存300操作',[0]*8,[(0,8),(1,1)]+[(1,1)]*298,[0,8]+[-1]*298),
    ]
    for index in range(4):
        memory=[rng.randrange(2) for _ in range(n)] if index%2 else [0]*n
        queries=[]
        for _ in range(300):
            kind=rng.randrange(2)
            queries.append((kind,rng.randint(1,n if kind==0 else 299)))
        stress.append((f'320全范围随机{index+1}',memory,queries,None))
    evidence=[]
    for name,memory,queries,closed in stress:
        expected=oracle(memory,queries)
        if closed is not None:
            assert expected==closed,name
        raw=encode(memory,queries)
        actual,elapsed=run(path,raw)
        assert actual==output(expected).split(),name
        cases.append({'name':name,'input':raw,'expectedOutput':output(expected),'hidden':True,'weight':1})
        evidence.append({'name':name,'n':len(memory),'q':len(queries),'independentBitmaskOracle':True,'closedFormChecked':closed is not None,'expectedSha256':sha(output(expected)),'localSeconds':round(elapsed,5)})
    assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
    for c in cases:
        assert run(path,c['input'])[0]==c['expectedOutput'].split()
    killed=[]
    for i,m in enumerate(MUTANTS,1):
        p=OA/f'negative-controls/{PID}-{i}.py'
        p.write_text(m['code'])
        rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].split()]
        assert rejected
        killed.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'按8对齐的内存分配与ID释放','difficulty':'中等','tags':['OA','SIG','模拟','状态机'],
        'description':'memory为0/1数组，0为空闲，1为初始占用。按顺序处理两类查询。0 x：找最左起点可被8整除、长度为x且全空闲的连续块，成功则占用并返回起点，失败返回−1。长度可以超过8，不要求是8的倍数。每次成功分配获得新ID，从1开始，只在成功时递增，释放后不重用。1 id：释放该ID尚未释放的整块，返回块长；未知或已释放ID返回−1。初始占用没有本轮分配ID，不能通过新ID释放。返回所有查询结果。',
        'input':'第一行n q，第二行n个0/1，随后q行各含两个整数type x。8≤n≤320且n为8倍数；2≤q≤300。type为0或1；type=0时1≤x≤n；type=1时1≤x≤q−1。仅新分配块起点需8对齐，初始0/1排列无额外块边界限制。',
        'output':'输出一行q个整数，依次为每次查询的返回值。',
        'explanation':'原OCR012输入误少一项。本站不采用MDX的尾补0猜测，而从OCR014首轮alloc2后的完整16位状态撤销下标8、9的新占用，唯一还原原输入；随后七步轨迹均一致，保留输出8 0 −1 2 8 −1 −1。另两例为本站补充：8空位分配整块再释放返回0 8；分配8、失败分配1、释放1、分配1、释放2返回0 −1 8 0 1，说明失败不消耗ID。',
        'hints':['用特殊标记区分初始占用与新分配ID。','失败分配不能使ID递增。','起点8对齐，不意味着长度必须为8的倍数。'],
        'timeLimit':2,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',normalize],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized))
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'逐单元维护占用与成功分配ID','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCES[0][0],'gitBlobSha':SOURCES[0][1],'rawSha256':SOURCES[0][2],'sources':[{'path':p,'gitBlobSha':b,'sha256':h,'role':r} for (p,b,h),r in zip(SOURCES,['complete allocation/erase and success-only1-based IDs','query encoding and malformed15-cell sample','complete16-cell state trajectory uniquely reconstructing original input','complete numeric constraints'])],'upstreamCodeExecuted':False,'recoveredConstraints':['8 <= n <= 320, n divisible by8','2 <= q <= 300','memory[i] in0,1','allocation size1..n','erase ID1..q-1'],'originalSampleReconstruction':{'firstAllocation':[0,2],'firstStart':8,'afterFirst':after_first,'restoredInput':restored,'changedIndices':[8,9],'explanation':'Undo only the first newly allocated cells in the explicit16-cell poststate; do not append a guessed trailing bit.'},'correction':'Malformed15-cell input corrected from complete source trajectory. IDs start1 and advance only on successful allocation, not the inaccurate MDX wording.','siteAdded':'标准n q、memory及查询逐行输入，输出结果数组；另两公开例本站补充。'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'OCR011/015状态机与完整范围明确，014完整16位逐步状态可唯一还原012漏项输入并保持原输出。以成功分配1-based ID及不重用规则恢复，163独立位掩码oracle和完整边界通过。仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'negativeControls':killed,'referenceSha256':sha(REFERENCE),'oracleMethod':'Big-integer occupancy bitmask and ID-to-mask map; enumerate aligned masks by bitwise intersection, erase by mask removal, independently of per-cell ID scan.','largeBoundaries':evidence,'allInputsSourceLegal':True,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}: {len(cases)} formal cases,163 oracle subprocesses,2 normal-exit mutants; candidate frozen',flush=True)


if __name__=='__main__':
    main()
