"""IBM62–71: original implementations; raw source statements are never executed."""
from pathlib import Path
from collections import deque, Counter
from itertools import product, permutations
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge';BATCH='ibm-remaining-b';SPECS=[]
def add(number,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(number=number,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def vector(a):return str(len(a))+'\n'+'\n'.join(map(str,a))

def alternating_oracle(s):
    # Enumerate arbitrary flip subsets; accept iff resulting neighbors differ.
    best=len(s)
    for mask in range(1<<len(s)):
        if mask.bit_count()>best:continue
        row=[int(c)^((mask>>i)&1) for i,c in enumerate(s)]
        if all(a!=b for a,b in zip(row,row[1:])):best=mask.bit_count()
    return str(best)
add(62,'最少翻转得到交替二进制串','每次翻转一个比特，使相邻字符都不同，求最少翻转次数。空串已满足条件。来源正文缺失，操作由标题及原例的逐位翻转说明恢复；原例111101翻转一基第1、第3位得到010101，答案2，原例写101010是目标字符串笔误。','第一行长度n，第二行二进制字符串（n=0时为空行）。完整原界0≤n≤200000，仅含0和1。','交替串的首位确定后，其余位唯一。统计与0101…的错位数d，另一目标的错位数就是n−d。','每个错位至少需要翻转一次，逐个翻转即可达到，所以某个目标所需操作恰为错位数。交替串仅有两种非空形式，取两者最小即全局最优；空串两项都为0。','时间O(n)，除输入外额外O(1)。',['11101','111101',''],lambda r:''.join(r.choice('01') for _ in range(r.randint(0,11))),lambda:[('0'*200000,'100000'),('01'*100000,'0'),('1'*199999,'99999'),('1','0')],lambda s:f'{len(s)}\n{s}\n',alternating_oracle,"""def solve(raw):
    rows=raw.splitlines();n=int(rows[0]);s=rows[1] if n else '';different=0
    for i,c in enumerate(s):different+=(int(c)!=(i&1))
    return str(min(different,n-different))
""",[('仅允许0开头','min(different,n-different)','different'),('把相邻相同数当答案','return str(min(different,n-different))',"return str(sum(a==b for a,b in zip(s,s[1:])))")],200020)

def intervals_oracle(rows):
    covered=set()
    for start,end in rows:covered.update(range(start,end+1))
    return str(len(covered))
add(63,'进程运行闭区间的并集时长','每个进程在整数闭区间[start[i],end[i]]运行，求至少有一个进程运行的整数时刻数。来源正文截断，原例明确合并重叠区间[1,6]计6，再加[8,10]计3，按该说明恢复并集时长规则。','第一行n，随后n行start end。完整原界1≤n≤200000，1≤start≤end≤10^9。','将区间按左端点排序，维护当前合并区间；新段不相交时结算旧段长度，否则延伸右端点。','按起点排序后，若新区间起点在当前右端点之后，所有后续区间也不会补回旧段内部，因此可永久结算。相交时替换为两区间并集。归纳保证已结算段互不相交且加上当前段恰覆盖已处理区间，最终总和就是并集大小。','时间O(n log n)，空间O(n)。',[[(1,5),(2,6),(8,10)],[(5,5)],[(3,8),(1,10),(10,10)]],lambda r:[(lambda a:(a,r.randint(a,35)))(r.randint(1,30)) for _ in range(r.randint(1,12))],lambda:[([(1,10**9)]*200000,str(10**9)),([(2*i+1,2*i+1) for i in range(200000)],'200000'),([(i+1,i+1) for i in range(200000)],'200000'),([(10**9,10**9)],'1')],lambda a:str(len(a))+'\n'+'\n'.join(seq(t) for t in a)+'\n',intervals_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));rows=sorted(zip(d[1::2],d[2::2]));left,right=rows[0];total=0
    for start,end in rows[1:]:
        if start>right:total+=right-left+1;left,right=start,end
        else:right=max(right,end)
    return str(total+right-left+1)
""",[('漏计闭区间末端','right-left+1','right-left'),('嵌套时错误缩短右端','right=max(right,end)','right=end')],4400020)

def logs_oracle(x):
    rows,threshold=x;users={u for a,b,c in rows for u in (a,b)}
    selected=[u for u in users if sum(u==a or u==b for a,b,c in rows)>=threshold]
    return vector(sorted(selected,key=int))
def logs_rand(r):
    rows=[(str(r.randint(1,25)),str(r.randint(1,25)),str(r.randint(1,100))) for _ in range(r.randint(1,15))]
    high=max(sum(u==a or u==b for a,b,c in rows) for u in {u for a,b,c in rows for u in (a,b)})
    return rows,r.randint(1,high)
def logs_edges():
    yield ([(str(100000000+i),str(200000000+i),'999999999') for i in range(100000)],1),vector(list(range(100000000,100100000))+list(range(200000000,200100000)))
    yield ([('999999999','999999999','999999999')]*100000,100000),'1\n999999999'
    yield ([('1','1','1')]*99999+[('2','3','1')],99999),'1\n1'
    yield ([('2','10','1'),('10','10','1')],2),'1\n10'
add(64,'按涉及日志数筛选转账用户','每行日志记录发送用户、接收用户及金额。返回涉及至少threshold条日志的用户ID，按数值升序。一条自转账日志对该用户只计一次，金额不影响次数。','第一行n threshold，随后n行sender recipient amount。1≤n≤100000，1≤threshold≤n；三个字段均为1..9位十进制数字且首位非零，保证答案非空。','对每条日志的不同参与用户加一，筛选次数达标的ID并按整数排序。','每个用户每条涉及日志恰增一次，自转账用相等判断避免重复。故计数等于涉及日志数，阈值筛选精确，整数排序满足输出次序。','时间O(n+u log u)，空间O(u)，u≤2n。',[([('2','10','7'),('10','10','8'),('2','3','9')],2),([('1','1','1'),('2','2','1'),('2','3','1')],2),([('99','100','1')],1)],logs_rand,logs_edges,lambda x:f'{len(x[0])} {x[1]}\n'+'\n'.join(' '.join(row) for row in x[0])+'\n',logs_oracle,"""def solve(raw):
    d=raw.split();n,threshold=map(int,d[:2]);counts={}
    for p in range(2,len(d),3):
        a,b=d[p:p+2];counts[a]=counts.get(a,0)+1
        if b!=a:counts[b]=counts.get(b,0)+1
    result=sorted((u for u,v in counts.items() if v>=threshold),key=int)
    return str(len(result))+'\\n'+'\\n'.join(result)
""",[('自转账重复统计','if b!=a:','if True:'),('ID按字典序排序','key=int','key=str')],3000030,output='第一行用户数，随后每行一个ID，按数值升序。')

def loads_oracle(x):
    capacity,loads=x
    return seq(min(set(permutations(loads)),key=lambda p:(sum(a*b for a,b in zip(capacity,p)),p)))
def loads_edges():
    yield ([1]*200000,list(range(200000))),seq(range(200000))
    yield (list(range(200000)),list(range(200000))),seq(range(199999,-1,-1))
    yield ([-10**9,10**9]*100000,[-10**9,10**9]*100000),seq([10**9,-10**9]*100000)
    yield ([10**9]*200000,[-10**9]*200000),seq([-10**9]*200000)
add(65,'字典序最小的最低资源负载排列','固定serverCapacity，重排serverLoad使Σ capacity[i]×load[i]最小。若有多个最低资源方案，必须返回字典序最小的负载数组。后一要求直接来自原始正文，整理后的catalog丢失了该句。','第一行n，第二行n个capacity，第三行n个load。来源没有数值范围，本站补充1≤n≤200000，两数组元素为−10^9..10^9整数，允许重复和负数。','容量从小到大配负载从大到小；同容量位置反向按原下标排序后分配，从而使较小下标获得该组较小负载。','若c1<c2而分到l1<l2，交换后费用改变为(c1−c2)(l2−l1)<0，因此最优解不能有这种逆向配对。排序给出各容量组应分到的负载多重集合，相同容量内部交换不改变费用。将每组负载按原下标升序放为非递减，逐个最早差异位置均尽量小，得到全部最低费用解中的字典序最小解。重复负载跨组交换不改变输出。','时间O(n log n)，空间O(n)。参考无需计算可能超过64位的费用总和；论证及oracle使用任意精度整数。',[([4,5,6],[1,2,3]),([1,2,3,3,3],[2,2,4,5,6]),([1,1],[2,1])],lambda r:(lambda n:([r.randint(-3,3) for _ in range(n)],[r.randint(-3,3) for _ in range(n)]))(r.randint(1,7)),loads_edges,lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n',loads_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n=d[0];capacity=d[1:n+1];loads=sorted(d[n+1:],reverse=True)
    order=sorted(range(n),key=lambda i:(capacity[i],-i));out=[0]*n
    for i,v in zip(order,loads):out[i]=v
    return ' '.join(map(str,out))
""",[('同容量未按字典序决胜','(capacity[i],-i)','(capacity[i],i)'),('容量负载同向排序','reverse=True','reverse=False')],4800030,output='输出n个整数，为唯一的字典序最小最优负载排列。')

def rover_oracle(x):
    n,commands=x;cells=[(r,c) for r in range(n) for c in range(n)];position=0
    for command in commands:
        r,c=cells[position];target={'UP':(r-1,c),'DOWN':(r+1,c),'LEFT':(r,c-1),'RIGHT':(r,c+1)}[command]
        if target in cells:position=cells.index(target)
    return str(position)
add(67,'边界内执行火星车移动命令','火星车从n×n网格的左上角出发，按UP、DOWN、LEFT、RIGHT每次移动一格。会越出网格的命令忽略，继续后续命令。返回最终格编号row*n+column，行列从0开始。','第一行n m，随后m个命令。完整原界2≤n≤20、1≤m≤20；命令仅为UP、DOWN、LEFT、RIGHT。','维护行列坐标，逐条计算候选坐标，合法才更新。','初始坐标正确；每条命令若合法则移动到相邻目标，否则保留原格，恰与题意一致。归纳最终坐标正确，代入给定编号公式即答案。','时间O(m)，额外空间O(1)。',[(4,['RIGHT','UP','DOWN','LEFT','DOWN','DOWN']),(2,['LEFT','UP','RIGHT','RIGHT']),(3,['DOWN','DOWN','DOWN','RIGHT'])],lambda r:(r.randint(2,6),[r.choice(['UP','DOWN','LEFT','RIGHT']) for _ in range(r.randint(1,20))]),lambda:[((20,['RIGHT']*20),'19'),((20,['DOWN']*20),'380'),((20,['UP','LEFT']*10),'0'),((2,['RIGHT','DOWN','LEFT','UP']*5),'0')],lambda x:f'{x[0]} {len(x[1])}\n'+'\n'.join(x[1])+'\n',rover_oracle,"""def solve(raw):
    d=raw.split();n=int(d[0]);row=column=0
    for command in d[2:]:
        dr,dc={'UP':(-1,0),'DOWN':(1,0),'LEFT':(0,-1),'RIGHT':(0,1)}[command]
        nr,nc=row+dr,column+dc
        if 0<=nr<n and 0<=nc<n:row,column=nr,nc
    return str(row*n+column)
""",[('越界时终止所有命令','if 0<=nr<n and 0<=nc<n:row,column=nr,nc','if 0<=nr<n and 0<=nc<n:row,column=nr,nc\n        else:break'),('按列主序编号','row*n+column','column*n+row')],150)

def subset_oracle(a):
    total=sum(a);candidates=[]
    for mask in range(1<<len(a)):
        picked=[v for i,v in enumerate(a) if mask>>i&1]
        if sum(picked)>total-sum(picked):candidates.append((len(picked),-sum(picked),sorted(picked)))
    return vector(min(candidates)[2])
add(69,'最少个数且总和更大的数组子集','按元素位置将数组分为A、B，保留重复值。要求sum(A)>sum(B)，先最小化A的元素个数，再最大化该个数下A的和，返回A的升序序列。B可以为空。','第一行n，第二行数组。完整原界1≤n≤100000，1≤arr[i]≤100000。','将元素降序排列，逐个取最大剩余元素，第一次使所取和严格大于剩余和时停止，反转所取前缀输出。','固定取k个时，最大的k个元素具有最大可能和。若此前缀仍不达标，任何k元素方案都不达标；首次达标的k因此最小。该前缀又使此k下总和最大，所以同时满足两级优化。降序前缀反转得到升序输出。','时间O(n log n)，空间O(n)；求和最大10^10，须用64位或任意精度整数。',[[5,3,2,4,1,2],[4,2,5,1,6],[1,1]],lambda r:[r.randint(1,20) for _ in range(r.randint(1,12))],lambda:[([100000]*100000,vector([100000]*50001)),([1]*100000,vector([1]*50001)),([100000]+[1]*99999,'1\n100000'),([100000],'1\n100000')],arr,subset_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));a=sorted(d[1:],reverse=True);total=sum(a);taken=0
    for count,v in enumerate(a,1):
        taken+=v
        if taken>total-taken:break
    result=a[:count][::-1]
    return str(len(result))+'\\n'+'\\n'.join(map(str,result))
""",[('错误允许两边和相等','taken>total-taken','taken>=total-taken'),('未按升序输出','a[:count][::-1]','a[:count]')],700020,output='第一行A的元素个数，随后每行一个整数，按非递减顺序，保留重复值。')

def toc_oracle(lines):
    out=[]
    for i,line in enumerate(lines):
        chapters=[j for j in range(i+1) if lines[j].startswith('# ')]
        if line.startswith('# '):out.append(str(len(chapters))+'. '+line[2:])
        elif line.startswith('## '):
            section=sum(lines[j].startswith('## ') for j in range(chapters[-1]+1,i+1))
            out.append(f'{len(chapters)}.{section}. '+line[3:])
    return json.dumps(out,ensure_ascii=False)
def toc_rand(r):
    alphabet='a b中é\t😀';lines=['# '+''.join(r.choice(alphabet) for _ in range(r.randint(0,8)))]
    for _ in range(r.randint(0,15)):
        prefix=r.choice(['# ','## ','text ',' # ','x']);lines.append(prefix+''.join(r.choice(alphabet) for _ in range(r.randint(0,8))))
    return lines
def toc_edges():
    yield ['# '+'😀'*98]*1000,json.dumps([f'{i}. '+'😀'*98 for i in range(1,1001)],ensure_ascii=False)
    yield ['# '+'中'*98]+['## '+' '*97]*999,json.dumps(['1. '+'中'*98]+[f'1.{i}. '+' '*97 for i in range(1,1000)],ensure_ascii=False)
    yield ['# ']+['x'*100]*999,json.dumps(['1. '],ensure_ascii=False)
    yield ['# \t  ','## \t  ','#  ','##  '],json.dumps(['1. \t  ','1.1. \t  ','2.  ','2.1.  '],ensure_ascii=False)
add(70,'保留标题原文的章节目录','严格以“# ”开头的行是章标题，以“## ”开头的行是节标题，其余忽略。章从1编号，每个新章的节号重新从1开始，输出“章号. 标题”或“章号.节号. 标题”。仅移除固定前缀，标题内的全部空白和Unicode字符原样保留，空标题也允许。','输入一个JSON字符串数组text。完整原界1≤行数≤1000，每个字符串按Unicode码点计长1..100；首行保证以“# ”开头。行首#标记仅为#或##且后接空格。原文未限制字符集，不缩成ASCII；JSON转义允许表示制表符等控制字符，标题内容不修剪。','顺序扫描，维护章号和当前节号。遇章递增章号并清零节号，遇节递增节号，拼接编号、一个分隔空格和去掉标记后的原始标题。','任意位置的章号等于此前章标题数，节号等于最近章之后的节标题数；对应增量更新保持这两个不变量，因此编号正确。切片只移除固定长度标记，不改变标题任何字符，输出按扫描顺序即原文目录顺序。','时间O(总输入字符数)，空间O(目录总字符数)。',[['# Cars','ignored','## Sedan','## Coupe','## SUV'],['# A','## B','# C','## D'],['#  标题  ','## \t子节 ',' # ignored','# ']],toc_rand,toc_edges,lambda x:json.dumps(x,ensure_ascii=False)+'\n',toc_oracle,"""def solve(raw):
    import json
    lines=json.loads(raw);chapter=section=0;out=[]
    for line in lines:
        if line.startswith('# '):
            chapter+=1;section=0;out.append(f'{chapter}. '+line[2:])
        elif line.startswith('## '):
            section+=1;out.append(f'{chapter}.{section}. '+line[3:])
    return json.dumps(out,ensure_ascii=False)
""",[('跨章未清零节号','chapter+=1;section=0','chapter+=1'),('错误去掉标题空白','+line[2:]','+line[2:].strip()')],604010,checker='exact',output='输出单行规范JSON字符串数组，末尾换行：数组逗号后一个空格；非ASCII字符直接输出；双引号、反斜杠及控制字符按JSON转义（退格/制表/换行/换页/回车用\\b/\\t/\\n/\\f/\\r，其余U+0000..U+001F用小写四位\\u00xx）；斜杠不转义。与Python json.dumps(result, ensure_ascii=False)一致。该编码保留全部标题字符，避免输出含NUL；使用exact检查。',explanation='第一例输出["1. Cars", "1.1. Sedan", "1.2. Coupe", "1.3. SUV"]。第二例新章后节号重置。第三例标题含空格、制表符与空标题，JSON解码后的标题必须逐字符保留。')

def profiles_oracle(x):
    n,edges,queries=x;out=[]
    for start in queries:
        reached={start};changed=True
        while changed:
            changed=False
            for a,b in edges:
                if (a in reached)!=(b in reached):reached.update((a,b));changed=True
        out.append(len(reached))
    return seq(out)
def profiles_rand(r):
    n=r.randint(1,12);return n,[(r.randint(1,n),r.randint(1,n)) for _ in range(r.randint(0,25))],[r.randint(1,n) for _ in range(r.randint(1,12))]
def profiles_edges():
    yield (200000,[(i,i+1) for i in range(1,200000)]+[(200000,1)],list(range(1,200001))),seq([200000]*200000)
    yield (200000,[],list(range(1,200001))),seq([1]*200000)
    yield (200000,[(1,2)]*200000,[1,2,3]*66666+[199999,200000]),seq([2,2,1]*66666+[1,1])
    yield (1,[(1,1)]*200000,[1]*200000),seq([1]*200000)
add(71,'查询可见用户所在连通块大小','用户编号1..n，无向连接可以经多跳到达。每次查询返回该用户所在连通块的用户数，包含本人；孤立用户答案为1。原例的孤点可见列表误写为空，但明确计本人，本文据此纠正。','第一行n m q，随后m行边u v，最后q个查询编号。原文没有数值范围，本站补充1≤n,q≤200000、0≤m≤200000，所有端点和查询在1..n。允许自环、重边，不要求图连通。','使用按大小合并与路径压缩的并查集，维护每个根的分量大小；查询其根的大小。','开始每个用户单独成分量，大小1。每条边只会把其端点的两个连通分量合并，若已经同根则没有新增用户。归纳并查集分组恰等于已处理边的连通分量，根大小精确。处理全部边后，每次查询根大小就是包括自身的可见用户数。','时间O((n+m+q)α(n))，并查集额外空间O(n)，加输入输出存储为O(n+m+q)。',[(7,[(1,2),(2,3),(3,4),(5,6)],[1,3,5,7]),(3,[],[1,2,3]),(3,[(1,1),(1,2),(2,1)],[1,3,2])],profiles_rand,profiles_edges,lambda x:f'{x[0]} {len(x[1])} {len(x[2])}\n'+''.join(seq(e)+'\n' for e in x[1])+seq(x[2])+'\n',profiles_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n,m,q=d[:3];parent=list(range(n+1));size=[1]*(n+1)
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    p=3
    for _ in range(m):
        a,b=find(d[p]),find(d[p+1]);p+=2
        if a!=b:
            if size[a]<size[b]:a,b=b,a
            parent[b]=a;size[a]+=size[b]
    return ' '.join(str(size[find(v)]) for v in d[p:])
""",[('忘记包含自己','str(size[find(v)])','str(size[find(v)]-1)'),('查询不寻找根','str(size[find(v)])','str(size[v])')],5000030,output='按查询顺序输出q个整数。')

# Include maximum canonical byte widths, in addition to algorithmic extremes.
BYTE_EDGES={
    63:lambda: ([(10**9,10**9)]*200000,'1'),
    65:lambda: (([-10**9]*200000,[-10**9]*200000),seq([-10**9]*200000)),
    70:lambda: (['# '+'\x00'*98]*1000,json.dumps([f'{i}. '+'\x00'*98 for i in range(1,1001)],ensure_ascii=False)),
    71:lambda: ((200000,[(200000,200000)]*200000,[200000]*200000),seq([1]*200000)),
}
for _spec in SPECS:
    if _spec['number'] in BYTE_EDGES:
        _original=_spec['edges'];_extra=BYTE_EDGES[_spec['number']]
        _spec['edges']=lambda old=_original,extra=_extra: list(old())+[extra()]
RAW_NAMES={62:'minimum-operations-to-make-alternating-binary-string',63:'process-execution-time',64:'process-logs',65:'rearrange-server-load',66:'request-parser',67:'rover-move',68:'service-timeout-detection',69:'subset-a',70:'table-of-contents',71:'visible-profiles-count'}
BLOCKED={66:'原始约束Unknown，重复token取首/末/拒绝、GET csrf过滤、参数顺序与畸形参数未定义；不能凭catalog补写或缩域定义核心解析规则。',68:'原正文截断到timesta，原例不能区别相邻间隔与首尾跨度；时间排序、输出顺序、单心跳规则缺原文依据，不采用catalog补写冒充来源。'}
def execute(path,inputs):
    begin=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(inputs)
    return out,time.monotonic()-begin
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in SPECS:
        number=s['number'];ident=f'oa-ibm-{number}'
        if selected and number not in selected:continue
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(20267200+number)
        code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=a+'\n') for v,a in s['edges']()]
        tests=oracles[:3]+boundary+oracles[3:27]
        assert len(tests)>=31
        for c in oracles+tests:assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
        def matches(a,b):return a==b if s.get('checker')=='exact' else a.split()==b.split()
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert matches(a,c['expectedOutput']),(ident,i,a[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)]
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not matches(a,c['expectedOutput'])];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        explanation=s.get('explanation','三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') for c in oracles[:3])+'。独立枚举或直接模拟已核对这些答案。')
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','IBM'],description=s['desc']+'\n\n输入输出协议由本站整理，缺失的数值约束均明确标为本站补充。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=6,memoryLimit=262144,outputLimit=4096,checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20267200,problems=reports,skipped=BLOCKED,note='Local authored-program subprocess verification only; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del actual,outputs,cases,tests,boundary,oracles,normalized,p
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,name in RAW_NAMES.items():
        rel=f'fastprep/IBM/ibm-{name}.md';raw=(snapshot/rel).read_bytes();ident=f'oa-ibm-{number}'
        reason=BLOCKED[number] if number in BLOCKED else next(s['desc'] for s in SPECS if s['number']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
