"""Independent 11-problem author batch; source programs never executed; large edges lazy."""
from pathlib import Path
from itertools import combinations,permutations
from functools import lru_cache
from collections import deque,Counter
import hashlib,json,random,subprocess,sys,time,gc
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='airbnb-platform-companies-first';SEED=202609221;SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def add(company,n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=f'oa-{company}-{n}',company={'airbnb':'Airbnb','coinbase':'Coinbase','github':'GitHub','atlassian':'Atlassian','cloudflare':'Cloudflare'}[company],title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def products_oracle(x):
    a,k=x;answer=0
    for i in range(len(a)):
        p=1
        for v in a[i:]:p*=v;answer+=p<=k
    return answer
def products_edges():
    yield ([1]*500000,1),125000250000
    yield ([100]*500000,1000000),1499997
    yield ([100]*500000,99),0
    yield ([1]*499999+[100],100),125000250000
add('airbnb',1,'乘积不超过阈值的连续子数组','统计非空连续子数组中元素乘积不超过k的个数，比较包含等号。','第一行n，第二行n个正整数，第三行k。以原始OCR为准：1≤n≤500000、1≤a[i]≤100、1≤k≤1000000；来源整理章中的较小n与较大k不覆盖OCR。','正数滑动窗口，加入右端后收缩左端直到积≤k，加入当前窗口长度。','所有元素至少1，固定右端时合法起点组成后缀。收缩停在最早合法起点，因此窗口长度恰是以该右端结尾的合法子数组数，求和不重不漏。','O(n)时间，除输入外O(1)空间；答案最大125000250000，使用64位整数。',[([2,3,4],6),([1,2,3],4),([1,1,1],1)],lambda r:([r.randint(1,8) for _ in range(r.randint(1,12))],r.randint(1,100)),products_edges,lambda x:arr(x[0])+str(x[1])+'\n',products_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];k=d[-1];p=1;left=0;answer=0
    for right,v in enumerate(a):
        p*=v
        while left<=right and p>k:p//=a[left];left+=1
        answer+=right-left+1
    return str(answer)
''',[('错误使用严格小于','p>k','p>=k'),('错误漏掉长度一','answer+=right-left+1','answer+=right-left')],2000030)

def eating_oracle(x):
    a,h=x
    return next((d for d in range(1,max(a)+1) if sum((v+d-1)//d for v in a)<=h),-1)
def eating_random(r,feasible):
    a=[r.randint(1,20) for _ in range(r.randint(1,9))]
    return a,r.randint(len(a) if feasible else 1,sum(a)+5)
def eating_edges(feasible):
    yield ([10**9]*200000,200000),10**9
    yield ([10**9]*200000,10**18),1
    yield ([1]*200000,200000),1
    yield ([10**9],1),10**9
    if not feasible:yield ([1]*200000,199999),-1
EATING_CODE='''def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];hours=d[-1]
    if hours<n:return '-1'
    lo=1;hi=max(a)
    while lo<hi:
        mid=(lo+hi)//2
        if sum((v+mid-1)//mid for v in a)<=hours:hi=mid
        else:lo=mid+1
    return str(lo)
'''
for number,feasible,title in [(2,True,'吃完甜甜圈的最小速度'),(4,False,'吃完糖果的最小速度')]:
    add('airbnb',number,title,'每单位时间只能吃一箱/堆，最多吃d个；不足d也占用完整单位时间，剩余额度不能转到下一箱/堆。求在期限内全部吃完的最小正整数速度。','第一行n，第二行n个数量，第三行期限h。原数值上界缺失，本站补充1≤n≤200000、数量1..10^9、h≤10^18。'+('原文保证可行，本站n≤h。' if feasible else '本站1≤h；原文未保证可行，不可行时补充输出−1。'),
    '二分速度，用各堆所需时间ceil(a/d)的和判断。','固定速度时每堆需要且足够ceil(a/d)个独占时间单位。总耗时随速度单调不增，故二分首次可行速度正确。正数量使最低耗时为n，h<n时无解。','O(n log max(a))时间、O(n)输入空间。',
    [([4,9,11,17],8),([3,6,7,11],8),([2,2],2 if feasible else 1)],lambda r,f=feasible:eating_random(r,f),lambda f=feasible:eating_edges(f),lambda x:arr(x[0])+str(x[1])+'\n',eating_oracle,EATING_CODE,
    [('错误每箱向下取整','(v+mid-1)//mid','v//mid'),('错误二分答案少一','return str(lo)','return str(lo-1)')],2200040)

def maze_encode(x):
    a,k=x;return f'{len(a)} {len(a[0])} {k}\n'+'\n'.join(seq(row) for row in a)+'\n'
def maze_oracle(x):
    a,k=x;n=len(a);m=len(a[0])
    if a[0][0] or a[-1][-1]:return -1
    vertices=[(i,j) for i in range(n) for j in range(m) if not a[i][j]];edges={p:[] for p in vertices}
    for p in vertices:
        for q in vertices:
            i,j=p;u,v=q
            if p==q or (i!=u and j!=v) or abs(i-u)+abs(j-v)>k:continue
            cells=[a[t][j] for t in range(min(i,u),max(i,u)+1)] if j==v else [a[i][t] for t in range(min(j,v),max(j,v)+1)]
            if not any(cells):edges[p].append(q)
    dist={(0,0):0};queue=deque([(0,0)])
    while queue:
        p=queue.popleft()
        for q in edges[p]:
            if q not in dist:dist[q]=dist[p]+1;queue.append(q)
    return dist.get((n-1,m-1),-1)
def maze_rnd(r):
    n=r.randint(1,5);m=r.randint(1,5)
    return [[int(r.randrange(4)==0) for _ in range(m)] for _ in range(n)],r.randint(1,5)
def maze_edges():
    yield ([[0]*100 for _ in range(100)],100),2
    yield ([[0]*100 for _ in range(100)],1),198
    a=[[0]*100 for _ in range(100)];a[50]=[1]*100
    yield (a,100),-1
    yield ([[1]],100),-1
    yield ([[0]],100),0
    yield ([[0]*100],100),1
add('airbnb',3,'不能越过障碍的最少跳跃次数','从左上角到右下角，一步沿一个轴移动1..k格，经过的全部格子必须为空，包括起点和落点。不可达返回−1。','第一行n m k，随后n行m个0/1。保留原完整域1≤n,m,k≤100。本站明确：任一端点为障碍时返回−1，包括1×1障碍；空1×1为0。','对空格BFS，每次向四方向扫描最多k格，遇墙停止；已访问空格不是障碍，仍继续扫描更远位置。','所有合法跳跃都是单位权边。射线扫描恰枚举所有且仅合法的边，BFS第一次访问一个格子时路径步数最短，因此终点距离正确。','O(nmk)时间、O(nm)空间，最多约400万次射线检查。',[([[0,0],[1,0]],2),([[0,0,0],[1,0,0]],5),([[1]],1)],maze_rnd,maze_edges,maze_encode,maze_oracle,
'''def solve(raw):
    from collections import deque
    d=list(map(int,raw.split()));n,m,k=d[:3];a=d[3:]
    if a[0] or a[-1]:return '-1'
    dist=[-1]*(n*m);dist[0]=0;q=deque([0])
    while q:
        p=q.popleft();i,j=divmod(p,m)
        for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
            for step in range(1,k+1):
                u=i+di*step;v=j+dj*step
                if not (0<=u<n and 0<=v<m):break
                z=u*m+v
                if a[z]:break
                if dist[z]<0:dist[z]=dist[p]+1;q.append(z)
    return str(dist[-1])
''',[('错误跨过障碍','if a[z]:break','if a[z]:continue'),('错误忽略跳跃只走一步','range(1,k+1)','range(1,2)')],20030)

def prefix_oracle(x):
    best=0
    for a in x[0]:
        for b in x[1]:
            length=0
            for u,v in zip(str(a),str(b)):
                if u!=v:break
                length+=1
            best=max(best,length)
    return best
def prefix_edges():
    yield ([10**8]*50000,[10**8]*50000),9
    yield ([11111111]*50000,[22222222]*50000),0
    yield ([12345678]*50000,[12345679]*50000),7
add('coinbase',1,'跨两个整数数组的最长公共前缀','从两个数组分别选一个正整数，比较通常十进制表示的共同前缀，返回全部跨数组配对中的最大前缀长度；没有共同首位则0。','第一行n m，第二行n个数，第三行m个数。原界1≤n,m≤50000，1≤数值≤100000000，最大值有9位。','把第一数组每个数反复除10得到全部非空前缀，放入集合；枚举另一数组前缀找最长匹配。','正整数的非空十进制前缀恰是不断去掉末位所得正数。两边前缀相等当且仅当存在对应跨数组对的同长共同前缀，取最大位数即答案。','O(9(n+m))时间，O(9n)空间。',[([1,10,100],[1000]),([1,2,3],[4,4,4]),([100000000],[100000000])],lambda r:([r.randint(1,10000) for _ in range(r.randint(1,8))],[r.randint(1,10000) for _ in range(r.randint(1,8))]),prefix_edges,lambda x:f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',prefix_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];b=d[2+n:];prefixes=set()
    for v in a:
        while v:prefixes.add(v);v//=10
    answer=0
    for v in b:
        while v:
            if v in prefixes:answer=max(answer,len(str(v)))
            v//=10
    return str(answer)
''',[('错误不检查完整整数前缀','for v in b:\n        while v:','for v in b:\n        v//=10\n        while v:'),('错误把前缀长度少算一','len(str(v))','len(str(v))-1')],1000040)

def bridge_oracle(x):
    a,u=x;best=0
    for mask in range(1<<len(a)):
        b=[v for i,v in enumerate(a) if mask>>i&1]
        if all(v<=u for v in b) and all(v+w<=u for v,w in zip(b,b[1:])):best=max(best,len(b))
    return len(a)-best
def bridge_edges():
    yield ([10**9]*200000,10**9),199999
    yield ([10**9]*200000,1),200000
    yield ([1]*200000,2),0
    yield ([1,10**9]*100000,10**9),100000
add('github',1,'双车桥的最少掉头车辆','车辆保持原队列顺序过桥，最多两车同时在桥上。首车离开时第三车立刻进入，依次类推。可删除任意车辆，求使桥不超载的最少删除数；不能插入等待或重排。','第一行n U，第二行n个车重。原文没有数值界，本站补充1≤n≤200000、1≤U,weight[i]≤10^9。单车超重也必须删除。','维护已保留序列的末车，若新车与它超载，删除两车中较重者；单车超重直接删除。','合法保留序列恰要求每辆不超载、每对相邻保留车重量和≤U。冲突二者必须至少删一个，留下较轻尾车对所有未来车辆都不更差，同时不破坏之前的相邻约束。交换论证逐步保持最优数量及最有利末车。','O(n)时间，除输入外O(1)空间。',[([5,3,8,1,8,7,7,6],9),([3,3,3],6),([10],9)],lambda r:([r.randint(1,12) for _ in range(r.randint(1,10))],r.randint(1,15)),bridge_edges,lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',bridge_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,u=d[:2];last=None;answer=0
    for v in d[2:]:
        if v>u:answer+=1
        elif last is None or last+v<=u:last=v
        else:answer+=1;last=min(last,v)
    return str(answer)
''',[('错误冲突留下重车','last=min(last,v)','last=max(last,v)'),('错误把等于承重也判超载','last+v<=u','last+v<u')],2200040)

def compress_encode(a):return ''.join(c+str(v) for c,v in a)+'\n'
def compress_oracle(a):
    expanded=''.join(c*v for c,v in a);counts=Counter(expanded)
    return ''.join(c+str(counts[c]) for c in sorted(counts))
def compress_edges():
    yield [('a',1000)]*20000,'a20000000'
    yield [('z',1)]*50000,'z50000'
    yield [('z',999),('a',999)]*12500,'a12487500z12487500'
add('atlassian',1,'合并重复字符频次的规范压缩','输入由小写字母及其十进制正频次组成，允许同字母多次出现。累计频次后按字母升序，每个出现过的字母仅输出一次及其总频次。','一行压缩串S。原界1≤|S|≤100000，每段字母a..z、频次1..1000；必须为完整合法字母-频次序列，因此有效串最短2。本站采用无前导零的频次编码。','扫描每段完整数字并累加到26个计数，最后按字母顺序串联。','每个原段恰读一次且只给对应字符增加其频次，因此累计值等于解压后出现数；升序输出实现规定的唯一规范表示。','O(|S|)时间、O(26)计数空间，不展开大频次串。',[[('a',3),('c',9),('b',2),('c',1)],[('z',1000),('a',1),('z',10)],[('a',1)]],lambda r:[(r.choice('abcxyz'),r.randint(1,40)) for _ in range(r.randint(1,12))],compress_edges,compress_encode,compress_oracle,
'''def solve(raw):
    s=raw.strip();counts=[0]*26;i=0
    while i<len(s):
        c=ord(s[i])-97;i+=1;j=i
        while i<len(s) and s[i].isdigit():i+=1
        counts[c]+=int(s[j:i])
    return ''.join(chr(97+i)+str(v) for i,v in enumerate(counts) if v)
''',[('错误同字母覆盖前段','counts[c]+=int','counts[c]=int'),('错误逆字母排序','enumerate(counts) if v','reversed(list(enumerate(counts))) if v')],100002,output='输出唯一规范压缩字符串。')

def flowers_oracle(x):
    p,q,s=x
    @lru_cache(None)
    def choose(mask):
        best=0
        for i in range(len(s)):
            for length,value in [(2,q),(3,p)]:
                if i+length>len(s):continue
                bits=((1<<length)-1)<<i;t=s[i:i+length]
                if not mask&bits and (t in ('01','10') if length==2 else t=='000'):best=max(best,value+choose(mask|bits))
        return best
    return choose(0)
def flowers_edges():
    yield (1000,1000,'0'*100000),33333000
    yield (1,1000,'01'*50000),50000000
    yield (1000,1,'1'*100000),0
    yield (1000,1,'000'*33333+'0'),33333000
add('atlassian',2,'连续花束的最大收入','花列0为玫瑰、1为cosmos。三个连续玫瑰000可卖p，一朵玫瑰加一朵cosmos的连续01或10可卖q。每朵最多用一次，可不使用部分花，不允许删除花后拼接成新的相邻关系。','第一行p q，第二行二进制串s。原界1≤p,q≤1000、1≤|s|≤100000。','前缀DP可跳过末花，或选择合法末二/末三花束，滚动保留前3个状态。','最优方案若末花不用则来自前一前缀，否则末花所在花束必为末二或末三的允许图案；移去该束后剩余方案必须最优。递推枚举全部互斥可能，归纳成立。','O(n)时间、O(1)DP空间，输入字符串O(n)。',[(2,3,'0001000'),(1,5,'10'),(9,1,'000000')],lambda r:(r.randint(1,10),r.randint(1,10),''.join(r.choices('01',k=r.randint(1,10)))),flowers_edges,lambda x:f'{x[0]} {x[1]}\n{x[2]}\n',flowers_oracle,
'''def solve(raw):
    p,q,s=raw.split();p=int(p);q=int(q);dp=[0,0,0]
    for end in range(1,len(s)+1):
        value=dp[-1]
        if end>=2 and s[end-2:end] in ('01','10'):value=max(value,dp[-2]+q)
        if end>=3 and s[end-3:end]=='000':value=max(value,dp[-3]+p)
        dp=[dp[-2],dp[-1],value]
    return str(dp[-1])
''',[('错误只允许01','in (\'01\',\'10\')',"in ('01',)"),('错误三个玫瑰获得混合束价格','dp[-3]+p','dp[-3]+q')],100020)

def production_oracle(a):
    answer=None
    for order in permutations(a):
        spent=need=0
        for w,e in order:need=max(need,spent+w);spent+=e
        answer=need if answer is None else min(answer,need)
    return answer
def production_edges():
    yield [(100000,100000)]*100000,10**10
    yield [(100000,1)]*100000,199999
    yield [(100000,1)]*50000+[(100000,100000)]*50000,5000050000
add('atlassian',3,'生产全部产品所需的最少初始资金','每件产品开始前现金至少为其最坏成本w，实际只扣除预期成本e。可任意安排生产顺序，求完成全部产品所需的最少初始现金。','第一行n，随后n行w e。原完整界1≤n≤100000、1≤e≤w≤100000。输出精确整数，不能受原示例签名int的32位限制。','按w−e从大到小排序，维护已花费用，答案取已花费用+w的最大值。','相邻产品a,b若余量wa−ea≥wb−eb，则先a的需求max(wa,ea+wb)不超过先b的max(wb,eb+wa)：wa≤eb+wa，且ea+wb≤eb+wa。交换逆序对不增需求，排序最优，前缀公式给该顺序最低资金。','O(n log n)时间、O(n)空间；答案可达10^10。',[[(5,1),(4,3)],[(5,5),(5,5)],[(1,1)]],lambda r:[(w,r.randint(1,w)) for w in [r.randint(1,12) for _ in range(r.randint(1,7))]],production_edges,lambda a:str(len(a))+'\n'+'\n'.join(seq(v) for v in a)+'\n',production_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));a=list(zip(d[1::2],d[2::2]));spent=answer=0
    for w,e in sorted(a,key=lambda p:p[0]-p[1],reverse=True):
        answer=max(answer,spent+w);spent+=e
    return str(answer)
''',[('错误余量升序','reverse=True','reverse=False'),('错误初始资金仅为实际总花费','return str(answer)','return str(spent)')],1400030)

ROMAN_TABLE=(('','M','MM','MMM'),('','C','CC','CCC','CD','D','DC','DCC','DCCC','CM'),('','X','XX','XXX','XL','L','LX','LXX','LXXX','XC'),('','I','II','III','IV','V','VI','VII','VIII','IX'))
def roman_oracle(a):
    return '\n'.join(''.join(ROMAN_TABLE[i][int(c)] for i,c in enumerate(str(v).zfill(4))) for v in a)
def roman_edges():
    yield [3888]*100000,'\n'.join(['MMMDCCCLXXXVIII']*100000)
    yield [3999]*100000,'\n'.join(['MMMCMXCIX']*100000)
    yield list(range(1,4000)),roman_oracle(list(range(1,4000)))
add('atlassian',4,'整数数组转标准罗马数字','将每个正整数转换为标准大写罗马数字，采用IV、IX、XL、XC、CD、CM六种减法表示，按输入顺序输出。','第一行n，第二行n个整数。原文缺数值界，本站补充1≤n≤100000、每数1..3999；不采用横线或重复M表示更大整数的扩展。这是本站补充域，不宣称来源原界。','按1000到1的13种标准符号值，从大到小用整除决定重复次数，扣去对应值。','千位只能用M，百十个位各由最大可用符号及规定减法组合唯一表示；从大到小取值恰落实各位的标准表示，不影响剩余低位，逐位归纳得到唯一结果。','每数最多15个字符，O(n)时间，保存结果O(n)空间；stdout≤1600000字节。',[[1,49,23],[4,9,40,90,400,900],[3888,3999]],lambda r:[r.randint(1,3999) for _ in range(r.randint(1,12))],roman_edges,arr,roman_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()[1:]));out=[]
    values=[(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]
    for v in a:
        result=''
        for value,symbol in values:
            q,v=divmod(v,value);result+=symbol*q
        out.append(result)
    return '\\n'.join(out)
''',[('错误4使用加法','(4,\'IV\')',"(4,'IIII')"),('错误9使用加法','(9,\'IX\')',"(9,'VIIII')")],500010,output='每个整数对应一行罗马字符串，共n行，不输出数量头。')

def partitions_oracle(x):
    capacity,used=x;need=sum(used);best=len(capacity)
    for mask in range(1<<len(capacity)):
        if sum(v for i,v in enumerate(capacity) if mask>>i&1)>=need:best=min(best,mask.bit_count())
    return best
def partitions_random(r):
    a=[r.randint(1,20) for _ in range(r.randint(1,10))]
    return a,[r.randint(0,v) for v in a]
def partitions_edges():
    yield ([10**9]*200000,[10**9]*200000),200000
    yield ([10**9]*200000,[0]*200000),0
    yield ([10**9]*200000,[1]*200000),1
    yield ([1]*199999+[10**9],[1]*199999+[0]),1
add('cloudflare',1,'数据重新分配后最少保留分区数','每个分区给出容量与已使用量，数据允许拆成块并移动到其他分区。求容纳全部现有数据所需保留的最少分区数，不要求原分区内的数据整体迁移。','第一行n，第二行n个容量，第三行n个已用量。原无数值界，本站补充1≤n≤200000、容量1..10^9、0≤used[i]≤capacity[i]。总使用量为0时本站明确输出0。','总已用量不变，按容量降序取最短前缀使总容量达到总使用量。','数据可拆分，因此一个保留子集可行当且仅当容量和足够。固定分区数量时最大容量和由最大的那些容量获得，所以第一次足够的前缀长度就是最小可行数量。','O(n log n)时间、O(n)空间；总量用64位。',[([10,15,15,20],[5,10,15,5]),([2,9],[0,0]),([2,9],[2,2])],partitions_random,partitions_edges,lambda x:arr(x[0])+seq(x[1])+'\n',partitions_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];need=sum(d[n+1:]);total=0;answer=0
    if need==0:return '0'
    for v in sorted(a,reverse=True):
        total+=v;answer+=1
        if total>=need:break
    return str(answer)
''',[('错误选最小容量优先','reverse=True','reverse=False'),('错误空数据仍保留分区',"if need==0:return '0'","if need==0:return '1'")],4400040)

BLOCKED={'oa-airbnb-5':'转义与列表语法缺失，不能擅自排除原允许的转义值。','oa-airbnb-6':'原n10万、width1万完整域约1GB输入/2GB输出，超当前判题容量，不能缩域。','oa-airbnb-7':'多方最高强度并列时低强军队命运未定义，不能补猜结算规则。','oa-airbnb-8':'正文截断，舍入范围/目标/不可行输出缺失。','oa-atlassian-5':'任意实数中心定义与整数返回及样例矛盾：样例连续最优1.5而输出2。'}
EVIDENCE={'oa-airbnb-1':['OA LIST/Airbnb_OA/001_image.txt','OA LIST/Airbnb_OA/_chapter.md']}
for n,slug in enumerate(['donut-challenge','get-minimum-moves','minimum-eating-speed','parse-query-string','print-sentences-as-table','resolve-battles','round-prices-to-match-target'],2):EVIDENCE[f'oa-airbnb-{n}']=['fastprep/Airbnb/airbnb-'+slug+'.md']
EVIDENCE['oa-coinbase-1']=['fastprep/Coinbase/coinbase-find-the-length-of-the-longest-common-prefix.md']
EVIDENCE['oa-github-1']=['fastprep/Github/github-brdige-car-weight.md']
for n,slug in enumerate(['better-compression','flower-bouquets','plan-production','romanizer'],1):EVIDENCE[f'oa-atlassian-{n}']=['fastprep/Atlassian/atlanssian-'+slug+'.md']
EVIDENCE['oa-atlassian-4'].append('fastprep/BNP/bnp-romanizer.md')
EVIDENCE['oa-atlassian-5']=['fastprep/Atlassian/atlassian-get-maximum-distance.md','fastprep/Fortinet/fortinet-get-maximum-distance.md','OA LIST/Pinterest_OA/013_image.txt']
EVIDENCE['oa-cloudflare-1']=['fastprep/Cloudflare/cloudflare-determine-min-partitions-required.md']

def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(a,b,s):
    if s.get('checker')=='exact':return a.rstrip('\n')==b.rstrip('\n')
    if a==b:return True
    import re
    from itertools import zip_longest
    return all(x==y for x,y in zip_longest((m.group() for m in re.finditer(r'\S+',a)),(m.group() for m in re.finditer(r'\S+',b))))
SMALL_RUNNER="""import io,json,sys,contextlib
if hasattr(sys,'set_int_max_str_digits'):sys.set_int_max_str_digits(0)
code,inputs=json.load(sys.stdin);out=[]
for raw in inputs:
    sys.stdin=io.StringIO(raw);buf=io.StringIO()
    with contextlib.redirect_stdout(buf):exec(compile(code,'<authored>','exec'),{'__name__':'__main__'})
    out.append(buf.getvalue())
print(json.dumps(out,ensure_ascii=False))
"""
def small_check():
    selected={v for v in sys.argv[1:] if v!='--small'}
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        rng=random.Random(SEED+sum(s['n'].encode()));values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        cases=[(s['encode'](v),str(s['oracle'](v))+'\n') for v in values];code=code_for(s)
        def run(program):
            p=subprocess.run([sys.executable,'-I','-c',SMALL_RUNNER],input=json.dumps([program,[raw for raw,_ in cases]],ensure_ascii=False),text=True,capture_output=True,timeout=120)
            assert p.returncode==0,(s['n'],p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(cases);return out
        actual=run(code)
        for i,(a,(_,expected)) in enumerate(zip(actual,cases)):assert equal(a,expected,s),(s['n'],i,cases[i][0],a,expected)
        for name,old,new in s['mutants']:
            assert old in code,(s['n'],name)
            assert any(not equal(a,expected,s) for a,(_,expected) in zip(run(code.replace(old,new)),cases)),(s['n'],name,'survived')
        print(s['n'],len(cases),'independent small cases; 2 normal-exit WA; real stdin/stdout passed',flush=True)
def execute(path,inputs):
    begin=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(inputs)
    return out,time.monotonic()-begin
def main():
    if '--small' in sys.argv:small_check();return
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(sys.argv[1:])
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in sorted(SPECS,key=lambda s:s['n']):
        number=s['n'];ident=number
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(SEED+sum(number.encode()))
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=str(s['oracle'](v))+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=str(a)+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:31];assert 34<=len(tests)<=64
        for c in oracles+tests:
            assert len(c['input'].encode())<=s['bound']<=32*1024*1024,(ident,len(c['input'].encode()),s['bound'])
            assert len(c['expectedOutput'].encode())<=s.get('outputLimit',4096)*1024
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert equal(a,c['expectedOutput'],s),(ident,i,a[:200],c['expectedOutput'][:200])
        del actual
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not equal(a,c['expectedOutput'],s)];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected));del outputs
        explanation=s.get('explanation','三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') or '空文本' for c in oracles[:3])+'。独立枚举或直接模拟已核对。')
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA',s['company']],description=s['desc']+'\n\n本站独立整理标准I/O与题解；来源缺失界的补充及样例纠错在协议中明示。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        assert len(normalized.encode())<=128*1024*1024,(ident,'package exceeds128MiB')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        assert (OUT/'packages'/f'{ident}.json').stat().st_size<=128*1024*1024
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracle;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:x['id']);reports.sort(key=lambda x:x['id'])
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del cases,tests,boundary,oracles,normalized,p,doc,c;gc.collect()
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,paths in EVIDENCE.items():
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=number;reason=BLOCKED[number] if number in BLOCKED else next(s['desc']+' '+s['limits'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()

