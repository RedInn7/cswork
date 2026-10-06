"""Author offline-validated Wells Fargo OA candidates; never touch registry."""
from pathlib import Path
import hashlib
import json
import math
import random
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
MOD = 1_000_000_007
SPECS = []


def add(**spec):
    SPECS.append(spec)


def encode_perm(p):
    return f"{len(p)}\n{' '.join(map(str, p))}\n"


def perm_oracle(p):
    n = len(p)
    state = list(range(n))
    steps = 0
    while True:
        steps += 1
        state = [state[p[i] - 1] for i in range(n)]
        if state == list(range(n)):
            return str(steps)


def perm_random(r):
    n = r.randint(1, 9)
    p = list(range(1, n + 1))
    r.shuffle(p)
    return p


add(
    number=1, title="Count Operations",
    raw_path="fastprep/Wells Fargo/wellsfargo-count-operations.md",
    raw_blob="c8c6a7aadf8b07796e4ccc49b24f58e1123f71a2",
    values=[[1], [2, 1], [2, 3, 1]],
    edges=[([*range(2, 100001), 1], "100000"), (list(range(1, 100001)), "1")],
    encode=encode_perm, oracle=perm_oracle, random=perm_random,
    desc="给定 1-based 排列 p。一次操作令新数组的第 i 项取旧数组第 p[i] 项。求对任意互异元素数组重复操作后，第一次（至少做一次）恢复原数组所需操作数，答案对 1,000,000,007 取模。",
    input="第一行 n；第二行 n 个整数 p[i]。来源约束：1≤n≤100000，p 是 1..n 的排列。",
    output="输出最少操作次数模 1,000,000,007。",
    idea="将排列分解为不相交循环。每个长度为 L 的循环需恰好 L 的倍数次操作才能复位，整体周期是各循环长度的最小公倍数。",
    proof="互异数组元素保证操作后恢复原数组当且仅当位置置换回到恒等映射。一个排列循环长度 L 在恰好 L 次操作后首次复位，因此总复位时刻必须且只需是所有循环长度的公倍数；最小正时刻即其最小公倍数。",
    complexity="时间 O(n log n + 位运算成本)，空间 O(n)。",
    code='''import sys\nfrom math import gcd\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];p=t[1:1+n];seen=[False]*n;ans=1\n for i in range(n):\n  if not seen[i]:\n   j=i;length=0\n   while not seen[j]:seen[j]=True;j=p[j]-1;length+=1\n   ans=ans//gcd(ans,length)*length\n return str(ans%1000000007)\n''',
    mutants=[
        ("取最长循环长度而非最小公倍数", '''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];p=t[1:1+n];s=[False]*n;best=1\n for i in range(n):\n  if not s[i]:\n   j=i;z=0\n   while not s[j]:s[j]=True;j=p[j]-1;z+=1\n   best=max(best,z)\n return str(best)\n'''),
        ("将循环长度直接相乘而非取最小公倍数", '''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];p=t[1:1+n];s=[False]*n;ans=1\n for i in range(n):\n  if not s[i]:\n   j=i;z=0\n   while not s[j]:s[j]=True;j=p[j]-1;z+=1\n   ans=ans*z\n return str(ans%1000000007)\n'''),
    ],
    note="固定源给出了置换操作定义与 n≤10^5 约束，但没有公开样例；本站提供明确 stdin/stdout 协议和可人工核算样例。",
)


def encode_grid(g):
    return f"{len(g)} {len(g[0])}\n" + "\n".join(g) + "\n"


def grid_oracle(g):
    R, C = len(g), len(g[0])
    obstacles = [(r, c) for r in range(R) for c in range(C) if g[r][c] == "*"]
    start = next((r, c) for r in range(R) for c in range(C) if g[r][c] == "S")
    end = next((r, c) for r in range(R) for c in range(C) if g[r][c] == "E")
    clearance = [[min(abs(r-x)+abs(c-y) for x, y in obstacles) for c in range(C)] for r in range(R)]
    for threshold in range(R+C, -1, -1):
        if clearance[start[0]][start[1]] < threshold:
            continue
        seen={start};stack=[start]
        while stack:
            r,c=stack.pop()
            for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
                nr,nc=r+dr,c+dc
                if 0<=nr<R and 0<=nc<C and (nr,nc) not in seen and clearance[nr][nc]>=threshold:
                    seen.add((nr,nc));stack.append((nr,nc))
        if end in seen:return str(threshold)
    raise AssertionError("the full rectangular grid is connected")


def grid_random(r):
    R, C = r.randint(2, 7), r.randint(2, 7)
    cells = [(i,j) for i in range(R) for j in range(C)]
    s, e = r.sample(cells, 2)
    g = [["*" if r.random() < .25 else "." for _ in range(C)] for _ in range(R)]
    g[s[0]][s[1]] = "S"; g[e[0]][e[1]] = "E"
    if not any(x == "*" for row in g for x in row):
        p = next(x for x in cells if x not in (s,e))
        g[p[0]][p[1]] = "*"
    return ["".join(row) for row in g]


add(
    number=3, title="Find Maximum Distance",
    raw_path="fastprep/Wells Fargo/wellsfargo-find-maximum-distance.md",
    raw_blob="022e77ede90fedad1a7e4e6ddeaf14a5bc017cdf",
    values=[["S*", "*E"], ["S..", "***", "..E"], ["S..", "...", "**E"]],
    edges=[(["S*"+"."*198]+["."*200]*198+["."*199+"E"],"1")],
    encode=encode_grid, oracle=grid_oracle, random=grid_random,
    desc="给定含 S、E、.、* 的矩形网格。路径从 S 到 E，每步上下左右移动且不重复访问格子；* 是障碍但允许经过。路径安全值是路径上每个格子到最近障碍的曼哈顿距离的最小值。求所有路径中的最大安全值。",
    input="第一行 rows cols；随后 rows 行各一个长度为 cols 的字符串。来源范围：2≤rows,cols≤200。本站明确要求恰好一个 S、一个 E、至少一个 *，其余字符为 . 或 *。",
    output="输出最大可保证的最小曼哈顿距离。",
    idea="多源 BFS 求每格到最近 * 的曼哈顿距离，再用最大瓶颈路径搜索：扩展邻格时安全值取当前值与邻格距离的较小者，维护每格已知最大安全值。",
    proof="多源 BFS 在无权四邻网格中给出到最近障碍的最短路，等于曼哈顿距离（网格完整可行走）。对于路径前缀，最佳安全值转移为前缀瓶颈与新格子距离的最小值。最大堆每次取当前值最大的状态；任何尚未处理状态都不可能通过后续扩展产生超过堆顶候选的瓶颈值，因此首次弹出 E 时即是全局最优。",
    complexity="V=rows×cols。时间 O(V log V)，空间 O(V)。",
    code='''import heapq,sys\nfrom collections import deque\ndef solve(raw):\n t=raw.split();R,C=map(int,t[:2]);g=t[2:2+R];d=[[-1]*C for _ in range(R)];q=deque();s=e=None\n for r in range(R):\n  for c,ch in enumerate(g[r]):\n   if ch=='*':d[r][c]=0;q.append((r,c))\n   elif ch=='S':s=(r,c)\n   elif ch=='E':e=(r,c)\n for r,c in q:\n  pass\n while q:\n  r,c=q.popleft()\n  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n   x,y=r+dr,c+dc\n   if 0<=x<R and 0<=y<C and d[x][y]<0:d[x][y]=d[r][c]+1;q.append((x,y))\n best=[[-1]*C for _ in range(R)];best[s[0]][s[1]]=d[s[0]][s[1]];h=[(-best[s[0]][s[1]],*s)]\n while h:\n  neg,r,c=heapq.heappop(h);v=-neg\n  if v<best[r][c]:continue\n  if (r,c)==e:return str(v)\n  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n   x,y=r+dr,c+dc\n   if 0<=x<R and 0<=y<C:\n    nv=min(v,d[x][y])\n    if nv>best[x][y]:best[x][y]=nv;heapq.heappush(h,(-nv,x,y))\n return '-1'\n''',
    mutants=[
        ("使用 Chebyshev 距离代替 Manhattan 距离", '''import heapq,sys\ndef solve(raw):\n t=raw.split();R,C=map(int,t[:2]);g=t[2:2+R];obs=[(r,c) for r in range(R) for c in range(C) if g[r][c]=='*'];s=next((r,c) for r in range(R) for c in range(C) if g[r][c]=='S');e=next((r,c) for r in range(R) for c in range(C) if g[r][c]=='E');d=[[min(max(abs(r-x),abs(c-y)) for x,y in obs) for c in range(C)] for r in range(R)];b=[[-1]*C for _ in range(R)];b[s[0]][s[1]]=d[s[0]][s[1]];h=[(-b[s[0]][s[1]],*s)]\n while h:\n  q,r,c=heapq.heappop(h);v=-q\n  if (r,c)==e:return str(v)\n  if v<b[r][c]:continue\n  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n   x,y=r+dr,c+dc\n   if 0<=x<R and 0<=y<C and min(v,d[x][y])>b[x][y]:b[x][y]=min(v,d[x][y]);heapq.heappush(h,(-b[x][y],x,y))\n return '-1'\n'''),
        ("禁止路径经过障碍格", '''import heapq,sys\ndef solve(raw):\n t=raw.split();R,C=map(int,t[:2]);g=t[2:2+R];obs=[(r,c) for r in range(R) for c in range(C) if g[r][c]=='*'];s=next((r,c) for r in range(R) for c in range(C) if g[r][c]=='S');e=next((r,c) for r in range(R) for c in range(C) if g[r][c]=='E');d=[[min(abs(r-x)+abs(c-y) for x,y in obs) for c in range(C)] for r in range(R)];b=[[-1]*C for _ in range(R)];b[s[0]][s[1]]=d[s[0]][s[1]];h=[(-b[s[0]][s[1]],*s)]\n while h:\n  q,r,c=heapq.heappop(h);v=-q\n  if (r,c)==e:return str(v)\n  if v<b[r][c]:continue\n  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n   x,y=r+dr,c+dc\n   if 0<=x<R and 0<=y<C and g[x][y]!='*' and min(v,d[x][y])>b[x][y]:b[x][y]=min(v,d[x][y]);heapq.heappush(h,(-b[x][y],x,y))\n return '-1'\n'''),
    ],
    note="固定题源完整给出目标、距离定义和障碍可经过规则，但无示例；本站补足字符数量与障碍存在约束。",
)


SPECS[-1]["mutants"][0] = ("忽略整条路径，只返回起点到最近障碍的距离", '''import sys
def solve(raw):
 t=raw.split();R,C=map(int,t[:2]);g=t[2:2+R];s=next((r,c) for r in range(R) for c in range(C) if g[r][c]=='S');o=[(r,c) for r in range(R) for c in range(C) if g[r][c]=='*'];return str(min(abs(s[0]-r)+abs(s[1]-c) for r,c in o))
''')


def encode_minlen(v):
    a,k=v;return f"{len(a)} {k}\n{' '.join(map(str,a))}\n"


def minlen_oracle(v):
    a,k=v;n=len(a);dp=[0]+[n+1]*n
    for i in range(n):
        product=1
        for j in range(i,n):
            product*=a[j]
            if j==i or product<=k:dp[j+1]=min(dp[j+1],dp[i]+1)
    return str(dp[n])


def minlen_random(r):
    n=r.randint(1,12);return [r.randint(1,12) for _ in range(n)],r.randint(1,1000)


add(
    number=4,title="Compressing Array",
    raw_path="fastprep/Wells Fargo/wellsfargo-get-min-length.md",
    raw_blob="8feab1b202c4c44e2e8a01cbea8b458e03b2ba4e",
    values=[([2,3,3,7,3,5],20),([2,4,5],5),([1,1,1],1)],
    edges=[(([1]*200000,1),"1"),(([2]*200000,1),"200000")],
    encode=encode_minlen,oracle=minlen_oracle,random=minlen_random,
    desc="可反复合并相邻两个元素，以乘积替换它们；仅当乘积≤k 时允许合并。所有元素是正整数。求任意操作后能达到的最短数组长度。",
    input="第一行 n、k；第二行 n 个正整数 a[i]。原题约束损坏，本站补充：1≤n≤200000，1≤a[i]≤10^9，1≤k≤10^18。",
    output="输出最短可能长度。",
    idea="从左到右贪心延长当前段，只要段乘积乘下一个数仍≤k 就并入；否则结束当前段并从下个数开始新段。正整数保证乘积随延长单调不减。",
    proof="每个最终元素对应原数组的一个连续段。单元素段无需操作，始终允许保留；长度至少为 2 的段只有在总乘积≤k 时可行，且正整数乘积单调不减，故其内部相邻合并也都满足限制。从当前位置开始，贪心取最长可行段；任何可行方案的第一段结束位置不可能超过贪心边界。用更长的贪心段替换最优方案第一段不会增加剩余后缀的最少段数；对后缀归纳，贪心段数最少。",
    complexity="时间 O(n)，空间 O(1)（不计输入）。",
    code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];groups=1;product=1\n for x in a:\n  if product*x<=k:product*=x\n  else:groups+=1;product=x\n return str(groups)\n''',
    mutants=[
        ("把乘积限制误当成和限制", '''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];g=1;s=0\n for x in a:\n  if s+x<=k:s+=x\n  else:g+=1;s=x\n return str(g)\n'''),
        ("只检查原数组相邻二元组，不检查整段乘积", '''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];g=0;i=0\n while i<n:\n  g+=1\n  if i+1<n and a[i]*a[i+1]<=k:i+=2\n  else:i+=1\n return str(g)\n'''),
    ],
    note="FastPrep 规则和示例明确，但约束区损坏为 HTML 片段；本站明确限定正整数和安全范围，避免负数/零使乘积单调性失效。",
)


SPECS[-1]["code"] = '''import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];groups=1;product=a[0]
 for x in a[1:]:
  if product*x<=k:product*=x
  else:groups+=1;product=x
 return str(groups)
'''


def encode_sub(v):
    s,k=v;return f"{s}\n{k}\n"


def sub_oracle(v):
    s,k=v;candidates=[]
    for i in range(len(s)):
        ones=0
        for j in range(i,len(s)):
            ones+=s[j]=="1"
            if ones==k:candidates.append(s[i:j+1])
    return min(candidates,key=lambda x:(len(x),x))


def sub_random(r):
    n=r.randint(1,22);s="".join(r.choice("01") for _ in range(n))
    if "1" not in s:s="1"+s
    return s,r.randint(1,s.count("1"))


add(
    number=5,title="Get Substring",
    raw_path="fastprep/Wells Fargo/wellsfargo-get-substring.md",
    raw_blob="9ecfdc9c6af72c03bbd951c4254d4e6bf1cc598a",
    values=[("0101101",3),("101",1),("1011",2)],
    edges=[(("0"*499+"1"+"0"*500,1),"1"),(('1'*1000,1000),'1'*1000)],
    encode=encode_sub,oracle=sub_oracle,random=sub_random,
    desc="在只含 0/1 的字符串中找恰含 k 个 1 的子串；先最小化长度，若长度相同则取字典序最小者。题面保证答案存在。",
    input="第一行二进制字符串 s；第二行 k。来源范围：1≤k≤|s|≤1000，且 s 中至少有 k 个 1。",
    output="输出所选子串（不加引号）。",
    idea="枚举每个连续 k 个 1 的窗口，只保留从窗口第一个 1 到第 k 个 1 的最短候选，再按长度和字典序取最小。",
    proof="任何含恰好 k 个 1 的子串所含 1 必构成字符串中某个连续的 k 个 1 的窗口。去掉其首个 1 前与末个 1 后的字符不改变 1 的数量且只会更短，因此最短候选必由首末 1 定界。枚举所有窗口覆盖全部最短候选，按 (长度, 字典序) 取最小即正确。",
    complexity="时间 O(n)，空间 O(n)。",
    code='''import sys\ndef solve(raw):\n s,k=raw.split();k=int(k);p=[i for i,ch in enumerate(s) if ch=='1'];best=None\n for i in range(len(p)-k+1):\n  z=s[p[i]:p[i+k-1]+1]\n  if best is None or (len(z),z)<(len(best),best):best=z\n return best\n''',
    mutants=[
        ("遇到第一个合格窗口就返回", '''import sys\ndef solve(raw):\n s,k=raw.split();k=int(k);p=[i for i,ch in enumerate(s) if ch=='1'];return s[p[0]:p[k-1]+1]\n'''),
        ("先比较字典序而不是先比较长度", '''import sys\ndef solve(raw):\n s,k=raw.split();k=int(k);p=[i for i,ch in enumerate(s) if ch=='1'];return min(s[p[i]:p[i+k-1]+1] for i in range(len(p)-k+1))\n'''),
    ],
    note="FastPrep 原题包含完整目标、约束和示例；本站明确为一行字符串加一行整数的 stdin/stdout 协议。",
)


def encode_compressed(a):
    return f"1\n{len(a)}\n{' '.join(map(str,a))}\n"


def compressed_oracle(a):
    answer=0
    for left in range(len(a)):
        for right in range(left,len(a)):
            part=a[left:right+1]
            canonical=[part[i] for i in range(len(part)) if i==0 or part[i]!=part[i-1]]
            ways=0
            for mask in range(1,1<<len(part)):
                kept=[part[i] for i in range(len(part)) if mask>>i&1]
                if kept!=part and kept==canonical:
                    ways+=1
            answer+=ways
    return str(answer%MOD)


def compressed_random(r):
    return [r.randint(1,5) for _ in range(r.randint(1,9))]


add(
    number=7,title="Sum of Compressed Number for All Subarrays",
    raw_path="fastprep/Wells Fargo/wellsfargo-sum-of-compressed-number-for-all-subarrays.md",
    raw_blob="34ca53da38b06de0bf88a95d08e2107a2729b596",
    values=[[6,7,3,6,6],[4,4],[3,3,3,3]],
    edges=[([1],"0"),([7]*100000,str((100000*100001*100002//6-100000)%MOD))],
    encode=encode_compressed,oracle=compressed_oracle,random=compressed_random,
    desc="对数组的每个连续子数组，把相邻相同值压成一个代表值。该子数组的 compressed number 是：选择每个最大连续相同值段中恰好一个保留下标、删除该段其他下标，从而得到标准压缩数组的不同选择数；若原子数组已压缩，则为 0。求所有子数组 compressed number 之和模 1,000,000,007。",
    input="第一行 t；随后每个测试用例先输入 n，再输入 n 个整数 a[i]。来源约束：1≤t≤10，1≤n≤100000，1≤a[i]≤100000。本站另补总 n≤200000。",
    output="每个测试用例输出一行答案模 1,000,000,007。",
    idea="以最大相同值段长度 L 表示。单段内所有子数组贡献长度和 L(L+1)(L+2)/6。跨段子数组的贡献是首段后缀长度、末段前缀长度与中间完整段长度的乘积；维护此前端点权重即可 O(1) 更新。最后减去所有无相等相邻项的子数组，因为它们已经压缩、贡献为 0。",
    proof="若子数组分成长度 L_i 的最大连续相同值段，标准压缩结果需从每段保留一个原下标，彼此独立，故选择数为 ∏L_i；若所有 L_i=1，题面样例规定已压缩时记 0。对单段区间，按其长度累加得 L(L+1)(L+2)/6。对首段 i、末段 j（i<j）的区间，首段可选后缀长度 x=1..L_i、末段前缀长度 y=1..L_j，中间段完整，求和分解为 T(L_i)T(L_j)∏中间 L_k，其中 T(L)=L(L+1)/2；维护前缀加权和可在线计算所有 j。所有已压缩子数组恰是原序列中没有相等相邻边的区间，在每个此类最大连续块长度 G 中共有 G(G+1)/2 个，逐块扣除各贡献 1。计算过程对模数取模，得到所求和。",
    complexity="每个测试用例时间 O(n)，额外空间 O(n)（读入并分段）。",
    code='''import sys\nMOD=1000000007\ndef solve(raw):\n z=list(map(int,raw.split()));t=z[0];p=1;out=[]\n for _ in range(t):\n  n=z[p];p+=1;a=z[p:p+n];p+=n;runs=[]\n  for x in a:\n   if not runs or runs[-1][0]!=x:runs.append([x,1])\n   else:runs[-1][1]+=1\n  total=acc=0\n  for _,L in runs:\n   T=L*(L+1)//2;total=(total+L*(L+1)*(L+2)//6+T*acc)%MOD;acc=(acc*L+T)%MOD\n  streak=1;empty=0\n  for i in range(1,n+1):\n   if i<n and a[i]!=a[i-1]:streak+=1\n   else:empty=(empty+streak*(streak+1)//2)%MOD;streak=1\n  out.append(str((total-empty)%MOD))\n return '\\n'.join(out)\n''',
    mutants=[
        ("没有扣除原本已压缩的子数组", '''import sys\nMOD=1000000007\ndef solve(raw):\n z=list(map(int,raw.split()));t=z[0];p=1;o=[]\n for _ in range(t):\n  n=z[p];p+=1;a=z[p:p+n];p+=n;r=[]\n  for x in a:\n   if not r or r[-1][0]!=x:r.append([x,1])\n   else:r[-1][1]+=1\n  s=q=0\n  for _,L in r:\n   T=L*(L+1)//2;s=(s+L*(L+1)*(L+2)//6+T*q)%MOD;q=(q*L+T)%MOD\n  o.append(str(s))\n return '\\n'.join(o)\n'''),
        ("跨相邻最大段时将选择数相加而不是相乘", '''import sys\nMOD=1000000007\ndef solve(raw):\n z=list(map(int,raw.split()));t=z[0];p=1;o=[]\n for _ in range(t):\n  n=z[p];p+=1;a=z[p:p+n];p+=n;s=0\n  for i in range(n):\n   for j in range(i+1,n+1):\n    x=a[i:j];ls=[];k=0\n    while k<len(x):\n     q=k+1\n     while q<len(x) and x[q]==x[k]:q+=1\n     ls.append(q-k);k=q\n    if any(v>1 for v in ls):s+=sum(ls)\n  o.append(str(s%MOD))\n return '\\n'.join(o)\n'''),
    ],
    note="固定 FastPrep 题面给出三组样例与解释，明确已压缩子数组贡献为 0，重复段示例对应每段选一个保留下标。原文算法讲解声称 O(n²)，与 n≤10^5 不相容且递推并未正确实现模除；本站从示例定义独立推导线性计数。",
)


SPECS[-1]["mutants"][1] = ("跨run子数组把端点权重相加而非相乘", '''import sys
MOD=1000000007
def solve(raw):
 z=list(map(int,raw.split()));t=z[0];p=1;o=[]
 for _ in range(t):
  n=z[p];p+=1;a=z[p:p+n];p+=n;r=[]
  for x in a:
   if not r or r[-1][0]!=x:r.append([x,1])
   else:r[-1][1]+=1
  s=q=0;seen=False
  for _,L in r:
   T=L*(L+1)//2;s=(s+L*(L+1)*(L+2)//6+(T+q if seen else 0))%MOD;q=(q*L+T)%MOD;seen=True
  zlen=1;empty=0
  for i in range(1,n+1):
   if i<n and a[i]!=a[i-1]:zlen+=1
   else:empty=(empty+zlen*(zlen+1)//2)%MOD;zlen=1
  o.append(str((s-empty)%MOD))
 return '\\n'.join(o)
''')


BLOCKED = {
    2: ("Allocate Wells for Fair Distribution", "题面只说环形连续分配并最小化各组总容量差；没有数量约束、空井/正容量限制或并列方案规则。样例给出一个差为10的方案但输出为具体容量向量，多个旋转/分割可能同为最优，无法确定唯一 token 输出。若擅自补边界与平局规则会改变原函数契约，暂缓。", "fastprep/Wells Fargo/wellsfargo-fair-distribution.md", "3902780dec1fe563db9fdff9e299ee170434a7d2"),
    6: ("Find Last Affected System", "没有样例，且“starts affecting from the Kth system”与“skip K-1 then affect Kth”没有明确第一个受害者/计数起点；还未说明过程停止于剩余一个系统（Josephus survivor）还是继续到所有系统都被影响后取最后一个。两种含义输出不同，不能据 MDX 中未经样例校验的说明猜测。", "fastprep/Wells Fargo/wellsfargo-shot-on-mi-a3-ai-triple-camera.md", "5a10de4cf7207d6148f676face17fc947424685a"),
}


RAW = {
    1:("fastprep/Wells Fargo/wellsfargo-count-operations.md","c8c6a7aadf8b07796e4ccc49b24f58e1123f71a2"),
    2:("fastprep/Wells Fargo/wellsfargo-fair-distribution.md","3902780dec1fe563db9fdff9e299ee170434a7d2"),
    3:("fastprep/Wells Fargo/wellsfargo-find-maximum-distance.md","022e77ede90fedad1a7e4e6ddeaf14a5bc017cdf"),
    4:("fastprep/Wells Fargo/wellsfargo-get-min-length.md","8feab1b202c4c44e2e8a01cbea8b458e03b2ba4e"),
    5:("fastprep/Wells Fargo/wellsfargo-get-substring.md","9ecfdc9c6af72c03bbd951c4254d4e6bf1cc598a"),
    6:("fastprep/Wells Fargo/wellsfargo-shot-on-mi-a3-ai-triple-camera.md","5a10de4cf7207d6148f676face17fc947424685a"),
    7:("fastprep/Wells Fargo/wellsfargo-sum-of-compressed-number-for-all-subarrays.md","34ca53da38b06de0bf88a95d08e2107a2729b596"),
}
MDX_BLOB = "a961e7dad6fe5c9c61cb5fca520442440d71c861"


def execute(path, stdin):
    p=subprocess.run([sys.executable,"-I",str(path)],input=stdin,text=True,capture_output=True,timeout=10,check=True)
    return p.stdout.rstrip("\n")


def normalize(raw):
    js="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    p=subprocess.run(["node","--import","tsx","-e",js],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True,check=True)
    return p.stdout


def main():
    for folder in ("packages","editorials","references","oracles","mutants","negative-controls","reviews","candidate-batches","validation","source-evidence"):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    batch=[];reports=[];reviews=[];evidence=[]
    for spec in SPECS:
        num=spec["number"];ident=f"oa-wells-fargo-{num}";source=SOURCES[ident]
        rng=random.Random(20261005+num)
        refcode=textwrap.dedent(spec["code"]).strip()+"\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
        ref=OUT/"references"/f"{ident}.py";ref.write_text(refcode)
        vals=list(spec["values"]);seen={spec["encode"](x) for x in vals}
        while len(vals)<163:
            x=spec["random"](rng);encoded=spec["encode"](x)
            if encoded not in seen:seen.add(encoded);vals.append(x)
        oracle=[]
        for x in vals:
            stdin=spec["encode"](x);expected=spec["oracle"](x);actual=execute(ref,stdin)
            assert actual==expected,(ident,"oracle mismatch",x,expected,actual)
            oracle.append({"input":stdin,"expectedOutput":expected+"\n"})
        cases=oracle[:3]
        for x,expected in spec["edges"]:
            stdin=spec["encode"](x);got=spec["oracle"](x) if expected is None else expected
            actual=execute(ref,stdin);assert actual==got,(ident,"edge mismatch",x,got,actual)
            cases.append({"input":stdin,"expectedOutput":got+"\n"})
        cases.extend(oracle[3:31])
        formal=[{"name":f"公开用例 {i+1}" if i<3 else f"隐藏验证 {i-2}",**c,"hidden":i>=3,"weight":1} for i,c in enumerate(cases)]
        mutants=[];kills=[]
        for j,(name,code) in enumerate(spec["mutants"],1):
            mcode=textwrap.dedent(code).strip()+"\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
            mpath=OUT/"negative-controls"/f"{ident}-{j}.py";mpath.write_text(mcode)
            rejected=[i for i,c in enumerate(formal) if execute(mpath,c["input"])!=c["expectedOutput"].rstrip("\n")]
            assert rejected,(ident,"mutant survived",name)
            mutants.append({"name":name,"code":mcode});kills.append({"name":name,"rejectedByCases":rejected})
        problem={"id":ident,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"中等","tags":["OA","Wells Fargo"]+spec.get("tags",[]),"description":spec["desc"]+"\n\n题源与本站补充输入协议见题面及审阅记录。","input":spec["input"],"output":spec["output"],"explanation":"按题目规则处理输入，详细思路见配套讲义。","hints":[spec["idea"]],"timeLimit":3,"memoryLimit":262144,"outputLimit":4096,"checker":"tokens","languages":["python","go","java","cpp"]}
        package=json.loads(normalize({"schemaVersion":1,"problem":problem,"cases":formal}))
        editorial_text=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        authored=[{"language":"python","code":refcode}]
        editorial={"schemaVersion":1,"id":ident,"title":spec["title"],"explanation":editorial_text,"solutions":authored,"sourceUrl":source["sourceUrl"],"sourceContentHash":source["contentHash"],"author":"CSWork"}
        normalized=json.dumps(package,ensure_ascii=False,separators=(",",":"))
        for folder,obj in (("packages",package),("editorials",editorial),("oracles",oracle),("mutants",mutants)):
            (OUT/folder/f"{ident}.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
        batch.append({"id":ident,"sourceContentHash":source["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":editorial_text,"authoredSolutions":authored})
        reports.append({"id":ident,"oracleCases":len(oracle),"publicCases":3,"hiddenCases":len(formal)-3,"negativeControls":kills,"referenceSha256":hashlib.sha256(refcode.encode()).hexdigest()})
        reviews.append({"id":ident,"status":"authored","reason":spec["note"]+" 163 oracle 输入、公开/边界/隐藏测试及两个正常退出错误变异程序均已离线验证；未运行真实沙箱。","sourceCommit":COMMIT,"rawPath":spec["raw_path"],"rawGitBlob":spec["raw_blob"],"catalogContentHash":source["contentHash"]})
        evidence.append({"id":ident,"sourceFiles":[{"path":spec["raw_path"],"gitBlob":spec["raw_blob"]}],"catalogContentHash":source["contentHash"]})
        print(f"{ident}: 163 oracle inputs, {len(formal)} judge cases; mutants killed",flush=True)
    for num,(title,reason,path,blob) in BLOCKED.items():
        ident=f"oa-wells-fargo-{num}";src=SOURCES[ident]
        reviews.append({"id":ident,"status":"blocked","reason":reason,"sourceCommit":COMMIT,"rawPath":path,"rawGitBlob":blob,"catalogContentHash":src["contentHash"]})
        evidence.append({"id":ident,"sourceFiles":[{"path":path,"gitBlob":blob}],"catalogContentHash":src["contentHash"]})
    (OUT/"candidate-batches/wells-fargo-next.json").write_text(json.dumps({"schemaVersion":1,"items":batch},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation/wells-fargo-next.json").write_text(json.dumps({"schemaVersion":1,"seed":20261005,"problems":reports,"note":"Offline validation only; not run in GoJudge or published."},ensure_ascii=False,indent=2)+"\n")
    (OUT/"reviews/wells-fargo-next.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
    (OUT/"source-evidence/wells-fargo-next.json").write_text(json.dumps({"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":COMMIT,"mdxPath":"web/content/docs/companies/wells-fargo.mdx","mdxGitBlob":MDX_BLOB,"catalogPath":"content/oa-master/catalog.json","items":evidence},ensure_ascii=False,indent=2)+"\n")


if __name__ == "__main__":
    main()
