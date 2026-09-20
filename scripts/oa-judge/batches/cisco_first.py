"""Original Cisco1–18: 13 ready, 5 blocked; immutable raw is evidence only.
Import only defines small metadata/functions. Full generation is remote-only;
--small runs independent tiny oracles and real stdin/stdout, no large fixtures.
"""
from pathlib import Path
from collections import deque
from itertools import combinations,groupby
from math import isqrt,comb
import hashlib,json,random,subprocess,sys,time,gc
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='cisco-first';SEED=20261800;SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def fizz_oracle(n):
    three=set(range(3,n+1,3));five=set(range(5,n+1,5));out=[]
    for i in range(1,n+1):
        word=('Fizz' if i in three else '')+('Buzz' if i in five else '');out.append(word or str(i))
    return '\n'.join(out)
def fizz_boundary_expected(n):
    # Independent fixed 15-position pattern, chunked to avoid millions of
    # live Python strings even while constructing a large expected output.
    pattern=[None,None,'Fizz',None,'Buzz','Fizz',None,None,'Fizz','Buzz',None,'Fizz',None,None,'FizzBuzz'];blocks=[];part=[]
    for start in range(0,n,15):
        for k,label in enumerate(pattern,1):
            value=start+k
            if value<=n:part.append(label if label else str(value))
        if len(part)>=8192:blocks.append('\n'.join(part));part=[]
    if part:blocks.append('\n'.join(part))
    return '\n'.join(blocks)
def fizz_edges():
    for n in (1999999,1999995,15):yield n,fizz_boundary_expected(n)
add(1,'逐行输出完整范围的FizzBuzz','按整数1..N的递增顺序，每个整数输出一行：同时被3和5整除则FizzBuzz；只被3整除则Fizz；只被5整除则Buzz；否则输出该整数。','输入一个整数N。OCR及Fastprep完整原界0<N<2×10^6，即1≤N≤1999999，不能误写≤2000000。','每个整数按15、3、5整除优先级分类；每8192行合并成一个字符串块，最终合并块返回，避免持有近200万个独立字符串对象。','3和5互素，同时整除等价于15整除。先处理15后，后续3和5分支互斥且符合只整除一方的要求；最后分支恰为两者都不整除。逐整数递增遍历，每个数只输出一次，分块仅改变缓冲方式不改变行顺序。','时间O(N+输出字节数)，输出缓冲O(输出字节数)，短行对象仅约8192个；最大合法输出含终换行13140738字节，配置16MiB输出上限。',[5,15,1],lambda r:r.randint(1,100),fizz_edges,lambda n:str(n)+'\n',fizz_oracle,
'''def solve(raw):
    n=int(raw);blocks=[];part=[]
    for i in range(1,n+1):
        if i%15==0:value='FizzBuzz'
        elif i%3==0:value='Fizz'
        elif i%5==0:value='Buzz'
        else:value=str(i)
        part.append(value)
        if len(part)==8192:blocks.append('\\n'.join(part));part=[]
    if part:blocks.append('\\n'.join(part))
    return '\\n'.join(blocks)
''',[('同时整除错误只输出Fizz',"value='FizzBuzz'","value='Fizz'"),('错误漏掉N','range(1,n+1)','range(1,n)')],8,output='输出N行，大小写严格按Fizz、Buzz、FizzBuzz，最后一行允许换行。',outputLimit=16384,timeLimit=10)

def jars_oracle(a):return str(max(sum(v for i,v in enumerate(a) if mask>>i&1) for mask in range(1<<len(a)) if not mask&(mask<<1)))
def jars_edges():
    yield [10**9]*1000,'500000000000'
    yield [0]*1000,'0'
    yield [10**9]+[0]*998+[10**9],'2000000000'
add(2,'不取相邻罐子的最多巧克力','罐子按线性顺序排列，可选择任意若干罐子，但不能同时选择相邻两罐；取走选中罐内全部巧克力，求最多总数。允许空罐，也允许不取。首尾并不相邻。','第一行N，第二行N个非负巧克力数。OCR给1<N≤1000，完整同题Fastprep明确1≤N≤1000，本站按后者覆盖单罐。原文无罐内数量上界，本站补0≤a[i]≤10^9。','维护前i−2罐和前i−1罐最优值，当前最优为不取当前的前一值与取当前的前二值+a[i]中较大者。','最优方案不取当前罐时为前i−1罐最优；取当前罐时必须跳过相邻的前一罐，其余恰为前i−2罐的最优。两个分支穷尽所有方案，空前缀值0建立归纳，因此滚动更新给出全局最优。','时间O(N)，辅助空间O(1)不计输入，总数64位。',[[5,30,99,60,5,10],[9],[9,0,9]],lambda r:[r.randint(0,30) for _ in range(r.randint(1,12))],jars_edges,arr,jars_oracle,
'''def solve(raw):
    values=map(int,raw.split());n=next(values);older=previous=0
    for value in values:older,previous=previous,max(previous,older+value)
    return str(previous)
''',[('错误允许相邻罐都取','max(previous,older+value)','previous+value'),('错误只取一个罐','max(previous,older+value)','max(previous,value)')],11030)

def matrix_encode(a):return f'{len(a)} {len(a[0])}\n'+''.join(seq(row)+'\n' for row in a)
def saddle_oracle(a):
    answers={v for i,row in enumerate(a) for j,v in enumerate(row) if all(v>=w for w in row) and all(v<=a[k][j] for k in range(len(a)))}
    assert len(answers)<=1
    return str(next(iter(answers))) if answers else '-1'
def saddle_edges():
    yield [[10**9]*1000 for _ in range(1000)],'1000000000'
    yield [[(i+j)%2 for j in range(1000)] for i in range(1000)],'-1'
    yield [[1]*1000]+[[0]*999+[1] for _ in range(999)],'1'
SADDLE_CODE='''def solve(raw):
    from io import StringIO
    stream=StringIO(raw);n,m=map(int,stream.readline().split());columns=[10**30]*m;row_limit=10**30
    for _ in range(n):
        largest=0
        for j,value in enumerate(map(int,stream.readline().split())):largest=max(largest,value);columns[j]=min(columns[j],value)
        row_limit=min(row_limit,largest)
    answer=max(columns)
    return str(answer) if answer==row_limit else '-1'
'''
for number in (3,18):
    add(number,'找所在行最大且所在列最小的矩阵元素'+('（同题版）' if number==18 else ''),'矩阵元素非负。找一个既等于所在行最大值、又等于所在列最小值的元素，输出其数值；不存在输出−1。相等的多个最大或最小位置均合法，不要求严格大于或小于。','第一行N M，随后N行每行M个整数。原界1≤N,M≤1000，元素非负但没有数值上界，本站补≤10^9。原输入下一句将M行N列误写反，本站依明确的N行M列维度定义恢复。','逐行处理，记录每列最小值及所有行最大值中的最小值R。令C为列最小值中的最大值；若R=C输出该值，否则−1。仅保存M个列值，不建立百万整数矩阵副本。','对任意行i和列j，列j最小值≤a[i][j]≤行i最大值，因此C≤R。若R=C，取达到R的行与达到C的列，其交点被两端同值夹住，恰为合法元素。反过来若某交点为行最大列最小，C≥该值且R≤该值，配合C≤R得三者相等；所有合法交点值必相同，无需捏造多解位置规则。','时间O(NM)，辅助空间O(M)不含输入原文；逐行解析避免保留一百万数字对象。',[[[1,2],[3,4]],[[1,1],[0,1]],[[2,1],[1,2]]],lambda r:[[r.randint(0,5) for _ in range(m)] for _ in range(n)] if (n:=r.randint(1,5)) and (m:=r.randint(1,5)) else None,saddle_edges,matrix_encode,saddle_oracle,SADDLE_CODE,[('错误取列最小值中的最小值','answer=max(columns)','answer=min(columns)'),('错误无鞍点也返回候选','return str(answer) if answer==row_limit else \'-1\'','return str(answer)')],11000050,timeLimit=10)

def binary_oracle(a):return str(sum(v*2**(len(a)-1-i) for i,v in enumerate(a)))
def binary_edges():
    yield [1]*64,'18446744073709551615'
    yield [1]+[0]*63,'9223372036854775808'
    yield [0]*64,'0'
add(4,'最高位在链表头的二进制值转十进制','链表每个节点存0或1，头节点为最高位。输入为链表从头到尾的顺序序列，允许前导0；输出对应非负十进制精确整数，不需要在程序中额外构造真实链表节点。','第一行N，第二行N个0/1。原界1≤N≤64。最大答案2^64−1=18446744073709551615，不可用有符号64位溢出结果替代，也不限制最高位为0。','从头到尾依次令value=2·value+bit。Python用任意精度整数；其他语言可用无符号64位或大整数。','处理前k个节点后，value等于这k位二进制数。追加下一位把原各位权重乘2，再加新最低位，恰为2·value+bit；由0开始归纳得到全部位的准确值。前导0自然不改变结果。','时间O(N)，固定原界64位下辅助空间O(1)。',[[0,0,1,1,0,1,0],[1,0,0],[0]],lambda r:[r.randint(0,1) for _ in range(r.randint(1,64))],binary_edges,arr,binary_oracle,
'''def solve(raw):
    values=map(int,raw.split());n=next(values);answer=0
    for bit in values:answer=answer*2+bit
    return str(answer)
''',[('错误把链表头当最低位','for bit in values:','for bit in reversed(list(values)):'),('错误截断为有符号64位','return str(answer)','return str(answer if answer<2**63 else answer-2**64)')],140)

def password_encode(x):return json.dumps(x[0],ensure_ascii=False)+'\n'+json.dumps(x[1],ensure_ascii=False)+'\n'
def password_oracle(x):
    a,b=x;subs=lambda s:{''.join(s[i] for i in range(len(s)) if mask>>i&1) for mask in range(1<<len(s))};common=subs(a)&subs(b);return str(len(a)+len(b)-2*max(map(len,common)))
def password_edges():
    yield ('😀'*1000,'😺'*1000),'2000'
    yield ('\x00'*1000,'\x00'*1000),'0'
    yield ('',' \t\n😀'*250),'1000'
    yield ('a\u0085b\u2028c\u2029','a\u0085b\u2028c\u2029'),'0'
PASSWORD_CODE='''def solve(raw):
    import json
    lines=raw.split('\\n');a=json.loads(lines[0]);b=json.loads(lines[1])
    if len(a)<len(b):a,b=b,a
    row=[0]*(len(b)+1)
    for x in a:
        diagonal=0
        for j,y in enumerate(b,1):
            old=row[j]
            if x==y:row[j]=diagonal+1
            else:row[j]=max(row[j],row[j-1])
            diagonal=old
    return str(len(a)+len(b)-2*row[-1])
'''
for number in (5,13):
    add(number,'仅插入删除字符的最少密码更新次数'+('（完整文本版）' if number==13 else ''),'将当前密码变为目标密码，每次只能插入一个字符或删除一个字符，不能把替换计为一次。字符顺序不可重排，所有字符按Unicode码点计数，保留空白、NUL、表情与大小写差异。','两行各为一个JSON字符串，依次表示当前/目标密码，例如空串写""，NUL写\\u0000，换行字符写\\n；不是用空白切分字符串。原文无长度、字符域或非空界，本站补每串0..1000个Unicode标量字符；源C++ getline也支持空格。','滚动数组求最长公共子序列长度L，返回len(a)+len(b)−2L。用较短字符串作DP列以节省空间。','未被删除的原字符必须按原序出现在目标串，因此它们构成共同子序列，最多保留L个，至少删除len(a)−L并插入len(b)−L。保留某个最长公共子序列、删除其余原字符，再在间隙插入目标其余字符可达到该下界。LCS前缀DP对相同末字符从对角加1，否则在跳过任一末字符中取最大；滚动保存不改变依赖。','时间O(nm)，辅助空间O(min(n,m))，不按UTF-8字节或UTF-16代理单元计字符。',[('password','pss$w#rd'),('a','A'),('','\x00 😀')],lambda r:(''.join(r.choices('abAB \x00😀\t\n',k=r.randint(0,7))),''.join(r.choices('abAB \x00😀\t\n',k=r.randint(0,7)))),password_edges,password_encode,password_oracle,PASSWORD_CODE,[('错误替换只计一次','len(a)+len(b)-2*row[-1]','max(len(a),len(b))-row[-1]'),('错误忽略大小写','if x==y:','if x.lower()==y.lower():')],24010,timeLimit=8)

def birthdays_oracle(a):return str(sum(len(list(group))%2 for key,group in groupby(sorted(a))))
def birthdays_edges():
    yield range(-100000,100000),'200000'
    yield [10**9]*200000,'0'
    yield [-10**9]*199999+[10**9],'2'
add(6,'生日次数为奇数的不同日期数量','给出每次生日庆祝的整数日期标识，统计出现次数为奇数的不同标识数量。求的是数量，不是某个出现奇数次的日期值；可能有多个奇数次数日期。','第一行N，第二行N个整数。原文无数量或日期数值界，本站0≤N≤200000，标识−10^9..10^9，作为抽象日期标签，不凭生日故事额外限制到1..31。','用集合保存当前出现奇数次的标识，遇到标识时若在集合就删除，否则加入；最后返回集合大小。','每读到一次同标识，其次数奇偶性恰翻转，集合的存在性同步翻转。因此处理任意前缀后集合恰包含该前缀所有奇数频次标识，最终大小就是题目所求。','期望时间O(N)，空间O(不同标识数)。',[[4,8,2,8,9],[3,3,3,7,7,7,7,7],[]],lambda r:[r.randint(-5,8) for _ in range(r.randint(0,20))],birthdays_edges,arr,birthdays_oracle,
'''def solve(raw):
    values=map(int,raw.split());n=next(values);odd=set()
    for value in values:
        if value in odd:odd.remove(value)
        else:odd.add(value)
    return str(len(odd))
''',[('错误输出所有不同标识数','if value in odd:odd.remove(value)','if value in odd:pass'),('错误只关心奇数类数的奇偶','return str(len(odd))','return str(len(odd)%2)')],2400050)

def prime_oracle(a):return '\n'.join('Prime' if v>=2 and all(v%d for d in range(2,v)) else 'Composite' for v in a)
def prime_edges():
    yield [2147483647]*2000,'\n'.join(['Prime']*2000)
    yield [-2147483648,0,1,46337**2]*500,'\n'.join(['Composite']*2000)
    values=list(range(2147481648,2147483648));yield values,'\n'.join('Prime' if all(v%d for d in range(2,isqrt(v)+1)) else 'Composite' for v in values)
add(7,'按题目标签区分质数与非质数','对每个整数输出Prime或Composite。至少2且只有1与自身两个正因数的数为质数，输出Prime；其他任何整数按原题non-prime的输出标签统一为Composite。因此0、1和负整数也输出Composite，并非声称它们数学上都是合数。','第一行N，第二行N个整数。原文无数值界，本站0≤N≤2000，−2^31≤a[i]≤2^31−1。空列表输出空文本。','筛出不超过46340的全部素数，对正数用素因子试除直到p²>value；小于2直接非质数，缓存重复值的判断。','任意合数都有不超过其平方根的素因子，否则最小两个非平凡因子乘积会超过自身。32位正整数平方根≤46340，筛表包含所有必需因子；有整除者为合数，没有则质数。小于2按质数定义排除。缓存仅复用相同整数的确定结果。','筛O(V log log V)，每个不同正数至多4792次试除，V=46340；空间O(V+N)。',[[541,37,113,5,10],[-1,0,1,2,4],[]],lambda r:[r.randint(-20,600) for _ in range(r.randint(0,12))],prime_edges,arr,prime_oracle,
'''def solve(raw):
    from math import isqrt
    values=list(map(int,raw.split()))[1:];limit=46340;sieve=bytearray(b'\\x01')*(limit+1);sieve[0:2]=b'\\x00\\x00'
    for p in range(2,isqrt(limit)+1):
        if sieve[p]:sieve[p*p:limit+1:p]=b'\\x00'*((limit-p*p)//p+1)
    primes=[p for p in range(2,limit+1) if sieve[p]];cache={};out=[]
    for value in values:
        if value not in cache:
            ok=value>=2
            if ok:
                for p in primes:
                    if p*p>value:break
                    if value%p==0:ok=False;break
            cache[value]='Prime' if ok else 'Composite'
        out.append(cache[value])
    return '\\n'.join(out)
''',[('错误把1当质数','ok=value>=2','ok=value>=1'),('错误不检查平方根因子','if p*p>value:break','if p*p>=value:break')],24030,output='每项一行Prime或Composite；空列表输出空文本。',timeLimit=8)

def digits_encode(x):return arr(x[0])+arr(x[1])
def digits_oracle(x):
    value=sum(v*10**i for a in x for i,v in enumerate(a))
    return seq(map(int,str(value)[::-1]))
def digits_edges():
    yield ([9]*100000,[1]),seq([0]*100000+[1])
    yield ([0]*100000,[0]*100000),'0'
    yield ([9]*100000,[9]*100000),seq([8]+[9]*99999+[1])
add(8,'逆序数字链表相加','两个非负整数以个位在前的数字列表表示，求和并同样逆序输出。允许输入高位有0；本站统一去除结果多余高位0，零输出单个0。','依次输入长度n、n个数字、长度m、m个数字。原文未给数值界，本站补1≤n,m≤100000，每项0..9。','逐位相加并保存进位，最后删除多余高位0。','处理第i位之前，低于i位已等于真实和的相应位，carry是未写高位部分的进位。除10取商余分别得到下一进位与本位，保持不变量。遍历完两列表并写最终进位即完整和，删除高位0不改变数值。','时间O(n+m)，空间O(n+m)，不把长列表转成大整数。',[([2,4,6],[8,0,9]),([9],[1]),([0,0],[0])],lambda r:([r.randrange(10) for _ in range(r.randint(1,8))],[r.randrange(10) for _ in range(r.randint(1,8))]),digits_edges,digits_encode,digits_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];m=d[n+1];b=d[n+2:];out=[];carry=0
    for i in range(max(n,m)):
        total=carry+(a[i] if i<n else 0)+(b[i] if i<m else 0);out.append(total%10);carry=total//10
    if carry:out.append(carry)
    while len(out)>1 and out[-1]==0:out.pop()
    return ' '.join(map(str,out))
''',[('漏掉最终进位','if carry:out.append(carry)','if False:out.append(carry)'),('不规范化高位0','while len(out)>1 and out[-1]==0:out.pop()','while False:out.pop()')],400040,output='输出规范化逆序数位，以空格分隔，不输出长度。零输出单个0。')

def coins_encode(x):return arr(x[0])+'\n'.join(seq(e) for e in x[1])+'\n'
def coins_oracle(x):
    coins,edges=x;n=len(coins);adj=[[] for _ in coins]
    for a,b in edges:adj[a].append(b);adj[b].append(a)
    dist=[]
    for start in range(n):
        d=[n]*n;d[start]=0;q=deque([start])
        while q:
            u=q.popleft()
            for v in adj[u]:
                if d[v]==n:d[v]=d[u]+1;q.append(v)
        dist.append(d)
    best=2*n
    for mask in range(1,1<<n):
        nodes=[v for v in range(n) if mask>>v&1]
        if sum((mask>>a&1) and (mask>>b&1) for a,b in edges)!=len(nodes)-1:continue
        if all(not coins[v] or any(dist[u][v]<=2 for u in nodes) for v in range(n)):best=min(best,2*(len(nodes)-1))
    return str(best)
def coins_rand(r):
    n=r.randint(1,8);return [r.randrange(2) for _ in range(n)],[(i,r.randrange(i)) for i in range(1,n)]
def coins_edges():
    n=200000;chain=[(i-1,i) for i in range(1,n)]
    yield ([1]+[0]*(n-2)+[1],chain),str(2*(n-5))
    yield ([1]*n,chain),str(2*(n-5))
    yield ([0]*n,chain),'0'
    yield ([1]*n,[(0,i) for i in range(1,n)]),'0'
add(11,'树上距离二收集金币的最短闭合路线','无向树每点有0或1枚金币。可任选起点，每到一点能收集图距离不超过2的金币；沿边移动，最终必须回到起点。求收集全部金币所需最少经过的边数。','第一行n，随后n个0/1，随后n−1条0基无向边，保证为树。原文未给数值界，本站补1≤n≤200000。','先反复删除无金币叶子，再同步删除两层叶子，剩余边数乘2。','无金币叶子不在连接所有金币的最小子树中，无须进入。该子树的叶子均带金币，距离2收集允许省略外侧两层；第三层及以内每条边两侧都有相距该边至少两层的金币，任何覆盖路线必须跨越该边。剩余连通树每边往返一次能覆盖全部金币，且闭合路线每条必需边至少走两次，所以上下界一致；剩余为空时停在一个合适中心即可。','时间O(n)，空间O(n)。',[([1,0,0,0,0,1],[(i,i+1) for i in range(5)]),([1,1,1,1],[(0,1),(0,2),(0,3)]),([1],[])],coins_rand,coins_edges,coins_encode,coins_oracle,
'''from collections import deque
def solve(raw):
    d=iter(map(int,raw.split()));n=next(d);coins=[next(d) for _ in range(n)];adj=[[] for _ in range(n)];degree=[0]*n;alive=[True]*n;remaining=n-1
    for a,b in zip(d,d):adj[a].append(b);adj[b].append(a);degree[a]+=1;degree[b]+=1
    q=deque(i for i in range(n) if degree[i]<=1 and not coins[i])
    while q:
        u=q.popleft()
        if not alive[u]:continue
        alive[u]=False
        for v in adj[u]:
            if alive[v]:
                remaining-=1;degree[v]-=1
                if degree[v]<=1 and not coins[v]:q.append(v)
    layer=[i for i in range(n) if alive[i] and degree[i]<=1]
    for _ in range(2):
        following=[]
        for u in layer:
            alive[u]=False
            for v in adj[u]:
                if alive[v]:
                    remaining-=1;degree[v]-=1
                    if degree[v]==1:following.append(v)
        layer=following
    return str(2*max(0,remaining))
''',[('只去掉一层','range(2):','range(1):'),('闭合路线漏掉返程','2*max(0,remaining)','max(0,remaining)')],3000050,timeLimit=10)

def compact_oracle(a):
    unseen=set(a);parts=[]
    while unseen:
        stack=[min(unseen)];component=[]
        while stack:
            v=stack.pop()
            if v not in unseen:continue
            unseen.remove(v);component.append(v);stack.extend([v-1,v+1])
        lo=min(component);hi=max(component);parts.append(str(lo) if lo==hi else f'{lo} to {hi}')
    return '\n'.join(parts)
def compact_edges():
    yield list(range(-10**9,-10**9+100000)),'-1000000000 to -999900001'
    yield list(range(0,200000,2)),'\n'.join(map(str,range(0,200000,2)))
    yield [-10**9]+list(range(99999)),'-1000000000\n0 to 99998'
add(12,'有序列表的连续区间压缩','输入严格递增整数列表，把每个最大连续整数段输出为a to b，单元素段只输出该元素。段按原顺序排列。','第一行n，随后n个严格递增整数。原文未给数值界，本站补0≤n≤100000，−10^9≤a[i]≤10^9。空列表输出空文本。','保存当前段首尾，下一值等于末尾+1时延伸，否则结束当前段并新建段。','严格递增保证相邻差为1恰表示处于同一连续段，差大于1则任何段都不能跨越缺失整数。每次在唯一合法分割处结束，得到全部最大连续段且没有重叠遗漏。','时间O(n)，空间O(n)计输出。',[[1,2,3,6,8,9,10],[-2,-1,0,2],[]],lambda r:sorted(r.sample(range(-20,21),r.randint(0,15))),compact_edges,arr,compact_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:]
    if not a:return ''
    start=end=a[0];out=[]
    for value in a[1:]:
        if value==end+1:end=value
        else:
            out.append(str(start) if start==end else f'{start} to {end}');start=end=value
    out.append(str(start) if start==end else f'{start} to {end}')
    return '\\n'.join(out)
''',[('错误跨越缺失整数','value==end+1','value<=end+2'),('只输出区间首项',"str(start) if start==end else f'{start} to {end}'","str(start)")],1200030,output='每个最大连续段一行，单项写a，至少两项写a to b。空列表输出空文本。')

def sumdigits_oracle(x):
    answer=sum(sum(map(int,str(v)))==x[1] for v in range(1,x[0]+1));return str(answer or -1)
def sumdigits_edges():
    yield (10**18,1),'19'
    yield (10**18,162),'1'
    yield (10**18,81),str(sum((-1)**j*comb(18,j)*comb(81-10*j+17,17) for j in range(9)))
    yield (1,162),'-1'
add(14,'不超过上界的指定数位和计数','统计1..X中十进制数位之和恰为Y的整数个数。原文对没有符合项时要求输出−1，不能输出0。','输入X Y。原文没有数值界，本站补1≤X≤10^18，1≤Y≤162；只统计正整数。','从最高位向最低位数位DP，状态记录当前数位和及是否贴住X前缀。','每个不超过X的整数都有唯一补前导0表示。贴住标记限制当前位不超过上界对应位，选择较小位后后缀任意。每次转移恰枚举一个合法下一位，按前缀长度归纳无重无漏。最终和为Y的状态即所求；Y≥1排除全零表示。','时间O(位数·Y·10)，空间O(Y)，整数计数无需取模。',[(20,5),(1,2),(10,1)],lambda r:(r.randint(1,2000),r.randint(1,30)),sumdigits_edges,lambda x:seq(x)+'\n',sumdigits_oracle,
'''def solve(raw):
    x,target=map(int,raw.split());states={(0,True):1}
    for char in str(x):
        bound=int(char);following={}
        for (total,tight),count in states.items():
            for digit in range((bound if tight else 9)+1):
                if total+digit<=target:
                    key=total+digit,tight and digit==bound;following[key]=following.get(key,0)+count
        states=following
    answer=sum(count for (total,tight),count in states.items() if total==target)
    return str(answer or -1)
''',[('无解错误返回0','answer or -1','answer'),('漏掉上界本身','x,target=map(int,raw.split());','x,target=map(int,raw.split());x-=1;')],30)

BLOCKED={9:'双来源仍缺并列众数规则，不限定唯一众数来规避。',10:'正文截断，严格性、字符域及逆序位置定义缺失。',15:'规则缺失且明确允许负数，不能按catalog删掉负数或猜测buffer语义。',16:'缺完整展开语法，嵌套、零负计数、转义规则未定义。',17:'在线发送者自行写入与总选分量最小活跃ID两条规则冲突。'}
OCR='OA LIST/Cisco_OA/'
def pictures(*nums):return [OCR+f'{n:03d}_image.txt' for n in nums]
def fast(name):return 'fastprep/Cisco/cisco-'+name+'.md'
PASSWORD=[OCR+'006_QQ_1756170878476.txt']+pictures(10)
EVIDENCE={1:pictures(1,2)+[fast('fizz-buzz-problem')],2:pictures(3)+[fast('maximum-chocolates-from-jars')],3:pictures(4)+[fast('find-elements-largest-row-smallest-column')],4:[OCR+'005_QQ_1756170862711.txt'],5:PASSWORD+[fast('convert-password')],6:[OCR+'007_QQ_1756170905306.txt']+pictures(11),7:pictures(8,9)+[fast('find-out-prime-or-composite')],8:[fast('add-numbers')],9:[fast('calculate-mean-and-mode'),fast('find-mean-and-mode')],10:[fast('check-alphabetical-order')],11:[fast('collect-coins')],12:[fast('compact-the-list')],13:[fast('convert-password')]+PASSWORD,14:[fast('count-numbers-with-digit-sum'),fast('count-numbers-with-sum-of-digits')],15:[fast('create-new-version')],16:[fast('expand-given-string')],17:[fast('find-critical-nodes')],18:[fast('find-elements-largest-row-smallest-column')]+pictures(4)}
def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(a,b):
    if a==b:return True
    # Avoid splitting the largest FizzBuzz answer into millions of objects.
    import re
    from itertools import zip_longest
    return all(x==y for x,y in zip_longest((m.group() for m in re.finditer(r'\S+',a)),(m.group() for m in re.finditer(r'\S+',b))))
SMALL_RUNNER="""import io,json,sys,contextlib
code,inputs=json.load(sys.stdin);out=[]
for raw in inputs:
    sys.stdin=io.StringIO(raw);buf=io.StringIO()
    with contextlib.redirect_stdout(buf):exec(compile(code,'<authored>','exec'),{'__name__':'__main__'})
    out.append(buf.getvalue())
print(json.dumps(out,ensure_ascii=False))
"""
def small_check():
    for s in sorted(SPECS,key=lambda s:s['n']):
        rng=random.Random(SEED+s['n']);values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        cases=[(s['encode'](v),s['oracle'](v)+'\n') for v in values];code=code_for(s)
        if s['n'] in (5,13):
            for ch in ('\u0085','\u2028','\u2029'):
                raw=password_encode(('a'+ch+'b','a'+ch+'b'))
                cases.extend([(raw,'0\n'),(raw.replace('\n','\r\n'),'0\n')])
        def run(program):
            p=subprocess.run([sys.executable,'-I','-c',SMALL_RUNNER],input=json.dumps([program,[raw for raw,_ in cases]],ensure_ascii=False),text=True,capture_output=True,timeout=120)
            assert p.returncode==0,(s['n'],p.stderr[-2000:]);return json.loads(p.stdout)
        actual=run(code)
        for i,(a,(_,expected)) in enumerate(zip(actual,cases)):assert equal(a,expected),(s['n'],i,a,expected)
        for name,old,new in s['mutants']:
            assert old in code,(s['n'],name)
            assert any(not equal(a,expected) for a,(_,expected) in zip(run(code.replace(old,new)),cases)),(s['n'],name)
        print(s['n'],len(cases),'independent small/regression cases; 2 normal-exit WA; real stdin/stdout passed',flush=True)
def execute(path,inputs):
    begin=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(inputs)
    return out,time.monotonic()-begin
def main():
    if '--small' in sys.argv:small_check();return
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in sorted(SPECS,key=lambda s:s['n']):
        number=s['n'];ident=f'oa-cisco-{number}'
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(SEED+number)
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=a+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:31];assert len(tests)>=31
        for c in oracles+tests:
            assert len(c['input'].encode())<=s['bound']<=32*1024*1024,(ident,len(c['input'].encode()),s['bound'])
            assert len(c['expectedOutput'].encode())<=s.get('outputLimit',4096)*1024
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert equal(a,c['expectedOutput']),(ident,i,a[:200],c['expectedOutput'][:200])
        del actual
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not equal(a,c['expectedOutput'])];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected));del outputs
        explanation='三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') or '空文本' for c in oracles[:3])+'。独立枚举或直接模拟已核对。'
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Cisco'],description=s['desc']+'\n\n缺失范围的本站补充与来源笔误恢复见输入协议。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker='tokens',languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        assert len(normalized.encode())<=128*1024*1024,(ident,'package exceeds128MiB')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del cases,tests,boundary,oracles,normalized,p,doc,c;gc.collect()
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,paths in EVIDENCE.items():
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=f'oa-cisco-{number}';reason=BLOCKED[number] if number in BLOCKED else next(s['desc']+' '+s['limits'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
