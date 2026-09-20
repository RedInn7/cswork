"""Independent Salesforce references, exhaustive small oracles and immutable-source review."""
from pathlib import Path
from itertools import combinations,product
from collections import deque,Counter
import json,hashlib,random,subprocess,sys,math
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='salesforce-first';SPECS=[]
def add(number,title,desc,limits,output,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound=3000000,**options):
    SPECS.append(dict(id=f'oa-salesforce-{number}',title=title,desc=desc,limits=limits,output=output,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**options))
def array(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def vector(a):return str(len(a))+'\n'+' '.join(map(str,a))
def lines(x):return '\n'.join(map(str,x))+'\n'
add(1,'三个字符的子序列计数','统计长度恰为3的模式串在文本中出现为子序列的次数。按保留位置三元组区分，不要求连续，重复字母仍按位置计数。','第一行模式，第二行文本。模式长3，文本长1..500000，均只含A..Z。','输出精确整数，不取模，使用64位整数。','逆序维护匹配模式前0、1、2、3个字符的方案数，初始dp[0]=1。','处理文本前缀后，dp[j]计数从该前缀选位置得到模式前j字符的方案。新字符匹配模式第j位时，可接在旧dp[j−1]的每种方案后；倒序更新确保同一文本位置不会重复使用。加上不选择当前字符的旧方案即保持不变量。','时间O(文本长)，额外空间O(1)。',[('ABC','ABCBABC'),('AAA','AAAA'),('ABA','AB')],'三个样例分别有5、4、0种位置选择。',lambda r:(''.join(r.choice('ABC') for _ in range(3)),''.join(r.choice('ABC') for _ in range(r.randint(1,14)))),[(('AAA','A'*500000),str(math.comb(500000,3))),(('ABC','A'*166666+'B'*166667+'C'*166667),str(166666*166667**2)),(('ZZZ','A'*500000),'0'),(('ABA','AB'*250000),str(sum(i*(250000-i) for i in range(250000))))],lines,lambda x:str(sum(''.join(x[1][i] for i in inds)==x[0] for inds in combinations(range(len(x[1])),3))),'''def solve(d):
    pattern,text=d;dp=[1,0,0,0]
    for c in text:
        for j in range(3,0,-1):
            if c==pattern[j-1]:dp[j]+=dp[j-1]
    return str(dp[3])
''',[('正序更新重复使用字符','range(3,0,-1)','range(1,4)'),('擅自取模','str(dp[3])','str(dp[3]%1000000007)')],bound=500005)
def models_encode(v):return str(len(v))+'\n'+''.join(f'{c} {f}\n' for c,f in v)
def models_oracle(v):
    ans=[None]*len(v)
    for mask in range(1<<len(v)):
        chosen=[x for i,x in enumerate(v) if mask>>i&1];k=min(sum(f[0]=='1' for c,f in chosen),sum(f[1]=='1' for c,f in chosen));price=sum(c for c,f in chosen)
        for i in range(k):ans[i]=price if ans[i] is None else min(ans[i],price)
    return vector([-1 if x is None else x for x in ans])
add(2,'双特征模型的各级最低采购成本','每个模型有正费用和两位特征串00/01/10/11。对每个k=1..n，选择一个模型集合，使两种特征各有至少k个模型支持，求最小总价，不可重复购买同一模型。','首行n，随后n行cost feature。1≤n≤1000，1≤cost≤10000。','先输出n，再输出n个答案；不可能的k输出−1。','分别排序01、10、11的费用。将第i便宜的01与第i便宜的10配成一个双特征单位，再与所有11的费用合并排序，逐个求前缀和。','正费用意味着固定选择t个11后，只需各选择k−t个单特征模型且取最便宜者。01和10各自递增，因此对应配对费用也递增；11费用递增。两有序列表的最便宜k项自然满足各列表的前缀依赖，等价于枚举t得到最小成本。00永不改善任何约束。','时间O(n log n)，空间O(n)。',[[(3,'10'),(6,'01'),(9,'11'),(1,'01'),(2,'11'),(5,'10')],[(1,'00'),(5,'10')],[(10,'11'),(2,'01'),(3,'10')]],'结果分别为[2,6,15,26,−1,−1]、[−1,−1]、[5,15,−1]。',lambda r:[(r.randint(1,15),r.choice(['00','01','10','11'])) for _ in range(r.randint(1,9))],[([(10000,'11')]*1000,vector([10000*i for i in range(1,1001)])),([(1,'00')]*1000,vector([-1]*1000)),([(1,'01')]*500+[(10000,'10')]*500,vector([10001*i for i in range(1,501)]+[-1]*500)),([(1,'11')]*499+[(1,'01')]*501,vector(list(range(1,500))+[-1]*501))],models_encode,models_oracle,'''def solve(d):
    n=int(d[0]);a=[];b=[];both=[]
    for i in range(n):
        c=int(d[1+2*i]);f=d[2+2*i]
        if f=='01':a.append(c)
        elif f=='10':b.append(c)
        elif f=='11':both.append(c)
    a.sort();b.sort();units=sorted(both+[x+y for x,y in zip(a,b)]);out=[];total=0
    for i in range(n):
        if i<len(units):total+=units[i];out.append(total)
        else:out.append(-1)
    return str(n)+'\\n'+' '.join(map(str,out))
''',[('配对只支付较贵一项','x+y for x,y','max(x,y) for x,y'),('错误把00算作双特征',"elif f=='11':both.append(c)","elif f in ('11','00'):both.append(c)")],bound=9010)
def bit_oracle(a):return ''.join(str(int(v in a[:i])) for i,v in enumerate(a))+'\n'+''.join(str(int(v in a[i+1:])) for i,v in enumerate(a))
add(3,'前后出现标记','为每个位置分别标记其值是否在更早位置出现、是否在更晚位置出现，返回两条二进制串。当前位置自己不算出现。','首行n，随后n个整数。原始快照恢复：1≤n≤10000，0≤num[i]≤10000；catalog把换行误并为10^40。','第一行更早出现标记，第二行更晚出现标记，每行恰有n位。','一次正向、一次反向扫描，用集合保存已看过的数。','扫描位置i之前的集合恰含所有更小索引的值，查找得到第一条；反向同理得到更大索引的值。先查询后加入排除当前位置自己。','时间O(n)，空间O(n)。',[[1,2,1,3,2],[0],[7,7,7]],'样例1为00101与11000；单元素两行均0；三个7对应011与110。',lambda r:[r.randrange(8) for _ in range(r.randint(1,20))],[([0]*10000,'0'+'1'*9999+'\n'+'1'*9999+'0'),(list(range(10000)),'0'*10000+'\n'+'0'*10000),([10000]*10000,'0'+'1'*9999+'\n'+'1'*9999+'0'),([i%2 for i in range(10000)],'00'+'1'*9998+'\n'+'1'*9998+'00')],array,bit_oracle,'''def solve(d):
    a=list(map(int,d[1:]));seen=set();before=[]
    for v in a:before.append('1' if v in seen else '0');seen.add(v)
    seen=set();after=[]
    for v in reversed(a):after.append('1' if v in seen else '0');seen.add(v)
    return ''.join(before)+'\\n'+''.join(reversed(after))
''',[('交换前后方向',"''.join(before)+'\\n'+''.join(reversed(after))","''.join(reversed(after))+'\\n'+''.join(before)"),('把当前元素也计入','before.append(\'1\' if v in seen else \'0\')','before.append(\'1\')')],bound=60010)
def closest_encode(v):a,g=v;return f'{len(a)} {g}\n'+' '.join(map(str,a))+'\n'
def closest_oracle(v):
    a,g=v
    return str(min(abs(sum(a[i] for i in range(len(a)) if mask>>i&1)-g) for mask in range(1<<len(a))))
add(5,'最接近目标的子序列和','可以删除任意元素包括全部或零个，求剩余子序列之和与goal的最小绝对差。允许负数与空子序列。','首行n goal，第二行n个整数。1≤n≤40，−10⁷≤nums[i]≤10⁷，−10⁹≤goal≤10⁹。','输出最小绝对差。','数组平分，分别生成两半的全部子集和并排序，用一左一右两个指针寻找最接近goal的和。','任意子序列唯一分解为左右两半的选择，枚举和覆盖全部可能。当两和小于目标时，固定较小左和搭配任何更小右和也不可能改善越过目标的方向，因此增加左指针；大于目标时对称减右指针。保留每次差值最小值即可覆盖潜在最优组合。空集合对应和0。','时间O(n·2^(n/2))，空间O(2^(n/2))；保留完整40元素上界。',[([5,-7,3,5],6),([7,-9,15,-2],-5),([1,2,3],-7)],'答案依次0、1、7，第三例必须允许空子序列。',lambda r:([r.randint(-20,20) for _ in range(r.randint(1,12))],r.randint(-80,80)),[((list(2**i for i in range(20))*2,10**9),str(10**9-2*((1<<20)-1))),(([-2**i for i in range(20)]*2,-10**9),str(10**9-2*((1<<20)-1))),(([10**7]*40,-10**9),'1000000000'),(([-10**7]*20+[10**7]*20,1),'1')],closest_encode,closest_oracle,'''def solve(d):
    n,g=map(int,d[:2]);a=list(map(int,d[2:]));left=[0];right=[0]
    for x in a[:n//2]:left+=[s+x for s in left]
    for x in a[n//2:]:right+=[s+x for s in right]
    left.sort();right.sort();i=0;j=len(right)-1;answer=abs(g)
    while i<len(left) and j>=0:
        total=left[i]+right[j];answer=min(answer,abs(total-g))
        if total==g:return '0'
        if total<g:i+=1
        else:j-=1
    return str(answer)
''',[('删除负数候选','a=list(map(int,d[2:]))','a=[abs(int(x)) for x in d[2:]]'),('把精确命中误算为一',"if total==g:return '0'","if total==g:return '1'")],bound=400,timeLimit=6,memoryLimit=262144)
def tree_encode(v):data,edges=v;return str(len(data))+'\n'+' '.join(map(str,data))+'\n'+''.join(f'{a} {b}\n' for a,b in edges)
def tree_oracle(v):
    data,edges=v;n=len(data);adj=[[] for _ in data]
    for a,b in edges:adj[a].append(b);adj[b].append(a)
    need=sum(x<<i for i,x in enumerate(data));cover=[]
    for s in range(n):
        reached={s};front={s}
        for _ in range(2):front={w for x in front for w in adj[x]}-reached;reached|=front
        cover.append(sum(1<<x for x in reached))
    best=2*(n-1)
    for mask in range(1,1<<n):
        size=mask.bit_count()
        if sum(bool(mask>>a&1 and mask>>b&1) for a,b in edges)!=size-1:continue
        seen=0
        for i in range(n):
            if mask>>i&1:seen|=cover[i]
        if seen&need==need:best=min(best,2*(size-1))
    return str(best)
def tree_random(r):
    n=r.randint(2,8);return [r.randrange(2) for _ in range(n)],[(i,r.randrange(i)) for i in range(1,n)]
add(6,'树上两步范围数据收集','可从任意树节点出发，访问某点便收集距离它至多2条边的所有数据。求收集全部数据且回到起点的最少走边次数。来源示例n=11仅9条边、节点5孤立，不满足有效树条件，本站替换为合法样例。','首行n，第二行n个0/1数据标记，随后n−1行边u v。2≤n≤100000，0≤u,v<n，保证输入为有效无向树。','输出最少走边次数，无数据或无需移动时为0。','先反复删除没有数据的叶子，再同时删除剩余树的最外两层叶子。剩余边每条走两次。','无数据叶支没有必须收集的目标，可删除。剩下的叶端都有数据，允许距离2收集意味着从每端去掉两层边后即可从核心覆盖所有目标。任何仍保留的边两侧都有不能从另一侧隔两步收集的目标，闭合行走必须跨越该边并返回，至少两次。核心树深度遍历达到这个下界；核心无边则单点即可完成。','时间O(n)，空间O(n)，不递归遍历深链。',[([1,0,0,0,0,1],[(i,i+1) for i in range(5)]),([1,1,1,1],[(0,1),(0,2),(0,3)]),([0,0],[(0,1)])],'长度6的链两端有数据，走核心边两次即可，答案2；星形树与无数据树均为0。',tree_random,[(([1]*100000,[(i,i+1) for i in range(99999)]),'199990'),(([0]*100000,[(i,i+1) for i in range(99999)]),'0'),(([1]*100000,[(0,i) for i in range(1,100000)]),'0'),(([1]+[0]*99998+[1],[(i,i+1) for i in range(99999)]),'199990')],tree_encode,tree_oracle,'''from collections import deque
def solve(d):
    n=int(d[0]);data=list(map(int,d[1:n+1]));adj=[[] for _ in range(n)];degree=[0]*n;removed=[False]*n
    for i in range(n-1):
        a,b=map(int,d[n+1+2*i:n+3+2*i]);adj[a].append(b);adj[b].append(a);degree[a]+=1;degree[b]+=1
    queue=deque(i for i in range(n) if degree[i]<=1 and data[i]==0)
    while queue:
        u=queue.popleft()
        if removed[u]:continue
        removed[u]=True
        for v in adj[u]:
            if not removed[v]:degree[v]-=1;degree[u]-=1
            if not removed[v] and degree[v]==1 and data[v]==0:queue.append(v)
    queue=deque(i for i in range(n) if not removed[i] and degree[i]==1)
    for _ in range(2):
        for _ in range(len(queue)):
            u=queue.popleft();removed[u]=True
            for v in adj[u]:
                if not removed[v]:degree[v]-=1;degree[u]-=1
                if not removed[v] and degree[v]==1:queue.append(v)
    return str(sum(degree[i] for i in range(n) if not removed[i]))
''',[('只剥一层','for _ in range(2):','for _ in range(1):'),('漏掉返回起点路程','str(sum(degree[i] for i in range(n) if not removed[i]))','str(sum(degree[i] for i in range(n) if not removed[i])//2)')],bound=1600020)
def mountain_oracle(v):
    n,lo,hi=v;best=None
    for p in product(range(lo,hi+1),repeat=n):
        if any(all(p[i]<p[i+1] for i in range(peak)) and all(p[i]>p[i+1] for i in range(peak,n-1)) for peak in range(1,n-1)):
            if best is None or p>best:best=p
    return '-1' if best is None else vector(best)
def mountain_random(r):return r.randint(1,7),r.randint(1,3),5
add(7,'字典序最大的严格山形序列','构造n个范围[lo,hi]内的整数，必须先严格递增再严格递减，峰值不在两端，两阶段均至少有一条相邻边。求字典序最大序列；无解输出−1。原例10,11,10,9,8而非全降11,10,...支持禁止空上升段。','一行n lo hi。原文无数值界；本站1≤n≤200000，1≤lo≤hi≤10⁹。','无解仅输出−1；有解先输出n，再输出n个序列元素。','令d=hi−lo+1。至少需要3个位置，最多2d−1个。为让第一项最大，使用最短可行上升段：上升边数p=max(1,n−d)，起点hi−p，逐一递增到hi，再逐一下降。','峰值提高至hi不减少可用空间且能改善字典序。峰右至多容纳d−1个元素，所以左侧上升边至少n−d，并且至少1；取最小p使首项hi−p最大。固定首项后逐次取尽可能大的下一个数，但达到hi前须留足p个上升位置，故只能连续增1；到峰后每次减1最大化对应位置，且由长度界保证不低于lo。','时间O(n)，输出空间O(n)。',[(5,1,2),(5,4,11),(6,5,10)],'结果分别无解、[10,11,10,9,8]、[9,10,9,8,7,6]。',mountain_random,[((1,1,10),'-1'),((2,1,10),'-1'),((200000,1,100000),'-1'),((199999,1,100000),vector(list(range(1,100001))+list(range(99999,0,-1))))],lambda v:' '.join(map(str,v))+'\n',mountain_oracle,'''def solve(d):
    n,lo,hi=map(int,d);width=hi-lo+1
    if n<3 or n>2*width-1:return '-1'
    p=max(1,n-width);out=list(range(hi-p,hi+1))+list(range(hi-1,hi-(n-p),-1))
    return str(n)+'\\n'+' '.join(map(str,out))
''',[('错误允许无上升段','p=max(1,n-width)','p=max(0,n-width)'),('把允许长度少算一','n>2*width-1','n>=2*width-1')],bound=40)
def folds_oracle(v):
    def f(a,b):
        dist={a:0};queue=deque([a])
        while queue:
            x=queue.popleft()
            if x==b:return dist[x]
            for y in range((x+1)//2,x):
                if y>=b and y not in dist:dist[y]=dist[x]+1;queue.append(y)
    h,w,a,b=v;return str(f(h,a)+f(w,b))
def folds_random(r):
    h,w=r.randint(1,30),r.randint(1,30);return h,w,r.randint(1,h),r.randint(1,w)
add(8,'纸张折叠到指定长宽','一次沿一条边平行的折线折叠，可以不在正中；只改变对应维度，目标尺寸不旋转。一次折叠能把长度L变为[L/2,L)内的任意长度。求精确达到h1,w1的最少次数。','一行h w h1 w1。原文保证h1≤h且w1≤w，无数值上界；本站四者为1..10⁹整数。','输出最少折叠次数。','每个维度分别求最小t使target×2^t≥original，两者相加；用整数翻倍避免浮点误差。','一次折叠覆盖原长至少一半，因此t次后目标至少original/2^t，是必要条件。反过来先对折t−1次，当前长度不超过2倍目标且仍大于目标，最后一次非居中折叠恰到目标。两个维度各次操作互不替代，相加即最优。','时间O(log h+log w)，空间O(1)。',[(8,4,6,1),(5,7,5,7),(9,9,1,1)],'答案为3、0、8；第一例高度8可一次折到6，不能限定正中对折。',folds_random,[((10**9,10**9,1,1),'60'),((10**9,10**9,10**9,10**9),'0'),((2**29,2**29,1,1),'58'),((2**29+1,2**29+1,1,1),'60')],lambda v:' '.join(map(str,v))+'\n',folds_oracle,'''def solve(d):
    h,w,a,b=map(int,d);count=0
    while a<h:a*=2;count+=1
    while b<w:b*=2;count+=1
    return str(count)
''',[('多算恰好达到尺寸','while a<h:','while a<=h:'),('遗漏宽度操作','while b<w:b*=2;count+=1','while b<w:b*=2')],bound=50)
def digit_encode(v):a,l,r=v;return f'{len(a)} {l} {r}\n'+' '.join(map(str,a))+'\n'
def digit_oracle(v):a,l,r=v;return str(sum(len(set(str(x)))==len(str(x)) for x in a[l:r+1]))
def digit_random(r):
    a=[r.randrange(10000) for _ in range(r.randint(1,20))];l=r.randrange(len(a));return a,l,r.randrange(l,len(a))
add(9,'指定下标范围内数字不重复的元素','给定数字列表，统计0-based闭下标区间[l,r]内，十进制表示没有重复数字的元素个数。区间不是数值范围，重复出现的合法元素分别计数。原示例解释误把51/60写成5/6，本站按三个样例一致的下标语义修正。','首行n l r，第二行n个非负整数。原文无数值界；本站1≤n≤200000，0≤l≤r<n，0≤numbers[i]≤10⁹，普通十进制无多余前导零。','输出元素个数。','逐项仅检查目标下标区间，用10位掩码记录十进制数字，遇重复即无效。0本身是一位数字且合法。','数字掩码在每一步恰记录该元素已出现的数字，重复位等价于重复数字。仅访问闭区间下标并逐个累加，因此既不受区间外值影响，也不会把相同数值不同位置合并。','时间O(n log V)，空间O(1)，除读入外。',[([1,2,11,55,989,51,60,7007],1,5),([1,2,11,55,989,51,60,7007],0,7),([1,2,11,55,989,51,60,7007],5,7)],'三个答案2、4、2；第一例下标1..5的合法数是2、51。',digit_random,[(([0]*200000,0,199999),'200000'),(([10**9]*200000,0,199999),'0'),(([123456789]*200000,0,199999),'200000'),(([11]*199999+[102],199999,199999),'1')],digit_encode,digit_oracle,'''def solve(d):
    n,l,r=map(int,d[:3]);answer=0
    for token in d[3+l:4+r]:
        mask=0;valid=True
        for c in token:
            bit=1<<int(c)
            if mask&bit:valid=False;break
            mask|=bit
        answer+=valid
    return str(answer)
''',[('遗漏右端点','d[3+l:4+r]','d[3+l:3+r]'),('错误忽略重复零','if mask&bit:','if bit!=1 and mask&bit:')],bound=2200030)
def binary_oracle(s):return str(sum(s[i:j].count('0')*2==j-i and sum(a!=b for a,b in zip(s[i:j],s[i+1:j]))==1 for i in range(len(s)) for j in range(i+2,len(s)+1)))
add(10,'两个等长二进制段的子串数量','统计形如0^k1^k或1^k0^k且k≥1的连续子串。按起止下标计数，重复内容分别计数；不是所有0/1数目相等的子串。','一行非空二进制串。原文无数值界，本站长度1..200000。','输出符合条件的子串数。','将字符串按连续相同字符分段，相邻两段长度为a,b时贡献min(a,b)。','每个合法子串恰跨越一个段边界，两侧长度必须相等，可以取1至min(a,b)。不同边界或不同长度确定不同区间，反之所有合法区间均被计数一次。','时间O(n)，空间O(1)。',['10101','00110011','000'],'答案分别4、6、0。',lambda r:''.join(r.choice('01') for _ in range(r.randint(1,25))),[('0'*200000,'0'),('01'*100000,'199999'),('0'*100000+'1'*100000,'100000'),('000111'*33333,'199995')],lambda s:s+'\n',binary_oracle,'''def solve(d):
    s=d[0];previous=0;current=1;answer=0
    for i in range(1,len(s)):
        if s[i]==s[i-1]:current+=1
        else:answer+=min(previous,current);previous=current;current=1
    return str(answer+min(previous,current))
''',[('每段取最大长度','min(previous,current)','max(previous,current)'),('遗漏最后边界','answer+min(previous,current)','answer')],bound=200001)
def common_oracle(v):
    x,y=v;best=0
    for i in range(len(y)):
        for j in range(i+1,len(y)+1):
            it=iter(x)
            if all(any(z==c for z in it) for c in y[i:j]):best=max(best,j-i)
    return str(best)
add(12,'作为Y子串的最长X子序列','找最长字符串s，使它是X的子序列且是Y的连续子串，返回长度。当前条目原文仅标题/函数名/示例，已用同快照salesforce-longest-subsequence-which-is-a-substring的完整正文交叉确认；无匹配时长度0。','两行分别为X和Y。来源未给规模或字母范围，本站为非空小写字母串，各长1..2000。','输出最大长度。','按X字符逐行更新dp[j]：X已处理前缀内，能形成的以Y第j字符结尾的连续片段最大长度。相等可由旧dp[j−1]+1转移，不相等只能跳过X当前字符。','跳过X字符保留旧dp[j]；若用当前字符，必须与Y[j−1]相等且前一个目标字符紧接Y[j−2]，故唯一允许延伸是旧dp[j−1]+1。两种选择覆盖所有子序列方案，同时不允许跳过Y内部字符。取所有结尾最大值即答案。','时间O(|X||Y|)，空间O(|Y|)。',[('hackerranks','hackers'),('abcd','abdc'),('abc','zz')],'答案7、3、0；第二例abd是X子序列且Y连续子串。',lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,12))),''.join(r.choice('abc') for _ in range(r.randint(1,12)))),[(('a'*2000,'a'*2000),'2000'),(('a'*2000,'b'*2000),'0'),(('ab'*1000,'a'*1000+'b'*1000),'1001'),(('a'*1999+'b','b'+'a'*1999),'1999')],lines,common_oracle,'''def solve(d):
    x,y=d;dp=[0]*(len(y)+1)
    for c in x:
        for j in range(len(y),0,-1):
            if c==y[j-1]:dp[j]=max(dp[j],dp[j-1]+1)
    return str(max(dp))
''',[('按正序重复使用X位置','range(len(y),0,-1)','range(1,len(y)+1)'),('不允许跳过X字符',"if c==y[j-1]:dp[j]=max(dp[j],dp[j-1]+1)","if c==y[j-1]:dp[j]=dp[j-1]+1\n            else:dp[j]=0")],bound=4002)
def idle_encode(v):return v[0]+'\n'+str(v[1])+'\n'
def longest_run(s):return max(len(list(g)) for _,g in __import__('itertools').groupby(s))
def idle_random(r):
    n=r.randint(1,11);return ''.join(r.choice('ab') for _ in range(n)),r.randint(0,n)
def idle_oracle(v):
    s,k=v;best=len(s)
    for mask in range(1<<len(s)):
        if mask.bit_count()<=k:
            t=''.join(('b' if c=='a' else 'a') if mask>>i&1 else c for i,c in enumerate(s));best=min(best,longest_run(t))
    return str(best)
add(13,'最小化GPU最长连续使用长度','a/b串表示每次使用的GPU，可翻转至多switchCount个位置，求最长同字符连续段的最小可能长度。原说明含非法字符及改动后长度缩短的错例，本站保持每次只改一个字符。','第一行非空a/b串，第二行switchCount。原文无数值界；本站长度1..200000，0≤switchCount≤长度。','输出最小最长段长。','长度1必须变成交替串，单独统计两种交替模板失配数。目标L≥2时，原长段r至少且恰需floor(r/(L+1))次翻转；二分最小可行L。','L=1的所有可行串只有两个交替模板。L≥2时，每次翻转能把原长段打断，r个字符需至少floor(r/(L+1))个断点；可在每L+1个位置选一次并在末尾调整断点，使端点不与邻段形成更长段，恰达该数。各原段独立相加，因此可行性随L单调，二分得到最小值。','时间O(n log n)，空间O(n)保存段长。',[('aabbbbaaaa',2),('aaaa',0),('aabb',1)],'答案2、4、2；第一例可改成aababbaaba，长度保持10且最长段2。',idle_random,[(('a'*200000,0),'200000'),(('a'*200000,100000),'1'),(('ab'*100000,0),'1'),(('a'*200000,66666),'2')],idle_encode,idle_oracle,'''def solve(d):
    s=d[0];k=int(d[1]);n=len(s);bad=sum(c!=('a' if i%2==0 else 'b') for i,c in enumerate(s))
    if min(bad,n-bad)<=k:return '1'
    runs=[];count=1
    for i in range(1,n):
        if s[i]==s[i-1]:count+=1
        else:runs.append(count);count=1
    runs.append(count);lo=2;hi=n
    while lo<hi:
        mid=(lo+hi)//2
        if sum(r//(mid+1) for r in runs)<=k:hi=mid
        else:lo=mid+1
    return str(lo)
''',[('遗漏交替特判',"if min(bad,n-bad)<=k:return '1'","if False:return '1'"),('把最多翻转写成严格少于','for r in runs)<=k','for r in runs)<k')],bound=200010)
def groups_encode(v):a,sizes=v;return f'{len(a)} {len(sizes)}\n'+' '.join(map(str,a))+'\n'+' '.join(map(str,sizes))+'\n'
def groups_oracle(v):
    a,sizes=v
    def visit(rest,i):
        if i==len(sizes):return 0
        best=0
        for inds in combinations(range(len(rest)),sizes[i]):
            chosen=[rest[j] for j in inds];others=[x for j,x in enumerate(rest) if j not in inds]
            best=max(best,max(chosen)-min(chosen)+visit(others,i+1))
        return best
    return str(visit(a,0))
def groups_random(r):
    n=r.randint(1,8);cuts=sorted(r.sample(range(1,n),r.randrange(n)));bounds=[0]+cuts+[n]
    return [r.randint(1,20) for _ in range(n)],[b-a for a,b in zip(bounds,bounds[1:])]
add(16,'指定批次大小的最大效率和','将所有服务器恰好分配一次到给定大小的批次；每批效率是最大容量−最小容量，单元素批次为0。求总效率最大值。该定义与每元素恰用一次由原始HTML恢复。','首行n k，第二行n个capacity，第三行k个numServers。1≤n≤200000，1≤k≤n，容量1..10⁹，组大小均≥1且和为n。','输出最大效率和，用64位整数。','令q为大小至少2的组数，将全局最大的q个容量用作组最大值、最小的q个作组最小值，其余元素填入余下名额。','每个非单元素组恰贡献一个最大值和一个最小值，故总和不超过最大q项之和减最小q项之和。把这两组极值各配一个给每个非单组，其余所有容量都在极值之间，任意填满指定余量不改变极值；单元素组占用剩余项，达到上界。','时间O(n log n)，空间O(n)。',[([3,6,1,2],[1,3]),([1,2,3,4],[4]),([4,2,1],[1,1,1])],'答案5、3、0。',groups_random,[(([1]*100000+[10**9]*100000,[2]*100000),str(100000*(10**9-1))),(([1]*200000,[1]*200000),'0'),((list(range(1,200001)),[200000]),'199999'),(([10**9]*200000,[2]*100000),'0')],groups_encode,groups_oracle,'''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:2+n]));sizes=list(map(int,d[2+n:]));q=sum(x>=2 for x in sizes)
    return str(sum(a[n-q:])-sum(a[:q]))
''',[('把单元素批次也算作极差','q=sum(x>=2 for x in sizes)','q=k'),('只算全局一组极差','sum(a[n-q:])-sum(a[:q])','a[-1]-a[0]')],bound=3600030)
def develop_encode(v):a,b=v;return str(len(a))+'\n'+' '.join(map(str,a))+'\n'+' '.join(map(str,b))+'\n'
def develop_random(r):
    n=r.randint(1,10);return [r.randint(1,20) for _ in range(n)],[r.randint(1,20) for _ in range(n)]
def develop_oracle(v):
    a,b=v;n=len(a)
    return str(min(max(sum(b[i] for i in range(n) if mask>>i&1),max([a[i] for i in range(n) if not(mask>>i&1)]+[0])) for mask in range(1<<n)))
add(18,'无限并行开发与串行集成的最短工期','每个功能二选一：开发用developmentTime[i]，集成用integrationTime[i]。开发由足够多成员同时进行，集成仅组长一人顺序进行，两类工作可重叠，求全部完成的最短时间。并行/串行条件由原始HTML恢复。','首行n，随后两行分别为开发与集成耗时。原文无数值界；本站1≤n≤200000，两种耗时均1..10⁹。','输出最短工期。中间集成耗时和须64位。','二分工期T。开发耗时>T的功能必须集成，其集成耗时和≤T时可行；其余全并行开发即可。','任何T内完成方案都必须将开发超时的功能集成，因此此耗时和≤T是必要条件。若条件成立，组长串行集成这些功能，其余从0时刻同时开发，全部≤T，故也充分。可行性随T单调，上界max(developmentTime)可全开发达到。','时间O(n log maxTime)，空间O(n)。',[([10,12,13,8,15],[1,2,1,1,1]),([2,100],[100,3]),([1],[100])],'答案6、3、1；第二例开发和集成并行，不能把2与3相加。',develop_random,[(([10**9]*200000,[1]*200000),'200000'),(([1]*200000,[10**9]*200000),'1'),(([10**9]*200000,[10**9]*200000),'1000000000'),(([5]*100000+[10**9]*100000,[10**9]*100000+[1]*100000),'100000')],develop_encode,develop_oracle,'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:n+1]));b=list(map(int,d[n+1:]));lo=0;hi=max(a)
    while lo<hi:
        mid=(lo+hi)//2;needed=sum(y for x,y in zip(a,b) if x>mid)
        if needed<=mid:hi=mid
        else:lo=mid+1
    return str(lo)
''',[('等于目标工期也强制集成','if x>mid','if x>=mid'),('错误只比较最大集成项','needed=sum(y for x,y in zip(a,b) if x>mid)','needed=max([y for x,y in zip(a,b) if x>mid]+[0])')],bound=4400020)
def scheduler_encode(v):n,p,a,b=v;return f'{n} {len(p)} {a} {b}\n'+' '.join(map(str,p))+'\n'
def scheduler_oracle(v):
    n,p,a,b=v;points=set(p)
    def f(start,length):
        count=sum(i in points for i in range(start,start+length));direct=a if count==0 else b*count*length
        if length==1:return direct
        return min(direct,f(start,length//2)+f(start+length//2,length//2))
    return str(f(1,n))
def scheduler_random(r):
    n=2**r.randrange(6);return n,r.sample(range(1,n+1),r.randint(1,n)),r.randint(1,20),r.randint(1,20)
add(19,'稀疏高优先级进程的分治调度','n个1-based进程形成连续区间。长度大于1时可等分两半继续分配；也可直接执行该区间。没有高优先级进程则费用normal_time，否则费用priority_time×高优先级数量×区间长度。总时间为所有处理器费用之和，不是最大值。','首行n k normal_time priority_time，第二行k个高优先级下标。原范围1≤n≤10⁹且n为2的幂，1≤k≤min(n,100000)，下标1..n。本站合法进程列表下标互异，原文未给时间因子范围，本站均1..10⁹。','输出最小总费用。中间直接费用可超64位，使用足够宽整数；不得按n大小分配数组。','排序高优先级下标，递归区间携带对应下标范围，用二分划分左右子范围。空区间立即返回normal_time，否则比较直接费用与两半最优费用之和。','每个区间的合法决策只有直接执行或等分，后一种决策两半互相独立且费用相加，因此取两者较小值是完整递推。空区间直接执行最便宜，拆分只增加正费用，可立即剪枝。排序后二分提供精确数量，不会访问没有高优先级的完整大数组。','时间O(k log k log n)的安全上界，递归栈O(log n)，排序空间O(k)。',[(4,[1],2,2),(1,[1],5,3),(8,[1,8],1,1)],'答案6、3、6；第三例两个端点可分别拆到单点并为中间空区间支付费用。',scheduler_random,[((2**29,[1],1,1),'30'),((2**29,[1],10**9,1),str(2**29)),((2**16,list(range(1,2**16+1)),1,10**9),str(2**16*10**9)),((2**29,list(range(1,100001)),1,1),'100019')],scheduler_encode,scheduler_oracle,'''from bisect import bisect_left
def solve(d):
    n,k,a,b=map(int,d[:4]);p=sorted(map(int,d[4:]))
    def visit(start,length,left,right):
        if left==right:return a
        direct=b*(right-left)*length
        if length==1:return direct
        mid=start+length//2;split=bisect_left(p,mid,left,right)
        return min(direct,visit(start,length//2,left,split)+visit(mid,length//2,split,right))
    return str(visit(1,n,0,k))
''',[('误将两处理器并行时间取最大','visit(start,length//2,left,split)+visit(mid,length//2,split,right)','max(visit(start,length//2,left,split),visit(mid,length//2,split,right))'),('漏乘区间长度','b*(right-left)*length','b*(right-left)')],bound=1100100)
def graph_encode(v):n,edges,infected=v;return f'{n} {len(edges)}\n'+' '.join(map(str,infected))+'\n'+''.join(f'{a+1} {b+1}\n' for a,b in edges)
def graph_oracle(v):
    n,edges,infected=v;best=(n+1,n)
    for removed in range(n):
        bad={i for i,x in enumerate(infected) if x and i!=removed}
        while True:
            more={b for a,b in edges if a in bad and b!=removed}|{a for a,b in edges if b in bad and a!=removed}
            if more<=bad:break
            bad|=more
        best=min(best,(len(bad),removed))
    return str(best[1]+1)
def graph_random(r):
    n=r.randint(1,10);edges=[(a,b) for a in range(n) for b in range(a+1,n) if r.random()<.22]
    return n,edges,[r.randrange(2) for _ in range(n)]
add(20,'删除一个节点阻止恶意软件传播','删除恰好一个节点及其关联边，再从其余初始感染节点开始沿无向边传播，直到不再新增。可删除健康节点，求最终感染数最少的删除方案，同分取最小1-based编号。','首行n m，第二行n个0/1初始感染标记，随后m行1-based边u v。1≤n≤1000，0≤m≤min(n(n−1)/2,1000)，本站按简单无向图，边无重复且无自环。','输出应删除的节点编号。即使没有感染也须删除一个节点。','枚举所有待删节点，每次多源BFS模拟剩余图传播，比较最终感染数量与编号。','删除后的传播闭包正是从所有未删感染源可达的节点集合。BFS恰遍历这个集合，因此每个候选费用准确；枚举包括健康割点在内的所有n个节点，按感染数优先、编号次优比较即为全局最优。','时间O(n(n+m))，额外空间O(n+m)。',[(9,[(0,1),(1,2),(3,4),(5,6),(6,7)],[0,0,1,0,1,0,0,0,0]),(5,[(0,1),(1,2),(2,3),(3,4)],[1]*5),(6,[(0,2),(1,2),(2,3),(3,4),(4,5)],[1,1,0,0,0,0])],'答案3、1、3。第三例健康节点3是割点，删它比只删任一感染源更好。原例1传播集合漏写节点1，删除答案3不变。',graph_random,[((1000,[(i,i+1) for i in range(999)],[1]*1000),'1'),((1000,[],[0]*1000),'1'),((1000,[(0,i) for i in range(1,1000)],[0,1,1]+[0]*997),'1'),((1000,[(i,(i+1)%1000) for i in range(1000)],[1]+[0]*999),'1')],graph_encode,graph_oracle,'''from collections import deque
def solve(d):
    n,m=map(int,d[:2]);infected=list(map(int,d[2:2+n]));adj=[[] for _ in range(n)]
    for i in range(m):
        a,b=map(int,d[2+n+2*i:4+n+2*i]);a-=1;b-=1;adj[a].append(b);adj[b].append(a)
    best=n+1;answer=0
    for removed in range(n):
        seen=[False]*n;seen[removed]=True;queue=deque()
        for i,v in enumerate(infected):
            if v and i!=removed:seen[i]=True;queue.append(i)
        count=0
        while queue:
            u=queue.popleft();count+=1
            for v in adj[u]:
                if not seen[v]:seen[v]=True;queue.append(v)
        if count<best:best=count;answer=removed
    return str(answer+1)
''',[('只枚举感染源','for removed in range(n):','for removed in ([i for i,v in enumerate(infected) if v] or [0]):'),('同分选大编号','if count<best:','if count<=best:')],bound=12020)
BLOCKED={4:'raw正文截断，spam关键词命中次数阈值和分词规则缺失，不能靠唯一例子猜。',11:'raw正文残缺，条件仅来自明确标注educated guess的解释，不作为判定规则。',14:'两项perfect pair条件均缺失。',15:'原文残缺，删除词序列和按字符子序列过滤均符合唯一例子，不能擅选。',17:'swap另一端未给出，强度文字arr[i]+1又与样例i*arr[i]冲突。'}
for spec in SPECS:
    if spec['id']=='oa-salesforce-5':
        spec['edges'].append((([2*((i*791919+123457)%5000001)*(-1 if i%2 else 1) for i in range(40)],1),'1'))
    if spec['id']=='oa-salesforce-19':
        # Unit costs scaled by 10^9; empty complement decomposes into 19 dyadic blocks.
        spec['edges'].append(((2**29,list(range(1,100001)),10**9,10**9),str(100019*10**9)))
def execute(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=600)
    assert p.returncode==0,(path,p.stderr[-2000:]);return json.loads(p.stdout)
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[]
    for index,s in enumerate(SPECS):
        ident=s['id'];rng=random.Random(20262000+index);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=inp,expectedOutput=answer,hidden=i>=3,weight=1) for i,(inp,answer) in enumerate([(c['input'],c['expectedOutput']) for c in oracles[:3]]+[(s['encode'](v),a+'\n') for v,a in s['edges']]+[(c['input'],c['expectedOutput']) for c in oracles[3:27]])]
        for c in oracles+cases:assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
        actual=execute(path,[c['input'] for c in oracles+cases]);assert len(actual)==len(oracles+cases)
        for i,(c,a) in enumerate(zip(oracles+cases,actual)):assert a.split()==c['expectedOutput'].split(),(ident,i,a[:150],c['expectedOutput'][:150])
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code;changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed);outputs=execute(p,[c['input'] for c in cases]);assert len(outputs)==len(cases)
            rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if a.split()!=c['expectedOutput'].split()];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Salesforce'],description=s['desc']+'\n\n输入输出由本站整理。',input=s['limits'],output=s['output'],explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('timeLimit',4),memoryLimit=s.get('memoryLimit',262144),outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True);assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; normal-exit mutants rejected',flush=True)
    reviews=[dict(id=f'oa-salesforce-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,'独立编写；原始快照e66f809f4c953bce129f68491726176615db6afc核对，本站范围单独标明。'+next(s['desc'] for s in SPECS if s['id']==f'oa-salesforce-{i}') if i not in BLOCKED else BLOCKED[i])) for i in range(1,21)]
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'reviews':dict(schemaVersion=1,items=reviews),'validation':dict(schemaVersion=1,seed=20262000,problems=reports,skipped={f'oa-salesforce-{k}':v for k,v in BLOCKED.items()},note='Local independent oracles and normal-exit wrong programs; real sandbox required. Source hash preserved; restored rules documented in statements/reviews.')} .items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
