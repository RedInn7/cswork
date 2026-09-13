"""Amazon101–115 plus capacity recoveries. Execute only independently authored code."""
from collections import Counter, deque
from functools import lru_cache
from itertools import combinations, permutations, product
from pathlib import Path
import hashlib, heapq, json, random, subprocess, sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='amazon-remaining-e';SEED=20261101;SPECS=[]
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,random=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def passes_oracle(a):
    count=steps=0
    while count<len(a):
        steps+=1
        for v in a:
            if v==count+1:count+=1
    return steps
add(61,'顺序扫描包裹完成排序的轮数','给出1..n排列。每轮从左到右扫描，遇到下一个尚未排好编号就立即处理；一轮中可连续处理多个编号。求处理完全部编号需要几轮。','第一行n（1..1000000），第二行1..n排列。','记录每个编号的位置。开始需要一轮；每次pos[v+1]<pos[v]必须重新扫描，增加一轮。','在同一轮中只能访问位置递增的编号。相邻编号位置下降时无法继续本轮，必须且只须开启下一轮，因此答案为位置下降次数加1。','时间O(n)，辅助空间O(n)，位置用紧凑整数数组。',[[5,3,4,1,2],[1],[3,2,1]],'样例1：第一轮处理1、2；第二轮3、4；第三轮5，答案3。样例2：一次扫描即完成。样例3：每轮只能处理一个编号，答案3。',lambda r:r.sample(range(1,(n:=r.randint(1,9))+1),n),[(list(range(1,1000001)),1),(list(range(1000000,0,-1)),1000000)],arr,passes_oracle,
'''def solve(d):
    from array import array
    n=int(d[0]);position=array('i',[0])*(n+1)
    for i in range(1,n+1):position[int(d[i])]=i
    return str(1+sum(position[v+1]<position[v] for v in range(1,n)))
''',[('误数原排列下降','position[v+1]<position[v]','int(d[v+1])<int(d[v])'),('遗漏第一轮','return str(1+sum','return str(0+sum')],8000100,time=6)
def plan_oracle(x):
    a,b,bad=x;bad=set(bad)
    return max(v+w for i,v in enumerate(a) for j,w in enumerate(b) if (i,j) not in bad)
def plan_random(r):
    n=r.randint(2,5);m=r.randint(2,5);return [r.randint(1,20) for _ in range(n)],[r.randint(1,20) for _ in range(m)],r.sample(list(product(range(n),range(m))),r.randint(1,n*m-1))
add(72,'不兼容约束下套餐与功能最大价格','选择一个套餐和一个功能，不可选择给出的不兼容下标对。至少有一个兼容组合，求最大总价。','第一行n m X；2≤n,m≤100000，1≤X≤min(200000,nm−1)；两行价格数组（1..10⁹）；随后X行不兼容对，编号从1开始。','功能按价格降序，每个套餐扫描到第一个兼容功能。所有失败检查总数≤X，取各套餐最优总价的最大值。','固定套餐时第一个合法功能最贵；每次跳过都对应一条不同的不兼容边，全部套餐扫描中最多X次失败和n次成功，所以既完整枚举最优值又不退化为nm枚举。','时间O(m log m+n+X)，空间O(n+m+X)。',[([5,8],[4,7],[(1,1)]),([1,2],[3,4],[(0,0),(0,1),(1,0)]),([9,1],[8,1],[(1,1)])],'样例1：8+4与5+7均为12；8+7被禁止。样例2：只有编号2套餐和2功能可配，总价6。样例3：最高9+8可配，总价17。',plan_random,[(([10**9]*100000,[10**9]*100000,[(i,j) for i in range(50000,100000) for j in range(99996,100000)]),2000000000),((list(range(1,100001)),list(range(1,100001)),[(i,j) for i in range(2) for j in range(100000)]),200000)],lambda x:f'{len(x[0])} {len(x[1])} {len(x[2])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n'+''.join(f'{i+1} {j+1}\n' for i,j in x[2]),plan_oracle,
'''def solve(d):
    n,m,x=map(int,d[:3]);a=list(map(int,d[3:3+n]));b=list(map(int,d[3+n:3+n+m]));bad=set();pos=3+n+m
    for i in range(pos,len(d),2):bad.add((int(d[i])-1,int(d[i+1])-1))
    order=sorted(range(m),key=lambda j:b[j],reverse=True);answer=0
    for i,v in enumerate(a):
        for j in order:
            if (i,j) not in bad:answer=max(answer,v+b[j]);break
    return str(answer)
''',[('忽略不兼容','if (i,j) not in bad:','if True:'),('优先最便宜功能','reverse=True','reverse=False')],5000100,time=6)
def stocks_oracle(x):
    a,t=x;return len({tuple(sorted((a[i],a[j]))) for i in range(len(a)) for j in range(i+1,len(a)) if a[i]+a[j]==t})
add(94,'按数值去重的股票收益配对','统计能由两个不同下标组成、和为target的无序数值对。同一数值对只算一次；(a,a)需要至少两个a。','第一行n target（1≤n≤500000，0≤target≤5×10⁹）；第二行n个收益（0..10⁹）。','统计频次，枚举每个不同a，只在a≤target−a且补数存在时计数；相等时检查频次至少2。','每个合法无序数值对有唯一较小端a，因此不重不漏；频次约束恰好保证能选两个不同下标。','时间O(n)，空间O(n)。',[([6,6,3,9,3,5,1],12),([6],12),([0,0,0],0)],'样例1：只有(3,9)、(6,6)，答案2。样例2：仅一个6不能与自己配对，答案0。样例3：三个0虽然有三对下标，但数值对只有(0,0)，答案1。',lambda r:([r.randint(0,12) for _ in range(r.randint(1,10))],r.randint(0,24)),[(([10**9]*500000,2000000000),1),((list(range(500000)),499999),250000)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',stocks_oracle,
'''def solve(d):
    from collections import Counter
    n,t=map(int,d[:2]);counts=Counter(map(int,d[2:]));answer=0
    for a,c in counts.items():
        b=t-a
        if a<=b and b in counts and (a!=b or c>=2):answer+=1
    return str(answer)
''',[('允许同下标自配',' and (a!=b or c>=2)',''),('按有序数值对计数','a<=b and b in counts','b in counts')],5500100,time=6)

def beauty_oracle(x):
    a,pairs=x;used=set();built=[]
    for l,r in pairs:built+=a[l:r+1];used.update(range(l,r+1))
    return sum(v<a[i] for i in range(len(a)) if i not in used for v in built)
def beauty_random(r):
    a=[r.randint(-4,7) for _ in range(r.randint(1,8))];pairs=[]
    for _ in range(r.randint(1,7)):
        l=r.randrange(len(a));pairs.append((l,r.randrange(l,len(a))))
    return a,pairs
add(101,'拼接子数组中比未使用值小的元素总数','依次把各闭区间子数组拼到beautiful数组，重叠区间产生的重复元素保留。原数组从未被任何区间选到的位置称未使用位置；对每个未使用值，计算beautiful中严格小于它的元素数，最后求和。','第一行n m；第二行n个arr；随后m行0-based闭区间l r。原文无数值范围，本站1≤n,m≤100000，−10⁹≤arr[i]≤10⁹，0≤l≤r<n。','差分求每个原下标在拼接数组中的出现次数。按数值排序并合并同值组，累计更小值的带权出现次数，每个未用位置贡献该前缀权重。','拼接中每个下标的重数等于覆盖它的区间数。按相同值整组先查询后加入，只统计严格更小值；覆盖次数为0恰好就是未使用位置，因此带权前缀求和与显式拼接完全相同。','时间O(n log n+m)，空间O(n)，无需生成长度可能nm的拼接数组。',[([3,1,4],[(1,1)]),([2,5,1],[(0,0),(0,0)]),([1,2],[(0,1)])],'样例1：拼接为[1]，未用3和4各贡献1，总2。样例2：拼接[2,2]，未用5贡献2、1贡献0，总2。样例3：全部位置用过，没有贡献，答案0。',beauty_random,[(([1]*50000+[2]*50000,[(0,49999)]*100000),250000000000000),((list(range(100000)),[(0,99999)]*100000),0)],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+''.join(f'{l} {r}\n' for l,r in x[1]),beauty_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));diff=[0]*(n+1)
    for i in range(2+n,len(d),2):l,r=int(d[i]),int(d[i+1]);diff[l]+=1;diff[r+1]-=1
    active=0;items=[]
    for i,v in enumerate(a):active+=diff[i];items.append((v,active))
    items.sort();prefix=answer=0;i=0
    while i<n:
        j=i;weight=unused=0
        while j<n and items[j][0]==items[i][0]:weight+=items[j][1];unused+=items[j][1]==0;j+=1
        answer+=unused*prefix;prefix+=weight;i=j
    return str(answer)
''',[('重叠区间只计一次','weight+=items[j][1]','weight+=int(items[j][1]>0)'),('错误把相等值也计入','answer+=unused*prefix;prefix+=weight','prefix+=weight;answer+=unused*prefix')],2400100,time=6)

def profit_oracle(x):
    a,b,budget=x;return max([0]+[sum(b[i]-a[i] for i in range(len(a)) if mask>>i&1) for mask in range(1<<len(a)) if sum(a[i] for i in range(len(a)) if mask>>i&1)<=budget])
add(102,'本金预算内的最大股票利润','每个数组条目表示一份股票，每份最多买一次。总买入价不超过principle，最大化futurePrice−price总和，也可以一份不买。原例排除了同一股票无限购买的解释。','第一行n principle；第二行price；第三行futurePrice。原文缺数字范围，本站1≤n≤1000，0≤principle≤10000，1≤price[i]≤10000，0≤futurePrice[i]≤10⁹。','0/1背包，dp[c]表示预算c的最大利润，每份股票按预算倒序更新；非正利润可不买。','每份股票可选或不选，倒序使当前股票不会重复使用；归纳后dp[c]覆盖全部总价≤c的股票子集，最大利润即dp[principle]。','时间O(n·principle)，空间O(principle)。',[([10,50,30,40,70],[100,40,50,30,90],100),([5],[9],4),([2,2],[1,5],4)],'样例1：买10元和30元两份，利润90+20=110；同一10元股票不能买十份。样例2：预算不足，利润0。样例3：只买第二份，利润3，不购买亏损股票。',lambda r:(lambda n:([r.randint(1,8) for _ in range(n)],[r.randint(0,15) for _ in range(n)],r.randint(0,20)))(r.randint(1,9)),[(([1]*1000,[10**9]*1000,10000),999999999000),(([10000]*1000,[10000]*1000,10000),0)],lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',profit_oracle,
'''def solve(d):
    n,budget=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));dp=[0]*(budget+1)
    for price,future in zip(a,b):
        gain=future-price
        for c in range(budget,price-1,-1):dp[c]=max(dp[c],dp[c-price]+gain)
    return str(dp[budget])
''',[('错误允许重复购买','range(budget,price-1,-1)','range(price,budget+1)'),('强制负利润也买','max(dp[c],dp[c-price]+gain)','dp[c-price]+gain')],17100,time=6)

def quality_oracle(x):
    a,k=x;best=-10**30
    for l in range(len(a)):
        for r in range(l+1,len(a)+1):
            for divide in (False,True):
                b=a[:]
                for i in range(l,r):b[i]=(abs(b[i])//k)*(1 if b[i]>=0 else -1) if divide else b[i]*k
                best=max(best,max(sum(b[i:j]) for i in range(len(b)) for j in range(i+1,len(b)+1)))
    return best
add(103,'恰改一个区间后的最大连续质量分','必须选择一个非空区间，或者全部乘impactFactor，或者全部除该因子并向0取整。操作完成后求非空连续子数组和最大可能值。','第一行n impactFactor（1≤n≤200000，1≤impactFactor≤10000）；第二行n个ratings（−100000..100000）。','分别处理乘法和除法，用三状态连续子数组DP表示尚未进入修改区间、正在修改、已经离开。取至少含一个修改位置的最大子数组和。','任何与修改区间相交的最终子数组按原值段、修改段、原值段划分，三状态枚举其全部形式。也总存在最优解让修改与目标子数组相交：若目标和非负，直接把目标区间乘因子不劣；若所有非空子数组和负，单独除最大元素不劣。因此不漏掉操作在目标外的更优解。','时间O(n)，空间O(n)保存数组，DP额外O(1)。',[([5,-3,-3,2,4],2),([-2,3,-3,-1],1),([-5,-3],2)],'样例1：将最后2、4乘2变4、8，最大和12。样例2：因子1无改变，选3得3。样例3：−3除2向0取整为−1，这是最大可得质量分。',lambda r:([r.randint(-6,6) for _ in range(r.randint(1,6))],r.randint(1,4)),[(([100000]*200000,10000),200000000000000),(([-100000]*200000,10000),-10)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',quality_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));answer=-10**30
    for divide in (False,True):
        before=inside=after=-10**30
        for v in a:
            changed=(abs(v)//k)*(1 if v>=0 else -1) if divide else v*k
            after=max(inside+v,after+v);inside=max(changed,before+changed,inside+changed);before=max(v,before+v)
            answer=max(answer,inside,after)
    return str(answer)
''',[('负数除法错误向下取整','(abs(v)//k)*(1 if v>=0 else -1)','v//k'),('允许空子数组','answer=-10**30','answer=0')],1600100,time=6)

def salary_value(s):
    value=[1,10,100,1000,10000];return sum((-1 if any(c>x for c in s[i+1:]) else 1)*value[ord(x)-65] for i,x in enumerate(s))
def salary_oracle(s):return max(salary_value(s[:i]+c+s[i+1:]) for i in range(len(s)) for c in 'ABCDE')
add(104,'最多改一天办公地点的最大工资','A到E工资分别1、10、100、1000、10000。某天后方存在更高等级则减去当天工资，否则加上。最多改一个字符，求最大工资。','一行仅含ABCDE的字符串。原文无数值范围，本站长度1..100000。','从右往左DP，状态为右边最高等级及是否已修改。当前位置枚举保留或修改成五种等级，按与右侧最高等级比较决定正负贡献。','已处理后缀对当前工资仅通过最高等级影响，修改额度只需一个布尔位。逐位置枚举全部合法字符选择并累加正负贡献，覆盖所有最多一次修改的方案。','时间O(25n)，空间O(1)。',['ABCDEEDCBA','A','EE'],'样例1：改第四天D为E，前段负值变少并新增10000，最优31000。样例2：A直接改E，工资10000。样例3：已经都是E，总工资20000。',lambda r:''.join(r.choice('ABCDE') for _ in range(r.randint(1,8))),[('E'*100000,1000000000),('A'*100000,109999)],lambda s:s+'\n',salary_oracle,
'''def solve(d):
    s=d[0];values=[1,10,100,1000,10000];dp={(-1,0):0}
    for old in reversed(s):
        original=ord(old)-65;new={}
        for (highest,used),score in dp.items():
            for c in range(5):
                changed=used+(c!=original)
                if changed>1:continue
                key=(max(highest,c),changed);candidate=score+(values[c] if c>=highest else -values[c]);new[key]=max(new.get(key,-10**30),candidate)
        dp=new
    return str(max(dp.values()))
''',[('相同等级也视为更高','c>=highest','c>highest'),('允许修改多天','if changed>1:continue','if changed>2:continue')],100100,time=6)

def median_oracle(x):
    a,k=x;best=0;groups=[]
    def visit(i):
        nonlocal best
        if i==len(a):
            if len(groups)!=k:return
            total=0
            for group in groups:
                b=sorted(group);j=len(b)//2;total+=2*b[j] if len(b)%2 else b[j-1]+b[j]
            best=max(best,total);return
        for g in groups:g.append(a[i]);visit(i+1);g.pop()
        if len(groups)<k:groups.append([a[i]]);visit(i+1);groups.pop()
    visit(0);return (best+1)//2
add(105,'各通道非空时最大的中位数总和','把所有包分入恰好k个非空通道，各包只能用一次。通道质量为中位数，偶数项取中间两数平均；最大化质量总和并四舍五入到整数（0.5向上）。','第一行n k（1≤k≤n≤100000）；第二行n个packet（1..10⁹）。','将最大的k−1项各自独占通道，剩余较小项组成最后一个通道。累加独占值与最后组中位数，使用两倍整数避免浮点。','若有两个多项组，可以将其中较高中位数对应的较大元素提为独占组，并把其余元素合入另一组，经过按序配对的中位数比较，总和不下降。重复使至多一组多项；独占元素取最大k−1项最优，余组取其中位数。','时间O(n log n)，空间O(n)。',[([1,2,3,4,5],2),([5,2,2,1,5,3],2),([1,2],2)],'样例1：5单独一组，1、2、3、4中位数2.5，总7.5取8。样例2：一个5独占，其余1、2、2、3、5中位数2，总7。样例3：两包各一组，总质量3。',lambda r:(lambda n:([r.randint(1,10) for _ in range(n)],r.randint(1,n)))(r.randint(1,7)),[(([10**9]*100000,100000),10**14),((list(range(1,100001)),1),50001)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',median_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));remaining=n-k+1;j=remaining//2
    middle=2*a[j] if remaining%2 else a[j-1]+a[j]
    return str(sum(a[remaining:])+(middle+1)//2)
''',[('错误向下取整','(middle+1)//2','middle//2'),('给最小项独占通道','sum(a[remaining:])','sum(a[:k-1])')],1100100)

def refuel_oracle(x):
    positions,queries=x
    return ' '.join(str(sum(min(station-v for station in (positions[a-1],positions[b-1],positions[-1]) if station>=v) for v in positions)) for a,b in queries)
def refuel_random(r):
    n=r.randint(2,9);return sorted(r.randint(-10,15) for _ in range(n)),[tuple(sorted(r.sample(range(1,n+1),2))) for _ in range(r.randint(1,8))]
add(107,'每次增加两座加油站后的总前进距离','车辆位置非递减，只能向右走。每次独立查询在第a、b辆车的位置增设加油站，末车位置始终有站；每辆车到不在自己左边的最近站停下。','第一行n q；第二行n个非递减position；随后q行a b（1-based，a<b）。原文没有数值范围，本站2≤n≤100000，1≤q≤100000，−10⁹≤position≤10⁹。','预处理每个位置相同坐标的最右端A、B，前缀和将车辆分为[0,A)、[A,B)、[B,n)，分别到两座附加站与末站；每段距离为数量×站位置−区间位置和。','先扩展到相同坐标的最右端，保证同坐标车辆全部原地加油，不会被错误送到下一站。排序保证扩展后每段的指定站就是最近的前方站。三段覆盖全部车辆且不重复，前缀和准确求和。','预处理O(n)，每查询O(1)，空间O(n+q)。',[([3,6,10,15,20],[(2,4)]),([0,0,5],[(1,2)]),([1,2,3],[(1,3),(2,3)])],'样例1：五车距离3、0、5、0、0，总8。样例2：前两车已有站，末车也已有站，总0。样例3：两次查询都只有一辆车前进1，总距离分别1、1。',refuel_random,[((list(range(100000)),[(1,99999)]*100000),' '.join([str(99997*99998//2)]*100000)),(([-10**9]*50000+[10**9]*50000,[(1,100000)]*100000),' '.join(['0']*100000))],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+''.join(f'{a} {b}\n' for a,b in x[1]),refuel_oracle,
'''def solve(d):
    n,q=map(int,d[:2]);p=list(map(int,d[2:2+n]));prefix=[0]
    for v in p:prefix.append(prefix[-1]+v)
    end=list(range(1,n+1))
    for j in range(n-2,-1,-1):
        if p[j]==p[j+1]:end[j]=end[j+1]
    answer=[]
    for i in range(2+n,len(d),2):
        a,b=end[int(d[i])-1],end[int(d[i+1])-1];answer.append(a*p[a-1]+(b-a)*p[b-1]+(n-b)*p[-1]-prefix[n])
    return ' '.join(map(str,answer))
''',[('所有车辆只去末站','a*p[a-1]+(b-a)*p[b-1]+(n-b)*p[-1]-prefix[n]','n*p[-1]-prefix[n]'),('总距离取绝对值坐标和','-prefix[n]','-abs(prefix[n])')],2600100,time=6,output='按查询顺序输出q个总距离。')

def efficiency_oracle(a):
    days=(len(a)+1)//2
    @lru_cache(None)
    def visit(day,mask):
        if day==days:return 0
        return max((a[i]+visit(day+1,mask|1<<i) for i in range(day,len(a)-day) if not mask>>i&1),default=-10**30)
    return visit(0,0)
add(108,'每天出货前选一个包裹的最大效率','每天先从仍在仓库且未被选过的包裹中选一个，将重量计入效率；随后运走当前最左和最右包裹（只剩一个时只运一次），直到运空。最大化效率总和。','第一行n（1..200000），第二行n个重量（0..10⁹）。','第i个包裹最迟可在min(i+1,n−i)天被选，是单位耗时且有截止日的带权选择。按截止日递增加入小根堆，超过当前天数就去掉最小权重。','截止日≤d的已选包裹最多d个，且该条件充分保证按截止日调度。扫描同截止日任务时若超过容量，移除最小权重是交换后不劣的选择；所有截止日前缀可行，堆的总和最大。非负权重使最终可选满全部天数。','时间O(n log n)，空间O(n)。',[[4,4,8,5,3,2],[2,1,8,5,6,2,4],[9]],'样例1：三天依次选4、5、8，总17。样例2：四天可选4、6、8、5，总23。样例3：唯一一天选择9，总9。',lambda r:[r.randint(0,12) for _ in range(r.randint(1,8))],[([10**9]*200000,10**14),(list(range(200000)),14999950000)],arr,efficiency_oracle,
'''def solve(d):
    import heapq
    a=list(map(int,d[1:]));n=len(a);heap=[]
    for day in range(1,(n+1)//2+1):
        heapq.heappush(heap,a[day-1])
        if day-1!=n-day:heapq.heappush(heap,a[n-day])
        while len(heap)>day:heapq.heappop(heap)
    return str(sum(heap))
''',[('重复使用两端较大包裹','heapq.heappush(heap,a[day-1])','heapq.heappush(heap,max(a[day-1],a[n-day]))'),('忽略截止日直接选最大一半','return str(sum(heap))','return str(sum(sorted(a,reverse=True)[:(n+1)//2]))')],2200100,time=6)

def moves_oracle(x):
    a,queries=x;states={tuple(a)};wanted=tuple(range(1,len(a)+1));answers={0:wanted in states}
    for k in range(1,max(queries)+1):
        new=set()
        for state in states:
            for i,j in combinations(range(len(a)),2):
                p=list(state);p[i],p[j]=p[j],p[i];new.add(tuple(p))
        states=new;answers[k]=wanted in states
    return ''.join('1' if answers[k] else '0' for k in queries)
def moves_random(r):
    n=r.randint(1,5);return r.sample(range(1,n+1),n),[r.randint(1,7) for _ in range(r.randint(1,6))]
add(109,'能否用恰好给定交换次数排好排列','每步交换两个不同下标。对每个moves，判断是否能恰好这么多步变成升序，输出01串。','第一行n q（1..100000）；第二行1..n排列；第三行q个moves（1..10⁹）。','最少交换数为n减置换环数；n≥2时，次数至少最小值且奇偶相同就可行，因为额外两步可交换同一对再换回。n=1没有任何合法交换。','一次交换使环数增减1，因此最少n−cycles步且交换次数奇偶固定。每个环可用长度−1步排好，额外偶数步用抵消交换补齐，充分性成立；单元素情况须单独处理。','时间O(n+q)，空间O(n+q)。',[([2,3,1,4],[2,3]),([4,5,1,3,2],[1,2,3]),([1],[1,2])],'样例1：最少2步，2可行而3奇偶不符，输出10。样例2：一个三环和一个二环，最少3步，输出001；来源011把两步错误算可行。样例3：只有一个下标，无法执行任何一步，输出00。',moves_random,[((list(range(2,100001))+[1],[99999]*100000),'1'*100000),(([1],[10**9]*100000),'0'*100000)],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',moves_oracle,
'''def solve(d):
    n,q=map(int,d[:2]);p=list(map(int,d[2:2+n]));seen=bytearray(n);cycles=0
    for i in range(n):
        if seen[i]:continue
        cycles+=1;j=i
        while not seen[j]:seen[j]=1;j=p[j]-1
    minimum=n-cycles
    return ''.join('1' if n>1 and int(v)>=minimum and (int(v)-minimum)%2==0 else '0' for v in d[2+n:])
''',[('忽略交换奇偶',' and (int(v)-minimum)%2==0',''),('单元素也允许空转','n>1 and ','')],1800100,output='输出长度q的01字符串。')

def warehouses_oracle(a):return min(sum(min(abs(v-x),abs(v-y)) for v in a) for x in a for y in a)
add(110,'两座仓库的最小总距离','在数轴任选两个仓库位置，每个中心到较近仓库，最小化所有中心距离之和。仓库允许重合，不要求每座都服务中心。','第一行n，第二行n个dist_centers。原文无数值范围，本站1≤n≤200000，−10⁹≤位置≤10⁹。','排序后两仓服务区域由一个切口分成连续两段。单段最优在中位数，使用前缀和O(1)计算段距离，枚举全部切口。','对固定两仓，最近仓归属沿数轴至多切换一次；单仓绝对距离和在中位数最小。所以某最优方案对应一个连续切口和两边中位数，枚举包含它。也枚举空段，兼容只有一个中心。','时间O(n log n)，空间O(n)。',[[1,2,10,11],[7],[0,5,10]],'样例1：仓库放1和10，总距离0+1+0+1=2。样例2：仓库放7，总距离0。样例3：任意两端或一个端点与5，总最小距离5。',lambda r:[r.randint(-8,10) for _ in range(r.randint(1,8))],[([-10**9]*100000+[10**9]*100000,0),(list(range(200000)),5000000000)],arr,warehouses_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]));n=len(a);prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    def cost(l,r):
        if l==r:return 0
        m=(l+r)//2
        return a[m]*(m-l)-(prefix[m]-prefix[l])+(prefix[r]-prefix[m+1])-a[m]*(r-m-1)
    return str(min(cost(0,i)+cost(i,n) for i in range(n+1)))
''',[('只建一座仓库','min(cost(0,i)+cost(i,n) for i in range(n+1))','cost(0,n)'),('只试正中间切口','range(n+1)','[n//2]')],2400100,time=6)

def cinema_oracle(x):
    start,duration,volume=x;n=len(start);best=0
    for mask in range(1<<n):
        chosen=[i for i in range(n) if mask>>i&1]
        if all(start[i]+duration[i]<start[j] or start[j]+duration[j]<start[i] for i,j in combinations(chosen,2)):best=max(best,sum(volume[i] for i in chosen))
    return best
add(111,'放映结束严格早于下一场的最大观众量','选若干场放映，场次结束时间为start+duration。两场不冲突必须一场结束严格早于另一场开始，端点相等不允许。求观众量总和最大。来源第二例佐证严格不等号。','第一行n（1..100000），接着三行start、duration、volume；前两者1..10⁹，volume为1..1000。','按结束时间排序，dp记录前若干场最优值；每场二分找到结束严格小于本场开始的场数，比较选它或跳过。','任何最优方案要么不含当前最后结束场，要么其之前所有场都结束严格早于当前开始。两种情况分别由dp前项和兼容前缀加当前收益表示，归纳得到全局最优。','时间O(n log n)，空间O(n)。',[([10,5,15,18,30],[20,12,20,35,35],[50,51,20,25,10]),([1,2,4],[2,2,1],[1,2,3]),([1,3],[2,1],[5,7])],'样例1：选开始5、18两场，51+25=76。样例2：开始2的场结束于4，不能接开始4的场；选开始1与4，总4。样例3：第一场结束恰为第二场开始，只能选观众7的场。',lambda r:(lambda n:([r.randint(1,12) for _ in range(n)],[r.randint(1,6) for _ in range(n)],[r.randint(1,15) for _ in range(n)]))(r.randint(1,9)),[((list(range(1,200001,2)),[1]*100000,[1000]*100000),100000000),(([10**9]*100000,[10**9]*100000,[1000]*100000),1000)],lambda x:str(len(x[0]))+'\n'+'\n'.join(' '.join(map(str,a)) for a in x)+'\n',cinema_oracle,
'''def solve(d):
    from bisect import bisect_left
    n=int(d[0]);s=list(map(int,d[1:1+n]));duration=list(map(int,d[1+n:1+2*n]));v=list(map(int,d[1+2*n:]));jobs=sorted((a+b,a,c) for a,b,c in zip(s,duration,v));ends=[j[0] for j in jobs];dp=[0]
    for end,start,value in jobs:
        compatible=bisect_left(ends,start);dp.append(max(dp[-1],dp[compatible]+value))
    return str(dp[-1])
''',[('允许端点相等','bisect_left','bisect_right'),('按单场最大观众选择','return str(dp[-1])','return str(max(v))')],2700100,time=6)

def ring_oracle(x):
    edges,queries=x;n=len(edges);total=0
    for a,b in queries:
        distance=[10**30]*n;distance[a]=0;heap=[(0,a)]
        while heap:
            cost,u=heapq.heappop(heap)
            if cost!=distance[u]:continue
            for v,w in (((u+1)%n,edges[u]),((u-1)%n,edges[(u-1)%n])):
                if cost+w<distance[v]:distance[v]=cost+w;heapq.heappush(heap,(cost+w,v))
        total+=distance[b]
    return total
add(112,'多次环线最短距离之和','distances[i]连接站i与(i+1)模n。每个查询是独立起终点，取顺逆两个方向较短距离，再对全部查询求和。','第一行n q，第二行n个边长，随后q行0-based起终点。原文无数值范围，本站1≤n,q≤100000，1≤边长≤10⁹。','前缀和给出线性展开中的距离d，环上最短为min(d,周长−d)，逐查询相加。','正边权环的最短路径一定是不绕圈的两条简单弧之一，前缀差和周长补数恰好是两弧长度。查询互相独立，因此分别最小化后求和。','时间O(n+q)，空间O(n)。',[([1,2,3,4],[(0,1),(1,3),(3,0)]),([7,10,1,12],[(0,2),(2,1)]),([9],[(0,0)])],'样例1：最短分别1、5、4，总10。样例2：0到2逆向13，2到1为10，总23。样例3：相同站无需移动，总0。',lambda r:(lambda n:([r.randint(1,10) for _ in range(n)],[(r.randrange(n),r.randrange(n)) for _ in range(r.randint(1,8))]))(r.randint(1,7)),[(([10**9]*100000,[(0,50000)]*100000),5000000000000000000),(([1]*100000,[(0,99999)]*100000),100000)],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+''.join(f'{a} {b}\n' for a,b in x[1]),ring_oracle,
'''def solve(d):
    n,q=map(int,d[:2]);prefix=[0]
    for i in range(2,2+n):prefix.append(prefix[-1]+int(d[i]))
    total=0
    for i in range(2+n,len(d),2):
        a,b=int(d[i]),int(d[i+1]);distance=abs(prefix[a]-prefix[b]);total+=min(distance,prefix[-1]-distance)
    return str(total)
''',[('仅走展开方向','min(distance,prefix[-1]-distance)','distance'),('错误选较长方向','min(distance,prefix[-1]-distance)','max(distance,prefix[-1]-distance)')],2500100,time=6)

def cleanup_oracle(x):
    s,a,b=x
    @lru_cache(None)
    def visit(state):
        if not state:return 0
        return min((a if state[0]==state[i] else b)+visit(state[1:i]+state[i+1:]) for i in range(1,len(state)))
    return visit(''.join(sorted(s)))
add(113,'同字符与异字符配对删除的最小费用','每次任意选两个位置删除；字符相等费用x，否则费用y。给出偶数长度字符串，求删空的最小总费用。','第一行字符串dataset（偶数长度2..100000），第二行x y（1..10000）。','若同类便宜，尽可能做同类对，数量为各频次整除2之和；若异类便宜，强制同类对只有max(0,最大频次−n/2)个，其余均做异类。','同类最大数量分别由各类频次决定且可同时达到；剩余奇数项可两两异类配。异类便宜时，最多类超过半数的超额必须内部配对，其他情况能全部跨类匹配，因此强制同类数为最大频次−总对数的非负部分。','时间O(n)，空间O(26)。',[('aaabca',3,2),('ouio',2,4),('aabb',2,7)],'样例1：四个a至少有一对内部配，其余两对异类，总3+2+2=7。样例2：配oo与ui，总2+4=6。样例3：分别删aa和bb，费用4。',lambda r:(''.join(r.choice('abcd') for _ in range(2*r.randint(1,5))),r.randint(1,8),r.randint(1,8)),[(('a'*100000,10000,1),500000000),(('ab'*50000,10000,1),50000)],lambda x:x[0]+'\n'+f'{x[1]} {x[2]}\n',cleanup_oracle,
'''def solve(d):
    from collections import Counter
    s=d[0];x,y=map(int,d[1:]);counts=Counter(s);pairs=len(s)//2
    same=sum(f//2 for f in counts.values()) if x<=y else max(0,max(counts.values())-pairs)
    return str(same*x+(pairs-same)*y)
''',[('始终优先同类','if x<=y else max(0,max(counts.values())-pairs)','if True else max(0,max(counts.values())-pairs)'),('忽略强制同类对','max(0,max(counts.values())-pairs)','0')],100100)

def encoded_oracle(s):
    counts=Counter(s);answer=[]
    def visit(prefix):
        if len(prefix)==len(s):
            if prefix==prefix[::-1]:answer.append(prefix)
            return
        for c in sorted(counts):
            if counts[c]:counts[c]-=1;visit(prefix+c);counts[c]+=1
    visit('');return min(answer)
def encoded_random(r):
    half=''.join(r.choice('abc') for _ in range(r.randint(0,3)));middle=r.choice('abc') if not half or r.randrange(2) else '';return half+middle+half[::-1]
add(115,'对称名称的最小字典序重排','输入保证是小写回文串。重排全部字符，输出仍然回文的最小字典序字符串，可以不改变原串。','一行回文字符串，长度1..100000，仅小写字母。','每类字符一半放左半串并按字母升序，唯一奇数频次字符放中间，右半串为左半串逆序。','任何回文必须两侧配对，因此每个字符在左半边的数量固定为频次整除2。左半边按字典序升序即最小，中心字符也由奇数频次唯一确定，右半边被镜像约束固定。','时间O(n+26)，空间O(n)。',['babab','cabbac','z'],'样例1：a两次、b三次，左半ab、中心b、右半ba，输出abbba。样例2：左半abc，镜像后abccba。样例3：单个z不变。',encoded_random,[('z'*25000+'a'*50000+'z'*25000,'a'*25000+'z'*50000+'a'*25000),('z'*100000,'z'*100000)],lambda s:s+'\n',encoded_oracle,
'''def solve(d):
    from collections import Counter
    counts=Counter(d[0]);left=''.join(c*(counts[c]//2) for c in sorted(counts));middle=''.join(c for c in sorted(counts) if counts[c]%2)
    return left+middle+left[::-1]
''',[('只排序全串不保回文','left+middle+left[::-1]',"''.join(sorted(d[0]))"),('左半按逆序','for c in sorted(counts));middle','for c in sorted(counts,reverse=True));middle')],100100,output='输出字典序最小的回文字符串。')

BLOCKED={83:'32MiB扩容解决输入容量，但m=200万、值域2×10⁸下的最坏CPU算法尚未验证，不能用逐项试除冒充10秒解；本批不扩展C++参考验证链路。源例[3,6,2,6,25]按现存整除替换规则最小34而非17。',102:'未明确同一股票条目能否反复购买；0/1背包与无限购买答案不同，不能只凭可能错误的110样例限定每股一次。',106:'未明确end station具体坐标以及是否每次停最近前方站；按常见末点为终点解释第二示例不是18，不能借107题规则补全。',114:'美丽度条件中比较对象与不等号被截断，单个例子不足以恢复定义。'}
SPECS=[s for s in SPECS if s['n'] not in BLOCKED]
def execute(path,inputs):
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300,check=True)
    values=json.loads(result.stdout);assert len(values)==len(inputs);return [v.rstrip('\n') for v in values]
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[]
    for s in SPECS:
        assert s['bound']<=32*1024*1024
        identifier=f"oa-amazon-{s['n']}";rng=random.Random(SEED+s['n']);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        oracle=[dict(input=s['encode'](x),expectedOutput=str(s['oracle'](x))+'\n') for x in s['samples']+[s['random'](rng) for _ in range(160)]];tests=oracle[:3]+[dict(input=s['encode'](x),expectedOutput=str(y)+'\n') for x,y in s['edges']]+oracle[3:27]
        for c in tests+oracle:assert len(c['input'].encode())<=s['bound'] and '\ufffd' not in c['input']+c['expectedOutput']
        for i,(actual,c) in enumerate(zip(execute(path,[c['input'] for c in oracle+tests]),oracle+tests)):assert actual==c['expectedOutput'].rstrip('\n'),(identifier,i,actual[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];killed=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(identifier,name);changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{identifier}-{j}.py';mp.write_text(changed);outputs=execute(mp,[c['input'] for c in cases]);bad=[i for i,(actual,c) in enumerate(zip(outputs,cases)) if actual!=c['expectedOutput'].rstrip('\n')];assert bad,(identifier,name,'survived');mutants.append(dict(name=name,code=changed));killed.append(dict(name=name,rejectedByCases=bad))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Amazon'],description=s['desc']+'\n\n标准I/O与题解由本站独立编写；注明本站的范围不是来源原约束。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('time',4),memoryLimit=s.get('memory',262144),outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        raw=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout;assert '\ufffd' not in raw
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)];source=sources[identifier]
        for folder,data in dict(packages=json.loads(raw),oracles=oracle,mutants=mutants,editorials=dict(schemaVersion=1,id=identifier,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        assert len(cases)<=64 and s.get('time',4)<=10 and (OUT/'packages'/f'{identifier}.json').stat().st_size<128*1024*1024
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(raw.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracle),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=s['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()));print(identifier,'163 oracle,',len(cases)-3,'hidden, 2 normal mutants rejected',flush=True)
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped={f'oa-amazon-{k}':v for k,v in BLOCKED.items()},note='Local batched runpy only, fresh __main__/stdin/stdout per case, not per-case OS isolation; production sandbox required.'),ensure_ascii=False,indent=2)+'\n')
    # Historical recovery reviews are owned by root through resolutions, never duplicated here.
    notes={101:'拼接保留重叠区间重复元素；未用下标指未被任何区间覆盖。缺省范围标为本站。',105:'每通道非空、0.5向上取整由原示例明确；不把原文single packet误解为每组恰一项。',109:'第二例最少3步，moves1/2/3答案001而非011。',111:'严格end<start由原文before与第二例4共同支持，不按可首尾相接的另一版本处理。'}
    reviews=[dict(id=f'oa-amazon-{n}',status='blocked' if n in BLOCKED else 'authored',reason=BLOCKED.get(n,notes.get(n,'独立算法/样例/暴力oracle/最大范围/语义负控验证；未执行来源题解。'))) for n in range(101,116)]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
