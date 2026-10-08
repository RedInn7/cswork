#!/usr/bin/env python3
"""Recover the coordinate-defined Y mask, retaining explicit mixed-source bounds."""
from pathlib import Path
from itertools import product, permutations
import hashlib
import json
import random
import runpy
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-databricks-25'
BATCH='databricks-25-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='98a6399da2eecbc15ec9cb44f2c02b2ef1c793c004164b0de51ffc7b1834da62'
SOURCES=[
    ('OA LIST/Databricks_OA/019_image.txt','1feeed6d4662cbd7ab31ccec76070c01a6c274a2','b83cba54f68ceb4b2f11e7a3da30c268bcb94beca4aae059411cdf1e18578522'),
    ('OA LIST/Databricks_OA/020_image.txt','8e8b876705167951ec06ee5c4a08f7eb3d96b767','e44c24a8e2f9df61d8ae6a3e225ded71b6b2c2b369592a0d75cf2a79bca6155a'),
    ('OA LIST/Databricks_OA/021_image.txt','c7433b300cafdf285880729cf03262405515c328','02dbbf9a92c1f77436c3c3cd3204a46799b46f4604c0693920da07fdd4ec52bc'),
    ('OA LIST/Databricks_OA/022_image.txt','9fffe608bb73f77bd656d73d1f1e29e29cf50202','1656eca781530356a50f83901ff87c23968168d9ee4c64a3b15339d25e024062'),
    ('fastprep/Databricks/databricks-write-l-matrix.md','d5d7c3d33316c3bdb739e71aa221572817c49d80','05a9b09256886cd09192f3ec6a577b5a5f930973246af03797dc2879cf01727b'),
]
SEED=20261019
REFERENCE='''import sys

def solve(raw):
    data=list(map(int,raw.split()))
    n=data[0]
    middle=n//2
    inside=[0]*3
    outside=[0]*3
    for i in range(n):
        for j in range(n):
            on_shape=(i<=middle and (j==i or j==n-1-i)) or (i>=middle and j==middle)
            target=inside if on_shape else outside
            target[data[1+i*n+j]]+=1
    kept=max(inside[a]+outside[b] for a in range(3) for b in range(3) if a!=b)
    return str(n*n-kept)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
    {'name':'错误允许形状和背景同色','code':REFERENCE.replace('if a!=b)', ')')},
    {'name':'按字母X误用两条完整对角线','code':REFERENCE.replace('(i<=middle and (j==i or j==n-1-i)) or (i>=middle and j==middle)', '(j==i or j==n-1-i)')},
]
EDITORIAL='''## 固定来源、同题证据与范围披露

固定提交e66f809f4c953bce129f68491726176615db6afc的OA LIST/Databricks_OA/019_image.txt逐条定义形状：从左上、右上角沿对角线到中心，再从中心竖直延伸到底边。020逐格列出5×5高亮位置，与该几何定义一致。019标题误标X，fastprep/Databricks/databricks-write-l-matrix.md标题及童话正文写L，但021/022例图和解释均是上述Y形。本题以明确坐标和图格为准，不靠字母名称猜形状。

同题对应不是仅凭名称：双方第一例的完整3×3输入、答案2、修改的两个格子及完整目标矩阵逐项一致；第二例答案8、把8个0改成1的解释及完整5×5目标矩阵也一致。fastprep第二例输入漏掉一行，本站使用OCR021/022的完整5行：漏行是第4行[0,0,2,1,1]。两原例答案2和8保持不变。快照没有保存可核对的原图片URL互链，不以不存在的链接作证。

数值范围由同题fastprep明确给出5≤n≤99、n为奇数、值为0/1/2；OCR明确奇数和三值，但自身没有n数值上界。双方第一原例又都是n=3。本站完整采用fastprep奇数5..99，并显式纳入共同原例n=3，两者并集恰为奇数3..99；这不是声称OCR单独规定3..99，也不加入没有依据的n=1。本站输入为n和n行矩阵，输出最少改动格数。未执行上游代码。

## 坐标定义与思路

使用0-based坐标，令m=n//2。形状由三条线段并集构成：(t,t)、(t,n−1−t)，其中0≤t≤m；以及(t,m)，其中m≤t<n。中心属于并集中的一个格子，只统计一次。形状内所有格子必须是同一个值a；背景所有格子必须是另一个值b，且a≠b，a、b均从0/1/2选择。

分别统计形状内、外三个值的频次inside和outside。若目标是(a,b)，可保留inside[a]+outside[b]格，其他格必须修改，代价为n²−inside[a]−outside[b]。枚举六个有序不同值对，取最小代价。

## 正确性证明

坐标谓词完整覆盖两条上半对角线和下半中心竖线；每格只遍历一次，中心不会重复计数，形状与背景构成全部格子的互斥划分。

对固定的不同目标值a和b，每个原值已正确的格子无需修改，而每个原值不等于所属区域目标值的格子至少改一次。一次操作能直接把该格改为目标值，因此修改所有错误格恰好达到此下界。inside[a]+outside[b]正是可保留格数，所算代价为该目标的真实最小值。任意合法终态都必须对应六个有序不同值对之一，枚举六对即不重不漏覆盖所有终态类型，最小代价因而全局最优。

## 复杂度与边界

扫描n²格并枚举6种配色，时间O(n²)，频次统计仅O(1)额外空间（输入存储O(n²)）。完整n=99有9801格，形状格数为(3n−1)/2=148。所有格相同的矩阵应改148格，将形状改成另一种颜色，而不是错误地允许形状和背景同色后输出0。答案不超过n²，普通整数足够。

## 独立验证

163个唯一oracle先用三条坐标线段显式生成形状集合，再分别构造6个完整目标矩阵，逐格计算Hamming距离，不使用区域频次公式。额外穷举3×3的全部19683种三值矩阵，与原创参考函数核对并保存输入期望摘要；此为同进程检查，163个oracle和全部正式用例另执行真实子进程。

正式边界包含完整99阶全0/1/2、全部六种完美配色、中心与底部错误、X形干扰、棋盘及随机矩阵。99阶数据仍全部由独立目标矩阵oracle验证，并对全同值、完美形状和单格变化附加闭式检查。两个错误程序分别允许两区同色、误把两条完整对角线当目标，均在全部正式数据正常退出后才计击杀。
'''


def sha(v):
    return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()


def put(folder,name,value):
    p=OA/folder/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def encode(g):
    return str(len(g))+'\n'+'\n'.join(' '.join(map(str,row)) for row in g)+'\n'


def target_matrices(n):
    middle=n//2
    cells=set()
    for t in range(middle+1):
        cells.add((t,t))
        cells.add((t,n-1-t))
    for t in range(middle,n):
        cells.add((t,middle))
    for a,b in permutations(range(3),2):
        target=[[b]*n for _ in range(n)]
        for i,j in cells:
            target[i][j]=a
        yield target


def oracle(g):
    n=len(g)
    assert 3<=n<=99 and n%2 and all(len(row)==n for row in g)
    assert all(v in (0,1,2) for row in g for v in row)
    return min(sum(g[i][j]!=target[i][j] for i in range(n) for j in range(n)) for target in target_matrices(n))


def run(path,raw):
    started=time.perf_counter()
    p=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=10)
    assert not p.stderr and len(p.stdout.split())==1
    return p.stdout.strip(),time.perf_counter()-started


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
    for flat in product(range(3),repeat=9):
        g=[flat[i:i+3] for i in range(0,9,3)]
        expected=oracle(g)
        raw=encode(g)
        assert own(raw)==str(expected)
        digest.update((raw+'='+str(expected)+'\n').encode())
    first=[[1,0,2],[1,2,0],[0,2,0]]
    second=[[2,0,0,0,2],[1,2,1,2,0],[0,1,2,1,0],[0,0,2,1,1],[1,1,2,1,1]]
    small=[first,second,[[0]*3 for _ in range(3)]]
    small+=list(target_matrices(3))
    keys={encode(g) for g in small}
    rng=random.Random(SEED)
    while len(small)<163:
        n=rng.choice((3,5,7,9))
        g=[[rng.randrange(3) for _ in range(n)] for _ in range(n)]
        if encode(g) not in keys:
            keys.add(encode(g))
            small.append(g)
    oracles=[]
    for g in small:
        expected=oracle(g)
        raw=encode(g)
        assert run(path,raw)[0]==str(expected)
        oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
    assert [x['expectedOutput'] for x in oracles[:3]]==['2\n','8\n','4\n']
    print(f'{PID}: 19683 exhaustive matrices and163 independent subprocess oracles passed',flush=True)
    cases=[{'name':f'原始OCR样例{i+1}' if i<2 else ('本站补充同色矩阵' if i==2 else f'独立目标枚举{i-2}'),**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    stress=[(f'99阶全值{v}',[[v]*99 for _ in range(99)],148) for v in range(3)]
    targets=list(target_matrices(99))
    stress += [(f'99阶完美配色{i+1}',g,0) for i,g in enumerate(targets)]
    for name,i,j in [('中心',49,49),('底部',98,49),('背景',98,0),('角点',0,0)]:
        g=[row[:] for row in targets[0]]
        g[i][j]=2
        stress.append((f'99阶单格错误{name}',g,1))
    stress += [
        ('99阶完整X干扰',[[1 if j==i or j==98-i else 0 for j in range(99)] for i in range(99)],None),
        ('99阶三色棋盘',[[(i+j)%3 for j in range(99)] for i in range(99)],None),
        ('99阶固定随机',[[rng.randrange(3) for _ in range(99)] for _ in range(99)],None),
    ]
    evidence=[]
    for name,g,closed in stress:
        expected=oracle(g)
        if closed is not None:
            assert expected==closed,name
        raw=encode(g)
        actual,elapsed=run(path,raw)
        assert actual==str(expected),name
        cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
        evidence.append({'name':name,'n':99,'expectedOutput':str(expected),'independentTargetMatrixOracle':True,'closedFormChecked':closed is not None,'localSeconds':round(elapsed,5)})
    assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
    for c in cases:
        assert run(path,c['input'])[0]==c['expectedOutput'].strip()
    killed=[]
    for i,m in enumerate(MUTANTS,1):
        p=OA/f'negative-controls/{PID}-{i}.py'
        p.write_text(m['code'])
        rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].strip()]
        assert rejected
        killed.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'将矩阵改成指定三线段形状的最少格数','difficulty':'简单','tags':['OA','Databricks','枚举','矩阵'],
        'description':'给定奇数阶n×n矩阵，元素只能为0、1、2。一次操作把一个格子改为另外一种值。令m=n//2，使用0-based坐标，指定形状为以下坐标并集：(t,t)和(t,n−1−t)，0≤t≤m；以及(t,m)，m≤t<n。即两条上半对角线连到中心，再从中心竖直延伸到底边。要求形状内所有格子统一为值a，形状外所有格子统一为不同的值b，a,b∈{0,1,2}且a≠b。求最少修改格数。中心只算一个格子。原始OCR标题字母有误，本题按其明确坐标定义，不按L或X字母猜图案。',
        'input':'第一行奇数n，随后n行各n个整数。n取3,5,7,…,99，矩阵值0..2。范围来源明确为：同题fastprep给奇数5..99，双方原例另含n=3，本站采用两者并集；OCR本身没有数值上界，不补入无依据的n=1。',
        'output':'输出最少修改格数整数。形状与背景必须使用不同值。',
        'explanation':'前两例来自原OCR，答案保持2与8。例1修改(0,0)为2、(1,0)为0。例2将背景8个0改1；fastprep输入漏掉第4行[0,0,2,1,1]，本站根据OCR021/022补回完整5×5原矩阵。第三例全0的3×3矩阵为本站补充，形状4格改成另一值即可，答案4。',
        'hints':['分开统计形状和背景内0、1、2的数量。','只有六种不同的有序目标值对。','中心只统计一次，背景必须同色且与形状不同。'],
        'timeLimit':2,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',normalize],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized))
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'按坐标分区计数并枚举六种不同配色','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCES[0][0],'gitBlobSha':SOURCES[0][1],'rawSha256':SOURCES[0][2],'sources':[{'path':p,'gitBlobSha':b,'sha256':h,'role':r} for (p,b,h),r in zip(SOURCES,['coordinate geometry and six distinct color pairs; no numeric n upper bound','explicit5x5 highlighted coordinates','original3x3 and5x5 inputs and answers','complete5x5 target and explanation','odd5..99 bound and same examples; erroneous L prose and missing row'])],'upstreamCodeExecuted':False,'sameProblemEvidence':'Exact3x3 input/answer/changed coordinates/target coincide; second output8, explanation and complete5x5 target coincide. Fastprep input omits one OCR row. No direct source-image URL survived.','recoveredConstraints':['n odd','n in {3} union [5,99]','matrix values0,1,2'],'rangeDisclosure':'OCR gives oddness but no numeric n bound. Same-task fastprep gives5..99 yet both sources include3x3 original example. Adopt explicit union, never infer n1.','correction':'Use OCR coordinate-defined Y geometry, not conflicting L/X labels; restore the fourth5x5 input row from OCR. Keep original answers2 and8.','siteAdded':'标准n及方阵输入，输出整数；第三公开例本站补充。'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'OCR明确坐标、图格与两原例一致，标题字母误标不影响几何定义。以精确同题例子连接fastprep范围，披露奇数5..99与原例3并集；补回OCR完整5x5漏行。19683矩阵及163独立目标oracle通过，仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'negativeControls':killed,'referenceSha256':sha(REFERENCE),'oracleMethod':'Explicit union of three coordinate segments; build six complete target matrices and compare every cell via Hamming distance; no region-frequency formula.','exhaustiveSmallDomain':{'n':3,'values':[0,1,2],'cases':19683,'inputExpectedDigest':digest.hexdigest(),'referenceExecution':'in-process own reference; separate163 subprocess checks'},'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}: {len(cases)} formal cases,163 oracle subprocesses,2 normal-exit mutants; candidate frozen',flush=True)


if __name__=='__main__':
    main()
