#!/usr/bin/env python3
"""Author and locally cross-check selected Intuit OA problems.

Only independently written reference/oracle/mutant programs are executed.
This generator does not touch registry.json or run untrusted source code.
"""
from __future__ import annotations

import hashlib
import itertools
import json
import random
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
BATCH = "intuit-next"
SEED = 20261005
SELECTED = (12, 16, 17, 18, 20, 23)
BLOCKED = {
    "oa-intuit-13": "题面只说每根棍子加或减 K，未说明减后能否为负；height 的物理语义和常见变体处理不同，原样例无法消歧。",
}


def compact_hash(value):
    data = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(data.encode()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def toks(values):
    return " ".join(map(str, values))


def solve12(raw):
    n, m = map(int, raw.split())
    return " ".join(str(i % m + 1) for i in range(n))


def solve16(raw):
    s = raw.strip()
    best = -1
    start = 0
    for i, ch in enumerate(s + "0"):
        if ch.isdigit():
            if any(c.isupper() for c in s[start:i]):
                best = max(best, i - start)
            start = i + 1
    return str(best)


def solve17(raw):
    v = list(map(int, raw.split()))
    n, m = v[:2]
    a = [v[2 + r * m : 2 + (r + 1) * m] for r in range(n)]
    best = None
    prefix = [[0] * m for _ in range(n)]
    for r in range(n):
        for c in range(m):
            prev = []
            if r:
                prev.append(prefix[r - 1][c])
            if c:
                prev.append(prefix[r][c - 1])
            if prev:
                minimum = min(prev)
                candidate = a[r][c] - minimum
                best = candidate if best is None else max(best, candidate)
                prefix[r][c] = min(a[r][c], minimum)
            else:
                prefix[r][c] = a[r][c]
    return str(best)


def solve18(raw):
    v = list(map(int, raw.split()))
    n = v[0]
    ranges = v[1 : n + 2]
    costs = v[n + 2 : 2 * n + 3]
    dp = [None] * (n + 1)
    dp[0] = 0
    for right in range(1, n + 1):
        best = None
        low = max(0, right - 200)
        base_by_left = {}
        prefix_best = None
        for x in range(right - 1, low - 1, -1):
            if dp[x] is not None:
                prefix_best = dp[x] if prefix_best is None else min(prefix_best, dp[x])
            base_by_left[x] = prefix_best
        for i in range(max(0, right - 100), min(n, right + 100) + 1):
            radius, cost = ranges[i], costs[i]
            left = max(0, i - radius)
            far = min(n, i + radius)
            if far < right or left >= right:
                continue
            base = base_by_left[left]
            if base is not None:
                value = base + cost
                best = value if best is None else min(best, value)
        dp[right] = best
    return str(-1 if dp[n] is None else dp[n])


def solve20(raw):
    v = list(map(int, raw.split()))
    n = v[0]
    return str(max(Counter(v[1 : n + 1]).values()))


def solve23(raw):
    v = list(map(int, raw.split()))
    n, m = v[:2]
    grid = [v[2 + r * m : 2 + (r + 1) * m] for r in range(n)]
    q = [(r, c) for r in range(n) for c in range(m) if grid[r][c] == 2]
    healthy = sum(cell == 1 for row in grid for cell in row)
    seconds = 0
    while q and healthy:
        nxt = []
        for r, c in q:
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr, cc = r + dr, c + dc
                if 0 <= rr < n and 0 <= cc < m and grid[rr][cc] == 1:
                    grid[rr][cc] = 2
                    healthy -= 1
                    nxt.append((rr, cc))
        if not nxt:
            return "-1"
        q = nxt
        seconds += 1
    return str(seconds if healthy == 0 else -1)


def encode12(x):
    n, m = x
    return f"{n} {m}\n"


def encode16(x):
    return x + "\n"


def encode17(a):
    return f"{len(a)} {len(a[0])}\n" + "\n".join(toks(row) for row in a) + "\n"


def encode18(x):
    n, ranges, costs = x
    return f"{n}\n{toks(ranges)}\n{toks(costs)}\n"


def encode20(a):
    return f"{len(a)}\n{toks(a)}\n"


def encode23(a):
    return encode17(a)


def brute12(x):
    n, m = x
    best_count = -1
    answer = None
    for a in itertools.product(range(1, m + 1), repeat=n):
        count = sum(len(set(a[l:r])) == r - l for l in range(n) for r in range(l + 1, n + 1))
        if count > best_count or (count == best_count and a < answer):
            best_count, answer = count, a
    return " ".join(map(str, answer))


def brute16(s):
    best = -1
    for left in range(len(s)):
        for right in range(left + 1, len(s) + 1):
            part = s[left:right]
            if not any(ch.isdigit() for ch in part) and any(ch.isupper() for ch in part):
                best = max(best, len(part))
    return str(best)


def brute17(a):
    n, m = len(a), len(a[0])
    candidates = [a[r2][c2] - a[r1][c1]
                  for r1 in range(n) for c1 in range(m)
                  for r2 in range(r1, n) for c2 in range(c1, m)
                  if (r1, c1) != (r2, c2)]
    return str(max(candidates))


def brute18(x):
    n, ranges, costs = x
    intervals = [(max(0, i - r), min(n, i + r)) for i, r in enumerate(ranges)]
    best = None
    for mask in range(1 << (n + 1)):
        cost = sum(costs[i] for i in range(n + 1) if mask >> i & 1)
        if best is not None and cost >= best:
            continue
        covered = 0
        started = False
        while True:
            far = covered
            for i, (left, right) in enumerate(intervals):
                if mask >> i & 1 and left <= covered < right:
                    started = True
                    far = max(far, right)
            if far == covered:
                break
            covered = far
            if covered >= n:
                break
        if started and covered >= n:
            best = cost if best is None else min(best, cost)
    return str(-1 if best is None else best)


def brute20(a):
    a = sorted(a)
    tails = []
    best = len(a)
    def assign(i):
        nonlocal best
        if len(tails) >= best:
            return
        if i == len(a):
            best = len(tails)
            return
        size = a[i]
        seen = set()
        for j, tail in enumerate(tails):
            if tail < size and tail not in seen:
                seen.add(tail)
                old = tails[j]
                tails[j] = size
                assign(i + 1)
                tails[j] = old
        tails.append(size)
        assign(i + 1)
        tails.pop()
    assign(0)
    return str(best)


def brute23(a):
    n, m = len(a), len(a[0])
    cells = [row[:] for row in a]
    healthy = sum(x == 1 for row in cells for x in row)
    if healthy == 0:
        return "0"
    seconds = 0
    while healthy:
        spread = [(r, c) for r in range(n) for c in range(m) if cells[r][c] == 2
                  for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0))
                  if 0 <= r + dr < n and 0 <= c + dc < m and cells[r + dr][c + dc] == 1]
        fresh = {(r + dr, c + dc) for r, c in spread for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0))
                 if 0 <= r + dr < n and 0 <= c + dc < m and cells[r + dr][c + dc] == 1}
        if not fresh:
            return "-1"
        for r, c in fresh:
            cells[r][c] = 2
        healthy -= len(fresh)
        seconds += 1
    return str(seconds)


ORACLES = {12: brute12, 16: brute16, 17: brute17, 18: brute18, 20: brute20, 23: brute23}
ENCODERS = {12: encode12, 16: encode16, 17: encode17, 18: encode18, 20: encode20, 23: encode23}


def random_input(q, rng):
    if q == 12:
        return rng.randint(1, 6), rng.randint(1, 4)
    if q == 16:
        alphabet = "abczABXZ0129"
        return "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 24)))
    if q == 17:
        n, m = rng.randint(2, 6), rng.randint(2, 6)
        return [[rng.randint(0, 20) for _ in range(m)] for _ in range(n)]
    if q == 18:
        n = rng.randint(1, 8)
        return n, [rng.randint(0, 4) for _ in range(n + 1)], [rng.randint(0, 10) for _ in range(n + 1)]
    if q == 20:
        return [rng.randint(1, 7) for _ in range(rng.randint(1, 9))]
    n, m = rng.randint(1, 7), rng.randint(1, 7)
    return [[rng.randint(0, 2) for _ in range(m)] for _ in range(n)]


SAMPLES = {
    12: [(1, 2), (2, 1), (2, 2)],
    16: ["k3Cb", "k3uu", "aB2CD"],
    17: [[[1, 2, 13, 0], [15, 26, 7, 48], [99, 86, 11, 12], [92, 89, 0, 99]],
         [[5, 1], [2, 8]], [[0, 4], [3, 2]]],
    18: [(3, [1, 0, 0, 1], [3, 5, 5, 3]),
         (4, [0, 0, 0, 0, 0], [1, 1, 1, 1, 1]),
         (2, [2, 0, 0], [7, 0, 0])],
    20: [[2, 2, 3, 3], [1, 2, 2, 3, 4, 5], [4]],
    23: [[[2, 1, 1], [1, 1, 1], [1, 1, 2]],
         [[2, 0, 1], [0, 0, 1]], [[0, 0], [0, 0]]],
}


REF_CODE = {
12: '''import sys\nn,m=map(int,sys.stdin.buffer.read().split())\nprint(" ".join(str(i%m+1) for i in range(n)))\n''',
16: '''import sys\ns=sys.stdin.buffer.readline().decode().strip();best=-1;start=0\nfor i,ch in enumerate(s+"0"):\n    if ch.isdigit():\n        if any(c.isupper() for c in s[start:i]):best=max(best,i-start)\n        start=i+1\nprint(best)\n''',
17: '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];a=[v[2+r*m:2+(r+1)*m] for r in range(n)];p=[[0]*m for _ in range(n)];ans=None\nfor r in range(n):\n    for c in range(m):\n        prev=[]\n        if r:prev.append(p[r-1][c])\n        if c:prev.append(p[r][c-1])\n        if prev:\n            low=min(prev);z=a[r][c]-low;ans=z if ans is None else max(ans,z);p[r][c]=min(a[r][c],low)\n        else:p[r][c]=a[r][c]\nprint(ans)\n''',
18: '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n=v[0];rs=v[1:n+2];cs=v[n+2:2*n+3];dp=[None]*(n+1);dp[0]=0\nfor right in range(1,n+1):\n    best=None\n    for i,(r,cost) in enumerate(zip(rs,cs)):\n        left=max(0,i-r);far=min(n,i+r)\n        if far<right or left>=right:continue\n        base=min((x for x in dp[left:right] if x is not None),default=None)\n        if base is not None:best=base+cost if best is None else min(best,base+cost)\n    dp[right]=best\nprint(-1 if dp[n] is None else dp[n])\n''',
20: '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n=v[0];a=v[1:n+1];print(max(a.count(x) for x in set(a)))\n''',
23: '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];g=[v[2+r*m:2+(r+1)*m] for r in range(n)];q=[(r,c) for r in range(n) for c in range(m) if g[r][c]==2];left=sum(x==1 for row in g for x in row);t=0\nwhile q and left:\n    nxt=[]\n    for r,c in q:\n        for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n            x,y=r+dr,c+dc\n            if 0<=x<n and 0<=y<m and g[x][y]==1:g[x][y]=2;left-=1;nxt.append((x,y))\n    if not nxt:print(-1);break\n    q=nxt;t+=1\nelse:print(t)\n''',
}


# These two references use linear-frequency counting / radius-bounded scans
# on the full official input limits.
REF_CODE[18] = """import sys
v=list(map(int,sys.stdin.buffer.read().split()));n=v[0];rs=v[1:n+2];cs=v[n+2:2*n+3];dp=[None]*(n+1);dp[0]=0
for right in range(1,n+1):
    best=None
    low=max(0,right-200);base_by_left={};prefix_best=None
    for x in range(right-1,low-1,-1):
        if dp[x] is not None:prefix_best=dp[x] if prefix_best is None else min(prefix_best,dp[x])
        base_by_left[x]=prefix_best
    for i in range(max(0,right-100),min(n,right+100)+1):
        r,cost=rs[i],cs[i];left=max(0,i-r);far=min(n,i+r)
        if far<right or left>=right:continue
        base=base_by_left[left]
        if base is not None:best=base+cost if best is None else min(best,base+cost)
    dp[right]=best
print(-1 if dp[n] is None else dp[n])
"""
REF_CODE[20] = """import sys
from collections import Counter
v=list(map(int,sys.stdin.buffer.read().split()));n=v[0];print(max(Counter(v[1:n+1]).values()))
"""
REF_CODE[23] = """import sys
v=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];g=[v[2+r*m:2+(r+1)*m] for r in range(n)];q=[(r,c) for r in range(n) for c in range(m) if g[r][c]==2];left=sum(x==1 for row in g for x in row);t=0
while q and left:
    nxt=[]
    for r,c in q:
        for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
            x,y=r+dr,c+dc
            if 0<=x<n and 0<=y<m and g[x][y]==1:g[x][y]=2;left-=1;nxt.append((x,y))
    q=nxt;t+=1
print(t if left==0 else -1)
"""


MUTANTS = {
12: [
    ("所有位置都放同一类型", '''import sys\nn,m=map(int,sys.stdin.buffer.read().split());print(" ".join(["1"]*n))\n'''),
    ("周期错误地使用 m+1 种坦克", '''import sys\nn,m=map(int,sys.stdin.buffer.read().split());print(" ".join(str(i%(m+1)+1) for i in range(n)))\n'''),
],
16: [
    ("遗漏必须包含大写字母", '''import sys\ns=sys.stdin.readline().strip();best=0;run=0\nfor c in s+"0":\n    if c.isdigit():best=max(best,run);run=0\n    else:run+=1\nprint(best if best else -1)\n'''),
    ("错误地允许数字出现在密码段中", '''import sys\ns=sys.stdin.readline().strip();best=0\nfor i in range(len(s)):\n for j in range(i+1,len(s)+1):\n  if any(c.isupper() for c in s[i:j]):best=max(best,j-i)\nprint(best if best else -1)\n'''),
],
17: [
    ("忽略右/下可达约束，任意格子配对", '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];a=v[2:];print(max(a)-min(a))\n'''),
    ("只比较相邻单步奖励", '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];a=[v[2+r*m:2+(r+1)*m] for r in range(n)];ans=None\nfor r in range(n):\n for c in range(m):\n  for x,y in ((r+1,c),(r,c+1)):\n   if x<n and y<m:\n    z=a[x][y]-a[r][c];ans=z if ans is None else max(ans,z)\nprint(ans)\n'''),
],
18: [
    ("贪心选择当前位置可达最远的喷头", '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n=v[0];rs=v[1:n+2];cs=v[n+2:2*n+3];x=0;total=0;used=set()\nwhile x<n:\n opts=[(min(n,i+r),-cs[i],i) for i,r in enumerate(rs) if max(0,i-r)<=x<min(n,i+r) and i not in used]\n if not opts:print(-1);break\n far,neg,i=max(opts);used.add(i);total-=neg;x=far\nelse:print(total)\n'''),
    ("把所有可用喷头的费用都计入", '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n=v[0];rs=v[1:n+2];cs=v[n+2:2*n+3];print(sum(c for i,(r,c) in enumerate(zip(rs,cs)) if max(0,i-r)<=0 and min(n,i+r)>0))\n'''),
],
20: [
    ("错误地输出不同尺寸数", '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));print(len(set(v[1:])))\n'''),
    ("只计算最小尺寸的出现次数", '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));a=v[1:];print(a.count(min(a)))\n'''),
],
23: [
    ("错误地允许对角线传播", '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];g=[v[2+r*m:2+(r+1)*m] for r in range(n)];q=[(r,c) for r in range(n) for c in range(m) if g[r][c]==2];left=sum(x==1 for row in g for x in row);t=0\nwhile q and left:\n nxt=[]\n for r,c in q:\n  for dr in (-1,0,1):\n   for dc in (-1,0,1):\n    x,y=r+dr,c+dc\n    if 0<=x<n and 0<=y<m and g[x][y]==1:g[x][y]=2;left-=1;nxt.append((x,y))\n if not nxt:print(-1);break\n q=nxt;t+=1\nelse:print(t)\n'''),
    ("把空格也当成必须感染的格子", '''import sys\nv=list(map(int,sys.stdin.buffer.read().split()));n,m=v[:2];g=[v[2+r*m:2+(r+1)*m] for r in range(n)];q=[(r,c) for r in range(n) for c in range(m) if g[r][c]==2];need=sum(x!=2 for row in g for x in row);t=0\nwhile q and need:\n nxt=[]\n for r,c in q:\n  for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):\n   x,y=r+dr,c+dc\n   if 0<=x<n and 0<=y<m and g[x][y]!=2:g[x][y]=2;need-=1;nxt.append((x,y))\n if not nxt:print(-1);break\n q=nxt;t+=1\nelse:print(t)\n'''),
],
}


META = {
12: ("坦克阵列", "中等", "用 1..m 号坦克排成长度 n 的序列，使所有只含不同类型的连续子数组数量最大；若有多种序列，输出字典序最小者。", "输入 n m，1≤n≤100000，1≤m≤10000000。输出 n 个整数，空格分隔。", "按 1,2,…,m 循环构造。", "长度不超过 m 的每个区间最多贡献一个符合条件的子数组，长度大于 m 的区间不可能全异；上界为 Σ(n−ℓ+1)，ℓ=1..min(n,m)。循环序列令每个长度≤m的窗口都互异，达到该上界。字典序最小的构造必须每次选前 m−1 个位置中未出现过的最小类型，因此就是 1,2,…,m 循环。", "时间 O(n)，辅助空间 O(1)（不计输出）。", 1800010),
16: ("最长密码片段", "简单", "找最长连续子串：不能包含数字，且至少含一个大写英文字母；没有符合条件的子串输出 -1。", "输入一行仅含 a-z、A-Z、0-9 的字符串，1≤长度≤200。", "数字把字符串分成纯字母段；含大写字母的段才有效。", "任一合法子串都不能跨过数字，因此完全位于一个数字分隔出的字母段中；对每段检查是否含大写即可。", "时间 O(n)，空间 O(1)。", 210),
17: ("矩阵传球的最大总奖励", "中等", "球可以从任一球员开始，在矩阵中只向右或向下传递，且至少经过两名球员。每次接球奖励为接球格数值减传球格数值，求最大累计奖励。", "输入 N M（2≤N,M≤1000），随后 N 行每行 M 个整数。题源约束在矩阵值处截断；本站补充 0≤a[i][j]≤10000。输出最大累计奖励。", "扫描矩阵，维护到当前位置可达的先前格子的最小值，再用当前值减去它。", "路径上每次奖励为后格减前格，累计和望远镜化为终点减起点。能单调向右/下到达的起终点恰满足行列都不下降且不同；每个终点只需减去可达先前格中的最小值。用上方和左方前缀最小值并入当前值，即可 O(NM) 扫描。", "时间 O(NM)，空间 O(NM)；最大绝对累计奖励不超过10000。", 6010010),
18: ("花园喷头最低费用", "中等", "花园为连续区间 [0,N]，位置0至N各有一个喷头。位置 i、范围 r 的喷头浇灌闭区间 [i-r,i+r]；开启一个喷头付一次费用。求完整覆盖花园的最低总费用，不可覆盖时输出 -1。", "输入 N（1≤N≤10000），下一行 N+1 个范围（0..100），再下一行 N+1 个费用（0..10000）。", "区间覆盖动态规划：dp[x] 是覆盖 [0,x] 的最低费用。以一个喷头扩展已覆盖前缀时，前缀终点必须落在喷头的覆盖区间内；利用半径上界直接扫描前驱。", "任意最优方案按开启次序可视为一串相互重叠且向右扩展的区间。最后一个喷头可从任一已覆盖终点 L≤x<R 继续覆盖到 R；反过来每次这样的扩展都保持前缀无缺口。因此按右端点递增取所有有效前驱的最低 dp 值，枚举所有可能的最后喷头即可得到最优值。", "时间 O(N·201)，空间 O(N)。费用非负，答案最大不超过100010000。", 120020),
        20: ("套娃后剩余数量", "简单", "把较小尺寸的娃娃装进更大尺寸的娃娃；相同尺寸不能互套。全部尽量嵌套后，输出剩下的最少娃娃数。", "输入 N（1≤N≤100000），下一行 N 个尺寸（1..100000）。", "统计每个尺寸的出现次数，答案为最大频次。", "每个嵌套链中每个尺寸至多出现一次，所以出现次数最多的尺寸至少需要同样多条链。反过来把尺寸排序，并按序号轮流分配到该数量的链；同一链尺寸严格增加，所有娃娃均可放入链中。", "时间 O(N)，空间 O(N)。", 700010),
23: ("病毒扩散时间", "中等", "网格中 0 为空地、1 为健康细胞、2 为带病毒细胞。每秒病毒只会传到上下左右相邻的健康细胞。输出所有健康细胞被感染所需的最短秒数；若有细胞永远无法感染则输出 -1。", "输入 N M（1..100），随后 N 行 M 个整数（0..2）。", "把所有初始病毒格同时作为 BFS 起点，按层感染健康格。", "多源 BFS 的第 t 层正是最少 t 秒可达的格子。最晚被感染健康格的层数为完成时间；若结束后仍有健康格，它与所有病毒格不连通，应返回 -1。无健康格时答案是0。", "时间 O(NM)，空间 O(NM)。", 30200),
}


def build_cases(q, rng):
    encode, oracle = ENCODERS[q], ORACLES[q]
    extra_formal = {
        17: [[[100, 0], [0, 100]], [[0, 4, 1], [0, 0, 6]]],
        23: [[[2, 0], [0, 1]]],
    }.get(q, [])
    formal_values = SAMPLES[q] + extra_formal + [random_input(q, rng) for _ in range(30 - len(extra_formal))]
    formal = []
    for i, value in enumerate(formal_values):
        name = f"样例 {i+1}" if i < 3 else f"边界与组合 {i-2}"
        formal.append(dict(name=name, input=encode(value), expectedOutput=oracle(value) + "\n", hidden=i >= 3, weight=1))
    oracle_values = SAMPLES[q] + extra_formal + [random_input(q, rng) for _ in range(160 - len(extra_formal))]
    oracle_tests = [dict(input=encode(value), expectedOutput=oracle(value) + "\n") for value in oracle_values]
    edge_specs = {
        12: [((100000,100000), None), ((100000,1), None), ((100000,2), None)],
        16: [("A" + "a"*198 + "9", "199"), ("a"*200, "-1"), ("9"*199 + "Z", "1")],
        17: [([[0]*1000 for _ in range(1000)], "0"), ([[r*9+c//100 for c in range(1000)] for r in range(1000)], "9000")],
        18: [((10000,[100]*10001,[1]*10001), "50"), ((10000,[0]*10001,[0]*10001), "-1")],
        20: [([1]*100000, "100000"), ([i%100000+1 for i in range(100000)], "1")],
        23: [([[2]+[1]*98+[2] for _ in range(100)], None), ([[0]*100 for _ in range(100)], "0")],
    }[q]
    edges = []
    for value, expected in edge_specs:
        if expected is not None:
            out = expected
        elif q == 12:
            n, m = value
            out = " ".join(str(i % m + 1) for i in range(n))
        else:
            out = oracle(value)
        edges.append(dict(input=encode(value), expectedOutput=out + "\n"))
    for case in edges:
        oracle_tests.append(dict(input=case["input"], expectedOutput=case["expectedOutput"]))
    return formal, oracle_tests, edges


def local_run(path, cases):
    proc = subprocess.run([sys.executable, "-I", str(ROOT / "scripts/oa-judge/local_batch_runner.py"), str(path)],
                          input=json.dumps([case["input"] for case in cases]), text=True,
                          capture_output=True, timeout=300, check=True)
    return json.loads(proc.stdout)


def main():
    for folder in ("packages", "references", "oracles", "mutants", "negative-controls", "editorials", "batches", "candidate-batches", "validation", "reviews"):
        (OA / folder).mkdir(parents=True, exist_ok=True)
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    sources = {item["id"]: item for item in catalog["items"]}
    items, reports, review_items = [], [], []
    for q in SELECTED:
        ident = f"oa-intuit-{q}"
        rng = random.Random(SEED + q)
        formal, oracles, edges = build_cases(q, rng)
        title, difficulty, desc, limits, idea, proof, complexity, input_bound = META[q]
        code = REF_CODE[q]
        problem = dict(id=ident, courseId="gomall", lessonId="00-overview", title=title,
                       difficulty=difficulty, tags=["OA", "Intuit"], description=desc,
                       input=limits, output="按题意输出答案；数组题按空格分隔输出。",
                       explanation=f"{idea}\n\n正确性：{proof}\n\n复杂度：{complexity}",
                       hints=[idea], timeLimit=5, memoryLimit=262144, outputLimit=4096, checker="tokens",
                       languages=["python", "go", "java", "cpp"])
        package = dict(schemaVersion=1, problem=problem, cases=formal)
        write_json(OA / "packages" / f"{ident}.json", package)
        (OA / "references" / f"{ident}.py").write_text(code)
        write_json(OA / "oracles" / f"{ident}.json", oracles)
        mut = [dict(name=name, code=mut_code) for name, mut_code in MUTANTS[q]]
        write_json(OA / "mutants" / f"{ident}.json", mut)
        (OA / "editorials" / f"{ident}.md").write_text(f"# {title}\n\n## 思路\n\n{idea}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{complexity}\n")
        for i, entry in enumerate(mut):
            (OA / "negative-controls" / f"{ident}-{i+1}.py").write_text(entry["code"])
        normalized = json.dumps(package, ensure_ascii=False, separators=(",", ":"))
        source = sources[ident]
        items.append(dict(id=ident, sourceContentHash=source["contentHash"],
                          packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),
                          editorial=f"## 思路\n\n{idea}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{complexity}",
                          authoredSolutions=[dict(language="python", code=code)]))
        reference_out = local_run(OA / "references" / f"{ident}.py", formal + oracles + edges)
        expected = [case["expectedOutput"] for case in formal + oracles + edges]
        if reference_out != expected:
            mismatch = next(i for i, pair in enumerate(zip(reference_out, expected)) if pair[0] != pair[1])
            raise AssertionError(f"{ident} reference mismatch at {mismatch}: actual={reference_out[mismatch][:100]!r}, expected={expected[mismatch][:100]!r}")
        killed = []
        for mutant in mut:
            outputs = local_run(OA / "negative-controls" / f"{ident}-{mut.index(mutant)+1}.py", formal)
            assert len(outputs) == len(formal)
            rejected = [i for i, (out, case) in enumerate(zip(outputs, formal))
                        if out.split() != case["expectedOutput"].split()]
            assert rejected, f"{ident} surviving mutant {mutant['name']}"
            killed.append(dict(name=mutant["name"], rejectedByCases=rejected))
        max_in = max(len(case["input"].encode()) for case in formal + oracles + edges)
        max_out = max(len(case["expectedOutput"].encode()) for case in formal + oracles + edges)
        reports.append(dict(id=ident, oracleCases=len(oracles), publicCases=3, hiddenCases=len(formal)-3,
                            edgeCases=len(edges), negativeControls=killed,
                            referenceSha256=hashlib.sha256(code.encode()).hexdigest(),
                            maxLegalInputBytesUpperBound=input_bound,
                            maxTestInputBytes=max_in, maxTestOutputBytes=max_out))
        print(f"{ident}: {len(oracles)} oracle cases + {len(formal)} formal + {len(edges)} limits; {len(killed)} mutants killed", flush=True)
        review_items.append(dict(id=ident, status="authored", reason="已核对 e66f809 原始快照题面；独立暴力 oracle、边界与正常退出错误程序验证完成。"))
    candidate = dict(schemaVersion=1, items=items)
    write_json(OA / "candidate-batches" / f"{BATCH}.json", candidate)
    write_json(OA / "validation" / f"{BATCH}.json", dict(schemaVersion=1, seed=SEED, problems=reports,
               skipped=BLOCKED, note="独立 authored reference 与暴力 oracle 本地校验；尚未进行真实 GoJudge 沙箱验证。"))
    write_json(OA / "reviews" / f"{BATCH}.json", dict(schemaVersion=1, items=review_items +
               [dict(id=ident, status="blocked", reason=reason) for ident, reason in BLOCKED.items()]))
    print(f"Wrote candidate-only batch with {len(items)} problems; registry unchanged.", flush=True)


if __name__ == "__main__":
    main()
