"""IBM21–40: independent authoring against immutable e66f809 raw statements."""
from pathlib import Path
from collections import Counter, deque
from functools import lru_cache
from itertools import product, combinations
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def bitonic_oracle(a):
    best=0
    for l in range(len(a)):
        for h in range(l,len(a)):
            for p in range(l,h+1):
                if all(a[i]<=a[i+1] for i in range(l,p)) and all(a[i]>=a[i+1] for i in range(p,h)):best=max(best,h-l+1)
    return best
add(21,'最长先升后降连续子数组','求最长连续子数组，其元素先非递减再非递增；任一侧可只有峰顶一个元素，允许相等。','第一行n，第二行n个整数。1≤n≤100000，1≤元素≤10^9。','分别计算以每个位置结束的非递减长度和从该位置开始的非递增长度，枚举峰顶相加减一。','任意合法区间有一个峰顶，其两侧分别受该位置的两种最大长度限制。反之这两个最大段在峰顶拼接仍合法，故枚举值的最大值恰为最优。','时间O(n)，空间O(n)。',[[10,8,9,15,12,6,7],[5,1,2,1,4,5],[4,4,4]],'分别5、3、3，相等元素可以跨过峰顶。',lambda r:[r.randint(1,9) for _ in range(r.randint(1,10))],[(list(range(1,100001)),100000),([10**9]*100000,100000),([2,1]*50000,3)],arr,bitonic_oracle,"def solve(d):\n    a=list(map(int,d[1:]));n=len(a);up=[1]*n;down=[1]*n\n    for i in range(1,n):\n        if a[i]>=a[i-1]:up[i]=up[i-1]+1\n    for i in range(n-2,-1,-1):\n        if a[i]>=a[i+1]:down[i]=down[i+1]+1\n    return str(max(up[i]+down[i]-1 for i in range(n)))\n",[('严格递增丢掉相等','a[i]>=a[i-1]','a[i]>a[i-1]'),('峰顶重复计数','up[i]+down[i]-1','up[i]+down[i]')],1100020)
def items_oracle(x):
    n,a,k=x;owned=set(a);available=[i for i in range(1,n+1) if i not in owned]
    return len(owned)+max((len(t) for z in range(len(available)+1) for t in combinations(available,z) if sum(t)<=k),default=0)
add(22,'预算内拥有最多不同商品','商店出售编号1至n的商品，编号i价格为i。你已经拥有arr中的商品，求预算k内购买后拥有的不同商品总数。已拥有商品即使不在商店出售范围内也计入，重复编号只计一次。','第一行n m k，第二行m个已拥有编号。1≤n≤10^6，1≤m≤10^5，1≤k≤10^9，1≤arr[i]≤10^6。','去重已拥有编号，从1至n依次购买尚未拥有且买得起的商品，买不起时停止。','已拥有不同编号全部免费计入；新增商品各贡献1。若方案买了更贵未拥有商品却不买更便宜者，交换后数量不变且成本不增，反复交换得到按价递增选择的前缀，贪心因此最优。','时间O(n+m)，空间O(m)。',[(5,[3,6],8),(3,[1,1],2),(2,[6],1)],'分别5、2、2。第一例已拥有的6仍计入，新增1、2、4。',lambda r:(r.randint(1,9),[r.randint(1,12) for _ in range(r.randint(1,8))],r.randint(1,30)),[((10**6,[10**6]*100000,10**9),44721),((10**6,list(range(1,100001)),1),100000)],lambda x:f'{x[0]} {len(x[1])} {x[2]}\n'+seq(x[1])+'\n',items_oracle,"def solve(d):\n    n,m,k=map(int,d[:3]);owned=set(map(int,d[3:]));answer=len(owned)\n    for v in range(1,n+1):\n        if v in owned:continue\n        if v>k:break\n        k-=v;answer+=1\n    return str(answer)\n",[('丢失店外已拥有编号','answer=len(owned)','answer=sum(v<=n for v in owned)'),('重复拥有也计数','answer=len(owned)','answer=m')],7000040)
def even_oracle(a):return max(sum(a[i] for i in range(len(a)) if mask>>i&1) for mask in range(1<<len(a)) if sum(a[i] for i in range(len(a)) if mask>>i&1)%2==0)
add(23,'可为空子集的最大偶数和','从整数数组中任选若干项，使总和为偶数且最大，允许不选任何项。至少有一个偶数元素，元素可为负。','第一行n，第二行数组。来源无数值界，本站1≤n≤200000，−10^9≤元素≤10^9，至少有一个偶数。','维护已处理前缀可取得的最大偶数和、最大奇数和，每项选择不取或取。','初始空集给偶数和0，奇数状态不可达。处理一项时任意子集唯一分为不含该项和包含该项两类；包含时从相应旧奇偶状态加该值。因此逐项转移覆盖全部子集且各奇偶只保留最大者足够。','时间O(n)，空间O(1)。',[[2,3,6,-5,10,1,1],[-2,-3],[1,1,2]],'分别22、0、4，负数不强制选入。',lambda r:[2*r.randint(-5,5)]+[r.randint(-9,9) for _ in range(r.randint(0,10))],[([10**9]*200000,200000*10**9),([-10**9]*200000,0),([999999999]*199999+[2],199998*999999999+2)],arr,even_oracle,"def solve(d):\n    even=0;odd=None\n    for v in map(int,d[1:]):\n        if v%2:even,odd=max(even,odd+v if odd is not None else even),max(odd if odd is not None else v,even+v)\n        else:even,odd=max(even,even+v),None if odd is None else max(odd,odd+v)\n    return str(even)\n",[('不能选空集','even=0;odd=None','even=-10**18;odd=None'),('只累加正偶数','return str(even)','return str(sum(max(0,int(v)) for v in d[1:] if int(v)%2==0))')],2400020)
def abc_oracle(s):
    for blocks in range(1,len(s)+1):
        it=iter('abc'*blocks)
        if all(any(c==v for v in it) for c in s):return blocks*3-len(s)
add(24,'插入最少字符组成abc重复串','给定只含a、b、c的非空字符串，可以在任意位置插入字符，求成为若干个abc拼接串所需最少插入数。','一行字符串，1≤长度≤100000。','当相邻字符不严格递增时必须开启下一个abc块；块数乘3再减原长度。','一个abc块中保留的原字符必然严格递增，因此每个非递增边界强制切块。按这些边界分块后每块都是abc的子序列，可补成abc，达到强制块数下界。','时间O(n)，空间O(1)。',['b','aaa','abcabc'],'分别2、6、0。',lambda r:''.join(r.choice('abc') for _ in range(r.randint(1,12))),[('a'*100000,200000),('abc'*33333+'a',2),('cba'*33333+'c',100001)],lambda s:s+'\n',abc_oracle,"def solve(d):\n    s=d[0];blocks=1\n    for i in range(1,len(s)):\n        if s[i]<=s[i-1]:blocks+=1\n    return str(3*blocks-len(s))\n",[('相等字符错误合块','s[i]<=s[i-1]','s[i]<s[i-1]'),('遗漏第一块','blocks=1','blocks=0')],100001)
def missing_oracle(x):
    a,k=x;i=0;found=0
    while found<k:
        i+=1
        if i not in a:found+=1
    return i
add(25,'第k个缺失的正整数','求没有在数组中出现的第k小正整数，重复项不产生额外占位。','第一行n k，第二行数组。1≤n≤200000，1≤元素≤10^9，1≤k≤10^12。','将数组去重排序，从1开始逐段计算相邻出现值间的缺口，定位k所在缺口，或落在最大值之后。','相邻不同出现值之间恰好全是缺失数，且这些缺口按数值顺序互不重叠。逐段减去缺口长度保留当前秩，首次容纳该秩的缺口给出唯一答案。','时间O(n log n)，空间O(n)。',[([1,4,7,3,4],5),([1,1],1),([9],2)],'分别9、2、2。',lambda r:([r.randint(1,20) for _ in range(r.randint(1,12))],r.randint(1,30)),[((list(range(1,200001)),10**12),10**12+200000),(([10**9]*200000,10**12),10**12+1)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',missing_oracle,"def solve(d):\n    n,k=map(int,d[:2]);previous=0\n    for v in sorted(set(map(int,d[2:]))):\n        gap=v-previous-1\n        if k<=gap:return str(previous+k)\n        k-=gap;previous=v\n    return str(previous+k)\n",[('重复元素占位','sorted(set(map(int,d[2:])))','sorted(map(int,d[2:]))'),('从零而非正数开始','previous=0','previous=-1')],2200040)
def xor_oracle(x):
    s,k=x;n=len(s);choices=(v for v in range(1<<n) if v.bit_count()<=k)
    return format(max(choices,key=lambda v:v^int(s,2)),f'0{n}b')
add(26,'有限置位数下最大化异或','给定固定长度二进制串x，构造同长度二进制串y，其中1不超过maxSet个，使x XOR y的无符号数值最大。输出y，允许前导0。','第一行bits maxSet，第二行x。来源未给数值界，本站1≤bits≤100000，0≤maxSet≤bits。','从最高位开始，只在x为0且仍有置位额度时令y为1；其余位为0。','x为1时把y设1只会降低结果且耗额度，绝不优于0。x为0时置1会增加该位权重；高位权重大于所有低位之和，故有限额度依次用于最高的0位最优。','时间O(bits)，输出空间O(bits)。',[('1001',2),('111',3),('0000',1)],'分别0110、000、1000。',lambda r:(lambda n:(''.join(r.choice('01') for _ in range(n)),r.randint(0,n)))(r.randint(1,10)),[(('0'*100000,100000),'1'*100000),(('1'*100000,100000),'0'*100000),(('01'*50000,1),'1'+'0'*99999)],lambda x:f'{len(x[0])} {x[1]}\n{x[0]}\n',xor_oracle,"def solve(d):\n    k=int(d[1]);out=[]\n    for c in d[2]:\n        if c=='0' and k:out.append('1');k-=1\n        else:out.append('0')\n    return ''.join(out)\n",[('把1位也翻转','if c==\'0\' and k','if k'),('优先低位','for c in d[2]:','for c in d[2][::-1]:')],100030,output='输出同长度二进制串y。')
def requests_encode(x):return f'{len(x[0])} {x[1]}\n'+'\n'.join(x[0])+'\n'
def requests_oracle(x):
    a,k=x;last={}
    for i,v in enumerate(a):last[v]=i
    if len(last)<k:return '-1'
    values=sorted(last,key=last.get,reverse=True)[:k]
    return str(k)+'\n'+'\n'.join(values)
add(28,'最近k个不同请求','收到全部请求后，按各ID最后出现的时间从近到远，输出最近k个不同请求ID。原例明确重复ID只报一次。若不同ID不足k个，本站输出约定为-1。','第一行n k，随后n行请求ID。来源无数值界，本站1≤n,k≤100000，每个ID为1至20个非换行Unicode标量字符，可以含空格；逐行读取，不裁剪空格。','逆序扫描，用集合跳过已见ID，收集到k个后停止；不足则报告不可行。','从右到左第一次遇到某ID的位置就是其最后出现位置，逆序首次遇见的顺序恰好是最后出现时间降序。跳过已见ID只移除重复，因此取前k项得到所求；遍历完不足说明不同ID总数确实不够。','时间O(n·ID长度)，空间O(n·ID长度)。',[(['item1','item2','item3','item1','item3'],3),(['a','a'],2),(['a b',' a ','a b'],2)],'分别逐行输出3、item3、item1、item2；-1；2、a b、空格包围的a。',lambda r:([r.choice(['a','bb',' a','a ','😀']) for _ in range(r.randint(1,12))],r.randint(1,8)),[((['same']*100000,100000),'-1'),((['😀'*19+chr(0x10000+i) for i in range(100000)],100000),'100000\n'+'\n'.join('😀'*19+chr(0x10000+i) for i in range(99999,-1,-1)))],requests_encode,requests_oracle,"def solve(d):\n    lines=d.split('\\n');n,k=map(int,lines[0].split());seen=set();out=[]\n    for v in reversed(lines[1:n+1]):\n        if v in seen:continue\n        seen.add(v);out.append(v)\n        if len(out)==k:break\n    if len(out)<k:return '-1'\n    return str(k)+'\\n'+'\\n'.join(out)\n",[('不跳过重复ID','if v in seen:continue','if False:continue'),('按最早出现取值','reversed(lines[1:n+1])','lines[1:n+1]')],8100040,raw=True,checker='exact',output='无解仅输出-1；否则第一行k，随后k行请求ID，保留空格且从近到远。',outputLimit=16384)
def substring_oracle(x):
    s,lo,hi,u=x;counts=Counter()
    for length in range(lo,hi+1):
        for i in range(len(s)-length+1):
            part=s[i:i+length]
            if len(set(part))<=u:counts[part]+=1
    return max(counts.values(),default=0)
add(29,'受长度与字符种类限制的最高子串频次','求一个子串在原串中出现次数的最大值，允许出现位置重叠。候选长度在minLength至maxLength之间，且不同字符数不超过maxUnique；无合法候选输出0。','第一行minLength maxLength maxUnique，第二行字符串。原界2≤长度≤100000，2≤minLength≤maxLength≤26且maxLength<字符串长度，2≤maxUnique≤26。来源未限制字符集，本站支持非换行Unicode标量字符，每字符计一个码点，总UTF-8≤400100字节。','只统计长度minLength的窗口，过滤字符种类超标的窗口，用哈希表累计频次。','任意合法更长子串的固定minLength前缀仍合法，且长串每次出现都对应此前缀的一次出现，前缀频次不会更少。因此全局最优一定可由最短长度取得，统计全部该长度窗口不漏最优。','时间O(n·minLength)，空间O(n·minLength)，其中minLength≤26。',[('abcde',2,4,2),('ababab',2,3,2),('aaaa',2,3,2)],'分别1、3、3，ab在ababab中出现3次，aa的出现可以重叠。',lambda r:(lambda n:(lambda lo:(''.join(r.choice('ab c界😀') for _ in range(n)),lo,r.randint(lo,min(26,n-1)),r.randint(2,5)))(r.randint(2,min(5,n-1))))(r.randint(3,14)),[(('a'*100000,26,26,2),99975),(('😀'*100000,2,26,2),99999),(('abc'*33333+'a',3,26,2),0)],lambda x:f'{x[1]} {x[2]} {x[3]}\n{x[0]}\n',substring_oracle,"def solve(d):\n    from collections import Counter\n    header,s=d.split('\\n')[:2];lo,hi,u=map(int,header.split());counts=Counter()\n    for i in range(len(s)-lo+1):\n        part=s[i:i+lo]\n        if len(set(part))<=u:counts[part]+=1\n    return str(max(counts.values(),default=0))\n",[('忽略不同字符限制','if len(set(part))<=u','if True'),('只统计不重叠位置','range(len(s)-lo+1)','range(0,len(s)-lo+1,lo)')],400100,raw=True)
def intervals_encode(a):return str(len(a))+'\n'+''.join(f'{l} {h}\n' for l,h in a)
def traffic_oracle(a):return max(range(min(l for l,h in a),max(h for l,h in a)+1),key=lambda t:sum(l<=t<=h for l,h in a))
def cores_oracle(a):return max(sum(l<=t<=h for l,h in a) for t in range(min(l for l,h in a),max(h for l,h in a)+1))
def interval_rand(r):return [(lambda l:(l,r.randint(l,20)))(r.randint(1,20)) for _ in range(r.randint(1,12))]
add(30,'访问人数最多的最早时刻','每位访客在闭区间[start,end]内在线，求同时在线人数最多的最早整数时刻。','第一行n，随后n行start end。1≤n≤100000，1≤start≤end；来源时间上界截断，本站补充end≤10^9。','在start增加1，在end+1减少1，按时间合并事件并扫描，只有严格刷新最大人数才记录时刻。','事件点之间人数不变，闭区间在end时仍在线而end+1才离开；差分前缀和因此精确等于在线数。升序扫描并只更新严格更大值，保留最大人数第一次出现的时刻。','时间O(n log n)，空间O(n)。',[[(1,7),(6,8),(2,6),(9,10)],[(1,1),(2,2)],[(4,4),(4,8)]],'分别6、1、4；结束端点也在线，平手取最早。',interval_rand,[([(1,10**9)]*100000,1),([(i,i) for i in range(1,100001)],1),([(10**9,10**9)]*100000,10**9)],intervals_encode,traffic_oracle,"def solve(d):\n    from collections import defaultdict\n    events=defaultdict(int)\n    for i in range(1,len(d),2):\n        l,h=int(d[i]),int(d[i+1]);events[l]+=1;events[h+1]-=1\n    current=best=0;answer=0\n    for t in sorted(events):\n        current+=events[t]\n        if current>best:best=current;answer=t\n    return str(answer)\n",[('结束时刻不计在线','events[h+1]-=1','events[h]-=1'),('平手更新到更晚','if current>best','if current>=best')],2200020)
add(32,'执行闭区间进程的最少核心数','每个进程在闭区间[start,end]运行，一个核心同一时刻最多运行一个进程，求最少核心数。','第一行n，随后n行start end。1≤n≤100000，1≤start≤end≤10^9。','分别排序开始和结束时刻，用两个指针扫描。开始与结束相等时先处理开始，更新当前并发最大值。','任一时刻的同时运行进程都需要不同核心，所以最大并发是下界。按开始时间分配任意空闲核心，只有所有已分配核心仍忙时才新建，新增时正在运行数恰好等于核心数；因此核心数永不超过最大并发，达到下界。','时间O(n log n)，空间O(n)。',[[(1,3),(3,5),(4,6)],[(1,1),(1,1)],[(1,2),(3,4)]],'分别2、2、1，端点相接仍重叠。',interval_rand,[([(1,10**9)]*100000,100000),([(i,i) for i in range(1,100001)],1),([(10**9,10**9)]*100000,100000)],intervals_encode,cores_oracle,"def solve(d):\n    starts=sorted(map(int,d[1::2]));ends=sorted(map(int,d[2::2]));j=0;active=answer=0\n    for start in starts:\n        while j<len(ends) and ends[j]<start:active-=1;j+=1\n        active+=1;answer=max(answer,active)\n    return str(answer)\n",[('闭区间当开区间','ends[j]<start','ends[j]<=start'),('只统计不同开始时刻','return str(answer)','return str(len(set(starts)))')],2200020)
def zero_oracle(x):
    s,m,k=x;n=len(s);start=int(s,2);masks=[((1<<k)-1)<<i for i in range(n-k+1)];q=deque([(start,0)]);seen={start}
    while q:
        state,c=q.popleft()
        if '0'*m not in format(state,f'0{n}b'):return c
        for mask in masks:
            nxt=state|mask
            if nxt not in seen:seen.add(nxt);q.append((nxt,c+1))
add(33,'覆盖零段的最少区间操作','每次选择恰好k个连续位置全部设为1，求让字符串不再含连续m个0的最少操作数。已有1不受影响。','第一行n m k，第二行二进制串。1≤n≤200000，1≤m,k≤n。','从左向右累积零段；首次累计m个0时，将覆盖该位置的k长区间尽量右放并设为1，跳过该区间，清空零计数。','遇到第一个全零m窗口，任何可行方案必须操作覆盖其中至少一个位置。将负责此窗口的操作右移到尽可能靠右且仍覆盖窗口的位置，不损失已处理前缀的合法性，并使未来覆盖不减少。尾部不足k时贴右边界。交换后可令最优方案包含贪心操作，递归处理其右侧得到最优。','时间O(n)，空间O(1)。',[('000000',3,2),('111',1,1),('000',1,1)],'分别1、0、3。第一例把第3至4位设为1得到001100。',lambda r:(lambda n:(''.join(r.choice('01') for _ in range(n)),r.randint(1,n),r.randint(1,n)))(r.randint(1,9)),[(('0'*200000,1,1),200000),(('0'*200000,200000,200000),1),(('0'*200000,3,2),50000),(('1'*200000,1,200000),0)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n{x[0]}\n',zero_oracle,"def solve(d):\n    n,m,k=map(int,d[:3]);s=d[3];i=run=answer=0\n    while i<n:\n        run=run+1 if s[i]=='0' else 0\n        if run==m:answer+=1;i=min(i,n-k)+k;run=0\n        else:i+=1\n    return str(answer)\n",[('多容许一个零','if run==m','if run>m'),('忽略一次覆盖长度','i=min(i,n-k)+k','i+=1')],200040)
def bundle_oracle(x):
    a,b,c,need_a,need_b=x
    return min(z*c+max(0,need_a-z)*a+max(0,need_b-z)*b for z in range(max(need_a,need_b)+1))
add(35,'允许超买的最低设备采购费','A和B可单独购买，也可购买各含一个A与B的套装。需要至少x个A和y个B，可以买多，求最低费用。','一行costA costB costAB x y，每个整数1..10^9。','枚举套装数0、min(x,y)、max(x,y)，分别补足缺少的单件，取最小费用。','固定套装数z后，单件只需补足各自缺口。总费用是关于z的分段线性函数，转折点只有x、y，超过max(x,y)再买只增费。每个线性段的最小值在端点，因此三个候选覆盖最优。','时间O(1)，空间O(1)，用64位整数。',[(3,4,2,2,1),(3,4,10,2,1),(9,9,1,1,3)],'分别4、10、3；第一和第三例允许买入多余设备。',lambda r:tuple(r.randint(1,10) for _ in range(5)),[((10**9,10**9,10**9,10**9,10**9),10**18),((10**9,1,10**9,10**9,1),10**18),((10**9,10**9,1,1,10**9),10**9)],lambda x:seq(x)+'\n',bundle_oracle,"def solve(d):\n    a,b,c,x,y=map(int,d)\n    return str(min(z*c+max(0,x-z)*a+max(0,y-z)*b for z in (0,min(x,y),max(x,y))))\n",[('禁止超买','(0,min(x,y),max(x,y))','(0,min(x,y))'),('只单独购买','return str(min(z*c+max(0,x-z)*a+max(0,y-z)*b for z in (0,min(x,y),max(x,y))))','return str(x*a+y*b)')],60)
def anagrams_encode(rows):return str(len(rows))+'\n'+''.join(a+'\n'+b+'\n' for a,b in rows)
def anagrams_oracle(rows):
    out=[]
    for a,b in rows:
        if len(a)!=len(b):out.append(-1);continue
        remaining=list(b);bad=0
        for c in a:
            if c in remaining:remaining.remove(c)
            else:bad+=1
        out.append(bad)
    return '\n'.join(map(str,out))
def anagrams_rand(r):
    rows=[]
    for _ in range(r.randint(1,6)):
        a=''.join(r.choice('abcd') for _ in range(r.randint(0,10)));b=''.join(r.choice('abcd') for _ in range(r.randint(0,10)))
        if not a and not b:b='a'
        rows.append((a,b))
    return rows
add(36,'逐对字符串变为异位词的最少替换','每对字符串允许替换任意字符，使两串字符计数相同，求最少替换次数；长度不同则不可能，输出-1。','第一行n，随后每对占两行，空串使用空行。1≤n≤100，小写字母；每串长度0..10000，每对总长度1..10000。','长度相等时统计第一串相对第二串多出的各字符数量并求和。','每次替换至多减少一个多余字符，故多余数量是下界。长度相等意味着多余总量等于缺少总量，把每个多余字符改成一个缺少字符便达到下界。允许修改任意一串也不能低于该下界。','时间O(全部字符数)，逐对额外空间O(26)。',[[('tea','ate'),('tea','toe'),('act','acts')],[('','a')],[('aa','bb')]],'分别逐行0、1、-1；-1；2。',anagrams_rand,[([('a'*5000,'b'*5000)]*100,'\n'.join(['5000']*100)),([('','z'*10000)]*100,'\n'.join(['-1']*100))],anagrams_encode,anagrams_oracle,"def solve(d):\n    from collections import Counter\n    lines=d.split('\\n');n=int(lines[0]);out=[]\n    for i in range(n):\n        a,b=lines[1+2*i:3+2*i]\n        if len(a)!=len(b):out.append(-1)\n        else:out.append(sum((Counter(a)-Counter(b)).values()))\n    return '\\n'.join(map(str,out))\n",[('把相同位置不同当答案','sum((Counter(a)-Counter(b)).values())','sum(x!=y for x,y in zip(a,b))'),('长度不同返回零','out.append(-1)','out.append(0)')],1000210,raw=True,output='输出n行，第i行是第i对的最少次数，不可能时-1。')
def increment_oracle(a):
    for x in range(max(a)-min(a)+1):
        for mask in range(1<<len(a)):
            if mask&(mask<<1):continue
            b=[v+x if mask>>i&1 else v for i,v in enumerate(a)]
            if all(b[i]<=b[i+1] for i in range(len(b)-1)):return x
    return -1
add(37,'非相邻位置统一加值的最小增量','选择任意一组互不相邻的位置，对这些位置统一加同一个非负整数x，只进行这一次操作，使数组非递减。求最小x；不可能输出-1，已非递减可选空集并取0。','第一行n，第二行数组。来源未给数值界，本站1≤n≤200000，−10^9≤元素≤10^9。','原数组每个下降边强制选择右端点、不选左端点；若强制位置相邻立即无解。取所有下降幅度的最大值为x，只给强制位置加x，然后验证整体。','下降边只能通过增加右端而不增加左端修复，故这些选择是必须的且x至少为最大下降幅度。任何额外选择都不改变此下界。用下界x增大强制位置后，若其右边出现新下降，右邻不能再选择（相邻禁选），增大x也无助；因此此时无解。否则已构造达到下界的合法解。','时间O(n)，空间O(n)。',[[1,1,3,2],[3,2,1],[1,2,3]],'分别1、-1、0。',lambda r:[r.randint(-3,5) for _ in range(r.randint(1,8))],[([10**9,-10**9]*100000,2*10**9),(list(range(200000,0,-1)),-1),([-10**9]*200000,0)],arr,increment_oracle,"def solve(d):\n    a=list(map(int,d[1:]));n=len(a);chosen=[False]*n;x=0\n    for i in range(1,n):\n        if a[i]<a[i-1]:chosen[i]=True;x=max(x,a[i-1]-a[i])\n    if any(chosen[i] and chosen[i-1] for i in range(1,n)):return '-1'\n    b=[v+x if chosen[i] else v for i,v in enumerate(a)]\n    return str(x) if all(b[i]>=b[i-1] for i in range(1,n)) else '-1'\n",[('不验证右侧新下降','return str(x) if all(b[i]>=b[i-1] for i in range(1,n)) else \'-1\'','return str(x)'),('遗漏首个下降','range(1,n):','range(2,n):')],2400020)
def neighboring_oracle(s):
    previous=[int(c!=ord(s[0])-97) for c in range(26)]
    for ch in s[1:]:previous=[min(previous[p] for p in range(26) if abs(p-c)>1)+int(c!=ord(ch)-97) for c in range(26)]
    return min(previous)
add(39,'消除相邻字母冲突的最少修改','替换尽可能少的字符，使任意相邻字符既不相同、也不是字母表中相邻字母。只使用小写a至z，a和z不算相邻。','一行小写字符串，2≤长度≤100000。','从左向右遇到冲突边，就修改右端点，并跳过紧邻其后的边；后续从下一个未处理边继续。','每个原冲突边至少有一个端点被改，是路径上边覆盖问题。对最左未覆盖边，选右端点不会比选左端点覆盖更少未来边，交换得到贪心最优。贪心选中位置不相邻，每处至多要避开两侧邻居及各自相邻字母共6个字符，26字母保证可填入合法字符，覆盖下界可实现。','时间O(n)，空间O(1)。',['abdde','ab','az'],'分别2、1、0。',lambda r:''.join(r.choice('abcdeyz') for _ in range(r.randint(2,12))),[('a'*100000,50000),('az'*50000,0),('ab'*50000,50000)],lambda s:s+'\n',neighboring_oracle,"def solve(d):\n    s=d[0];i=1;answer=0\n    while i<len(s):\n        if abs(ord(s[i])-ord(s[i-1]))<=1:answer+=1;i+=2\n        else:i+=1\n    return str(answer)\n",[('只处理重复不处理相邻','<=1','==0'),('被修改点不跳过后边','answer+=1;i+=2','answer+=1;i+=1')],100001)
def optimal_oracle(x):
    a,b,ma,mb=x
    @lru_cache(None)
    def visit(a,b,last,run):
        choices=[0]
        if a and ma and (last!=0 or run<ma):choices.append(1+visit(a-1,b,0,run+1 if last==0 else 1))
        if b and mb and (last!=1 or run<mb):choices.append(1+visit(a,b-1,1,run+1 if last==1 else 1))
        return max(choices)
    return visit(a,b,-1,0)
add(40,'连续段受限的最长AB串','最多使用countA个A与countB个B，连续A不超过maxA个，连续B不超过maxB个，求可构造字符串的最大长度。可以不使用全部字符；某类最大连续长度为0表示不能使用该字符。','一行countA countB maxA maxB，四个整数均为0..10^6。','先处理连续上限为0的情况。否则如果A超过B所提供的countB+1个槽位容量，就只用槽位能容纳的A；B过多时对称处理；都不过多则全用。','b个B将A划分为至多b+1段，所以a≤maxA(b+1)是必要条件，反向同理。两个上限至少1时这两条件也充分：以较多一类分散成至多少数+1段，再分配少数分隔并在段间填充，可使每段不超过上限。若仅一类超容量，保留全部另一类、填满槽位达到最大值；删另一类只会进一步减少容量。两类同时超容量不可能。','时间O(1)，空间O(1)。',[(5,1,2,1),(3,4,0,2),(0,0,0,0)],'分别5、2、0。第一例可构造AABAA。',lambda r:(r.randint(0,7),r.randint(0,7),r.randint(0,4),r.randint(0,4)),[((10**6,10**6,10**6,10**6),2*10**6),((10**6,0,10**6,1),10**6),((10**6,10**6,0,0),0),((10**6,1,1,1),3)],lambda x:seq(x)+'\n',optimal_oracle,"def solve(d):\n    a,b,ma,mb=map(int,d)\n    if ma==0:return str(min(b,mb))\n    if mb==0:return str(min(a,ma))\n    if a>ma*(b+1):return str(b+ma*(b+1))\n    if b>mb*(a+1):return str(a+mb*(a+1))\n    return str(a+b)\n",[('遗漏边缘槽位','ma*(b+1)','ma*b'),('禁用A时仍全部使用B','str(min(b,mb))','str(b)')],40)
def aws_oracle(s):
    while 'AWS' in s:s=s.replace('AWS','',1)
    return s or '-1'
add(27,'反复删除AWS后的字符串','反复删除字符串中的连续子串AWS，直到不能再删，输出剩余字符串；为空时输出-1。','一行大写英文字母串，1≤长度≤100000。','逐字符入栈，每次栈尾恰为AWS就删除这三个字符。','入栈前前缀已不可删除，新出现的AWS只能以新字符结尾，删后露出的前缀仍是之前不可删的栈前缀。AWS无非空真前后缀重合，因此同时可删的两个出现不重叠、删除可交换，任意删除顺序得到同一结果。','时间O(n)，空间O(n)。',['AWAWSSG','AWS','XYZ'],'分别G、-1、XYZ。',lambda r:''.join(r.choice('AWSSXYZ') for _ in range(r.randint(1,30))),[('AWS'*33333+'A','A'),('A'*33333+'WS'*33333+'Z','Z'),('Z'*100000,'Z'*100000)],lambda s:s+'\n',aws_oracle,"def solve(d):\n    stack=[]\n    for c in d[0]:\n        stack.append(c)\n        if len(stack)>=3 and stack[-3:]==['A','W','S']:del stack[-3:]\n    return ''.join(stack) or '-1'\n",[('只删原始出现','return \'\'.join(stack) or \'-1\'','return d[0].replace(\'AWS\',\'\') or \'-1\''),('误删ASW','[\'A\',\'W\',\'S\']','[\'A\',\'S\',\'W\']')],100001,output='输出最终字符串；为空输出-1。')


SOURCE_NAMES={21:'find-length-of-longest-bitonic-subarray',22:'find-max-distinct-items',23:'find-maximum-even-sum',24:'find-min-operations',25:'find-missing-integer',26:'find-y-value',27:'get-final-string',28:'get-latest-k-requests',29:'get-max-occurrences',30:'get-max-traffic-time',31:'get-maximum-amount',32:'get-min-cores',33:'get-min-operations',34:'get-min-time',35:'get-minimum-cost',36:'get-minimum-difference',37:'get-minimum-increment',38:'get-minimum-moves',39:'get-minimum-operation-count',40:'get-optimal-string-length'}
BLOCKED={31:'原文要求恰好卖m件，但数值界允许m大于总库存且无不足库存的规则；不能擅自添加库存足够保证或少卖。',34:'原界允许cache_time大于server_time；未定义命中时是否必须使用缓存还是可以直连服务器。cache=5、server=2、连续两次同一URL分别得到7或4，最低时间不唯一。',38:'正文仅给奇数长度的中位数定义，未限制输入为奇数；偶数长度没有下中位数、上中位数或均值的规定，不能删去偶数输入。'}
def execute(path,inputs):
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300,check=True)
    outputs=json.loads(result.stdout);assert len(outputs)==len(inputs);return outputs
def main():
    batch='ibm-next';seed=20262140
    for name in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/name).mkdir(parents=True,exist_ok=True)
    sources={v['id']:v for v in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[]
    selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{batch}.json').exists():
        items=[v for v in json.loads((OUT/'batches'/f'{batch}.json').read_text())['items'] if int(v['id'].split('-')[-1]) not in selected]
        reports=[v for v in json.loads((OUT/'validation'/f'{batch}.json').read_text())['problems'] if int(v['id'].split('-')[-1]) not in selected]
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        ident=f"oa-ibm-{s['n']}";rng=random.Random(seed+s['n']);input_expr="sys.stdin.read()" if s.get('raw') else "sys.stdin.read().split()"
        code=s['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({input_expr}))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](x),expectedOutput=str(s['oracle'](x))+'\n') for x in values]
        tests=oracles[:3]+[dict(input=s['encode'](x),expectedOutput=str(y)+'\n') for x,y in s['edges']]+oracles[3:31]
        for c in oracles+tests:assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
        def matches(a,b):return a==b if s.get('checker')=='exact' else a.split()==b.split()
        actual=execute(path,[c['input'] for c in oracles+tests])
        for i,(v,c) in enumerate(zip(actual,oracles+tests)):assert matches(v,c['expectedOutput']),(ident,i,v[:200],c['expectedOutput'][:200])
        timings=[]
        for c in tests[3:3+len(s['edges'])]:
            started=time.perf_counter();answer=execute(path,[c['input']])[0];elapsed=time.perf_counter()-started;assert matches(answer,c['expectedOutput']);timings.append(round(elapsed,4))
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];killed=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{ident}-{j}.py';mp.write_text(changed)
            outputs=execute(mp,[c['input'] for c in cases]);bad=[i for i,(v,c) in enumerate(zip(outputs,cases)) if not matches(v,c['expectedOutput'])];assert bad,(ident,name,'survived')
            mutants.append(dict(name=name,code=changed));killed.append(dict(name=name,rejectedByCases=bad))
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','IBM'],description=s['desc']+'\n\n标准输入输出与样例由本站整理；明示本站范围不是来源原约束。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('time',6),memoryLimit=s.get('memory',262144),outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        result=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert result.returncode==0,(ident,result.stderr[:3000]);normalized=result.stdout;assert len(normalized.encode())<=128*1024*1024
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)];source=sources[ident]
        for folder,data in dict(packages=json.loads(normalized),oracles=oracles,mutants=mutants,editorials=dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():(OUT/folder/f'{ident}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=ident,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=s['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBoundaryWallSeconds=timings));print(ident,'163 oracle;',len(cases)-3,'hidden; 2 normal-exit wrong rejected; max local boundary',max(timings),flush=True)
        del actual,oracles,tests,cases,normalized
    items.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    reviews=[]
    for n,name in SOURCE_NAMES.items():
        rel=f'fastprep/IBM/ibm-{name}.md'
        blob=subprocess.run(['git','rev-parse',f'e66f809f4c953bce129f68491726176615db6afc:{rel}'],cwd='/tmp/cswork-oa-source-20260919',text=True,capture_output=True,check=True).stdout.strip()
        reviews.append(dict(id=f'oa-ibm-{n}',status='blocked' if n in BLOCKED else 'authored',reason=BLOCKED.get(n,'完整raw逐条核对，原创参考与独立小规模oracle；本站数值界、标准输入输出约定明确标记。'),sourceCommit='e66f809f4c953bce129f68491726176615db6afc',sourcePath=rel,sourceBlob=blob,catalogContentHash=sources[f'oa-ibm-{n}']['contentHash']))
    for folder,data in {'batches':dict(schemaVersion=1,items=items),'validation':dict(schemaVersion=1,seed=seed,problems=reports,note='Local subprocess/runpy only; real sandbox required. Boundary timing includes Python startup and JSON transport. No source solutions executed.'),'reviews':dict(schemaVersion=1,items=reviews)}.items():(OUT/folder/f'{batch}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
