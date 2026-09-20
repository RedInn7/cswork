"""Independent engineering batch. Upstream solutions are never executed."""
from pathlib import Path
import importlib.util, random, json, hashlib, subprocess

base_path=Path(__file__).with_name('apple_netflix_first.py')
loader=importlib.util.spec_from_file_location('batch_helpers',base_path)
base=importlib.util.module_from_spec(loader);loader.loader.exec_module(base)
SPECS=[]
def scalar(x):return str(x)+'\n'
def cmds(x):return str(len(x))+'\n'+'\n'.join(x)+'\n'
def kv_oracle(ops):
    db={};saved=[];out=[]
    for op in ops:
        p=op.split();c=p[0]
        if c=='SET':db[p[1]]=p[2];out.append('OK')
        elif c=='GET':out.append(db.get(p[1],'NULL'))
        elif c=='DELETE':out.append('OK' if p[1] in db else 'NULL');db.pop(p[1],None)
        elif c=='BACKUP':saved.append(db.copy());out.append(str(len(saved)))
        elif 1<=int(p[1])<=len(saved):db=saved[int(p[1])-1].copy();out.append('OK')
        else:out.append('NULL')
    return '\n'.join(out)
def kv_random(r):
    ops=[]
    for _ in range(r.randint(1,55)):
        c=r.choice(['SET','GET','DELETE','BACKUP','RESTORE']);k=r.choice(['a','b','NULL','OK','中文','k_9'])
        ops.append(c+' '+k+' '+r.choice(['a','0','NULL','OK','值','-7']) if c=='SET' else c+' '+k if c in ('GET','DELETE') else c+' '+str(r.randint(0,20)) if c=='RESTORE' else c)
    return ops
KV='''def solve(d):
    from array import array
    ops=[];keys=set();pos=1
    for _ in range(int(d[0])):
        c=d[pos];pos+=1
        size=2 if c=='SET' else 0 if c=='BACKUP' else 1
        args=d[pos:pos+size];pos+=size;ops.append((c,args))
        if c in ('SET','GET','DELETE'):keys.add(args[0])
    ids={k:i for i,k in enumerate(sorted(keys))};width=max(1,len(ids))
    left=array('I',[0]);right=array('I',[0]);value=array('I',[0]);values=['NULL'];saved=[0];root=0;out=[]
    def update(node,lo,hi,index,v):
        cur=len(left);left.append(left[node]);right.append(right[node]);value.append(value[node])
        if hi-lo==1:value[cur]=v
        else:
            mid=(lo+hi)//2
            if index<mid:left[cur]=update(left[node],lo,mid,index,v)
            else:right[cur]=update(right[node],mid,hi,index,v)
        return cur
    def lookup(node,index):
        lo=0;hi=width
        while node and hi-lo>1:
            mid=(lo+hi)//2
            if index<mid:node=left[node];hi=mid
            else:node=right[node];lo=mid
        return value[node]
    for c,args in ops:
        if c=='SET':
            values.append(args[1]);root=update(root,0,width,ids[args[0]],len(values)-1);out.append('OK')
        elif c=='GET':out.append(values[lookup(root,ids[args[0]])])
        elif c=='DELETE':
            old=lookup(root,ids[args[0]]);out.append('OK' if old else 'NULL')
            if old:root=update(root,0,width,ids[args[0]],0)
        elif c=='BACKUP':saved.append(root);out.append(str(len(saved)-1))
        else:
            v=int(args[0])
            if 1<=v<len(saved):root=saved[v];out.append('OK')
            else:out.append('NULL')
    return '\\n'.join(out)
'''
# Large snapshots must share storage; a full dictionary copy per BACKUP is quadratic.
large_ops=['SET k'+str(i)+' v'+str(i) for i in range(50000)]+['BACKUP']*50000+['RESTORE 1','GET k49999']*50000
large_ans='\n'.join(['OK']*50000+[str(i) for i in range(1,50001)]+['OK','v49999']*50000)
SPECS.append(dict(id='oa-anthropic-1',title='支持备份恢复的持久化键值数据库',desc='实现SET key value、GET key、DELETE key、BACKUP、RESTORE id。SET覆盖并输出OK；GET输出值或NULL；DELETE存在则删除并输出OK，否则NULL。BACKUP保存当前状态，输出从1递增且不复用的编号；RESTORE有效编号恢复并输出OK，无效编号输出NULL且不改变状态。旧备份始终可恢复，后续修改不能污染备份。备份和恢复须避免复制整个数据库。',limits='首行命令数n，随后n行命令，1≤n≤200000。原题字符串非空且不含空白，未限制长度；本站每个key/value为1至64个Unicode字符（每个最多4 UTF-8字节），总输入≤16MiB；RESTORE编号0至200000。',output='每条命令恰好输出一行。NULL也是合法存储值，不能把它误判为不存在。',idea='离线压缩全部键，用可持久化线段树存储值编号。修改只复制根到叶路径，BACKUP保存根编号，RESTORE切换根；值编号0表示不存在，其余编号即使对应字符串NULL也表示存在。',proof='每个根代表完整键映射。SET和DELETE仅复制目标叶路径并共享不变子树，旧根所有节点保持不变。因而保存根等价于保存完整状态，恢复根得到原状态，且未来修改不会污染任何备份。备份编号数组只追加，因此恢复后既有编号仍有效。按操作归纳，查询和全部返回值均符合定义。',cost='设U为不同键数，压缩O(U log U)，SET/DELETE/GET为O(log(U+1))，BACKUP/RESTORE为O(1)；总节点O(n log(U+1))，另存输入字符串。',samples=[['SET a 1','BACKUP','SET a 2','GET a','RESTORE 1','GET a','DELETE a'],['BACKUP','SET a NULL','BACKUP','DELETE a','RESTORE 2','DELETE a','DELETE a','RESTORE 1','GET a'],['SET x one','BACKUP','SET x two','BACKUP','RESTORE 1','SET x three','RESTORE 2','GET x','RESTORE 9','GET x']],explain='样例1恢复后读到1。样例2字符串NULL确实存在，第一次删除返回OK，第二次才返回NULL。样例3恢复旧版本再修改不会影响备份2，无效恢复也不改变当前值。',rnd=kv_random,edges=[(large_ops,large_ans),(['BACKUP']*200000,'\n'.join(map(str,range(1,200001)))),(['SET k'+str(i)+' x' for i in range(200000)],'\n'.join(['OK']*200000)),(['SET '+'界'*64+' '+'值'*64,'BACKUP','DELETE '+'界'*64,'RESTORE 1','GET '+'界'*64],'OK\n1\nOK\nOK\n'+'值'*64)],encode=cmds,oracle=kv_oracle,bound=16777216,code=KV,mutants=[('恢复忽略指定历史根','root=saved[v]','root=saved[-1]'),('NULL值误当不存在',"out.append('OK' if old else 'NULL')","out.append('OK' if old and values[old]!='NULL' else 'NULL')")]))
def shoes_oracle(s):
    dp=[-100000]*(len(s)+1);dp[0]=0
    for end in range(1,len(s)+1):
        for start in range(end):
            part=s[start:end]
            if part.count('L')==part.count('R'):dp[end]=max(dp[end],dp[start]+1)
    return str(dp[-1])
def shoes_random(r):
    n=r.randint(1,12);a=list('L'*n+'R'*n);r.shuffle(a);return ''.join(a)
SPECS.append(dict(id='oa-tesla-1',title='右移四位的凯撒加密',desc='将每个大写字母在英文字母表中向右循环移动4位，Z之后回到A，保持原顺序。',limits='一行字符串，长度1至100，仅包含A至Z。',output='输出加密后的字符串。',idea='把字母转成0至25，加4后模26再转回字母。',proof='加4得到右移的位置，模26恰好处理末尾绕回，逐字符映射且顺序不变即为答案。',cost='时间O(n)，输出空间O(n)。',samples=['PINEAPPLE','WXYZ','A'],explain='PINEAPPLE变为TMRIETTPI；WXYZ分别变为ABCD；A变为E。',rnd=lambda r:''.join(r.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ') for _ in range(r.randint(1,100))),edges=[('Z'*100,'D'*100),('A'*100,'E'*100),('ABCDEFGHIJKLMNOPQRSTUVWXYZ','EFGHIJKLMNOPQRSTUVWXYZABCD'),('Y','C')],encode=scalar,oracle=lambda s:s.translate(str.maketrans('ABCDEFGHIJKLMNOPQRSTUVWXYZ','EFGHIJKLMNOPQRSTUVWXYZABCD')),bound=101,code="def solve(d):\n    return ''.join(chr(65+(ord(c)-65+4)%26) for c in d[0])\n",mutants=[('左移四位','+4','+22'),('少移一位','+4','+3')]))
SPECS.append(dict(id='oa-tesla-3',title='左右鞋相等的最多连续分组',desc='将所有鞋子划分成连续且互不重叠的区间，每段L和R数量相同，求最多区间数。每只鞋必须属于一个区间。',limits='一行由L/R组成的字符串，长度2至100000，保证L和R数量相同。',output='输出最多区间数。',idea='L记为1，R记为−1，扫描前缀和，每次回到0就切一段。',proof='从起点覆盖全部字符串的任意合法分割，其每个段末的全局前缀和必为0。因此段数不超过零前缀数。在每个零前缀处切分时，相邻边界间差值为0，每段合法并覆盖所有字符，达到上界。',cost='时间O(n)，额外空间O(1)。',samples=['LRLR','LLRR','RLLRRL'],explain='LRLR分成LR和LR；LLRR只能分一段；RLLRRL分成RL、LR、RL三段。',rnd=shoes_random,edges=[('LR'*50000,'50000'),('L'*50000+'R'*50000,'1'),('R'*50000+'L'*50000,'1'),('LLRR'*25000,'25000')],encode=scalar,oracle=shoes_oracle,bound=100001,code="def solve(d):\n    balance=0;answer=0\n    for c in d[0]:\n        balance+=1 if c=='L' else -1\n        if balance==0:answer+=1\n    return str(answer)\n",mutants=[('任意相邻异色均切段','if balance==0:answer+=1',"if c=='R':answer+=1"),('只统计正向首次配对','if balance==0:answer+=1',"if balance==0 and c=='R':answer+=1")]))
def consecutive_oracle(n):
    answer=0
    for start in range(1,n+1):
        total=start
        for end in range(start+1,n+1):
            total+=end
            if total==n:answer+=1
            if total>=n:break
    return str(answer)
def length_oracle(n):return str(sum((n-k*(k-1)//2)%k==0 for k in range(2,int((2*n)**0.5)+1) if k*(k+1)//2<=n))
SPECS.append(dict(id='oa-bloomberg-1',title='连续正整数之和的表示数量',desc='给定num，统计用至少两个连续正整数相加得到num的不同方式。',limits='一行整数，1≤num≤10¹²。',output='输出表示方式数。',idea='去掉num中的所有因子2，分解剩余奇数，其正约数数量减1就是答案。',proof='奇数长度d的表示以num/d为中心，d为num的奇约数。若起点为正即得到一条表示；否则同一奇约数对应长度2num/d的偶数长度表示，其起点为(d+1)/2−num/d，必为正。两个候选起点之和为1，且均为整数，恰有一个为正。反向由任意连续正整数表示的奇数长度，或偶数长度对应的奇因子，唯一恢复d，故形成双射。奇约数1对应单项num，减去它。',cost='试除时间O(√num)，额外空间O(1)。',samples=[15,2,9],explain='15有1+2+3+4+5、4+5+6、7+8三种；2没有；9有2+3+4、4+5两种。',rnd=lambda r:r.randint(1,350),edges=[(10**12,length_oracle(10**12)),(2**39,'0'),(999999999989,length_oracle(999999999989)),(1,'0')],encode=scalar,oracle=consecutive_oracle,bound=14,code="def solve(d):\n    n=int(d[0])\n    while n%2==0:n//=2\n    count=1;p=3\n    while p*p<=n:\n        exponent=0\n        while n%p==0:n//=p;exponent+=1\n        count*=exponent+1;p+=2\n    if n>1:count*=2\n    return str(count-1)\n",mutants=[('错误包含单项表示','return str(count-1)','return str(count)'),('遗漏偶数长度表示','return str(count-1)','return str((count-1)//2)')]))
def ranges_encode(a):return str(len(a))+'\n'+''.join(f'{lo} {hi}\n' for lo,hi in a)
def ranges_oracle(a):return '\n'.join(str(sum(len(set(str(v)))==len(str(v)) for v in range(lo,hi+1))) for lo,hi in a)
SPECS.append(dict(id='oa-bloomberg-2',title='区间内无重复数字的整数数量',desc='对每个闭区间[n,m]，统计十进制表示中所有数字互不重复的正整数数量。0同样是数字，出现两次也算重复，不补前导零。',limits='本站简化输入协议：首行q，随后q行各两个整数n m（省略原函数包装的固定列数2）。1≤q≤100000，1≤n≤m≤1000000。',output='按查询顺序每行输出一个计数。',idea='用位掩码判定1至最大右端点的数字是否重复，同时建立前缀计数，区间答案为pre[m]−pre[n−1]。',proof='扫描一个数字时，掩码精确记录已经出现的数字，重复位出现当且仅当有重复数字。前缀计数因而等于对应前缀内合法数数量，相减去掉小于n的数，恰好留下闭区间答案。',cost='设M为最大右端点，时间O(M log M+q)，空间O(M+q)。',samples=[[(1,20),(11,11)],[(98,102),(100,100)],[(1,9),(10,10),(123,123)]],explain='1至20只有11不合法，得19；98至102只有98和102合法；单点10和123均合法，100因0重复不合法。',rnd=lambda r:[(a,a+r.randint(0,80)) for a in [r.randint(1,1000) for _ in range(r.randint(1,8))]],edges=[([(1,1000000)]*100000,'\n'.join(['168570']*100000)),([(1000000,1000000)],'0'),([(1,1)]*100000,'\n'.join(['1']*100000)),([(999990,1000000)],'0')],encode=ranges_encode,oracle=ranges_oracle,bound=1600010,code="def solve(d):\n    q=int(d[0]);pairs=[(int(d[i]),int(d[i+1])) for i in range(1,2*q+1,2)];maximum=max(b for a,b in pairs);pre=[0]*(maximum+1)\n    for x in range(1,maximum+1):\n        y=x;mask=0;ok=True\n        while y:\n            digit=y%10\n            if mask&(1<<digit):ok=False;break\n            mask|=1<<digit;y//=10\n        pre[x]=pre[x-1]+ok\n    return '\\n'.join(str(pre[b]-pre[a-1]) for a,b in pairs)\n",mutants=[('遗漏左端点','pre[b]-pre[a-1]','pre[b]-pre[a]'),('允许重复零','if mask&(1<<digit):','if digit and mask&(1<<digit):')]))
BLOCKED={'oa-tesla-2':'raw在After a rollback处截断，未定义后续版本、缺键GET及无效回滚行为，不能由题解补齐业务规则。','oa-bloomberg-3':'正文仅给字典和一个示例，未定义允许的链连接规则；不能凭示例推定仅删除单字符。','oa-bloomberg-4':'要求模拟手工洗牌，但未定义随机分布和概率验收；仅检查排列会让原样输出通过，不能替代洗牌目标。'}
SPECS[0]['edges'].append((['SET a '+'😀'*64]+['GET a']*199999,'OK\n'+('\n'.join(['😀'*64]*199999))))
# 33,554 * 500-byte SET lines + 35 * 6-byte GET lines + 6-byte header = 16 MiB.
budget_ops=['SET '+f'{i:06d}'+'😀'*58+' '+'😀'*64 for i in range(33554)]+['GET a']*35
assert len(cmds(budget_ops).encode())==16777216
SPECS[0]['edges'].append((budget_ops,'\n'.join(['OK']*33554+['NULL']*35)))
NOTES={s['id']:'保留原问题目标及完整数值范围，输入协议和新增字符串预算单独标明；独立对照与错误程序仅为本地验证，发布仍需真实沙箱。' for s in SPECS}

def main():
    root=base.ROOT;out=base.OUT;batch='engineering-first'
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(out/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((root/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[]
    for index,s in enumerate(SPECS):
        ident=s['id'];rng=random.Random(20261900+index)
        code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        path=out/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=inp,expectedOutput=answer,hidden=i>=3,weight=1) for i,(inp,answer) in enumerate([(c['input'],c['expectedOutput']) for c in oracles[:3]]+[(s['encode'](v),a+'\n') for v,a in s['edges']]+[(c['input'],c['expectedOutput']) for c in oracles[3:27]])]
        for c in oracles+cases:assert len(c['input'].encode())<=s['bound']
        actual=base.execute(path,[c['input'] for c in oracles+cases]);assert len(actual)==len(oracles+cases)
        for i,(c,a) in enumerate(zip(oracles+cases,actual)):assert a.split()==c['expectedOutput'].split(),(ident,i,a[:100],c['expectedOutput'][:100])
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code;changed=code.replace(old,new);p=out/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs=base.execute(p,[c['input'] for c in cases]);assert len(outputs)==len(cases)
            rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if a.split()!=c['expectedOutput'].split()];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        company=sources[ident]['companyName']
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='困难' if ident=='oa-anthropic-1' else '中等',tags=['OA',company],description=s['desc']+'\n\n输入输出由本站整理。',input=s['limits'],output=s['output'],explanation=s['explain'],hints=[s['idea']],timeLimit=6 if ident=='oa-anthropic-1' else 4,memoryLimit=524288 if ident=='oa-anthropic-1' else 262144,outputLimit=65536 if ident=='oa-anthropic-1' else 4096,checker='tokens',languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=root,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout;assert len(normalized.encode())<=128*1024*1024 and '\ufffd' not in normalized
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(out/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; normal-exit mutants rejected',flush=True)
    reviews=[dict(id=i,status='blocked' if i in BLOCKED else 'authored',reason=(BLOCKED|NOTES)[i]) for i in list(NOTES)+list(BLOCKED)]
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'reviews':dict(schemaVersion=1,items=reviews),'validation':dict(schemaVersion=1,seed=20261900,problems=reports,skipped=BLOCKED,note='Local batched subprocess with fresh runpy __main__ and streams per case, not per-case OS isolation. Independent small oracles and normal-exit mutants; real sandbox still required.')} .items():(out/folder/f'{batch}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
