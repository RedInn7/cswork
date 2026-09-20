"""Snowflake21–40: original implementations, immutable statements only (never source code)."""
from pathlib import Path
from itertools import product,permutations,combinations
from collections import Counter,deque
from functools import lru_cache
import random,json,hashlib,subprocess,sys,time,math,copy
import snowflake_first as previous
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='snowflake-next';SPECS=[];MOD=1000000007
def add(i,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,**kw):
    SPECS.append(dict(id=f'oa-snowflake-{i}',title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,**kw))
def array(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def vec(a):return str(len(a))+'\n'+' '.join(map(str,a))
def seq_encode(v):s,q=v;return s+'\n'+str(len(q))+'\n'+''.join(f'{len(t)} {t or "-"}\n' for t in q)
def seq_oracle(v):
    s,queries=v;out=[]
    for q in queries:
        want=Counter(q);answer=-1
        for length in range(len(s)+1):
            have=Counter(s[:length])
            if all(have[c]>=v for c,v in want.items()):answer=length;break
        out.append(answer)
    return vec(out)
add(21,'读取最短前缀以凑出数字串','对每个查询独立从s的开头顺序读取，允许丢弃多余字符并重排选中字符。求能组成该查询的最短读取前缀长度；不能组成输出−1。原文返回值误称substring，正文与例子明确是从首部读取，不是任意滑窗。','首行数字串s，第二行q，随后q行length query；空查询写0 -。1≤|s|≤100000，1≤q≤20000，查询总长1..500000；字符0..9。原文未排除个别空查询，本站支持并返回0。','按数字记录出现位置。查询中数字c需要r次，则至少读取到c第r次出现的位置，答案是所有这些位置的最大值。','顺序访问意味着所读字符恰是某个前缀。前缀包含需求当且仅当对每个数字已到达其第r次出现位置。因此各位置的最大值既是必要下界，也足以容纳全部需求。','时间O(|s|+查询总长+10q)，空间O(|s|+q)。',[('064819848398',['088','364','07']),('11',['','1','11','111']),('012',['20','22'])],lambda r:(''.join(r.choice('0123') for _ in range(r.randint(1,15))),[''.join(r.choice('0123') for _ in range(r.randint(1,8))) for _ in range(r.randint(1,6))]),[(('0'*100000,['0'*25]*20000),vec([25]*20000)),(('0'*100000,['0'*100000]*5),vec([100000]*5)),(('0'*99999+'1',['1']*20000),vec([100000]*20000)),(('0',['0'*500000]),vec([-1]))],seq_encode,seq_oracle,'''from collections import Counter
def solve(d):
    s=d[0];q=int(d[1]);positions=[[] for _ in range(10)]
    for i,c in enumerate(s,1):positions[int(c)].append(i)
    out=[]
    for j in range(q):
        length=int(d[2+2*j]);query=d[3+2*j] if length else '';answer=0
        for c,count in Counter(query).items():
            p=positions[int(c)]
            if len(p)<count:answer=-1;break
            answer=max(answer,p[count-1])
        out.append(answer)
    return str(q)+'\\n'+' '.join(map(str,out))
''',[('不计前面无用字符','answer=max(answer,p[count-1])','answer=max(answer,count)'),('数字只取首次出现','p[count-1]','p[0]')],output='先输出q，再输出q个最短前缀长度。')
for old,new in ((1,22),(7,23)):
    s=copy.deepcopy(next(s for s in previous.SPECS if s['id']==f'oa-snowflake-{old}'));s['id']=f'oa-snowflake-{new}';s['desc']+=' 此catalog条目与此前题同源，保留独立题目ID及独立验证。';SPECS.append(s)
def partition_oracle(v):
    a,k=v;best=10**30
    for bits in product((0,1),repeat=len(a)-1):
        starts=[0]+[i+1 for i,b in enumerate(bits) if b]+[len(a)]
        if all(y-x<=k for x,y in zip(starts,starts[1:])):best=min(best,sum(max(a[x:y]) for x,y in zip(starts,starts[1:])))
    return str(best)
add(25,'按段最大值付费的最优分割','把整个整数数组按原顺序切成非空连续段，每段长度≤threshold，费用为该段最大值。求所有段费用之和最小值。允许负整数，不能强制分段长度等于上限。','首行n threshold，第二行数组。原文未给数值界；本站补充1≤threshold≤n≤5000，−10⁹≤元素≤10⁹。','dp[i]表示前i项最低费用。逆向枚举最后一段起点，同时维护其最大值，更新dp[i]。','最优分割的最后一段长度必在1..threshold之内，去掉它后前缀也必须最优，否则可替换改善。枚举全部合法末段并取最小，因此递推不漏任何最优解。负费用不影响有限分割上的递推。','时间O(n×threshold)，空间O(n)。',[([1,3,4,5,2,6],3),([-1,-2,-3],3),([10,1,1,10],3)],lambda r:([r.randint(-5,10) for _ in range(n)],r.randint(1,n)) if (n:=r.randint(1,10)) else None,[(([10**9]*5000,5000),str(10**9)),(([-10**9]*5000,5000),str(-5*10**12)),(([10**9]*5000,1),str(5*10**12)),(([1]*5000,4999),'2')],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',partition_oracle,'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));dp=[0]+[10**30]*n
    for i in range(1,n+1):
        largest=-10**30;best=10**30
        for j in range(i-1,max(-1,i-k-1),-1):largest=max(largest,a[j]);best=min(best,dp[j]+largest)
        dp[i]=best
    return str(dp[n])
''',[('忽略负数最大值','largest=-10**30','largest=0'),('段费用误用最小值','largest=max(largest,a[j])','largest=min(largest,a[j])')],timeLimit=8)
def deployment_encode(v):return str(len(v[0]))+'\n'+'\n'.join(' '.join(map(str,a)) for a in v)+'\n'
def deployment_oracle(v):
    best=0;n=len(v[0])
    for order in permutations(range(n)):
        done=set();total=0
        for i in order:total+=v[int(i-1 in done)+int(i+1 in done)][i];done.add(i)
        best=max(best,total)
    return str(best)
add(26,'按相邻部署先后计收益','处理器排成一条链，逐个部署。第i个部署时已有0、1或2个相邻处理器部署，分别得到no[i]、one[i]、both[i]。首尾仅一个邻居。最大化所有处理器收益和。','首行n，随后3行no、one、both。1≤n≤100000，各收益1..10⁹。原例1写both为0与约束冲突，本站样例使用合法正收益；算法也不依赖正性。','把相邻边定向为较早→较晚；任意链的定向都无环，可拓扑实现。按边方向做两状态DP，完成当前点的入边数收益。','每种部署顺序产生唯一边定向且收益只依赖各点入度。反过来无向链的任何定向无有向环，均存在拓扑部署序。枚举左右边的两个方向便覆盖全部可实现收益；DP固定右边方向并取最优前缀，末点结算后最优。','时间O(n)，额外空间O(1)不含输入。',[([2,1,3],[4,2,1],[1,2,3]),([1,6],[2,3],[3,2]),([7],[100],[1000])],lambda r:tuple([r.randint(1,12) for _ in range(n)] for _ in range(3)) if (n:=r.randint(1,7)) else None,[(([10**9]*100000,[10**9]*100000,[10**9]*100000),str(10**14)),(([1]*100000,[2]*100000,[3]*100000),'199999'),(([9]*100000,[1]*100000,[1]*100000),'500000'),(([1],[10**9],[10**9]),'1')],deployment_encode,deployment_oracle,'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:1+2*n]));c=list(map(int,d[1+2*n:]));values=[a,b,c]
    if n==1:return str(a[0])
    dp=[b[0],a[0]]
    for i in range(1,n-1):dp=[max(dp[left]+values[left+1][i] for left in (0,1)),max(dp[left]+values[left][i] for left in (0,1))]
    return str(max(dp[left]+values[left][n-1] for left in (0,1)))
''',[('内部漏计右邻居','values[left+1][i]','values[left][i]'),('单点误当有邻居','if n==1:return str(a[0])','if n==1:return str(b[0])')])
def pod_encode(v):a,ops=v;return f'{len(a)} {len(ops)}\n'+' '.join(map(str,a))+'\n'+''.join(' '.join(map(str,o))+'\n' for o in ops)
def pod_oracle(v):
    a,ops=v;a=list(a)
    for t,p,x in ops:
        if t==1:a[p-1]=x
        else:a=[max(v,x) for v in a]
    return vec(a)
def pod_random(r):
    a=[r.randint(1,20) for _ in range(r.randint(1,10))];ops=[(1,r.randint(1,len(a)),r.randint(0,20)) if r.randrange(2) else (2,-1,r.randint(0,20)) for _ in range(r.randint(1,20))];return a,ops
add(29,'扩容与单点重置后的Pod数量','日志[1,p,x]将1基服务p的数量直接设为x，可以减少；[2,−1,x]将所有少于x的数量提升到x。按日志顺序执行，返回最终数组。','首行n m，第二行初始数量，随后m行日志。1≤n,m≤200000，初值1..10⁹，赋值0..10⁹，1≤p≤n。','逆序处理日志，维护已见全局提升的最大值。遇某服务最后一次单点赋值时确定其最终值；其余服务以初值结合全部提升处理。','最后一次单点赋值覆盖它之前的全部历史，之后的全局提升等价于与后缀阈值最大值取max。逆序第一次遇到该服务赋值正好具有所需后缀值，未遇赋值者保留初值再应用所有提升。','时间O(n+m)，空间O(n+m)。',[([2,4,1,4],[(1,2,30),(1,3,4),(2,-1,10)]),([3,50,2,1,10],[(1,2,0),(2,-1,8),(1,3,20)]),([10],[(2,-1,100),(1,1,0)])],pod_random,[(([1]*200000,[(2,-1,10**9)]*200000),vec([10**9]*200000)),(([10**9]*200000,[(1,i,0) for i in range(1,200001)]),vec([0]*200000)),(([1],[(2,-1,10**9)]*199999+[(1,1,0)]),vec([0])),(([1]*200000,[(1,1,0)]*199999+[(2,-1,10**9)]),vec([10**9]*200000))],pod_encode,pod_oracle,'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));out=[None]*n;floor=0
    for i in range(m-1,-1,-1):
        t,p,x=map(int,d[2+n+3*i:5+n+3*i])
        if t==2:floor=max(floor,x)
        elif out[p-1] is None:out[p-1]=max(x,floor)
    for i in range(n):
        if out[i] is None:out[i]=max(a[i],floor)
    return str(n)+'\\n'+' '.join(map(str,out))
''',[('处理成正序日志','range(m-1,-1,-1)','range(m)'),('错误保留原来的大值','out[p-1]=max(x,floor)','out[p-1]=max(a[p-1],x,floor)')],output='先输出n，再输出最终n个数量。')
s=copy.deepcopy(next(s for s in previous.SPECS if s['id']=='oa-snowflake-12'));s.update(id='oa-snowflake-30',title='相邻变化受限的好子序列',desc='选择最长子序列，使相邻值不相等的次数最多k。可以跳过原数组元素。',limits='首行n k，第二行n个值。原文1≤n≤500，1≤值≤10⁹，0≤k≤min(n,25)。',edges=[(([1]*500,25),'500'),((list(range(1,501)),25),'26'),(([1,2]*250,0),'250'),(([1],1),'1')]);SPECS.append(s)
def stamp(t):return f'{t//60:02}:{t%60:02}'
def meeting_encode(v):events,k=v;return f'{len(events)} {k}\n'+''.join(f'{p} busy {stamp(a)} {stamp(b)}\n' for p,a,b in events)
def meeting_oracle(v):
    events,k=v
    for start in range(1441-k):
        if all(start+k-1<a or start>b for p,a,b in events):return stamp(start)
    return '-1'
def meeting_random(r):
    events=[]
    for i in range(r.randint(1,10)):
        a=r.randrange(1440);events.append((f'p{i}',a,r.randint(a,1439)))
    return events,r.randint(1,1440)
add(31,'全天所有人可参加的最早会议','每条事件格式person action start end，占用起止分钟均包含。求00:00..23:59内所有出现在事件中的人同时空闲的最早连续k分钟时段。无解返回−1，会议不得跨日。','首行n k，随后n行事件；HH:MM格式。1≤n≤100000，1≤k≤1440，每条原事件字符串长度≤40，人数<5000，同一人的事件不重叠。','事件在分钟轴上做差分[start,end+1)，求每分钟忙碌人数。扫描连续零占用分钟数，首次达到k即最早时段。','所有人空闲当且仅当没有事件覆盖对应分钟。差分前缀和准确统计闭区间占用，连续k个零正好意味着完整会议可进行。按时间递增首次达标最早。','时间O(n+1440)，空间O(1440)。',[([('Alex',0,480),('Sam',420,780),('Alex',750,839)],60),([('sam',720,1439),('alex',0,780)],1),([('sam',720,1139),('alex',0,660)],60)],meeting_random,[(([(f'p{i%4000}',i//4000,i//4000) for i in range(100000)],1),'00:25'),(([('p',0,1439)],1),'-1'),(([('p',0,0)],1439),'00:01'),(([('p',1439,1439)],1439),'00:00')],meeting_encode,meeting_oracle,'''def solve(d):
    n,k=map(int,d[:2]);diff=[0]*1441
    def minute(s):h,m=map(int,s.split(':'));return h*60+m
    for i in range(n):
        a=minute(d[4+4*i]);b=minute(d[5+4*i]);diff[a]+=1;diff[b+1]-=1
    busy=run=0
    for t in range(1440):
        busy+=diff[t];run=run+1 if busy==0 else 0
        if run>=k:
            start=t-k+1;return f'{start//60:02}:{start%60:02}'
    return '-1'
''',[('结束分钟误作空闲','diff[b+1]-=1','diff[b]-=1'),('忽略会议完整长度','if run>=k:','if run>=1:')])
def beautiful_oracle(s):
    spots=[i for i,c in enumerate(s) if c=='.'];best=0
    for repl in product('abcdefghijklmnopqrstuvwxyz',repeat=len(spots)):
        a=list(s)
        for i,c in zip(spots,repl):a[i]=c
        total=run=0;last=None
        for c in a:run=run+1 if c==last else 1;total+=run;last=c
        best=max(best,total)
    return str(best)
def beautiful_random(r):
    a=[r.choice('abc') for _ in range(r.randint(1,10))]
    for i in r.sample(range(len(a)),r.randint(0,min(3,len(a)))):a[i]='.'
    return ''.join(a)
add(32,'补全颜色使同色子串最多','用a..z替换全部点号，最大化所有字符相同的连续子串数量。长度1也计数，固定字符不可改变。','一行颜色串，长1..5000，字符a..z或.。输出精确整数。','把补全后的串分解为同色段，长l贡献l(l+1)/2。前缀DP枚举最后一段，逆向扫描直到碰到第二种固定字母即可停止。','一段可补成同色当且仅当其中固定字符至多一种。所有最终同色段构成合法划分，DP枚举覆盖它；反之任意合法划分可以补全各段，若相邻段同色还会额外增加子串，所以DP不会超过可达最优值。两方向合起来最优相等。','时间O(n²)，空间O(n)。',['a.b','...','aa..b'],beautiful_random,[('.'*5000,str(5000*5001//2)),('a'+'.'*4998+'b',str(4999*5000//2+1)),('ab'*2500,'5000'),('a'*2500+'b'*2500,str(2*2500*2501//2))],lambda s:s+'\n',beautiful_oracle,'''def solve(d):
    s=d[0];n=len(s);dp=[0]*(n+1)
    for end in range(1,n+1):
        color=None;best=0
        for start in range(end-1,-1,-1):
            c=s[start]
            if c!='.':
                if color is not None and c!=color:break
                color=c
            length=end-start;best=max(best,dp[start]+length*(length+1)//2)
        dp[end]=best
    return str(dp[n])
''',[('忽略固定颜色冲突','if color is not None and c!=color:break','if False:break'),('漏算单字符子串','length*(length+1)//2','length*(length-1)//2')],timeLimit=8)
def servers_oracle(a):
    out=[]
    for n,m,s,u in a:out.append(max(up for sold in range(n+1) for up in range(n-sold+1) if up*u<=m+sold*s))
    return vec(out)
add(33,'出售部分服务器后的最大升级数','各网络独立，初有n台服务器和资金money；出售一台得sell，升级一台花upgrade。被出售服务器不能再升级，求每个网络最多可升级台数。','首行网络数q，随后q行num_servers money sell upgrade。1≤q≤100000，所有四项数值1..10000。','保留并升级x台时，最多卖n−x台。因此x≤n且x(upgrade+sell)≤money+n×sell，直接向下取整。','升级x台所需资金不超过卖掉所有未升级机器后的最大资金是必要条件；若满足，先卖未升级机器再升级即可实现，所以不等式也是充分条件。取允许的最大整数得到最优。','时间O(q)，空间O(q)用于输出。',[[(4,8,4,4),(3,9,2,5)],[(1,1,1,10000)],[(10,10000,1,1)]],lambda r:[(r.randint(1,10),r.randint(1,20),r.randint(1,10),r.randint(1,10)) for _ in range(r.randint(1,7))],[([(10000,10000,10000,10000)]*100000,vec([5000]*100000)),([(10000,10000,1,1)]*100000,vec([10000]*100000)),([(1,1,10000,10000)]*100000,vec([0]*100000)),([(10000,1,1,10000)],vec([1]))],lambda a:str(len(a))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in a),servers_oracle,'''def solve(d):
    q=int(d[0]);out=[]
    for i in range(q):
        n,m,s,u=map(int,d[1+4*i:5+4*i]);out.append(min(n,(m+n*s)//(u+s)))
    return str(q)+'\\n'+' '.join(map(str,out))
''',[('卖掉的机器还能升级','//(u+s)','//u'),('忘记数量上限','min(n,(m+n*s)//(u+s))','(m+n*s)//(u+s)')],output='先输出网络数，再输出各网络最多升级数量。')
def removal_encode(v):s,t,p=v;return s+'\n'+t+'\n'+' '.join(map(str,p))+'\n'
def removal_oracle(v):
    s,t,p=v;best=0
    for count in range(len(s)+1):
        removed=set(p[:count]);remain=''.join(c for i,c in enumerate(s,1) if i not in removed)
        if any(''.join(remain[i] for i in choose)==t for choose in combinations(range(len(remain)),len(t))):best=count
    return str(best)
def removal_random(r):
    s=''.join(r.choice('abc') for _ in range(r.randint(1,12)));indices=sorted(r.sample(range(len(s)),r.randint(1,len(s))));return s,''.join(s[i] for i in indices),r.sample(range(1,len(s)+1),len(s))
add(34,'按指定顺序删除并保留子序列','按照1基原下标排列order逐个删除source字符，原下标不会因删除而重排。target初始保证是source子序列，求最多连续执行前多少次删除后仍是子序列。','首两行source和target（无空白字符的词），最后一行为source长个1基排列下标。1≤|source|≤100000，1≤|target|≤|source|。不擅自限制字母大小写，比较区分大小写。','为每个位置记录被删时刻，二分删除数。检查时忽略删除时刻≤候选值的位置，用贪心匹配目标子序列。','贪心总取最早可用匹配位置，为后续字符保留最多位置，故准确判定子序列。额外删除不能产生新子序列，所以可行删除数构成前缀，二分得到最后可行值。','时间O(n log n)，空间O(n)。',[('abbabaa','bb',[7,1,2,5,4,3,6]),('hkbdi','kd',[1,4,2,3,5]),('AaA','A',[1,3,2])],removal_random,[(('a'*100000,'a',list(range(1,100001))),'99999'),(('a'*100000,'a'*100000,list(range(1,100001))),'0'),(('a'*99999+'B','B',list(range(100000,0,-1))),'0'),(('ab'*50000,'b'*50000,list(range(1,100001,2))+list(range(2,100001,2))),'50000')],removal_encode,removal_oracle,'''def solve(d):
    s,t=d[:2];order=list(map(int,d[2:]));when=[0]*len(s)
    for step,pos in enumerate(order,1):when[pos-1]=step
    def works(count):
        j=0
        for i,c in enumerate(s):
            if when[i]>count and c==t[j]:
                j+=1
                if j==len(t):return True
        return False
    lo=0;hi=len(s)
    while lo<hi:
        mid=(lo+hi+1)//2
        if works(mid):lo=mid
        else:hi=mid-1
    return str(lo)
''',[('删除时刻边界错一','when[i]>count','when[i]>=count'),('忽略大小写','c==t[j]','c.lower()==t[j].lower()')])
def freq_oracle(v):
    s,lo,hi,u=v;counts=Counter(s[i:j] for i in range(len(s)) for j in range(i+lo,min(len(s),i+hi)+1) if len(set(s[i:j]))<=u);return str(max(counts.values(),default=0))
def freq_random(r):
    s=''.join(r.choice('ab A0') for _ in range(r.randint(1,12)));lo=r.randint(1,len(s));return s,lo,r.randint(lo,len(s)),r.randint(1,5)
add(35,'不同字符受限的最高子串频率','在长度[minLength,maxLength]且不同字符数≤maxUnique的连续子串中，求同一文本出现次数最大值；允许出现重叠。没有合格子串返回0。','本站JSON输入：[s,minLength,maxLength,maxUnique]，可包含转义空白或Unicode；长度按Unicode字符计。原文无数值界，本站1≤|s|≤100000，1≤minLength≤maxLength≤|s|，1≤maxUnique≤100000。','最优只需考虑最短长度L：任一长串的L前缀出现不少且字符种数不多。用滑窗标记合格L窗口，后缀自动机精确统计每个子串出现次数；筛代表长度L的状态。','合法长串的每次出现对应其前缀的一次出现，因此缩短到L不劣。后缀自动机每个状态代表相同结束位置集合、长度处于len(link)+1..len之间的子串；各状态若覆盖L，就代表唯一L长文本。按长度逆序累加后缀链接上的结束计数得到精确出现次数，再用代表位置的滑窗标记检查字符数，取最大即答案，不使用有碰撞哈希。','时间O(n log n)（状态按长度排序），空间O(n)。',[('aaaa',2,3,1),('aabcaab',2,4,2),('a b a b',3,5,3)],freq_random,[(('a'*100000,50000,100000,1),'50001'),(('ab'*50000,1,100000,1),'50000'),(('ab'*50000,50000,100000,1),'0'),(('a'*100000,100000,100000,1),'1')],lambda v:json.dumps(v,ensure_ascii=False)+'\n',freq_oracle,'''import json
def solve(raw):
    s,L,H,U=json.loads(raw);trans=[{}];link=[-1];length=[0];occ=[0];first=[-1];last=0
    for index,c in enumerate(s):
        cur=len(trans);trans.append({});length.append(length[last]+1);link.append(0);occ.append(1);first.append(index);p=last
        while p>=0 and c not in trans[p]:trans[p][c]=cur;p=link[p]
        if p>=0:
            q=trans[p][c]
            if length[p]+1==length[q]:link[cur]=q
            else:
                clone=len(trans);trans.append(trans[q].copy());length.append(length[p]+1);link.append(link[q]);occ.append(0);first.append(first[q])
                while p>=0 and trans[p].get(c)==q:trans[p][c]=clone;p=link[p]
                link[q]=link[cur]=clone
        last=cur
    order=sorted(range(1,len(trans)),key=lambda i:length[i],reverse=True)
    for v in order:occ[link[v]]+=occ[v]
    counts={};valid=[False]*len(s)
    for i,c in enumerate(s):
        counts[c]=counts.get(c,0)+1
        if i>=L:
            old=s[i-L];counts[old]-=1
            if counts[old]==0:del counts[old]
        if i>=L-1:valid[i]=len(counts)<=U
    return str(max((occ[v] for v in order if length[link[v]]<L<=length[v] and valid[first[v]]),default=0))
''',[('不同字符上界误为严格','len(counts)<=U','len(counts)<U'),('把最长长度当最短','s,L,H,U=json.loads(raw)','s,H,L,U=json.loads(raw)')],raw=True,timeLimit=8)
def passengers_encode(g):return str(len(g))+'\n'+'\n'.join(' '.join(map(str,row)) for row in g)+'\n'
def passengers_oracle(g):
    n=len(g);paths=[]
    def walk(i,j,path):
        if i>=n or j>=n or g[i][j]==-1:return
        path=path|{(i,j)}
        if i==j==n-1:paths.append(path);return
        walk(i+1,j,path);walk(i,j+1,path)
    walk(0,0,set())
    return str(max((sum(g[i][j] for i,j in a|b) for a in paths for b in paths),default=0))
add(36,'网格往返接客的最大人数','从左上到右下仅右/下走，返回仅左/上走。−1为墙，0为空地，1为一个乘客，经过后乘客被带走不重复计。若无合法去程返回0。求最大总人数。','首行n，随后n行矩阵。1≤n≤100，每格−1、0、1。起点终点也可为乘客或墙，墙时无合法行程。','把返程反向，成为两个人同时从左上走到右下。同步步数t确定列t−行，DP状态仅记录两人的行；同格只加一次乘客。','每条往返路线与一对向右/下的单程路径一一对应。每个格子行列和固定，若两路均经过它则必在同一同步步到达，故同格去重恰好实现只接一次。每步枚举两人各右/下四种前驱覆盖所有路径对。','时间O(n³)，空间O(n²)。',[[[0,1],[-1,0]],[[0,1,-1],[1,0,-1],[1,1,1]],[[1]]],lambda r:[[r.choice([-1,0,1,1]) for _ in range(n)] for _ in range(n)] if (n:=r.randint(1,4)) else None,[([[1]*100 for _ in range(100)],'396'),([[0]*100 for _ in range(100)],'0'),([[-1]*100 for _ in range(100)],'0'),([[1 if i==0 or j==99 else -1 for j in range(100)] for i in range(100)],'199')],passengers_encode,passengers_oracle,'''def solve(d):
    n=int(d[0]);flat=list(map(int,d[1:]));g=[flat[i*n:(i+1)*n] for i in range(n)];neg=-10**9
    if g[0][0]<0 or g[-1][-1]<0:return '0'
    dp=[[neg]*n for _ in range(n)];dp[0][0]=g[0][0]
    for step in range(1,2*n-1):
        nxt=[[neg]*n for _ in range(n)]
        for a in range(max(0,step-n+1),min(n-1,step)+1):
            if g[a][step-a]<0:continue
            for b in range(max(0,step-n+1),min(n-1,step)+1):
                if g[b][step-b]<0:continue
                value=dp[a][b]
                if a:value=max(value,dp[a-1][b])
                if b:value=max(value,dp[a][b-1])
                if a and b:value=max(value,dp[a-1][b-1])
                if value>=0:nxt[a][b]=value+g[a][step-a]+(g[b][step-b] if a!=b else 0)
        dp=nxt
    return str(max(0,dp[-1][-1]))
''',[('重复收取同格乘客','g[b][step-b] if a!=b else 0','g[b][step-b]'),('第一步乘客遗漏','dp[0][0]=g[0][0]','dp[0][0]=0')],timeLimit=8)
def wiki_encode(v):edges,start,end=v;return str(len(edges))+'\n'+''.join(f'{a} {b}\n' for a,b in edges)+f'{start} {end}\n'
def wiki_oracle(v):
    edges,start,end=v;nodes=set([start,end]+[v for e in edges for v in e]);dist={(a,b):(0 if a==b else 1000000) for a in nodes for b in nodes}
    for a,b in edges:dist[a,b]=min(dist[a,b],1)
    for k in nodes:
        for a in nodes:
            for b in nodes:dist[a,b]=min(dist[a,b],dist[a,k]+dist[k,b])
    return str(dist[start,end] if dist[start,end]<1000000 else -1)
def wiki_random(r):
    nodes=['A','b','0','页','Z'];return [(r.choice(nodes),r.choice(nodes)) for _ in range(r.randint(1,15))],r.choice(nodes),r.choice(nodes)
add(37,'网页链接模拟器中的最少点击','每条有向链接一次点击可从u跳到v；get_links(page)返回该页所有出边目标。求start到target最少点击，起终相同为0，不可达为−1。重复链接和自环允许。','首行m，接着m行u v，最后一行start target。1≤m≤200000，页面名为无空白字符串，本站传输协议补充单个名字不超过100个Unicode字符。名字区分大小写，不要求纯英文。','构建出边表模拟get_links，然后从start做BFS，第一次发现target时返回层数。','路径上每条边均对应一次点击，BFS逐距离层扩展，首次到达节点的距离最短。只遍历出边不会把单向链接变成反向链接，访问标记避免自环重复。','时间O(V+m)，空间O(V+m)，另含页面名存储。',[([('A','B'),('B','C'),('A','D'),('D','C'),('C','E')],'A','C'),([('A','B')],'B','A'),([('A','A')],'A','A')],wiki_random,[(([(str(i),str(i+1)) for i in range(200000)],'0','200000'),'200000'),(([('a','b')]*200000,'b','a'),'-1'),(([('a','a')]*200000,'a','a'),'0'),(([(str(i),str(i+1)) for i in range(200000)],'missing','0'),'-1')],wiki_encode,wiki_oracle,'''from collections import deque
def solve(d):
    m=int(d[0]);adj={}
    for i in range(m):a,b=d[1+2*i:3+2*i];adj.setdefault(a,[]).append(b)
    start,target=d[1+2*m:3+2*m];q=deque([(start,0)]);seen={start}
    def get_links(page):return adj.get(page,[])
    while q:
        u,dist=q.popleft()
        if u==target:return str(dist)
        for v in get_links(u):
            if v not in seen:seen.add(v);q.append((v,dist+1))
    return '-1'
''',[('错把有向边当无向','adj.setdefault(a,[]).append(b)','adj.setdefault(a,[]).append(b);adj.setdefault(b,[]).append(a)'),('起终相同也计一次','return str(dist)','return str(max(1,dist))')])
def interval_encode(v):a,k=v;return f'{len(a)} {k}\n'+''.join(f'{x} {y}\n' for x,y in a)
def interval_oracle(v):
    intervals,k=v;best=len(intervals)+1
    for l in range(1,max(b for a,b in intervals)+1):
        for r in range(l,l+k+1):
            a=intervals+[(l,r)];remaining=set(range(len(a)));count=0
            while remaining:
                q=[remaining.pop()];count+=1
                while q:
                    i=q.pop();neighbors=[j for j in remaining if max(a[i][0],a[j][0])<=min(a[i][1],a[j][1])]
                    for j in neighbors:remaining.remove(j);q.append(j)
            best=min(best,count)
    return str(best)
add(38,'增加一个区间后的最少连通块','给定闭区间，可额外添加恰好一个长度b−a≤k的闭区间。求合并后的最少连通块数；接触同一端点算连通，不把相差1的区间自动连接。','首行n k，随后n行a b。1≤n≤200000，1≤a≤b≤10⁹，1≤k≤10⁹。新增段允许长度0。','先排序合并已有相交区间，再双指针找能被一段连接的最多连续块：第r块起点减第l块终点≤k。连接w块后总块数减少w−1。','合并后的块严格分离。跨过首末两块的新增段至少要覆盖它们之间的空隙，最短长度为右块左端点减左块右端点；满足时取这两个端点便同时连接中间所有块。最优新增段的所有交块连续，故枚举所有窗口并取最大不会遗漏。','时间O(n log n)，空间O(n)。',[([(1,2),(2,4),(5,8),(10,11)],2),([(1,1),(2,2)],1),([(1,100)],1)],lambda r:([(min(a,b),max(a,b)) for a,b in [(r.randint(1,12),r.randint(1,12)) for _ in range(r.randint(1,7))]],r.randint(1,6)),[(([(i*3+1,i*3+1) for i in range(200000)],1),'200000'),(([(i*3+1,i*3+1) for i in range(200000)],10**9),'1'),(([(1,10**9)]*200000,1),'1'),(([(1,1),(10**9,10**9)],999999998),'2')],interval_encode,interval_oracle,'''def solve(d):
    n,k=map(int,d[:2]);nums=list(map(int,d[2:]));merged=[]
    for a,b in sorted(zip(nums[::2],nums[1::2])):
        if merged and a<=merged[-1][1]:merged[-1][1]=max(merged[-1][1],b)
        else:merged.append([a,b])
    left=0;best=1
    for right in range(len(merged)):
        while merged[right][0]-merged[left][1]>k:left+=1
        best=max(best,right-left+1)
    return str(len(merged)-best+1)
''',[('错误把相差1的区间自动合并','a<=merged[-1][1]','a<=merged[-1][1]+1'),('桥长等号错误排除','merged[right][0]-merged[left][1]>k','merged[right][0]-merged[left][1]>=k')])
add(39,'人与蛋糕的最小下标距离','数组0表示空位，1表示人，2表示蛋糕。求任意一个人与任意一个蛋糕的下标绝对差最小值；缺任何一类返回−1。不是对每个人分配不同蛋糕。','首行n，第二行数组。1≤n≤200000，元素仅0、1、2。','扫描时保存最近一个人和蛋糕下标，每次遇到非零元素与最近的另一类配对。','以当前元素为右端点的最短有效距离由左侧最近的另一类给出。每个有效对的较大下标会在扫描中成为当前元素，取这些局部最小值的最小值就是全局最小。','时间O(n)，空间O(1)。',[[0,1,0,2,0],[2,0,1],[0,0,2]],lambda r:[r.randrange(3) for _ in range(r.randint(1,18))],[([1]+[0]*199998+[2],'199999'),([0]*200000,'-1'),([1,2]*100000,'1'),([2]*200000,'-1')],array,lambda a:str(min((abs(i-j) for i,x in enumerate(a) for j,y in enumerate(a) if x==1 and y==2),default=-1)),'''def solve(d):
    last=[-1,-1,-1];best=len(d)
    for i,value in enumerate(map(int,d[1:])):
        if value:
            other=3-value
            if last[other]>=0:best=min(best,i-last[other])
            last[value]=i
    return str(best if best<len(d) else -1)
''',[('只考虑人先于蛋糕','if last[other]>=0:','if value==2 and last[other]>=0:'),('把空位距离当索引差','i-last[other]','i-last[other]-1')])
def parity_oracle(a):
    initial=tuple(v%2 for v in a);q=deque([(initial,0)]);seen={initial};goal=tuple(sorted(initial))
    while q:
        b,d=q.popleft()
        if b==goal:return str(d)
        for i in range(len(a)):
            for j in range(i):
                c=list(b);c[i],c[j]=c[j],c[i];c=tuple(c)
                if c not in seen:seen.add(c);q.append((c,d+1))
add(40,'任意交换使偶数在前的最少次数','一次可交换任意两个下标的元素，要求所有偶数位于所有奇数前。各自内部不要求排序，不限制为相邻交换。','首行n，第二行正整数。原文未给数值界，本站1≤n≤200000，1≤元素≤10⁹。','先统计偶数个数e，前e个位置中的奇数个数就是答案。','前e位中的每个奇数必须离开，一次交换至多纠正其中一个，所以它们个数为下界。后面恰有相同个数错位偶数，将两类逐一交换，每次纠正一对，达到下界。','时间O(n)，空间O(n)含输入。',[[6,3,4,5],[1,1,2,2],[2,4,6]],lambda r:[r.randint(1,20) for _ in range(r.randint(1,9))],[([1]*100000+[10**9]*100000,'100000'),([10**9]*200000,'0'),([999999999]*200000,'0'),([1,2]*100000,'50000')],array,parity_oracle,'''def solve(d):
    a=list(map(int,d[1:]));even=sum(v%2==0 for v in a);return str(sum(v%2 for v in a[:even]))
''',[('偶奇目标颠倒','even=sum(v%2==0 for v in a);return str(sum(v%2 for v in a[:even]))','even=sum(v%2==1 for v in a);return str(sum(v%2==0 for v in a[:even]))'),('把全部奇数都当错位','a[:even]','a')])
BLOCKED={24:'原范围20万角色及20万DAG边，但每角色权限列表和字符串长度均无上限，且要求显式输出全部祖先权限。20万点各有独立权限的链就需约200亿权限项；无法在当前输出/内存预算覆盖完整范围，不以缩小角色数或强加输出总量发布。',27:'方程在B*C两个分量相等时可能无解或无穷多解，原文无排除保证、无返回约定；两位小数的舍入边界也未定义。保留数学与协议缺失，不仅靠单例假设唯一解。',28:'原文要求相邻线程数恰差1，但未知节点最少线程数未说明可0还是至少1；这影响最小总和。唯一例子的节点数5、边列表、叙述4节点和4项输出互相不一致，不能凭题解补全定义。'}
def wide_page(i):return '😀'*12+''.join(chr(0x10000+((i>>shift)&31)) for shift in (15,10,5,0))
for spec in SPECS:
    if spec['id']=='oa-snowflake-37':
        spec['limits']=spec['limits'].replace('100个Unicode字符','16个Unicode字符（保留原20万条边，最坏UTF-8输入不超过26,000,500字节）')
        spec['edges'].append((([(wide_page(2*i),wide_page(2*i+1)) for i in range(200000)],wide_page(0),wide_page(399999)),'-1'))
RAW_NAMES={21:'snowflake-count-minimum-characters',22:'snowflake-count-prime-strings',23:'snowflake-count-ways-to-color-houses',24:'snowflake-effective-role-privileges',25:'snowflake-efficient-cost',26:'snowflake-efficient-deployments',27:'snowflake-find-a',28:'snowflake-find-maximum-number-live-threads',29:'snowflake-find-pod-count',30:'snowflake-find-the-maximum-length-of-a-good-subsequence-i',31:'snowflake-get-earliest-meet-time',32:'snowflake-get-max-beautiful-substrings',33:'snowflake-get-max-upgraded-servers',34:'snowflake-get-maximum-removals',35:'snowflake-max-freq-substr',36:'snowflake-maximum-passengers-collected',37:'snowflake-minimum-clicks-between-wiki-pages',38:'snowflake-minimum-division',39:'snowflake-minimum-index-distance-between-person-and-cake',40:'snowflake-moves'}
def execute(path,inputs):
    start=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=600)
    assert p.returncode==0,(path,p.stderr[-3000:]);return json.loads(p.stdout),time.monotonic()-start
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(sys.argv[1:])
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in sorted(SPECS,key=lambda s:int(s['id'].split('-')[-1])):
        ident=s['id'];number=int(ident.split('-')[-1])
        if selected and str(number) not in selected:continue
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(20262940+number)
        reader='sys.stdin.read()' if s.get('raw') else 'sys.stdin.read().split()';code=s['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=inp,expectedOutput=answer,hidden=i>=3,weight=1) for i,(inp,answer) in enumerate([(c['input'],c['expectedOutput']) for c in oracles[:3]]+[(s['encode'](v),a+'\n') for v,a in s['edges']]+[(c['input'],c['expectedOutput']) for c in oracles[3:27]])]
        assert len(cases)>=31;actual,elapsed=execute(path,[c['input'] for c in oracles+cases]);assert len(actual)==len(oracles+cases)
        for i,(c,a) in enumerate(zip(oracles+cases,actual)):assert a.split()==c['expectedOutput'].split(),(ident,i,a[:200],c['expectedOutput'][:200])
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name,old);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed);outputs,_=execute(p,[c['input'] for c in cases]);assert len(outputs)==len(cases)
            rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if a.split()!=c['expectedOutput'].split()];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        explanation='三个公开样例的答案依次为：'+'；'.join(c['expectedOutput'].strip() for c in oracles[:3])+'。样例由独立枚举、状态搜索或直接模拟复核。'
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Snowflake'],description=s['desc']+'\n\n输入输出协议和明确标注的补充约束由本站整理，不执行上游题解。',input=s['limits'],output=s.get('output','输出题意要求的一个整数。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',4),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker='tokens',languages=['python','go','java','cpp'])
        if number==31:problem['output']='输出最早时刻HH:MM，若不可能则输出−1。'
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True);assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        bound=26000500 if number==37 else 20000000
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=bound,maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; two normal-exit wrong programs rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20262940,problems=reports,skipped={f'oa-snowflake-{k}':v for k,v in BLOCKED.items()},note='Independent local authored-program checks only, real sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number in range(21,41):
        rel='fastprep/Snowflake/'+RAW_NAMES[number]+'.md';raw=(snapshot/rel).read_bytes();ident=f'oa-snowflake-{number}'
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=BLOCKED.get(number,next((s['desc'] for s in SPECS if s['id']==ident),'')),sourceCommit='e66f809f4c953bce129f68491726176615db6afc',rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
