"""Author offline-validated Akuna Capital OA candidates from raw e66f809.

This generator never executes upstream source and never promotes its outputs to
the runtime registry. Candidate problems are independently authored here.
"""
from collections import Counter, deque
from functools import lru_cache
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {x["id"]: x for x in CATALOG["items"]}
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SPECS = []


def add(**spec): SPECS.append(spec)


def vector_input(a): return f"{len(a)}\n{' '.join(map(str,a))}\n"


def network_input(x):
    a, k, threshold = x
    return f"{len(a)} {k} {threshold}\n{' '.join(map(str,a))}\n"


def network_oracle(x):
    a, k, threshold = x
    @lru_cache(None)
    def visit(i):
        if i == len(a): return 0
        best = visit(i + 1)
        total = 0
        for j in range(i, len(a)):
            total += a[j]
            if j - i + 1 >= k and total >= threshold:
                best = max(best, 1 + visit(j + 1))
        return best
    return str(visit(0))


def network_random(r):
    a = [r.randint(0, 20) for _ in range(r.randint(1, 9))]
    return a, r.randint(1, len(a)), r.randint(0, 35)


add(
    number=1, title="Network Formation", raw_path="OA LIST/Akuna_Capital_OA/001_image.txt",
    raw_blob="5b290be282a194b82b6bcbb8ed09aa529da0191e",
    values=[([5,7,9,12,10,13],2,15),([1],1,1),([0,0,0],2,1)],
    edges=[(([1,1,4,1,1],2,5),None),(([0]*100000,1,0),"100000")],
    encode=network_input, oracle=network_oracle, random=network_random,
    desc="按原顺序把若干互不重叠的连续电脑区间组成网络。每个网络至少包含 minComps 台电脑，速度总和至少为 speedThreshold；未组成网络的电脑允许跳过。求最多网络数。速度取非负整数。",
    input="第一行 n、minComps、speedThreshold；第二行 n 个非负整数 speed[i]。本站范围：1≤n≤200000，1≤minComps≤n，0≤speed[i]≤10^9，0≤speedThreshold≤10^14。",
    output="输出最多可组成的网络数。",
    idea="从左到右累加尚未处理的电脑；当前连续段首次同时满足长度和速度要求时，立刻作为一个网络并继续扫描。",
    proof="非负速度保证从某个起点开始，首次满足条件的最短区间不晚于任何包含该起点且满足条件的区间终点。对任意最优划分的第一个网络，跳过其起点前未用电脑并用从当前起点开始的最短合格段替换，不会延后结束位置，因而不会减少后续可选网络数。对剩余后缀归纳可得贪心最优。",
    complexity="时间 O(n)，额外空间 O(1)。",
    code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n,k,need=t[:3]; a=t[3:3+n]\n count=length=total=0\n for v in a:\n  length+=1; total+=v\n  if length>=k and total>=need: count+=1; length=total=0\n return str(count)\n''',
    mutants=[
        ("把长度和速度条件误写成满足任一项即可",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n,k,need=t[:3]; a=t[3:3+n]; count=length=total=0\n for v in a:\n  length+=1; total+=v\n  if length>=k or total>=need: count+=1; length=total=0\n return str(count)\n'''),
        ("忽略最小电脑数",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n,k,need=t[:3]; a=t[3:3+n]; count=length=total=0\n for v in a:\n  length+=1; total+=v\n  if total>=need: count+=1; length=total=0\n return str(count)\n'''),
    ],
    source_note="固定 OAMaster 原始 OCR 文件含完整规则和样例；原题未给数值范围，输入上界均明确标为本站补充。",
)


def schedule_input(x):
    p,a=x; return f"{len(p)}\n{' '.join(map(str,p))}\n{' '.join(map(str,a))}\n"


def schedule_oracle(x):
    p,a=x; order=sorted(range(len(p)),key=lambda i:(p[i],i)); best=10**30
    def visit(j,prev,last):
        nonlocal best
        if j==len(order): best=min(best,last); return
        i=order[j]
        for day in {p[i],a[i]}:
            if day>=prev: visit(j+1,day,max(last,day))
    visit(0,0,0)
    return str(best)


def schedule_random(r):
    p=[r.randint(1,30) for _ in range(r.randint(1,8))]
    a=[r.randint(1,v) for v in p]
    return p,a


add(
    number=3,title="Update Release Scheduler",raw_path="OA LIST/Akuna_Capital_OA/003_8f23d6f54b7beaadf828061f90132526_720.txt",
    raw_blob="f16e5aaf283bc21609f96f56bbe055da11553eb1",
    evidence_paths=[("OA LIST/Akuna_Capital_OA/004_QQ_1744468114766.txt","f4e689fc14bfd1322a0a4a288b9cfe6b48a61148"),("OA LIST/Akuna_Capital_OA/005_QQ_1744468129065.txt","f0b1ccb2434aa66b68eb37acf46dad248e519f1a"),("OA LIST/Akuna_Capital_OA/006_QQ_1744468144333.txt","1c7778344444900dd6d414209a263a8a0b04e8f5")],
    values=[([3,7,4,9],[1,5,2,3]),([9,2,7],[1,1,1]),([3,2,7,8],[1,1,5,6])],edges=[(([1,1], [1,1]),"1")],encode=schedule_input,oracle=schedule_oracle,random=schedule_random,
    desc="按 plannedDate 非递减顺序发布更新。每个更新可选 alternateDate 或 plannedDate；允许多项同日发布。最小化完成全部更新时的日历日。若 plannedDate 相同，任意固定顺序均可；本站按原数组下标打破平局。",
    input="第一行 n；第二行 n 个 plannedDate；第三行 n 个 alternateDate。原题约束：1≤n≤200000，1≤两数组元素≤10^9，alternateDate[i]≤plannedDate[i]。",
    output="输出所有更新均发布后的最早完成日。",
    idea="按计划日期排序，维护当前最早可用日。若备用日不早于当前日就选备用日，否则只能等到计划日。",
    proof="固定计划顺序后，当前更新的最早合法发布日只可能是两个可选日期中不早于上一日的最早者。由于 alternateDate≤plannedDate，备用日若已过去，计划日仍不早于当前日：此前选择的日期不超过此前计划日期，而计划日期已排序。逐项选择最早合法日期不可能推迟任何后续可行日期，因此最终完成日最小。",
    complexity="时间 O(n log n)，空间 O(n)。",
    code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; p=t[1:1+n]; a=t[1+n:1+2*n]; day=0\n for planned,alt in sorted(zip(p,a)):\n  day=alt if alt>=day else planned\n return str(day)\n''',
    mutants=[("不按计划日排序",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; p=t[1:1+n]; a=t[1+n:1+2*n]; day=0\n for planned,alt in zip(p,a): day=alt if alt>=day else planned\n return str(day)\n'''),("总选计划日",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; p=sorted(t[1:1+n]); return str(p[-1])\n''')],
    source_note="固定原始快照包含完整规则、输入输出限制和样例；采用其 plannedDate/alternateDate 顺序语义。",
)


def binary_oracle(x):
    s=x[0]
    @lru_cache(None)
    def visit(state):
        best=0
        for i,ch in enumerate(state):
            if ch!='1': continue
            j=i+1
            while j<len(state) and state[j]=='0': j+=1
            if j==i+1: continue
            dest=j-1 if j<len(state) else len(state)-1
            nxt=state[:i]+'0'*(dest-i)+'1'+state[dest+1:]
            best=max(best,1+dest-i+visit(nxt))
        return best
    return str(visit(s))


def binary_random(r): return (''.join(r.choice('01') for _ in range(r.randint(1,10))),)


add(
    number=5,title="Binary Circuit",raw_path="OA LIST/Akuna_Capital_OA/009_b37943bb1a068f4571ff295442ffa707.txt",raw_blob="858568a469cb893569abaf231c41d600cd6f234c",
    evidence_paths=[("OA LIST/Akuna_Capital_OA/011_QQ_1744468193022.txt","90b2e78dd87cf193cbcd43228a24ba1ca1eaee67"),("OA LIST/Akuna_Capital_OA/015_b37943bb1a068f4571ff295442ffa707.txt","aecf2fdb2731325ef57064c17ac4da718a510825"),("OA LIST/Akuna_Capital_OA/016_QQ_1744468359444.txt","851bd58fb2ab04d241c2eb5de1f695ef0d1d08f8")],
    values=[("110100",),("10100",),("000111",)],edges=[(("0101010101",),None),(("1"*100000+"0"*100000,),"10000100000")],encode=lambda x:x[0]+"\n",oracle=binary_oracle,random=binary_random,
    desc="将二进制串中的所有 1 移到末尾。一次操作选择一个 1，让它向右移动到下一个 1 前或串尾的最远位置；操作费用为 1 加移动格数。选择操作顺序以最大化总费用。若已是 0...01...1，费用为 0。",
    input="输入一行二进制字符串 s。采用原题范围 1≤|s|≤100000。",
    output="输出完成分组所需的最大总费用。",
    idea="把字符串拆成若干个 0 段。对每个 0 段，设其前面有 a 个 1、该段长度为 z；该段贡献 a×z 次移动格数，并可安排 a 次分别移动前方的 1，操作基础费用为 a，因此总贡献 a×(z+1)。",
    proof="每个 1 与其右侧每个 0 形成一个必须消除的逆序对，移动距离总和固定为逆序对总数。操作必须跨过一个完整的相邻 0 段；对于某个 0 段，位于其前的 a 个 1 各最多可通过该段一次，故该段最多产生 a 次操作。按从右向左逐段安排每个前置 1 跨越该段可达到此上界；不同 0 段的移动可依次安排。因此最大操作数为各段 a 之和，最大总费用为固定移动距离加最大操作数，即 Σa(z+1)。",
    complexity="时间 O(n)，空间 O(1)。",
    code='''import sys\ndef solve(raw):\n s=raw.strip(); ones=0; ans=0; i=0\n while i<len(s):\n  if s[i]=='1': ones+=1;i+=1;continue\n  j=i\n  while j<len(s) and s[j]=='0':j+=1\n  if ones: ans+=ones*((j-i)+1)\n  i=j\n return str(ans)\n''',
    mutants=[("只计移动距离，不计每次操作的固定 1",'''import sys\ndef solve(raw):\n s=raw.strip();ones=0;ans=0\n for c in s:\n  if c=='1':ones+=1\n  else:ans+=ones\n return str(ans)\n'''),("错误地按每个 1 只移动一次计费",'''import sys\ndef solve(raw):\n s=raw.strip();ones=s.count('1');zeros=s.count('0');return str(ones+zeros)\n''')],
    source_note="固定 OA LIST 题面给出费用定义、两组样例和 10^5 字符上界；最终函数返回值明确是 maximum total cost。",
)


def counter_oracle(x):
    a=x[0]; out=[]
    for i,v in enumerate(a):
        total=0
        for u in a[:i]: total+=abs(u-v)*(-1 if u>v else 1)
        out.append(total)
    return ' '.join(map(str,out))


def counter_random(r): return ([r.randint(-20,20) for _ in range(r.randint(1,20))],)


COUNTER_CODE='''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];a=t[1:1+n];prefix=0;out=[]\n for i,v in enumerate(a):out.append(str(i*v-prefix));prefix+=v\n return ' '.join(out)\n'''
COUNTER_MUTANTS=[("将所有累计差值符号反转",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];a=t[1:1+n];p=0;o=[]\n for i,v in enumerate(a):o.append(str(p-i*v));p+=v\n return ' '.join(o)\n'''),("漏掉当前值乘以前缀长度",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];a=t[1:1+n];p=0;o=[]\n for i,v in enumerate(a):o.append(str(v-p));p+=v\n return ' '.join(o)\n''')]

for number,title,raw_path,raw_blob,statement in [
    (9,"Counter Differences","web/content/docs/companies/akuna-capital.mdx","f55d4a120afd4d53753815e8a7c810c6c12626b4","MDX 原题完整定义与示例。"),
    (12,"Array Challenge (QR Intern)","fastprep/Akuna Capital/akuna-array-challenge.md","9f569c59089c0a21e3e6257e2851d6be30dccc98","FastPrep 原题完整定义与示例；原文无数据约束，范围明确标为本站补充。"),
]:
    add(number=number,title=title,raw_path=raw_path,raw_blob=raw_blob,values=[([2,4,3],),([7],),([3,3,1,5],)],edges=[(([10**9,-10**9,10**9],),None),(([0]*100000,),"0 "*99999+"0")],encode=lambda x:vector_input(x[0]),oracle=counter_oracle,random=counter_random,desc="对数组每个位置 i，从左向右检查所有 j<i：左值大于当前值时减去差的绝对值；左值小于或等于当前值时加上差的绝对值。输出每个位置的累计 counter。",input="第一行 n；第二行 n 个整数 arr[i]。原题未给数值约束，本站补充 1≤n≤100000，−10^9≤arr[i]≤10^9。",output="输出 n 个整数，按原数组顺序给出各位置 counter。",idea="对任意左侧元素 a[j]，其贡献恰等于 a[i]−a[j]（相等时为0）。因此 counter[i]=i×a[i]−前缀和。",proof="若 a[j]>a[i]，规则贡献 −|a[j]−a[i]|=a[i]−a[j]；若 a[j]<a[i]，规则贡献 |a[j]−a[i]|=a[i]−a[j]；相等时两边均为0。对 j=0..i−1 求和得 i·a[i]−Σa[j]，前缀递推即可准确输出。",complexity="时间 O(n)，空间 O(n)（计输出）。",code=COUNTER_CODE,mutants=COUNTER_MUTANTS,source_note=statement)


def delivery_input(x):
    n,edges,root=x
    return f"{n} {len(edges)} {root}\n"+''.join(f"{u} {v}\n" for u,v in edges)


def delivery_oracle(x):
    n,edges,root=x; inf=10**9; d=[[inf]*n for _ in range(n)]
    for i in range(n):d[i][i]=0
    for u,v in edges:d[u-1][v-1]=d[v-1][u-1]=1
    for k in range(n):
        for i in range(n):
            for j in range(n):d[i][j]=min(d[i][j],d[i][k]+d[k][j])
    order=sorted((d[root-1][v],v+1) for v in range(n) if v!=root-1 and d[root-1][v]<inf)
    return ' '.join(str(v) for _,v in order)


def delivery_random(r):
    n=r.randint(2,8);edges=[]
    for u in range(n):
        for v in range(u+1,n):
            if r.random()<.3:edges.append((u+1,v+1))
    return n,edges,r.randint(1,n)


add(number=13,title="Delivery Management System (QR Intern)",raw_path="fastprep/Akuna Capital/akuna-delivery-management-system.md",raw_blob="1a3d1d9bf45655a8251a296a1bd0808f704a873e",values=[(4,[(1,2),(2,3),(2,4)],1),(5,[(1,4),(4,5),(1,2),(2,3)],1),(3,[],1)],edges=[((5,[(1,2),(1,3),(2,4),(4,5),(3,5)],1),"2 3 4 5")],encode=delivery_input,oracle=delivery_oracle,random=delivery_random,desc="城市和双向道路构成无权图。以工厂所在城市为起点，按最短路距离升序配送；距离相同时按城市编号升序。不可达城市不输出，起点本身不输出。",input="第一行 n、m、company（城市编号 1..n）；随后 m 行双向道路 u v。本站补充范围：1≤n≤100000，0≤m≤200000，图无自环、无重复边。",output="一行输出被访问的城市编号，以空格分隔。没有其他可达城市时输出空行。",idea="从工厂城市运行 BFS，得到所有可达城市的最短边数距离，再按 (距离, 编号) 排序输出。",proof="无权图 BFS 按层扩展，首次到达节点时的层数即最短距离。按距离再按编号排序，正好满足题目两级排序要求；过滤起点和未访问节点分别满足不重复配送及忽略不可达城市。",complexity="时间 O(n+m)，空间 O(n+m)。",code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,m,root=t[:3];p=3;g=[[] for _ in range(n)]\n for _ in range(m):u,v=t[p:p+2];p+=2;u-=1;v-=1;g[u].append(v);g[v].append(u)\n d=[-1]*n;d[root-1]=0;q=deque([root-1])\n while q:\n  u=q.popleft()\n  for v in g[u]:\n   if d[v]<0:d[v]=d[u]+1;q.append(v)\n return ' '.join(str(i+1) for i in sorted((i for i in range(n) if i!=root-1 and d[i]>=0),key=lambda i:(d[i],i)))\nfrom collections import deque\n''',mutants=[("只按城市编号排序",'''import sys\nfrom collections import deque\ndef solve(raw):\n t=list(map(int,raw.split()));n,m,r=t[:3];p=3;g=[[] for _ in range(n)]\n for _ in range(m):u,v=t[p:p+2];p+=2;g[u-1].append(v-1);g[v-1].append(u-1)\n d=[-1]*n;d[r-1]=0;q=deque([r-1])\n while q:\n  u=q.popleft()\n  for v in g[u]:\n   if d[v]<0:d[v]=d[u]+1;q.append(v)\n return ' '.join(str(i+1) for i in sorted(i for i in range(n) if i!=r-1 and d[i]>=0))\n'''),("用 DFS 首次发现距离",'''import sys\nfrom collections import deque\ndef solve(raw):\n t=list(map(int,raw.split()));n,m,r=t[:3];p=3;g=[[] for _ in range(n)]\n for _ in range(m):u,v=t[p:p+2];p+=2;g[u-1].append(v-1);g[v-1].append(u-1)\n d=[-1]*n;d[r-1]=0;stack=[r-1]\n while stack:\n  u=stack.pop()\n  for v in g[u]:\n   if d[v]<0:d[v]=d[u]+1;stack.append(v)\n return ' '.join(str(i+1) for i in sorted((i for i in range(n) if i!=r-1 and d[i]>=0),key=lambda i:(d[i],i)))\n''')],source_note="FastPrep 固定原始题面包含完整排序规则和官方样例；原始约束未恢复，本站节点/边界范围清楚标出为补充。")


def substring_input(x):return f"{x[0]}\n{x[1]}\n"
def substring_oracle(x):
    s,k=x;best=None
    for i in range(len(s)):
        for j in range(i+1,len(s)+1):
            z=s[i:j]
            if z.count('1')==k and (best is None or (len(z),z)<(len(best),best)):best=z
    return best or ''
def substring_random(r):
    s=''.join(r.choice('01') for _ in range(r.randint(1,14)))
    if '1' not in s:s='1'+s
    return s,r.randint(1,s.count('1'))

add(number=17,title="K Smallest Substring",raw_path="fastprep/Akuna Capital/akuna-get-substring.md",raw_blob="6e50a5ee5cbb93a2975249668f5409939cd5a28c",values=[("0101101",3),("111",1),("0010100",1)],edges=[(("0"*500+"1"*500,500),None),(("1"*1000,1000),None)],encode=substring_input,oracle=substring_oracle,random=substring_random,desc="在仅由 0/1 组成的字符串中，选择恰好包含 k 个 1 的子串；先最小化长度，长度相同再取字典序最小者。题面保证答案存在。",input="第一行二进制字符串 s；第二行整数 k。本站遵循原题长度范围 1≤k≤|s|≤1000，并明确补充题面保证 1≤k≤s 中 1 的总数。",output="输出按 (长度, 字典序) 最小的合法子串。",idea="按字符串中 1 的下标枚举每个连续 k 个 1 的组，取覆盖这些 1 的最短子串，再比较长度和字典序。",proof="任何合法子串包含一个连续的 k 个 1；去掉首个 1 之前和末个 1 之后的字符仍合法且更短，因此最短候选必恰从某个第一个 1 开始并止于第 k 个 1。遍历所有连续 k 个 1 的窗口穷尽所有最短候选，按长度、字典序取最小即正确。",complexity="设字符串长度为 n、1 的个数为 q。时间 O(q)，空间 O(n)（存储 1 的位置及答案）。",code='''import sys\ndef solve(raw):\n s,k=raw.split();k=int(k);ones=[i for i,c in enumerate(s) if c=='1'];best=None\n for i in range(len(ones)-k+1):\n  z=s[ones[i]:ones[i+k-1]+1]\n  if best is None or (len(z),z)<(len(best),best):best=z\n return best\n''',mutants=[("只取第一个长度最短窗口，不处理字典序",'''import sys\ndef solve(raw):\n s,k=raw.split();k=int(k);a=[i for i,c in enumerate(s) if c=='1'];return s[a[0]:a[k-1]+1]\n'''),("比较字典序优先于长度",'''import sys\ndef solve(raw):\n s,k=raw.split();k=int(k);a=[i for i,c in enumerate(s) if c=='1'];z=[s[a[i]:a[i+k-1]+1] for i in range(len(a)-k+1)];return min(z)\n''')],source_note="FastPrep 题面提供完整目标、存在性保证、1≤k≤|s|≤1000 和公开样例；本站把含 k 个 1 的存在条件写清。")


def marathon_input(x):return vector_input(x[0])
def marathon_oracle(x):
    counts=Counter(x[0]);keys=sorted(counts);start=tuple(counts[t] for t in keys);index={t:i for i,t in enumerate(keys)}
    @lru_cache(None)
    def choose(state,last):
        best=0
        for t,i in index.items():
            if state[i] and (last is None or t in (last,last+1)):
                nxt=list(state);nxt[i]-=1
                best=max(best,1+choose(tuple(nxt),t))
        return best
    return str(choose(start,None))
def marathon_random(r):return ([r.randint(1,9) for _ in range(r.randint(1,11))],)

add(number=19,title="An Evening of Movies",raw_path="fastprep/Akuna Capital/akuna-longest-marathon.md",raw_blob="b74417b6b7f71e7749014c082c729c625f5df156",values=[([8,4,5,7,4],),([1,1,1],),([1,2,2,3,5],)],edges=[(([1]*100000,),"100000"),(([1000000000,1000000001,1000000002],),"3")],encode=marathon_input,oracle=marathon_oracle,random=marathon_random,desc="从电影库中挑选影片并任意排序；相邻影片时长必须相同或恰好增加 1 分钟，同一影片不得重复观看。求最多可观看影片数。",input="第一行 n；第二行 n 个正整数 runtime[i]。原题未给数值界，本站补充 1≤n≤100000，1≤runtime[i]≤10^9。",output="输出可观看的最大影片数。",idea="统计每种时长出现次数。若某时长 t+1 存在影片，则从 t 开始可以先看完所有时长 t 的影片，再接到 t+1；反之只能使用时长 t 的影片。",proof="从时长 t 开始，所有时长 t 的影片均可连续观看；只有存在至少一部 t+1 影片时，才能从 t 转移到下一时长。每部电影只用一次，因此转移值为 count[t]+best[t+1]（当 count[t+1]>0），否则为 count[t]。对出现的每个起始时长取最大，覆盖所有合法序列。",complexity="若 u 为不同运行时长个数，时间 O(u log u)，空间 O(u)。",code='''import sys\nfrom collections import Counter\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];c=Counter(t[1:1+n]);best=0\n for x in sorted(c,reverse=True):best=max(best,c[x]+(best if c[x+1] else 0))\n return str(best)\n''',mutants=[("忽略连续运行时长增加的路径",'''import sys\nfrom collections import Counter\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];return str(max(Counter(t[1:1+n]).values()))\n'''),("只在长度为 1 的影片段间转移",'''import sys\nfrom collections import Counter\ndef solve(raw):\n t=list(map(int,raw.split()));n=t[0];c=Counter(t[1:1+n]);best=0\n for x in sorted(c,reverse=True):best=max(best,1+(best if c[x+1] else 0))\n return str(best)\n''')],source_note="FastPrep 原题规则和示例完整；无长度/时长约束，本站补充范围明确标识。")


SPECS[-1]["code"] = '''import sys
from collections import Counter
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];c=Counter(t[1:1+n]);dp={}
 for x in sorted(c,reverse=True):dp[x]=c[x]+(dp.get(x+1,0) if c[x+1] else 0)
 return str(max(dp.values()))
'''


def grid_input(x):
    rows,cols,ir,ic,fr,fc,cr,cc=x
    return f"{rows} {cols} {ir} {ic} {fr} {fc}\n{' '.join(map(str,cr))}\n{' '.join(map(str,cc))}\n"
def grid_oracle(x):
    import heapq
    rows,cols,ir,ic,fr,fc,cr,cc=x;dist={(ir,ic):0};q=[(0,ir,ic)]
    while q:
        d,r,c=heapq.heappop(q)
        if (r,c)==(fr,fc):return str(d)
        if d!=dist[(r,c)]:continue
        for nr,nc,w in ((r-1,c,cr[r-1] if r else None),(r+1,c,cr[r] if r+1<rows else None),(r,c-1,cc[c-1] if c else None),(r,c+1,cc[c] if c+1<cols else None)):
            if w is None:continue
            nd=d+w
            if nd<dist.get((nr,nc),10**30):dist[(nr,nc)]=nd;heapq.heappush(q,(nd,nr,nc))
    raise AssertionError("grid should be connected")
def grid_random(r):
    rows=r.randint(1,6);cols=r.randint(1,6);return rows,cols,r.randrange(rows),r.randrange(cols),r.randrange(rows),r.randrange(cols),[r.randint(0,15) for _ in range(rows-1)],[r.randint(0,15) for _ in range(cols-1)]

add(number=24,title="Minimum Cost to Move Within a Grid",raw_path="fastprep/Akuna Capital/akuna-min-cost.md",raw_blob="7f30fdeeb2498e44009e23493084e921f53271de",values=[(3,3,0,0,1,2,[5,2],[6,1]),(4,4,1,2,3,3,[1,2,3],[7,8,9]),(1,1,0,0,0,0,[],[])],edges=[((100000,100000,0,0,99999,99999,[1]*99999,[1]*99999),"199998")],encode=grid_input,oracle=grid_oracle,random=grid_random,desc="矩形网格中只能上下左右走。跨越第 i 与 i+1 行的任一列，代价为 costRows[i]；跨越第 j 与 j+1 列的任一行，代价为 costCols[j]。求起点到终点的最小总代价。题面未给任何障碍位置，本站因此按完整网格可通行解释。",input="第一行 rows cols initR initC finalR finalC，坐标 0-based；第二行 rows−1 个行间代价；第三行 cols−1 个列间代价。原题：1≤rows,cols≤100000，坐标合法，0≤每条边代价≤10000。",output="输出最小移动费用。",idea="行坐标变化必须跨过 initR 与 finalR 之间的全部行边，列坐标亦然；分别求这两段代价之和再相加。",proof="每次垂直移动只改变行坐标一格，任意合法路径从 initR 到 finalR 必须至少一次跨过每一条中间行边；跨越次数为奇数，额外往返代价非负。按相邻坐标直接移动恰好各跨一次，达到行边代价下界。列方向同理，且可先后独立执行，故两段成本和是全局最小。",complexity="时间 O(|finalR−initR|+|finalC−initC|)，额外空间 O(1)（不计输入）。",code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));rows,cols,ir,ic,fr,fc=t[:6];p=6;cr=t[p:p+rows-1];p+=rows-1;cc=t[p:p+cols-1]\n return str(sum(cr[min(ir,fr):max(ir,fr)])+sum(cc[min(ic,fc):max(ic,fc)]))\n''',mutants=[("行列方向代价索引错一格",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));R,C,a,b,x,y=t[:6];p=6;cr=t[p:p+R-1];p+=R-1;cc=t[p:p+C-1];return str(sum(cr[min(a,x):max(a,x)])+sum(cc[min(b,y):max(b,y)])+1)\n'''),("只计算行方向费用",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));R,C,a,b,x,y=t[:6];p=6;cr=t[p:p+R-1];return str(sum(cr[min(a,x):max(a,x)]))\n''')],source_note="FastPrep 快照包含完整坐标/边费用约束与两个样例。题面提到 lasers 但没有输入或障碍定义；本站只按提供的成本数据建模、将无障碍声明清楚。")


def chunks_input(x):
    total,intervals=x;return f"{total} {len(intervals)}\n"+''.join(f"{a} {b}\n" for a,b in intervals)
def chunk_oracle(x):
    total,intervals=x;arr=sorted(intervals);cursor=1;answer=0
    for a,b in arr+[(total+1,total+1)]:
        gap=a-cursor;dp=[0]+[10**9]*gap
        for v in range(1,gap+1):dp[v]=1+min(dp[v-(1<<p)] for p in range(v.bit_length()) if (1<<p)<=v)
        answer+=dp[gap];cursor=b+1
    return str(answer)
def chunks_random(r):
    total=r.randint(1,45);used=[];i=1
    while i<=total:
        if r.random()<.45:
            j=r.randint(i,min(total,i+6));used.append((i,j));i=j+1
        else:i+=1
    return total,used

add(number=26,title="Minimum Chunks Required",raw_path="fastprep/Akuna Capital/akuna-minimum-chunks-required.md",raw_blob="b8a88a02569e720a114f32a15718f59d6474c0b2",values=[(10,[(1,2),(9,10)]),(18,[(9,17)]),(1,[])],edges=[((10**18,[]),"24"),((10**18,[(1,10**18)]),"0")],encode=chunks_input,oracle=chunk_oracle,random=chunks_random,desc="文件包含 totalPackets 个按 1-based 编号的数据包。已上传区间互不重叠；尚未上传的每个连续区间可以拆成任意个连续块，每块长度必须是 2 的非负整数次幂，块起点不要求按长度对齐。求还需上传的最少块数。",input="第一行 totalPackets、m；随后 m 行已上传闭区间 l r。原题限制：1≤totalPackets<10^18，0≤m<10^5，1≤l≤r≤totalPackets，区间不重叠。",output="输出最少需上传的数据块数。",idea="将已上传区间排序，逐个求出其间未上传空档。长度 L 的空档最少可分为 popcount(L) 个二次幂长度块，答案为所有空档 popcount 之和。",proof="若 L 的二进制表示有 q 个 1，则按这些不同的二次幂长度切分空档可用 q 块达到覆盖。反之，若用 r 个二次幂长度覆盖 L，则 r 个幂次之和为 L；二进制进位只会减少项数，因此 L 的 popcount 不超过 r。不同未覆盖空档不能由同一块跨越已上传包，故各自最优块数相加即为全局最小。起点不要求幂次对齐是此结论成立的必要协议说明。",complexity="时间 O(m log m)，空间 O(m)。",code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));total,m=t[:2];a=sorted((t[i],t[i+1]) for i in range(2,len(t),2));cursor=1;ans=0\n for l,r in a+[(total+1,total+1)]:\n  gap=l-cursor;ans+=gap.bit_count();cursor=r+1\n return str(ans)\n''',mutants=[("把每个空档当成一个块",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));N,m=t[:2];a=sorted((t[i],t[i+1]) for i in range(2,len(t),2));p=1;ans=0\n for l,r in a+[(N+1,N+1)]:\n  if l>p:ans+=1\n  p=r+1\n return str(ans)\n'''),("只对总未上传包数做 popcount",'''import sys\ndef solve(raw):\n t=list(map(int,raw.split()));N,m=t[:2];return str((N-sum(t[i+1]-t[i]+1 for i in range(2,len(t),2))).bit_count())\n''')],source_note="FastPrep 原始题给出 10^18 数据范围、非重叠区间和两组样例。原文未要求块长对齐起点；本站特意明确任意连续起点，否则规则不足以确定答案。")


BLOCKED={
    4:("Star Sum","固定快照的原始题源对节点编号给出冲突证据：早期示例按 1-based（节点范围含 g_nodes），后续约束和 sample 按 0-based。题库页面的示例也与约束不一致，不能擅自挑一个版本。"),
    6:("Variable Tick Rounding","MDX 仅给浮点价格和区间宽度，未说明边界附近舍入越界时是否夹回区间；Python 示例采用银行家舍入 round，Java/C++ 示例则 ties-up，规则直接冲突，无法确定唯一正确输出。"),
    7:("Limit Order Display Rule","题面没有完整输入格式、订单生命周期和展示数量聚合规则；所附参考实现还把买价阈值错误地引用卖方 MM 数量、按价格聚合后再套订单资格。不能以现有示例或代码唯一确定题意。"),
    8:("Log Throttling","正文说滚动窗口含边界（inclusive），但同页参考解法在 timestamp−window 恰等于旧日志时间时将其移除（ts+window<=now），包含性与示例代码矛盾。"),
    10:("Sequences (20 questions)","内容是一组离散找规律选择题表格，题号不连续且没有统一可编程输入/输出函数；若硬做 stdin/stdout 会臆造任务。"),
    11:("Probability (30 questions)","内容是30道静态概率问答清单，没有统一算法输入协议；其中赔率采用语言 round 的舍入规则也未规定，不适合直接编成确定性 OJ 题。"),
    15:("Nearest Neighbouring City","同距离时的优先规则在 FastPrep 原文中断裂乱码，MDX 样例也把城市名输出成数字 `3`；并列时无法从固定源恢复唯一规则。"),
    16:("Optimized Waffle Baking Championship Probability","函数参数仅给 scores 与 prob 两个数组，但示例叙述出三种混合物各自不同的分布，无法从传入参数恢复示例中的策略空间/概率；没有可靠函数行为。"),
    20:("Effective Manager","题意没有说明会议是否必须按输入顺序、是否可重排，以及‘保持正数’约束是在每场之后还是仅统计正值场次；不同解释会改变最优答案。"),
    22:("Maximize Segregation Cost","与 #5 Binary Circuit 重复同一操作题，但函数题面写‘最大操作数’，同时返回描述及例子要求最大总费用；不将两种目标混为一谈。"),
    23:("Future Stock Prices","题面允许多股票、分数股、随时切换但没有完整定义资金能否跨日期再投资；样例 2 卖出价与所列日期价格不一致，样例 3 输入还缺分隔符，收益模型无法可靠复现。"),
    27:("Get Biggest Lions","这是面向类方法的事件驱动题，没有原始样例和规模限制；‘没有竞争狮子时最大竞争身高’及同分钟自家/对手事件与检查的处理没有给定完整 I/O 协议，先不设计模拟题协议。"),
}

RAW_FOR_BLOCKED={
    4:("OA LIST/Akuna_Capital_OA/007_1f89f5664c05d38034234003c6b487d6.txt","2646f142e6e7d020b6a213c9fbd94a2553e0ac77"),
    6:("web/content/docs/companies/akuna-capital.mdx","f55d4a120afd4d53753815e8a7c810c6c12626b4"),
    7:("web/content/docs/companies/akuna-capital.mdx","f55d4a120afd4d53753815e8a7c810c6c12626b4"),
    8:("web/content/docs/companies/akuna-capital.mdx","f55d4a120afd4d53753815e8a7c810c6c12626b4"),
    10:("web/content/docs/companies/akuna-capital.mdx","f55d4a120afd4d53753815e8a7c810c6c12626b4"),
    11:("web/content/docs/companies/akuna-capital.mdx","f55d4a120afd4d53753815e8a7c810c6c12626b4"),
    15:("fastprep/Akuna Capital/akuna-find-nearest-cities.md","f1993a4dc7aa9dced2a0d8ce253565e1bea5410e"),
    16:("fastprep/Akuna Capital/akuna-get-probability.md","59e6073830eac07e109c918a6041a844857942c4"),
    20:("fastprep/Akuna Capital/akuna-max-meetings.md","e940935bf4a8c54735c9ff32dfeee87e34e5a238"),
    22:("web/content/docs/companies/akuna-capital.mdx","f55d4a120afd4d53753815e8a7c810c6c12626b4"),
    23:("fastprep/Akuna Capital/akuna-maximum-amount-of-profit.md","bbc76159fb119420b365288dfe29612c5d5e27c8"),
    27:("fastprep/Akuna Capital/get-biggest-lions.md","535c0bcf446c81b8f2fb308226575cba8870de18"),
}

RAW_EVIDENCE_FOR_BLOCKED={
    4:[
        ("OA LIST/Akuna_Capital_OA/012_QQ_1744468305300.txt","23f5b0163c9a959fed8a48f8a0e4b3a9f4d4f2de"),
        ("OA LIST/Akuna_Capital_OA/013_QQ_1744468285462.txt","77511174494a800a84b022121b383f0bf90e7e95"),
        ("OA LIST/Akuna_Capital_OA/014_QQ_1744468332840.txt","e748fc8ed7a2bad3b04922adbaabed680c688a1e"),
    ],
}


def execute(path,stdin):
    p=subprocess.run([sys.executable,"-I",str(path)],input=stdin,text=True,capture_output=True,timeout=10,check=True)
    return p.stdout.rstrip("\n")


def normalize(raw):
    js="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    p=subprocess.run(["node","--import","tsx","-e",js],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout


def main():
    for folder in ("packages","editorials","references","oracles","mutants","negative-controls","reviews","candidate-batches","validation","source-evidence"):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    batch=[]; reports=[]; reviews=[]; evidence=[]
    for spec in SPECS:
        num=spec["number"]; ident=f"oa-akuna-capital-{num}"; source=SOURCES[ident]
        rng=random.Random(20261005+num)
        reference_code=textwrap.dedent(spec["code"]).strip()+"\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
        ref=OUT/"references"/f"{ident}.py";ref.write_text(reference_code)
        inputs=spec["values"]+[spec["random"](rng) for _ in range(160)]; oracle=[]
        for x in inputs:
            stdin=spec["encode"](x);expected=spec["oracle"](x);actual=execute(ref,stdin)
            assert actual==expected,(ident,"oracle mismatch",x,expected,actual)
            oracle.append({"input":stdin,"expectedOutput":expected+"\n"})
        tests=oracle[:3]
        for x,expected in spec["edges"]:
            stdin=spec["encode"](x);expected=spec["oracle"](x) if expected is None else expected
            actual=execute(ref,stdin);assert actual==expected,(ident,"boundary mismatch",x,expected,actual)
            tests.append({"input":stdin,"expectedOutput":expected+"\n"})
        tests.extend(oracle[3:31]);cases=[]
        for i,t in enumerate(tests):cases.append({"name":f"公开样例 {i+1}" if i<3 else f"隐藏验证 {i-2}",**t,"hidden":i>=3,"weight":1})
        mutants=[];kills=[]
        for j,(name,code) in enumerate(spec["mutants"],1):
            mutant=textwrap.dedent(code).strip()+"\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
            control=OUT/"negative-controls"/f"{ident}-{j}.py";control.write_text(mutant)
            killed=[i for i,c in enumerate(cases) if execute(control,c["input"])!=c["expectedOutput"].rstrip("\n")]
            assert killed,(ident,"mutant survived",name)
            mutants.append({"name":name,"code":mutant});kills.append({"name":name,"rejectedByCases":killed})
        prob={"id":ident,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"中等","tags":["OA","Akuna Capital"]+spec.get("tags",[]),"description":spec["desc"]+"\n\n题目来源与规则依据见题面/审阅记录；本站输入范围中标明的限制属于本站补充。","input":spec["input"],"output":spec["output"],"explanation":"请按题目规则处理输入；完整思路、正确性说明和复杂度见配套讲义。","hints":[spec["idea"]],"timeLimit":3,"memoryLimit":262144,"outputLimit":spec.get("output_limit",4096),"checker":"tokens","languages":["python","go","java","cpp"]}
        package=json.loads(normalize({"schemaVersion":1,"problem":prob,"cases":cases}))
        editorial_text=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        authored=[{"language":"python","code":reference_code}]
        editorial={"schemaVersion":1,"id":ident,"title":spec["title"],"explanation":editorial_text,"solutions":authored,"sourceUrl":source["sourceUrl"],"sourceContentHash":source["contentHash"],"author":"CSWork"}
        normalized=json.dumps(package,ensure_ascii=False,separators=(",",":"))
        for folder,obj in (("packages",package),("editorials",editorial),("oracles",oracle),("mutants",mutants)):
            (OUT/folder/f"{ident}.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
        batch.append({"id":ident,"sourceContentHash":source["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":editorial_text,"authoredSolutions":authored})
        reports.append({"id":ident,"oracleCases":len(oracle),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":kills,"referenceSha256":hashlib.sha256(reference_code.encode()).hexdigest()})
        reviews.append({"id":ident,"status":"authored","reason":spec["source_note"]+" 输入协议与本站补充限制已写入题面；独立 oracle、参考程序、边界/隐藏测试及两个正常退出 mutant 均离线验证通过。","sourceCommit":SOURCE_COMMIT,"rawPath":spec["raw_path"],"rawGitBlob":spec["raw_blob"],"catalogContentHash":source["contentHash"]})
        evidence.append({"id":ident,"sourceFiles":[{"path":spec["raw_path"],"gitBlob":spec["raw_blob"]}]+[{"path":p,"gitBlob":b} for p,b in spec.get("evidence_paths",[])],"catalogContentHash":source["contentHash"]})
        print(f"{ident}: {len(oracle)} oracle inputs, {len(cases)} judge cases; mutants killed",flush=True)
    for num,(title,reason) in BLOCKED.items():
        ident=f"oa-akuna-capital-{num}";path,blob=RAW_FOR_BLOCKED[num];source=SOURCES[ident]
        reviews.append({"id":ident,"status":"blocked","reason":reason,"sourceCommit":SOURCE_COMMIT,"rawPath":path,"rawGitBlob":blob,"catalogContentHash":source["contentHash"]})
        sources=[{"path":path,"gitBlob":blob}]+[{"path":p,"gitBlob":b} for p,b in RAW_EVIDENCE_FOR_BLOCKED.get(num,[])]
        evidence.append({"id":ident,"sourceFiles":sources,"catalogContentHash":source["contentHash"]})
    candidate={"schemaVersion":1,"items":batch}
    (OUT/"candidate-batches/akuna-next.json").write_text(json.dumps(candidate,ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation/akuna-next.json").write_text(json.dumps({"schemaVersion":1,"seed":20261005,"problems":reports,"note":"Offline reference/oracle/mutant validation only; not run in GoJudge and not published."},ensure_ascii=False,indent=2)+"\n")
    (OUT/"reviews/akuna-next.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
    evidence.append({"sourceCommit":SOURCE_COMMIT,"mdxPath":"web/content/docs/companies/akuna-capital.mdx","mdxGitBlob":"f55d4a120afd4d53753815e8a7c810c6c12626b4","catalogPath":"content/oa-master/catalog.json","items":list(evidence)})
    (OUT/"source-evidence/akuna-next.json").write_text(json.dumps(evidence[-1],ensure_ascii=False,indent=2)+"\n")


if __name__=="__main__":main()
