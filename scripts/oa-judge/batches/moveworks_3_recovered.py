#!/usr/bin/env python3
"""Beautiful numbers: combination reference versus independent moment digit DP."""
from pathlib import Path
from functools import lru_cache
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-moveworks-3'
BATCH='moveworks-3-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCE='fastprep/Moveworks/moveworks-sum-of-cubes-of-beautiful-numbers.md'
BLOB='16a489b0ebed179c9856dda9a74eca7172b49c19'
RAW_SHA='b1db27f213441ecf81474611b83d57a2575d3f16de856dc020d6b134ab8cb887'
HASH='1d783733b833355d558c6a558a4272d0bdb92ae6e1e7a55b145b8de3f2056718'
MOD=998244353
LIMIT=10**18
SEED=20261023
REFERENCE='''import sys
from itertools import combinations
from bisect import bisect_left, bisect_right

MOD=998244353

def solve(raw):
    data=list(map(int,raw.split()))
    queries=list(zip(data[1::2],data[2::2]))
    maximum=max(r for l,r in queries)
    numbers=[]
    for length in range(2,maximum.bit_length()+1):
        base=(1<<length)-1
        for count in range(1,4):
            for positions in combinations(range(length-1),count):
                value=base-sum(1<<p for p in positions)
                if value<=maximum:
                    numbers.append(value)
    numbers.sort()
    prefix=[0]
    for value in numbers:
        prefix.append((prefix[-1]+pow(value,3,MOD))%MOD)
    return '\\n'.join(str((prefix[bisect_right(numbers,r)]-prefix[bisect_left(numbers,l)])%MOD) for l,r in queries)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
    {'name':'错误包含零个0的全1二进制数','code':REFERENCE.replace('range(1,4)', 'range(0,4)').replace('range(2,maximum.bit_length()+1)', 'range(1,maximum.bit_length()+1)')},
    {'name':'错误排除闭区间右端点','code':REFERENCE.replace('bisect_right(numbers,r)', 'bisect_left(numbers,r)')},
]
EDITORIAL='''## 固定来源与错误样例纠正

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Moveworks/moveworks-sum-of-cubes-of-beautiful-numbers.md明确：正整数的二进制表示去掉前导0后，0的个数至少1、至多3，才是beautiful。每次查询闭区间[L,R]内所有beautiful数的立方和，对998244353取模。完整范围1≤Q≤200000，1≤L≤R≤10^18，绝不缩小。

原输入[[5,8],[10,15]]保留，但原输出[153,0]与解释[637,0]都错误。[5,8]内符合条件的是5(101)、6(110)、8(1000)，立方和125+216+512=853；[10,15]内为10、11、12、13、14，立方和9000。15的表示1111没有0，不合格。本站明确将答案修正为[853,9000]，不是用错误样例修改定义。另两个公开例为本站推导。

raw starter及返回类型写单个long，但同一原文的Input/Output明确Q行区间、输出Q个整数。本题遵循明确的多查询输出契约，逐行输出Q个结果；换行是空白分隔的一种，不擅自把多查询聚合成单值。前导0不能参与计数；1(1)不合格，2(10)合格；0不在输入域。未执行上游代码。

## 思路

设一数的二进制长度为b，最高位必须为1，其余b−1位中恰好选择1、2或3个位置放0，其他位置均为1。枚举b及这组位置，从2^b−1减去对应的2的幂，即得到每个beautiful数。只保留不超过当前输入最大R的值，排序，再建立立方和模前缀数组。用两次二分找到L左边界和R右边界，前缀作差后取非负模。

## 正确性证明

枚举只把非最高位的1改0，所以所得数的实际位长确为b，且非前导0的个数恰为所选位置数1..3；筛去大于最大R的值后，保留数均符合定义。反过来，每个合法数都有唯一的位长和0位位置集合，必被相应枚举生成且仅生成一次。因此排序数组不遗漏、不重复任何查询可能需要的数。

前缀数组第j项是排序后前j个数的立方和之模。lower_bound(L)给出小于L的数量，upper_bound(R)给出不大于R的数量，两者之间恰为闭区间[L,R]的所有beautiful数。前缀差与原立方和模同余，最后取非负模就得到唯一正确答案。

## 复杂度与完整边界

10^18<2^60。枚举的候选数至多Σ(b=1..60)Σ(k=1..3)C(b−1,k)=C(60,2)+C(60,3)+C(60,4)=523625；截去超过10^18的数后恰有491280个。令候选数为K，时间O(K log K+Q log K)，空间O(K+Q)，指数和立方均在有界整数上运算；计算立方时可先模约减，Python也支持完整大整数。并非逐数扫描到10^18。

全域独立数位DP得到491280个有效数，立方和模为497027816。最大Q=200000时不能套用小输入限制：正式数据包含一个约8000007字节的完整输入和最多200000个结果，本站采用现有32MiB输入预算、2048KiB运行输出上限，完整题包低于100MiB及128MiB导入上限。

## 独立验证

oracle不枚举0位组合，也不使用参考的排序前缀。它按从高到低的二进制位做数位DP，状态为是否贴上界、是否已遇首个1、有效0的个数，维护数值的0至3次矩之和。追加位d使x变2x+d，用二项式展开更新各矩；未开始时的0不计数，结尾仅取已开始且0数为1..3的状态。查询结果为F(R)−F(L−1)。小范围还逐数用bin去前导0计数、直接立方求和交叉核对。

163个唯一oracle通过真实参考子进程。正式数据包含原错例复算、两端点、全1/一零/三零/四零、二进制长度切换、接近10^18、全域，以及两组完整200000查询。重复端点用缓存数位DP；大量小区间另用逐数暴力前缀生成期望，避免把参考算法当oracle。两个负控分别错误纳入没有0的数、错误排除右端点，全部正式数据要求正常退出后才计击杀。
'''

def sha(v):
    return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()

def put(folder,name,value):
    path=OA/folder/name
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

@lru_cache(maxsize=None)
def moments(bound):
    if bound<=0:return (0,0)
    states={(True,False,0):(1,0,0,0)}
    for char in bin(bound)[2:]:
        bit=int(char)
        nxt={}
        for (tight,started,zeros),(c,s1,s2,s3) in states.items():
            for digit in range((bit if tight else 1)+1):
                new_started=started or digit==1
                z=zeros+int(started and digit==0)
                if z>3:continue
                key=(tight and digit==bit,new_started,z)
                # Direct moment identities, no integer-position enumeration.
                update=(c,2*s1+digit*c,4*s2+4*digit*s1+digit*c,
                        8*s3+12*digit*s2+6*digit*s1+digit*c)
                old=nxt.get(key,(0,0,0,0))
                nxt[key]=tuple((old[i]+update[i])%MOD for i in range(4))
        states=nxt
    selected=[v for (_,started,z),v in states.items() if started and 1<=z<=3]
    return sum(v[0] for v in selected)%MOD,sum(v[3] for v in selected)%MOD

def oracle(queries):
    assert 1<=len(queries)<=200000
    assert all(1<=l<=r<=LIMIT for l,r in queries)
    return [(moments(r)[1]-moments(l-1)[1])%MOD for l,r in queries]

def encode(queries):
    return str(len(queries))+'\n'+''.join(f'{l} {r}\n' for l,r in queries)

def output(answer):
    return '\n'.join(map(str,answer))+'\n'

def run(path,raw):
    start=time.perf_counter()
    result=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=30)
    assert not result.stderr
    return result.stdout.split(),time.perf_counter()-start

def main():
    start=time.perf_counter()
    raw=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
    assert sha(raw)==RAW_SHA
    assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==BLOB
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    assert moments(LIMIT)==(491280,497027816)
    brute=[0]
    for x in range(1,200021):
        brute.append((brute[-1]+(pow(x,3,MOD) if 1<=bin(x)[2:].count('0')<=3 else 0))%MOD)
        if x<=4096:assert moments(x)[1]==brute[-1]
    rng=random.Random(SEED)
    specs=[[(5,8),(10,15)],[(1,1),(2,2),(7,7),(8,8),(16,16)],[(1,10)]]
    keys={encode(q) for q in specs}
    while len(specs)<153:
        queries=[]
        for _ in range(rng.randint(1,8)):
            l=rng.randint(1,4000)
            queries.append((l,rng.randint(l,4096)))
        if encode(queries) not in keys:
            keys.add(encode(queries));specs.append(queries)
    for k in range(50,60):
        queries=[((1<<k)-1,(1<<k)+1),(1,(1<<k)-1),(LIMIT-k,LIMIT)]
        keys.add(encode(queries));specs.append(queries)
    assert len(specs)==len(keys)==163
    path=OA/f'references/{PID}.py'
    path.write_text(REFERENCE)
    oracles=[]
    for queries in specs:
        expected=oracle(queries)
        for (l,r),answer in zip(queries,expected):
            if r<=4096:assert answer==(brute[r]-brute[l-1])%MOD
        text=encode(queries)
        assert run(path,text)[0]==output(expected).split()
        oracles.append({'input':text,'expectedOutput':output(expected)})
    assert oracles[0]['expectedOutput']=='853\n9000\n'
    print(f'{PID}: 163 independent subprocess oracles,4096 brute prefixes,full-domain DP passed',flush=True)
    cases=[{'name':'原输入纠正错误答案' if i==0 else (f'本站补充公开例{i}' if i<3 else f'独立小区间{i-2}'),**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:32])]
    stress=[('完整值域',[(1,LIMIT)]),('最大单值',[(LIMIT,LIMIT)]),('最大有效数两端',[(999799117276250111,LIMIT),(999799117276250111,999799117276250111)])]
    for k in (2,3,4,10,30,59):
        stress.append((f'位长边界{k}',[(max(1,(1<<k)-2),(1<<k)+2)]))
    stress.append(('多位零数分类',[(x,x) for x in (1,2,3,4,7,8,15,16,31,32,63,64,511,512,1023,1024)]))
    endpoints=sorted(rng.sample(range(1,LIMIT),512))
    stress.append(('256独立大区间端点',list(zip(endpoints[::2],endpoints[1::2]))))
    evidence=[]
    for name,queries in stress:
        expected=oracle(queries)
        cases.append({'name':name,'input':encode(queries),'expectedOutput':output(expected),'hidden':True,'weight':1})
    # Two full-Q inputs only; preserve the complete range without inflating the package.
    q1=[(999799117276250111,LIMIT)]*200000
    expected=oracle(q1)
    cases.append({'name':'200000最大端点闭区间','input':encode(q1),'expectedOutput':output(expected),'hidden':True,'weight':1})
    del q1,expected
    q2=[(i,min(200020,i+(i%21))) for i in range(1,200000)] + [(1,LIMIT)]
    expected=[(brute[r]-brute[l-1])%MOD for l,r in q2[:-1]]+[moments(LIMIT)[1]]
    cases.append({'name':'200000不同小区间与完整值域','input':encode(q2),'expectedOutput':output(expected),'hidden':True,'weight':1})
    del q2,expected
    assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
    for case in cases:
        actual,elapsed=run(path,case['input'])
        assert actual==case['expectedOutput'].split(),case['name']
        evidence.append({'name':case['name'],'q':int(case['input'].split('\n',1)[0]),'inputBytes':len(case['input'].encode()),'expectedBytes':len(case['expectedOutput'].encode()),'expectedSha256':sha(case['expectedOutput']),'localSeconds':round(elapsed,5)})
        if evidence[-1]['q']==200000:
            print(f'{PID}: full-Q {case["name"]} passed in {elapsed:.3f}s, input {evidence[-1]["inputBytes"]} bytes',flush=True)
    killed=[]
    for i,mutant in enumerate(MUTANTS,1):
        mpath=OA/f'negative-controls/{PID}-{i}.py'
        mpath.write_text(mutant['code'])
        rejected=[]
        for j,case in enumerate(cases):
            if run(mpath,case['input'])[0]!=case['expectedOutput'].split():rejected.append(j)
        assert rejected
        killed.append({'name':mutant['name'],'rejectedByCases':rejected,'normalExitVerified':True})
        print(f'{PID}: mutant{i} normal exit on all {len(cases)} cases, rejected by {len(rejected)}',flush=True)
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'含1至3个二进制零的数：区间立方和','difficulty':'困难','tags':['OA','Moveworks','组合枚举','前缀和','二分'],
        'description':'正整数去掉前导零的二进制表示中，若0的个数至少1、至多3，则称为beautiful数。对每个闭区间[L,R]，求其中所有beautiful整数的立方和，对998244353取模。所有查询独立。',
        'input':'第一行Q，随后Q行各两个整数L R。完整原始范围：1≤Q≤200000，1≤L≤R≤10^18。前导零不计数。',
        'output':'按输入顺序输出Q个整数，每行一个，每个结果在0..998244352。原文明确要求Q个结果，starter单long返回类型不能表达多查询，本题遵循正文输出格式。',
        'explanation':'原第一例输入不变，纠正输出为853和9000：[5,8]包含5、6、8，原解释漏6；[10,15]包含10、11、12、13、14。原153/0以及解释637/0均与明确定义矛盾。另两公开例为本站补充：单值1、2、7、8、16分别得到0、8、0、512、0；[1,10]中2、4、5、6、8、9、10立方和为2654。',
        'hints':['位长最多60，最高位不能置0。','最多选择三个非最高位作为0。','闭区间用右端upper_bound与左端lower_bound，不能丢掉等于端点的数。'],
        'timeLimit':10,'memoryLimit':262144,'outputLimit':2048,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    assert len(normalized.encode())<100*1024*1024
    assert max(x['inputBytes'] for x in evidence)<=32*1024*1024
    assert max(x['expectedBytes'] for x in evidence)<=2048*1024
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized))
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'枚举至多三个零位并以有序前缀回答查询','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':RAW_SHA,'upstreamCodeExecuted':False,'recoveredConstraints':['1 <= Q <= 200000','1 <= L <= R <= 10^18','binary zero count1..3, leading zeros excluded','inclusive endpoints','mod998244353'],'correction':'Keep original two queries, replace demonstrably incorrect153/0 and637/0 with853/9000. ExplicitQ-output contract prevails over inconsistent single-long starter.','siteAdded':'Newline serialization of original whitespace-separated outputs; two supplemental public examples.'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'原始定义和全部范围完整；错例可按明确定义唯一纠正，独立数位DP与暴力确认，不以错误样例改变规则。完整Q200000/R1e18可组合枚举覆盖，仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':killed,'oracleMethod':'Independent tight/started/zero-count binary DP with moments0..3; brute binary classification for4096 prefixes and200000-query small interval pressure.','fullDomainDP':{'count':moments(LIMIT)[0],'cubeModulo':moments(LIMIT)[1]},'largeBoundaries':evidence,'packageBytes':len(normalized.encode()),'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
    print(f'{PID}: {len(cases)} formal cases,163 oracle subprocesses,two full-Q cases,2 normal-exit mutants; candidate frozen',flush=True)

if __name__=='__main__':main()
