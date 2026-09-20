"""Original Amazon256–275 authorship; source snapshot is read, never executed."""
from collections import Counter
from functools import lru_cache
from itertools import combinations, permutations, product
from pathlib import Path
import hashlib,json
import amazon_remaining_h as base
base.SPECS=[];base.BATCH='amazon-remaining-m';base.SEED=20262560
add=base.add;arr=base.arr
def seq(a):return ' '.join(map(str,a))
def ak(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def two(x):return str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n'

def contiguous_oracle(a):
    def canonical(state):
        labels={};return tuple(labels.setdefault(v,len(labels)) for v in state)
    @lru_cache(None)
    def visit(state):
        runs=[v for i,v in enumerate(state) if i==0 or v!=state[i-1]]
        if len(runs)==len(set(state)):return 0
        values=set(state)
        return 1+min(visit(canonical(tuple(y if v==x else v for v in state))) for x in values for y in values if x!=y)
    return visit(canonical(a))
add(256,'全局合并数值使同值连续的最少操作','一次选择两个不同值x、y，把数组里所有x同时替换成y。要求最终每个值的全部出现位于一个连续块，求最少操作数。不能只改一个出现，也不能删除元素。','第一行n，第二行数组。原始快照无数值界，本站1≤n≤200000，−10^9≤元素≤10^9。','记录每个值最后出现位置，扫描得到最大数量的独立连续区间，答案为原不同值数量减独立区间数量。','同值首末之间的全部位置最终必须同色，因此相互覆盖的首末区间形成的每个连通块必须合并成一种值。扫描最远末位置恰好得到这些块；含d种值的块至少需要d−1次合并，逐种替换到同一值也恰需d−1次。求和得到不同值数减块数。','时间O(n)，空间O(n)。',[[1,2,3,1],[1,2,3],[1,2,1,3,4,3]],'答案依次2、0、2。第一个例子不是只处理重复出现的1；夹在两个1之间的2和3最终也必须合并。',lambda r:[r.randint(-2,3) for _ in range(r.randint(1,8))],[([1]+list(range(2,200000))+[1],199998),(list(range(-100000,100000)),0),([10**9]*200000,0)],arr,contiguous_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));last={v:i for i,v in enumerate(a)};end=-1;blocks=0
    for i,v in enumerate(a):
        end=max(end,last[v])
        if i==end:blocks+=1
    return str(len(last)-blocks)
''',[('错误只数重复段值','return str(len(last)-blocks)',"return str(sum(c>1 for c in __import__('collections').Counter(v for i,v in enumerate(a) if i==0 or v!=a[i-1]).values()))"),('误数每个值多余出现','return str(len(last)-blocks)','return str(len(a)-len(last))')],2400030)

def match_oracle(x):
    texts,patterns=x;out=[]
    for word,pattern in zip(texts,patterns):
        at=pattern.index('*');ok=False
        for left in range(len(word)+1):
            for right in range(left,len(word)+1):
                if pattern[:at]+word[left:right]+pattern[at+1:]==word:ok=True
        out.append('YES' if ok else 'NO')
    return '\n'.join(out)
def match_random(r):
    texts=[];patterns=[]
    for _ in range(r.randint(1,5)):
        texts.append(''.join(r.choice('abc') for _ in range(r.randint(1,8))))
        s=''.join(r.choice('abc') for _ in range(r.randint(0,7)));i=r.randrange(len(s)+1);patterns.append(s[:i]+'*'+s[i:])
    return texts,patterns
add(257,'含恰好一个星号的完整模式匹配','给出n对文本与模式。模式恰含一个*，它可替换为零个或多个小写字母，其他字符不能修改。判断每个模式能否变为整个对应文本，按顺序输出YES或NO。实现不使用内置正则库。','第一行n，随后n行每行text pat，以空格分隔。1≤n≤10，1≤每个文本及模式长度≤100000；文本仅小写，模式除唯一*外仅小写。','把模式拆成星号前缀和后缀，要求文本总长足够容纳两段且开头、结尾分别相等。','星号之外的字符必须原样出现在文本两端，且两段不能重叠，所以条件必要。条件成立时，把两段之间的全部字符（可为空）作为星号替换即可得到完整文本，因此充分。','时间O(总输入字符数)，空间O(总输入字符数)含读取。',[(['code','coder'],['co*d','co*er']),(['abc','abcb c'.replace(' ', '')],['ab*bc','ab*bc']),(['a','abc'],['*','abc*'])],'结果依次NO/YES、NO/YES、YES/YES。ab*bc至少需要4个字符，不能让前后缀共用同一个b。',match_random,[((['a'*100000]*10,['a'*99999+'*']*10),'\n'.join(['YES']*10)),((['a'*100000]*10,['a'*99998+'b*']*10),'\n'.join(['NO']*10)),((['z'*100000]*10,['*']*10),'\n'.join(['YES']*10))],lambda x:str(len(x[0]))+'\n'+''.join(a+' '+b+'\n' for a,b in zip(*x)),match_oracle,
'''def solve(d):
    out=[]
    for i in range(int(d[0])):
        s,p=d[1+2*i:3+2*i];left,right=p.split('*');ok=len(s)>=len(left)+len(right) and s.startswith(left) and s.endswith(right)
        out.append('YES' if ok else 'NO')
    return '\\n'.join(out)
''',[('错误允许两端重叠','len(s)>=len(left)+len(right)','True'),('星号错误要求至少一字符','len(s)>=len(left)+len(right)','len(s)>len(left)+len(right)')],2000050,output='按输入顺序每行输出YES或NO。')

def batch_oracle(a):
    @lru_cache(None)
    def visit(state,size):
        choices=[i for i,v in enumerate(state) if v];best=0
        for group in combinations(choices,size):
            nxt=list(state)
            for i in group:nxt[i]-=1
            best=max(best,1+visit(tuple(nxt),size+1))
        return best
    return visit(tuple(a),1)
add(258,'不同类别且批量递增的最大出货批数','每类有inventory[i]件物品。每一批每类至多用一件，后一批件数严格大于前一批；每件至多使用一次，允许有剩余。求最多批数。','第一行n，第二行库存。原文无数值界，本站1≤n≤200000，0≤inventory[i]≤10^9。','库存升序累加，维护已可构造批数k；每纳入一个新类别，若总量达到(k+1)(k+2)/2就将k加1，每个类别最多增加一批。','任意k批可删物品缩为1..k。二部整数流的割条件为：对任意j批，其需求不超过各类别min(库存,j)之和，只需检查需求最大的j批，需求D_k(j)=j(2k−j+1)/2。设旧最优k，新类别容量c最大。新最优至多k+1，因为去掉新类别并删最小批，余下每批仍至少1..k。若总量不足下一三角数，不可增加；否则对j≤c，新增容量贡献j，旧割条件D_k(j)加j恰为D_(k+1)(j)（j=k+1时旧总需求亦成立）。对j>c，全部库存≤c，容量和就是总量，至少下一三角数，故也满足割条件。所有割条件成立，整数流保证新阶梯可构造，归纳证明算法。','时间O(n log n)，空间O(n)。',[[2,3,1,4,2],[100,1,1],[0,0,0]],'答案依次4、2、0。总件数很多也无法让三种类别中只有一件的两类同时供应第二批和第三批。',lambda r:[r.randint(0,4) for _ in range(r.randint(1,6))],[([10**9]*200000,200000),([1]*200000,631),([0]*200000,0)],arr,batch_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]));total=0;k=0
    for v in a:
        total+=v
        if total>=(k+1)*(k+2)//2:k+=1
    return str(k)
''',[('错误降序累积容量','sorted(map(int,d[1:]))','sorted(map(int,d[1:]),reverse=True)'),('严格递增误作同样批量','return str(k)','return str(sum(a))')],2200030)

def intervals_oracle(x):
    starts,durations,costs=x;n=len(starts);best=0
    for mask in range(1<<n):
        chosen=[i for i in range(n) if mask>>i&1]
        if all(starts[i]+durations[i]<starts[j] or starts[j]+durations[j]<starts[i] for i,j in combinations(chosen,2)):best=max(best,sum(costs[i] for i in chosen))
    return best
def intervals_random(r):
    n=r.randint(1,10);return [r.randint(0,12) for _ in range(n)],[r.randint(0,5) for _ in range(n)],[r.randint(0,15) for _ in range(n)]
add(259,'闭区间互不重叠的最大权重和','区间i为闭区间[start[i],start[i]+duration[i]]，收益cost[i]。选择两两不重叠的区间使总收益最大；端点相同也算重叠，允许空选。此闭区间约定由来源样例中[2,4]与[4,7]不兼容及答案9明确恢复。','第一行n，随后三行分别为start、duration、cost。原文无数值界，本站1≤n≤200000，0≤各值≤10^9；duration=0表示单点区间。','按结束时间排序，dp记录前若干区间最优。对当前区间二分结束时间严格小于其开始时间的前缀，在不选与接上该前缀后选择之间取最大。','任何最优方案若不含当前区间，归前一前缀；若含当前区间，其余区间必须结束于当前开始之前，且该前缀最优可与它兼容。两个情况覆盖全部选择，归纳得dp正确。等端点相交所以必须严格小于。','时间O(n log n)，空间O(n)，收益和用64位。',[([4,2,7,8],[3,2,3,2],[7,3,1,2]),([0,1],[1,1],[5,7]),([1,1,2],[0,0,0],[3,5,4])],'答案依次9、7、9。第二例在1相交不能都选；第三例同位置两点选收益5，再选位置2收益4。',intervals_random,[((list(range(200000)),[0]*200000,[10**9]*200000),200000000000000),(([10**9]*200000,[10**9]*200000,[10**9]*200000),10**9),((list(range(200000)),[1]*200000,[1]*200000),100000)],lambda x:str(len(x[0]))+'\n'+''.join(seq(v)+'\n' for v in x),intervals_oracle,
'''def solve(d):
    from bisect import bisect_left
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:1+2*n]));c=list(map(int,d[1+2*n:]));items=sorted((x+y,x,z) for x,y,z in zip(a,b,c));ends=[e for e,s,w in items];dp=[0]
    for i,(end,start,value) in enumerate(items):
        j=bisect_left(ends,start,0,i);dp.append(max(dp[-1],dp[j]+value))
    return str(dp[-1])
''',[('错误兼容相同端点','bisect_left','bisect_right'),('错误全部区间均累加','dp.append(max(dp[-1],dp[j]+value))','dp.append(dp[-1]+value)')],6600050)

def transfer_oracle(x):
    a,k=x;return sum(sorted((v+w for v in a for w in a),reverse=True)[:k])
add(260,'选不同有序服务器对的最大传输总量','选择pipelineCount个不同有序下标对(i,j)，每对贡献throughput[i]+throughput[j]。允许i=j，(i,j)与(j,i)不同；容量相同的不同服务器身份也不同。求最大总量。','第一行n pipelineCount，第二行throughput。原文无数值界，本站1≤n≤200000，1≤throughput[i]≤10^9，1≤pipelineCount≤n²；K用64位。本站要求输出精确整数，最大答案8×10^19超过有符号64位，不取模。','二分第K大对和T。排序后用双指针和前缀和统计所有对和≥T的个数C与总和S，结果S−(C−K)T。','对和阈值越大，达标有序对数单调不增。最大的仍至少K对的整数阈值就是第K大对和。超过它的全部必须选，等于它的只需补足K，因此从所有≥T的和中扣掉多余C−K个T恰得前K大之和。逐个主服务器统计全部合格备服务器，不会去除有序身份或自配。','时间O(n log n+n log V)，空间O(n)；V为容量数值范围。',[([4,2,5],4),([2,2],4),([1,10],3)],'答案依次36、16、42。第三例前3大是20、11、11，两个方向都要计数。',lambda r:([r.randint(1,15) for _ in range(n)],r.randint(1,n*n)) if (n:=r.randint(1,10)) else None,[(([10**9]*200000,40000000000),80000000000000000000),(([1]*200000,1),2),(([1]*199999+[10**9],399999),2*10**9+399998*(10**9+1))],ak,transfer_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    def aggregate(t):
        j=n;count=total=0
        for v in a:
            while j and a[j-1]+v>=t:j-=1
            c=n-j;count+=c;total+=c*v+prefix[n]-prefix[j]
        return count,total
    low=2*a[0];high=2*a[-1]+1
    while low+1<high:
        middle=(low+high)//2
        if aggregate(middle)[0]>=k:low=middle
        else:high=middle
    count,total=aggregate(low)
    return str(total-(count-k)*low)
''',[('多余同阈值对忘记扣除','total-(count-k)*low','total'),('错误把有序对合并为无序','return str(total-(count-k)*low)','return str((total-(count-k)*low)//2)')],2200050,time=8)

def cluster_oracle(a):
    @lru_cache(None)
    def visit(mask):
        ids=[i for i in range(len(a)) if mask>>i&1]
        if len(ids)<3:return 0
        i=ids[0];best=visit(mask^(1<<i))
        for j,k in combinations(ids[1:],2):best=max(best,sorted((a[i],a[j],a[k]))[1]+visit(mask^(1<<i)^(1<<j)^(1<<k)))
        return best
    return visit((1<<len(a))-1)
add(261,'可留余项的三服务器中位数最大总功率','从服务器中选若干互不相交三元组，每组功率是三值中位数。允许任意服务器不用，也允许不建组，最大化各组中位数之和。','第一行n，第二行功率。原文无数值界，本站1≤n≤200000，−10^9≤功率≤10^9；本站包含负数功率，负收益组可不建立。','降序排序，依次考察第2、第4、…第2⌊n/3⌋项，只累加正数。','建q组时，按中位数降序，第j个中位数至少需要2j个不小于它的元素，所以不超过降序第2j项。用最大的2q项成对作最大值与中位数，再配最小q项可同时达到所有上界。q≤⌊n/3⌋，候选中位数依次不增，故只加正贡献即最优。','时间O(n log n)，空间O(n)。',[[1,2,3,4,5,6],[-3,-2,-1],[8,8,1,1]],'答案依次8、0、8。负数组不建组收益0，而不是强制建一组。',lambda r:[r.randint(-5,9) for _ in range(r.randint(1,9))],[([10**9]*200000,66666000000000),([-10**9]*200000,0),([1]*200000,66666)],arr,cluster_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]),reverse=True);answer=sum(max(0,a[2*j+1]) for j in range(len(a)//3));return str(answer)
''',[('强制取负收益组','max(0,a[2*j+1])','a[2*j+1]'),('错误取每组三数最大值','a[2*j+1]','a[2*j]')],2400030)

def final_oracle(a):
    # Enumerate reorderings and all allowed reductions, not a sorted greedy.
    best=0
    for order in set(permutations(a)):
        possible={1} if order[0]>=1 else set()
        for cap in order[1:]:possible={v for old in possible for v in range(1,min(cap,old+1)+1)}
        best=max(best,max(possible,default=0))
    return best
add(262,'重排并仅减小时的最大末元素','可任意重排数组，并把元素减小为至少1的整数。最终首元素必须为1，且对i≥1满足a[i]−a[i−1]≤1，求最后元素最大值。这是单向差条件，不要求原数组有序。','第一行n，第二行数组。原文无数值界，本站1≤n≤200000，1≤元素≤10^9。','排序后从current=0开始，每个值v更新current=min(v,current+1)，最后current为答案。','首项1且每步最多升1给出末值h≤n。对排序值a[i]，最终要到h>a[i]，倒推最后h−a[i]项都必须大于a[i]，但原数组至多n−1−i项大于a[i]，故h≤a[i]+n−1−i。贪心递推展开后末值恰是n与所有这些上界的最小值，且构造每项不超过原值、首项1、差≤1，达到通用上界即最优。','时间O(n log n)，空间O(n)。',[[3,1,3,4],[100],[1,1,10]],'答案依次4、1、2。单元素必须变为1；不能直接把最大值当答案。',lambda r:[r.randint(1,6) for _ in range(r.randint(1,7))],[([10**9]*200000,200000),([1]*200000,1),(list(range(200000,0,-1)),200000)],arr,final_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]));current=0
    for v in a:current=min(v,current+1)
    return str(current)
''',[('忘记每步最多增加1','current=min(v,current+1)','current=v'),('错误不能重排','a=sorted(map(int,d[1:]))','a=list(map(int,d[1:]))')],2200030)

def pages_oracle(x):
    pages,threshold=x;n=len(pages)
    @lru_cache(None)
    def visit(active,dead):
        best=0
        for i in range(n):
            if (active|dead)>>i&1:continue
            nxt=active|1<<i;count=nxt.bit_count();bad=dead
            for j in range(n):
                if threshold[j]<=count:bad|=1<<j
            best=max(best,pages[i]+visit(nxt&~bad,bad))
        return best
    return visit(0,0)
add(263,'打印后按活跃数暂停的最大累计页数','全部打印机初始idle。每次激活一台idle机，立即打印其pages页；随后若此刻活跃机数量为x，则所有threshold≤x的机器立即永久暂停，包括尚未激活的idle机；暂停机不能再激活，活跃数量相应下降。求最大累计页数。来源主句误写threshold<x，但Note及三个完整例子一致使用≤，第二第三例明确idle机也暂停；本站据此公开纠正。','第一行n，第二行pages，第三行threshold。原文无数值界，本站1≤n≤200000，1≤pages[i]≤10^9，1≤threshold[i]≤n。','按threshold=t分组，只取每组最大的min(t,该组数量)个pages，再求和。','阈值t组的机器在活跃数达到t前不会暂停，因此该组第t台激活后，全组其余机器都会失效，最多取t台。按阈值递增激活各组选中的机器即可达到上界：若首次达到t时仍有低阈值旧机，它本该在此前不超过t−1的数量下被暂停，矛盾。故不会因旧组占位而在取满本组之前触发t。每组取最大页数即达到各组上界之和。','时间O(n log n)，空间O(n)，答案用64位。',[([4,1,5,2,3],[3,3,2,3,3]),([2,4,4,4,5,3],[1,3,1,3,3,2]),([2,6,10,13],[2,1,1,1])],'答案依次14、20、15。第三例先打印13页会永久暂停全部阈值1的机器，之后只能再打印阈值2机器的2页。',lambda r:([r.randint(1,20) for _ in range(n)],[r.randint(1,n) for _ in range(n)]) if (n:=r.randint(1,8)) else None,[(([10**9]*200000,[1]*200000),10**9),(([10**9]*200000,[200000]*200000),200000000000000),(([1]*200000,list(range(1,200001))),200000)],two,pages_oracle,
'''def solve(d):
    n=int(d[0]);pages=list(map(int,d[1:1+n]));threshold=list(map(int,d[1+n:]));groups={}
    for p,t in zip(pages,threshold):groups.setdefault(t,[]).append(p)
    answer=0
    for t,values in groups.items():answer+=sum(sorted(values,reverse=True)[:t])
    return str(answer)
''',[('错误按严格小于触发暂停','[:t]','[:t+1]'),('错误优先打印最少页数','sorted(values,reverse=True)','sorted(values)')],3600050)

def parentheses_oracle(x):
    s,kit,ratings=x;best=None
    for mask in range(1<<len(kit)):
        opens=sum(kit[i]=='(' for i in range(len(kit)) if mask>>i&1);closes=mask.bit_count()-opens
        # Reachability of all interleavings of s and freely ordered selected kit.
        @lru_cache(None)
        def visit(i,o,c,balance):
            if balance<0:return False
            if i==len(s) and o==c==0:return balance==0
            if i<len(s) and visit(i+1,o,c,balance+(1 if s[i]=='(' else -1)):return True
            if o and visit(i,o-1,c,balance+1):return True
            return bool(c and visit(i,o,c-1,balance-1))
        if visit(0,opens,closes,0):
            score=sum(ratings[i] for i in range(len(kit)) if mask>>i&1);best=score if best is None else max(best,score)
    assert best is not None
    return best
def parentheses_random(r):
    s=''.join(r.choice('()') for _ in range(r.randint(1,4)));kit='('*len(s)+')'*len(s)
    return s,kit,[r.randint(-8,9) for _ in kit]
add(264,'插入工具括号使平衡的最大评分','初始括号串s保持相对次序。kit的每个括号最多用一次，可任意位置插入，所用括号评分之和为收益。最终必须平衡，保证有方案；评分可负，允许不插入。求最大收益。','第一行s，第二行kit，第三行kit各字符评分。原文无数值界，本站1≤两串长度≤100000，−10^9≤评分≤10^9，保证可平衡。','求最少需要的左括号L和右括号R。两类评分各自降序，先取必需的L/R个，再逐对取左右剩余评分之和为正的配对。','最小前缀余额决定至少补L个左括号，最终总余额决定至少补R=L+原余额个右括号；把所有新增左放前、右放后即可实现。额外括号必须左右数量相同。固定数量时取同类最高分最优，排序后的后续配对收益非增，因此正收益对全取、其余不取达到最大。','时间O(|s|+|kit| log |kit|)，空间O(|kit|)。',[(')((',')(()))',[3,4,2,-4,-1,-3]),(')','(',[-7]),('()','()',[5,-2])],'答案依次6、−7、3。负分括号若修复原串必需也必须使用；第三例可额外插一对获得3。',parentheses_random,[(('('*100000,')'*100000,[10**9]*100000),100000000000000),(('()','('*50000+')'*50000,[-10**9]*100000),0),((')'*50000+'('*50000,'('*50000+')'*50000,[-10**9]*100000),-100000000000000)],lambda x:x[0]+'\n'+x[1]+'\n'+seq(x[2])+'\n',parentheses_oracle,
'''def solve(d):
    s,kit=d[:2];ratings=list(map(int,d[2:]));balance=0;minimum=0
    for c in s:balance+=1 if c=='(' else -1;minimum=min(minimum,balance)
    left=-minimum;right=left+balance;opens=sorted((v for c,v in zip(kit,ratings) if c=='('),reverse=True);closes=sorted((v for c,v in zip(kit,ratings) if c==')'),reverse=True);answer=sum(opens[:left])+sum(closes[:right])
    for a,b in zip(opens[left:],closes[right:]):answer+=max(0,a+b)
    return str(answer)
''',[('错误丢弃必需负分','answer=sum(opens[:left])+sum(closes[:right])','answer=sum(max(0,v) for v in opens[:left]+closes[:right])'),('额外括号错误各自只取正分','max(0,a+b)','max(0,a)+max(0,b)')],1400040)

def partitions_oracle(a):
    outcomes=[]
    for cuts in range(1<<(len(a)-1)):
        total=0;parts=1;value=a[0]
        for i,v in enumerate(a[1:]):
            if cuts>>i&1:total+=value;parts+=1;value=v
            else:value&=v
        outcomes.append((total+value,-parts))
    return -min(outcomes)[1]
add(265,'最小按位与总成本下的最多连续分区','把全部非负performance数组切为若干非空连续段。每段成本为段内所有数按位AND，总成本为段成本之和。先让总成本最小，再在此条件下令段数最多，输出段数。','第一行n，第二行performance。原文无数值界，本站1≤n≤200000，0≤performance[i]≤10^9。','若整段AND非零只能取1段。否则从左至右，每当当前段AND变为0立即切段；最后未归零的尾段并入前一段。','整体AND的每个1位在所有段AND中都为1，故若G>0，k段成本至少kG，一整段成本G，最优必须k=1。G=0时最小成本0，要求每段AND均0。第一段取最早归零前缀不会减少剩余可分段数：将任意最优第一段提前切，多出的后缀并入下一段也维持其AND为0。因此贪心归零次数最大，末尾并入上一段不改变0成本。','时间O(n)，辅助空间O(1)不含输入。',[[1,2,3],[7,7,7],[0,0,0]],'答案依次1、1、3。第一例前两项AND已0，最后的3必须并入该段，不能另开正成本段。',lambda r:[r.randint(0,31) for _ in range(r.randint(1,11))],[([0]*200000,200000),([10**9]*200000,1),([1,2]*100000,100000)],arr,partitions_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));all_bits=a[0]
    for v in a:all_bits&=v
    if all_bits:return '1'
    current=-1;answer=0
    for v in a:
        current&=v
        if current==0:answer+=1;current=-1
    return str(answer)
''',[('错误把零和而非与作为成本','current&=v','current+=v'),('尾部未归零也单独计段','return str(answer)','return str(answer+(current!=-1))')],2200030)

def tree_encode(x):return str(x[0])+'\n'+''.join(f'{u} {v}\n' for u,v in x[1])
def tree_oracle(x):
    n,edges=x;best=0
    for mask in range(1,1<<(n-1)):
        parents=list(range(n))
        def find(a):
            while parents[a]!=a:a=parents[a]
            return a
        for i,(u,v) in enumerate(edges):
            if not mask>>i&1:parents[find(u-1)]=find(v-1)
        sizes=Counter(find(i) for i in range(n));value=1
        for size in sizes.values():value*=size
        best=max(best,value)
    return best
add(266,'至少切一条树边后的最大连通块大小乘积','给一棵无向树，删除至少一条、可任意多条边，形成若干连通块。每块大小为节点数，求全部块大小的乘积最大值。不含节点权重，不对答案取模，也不允许完全不切。此页原文明确one or more，不能用另一个冲突题页的样例替换本页规则。','第一行n，随后n−1行每行u v，节点编号1..n，保证构成树。原文无数值界，本站2≤n≤2000，输出精确整数，可超过64位。','树背包dp[u][k]保留含u的开放连通块大小k，值为其他已封口块的最大乘积。对子边，切则乘子树最佳结算值，保留则卷积两块大小。根结算时排除k=n。','子树之间只有通向父亲的一条边。每个合法删边方案在该边上必为切或留：切时子树全部结算，留时只有包含子根的块与父块合并，其余块乘积独立相乘。枚举两种情况和全部块大小，归纳涵盖且只涵盖合法方案。根乘开放块大小完成全部计分；唯一无切边状态大小n被排除，恰满足至少一刀。','O(n²)次整数运算；整数有O(n)位，位运算复杂度需另计。逐子树释放DP，空间O(n)个大整数及树结构。',[(5,[(1,2),(2,3),(3,4),(4,5)]),(2,[(1,2)]),(6,[(1,i) for i in range(2,7)])],'答案依次6、1、5。星形不能像整数拆分那样任意分成两个3节点块；两点树必须切，答案1。',lambda r:(n,[(i,r.randint(1,i-1)) for i in range(2,n+1)]) if (n:=r.randint(2,10)) else None,[((2000,[(i,i+1) for i in range(1,2000)]),2*3**666),((2000,[(1,i) for i in range(2,2001)]),1999),((9,[(i,i+1) for i in range(1,9)]),27)],tree_encode,tree_oracle,
'''def solve(d):
    n=int(d[0]);g=[[] for _ in range(n)];edges=list(map(int,d[1:]))
    for i in range(0,len(edges),2):u,v=edges[i]-1,edges[i+1]-1;g[u].append(v);g[v].append(u)
    parent=[-1]*n;order=[0]
    for u in order:
        for v in g[u]:
            if v!=parent[u]:parent[v]=u;order.append(v)
    tables=[None]*n
    for u in reversed(order):
        dp=[0,1]
        for v in g[u]:
            if parent[v]!=u:continue
            child=tables[v];best=max(j*child[j] for j in range(1,len(child)));nxt=[0]*(len(dp)+len(child)-1)
            for k in range(1,len(dp)):
                value=dp[k];nxt[k]=max(nxt[k],value*best)
                for j in range(1,len(child)):nxt[k+j]=max(nxt[k+j],value*child[j])
            dp=nxt;tables[v]=None
        tables[u]=dp
    return str(max(k*tables[0][k] for k in range(1,n)))
''',[('错误允许完全不切','for k in range(1,n)))','for k in range(1,n+1)))'),('错误只切一条边','return str(max(k*tables[0][k] for k in range(1,n)))','sizes=[1]*n\n    for u in reversed(order[1:]):sizes[parent[u]]+=sizes[u]\n    return str(max(sizes[u]*(n-sizes[u]) for u in order[1:]))')],20010,time=8)

def protected_oracle(x):
    population,unit=x;units=[i for i,c in enumerate(unit) if c=='1'];best=0
    for decisions in product((0,1),repeat=len(units)):
        occupied={i-(step if i else 0) for i,step in zip(units,decisions)}
        best=max(best,sum(population[i] for i in occupied))
    return best
add(267,'每个安保单位至多左移一步的最大覆盖人口','城市排成一行，unit[i]=1表示初始有一个单位。单位可不动或向左相邻城市移动一次，首城单位只能不动。最终一个城市有至少一个单位就贡献一次population[i]，多个单位重叠不重复贡献。求最大保护人口。','第一行n，第二行population，第三行长n的01串unit。原文仅保留两数组等长约束，无数值界，本站1≤n≤200000，0≤population[i]≤10^9。','从左到右DP，保留前一城市是否有留驻单位两种状态。决定当前单位留或左移后，前一城市的最终覆盖已确定，结算其人口；最后结算末城。','一个城市只可能被本城留下的单位和右城左移来的单位保护。处理右城时两项决定都已知，之后不再改变，因此可立刻按逻辑或计一次人口。状态保存唯一仍待结算城市的留驻信息，枚举当前单位的全部合法决定，不重不漏得到最优。','时间O(n)，辅助空间O(1)不含输入。',[([10,5,8,9,6],'01101'),([7,4],'01'),([1,100,1],'011')],'答案依次27、7、101。第三例两个单位不能重复把中间100计两次。',lambda r:([r.randint(0,20) for _ in range(n)],''.join(r.choice('01') for _ in range(n))) if (n:=r.randint(1,10)) else None,[(([10**9]*200000,'1'*200000),200000000000000),(([10**9]*200000,'0'*200000),0),(([10**9,0]*100000,'01'*100000),100000000000000)],lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+x[1]+'\n',protected_oracle,
'''def solve(d):
    n=int(d[0]);p=list(map(int,d[1:1+n]));unit=d[1+n];dp={0:0}
    for i,c in enumerate(unit):
        nxt={}
        for previous,value in dp.items():
            for move in ((False,True) if c=='1' and i else (False,)):
                stay=int(c=='1' and not move);score=value+(p[i-1] if i and (previous or move) else 0);nxt[stay]=max(nxt.get(stay,-1),score)
        dp=nxt
    return str(max(value+(p[-1] if stay else 0) for stay,value in dp.items()))
''',[('错误重复计算同城两个单位','p[i-1] if i and (previous or move) else 0','p[i-1]*(previous+move) if i else 0'),('漏掉末城保护人口','value+(p[-1] if stay else 0)','value')],2400030)

def secondary_oracle(x):
    primary,secondary,limit=x;n=len(primary)
    @lru_cache(None)
    def visit(day,mask):
        if day==n:return 0
        best=visit(day+1,mask)
        for i,v in enumerate(secondary):
            if not mask>>i&1 and primary[day]+v<=limit:best=max(best,1+visit(day+1,mask|1<<i))
        return best
    return visit(0,0)
def secondary_random(r):
    n=r.randint(1,8);limit=r.randint(1,15);return [r.randint(1,limit) for _ in range(n)],[r.randint(1,20) for _ in range(n)],limit
add(268,'每天一个主任务后的最多次任务','n个主任务分别在n天完成，每天恰一个。每天总时间不得超过limit；当天还可安排至多一个次任务，n个次任务各至多用一次。求能完成的最大次任务数，允许有次任务不安排。','第一行n limit，第二行primary，第三行secondary。原文无数值界，本站1≤n≤200000，1≤limit≤10^9，1≤primary[i]≤limit，1≤secondary[i]≤10^9。','把每天剩余时间升序排序，次任务升序排序。依次用最小能容纳的剩余时间匹配最短未安排次任务。','若最小余量装不下最短任务，它无法装任何任务，跳过无损。若装得下，某个最优匹配可以让两者配对：若各自已与别者配对，交换后较大余量仍容纳较长任务；若只一方已配，也可直接替换。因此可固定这对并递归，得到最大匹配数。','时间O(n log n)，空间O(n)。',[([10,1],[1,10],11),([4,4],[2,3],5),([1,2,3],[3,2,1],4)],'答案依次2、0、3。第一例余量1和10应分别匹配1和10，不能把最大余量先浪费在最短任务。',secondary_random,[(([1]*200000,[10**9-1]*200000,10**9),200000),(([10**9]*200000,[1]*200000,10**9),0),(([1]*100000+[10**9]*100000,[1]*200000,10**9),100000)],lambda x:f'{len(x[0])} {x[2]}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',secondary_oracle,
'''def solve(d):
    n,limit=map(int,d[:2]);primary=list(map(int,d[2:2+n]));secondary=sorted(map(int,d[2+n:]));remain=sorted(limit-v for v in primary);j=0
    for capacity in remain:
        if j<n and secondary[j]<=capacity:j+=1
    return str(j)
''',[('错误最大余量先匹配最短任务','sorted(limit-v for v in primary)','sorted((limit-v for v in primary),reverse=True)'),('错误禁止恰好填满','secondary[j]<=capacity','secondary[j]<capacity')],4400050)

def similarity_oracle(x):
    a,b=x;total=sum(a);best=0
    def enumerate_arrays(prefix,left):
        nonlocal best
        if len(prefix)==len(a)-1:
            best=max(best,sum(v==w for v,w in zip(prefix+[left],b)));return
        for v in range(left+1):enumerate_arrays(prefix+[v],left-v)
    enumerate_arrays([],total);return best
add(269,'可转移非负库存后的最多对应相等位置','两个等长数组inv1与inv2。可任意次选择不同i、j，且只有inv1[j]>0时才可从j减1并给i加1。操作后库存允许为0，不能为负；inv2不变。相似度为对应下标数值相同的个数，求最大相似度。','第一行n，第二行inv1，第三行inv2。1≤n≤100000，初始两数组每个值1..10000。','总库存S不变。若等于目标总和则全匹配；否则按目标值从小到大，用S预算匹配尽可能多位置，但最多n−1个。用值域10000的计数桶实现。','任意与原库存同和的非负数组都可由盈余位置向亏缺位置转移得到，每次供给位置都保持合法正余额。匹配一组目标需要至少其值之和的库存，因此选最小值达到最多个数。若总量不等，不能全部匹配，留至少一个位置吸收余量；若它也相等，则匹配数本可增加或全部总量相等，与前提矛盾。故预算上界可达。','时间O(n+10000)，空间O(10000)不含读取。',[([1,1,1],[4,4,4]),([1,4],[2,3]),([10,1,1],[1,1,1])],'答案依次0、2、2。不能从库存0继续扣减，所以第一例预算不足以匹配任何一个4；第三例总量多出的9必须放在至少一个未匹配位置。',lambda r:([r.randint(1,4) for _ in range(n)],[r.randint(1,7) for _ in range(n)]) if (n:=r.randint(1,5)) else None,[(([10000]*100000,[10000]*100000),100000),(([1]*100000,[10000]*100000),10),(([10000]*100000,[1]*100000),99999)],two,similarity_oracle,
'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));budget=sum(a)
    if budget==sum(b):return str(n)
    counts=[0]*10001
    for v in b:counts[v]+=1
    answer=0
    for value in range(1,10001):
        taken=min(counts[value],budget//value,n-1-answer);answer+=taken;budget-=value*taken
    return str(answer)
''',[('错误允许负库存而恒答n减一','counts=[0]*10001','return str(n-1)\n    counts=[0]*10001'),('错误允许预算过剩时全部位置匹配','n-1-answer','n-answer')],1200030)

def multiplication_oracle(a):
    best=None;answer=None
    for p in permutations(range(len(a))):
        value=sum((i+1)*a[j] for i,j in enumerate(p))
        if best is None or value>best or value==best and p<answer:best=value;answer=p
    return seq(i+1 for i in answer)
add(271,'位置加权总和最大时的最小字典序下标排列','返回一个由原下标1..n组成的排列p，最大化Σ(i×data[p[i]])，其中i从1到n。若多种排列得到相同最大总和，返回字典序最小下标排列。返回的是原下标序列，不是总和或每个原元素的新位置。','第一行n，第二行data。原文无数值界，本站1≤n≤200000，−10^9≤data[i]≤10^9。','把原下标按(data[i],i)升序排序并输出一基下标。','若较大值放在较小位置、较小值放在较大位置，交换使总和增加位置差乘值差，故最大和必须值非降。不同值的相对组顺序因此唯一；同值交换不改变收益，按原下标递增排列每组即得到最小字典序。','时间O(n log n)，空间O(n)。',[[3,6,1,4,2],[2,1,2,1],[-1,-2,-3]],'答案依次3 5 1 4 2、2 4 1 3、3 2 1。相同值按原下标较小者先出现。',lambda r:[r.randint(-4,5) for _ in range(r.randint(1,7))],[([10**9]*200000,seq(range(1,200001))),(list(range(200000,0,-1)),seq(range(200000,0,-1))),([-10**9]*200000,seq(range(1,200001)))],arr,multiplication_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));order=sorted(range(len(a)),key=lambda i:(a[i],i));return ' '.join(str(i+1) for i in order)
''',[('相同值按下标倒序','(a[i],i)','(a[i],-i)'),('误按值降序排列','(a[i],i)','(-a[i],i)')],2400030,output='输出n个一基原下标，按最优排列顺序以空格分隔。',outputLimit=4096)

def capacity_oracle(a):
    @lru_cache(None)
    def visit(mask):
        ids=[i for i in range(len(a)) if mask>>i&1]
        if len(ids)<2:return 0
        i=ids[0];best=visit(mask^(1<<i))
        for j in ids[1:]:best=max(best,min(a[i],a[j])+visit(mask^(1<<i)^(1<<j)))
        return best
    return visit((1<<len(a))-1)
add(274,'主备服务器一一配对的最大主容量','从n台服务器中选偶数台，一半为主、一半为备，每台仅用一次，每个主都对应一个容量不小于它的备。贡献为所有主容量之和，求最大值。允许不用全部服务器。','第一行n，第二行memory。2≤n≤200000，1≤memory[i]≤10^9。原约束把变量误写size，其原旁注明确指memory，本站统一命名。','容量降序排序，相邻两个一组，较小的作主；取第2、4、…项求和，奇数剩最小项不用。','按主容量降序，第j个主及其之前各主都需要一个不小于它的不同备，所以第j个主不超过整体降序第2j项。把最大的偶数台相邻配对恰好同时达到所有这些上界。容量为正，配满⌊n/2⌋组不劣，因此该构造最优。','时间O(n log n)，空间O(n)，答案最多10^14需64位。',[[1,2,1,2],[1,2,1],[2,4,3,1,2]],'答案依次3、1、5。第三例将4配3、2配2，主容量3+2=5，剩1不用。',lambda r:[r.randint(1,15) for _ in range(r.randint(2,10))],[([10**9]*200000,100000000000000),([1]*199999+[10**9],100000),([10**9]*199999,99999000000000)],arr,capacity_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]),reverse=True);return str(sum(a[1::2]))
''',[('错误取每对较大值作主','a[1::2]','a[::2]'),('奇数时错误丢弃最大值','sum(a[1::2])','sum(a[2::2]) if len(a)%2 else sum(a[1::2])')],2200030)

def domino_encode(x):return f'{len(x[0])} {x[2]}\n'+seq(x[0])+'\n'+seq(x[1])+'\n'
def domino_oracle(x):
    tiles,order,k=x;best=-1
    for t in range(len(tiles)+1):
        removed=set(order[:t]);a=[v for i,v in enumerate(tiles) if i not in removed];length=0
        for mask in range(1<<len(a)):
            b=[v for i,v in enumerate(a) if mask>>i&1]
            if all(x<y for x,y in zip(b,b[1:])):length=max(length,len(b))
        if length>=k:best=t
    return best
def domino_random(r):
    n=r.randint(1,10);return r.sample(range(1,30),n),r.sample(range(n),n),r.randint(0,n)
add(275,'按指定顺序删除仍保持递增子序列的最多次数','tile大小互异，removalOrder给出删除的原零基下标顺序。只能删除顺序的一个前缀，剩余相对顺序不变。求使剩余严格最长递增子序列长度至少minOrder的最大删除次数。原文未规定初始无解的输出，本站明确此时返回−1，并保留这种输入；minOrder=0时可全删。','第一行n minOrder，第二行tile，第三行removalOrder。原文无数值界，本站1≤n≤200000，1≤tile[i]≤10^9且互异，0≤minOrder≤n；本站明确删除顺序为0..n−1的排列。初始LIS不足minOrder的输入合法，答案−1。','记录每个原下标的删除时刻。给定删除数t，过滤已删除位置，用耐心排序算LIS长度；可行性随t单调不增，先检查t=0，再二分最大可行t。','删除只会减少子序列集合，因此若某t不可行，之后全部不可行。耐心排序的tails[l]为已扫描前缀长度l+1递增子序列的最小末值，二分替换保持此不变式，tails长度恰为LIS。由准确判定和单调边界二分得到最大删除数；起始不可行单独返回本站协议−1。','时间O(n log²n)，空间O(n)。',[([1,3,2,4],[1,2,0,3],2),([3,2,1],[0,1,2],2),([9],[0],0)],'答案依次2、−1、1。第一例删原下标1、2后剩1,4仍长2，再删0只剩一项；第二例初始就不足，不把0次删除当成可行。',domino_random,[((list(range(1,200001)),list(range(200000)),100000),100000),((list(range(200000,0,-1)),list(range(199999,-1,-1)),2),-1),((list(range(1,200001)),list(range(199999,-1,-1)),0),200000)],domino_encode,domino_oracle,
'''def solve(d):
    from bisect import bisect_left
    n,k=map(int,d[:2]);a=list(map(int,d[2:2+n]));order=list(map(int,d[2+n:]));removed_at=[0]*n
    for time,index in enumerate(order,1):removed_at[index]=time
    def feasible(t):
        tails=[]
        for i,v in enumerate(a):
            if removed_at[i]<=t:continue
            pos=bisect_left(tails,v)
            if pos==len(tails):tails.append(v)
            else:tails[pos]=v
        return len(tails)>=k
    if not feasible(0):return '-1'
    low=0;high=n+1
    while low+1<high:
        middle=(low+high)//2
        if feasible(middle):low=middle
        else:high=middle
    return str(low)
''',[('把初始无解误报0',"if not feasible(0):return '-1'","if not feasible(0):return '0'"),('错把严格超过门槛才算可行','len(tails)>=k','len(tails)>k')],3600050,time=8)

def main():
    base.main()
    path=base.OUT/'reviews'/f'{base.BATCH}.json';data=json.loads(path.read_text())
    data['items'].extend([dict(id='oa-amazon-270',status='blocked',reason='正文one or more edges要求至少一刀，而n=2单边原例输出2只可由零刀得到；必切答案1。核心规则冲突，不能用266覆盖本页。'),dict(id='oa-amazon-272',status='blocked',reason='原始正文真的在Your task is to maximi截断，样例只描述选值和删除另两项，未给普遍删除规则；来源臆造k次取反不能补证。'),dict(id='oa-amazon-273',status='blocked',reason='raw正文仅<p><p clas；标题K次取反最大和，函数却无K且样例讲所有前缀正的最大翻转数。主干与输入域未恢复，不臆造。')])
    slugs=['make-value-groups-contiguous','match-strings','max-batches','max-sum-of-non-overlapping-intervals','max-transfer-rate','maximize-cluster-power','maximize-final-element','maximize-pages-before-suspension','maximize-parentheses-efficiency-score','maximize-partitions','maximize-product-of-sizes-of-subtrees','maximize-protected-city-population','maximize-secondary-tasks-scheduled','maximize-similarity','maximize-subtree-product','maximize-sum-of-array-multiplication','maximize-sum-of-array','maximize-the-array-sum-after-negating-at-most-k-elements','maximum-capacity','maximum-domino-removals']
    catalog={v['id']:v for v in json.loads((base.ROOT/'content/oa-master/catalog.json').read_text())['items']}
    for item in data['items']:
        n=int(item['id'].split('-')[-1]);relative='fastprep/Amazon/amazon-'+slugs[n-256]+'.md';raw=(Path('/tmp/cswork-oa-source-20260919')/relative).read_bytes()
        item['sourceEvidence']=[dict(commit='e66f809f4c953bce129f68491726176615db6afc',path=relative,gitBlobSha1=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=catalog[item['id']]['contentHash'])]
    data['items'].sort(key=lambda v:int(v['id'].split('-')[-1]));path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
