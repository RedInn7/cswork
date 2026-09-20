"""Independently authored Amazon 196..215, immutable raw e66f809 checked."""
from collections import Counter,deque
from itertools import permutations,combinations,product
from functools import lru_cache
import json,random
import amazon_remaining_h as base
base.SPECS=[];base.BATCH='amazon-remaining-j';base.SEED=20261960
add=base.add;arr=base.arr
def seq(a):return ' '.join(map(str,a))
def mean_oracle(a):
    a=list(a);out=set()
    while a:
        x=min(a);a.remove(x);y=max(a);a.remove(y);out.add((x+y)/2)
    return len(out)
add(196,'最高最低经验配对的不同平均值','反复取剩余经验最高与最低的两人配对并移除，统计所有配对平均经验值的不同取值数。相同经验的人仍是独立人员。','第一行偶数n，第二行n个经验值。2≤n≤100000，0≤经验≤10^9。','排序首尾配对，统计两数和的不同值，不做浮点除法。','排序两端恰是每轮极值，删除后内部仍有序。两组平均相等当且仅当两数和相等，因此和集合大小就是答案。','时间O(n log n)，空间O(n)。',[[1,4,1,3,5,6],[0,0],[1,100,10,1000]],'答案依次2、1、2；第一例的和为7、6、7。',lambda r:[r.randint(0,15) for _ in range(2*r.randint(1,7))],[([0]*100000,1),([10**9]*100000,1),(list(range(100000)),1)],arr,mean_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]));n=len(a)
    return str(len({a[i]+a[n-1-i] for i in range(n//2)}))
''',[('平均数向下取整','a[i]+a[n-1-i]','(a[i]+a[n-1-i])//2'),('按输入配对不排序','a=sorted(map(int,d[1:]))','a=list(map(int,d[1:]))')],1100030)
def moves_random(r):
    initial=r.sample(range(20),r.randint(1,8));now=set(initial);moves=[]
    for _ in range(r.randint(0,12)):
        old=r.choice(sorted(now));new=r.choice(sorted(set(range(20))-now));moves.append((old,new));now.remove(old);now.add(new)
    return initial,moves
def moves_oracle(x):
    values=list(x[0])
    for a,b in x[1]:values[values.index(a)]=b
    return seq(sorted(values))
add(197,'顺序迁移后的最终数据位置','开始有n个互不相同的数据位置。按输入顺序将位置from的数据移动到to，保证每次from当前有数据、to当前无数据。输出全部最终位置升序排列。','第一行n m，第二行初始位置，随后m行from to。原文未给数值界，本站1≤n≤100000，0≤m≤100000，位置0..10^9。','用集合保存当前位置，每次删除from并加入to，最后排序。','初始集合恰为真实位置。每次合法移动只改变给定两位置，集合删除加入与真实状态一致，归纳完成全部操作后排序得到所需结果。','期望时间O(m+n log n)，空间O(n)。',[([1,3],[(1,2),(2,4)]),([2,5],[]),([0],[(0,10),(10,0)])],'答案依次3 4、2 5、0；第三例允许迁回已腾空位置。',moves_random,[((list(range(100000)),[(i,10**9-i) for i in range(100000)]),seq(range(10**9-99999,10**9+1))),(([0],[(i%2,1-i%2) for i in range(100000)]),'0')],lambda x:f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+''.join(f'{a} {b}\n' for a,b in x[1]),moves_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);places=set(map(int,d[2:2+n]))
    for i in range(2+n,len(d),2):places.discard(int(d[i]));places.add(int(d[i+1]))
    return ' '.join(map(str,sorted(places)))
''',[('迁出后仍保留','places.discard(int(d[i]))','None'),('输出顺序反转','sorted(places)','sorted(places,reverse=True)')],3300050,output='输出n个最终位置，严格升序、空格分隔。',outputLimit=2048)
add(198,'所有日期的最大聚合温差','第i天聚合温差为从第1天到i的前缀和与从i到最后一天的后缀和的较大值，两部分都包含第i天。返回全部日期中的最大聚合温差，不允许空前缀或空后缀。','第一行n，第二行n个温差。1≤n≤100000，−10^9≤温差≤10^9。','先计算总和，逐日维护前缀。当前后缀为总和减去此前前缀，同时比较当前前缀及后缀。','循环到i时此前前缀精确等于第1..i−1天之和，因而总和减它得到含i的后缀；加上当前温差得到含i的前缀。检查所有日期、全部合法候选不重不漏。','时间O(n)，空间O(n)含输入，辅助O(1)。',[[6,-2,5],[-1,2,3],[-5,-2,-8]],'答案依次9、5、−5；最后一例不能选择空段得到0。',lambda r:[r.randint(-8,8) for _ in range(r.randint(1,12))],[([10**9]*100000,10**14),([-10**9]*100000,-10**9),([-10**9,10**9,10**9,-10**9],10**9)],arr,lambda a:max([sum(a[:i+1]) for i in range(len(a))]+[sum(a[i:]) for i in range(len(a))]),
'''def solve(d):
    a=list(map(int,d[1:]));total=sum(a);prefix=0;answer=-10**30
    for v in a:
        answer=max(answer,total-prefix);prefix+=v;answer=max(answer,prefix)
    return str(answer)
''',[('错误允许空段','answer=-10**30','answer=0'),('仅看总和','return str(answer)','return str(total)')],1200030)
def alternating_oracle(x):
    s,k=x;best=0
    for mask in range(1<<len(s)):
        if mask.bit_count()>k:continue
        changed=[str(int(v)^(mask>>i&1)) for i,v in enumerate(s)];run=0;prev=None
        for c in changed:
            run=run+1 if c!=prev else 1;prev=c;best=max(best,run)
    return best
add(199,'至多k次单点翻转后的最长交替子串','二进制串每次可翻转一个字符，至多k次，求可以得到的最长相邻字符均不同的连续子串长度。不是子序列，也不是区间整段翻转。','第一行二进制串，第二行k。原文未给数值界，本站1≤长度≤200000，0≤k≤200000。','分别匹配全局0101…和1010…模板，用滑窗维护窗口内不匹配位置数不超过k。','任意交替子串与这两种全局模板之一一致，修改代价恰为不匹配数。固定模板时窗口扩大不会减少代价，超预算则缩左端，双指针枚举每个右端的最长可行窗口，取两模板最大即答案。','时间O(n)，辅助空间O(1)。',[('0000',1),('01010',0),('111',2)],'答案依次3、5、3。',lambda r:(''.join(r.choice('01') for _ in range(r.randint(1,9))),r.randint(0,9)),[(('0'*200000,99999),199999),(('01'*100000,0),200000),(('1'*200000,200000),200000)],lambda x:x[0]+'\n'+str(x[1])+'\n',alternating_oracle,
'''def solve(d):
    s=d[0];k=int(d[1]);answer=0
    for start in (0,1):
        left=bad=0
        for right,c in enumerate(s):
            bad+=int(c)!=((right+start)%2)
            while bad>k:
                bad-=int(s[left])!=((left+start)%2);left+=1
            answer=max(answer,right-left+1)
    return str(answer)
''',[('只尝试一种模板','for start in (0,1):','for start in (0,):'),('把预算取为0','k=int(d[1])','k=0')],200020)
def on_oracle(x):
    s,k=x;n=len(s);state=int(s,2);seen={state};front={state};best=0
    for step in range(min(k,n)+1):
        for v in front:best=max(best,max(map(len,format(v,f'0{n}b').split('0'))))
        if best==n or step==k:return best
        nxt={v^(((1<<(r-l+1))-1)<<l) for v in front for l in range(n) for r in range(l,n)}-seen;seen|=nxt;front=nxt
    return best
def on_random(r):return ''.join(r.choice('01') for _ in range(r.randint(1,7))),r.randint(1,3)
add(200,'至多k次区间翻转后的最长连续开机段','一次操作选择任意连续区间，把其中0与1全部翻转，至多k次。求最后最长全1连续段长度。操作允许重叠，不要求用满k次。','第一行二进制串，第二行k。1≤长度≤200000，1≤k≤200000。','滑窗统计其中0连续段数，保持不超过k，最大化长度。每个0段单独翻转一次就能全变1。','对目标窗口，需翻转奇数次的位置正是原来的0段。每个区间翻转至多提供两个奇偶边界，一个0段需要一对边界（碰到窗口端点可把操作延伸到外部但不能消除其需要）。因此至少需要窗口内0段数次，逐段翻转达到下界。0段数量随右扩不减，双指针求最长可行窗口。','时间O(n)，辅助空间O(1)。',[('00010',1),('1001',2),('11101010110011',2)],'答案依次4、4、8；可以直接翻转最后两个0段得到长度8，不必采用来源中的复杂重叠操作。',on_random,[(('01'*100000,1),3),(('0'*200000,1),200000),(('01'*100000,200000),200000)],lambda x:x[0]+'\n'+str(x[1])+'\n',on_oracle,
'''def solve(d):
    s=d[0];k=int(d[1]);left=groups=answer=0
    for right,c in enumerate(s):
        if c=='0' and (right==0 or s[right-1]=='1'):groups+=1
        while groups>k:
            if s[left]=='0' and (left==right or s[left+1]=='1'):groups-=1
            left+=1
        answer=max(answer,right-left+1)
    return str(answer)
''',[('把每个0当一次操作',"if c=='0' and (right==0 or s[right-1]=='1'):","if c=='0':"),('预算少一', 'k=int(d[1])','k=max(0,int(d[1])-1)')],200020)
def discount_oracle(a):
    def valid(v):
        if v<1:return False
        while v%3==0:v//=3
        return v==1
    return sum(valid(a[i]+a[j]) for i in range(len(a)) for j in range(i+1,len(a)))
add(201,'价格和为3的幂的商品对数','统计不同下标i<j的商品对，使price[i]+price[j]等于3^e，e为非负整数，包括3^0=1。相同价格的不同商品按不同下标组合计数。','第一行n，第二行价格。原文未给数值界，本站1≤n≤200000，0≤价格≤10^9。','枚举不超过最大可能和的3的幂。顺序扫描价格，查询此前每个补数的出现次数后，再加入当前价格。','合法对有唯一较大下标j及唯一目标幂，处理j时另一价格必为该幂减当前价格，频次查询计入所有此前身份。查询后再插入避免同一商品自配，所有合法对只计一次。','时间O(n log₃V)，空间O(n)，V为最大价格。',[[2,1,8],[0,1,1],[1,1,2,2]],'答案依次2、2、4。',lambda r:[r.randint(0,30) for _ in range(r.randint(1,12))],[([0]*100000+[1]*100000,10**10),([10**9]*200000,0),([1]*100000+[2]*100000,10**10)],arr,discount_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));powers=[];p=1
    while p<=2*max(a):powers.append(p);p*=3
    seen={};answer=0
    for v in a:
        for p in powers:answer+=seen.get(p-v,0)
        seen[v]=seen.get(v,0)+1
    return str(answer)
''',[('漏掉3的0次幂','powers=[];p=1','powers=[];p=3'),('价格身份去重','seen[v]=seen.get(v,0)+1','seen[v]=1')],2200030,time=8)
add(202,'重排后的最多严格上升相邻位置','任意重排全部整数，最大化满足a[i]<a[i+1]的相邻位置数量，不是最长递增子序列。','第一行n，第二行分数。2≤n≤200000，1≤分数≤200000。','答案为n减去单个数值的最大出现次数。','把排列按非上升边切成严格递增段，同值不能出现在同一段，所以段数至少为最大频次F，上升边至多n−F。将每种值的出现分配到F行中，每行最多一次，并把各行排序；频次F的某值存在于每行，前行末项≥该值≥后行首项，所以行间不产生上升边，恰有n−F条，达到上界。','时间O(n)，空间O(n)。',[[2,1,3],[2,1,1,2],[5,5]],'答案依次2、2、0；第二例排列1,2,1,2的上升位置为0和2，来源写0和1有误。',lambda r:[r.randint(1,4) for _ in range(r.randint(2,7))],[([200000]*200000,0),(list(range(1,200001)),199999),([1,2]*100000,100000)],arr,lambda a:max(sum(x<y for x,y in zip(p,p[1:])) for p in set(permutations(a))),
'''def solve(d):
    from collections import Counter
    a=list(map(int,d[1:]));return str(len(a)-max(Counter(a).values()))
''',[('只统计不同值','len(a)-max(Counter(a).values())','len(set(a))-1'),('误认为所有边均可上升','len(a)-max(Counter(a).values())','len(a)-1')],1400030)
def information_oracle(x):
    words,k=x;best=-1
    for i in range(len(words)):
        for j in range(i):
            remaining=list(words[j]);common=0
            for c in words[i]:
                if c in remaining:remaining.remove(c);common+=1
            if common<=k:best=max(best,abs(len(words[i])-len(words[j])))
    return best
add(203,'公共字符受限的最大信息增益','从n个小写字符串中选两个不同下标。公共特征数为按重数计算的公共字符数，即各字母较小频次之和，aa和aaa的公共特征数为2。公共特征数≤K时合法，最大化两串长度差绝对值。原文未定义无合法对返回值，本站补充输出−1，合法但长度相同输出0。','第一行n K，随后n行小写串。2≤n≤1000，1≤串长≤1000，1≤K≤1000。','预先统计26字母频率，枚举不同字符串对，公共重数合格则更新长度差最大值。','每个字母最多能匹配两串频次较小者那么多，且不同字母独立，所以频次较小值之和恰为公共特征数。枚举所有不同下标对穷尽可选方案，合格者取最大，未遇合法对时按本站约定返回−1。','时间O(总字符数+26n²)，空间O(26n)。',[(['abc','bcd','zzzz'],1),(['aa','aaa'],1),(['abc','xyz'],1)],'答案依次1、−1、0；第二例公共字符为2，不是1种字母。',lambda r:([''.join(r.choice('abc') for _ in range(r.randint(1,8))) for _ in range(r.randint(2,8))],r.randint(1,5)),[((['z'*1000]*1000,999),-1),((['a']+['b'*1000]*999,1000),999),((['a'*1000]*1000,1000),0)],lambda x:f'{len(x[0])} {x[1]}\n'+'\n'.join(x[0])+'\n',information_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);words=d[2:];freq=[]
    for word in words:
        row=[0]*26
        for c in word:row[ord(c)-97]+=1
        freq.append(row)
    answer=-1
    for i in range(n):
        for j in range(i):
            diff=abs(len(words[i])-len(words[j]))
            if diff<=answer:continue
            common=0
            for a,b in zip(freq[i],freq[j]):
                common+=min(a,b)
                if common>k:break
            if common<=k:answer=max(answer,diff)
    return str(answer)
''',[('按字母种类去重','common+=min(a,b)','common+=int(a>0 and b>0)'),('错误排除阈值相等','if common<=k:','if common<k:')],1001030,time=8)
def pairs_oracle(x):return max(sum(v>w for v,w in zip(x[0],p)) for p in permutations(x[1]))
add(204,'前端严格胜过后端的最多服务器对','两组服务器各n台，每台最多用一次。可自由配对，只有前端质量严格大于后端的对才计入，求最多对数。','第一行n，第二行前端质量，第三行后端质量。原文未给数值界，本站1≤n≤100000，1≤质量≤10^9。','两组排序，依次用最小能胜过当前最小后端的前端完成一对。','过小前端不能胜过当前最小后端，也不能胜过任何剩余后端，可以丢弃。能胜过时，交换某最优方案配对，使当前两者成对不会减少成功对数，重复得到最优。','时间O(n log n)，空间O(n)。',[([3,1,5],[2,2,4]),([2,2],[2,2]),([10],[1])],'答案依次2、0、1，相等不算成功。',lambda r:([r.randint(1,9) for _ in range(n)],[r.randint(1,9) for _ in range(n)]) if (n:=r.randint(1,7)) else None,[(([10**9]*100000,[10**9]*100000),0),(([10**9]*100000,[1]*100000),100000)],lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n',pairs_oracle,
'''def solve(d):
    n=int(d[0]);a=sorted(map(int,d[1:1+n]));b=sorted(map(int,d[1+n:]));j=0
    for v in a:
        if j<n and v>b[j]:j+=1
    return str(j)
''',[('相等也计成功','v>b[j]','v>=b[j]'),('前端不排序','a=sorted(map(int,d[1:1+n]))','a=list(map(int,d[1:1+n]))')],2200030)
def programs_oracle(x):
    a,m,k=x
    # Enumerate all contiguous partitions, independently of next-fit scheduling.
    for start in range(len(a)):
        b=a[start:]
        for mask in range(1<<(len(b)-1)):
            if mask.bit_count()+1>m:continue
            cuts=[0]+[i+1 for i in range(len(b)-1) if mask>>i&1]+[len(b)]
            if all(sum(b[l:r])<=k for l,r in zip(cuts,cuts[1:])):return len(b)
    return 0
def programs_random(r):
    k=r.randint(1,9);return [r.randint(1,k) for _ in range(r.randint(1,9))],r.randint(1,5),k
add(205,'固定时隙内可执行的最长程序后缀','只允许从开头删除若干程序，保留一个后缀。后缀按原序执行，每个程序不能中断；每个时隙长度k，放得下就必须在当前时隙执行，否则进入下一时隙。最多m个时隙，求可执行的最长后缀长度。','第一行n m k，第二行程序耗时。1≤n,m≤200000；1≤k≤10^9；原文完整约束为1≤time[i]≤k。','二分后缀起点，用从左到右的题定算法统计所需时隙数。删除更多前缀不会增加最少时隙数。','固定起点时，将当前时隙尽量填满的贪心，其第一个分段末尾不早于任何其他合法分段；逐段归纳得到最少分段数。删除前缀可沿用剩余合法分段，再用贪心只会更少，因此可行起点呈后缀单调，二分找到最早起点即最长程序后缀。','时间O(n log n)，空间O(n)。',[([5,2,1,4,2],2,6),([4,2,3,4,1],1,4),([1,2,3,1,1],3,3)],'答案依次4、1、5。第二例不能挑中间更长区间，必须包含最后程序。',programs_random,[(([10**9]*200000,200000,10**9),200000),(([10**9]*200000,1,10**9),1),(([1]*200000,1,10**9),200000)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n',programs_oracle,
'''def solve(d):
    n,m,k=map(int,d[:3]);a=list(map(int,d[3:]))
    def valid(start):
        slots=1;used=0
        for i in range(start,n):
            v=a[i]
            if used+v>k:slots+=1;used=0
            used+=v
            if slots>m:return False
        return True
    lo=0;hi=n
    while lo<hi:
        mid=(lo+hi)//2
        if valid(mid):hi=mid
        else:lo=mid+1
    return str(n-lo)
''',[('恰好填满也换时隙','if used+v>k:','if used+v>=k:'),('错误只检查总耗时','if valid(mid):','if sum(a[mid:])<=m*k:')],2200060,time=8)
def racers_oracle(x):
    a,k=x;best=0
    for mask in range(1<<len(a)):
        if mask.bit_count()>k:continue
        remaining=[v for i,v in enumerate(a) if not(mask>>i&1)];last=None;run=0
        for v in remaining:run=run+1 if v==last else 1;last=v;best=max(best,run)
    return best
add(206,'删除至多k人后的最长同速连续队伍','最多删除k名选手，剩余选手保持相对次序，求剩余序列中同一速度的最长连续段人数。删除人数不计入答案。','第一行n k，第二行速度。1≤n≤300000，1≤k≤n。原文没有速度数值界，本站速度1..10^9。','按速度保存出现下标。每组下标上滑窗，内部需删除人数为positions[r]−positions[l]−(r−l)，保持不超过k。','若保留同速的第l到r次出现，则两端间所有其他速度必须删除，所需恰为总跨度减同速人数；删除这些人即可连续。最优段不需要删除其内部同速者，所以只须考虑每组连续出现次数，双指针穷尽合法最长窗口。','时间O(n)，空间O(n)。',[([1,4,4,2,2,4],2),([1,2,3],3),([5,5,5],1)],'答案依次3、1、3。',lambda r:([r.randint(1,4) for _ in range(n)],r.randint(1,n)) if (n:=r.randint(1,10)) else None,[(([10**9]*300000,1),300000),(([1,2]*150000,300000),150000),((list(range(1,300001)),300000),1)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',racers_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);groups={}
    for i,v in enumerate(map(int,d[2:])):groups.setdefault(v,[]).append(i)
    answer=0
    for p in groups.values():
        left=0
        for right in range(len(p)):
            while p[right]-p[left]-(right-left)>k:left+=1
            answer=max(answer,right-left+1)
    return str(answer)
''',[('把删除人数也计入','answer=max(answer,right-left+1)','answer=max(answer,p[right]-p[left]+1)'),('阈值相等也缩窗','-(right-left)>k','-(right-left)>=k')],3300040,time=8)
def skill_oracle(x):
    skills,types=x;best=0
    for i in range(len(skills)):
        for j in range(i+1,len(skills)+1):
            if sum(types[i:j])*2==j-i:best=max(best,sum(skills[i:j]))
    return best
add(207,'两类员工等人数的最大连续技能和','员工按下标排列，expertise为0或1。选一个连续区间，使两类员工人数相等，并最大化技能总和。允许不选任何人，得0。','第一行n，第二行n个技能值，第三行n个0/1专业标记。原文未给数值界，本站1≤n≤200000，−10^9≤技能≤10^9。','把专业1记+1、0记−1，维护人数差前缀。对每个人数差保存最小技能前缀和，用当前技能和减这个最小值更新答案。','两端人数差前缀相等恰好表示区间两类人数相等。固定右端时其技能和固定，减去同人数差的最小历史技能前缀得到最大区间和，其他历史点不可能更好。初始答案0包含空队伍，允许负技能时不能只记最早下标。','时间O(n)，空间O(n)。',[([2,3,5],[0,1,1]),([-5,-5,8,9],[0,1,0,1]),([-1,-2],[0,1])],'答案依次5、17、0。',lambda r:([r.randint(-8,10) for _ in range(n)],[r.randrange(2) for _ in range(n)]) if (n:=r.randint(1,12)) else None,[(([10**9]*200000,[0,1]*100000),200000000000000),(([-10**9]*100000+[10**9]*100000,[0,1]*100000),100000000000000),(([10**9]*200000,[1]*200000),0)],lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n',skill_oracle,
'''def solve(d):
    n=int(d[0]);skills=list(map(int,d[1:1+n]));types=list(map(int,d[1+n:]));minimum={0:0};balance=total=answer=0
    for value,t in zip(skills,types):
        balance+=1 if t else -1;total+=value
        if balance in minimum:answer=max(answer,total-minimum[balance]);minimum[balance]=min(minimum[balance],total)
        else:minimum[balance]=total
    return str(answer)
''',[('只记第一次前缀','minimum[balance]=min(minimum[balance],total)','minimum[balance]=minimum[balance]'),('把两类同向累加','balance+=1 if t else -1','balance+=1')],2800040)
def stability_oracle(x):
    reliability,availability=x;n=len(reliability)
    return max(sum(reliability[i] for i in range(n) if mask>>i&1)*min(availability[i] for i in range(n) if mask>>i&1) for mask in range(1,1<<n))%1000000007
add(208,'服务器子集的最大稳定性','选择任意非空服务器子集，稳定性为最小availability乘以reliability总和。先最大化完整整数稳定性，再对1000000007取模。来源第二例输出5来自不相关解释，按定义更正为456。','第一行n，第二行reliability，第三行availability。2≤n≤100000；各值1..1000000。','按availability递减处理，累计reliability，比较当前availability乘累计和。','固定最小availability阈值时，所有不低于阈值的服务器均可加入，且正reliability使加入不会减小稳定性。某最优子集的最小availability是一个实际值，扫描到该值全部成员时得到至少同样好的候选；所有候选本身可行，所以最大候选即最优。','时间O(n log n)，空间O(n)，乘积用64位。',[([1,2,2],[1,1,3]),([75,104,72,72,8,125],[1,2,2,1,2,1]),([2,3],[5,5])],'答案依次6、456、25。第二例选择全部服务器，可靠性和456、最小可用性1。',lambda r:([r.randint(1,15) for _ in range(n)],[r.randint(1,10) for _ in range(n)]) if (n:=r.randint(2,9)) else None,[(([1000000]*100000,[1000000]*100000),10**17%1000000007),(([1000000,1],[1000000,1]),10**12%1000000007)],lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n',stability_oracle,
'''def solve(d):
    n=int(d[0]);reliability=list(map(int,d[1:1+n]));availability=list(map(int,d[1+n:]));total=answer=0
    for value,r in sorted(zip(availability,reliability),reverse=True):total+=r;answer=max(answer,value*total)
    return str(answer%1000000007)
''',[('先取模再比较','answer=max(answer,value*total)','answer=max(answer,value*total%1000000007)'),('按availability升序','reverse=True','reverse=False')],1600030)
def tasks_oracle(x):
    mandatory,optional,limit=x
    return max(sum(a+b<=limit for a,b in zip(mandatory,p)) for p in permutations(optional))
def tasks_random(r):
    n=r.randint(1,7);limit=r.randint(1,12);return [r.randint(1,limit) for _ in range(n)],[r.randint(1,limit) for _ in range(n)],limit
add(209,'每天必做任务之外最多安排几个选做任务','有n个必做任务与n个选做任务，每任务至多做一次。每天恰安排一个必做任务，可再安排至多一个选做任务，两者耗时和不得超过H，求n天最多完成几个选做任务。','第一行n H，第二行必做耗时，第三行选做耗时。1≤n,H≤200000；两类耗时均在1..H。','每个必做任务转成剩余容量H−耗时。容量和选做耗时分别升序，用当前最小选做任务匹配能容纳它的最小容量。','容量不足以装最小任务时，也装不下任何其他选做任务，可跳过。足够时，存在最优方案匹配这两个最小可用元素：若原方案交叉匹配可交换而保持可行，否则直接补入不降低数量。反复执行得到最大匹配。','时间O(n log n)，空间O(n)。',[([4,5,2,4],[5,6,3,4],7),([1,1],[1,1],2),([3],[1],3)],'答案依次2、2、0；恰好等于每天上限可以安排。',tasks_random,[(([1]*200000,[199999]*200000,200000),200000),(([200000]*200000,[1]*200000,200000),0)],lambda x:f'{len(x[0])} {x[2]}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',tasks_oracle,
'''def solve(d):
    n,h=map(int,d[:2]);capacity=sorted(h-int(v) for v in d[2:2+n]);optional=sorted(map(int,d[2+n:]));j=0
    for cap in capacity:
        if j<n and optional[j]<=cap:j+=1
    return str(j)
''',[('不允许恰好填满','optional[j]<=cap','optional[j]<cap'),('选做任务不排序','optional=sorted(map(int,d[2+n:]))','optional=list(map(int,d[2+n:]))')],2800040)
def throughput_oracle(a):
    @lru_cache(None)
    def dfs(state):
        if len(state)<3:return 0
        best=dfs(state[1:])
        for j,k in combinations(range(1,len(state)),2):
            selected=sorted([state[0],state[j],state[k]]);rest=tuple(v for i,v in enumerate(state) if i not in (0,j,k));best=max(best,selected[1]+dfs(rest))
        return best
    return dfs(tuple(a))
add(210,'三台一组的最大中位数吞吐量和','每组三台服务器，组吞吐量为三者中位数。每台最多加入一组，可不用某些服务器，求全部组吞吐量之和最大值。','第一行n，第二行吞吐量。1≤n≤200000，1≤吞吐量≤10^9。','排序后最多形成floor(n/3)组，从最大端依次拿两台，其中较小者贡献中位数，再为该组配一台剩余最小服务器。','形成q组时，将组中位数降序排列，第j个中位数至少需要2j台服务器不小于它，所以其上界为全局第2j大值。选择最大的2q台相邻两两配对，再加入q台较小服务器，能同时达到所有上界。所有值正，q越大该上界和越大，故取floor(n/3)。','时间O(n log n)，空间O(n)，答案用64位。',[[4,6,3,5,4,5],[2,3,4,3,4],[9,1]],'答案依次9、4、0。不足三台时不能成组。',lambda r:[r.randint(1,12) for _ in range(r.randint(1,9))],[([10**9]*200000,66666000000000),(list(range(1,200001)),sum(199999-2*i for i in range(66666)))],arr,throughput_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]));n=len(a)
    return str(sum(a[n-2-2*i] for i in range(n//3)))
''',[('每组选最大值','a[n-2-2*i]','a[n-1-2*i]'),('固定按连续三台一组','a[n-2-2*i]','a[3*i+1]')],2200030)
def rectangle_oracle(a):
    @lru_cache(None)
    def dfs(state):
        if len(state)<4:return 0
        best=dfs(state[1:])
        for rest in combinations(range(1,len(state)),3):
            ids=(0,)+rest;v=[state[i] for i in ids];area=0
            for j in range(1,4):
                others=[p for p in range(1,4) if p!=j];x,y=others
                if abs(v[0]-v[j])<=1 and abs(v[x]-v[y])<=1:area=max(area,min(v[0],v[j])*min(v[x],v[y]))
            if area:best=max(best,area+dfs(tuple(v for i,v in enumerate(state) if i not in ids)))
        return best
    return dfs(tuple(a))%1000000007
add(211,'每根至多缩短1后的最大矩形总面积','每根木棒可不用或用于至多一个矩形，每根长度最多减少1，不能增加。每矩形必须用四根木棒，组成两对相等边，正方形也合法。先最大化全部矩形面积总和，再对1000000007取模。','第一行n，第二行棒长。1≤n≤100000，2≤棒长≤10000。','长度降序，若当前两根差≤1就配成较短长度的一条成对边，否则弃掉最大根。取得降序成对边后，最大两边组成矩形，继续向后。','若最大两棒差>1，最大棒无法匹配任何剩余棒，必须舍弃。若差≤1，可交换最优配对使它们成对：两棒原先各有伙伴时，交换后其伙伴仍相差至多1；所得最大成对边不减，剩余成对边也不减。只有一棒有伙伴时直接换为两最大棒也不劣。因此贪心得到逐项不小的降序成对边。对a≥b≥c≥d，ab+cd≥ac+bd且≥ad+bc，故最大两边相邻组合最优，奇数条成对边则舍弃最小。面积优化在取模之前。','时间O(n log n)，空间O(n)。',[[2,6,2,6,3,5],[2,3,3,4,6,8,8,6],[3,4,5,5,6]],'答案依次12、54、20。第三例6与5配成5，另一5与4配成4，面积20。',lambda r:[r.randint(2,8) for _ in range(r.randint(1,9))],[([10000]*100000,(25000*10**8)%1000000007),([9999,10000]*50000,(25000*9999**2)%1000000007),([2]*100000,100000)],arr,rectangle_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]),reverse=True);pairs=[];i=0
    while i+1<len(a):
        if a[i]-a[i+1]<=1:pairs.append(a[i+1]);i+=2
        else:i+=1
    answer=sum(pairs[i]*pairs[i+1] for i in range(0,len(pairs)-1,2))
    return str(answer%1000000007)
''',[('不允许缩短1','a[i]-a[i+1]<=1','a[i]-a[i+1]==0'),('较长棒作为边长','pairs.append(a[i+1])','pairs.append(a[i])')],600030)
def maximum_count_oracle(x):
    a,k=x;best=a.count(k)
    for i in range(len(a)):
        for j in range(i+1,len(a)+1):
            for delta in {k-v for v in a[i:j]}|{0}:best=max(best,sum(v+(delta if i<=p<j else 0)==k for p,v in enumerate(a)))
    return best
add(212,'一个区间加同一整数后的最多目标值','最多选择一次连续区间，给区间中每个数加同一个任意整数x，最大化整个数组中等于k的元素数量。x可以为负数或0，也可以不操作。','第一行n k，第二行数组。1≤n≤200000；1≤元素,k≤200000。','若把某个v≠k变成k，窗口内每个v收益+1，每个原k收益−1，其他值0。维护每个v上次出现时的最优段收益，以及当时累计k数，用累计差惰性扣除中间k，再做Kadane重启。','固定非零增量只会把唯一v=k−x变成k，并使原k消失，所以净收益定义精确。最优正收益段可取首尾都是v，两个v之间仅k造成扣分。处理新v时，选择重新从1开始或延续此前最优收益减中间k数再加1，恰是该v的Kadane转移。对每个v只在出现时更新，总访问n次，最大净收益加原k数就是答案。','时间O(n)，空间O(n)。',[([2,3,2,4,3,2],2),([6,4,4,6,4,4],6),([1,1,1],1)],'答案依次4、5、3。',lambda r:([r.randint(1,6) for _ in range(r.randint(1,11))],r.randint(1,6)),[((list(range(1,200001)),200000),2),(([1,2]*100000,1),100001),(([2]*200000,1),200000)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',maximum_count_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));count=best=0;states={}
    for v in a:
        if v==k:count+=1
        else:
            old,previous=states.get(v,(0,count));gain=max(1,old-(count-previous)+1);states[v]=(gain,count);best=max(best,gain)
    return str(count+best)
''',[('不扣除区间原目标','old-(count-previous)+1','old+1'),('忽略区间外目标','return str(count+best)','return str(best)')],1400040)
def products_oracle(a):
    # Enumerate picked amounts forward, all starts and all stopping points.
    best=0
    def visit(i,previous,total):
        nonlocal best
        best=max(best,total)
        if i==len(a):return
        for take in range(previous+1,a[i]+1):visit(i+1,take,total+take)
    for start in range(len(a)):visit(start,0,0)
    return best
add(214,'连续货堆严格递增取货的最大总数','选择一个非空连续区间，从每个货堆取不超过该堆容量的正整数件，且取货数从左到右严格递增，求最多能取多少件。取0的前缀对总量无贡献，可直接去掉，所以不影响最优答案。','第一行n，第二行货堆容量。1≤n≤5000，1≤容量≤10^9。','枚举右端点，右端全取；向左每次取min(本堆容量,右邻所取−1)，变成0时停止，记录累计最大值。','固定右端时，最右堆取越多只会放宽左边限制，因此存在最优方案将它取满。固定右侧取数后，当前最大合法值是min(容量,右值−1)，增大当前取数不会损害左侧可行性，反向归纳得到逐项最大方案。继续向左加入正数只增加总量，遇到0后更左也不能取正数。枚举全部右端包含全局最优。','时间O(n²)，空间O(n)，答案可达约5×10^12，需64位。',[[7,4,5,2,6,5],[2,9,4,7,5,2],[2,5,6,7]],'答案依次12、16、20。',lambda r:[r.randint(1,8) for _ in range(r.randint(1,8))],[([10**9]*5000,5000*10**9-5000*4999//2),([1]*5000,1),(list(range(1,5001)),5000*5001//2)],arr,products_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));answer=0
    for right in range(len(a)):
        limit=a[right]+1;total=0
        for left in range(right,-1,-1):
            limit=min(a[left],limit-1)
            if limit<=0:break
            total+=limit
        answer=max(answer,total)
    return str(answer)
''',[('错误允许相等','limit=min(a[left],limit-1)','limit=min(a[left],limit)'),('只取原本递增的堆','limit=min(a[left],limit-1)','limit=a[left] if a[left]<limit else 0')],55020,time=10)
def adjustments_oracle(x):
    a,budget=x
    for amount in range(1,max(a)+1):
        spent=0
        for value in a:
            while value>0:value-=amount;spent+=1
        if spent<=budget:return amount
add(215,'有限调整次数内清空评分的最小减量','每次选择一个正评分并减去固定正整数x。要求至多M次后所有评分≤0，求最小x。原文示例把另一数组的过程混入，本题给定[4,3,2,7]、M=5的正确答案是4。','第一行n M，第二行评分。1≤n≤100000，1≤评分≤10^9，n≤M≤10^9。','二分x。评分v需要ceil(v/x)次操作，求全部需求和是否≤M。','单个评分每次只减少x，至少需要向上取整的次数，反复操作即可达到。各评分独立，需求相加得到恰好最少次数。x增大时各项需求不增，故可行性单调；x=max评分时最多n次，保证可行，二分得到最小值。','时间O(n log max评分)，空间O(n)，次数累计使用64位。',[([4,3,2,7],5),([1,2,3],6),([10,10],2)],'答案依次4、1、10。第一例x=3需要2+1+1+3=7次，x=4需要1+1+1+2=5次。',lambda r:([r.randint(1,20) for _ in range(n)],r.randint(n,n*20)) if (n:=r.randint(1,8)) else None,[(([10**9]*100000,100000),10**9),(([10**9]*100000,10**9),100000),(([1]*100000,10**9),1)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',adjustments_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:]));lo=1;hi=max(a)
    while lo<hi:
        mid=(lo+hi)//2;needed=sum((v+mid-1)//mid for v in a)
        if needed<=m:hi=mid
        else:lo=mid+1
    return str(lo)
''',[('需求向下取整','(v+mid-1)//mid','v//mid'),('错误只检查总量','sum((v+mid-1)//mid for v in a)','(sum(a)+mid-1)//mid')],1100040,time=8)

for spec in base.SPECS:
    if spec['n']==200:
        spec['proof']='把每次翻转区间与目标窗口求交，并在窗口外补0，则希望得到的翻转奇偶串正好在原0段处为1。若有r个0段，该奇偶串有2r个变化边界；一次区间异或仅能提供2个边界，因此至少需要r次，重叠操作也不能突破下界。分别翻转每个0段恰好达到下界。0段数量随右扩不减，滑窗保持不超过k，求出每个右端的最长合法窗口。'
    if spec['n']==211:
        # Sorting lets equal 10000 sticks pair together; original input adjacency
        # places no restriction on rectangle assembly.
        spec['edges'][1]=([9999,10000]*50000,(12500*(10000**2+9999**2))%1000000007)

def main():
    base.main()
    path=base.OUT/'reviews'/f'{base.BATCH}.json';data=json.loads(path.read_text())
    for item in data['items']:
        if item['id']=='oa-amazon-203':item['reason']+=' 无合法对输出−1仅为本站补充I/O协议，不伪称来源规定，合法零增益仍输出0。'
    data['items'].append(dict(id='oa-amazon-213',status='blocked',reason='重新核对e66f809原文，三段是否共享峰谷转折点、是否必须各有严格变化、是否允许空段仍未定义。n可为2，而三段必非空与允许退化会改变最优长度，不是仅无解返回协议问题，不擅定核心规则。'))
    data['items'].sort(key=lambda x:int(x['id'].split('-')[-1]));path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
