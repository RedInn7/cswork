"""Independent Amazon216–235 authoring; immutable raw e66f809 read, never executed."""
from collections import Counter,deque
from functools import lru_cache
from itertools import product,permutations,combinations
import json,hashlib
from pathlib import Path
import amazon_remaining_h as base
base.SPECS=[];base.BATCH='amazon-remaining-k';base.SEED=20262160
add=base.add;arr=base.arr
def seq(a):return ' '.join(map(str,a))
def ak(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def two(x):return str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n'
def books(x):
    a,p,k=x
    @lru_cache(None)
    def go(l,r,k):
        if l>r:return 0
        best=min(a[l]+go(l+1,r,k),a[r]+go(l,r-1,k))
        if l<r and k:best=min(best,p+go(l+1,r-1,k-1))
        return best
    return go(0,len(a)-1,k)
add(216,'两端购书优惠的最低总价','每步可按原价买剩余最左一本、最右一本，或按pairCost合购两端不同的两本。合购最多k次，求买完所有书的最低费用。','第一行n pairCost k，第二行价格。1≤n≤100000，1≤价格,pairCost≤10^9，1≤k≤n。','排序价格，枚举合购次数j，合购最高的2j本，费用为总价减最高2j本之和加j倍pairCost。','任意选定的偶数本可实现合购：先单买两端所有未选书，再合购最外两本选书，重复即可。因此固定j时合购最高2j本最优，枚举0..min(k,n//2)得到最优。','时间O(n log n)，空间O(n)。',[([1,2,3],2,1),([100,1,1,100],1,1),([1,1,1],10,3)],'答案依次3、3、3。第二例合购两端100；优惠不划算时可以不用。',lambda r:([r.randint(1,15) for _ in range(n)],r.randint(1,25),r.randint(1,n)) if (n:=r.randint(1,9)) else None,[(([10**9]*100000,1,100000),50000),(([1]*100000,10**9,100000),100000),(([10**9]*100000,10**9,1),99999000000000)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n',books,
'''def solve(d):
    n,p,k=map(int,d[:3]);a=sorted(map(int,d[3:]),reverse=True);total=sum(a);answer=total;saved=0
    for j in range(1,min(k,n//2)+1):
        saved+=a[2*j-2]+a[2*j-1];answer=min(answer,total-saved+j*p)
    return str(answer)
''',[('只优惠最便宜的书','reverse=True','reverse=False'),('强制用尽优惠','answer=min(answer,total-saved+j*p)','answer=total-saved+j*p')],1100050)
def errors(x):
    s,x,y=x;ids=[i for i,c in enumerate(s) if c=='!'];best=10**30
    for bits in product('01',repeat=len(ids)):
        a=list(s)
        for i,c in zip(ids,bits):a[i]=c
        best=min(best,sum(x if a[i]=='0' else y for i in range(len(a)) for j in range(i+1,len(a)) if a[i]!=a[j]))
    return best%1000000007
add(217,'替换通配符后的最少二元子序列错误','将每个!独立替换为0或1。每个下标i<j形成的01贡献x、10贡献y；不是只统计相邻字符。最小化完整代价后对1000000007取模。','第一行非空字符串，只含0、1、!；第二行x y。长度≤100000，0≤x,y≤100000。','若x>y则反转字符串并交换x,y，使x≤y。存在最优解使通配符按位置先0后1；初始全1，逐个改0并维护左右0/1数、增量代价，枚举所有分界。','x≤y时，交换两个通配符的逆序1、0为0、1，使这对及中间位置的总贡献不增加，外部贡献不变，所以可以消除全部逆序。每个最优单分界都在扫描中出现。把一个1改0的差为左1*y−左0*x+右1*x−右0*y，精确更新完整代价；最后才取模。','时间O(n)，空间O(n)。',[('101!1',2,3),('!1',1,1),('01!0',2,2)],'答案依次9、0、6；第二例替换为11没有错误。',lambda r:(''.join(r.choice('01!') for _ in range(r.randint(1,9))),r.randint(0,8),r.randint(0,8)),[(('0'*50000+'1'*50000,100000,100000),250000000000000%1000000007),(('!'*100000,100000,0),0),(('1'*50000+'0'*50000,0,100000),250000000000000%1000000007)],lambda x:x[0]+'\n'+f'{x[1]} {x[2]}\n',errors,
'''def solve(d):
    s=d[0];x,y=map(int,d[1:])
    if x>y:s=s[::-1];x,y=y,x
    a=list(s.replace('!','1'));left0=left1=cost=0
    for c in a:
        if c=='0':cost+=left1*y;left0+=1
        else:cost+=left0*x;left1+=1
    right0=a.count('0');right1=len(a)-right0;left0=left1=0;best=cost
    for original,c in zip(s,a):
        if c=='0':right0-=1
        else:right1-=1
        if original=='!':cost+=left1*y-left0*x+right1*x-right0*y;c='0';best=min(best,cost)
        if c=='0':left0+=1
        else:left1+=1
    return str(best%1000000007)
''',[('不考虑后面的已知字符','+right1*x-right0*y',''),('只接受全1通配符','best=min(best,cost)','best=best')],100030)
def xor_oracle(a):
    if not any(a):return 0
    for l in range(len(a)):
        for r in range(l,len(a)):
            x=0
            for v in a[l:r+1]:x^=v
            if not any(a[:l]+[x]*(r-l+1)+a[r+1:]):return 1
    return 2
add(218,'区间赋为原异或值的最少归零操作','数组长度为偶数。一次任选0≤L≤R<n，计算操作前区间全部元素的异或x，再把区间每个元素同时设为x。求归零的最少操作次数。','第一行偶数n，第二行数组。原文仅规定n偶数，本站2≤n≤200000；0≤元素<2^20。','全零返回0；否则全数组异或为0返回1，其余返回2。','一次归零必须覆盖所有非零元素，区间外都是0，所以其异或等于总异或。总异或非零时一次不可能；把整个偶数长数组赋为总异或后，再操作整段，偶数个相同值异或为0，两次总能实现。','时间O(n)，辅助空间O(1)（不含输入）。',[[0,0],[3,3],[1,2]],'答案依次0、1、2。第三例1,2→3,3→0,0。',lambda r:[r.randrange(8) for _ in range(2*r.randint(1,4))],[([0]*200000,0),([2**20-1]*200000,1),([0]*199999+[2**20-1],2)],arr,xor_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));x=0
    for v in a:x^=v
    return str(0 if not any(a) else 1 if x==0 else 2)
''',[('总异或为零误当已全零','0 if not any(a) else 1 if x==0 else 2','0 if x==0 else 2'),('非零异或误判无解','else 2)','else -1)')],1600030)
def extremes(a):
    b=list(a);moves=0;i=b.index(min(b))
    while i:b[i],b[i-1]=b[i-1],b[i];i-=1;moves+=1
    i=b.index(max(b))
    while i<len(b)-1:b[i],b[i+1]=b[i+1],b[i];i+=1;moves+=1
    return moves
add(219,'相邻交换让最轻在首最重在尾','不同重量的块按数组排列，一次只能交换相邻两块。要求最轻在第一个、最重在最后一个，中间不要求有序，求最少次数。','第一行n，第二行互异重量。2≤n≤100000，1≤重量≤10^9。','最轻下标l加最重距末尾距离n−1−r；若l>r，两者会交叉，减1。','每次相邻交换最多使一个极值向目标移动一格，只有两极值直接交换可同时减少两者距离。顺序相反时恰能进行一次这种共同移动，否则不能。先移最轻到首再移最重到尾达到该下界。','时间O(n)，空间O(n)含输入。',[[2,4,3,1,6],[3,2,1],[1,3,2]],'答案依次3、3、1。第二例两极值交叉，不能重复计这一步。',lambda r:r.sample(range(1,100),r.randint(2,9)),[(list(range(100000,0,-1)),199997),(list(range(1,100001)),0),([10**9]+list(range(2,100000))+[1],199997)],arr,extremes,
'''def solve(d):
    a=list(map(int,d[1:]));l=a.index(min(a));r=a.index(max(a));return str(l+len(a)-1-r-(l>r))
''',[('漏减交叉交换','-(l>r)',''),('错误要求完全排序','return str(l+len(a)-1-r-(l>r))','return str(sum(x>y for x,y in zip(a,a[1:])))')],1100030)
def bulbs(a):
    best=0
    for mask in range(1<<len(a)):
        selected=sorted(v for i,v in enumerate(a) if mask>>i&1);total=0;ok=True
        for v in selected:
            if v<total:ok=False;break
            total+=v
        if ok:best=max(best,len(selected))
    return len(a)-best
add(220,'任意排列后的最少关闭灯泡数','灯泡最初全部亮，从左到右检查：前面仍亮灯泡的亮度和严格大于本灯亮度时，本灯关闭。可任意排列，求最少关闭数。即使按前面全部灯的初始亮度解释，最优答案也相同：被弃灯全放末尾即可。','第一行n，第二行亮度。原文无数值界，本站1≤n≤200000，0≤亮度≤10^9。','亮度升序，维护已选保留亮度和sum，遇到v≥sum就保留，否则丢到最终排列末尾。','任意可保留序列中，正亮度必非降序，因为后一项至少是之前各项之和；0可以前移。在升序候选中，贪心选择最小的可用下一项，使任意相同选择数的累计和最小，因而最有利于后续继续选择。归纳得到最大保留数，弃灯放末尾不影响它们。','时间O(n log n)，空间O(n)。',[[2,1,3,4,3],[0,0,0],[1,1,2,4]],'答案依次2、0、0。第一例1,2,3保留，总和6，剩余4和3关闭。',lambda r:[r.randint(0,15) for _ in range(r.randint(1,10))],[([0]*200000,0),([10**9]*200000,199998),([0]*199999+[10**9],0)],arr,bulbs,
'''def solve(d):
    a=sorted(map(int,d[1:]));total=kept=0
    for v in a:
        if v>=total:total+=v;kept+=1
    return str(len(a)-kept)
''',[('等于累计亮度也关闭','v>=total','v>total'),('按原顺序放置','a=sorted(map(int,d[1:]))','a=list(map(int,d[1:]))')],2200030)
def equalize(x):
    a,b=x;target=tuple(y-x for x,y in zip(a,b));n=len(a)
    if min(target)<0:return -1
    start=(0,)*n;q=deque([(start,0)]);seen={start}
    masks={tuple(int(i<=j) for i in range(n)) for j in range(n)}|{tuple(int(i>=j) for i in range(n)) for j in range(n)}
    while q:
        state,d=q.popleft()
        if state==target:return d
        for mask in masks:
            nxt=tuple(a+b for a,b in zip(state,mask))
            if all(a<=b for a,b in zip(nxt,target)) and nxt not in seen:seen.add(nxt);q.append((nxt,d+1))
    return -1
def equal_random(r):
    n=r.randint(1,5);a=[r.randint(-3,3) for _ in range(n)];return a,[v+r.randint(-1,3) for v in a]
add(221,'仅前缀或后缀加一的最少对齐次数','每步只能将任意一个非空前缀全部+1，或任意一个非空后缀全部+1。将source变成target，输出最少次数，无法完成输出−1。','第一行n，第二行source，第三行target。原文无数值界，本站1≤n≤200000，两数组元素−10^9..10^9。','设d=target−source，D为所有相邻下降量之和。若d[0]<D则无解，否则答案d[n−1]+D。','每个相邻下降d[i]−d[i+1]>0只能由止于i的前缀操作产生，至少D个这种操作，均贡献首项，因此d[0]≥D必需。按全部下降量安排前缀后，剩余需求非负且单调不降，可由后缀按增量实现；总次数为D+d[n−1]。多用任何抵消的前后缀只会增加次数，下界达到。','时间O(n)，空间O(n)。',[([1,2,3,-1,0],[3,4,3,0,4]),([0,0,0],[0,1,0]),([1,2,2],[2,2,3])],'答案依次6、−1、2。中间单独增加无法通过限定操作完成。',equal_random,[(([-10**9]*200000,[10**9]*200000),2000000000),(([0]*200000,[0,1]*100000),-1),(([10**9]*200000,[-10**9]*200000),-1)],two,equalize,
'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));delta=[y-x for x,y in zip(a,b)];down=sum(max(0,x-y) for x,y in zip(delta,delta[1:]))
    return str(-1 if delta[0]<down else delta[-1]+down)
''',[('只检查差值非负','delta[0]<down','min(delta)<0'),('误将全部需求相加','delta[-1]+down','sum(delta)')],4800030)
def removal(x):
    a,k=x
    return min(len(a)-mask.bit_count() for mask in range(1<<len(a)) if len({v for i,v in enumerate(a) if mask>>i&1})<=k)
add(222,'删除商品使类别至多k种','删除若干商品，使剩余不同类别数量至多k，求最少删除商品数。同类别商品的不同件均计数。','第一行n k，第二行类别。1≤n,k,类别≤100000。','类别频率降序，保留最多的k类，其余全部删除。','固定保留类别集合，保留这些类别全部商品永远不劣。若保留了更低频类别而舍弃更高频类别，交换能增加保留数量，所以最优是频率最高至多k类。','时间O(n log n)，空间O(n)。',[([3,3,5,7],1),([1,2],5),([1,1,2,2,2],1)],'答案依次2、0、2。k超过实际种数不需要删除。',lambda r:([r.randint(1,5) for _ in range(r.randint(1,10))],r.randint(1,7)),[((list(range(1,100001)),1),99999),(([100000]*100000,100000),0),(([1]*50000+[2]*50000,1),50000)],ak,removal,
'''def solve(d):
    from collections import Counter
    n,k=map(int,d[:2]);freq=sorted(Counter(d[2:]).values(),reverse=True);return str(n-sum(freq[:k]))
''',[('保留最少出现类别','reverse=True','reverse=False'),('把类别数当商品数','n-sum(freq[:k])','max(0,len(freq)-k)')],700030)
def ring_oracle(x):
    a,total=x;bits={v:i for i,v in enumerate(a)};done=(1<<len(a))-1;q=deque();seen=set()
    for v in a:q.append((v,1<<bits[v],0));seen.add((v,1<<bits[v]))
    while q:
        v,mask,d=q.popleft()
        if mask==done:return d
        for w in ((v-2)%total+1,v%total+1):
            nxt=(w,mask|(1<<bits[w] if w in bits else 0))
            if nxt not in seen:seen.add(nxt);q.append((*nxt,d+1))
def ring_random(r):
    total=r.randint(1,10);return r.sample(range(1,total+1),r.randint(1,total)),total
add(224,'环形服务器串行走访的最短时间','服务器1..total形成单位边环。选择任意起点，用一条连续串行路线走访全部目标服务器，每过一条边耗时1，不是同时向两边广播。目标互异。','第一行n total，第二行n个目标编号。1≤total≤10^9，1≤n≤min(total,100000)，1≤编号≤total。原约束编号≤n与正文及全部样例冲突，据正文恢复为≤total。','目标升序，计算包括首尾绕环在内的相邻目标间隔；答案为环长减最大间隔。','若路线走遍整个环，显然不优于删除一个间隔后的路线。未走遍整个环的边集合落在某条覆盖全部目标的路径中，路线长度至少为该路径长度。路径能删掉的部分不含目标，最长可删部分正是最大相邻目标圆弧；沿其余路径从一端走到另一端达到下界。','时间O(n log n)，空间O(n)。',[([2,6,8],8),([1,5],5),([4],10)],'答案依次4、1、0。单一目标直接从它开始。',ring_random,[(([1,10**9],10**9),1),((list(range(1,100001)),10**9),99999),((list(range(1,100001)),100000),99999)],ak,ring_oracle,
'''def solve(d):
    n,total=map(int,d[:2]);a=sorted(map(int,d[2:]));gap=a[0]+total-a[-1]
    for x,y in zip(a,a[1:]):gap=max(gap,y-x)
    return str(total-gap)
''',[('漏掉绕环的间隔','gap=a[0]+total-a[-1]','gap=0'),('固定按编号递增走','return str(total-gap)','return str(a[-1]-a[0])')],1100040)
def unique_oracle(x):
    a,c=x;n=len(a);low=min(a);high=max(a)+n
    @lru_cache(None)
    def go(pos,mask):
        if mask==(1<<n)-1:return 0
        if pos>high:return 10**30
        best=go(pos+1,mask)
        for i in range(n):
            if not(mask>>i&1) and a[i]<=pos:best=min(best,(pos-a[i])*c[i]+go(pos+1,mask|1<<i))
        return best
    return go(low,0)
add(225,'增加尺寸使全部互异的最小费用','每件商品的尺寸只能增加，每增加1单位的费用为该商品cost。最后所有商品尺寸必须互异，求最小总费用，不得删除商品。','第一行n，第二行尺寸，第三行单位费用。1≤n≤200000，1≤尺寸≤10^9，1≤费用≤10000。','按原尺寸排序扫描最终尺寸坐标，最大堆维护原尺寸≤当前位置的商品，每次固定单位成本最高者；无可用商品时直接跳到下一原尺寸。','当前位置若可放商品却空置，将未来某个可放商品提前只会减费。若最优方案先放低成本商品，交换它与当前最高成本商品的最终位置仍合法，费用变化为延后距离乘低成本减高成本，不增。逐步交换证明贪心最优；跳过空坐标避免与尺寸最大值成正比。','时间O(n log n)，空间O(n)，答案用64位。',[([3,7,9,7,8],[5,2,5,7,5]),([2,3,3,2],[2,4,5,1]),([1,1],[1,10])],'答案依次6、7、1。第二例成本4的3升至4，成本1的2升至5，总7。',lambda r:([r.randint(1,7) for _ in range(n)],[r.randint(1,8) for _ in range(n)]) if (n:=r.randint(1,7)) else None,[(([10**9]*200000,[10000]*200000),199999000000000),(([1,10**9],[10000,10000]),0),(([1]*200000,[1]*200000),19999900000)],two,unique_oracle,
'''def solve(d):
    import heapq
    n=int(d[0]);a=list(map(int,d[1:1+n]));c=list(map(int,d[1+n:]));items=sorted(zip(a,c));heap=[];i=0;pos=0;answer=0
    while i<n or heap:
        if not heap:pos=max(pos,items[i][0])
        while i<n and items[i][0]<=pos:
            start,cost=items[i];heapq.heappush(heap,(-cost,start,cost));i+=1
        _,start,cost=heapq.heappop(heap);answer+=(pos-start)*cost;pos+=1
    return str(answer)
''',[('优先固定最低费用','(-cost,start,cost)','(cost,start,cost)'),('每件只付一次单位费用','answer+=(pos-start)*cost','answer+=cost if pos>start else 0')],3600030)
def boxes(x):
    a,k=x
    return len(a)-max(mask.bit_count() for mask in range(1,1<<len(a)) if (b:=[v for i,v in enumerate(a) if mask>>i&1]) and max(b)<=k*min(b))
add(226,'卸载最少箱子满足最大最小比例','卸下若干箱子，必须保留至少一个，保留尺寸满足max≤capacity*min。求最少卸载数量。','第一行n capacity，第二行尺寸。原文1≤n≤100000、1≤尺寸≤500000；capacity范围缺失，本站规定正整数1≤capacity≤10^9。','排序后双指针，维护最大值≤capacity乘最小值，最大化窗口长度。','固定保留集合的最小最大值，其间所有箱子都可保留且不会破坏条件，所以存在排序连续窗口最优解。右端递增时需移动左端直到满足条件，此时是当前右端的最长合法窗口，取最大覆盖全部最优可能。','时间O(n log n)，空间O(n)。',[([1,2,3,9],3),([2,2,3],1),([500000],1)],'答案依次1、1、0；相等于比例上限也合法。',lambda r:([r.randint(1,20) for _ in range(r.randint(1,9))],r.randint(1,5)),[(([500000]*100000,1),0),((list(range(1,100001)),1),99999),(([1]*50000+[500000]*50000,499999),50000)],ak,boxes,
'''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));left=best=0
    for right,v in enumerate(a):
        while left<right and v>k*a[left]:left+=1
        best=max(best,right-left+1)
    return str(n-best)
''',[('把比例上界改为严格','v>k*a[left]','v>=k*a[left]'),('误把删除数当保留数','str(n-best)','str(best)')],700040)
def changes_oracle(x):
    a,k=x
    if k>=len(a):return 0
    # Enumerate original positions that remain unchanged; check equality graph.
    best=len(a)
    for mask in range(1<<len(a)):
        ok=True
        for r in range(k):
            ids=list(range(r,len(a),k));kept={a[i] for i in ids if not(mask>>i&1)}
            if len(kept)>1 or (kept and next(iter(kept))<=0 and any(mask>>i&1 for i in ids)):ok=False;break
        if ok:best=min(best,mask.bit_count())
    return best
add(227,'修改为正整数使所有k窗口同和','可把任意元素修改为正整数，每个改变的位置计一次。要求所有长度k连续子数组的和相同，求最少修改数。原元素允许非正数；未修改的位置不需要变为正数。k≥n时无需修改。','第一行n k，第二行整数数组。原文无数值界，本站1≤n,k≤200000，−10^9≤元素≤10^9。','相邻窗口相减得a[i]=a[i+k]。按下标模k分组：原本全相同的组不改；其余统一成出现最多的正值，没有正值则全部改为1。','所有窗口同和等价于各组内相等，组之间互不干扰。若不修改可保留任何原值；需要改动时目标只能为正整数，因此最多保留该组最高正数频率个位置。每组实现下界后求和即全局最优。','时间O(n+k)，空间O(n)。',[([1,2,1,3],2),([-1,-1],1),([-1,-1,2],1)],'答案依次1、0、2。最后一例不能把2改成−1，只能把两个−1改成2。',lambda r:([r.randint(-2,4) for _ in range(r.randint(1,9))],r.randint(1,10)),[(([10**9]*200000,1),0),(([-10**9]*100000+[10**9]*100000,1),100000),(([-1,0]*100000,200000),0)],ak,changes_oracle,
'''def solve(d):
    from collections import Counter
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));answer=0
    for start in range(min(k,n)):
        group=a[start::k];freq=Counter(group)
        if len(freq)>1:answer+=len(group)-max([0]+[count for value,count in freq.items() if value>0])
    return str(answer)
''',[('错误允许改成负数','if value>0','if True'),('只看相邻相等','group=a[start::k]','group=a[start:start+1]')],2400040)
def docks(x):
    a,t=x
    for k in range(1,len(a)+1):
        remaining=[0]*k;i=0;elapsed=0
        while i<len(a) or any(remaining):
            for j in range(k):
                if remaining[j]==0 and i<len(a):remaining[j]=a[i];i+=1
            if not any(remaining):break
            step=min(v for v in remaining if v);elapsed+=step;remaining=[max(0,v-step) for v in remaining]
        if elapsed<=t:return k
def docks_random(r):
    a=[r.randint(1,12) for _ in range(r.randint(1,12))];return a,r.randint(max(a),sum(a))
add(228,'固定开始顺序的最少卸货泊位','卡车必须按输入顺序开始卸货，空闲泊位立即接下一辆；同时开始时按输入顺序分配。所有卡车在T时间内完成，求最少泊位数，不可重排卡车。','第一行n T，第二行每车耗时。1≤n≤50000，1≤T≤10^15，1≤耗时≤min(T,10^9)。来源对T上界识别有备注，本站明确采用10^15。','二分泊位数。检查d时用最小堆保存各泊位可用时间，每辆车分配给最早空闲者，再检查最晚完成时间。','固定泊位数时题定立即开始规则唯一决定每辆开始时间；堆精确模拟最早可用泊位。增加泊位不会使按次序贪心开始的第i辆更晚：用所有已开始任务的完成时刻作归纳，容量增加只会使可开始的时刻提前。因此可行性单调，二分找最小可行值。','时间O(n log²n)，空间O(n)。',[([3,4,3,2,3],8),([2,3,1],7),([2,2],2)],'答案依次3、1、2。第一例两泊位要9分钟，不符合8。',docks_random,[(([10**9]*50000,10**9),50000),(([10**9]*50000,10**15),1),(([1]*50000,49999),2)],ak,docks,
'''def solve(d):
    import heapq
    n,t=map(int,d[:2]);a=list(map(int,d[2:]))
    def valid(k):
        heap=[0]*k
        for v in a:heapq.heapreplace(heap,heap[0]+v)
        return max(heap)<=t
    lo=1;hi=n
    while lo<hi:
        mid=(lo+hi)//2
        if valid(mid):hi=mid
        else:lo=mid+1
    return str(lo)
''',[('只按总耗时均分','if valid(mid):','if sum(a)<=mid*t:'),('不允许恰好完成','max(heap)<=t','max(heap)<t')],550040,time=8)
def trucks_oracle(x):
    a,c,l=x
    if not sum(a):return 0
    for count in range(1,sum(a)+1):
        # Independent integral max-flow: types -> trucks with per-type edge cap.
        types=len(a);sink=types+count+1;cap=[[0]*(sink+1) for _ in range(sink+1)]
        for i,v in enumerate(a):
            cap[0][i+1]=v
            for j in range(count):cap[i+1][types+1+j]=l
        for j in range(count):cap[types+1+j][sink]=c
        flow=0
        while True:
            parent=[-1]*(sink+1);parent[0]=0;q=deque([0])
            while q and parent[sink]<0:
                u=q.popleft()
                for v in range(sink+1):
                    if cap[u][v] and parent[v]<0:parent[v]=u;q.append(v)
            if parent[sink]<0:break
            delta=10**9;v=sink
            while v:delta=min(delta,cap[parent[v]][v]);v=parent[v]
            v=sink
            while v:u=parent[v];cap[u][v]-=delta;cap[v][u]+=delta;v=u
            flow+=delta
        if flow==sum(a):return count
add(229,'总容量与单类上限下的最少卡车数','每类有items[i]件可独立分配的包裹。每车最多C件，每车同一类最多L件。所有包裹均运输，求最少车辆；并非一类必须整批同车。全无包裹需0辆。','第一行n C L，第二行每类数量。原文无数值界，本站1≤n≤200000，0≤数量≤10^9，1≤C,L≤10^9。','答案为总件数除C向上取整与最大类别数除L向上取整的较大者。','两项显然都是下界。设车数m满足它们，类型到每辆车容量L、车到终点容量C的网络可全部装载：对任意类型子集S，所需sum(S)≤min(总数,|S|*m*L)≤m*min(C,|S|*L)，满足完整二部容量网络的割条件。整数流给出合法逐件装载，所以下界足够。','时间O(n)，空间O(n)含输入，答案用64位。',[([2,4],3,2),([4,4,3],3,3),([10],100,3)],'答案依次2、4、4。第三例由同类每车上限决定。',lambda r:([r.randint(0,5) for _ in range(r.randint(1,5))],r.randint(1,8),r.randint(1,5)),[(([10**9]*200000,1,1),200000000000000),(([0]*200000,10**9,10**9),0),(([10**9]*200000,10**9,1),10**9)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n',trucks_oracle,
'''def solve(d):
    n,c,l=map(int,d[:3]);a=list(map(int,d[3:]));return str(max((sum(a)+c-1)//c,(max(a)+l-1)//l))
''',[('漏单类限制','(max(a)+l-1)//l','0'),('总数向下取整','(sum(a)+c-1)//c','sum(a)//c')],2200050)
def hubs(a):
    for k in range(1,len(a)+1):
        reachable=set(range(1,k+1))
        for x,y in zip(a,a[1:]):reachable={j for j in range(1,k+1) for i in reachable if (j>i if y>x else j<i if y<x else j==i)}
        if reachable:return k
add(230,'满足相邻需求趋势的最少不同配送中心','第i天选择编号1..n的中心。需求比前一天高则编号严格更高，需求低则严格更低，需求相等必须使用相同中心。最小化全部天使用的不同中心数量。','第一行n，第二行每天需求。原文无数值界，本站1≤n≤200000，0≤需求≤10^9。','忽略连续相等需求，求连续严格上升或严格下降段的最大比较次数，加1。','长度r的同向比较链需要至少r+1个不同编号。将相等位置缩为一点后，相邻比较形成一条定向路径，其最长有向路径恰是最长同向段。给每点编号为以该点结束的最长有向路径顶点数，严格递增方向满足编号增大且最大编号不超过下界，反向亦满足，因此下界可达到。','时间O(n)，辅助空间O(1)不含输入。',[[10,20,30,15,10],[1,2,2,3],[5,5]],'答案依次3、3、1。相等需求不能中断持续上升约束。',lambda r:[r.randint(0,6) for _ in range(r.randint(1,10))],[(list(range(200000)),200000),([10**9]*200000,1),([0,10**9]*100000,2)],arr,hubs,
'''def solve(d):
    a=list(map(int,d[1:]));direction=run=0;best=1
    for x,y in zip(a,a[1:]):
        if x==y:continue
        sign=1 if y>x else -1;run=run+1 if sign==direction else 1;direction=sign;best=max(best,run+1)
    return str(best)
''',[('相等错误打断链','if x==y:continue','if x==y:direction=run=0;continue'),('把不同需求数当中心数','return str(best)','return str(len(set(a)))')],2200030)
def prefix_oracle(a):
    # Unit operations explicitly on the array, cancel the rightmost nonzero.
    a=list(a);count=0
    while any(a):
        j=max(i for i,v in enumerate(a) if v);step=-1 if a[j]>0 else 1
        for i in range(j+1):a[i]+=step
        count+=1
    return count
add(231,'任意前缀加减一的最少归零次数','一次选择非空前缀，对该前缀所有元素同时+1或−1，求数组全部归零的最少操作数。不是后缀操作。','第一行n，第二行整数。1≤n≤100000，−10^9≤元素≤10^9。','答案为最后元素绝对值，加每个相邻差绝对值。','把数组转为差分b[i]=a[i]−a[i+1]，最后b[n−1]=a[n−1]。操作长度i+1的前缀只会让b[i]改变±1，其他差分不变，故每个差分必须花费至少其绝对值次，独立消去每个差分恰好达到总下界。','时间O(n)，辅助空间O(1)不含输入。',[[3,2,1],[3,2,0,0,-1],[-1,-1]],'答案依次3、5、1。第二例不能用首项绝对值替代末项。',lambda r:[r.randint(-8,8) for _ in range(r.randint(1,10))],[(([10**9,-10**9]*50000),199999000000000),([10**9]*100000,10**9),([0]*100000,0)],arr,prefix_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));return str(abs(a[-1])+sum(abs(x-y) for x,y in zip(a,a[1:])))
''',[('误用后缀公式','abs(a[-1])','abs(a[0])'),('相邻差不取绝对值','sum(abs(x-y)','sum((x-y)')],1200030)
def health(x):
    a,armor=x
    for initial in range(1,sum(a)+2):
        for where in range(len(a)):
            current=initial
            for i,v in enumerate(a):
                current-=v-min(v,armor) if i==where else v
                if current<=0:break
            else:return initial
add(232,'一次护甲下保持正生命的最低初始血量','依次通过每关，扣除power[i]血量，任意时刻血量必须严格大于0。可在至多一关用护甲抵消min(armor,power[i])伤害，求最小初始血量。','第一行n armor，第二行伤害。主来源未给数值界；同快照同题amazon-minimum-starting-health-to-win-the-game.md补齐：1≤n≤100000，1≤伤害,armor≤10^9。','护甲用于最大伤害关，答案总伤害−min(armor,最大伤害)+1。','所有关卡的实际伤害均非负，所以最后生命最低。至少需要实际总伤害+1生命。护甲只能使用一次，其最大抵消量是min(armor,max(power))，在最大伤害关使用即可达到，因此公式为最优。','时间O(n)，空间O(n)含输入，答案用64位。',[([1,2,6,7],5),([1,2,3],1),([5],10)],'答案依次12、6、1。即使全部伤害被挡住仍要至少1血。',lambda r:([r.randint(1,8) for _ in range(r.randint(1,8))],r.randint(1,12)),[(([10**9]*100000,10**9),99999000000001),(([1]*100000,10**9),100000),(([10**9],1),10**9)],ak,health,
'''def solve(d):
    n,armor=map(int,d[:2]);a=list(map(int,d[2:]));return str(sum(a)-min(armor,max(a))+1)
''',[('漏严格大于零','max(a))+1','max(a))'),('一次护甲错误用于全部关卡','sum(a)-min(armor,max(a))+1','sum(max(0,v-armor) for v in a)+1')],1100040)
def order_oracle(a):
    best=None;gain=None
    for p in permutations(range(1,len(a)+1)):
        value=sum(i*a[j-1] for i,j in enumerate(p,1))
        if gain is None or value>gain:gain=value;best=p
    return seq(best)
add(233,'最大信息收益的字典序最小下标排列','输出1..n的一个排列p，最大化sum(i*data[p[i]])，这里i和p均按1基解释；若多个排列并列，取字典序最小者。原文公式下标0..n为笔误，权重改成0..n−1也只差固定总和，不影响最优排列。','第一行n，第二行data。原文无数值界，本站1≤n≤200000，−10^9≤data≤10^9。输出的是原数组下标排列，不是排序后的值或各元素的名次。','按(data[i],i)升序排序原下标，输出1基下标。','若较大值在较小权重处，交换两者使收益增加(权重差)*(值差)，所以最优必须值升序。相等值互换不影响收益，按原下标升序放置便在每个等值块给出字典序最小排列。','时间O(n log n)，空间O(n)。',[[3,1,2],[2,2,1],[-2,-1,-2]],'答案依次2 3 1、3 1 2、1 3 2。相等值按原下标升序。',lambda r:[r.randint(-3,5) for _ in range(r.randint(1,7))],[([10**9]*200000,seq(range(1,200001))),(list(range(200000,0,-1)),seq(range(200000,0,-1))),([-10**9,10**9], '1 2')],arr,order_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));order=sorted(range(len(a)),key=lambda i:(a[i],i));return ' '.join(str(i+1) for i in order)
''',[('输出错误0基下标','str(i+1)','str(i)'),('同值下标倒序','(a[i],i)','(a[i],-i)')],2400030,output='输出n个1基原下标，空格分隔。',outputLimit=4096)
def packaging(a):
    def go(i,prev):
        if i==len(a):return 1
        count=0
        for stamp in range(1,6):
            if i==0 or (stamp>prev if a[i]>a[i-1] else stamp<prev if a[i]<a[i-1] else stamp!=prev):count+=go(i+1,stamp)
        return count
    return go(0,0)%1000000007
add(234,'五种邮票的完美包装方案数','每件包裹选择编号1..5的邮票。相邻价格上升要求邮票严格上升，价格下降要求邮票严格下降，价格相等要求邮票编号不同。统计方案数对1000000007取模，无方案输出0。','第一行n，第二行价格。1≤n≤100000，1≤价格≤100000。','五状态DP记录最后邮票编号，按相邻价格关系从符合严格比较或不等条件的旧编号转移。','单件每种邮票有一种方案。每个更长合法方案唯一分为前缀方案和末邮票，转移条件恰好检查新相邻关系，既不漏计也不重复。逐项归纳后求末状态和就是全部方案。','时间O(25n)，辅助空间O(5)不含输入。',[[3,1,1],[1,2,3],[1,2,3,4,5,6]],'答案依次40、10、0。六个价格严格递增需要六种不同邮票，只有五种。',lambda r:[r.randint(1,5) for _ in range(r.randint(1,6))],[([100000]*100000,5*pow(4,99999,1000000007)%1000000007),(list(range(1,100001)),0),([1],5)],arr,packaging,
'''def solve(d):
    a=list(map(int,d[1:]));dp=[1]*5;mod=1000000007
    for x,y in zip(a,a[1:]):
        nxt=[0]*5
        for j in range(5):
            for i in range(5):
                if (j>i if y>x else j<i if y<x else j!=i):nxt[j]=(nxt[j]+dp[i])%mod
        dp=nxt
    return str(sum(dp)%mod)
''',[('价格相等邮票也相等','else j!=i','else j==i'),('价格上升允许同邮票','j>i if y>x','j>=i if y>x')],700030,time=8)
def teams(x):
    a,l,h=x;return sum(l<=a[i]+a[j]<=h for i in range(len(a)) for j in range(i+1,len(a)))
def teams_random(r):
    l=r.randint(-12,12);return [r.randint(-10,10) for _ in range(r.randint(1,12))],l,r.randint(l,20)
add(235,'技能和落在闭区间的双人团队数','选择两个不同员工，下标不同即不同人，即使技能相同。统计技能和在[minSkill,maxSkill]闭区间内的无序员工对数。','第一行n minSkill maxSkill，第二行技能。原文约束截断，本站1≤n≤200000，技能与两界−10^9..10^9，minSkill≤maxSkill。','排序，双指针计算和≤K的对数。答案为count(maxSkill)−count(minSkill−1)。','固定左端时，若与当前最大右端之和≤K，则与中间所有右端均合格，一次贡献right−left；否则该右端无法配当前或更大左端，可丢弃。这样按左端分组不重不漏，两个前缀阈值相减精确留下闭区间。','时间O(n log n)，空间O(n)，计数用64位。',[([2,3,4,5],5,7),([1,1,1],2,2),([-2,0,2],-2,0)],'答案依次4、3、2。第二例三名同技能员工能组成三对。',teams_random,[(([0]*200000,0,0),19999900000),(([10**9]*200000,-10**9,10**9),0),(([-10**9]*100000+[10**9]*100000,0,0),10**10)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n',teams,
'''def solve(d):
    n,low,high=map(int,d[:3]);a=sorted(map(int,d[3:]))
    def count(k):
        left=0;right=len(a)-1;answer=0
        while left<right:
            if a[left]+a[right]<=k:answer+=right-left;left+=1
            else:right-=1
        return answer
    return str(count(high)-count(low-1))
''',[('遗漏闭区间下界','count(low-1)','count(low)'),('将同技能员工去重','a=sorted(map(int,d[3:]))','a=sorted(set(map(int,d[3:])))')],2400060)

def main():
    base.main()
    path=base.OUT/'reviews'/f'{base.BATCH}.json';data=json.loads(path.read_text())
    data['items'].append(dict(id='oa-amazon-223',status='blocked',reason='原始e66f809的amazon-get-min-time-two.md未定义minGap为开始时间差还是中间空闲冷却长度，且无样例。aa,gap=1分别可得2或3；来源解法不足以确定核心规则，保留阻塞。'))
    slugs=['get-min-cost-book','get-min-errors','get-min-moves','get-min-num-moves','get-min-of-bulbs-off','get-min-operations','get-min-removal','get-min-time-two','get-min-time','get-minimal-cost','get-minimum-boxes','get-minimum-changes','get-minimum-dock-bays','get-minimum-number-of-trucks','get-minimum-number-of-unique-distribution-centers','get-minimum-operations','get-minimum-value','get-most-out-of-the-data','get-num-perfect-packaging','get-num-teams']
    catalog={v['id']:v for v in json.loads((base.ROOT/'content/oa-master/catalog.json').read_text())['items']}
    for item in data['items']:
        number=int(item['id'].split('-')[-1]);paths=['fastprep/Amazon/amazon-'+slugs[number-216]+'.md']
        if number==232:paths.append('fastprep/Amazon/amazon-minimum-starting-health-to-win-the-game.md')
        item['sourceEvidence']=[]
        for relative in paths:
            raw=(Path('/tmp/cswork-oa-source-20260919')/relative).read_bytes()
            item['sourceEvidence'].append(dict(commit='e66f809f4c953bce129f68491726176615db6afc',path=relative,gitBlobSha1=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=catalog[item['id']]['contentHash']))
    data['items'].sort(key=lambda v:int(v['id'].split('-')[-1]));path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
