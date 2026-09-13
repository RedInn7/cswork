"""Amazon136–155 independently authored; immutable source e66f809 audited, never execute imported solutions."""
from collections import Counter
from functools import lru_cache
from itertools import combinations, product
from pathlib import Path
import hashlib,json,math,random,subprocess,sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='amazon-remaining-g';SEED=20261400;SPECS=[]
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,random=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def loads_oracle(x):
    a,p=x;best=None
    def visit(i,left,result):
        nonlocal best
        if i==len(a)-1:
            result=result+[a[i]+left];key=(max(result),tuple(-v for v in result))
            if best is None or key<best[0]:best=(key,result)
            return
        for v in range(left+1):visit(i+1,left-v,result+[a[i]+v])
    visit(0,p,[]);return ' '.join(map(str,best[1]))
add(136,'新增包裹后的最优车辆负载分配','把P个不可拆包裹全部加入现有n辆车，可以给某车0个，不可取走原包裹。最小化最后最大车辆负载。输出任意最优最终负载数组，不要求唯一分配。','第一行n P，第二行n个原负载。原文无数值界，本站1≤n≤100000，0≤P≤10^12，0≤原负载≤10^9。','最优上限C为原最大值与总负载向上平均的较大者。按输入顺序尽量把每辆车填到C，直到新增包裹分完。','任何方案最大值至少是原最大值，且至少为总和除n的上整。取这两者的最大值C后，总剩余容量nC−原总和≥P，因此逐车填充必能完成。所得最大值达到不可突破下界，是最优方案。','时间O(n)，空间O(n)。',[([1,2],3),([5,0],0),([0,0,0],2)],'样例1：可输出3 3，新增2和1，总新增3，最大3最优。样例2：无新增，输出5 0。样例3：可输出1 1 0；任何两个不同车辆各放1也是正确答案。',lambda r:([r.randint(0,6) for _ in range(r.randint(1,4))],r.randint(0,7)),[(([0]*100000,10**12),' '.join(['10000000']*100000)),(([10**9]*100000,0),' '.join(['1000000000']*100000)),(([10**9],10**12),'1001000000000')],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',loads_oracle,
'''def solve(d):
    n,p=map(int,d[:2]);a=list(map(int,d[2:]));cap=max(max(a),(sum(a)+p+n-1)//n)
    for i in range(n):
        put=min(p,cap-a[i]);a[i]+=put;p-=put
    return ' '.join(map(str,a))
''',[('把所有新增放首车','cap=max(max(a),(sum(a)+p+n-1)//n)','cap=max(a)+p'),('丢弃所有新增','put=min(p,cap-a[i])','put=0')],1100030,checker='oa-optimal-loads',output='输出恰好n个非负整数，表示任意最优最终负载分配。')
def route_oracle(x):
    edges,requests=x;n=len(edges);at=0;answer=0
    for target in requests:
        clockwise=0;i=at
        while i!=target:clockwise+=edges[i];i=(i+1)%n
        counter=0;i=at
        while i!=target:i=(i-1)%n;counter+=edges[i]
        answer+=min(clockwise,counter);at=target
    return answer
add(137,'按请求顺序飞行的环线最短总时间','m个站构成双向环，边长给出相邻站的飞行时间。无人机从1号站开始，必须依次到达所有请求站，求最小总时间。重复访问同一站可以不移动。','第一行m q，第二行m个边长，第三行q个1-based请求站。1≤m,q≤100000，边长1..10^9。','前缀和给出顺向展开距离d，每段选择min(d,总周长−d)，并更新当前站。','相邻请求之间必须从确定的起点走到确定终点，正边权环的最短路径是两条简单弧之一。各段的终点固定，不存在跨段取舍，分别选最短后相加即全局最优。','时间O(m+q)，空间O(m+q)。',[([3,2,1],[0,2,2,1]),([5,1,2,6],[1,3,0]),([7],[0,0])],'样例1：1→1费用0，1→3费用1，3→3费用0，3→2费用2，总3。样例2：费用5、3、6，总14。样例3：始终位于唯一站，答案0。',lambda r:(lambda n:([r.randint(1,10) for _ in range(n)],[r.randrange(n) for _ in range(r.randint(1,8))]))(r.randint(1,7)),[(([10**9]*100000,[50000,0]*50000),5000000000000000000),(([1],[0]*100000),0)],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(str(v+1) for v in x[1])+'\n',route_oracle,
'''def solve(d):
    n,q=map(int,d[:2]);prefix=[0]
    for v in d[2:2+n]:prefix.append(prefix[-1]+int(v))
    at=answer=0;total=prefix[-1]
    for token in d[2+n:]:
        target=int(token)-1;distance=abs(prefix[target]-prefix[at]);answer+=min(distance,total-distance);at=target
    return str(answer)
''',[('每次错误从起点出发','at=target','at=0'),('只走展开方向','min(distance,total-distance)','distance')],1800030,time=6)
def dropped_oracle(a):
    answer=0
    for i,t in enumerate(a):
        prefix=a[:i+1]
        answer+=sum(v==t for v in prefix)>3 or sum(v>=t-9 for v in prefix)>20 or sum(v>=t-59 for v in prefix)>60
    return answer
add(138,'限流网关丢弃的请求数量','请求按时间非递减给出。每秒最多3个、包含当前秒的最近10秒最多20个、最近60秒最多60个；超任一限制就丢弃且只计一次。已经丢弃的请求仍参与以后统计。','第一行n（1..1000000），第二行n个非递减时间（1..10^9）。10秒窗口为[T−9,T]，60秒窗口为[T−59,T]，端点包含。','第i个请求若与i−3同秒，或与i−20间隔小于10，或与i−60间隔小于60就超限。三个条件取或。','时间有序，因此最近某窗口请求数超过阈值，当且仅当往前阈值个请求仍在窗口中。直接使用原请求下标自然包含被丢弃项；按或计数避免多规则重复计。','时间O(n)，空间O(n)保存输入；不复制整份整数数组。',[[1,1,1,1,2],[1]*4+[2]*3+[3]*3+[4]*3+[5]*3+[6]*3+[7]*2,list(range(1,62))],'样例1：同秒第4个请求被丢，答案1。样例2：同秒第4项和10秒内第21项各被丢，答案2。样例3：任何60秒内恰至多60个，全部接收，答案0。',lambda r:sorted(r.randint(1,80) for _ in range(r.randint(1,90))),[([10**9]*1000000,999997),(list(range(1,1000001)),0),(list(range(1,61))+[60],1),([1]*3+[2]*3+[3]*3+[4]*3+[5]*3+[6]*3+[7]*2+[11],0)],arr,dropped_oracle,
'''def solve(d):
    answer=0
    for i in range(1,len(d)):
        t=int(d[i]);answer+=(i>3 and t==int(d[i-3])) or (i>20 and t-int(d[i-20])<10) or (i>60 and t-int(d[i-60])<60)
    return str(answer)
''',[('十秒边界错误包含旧秒','<10','<=10'),('只执行每秒规则'," or (i>20 and t-int(d[i-20])<10) or (i>60 and t-int(d[i-60])<60)",'')],11000030,time=6,memory=524288)
def nonzero_oracle(a):
    if 0 in a:return -1
    best=len(a)
    for mask in range(1<<max(0,len(a)-1)):
        segments=[];start=0
        for i in range(len(a)-1):
            if mask>>i&1:segments.append(a[start:i+1]);start=i+1
        segments.append(a[start:]);ok=all(sum(s[i:j])!=0 for s in segments for i in range(len(s)) for j in range(i+1,len(s)+1))
        if ok:best=min(best,mask.bit_count())
    return best
add(139,'插入最少整数消除所有零和连续段','只能在原数组中插入任意整数，不可删除或改动原元素；使全部非空连续段之和非零，求最少插入数。如果原数组含0，单元素零段无法消除，本站约定无解输出−1。','第一行n，第二行n个整数。来源无数值界，本站1≤n≤200000，元素−10^9..10^9。','扫描当前未分隔段的前缀和集合。加入当前项后发生前缀重复，就在当前项前插入分隔值，重开一个只含当前项的新段。','前缀重复等价于存在零和段，任何合法插入方案必须在该段内部插入。按最早结束的冲突选择其最后一个内部间隙，不比选择更早间隙影响更少未来冲突，故贪心最优。每个分隔值可统一取原数组绝对值总和加1，任何跨分隔段的和严格正，保证切段方案确实能实现。','时间O(n)，空间O(n)。',[[1,-5,3,2,-5],[1,-1,1,-1],[0,1]],'样例1：在3后插入100即没有零和段，至少一次，答案1。样例2：每个相邻异号对都和0，必须在三个间隙各插一次，答案3。样例3：原元素0永远是零和单元素段，无解−1。',lambda r:[r.randint(-4,4) for _ in range(r.randint(1,9))],[([1,-1]*100000,199999),([10**9]*200000,0)],arr,nonzero_oracle,
'''def solve(d):
    seen={0};prefix=answer=0
    for token in d[1:]:
        v=int(token)
        if v==0:return '-1'
        if prefix+v in seen:answer+=1;seen={0};prefix=0
        prefix+=v;seen.add(prefix)
    return str(answer)
''',[('重开段漏空前缀','seen={0};prefix=0','seen=set();prefix=0'),('把0当可插入解决','if v==0:return \'-1\'','if v==0:return \'1\'')],2400030,time=6)
def isomorphic_oracle(rows):
    return ' '.join('1' if all((a[i]==a[j])==(b[i]==b[j]) for i in range(len(a)) for j in range(len(a))) else '0' for a,b in rows)
add(140,'整串交换字母后能否变成目标','每次选择两个不同小写字母，交换它们在整串中的全部出现；允许一个字母当前没有出现。对每对等长字符串判断能否变换，输出1或0。','第一行n（1..100000），随后n行各两个等长非空小写串。每串长度≤200000，所有字符串总长度≤500000。','逐位置建立原字符到目标字符及反向映射；任一方向冲突则不可能，否则可行。','全局字母交换组成字母表的置换，必保留任意两个位置字符是否相等。双向一致映射正是这种相等模式保持；它可扩充成整个26字母表的置换，而任意置换都可分解为两两交换，所以条件也充分。','时间O(总字符数)，空间O(总输入大小)，每对辅助映射O(26)。',[[('abba','adda')],[('azzel','apple')],[('ab','aa'),('aba','xyx')]],'样例1：交换b、d即可，输出1。样例2：先换z、p再换e、l即可，输出1。样例3：ab两种字符不能都变a，输出0；aba可映射为xyx，输出1。',lambda r:[(''.join(r.choice('abc') for _ in range(n)),''.join(r.choice('xyz') for _ in range(n))) for n in [r.randint(1,8) for _ in range(r.randint(1,5))]],[([('a'*200000,'z'*200000),('b'*50000,'y'*50000)],'1 1'),([('ab','xy')]*50000+[('aba','xyx')]*50000,' '.join(['1']*100000))],lambda rows:str(len(rows))+'\n'+''.join(a+' '+b+'\n' for a,b in rows),isomorphic_oracle,
'''def solve(d):
    answers=[]
    for i in range(1,len(d),2):
        a,b=d[i:i+2];forward={};back={};ok=True
        for x,y in zip(a,b):
            if x in forward and forward[x]!=y or y in back and back[y]!=x:ok=False;break
            forward[x]=y;back[y]=x
        answers.append('1' if ok else '0')
    return ' '.join(answers)
''',[('只检查正向映射',' or y in back and back[y]!=x',''),('不允许更换字母名称',"answers.append('1' if ok else '0')","answers.append('1' if a==b else '0')")],700030,time=6,output='按输入顺序输出n个0或1。')
def execution_oracle(a):
    current=a[:];total=0
    for i in range(len(a)):
        total+=current[i]
        for j in range(i+1,len(a)):
            if a[j]==a[i]:current[j]=(current[i]+1)//2
    return total
add(141,'同原始时长任务逐次减半后的总耗时','任务按原顺序执行。原始时长相同的任务属于同组；每执行一个任务，其他同组未执行任务的当前时长变成它当前时长的一半向上取整。原始不同但后来时长相同的任务不能合组。','第一行n，第二行n个初始时长。原始快照未给上界；导入目录列n≤100000，本站扩展至1≤n≤200000，时长1..10^9。','字典按原始时长保存该组下次执行时长；取出累加，再更新为向上除2。','每组所有未执行任务始终有相同时长；一次组内执行使它们统一更新，其他组不受影响。按原时长作为键恰好维持这一组别不变量，逐次累加得到真实总耗时。','时间O(n)，空间O(n)。',[[5,5,3,6,5,3],[1,1,1],[4,2,4]],'样例1：实际耗时5、3、3、6、2、2，总21。样例2：1减半向上仍为1，总3。样例3：三项耗时4、2、2，总8；初始2不与后来减成2的4合组。',lambda r:[r.randint(1,15) for _ in range(r.randint(1,9))],[([1]*200000,200000),(list(range(1,200001)),20000100000),([10**9]*200000,sum((10**9+(1<<i)-1)//(1<<i) for i in range(30))+199970)],arr,execution_oracle,
'''def solve(d):
    next_time={};total=0
    for token in d[1:]:
        original=int(token);value=next_time.get(original,original);total+=value;next_time[original]=(value+1)//2
    return str(total)
''',[('除2向下取整','(value+1)//2','value//2'),('每次都按原值减半','(value+1)//2','(original+1)//2')],2200030,time=6)
def winners_oracle(rows):
    from itertools import permutations
    return sum(all(any(sum(x>y for x,y in zip(order,b))>=2 for order in permutations(a)) for j,b in enumerate(rows) if i!=j) for i,a in enumerate(rows))
def winners_random(r):return [r.sample(range(1,12),3) for _ in range(r.randint(2,6))]
add(142,'能在三回合中击败所有对手的玩家数','每位玩家有三个互不相同的强化值，每局各用一次。若存在双方的某种排列，使X在至少两回合严格大于Y，则X能击败Y。统计能分别击败每个其他人的玩家数；不同对手可使用不同排列。','第一行n（2..100000），随后n行三个强化值（1..10^9），每行内互异，跨行可重复。','每人升序为a<b<c，能击败另一人的条件是自己的b大于对方a且自己的c大于对方b。因此预先求所有a与b的最大值，然后筛选。','赢两回合最有利是用自己的两个最大值匹配对方两个最小值，排序贪心条件恰为bX>aY、cX>bY；其他配对不可能放宽条件。要胜全部对手就取两个对手阈值最大值。包含自己的阈值不影响，因为本人的b>a且c>b天然成立。','时间O(n)，空间O(n)。',[[(9,5,11),(7,12,3)],[(1,2,3),(3,4,5)],[(1,5,9),(2,6,10),(3,7,11)]],'样例1：双方都存在赢两回合的配对，因此答案2。样例2：只有第二人能击败第一人，答案1。样例3：每人中值都大于所有最小值且最大值大于所有中值，三人都能胜，答案3。',winners_random,[([(1,2,10**9)]*100000,100000),([(3*i+1,3*i+2,3*i+3) for i in range(100000)],1)],lambda rows:str(len(rows))+'\n'+''.join(' '.join(map(str,a))+'\n' for a in rows),winners_oracle,
'''def solve(d):
    rows=[sorted(map(int,d[i:i+3])) for i in range(1,len(d),3)];max_a=max(a[0] for a in rows);max_b=max(a[1] for a in rows)
    return str(sum(b>max_a and c>max_b for a,b,c in rows))
''',[('把平局当胜利','b>max_a and c>max_b','b>=max_a and c>=max_b'),('错误要求三回合都赢','b>max_a','a>max_a')],3300030,time=6)
def dominance_oracle(rows):return ' '.join(str(max(Counter(s[:length] for s in rows).values())) for length in range(1,len(rows[0])+1))
add(144,'每种前缀长度的最大出现次数','n个字符串长度都为m。对长度1..m，分别求出现次数最多的前缀的次数；重复字符串按不同输入记录计数，只输出次数而非前缀。','第一行n m，随后n行等长字符串。来源2≤n≤500、1≤m≤2000；来源未限定字符集，本站使用小写字母。','逐列细化前缀分组：新组由旧前缀组编号和当前字符唯一确定，统计每组人数并取最大。','长度j+1前缀相同，当且仅当长度j前缀相同且当前字符相同。因此组编号的逐列更新准确表示前缀相等关系，每列最大组人数就是要求。无需保存全部前缀或百万字典树节点。','时间O(nm)，空间O(nm)含输入，额外O(n)。',[['aba','abb','aba'],['abc','aaa','aba'],['aa','aa']],'样例1：a、ab各出现3次，aba出现2次，输出3 3 2。样例2：首字母a共3次，ab共2次，完整串各1次，输出3 2 1。样例3：两个长度的前缀都出现2次，输出2 2。',lambda r:(lambda n,m:[''.join(r.choice('abc') for _ in range(m)) for _ in range(n)])(r.randint(2,7),r.randint(1,7)),[(['a'*2000]*500,' '.join(['500']*2000)),(['a'*1999+'b']*250+['a'*1999+'c']*250,' '.join(['500']*1999+['250']))],lambda rows:f'{len(rows)} {len(rows[0])}\n'+'\n'.join(rows)+'\n',dominance_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);rows=d[2:];groups=[0]*n;answer=[]
    for j in range(m):
        ids={};counts={};next_groups=[]
        for i in range(n):
            key=(groups[i],rows[i][j]);group=ids.setdefault(key,len(ids));next_groups.append(group);counts[group]=counts.get(group,0)+1
        groups=next_groups;answer.append(max(counts.values()))
    return ' '.join(map(str,answer))
''',[('仅比较当前字符','key=(groups[i],rows[i][j])','key=rows[i][j]'),('重复字符串只计一次','rows=d[2:];groups=[0]*n','rows=list(dict.fromkeys(d[2:]));n=len(rows);groups=[0]*n')],1000530,time=6,output='依前缀长度1..m输出m个最大出现次数。')
def encrypted_oracle(a):
    n=len(a);return ''.join(str(sum(math.comb(n-2,i)*a[i+shift] for i in range(n-1))%10) for shift in (0,1))
add(145,'相邻求和保留个位直到两位','每轮将相邻两个数相加并只保留个位，数组长度减少1。反复直到恰好两个数字，按顺序输出两字符字符串，保留前导0。','第一行n（2..5000），第二行n个0..9数字。','逐轮原地向左覆盖相邻和mod10，缩短有效长度直到2。','一轮第i项只依赖旧的第i与i+1项，从左到右更新时右边旧值尚未覆盖，因此原地更新与定义完全一致；归纳得到最终两位。','时间O(n²)，空间O(n)。',[[4,5,6,7],[1,2,3,4],[0,0]],'样例1：4567→913→04，输出04而非4。样例2：1234→357→82。样例3：原本两位00，无需操作，输出00。',lambda r:[r.randrange(10) for _ in range(r.randint(2,12))],[([0]*5000,'00'),([1]*5000,str(pow(2,4998,10))*2)],arr,encrypted_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));length=len(a)
    while length>2:
        for i in range(length-1):a[i]=(a[i]+a[i+1])%10
        length-=1
    return str(a[0])+str(a[1])
''',[('不保留前导零','str(a[0])+str(a[1])','str(a[0]*10+a[1])'),('加错成自身两倍','a[i]+a[i+1]','a[i]+a[i]')],10030,time=6,output='输出恰好两个数字字符，前导0必须保留。')
def palindrome_oracle(s):
    counts=Counter(s);best=None
    def visit(prefix):
        nonlocal best
        if len(prefix)==len(s):
            if prefix==prefix[::-1] and (best is None or prefix<best):best=prefix
            return
        for c in counts:
            if counts[c]:counts[c]-=1;visit(prefix+c);counts[c]+=1
    visit('');return best
def palindrome_random(r):
    half=''.join(r.choice('abc') for _ in range(r.randint(0,3)));middle=r.choice('abc') if not half or r.randrange(2) else '';return half+middle+half[::-1]
add(146,'回文密码的最小字典序重排','输入保证是小写回文串，重排全部字符，得到仍为回文且字典序最小的密码。','一行小写回文串，长度1..100000。','每种字母的一半按升序构造左半，奇数次字符放中间，右半反转左半。','回文两侧每种字符出现数固定相等，因此左半每种字符数量固定为总频次整除2。固定多重集合的最小字典序排列就是升序，中间与右半随后被唯一确定。','时间O(n)，空间O(n)。',['babab','yxxy','ded'],'样例1：左半ab，中间b，镜像后abbba。样例2：左半xy，得到xyyx。样例3：左右只能d、中间e，保持ded。',palindrome_random,[('z'*25000+'a'*50000+'z'*25000,'a'*25000+'z'*50000+'a'*25000),('a'*100000,'a'*100000)],lambda s:s+'\n',palindrome_oracle,
'''def solve(d):
    from collections import Counter
    counts=Counter(d[0]);left=''.join(c*(counts[c]//2) for c in sorted(counts));middle=''.join(c for c in sorted(counts) if counts[c]%2)
    return left+middle+left[::-1]
''',[('直接全串排序',"left+middle+left[::-1]","''.join(sorted(d[0]))"),('左半逆序',"for c in sorted(counts));middle","for c in sorted(counts,reverse=True));middle")],100030,output='输出重排后的最小字典序回文。')
def prefix_oracle(a):return next((i for i in range(len(a)) if sum(a[:i+1])<=0),-1)
add(147,'首个非正前缀和的下标','找最早的非空前缀，使其和≤0；没有则输出−1。本站标准I/O明确用0-based下标：来源例2与例3混用索引，从而将例2结果2修正为1。','第一行n（1..100000），第二行n个−10^9..10^9整数。','累加前缀和，首次遇到≤0立即返回当前0-based下标。','第i次累加恰为0..i前缀和，按下标递增检查，首次成功必是最早；全未成功则不存在。','时间O(n)，除输入外空间O(1)。',[[1,2],[2,-4,1],[1,2,3,-6]],'样例1：前缀1、3都正，输出−1。样例2：前缀2、−2、−1，首次出现在下标1。样例3：前缀1、3、6、0，首次下标3。',lambda r:[r.randint(-8,8) for _ in range(r.randint(1,10))],[([10**9]*50000+[-10**9]*50000,99999),([10**9]*100000,-1)],arr,prefix_oracle,
'''def solve(d):
    total=0
    for i,token in enumerate(d[1:]):
        total+=int(token)
        if total<=0:return str(i)
    return '-1'
''',[('把等于0排除','total<=0','total<0'),('错误返回1-based','return str(i)','return str(i+1)')],1200030)
def unique_oracle(s):return next((i+1 for i,c in enumerate(s) if s.count(c)==1),-1)
add(148,'第一个只出现一次的字符位置','返回整串仅出现一次的字符中最早者的位置，明确使用1-based；没有则输出−1。','一行小写字符串，长度1..100000。','先统计字符频次，再按原顺序找首个频次1的字符。','频次表判断唯一性准确，原顺序第一次遇到的唯一字符就是所求最早位置。','时间O(n)，辅助空间O(26)。',['statistics','aabb','zabz'],'样例1：a最早且仅出现一次，位置3。样例2：a、b都重复，没有唯一字符，输出−1。样例3：a在位置2唯一且比b更早，输出2。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,12))),[('a'*99999+'b',100000),('a'*100000,-1)],lambda s:s+'\n',unique_oracle,
'''def solve(d):
    from collections import Counter
    s=d[0];count=Counter(s)
    return str(next((i+1 for i,c in enumerate(s) if count[c]==1),-1))
''',[('错误使用0-based','i+1 for i,c','i for i,c'),('返回最后唯一字符',"next((i+1 for i,c in enumerate(s) if count[c]==1),-1)","max((i+1 for i,c in enumerate(s) if count[c]==1),default=-1)")],100030)
def ideal_oracle(x):
    a,k=x;return ' '.join(str(i+1) for i in range(k,len(a)-k) if all(a[j]>=a[j+1] for j in range(i-k,i)) and all(a[j]<=a[j+1] for j in range(i,i+k)))
def ideal_random(r):
    while True:
        n=r.randint(3,12);k=r.randint(1,(n-1)//2);a=[r.randint(0,5) for _ in range(n)]
        if ideal_oracle((a,k)):return a,k
add(149,'前后降雨趋势合适的理想日期','某日之前window个相邻关系含该日非递增，该日之后window个相邻关系非递减，且左右日期都存在，才是理想日。输出所有1-based日期。保证至少一个理想日。','第一行n window，第二行n个预测值。来源1≤window≤n≤200000，值0..10^9，且保证至少一解，因此联合条件实际要求2window+1≤n。','左扫描每点结尾非递增长度，右扫描每点开始非递减长度，二者都至少window个相邻关系即可。','两项连续长度恰编码左右完整window范围的逐对大小关系。索引边界同时通过长度体现，两个条件的交集就是定义的全部理想日。','时间O(n)，空间O(n)。',[([3,2,2,2,3,4],2),([1,0,1,0,1],1),([1]*10,3)],'样例1：日期3、4各有前后两步满足关系，输出3 4。样例2：两个低谷是日期2、4。样例3：所有关系相等，满足左右各三天的日期4、5、6、7都可选。',ideal_random,[(([10**9]*200000,99999),'100000 100001'),(([0]*200000,1),' '.join(map(str,range(2,200000))))],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',ideal_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));left=[0]*n;right=[0]*n
    for i in range(1,n):left[i]=left[i-1]+1 if a[i-1]>=a[i] else 0
    for i in range(n-2,-1,-1):right[i]=right[i+1]+1 if a[i]<=a[i+1] else 0
    return ' '.join(str(i+1) for i in range(n) if left[i]>=k and right[i]>=k)
''',[('不接受相等降雨','a[i-1]>=a[i]','a[i-1]>a[i]'),('少检查一步','left[i]>=k and right[i]>=k','left[i]>=k-1 and right[i]>=k-1')],2200030,time=6,output='升序输出所有符合条件的1-based日期。')
def idle_oracle(x):
    n,logs,queries,w=x;return ' '.join(str(n-len({skill for skill,t in logs if q-w<=t<=q})) for q in queries)
def idle_random(r):
    n=r.randint(1,7);return n,[(r.randrange(n),r.randint(1,15)) for _ in range(r.randint(1,12))],[r.randint(1,20) for _ in range(r.randint(1,8))],r.randint(1,10)
add(150,'查询时间窗口内未被使用的技能数','每条日志含技能ID与请求时间。对每个查询q，统计闭区间[q−window,q]内没有任何请求的技能数量，保持查询原顺序输出。','第一行numSkills m q window；随后m行1-based技能ID、时间，最后一行q个查询时间。四个规模/窗口参数1..100000，时间与查询1..100000，ID合法。','日志按时间排序，查询也按时间排序。双指针维护窗口中的日志，每技能记录频次并维护活跃技能数；答案=总技能数−活跃数。','按升序查询移动窗口时，所有时间≤q的新日志加入，所有时间<q−window的旧日志删除，恰好保留闭区间内日志。频次从0到1与1到0更新不同技能数，避免重复日志重复计活跃。','时间O(m log m+q log q)，空间O(numSkills+m+q)。',[(3,[(0,3),(1,6),(0,5)],[10,11],5),(6,[(2,2),(3,3),(1,6),(5,3)],[3,2,6],2),(1,[(0,5)],[6,7],1)],'样例1：窗口5..10活跃技能1、2，空闲1；6..11仅技能2，空闲2。样例2：按查询原序，活跃数量3、1、1，空闲3、5、5。样例3：查询6包含左端5的请求，空闲0；查询7不含，空闲1。',idle_random,[((100000,[(i,100000) for i in range(100000)],[100000]*100000,100000),' '.join(['0']*100000)),((100000,[(0,1)]*100000,[100000]*100000,1),' '.join(['100000']*100000))],lambda x:f'{x[0]} {len(x[1])} {len(x[2])} {x[3]}\n'+''.join(f'{i+1} {t}\n' for i,t in x[1])+' '.join(map(str,x[2]))+'\n',idle_oracle,
'''def solve(d):
    n,m,q,w=map(int,d[:4]);logs=sorted((int(d[i+1]),int(d[i])-1) for i in range(4,4+2*m,2));queries=list(map(int,d[4+2*m:]));frequency=[0]*n;active=left=right=0;answer=[0]*q
    for index in sorted(range(q),key=lambda i:queries[i]):
        time=queries[index]
        while right<m and logs[right][0]<=time:
            skill=logs[right][1];active+=frequency[skill]==0;frequency[skill]+=1;right+=1
        while left<right and logs[left][0]<time-w:
            skill=logs[left][1];frequency[skill]-=1;active-=frequency[skill]==0;left+=1
        answer[index]=n-active
    return ' '.join(map(str,answer))
''',[('窗口左端错排除','logs[left][0]<time-w','logs[left][0]<=time-w'),('按日志数量计活跃','active+=frequency[skill]==0','active+=1')],2100040,time=6,output='按原查询顺序输出q个空闲技能数量。')
def kth_oracle(x):
    a,m,k=x;return ' '.join(str(sorted(a[i:i+m])[k-1]) for i in range(len(a)-m+1))
add(152,'每个连续窗口的第k小漏洞值','对数组每个长度m的连续窗口，按从小到大排序后取第k个值。重复值各占一个位置，按窗口起点升序输出。','第一行n m k（1≤k≤m≤n≤300000），第二行n个漏洞值（1..10^9）。','将所有值压缩成秩，Fenwick树保存当前窗口各秩的出现次数。移动窗口时删一加一，二进制提升找累计计数首次≥k的秩。','树中计数恰是当前窗口的多重集合。前缀计数单调，第k小值的秩正是首次前缀计数达到k的秩；二进制提升保留累计<k的最大前缀，后一秩就是答案。','时间O(n log n)，空间O(n)。',[([1,3,2,1],3,2),([4,2,3,1,1],4,3),([5,5,1],2,2)],'样例1：两个窗口排序都为1、2、3，第2项都2。样例2：窗口排序1、2、3、4与1、1、2、3，第3项分别3、2。样例3：重复5各占位置，两窗口第2小都5。',lambda r:(lambda n,m:([r.randint(1,12) for _ in range(n)],m,r.randint(1,m)))(n:=r.randint(1,10),r.randint(1,n)),[((list(range(1,300001)),150000,75000),' '.join(map(str,range(75000,225001)))),(([10**9]*300000,1,1),' '.join(['1000000000']*300000)),((list(range(300000,0,-1)),300000,300000),'300000')],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+' '.join(map(str,x[0]))+'\n',kth_oracle,
'''def solve(d):
    n,m,k=map(int,d[:3]);a=list(map(int,d[3:]));values=sorted(set(a));rank={v:i+1 for i,v in enumerate(values)};size=len(values);tree=[0]*(size+1)
    def update(index,delta):
        while index<=size:tree[index]+=delta;index+=index&-index
    def kth():
        index=0;target=k;step=1<<(size.bit_length()-1)
        while step:
            following=index+step
            if following<=size and tree[following]<target:index=following;target-=tree[following]
            step>>=1
        return values[index]
    for i in range(m):update(rank[a[i]],1)
    answer=[kth()]
    for i in range(m,n):update(rank[a[i-m]],-1);update(rank[a[i]],1);answer.append(kth())
    return ' '.join(map(str,answer))
''',[('移动时不删除离开元素','update(rank[a[i-m]],-1)','update(rank[a[i-m]],0)'),('错误把k当从0计数','target=k;','target=max(1,k-1);')],3300040,time=10,memory=524288,output='输出n−m+1个窗口的第k小值。')
def vulnerability_oracle(x):
    a,budget=x;best=len(a)
    for mask in range(1<<len(a)):
        if mask.bit_count()>budget:continue
        b=[1 if mask>>i&1 else v for i,v in enumerate(a)];worst=0
        for i in range(len(a)):
            value=0
            for j in range(i,len(a)):
                value=math.gcd(value,b[j])
                if value>1:worst=max(worst,j-i+1)
        best=min(best,worst)
    return best
add(154,'修改有限元素后的最小GCD漏洞长度','漏洞因子是GCD大于1的非空连续段的最长长度，不存在则为0。可把至多maxChange个元素改成任意整数，最小化漏洞因子。单元素也计入连续段。','第一行n maxChange（1≤n≤100000，0≤maxChange≤n），第二行n个1..10^9整数。','修改成1最有利。二分容许长度L，所有原GCD>1的长度L+1窗口都必须被修改点命中；从左到右贪心修改首个未命中坏窗口的右端。GCD稀疏表O(1)查询窗口。','改为1会消除包含该位置的全部坏段，且不制造新坏段，故不劣于其他修改值。存在长于L的坏段当且仅当有坏的L+1窗口。对于按右端排序的区间，选择首个未命中区间的最右点是标准最优覆盖贪心；所需修改数≤预算即长度L可行，可行性单调。','时间O(n log n)，空间O(n log n)。',[([2,2,4,9,6],1),([4,2,4],1),([3,5,7,11,13],2)],'样例1：把中间4改1，剩余最长坏段2、2及9、6，长度2。样例2：中间改1，左右只剩单元素坏段，答案1。样例3：任意两次修改后仍有原质数单元素，最优1而非来源错误的0。',lambda r:([r.randint(1,15) for _ in range(n)],r.randint(0,n)) if (n:=r.randint(1,8)) else None,[(([10**9]*100000,49999),2),(([1]*100000,100000),0)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',vulnerability_oracle,
'''def solve(d):
    from math import gcd
    n,budget=map(int,d[:2]);a=list(map(int,d[2:]));table=[a];width=1
    while 2*width<=n:
        previous=table[-1];table.append([gcd(previous[i],previous[i+width]) for i in range(n-2*width+1)]);width*=2
    def feasible(limit):
        length=limit+1
        if length>n:return True
        level=length.bit_length()-1;offset=length-(1<<level);row=table[level];i=used=0
        while i+length<=n:
            if gcd(row[i],row[i+offset])>1:
                used+=1
                if used>budget:return False
                i+=length
            else:i+=1
        return True
    lo,hi=0,n
    while lo<hi:
        middle=(lo+hi)//2
        if feasible(middle):hi=middle
        else:lo=middle+1
    return str(lo)
''',[('不允许答案0','lo,hi=0,n','lo,hi=1,n'),('预算多算一次','if used>budget:','if used>=budget:')],1100040,time=10)
def isolated_oracle(s):
    return max([0]+[j-i for i in range(len(s)) for j in range(i+1,len(s)+1) if j-i<len(s) and not set(s[i:j])&set(s[:i]+s[j:])])
add(155,'字符不在外部出现的最长真子串','寻找最长非空连续子串，使其中任何字符都不出现在子串外，并且子串不能等于整个原串；没有则返回0。','一行小写字符串，长度1..100000。','左端只能是某个字符的首次位置，至多26种。逐个向右扫描，出现某字符首次位置早于左端则停止；维护见过字符的最末位置，当右端覆盖它们全部时得到闭合段，排除整串后取最大。','合法左端字符在外部不能出现，因此左端一定为其首次出现。扫描若包含先前出现的字符则这个左端再延长也无法合法。其他情况下只需所有已含字符的最后一次出现都落在段内，即右端达到其最大末位置；这是充分必要条件。枚举所有可能左端与右端后取最大不漏解。','时间O(26n)，空间O(n)含输入，辅助O(26)。',['abcba','amazonservices','aaaa'],'样例1：bcb中b、c都不在外面出现，是长3真子串；来源0已修正。样例2：zonservices长度11，外面只有a、m、a，不与它共享字符。样例3：只要不是整串，里面的a都会在外面出现，无合法非空真子串，答案0。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,10))),[('a'*50000+'b'*50000,50000),('a'*100000,0),(''.join(chr(97+i)*3846 for i in range(25))+'z'*3850,96154)],lambda s:s+'\n',isolated_oracle,
'''def solve(d):
    s=d[0];first={};last={}
    for i,c in enumerate(s):first.setdefault(c,i);last[c]=i
    answer=0;n=len(s)
    for left in first.values():
        end=left
        for right in range(left,n):
            c=s[right]
            if first[c]<left:break
            end=max(end,last[c])
            if right>=end and right-left+1<n:answer=max(answer,right-left+1)
    return str(answer)
''',[('错误接受整串',' and right-left+1<n',''),('缺少外部先前出现检查','if first[c]<left:break','if False:break')],100030,time=6)
BLOCKED={143:'原始正文未明确删除坐标是初始字符串还是每日缩短后坐标，解释混用。abac/ac先删[0,0]再删[1,1]，初始坐标可保留2天、动态坐标只有1天。',151:'原始题干截断于1到N数组，K-level条件未定义，单个排列样例不能恢复规则。',153:'原始写相邻值相等却保证所有元素互异，与返回3的例子冲突；样例暗示平方链但正文没有平方，不能擅自补规则。'}
def matches(s,actual,c):
    if s['n']!=136:return actual.split()==c['expectedOutput'].split()
    try:
        raw=list(map(int,c['input'].split()));n,p=raw[:2];a=raw[2:];b=list(map(int,actual.split()));expected=list(map(int,c['expectedOutput'].split()))
        return len(b)==n and all(v>=old for v,old in zip(b,a)) and sum(b)==sum(a)+p and max(b)==max(expected)
    except (ValueError,TypeError):return False
def execute(path,inputs):
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300,check=True)
    values=json.loads(result.stdout);assert len(values)==len(inputs);return [v.rstrip('\n') for v in values]
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','positive-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[]
    for s in SPECS:
        assert s['bound']<=32*1024*1024
        identifier=f"oa-amazon-{s['n']}";rng=random.Random(SEED+s['n']);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        oracle=[dict(input=s['encode'](x),expectedOutput=str(s['oracle'](x))+'\n') for x in s['samples']+[s['random'](rng) for _ in range(160)]];tests=oracle[:3]+[dict(input=s['encode'](x),expectedOutput=str(y)+'\n') for x,y in s['edges']]+oracle[3:27]
        for c in tests+oracle:assert len(c['input'].encode())<=s['bound'] and '\ufffd' not in c['input']+c['expectedOutput']
        for i,(actual,c) in enumerate(zip(execute(path,[c['input'] for c in oracle+tests]),oracle+tests)):assert matches(s,actual,c),(identifier,i,actual[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];killed=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(identifier,name);changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{identifier}-{j}.py';mp.write_text(changed);outputs=execute(mp,[c['input'] for c in cases]);bad=[i for i,(actual,c) in enumerate(zip(outputs,cases)) if not matches(s,actual,c)];assert bad,(identifier,name,'survived');mutants.append(dict(name=name,code=changed));killed.append(dict(name=name,rejectedByCases=bad))
        if s['n']==136:
            positive=OUT/'positive-controls'/f'{identifier}.py';positive.write_text(code.replace('for i in range(n):','for i in range(n-1,-1,-1):'))
            assert all(matches(s,a,c) for a,c in zip(execute(positive,[c['input'] for c in oracle+cases]),oracle+cases))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Amazon'],description=s['desc']+'\n\n标准I/O与题解由本站独立编写；注明本站的范围不是来源原约束。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('time',4),memoryLimit=s.get('memory',262144),outputLimit=4096,checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        raw=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout;assert '\ufffd' not in raw
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)];source=sources[identifier]
        for folder,data in dict(packages=json.loads(raw),oracles=oracle,mutants=mutants,editorials=dict(schemaVersion=1,id=identifier,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        assert len(cases)<=64 and s.get('time',4)<=10 and (OUT/'packages'/f'{identifier}.json').stat().st_size<128*1024*1024
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(raw.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracle),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=s['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()));print(identifier,'163 oracle,',len(cases)-3,'hidden, 2 normal mutants rejected',flush=True)
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped={f'oa-amazon-{k}':v for k,v in BLOCKED.items()},note='Local batched runpy only, fresh __main__/stdin/stdout per case, not per-case OS isolation; production sandbox required.'),ensure_ascii=False,indent=2)+'\n')
    # Historical recovery reviews are owned by root through resolutions, never duplicated here.
    notes={136:'任意最优最终分配，语义checker允许多解；小oracle枚举全部新增分配。',139:'原始0不能用插入消除，本站无解输出-1。',147:'来源索引冲突，本站明确0-based并修正例2。',149:'遵守来源至少一解的联合保证。',154:'单元素GCD也计，修正全质数样例为1。',155:'依完整定义，abcba中的bcb合法，修正来源0为3。'}
    reviews=[dict(id=f'oa-amazon-{n}',status='blocked' if n in BLOCKED else 'authored',reason=BLOCKED.get(n,notes.get(n,'独立算法/样例/暴力oracle/最大范围/语义负控验证；未执行来源题解。'))) for n in range(136,156)]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
