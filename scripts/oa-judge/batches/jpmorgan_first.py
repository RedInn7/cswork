"""JPMorgan 3–20, independent authored algorithms; never execute source code."""
from pathlib import Path
from collections import deque
from functools import lru_cache
from itertools import product
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='jpmorgan-first';SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def rows(a):return str(len(a))+'\n'+'\n'.join(seq(x) for x in a)+'\n'
def vector(a):return str(len(a))+'\n'+'\n'.join(map(str,a))
def add(number,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(number=number,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def consign_oracle(a):
    # Literal legal unit-edit BFS, not the prefix-sum formula.
    start=tuple(a);q=deque([(start,0)]);seen={start}
    while q:
        state,dist=q.popleft()
        if any(sum(state[:i])==sum(state[i:]) for i in range(1,len(a))):return str(dist)
        for i in range(len(a)):
            for delta in (-1,1):
                if state[i]+delta<1:continue
                t=state[:i]+(state[i]+delta,)+state[i+1:]
                if t not in seen:seen.add(t);q.append((t,dist+1))
add(3,'两批货物总量相等的最少调整','在相邻品类之间切一刀，形成两个非空连续批次；一次把任一品类数量加一或减一，但数量始终为正。求两批总量相等的最少操作数。','第一行n，随后n个quantity。原OCR完整范围2≤n≤300000，1≤quantity[i]≤2000000000。','扫描每个非空分割点，取左右总量差绝对值的最小值。','一次操作最多使两边差缩小1，因此固定分割至少需要差的绝对值次。把较小批次中的任一品类持续增加，恰好这么多次即可相等且始终为正，所以每个分割的下界可达。枚举全部分割得到最优。','时间O(n)，除输入外O(1)空间。',[[1,4,4],[3,3,6,3,9],[4,5,7]],lambda r:[r.randint(1,4) for _ in range(r.randint(2,4))],lambda:[([2000000000]*300000,'0'),([2000000000]*299999,'2000000000'),([1,2000000000],'1999999999'),([1]*299999+[2000000000],'1999700001')],arr,consign_oracle,"""def solve(raw):
    a=list(map(int,raw.split()))[1:];total=sum(a);prefix=0;best=total
    for v in a[:-1]:
        prefix+=v;best=min(best,abs(2*prefix-total))
    return str(best)
""",[('允许空批次','a[:-1]','a[:0]'),('只看中间分割','return str(best)','return str(abs(2*sum(a[:len(a)//2])-total))')],3300020)

def pivot_rand(r):
    left=[r.randint(1,10) for _ in range(r.randint(1,7))]
    right=left[:];r.shuffle(right)
    return left+[r.randint(1,20)]+right
add(4,'左右总和相同的枢轴下标','不重排数组，找出其左侧和右侧元素总和相同的枢轴，求0基下标，枢轴本身不计入两侧。保证存在解。','第一行n，随后n个正整数；完整原界3≤n≤100000，1≤a[i]≤20000，保证有解来自原始正文。','维护总和及当前下标之前的前缀和，检查left=total−left−a[i]。','遍历到i时left恰为左侧和，总和减left和当前项恰为右侧和，判断充要。正数使左减右随下标严格递增，所以至多一个枢轴，保证有解即可返回。','时间O(n)，除输入外O(1)空间。',[[1,2,3,4,6],[1,2,3,3],[7,1,7]],pivot_rand,lambda:[([1]*49998+[2,20000]+[1]*50000,'49999'),([20000]*99999,'49999'),([1,20000,1],'1'),([20000,1]+[1]*20000,'1')],arr,lambda a:str(next(i for i in range(len(a)) if sum(a[:i])==sum(a[i+1:]))),"""def solve(raw):
    a=list(map(int,raw.split()))[1:];total=sum(a);left=0
    for i,v in enumerate(a):
        if left==total-left-v:return str(i)
        left+=v
    return '-1'
""",[('枢轴计入右侧','total-left-v','total-left'),('返回1基下标','return str(i)','return str(i+1)')],600020)

def profit_oracle(events):
    cash=0;prices={};shares={};out=[]
    for e in events:
        p=e.split();op=p[0]
        if op=='QUERY':out.append(cash+sum(q*prices.get(s,0) for s,q in shares.items()));continue
        s=p[1];v=int(p[2]);price=prices.get(s,0)
        if op=='CHANGE':prices[s]=price+v
        else:
            q=v if op=='BUY' else -v;shares[s]=shares.get(s,0)+q;cash-=q*price
    return vector(out)
def profit_rand(r):
    holdings={};events=[]
    for _ in range(r.randint(1,25)):
        s=r.choice(['A','中','😀']);kind=r.choice(['BUY','SELL','CHANGE','QUERY'])
        if kind=='SELL' and not holdings.get(s):kind='BUY'
        if kind=='QUERY':events.append(kind);continue
        v=r.randint(-10,10) if kind=='CHANGE' else r.randint(1,min(10,holdings.get(s,10)) if kind=='SELL' else 10)
        events.append(f'{kind} {s} {v}')
        if kind!='CHANGE':holdings[s]=holdings.get(s,0)+(v if kind=='BUY' else -v)
    return events
def profit_edges():
    yield ['BUY A 1000']*49999+['CHANGE A 1000']*50000+['QUERY'],vector([2499950000000000])
    yield ['QUERY']*100000,vector([0]*100000)
    yield ['BUY '+'😀'*15+' 1']*100000,vector([])
    yield ['BUY '+'\x00'*15+' 1']*100000,vector([])
    yield ['BUY X 1','CHANGE X -1000','SELL X 1','QUERY'],vector([-1000])
add(5,'实时持仓净盈亏','BUY和SELL以当时市价交易，CHANGE是价格变化量，QUERY查询从开始至今的净盈亏，包含尚未售出持仓的浮动盈亏；SELL保证持仓充足。原例输出是占位值，正确查询为120、200。','输入一个JSON字符串数组，每项事件为BUY stock quantity、SELL stock quantity、CHANGE stock delta或QUERY。原界1≤事件数≤100000，每条事件≤21个字符（本站按Unicode码点计）；数量1..1000，|delta|≤1000。股票名为单个非空无空白token，保留Unicode和JSON转义所表示的非空白控制字符；事件字段用一个空格分隔。','维护各股票持仓数和累计损益；买卖只改持仓，变价时损益增加持仓乘变化量。','按市价交易时现金变化与持仓市值变化互相抵消，净资产不变；仅价格变化使净资产增加当前持仓乘价格差。初始损益0，按事件归纳维护的值始终等于现金加持仓市值相对初始的变化。','时间O(输入长度)，空间O(股票数+查询数)。',[['BUY googl 20','BUY aapl 50','CHANGE googl 6','QUERY','SELL aapl 10','CHANGE aapl 2','QUERY'],['QUERY','BUY A 2','CHANGE A -3','QUERY'],['BUY A 1','SELL A 1']],profit_rand,profit_edges,lambda a:json.dumps(a,ensure_ascii=False)+'\n',profit_oracle,"""def solve(raw):
    import json
    holdings={};gain=0;out=[]
    for line in json.loads(raw):
        p=line.split();op=p[0]
        if op=='QUERY':out.append(gain);continue
        s=p[1];v=int(p[2])
        if op=='CHANGE':gain+=holdings.get(s,0)*v
        else:holdings[s]=holdings.get(s,0)+(v if op=='BUY' else -v)
    return str(len(out))+'\\n'+'\\n'.join(map(str,out))
""",[('价格变化忽略持仓','holdings.get(s,0)*v','v'),('卖出增加持仓',"v if op=='BUY' else -v",'v')],13000010,output='第一行查询数，随后每行一个净盈亏；没有QUERY时仅输出0。')

add(6,'两轮四轮车的车队方案数','每次给出轮子总数，从无限辆两轮车和四轮车中组成车队，只有两类车辆数量不同才视为不同方案，不计算排列。','第一行n，随后n个wheels；1≤n≤100000，1≤wheels[i]≤1000000。','奇数不可行；偶数的四轮车数从0到w//4，每种数量唯一决定两轮车数。','两类车辆轮数都是偶数，奇数无解；偶数时每个0..floor(w/4)的四轮车数量都留下非负偶数轮，且对应唯一两轮车数量，所以方案数是floor(w/4)+1。','时间O(n)，输出空间O(n)。',[[4,5,6],[1,2,3],[8,10,12]],lambda r:[r.randint(1,100) for _ in range(r.randint(1,12))],lambda:[([1000000]*100000,'\n'.join(['250001']*100000)),([999999]*100000,'\n'.join(['0']*100000)),([2],'1'),([4],'2')],arr,lambda a:'\n'.join(str(sum((w-4*b)%2==0 for b in range(w//4+1))) for w in a),"""def solve(raw):
    a=list(map(int,raw.split()))[1:]
    return '\\n'.join(str(0 if w%2 else w//4+1) for w in a)
""",[('奇数也可行','0 if w%2 else w//4+1','w//4+1'),('漏掉全两轮车','w//4+1','w//4')],800020,output='依输入顺序输出n行方案数。')

def dropped_oracle(a):
    pool=[];lost=0
    for v in a:
        if v>0:pool.extend([object() for _ in range(v)])
        elif pool:pool.pop()
        else:lost+=1
    return str(lost)
add(7,'线程耗尽时丢弃的请求','正数事件增加相应数量的线程，−1代表请求。一个请求消耗并销毁一个线程，线程不足时丢弃；求丢弃总数。这不是滑动窗口限流。','第一行n，随后事件数组；1≤n≤100000，元素为−1或1..10000。','顺序维护可用线程数，请求到达时有线程则减一，否则累计丢弃。','处理任何前缀后，可用数恰为已增加线程减去成功请求数；根据其是否为零判定下一请求是否成功与原规则完全一致，归纳得丢弃计数正确。','时间O(n)，除输入外空间O(1)。',[[1,-1,-1,1],[-1,-1],[3,-1,-1,-1]],lambda r:[r.choice([-1,-1,1,2,5]) for _ in range(r.randint(1,20))],lambda:[([-1]*100000,'100000'),([10000]*100000,'0'),([1,-1]*50000,'0'),([-1]*50000+[10000]*50000,'50000')],arr,dropped_oracle,"""def solve(raw):
    free=lost=0
    for v in map(int,raw.split()[1:]):
        if v>0:free+=v
        elif free:free-=1
        else:lost+=1
    return str(lost)
""",[('线程不销毁','free-=1','free-=0'),('新增替代累加','free+=v','free=v')],600020)

def digits_oracle(a):return '\n'.join(str(sum(len(set(str(v)))==len(str(v)) for v in range(l,h+1))) for l,h in a)
def digits_rand(r):return [(lambda l:(l,r.randint(l,l+60)))(r.randint(1,300)) for _ in range(r.randint(1,8))]
def digits_edges():
    # Count 1..6 digit numbers: 9 choices first, falling factorial for the rest.
    total=0;term=9
    for length in range(1,7):
        if length>1:term*=11-length
        total+=term
    yield [(1,1000000)]*100000,'\n'.join([str(total)]*100000)
    yield [(1000000,1000000)]*100000,'\n'.join(['0']*100000)
    yield [(987654,987654)],'1'
    yield [(11,11),(10,10)],'0\n1'
add(8,'区间内数字不重复的整数数量','对每个正整数闭区间，统计十进制表示中没有重复数字的整数。原例[9,84]应为69，原47错误且其列表漏掉84。','第一行q，随后q行lower upper。原界1≤q≤100000，原文端点上界截断；本站补充1≤lower≤upper≤1000000。','一次枚举所有无重复数字的正整数（至多6位）并排序；每次用两次二分统计闭区间内数量。','DFS每次选择未用数字且首位非零，因而每个产生数合法；任意合法数按其各位恰对应唯一DFS路径。排序后二分左端前与右端后的下标差恰等于区间中合法数数目。','预处理O(U log U)，查询O(q log U)，空间O(U+q)；U为不超过百万的合法数数量。',[[(1,20),(9,19)],[(7,8),(52,80),(9,84),(57,64),(74,78)],[(80,120)]],digits_rand,digits_edges,rows,digits_oracle,"""from bisect import bisect_left,bisect_right
VALID=None
def solve(raw):
    global VALID
    if VALID is None:
        VALID=[]
        def visit(v,mask):
            if v:VALID.append(v)
            for d in range(10):
                if (not v and not d) or mask>>d&1:continue
                w=v*10+d
                if w<=1000000:visit(w,mask|1<<d)
        visit(0,0);VALID.sort()
    d=list(map(int,raw.split()))[1:]
    return '\\n'.join(str(bisect_right(VALID,h)-bisect_left(VALID,l)) for l,h in zip(d[::2],d[1::2]))
""",[('排除右端点','bisect_right(VALID,h)','bisect_left(VALID,h)'),('排除左端点','bisect_left(VALID,l)','bisect_right(VALID,l)')],1600020,output='输出q行计数，依次对应每个闭区间。')

def signals_rand(r):
    c=r.randint(1,20);return [r.randint(1,30) for _ in range(r.randint(1,15))],[(r.randint(1,c),r.randint(c,30)) for _ in range(r.randint(1,10))]
add(9,'穿过全部频率过滤器的信号数','每个闭区间过滤器只放行区间内频率。求通过所有过滤器的输入信号数，重复频率按多条信号计。所有过滤器保证有共同范围。','第一行n m，第二行n个频率，随后m行lower upper；1≤n,m≤100000，频率和端点1..1000000000。','交集下界取所有下界最大值，上界取所有上界最小值，统计落入其中的信号。','信号通过全部过滤器当且仅当不小于每个下界且不大于每个上界，等价于属于最大下界到最小上界的闭区间；逐项计数保留重复信号。','时间O(n+m)，空间O(n+m)用于解析。',[([10,13,15,16,17],[(10,17),(13,15),(13,17)]),([1,1,2],[(1,1)]),([1,2],[(3,4)])],signals_rand,lambda:[(([1000000000]*100000,[(1000000000,1000000000)]*100000),'100000'),(([1]*100000,[(2,1000000000)]*100000),'0'),(([1,2,2,3],[(2,2)]),'2'),(([1,1000000000],[(1,1000000000)]),'2')],lambda x:f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+'\n'.join(seq(v) for v in x[1])+'\n',lambda x:str(sum(all(l<=f<=h for l,h in x[1]) for f in x[0])),"""def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];v=d[2+n:];left=max(v[::2]);right=min(v[1::2])
    return str(sum(left<=f<=right for f in a))
""",[('错误取并集','left=max(v[::2]);right=min(v[1::2])','left=min(v[::2]);right=max(v[1::2])'),('误用开区间','left<=f<=right','left<f<right')],3300030)

def teams_oracle(x):
    a,b,p=x;dp=[p+1]*(p+1);dp[0]=0
    for i in range(1,p+1):
        for size in (a,b):
            if size<=i:dp[i]=min(dp[i],dp[i-size]+1)
    return str(dp[p] if dp[p]<=p else -1)
add(10,'两种规模队伍的最少队数','每人恰好属于一队，每队人数为a或b。将p人全部分组，求最少队数；无解输出−1。','一行a b p；完整原界1≤a,b,p≤100000。','枚举a人队数量，剩余人数若能整除b即可组成方案，取队数最少。','任一合法方案的a人队数必在枚举范围；固定它后b人队数量由剩余人数唯一决定，整除检查是合法的充要条件。取所有合法方案最小即最优，无候选则无解。','时间O(p/a+1)，额外空间O(1)。',[(3,4,7),(4,6,7),(1,100,100)],lambda r:(r.randint(1,20),r.randint(1,20),r.randint(1,80)),lambda:[((1,100000,100000),'1'),((99999,100000,100000),'1'),((2,4,99999),'-1'),((1,1,100000),'100000')],lambda x:seq(x)+'\n',teams_oracle,"""def solve(raw):
    a,b,p=map(int,raw.split());best=p+1
    for x in range(p//a+1):
        rest=p-a*x
        if rest%b==0:best=min(best,x+rest//b)
    return str(best if best<=p else -1)
""",[('漏掉全a方案','range(p//a+1)','range(p//a)'),('余数也强制分组','if rest%b==0:','if True:')],30)

def prefix_oracle(a):
    # Unit-cost BFS on a short bounded array; whole-array moves are unnecessary
    # because equality is translation invariant, so anchor the last coordinate.
    start=tuple(a);q=deque([(start,0)]);seen={start};lo=min(a);hi=max(a)
    while q:
        state,cost=q.popleft()
        if len(set(state))==1:return str(cost)
        for k in range(1,len(a)):
            for delta in (-1,1):
                nxt=tuple(v+(delta if i<k else 0) for i,v in enumerate(state))
                if min(nxt)>=lo and max(nxt)<=hi and nxt not in seen:seen.add(nxt);q.append((nxt,cost+1))
add(11,'前缀整体调整的最小总成本','选择任意非空前缀并整体加整数x，成本为|x|；求使所有元素相等的最小总成本，最终公共值不指定。','第一行n，随后n个整数。原文未给数值范围，本站补充1≤n≤200000，−1000000000≤a[i]≤1000000000。','答案是所有相邻元素差的绝对值之和。','长度i的前缀操作只影响第i个相邻差，其他相邻差不变。消除该差至少付其绝对值，故所有边界之和为下界。从后往前将每个前缀调整到右邻值恰支付这个总和，达到下界；全数组平移不影响相等性且无需使用。','时间O(n)，除输入外空间O(1)。',[[1,4,2,1],[-1,-1],[-2,2,-2]],lambda r:[r.randint(-2,2) for _ in range(r.randint(1,4))],lambda:[([-1000000000,1000000000]*100000,str(2000000000*199999)),([-1000000000]*200000,'0'),([1000000000],'0'),([3,2,1],'2')],arr,prefix_oracle,"""def solve(raw):
    a=list(map(int,raw.split()))[1:]
    return str(sum(abs(x-y) for x,y in zip(a,a[1:])))
""",[('有符号差抵消','abs(x-y)','x-y'),('额外要求归零','return str(sum','return str(abs(a[-1])+sum')],2400020)

def pairs_oracle(x):
    a,b=x
    @lru_cache(None)
    def go(i,mask):
        if i==len(a):return 0
        return max([go(i+1,mask)]+[1+go(i+1,mask|1<<j) for j,v in enumerate(b) if not mask>>j&1 and a[i]>v])
    return str(go(0,0))
add(12,'严格较大的最大一对一配对数','从等长数组a、b各取一个元素组成配对，要求a元素严格大于b元素。每个位置至多使用一次，求最大配对数。','第一行n，第二行a，第三行b；1≤n≤100000，元素1..1000000000，允许重复。','将两数组升序排序，用当前最小可用a匹配最小可用b；a不够大就跳过a。','若最小a不能胜最小b，它不可能胜任何剩余b，可舍弃。若能胜，存在最优解包含这对：若各自原来与其他元素配对，交换后更大的另一a仍能胜原来与当前a匹配的b；其余情况直接替换不会减少数量。归纳得到贪心最优。','时间O(n log n)，空间O(n)。',[([1,2,3],[1,2,1]),([1,2,3,4,5],[6,6,1,1,1]),([2,3,3],[3,4,5])],lambda r:(lambda n:([r.randint(1,10) for _ in range(n)],[r.randint(1,10) for _ in range(n)]))(r.randint(1,7)),lambda:[(([1000000000]*100000,[999999999]*100000),'100000'),(([1000000000]*100000,[1000000000]*100000),'0'),((list(range(1,100001)),list(range(1,100001))),'99999'),(([2],[1]),'1')],lambda x:arr(x[0])+seq(x[1])+'\n',pairs_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=sorted(d[1:n+1]);b=sorted(d[n+1:]);j=0
    for v in a:
        if j<n and v>b[j]:j+=1
    return str(j)
""",[('等值也配对','v>b[j]','v>=b[j]'),('从最大b开始','b=sorted(d[n+1:])','b=sorted(d[n+1:],reverse=True)')],2200030)

def mergecost_oracle(a):
    a=list(a);cost=0
    while len(a)>1:
        a.sort();low=a.pop(0);high=a.pop();num=low+high;den=high-low+1
        # divmod independent of reference negated-floor expression.
        q,r=divmod(num,den);cost+=q+bool(r);a.append(num)
    return str(cost)
def mergecost_edges():
    yield [0]*200000,'0'
    yield [1]*200000,str(2*199999)
    # With -1 and accumulated -k: first cost -2, then floor-negative ceil
    # is -1 for k>=2 (except k=2: ceil(-3/2)=-1).
    yield [-1]*200000,str(-200000)
    yield [-1000000000,1000000000]*100000,'0'
    yield [1000000000,1000000000],'2000000000'
add(14,'反复合并当前最小值与最大值的成本','每次移除当前数组最小和最大两个元素（必须是两个位置），插入它们的和；本次成本为ceil((min+max)/(max−min+1))。重复至只剩一个元素，求总成本。负数同样按数学向上取整。','第一行n，随后n个整数。原文无数值界，本站补充1≤n≤200000，元素−1000000000..1000000000。','分别用最小堆、最大堆保存带唯一ID的元素，用有效标记懒删除。每轮取出两个有效极值，计算精确向上取整，加入新元素。','有效标记使两个堆所表示的有效元素始终恰为当前多重集合；堆顶清理无效项后就是相应极值。先删除最小值再取最大值保证重复值也来自不同位置。插入两者之和保持集合不变量，归纳每轮与原过程一致。整数恒等式ceil(p/q)=−floor(−p/q)，q>0，适用于负数且不受浮点误差影响。','时间O(n log n)，空间O(n)；中间结果使用精确整数。',[[2,3,4,5,7],[-2,-2],[-4,1,2]],lambda r:[r.randint(-10,10) for _ in range(r.randint(1,10))],mergecost_edges,arr,mergecost_oracle,"""import heapq
def solve(raw):
    a=list(map(int,raw.split()))[1:];n=len(a);small=[(v,i) for i,v in enumerate(a)];large=[(-v,i) for i,v in enumerate(a)];heapq.heapify(small);heapq.heapify(large);alive=[True]*(2*n);cost=0
    for ident in range(n,2*n-1):
        while not alive[small[0][1]]:heapq.heappop(small)
        low,i=heapq.heappop(small);alive[i]=False
        while not alive[large[0][1]]:heapq.heappop(large)
        neg,j=heapq.heappop(large);alive[j]=False;high=-neg
        value=low+high;den=high-low+1;cost+=-((-value)//den)
        heapq.heappush(small,(value,ident));heapq.heappush(large,(-value,ident))
    return str(cost)
""",[('用下取整代替上取整','-((-value)//den)','value//den'),('分母多一被遗漏','high-low+1','max(1,high-low)')],2400020)

def toc_oracle(lines):
    out=[]
    for i,line in enumerate(lines):
        chapters=[j for j in range(i+1) if lines[j].startswith('# ')]
        if line.startswith('# '):out.append(str(len(chapters))+'. '+line[2:])
        elif line.startswith('## '):out.append(f'{len(chapters)}.{sum(lines[j].startswith("## ") for j in range(chapters[-1]+1,i+1))}. '+line[3:])
    return json.dumps(out,ensure_ascii=False)
def toc_rand(r):
    lines=['body']*r.randint(0,3)+['# '+''.join(r.choice(' a中😀\t\x00') for _ in range(r.randint(0,9)))]
    for _ in range(r.randint(0,15)):lines.append(r.choice(['# ','## ','text ',' # '])+''.join(r.choice(' a中😀\t\x00') for _ in range(r.randint(0,9))))
    return lines
def toc_edges():
    yield ['# '+'😀'*98]*1000,json.dumps([f'{i}. '+'😀'*98 for i in range(1,1001)],ensure_ascii=False)
    yield ['# '+'\x00'*98]*1000,json.dumps([f'{i}. '+'\x00'*98 for i in range(1,1001)],ensure_ascii=False)
    yield ['# ']+['## '+' '*97]*999,json.dumps(['1. ']+[f'1.{i}. '+' '*97 for i in range(1,1000)],ensure_ascii=False)
    yield ['x'*100]*1000,'[]'
add(16,'保留标题字符的章节目录','严格以“# ”开头的是章，以“## ”开头的是节，其余忽略；首个有效标题保证是章。章从1编号，节号在新章重新从1开始，仅去掉固定标记前缀，不修剪标题。没有有效标题时目录为空。','输入JSON字符串数组；1≤行数≤1000，每行1..100个Unicode码点。原文未限制字符集；JSON转义保留NUL、换行及其他控制字符，允许空标题。','顺序扫描维护章号、节号，识别章时递增章号并重置节号，识别节时递增节号。','扫描任意前缀后，章号等于其中章标题数量，节号等于最后一章后的节数量。两种更新保持该不变量，固定前缀切片不修改任何标题字符，所以格式化结果逐项正确。','时间O(总字符数)，空间O(目录字符数)。',[['# Algorithms','text','## Sorting','## Searching','# Data Structures'],['body','#  A ','## \t B ','# '],['ordinary text']],toc_rand,toc_edges,lambda a:json.dumps(a,ensure_ascii=False)+'\n',toc_oracle,"""def solve(raw):
    import json
    chapter=section=0;out=[]
    for line in json.loads(raw):
        if line.startswith('# '):chapter+=1;section=0;out.append(f'{chapter}. '+line[2:])
        elif line.startswith('## '):section+=1;out.append(f'{chapter}.{section}. '+line[3:])
    return json.dumps(out,ensure_ascii=False)
""",[('跨章不重置节号','chapter+=1;section=0','chapter+=1'),('剥去标题空白','+line[2:]','+line[2:].strip()')],604010,checker='exact',output='输出单行规范JSON数组并换行，空目录为[]；逗号后一个空格；非ASCII直接输出；双引号、反斜杠转义，退格/制表/换行/换页/回车用\\b/\\t/\\n/\\f/\\r，其余U+0000..U+001F用小写四位\\u00xx，斜杠不转义。与Python json.dumps(result, ensure_ascii=False)一致；exact检查。')

def aws_oracle(s):
    while 'AWS' in s:
        i=s.index('AWS');s=s[:i]+s[i+3:]
    return s or '-1'
add(17,'反复删除AWS后的字符串','从大写字符串中反复删除AWS，并把删除位置两侧拼接，直到不再出现；结果为空时输出−1。','一行大写英文字母串，长度1..100000。','逐字符入栈，栈末尾出现AWS就删除这三个字符。','处理前缀后栈内已无AWS；追加一字符只可能在新后缀形成AWS，删除后其余部分本来已无匹配。AWS没有非空真前缀等于后缀，两个可删匹配不重叠，删除顺序可交换；终止过程有唯一结果，栈给出它。','时间O(n)，空间O(n)。',['AWAWSSG','AWS','AWSSAWS'],lambda r:''.join(r.choice('AWSX') for _ in range(r.randint(1,25))),lambda:[('AWS'*33333+'Z','Z'),('AW'*33333+'S'*33333,'-1'),('Z'*100000,'Z'*100000),('A'*100000,'A'*100000)],lambda s:s+'\n',aws_oracle,"""def solve(raw):
    stack=[]
    for c in raw.strip():
        stack.append(c)
        if len(stack)>=3 and stack[-3:]==['A','W','S']:del stack[-3:]
    return ''.join(stack) or '-1'
""",[('只删除首轮原有AWS',"return ''.join(stack) or '-1'","return raw.strip().replace('AWS','') or '-1'"),('空结果错误输出0',"or '-1'","or '0'")],100001,output='输出最终字符串；为空输出−1。')

def parity_oracle(s):
    q=deque([s]);seen={s}
    while q:
        v=q.popleft()
        for i in range(len(v)-1):
            if (int(v[i])-int(v[i+1]))%2:continue
            w=v[:i]+v[i+1]+v[i]+v[i+2:]
            if w not in seen:seen.add(w);q.append(w)
    return max(seen)
add(18,'相邻同奇偶数字交换后的最大串','仅能交换相邻且奇偶相同的两位，可执行任意次。返回最大数字字符串，必须保留全部位数和零。原0082663正确结果为8662003，原样例漏零。','一行数字字符串，长度1..100000，仅含0..9，允许前导零。','切成最大连续同奇偶段，每段按数字从大到小输出，用10个桶统计。','交换不会跨越不同奇偶边界，因此各段位置范围不变；同段任意排列都能通过相邻交换实现。每段降序在首个不同位置取最大值，给出全串字典序最大，同长度数值比较亦如此。','时间O(n)，空间O(n)用于输出，桶O(1)。',['7596801','0082663','0214'],lambda r:''.join(r.choice('012345') for _ in range(r.randint(1,7))),lambda:[('02468'*20000,'8'*20000+'6'*20000+'4'*20000+'2'*20000+'0'*20000),('01'*50000,'01'*50000),('0'*100000,'0'*100000),('13579'*20000,'9'*20000+'7'*20000+'5'*20000+'3'*20000+'1'*20000)],lambda s:s+'\n',parity_oracle,"""def solve(raw):
    s=raw.strip();out=[];i=0
    while i<len(s):
        j=i;counts=[0]*10
        while j<len(s) and int(s[j])%2==int(s[i])%2:counts[int(s[j])]+=1;j+=1
        for d in range(9,-1,-1):out.append(str(d)*counts[d])
        i=j
    return ''.join(out)
""",[('允许跨奇偶边界','int(s[j])%2==int(s[i])%2','True'),('错误升序','range(9,-1,-1)','range(10)')],100001,output='输出原长度的最大数字字符串，不能删除前导零。')

def deletion_oracle(s):
    moves={'U':(0,1),'D':(0,-1),'L':(-1,0),'R':(1,0)};goal=tuple(sum(moves[c][d] for c in s) for d in range(2));best=len(s)
    for mask in range(1<<len(s)):
        if mask.bit_count()>=best:continue
        end=tuple(sum(moves[c][d] for i,c in enumerate(s) if mask>>i&1) for d in range(2))
        if end==goal:best=mask.bit_count()
    return str(len(s)-best)
add(19,'保持终点不变的最多指令删除数','在无障碍无限平面执行UDLR单位移动，删除任意不必连续的指令，同时保持最终坐标，求最多可删数量。','一行指令串，长度1..100000，只含U、D、L、R。','保留必要的净竖直和净水平位移，其余相反方向成对删除。','任何到达相同终点的路径至少需要曼哈顿距离|U−D|+|L−R|步。分别删除成对UD与LR后，剩余指令数量恰为该距离，且终点不变，达到下界。','时间O(n)，额外空间O(1)。',['UDLR','UUURD','L'],lambda r:''.join(r.choice('UDLR') for _ in range(r.randint(1,10))),lambda:[('UDLR'*25000,'100000'),('U'*100000,'0'),('L'*50000+'R'*49999,'99998'),('U'*50000+'R'*50000,'0')],lambda s:s+'\n',deletion_oracle,"""def solve(raw):
    s=raw.strip();dx=s.count('R')-s.count('L');dy=s.count('U')-s.count('D')
    return str(len(s)-abs(dx)-abs(dy))
""",[('水平竖直位移互抵','abs(dx)-abs(dy)','abs(dx+dy)'),('删除数少一半','return str(len(s)-abs(dx)-abs(dy))','return str((len(s)-abs(dx)-abs(dy))//2)')],100001)

def intervals_oracle(a):
    unseen=set(range(len(a)));out=[]
    while unseen:
        seed=unseen.pop();component={seed};q=[seed]
        while q:
            i=q.pop()
            for j in list(unseen):
                if max(a[i][0],a[j][0])<=min(a[i][1],a[j][1]):unseen.remove(j);component.add(j);q.append(j)
        out.append((min(a[i][0] for i in component),max(a[i][1] for i in component)))
    return rows(sorted(out)).rstrip('\n')
def intervals_rand(r):return [(lambda l:(l,r.randint(l,30)))(r.randint(1,25)) for _ in range(r.randint(1,12))]
def intervals_edges():
    yield [(1000000000,1000000000)]*100000,'1\n1000000000 1000000000'
    a=[(2*i+1,2*i+1) for i in range(100000)];yield a,rows(a).rstrip('\n')
    yield [(i+1,i+2) for i in range(100000)],'1\n1 100001'
    yield [(1,1000000000),(2,3),(4,5)],'1\n1 1000000000'
add(20,'合并重叠闭区间','将有重叠的闭区间合并，输出按起点升序的互不重叠区间。同一端点接触也算重叠，但相邻整数端点不相等不算。原例输入含[1,23]，正确结果为[[1,23]]，原输出误按[1,2]计算。','第一行n，随后n行start end；1≤n≤100000，1≤start≤end≤1000000000。原约束intervals[i][2]是端点下标笔误，按两个端点界恢复。','按起点排序，维护最后一个合并段；新起点不超过其终点则延伸，否则新开一段。','排序后起点晚于当前右端的区间与当前段不重叠，后续起点更晚也不能连接，因此可结算。相交则两者并集恰由较小左端和较大右端表示。归纳保持已输出段互不重叠且完整覆盖已处理区间，最终正确。','时间O(n log n)，空间O(n)。',[[(7,7),(2,3),(6,11),(1,23)],[(1,2),(2,3),(5,5)],[(1,1),(2,2)]],intervals_rand,intervals_edges,rows,intervals_oracle,"""def solve(raw):
    d=list(map(int,raw.split()))[1:];a=sorted(zip(d[::2],d[1::2]));out=[]
    for l,h in a:
        if out and l<=out[-1][1]:out[-1][1]=max(out[-1][1],h)
        else:out.append([l,h])
    return str(len(out))+'\\n'+'\\n'.join(f'{l} {h}' for l,h in out)
""",[('相同端点不合并','l<=out[-1][1]','l<out[-1][1]'),('嵌套缩短右端','max(out[-1][1],h)','h')],2200020,output='第一行合并后的区间数，随后每行两个端点，按起点升序。')

BLOCKED={1:'原OCR n≤10^8、k≤10^5与整理MDX百万界冲突；最宽原域输入输出约1.2GB，不能缩域上线，需原图证据。',2:'强制跳到出界与允许中途停止/空选冲突，全负与[5,-10]可区分，不能自定核心规则。',13:'最轻三罐选择、累计中心还是全部重量、边缘处理未定义，原文无例。',15:'移除后是否动态拼接邻接未定义；[4,9,1,9,2]两种规则分别3与7。'}
NAMES={4:'balanced-sum',5:'calculate-net-profit',6:'choose-fleets',7:'count-dropped-requests',8:'count-numbers',9:'count-signals',10:'count-teams',11:'find-minimum-cost',12:'find-num-of-pairs',13:'find-sum-weight',14:'find-total-cost',15:'find-total-weight',16:'generate-table-of-contents',17:'get-final-string',18:'get-largest-number',19:'get-max-deletions',20:'get-merged-intervals'}
def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(s,a,b):return a==b if s.get('checker')=='exact' else a.split()==b.split()
def small_check():
    for s in SPECS:
        rng=random.Random(20267400+s['number']);values=s['samples']+[s['rnd'](rng) for _ in range(160)];scope={};exec(s['code'],scope)
        cases=[(s['encode'](v),s['oracle'](v)) for v in values]
        for raw,expected in cases:assert equal(s,scope['solve'](raw),expected),(s['number'],raw,expected,scope['solve'](raw))
        for name,old,new in s['mutants']:
            assert old in s['code'],(s['number'],name);mut={};exec(s['code'].replace(old,new),mut)
            assert any(not equal(s,mut['solve'](raw),expected) for raw,expected in cases),(s['number'],name)
        print(s['number'],'163 independent small oracles and 2 normal-return WA passed',flush=True)
def execute(path,inputs):
    begin=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(inputs)
    return out,time.monotonic()-begin
def main():
    if '--small' in sys.argv:small_check();return
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in SPECS:
        number=s['number'];ident=f'oa-jpmorgan-chase-{number}'
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(20267400+number)
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=a+'\n') for v,a in s['edges']()]
        tests=oracles[:3]+boundary+oracles[3:27];assert len(tests)>=31
        for c in oracles+tests:
            assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
            assert len(c['expectedOutput'].encode())<=4*1024*1024
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert equal(s,a,c['expectedOutput']),(ident,i,a[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)]
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not equal(s,a,c['expectedOutput'])];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        explanation='三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') for c in oracles[:3])+'。独立枚举或直接模拟已核对这些答案。'
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','JPMorgan Chase'],description=s['desc']+'\n\n输入输出协议由本站整理，缺失数值界明确标为本站补充。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=6,memoryLimit=262144,outputLimit=4096,checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20267400,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del actual,outputs,cases,tests,boundary,oracles,normalized,p
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number in range(1,21):
        paths=([f'OA LIST/JPMorganChase/{number:03d}_image.txt'] if number<3 else ['OA LIST/JPMorganChase/'+v+'_image.txt' for v in ('008','009','010','011')] if number==3 else [f'fastprep/JPMorgan Chase/jpmorgan-{NAMES[number]}.md'])
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=f'oa-jpmorgan-chase-{number}';reason=BLOCKED[number] if number in BLOCKED else next(s['desc'] for s in SPECS if s['number']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
