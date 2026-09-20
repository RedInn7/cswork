"""Original Snowflake references; immutable upstream statements are read, never executed."""
from pathlib import Path
from itertools import product,combinations
from functools import lru_cache
from collections import Counter,deque
import math,json,random,hashlib,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='snowflake-first';MOD=1000000007;SPECS=[]
def add(i,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,**kw):
    SPECS.append(dict(id=f'oa-snowflake-{i}',title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,**kw))
def lines(x):return '\n'.join(map(str,x))+'\n'
def array(x):return str(len(x))+'\n'+' '.join(map(str,x))+'\n'
def vec(x):return str(len(x))+'\n'+' '.join(map(str,x))
def prime_oracle(s):
    def prime(v):return v>=2 and all(v%p for p in range(2,math.isqrt(v)+1))
    @lru_cache(None)
    def f(i):
        if i==len(s):return 1
        if s[i]=='0':return 0
        return sum(f(j) for j in range(i+1,min(len(s),i+6)+1) if prime(int(s[i:j])))%MOD
    return str(f(0))
add(1,'数字串的质数划分','把整条数字串按原顺序分成若干质数，每段没有前导零，质数在2..10⁶内；求方案数模10⁹+7。原快照恢复上界10⁶，非catalog误写的10⁸。','一行数字串，长1..100000，首位非0。','筛出百万内质数；dp[i]为前i个字符的合法划分数，从每个非零起点扩展至多6位。','任何合法最后一段长度至多6且是无前导零质数，移除它得到唯一前缀划分。转移枚举所有合法末段，互不重叠，因此由空前缀一种方案归纳成立。','时间O(10⁶ log log 10⁶+6n)，空间O(10⁶+n)。',['11375','2','101'],lambda r:str(r.randint(1,9))+''.join(r.choice('012357') for _ in range(r.randrange(10))),[('2'*100000,'1'),('1'+'0'*99999,'0'),('1'*100000,str(0)),('999983','1')],lambda s:s+'\n',prime_oracle,'''def solve(d):
    s=d[0];limit=min(999999,10**min(6,len(s))-1);p=bytearray(b'\\x01')*(limit+1);p[0:2]=b'\\x00\\x00'
    for v in range(2,math.isqrt(limit)+1):
        if p[v]:p[v*v:limit+1:v]=b'\\x00'*((limit-v*v)//v+1)
    dp=[0]*(len(s)+1);dp[0]=1
    for i,c in enumerate(s):
        if c=='0':continue
        value=0
        for j in range(i,min(len(s),i+6)):
            value=value*10+int(s[j])
            if p[value]:dp[j+1]=(dp[j+1]+dp[i])%1000000007
    return str(dp[-1])
import math
''',[('误允许前导零',"if c=='0':continue","if False:continue"),('只允许单字符质数','i+6','i+1')])
# A string of ones partitions only into prime 11, so its even-length answer is one.
SPECS[-1]['edges'][2]=('1'*100000,'1')
def rotate_oracle(x):
    s,t,k=x;states={s:1}
    for _ in range(k):
        out=Counter()
        for a,v in states.items():
            for j in range(1,len(a)):out[a[j:]+a[:j]]+=v
        states=out
    return str(states.get(t,0)%MOD)
add(3,'恰好k次真后缀轮转','每步选非空真后缀移到字符串最前，恰好k步变成目标；不同切点序列分别计数，即使字符串周期相同。答案模10⁹+7。','三行src、target、k。串长各2..1000，1≤k≤10⁶，字符a..z。','统计所有n个旋转位置中匹配目标的c个位置，用匹配/不匹配两状态矩阵快速幂。','匹配位置有c−1条到匹配、n−c条到不匹配的非零位移；不匹配位置有c条到匹配、n−c−1条到不匹配。每个切点对应唯一位移，故状态聚合保持路径数量，快速幂给出恰好k步。','时间O(n²+log k)，空间O(n)。',[('ababab','ababab',1),('aaaa','aaaa',2),('ab','ba',2)],lambda r:(lambda s: (s,''.join(r.choice('ab') for _ in s),r.randint(1,5)))(''.join(r.choice('ab') for _ in range(r.randint(2,6)))),[(('a'*1000,'a'*1000,10**6),str(pow(999,10**6,MOD))),(('ab','ab',10**6),'1'),(('ab','ba',999999),'1'),(('a'*1000,'b'*1000,10**6),'0')],lines,rotate_oracle,'''def solve(d):
    s,t=d[:2];k=int(d[2]);n=len(s)
    if n!=len(t):return '0'
    c=sum(s[j:]+s[:j]==t for j in range(n));a,b=int(s==t),int(s!=t);m=(c-1,c,n-c,n-c-1);P=1000000007
    while k:
        x,y,z,w=m
        if k&1:a,b=(x*a+y*b)%P,(z*a+w*b)%P
        m=((x*x+y*z)%P,(x*y+y*w)%P,(z*x+w*z)%P,(z*y+w*w)%P);k//=2
    return str(a)
''',[('允许空后缀','m=(c-1,c,n-c,n-c-1)','m=(c,c,n-c,n-c)'),('周期位置错误去重','c=sum(s[j:]+s[:j]==t for j in range(n))','c=int(any(s[j:]+s[:j]==t for j in range(n)))')])
def weight_oracle(x):
    a,d=x
    @lru_cache(None)
    def f(a,k):
        if not k:return sum(a)
        return min(f(tuple(sorted(a[:i]+((v+1)//2,)+a[i+1:])),k-1) for i,v in enumerate(a))
    return str(f(tuple(sorted(a)),d))
add(4,'减半后的最小巧克力总重','每天选择一块吃掉floor(w/2)，剩余ceil(w/2)，可以重复选同一块。求d天后最小总重量。','首行n d，第二行n个重量；n≤100000，1≤w≤10000，1≤d≤2000000。','按重量建桶，从最高非空桶取一块减半；所有重量为1后立即结束。','每块巧克力未来每次操作的收益是单调不增的floor(w/2)序列。各序列选取须满足前缀约束，当前最大可用收益总能属于最优选择，交换掉更小收益不会变差。最大重量给出最大当前收益，故贪心最优。','时间O(n+d+10000)，空间O(10000)。',[([30,20,25],4),([2],1),([2,3],1)],lambda r:([r.randint(1,15) for _ in range(r.randint(1,5))],r.randint(1,5)),[(([10000]*100000,2000000),'100000'),(([1]*100000,2000000),'100000'),(([10000]*100000,1),'999995000'),(([9999],1),'5000')],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',weight_oracle,'''def solve(d):
    n,days=map(int,d[:2]);a=list(map(int,d[2:]));b=[0]*10001;total=sum(a)
    for w in a:b[w]+=1
    top=max(a)
    for _ in range(days):
        while top>1 and not b[top]:top-=1
        if top==1:break
        b[top]-=1;v=(top+1)//2;b[v]+=1;total-=top-v
    return str(total)
''',[('剩余取下整','v=(top+1)//2','v=top//2'),('只操作一天','range(days)','range(1)')])
add(5,'包含五种元音的纯元音子串','统计所有只含aeiou且五种元音均出现至少一次的连续子串，输出精确整数。','一行a..z字符串，长1..100000。','记录五种元音最近位置和最近辅音位置；每个右端点的合法起点数为min(最近元音位置)−最近辅音位置，负数取0。','合法起点必须在最近辅音之后且不晚于每种元音最近位置；两条件正好给出闭区间，计数后各子串按右端点唯一归类。','时间O(n)，空间O(1)。',['aeiou','aaeiouu','aeiobuaeiou'],lambda r:''.join(r.choice('aeiouxb') for _ in range(r.randint(1,18))),[('aeiou'*20000,str(99996*99997//2)),('a'*100000,'0'),('aeiou'+'x'*99995,'1'),('aeiou'*10000+'b'+'aeiou'*9999,str(49996*49997//2+49991*49992//2))],lambda s:s+'\n',lambda s:str(sum(set(s[i:j])==set('aeiou') for i in range(len(s)) for j in range(i+1,len(s)+1))),'''def solve(d):
    last={c:-1 for c in 'aeiou'};bad=-1;answer=0
    for i,c in enumerate(d[0]):
        if c in last:last[c]=i
        else:bad=i
        answer+=max(0,min(last.values())-bad)
    return str(answer)
''',[('忽略辅音隔断','else:bad=i','else:pass'),('每个结尾只算一次','max(0,min(last.values())-bad)','int(min(last.values())>bad)')])
def color_oracle(n):return str(sum(all(a[i]!=a[i+1] for i in range(n-1)) and all(a[i]!=a[n-1-i] for i in range(n//2)) for a in product(range(3),repeat=n)))
add(7,'相邻和对称房屋异色','偶数n间房排成一排，从固定三种颜色中涂色，相邻以及距离两端相同的两间房必须不同色。原始快照明确为不同色，catalog相同色是错误。答案模10⁹+7。','一行偶数n，2..100000。','从两端向中间逐对涂色：首对6种，之后每对3种。','已涂左右色为不同的a,b，新对(c,d)要求c≠a、d≠b、c≠d。在三色中恰有3种有序选择，且对任意a,b都相同。最内层相邻限制就是对内异色，无额外条件，乘法原理得6×3^(n/2−1)。','时间O(log n)，空间O(1)。',[2,4,6],lambda r:2*r.randint(1,4),[(100000,str(6*pow(3,49999,MOD)%MOD)),(99998,str(6*pow(3,49998,MOD)%MOD)),(8,'162'),(10,'486')],lambda n:str(n)+'\n',color_oracle,'''def solve(d):
    n=int(d[0]);return str(6*pow(3,n//2-1,1000000007)%1000000007)
''',[('漏对称限制','6*pow(3,n//2-1,1000000007)','3*pow(2,n-1,1000000007)'),('首对只算3种','6*pow','3*pow')])
def words_oracle(v):
    n,k=v;answer=0
    for bits in product('cv',repeat=n):
        if max(map(len,''.join(bits).split('c')))<=k:answer+=5**bits.count('v')*21**bits.count('c')
    return str(answer%MOD)
add(8,'连续元音长度受限的字符串','长度n的小写英文串中连续元音最多k个，元音aeiou共5种，辅音21种。计数模10⁹+7。','一行n k，1≤n≤2500，0≤k≤n。','dp[j]表示当前结尾恰好j个连续元音；加辅音归零，加元音把j增加1但不得超过k。','任意非空串末字符恰分为辅音和元音两类，乘以21或5对应字符选择，状态转移精确维护尾段长度；超k的转移被舍弃，故只计全部合法串。','时间O(nk)，空间O(k)。',[(1,1),(4,1),(4,2)],lambda r:(lambda n:(n,r.randint(0,n)))(r.randint(1,9)),[((2500,2500),str(pow(26,2500,MOD))),((2500,0),str(pow(21,2500,MOD))),((2500,2499),str((pow(26,2500,MOD)-pow(5,2500,MOD))%MOD)),((1,0),'21')],lambda x:' '.join(map(str,x))+'\n',words_oracle,'''def solve(d):
    n,k=map(int,d);p=[1]+[0]*k
    for _ in range(n):p=[sum(p)*21%1000000007]+[p[j-1]*5%1000000007 for j in range(1,k+1)]
    return str(sum(p)%1000000007)
''',[('把辅音数当20','sum(p)*21','sum(p)*20'),('禁止达到k','p[j-1]*5','p[j-1]*5*int(j<k)')])
def schedules_oracle(v):
    work,day,s=v;spots=[i for i,c in enumerate(s) if c=='?'];out=[]
    for digits in product(range(day+1),repeat=len(spots)):
        a=list(s)
        for i,d in zip(spots,digits):a[i]=str(d)
        if sum(map(int,a))==work:out.append(''.join(a))
    return str(len(out))+'\n'+'\n'.join(out)
def schedule_random(r):
    day=r.randint(1,4);a=[r.randint(0,day) for _ in range(7)]
    if not sum(a):a[0]=1
    work=sum(a)
    for i in r.sample(range(7),r.randint(0,4)):a[i]='?'
    return work,day,''.join(map(str,a))
add(9,'补全一周排班的所有方案','用0..day_hours替换七位模式中的问号，使一周总工时恰为work_hours。固定数字不变，返回全部方案，字典序升序。保证至少一个合法方案。','首行work_hours day_hours，第二行7位模式。1≤work_hours≤56，1≤day_hours≤8；模式为0..8或?，固定工时不超每日上限。原约束漏写?，根据正文恢复。','从左到右按升序枚举数字，用剩余最小/最大工时剪枝，保留恰好达到总量的叶子。','每种补全对应唯一根到叶路径，固定位置只有一个分支，未知位置枚举全部合法数字。剪枝仅移除不可能达到总量的前缀，故不遗漏；升序深搜自然按字典序输出。','时间O(9⁷)，输出空间O(7R)，R最大273127，输出限额4MiB。',[(3,2,'?1?0000'),(1,1,'???????'),(56,8,'???????')],schedule_random,[((28,8,'???????'),None),((56,8,'???????'),'1\n8888888'),((1,8,'???????'),'7\n0000001\n0000010\n0000100\n0001000\n0010000\n0100000\n1000000'),((7,1,'???????'),'1\n1111111')],lambda x:f'{x[0]} {x[1]}\n{x[2]}\n',schedules_oracle,'''def solve(d):
    work,day=map(int,d[:2]);s=d[2];out=[];low=[0]*8;high=[0]*8
    for i in range(6,-1,-1):low[i]=low[i+1]+(0 if s[i]=='?' else int(s[i]));high[i]=high[i+1]+(day if s[i]=='?' else int(s[i]))
    def visit(i,remaining,prefix):
        if remaining<low[i] or remaining>high[i]:return
        if i==7:out.append(prefix);return
        choices=range(day+1) if s[i]=='?' else [int(s[i])]
        for value in choices:visit(i+1,remaining-value,prefix+str(value))
    visit(0,work,'');return str(len(out))+'\\n'+'\\n'.join(out)
''',[('每天错误禁止0','range(day+1)','range(1,day+1)'),('结果降序',"'\\n'.join(out)","'\\n'.join(reversed(out))")],output='先输出方案数R，然后每行一个7位方案；必须输出全部方案且按字典序升序。',outputLimit=4096)
def team_oracle(v):
    a,t,k=v;a=list(enumerate(a));total=0
    for _ in range(t):
        idx,score=min(a[:k]+a[-k:],key=lambda v:(-v[1],v[0]));total+=score;a.remove((idx,score))
    return str(total)
def team_random(r):
    a=[r.randint(1,15) for _ in range(r.randint(1,12))];return a,r.randint(1,len(a)),r.randint(1,len(a))
add(10,'从两端候选中组建团队','每轮从剩余列表前k和后k人的并集中选最高分者，同分选最小下标，删除后继续直到选够t人。求分数和。原标题的轮流两端不符正文，以正文为准。','首行n t k，第二行n个分数。原文无数值界，本站设1≤t,k≤n≤100000，1≤分数≤10⁹。','一个堆存两侧候选，以负分数和原下标排序，并记录来自哪一侧；弹出后从对应侧补入尚未曝光的元素。','未曝光区间始终连续，堆恰含可选的前后k个元素去重并集；同侧补入保持这个不变量，区间耗尽则堆包含全部剩余人。原下标顺序与删除后的相对顺序相同，堆顶恰是规则选中的人。','时间O(n log n)，空间O(n)。',[([5,1,9,2,4],2,1),([5,100,1,5],2,1),([1,2,3],3,2)],team_random,[(([10**9]*100000,100000,50000),str(10**14)),((list(range(1,100001)),100000,1),str(100000*100001//2)),(([1]*100000,1,100000),'1'),(([5,100,1,5],2,1),'105')],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+' '.join(map(str,x[0]))+'\n',team_oracle,'''import heapq
def solve(d):
    n,t,k=map(int,d[:3]);a=list(map(int,d[3:]));heap=[];left=0;right=n-1
    for _ in range(k):
        if left<=right:heapq.heappush(heap,(-a[left],left,0));left+=1
    for _ in range(k):
        if left<=right:heapq.heappush(heap,(-a[right],right,1));right-=1
    answer=0
    for _ in range(t):
        value,idx,side=heapq.heappop(heap);answer-=value
        if left<=right:
            if side==0:heapq.heappush(heap,(-a[left],left,0));left+=1
            else:heapq.heappush(heap,(-a[right],right,1));right-=1
    return str(answer)
''',[('只选一人','range(t)','range(1)'),('分数方向错误','-a[','a[')])
def subseq_oracle(v):
    a,k=v;best=0
    for mask in range(1<<len(a)):
        b=[x for i,x in enumerate(a) if mask>>i&1]
        if sum(x!=y for x,y in zip(b,b[1:]))<=k:best=max(best,len(b))
    return str(best)
add(12,'相邻变化最多k次的最长子序列','从技能数组中选择子序列，相邻元素值不同的次数最多k，求最大长度，不要求连续。','首行n k，第二行n个技能值。原文n≤2000，其余约束截断；本站明确1≤n≤2000，0≤k<n，1≤技能值≤10⁹。','维护每个值结尾且最多j次变化的长度dp[value][j]，以及各j的全局最优best[j]。j倒序更新，取同值续接和best[j−1]+1。','同值接续不增加变化；从任意至多j−1次变化的子序列续接最多增一次，因此第二项合法。最优非空子序列删除末尾后，末值相同归第一项，否则归第二项，转移完备。倒序保证当前元素不被重复使用。','时间O(nk)，空间O(nk)。',[([1,1,2,3,2,1],2),([1,2,1,2,1],0),([1],0)],lambda r:(lambda a:(a,r.randrange(len(a))))([r.randint(1,4) for _ in range(r.randint(1,11))]),[(([1]*2000,1999),'2000'),((list(range(2000)),1999),'2000'),(([1,2]*1000,0),'1000'),((list(range(2000)),0),'1')],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',subseq_oracle,'''def solve(d):
    n,k=map(int,d[:2]);table={};best=[0]*(k+1)
    for value in map(int,d[2:]):
        if value not in table:table[value]=[0]*(k+1)
        row=table[value]
        for j in range(k,-1,-1):
            row[j]=max(row[j]+1,best[j-1]+1 if j else 1);best[j]=max(best[j],row[j])
    return str(best[k])
''',[('正序更新复用元素','range(k,-1,-1)','range(k+1)'),('忽略变化预算','return str(best[k])','return str(best[0])')])
add(13,'保持总能量阈值的最大屏障','每个粒子最终能量max(energy−barrier,0)，求使总能量≥th的最大非负整数barrier。保证原总能量≥th。','首行n th，第二行n个能量。2≤n≤100000，1≤energy≤10⁹，1≤th≤10¹⁴。','二分最后一个满足总能量不少于阈值的屏障。','每项随屏障增大单调不增，所以合法屏障是前缀；0合法，最大初始能量不合法。二分每步按谓词保留包含最后合法位置的区间，收敛后即为答案。','时间O(n log maxEnergy)，空间O(n)。',[([4,8,7,2,1],9),([5,2,13,10],8),([3,9,7],6)],lambda r:(lambda a:(a,r.randint(1,sum(a))))([r.randint(1,20) for _ in range(r.randint(2,10))]),[(([10**9]*100000,10**14),'0'),(([10**9]*100000,1),'999999999'),(([1]*100000,100000),'0'),(([1,10**9],999999999),'1')],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',lambda x:str(max(b for b in range(max(x[0])+1) if sum(max(v-b,0) for v in x[0])>=x[1])),'''def solve(d):
    n,threshold=map(int,d[:2]);a=list(map(int,d[2:]));lo=0;hi=max(a)
    while lo<hi:
        mid=(lo+hi+1)//2
        if sum(max(v-mid,0) for v in a)>=threshold:lo=mid
        else:hi=mid-1
    return str(lo)
''',[('把等号排除','>=threshold','>threshold'),('遗漏零截断','max(v-mid,0)','v-mid')])
def grid_encode(g):return f'{len(g)} {len(g[0])}\n'+'\n'.join(g)+'\n'
def grid_oracle(g):
    n,m=len(g),len(g[0]);cells=[(i,j) for i in range(n) for j in range(m) if g[i][j]!='#'];states=[(i,j,d) for i,j in cells for d in range(5)];dist={s:99999 for s in states};start=next((i,j,4) for i,j in cells if g[i][j]=='S');end=next((i,j,4) for i,j in cells if g[i][j]=='E');dist[start]=0;edges=[]
    for i,j,d in states:
        for x,y in cells:
            if (i==x)==(j==y):continue
            direction=0 if x<i else 1 if x>i else 2 if y<j else 3
            if d!=4 and d!=direction:continue
            length=abs(x-i)+abs(y-j);edges.append(((i,j,d),(x,y,4 if length==1 else direction)))
    for _ in states:
        change=False
        for a,b in edges:
            if dist[b]>dist[a]+1:dist[b]=dist[a]+1;change=True
        if not change:break
    return str(dist[end] if dist[end]<99999 else -1)
def grid_random(r):
    n,m=r.randint(2,4),r.randint(2,4);a=[r.choice('***#') for _ in range(n*m)];s,e=r.sample(range(n*m),2);a[s]='S';a[e]='E';return [''.join(a[i*m:(i+1)*m]) for i in range(n)]
add(14,'长跳锁方向的网格最短路','网格空地*、墙#、起点S和终点E。每次向上下左右跳正整数距离，可跨墙但不能落墙。上次跳长>1则下一跳方向必须相同；跳长1后解除限制。必须最后一步长为1落在E才算到达。不能到达输出−1。','首行n m，随后n行网格；2≤n,m≤100，S与E各恰好一个。','以坐标和锁定方向（另有自由态）为状态BFS，枚举允许方向及所有合法落点；长跳锁方向，短跳变自由。','状态精确包含影响未来合法动作的全部历史。每条边对应一步合法跳跃，反之每个合法动作都被枚举。所有边权为1，BFS首次访问目标自由态给出最少步数。只接受自由态确保最后一步长度1。','时间O(nm(n+m))，空间O(nm)。',[['SE','**'],['S#E','***'],['S#',' #'.replace(' ','#')]],grid_random,[],grid_encode,grid_oracle,'''from collections import deque
def solve(d):
    n,m=map(int,d[:2]);g=d[2:];dirs=[(-1,0),(1,0),(0,-1),(0,1)];start=next((i,j) for i in range(n) for j in range(m) if g[i][j]=='S');q=deque([(start[0],start[1],4,0)]);seen={(start[0],start[1],4)}
    while q:
        x,y,lock,steps=q.popleft()
        if g[x][y]=='E' and lock==4:return str(steps)
        for direction,(dx,dy) in enumerate(dirs):
            if lock!=4 and direction!=lock:continue
            a,b=x+dx,y+dy;length=1
            while 0<=a<n and 0<=b<m:
                state=(a,b,4 if length==1 else direction)
                if g[a][b]!='#' and state not in seen:seen.add(state);q.append((*state,steps+1))
                a+=dx;b+=dy;length+=1
    return '-1'
''',[('长跳落E也算完成',"g[x][y]=='E' and lock==4","g[x][y]=='E'"),('错误禁止跨墙',"state=(a,b,4 if length==1 else direction)","if g[a][b]=='#':break\n                state=(a,b,4 if length==1 else direction)")])
SPECS[-1]['samples'][2]=['S#','#E']
SPECS[-1]['edges']=[(['S'+'*'*98+'E']+['*'*100]*99,'2'),(['S'+'#'*98+'E']+['#'*100]*99,'-1'),(['S'+'*'*99]+['*'*100]*98+['*'*99+'E'],'4'),(['S'+'#'*97+'*E']+['#'*100]*99,'2')]
def jobs_oracle(v):
    a,x,y=v
    @lru_cache(None)
    def f(a):
        if not any(a):return 0
        return 1+min(f(tuple(max(0,t-(x if i==j else y)) for j,t in enumerate(a))) for i,t in enumerate(a) if t)
    return str(f(tuple(a)))
add(15,'并行执行任务的最少操作','一次操作选一个未完成任务执行x秒，所有其他任务执行y秒，其中y<x；累计执行达到所需时间的任务退出。求全部完成最少操作次数。原始快照恢复y<x。','首行n x y，第二行n个执行时间；1≤n≤100000，1≤时间≤10⁹，1≤y<x≤10⁹。','二分操作数t；先给所有任务ty基础执行量，剩余需求按x−y向上取整求额外主任务次数，和不超过t即可。','任何t步安排都至多提供t次主任务额外执行量，故该条件必要。若需求次数和≤t，按这些次数选择仍未完成任务即可，已完成任务的多余预约可替换成其他未完成任务而不减少任何必要执行；全部完成后不必继续，故能在至多t步完成。可行性单调，二分得最小值。','时间O(n log maxTime)，空间O(n)。',[([3,4,1,7,6],4,2),([1],2,1),([10,10],3,1)],lambda r:([r.randint(1,12) for _ in range(r.randint(1,4))],r.randint(3,6),r.randint(1,2)),[(([10**9]*100000,2,1),'999990001'),(([10**9]*100000,10**9,1),'100000'),(([1]*100000,2,1),'1'),(([10**9],10**9,1),'1')],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+' '.join(map(str,x[0]))+'\n',jobs_oracle,'''def solve(d):
    n,x,y=map(int,d[:3]);a=list(map(int,d[3:]));extra=x-y;lo=0;hi=(max(a)+y-1)//y
    while lo<hi:
        t=(lo+hi)//2;need=sum(max(0,(v-t*y+extra-1)//extra) for v in a)
        if need<=t:hi=t
        else:lo=t+1
    return str(lo)
''',[('需求向下取整','v-t*y+extra-1','v-t*y'),('不扣基础执行','v-t*y+extra-1','v+extra-1')])
def form_oracle(v):
    words,target=v;answer=0
    for cols in combinations(range(len(words[0])),len(target)):
        for rows in product(range(len(words)),repeat=len(target)):
            if all(words[r][c]==t for r,c,t in zip(rows,cols,target)):answer+=1
    return str(answer%MOD)
def form_random(r):
    n,m=r.randint(1,3),r.randint(1,6);return [''.join(r.choice('ab') for _ in range(m)) for _ in range(n)],''.join(r.choice('ab') for _ in range(r.randint(1,m)))
add(16,'递增列索引构造目标串','从等长单词集合取字符组成target，所取列下标严格递增，可以重复选同一单词。按所选列和所选单词区分方案，重复单词的不同条目仍是不同选择。答案模10⁹+7。','首行单词数n，接着n行单词，最后一行target。1≤n≤1000，单词长1..3000且总长≤100000；1≤target长度≤单词长度；字符a..z。','统计每列各字母频数，按列扫描并逆序更新target前缀方案数。','每个方案对当前列要么不选，要么把它用于目标的下一个字符。后者由旧前缀方案乘当前列目标字母频数产生。倒序避免同列重复选，全部递增列方案恰被生成一次。','时间O(总词长+列数×目标长)，空间O(26×列数+目标长)。',[(['valya','lyglb','vldoh'],'val'),(['adc','aec','efg'],'ac'),(['aa','aa'],'aa')],form_random,[((['a'*3000]*33,'a'*3000),str(pow(33,3000,MOD))),((['a'*100]*1000,'a'*50),str(math.comb(100,50)*pow(1000,50,MOD)%MOD)),((['a'*3000],'b'*3000),'0'),((['a'*3000],'a'*1500),str(math.comb(3000,1500)%MOD))],lambda x:str(len(x[0]))+'\n'+'\n'.join(x[0])+'\n'+x[1]+'\n',form_oracle,'''def solve(d):
    n=int(d[0]);words=d[1:n+1];t=d[n+1];m=len(words[0]);freq=[[0]*26 for _ in range(m)]
    for word in words:
        for i,c in enumerate(word):freq[i][ord(c)-97]+=1
    dp=[1]+[0]*len(t)
    for i,row in enumerate(freq):
        for j in range(min(i+1,len(t)),0,-1):dp[j]=(dp[j]+dp[j-1]*row[ord(t[j-1])-97])%1000000007
    return str(dp[-1])
''',[('同列重复使用','range(min(i+1,len(t)),0,-1)','range(1,min(i+1,len(t))+1)'),('同列相同字母去重','row[ord(t[j-1])-97]','int(row[ord(t[j-1])-97]>0)')])
def cover_oracle(intervals):
    if any(a==b for a,b in intervals):return '-1'
    coords=range(min(a for a,b in intervals),max(b for a,b in intervals)+1)
    for k in range(len(coords)+1):
        for chosen in combinations(coords,k):
            if all(sum(a<=v<=b for v in chosen)>=2 for a,b in intervals):return str(k)
add(18,'每个区间至少包含两个整数的最小集合','给定闭整数区间，求最小整数集合，使每个区间至少包含集合内两个不同整数。原文允许单点区间却未定义无解输出；本站协议明确这种情况输出−1，未删减原合法输入范围。','首行n，随后n行first last。1≤n≤100000，0≤first≤last≤10⁹。','按右端点升序、同右端点左端点降序处理，维护已选集合最大的两个数；覆盖不足时尽量选择当前右端点附近。','按右端点排序后，已有点是否覆盖当前区间只需看最大的两个。必须补点时选最靠右的可用整数，不比任何其他补法更不利于未来更右的区间，可交换最优解中的补点为贪心点而不破坏已处理区间。归纳得到最小集合。单点无法含两个不同整数，返回−1。','时间O(n log n)，空间O(n)。',[[(0,2),(1,3),(2,3)],[(0,0)],[(1,3),(1,4),(2,5)]],lambda r:[tuple(sorted([r.randint(0,7),r.randint(0,7)])) for _ in range(r.randint(1,7))],[([(0,10**9)]*100000,'2'),([(2*i,2*i+1) for i in range(100000)],'200000'),([(i,i+1) for i in range(100000)],'100001'),([(10**9,10**9)],'-1')],lambda a:str(len(a))+'\n'+''.join(f'{x} {y}\n' for x,y in a),cover_oracle,'''def solve(d):
    values=list(map(int,d[1:]));intervals=list(zip(values[::2],values[1::2]));a=b=-1;answer=0
    if any(l==r for l,r in intervals):return '-1'
    for l,r in sorted(intervals,key=lambda x:(x[1],-x[0])):
        if l>b:a,b=r-1,r;answer+=2
        elif l>a:a,b=b,r;answer+=1
    return str(answer)
''',[('闭区间当开区间','if l>b:','if l>=b:'),('单点误报可行',"if any(l==r for l,r in intervals):return '-1'","if False:return '-1'")])
def reduction_oracle(a):
    @lru_cache(None)
    def f(i):
        if i==len(a):return ()
        best=();seen=set();mex=0
        for j in range(i,len(a)):
            seen.add(a[j])
            while mex in seen:mex+=1
            best=max(best,(mex,)+f(j+1))
        return best
    return vec(f(0))
add(19,'前缀MEX删除的字典序最大结果','反复选择非空前缀，把其MEX追加到结果后删除该前缀，直到数组为空。求字典序最大结果；一个数组是另一个数组的真前缀时，较长者更大。MEX是未出现的最小非负整数。','首行n，第二行n个值。1≤n≤100000，0≤arr[i]≤n。','预先统计后缀频数及MEX；每轮取剩余数组的MEX，并截出首次覆盖0..MEX−1的最短前缀。MEX为0时只删一个。频数归零时向下更新后缀MEX。','任何前缀MEX不可能超过整个剩余数组MEX，覆盖所有较小数字就能达到这个最优首项。达到它后更早结束保留更多元素，任何更长删除方案都能在保留数组首段中兼容，不会改善字典序；剩余最优解因此递归适用。MEX0时保留最多元素使零项最多。每个元素只消费一次，所需集合的总初始化长度不超过n。','时间O(n)，空间O(n)。',[[0,1,0,2],[1,1,1],[0,1,2,0,1,2]],lambda r:(lambda n:[r.randint(0,n) for _ in range(n)])(r.randint(1,10)),[(list(range(100000)),vec([100000])),([100000]*100000,vec([0]*100000)),([0,1]*50000,vec([2]*50000)),([0]*100000,vec([1]*100000))],array,reduction_oracle,'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:]));freq=[0]*(n+2)
    for v in a:freq[v]+=1
    mex=0
    while freq[mex]:mex+=1
    i=0;out=[]
    while i<n:
        target=mex;out.append(target);seen=set()
        while i<n:
            v=a[i];i+=1;freq[v]-=1
            if freq[v]==0:mex=min(mex,v)
            if v<target:seen.add(v)
            if len(seen)==target:break
    return str(len(out))+'\\n'+' '.join(map(str,out))
''',[('MEX错误从1开始','mex=0','mex=1'),('每轮只删一项','if len(seen)==target:break','if True:break')],output='先输出结果长度，再输出对应整数数组。')
def points_oracle(p):return str(min((x-a)**2+(y-b)**2 for i,(x,y) in enumerate(p) for a,b in p[:i]))
add(20,'十万点的精确最近平方距离','求不同点条目之间的最小平方欧氏距离；重合条目距离0。原题提到均匀随机生成，但正确性不能依赖随机性。保留10万点，不缩成2000。','首行n，随后n行x y。原范围2≤n≤1000或n=100000；0≤x,y≤10⁹−1。计算与比较使用精确64位整数，不能用浮点平方值。','按x排序分治；两半递归返回最小距离及y有序点列，合并后只扫描距分割线平方小于当前最优值的条带，按y差剪枝。','最近对要么同侧已被递归找到，要么跨分割线。跨线且能改进的点必在条带内；按y排序后y差已不小于当前距离则后续更不可能。条带中每侧点间距离已受子问题最优值约束，装箱论证保证每点仅常数个候选，扫描完备且线性。','时间O(n log n)，空间O(n)。',[[(0,0),(1,1),(2,4)],[(7,7),(7,7)],[(0,0),(999999999,999999999)]],lambda r:[(r.randint(0,50),r.randint(0,50)) for _ in range(r.randint(2,15))],[([(i*9999,0) for i in range(100000)],str(9999**2)),([(123,456)]*100000,'0'),([(i%1000*1000000,i//1000*1000000) for i in range(100000)],str(10**12)),([(0,0),(999999999,999999999)],str(2*999999999**2))],lambda p:str(len(p))+'\n'+''.join(f'{x} {y}\n' for x,y in p),points_oracle,'''def solve(d):
    nums=list(map(int,d[1:]));points=sorted(zip(nums[::2],nums[1::2]))
    if any(points[i]==points[i-1] for i in range(1,len(points))):return '0'
    def visit(p):
        if len(p)<=3:
            best=min(((x-a)**2+(y-b)**2 for i,(x,y) in enumerate(p) for a,b in p[:i]),default=10**30)
            return best,sorted(p,key=lambda t:t[1])
        mid=len(p)//2;cut=p[mid][0];dl,left=visit(p[:mid]);dr,right=visit(p[mid:]);best=min(dl,dr);out=[];i=j=0
        while i<len(left) and j<len(right):
            if left[i][1]<=right[j][1]:out.append(left[i]);i+=1
            else:out.append(right[j]);j+=1
        out.extend(left[i:]);out.extend(right[j:]);strip=[p for p in out if (p[0]-cut)**2<best]
        for i,(x,y) in enumerate(strip):
            j=i+1
            while j<len(strip) and (strip[j][1]-y)**2<best:
                a,b=strip[j];best=min(best,(x-a)**2+(y-b)**2);j+=1
        return best,out
    return str(visit(points)[0])
''',[('误用曼哈顿距离','(x-a)**2+(y-b)**2','abs(x-a)+abs(y-b)'),('重复点错误距离1',"return '0'","return '1'")],timeLimit=5)
BLOCKED={2:'候选文本子串与给定prefix/suffix如何评分不充分，不能据样例猜定义。',6:'原始n≤100000不能降至2000；现有来源O(n²)背包无法覆盖完整约束，等待精确可扩展算法。',11:'通话结束时刻与下一通开始相等是否冲突未明确，影响最优值。',17:'原文两条件比较相同绝对差，却同时要求≤min和>max，互相矛盾，不能当恒0题发布。'}
for spec in SPECS:
    if spec['id']=='oa-snowflake-12':
        spec['edges'][1]=((list(range(1,2001)),1999),'2000')
        spec['edges'][3]=((list(range(1,2001)),0),'1')
RAW_NAMES={1:'snowflake-count-prime-strings',3:'snowflake-get-num-ways',4:'snowflake-find-min-weight',5:'snowflake-vowel-substring',7:'snowflake-count-ways-to-color-houses',8:'calculate-ways',9:'snowflake-find-schedules',12:'find-max-length',13:'get-max-barrier',14:'get-min-jumps-snowflake',15:'get-minimum-operations',16:'num-ways',18:'smallest-set-covering-intervals',19:'snowflake-array-reduction-algorithm',20:'snowflake-closest-squared-distance'}
def execute(path,inputs):
    started=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=600)
    assert p.returncode==0,(path,p.stderr[-3000:]);return json.loads(p.stdout),time.monotonic()-started
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[]
    selected=set(sys.argv[1:])
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for index,s in enumerate(SPECS):
        ident=s['id'];number=int(ident.split('-')[-1])
        if selected and str(number) not in selected:continue
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident]
        rng=random.Random(20262900+number);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        edge_pairs=[(s['encode'](v),(s['oracle'](v) if a is None else a)+'\n') for v,a in s['edges']]
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=inp,expectedOutput=answer,hidden=i>=3,weight=1) for i,(inp,answer) in enumerate([(c['input'],c['expectedOutput']) for c in oracles[:3]]+edge_pairs+[(c['input'],c['expectedOutput']) for c in oracles[3:27]])]
        assert len(cases)>=31
        actual,elapsed=execute(path,[c['input'] for c in oracles+cases]);assert len(actual)==len(oracles+cases)
        for i,(c,a) in enumerate(zip(oracles+cases,actual)):assert a.split()==c['expectedOutput'].split(),(ident,i,a[:200],c['expectedOutput'][:200])
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name,old);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed);outputs,_=execute(p,[c['input'] for c in cases]);assert len(outputs)==len(cases)
            rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if a.split()!=c['expectedOutput'].split()];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        explanation='三个公开样例的答案依次为：'+'；'.join(c['expectedOutput'].strip() for c in oracles[:3])+'。所有样例已用独立小规模枚举或状态搜索验证。'
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Snowflake'],description=s['desc']+'\n\n输入输出协议由本站独立整理；不执行上游题解。',input=s['limits'],output=s.get('output','输出题意要求的一个整数。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',4),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker='tokens',languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True);assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=3000000,maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; normal-exit mutants rejected; reference batch seconds',round(elapsed,3),flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20262900,problems=reports,skipped={f'oa-snowflake-{k}':v for k,v in BLOCKED.items()},note='Local independent oracle verification, not production sandbox evidence.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number in range(1,21):
        rel='fastprep/Snowflake/'+RAW_NAMES[number]+'.md' if number in RAW_NAMES else 'web/content/docs/companies/snowflake.mdx';raw=(snapshot/rel).read_bytes();blob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest();ident=f'oa-snowflake-{number}'
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=BLOCKED.get(number,next((s['desc'] for s in SPECS if s['id']==ident),'')),sourceCommit='e66f809f4c953bce129f68491726176615db6afc',rawPath=rel,rawGitBlob=blob,rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
