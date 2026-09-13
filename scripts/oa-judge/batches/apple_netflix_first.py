"""Independently authored Apple/Netflix exercises; never executes upstream solutions."""
from pathlib import Path
from itertools import combinations
import hashlib,json,math,random,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='apple-netflix-first';SPECS=[]
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def ignore_oracle(a):
    deleted=set();i=0
    while i<len(a):
        if a[i]==1:
            zeros=[j for j in range(i+1,len(a)) if a[j]==0]
            if zeros:
                end=min(zeros);deleted.update(range(i,end+1));i=end+1;continue
        i+=1
    b=[v for i,v in enumerate(a) if i not in deleted]
    return str(len(b))+'\n'+' '.join(map(str,b))+'\n'+str(sum(b))
SPECS.append(dict(id='oa-apple-1',title='忽略完整的1到0区间',desc='从左到右删除以1开始、到随后第一个0结束的完整区间，包含两端。区间内再遇1不重置起点。未找到结束0的尾段完整保留，其他元素原序保留；同时返回保留元素总和。原例2和4的输出与正文、解释矛盾，本站按明确正文修正。',limits='第一行n，第二行n个整数。1≤n≤100000，−10⁹≤元素≤10⁹。',output='第一行保留个数m；第二行m个整数（m=0时为空行）；第三行总和，需64位整数。',idea='找到数组最后一个0。扫描时，在其之前遇1便进入删除状态，遇0退出；最后一个0之后的1不可能闭合，因此全部保留。',proof='每个被删除的区间必须有一个后继0。最后一个0前的1必能闭合，删除状态一直保持到遇到的第一个0，正好包含整段；之后开始新的独立扫描。最后一个0后不可能形成完整区间。所有其他元素按扫描顺序加入结果，恰为所需列表。',cost='时间O(n)，结果空间O(n)，除输入和输出外额外O(1)。',samples=[[6,1,7,0,2,5,6,1,3],[4,0,6,1,4,6,1,2],[0,6,1,1,9,1,3,0,2]],explain='样例1：删除1、7、0，保留6、2、5、6、1、3，和23。样例2：后面的两个1都没有后继0，整个数组保留，和24；原输出漏了元素。样例3：删除从第一个1到后继0的区间，保留0、6、2，和8；原输出遗漏了6。',rnd=lambda r:[r.choice([0,1,-1,2,5,r.randint(-9,9)]) for _ in range(r.randint(1,25))],edges=[([10**9]*100000,'100000\n'+' '.join(['1000000000']*100000)+'\n100000000000000'),([-10**9]*100000,'100000\n'+' '.join(['-1000000000']*100000)+'\n-100000000000000'),([1]*99999+[0],'0\n\n0'),([1]*100000,'100000\n'+' '.join(['1']*100000)+'\n100000')],encode=arr,oracle=ignore_oracle,bound=1200010,code='''def solve(d):
    n=int(d[0]);last=-1
    for i in range(n):
        if int(d[i+1])==0:last=i
    result=[];skip=False
    for i in range(n):
        v=int(d[i+1])
        if v==1 and i<last:skip=True
        if not skip:result.append(v)
        if v==0:skip=False
    return str(len(result))+'\\n'+' '.join(map(str,result))+'\\n'+str(sum(result))
''',mutants=[('丢弃未闭合尾段','v==1 and i<last','v==1'),('错误保留闭合零','if not skip:result.append(v)','if not skip or v==0:result.append(v)')]))
def commands_encode(ops):return str(len(ops))+'\n'+'\n'.join(ops)+'\n'
def undo_oracle(ops):
    active=[];out=[]
    for op in ops:
        p=op.split()
        if p[0]=='UNDO':active.pop()
        elif p[0]=='PRINT':
            value=0
            for cmd,x in active:value=value+x if cmd=='ADD' else value*x
            out.append(value)
        else:active.append((p[0],int(p[1])))
    return str(len(out))+'\n'+'\n'.join(map(str,out))
def undo_random(r):
    ops=[];depth=0
    for _ in range(r.randint(1,30)):
        cmd=r.choice(['ADD','MUL','PRINT']+(['UNDO'] if depth else []))
        ops.append(cmd+' '+str(r.randint(-3,3)) if cmd in ('ADD','MUL') else cmd)
        depth+=1 if cmd in ('ADD','MUL') else -1 if cmd=='UNDO' else 0
    return ops
SPECS.append(dict(id='oa-netflix-1',title='支持撤销的整数命令系统',desc='状态从0开始。ADD x加x，MUL x乘x，UNDO撤销最近一个尚未撤销的变更命令；PRINT输出当前状态。PRINT不会进入变更历史，不提供REDO。',limits='第一行q，随后q行命令。原始快照无数值界，本站1≤q≤100000，−10⁹≤x≤10⁹。保证UNDO执行时存在尚未撤销的变更，所有中间状态均在signed64范围内。',output='第一行PRINT总次数p；随后p行依次输出每次PRINT的状态；没有PRINT时只输出0。',idea='每次ADD或MUL之前，将当前状态压入栈；UNDO弹出栈顶并恢复，PRINT只记录当前状态。',proof='栈中依次保存所有尚未撤销变更发生前的状态。新增变更压入其前态，保持不变量；UNDO恢复最后一个前态并删掉对应栈项，恰好撤销最近变更。乘零也无需逆运算。PRINT不变更状态或栈。归纳得到全部输出正确。',cost='每条命令O(1)，总时间O(q)，历史与输出空间O(q)。',samples=[['ADD 5','MUL 3','UNDO','PRINT'],['ADD 7','MUL 0','PRINT','UNDO','PRINT'],['ADD 2','PRINT','ADD 4','UNDO','MUL -3','PRINT','UNDO','PRINT']],explain='样例1：5乘3得到15，撤销乘法后输出5。样例2：乘零输出0，撤销仍能恢复7，不能用除法撤销。样例3：依次输出2、−6、2，PRINT不占撤销记录，撤销加4后新乘法在状态2上执行。',rnd=undo_random,edges=[(['ADD 1000000000']*99999+['PRINT'],'1\n99999000000000'),(['ADD 1']*50000+['UNDO']*50000,'0\n'),(['PRINT']*100000,'100000\n'+'\n'.join(['0']*100000)),(['ADD -1000000000','MUL 1000000000','MUL 9','PRINT','UNDO','PRINT'],'2\n-9000000000000000000\n-1000000000000000000')],encode=commands_encode,oracle=undo_oracle,bound=1700010,code='''def solve(d):
    history=[];value=0;out=[];i=1
    for _ in range(int(d[0])):
        cmd=d[i];i+=1
        if cmd in ('ADD','MUL'):
            history.append(value);x=int(d[i]);i+=1
            value=value+x if cmd=='ADD' else value*x
        elif cmd=='UNDO':value=history.pop()
        else:out.append(value)
    return str(len(out))+'\\n'+'\\n'.join(map(str,out))
''',mutants=[('UNDO恢复零而非前态','value=history.pop()','history.pop();value=0'),('乘法误执行加法',"value=value+x if cmd=='ADD' else value*x","value=value+x")]))
def movie_encode(x):
    scores,groups,k=x
    return f'{len(scores)} {len(groups)} {k}\n'+' '.join(f'{v//1000000}.{v%1000000:06d}' for v in scores)+'\n'+''.join(str(len(g))+' '+' '.join(map(str,g))+'\n' for g in groups)
def movie_answer(v):return str(len(v))+'\n'+' '.join(f'{x//1000000}.{x%1000000:06d}' for x in v)
def movie_oracle(x):
    scores,groups,k=x
    return movie_answer([max(sum(scores[i] for i in choice) for choice in combinations(g,k)) for g in groups])
def movie_random(r):
    n=r.randint(1,8);k=r.randint(1,n)
    return ([r.randrange(1000001) for _ in range(n)],[r.sample(range(n),r.randint(k,n)) for _ in range(r.randint(1,6))],k)
SPECS.append(dict(id='oa-netflix-2',title='计算电影组的前k项相似度总分',desc='已知每部电影与目标电影的相似度。每个电影组的分数等于组内最高的k个相似度之和。按电影组输入顺序返回分数，不对电影组重新排序。',limits='第一行N G k；第二行N个相似度；接下来G行，每行先给组大小m，再给m个从0开始的电影编号。原始快照未给数值界，本站N≤100000、G≤10000，均≥1；1≤k≤m≤N，每组编号互异且合法，各组成员总数≤200000。分数在[0,1]，最多6位小数，普通十进制输入。',output='先输出G，再输出G个组分数，可分行。每项允许绝对或相对误差1e-5；接受等值整数、小数、科学计数法，不要求固定小数位。',idea='逐组取出成员分数，降序排序后累加前k项。',proof='任何选中较小分数却未选中较大分数的k元素集合，都可交换二者且不减少总分。反复交换可得到前k大，因此它们的和就是该组最高总分。各组独立计算，并保持输入顺序。',cost='设总成员数M，时间O(N+Σm log m)，除输入输出外空间O(max m)。',samples=[([300000,200000,100000,400000,500000],[[1,2,4],[0,3,4]],2),([1000000,0,500000],[[0,1,2],[1,2]],1),([1,2,999999],[[0,1,2],[2,1,0]],3)],explain='样例1：两组最高两项分别0.5+0.2=0.7、0.5+0.4=0.9，保留组顺序。样例2：k=1，两个组最大值分别为1和0.5。样例3：k等于组大小，两组均将全部三项相加得到1.000002，组内排列不影响分数。',rnd=movie_random,edges=[(([1000000]*100000,[list(range(100000))]*2,100000),movie_answer([100000000000]*2)),(([0]*100000,[list(range(20))]*10000,20),movie_answer([0]*10000)),(([1000000 if i%2 else 0 for i in range(100000)],[list(range(100000))]*2,50000),movie_answer([50000000000]*2))],encode=movie_encode,oracle=movie_oracle,bound=2500100,checker='float-array',code='''def solve(d):
    n,g,k=map(int,d[:3]);scores=[float(d[i+3]) for i in range(n)];pos=n+3;out=[]
    for _ in range(g):
        m=int(d[pos]);pos+=1
        values=[scores[int(d[pos+i])] for i in range(m)];pos+=m
        values.sort(reverse=True);out.append(sum(values[:k]))
    return str(g)+'\\n'+' '.join(format(v,'.12g') for v in out)
''',mutants=[('选最低k项','values.sort(reverse=True)','values.sort()'),('误将电影组重新排序',"' '.join(format(v,'.12g') for v in out)","' '.join(format(v,'.12g') for v in sorted(out,reverse=True))")]))
# Reach INT64_MIN without temporarily exceeding INT64_MAX.
SPECS[1]['edges'].append((['ADD -9','MUL 1000000000','ADD -223372036','MUL 1000000000','ADD -854775808','PRINT','UNDO','ADD -854775807','MUL -1','PRINT'], '2\n-9223372036854775808\n9223372036854775807'))
SPECS[2]['edges'].append((([(i*7919)%100000 for i in range(100000)],[list(range(100000))]*2,50000),movie_answer([3749975000]*2)))
BLOCKED={'oa-apple-2':'immutable raw也没有说明j的选择域。任意交换与相邻交换在[3,2,1]分别得14和11。catalog排序解另在[2,3,1]给14而一次不相交交换至多13；不能用该题解补充规则。','oa-netflix-3':'immutable raw约束原本截断于A cleanup help，未明确到期端点及now是否单调。SET a 1 5 0后GET a 5的结果未定义；时间倒退时删除策略会改变后续GET结果。暂不擅补TTL业务规则。'}
NOTES={'oa-apple-1':'raw与catalog均存在样例错误；正文及例1解释明确保留未闭合尾段，按此规则校正例2总和24、例4保留0/6/2总和8，完整保留原范围。','oa-netflix-1':'raw未给规模/整数范围及空历史UNDO行为；本站明示数值界、所有中间状态signed64、UNDO必有可撤销变更的合法输入保证。','oa-netflix-2':'raw无数值约束；明示本站范围及各组至少k个互异合法电影，按原例输出输入组顺序。float-array接受数字等价格式与误差，不锁定小数位。'}
def execute(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(path,p.stderr[-2000:]);return json.loads(p.stdout)
def matches(spec,a,b):
    if spec.get('checker')!='float-array':return a.split()==b.split()
    def parse(s):
        if len(s)>1048576:return None
        t=s.split()
        if not t or not re.fullmatch(r'0|[1-9][0-9]{0,4}',t[0]) or int(t[0])!=len(t)-1:return None
        if any(not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?',v) for v in t[1:]):return None
        v=list(map(float,t[1:]));return v if all(map(math.isfinite,v)) else None
    x,y=parse(a),parse(b)
    return x is not None and y is not None and len(x)==len(y) and all(abs(u-v)<=1e-5*max(1,abs(v)) for u,v in zip(x,y))
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[]
    for index,s in enumerate(SPECS):
        ident=s['id'];rng=random.Random(20261500+index);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=inp,expectedOutput=answer,hidden=i>=3,weight=1) for i,(inp,answer) in enumerate([(c['input'],c['expectedOutput']) for c in oracles[:3]]+[(s['encode'](v),a+'\n') for v,a in s['edges']]+[(c['input'],c['expectedOutput']) for c in oracles[3:27]])]
        assert s['bound']<=33554432
        for c in oracles+cases:assert len(c['input'].encode())<=s['bound']
        actual=execute(path,[c['input'] for c in oracles+cases]);assert len(actual)==len(oracles+cases)
        for i,(c,a) in enumerate(zip(oracles+cases,actual)):assert matches(s,a,c['expectedOutput']),(ident,i,a[:200],c['expectedOutput'][:200])
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code;changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed);outputs=execute(p,[c['input'] for c in cases]);assert len(outputs)==len(cases)
            rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if not matches(s,a,c['expectedOutput'])];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        company=sources[ident]['companyName'];problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA',company],description=s['desc']+'\n\n输入输出由本站整理。',input=s['limits'],output=s['output'],explanation=s['explain'],hints=[s['idea']],timeLimit=4,memoryLimit=262144,outputLimit=1024 if s.get('checker')=='float-array' else 4096,checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True);assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout;assert len(normalized.encode())<=128*1024*1024 and '\ufffd' not in normalized
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; normal-exit mutants rejected',flush=True)
    reviews=[dict(id=i,status='blocked' if i in BLOCKED else 'authored',reason=(BLOCKED|NOTES)[i]) for i in ['oa-apple-1','oa-apple-2','oa-netflix-1','oa-netflix-2','oa-netflix-3']]
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'reviews':dict(schemaVersion=1,items=reviews),'validation':dict(schemaVersion=1,seed=20261500,problems=reports,skipped=BLOCKED,note='Local batched subprocess with fresh runpy __main__ and streams per case, not per-case OS isolation. Independent small oracles and normal-exit mutants; real sandbox still required. Input budgets assume canonical decimal notation.')} .items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
