"""Review and author judge candidates from seven fixed OA-Master pages.

This batch never edits the formal registry and never runs upstream solutions.
The stdin/stdout protocol and any added limits are explicitly CSWork additions.
"""
from collections import Counter, deque
from itertools import product
from pathlib import Path
import hashlib, inspect, json, random, subprocess, textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'
CAT = json.loads((ROOT/'content/oa-master/catalog.json').read_text())
COMMIT = CAT['source']['commit']
BATCH = 'misc-companies-remaining'
SEED = 20261007
RAW = {}
for company in ['meshy','fortinet','hsbc','weride','agoda','infosys','koddi']:
    line = subprocess.check_output(['git','ls-tree',COMMIT,f'web/content/docs/companies/{company}.mdx'],cwd=ROOT,text=True).strip()
    blob = line.split()[2]
    data = subprocess.check_output(['git','show',f'{COMMIT}:web/content/docs/companies/{company}.mdx'],cwd=ROOT)
    RAW[company] = {'path':f'web/content/docs/companies/{company}.mdx','gitBlobSha':blob,'sha256':hashlib.sha256(data).hexdigest()}

def run_code(code, data):
    p=subprocess.run(['python3','-c',code],input=data,text=True,capture_output=True,timeout=3)
    if p.returncode: raise AssertionError((p.returncode,p.stderr[:300],data[:100]))
    return p.stdout.strip()

def encode_ints(*groups): return '\n'.join(' '.join(map(str,g)) for g in groups)+'\n'

SPECS=[]
def add(id,title,company,tags,desc,inp,out,checker,samples,random_case,encode,oracle,code,mutants,idea,proof,complexity,limits):
    SPECS.append(dict(id=id,title=title,company=company,tags=tags,desc=desc,inp=inp,out=out,checker=checker,samples=samples,random=random_case,encode=encode,oracle=oracle,func=code,mutants=mutants,idea=idea,proof=proof,complexity=complexity,limits=limits))

# Fortinet #5: each dot-run can be optimized independently.
def beauty_value(s):
    ans=0; i=0
    while i<len(s):
        j=i+1
        while j<len(s) and s[j]==s[i]: j+=1
        ans+=(j-i)*(j-i+1)//2; i=j
    return ans
def beauty_oracle(s):
    dots=[i for i,c in enumerate(s) if c=='.']
    best=0
    for repl in product('abc',repeat=len(dots)):
        a=list(s)
        for i,c in zip(dots,repl): a[i]=c
        best=max(best,beauty_value(''.join(a)))
    return best
def beauty_random(r): return ''.join(r.choice('abc.') for _ in range(r.randint(1,8)))
def beauty_code(raw):
    s=raw.rstrip('\n'); n=len(s); blocks=[]; i=0
    while i<n:
        if s[i]=='.': i+=1; continue
        start=i; ch=s[i]
        while i<n and s[i]==ch: i+=1
        blocks.append([ch,start,i])
    if not blocks: return str(n*(n+1)//2)
    runs=[]
    for block in blocks:
        if runs and runs[-1][0]==block[0]: runs[-1][2]=block[2]
        else: runs.append(block[:])
    lengths=[end-start for _,start,end in runs]
    lengths[0]+=runs[0][1]
    lengths[-1]+=n-runs[-1][2]
    gaps=[runs[i+1][1]-runs[i][2] for i in range(len(runs)-1)]
    tri=lambda z:z*(z+1)//2
    if len(runs)==1: return str(tri(lengths[0]))
    # State says whether the preceding gap was assigned to this run (1) or its left neighbor (0).
    dp=[0,-10**30]
    for i,d in enumerate(gaps):
        nxt=[-10**30,-10**30]
        for prev_state in (0,1):
            base=lengths[i]+(gaps[i-1] if i>0 and prev_state==1 else 0)
            nxt[0]=max(nxt[0],dp[prev_state]+tri(base+d))
            nxt[1]=max(nxt[1],dp[prev_state]+tri(base))
        dp=nxt
    answer=max(dp[state]+tri(lengths[-1]+(gaps[-1] if state==1 else 0)) for state in (0,1))
    return str(answer)
add('oa-fortinet-5','最美子串最大值','Fortinet',['贪心','字符串'],
    '字符串只含小写字母与点号；每个点号可替换为任意小写字母。美丽子串指所有字符相同的连续子串。求替换后美丽子串总数的最大值。',
    '输入一行字符串 color（1≤长度≤2000），字符仅为 a-z 或 .。','输出最大美丽子串数量。','tokens',['.a.bb.','a...b','....'],beauty_random,lambda s:s+'\n',beauty_oracle,beauty_code,
    [('每个空隙都分配给右段',"nxt[0]=max(nxt[0],dp[prev_state]+tri(base+d))","nxt[0]=max(nxt[0],dp[prev_state]+tri(base))"),('每个空隙都分配给左段',"nxt[1]=max(nxt[1],dp[prev_state]+tri(base))","nxt[1]=max(nxt[1],dp[prev_state]+tri(base+d))")],
    '固定字符段各自计数；点号段内部填同一种字符。若两侧固定段字符相同就合并，否则把整个点号段并入收益较大的一侧。',
    '长度为 L 的同字符段恰有 L(L+1)/2 个美丽子串。一个点号段的分配收益关于分给两侧的长度是凸函数，最大值出现在全部分给左侧或右侧；两端字符相同时，全部填成该字符可将两侧三段合并，优于分割。不同点号段之间由固定字符隔开，决策互不影响。',
    'O(n) 时间，O(1) 额外空间。','源题规则和示例清楚；本站补充输入字符集、长度上限及 stdin/stdout。')

# HSBC #1: source sample contains a typo (5 was printed as 11); the prose rule is clear.
def flowers_oracle(v):
    a,k=v; return ' '.join(map(str,sorted(a[:k])+sorted(a[k:],reverse=True)))
def flowers_random(r):
    n=r.randint(0,12); return ([r.randint(1,30) for _ in range(n)],r.randint(0,n))
def flowers_encode(v):
    a,k=v; return f'{len(a)}\n'+(' '.join(map(str,a))+'\n' if a else '\n')+f'{k}\n'
def flowers_code(raw):
    a=list(map(int,raw.split())); n=a[0]; v=a[1:1+n]; k=a[1+n]
    return ' '.join(map(str,sorted(v[:k])+sorted(v[k:],reverse=True)))
add('oa-hsbc-1','花枝分段排序','HSBC',['排序','数组'],
    '将输入顺序的前 K 根花枝按长度升序排列，其余花枝按长度降序排列，再连接两个部分。题面示例输出中的 11 与输入值不符；按明确规则应为 5。',
    '第一行 n（0≤n≤200000）；第二行 n 个整数；第三行 K（0≤K≤n）。长度值取 32 位有符号整数。','输出按规则连接后的 n 个长度。','tokens', [([17,7,5,10,46,23,16,8],3),([4,4,1],1)],flowers_random,flowers_encode,flowers_oracle,flowers_code,
    [('后半段也升序',"sorted(v[k:],reverse=True)","sorted(v[k:])"),('按值从大到小排前半段',"sorted(v[:k])","sorted(v[:k],reverse=True)")],
    '按 K 切分数组，分别排序并按指定方向连接。','题目规定前 K 项和其余项分别排序，且两部分的原始边界由输入位置确定；局部排序后连接直接满足全部要求。',
    'O(n log n) 时间，O(n) 额外空间。','原题主体明确但约束 OCR 损坏；本站补充 n 和数值范围，并修正样例明显笔误。')

# HSBC #3: maximum 4-connected component of 1s.
def house_oracle(g):
    n=len(g); m=len(g[0]); seen=set(); best=0
    for i in range(n):
      for j in range(m):
        if g[i][j] and (i,j) not in seen:
          st=[(i,j)]; seen.add((i,j)); size=0
          while st:
            x,y=st.pop(); size+=1
            for a,b in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
              if 0<=a<n and 0<=b<m and g[a][b] and (a,b) not in seen: seen.add((a,b)); st.append((a,b))
          best=max(best,size)
    return str(best)
def house_random(r): return [[r.randint(0,1) for _ in range(r.randint(1,6))] for _ in range(1)] # replaced below
def house_case(r):
    n,m=r.randint(1,6),r.randint(1,6); return [[r.randint(0,1) for _ in range(m)] for _ in range(n)]
def house_encode(g): return f'{len(g)} {len(g[0])}\n'+'\n'.join(' '.join(map(str,row)) for row in g)+'\n'
def house_code(raw):
    a=list(map(int,raw.split())); n,m=a[:2]; g=[a[2+i*m:2+(i+1)*m] for i in range(n)]; seen=set(); best=0
    for i in range(n):
      for j in range(m):
        if g[i][j] and (i,j) not in seen:
          q=[(i,j)]; seen.add((i,j)); z=0
          for x,y in q:
            z+=1
            for u,v in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
              if 0<=u<n and 0<=v<m and g[u][v] and (u,v) not in seen: seen.add((u,v)); q.append((u,v))
          best=max(best,z)
    return str(best)
add('oa-hsbc-3','最大房屋面积','HSBC',['网格','BFS'],
    '网格中的 1 表示屋顶，0 表示空地。仅上下左右相邻的 1 属于同一栋房屋；对角线不连通。求最大房屋覆盖的格子数。',
    '第一行 n m（1≤n,m，且 nm≤200000）；接下来 n 行各有 m 个 0 或 1。','输出最大连通块面积；没有 1 时输出 0。','tokens',[[[0,0,0],[0,1,1],[0,0,0],[1,1,0]],[[1,0],[0,1]],[[0]]],house_case,house_encode,house_oracle,house_code,
    [('把对角线也当相邻',"(x+1,y),(x-1,y),(x,y+1),(x,y-1)","(x+1,y),(x-1,y),(x,y+1),(x,y-1),(x+1,y+1),(x-1,y-1)"),('不遍历整张网格',"for i in range(n):","for i in range(0):")],
    '对每个尚未访问的 1 做四方向 BFS/DFS，统计该连通块大小并更新最大值。','每个 1 恰好属于一个四连通分量，BFS 恰好访问该分量；取所有分量大小的最大值即题目所求。',
    'O(nm) 时间，O(nm) 空间。','原题连通规则明确；本站补充网格规模和空网格结果。')

# WeRide #4: max-common-friends recommendations, with deterministic tie-break.
def recommend_oracle(v):
    n,edges=v; g=[set() for _ in range(n)]
    for a,b in edges:g[a].add(b);g[b].add(a)
    out=[]
    for y in range(n):
      best=-1; who=-1
      for x in range(n):
        if x==y or x in g[y]: continue
        common=len(g[x]&g[y])
        if common>best: best=common; who=x
      out.append(who)
    return ' '.join(map(str,out))
def graph_random(r):
    n=r.randint(1,10); edges=[]; deg=[0]*n
    for i in range(n):
      for j in range(i+1,n):
        if deg[i]<4 and deg[j]<4 and r.random()<.24: edges.append((i,j));deg[i]+=1;deg[j]+=1
    return n,edges
def graph_encode(v):
    n,e=v; return f'{n} {len(e)}\n'+''.join(f'{a} {b}\n' for a,b in e)
def recommend_code(raw):
    z=list(map(int,raw.split())); n,m=z[:2]; g=[set() for _ in range(n)]
    for i in range(m):
      a,b=z[2+2*i:4+2*i]; g[a].add(b);g[b].add(a)
    ans=[]
    for y in range(n):
      counts={}
      for f in g[y]:
        for x in g[f]:
          if x!=y and x not in g[y]: counts[x]=counts.get(x,0)+1
      if counts:
        mx=max(counts.values()); ans.append(min(x for x,v in counts.items() if v==mx))
      else:
        x=0
        while x==y or x in g[y]: x+=1
        ans.append(x if x<n else -1)
    return ' '.join(map(str,ans))
add('oa-weride-4','共同好友推荐','WeRide',['图','枚举'],
    '用户编号为 0..n−1，输入无向好友关系。对每个用户 y，从既不是 y 本人也不是 y 的好友的用户中，选共同好友数最多者；并列选编号最小者。若没有候选则为 -1。',
    '第一行 n m（1≤n≤100000）；接下来 m 行各一对不同用户编号。好友关系无重复、无向，且每人最多 15 个好友。','输出 n 个推荐编号，按用户编号顺序排列。','tokens',[(3,[]),(4,[(0,1),(1,2)]),(5,[(0,1),(0,2),(1,3),(2,3)])],graph_random,graph_encode,recommend_oracle,recommend_code,
    [('共同好友并列时取最大编号',"min(x for x,v in counts.items() if v==mx)","max(x for x,v in counts.items() if v==mx)"),('没有共同好友时仍返回 -1',"x=0\n        while x==y or x in g[y]: x+=1\n        ans.append(x if x<n else -1)","ans.append(-1)")],
    '只需累计二跳邻居的出现次数。若不存在二跳候选，则所有非好友候选的共同好友数均为 0，取最小可用编号。','任意共同好友 z 对应路径 y-z-x，因此 x 的累计次数就是共同好友数；遍历所有二跳邻居即可覆盖每个正分候选。无计数候选时最大值为 0，所有合格用户并列，题目要求选最小编号。',
    '每个用户最多检查 15×15 个二跳路径，时间 O(n·15²+m)，空间 O(n+m)。','原题排序规则和每人最多 15 个好友明确；本站补充无重复边和输入输出协议。')

# WeRide #5: reverse the two allowed moves.
def reach_oracle(v):
    x,y,a,b=v
    seen={(x,y)}; q=deque([(x,y)])
    while q:
      p,t=q.popleft()
      if (p,t)==(a,b): return 'Yes'
      for nxt in ((p+t,t),(p,p+t)):
        if nxt[0]<=a and nxt[1]<=b and nxt not in seen: seen.add(nxt); q.append(nxt)
    return 'No'
def reach_random(r):
    x,y=r.randint(1,10),r.randint(1,10); a,b=r.randint(1,20),r.randint(1,20); return x,y,a,b
def reach_code(raw):
    x,y,a,b=map(int,raw.split())
    while a>=x and b>=y and (a,b)!=(x,y):
      if a>b: a-=b
      else: b-=a
    return 'Yes' if (a,b)==(x,y) else 'No'
add('oa-weride-5','机器人移动可达性','WeRide',['数论','模拟'],
    '机器人从正整数坐标 (x1,y1) 出发，可无限次执行 (x,y)→(x+y,y) 或 (x,y)→(x,x+y)。判断能否到达 (x2,y2)。',
    '一行四个整数 x1 y1 x2 y2（每个在 1..1000）。','可达输出 Yes，否则输出 No。','tokens',[(1,1,3,2),(1,1,2,2),(2,3,7,3),(2,4,3,4)],reach_random,lambda v:' '.join(map(str,v))+'\n',reach_oracle,reach_code,
    [('反向减法坐标写反',"if a>b: a-=b\n      else: b-=a","if a>b: b-=a\n      else: a-=b"),('只接受起点等于终点',"while a>=x and b>=y and (a,b)!=(x,y):","while False:")],
    '从目标反向走：若 x>y，最后一步只能来自 (x−y,y)；否则来自 (x,y−x)。坐标低于起点即不可能。','两种正向操作分别只会增加一个坐标且增量等于另一个坐标，因此逆操作唯一。反复应用逆操作必然减小坐标和，最终到达起点则且唯有此时可达。',
    '最多 O(x2+y2) 次，O(1) 额外空间；在题目给定 1000 上限内足够。','起终点范围和两种移动精确定义；本站规定 stdin/stdout。')

# WeRide #9: interval scheduling with one meeting per day.
def meeting_oracle(v):
    starts,ends=v; days=range(min(starts),max(ends)+1) if starts else range(0); best=0
    def dfs(i,mask,used):
      nonlocal best
      if i==len(days): best=max(best,used); return
      dfs(i+1,mask,used)
      day=days[i]
      for j,(s,e) in enumerate(zip(starts,ends)):
        if not (mask>>j&1) and s<=day<=e: dfs(i+1,mask|(1<<j),used+1)
    dfs(0,0,0); return str(best)
def meetings_random(r):
    n=r.randint(0,8); arr=[]
    for _ in range(n):
      a=r.randint(1,8); arr.append((a,r.randint(a,10)))
    return [x[0] for x in arr],[x[1] for x in arr]
def meetings_encode(v):
    s,e=v; return f'{len(s)}\n'+' '.join(map(str,s))+'\n'+' '.join(map(str,e))+'\n'
def meetings_code(raw):
    z=list(map(int,raw.split())); n=z[0]; s=z[1:1+n]; e=z[1+n:1+2*n]
    q=sorted((s[i],e[i]) for i in range(n)); day=0; ans=0; i=0; h=[]
    import heapq
    while i<n or h:
      if not h: day=max(day,q[i][0])
      while i<n and q[i][0]<=day: heapq.heappush(h,q[i][1]); i+=1
      while h and h[0]<day: heapq.heappop(h)
      if h: heapq.heappop(h); ans+=1; day+=1
    return str(ans)
add('oa-weride-9','投资人会面安排','WeRide',['贪心','区间调度'],
    '每位投资人只在闭区间 [firstDay[i], lastDay[i]] 可见面；每天最多安排一场。求最多能安排多少场会面。',
    '第一行 n（0≤n≤100000）；第二行 n 个 firstDay；第三行 n 个 lastDay。日期为 1..10^9，且 firstDay[i]≤lastDay[i]。','输出最多会面数。','tokens', [([1,2,3],[2,3,4]),([1,1,2],[1,2,2]),([],[])],meetings_random,meetings_encode,meeting_oracle,meetings_code,
    [('优先选择最晚截止时间',"heapq.heappop(h); ans+=1","ans+=1; heapq.heappop(h); h=[]") ,('忽略过期区间',"while h and h[0]<day: heapq.heappop(h)","while False: heapq.heappop(h)")],
    '按可用起始日加入候选，每天从候选中选择最早结束的投资人；若当前没有候选则跳至下一个起始日。','若某天安排了结束更晚的区间而保留更早结束的区间，交换二者不会减少已安排场次且为后续留下不少选择。因此每天取最早截止者是安全的贪心；过期区间不可能再被安排。',
    'O(n log n) 时间，O(n) 空间。','题意的闭区间及每日限制明确；原文缺约束，本站补充日期和数量上限。')

# Agoda #4: digit-DP count on [a,b].
def digit_count_oracle(v):
    a,b=v; return sum(len(set(str(x)))==len(str(x)) for x in range(a,b+1))
def digit_random(r):
    a=r.randint(0,10000); return a,r.randint(a,min(12000,a+400))
def digit_code(raw):
    a,b=map(int,raw.split())
    def upto(x):
      if x<0:return 0
      ds=list(map(int,str(x))); L=len(ds); ans=1
      def perm(n,k):
        if k>n:return 0
        v=1
        for t in range(k):v*=n-t
        return v
      for length in range(1,min(L,10)): ans+=9*perm(9,length-1)
      used=set()
      for i,d in enumerate(ds):
        low=1 if i==0 else 0
        remaining=L-i-1
        for c in range(low,d):
          if c not in used: ans+=perm(9-len(used),remaining)
        if d in used or (i==0 and d==0): break
        used.add(d)
      else: ans+=1
      return ans
    return str(upto(b)-upto(a-1))
add('oa-agoda-4','区间内无重复数字的整数','Agoda',['数位计数','组合数学'],
    '给定闭区间 [a,b]，统计十进制表示中没有重复数字的整数。数字 0 也计为一个有效整数。',
    '一行两个整数 a b（0≤a≤b≤10^18）。','输出区间内十进制各位互不相同的整数个数。','tokens',[(5,11),(0,0),(98,102),(100,130)],digit_random,lambda v:f'{v[0]} {v[1]}\n',digit_count_oracle,digit_code,
    [('不计整数 0',"ans=1","ans=0"),('漏掉左端点',"upto(b)-upto(a-1)","upto(b)-upto(a)")],
    '先统计位数更短的正整数，再逐位枚举小于当前上界数字的合法选择；剩余位数按未使用数字的排列数计数。最后用前缀函数作区间差。','每个有效数有唯一十进制位串。逐位分支恰好枚举所有在首个不同位上小于上界的数，排列数计入其余未用数字；若上界自身无重复再计入。F(b)−F(a−1) 因而准确对应闭区间。',
    'O(log b × 10) 时间，O(10) 额外空间。','原题规则清楚；本站补充零的处理、上界和标准输入输出。')

# Koddi #1: whitespace-separated words, case-insensitive endpoint comparison.
def words_oracle(s): return sum(w[0].lower()==w[-1].lower() for w in s.split() if w)
def words_random(r):
    return ' '.join(''.join(r.choice('abABxyXY') for _ in range(r.randint(1,8))) for _ in range(r.randint(0,8)))
def words_code(raw): return str(sum(w[0].lower()==w[-1].lower() for w in raw.split() if w))
add('oa-koddi-1','首尾字母相同的单词数','Koddi',['字符串'],
    '文本由英文字母单词和空格组成。统计首字母与末字母相同的单词，比较时忽略大小写。空文本输出 0。',
    '输入一行文本（可为空；最多 100000 个字符），单词以一个或多个空格分隔。','输出满足条件的单词数量。','tokens',['Level Wow not now','', 'A ab bB'],words_random,lambda s:s+'\n',words_oracle,words_code,
    [('大小写敏感比较',"w[0].lower()==w[-1].lower()","w[0]==w[-1]"),('跳过单字符词',"if w)","if len(w)>1)")],
    '按空白切分单词，逐个比较小写化后的首尾字母。','每个分词结果恰好对应一个单词；对其首尾字符做不区分大小写比较与题意等价，累加真值即所求。',
    'O(L) 时间，O(L) 空间（分词存储）。','题意、大小写规则及空字符串样例明确；本站补充行输入协议。')

# Koddi #4: sparse counting of 2x2 windows.
def submatrix_oracle(v):
    r,c,b=v; counts=[0]*5
    for i in range(max(0,r-1)):
      for j in range(max(0,c-1)):
        z=sum((x,y) in b for x,y in ((i,j),(i+1,j),(i,j+1),(i+1,j+1)));counts[z]+=1
    return ' '.join(map(str,counts))
def grid_black_random(r):
    n,m=r.randint(1,8),r.randint(1,8); b=[(i,j) for i in range(n) for j in range(m) if r.random()<.2]; return n,m,b
def black_encode(v):
    n,m,b=v; return f'{n} {m} {len(b)}\n'+''.join(f'{x} {y}\n' for x,y in b)
def submatrix_code(raw):
    a=list(map(int,raw.split()));r,c,k=a[:3]; blacks={tuple(a[3+2*i:5+2*i]) for i in range(k)}; freq={}
    for x,y in blacks:
      for i in (x-1,x):
        for j in (y-1,y):
          if 0<=i<r-1 and 0<=j<c-1: freq[(i,j)]=freq.get((i,j),0)+1
    ans=[0]*5
    for z in freq.values():ans[z]+=1
    ans[0]=(r-1)*(c-1)-len(freq)
    return ' '.join(map(str,ans))
add('oa-koddi-4','按黑格数量统计 2×2 子矩阵','Koddi',['网格','哈希表'],
    '给定 rows×cols 网格中所有黑格坐标。对每个 2×2 子矩阵，按其中黑格数 0..4 分类并计数，返回五个计数。坐标从 0 开始且无重复。',
    '第一行 rows cols k（1≤rows,cols≤10^9，0≤k≤min(rows×cols,200000)）；接下来 k 行为黑格的 0-based row col。','输出 5 个整数，依次为含 0、1、2、3、4 个黑格的窗口数。','tokens',[(3,3,[(0,0),(1,1)]),(1,5,[]),(2,2,[(0,0),(0,1),(1,0),(1,1)])],grid_black_random,black_encode,submatrix_oracle,submatrix_code,
    [('把 0 黑格窗口数设为零',"ans[0]=(r-1)*(c-1)-len(freq)","ans[0]=0"),('漏掉左上窗口',"for i in (x-1,x):","for i in (x,):")],
    '每个黑格最多属于四个 2×2 窗口，只累计被黑格触及的窗口；其余窗口黑格数为零。','任意含至少一个黑格的 2×2 窗口会被其内某个黑格枚举到，字典频次恰等于其中黑格数。未出现的窗口没有黑格，故零类数量为全部窗口数减字典大小。',
    'O(k) 时间，O(k) 空间。','题意明确；本站补充坐标范围、黑格互异和输入协议。')

# Items whose source is insufficient/contradictory are individually blocked.
BLOCKED={
'oa-meshy-1':'选择题而非要求程序输入输出；不能作为可自动判题的 stdin/stdout 题。',
'oa-meshy-2':'选择题而非要求程序输入输出；不能作为可自动判题的 stdin/stdout 题。',
'oa-meshy-3':'选择题而非要求程序输入输出；不能作为可自动判题的 stdin/stdout 题。',
'oa-meshy-4':'选择题而非要求程序输入输出；不能作为可自动判题的 stdin/stdout 题。',
'oa-meshy-5':'选择题而非要求程序输入输出；不能作为可自动判题的 stdin/stdout 题。',
'oa-meshy-6':'选择题而非要求程序输入输出；不能作为可自动判题的 stdin/stdout 题。',
'oa-meshy-7':'源题明确要求 NumPy 函数、禁止循环，但未给 stdin/stdout 序列化形式；本站系统要求固定标准输入输出，无法声称协议来自源题。',
'oa-meshy-8':'要求手工构造注意力矩阵参数，但题面未定义参数形状、合法 Q/K/V 的等价范围或输出格式，无法做确定性自动判题。',
'oa-fortinet-1':'源题核心描述缺失，仅残留样例；无法确定选择物品的约束及目标函数是否还包含其它规则。',
'oa-fortinet-2':'固定题面在“Calculate the sum ... for all pairs (1”处截断，未说明编号范围、是否有序计对及求和端点；选择任一约定都会改变答案。',
'oa-fortinet-3':'样例输出与“中心可放在任意实数位置、距离为绝对值”的规则不一致：给定点集可用半整数中心得到小于 2 的最大距离，不能确定中心是否限于整数/输入点。',
'oa-fortinet-4':'“number of sweeps”及每轮是原地左到右还是并行交换、是否计入最后无交换轮均不明确；样例不足以确定结果。',
'oa-hsbc-2':'交换动作段落被截断，Q 与 S 的输入关系、每步涉及多少组 row/col 对均无法从固定题面恢复。',
'oa-hsbc-4':'“most frequently ... by at least K customers”未定义频率是客户覆盖人数还是购物袋中出现次数，也未定义取 K 个客户的选择方式。',
'oa-weride-1':'更新类型的查询编码和各字段的完整 I/O 结构未给出；点赋值与全局 floor 规则虽有描述，但无法确认数组/查询序列序列化约定及值范围。',
'oa-infosys-3':'数组修改与前缀最小值的规则清楚，但题目缺少更新量 x 是否必须非负、更新结果是否允许负数等关键边界；样例只覆盖下降且非负，无法据此确认全部合法输入域及原题返回类型。',
'oa-agoda-1':'Latch 博弈的“核心最大化自身总时长”未形式化双方策略、起始持锁核心及输出顺序，不能将其猜成零和最优策略。',
'oa-agoda-2':'正文说最少团队数等于最大区间重叠数，但示例在 skill=2 有 4 个区间重叠却输出 3；定义和样例冲突。',
'oa-agoda-3':'与 Agoda #1 相同的 latch 博弈未形式化策略与起始核心；输出示例不足以定义逐步决策。',
'oa-infosys-1':'虽然循环操作已描述，但没有给出如何保证可行解/最优代价的进一步约束，且模数与样例的计分结果无法独立验证原题的排列操作边界；暂不凭题解猜算法。',
'oa-infosys-2':'“good subsequence”要求每个子数组 removable，但样例解释缺失且 N 无约束；核心量词和可行复杂度无法根据固定题面验证。',
'oa-infosys-4':'要求最大化和的乘积并最小化交换数，但数值正负范围缺失；也未说明多个最高乘积排列之间 swaps 的比较基准/初始状态细节。',
'oa-koddi-2':'交替飞行方向时若该方向已无木棍，何时停止/是否改方向未定义；总木棍长度≥100 不能保证起点两侧交替都能找到木棍。',
'oa-koddi-3':'固定源题给出的 3×3 示例与 Y/背景规则不一致：枚举六种状态赋值最少需要多次修改，而示例声称答案为 1。',
}

def norm_package(pkg):
    js="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    p=subprocess.run(['node','--import','tsx','-e',js],cwd=ROOT,input=json.dumps(pkg,ensure_ascii=False),text=True,capture_output=True,check=True)
    return p.stdout

def reference_code(spec):
    src=inspect.getsource(spec['func'])
    src=src.replace(f"def {spec['func'].__name__}(raw):",'def solve(raw):',1)
    if src==inspect.getsource(spec['func']): raise AssertionError(('cannot normalize reference name',spec['id']))
    return 'import sys\n'+src.rstrip()+'\n\nprint(solve(sys.stdin.read()))\n'

def main():
    source_ids={x['id'] for x in CAT['items'] if x['companySlug'] in RAW}
    already={'oa-weride-2','oa-weride-3','oa-weride-6','oa-weride-7','oa-weride-8'}
    scope=source_ids-already
    existing={}
    review_dir=OUT/'reviews'
    for path in review_dir.glob('*.json'):
      if path.name==BATCH+'.json': continue
      existing.update((x['id'],x) for x in json.loads(path.read_text()).get('items',[]))
    pending=scope-set(existing)
    assert len(source_ids)==38 and len(scope)==33,(len(source_ids),len(scope))
    chosen={s['id'] for s in SPECS}
    resolutions={pid for pid in chosen if pid in existing and existing[pid]['status']=='blocked'}
    assert chosen<=pending|resolutions and len(chosen)==9
    assert resolutions=={'oa-hsbc-1'}
    reviewed=(chosen-resolutions)|(set(BLOCKED)&pending)
    assert reviewed==pending,(pending-reviewed,reviewed-pending)
    rng=random.Random(SEED); entries=[]; reports=[]; reviews=[]; evidence=[]
    for company,meta in RAW.items():
      evidence.append({'company':company,'path':meta['path'],'gitBlobSha':meta['gitBlobSha'],'sha256':meta['sha256']})
    for s in SPECS:
      src=next(x for x in CAT['items'] if x['id']==s['id']); vals=[]
      for v in s['samples']:
        if v not in vals: vals.append(v)
      seen={json.dumps(v,sort_keys=True,ensure_ascii=False) for v in vals}
      while len(vals)<120:
        v=s['random'](rng); key=json.dumps(v,sort_keys=True,ensure_ascii=False)
        if key not in seen: seen.add(key); vals.append(v)
      oracle=[]
      for v in vals:
        data=s['encode'](v); expected=str(s['oracle'](v))
        got=run_code(reference_code(s),data)
        if got!=expected: raise AssertionError((s['id'],v,expected,got))
        oracle.append({'input':data,'expectedOutput':expected+'\n'})
      formal=oracle[:3]+oracle[3:30]
      cases=[{'name':f'公开样例 {i+1}' if i<3 else f'隐藏验证 {i-2}',**x,'hidden':i>=3,'weight':1} for i,x in enumerate(formal)]
      # Keep a single executable entry point in the reference.
      code=reference_code(s)
      ref=OUT/'references'/f"{s['id']}.py"; ref.write_text(code)
      mutants=[]; killed=[]
      for k,(name,old,new) in enumerate(s['mutants'],1):
        if old not in code: raise AssertionError((s['id'],'missing mutant anchor',old))
        mcode=code.replace(old,new,1)
        mpath=OUT/'negative-controls'/f"{s['id']}-{k}.py"; mpath.write_text(mcode)
        rej=[]
        for i,c in enumerate(cases):
          try:
            if run_code(mcode,c['input'])!=c['expectedOutput'].strip(): rej.append(i)
          except AssertionError: rej.append(i)
        if not rej: raise AssertionError((s['id'],'mutant survived',name))
        mutants.append({'name':name,'code':mcode}); killed.append({'name':name,'rejectedByCases':rej})
      problem={'id':s['id'],'courseId':'gomall','lessonId':'00-overview','title':s['title'],'difficulty':'中等','tags':['OA',s['company']]+s['tags'],'description':s['desc']+'\n\n'+s['limits']+'\n\n'+f"来源：{src['sourceUrl']}（固定题面指纹 {src['contentHash']}）。本站新增的输入输出协议/边界按题面说明，不声称为原站规则。",'input':s['inp'],'output':s['out'],'explanation':'完整思路、证明及复杂度见配套讲义。','hints':[s['idea']],'timeLimit':3,'memoryLimit':262144,'outputLimit':65536,'checker':s['checker'],'languages':['python','go','java','cpp']}
      pkg=json.loads(norm_package({'schemaVersion':1,'problem':problem,'cases':cases})); norm=json.dumps(pkg,ensure_ascii=False,separators=(',',':'))
      explanation=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['complexity']}\n\n## 来源与补充\n\n{src['sourceUrl']}；{s['limits']}"
      editorial={'schemaVersion':1,'id':s['id'],'title':s['title'],'explanation':explanation,'solutions':[{'language':'python','code':code}],'sourceUrl':src['sourceUrl'],'sourceContentHash':src['contentHash'],'author':'Chunyu Sui'}
      for folder,doc in [('packages',pkg),('editorials',editorial),('oracles',oracle),('mutants',mutants)]:
        (OUT/folder/f'{s["id"]}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
      entries.append({'id':s['id'],'sourceContentHash':src['contentHash'],'packageChecksum':hashlib.sha256(norm.encode()).hexdigest(),'editorial':explanation,'authoredSolutions':editorial['solutions']})
      reports.append({'id':s['id'],'oracleCases':len(oracle),'uniqueOracleInputs':len({x['input'] for x in oracle}),'publicCases':3,'hiddenCases':len(cases)-3,'negativeControls':killed,'referenceSha256':hashlib.sha256(code.encode()).hexdigest()})
      if s['id'] not in resolutions:
        reviews.append({'id':s['id'],'status':'authored','reason':'已对照 OAMaster 固定 MDX 快照逐题确认；本站新增 I/O 与边界已写入题面；120 个唯一输入由独立 oracle 对拍，两个正常退出 mutant 均被正式测试击杀。尚未运行 GoJudge。 '+s['limits'],'sourceUrls':[src['sourceUrl']],'sourceContentHashes':[src['contentHash']],'sourceCommit':COMMIT,'rawPath':RAW[src['companySlug']]['path'],'rawGitBlob':RAW[src['companySlug']]['gitBlobSha'],'catalogContentHash':src['contentHash']})
      print(f"{s['id']}: 120 unique oracle inputs; 30 formal cases; 2 mutants killed",flush=True)
    blocked=[]
    for pid,reason in BLOCKED.items():
      if pid not in pending: continue
      src=next(x for x in CAT['items'] if x['id']==pid)
      blocked.append({'id':pid,'status':'blocked','reason':reason,'sourceUrls':[src['sourceUrl']],'sourceContentHashes':[src['contentHash']],'sourceCommit':COMMIT,'rawPath':RAW[src['companySlug']]['path'],'rawGitBlob':RAW[src['companySlug']]['gitBlobSha'],'catalogContentHash':src['contentHash']})
    for s in SPECS:
      src=next(x for x in CAT['items'] if x['id']==s['id']); evidence.append({'id':s['id'],'company':src['companyName'],'title':src['title'],'sourceUrl':src['sourceUrl'],'catalogContentHash':src['contentHash'],'status':'authored','rawPath':RAW[src['companySlug']]['path'],'rawGitBlob':RAW[src['companySlug']]['gitBlobSha']})
    for x in blocked:
      item=next(y for y in CAT['items'] if y['id']==x['id']); evidence.append({'id':x['id'],'company':item['companyName'],'title':item['title'],'sourceUrl':item['sourceUrl'],'catalogContentHash':item['contentHash'],'status':'blocked','reason':x['reason'],'rawPath':x['rawPath'],'rawGitBlob':x['rawGitBlob']})
    resolution_items=[]
    for pid in sorted(resolutions):
      previous=existing[pid]; src=next(x for x in CAT['items'] if x['id']==pid)
      resolution_items.append({'id':pid,'previousReason':previous['reason'],'sourceContentHash':src['contentHash'],'batch':BATCH,'reason':'固定源题的操作规则明确，异常仅在 OCR 样例把输入中的 5 错印为 11；按原数组与规则重算后的输出唯一为 5。本站修正展示样例并用独立 oracle 验证，不改变排序语义。'})
    docs={
      f'candidate-batches/{BATCH}.json':{'schemaVersion':1,'items':entries},
      f'validation/{BATCH}.json':{'schemaVersion':1,'seed':SEED,'problems':reports,'note':'仅本地独立 oracle/reference/mutant 验证；没有 GoJudge 报告，不代表已发布。'},
      f'reviews/{BATCH}.json':{'schemaVersion':1,'items':sorted(reviews+blocked,key=lambda x:x['id'])},
      f'resolutions/{BATCH}.json':{'schemaVersion':1,'items':resolution_items},
      f'source-evidence/{BATCH}.json':{'schemaVersion':1,'repository':'https://github.com/RedInn7/OA-Master','commit':COMMIT,'reason':'固定上游 MDX 原始页 Git blob 与 SHA-256；未执行源仓库代码。','pages':evidence[:7],'items':evidence[7:]}}
    for rel,doc in docs.items():(OUT/rel).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    print(f'Reviewed {len(reviewed)} newly pending items: {len(entries)} candidates, {len(blocked)} blocked; preserved {len(scope)-len(pending)} existing reviews.')

if __name__=='__main__': main()
