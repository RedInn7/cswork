"""Recover Rubrik8 full raw bounds; only write ID-specific local candidates."""

from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-rubrik-8'
BATCH = 'rubrik-8-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SOURCE_PATH = 'fastprep/Rubrik/rubrik-battle-with-upper-moon-6.md'
SOURCE_HASH = '20d1e0b4b1fe5442689c053512cc2fb1bcffb5f149cfb8f28c0ac9297aa9ea67'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    tests = next(tokens)
    output = []
    for _ in range(tests):
        n, m = next(tokens), next(tokens)
        previous = [0] * (m + 2)
        for row in range(n):
            current = [0] * (m + 2)
            states = []
            for column in range(1, m + 1):
                value = next(tokens)
                ancestor = max(previous[column-1], previous[column], previous[column+1])
                states.append('1' if ancestor > value else '0')
                current[column] = max(value, ancestor)
            previous = current
            output.append(' '.join(states))
    return '\\n'.join(output) + '\\n'

if __name__ == '__main__':
    sys.stdout.write(solve(sys.stdin.buffer.read()))
'''
MUTANTS = [
    {'name': '只考虑直接父节点漏掉远祖复活', 'code': REFERENCE.replace('current[column] = max(value, ancestor)', 'current[column] = value')},
    {'name': '错误地将被杀节点自身也复活', 'code': REFERENCE.replace("states.append('1' if ancestor > value else '0')", "states.append('1')")},
]


def sha(data):
    return hashlib.sha256(data.encode() if isinstance(data,str) else data).hexdigest()


def put(folder,name,data):
    path = OA/folder/name
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')


def encode(grids):
    lines = [str(len(grids))]
    for grid in grids:
        lines.append(f'{len(grid)} {len(grid[0])}')
        lines.extend(' '.join(map(str,row)) for row in grid)
    return '\n'.join(lines)+'\n'


def format_states(matrices):
    return '\n'.join(' '.join(map(str,row)) for matrix in matrices for row in matrix)+'\n'


def event_oracle(grids):
    """Literal chronological kills; traverse every descendant via child edges."""
    results = []
    for grid in grids:
        n,m = len(grid),len(grid[0])
        alive = [[1]*m for _ in range(n)]
        events = sorted((grid[r][c],r,c) for r in range(n) for c in range(m))
        for _,r,c in events:
            alive[r][c] = 0
            stack = [(r+1,j) for j in (c-1,c,c+1) if r+1<n and 0<=j<m]
            seen = set()
            while stack:
                row,column = stack.pop()
                if (row,column) in seen:
                    continue
                seen.add((row,column))
                alive[row][column] = 1
                if row+1<n:
                    stack.extend((row+1,j) for j in (column-1,column,column+1) if 0<=j<m)
        results.append(alive)
    return format_states(results)


def check_input(grids):
    assert 1<=len(grids)<=1000
    assert sum(len(g)*len(g[0]) for g in grids)<=10**6
    for grid in grids:
        n,m = len(grid),len(grid[0])
        assert 1<=n<=1000 and 1<=m<=1000
        assert all(len(row)==m for row in grid)
        assert sorted(x for row in grid for x in row)==list(range(1,n*m+1))


def run(code,raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable,'-c',code],input=raw,text=True,capture_output=True,timeout=20)
    assert result.returncode==0,result.stderr
    return result.stdout,round(time.perf_counter()-started,4)


def main():
    assert not (OA/'batches'/f'{BATCH}.json').exists(),'already promoted'
    catalog = next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert catalog['contentHash']==SOURCE_HASH
    upstream='/private/tmp/oa-master-readonly'
    source=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE_PATH}'],cwd=upstream)
    blob=subprocess.check_output(['git','rev-parse',f'{COMMIT}:{SOURCE_PATH}'],cwd=upstream,text=True).strip()
    raw=source.decode()
    for marker in ('1 <= T <= 1000','1 <= n, m <= 10 ^ 3','will not exceed 10 ^ 6','All elements of matrix K are pairwise distinct','1 <= K (i, j) <= n*m','entire sub-tree','[[0, 0, 0], [0, 0, 0], [1, 0, 1]]'):
        assert marker in raw
    previous=next(x for x in json.loads((OA/'reviews/rubrik-capital-remaining.json').read_text())['items'] if x['id']==PID)
    public=[
        ('原题样例',[[[2,1,3],[4,7,8],[6,9,5]]]),
        ('本站样例：复活传播超过一层',[[[3],[1],[2]]]),
        ('本站样例：多组重置与单行',[[[1]],[[2,1,3]]]),
    ]
    assert event_oracle(public[0][1])=='0 0 0\n0 0 0\n1 0 1\n'
    assert event_oracle(public[1][1])=='0\n1\n1\n'
    selected={}
    cases=[]
    for name,grids in public:
        check_input(grids)
        text=encode(grids)
        expected=event_oracle(grids)
        selected[text]=expected
        cases.append({'name':name,'input':text,'expectedOutput':expected,'hidden':False,'weight':1})
    fixed=[[[[1],[2],[3]]],[[[3],[2],[1]]],[[[2,1],[4,3]]],[[[6,1],[2,3],[4,5]]],[[[1,2,3],[6,5,4]]],[[[1,4],[2,3]],[[1]]]]
    for grids in fixed:
        selected[encode(grids)]=event_oracle(grids)
    rng=random.Random(SEED)
    while len(selected)<163:
        grids=[]
        for _ in range(rng.randint(1,4)):
            n,m=rng.randint(1,5),rng.randint(1,5)
            values=list(range(1,n*m+1))
            rng.shuffle(values)
            grids.append([values[i*m:(i+1)*m] for i in range(n)])
        check_input(grids)
        selected[encode(grids)]=event_oracle(grids)
    for i,(text,expected) in enumerate(list(selected.items())[3:33]):
        cases.append({'name':f'独立逐事件模拟 {i+1}','input':text,'expectedOutput':expected,'hidden':True,'weight':1})
    oracle_times=[]
    for text,expected in selected.items():
        actual,elapsed=run(REFERENCE,text)
        assert actual==expected,(text,actual,expected)
        oracle_times.append(elapsed)
    n=m=1000
    ascending=[[r*m+c+1 for c in range(m)] for r in range(n)]
    descending=[[n*m-r*m-c for c in range(m)] for r in range(n)]
    corner=[[n*m if r==c==0 else r*m+c for c in range(m)] for r in range(n)]
    many=[[[1000-r] for r in range(1000)] for _ in range(1000)]
    boundaries=[
        ('百万格按行递增全灭',[ascending],[[[0]*m for _ in range(n)]]),
        ('百万格按行递减仅首行死亡',[descending],[[[0]*m]+[[1]*m for _ in range(n-1)]]),
        ('百万格左上角最后删除的斜边复活范围',[corner],[[[int(r>0 and c<=r) for c in range(m)] for r in range(n)]]),
        ('千组千行单列达到总百万格',many,[[[0]]+[[1] for _ in range(999)] for _ in range(1000)]),
    ]
    large=[]
    for name,grids,states in boundaries:
        check_input(grids)
        text,expected=encode(grids),format_states(states)
        actual,elapsed=run(REFERENCE,text)
        assert actual==expected,name
        cases.append({'name':name,'input':text,'expectedOutput':expected,'hidden':True,'weight':1})
        large.append({'name':name,'testGroups':len(grids),'totalCells':sum(len(g)*len(g[0]) for g in grids),'inputBytes':len(text),'outputBytes':len(expected),'wallSeconds':elapsed,'exitCode':0,'independentExpected':'由严格行序或最后左上角事件的闭式可达范围构造，不使用参考递推'})
    killed=[]
    for mutant in MUTANTS:
        rejects=[]
        for case in cases[:33]:
            actual,_=run(mutant['code'],case['input'])
            if actual!=case['expectedOutput']:
                rejects.append(case['name'])
                break
        assert rejects
        killed.append({'name':mutant['name'],'rejectedByCases':rejects,'exitCode':0})
    editorial='''## 来源恢复与规则

固定raw保留完整约束：1≤T≤1000，1≤n,m≤1000，所有测试组Σ(nm)≤10^6，每组K是1到nm的排列。最初每格存活；按K递增依次杀死对应格，然后让其所有严格后代存活。孩子是下一行的左下、正下、右下合法格，递归传播不因某个中间格本来已经存活而停止。被杀格自身不复活，重叠可达路径只影响同一格的状态，不产生多个实体。

raw把右下角写成(n,m)，示例又以(1,2)称首行第二格，属于坐标文字笔误；本站统一0-based坐标0≤r<n、0≤c<m，原K矩阵及输出原样保留。原样例逐事件模拟得到000/000/101，与递归严格后代规则一致。本站第二、三例分别区分远祖传播和多组状态重置。

## 算法

对每格，只需知道所有严格祖先中最大的K。该格在自身K时刻被杀，而每个严格祖先被杀都会令它复活。故最终活当且仅当严格祖先最大K大于自身K。

自上而下扫描，previous[c]保存上一行该格及其所有祖先的最大K。当前格严格祖先最大值就是previous[c−1]、previous[c]、previous[c+1]的最大值，越界位置用0。计算状态后，current[c]再取该最大值与自身K的最大值，供下一行使用。每组重置上一行数组。无需排序或逐事件模拟。

## 正确性证明

一个格的状态只受两类事件影响：自身事件将其置0，严格祖先事件将其置1，其他事件不影响它。K为排列，因此这些事件时刻互异，最终状态由最后发生者唯一决定，即严格祖先最大K大于自身K时为1，否则为0。

第一行无祖先，边界最大值0正确。假设上一行每个缓存都包含该格及全部祖先的最大K。到达当前格的任意祖先路径必须最后经过其三个合法父节点之一；反之每个父节点及其祖先都能到达当前格。因此合并三个缓存恰好取得全部严格祖先最大K，即使多个集合重叠也不影响max。再与自身K取max，得到当前格及祖先的正确缓存。按行归纳，所有状态正确，独立重置确保各组互不影响。

## 复杂度与边界验证

总时间O(Σnm)，递推额外空间O(m)；此Python实现的输入分词和输出缓存另占O(Σnm)。完整支持1000×1000及T=1000、总百万格。输入时刻上限10^6，无大整数计数。

独立oracle按时刻执行真实删除，并沿孩子边遍历所有严格后代逐一复活，不使用祖先最大值递推。最大规模结构化期望独立构造：按行递增时所有祖先更早，最终全死；按行递减时下一行总有更晚父事件，只有首行死；左上角最后、其余按行递增时，只有严格后代锥r>0且c≤r存活；千组逆序单列则每组只有首格死。
'''
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'网格删除与后代复活','difficulty':'中等','tags':['OA','Rubrik','动态规划','网格'],
        'description':'每组有n行m列网格，最初每格存活。K包含1到n×m各一次，表示每格被杀的时刻。依次执行时刻1到n×m：先将对应格置为死亡，然后让它的所有严格后代复活。格(r,c)的孩子为网格内的(r+1,c−1)、(r+1,c)、(r+1,c+1)，后代沿孩子边递归可达；中间格原本已活也继续传播，杀死的格自身不复活。求全部操作后的状态，活为1、死为0。本站统一0-based坐标，纠正源文右下角及示例坐标笔误，保留原矩阵和结果。',
        'input':'第一行T。每组先输入n m，再输入n行、每行m个K值。完整原约束：1≤T≤1000，1≤n,m≤1000；每组K是1..n×m的排列；所有组Σ(n×m)≤10^6。',
        'output':'按输入顺序，每组输出n行，每行m个0或1，用空格分隔；各组直接衔接，无额外标签。1表示最终存活，0表示最终死亡。',
        'explanation':'原题样例最后一行第一和第三格被晚发生的祖先事件复活，结果为000/000/101。第二例[3,1,2]单列中，顶部最后被杀会复活下面两格，不能只复活直接孩子。第三例演示多组状态独立。',
        'hints':['某格最后受影响的事件是自身或任一严格祖先的最大K。','按行合并三个父节点的祖先最大值，避免逐次模拟。'],
        'timeLimit':3,'memoryLimit':262144,'outputLimit':8192,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',normalize],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    authored=[{'language':'python','code':REFERENCE}]
    put('packages',f'{PID}.json',json.loads(normalized))
    (OA/'references'/f'{PID}.py').write_text(REFERENCE)
    put('editorials',f'{PID}.json',{'schemaVersion':1,'id':PID,'title':package['problem']['title'],'explanation':editorial,'solutions':authored,'sourceUrl':catalog['sourceUrl'],'sourceContentHash':SOURCE_HASH})
    put('oracles',f'{PID}.json',[{'input':text,'expectedOutput':expected} for text,expected in selected.items()])
    put('mutants',f'{PID}.json',MUTANTS)
    for i,mutant in enumerate(MUTANTS,1):
        (OA/'negative-controls'/f'{PID}-{i}.py').write_text(mutant['code'])
    put('candidate-batches',f'{BATCH}.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':SOURCE_HASH,'packageChecksum':sha(normalized),'editorial':editorial,'authoredSolutions':authored}]})
    put('source-evidence',f'{BATCH}.json',{'schemaVersion':1,'sourceCommit':COMMIT,'items':[{'id':PID,'sourcePath':SOURCE_PATH,'gitBlob':blob,'sourceSha256':sha(source),'sourceContentHash':SOURCE_HASH,'sourceUrl':catalog['sourceUrl'],'restoredRules':['T≤1000，n,m≤1000，Σnm≤10^6','K为1..nm排列','删除自身，复活所有严格后代，重叠路径不重复实体'],'siteClarifications':['统一0-based合法坐标，源右下角(n,m)及示例(1,2)坐标文字有笔误','原样例K与000/000/101结果完全保留','两个本站补充公开样例'],'upstreamCodeExecuted':False}]})
    put('resolutions',f'{BATCH}.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':SOURCE_HASH,'previousReason':previous['reason'],'reason':'固定raw完整恢复T、n、m、总格数和K排列约束，明确递归复活严格后代；原矩阵样例经逐事件模拟一致，仅坐标文字笔误明示纠正。163唯一独立oracle与完整百万格/千组边界通过，两个正常退出mutant被拒，仅候选待沙箱。'}]})
    put('validation',f'{BATCH}.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(selected),'uniqueOracleInputs':len(selected),'publicCases':3,'hiddenCases':len(cases)-3,'formalCases':len(cases),'negativeControls':killed,'referenceSha256':sha(REFERENCE),'oracleMethod':'按K排序执行删除，每事件沿孩子边遍历严格后代并逐格复活，不使用祖先最大值','oracleMaxWallSeconds':max(oracle_times),'largeBoundaries':large}],'note':'163唯一输入与4个百万格边界通过真实Python子进程stdin/stdout验证，含1000组每组1000格。负控正常退出且输出不符。未运行GoJudge或发布。'})
    print(json.dumps({'id':PID,'oracleCases':len(selected),'formalCases':len(cases),'largeBoundaries':large},ensure_ascii=False))


if __name__=='__main__':
    main()
