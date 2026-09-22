"""Independent three-company batch. Large fixtures lazy; sources never executed."""
from pathlib import Path
from itertools import combinations,product
from functools import lru_cache
from collections import Counter,deque
from fractions import Fraction
import hashlib,json,random,subprocess,sys,time,gc
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='linkedin-adobe-twosigma-first';SEED=202609210;SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def jin(a):return json.dumps(a,ensure_ascii=False,separators=(',',':'))+'\n'
def add(company,n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=f'oa-{company}-{n}',company={'linkedin':'LinkedIn','adobe':'Adobe','two-sigma':'Two Sigma'}[company],title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def wildcard_oracle(x):
    s,p=x
    return next((i for i in range(len(s)-len(p)+1) if all(b=='*' or s[i+j]==b for j,b in enumerate(p))),-1)
def wildcard_random(r):
    s=''.join(r.choices('ab',k=r.randrange(12)));p=list(''.join(r.choices('ab',k=r.randrange(8))))
    if p and r.randrange(2):p[r.randrange(len(p))]='*'
    return s,''.join(p)
def wildcard_edges():
    yield ('a'*200000,'a'*199999+'b'),-1
    yield ('a'*200000,'a'*99999+'*'+'a'*100000),0
    yield ('a'*199999+'b','*b'),199998
    yield ('',''),0
add('linkedin',4,'单字符通配符的最早匹配','寻找模式在文本中的第一次出现，*恰代表一个任意字符而非任意长度。不存在返回−1，下标从0开始。','输入两行s和p。原文本s为a..z，模式p为a..z且至多一个*；原无长度界，本站0≤两串长度≤200000。空模式在0处匹配。','将模式在星号处分成两段，分别KMP标记出现位置，再按起点检查两段；没有星号只做一次KMP。','KMP标记全部且仅实际匹配起点。有星号时前段、一个任意字符、后段所占位置固定且互不重叠，两段都匹配且总长度足够，当且仅当整模式匹配。按起点升序首次成功即最早。','O(|s|+|p|)时间，O(|s|+|p|)空间。',[('abcabc','a*c'),('aaaa','*b'),('abc','')],wildcard_random,wildcard_edges,lambda x:x[0]+'\n'+x[1]+'\n',wildcard_oracle,
'''def solve(raw):
    s,p=raw.split('\\n')[:2];s=s.removesuffix('\\r');p=p.removesuffix('\\r');n=len(s)
    def matches(pattern):
        found=bytearray(n+1)
        if not pattern:return bytearray(b'\\1')*(n+1)
        pi=[0]*len(pattern);j=0
        for i in range(1,len(pattern)):
            while j and pattern[i]!=pattern[j]:j=pi[j-1]
            if pattern[i]==pattern[j]:j+=1
            pi[i]=j
        j=0
        for i,c in enumerate(s):
            while j and c!=pattern[j]:j=pi[j-1]
            if c==pattern[j]:j+=1
            if j==len(pattern):found[i-j+1]=1;j=pi[j-1]
        return found
    if '*' not in p:
        a=matches(p);return str(next((i for i,v in enumerate(a) if v),-1))
    k=p.index('*');a=matches(p[:k]);b=matches(p[k+1:])
    return str(next((i for i in range(n-len(p)+1) if a[i] and b[i+k+1]),-1))
''',[('错误星号匹配空串','b[i+k+1]','b[i+k]'),('错误返回一基下标','return str(next((i for i in range','return str(next((i+1 for i in range')],400010)

def game_oracle(a):
    @lru_cache(None)
    def f(i,c):
        if i==len(a):return (0,0)
        u=list(f(i+1,1-c));u[c]+=a[i];v=list(f(i+1,c));v[1-c]+=a[i]
        return tuple(u if u[c]>=v[c] else v)
    return seq(f(0,0))
def game_edges():
    yield [10**9]*100000,seq([50000*10**9]*2)
    yield [1]*99999,'50000 49999'
    yield [10**9],f'{10**9} 0'
    yield [1,10**9],f'{10**9} 1'
add('linkedin',5,'双核持锁分配的最优收益','按原顺序分配每个过程。持锁核可把当前过程给自己并换锁，或给另一核且保留锁；双方都最大化自己的最终总时间，初始核1持锁。','第一行n，第二行n个time。Millennium同题OCR001..004恢复原界1≤n≤100000、1≤time[i]≤10^9；操作针对当前第i项，原Fastprep的i+1为笔误。输出两个精确整数。','从后向前计算当前持锁者相对另一核的最优收益差d，递推d=|time−d|；结合总和还原两核收益。','若当前项给自己，换锁后后缀差值取负，得到time−d；给对方保锁得到d−time。持锁者选较大值，恰为绝对值。总收益固定，所以最大个人收益等价于最大差值。后向归纳得到初始核1的差，再由总和与差解出两项。','O(n)时间，除输入外O(1)空间；总和≤10^14。',[[10,21,10,21,10],[10,10,10,10],[7]],lambda r:[r.randint(1,30) for _ in range(r.randint(1,10))],game_edges,arr,game_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()[1:]));d=0
    for v in reversed(a):d=abs(v-d)
    total=sum(a);return f'{(total+d)//2} {(total-d)//2}'
''',[('错误从前向后递推','reversed(a)','a'),('错误先把首过程强给核1','d=0','d=a[0]')],1100020,output='输出核1、核2的总处理时间，各一个整数。')

def chain_oracle(a):
    def predecessor(s,t):
        if len(t)!=len(s)+1:return False
        return any(t[:i]+t[i+1:]==s for i in range(len(t)))
    @lru_cache(None)
    def f(i):return 1+max([f(j) for j in range(len(a)) if predecessor(a[i],a[j])] or [0])
    return max(map(f,range(len(a))))
def chain_edges():
    yield ['a'*i for i in range(1,17)]+['z'*16]*984,16
    yield ['a'*16]*1000,1
    yield ['a']*1000,1
add('linkedin',6,'插入一个字母的最长词链','从词表中选择词链，每个后词恰由前词插入一个字母且保留其余字母顺序得到，求最长链的词数。相同长度的词不能互为前驱。','第一行词数n，随后每行一个词。原界1≤n≤1000、每词长1..16，全部小写英文；允许重复词。','按长度排序，删除当前词每个位置，查询所得前驱的最长链，取最大加1。','任一合法前驱都恰好可由当前词删除一个位置得到，因此枚举无遗漏。前驱更短，排序保证其最优值已算出；DAG最长路递推归纳正确。重复相同词不会增加长度。','O(nL²)时间含字符串构造、O(nL)空间，L≤16。',[['a','b','ba','bca','bda','bdca'],['xbc','pcxbcf','xb','cxbc','pcxbc'],['abcd','dbqca']],lambda r:[''.join(r.choices('ab',k=r.randint(1,6))) for _ in range(r.randint(1,10))],chain_edges,lambda a:str(len(a))+'\n'+'\n'.join(a)+'\n',chain_oracle,
'''def solve(raw):
    a=raw.split()[1:];best={};answer=0
    for word in sorted(a,key=len):
        value=1+max(best.get(word[:i]+word[i+1:],0) for i in range(len(word)));best[word]=value;answer=max(answer,value)
    return str(answer)
''',[('错误只允许尾部插字母','range(len(word))','range(len(word)-1,len(word))'),('错误重复词增长','value=1+max(','value=1+best.get(word,0)+max(')],17020)

def peaks_oracle(a):
    n=len(a);best=None
    for mask in range(1<<max(0,n-2)):
        if mask&(mask<<1):continue
        selected=[i+1 for i in range(n-2) if mask>>i&1]
        cost=sum(max(0,max(a[i-1],a[i+1])+1-a[i]) for i in selected);key=(-len(selected),cost)
        best=key if best is None else min(best,key)
    return best[1]
def peaks_edges():
    yield [0]*200000,99999
    yield [-10**9,10**9]*100000,0
    yield [10**9,-10**9]*100000,0
    yield [10**9]*199999,99999
add('linkedin',7,'最多严格峰值所需的最小增加量','仅可增加数组项，每次增量是0..10^18整数。内点严格大于两邻项才算峰，端点不计。先最大化峰的数量，再最小化总增加量。','第一行n，第二行n个初值。原未给n或初值界，本站1≤n≤200000，初值−10^9..10^9；保留原单次增量上限10^18。','算出每个内点单独变峰的代价。奇数长度只能选奇下标；偶数长度枚举一段奇下标后接一段偶下标的切换点。','峰不能相邻，最多floor((n−1)/2)个。只抬选中峰、其他不变最省，且不相邻峰互不影响约束。奇数长度最大独立集唯一；偶数长度每个最大独立集恰为前若干奇下标接其后的偶下标。枚举所有此结构并求代价最小即最优。每点需增加≤2×10^9+1，原单次上限足够。','O(n)时间，O(n)空间。',[[1,1,1],[5,1,1,1,5],[1,2]],lambda r:[r.randint(-4,5) for _ in range(r.randint(1,10))],peaks_edges,arr,peaks_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()[1:]));n=len(a)
    if n<3:return '0'
    cost=[max(0,max(a[i-1],a[i+1])+1-a[i]) for i in range(1,n-1)]
    if n%2:return str(sum(cost[::2]))
    value=sum(cost[1::2]);answer=value
    for odd,even in zip(cost[::2],cost[1::2]):value+=odd-even;answer=min(answer,value)
    return str(answer)
''',[('错误允许与邻居相等','+1-a[i]','-a[i]'),('错误只选固定奇下标','value=sum(cost[1::2]);answer=value','return str(sum(cost[::2]));value=0;answer=0')],2400020)

def split_oracle(x):
    a,k=x
    return min(sum(max(a[l:h]) for l,h in zip((0,)+cuts,cuts+(len(a),))) for cuts in combinations(range(1,len(a)),k-1))
def split_edges():
    yield ([99999]*299,299),299*99999
    yield (list(range(1,300)),2),300
    yield ([99999]*299,2),199998
add('linkedin',8,'恰分K段的各段最大值之和最小','将数组保序划分为恰好K个非空连续段，最小化各段最大值的总和；不是最小化各段和的最大值。','第一行n K，第二行n个数。原界1<K≤n<300、1<a[i]<10^5，原例又含1；本站兼容该例为2≤K≤n≤299、1≤a[i]≤99999，原严格域全部保留。','DP逐段推进，枚举最后一段的起点，向左扩展维护该段最大值。','任一最优划分有唯一最后段起点；此前各段必须自身最优，否则可替换改进。枚举所有起点取此前最优加当前最大值，涵盖全部且不引入非法空段。归纳求得恰K段最优值。','O(Kn²)时间，滚动O(n)空间。',[([1,5,3,4,2],2),([2,2,2],3),([9,1,2],2)],lambda r:([r.randint(1,12) for _ in range(n)],r.randint(2,n)) if (n:=r.randint(2,9)) else None,split_edges,lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',split_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];dp=[0]+[10**30]*n
    for groups in range(1,k+1):
        nxt=[10**30]*(n+1)
        for end in range(groups,n+1):
            maximum=0
            for start in range(end-1,groups-2,-1):maximum=max(maximum,a[start]);nxt[end]=min(nxt[end],dp[start]+maximum)
        dp=nxt
    return str(dp[n])
''',[('错误段内取总和','maximum=max(maximum,a[start])','maximum+=a[start]'),('错误分成K减1段','range(1,k+1)','range(1,k)')],2110)

def bids_oracle(x):
    n,bids=x;choices=[[v for p,v in bids if p==i] for i in range(n)]
    return min(map(sum,product(*choices))) if all(choices) else -1
def bids_edges():
    n=499999
    yield (n,[(i,10**9) for i in range(n)]),n*10**9
    yield (n,[(i,-10**9) for i in range(n)]),-n*10**9
    yield (n,[(0,1)]*n),-1
add('adobe',1,'完成所有项目的最低报价总额','每个项目选择一份报价，求完成全部项目的最低总价；任何项目没有报价返回−1。报价之间互不限制。','第一行项目数p和报价数n，随后n行项目ID及报价。原完整界1≤p,n<500000，项目ID按原例为0..p−1。原报价值域缺失，本站补−10^9..10^9；输出精确整数。','逐项目保存最小报价，最后检查是否齐全并求和。','每个报价只完成其对应项目，任一方案费用在每项目都不小于该项目最小报价之和。各最小报价独立可同时选择，故下界可达；没有报价的项目无法完成。','O(n+p)时间、O(p)空间。',[(3,[(2,8),(0,7),(1,6),(2,9)]),(4,[(2,8),(0,7),(1,6)]),(1,[(0,0),(0,-2)])],lambda r:(n,[(r.randrange(n),r.randint(-5,8)) for _ in range(r.randint(1,8))]) if (n:=r.randint(1,4)) else None,bids_edges,lambda x:f'{x[0]} {len(x[1])}\n'+''.join(f'{i} {v}\n' for i,v in x[1]),bids_oracle,
'''def solve(raw):
    it=iter(map(int,raw.split()));p=next(it);n=next(it);best=[None]*p
    for _ in range(n):
        i=next(it);v=next(it)
        if best[i] is None or v<best[i]:best[i]=v
    return str(-1 if any(v is None for v in best) else sum(best))
''',[('错误每项目选最高报价','v<best[i]','v>best[i]'),('错误遗漏无报价项目','-1 if any(v is None for v in best) else sum(best)','sum(v for v in best if v is not None)')],9500040)

def rank_oracle(x):
    a,k=x;return sum(v>0 and 1+sum(w>v for w in a)<=k for v in a)
def rank_edges():
    yield ([0]*100000,100000),0
    yield ([100]*100000,1),100000
    yield ([100]*100000,-10**9),0
    yield ([100]*50000+[99]*50000,50000),50000
add('adobe',2,'竞争排名达到门槛的升级人数','同分玩家同排名，排名为1加严格更高分人数。仅排名数≤k且分数非0者升级。','第一行n k，第二行n个分数。原界1≤n≤100000、0≤score≤100、k≤n但无下界；本站补−10^9≤k≤n，k≤0时无人升级。','用101个分数桶，从高到低维护已见人数，当前非零分数排名为已见人数加1。','严格高于当前分数者恰是先前已累计桶，因此排名准确。整桶玩家同进同出；0分单独排除，故计数恰符合全部条件。','O(n+101)时间、O(101)额外空间。',[([100,50,50,25],3),([0,0],2),([100,100,10],1)],lambda r:([r.randint(0,5) for _ in range(n)],r.randint(-3,n)) if (n:=r.randint(1,10)) else None,rank_edges,lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',rank_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];buckets=[0]*101
    for v in d[2:]:buckets[v]+=1
    higher=0;answer=0
    for score in range(100,0,-1):
        if higher+1<=k:answer+=buckets[score]
        higher+=buckets[score]
    return str(answer)
''',[('错误允许零分升级','range(100,0,-1)','range(100,-1,-1)'),('错误使用密集排名','higher+=buckets[score]','higher+=int(buckets[score]>0)')],400040,explanation='原例升级3人。其余两例分别0与2；原汇总章示意代码未排除0分，不能沿用。')

def fraction_canonical(v):
    if v is None:return 'null'
    if v is True:return 'true'
    if v is False:return 'false'
    if isinstance(v,(int,Fraction)):
        f=Fraction(v);scaled=f*1000000;assert scaled.denominator==1
        sign='-' if scaled<0 else '';u=abs(scaled.numerator);a,b=divmod(u,1000000)
        return sign+str(a)+('.'+str(b).zfill(6).rstrip('0') if b else '')
    if isinstance(v,str):return json.dumps(v,ensure_ascii=True)
    if isinstance(v,list):return '['+','.join(map(fraction_canonical,v))+']'
    return '{'+','.join(json.dumps(k,ensure_ascii=True)+':'+fraction_canonical(v[k]) for k in sorted(v))+'}'
def dictionary_oracle(x):
    raw,path=x;obj=json.loads(raw,parse_float=Fraction);table={}
    def visit(v,keys):
        table[keys]=v
        if isinstance(v,dict):
            for k,w in v.items():visit(w,keys+(k,))
    visit(obj,());return fraction_canonical(table.get(tuple(path.split('.'))))
def dictionary_random(r):
    obj={'a':{'x':r.randint(-9,9),'empty':None,'b':r.choice([True,False])},'arr':[1,'中',None],'':{'z':'\0😀'},'decimal':r.choice([0.125,-0.5,1.25]),'z.z':3}
    return json.dumps(obj,ensure_ascii=False),r.choice(['a','a.x','a.empty','a.b','arr.0','arr','missing','.z','decimal','z.z'])
def dictionary_edges():
    # 1250 keys/values of ~200 codepoints: aggregate <=250000.
    obj={str(i):'😀'*196 for i in range(1250)};raw=json.dumps({'root':obj},ensure_ascii=False)
    yield (raw,'root'),fraction_canonical(obj)
    obj={'x':0}
    for _ in range(28):obj={'a':obj}
    yield (json.dumps(obj),'a.'*28+'x'),'0'
    yield ('{"v":-0.000000,"n":1000000000.000000}','v'),'0'
    yield ('{"v":-0.000000,"n":1000000000.000000}','n'),'1000000000'
add('adobe',3,'按点分路径读取嵌套字典值','按路径中点分隔的键逐层访问字典，缺键或中途不是对象返回null；数组不按索引访问。找到的任何JSON值原样返回，null不是字符串"null"。','输入两行：JSON对象及JSON字符串路径。路径非空、码点长≤200，空段按空键查找。原OCR末尾n字符串/m路径约束不对应单对象函数，本站明确资源协议：树节点≤5000、深度≤30、单键及字符串≤200码点、全部键/字符串合计≤250000码点；完整JSON标量/数组/对象，键是Unicode标量字符串，duplicate keys非法；数字有限、token≤64字符、指数绝对值≤12、值绝对值≤10^9且恰位于10^-6网格。输入总字节≤4MiB。','精确十进制解析JSON，逐段检查当前值为对象且键存在，最后把结果序列化为唯一规范JSON。','初始值是整个对象。每步若键存在，当前位置替换为该键值，恰为已消费路径的含义；若缺失或非对象，剩余路径不可能存在。归纳得到正确值。规范化仅改变表示：对象键按Unicode码点排序，数字用精确十进制去冗余零，字符串按ASCII JSON转义。','O(JSON输入大小+结果大小+路径长度)，排序对象键另计Σk log k，空间O(JSON树大小)。',[('{"car":{"wheels":2,"gears":5}}','car.gears'),('{"car":{"gears":5}}','car.color'),('{"a":{"z":1.250000,"b":true,"n":null}}','a')],dictionary_random,dictionary_edges,lambda x:x[0]+'\n'+jin(x[1]),dictionary_oracle,
'''def solve(raw):
    import json
    from decimal import Decimal
    first,second=raw.split('\\n')[:2];cur=json.loads(first,parse_int=Decimal,parse_float=Decimal);path=json.loads(second)
    for key in path.split('.'):
        if not isinstance(cur,dict) or key not in cur:cur=None;break
        cur=cur[key]
    def encode(v):
        if v is None:return 'null'
        if v is True:return 'true'
        if v is False:return 'false'
        if isinstance(v,Decimal):
            if not v:return '0'
            s=format(v,'f');return s.rstrip('0').rstrip('.') if '.' in s else s
        if isinstance(v,str):return json.dumps(v,ensure_ascii=True)
        if isinstance(v,list):return '['+','.join(encode(w) for w in v)+']'
        return '{'+','.join(json.dumps(k,ensure_ascii=True)+':'+encode(v[k]) for k in sorted(v))+'}'
    return encode(cur)
''',[('错误把null输出为字符串','if v is None:return \'null\'','if v is None:return \'"null"\''),('错误路径只取首键',"path.split('.'):","path.split('.')[:1]:")],4194304,checker='exact',output='输出规范ASCII JSON一行：对象键按Unicode码点升序，无多余空白；字符串用ASCII JSON转义（非BMP为小写四位代理对）；数字不用指数，去掉小数尾零与多余小数点、−0为0；true/false/null小写。字符串内部空格必须保留。',timeLimit=10)

def partition_oracle(x):
    a,k=x;n=len(a)
    @lru_cache(None)
    def f(mask):
        if not mask:return True
        ids=[i for i in range(n) if mask>>i&1];first=ids[0]
        for rest in combinations(ids[1:],k-1):
            group=(first,)+rest
            if len({a[i] for i in group})==k and f(mask^sum(1<<i for i in group)):return True
        return False
    return 'Yes' if n%k==0 and f((1<<n)-1) else 'No'
def partition_edges():
    yield ([1]*100000,1),'Yes'
    yield ([1]*100000,2),'No'
    yield (list(range(1,100001)),100000),'Yes'
    yield ([1,2]*50000,2),'Yes'
add('adobe',4,'等长且组内互异的子序列划分','将每个数组元素恰放进一个长度k的子序列，各组内部值两两不同；子序列保持原下标顺序但不要求连续。','第一行n k，第二行n个整数。OCR004定义、005补全原界1≤n≤100000、1≤k≤n、1≤a[i]≤100000。','检查n能被k整除，并且任一值出现次数不超过组数n/k。','必要性来自每组长度k且一个值在每组至多一次。充分性：按值集中处理出现项，循环分配给n/k个组；每值不超过组数，故同组无重复；总数是组数的k倍，循环后每组恰k项。各组按原下标排序得到合法子序列，故条件充分。','O(n)期望时间、O(不同值数)空间。',[([1,2,3,4],2),([1,2,2,3],3),([3,5,3,2],2)],lambda r:([r.randint(1,5) for _ in range(n)],r.randint(1,n)) if (n:=r.randint(1,9)) else None,partition_edges,lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',partition_oracle,
'''def solve(raw):
    from collections import Counter
    d=list(map(int,raw.split()));n,k=d[:2];frequency=Counter(d[2:])
    return 'Yes' if n%k==0 and max(frequency.values())<=n//k else 'No'
''',[('错误不检查整除','n%k==0 and ',''),('错误把最大频次与k比较','<=n//k','<=k')],700040,output='输出Yes或No。')

def ladder_oracle(x):
    begin,end,words=x
    if begin==end:return 0
    if end not in words:return -1
    words=list(set(words+[begin]));q=deque([(begin,0)]);seen={begin}
    while q:
        u,d=q.popleft()
        for v in words:
            if v not in seen and len(v)==len(u) and sum(a!=b for a,b in zip(u,v))==1:
                if v==end:return d+1
                seen.add(v);q.append((v,d+1))
    return -1
def ladder_random(r):
    words=[''.join(p) for p in product('ab',repeat=3)];return r.choice(words),r.choice(words),r.sample(words,r.randrange(9))
def ladder_edges():
    words=[''.join(chr(0x10000+j) for j in range(i,i+20)) for i in range(10000)]
    yield (words[0],words[-1],words),-1
    yield ('a'*20,'b'*20,['b'*i+'a'*(20-i) for i in range(21)]+['a'*20]*9979),20
    yield ('😀','😀',[]),0
add('adobe',5,'词表内单字符替换的最少操作','每次替换一个字符，所有经过的词必须在词表中（起点可不在）。终点不在词表则无解，但起终点相同时无需操作。求最少替换次数。','输入JSON数组[begin,end,wordList]。原无长度/字符/数量界，本站每词1..20个Unicode标量、词表0..10000项，起终点可异长；全部码点≤200040，标准JSON保留空白/NUL。不同长度无法通过替换互达，无解输出−1。','对同长度词按(删除位置,删除后的文本)分桶，BFS时每个桶只展开一次；桶使用结构键，不把某个普通字符当唯一通配符。','两个同长词仅一个位置不同，当且仅当对应删除位置与剩余文本相同。因此桶边准确涵盖一步替换。BFS首次到达是最少边数，每桶在最早距离展开后所有成员已可达，再展开不会更优。','O(nL²)构造时间、O(nL²)字符串桶空间，L≤20；每桶最多展开一次。',[('hit','cog',['hit','hot','dot','dog','cog']),('word','word',['word','ward']),('hit','cog',['hit','hot','dot','dog'])],ladder_random,ladder_edges,jin,ladder_oracle,
'''def solve(raw):
    import json
    from collections import defaultdict,deque
    begin,end,words=json.loads(raw)
    if begin==end:return '0'
    if end not in words or len(begin)!=len(end):return '-1'
    words=set(w for w in words if len(w)==len(begin));words.add(begin);groups=defaultdict(list)
    for word in words:
        for i in range(len(word)):groups[(i,word[:i]+word[i+1:])].append(word)
    q=deque([(begin,0)]);seen={begin}
    while q:
        word,d=q.popleft()
        for i in range(len(word)):
            for other in groups.pop((i,word[:i]+word[i+1:]),[]):
                if other==end:return str(d+1)
                if other not in seen:seen.add(other);q.append((other,d+1))
    return '-1'
''',[('错误答案统计词数','return str(d+1)','return str(d+2)'),('错误无解返回0',"return '-1'","return '0'")],2500000,timeLimit=10)

def jobs_oracle(x):
    a,major,minor=x
    @lru_cache(None)
    def f(state):
        if not any(state):return 0
        return 1+min(f(tuple(max(0,v-(major if i==j else minor)) for j,v in enumerate(state))) for i,v in enumerate(state) if v)
    return f(tuple(a))
def jobs_edges():
    yield ([10**9]*100000,1,0),10**14
    yield ([10**9]*100000,10**9,10**9-1),2
    yield ([0]*100000,2,1),0
    yield ([10**9],10**9,0),1
add('adobe',6,'主任务加速下完成全部工作的最少轮数','每轮选择一个未完成任务执行x秒，其他未完成任务执行y秒，x>y。达到各自所需时间即退出，求最少轮数。','第一行n x y，第二行n个所需时间。原只有x>y、没有数值界；本站1≤n≤100000、0≤time≤10^9、0≤y<x≤10^9。时间0的任务初始已完成。','二分轮数t，每项先获t*y基准服务，剩余需ceil((time−t*y)/(x−y))次主任务，累计是否≤t。','任何t轮安排都只有t个主任务名额，故需求总数≤t必要。满足时给各任务所需名额即可；若其提前完成，则将剩余名额交给任意仍未完成任务只会增加服务，不会破坏完成。因此判定充分，且可行性随t单调。仅主任务处理所有任务给出有限上界，y=0也适用。','O(n log答案)时间、O(n)输入空间，答案可达10^14。',[([3,4],3,1),([0,0],2,1),([4,4],1,0)],lambda r:([r.randint(0,6) for _ in range(r.randint(1,4))],x,r.randrange(x)) if (x:=r.randint(1,5)) else None,jobs_edges,lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n',jobs_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,x,y=d[:3];a=d[3:];delta=x-y;lo=0;hi=sum((v+x-1)//x for v in a)
    while lo<hi:
        t=(lo+hi)//2;need=0
        for v in a:
            need+=max(0,v-t*y+delta-1)//delta
            if need>t:break
        if need<=t:hi=t
        else:lo=t+1
    return str(lo)
''',[('错误需求向下取整','v-t*y+delta-1','v-t*y'),('错误需求只看最大单项','need+=max(0,v-t*y+delta-1)//delta','need=max(need,max(0,v-t*y+delta-1)//delta)')],1100050,timeLimit=10)

def throughput_oracle(x):
    tp,cost,budget=x;best=0
    for choices in product(*(range(budget//c+1) for c in cost)):
        if sum(c*q for c,q in zip(cost,choices))<=budget:best=max(best,min(v*(q+1) for v,q in zip(tp,choices)))
    return best
def throughput_edges():
    yield ([10**9]*100000,[1]*100000,10**9),10001000000000
    yield ([1]*100000,[10**9]*100000,10**9),1
    yield ([10**9],[1],10**9),1000000001000000000
    yield ([0,10**9],[1,1],10**9),0
add('two-sigma',1,'串联流水线预算内的最大吞吐','第i个服务扩容一次支付cost[i]，扩容t次后吞吐tp[i]*(1+t)。串联流水线吞吐为所有服务最小值，求总费用不超过预算时的最大吞吐。','第一行n budget，第二行n个tp，第三行n个cost。原OCR001/002未给数值界，本站1≤n≤100000、0≤tp≤10^9、1≤cost≤10^9、0≤budget≤10^9；正成本明确排除无限免费扩容，0吞吐始终不能提高。','二分目标吞吐T，逐服务计算达到T所需的最少扩容成本并求和；任一tp为0直接输出0。','各服务必须都达到T，每项最少次数max(0,ceil(T/tp)−1)，这些次数独立相加即最小总成本，故判定充要。T提高不会降低成本，可二分。任一服务即使独占全部预算能达到的吞吐也给出全局上界，取这些上界最小值。','O(n log上界)时间、O(n)空间，答案最大约10^18，费用累计超预算即可停止。',[([4,2,7],[3,5,6],32),([2],[3],0),([0,8],[1,2],10)],lambda r:([r.randint(0,6) for _ in range(n)],[r.randint(1,5) for _ in range(n)],r.randint(0,8)) if (n:=r.randint(1,4)) else None,throughput_edges,lambda x:f'{len(x[0])} {x[2]}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',throughput_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,budget=d[:2];a=d[2:2+n];cost=d[2+n:]
    if 0 in a:return '0'
    lo=min(a);hi=min(v*(1+budget//c) for v,c in zip(a,cost))
    while lo<hi:
        mid=(lo+hi+1)//2;spent=0
        for v,c in zip(a,cost):
            spent+=max(0,(mid+v-1)//v-1)*c
            if spent>budget:break
        if spent<=budget:lo=mid
        else:hi=mid-1
    return str(lo)
''',[('错误只优化最后服务','lo=min(a);','return str(a[-1]*(1+budget//cost[-1]));lo=min(a);'),('错误漏掉初始一份吞吐','(mid+v-1)//v-1','(mid+v-1)//v')],2200040,timeLimit=10)

def divisible_oracle(x):
    a,k=x;return sum((a[i]+a[j])%k==0 for i in range(len(a)) for j in range(i))
def divisible_edges():
    yield ([10**9]*100000,10**9),4999950000
    yield ([1]*100000,10**9),0
    yield (list(range(1,100001)),1),4999950000
add('two-sigma',2,'两数之和可整除N的下标对数','统计i<j且a[i]+a[j]可被N整除的下标对。重复值的元素有不同身份，不能与自身配对。','第一行数组长n及除数N，第二行n个数。完整原界1≤n≤100000、1≤N≤10^9、1≤a[i]≤10^9，输出64位整数。','顺序扫描余数，用字典记录此前余数频次，累加互补余数再加入当前元素。','和整除N等价于余数互补。处理j时字典仅含i<j，互补项恰为所有以j为右端的合法对，逐j无重无漏且不配自身。','O(n)期望时间、O(n)空间，不分配N长度数组。',[([5,4,3,2,1],3),([1,1,1],2),([3],3)],lambda r:([r.randint(1,30) for _ in range(r.randint(1,10))],r.randint(1,12)),divisible_edges,lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',divisible_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];seen={};answer=0
    for v in d[2:]:
        r=v%k;answer+=seen.get((-r)%k,0);seen[r]=seen.get(r,0)+1
    return str(answer)
''',[('错误包含自配对','answer+=seen.get((-r)%k,0);seen[r]=seen.get(r,0)+1','seen[r]=seen.get(r,0)+1;answer+=seen.get((-r)%k,0)'),('错误只算两值不同','answer+=seen.get((-r)%k,0)','answer+=seen.get((-r)%k,0) if r!=(-r)%k else 0')],1100040,explanation='首例4对：原下标(0,1)、(0,4)、(1,3)、(3,4)。原解释倒序了数组却没同步下标，本站纠正。另两例3、0。')

def fill_encode(x):
    a,r,c,v=x;return f'{len(a)} {len(a[0])} {r} {c} {v}\n'+''.join(seq(row)+'\n' for row in a)
def fill_oracle(x):
    a,r,c,v=x;h=len(a);w=len(a[0]);parent=list(range(h*w))
    def root(i):
        while parent[i]!=i:i=parent[i]
        return i
    for i in range(h):
        for j in range(w):
            for u,z in ((i-1,j),(i,j-1)):
                if u>=0 and z>=0 and a[u][z]==a[i][j]:parent[root(i*w+j)]=root(u*w+z)
    start=root(r*w+c)
    return '\n'.join(seq(v if root(i*w+j)==start else a[i][j] for j in range(w)) for i in range(h))
def fill_random(r):
    h,w=r.randint(1,5),r.randint(1,5);return [[r.randint(-1,2) for _ in range(w)] for _ in range(h)],r.randrange(h),r.randrange(w),r.randint(-2,3)
def fill_edges():
    n=1000
    yield ([[0]*n for _ in range(n)],0,0,-10**9),'\n'.join([seq([-10**9]*n)]*n)
    yield ([[-10**9]*n for _ in range(n)],999,999,-10**9),'\n'.join([seq([-10**9]*n)]*n)
    a=[[(i+j)%2 for j in range(n)] for i in range(n)];a[0][0]=2
    expected='\n'.join(seq(row) for row in a);a[0][0]=0
    yield (a,0,0,2),expected
add('two-sigma',3,'替换起点四方向同值连通区域','将起点及与其通过上下左右同原值格连通的所有位置改为指定值；仅对角接触不连通。','第一行行数r、列数c、起点行列及替换值，随后r行矩阵。原约束Unknown，本站明确1≤r,c≤1000、矩阵及替换值−10^9..10^9、起点合法0基；不是伪称catalog补界为原界。','迭代BFS扩展四邻格，入队时立即改色作为已访问标记；新旧值相同则直接返回。','初始队列是目标分量中的起点。每个扩展的同旧值四邻格仍在目标分量，且立即标记不会重复入队；任一分量格沿路径可逐步发现，故遍历恰覆盖整块。相同替换值时无需访问即可得到正确原图。','O(rc)时间、O(rc)空间；packed整数数组和整数格编号队列避免百万对象膨胀。',[([[0,1,0],[1,1,0]],1,1,2),([[1,0],[0,1]],0,0,3),([[-1]],0,0,-1)],fill_random,fill_edges,fill_encode,fill_oracle,
'''def solve(raw):
    import re
    from array import array
    from collections import deque
    values=(int(m.group()) for m in re.finditer(r'-?\\d+',raw));h=next(values);w=next(values);r=next(values);c=next(values);new=next(values);a=array('q',values);start=r*w+c;old=a[start]
    if old!=new:
        q=deque([start]);a[start]=new
        while q:
            i=q.popleft();row,col=divmod(i,w)
            neighbors=[]
            if row:neighbors.append(i-w)
            if row+1<h:neighbors.append(i+w)
            if col:neighbors.append(i-1)
            if col+1<w:neighbors.append(i+1)
            for j in neighbors:
                if a[j]==old:a[j]=new;q.append(j)
    return '\\n'.join(' '.join(map(str,a[i*w:(i+1)*w])) for i in range(h))
''',[('错误只考虑水平方向','if row:neighbors.append(i-w)','if False:neighbors.append(i-w)'),('错误最后一列不可向左','if col:neighbors.append(i-1)','if col and col<w-1:neighbors.append(i-1)')],12000060,outputLimit=16384,timeLimit=10,output='输出替换后的r行矩阵，每行c个整数，不重复输出维度。')

def decimal_token(v):
    sign='-' if v<0 else '';a,b=divmod(abs(v),1000000)
    return sign+str(a)+('.'+str(b).zfill(6).rstrip('0') if b else '')
def interpolate_encode(x):
    points,queries=x;return f'{len(points)} {len(queries)}\n'+''.join(decimal_token(a)+' '+decimal_token(b)+'\n' for a,b in points)+''.join(decimal_token(v)+'\n' for v in queries)
def rational_six(v):
    from decimal import Decimal,localcontext,ROUND_HALF_UP
    with localcontext() as ctx:
        ctx.prec=100
        s=format((Decimal(v.numerator)/Decimal(v.denominator)).quantize(Decimal('0.000001'),rounding=ROUND_HALF_UP),'f')
    return '0.000000' if s=='-0.000000' else s
def interpolate_oracle(x):
    points,queries=x;points=sorted(points);out=[]
    for query in queries:
        i=0
        while i+1<len(points)-1 and points[i+1][0]<=query:i+=1
        a,b=points[i];c,d=points[i+1]
        value=(Fraction(b)+Fraction((d-b)*(query-a),c-a))/1000000
        out.append(rational_six(value))
    return '\n'.join(out)
def interpolate_random(r):
    n=r.randint(2,7);xs=r.sample(range(-12,13),n);points=[(x*r.choice([1,1000000]),r.randint(-20,20)) for x in xs]
    # Multipliers can coincide only at zero; remove collisions then ensure 2.
    points=list(dict(points).items())
    if len(points)<2:points=[(-1,-2),(1,2)]
    r.shuffle(points);return points,[r.randint(-20,20)*r.choice([1,1000000]) for _ in range(r.randint(1,8))]
def interpolate_edges():
    n=200000
    points=[(i*1000000,i*1000000) for i in range(n-1,-1,-1)];queries=list(range(n))
    yield (points,[v*1000000 for v in queries]),'\n'.join(f'{v}.000000' for v in queries)
    points=[(-10**12,-10**12),(-10**12+1,10**12)];query=10**12
    answer=rational_six((Fraction(-10**12)+Fraction(2*10**12*(query+10**12),1))/1000000)
    yield (points,[query]*n),'\n'.join([answer]*n)
    yield ([(0,1),(3,2)],[-1,0,1,2,3,4]),interpolate_oracle(([(0,1),(3,2)],[-1,0,1,2,3,4]))
add('two-sigma',5,'折线的分段线性插值与两端外推','把点按x升序连接相邻点。查询位于点之间时线性插值，左外侧延长首段、右外侧延长末段；恰落节点返回其y。答案按绝对误差≤10^-6验收，不是相对误差。','第一行n q，随后n行x y，随后q行查询x。保留原2≤n≤200000、1≤q≤200000，点乱序且x互异。原无坐标数值界，本站补：输入坐标是普通有符号有限十进制、不用指数或冗余前导零、小数至多6位，绝对值≤10^6。每个输出token≤64字节，普通十进制或科学计数均可、指数绝对值≤30，必须有限；恰输出q项，无数量前缀。','输入乘10^6精确转整数，排序x后对每查询二分定位段，计算精确有理数。用整数除法把结果舍入到6位小数，不经过double。','折线每个查询对应唯一相邻段，外侧按首末段处理，二分选择正确。整数缩放与有理式完全等价于ya+(yb−ya)(x−xa)/(xb−xa)，没有舍入误差。最终四舍五入到10^-6网格误差至多0.5×10^-6，满足验收。即便外推接近4×10^18仍保持精度。','O((n+q)log n)时间、O(n+q)空间；精确整数只涉及固定资源域内有限位数。',[([(0,0),(2000000,4000000)],[1000000,-1000000,3000000]),([(1000000,2000000),(0,1000000)],[0,1000000]),([(-1000000,0),(1000000,1)],[0])],interpolate_random,interpolate_edges,interpolate_encode,interpolate_oracle,
'''def solve(raw):
    from bisect import bisect_right
    def scaled(s):
        sign=-1 if s.startswith('-') else 1;s=s.lstrip('+-');a,_,b=s.partition('.')
        return sign*(int(a)*1000000+int((b+'000000')[:6]))
    tokens=iter(raw.split());n=int(next(tokens));q=int(next(tokens));points=sorted((scaled(next(tokens)),scaled(next(tokens))) for _ in range(n));xs=[p[0] for p in points];out=[]
    for _ in range(q):
        x=scaled(next(tokens));i=max(0,min(n-2,bisect_right(xs,x)-1));a,b=points[i];c,d=points[i+1];den=c-a;num=b*den+(d-b)*(x-a)
        sign='-' if num<0 else '';units,rem=divmod(abs(num),den)
        if 2*rem>=den:units+=1
        if units==0:sign=''
        whole,part=divmod(units,1000000);out.append(sign+str(whole)+'.'+str(part).zfill(6))
    return '\\n'.join(out)
''',[('错误忽略斜率','num=b*den+(d-b)*(x-a)','num=b*den'),('错误外推钳制x','x=scaled(next(tokens));','x=max(xs[0],min(xs[-1],scaled(next(tokens))));')],9600040,checker='oa-piecewise-linear',outputLimit=16384,timeLimit=10,output='每个查询输出一个有限十进制数，共q行，无计数头；科学计数允许。绝对误差不超过0.000001即正确。拒绝NaN、Infinity、遗漏或多余答案；末尾换行可选，总stdout≤16MiB。')

SPECS[-1]['limits'] += ' 输入数字必须有整数部分；如有小数点，其后必须有1..6位数字，不接受.5、1.或指数形式；可带+或−号，允许负零。'

def drainage_oracle(x):
    parent,a=x;n=len(a);best=None
    for cut in range(1,n):
        graph=[[] for _ in a]
        for i in range(1,n):
            if i!=cut:graph[i].append(parent[i]);graph[parent[i]].append(i)
        seen={cut};stack=[cut]
        while stack:
            for j in graph[stack.pop()]:
                if j not in seen:seen.add(j);stack.append(j)
        diff=abs(sum(a)-2*sum(a[i] for i in seen));best=diff if best is None else min(best,diff)
    return best
def drainage_random(r):
    n=r.randint(2,10);return [-1]+[r.randrange(i) for i in range(1,n)],[r.randint(1,10) for _ in range(n)]
def drainage_edges():
    n=100000
    yield ([-1]+[0]*(n-1),[10000]*n),(n-2)*10000
    yield ([-1]+[0]*(n-1),[1]*n),n-2
    # A chain of depth499; append leaves at root. Source depth<=500 preserved.
    p=[-1]+list(range(499))+[0]*(n-500)
    yield (p,[1]*n),n-2*499
add('two-sigma',6,'剪断排水树一条边的最小流量差','树根为0，每节点有直接入水量。恰剪断一条父子边，把树分成两块，最小化两块直接入水总量的绝对差。','第一行n，第二行n个parent，第三行n个直接入水量。完整原界2≤n≤100000、入水1..10000、parent[0]=−1、0≤parent[i]<i，树深度最多500。','因父编号严格更小，按编号逆序把子树流量加给父，随后遍历非根节点作为剪断子树。','逆序处理节点时其所有后代已经累加，因此得到准确子树总流量。剪该节点与父边后两块分别为其子树与其余节点，流量差为|total−2*sub|。每条可剪边与一个非根节点唯一对应，取最小无漏。','O(n)时间、O(n)空间，无递归深度风险。',[([-1,0,0,1,1,2],[1,2,2,1,1,1]),([-1,0,1,2],[1,4,3,4]),([-1,0],[10000,1])],drainage_random,drainage_edges,lambda x:arr(x[0])+seq(x[1])+'\n',drainage_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n=d[0];parent=d[1:n+1];sub=d[n+1:]
    for i in range(n-1,0,-1):sub[parent[i]]+=sub[i]
    total=sub[0];return str(min(abs(total-2*v) for v in sub[1:]))
''',[('错误把子树直接入水当总量','sub[parent[i]]+=sub[i]','pass'),('错误只算一倍子树','total-2*v','total-v')],1200020)

# Explicit encoding details shared with the independent checker authors.
next(s for s in SPECS if s['n']=='oa-two-sigma-5')['limits']+=' 输入坐标严格语法[+-]?(0|[1-9][0-9]*)([.][0-9]{1,6})?；允许+号、负零及尾零，不接受.5或1.；n/q为无冗余前导零的正整数。每物理行字段数如上，行内空格/制表分隔；LF或CRLF，末尾换行可选，无额外空行。总输入≤9600040字节，输出ASCII空白分隔且≤16MiB。'
next(s for s in SPECS if s['n']=='oa-adobe-3')['output']+=' 字符串唯一转义等价Python json.dumps(value, ensure_ascii=True)：可打印ASCII除双引号/反斜线外原样（包括/），这两者用反斜线转义；退格、换页、换行、回车、制表用短转义，其余控制字符及DEL/非ASCII用小写四位Unicode转义，非BMP用代理对。'
BLOCKED={'oa-linkedin-1':'重复entry/road如何重置未定义，合法子序列与严格事件状态机不同。','oa-linkedin-2':'perfect pair两比较式原文缺失，不能凭他公司同名题猜。','oa-linkedin-3':'正文及K含义缺失，原例K3却解释终点4，不能猜图目标。','oa-two-sigma-4':'正文截断且两位小数舍入规则缺失，中点样例无法确定。'}
EVIDENCE={}
for i,slug in enumerate(['count-completed-trips','find-number-of-perfect-pairs','find-the-path','first-occurrence','get-process-time','longest-string-chain','optimize-context-switching','split-array-largest-sum'],1):EVIDENCE[f'oa-linkedin-{i}']=['fastprep/LinkedIn/linkedin-'+slug+'.md']
EVIDENCE['oa-linkedin-5']+=['OA LIST/Millennium_OA/'+str(n).zfill(3)+'_image.txt' for n in (1,2,3,4)]
for n in range(1,5):EVIDENCE[f'oa-adobe-{n}']=['OA LIST/Adobe_OA/'+str(n).zfill(3)+'_image.txt','OA LIST/Adobe_OA/_chapter.md']
EVIDENCE['oa-adobe-4'].append('OA LIST/Adobe_OA/005_image.txt')
EVIDENCE['oa-adobe-5']=['fastprep/Adobe/adobe-determine-edit-distance-in-word-ladder.md']
EVIDENCE['oa-adobe-6']=['fastprep/Adobe/get-minimum-operations-adobe.md']
EVIDENCE['oa-two-sigma-1']=['OA LIST/Two_Sigma/001_image.txt','OA LIST/Two_Sigma/002_image.txt','OA LIST/Two_Sigma/_chapter.md']
for n,slug in enumerate(['ts-nums-that-can-be-divided-by-n','ts-replacing-num','twosigma-calculate-y-over-x','twosigma-piecewise-linear-interpolation','twosigma-sewer-drainage-partition'],2):EVIDENCE[f'oa-two-sigma-{n}']=['fastprep/Two Sigma/'+slug+'.md']
def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(a,b,s):
    if s.get('checker')=='oa-piecewise-linear':
        try:
            x=a.split();y=b.split()
            return len(x)==len(y) and all(abs(Fraction(u)-Fraction(v))<=Fraction(1,1000000) for u,v in zip(x,y))
        except (ValueError,ZeroDivisionError):return False
    if s.get('checker')=='exact':return a.rstrip('\n')==b.rstrip('\n')
    if a==b:return True
    import re
    from itertools import zip_longest
    return all(x==y for x,y in zip_longest((m.group() for m in re.finditer(r'\S+',a)),(m.group() for m in re.finditer(r'\S+',b))))
SMALL_RUNNER="""import io,json,sys,contextlib
if hasattr(sys,'set_int_max_str_digits'):sys.set_int_max_str_digits(0)
code,inputs=json.load(sys.stdin);out=[]
for raw in inputs:
    sys.stdin=io.StringIO(raw);buf=io.StringIO()
    with contextlib.redirect_stdout(buf):exec(compile(code,'<authored>','exec'),{'__name__':'__main__'})
    out.append(buf.getvalue())
print(json.dumps(out,ensure_ascii=False))
"""
def small_check():
    selected={v for v in sys.argv[1:] if v!='--small'}
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        rng=random.Random(SEED+sum(s['n'].encode()));values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        cases=[(s['encode'](v),str(s['oracle'](v))+'\n') for v in values];code=code_for(s)
        def run(program):
            p=subprocess.run([sys.executable,'-I','-c',SMALL_RUNNER],input=json.dumps([program,[raw for raw,_ in cases]],ensure_ascii=False),text=True,capture_output=True,timeout=120)
            assert p.returncode==0,(s['n'],p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(cases);return out
        actual=run(code)
        for i,(a,(_,expected)) in enumerate(zip(actual,cases)):assert equal(a,expected,s),(s['n'],i,cases[i][0],a,expected)
        for name,old,new in s['mutants']:
            assert old in code,(s['n'],name)
            assert any(not equal(a,expected,s) for a,(_,expected) in zip(run(code.replace(old,new)),cases)),(s['n'],name,'survived')
        print(s['n'],len(cases),'independent small cases; 2 normal-exit WA; real stdin/stdout passed',flush=True)
def execute(path,inputs):
    begin=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(inputs)
    return out,time.monotonic()-begin
def main():
    if '--small' in sys.argv:small_check();return
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(sys.argv[1:])
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in sorted(SPECS,key=lambda s:s['n']):
        number=s['n'];ident=number
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(SEED+sum(number.encode()))
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=str(s['oracle'](v))+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=str(a)+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:31];assert 31<=len(tests)<=64
        for c in oracles+tests:
            assert len(c['input'].encode())<=s['bound']<=32*1024*1024,(ident,len(c['input'].encode()),s['bound'])
            assert len(c['expectedOutput'].encode())<=s.get('outputLimit',4096)*1024
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert equal(a,c['expectedOutput'],s),(ident,i,a[:200],c['expectedOutput'][:200])
        del actual
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not equal(a,c['expectedOutput'],s)];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected));del outputs
        explanation=s.get('explanation','三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') or '空文本' for c in oracles[:3])+'。独立枚举或直接模拟已核对。')
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA',s['company']],description=s['desc']+'\n\n本站独立整理标准I/O与题解；来源缺失界的补充及样例纠错在协议中明示。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        assert len(normalized.encode())<=128*1024*1024,(ident,'package exceeds128MiB')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        assert (OUT/'packages'/f'{ident}.json').stat().st_size<=128*1024*1024
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracle;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:x['id']);reports.sort(key=lambda x:x['id'])
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del cases,tests,boundary,oracles,normalized,p,doc,c;gc.collect()
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,paths in EVIDENCE.items():
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=number;reason=BLOCKED[number] if number in BLOCKED else next(s['desc']+' '+s['limits'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
