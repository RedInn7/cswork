#!/usr/bin/env python3
"""Generate and locally validate the SaaS/tech OAMaster candidate batch.

This is offline authoring evidence only. It does not invoke GoJudge or update
the formal registry, batches, reports, or aggregate coverage snapshot.
"""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEED = 20261006


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def run_code(code, raw):
    namespace = {}
    exec(compile(code, "<candidate>", "exec"), namespace)
    return namespace["solve"](raw).strip()


def spec_duolingo_1(rng):
    def raw(a):
        return str(len(a)) + "\n" + " ".join(map(str, a)) + "\n"

    def oracle(s):
        v = list(map(int, s.split()))
        n, a = v[0], v[1:]
        left, right, out = 0, n - 1, []
        while left <= right:
            out.append(a[left]); left += 1
            if left <= right:
                out.append(a[right]); right -= 1
        return " ".join(map(str, out))

    return {
        "id": "oa-duolingo-1", "company": "Duolingo", "title": "Construct New Array",
        "source": "https://oamaster.com/docs/companies/duolingo#1-construct-new-array",
        "description": "依序取原数组最左、最右、次左、次右……组成新数组。",
        "input": "第一行 n（1≤n≤100000），第二行 n 个整数（−10^9≤a[i]≤10^9）。",
        "output": "按构造顺序输出 n 个整数。",
        "solve": "def solve(raw):\n v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]; out=[]\n for i in range((n+1)//2):\n  out.append(a[i])\n  if i < n-1-i: out.append(a[n-1-i])\n return ' '.join(map(str,out))\n",
        "oracle": oracle, "random": lambda: raw([rng.randint(-10**9, 10**9) for _ in range(rng.randint(1, 35))]),
        "samples": [raw([0, 4, 3, 2, 1]), raw([-5, 4, 0, 3, 2, 2])],
        "mutants": [
            ("忽略尾端交错，始终从前向后取", "def solve(raw):\n v=list(map(int,raw.split())); return ' '.join(map(str,v[1:1+v[0]]))\n"),
            ("从右端开始交错", "def solve(raw):\n v=list(map(int,raw.split())); n=v[0]; a=v[1:]; o=[]\n for i in range((n+1)//2):\n  o.append(a[n-1-i])\n  if i<n-1-i:o.append(a[i])\n return ' '.join(map(str,o))\n"),
        ],
    }


def spec_flexport_7(rng):
    def raw(a):
        return "\n".join(" ".join(map(str, row)) for row in a) + "\n"

    def oracle(s):
        a = [list(map(int, line.split())) for line in s.splitlines()]
        best = 10**9
        def visit(r, c, cost):
            nonlocal best
            cost += a[r][c]
            if r == 3:
                best = min(best, cost); return
            for nc in range(max(0, c-1), min(3, c+1)+1):
                visit(r+1, nc, cost)
        for c in range(4): visit(0, c, 0)
        return str(100-best)

    return {
        "id": "oa-flexport-7", "company": "Flexport", "title": "Matrix Traversal",
        "source": "https://oamaster.com/docs/companies/flexport#7-matrix-traversal",
        "description": "从 4×4 矩阵第一行任意格出发，每步向下一行相邻列移动，最大化初始 100 能量减去经过格子的数值总和。",
        "input": "输入 4 行，每行 4 个整数（0≤mat[i][j]<100）。",
        "output": "输出到达末行后可剩余的最大能量，可为负数。",
        "solve": "def solve(raw):\n a=[list(map(int,x.split())) for x in raw.splitlines() if x.strip()]; dp=a[0][:]\n for r in range(1,4):\n  dp=[a[r][c]+min(dp[k] for k in range(max(0,c-1),min(3,c+1)+1)) for c in range(4)]\n return str(100-min(dp))\n",
        "oracle": oracle,
        "random": lambda: raw([[rng.randrange(100) for _ in range(4)] for _ in range(4)]),
        "samples": [raw([[10,20,30,40],[60,50,20,80],[10,10,10,10],[60,50,60,50]])],
        "mutants": [
            ("把最小花费路径误作最大花费路径", "def solve(raw):\n a=[list(map(int,x.split())) for x in raw.splitlines() if x.strip()]; d=a[0][:]\n for r in range(1,4): d=[a[r][c]+max(d[k] for k in range(max(0,c-1),min(3,c+1)+1)) for c in range(4)]\n return str(100-min(d))\n"),
            ("每步只允许停留在同一列", "def solve(raw):\n a=[list(map(int,x.split())) for x in raw.splitlines() if x.strip()]; return str(100-min(sum(a[r][c] for r in range(4)) for c in range(4)))\n"),
        ],
    }


def spec_flexport_8(rng):
    def raw(rec, k):
        return f"{len(rec)} {k}\n" + " ".join(map(str, rec)) + "\n"

    def oracle(s):
        v=list(map(int,s.split())); n,k=v[:2]; rec=v[2:2+n]
        # Independent binary lifting oracle, rather than cycle detection.
        jumps=[rec]
        while (1 << len(jumps)) <= k:
            prev=jumps[-1]; jumps.append([prev[prev[i]-1] for i in range(n)])
        cur=1; bit=0
        while k:
            if k&1: cur=jumps[bit][cur-1]
            k >>= 1; bit += 1
        return str(cur)

    def random_input():
        n=rng.randint(2,25)
        rec=[rng.choice([j+1 for j in range(n) if j+1!=i+1]) for i in range(n)]
        return raw(rec,rng.randint(1,1000))

    return {
        "id": "oa-flexport-8", "company": "Flexport", "title": "Throw The Ball",
        "source": "https://oamaster.com/docs/companies/flexport#8-throw-the-ball",
        "description": "从 1 号朋友开始，每秒把球交给 receiver 指定的朋友，求经过给定秒数后的持球者。",
        "input": "第一行 n 和 k（2≤n≤100000，1≤k≤10^12）；第二行 n 个接收者编号（1..n 且不等于对应发送者）。",
        "output": "输出 k 秒后持球朋友的 1-based 编号。",
        "solve": "def solve(raw):\n v=list(map(int,raw.split())); n,k=v[:2]; a=v[2:2+n]; seen={}; path=[]; x=1\n while x not in seen:\n  seen[x]=len(path); path.append(x); x=a[x-1]\n start=seen[x]; cycle=path[start:]; idx=k if k<len(path) else start+(k-start)%len(cycle)\n return str(path[idx])\n",
        "oracle": oracle,
        "random": random_input,
        "samples": [raw([2,4,1,5,3],6),raw([2,4,1,5,3],2001)],
        "mutants": [
            ("忽略重复状态，沿路径直接走到输入秒数", "def solve(raw):\n v=list(map(int,raw.split())); n,k=v[:2]; a=v[2:2+n]; x=1\n for _ in range(min(k,2000)): x=a[x-1]\n return str(x)\n"),
            ("把朋友编号当成零起始编号", "def solve(raw):\n v=list(map(int,raw.split())); n,k=v[:2]; a=v[2:2+n]; x=0\n for _ in range(k%100): x=a[x]-1\n return str(x)\n"),
        ],
    }


def spec_tradedesk_4(rng):
    def raw(a,t): return f"{len(a)} {t}\n"+" ".join(map(str,a))+"\n"
    def oracle(s):
        v=list(map(int,s.split())); n,t=v[:2]; a=v[2:2+n]
        for i in range(n-2):
            if min(a[i:i+3])>t: return str(i)
        return "-1"
    return {
        "id":"oa-tradedesk-4","company":"TradeDesk","title":"Buddies Greater than Target",
        "source":"https://oamaster.com/docs/companies/tradedesk#4-buddies-greater-than-target",
        "description":"找最小下标 i，使连续三项都严格大于 target；不存在时返回 −1。",
        "input":"第一行 n 和 target；第二行 n 个整数。要求 n≥1，数组元素与 target 均在 [−10^9,10^9]。",
        "output":"输出首个满足条件的 0-based 下标；不存在时输出 −1。",
        "solve":"def solve(raw):\n v=list(map(int,raw.split())); n,t=v[:2]; a=v[2:2+n]\n for i in range(n-2):\n  if a[i]>t and a[i+1]>t and a[i+2]>t:return str(i)\n return '-1'\n",
        "oracle":oracle,
        "random":lambda: (lambda a,t: raw(a,t))([rng.randint(-10,10) for _ in range(rng.randint(1,35))],rng.randint(-10,10)),
        "samples":[raw([0,1,4,3,2,5],1)],
        "mutants":[
            ("把严格大于错写成大于等于","def solve(raw):\n v=list(map(int,raw.split())); n,t=v[:2]; a=v[2:]\n for i in range(n-2):\n  if all(x>=t for x in a[i:i+3]):return str(i)\n return '-1'\n"),
            ("只检查前两个元素","def solve(raw):\n v=list(map(int,raw.split())); n,t=v[:2]; a=v[2:]\n for i in range(n-2):\n  if a[i]>t and a[i+1]>t:return str(i)\n return '-1'\n"),
        ],
    }


def spec_ixl_2(rng):
    def raw(p): return str(len(p))+"\n"+"\n".join(f"{r} {c}" for r,c in p)+"\n"
    def oracle(s):
        v=list(map(int,s.split())); n=v[0]; p=list(zip(v[1::2],v[2::2]))[:n]
        if max(max(r for r,c in p),max(c for r,c in p))>80:
            return str(min(r for r,c in p)*min(c for r,c in p))
        rows=max(r for r,c in p); cols=max(c for r,c in p)
        counts=[[sum(i<=r and j<=c for r,c in p) for j in range(1,cols+1)] for i in range(1,rows+1)]
        mx=max(map(max,counts)); return str(sum(row.count(mx) for row in counts))
    return {
        "id":"oa-ixl-2","company":"Ixl","title":"Growth in 2 Dimensions",
        "source":"https://oamaster.com/docs/companies/ixl#2-growth-in-2-dimensions",
        "description":"每个操作把左下角至 (r,c) 的矩形区域加 1；求最终达到最大值的格子数量。",
        "input":"第一行 q（1≤q≤100000），随后 q 行各含正整数 r、c（≤10^9）。",
        "output":"输出达到最大值的格子数（使用 64 位整数）。",
        "solve":"def solve(raw):\n v=list(map(int,raw.split())); n=v[0]; p=list(zip(v[1::2],v[2::2]))[:n]\n return str(min(r for r,c in p)*min(c for r,c in p))\n",
        "oracle":oracle,
        "random":lambda: (lambda p: raw(p))([(rng.randint(1,30),rng.randint(1,30)) for _ in range(rng.randint(1,15))]),
        "samples":[raw([(1,4),(2,3),(4,1)])],
        "mutants":[
            ("错取所有矩形最大行列","def solve(raw):\n v=list(map(int,raw.split())); n=v[0]; p=list(zip(v[1::2],v[2::2]))[:n]\n return str(max(r for r,c in p)*max(c for r,c in p))\n"),
            ("只用首个操作矩形面积","def solve(raw):\n v=list(map(int,raw.split())); return str(v[1]*v[2])\n"),
        ],
    }


def spec_ixl_3(rng):
    def raw(pairs):
        lines=[str(len(pairs))]
        for a,b in pairs: lines += [f"{len(a)} {len(b)}",a or "-",b or "-"]
        return "\n".join(lines)+"\n"
    def oracle(s):
        it=iter(s.splitlines()); q=int(next(it)); out=[]
        for _ in range(q):
            la,lb=map(int,next(it).split()); a=next(it); b=next(it); a="" if a=="-" else a; b="" if b=="-" else b
            if len(a)!=len(b): out.append("-1"); continue
            # Count characters that would have to leave a before the two
            # multisets can match; this is independent of the reference's L1/2.
            out.append(str(sum(max(a.count(chr(97+i))-b.count(chr(97+i)),0) for i in range(26))))
        return "\n".join(out)
    return {
        "id":"oa-ixl-3","company":"Ixl","title":"Anagram Difference",
        "source":"https://oamaster.com/docs/companies/ixl#3-anagram-difference",
        "description":"对每一对小写字符串，求替换任一侧最少字符数使其成为异位词；长度不同返回 −1。",
        "input":"第一行 q（1≤q≤100）；每组输入两行：先给 |a|、|b|，再分别给字符串。空串用单独一行 - 表示；非空字符仅 a-z，长度≤10000。",
        "output":"每组输出一行最小替换数；长度不同输出 −1。",
        "solve":"def solve(raw):\n z=raw.splitlines(); q=int(z[0]); p=1; out=[]\n for _ in range(q):\n  la,lb=map(int,z[p].split()); a=z[p+1]; b=z[p+2]; p+=3; a='' if a=='-' else a; b='' if b=='-' else b\n  if la!=lb:out.append('-1')\n  else:\n   ca=[0]*26; cb=[0]*26\n   for c in a:ca[ord(c)-97]+=1\n   for c in b:cb[ord(c)-97]+=1\n   out.append(str(sum(abs(x-y) for x,y in zip(ca,cb))//2))\n return '\\n'.join(out)\n",
        "oracle":oracle,
        "random":lambda: raw([( ''.join(rng.choice('abcxyz') for _ in range(rng.randrange(16))), ''.join(rng.choice('abcxyz') for _ in range(rng.randrange(16)))) for __ in range(rng.randint(1,6))]),
        "samples":[raw([("tea","ate"),("tea","toe"),("act","acts")])],
        "mutants":[
            ("长度不同时仍计算字符差","def solve(raw):\n z=raw.splitlines(); q=int(z[0]); p=1; out=[]\n for _ in range(q):\n  la,lb=map(int,z[p].split()); a=z[p+1]; b=z[p+2]; p+=3; a='' if a=='-' else a; b='' if b=='-' else b; ca=[a.count(chr(97+i)) for i in range(26)]; cb=[b.count(chr(97+i)) for i in range(26)]; out.append(str(sum(abs(x-y) for x,y in zip(ca,cb))//2) if la==lb else '0')\n return '\\n'.join(out)\n"),
            ("字符频次差未除以二","def solve(raw):\n z=raw.splitlines(); q=int(z[0]); p=1; out=[]\n for _ in range(q):\n  la,lb=map(int,z[p].split()); a=z[p+1]; b=z[p+2]; p+=3; a='' if a=='-' else a; b='' if b=='-' else b\n  out.append('-1' if la!=lb else str(sum(abs(a.count(chr(97+i))-b.count(chr(97+i))) for i in range(26))))\n return '\\n'.join(out)\n"),
        ],
    }


def spec_ixl_4(rng):
    def raw(n,m,h,v): return f"{n} {m} {len(h)} {len(v)}\n"+" ".join(map(str,h))+"\n"+" ".join(map(str,v))+"\n"
    def oracle(s):
        v=list(map(int,s.split())); n,m,hn,vn=v[:4]; h=set(v[4:4+hn]); w=set(v[4+hn:4+hn+vn])
        def run(st):
            best=cur=0; prev=None
            for x in sorted(st):
                cur=cur+1 if prev is not None and x==prev+1 else 1; best=max(best,cur); prev=x
            return best
        return str((run(h)+1)*(run(w)+1))
    return {
        "id":"oa-ixl-4","company":"Ixl","title":"Prison Break",
        "source":"https://oamaster.com/docs/companies/ixl#4-prison-break",
        "description":"分别找出最长连续移除的横栏、竖栏段；最大孔的边长是连续移除长度加 1。",
        "input":"第一行 n、m、|h|、|v|；第二行给移除的横栏编号，第三行给竖栏编号。1≤n,m≤100000，数组非空且编号在对应 1..n/m 内；每根栏最多出现一次。",
        "output":"输出最大孔面积（64 位整数）。",
        "solve":"def solve(raw):\n v=list(map(int,raw.split())); n,m,hn,vn=v[:4]; h=sorted(v[4:4+hn]); w=sorted(v[4+hn:4+hn+vn])\n def run(a):\n  best=cur=0; prev=None\n  for x in a:\n   cur=cur+1 if prev is not None and x==prev+1 else 1; best=max(best,cur); prev=x\n  return best\n return str((run(h)+1)*(run(w)+1))\n",
        "oracle":oracle,
        "random":lambda: (lambda n,m:raw(n,m,sorted(rng.sample(range(1,n+1),rng.randint(1,n))),sorted(rng.sample(range(1,m+1),rng.randint(1,m)))))(rng.randint(1,40),rng.randint(1,40)),
        "samples":[raw(6,6,[1,2,4],[2,3])],
        "mutants":[
            ("忽略连续性，直接数已拆栏杆","def solve(raw):\n v=list(map(int,raw.split())); n,m,hn,vn=v[:4]; return str((hn+1)*(vn+1))\n"),
            ("连续段长度未加一","def solve(raw):\n v=list(map(int,raw.split())); n,m,hn,vn=v[:4]; h=sorted(v[4:4+hn]); w=sorted(v[4+hn:4+hn+vn])\n def run(a):\n  b=c=0; p=None\n  for x in a:\n   c=c+1 if p is not None and x==p+1 else 1; b=max(b,c); p=x\n  return b\n return str(run(h)*run(w))\n"),
        ],
    }


def spec_safetykit_2(rng):
    def raw(cmds): return str(len(cmds))+"\n"+"\n".join(cmds)+"\n"
    def oracle(s):
        lines=s.splitlines(); q=int(lines[0]); out=[]
        for cmd in lines[1:q+1]:
            x=y=d=0; dirs=[(0,1),(1,0),(0,-1),(-1,0)]
            for _ in range(4):
                for c in cmd:
                    if c=='L':d=(d+1)%4
                    elif c=='R':d=(d-1)%4
                    else:x+=dirs[d][0];y+=dirs[d][1]
            out.append('YES' if (x,y)==(0,0) else 'NO')
        return "\n".join(out)
    return {
        "id":"oa-safetykit-2","company":"SafetyKit","title":"Robot Circle Existence (Infinite Loop Boundedness)",
        "source":"https://oamaster.com/docs/companies/safetykit#2-robot-circle-existence-infinite-loop-boundedness",
        "description":"重复执行由 G（前进）、L、R（原地转向）构成的命令串，判断机器人轨迹是否有界。",
        "input":"第一行 q（1≤q≤1000），随后 q 行命令串，长度 1..10000，字符仅 G/L/R。",
        "output":"逐串输出 YES（有界）或 NO（无界）。",
        "solve":"def solve(raw):\n z=raw.split(); q=int(z[0]); ans=[]\n for s in z[1:1+q]:\n  x=y=d=0; dx=[0,1,0,-1]; dy=[1,0,-1,0]\n  for c in s:\n   if c=='L':d=(d+1)%4\n   elif c=='R':d=(d-1)%4\n   else:x+=dx[d];y+=dy[d]\n  ans.append('YES' if (x,y)==(0,0) or d!=0 else 'NO')\n return '\\n'.join(ans)\n",
        "oracle":oracle,
        "random":lambda: raw([''.join(rng.choice('GLR') for _ in range(rng.randint(1,35))) for __ in range(rng.randint(1,8))]),
        "samples":[raw(['G','GL','RGRG'])],
        "mutants":[
            ("只判断单轮后是否回到原点","def solve(raw):\n z=raw.split(); q=int(z[0]); out=[]\n for s in z[1:1+q]:\n  x=y=d=0; dx=[0,1,0,-1]; dy=[1,0,-1,0]\n  for c in s:\n   if c=='L':d=(d+1)%4\n   elif c=='R':d=(d-1)%4\n   else:x+=dx[d];y+=dy[d]\n  out.append('YES' if (x,y)==(0,0) else 'NO')\n return '\\n'.join(out)\n"),
            ("只接受单轮后位置与朝向都未改变","def solve(raw):\n z=raw.split(); q=int(z[0]); out=[]\n for s in z[1:1+q]:\n  x=y=d=0; dx=[0,1,0,-1]; dy=[1,0,-1,0]\n  for c in s:\n   if c=='L':d=(d+1)%4\n   elif c=='R':d=(d-1)%4\n   else:x+=dx[d];y+=dy[d]\n  out.append('YES' if (x,y)==(0,0) and d==0 else 'NO')\n return '\\n'.join(out)\n"),
        ],
    }


def spec_reevo_1(rng):
    def raw(s): return s+"\n"
    def oracle(s):
        text=s.strip(); chunks=[]; i=0
        while i<len(text):
            j=i+1
            while j<len(text) and text[j]==text[i]: j+=1
            chunks.append(text[i]+(str(j-i) if j-i>1 else "")); i=j
        return "".join(chunks)
    return {
        "id":"oa-reevo-1","company":"Reevo","title":"Compression (Run-Length Encoding)",
        "source":"https://oamaster.com/docs/companies/reevo#1-compression-run-length-encoding",
        "description":"从左到右合并相邻同字母段：长度为 1 的只输出字母，长度大于 1 的输出字母及段长。",
        "input":"一行非空小写字母串，长度≤100000。",
        "output":"输出压缩结果。",
        "solve":"def solve(raw):\n s=raw.strip(); out=[]; i=0\n while i<len(s):\n  j=i+1\n  while j<len(s) and s[j]==s[i]:j+=1\n  out.append(s[i]+(str(j-i) if j-i>1 else '')); i=j\n return ''.join(out)\n",
        "oracle":oracle,
        "random":lambda:raw(''.join(rng.choice('abcxyz') for _ in range(rng.randint(1,60)))),
        "samples":[raw('aabbccca')],
        "mutants":[
            ("每个字符都带上计数 1","def solve(raw):\n s=raw.strip(); out=[]; i=0\n while i<len(s):\n  j=i+1\n  while j<len(s) and s[j]==s[i]:j+=1\n  out.append(s[i]+str(j-i)); i=j\n return ''.join(out)\n"),
            ("统计全局频次而非连续段","def solve(raw):\n from collections import Counter\n s=raw.strip(); c=Counter(s); return ''.join(x+(str(c[x]) if c[x]>1 else '') for x in dict.fromkeys(s))\n"),
        ],
    }


def spec_verisk_1(rng):
    def raw(words): return str(len(words))+"\n"+"\n".join(words)+"\n"
    def oracle(s):
        lines=s.splitlines(); q=int(lines[0]); result=[]
        for w in lines[1:q+1]:
            # Dynamic programming over the final replacement character. A
            # replacement can use any lowercase letter, independent per cell.
            dp={None:0}
            for c in w:
                nd={}
                for prev,cost in dp.items():
                    for d in 'abcdefghijklmnopqrstuvwxyz':
                        if d!=prev:
                            nd[d]=min(nd.get(d,10**9),cost+(d!=c))
                dp=nd
            result.append(str(min(dp.values())))
        return "\n".join(result)
    return {
        "id":"oa-verisk-1","company":"Verisk","title":"minimalOperations (Adjacent Duplicate Replacements)",
        "source":"https://oamaster.com/docs/companies/verisk#1-minimaloperations-adjacent-duplicate-replacements",
        "description":"对每个单词求最少字符替换次数，使任意相邻字符不同。",
        "input":"第一行 n（1≤n≤100）；随后 n 行小写单词，每词长度 2..100000。",
        "output":"每个单词对应一行最小替换数。",
        "solve":"def solve(raw):\n z=raw.splitlines(); n=int(z[0]); out=[]\n for s in z[1:1+n]:\n  ans=0; i=0\n  while i<len(s):\n   j=i+1\n   while j<len(s) and s[j]==s[i]:j+=1\n   ans+=(j-i)//2; i=j\n  out.append(str(ans))\n return '\\n'.join(out)\n",
        "oracle":oracle,
        "random":lambda:raw([''.join(rng.choice('aabbccxyz') for _ in range(rng.randint(2,13))) for __ in range(rng.randint(1,12))]),
        "samples":[raw(['add','boook','break'])],
        "mutants":[
            ("每段只要重复就只替换一次","def solve(raw):\n z=raw.splitlines(); n=int(z[0]); out=[]\n for s in z[1:1+n]:\n  out.append(str(sum(s[i]==s[i-1] for i in range(1,len(s)))))\n return '\\n'.join(out)\n"),
            ("只计长度恰为二的重复段","def solve(raw):\n z=raw.splitlines(); n=int(z[0]); out=[]\n for s in z[1:1+n]:\n  ans=0;i=0\n  while i<len(s):\n   j=i+1\n   while j<len(s) and s[j]==s[i]:j+=1\n   ans+=int(j-i==2);i=j\n  out.append(str(ans))\n return '\\n'.join(out)\n"),
        ],
    }


def spec_paypay_3(rng):
    def raw(s): return s+"\n"
    def oracle(s):
        t=s.strip(); pairs=[int(t[i:i+2]) for i in range(len(t)-1)]; return str(max(pairs))
    return {
        "id":"oa-paypay-3","company":"PayPay","title":"Find Maximum Two-Digit Fragment",
        "source":"https://oamaster.com/docs/companies/paypay#3-find-maximum-two-digit-fragment",
        "description":"在数字串所有长度为 2 的连续片段中，求按十进制数值解释后的最大值。",
        "input":"一行数字串 S，长度 2..100000，字符仅 0..9。",
        "output":"输出最大的两位片段数值，前导零按整数解析。",
        "solve":"def solve(raw):\n s=raw.strip(); return str(max(int(s[i:i+2]) for i in range(len(s)-1)))\n",
        "oracle":oracle,
        "random":lambda:raw(''.join(rng.choice('00123456789') for _ in range(rng.randint(2,60)))),
        "samples":[raw('50552')], "directed":[raw('199')],
        "mutants":[
            ("只检查互不重叠的两位片段","def solve(raw):\n s=raw.strip(); return str(max(int(s[i:i+2]) for i in range(0,len(s)-1,2)))\n"),
            ("遗漏最后一个可能的起点","def solve(raw):\n s=raw.strip(); return str(max(int(s[i:i+2]) for i in range(max(1,len(s)-2))))\n"),
        ],
    }


def main():
    rng=random.Random(SEED)
    specs=[spec_duolingo_1(rng),spec_flexport_7(rng),spec_flexport_8(rng),spec_tradedesk_4(rng),spec_ixl_2(rng),spec_ixl_3(rng),spec_ixl_4(rng),spec_safetykit_2(rng),spec_reevo_1(rng),spec_verisk_1(rng),spec_paypay_3(rng)]
    # PayPay #3 closes the tenth slot only if the reviewer accepts it; keep the
    # scope at ten by dropping the least-source-complete narrative task.
    specs=[s for s in specs if s["id"]!="oa-tradedesk-4"]
    assert len(specs)==10
    candidate_items=[]; review_items=[]; source_items=[]; validation_items=[]
    for item in specs:
        pid=item["id"]
        all_directed=item["samples"]+item.get("directed",[])
        oracle_cases=[{"input":raw,"expectedOutput":item["oracle"](raw)+"\n"} for raw in all_directed]
        for _ in range(140):
            raw=item["random"]()
            oracle_cases.append({"input":raw,"expectedOutput":item["oracle"](raw)+"\n"})
        reference_outputs=[run_code(item["solve"],case["input"]) for case in oracle_cases]
        expected_outputs=[case["expectedOutput"].strip() for case in oracle_cases]
        assert reference_outputs==expected_outputs, pid+": reference disagrees with independent oracle"

        # Promote the public examples and 24 seeded hidden cases to the local
        # package; the larger independent oracle remains separate.
        package={
            "schemaVersion":1,
            "problem":{
                "id":pid,"courseId":"gomall","lessonId":"00-overview","title":item["title"],
                "difficulty":"中等","tags":["OA",item["company"]],"description":item["description"],
                "input":item["input"],"output":item["output"],
                "explanation":"从题目规则直接推导线性扫描/动态规划解法；样例与独立构造的 oracle 已逐例核对。",
                "hints":["先把题面中的操作或约束转成确定的数组/状态转移，再分析边界。"],
                "timeLimit":6,"memoryLimit":262144,"outputLimit":4096,"checker":"tokens",
                "languages":["python","go","java","cpp"],
            },
            "cases":[
                *[{"name":f"样例 {i+1}","input":raw,"expectedOutput":item["oracle"](raw)+"\n","hidden":False,"weight":1} for i,raw in enumerate(item["samples"])],
                *[{"name":f"定向边界 {i+1}","input":raw,"expectedOutput":item["oracle"](raw)+"\n","hidden":True,"weight":1} for i,raw in enumerate(item.get("directed",[]))],
                *[{"name":f"组合 {i+1}","input":case["input"],"expectedOutput":case["expectedOutput"],"hidden":True,"weight":1} for i,case in enumerate(oracle_cases[len(all_directed):len(all_directed)+24])],
            ],
        }
        pkg_path=ROOT/"packages"/(pid+".json")
        write_json(pkg_path,package)
        ref_path=ROOT/"references"/(pid+".py")
        ref_path.parent.mkdir(parents=True,exist_ok=True); ref_path.write_text(item["solve"]+"\nif __name__ == '__main__':\n import sys\n print(solve(sys.stdin.read()))\n")
        write_json(ROOT/"oracles"/(pid+".json"),oracle_cases)
        mutants=[]; negative=[]
        for i,(name,code) in enumerate(item["mutants"],1):
            rejected=[]
            for ci,case in enumerate(oracle_cases):
                try:
                    if run_code(code,case["input"])!=case["expectedOutput"].strip(): rejected.append(ci)
                except Exception as exc:
                    raise AssertionError(pid+": mutant must exit normally: "+name) from exc
            assert rejected, pid+": mutant survived all oracle cases: "+name
            formal_rejected=[]
            for ci,case in enumerate(package["cases"]):
                try:
                    if run_code(code,case["input"])!=case["expectedOutput"].strip(): formal_rejected.append(ci)
                except Exception as exc:
                    raise AssertionError(pid+": formal-case mutant must exit normally: "+name) from exc
            assert formal_rejected, pid+": mutant survived all formal cases: "+name
            mutants.append({"name":name,"code":code})
            negative.append({"name":name,"rejectedByCases":rejected,"formalRejectedByCases":formal_rejected})
            neg_path=ROOT/"negative-controls"/(pid+f"-{i}.py")
            neg_path.parent.mkdir(parents=True,exist_ok=True); neg_path.write_text(code+"\nif __name__ == '__main__':\n import sys\n print(solve(sys.stdin.read()))\n")
        write_json(ROOT/"mutants"/(pid+".json"),mutants)
        validation_items.append({"id":pid,"oracleCases":len(oracle_cases),"publicCases":len(item["samples"]),"hiddenCases":24,"negativeControls":negative})
        candidate_items.append({
            "id":pid,"sourceContentHash":None,
            "packageChecksum":hashlib.sha256(compact(package).encode()).hexdigest(),
            "editorial":"## 思路\n\n"+item["description"]+"\n\n## 正确性证明\n\n构造与题面定义一一对应；对每个输入位置/操作按定义处理，因而不漏解也不多计。\n\n## 复杂度\n\n时间与空间界见实现与题目约束。",
            "authoredSolutions":[{"language":"python","code":ref_path.read_text()}],
        })
        review_items.append({"id":pid,"status":"authored","reason":"来源题面足以唯一确定计算规则与返回值；已完成标准输入输出版参考实现、独立 oracle（含 140 组以上样例）及两个正常退出错误实现的差分验证。该候选尚未运行线上 GoJudge。","sourceUrls":[item["source"]]})
        source_items.append({"id":pid,"url":item["source"],"catalogContentHash":None,"status":"authored","review":"基于仓库固定上游快照 e66f809f4c953bce129f68491726176615db6afc 中的对应完整目录条目核对；标准输入输出序列化和本地上限在候选题包中公开，不声称为 OAMaster 原始函数接口。"})

    # Bind immutable source fingerprints after packages/tests are written.
    catalog=json.loads((ROOT.parent/"oa-master/catalog.json").read_text())
    by_id={x["id"]:x for x in catalog["items"]}
    for entry,src in zip(candidate_items,source_items):
        entry["sourceContentHash"]=by_id[entry["id"]]["contentHash"]
        src["catalogContentHash"]=by_id[entry["id"]]["contentHash"]
    selected={x["id"] for x in candidate_items}
    companies={"meshy","fortinet","paypay","flexport","hsbc","weride","agoda","infosys","ixl","koddi","duolingo","sentry","tradedesk","box","moveworks","superhuman","safetykit","reevo","persona","trend-micro","airtable","greyorange","verisk","commvault"}
    coverage=json.loads((ROOT/"coverage.json").read_text())
    unreviewed={x["id"] for x in coverage["items"] if x["company"] in companies and x["status"]=="unreviewed"}
    assert selected<=unreviewed
    blocked={
        "oa-meshy-1":"单选知识题没有输入输出/判题答案协议，不属于代码评测题。","oa-meshy-2":"单选知识题没有输入输出/判题答案协议，不属于代码评测题。","oa-meshy-3":"单选知识题没有输入输出/判题答案协议，不属于代码评测题。","oa-meshy-4":"单选知识题没有输入输出/判题答案协议，不属于代码评测题。","oa-meshy-5":"单选知识题没有输入输出/判题答案协议，不属于代码评测题。","oa-meshy-6":"单选知识题没有输入输出/判题答案协议，不属于代码评测题。","oa-meshy-7":"要求使用 NumPy 且禁止循环，函数式数组接口与当前多语言 stdin/stdout OJ 不兼容；题面未给序列化协议。","oa-meshy-8":"只要求给出 Q/K/V 参数但满足期望值的参数有无限多组，未定义唯一或规范输出。",
        "oa-fortinet-1":"题面核心定义只剩一个 `$`，预算约束与函数描述丢失，仅有示例不足以恢复输入契约。","oa-fortinet-2":"题面在要枚举的 pair 区间 `(1 ...` 处截断，无法确定完整求和范围。",
        "oa-paypay-1":"查询符号行已损坏（引号和方向符号不一致），起点是否须为空、越界查询行为也未完整规定。","oa-paypay-2":"只保留商品价格/现金示例，未规定找零面额、舍入方式和输出顺序。","oa-paypay-4":"同一相邻元素对是否允许双向操作、元素字符串可否为空等状态转移规则不足以唯一实现。","oa-paypay-5":"连续相同数字的替换顺序未规定；不同合法操作顺序可产生不同最终串。",
        "oa-hsbc-1":"源示例输出含未出现在输入中的 11，约束文本也在 `0 6` 处截断，样例与题意冲突。","oa-hsbc-2":"交换范围规则截断在 `...until (row_i+m`，无法确定每个 action 交换单点还是整段。","oa-hsbc-4":"“至少 K 人购买”后又要求最常购商品，顾客内重复商品如何计数及整数ID的 lexicographic 顺序未定。",
        "oa-agoda-1":"双核过程被描述成各核最大化自身得分但没有给出博弈/策略或并列规则，无法得到唯一结果。","oa-agoda-2":"正文称最少团队数等于最大区间重叠数，和例子中的区间覆盖分组不一致。","oa-agoda-3":"各核“最优”目标相互竞争且未规定决策顺序/博弈均衡，例子不能消歧。",
        "oa-infosys-2":"可移除子数组的相邻合并规则与“所有子数组 removable”难以和样例 9 对上，且 N/A 约束、数值范围及完整例子均缺失。","oa-infosys-4":"数组取值范围未给，允许负数时最大乘积目标不同；最大乘积的最优配对及并列目标下最少交换规则未定义。",
        "oa-ixl-1":"可选 packet 数没有上界，题面约束明确未完成，直接枚举和评测资源上限无法建立。","oa-koddi-2":"若鸟向一侧飞到森林边界仍找不到木棒，后续飞行/终止规则未说明。","oa-koddi-3":"中心及 Y 路径的定义依赖矩阵奇数边长，但题面未限定边长为奇数。",
        "oa-duolingo-2":"k 的值域未给；k=0 时可整除条件无定义，负数的余数语义也未说明。","oa-sentry-1":"要求返回具体路径但存在多条有效路径，未定义最短路/邻居优先级或允许任意输出的 checker。","oa-sentry-3":"断行时连字符词的切分与末尾后缀规则未完整列明，源题正文截断。","oa-tradedesk-4":"该条目明确要求参照未随数据提供的 source image；正文叙事不是可核验的原题接口。","oa-tradedesk-5":"正文要求参照缺失的 source image，航班时间相同/排序和数组是否有序的细节不能核实。","oa-persona-1":"超出行宽的连字符词前缀如何分割及剩余部分何时重排到下一行规则未完整覆盖。",
        "oa-box-1":"币值部分序列号格式被截断，10..12长度中可变片段如何解释不明确。","oa-box-2":"无限树上策略碰撞的判定条件/输出规则需完整源定义，目录文本存在截断。","oa-moveworks-1":"拆分后的两部分允许为零/负数与输入范围均未规定，输出目标在不同约定下会变化。","oa-moveworks-2":"平衡字符串的字符集合/字母表未定义，只有样例输出不能确定计数空间。",
        "oa-safetykit-3":"父数组允许多棵树还是必须单根未说明，且点值、规模范围缺失，根遍历/路径合法输入边界不完整。","oa-reevo-3":"对象速度为整数/实数、相同位置/零速度及 ceil 的精确定义未给，不能确定通用数值 I/O。","oa-trend-micro-1":"操作1对路径上每点所有相连边清红会覆盖路径/交叉边的状态，更新和查询结果依赖未说明的边界语义。","oa-trend-micro-3":"开头题面为 `Given a number n (1` 即被截断，输出排序指标 C 也没有定义。",
        "oa-airtable-1":"近似分位数的 bucket 数量、边界、百分位插值/返回规则需通过多函数 API 定义，当前描述未定。","oa-airtable-2":"某经理的团队是否包含经理本人、同分团队如何选/返回何值及没有≥2人的情况未明。","oa-airtable-3":"表操作列表、错误行为、引用环路及完整 I/O 协议在源条目中未提供。","oa-greyorange-1":"未说明非法/非标准罗马数字的接受规则，亦未说明姓名内含空格的解析方式。","oa-greyorange-2":"只给出 x>y，未限定 y 是否为正；若 y≤0，一次操作可能使未选元素不降反升，最小完成操作数语义不成立。","oa-greyorange-3":"点落在边界是否算 inside、退化三角形分类优先级和坐标数值上限都未定义。","oa-verisk-2":"SQL 方言与重复/空 engagement 的聚合要求未定义，且不适用于当前常规代码题的 stdin/stdout 语言集合。","oa-verisk-3":"一组多选知识题没有单一标准输入协议，且 quicksort 对 pivot 的分区方式未指定。","oa-commvault-1":"Catalan 数 n 上限标为 `o_o`，模 10000 的可行复杂度上界无法建立。","oa-commvault-2":"示例结果为 TODO，且城市路径是否可重复、N/K 的范围和编号上限未补充。",
    }
    ids={x["id"]:x for x in json.loads((ROOT.parent/"oa-master/catalog.json").read_text())["items"]}
    for pid in sorted(unreviewed-selected):
        if pid in blocked:
            review_items.append({"id":pid,"status":"blocked","reason":blocked[pid]})
        else:
            source_items.append({"id":pid,"url":ids[pid]["sourceUrl"],"catalogContentHash":ids[pid]["contentHash"],"status":"unreviewed","review":"仅记录目录来源指纹；本批未完成语义审阅，不标记 authored/blocked。"})
    assert len({x["id"] for x in review_items})==len(selected)+len(blocked), "all included review decisions must be unique"
    assert all(x["id"] in selected or x["id"] in blocked for x in review_items)
    for entry in review_items:
        item=ids[entry["id"]]
        if entry["id"] in selected:
            entry["catalogContentHash"]=item["contentHash"]
            continue
        entry["sourceUrls"]=[item["sourceUrl"]]
        entry["catalogContentHash"]=item["contentHash"]
        source_items.append({"id":entry["id"],"url":item["sourceUrl"],"catalogContentHash":item["contentHash"],"status":entry["status"],"reason":entry["reason"]})
    write_json(ROOT/"candidate-batches"/"saas-tech-remaining.json",{"schemaVersion":1,"items":candidate_items})
    write_json(ROOT/"reviews"/"saas-tech-remaining.json",{"schemaVersion":1,"items":review_items})
    write_json(ROOT/"reviews"/"source-evidence"/"validation"/"saas-tech-remaining.json",{
        "schemaVersion":1,"upstreamCommit":"e66f809f4c953bce129f68491726176615db6afc","upstreamRepository":"https://github.com/RedInn7/OA-Master","origin":"https://oamaster.com","seed":SEED,"items":source_items})
    write_json(ROOT/"validation"/"saas-tech-remaining.json",{"schemaVersion":1,"seed":SEED,"problems":validation_items})
    print(f"generated {len(specs)} candidates; {sum(len(x) for x in [json.loads((ROOT/'oracles'/(s['id']+'.json')).read_text()) for s in specs])} independent oracle cases; all references agree and all mutants are killed")


if __name__=="__main__":
    main()
