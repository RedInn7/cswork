#!/usr/bin/env python3
"""Author and independently cross-check MathWorks OA candidates; never runs upstream code."""
from __future__ import annotations
import hashlib, itertools, json, math, random, subprocess, sys
from collections import Counter, deque
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/"content/oa-judge"
SEED=20261005
COMMIT="e66f809f4c953bce129f68491726176615db6afc"
CAT={x["id"]:x for x in json.loads((ROOT/"content/oa-master/catalog.json").read_text())["items"]}
MOD=1_000_000_007

REF={
1:"""def solve(s):
 d=list(map(int,s.split()));n,m=d[:2];a=d[2:];freq=[0]*m;ans=0
 if n:freq[a[0]%m]=1
 for mid in range(1,n-1):
  r=a[mid]%m
  for k in range(mid+1,n):ans+=freq[-(r+a[k])%m]
  freq[r]+=1
 return str(ans)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
2:"""import math
def solve(s):
 d=list(map(int,s.split()));a=d[1:];limit=max(a,default=1);phi=list(range(limit+1))
 if limit>=1:phi[1]=1
 for p in range(2,limit+1):
  if phi[p]==p:
   for x in range(p,limit+1,p):phi[x]-=phi[x]//p
 return " ".join(str(phi[x]) for x in a)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
3:"""def solve(s):
 d=list(map(int,s.split()));n=d[0];a=d[1:n+1];g=[[] for _ in range(n)];p=n+1
 for _ in range(n-1):
  u,v=d[p]-1,d[p+1]-1;p+=2;g[u].append(v);g[v].append(u)
 parent=[-1]*n;depth=[0]*n;order=[0];parent[0]=0
 for u in order:
  for v in g[u]:
   if parent[v]<0:parent[v]=u;depth[v]=depth[u]+1;order.append(v)
 sub=a[:]
 for v in order[:0:-1]:sub[parent[v]]+=sub[v]
 beauty=[0]*n;beauty[0]=sum(depth[i]*a[i] for i in range(n));total=sum(a)
 for v in order[1:]:beauty[v]=beauty[parent[v]]+total-2*sub[v]
 return str(max(beauty))
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
8:"""def solve(s):
 d=list(map(int,s.split()));n,b=d[:2];c=d[2:2+n];stock=d[2+n:2+2*n];cost=d[2+2*n:]
 def ok(x):return sum(max(0,x*a-v)*w for a,v,w in zip(c,stock,cost))<=b
 lo,hi=0,1
 while ok(hi):hi*=2
 while lo+1<hi:
  mid=(lo+hi)//2
  if ok(mid):lo=mid
  else:hi=mid
 return str(lo)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
10:"""from collections import Counter
def solve(s):
 d=s.split();words=d[1:];pat=[tuple(ord(w[i+1])-ord(w[i]) for i in range(len(w)-1)) for w in words];cnt=Counter(pat)
 return next(w for w,p in zip(words,pat) if cnt[p]==1)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
12:"""MOD=1000000007
def solve(s):
 n,d=map(int,s.split());v=[1]*26
 for _ in range(n-1):
  p=[0]
  for z in v:p.append((p[-1]+z)%MOD)
  v=[(p[min(26,i+d+1)]-p[max(0,i-d)])%MOD for i in range(26)]
 return str(sum(v)%MOD)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
15:"""def solve(s):
 d=list(map(int,s.split()));n=d[0];a=d[1:1+n];b=d[1+n:];x=[y-z for y,z in zip(b,a)]
 if min(x)<0:return "-1"
 if n==1:return str(x[0])
 need=sum(max(0,x[i-1]-x[i]) for i in range(1,n))
 if need>x[0]:return "-1"
 return str(x[-1]+need)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
16:"""def solve(s):
 d=list(map(int,s.split()));n=d[0];a=d[1:];neg=-10**9;dp=[neg]*(n+1);dp[0]=0
 for x in a:
  for length in range(n-1,-1,-1):
   if dp[length]>=0:dp[length+1]=max(dp[length+1],dp[length]+(x==length+1))
 return str(max(dp[1:]))
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
19:"""def solve(s):
 d=list(map(int,s.split()));a=d[1:];z=sum(x for x in a if x>0)
 if z%2==0:return str(z)
 pos=[x for x in a if x>0 and x%2];neg=[x for x in a if x<0 and x%2]
 return str(max(z-min(pos) if pos else -10**100,z+max(neg) if neg else -10**100,0))
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
"""
}

S={
1:("Counting Triplets (Sum Divisible by d)","中等","给定整数数组，统计下标严格递增且三数之和能被 d 整除的三元组数量。","首行 n d；第二行 n 个整数。3≤n≤1000，1≤arr[i]≤10^9，2≤d≤10^6。","输出符合条件的下标三元组数量。","按余数统计前两个位置，由模 d 唯一确定第三个余数；使用组合计数排除重复下标。",[( [2,3,1,6],3),([1,1,1],3),([1,2,4,8],5)],"O(n²+d)，空间 O(d)。"),
2:("Co-prime Count (Euler's Totient)","中等","给定正整数数组 A，返回同长度数组 B；B[i] 是区间 [1,A[i]] 中与 A[i] 互质的整数个数。","首行 n；第二行 n 个正整数。本站约束：1≤n≤5000，1≤A[i]≤100000；n 上限和较大的输出额度用于适配本站标准输出评测。","按输入顺序输出各 A[i] 的互质计数。","线性筛式更新：初始 φ[x]=x；对每个质数 p，把其倍数的 φ[x] 减去 φ[x]/p，最后按输入顺序读取 φ[A[i]]。",[[5,8,14],[1],[2,3,4],[100000],[1]*5000],"O(M log log M+n)，M=max(A)，空间 O(M)。"),
3:("Rooted Distances (Re-rooting DP)","中等","给定一棵树及每个顶点权值 a[v]。顶点 v 的 beauty 为所有顶点 u 的 dist(u,v)×a[u] 之和，输出所有顶点 beauty 的最大值。","首行 n；第二行 n 个权值；随后 n−1 行给边 u v（1-based）。本站补充约束：1≤n≤100000，0≤a[i]≤10^9。","输出最大 beauty。","以节点 1 为根先算加权距离和及子树权值；根从 u 移到子节点 v 时，子树贡献减少、其余贡献增加，可在线性时间完成换根。",[[[3,4],[[0,1]]],[[1,2,3],[[0,1],[1,2]]],[[0,0,7,1],[[0,1],[1,2],[1,3]]]],"O(n)，空间 O(n)。"),
8:("Alloy Production","中等","每单位合金需要 composition[i] 单位第 i 种金属；已有 stock[i]，还可按 cost[i] 单价购买，预算为 budget。求最多生产多少单位。","首行 n budget；随后三行分别为 composition、stock、cost。本站补充约束：1≤n≤100000，0≤budget≤10^9，1≤composition[i],cost[i]≤10^9，0≤stock[i]≤10^9。","输出最多合金数。","产量 x 的购买成本是 Σmax(0,x·composition[i]−stock[i])·cost[i]，随 x 单调不减，可二分最大可行产量。题源样例输出 1 正确，原解释成本算式有误，本站按规则修正。",[[[1,2],[0,1],[1,1],3],[[2],[10],[4],0],[[1,1],[0,0],[2,3],5]],"O(n log U)，空间 O(n)。"),
10:("Odd One Out","简单","给定等长大写单词序列。对每个单词计算相邻字母的有符号差值序列；返回与其余单词的差值序列不同的单词。保证恰有 n−1 个单词共享同一差值序列，另一个不同。","首行 n，随后 n 行单词。3≤n≤26，2≤单词长度≤26；同组单词等长且仅含大写英文字母。","输出唯一不同的单词。","比较有方向的相邻字母差值序列。例如 ACB 与 BDC 都是 (+2,−1)。",[["ACB","BDC","CED","DEF"],["ABC","BCD","CDE","CBA"],["AA","BC","DE"]],"O(nL)，空间 O(nL)。"),
12:("Good Strings","中等","统计长度为 n 的小写字母串中，所有相邻字母的字母表序号差的绝对值都不超过 d 的字符串数，答案对 1,000,000,007 取模。","一行 n d。本站补充约束：1≤n≤100000，0≤d≤25。","输出合法字符串数模 1,000,000,007。","按末尾字母做动态规划；新字符只从相差不超过 d 的末尾状态转移。",[[2,2],[3,5],[1,0],[2,0]],"O(26n)，空间 O(26)。"),
15:("Minimum Operations to Make Arrays Equal","中等","给定等长整数数组 source、target。一次操作选择一个前缀或后缀，并将其中所有元素加 1。求最少操作数；无法变成 target 时输出 −1。","首行 n；第二行 source；第三行 target。1≤n≤100000，元素绝对值≤10^13。","输出最少操作次数或 −1。","令 d[i]=target[i]−source[i]，必须逐项非负。每个 d[i−1] 到 d[i] 的下降至少需要一个在该边界结束的前缀操作。下降总量 N 若超过 d[0] 则不可能；否则用 N 个前缀和若干后缀/全数组操作补齐，最少操作数为 d[n−1]+N。",[[[1,2,2],[2,2,3]],[[0,0],[2,3]],[[0,0,0],[1,2,1]],[[5],[8]]],"O(n)，空间 O(n)。"),
16:("Maximize Beauty","中等","数组 beauty 是满足 1-based 位置 i 上 arr[i]=i 的位置数。可反复删除任意元素但数组长度保持至少 1，且不改变顺序。求最大可能 beauty。","首行 n；第二行 n 个正整数。1≤n≤2000，1≤arr[i]≤10^5。","输出最大 beauty。","DP 状态 dp[k] 表示当前前缀中选出长度 k 的子序列时 beauty 的最大值。保留当前元素时，其新位置为 k+1，据此判断是否得分；倒序更新避免重复选取。",[[1,3,2,5,4,5,3],[6,3,2,4,3,4],[7],[2,2,2]],"O(n²)，空间 O(n)。"),
19:("Discount Tags","中等","从可正可负的标签值中任选若干项（可一项不选），使总和为偶数；求最大可能偶数和。题源保证至少有一个偶数。","首行 n；第二行 n 个整数。本站补充约束：1≤n≤100000，|val[i]|≤10^9。","输出最大偶数和。","先取所有正数得到最大和；若它为奇数，比较去掉最小正奇数或加入最接近 0 的负奇数两种修正。",[[3,2,5,-1],[4,-2,3],[0],[2,-5]],"O(n)，空间 O(n)。")
}

def enc(q,x):
 if q==1:
  a,d=x;return f"{len(a)} {d}\n"+" ".join(map(str,a))+"\n"
 if q==2:return f"{len(x)}\n"+" ".join(map(str,x))+"\n"
 if q==3:
  a,e=x;return f"{len(a)}\n"+" ".join(map(str,a))+"\n"+"".join(f"{u+1} {v+1}\n" for u,v in e)
 if q==8:
  c,s,k,b=x;return f"{len(c)} {b}\n"+" ".join(map(str,c))+"\n"+" ".join(map(str,s))+"\n"+" ".join(map(str,k))+"\n"
 if q==10:return f"{len(x)}\n"+"\n".join(x)+"\n"
 if q==12:return f"{x[0]} {x[1]}\n"
 if q==15:
  a,b=x;return f"{len(a)}\n"+" ".join(map(str,a))+"\n"+" ".join(map(str,b))+"\n"
 return f"{len(x)}\n"+" ".join(map(str,x))+"\n"

def oracle(q,x):
 if q==1:
  a,d=x;return sum((a[i]+a[j]+a[k])%d==0 for i in range(len(a)) for j in range(i+1,len(a)) for k in range(j+1,len(a)))
 if q==2:
  return [sum(math.gcd(i,v)==1 for i in range(1,v+1)) for v in x]
 if q==3:
  a,e=x;g=[[] for _ in a]
  for u,v in e:g[u].append(v);g[v].append(u)
  best=None
  for r in range(len(a)):
   ds=[-1]*len(a);ds[r]=0;todo=deque([r])
   while todo:
    u=todo.popleft()
    for v in g[u]:
     if ds[v]<0:ds[v]=ds[u]+1;todo.append(v)
   z=sum(d*w for d,w in zip(ds,a));best=z if best is None else max(best,z)
  return best
 if q==8:
  c,s,k,b=x;ans=0
  while sum(max(0,(ans+1)*a-v)*w for a,v,w in zip(c,s,k))<=b:ans+=1
  return ans
 if q==10:
  p=[tuple(ord(w[i+1])-ord(w[i]) for i in range(len(w)-1)) for w in x]
  return next(w for w,z in zip(x,p) if p.count(z)==1)
 if q==12:
  n,d=x;ways=[1]*26
  for _ in range(n-1):ways=[sum(ways[j] for j in range(26) if abs(i-j)<=d) for i in range(26)]
  return sum(ways)%MOD
 if q==15:
  a,b=x;target=tuple(v-u for u,v in zip(a,b));n=len(a)
  if min(target)<0:return -1
  todo=deque([(0,)*n]);dist={(0,)*n:0}
  while todo:
   state=todo.popleft()
   if state==target:return dist[state]
   for lo,hi in [(0,i) for i in range(n)]+[(i,n-1) for i in range(n)]:
    nxt=tuple(v+(lo<=i<=hi) for i,v in enumerate(state))
    if all(nxt[i]<=target[i] for i in range(n)) and nxt not in dist:dist[nxt]=dist[state]+1;todo.append(nxt)
  return -1
 if q==16:
  best=0
  for mask in range(1,1<<len(x)):
   seq=[x[i] for i in range(len(x)) if mask>>i&1]
   best=max(best,sum(v==i+1 for i,v in enumerate(seq)))
  return best
 if q==19:
  return max(sum(x[i] for i in range(len(x)) if mask>>i&1) for mask in range(1<<len(x)) if sum(x[i] for i in range(len(x)) if mask>>i&1)%2==0)

def rnd(q,r):
 if q==1:return [r.randint(1,30) for _ in range(r.randint(3,9))],r.randint(2,10)
 if q==2:return [r.randint(1,60) for _ in range(r.randint(1,8))]
 if q==3:
  n=r.randint(1,9);return [r.randint(0,15) for _ in range(n)],[(i,r.randrange(i)) for i in range(1,n)]
 if q==8:return [r.randint(1,5) for _ in range(1)], [r.randint(0,8) for _ in range(1)], [r.randint(1,5) for _ in range(1)], r.randint(0,12)
 if q==10:
  n=r.randint(3,8);L=r.randint(2,4);base=tuple(r.randint(-2,2) for _ in range(L-1));other=tuple(r.randint(-3,3) for _ in range(L-1))
  while other==base:other=tuple(r.randint(-3,3) for _ in range(L-1))
  patterns=[base]*(n-1)+[other];r.shuffle(patterns);words=[]
  for pat in patterns:
   vals=[10]
   for z in pat:vals.append(vals[-1]+z)
   words.append("".join(chr(65+v) for v in vals))
  return words
 if q==12:return r.randint(1,10),r.randint(0,25)
 if q==15:
  n=r.randint(1,7);a=[r.randint(-4,4) for _ in range(n)];p=r.randint(0,3);s=r.randint(0,3);d=[(p if i<n else 0)+(s if i>0 else 0) for i in range(n)]
  if r.random()<.3:d[r.randrange(n)]+=1
  return a,[v+z for v,z in zip(a,d)]
 if q==16:return [r.randint(1,10) for _ in range(r.randint(1,12))]
 if q==19:
  a=[r.randint(-15,20) for _ in range(r.randint(1,12))]
  if not any(x%2==0 for x in a):a[0]=0
  return a

def mutants(q):
 if q==1:return [("重复下标仍计入组合","import sys\nd=list(map(int,sys.stdin.read().split()));n,m=d[:2];a=d[2:];print(sum((a[i]+a[j]+a[k])%m==0 for i in range(n) for j in range(n) for k in range(n))//6)"),("只返回全部三元组数","import sys\nd=list(map(int,sys.stdin.read().split()));n,m=d[:2];print(n*(n-1)*(n-2)//6)")]
 if q==2:return [("把 phi(x) 错写为 x-1","import sys\nd=list(map(int,sys.stdin.read().split()));print(' '.join(str(x-1) for x in d[1:]))"),("漏掉 x 本身的互质计数","import sys,math\nd=list(map(int,sys.stdin.read().split()));print(' '.join(str(sum(math.gcd(i,x)==1 for i in range(1,x))) for x in d[1:]))")]
 if q==3:return [("仅计算节点 1 为根","import sys\nd=list(map(int,sys.stdin.read().split()));n=d[0];a=d[1:n+1];g=[[] for _ in a];p=n+1\nfor _ in range(n-1):u,v=d[p]-1,d[p+1]-1;p+=2;g[u].append(v);g[v].append(u)\nz=0;st=[(0,-1,0)]\nwhile st:\n u,b,k=st.pop();z+=k*a[u];st += [(v,u,k+1) for v in g[u] if v!=b]\nprint(z)"),("把权值全部当作 1","import sys\nd=list(map(int,sys.stdin.read().split()));n=d[0];print(n*(n-1)//2)")]
 if q==8:return [("忽略已有库存","import sys\nd=list(map(int,sys.stdin.read().split()));n,b=d[:2];c=d[2:2+n];s=d[2+n:2+2*n];k=d[2+2*n:];print(max(0,min((b//z)//x for x,z in zip(c,k))))"),("把总预算重复用于每种金属","import sys\nd=list(map(int,sys.stdin.read().split()));n,b=d[:2];c=d[2:2+n];s=d[2+n:2+2*n];k=d[2+2*n:];lo=0\nfor x,y,z in zip(c,s,k):\n while max(0,(lo+1)*x-y)*z<=b:lo+=1\nprint(lo)")]
 if q==10:return [("只比较绝对差值，忽略方向","import sys\nfrom collections import Counter\nd=sys.stdin.read().split();w=d[1:];p=[tuple(abs(ord(x[i+1])-ord(x[i])) for i in range(len(x)-1)) for x in w];c=Counter(p);print(next((x for x,y in zip(w,p) if c[y]==1),''))"),("固定返回最后一个单词","import sys\nd=sys.stdin.read().split();print(d[-1])")]
 if q==12:return [("把不超过 d 错写成严格小于 d","import sys\nn,d=map(int,sys.stdin.read().split());v=[1]*26\nfor _ in range(n-1):v=[sum(v[j] for j in range(26) if abs(i-j)<d) for i in range(26)]\nprint(sum(v)%1000000007)"),("只统计长度 1 的字符串","import sys\nn,d=map(int,sys.stdin.read().split());print(26)")]
 if q==15:return [("错误地要求所有位置增量相同","import sys\nd=list(map(int,sys.stdin.read().split()));n=d[0];a=d[1:1+n];b=d[1+n:];x=[y-z for y,z in zip(b,a)];print(sum(x) if min(x)>=0 and len(set(x))==1 else -1)"),("把允许的 +1 操作错作绝对差","import sys\nd=list(map(int,sys.stdin.read().split()));n=d[0];a=d[1:1+n];b=d[1+n:];print(sum(abs(y-z) for y,z in zip(a,b)))")]
 if q==16:return [("只看原数组位置，不模拟删除后的下标","import sys\nd=list(map(int,sys.stdin.read().split()));print(sum(x==i+1 for i,x in enumerate(d[1:])))"),("按不同数值个数估计 beauty","import sys\nd=list(map(int,sys.stdin.read().split()));print(len(set(d[1:])))")]
 if q==19:return [("不修正奇数总和","import sys\nd=list(map(int,sys.stdin.read().split()));print(sum(x for x in d[1:] if x>0))"),("负奇数一律不参与选择","import sys\nd=list(map(int,sys.stdin.read().split()));a=d[1:];z=sum(x for x in a if x>0);print(z if z%2==0 else z-min((x for x in a if x>0 and x%2),default=0))")]

def run(code,raw):
 env={"__name__":"candidate"};exec(compile(code,"<reference>","exec"),env);return env["solve"](raw).strip()

def output(ans):
 return " ".join(map(str,ans)) if isinstance(ans,list) else str(ans)

def proof(q):
 return {
  1:"固定中间下标 j 时，频次数组只记录 j 左侧元素余数。对每个右侧 k，唯一需要的左侧余数为 −arr[j]−arr[k] (mod d)，查表即可计入所有合法 i。每对 j,k 的贡献都对应唯一递增三元组，因此总和恰为答案。",
  2:"φ 的初值为 x。每个质数 p 的倍数恰好含因子 p 的可被排除比例 1/p，所以依次对所有质数倍数减去当前值的 1/p；按 Euler 函数乘法性质可得到各 φ(x)，即定义所需互质数数量。",
  3:"初始根的加权距离和直接按深度求和。换根跨过一条边时，子树中每个权值的距离减一，子树外的距离加一，故转移量为总权值减去子树权值的两倍。遍历所有节点取最大值。",
  8:"给定产量时，各金属只需补足配方短缺，公式恰是实现该产量的最小购买成本。成本随产量单调不减，二分得到预算内的最大产量。",
  10:"题目保证只有一个单词的差值签名与其他单词不同。计数签名后唯一只出现一次的单词就是答案。",
  12:"按字符串末尾字母分类。追加字符 c 合法当且仅当旧末尾与 c 的距离≤d；因此该转移既不遗漏也不重复计数全部合法字符串。",
  15:"记 N 为相邻增量中所有下降幅度之和。每次前缀操作最多贡献一次单位下降，所以至少要 N 次前缀；首项增量只有 d[0] 单位前缀/整段操作可用，故 N>d[0] 时无解。若 N≤d[0]，按每个下降位置放置前缀，剩余用整段和后缀补齐即可构造目标；化简后的总操作数为 d[last]+N，达到下界。",
 16:"dp[k] 表示处理到当前原数组前缀、选出长度 k 的子序列时可达到的最大 beauty。跳过当前元素保留旧状态；选择它时新位置为 k+1，值恰等于 k+1 才加分。倒序转移保证每个原元素最多使用一次。处理完后在所有非空长度中取最大值。",
  19:"所有正数之和是未施加奇偶条件时的最大值。若为奇数，任一可行解至少需要去掉一个正奇数或加入一个负奇数；选损失最小的这两种调整之一即为最大偶数和。"
 }[q]

def main():
 rng=random.Random(SEED);batch=[];val=[];review=[];evidence=[]
 for q,(title,diff,desc,inp,out,ex,samples,complexity) in S.items():
  print(f"Generating MathWorks #{q}",flush=True)
  pid=f"oa-mathworks-{q}";source=CAT[pid];ref=REF[q];oracle_tests=[];used=set()
  while len(oracle_tests)<163:
   x=rnd(q,rng);raw=enc(q,x)
   if raw in used:continue
   used.add(raw);ans=oracle(q,x);got=run(ref,raw)
   assert got.split()==output(ans).split(),(pid,"oracle mismatch",x,got,ans)
   oracle_tests.append(dict(input=raw,expectedOutput=output(ans)+"\n"))
  package_cases=[]
  for i,x in enumerate(samples):
   raw=enc(q,x)
   if q==12 and x[0]>4: ans=pow(26,x[0],MOD) if x[1]==25 else 26
   else: ans=oracle(q,x)
   got=run(ref,raw);assert got.split()==output(ans).split(),(pid,"sample",i,got,ans)
   package_cases.append(dict(name=f"样例 {i+1}",input=raw,expectedOutput=output(ans)+"\n",hidden=False,weight=1))
  if q==12:
   for n,d,ans in [(100000,25,pow(26,100000,MOD)),(100000,0,26)]:
    raw=enc(q,(n,d));assert run(ref,raw)==str(ans)
    package_cases.append(dict(name=f"边界 n=100000, d={d}",input=raw,expectedOutput=str(ans)+"\n",hidden=True,weight=1))
  # Deterministic, varied formal tests separate from the independent oracle set.
  for i in range(24):
   x=rnd(q,rng);raw=enc(q,x);ans=oracle(q,x);got=run(ref,raw)
   assert got.split()==output(ans).split(),(pid,"formal",i,got,ans)
   package_cases.append(dict(name=f"隐藏组合 {i+1}",input=raw,expectedOutput=output(ans)+"\n",hidden=True,weight=1))
  mutants_for_q=mutants(q);negative=[]
  for j,(name,code) in enumerate(mutants_for_q,1):
   killed=None
   for i,c in enumerate(package_cases+oracle_tests):
    p=subprocess.run([sys.executable,"-c",code],input=c["input"],text=True,capture_output=True,timeout=5)
    assert p.returncode==0,(pid,name,p.stderr)
    if p.stdout.strip().split()!=c["expectedOutput"].split():killed=i;break
   assert killed is not None,(pid,name,"not rejected")
   f=OA/"negative-controls"/f"{pid}-{j}.py";f.parent.mkdir(exist_ok=True);f.write_text(code+"\n")
   negative.append(dict(file=str(f.relative_to(ROOT)),description=name,rejectedByCases=[killed]))
  (OA/"references").mkdir(exist_ok=True);(OA/"references"/(pid+".py")).write_text(ref)
  write(OA/"oracles"/(pid+".json"),oracle_tests)
  write(OA/"mutants"/(pid+".json"),[dict(name=n,code=c) for n,c in mutants_for_q])
  problem=dict(id=pid,courseId="gomall",lessonId="00-overview",title=title,difficulty=diff,tags=["OA","MathWorks"],description=desc+"\n\n本站采用标准输入输出协议。",input=inp,output=out,explanation=ex,hints=[ex],timeLimit=4,memoryLimit=262144,outputLimit=65536 if q==2 else 4096,checker="tokens",languages=["python","go","java","cpp"])
  package=dict(schemaVersion=1,problem=problem,cases=package_cases);write(OA/"packages"/(pid+".json"),package)
  editorial=f"## 思路\n\n{ex}\n\n## 正确性证明\n\n{proof(q)}\n\n## 复杂度\n\n{complexity}"
  solutions=[dict(language="python",code=ref)]
  write(OA/"editorials"/(pid+".json"),dict(schemaVersion=1,id=pid,title=title,explanation=editorial,solutions=solutions,sourceUrl=source["sourceUrl"],sourceContentHash=source["contentHash"],author="CSWork"))
  batch.append(dict(id=pid,sourceContentHash=source["contentHash"],packageChecksum=hashjson(package),editorial=editorial,authoredSolutions=solutions))
  val.append(dict(id=pid,oracleCases=len(oracle_tests),formal=len(package_cases),passed=len(oracle_tests)+len(package_cases),negativeControls=negative,referenceSha256=hashlib.sha256(ref.encode()).hexdigest()))
  review.append(dict(id=pid,status="authored",reason="已逐题核对 OAMaster 题面；必要的本站输入协议和约束已公开注明。163 个独立 oracle、正式用例和两个正常退出错误程序均离线验证通过；尚未运行 GoJudge。",sourceUrls=[source["sourceUrl"]],sourceContentHashes=[source["contentHash"]],sourceCommit=COMMIT,catalogContentHash=source["contentHash"]))
  evidence.append(dict(id=pid,catalogContentHash=source["contentHash"],sourceUrl=source["sourceUrl"],status="authored"))
 write(OA/"candidate-batches"/"mathworks-next.json",dict(schemaVersion=1,items=batch))
 write(OA/"validation"/"mathworks-next.json",dict(schemaVersion=1,seed=SEED,sourceCommit=COMMIT,note="每题 163 个独立随机 oracle 输入、样例和正式用例、两个正常退出 mutant；只表示离线验证，不代表 GoJudge。",problems=val))
 blocked={
  4:"混合概率、座位逻辑、向量和图表选择题，不是可通过本站代码评测的编程题。",
  5:"题面说返回幸存车辆列表，样例却输出索引；Example 2 声称 n=5 但方向有 6 项，数组长度也不一致。",
  9:"约束为 N/A，未定义所选 i、j 是否须互异；负值会使删除小元素的语义不确定，不能凭猜测补完整判题域。",
  17:"无约束，正文要求最大偶数和但示例解释描述最长子序列；也未说明可否选空子序列。",
  18:"原作者明言不确定输出和解释；样例过程中的字符串变化也与操作定义不一致。",
  20:"规则在 ‘A value of’ 后截断，无法还原填零规则和目标。",
  21:"关键规则在 ‘where y’ 后截断，缺少 x/y 关系。",
  22:"样例中第三行的 1×1 网格值为 4，满足 maxSum=4，所以至少 k=1；但题源给出 0。"
 }
 for q,reason in blocked.items():
  src=CAT[f"oa-mathworks-{q}"]
  review.append(dict(id=f"oa-mathworks-{q}",status="blocked",reason=reason,sourceUrls=[src["sourceUrl"]],sourceContentHashes=[src["contentHash"]],sourceCommit=COMMIT,catalogContentHash=src["contentHash"]))
  evidence.append(dict(id=f"oa-mathworks-{q}",catalogContentHash=src["contentHash"],sourceUrl=src["sourceUrl"],status="blocked"))
 write(OA/"reviews"/"mathworks-next.json",dict(schemaVersion=1,items=review))
 write(OA/"source-evidence"/"mathworks-next.json",dict(schemaVersion=1,repository="https://github.com/RedInn7/OA-Master",commit=COMMIT,reason="按每题 sourceUrl 和 catalog 内容指纹审阅；只读题面，从未执行上游代码。",items=evidence))
 print(f"Validated {len(batch)} candidates: {sum(x['oracleCases'] for x in val)} independent oracle inputs; blocked {len(blocked)} ambiguous/non-programming items.")

def hashjson(v):
 return hashlib.sha256(json.dumps(v,ensure_ascii=False,separators=(",",":")).encode()).hexdigest()

def write(path,obj):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")

if __name__=="__main__":main()
