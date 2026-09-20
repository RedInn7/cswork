"""Original JPMorgan 21–36 batch; source statements are data, never executed."""
from pathlib import Path
from collections import deque,Counter
from functools import lru_cache
from itertools import product,permutations
import hashlib,json,random,subprocess,sys,time,heapq
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='jpmorgan-tail';SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def rows(a):return str(len(a))+'\n'+'\n'.join(seq(x) for x in a)+'\n'
def string(s):return str(len(s))+'\n'+s+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def remove_oracle(s):
    @lru_cache(None)
    def go(t):return min([len(t)]+[go(t[:i]+t[i+2:]) for i in range(len(t)-1) if t[i:i+2] in ('AB','BB')])
    return str(go(s))
add(21,'删除AB或BB后的最短长度','每步删除一个连续AB或BB，并拼接剩余两侧。求任意次操作后的最小长度。','第一行长度n，第二行AB串；原界1≤n≤200000。','顺序扫描维护栈的长度，遇B且长度非零则消去一个已有字符，否则长度加一。','任意删除过程等价于把一个B与它之前一个未消去字符配对，配对区间不能交叉。考虑当前B及最近未配对前驱：若最优方案没有将两者配对，可把它们原先涉及的至多两对改为当前这一对，并在存在两个剩余端点时把它们配成一对，保持右端为B且配对不交叉，不减少删除数。因此可以优先消去这两位。逐前缀执行得到最大配对数，剩余长度最小；AB与BB的左字符均可匹配，所以只需栈长。','时间O(n)，除输入外空间O(1)。',['BABBA','ABB','AAAA'],lambda r:''.join(r.choice('AB') for _ in range(r.randint(1,11))),lambda:[('A'*200000,'200000'),('B'*200000,'0'),('AB'*100000,'0'),('BA'*100000,'2')],string,remove_oracle,"""def solve(raw):
    s=raw.splitlines()[1];left=0
    for c in s:left=left-1 if c=='B' and left else left+1
    return str(left)
""",[('忽略BB消去',"c=='B' and left","c=='B' and left and False"),('误把A当右端',"c=='B'","c=='A'")],200020)

def machine_oracle(a):return str(max(sum(l<=t<=h for l,h in a) for t in range(min(l for l,h in a),max(h for l,h in a)+1)))
def interval_rand(r):return [(lambda l:(l,r.randint(l,25)))(r.randint(1,20)) for _ in range(r.randint(1,12))]
add(22,'闭区间任务的最少机器数','每项任务在[start,end]内占用一台机器，端点包含，每台机器同一时刻至多运行一个任务。求最少机器数。原例2存在start>end的非法任务且说明重新配对，不采用该损坏样例。','第一行n，随后n行start end；完整原界1≤n≤200000，1≤start≤end≤1000000000。','任务起点加一、终点后一时刻减一，按时间排序扫描最大同时运行数量。','任何时刻的并发任务必须使用不同机器，最大并发是下界。按起点分配任务，只要已有机器空闲就复用，否则新增；新增时全部旧机器仍忙，恰有对应数量任务并发，故机器数不会超过该下界。扫描线准确计算这个数。','时间O(n log n)，空间O(n)。',[[(1,7),(8,9),(3,6),(9,14),(6,7)],[(2,5)]*4,[(1,2),(2,3)]],interval_rand,lambda:[([(1000000000,1000000000)]*200000,'200000'),([(i+1,i+1) for i in range(200000)],'1'),([(1,1000000000)]*200000,'200000'),([(1,1),(2,2)],'1')],rows,machine_oracle,"""def solve(raw):
    d=list(map(int,raw.split()))[1:];events=[]
    for l,h in zip(d[::2],d[1::2]):events.extend(((l,1),(h+1,-1)))
    events.sort();active=answer=0
    for t,delta in events:active+=delta;answer=max(answer,active)
    return str(answer)
""",[('结束端点不占用','(h+1,-1)','(h,-1)'),('算总任务数','return str(answer)','return str(len(d)//2)')],4400020)

def binary_oracle(a):
    top=max(a);dist=[10**9]*(top+1);dist[0]=0
    for v in range(top+1):
        for w in (v+1,v*2):
            if w<=top:dist[w]=min(dist[w],dist[v]+1)
    return '\n'.join(str(dist[v]) for v in a)
add(23,'从零加一或乘二的最少操作','初始数为0，每步可加1或乘2，求到达每个目标值的最少操作。原正文前段缺失，操作集由原文说明及ADD_1、MULTIPLY_2样例恢复。','第一行n，随后n个k；原正文完整界1≤n≤10000，0≤k≤10000000000000000。','正数的答案为二进制位数减一，再加二进制1的数量；0直接为0。','逆向时奇数只能减一，偶数可除二。偶数若先减一，则仍须通过再减一或更长步骤达到下一偶数；把成对加一前移到乘二之前不会增加操作。因此存在按二进制从高位构造的最优路径，每个后续位一次倍增，每个1位一次加一，达到所给次数。','时间O(n log K)，输出空间O(n)。',[[5,3],[0,1,8],[7,16,31]],lambda r:[r.randint(0,200) for _ in range(r.randint(1,10))],lambda:[([10**16]*10000,'\n'.join([str((10**16).bit_length()-1+bin(10**16).count('1'))]*10000)),([0]*10000,'\n'.join(['0']*10000)),([2**53-1]*10000,'\n'.join(['105']*10000)),([2**53]*10000,'\n'.join(['54']*10000))],arr,binary_oracle,"""def solve(raw):
    a=list(map(int,raw.split()))[1:]
    return '\\n'.join(str(v.bit_length()-1+v.bit_count() if v else 0) for v in a)
""",[('忽略加一次数','v.bit_length()-1+v.bit_count()','v.bit_length()'),('零需要一步','if v else 0','if v else 1')],180020,output='依输入顺序输出n行最少操作数。')

def halve_oracle(a):
    start=tuple(a);q=deque([(start,0)]);seen={start}
    while q:
        v,d=q.popleft()
        if all(v[i]%2!=v[i+1]%2 for i in range(len(v)-1)):return str(d)
        for i,x in enumerate(v):
            if not x:continue
            w=v[:i]+(x//2,)+v[i+1:]
            if w not in seen:seen.add(w);q.append((w,d+1))
add(24,'逐项减半得到交替奇偶的最少次数','一次选择一个元素变为floor(v/2)，允许变0。求最终每对相邻元素奇偶不同的最少操作次数；不能逐对贪心只改右边。','第一行n，随后n个items；原始完整界1≤n≤100000，1≤items[i]≤2^30。','最终奇偶仅可能从偶或从奇开始交替。分别计算每项达到对应奇偶所需的最少右移次数，再取两种总和的最小值。','固定一种交替模式后，各位置操作互不影响，最低成本等于每项独立首次到达目标奇偶的步数之和。正数不断减半必经过1和0，所以两种奇偶均可达到。所有合法最终数组都属于这两种模式，取最小覆盖全部方案。','时间O(n log V)，除输入外空间O(1)。',[[4,10,10,6,2],[6,5,9,7,3],[2,4]],lambda r:[r.randint(1,8) for _ in range(r.randint(1,4))],lambda:[([2**30]*100000,'1500000'),([2**30-1]*100000,'1500000'),([1,2]*50000,'0'),([2**30],'0')],arr,halve_oracle,"""def solve(raw):
    a=list(map(int,raw.split()))[1:];totals=[]
    for first in (0,1):
        cost=0
        for i,v in enumerate(a):
            target=first^(i&1)
            while v%2!=target:v//=2;cost+=1
        totals.append(cost)
    return str(min(totals))
""",[('只允许偶开头','for first in (0,1):','for first in (0,):'),('无视多次减半','while v%2!=target:v//=2;cost+=1','if v%2!=target:cost+=1')],1100020)

def winner_oracle(x):
    a,k=x;q=deque(a);last=None;wins=0
    while wins<k:
        u,v=q.popleft(),q.popleft();w,l=max(u,v),min(u,v);q.appendleft(w);q.append(l);wins=wins+1 if w==last else 1;last=w
    return str(last)
add(25,'首次连续获胜k场的选手','选手按原顺序排队，队首两人比较互异势能，大者获胜留在队首，败者去队尾。首次连胜k场即结束，输出胜者势能。','第一行n k，随后n个互异势能。原界N/A，本站2≤n≤200000、1≤k≤10^18、势能为−10^9..10^9整数，不要求为1..n排列。','扫描原队列维护冠军与连胜数，换冠军时从1算起；扫描结束还未结束时返回全局最大势能。','最大势能首次成为冠军前，每场对手恰是原队列中下一位尚未上场者，扫描模拟准确。一旦最大势能成为冠军便不会再输；若已扫描完但未达k，今后胜者只能是它。因此无需执行巨大k次比赛。','时间O(n)，除输入外空间O(1)。',[([3,2,1,4],2),([-5,-2,-3,-1],1),([1,3,2,4,5],3)],lambda r:(r.sample(range(-20,21),r.randint(2,9)),r.randint(1,15)),lambda:[((list(range(200000)),10**18),'199999'),(([10**9]+list(range(-199999,0)),1),str(10**9)),(([-10**9,10**9],10**18),str(10**9)),(([3,2,1,4],2),'3')],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',winner_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];champion=a[0];wins=0
    for v in a[1:]:
        if v>champion:champion=v;wins=1
        else:wins+=1
        if wins>=k:return str(champion)
    return str(champion)
""",[('换冠军从零算','champion=v;wins=1','champion=v;wins=0'),('总返回最大值','if wins>=k:return str(champion)','if False:return str(champion)')],2400050)
SPECS[-1]['samples'][2]=([1,3,2,4,5],2)

add(27,'第一个只出现一次字符的下标','返回小写字符串中最先出现且全串仅出现一次的字符下标，使用1基下标；不存在返回−1。','第一行n，第二行字符串；1≤n≤100000，仅小写英文字母。','先统计26个字母频次，再从左至右找第一个频次为1的位置。','统计得到每个字符在全串的精确出现次数，频次为1恰等价于唯一。第二遍按位置递增，第一个满足者必是最早唯一字符，遍历完仍没有则无解。','时间O(n)，额外空间O(26)。',['statistics','hackthegame','aabb'],lambda r:''.join(r.choice('abcdef') for _ in range(r.randint(1,30))),lambda:[('a'*99999+'z','100000'),('a'*100000,'-1'),('z'+'a'*99999,'1'),('a','1')],string,lambda s:str(next((i+1 for i,c in enumerate(s) if s.count(c)==1),-1)),"""from collections import Counter
def solve(raw):
    s=raw.splitlines()[1];counts=Counter(s)
    return str(next((i+1 for i,c in enumerate(s) if counts[c]==1),-1))
""",[('使用零基','i+1 for i,c','i for i,c'),('最后一个唯一字符','enumerate(s) if counts[c]==1','reversed(list(enumerate(s))) if counts[c]==1')],100020)

def revenue_oracle(x):
    a,m=x
    @lru_cache(None)
    def best(v,k):
        if not k:return 0
        if not sum(v):return -10**9
        return max(v[i]+best(v[:i]+(v[i]-1,)+v[i+1:],k-1) for i in range(len(v)) if v[i])
    return str(best(tuple(a),m) if sum(a)>=m else -1)
add(28,'按剩余库存定价的最大销售额','每位顾客恰买一件商品，某种商品本次价格等于出售前剩余库存，出售后库存减一。给出m位顾客，求最大收入，不取模。原文未保证库存够卖，本站约定总库存<m时输出−1；原例1说明库存误写，按输入[10,10,8,9,1]及m=6应为55。','第一行n m，随后n个quantity；完整原界1≤n≤100000、1≤m≤1000000000、1≤quantity[i]≤1000000000，不限制m≤库存总量。','按库存降序排序，把最高的若干种库存一起降到下一层；顾客不足卖完整层时，用除法计算完整下降高度和余数销售，等差求和累计。','每种商品提供从初始库存递减到1的价格链。若某销售方案选了较小可用价格而未选更大可用价格，换成后者不减收益，且选价格链前缀仍可实现。因此依次取最高价格最优。分层算法将相同最高价格批量卖出，等价于该贪心；等差和只加速计算，不改变所选价格。','时间O(n log n)，空间O(n)，不依赖m逐件循环。',[([10,10,8,9,1],6),([1,2,4],4),([1,1],3)],lambda r:(lambda a:(a,r.randint(1,sum(a)+2)))([r.randint(1,5) for _ in range(r.randint(1,4))]),lambda:[(([10**9]*100000,10**9),str(100000*(10**9+(10**9-9999))*10000//2)),(([10**9],10**9),str(10**9*(10**9+1)//2)),(([1]*100000,10**9),'-1'),(([8]*4,4),'32')],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',revenue_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=sorted(d[2:],reverse=True)
    if sum(a)<m:return '-1'
    a.append(0);answer=0
    for i in range(n):
        width=i+1;high=a[i];low=a[i+1];available=(high-low)*width
        take=min(m,available);levels,rest=divmod(take,width)
        answer+=width*(high+high-levels+1)*levels//2+rest*(high-levels)
        m-=take
        if not m:break
    return str(answer)
""",[('漏掉部分层余数','+rest*(high-levels)','+0'),('每种商品最多出售一件','return str(answer)','return str(sum(sorted(d[2:],reverse=True)[:min(d[1],n)]))')],1100050)

def information_oracle(x):
    a,k=x;values=[]
    for start in range(len(a)):
        total=0
        for i in range(start,len(a),k):total+=a[i]
        values.append(total)
    return str(max(values))
add(29,'必须跳到网络外的最大安全值和','必须选择一个起点，收取其安全值，之后每次跳+k并收取到达值，直到下一跳越界才结束。不能提前停止或空选，值可能为负；求最优起点的总和。','第一行n k，随后n个security值；原界1≤n≤1000000，1≤k≤n，−1000≤security[i]≤1000。','从右向左计算每个起点到出界的总和，dp[i]=a[i]+dp[i+k]，越界后项视为0；最大dp即答案。','从最后k个位置出发只能收自己，递推正确。对其余位置，从i出发必须收a[i]并执行从i+k起的完整过程，因此递推给出唯一合法路径总和。逆序归纳所有起点正确，取最大覆盖全部非空选择。','时间O(n)，空间O(n)并在输入数组原地累加。',[([2,-3,4,6,1],2),([5,-10],1),([-5,-2,-3],2)],lambda r:(lambda a:(a,r.randint(1,len(a))))([r.randint(-10,10) for _ in range(r.randint(1,15))]),lambda:[(([1000]*1000000,1),'1000000000'),(([-1000]*1000000,1),'-1000'),(([1000,-1000]*500000,2),'500000000'),(([-1000]*999999+[1000],1000000),'1000')],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',information_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];del d
    for i in range(n-k-1,-1,-1):a[i]+=a[i+k]
    return str(max(a))
""",[('允许空选','str(max(a))','str(max(0,max(a)))'),('允许提前停止','a[i]+=a[i+k]','a[i]+=max(0,a[i+k])')],6000050)

def reduce_oracle(a):
    @lru_cache(None)
    def go(t):
        if len(t)==1:return 0
        return min(t[i]+t[j]+go(tuple(sorted([t[k] for k in range(len(t)) if k not in (i,j)]+[t[i]+t[j]]))) for i in range(len(t)) for j in range(i+1,len(t)))
    return str(go(tuple(sorted(a))))
def reduce_edges():
    # Equal weights have optimal leaf depths floor(log2 n) or ceil(log2 n).
    n=100000;k=n.bit_length()-1;cost=n*k+2*(n-2**k)
    yield [100]*n,str(100*cost)
    yield [1]*n,str(cost)
    yield [1,100],'101'
    yield [100]*65536,str(100*65536*16)
add(31,'任意合并两数的最小总成本','每次选择两个不同位置元素，删除它们并插入其和，本次成本是该和，求合并至一个元素的最小总成本。','第一行n，随后n个正整数；完整原界2≤n≤100000，1≤a[i]≤100。','最小堆反复取最小两项，累计它们的和，再将和入堆。','合并过程是二叉树，每个原值贡献自身乘叶深度。可以将两个最小权值放在最深的一对兄弟叶：与更大权交换不会增加总成本。收缩这对叶为权值和，原最优问题变为规模少一的问题并增加固定这次成本，归纳得到最小两项合并贪心。','时间O(n log n)，空间O(n)。',[[25,10,20],[1,1],[2,3,4,5]],lambda r:[r.randint(1,10) for _ in range(r.randint(2,7))],reduce_edges,arr,reduce_oracle,"""import heapq
def solve(raw):
    a=list(map(int,raw.split()))[1:];heapq.heapify(a);cost=0
    while len(a)>1:
        value=heapq.heappop(a)+heapq.heappop(a);cost+=value;heapq.heappush(a,value)
    return str(cost)
""",[('只统计最终值','return str(cost)','return str(a[0])'),('选最大两项','heapq.heapify(a);cost=0','a=[-v for v in a];heapq.heapify(a);cost=0')],400020)
SPECS[-1]['mutants'][1]=('选最大两项',SPECS[-1]['code'],"""import heapq
def solve(raw):
    a=[-int(v) for v in raw.split()[1:]];heapq.heapify(a);cost=0
    while len(a)>1:
        value=heapq.heappop(a)+heapq.heappop(a);cost-=value;heapq.heappush(a,value)
    return str(cost)
""")

def suffix_oracle(s):
    n=len(s);start='0'*n;q=deque([(start,0)]);seen={start}
    while q:
        v,d=q.popleft()
        if v==s:return str(d)
        for i in range(n):
            w=v[:i]+''.join('1' if c=='0' else '0' for c in v[i:])
            if w not in seen:seen.add(w);q.append((w,d+1))
add(32,'从全零串翻转后缀的最少次数','初始为等长全0串，每次选择一位，把该位及全部右侧位0/1互换，求得到目标的最少次数。','第一行长度n，第二行为二进制目标串，空串写空行。原界Unknown，本站0≤n≤200000；catalog十万界不是原始证据。','从左到右维护当前有效位，遇目标不同就翻一次后缀并更新有效位。','处理到某位时更早位已正确，后续起点更晚的翻转无法改变当前位。若当前与目标不同，必须有一次从此位开始的翻转；若相同则无需。每位选取必需翻转且不破坏前缀，因此达到下界。','时间O(n)，额外空间O(1)。',['01011','','111'],lambda r:''.join(r.choice('01') for _ in range(r.randint(0,9))),lambda:[('10'*100000,'200000'),('01'*100000,'199999'),('0'*200000,'0'),('1'*200000,'1')],string,suffix_oracle,"""def solve(raw):
    lines=raw.splitlines();s=lines[1] if int(lines[0]) else '';current='0';answer=0
    for c in s:
        if c!=current:answer+=1;current=c
    return str(answer)
""",[('忘记更新翻转状态','answer+=1;current=c','answer+=1'),('初始错误为1',"current='0'","current='1'")],200020)

def swaps_oracle(a):
    a=tuple(a);goal=tuple(sorted(a,reverse=True));q=deque([(a,0)]);seen={a}
    while q:
        v,d=q.popleft()
        if v==goal:return str(d)
        for i in range(len(v)):
            for j in range(i+1,len(v)):
                w=list(v);w[i],w[j]=w[j],w[i];w=tuple(w)
                if w not in seen:seen.add(w);q.append((w,d+1))
add(33,'排列降序所需的最少任意交换','势能互异，每次可交换任意两个位置，求变成降序的最少操作。互异和取值1..n意味着输入是1..n的排列。','第一行n，第二行为排列；完整原界1≤n≤200000，1≤a[i]≤n且互异。','值v的目标位置为n−v。遍历这一位置映射的所有环，每个长度L的环贡献L−1。','一个交换至多将一个置换环分成两个，最终每个位置独立，故长度L的环至少L−1次；固定环内一个位置依次与其他位置交换即可达到，所有环独立，总和最优。','时间O(n)，空间O(n)。',[[3,4,1,2],[1],[1,2,3]],lambda r:r.sample(range(1,(n:=r.randint(1,6))+1),n),lambda:[(list(range(1,200001)),'100000'),(list(range(200000,0,-1)),'0'),(list(range(199999,0,-1))+[200000],'199999'),([2,1],'0')],arr,swaps_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:];seen=bytearray(n);answer=0
    for start in range(n):
        if seen[start]:continue
        v=start;length=0
        while not seen[v]:seen[v]=1;length+=1;v=n-a[v]
        answer+=length-1
    return str(answer)
""",[('目标误为升序','v=n-a[v]','v=a[v]-1'),('每个环多算一次','answer+=length-1','answer+=length')],1400020)

def grouped_oracle(s):
    total=0
    for i in range(len(s)):
        for j in range(i+2,len(s)+1,2):
            v=s[i:j];h=len(v)//2
            total+=len(set(v[:h]))==len(set(v[h:]))==1 and v[0]!=v[h]
    return str(total)
add(34,'两段等量零一子串的数量','统计0、1数量相同且所有0连续、所有1也连续的子串，重复文本按出现位置分别计数。0110虽然数量相同但不合格。','第一行长度n，第二行二进制串；原文未给长度界，本站0≤n≤200000，空串为空行。','维护相邻游程长度，每个游程边界贡献两侧长度的较小值。','合法子串恰好跨一个不同字符游程边界；若两侧长度分别x、y，选择两边各k个字符时1≤k≤min(x,y)，每个k唯一。不同边界对应不同子串，因此贡献之和精确且无重复漏计。','时间O(n)，额外空间O(1)。',['011001','','0011'],lambda r:''.join(r.choice('01') for _ in range(r.randint(0,15))),lambda:[('01'*100000,'199999'),('0'*100000+'1'*100000,'100000'),('0'*200000,'0'),('0011'*50000,'199998')],string,grouped_oracle,"""def solve(raw):
    lines=raw.splitlines();s=lines[1] if int(lines[0]) else '';previous=current=answer=0;last=''
    for c in s:
        if c==last:current+=1
        else:answer+=min(previous,current);previous=current;current=1;last=c
    return str(answer+min(previous,current))
""",[('两段长度取最大','min(previous,current)','max(previous,current)'),('漏最后边界','return str(answer+min(previous,current))','return str(answer)')],200020)

def unique_number_oracle(x):return str(sum(len(set(str(v)))==len(str(v)) for v in range(x[0],x[1]+1)))
def unique_number_rand(r):
    l=r.randint(0,500);return l,l+r.randint(0,200)
def unique_number_edges():
    # 0 plus each positive length: 9 first digits, then 9,8,... options.
    total=1;term=9
    for size in range(1,11):
        if size>1:term*=11-size
        total+=term
    return [((0,10**18),str(total)),((10**18,10**18),'0'),((9876543210,9876543210),'1'),((0,0),'1'),((9999999999,10**18),'0')]
add(35,'闭区间内十进制位互异的数','统计闭区间内十进制各位均不同的非负整数。0用单个数字0表示，计作合法。原正文截断，规则由标题及10..13包含10、12、13的原解释恢复；非负域和0的表示是本站明确协议。','一行start end。原文无数值界，本站0≤start≤end≤10^18。','数位DP计算不超过上界的合法数，再用F(end)−F(start−1)。状态为位置、已用数字掩码、是否已开始、是否贴上界，前导零不占用数字。','每个非负整数对应唯一等长补零表示。开始前的零只是占位，开始后的每个数字必须未在掩码出现，故状态转移恰好生成所有位互异表示且各一次。全未开始路径代表0。贴上界状态保证不超界，终点计数，再用前缀计数相减得到闭区间答案。','时间O(log U·1024·10)，空间O(log U·1024)，不逐数扫描区间。',[(10,13),(0,11),(98,102)],unique_number_rand,unique_number_edges,lambda x:seq(x)+'\n',unique_number_oracle,"""from functools import lru_cache
def count(limit):
    if limit<0:return 0
    digits=tuple(map(int,str(limit)))
    @lru_cache(None)
    def dp(pos,mask,started,tight):
        if pos==len(digits):return 1
        top=digits[pos] if tight else 9;answer=0
        for d in range(top+1):
            nt=tight and d==top
            if not started and d==0:answer+=dp(pos+1,mask,False,nt)
            elif not mask>>d&1:answer+=dp(pos+1,mask|1<<d,True,nt)
        return answer
    return dp(0,0,False,True)
def solve(raw):
    l,h=map(int,raw.split());return str(count(h)-count(l-1))
""",[('排除左端点','count(l-1)','count(l)'),('重复数字也使用','elif not mask>>d&1:','elif True:')],50)

BLOCKED={26:'n=q=5000且每词100字符时输出至少25亿ASCII字符，超过64MiB；不得缩匹配数或替换为引用编码规避原域。',30:'numProjects和报价数n独立，但原项目ID上界<n而非<numProjects，编号超出实际项目的处理不明，等待源证据澄清。',36:'原文未规定多个按键最长持续时间并列时如何选择，不采用catalog自加字典序大者规则。'}
NAMES=dict(zip(range(21,37),['get-min-length','get-min-machines','get-min-operations','get-minimum-operations','get-potential-of-winner','get-search-results','get-unique-character','maximum-amount','maximum-information','min-cost','minimize-cost','minimum-flips','minimum-swaps','one-substring-count','print-number-of-elements-without-repeating-digits','slowest-key']))
def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(a,b):return a.split()==b.split()
def small_check():
    for s in SPECS:
        rng=random.Random(20267500+s['n']);values=s['samples']+[s['rnd'](rng) for _ in range(160)];scope={};exec(s['code'],scope)
        cases=[(s['encode'](v),s['oracle'](v)) for v in values]
        for raw,expected in cases:assert equal(scope['solve'](raw),expected),(s['n'],raw,expected,scope['solve'](raw))
        for name,old,new in s['mutants']:
            assert old in s['code'],(s['n'],name);mut={};exec(s['code'].replace(old,new),mut)
            assert any(not equal(mut['solve'](raw),expected) for raw,expected in cases),(s['n'],name)
        print(s['n'],'163 independent small oracles and 2 normal-return WA passed',flush=True)
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
        number=s['n'];ident=f'oa-jpmorgan-chase-{number}'
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(20267500+number)
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=a+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:27];assert len(tests)>=31
        for c in oracles+tests:
            assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
            assert len(c['expectedOutput'].encode())<=4*1024*1024
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert equal(a,c['expectedOutput']),(ident,i,a[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not equal(a,c['expectedOutput'])];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        explanation='三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') for c in oracles[:3])+'。独立枚举或直接模拟已核对这些答案。'
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','JPMorgan Chase'],description=s['desc']+'\n\n输入输出协议由本站整理，缺失数值界明确标为本站补充。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=6,memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20267500,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del actual,outputs,cases,tests,boundary,oracles,normalized,p
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,name in NAMES.items():
        rel=f'fastprep/JPMorgan Chase/jpmorgan-{name}.md';raw=(snapshot/rel).read_bytes();ident=f'oa-jpmorgan-chase-{number}'
        reason=BLOCKED[number] if number in BLOCKED else next(s['desc'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
