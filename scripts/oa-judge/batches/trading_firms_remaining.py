"""Generate a reviewed, candidate-only batch for remaining financial-company OAs.

This writes only this batch's uniquely named artifacts. It never edits coverage,
the formal registry, official batches, or GoJudge reports.
"""
from pathlib import Path
import hashlib, json, random, subprocess, sys, textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CAT = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
COV = json.loads((OUT / "coverage.json").read_text())
SRC = {x["id"]: x for x in CAT["items"]}
SCOPE = {"millennium", "point72", "maven-securities", "wolverine-trading",
         "morgan-stanley", "bny-mellon", "bnp", "factset", "deutsche-bank",
         "barclays", "barclay", "susquehanna-international-group",
         "square-point", "sig"}
UNREVIEWED = [x["id"] for x in COV["items"] if x["company"] in SCOPE and x["status"] == "unreviewed"]
BATCH = "trading-firms-remaining"
RUN = "\nif __name__ == '__main__':\n import sys\n print(solve(sys.stdin.read()))\n"

def py(code): return textwrap.dedent(code).strip() + RUN
def run(code, data):
    p = subprocess.run([sys.executable, "-I", "-c", code], input=data, text=True,
                       capture_output=True, timeout=10, check=True)
    return p.stdout.rstrip("\n")

SPECS = {}

def add(pid, title, tags, description, inp, output, examples, random_value,
        encode, oracle, reference, mutants, idea, proof, complexity, note=""):
    SPECS[pid] = dict(id=pid, title=title, tags=tags, desc=description, inp=inp,
        output=output, examples=examples, random=random_value, encode=encode,
        oracle=oracle, code=reference, mutants=mutants, idea=idea, proof=proof,
        complexity=complexity, note=note)

# The protocols below are an explicit CSWork addition; upstream items are
# function-style statements and generally do not prescribe stdin/stdout.

def point72_code(raw):
    s=raw.strip(); out=list(s); i=0
    while i<len(s) and s[i]=='a': i+=1
    if i==len(s): out[-1]='z'
    else:
        while i<len(s) and s[i]!='a': out[i]=chr(ord(s[i])-1); i+=1
    return ''.join(out)
def point72_oracle(s):
    best=None
    for l in range(len(s)):
        for r in range(l+1,len(s)+1):
            t=s[:l]+''.join('z' if c=='a' else chr(ord(c)-1) for c in s[l:r])+s[r:]
            if best is None or t<best: best=t
    return best
def point72_enc(s): return s+'\n'
add('oa-point72-3','子串操作后的字典序最小字符串',['字符串','贪心'],
    '给定仅含小写英文字母的字符串。必须选择一个非空连续子串，将其中每个字符恰好替换为字母表前一个字符；a 的前一个字符是 z。输出能得到的字典序最小字符串。',
    '输入一行字符串 s（1 ≤ |s| ≤ 100000）。','输出操作后的字符串。',
    ['cbabc','aaaa','leetcode'],lambda r: ''.join(r.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(r.randint(1,18))),
    point72_enc,point72_oracle,
    '''def solve(raw):
 s=raw.strip(); out=list(s); i=0
 while i<len(s) and s[i]=='a': i+=1
 if i==len(s): out[-1]='z'
 else:
  while i<len(s) and s[i]!='a': out[i]=chr(ord(s[i])-1); i+=1
 return ''.join(out)''',
    [('把 a 循环减为 z 后继续', '''def solve(raw):
 s=raw.strip(); return ''.join('z' if c=='a' else chr(ord(c)-1) for c in s)'''),
     ('仅修改首个字符', '''def solve(raw):
 s=raw.strip(); return ('z'+s[1:]) if s[0]=='a' else chr(ord(s[0])-1)+s[1:]''')],
    '跳过前导 a，随后把遇到的连续非 a 字符都减一；若全串都是 a，只把最后一个 a 变成 z。',
    '字典序首先由最早变化位置决定。把前导 a 改成 z 只会变大，因此最优操作从第一个非 a 开始；连续减小字符均严格改善结果，遇到 a 后继续操作会把该位置变成 z 而变差。若不存在非 a，任意操作都会产生 z，放在最右端可使前缀尽可能小。',
    '时间 O(n)，空间 O(n)。', '题面与约束完整；标准输入输出协议由本站补充。')

def square_code(raw):
    from bisect import bisect_left
    rows=raw.splitlines(); n,m=map(int,rows[0].split()); products=rows[1].split(); search=rows[2].strip()
    products.sort(); out=[]
    for i in range(1,len(search)+1):
        prefix=search[:i]; j=bisect_left(products,prefix); found=[]
        while j<len(products) and products[j].startswith(prefix) and len(found)<3: found.append(products[j]); j+=1
        out.append(found)
    return '\n'.join(' '.join(row) if row else '-' for row in out)
def square_oracle(v):
    products,search=v; return '\n'.join(' '.join(sorted(x for x in products if x.startswith(search[:i]))[:3]) or '-' for i in range(1,len(search)+1))
def square_enc(v):
    p,s=v; return f'{len(p)} {len(s)}\n'+ ' '.join(p)+'\n'+s+'\n'
add('oa-square-point-2','搜索建议',['字符串','排序'],
    '给定互不相同的商品名称和搜索词。每输入搜索词的一个字符，就输出所有匹配当前前缀的商品中字典序最小的至多 3 个。',
    '首行 n m（1 ≤ n,m ≤ 1000）；第二行 n 个不含空白的商品名；第三行搜索词。商品名与搜索词只含小写英文字母。',
    '对搜索词每个非空前缀各输出一行。该行是匹配商品中最小的至多 3 个，按字典序排列；没有匹配时输出 -。',
    [(['abcd','abba','adbc','abcc'],'abcd'),(['b','a','ba'],'c'),(['ba','bb','bc','bd'],'ba')],lambda r: (sorted(set(''.join(r.choice('abcd') for _ in range(r.randint(1,7))) for _ in range(r.randint(1,12)))), ''.join(r.choice('abcd') for _ in range(r.randint(1,7)))),
    square_enc,square_oracle,
 '''def solve(raw):
 from bisect import bisect_left
 rows=raw.splitlines(); n,m=map(int,rows[0].split()); p=sorted(rows[1].split()); s=rows[2].strip(); out=[]
 for i in range(1,len(s)+1):
  prefix=s[:i]; j=bisect_left(p,prefix); ans=[]
  while j<len(p) and p[j].startswith(prefix) and len(ans)<3:
   ans.append(p[j]); j+=1
  out.append(' '.join(ans) if ans else '-')
 return '\\n'.join(out)''',
    [('未排序就取前三个', '''def solve(raw):
 rows=raw.splitlines(); n,m=map(int,rows[0].split()); p=rows[1].split(); s=rows[2].strip(); return '\\n'.join(' '.join([x for x in p if x.startswith(s[:i])][:3]) or '-' for i in range(1,len(s)+1))'''),
     ('每个前缀只返回一个商品', '''def solve(raw):
 rows=raw.splitlines(); n,m=map(int,rows[0].split()); p=sorted(rows[1].split()); s=rows[2].strip(); return '\\n'.join(next((x for x in p if x.startswith(s[:i])),'-') for i in range(1,len(s)+1))''')],
    '先将商品排序，再逐个搜索前缀并收集前 3 项。',
    '排序后，按序扫描所有商品时首次找到的匹配项即为字典序最小项；继续扫描至多取三项，因此每个前缀输出恰是题目要求的结果。',
    '设商品数为 n、搜索长度为 m；排序 O(n log n)，每个前缀二分定位并检查至多 3 个结果，时间 O(n log n + m log n)，不含字符比较开销。')

def split_code(raw):
    a=list(map(int,raw.split())); n=a[0]; arr=a[1:1+n]; pref=0; total=sum(arr); return str(sum(1 for x in arr[:-1] if (pref:=pref+x)>total-pref))
def split_oracle(arr): return str(sum(sum(arr[:i])>sum(arr[i:]) for i in range(1,len(arr))))
def split_enc(a): return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
add('oa-maven-securities-1','左右区间和比较',['数组','前缀和'],
    '给定整数数组，统计把数组切成两个非空连续部分的切法数，使左侧元素和严格大于右侧元素和。',
    '第一行 n（1 ≤ n ≤ 200000），第二行 n 个绝对值不超过 10^9 的整数。',
    '输出满足条件的切分数。',
    [[-3,-2,1,-6,-30],[1,1],[-5,1,1]],lambda r: [r.randint(-12,12) for _ in range(r.randint(2,18))],
    split_enc,split_oracle,
    '''def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; arr=a[1:1+n]; total=sum(arr); pref=0; ans=0
 for x in arr[:-1]:
  pref+=x
  if pref>total-pref: ans+=1
 return str(ans)''',
    [('错误地用大于等于', '''def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; arr=a[1:1+n]; total=sum(arr); p=0; z=0
 for x in arr[:-1]:
  p+=x; z+=p>=total-p
 return str(z)'''),
     ('只累计正数前缀', '''def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; arr=a[1:1+n]; total=sum(arr); p=0; z=0
 for x in arr[:-1]:
  p+=abs(x); z+=p>total-p
 return str(z)''')],
    '累计前缀和，并与总和减去前缀和比较。',
    '每个合法切分点 i 的左和恰为前 i 项前缀和，右和恰为 total-left；逐一检查所有 n−1 个切点，计数即为答案。',
    '时间 O(n)，空间 O(1)。','整数和使用任意精度；标准输入输出协议及 n 上界由本站明确补齐。')

def divisor_code(raw):
    vals=list(map(int,raw.split())); n=vals[0]; q=vals[1:1+n]; limit=int(max(q)**0.5); sieve=bytearray(b'\x01')*(limit+1)
    if limit>=0: sieve[0]=0
    if limit>=1: sieve[1]=0
    for p in range(2,int(limit**0.5)+1):
        if sieve[p]: sieve[p*p:limit+1:p]=b'\x00'*(((limit-p*p)//p)+1)
    ps=[i for i in range(2,limit+1) if sieve[i]]
    return '\n'.join(str(sum(p*p<=x for p in ps)) for x in q)
def divisor_oracle(q):
    import math
    return '\n'.join(str(sum(1 for k in range(2,math.isqrt(x)+1) if all(k%d for d in range(2,math.isqrt(k)+1)) and k*k<=x)) for x in q)
def divisor_enc(q): return f'{len(q)}\n'+'\n'.join(map(str,q))+'\n'
add('oa-maven-securities-2','恰有三个正因数的数',['数学','筛法'],
    '若一个正整数恰有 3 个正因数，它必为某个素数的平方。对每个给定上界 x，输出不大于 x 的此类数的个数。',
    '第一行 q（1 ≤ q ≤ 100000），随后 q 行各一个整数 x（1 ≤ x ≤ 25000000000000）。',
    '逐行输出 1 到 x（含端点）中恰有 3 个正因数的正整数个数。',
    [[10,15],[100],[4,9,49]],lambda r: [r.randint(1,5000) for _ in range(r.randint(1,8))],
    divisor_enc,divisor_oracle,
    '''def solve(raw):
 import math,bisect
 vals=list(map(int,raw.split())); q=vals[0]; xs=vals[1:1+q]; lim=math.isqrt(max(xs)); mark=bytearray(b'\\x01')*(lim+1)
 if lim>=0: mark[0]=0
 if lim>=1: mark[1]=0
 for p in range(2,int(lim**0.5)+1):
  if mark[p]: mark[p*p:lim+1:p]=b'\\x00'*(((lim-p*p)//p)+1)
 primes=[i for i in range(2,lim+1) if mark[i]]
 return '\\n'.join(str(bisect.bisect_right(primes,math.isqrt(x))) for x in xs)''',
    [('计数平方根以下的所有整数', '''def solve(raw):
 a=list(map(int,raw.split())); return '\\n'.join(str(int(int(x)**0.5)-1) for x in a[1:])'''),
     ('漏掉恰为素数平方的上界', '''def solve(raw):
 a=list(map(int,raw.split())); q=a[0]; xs=a[1:1+q]; lim=int(max(xs)**0.5); mark=[True]*(lim+1); mark[0]=False
 for p in range(2,int(lim**0.5)+1):
  if mark[p]:
   for j in range(p*p,lim+1,p): mark[j]=False
 pref=[]; c=0
 for i,v in enumerate(mark):
  if v and i*i<max(xs): c+=1
  pref.append(c)
 return '\\n'.join(str(pref[int(x**0.5)]) for x in xs)''')],
    '恰有 3 个因数的数等价于素数平方。对最大平方根范围筛出素数；每个查询用整数平方根与二分查找统计素数个数。',
    '若 n 的素因数分解指数形式只有一个质因子且指数为 2，则其因数个数为 3；因此且仅因此它是素数平方。筛出所有不超过 sqrt(max x) 的素数，前缀和给出每个 x 的答案。',
    '设 M=max(x)，时间 O(sqrt(M) log log M + q)，空间 O(sqrt(M))。')

def perm_code(raw):
    a=list(map(int,raw.split())); n=a[0]; p=[x-1 for x in a[1:1+n]]; seen=[False]*n; ans=1; mod=10**9+7
    import math
    for i in range(n):
        if not seen[i]:
            j=i; z=0
            while not seen[j]: seen[j]=True; z+=1; j=p[j]
            ans=math.lcm(ans,z)
    return str(ans%mod)
def perm_oracle(p):
    import math
    p=[x-1 for x in p]
    seen=set(); a=1
    for i in range(len(p)):
        if i not in seen:
            j=i; z=0
            while j not in seen: seen.add(j); z+=1; j=p[j]
            a=math.lcm(a,z)
    return str(a%(10**9+7))
def perm_enc(p): return f'{len(p)}\n'+' '.join(map(str,p))+'\n'
add('oa-wolverine-trading-1','置换操作次数',['置换','数学'],
    '给定 1..n 的一个置换 p。反复按新数组第 i 项取旧数组第 p[i] 项执行操作，求任意由互不相同元素组成的数组最少需要执行多少次才能恢复原样，答案对 10^9+7 取模。',
    '第一行 n（1 ≤ n ≤ 100000），第二行 p 的 n 个数，是 1..n 的置换。',
    '输出恢复原数组所需的最小正操作次数，结果对 1000000007 取模。',
    [[2,1,3],[2,3,1,4],[2,1,4,5,3]],lambda r: (lambda n:r.sample(range(1,n+1),n))(r.randint(1,16)),
    perm_enc,perm_oracle,
    '''def solve(raw):
 import math
 a=list(map(int,raw.split())); n=a[0]; p=[x-1 for x in a[1:1+n]]; seen=[0]*n; ans=1; mod=10**9+7
 for i in range(n):
  if not seen[i]:
   j=i; z=0
   while not seen[j]: seen[j]=1; z+=1; j=p[j]
   ans=ans//math.gcd(ans,z)*z
 return str(ans%mod)''',
    [('返回最短循环而非最小公倍数', '''def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; p=[x-1 for x in a[1:1+n]]; seen=[0]*n; ans=0
 for i in range(n):
  if not seen[i]:
   j=i; z=0
   while not seen[j]: seen[j]=1; z+=1; j=p[j]
   ans=max(ans,z)
 return str(ans)'''),
     ('只计算首个置换环长度', '''def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; p=[x-1 for x in a[1:1+n]]; seen=[0]*n; i=0; j=i; z=0
 while not seen[j]: seen[j]=1; z+=1; j=p[j]
 return str(z)''')],
    '将置换分解成不相交循环，答案是所有循环长度的最小公倍数。',
    '一个循环长度为 k 的元素经过 t 次操作回到原位当且仅当 k 整除 t。全数组同时恢复当且仅当每个循环长度都整除 t，因此最小正 t 是所有长度的最小公倍数。',
    '时间 O(n)，空间 O(n)。','约束完整；置换的排列方向虽不影响循环长度与答案。')

def mill_code(raw):
    a=list(map(int,raw.split())); n=a[0]; arr=a[1:1+n]; dp=[0]*(n+1)
    for i in range(n-1,-1,-1):
        dp[i]=dp[i+1]
        if i+1<n:
            gain=arr[i]-arr[i+1]
            if gain>0: dp[i]=max(dp[i],dp[i+2]+gain)
    return str(sum((i+1)*x for i,x in enumerate(arr))+dp[0])
def mill_oracle(arr):
    n=len(arr); best=-10**50
    def go(i,a):
        nonlocal best
        if i>=n: best=max(best,sum((k+1)*x for k,x in enumerate(a))); return
        go(i+1,a)
        if i+1<n:
            b=a[:]; b[i],b[i+1]=b[i+1],b[i]; go(i+2,b)
    go(0,arr); return str(best)
def mill_enc(a): return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
add('oa-millennium-3','相邻交换后的最大强度和',['动态规划','数组'],
    '给定正整数数组。可以选择若干互不相邻的下标对 (i,i+1) 并交换其中元素，也可以不交换。每个元素最多参与一次交换。下标从 0 开始，交换后数组强度为 Σ arr[i]×(i+1)。求最大强度。',
    '第一行 n（1 ≤ n ≤ 100000），第二行 n 个整数 arr[i]（1 ≤ arr[i] ≤ 100000）。',
    '输出可达到的最大强度和。',
    [[1,9,7,3,2],[3,2,1],[1]],lambda r: [r.randint(1,30) for _ in range(r.randint(1,14))],
    mill_enc,mill_oracle,
    '''def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; x=a[1:1+n]; dp=[0]*(n+1)
 for i in range(n-1,-1,-1):
  dp[i]=dp[i+1]
  if i+1<n: dp[i]=max(dp[i],dp[i+2]+max(0,x[i]-x[i+1]))
 return str(sum((i+1)*v for i,v in enumerate(x))+dp[0])''',
    [('允许相邻交换对重叠', '''def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; x=a[1:1+n]; ans=sum((i+1)*v for i,v in enumerate(x))
 return str(ans+sum(max(0,x[i]-x[i+1]) for i in range(n-1)))'''),
     ('交换收益方向写反', '''def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; x=a[1:1+n]; dp=[0]*(n+1)
 for i in range(n-1,-1,-1):
  dp[i]=dp[i+1]
  if i+1<n: dp[i]=max(dp[i],dp[i+2]+max(0,x[i+1]-x[i]))
 return str(sum((i+1)*v for i,v in enumerate(x))+dp[0])''')],
    '不交换贡献作为基线。交换 i 与 i+1 的增益为 arr[i]−arr[i+1]，用线性 DP 在相邻交换与跳过之间取最大。',
    '所有操作是互不相交的相邻边匹配。若交换 i,i+1，其对加权和的差为 (i+1)arr[i+1]+(i+2)arr[i]−(i+1)arr[i]−(i+2)arr[i+1]=arr[i]−arr[i+1]。对每个 i，最优选择要么跳过 i，要么选边 (i,i+1) 并跳过下一个边，递推覆盖所有合法方案。',
    '时间 O(n)，空间 O(n)。')

def stones_enc(a): return f'{len(a)}\n'+' '.join(map(str,a))+'\n'
def stones_oracle(a):
    h=sorted(a,reverse=True)
    while len(h)>1:
        x,y=h[:2]; h=h[2:]
        if x!=y: h.append(x-y); h.sort(reverse=True)
    return str(h[0] if h else 0)
add('oa-factset-2','最后一块石头的重量',['堆','模拟'],
    '每次取出最重的两块石头并相撞。若重量相等，两块都消失；否则较轻者消失，较重者剩下两者重量之差。重复直到剩余不超过一块，输出最后石头重量；没有石头则输出 0。',
    '第一行 n（1 ≤ n ≤ 100000），第二行 n 个正整数 weights[i]（1 ≤ weights[i] ≤ 10^9）。',
    '输出最后剩余石头的重量；若全部消失，输出 0。',
    [[1,2,3,6,7,7],[2],[5,5]],lambda r: [r.randint(1,40) for _ in range(r.randint(1,16))],
    stones_enc,stones_oracle,
    '''def solve(raw):
 import heapq
 a=list(map(int,raw.split())); n=a[0]; h=[-x for x in a[1:1+n]]; heapq.heapify(h)
 while len(h)>1:
  x=-heapq.heappop(h); y=-heapq.heappop(h)
  if x!=y: heapq.heappush(h,-(x-y))
 return str(-h[0] if h else 0)''',
    [('取最小的两块石头', '''def solve(raw):
 a=list(map(int,raw.split())); h=a[1:1+a[0]]
 while len(h)>1:
  h.sort(); x,y=h[:2]; h=h[2:]
  if x!=y: h.append(y-x)
 return str(h[0] if h else 0)'''),
     ('相等时错误地保留同重量石头', '''def solve(raw):
 import heapq
 a=list(map(int,raw.split())); h=[-x for x in a[1:1+a[0]]]; heapq.heapify(h)
 while len(h)>1:
  x=-heapq.heappop(h); y=-heapq.heappop(h)
  heapq.heappush(h,-(x-y if x!=y else x))
 return str(-h[0] if h else 0)''')],
    '用最大堆反复取出两块最重的石头；不相等时把差值放回堆中。',
    '堆顶始终是当前重量最大的石头，因此每轮恰好按题意选取。等重时不放回任何石头；不等重时只放回重量差。循环结束时堆中唯一元素（或空堆）就是要求的结果。',
    '时间 O(n log n)，空间 O(n)。','题目规则、样例和 n/重量约束完整。')

BLOCKED = {
 'oa-millennium-1':'Latch game 的原文没有形式化每个 core 的策略可见信息及双方效用下的平局决策，样例不足以固定博弈状态转移；不以“最优”一词臆造策略协议。',
 'oa-millennium-2':'示例只写“OA input”而未给出实际树边、根节点序列化或期望结果；无法验证距离定义（边权和）与节点值索引约定。',
 'oa-susquehanna-international-group-1':'题面明确让读者参照缺失的原始图片；数组更新语义虽能猜测，三元组是否按下标/值计数及重复值处理未由完整源题确定。',
 'oa-susquehanna-international-group-2':'核心条件在源文中截断，样例解释重复索引且没有给出真正的计数等式；输出 6 无法确定对应的配对谓词。',
 'oa-sig-4':'串接对的“different ways”虽说明按位置计数，但正整数是否允许前导零、accessCode 的表示形式及输入范围未规定；不能自行规定数值/字符串比较语义。',
 'oa-point72-1':'只说明寻找三元组和可被 d 整除，没有给出 arr 元素范围、数组长度上限或 d 范围；时间/数值协议无法按源题保证。',
 'oa-point72-2':'分配规则没有说明同一 userId 多笔 bid 应合并还是分别分配；返回“完全没拿到股份的用户”时这会改变答案。',
 'oa-square-point-1':'“select a book and remove all books ... in same row or column”没有说明一次选择是否必须移除所选书以外的书、空位表示及棋盘中类型上界 k 的作用；最小轮数的操作模型不足以复现。',
 'oa-maven-securities-3':'仅给 gcd 连通的直观定义，未给 serverProp 的数值上界；若值大，按质因数连边与全对 gcd 的可行算法资源差异显著，无法保证 OJ 时限。',
 'oa-wolverine-trading-2':'映射描述要求字符和编码以制表符分隔，但示例使用空格；[newline] 是否可作为一般字符、编码集合是否完整/前缀无歧义未由约束保证。',
 'oa-wolverine-trading-3':'源题约束位置只有“a yet-to-be-unearthed secret”；重复边/重复兴趣的计数方式与答案范围未定义，不能保证算法及整数类型。',
 'oa-morgan-stanley-1':'操作限制 bigHits 只给上界但未明确实际只能用至多 bigHits 次或必须用满；若所有 newtons 均为 1，大小锤分组输出还出现并列最优解，要求没有指定选哪组。',
 'oa-morgan-stanley-2':'例子对 patch 覆盖位置的解释存在越界/重叠歧义（例如 patch="ab"、designerWords="aab" 却称第二次放置起点 1）；“smallest permutation”比较对象及下标基准不清楚。',
 'oa-morgan-stanley-3':'返回 int，但 s2 长度可达 500000，三字符子序列数最高远超有符号 32 位；源题没有声明取模或更宽返回类型。',
 'oa-deutsche-bank-1':'要求子串 iff 标志位 T/F，但 S2 长度可大于 S1 时重叠窗口存在；例子只展示可解/不可解，未规定最小字母字符域（A..Z 还是任意字符）和输出格式转义。',
 'oa-deutsche-bank-2':'只给 x+y 最小化但没有约束 x、y 是否必须非负整数，且“multiple”是否允许商为 0 未说明；当前样例解释还把 10 说成 38 的倍数，算术错误。',
 'oa-barclays-1':'递推序列示例在 n=8 后的 13 → 12 等可解释为数字和，但没有 N 的取值上界；无法保证返回 int 不溢出或时间/递推边界。',
 'oa-barclays-2':'与另一家公司题完全重复，尚未核实两条上游是否应视为同一题还是分别保留；不重复发布题包。',
 'oa-barclay-1':'题面首句与操作定义被截断，输入只残留 R/A 和输出样例；无法确定每个 Ai 可修改的范围以及一次修改还是可分别改动。',
 'oa-barclay-2':'文字写每一步依次反转长度 2、3、4… 的子串，但未说明每种长度能否选多个位置、何时停止；样例长度 8 输出 7 不能确定计步约定。',
 'oa-bny-mellon-1':'样例明确标成 TODO，缺少任何期望答案；题目要做多步字符展开，而“每次 transformation”是否同步应用于本轮新字符没有通过可信输出校验。',
 'oa-bny-mellon-2':'源题数组约束句截断为“where 1A subsequence...”，缺少 arr[i] 的合法范围/数据域；公式会依赖每个值频次，无法确认边界与重复语义。',
 'oa-bny-mellon-3':'Digit Sum 段只给函数和区间，没有任何样例，且题干混用 coupon 数量 c、参与者 p 与整数区间；无法确认端点/“ways”是否为并列最大数位和的个数。',
 'oa-bnp-1':'虽规则清楚，但题面没有 binString 长度约束或输入协议；递归嵌套深度与是否只允许交换两个相邻 primitive good 子串的边界难以验证。',
 'oa-bnp-2':'“每一步可以从最大堆拿任意数量使其等于次高”与样例逐个处理堆的步数解释不一致；操作是否每个 pile 单独计一步未严格表述。',
 'oa-bnp-3':'罗马数字转换没有 numbers 的取值范围；标准表示在 3999 之后存在扩展写法差异，不能自行选择罗马数字体系。',
 'oa-factset-1':'输入解析段缺失矩阵列数/行数格式且源题称 square matrix；没有足够约束确认矩阵是否一定方阵及空行/维度协议。',
 'oa-factset-3':'描述说 index 为插入位置，但没有明确 index 是 0-based 还是 1-based；边界约束允许 0，仅凭不完整 I/O 段不能确认每步合法索引定义。'
}

def normalize(pkg):
    js = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    return subprocess.run(['node','--import','tsx','-e',js],cwd=ROOT,input=json.dumps(pkg,ensure_ascii=False),text=True,capture_output=True,check=True).stdout

def main():
    reviews=[]; entries=[]; valproblems=[]; sources={}
    rng=random.Random(20261006)
    for pid,s in SPECS.items():
        src=SRC[pid]; samples=s['examples']; values=samples+[s['random'](rng) for _ in range(117)]
        ref=py(s['code']); refpath=OUT/'references'/(pid+'.py'); refpath.write_text(ref)
        oracle=[]
        for v in values:
            data=s['encode'](v); expected=s['oracle'](v)
            actual=run(ref,data)
            if actual != expected: raise AssertionError((pid,v,expected,actual))
            oracle.append({'input':data,'expectedOutput':expected+'\n'})
        tests=oracle[:3]+oracle[3:27]
        cases=[]
        for i,c in enumerate(tests):
            cases.append({'name':f'公开样例 {i+1}' if i<3 else f'隐藏验证 {i-2}',**c,'hidden':i>=3,'weight':1})
        mutants=[]; kills=[]
        for k,(name,body) in enumerate(s['mutants'],1):
            code=py(body); control=OUT/'negative-controls'/f'{pid}-{k}.py'; control.write_text(code)
            rejected=[i for i,c in enumerate(cases) if run(code,c['input']) != c['expectedOutput'].rstrip('\n')]
            if not rejected: raise AssertionError((pid,'mutant survived',name))
            mutants.append({'name':name,'code':code}); kills.append({'name':name,'rejectedByCases':rejected})
        desc=s['desc']+'\n\n'+s['note']+'\n\n本站补充标准输入输出协议；不代表原站函数题原有该协议。'
        problem={'id':pid,'courseId':'gomall','lessonId':'00-overview','title':s['title'],'difficulty':'中等','tags':['OA',src['companyName']]+s['tags'],'description':desc,'input':s['inp'],'output':s['output'],'explanation':'题目规则、思路与证明见配套讲义。','hints':[s['idea']],'timeLimit':4,'memoryLimit':262144,'outputLimit':65536,'checker':'tokens','languages':['python','go','java','cpp']}
        pkg=json.loads(normalize({'schemaVersion':1,'problem':problem,'cases':cases}))
        editorial_text=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['complexity']}\n\n## 来源说明\n\n{s['note']}\n\n本站另行整理了标准输入输出协议；不声称原站提供该协议。"
        solutions=[{'language':'python','code':ref}]
        editorial={'schemaVersion':1,'id':pid,'title':s['title'],'explanation':editorial_text,'solutions':solutions,'sourceUrl':src['sourceUrl'],'sourceContentHash':src['contentHash'],'author':'Chunyu Sui'}
        normalized=json.dumps(pkg,ensure_ascii=False,separators=(',',':'))
        for folder,doc in [('packages',pkg),('editorials',editorial),('oracles',oracle),('mutants',mutants)]:
            (OUT/folder/(pid+'.json')).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append({'id':pid,'sourceContentHash':src['contentHash'],'packageChecksum':hashlib.sha256(normalized.encode()).hexdigest(),'editorial':editorial_text,'authoredSolutions':solutions})
        valproblems.append({'id':pid,'oracleCases':len(oracle),'publicCases':3,'hiddenCases':len(cases)-3,'negativeControls':kills,'referenceSha256':hashlib.sha256(ref.encode()).hexdigest()})
        reviews.append({'id':pid,'status':'authored','reason':'已核对不可变 OAMaster 题目快照，题意及边界足以建立确定的判题协议；已用独立小规模 oracle、样例和两个正常退出变异解核对。尚未运行 GoJudge。 '+s['note'],'sourceUrls':[src['sourceUrl']],'sourceContentHashes':[src['contentHash']],'catalogContentHash':src['contentHash']})
        sources[pid]={'url':src['sourceUrl'],'contentHash':src['contentHash'],'company':src['companyName'],'title':src['title']}
        print(f"{pid}: 120 independent oracle cases; {len(cases)} tests; all {len(kills)} mutants killed",flush=True)

    candidate_ids=set(SPECS)
    for pid in UNREVIEWED:
        if pid in candidate_ids: continue
        src=SRC[pid]; reason=BLOCKED.get(pid)
        if not reason: raise AssertionError('No individual review reason: '+pid)
        reviews.append({'id':pid,'status':'blocked','reason':reason,'sourceUrls':[src['sourceUrl']],'sourceContentHashes':[src['contentHash']],'catalogContentHash':src['contentHash']})
        sources[pid]={'url':src['sourceUrl'],'contentHash':src['contentHash'],'company':src['companyName'],'title':src['title'],'decision':'blocked','reason':reason}
    reviews.sort(key=lambda x:(x['id'].split('-')[1],int(x['id'].rsplit('-',1)[1])))
    docs={
      'candidate-batches/trading-firms-remaining.json':{'schemaVersion':1,'items':entries},
      'reviews/trading-firms-remaining.json':{'schemaVersion':1,'items':reviews},
      'source-evidence/trading-firms-remaining.json':{'schemaVersion':1,'upstreamRepository':CAT['source']['repository'],'upstreamCommit':CAT['source']['commit'],'origin':CAT['source']['origin'],'items':sources,'note':'题目指纹取自仓库中不可变 OAMaster catalog 快照；仅 authored 项生成候选包，blocked 项不发布。'},
      'validation/trading-firms-remaining.json':{'schemaVersion':1,'seed':20261006,'problems':valproblems,'note':'仅本地独立参考解/oracle/变异解验证；未运行 GoJudge，未发布正式题库。'}
    }
    for rel,doc in docs.items():
        (OUT/rel).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    print(f"Reviewed {len(UNREVIEWED)} still-unreviewed items; {len(entries)} candidates, {len(reviews)-len(entries)} individually blocked.")

if __name__=='__main__': main()
