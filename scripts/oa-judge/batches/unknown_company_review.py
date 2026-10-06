"""Author clear unknown-company OA problems without inventing source attribution.

The site labels these source entries as Unknown. The input/output contracts below
are explicitly supplemented by CSWork; imported solutions are never executed.
"""
from collections import Counter
from pathlib import Path
import hashlib
import itertools
import json
import math
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SEED = 20261006
MOD = 1_000_000_007


def run(code_path, data):
    p = subprocess.run([sys.executable, "-I", str(code_path)], input=data,
                       text=True, capture_output=True, timeout=8, check=True)
    return p.stdout.rstrip("\n")


def tree_encode(v):
    k, n, edges = v
    return f"{k} {n}\n" + "".join(f"{a+1} {b+1}\n" for a, b in edges)


def tree_oracle(v):
    k, n, edges = v
    graph = [[] for _ in range(n)]
    for a, b in edges:
        graph[a].append(b); graph[b].append(a)
    color = [-1] * n
    def visit(i):
        if i == n:
            return 1
        total = 0
        for c in range(k):
            if any(color[j] == c for j in graph[i]):
                continue
            if any(color[j] == c for x in graph[i] for j in graph[x] if j != i):
                continue
            color[i] = c
            total += visit(i + 1)
            color[i] = -1
        return total
    return str(visit(0) % MOD)


def tree_random(rng):
    n = rng.randint(1, 7)
    edges = [(i, rng.randrange(i)) for i in range(1, n)]
    return rng.randint(1, 5), n, edges


def tree_reference():
    return '''import sys
MOD=1000000007
def solve(raw):
 d=list(map(int,raw.split()));k,n=d[:2];edges=list(zip(d[2::2],d[3::2]));g=[[] for _ in range(n)]
 for a,b in edges:a-=1;b-=1;g[a].append(b);g[b].append(a)
 ans=k%MOD
 for v in range(n):
  available=k-(1 if v==0 else 2);children=len(g[v]) if v==0 else len(g[v])-1;children=max(0,children)
  if available<children:return '0'
  for j in range(children):ans=ans*(available-j)%MOD
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''


def logs_encode(v):
    n, logs = v
    return f"{n} {len(logs)}\n" + "\n".join(logs) + "\n"


def logs_oracle(v):
    n, logs = v
    result = [0] * n
    stack = []
    previous = 0
    for line in logs:
        fid, kind, stamp = line.split(":")
        fid, stamp = int(fid), int(stamp)
        if stack:
            result[stack[-1]] += stamp - previous
        if kind == "start":
            stack.append(fid)
            previous = stamp
        else:
            result[fid] += 1
            stack.pop()
            previous = stamp + 1
    return " ".join(map(str, result))


def logs_random(rng):
    n = rng.randint(1, 5)
    events, stack, t, starts = [], [], rng.randint(0, 2), 0
    while starts < rng.randint(2, 8) or stack:
        if stack and (starts >= 8 or rng.random() < 0.42):
            fid = stack.pop()
            t += rng.randint(1, 4)
            events.append(f"{fid}:end:{t}")
        else:
            fid = rng.randrange(n)
            events.append(f"{fid}:start:{t}")
            stack.append(fid); starts += 1
        t += 1
    return n, events


def logs_reference():
    return '''import sys
def solve(raw):
 lines=raw.splitlines();n,m=map(int,lines[0].split());ans=[0]*n;stack=[];prev=0
 for line in lines[1:1+m]:
  fid,kind,t=line.split(':');fid=int(fid);t=int(t)
  if stack:ans[stack[-1]]+=t-prev
  if kind=='start':stack.append(fid);prev=t
  else:ans[fid]+=1;stack.pop();prev=t+1
 return ' '.join(map(str,ans))
if __name__=='__main__': print(solve(sys.stdin.read()))
'''


def messages_encode(v):
    return str(len(v)) + "\n" + "\n".join(v) + "\n"


def messages_oracle(v):
    indexed = list(enumerate(v))
    indexed.sort(key=lambda x: (int(x[1].split(":")[1]), int(x[1].split(":")[0]), x[0]))
    return "\n".join(message for _, message in indexed)


def messages_random(rng):
    n = rng.randint(1, 20)
    return [f"{rng.randrange(10000):04d}:{rng.randint(1,5)}" for _ in range(n)]


def messages_reference():
    return '''import sys
def solve(raw):
 lines=raw.splitlines();n=int(lines[0]);a=lines[1:1+n]
 a.sort(key=lambda s:(int(s.split(':')[1]),int(s.split(':')[0])))
 return '\\n'.join(a)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''


def numbers_encode(v):
    return str(len(v)) + "\n" + " ".join(map(str, v)) + "\n"


def even_oracle(v):
    return str(sum(x % 2 == 0 for x in v))


def even_random(rng):
    return [rng.randint(-100000, 100000) for _ in range(rng.randint(0, 80))]


def even_reference():
    return '''import sys
def solve(raw):
 d=list(map(int,raw.split()));n=d[0];return str(sum(x%2==0 for x in d[1:1+n]))
if __name__=='__main__': print(solve(sys.stdin.read()))
'''


def gap_oracle(v):
    return str(max((abs(v[i] - v[i - 1]) for i in range(1, len(v))), default=0))


def gap_random(rng):
    return [rng.randint(-100000, 100000) for _ in range(rng.randint(1, 80))]


def gap_reference():
    return '''import sys
def solve(raw):
 d=list(map(int,raw.split()));n=d[0];a=d[1:1+n];return str(max((abs(a[i]-a[i-1]) for i in range(1,n)),default=0))
if __name__=='__main__': print(solve(sys.stdin.read()))
'''


def chocolate_encode(v):
    return f"{v[0]} {v[1]}\n"


def chocolate_brute(v):
    a, b = v
    best = b + 10**9
    for k in range(1, b + 1):
        x = max(0, (b + k - 1) // k - a)
        best = min(best, x + k * (a + x) - b)
    return str(best)


def chocolate_fast(v):
    a, b = v
    root = math.isqrt(b) + 2
    best = 10**30
    def use(k):
        nonlocal best
        x = max(0, (b + k - 1) // k - a)
        best = min(best, x + k * (a + x) - b)
    for k in range(1, min(b, root) + 1):
        use(k)
    for q in range(1, root + 1):
        use((b + q - 1) // q)
    use(max(1, (b + a - 1) // a))
    return str(best)


def chocolate_oracle(v):
    return chocolate_brute(v) if v[1] <= 500 else chocolate_fast(v)


def chocolate_random(rng):
    return rng.randint(1, 120), rng.randint(1, 120)


def chocolate_reference():
    return '''import sys,math
def solve(raw):
 a,b=map(int,raw.split());r=math.isqrt(b)+2;best=10**30
 def test(k):
  nonlocal best
  x=max(0,(b+k-1)//k-a);best=min(best,x+k*(a+x)-b)
 for k in range(1,min(b,r)+1):test(k)
 for q in range(1,r+1):test((b+q-1)//q)
 test(max(1,(b+a-1)//a))
 return str(best)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''


def string_pair_encode(v):
    return f"{v[0]}\n{v[1]}\n"


def jaccard_oracle(v):
    a, b = v
    ca, cb = Counter(a), Counter(b)
    common = sum(min(ca[c], cb[c]) for c in ca.keys() | cb.keys())
    union = sum(max(ca[c], cb[c]) for c in ca.keys() | cb.keys())
    return f"{common / union:.12f}"


def jaccard_random(rng):
    alphabet = "abcd"
    return ("".join(rng.choice(alphabet) for _ in range(rng.randint(1, 12))),
            "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 12))))


def jaccard_reference():
    return '''import sys
def solve(raw):
 a,b=raw.splitlines()[:2];ca={};cb={}
 for c in a:ca[c]=ca.get(c,0)+1
 for c in b:cb[c]=cb.get(c,0)+1
 keys=ca.keys()|cb.keys();u=sum(max(ca.get(c,0),cb.get(c,0)) for c in keys)
 i=sum(min(ca.get(c,0),cb.get(c,0)) for c in keys)
 return f'{i/u:.12f}'
if __name__=='__main__': print(solve(sys.stdin.read()))
'''


def unique_encode(v):
    return str(len(v)) + "\n" + "\n".join(v) + "\n"


def unique_oracle(v):
    proportions = [max(Counter(s).values()) / len(s) for s in v]
    smallest = min(proportions)
    chosen = {i for i, p in enumerate(proportions) if p == smallest}
    outside = set().union(*(set(s) for i, s in enumerate(v) if i not in chosen))
    return "".join(c for i, s in enumerate(v) if i in chosen for c in s if c not in outside)


def unique_random(rng):
    alphabet = "abcd"
    return ["".join(rng.choice(alphabet) for _ in range(rng.randint(1, 12)))
            for _ in range(rng.randint(1, 12))]


def unique_reference():
    return '''import sys
from collections import Counter
def solve(raw):
 lines=raw.splitlines();n=int(lines[0]);a=lines[1:1+n]
 p=[max(Counter(s).values())/len(s) for s in a];best=min(p);chosen=[i for i,x in enumerate(p) if x==best]
 other=set(c for i,s in enumerate(a) if i not in chosen for c in s)
 return ''.join(c for i in chosen for c in a[i] if c not in other)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''


SPECS = [
    {"id":"oa-unknown-1","title":"Build Monuments","checker":"tokens","encode":tree_encode,"oracle":tree_oracle,"random":tree_random,"reference":tree_reference(),"samples":[(3,3,[(0,1),(1,2)]),(2,1,[]),(4,4,[(0,1),(0,2),(0,3)])],"mutants":[("忽略距离为2的冲突",'''import sys\ndef solve(raw):\n d=list(map(int,raw.split()));k,n=d[:2];g=[[] for _ in range(n)]\n for a,b in zip(d[2::2],d[3::2]):g[a-1].append(b-1);g[b-1].append(a-1)\n ans=k\n for v in g:ans=ans*max(0,k-1)%1000000007\n return str(ans)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n'''),("所有城市都使用相同类型",'''import sys\ndef solve(raw): return str(int(raw.split()[0])%1000000007)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n''')],"input":"第一行 k n（1≤k≤10^9，1≤n≤10^5）；接下来 n−1 行为一条无向边 u v，城市编号 1..n。输入保证构成树。","output":"输出满足任意距离不超过 2 的城市类型均不同的方案数，模 1,000,000,007。本站补充该标准输入协议和约束。","description":"给树的每个节点分配 k 种类型之一，直接相连或共享邻居的城市不能同型。公司来源在 OAMaster 中标为 Unknown；本站补充输入协议与约束。","tags":["图论","树","组合计数"],"difficulty":"困难","editorial":"树的平方图可按根到叶顺序计数。根有 k 种选择，其子节点必须互不相同且避开根；其他节点的孩子还需避开父节点。每层的可选数形成下降阶乘，乘法取模。独立 oracle 在小树上穷举所有着色并逐条检查距离 1/2 冲突。","hints":["以 1 号城市为根；同一节点的孩子之间也相距 2。"]},
    {"id":"oa-unknown-5","title":"Exclusive Time of Functions","checker":"tokens","encode":logs_encode,"oracle":logs_oracle,"random":logs_random,"reference":logs_reference(),"samples":[(2,["0:start:0","1:start:2","1:end:5","0:end:6"]),(1,["0:start:0","0:start:2","0:end:5","0:start:6","0:end:6","0:end:7"]),(2,["0:start:0","0:start:2","0:end:5","1:start:6","1:end:6","0:end:7"])],"mutants":[("父函数错误计入子函数时长",'''import sys\ndef solve(raw):\n l=raw.splitlines();n,m=map(int,l[0].split());ans=[0]*n;st=[];p=0\n for x in l[1:]:\n  i,k,t=x.split(':');i=int(i);t=int(t)\n  if k=='start':st.append((i,t))\n  else:\n   j,s=st.pop();ans[j]+=t-s+1\n   if st:st[-1]=(st[-1][0],t+1)\n return ' '.join(map(str,ans))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n'''),("结束事件未按闭区间计时",'''import sys\ndef solve(raw):\n l=raw.splitlines();n,m=map(int,l[0].split());ans=[0]*n;st=[];p=0\n for x in l[1:]:\n  i,k,t=x.split(':');i=int(i);t=int(t)\n  if st:ans[st[-1]]+=t-p\n  if k=='start':st.append(i);p=t\n  else:st.pop();p=t\n return ' '.join(map(str,ans))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n''')],"input":"第一行函数数 n 与日志数 m；随后 m 行为 `id:start:timestamp` 或 `id:end:timestamp`。本站限制 1≤n≤100、0≤timestamp≤10^9；日志合法且按时间顺序给出。","output":"输出 n 个整数，第 i 项为函数 i 的独占执行时间，空格分隔。","description":"计算单线程调用栈中各函数的独占运行时间。该题源明确指向 LC636，本站补充标准日志输入协议与约束。","tags":["栈","模拟"],"difficulty":"中等","editorial":"维护调用栈和上一个尚未计入的时间点。新日志到来时，先把两时间点间隔加给栈顶；start 将函数压栈，end 事件还要计入该时间戳本身，再弹栈。","hints":["end 时间戳是闭区间；start 时间戳从该刻开始执行。"]},
    {"id":"oa-unknown-8","title":"Process Messages","checker":"exact","encode":messages_encode,"oracle":messages_oracle,"random":messages_random,"reference":messages_reference(),"samples":[["1045:2","0100:1","0100:2"],["0000:5","9999:1","0001:1"],["1200:3","1200:3","0000:3"]],"mutants":[("优先级顺序颠倒",'''import sys\ndef solve(raw):\n l=raw.splitlines();a=l[1:1+int(l[0])];a.sort(key=lambda s:(-int(s.split(':')[1]),int(s.split(':')[0])));return '\\n'.join(a)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n'''),("按时间而非优先级排序",'''import sys\ndef solve(raw):\n l=raw.splitlines();a=l[1:1+int(l[0])];a.sort(key=lambda s:(int(s.split(':')[0]),int(s.split(':')[1])));return '\\n'.join(a)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n''')],"input":"第一行 n（1≤n≤10^5），随后 n 行 `timestamp:priority`。timestamp 为 0000..9999，priority 为 1..5。","output":"按优先级数字升序（1 最高），再按 timestamp 数值升序排列，每行原样输出一条消息。完全相同键按输入顺序稳定排列。","description":"按优先级和时间先后处理消息。题源未给示例；本站明确同键使用稳定排序，并补充标准输入协议。","tags":["排序","字符串"],"difficulty":"简单","editorial":"按照 `(priority, timestamp, originalIndex)` 升序排序。时间戳先转整数比较，因此前导零只影响回显，不影响先后；完全相同键保持输入顺序。","hints":["priority 越小越先处理；保存原始字符串用于输出。"]},
    {"id":"oa-unknown-9","title":"Count Even Numbers","checker":"tokens","encode":numbers_encode,"oracle":even_oracle,"random":even_random,"reference":even_reference(),"samples":[[1,2,4,7,10],[],[-3,-2,0,5,8]],"mutants":[("统计奇数个数",'''import sys\ndef solve(raw):\n d=list(map(int,raw.split()));n=d[0];return str(sum(x%2!=0 for x in d[1:1+n]))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n'''),("忽略负偶数",'''import sys\ndef solve(raw):\n d=list(map(int,raw.split()));n=d[0];return str(sum(x>=0 and x%2==0 for x in d[1:1+n]))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n''')],"input":"第一行 n（0≤n≤1000），第二行 n 个整数，范围 −100000..100000。","output":"输出数组中偶数的个数。","description":"统计整数数组里的偶数。虽然源句被截断，约束和三个示例完整确定了负数、0 和空数组的处理。","tags":["数组","计数"],"difficulty":"简单","editorial":"遍历数组，对每个元素判断 `x % 2 == 0` 并累加。Python 对负偶数同样满足该判断，0 也计为偶数。","hints":["注意空数组和负数。"]},
    {"id":"oa-unknown-10","title":"Maximum Adjacent Gap","checker":"tokens","encode":numbers_encode,"oracle":gap_oracle,"random":gap_random,"reference":gap_reference(),"samples":[[3,8,2,10],[7],[-4,-10,6,1]],"mutants":[("先排序再求相邻差",'''import sys\ndef solve(raw):\n d=list(map(int,raw.split()));a=sorted(d[1:1+d[0]]);return str(max((a[i]-a[i-1] for i in range(1,len(a))),default=0))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n'''),("只计算有符号差的最大值",'''import sys\ndef solve(raw):\n d=list(map(int,raw.split()));a=d[1:1+d[0]];return str(max((a[i]-a[i-1] for i in range(1,len(a))),default=0))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n''')],"input":"第一行 n（1≤n≤1000），第二行 n 个整数，范围 −100000..100000。","output":"输出原数组中相邻元素差的最大绝对值；单元素数组输出 0。","description":"求输入顺序下相邻元素差的最大绝对值。题源示例和约束明确，本站补充标准输入协议。","tags":["数组","扫描"],"difficulty":"简单","editorial":"只需扫描相邻位置，维护 `abs(nums[i]-nums[i-1])` 的最大值。不能先排序，因为那会改变题面给定的相邻关系。","hints":["保留原数组次序。"]},
    {"id":"oa-unknown-14","title":"Minimum Extra Chocolates","checker":"tokens","encode":chocolate_encode,"oracle":chocolate_oracle,"random":chocolate_random,"reference":chocolate_reference(),"samples":[(8,16),(7,37),(70,229)],"mutants":[("只尝试 k=1",'''import sys\ndef solve(raw):\n a,b=map(int,raw.split());return str(max(0,a-b))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n'''),("只允许给 Drake 加巧克力",'''import sys\ndef solve(raw):\n a,b=map(int,raw.split());return str((-b)%(a))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n''')],"input":"一行两个正整数 A、B（1≤A,B≤10^9）。","output":"输出最小的非负整数 X+Y，使存在正整数 k 满足 k(A+X)=B+Y。","description":"分别给两盒增加非负数量巧克力，使 Drake 的总数成为 Alex 总数的正整数倍，求最少增加总数。本站明确 `k≥1`、`X,Y≥0` 和范围。","tags":["数学","数论","枚举优化"],"difficulty":"中等","editorial":"固定 k 时，令 x=max(0, ceil(B/k)-A)，这是使 k(A+x) 不小于 B 的最小非负 x；随后 y=k(A+x)-B，代价为 x+y。对 k≤√B 逐个检查；对更大的 k，ceil(B/k)≤√B，可按该商枚举区间的首个 k；另检查 ceil(B/A) 的零 x 分支。总体 O(√B)。随机小值使用枚举全部 k 的独立 oracle。","hints":["固定倍数 k 后，最优 X 只需让目标总数达到 B。","利用 ceil(B/k) 的商区间合并大 k。"]},
    {"id":"oa-unknown-16","title":"Multiset Jaccard Similarity","checker":"float","encode":string_pair_encode,"oracle":jaccard_oracle,"random":jaccard_random,"reference":jaccard_reference(),"samples":[("baa","abbc"),("abc","xyz"),("aaaa","aa")],"mutants":[("忽略重复字符",'''import sys\ndef solve(raw):\n a,b=raw.splitlines()[:2];u=set(a)|set(b);return str(len(set(a)&set(b))/len(u))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n'''),("误用较短长度比",'''import sys\ndef solve(raw):\n a,b=raw.splitlines()[:2];return str(min(len(a),len(b))/max(len(a),len(b)))\nif __name__=='__main__':print(solve(sys.stdin.read()))\n''')],"input":"两行非空字符串，仅含小写英文字母，每串长度 1..10^5。","output":"输出多重集 Jaccard 相似度：Σmin(countA[c],countB[c]) / Σmax(countA[c],countB[c])，误差不超过 1e−6。","description":"计算字符多重集的 Jaccard 相似度。题源例子说明重复字符计入并给出 0.4；本站补充非空字符串和标准输入协议。","tags":["字符串","计数","数学"],"difficulty":"简单","editorial":"统计两串各字符频次。交集大小为频次逐字符取 min 后求和，并集大小为取 max 后求和，答案为两者之比。","hints":["这是多重集，不是去重后的字符集合。"]},
    {"id":"oa-unknown-17","title":"Most Unique Elements","checker":"exact","encode":unique_encode,"oracle":unique_oracle,"random":unique_random,"reference":unique_reference(),"samples":[["aba","ab","abbcdd"],["aab","cc","bbd"],["abca","de"]],"mutants":[("改为选最高比例字符串",'''import sys\nfrom collections import Counter\ndef solve(raw):\n l=raw.splitlines();a=l[1:1+int(l[0])];p=[max(Counter(s).values())/len(s) for s in a];b=max(p);idx=[i for i,x in enumerate(p) if x==b];o=set(c for i,s in enumerate(a) if i not in idx for c in s);return ''.join(c for i in idx for c in a[i] if c not in o)\nif __name__=='__main__':print(solve(sys.stdin.read()))\n'''),("保留未选字符串也含有的字符",'''import sys\nfrom collections import Counter\ndef solve(raw):\n l=raw.splitlines();a=l[1:1+int(l[0])];p=[max(Counter(s).values())/len(s) for s in a];b=min(p);idx=[i for i,x in enumerate(p) if x==b];return ''.join(c for i in idx for c in a[i])\nif __name__=='__main__':print(solve(sys.stdin.read()))\n''')],"input":"第一行 n（1≤n≤1000），随后 n 行非空字符串，仅含小写英文字母，每串长度 1..1000。","output":"先选择最常见字符占比最小的所有字符串；输出这些字符串中、未出现在任何未选字符串里的字符，按选中字符串的原输入顺序及字符串内顺序保留重复字符。","description":"按字符串内最高字符频次占比选出最不集中的字符串，再保留只出现在选中集合中的字符。题源唯一示例可确定返回规则；本站补充输入协议。","tags":["字符串","计数"],"difficulty":"中等","editorial":"对每个字符串计算 max(freq)/length，找最小比例并保留所有并列项。把未选字符串的字符合并成集合，再按选中字符串原顺序输出不在该集合中的字符，重复出现仍保留。","hints":["比例比较可用整数交叉相乘；并列项都要保留。"]},
]


BLOCKED = {
    "oa-unknown-2":"token 恰在过期时间戳时是否仍有效、重置边界是否含等号均未给例子或明确约定；边界会改变正确输出。",
    "oa-unknown-3":"题面将 n 同时用作客户数和待选产品数，写成选择 n−2 个产品；约束和变量维度/目标之间存在冲突，无法确定完整契约。",
    "oa-unknown-4":"源题输出明确标注为占位值 `[-0,-0,-0]`，关键骰子规则和真实期望结果缺失。",
    "oa-unknown-6":"样例与定义矛盾：threshold=4 时 1×1 最大和为 4 却输出 0；threshold=14 时 2×2 最大和为 14 却输出 1，无法判定比较边界/目标。",
    "oa-unknown-7":"题面约束仍是 `TO-DO` 且操作的结束/收件规则不完整；单个示例不足以唯一确定所有合法转移。",
    "oa-unknown-11":"HTML 清理已截断核心返回类型与数值约束；虽然标题和两例像 Two Sum，但无法确认完整边界及重复解约定。",
    "oa-unknown-12":"服务器分簇操作没有完整说明每组/不同组容量约束；示例 2 的给定变换也无法由题面目标唯一推导最少步数。",
    "oa-unknown-13":"“最少路线”没有定义路线覆盖能力、允许连接的点或距离/成本；示例只能说明 3 个点输出 3。",
    "oa-unknown-15":"Part 2 依赖未随题面提供的 Part 1 完整规则，且 `jaccard` 的多重集含义要到 Part 3 才补充；本题自身样例为占位说明。",
}


def main():
    for folder in ("packages","editorials","references","oracles","mutants","negative-controls","reviews","candidate-batches","validation","source-evidence"):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    manifest=[]; validations=[]; reviews=[]; evidence=[]
    authored={s["id"] for s in SPECS}
    for number in range(1,18):
        pid=f"oa-unknown-{number}"; source=SOURCES[pid]
        status="authored" if pid in authored else "blocked" if pid in BLOCKED else "unreviewed"
        item={"id":pid,"path":"content/oa-master/catalog.json#items/"+pid,
              "catalogContentHash":source["contentHash"],"sourceUrl":source["sourceUrl"],
              "status":status,"reason":BLOCKED.get(pid,"候选题包由独立程序和 oracle 验证。" if status=="authored" else "未完成评估；保留未审阅状态。")}
        evidence.append(item)
    for spec in SPECS:
        pid=spec["id"]; source=SOURCES[pid]; code=spec["reference"]
        ref=OUT/"references"/f"{pid}.py";ref.write_text(code)
        rng=random.Random(SEED+int(pid.rsplit("-",1)[1])); values=list(spec["samples"]);seen=set()
        for value in values: seen.add(spec["encode"](value))
        while len(values)<120:
            value=spec["random"](rng); encoded=spec["encode"](value)
            if encoded in seen: continue
            seen.add(encoded);values.append(value)
        oracle_cases=[]
        for value in values:
            data=spec["encode"](value); expected=spec["oracle"](value)
            actual=run(ref,data)
            if spec["checker"]=="float": assert abs(float(actual)-float(expected))<=1e-7,(pid,value,expected,actual)
            else: assert actual==expected,(pid,value,expected,actual)
            oracle_cases.append({"input":data,"expectedOutput":expected+"\n"})
        formal=[{"name":f"公开样例 {i+1}",**oracle_cases[i],"hidden":False,"weight":1} for i in range(3)]
        formal.extend({"name":f"隐藏测试 {i+1}",**oracle_cases[i+3],"hidden":True,"weight":1} for i in range(27))
        mutants=[];negative=[]
        for i,(name,mutant_code) in enumerate(spec["mutants"],1):
            control=OUT/"negative-controls"/f"{pid}-{i}.py";control.write_text(mutant_code);killed=[]
            for case_index,case in enumerate(formal):
                output=run(control,case["input"])
                ok=(abs(float(output)-float(case["expectedOutput"]))<=1e-7 if spec["checker"]=="float" else output==case["expectedOutput"].rstrip("\n"))
                if not ok:killed.append(case_index)
            assert killed,(pid,"surviving mutant",name)
            mutants.append({"name":name,"code":mutant_code});negative.append({"name":name,"rejectedByCases":killed})
        problem={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":spec["difficulty"],
                 "tags":["OA","公司未知"]+spec["tags"],"description":spec["description"]+"\n\n公司来源仍为 Unknown；本站补充的输入协议不代表 OAMaster 原题的 I/O。",
                 "input":spec["input"],"output":spec["output"],"explanation":"详见配套讲义。","hints":spec["hints"],
                 "timeLimit":3,"memoryLimit":262144,"outputLimit":65536,"checker":spec["checker"],"languages":["python","go","java","cpp"]}
        raw={"schemaVersion":1,"problem":problem,"cases":formal}
        js="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
        p=subprocess.run(["node","--import","tsx","-e",js],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True)
        if p.returncode: raise RuntimeError(p.stderr)
        normalized=p.stdout; package=json.loads(normalized)
        editorial={"schemaVersion":1,"id":pid,"title":spec["title"],"explanation":spec["editorial"],"solutions":[{"language":"python","code":code}],"sourceUrl":source["sourceUrl"],"sourceContentHash":source["contentHash"],"author":"CSWork"}
        for folder,doc in (("packages",package),("oracles",oracle_cases),("mutants",mutants),("editorials",editorial)):
            (OUT/folder/f"{pid}.json").write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n")
        manifest.append({"id":pid,"sourceContentHash":source["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":spec["editorial"],"authoredSolutions":[{"language":"python","code":code}]})
        validations.append({"id":pid,"oracleCases":len(oracle_cases),"uniqueOracleInputs":len(seen),"referenceCliCases":len(formal),"referenceSha256":hashlib.sha256(code.encode()).hexdigest(),"publicCases":3,"hiddenCases":27,"negativeControls":negative})
        reviews.append({"id":pid,"status":"authored","reason":"已核对固定源快照；把本站补充的输入格式/约束写入题面，120 个独立输入与两个正常退出 mutant 均通过离线验证。公司未标注，页面如实保留 Unknown。","sourceUrls":[source["sourceUrl"]],"sourceContentHashes":[source["contentHash"]],"sourceCommit":CATALOG["source"]["commit"],"catalogContentHash":source["contentHash"]})
        print(f"{pid}: 120 oracle inputs; 30 formal cases; 2 mutants rejected",flush=True)
    for pid,reason in BLOCKED.items():reviews.append({"id":pid,"status":"blocked","reason":reason})
    reviews.sort(key=lambda x:int(x["id"].rsplit("-",1)[1]));evidence.sort(key=lambda x:int(x["id"].rsplit("-",1)[1]))
    batch="unknown-company-review"
    (OUT/"candidate-batches"/f"{batch}.json").write_text(json.dumps({"schemaVersion":1,"items":manifest},ensure_ascii=False,indent=2)+"\n")
    (OUT/"reviews"/f"{batch}.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
    (OUT/"source-evidence"/f"{batch}.json").write_text(json.dumps({"schemaVersion":1,"repository":CATALOG["source"]["repository"],"commit":CATALOG["source"]["commit"],"note":"Company attribution is Unknown in the upstream catalog; evidence binds each decision to the immutable imported statement URL and content hash. Imported source solutions were not executed.","items":evidence},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation"/f"{batch}.json").write_text(json.dumps({"schemaVersion":1,"seed":SEED,"problems":validations,"note":"Offline local reference/oracle/mutant validation only; no GoJudge sandbox report."},ensure_ascii=False,indent=2)+"\n")


if __name__=="__main__":main()
