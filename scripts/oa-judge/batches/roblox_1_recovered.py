#!/usr/bin/env python3
"""Recover building (not demolishing) houses from immutable Roblox OCR."""
from pathlib import Path
from itertools import permutations
import hashlib
import json
import random
import runpy
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-roblox-1'
BATCH='roblox-1-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='aa16ab58dcf298de797e5fb4b8638808509f1a204fed4b10fe7d801799e5f7bf'
SOURCES=[
    ('OA LIST/Roblox/001_image.txt','b66318cf2dd8afbf244024409e65612712119177','2336dff97b80b23d350cb772fea6c9e33fa5b7cf819b3caa996ebe140ec6c9f3'),
    ('OA LIST/Roblox/002_image.txt','3e0f82400f7943df4cd796521c20e295d845716a','2801961c2323bc921cbfbbc590c0ce1a34e1c0468d6d625e9170cbfd78ea5616'),
    ('OA LIST/Roblox/003_image.txt','1fb037744c3c483ba9ac3efabbc406277a0234ad','91e93fdf9bd82195a94a0907ef6b24709b4203171e1fe6d6d731713875a49ce6'),
]
SEED=20261018
REFERENCE='''import sys

def solve(raw):
    values=list(map(int,raw.split()))
    lengths={}
    best=0
    answer=[]
    for x in values[1:]:
        left=lengths.get(x-1,0)
        right=lengths.get(x+1,0)
        length=left+right+1
        lengths[x]=length
        lengths[x-left]=length
        lengths[x+right]=length
        best=max(best,length)
        answer.append(best)
    return ' '.join(map(str,answer))

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
    {'name':'只输出本次新建所在段长度而非全局最长','code':REFERENCE.replace('answer.append(best)','answer.append(length)')},
    {'name':'只考虑左邻居导致向左扩展失效','code':REFERENCE.replace('right=lengths.get(x+1,0)','right=0')},
]
EDITORIAL='''## 固定原始OCR与题义恢复

固定提交e66f809f4c953bce129f68491726176615db6afc的OA LIST/Roblox/001_image.txt至003_image.txt明确：数轴上最初没有任何房屋，按queries依次建房，每次返回当前最长连续房屋段的长度。输入保证坐标互异，且每次新建位置不会同时已有左右相邻房屋。003完整给出1≤queries.length≤100000、−1000000≤queries[i]≤1000000。

公司MDX却写成0..N−1最初全部有房、逐个拆除，并要求返回最长剩余段的位置列表。这不符合固定OCR的操作、输入或返回类型。本站明确恢复原OCR题义，不把MDX另一道题的输出与原题混用；catalog原指纹保持绑定，原始三个文件及各自指纹另行保留。未执行上游代码。本站输入是q及q个坐标，输出q个长度，不存在额外N或有限数轴边界。

两个原例均保留：[2,1,3]依次形成长度1、2、3，输出1 2 3；[1,3,0,4]依次输出1 1 2 2。第三例[−1,−2,10]为本站补充，最后新建孤立房并不会减少已有最大段，输出1 2 2。任何违反坐标互异或新建位置左右已同时占用的序列都不属于原输入域，正式数据不纳入这类输入。

## 思路

用哈希表保存已建位置，并维护每个连续段两个端点上的正确段长度。新位置x的左邻若存在，它必是左边段的右端点，其长度为l；右邻若存在，它必是右边段的左端点，其长度为r。不存在时取0。新段长度l+r+1，边界为x−l与x+r，把新长度写回新点和两个端点，再更新全局最大值。

原题保证l、r不会同时非零，公式仍可统一书写。段内部保存的旧长度无需更新：只有端点才可能与未来合法的新位置相邻。输出每一步的全局最大值，不是仅输出新房所在段长。

## 正确性证明

归纳维护不变式：哈希表的键恰好是所有已建坐标；每个已建连续段的两端点记录正确长度。初始为空显然成立。

新建x此前未占用。若x−1已建而不是其所在段的右端点，则该段还包含x，矛盾；故可从x−1读取整个左段长度。对x+1同理。把x加入后，只会改变与它相邻的连续段，新段端点和长度恰为x−l、x+r、l+r+1。将两端点及x写入哈希表便保持不变式，其余段完全不变。

建房不会破坏原有连续段，所以当前全局最大值等于旧最大值与新段长度之较大者。每次记录此值，即得到题目要求的完整答案序列。

## 复杂度与完整边界

每次查询执行常数次哈希查找及写入，平均时间O(q)，空间O(q)，输出O(q)。不分配覆盖整条无限数轴的数组。坐标可为负数和±1000000；不存在把下标0当作特殊空标记的需要。最长段不超过已建数量≤100000，32位整数足够。

## 独立验证

163个唯一小oracle每次将已建坐标集合重新排序，再扫描相邻差为1的最长连续段；不使用端点长度、并查集或参考程序。另穷举坐标−3..3的所有长度1..7互异序列，3417个满足逐步不可双邻居保证的合法序列，与原创参考函数逐个对照；10282个非法序列只记排除统计，不进入正式评测。

完整100000查询覆盖从最小坐标右扩、从最大坐标左扩、两端交替扩展、全部孤立、双段交错扩展、多段扩展、先构造长段后新增孤立房屋。大数据仍逐步校验原题合法性，并以独立并查集oracle核验，另用结构闭式期望交叉检查。两类正常退出负控分别丢失全局最大值、忽略右侧相邻段，要求全部正式输入正常结束后再记录击杀。
'''


def sha(v):
    return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()


def put(folder,name,value):
    p=OA/folder/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def encode(q):
    return str(len(q))+'\n'+' '.join(map(str,q))+'\n'


def legal(q):
    if not 1<=len(q)<=100000:
        return False
    used=set()
    for x in q:
        if not -1000000<=x<=1000000 or x in used or (x-1 in used and x+1 in used):
            return False
        used.add(x)
    return True


def sorted_oracle(q):
    occupied=set()
    result=[]
    for x in q:
        occupied.add(x)
        ordered=sorted(occupied)
        best=current=1
        for a,b in zip(ordered,ordered[1:]):
            current=current+1 if b==a+1 else 1
            best=max(best,current)
        result.append(best)
    return result


def dsu_oracle(q):
    # Independent component parent/size representation, no endpoint lengths.
    parent={}
    size={}
    def find(x):
        while parent[x]!=x:
            parent[x]=parent[parent[x]]
            x=parent[x]
        return x
    best=0
    out=[]
    for x in q:
        parent[x]=x
        size[x]=1
        for neighbor in (x-1,x+1):
            if neighbor in parent:
                a,b=find(x),find(neighbor)
                if a!=b:
                    if size[a]<size[b]:
                        a,b=b,a
                    parent[b]=a
                    size[a]+=size[b]
        best=max(best,size[find(x)])
        out.append(best)
    return out


def output(a):
    return ' '.join(map(str,a))+'\n'


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
    path=OA/f'references/{PID}.py'
    path.write_text(REFERENCE)
    own=runpy.run_path(str(path))['solve']
    valid_count=invalid_count=0
    digest=hashlib.sha256()
    for n in range(1,8):
        for q in permutations(range(-3,4),n):
            if not legal(q):
                invalid_count+=1
                continue
            expected=sorted_oracle(q)
            assert dsu_oracle(q)==expected
            raw=encode(q)
            assert own(raw).split()==output(expected).split()
            digest.update((raw+output(expected)).encode())
            valid_count+=1
    assert (valid_count,invalid_count)==(3417,10282)
    rng=random.Random(SEED)
    small=[[2,1,3],[1,3,0,4],[-1,-2,10],[0],[-1000000],[1000000],[0,-1,-2,-3],[1,2,3,9]]
    keys={encode(q) for q in small}
    while len(small)<163:
        q=rng.sample(range(-20,21),rng.randint(1,12))
        raw=encode(q)
        if raw not in keys and legal(q):
            keys.add(raw)
            small.append(q)
    oracles=[]
    for q in small:
        assert legal(q)
        expected=sorted_oracle(q)
        assert dsu_oracle(q)==expected
        text=encode(q)
        assert run(path,text)[0]==output(expected).split()
        oracles.append({'input':text,'expectedOutput':output(expected)})
    print(f'{PID}: 3417 exhaustive legal sequences and163 oracle subprocess checks passed',flush=True)
    cases=[{'name':f'原始OCR样例{i+1}' if i<2 else ('本站补充全局最大样例' if i==2 else f'独立排序扫描{i-2}'),**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    n=100000
    increasing=list(range(-1000000,-900000))
    decreasing=list(range(1000000,900000,-1))
    centered=[0]+[v for d in range(1,50000) for v in (-d,d)]+[-50000]
    isolated=list(range(-1000000,-800000,2))
    two=[v for i in range(50000) for v in (-1000000+i,1000000-i)]
    firstlong=list(range(-1000000,-950000))+list(range(0,100000,2))
    blocks=[-1000000+block*10000+offset for offset in range(1000) for block in range(100)]
    shuffled_isolated=isolated.copy()
    rng.shuffle(shuffled_isolated)
    stress=[
        ('十万从最小坐标右扩',increasing,list(range(1,n+1))),
        ('十万从最大坐标左扩',decreasing,list(range(1,n+1))),
        ('十万正负交替扩展',centered,list(range(1,n+1))),
        ('十万全部孤立',isolated,[1]*n),
        ('十万孤立固定乱序',shuffled_isolated,[1]*n),
        ('十万两端双段交错',two,[(i+2)//2 for i in range(n)]),
        ('十万先长段后孤立',firstlong,list(range(1,50001))+[50000]*50000),
        ('十万百段轮流扩展',blocks,[i//100+1 for i in range(n)]),
    ]
    evidence=[]
    for name,q,closed in stress:
        assert len(q)==n and legal(q),name
        expected=dsu_oracle(q)
        assert expected==closed,name
        raw=encode(q)
        actual,elapsed=run(path,raw)
        assert actual==output(expected).split(),name
        cases.append({'name':name,'input':raw,'expectedOutput':output(expected),'hidden':True,'weight':1})
        evidence.append({'name':name,'q':len(q),'minCoordinate':min(q),'maxCoordinate':max(q),'lastAnswer':expected[-1],'expectedSha256':sha(output(expected)),'sourceLegalityChecked':True,'oracle':'independent union-find plus structural closed form','localSeconds':round(elapsed,5)})
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
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'依次建房后的最长连续房屋段','difficulty':'中等','tags':['OA','Roblox','哈希表','区间'],
        'description':'一条整数数轴最初没有任何房屋。按queries的顺序在对应坐标各新建一栋房屋。每次建房后，返回当前所有房屋中最长连续整数坐标段所含的房屋数量。保证所有建房坐标互不相同，而且每次新建位置的左右相邻坐标不会同时已经有房屋。需要返回每次操作后的全局最长长度，而不是新房所在段的长度或位置列表。',
        'input':'第一行整数q，第二行q个整数queries[i]。1≤q≤100000，−1000000≤queries[i]≤1000000。坐标互异；按输入顺序处理时，不会出现queries[i]−1和queries[i]+1均已建房的情况。数轴无额外边界参数N。',
        'output':'输出一行q个整数，依次为各次建房后的最长连续房屋段长度。',
        'explanation':'前两个样例来自原始OCR：[2,1,3]输出1 2 3；[1,3,0,4]输出1 1 2 2。第三例[−1,−2,10]为本站补充，最后孤立房屋不改变全局最大长度，输出1 2 2。固定OCR明确初始空地、依次建房和输出长度；MDX将其误写为初始全占用后拆房并输出位置列表，本题明确纠正整理错误，采用原OCR完整规则和范围。',
        'hints':['用哈希表记录已建坐标，不必分配覆盖整个数轴的数组。','新房只能向已有连续段的端点连接。','保存全局最大值，不要仅输出当前段长。'],
        'timeLimit':3,'memoryLimit':262144,'outputLimit':4096,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',normalize],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized))
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'维护连续房屋段端点长度和全局最大值','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCES[0][0],'gitBlobSha':SOURCES[0][1],'rawSha256':SOURCES[0][2],'sources':[{'path':p,'gitBlobSha':b,'sha256':h,'role':r} for (p,b,h),r in zip(SOURCES,['initial-empty building rules; unique and no-two-neighbors guarantee; first example','two original examples and trajectories','second example and complete numeric constraints'])],'upstreamCodeExecuted':False,'recoveredConstraints':['1 <= q <= 100000','-1000000 <= queries[i] <= 1000000','all coordinates distinct','each insertion has at least one unoccupied adjacent position'],'siteAdded':'标准q及坐标数组输入，输出每步长度；两个原样例保留，第三样例本站补充。','correction':'MDX describes a different demolition task with initially full finite positions and position-list output. Original OCR explicitly starts empty, builds houses and returns lengths; restore OCR rather than inventing a hybrid contract.'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'原OCR001-003规则、两例和十万规模坐标域完整，明确采用初始空地建房而非MDX错写拆房。保留互异与不得双邻保证，3417合法穷举、163排序扫描oracle与满域独立并查集边界通过。仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'negativeControls':killed,'referenceSha256':sha(REFERENCE),'oracleMethod':'After each insertion sort the entire occupied set and scan consecutive coordinates; no endpoint length map.','exhaustiveSmallDomain':{'coordinates':[-3,-2,-1,0,1,2,3],'lengthMin':1,'lengthMax':7,'legalCases':valid_count,'twoNeighborsRejected':invalid_count,'inputExpectedDigest':digest.hexdigest(),'referenceExecution':'in-process own authored reference, separate163 subprocess checks'},'allFormalInputsSourceLegal':True,'largeBoundaryOracle':'Independent union-find roots/sizes plus structural closed forms, all100000 operations checked.','largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}: {len(cases)} formal cases,163 oracle subprocesses,2 normal-exit mutants; candidate frozen',flush=True)


if __name__=='__main__':
    main()
