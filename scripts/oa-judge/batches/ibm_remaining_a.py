"""IBM41–61, independent implementations; immutable e66f809 raw statements only."""
from pathlib import Path
from collections import Counter,deque
from functools import lru_cache
from itertools import combinations,product
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def winner_oracle(x):
    a,k=x;q=deque(a);last=None;wins=0
    while wins<k:
        a,b=q.popleft(),q.popleft();w,l=max(a,b),min(a,b);q.appendleft(w);q.append(l);wins=wins+1 if w==last else 1;last=w
    return last
add(41,'连续获胜k场的选手势能','队首两人对局，势能较大者留在队首，败者排到队尾。首次连续赢k场的选手获胜，返回其势能，所有势能互不相同。','第一行n k，第二行势能排列。2≤n≤100000，势能互异且1..n，2≤k≤10^14。','扫描原队列，维护当前冠军和连胜数；换冠军时连胜为1。未达k而扫完后，全局最大势能必将获胜。','第一次遇到全局最大值前，队首冠军只会与尚未首次上场的下一人对局，因此单遍模拟精确。一旦最大值成为冠军便永不输，若此前无胜者最终胜者必为它，不必继续模拟巨大k。','时间O(n)，额外空间O(1)。',[([3,2,1,4],2),([1,3,2,4,5],2),([3,2,1,4],3)],'分别3、3、4。',lambda r:(lambda n:(r.sample(range(1,n+1),n),r.randint(2,20)))(r.randint(2,9)),lambda:[((list(range(1,100001)),10**14),100000),(([100000]+list(range(1,100000)),2),100000)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',winner_oracle,"def solve(d):\n    n,k=map(int,d[:2]);a=list(map(int,d[2:]));champion=a[0];wins=0\n    for v in a[1:]:\n        if v>champion:champion=v;wins=1\n        else:wins+=1\n        if wins>=k:return str(champion)\n    return str(champion)\n",[('换冠军连胜从零算','champion=v;wins=1','champion=v;wins=0'),('忽略提前获胜','if wins>=k:return str(champion)','if False:return str(champion)')],600050)
def cache_encode(x):
    entries,queries=x
    return f'{len(entries)} {len(queries)}\n'+''.join(f'{t} {k} {v}\n' for t,k,v in entries)+''.join(f'{k} {t}\n' for k,t in queries)
def cache_oracle(x):return '\n'.join(str(next(v for ts,key,v in x[0] if (key,ts)==(k,t))) for k,t in x[1])
def cache_rand(r):
    entries=[(f'00:00:{i:02d}',r.choice(['a','b','a1']),r.randint(1,100)) for i in range(r.randint(1,15))];queries=[(v[1],v[0]) for v in r.choices(entries,k=r.randint(1,12))];r.shuffle(entries);return entries,queries
def cache_edges():
    entries=[('23:59:59',f'{i:064d}',10**8) for i in range(100000)];queries=[(f'{i:064d}','23:59:59') for i in range(99999,-1,-1)]
    return [((entries,queries),'\n'.join(['100000000']*100000)),(([('00:00:00','a',1),('00:00:01','a',2)],[('a','00:00:00')]),'1')]
add(42,'按键和写入时刻精确查询缓存','缓存条目包含timestamp、key和整数value；每次查询给出key和timestamp，返回该精确条目的值，不查询最近时间版本。同一时刻键不重复，查询保证命中。','第一行n q，随后n行timestamp key value，再q行key timestamp。1≤n,q≤100000，1≤value≤10^8；时间为8字符hh:mm:ss（小时00..23、分秒00..59）；键为小写字母和数字。来源没有键长度界，本站1..64字符。','用(key,timestamp)为复合键建立哈希表，逐个查询。','复合键唯一性由同一时刻不重复键保证，写入每个条目后表值恰为该条目的value；保证命中的查询访问相同复合键，必返回对应值。','时间O(输入字符数)，空间O(n·键长)。',[([('01:34:05','abc',352),('20:34:20','a1',490)],[('a1','20:34:20'),('abc','01:34:05')]),([('00:00:00','x',1),('00:00:01','x',2)],[('x','00:00:00')]),([('12:00:00','a',8),('12:00:00','b',9)],[('b','12:00:00'),('a','12:00:00')])],'分别490和352；1；9和8。',cache_rand,cache_edges,cache_encode,cache_oracle,"def solve(d):\n    n,q=map(int,d[:2]);table={};p=2\n    for _ in range(n):\n        t,k,v=d[p:p+3];table[k,t]=v;p+=3\n    out=[]\n    for _ in range(q):\n        k,t=d[p:p+2];out.append(table[k,t]);p+=2\n    return '\\n'.join(out)\n",[('忽略时间','table[k,t]','table[k]'),('颠倒结果','return \'\\n\'.join(out)','return \'\\n\'.join(reversed(out))')],15800030,output='按查询顺序输出q行整数。')
def smallest_oracle(s):return min(s[:l]+''.join(chr((ord(c)-98)%26+97) for c in s[l:h])+s[h:] for l in range(len(s)) for h in range(l+1,len(s)+1))
add(43,'恰好下降一个子串后的最小字符串','选择恰好一个非空连续子串，每个字母替换为前一个字母，a替换为z，求操作后的字典序最小字符串。','一行小写字符串，长度1..100000。','跳过前导a，连续降低接下来的非a段；若全是a则只把最后一位改为z。','首次修改非a会降低该位，越早降低字典序越小；跨过a会使当前位增大，因此必须在下一个a前停下，在此前多降低每一位均更优。全a时所有修改都增大，选择最晚且只改一位达到最小。','时间O(n)，输出空间O(n)。',['hackerrank','bbcad','aaa'],'分别gackerrank、aabad、aaz。',lambda r:''.join(r.choice('abcz') for _ in range(r.randint(1,10))),lambda:[('a'*100000,'a'*99999+'z'),('z'*100000,'y'*100000)],lambda s:s+'\n',smallest_oracle,"def solve(d):\n    a=list(d[0]);i=0\n    while i<len(a) and a[i]=='a':i+=1\n    if i==len(a):a[-1]='z'\n    else:\n        while i<len(a) and a[i]!='a':a[i]=chr(ord(a[i])-1);i+=1\n    return ''.join(a)\n",[('全a时不操作','a[-1]=\'z\'','a[-1]=\'a\''),('只改一位','while i<len(a) and a[i]!=\'a\':a[i]=chr(ord(a[i])-1);i+=1','a[i]=chr(ord(a[i])-1)')],100001,output='输出操作后的最小字符串。')
def logs_encode(x):return f'{x[0]} {len(x[1])}\n'+'\n'.join(x[1])+'\n'
def logs_oracle(x):
    n,logs=x;events=[(int(t),kind,int(v)) for v,kind,t in (s.split(':') for s in logs)];stack=[];out=[0]*n
    for tick in range(max(t for t,kind,v in events)+1):
        for t,kind,v in events:
            if t==tick and kind=='start':stack.append(v)
        if stack:out[stack[-1]]+=1
        for t,kind,v in events:
            if t==tick and kind=='end':assert stack.pop()==v
    return seq(out)
def logs_rand(r):
    n=r.randint(1,5);logs=[];stack=[];tick=0
    for _ in range(r.randint(1,10)):
        if stack and r.randrange(2):logs.append(f'{stack.pop()}:end:{tick}')
        else:v=r.randrange(n);stack.append(v);logs.append(f'{v}:start:{tick}')
        tick+=r.randint(1,3)
    while stack:logs.append(f'{stack.pop()}:end:{tick}');tick+=1
    return n,logs
def logs_edges():
    nested=[f'{i%100}:start:{i}' for i in range(250)]+[f'{i%100}:end:{499-i}' for i in range(249,-1,-1)];expected=[4 if i>=50 else 6 for i in range(100)]
    return [((100,nested),seq(expected)),((1,['0:start:0','0:end:1000']),'1001'),((100,[f'0:{kind}:{2*i+j}' for i in range(250) for j,kind in enumerate(['start','end'])]),seq([500]+[0]*99))]
add(44,'单线程函数的独占执行时间','给出单线程实际调用日志，计算每个函数所有调用的独占时间。开始日志在该秒开始抢占，结束日志包含该秒，返回后恢复上一层调用，允许递归。','第一行n m，随后m行id:start/end:timestamp。1≤n≤100，1≤m≤500，ID为0..n−1，时间0..1000且非递减；开始时间各异、结束时间各异，每次开始都有结束。日志表示有效调用栈执行，暂停中的调用不能先结束。','维护调用栈和上一个结算时刻；开始时给旧栈顶结算到t前，结束时给当前函数结算到t并将下次时刻置t+1。','两个相邻事件之间只有栈顶占CPU，结算该完整时间段精确且不重叠。开始不占用旧函数的t秒，结束占用当前函数的t秒，因此分别用t−previous与t−previous+1；更新后未结算区间仍从previous开始，归纳正确。','时间O(n+m)，空间O(n+m)。',[(2,['0:start:0','1:start:3','1:end:6','0:end:10']),(1,['0:start:0','0:end:0']),(2,['0:start:0','1:start:1','1:end:1','0:end:2'])],'分别7 4；1；2 1。',logs_rand,logs_edges,logs_encode,logs_oracle,"def solve(d):\n    n=int(d[0]);out=[0]*n;stack=[];previous=0\n    for log in d[2:]:\n        v,kind,t=log.split(':');v=int(v);t=int(t)\n        if kind=='start':\n            if stack:out[stack[-1]]+=t-previous\n            stack.append(v);previous=t\n        else:out[stack.pop()]+=t-previous+1;previous=t+1\n    return ' '.join(map(str,out))\n",[('结束秒遗漏','t-previous+1','t-previous'),('返回后重复计结束秒','previous=t+1','previous=t')],13030,output='输出n个整数，依次对应ID 0至n−1。')
def balanced(s):
    level=0
    for c in s:
        level+=1 if c=='(' else -1
        if level<0:return False
    return level==0
def movable_oracle(rows):
    out=[]
    for s in rows:
        ok=balanced(s)
        for i in range(len(s)):
            left=s[:i]+s[i+1:]
            if any(balanced(left[:j]+s[i]+left[j:]) for j in range(len(s))):ok=True;break
        out.append(int(ok))
    return seq(out)
add(45,'最多移动一个括号能否配平','每个字符串最多把一个括号从原位置取出并插入任意位置，判断能否变为普通合法括号串；允许不移动。输出1或0。','第一行n，随后n行括号串。1≤n≤200000，各串长度1..200000，总长度≤200000，只含左右括号。','计算总平衡与最小前缀平衡；总平衡必须为0，最低值不小于−1即可。','移动不改变左右括号总数，且对任一前缀平衡最多提高1，因此总平衡0且最低≥−1必要。若存在−1，取出首次造成负值的右括号放在末尾，此前前缀原已非负，之后前缀加1也非负，最后总数恢复0；无负值时不用移动。','时间O(总长度)，逐串额外O(1)。',[[')(','()','))(('],['(()','())'],['())(','()()']], '分别1 1 0；0 0；1 1。',lambda r:[''.join(r.choice('()') for _ in range(r.randint(1,10))) for _ in range(r.randint(1,4))],lambda:[([')'+'('*99999+')'*99999+'('],'1'),(['('*200000],'0'),(['()']*100000,seq([1]*100000)),(['(']*200000,seq([0]*200000))],lambda a:str(len(a))+'\n'+'\n'.join(a)+'\n',movable_oracle,"def solve(d):\n    out=[]\n    for s in d[1:]:\n        level=low=0\n        for c in s:level+=1 if c=='(' else -1;low=min(low,level)\n        out.append(int(level==0 and low>=-1))\n    return ' '.join(map(str,out))\n",[('忽略总数相等','level==0 and low>=-1','low>=-1'),('允许两层负前缀','low>=-1','low>=-2')],400020,output='输出n个0或1，与输入字符串顺序一致。')
def index_oracle(x):
    steps,bad=x
    if bad==0:return -1
    positions={0}
    for step in range(1,steps+1):positions=(positions|{p+step for p in positions})-{bad}
    return max(positions,default=-1)
add(46,'避开禁点的最大最终下标','初始位于下标0，第j步可前进j格或原地不动，共走steps步，任何时刻不得停在badIndex。求最大最终下标。若起点本身为禁点，无合法路径，本站输出-1。','一行steps badIndex。原界1≤steps≤2000；badIndex原界缺失，本站0≤badIndex≤10^9。','全走的终点是三角数T；若某个正三角前缀为禁点，跳过第一步，答案T−1；否则为T。起点禁用单独返回-1。','不跳步的每一步位置都是三角数，若不碰禁点便达到所有步长之和上界。若碰禁点至少少走1，得到T−1上界；跳过第一步后各正步位置为三角数减1，相邻正三角数差至少2，绝不等于该正三角禁点，因此上界可达。','时间O(steps)，空间O(1)。',[(4,6),(3,4),(2,0)],'分别9、6、-1。',lambda r:(r.randint(1,12),r.randint(0,80)),lambda:[((2000,2001000),2000999),((2000,10**9),2001000),((2000,0),-1)],lambda x:seq(x)+'\n',index_oracle,"def solve(d):\n    n,bad=map(int,d)\n    if bad==0:return '-1'\n    total=n*(n+1)//2;hit=any(j*(j+1)//2==bad for j in range(1,n+1))\n    return str(total-int(hit))\n",[('禁点总是减一','int(hit)','1'),('忽略禁点','int(hit)','0')],30)
def subjects_oracle(x):
    a,b,q=x;n=len(a)
    return max(mask.bit_count() for mask in range(1<<n) if sum(max(0,b[i]-a[i]) for i in range(n) if mask>>i&1)<=q)
add(48,'有限答题数下最多通过科目','第i科已经答对answered[i]题，达到needed[i]即可通过。还能总共答对q题，求最多通过多少科，已经通过的科目无需额外答题。','第一行n q，第二行answered，第三行needed。1≤n≤100000，0≤两数组元素≤10^9。来源没有q界，本站0≤q≤10^14。','计算每科非负缺口，升序排序，预算优先用于最小缺口。','每通过一科贡献均为1。若选择了较大缺口而遗漏较小者，交换后科数不变且用题数不增；反复交换得到最小缺口前缀。贪心取预算可容纳的最长前缀即最优。','时间O(n log n)，空间O(n)。',[([24,27,0],[51,52,100],100),([24,27,0],[51,52,100],200),([5,0],[1,1],0)],'分别2、3、1。',lambda r:(lambda n:([r.randint(0,10) for _ in range(n)],[r.randint(0,10) for _ in range(n)],r.randint(0,30)))(r.randint(1,10)),lambda:[(([0]*100000,[10**9]*100000,10**14),100000),(([10**9]*100000,[0]*100000,0),100000)],lambda x:f'{len(x[0])} {x[2]}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',subjects_oracle,"def solve(d):\n    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));gaps=sorted(max(0,y-x) for x,y in zip(a,b));answer=0\n    for gap in gaps:\n        if gap>q:break\n        q-=gap;answer+=1\n    return str(answer)\n",[('已通过科目抵扣预算','max(0,y-x)','y-x'),('先答最难科','gaps=sorted(max(0,y-x) for x,y in zip(a,b))','gaps=sorted((max(0,y-x) for x,y in zip(a,b)),reverse=True)')],2200050)
def xor_range_oracle(x):
    lo,hi,k=x;return max((a^b for a in range(lo,hi) for b in range(a+1,hi+1) if a^b<=k),default=-1)
XOR_RANGE="""def solve(d):
    from functools import lru_cache
    lo,hi,k=map(int,d)
    @lru_cache(None)
    def visit(bit,al,ah,bl,bh,less,tight):
        if bit<0:return 0 if less else -1
        l=(lo>>bit)&1;h=(hi>>bit)&1;limit=(k>>bit)&1;best=-1
        for a in (0,1):
            if al and a<l or ah and a>h:continue
            for b in (0,1):
                if bl and b<l or bh and b>h or not less and a>b:continue
                z=a^b
                if tight and z>limit:continue
                rest=visit(bit-1,al and a==l,ah and a==h,bl and b==l,bh and b==h,less or a<b,tight and z==limit)
                if rest>=0:best=max(best,(z<<bit)+rest)
        return best
    return str(visit(max(hi,k).bit_length()-1,True,True,True,True,False,True))
"""
add(49,'区间内不超过上限的最大异或','选取lo≤a<b≤hi，使a XOR b≤k且该异或值最大，返回异或值。必须选不同整数；不存在可行数对时本站输出-1。','一行lo hi k。完整来源范围1≤lo<hi≤10000，1≤k≤10000。','从高位到低位做双数位DP，维护两数各自上下界是否贴边、a是否已小于b、异或是否仍贴着k，枚举当前两位。','各约束只依赖已确定前缀与边界的大小关系，状态保存了所有后续所需信息。每位枚举所有合法比特组合，叶子只接受严格a<b，故所有且仅有可行数对被覆盖；取最大异或和得到最优，无接受路径则-1。','时间O(2^6·4·log(max(hi,k)))，空间O(2^6·log(max(hi,k)))。',[(3,5,6),(1,2,1),(1,4,7)],'分别6、-1、7。',lambda r:(lambda lo:(lo,r.randint(lo+1,25),r.randint(1,31)))(r.randint(1,20)),lambda:[((1,10000,10000),10000),((9999,10000,1),-1),((1,10000,1),1)],lambda x:seq(x)+'\n',xor_range_oracle,XOR_RANGE,[('允许相同整数','return 0 if less else -1','return 0'),('排除等于k','if tight and z>limit','if tight and z>=limit')],30)
def distance_oracle(x):
    a,k=x;return max(min(y-x for x,y in zip(sorted(t),sorted(t)[1:])) for t in combinations(a,k))
add(50,'选k个点最大化最小间距','从x轴上互不相同的n个点中选k个，使所选任意两点间距的最小值尽可能大，输出该最大值。','第一行n k，第二行坐标。2≤n≤100000，0≤坐标≤10^9且互异，2≤k≤n。','排序后二分候选距离，贪心从最左点开始，每次选满足与上次距离至少该值的最早点，判断能否选满k点。','固定距离下，将任一可行方案的首点换成最左点不损害后续选择，逐个同理，贪心得到最多可选点。可行性对距离单调，二分最后一个可行整数距离即最优。','时间O(n log n+n log 10^9)，空间O(n)。',[([1,4,2,9,8],3),([0,10],2),([1,2,3],3)],'分别3、10、1。',lambda r:(lambda a:(a,r.randint(2,len(a))))(r.sample(range(31),r.randint(2,9))),lambda:[(([i*10000 for i in range(100000)],50000),20000),(([0,10**9],2),10**9),((list(range(100000)),100000),1)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',distance_oracle,"def solve(d):\n    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));low=0;high=a[-1]-a[0]\n    while low<high:\n        mid=(low+high+1)//2;count=1;last=a[0]\n        for v in a[1:]:\n            if v-last>=mid:count+=1;last=v\n        if count>=k:low=mid\n        else:high=mid-1\n    return str(low)\n",[('不能等于候选距离','v-last>=mid','v-last>mid'),('漏算首个点','count=1;last=a[0]','count=0;last=a[0]')],1100030)
def window_oracle(x):
    a,k=x;return max((sum(a[i:i+k]) for i in range(len(a)-k+1) if len(set(a[i:i+k]))==k),default=-1)
add(51,'长度k且无重复元素的最大子数组和','在数组中选择恰好k项的连续子数组，元素两两不同，最大化元素和。没有合法子数组时返回-1。合法最大和即使小于-1也必须返回真实值。','第一行n k，第二行数组。来源没有数值界，本站1≤n,k≤200000（允许k>n），−10^9≤元素≤10^9。','滑动窗口维护和与元素频率，长度恰好k且不同值数也为k时更新最大和。','每个长度k窗口恰好被访问一次；频率表只维护窗口内元素，因此不同值数为k与全不同等价。对全部合法窗口取最大值，未遇到合法窗口才报告-1。','时间O(n)，空间O(min(n,k))。',[([1,2,3,7,3,5],3),([-5,-2],2),([1,1],2)],'分别15、-7、-1。',lambda r:([r.randint(-10,10) for _ in range(r.randint(1,12))],r.randint(1,15)),lambda:[((list(range(1,200001)),200000),200000*200001//2),(([-10**9]*200000,1),-10**9),(([10**9]*200000,200000),-1)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',window_oracle,"def solve(d):\n    from collections import defaultdict\n    n,k=map(int,d[:2]);a=list(map(int,d[2:]));freq=defaultdict(int);total=0;best=None\n    for i,v in enumerate(a):\n        freq[v]+=1;total+=v\n        if i>=k:\n            old=a[i-k];freq[old]-=1;total-=old\n            if freq[old]==0:del freq[old]\n        if i>=k-1 and len(freq)==k:best=total if best is None else max(best,total)\n    return str(-1 if best is None else best)\n",[('忽略全不同约束','and len(freq)==k',''),('用零初始化最佳值','best=None','best=0')],2400030)
def meander_oracle(a):
    a=a[:];out=[]
    while a:
        v=max(a) if len(out)%2==0 else min(a);out.append(v);a.remove(v)
    return seq(out)
add(53,'最大最小交替的数组','将所有数组元素依次按最大、最小、次大、次小的顺序输出，保留重复值，每个输入元素使用一次。','第一行n，第二行数组。2≤n≤100000，−10^6≤元素≤10^6，可重复。','排序后双指针交替取右端最大与左端最小，直到相遇。','排序区间两端恰为当前所有未使用元素最大和最小；每步取走指定端点后剩余区间仍排序，归纳符合每个次序且不重复使用。','时间O(n log n)，输出空间O(n)。',[[-1,1,2,3,-5],[2,2,1],[0,0]],'分别3 -5 2 -1 1；2 1 2；0 0。',lambda r:[r.randint(-9,9) for _ in range(r.randint(2,12))],lambda:[([10**6]*100000,seq([10**6]*100000)),([-10**6]*50000+[10**6]*50000,seq([10**6,-10**6]*50000))],arr,meander_oracle,"def solve(d):\n    a=sorted(map(int,d[1:]));l=0;r=len(a)-1;out=[]\n    while l<=r:\n        out.append(a[r]);r-=1\n        if l<=r:out.append(a[l]);l+=1\n    return ' '.join(map(str,out))\n",[('错误去重','sorted(map(int,d[1:]))','sorted(set(map(int,d[1:])))'),('奇数尾项丢失','while l<=r','while l<r')],900020,output='输出n个元素，按最大最小交替顺序排列。')
add(54,'合并两个等长有序数组','将两个各长n的非递减数组合并，输出全部2n个元素，保留重复值。','第一行n，第二行数组a，第三行数组b。原始完整范围2≤n≤100000，0≤a[i],b[i]≤10^9，两数组已排序。','双指针每次输出较小的未使用头元素，一边用完则追加另一边。','两数组各自的头是该数组最小未用元素，两头较小者就是全部剩余元素的最小值。逐项输出保持非递减且每次只消耗一个输入位置，最终恰好保留全部2n项。','时间O(n)，输出空间O(n)。',[([1,2,3],[2,5,5]),([0,0],[0,1]),([9,10],[1,2])],'分别1 2 2 3 5 5；0 0 0 1；1 2 9 10。',lambda r:(lambda n:(sorted(r.randint(0,15) for _ in range(n)),sorted(r.randint(0,15) for _ in range(n))))(r.randint(2,12)),lambda:[(([10**9]*100000,[10**9]*100000),seq([10**9]*200000)),((list(range(100000)),list(range(100000))),seq(v for i in range(100000) for v in (i,i)))],lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n',lambda x:seq(sorted(x[0]+x[1])),"def solve(d):\n    n=int(d[0]);a=list(map(int,d[1:n+1]));b=list(map(int,d[n+1:]));i=j=0;out=[]\n    while i<n and j<n:\n        if a[i]<=b[j]:out.append(a[i]);i+=1\n        else:out.append(b[j]);j+=1\n    out.extend(a[i:]);out.extend(b[j:]);return ' '.join(map(str,out))\n",[('去掉重复项','map(str,out)','map(str,sorted(set(out)))'),('遗漏剩余后缀','out.extend(a[i:]);out.extend(b[j:]);','')],2200030,output='输出非递减的2n个整数。')
def pairs_oracle(a):
    pairs=[tuple(sorted(t)) for t in combinations(a,2)];small=min(y-x for x,y in pairs);pairs=sorted((x,y) for x,y in pairs if y-x==small)
    return str(len(pairs))+'\n'+'\n'.join(seq(t) for t in pairs)
def pairs_edges():
    a=list(range(-10**9,-10**9+100000));out='99999\n'+'\n'.join(f'{a[i]} {a[i+1]}' for i in range(99999))
    return [(a,out),([-10**9,10**9],'1\n-1000000000 1000000000')]
add(56,'输出全部最小绝对差数对','给定互不相同的整数，找出绝对差最小的所有无序数对。每对小数在前，所有对按第一项、再第二项升序输出。','第一行n，第二行互异整数。2≤n≤100000，−10^9≤值≤10^9。','排序，求相邻差的最小值，再输出所有等于该差的相邻数对。','非相邻数之间至少夹一个不同值，其差是至少两个正相邻差之和，严格大于其中任一项，所以最小差只可能发生于相邻项。枚举所有相邻对并筛选即可不重不漏，顺序自然递增。','时间O(n log n)，空间O(n)。',[[-1,3,6,-5,0],[6,5,4,3,7],[1,3,5,10]],'分别只有-1 0；3 4、4 5、5 6、6 7；1 3、3 5。原站第一例错答案已按正文更正。',lambda r:r.sample(range(-30,31),r.randint(2,12)),pairs_edges,arr,pairs_oracle,"def solve(d):\n    a=sorted(map(int,d[1:]));delta=min(a[i+1]-a[i] for i in range(len(a)-1));pairs=[]\n    for x,y in zip(a,a[1:]):\n        if y-x==delta:pairs.append(f'{x} {y}')\n    return str(len(pairs))+'\\n'+'\\n'.join(pairs)\n",[('最大差误作最小差','delta=min(','delta=max('),('只输出第一对','return str(len(pairs))','pairs=pairs[:1];return str(len(pairs))')],1200020,output='第一行数对个数，随后每行两个整数，按指定顺序输出。')
def segments_oracle(s):
    dp=[0]+[len(s)+1]*len(s)
    for h in range(1,len(s)+1):
        for l in range(h):
            if len(set(s[l:h]))==h-l:dp[h]=min(dp[h],dp[l]+1)
    return dp[-1]
add(57,'无重复字符的最少连续分段','将字符串切成非空、互不相交的连续段，每个字符恰属一段，每段内部字符互不重复，求最少段数。','一行小写字符串，长度1..200000。','维护当前段出现字符，遇到重复字符就在它前面切开，开始新段。','贪心第一段是从起点能取得的最长合法前缀。任意最优方案的首段不可能更长；把它延长到贪心端点，只会删掉或缩短后续若干段，后续段仍合法且段数不增。递归应用得最优。','时间O(n)，额外空间O(26)。',['bcoc','abdaa','abcdefghijklmnopqrstuvwxyz'],'分别2、3、1。',lambda r:''.join(r.choice('abcde') for _ in range(r.randint(1,15))),lambda:[('a'*200000,200000),(('abcdefghijklmnopqrstuvwxyz'*7692+'abcdefgh'),7693)],lambda s:s+'\n',segments_oracle,"def solve(d):\n    seen=set();answer=1\n    for c in d[0]:\n        if c in seen:answer+=1;seen.clear()\n        seen.add(c)\n    return str(answer)\n",[('全局频次当段数','return str(answer)','return str(max(d[0].count(c) for c in set(d[0])))'),('重复后不清空','seen.clear()','pass')],200001)
def insertion_oracle(s):
    @lru_cache(None)
    def visit(l,h):
        if l>=h:return 0
        if h-l==1:return 1
        answer=min(visit(l,p)+visit(p,h) for p in range(l+1,h))
        if s[l]=='(' and s[h-1]==')':answer=min(answer,visit(l+1,h-1))
        return answer
    return visit(0,len(s))
add(58,'配平普通括号的最少插入数','只允许插入左右括号，将字符串变成普通合法括号串。每个左括号配一个右括号，求最少插入数。','一行仅含左右括号的字符串，长度1..100000。','维护未匹配左括号数量，遇右括号有左则抵消，无左则补一个左；最后补齐剩余左括号的右括号。','没有可匹配左括号的右括号必须各补一个左，剩余未匹配左括号必须各补一个右，两部分是必要下界。扫描中即时补左、末尾补右可合法配平并恰达到此下界。','时间O(n)，空间O(1)。',['()))','(()))','))(('],'分别2、1、4。原第二例的4实际对应另一个字符串，本站按正文和解释修正。',lambda r:''.join(r.choice('()') for _ in range(r.randint(1,12))),lambda:[('('*100000,100000),(')'*50000+'('*50000,100000),('()'*50000,0)],lambda s:s+'\n',insertion_oracle,"def solve(d):\n    left=missing=0\n    for c in d[0]:\n        if c=='(':left+=1\n        elif left:left-=1\n        else:missing+=1\n    return str(left+missing)\n",[('遗漏末尾补右括号','left+missing','missing'),('只算总数差','return str(left+missing)','return str(abs(d[0].count(\'(\')-d[0].count(\')\')))')],100001)
def digits_oracle(x):
    # Unit moves on each digit form a finite path graph; BFS each coordinate.
    total=0
    for a,b in zip(*x):
        for u,v in zip(str(a),str(b)):
            u=int(u);v=int(v);q=deque([(u,0)]);seen={u}
            while q:
                current,steps=q.popleft()
                if current==v:total+=steps;break
                for nxt in (current-1,current+1):
                    if 0<=nxt<=9 and nxt not in seen:seen.add(nxt);q.append((nxt,steps+1))
    return total
def digits_rand(r):
    a=[];b=[]
    for _ in range(r.randint(1,10)):
        length=r.randint(1,5);a.append(r.randint(10**(length-1),10**length-1));b.append(r.randint(10**(length-1),10**length-1))
    return a,b
add(59,'逐位修改数字以匹配数组','两数组对应整数位数相同，每次把arr1中某个整数的一个十进制位加1或减1，不能越过0..9，不进位、不换位。求与arr2完全一致的最少操作数。这是来源第一例逐位解释的操作。','第一行n，第二行arr1，第三行arr2。1≤n≤100000，1≤元素≤10^9，两数组等长，每对对应整数十进制位数相同。','逐个数字逐位累加对应数字字符的绝对差。','每次操作只能使一个数位向目标靠近至多1，该位至少需要两数字之差的绝对值次；逐位朝目标改动恰好达到这个下界，数位之间独立，无进位，因此所有下界相加即最优。','时间O(10n)，额外空间O(1)。',[([1234,4321],[2345,3214]),([1248],[8642]),([9],[1])],'分别10、17、8。第二例原输出16和解释15都不正确，7+4+0+6=17。',digits_rand,lambda:[(([100000000]*100000,[999999999]*100000),8000000),(([10**9]*100000,[10**9]*100000),0)],lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n',digits_oracle,"def solve(d):\n    n=int(d[0]);answer=0\n    for a,b in zip(d[1:n+1],d[n+1:]):\n        for x,y in zip(a,b):answer+=abs(ord(x)-ord(y))\n    return str(answer)\n",[('比较整体整数而非逐位','for x,y in zip(a,b):answer+=abs(ord(x)-ord(y))','answer+=abs(int(a)-int(b))'),('允许数字首尾环绕','abs(ord(x)-ord(y))','min(abs(ord(x)-ord(y)),10-abs(ord(x)-ord(y)))')],2200020)
def query_oracle(x):return '\n'.join(str(sum(abs(v-t) for v in x[0])) for t in x[1])
QUERY_CODE="""def solve(d):
    from bisect import bisect_left
    n,q=map(int,d[:2]);a=sorted(map(int,d[2:n+2]));prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    out=[]
    for t in map(int,d[n+2:]):
        p=bisect_left(a,t);out.append(t*p-prefix[p]+prefix[n]-prefix[p]-t*(n-p))
    return '\\n'.join(map(str,out))
"""
for number in (60,61):
    negative=number==60
    add(number,'独立查询统一价格的最少操作' if negative else '所有数组元素变成查询值的最少操作','每次操作对一个元素加1或减1。对每个查询值，求将全部元素变为该值的最少操作数。各查询相互独立，下一次查询前恢复原数组。','第一行n q，第二行数组，第三行q个查询。'+('来源无数值界，本站1≤n,q≤100000，数组和查询均为−10^9..10^9的整数。' if negative else '完整来源范围1≤n,q≤100000，数组和查询均为1..10^9的整数。'),'排序后求前缀和，用二分把小于目标与不小于目标的数分开，分别计算增量和减量。','单元素至少需要与目标绝对差次且可达到，各元素独立，答案是绝对差总和。分界左侧贡献t·p−前缀和，右侧贡献剩余和−t·(n−p)，因此前缀和公式精确，原数组从未更改确保查询独立。','预处理O(n log n)，每次O(log n)，空间O(n+q)，答案用64位整数。',[([3,1,6,8],[1,5]),([2,9,6,3],[10]),([1,1,1],[1,2,1])],'分别14和10；20；0、3、0。',lambda r,negative=negative:([r.randint(-10 if negative else 1,10) for _ in range(r.randint(1,12))],[r.randint(-10 if negative else 1,10) for _ in range(r.randint(1,12))]),lambda negative=negative:[(([-10**9 if negative else 1]*100000,[10**9]*100000),'\n'.join([str((2*10**9 if negative else 10**9-1)*100000)]*100000)),(([10**9]*100000,[10**9]*100000),'\n'.join(['0']*100000))],lambda x:f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',query_oracle,QUERY_CODE,[('不算右侧减少量','+prefix[n]-prefix[p]-t*(n-p)',''),('只算整体和的差','t*p-prefix[p]+prefix[n]-prefix[p]-t*(n-p)','abs(t*n-prefix[n])')],2400040,output='按查询顺序输出q行整数。')
def execute(path,inputs):
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300,check=True)
    out=json.loads(result.stdout);assert len(out)==len(inputs);return out
def main():
    batch='ibm-remaining-a';seed=20264161
    for name in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/name).mkdir(parents=True,exist_ok=True)
    sources={v['id']:v for v in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[];selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{batch}.json').exists():
        items=[v for v in json.loads((OUT/'batches'/f'{batch}.json').read_text())['items'] if int(v['id'].split('-')[-1]) not in selected]
        reports=[v for v in json.loads((OUT/'validation'/f'{batch}.json').read_text())['problems'] if int(v['id'].split('-')[-1]) not in selected]
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        ident=f"oa-ibm-{s['n']}";rng=random.Random(seed+s['n']);input_expr='sys.stdin.read()' if s.get('raw') else 'sys.stdin.read().split()'
        code=s['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({input_expr}))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](x),expectedOutput=str(s['oracle'](x))+'\n') for x in values]
        edges=s['edges']();tests=oracles[:3]+[dict(input=s['encode'](x),expectedOutput=str(y)+'\n') for x,y in edges]+oracles[3:31]
        for c in oracles+tests:assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
        def matches(a,b):return a==b if s.get('checker')=='exact' else a.split()==b.split()
        actual=execute(path,[c['input'] for c in oracles+tests])
        for i,(v,c) in enumerate(zip(actual,oracles+tests)):assert matches(v,c['expectedOutput']),(ident,i,v[:150],c['expectedOutput'][:150])
        timings=[]
        for c in tests[3:3+len(edges)]:
            started=time.perf_counter();v=execute(path,[c['input']])[0];timings.append(round(time.perf_counter()-started,4));assert matches(v,c['expectedOutput'])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];killed=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{ident}-{j}.py';mp.write_text(changed)
            outputs=execute(mp,[c['input'] for c in cases]);bad=[i for i,(v,c) in enumerate(zip(outputs,cases)) if not matches(v,c['expectedOutput'])];assert bad,(ident,name,'survived')
            mutants.append(dict(name=name,code=changed));killed.append(dict(name=name,rejectedByCases=bad))
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','IBM'],description=s['desc']+'\n\n标准输入输出由本站整理，补充数值界和无解编码均明确标注，不冒充来源原约束。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('time',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        proc=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert proc.returncode==0,(ident,proc.stderr[:2500]);normalized=proc.stdout;assert len(normalized.encode())<=128*1024*1024
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)];source=sources[ident]
        for folder,data in dict(packages=json.loads(normalized),oracles=oracles,mutants=mutants,editorials=dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():(OUT/folder/f'{ident}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=ident,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=s['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBoundaryWallSeconds=timings));print(ident,'163 oracle;',len(cases)-3,'hidden; 2 normal-exit wrong rejected; max local boundary',max(timings),flush=True)
        del edges,actual,outputs,oracles,tests,cases,normalized,proc
    items.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]));reviews=[]
    for n,name in SOURCE_NAMES.items():
        rel=f'fastprep/IBM/ibm-{name}.md';blob=subprocess.run(['git','rev-parse',f'e66f809f4c953bce129f68491726176615db6afc:{rel}'],cwd='/tmp/cswork-oa-source-20260919',text=True,capture_output=True,check=True).stdout.strip()
        reviews.append(dict(id=f'oa-ibm-{n}',status='blocked' if n in BLOCKED else 'authored',reason=BLOCKED.get(n,NOTES.get(n,'完整raw规则与约束已逐条核对，独立原创实现与小规模oracle。')),sourceCommit='e66f809f4c953bce129f68491726176615db6afc',sourcePath=rel,sourceBlob=blob,catalogContentHash=sources[f'oa-ibm-{n}']['contentHash']))
    for folder,data in {'batches':dict(schemaVersion=1,items=items),'validation':dict(schemaVersion=1,seed=seed,problems=reports,note='Local subprocess/runpy only; real sandbox required. Boundary wall time includes startup and JSON transport; no source solutions executed.'),'reviews':dict(schemaVersion=1,items=reviews)}.items():(OUT/folder/f'{batch}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

SOURCE_NAMES={41:'get-potential-of-winner',42:'get-query-answers',43:'get-smallest-string',44:'get-total-execution-time',45:'is-convertible-data',46:'max-index',47:'max-profit',48:'max-subjects-number',49:'max-xor',50:'maximize-minimum-distance',51:'maximize-resource-allocation',52:'maximum-efficiency',53:'meandering-array',54:'merge-arrays',55:'min-chairs',56:'minimum-difference',57:'minimum-disjoint-segments',58:'minimum-insertions-to-balance-a-parentheses-string',59:'minimum-moves',60:'minimum-operations-required',61:'minimum-operations-to-make-all-elements-equal'}
BLOCKED={47:'正文没有定义利润，第三例说明为2^i且每项选一次，但第二例cost=[19,78,27,15,20,25],x=25按此规则最优32而原答案16；核心收益及购买次数需要确认，不用来源代码补规则。',52:'允许同时到达两个测试却未定义零时长除零，还称效率可能为负；时间域、时长限制、无穷与数值精度均未定义，不能去重或改分母。',55:'没有保证事件合法；初始无椅，RCC中的R释放不存在的椅子，忽略/判错/机械增加空椅会产生不同结果；U是否需要先有R也未明示，不能缩去这些输入。'}
NOTES={42:'查询为精确key+timestamp；原例含大写键和超过23的小时，与自述限制冲突，新样例遵守原限制；缺失键长度明示本站预算。',46:'原steps≤2000完整保留；badIndex无界明示本站0..10^9，起点为禁点时无可行路径用本站−1输出，不删badIndex=0。',49:'raw恢复lo≤a<b≤hi及1≤lo<hi≤10^4。可能没有异或≤k的严格不同数对，本站输出−1，不允许a=b偷换题意。',54:'raw恢复1<n≤10^5，正文和例子要求输出全部2n项，Returns int[n]是大小笔误。',56:'来源自己注明第一例正确应[-1,0]；按正文最小绝对差实现，不沿用错误[0,3],[3,6]。',58:'原第二例(()))答案应1，原输出4混入另一输入))((；正文和说明都采用普通一对一括号匹配。',59:'原第一例逐位操作说明恢复正文含糊处：对应十进制位各自加减，不进位、不换位。第二例1248到8642正确17，原输出16和说明15均错。',60:'raw恢复0≤i<q；来源无数值界，本站n,q≤10^5且整数±10^9，不误称原约束。'}

if __name__=='__main__':main()
