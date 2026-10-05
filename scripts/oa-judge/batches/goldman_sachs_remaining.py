"""Author clear Goldman Sachs OA problems as offline-only candidates."""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SEED = 20261005


def execute(file, data):
    result = subprocess.run([sys.executable, "-I", str(file)], input=data, text=True,
                            capture_output=True, timeout=8, check=True)
    return result.stdout.rstrip("\n")


def enc9(v):
    rate, duration, keys = v
    return f"{rate} {duration} {len(keys)}\n" + " ".join(map(str, keys)) + "\n"


def oracle9(v):
    rate, duration, keys = v
    degree = max((sum(k > 1 and value % k == 0 for k in keys) for value in keys), default=0)
    strength = degree * 100000
    return f"{int(rate * duration >= strength)} {strength}"


def enc10(s): return s + "\n"


def oracle10(s):
    if not s:
        return "0"
    ways = [0] * (len(s) + 1)
    ways[0] = 1
    for i in range(1, len(s) + 1):
        if s[i - 1] != "0":
            ways[i] += ways[i - 1]
        if i >= 2 and 10 <= int(s[i - 2:i]) <= 26:
            ways[i] += ways[i - 2]
    return str(ways[-1])


def enc16(v): return " ".join(map(str, v)) + "\n"


def oracle16(v):
    n, toys, start = v
    kid = start
    for _ in range(toys - 1):
        kid = kid % n + 1
    return str(kid)


def enc17(v):
    intervals = v
    return f"{len(intervals)}\n" + "\n".join(f"{a} {b}" for a, b in intervals) + "\n"


def oracle17(v):
    if not v:
        return "0"
    return str(max(sum(a <= t <= b for a, b in v) for t in {x for p in v for x in p}))


def enc18(v):
    grid, k = v
    return f"{len(grid)} {len(grid[0])} {k}\n" + "\n".join(" ".join(map(str, row)) for row in grid) + "\n"


def oracle18(v):
    grid, k = v
    n, m = len(grid), len(grid[0])
    if grid[0][0] or grid[-1][-1]:
        return "-1"
    edges = [[] for _ in range(n * m)]
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for r in range(n):
        for c in range(m):
            if grid[r][c]:
                continue
            u = r * m + c
            for dr, dc in dirs:
                for step in range(1, k + 1):
                    nr, nc = r + dr * step, c + dc * step
                    if not (0 <= nr < n and 0 <= nc < m) or grid[nr][nc]:
                        break
                    edges[u].append(nr * m + nc)
    dist = [-1] * (n * m)
    dist[0] = 0
    q = [0]
    for u in q:
        if u == n * m - 1:
            return str(dist[u])
        for w in edges[u]:
            if dist[w] < 0:
                dist[w] = dist[u] + 1
                q.append(w)
    return "-1"


def enc21(v):
    arr, k = v
    return f"{len(arr)} {k}\n" + " ".join(map(str, arr)) + "\n"


def oracle21(v):
    arr, k = v
    best = 0
    for left in range(len(arr)):
        total = 0
        for right in range(left, len(arr)):
            total += arr[right]
            if total <= k:
                best = max(best, right - left + 1)
    return str(best)


def enc23(v):
    arr, k = v
    return f"{len(arr)}\n" + "\n".join(map(str, arr)) + f"\n{k}\n"


def oracle23(v):
    arr, k = v
    best = 1
    for mask in range(1, 1 << len(arr)):
        chosen = [arr[i] for i in range(len(arr)) if mask >> i & 1]
        if all((chosen[i] ^ chosen[i + 1]) == k for i in range(len(chosen) - 1)):
            best = max(best, len(chosen))
    return str(best)


def enc25(arr): return f"{len(arr)}\n" + " ".join(map(str, arr)) + "\n"


def oracle25(arr):
    # Deliberately search candidate starts rather than using prefix minima.
    x = 1
    while True:
        running = x
        if all((running := running + value) >= 1 for value in arr):
            return str(x)
        x += 1


def enc29(v): return " ".join(map(str, v)) + "\n"


def oracle29(v):
    x1, y1, x2, y2, x3, y3, xp, yp, xq, yq = v
    a, b, c = (x1, y1), (x2, y2), (x3, y3)
    area = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
    if area == 0:
        return "0"
    def inside(x, y):
        p = (x, y)
        parts = sum(abs((u[0] - p[0]) * (w[1] - p[1]) - (u[1] - p[1]) * (w[0] - p[0]))
                    for u, w in ((a, b), (b, c), (c, a)))
        return parts == area
    pin, qin = inside(xp, yp), inside(xq, yq)
    return str(3 if pin and qin else 1 if pin else 2 if qin else 4)


def enc31(v):
    values, target = v
    return f"{len(values)} {target}\n" + " ".join(map(str, values)) + "\n"


def oracle31(v):
    values, target = v
    return str(sum(abs(values[i] - values[j]) == target
                   for i in range(len(values)) for j in range(i + 1, len(values))))


def enc22(values): return f"{len(values)}\n" + " ".join(map(str, values)) + "\n"


def oracle22(values):
    best = 0
    for mask in range(1 << len(values)):
        selected = sorted((values[i] for i in range(len(values)) if mask >> i & 1), reverse=True)
        total = 0
        for value in selected:
            total += value
            if total <= 0:
                break
        else:
            best = max(best, len(selected))
    return str(best)


SPECS = [
    dict(id=9, title="Encryption Validity", tags=["数组", "数论"],
         desc="给定测试速率、有效秒数和一组正整数密钥。某个密钥的可整除度是列表中大于 1 且能整除它的元素个数（重复元素按出现次数计）。加密强度为最大可整除度乘 100000。", 
         input="第一行 instructionCount validityPeriod n；第二行 n 个 keys[i]。本站按原约束补充 n≥1；其余范围沿用原题：速率、有效秒数 1..10^8，密钥 1..10^5。",
         output="输出两个整数：能否在有效期内破解（instructionCount×validityPeriod≥强度时为 1，否则 0），以及加密强度。",
         encode=enc9, oracle=oracle9,
         samples=[(1000, 10000, [2, 4, 8, 2]), (1, 1, [1]), (100, 1000, [2, 3, 6])],
         random=lambda r: (r.randint(1, 1000), r.randint(1, 2000), [r.randint(1, 80) for _ in range(r.randint(1, 30))]),
         edges=[((1, 1, [1] * 25), "1 0"), ((100000000, 100000000, [1, 100000]), "1 100000"), ((1, 1200000, [2] * 12), "1 1200000")],
         code="""import sys\ndef solve(raw):\n t=list(map(int,raw.split())); rate,duration,n=t[:3]; keys=t[3:3+n]; limit=max(keys); freq=[0]*(limit+1)\n for x in keys: freq[x]+=1\n best=0\n for value in keys:\n  degree=0\n  for d in range(2,value+1):\n   if value%d==0: degree+=freq[d]\n  best=max(best,degree)\n strength=best*100000\n return f'{int(rate*duration>=strength)} {strength}'\nif __name__=='__main__': print(solve(sys.stdin.read()))\n""",
         mutants=[("把 1 也当作可用除数", "if value % d == 0", "if value % d == 0"),
                  ("破解比较误用严格大于", "rate*duration>=strength", "rate*duration>strength")],
         mutantCode=["""import sys\ndef solve(raw):\n t=list(map(int,raw.split())); rate,duration,n=t[:3]; keys=t[3:3+n]; degree=max(sum(value%d==0 for d in keys) for value in keys); strength=degree*100000; return f'{int(rate*duration>=strength)} {strength}'\nif __name__=='__main__': print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n t=list(map(int,raw.split())); rate,duration,n=t[:3]; keys=t[3:3+n]; f=[0]*(max(keys)+1)\n for x in keys:f[x]+=1\n best=max(sum(f[d] for d in range(2,v+1) if v%d==0) for v in keys); strength=best*100000; return f'{int(rate*duration>strength)} {strength}'\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""],
         idea="用频次数组保存每个密钥出现次数。对每个 key 枚举其大于 1 的因数并累加频次，得到最大可整除度，再按定义计算强度与可破解状态。",
         proof="频次数组保留了列表重复项的贡献；对 key 的所有因数逐一累加，恰好统计所有大于 1 且整除它的列表元素。取最大值即题面定义的强度基础，最后按乘积比较破解能力。",
         complexity="设 M=max(keys)，时间 O(M log M + n)，空间 O(M)。"),
    dict(id=10, title="Alphanumeric Combinations", tags=["字符串", "动态规划"],
         desc="数字串可按顺序切分为 1..26 的整数，并映射到 a..z。每种有效切分对应一种单词；前导零不能单独或作为 01..09 解码。",
         input="输入一行数字串 S。原题没有给出长度范围；本站补充 1≤|S|≤1000，字符仅为 0..9，以保证输出适配本题判题输出上限。",
         output="输出有效解码方案数的十进制整数；无有效方案输出 0。",
         encode=enc10, oracle=oracle10,
         samples=["2112", "2101", "100"],
         random=lambda r: "".join(r.choice("0123456789") for _ in range(r.randint(1, 16))),
         edges=[("0", "0"), ("10", "1"), ("26", "2"), ("27", "1"), ("1111111111111111", str(1597))],
         code="""import sys\ndef solve(raw):\n s=raw.strip(); n=len(s); dp=[0]*(n+1); dp[0]=1\n for i in range(1,n+1):\n  if s[i-1]!='0': dp[i]+=dp[i-1]\n  if i>1 and 10<=int(s[i-2:i])<=26: dp[i]+=dp[i-2]\n return str(dp[n])\nif __name__=='__main__': print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\ndef solve(raw):\n s=raw.strip(); n=len(s); dp=[0]*(n+1); dp[0]=1\n for i in range(1,n+1):\n  if s[i-1]!='0':dp[i]+=dp[i-1]\n  if i>1 and 10<=int(s[i-2:i])<=27:dp[i]+=dp[i-2]\n return str(dp[n])\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n s=raw.strip(); n=len(s); dp=[0]*(n+1); dp[0]=1\n for i in range(1,n+1):\n  dp[i]+=dp[i-1]\n  if i>1 and 10<=int(s[i-2:i])<=26:dp[i]+=dp[i-2]\n return str(dp[n])\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="动态规划 dp[i] 表示前 i 位的解码数。末尾一位非 0 时可单独解码；末尾两位在 10..26 时可合并解码。",
         proof="任一有效切分的最后一块只能长 1 或 2。单字符块贡献 dp[i−1] 且不得为 0；双字符块贡献 dp[i−2] 且数值须在 10..26。两类互斥并覆盖所有合法切分。",
         complexity="时间 O(n)，空间 O(n)。"),
    dict(id=16, title="Find the Damaged Toy", tags=["数学", "模拟"],
         desc="N 个孩子按 1..N 编号围坐。第一个玩具从 D 号孩子开始，之后按编号递增逐个发放并循环回到 1；求第 T 个（最后一个）玩具发给谁。",
         input="一行输入 N T D。原题未提供数值范围；本站补充 1≤N,T≤10^9 且 1≤D≤N。",
         output="输出最后一个玩具收到者的 1-based 编号。",
         encode=enc16, oracle=oracle16,
         samples=[(5, 2, 1), (5, 1, 4), (3, 7, 2)],
         random=lambda r: (r.randint(1, 60), r.randint(1, 100), 1),
         edges=[((1, 1, 1), "1"), ((5, 5, 3), "2"), ((5, 1000000000, 5), "4")],
         code="""import sys\ndef solve(raw):\n n,t,d=map(int,raw.split()); return str((d-1+t-1)%n+1)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\ndef solve(raw):\n n,t,d=map(int,raw.split()); return str((d-1+t)%n+1)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n n,t,d=map(int,raw.split()); return str((d+t-2)%n)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="把孩子编号改为从 0 开始。首个玩具位于 d−1；再前进 T−1 格并对 N 取模。",
         proof="从 D 开始的第一个玩具无需移动；后续每个玩具向前移动一位。总移动 T−1 次，循环编号对应模 N，最后转回 1-based 编号。",
         complexity="时间 O(1)，空间 O(1)。"),
    dict(id=17, title="Process Scheduler", tags=["排序", "扫描线"],
         desc="每个进程在 start 到 end 的整数时刻执行，两个端点均包含。求同一时刻最多重叠执行多少个进程，即所需最少核心数。",
         input="第一行 n（1..100000），接下来 n 行各为 start[i] end[i]，满足 1≤start≤end≤10^9。",
         output="输出最少需要的核心数。",
         encode=enc17, oracle=oracle17,
         samples=[[(1, 3), (2, 4), (4, 4)], [(1, 1)], [(1, 10), (2, 3), (4, 5)]],
         random=lambda r: [(s := r.randint(1, 18), r.randint(s, 22)) for _ in range(r.randint(1, 20))],
         edges=[([(1, 1), (1, 1), (2, 2)], "2"), ([(1, 1000000000)] * 5, "5"), ([(1, 2), (3, 4)], "1")],
         code="""import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; ev=[]\n for i in range(n): ev.extend(((t[1+2*i],1),(t[2+2*i]+1,-1)))\n ev.sort(); cur=best=0\n for _,d in ev: cur+=d; best=max(best,cur)\n return str(best)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; ev=[]\n for i in range(n): ev.extend(((t[1+2*i],1),(t[2+2*i],-1)))\n ev.sort(); c=b=0\n for _,d in ev:c+=d;b=max(b,c)\n return str(b)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; ev=[]\n for i in range(n): ev.extend(((t[1+2*i],1),(t[2+2*i]+1,-1)))\n ev.sort(); c=b=0\n for _,d in ev:c+=d;b=max(b,c)\n return str(max(1,b-1))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="建立开始事件 +1 和结束后一个时刻的事件 −1，按时间排序扫描当前并发数，取最大值。",
         proof="因区间端点包含，进程在 end 时刻仍运行，因此只在 end+1 释放核心。扫描到任一事件后，当前计数恰为该时刻运行的进程数；其最大值就是所有时刻所需核心数的下界且可由该数量核心安排。",
         complexity="时间 O(n log n)，空间 O(n)。"),
    dict(id=18, title="Minimum Moves", tags=["图论", "BFS"],
         desc="在 0/1 网格中从左上角到右下角。每步可水平或垂直移动 1 到 k 格，但中途与终点经过的格子都必须为空格 0；求最少移动次数，不可达输出 -1。",
         input="第一行 n m k（1≤n,m,k≤100），接下来 n 行各含 m 个 0/1。原题参数明确 k 为单步最大距离；原文移动规则中的局部变量复用本站统一按此解释。",
         output="输出最少移动次数；不可达输出 -1。",
         encode=enc18, oracle=oracle18,
         samples=[([[0, 1], [1, 0]], 2), ([[0, 0, 0], [1, 0, 0], [1, 0, 0]], 5), ([[0, 1, 0], [1, 0, 0], [1, 0, 0]], 5)],
         random=lambda r: (lambda n,m: ([[0 if r.random() > .3 else 1 for _ in range(m)] for _ in range(n)], r.randint(1, max(n,m))))(r.randint(1, 7), r.randint(1, 7)),
         edges=[(([[0]], 1), "0"), (([[1, 0]], 2), "-1"), (([[0, 0, 0, 0]], 3), "1"), (([[0, 1, 0]], 2), "-1")],
         code="""import sys\nfrom collections import deque\ndef solve(raw):\n t=list(map(int,raw.split())); n,m,k=t[:3]; a=[t[3+i*m:3+(i+1)*m] for i in range(n)]\n if a[0][0] or a[-1][-1]: return '-1'\n d=[[-1]*m for _ in range(n)]; d[0][0]=0; q=deque([(0,0)])\n while q:\n  r,c=q.popleft()\n  if (r,c)==(n-1,m-1): return str(d[r][c])\n  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n   for z in range(1,k+1):\n    x,y=r+dr*z,c+dc*z\n    if not (0<=x<n and 0<=y<m) or a[x][y]: break\n    if d[x][y]<0:d[x][y]=d[r][c]+1;q.append((x,y))\n return '-1'\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\nfrom collections import deque\ndef solve(raw):\n t=list(map(int,raw.split()));n,m,k=t[:3];a=[t[3+i*m:3+(i+1)*m] for i in range(n)];d=[[0]*m for _ in range(n)];q=deque([(0,0)])\n while q:\n  r,c=q.popleft()\n  if (r,c)==(n-1,m-1):return str(d[r][c])\n  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n   x,y=r+dr,c+dc\n   if 0<=x<n and 0<=y<m and not a[x][y] and (x,y)!=(0,0) and d[x][y]==0:d[x][y]=d[r][c]+1;q.append((x,y))\n return '-1'\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\nfrom collections import deque\ndef solve(raw):\n t=list(map(int,raw.split()));n,m,k=t[:3];a=[t[3+i*m:3+(i+1)*m] for i in range(n)];d=[[-1]*m for _ in range(n)];d[0][0]=0;q=deque([(0,0)])\n while q:\n  r,c=q.popleft()\n  if (r,c)==(n-1,m-1):return str(d[r][c])\n  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n   x,y=r+dr,c+dc\n   if 0<=x<n and 0<=y<m and not a[x][y] and d[x][y]<0:d[x][y]=d[r][c]+1;q.append((x,y))\n return '-1'\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="对每个可达空格做 BFS。由该格沿四个方向尝试 1..k 步，遇边界或障碍立即停止；首次到达的步数就是最少移动数。",
         proof="每个 BFS 边代表一次合法移动，且所有规则允许的方向和距离均被枚举。无权图 BFS 首次访问节点时得到最短边数，因此目标的距离即最少移动次数。",
         complexity="时间 O(nmk)，空间 O(nm)。"),
    dict(id=21, title="Longest Subarray", tags=["数组", "滑动窗口"],
         desc="给定正整数数组，求元素和不超过 k 的最长连续子数组长度。",
         input="第一行 n k（1≤n≤100000，1≤k≤10^9），第二行 n 个正整数 a[i]（1..1000）。",
         output="输出满足子数组和≤k的最大长度；不存在非空子数组时输出 0。",
         encode=enc21, oracle=oracle21,
         samples=[([1, 2, 3], 4), ([3, 1, 2, 3], 4), ([7], 6)],
         random=lambda r: ([r.randint(1, 15) for _ in range(r.randint(1, 24))], r.randint(1, 70)),
         edges=[(([1] * 100000, 100000), "100000"), (([1000] * 100000, 1), "0"), (([1, 2, 1, 1], 3), "2")],
         code="""import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];l=0;s=best=0\n for r,x in enumerate(a):\n  s+=x\n  while s>k:s-=a[l];l+=1\n  best=max(best,r-l+1)\n return str(best)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];l=0;s=best=0\n for r,x in enumerate(a):\n  s+=x\n  while s>=k:s-=a[l];l+=1\n  best=max(best,r-l+1)\n return str(best)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];s=length=0\n for x in a:\n  if s+x>k:break\n  s+=x;length+=1\n return str(length)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="正数条件允许滑动窗口：右端加入元素，若和超过 k 就不断移除左端，维护当前合法窗口最大长度。",
         proof="对每个右端点，移除最少的左侧元素后得到以该点结尾的最长合法窗口：元素全为正，任何更靠左的起点只会增大和。扫描全部右端点取最大值即为全局最优。",
         complexity="时间 O(n)，空间 O(1)。"),
    dict(id=23, title="Bitwise XOR Subsequences", tags=["动态规划", "位运算"],
         desc="求数组的最长子序列，使任意相邻选中元素的按位异或都等于 k。长度为 1 的子序列始终合法。",
         input="第一行 n（1..100000），接下来 n 行各一个 arr[i]（0..10^6），最后一行 k（0..10^6）。",
         output="输出最长合法子序列长度。",
         encode=enc23, oracle=oracle23,
         samples=[([1, 2, 3, 4], 3), ([5], 0), ([2, 2, 2, 2], 0)],
         random=lambda r: ([r.randint(0, 15) for _ in range(r.randint(1, 14))], r.randint(0, 15)),
         edges=[(([0] * 100000, 0), "100000"), (([1, 2, 1, 2, 1], 3), "5"), (([1, 2, 4], 0), "1")],
         code="""import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];a=t[1:n+1];k=t[n+1];dp={};best=1\n for v in a:\n  dp[v]=max(dp.get(v,0),dp.get(v^k,0)+1);best=max(best,dp[v])\n return str(best)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];a=t[1:n+1];k=t[n+1];dp={};best=1\n for v in a:\n  dp[v]=max(dp.get(v,0),dp.get(v^k,0)+2);best=max(best,dp[v])\n return str(best)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];a=t[1:n+1];k=t[n+1];dp={}\n for v in a:dp[v]=max(dp.get(v,0),dp.get(v^k,0)+1)\n return str(max(dp.values())-1)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="维护 dp[v]：当前前缀中以值 v 结尾的最长合法子序列。新值 v 可接在值 v XOR k 后面。",
         proof="若新元素 v 接在前一元素 u 后，合法条件要求 u XOR v=k，唯一得到 u=v XOR k。转移取该状态加一，并保留已有以 v 结尾的最优状态。逐个扫描保证只使用此前元素，符合子序列顺序。",
         complexity="时间 O(n)，空间 O(distinct(arr))。"),
    dict(id=25, title="Minimum Start Value", tags=["数组", "前缀和"],
         desc="给定整数数组，求最小正整数初值 x，使从左到右逐项累加后每一个前缀和至少为 1。",
         input="第一行 n（1..100000），第二行 n 个整数 arr[i]（−10^6..10^6）。",
         output="输出最小合法初值 x。",
         encode=enc25, oracle=oracle25,
         samples=[[-5, 4, -2, 3, 1, -1, -6, -1, 0, 5], [-5, 4, -2, 3, 1], [1, 2, 3]],
         random=lambda r: [r.randint(-15, 15) for _ in range(r.randint(1, 24))],
         edges=[(([-1000000] * 100000), "100000000001"), (([0] * 100000), "1"), (([5, -6, 2]), "2")],
         code="""import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];s=mn=0\n for x in t[1:1+n]:s+=x;mn=min(mn,s)\n return str(1-mn)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];s=mn=0\n for x in t[1:1+n]:s+=x;mn=min(mn,s)\n return str(-mn)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];s=mn=0\n for x in t[1:1+n]:s+=x;mn=min(mn,s)\n return str(max(1,1-s))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="计算所有前缀和的最小值 minPrefix。初值 x 必须满足 x+minPrefix≥1，因此答案为 1−minPrefix。",
         proof="每个迭代后的运行和等于 x 加对应前缀和。所有运行和至少为 1 当且仅当 x≥1−minPrefix；该值本身满足约束，且再小一会在最小前缀处失败。",
         complexity="时间 O(n)，空间 O(1)。"),
    dict(id=29, title="Do They Belong?", tags=["几何", "叉积"],
         desc="给定三个顶点构成的三角形和点 p、q。退化三角形返回 0；否则按 p、q 是否位于三角形内部或边界，分别返回 1、2、3、4。",
         input="一行依次输入 x1 y1 x2 y2 x3 y3 xp yp xq yq；所有坐标为 0..2000 的整数。",
         output="按题面情形返回 0..4：1=p 仅在内/边界，2=q 仅在内/边界，3=两点都在，4=两点都不在。",
         encode=enc29, oracle=oracle29,
         samples=[(0, 0, 4, 0, 0, 4, 1, 1, 4, 4), (0, 0, 3, 0, 0, 3, 1, 1, 4, 4), (0, 0, 2, 2, 4, 4, 1, 1, 0, 0)],
         random=lambda r: (lambda a,b,c,p,q: (*a,*b,*c,*p,*q))(
             (0,0), (r.randint(1,10),0), (0,r.randint(1,10)),
             (r.randint(0,10),r.randint(0,10)), (r.randint(0,10),r.randint(0,10))),
         edges=[((0,0,5,0,0,5,0,2,2,0), "3"), ((0,0,1,1,2,2,0,0,1,1), "0"), ((0,0,10,0,0,10,10,10,5,5), "2")],
         code="""import sys\ndef solve(raw):\n x1,y1,x2,y2,x3,y3,xp,yp,xq,yq=map(int,raw.split()); a=(x1,y1);b=(x2,y2);c=(x3,y3)\n cross=lambda u,v,w:(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0])\n area=cross(a,b,c)\n if area==0:return '0'\n def inside(p):\n  z=[cross(a,b,p),cross(b,c,p),cross(c,a,p)];return not(any(q<0 for q in z) and any(q>0 for q in z))\n p=inside((xp,yp));q=inside((xq,yq));return str(3 if p and q else 1 if p else 2 if q else 4)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\ndef solve(raw):\n x1,y1,x2,y2,x3,y3,xp,yp,xq,yq=map(int,raw.split());a=(x1,y1);b=(x2,y2);c=(x3,y3)\n cr=lambda u,v,w:(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0])\n if cr(a,b,c)==0:return '0'\n def ok(p):\n  z=[cr(a,b,p),cr(b,c,p),cr(c,a,p)];return all(v>0 for v in z) or all(v<0 for v in z)\n p=ok((xp,yp));q=ok((xq,yq));return str(3 if p and q else 1 if p else 2 if q else 4)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n x1,y1,x2,y2,x3,y3,xp,yp,xq,yq=map(int,raw.split());a=(x1,y1);b=(x2,y2);c=(x3,y3)\n cr=lambda u,v,w:(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0])\n if cr(a,b,c)==0:return '0'\n def ok(p):\n  z=[cr(a,b,p),cr(b,c,p),cr(c,a,p)];return not(any(v<0 for v in z) and any(v>0 for v in z))\n p=ok((xp,yp));q=ok((xq,yp));return str(3 if p and q else 1 if p else 2 if q else 4)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="用有向面积叉积判断三角形非退化，再检查点与三条边的叉积符号是否一致。零叉积允许点落在边界。",
         proof="三角形面积非零当且仅当三顶点不共线。对非退化三角形，点在内部或边界当且仅当相对三条有向边的叉积全非负或全非正；这包含边界。分别判定 p 和 q 后依题面映射情形编号。",
         complexity="时间 O(1)，空间 O(1)。"),
    dict(id=31, title="Project Estimates", tags=["数组", "哈希表"],
         desc="给定互不相同的项目成本和目标差值，统计无序数值对中绝对差恰为 target 的不同数值对数量。",
         input="第一行 n target（1≤n≤200000，1≤target≤10^9），第二行 n 个互不相同的正整数成本（≤2×10^9）。本站按原题示例将 n 下界补为 1。",
         output="输出绝对差等于 target 的无序数值对数量。",
         encode=enc31, oracle=oracle31,
         samples=[([1, 5, 3, 4, 2], 2), ([1, 3, 5], 2), ([1, 2, 8, 12], 10)],
         random=lambda r: (lambda arr: (arr, r.randint(1, 20)))(r.sample(range(1, 100), r.randint(1, 24))),
         edges=[((list(range(1,100001)), 1), "99999"), (([1, 1000000000], 999999999), "1"), (([2, 3, 4], 1), "2")],
         code="""import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,target=t[:2];s=set(t[2:2+n]);return str(sum(x+target in s for x in s))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
         mutantCode=["""import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,target=t[:2];s=set(t[2:2+n]);return str(sum((x-target in s)+(x+target in s) for x in s))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,target=t[:2];s=set(t[2:2+n]);return str(sum(x+target in s for x in s)//2)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
         idea="把成本放入哈希集合；对每个 x 检查 x+target 是否存在。因为 target>0，每个无序对只从较小值计数一次。",
         proof="若无序对 {x,y} 的绝对差为正 target，则恰有较小值 x 和较大值 y=x+target。遍历每个成本并检查其加 target 是否在集合中，与每个合法数值对一一对应。",
         complexity="平均时间 O(n)，空间 O(n)。"),
]

SPECS = [spec for spec in SPECS if spec["id"] != 18]
SPECS.append(dict(
    id=22, title="Effective Manager", tags=["贪心", "排序"],
    desc="每场会议对指数产生一个整数增减值。可以重新安排会议顺序，求能使指数在每次会议后都严格大于 0 的最大连续会议数。指数初值为 0；一旦无法保持正数即结束该安排。",
    input="第一行 n（1..100000），第二行 n 个整数 effectiveness[i]（−10^9..10^9）。",
    output="输出最多能连续参加且每次结束后指数都严格为正的会议数。",
    encode=enc22, oracle=oracle22,
    samples=[[1, -20, 3, -2], [0], [1, -1, 1]],
    random=lambda r: [r.randint(-9, 9) for _ in range(r.randint(1, 10))],
    edges=[([5] * 100000, "100000"), ([-1] * 100000, "0"), ([1, -1, 1, -1], "3")],
    code="""import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; a=sorted(t[1:1+n],reverse=True); total=count=0\n for value in a:\n  if total+value<=0: break\n  total+=value; count+=1\n return str(count)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""",
    mutantCode=["""import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0];a=t[1:1+n];total=count=0\n for value in a:\n  if total+value<=0:break\n  total+=value;count+=1\n return str(count)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n""", """import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];a=sorted(t[1:1+n],reverse=True);total=count=0\n for value in a:\n  if total+value<0:break\n  total+=value;count+=1\n return str(count)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n"""],
    idea="按 effectiveness 从大到小排序，依次加入会议；只要新的累计指数仍严格大于 0 就保留，否则后续值不可能挽回该前缀。",
    proof="对任意长度为 k 的可行安排，交换相邻的较小值 x 与较大值 y：原顺序 x,y 的第一个前缀较低，交换成 y,x 不会降低这两个位置的任一累计和。因此存在按非增序排列的最优可行前缀。按降序扫描时，若加入当前值后指数不大于 0，所有剩余值不大于它；任何包含它们的完整前缀和也无法保持正数，故停止。扫描所得前缀可行且不能再延长。",
    complexity="时间 O(n log n)，空间 O(n)。"))

BLOCKED = {
    11: "原题允许任意数组元素改值但只扣每次修改成本；未明确选中的元素能否改、改值是否必须不同以及 maxValue 极大时可行值搜索的闭合条件，暂不以整理版算法推断规则。",
    12: "原文同时写“key digits cyclically”和“key ends first, remaining characters unchanged”，两种重复次数规则互相冲突；数字 0 对编码/解码也没有规定一致行为。",
    13: "原始 fastprep 正文截断在“random numbe…”，只剩样例，缺少每次发玩具的步长/完整规则，无法核实函数参数 D 的含义。",
    14: "原文约束未知，且要求在任意升降比较模式下重排另一组数并最大化相邻绝对差；现有整理解法的局部峰谷分配没有证明全局最优，不能可靠判定。",
    15: "规则与 #10 Alphanumeric Combinations 完全重复（数字串按 1..26 映射字母并计数），且原文未提供长度/输出范围；避免在同一题库重复收录同一语义题。",
    18: "原始样例输入网格 [[0,1],[1,0]] 的起点与终点被两个障碍隔开，按题面规则不可达；但样例输出为 2，解释又把第一行改写成 [[0,0],[1,0]]。源题关键样例自相矛盾，不能任选一版作为判题答案。",
    19: "虽给出操作定义，但 maxOperations 可达 10^9；原始样例解释没有展示选择序列，整理的“取最小两数差”并非题目要求，不能以猜测的贪心判定。",
    20: "原文称新日志会“rename”同 tag 旧日志，但随后要求统计 transmitted；未说明“within window”按绝对时间差还是只看过去，也未定义移除/新增是否计入传输数。",
    24: "R/L/U 的员工状态前置条件未在原题约束中声明（例如无室内员工时 R/L、无外出员工时 U 如何处理）；本站若补成合法事件序列将新增关键限制，暂不收录。",
    26: "规则本身清楚但现有整理的逆向取模实现存在边界状态风险，当前批次未能对其在全约束域给出可靠的独立证明与验证，因此保留待审，不沿用来源代码。",
    27: "返回值要求每次操作后取集合最大值×最小值，但允许操作后集合为空时结果未定义；原约束没有保证不清空。",
    28: "公式中偶数/奇数下标的初值、交替运算顺序及空子序列计算均未定义，且没有任何 n/元素范围约束。",
    30: "约束在“The given…”处截断；ordinal 后缀、月份大小写以及输入日期是否合法均未完全明确，暂不自行补齐日历有效性规则。",
    32: "窗口描述中的时间点写法损坏（T−5(T−1)…），样例及第一次可报警时刻缺失，不能确定统计首个完整窗口的下标和边界。",
}

RAW_SOURCES = {
    9: ("encryption-validity.md", "72a19d483feb7739087550a206e3ee2239fe383f"),
    10: ("goldman-alphanumeric-combinations.md", "61a39be186a81603921d45ec9da255a25dcee686"),
    16: ("goldman-find-the-damaged-toy.md", "782f3e093c8b5f8c942f095a314b57fe1343ccd7"),
    17: ("goldman-get-min-cores.md", "d615ce68acffdd5def67cd380947e1a3db15805c"),
    18: ("goldman-get-minimum-moves.md", "f6eb6f4129767265de7755d5e666244a5af5a3f3"),
    21: ("longest-subarray.md", "04b3c3c53a35582b8b72214936c95236ddf92e0f"),
    22: ("goldman-max-meetings.md", "da77d2bfef64c7ea50d5f8469ebdb3af06a25b66"),
    23: ("goldman-max-subsequence-length.md", "f75a0ee31bf32bc9fce3774ba22824c4a84e977f"),
    25: ("goldman-min-start.md", "ba12464cde58cb4d0a235347760830e1043d0db9"),
    29: ("points-belong.md", "89d4c9338ec42f3a636f78c132920d9e6ed521a1"),
    31: ("project-estimates.md", "0e52c01983f746bff69b0ad4c8f84a85b14e287f"),
}


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants",
                   "negative-controls", "reviews", "candidate-batches", "validation", "source-evidence"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    manifest, reports, review_items, evidence_items = [], [], [], []
    chosen = {spec["id"] for spec in SPECS}
    for spec in SPECS:
        pid = f"oa-goldman-sachs-{spec['id']}"
        source = SOURCES[pid]
        code = spec["code"]
        ref = OUT / "references" / f"{pid}.py"
        ref.write_text(code)
        rng = random.Random(SEED + spec["id"])
        values = spec["samples"] + [spec["random"](rng) for _ in range(160)]
        oracle_cases = []
        for value in values:
            stdin = spec["encode"](value)
            expected = spec["oracle"](value)
            actual = execute(ref, stdin)
            assert actual == expected, (pid, value, expected, actual)
            oracle_cases.append({"input": stdin, "expectedOutput": expected + "\n"})
        cases = [{"name": f"公开样例 {i+1}", **oracle_cases[i], "hidden": False, "weight": 1}
                 for i in range(3)]
        cases += [{"name": f"随机隐藏验证 {i+1}", **oracle_cases[i+3], "hidden": True, "weight": 1}
                  for i in range(24)]
        for i, (value, expected) in enumerate(spec["edges"], 1):
            stdin = spec["encode"](value)
            assert execute(ref, stdin) == expected, (pid, "edge", value, expected)
            cases.append({"name": f"边界 {i}", "input": stdin, "expectedOutput": expected + "\n",
                          "hidden": True, "weight": 1})
        mutants, controls = [], []
        for i, source_code in enumerate(spec["mutantCode"], 1):
            mutant_path = OUT / "negative-controls" / f"{pid}-{i}.py"
            mutant_path.write_text(source_code)
            rejected = [j for j, case in enumerate(cases)
                        if execute(mutant_path, case["input"]) != case["expectedOutput"].rstrip("\n")]
            assert rejected, (pid, "mutant not killed", i)
            mutants.append({"name": f"错误实现 {i}", "code": source_code})
            controls.append({"name": f"错误实现 {i}", "rejectedByCases": rejected})
        problem = {
            "id": pid, "courseId": "gomall", "lessonId": "00-overview", "title": spec["title"],
            "difficulty": "中等", "tags": ["OA", "Goldman Sachs"] + spec["tags"],
            "description": spec["desc"] + "\n\n本站输入协议及明确写出的补充范围由 CSWork 整理，不冒充原 OA 规则。",
            "input": spec["input"], "output": spec["output"],
            "explanation": "解题思路、正确性证明及复杂度见配套题解。", "hints": [spec["idea"]],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        }
        raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
        normalizer = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
                      "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
                      "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
        normalized_result = subprocess.run(["node", "--import", "tsx", "-e", normalizer], cwd=ROOT,
                                           input=json.dumps(raw_package, ensure_ascii=False), text=True,
                                           capture_output=True)
        if normalized_result.returncode:
            raise RuntimeError(normalized_result.stderr)
        normalized = normalized_result.stdout
        package = json.loads(normalized)
        editorial_text = (f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}"
                          f"\n\n## 复杂度\n\n{spec['complexity']}")
        authored = [{"language": "python", "code": code}]
        editorial = {"schemaVersion": 1, "id": pid, "title": spec["title"],
                     "explanation": editorial_text, "solutions": authored,
                     "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"],
                     "author": "CSWork"}
        for folder, document in (("packages", package), ("oracles", oracle_cases),
                                 ("mutants", mutants), ("editorials", editorial)):
            (OUT / folder / f"{pid}.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        manifest.append({"id": pid, "sourceContentHash": source["contentHash"],
                         "packageChecksum": hashlib.sha256(normalized.encode()).hexdigest(),
                         "editorial": editorial_text, "authoredSolutions": authored})
        reports.append({"id": pid, "oracleCases": len(oracle_cases), "publicCases": 3,
                        "hiddenCases": len(cases) - 3, "negativeControls": controls,
                        "referenceSha256": hashlib.sha256(code.encode()).hexdigest()})
        review_items.append({"id": pid, "status": "authored",
                             "reason": "逐题核对固定 OAMaster 原始快照；本站补充的 I/O 协议与范围已显式写入题面。",
                             "sourceUrls": [source["sourceUrl"]], "sourceContentHashes": [source["contentHash"]],
                             "sourceCommit": CATALOG["source"]["commit"], "catalogContentHash": source["contentHash"]})
        raw_path, raw_blob = RAW_SOURCES[spec["id"]]
        evidence_items.append({"id": pid, "catalogContentHash": source["contentHash"],
                               "sourceUrl": source["sourceUrl"], "status": "authored",
                               "reason": "原始题意可判定；已在题面标明本站输入输出协议及补充限制。",
                               "path": f"fastprep/Goldman Sachs/{raw_path}", "gitBlobSha": raw_blob})
        print(f"{pid}: {len(oracle_cases)} reference/oracle comparisons; {len(cases)} cases; 2 mutants killed", flush=True)

    for number, reason in BLOCKED.items():
        pid = f"oa-goldman-sachs-{number}"
        source = SOURCES[pid]
        review_items.append({"id": pid, "status": "blocked", "reason": reason,
                             "sourceUrls": [source["sourceUrl"]], "sourceContentHashes": [source["contentHash"]],
                             "sourceCommit": CATALOG["source"]["commit"], "catalogContentHash": source["contentHash"]})
        blocked_paths = {
            11:("goldman-decrypt-code-lock.md","bf0aa2fc1557e7e1d8ae65158bcca049491d16a5"),
            12:("goldman-encode-or-decode-message.md","aa8960e85bddbdf42dd2ed6bf7659c3879d1c087"),
            13:("goldman-find-last-kid.md","907870929974ca030d6c91e1b94aa256c1e18fc4"),
            14:("goldman-find-niceness.md","8978a4b2429efd2497a72f74abb93f0b1ab1aa4a"),
            15:("goldman-find-number-of-different-words-that-can-be-formed.md","e4cef876bbe7fde35c452bf23b6f5af539cff2c2"),
            18:("goldman-get-minimum-moves.md","f6eb6f4129767265de7755d5e666244a5af5a3f3"),
            19:("goldman-get-minimum-value.md","e4945accd1072034e106a1213e3e58ed3a521475"),
            20:("goldman-get-number-transmitted-logs.md","e8cfa25a3330882ed99075b80aff26a6d849dd77"),
            24:("goldman-min-chair.md","ef6d198fe91c35934cfbaef0d986beceab15bbd7"),
            26:("is-possible.md","423a616c2fd1c33c6de6d1a62cded0a37750a278"),
            27:("max-min.md","58929dbd6a6b2b12dfd0ace05a9838b4e6b06c48"),
            28:("plus-mult-array.md","fe58c7b9825cdcbb10d12eef848f828abdaf323c"),
            30:("preprocess-date.md","6dabfa26ed5ae04117d8031fed5ecc968c3fb0af"),
            32:("threshold-alerts.md","043929d3d325103734a546acb8c96b3ec9d7fa88"),
        }
        filename, blob = blocked_paths[number]
        evidence_items.append({"id": pid, "catalogContentHash": source["contentHash"],
                               "sourceUrl": source["sourceUrl"], "status": "blocked", "reason": reason,
                               "path": f"fastprep/Goldman Sachs/{filename}", "gitBlobSha": blob})
    batch = "goldman-sachs-remaining"
    (OUT / "candidate-batches" / f"{batch}.json").write_text(
        json.dumps({"schemaVersion":1,"items":manifest}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "validation" / f"{batch}.json").write_text(json.dumps(
        {"schemaVersion":1,"seed":SEED,"problems":reports,
         "note":"Offline authored-reference/oracle/mutant checks only; no source solution code was run and this batch has not been tested against GoJudge."},
        ensure_ascii=False, indent=2) + "\n")
    (OUT / "reviews" / f"{batch}.json").write_text(
        json.dumps({"schemaVersion":1,"items":review_items}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "source-evidence" / f"{batch}.json").write_text(json.dumps(
        {"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master",
         "commit":CATALOG["source"]["commit"],
         "reason":"逐题只读核对不可变 fastprep 原始快照；未执行来源仓库代码。", "items":evidence_items},
        ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
