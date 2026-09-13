"""Microsoft 21–40: independently authored references and exhaustive small oracles."""
import collections
import functools
import hashlib
import itertools
import json
import math
from pathlib import Path
import random
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge';BATCH='microsoft-next';SPECS=[]
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def add(n,title,desc,fmt,idea,proof,complexity,samples,notes,random_case,encode,oracle,code,mutants,edges,**extra):
    SPECS.append(dict(id=n,title=title,desc=desc,input=fmt,idea=idea,proof=proof,complexity=complexity,samples=samples,notes=notes,random=random_case,encode=encode,oracle=oracle,code=code,mutants=mutants,edges=edges,**extra))

def uniqueness(a):
    values=sorted(len(set(a[i:j])) for i in range(len(a)) for j in range(i+1,len(a)+1))
    return values[(len(values)-1)//2]
add(21,'所有子数组不同值数量的中位数','将每个非空连续子数组的不同值数量排序，返回中位数；长度为偶数时取中间较小者。',
'第一行n（1..100000），第二行n个整数（1..10⁹）。','二分答案k，用滑动窗口统计不同值至多k的子数组数量，判断是否达到下中位数排名。','不同值至多k的窗口可用单调左端维护，每个右端贡献窗口长度。计数随k不减；第一个计数达到目标排名的k恰为所求顺序统计量。',
'时间O(n log n)，空间O(n)。',[[1,2,1],[1,2,3],[7,7]],['六个数量排序为1、1、1、2、2、2，取第三个1。','六个数量排序为1、1、1、2、2、3，答案1。','所有子数组只有一种值，答案1。'],lambda r:[r.randint(1,6) for _ in range(r.randint(1,12))],arr,uniqueness,
'''def solve(d):
    a=list(map(int,d[1:]));n=len(a);rank=(n*(n+1)//2+1)//2;lo=1;hi=len(set(a))
    while lo<hi:
        k=(lo+hi)//2;counts={};left=total=0
        for right,value in enumerate(a):
            counts[value]=counts.get(value,0)+1
            while len(counts)>k:
                old=a[left];counts[old]-=1;left+=1
                if counts[old]==0:del counts[old]
            total+=right-left+1
        if total>=rank:hi=k
        else:lo=k+1
    return str(lo)
''',[('偶数取上中位数','(n*(n+1)//2+1)//2','n*(n+1)//4+1'),('只看整个数组','return str(lo)','return str(len(set(a)))')],[([1]*100000,1),(list(range(1,100001)),29290)])

def symmetric_oracle(board):
    n=len(board);m=len(board[0]);best=n*m
    for bits in itertools.product('BW',repeat=n*m):
        if all(bits[i*m+j]==bits[i*m+m-1-j]==bits[(n-1-i)*m+j] for i in range(n) for j in range(m)):
            best=min(best,sum(bits[i*m+j]!=board[i][j] for i in range(n) for j in range(m)))
    return best
add(23,'翻转格子使所有行列回文','每次翻转一个B/W格子，使每一行和每一列正反相同，求最少翻转。统一以大写B/W输入。',
'本站范围：第一行N M（1..500），随后N行各M个B/W字符。','每个格子与水平、垂直镜像属于同一组；每组全部变B或全部变W，选较少的一色翻转。','行列回文等价于每个镜像等价类内颜色相同。等价类互不相交，组内两种目标的费用分别是B数量和W数量，独立取小的和即最优。',
'时间O(NM)，额外空间O(1)。',[['BW'],['BW','WB'],['BWB','WWW','BWB']],['两格必须一致，翻转任一格，答案1。','四个角属于同一组，两B两W，最少翻2格。','所有行列本来就回文，答案0。'],lambda r:[''.join(r.choice('BW') for _ in range(3)) for _ in range(r.randint(1,3))],lambda b:f'{len(b)} {len(b[0])}\n'+'\n'.join(b)+'\n',symmetric_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);answer=0
    for i in range((n+1)//2):
        for j in range((m+1)//2):
            cells={(i,j),(n-1-i,j),(i,m-1-j),(n-1-i,m-1-j)};black=sum(d[2+a][b]=='B' for a,b in cells)
            answer+=min(black,len(cells)-black)
    return str(answer)
''',[('总改成白色','min(black,len(cells)-black)','black'),('错误遗漏中间行列','range((n+1)//2)','range(n//2)')],[(['BW'*250 for _ in range(500)],125000),(['B'*500 for _ in range(500)],0)])

add(26,'删除一个字符后的字典序最小串','恰好删除小写串中的一个字符，返回字典序最小的剩余字符串。',
'一行2..100000个小写字母。','删除第一个严格大于后一个字符的位置；如果不存在下降，删除末位。','首个下降之前的字符非降，删除更早位置不会优于保留较小的当前字符；在首个下降处删除使第一个不同位置变小。没有下降时保留最长前缀并删末位最优。',
'时间O(N)，输出空间O(N)。',['acb','hot','aaaa'],['删除c得到ab，比ac和cb更小。','原串非降，删末尾t得到ho。','删除任何a都得到aaa。'],lambda r:''.join(r.choice('abcd') for _ in range(r.randint(2,12))),lambda s:s+'\n',lambda s:min(s[:i]+s[i+1:] for i in range(len(s))),
'''def solve(d):
    s=d[0];cut=len(s)-1
    for i in range(len(s)-1):
        if s[i]>s[i+1]:cut=i;break
    return s[:cut]+s[cut+1:]
''',[('总删末位','return s[:cut]+s[cut+1:]','return s[:-1]'),('相等也提前删除','s[i]>s[i+1]','s[i]>=s[i+1]')],[('a'*100000,'a'*99999),('z'+'a'*99999,'a'*99999)])

def or_max_oracle(x):
    a,k=x
    def visit(i,left,value):
        if i==len(a):return value
        return max(visit(i+1,left-used,value|(a[i]<<used)) for used in range(left+1))
    return visit(0,k,0)
add(27,'最多翻倍K次后的最大按位或','每次选择一个数组元素乘2，最多K次，最大化所有元素按位或。来源前段资源迁移内容与明确函数和样例无关，本站仅实现翻倍规则。',
'本站范围：第一行n K（1≤n≤100000，0≤K≤30），第二行n个非负整数（0..10⁹）。','所有翻倍集中到某一个元素；前缀和后缀OR使每个候选的剩余元素OR可常数时间取得。','设最优分配中最终最高非零位属于x。把其它元素所用次数转给x：若确有转移，x的最高位严格升高，超过原答案所有位，结果更大。因此存在全部次数作用于一个元素的最优解。全零时结论也成立。',
'时间O(n)，空间O(n)。',[([12,9],1),([1,2],0),([0,0],3)],['翻倍9后12 OR 18=30，优于翻倍12的25。','不能操作，1 OR 2=3。','零翻倍仍为零，答案0。'],lambda r:([r.randint(0,15) for _ in range(r.randint(1,5))],r.randint(0,4)),lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',or_max_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));suffix=[0]*(n+1)
    for i in range(n-1,-1,-1):suffix[i]=suffix[i+1]|a[i]
    prefix=answer=0
    for i,value in enumerate(a):answer=max(answer,prefix|(value<<k)|suffix[i+1]);prefix|=value
    return str(answer)
''',[('只翻倍第一项','for i,value in enumerate(a):answer=max','for i,value in list(enumerate(a))[:1]:answer=max'),('倍数误作加法','value<<k','value+k')],[(([10**9]*100000,30),(10**9<<30)|10**9),(([0]*100000,30),0)])

def lectures_oracle(x):
    board,k=x;positions=[(i,j) for i,row in enumerate(board) for j,c in enumerate(row) if c=='1'];best=10**9
    for mask in range(1<<len(positions)):
        if mask.bit_count()>k:continue
        days=collections.defaultdict(list)
        for index,(i,j) in enumerate(positions):
            if not(mask>>index&1):days[i].append(j)
        best=min(best,sum(max(v)-min(v)+1 for v in days.values()))
    return best
add(28,'跳过至多K节课的最少在校时间','一天在校时间为当天最早与最晚所上课的小时差加1，不上课为0。总共可跳过至多K节，求各天在校时间之和最小值。',
'第一行N M K（均1..200），随后N行长度M的01串。','每一天枚举跳过数量，对剩余连续的一段课程索引求最短覆盖宽度；再按天做跳课预算背包。','固定保留课程数时，若首末之间跳过了课，可用中间课替换外部课而不扩大跨度，因此只需连续课程索引块。各天费用独立，通过预算分配DP枚举全部跳课方案。',
'时间O(NM²+NK²)，空间O(K+M)。',[(['10001'],1),(['11','01'],1),(['000'],1)],['跳过任一节，只上另一节，在校1小时。','跳过第二天唯一一节，第一天上2小时，总共2。','没有课，无需到校，答案0。'],lambda r:([''.join(r.choice('01') for _ in range(3)) for _ in range(2)],r.randint(1,5)),lambda x:f'{len(x[0])} {len(x[0][0])} {x[1]}\n'+'\n'.join(x[0])+'\n',lectures_oracle,
'''def solve(d):
    from itertools import islice
    n,m,k=map(int,d[:3]);dp=[0]+[10**9]*k
    for row in islice(d,3,None):
        pos=[i for i,c in enumerate(row) if c=='1'];count=len(pos);cost=[]
        for skip in range(min(k,count)+1):
            keep=count-skip;cost.append(0 if keep==0 else min(pos[i+keep-1]-pos[i]+1 for i in range(skip+1)))
        new=[10**9]*(k+1)
        for used in range(k+1):
            for skip,value in enumerate(cost[:k-used+1]):new[used+skip]=min(new[used+skip],dp[used]+value)
        dp=new
    return str(min(dp))
''',[('不允许跳过全部课程','0 if keep==0','1 if keep==0'),('覆盖宽度漏加1','pos[i+keep-1]-pos[i]+1','pos[i+keep-1]-pos[i]')],[((['1'*200]*200,200),39800),((['0'*200]*200,200),0)],time_limit=8)

MOD=1000000007
def great_oracle(x):
    a,queries=x;a=a[:];answer=0
    for i,value in queries:
        a[i]=value;count=0
        for mask in range(1,1<<len(a)):
            divisor=0
            for j,v in enumerate(a):
                if mask>>j&1:divisor=math.gcd(divisor,v)
            count+=divisor>1
        answer+=count%MOD
    return answer
def great_input(x):
    a,q=x;return f'{len(a)} {len(q)}\n'+' '.join(map(str,a))+'\n'+''.join(f'{i+1} {v}\n' for i,v in q)
add(29,'动态替换后的好子序列数量总和','非空子序列的所有元素GCD大于1称为好子序列。逐次执行单点替换，每次将好子序列数对10⁹+7取模，最后把这些取模后的计数直接相加；最终和不再取模。下标不同的选择分别计数。',
'第一行N Q（1..100000），第二行N个A值（1..100000）；随后Q行X Y，1≤X≤N，1≤Y≤100000。','按质因数容斥：每个平方自由因子d>1贡献−μ(d)(2^count[d]−1)。更新仅改变旧值、新值的这些因子计数。预处理最小质因子与2的幂。','一个子序列若共同质因数集合非空，容斥的非空质因数组合系数和为1，否则为0；因此贡献之和恰好统计GCD大于1的子序列。单点更新只有能整除被替换值的因子受影响，逐项删旧加新保持不变量。',
'时间O(V log V+(N+Q)·2^ω)，空间O(V+N+Q)，V≤100000且ω≤6。',[([1,2],[(0,2)]),([1,2,3],[(0,3),(1,3)]),([2,2,2,2,2],[(0,1),(1,1)])],['变为2、2，两个单元素与双元素都合法，共3。','两次替换后分别有4和7个好子序列，总和11。','两次剩4个2和3个2，分别15与7，总和22。'],lambda r:(lambda n:([r.randint(1,30) for _ in range(n)],[(r.randrange(n),r.randint(1,30)) for _ in range(r.randint(1,6))]))(r.randint(1,8)),great_input,great_oracle,
'''def solve(d):
    from collections import Counter
    from functools import lru_cache
    MOD=1000000007;n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));raw=list(map(int,d[2+n:]));limit=max(a+raw[1::2]);spf=list(range(limit+1))
    for p in range(2,math.isqrt(limit)+1):
        if spf[p]==p:
            for v in range(p*p,limit+1,p):
                if spf[v]==v:spf[v]=p
    radical=[1]*(limit+1)
    for value in range(2,limit+1):
        p=spf[value];quotient=value//p;radical[value]=radical[quotient]*(1 if quotient%p==0 else p)
    @lru_cache(maxsize=1024)
    def factors(value):
        primes=[]
        while value>1:
            p=spf[value];primes.append(p)
            while value%p==0:value//=p
        terms=[(1,1)]
        for p in primes:terms.extend([(v*p,-sign) for v,sign in terms])
        return tuple(terms[1:])
    powers=[1]*(n+1)
    for i in range(n):powers[i+1]=powers[i]*2%MOD
    counts=[0]*(limit+1)
    for value,frequency in Counter(a).items():
        for divisor,sign in factors(radical[value]):counts[divisor]+=frequency
    current=0
    for divisor in range(2,limit+1):
        if counts[divisor]:
            terms=factors(divisor)
            if terms and terms[-1][0]==divisor:current-=terms[-1][1]*(powers[counts[divisor]]-1)
    current%=MOD;answer=0
    for i in range(0,len(raw),2):
        index,value=raw[i]-1,raw[i+1];old=a[index]
        if radical[old]!=radical[value]:
            for number,delta in ((old,-1),(value,1)):
                for divisor,sign in factors(radical[number]):
                    current+=sign*(powers[counts[divisor]]-1);counts[divisor]+=delta;current-=sign*(powers[counts[divisor]]-1)
            current%=MOD
        a[index]=value
        answer+=current
    return str(answer)
''',[('最终和错误再次取模','return str(answer)','return str(answer%MOD)'),('每次漏计一个子序列','answer+=current','answer+=current-1')],[(([30030]*100000,[(i,1) for i in range(100000)]),sum((pow(2,r,MOD)-1)%MOD for r in range(100000))),(([100000]*100000,[(0,100000)]),(pow(2,100000,MOD)-1)%MOD),(([30030]*100000,[(i,60060) for i in range(100000)]),100000*((pow(2,100000,MOD)-1)%MOD)),(([30030]*100000,[(i,39270) for i in range(100000)]),100000*((pow(2,100000,MOD)-1)%MOD))],imports='import math\n',time_limit=10)

def waiting_oracle(a):
    queue=collections.deque(a);elapsed=answer=0
    while queue:
        remaining=queue.popleft()-1;elapsed+=1
        if remaining:queue.append(remaining)
        else:answer+=elapsed
    return answer%10**9
add(30,'轮转制作订单的总等待时间','员工每次为队首订单工作1小时，完成则交付，否则放到队尾。统计每个客户从开始到收到订单的等待时间之和，对10⁹取模。',
'第一行N（1..100000），第二行N个制作时间（1..10000）。','订单i完成前共经历T[i]−1整轮，贡献Σmin(T[j],T[i]−1)，再加本轮在i之前且还未完成的订单数。排序前缀和求前半项，树状数组统计后半项。','在前T[i]−1轮，每个订单恰消耗min(T[j],T[i]−1)小时；最后一轮原顺序不变，只处理下标≤i且T[j]≥T[i]者。这两部分不重不漏，累加各完成时间即得总等待。',
'时间O(N log N+N log V)，空间O(N+V)，V≤10000。',[[3,1,2],[1,2,3,4],[7,7,7]],['完成时刻分别6、2、5，总和13。','完成时刻分别1、5、8、10，总和24。','经过6整轮18小时后，依次在19、20、21小时完成，总和60。'],lambda r:[r.randint(1,8) for _ in range(r.randint(1,10))],arr,waiting_oracle,
'''def solve(d):
    from bisect import bisect_left
    a=list(map(int,d[1:]));ordered=sorted(a);prefix=[0]
    for value in ordered:prefix.append(prefix[-1]+value)
    bit=[0]*(max(a)+1);answer=0
    for i,value in enumerate(a):
        index=value
        while index<len(bit):bit[index]+=1;index+=index&-index
        less=0;index=value-1
        while index:less+=bit[index];index-=index&-index
        split=bisect_left(ordered,value);before=prefix[split]+(len(a)-split)*(value-1)
        answer+=before+i+1-less
    return str(answer%1000000000)
''',[('漏掉当前订单最后一小时','before+i+1-less','before+i-less'),('模数写成10亿加7','1000000000','1000000007')],[([10000]*100000,(100000*9999*100000+100000*100001//2)%10**9),([1]*100000,50000)])

def queue_oracle(ops):
    queue=collections.deque();out=[]
    for op in ops:
        if op[0]=='push':queue.append(op[1]);out.append('null')
        elif op[0]=='pop':out.append(str(queue.popleft()))
        elif op[0]=='peek':out.append(str(queue[0]))
        else:out.append('true' if not queue else 'false')
    return ' '.join(out)
def queue_random(r):
    ops=[];size=0
    for _ in range(r.randint(1,30)):
        name=r.choice(['push','empty']+(['pop','peek'] if size else []))
        ops.append((name,r.randint(1,9)) if name=='push' else (name,));size+=1 if name=='push' else -1 if name=='pop' else 0
    return ops
add(31,'用两个栈实现先进先出队列','队列初始为空，仅使用两个栈实现push、pop、peek、empty。每次操作输出其返回值，push输出null；本站不另计构造函数输出。评测检查行为，栈使用限制请在实现中遵守。',
'第一行操作数Q（1..100），随后Q行：push x（1..9）、pop、peek或empty；pop和peek保证队列非空。','入队栈记录新元素，出队栈为空时把入队栈全部倒入，出队和查看操作出队栈顶。','倒栈把最近入队的顺序反转，最早元素成为出队栈顶。只在出队栈空时倒入保证旧元素始终先于新元素，每个元素最多搬运一次。',
'均摊每操作O(1)，空间O(Q)。',[[('push',1),('push',2),('peek',),('pop',),('empty',)],[('empty',)],[('push',9),('pop',),('empty',)]],['依次返回null、null、1、1、false，最后队列还剩2。','初始队列为空，返回true。','入队9后取出9，最后为空，返回null、9、true。'],queue_random,lambda ops:str(len(ops))+'\n'+''.join(' '.join(map(str,op))+'\n' for op in ops),queue_oracle,
'''def solve(d):
    incoming=[];outgoing=[];out=[];i=1
    while i<len(d):
        op=d[i];i+=1
        if op=='push':incoming.append(d[i]);i+=1;out.append('null')
        elif op=='empty':out.append('true' if not incoming and not outgoing else 'false')
        else:
            if not outgoing:
                while incoming:outgoing.append(incoming.pop())
            out.append(outgoing.pop() if op=='pop' else outgoing[-1])
    return ' '.join(out)
''',[('入队错误反向','incoming.append(d[i])','incoming.insert(0,d[i])'),('空状态颠倒',"'true' if not incoming and not outgoing else 'false'","'false' if not incoming and not outgoing else 'true'")],[([('push',i%9+1) for i in range(50)]+[('pop',) for _ in range(50)],' '.join(['null']*50+[str(i%9+1) for i in range(50)]))],output='一行输出Q个返回值，以空格分隔，使用null、true、false或整数。')

def matrix(a):return f'{len(a)} {len(a[0])}\n'+''.join(' '.join(map(str,row))+'\n' for row in a)
def island_oracle(board):
    edges=set()
    for i,row in enumerate(board):
        for j,v in enumerate(row):
            if v:
                for edge in (((i,j),(i,j+1)),((i+1,j),(i+1,j+1)),((i,j),(i+1,j)),((i,j+1),(i+1,j+1))):
                    if edge in edges:edges.remove(edge)
                    else:edges.add(edge)
    return len(edges)
def island_random(r):
    widths=sorted([r.randint(1,5) for _ in range(r.randint(1,5))],reverse=True)
    return [[int(j<w) for j in range(5)] for w in widths]
add(33,'单个岛屿的周长','0为水、1为陆地，陆地四邻接构成恰好一个无湖泊岛屿，外围是水。每格边长1，求岛屿周长。',
'第一行N M（1..100），随后N行各M个0/1。保证恰好一个岛屿且没有内湖。','每个陆地先贡献4，每条与上方或左方陆地共享的边减2。','单格四边中，每条内部共享边被两格重复统计且不属于外周，所以应减2。只向上向左检查恰将每条共享边处理一次。',
'时间O(NM)，空间O(NM)存储输入。',[[[1]],[[1,1],[1,1]],[[1,0],[1,1]]],['单格四条边，周长4。','2×2实心正方形每边长2，周长8。','三个格贡献12，扣掉两条共享边的4，周长8。'],island_random,matrix,island_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:]));answer=0
    for i in range(n):
        for j in range(m):
            if a[i*m+j]:
                answer+=4
                if i and a[(i-1)*m+j]:answer-=2
                if j and a[i*m+j-1]:answer-=2
    return str(answer)
''',[('共享边只减1','answer-=2','answer-=1'),('遗漏横向共享边','if j and a[i*m+j-1]:','if False:')],[([[1]*100 for _ in range(100)],400),([[int(i%2==0 or j==(99 if i%4==1 else 0)) for j in range(100)] for i in range(100)],10102)])

def path_oracle(x):
    p,s=x;graph=[[] for _ in p]
    for i,parent in enumerate(p):
        if parent>=0 and s[i]!=s[parent]:graph[i].append(parent);graph[parent].append(i)
    best=1
    for start in range(len(p)):
        stack=[(start,-1,1)]
        while stack:
            u,parent,length=stack.pop();best=max(best,length)
            stack.extend((v,u,length+1) for v in graph[u] if v!=parent)
    return best
add(34,'树上相邻字符不同的最长路径','根为0的树，每个节点带小写字母。返回任意简单路径的最大节点数，要求每对相邻节点字符不同。',
'本站范围：第一行N（1..100000），第二行N个parent（parent[0]=−1，其余为0-based父编号），第三行N个小写字母。保证为合法树。','自底向上求每个节点向下合法链长，选择可以连接的两个最长子链更新答案。','路径的最高节点唯一，其余部分最多分属两个子树。相同字母边不能连接，选不同字母子链中的最长两条即可得到经过该最高点的最优路径，枚举全部节点覆盖全局最优。',
'时间O(N)，空间O(N)。',[([-1,0,0,1,1,2],'abacbe'),([-1,0,0,0],'aabc'),([-1],'z')],['0—1—3字符a、b、c不同，最长3。','2—0—3的b、a、c构成长度3。','仅一个节点，答案1。'],lambda r:(lambda n:([-1]+[r.randrange(i) for i in range(1,n)],''.join(r.choice('abcd') for _ in range(n))))(r.randint(1,12)),lambda x:arr(x[0])+x[1]+'\n',path_oracle,
'''def solve(d):
    n=int(d[0]);parents=list(map(int,d[1:n+1]));s=d[n+1];children=[[] for _ in range(n)]
    for i in range(1,n):children[parents[i]].append(i)
    order=[0]
    for u in order:order.extend(children[u])
    down=[1]*n;best=1
    for u in reversed(order):
        first=second=0
        for v in children[u]:
            if s[u]==s[v]:continue
            length=down[v]
            if length>first:first,second=length,first
            elif length>second:second=length
        down[u]=first+1;best=max(best,first+second+1)
    return str(best)
''',[('允许同字母连接','if s[u]==s[v]:continue','if False:continue'),('只能向单侧延伸','first+second+1','first+1')],[(([-1]+list(range(99999)),'ab'*50000),100000),(([-1]+[0]*99999,'a'*100000),1)])

def moves_oracle(a):
    @functools.lru_cache(None)
    def visit(state,target):
        if len(state)<2:return 0
        candidates=[(state[0]+state[1],state[2:]),(state[-2]+state[-1],state[:-2]),(state[0]+state[-1],state[1:-1])]
        return max([0]+[1+visit(nxt,total) for total,nxt in candidates if target<0 or total==target])
    return visit(tuple(a),-1)
add(35,'删除端点对且每次和相同的最多操作','每次可删前两个、后两个，或首尾各一个。每次删除两数的和必须相同，求最大操作次数。长度不足2不能操作。',
'第一行N（1..1000），第二行N个正整数（1..10⁹）。','首步的和只有三个候选。对每个目标和做区间DP，枚举三种合法端点对删除，取剩余区间最大操作数加1。','删除端点后剩余总是一段连续区间，状态无需保留历史；目标和固定时三个转移覆盖且仅覆盖所有合法下一步。区间长度递增计算保证子问题已知，再枚举首步可能目标即全局最优。',
'时间O(N²)，空间O(N²)。',[[3,1,5,3,3,4,2],[4,1,4,3,3,2,5,2],[1]],['先删4+2，再删首尾3+3，最后删1+5，均为6，共3次。','依次删首尾4+2、1+5、4+2、3+3，共4次。','长度1不能删除，答案0。'],lambda r:[r.randint(1,8) for _ in range(r.randint(1,10))],arr,moves_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));n=len(a)
    if n<2:return '0'
    answer=0
    for target in {a[0]+a[1],a[-2]+a[-1],a[0]+a[-1]}:
        dp=[[0]*n for _ in range(n)]
        for length in range(2,n+1):
            for left in range(n-length+1):
                right=left+length-1;best=0
                if a[left]+a[left+1]==target:best=max(best,1+(dp[left+2][right] if length>2 else 0))
                if a[right-1]+a[right]==target:best=max(best,1+(dp[left][right-2] if length>2 else 0))
                if a[left]+a[right]==target:best=max(best,1+(dp[left+1][right-1] if length>2 else 0))
                dp[left][right]=best
        answer=max(answer,dp[0][-1])
    return str(answer)
''',[('只尝试前两数目标','{a[0]+a[1],a[-2]+a[-1],a[0]+a[-1]}','{a[0]+a[1]}'),('禁止首尾配对','if a[left]+a[right]==target:','if False:')],[([1]*1000,500),(list(range(1,1001)),500)],time_limit=8)

def cars_oracle(x):
    a,left,right=x;best=0
    for choices in itertools.product(range(3),repeat=len(a)):
        if sum(v for v,c in zip(a,choices) if c==1)<=left and sum(v for v,c in zip(a,choices) if c==2)<=right:best=max(best,sum(c!=0 for c in choices))
    return best
add(36,'两条装配线能生产的最多汽车','每辆车可放在任意一条装配线，开工后不能换线，每车至多生产一次。两线时间预算分别X、Y，最大化生产辆数。',
'第一行N X Y（1≤N≤1000，1≤X,Y≤500），第二行N个时长（1..1000）。','按时长升序试着加入前缀，用位集合维护这批车分配给第一线的可达总时长。存在总时长s≤X且总和−s≤Y即该前缀可生产。','任意k辆可行时，将所选较长车换成未选较短车不会让任何线超时，因此最短k辆也可行。位集合精确枚举每辆放第一或第二线的所有子集和；最长可行前缀即最优辆数。',
'时间O(N log N+NX/w)，位集合空间O(X/w)，另存输入O(N)，w为机器字宽。',[([1,1,3],1,1),([6,5,5,4,3],8,9),([5,5,4,6],8,8)],['两线各生产一辆时长1的车，总共2。','可分为3+5和4+5，总共4辆。','任意两辆至少耗时9，单线最多一辆，所以总共2。'],lambda r:([r.randint(1,12) for _ in range(r.randint(1,7))],r.randint(1,12),r.randint(1,12)),lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+' '.join(map(str,x[0]))+'\n',cars_oracle,
'''def solve(d):
    n,x,y=map(int,d[:3]);a=sorted(map(int,d[3:]));bits=1;mask=(1<<(x+1))-1;total=answer=0
    for i,value in enumerate(a):
        total+=value
        if total>x+y:break
        bits=(bits|(bits<<value))&mask
        if bits>>max(0,total-y):answer=i+1
        else:break
    return str(answer)
''',[('先生产耗时最长的','sorted(map(int,d[3:]))','sorted(map(int,d[3:]),reverse=True)'),('只看总工时忽略不能换线','if bits>>max(0,total-y):','if True:')],[(([1]*1000,500,500),1000),(([1000]*1000,500,500),0)])

def orders_oracle(x):
    distance,cost,budget=x;best=0
    for order in itertools.permutations(range(len(cost))):
        if any(distance[a]>distance[b] for a,b in zip(order,order[1:])):continue
        remain=budget;count=0
        for i in order:
            if cost[i]>remain:break
            remain-=cost[i];count+=1
        best=max(best,count)
    return best
add(37,'按距离供货能完成的最多订单','必须先完成所有更近客户的订单才能服务更远客户，同距离客户次序任选；每单只能完整交付，求库存P最多完成多少单。',
'第一行N P（1≤N≤100000，0≤P≤10¹⁰），第二行N个距离D，第三行N个需求C（均1..10⁹）。','按距离升序，同距离按需求升序，逐单扣库存，首个不足立即停止。','不同距离的先后被规则固定。同一距离中交换让需求较小的先交付，不会降低已完成数量；若全部交付可行，组内顺序不影响剩余库存。最便宜也付不起时无法再服务本组或更远组，停止最优。',
'时间O(N log N)，空间O(N)。',[([5,11,1,3],[6,1,3,2],7),([10,15,1],[10,1,2],3),([1,1,2],[5,1,1],2)],['先交距离1和3，耗3+2=5，下一单需6不足，完成2单。','先交最近需求2，剩1，距离10的需求10交不了，也不能跳到15，完成1单。','同距离先交需求1，剩1不足交需求5，因此不能服务更远订单，完成1单。'],lambda r:(lambda n:([r.randint(1,4) for _ in range(n)],[r.randint(1,8) for _ in range(n)],r.randint(0,25)))(r.randint(1,7)),lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',orders_oracle,
'''def solve(d):
    n,budget=map(int,d[:2]);distance=list(map(int,d[2:2+n]));cost=list(map(int,d[2+n:]));orders=sorted(zip(distance,cost));answer=0
    for _,value in orders:
        if value>budget:break
        budget-=value;answer+=1
    return str(answer)
''',[('跳过无法履行的近订单','if value>budget:break','if value>budget:continue'),('同距离需求降序','orders=sorted(zip(distance,cost))','orders=sorted(zip(distance,cost),key=lambda x:(x[0],-x[1]))')],[(([10**9]*100000,[10**9]*100000,10**10),10),(([1]*100000,[1]*100000,0),0)])

def rook_oracle(board):
    return max(board[i][j]+board[a][b] for i in range(len(board)) for j in range(len(board[0])) for a in range(i+1,len(board)) for b in range(len(board[0])) if j!=b)
add(38,'两个不同行不同列车的最大得分','在矩形棋盘放恰好两个车，两车必须不同行且不同列，求格子分数和最大值。原站样例输入不是矩形，本站使用符合正文的独立样例。',
'本站范围：第一行N M（2..500），随后N行各M个整数分数（−10⁹..10⁹）。','逐行处理，记录先前所有行中按不同列区分的最大两个分数。当前格选其中列不同的最佳值配对，再将本行加入候选。','当前行与历史行必不同行，列冲突最多排除历史最佳候选的一列，故不同列前两名足够。先查询整行再更新排除同一行配对；每对车都在其较晚行被枚举。',
'时间O(NM)，空间O(NM)存输入，候选额外O(1)。',[[[1,4],[2,3]],[[-5,-1],[-2,-3]],[[9,1],[8,2]]],['取右上4和左下2，和6。','必须放两车，取−1和−2，最大和−3。','9与8同列不能配，取9和2，和11。'],lambda r:[[r.randint(-9,9) for _ in range(3)] for _ in range(r.randint(2,4))],matrix,rook_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:]));best=[(-10**30,-1),(-10**30,-2)];answer=-10**30
    for i in range(n):
        for j in range(m):answer=max(answer,a[i*m+j]+max(score for score,col in best if col!=j))
        for j in range(m):
            candidates={col:score for score,col in best};candidates[j]=max(candidates.get(j,-10**30),a[i*m+j]);best=sorted((score,col) for col,score in candidates.items())[-2:]
    return str(answer)
''',[('允许同列','if col!=j','if True'),('负分错误返回0','answer=-10**30','answer=0')],[([[10**9]*500 for _ in range(500)],2*10**9),([[-10**9]*500 for _ in range(500)],-2*10**9)])

def fragments_oracle(x):
    a,k,l=x;best=None
    for i in range(len(a)-k+1):
        first=set(range(i,i+k))
        for j in range(len(a)-l+1):
            second=set(range(j,j+l));total=sum(-a[p] if p in first&second else a[p] for p in first|second)
            best=total if best is None else max(best,total)
    return best
add(39,'两段重叠部分变号后的最大得分','选择长度K、L的两段连续片段，允许重叠。只在一段中的元素照原值计，重叠元素只计一次且变号。标题“不重叠”与正文冲突，本站按正文及两个样例的重叠变号规则。',
'本站范围：第一行N K L（1≤N≤2000，1≤K,L≤N），第二行N个整数（−10⁹..10⁹）。','前缀和计算两片段总和，再减去重叠部分和的3倍；枚举两个起点求最大。','直接把两段和相加时，重叠元素被计2次，而目标需要计−1次，故减3倍重叠和恰好校正。所有起点组合被枚举，取最大即最优，负分情况同样成立。',
'时间O((N−K+1)(N−L+1))，空间O(N)。',[([1,3,-4,2,-1],3,2),([-5,-3,-4],1,3),([1,2],1,1)],['选择下标0..2和2..3，−4变为4，总分1+3+4+2=10。','整段与单点−5重叠，把−5变5，总分5−3−4=−2。','分别选1、2，不重叠，总分3。'],lambda r:(lambda a:(a,r.randint(1,len(a)),r.randint(1,len(a))))([r.randint(-9,9) for _ in range(r.randint(1,10))]),lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+' '.join(map(str,x[0]))+'\n',fragments_oracle,
'''def solve(d):
    n,k,l=map(int,d[:3]);a=list(map(int,d[3:]));prefix=[0]
    for value in a:prefix.append(prefix[-1]+value)
    answer=-10**30
    for i in range(n-k+1):
        leftsum=prefix[i+k]-prefix[i]
        for j in range(n-l+1):
            start=max(i,j);end=min(i+k,j+l);overlap=prefix[end]-prefix[start] if start<end else 0
            answer=max(answer,leftsum+prefix[j+l]-prefix[j]-3*overlap)
    return str(answer)
''',[('重叠不变号只去重','-3*overlap','-overlap'),('错误允许空选择','answer=-10**30','answer=0')],[(([1]*2000,1,1),2),(([-10**9]*2000,1000,1000),10**12)],time_limit=8)

add(40,'清空连续R个货架后最多保留几类','清空恰好R个连续货架，不改变其它货架顺序，求剩余货架不同类型数量的最大值。原站首例答案2不正确，本站按定义校正为3。',
'第一行N R（1≤N≤100000，1≤R≤N），第二行N个类型（1..100000）。','先把首个删除窗口从全局频次中扣掉，再滑动窗口：旧左端恢复、新右端删除，维护剩余正频次种数。','维护频次始终恰为窗口之外每类数量，进出窗口时只需判断频次是否跨过0即可更新种数。枚举所有连续删除窗口并取最大覆盖所有合法方案。',
'时间O(N)，空间O(N)。',[([2,1,2,3,2,3,2],3),([2,3,1,1,2],2),([1,100000,1],3)],['删除0-based下标2、3、4后，剩2、1、3、2，保留三类，已达到原数组全部三类；原站答案2漏掉此方案。','删最后2格后剩2、3、1，保留3类。','删除全部货架，没有类型剩余，答案0。'],lambda r:(lambda a:(a,r.randint(1,len(a))))([r.randint(1,6) for _ in range(r.randint(1,12))]),lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',lambda x:max(len(set(x[0][:i]+x[0][i+x[1]:])) for i in range(len(x[0])-x[1]+1)),
'''def solve(d):
    from collections import Counter
    n,r=map(int,d[:2]);a=list(map(int,d[2:]));counts=Counter(a[r:]);distinct=len(counts);answer=distinct
    for right in range(r,n):
        left=right-r
        if counts[a[left]]==0:distinct+=1
        counts[a[left]]+=1;counts[a[right]]-=1
        if counts[a[right]]==0:distinct-=1
        answer=max(answer,distinct)
    return str(answer)
''',[('只检查首个窗口','answer=max(answer,distinct)','answer=answer'),('错误把删除全部算一类','return str(answer)','return str(max(1,answer))')],[((list(range(1,100001)),50000),50000),(([1]*100000,100000),0)])

BLOCKED={22:'只有标题和一个示例，正式题干缺失；无法确认允许的数域、无匹配时返回值，以及首尾匹配的完整定义。',24:'未规定每间房能否安装多块面板；样例若允许在需求5的房屋安装三块X，成本6即可提供15≥14，而给出的7隐含每屋至多一块，不能擅加核心限制。',25:'题干截断在height o，未给出青蛙移动方向、高度比较或距离计算规则，两个样例不足以唯一恢复。',32:'CSV及SQL命令没有完整的WHERE值引号/转义语法、列名合法性、输出含逗号字段的再编码约定；字段/列数无界，10万行与命令不能保证4MiB输入或输出限额，无法在不补核心协议的情况下严格判题。'}

# Conservative byte budgets: maximal decimal token widths, one separator per token,
# and all declared dimensions simultaneously at their maxima. Negative scores use 12 bytes.
INPUT_BUDGETS={21:1100007,23:250508,26:100001,27:1100010,28:40212,29:2100014,30:600007,31:704,33:20008,34:800008,35:11005,36:5013,37:2200019,38:3000008,39:24015,40:700014}
assert max(INPUT_BUDGETS.values())<=4*1024*1024

def execute_many(path,inputs):
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert result.returncode==0,(path,result.stderr)
    outputs=json.loads(result.stdout);assert len(outputs)==len(inputs)
    return outputs

def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[]
    selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(x['id'].split('-')[-1]) not in selected]
        reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(x['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['id'] not in selected:continue
        identifier=f"oa-microsoft-{spec['id']}";rng=random.Random(20261012+spec['id']);code=spec.get('imports','')+spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)];oracles=[]
        for value in values:oracles.append(dict(input=spec['encode'](value),expectedOutput=str(spec['oracle'](value))+'\n'))
        cases=[];formal=oracles[:3]+[dict(input=spec['encode'](v),expectedOutput=str(e)+'\n') for v,e in spec['edges']]+oracles[3:31]
        for index,case in enumerate(formal):
            assert len(case['input'].encode())<=4*1024*1024,(identifier,'input exceeds 4MiB')
            cases.append(dict(name=f'样例 {index+1}' if index<3 else f'边界与组合 {index-2}',**case,hidden=index>=3,weight=1))
        for index,(actual,test) in enumerate(zip(execute_many(path,[c['input'] for c in oracles+cases]),oracles+cases)):
            assert actual.split()==test['expectedOutput'].split(),(identifier,index,actual[:200],test['expectedOutput'][:200])
        mutants=[];controls=[]
        for index,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code;changed=code.replace(old,new);control=OUT/'negative-controls'/f'{identifier}-{index}.py';control.write_text(changed)
            outputs=execute_many(control,[c['input'] for c in cases]);rejected=[i for i,(actual,test) in enumerate(zip(outputs,cases)) if actual.split()!=test['expectedOutput'].split()]
            assert rejected,(identifier,name,'survived');mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Microsoft'],description=spec['desc']+'\n\n本站独立编写标准I/O、样例、题解和评测。',input=spec['input'],output=spec.get('output','输出一个整数答案。') if spec['id']!=26 else '输出删除一个字符后的最小字符串。',explanation='\n\n'.join(f'样例{i+1}：{note}' for i,note in enumerate(spec['notes'])),hints=[spec['idea']],timeLimit=spec.get('time_limit',4),memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        assert '\ufffd' not in normalized
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxFormalInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(identifier,'163 oracle;',len(cases)-3,'hidden; 2 normal-exit mutants rejected',flush=True)
    entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    for report in reports:report['declaredMaxInputUpperBoundBytes']=INPUT_BUDGETS[int(report['id'].split('-')[-1])]
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=entries),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=20261012,problems=reports,note='Local batch subprocess checks use fresh runpy __main__ globals and streams per input, not per-input OS isolation; final real sandbox evidence remains required.'),ensure_ascii=False,indent=2)+'\n')
    descriptions={spec['id']:spec['desc'] for spec in SPECS}
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=[dict(id=f'oa-microsoft-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,descriptions.get(i))) for i in range(21,41)]),ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
