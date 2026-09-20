"""Original Snowflake41–47 authoring; source snapshots are statements only, never executed."""
from pathlib import Path
from collections import Counter,deque
from itertools import combinations,product
from functools import lru_cache
import hashlib,json,random,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='snowflake-remaining-a';SPECS=[]
def add(i,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**kw):
    SPECS.append(dict(id=f'oa-snowflake-{i}',title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**kw))
def vec(a):return str(len(a))+'\n'+' '.join(map(str,a))
def array(a):return vec(a)+'\n'
def ceiling_oracle(v):
    seed,n,k,b,m,area=v;s=[seed]
    for _ in range(1,n):s.append((k*s[-1]+b)%m+1+s[-1])
    return str(sum(x*y<=area for x in s for y in s))
def divisor_count(limit):
    # Independent exact grouped divisor summatory function for sequence 1..limit.
    answer=0;left=1
    while left<=limit:
        q=limit//left;right=limit//q;answer+=(right-left+1)*q;left=right+1
    return answer
add(41,'生成边长后统计免费涂顶方案','生成n个边长：s[0]=seed，s[i]=s[i−1]+1+((k*s[i−1]+b) mod m)。长和宽均从这些边长中选，面积≤area可免费涂顶。统计有序的长宽组合，交换长宽是另一方案，正方形也计一次。','一行seed n k b m area。1≤n≤6000000；1≤seed,k,b,m≤10⁹，1≤area≤10¹⁸；保证每个生成的s[i]也在1..10⁹。n原上界600万不缩小；使用精确整数比较。','边长每次至少增加1，因此已严格递增。用紧凑32位无符号数组保存，右指针从尾向左移动；每个左边长累计所有符合面积的右边长数。','固定长s[i]时合法宽形成有序数组前缀；长递增后合法宽上界不会增大，故右指针只需左移。每个长下所有宽恰计一次，因此计的是有序组合，不会漏正方形。边长≤10⁹使32位存储安全，乘积和计数用64位或任意精度。','时间O(n)，边长额外空间4n字节；Python使用array而非600万个整数对象。',[(2,3,3,3,2,15),(1,1,1,1,1,1),(2,2,1,1,1,4)],lambda r:(r.randint(1,15),r.randint(1,14),r.randint(1,20),r.randint(1,20),r.randint(1,20),r.randint(1,5000)),lambda:[((1,6000000,1,1,1,10**18),str(6000000**2)),((1,6000000,1,1,1,1),'1'),((1,6000000,1,1,1,6000000),str(divisor_count(6000000))),((10**9,1,10**9,10**9,10**9,10**18),'1')],lambda v:' '.join(map(str,v))+'\n',ceiling_oracle,'''from array import array
def solve(d):
    seed,n,k,b,m,area=map(int,d);s=array('I',[seed]);value=seed
    for _ in range(1,n):value+=1+(k*value+b)%m;s.append(value)
    right=n-1;answer=0
    for left in range(n):
        while right>=0 and s[left]*s[right]>area:right-=1
        if right<0:break
        answer+=right+1
    return str(answer)
''',[('把有序组合误除二','return str(answer)','return str(answer//2)'),('面积等号错误排除','s[left]*s[right]>area','s[left]*s[right]>=area')],85,timeLimit=10)
def logs_encode(v):a,t=v;return f'{len(a)} {t}\n'+''.join(f'{s} {r} {x}\n' for s,r,x in a)
def logs_oracle(v):
    a,t=v;users={x for s,r,m in a for x in (s,r)};out=[]
    for u in sorted(users):
        if sum(u==s or u==r for s,r,m in a)>=t:out.append(u)
    return vec(out)
def logs_random(r):
    a=[(r.randint(1,15),r.randint(1,15),r.randint(1,999999999)) for _ in range(r.randint(1,20))];counts=Counter()
    for s,t,m in a:
        for x in {s,t}:counts[x]+=1
    return a,r.randint(1,max(counts.values()))
add(42,'交易日志中的可疑用户','每条日志sender recipient amount。用户只要作为发送者或接收者参与该日志，就计一条；自己转给自己仍只算一条。输出参与至少threshold条日志的用户ID，按数值升序，不按字符串字典序。金额不影响计数。','首行n threshold，随后n行sender recipient amount。1≤n≤100000，1≤threshold≤n；各字段为无前导零的1..9位十进制正整数。原文保证输出至少一个用户。','对每条日志先计发送者；若接收者不同才再计接收者。筛出达到阈值者后以整数排序。','同一日志参与用户集合至多两人，条件去重恰使每人每条日志贡献1。频次累计就是参与日志数量，筛选≥threshold和数值排序准确实现要求。','时间O(n+U log U)，空间O(U)，U≤2n。',[([(1,2,100),(1,1,5),(10,1,9)],2),([(2,10,1)],1),([(999999999,999999999,999999999)],1)],logs_random,lambda:[(([(100000000+2*i,100000001+2*i,999999999) for i in range(100000)],1),vec(list(range(100000000,100200000)))),(([(999999999,999999999,999999999)]*100000,100000),vec([999999999])),(([(1,2,1)]*100000,100000),vec([1,2])),(([(2,10,1),(10,10,1)],2),vec([10]))],logs_encode,logs_oracle,'''def solve(d):
    n,threshold=map(int,d[:2]);counts={}
    for i in range(n):
        sender,recipient,amount=map(int,d[2+3*i:5+3*i]);counts[sender]=counts.get(sender,0)+1
        if recipient!=sender:counts[recipient]=counts.get(recipient,0)+1
    out=sorted(u for u,count in counts.items() if count>=threshold)
    return str(len(out))+'\\n'+' '.join(map(str,out))
''',[('自转账重复计数','if recipient!=sender:','if True:'),('ID按字符串排序','out=sorted(u for u,count in counts.items() if count>=threshold)','out=sorted((u for u,count in counts.items() if count>=threshold),key=str)')],3000030,output='先输出用户数量，再输出按数值升序的用户ID。',outputLimit=4096)
def radio_encode(v):f,e=v;return str(len(f))+'\n'+' '.join(map(str,f))+'\n'+''.join(f'{a+1} {b+1}\n' for a,b in e)
def radio_oracle(v):
    f,edges=v;n=len(f);dist=[[n+1]*n for _ in range(n)]
    for i in range(n):dist[i][i]=0
    for a,b in edges:
        if abs(f[a]-f[b])<=1:dist[a][b]=dist[b][a]=1
    for k in range(n):
        for a in range(n):
            for b in range(n):dist[a][b]=min(dist[a][b],dist[a][k]+dist[k][b])
    return str(max(v for row in dist for v in row if v<n+1))
def radio_random(r):
    n=r.randint(1,12);return [r.randint(1,3) for _ in range(n)],[(r.randrange(i),i) for i in range(1,n)]
add(43,'兼容无线频率森林的最长距离','设备连接形成树，每个频率为1、2或3。相邻频率绝对差≤1的边可传信，沿路每条边都必须兼容。求任何可互传设备之间的最长边数；没有可用边返回0，同频相邻也合法。','首行n，第二行n个频率，随后n−1行1基无向边。原始raw未给节点数上限（catalog的10万为整理补充）；本站明确1≤n≤100000，输入为合法树，频率1、2或3。','删除频差2的边得到森林；对每个未访问连通块先遍历到最远端点，再从该端点遍历求块直径，取最大值。','合法路径恰好是删边后森林中的路径。树上从任意点的最远点可作为某条直径端点，从它出发的最大距离是块直径。每个块独立处理，最大块直径即全局答案；单点块贡献0。','时间O(n)，空间O(n)，迭代遍历不会因十万点链递归溢出。',[([1,3,2,1],[(0,1),(1,2),(2,3)]),([2],[]),([1,1,1],[(0,1),(1,2)])],radio_random,lambda:[(([2]*100000,[(i,i+1) for i in range(99999)]),'99999'),(([1,3]*50000,[(i,i+1) for i in range(99999)]),'0'),(([2]*100000,[(0,i) for i in range(1,100000)]),'2'),(([1]*50000+[3]*50000,[(i,i+1) for i in range(99999)]),'49999')],radio_encode,radio_oracle,'''from collections import deque
def solve(d):
    n=int(d[0]);f=list(map(int,d[1:1+n]));nums=list(map(int,d[1+n:]));adj=[[] for _ in range(n)]
    for i in range(0,len(nums),2):
        a,b=nums[i]-1,nums[i+1]-1
        if abs(f[a]-f[b])<=1:adj[a].append(b);adj[b].append(a)
    seen=bytearray(n)
    def farthest(start):
        q=deque([(start,-1,0)]);best=(start,0)
        while q:
            u,parent,length=q.popleft();seen[u]=1
            if length>best[1]:best=(u,length)
            for v in adj[u]:
                if v!=parent:q.append((v,u,length+1))
        return best
    answer=0
    for i in range(n):
        if not seen[i]:end,_=farthest(i);_,length=farthest(end);answer=max(answer,length)
    return str(answer)
''',[('同频设备不能传信','abs(f[a]-f[b])<=1','abs(f[a]-f[b])==1'),('忽略频率不兼容','if abs(f[a]-f[b])<=1:','if True:')],1600030)
def stones_oracle(v):
    a,k=v
    @lru_cache(None)
    def search(state,steps):
        if not steps or max(state)==1:return sum(state)
        return min(search(tuple(sorted(state[:i]+((x+1)//2,)+state[i+1:])),steps-1) for i,x in enumerate(state))
    return str(search(tuple(a),k))
add(44,'恰好k次移除半堆石子的最小剩余量','每次任选一堆，移走floor(石子数/2)，剩余ceil(石子数/2)。可以重复选同一堆，恰好操作k次后使总剩余石子最少。','首行n k，第二行n个石子数。原题1≤n≤100000，1≤石子数≤10000，1≤k≤100000。','用负数最大堆，每次取最大堆减去向下取整的一半，放回向上取整的一半。最大值为1时后续操作无变化，可结束。','各石堆的连续操作收益单调不增，每次选择当前最大收益属于全局最优的可行前缀选择。最大石堆产生最大floor(x/2)收益；交换论证可把任意最优方案的首步换成该堆而不变差。全部为1时额外恰好操作只移除0颗，因此提前计算最终和合法。','时间O(n+k log n)，空间O(n)。',[([5,4,9],2),([4,3,6,7],3),([1,1],100000)],lambda r:([r.randint(1,20) for _ in range(r.randint(1,5))],r.randint(1,5)),lambda:[(([10000]*100000,100000),'500000000'),(([1]*100000,100000),'100000'),(([10000],100000),'1'),(([9999]*100000,1),'999895001')],lambda v:f'{len(v[0])} {v[1]}\n'+' '.join(map(str,v[0]))+'\n',stones_oracle,'''import heapq
def solve(d):
    n,k=map(int,d[:2]);heap=[-int(v) for v in d[2:]];heapq.heapify(heap)
    for _ in range(k):
        if heap[0]==-1:break
        value=-heap[0];heapq.heapreplace(heap,-((value+1)//2))
    return str(-sum(heap))
''',[('剩余石子向下取整','-((value+1)//2)','-(value//2)'),('只移除一次','range(k)','range(1)')],700030)
def stock_encode(v):a,b,saving=v;return f'{len(a)} {saving}\n'+' '.join(map(str,a))+'\n'+' '.join(map(str,b))+'\n'
def stock_oracle(v):
    a,b,saving=v;best=0
    for mask in range(1<<len(a)):
        if sum(x for i,x in enumerate(a) if mask>>i&1)<=saving:best=max(best,sum(y-x for i,(x,y) in enumerate(zip(a,b)) if mask>>i&1))
    return str(best)
def stock_random(r):
    n=r.randint(1,11);return [r.randint(0,20) for _ in range(n)],[r.randint(0,30) for _ in range(n)],r.randint(0,50)
add(45,'每家公司至多一股的最大预测利润','用现有资金选择股票，每家公司至多买一股，总购买价不超过saving。预测未来出售所得减购买价为利润，允许一股都不买。求最大利润，不是最大销售总额。','首行n saving，第二行currentValue，第三行futureValue。原文无数值约束，本站补充1≤n≤1000、0≤saving≤10000、0≤每项价格≤10⁹，允许现价或未来价为0。','0/1背包：费用为现价，收益为未来价减现价。容量倒序遍历确保股票只买一次，非正收益可跳过。','处理前i支股票时dp[j]为预算≤j可得最大利润，新股票要么不买继承，要么买一次接前层dp[j−cost]+gain。倒序使所引用的小容量仍为前层；费用0时每个容量只更新一次，也恰好买一次。归纳保证最优，初始0表达不投资。','时间O(n×saving)，空间O(saving)。',[([175,133,109,210,97],[200,125,128,228,133],250),([1],[3],4),([0,1],[5,0],0)],stock_random,lambda:[(([1]*1000,[10**9]*1000,10000),'999999999000'),(([0]*1000,[10**9]*1000,0),'1000000000000'),(([10**9]*1000,[10**9]*1000,10000),'0'),(([10000]*1000,[10001]*1000,10000),'1')],stock_encode,stock_oracle,'''def solve(d):
    n,saving=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));dp=[0]*(saving+1)
    for cost,future in zip(a,b):
        gain=future-cost
        if gain<=0 or cost>saving:continue
        for money in range(saving,cost-1,-1):dp[money]=max(dp[money],dp[money-cost]+gain)
    return str(dp[saving])
''',[('同一股票重复购买','range(saving,cost-1,-1)','range(cost,saving+1)'),('把售价当利润','gain=future-cost','gain=future')],2300040,timeLimit=8)
def rotation_encode(v):a,r=v;return f'{len(a)} {len(r)}\n'+' '.join(map(str,a))+'\n'+' '.join(map(str,r))+'\n'
def rotation_oracle(v):
    a,rotations=v;out=[]
    for count in rotations:
        b=list(a)
        for _ in range(count%len(a)):b.append(b.pop(0))
        out.append(b.index(max(b)))
    return vec(out)
def rotation_random(r):
    a=r.sample(range(1,50),r.randint(1,15));return a,[r.randint(0,10**9) for _ in range(r.randint(1,15))]
add(46,'独立左旋后的最大元素下标','数组为互异正整数。每个查询对原数组独立向左循环旋转r次，返回最大元素的新0基下标；查询不累计旋转。','首行n m，第二行n个互异数组值，第三行m个旋转次数。1≤n,m≤500000，1≤数组值≤10⁹，0≤旋转次数≤10⁹。','先找原最大元素下标p；每个查询直接输出(p−r) mod n，规范化为0..n−1。','左移一次使每个位置减少1并对n取模，连续r次减r。最大值身份不随旋转改变，且互异保证唯一，因此跟踪其下标即可。每次从同一个原下标计算确保查询独立。','时间O(n+m)，空间O(n+m)含输入输出。',[([1,2,3],[1,2,3]),([9,1,2],[0,1,4]),([7],[0,10**9])],rotation_random,lambda:[(([10**9-i for i in range(500000)],[10**9]*500000),vec([0]*500000)),((list(range(1,500001)),list(range(500000))),vec(list(range(499999,-1,-1)))),(([10**9],[10**9]*500000),vec([0]*500000)),((list(range(1,500001)),[499999]),vec([0]))],rotation_encode,rotation_oracle,'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));p=max(range(n),key=a.__getitem__);out=[]
    for r in map(int,d[2+n:]):out.append((p-r)%n)
    return str(m)+'\\n'+' '.join(map(str,out))
''',[('左旋误作右旋','(p-r)%n','(p+r)%n'),('错误累计旋转','for r in map(int,d[2+n:]):out.append((p-r)%n)','for r in map(int,d[2+n:]):p=(p-r)%n;out.append(p)')],10500030,output='先输出m，再输出m个0基最大元素下标。',outputLimit=4096,timeLimit=8)
def bits_oracle(v):
    n,a=v;result=set()
    for x in a:
        zeros=[i for i in range(n) if not x>>i&1]
        for choice in product((0,1),repeat=len(zeros)):
            y=x
            for i,on in zip(zeros,choice):
                if on:y|=1<<i
            result.add(y)
    return str(len(result))
add(47,'零位任意翻一后的超位串并集大小','将给定整数表示为恰好n位（允许前导零）。每个原串可将任意零位翻成1，原本的1不可改0，也允许不翻。求所有原串产生结果的集合并集大小，重复结果仅计一次，不取模。','首行n k，第二行k个整数。原文没有数值界，本站补充1≤n≤20，1≤k≤100000，0≤整数<2ⁿ；输入可重复。','布尔数组标记原始掩码。逐位进行SOS子集传播：高半区状态吸收去掉当前位后的低半区状态。最终每个掩码标记是否含至少一个原始子掩码，累加布尔值。','一个结果y可由x生成当且仅当x的每个1位也在y中，即x是y的子掩码。处理前j位后，标记表达只允许在这j位补1能否从某个输入到达；下一位把无该位来源传播到有该位状态，归纳覆盖全部允许补1位置。布尔并合去重，统计正是并集大小。','时间O(n×2ⁿ+k)，空间O(2ⁿ)字节。',[(3,[1,2]),(2,[3,3]),(4,[0,15])],lambda r:(n,[r.randrange(1<<n) for _ in range(r.randint(1,12))]) if (n:=r.randint(1,8)) else None,lambda:[((20,list(range(1,100001))),str((1<<20)-8)),((20,[(1<<20)-1]*100000),'1'),((20,[0]*100000),str(1<<20)),((1,[0,1]),'2')],lambda v:f'{v[0]} {len(v[1])}\n'+' '.join(map(str,v[1]))+'\n',bits_oracle,'''def solve(d):
    n,k=map(int,d[:2]);size=1<<n;reachable=bytearray(size)
    for x in map(int,d[2:]):reachable[x]=1
    step=1
    for _ in range(n):
        for base in range(0,size,2*step):
            for low in range(base,base+step):
                if reachable[low]:reachable[low+step]=1
        step*=2
    return str(sum(reachable))
''',[('只允许增加最低位','for _ in range(n):','for _ in range(1):'),('未去重重复原串','return str(sum(reachable))','return str(sum(reachable)+k-len(set(d[2:])))')],800030,timeLimit=8)
# Simultaneously exercise the full n and large recurrence multiplication.
# k=m=10^9,b=1 gives successive odd lengths; every product is below 10^18.
_ceiling_edges=SPECS[0]['edges']
SPECS[0]['edges']=lambda:_ceiling_edges()+[((1,6000000,10**9,1,10**9,10**18),str(6000000**2))]
RAW_NAMES={41:'snowflake-paint-the-ceiling',42:'snowflake-process-logs',43:'snowflake-radio-waves',44:'snowflake-remove-stones-to-minimize-the-total',45:'snowflake-select-stock',46:'snowflake-simple-array-rotation-game',47:'snowflake-super-bitstrings'}
def execute(path,inputs):
    start=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=900)
    assert p.returncode==0,(path,p.stderr[-3000:]);return json.loads(p.stdout),time.monotonic()-start
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(sys.argv[1:])
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in SPECS:
        ident=s['id'];number=int(ident.split('-')[-1])
        if selected and str(number) not in selected:continue
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(20263000+number)
        code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        # Materialize one task's boundaries at a time, then discard large arrays before execution.
        edge_pairs=[(s['encode'](v),a+'\n') for v,a in s['edges']()]
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=inp,expectedOutput=answer,hidden=i>=3,weight=1) for i,(inp,answer) in enumerate([(c['input'],c['expectedOutput']) for c in oracles[:3]]+edge_pairs+[(c['input'],c['expectedOutput']) for c in oracles[3:27]])]
        assert len(cases)>=31
        for c in oracles+cases:assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
        actual,elapsed=execute(path,[c['input'] for c in oracles+cases]);assert len(actual)==len(oracles+cases)
        for i,(c,a) in enumerate(zip(oracles+cases,actual)):assert a.split()==c['expectedOutput'].split(),(ident,i,a[:200],c['expectedOutput'][:200])
        mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name,old);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed);outputs,_=execute(p,[c['input'] for c in cases]);assert len(outputs)==len(cases)
            rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if a.split()!=c['expectedOutput'].split()];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        explanation='三个公开样例的答案依次为：'+'；'.join(c['expectedOutput'].strip() for c in oracles[:3])+'。样例已以独立枚举、状态搜索或直接模拟核对。'
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Snowflake'],description=s['desc']+'\n\n输入输出由本站整理，原文缺失的数值范围已明确标为本站补充。',input=s['limits'],output=s.get('output','输出题意要求的一个整数。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',4),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker='tokens',languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True);assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; two normal-exit WA controls rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20263000,problems=reports,skipped={},note='Independent local authored-program execution only; real sandbox validation still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number in range(41,48):
        rel='fastprep/Snowflake/'+RAW_NAMES[number]+'.md';raw=(snapshot/rel).read_bytes();ident=f'oa-snowflake-{number}'
        reviews.append(dict(id=ident,status='authored',reason=next(s['desc'] for s in SPECS if s['id']==ident),sourceCommit='e66f809f4c953bce129f68491726176615db6afc',rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
