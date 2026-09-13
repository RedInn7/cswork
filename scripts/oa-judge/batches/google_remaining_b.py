"""Independently authored Google 41–60; imported OA code is never executed."""
import collections
import functools
import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'
BATCH='google-remaining-b'
SEED=20260941

def array(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def top_oracle(x):
    a,k=x;return str(max(map(sum,itertools.combinations(a,k))))
def moves_oracle(a):
    def visit(a,target):
        if len(a)<2:return 0
        choices=[(a[0]+a[1],a[2:]),(a[-2]+a[-1],a[:-2]),(a[0]+a[-1],a[1:-1])]
        return max([0]+[1+visit(rest,value) for value,rest in choices if target is None or value==target])
    return str(visit(a,None))
def time_oracle(pattern):
    matches=[]
    for minute in range(1440):
        candidate=f'{minute//60:02}:{minute%60:02}'
        if all(a=='?' or a==b for a,b in zip(pattern,candidate)):matches.append(candidate)
    return max(matches)
def time_random(r):
    minute=r.randrange(1440);s=f'{minute//60:02}:{minute%60:02}'
    return ''.join('?' if c!=':' and r.randrange(2) else c for c in s)
def sign_oracle(a):
    return str(min([abs(sum(a))]+[abs(sum(a[:i]+[-a[i]]+a[i+1:])) for i in range(len(a))]))
def load_oracle(a):
    return str(min(abs(sum(v if mask>>i&1 else -v for i,v in enumerate(a))) for mask in range(1<<len(a))))
def cars_output(cars):return str(len(cars))+'\n'+'\n'.join(f'{i}: '+' '.join(f'({p},{r})' for p,r in car) for i,car in enumerate(cars))
def cars_oracle(requests):
    cars=[]
    for start,end in sorted(requests):
        available=[i for i,car in enumerate(cars) if car[-1][1]<=start]
        if available:cars[min(available)].append((start,end))
        else:cars.append([(start,end)])
    return cars_output(cars)
def flips_oracle(x):
    s,k=x;n=len(s);seen={s};queue=collections.deque([(s,0)])
    while queue:
        s,d=queue.popleft()
        if all(a!=b for a,b in zip(s,s[1:])):return str(d)
        for i in range(n-k+1):
            next_s=s[:i]+''.join('1' if c=='0' else '0' for c in s[i:i+k])+s[i+k:]
            if next_s not in seen:seen.add(next_s);queue.append((next_s,d+1))
    return '-1'
@functools.lru_cache(None)
def partitions(value,minimum=1):
    if value==0:return [()]
    return [(first,)+rest for first in range(minimum,value+1) for rest in partitions(value-first,first)]
def splits_oracle(a):
    @functools.lru_cache(None)
    def visit(i,previous):
        if i==len(a):return 0
        return min([10**9]+[len(parts)-1+visit(i+1,parts[-1]) for parts in partitions(a[i]) if parts[0]>=previous])
    return str(visit(0,1))
def swaps_oracle(x):
    a,b=x;best=len(a)+1
    for mask in range(1<<len(a)):
        first=[b[i] if mask>>i&1 else a[i] for i in range(len(a))];second=[a[i] if mask>>i&1 else b[i] for i in range(len(a))]
        if all(first[i]<first[i+1] and second[i]<second[i+1] for i in range(len(a)-1)):best=min(best,mask.bit_count())
    return str(best if best<=len(a) else -1)
def booking_oracle(ops):
    rooms=sorted({op[1:] for op in ops})
    return min(rooms,key=lambda room:(-sum(op=='+'+room for op in ops),room))
def booking_random(r):
    occupied=set();ops=[];rooms=[f'{f}{letter}' for f in range(3) for letter in 'ABC']
    for _ in range(r.randint(1,50)):
        room=r.choice(rooms)
        if room in occupied:ops.append('-'+room);occupied.remove(room)
        else:ops.append('+'+room);occupied.add(room)
    return ops
def bits_oracle(s):
    @functools.lru_cache(None)
    def visit(s):
        best=0
        for i in range(len(s)-1):
            if s[i:i+2]!='10':continue
            j=i+1
            while j+1<len(s) and s[j+1]=='0':j+=1
            changed=s[:i]+'0'*(j-i)+'1'+s[j+1:]
            best=max(best,1+j-i+visit(changed))
        return best
    return str(visit(s))

SPECS=[
dict(id=42,title='选取 k 项的最大总功率',tags=['排序'],description='从功率数组中选出恰好 k 个不同下标的元素，使它们的和最大，输出最大和。重复数值可以按不同下标分别选择。原站首例给出13，与“最大和”规则冲突，正确结果为19。',input='第一行 n k（1≤k≤n≤100000），第二行 n 个整数功率（1..10⁹）。',idea='按从大到小排序，求前 k 项之和，使用64位整数。',proof='若选中的元素小于未选中的元素，交换二者会增加总和。因此最优方案可以且必须取得最大的k项（相等项互换不影响答案）。',complexity='时间 O(n log n)，空间 O(n)。',samples=[([1,2,3,10,9],2),([5,5,1],2),([7],1)],explanation='样例1：选10和9，和19，原站13不是最大值。样例2：两个5来自不同下标，可以都选，和10。样例3：只能选择唯一的7。',random=lambda r:(lambda a:(a,r.randint(1,len(a))))([r.randint(1,30) for _ in range(r.randint(1,9))]),edges=[(([10**9]*100000,100000),str(10**14)),((list(range(1,100001)),1),'100000')],encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=top_oracle,code='''def solve(data):
    n,k=map(int,data[:2]);a=sorted(map(int,data[2:]),reverse=True)
    return str(sum(a[:k]))
''',mutants=[('误选最小k项','reverse=True','reverse=False'),('漏掉一项','a[:k]','a[:k-1]')]),
dict(id=43,title='相同删除和的最多操作数',tags=['区间动态规划'],description='每次只能删除当前数组最前两个、最后两个，或首尾各一个元素。删除元素之和是本次结果，要求所有操作结果相同。求最多操作次数；不足两个元素时不能操作。',input='本站标准输入：第一行 n（1..2000），第二行 n 个整数（−10⁹..10⁹）。',idea='第一次删除和只可能是三个候选值。固定每个值，按剩余区间长度做动态规划；三个删除方向分别转移到缩短2的区间，用滚动数组保存前一层。',proof='任何合法首次操作属于三种方向，其和必在候选中。固定和后，区间状态的首步仍只有三种，合法方向得到1加剩余区间最优次数。按长度递增完整求解，最后取三个候选的最大值即覆盖全部可能序列。',complexity='时间 O(n²)，空间 O(n)。',timeLimit=6,samples=[[3,1,5,3,3,4,2],[4,1,4,3,3,2,5,2],[1,9,1,1,1,1,1,1,8,1]],explanation='样例1：依次删除末尾4+2、首尾3+3、开头1+5，共3次且每次和6。样例2：连续四次删除首尾，每次和6，共4次。样例3：可做一次，但任意首次操作后都无法继续维持相同和，答案1。',random=lambda r:[r.randint(-3,5) for _ in range(r.randint(1,10))],edges=[(([1]*2000),'1000'),(([1]*1999),'999'),(([10**9,-10**9]*1000),'1000')],encode=array,oracle=moves_oracle,code='''def solve(data):
    a=list(map(int,data[1:]));n=len(a)
    if n<2:return '0'
    answer=0
    for target in {a[0]+a[1],a[-2]+a[-1],a[0]+a[-1]}:
        previous=[0]*(n+2)
        for length in range(2+n%2,n+1,2):
            current=[0]*(n+2)
            for left in range(n-length+1):
                right=left+length-1;best=0
                if a[left]+a[left+1]==target:best=max(best,1+previous[left+2])
                if a[right-1]+a[right]==target:best=max(best,1+previous[left])
                if a[left]+a[right]==target:best=max(best,1+previous[left+1])
                current[left]=best
            previous=current
        answer=max(answer,previous[0])
    return str(answer)
''',mutants=[('不允许删除尾部两项','if a[right-1]+a[right]==target:','if False:'),('首尾和使用首项两次','if a[left]+a[right]==target:','if a[left]+a[left]==target:')]),
dict(id=44,title='补全最大的合法时间',tags=['贪心'],description='输入24小时制 hh:mm，将所有 ? 换成数字，使时间最大。已有数字不能改变；保证至少有一种合法补全。合法时间从00:00到23:59。原站 ?2:22 的结果23:22改变了固定数字，本站校正为22:22。',input='一行长度5的模式 hh:mm，各数位为数字或 ?，中间固定为冒号。',idea='从高位到低位选最大可行数字。小时十位能取2时取2，否则取1；再由小时十位决定个位上限。分钟十位取5、个位取9。',proof='时间比较等价于数位字典序比较。每步保留已定数位，取仍存在合法后缀的最大数位，使第一个不同位尽量大。小时约束只涉及两位，分钟上限独立，因此这些选择得到最大合法时间。',complexity='时间与空间 O(1)。',samples=['?4:5?','23:5?','?2:22'],explanation='样例1：小时十位不能取2（24不合法），只能取1，分钟末位取9，得到14:59。样例2：只补最后一位9，得到23:59。样例3：固定小时个位是2，补十位2得到22:22，不能改成23。',random=time_random,edges=[('??:??','23:59'),('0?:??','09:59'),('2?:??','23:59'),('00:00','00:00')],encode=lambda s:s+'\n',oracle=time_oracle,code='''def solve(data):
    s=list(data[0])
    if s[0]=='?':s[0]='2' if s[1]=='?' or s[1]<='3' else '1'
    if s[1]=='?':s[1]='3' if s[0]=='2' else '9'
    if s[3]=='?':s[3]='5'
    if s[4]=='?':s[4]='9'
    return ''.join(s)
''',mutants=[('小时十位永远填1',"s[0]='2' if s[1]=='?' or s[1]<='3' else '1'","s[0]='1'"),('分钟十位错误填9',"s[3]='5'","s[3]='9'")]),
dict(id=47,title='至多反号一次的最小绝对和',tags=['数组'],description='可以至多将一个元素乘以−1，输出得到的数组和的最小绝对值，也可以不修改。原站第二例解释和第四例答案有误，按本规则计算。',input='第一行 n（1..100000），第二行 n 个整数（−1000..1000）。',idea='先计算总和S，不改的候选是|S|。将元素x反号后总和为S−2x，扫描所有元素取最小绝对值。',proof='合法方案只有不修改或选择某个下标反号，扫描完整枚举所有方案；S−2x准确表示移除原x并加入−x后的总和。取最小值必最优。',complexity='时间 O(n)，除输入外空间 O(1)。',samples=[[1,3,2,5],[-4,0,-3,3],[4,-3,5,-7]],explanation='样例1：把5改成−5，总和1。样例2：应把−3改成3，总和2；原站把−4改成4的解释实际得到4。样例3：原和−1，保留数组最优，绝对值1。',random=lambda r:[r.randint(-20,20) for _ in range(r.randint(1,10))],edges=[(([1000]*100000),'99998000'),(([1000,-1000]*50000),'0'),(([-15,18,1,-1,10,-22]),'7')],encode=array,oracle=sign_oracle,code='''def solve(data):
    a=list(map(int,data[1:]));total=sum(a);answer=abs(total)
    for value in a:answer=min(answer,abs(total-2*value))
    return str(answer)
''',mutants=[('未考虑不修改','answer=abs(total)','answer=10**30'),('反号只减一次','total-2*value','total-value')]),
dict(id=51,title='两台服务器的最小负载差',tags=['动态规划','位运算'],description='把每个进程恰好分配给两台服务器中的一台，服务器负载为所分配整数负载之和。输出两台总负载差的最小绝对值，允许一台没有进程。',input='本站标准输入：第一行 n（1..2000），第二行 n 个整数负载，所有负载绝对值之和不超过200000。',idea='用整数位集合记录可达子集和；负载为负时同步移动表示区间的下界。最后找不超过总和一半的最大可达和。',proof='加入一个负载时，每个子集要么不选它、要么选它，位移并集完整表示新子集和。分给第一台的任意子集和x对应差|S−2x|。互补子集保证最优值可在x≤⌊S/2⌋中取得，在这一侧x越大越好。',complexity='设A为绝对值总和，时间约O(nA/w+A/w)，空间O(A/w)，w为大整数内部机器字宽。',samples=[[1,2,3,4,5],[7],[-3,1,2]],explanation='样例1：可分为负载7与8，差1；总和15为奇数，不可能差0。样例2：只能分为7和0，差7。样例3：所有项总和0，一台承接全部、另一台空，差0。',random=lambda r:[r.randint(-9,15) for _ in range(r.randint(1,10))],edges=[(([100]*2000),'0'),(([199999,1]),'199998'),(([-100000,100000]),'0')],encode=array,oracle=load_oracle,code='''def solve(data):
    a=list(map(int,data[1:]));bits=1;low=0
    for value in a:
        if value>=0:bits|=bits<<value
        else:bits=(bits<<(-value))|bits;low+=value
    total=sum(a);limit=total//2-low;reachable=bits&((1<<(limit+1))-1)
    chosen=reachable.bit_length()-1+low
    return str(abs(total-2*chosen))
''',mutants=[('位索引差一','chosen=reachable.bit_length()-1+low','chosen=reachable.bit_length()+low'),('只返回总和绝对值','return str(abs(total-2*chosen))','return str(abs(total))')]),
dict(id=53,title='租车请求的最少车辆规范分配',tags=['堆','区间'],description='每个请求为[pickup,return)，同刻归还的车可以立即用于新请求。先按pickup升序、再按return升序处理；有空闲车时使用编号最小的，否则新建下一编号（从0开始）。按车编号升序输出规范分配。',input='第一行 n（1..200000），随后 n 行pickup return（0≤pickup<return≤10⁹）。',output='第一行输出车辆数量；随后每辆车一行，格式 carId: (p1,r1) (p2,r2) ...，括号内不加空格，按该车服务时间先后列出请求。',idea='用忙碌最小堆按归还时间管理车辆，空闲最小堆按编号管理。每处理请求先释放所有已归还车辆，再取最小空闲编号或新车。',proof='只有归还时间≤pickup的车可复用，忙堆完整释放这批车。空闲堆恰好按规范给出最小编号。新建时所有已有车都在使用，当前重叠请求数量需要再增加一辆，因此新建是必要的，最终数量最少。',complexity='时间O(n log n)，空间O(n+输出大小)。',outputLimit=16384,samples=[[(1,4),(2,3),(3,5)],[(0,1),(1,2),(2,3)],[(0,5),(0,3),(3,4)]],explanation='样例1：车0服务(1,4)，车1服务(2,3)、(3,5)，共2辆。样例2：同刻归还可复用，三单都由车0处理。样例3：同起点按归还时间排序，车0先接(0,3)，车1接(0,5)，之后(3,4)复用车0。',random=lambda r:[(s,s+r.randint(1,6)) for s in [r.randint(0,10) for _ in range(r.randint(1,12))]],edges=[(([(0,1)]*200000),cars_output([[(0,1)] for _ in range(200000)])),(([(i,i+1) for i in range(200000)]),cars_output([[(i,i+1) for i in range(200000)]]))],encode=lambda a:str(len(a))+'\n'+''.join(f'{p} {r}\n' for p,r in a),oracle=cars_oracle,code='''def solve(data):
    import heapq
    values=list(map(int,data[1:]));requests=list(zip(values[::2],values[1::2]));busy=[];free=[];cars=[]
    for p,r in sorted(requests):
        while busy and busy[0][0]<=p:
            end,car=heapq.heappop(busy);heapq.heappush(free,car)
        if free:car=heapq.heappop(free)
        else:car=len(cars);cars.append([])
        cars[car].append((p,r));heapq.heappush(busy,(r,car))
    return str(len(cars))+'\\n'+'\\n'.join(f'{i}: '+' '.join(f'({p},{r})' for p,r in car) for i,car in enumerate(cars))
''',mutants=[('同刻归还不能复用','busy[0][0]<=p','busy[0][0]<p'),('从不复用空闲车','if free:car=heapq.heappop(free)','if False:car=heapq.heappop(free)')]),
dict(id=54,title='固定窗口翻转为交替二进制串',tags=['贪心','差分'],description='每次恰好翻转长度为k的连续子串（0和1互换）。求使字符串相邻位都不同的最少操作次数，无法做到输出−1。最终可以从0或1开始。',input='本站标准输入：第一行 n k（1≤k≤n≤100000），第二行长度n的二进制串。',idea='分别固定0101…、1010…两种目标。从左到右维护有效翻转奇偶性；当前位不符时必须从当前位置开启窗口，窗口越界则该目标无解。',proof='处理当前位置时，更早起点的翻转已定，更晚起点无法改变当前位，因此不符时从当前位置翻转是唯一选择。重复翻同一窗口两次可抵消，不可能减少次数。每个目标的唯一贪心序列最优，取两目标最小值。',complexity='时间O(n)，空间O(n)。',samples=[('00010111',3),('0101',2),('00',2)],explanation='样例1：翻转下标[1,3]和[4,6]（从0计）后得到01010101，共2次。样例2：已经交替，0次。样例3：只能在00和11之间切换，无法交替，输出−1。',random=lambda r:(lambda n:(''.join(r.choice('01') for _ in range(n)),r.randint(1,n)))(r.randint(1,8)),edges=[(('0'*100000,1),'50000'),(('01'*50000,100000),'0'),(('0'*100000,100000),'-1')],encode=lambda x:f'{len(x[0])} {x[1]}\n{x[0]}\n',oracle=flips_oracle,code='''def solve(data):
    n,k=map(int,data[:2]);s=data[2];best=n+1
    for first in (0,1):
        end=[0]*(n+1);parity=0;count=0;possible=True
        for i,char in enumerate(s):
            parity^=end[i]
            if (int(char)^parity)!=(first^(i%2)):
                if i+k>n:possible=False;break
                parity^=1;end[i+k]^=1;count+=1
        if possible:best=min(best,count)
    return str(best if best<=n else -1)
''',mutants=[('只允许0开头目标','for first in (0,1):','for first in (0,):'),('窗口到边界也拒绝','if i+k>n:','if i+k>=n:')]),
dict(id=55,title='拆分为非降数组的最少操作',tags=['贪心'],description='一次把一个正整数拆成两个正整数，其和等于原数，原地按所选顺序插入；可继续拆分。求让整个数组非递减所需最少操作数。',input='本站标准输入：第一行 n（1..100000），第二行 n 个正整数（1..10⁹）。',idea='从右向左处理。右侧允许的上界为limit，当前值v至少需ceil(v/limit)份；尽量均分这些份，新的最左值为floor(v/份数)，作为下一步上界。',proof='每份≤limit保证接上已处理后缀，因此最少份数下界为ceil(v/limit)。将v均分为相差至多1的非降份可以达到该下界，并最大化最左份，使之前的元素约束最宽。逐步保留最优且最宽松的后缀，得到全局最少拆分次数；k份需k−1次拆分。',complexity='时间O(n)，除输入外空间O(1)。',samples=[[10,5,8],[3,9,3],[1,2,3]],explanation='样例1：把10拆成5、5，得到5、5、5、8，一次。样例2：把9拆成3、3、3，需要两次，得到全为3的非降数组。样例3：原本有序，不拆分。',random=lambda r:[r.randint(1,6) for _ in range(r.randint(1,5))],edges=[(([10**9]*99999+[1]),str(99999*(10**9-1))),(([1]*100000),'0')],encode=array,oracle=splits_oracle,code='''def solve(data):
    a=list(map(int,data[1:]));limit=a[-1];answer=0
    for i in range(len(a)-2,-1,-1):
        value=a[i];parts=max(1,(value+limit-1)//limit);answer+=parts-1;limit=value//parts
    return str(answer)
''',mutants=[('份数向下取整','(value+limit-1)//limit','value//limit'),('下一上界取最大份','limit=value//parts','limit=(value+parts-1)//parts')]),
dict(id=57,title='同下标交换使两数组严格递增',tags=['动态规划'],description='只能交换A[i]与B[i]，求让两个数组都严格递增的最少交换次数。已经满足时为0，不可能时为−1。',input='第一行n（本站范围1..100000），接着两行分别为A、B，元素1..10⁹。',idea='维护处理到当前下标、不交换/交换当前对的最小代价。根据相邻两对是否同方向递增或交叉递增，从前一状态转移。',proof='当前是否合法只依赖前一对最后的两个值及当前是否交换。两状态记录所有之前合法方案的最小代价，直连与交叉条件恰好覆盖四种相邻交换组合，因此归纳覆盖全部合法方案。',complexity='时间O(n)，除输入外空间O(1)。',samples=[([1,4,4,9],[2,3,5,10]),([1,2,3],[4,5,6]),([1,1],[1,1])],explanation='样例1：交换下标1的4和3，两数组变为1、3、4、9与2、4、5、10，答案1。样例2：两个数组已严格递增，答案0。样例3：无论是否交换，相等元素都无法严格递增，答案−1。',random=lambda r:(lambda n:([r.randint(1,12) for _ in range(n)],[r.randint(1,12) for _ in range(n)]))(r.randint(1,8)),edges=[((list(range(1,100001)),list(range(1,100001))),'0'),(([1]*100000,[1]*100000),'-1')],encode=lambda x:str(len(x[0]))+'\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',oracle=swaps_oracle,code='''def solve(data):
    n=int(data[0]);a=list(map(int,data[1:n+1]));b=list(map(int,data[n+1:]));keep=0;swap=1;inf=n+1
    for i in range(1,n):
        next_keep=next_swap=inf
        if a[i]>a[i-1] and b[i]>b[i-1]:next_keep=min(next_keep,keep);next_swap=min(next_swap,swap+1)
        if a[i]>b[i-1] and b[i]>a[i-1]:next_keep=min(next_keep,swap);next_swap=min(next_swap,keep+1)
        keep,swap=next_keep,next_swap
    answer=min(keep,swap)
    return str(answer if answer<=n else -1)
''',mutants=[('允许相等','>','>='),('遗漏交叉交换条件','if a[i]>b[i-1] and b[i]>a[i-1]:','if False:')]),
dict(id=58,title='预订次数最多的酒店房间',tags=['哈希表'],description='酒店楼层0..9，每层房间A..Z。+表示预订，−表示退房。序列合法且初始全部空闲。输出累计预订次数最多的房间（不计退房次数），并列时选字典序最小的房间。',input='第一行n（1..600），随后n行三字符记录，例如+0A或-0A，保证每次预订前空闲、退房前已预订。',idea='只统计+记录中的房间，按预订次数降序、房间名升序选择最优房间。',proof='每个+记录对应一次真实预订，与该房间是否最终空闲无关。累加所有+即累计次数，选择最大计数及最小名字恰好对应两级排序规则。',complexity='时间O(n+260)，空间O(260)。',samples=[['+1A','-1A','+1A','+0B'],['+9Z','+0A'],['+0A','-0A','+1A','-1A','+1A']],explanation='样例1：1A预订两次，0B一次，输出1A。样例2：各一次，字典序0A更小。样例3：1A累计两次，多于0A的一次，不是比较最终房间占用状态。',random=booking_random,edges=[((['+9Z','-9Z']*300),'9Z'),(([f'+{f}{c}' for f in range(10) for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']),'0A')],encode=lambda a:str(len(a))+'\n'+'\n'.join(a)+'\n',oracle=booking_oracle,code='''def solve(data):
    counts={}
    for op in data[1:]:
        if op[0]=='+':counts[op[1:]]=counts.get(op[1:],0)+1
    return min(counts,key=lambda room:(-counts[room],room))
''',mutants=[('并列时选择最大名字','return min(counts,key=lambda room:(-counts[room],room))','return max(counts,key=lambda room:(counts[room],room))'),('把退房也计为预订',"if op[0]=='+':","if True:")]),
dict(id=59,title='二进制一右移的最大总费用',tags=['贪心','计数'],description='选择后面紧跟0的某个1，将它向右移动穿过紧随其后的整段连续0，直到串尾或下一个1前；每次必须移到最远，费用为移动距离+1。把所有1移动到串末尾，求可能的最大总费用。',input='本站标准输入：一行长度1..100000的二进制字符串。',idea='移动距离总和恒等于逆序对数。额外的每次操作加1，最多为每段原始连续0左侧的1数量之和。扫描时每遇0加此前1数，若是0段首项则再加一次此前1数。',proof='每次右移只交换被移动1与经过的0，所有1最终在右边，每个原始10逆序对必须且只会交换一次。一个1最多对每个原始0段产生一次操作，故操作次数受前述和约束。从左到右处理0段，并逐个移动其左侧的1，能保留后续0段且达到该次数上界，两部分相加就是最大费用。',complexity='时间O(n)，空间O(1)。',samples=['110100','100010','00111'],explanation='样例1：先用两次费用2的操作穿过中间单个0，再用三次费用3的操作穿过最后两个0，总计13。样例2：第一个1越过三个0费用4，随后两个1各越过末尾一个0费用2，总计8。样例3：全部1已在右边，费用0。',random=lambda r:''.join(r.choice('01') for _ in range(r.randint(1,9))),edges=[(('1'*50000+'0'*50000),str(50000*50001)),(('10'*50000),str(50000*50001)),(('0'*100000),'0')],encode=lambda s:s+'\n',oracle=bits_oracle,code='''def solve(data):
    s=data[0];ones=0;answer=0;previous='0'
    for char in s:
        if char=='1':ones+=1
        else:
            answer+=ones
            if previous=='1':answer+=ones
        previous=char
    return str(answer)
''',mutants=[('忽略每次操作固定费用',"if previous=='1':answer+=ones","if False:answer+=ones"),('每个0都多算一次操作',"if previous=='1':answer+=ones","if True:answer+=ones")]),
]

BLOCKED={41:'题面仅剩“Given a”，没有可选元素或得分规则，单个例子无法还原。',45:'未说明离开与到达同一时刻能否复用椅子；没有样例消除端点语义歧义。',46:'题面在“like merge interval question but t”截断，缺少名称合并顺序、重复名称与端点规则。',48:'允许修改的次数及操作规则被截断，不能仅凭样例推定最多改3个。',49:'roses[i]含义及k、n的定义截断，例子又将3朵解释为一束，不能完整确认花束相邻/数量规则和无解输出。',50:'题面截断，未说明要求行回文、列回文还是同时回文，以及是否限制1的总数；仅一个输出4的例子不足以恢复。',52:'要求返回任意最优购买顺序，但没有并列最优规范；现有tokens/exact会拒绝其它合法顺序，且时间是否按整秒累积未定义，需补规则或专用语义checker。',56:'题面明确no statement available；唯一例子不能完整定义允许操作、成本和二进制表示规则。',60:'说迭代更新却没有明确找到最近同值下标后如何迁移/继续；样例仅执行第一次加一，和通常跳到最近位置后继续加一的结果矛盾，需确认完整迭代规则。'}
NOTES={42:'按明确最大k项和纠正首例13为19，不限制相邻或连续选择。',44:'原?2:22→23:22修改了固定数字，校正22:22。',47:'原第二例应翻转−3而非−4；第四例[-15,18,1,-1,10,-22]最优为7而非9。',51:'源题缺数值范围，本站显式限定绝对值总和200000；实现完整支持正负整数负载。',53:'严格保留源题确定性的最小空闲编号及排序规则，标准输出增加车辆数行。',59:'按例子明确一次只能跨越紧随的整段0、不得越过另一个1；独立搜索验证最大费用公式。'}

flip_spec=next(spec for spec in SPECS if spec['id']==54)
flip_spec['description']+=' 原站首例答案2不满足固定长度3窗口规则，本站经穷举校正为6。'
flip_spec['explanation']='样例1：依次从下标0、1、2、3、4、5开启长度3翻转，得到10101010，共6次；另一交替目标不可达，原站答案2有误。样例2：已经交替，0次。样例3：只能在00和11之间切换，无法交替，输出−1。'
NOTES[54]='原首例00010111、k=3的最优为6，不是2；枚举全部二进制状态BFS与双目标贪心一致。'
next(spec for spec in SPECS if spec['id']==58)['edges'].append((['+0A','+1A','-1A'],'0A'))
next(spec for spec in SPECS if spec['id']==43)['edges'].append((list(range(1,2001)),'1000'))

def execute(path,stdin):
    result=subprocess.run([sys.executable,'-I',str(path)],input=stdin,text=True,capture_output=True,timeout=12)
    assert result.returncode==0,(path,result.stderr[:1000])
    return result.stdout.strip()

def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};selected=set(map(int,sys.argv[1:]))
    items=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if selected and (OUT/'batches'/f'{BATCH}.json').exists() else []
    reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if selected and (OUT/'validation'/f'{BATCH}.json').exists() else []
    items=[x for x in items if int(x['id'].split('-')[-1]) not in selected];reports=[x for x in reports if int(x['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['id'] not in selected:continue
        identifier=f"oa-google-{spec['id']}";rng=random.Random(SEED+spec['id']);code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        reference=OUT/'references'/f'{identifier}.py';reference.write_text(code);oracles=[]
        for value in spec['samples']+[spec['random'](rng) for _ in range(160)]:
            stdin=spec['encode'](value);expected=spec['oracle'](value);actual=execute(reference,stdin)
            assert actual==expected,(identifier,value,expected,actual)
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        inputs=oracles[:3]+[dict(input=spec['encode'](x),expectedOutput=y+'\n') for x,y in spec['edges']]+oracles[3:27];cases=[]
        for i,c in enumerate(inputs):
            assert execute(reference,c['input'])==c['expectedOutput'].strip(),(identifier,'large case',i)
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1))
        mutants=[];kills=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code;changed=code.replace(old,new);path=OUT/'negative-controls'/f'{identifier}-{index}.py';path.write_text(changed)
            rejected=[i for i,c in enumerate(cases) if execute(path,c['input'])!=c['expectedOutput'].strip()]
            assert rejected,(identifier,label,'survived')
            mutants.append(dict(name=label,code=changed));kills.append(dict(name=label,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Google']+spec['tags'],description=spec['description']+'\n\n输入输出与样例由CSWork整理；标注本站的数值范围属于本站评测约定。',input=spec['input'],output=spec.get('output','输出题目要求的答案。'),explanation=spec['explanation'],hints=[spec['idea']],timeLimit=spec.get('timeLimit',3),memoryLimit=262144,outputLimit=spec.get('outputLimit',4096),checker='tokens',languages=['python','go','java','cpp'])
        raw=dict(schemaVersion=1,problem=problem,cases=cases)
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        pkg=json.loads(normalized);assert '\ufffd' not in normalized,(identifier,'Unexpected U+FFFD')
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        documents={'packages':pkg,'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}
        for folder,value in documents.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=kills,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracles),'oracle;',len(cases)-3,'hidden; two normally-exiting incorrect programs rejected',flush=True)
    items.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped={f'oa-google-{k}':v for k,v in BLOCKED.items()},note='Local checks only; real sandbox evidence required before publication.'),ensure_ascii=False,indent=2)+'\n')
    reviews=[dict(id=f'oa-google-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,NOTES.get(i,'题面规则明确，独立参考解、暴力oracle及大边界验证，本站标准I/O已说明。'))) for i in range(41,61)]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
