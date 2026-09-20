"""Amazon376–391; independent authored solutions. Lazy large fixtures; --small only.
Immutable raw/OCR files are read as evidence, never executed.
"""
from pathlib import Path
from itertools import combinations,permutations,product
from functools import lru_cache
import hashlib,json,random,subprocess,sys,time,gc
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='amazon-remaining-s';SEED=20263760;SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def line(s):return s+'\n'
def pair(x):return f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+seq(x[1])+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def success_oracle(x):return seq(max(sum(c) for c in combinations(x[0],k)) for k in x[1])
def success_random(r):
    n=r.randint(1,9);return [r.randint(1,20) for _ in range(n)],[r.randint(1,n) for _ in range(r.randint(1,9))]
def success_edges():
    n=100000
    yield ([10**9]*n,[n]*n),seq([10**14]*n)
    yield (list(range(1,n+1)),list(range(n,0,-1))),seq(k*(2*n-k+1)//2 for k in range(n,0,-1))
    yield ([1]*n,[1,n]*50000),seq([1,n]*50000)
add(378,'前若干名地区的观众总数','每个查询k求观众数最大的k个地区的观众总数。相同观众数的地区分别计数；查询互不影响并按输入顺序回答。','第一行n q，第二行n个观众数，第三行q个查询。原界1≤n,q≤100000，1≤人数≤10^9，1≤k≤n。本站输出精确整数，不受原int返回签名限制。','降序排序观众数并构建前缀和，第k个前缀即查询答案。','任意选中集合若漏掉一个更大的值，交换进来不会降低和，反复交换得到降序前k项。因此它们的和最大；前缀累加准确保存该和。','O(n log n+q)时间，O(n+q)空间，最大答案10^14。',[([5,6,10],[1,2,3]),([7,7,1],[2,1]),([1],[1,1])],success_random,success_edges,pair,success_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,q=d[:2];a=sorted(d[2:2+n],reverse=True);prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    return ' '.join(str(prefix[k]) for k in d[2+n:])
''',[('错误取最小的k项','reverse=True','reverse=False'),('错误漏掉第k项','prefix[k]','prefix[k-1]')],1800050,output='按查询顺序输出q个精确整数，以空白分隔。')

def truck_oracle(x):
    a,b=x;return seq(min(((v,i) for i,v in enumerate(a) if v>w),default=(0,-1))[1] for w in b)
def truck_edges():
    n=100000
    yield ([10**9]*n,[10**9]*n),seq([-1]*n)
    yield ([10**9]*n,[1]*n),seq([0]*n)
    yield (list(range(n,0,-1)),list(range(1,n+1))),seq([n-w-1 for w in range(1,n)]+[-1])
add(379,'为货物选择严格更大容量的卡车','每件货物独立选择容量严格大于重量的卡车：先最小化容量，再选择该容量中最小原下标。下标从0开始，没有可用车输出−1；装载不消耗卡车容量。','第一行n m，第二行n个容量，第三行m个重量。原界1≤n,m≤100000，容量和重量均1..10^9。','按容量排序并保留每个容量的最小下标，二分第一个严格大于重量的容量。','二分跳过所有不够大的容量，第一个剩余容量恰是可用容量最小值；预存的最小下标解决且仅解决该容量内平局。独立查询不修改结构，符合重复使用规则。','O(n log n+m log n)时间，O(n+m)空间。',[([5,3,5,8],[3,5,8]),([4,2],[1,2,4]),([2,2,3],[1,2])],lambda r:([r.randint(1,12) for _ in range(r.randint(1,9))],[r.randint(1,12) for _ in range(r.randint(1,9))]),truck_edges,pair,truck_oracle,
'''def solve(raw):
    from bisect import bisect_right
    d=list(map(int,raw.split()));n,m=d[:2];first={}
    for i,v in enumerate(d[2:2+n]):first.setdefault(v,i)
    capacities=sorted(first);answer=[]
    for weight in d[2+n:]:
        j=bisect_right(capacities,weight);answer.append(first[capacities[j]] if j<len(capacities) else -1)
    return ' '.join(map(str,answer))
''',[('错误允许容量相等','j=bisect_right(capacities,weight)','j=__import__("bisect").bisect_left(capacities,weight)'),('错误同容量取最后下标','first.setdefault(v,i)','first[v]=i')],2200050,output='按货物顺序输出m个卡车下标或−1。')

def transfer_encode(x):return f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+''.join(f'{a} {b}\n' for a,b in x[1])
def transfer_oracle(x):
    a=list(x[0])
    for u,v in x[1]:a[a.index(u)]=v
    return str(len(a))+'\n'+seq(sorted(a))
def transfer_random(r):
    initial=r.sample(range(-20,21),r.randint(0,8));now=list(initial);moves=[]
    for _ in range(r.randint(0,12) if now else 0):
        i=r.randrange(len(now));v=r.choice([v for v in range(-20,21) if v not in now]);moves.append((now[i],v));now[i]=v
    return initial,moves
def transfer_edges():
    n=200000
    yield (list(range(n)),[(i,10**9-i) for i in range(n)]),str(n)+'\n'+seq(range(10**9-n+1,10**9+1))
    yield ([-10**9],[(i,i+1) for i in range(-10**9,-10**9+n)]),'1\n'+str(-10**9+n)
    yield ([],[]),'0\n'
    yield (list(range(-n,0)),[]),str(n)+'\n'+seq(range(-n,0))
add(380,'按顺序迁移后数据所在位置','初始位置两两不同。依次把from位置的数据移到to；原文保证每步from有数据、to没有数据。最后按升序输出全部有数据的位置。','第一行n m，第二行n个初始位置，随后m行from to。原文无数值界；本站补充0≤n,m≤200000，位置ID为−10^9..10^9。输入满足上述原有效迁移保证，故n=0时m只能为0。','集合保存有数据的位置，每次删除from并加入to，最后排序。','集合初始与占用位置一致。有效迁移恰删除一个旧位置并增加一个空位置，其余位置不变，因此每步保持一致；最终排序仅改变输出顺序。','O(m+n log n)期望时间、O(n+m)含输入空间。',[([1,2,5,6],[(1,4),(4,7),(5,1),(7,3)]),([0],[(0,-1),(-1,2)]),([],[])],transfer_random,transfer_edges,transfer_encode,transfer_oracle,
'''def solve(raw):
    d=iter(map(int,raw.split()));n=next(d);m=next(d);positions={next(d) for _ in range(n)}
    for _ in range(m):
        u=next(d);v=next(d);positions.remove(u);positions.add(v)
    return str(len(positions))+'\\n'+' '.join(map(str,sorted(positions)))
''',[('错误忽略最后一次迁移','range(m):','range(max(0,m-1)):'),('错误降序输出','sorted(positions)','sorted(positions,reverse=True)')],7200050,output='第一行输出位置数量n，第二行输出升序位置；n=0时第二行为空。',explanation='第一例最终为1 2 3 6。原文第二例解释错误复用了另一组迁移，本站按实际输入1→4、4→7、5→1、7→3解释。其余样例分别只有位置2和无位置。')

def rice_oracle(a):
    best=-1
    for k in range(2,len(a)+1):
        for c in combinations(a,k):
            b=sorted(c)
            if all(b[i]*b[i]==b[i+1] for i in range(k-1)):best=k
    return best
def rice_edges():
    yield list(range(2,200002)),5
    yield list(range(800001,1000001)),-1
    yield [2,4,16,256,65536],5
    yield [1000,1000000],2
add(383,'相邻袋数平方关系的最大集合','所有袋子的米粒数两两不同。选择至少两个袋子，使升序排列后每项的平方恰等于后一项，返回可选最多袋数，无解返回−1。','第一行n，第二行n个互异整数。恢复原界1≤n≤200000、2≤riceBags[i]≤10^6，不能采用被HTML清理拼接的错误约束。','把全部数存集合，从每个数开始反复平方，统计仍在集合中的链长。','合法序列选定首项后，后续每一项都唯一等于前项平方。逐起点延伸至第一个缺失值，因此找全该起点最长合法序列，所有起点取最大即全局最优。','O(n log log 10^6)期望时间、O(n)空间；最长链为2,4,16,256,65536，共5项。',[[2,4,16],[2,3,5],[1000,1000000]],lambda r:r.sample([2,3,4,5,9,16,25,81,256],r.randint(1,9)),rice_edges,arr,rice_oracle,
'''def solve(raw):
    a=set(map(int,raw.split()[1:]));best=1
    for start in a:
        v=start;length=1
        while v<=1000 and v*v in a:v*=v;length+=1
        best=max(best,length)
    return str(best if best>=2 else -1)
''',[('错误只允许三个袋子','best=max(best,length)','best=max(best,min(length,3))'),('错误无解输出1','else -1','else 1')],1600020)

def signs_oracle(a):
    best=0
    for mask in range(1<<len(a)):
        total=0
        for i,v in enumerate(a):
            total+=-v if mask>>i&1 else v
            if total<=0:break
        else:best=max(best,mask.bit_count())
    return best
def signs_edges():
    n=100000
    yield [1]*n,(n-1)//2
    yield [10**9]*n,(n-1)//2
    yield [10**9]+[1]*(n-1),n-1
    yield [1]*(n-1)+[10**9],(n-2)//2
add(384,'保持每个前缀严格为正的最多负号','给正整数数组的每一项选择正号或负号，要求每个非空前缀的带符号和严格大于0，最大化负号数量。','第一行n，第二行n个整数。原界1≤n≤100000，1≤a[i]≤10^9；前缀为0不合法。','新项先取负并加入最大堆；若前缀不正，撤销当前所有负项中绝对值最大的一项。','维持已选负项的数量最大，且在该数量下负项总和最小（即余额最大）。加入新负项后若超出本前缀允许预算，任何同数量方案也不可行，必须去掉一项；去掉最大值使留下的和最小。以前缀递增的原正数总和为预算，交换最大项只减少所有受影响前缀的负负担，不破坏过去约束。此前余额正，最大值至少为新值，故一次撤销即可恢复正余额。归纳得到最大数量。','O(n log n)时间、O(n)空间；余额可达10^14。',[[1,1,1],[5,1,1,1],[2,3,1,4]],lambda r:[r.randint(1,12) for _ in range(r.randint(1,10))],signs_edges,arr,signs_oracle,
'''def solve(raw):
    import heapq
    a=map(int,raw.split()[1:]);heap=[];balance=0
    for v in a:
        balance-=v;heapq.heappush(heap,-v)
        if balance<=0:balance-=2*heapq.heappop(heap)
    return str(len(heap))
''',[('错误允许零前缀','balance<=0','balance<0'),('撤销最大负项却按当前项返还余额','balance-=2*heapq.heappop(heap)','balance+=2*v;heapq.heappop(heap)')],1100020)

def repeated_oracle(s):
    places=[i for i,c in enumerate(s) if c=='?'];best=0
    for letters in product('abcdefghijklmnopqrstuvwxyz',repeat=len(places)):
        a=list(s)
        for i,c in zip(places,letters):a[i]=c
        for l in range(len(a)):
            for h in range(1,(len(a)-l)//2+1):
                if a[l:l+h]==a[l+h:l+2*h]:best=max(best,2*h)
    return best
def repeated_random(r):
    a=[r.choice('abc') for _ in range(r.randint(0,9))]
    for i in r.sample(range(len(a)),r.randint(0,min(2,len(a)))):a[i]='?'
    return ''.join(a)
def repeated_edges():
    yield '?'*5000,5000
    yield 'a'*5000,5000
    yield 'a'*4999,4998
    yield 'a'*2500+'b'*2500,2500
    # Square-free ternary Thue word: morphism a->abc,b->ac,c->b.
    s='a'
    while len(s)<5000:s=''.join({'a':'abc','b':'ac','c':'b'}[c] for c in s)
    yield s[:5000],0
add(385,'可替换问号的相邻相同两半最长长度','给定小写字母和问号组成的字符串，每个问号可独立替换成任意小写字母。求一个连续子串的最大偶数长度，使其前后两半完全相同；两半必须紧邻。','输入一行字符串。原文没有长度界；本站补充0≤长度≤5000，字符为a..z或?。空串和不存在非空合法子串时输出0。','从大到小枚举半长h，扫描相距h的字符对是否相等或含问号，连续兼容h对就找到答案2h。','长度2h的两半对应h对互不共享位置的字符。每对兼容当且仅当可以独立替换为同一字母，所以h对全部兼容与该子串存在合法替换等价。扫描连续兼容对检查全部起点，按h降序找到的第一个解最长。','O(n²)时间、O(1)额外空间。',['a??a','abc',''],repeated_random,repeated_edges,line,repeated_oracle,
'''def solve(raw):
    s=raw.removesuffix('\\n').removesuffix('\\r');n=len(s)
    for h in range(n//2,0,-1):
        run=0
        for i in range(n-h):
            run=run+1 if s[i]==s[i+h] or s[i]=='?' or s[i+h]=='?' else 0
            if run>=h:return str(2*h)
    return '0'
''',[('错误问号不能替换'," or s[i]=='?' or s[i+h]=='?'",''),('错误输出半长','str(2*h)','str(h)')],5001,timeLimit=10)

def array_value_oracle(a):
    @lru_cache(None)
    def f(t):
        if len(t)==1:return t[0]
        values=[f(t[1:]),f(t[:-1])]
        for i in range(1,len(t)-1):values.append(f(t[:i-1]+(t[i-1]+t[i+1],)+t[i+2:]))
        return max(values)
    return f(tuple(a))
def array_value_edges():
    n=100000
    yield [-10**9]*n,-10**9
    yield [0]*n,0
    yield [10**9]*n,50000*10**9
    yield [10**9,-10**9]*50000,50000*10**9
add(386,'删除并合并相邻项后的最大最终值','每次删除一项：若它在端点，仅删除；若它在中间，删除该项并把其左右两项合并为两者之和。必须最终剩一项，最大化最终值。','第一行n，第二行n个整数。保留原n≤100000及−10^9≤a[i]≤10^9；本站明确n≥1，最终不能选择空数组。','分别累加原奇、偶下标上的正数，取较大者；若没有正数，则取原数组最大值。','一次合并跨过一个元素，因此每个存活合并值只能由原同一奇偶下标的元素组成，给出两种奇偶位置正数和的上界。任意该奇偶的非空选定子集都能实现：先截去选中范围外的端点，两个相邻选中项之间若还有不选的同奇偶项，先删除这些项，将其异奇偶邻居合并；最终只隔一个异奇偶项，删除它即可合并两选中值，归纳实现全子集。因此有正数时选所有正数达到上界；无正数时任何非空和不超过最大单项，截端点保留它即可。','O(n)时间，除输入外O(1)空间，答案最多5×10^13。',[[-5,-2,-7],[1,-10,3],[0,-1,0]],lambda r:[r.randint(-5,5) for _ in range(r.randint(1,8))],array_value_edges,arr,array_value_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()[1:]));totals=[0,0]
    for i,v in enumerate(a):totals[i%2]+=max(v,0)
    return str(max(totals) if max(totals)>0 else max(a))
''',[('错误全负可选空集','else max(a)','else 0'),('错误混合两种奇偶','max(totals) if','sum(totals) if')],1200020)

def packages_encode(x):return arr(x[0])+seq(x[1])+'\n'
def packages_oracle(x):
    a,c=x;answer=None
    for order in permutations(range(len(a))):
        slot=-1;total=0
        for i in order:slot=max(slot+1,a[i]);total+=(slot-a[i])*c[i]
        answer=total if answer is None else min(answer,total)
    return answer
def packages_edges():
    n=200000
    yield ([10**9]*n,[10000]*n),10000*n*(n-1)//2
    yield ([1]*n,[1]*n),n*(n-1)//2
    yield (list(range(1,n+1)),[10000]*n),0
    yield ([1,10**9],[10000,10000]),0
    yield ([1]*n,[10000]*100000+[1]*100000),10000*100000*99999//2+(100000+199999)*100000//2
add(388,'按商品各自费用增加尺寸至互不相同','商品i初始尺寸size[i]，每增加1支付cost[i]，不能减小。使所有最终尺寸互不相同，求最少总费用。','第一行n，第二行n个尺寸，第三行n个单位费用。OCR141/142/143及同题补文恢复完整原界：1≤n≤200000，1≤size[i]≤10^9，1≤cost[i]≤10000。','按原尺寸排序，依次安排整数尺寸槽位。所有已可放入槽位的商品加入按单位费用降序的堆，安排最贵者；堆为空时跳至下一原尺寸。','任意有等待商品的空槽都可让一个后放商品提前，费用不会增加。对于当前槽已可用的两商品，若贵者在便宜者之后，交换使费用减少或不变，且两者均已释放，仍合法。因此当前放最贵者总能延伸成最优解；逐槽归纳得全局最优。空堆跳过不能安排任何商品的位置不漏解。','O(n log n)时间，O(n)空间，答案可达199999000000000。',[([2,3,2,2],[2,4,5,1]),([1,1],[1,9]),([1,100],[3,2])],lambda r:([r.randint(1,6) for _ in range(n)],[r.randint(1,8) for _ in range(n)]) if (n:=r.randint(1,6)) else None,packages_edges,packages_encode,packages_oracle,
'''def solve(raw):
    import heapq
    d=list(map(int,raw.split()));n=d[0];items=sorted(zip(d[1:n+1],d[n+1:]));heap=[];i=0;slot=0;answer=0
    while i<n or heap:
        if not heap:slot=max(slot,items[i][0])
        while i<n and items[i][0]<=slot:
            size,cost=items[i];heapq.heappush(heap,(-cost,size));i+=1
        negcost,size=heapq.heappop(heap);answer+=(slot-size)*(-negcost);slot+=1
    return str(answer)
''',[('错误低费用者优先','(-cost,size)','(cost,size)'),('错误只计算增加次数','*( -negcost)','')],3400030,timeLimit=10,explanation='第一例最少7：费用5的商品留在2，费用4的留在3，费用2的由2增至4花4，费用1的由2增至5花3。原补文的“1+4=7”解释有算术错误，本站采用正确过程；另两例答案为1和0。')
# The second negative control deliberately forgets the per-item price, without RE.
SPECS[-1]['mutants'][1]=('错误只计算增加次数','(slot-size)*(-negcost)','(slot-size)')

def movies_encode(x):return f'{len(x[0])} {len(x[2])}\n'+''.join(seq(a)+'\n' for a in x)
def movies_oracle(x):
    a,b,c,d=x
    return min(min(max(a[i]+b[i],c[j])+d[j],max(c[j]+d[j],a[i])+b[i]) for i in range(len(a)) for j in range(len(c)))
def movies_random(r):
    n,m=r.randint(1,7),r.randint(1,7);return tuple([r.randint(1,12) for _ in range(k)] for k in (n,n,m,m))
def movies_edges():
    n=100000
    yield ([10**6]*n,)*4,3000000
    yield ([1]*n,)*4,3
    yield ([10**6]*n,[1]*n,[1]*n,[1]*n),1000001
    yield ([1]*n,[1]*n,[10**6]*n,[1]*n),1000001
add(389,'两类电影各看一部的最早结束时间','每部电影有上映时刻与时长，可在上映后任意时刻开始。两类各至少看一部，不能同时观看，允许连续无缝切换，求最早完成时刻，两类的先后顺序均可。','第一行n m；接着四行依次为n个喜剧上映时刻、n个喜剧时长、m个剧情上映时刻、m个剧情时长。原界1≤n,m≤100000，四数组值均1..10^6。','求每类单独最早完成时刻。假设该类先看，用其最早完成时刻遍历另一类，计算max(前类结束,本片上映)+时长；两种顺序取最小。','多看影片不能让结束更早，所以只需各一部。固定第二部时，结束时刻关于第一部完成时刻单调不减，故第一类只保留最早完成者即可。枚举第二部和两种顺序覆盖全部最优可能。','O(n+m)时间，O(n+m)含输入空间。',[([1,4],[3,2],[5,2],[2,2]),([10],[1],[1],[2]),([1],[2],[1],[3])],movies_random,movies_edges,movies_encode,movies_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];b=d[2+n:2+2*n];c=d[2+2*n:2+2*n+m];e=d[2+2*n+m:]
    first=min(x+y for x,y in zip(a,b));second=min(x+y for x,y in zip(c,e))
    return str(min(min(max(first,x)+y for x,y in zip(c,e)),min(max(second,x)+y for x,y in zip(a,b))))
''',[('错误固定喜剧先看','min(min(max(first,x)+y for x,y in zip(c,e)),min(max(second,x)+y for x,y in zip(a,b)))','min(max(first,x)+y for x,y in zip(c,e))'),('错误忽略第二部上映时刻','max(first,x)','first')],3200050,explanation='第一例为6：喜剧(上映1,时长3)在4结束，再看剧情(上映2,时长2)。原解释把上映5的片子写成4开始，本站纠正。第二例11，第三例6。')

def polynomial_encode(x):
    letter,p,q=x
    def factor(terms):
        parts=[]
        for index,(c,e) in enumerate(terms):
            sign='-' if c<0 else ('+' if parts else '');v=abs(c)
            # Alternate canonical shorthand with explicit signed exponent forms.
            if index%2:
                body=str(v)+letter+'^'+('+' if e>=0 else '')+str(e)
            elif e==0:body=str(v)
            else:body=('' if v==1 else str(v))+letter+('' if e==1 else '^'+str(e))
            parts.append(sign+body)
        return '('+''.join(parts)+')'
    return factor(p)+factor(q)+'\n'
def polynomial_format(values,letter):
    pieces=[]
    for exponent in sorted(values,reverse=True):
        coefficient=values[exponent]
        if not coefficient:continue
        magnitude=abs(coefficient)
        if exponent==0:body=str(magnitude)
        else:body=('' if magnitude==1 else str(magnitude))+letter+('' if exponent==1 else '^'+str(exponent))
        pieces.append(('-' if coefficient<0 else ('+' if pieces else ''))+body)
    return ''.join(pieces) or '0'
def polynomial_oracle(x):
    # Independent dense exponent-offset convolution, not reference parsing/maps.
    letter,p,q=x;lp=min(e for c,e in p);lq=min(e for c,e in q)
    a=[0]*(max(e for c,e in p)-lp+1);b=[0]*(max(e for c,e in q)-lq+1)
    for c,e in p:a[e-lp]+=c
    for c,e in q:b[e-lq]+=c
    out=[0]*(len(a)+len(b)-1)
    for i,c in enumerate(a):
        for j,d in enumerate(b):out[i+j]+=c*d
    return polynomial_format({i+lp+lq:c for i,c in enumerate(out)},letter)
def polynomial_random(r):return r.choice('xyAZ'),[(r.randint(-3,3),r.randint(-4,4)) for _ in range(r.randint(1,6))],[(r.randint(-3,3),r.randint(-4,4)) for _ in range(r.randint(1,6))]
def polynomial_rational_check(case,answer):
    # A second independent arithmetic check of the real reference stdout.
    # Protect exponent signs, then split term signs without the reference regex.
    from fractions import Fraction
    letter,p,q=case;terms=answer.strip().replace('^-','^~').replace('-','+-').split('+')
    for point in (2,-3):
        value=Fraction(0)
        for term in terms:
            if not term:continue
            term=term.replace('~','-')
            if letter not in term:value+=int(term);continue
            coefficient,suffix=term.split(letter);c=-1 if coefficient=='-' else (int(coefficient) if coefficient else 1)
            exponent=int(suffix[1:]) if suffix else 1;value+=c*Fraction(point)**exponent
        expected=sum(c*Fraction(point)**e for c,e in p)*sum(c*Fraction(point)**e for c,e in q)
        assert value==expected,(case,answer,point,value,expected)
def polynomial_edges():
    n=200;h=10**9
    p=[(h,-h+1000*i) for i in range(n)];q=[(h,h+j) for j in range(n)]
    yield ('x',p,q),'+'.join(str(h*h)+('x^'+str(e) if e!=1 else 'x') if e else str(h*h) for e in (1000*i+j for i in range(n-1,-1,-1) for j in range(n-1,-1,-1)))
    yield ('Z',[(h,-h)]*n,[(h,-h)]*n),str((n*h)**2)+'Z^-2000000000'
    yield ('A',[(-h,h)]*n,[(h,h)]*n),'-'+str((n*h)**2)+'A^2000000000'
    yield ('y',[(h,h),(-h,h)]*100,[(h,-h)]*n),'0'
    yield ('x',[(1,-1)],[(1,1)]),'1'
add(390,'含负整数幂的两个多项式展开','输入两个同变量的有限多项式之积，允许负整数指数（Laurent多项式）。合并同幂项，按指数严格降序输出展开式，无括号无空格，不能丢弃负幂或使用浮点系数。','输入一行(P)(Q)，恰四个括号，变量为同一个ASCII字母a..z或A..Z。原文没有数值界，本站补充每因子1..200项、每个原始项系数绝对值≤10^9、指数−10^9..10^9；重复幂、零系数与常数因子允许。具体语法：项之间以+或-连接，首项可带符号；项可为非负十进制常数，或可省略绝对值系数1的变量，后跟可省略的^有符号十进制整数指数。省略指数为1，变量省略为常数项；例如(-x^-2+3)(2x+1)，也接受x^+2。除行结束符外没有空白，不使用Unicode上标；整数数字采用通常十进制写法。','逐项扫描时将指数内符号与项符号分开，分别按指数合并两因子；逐对相乘，系数相乘、指数相加，累加至对应指数。最后降序格式化并去掉零项。','每个原始单项式可唯一解析为系数和指数，负指数符号在^后被消费，不会成为下一项符号。分配律说明积中指数e的系数恰是所有指数和为e的系数乘积之和；逐对累加覆盖且只覆盖这些项。去掉零系数与指定降序、符号省略仅改变表示，不改变多项式，因此输出唯一规范展开式。','设原项数为T、U，输出不同幂数K≤TU≤40000，时间O(TU+K log K)，空间O(T+U+K)。系数使用任意精度整数，绝对值最多4×10^22，指数可达±2×10^9。',[('x',[(1,1)],[(2,-2),(1,0)]),('x',[(-1,3)],[(3,3),(2,0)]),('y',[(1,1),(-1,1)],[(1,-2)])],polynomial_random,polynomial_edges,polynomial_encode,polynomial_oracle,
'''def solve(raw):
    import re
    text=raw.strip();letter=next((c for c in text if c.isalpha()),'x')
    pattern=re.compile(r'([+-]?)(?:(\\d+)([a-zA-Z])?|([a-zA-Z]))(?:\\^([+-]?\\d+))?')
    def parse(s):
        out={};pos=0
        while pos<len(s):
            m=pattern.match(s,pos);sign,digits,v1,v2,exponent=m.groups();c=int(digits) if digits is not None else 1
            if sign=='-':c=-c
            e=int(exponent) if exponent is not None else (1 if v1 or v2 else 0)
            out[e]=out.get(e,0)+c;pos=m.end()
        return out
    p,q=text[1:-1].split(')(');a=parse(p);b=parse(q);out={}
    for e,c in a.items():
        for f,d in b.items():out[e+f]=out.get(e+f,0)+c*d
    answer=[]
    for e in sorted(out,reverse=True):
        c=out[e]
        if c==0:continue
        v=abs(c);body=str(v) if e==0 else ('' if v==1 else str(v))+letter+('' if e==1 else '^'+str(e))
        answer.append(('-' if c<0 else ('+' if answer else ''))+body)
    return ''.join(answer) or '0'
''',[('错误乘幂指数相乘','out[e+f]=out.get(e+f,0)+c*d','out[e*f]=out.get(e*f,0)+c*d'),('错误同幂覆盖不累加','out[e+f]=out.get(e+f,0)+c*d','out[e+f]=c*d')],10050,output='输出唯一规范字符串：去掉零项，指数从大到小；首项正号省略，之后正项用+、负项用-；系数绝对值为1且指数非0时省略1；指数0只输出常数系数，指数1省略^1，其余幂使用ASCII ^及十进制指数（正指数不带+）；零多项式输出0。例x+2x^-1、-3x^6-2x^3、0。不得输出空格、括号、前导零或冗余+号。')

def warehouse_oracle(a):
    base,r=divmod(sum(a),len(a));best=None
    for high in combinations(range(len(a)),r):
        marked=set(high);cost=sum(max(0,v-base-(i in marked)) for i,v in enumerate(a));best=cost if best is None else min(best,cost)
    return best
def warehouse_edges():
    n=100000
    yield [10**9]*n,0
    yield [1]*n,0
    yield [10**9]*50000+[1]*50000,50000*499999999
    # Sum=n+999999999, so the original large pile takes a ceil target of10001.
    yield [10**9]+[1]*(n-1),10**9-10001
    yield [1,10**9],499999999
add(391,'仓库差距最小之后的最少箱子搬运','一次从有箱子的堆移一个箱子至另一堆。首先让最终最大堆与最小堆的差尽可能小，在达到该最小差的方案中求最少操作数。初始数量允许重复。','第一行n，第二行n个箱子数量。原界1≤n≤100000，1≤boxes[i]≤10^9；总箱数保持不变，不给定外部差值参数。','设base=floor(sum/n)，计算低于base的总缺口D及高于base+1的总超额E，答案为max(D,E)。','总和固定时最小差为0或1，最终各堆必为base或base+1。令r=sum mod n、H为原本大于base的堆数。把尽可能多的r个高位目标交给这H堆，可最小化从超量堆取出的数量。若r≤H，恰需补低端D；若r>H，额外r−H个高位目标也需补1。又由总和得到E=D+r−H，因此最优搬运数为D+max(0,r−H)=max(D,E)。每步从超额堆向缺额堆移动一箱，恰能实现该下界。','O(n)时间，除输入外O(1)空间，使用64位或任意精度整数。',[[1,3,5],[5,5],[1,1,10]],lambda r:[r.randint(1,15) for _ in range(r.randint(1,9))],warehouse_edges,arr,warehouse_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()[1:]));base=sum(a)//len(a)
    deficit=sum(max(0,base-v) for v in a);excess=sum(max(0,v-base-1) for v in a)
    return str(max(deficit,excess))
''',[('错误只看低于floor的缺口','max(deficit,excess)','deficit'),('错误把所有目标设floor','v-base-1','v-base')],1100020)

BLOCKED={376:'first r servers不包含r且r=0合法但候选为空；样例与最终负载冲突，不能捏造0特例。',377:'与376同义文本有相同0请求及候选端点歧义，缺少独立补证。',381:'原域未限制正数；全零是否允许作为空山峰未定义，不能强加a[i]≥1绕过。',382:'原digits允许0，例如0/1与数字和1可构造1、10、100…无最大值，缺少无界规则。',387:'定义单对距离却例(())输出多对和4，()()例3又不要求全匹配；配对数量、复用与合法性不明。'}
SLUGS=['get-server-id','get-server-ids','get-success-value','get-trucks-for-items','location-of-data-after-transfers','make-array-bitonic-deshaw','max-lucky-numbers','max-set-size','maximize-negative-signs','maximize-repeated-substring-length','maximize-the-array-value-amazon','maximum-score-in-balanced-string','minimal-cost-to-increase-package-size','minimum-time-spent','unknown-math-challenge','warehouse-allocation']
EVIDENCE={n:['fastprep/Amazon/'+SLUGS[n-376]+'.md'] for n in range(376,392)}
EVIDENCE[388]+=['fastprep/Amazon/amazon-get-minimal-cost.md']+['OA LIST/Amazon_OA(包括新版AI_Codinig题）/'+str(n)+'_image.txt' for n in (141,142,143)]
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
    selected={int(v) for v in sys.argv[1:] if v!='--small'}
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        rng=random.Random(SEED+s['n']);values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        cases=[(s['encode'](v),str(s['oracle'](v))+'\n') for v in values];code=code_for(s)
        def run(program):
            p=subprocess.run([sys.executable,'-I','-c',SMALL_RUNNER],input=json.dumps([program,[raw for raw,_ in cases]],ensure_ascii=False),text=True,capture_output=True,timeout=120)
            assert p.returncode==0,(s['n'],p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(cases);return out
        actual=run(code)
        for i,(a,(_,expected)) in enumerate(zip(actual,cases)):assert equal(a,expected,s),(s['n'],i,cases[i][0],a,expected)
        if s['n']==390:
            for value,answer in zip(values,actual):polynomial_rational_check(value,answer)
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
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in sorted(SPECS,key=lambda s:s['n']):
        number=s['n'];ident=f'oa-amazon-{number}'
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(SEED+number)
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=str(s['oracle'](v))+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=str(a)+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:31];assert 31<=len(tests)<=64
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
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Amazon'],description=s['desc']+'\n\n本站独立整理标准I/O与题解；来源缺失界的补充及样例纠错在协议中明示。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        assert len(normalized.encode())<=128*1024*1024,(ident,'package exceeds128MiB')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        assert (OUT/'packages'/f'{ident}.json').stat().st_size<=128*1024*1024
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracle;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del cases,tests,boundary,oracles,normalized,p,doc,c;gc.collect()
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,paths in EVIDENCE.items():
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=f'oa-amazon-{number}';reason=BLOCKED[number] if number in BLOCKED else next(s['desc']+' '+s['limits'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
