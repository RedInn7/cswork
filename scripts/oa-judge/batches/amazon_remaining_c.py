"""Reviewed Amazon 51–75. Only locally authored programs execute."""
from collections import Counter, deque
from functools import lru_cache
from itertools import permutations, product, combinations
import hashlib
import heapq
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'; BATCH='amazon-remaining-c'; SEED=20261001
SPECS=[]
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def text(s):return s+'\n'
def add(n,title,desc,fmt,idea,proof,complexity,samples,oracle,random_case,encode,code,mutants,edges,explanation,**extra):
    SPECS.append(dict(number=n,title=title,description=desc,input=fmt,idea=idea,proof=proof,complexity=complexity,samples=samples,oracle=oracle,random=random_case,encode=encode,code=code,mutants=mutants,edges=edges,explanation=explanation,**extra))

def attack_oracle(x):
    req,h,k=x
    @lru_cache(None)
    def visit(health):
        if not any(health):return 1
        rate=sum(v for v,w in zip(req,health) if w)
        return rate+min(visit(health[:i]+(max(0,health[i]-k),)+health[i+1:]) for i in range(len(health)) if health[i])
    return visit(tuple(h))
add(51,'服务器全部关闭前的最少请求',
    '每秒开始，所有仍存活服务器按各自request贡献请求；同秒选择一台存活服务器扣k生命，生命≤0立刻死亡。全部死亡后再发送恰好1个请求。安排攻击顺序，求最少总请求数。',
    '第一行n k（1≤n≤100000，1≤k≤5000）；第二行n个request，第三行n个health，均1..5000。',
    '服务器需要p=ceil(health/k)次攻击，权重为request。按p/request升序连续处理服务器，用整数交叉乘积比较比率。',
    '任意穿插攻击方案可按完成顺序连续处理服务器，使每台完成时间不更晚，故存在不穿插最优解。相邻任务i先于j比反序少的费用由p_i w_j−p_j w_i决定；按该比率排序消除所有逆序即可最优。总请求为Σ完成时间×request，再加最终1。',
    '时间O(n log n)，空间O(n)。',[([3,4],[4,6],3),([1],[1],1),([5,1],[1,3],1)],attack_oracle,
    lambda r:(lambda n:([r.randint(1,6) for _ in range(n)],[r.randint(1,5) for _ in range(n)],r.randint(1,4)))(r.randint(1,4)),
    lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',
    '''def solve(d):
    from functools import cmp_to_key
    n,k=map(int,d[:2]); r=list(map(int,d[2:2+n])); h=list(map(int,d[2+n:])); jobs=[((v+k-1)//k,w) for v,w in zip(h,r)]
    jobs.sort(key=cmp_to_key(lambda a,b:a[0]*b[1]-b[0]*a[1])); elapsed=0;answer=1
    for duration,weight in jobs:elapsed+=duration;answer+=elapsed*weight
    return str(answer)
''',[('遗漏最终请求','answer=1','answer=0'),('比率逆序','a[0]*b[1]-b[0]*a[1]','b[0]*a[1]-a[0]*b[1]')],
    [(([5000]*100000,[5000]*100000,1),1+25000000*100000*100001//2)],
    '样例1：先连续攻击request=4的服务器两次，再攻击另一台两次；请求为7+7+3+3+1=21。样例2：当秒1个请求，加结束请求1，总共2。样例3：先关request=5服务器，三秒继续处理另一台，总计6+1+1+1+1=10。')

def components(intervals):
    groups=[]
    for a,b in sorted(intervals):
        if groups and a<=groups[-1][1]:groups[-1][1]=max(groups[-1][1],b)
        else:groups.append([a,b])
    return len(groups)
def zones_oracle(x):
    intervals,k=x; lo=min(a for a,b in intervals)-k;hi=max(b for a,b in intervals)
    return min(components(intervals+[(a,a+length)]) for a in range(lo,hi+1) for length in range(k+1))
add(52,'新增一段配送区域后的最少连通块',
    '已有闭区间，新增恰好一个闭区间[a,b]，要求0≤b−a≤k。区间相交或端点相等时合并；整数端点相差1但没有公共点不算相接。求最少连通块数。',
    '第一行n k（1≤n≤200000，1≤k≤10⁹），随后n行a b（1≤a≤b≤10⁹）。新增区间端点可自由选择整数。',
    '先合并已有相交区间。一个新增区间能连接连续多个块，当且仅当末块左端−首块右端≤k，用双指针找最多连接块数。',
    '跨首末块的最短桥从首块右端到末块左端；中间块必被桥穿过，所以条件充要。桥若连了t块，则连通块减少t−1。滑动窗口对有序端点求最大t即可。',
    '时间O(n log n)，空间O(n)。',[([(1,5),(2,4),(6,6),(7,14),(16,19)],2),([(1,2)],1),([(1,1),(5,5)],4)],zones_oracle,
    lambda r:([(a,a+r.randint(0,3)) for a in [r.randint(1,10) for _ in range(r.randint(1,7))]],r.randint(1,5)),
    lambda x:f'{len(x[0])} {x[1]}\n'+''.join(f'{a} {b}\n' for a,b in x[0]),
    '''def solve(d):
    n,k=map(int,d[:2]); intervals=sorted((int(d[i]),int(d[i+1])) for i in range(2,len(d),2)); merged=[]
    for a,b in intervals:
        if merged and a<=merged[-1][1]:merged[-1][1]=max(merged[-1][1],b)
        else:merged.append([a,b])
    left=0;best=1
    for right in range(len(merged)):
        while merged[right][0]-merged[left][1]>k:left+=1
        best=max(best,right-left+1)
    return str(len(merged)-best+1)
''',[('长度相等不允许','>k','>=k'),('把端点差1视为相接','a<=merged[-1][1]','a<=merged[-1][1]+1')],
    [(([(3*i+1,3*i+1) for i in range(200000)],1),200000)],
    '样例1：合并后4块；新增[5,7]长度2，把前三块连接，剩2块。样例2：可将新增区间放在原区间内，仍1块。样例3：新增[1,5]长度4，将两个点连接成1块。')

def variation_oracle(a):
    return min(sum(max(p[:i])-min(p[:i]) for i in range(1,len(p)+1)) for p in permutations(a))
add(53,'所有前缀极差总和的最小值',
    '重排数组，计算每个非空前缀最大值减最小值，再把这些极差相加，求最小总和。',
    '第一行n（1..2000），第二行n个值（1..10⁹）。',
    '排序后用区间DP：dp[l,r]=a[r]−a[l]+min(dp[l+1,r],dp[l,r−1])，单元素费用0，滚动保存长度少1的层。',
    '给定已选最小与最大值，若区间内部还有未选值，提前选内部值不会增加任何前缀极差，所以存在每步选中排序连续区间的最优顺序。最后加入的只能是区间左端或右端，当前整段极差固定，加上对应较短区间最优费用即递推。',
    '时间O(n²)，空间O(n)。',[[3,1,2],[7],[1,1,5]],variation_oracle,
    lambda r:[r.randint(1,9) for _ in range(r.randint(1,7))],arr,
    '''def solve(d):
    a=sorted(map(int,d[1:]));n=len(a);previous=[0]*n
    for length in range(2,n+1):
        current=[0]*(n-length+1)
        for left in range(n-length+1):current[left]=a[left+length-1]-a[left]+min(previous[left],previous[left+1])
        previous=current
    return str(previous[0])
''',[('把区间极差省略','a[left+length-1]-a[left]+',''),('选较差子问题','min(previous[left],previous[left+1])','max(previous[left],previous[left+1])')],
    [([1]*2000,0),(list(range(1,2001)),1999000)],
    '样例1：顺序1、2、3的前缀极差0、1、2，总和3。样例2：只有一个值，极差0。样例3：先放两个1再放5，极差0、0、4，总和4。',time_limit=6)

def hash_oracle(a):
    masks={0}
    for bound in a:masks={mask|(1<<v) for mask in masks for v in range(min(bound,len(a)))}
    return max(mask.bit_count() for mask in masks)
add(54,'余数数组最多不同值',
    '每个位置可以自由选择非负secretKey，得到hash[i]=secretKey[i] mod param[i]。求hash数组不同值个数的最大值。',
    '第一行n（1..200000），第二行n个param（1..10⁹）。',
    '按模数升序处理，当前已构造0..count−1。如果模数大于count，就为当前位置安排新余数count并增加计数。',
    '小模数可用集合嵌套于大模数集合。若当前模数≤count，它全部可用值都已在0..count−1内，不能增加不同数；否则新值count可行。这个最紧凑不同值集合对后续约束最宽松，归纳得到最优。',
    '时间O(n log n)，空间O(n)。',[[1,2,4],[1,1],[3]],hash_oracle,
    lambda r:[r.randint(1,5) for _ in range(r.randint(1,8))],arr,
    '''def solve(d):
    answer=0
    for bound in sorted(map(int,d[1:])):
        if bound>answer:answer+=1
    return str(answer)
''',[('余数允许等于模数','bound>answer','bound>=answer'),('不排序','sorted(map(int,d[1:]))','map(int,d[1:])')],
    [([1]*200000,1),([10**9]*200000,200000)],
    '样例1：可选余数0、1、2，共3种。样例2：模1只能得0，因此1种。样例3：只有一个位置，至多1种。')

def palindrome_random(r):
    half=''.join(r.choice('abc') for _ in range(r.randint(1,5)));return half+(r.choice('abc') if r.randrange(2) else '')+half[::-1]
add(55,'删除一位后仍回文的下标数',
    '给定本来就是回文的小写字符串，统计删除哪一个下标后仍然回文；相同字符不同下标分别计数。',
    '一行回文字符串，长度2..100000。',
    '找包含字符串中心的连续相同字符块，答案为其长度。',
    '删去中心相同字符块内任一位置，左右对称字符仍匹配。若删除块外位置，由于原串回文，对齐会沿删除点向中心错位，要求途经字符全部相同，直到中心；这恰会要求被删位置也属于中心块，矛盾。',
    '时间O(n)，空间O(1)。',['zzz','abba','abcba'],lambda s:sum((s[:i]+s[i+1:])==(s[:i]+s[i+1:])[::-1] for i in range(len(s))),palindrome_random,text,
    '''def solve(d):
    s=d[0];left=(len(s)-1)//2;right=len(s)//2;center=s[left]
    while left>0 and s[left-1]==center:left-=1
    while right+1<len(s) and s[right+1]==center:right+=1
    return str(right-left+1)
''',[('只允许删除中心位置','return str(right-left+1)','return str(1 if len(s)%2 else 2)'),('返回中心字符总频次','return str(right-left+1)','return str(s.count(center))')],
    [('a'*100000,100000),('a'*49999+'bb'+'a'*49999,2)],
    '样例1：删任意z都得到zz，共3个下标。样例2：只能删除中间两个b之一，得到aba，共2个。样例3：只有删中心c可得到abba，答案1。')

def special_oracle(s):
    return sum(s[i:j].count('0')==s[i:j].count('1')**2 for i in range(len(s)) for j in range(i+1,len(s)+1))
add(56,'零的数量等于一的数量平方的子串',
    '统计非空二进制连续子串，其中0的个数恰好等于1的个数的平方。',
    '一行二进制串，长度1..100000。',
    '若1有k个，则子串长度必须为k²+k。枚举满足此长度≤n的k≥1，用1的前缀和检查全部固定长度窗口。',
    '非空合法串不能有0个1，否则0也必须0个。每个合法串有唯一正整数k及唯一长度k²+k；前缀和条件确保1恰有k个，其余k²个均为0。因此枚举不重不漏。',
    '时间O(n√n)，空间O(n)。',['010001','0','01'],special_oracle,
    lambda r:''.join(r.choice('01') for _ in range(r.randint(1,14))),text,
    '''def solve(d):
    s=d[0];n=len(s);prefix=[0]
    for c in s:prefix.append(prefix[-1]+(c=='1'))
    answer=0;k=1
    while k*k+k<=n:
        length=k*k+k
        for end in range(length,n+1):answer+=prefix[end]-prefix[end-length]==k
        k+=1
    return str(answer)
''',[('零数量误作一次方','length=k*k+k','length=2*k'),('漏掉最后一个窗口','range(length,n+1)','range(length,n)')],
    [('0'*100000,0),('01'*50000,99999)],
    '样例1：两个相邻01、一个相邻10，以及整个串（两个1、四个0）合法，共4。样例2：只有0时不能满足条件，0个。样例3：一个0一个1满足1=1²，答案1。',time_limit=10)

add(57,'最多不相交连线',
    '第i条连线从i连接到match[i]。两线仅在下标顺序与目标大小顺序相反时相交，目标相同不算相交。求最多保留几条互不相交连线。',
    '第一行n（1..100000），第二行n个match（1..n）。',
    '求最长非降子序列；使用upper_bound维护每个长度的最小末尾值，允许相等值延长。',
    '按起点顺序选择连线后，不相交等价于目标值非降。最小末尾值不削弱任何未来扩展，二分找到第一个严格大于当前值的位置更新即可保持各长度最优末尾。',
    '时间O(n log n)，空间O(n)。',[[3,1,4,2,3,5],[1,1,1],[3,2,1]],
    lambda a:max(len(p) for mask in range(1,1<<len(a)) for p in [[v for i,v in enumerate(a) if mask>>i&1]] if all(x<=y for x,y in zip(p,p[1:]))),
    lambda r:(lambda n:[r.randint(1,n) for _ in range(n)])(r.randint(1,10)),arr,
    '''def solve(d):
    from bisect import bisect_right
    tails=[]
    for value in map(int,d[1:]):
        i=bisect_right(tails,value)
        if i==len(tails):tails.append(value)
        else:tails[i]=value
    return str(len(tails))
''',[('相等目标不能延长','bisect_right','bisect_left'),('先排序破坏起点顺序','map(int,d[1:])','sorted(map(int,d[1:]))')],
    [([1]*100000,100000),(list(range(100000,0,-1)),1)],
    '样例1：保留目标1、2、3、5对应的四条线。样例2：目标全相同，不满足严格反序的相交定义，三条都能留。样例3：严格下降，任意两条相交，只留1条。')

def segment_oracle(s):
    best=None
    for bits in product('01',repeat=len(s)//2):
        target=''.join(c*2 for c in bits);flips=sum(a!=b for a,b in zip(s,target));runs=1+sum(a!=b for a,b in zip(bits,bits[1:]));candidate=(flips,runs)
        if best is None or candidate<best:best=candidate
    return best[1]
add(58,'最少翻转下的最少偶数连续段',
    '翻转偶数长度二进制串，使所有极大相同字符段长度都为偶数。优先最小化翻转数，在所有最少翻转方案中再最小化极大连续段数，输出段数。来源样例的单次翻转说明不正确，按双层目标独立计算。',
    '一行偶数长度二进制串，2..100000。',
    '把串按原位置每两位分组。00、11无需翻转且最少翻转时必须保留；01、10必须翻1位，可任选00/11。忽略自由组，统计被迫组字符变化数加1；全自由则1段。',
    '所有偶数极大段边界必在偶数位置，故每个位置对必须相同，各对最少翻转独立确定。自由对可填为左右某种颜色，不会增加超过被迫颜色变化所需的段数；每次被迫颜色变化至少增加一段，下界可达。',
    '时间O(n)，空间O(1)。',['11100110','0101','001100'],segment_oracle,
    lambda r:''.join(r.choice('01') for _ in range(2*r.randint(1,6))),text,
    '''def solve(d):
    s=d[0];last=None;runs=0
    for i in range(0,len(s),2):
        if s[i]==s[i+1] and s[i]!=last:runs+=1;last=s[i]
    return str(max(1,runs))
''',[('自由对也强制颜色','if s[i]==s[i+1] and s[i]!=last:','if s[i]!=last:'),('全自由返回0','max(1,runs)','runs')],
    [('01'*50000,1),('0011'*25000,50000)],
    '样例1：四对为11、10、01、10，后三对各需1次翻转，可全变成11，最少3次翻转后仅1段；来源给2段并非二级目标最优。样例2：每对翻1位后可全为0，1段。样例3：三对被迫为00、11、00，需3段。')

def credit_oracle(x):
    a,p,q,budget=x
    @lru_cache(None)
    def win(health,own):
        if own:return 0 if health<=p else win(health-p,False)
        normal=10**9 if health<=q else win(health-q,True)
        return min(normal,1+win(health,True))
    costs=[win(v,True) for v in a]
    return max(mask.bit_count() for mask in range(1<<len(a)) if sum(v for i,v in enumerate(costs) if mask>>i&1)<=budget)
add(59,'共享跳过次数的最多出库奖励',
    '每仓库你先减dispatch1，同事再减dispatch2，交替直到库存≤0，最后出库者获奖励。同事可跳过自己的回合，所有仓库总共至多skips次。求你最多赢几个仓库。',
    '第一行n dispatch1 dispatch2 skips（1≤n≤100000，其余1..10⁹）；第二行n个库存（1..10⁹）。',
    '对每仓库存取完整轮次后的正余数r=(v−1)mod(p+q)+1，赢它需floor((r−1)/p)次跳过。按所需次数从小到大购买奖励。',
    '完整不跳过轮次不影响轮到谁，最后正余数阶段你每多出库一次需同事跳过一次，最少额外次数是ceil(r/p)−1。把跳过放得更早可交换到末阶段，不降低必要次数。各奖励价值都为1，用最低成本优先能达到最大数量。',
    '时间O(n log n)，空间O(n)。',[([3,6,2],2,3,1),([2],2,3,1),([5,5],1,4,1)],credit_oracle,
    lambda r:([r.randint(1,18) for _ in range(r.randint(1,6))],r.randint(1,5),r.randint(1,5),r.randint(1,6)),
    lambda x:f'{len(x[0])} {x[1]} {x[2]} {x[3]}\n'+' '.join(map(str,x[0]))+'\n',
    '''def solve(d):
    n,p,q,budget=map(int,d[:4]);costs=sorted(((int(v)-1)%(p+q))//p for v in d[4:]);answer=0
    for c in costs:
        if c>budget:break
        budget-=c;answer+=1
    return str(answer)
''',[('按贵的仓库先选','costs=sorted(((int(v)-1)%(p+q))//p for v in d[4:])','costs=sorted((((int(v)-1)%(p+q))//p for v in d[4:]),reverse=True)'),('正余数错作零余数','(int(v)-1)%(p+q)','int(v)%(p+q)')],
    [(([1]*100000,1,1,1),100000),(([10**9]*100000,1,10**9,1),0)],
    '样例1：库存6和2无需跳过，你都能最后出库；库存3花1次跳过也能赢，因此实际可赢3个，来源答案2遗漏了可用跳过。样例2：第一回合直接清空，赢1个。样例3：每个仓需4次跳过，预算1不足，0个。')

def circle_oracle(a):
    best=1
    for start in range(len(a)):
        def visit(mask,last,count):
            nonlocal best
            if abs(a[last]-a[start])<=1:best=max(best,count)
            for i in range(len(a)):
                if not mask>>i&1 and abs(a[last]-a[i])<=1:visit(mask|1<<i,i,count+1)
        visit(1<<start,start,1)
    return best
add(60,'相邻功率差至多一的最大圆环',
    '选择尽可能多的服务器任意排成圆环，所有相邻对（含首尾）的功率差绝对值≤1。可以只选一台。',
    '第一行n（1..200000），第二行n个功率（0..10⁹）。',
    '选择的不同值必须连续，除两端值外每个内部值至少出现2次。统计频次并扫描连续键：若前一个键仅有1项，扩展新键时只能从该前键重新开始；否则累加。',
    '连续值之间不能有缺口。内部值分隔两侧，在环中往返至少经过两台该值服务器，因此需要2次；端点各1次即可，其余重复值可接在同值旁。满足条件可沿值递增再递减构造圆环，条件充要。扫描维护以当前值为右端的最大合法区间总频次。',
    '时间O(n log n)，空间O(n)。',[[4,3,5,1,2,2,1],[1,2,3],[7,7]],circle_oracle,
    lambda r:[r.randint(0,5) for _ in range(r.randint(1,7))],arr,
    '''def solve(d):
    from collections import Counter
    counts=Counter(map(int,d[1:]));keys=sorted(counts);best=current=0;previous=None
    for value in keys:
        if previous is None or value!=previous+1:current=counts[value]
        elif counts[previous]==1:current=counts[previous]+counts[value]
        else:current+=counts[value]
        best=max(best,current);previous=value
    return str(best)
''',[('不检查内部值重数','elif counts[previous]==1:','elif False:'),('忽略不同值缺口','value!=previous+1','False')],
    [([7]*200000,200000),(list(range(200000)),2)],
    '样例1：选择1、1、2、2、3，可排1、1、2、3、2，5台；功率3只有一台，不能再跨到4后返回。样例2：三个值各一次，首尾1与3相差2，只能选2台。样例3：两台同值可全部选。')

def shipping_oracle(a):
    @lru_cache(None)
    def visit(state):
        if not state:return 0
        best=1+visit(state[1:])
        for j in range(1,len(state)):
            if state[j]!=state[0]:best=min(best,1+visit(state[1:j]+state[j+1:]))
        return best
    return visit(tuple(sorted(a)))
add(63,'按仓库配对的最少发货次数',
    '一次发两个不同仓库的商品，或单发一个商品，求全部发完的最少次数。本题与Amazon45题同一规则，保留独立来源编号。',
    '第一行n（1..100000），第二行n个仓库编号（1..10⁹）。',
    '最大仓库频次为f，答案max(f,ceil(n/2))。',
    '每次至多2件给出ceil(n/2)下界，最多仓库每次只能发1件给出f下界。若存在多数仓库，用它和其它仓库配对后单发；否则不同仓库可以配至只剩至多1件，达到较大下界。',
    '时间O(n)，空间O(n)。',[[2,9,7,8,8],[1,1],[1,2,3]],shipping_oracle,
    lambda r:[r.randint(1,4) for _ in range(r.randint(1,9))],arr,
    '''def solve(d):
    from collections import Counter
    a=list(map(int,d[1:]));return str(max(max(Counter(a).values()),(len(a)+1)//2))
''',[('舍弃多数仓库限制','max(max(Counter(a).values()),(len(a)+1)//2)','(len(a)+1)//2'),('件数向下取整','(len(a)+1)//2','len(a)//2')],
    [([1]*100000,100000),(list(range(1,100001)),50000)],
    '样例1：两个8分别与2、9配对，再单发7，共3次。样例2：同仓库不能配对，2次。样例3：任意两件配对再单发，2次。')

def merge_oracle(x):
    a,b=x
    @lru_cache(None)
    def strings(i,j):
        if i==len(a):return (b[j:],)
        if j==len(b):return (a[i:],)
        return tuple(a[i]+s for s in strings(i+1,j))+tuple(b[j]+s for s in strings(i,j+1))
    return min(sum(s[i]>s[j] for i in range(len(s)) for j in range(i+1,len(s))) for s in strings(0,0))
add(66,'保序合并两串的最少逆序对',
    '交错合并两串，分别保留每串字符原顺序。逆序对是前面字符严格大于后面字符的下标对，求合并后最少逆序对数。来源zc与qd按本定义的最优为4，而不是2。',
    '两行小写字符串，各长度1..1000。',
    'dp[i,j]表示用完前i、j字符的最小逆序数。追加某个字符时，新增逆序数等于两已用前缀中比它大的字符数；预处理各前缀对26字母的较大计数，滚动DP。',
    '任意合并最后一位来自其中一串。去掉它得到对应前缀状态，新增逆序对恰是之前较大字符到它的配对，且与之前交错顺序无关。因此两种转移取小覆盖所有合法合并。',
    '时间O(nm+26(n+m))，空间O(26(n+m)+m)。',[('zc','qd'),('a','b'),('ba','a')],merge_oracle,
    lambda r:(''.join(r.choice('abcd') for _ in range(r.randint(1,5))),''.join(r.choice('abcd') for _ in range(r.randint(1,5)))),lambda x:'\n'.join(x)+'\n',
    '''def solve(d):
    a,b=d;n=len(a);m=len(b)
    def greater(s):
        rows=[[0]*26];counts=[0]*26
        for c in s:
            counts[ord(c)-97]+=1;row=[0]*26;total=0
            for k in range(25,-1,-1):row[k]=total;total+=counts[k]
            rows.append(row)
        return rows
    ga=greater(a);gb=greater(b);previous=[0]*(m+1)
    for j in range(1,m+1):previous[j]=previous[j-1]+gb[j-1][ord(b[j-1])-97]
    for i in range(1,n+1):
        ca=ord(a[i-1])-97;current=[0]*(m+1);current[0]=previous[0]+ga[i-1][ca]
        for j in range(1,m+1):
            cb=ord(b[j-1])-97
            current[j]=min(previous[j]+ga[i-1][ca]+gb[j][ca],current[j-1]+ga[i][cb]+gb[j-1][cb])
        previous=current
    return str(previous[m])
''',[('漏掉跨串逆序','+gb[j][ca]',''),('错误选择较大费用','current[j]=min(','current[j]=max(')],
    [(('z'*1000,'a'*1000),0),(('za'*500,'za'*500),500500)],
    '样例1：合并为qdzc有四个逆序对(q,d)、(q,c)、(d,c)、(z,c)，已最优；来源2不符合全部下标对定义。样例2：合并ab，0个。样例3：合并aba只有(b,a)一个逆序对。',time_limit=6)

add(67,'按频次与编号排序错误报告',
    '把全部bug编号按出现频次升序排列；频次相同时按编号升序，保留重复项。',
    '第一行n（1..200000），第二行n个编号（1..1000000）。',
    '先统计频次，再按(频次,编号)排序原数组。',
    '每个值的排序键固定且与题目两级排序一致，比较排序输出的所有相邻项都满足要求，且只重排不增删元素。',
    '时间O(n log n)，空间O(n)。',[[3,1,2,2,4],[2,1],[1,1,2,2]],
    lambda a:' '.join(map(str,[v for count in range(1,len(a)+1) for v in sorted(set(a)) if a.count(v)==count for _ in range(count)])),
    lambda r:[r.randint(1,8) for _ in range(r.randint(1,12))],arr,
    '''def solve(d):
    from collections import Counter
    a=list(map(int,d[1:]));counts=Counter(a);a.sort(key=lambda v:(counts[v],v))
    return ' '.join(map(str,a))
''',[('频次逆序','(counts[v],v)','(-counts[v],v)'),('同频编号逆序','(counts[v],v)','(counts[v],-v)')],
    [(list(range(200000,0,-1)),' '.join(map(str,range(1,200001))))],
    '样例1：1、3、4各出现1次，先按编号输出，2出现两次放最后。样例2：同频，输出1 2。样例3：两种频次都2，输出1 1 2 2。',output='输出排序后的n个编号。')

def trucks_oracle(x):
    capacities,weights=x
    @lru_cache(None)
    def visit(state,mask):
        if not mask:return True
        for i,w in enumerate(weights):
            if mask>>i&1:
                for j,c in enumerate(state):
                    if c>=w:
                        nxt=list(state);nxt[j]//=2
                        if visit(tuple(sorted(nxt)),mask^(1<<i)):return True
        return False
    return int(visit(tuple(sorted(capacities)),(1<<len(weights))-1))
add(68,'容量每次减半的包裹配送',
    '每次给任意当前容量足够的卡车送一个包裹，随后该卡车容量变成原当前容量除2向下取整。包裹可任意排序，判断能否送完。本站每个用例输入一个独立场景，对应来源多场景中的单个场景。',
    '第一行n m（均1..100000），第二行n个容量，第三行m个重量，均1..10⁹。',
    '包裹按重量降序。每次取当前最大容量卡车，足够则送出并将容量减半放回堆，否则失败。',
    '每台车提供递减槽位C、floor(C/2)、…，只能按此前缀使用。最大堆依次枚举所有槽位中最大的可用值，因为后续槽位不会大于其前驱，得到全局降序槽位。若最大剩余槽位小于最大剩余包裹则必无解，否则按降序匹配达到可行性最优。',
    '时间O(n+m log n+m log m)，空间O(n+m)。',[([8],[8,4,2,1]),([3],[2,2]),([4,3],[3,4])],trucks_oracle,
    lambda r:([r.randint(1,12) for _ in range(r.randint(1,3))],[r.randint(1,10) for _ in range(r.randint(1,6))]),
    lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',
    '''def solve(d):
    import heapq
    n,m=map(int,d[:2]);heap=[-int(v) for v in d[2:2+n]];heapq.heapify(heap)
    for weight in sorted(map(int,d[2+n:]),reverse=True):
        capacity=-heapq.heappop(heap)
        if capacity<weight:return '0'
        heapq.heappush(heap,-(capacity//2))
    return '1'
''',[('先送轻包裹','reverse=True','reverse=False'),('送货不减容量','-(capacity//2)','-capacity')],
    [(([10**9]*100000,[10**9]*100000),1),(([1]*100000,[2]*100000),0)],
    '样例1：唯一卡车容量依次8、4、2、1，正好送完，输出1。样例2：送2后容量只剩1，第二个2送不了，输出0。样例3：容量4送重量4、容量3送重量3，输出1。')

def quality_oracle(a):
    start=tuple(a);heap=[(0,start)];dist={start:0}
    while heap:
        cost,state=heapq.heappop(heap)
        if dist[state]!=cost:continue
        if all(state.count(v)==state.index(v,len(state)-1-state[::-1].index(v))+1-state.index(v) for v in set(state)):return cost
        for old in set(state):
            for new in set(state)-{old}:
                nxt=tuple(new if v==old else v for v in state);value=cost+state.count(old)
                if value<dist.get(nxt,10**9):dist[nxt]=value;heapq.heappush(heap,(value,nxt))
add(69,'合并质量类别使同值连续的最低费用',
    '一次选择x、y，把数组中所有x全改成y，费用为当前x出现次数。目标是每个剩余值的出现都形成一个连续段，求最小总费用。',
    '第一行n（1..200000），第二行n个质量值（−10⁹..10⁹）。',
    '用最后出现位置划分最小封闭块，类似按字符最后位置分段。每块所有值必须合并为一种，选择该块原频次最高者保留，费用=块长−最大频次。',
    '若某值两次出现夹住另一值，最终保留该值时中间位置必须同值；即使先改名，全局替换也不能拆开同类位置。因此相互交错的出现区间闭包必须成为同类。不同封闭块没有共享值，可独立合并。保留某类原值无需支付该类频次，其余每个位置至少改一次，选最高频次达到最低费用。',
    '时间O(n)，空间O(n)。',[[7,7,5,7,3,5,3],[1,1,2,2],[1,2,1]],quality_oracle,
    lambda r:[r.randint(1,4) for _ in range(r.randint(1,8))],arr,
    '''def solve(d):
    a=list(map(int,d[1:]));last={v:i for i,v in enumerate(a)};counts={};end=0;start=0;largest=0;answer=0
    for i,v in enumerate(a):
        end=max(end,last[v]);counts[v]=counts.get(v,0)+1;largest=max(largest,counts[v])
        if i==end:answer+=i-start+1-largest;start=i+1;counts={};largest=0
    return str(answer)
''',[('所有封闭块强制合一','end=0','end=len(a)-1'),('忽略最佳保留类别','-largest','-1')],
    [(list(range(200000)),0),([1,2]*100000,100000)],
    '样例1：三种值交错在同一封闭块，保留出现3次的7，另外4个位置改成7，费用4。样例2：每类已连续，0费用。样例3：把中间2改成1，费用1。')

def drone_oracle(x):
    edges,requests=x;m=len(edges);pos=0;answer=0
    for target in requests:
        target-=1;dist=[10**30]*m;dist[pos]=0;heap=[(0,pos)]
        while heap:
            cost,u=heapq.heappop(heap)
            if cost!=dist[u]:continue
            for v,w in (((u+1)%m,edges[u]),((u-1)%m,edges[(u-1)%m])):
                if cost+w<dist[v]:dist[v]=cost+w;heapq.heappush(heap,(cost+w,v))
        answer+=dist[target];pos=target
    return answer
add(70,'按序访问环形无人机枢纽的最短总时间',
    '第i段transitionTime连接枢纽i与i+1，最后一段连接m与1，均可双向移动。从1开始依次访问请求枢纽，求总时间最小值。来源示例按这些边权的答案为3而非4。',
    '第一行m n（1≤m≤5000，1≤n≤200000），第二行m个边权（1..1000000），第三行n个请求编号（1..m）。',
    '前缀和给出枢纽在线性展开上的位置，每次相邻请求的距离取两方向弧长最小值。',
    '无负边环上两点最短路径只可能是顺时针或逆时针简单弧。每步必须到达指定枢纽，下一步起点固定，因此逐步最小化可以独立相加。',
    '时间O(m+n)，空间O(m)。',[([5,2,1],[1,3,3,2]),([7],[1,1]),([2,3],[2,1])],drone_oracle,
    lambda r:(lambda m:([r.randint(1,9) for _ in range(m)],[r.randint(1,m) for _ in range(r.randint(1,10))]))(r.randint(1,6)),
    lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',
    '''def solve(d):
    m,n=map(int,d[:2]);edges=list(map(int,d[2:2+m]));prefix=[0]
    for w in edges:prefix.append(prefix[-1]+w)
    previous=0;answer=0
    for index in range(2+m,len(d)):
        current=int(d[index])-1;distance=abs(prefix[current]-prefix[previous]);answer+=min(distance,prefix[-1]-distance);previous=current
    return str(answer)
''',[('只沿展开方向走','min(distance,prefix[-1]-distance)','distance'),('每次错误从1出发','previous=current','previous=0')],
    [(([1000000]*5000,[2501,1]*100000),500000000000000)],
    '样例1：1→1为0，1→3走最后一条边为1，3→3为0，3→2为2，总和3。样例2：只有一个枢纽，总时间0。样例3：两枢纽间两条路取较短2，两次往返总4。')

def plans_oracle(x):
    a,b,blocked=x;bad=set(blocked)
    return max(v+w for i,v in enumerate(a) for j,w in enumerate(b) if (i,j) not in bad)
def plans_random(r):
    n=r.randint(2,6);m=r.randint(2,6);pairs=list(product(range(n),range(m)));bad=r.sample(pairs,r.randint(1,n*m-1))
    return [r.randint(1,20) for _ in range(n)],[r.randint(1,20) for _ in range(m)],bad
add(72,'兼容套餐与功能的最大总价',
    '选择一个套餐和一个功能，不能选择给定不兼容下标对。至少有一个兼容组合，求最大总价。',
    '第一行n m X（2≤n,m≤100000，1≤X≤min(200000,nm−1)）；两行分别n个套餐价、m个功能价（1..10⁹）；随后X行1-based不兼容下标。',
    '功能按价格降序。对每个套餐，从最贵功能开始跳过不兼容项，第一个兼容项就是该套餐最优选择，取全局最大。',
    '对固定套餐，降序扫描第一次合法项价格最大。每次失败检查对应一条该套餐的不兼容边，因此所有套餐失败检查总数不超过X，成功检查至多n次。枚举全部套餐保证全局最优。',
    '时间O(m log m+n+X)，空间O(n+m+X)。',[([5,8],[4,7],[(1,1)]),([1,2],[3,4],[(0,0),(0,1),(1,0)]),([9,1],[8,1],[(1,1)])],plans_oracle,plans_random,
    lambda x:f'{len(x[0])} {len(x[1])} {len(x[2])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n'+''.join(f'{i+1} {j+1}\n' for i,j in x[2]),
    '''def solve(d):
    n,m,x=map(int,d[:3]);a=list(map(int,d[3:3+n]));b=list(map(int,d[3+n:3+n+m]));bad=set();pos=3+n+m
    for i in range(pos,len(d),2):bad.add((int(d[i])-1,int(d[i+1])-1))
    order=sorted(range(m),key=lambda j:b[j],reverse=True);answer=0
    for i,value in enumerate(a):
        for j in order:
            if (i,j) not in bad:answer=max(answer,value+b[j]);break
    return str(answer)
''',[('忽略不兼容','if (i,j) not in bad:','if True:'),('从最便宜功能开始','reverse=True','reverse=False')],
    [(([1]*100000,[1]*100000,[(i,0) for i in range(100000)]),2)],
    '样例1：8+7被禁止，8+4与5+7都得12，答案12。样例2：唯一兼容是套餐2、功能2，总价6。样例3：9+8兼容，最大17。')

def sort_oracle(s):
    target=''.join(sorted(s));queue=deque([(s,0)]);seen={s}
    while queue:
        state,d=queue.popleft()
        if state==target:return d
        for i in range(len(s)):
            for j in range(i+2,len(s)+1):
                if i==0 and j==len(s):continue
                nxt=state[:i]+''.join(sorted(state[i:j]))+state[j:]
                if nxt not in seen:seen.add(nxt);queue.append((nxt,d+1))
add(74,'排序真子串的最少操作',
    '每次选择任意非空真子串（不能是整个字符串），把其中字符升序排序。求使整个串升序的最少操作次数。',
    '一行小写字符串，长度3..100000。',
    '已排序为0。若首字符为全局最小或末字符为全局最大，排序其余部分只需1。否则若首字符是唯一最大且末字符是唯一最小，需3；其它情况2。',
    '1次操作必须保留至少一个端点不动，故需它已处最终正确极值。两次可先把一个最小值移到首位或最大值移到末位，再排序剩余部分；唯独唯一最大在首且唯一最小在尾时，任何真子串都不能同时处理两端，第一步无法固定任何端点，2次不够。此时先排序前n−1位，再后n−1位，再前n−1位可在3次完成。',
    '时间O(n)，空间O(1)。',['zyxpqa','abc','bac'],sort_oracle,
    lambda r:''.join(r.choice('abcd') for _ in range(r.randint(3,6))),text,
    '''def solve(d):
    s=d[0]
    if all(s[i-1]<=s[i] for i in range(1,len(s))):return '0'
    lo=min(s);hi=max(s)
    if s[0]==lo or s[-1]==hi:return '1'
    if s[0]==hi and s[-1]==lo and s.count(lo)==1 and s.count(hi)==1:return '3'
    return '2'
''',[('忽略极值唯一性',' and s.count(lo)==1 and s.count(hi)==1',''),('所有未排好都需3次',"return '2'","return '3'")],
    [('a'*100000,0),('z'+'b'*99998+'a',3)],
    '样例1：首z为唯一最大、尾a为唯一最小，需3次，可依次排序前5位、后5位、前5位。样例2：本来有序，0次。样例3：末c已为最大，排序前两位ba即可，1次。')

def units_oracle(x):
    a,s=x;positions=[i for i,c in enumerate(s) if c=='1'];best=0
    for mask in range(1<<len(positions)):
        covered=set()
        for j,i in enumerate(positions):covered.add(i-1 if i>0 and mask>>j&1 else i)
        best=max(best,sum(a[i] for i in covered))
    return best
add(75,'单位最多左移一步的最大覆盖人口',
    'unit[i]=1表示城市i有一个单位，每个单位可留在原地，或在i>1时向左移一步且至多移动一次。城市有至少一个单位就被覆盖，重复覆盖人口只计一次，求最大总覆盖人口。',
    '第一行n（1..100000），第二行n个人口（1..10000），第三行长度n的01串。',
    '从右向左DP，状态表示右侧单位是否移入当前城市。枚举当前单位留下或左移，累加当前城市是否被覆盖的人口，传递是否移向左邻的状态。',
    '当前城市只能由原位单位或右邻单位覆盖，右侧其它决定只需通过一个是否移入的状态概括。枚举当前合法移动，城市人口只在当前位置计一次。最左单位不能外移，终止状态正确，覆盖全部方案并取最大。',
    '时间O(n)，保存人口数组空间O(n)，DP状态额外空间O(1)。',[([10,5,8,9,6],'01101'),([7],'0'),([3,8],'11')],units_oracle,
    lambda r:(lambda n:([r.randint(1,20) for _ in range(n)],''.join(r.choice('01') for _ in range(n))))(r.randint(1,9)),
    lambda x:arr(x[0])+x[1]+'\n',
    '''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:n+1]));s=d[n+1];dp=[0,-10**30]
    for i in range(n-1,-1,-1):
        nxt=[-10**30,-10**30]
        for incoming in (0,1):
            if s[i]=='0':nxt[0]=max(nxt[0],dp[incoming]+(a[i] if incoming else 0))
            else:
                nxt[0]=max(nxt[0],dp[incoming]+a[i])
                if i>0:nxt[1]=max(nxt[1],dp[incoming]+(a[i] if incoming else 0))
        dp=nxt
    return str(dp[0])
''',[('重复覆盖计两次','dp[incoming]+a[i]','dp[incoming]+a[i]*(1+incoming)'),('禁止左移','if i>0:','if False:')],
    [(([10000]*100000,'1'*100000),10**9),(([10000]*100000,'0'*100000),0)],
    '样例1：第2城单位移到1，第3城单位留3，第5城单位移4，人口10+8+9=27。样例2：没有单位，覆盖0。样例3：两个都留原地，人口3+8=11。')

BLOCKED={
 61:'原n可到10⁶，其1..n排列标准十进制输入约6.9MB，必超过当前单用例4MiB限制；不能悄悄缩小约束。',
 62:'约束允许本来有序的排列，0次交换对任意非负k都合法，因此不存在最大非负k；未约定这种情况返回值或k上界。',
 64:'blocked-then-unblocked后到底解锁哪个0的规则缺失，无法确定状态转移。',
 65:'同bid且同timestamp时轮转先后未定义，客户ID是否可重复以及多请求合并规则未给出，可能改变没拿到商品的客户集合。',
 71:'未规定配对规则是否互不重叠、多条规则同时触发如何执行，也未明确另一地区的选择策略，状态和优化目标不能确定。',
 72:'算法已独立验证，但n=m=100000、X=200000、价格10⁹且不兼容对为高编号时，合法标准输入超过4MiB限制；现有较小编码大例不足以覆盖，需统一扩容后再接入，不缩小原约束。',
 73:'题意可读，但d=2且总和整除n时目标必须全等，k足够大即含最少转账的强NP-hard子问题。例[4,4,14,14,14],k=20,d=2需4次，不能用max(欠方次数,盈方次数)=3冒充最优。n=10⁵范围需要原题额外限制，而非声称题意错误。研究依据：https://arxiv.org/abs/1402.6556 。',
}
SPECS=[spec for spec in SPECS if spec['number'] not in BLOCKED]

def execute_many(path,inputs):
    # Local batched execution uses fresh __main__ globals and streams, not per-case OS isolation.
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300,check=True)
    outputs=json.loads(result.stdout);assert len(outputs)==len(inputs)
    return [value.rstrip('\n') for value in outputs]
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[]
    metadata_only='--metadata-only' in sys.argv
    if metadata_only:
        allowed={f"oa-amazon-{spec['number']}" for spec in SPECS}
        items=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if x['id'] in allowed]
        reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if x['id'] in allowed]
        assert {x['id'] for x in items}==allowed=={x['id'] for x in reports}
    for spec in SPECS:
        if metadata_only:continue
        identifier=f"oa-amazon-{spec['number']}";source=sources[identifier];rng=random.Random(SEED+spec['number']);code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        path=OUT/'references'/f'{identifier}.py';path.write_text(code);oracles=[]
        for x in spec['samples']+[spec['random'](rng) for _ in range(160)]:
            stdin=spec['encode'](x);expected=str(spec['oracle'](x))
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        tests=oracles[:3]+[dict(input=spec['encode'](x),expectedOutput=str(y)+'\n') for x,y in spec['edges']]+oracles[3:27];cases=[]
        checks=oracles+tests
        actuals=execute_many(path,[c['input'] for c in checks])
        for i,(actual,c) in enumerate(zip(actuals,checks)):
            assert actual==c['expectedOutput'].rstrip('\n'),(identifier,'reference',i,actual,c['expectedOutput'])
        for i,c in enumerate(tests):
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1))
        mutants=[];kills=[]
        for index,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code;changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{identifier}-{index}.py';mp.write_text(changed)
            outputs=execute_many(mp,[c['input'] for c in cases])
            rejected=[i for i,(value,c) in enumerate(zip(outputs,cases)) if value!=c['expectedOutput'].rstrip('\n')];assert rejected,(identifier,name,'survived')
            mutants.append(dict(name=name,code=changed));kills.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Amazon'],description=spec['description']+'\n\n本站独立编写标准I/O、样例与评测。',input=spec['input'],output=spec.get('output','输出一个整数答案。'),explanation=spec['explanation'],hints=[spec['idea']],timeLimit=spec.get('time_limit',4),memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        result=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True);raw=result.stdout;assert '\ufffd' not in raw
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        docs={'packages':json.loads(raw),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')}
        for folder,data in docs.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(raw.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=kills,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,'163 oracle comparisons;',len(cases)-3,'hidden; two normal-exit mutants rejected',flush=True)
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped={f'oa-amazon-{n}':reason for n,reason in BLOCKED.items()},note='Local independent validation via batched runpy with fresh __main__ globals and stdin/stdout per case; not per-case OS isolation. Real per-case sandbox report remains mandatory.'),ensure_ascii=False,indent=2)+'\n')
    corrections={58:'来源样例11100110的最少翻转是3，可变全1只剩1段，来源答案2不是二级目标最优。',59:'来源[3,6,2],dispatch1=2,dispatch2=3,skips=1实际可赢3仓，不是2。',66:'zc与qd按全部逆序对定义最少4，不是来源2。',70:'来源环权[5,2,1]请求[1,3,3,2]费用0+1+0+2=3，不是4。'}
    reviews=[dict(id=f'oa-amazon-{n}',status='blocked' if n in BLOCKED else 'authored',reason=BLOCKED.get(n,corrections.get(n,'按原题定义独立算法、证明、暴力oracle及最大规模边界验证。'))) for n in range(51,76)]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
