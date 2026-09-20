"""Independent OpenAI algorithms and differential test authoring; source code is never run."""
from pathlib import Path
import hashlib,json,random,subprocess,sys,ipaddress
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'content/oa-judge'; BATCH='openai-first'; SPECS=[]
def grids_encode(v):
    a,b=v
    return f'{len(a)} {len(a[0])}\n'+'\n'.join(a+b)+'\n'
def regions_oracle(v):
    def components(g):
        cells={(r,c) for r,row in enumerate(g) for c,x in enumerate(row) if x=='1'};out=[]
        while cells:
            group={cells.pop()}
            while True:
                extra={p for p in cells if any(abs(p[0]-q[0])+abs(p[1]-q[1])==1 for q in group)}
                if not extra:break
                group.update(extra);cells.difference_update(extra)
            out.append(group)
        return out
    a,b=map(components,v)
    return str(sum(any(x==y for y in a) for x in b))
def grid_random(r):
    n,m=r.randint(1,5),r.randint(1,5)
    return tuple([''.join(r.choice('01') for _ in range(m)) for _ in range(n)] for _ in range(2))
SPECS.append(dict(id='oa-openai-1',title='两张网格中完全相同的连通区域',desc='分别在两张01网格中按上下左右相邻关系划分1连通块。统计第二张图中有多少连通块，其完整坐标集合恰等于第一张图中的一个完整连通块。不是子岛判定，也不是平移后的形状相同。',limits='第一行n m，随后n行第一张网格，再n行第二张网格。每行连续m个0/1。原题无数值界，本站1≤n,m≤200。',output='一个整数，完全匹配的连通块数。',idea='用迭代遍历提取各连通块的格子编号集合，以不可变集合为键，统计第二张网格中也出现在第一张网格的键。',proof='遍历仅沿四向1格扩展，且直到不能扩展才结束，因此每次恰好提取一个完整连通块。绝对格子编号集合相等当且仅当全部坐标完全相等；集合查找正好实现题意。',cost='期望时间O(nm)，空间O(nm)。',samples=[(['111','100','100'],['111','100','101']),(['11'],['10']),(['10','01'],['10','01'])],explain='样例1只有大连通块匹配，答案1。样例2第二张仅是第一张的真子集，答案0。样例3对角线不相连，有两个匹配块。',rnd=grid_random,edges=[((['1'*200]*200,['1'*200]*200),'1'),((['0'*200]*200,['0'*200]*200),'0'),(([''.join(str((i+j)%2) for j in range(200)) for i in range(200)],)*2,'20000'),((['1'*200]*200,['1'*199+'0']*200),'0')],encode=grids_encode,oracle=regions_oracle,bound=81020,code='''def solve(d):
    n,m=map(int,d[:2])
    def regions(rows):
        seen=set();out=set()
        for start in range(n*m):
            if start in seen or rows[start//m][start%m]!='1':continue
            seen.add(start);stack=[start];part=set()
            while stack:
                u=stack.pop();part.add(u);r,c=divmod(u,m)
                for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
                    nr,nc=r+dr,c+dc;v=nr*m+nc
                    if 0<=nr<n and 0<=nc<m and v not in seen and rows[nr][nc]=='1':
                        seen.add(v);stack.append(v)
            out.add(frozenset(part))
        return out
    a=regions(d[2:2+n]);b=regions(d[2+n:2+2*n])
    return str(sum(x in a for x in b))
''',mutants=[('把子集误当相等','return str(sum(x in a for x in b))','owner={v:y for y in a for v in y}\n    return str(sum(x<=owner.get(next(iter(x)),frozenset()) for x in b))'),('只比较块大小','return str(sum(x in a for x in b))','sizes={len(y) for y in a}\n    return str(sum(len(x) in sizes for x in b))')]))
def bio_encode(v):
    n,pairs=v
    return f'{n} {len(pairs)}\n'+''.join(f'{a} {b}\n' for a,b in pairs)
def bio_oracle(v):
    n,pairs=v
    return str(sum(all(not(l<=a<=r and l<=b<=r) for a,b in pairs) for l in range(1,n+1) for r in range(l,n+1)))
def bio_random(r):
    n=r.randint(2,15)
    return n,[tuple(r.sample(range(1,n+1),2)) for _ in range(r.randint(0,30))]
SPECS.append(dict(id='oa-openai-2',title='统计可共存的连续细菌区间',desc='样本按编号1到n排列。任一冲突对的两个样本不能同时出现在区间中，方向不影响冲突。统计合法非空连续区间数量，不能重排样本。重复冲突不重复扣除。',limits='首行n m，接下来m行每行a b表示冲突对。原题无数值界，本站1≤n≤200000，0≤m≤200000，1≤a,b≤n且a≠b；允许重复及反向重复。',output='合法区间数量，使用64位整数。',idea='将每对端点排序为a<b，记录每个b对应的最大a。扫描右端r时，左端至少是所有已出现冲突的较小端点最大值加一。累加可选左端数量。',proof='区间[l,r]非法当且仅当存在冲突a<b≤r且l≤a。故合法左端精确满足l>max(a)，该最大值随r维护即可。每个区间按唯一右端计数一次。',cost='时间O(n+m)，空间O(n)。',samples=[(3,[(2,3),(1,3),(3,1)]),(4,[]),(4,[(1,4),(4,1),(2,3)])],explain='样例1合法区间为三个单点及[1,2]，共4。样例2全部10个区间合法。样例3重复反向关系等效一条，合法区间共6。',rnd=bio_random,edges=[((200000,[]),'20000100000'),((200000,[(i,i+1) for i in range(1,200000)]),'200000'),((200000,[(1,200000)]*200000),'20000099999'),((200000,[(200000,1)]),'20000099999')],encode=bio_encode,oracle=bio_oracle,bound=2800020,code='''def solve(d):
    n,m=map(int,d[:2]);forbidden=[0]*(n+1)
    for i in range(m):
        a,b=map(int,d[2+2*i:4+2*i])
        if a>b:a,b=b,a
        forbidden[b]=max(forbidden[b],a)
    left=1;answer=0
    for right in range(1,n+1):
        left=max(left,forbidden[right]+1)
        answer+=right-left+1
    return str(answer)
''',mutants=[('遗漏冲突端点排除','forbidden[right]+1','forbidden[right]'),('错误忘记历史左界','left=max(left,forbidden[right]+1)','left=forbidden[right]+1')]))
def chat_encode(v):return str(len(v))+'\n'+''.join(f'{o} {u} {c} {t}\n' for o,u,c,t in v)
def chat_oracle(v):
    events=[];out=[]
    for o,u,c,t in v:
        if o=='EVENT':events.append((u,c,t))
        else:out.append(sum(a==u and b==c and t-15<=s<=t for a,b,s in events))
    return str(len(out))+'\n'+'\n'.join(map(str,out))
def chat_random(r):return [(r.choice(['EVENT','COUNT']),r.choice(['u','v']),r.choice(['a','b']),r.randint(0,60)) for _ in range(r.randint(1,35))]
SPECS.append(dict(id='oa-openai-3',title='按用户与频道统计最近15分钟事件',desc='按输入顺序执行EVENT与COUNT。COUNT u c t仅统计之前已经处理的同用户同频道事件，时间戳在闭区间[t−15,t]。时间戳不保证递增，不能让后续输入的事件提前计数；重复事件逐个计数。',limits='首行q，随后q行EVENT user chat timestamp或COUNT user chat timestamp。本站1≤q≤100000，user和chat为1..20个ASCII字母数字或下划线，0≤timestamp≤10⁹，单位分钟。',output='先输出COUNT数量p，然后依次输出p个查询答案，每行一个。没有COUNT时只输出0。',idea='先对每个用户频道收集EVENT时间并排序去重，用树状数组保存已处理事件频次。再次按输入顺序处理，EVENT加一，COUNT查询≤t与<t−15的前缀频次之差。',proof='预处理只建立坐标，不增加任何频次。扫描任意位置时树状数组恰含该位置之前已处理EVENT的重数。两次二分得到闭区间的边界，前缀和作差排除过早与未来时间戳，因此包含且仅包含所需事件。每个键独立避免串用户或频道。',cost='时间O(q log q)，空间O(q)。',samples=[[('EVENT','u','c',0),('EVENT','u','c',10),('COUNT','u','c',15),('COUNT','u','c',16)],[('EVENT','u','c',50),('EVENT','u','c',0),('COUNT','u','c',15),('COUNT','u','c',50)],[('COUNT','u','c',3),('EVENT','u','c',3),('EVENT','v','c',3),('EVENT','u','d',3),('COUNT','u','c',3)]],explain='样例1查询结果2、1，15分钟前的端点包含。样例2时间乱序且未来时间不计入，结果1、1。样例3后来的事件不会影响前面的查询，结果0、1。',rnd=chat_random,edges=[(([('EVENT','u','c',10)]*50000+[('COUNT','u','c',25)]*50000),'50000\n'+'\n'.join(['50000']*50000)),(([('COUNT','u','c',0)]*100000),'100000\n'+'\n'.join(['0']*100000)),(([('EVENT','u','c',i) for i in range(99999,-1,-1)]),'0\n'),(([('EVENT','u'*20,'c'*20,10**9)]*99999+[('COUNT','u'*20,'c'*20,10**9)]),'1\n99999')],encode=chat_encode,oracle=chat_oracle,bound=6000020,code='''from bisect import bisect_left,bisect_right
def solve(d):
    q=int(d[0]);coords={};ops=[]
    for i in range(q):
        o,u,c,t=d[1+4*i:5+4*i];t=int(t);key=(u,c);ops.append((o,key,t))
        if o=='EVENT':coords.setdefault(key,[]).append(t)
    coords={k:sorted(set(v)) for k,v in coords.items()};bits={k:[0]*(len(v)+1) for k,v in coords.items()}
    def prefix(bit,i):
        total=0
        while i:total+=bit[i];i-=i&-i
        return total
    out=[]
    for o,key,t in ops:
        a=coords.get(key,[]);bit=bits.get(key,[0])
        if o=='EVENT':
            i=bisect_left(a,t)+1
            while i<len(bit):bit[i]+=1;i+=i&-i
        else:out.append(prefix(bit,bisect_right(a,t))-prefix(bit,bisect_left(a,t-15)))
    return str(len(out))+'\\n'+'\\n'.join(map(str,out))
''',mutants=[('遗漏15分钟闭端点','bisect_left(a,t-15)','bisect_right(a,t-15)'),('误包含查询时刻后的事件','bisect_right(a,t)','len(a)')]))
def infection_encode(v):
    rows,t=v
    return f'{len(rows)} {len(rows[0])}\n{t}\n'+'\n'.join(rows)+'\n'
def infection_oracle(v):
    rows,t=v;g=list(map(list,rows));n,m=len(g),len(g[0]);days=0
    while True:
        updates=[]
        for r in range(n):
            for c in range(m):
                if g[r][c]=='.' and sum(g[x][y]=='X' for x in range(max(0,r-1),min(n,r+2)) for y in range(max(0,c-1),min(m,c+2)) if (x,y)!=(r,c))>=t:updates.append((r,c))
        if not updates:return str(days)
        for r,c in updates:g[r][c]='X'
        days+=1
INFECTION='''def solve(d):
    n,m,t=map(int,d[:3]);g=[list(row) for row in d[3:]];counts=[[0]*m for _ in range(n)];front=[];days=0
    def adjacent(r,c):
        for x in range(max(0,r-1),min(n,r+2)):
            for y in range(max(0,c-1),min(m,c+2)):
                if (x,y)!=(r,c):yield x,y
    for r in range(n):
        for c in range(m):
            if g[r][c]=='X':
                for x,y in adjacent(r,c):counts[x][y]+=1
    for r in range(n):
        for c in range(m):
            if g[r][c]=='.' and counts[r][c]>=t:front.append((r,c));g[r][c]='Q'
    while front:
        days+=1;following=[]
        for r,c in front:
            g[r][c]='X'
            for x,y in adjacent(r,c):
                counts[x][y]+=1
                if g[x][y]=='.' and counts[x][y]>=t:g[x][y]='Q';following.append((x,y))
        front=following
    return str(days)
'''
for number in (7,8):
    immune=number==8
    SPECS.append(dict(id=f'oa-openai-{number}',title='八邻域同步感染直到稳定'+('（含免疫格）' if immune else ''),desc='每天结束时，健康格.若在当天开始时有至少T个感染邻居X，则变为X。邻居含上下左右与四个对角，共8方向。感染不会恢复。返回最后一次发生新增感染的天数；初始已稳定则0，不另计无变化的检测日。'+('免疫格I永不感染，也不贡献感染邻居数。' if immune else ''),limits='第一行n m，第二行T，随后n行连续m个字符。1≤n,m≤200，0≤T≤8。字符为'+('X、.、I。第8题沿用第7题给出的完整规模。' if immune else 'X或.。'),output='一个非负整数，发生新增感染的轮数。',idea='维护每个格子已经感染的邻居数。先找出第1天会感染的格子，之后逐层处理新增感染队列，每格感染时仅通知其至多8个邻居，下一层在次日处理。T=0时所有健康格进入第1层。',proof='初始计数精确表示第0天感染邻居。处理第d层时只把这一天新增感染贡献给邻居，达到阈值的健康格立即标记为待处理，但只能进入第d+1层，因此不会当天继续传播。每格首次达阈值时入队一次，不可能遗漏也不会重复。队列空时不存在还能达阈值的健康格，最后非空层号就是答案。免疫格从不入队也不贡献计数。',cost='时间O(nm)，空间O(nm)。',samples=[(['I..' if immune else '...', '.X.','...'],1),(['...','.X.','...'],2),(['....'],0)],explain='样例1中心感染一次传播到全部非免疫邻格，答案1。样例2只有1个感染邻居而阈值2，答案0。样例3阈值0，无需感染源，所有健康格在第1天感染。',rnd=lambda r,immune=immune: ([''.join(r.choice('X.I' if immune else 'X.') for _ in range(5)) for _ in range(4)],r.randrange(9)),edges=[((['X'+'.'*199]+['.'*200]*199,1),'199'),((['.'*200]*200,0),'1'),((['X'*200]*200,8),'0'),((['.'*200]*200,8),'0')]+([((['I'*200]*200,0),'0'),((['X'+'I'*199]+['I'*200]*199,1),'0')] if immune else []),encode=infection_encode,oracle=infection_oracle,bound=40300,code=INFECTION,mutants=[('错误多计算无变化检测日','return str(days)','return str(days+1)'),('把至少阈值写成严格大于','>=t','>t')]))
def ip(v):return '.'.join(str((v>>s)&255) for s in (24,16,8,0))
def cidr_encode(v):return ip(v[0])+'\n'+str(v[1])+'\n'
def cidr_oracle(v):
    # Tree intersection decomposition, not the lowbit greedy used by reference.
    lo,count=v;hi=lo+count;blocks=[]
    def visit(start,size,depth):
        if start>=hi or start+size<=lo:return
        if lo<=start and start+size<=hi:blocks.append(f'{ip(start)}/{depth}');return
        visit(start,size//2,depth+1);visit(start+size//2,size//2,depth+1)
    visit(0,1<<32,0)
    return str(len(blocks))+'\n'+'\n'.join(blocks)
def cidr_random(r):
    start=r.randrange(1<<32);return start,r.randint(1,min((1<<32)-start,100000))
SPECS.append(dict(id='oa-openai-9',title='连续IPv4地址的最少CIDR覆盖',desc='给定起始IPv4地址与正整数count，用最少数量的CIDR网段精确覆盖从起点开始的count个连续地址。不能多覆盖、遗漏、重叠或重复。网段顺序不限。',limits='首行起点a.b.c.d，第二行count。每段0..255，以标准无前导零十进制表示。1≤count≤4294967296，保证起点对应整数+count≤4294967296，不跨IPv4地址空间。',output='首个整数k为网段数量，随后k个a.b.c.d/prefix，可按任意顺序输出。prefix在0..32，各地址为该网段网络地址（主机位为0），十进制无前导零。必须精确覆盖且块数最少。',idea='将地址转成64位整数。每步从当前起点取最大的对齐2的幂块，同时不能大于剩余长度。起点0的对齐上限为2³²，不能用lowbit(0)=0。',proof='CIDR区间是二叉前缀树中的结点，其区间任意两个要么不相交要么包含。目标区间内的极大完整子树形成唯一的不相交分解，任何合法覆盖不得跨过这些子树边界，否则会包含目标外地址；每个极大子树至少需要一块。贪心每次取当前最左端允许的最大对齐块，正好依次取出这些极大子树，因此达到此下界。',cost='最多64个块，时间O(32)，输出空间O(32)，用64位保存2³²。',samples=[(0,1),(0,256),(int(ipaddress.IPv4Address('255.0.0.7')),10)],explain='前两个样例分别为0.0.0.0/32与0.0.0.0/24。第三个可分为255.0.0.7/32、255.0.0.8/29、255.0.0.16/32，共3块，顺序不限。',rnd=cidr_random,edges=[((0,1<<32),cidr_oracle((0,1<<32))),(((1<<32)-1,1),cidr_oracle(((1<<32)-1,1))),((1,(1<<32)-2),cidr_oracle((1,(1<<32)-2))),((1<<31,1<<31),cidr_oracle((1<<31,1<<31)))],encode=cidr_encode,oracle=cidr_oracle,bound=28,checker='oa-ipv4-cidr',code='''def solve(d):
    start=0
    for part in d[0].split('.'):start=start*256+int(part)
    count=int(d[1]);out=[]
    while count:
        align=(start&-start) if start else 1<<32
        size=min(align,1<<(count.bit_length()-1))
        address='.'.join(str((start>>s)&255) for s in (24,16,8,0))
        out.append(address+'/'+str(32-(size.bit_length()-1)))
        start+=size;count-=size
    return str(len(out))+'\\n'+'\\n'.join(out)
''',mutants=[('前缀长度偏差','str(32-(size.bit_length()-1))','str(31-(size.bit_length()-1))'),('误删最后网段',"str(len(out))+'\\n'+'\\n'.join(out)","str(len(out)-1)+'\\n'+'\\n'.join(out[:-1])")]))
BLOCKED={'oa-openai-4':'工程bot题未定义完整触发、help内容和注册作用域；不能降格为固定字符串题。','oa-openai-5':'来源正文截断，只有单个例子不能恢复全部规则。','oa-openai-6':'初始感染年龄和恢复时机未明确，样例与同步扩散存在矛盾，不能擅定规则。','oa-openai-10':'穿墙厚度能耗是叠加步行还是替代步行未明确，反复穿墙影响最优值。'}
for spec in SPECS:
    if spec['id']=='oa-openai-3':
        spec['edges'].append((([('EVENT',f'u{i}',f'c{i}',10**9-i) for i in range(50000)]+[('COUNT',f'u{i}',f'c{i}',10**9-i) for i in range(49999,-1,-1)]),'50000\n'+'\n'.join(['1']*50000)))
    if spec['id'] in ('oa-openai-7','oa-openai-8'):
        spec['edges'] += [((['X'+'.'*199],1),'199'),((['X']+['.']*199,1),'199'),((['XXX','X.X','XXX'],8),'1')]
    if spec['id']=='oa-openai-8':
        spec['edges'] += [((['XI.','III','...'],1),'0'),((['I.I','III','I.I'],0),'1')]
def execute(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(path,p.stderr[-2000:]);return json.loads(p.stdout)
def matches(s,a,b):
    if s.get('checker')!='oa-ipv4-cidr':return a.split()==b.split()
    try:
        x=a.split();y=b.split()
        return int(x[0])==len(x)-1==int(y[0]) and len(set(x[1:]))==len(x)-1 and set(x[1:])==set(y[1:])
    except (ValueError,IndexError):return False
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[]
    for index,s in enumerate(SPECS):
        ident=s['id'];rng=random.Random(20261600+index);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=inp,expectedOutput=answer,hidden=i>=3,weight=1) for i,(inp,answer) in enumerate([(c['input'],c['expectedOutput']) for c in oracles[:3]]+[(s['encode'](v),a+'\n') for v,a in s['edges']]+[(c['input'],c['expectedOutput']) for c in oracles[3:27]])]
        for c in oracles+cases:assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
        actual=execute(path,[c['input'] for c in oracles+cases])
        for i,(c,a) in enumerate(zip(oracles+cases,actual)):assert matches(s,a,c['expectedOutput']),(ident,i,a[:100],c['expectedOutput'][:100])
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code;changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed);outputs=execute(p,[c['input'] for c in cases]);rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if not matches(s,a,c['expectedOutput'])];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','OpenAI'],description=s['desc']+'\n\n输入输出由本站整理。',input=s['limits'],output=s['output'],explanation=s['explain'],hints=[s['idea']],timeLimit=4,memoryLimit=262144,outputLimit=4096,checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True);assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; normal-exit mutants rejected',flush=True)
    reviews=[dict(id=f'oa-openai-{i}',status='blocked' if f'oa-openai-{i}' in BLOCKED else 'authored',reason=BLOCKED.get(f'oa-openai-{i}',('仅catalog存在，immutable raw无对应原文。' if i in (1,2) else '已核对immutable raw e66f809f4c953bce129f68491726176615db6afc。')+'独立编写解答；本站I/O与补充数值界明示；保留来源语义，不执行来源代码。')) for i in range(1,11)]
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'reviews':dict(schemaVersion=1,items=reviews),'validation':dict(schemaVersion=1,seed=20261600,problems=reports,skipped=BLOCKED,note='Independent small oracles and normal-exit wrong programs; local only, real sandbox required. CIDR oracle uses binary prefix tree decomposition rather than reference greedy.')} .items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
