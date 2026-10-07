"""Amazon 76–100: independently authored programs, no imported solution execution."""
from collections import Counter, deque
from functools import lru_cache
from itertools import combinations, permutations, product
from pathlib import Path
import hashlib, heapq, json, math, random, runpy, subprocess, sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='amazon-remaining-d';SEED=20261021
SPECS=[]
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,explain,random_case,edges,encode,oracle,code,mutants,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,random=random_case,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,**extra))

def usage_oracle(x):
    intervals,target=x;usage=0
    for t in range(1,max(b for a,b in intervals)+1):
        usage+=sum(a<=t<=b for a,b in intervals)
        if usage>=target:return t
    return -1
add(76,'累计使用量达到阈值的最早整数秒','用户在start到end每个整数秒均贡献1使用量。求累计使用量首次达到max_usage的整数秒。CSWork标准I/O约定：始终达不到阈值输出−1。','第一行n max_usage（1≤n≤100000，1≤max_usage≤10¹⁴），随后n行start end（1≤start≤end≤10⁹）。',
    '在start记录+1、end+1记录−1事件，按时间排序。相邻事件之间活跃数固定，按段累计；阈值落在段内时用向上取整求最少秒数。','事件变更准确描述每秒是否仍在闭区间内。固定活跃数c的L秒贡献cL；若目标落在该段，需要ceil(剩余额度/c)秒，得到最早达到时刻。所有段不足时只能返回−1。','时间O(n log n)，空间O(n)。',[([(1,3),(2,2)],3),([(5,5)],1),([(1,1)],2)],
    '样例1：第1秒累计1，第2秒两人各贡献1，累计3，输出2。样例2：同秒开始结束仍贡献1，首次达到在5秒。样例3：总使用量仅1，永远不到2，按本站约定输出−1。',
    lambda r:([(a:=r.randint(1,8),r.randint(a,10)) for _ in range(r.randint(1,6))],r.randint(1,40)),
    [(([(1,10**9)]*100000,10**14),10**9),(([(10**9,10**9)]*100000,100001),-1),(([(1,1),(3,3)],2),3)],
    lambda x:f'{len(x[0])} {x[1]}\n'+''.join(f'{a} {b}\n' for a,b in x[0]),usage_oracle,
    '''def solve(d):
    n,target=map(int,d[:2]);events={}
    for i in range(2,len(d),2):
        a,b=int(d[i]),int(d[i+1]);events[a]=events.get(a,0)+1;events[b+1]=events.get(b+1,0)-1
    active=total=0;previous=0
    for t,delta in sorted(events.items()):
        contribution=active*(t-previous)
        if active and total+contribution>=target:return str(previous+(target-total+active-1)//active-1)
        total+=contribution;active+=delta;previous=t
    return '-1'
''',[('区间终点错误排除','events[b+1]=events.get(b+1,0)-1','events[b]=events.get(b,0)-1'),('达到秒数多算一秒','//active-1','//active')])

def outage_oracle(x):
    s,f=x;steps=0
    while True:
        removed={i-1 for i,c in enumerate(s) if i and c==f}
        if not removed:return steps
        s=''.join(c for i,c in enumerate(s) if i not in removed);steps+=1
add(77,'故障服务删除左邻的稳定时间','每秒依据该秒开始的字符串，所有failedService同时删除自己紧邻左边的字符，被删字符可以也是故障服务。求不再变化前经过的秒数。',
    '第一行pipeline，第二行一个failedService字符。长度1..200000；本站使用小写字母。',
    '记录故障字符位置：第一次故障前面的长度，以及相邻故障位置距离，取最大；末次故障后的后缀不会被删。',
    '最右故障永远保留，向左逐秒推进；每个更左故障在被其右边故障删除前独立处理两者间隔。长度为g的非首间隔包括左故障自身，需g秒清空；首故障前长度p需p秒。各间隔并行，故时间为最大值。',
    '时间O(n)，额外空间O(1)。',[('database','a'),('aaaa','a'),('bbb','a')],
    '样例1：三个a在下标1、3、5，首段长1、两个间隔长2，答案2。样例2：第一秒前三个a同时被右邻删除，仅剩一个，答案1。样例3：没有a，不发生删除，答案0。',
    lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,12))),r.choice('abc')),
    [(('b'*199999+'a','a'),199999),(('a'*200000,'a'),1)],lambda x:'\n'.join(x)+'\n',outage_oracle,
    '''def solve(d):
    s,f=d;previous=0;answer=0
    for i,c in enumerate(s):
        if c==f:answer=max(answer,i-previous);previous=i
    return str(answer)
''',[('故障字符不参与间隔删除','i-previous','max(0,i-previous-1)'),('只看故障次数','return str(answer)','return str(s.count(f))')])

def groups_oracle(a):
    frequencies=list(Counter(a).values());best=len(a)
    def partitions(total,minimum=1):
        if not total:yield ()
        for v in range(minimum,total+1):
            for rest in partitions(total-v,v):yield (v,)+rest
    for blocks in product(*(list(partitions(f)) for f in frequencies)):
        sizes=sum(blocks,())
        if max(sizes)-min(sizes)<=1:best=min(best,len(sizes))
    return best
add(78,'同等级且组大小接近的最少分组','每组只能有同一security等级的服务器，所有组的大小最大与最小相差至多1，最少分几组。','第一行n（1..100000），第二行n个等级（1..1000000）。',
    '枚举较小组大小b，从最小等级频次递减。对频次f，用ceil(f/(b+1))组；仅当这些组各至少b项可行。第一个全可行b给出最少总组数。',
    '固定b时组数至少ceil(f/(b+1))。若f≥该组数×b，把剩余项每组补1就能组成b或b+1大小；若不足，增加组数只会提高最低需求。b越大各频次所需最少组数不增加，故递减时第一个可行值最优。',
    '时间O(n)：不同等级数×最小频次≤n；空间O(n)。',[[1,1,1,2,2],[1,2,3],[7]*5],
    '样例1：大小3和2的两组即可，答案2。样例2：不同等级只能各一组，答案3。样例3：全部同级可放一组，答案1。',
    lambda r:[r.randint(1,4) for _ in range(r.randint(1,9))], [([1]*100000,1),(list(range(1,100001)),100000),([1]*5+[2]*7,5)],arr,groups_oracle,
    '''def solve(d):
    from collections import Counter
    frequencies=list(Counter(map(int,d[1:])).values())
    for b in range(min(frequencies),0,-1):
        answer=0
        for f in frequencies:
            count=(f+b)//(b+1)
            if count*b>f:break
            answer+=count
        else:return str(answer)
''',[('强迫全部组等大','count=(f+b)//(b+1)','count=(f+b-1)//b'),('忽略每组最小大小','if count*b>f:break','if False:break')])

def pairs_oracle(a):
    @lru_cache(None)
    def visit(state):
        if not state:return 0
        return max(max(state[0],state[i])+visit(state[1:i]+state[i+1:]) for i in range(1,len(state)))
    return visit(tuple(a))
add(81,'主机不小于备机的最大内存','偶数台服务器一一组成主备对，要求每对备机内存≤主机内存。最大化所有主机内存和；注意本题不等号方向以正文为准。','第一行偶数n（2..200000），第二行n个memory（1..10⁹）。',
    '排序后选最大的n/2台为主机，其余为备机。','任何选择都只有n/2台主机，其和不超过最大的一半。较小一半中的每个值都≤较大一半中的每个值，因此任意一一匹配均满足备机≤主机，达到上界。','时间O(n log n)，空间O(n)。',[[1,2,3,4],[8,8],[2,2,9,10]],
    '样例1：3、4作为主机，与1、2配对，总和7。样例2：相等允许，主机内存8。样例3：9、10作为主机，两个2作为备机，总和19。',
    lambda r:[r.randint(1,12) for _ in range(2*r.randint(1,4))],[([10**9]*200000,10**14),(list(range(1,200001)),15000050000)],arr,pairs_oracle,
    '''def solve(d):
    a=sorted(map(int,d[1:]));return str(sum(a[len(a)//2:]))
''',[('把较小一半当主机','a[len(a)//2:]','a[:len(a)//2]'),('误按相邻配对','a[len(a)//2:]','a[1::2]')])

def rating_oracle(x):
    a,k,m=x;best=0
    def choices(i,left,values):
        nonlocal best
        if i==len(a):
            for group in combinations(values,m):
                value=group[0]
                for v in group[1:]:value&=v
                best=max(best,value)
            return
        for inc in range(left+1):choices(i+1,left-inc,values+[a[i]+inc])
    choices(0,k,[]);return best
add(85,'有限自增次数下最大的子集按位与','最多k次操作，每次把任意一个rating加1。修改后选恰好m项，最大化它们的按位与。','第一行n k m（1≤m≤n≤100000，1≤k≤10⁹）；第二行n个rating（1..10⁹）。',
    '从高位到低位尝试答案掩码。计算每个数至少加多少能包含掩码所有1位，取最小m个成本之和≤k即可保留该位。',
    '若x缺少的最高要求位是b，最小可行y保留b以上前缀，将b置1，再只保留低位掩码要求，低位其余清零。更小y必不满足该位或更高前缀。各项成本独立，选m个最小成本判断是否可行；从高位贪心保证按整数大小字典序最优。',
    '时间O(31n log n)，空间O(n)；额外处理不超过31位。',[([1,2],2,2),([5],3,1),([1,1,1],2,3)],
    '样例1：把1加到2后选两项，与为2；两项均到3需3次，预算不足。样例2：唯一值从5加到8，答案8。样例3：三项全到2需3次，预算仅2，因此最大与仍1。',
    lambda r:(lambda n:([r.randint(1,9) for _ in range(n)],r.randint(1,4),r.randint(1,n)))(r.randint(1,4)),
    [(([10**9]*100000,10**9,100000),1000010000),((random.Random(850085).sample(range(1,100001),100000),10**9,1),1000100000)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+' '.join(map(str,x[0]))+'\n',rating_oracle,
    '''def solve(d):
    n,k,m=map(int,d[:3]);a=list(map(int,d[3:]));answer=0
    for b in range(30,-1,-1):
        mask=answer|(1<<b);costs=[]
        for x in a:
            missing=mask&~x
            if not missing:costs.append(0);continue
            bit=missing.bit_length()-1
            y=((x>>(bit+1))<<(bit+1))|(1<<bit)|(mask&((1<<bit)-1))
            costs.append(y-x)
        costs.sort()
        if sum(costs[:m])<=k:answer=mask
    return str(answer)
''',[('取最贵m项成本','costs[:m]','costs[-m:]'),('恰好预算错误拒绝','<=k:answer','<k:answer')],time=10)

def increase_oracle(a):
    initial=tuple(a);q=deque([(initial,0)]);seen={initial};cap=max(a)
    while q:
        state,cost=q.popleft()
        if all(x<=y for x,y in zip(state,state[1:])):return cost
        for i in range(len(a)):
            for j in range(i+1,len(a)+1):
                if max(state[i:j])>=cap:continue
                nxt=state[:i]+tuple(v+1 for v in state[i:j])+state[j:]
                if nxt not in seen:seen.add(nxt);q.append((nxt,cost+1))
add(86,'区间增加使服务器功率非递减','一次选任意连续区间，把每项增加x≥0，费用为x而非区间长度乘x。求让数组非递减的最小总费用。','第一行n（1..100000），第二行n个power（1..10⁹）。',
    '把每个相邻下降量max(0,power[i−1]−power[i])累加。','每个下降边界必须由区间从其右侧开始的增加量补齐，而一个区间至多在一个开始边界产生正改善，因此下降量之和是下界。在每个下降位置给整段后缀增加相应下降量，可以修好该边界且不改变后面的相邻差，恰好达到下界。','时间O(n)，空间O(n)（保存输入）。',[[3,4,1,6,2],[1,2,3],[5,1,1]],
    '样例1：4→1下降3、6→2下降4，费用7。样例2：已经非递减，费用0。样例3：给后两项同时加4，得到5、5、5，费用4。',
    lambda r:[r.randint(1,4) for _ in range(r.randint(1,4))],[([10**9,1]*50000,50000*(10**9-1)),(list(range(1,100001)),0)],arr,increase_oracle,
    '''def solve(d):
    a=list(map(int,d[1:]));return str(sum(max(0,a[i-1]-a[i]) for i in range(1,len(a))))
''',[('只补最大一次下降','sum(max(0,a[i-1]-a[i]) for i in range(1,len(a)))','max([0]+[max(0,a[i-1]-a[i]) for i in range(1,len(a))])'),('上涨也收费用','max(0,a[i-1]-a[i])','abs(a[i-1]-a[i])')])

def stale_oracle(x):
    n,logs,queries,w=x
    return ' '.join(str(n-len({skill for skill,t in logs if q-w<=t<=q})) for q in queries)
add(87,'闭区间请求窗口中的失活技能数','每条日志为skillId和timestamp。对每个查询q，统计在闭区间[q−timeWindow,q]内没有请求的技能数，答案按输入查询顺序输出。','第一行numSkills m q timeWindow，四者1..100000；接着m行skill timestamp，再一行q个queryTime。skill范围1..numSkills，所有时间1..100000。',
    '日志按时间排序，查询也排序并保留原下标。双指针加入时间≤q的日志，移除时间<q−window的日志，用每种技能的频次维护活跃数。','排序后查询窗口两端单调向右，每条日志恰加入、移出至多一次。频次正好对应当前闭区间中该技能的请求数，非零频次数量就是活跃技能数，技能总数减去它即答案。','时间O(m log m+q log q)，空间O(numSkills+m+q)。',[(3,[(1,1),(2,3)],[3,4],2),(2,[(1,5)],[5,1],1),(1,[(1,1),(1,2)],[2],1)],
    '样例1：q=3窗口[1,3]含技能1、2，失活1；q=4窗口[2,4]仅技能2，失活2。样例2：查询5有技能1，失活1；查询1无日志，失活2，保留原顺序。样例3：两条日志同属技能1，只计一个活跃技能，失活0。',
    lambda r:(lambda n:(n,[(r.randint(1,n),r.randint(1,10)) for _ in range(r.randint(1,8))],[r.randint(1,10) for _ in range(r.randint(1,8))],r.randint(1,10)))(r.randint(1,6)),
    [((100000,[(i,100000) for i in range(1,100001)],[100000]*100000,100000),' '.join(['0']*100000)),((100000,[(1,1)]*100000,[100000]*100000,1),' '.join(['100000']*100000))],
    lambda x:f'{x[0]} {len(x[1])} {len(x[2])} {x[3]}\n'+''.join(f'{a} {b}\n' for a,b in x[1])+' '.join(map(str,x[2]))+'\n',stale_oracle,
    '''def solve(d):
    n,m,q,w=map(int,d[:4]);logs=sorted((int(d[5+2*i]),int(d[4+2*i])) for i in range(m));queries=sorted((int(v),i) for i,v in enumerate(d[4+2*m:]));counts=[0]*(n+1);left=right=active=0;answer=[0]*q
    for t,index in queries:
        while right<m and logs[right][0]<=t:
            skill=logs[right][1];active+=counts[skill]==0;counts[skill]+=1;right+=1
        while left<right and logs[left][0]<t-w:
            skill=logs[left][1];counts[skill]-=1;active-=counts[skill]==0;left+=1
        answer[index]=n-active
    return ' '.join(map(str,answer))
''',[('排除左闭端点','logs[left][0]<t-w','logs[left][0]<=t-w'),('查询顺序错误反转','answer[index]=n-active','answer[len(answer)-1-index]=n-active')],output='一行q个失活数量，用空格分隔。')

def truck_oracle(x):
    a,capacity=x
    @lru_cache(None)
    def visit(mask,c):return max([0]+[1+visit(mask^(1<<i),c//2) for i,w in enumerate(a) if mask>>i&1 and w<=c])
    return visit((1<<len(a))-1,capacity)
add(88,'容量减半的单车最多配送数','单车初始容量T，每次任选重量≤当前容量的一个尚未配送包裹，配送后容量向下取整减半。最大化配送包裹数。','第一行n T（1≤n≤100000，1≤T≤10⁹），第二行n个重量（1..10⁹）。',
    '重量从大到小扫描，装得下就配送并减半，装不下的跳过。','当前能装的包裹中优先选择最大的，不会损失后续容量槽位：若最优方案选择更小包裹，交换到当前，保留较小包裹给后来不更大的容量，总配送数不会减少。过大包裹在以后容量下降后也永远装不下。','时间O(n log n)，空间O(n)。',[([8,4,2,1],8),([9,8,1],8),([2,2],1)],
    '样例1：依次8、4、2、1，配送4个。样例2：跳过9，配送8后再配送1，共2个。样例3：两包均重于容量1，配送0个。',
    lambda r:([r.randint(1,15) for _ in range(r.randint(1,7))],r.randint(1,25)),[(([1]*100000,10**9),30),(([10**9]*100000,10**9),1)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',truck_oracle,
    '''def solve(d):
    n,t=map(int,d[:2]);answer=0
    for w in sorted(map(int,d[2:]),reverse=True):
        if w<=t:answer+=1;t//=2
    return str(answer)
''',[('先送最小包裹','reverse=True','reverse=False'),('不减半容量','t//=2','t=t')])

def delivery_oracle(g):
    h=len(g);w=len(g[0]);distance={(0,0):0}
    for _ in range(h*w):
        changed=False
        for r in range(h):
            for c in range(w):
                if g[r][c]=='0':continue
                for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
                    p=(r+dr,c+dc)
                    if p in distance and distance[p]+1<distance.get((r,c),10**9):distance[r,c]=distance[p]+1;changed=True
        if not changed:break
    return next(distance.get((r,c),-1) for r in range(h) for c in range(w) if g[r][c]=='9')
def delivery_random(r):
    h=r.randint(1,4);w=r.randint(1,4);g=[[r.choice('01') for _ in range(w)] for _ in range(h)];g[0][0]='1';g[-1][-1]='9';return [''.join(x) for x in g]
add(89,'配送网格中的最短路径','网格1可通行、0障碍、9是唯一目的地。从左上角出发，四方向相邻移动，返回到9的最短步数；无路输出−1。','第一行r c（1..1000），随后r行长度c的019字符串；左上角可通行（可以就是9），恰有一个9。',
    '用一维距离数组和索引队列做BFS，只进入非0格，每格首次入队时标记。','所有移动代价都是1，BFS按距离递增访问，每格首次距离最短；处理到9即得到最短路线。队列耗尽则没有可达目的地。','时间O(rc)，空间O(rc)，使用紧凑整数数组保存队列和距离。',[['100','100','191'],['9'],['10','09']],
    '样例1：向下两步、向右一步抵达9，答案3。样例2：起点就是目的地，答案0。样例3：两条出路均为0，答案−1。',delivery_random,
    [(['1'*1000]*999+['1'*999+'9'],1998),(['1'+'0'*999]+['0'*1000]*998+['0'*999+'9'],-1)],lambda g:f'{len(g)} {len(g[0])}\n'+'\n'.join(g)+'\n',delivery_oracle,
    '''def solve(d):
    from array import array
    h,w=map(int,d[:2]);g=''.join(d[2:]);distance=array('i',[-1])*(h*w);distance[0]=0;q=array('i',[0]);head=0
    while head<len(q):
        cell=q[head];head+=1
        if g[cell]=='9':return str(distance[cell])
        r,c=divmod(cell,w)
        for nxt in (cell-w if r else -1,cell+w if r+1<h else -1,cell-1 if c else -1,cell+1 if c+1<w else -1):
            if nxt>=0 and g[nxt]!='0' and distance[nxt]<0:distance[nxt]=distance[cell]+1;q.append(nxt)
    return '-1'
''',[('路径长度多算起点','distance[0]=0','distance[0]=1'),('障碍也可走',"g[nxt]!='0'","True")],time=6)

def pascal_oracle(a):
    n=len(a)-2
    return ''.join(str(sum(math.comb(n,i)*a[i+offset] for i in range(n+1))%10) for offset in (0,1))
add(90,'相邻和模十的两位加密','不断把相邻两项之和模10生成新数组，直到只剩两项，输出两位字符串，不能丢掉前导0。','第一行n（2..5000），第二行n个0..9的数字。',
    '直接逐层计算相邻和，每层长度减少1，最终拼接两位。','一次变换严格按原层相邻项生成下一层，重复n−2次后长度恰为2，因此模拟与定义一致。独立对照使用二项式系数加权的闭式表达式。','时间O(n²)，空间O(n)。',[[4,5,6,7],[0,0],[9,9,9]],
    '样例1：4 5 6 7→9 1 3→0 4，输出04。样例2：已经两位，原样输出00。样例3：9 9 9→8 8，输出88。',
    lambda r:[r.randint(0,9) for _ in range(r.randint(2,12))],[([1]*5000,'44'),([0]*5000,'00')],arr,pascal_oracle,
    '''def solve(d):
    a=list(map(int,d[1:]))
    while len(a)>2:a=[(a[i]+a[i+1])%10 for i in range(len(a)-1)]
    return ''.join(map(str,a))
''',[('丢失前导零',"return ''.join(map(str,a))","return str(int(''.join(map(str,a))))"),('相邻相加错误为相乘','a[i]+a[i+1]','a[i]*a[i+1]')],output='输出恰好两个数字组成的字符串，保留前导0。',time=6)

def errors_oracle(x):
    s,a,b=x;positions=[i for i,c in enumerate(s) if c=='!'];best=10**30
    for bits in product('01',repeat=len(positions)):
        t=list(s)
        for i,c in zip(positions,bits):t[i]=c
        value=sum(a if t[i]+t[j]=='01' else b if t[i]+t[j]=='10' else 0 for i in range(len(t)) for j in range(i+1,len(t)))
        best=min(best,value)
    return best%1000000007
add(91,'未知二进制位的最小子序列错误数','将每个!替换成0或1，每个下标对i<j构成01产生x费用，10产生y费用。先求最小总费用，再对10⁹+7取模，不是比较取模后的大小。','第一行errorString（长度1..100000），第二行x y（0..10⁹）。',
    '若x>y，反转串并交换费用。此后x≤y，存在未知位先0后1的最优方案。开始全部未知取1，然后从左到右逐个改0，用左右0/1计数更新费用，取所有分界点最小值。',
    '当x≤y，若两个未知位为先1后0，将它们交换，外侧贡献不变，两位置及中间字符的总变化为(x−y)乘非负数量，因此不会更差。反复交换可得未知位单调方案。扫描枚举所有这种方案，按涉及当前位的全部左右配对计算费用变化，故得到全局最优。','时间O(n)，空间O(n)（反转及工作字符串）；费用使用大整数，最后取模。',[('!!!!!!!',23,47),('0!1',2,5),('10',2,5)],
    '样例1：全部取0，无异值对子，费用0。样例2：取001或011都会有两个01，费用4。样例3：唯一10子序列费用5。',
    lambda r:(''.join(r.choice('01!') for _ in range(r.randint(1,9))),r.randint(0,8),r.randint(0,8)),[(('!'*100000,10**9,10**9),0),(('0'*50000+'1'*50000,10**9,0),(50000**2*10**9)%1000000007)],lambda x:x[0]+'\n'+f'{x[1]} {x[2]}\n',errors_oracle,
    '''def solve(d):
    s=d[0];x,y=map(int,d[1:])
    if x>y:s=s[::-1];x,y=y,x
    t=s.replace('!','1');zero=one=cost=0
    for c in t:
        if c=='0':cost+=one*y;zero+=1
        else:cost+=zero*x;one+=1
    best=cost;left0=left1=0;right0=zero;right1=one
    for c in s:
        if c=='0':right0-=1;left0+=1
        elif c=='1':right1-=1;left1+=1
        else:
            right1-=1;cost+=left1*y+right1*x-left0*x-right0*y
            left0+=1;best=min(best,cost)
    return str(best%1000000007)
''',[('反转时忘记交换费用','s=s[::-1];x,y=y,x','s=s[::-1]'),('忽略10费用','cost+=one*y','cost+=0')])

def quiz_oracle(x):
    a,b,q=x;gaps=[max(0,y-z) for z,y in zip(a,b)]
    return max(mask.bit_count() for mask in range(1<<len(a)) if sum(v for i,v in enumerate(gaps) if mask>>i&1)<=q)
add(93,'额外答题预算内最多通过的科目','科目i已答answered[i]题，通过需至少needed[i]题。最多再答q题，可任意分配，求最多通过几科。','第一行n q（1≤n≤100000，0≤q≤10⁹），第二行answered，第三行needed，均0..10⁹。',
    '每科剩余费用为max(0,needed−answered)，升序选择直到预算不足。','每科收益都是通过一科，若选择高费用而遗漏低费用，交换后预算不增加且收益不减。因此从低到高选取达到最多数量，已经通过的费用为0。','时间O(n log n)，空间O(n)。',[([24,27,0],[51,52,100],100),([5,5],[1,9],0),([0,0],[2,3],5)],
    '样例1：补25和27题通过两科，剩余48不足第三科。样例2：第一科本已通过，预算0仍通过1科。样例3：补2和3正好用完预算，两科通过。',
    lambda r:(lambda n:([r.randint(0,8) for _ in range(n)],[r.randint(0,8) for _ in range(n)],r.randint(0,15)))(r.randint(1,8)),[(([0]*100000,[10**9]*100000,10**9),1),(([10**9]*100000,[0]*100000,0),100000)],lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',quiz_oracle,
    '''def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));gaps=sorted(max(0,v-w) for w,v in zip(a,b));answer=0
    for gap in gaps:
        if gap>q:break
        q-=gap;answer+=1
    return str(answer)
''',[('优先补最多题的科目','for gap in gaps:','for gap in reversed(gaps):'),('超过要求可赚预算','max(0,v-w)','v-w')])

def passwords_oracle(x):
    c,s=x;return sum(''.join(ch for i,ch in enumerate(c) if mask>>i&1)>s for mask in range(1<<len(c)))%1000000007
add(95,'字典序大于系统密码的子序列数量','统计customer的所有下标子序列中，字典序严格大于system的数量。相同字符串由不同下标选出时分别计数；system是前缀时更长者更大。结果模10⁹+7。','两行小写字符串customer与system，长度分别1..100000、1..100。',
    'dp[j]记录恰好等于system前j字符的子序列数，greater记录已经大于的数量。每个新字符让greater倍增；等前缀后接更大字符或完整system后接任意字符也变为greater；等前缀DP倒序更新。',
    '每个子序列唯一分为使用或不使用当前字符。已经更大则任意追加仍更大；首次不同必须由相等前缀接更大字符产生，完整system后继续追加也更大。倒序保证当前字符只用一次，分类互斥且覆盖所有符合子序列。','时间O(|customer|·|system|)，空间O(|system|)。',[('bab','ab'),('aa','a'),('a','z')],
    '样例1：下标不同的两个b，加ba、bb、bab，共5。样例2：只有aa比a大，两个单独a均相等，答案1。样例3：a比z小，没有合格子序列，答案0。',
    lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,11))),''.join(r.choice('abc') for _ in range(r.randint(1,4)))),[(('a'*100000,'z'*100),0),(('z'*100000,'a'*100),(pow(2,100000,1000000007)-1)%1000000007),(('a'*100000,'a'*100),(pow(2,100000,1000000007)-sum(math.comb(100000,k) for k in range(101)))%1000000007)],lambda x:'\n'.join(x)+'\n',passwords_oracle,
    '''def solve(d):
    c,s=d;m=len(s);mod=1000000007;dp=[1]+[0]*m;greater=0
    for ch in c:
        greater=(greater*2+dp[m])%mod
        for j in range(m-1,-1,-1):
            if ch>s[j]:greater=(greater+dp[j])%mod
            elif ch==s[j]:dp[j+1]=(dp[j+1]+dp[j])%mod
    return str(greater)
''',[('遗漏完整前缀后的扩展','greater*2+dp[m]','greater*2'),('同一字符重复匹配','range(m-1,-1,-1)','range(m)')],time=6)

def winners_oracle(a):
    n=len(a);return sum(all(all(a[j]+points<=a[i]+n for j,points in zip([j for j in range(n) if j!=i],ranks)) for ranks in permutations(range(1,n))) for i in range(n))
add(96,'无论其他排名如何都能保持最高积分的冠军','冠军得n分，其余名次分别得n−1到1分。统计哪些参与者夺冠后，无论其他人如何排名，其总分都至少与所有人持平。并列最高允许。','第一行n（1..100000），第二行n个初始积分（0..100000）。',
    '设最大初始分为M，统计初始分≥M−1的人。','对初始分a的冠军，最强对手至多拿M+n−1，因此a≥M−1足以保持最高。若a<M−1，让最大初始分者拿第二名就会超过冠军，故不合格。最大初始分者自然总是合格，包括唯一参与者。','时间O(n)，空间O(n)。',[[1,3,4],[5,7,9,11],[8,10,9]],
    '样例1：积分3夺冠得6，与积分4拿第二时的6持平，也算最高；积分4也合格，共2。样例2：只有11与最大分相差不超过1，答案1。样例3：10和9均合格，答案2。',
    lambda r:[r.randint(0,8) for _ in range(r.randint(1,6))],[([100000]*100000,100000),([0]*99999+[100000],1)],arr,winners_oracle,
    '''def solve(d):
    a=list(map(int,d[1:]));threshold=max(a)-1;return str(sum(v>=threshold for v in a))
''',[('不允许并列第一','v>=threshold','v>threshold'),('所有冠军都认为最高','sum(v>=threshold for v in a)','len(a)')])

def servers_oracle(x):
    n,a=x;free=[0]*n;answer=[];now=0
    for i,length in enumerate(a):
        now=max(now,i)
        options=[j for j in range(n) if free[j]<=now]
        if not options:now=min(free);options=[j for j in range(n) if free[j]<=now]
        j=min(options);answer.append(j);free[j]=now+length
    return ' '.join(map(str,answer))
add(97,'请求排队时分配最小空闲编号服务器','请求i在时间i到达，持续requests[i]秒。按到达顺序处理，选当前最小空闲编号；全忙时等最早释放时间，多个同时释放选最小编号。0秒请求立即释放。来源样例不符合最小空闲编号规则，本站据正文修正。','第一行servers n，第二行n个时长。原文未给数字约束，本站servers、n均1..100000，时长0..10⁹。',
    '空闲编号小根堆，加忙碌(结束时间,编号)小根堆。处理每个请求时推进到到达时间；无空闲则推进到最早结束时间，再释放所有到时服务器，取最小编号。','两堆分别精确表示当前空闲和忙碌状态。等待时刻由最早结束时间唯一确定，释放所有同时结束者后编号堆保证正确破同分；请求按输入顺序处理，已经排队的先处理。','时间O((servers+n)log servers)，空间O(servers+n)。',[(5,[3,1,0,2,1]),(1,[3,1,0]),(2,[2,1,1])],
    '样例1：时间2编号1已释放而0要到3，故五次分配0、1、1、0、1，原来源0、1、0、2、1不符正文。样例2：只有编号0，三个请求都给它，后两项需排队。样例3：时间2两台同时释放，选择较小编号0，结果0、1、0。',
    lambda r:(r.randint(1,5),[r.randint(0,8) for _ in range(r.randint(1,12))]),[((100000,[0]*100000),' '.join(['0']*100000)),((1,[10**9]*100000),' '.join(['0']*100000))],lambda x:f'{x[0]} {len(x[1])}\n'+' '.join(map(str,x[1]))+'\n',servers_oracle,
    '''def solve(d):
    import heapq
    n,m=map(int,d[:2]);idle=list(range(n));heapq.heapify(idle);busy=[];now=0;answer=[]
    for i,length in enumerate(map(int,d[2:])):
        now=max(now,i)
        if not idle:now=max(now,busy[0][0])
        while busy and busy[0][0]<=now:
            end,server=heapq.heappop(busy);heapq.heappush(idle,server)
        server=heapq.heappop(idle);answer.append(server);heapq.heappush(busy,(now+length,server))
    return ' '.join(map(str,answer))
''',[('占用时长多算一秒','now+length','now+length+1'),('轮流编号不考虑释放','return \' \'.join(map(str,answer))',"return ' '.join(str(i%n) for i in range(m))")],output='输出每次请求分配的服务器编号，以空格分隔。')

# Same fully specified scheduling rule as Amazon51; reuse only our independently authored specification.
prior=runpy.run_path(str(Path(__file__).with_name('amazon_remaining_c.py')))
old=next(s for s in prior['SPECS'] if s['number']==51)
add(99,old['title'],old['description']+' 本题与Amazon51规则相同；来源未提供数字范围，采用同等本站范围。',old['input'],old['idea'],old['proof'],old['complexity'],old['samples'],old['explanation'],old['random'],old['edges'],old['encode'],old['oracle'],old['code'],old['mutants'])

def volumes_oracle(a):
    stock=set();owned=set();lines=[]
    for v in a:
        stock.add(v);bought=[]
        for x in sorted(stock):
            if x not in owned and all(i in owned for i in range(1,x)):owned.add(x);bought.append(x)
        lines.append(' '.join(map(str,bought)) if bought else '-1')
    return '\n'.join(lines)
add(100,'每天按前置卷号购买新书','volumes是1..n的排列，第i天该卷到货。每天购买尽可能多的新卷，购买某卷前必须已拥有所有更小卷号，同日可依次购买多卷。逐日输出购买卷号；没有购买输出−1。','第一行n（1..100000），第二行1..n的排列volumes。',
    '布尔数组记录已到货，next维护最小未购买卷。每天标记新卷后，从next连续购买所有已到货卷。','已拥有的卷始终是1..next−1。next未到货时更大卷均缺前置条件，不能买；next到货则应买并继续，直到首个缺货卷。每卷指针经过一次。','时间O(n)，空间O(n)（含输出）。',[[2,1,4,3],[1,4,3,2,5],[1,2,3]],
    '样例1：依次输出−1；1 2；−1；3 4。样例2：第一天买1，第二三天等待，第4天买2 3 4，末天买5。样例3：到货顺序已经升序，每天购买当天的一卷。',
    lambda r:r.sample(list(range(1,(n:=r.randint(1,9))+1)),n),[(list(range(100000,0,-1)),'\n'.join(['-1']*99999+[' '.join(map(str,range(1,100001)))])),(list(range(1,100001)),'\n'.join(map(str,range(1,100001))))],arr,volumes_oracle,
    '''def solve(d):
    n=int(d[0]);stock=bytearray(n+1);next_volume=1;answer=[]
    for v in map(int,d[1:]):
        stock[v]=1;start=next_volume
        while next_volume<=n and stock[next_volume]:next_volume+=1
        answer.append(' '.join(map(str,range(start,next_volume))) if start<next_volume else '-1')
    return '\\n'.join(answer)
''',[('每天最多买一卷','while next_volume<=n and stock[next_volume]:','if next_volume<=n and stock[next_volume]:'),('不检查前置卷直接购买',"answer.append(' '.join(map(str,range(start,next_volume))) if start<next_volume else '-1')","answer.append(str(v))")],output='输出n行，每行按升序列出当天购买卷号，或单独−1。')

BLOCKED={79:'到达买不起的商品时，是停止还是跳过继续循环没有说明，两种行为可能得到不同购买数量。',80:'初始库存、max_products在什么时间限制库存、非检查日是否允许负库存等关键规则缺失，不能定义状态转移。',82:'n=10⁶且库存10⁶时十进制输入约8MB，超4MiB；客户数超过总库存时的返回约定也未给出。',83:'m=2×10⁶且cost为九位数时输入约20MB，超4MiB，不能收窄源约束。',84:'初始p1×q1内部哪些格已填、frontier定义及固定初始图案未明确，不能唯一确定所计数的最终填法。',92:'正文要求一件不能参与两对，但样例按允许跨对复用的所有索引对计数，两者矛盾；且该例全索引对实际14而不是11，需澄清计数对象。',94:'n=500000且数值10⁹的合法输入约5.5MB，超过当前4MiB输入限制。',98:'操作没有说明取出后新箱能插入哪些位置；任意位置、原位置或末尾会产生不同最优结果，不能自行补全。'}
BLOCKED[83] = '32 MiB 输入预算已容纳原约束，原4 MiB理由失效；但原样例[3,6,2,6,25]按操作应为34而非17，25无法降低。源O(V)算法在V=2×10⁸时整数数组约800 MB，仍需完整范围的正确且资源可行算法及公开样例更正，不能照搬上线。'
# Conservative bounds for EVERY valid canonical input, not merely existing cases.
# Numeric width includes one ASCII separator; headers have an ample 100-byte allowance.
INPUT_BOUNDS={76:100+100000*22,77:200004,78:100+100000*8,81:100+200000*11,85:100+100000*11,86:100+100000*11,87:100+100000*21,88:100+100000*11,89:100+1000*1001,90:100+5000*2,91:100+100000,93:100+100000*22,95:100+100000+100,96:100+100000*7,97:100+100000*11,99:100+100000*10,100:100+100000*7}

def execute(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300,check=True)
    values=json.loads(p.stdout);assert len(values)==len(inputs);return [v.rstrip('\n') for v in values]
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[]
    for s in SPECS:
        assert INPUT_BOUNDS[s['n']]<=4*1024*1024
        identifier=f"oa-amazon-{s['n']}";rng=random.Random(SEED+s['n']);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        oracle=[dict(input=s['encode'](x),expectedOutput=str(s['oracle'](x))+'\n') for x in s['samples']+[s['random'](rng) for _ in range(160)]]
        tests=oracle[:3]+[dict(input=s['encode'](x),expectedOutput=str(y)+'\n') for x,y in s['edges']]+oracle[3:27]
        for c in tests+oracle:assert len(c['input'].encode())<=4*1024*1024 and '\ufffd' not in c['input']+c['expectedOutput']
        for i,(actual,c) in enumerate(zip(execute(path,[c['input'] for c in oracle+tests]),oracle+tests)):assert actual==c['expectedOutput'].rstrip('\n'),(identifier,i,actual,c['expectedOutput'])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];killed=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(identifier,name);changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{identifier}-{j}.py';mp.write_text(changed)
            outputs=execute(mp,[c['input'] for c in cases]);bad=[i for i,(actual,c) in enumerate(zip(outputs,cases)) if actual!=c['expectedOutput'].rstrip('\n')];assert bad,(identifier,name,'survived')
            mutants.append(dict(name=name,code=changed));killed.append(dict(name=name,rejectedByCases=bad))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Amazon'],description=s['desc']+'\n\n本站独立编写标准I/O及评测；注明本站的范围不是来源原约束。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('time',4),memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        raw=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout;assert '\ufffd' not in raw
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)];source=sources[identifier]
        for folder,data in dict(packages=json.loads(raw),oracles=oracle,mutants=mutants,editorials=dict(schemaVersion=1,id=identifier,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        assert len(cases)<=64 and s.get('time',4)<=10 and (OUT/'packages'/f'{identifier}.json').stat().st_size<16*1024*1024
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(raw.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracle),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=INPUT_BOUNDS[s['n']],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()));print(identifier,'163 oracle,',len(cases)-3,'hidden, 2 normal mutants rejected',flush=True)
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped={f'oa-amazon-{k}':v for k,v in BLOCKED.items()},note='Local batched runpy, fresh __main__ and stdin/stdout per case; not per-case OS isolation. Real sandbox verification still required.'),ensure_ascii=False,indent=2)+'\n')
    notes={76:'累计usage规则不变；来源未定义不可达返回值，本站I/O明确使用−1，覆盖重叠/单秒/恰好达到/不可达/10¹⁴阈值。',81:'严格遵循来源backup≤primary，不套用反向不等号的另一版本。',89:'用行字符串标准I/O表达原019网格，保留1000×1000最大规模；紧凑数组避免百万tuple集合内存。',97:'依据最低空闲编号规则，来源样例修正为0 1 1 0 1；来源缺数字范围处注明本站范围。',99:'与51相同规则，复用本站独立编写的调度算法/独立暴力oracle，绑定本题自身来源指纹。'}
    reviews=[dict(id=f'oa-amazon-{n}',status='blocked' if n in BLOCKED else 'authored',reason=BLOCKED.get(n,notes.get(n,'独立参考解、具体样例、暴力对照与最大规模边界验证；未执行源站题解。'))) for n in range(76,101)]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
