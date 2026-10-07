"""Amazon 26–50: independently authored algorithms and differential tests."""
from collections import Counter, deque
from functools import lru_cache
from itertools import combinations, permutations
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'
BATCH='amazon-remaining-b'
SEED=20260926
SPECS=[]


def arr(a): return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def pair_arrays(x): return f'{len(x[0])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n'
def param_array(x): return f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n'
def add(number,title,description,input_format,idea,proof,complexity,samples,oracle,random_case,encode,code,mutants,edges,explanation,**extra):
    SPECS.append(dict(number=number,title=title,description=description,input=input_format,idea=idea,proof=proof,complexity=complexity,
        samples=samples,oracle=oracle,random=random_case,encode=encode,code=code,mutants=mutants,edges=edges,explanation=explanation,**extra))


def grey_oracle(grid):
    return max(sum(1 if c=='1' else -1 for c in grid[i])+sum(1 if row[j]=='1' else -1 for row in grid) for i in range(len(grid)) for j in range(len(grid[0])))


add(26,'像素矩阵的最大灰度',
    '格子(i,j)的灰度等于所在行与所在列的1总数减去0总数；交点格子分别在行、列中各计一次。求最大灰度。',
    '第一行n m（均1..1000），随后n行长度m的01串。',
    '分别统计每行和每列的1数量；最大灰度为2×(最大行1数+最大列1数)−n−m。',
    '行贡献为2rowOnes−m，列贡献为2colOnes−n。可独立选择最大行与最大列，它们的交点同时取得两项最大值。',
    '时间O(nm)，空间O(m)。',[['101','001','110'],['0'],['11','11']],grey_oracle,
    lambda r:[''.join(r.choice('01') for _ in range(m)) for m in [r.randint(1,6)] for _ in range(r.randint(1,6))],
    lambda g:f'{len(g)} {len(g[0])}\n'+'\n'.join(g)+'\n',
    '''def solve(d):
    n,m=map(int,d[:2]); columns=[0]*m; best=0
    for row in d[2:]:
        best=max(best,row.count('1'))
        for j,c in enumerate(row): columns[j]+=c=='1'
    return str(2*(best+max(columns))-n-m)
''',[('不减零像素','-n-m',''),('只检查第一列','max(columns)','columns[0]')],
    [(['0'*1000]*1000,-2000),(['1'*1000]*1000,2000)],
    '样例1：第一行和第一列各有两个1、一个0，灰度为(2+2)−(1+1)=2。样例2：唯一0在行列各计一次，灰度−2。样例3：每行列都是两个1，最大灰度4。')


def health_oracle(x):
    powers,armor=x
    best=sum(powers)+1
    for chosen in range(len(powers)):
        damage=0; required=1
        for i,v in enumerate(powers):
            damage+=v-(min(v,armor) if i==chosen else 0); required=max(required,damage+1)
        best=min(best,required)
    return best


add(27,'使用一次护甲的最低生命值',
    '依次承受每轮伤害，生命值始终必须严格大于0。可在一轮使用护甲，抵消min(护甲值,本轮伤害)点伤害。求最低初始生命值。',
    '第一行n armor（1≤n≤100000，1≤armor≤10⁹）；第二行n个伤害（1..10⁹）。',
    '总伤害减去最多能抵消的min(armor,max(power))，最后加1。',
    '有效伤害均非负，最后时刻的累计伤害最大。护甲一次只能抵消不超过armor且不超过所选伤害的值，在最大伤害轮达到最大减免。加1恰好保证严格存活。',
    '时间O(n)，额外空间O(1)（不计输入）。',[([1,2,6,7],5),([1],9),([5,5],1)],health_oracle,
    lambda r:([r.randint(1,20) for _ in range(r.randint(1,10))],r.randint(1,30)),param_array,
    '''def solve(d):
    n,armor=map(int,d[:2]); a=list(map(int,d[2:]))
    return str(sum(a)-min(armor,max(a))+1)
''',[('生命值允许等于零','+1)',')'),('护甲抵消超过单轮伤害','min(armor,max(a))','armor')],
    [(([10**9]*100000,10**9),99999*10**9+1),(([1]*100000,10**9),100000)],
    '样例1：总伤害16，护甲抵消5，剩余伤害11，初始生命需12。样例2：抵消唯一1点伤害，初始生命1即可。样例3：抵消1后总伤害9，需10。')


def permutation_oracle(a):
    best=None; result=None
    for p in permutations(range(len(a))):
        score=sum((i+1)*a[j] for i,j in enumerate(p))
        if best is None or score>best: best=score;result=p
    return ' '.join(str(i+1) for i in result)


add(28,'加权总和最大的最小字典序排列',
    '输出1..n的一个排列p，使Σ i×data[p[i]−1]最大，i从1开始。最大值相同时取字典序最小的下标排列。',
    '第一行n（1..100000），第二行n个正整数（1..10⁹）。',
    '按元素值升序排列下标；值相同时按原下标升序。',
    '若较大的值位于较小权重位置，交换后增益为两个正差的乘积，因此最优排列值非降。相等值可任意交换而不改总和，升序下标给出字典序最小方案。',
    '时间O(n log n)，空间O(n)。',[[2,1,2],[7],[3,3,1]],permutation_oracle,
    lambda r:[r.randint(1,8) for _ in range(r.randint(1,7))],arr,
    '''def solve(d):
    a=list(map(int,d[1:])); order=sorted(range(len(a)),key=lambda i:(a[i],i))
    return ' '.join(str(i+1) for i in order)
''',[('相等值下标逆序','(a[i],i)','(a[i],-i)'),('把值按降序排序','(a[i],i)','(-a[i],i)')],
    [([1]*100000,' '.join(map(str,range(1,100001))))],
    '样例1：值的顺序为1、2、2，相等的两个2按原下标1、3排列，输出2 1 3，总和11。样例2：只能输出1。样例3：值1先放，下标1、2随后，输出3 1 2。',output='输出n个下标。')


def hubs_oracle(x):
    a,queries=x
    return ' '.join(str(sum(a[min(h for h in [u-1,v-1,len(a)-1] if h>=i)]-value for i,value in enumerate(a))) for u,v in queries)
def hubs_random(r):
    n=r.randint(3,10); a=sorted(r.randint(1,30) for _ in range(n)); queries=[]
    for _ in range(r.randint(1,6)): queries.append(tuple(sorted(r.sample(range(1,n),2))))
    return a,queries


add(29,'新增枢纽的仓库连接成本',
    '仓库容量非降排列，仓库i连接到不小于i的最近枢纽j，成本为capacity[j]−capacity[i]。仓库n始终是枢纽，每个查询独立增加hubA、hubB两个枢纽，输出总连接成本。来源样例13有误，按定义正确成本为5。',
    '第一行n q（3≤n≤200000，1≤q≤200000）；第二行n个非降容量（1..10⁹）；随后q行A B，1≤A<B<n。',
    '用前缀和分别计算连接到A、B、n的三段，每段成本为段长×枢纽容量−段内容量和。',
    '最近右侧枢纽把仓库恰分成[1,A]、[A+1,B]、[B+1,n]，每段枢纽相同，逐项成本求和得到公式。查询之间相互独立。',
    '时间O(n+q)，空间O(n+q)。',[([1,2,4,6,9],[(1,3)]),([1,1,1],[(1,2)]),([1,3,6,10],[(1,2),(2,3)])],hubs_oracle,hubs_random,
    lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+''.join(f'{a} {b}\n' for a,b in x[1]),
    '''def solve(d):
    n,q=map(int,d[:2]); a=list(map(int,d[2:2+n])); prefix=[0]
    for v in a: prefix.append(prefix[-1]+v)
    answer=[]
    for j in range(2+n,len(d),2):
        u,v=map(int,d[j:j+2]); total=0; start=0
        for end in (u,v,n):
            total+=(end-start)*a[end-1]-(prefix[end]-prefix[start]); start=end
        answer.append(str(total))
    return ' '.join(answer)
''',[('漏算最后一段','(u,v,n)','(u,v)'),('错把枢纽编号作容量','a[end-1]','end')],
    [(([10**9]*200000,[(1,199999)]), '0'),(([1,2,3],[(1,2)]*200000),' '.join(['0']*200000))],
    '样例1：枢纽1、3、5；仓库成本依次为0、2、0、3、0，总和5。样例2：容量全相同，成本0。样例3：枢纽1、2、4时只有仓库3支付10−6=4；枢纽2、3、4时只有仓库1支付3−1=2。',output='按查询顺序输出q个整数。')


def splits_oracle(x):
    s,m=x
    return sum(len(set(s[:i])&set(s[i:]))>m for i in range(1,len(s)))


add(30,'公共字符种类超过阈值的切分',
    '将小写字符串切成两个非空连续部分，若两部分都出现的不同字符数量严格大于m，则切分合法。求合法切分数。',
    '第一行字符串（长度1..100000），第二行m（0..26）。',
    '左右频次随切分点移动更新，每次统计左右频次都非零的字母数。',
    '移动一个字符后频次数组恰对应当前左右子串。一个字母属于交集当且仅当两边频次均正。逐个枚举所有非空切分，按严格阈值计数。',
    '时间O(26n)，空间O(26)。',[('abbcac',1),('a',0),('aaaa',0)],splits_oracle,
    lambda r:(''.join(r.choice('abcd') for _ in range(r.randint(1,12))),r.randint(0,5)),lambda x:f'{x[0]}\n{x[1]}\n',
    '''def solve(d):
    s=d[0]; m=int(d[1]); left=[0]*26; right=[0]*26; answer=0
    for c in s: right[ord(c)-97]+=1
    for c in s[:-1]:
        k=ord(c)-97; left[k]+=1; right[k]-=1
        answer+=sum(a>0 and b>0 for a,b in zip(left,right))>m
    return str(answer)
''',[('允许公共种类等于阈值',')>m',')>=m'),('把同字符多次出现当种类','sum(a>0 and b>0 for a,b in zip(left,right))','sum(min(a,b) for a,b in zip(left,right))')],
    [(('a'*100000,0),99999),(('a'*100000,1),0)],
    '样例1：切在ab|bcac和abbc|ac时，交集分别为{a,b}和{a,c}，均有2种字符，故答案2。样例2：无法分成两个非空部分，答案0。样例3：三个切分点两边都有a，均超过阈值0，答案3。')


def cart_oracle(x):
    a,q=x; result=a[:]
    for v in q:
        if v>0: result.append(v)
        else: result.remove(-v)
    return ' '.join(map(str,[len(result)]+result))
def cart_random(r):
    a=[r.randint(1,5) for _ in range(r.randint(1,8))]; live=a[:]; q=[]
    for _ in range(r.randint(1,12)):
        if live and r.randrange(2):
            v=r.choice(live);q.append(-v);live.remove(v)
        else:
            v=r.randint(1,5);q.append(v);live.append(v)
    return a,q


add(31,'购物车追加与首次删除',
    '初始购物车保持给定顺序。正查询x把x追加到末尾；负查询−x删除当前购物车里第一次出现的x。输出最终购物车。本站用例保证每次删除时对应商品存在，不定义来源未说明的缺失商品删除行为。',
    '第一行n q（均1..200000），第二行n个初始商品（1..10⁹），第三行q个非零查询（−10⁹..10⁹）。每个删除查询对应商品当前存在。',
    '给每次追加分配唯一递增位置。共享next数组把相同商品的位置连起来，字典只保存每种商品的头尾索引；删除时移动头索引并标记。最后顺序输出未删除位置。',
    '同种商品索引链按加入先后排列，删除链头恰是首次当前出现。全局位置递增保留购物车顺序，过滤删除标记后就是最终结果。所有商品共用索引数组，不为每个不同值创建独立deque。',
    '时间O(n+q)，空间O(n+q)。',[([1,2,1,2,1],[-1,-1,3,4,-3]),([1],[-1]),([2,1,2],[-2,2])],cart_oracle,cart_random,
    lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',
    '''def solve(d):
    n,q=map(int,d[:2]); values=[]; removed=[]; following=[]; head={}; tail={}
    for token in d[2:]:
        v=int(token)
        if v>0:
            index=len(values); previous=tail.get(v,-1)
            if previous>=0: following[previous]=index
            else: head[v]=index
            tail[v]=index; values.append(v); removed.append(False); following.append(-1)
        else:
            value=-v; index=head[value]; head[value]=following[index]; removed[index]=True
            if head[value]<0: tail[value]=-1
    answer=[v for i,v in enumerate(values) if not removed[i]]
    return ' '.join(map(str,[len(answer)]+answer))
''',[('颠倒剩余商品次序',"[len(answer)]+answer","[len(answer)]+answer[::-1]"),('删除后仍输出该位置','removed[index]=True','removed[index]=False')],
    [(([1]*200000,[-1]*200000),'0'),
     ((list(range(1,200001)),list(range(200001,400001))),'400000 '+' '.join(map(str,range(1,400001))))],
    '样例1：删除前两次出现的1后剩[2,2,1]，追加3、4再删除3，最后[2,2,1,4]，先输出数量4。样例2：删除唯一商品后输出0。样例3：删除最前面的2再追加2，得到[1,2,2]，输出3 1 2 2。',output='先输出最终商品数量，再按顺序输出商品；为空只输出0。')


def ring_oracle(x):
    total,servers=x; needed=set(servers); bits={v:i for i,v in enumerate(needed)}; target=(1<<len(bits))-1; queue=deque();seen=set()
    for start in needed:
        state=(start,1<<bits[start]);seen.add(state);queue.append((*state,0))
    while queue:
        pos,mask,d=queue.popleft()
        if mask==target:return d
        for nxt in ((pos-2)%total+1,pos%total+1):
            nextmask=mask|(1<<bits[nxt] if nxt in bits else 0);state=(nxt,nextmask)
            if state not in seen: seen.add(state);queue.append((*state,d+1))


add(33,'环形服务器的最短遍历时间',
    '编号1..total的服务器构成环，相邻移动耗时1。可以从待访问列表中的任意服务器开始，求访问全部指定服务器的最短时间。',
    '第一行total n（1≤n≤total≤100000）；第二行n个待访问编号（1..total），重复编号只需访问一次。',
    '排序并去重待访问点，找相邻点之间最大的环上间隔，答案为环长减最大间隔。',
    '去掉最大间隔后，其余弧连通且包含所有目标，沿弧走一遍即可。任意最短走法若覆盖整环，至少耗时环长；否则经过边构成包含所有目标的一段弧，未走部分不能跨过目标，长度不超过最大间隔。因此该构造最短。',
    '时间O(n log n)，空间O(n)。',[(8,[2,4,7]),(5,[3]),(4,[1,2,3,4])],ring_oracle,
    lambda r:(lambda total:(total,[r.randint(1,total) for _ in range(r.randint(1,total))]))(r.randint(1,8)),
    lambda x:f'{x[0]} {len(x[1])}\n'+' '.join(map(str,x[1]))+'\n',
    '''def solve(d):
    total,n=map(int,d[:2]); a=sorted(set(map(int,d[2:]))); gap=a[0]+total-a[-1]
    for i in range(1,len(a)): gap=max(gap,a[i]-a[i-1])
    return str(total-gap)
''',[('忽略跨首尾间隔','gap=a[0]+total-a[-1]','gap=0'),('把间隔当答案','str(total-gap)','str(gap)')],
    [((100000,list(range(1,100001))),99999),((100000,[1,100000]),1)],
    '样例1：最大空隙长度3，环长8减3得5；例如从4向2再绕到7，总计5步。样例2：只有一个目标，起点就是它，耗时0。样例3：沿环连续走3步即可访问四点。')


def digits_oracle(s):
    queue=deque([s]); seen={s}; best=s
    while queue:
        current=queue.popleft(); best=min(best,current)
        for i,c in enumerate(current):
            rest=current[:i]+current[i+1:]; value=str(min(int(c)+1,9))
            for j in range(len(current)):
                nxt=rest[:j]+value+rest[j:]
                if nxt not in seen: seen.add(nxt);queue.append(nxt)
    return best


add(34,'递增并重插后的最小数字串',
    '一次操作取出任意一位d，把它变成min(d+1,9)，再插入任意位置。可以操作任意次（含0次），求最终字典序最小字符串，保留前导零。',
    '一行数字串，长度1..200000。',
    '从右向左维护右侧最小数字。若当前数字比右侧最小值大，就必须移动并加1；其余保留。最后把变换后的数字排序。',
    '若一个数字后面有更小数字，不移动它会阻碍更小数字前移，最优解可将它移动且只加一次，额外递增不会更好。未移动数字形成非降序列，移动数字可插入任意位置，因此可将全部数字按升序合并，取得最小结果。',
    '时间O(n+10)，空间O(n)。',['26547','0','21'],
    # Source-sized example checked by an independent finite 10^5-state search.
    digits_oracle,lambda r:''.join(r.choice('01239') for _ in range(r.randint(1,3))),lambda s:s+'\n',
    '''def solve(d):
    s=d[0]; minimum=10; counts=[0]*10
    for c in reversed(s):
        value=int(c)
        if value>minimum: counts[min(value+1,9)]+=1
        else: counts[value]+=1; minimum=value
    return ''.join(str(i)*counts[i] for i in range(10))
''',[('移动后不递增','min(value+1,9)','value'),('把相等数字也移动','value>minimum','value>=minimum')],
    [('9'*200000,'9'*200000),('1'*100000+'0'*100000,'0'*100000+'2'*100000)],
    '样例1：6与5的右侧存在更小的4，移动后变成7与6，再与保留的2、4、7排序得到24677。样例2：不操作已最小，输出0。样例3：把2移出并变成3，插到1后得到13。',
    output='输出字典序最小的数字串，保留前导零。')


def crush_oracle(a):
    @lru_cache(None)
    def visit(state):
        best=len(state)
        for i in range(len(state)):
            for j in range(i+1,len(state)):
                if state[i]!=state[j]:best=min(best,visit(state[:i]+state[i+1:j]+state[j+1:]))
        return best
    return visit(tuple(sorted(a)))


add(35,'不同水果配对消除后的最少剩余',
    '每次删除两个种类不同的水果，允许任意选择位置并操作任意次，求最后最少剩几个。',
    '第一行n（1..100000），第二行n个种类编号（1..10⁹）。',
    '设最大频次为f。答案max(2f−n,n mod 2)。',
    '若最多种类占多数，其余n−f个最多各消去一个该种类，必剩2f−n且可达到。否则可反复配对当前最多的两类，不会形成无法继续配对的过大多数，最终只受奇偶限制剩0或1。',
    '时间O(n)，空间O(n)。',[[3,3,1,1,2],[1,1,1,2],[1,2]],crush_oracle,
    lambda r:[r.randint(1,4) for _ in range(r.randint(1,9))],arr,
    '''def solve(d):
    from collections import Counter
    a=list(map(int,d[1:])); n=len(a); largest=max(Counter(a).values())
    return str(max(2*largest-n,n%2))
''',[('忽略奇偶','n%2','0'),('忽略多数水果','max(2*largest-n,n%2)','n%2')],
    [([1]*100000,100000),([1,2]*50000,0)],
    '样例1：消去一个3与1，再消去另一个3与另一个1，剩2，共1个。样例2：唯一2只能消去一个1，剩两个1。样例3：两种水果直接一起消去，剩0。')


add(36,'安全中心与目的地的最小匹配距离',
    '将n个中心与n个目的地一一匹配，每对成本为坐标差绝对值，求最小总成本。',
    '第一行n（1..100000），第二行n个中心坐标，第三行n个目的地坐标，均1..10⁹。',
    '两组坐标分别排序，相同排序位置配对。',
    '对a≤b及x≤y，有|a−x|+|b−y|≤|a−y|+|b−x|。因此交叉配对可交换为同序配对而不增成本，反复消除逆序即得到排序配对。',
    '时间O(n log n)，空间O(n)。',[([1,2,2],[5,2,4]),([1],[9]),([4,1],[1,4])],
    lambda x:min(sum(abs(a-b) for a,b in zip(x[0],p)) for p in permutations(x[1])),
    lambda r:(lambda n:([r.randint(1,20) for _ in range(n)],[r.randint(1,20) for _ in range(n)]))(r.randint(1,7)),pair_arrays,
    '''def solve(d):
    n=int(d[0]); a=sorted(map(int,d[1:1+n])); b=sorted(map(int,d[1+n:]))
    return str(sum(abs(x-y) for x,y in zip(a,b)))
''',[('不排序中心','a=sorted(map(int,d[1:1+n]))','a=list(map(int,d[1:1+n]))'),('目的地逆序','b=sorted(map(int,d[1+n:]))','b=sorted(map(int,d[1+n:]),reverse=True)')],
    [(([1]*100000,[10**9]*100000),99999999900000)],
    '样例1：排序后配对1→2、2→4、2→5，距离1+2+3=6。样例2：唯一距离8。样例3：相同坐标互配，成本0。')


def removal_oracle(x):
    s,t,cost=x; best=10**20
    for mask in range(1<<len(s)):
        kept={s[i] for i in range(len(s)) if not mask>>i&1}
        if all(c not in kept for c in t): best=min(best,sum(cost[ord(s[i])-97] for i in range(len(s)) if mask>>i&1))
    return best


add(38,'删除参考字符的最低费用',
    '把password中属于reference字符集合的每一个字符全部删除。删除一次字母c花费cost[c−a]，求最小费用。reference里同一个字母重复出现不会重复收费。',
    '第一行password，第二行reference（均小写字母且长度1..100000）；第三行按a..z给出26个删除费用（1..100）。',
    '统计password每种字符次数，对reference出现过的每一种字母累加次数×单次费用。',
    '所有属于参考字符集合的出现位置都必须删除，费用之和是任何方案的下界。仅删除这些位置就完成目标，达到下界；参考串重复字符不增加必须删除的位置。',
    '时间O(|password|+|reference|)，空间O(26)。',[('kkkk','k',[5 if i==10 else 1 for i in range(26)]),('abc','z',[1]*26),('aab','ab',[2,5]+[1]*24)],removal_oracle,
    lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,9))),''.join(r.choice('abcd') for _ in range(r.randint(1,5))),[r.randint(1,8) for _ in range(26)]),
    lambda x:f'{x[0]}\n{x[1]}\n'+' '.join(map(str,x[2]))+'\n',
    '''def solve(d):
    from collections import Counter
    s,t=d[:2]; costs=list(map(int,d[2:])); counts=Counter(s)
    return str(sum(counts[c]*costs[ord(c)-97] for c in set(t)))
''',[('只删除一种参考字符','sum(counts[c]*costs[ord(c)-97] for c in set(t))','min(counts[c]*costs[ord(c)-97] for c in set(t))'),('忽略出现次数','counts[c]*costs[ord(c)-97]','costs[ord(c)-97]')],
    [(('a'*100000,'a',[100]*26),10000000)],
    '样例1：四个k每次费用5，全部删除共20。样例2：password没有任何z，无需删除，费用0。样例3：必须删除两个a和一个b，总费用2×2+5=9。')


def distinct_oracle(x):
    sizes,costs=x;best=10**30
    for order in permutations(range(len(sizes))):
        pos=0; total=0
        for i in order:
            pos=max(pos+1,sizes[i]);total+=(pos-sizes[i])*costs[i]
        best=min(best,total)
    return best


add(39,'按不同费用递增到互异尺寸',
    '第i个尺寸每加1花费cost[i]，只能增加不能减少。使全部尺寸两两不同，求最低总费用。',
    '第一行n（1..200000），第二行n个size（1..10⁹），第三行n个cost（1..10000）。',
    '从小到大分配最终尺寸，把原尺寸不大于当前值的项目加入最大费用堆。当前尺寸优先给单位费用最大者。',
    '已可安排的两个项目中，若更便宜者占当前位而更贵者延后，交换后减少或保持费用且均满足只能增加。故总存在最优方案按最大费用优先。堆为空时跳到下一个原尺寸，不会错过可用项目。',
    '时间O(n log n)，空间O(n)。',[([2,3,3,2],[2,4,5,1]),([1,1],[1,9]),([1,4],[9,9])],distinct_oracle,
    lambda r:(lambda n:([r.randint(1,5) for _ in range(n)],[r.randint(1,8) for _ in range(n)]))(r.randint(1,7)),pair_arrays,
    '''def solve(d):
    import heapq
    n=int(d[0]); sizes=list(map(int,d[1:n+1])); costs=list(map(int,d[n+1:])); items=sorted(zip(sizes,costs)); heap=[]; i=0; pos=0; answer=0
    while i<n or heap:
        if not heap: pos=max(pos,items[i][0])
        while i<n and items[i][0]<=pos:
            start,cost=items[i]; heapq.heappush(heap,(-cost,start)); i+=1
        negative,start=heapq.heappop(heap); answer+=(pos-start)*(-negative); pos+=1
    return str(answer)
''',[('优先保留便宜项目','heapq.heappush(heap,(-cost,start)); i+=1\n        negative,start=heapq.heappop(heap); answer+=(pos-start)*(-negative)',
     'heapq.heappush(heap,(cost,start)); i+=1\n        negative,start=heapq.heappop(heap); answer+=(pos-start)*negative'),('漏算每项移动距离','(pos-start)*(-negative)','(-negative)')],
    [(([1]*200000,[10000]*200000),200000*199999//2*10000)],
    '样例1：费用2的尺寸2留在2，费用5的尺寸3留在3，费用4的另一个3增到4花4，费用1的另一个2增到5花3，总费用7。样例2：昂贵项目留在1，便宜项目增加1，费用1。样例3：本来互异，费用0。')


def balance_oracle(a):
    low,extra=divmod(sum(a),len(a)); best=10**30
    for large in combinations(range(len(a)),extra):
        chosen=set(large); best=min(best,sum(max(0,v-low-(i in chosen)) for i,v in enumerate(a)))
    return best


add(40,'箱子堆达到最小极差的最少搬运',
    '一次从非空堆取一个箱子放到另一堆。先要求最终最大堆与最小堆之差达到可能的最小值，再求达到它所需最少操作数。',
    '第一行n（1..100000），第二行n个箱子数（1..10⁹）。',
    '最终每堆只能是平均值向下取整或向上取整，较大目标分给原本较大的堆。排序后计算超过目标的箱子总数。',
    '固定总量下最小极差为0或1，因此最终目标由商和余数确定。把较大的目标给较大的原值不会增加总绝对偏差（交换不等式），故排序匹配最优。多余箱子总数等于缺少箱子数，每次搬运恰消去一份多余，达到下界。',
    '时间O(n log n)，空间O(n)。',[[5,5,8,7],[1,1],[1,5]],balance_oracle,
    lambda r:[r.randint(1,12) for _ in range(r.randint(1,9))],arr,
    '''def solve(d):
    a=sorted(map(int,d[1:])); n=len(a); low,extra=divmod(sum(a),n); answer=0
    for i,v in enumerate(a):
        target=low+(i>=n-extra); answer+=max(0,v-target)
    return str(answer)
''',[('把所有目标都向下取整','target=low+(i>=n-extra)','target=low'),('把流入也重复计数','max(0,v-target)','abs(v-target)')],
    [([1,10**9]*50000,499999999*50000)],
    '样例1：总量25，目标排序为6、6、6、7，从8那堆搬出2个分别给两个5，共2次。样例2：已平衡，0次。样例3：从5搬2个给1，两堆变成3、3，2次。')


add(41,'任意阅读顺序的最大累计记忆分',
    '任意排列所有章节，读完每章后得到目前已读章节记忆值总和作为本次得分，求所有本次得分之和的最大值。记忆值可为负数。',
    '第一行n（1..100000），第二行n个记忆值（−1000..1000）。',
    '按记忆值降序阅读，累加每一步的前缀和。',
    '第i个读到的值会被计入后面n−i+1次得分，权重依次递减。较大值乘较大权重的交换不等式对负数同样成立，因此降序最优。',
    '时间O(n log n)，空间O(n)。',[[3,4,5],[-2,-1],[0]],
    lambda a:max(sum(sum(p[:i]) for i in range(1,len(p)+1)) for p in permutations(a)),
    lambda r:[r.randint(-5,5) for _ in range(r.randint(1,7))],arr,
    '''def solve(d):
    a=sorted(map(int,d[1:]),reverse=True); prefix=answer=0
    for v in a: prefix+=v;answer+=prefix
    return str(answer)
''',[('按升序阅读','reverse=True','reverse=False'),('忽略负记忆值','prefix+=v','prefix+=max(v,0)')],
    [([1000]*100000,1000*100000*100001//2),([-1000]*100000,-1000*100000*100001//2)],
    '样例1：按5、4、3阅读，三次得分5、9、12，总分26。样例2：先读−1后读−2，得分−1、−3，总分−4，比另一顺序−5更大。样例3：总分0。')


def idle_oracle(points):
    return sum(any(a<x and b==y for a,b in points) and any(a>x and b==y for a,b in points) and any(a==x and b<y for a,b in points) and any(a==x and b>y for a,b in points) for x,y in points)


add(42,'四个方向都有邻居的空闲机器人',
    '机器人空闲当且仅当同一行严格左侧、严格右侧，以及同一列严格上方、严格下方都至少存在一个其它机器人。无需紧邻，求空闲机器人数量。',
    '第一行n（1..100000），随后n行x y（−10⁹..10⁹）。同坐标机器人分别计数，但彼此不算严格方向邻居。',
    '每行记录最小最大x，每列记录最小最大y。某点严格处于两组极值之间则空闲。',
    '行最小x小于当前x当且仅当存在左邻，行最大x大于当前x当且仅当存在右邻；列同理。四个严格比较恰好对应全部必要充分条件。',
    '时间O(n)，空间O(n)。', [[(x,y) for y in range(3) for x in range(3)],[(0,0)],[(0,0),(-1,0),(1,0),(0,-1),(0,1)]],idle_oracle,
    lambda r:[(r.randint(-3,3),r.randint(-3,3)) for _ in range(r.randint(1,12))],
    lambda a:f'{len(a)}\n'+''.join(f'{x} {y}\n' for x,y in a),
    '''def solve(d):
    values=list(map(int,d[1:])); points=list(zip(values[::2],values[1::2])); rows={}; cols={}
    for x,y in points:
        lo,hi=rows.get(y,(x,x)); rows[y]=(min(lo,x),max(hi,x))
        lo,hi=cols.get(x,(y,y)); cols[x]=(min(lo,y),max(hi,y))
    return str(sum(rows[y][0]<x<rows[y][1] and cols[x][0]<y<cols[x][1] for x,y in points))
''',[('方向比较不严格','<','<='),('只检查水平方向',' and cols[x][0]<y<cols[x][1]','')],
    [([(i,0) for i in range(100000)],0)],
    '样例1：3×3点阵只有中心(1,1)四向齐全，答案1。样例2：没有邻居，答案0。样例3：十字的中心(0,0)空闲，其余四点缺少方向，答案1。')


def medians_oracle(x):
    a,k=x; values=[sorted(p)[(k-1)//2] for p in combinations(a,k)]
    return f'{max(values)} {min(values)}'


add(43,'定长子序列中位数的最大与最小值',
    '保序任选长度k的子序列，排序后取第⌈k/2⌉个元素作为中位数（偶数长度取较小的中间值，与来源样例一致）。输出所有选择中最大中位数和最小中位数。',
    '第一行n k（1≤k≤n≤100000），第二行n个值（0..10⁹）。',
    '数组排序。最小中位数来自最小的k项，最大中位数来自最大的k项。',
    '任意k项的第j小不可能小于全局第j小，也不可能大于全局第n−k+j小。这两个界分别由最小k项和最大k项达到。',
    '时间O(n log n)，空间O(n)。',[([1,2,3],2),([9],1),([1,2,3,4,5],3)],medians_oracle,
    lambda r:(lambda a:(a,r.randint(1,len(a))))([r.randint(0,10) for _ in range(r.randint(1,9))]),param_array,
    '''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:])); middle=(k-1)//2
    return f'{a[n-k+middle]} {a[middle]}'
''',[('偶数长度取较大中位数','middle=(k-1)//2','middle=k//2'),('最大中位数取全局最大',"a[n-k+middle]","a[-1]")],
    [((list(range(100000)),100000),'49999 49999')],
    '样例1：任选两项的较小者作为中位数，选择[2,3]得到最大2，选择[1,2]得到最小1。样例2：只有9，两个答案都是9。样例3：最大三项[3,4,5]中位数4，最小三项[1,2,3]中位数2。',output='输出最大中位数、最小中位数。')


def shipping_oracle(a):
    @lru_cache(None)
    def visit(state):
        if not state:return 0
        best=1+visit(state[1:])
        for j in range(1,len(state)):
            if state[0]!=state[j]:best=min(best,1+visit(state[1:j]+state[j+1:]))
        return best
    return visit(tuple(sorted(a)))


add(45,'不同地点商品的最少发货次数',
    '一次可发出两个地点不同的商品，或单独发出一个商品。求发完全部商品的最少次数。',
    '第一行n（1..100000），第二行n个地点（1..10⁹）。',
    '设最多地点出现f次，答案max(f,⌈n/2⌉)。',
    '每次最多发2个，至少⌈n/2⌉次；同地点不能配对，最多地点的f个商品至少分f次。若有多数地点，先与其它地点配对再单发剩余；否则可以配成至多一个单项，达到较大下界。',
    '时间O(n)，空间O(n)。',[[1,8,6,7,7],[1,1,1],[1,2]],shipping_oracle,
    lambda r:[r.randint(1,4) for _ in range(r.randint(1,9))],arr,
    '''def solve(d):
    from collections import Counter
    a=list(map(int,d[1:])); n=len(a)
    return str(max(max(Counter(a).values()),(n+1)//2))
''',[('件数向下取整','(n+1)//2','n//2'),('忽略单地点多数','max(max(Counter(a).values()),(n+1)//2)','(n+1)//2')],
    [([1]*100000,100000),([1,2]*50000,50000)],
    '样例1：两个7分别与1、8配对，再单发6，共3次。样例2：同地点不能一起发，需3次。样例3：两地点一起发，1次。')


def profit_oracle(x):
    s,a,k=x; groups=[];start=0
    for i in range(1,len(s)+1):
        if i==len(s) or s[i]!=s[start]:groups.append(range(start,i));start=i
    return max(sum(a[i] for i in range(len(a)) if mask>>i&1) for mask in range(1<<len(a)) if all(sum(mask>>i&1 for i in group)<=k for group in groups))


add(46,'相同命令连续段中的最大收益',
    '命令串的每个原始极大连续相同字符段最多执行k条命令，可跳过其它命令；选择不改变原始分段。每条命令收益为正，求最大总收益。',
    '第一行n k（1≤k≤n≤200000），第二行长度n的小写命令串，第三行n个收益（1..10⁹）。',
    '独立处理原始每段，选该段收益最大的至多k项。',
    '各段名额互不影响，正收益意味着每段能选就选。固定名额下，若选了低收益却漏高收益，交换可改进，因此每段取最大的k项最优，累加即全局最优。',
    '时间O(n log n)，空间O(n)。',[('abbba',[1,4,2,10,3],2),('aaa',[1,2,3],1),('aba',[1,2,3],1)],profit_oracle,
    lambda r:(lambda n:(''.join(r.choice('abc') for _ in range(n)),[r.randint(1,20) for _ in range(n)],r.randint(1,n)))(r.randint(1,10)),
    lambda x:f'{len(x[0])} {x[2]}\n{x[0]}\n'+' '.join(map(str,x[1]))+'\n',
    '''def solve(d):
    n,k=map(int,d[:2]);s=d[2];a=list(map(int,d[3:]));start=0;answer=0
    for i in range(1,n+1):
        if i==n or s[i]!=s[start]:
            answer+=sum(sorted(a[start:i],reverse=True)[:k]);start=i
    return str(answer)
''',[('每段选最小收益','reverse=True','reverse=False'),('忽略每段名额','[:k]','[:]')],
    [(('a'*200000,[10**9]*200000,1),10**9)],
    '样例1：两端a各自成段，收益1+3；中间bbb取10和4，总和18。样例2：唯一连续段最多取1条，选收益3。样例3：三个原始段各只有一条，都可执行，总和6。')


def valid_oracle(s):
    return sum(max(Counter(s[i:j]).values())<=len(set(s[i:j])) for i in range(len(s)) for j in range(i+1,len(s)+1))


add(47,'最高频次不超过种类数的子串',
    '字符串仅含a..g，求非空连续子串数量，使其中最高字符频次不超过不同字符数量。',
    '一行a..g字符串，长度1..100000。',
    '合法子串最多7种字符，每种最多7次，因此长度不超过49。从每个左端最多扩展49位，维护频次、种类数和最大频次。',
    '若长度超过49，鸽巢原理使某个字母至少出现8次，超过最多7种，必不合法。枚举长度至多49覆盖全部可能；按定义比较维护的两个计数即可。',
    '时间O(49n)，空间O(7)。',['abaa','a','abc'],valid_oracle,
    lambda r:''.join(r.choice('abcdefg') for _ in range(r.randint(1,14))),lambda s:s+'\n',
    '''def solve(d):
    s=d[0];answer=0
    for start in range(len(s)):
        count=[0]*7; distinct=maximum=0
        for end in range(start,min(len(s),start+49)):
            k=ord(s[end])-97
            if count[k]==0:distinct+=1
            count[k]+=1;maximum=max(maximum,count[k]);answer+=maximum<=distinct
    return str(answer)
''',[('不允许频次等于种类','maximum<=distinct','maximum<distinct'),('窗口上界误用7','start+49','start+7')],
    [('a'*100000,100000),('abcdefg'*7,1225)],
    '样例1：四个单字符、ab和ba两个长度2子串、aba和baa两个长度3子串合法，共8；aa和abaa不合法。样例2：单字符频次1、种类1，合法。样例3：全部六个非空子串都合法。',time_limit=6)


def partition_oracle(x):
    a,k=x; values=[]
    for cuts in combinations(range(1,len(a)),k-1):
        ends=(0,)+cuts+(len(a),);values.append(sum(a[ends[i]]+a[ends[i+1]-1] for i in range(k)))
    return f'{min(values)} {max(values)}'


add(48,'固定段数划分的最小与最大端点费用',
    '将数组恰分成k个非空连续段，每段费用为首元素加末元素，单元素段计该元素两次。输出总费用最小值和最大值。',
    '第一行n k（1≤k≤n≤200000），第二行n个正整数（1..10⁹）。',
    '首尾元素总是贡献，其它贡献来自每个切口左右相邻元素之和。选择k−1个最小或最大的相邻和。',
    '无切口时费用是a[0]+a[n−1]。在i与i+1之间增加切口，新增端点恰为a[i]+a[i+1]。切口互相独立，因此取固定数量的最小/最大权重即最优。',
    '时间O(n log n)，空间O(n)。',[([1,2,3,2,5],3),([7],1),([1,2],2)],partition_oracle,
    lambda r:(lambda a:(a,r.randint(1,len(a))))([r.randint(1,12) for _ in range(r.randint(1,9))]),param_array,
    '''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));weights=sorted(a[i]+a[i+1] for i in range(n-1));base=a[0]+a[-1]
    smallest=base+sum(weights[:k-1]);largest=base+sum(weights[len(weights)-(k-1):])
    return f'{smallest} {largest}'
''',[('切口少算左端','a[i]+a[i+1]','a[i+1]'),('最大费用也取最小切口','largest=base+sum(weights[len(weights)-(k-1):])','largest=smallest')],
    [(([10**9]*200000,200000),f'{400000*10**9} {400000*10**9}')],
    '样例1：固定首尾费用6，切口权重为3、5、5、7；最小取3和5得14，最大取7和5得18。样例2：单元素段两端都是7，费用14。样例3：必须分为[1]和[2]，费用2+4=6。',output='输出最小总费用、最大总费用。')


def mutation_oracle(x):
    s,c=x; days=0
    while True:
        removed={i-1 for i,v in enumerate(s) if i>0 and v==c and s[i-1]!=c}
        if not removed:return days
        s=''.join(v for i,v in enumerate(s) if i not in removed);days+=1


add(49,'突变字符同时删除左邻的稳定时间',
    '每一轮，每个突变字符若左边紧邻非突变字符就删除它，所有删除同时发生；突变字符彼此不会删除。求到不再发生删除为止的轮数，没有删除则为0。',
    '第一行小写genome（长度1..100000），第二行一个小写mutation字符。',
    '每个突变字符依次消耗它左边直到上一个突变字符之间的连续普通字符段。答案为所有突变字符前普通段长度的最大值，末尾普通段不会被消耗。',
    '突变字符始终保留，彼此阻断，故其左侧普通段由它每轮恰好删除一个，各段同时独立缩短。完成所有段需要最长段长度，突变字符右边的尾段永远不被删除。',
    '时间O(n)，空间O(1)。',[('tamem','m'),('abc','z'),('mmabm','m')],mutation_oracle,
    lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,12))),r.choice('abc')),lambda x:f'{x[0]}\n{x[1]}\n',
    '''def solve(d):
    s,c=d;run=answer=0
    for v in s:
        if v==c:answer=max(answer,run);run=0
        else:run+=1
    return str(answer)
''',[('误计末尾未删除字符','return str(answer)','return str(max(answer,run))'),('把多段长度累加','answer=max(answer,run)','answer+=run')],
    [(('a'*99999+'m','m'),99999),(('m'+'a'*99999,'m'),0)],
    '样例1：第一轮两个m分别删掉a与e，得到tmm；第二轮首个m删掉t，剩mm，答案2。样例2：无突变字符，0轮。样例3：最后一个m先删b再删a，两轮后剩mmm。')


def system_oracle(x):
    a,k=x
    return min(sum(abs(b[i]-b[i-1]) for i in range(1,len(b))) for start in range(len(a)-k+1) for b in [a[:start]+a[start+k:]])


add(50,'删除定长连续段后的最小系统成本',
    '删除恰好k个连续元素，剩余元素保持原顺序，成本为所有相邻差绝对值之和。求最小成本。',
    '第一行n k（1≤k<n≤200000），第二行n个值（1..10⁹）。',
    '前缀和保存相邻边成本。枚举删除窗口，减掉被删的内部及连接边，再在左右两侧都存在时加上新连接边。',
    '删除区间后，区间外原相邻边保持不变；涉及删除元素的边全部消失；仅可能新增左邻到右邻的一条边。前缀和准确求消失边权，对所有合法起点取最小即可。',
    '时间O(n)，空间O(n)。',[([3,9,4,2,16],3),([1,9],1),([1,4,2,8],1)],system_oracle,
    lambda r:(lambda a:(a,r.randint(1,len(a)-1)))([r.randint(1,20) for _ in range(r.randint(2,10))]),param_array,
    '''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));prefix=[0]
    for i in range(1,n):prefix.append(prefix[-1]+abs(a[i]-a[i-1]))
    answer=prefix[-1]
    for start in range(n-k+1):
        end=start+k-1;lo=max(0,start-1);hi=min(n-1,end+1)
        cost=prefix[-1]-(prefix[hi]-prefix[lo])
        if start>0 and end+1<n:cost+=abs(a[end+1]-a[start-1])
        answer=min(answer,cost)
    return str(answer)
''',[('漏掉新相邻边','cost+=abs(a[end+1]-a[start-1])','cost+=0'),('不枚举删尾窗口','range(n-k+1)','range(n-k)')],
    [((list(range(1,200001)),199999),0),(([1]*200000,100000),0)],
    '样例1：删除最后三个元素后剩[3,9]，成本6，比其它两个窗口更小。样例2：无论删除哪一个都只剩一个元素，成本0。样例3：删除末尾8后剩[1,4,2]，成本3+2=5；删除4可得1+6=7，其它方案不更优。')


BLOCKED={
    'oa-amazon-32':'没有约定初始最长严格递增子序列不足min_order时的返回值；约束允许此情况，例如[2,1],min_order=2，无合法k。',
    'oa-amazon-37':'impactFactor未给范围，0会除零，负数会改变取整和操作性质；无法据现有约束确定完整输入域。',
    'oa-amazon-38':'题面any character in reference存在任选一种字符删尽与全部参考字符删尽两种读法；唯一k样例不能区分，已有讲解不能替代原题澄清，不发布自行选择的语义。',
    'oa-amazon-44':'来源允许长度10⁸的输入与输出，超过当前OJ单用例4MiB输入及64MiB输出限制；不能静默缩减原约束后声称完整支持。',
}
SPECS=[spec for spec in SPECS if spec['number']!=38]


def execute(path,stdin):
    p=subprocess.run([sys.executable,'-I',str(path)],input=stdin,text=True,capture_output=True,timeout=15,check=True)
    return p.stdout.rstrip('\n')


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={p['id']:p for p in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}; items=[]; reports=[]
    only=None
    if sys.argv[1:]:
        assert len(sys.argv)==3 and sys.argv[1]=='--only','Use --only comma-separated-numbers'
        only={int(x) for x in sys.argv[2].split(',')};assert only<={x['number'] for x in SPECS}
        keep={f"oa-amazon-{s['number']}" for s in SPECS if s['number'] not in only}
        items=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if x['id'] in keep]
        reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if x['id'] in keep]
        assert {x['id'] for x in items}==keep=={x['id'] for x in reports}
        for entry in items:
            pkg=json.loads((OUT/'packages'/f"{entry['id']}.json").read_text())
            canonical=json.dumps(pkg,ensure_ascii=False,separators=(',',':'))
            assert hashlib.sha256(canonical.encode()).hexdigest()==entry['packageChecksum']
            assert (OUT/'references'/f"{entry['id']}.py").read_text()==entry['authoredSolutions'][0]['code']
    for spec in SPECS:
        if only is not None and spec['number'] not in only:continue
        identifier=f"oa-amazon-{spec['number']}"; source=sources[identifier];rng=random.Random(SEED+spec['number'])
        code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        oracles=[]
        for value in spec['samples']+[spec['random'](rng) for _ in range(160)]:
            stdin=spec['encode'](value); expected=str(spec['oracle'](value));assert execute(path,stdin)==expected,(identifier,value,expected)
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        tests=oracles[:3]+[dict(input=spec['encode'](x),expectedOutput=str(y)+'\n') for x,y in spec['edges']]+oracles[3:27];cases=[]
        for i,c in enumerate(tests):
            assert execute(path,c['input'])==c['expectedOutput'].rstrip('\n'),(identifier,'edge',i)
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1))
        mutations=[];kills=[]
        for i,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code; changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{identifier}-{i}.py';mp.write_text(changed)
            rejected=[j for j,c in enumerate(cases) if execute(mp,c['input'])!=c['expectedOutput'].rstrip('\n')];assert rejected,(identifier,name,'survived')
            mutations.append(dict(name=name,code=changed));kills.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Amazon'],description=spec['description']+'\n\n标准输入输出、样例与评测由CSWork独立编写；标注本站的约定不冒充来源原始限制。',input=spec['input'],output=spec.get('output','输出一个整数答案。'),explanation=spec['explanation'],hints=[spec['idea']],timeLimit=spec.get('time_limit',4),memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        if normalized.returncode:raise RuntimeError(normalized.stderr)
        raw=normalized.stdout;assert '\ufffd' not in raw,identifier
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        docs={'packages':json.loads(raw),'oracles':oracles,'mutants':mutations,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')}
        for folder,data in docs.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(raw.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=kills,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,'163 independent checks;',len(cases)-3,'hidden; both mutants rejected',flush=True)
    order={f"oa-amazon-{s['number']}":i for i,s in enumerate(SPECS)}
    items.sort(key=lambda x:order[x['id']]);reports.sort(key=lambda x:order[x['id']])
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Local authored reference/oracle validation only; real sandbox evidence required before publication.'),ensure_ascii=False,indent=2)+'\n')
    reasons={29:'来源样例13按定义实为5，独立逐仓库枚举核对后修正。',31:'本站明确只测删除目标存在的请求，避免擅定来源缺失目标删除行为。',38:'原题目标为remove all occurrences of any character in reference，按字符集合成员语义删除所有参考字母，而非任选一种；用删除位置子集枚举核对，并补多种参考字符样例。',43:'偶数长度用下中位数，与来源k=2样例一致。'}
    reviews=[dict(id=f'oa-amazon-{i}',status='blocked' if f'oa-amazon-{i}' in BLOCKED else 'authored',reason=BLOCKED.get(f'oa-amazon-{i}',reasons.get(i,'按明确题意独立参考解、暴力对照、具体样例说明和边界验证。'))) for i in range(26,51)]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
