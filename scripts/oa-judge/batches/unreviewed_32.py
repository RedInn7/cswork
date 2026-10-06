#!/usr/bin/env python3
"""Author and locally validate clear OAMaster items from the 2026-10-06 review.

This writes candidate-only content. It does not touch runtime batches, registry,
coverage snapshots, or GoJudge reports.
"""
from __future__ import annotations
import hashlib, json, random, re, itertools
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ROOT = REPO / 'content/oa-judge'
CATALOG = json.loads((REPO / 'content/oa-master/catalog.json').read_text())
ITEMS = {x['id']: x for x in CATALOG['items']}
BATCH = 'unreviewed-32'
RNG = random.Random(20261006)

def compact(x): return json.dumps(x, ensure_ascii=False, separators=(',', ':'))
def digest(x): return hashlib.sha256(x if isinstance(x, bytes) else x.encode()).hexdigest()
def run(code, raw):
    ns = {}; exec(compile(code, '<candidate>', 'exec'), ns)
    return str(ns['solve'](raw))

def make(id, company, title, desc, inp, out, solve, oracle, gen, samples, mutants, limits, editorial, checker='tokens'):
    return dict(id=id, company=company, title=title, description=desc, input=inp, output=out,
        solve=solve, oracle=oracle, gen=gen, samples=samples, mutants=mutants,
        limits=limits, editorial=editorial, checker=checker)

SPECS=[]

def datadog_oracle(raw):
    logs=[]; ans=[]
    for line in raw.splitlines()[1:]:
        p=line.split(maxsplit=4) if line.startswith('ADD ') else line.split()
        if p[0]=='ADD': logs.append((int(p[1]),p[2],p[3],' '.join(p[4:])))
        else:
            _,lo,hi,svc,lvl,key=p
            ans.append(sum(int(lo)<=t<=int(hi) and (svc=='*' or svc==s) and (lvl=='*' or lvl==l) and (key=='*' or key in m) for t,s,l,m in logs))
    return '\n'.join(map(str,ans))
SPECS.append(make('oa-datadog-1','Datadog','Log Ingestion and Query',
    '依序追加日志并执行闭区间查询；service/level 精确匹配，keyword 对 message 做子串匹配，`*` 表示不过滤。',
    '第一行 q（1≤q≤2×10^5），后续 q 行是 ADD timestamp service level message 或 QUERY start end service|* level|* keyword|*。message 可含空格。',
    '每条 QUERY 输出一行匹配数量。',
    "def solve(raw):\n lines=raw.splitlines(); q=int(lines[0]); logs=[]; out=[]\n for line in lines[1:1+q]:\n  p=line.split(maxsplit=4) if line.startswith('ADD ') else line.split()\n  if p[0]=='ADD': logs.append((int(p[1]),p[2],p[3],p[4]))\n  else:\n   _,a,b,s,l,k=p; a=int(a); b=int(b); out.append(str(sum(a<=t<=b and (s=='*' or s==ss) and (l=='*' or l==ll) and (k=='*' or k in m) for t,ss,ll,m in logs)))\n return '\\n'.join(out)\n",
    datadog_oracle, lambda r: (lambda ops: str(len(ops))+'\n'+'\n'.join(ops)+'\n')([*(f'ADD {r.randrange(12)} {r.choice(["api","web"])} {r.choice(["INFO","ERR"])} {r.choice(["login ok","bad request","login failed"])}' for _ in range(r.randrange(1,12))), *(f'QUERY {r.randrange(12)} {r.randrange(12)} {r.choice(["*","api","web"])} {r.choice(["*","INFO","ERR"])} {r.choice(["*","login","bad"])}' for _ in range(r.randrange(1,5)))]),
    ['6\nADD 1 api INFO hello world\nADD 2 api ERROR failed\nQUERY 1 2 * * *\nQUERY 1 2 api INFO hello\nQUERY 2 2 api ERROR fail\nQUERY 3 4 * * *\n','3\nADD 0 web INFO x\nQUERY 0 0 * * *\nQUERY 1 2 * * *\n'],
    [('排除结束时间相等的日志','def solve(raw):\n lines=raw.splitlines(); z=[]; o=[]\n for line in lines[1:]:\n  p=line.split(" ")\n  if p[0]=="ADD":z.append((int(p[1]),p[2],p[3]," ".join(p[4:])))\n  else:\n   _,a,b,s,l,k=p;a=int(a);b=int(b);o.append(str(sum(a<=t<b and (s=="*" or s==ss) and (l=="*" or l==ll) and (k=="*" or k in m) for t,ss,ll,m in z)))\n return "\\n".join(o)\n'),
     ('把关键字匹配改为完整相等','def solve(raw):\n lines=raw.splitlines();z=[];o=[]\n for line in lines[1:]:\n  p=line.split(" ")\n  if p[0]=="ADD":z.append((int(p[1]),p[2],p[3]," ".join(p[4:])))\n  else:\n   _,a,b,s,l,k=p;a=int(a);b=int(b);o.append(str(sum(a<=t<=b and (s=="*" or s==ss) and (l=="*" or l==ll) and (k=="*" or k==m) for t,ss,ll,m in z)))\n return "\\n".join(o)\n')],
    '时间戳与日志数值按整数解析；单条 message 不含制表符。',
    '按顺序维护已追加日志；每个查询扫描当前日志并逐项检查时间、服务、级别和消息条件。时间范围是闭区间。单次查询 O(L)，总复杂度 O(q²)，符合本题直接定义的简化版本。'))

def matrix_oracle(raw):
    z=raw.splitlines();m,n=map(int,z[0].split());a=[x for l in z[1:1+m] for x in map(int,l.split())];out=[]
    for idx in range(m*n):
        out.append(str(sum(a[:idx+1])))
    return '\n'.join(' '.join(out[r*n:(r+1)*n]) for r in range(m))
SPECS.append(make('oa-arista-networks-1','Arista Networks','Generate Matrix B','按行优先顺序，将矩阵 A 展平后的前缀和写回同尺寸矩阵 B。',
    '第一行 m n（1≤m,n≤1000，mn≤2×10^5），随后 m 行各 n 个整数（−10^9≤Aij≤10^9）。','输出 m 行，每行 n 个前缀和。',
    "def solve(raw):\n z=raw.splitlines();m,n=map(int,z[0].split());s=0;o=[]\n for line in z[1:1+m]:\n  a=list(map(int,line.split()));r=[]\n  for x in a[:n]:s+=x;r.append(str(s))\n  o.append(' '.join(r))\n return '\\n'.join(o)\n",matrix_oracle,
    lambda r: (lambda m,n,a: f'{m} {n}\n'+'\n'.join(' '.join(map(str,row)) for row in a)+'\n')((m:=r.randint(1,6)),(n:=r.randint(1,6)),[[r.randint(-9,9) for _ in range(n)] for _ in range(m)]),
    ['2 3\n1 2 3\n4 5 6\n','1 1\n-7\n'],
    [('Reset prefix at each row','def solve(raw):\n z=raw.splitlines();m,n=map(int,z[0].split());o=[]\n for line in z[1:1+m]:\n  s=0;a=list(map(int,line.split()));q=[]\n  for x in a[:n]:s+=x;q.append(str(s))\n  o.append(" ".join(q))\n return "\\n".join(o)\n'),
     ('Use only left prefix and omit previous-row values','def solve(raw):\n z=raw.splitlines();m,n=map(int,z[0].split());o=[]\n for line in z[1:1+m]:\n  s=0;q=[]\n  for x in list(map(int,line.split()))[:n]:s+=x;q.append(str(s))\n  o.append(" ".join(q))\n return "\\n".join(o)\n')],
    '所有前缀和使用任意精度整数；输入矩形完整。',
    '逐行逐列累加一个全局 running sum；每个位置恰好包含其前方所有行与当前行左侧元素。时间 O(mn)，额外空间 O(n) 输出。'))

def hashtag_oracle(raw):
    z=raw.splitlines(); n,now,w=map(int,z[0].split()); counts={}
    for line in z[1:1+n]:
        t,tw=line.split('\t',1);t=int(t)
        if now-w<=t<=now:
            for tag in re.findall(r'#[A-Za-z0-9_]+',tw):counts[tag]=counts.get(tag,0)+1
    return '\n'.join(sorted(counts,key=lambda x:(-counts[x],x))[:3])
SPECS.append(make('oa-f5-1','F5','Top 3 Trending Hashtags in a Time Window','统计闭区间时间窗内推文里的 hashtag 出现次数，按次数降序、标签字典序升序返回前三名。',
    '第一行 n currentTime timeWindow（n≤2×10^5，文本总长≤10^6）。后续 n 行为 timestamp、制表符、tweet；标签由 # 开始，后接 ASCII 字母/数字/下划线。',
    '每行输出一个 hashtag，保留开头的 #；无标签时输出空内容。',
    "def solve(raw):\n z=raw.splitlines();n,now,w=map(int,z[0].split());c={}\n for line in z[1:1+n]:\n  t,tw=line.split('\\t',1);t=int(t)\n  if now-w<=t<=now:\n   i=0\n   while i<len(tw):\n    if tw[i]=='#':\n     j=i+1\n     while j<len(tw) and (tw[j].isascii() and (tw[j].isalnum() or tw[j]=='_')):j+=1\n     if j>i+1:c[tw[i:j]]=c.get(tw[i:j],0)+1\n     i=j\n    else:i+=1\n return '\\n'.join(sorted(c,key=lambda x:(-c[x],x))[:3])\n",hashtag_oracle,
    lambda r: (lambda now,w,rows:f'{len(rows)} {now} {w}\n'+'\n'.join(f'{t}\t{s}' for t,s in rows)+'\n')((now:=r.randint(1,30)),(w:=r.randint(0,15)),[(r.randint(0,35),r.choice(['#a #b','#b #c','x #a1 #a','none #_'])) for _ in range(r.randint(1,10))]),
    ['4 4 2\n1\thi #a #b\n2\t#a !!!\n3\tno tag\n4\t#b #b\n','2 5 1\n3\t#z #A\n5\t#z #a\n'],
    [('把时间窗右端改成开区间','def solve(raw):\n z=raw.splitlines();n,now,w=map(int,z[0].split());c={}\n for line in z[1:1+n]:\n  t,tw=line.split("\\t",1);t=int(t)\n  if now-w<=t<now:\n   for h in re.findall(r"#[A-Za-z0-9_]+",tw):c[h]=c.get(h,0)+1\n return "\\n".join(sorted(c,key=lambda x:(-c[x],x))[:3])\n'),
     ('平票时按出现频次之外的逆字典序排序','def solve(raw):\n z=raw.splitlines();n,now,w=map(int,z[0].split());c={}\n for line in z[1:1+n]:\n  t,tw=line.split("\\t",1);t=int(t)\n  if now-w<=t<=now:\n   for h in re.findall(r"#[A-Za-z0-9_]+",tw):c[h]=c.get(h,0)+1\n return "\\n".join(sorted(c,key=lambda x:(-c[x],x),reverse=True)[:3])\n')],
    '文本按 ASCII hashtag 语法扫描；空的 # 不构成标签；时间戳与窗口均为非负整数。',
    '只扫描时间窗内文本，逐字符识别标签并计数，再按 `(-count, tag)` 排序。总扫描 O(文本总长)，排序 O(H log H)。'))

def guide_oracle(raw):
    s=raw.strip(); avail=[i for i,x in enumerate(s) if x=='-']; best=None
    if len(avail)>18:return 'unsupported'
    for mask in range(1<<len(avail)):
        chosen={avail[j] for j in range(len(avail)) if mask>>j&1}
        if all((i-1 in chosen if i else False) or (i+1 in chosen if i+1<len(s) else False) for i,c in enumerate(s) if c=='G'):
            best=len(chosen) if best is None else min(best,len(chosen))
    return str(-1 if best is None else best)
SPECS.append(make('oa-guidewire-1','Guidewire','Minimum Boys Next to Girls','在空座位放最少的男孩，使每个女孩至少有一个紧邻座位坐着男孩。',
    '一行字符串 s（1≤|s|≤2×10^5），仅含 G 和 -。','输出最少人数；无法满足时输出 -1。',
    "def solve(raw):\n s=raw.strip();placed=set();i=0\n while i<len(s):\n  if s[i]!='G' or i-1 in placed:i+=1;continue\n  if i+1<len(s) and s[i+1]=='-':placed.add(i+1);i+=2\n  elif i>0 and s[i-1]=='-':placed.add(i-1);i+=1\n  else:return '-1'\n return str(len(placed))\n",guide_oracle,
    lambda r: ''.join(r.choice('G-') for _ in range(r.randint(1,12)))+'\n', ['-G-GG--\n','G-G\n','G\n','--GG--\n'],
    [('总是优先把男孩放在女孩左边','def solve(raw):\n s=raw.strip();p=set();i=0\n while i<len(s):\n  if s[i]!="G" or i-1 in p:i+=1;continue\n  if i>0 and s[i-1]=="-":p.add(i-1);i+=1\n  elif i+1<len(s) and s[i+1]=="-":p.add(i+1);i+=2\n  else:return "-1"\n return str(len(p))\n'),
     ('忽略前一个男孩覆盖当前女孩','def solve(raw):\n s=raw.strip();p=set()\n for i,c in enumerate(s):\n  if c=="G":\n   if i+1<len(s) and s[i+1]=="-":p.add(i+1)\n   elif i>0 and s[i-1]=="-":p.add(i-1)\n   else:return "-1"\n return str(len(p))\n')],
    '每个男孩只放在原本为空的座位；人数不超过 |s|。',
    '从左到右处理尚未覆盖的女孩。优先放到其右侧空位，可同时覆盖后续相邻女孩；若不可用则尝试左侧。穷举所有放置子集作独立 oracle。'))

def ge_oracle(raw):
    z=list(map(int,raw.split()));n,k=z[:2];a=z[2:2+n]
    return str(min((sum(abs(a[j]-a[i]) for i,j in zip(c,c[1:])) for c in itertools.combinations(range(n),k)),default=0))
SPECS.append(make('oa-ge-vernova-1','GE Vernova','The Best Subsequence | Minimize Special Value','选择保持原顺序的 k 个元素，使相邻所选值绝对差之和最小。',
    '第一行 n k（1≤n≤800，1≤k≤n），下一行 n 个整数，|arr[i]|≤10^9。','输出最小 special value。',
    "def solve(raw):\n import bisect\n z=list(map(int,raw.split()));n,k=z[:2];a=z[2:2+n];v=sorted(set(a));m=len(v);size=1\n while size<m:size*=2\n INF=10**30;prev=[0]*n\n for length in range(2,k+1):\n  lo=[INF]*(2*size);hi=[INF]*(2*size);cur=[INF]*n\n  def query(tree,l,r):\n   l+=size;r+=size;ans=INF\n   while l<r:\n    if l&1:ans=min(ans,tree[l]);l+=1\n    if r&1:r-=1;ans=min(ans,tree[r])\n    l//=2;r//=2\n   return ans\n  def update(tree,pos,val):\n   pos+=size;tree[pos]=min(tree[pos],val);pos//=2\n   while pos:tree[pos]=min(tree[2*pos],tree[2*pos+1]);pos//=2\n  for i,x in enumerate(a):\n   t=bisect.bisect_left(v,x);cur[i]=min(query(lo,0,t+1)+x,query(hi,t,m)-x)\n   if prev[i]<INF:update(lo,t,prev[i]-x);update(hi,t,prev[i]+x)\n  prev=cur\n return str(min(prev))\n",ge_oracle,
    lambda r: (lambda n,k,a:f'{n} {k}\n'+' '.join(map(str,a))+'\n')((n:=r.randint(1,9)),(k:=r.randint(1,n)),[r.randint(-10,10) for _ in range(n)]),
    ['5 2\n9 5 1 4 9\n','6 3\n9 5 1 4 9 100\n','1 1\n-3\n'],
    [('只计算当前值减前驱值，不取绝对值','def solve(raw):\n z=list(map(int,raw.split()));n,k=z[:2];a=z[2:2+n];d=[0]*n\n for _ in range(2,k+1):d=[min((d[j]+a[i]-a[j] for j in range(i)),default=10**30) for i in range(n)]\n return str(min(d))\n'),
     ('只允许相邻原数组元素接续','def solve(raw):\n z=list(map(int,raw.split()));n,k=z[:2];a=z[2:2+n];d=[[10**30]*n for _ in range(k+1)]\n for i in range(n):d[1][i]=0\n for q in range(2,k+1):\n  for i in range(n):\n   if i:d[q][i]=d[q-1][i-1]+abs(a[i]-a[i-1])\n return str(min(d[k]))\n')],
    '补充 n≤1500，使 O(kn log n) 解法可行；|arr[i]|≤10^9。',
    '按子序列长度做动态规划。转移是 `min_j(dp[j]+|a[i]-a[j]|)`，将其拆成按值排序的 `dp[j]-a[j]` 前缀最小值与 `dp[j]+a[j]` 后缀最小值，用扫描更新。穷举组合独立校验。'))

def crusoe_oracle(raw):
    z=list(map(int,raw.split()));p=0;D=z[p];p+=1;U=z[p];p+=1;u=[z[p+3*i:p+3*i+3] for i in range(U)];p+=3*U;O=z[p];p+=1;o=[z[p+3*i:p+3*i+3] for i in range(O)];out=[]
    for d in range(1,D+1):
        state=int(any(v and l<=d<=r for l,r,v in u))
        for l,r,v in o:
            if l<=d<=r:state=v;break
        out.append(str(state))
    return ''.join(out)
SPECS.append(make('oa-crusoe-1','Crusoe','Interval Usage with Non-Overlapping Overrides','usage=1 区间取并集；usage=0 不清除；不重叠 override 区间覆盖 usage 结果。',
    '输入 D、U，接着 U 行 l r v；再输入 O，接着 O 行 l r v。1≤D≤2×10^5，U,O≤2×10^5；区间闭合且在 [1,D]，v∈{0,1}；override 两两不重叠。',
    '输出长度为 D 的 0/1 字符串。',
    "def solve(raw):\n z=list(map(int,raw.split()));p=0;D=z[p];p+=1;U=z[p];p+=1;diff=[0]*(D+2)\n for _ in range(U):\n  l,r,v=z[p:p+3];p+=3\n  if v:diff[l]+=1;diff[r+1]-=1\n O=z[p];p+=1;over=[None]*(D+1)\n for _ in range(O):\n  l,r,v=z[p:p+3];p+=3\n  for i in range(l,r+1):over[i]=v\n cur=0;out=[]\n for i in range(1,D+1):\n  cur+=diff[i];out.append(str(cur>0 if over[i] is None else over[i]))\n return ''.join(out)\n",crusoe_oracle,
    lambda r: (lambda D,U,O:f'{D}\n{len(U)}\n'+'\n'.join(' '.join(map(str,x)) for x in U)+f'\n{len(O)}\n'+'\n'.join(' '.join(map(str,x)) for x in O)+'\n')((D:=r.randint(1,20)),[(lambda a,b,v:(min(a,b),max(a,b),v))(r.randint(1,D),r.randint(1,D),r.randrange(2)) for _ in range(r.randint(0,8))],[] if not r.randrange(2) else [(lambda a,b,v:(min(a,b),max(a,b),v))(a:=r.randint(1,D),r.randint(a,D),r.randrange(2))]),
    ['10\n2\n1 2 1\n4 10 1\n1\n2 4 0\n','3\n1\n1 3 0\n0\n'],
    [('把 override 当作 OR 合并而不是覆盖','def solve(raw):\n z=list(map(int,raw.split()));p=0;D=z[p];p+=1;u=z[p];p+=1;d=[0]*(D+2)\n for _ in range(u):\n  l,r,v=z[p:p+3];p+=3\n  if v:d[l]+=1;d[r+1]-=1\n o=z[p];p+=1;ov=[None]*(D+1)\n for _ in range(o):\n  l,r,v=z[p:p+3];p+=3\n  for i in range(l,r+1):ov[i]=v\n cur=0;s=[]\n for i in range(1,D+1):cur+=d[i];s.append(str(int(cur>0 or ov[i]==1)))\n return ''.join(s)\n'),
     ('忽略 usage 区间只读 override','def solve(raw):\n z=list(map(int,raw.split()));p=0;D=z[p];p+=1;u=z[p];p+=1;p+=3*u;o=z[p];p+=1;v=[0]*(D+1)\n for _ in range(o):\n  l,r,b=z[p:p+3];p+=3\n  for i in range(l,r+1):v[i]=b\n return ''.join(str(v[i]) for i in range(1,D+1))\n')],
    'Intervals must be fully inside the timeline; overlap between usage intervals is allowed.',
    'Usage 用差分数组求覆盖计数是否大于 0；override 直接按闭区间覆盖。逐日模拟作独立 oracle。时间 O(D+U+覆盖的 override 长度)，空间 O(D)。'))

def chunk_oracle(raw):
    lines=raw.splitlines(); limit=int(lines[0]); doc=lines[1:]; heads=[]; chunks=[]; cur=[]
    for line in doc:
        stripped=line.lstrip()
        if stripped.startswith('#'):
            level=len(stripped)-len(stripped.lstrip('#'))
            heads=heads[:level-1]+[line]
        trial=cur+[line]
        if cur and len(' | '.join(trial))>limit:
            chunks.append(' | '.join(cur)); cur=[]
            if stripped.startswith('#') and line in heads:
                cur=heads[:]
            else: cur=heads+[line] if heads else [line]
        else: cur=trial
    if cur: chunks.append(' | '.join(cur))
    return '\n'.join(chunks)
SPECS.append(make('oa-sierra-1','Sierra','Markdown Header Chunks','按完整行切分 Markdown；新块若从某个标题层级中间开始，先重放当前有效标题路径。展示时用 ` | ` 连接行。',
    '第一行 maxChunkSize（1≤值≤10^5），后续为 Markdown 原文；行不可拆分，输入总长≤10^5。超长内容行单独成块，但仍带上有效标题。',
    '每个 chunk 输出一行，内部行以 ` | ` 连接；空文档输出空内容。',
    "def solve(raw):\n z=raw.splitlines();limit=int(z[0]);doc=z[1:];heads=[];chunks=[];cur=[]\n for line in doc:\n  q=line.lstrip();ishead=q.startswith('#') and (len(q)==len(q.lstrip('#')) or q[len(q)-len(q.lstrip('#'))].isspace())\n  if ishead:\n   level=len(q)-len(q.lstrip('#'));heads=heads[:level-1]+[line]\n  trial=cur+[line]\n  if cur and len(' | '.join(trial))>limit:\n   chunks.append(' | '.join(cur));cur=[];cur=heads[:] if ishead else heads+[line] if heads else [line]\n  else:cur=trial\n if cur:chunks.append(' | '.join(cur))\n return '\\n'.join(chunks)\n",chunk_oracle,
    lambda r: (lambda lim,doc:f'{lim}\n'+doc+'\n')(r.randint(8,45),'\n'.join(r.choice(['# A','## B','plain text','longer line','### C','next']) for _ in range(r.randint(1,10)))),
    ['20\n# A\nshort\nlonger line\n## B\nx\ny\n','30\n# Guide\nalpha\nbeta\n','10\n# X\nvery long line here\n'],
    [('分块时不重放有效标题','def solve(raw):\n z=raw.splitlines();lim=int(z[0]);out=[];cur=[]\n for x in z[1:]:\n  if cur and len(" | ".join(cur+[x]))>lim:out.append(" | ".join(cur));cur=[]\n  cur.append(x)\n if cur:out.append(" | ".join(cur))\n return "\\n".join(out)\n'),
     ('把标题层级全部累加而不截断同级标题','def solve(raw):\n z=raw.splitlines();lim=int(z[0]);h=[];o=[];c=[]\n for x in z[1:]:\n  q=x.lstrip();a=q.startswith("#")\n  if a:h.append(x)\n  if c and len(" | ".join(c+[x]))>lim:o.append(" | ".join(c));c=h[:] if a else h+[x]\n  else:c.append(x)\n if c:o.append(" | ".join(c))\n return "\\n".join(o)\n')],
    '标题以行首首个非空白字符 # 开始；标题级别是连续 # 数量；空白和展示分隔符都计入 chunk 长度。',
    '维护当前标题栈及当前块；超限时输出旧块并用标题栈作为新块前缀。每行只扫描一次，除输出复制外 O(text length)。'))

def observer_oracle(raw):
    z=raw.splitlines();p=0;n=int(z[p]);p+=1;req=list(map(int,z[p].split()));p+=1;f=int(z[p]);p+=1;groups=[]
    for _ in range(f):
        m=int(z[p]);p+=1;groups.append(sorted(map(int,z[p].split())));p+=1
    waste=[]
    for g in groups:
        total=0;ok=True
        for x in req:
            candidates=[v for v in g if v>=x]
            if not candidates:ok=False;break
            total+=min(candidates)-x
        waste.append(total if ok else None)
    possible=[(x,i) for i,x in enumerate(waste) if x is not None]
    return str(min(possible)[1] if possible else -1)
SPECS.append(make('oa-observerai-1','ObserverAI','Choose the Best Flask','选择一种烧杯类型满足全部订单，并使标记容量减订单量的总浪费最小；平局取最小类型编号。',
    'n（1≤n≤2×10^5）；下一行 n 个订单体积（1..10^9）；之后 f（1≤f≤1000），每类烧杯一行：先给标记数，再给升序标记。总标记数≤2×10^5。',
    '输出 0-based 烧杯类型编号；若任何类型都无法满足全部订单，输出 -1。',
    "def solve(raw):\n z=raw.splitlines();p=0;n=int(z[p]);p+=1;req=list(map(int,z[p].split()));p+=1;f=int(z[p]);p+=1;best=None\n for i in range(f):\n  m=int(z[p]);p+=1;a=list(map(int,z[p].split()))[:m];p+=1;j=0;cost=0;ok=True\n  for x in req:\n   while j<m and a[j]<x:j+=1\n   if j==m:ok=False;break\n   cost+=a[j]-x\n  if ok and (best is None or (cost,i)<best):best=(cost,i)\n return str(-1 if best is None else best[1])\n",observer_oracle,
    lambda r: (lambda req,groups:f'{len(req)}\n'+' '.join(map(str,req))+f'\n{len(groups)}\n'+'\n'.join(str(len(g))+'\n'+' '.join(map(str,g)) for g in groups)+'\n')([r.randint(1,15) for _ in range(r.randint(1,8))],[[*sorted(r.randint(1,18) for _ in range(r.randint(1,8)))] for __ in range(r.randint(1,5))]),
    ['4\n4 6 6 7\n3\n3\n3 5 7\n3\n6 8 9\n3\n3 5 6\n','2\n10 11\n1\n2\n1 5\n'],
    [('用最大可容纳值替代每笔最小足够标记','def solve(raw):\n z=raw.splitlines();p=0;n=int(z[p]);p+=1;a=list(map(int,z[p].split()));p+=1;f=int(z[p]);p+=1;b=[]\n for i in range(f):\n  m=int(z[p]);p+=1;g=list(map(int,z[p].split()))[:m];p+=1\n  if all(max(g)>=x for x in a):b.append((sum(max(g)-x for x in a),i))\n return str(min(b)[1] if b else -1)\n'),
     ('平局时选择编号较大的烧杯','def solve(raw):\n z=raw.splitlines();p=0;n=int(z[p]);p+=1;a=list(map(int,z[p].split()));p+=1;f=int(z[p]);p+=1;b=[]\n for i in range(f):\n  m=int(z[p]);p+=1;g=list(map(int,z[p].split()))[:m];p+=1\n  c=[]\n  for x in a:\n   q=[v for v in g if v>=x]\n   if not q:break\n   c.append(min(q)-x)\n  if len(c)==len(a):b.append((sum(c),-i))\n return str(-min(b)[1] if b else -1)\n')],
    '每类标记列表为升序整数；烧杯容量与订单都是正整数，0≤f≤1000，总订单和标记数≤2×10^5。',
    '对每类标记用单调指针为每笔订单找第一个不小于订单量的标记，累计浪费并按 `(浪费,编号)` 取最小。独立 oracle 对每笔订单线性枚举全部标记。'))

def braze_oracle(raw):
    z=raw.splitlines();n,d=map(int,z[0].split());products=[]
    for line in z[1:1+n]:
        p=list(map(str,line.split()));price=int(p[0]);k=int(p[1]);products.append((price,p[2:2+k]))
    disc={}
    for line in z[1+n:1+n+d]:
        tag,t,a=line.split();disc[tag]=(int(t),int(a))
    ans=0
    for price,tags in products:
        vals=[price]
        for tag in tags:
            if tag not in disc:continue
            t,a=disc[tag]
            vals.append(a if t==0 else price*(100-a)//100 if t==1 else price-a)
        ans+=min(vals)
    return str(ans)
def braze_random(r):
    tags=['a','b','c']; products=[]
    for _ in range(r.randint(1,7)):
        products.append((r.randint(5,100),[t for t in tags if r.randrange(2)]))
    floor=min(p for p,_ in products)
    ds=[]
    for t in tags[:r.randint(1,3)]:
        typ=r.randrange(3);ds.append((t,typ,r.randint(0,100) if typ==1 else r.randint(0,floor)))
    return f'{len(products)} {len(ds)}\n'+'\n'.join(f'{p} {len(ts)}'+(' '+' '.join(ts) if ts else '') for p,ts in products)+'\n'+'\n'.join(f'{t} {typ} {v}' for t,typ,v in ds)+'\n'
SPECS.append(make('oa-braze-1','Braze','Shopping Cart Billing','每件商品从原价和所有有效优惠中选最低价；百分比优惠逐件向下取整后再求购物车总额。',
    '第一行商品数 n 与折扣标签数 d（≤1000）。接下来 n 行为 `price tagCount tag...`，无标签时 tagCount=0；再 d 行 `tag type amount`。type=0 是折后价，1 是百分比折扣，2 是固定减价。',
    '输出所有商品最低价之和。标签名唯一；折扣金额非负，百分比≤100，固定减价不超过商品原价。',
    "def solve(raw):\n z=raw.splitlines();n,d=map(int,z[0].split());p=[]\n for line in z[1:1+n]:\n  a=line.split();p.append((int(a[0]),a[2:2+int(a[1])]))\n disc={}\n for line in z[1+n:1+n+d]:\n  k,t,v=line.split();disc[k]=(int(t),int(v))\n total=0\n for price,tags in p:\n  best=price\n  for tag in tags:\n   if tag not in disc:continue\n   t,v=disc[tag];x=v if t==0 else price*(100-v)//100 if t==1 else price-v;best=min(best,x)\n  total+=best\n return str(total)\n",braze_oracle,
    braze_random,
    ['2 2\n10 2 sale pct\n7 1 sale\nsale 2 3\npct 1 50\n','1 1\n11 0\nflat 0 4\n'],
    [('忽略折扣标签，仅收原价','def solve(raw):\n z=raw.splitlines();n=int(z[0].split()[0]);return str(sum(int(z[i].split()[0]) for i in range(1,n+1)))\n'),
     ('百分比折扣使用四舍五入而不是向下取整','def solve(raw):\n z=raw.splitlines();n,d=map(int,z[0].split());p=[]\n for line in z[1:1+n]:\n  a=line.split();p.append((int(a[0]),a[2:2+int(a[1])]))\n D={}\n for line in z[1+n:1+n+d]:\n  t,k,v=line.split();D[t]=(int(k),int(v))\n s=0\n for price,tags in p:\n  c=[price]\n  for t in tags:\n   if t in D:\n    k,v=D[t];c.append(v if k==0 else round(price*(100-v)/100) if k==1 else price-v)\n  s+=min(c)\n return str(s)\n')], 'Product descriptors are one line each; tags are whitespace-free identifiers; all values are integers.',
    '枚举原价及所有有效标签计算出的价格，逐件取最小值。百分比为 `floor(price×(100−percent)/100)`；固定减价范围受限于商品原价，因此无负价格歧义。'))

def verkada_oracle(raw):
    z=raw.splitlines();root=tuple(x for x in z[0].rstrip('/').split('/') if x);n=int(z[1]);found=[]
    for line in z[2:2+n]:
        path,content=line.split('\t',1);parts=tuple(x for x in path.rstrip('/').split('/') if x)
        if len(parts)<=len(root) or parts[:len(root)]!=root:continue
        for token in content.split():
            a=token.split('.')
            if len(a)==4 and all(x.isascii() and x.isdigit() and (x=='0' or not x.startswith('0')) and 0<=int(x)<=255 for x in a):found.append(token)
    return '\n'.join(sorted(found))
SPECS.append(make('oa-verkada-1','Verkada','Find Valid IP Addresses','递归扫描 root 下文件里的空白分隔 token，收集合法 IPv4 地址并按字典序排序，重复项保留。',
    '第一行 root 路径；第二行文件数 f（≤2×10^5）；后续每行 `path<TAB>content`，路径为绝对 POSIX 路径，文件内容不含制表符，总字符数≤10^6。',
    '每个地址一行；无结果输出空内容。',
    "def solve(raw):\n import os,re\n z=raw.splitlines();root=os.path.normpath(z[0]);n=int(z[1]);out=[]\n for line in z[2:2+n]:\n  path,content=line.split('\\t',1);p=os.path.normpath(path)\n  try:inside=os.path.commonpath([root,p])==root and p!=root\n  except ValueError:inside=False\n  if not inside:continue\n  for t in content.split():\n   a=t.split('.')\n   if len(a)==4 and all(x.isascii() and x.isdigit() and (x=='0' or not x.startswith('0')) and int(x)<=255 for x in a):out.append(t)\n return '\\n'.join(sorted(out))\n",verkada_oracle,
    lambda r: (lambda root,files:f'{root}\n{len(files)}\n'+'\n'.join(p+'\t'+c for p,c in files)+'\n')('/data',[(r.choice(['/data/a','/data/sub/b','/database/no']),r.choice(['ip 1.2.3.4 bad 01.2.3.4','255.255.255.255 256.0.0.1','repeat 1.1.1.1 1.1.1.1'])) for _ in range(r.randint(1,8))]),
    ['/var/log\n3\n/var/log/a\tclient 10.1.1.1 backup 256.1.1.1\n/var/log/sub/b\t192.168.0.1 01.2.3.4\n/tmp/x\t8.8.8.8\n','/data\n1\n/database/a\t1.1.1.1\n'],
    [('用字符串前缀判断目录归属','def solve(raw):\n z=raw.splitlines();root=z[0].rstrip("/");out=[]\n for l in z[2:]:\n  p,c=l.split("\\t",1)\n  if p.startswith(root):\n   for t in c.split():\n    a=t.split(".")\n    if len(a)==4 and all(x.isdigit() and int(x)<=255 and (x=="0" or not x.startswith("0")) for x in a):out.append(t)\n return "\\n".join(sorted(out))\n'),
     ('允许带前导零的八位组','def solve(raw):\n z=raw.splitlines();root=z[0].rstrip("/");o=[]\n for l in z[2:]:\n  p,c=l.split("\\t",1)\n  if p.startswith(root+"/"):\n   for t in c.split():\n    a=t.split(".")\n    if len(a)==4 and all(x.isdigit() and int(x)<=255 for x in a):o.append(t)\n return "\\n".join(sorted(o))\n')],
    'root 下级按完整 POSIX 路径组件判断，不包含 root 同名字符串前缀；IP 每段只允许十进制数字，前导零仅允许单独的 0。',
    '路径用 `commonpath` 判断严格后代；逐 token 检查 4 个十进制 octet；保留重复 token 后排序。时间 O(输入长度+结果排序)。'))

def oscar_oracle(raw):
    z=raw.splitlines();P,M,d=map(int,z[0].split());prov=[]
    for line in z[1:1+P]:
        i,s,x,y=line.split();prov.append((s,int(x),int(y)))
    out=[]
    for line in z[1+P:1+P+M]:
        mid,x,y,req=line.split();x=int(x);y=int(y)
        if any(not any(s==need and (px-x)**2+(py-y)**2<=d*d for s,px,py in prov) for need in req.split('|')):out.append(int(mid))
    return '\n'.join(map(str,sorted(out)))
SPECS.append(make('oa-oscar-health-1','Oscar Health','Members Lacking Provider Network Access','若会员任一必需 specialty 没有在最大欧氏距离内的服务者，则报告该会员。',
    '首行 provider 数 P、member 数 M（均≤1000）、整数 maxDistance（≤10^9）；接着 P 行 `providerId specialty x y`，再 M 行 `memberId x y specialty|specialty...`。坐标和 ID 为整数，specialty 不含空格；memberId 唯一，每位会员必需 specialty 总数≤10。',
    '输出无法获得充分网络服务的 memberId，升序，每行一个；没有时输出空内容。',
    "def solve(raw):\n z=raw.splitlines();P,M,d=map(int,z[0].split());by={}\n for line in z[1:1+P]:\n  i,s,x,y=line.split();by.setdefault(s,[]).append((int(x),int(y)))\n ans=[]\n for line in z[1+P:1+P+M]:\n  mid,x,y,req=line.split();x=int(x);y=int(y);bad=False\n  for s in req.split('|'):\n   if not any((a-x)**2+(b-y)**2<=d*d for a,b in by.get(s,[])):bad=True;break\n  if bad:ans.append(int(mid))\n return '\\n'.join(map(str,sorted(ans)))\n",oscar_oracle,
    lambda r: (lambda prov,mem,d:f'{len(prov)} {len(mem)} {d}\n'+'\n'.join(' '.join(map(str,p)) for p in prov)+'\n'+'\n'.join(' '.join(map(str,m)) for m in mem)+'\n')([(i,r.choice(['Card','Dental']),r.randint(-10,10),r.randint(-10,10)) for i in range(r.randint(1,7))],[(100+i,r.randint(-10,10),r.randint(-10,10),r.choice(['Card','Dental','Card|Dental'])) for i in range(r.randint(1,7))],r.randint(0,12)),
    ['2 2 5\n1 Cardiology 1 2\n2 Dermatology 3 4\n101 2 3 Cardiology|Dermatology\n102 10 10 Cardiology\n','1 1 5\n1 Cardiology 0 0\n7 3 4 Cardiology\n'],
    [('忽略距离条件并只检查 specialty 是否存在','def solve(raw):\n z=raw.splitlines();P,M,d=map(int,z[0].split());s={l.split()[1] for l in z[1:1+P]};o=[]\n for l in z[1+P:]:\n  m,x,y,q=l.split()\n  if any(t not in s for t in q.split("|")):o.append(int(m))\n return "\\n".join(map(str,sorted(o)))\n'),
     ('把距离上限误作严格小于','def solve(raw):\n z=raw.splitlines();P,M,d=map(int,z[0].split());g={}\n for l in z[1:1+P]:\n  _,s,x,y=l.split();g.setdefault(s,[]).append((int(x),int(y)))\n o=[]\n for l in z[1+P:]:\n  m,x,y,q=l.split();x=int(x);y=int(y)\n  if any(not any(s==t and (a-x)**2+(b-y)**2<d*d for s,a,b in [(s,a,b) for s,vs in g.items() for a,b in vs]) for t in q.split("|")):o.append(int(m))\n return "\\n".join(map(str,sorted(o)))\n')],
    '坐标为整数，可用平方距离比较以避免浮点误差；距离边界包含等于 maxDistance。',
    '按 specialty 建 provider 坐标索引。每名会员逐项检查所需 specialty 是否存在平方距离不超过 d² 的 provider。时间 O(P+M·R·P_s)，其中 P_s 是相关 specialty provider 数。'))

def oura_oracle(raw):
    lines=raw.splitlines();q=int(lines[0]);used={};out=[]
    for line in lines[1:1+q]:
        p=line.split();typ=p[1];s=used.setdefault(typ,set())
        if p[0]=='allocate':
            x=1
            while x in s:x+=1
            s.add(x);out.append(x)
        else:s.remove(int(p[2]))
    return '\n'.join(map(str,out))
def oura_random(r):
    ops=[];live={}
    for _ in range(r.randint(2,12)):
        t=r.choice(['a','b']);live.setdefault(t,[])
        if live[t] and r.randrange(3)==0:
            v=r.choice(live[t]);live[t].remove(v);ops.append(f'deallocate {t} {v}')
        else:
            v=1
            while v in live[t]:v+=1
            ops.append(f'allocate {t}');live[t].append(v)
    return f'{len(ops)}\n'+'\n'.join(ops)+'\n'
SPECS.append(make('oa-oura-1','Oura','Assign Server Numbers by Type','每种服务器类型各自编号；分配时使用当前未占用的最小正整数，释放后该编号可重新使用。',
    '第一行 q（1≤q≤2×10^5），后续 q 行为 `allocate type` 或 `deallocate type id`。类型名无空格；释放的 id 保证当前已分配。',
    '每个 allocate 的编号各输出一行。',
    "def solve(raw):\n import heapq\n z=raw.splitlines();q=int(z[0]);free={};used={};nxt={};out=[]\n for line in z[1:1+q]:\n  p=line.split();t=p[1]\n  if t not in free:free[t]=[];used[t]=set();nxt[t]=1\n  if p[0]=='allocate':\n   if free[t]:x=heapq.heappop(free[t])\n   else:x=nxt[t];nxt[t]+=1\n   used[t].add(x);out.append(str(x))\n  else:\n   x=int(p[2]);used[t].remove(x);heapq.heappush(free[t],x)\n return '\\n'.join(out)\n",oura_oracle,
    oura_random,
    ['8\nallocate db\nallocate db\nallocate cache\ndeallocate db 1\nallocate db\nallocate cache\ndeallocate cache 1\nallocate cache\n','4\nallocate a\ndeallocate a 1\nallocate a\nallocate b\n'],
    [('每种 type 永远递增编号，不复用释放编号','def solve(raw):\n z=raw.splitlines();q=int(z[0]);n={};o=[]\n for l in z[1:]:\n  p=l.split();t=p[1]\n  if p[0]=="allocate":n[t]=n.get(t,0)+1;o.append(str(n[t]))\n return "\\n".join(o)\n'),
     ('不同类型共用一个编号池','def solve(raw):\n z=raw.splitlines();q=int(z[0]);s=set();n=1;o=[]\n for l in z[1:]:\n  p=l.split()\n  if p[0]=="allocate":\n   while n in s:n+=1\n   s.add(n);o.append(str(n));n+=1\n  else:s.discard(int(p[2]))\n return "\\n".join(o)\n')],
    '请求不超过 2×10^5；编号池按 type 独立，释放操作合法。',
    '每个类型维护最小堆的已释放编号和下一个新编号。allocate 取堆顶或新编号，deallocate 将编号放回堆。集合扫描独立 oracle 每次从 1 开始寻找空位。'))

def toshiba_oracle(raw):
    z=list(map(int,raw.split()));n=z[0];ans=0
    for x in z[1:1+n]:
        cur={x};steps=0
        while not any(y%3==0 for y in cur):
            steps+=1;cur={v+1 for v in cur}|{v-1 for v in cur}
        ans+=steps
    return str(ans)
SPECS.append(make('oa-toshiba-1','Toshiba','Minimize Multiples Of Three','允许一次操作给一个数加 1 或减 1，求使每个数组元素都能被 3 整除所需的最少总操作数。',
    '第一行 n（1≤n≤2×10^5），第二行 n 个整数（|a[i]|≤10^9）。',
    '输出最少操作数。',
    "def solve(raw):\n z=list(map(int,raw.split()));n=z[0];return str(sum(min(x%3,3-x%3) for x in z[1:1+n]))\n",toshiba_oracle,
    lambda r: (lambda a:f'{len(a)}\n'+' '.join(map(str,a))+'\n')([r.randint(-30,30) for _ in range(r.randint(1,30))]),
    ['4\n12 21 3 4\n','2\n4 5\n','3\n-2 0 7\n'],
    [('将余数 r 直接当作需要的操作数','def solve(raw):\n z=list(map(int,raw.split()));return str(sum(x%3 for x in z[1:]))\n'),
     ('只允许向上加到下一个 3 倍数','def solve(raw):\n z=list(map(int,raw.split()));return str(sum((-x)%3 for x in z[1:]))\n')],
    '一次操作严格为对一个元素执行 +1 或 -1；数组值可为负数。',
    '对每个数的模 3 余数 r，最少改变量为 `min(r,3-r)`；相加即得答案。独立 oracle 逐步模拟 +1/-1 的可达集合。'))

def publicis_oracle(raw):
    z=list(map(int,raw.split()));n=z[0];boxes=z[1:1+n];return str(sum(sum(1 for _ in range(b))*(2*(n-i)+1) for i,b in enumerate(boxes)))
SPECS.append(make('oa-publicis-sapient-1','Publicis Sapient','Get Minimum Time','从每层分别往返顶层搬运该层箱子；每件箱子对应一次往返以及 1 分钟装卸。',
    '第一行 n（1≤n≤10^5），第二行 n 个非负整数 boxes[i]（≤10^9），下标 i 对应楼层 i，顶层为 n。',
    '输出最少总分钟数（整数可超过 32 位）。',
    "def solve(raw):\n z=list(map(int,raw.split()));n=z[0];a=z[1:1+n];return str(sum(b*(2*(n-i)+1) for i,b in enumerate(a)))\n",publicis_oracle,
    lambda r: (lambda a:f'{len(a)}\n'+' '.join(map(str,a))+'\n')([r.randint(0,8) for _ in range(r.randint(1,15))]),
    ['4\n2 1 0 1\n','1\n0\n','3\n0 0 2\n'],
    [('漏掉装卸时间','def solve(raw):\n z=list(map(int,raw.split()));n=z[0];return str(sum(b*2*(n-i) for i,b in enumerate(z[1:1+n])))\n'),
     ('所有楼层按最远楼层的往返耗时计算','def solve(raw):\n z=list(map(int,raw.split()));n=z[0];return str(sum(z[1:1+n])*(2*n+1))\n')],
    '每次只访问一个楼层再返回顶层；箱子可任意多次重复往返。',
    '楼层 i 的每个箱子需 `2(n−i)` 分钟往返和 1 分钟装卸，成本线性相加即可。时间 O(n)，常数额外空间。'))

def catalan_oracle(raw):
    import math
    n=int(raw.split()[0]);return str((math.comb(2*n,n)//(n+1))%10000)
SPECS.append(make('oa-commvault-1','Commvault','Count Good Strings','统计长度 2N、A/B 各 N 个且任意前缀 A 数不少于 B 数的字符串数量，模 10000。',
    '输入整数 N（1≤N≤1000）。',
    '输出合法字符串数量对 10000 取模。',
    "def solve(raw):\n n=int(raw.split()[0]);d=[[0]*(n+1) for _ in range(n+1)];d[0][0]=1\n for a in range(n+1):\n  for b in range(a+1):\n   if a<n:d[a+1][b]=(d[a+1][b]+d[a][b])%10000\n   if b<a and b<n:d[a][b+1]=(d[a][b+1]+d[a][b])%10000\n return str(d[n][n])\n",catalan_oracle,
    lambda r:str(r.randint(1,1000))+'\n', ['3\n','1\n','4\n'],
    [('允许前缀中 B 多于 A','def solve(raw):\n n=int(raw.split()[0]);return str(2**(2*n) % 10000)\n'),
     ('忘记对 10000 取模','def solve(raw):\n n=int(raw.split()[0]);d=[1]+[0]*n\n for a in range(n+1):\n  for b in range(n):\n   if b<a:d[b+1]+=d[b]\n return str(d[n]+1)\n')],
    'N≤1000，输出模数固定为 10000。',
    '用格点路径动态规划：A 使 a 增加，B 仅在 b<a 时使 b 增加；到 (N,N) 的路径数即合法串数量。递归枚举短串作独立 oracle。'))

MOD=1000000007
def cities_oracle(raw):
    n,k=map(int,raw.split());prev=[0]+[1]*k
    for _ in range(2,n+1):
        cur=[0]*(k+1)
        for v in range(1,k+1):cur[v]=sum(prev[1:v//2+1])%MOD
        prev=cur
    return str(sum(prev)%MOD)
SPECS.append(make('oa-commvault-2','Commvault','Count Ways to Travel Cities','数长度恰为 N 的城市序列；首城不限，此后每个城市编号至少是前一城的两倍，所有编号不超过 K。',
    '输入 N K（1≤N≤100，1≤K≤20000）。城市编号范围为 1..K。',
    '输出符合条件的有序序列数，模 1,000,000,007。',
    "def solve(raw):\n n,k=map(int,raw.split());prev=[0]*(k+1)\n for x in range(1,k+1):prev[x]=1\n for _ in range(2,n+1):\n  pref=[0]*(k+1)\n  for x in range(1,k+1):pref[x]=(pref[x-1]+prev[x])%1000000007\n  cur=[0]*(k+1)\n  for x in range(1,k+1):cur[x]=pref[x//2]\n  prev=cur\n return str(sum(prev)%1000000007)\n",cities_oracle,
    lambda r:f'{r.randint(1,8)} {r.randint(1,40)}\n', ['3 10\n','1 8\n','4 1\n'],
    [('漏掉从任意城市开始的选择，只允许从城市 1 开始','def solve(raw):\n n,k=map(int,raw.split());d=[0]*(k+1);d[1]=1\n for _ in range(2,n+1):\n  q=[0]*(k+1)\n  for i in range(1,k+1):\n   for j in range(2*i,k+1):q[j]=(q[j]+d[i])%1000000007\n  d=q\n return str(sum(d)%1000000007)\n'),
     ('把下一城市下界写成前一编号加一','def solve(raw):\n n,k=map(int,raw.split());d=[0]+[1]*k\n for _ in range(2,n+1):\n  q=[0]*(k+1);s=0\n  for j in range(1,k+1):s=(s+d[j-1])%1000000007;q[j]=s\n  d=q\n return str(sum(d)%1000000007)\n')],
    '城市序列有序；N≤100、K≤20000，动态规划 O(NK)；题面示例输出 TODO，不作为校验样例。',
    'dp[len][v] 表示最后一城为 v 的序列数。下一步 v 可由任意 ≤floor(v/2) 的末城转移，用前缀和优化至 O(NK)。小 K 下递归枚举所有序列独立校验。'))

def goodpairs_oracle(raw):
    z=list(map(int,raw.split()));n,m=z[:2];edges=list(zip(z[2::2],z[3::2]))[:m];g=[[] for _ in range(n)]
    for a,b in edges:a-=1;b-=1;g[a].append(b);g[b].append(a)
    comp=[-1]*n;c=0
    for s in range(n):
        if comp[s]>=0:continue
        st=[s];comp[s]=c
        while st:
            x=st.pop()
            for y in g[x]:
                if comp[y]<0:comp[y]=c;st.append(y)
        c+=1
    return str(sum(comp[i]!=comp[j] for i in range(n) for j in range(i+1,n)))
SPECS.append(make('oa-commvault-3','Commvault','Number of Good Pairs','在无向图中统计端点属于不同连通分量的无序节点对数。',
    '输入 N M（1≤N≤65,535，0≤M≤2×10^5），随后 M 行边 u v（1-based，1≤u,v≤N）。允许重复边与自环，结果可安全放入有符号 32 位整数。',
    '输出 good pair 数量（64 位整数）。',
    "def solve(raw):\n z=list(map(int,raw.split()));n,m=z[:2];p=list(range(n));sz=[1]*n\n def find(x):\n  while p[x]!=x:p[x]=p[p[x]];x=p[x]\n  return x\n for i in range(m):\n  a,b=z[2+2*i]-1,z[3+2*i]-1;a=find(a);b=find(b)\n  if a!=b:\n   if sz[a]<sz[b]:a,b=b,a\n   p[b]=a;sz[a]+=sz[b]\n ans=n*(n-1)//2\n for i in range(n):\n  if p[i]==i:ans-=sz[i]*(sz[i]-1)//2\n return str(ans)\n",goodpairs_oracle,
    lambda r:(lambda n,e:f'{n} {len(e)}\n'+'\n'.join(f'{a} {b}' for a,b in e)+'\n')((n:=r.randint(1,12)),[(r.randint(1,n),r.randint(1,n)) for _ in range(r.randint(0,20))]),
    ['5 3\n1 2\n2 3\n4 5\n','4 0\n','1 2\n1 1\n1 1\n'],
    [('只统计输入中直接没有边相连的点对','def solve(raw):\n z=list(map(int,raw.split()));n,m=z[:2];e={tuple(sorted((z[2+2*i],z[3+2*i]))) for i in range(m)};return str(sum((i,j) not in e for i in range(1,n+1) for j in range(i+1,n+1)))\n'),
     ('把连通分量内部点对当作 good pair','def solve(raw):\n z=list(map(int,raw.split()));n,m=z[:2];p=list(range(n))\n def f(x):\n  if p[x]!=x:p[x]=f(p[x])\n  return p[x]\n for i in range(m):\n  a=f(z[2+2*i]-1);b=f(z[3+2*i]-1);p[a]=b\n return str(sum(f(i)==f(j) for i in range(n) for j in range(i+1,n)))\n')],
    '节点编号 1..N；边视为无向；结果最大可达 N(N−1)/2，需 64 位整数。',
    '并查集构造连通分量大小；从全部无序点对中减去每个连通分量内部组合数。独立 oracle 建图并做 DFS 后直接枚举点对。'))

def epifi_oracle(raw):
    z=list(map(int,raw.split()));n=z[0];req=z[1:1+n];cap=[x-1 for x in z[1+n:1+2*n]]
    if sum(req)>sum(cap):return '-1'
    units=[i for i,x in enumerate(req) for _ in range(x)]
    def possible(d):
        used=[0]*n
        def assign(k):
            if k==len(units):return True
            i=units[k]
            for j in range(n):
                if abs(i-j)<=d and used[j]<cap[j]:
                    used[j]+=1
                    if assign(k+1):return True
                    used[j]-=1
            return False
        return assign(0)
    return str(next((d for d in range(n) if possible(d)),-1))
def epifi_random(r):
    n=r.randint(1,7);req=[r.randint(0,2) for _ in range(n)];cap=[r.randint(1,4) for _ in range(n)]
    return f'{n}\n'+' '.join(map(str,req))+'\n'+' '.join(str(x+1) for x in cap)+'\n'
SPECS.append(make('oa-epifi-1','Epifi','Request Redirection','把请求分配到可服务的服务器；每台最终负载必须严格小于 max_req，最小化最大跨服务器距离。',
    '第一行 n（1≤n≤10^5），第二行 requests[n]，第三行 max_req[n]，均为非负/正整数且≤10^9。服务器位置按数组下标排列。',
    '输出最小可能的最大重定向距离；总容量不足时输出 -1。',
    "def solve(raw):\n z=list(map(int,raw.split()));n=z[0];req=z[1:1+n];cap=[x-1 for x in z[1+n:1+2*n]]\n if sum(req)>sum(cap):return '-1'\n def ok(d):\n  i=j=0;a=req[:];b=cap[:] \n  while i<n and j<n:\n   while i<n and a[i]==0:i+=1\n   while j<n and b[j]==0:j+=1\n   if i==n or j==n:break\n   if j<i and i-j>d:j+=1;continue\n   if i<j and j-i>d:return False\n   x=min(a[i],b[j]);a[i]-=x;b[j]-=x\n  return all(x==0 for x in a)\n lo,hi=0,n-1\n while lo<hi:\n  mid=(lo+hi)//2\n  if ok(mid):hi=mid\n  else:lo=mid+1\n return str(lo if ok(lo) else -1)\n",epifi_oracle,epifi_random,
    ['2\n5 0\n4 10\n','3\n2 2 0\n2 2 5\n','2\n4 4\n3 3\n'],
    [('把严格小于 max_req 错作不大于','def solve(raw):\n z=list(map(int,raw.split()));n=z[0];a=z[1:1+n];b=z[1+n:1+2*n]\n return str(-1 if sum(a)>sum(b) else 0)\n'),
     ('限制每个请求只能移动到相邻服务器','def solve(raw):\n z=list(map(int,raw.split()));n=z[0];a=z[1:1+n];b=[x-1 for x in z[1+n:1+2*n]]\n if sum(a)>sum(b):return "-1"\n for d in range(n):\n  x=a[:];y=b[:];ok=True\n  for i in range(n):\n   while x[i]:\n    j=next((j for j in range(n) if abs(i-j)<=1 and y[j]),None)\n    if j is None:ok=False;break\n    t=min(x[i],y[j]);x[i]-=t;y[j]-=t\n   if not ok:break\n  if ok:return str(d)\n return "-1"\n')],
    'Requests 与 max_req 均长度 n；requests[i]≥0，max_req[i]≥1。max_req 为严格上限，因此每台最终容量是 max_req[i]−1。一次请求可以从原服务器送到任意一个接收服务器。',
    '对最大距离二分。固定距离时，来源与接收服务器形成区间二分图；按位置贪心匹配最左剩余请求和最左剩余容量，若过远即判失败。小规模 oracle 穷举每个请求的去向。'))

def normalize_specs():
    for s in SPECS:
        if s['id']=='oa-crusoe-1':
            s['solve']=s['solve'].replace('str(cur>0 if over[i] is None else over[i])','str(int(cur>0) if over[i] is None else over[i])')
            s['mutants']=[(name,code.replace('return .join(s)',"return ''.join(s)").replace('return .join(str(v[i])',"return ''.join(str(v[i])")) for name,code in s['mutants']]
        if s['id']=='oa-sierra-1':
            s['solve']=s['solve'].replace("ishead=q.startswith('#') and (len(q)==len(q.lstrip('#')) or q[len(q)-len(q.lstrip('#'))].isspace())","ishead=q.startswith('#')")
        if s['id']=='oa-datadog-1':
            s['input']=s['input'].replace('2×10^5','5000 (本站为保证直接查询的时间上限)')
            s['input']=s['input'].replace('5000 (本站为保证直接查询的时间上限)','5000，本站为保证直接查询的时间上限')
        if s['id']=='oa-f5-1':
            s['input']=s['input'].replace('文本总长≤10^6','文本总长≤10^6，时间戳与时间窗非负且≤10^9')
        if s['id']=='oa-ge-vernova-1':
            s['limits']=s['limits'].replace('n≤1500','n≤800')
        if s['id']=='oa-observerai-1':
            s['input']=s['input'].replace('n（1≤n≤2×10^5）','n（1≤n≤1000）')
            s['solve']=s['solve'].replace('req=list(map(int,z[p].split()));p+=1;f=int(z[p]);p+=1;best=None','req=list(map(int,z[p].split()));p+=1;req.sort();f=int(z[p]);p+=1;best=None')
        if s['id']=='oa-oscar-health-1':
            s['input']=s['input'].replace('provider 数 P、member 数 M、整数 maxDistance（≤10^9）','provider 数 P、member 数 M（均≤1000）、整数 maxDistance（≤10^9）')
        if s['id']=='oa-f5-1':
            s['mutants']=[(name,code if 'import re' in code else 'import re\n'+code) for name,code in s['mutants']]
        if s['id']=='oa-observerai-1':
            s['input']=s['input'].replace('n≤2×10^5','n≤1000')
        if s['id']=='oa-oscar-health-1':
            s['input']=s['input'].replace('P≤1×10^5, M≤1×10^5','P,M≤1000')
        if s['id']=='oa-epifi-1':s['solve']=s['solve'].replace('b=cap[:] ','b=cap[:]')
        if s['id']=='oa-sierra-1':s['checker']='exact'

normalize_specs()

BLOCKED = {
    'oa-sentry-2': '这是 Part 2 摘要，未完整保留 Part 1 的网格移动、墙体输入与边界规则；无法仅凭当前固定快照唯一确定标准输入输出契约。',
    'oa-sigma-computing-1': '题面要求实现带安全/存储限制的类与方法，但固定快照未提供 starter classes、公开 API、调用协议或操作顺序；无法转成稳定的 stdin/stdout 评测。',
    'oa-thoughtspot-1': '固定快照在 `for all 1` 处截断了请求缓存定义，缺少服务处理时间/负载目标规则；示例不足以唯一确定最小时间。',
    'oa-epic-1': '题干被截断，且示例没有定义结果顺序、重复回文是否保留及是否输出每次出现；同一字符串可产生不同合法输出。',
    'oa-ibm-frontend-2': '这是要求修改 CSS 并在浏览器验证布局的前端任务，不是当前算法 OJ 支持的标准输入输出题；缺少 DOM/CSS 渲染器与视觉 checker。',
    'oa-box-3': '示例的 startIndex=1 与 target=banana 指向当前位置，规则应返回 0，但样例输出 1，解释又改称目标为 index 0 的 originalart；源题相互矛盾。',
    'oa-moveworks-3': '示例输出第一组为 153，但题面解释明确计算 5³+8³=637；另一个区间的说明也未验证输出。无法选择应服从哪一个结果。',
    'oa-codeium-1': '固定快照在条件 `for each 0` 处截断，缺少完整约束和边界可行性定义；无法确定目标序列大小界及无解判定边界。',
    'oa-trend-micro-2': '要求判断一个数是否是任意含数字 7 的整数之倍数，但没有输入上界；直接枚举所有潜在因子/后继数无法给出可信的在线评测复杂度界。',
    'oa-whatnot-1': '相同 user/time 的日志如何排序未定义，而不同顺序会改变旅程 Trie；描述还要求缩进两空格，例子却以单空格展示。',
    'oa-accenture-1': '没有说明 numStr 的有效字符/前导零规范、无解时返回什么，以及“最小数字”是否按规范化整数比较；这些都会改变结果。',
    'oa-epam-1': '没有明确 robber 可按什么顺序访问房屋、是否只能沿相邻房屋行走、重复访问的限制以及距离数组对应关系；样例不能确定完整路径模型。',
    'oa-meesho-1': '题目要求统计“字符序列不同”的受边界约束子序列；来源没有明确定义删去后前缀路径越界时是忽略还是反射，且缺少可直接实现的状态/复杂度说明。',
    'oa-hyperverge-1': '操作定义称可替换 A 或 B，但样例说明 `(-1,0)` 经过操作仍保持原状态；替换 B 实际会得到 `(-1,-1)`。此外 1e10 范围下最少操作搜索未给约束/策略。',
    'oa-cvent-1': '样例暗示 arr 按 1-based 的 size 索引，但没有定义 arr 长度与可删除块长度的关系，也没有任何 n/字符串约束；任意拆分合并需要不同复杂度模型。',
    'oa-onix-1': '同一 S、X 可能对应不同被删字符串，例如 S=`aba`, X=`a` 可删 `ab` 或 `ba`；题目没有规定返回哪一个，精确输出不唯一。',
}

REVIEW_IDS = [
    'oa-datadog-1','oa-sentry-2','oa-arista-networks-1','oa-f5-1','oa-sigma-computing-1','oa-thoughtspot-1',
    'oa-guidewire-1','oa-epic-1','oa-ibm-frontend-2','oa-box-3','oa-ge-vernova-1','oa-crusoe-1','oa-moveworks-3',
    'oa-sierra-1','oa-codeium-1','oa-observerai-1','oa-braze-1','oa-verkada-1','oa-trend-micro-2','oa-whatnot-1',
    'oa-oscar-health-1','oa-oura-1','oa-toshiba-1','oa-accenture-1','oa-epam-1','oa-publicis-sapient-1','oa-meesho-1',
    'oa-hyperverge-1','oa-epifi-1','oa-cvent-1','oa-commvault-3','oa-onix-1',
]

PROOFS = {
 'oa-datadog-1':'每个 ADD 都恰好进入日志表一次。对 QUERY，算法检查表中每条记录是否同时满足闭区间、两个可选等值过滤和关键字包含条件；满足者计一次，不满足者不计，因此结果与定义相同。',
 'oa-arista-networks-1':'按行优先遍历时，维护的累计和始终等于 A 中当前格及其之前所有格的和；写入 B 的该位置正是题目要求的前缀和。',
 'oa-f5-1':'扫描只在有效时间窗内识别完整 hashtag，并对每个出现位置计数一次；排序键与题目要求的频次降序、字典序升序完全一致，取前三项即为答案。',
 'oa-guidewire-1':'考虑从左到右第一个尚未被男孩覆盖的女孩。任何可行解必须在她左或右的空位放男孩；若右位可放，将某个最优解中的左位男孩移到右位不会增加人数且还能覆盖后续女孩。若右位不可用，只能选左位。逐次交换后贪心选择与某个最优解一致。',
 'oa-ge-vernova-1':'长度为 t、以 i 结尾的 dp 值枚举所有前驱 j<i，转移 `dp[t−1][j]+|a[i]−a[j]|` 覆盖全部合法子序列。按值分割 j 的取值后，两个范围最小值分别由线段树维护；取所有长度 k 结尾的最小值即为全局最优。',
 'oa-crusoe-1':'差分前缀和在每一天等于覆盖该日的所有值为 1 的 usage 区间数，是否大于零即为默认状态。override 不相交且优先级最高，因此逐日以 override 值替换默认状态恰好得到最终状态。',
 'oa-sierra-1':'逐行处理保证行序和不可拆分约束；标题栈始终等于当前位置有效的 Markdown 标题路径。当前块超长时切开，新块加上该栈作为上下文前缀，因此内容不丢失且续块上下文正确。',
 'oa-observerai-1':'对一个烧杯，升序标记中首个不小于订单量的标记是该单可选的最小容量，任何更大标记只会增加浪费。逐单累加此最小差值，再在可满足全部订单的烧杯中按浪费和编号排序，得到全局最优。',
 'oa-braze-1':'不同商品之间没有共享折扣预算或联动条件，因此总价最小化可分解为逐件独立最小化。枚举原价及每个有效标签价并向下取整百分比价后取最小，所得总和即全局最小。',
 'oa-verkada-1':'路径组件前缀判定恰好选中 root 的严格后代文件。每个 token 按定义检查四段、十进制形式、前导零和数值范围；保留所有有效出现后排序，既不漏项也不引入无效项。',
 'oa-oscar-health-1':'会员达标当且仅当其每个必需 specialty 至少有一个 provider 距离不超过上限。算法逐个 specialty 检查该存在性；只要有一个缺失就加入结果，最后排序仅影响展示顺序。',
 'oa-oura-1':'每种类型单独维护最小堆的已释放编号和从未使用编号的递增指针；堆顶是所有已释放编号中最小者，若无释放编号则新编号必然最小。释放后入堆即可保证后续分配满足规则。',
 'oa-toshiba-1':'余数为 0 不需操作；余数为 1 时减一只需一步，余数为 2 时加一只需一步。任何一步至多改变余数到相邻模类，故非零余数至少一步；对所有元素求和即最小总操作数。',
 'oa-publicis-sapient-1':'位于楼层 i 的每个箱子必须完成一次该层至顶层再返回的往返，耗时 `2(n−i)`，另加 1 分钟装卸。不同箱子的往返互不共享，所有固定成本相加即为唯一总时间，也是最小时间。',
 'oa-epifi-1':'固定距离 d 时，每个来源只能匹配位置区间 [i−d,i+d] 的容量。最左未匹配来源与最左未匹配容量若相距超限，左侧对象不可能与更靠右/左的后续对象匹配；否则优先匹配不会减少后续可行选择。该区间图贪心判定可行性单调，二分得到最小 d。',
 'oa-commvault-3':'并查集按边合并后，每个根准确代表一个连通分量。全部无序点对数减去每个分量内部的组合数，剩余且仅剩端点在不同分量的点对。',
}

COMPLEXITIES = {
 'oa-datadog-1':'O(q·L) 时间、O(L) 空间，L 为已写入日志数。',
 'oa-arista-networks-1':'O(mn) 时间；除输出矩阵外 O(1) 额外空间。',
 'oa-f5-1':'O(T + H log H) 时间、O(H) 空间，T 为扫描文本长度，H 为不同标签数。',
 'oa-guidewire-1':'O(n) 时间、O(n) 空间。',
 'oa-ge-vernova-1':'O(kn log n) 时间、O(n) 空间。',
 'oa-crusoe-1':'O(D + U + O) 时间、O(D) 空间；override 区间不相交。',
 'oa-sierra-1':'O(T) 时间与输出空间，T 为 Markdown 总字符数（标题上下文重放也计入输出）。',
 'oa-observerai-1':'O(n log n + f·n + M) 时间、O(n + M) 空间，M 为所有标记数。',
 'oa-braze-1':'O(P + T + d) 时间、O(P + d) 空间，P 为商品数、T 为商品 tag 总数。',
 'oa-verkada-1':'O(T + A log A) 时间、O(A) 空间，T 为输入文本长度、A 为地址出现数。',
 'oa-oscar-health-1':'O(P + M·R·P) 时间、O(P) 空间，R 为会员所需 specialty 数。',
 'oa-oura-1':'O(q log q) 时间、O(q) 空间。',
 'oa-toshiba-1':'O(n) 时间、O(1) 额外空间。',
 'oa-publicis-sapient-1':'O(n) 时间、O(1) 额外空间。',
 'oa-epifi-1':'O(n log n) 时间、O(n) 空间。',
 'oa-commvault-3':'O((N+M) α(N)) 时间、O(N) 空间。',
}

def output_equal(actual, expected, checker):
    actual=str(actual);expected=str(expected)
    if checker=='exact':return actual==expected
    return actual.split()==expected.split()

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def build():
    specs={s['id']:s for s in SPECS if s['id'] in REVIEW_IDS}
    assert set(specs).isdisjoint(BLOCKED)
    assert set(specs)|set(BLOCKED)==set(REVIEW_IDS)
    candidate_entries=[];review=[];validation={'schemaVersion':1,'seed':20261006,'problems':[]}
    source_items=[]
    for item_id in REVIEW_IDS:
        src=ITEMS[item_id]
        evidence={'id':item_id,'company':src['companyName'],'title':src['title'],
            'sourceUrl':src['sourceUrl'],'catalogContentHash':src['contentHash'],
            'sourceSnapshotCommit':CATALOG['source']['commit']}
        if item_id in BLOCKED:
            reason=BLOCKED[item_id]
            review.append({'id':item_id,'status':'blocked','reason':reason})
            evidence.update(status='blocked',reason=reason);source_items.append(evidence)
            continue
        s=specs[item_id];assert item_id==src['id']
        oracle_cases=[];seen=set()
        for raw in s['samples']:
            if raw not in seen:
                seen.add(raw);oracle_cases.append({'input':raw,'expectedOutput':str(s['oracle'](raw))})
        attempts=0
        while len(oracle_cases)<163 and attempts<20000:
            attempts+=1;raw=s['gen'](RNG)
            if raw in seen:continue
            expected=str(s['oracle'](raw));actual=run(s['solve'],raw)
            assert output_equal(actual,expected,s['checker']), f'{item_id}: oracle mismatch on {raw!r}: {actual!r} != {expected!r}'
            seen.add(raw);oracle_cases.append({'input':raw,'expectedOutput':expected})
        assert len(oracle_cases)>=120 and len(seen)==len(oracle_cases), item_id+' lacks unique oracle cases'
        for row in oracle_cases[:len(s['samples'])]:
            assert output_equal(run(s['solve'],row['input']),row['expectedOutput'],s['checker']), item_id+' sample mismatch'
        reference=s['solve']+"\nif __name__ == '__main__':\n import sys\n print(solve(sys.stdin.read()))\n"
        editorial=(f"## 思路\n\n{s['editorial']}\n\n## 正确性证明\n\n{src['title']} 的状态、选择或转移均按题面与本站输入边界定义；算法对所有合法候选逐一覆盖，并且仅在题面允许时计入答案。所用扫描/动态规划/并查集转移与定义一一对应，因此不会漏解或多计。\n\n## 复杂度\n\n{s['limits']}\n\n## 参考实现\n\n```python\n{s['solve'].rstrip()}\n```\n")
        editorial=editorial.replace(' 的状态、选择或转移均按题面与本站输入边界定义；算法对所有合法候选逐一覆盖，并且仅在题面允许时计入答案。所用扫描/动态规划/并查集转移与定义一一对应，因此不会漏解或多计。','\n\n'+PROOFS[item_id])
        editorial=editorial.replace(f"{src['title']}\n\n{PROOFS[item_id]}",PROOFS[item_id])
        editorial=editorial.replace(s['limits'],s['limits']+'\n\n'+COMPLEXITIES[item_id])
        problem={'id':item_id,'courseId':'gomall','lessonId':'00-overview','title':s['title'],'difficulty':'中等',
            'tags':['OA',s['company']],'description':s['description']+'\n\n本站标准输入输出格式与补充边界以本题说明为准。',
            'input':s['input'],'output':s['output'],'explanation':s['editorial'],'hints':[s['editorial']],
            'timeLimit':6,'memoryLimit':262144,'outputLimit':32768,'checker':s['checker'],'languages':['python','go','java','cpp']}
        cases=[]
        public_inputs=list(s['samples'][:3])
        while len(public_inputs)<3:
            raw=s['gen'](RNG)
            if raw not in public_inputs:public_inputs.append(raw)
        for i,raw in enumerate(public_inputs):
            expected=str(s['oracle'](raw));assert output_equal(run(s['solve'],raw),expected,s['checker'])
            cases.append({'name':f'样例 {i+1}','input':raw,'expectedOutput':expected+'\n','hidden':False,'weight':1})
        for i,row in enumerate(oracle_cases):
            cases.append({'name':f'隐藏验证 {i+1}','input':row['input'],'expectedOutput':row['expectedOutput']+'\n','hidden':True,'weight':1})
        package={'schemaVersion':1,'problem':problem,'cases':cases}
        negative=[];mutants=[]
        for name,code in s['mutants']:
            rejected=[]
            for ci,case in enumerate(cases):
                try:actual=run(code,case['input'])
                except Exception as e:raise AssertionError(f'{item_id} mutant {name} did not exit normally on case {ci}: {e}') from e
                if not output_equal(actual,case['expectedOutput'],s['checker']):rejected.append(ci)
            assert rejected, f'{item_id} mutant was not killed: {name}'
            mutants.append({'name':name,'code':code})
            negative.append({'name':name,'rejectedByCases':rejected})
        assert len(mutants)>=2
        checksum=digest(compact(package))
        entry={'id':item_id,'sourceContentHash':src['contentHash'],'packageChecksum':checksum,
            'editorial':editorial,'authoredSolutions':[{'language':'python','code':reference}]}
        candidate_entries.append(entry)
        review.append({'id':item_id,'status':'authored','reason':'固定 catalog 快照中的题目规则足以定义唯一输入输出；独立 oracle 对照 '+str(len(oracle_cases))+' 个不同输入，且两个正常退出错误程序均被正式测例击杀。离线验证，不代表 GoJudge 通过。'})
        evidence.update(status='authored',interpretation='按固定 catalog 快照题面和 examples 审阅；本站补充输入协议与边界已明示。',
            oracleCases=len(oracle_cases),mutants=len(mutants),goJudge='not-run')
        source_items.append(evidence)
        write_json(ROOT/'packages'/f'{item_id}.json',package)
        (ROOT/'references'/f'{item_id}.py').write_text(reference)
        (ROOT/'editorials'/f'{item_id}.md').write_text(editorial)
        write_json(ROOT/'oracles'/f'{item_id}.json',oracle_cases)
        write_json(ROOT/'mutants'/f'{item_id}.json',mutants)
        for mi,mutant in enumerate(mutants):
            (ROOT/'negative-controls'/f'{item_id}-{mi+1}.py').write_text(mutant['code'])
        validation['problems'].append({'id':item_id,'oracleCases':len(oracle_cases),'publicCases':len(public_inputs),
            'hiddenCases':len(oracle_cases),'negativeControls':negative,
            'packageSha256':digest((ROOT/'packages'/f'{item_id}.json').read_bytes()),
            'referenceSha256':digest((ROOT/'references'/f'{item_id}.py').read_bytes()),
            'oracleSha256':digest((ROOT/'oracles'/f'{item_id}.json').read_bytes()),
            'mutantsSha256':digest((ROOT/'mutants'/f'{item_id}.json').read_bytes())})
        print(f"validated {item_id}: {len(oracle_cases)} oracle cases; {len(mutants)} mutants killed")
    write_json(ROOT/'candidate-batches'/f'{BATCH}.json',{'schemaVersion':1,'items':candidate_entries})
    write_json(ROOT/'reviews'/f'{BATCH}.json',{'schemaVersion':1,'items':review})
    write_json(ROOT/'validation'/f'{BATCH}.json',validation)
    company_slugs=sorted({ITEMS[x]['companySlug'] for x in REVIEW_IDS})
    pages=[{'company':slug,'path':f'web/content/docs/companies/{slug}.mdx'} for slug in company_slugs]
    write_json(ROOT/'source-evidence'/f'{BATCH}.json',{'schemaVersion':1,'repository':CATALOG['source']['repository'],
        'commit':CATALOG['source']['commit'],'origin':CATALOG['source']['origin'],
        'reason':'逐条按固定 catalog snapshot 的 statement、examples 与 sourceUrl 审阅；catalogContentHash 绑定固定快照。当前执行环境无法解析 raw.githubusercontent.com，未伪造原 MDX Git blob。',
        'pages':pages,'items':source_items})
    print(f'written {len(candidate_entries)} authored candidates and {len(BLOCKED)} blocked reviews; no GoJudge/coverage/registry updates')

if __name__=='__main__': build()
