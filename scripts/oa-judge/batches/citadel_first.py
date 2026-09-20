"""Original Citadel batch. Immutable source statements are read as evidence only."""
from pathlib import Path
from collections import Counter,deque
from functools import lru_cache
from itertools import combinations,product
from math import comb
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='citadel-first';SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def textline(s):return s+'\n'
def vec(a):return str(len(a))+'\n'+seq(a)
def add(n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def goodness_oracle(a):
    values={0}
    for mask in range(1,1<<len(a)):
        selected=[a[i] for i in range(len(a)) if mask>>i&1]
        if all(x<y for x,y in zip(selected,selected[1:])):
            value=0
            for x in selected:value|=x
            values.add(value)
    return vec(sorted(values))
def goodness_edges():
    yield [1023]*10000,'2\n0 1023'
    yield list(range(1,1024))+[1023]*8977,vec(range(1024))
    yield list(range(1023,0,-1)),vec(range(1024))
    yield [4,2,1],vec([0,1,2,4])
GOOD_CODE="""def solve(raw):
    a=list(map(int,raw.split()))[1:];last=[1024]*1024;last[0]=0
    for v in a:
        for mask in range(1024):
            if last[mask]<v:last[mask|v]=min(last[mask|v],v)
    result=[i for i in range(1024) if last[i]<1024]
    return str(len(result))+'\\n'+' '.join(map(str,result))
"""
for number in (1,15):
    add(number,'严格递增子序列的不同OR值','从原数组选择保序且数值严格递增的子序列，计算按位OR，返回全部不同结果并升序排列；空子序列的OR为0。原OCR返回数组，旧整理页1号误写返回数量，现按原文恢复。','第一行n，随后n个整数。完整OCR范围1≤n≤10000，1≤a[i]<1024。15号同题Fastprep另页及OCR补足其缺失范围。','每个OR值只保留可达递增子序列的最小末值；遇v时，从末值<v的状态转移到OR|v。','同一个OR下末值越小，未来能接的数字集合越大，保留最小末值不会丢失任何后续可行方案。当前状态末值<v才可接v，转移准确；新状态末值v不会在同一轮再次满足严格小于，避免复用当前位置。初始空序列可接所有正数，归纳覆盖全部子序列。','时间O(1024n)，空间O(1024)。',[[4,2,4,1],[3,2,4,6],[3,5,5,1]],lambda r:[r.randint(1,31) for _ in range(r.randint(1,10))],goodness_edges,arr,goodness_oracle,GOOD_CODE,[('错误先排序数组','for v in a:','for v in sorted(a):'),('遗漏空序列0','result=[i for i in range(1024)','result=[i for i in range(1,1024)')],50020,output='第一行结果数，第二行升序不同OR值，包含0。')

def friends_encode(x):return f'{x[0]} {len(x[1])}\n'+'\n'.join(seq(e) for e in x[1])+'\n'
def friends_oracle(x):
    n,edges=x;adj=[set() for _ in range(n)]
    for a,b in edges:adj[a].add(b);adj[b].add(a)
    return seq(min((j for j in range(n) if j!=i and j not in adj[i]),key=lambda j:(-len(adj[i]&adj[j]),j),default=-1) for i in range(n))
def friends_rand(r):
    n=r.randint(1,12);return n,[(i,j) for i in range(n) for j in range(i+1,n) if r.random()<.25]
def friends_edges():
    yield (100000,[]),seq([1]+[0]*99999)
    # Five-dimensional cubes, 32 vertices / 80 edges, exactly 250000 edges.
    edges=[];out=[]
    for base in range(0,100000,32):
        for u in range(32):
            for bit in range(5):
                v=u^(1<<bit)
                if u<v:edges.append((base+u,base+v))
            out.append(base+min(u^(1<<a)^(1<<b) for a in range(5) for b in range(a+1,5)))
    yield (100000,edges),seq(out)
    # Max degree 15. K16 has no internal candidates; nearest outside wins at zero.
    edges=[(base+i,base+j) for base in range(0,32000,16) for i in range(16) for j in range(i+1,16)]
    yield (32000,edges),seq([16]*16+[0]*(32000-16))
    yield (1,[]),'-1'
FRIEND_CODE="""def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];adj=[set() for _ in range(n)]
    for a,b in zip(d[2::2],d[3::2]):adj[a].add(b);adj[b].add(a)
    out=[]
    for u in range(n):
        counts={}
        for v in adj[u]:
            for w in adj[v]:
                if w!=u and w not in adj[u]:counts[w]=counts.get(w,0)+1
        if counts:best=min(counts,key=lambda v:(-counts[v],v))
        else:
            best=0
            while best<n and (best==u or best in adj[u]):best+=1
            if best==n:best=-1
        out.append(best)
    return ' '.join(map(str,out))
"""
for number in (2,18):
    add(number,'最多共同朋友的非好友推荐','对每人推荐既非自己也非直接朋友的用户，优先共同朋友最多，再取最小ID。共同朋友为0仍是候选，仅无任何非好友时返回−1。原OCR输入为边列表，不是旧整理矩阵；原文正式条件未要求正共同数。','第一行n m，随后m行无向边。原完整同题范围1≤n≤100000，0≤m≤250000，ID为0..n−1；无自环/重边，每人至多15朋友，可不连通。18号正文1基笔误按原约束及样例恢复0基。','枚举每人的朋友的朋友统计二跳次数，去掉自己和直接朋友；若没有正分候选，扫描最小不在自己及朋友集合中的ID。','每条u−v−w路径唯一对应一个共同朋友v，无重边保证计数等于共同朋友数。所有正分候选都会出现，按分数和ID选择准确；未出现的非朋友共同数是0，仅无正分时才可能最优，直接选择其中最小ID。','时间O(n·15²)，空间O(n+m)；零分回退至多检查17个ID。',[(5,[(0,1),(0,2),(1,3),(2,3),(3,4)]),(3,[(0,1),(1,2),(2,0)]),(3,[(0,1)])],friends_rand,friends_edges,friends_encode,friends_oracle,FRIEND_CODE,[('零共同数错误当无候选','if best==n:best=-1','best=-1'),('并列推荐最大编号','(-counts[v],v)','(-counts[v],-v)')],3000050,output='输出n个推荐ID，依用户0..n−1排列。')

def pal5_oracle(s):return str(sum((v:=''.join(s[i] for i in ids))==v[::-1] for ids in combinations(range(len(s)),5))%1000000007)
add(3,'长度5的二进制回文子序列数','选择5个递增下标，形成回文串；下标不同视为不同子序列，不按文本去重。结果模1000000007。','一行01串，完整OCR范围5≤长度≤100000。','回文形如abcba，一共8种。分别用倒序更新的子序列DP统计每个固定模式，再求和。','固定模式的dp[j]表示已扫描前缀中匹配模式前j位的下标方案数。遇字符相同时增加dp[j−1]，倒序更新避免同一位用两次。每个长度5回文恰属于唯一abcba模式，8种计数相加无重无漏。','时间O(40n)，额外空间O(1)。',['0100110','010110','01111'],lambda r:''.join(r.choice('01') for _ in range(r.randint(5,13))),lambda:[('0'*100000,str(comb(100000,5)%1000000007)),('1'*100000,str(comb(100000,5)%1000000007)),('0'*50000+'1'*50000,str(2*comb(50000,5)%1000000007)),('00000','1')],textline,pal5_oracle,"""from itertools import product
def solve(raw):
    s=raw.strip();mod=1000000007;answer=0
    for a,b,c in product('01',repeat=3):
        pattern=a+b+c+b+a;dp=[1,0,0,0,0,0]
        for ch in s:
            for j in range(5,0,-1):
                if ch==pattern[j-1]:dp[j]=(dp[j]+dp[j-1])%mod
        answer=(answer+dp[5])%mod
    return str(answer)
""",[('正序更新复用同一字符','range(5,0,-1)','range(1,6)'),('漏掉首位为1的模式',"product('01',repeat=3)","product('0','01','01')")],100001)

def distinct_pal_oracle(s):return str(len({s[i:j] for i in range(len(s)) for j in range(i+1,len(s)+1) if s[i:j]==s[i:j][::-1]}))
add(4,'不同回文子串的数量','统计不同文本的回文子串数，多次出现只算一次。原OCR长例abcddcbabcdcdaadcdcbabcddcb正确为26而不是27，原列举含重复及不存在的子串。','一行小写串，完整OCR范围1≤长度≤5000。','建立回文树，两特殊根长度−1和0；每加入字符，沿最长回文后缀的失败链接找可扩展节点，建立新回文及失败链接。','每个回文由删除首尾字符后的较短回文与外侧字符唯一确定，边代表这种扩展。追加字符产生的新回文若存在，必是新的最长回文后缀；其余回文后缀此前出现过，因此每次至多新建一个节点。失败链找出所有候选后缀，节点与不同非空回文一一对应，减去两根就是答案。','时间O(n·字典转移成本)，空间O(n)。',['mokkori','aabaa','abcddcbabcdcdaadcdcbabcddcb'],lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,15))),lambda:[('a'*5000,'5000'),('ab'*2500,'5000'),('abcdefghijklmnopqrstuvwxyz'*192+'abcdefgh','26'),('z','1')],textline,distinct_pal_oracle,"""def solve(raw):
    s=raw.strip();length=[-1,0];link=[0,0];edge=[{},{}];last=1
    for i,c in enumerate(s):
        p=last
        while i-1-length[p]<0 or s[i-1-length[p]]!=c:p=link[p]
        if c not in edge[p]:
            node=len(length);length.append(length[p]+2);link.append(1);edge.append({});edge[p][c]=node
            if length[node]>1:
                q=link[p]
                while i-1-length[q]<0 or s[i-1-length[q]]!=c:q=link[q]
                link[node]=edge[q][c]
        last=edge[p][c]
    return str(len(length)-2)
""",[('特殊根也计入','len(length)-2','len(length)'),('只统计奇长度回文','return str(len(length)-2)','return str(sum(v>0 and v%2==1 for v in length))')],5001)

def tree_encode(x):return arr(x[0])+seq(x[1])+'\n'
def downward_oracle(x):
    parent,values=x;answer=-10**30
    for end in range(len(parent)):
        u=end;total=0
        while u!=-1:total+=values[u];answer=max(answer,total);u=parent[u]
    return str(answer)
def tree_rand(r):
    n=r.randint(1,15);parent=[-1]+[r.randrange(i) for i in range(1,n)];values=[r.randint(-10,10) for _ in range(n)]
    # Permute nonroot labels; parent indexes need not precede children.
    ids=[0]+r.sample(range(1,n),n-1);p=[0]*n;v=[0]*n
    for i in range(n):p[ids[i]]=ids[parent[i]] if parent[i]>=0 else -1;v[ids[i]]=values[i]
    return p,v
add(5,'任意起点向下路径的最大节点和','树根为0，选择非空路径，只能逐边由父到子向下，起点任意，求最大节点和。不能经过某节点连接两个子树。Fastprep误贴的稳定子段样例不属于本题。','第一行n，第二行n个parent，第三行n个value。完整OCR范围1≤n≤100000，parent[0]=−1，其余0..n−1且为有效树；值−1000..1000，父下标不保证小于子下标。','迭代遍历获取父先于子的序列，逆序求每节点向下最优和：自身值加最大正子路径；答案取所有节点最大。','从u开始的合法路径要么只含u，要么接恰一个子节点的向下路径，故递推枚举所有可能。后序保证子结果已正确，归纳得到各起点最优，取最大即全局非空最优；全负仍返回最大单节点值。','时间O(n)，空间O(n)，不用递归避免深链溢出。',[([-1,0,1,2,0],[5,7,-10,4,15]),([-1,0,1,2,0],[-2,10,10,-3,10]),([-1,0,0],[-5,-2,-3])],tree_rand,lambda:[(([-1]+list(range(99999)),[1000]*100000),'100000000'),(([-1]+list(range(99999)),[-1000]*100000),'-1000'),(([-1]+[0]*99999,[1000]*100000),'2000'),(([-1,2,0],[1,3,2]),'6')],tree_encode,downward_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n=d[0];parent=d[1:n+1];values=d[n+1:];children=[[] for _ in range(n)]
    for i in range(1,n):children[parent[i]].append(i)
    order=[0]
    for u in order:order.extend(children[u])
    best=values[:]
    for u in reversed(order):best[u]=values[u]+max([0]+[best[v] for v in children[u]])
    return str(max(best))
""",[('错误合并全部正子链','max([0]+[best[v] for v in children[u]])','sum(max(0,best[v]) for v in children[u])'),('允许空路径','str(max(best))','str(max(0,max(best)))')],1200030)

def score_oracle(x):
    text,prefix,suffix=x;candidate=[]
    for l in range(len(text)):
        for r in range(l+1,len(text)+1):
            best=0
            for a in range(min(len(prefix),r-l)+1):
                if any(text[l+j]!=prefix[len(prefix)-a+j] for j in range(a)):continue
                for b in range(min(len(suffix),r-l)+1):
                    if all(text[r-b+j]==suffix[j] for j in range(b)):best=max(best,a+b)
            candidate.append((-best,text[l:r]))
    return min(candidate)[1]
def score_rand(r):
    text=''.join(r.choice('abc') for _ in range(r.randint(1,8)))
    return text,''.join(r.choice('abc') for _ in range(r.randint(0,5)))+r.choice(text),''.join(r.choice('abc') for _ in range(r.randint(1,6)))
add(6,'前后缀匹配得分最高的子串','选text的非空子串t。前缀分是t前缀与prefixString后缀最长匹配长度；后缀分是t后缀与suffixString前缀最长匹配长度。总分相加，允许重叠；最高分并列时取字典序最小t。','三行依次text、prefixString、suffixString；完整OCR界各长1..50、仅小写；保证text至少匹配一侧的一个字符。','枚举所有非空候选子串，对每侧枚举不超过候选长度的匹配长度，求最大得分并比较字典序。','每个可能答案均被枚举。候选前后缀的全部合法长度都被逐一检查，取最大值恰为题意两项得分；再以最高分、最小字典序比较全体候选，给出唯一要求结果。不得把候选外字符算入匹配。','最长字符串长度L≤50，时间O(L⁴)，额外空间O(L)，足以覆盖原完整域。',[('engine','raven','ginkgo'),('banana','bana','nana'),('ab','b','a')],score_rand,lambda:[(('a'*50,'a'*50,'a'*50),'a'*50),(('z'*50,'a'*49+'z','z'+'a'*49),'z'),(('ab'*25,'ab'*25,'ab'*25),'ab'*25),(('nothing','bruno','ingenious'),'nothing')],lambda x:'\n'.join(x)+'\n',score_oracle,"""def solve(raw):
    text,prefix,suffix=raw.split();best=(-1,'')
    for l in range(len(text)):
        for r in range(l+1,len(text)+1):
            part=text[l:r];a=b=0
            for k in range(1,min(len(part),len(prefix))+1):
                if part.startswith(prefix[-k:]):a=k
            for k in range(1,min(len(part),len(suffix))+1):
                if part.endswith(suffix[:k]):b=k
            score=a+b
            if score>best[0] or (score==best[0] and part<best[1]):best=(score,part)
    return best[1]
""",[('并列取字典序大者','part<best[1]','part>best[1]'),('忽略后缀分','score=a+b','score=a')],153,output='输出最高分且字典序最小的非空子串。')

def jobs_encode(x):return f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n'
def jobs_oracle(x):
    a,major,minor=x;start=tuple(sorted(a));q=deque([(start,0)]);seen={start}
    while q:
        v,d=q.popleft()
        if not v:return str(d)
        for i in range(len(v)):
            w=tuple(sorted(t-(major if i==j else minor) for j,t in enumerate(v) if t>(major if i==j else minor)))
            if w not in seen:seen.add(w);q.append((w,d+1))
def jobs_rand(r):
    major=r.randint(2,7);return [r.randint(1,12) for _ in range(r.randint(1,5))],major,r.randint(1,major-1)
def jobs_edges(n):
    # n identical jobs: t basic seconds each plus total t extra seconds at x=2,y=1.
    answer=(n*10**9+n)//(n+1)
    return [(([10**9]*n,2,1),str(answer)),(([10**9]*n,10**9,10**9-1),'2'),(([1]*n,2,1),'1'),(([10**9],10**9,1),'1')]
JOBS_CODE="""def solve(raw):
    d=list(map(int,raw.split()));n,x,y=d[:3];a=d[3:];extra=x-y;low=0;high=(max(a)+y-1)//y
    while low<high:
        mid=(low+high)//2;need=0;base=mid*y
        for v in a:
            if v>base:need+=(v-base+extra-1)//extra
            if need>mid:break
        if need<=mid:high=mid
        else:low=mid+1
    return str(low)
"""
for number,n in ((7,100000),(17,300000)):
    add(number,'并行任务池全部完成的最少轮数','每轮选一个未完成任务为主要任务执行x秒，其余未完成任务各执行y秒，y<x。执行量足够的任务立即退出，求清空任务池的最少轮数。','第一行n x y，随后n个执行量。完整原界1≤n≤'+str(n)+'，1≤执行量≤10^9，1≤y<x≤10^9；17号保留原30万界，不沿用7号10万。','二分轮数t，把每任务基础进度视为t·y，不足部分每次主要身份额外贡献x−y，所需主要次数之和≤t即能完成。','t轮内每任务最多获得基础t·y加主要次数乘(x−y)，故所有所需次数之和≤t是必要条件。反之可分配这些主要次数到各轮；若某任务提前完成，其剩余预约改给其他未完成任务只会增加有效进度。到t轮仍未完成者始终获得基础y及所需主要次数，矛盾，故充分。可行性随t单调，二分得到最小。','时间O(n log(max执行量/y+1))，空间O(n)。',[([3,4,1,7,6],4,2),([3,3,6,3,9],3,2),([2,3,5],3,1)],jobs_rand,lambda n=n:jobs_edges(n),jobs_encode,jobs_oracle,JOBS_CODE,[('额外进度错用x','extra=x-y','extra=x'),('向下取整需求','(v-base+extra-1)//extra','(v-base)//extra')],11*n+50)

def earnings_oracle(x):
    s,k,f,b=x;zero=[i for i,c in enumerate(s) if c=='0'];best=0
    for mask in range(1<<len(zero)):
        if mask.bit_count()>k:continue
        a=list(s)
        for i,j in enumerate(zero):
            if mask>>i&1:a[j]='1'
        best=max(best,sum(f+(b if i and a[i-1]=='1' else 0) for i,c in enumerate(a) if c=='1'))
    return str(best)
def earnings_rand(r):
    s=''.join(r.choice('01') for _ in range(r.randint(1,10)));return s,r.randint(1,len(s)),r.randint(1,20),r.randint(1,20)
add(9,'补工作日后的最高工资','工作日赚fixedPay，若前一天也工作则额外赚bonus。最多把k个休息日0改成工作日1，原有工作日不能删除，求最高收入。原样例100101改两天可为111101，旧说明漏了一位，正确收入29。','第一行n k fixedPay bonus，第二行01串；完整OCR界1≤k≤n≤200000，1≤fixedPay,bonus≤10^9。','所有收益正，新增尽可能多工作日；优先填完最短的内部0段以连接工作块，剩余新增日延长已有工作块。全0时新增日排成连续段。','总工资由工作日数及相邻11数量决定。已有工作日时，每新增日至少带来一个相邻11；完整填平一个内部空段可额外增加一个，收益与空段长无关。因此按最短段先填最大化完成段数。未填平的新增日可接在现有块边缘，达到基础收益。全0时k个1的相邻对上界k−1，连续排列可达。','时间O(n log n)，空间O(n)；收入使用64位。',[('10100',2,1,2),('100101',2,4,3),('1111001',1,3,3)],earnings_rand,lambda:[(('0'*200000,200000,10**9,10**9),str(399999*10**9)),(('1'*200000,200000,10**9,10**9),str(399999*10**9)),(('10'*100000,100000,10**9,10**9),str(399999*10**9)),(('0'*200000,1,10**9,10**9),str(10**9))],lambda x:f'{len(x[0])} {x[1]} {x[2]} {x[3]}\n{x[0]}\n',earnings_oracle,"""def solve(raw):
    d=raw.split();n,k,f,b=map(int,d[:4]);s=d[4];ones=s.count('1');add=min(k,n-ones)
    if not ones:return str(add*f+max(0,add-1)*b)
    pairs=sum(s[i-1:i+1]=='11' for i in range(1,n));gaps=[];i=0
    while i<n:
        if s[i]=='1':i+=1;continue
        j=i
        while j<n and s[j]=='0':j+=1
        if i>0 and j<n:gaps.append(j-i)
        i=j
    remain=add;extra=0
    for gap in sorted(gaps):
        if gap>remain:break
        remain-=gap;extra+=1
    return str((ones+add)*f+(pairs+add+extra)*b)
""",[('忽略接通内部段奖金','pairs+add+extra','pairs+add'),('全零也给首日奖金','max(0,add-1)*b','add*b')],200060)

def checksum_oracle(n):return str(sum(i%j+j%i for i in range(1,n+1) for j in range(1,n+1))%1000000007)
def checksum_edge_value(n):
    # Independent quotient-block identity: sum_i i%j = n(n+1)/2 - j*sum_i floor(i/j).
    # Group j with equal n//j; sums of j,j² give an O(sqrt n) oracle.
    result=0;l=1;tri=n*(n+1)//2
    while l<=n:
        q=n//l;r=n//q;c=r-l+1;s1=(l+r)*c//2
        s2=r*(r+1)*(2*r+1)//6-(l-1)*l*(2*l-1)//6
        result+=c*tri-q*(n+1)*s1+q*(q+1)*s2//2;l=r+1
    return str(2*result%1000000007)
add(10,'所有有序包对的校验和','包编号1..n，C(i,j)=i mod j+j mod i，求所有有序对的C之和模1000000007。对角项0不影响是否称不同包。','一行n，完整OCR界1≤n≤1000000。','利用对称性算2倍Σ(i mod j)。固定j，n=qj+r时完整余数周期贡献q·j(j−1)/2，剩余贡献r(r+1)/2。','1..n的余数序列恰有q个完整0..j−1周期及0..r尾段，两项等差和精确；将除数j全枚举得到第一项总和，交换i/j使第二项总和相同，因此乘2并取模。','时间O(n)，额外空间O(1)。',[2,3,4],lambda r:r.randint(1,80),lambda:[(1000000,checksum_edge_value(1000000)),(999983,checksum_edge_value(999983)),(1,'0'),(100003,checksum_edge_value(100003))],lambda n:str(n)+'\n',checksum_oracle,"""def solve(raw):
    n=int(raw);total=0;mod=1000000007
    for j in range(1,n+1):
        q,r=divmod(n,j);total=(total+q*j*(j-1)//2+r*(r+1)//2)%mod
    return str(2*total%mod)
""",[('漏对称另一项','2*total%mod','total%mod'),('漏余数尾端','r*(r+1)//2','r*(r-1)//2')],8)

def team_oracle(x):
    lower,higher=x;n=len(lower);answer=0
    for mask in range(1<<n):
        team=[i for i in range(n) if mask>>i&1]
        if all(j<=lower[i] and len(team)-1-j<=higher[i] for j,i in enumerate(team)):answer=max(answer,len(team))
    return str(answer)
def team_rand(r):
    n=r.randint(1,10);return [r.randrange(n) for _ in range(n)],[r.randrange(n) for _ in range(n)]
def team_edges():
    from array import array
    n=2000000
    yield (array('I',[n-1])*n,array('I',[n-1])*n),str(n)
    yield (array('I',[0])*n,array('I',[0])*n),'1'
    # The lowest-skill member sees all K-1 others above: K <= n/4+1.
    # Any n/4+1 members attain this bound, since both side counts are <= n/4.
    yield (array('I',[n//4])*n,array('I',[n//4])*n),str(n//4+1)
    for size in (4,8,12):
        value=([size//4]*size,[size//4]*size)
        expected=team_oracle(value)
        assert expected==str(size//4+1)
        yield value,expected
    yield ([0],[0]),'1'
add(11,'满足上下技能人数限制的最大团队','第i位开发者技能为i（1基）。若选入，他要求团队中技能更低者最多lower[i]人、更高者最多higher[i]人。求所有人要求均满足的最大团队。','第一行n，第二行lower，第三行higher；0≤数组值<n。原OCR025写n≤200000、026写n≤2000000，本站保留较宽原域1≤n≤2000000，不缩为整理页的20万。','二分团队人数K，从低技能到高技能扫描，已选c人时，若lower≥c且higher≥K−1−c就选此人。使用紧凑32位数组和逐token解析覆盖200万域。','固定K，已选c人时下一个人的合法条件正是所述两不等式。任意可行队伍中第c+1位若晚于当前最早合格者，可用当前人替换；先前与后续成员的相对人数均不变，替换者本人条件满足。所以贪心能找到K人当且仅当可行。删去成员不增加剩余成员两侧人数，可行性向下单调，二分正确。','时间O(n log n)，紧凑数组空间O(n)；输入读取不使用产生百万字符串对象的split。',[([1,3,2,2,2],[2,2,1,1,3]),([0,4,2,3,3],[0,1,3,2,4]),([0,0],[0,0])],team_rand,team_edges,tree_encode,team_oracle,"""from array import array
import re
def solve(raw):
    data=array('I',(int(m[0]) for m in re.finditer(r'\\d+',raw)));n=data[0];lower=data[1:n+1];higher=data[n+1:];del data
    low=1;high=n
    while low<high:
        target=(low+high+1)//2;chosen=0
        for a,b in zip(lower,higher):
            if a>=chosen and b>=target-1-chosen:chosen+=1
            if chosen==target:break
        if chosen==target:low=target
        else:high=target-1
    return str(low)
""",[('上下技能方向颠倒','zip(lower,higher)','zip(higher,lower)'),('漏掉减去自身','target-1-chosen','target-chosen')],32000020,timeLimit=10)

def stable_oracle(a):return str(sum(a[l]==a[r]==sum(a[l+1:r]) for l in range(len(a)) for r in range(l+2,len(a))))
add(12,'端点等于内部总和的稳定子段','长度至少3的连续子段，左右端容量必须相等，并且等于所有内部容量之和。求这样的子段数量。原文capacity[i]依后一句及样例恢复为左端capacity[l]。','第一行n，随后n个capacity；完整原界1≤n≤100000、1≤capacity[i]≤100000。','前缀P[i]为前i项和。扫右端r，将l≤r−2按(a[l],P[l+1]+a[l])计数，查询(a[r],P[r])。','稳定条件等价于a[l]=a[r]且P[r]−P[l+1]=a[l]，移项正是相同二元组键。仅插入l≤r−2确保长度至少3，哈希次数保留所有不同左端，每段在自身右端恰计一次。','时间O(n)，空间O(n)，前缀和使用64位。',[[9,3,3,3,9],[9,3,1,2,3,9,10],[1,1]],lambda r:[r.randint(1,9) for _ in range(r.randint(1,15))],lambda:[([100000]*100000,'99998'),([1]*100000,'99998'),([100000]+[1]*99998+[100000],'99996'),([3,1,2,3],'1')],arr,stable_oracle,"""def solve(raw):
    a=list(map(int,raw.split()))[1:];prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    counts={};answer=0
    for r in range(len(a)):
        l=r-2
        if l>=0:
            key=(a[l],prefix[l+1]+a[l]);counts[key]=counts.get(key,0)+1
        answer+=counts.get((a[r],prefix[r]),0)
    return str(answer)
""",[('内部和错误包括左端','prefix[l+1]+a[l]','prefix[l]+a[l]'),('漏掉长度3','l=r-2','l=r-3')],700020)

def logs_oracle(a):
    target=min(Counter(a).values());answer=0
    for l in range(len(a)):
        for r in range(l+1,len(a)+1):
            if max(Counter(a[l:r]).values())==target:answer=max(answer,r-l)
    return str(answer)
add(13,'最大用户频次符合全局基准的最长日志','全数组出现过的用户中，最少出现次数记为f。求最大连续子数组长度，使其中最高用户出现次数恰为f；不是要求子数组所有用户频次相同。','第一行n，随后用户ID；完整原界1≤n≤300000、1≤ID≤1000000000。','先算f，滑窗保证所有用户次数≤f，另维护次数恰为f的用户数，只在该数非零时更新最长长度。','加入右端只可能让该用户超过f，移动左端直到其≤f后所有计数均≤f。计数达到f的用户数非零恰好保证窗口最大频次等于f。对于每个右端，左指针尽量靠左，任何更短有效窗口不会更优；若最宽窗口无达到f用户，子窗口频次只更小，同样无效。','时间O(n)，空间O(不同用户数)。',[[1,2,1,3,4,2,4,3,3,4],[1,1,1],[1,2,1,3]],lambda r:[r.randint(1,6) for _ in range(r.randint(1,18))],lambda:[([1000000000]*300000,'300000'),(list(range(1,300001)),'300000'),([1]*299999+[2],'2'),([1,2]*150000,'300000')],arr,logs_oracle,"""from collections import Counter
def solve(raw):
    a=list(map(int,raw.split()))[1:];target=min(Counter(a).values());counts={};left=answer=at=0
    for right,v in enumerate(a):
        old=counts.get(v,0)
        if old==target:at-=1
        counts[v]=old+1
        if counts[v]==target:at+=1
        while counts[v]>target:
            u=a[left]
            if counts[u]==target:at-=1
            counts[u]-=1
            if counts[u]==target:at+=1
            left+=1
        if at:answer=max(answer,right-left+1)
    return str(answer)
""",[('全局基准错取最大','target=min(Counter(a).values())','target=max(Counter(a).values())'),('固定不允许重复','target=min(Counter(a).values())','target=1')],3300020)

def lego_oracle(x):
    a,b=x;top=max(sum(a)+a.count(0),sum(b)+b.count(0))+1
    def sums(v):
        possible={0}
        for item in v:
            possible={p+t for p in possible for t in ([item] if item else range(1,top+1)) if p+t<=top}
        return possible
    both=sums(a)&sums(b);return str(min(both) if both else -1)
add(14,'补正整数使两排积木和相等','把两数组中每个0替换为任意正整数，其他值不变，使两边总和相等且最小；无解−1。填入值不受原数组10000上界限制。','第一行n m，第二行rowA，第三行rowB；1≤n,m≤100000，原元素0..10000。','各行用1填0得到最小和；有0的一行可增加到任意更大整数，无0的一行只能固定总和。取两最小和最大值，再检查固定行是否与它相等。','每个0至少1，故计算值是该行下界；若有0，只增其中一个即可达到任意不小于下界的和。若无0则和不可变。两可达集合的最小交集正是候选较大下界，固定行不匹配则交集为空。','时间O(n+m)，除输入外额外空间O(1)。',[([0,2],[3]),([1],[0,0]),([0,0],[0])],lambda r:([r.randint(0,4) for _ in range(r.randint(1,4))],[r.randint(0,4) for _ in range(r.randint(1,4))]),lambda:[(([10000]*100000,[0]),'1000000000'),(([0]*100000,[0]*100000),'100000'),(([1]*100000,[0]*99999),'100000'),(([10000]*100000,[9999]*100000),'-1')],lambda x:f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',lego_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];b=d[2+n:];za=a.count(0);zb=b.count(0);sa=sum(a)+za;sb=sum(b)+zb;target=max(sa,sb)
    if (not za and sa!=target) or (not zb and sb!=target):return '-1'
    return str(target)
""",[('允许0填0','sa=sum(a)+za;sb=sum(b)+zb','sa=sum(a);sb=sum(b)'),('忽略固定行限制',"if (not za and sa!=target) or (not zb and sb!=target):return '-1'","if False:return '-1'")],1200030)

def throughput_oracle(x):
    a,c,budget=x;best=0
    for scales in product(*(range(budget//cost+1) for cost in c)):
        if sum(v*w for v,w in zip(scales,c))<=budget:best=max(best,min(v*(1+k) for v,k in zip(a,scales)))
    return str(best)
def throughput_rand(r):
    n=r.randint(1,4);return [r.randint(1,8) for _ in range(n)],[r.randint(1,8) for _ in range(n)],r.randint(0,12)
add(16,'预算内扩容串联服务的最大吞吐','n个服务串联，总吞吐为各服务吞吐最小值。服务i每扩容一次花cost[i]，扩容x次后吞吐为throughput[i]·(1+x)，求预算内最大总吞吐。原式(i+x)与初始吞吐定义冲突，两个原例也只有(1+x)同时得到10、9，按此证据恢复笔误。','第一行n budget，第二行throughput，第三行cost。原文无数值界，本站1≤n≤100000、1≤吞吐及单次成本≤10^9、0≤budget≤10^12。答案和中间乘积可超过64位，须用精确整数或128位。','二分目标T，每服务最少扩容max(0,ceil(T/a)−1)次，按成本求和判断是否超预算。上界是所有单服务独占预算时吞吐的最小值。','要使瓶颈不低于T，每项都须达到T，所需最少扩容次数由不等式a(1+x)≥T直接得到。服务独立，所以最小成本是各项之和；在预算内当且仅当目标可行。成本随T单调，上界不低于任一可行目标，二分取得最大可行值。','时间O(n log上界)，空间O(n)；超过预算时提前停止。',[([4,2,7],[3,5,6],32),([7,3,4,6],[2,5,4,3],25),([3],[2],0)],throughput_rand,lambda:[(([10**9]*100000,[1]*100000,10**12),str(10**9*(1+10**7))),(([10**9],[1],10**12),str(10**9*(1+10**12))),(([1]*100000,[10**9]*100000,10**12),'1'),(([1,10**9],[1,10**9],0),'1')],lambda x:f'{len(x[0])} {x[2]}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',throughput_oracle,"""def solve(raw):
    d=list(map(int,raw.split()));n,budget=d[:2];a=d[2:2+n];cost=d[2+n:];low=min(a);high=min(v*(budget//c+1) for v,c in zip(a,cost))
    while low<high:
        target=(low+high+1)//2;spent=0
        for v,c in zip(a,cost):
            spent+=max(0,(target+v-1)//v-1)*c
            if spent>budget:break
        if spent<=budget:low=target
        else:high=target-1
    return str(low)
""",[('扩容次数漏减初始一份','(target+v-1)//v-1','(target+v-1)//v'),('边界预算误拒绝','if spent<=budget:low=target','if spent<budget:low=target')],2200050,timeLimit=10)

def target_encode(x):return f'{len(x[0])} {x[1]}\n'+seq('null' if v is None else v for v in x[0])+'\n'
def target_oracle(x):
    tokens,target=x
    if not tokens or tokens[0] is None:return '0\n'
    # Construct nested nodes with a pending-child queue, then enumerate copied paths.
    root=[tokens[0],None,None];q=deque([root]);i=1
    while q and i<len(tokens):
        node=q.popleft()
        for side in (1,2):
            if i==len(tokens):break
            value=tokens[i];i+=1
            if value is not None:node[side]=[value,None,None];q.append(node[side])
    result=[];stack=[(root,[])]
    while stack:
        node,path=stack.pop();path=path+[node[0]]
        if node[1] is None and node[2] is None and sum(path)==target:result.append(path)
        for child in node[1:]:
            if child is not None:stack.append((child,path))
    return vec(min(result,key=lambda p:(len(p),p))) if result else '0\n'
def target_rand(r):
    n=r.randint(0,20)
    if not n:return [],r.randint(-10,10)
    values=[r.randint(-5,5) for _ in range(n)];children=[[] for _ in range(n)]
    available=[0]
    for i in range(1,n):
        parent=r.choice(available);children[parent].append(i)
        if len(children[parent])==2:available.remove(parent)
        available.append(i)
    tokens=[];q=deque([0])
    while q:
        u=q.popleft()
        if u is None:tokens.append(None);continue
        tokens.append(values[u]);kids=children[u]+[None]*(2-len(children[u]));r.shuffle(kids);q.extend(kids)
    while tokens and tokens[-1] is None:tokens.pop()
    return tokens,r.randint(-10,10)
def target_edges():
    # 100000-node one-sided chain, no recursive call stack.
    tokens=[10**9]
    for _ in range(99999):tokens.extend((10**9,None))
    yield (tokens,10**14),vec([10**9]*100000)
    yield ([-10**9]+[value for _ in range(99999) for value in (-10**9,None)],-10**14),vec([-10**9]*100000)
    yield ([0]*65535,0),vec([0]*16)
    yield ([],0),'0\n'
add(20,'和为目标值的最短根到叶路径','在二叉树所有和等于target的根到叶路径中，先选节点数最少者，再选节点值序列字典序最小者。无解输出空数组。','第一行层序token数m及target，第二行m个整数或null。按非空父节点的左右孩子队列依次解释，允许省略末尾null，不使用完整堆下标。原文没有数值界，本站节点数0..100000，0≤m≤200001，节点值±10^9、target±10^14；保证有效层序，无树可用m=0或单个null。','BFS逐层计算根路径和；同层路径用(parent路径rank,本节点值)排序压缩字典序rank。首次有合格叶的层中选rank最小者，沿父指针还原。','BFS层数就是路径长度，首次有合格叶时更深路径必不优。同层等长路径的字典序先比较父路径、相同时比较末值，因此用父rank和值得到的新rank保持准确排序，重复路径同rank。选择最小rank给出二级最优；父指针还原原路径。','时间O(n log n)，空间O(n)，不复制所有深路径、不递归。',[([5,4,8,11,None,13,4,7,2,None,None,5,1],22),([1,2,3],5),([0,2,1,-2,None,None,-1],0)],target_rand,target_edges,target_encode,target_oracle,"""def solve(raw):
    d=raw.split();m=int(d[0]);target=int(d[1]);tokens=d[2:]
    if not m or tokens[0]=='null':return '0\\n'
    values=[int(tokens[0])];parent=[-1];children=[[]];q=0;i=1
    while q<len(values) and i<m:
        for side in range(2):
            if i==m:break
            token=tokens[i];i+=1
            if token!='null':
                v=len(values);values.append(int(token));parent.append(q);children.append([]);children[q].append(v)
        q+=1
    n=len(values);rank=[0]*n;sums=[0]*n;sums[0]=values[0];layer=[0]
    while layer:
        valid=[u for u in layer if not children[u] and sums[u]==target]
        if valid:
            u=min(valid,key=lambda u:rank[u]);path=[]
            while u!=-1:path.append(values[u]);u=parent[u]
            path.reverse();return str(len(path))+'\\n'+' '.join(map(str,path))
        following=[]
        for u in layer:
            for v in children[u]:sums[v]=sums[u]+values[v];following.append(v)
        following.sort(key=lambda v:(rank[parent[v]],values[v]));last=None;r=-1
        for v in following:
            key=(rank[parent[v]],values[v])
            if key!=last:r+=1;last=key
            rank[v]=r
        layer=following
    return '0\\n'
""",[('并列取字典序最大','u=min(valid,key=lambda u:rank[u])','u=max(valid,key=lambda u:rank[u])'),('内部节点也当叶','if not children[u] and sums[u]==target','if sums[u]==target')],2500050,output='第一行路径节点数，第二行路径数值；无解仅输出0。')

def pal_count_oracle(s):return str(sum(s[i:j]==s[i:j][::-1] for i in range(len(s)) for j in range(i+1,len(s)+1)))
add(21,'按出现位置计数的回文子串','统计所有回文子串，相同文本出现在不同位置要分别计数。原正文截断，但aaa→6及列举明确此规则，与4号不同文本计数不同。','一行小写串，原完整界1≤长度≤1000。','枚举每个字符中心和相邻字符间中心，向两边同步扩展，每次匹配贡献一个回文。','每个回文都有唯一中心和半径；扩展恰在两边字符相等时得到一个新回文，遇不相等或边界后不能再扩展。枚举全部奇偶中心覆盖所有子串且不重复。','时间O(n²)，额外空间O(1)。',['abc','aaa','abba'],lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,20))),lambda:[('a'*1000,'500500'),('ab'*500,'250500'),('abcdefghijklmnopqrstuvwxyz'*38+'abcdefghijkl','1000'),('z','1')],textline,pal_count_oracle,"""def solve(raw):
    s=raw.strip();answer=0
    for center in range(2*len(s)-1):
        left=center//2;right=(center+1)//2
        while left>=0 and right<len(s) and s[left]==s[right]:answer+=1;left-=1;right+=1
    return str(answer)
""",[('遗漏偶数中心','range(2*len(s)-1)','range(0,2*len(s)-1,2)'),('只计长度1','return str(answer)','return str(len(s))')],1001)

BLOCKED={8:'原OCR有仅值<n−1才可递增的限制，另有one time/任意多次矛盾以及百万/十万界冲突，不能采用catalog无界增长。',19:'唯一样例含大写I，原文仅定义a-z循环，未给大小写域及转换规则，原答案作者亦声明猜测，不擅自改I为l。',22:'价格约束乱码、缺精度和重名/未知商品保证、无样例，不能自行限定两位小数和唯一合法商品规避核心缺规。'}
OCR='OA LIST/Citadel_OA/'
def pictures(*nums):return [OCR+f'{n:03d}_image.txt' for n in nums]
QQ={18:'018_QQ_1746308271605.txt',19:'019_QQ_1746308304900.txt',20:'020_QQ_1746308331398.txt',21:'021_QQ_1746308377508.txt',22:'022_QQ_1746308408482.txt',23:'023_QQ_1746308443031.txt'}
def fast(name):return 'fastprep/Citadel/citadel-'+name+'.md'
EVIDENCE={1:pictures(1,2),2:pictures(3,4,5)+[fast('get-recommended-friends')],3:pictures(6,7),4:pictures(14,15,16,17),5:[OCR+QQ[i] for i in (18,19,20)]+[fast('best-sum-downward-tree-path')],6:pictures(9,10,11,12),7:[OCR+QQ[i] for i in (21,22,23)]+[fast('get-minimum-operations')],8:pictures(29,30,31,32,33),9:pictures(34,35,36,37),10:pictures(38,39,40,41,42),11:pictures(24,25,26,27,28),12:[fast('count-stable-segments')],13:[fast('find-consistent-logs')],14:[fast('find-minimum-equal-sum')],15:[fast('get-distinct-goodness-values'),fast('get-good-value')]+pictures(1,2),16:[fast('get-max-throughput')],17:[fast('get-min-operations')],18:[fast('get-recommended-friends')]+pictures(3,4,5),19:[fast('maximize-the-lottery-id')],20:[fast('minimum-path-sum-to-target-in-binary-tree')],21:[fast('palindromic-substrings')],22:[fast('price-check')]}
def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(a,b):return a.split()==b.split()
def small_check():
    for s in sorted(SPECS,key=lambda s:s['n']):
        rng=random.Random(20267600+s['n']);values=s['samples']+[s['rnd'](rng) for _ in range(160)];scope={};exec(s['code'],scope)
        cases=[(s['encode'](v),s['oracle'](v)) for v in values]
        for raw,expected in cases:assert equal(scope['solve'](raw),expected),(s['n'],raw,expected,scope['solve'](raw))
        for name,old,new in s['mutants']:
            assert old in s['code'],(s['n'],name);mut={};exec(s['code'].replace(old,new),mut)
            assert any(not equal(mut['solve'](raw),expected) for raw,expected in cases),(s['n'],name)
        print(s['n'],'163 independent small oracles; 2 normal-return WA passed',flush=True)
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
    for s in sorted(SPECS,key=lambda s:s['n']):
        number=s['n'];ident=f'oa-citadel-{number}'
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(20267600+number)
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
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Citadel'],description=s['desc']+'\n\n输入输出协议由本站整理；缺失数值界和来源笔误恢复均已明示。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        assert len(normalized.encode())<=128*1024*1024,(ident,'package exceeds128MiB')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20267600,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del actual,outputs,cases,tests,boundary,oracles,normalized,p
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,paths in EVIDENCE.items():
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=f'oa-citadel-{number}';reason=BLOCKED[number] if number in BLOCKED else next(s['desc'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
