"""Original Amazon296–315; 306/308/311 remain blocked. Large fixtures are lazy.
Full generation is reserved for the coordinated remote runner, not this laptop.
"""
from collections import Counter, deque
from functools import lru_cache
from itertools import combinations, product
from pathlib import Path
import hashlib, json
import amazon_remaining_h as base
base.SPECS=[];base.BATCH='amazon-remaining-o';base.SEED=20262960
add=base.add;arr=base.arr
def seq(a):return ' '.join(map(str,a))
def ak(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'

def convert_oracle(x):
    a,k=x;n=len(a);initial=sum(v<<i for i,v in enumerate(a));windows=[((1<<k)-1)<<i for i in range(n-k+1)]
    @lru_cache(None)
    def visit(mask):
        if not mask:return 0
        best=10**9
        for window in windows:
            active=mask&window;cost=active.bit_count()
            for i in range(n):
                if active>>i&1:best=min(best,cost+visit(mask^(1<<i)))
        return best
    return visit(initial)
def convert_edges():
    yield ([1]*200000,200000),20000100000
    yield ([1,0]*100000,100000),1250075000
    yield ([0]*100000+[1]*100000,100000),100000
add(296,'固定窗口清除全部变体B的最小费用','products为0/1数组。每次必须选恰好k个连续位置，支付该窗口当前1的数量，再把窗口中的一个1改为0。求将全部1清除的最小总费用；全0时可不操作。','第一行n k，第二行products。原文规定二进制及1≤k≤n，没有n上界；本站补充1≤n≤200000。','T为全部1的数量，滑窗求初始长度k窗口中最少的1数q；返回T+q(q−1)/2。','初始任意窗口至少q个1，第t次操作前至多已删t−1个，故前q次费用至少q,q−1,…,1，之后每删一个至少1。先选最少1的窗口连续清空，恰付前三角和。已有长度k零区间后向左右逐格扩展，每次新遇到1都能在其余k−1位已清零的窗口中以1删除，因此达到下界。固定窗口长度在数组边缘也不缩短。','时间O(n)，辅助空间O(1)不含输入，答案64位。',[([1,1,1],3),([1,0,1,0,1],2),([0,0],1)],'答案6、3、0。第一例每次必须选全部三个位置，依次付3、2、1。',lambda r:([r.randint(0,1) for _ in range(n)],r.randint(1,n)) if (n:=r.randint(1,9)) else None,convert_edges(),ak,convert_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));total=sum(a);window=sum(a[:k]);q=window
    for i in range(k,n):window+=a[i]-a[i-k];q=min(q,window)
    return str(total+q*(q-1)//2)
''',[('错误只数清除次数','total+q*(q-1)//2','total'),('错误三角和多收一次','q*(q-1)//2','q*(q+1)//2')],400050)

def energy_encode(x):
    a,X,Y,El,Er=x;return f'{len(a)} {X} {Y} {El} {Er}\n'+seq(a)+'\n'
def energy_oracle(x):
    a,X,Y,El,Er=x;best=10**30
    for sides in product((0,1),repeat=len(a)):
        l=0;r=len(a)-1;cost=0;previous=None
        for side in sides:
            if side==0:cost+=a[l]*X+(El if previous==side else 0);l+=1
            else:cost+=a[r]*Y+(Er if previous==side else 0);r-=1
            previous=side
        best=min(best,cost)
    return best
def energy_random(r):return ([r.randint(0,10) for _ in range(r.randint(1,8))],*[r.randint(0,10) for _ in range(4)])
def energy_edges():
    yield ([10**9]*200000,10**9,10**9,10**9,10**9),200000000000000000000000
    yield ([1]*200000,0,1,0,10**9),0
    yield ([1]*200000,1,1,10**9,10**9),200000
add(297,'从两端取完行李的最小能量','每次取最左或最右剩余行李。左取重w的基础费用为w·X，右取为w·Y；若本次与上次都左取，额外El；若都右取，额外Er；首次不加连续费用。取完全部行李，求最小总能量。','第一行n X Y El Er，第二行weights。原文没有数值界；本站1≤n≤200000，0≤weights[i],X,Y,El,Er≤10^9。输出精确整数，可能超过64位。','枚举最终左取l件、右取r=n−l件。基础费用由前l项与后r项唯一决定；最少左/右连续重复数分别max(0,l−r−1)、max(0,r−l−1)。前缀累计，枚举求最小。','固定数量时无论交错顺序如何，左侧恰取前l项、右侧恰取后r项。r次右取最多隔开l个左取为r+1段，所以左重复至少l−r−1，右侧对称；尽量交替、把多出项接在同侧末尾可同时达到两下界。额外费用非负，故该构造最优。枚举全部l覆盖所有方案。','时间O(n)，辅助空间O(1)不含输入；用任意精度整数。',[([42,3,99],4,4,19,1),([5,1],1,10,100,0),([1,1,1],0,0,5,7)],'答案576、15、0。第二例左取5、右取1，避免两次左取的100额外费。',energy_random,energy_edges(),energy_encode,energy_oracle,
'''def solve(d):
    n,X,Y,El,Er=map(int,d[:5]);a=list(map(int,d[5:]));total=sum(a);prefix=0;answer=None
    for left in range(n+1):
        right=n-left;cost=prefix*X+(total-prefix)*Y+max(0,left-right-1)*El+max(0,right-left-1)*Er
        answer=cost if answer is None else min(answer,cost)
        if left<n:prefix+=a[left]
    return str(answer)
''',[('误以为同侧取过一次之后都付额外费','max(0,left-right-1)*El+max(0,right-left-1)*Er','max(0,left-1)*El+max(0,right-1)*Er'),('错误忽略连续额外费用','max(0,left-right-1)*El+max(0,right-left-1)*Er','0')],2200100)

def insert_encode(x):
    initial,target=x;return f'{len(initial)} {len(target)}\n'+seq(initial)+'\n'+seq(target)+'\n'
def insert_oracle(x):
    initial,target=x;best=-1
    for mask in range(1<<len(target)):
        if any(v<=0 and not mask>>i&1 for i,v in enumerate(target)):continue
        chosen=[v for i,v in enumerate(target) if mask>>i&1];at=0
        for v in initial:
            if at<len(chosen) and chosen[at]==v:at+=1
        if at==len(chosen):best=max(best,len(chosen))
    return len(target)-best if best>=0 else -1
def insert_random(r):
    target=r.sample(range(-3,9),r.randint(1,7));initial=[]
    if r.randrange(3)==0:return r.choices(range(-3,9),k=r.randint(1,9)),target
    for v in target:
        initial.extend(r.choices(range(-3,9),k=r.randint(0,1)))
        if v<=0 or r.randrange(2):initial.append(v)
    if not initial:initial=[10]
    return initial,target
def insert_edges():
    yield (range(200000,0,-1),range(1,200001)),199999
    yield ([1]*100000+list(range(-100000,0)),list(range(-100000,0))+list(range(1,100001))),100000
    yield (range(-200000,0),range(-200000,0)),0
    yield ([1]*200000,range(-200000,0)),-1
    yield ([-1,0],[0,-1]),-1
    yield ([-10**9],[-10**9,10**9]),1
add(298,'仅插入正整数使目标成为子序列','initialList可以包含重复整数，finalList各整数互异。每次可在initialList任意位置插入一个正整数，不能删除或重排已有元素。求使finalList成为最终initialList子序列的最少插入数。目标中的0和负整数不能靠插入取得，必须匹配原有元素；无法实现则按本站协议输出−1。','第一行m n，第二行m个initialList整数，第三行n个finalList整数。原文没有数值界，本站1≤m,n≤200000、−10^9≤所有元素≤10^9，finalList互异；不把只能插正数误解为原数组必须全正。原文未定义无解输出，本站不排除无解输入并明确编码−1。','把目标值映射为下标。每个非正目标是强制匹配锚点。扫描initial的匹配下标q，设b为q前最后非正目标下标，最佳前驱只可在[b,q)；区间最大树查询并对q执行chmax。b不存在时允许空前驱0。最终取最后锚点及之后状态最大匹配长度，存在则答案n减它，否则−1。','任意可行方案的原有匹配元素构成目标子序列，且包含全部不能插入的非正元素；其余正元素恰可插入，费用为目标长度减匹配数。处理位置q时，前驱必须在最后强制锚点b之后或就是b，否则跳过不可插入元素；而任何这样的有效前驱已经包含此前所有锚点，连接q合法。按initial顺序更新保证初始元素不重复使用，区间不含q保证目标严格递增。归纳得到所有合法共同子序列的最优长度，末尾再要求最后锚点已被包含即得最少插入；无有效终态说明不存在含全锚点的匹配，也就无法仅插正数完成。','时间O((m+n)log n)，空间O(n+m)。',[([1,2,3,-1],[-1,1,2,3]),([1,3],[1,2,3]),([-1,0],[0,-1])],'答案3、1、−1。第一例必须保留最后的−1，再插入1、2、3；第三例锚点顺序不可能。原文一处子序列方向写反，本站依Returns及完整操作样例明确为final是initial的子序列，并公开补充无解−1。',insert_random,insert_edges(),insert_encode,insert_oracle,
'''def solve(d):
    m,n=map(int,d[:2]);initial=map(int,d[2:2+m]);target=list(map(int,d[2+m:]));position={v:i for i,v in enumerate(target)};before=[];last=-1
    for i,v in enumerate(target):
        before.append(last)
        if v<=0:last=i
    size=1
    while size<n:size*=2
    tree=[-10**9]*(2*size)
    def query(l,r):
        l+=size;r+=size;answer=-10**9
        while l<r:
            if l&1:answer=max(answer,tree[l]);l+=1
            if r&1:r-=1;answer=max(answer,tree[r])
            l//=2;r//=2
        return answer
    for v in initial:
        if v not in position:continue
        q=position[v];b=before[q];best=query(max(0,b),q)
        if b<0:best=max(best,0)
        if best<0:continue
        at=q+size;value=best+1
        if tree[at]>=value:continue
        tree[at]=value;at//=2
        while at:tree[at]=max(tree[2*at],tree[2*at+1]);at//=2
    matched=query(max(0,last),n)
    if last<0:matched=max(matched,0)
    return str(n-matched) if matched>=0 else '-1'
''',[('错误允许跳过所有非正锚点','if v<=0:last=i','if False:last=i'),('错误把目标成员存在性当足够条件','return str(n-matched) if matched>=0 else \'-1\'','return str(sum(v not in position for v in target))')],4800060,time=8)

def merge_oracle(x):
    a,b=x;best=10**9
    for ids in combinations(range(len(a)+len(b)),len(a)):
        ids=set(ids);i=j=0;out=[]
        for at in range(len(a)+len(b)):
            if at in ids:out.append(a[i]);i+=1
            else:out.append(b[j]);j+=1
        best=min(best,sum(out[i]>out[j] for i in range(len(out)) for j in range(i+1,len(out))))
    return best
def merge_edges():
    yield ('z'*1000,'a'*1000),0
    yield ('za'*500,'za'*500),500500
    yield ('z'*1000,'z'*1000),0
add(299,'保持两串内部顺序的最少合并逆序对','将两个小写字符串合并，必须保留每个原串的内部相对顺序，最小化合并串中所有i<j且s[i]>s[j]的数对数量。同一原串内的逆序也计入；相等字符不计。','两行分别为primary、secondary，原界均1≤长度≤1000，仅小写字母。','对两串的每种字母预计算各前缀中严格更大字符数。dp[i][j]为合并前i、j个字符的最少逆序；追加任一串下个字符，增量为两个已用前缀中严格更大的总数。滚动行求解。','每个逆序对恰在其右侧字符被追加时计一次。因此任意合并序列逐步累加的费用恰为所有逆序，包括原串内部和跨串。最后字符必来自两个前缀的末端之一，去掉它得到对应前驱最优子问题，转移穷尽合法合并而不改变内部顺序。','时间O(nm+26(n+m))，空间O(n+m)（字母表26为常数）。',[('zc','d'),('dae','add'),('aa','aa')],'答案2、1、0。第二例可合并为adadde。来源仅算跨串逆序会把第一例少算为1；来源展示的adddae也不是第二例的最优排列。',lambda r:(''.join(r.choices('abcd',k=r.randint(1,6))),''.join(r.choices('abcd',k=r.randint(1,6)))),merge_edges(),lambda x:x[0]+'\n'+x[1]+'\n',merge_oracle,
'''def solve(d):
    a,b=d;n=len(a);m=len(b)
    def tables(s):
        out=[]
        for c in range(26):
            row=[0];total=0
            for v in s:total+=ord(v)-97>c;row.append(total)
            out.append(row)
        return out
    A=tables(a);B=tables(b);previous=[0]*(m+1)
    for j in range(1,m+1):previous[j]=previous[j-1]+B[ord(b[j-1])-97][j-1]
    for i in range(1,n+1):
        c=ord(a[i-1])-97;current=[previous[0]+A[c][i-1]]+[0]*m
        for j in range(1,m+1):
            e=ord(b[j-1])-97
            current[j]=min(previous[j]+A[c][i-1]+B[c][j],current[j-1]+A[e][i]+B[e][j-1])
        previous=current
    return str(previous[m])
''',[('错误把相等字符也计逆序','ord(v)-97>c','ord(v)-97>=c'),('错误忽略原串内部逆序','+A[c][i-1]','+0')],2002,time=8)

def increment_oracle(a):
    target=tuple(a);start=(0,)*len(a);todo=deque([(start,0)]);seen={start}
    while todo:
        state,steps=todo.popleft()
        if state==target:return steps
        for l in range(len(a)):
            for r in range(l+1,len(a)+1):
                nxt=tuple(v+(l<=i<r) for i,v in enumerate(state))
                if all(v<=t for v,t in zip(nxt,target)) and nxt not in seen:seen.add(nxt);todo.append((nxt,steps+1))
def increment_edges():
    yield [100000]*100000,100000
    yield [1,40000]*50000,1999950001
    yield list(range(1,100001)),100000
add(300,'区间整体加一形成目标数组的最少次数','从与target等长的全0数组开始，每次选一个非空连续区间，把其中每项都加1，求形成target最少次数。本站依据该完整练习变体，不声称与实际OA逐字相同。','第一行n，第二行target。原界1≤n≤100000，1≤target[i]≤100000，且保证答案≤2147483647；这是联合约束，不应生成超出32位答案的数组。','从左向右，首项需要target[0]次新操作；之后只在当前高于前项时增加差值个操作。累加首项与所有正差。','覆盖位置i的操作至多target[i−1]次可从左邻继续，因此每个正上升至少新开相应数量的区间，首项也必须新开target[0]个。按高度维护活跃区间，上升开区间、下降结束多余区间，恰可形成所有目标高度且达到该下界。','时间O(n)，辅助空间O(1)不含读取。',[[1,2,3,2,1],[3,1,5,4,2],[2,2]],'答案3、7、2。第二例合法七步：00000→11111→21111→31111→31222→31332→31442→31542，修正来源最后一步不是整体+1的展示错误。',lambda r:[r.randint(1,3) for _ in range(r.randint(1,5))],increment_edges(),arr,increment_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));answer=a[0]
    for previous,current in zip(a,a[1:]):answer+=max(0,current-previous)
    return str(answer)
''',[('错误下降也计操作','max(0,current-previous)','abs(current-previous)'),('错误逐元素独立加','return str(answer)','return str(sum(a))')],700030)

def handlers_encode(x):
    jobs,short,long=x;return f'{len(jobs)} {len(short)}\n'+seq(jobs)+'\n'+seq(short)+'\n'+seq(long)+'\n'
def handlers_oracle(x):
    jobs,short,long=x;best=10**30
    for mask in range(1<<len(jobs)):
        last=[0,0];cost=0
        for i,t in enumerate(jobs):
            h=mask>>i&1;cost+=short[t-1] if last[h]==t else long[t-1];last[h]=t
        best=min(best,cost)
    return best
def handlers_random(r):
    m=r.randint(1,5);return [r.randint(1,m) for _ in range(r.randint(1,9))],[r.randint(0,12) for _ in range(m)],[r.randint(0,12) for _ in range(m)]
def handlers_edges():
    yield ([1]*200000,[10**9]*200000,[0]*200000),199998000000000
    yield (range(1,200001),[0]*200000,[10**9]*200000),200000000000000
    yield ([1,2]*100000,[0,0],[10**9,10**9]),2000000000
add(301,'两个处理器依序完成类型任务的最短总准备时间','依原序将每个任务交给两个处理器之一，各自记住自己上次处理的类型。若与该处理器上次类型相同，费用short[t]，否则long[t]；首次使用费用long[t]。求全部任务的最小总费用，不允许改变顺序。short不保证≤long。','第一行n m，第二行n个类型1..m，第三行m个short，第四行m个long。原文无数值上界；本站1≤n,m≤200000，0≤short[t],long[t]≤10^9，允许short>long和0成本。','处理上一类型p后，状态j记录另一个处理器的上次类型。dp[j]+offset为实际费用。继续用原处理器使所有状态加相同费用；换处理器的最优为min(dp[t]+short[t],min(j≠t)dp[j]+long[t])+旧offset，只更新状态p。维护两个不同索引的最小值，支持单点降低。','每一步只可能继续或切换处理器。继续时上次类型为p，故费用对全部j相同，可由offset表示；切换时旧备用变活跃，旧活跃备用类型为p，因此全部切换汇入同一状态。匹配类型t只能付short，其余才付long，排除t避免short较大时虚构冷启动。状态值只会降低，最小和次小可常数维护；归纳始终保留各状态真实最优。最后全局最小即答案。','时间O(n+m)，空间O(m+n)包含输入。',[([1,1,1],[9],[1]),([1,2,1,2],[0,0],[5,7]),([1,1],[0],[0])],'答案11、12、0。第一例前两次各用一个未使用处理器，第三次不得虚构第三个冷启动处理器。',handlers_random,handlers_edges(),handlers_encode,handlers_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);jobs=map(int,d[2:2+n]);short=[0]+list(map(int,d[2+n:2+n+m]));long=[0]+list(map(int,d[2+n+m:]));inf=10**30;dp=[inf]*(m+1);dp[0]=0;first=(0,0);second=(inf,-1);offset=0;p=0
    for t in jobs:
        without=first[0] if first[1]!=t else second[0]
        switch=offset+min(dp[t]+short[t],without+long[t])
        offset+=short[t] if p==t else long[t]
        value=switch-offset
        if value<dp[p]:
            dp[p]=value;entry=(value,p)
            if first[1]==p:first=entry
            elif second[1]==p:
                second=entry
                if second<first:first,second=second,first
            elif entry<first:second=first;first=entry
            elif entry<second:second=entry
        p=t
    return str(first[0]+offset)
''',[('错误冷启动最小值不排除同类型','without=first[0] if first[1]!=t else second[0]','without=first[0]'),('错误只用一个处理器','return str(first[0]+offset)','return str(offset)')],5600080,time=8)

def intervals_encode(a):return str(len(a))+'\n'+''.join(f'{l} {r}\n' for l,r in a)
def retailers_oracle(a):
    best=0
    for mask in range(1,1<<len(a)):
        ids=[i for i in range(len(a)) if mask>>i&1]
        if any(all(max(a[i][0],a[j][0])<=min(a[i][1],a[j][1]) for j in ids) for i in ids):best=max(best,len(ids))
    return len(a)-best
def retailers_random(r):return [(l,r.randint(l,15)) for l in [r.randint(1,15) for _ in range(r.randint(1,8))]]
def retailers_edges():
    yield [(1,10**9)]+[(2*i,2*i+1) for i in range(1,100000)],0
    yield [(i,i) for i in range(1,100001)],99999
    yield [(10**9,10**9)]*100000,0
add(302,'保留中心区间能接触所有商户的最少删除数','每个商户对应一个闭区间。删除最少商户，使剩余商户中存在一个中心商户，其区间与每个其他剩余商户的区间均相交。共用端点也相交；不要求所有区间有共同交点，也不只是要求整体连通。','第一行n，随后n行start end。原界1≤n≤100000，1≤start≤end≤10^9，允许重复区间。','分别排序全部起点和终点。中心[l,r]可保留数为起点≤r的数量减去终点<l的数量，最大化这个数后从n减去。','不相交的区间恰为在左边结束早于l或在右边开始晚于r，两类互斥；公式精确统计相交者。固定中心时全部相交商户都能保留，且任何不相交者必须删除。枚举每个原商户作为中心涵盖所有合法剩余集合，所以最大可保留数给出最少删除。','时间O(n log n)，空间O(n)。',[[(3,8),(4,5),(6,7),(10,11),(12,13)],[(1,2),(2,3)],[(1,1),(3,3),(5,5)]],'答案2、0、2。第一例中心[3,8]同时接触两个互不相交的小区间，不能用最大同时覆盖数代替。',retailers_random,retailers_edges(),intervals_encode,retailers_oracle,
'''def solve(d):
    from bisect import bisect_left,bisect_right
    values=list(map(int,d[1:]));a=list(zip(values[::2],values[1::2]));starts=sorted(l for l,r in a);ends=sorted(r for l,r in a);best=0
    for l,r in a:best=max(best,bisect_right(starts,r)-bisect_left(ends,l))
    return str(len(a)-best)
''',[('端点接触错误当不交','bisect_left(ends,l)','bisect_right(ends,l)'),('错误返回可保留数量','return str(len(a)-best)','return str(best)')],2200040)

def health_oracle(x):
    a,armor=x
    for initial in range(1,sum(a)+2):
        for chosen in range(len(a)):
            health=initial;alive=True
            for i,v in enumerate(a):
                health-=max(0,v-armor) if i==chosen else v
                if health<=0:alive=False;break
            if alive:return initial
def health_edges():
    yield ([10**9]*100000,10**9),99999000000001
    yield ([1]*100000,10**9),100000
    yield ([10**9],1),1000000000
add(303,'一次护甲且生命始终为正的最低初始生命','依次承受power数组的伤害，任何一轮后生命必须严格大于0。护甲至多用一次，可将该轮伤害降低min(armor,power[i])，不会恢复生命。求最低初始生命。','第一行n armor，第二行power。原界1≤n≤100000，1≤power[i],armor≤10^9。','总伤害减去min(armor,max(power))，再加1。','抵消量最多为护甲值与最大单次伤害的较小者，在最大伤害处使用能达到。剩余每轮伤害非负，生命随轮次不增，所以最终严格正等价于每轮都严格正；初始生命必须比最小总有效伤害至少多1，公式恰可达。','时间O(n)，辅助空间O(1)不含读取，64位。',[([2,7,4,3],4),([1],10),([4,4],1)],'答案13、1、8。第二例伤害可全部抵消，但初始生命仍至少1。',lambda r:([r.randint(1,7) for _ in range(r.randint(1,7))],r.randint(1,12)),health_edges(),ak,health_oracle,
'''def solve(d):
    n,armor=map(int,d[:2]);a=list(map(int,d[2:]));return str(sum(a)-min(armor,max(a))+1)
''',[('误允许生命归零','-min(armor,max(a))+1','-min(armor,max(a))'),('错误护甲可溢出抵消其他轮','min(armor,max(a))','armor')],1100050)

def storage_oracle(x):
    a,k=x
    if not(k<=len(a)<=2*k):return -1
    groups=[];best=10**30
    def visit(i):
        nonlocal best
        if i==len(a):
            if len(groups)==k:best=min(best,max(map(sum,groups)))
            return
        for group in groups:
            if len(group)<2:group.append(a[i]);visit(i+1);group.pop()
        if len(groups)<k:groups.append([a[i]]);visit(i+1);groups.pop()
    visit(0);return best
def storage_random(r):return [r.randint(1,20) for _ in range(r.randint(1,8))],r.randint(1,9)
def storage_edges():
    yield ([10**9]*200000,100000),2000000000
    yield (range(1,200001),150000),200000
    yield ([1]*200000,99999),-1
STORAGE_CODE='''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]))
    if k>n or n>2*k:return '-1'
    pairs=n-k;answer=a[-1]
    for i in range(pairs):answer=max(answer,a[i]+a[2*pairs-1-i])
    return str(answer)
'''
for number in (304,305):
    add(number,'每人一至两个游戏的最小容量'+('（分配版）' if number==304 else ''),'将全部游戏分给恰好k个孩子，每个孩子至少一个、至多两个；同一个游戏只能分给一人。各孩子存储容量相同，求能完成分配的最小容量，即最小化各孩子得到游戏大小总和的最大值。','第一行n k，第二行游戏大小。原文无数值界，本站补充1≤n,k≤200000，1≤size[i]≤10^9；不排除无解输入，本站明确无解输出−1。','若k>n或n>2k则无解。否则必须有p=n−k个双件组；排序后最小2p个从两端配对，剩余较大者单独成组，取全部组负载最大值。','组数与件数决定双件组恰有p个。若某个较大游戏在双件组、较小游戏单独，交换它们不增加任一新组相对于原最大负载的上界，因此最小2p个配对总不劣。对这些数，若最大未与最小配对，交换这两个所在组的搭档，新的两组和均不超过原两组和最大值；归纳得到极端配对最优。计入所有单件负载得到答案。','时间O(n log n)，空间O(n)。',[([9,2,4,6],3),([8,3,5,4],2),([1,2,3],1)],'答案9、11、−1。第一例2和4一组，其余6、9各一组；把最大游戏9配对并非最优。来源304含不终止占位循环，305也把大游戏错误配对；本站代码原创。',storage_random,storage_edges(),ak,storage_oracle,STORAGE_CODE,[('错误把最大若干游戏配对','a[2*pairs-1-i]','a[n-1-i]'),('错误忽略必须配成双件的容量','return str(answer)','return str(a[-1])')],2200050)

def packaging_encode(x):
    a,c=x;return f'{len(a)} {len(c)}\n'+seq(a)+'\n'+seq(c)+'\n'
def packaging_oracle(x):
    a,c=x;m=len(a);full=(1<<m)-1
    costs=[]
    for threshold in c:
        table=[]
        for mask in range(1<<m):
            group=sorted(a[i] for i in range(m) if mask>>i&1)
            table.append(sum(group)-(sum(group[:2]) if len(group)>=threshold+2 else 0))
        costs.append(table)
    @lru_cache(None)
    def visit(center,mask):
        if center==len(c):return 0 if mask==0 else 10**30
        best=10**30;part=mask
        while True:
            best=min(best,costs[center][part]+visit(center+1,mask^part))
            if not part:break
            part=(part-1)&mask
        return best
    return visit(0,full)
def packaging_random(r):return [r.randint(0,12) for _ in range(r.randint(1,8))],[r.randint(1,6) for _ in range(r.randint(1,4))]
def packaging_edges():
    yield ([10000]*100000,[1]*100000),333340000
    yield ([10000]*99999+[0],[1]),999980000
    yield ([0]*100000,[1000000000]*100000),0
add(307,'一次性使用各中心的最少包装工作量','m件物品必须恰好包装一次。每个中心至多使用一次，也可不用；在中心i支付至少packageCount[i]件的工作量可另免2件，两个免费件的工作量各不得大于该中心任何付费件。一个中心只能获得这一组2件优惠，其余物品须付费。可以在中心只付费而不领取优惠，也可未达到阈值只付费。求所有物品的最小总付费工作量。','第一行m n，第二行m个packEffort，第三行n个packageCount。原界1≤m,n≤100000，0≤packEffort[i]≤10000。原文未给阈值数值界，本站补充1≤packageCount[i]≤10^9；不额外限制阈值≤m。','effort降序、阈值升序，依次用最小阈值中心：先付阈值件，再免接下来两件，记录节省。尚有未用中心时可将所有余项付费放入它；若使用最后一个中心，它必须承担所有余项，故其免费件改为全局最小两件。比较全部前缀使用数量及0优惠。','固定一组付费件，免费件必须不大于其中最小值。将各优惠组按价值高低整理时，若后组较大项与前组较小项交叉，可交换直到组连续而不降低免费总值；把较小阈值放前会让前组免费位置更早，后组结束位置不变，因此不减节省。非最后中心只付阈值数量即可，额外付费移交余项组不影响其优惠。若还有未用中心，它可承载全部余项且放弃优惠；若没有，则最后组须含剩余全部物品，只有全局最小两项能不大于全部余下付费项。算法分别枚举每个可能优惠组数，按此交换得到可达最优节省，减去总和即最少费用。','时间O(m log m+n log n)，空间O(m+n)。',[([10,9,8,1],[1]),([6,5,4,3,2,1],[1,1]),([0,0,0],[7])],'答案19、9、0。第一例唯一中心要容纳全部四件，只能免8和1，不能先付10免9和8后把1留在不存在的中心。第二例两个中心分别付6免5、4和付3免2、1。',packaging_random,packaging_edges(),packaging_encode,packaging_oracle,
'''def solve(d):
    m,n=map(int,d[:2]);a=sorted(map(int,d[2:2+m]),reverse=True);c=sorted(map(int,d[2+m:]));cursor=saving=best=0
    for j,threshold in enumerate(c):
        if cursor+threshold+2>m:break
        if j==n-1:
            best=max(best,saving+a[-2]+a[-1]);break
        cursor+=threshold;saving+=a[cursor]+a[cursor+1];cursor+=2;best=max(best,saving)
    return str(sum(a)-best)
''',[('错误最后中心也只看阈值后下一对','saving+a[-2]+a[-1]','saving+a[cursor+threshold]+a[cursor+threshold+1]'),('错误只允许第一个中心优惠','for j,threshold in enumerate(c):','for j,threshold in enumerate(c[:1]):')],1800060,time=8)

def weekly_oracle(x):
    a,weeks=x
    return min(sum(max(a[l:r]) for l,r in zip((0,)+cuts,cuts+(len(a),))) for cuts in combinations(range(1,len(a)),weeks-1))
def weekly_edges():
    yield ([100000]*300,300),30000000
    yield (range(1,301),150),11475
    yield ([100000]*300,1),100000
add(309,'按顺序划分每周活动的最小最大值之和','把全部活动按原序分成恰好weeks个非空连续组，每组安排在一周；该周投入等于组中活动投入的最大值。求所有周投入总和最小值。','第一行n weeks，第二行投入数组。原界1≤n≤300，1≤weeks≤n，1≤cost[i]≤100000。','dp[w][i]表示前i个活动分w周的最少总投入，枚举最后一周起点j，转移dp[w−1][j]+max(cost[j:i])。向左枚举j时维护区间最大值，滚动周数层。','任意合法方案最后一周是一个非空后缀，其之前恰分w−1周；若前段不是最优可替换使总成本更低。枚举全部j囊括每个最后分割点，同时w≤j+1保证每周非空。初始0项0周费用0，其余无穷，归纳得到所求最优。','时间O(weeks·n²)，空间O(n)。',[([1000,500,2000,8000,1500],3),([1,2,3],3),([5,1,4],1)],'答案9500、6、5。必须恰好指定周数，不能空周，也不能把活动重排。',lambda r:([r.randint(1,20) for _ in range(n)],r.randint(1,n)) if (n:=r.randint(1,8)) else None,weekly_edges(),ak,weekly_oracle,
'''def solve(d):
    n,weeks=map(int,d[:2]);a=list(map(int,d[2:]));inf=10**30;previous=[0]+[inf]*n
    for w in range(1,weeks+1):
        current=[inf]*(n+1)
        for i in range(w,n+1):
            high=0
            for j in range(i-1,w-2,-1):high=max(high,a[j]);current[i]=min(current[i],previous[j]+high)
        previous=current
    return str(previous[n])
''',[('错误区间最大值初始化为无穷','high=0','high=10**30'),('错误允许少于指定周数','return str(previous[n])','return str(max(a))')],220050,time=8)

def pair_encode(transactions):return str(len(transactions))+'\n'+''.join(str(len(t))+' '+seq(t)+'\n' for t in transactions)
def pair_oracle(transactions):
    names=sorted(set(v for t in transactions for v in t));best=0;answer=None
    for a,b in combinations(names,2):
        count=sum(a in t and b in t for t in transactions)
        if count>best:best=count;answer=(a,b)
    return '-1' if answer is None else ' '.join(answer)
def name26(v,width=10,upper=True):
    alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ' if upper else 'abcdefghijklmnopqrstuvwxyz';s=''
    while v:s=alphabet[v%26]+s;v//=26
    return s.rjust(width,alphabet[0])
def pair_edges():
    yield [[name26(i*100+j,100) for j in range(100)] for i in range(1000)],name26(0,100)+' '+name26(1,100)
    yield [[name26(j,100) for j in range(100)] for _ in range(1000)],name26(0,100)+' '+name26(1,100)
    yield [['Z'*100]*100 for _ in range(1000)],'-1'
add(310,'共同出现交易数最多的产品对','一笔交易中的产品名可重复，但某对不同产品在同一笔交易只计一次。产品对无序，先把两个名称按字典序排列。求共同出现交易数最多的产品对，次数相同时取字典序最小的名称对；若没有任何不同产品对，按本站协议输出−1。','第一行交易数T，随后每笔一行：k及k个产品名。原界1≤T≤1000、每笔1≤k≤100，名称由大写字母组成。原文未给名称长度界，本站补充1≤长度≤100；不限制全局产品总数，允许100000个互不相同产品。','每个产品建立至多T位的交易出现bitmask。逐交易去重并枚举其不同产品对，以两个mask按位与后的bit_count得到精确频率；只维护当前最高频及字典序最小对，不保存全部pair表。','一对产品共同出现的交易恰为两个出现集合的交集，所以位交集数即题目频率。任何有正频率的产品对至少在一笔交易被枚举，因此候选覆盖全部有效答案。重复枚举同对不会改变最大值和平局结果。交易内先去重，重复名字不产生自配对也不加重一笔交易权重。','至多T·100·99/2=4950000次候选评估，每次位操作至多1000位；空间O(U·T/字长+输入)，不存最多495万pair对象。',[ [['A','B','B'],['B','C'],['A','B']], [['C','B','A']], [['A','A'],['B']] ],'答案A B、A B、−1。第二例所有三对频率同为1，按两名称组成的有序元组比较字典序。',lambda r:[r.choices(['A','B','C','D','AA'],k=r.randint(1,6)) for _ in range(r.randint(1,7))],pair_edges(),pair_encode,pair_oracle,
'''def solve(d):
    count=int(d[0]);at=1;transactions=[];masks={}
    for i in range(count):
        size=int(d[at]);at+=1;names=sorted(set(d[at:at+size]));at+=size;transactions.append(names);bit=1<<i
        for name in names:masks[name]=masks.get(name,0)|bit
    best=0;answer=None
    for names in transactions:
        for i,a in enumerate(names):
            left=masks[a]
            for j in range(i+1,len(names)):
                b=names[j];frequency=(left&masks[b]).bit_count();pair=(a,b)
                if frequency>best or frequency==best and (answer is None or pair<answer):best=frequency;answer=pair
    return '-1' if answer is None else ' '.join(answer)
''',[('频率平局错误取字典序最大','pair<answer','pair>answer'),('错误将并集交易数当共同出现','left&masks[b]','left|masks[b]')],10105050,time=10,output='输出两个名称，按字典序从小到大，用空格分隔；不存在不同产品对则输出−1。')

def duplicate_encode(a):return json.dumps(a,ensure_ascii=False,separators=(',',':'))+'\n'
def duplicate_oracle(a):return sum(any(i!=j and row==other for j,other in enumerate(a)) for i,row in enumerate(a))
def duplicate_edges():
    yield [('z'*10,1000,1000)]*100000,100000
    yield [(name26(i,10,False),1000,1000) for i in range(100000)],0
    yield [('',1,1)]*100000,100000
add(312,'具有同名同价同重伙伴的产品总数','每个产品记录为名称、价格、重量。如果存在另一个产品与其三项完全相同，则该产品为重复产品。求所有满足该条件的产品数量；同一重复组中的第一件也计入，所以两个完全相同产品贡献2，三个贡献3。不是删除重复项所需删除数。','标准输入是一个JSON数组，每项为[name,price,weight]。原界1≤n≤100000，1≤price,weight≤1000，name仅小写字母且最多10字符；保留长度0的空名称，以JSON字符串""编码，不自行添加非空下界。','以(name,price,weight)元组计数，将出现次数≥2的组的全部次数求和。','若某组次数为1，其中唯一产品找不到另一个相同产品，贡献0；若次数至少2，组内每一件都能以另一件作见证，因此全部计入。不同组由至少一项差别互斥，逐组求和不重复不遗漏。','期望时间O(n)，空间O(n)，字符串最多10字符。',[[('a',1,1),('a',1,1)],[('a',1,1),('a',1,2),('b',1,1)],[('',2,3),('',2,3),('',2,3)]],'答案2、0、3。本站依原文“有另一个相同产品即为duplicate”的逐产品定义公开消歧；来源说明中通常不计首件的说法与正式定义及其代码不同，不采用。',lambda r:[(r.choice(['','a','b','aa']),r.randint(1,3),r.randint(1,3)) for _ in range(r.randint(1,10))],duplicate_edges(),duplicate_encode,duplicate_oracle,
'''def solve(d):
    import json
    from collections import Counter
    products=json.loads(' '.join(d));count=Counter(tuple(row) for row in products)
    return str(sum(c for c in count.values() if c>1))
''',[('错误每组少计第一件','sum(c for c in count.values() if c>1)','sum(c-1 for c in count.values() if c>1)'),('错误只比较名称','tuple(row) for row in products','row[0] for row in products')],3000050)

def idle_oracle(points):
    return sum(any(u<x and v==y for u,v in points) and any(u>x and v==y for u,v in points) and any(u==x and v<y for u,v in points) and any(u==x and v>y for u,v in points) for x,y in points)
def idle_random(r):return r.sample(list(product(range(-3,4),repeat=2)),r.randint(1,18))
def idle_edges():
    yield [(x,y) for x in range(250) for y in range(400)],98704
    yield [(i,0) for i in range(100000)],0
    yield [(10**9,10**9),(-10**9,10**9),(10**9,-10**9),(-10**9,-10**9),(0,0)],0
add(313,'四个轴向都有其他机器人的空闲机器人数量','n个机器人在互异整数坐标。若某机器人在同一行左侧、右侧以及同一列上方、下方均有另一个机器人，则为空闲。这些机器人不必距离1，中间可有空位；求空闲数量。','第一行n，随后n行x y。原界1≤n≤100000，−10^9≤x,y≤10^9，坐标对互异。','记录每一行x的最小最大值、每一列y的最小最大值；机器人x严格介于该行极值之间，且y严格介于该列极值之间时计入。','同行存在更小x与更大x当且仅当x严格介于该行两个极值；同列上下同理。四个条件彼此独立，合取恰为题目空闲定义。只用极值不会要求距离1，也不会把机器人自身当作严格方向上的邻居。','时间O(n)，空间O(n)。',[[(0,0),(-2,0),(2,0),(0,-3),(0,3)],[(0,0),(1,0),(2,0)],[(0,0),(1,0),(0,1),(1,1)]],'答案1、0、0。第一例所有邻居都不必距离1，仍使中心空闲。',idle_random,idle_edges(),intervals_encode,idle_oracle,
'''def solve(d):
    v=list(map(int,d[1:]));points=list(zip(v[::2],v[1::2]));rows={};cols={}
    for x,y in points:
        if y not in rows:rows[y]=[x,x]
        else:rows[y][0]=min(rows[y][0],x);rows[y][1]=max(rows[y][1],x)
        if x not in cols:cols[x]=[y,y]
        else:cols[x][0]=min(cols[x][0],y);cols[x][1]=max(cols[x][1],y)
    return str(sum(rows[y][0]<x<rows[y][1] and cols[x][0]<y<cols[x][1] for x,y in points))
''',[('错误只检查左右方向','and cols[x][0]<y<cols[x][1]',''),('错误把自身也当两侧邻居','rows[y][0]<x<rows[y][1] and cols[x][0]<y<cols[x][1]','rows[y][0]<=x<=rows[y][1] and cols[x][0]<=y<=cols[x][1]')],2400040)

def suitable_oracle(x):
    a,d=x;left=max(-10**9,min(a)-d//2);right=min(10**9,max(a)+d//2)
    return sum(2*sum(abs(v-p) for v in a)<=d for p in range(left,right+1))
def suitable_edges():
    yield ([0]*100000,10**15),2000000001
    yield ([-10**9]*50000+[10**9]*50000,0),0
    yield ([10**9]*100000,0),1
    yield ([0],10**15),2000000001
add(314,'原数轴内满足总往返距离预算的整数仓库位置数','给配送中心坐标centers，仓库必须设在整数位置−10^9到10^9（两端包含）。与每个中心分别往返，因此总路程为2·Σ|center[i]−warehouse|。求总路程不超过d的仓库位置数量。','第一行n d，第二行centers。原界1≤n≤100000，−10^9≤centers[i]≤10^9，0≤d≤10^15；保留原文数轴位置界，不扩成无限整数数轴。','排序取中位点。若中位点成本超预算则答案0；否则分别在左端至中位点、和中位点至右端二分最左/最右可行整数。成本用排序前缀和及二分分割点计算，得到R−L+1。','绝对距离和在中位数处最小，向中位区间两侧移动单调不减。因此中位点不可行时全域无解，可行时左右各自具有一次真假变化，分开二分得到两个精确边界。前缀中≤p者贡献p·个数−和，其余贡献和−p·个数，乘2恰为往返路程。可行位置是闭整数区间，长度为R−L+1，并与原数轴两端严格一致。','时间O(n log n+log(2·10^9)·log n)，空间O(n)。',[([0],4),([-2,2],8),([0,5],1)],'答案5、5、0。第二例−2到2各点往返总路程都为8。预算再大也不能计入原数轴±10^9之外的位置。',lambda r:([r.randint(-8,8) for _ in range(r.randint(1,7))],r.randint(0,50)),suitable_edges(),ak,suitable_oracle,
'''def solve(d):
    from bisect import bisect_right
    n,budget=map(int,d[:2]);a=sorted(map(int,d[2:]));prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    def cost(p):
        count=bisect_right(a,p);return 2*(p*count-prefix[count]+prefix[n]-prefix[count]-p*(n-count))
    middle=a[n//2]
    if cost(middle)>budget:return '0'
    l=-10**9;r=middle
    while l<r:
        mid=(l+r)//2
        if cost(mid)<=budget:r=mid
        else:l=mid+1
    first=l;l=middle;r=10**9
    while l<r:
        mid=(l+r+1)//2
        if cost(mid)<=budget:l=mid
        else:r=mid-1
    return str(l-first+1)
''',[('错误只算单程','return 2*(','return 1*('),('错误遗漏端点个数','l-first+1','l-first')],1200080)

def groups_oracle(x):
    a,k=x;return sum(max(a[l:r])-min(a[l:r])==k for l in range(len(a)) for r in range(l+1,len(a)+1))
def groups_edges():
    yield ([10**9]*200000,0),20000100000
    yield ([-10**9,10**9]*100000,2000000000),19999900000
    yield (range(200000),-1),0
add(315,'最大最小差恰好k的连续小组数量','每个非空连续子数组视为一个小组；若其最大值减最小值恰好为k，则表现良好。不同起止位置是不同小组，即使元素值相同。求表现良好小组总数。','第一行n k，第二行数组。原文无数值界，本站1≤n≤200000、−10^9≤a[i]≤10^9、−2000000000≤k≤2000000000；负k自然无合法小组，不排除。','用两个单调队列维护窗口最大最小，计算范围差≤K的窗口数atMost(K)：每个右端加合法后缀长度。答案atMost(k)−atMost(k−1)，负K返回0。','对固定右端，去掉左端元素不会增大范围差，因此合法窗口的左端构成后缀。双指针找到最早合法左端后，全部更晚左端都合法，数量为右−左+1。最大/最小单调队列给出窗口准确极值，每元素至多进出一次。整数差恰为k当且仅当≤k但不≤k−1，两计数相减不重不漏。','时间O(n)，空间O(n)，结果用64位。',[([2,4,6],2),([2,2,2],0),([1],-1)],'答案2、6、0。第二例所有6个非空子数组均计入，不能每个右端只加1。',lambda r:([r.randint(-5,5) for _ in range(r.randint(1,10))],r.randint(-2,10)),groups_edges(),ak,groups_oracle,
'''def solve(d):
    from collections import deque
    n,k=map(int,d[:2]);a=list(map(int,d[2:]))
    def at_most(limit):
        if limit<0:return 0
        low=deque();high=deque();left=total=0
        for right,v in enumerate(a):
            while low and a[low[-1]]>=v:low.pop()
            while high and a[high[-1]]<=v:high.pop()
            low.append(right);high.append(right)
            while a[high[0]]-a[low[0]]>limit:
                if low[0]==left:low.popleft()
                if high[0]==left:high.popleft()
                left+=1
            total+=right-left+1
        return total
    return str(at_most(k)-at_most(k-1))
''',[('错误返回至多k而非恰好k','at_most(k)-at_most(k-1)','at_most(k)'),('错误每右端只计一个窗口','total+=right-left+1','total+=1')],2400080,time=8)

def main():
    base.main()
    path=base.OUT/'reviews'/f'{base.BATCH}.json';data=json.loads(path.read_text())
    data['items'].extend([dict(id='oa-amazon-306',status='blocked',reason='raw正文实际截断为Example output is a p，样例说明自己称placeholder。缺交换是否相邻等核心规则，不能用源程序替代题意。'),dict(id='oa-amazon-308',status='blocked',reason='raw明写adjacent但两样例均冲突：01!0,x2,y3相邻最优5不是8；!0!1,x3,y4相邻最优3、全子序列对最优9，均不是7。核心计费目标未明确，不能自行选一种上线。'),dict(id='oa-amazon-311',status='blocked',reason='raw正文只有SDE II及破损标签，没有perfect定义。样例acababa含aba，不能使用catalog补写的无长度>=2回文定义；也不能由源程序擅定相邻不等。')])
    slugs=['minimum-cost-to-convert-products-to-variant-a','minimum-energy-cost','minimum-insertions','minimum-merge-conflicts','minimum-number-of-increments-on-subarrays-to-form-a-target-array','minimum-preparation-time-for-two-handlers','minimum-retailers','minimum-starting-health-to-win-the-game','minimum-storage-capacity-required','minimum-storage-capacity','minimum-swaps-to-make-palindrome','minimum-total-packaging-effort','minimum-value-calculation-by-replacing','minimum-weekly-input','most-common-product-pair','next-greater-perfect-string','num-duplicates','num-idle-drives','num-of-suitable-places','number-of-well-performing-groups']
    catalog={v['id']:v for v in json.loads((base.ROOT/'content/oa-master/catalog.json').read_text())['items']}
    for item in data['items']:
        n=int(item['id'].split('-')[-1]);relative='fastprep/Amazon/amazon-'+slugs[n-296]+'.md';raw=(Path('/tmp/cswork-oa-source-20260919')/relative).read_bytes()
        item['sourceEvidence']=[dict(commit='e66f809f4c953bce129f68491726176615db6afc',path=relative,gitBlobSha1=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=catalog[item['id']]['contentHash'])]
    data['items'].sort(key=lambda v:int(v['id'].split('-')[-1]));path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
