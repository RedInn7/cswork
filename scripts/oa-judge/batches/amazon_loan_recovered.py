"""Amazon276: exact subset DP on an explicit, source-unbounded station domain."""
from pathlib import Path
from itertools import permutations
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge'
BATCH='amazon-loan-recovered';IDENT='oa-amazon-276';SEED=202627600
CODE='''def solve(raw):
    from bisect import bisect_right
    data=list(map(int,raw.split()));n=data[0];lender=data[1:n+1];payback=data[n+1:]
    values=sorted(set(payback));rank={v:i+1 for i,v in enumerate(values)}
    debts=[rank[v] for v in payback];limits=[bisect_right(values,v) for v in lender]
    unreachable=len(values)+1;best=bytearray([unreachable])*(1<<n);best[0]=0;answer=0
    for mask in range(1,1<<n):
        bits=mask;debt=unreachable
        while bits:
            bit=bits&-bits;j=bit.bit_length()-1;bits-=bit
            if best[mask^bit]<=limits[j] and debts[j]<debt:debt=debts[j]
        best[mask]=debt
        if debt!=unreachable:answer=max(answer,mask.bit_count())
    return str(answer)
'''
GREEDY='''def solve(raw):
    data=list(map(int,raw.split()));n=data[0];loans=data[1:n+1];payments=data[n+1:]
    used=set();current=0
    while True:
        choices=[j for j in range(n) if j not in used and loans[j]>=current]
        if not choices:return str(len(used))
        j=min(choices,key=lambda j:payments[j]);used.add(j);current=payments[j]
'''
FOOT='\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def encode(x):return str(len(x[0]))+'\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n'
def oracle(x):
    lender,payback=x;answer=0
    # Independent direct simulation of every full order, stopping at first default.
    for order in permutations(range(len(lender))):
        days=0
        for at,j in enumerate(order):
            if at and lender[j]<payback[order[at-1]]:break
            days+=1
        answer=max(answer,days)
    return str(answer)
def source_entry():
    # Read only one pretty-printed catalog object; avoid retaining the whole catalog.
    selected=[]
    with (ROOT/'content/oa-master/catalog.json').open() as f:
        for line in f:
            if not selected and line.strip()==f'"id": "{IDENT}",':selected=['    {\n',line]
            elif selected:
                if line.startswith('    }'):
                    selected.append('    }\n');return json.loads(''.join(selected))
                selected.append(line)
    raise ValueError('Missing source catalog entry')
def execute(path,inputs):
    start=time.perf_counter();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(inputs)
    return out,time.perf_counter()-start
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    source=source_entry();r=random.Random(SEED)
    samples=[([4,6,1,8],[7,10,3,9]),([2,1,5],[2,2,5]),([100,1,2],[1,100,2])]
    values=samples+[(lambda n:([r.randint(1,15) for _ in range(n)],[r.randint(1,15) for _ in range(n)]))(r.randint(1,7)) for _ in range(160)]
    oracles=[dict(input=encode(x),expectedOutput=oracle(x)+'\n') for x in values]
    boundaries=[
        (([10**9]*20,[10**9-i*1234567 for i in range(20)]),'20'),
        (([10**9]*20,[10**9]*20),'20'),
        (([1]*20,[10**9]*20),'1'),
        (([10**9]+[1]*19,[1]+[10**9]*19),'3'),
        ((list(range(1,21)),list(range(2,22))),'20'),
        (([1,1,1,2],[2,2,2,3]),'2'),
        (([1],[10**9]),'1'),
    ]
    tests=oracles[:3]+[dict(input=encode(x),expectedOutput=a+'\n') for x,a in boundaries]+oracles[3:27]
    code=CODE+FOOT;reference=OUT/'references'/f'{IDENT}.py';reference.write_text(code)
    actual,seconds=execute(reference,[c['input'] for c in oracles+tests])
    for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert a.split()==c['expectedOutput'].split(),(i,a,c)
    mutants=[];controls=[]
    for i,(name,wrong) in enumerate([('错误要求贷款严格大于还款',CODE.replace('bisect_right','bisect_left')),('每次贪心选择最小下笔还款',GREEDY)],1):
        wrong+=FOOT;path=OUT/'negative-controls'/f'{IDENT}-{i}.py';path.write_text(wrong);answers,_=execute(path,[c['input'] for c in tests])
        rejected=[j for j,(a,c) in enumerate(zip(answers,tests)) if a.split()!=c['expectedOutput'].split()];assert rejected,name
        mutants.append(dict(name=name,code=wrong));controls.append(dict(name=name,rejectedByCases=rejected))
    idea='对每个已用借贷人集合mask，记录可以达到的最小末笔payback。空集合欠款0。枚举最后选的j：只要mask去掉j的最小欠款不超过lender[j]，即可把j放在最后，候选末笔欠款为payback[j]。所有可达集合中最大的元素个数就是答案。将不同payback排序后压为1..r，空集合为0，不可达为r+1；用bytearray存状态，仅占2^n字节。'
    proof='使用同一集合后，后续可用借贷人集合完全相同，剩余现金当天花掉，因此过去只有末笔欠款影响下一天。较小末笔欠款可以执行较大欠款能够执行的任何下一步，所以只保留最小值不会丢失最优后续。对于非空mask，每个合法排列都有某个最后借贷人j，其前缀属于mask去掉j且欠款不超过lender[j]；反过来，若该子集的最小可达欠款满足条件，就存在相应前缀可接上j。故枚举最后一项不重不漏地判定可达并取最小末笔欠款。子集去掉一位的整数值更小，顺序遍历已计算所有依赖。对所有可达mask取大小最大值即最优借款天数；最后一笔不需要能再续借才能计入。秩压缩保留所有大小关系，limits[j]是payback值不超过lender[j]的不同值个数，不可达秩始终大于该阈值。'
    cost='时间O(n·2^n+n log n)，空间O(2^n+n)。n=20时恰枚举20·2^19=10,485,760个末项候选，DP数组1,048,576字节；不是以金额为维度，不要求payback≥lender。'
    editorial=f'## 思路\n\n{idea}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{cost}'
    problem=dict(id=IDENT,courseId='gomall',lessonId='00-overview',title='不重复借款时最长不违约天数',difficulty='困难',tags=['OA','Amazon','子集动态规划'],description='每天从一个未使用过的借贷人借款。第i人的贷款额为lender[i]，次日应还payback[i]。第一天可任选一人；以后每天的新贷款必须足够归还上一笔，剩余现金当日花掉、不跨日积累。求最多连续成功借款的天数。最后一天已成功借到即计入，不要求之后还有贷款可还这最后一笔。每个人至多使用一次。\n\n原始来源没有任何数值约束；以下n和金额界是本站明确补充的精确求解范围，不声称来源原界，也没有添加payback≥lender假设。原第三例第二天应借2还2，再欠3，原文字“借1还2”错误。',input='第一行n，第二行n个lender，第三行n个payback。本站补充：1≤n≤20，1≤lender[i],payback[i]≤10^9，两数组等长。允许payback小于、等于或大于对应lender。',output='输出最大成功借款天数，一个1..n的整数。',explanation='样例1按贷款额1→4→8可借3天。样例2按贷款额1→2→5可借3天，恰好还清也合法。样例3按下标2→1→3（从1编号）可借3天，若首日贪心选最小payback的第1人，反而只能借2天。',hints=[idea],timeLimit=8,memoryLimit=131072,outputLimit=1024,checker='tokens',languages=['python','go','java','cpp'])
    cases=[dict(name=f'样例 {i+1}' if i<3 else f'完整边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)]
    assert len(cases)>=31
    assert all(len(c['input'].encode())<=450 for c in oracles+tests)
    p=subprocess.run(['node','--max-old-space-size=64','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
    assert p.returncode==0,p.stderr[-3000:];normalized=p.stdout;solutions=[dict(language='python',code=code)]
    docs={'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=IDENT,title=problem['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')}
    for folder,data in docs.items():(OUT/folder/f'{IDENT}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    batch=dict(schemaVersion=1,items=[dict(id=IDENT,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions)])
    report=dict(schemaVersion=1,seed=SEED,problems=[dict(id=IDENT,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(seconds,3),maxLegalInputBytesUpperBound=450,maxTestInputBytes=max(len(c['input'].encode()) for c in tests),dpMaxBytes=1<<20)],note='Exact subset DP and independent permutation simulation. Local execution only; real sandbox still required.')
    rel='fastprep/Amazon/amazon-maximum-number-of-days-to-survive.md';raw=(Path('/tmp/cswork-oa-source-20260919')/rel).read_bytes()
    review=dict(schemaVersion=1,items=[dict(id=IDENT,status='authored',reason='原文无数值界，本站明确n≤20及正金额≤10^9。一般域精确子集DP，不添加payback≥lender；保留当日余款花掉与末日无需再清偿的规则，原例3还款说明纠错。',sourceCommit='e66f809f4c953bce129f68491726176615db6afc',rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=source['contentHash'])])
    for folder,data in [('batches',batch),('validation',report),('reviews',review)]:(OUT/folder/f'{BATCH}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(IDENT,'163 independent permutation oracles;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(seconds,3),'seconds/reference batch',flush=True)
if __name__=='__main__':main()
