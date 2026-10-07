"""Author offline-validated Akuna Capital and Rubrik OA problems.

This script only writes authored content, candidate manifests, reviews, and
local validation records. It never promotes questions to the runtime registry
or invokes the production GoJudge service.
"""
from collections import Counter, deque
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
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SPECS = []


def add(**spec):
    SPECS.append(spec)


def vector_encode(values):
    return f"{len(values)}\n" + " ".join(map(str, values)) + "\n"


def vector_sort_oracle(values):
    counts = Counter(values)
    out = []
    for frequency, value in sorted((frequency, value) for value, frequency in counts.items()):
        out.extend([value] * frequency)
    return " ".join(map(str, out))


def vector_sort_random(rng):
    return [rng.randint(1, 10) for _ in range(rng.randint(1, 18))]


add(
    id="oa-akuna-capital-18", title="Items Sort", company="Akuna Capital",
    source_ids=["oa-akuna-capital-18"], raw_path="fastprep/Akuna Capital/akuna-items-sort.md",
    raw_blob="5512d58fbcccf3e7076a3dc283ac7c0d6e89fb9a",
    tags=["数组","排序","频次统计"],
    encode=vector_encode, oracle=vector_sort_oracle, random=vector_sort_random,
    samples=[[4, 5, 6, 5, 4, 3], [9], [4, 4, 4, 2, 2, 3]],
    edges=[([1, 1, 2, 2, 3, 3], None), ([10**6] * 100000 + [1] * 100000, None)],
    desc="按每个数值在整个数组中的出现频次升序排列；频次相同时按数值升序。相同数值保留原有出现次数。",
    input="第一行 n；第二行 n 个整数 items[i]。本站遵循原题约束：1≤n≤200000，1≤items[i]≤1000000。",
    output="一行输出排序后的 n 个整数，以空格分隔。",
    output_limit=4*1024,
    idea="先统计每个值的频次，再按 (频次, 数值) 排序所有原数组元素。",
    proof="比较键对每个元素唯一确定其全序。按该键排序后，所有元素仍各出现一次，频次较小的值整体在前，同频值按数值升序，因此恰好满足题目排序规则。",
    complexity="n 为数组长度、u 为不同值数量。时间 O(n log n)，空间 O(u)。",
    code='''from collections import Counter
import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
    count=Counter(a)
    a.sort(key=lambda x:(count[x],x))
    return " ".join(map(str,a))
''',
    mutants=[
        ("频次改为降序", '''from collections import Counter
import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]; c=Counter(a)
    a.sort(key=lambda x:(-c[x],x))
    return " ".join(map(str,a))
'''),
        ("同频数值改为降序", '''from collections import Counter
import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]; c=Counter(a)
    a.sort(key=lambda x:(c[x],-x))
    return " ".join(map(str,a))
'''),
    ],
    raw_source_note="原始 FastPrep Markdown，约束完整；catalog 把两个相邻 HTML 项压成了 `2 x 10⁵¹ ≤ ...`，以此原始快照为准。",
)


def disjoint_encode(values):
    return vector_encode(values)


def max_subarray(values):
    best = current = values[0]
    for value in values[1:]:
        current = max(value, current + value)
        best = max(best, current)
    return best


def disjoint_oracle(values):
    best = None
    for split in range(1, len(values)):
        left = max_subarray(values[:split])
        right = max_subarray(values[split:])
        score = left + right
        best = score if best is None else max(best, score)
    return str(best)


def disjoint_random(rng):
    return [rng.randint(-12, 12) for _ in range(rng.randint(2, 10))]


add(
    id="oa-akuna-capital-2", title="Disjoint Subarrays Max Sum", company="Akuna Capital",
    source_ids=["oa-akuna-capital-2"], raw_path="web/content/docs/companies/akuna-capital.mdx",
    raw_blob="f55d4a120afd4d53753815e8a7c810c6c12626b4",
    tags=["数组","最大子数组","动态规划"],
    encode=disjoint_encode, oracle=disjoint_oracle, random=disjoint_random,
    samples=[[-1, 4, -2, 5, -3, 6], [-5, -2], [2, -10, 3]],
    edges=[([-7, -8, -3, -9], None), ([10**9, -10**9, 10**9], None), ([0, 0], None)],
    desc="必须在数组某个相邻位置切成左右两个非空连续部分。分别求左段和右段各自的最大非空连续子数组和，再将两者相加；返回所有切分中的最大值。切分点与两段内的最大子数组可以不同。",
    input="第一行 n；第二行 n 个整数 a[i]。原始题面未给 n 或数值界；本站补充 2≤n≤200000、−1000000000≤a[i]≤1000000000，以确保两段均非空且 64 位和安全。",
    output="输出一个整数，为所有合法切分的最佳和。",
    idea="对每个前缀预计算其中最大子数组和，对每个后缀也预计算最大子数组和。枚举切分点 i，最大化 prefixBest[i]+suffixBest[i+1]。",
    proof="固定切分点时，左段任何合法选择都不可能超过该前缀最大子数组和，右段同理；两侧最大子数组能独立选取，所以二者之和就是该切分点的最优值。枚举所有 1..n−1 的切分点即得到全局最优。",
    complexity="时间 O(n)，空间 O(n)。",
    code='''import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
    left=[0]*n; right=[0]*n
    cur=best=a[0]; left[0]=best
    for i in range(1,n):
        cur=max(a[i],cur+a[i]); best=max(best,cur); left[i]=best
    cur=best=a[-1]; right[-1]=best
    for i in range(n-2,-1,-1):
        cur=max(a[i],cur+a[i]); best=max(best,cur); right[i]=best
    return str(max(left[i]+right[i+1] for i in range(n-1)))
''',
    mutants=[
        ("错误地允许空子数组", '''import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
    def bestpart(x):
        cur=best=0
        for v in x: cur=max(0,cur+v); best=max(best,cur)
        return best
    return str(max(bestpart(a[:i])+bestpart(a[i:]) for i in range(1,n)))
'''),
        ("只检查数组中点切分", '''import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]; i=n//2
    def bestpart(x):
        cur=best=x[0]
        for v in x[1:]: cur=max(v,cur+v); best=max(best,cur)
        return best
    return str(bestpart(a[:i])+bestpart(a[i:]))
'''),
    ],
    raw_source_note="原始 OAMaster MDX 中题面、举例与两遍 Kadane 算法一致；未提供数值约束，故范围明确标为本站补充。",
)


def words_encode(words):
    return f"{len(words)}\n" + "\n".join(words) + "\n"


def words_min_edits(word):
    # Independent dynamic-programming oracle over the full lowercase alphabet.
    inf = len(word) + 1
    dp = [0] * 26
    for i, char in enumerate(word):
        actual = ord(char) - 97
        nxt = [inf] * 26
        for c in range(26):
            cost = int(c != actual)
            if i == 0:
                nxt[c] = cost
            else:
                nxt[c] = min(dp[p] + cost for p in range(26) if p != c)
        dp = nxt
    return min(dp)


def words_oracle(words):
    return " ".join(str(words_min_edits(word)) for word in words)


def words_random(rng):
    alphabet = "abc"
    return ["".join(rng.choice(alphabet) for _ in range(rng.randint(2, 12))) for _ in range(rng.randint(1, 5))]


add(
    id="oa-akuna-capital-25", title="No Pairs Allowed", company="Akuna Capital",
    source_ids=["oa-akuna-capital-25"], raw_path="fastprep/Akuna Capital/akuna-minimal-operations.md",
    raw_blob="e971ed1ddf7c18b88549f41702180da3b91883d3",
    tags=["字符串","贪心","扫描"],
    encode=words_encode, oracle=words_oracle, random=words_random,
    samples=[["add", "boook", "break"], ["aa", "abc"], ["zzzzzz"]],
    edges=[(["a"*100000], "50000"), (["aabbaa"], None), (["ababab"], None)],
    desc="对 words 中的每个单词分别计算最少字符替换次数，使结果中不存在相邻相同字符。每次替换一个位置上的字母；不要求输出替换后的单词。",
    input="第一行 n；随后 n 行各为一个仅含小写 ASCII 字母的单词。完整原范围：1≤n≤100、2≤每个单词长度≤100000；不另限总字符数，合法总长可达10000000。标准输入输出为本站包装。",
    output="输出一行 n 个整数，以空格分隔，依输入单词顺序对应最少替换次数。",
    idea="将单词分解为最大连续相同字符段。长度为 L 的一段至少每两字符替换一次，最少为 floor(L/2)；各段彼此独立，将结果相加。",
    proof="长度 L 的同字符段每次替换最多能消除一对相邻冲突，因此至少需要 floor(L/2) 次。把该段每隔一个位置替换成其他小写字母即可恰好用 floor(L/2) 次并消除所有相邻相等。不同最大段之间原字符本已不同，分别最优处理后无需额外替换，故总和最优。",
    complexity="设总字符数为 S。时间 O(S)，空间 O(1)（不计输出）。",
    code='''import sys
def solve(raw):
    lines=raw.splitlines(); n=int(lines[0]); out=[]
    for word in lines[1:1+n]:
        edits=0; i=0
        while i<len(word):
            j=i+1
            while j<len(word) and word[j]==word[i]: j+=1
            edits+=(j-i)//2; i=j
        out.append(str(edits))
    return " ".join(out)
''',
    mutants=[
        ("每次冲突只替换一个字符", '''import sys
def solve(raw):
    lines=raw.splitlines(); n=int(lines[0]); out=[]
    for w in lines[1:1+n]:
        out.append(str(sum(1 for i in range(1,len(w)) if w[i]==w[i-1])))
    return " ".join(out)
'''),
        ("每个重复段只替换一次", '''import sys
def solve(raw):
    lines=raw.splitlines(); n=int(lines[0]); out=[]
    for w in lines[1:1+n]:
        ans=0; i=0
        while i<len(w):
            j=i+1
            while j<len(w) and w[j]==w[i]: j+=1
            if j-i>1: ans+=1
            i=j
        out.append(str(ans))
    return " ".join(out)
'''),
    ],
    raw_source_note="原始 FastPrep Markdown 确认小写 ASCII 与单词/数量上界；新增总长度上界是本站为评测输入容量所加。",
)


def binary_encode(s):
    return s + "\n"


def binary_oracle(s):
    total = 0
    for left in range(len(s)):
        zeros = ones = 0
        for right in range(left, len(s)):
            zeros += s[right] == "0"
            ones += s[right] == "1"
            if zeros == ones:
                # Exactly two nonempty character groups must form the substring.
                transitions = sum(s[i] != s[i - 1] for i in range(left + 1, right + 1))
                if transitions == 1:
                    total += 1
    return str(total)


def binary_random(rng):
    return "".join(rng.choice("01") for _ in range(rng.randint(1, 24)))


add(
    id="oa-rubrik-1", title="Count Binary Substrings", company="Rubrik",
    source_ids=["oa-rubrik-1"], raw_path="web/content/docs/companies/rubrik.mdx",
    raw_blob="27ce8deadb8ef015ef1db75b5f6f5b1a3dd036c2",
    tags=["字符串","游程编码"],
    encode=binary_encode, oracle=binary_oracle, random=binary_random,
    samples=["00110011", "01", "0000"],
    edges=[("0"*100000+"1"*100000, "100000"), ("1"*100000, "0"), ("01010101", None)],
    desc="统计所有连续子串：其中 0 和 1 的数量相等，并且子串恰好由一段相同字符、紧接着一段另一字符组成。相同内容出现在不同位置时分别计数。",
    input="输入一行非空二进制字符串 s。原始 MDX 未给长度约束或空串规则；本站补充 1≤|s|≤200000。",
    output="输出符合条件的子串数量，按精确十进制整数输出（需至少 64 位整数）。",
    idea="把字符串压缩为相邻字符的游程长度。每对相邻游程长度为 p、q 时，可构成 min(p,q) 个满足条件的子串。",
    proof="合法子串必须只有两段相邻的不同字符，因此唯一对应某一对相邻游程。对长度 p、q 的两段，选择两段边界处各取 t 个字符即可得到 t=1..min(p,q) 个合法子串，且不存在其他合法子串。各游程对互不重叠地归属，求和恰为总数。",
    complexity="n 为字符串长度。时间 O(n)，空间 O(1)。",
    code='''import sys
def solve(raw):
    s=raw.strip(); previous=0; current=1; answer=0
    for i in range(1,len(s)):
        if s[i]==s[i-1]: current+=1
        else:
            answer+=min(previous,current); previous,current=current,1
    answer+=min(previous,current)
    return str(answer)
''',
    mutants=[
        ("每对游程只计一个子串", '''import sys
def solve(raw):
    s=raw.strip(); runs=[]
    for c in s:
        if not runs or runs[-1][0]!=c: runs.append([c,1])
        else: runs[-1][1]+=1
    return str(sum(1 for a,b in zip(runs,runs[1:]) if a[1] and b[1]))
'''),
        ("把多段交替子串也计入", '''import sys
def solve(raw):
    from collections import Counter
    s=raw.strip(); ans=0; balance=0; seen=Counter({0:1})
    for c in s:
        balance += 1 if c=='1' else -1
        ans += seen[balance]; seen[balance]+=1
    return str(ans)
'''),
    ],
    raw_source_note="完整原始来源为 OAMaster 的 Rubrik MDX 页面（源仓库没有对应 FastPrep Markdown）；题面定义了二进制、连续子串及重复计数，本站补充非空与长度界。",
)


def social_encode(value):
    n, edges, queries = value
    return f"{n} {len(edges)} {len(queries)}\n" + "".join(f"{u} {v}\n" for u,v in edges) + " ".join(map(str,queries)) + "\n"


def social_oracle(value):
    n, edges, queries = value
    graph=[[] for _ in range(n)]
    for u,v in edges:
        graph[u-1].append(v-1); graph[v-1].append(u-1)
    component={}
    for start in range(n):
        if start in component: continue
        queue=deque([start]); seen={start}
        while queue:
            u=queue.popleft()
            for v in graph[u]:
                if v not in seen: seen.add(v); queue.append(v)
        for u in seen: component[u]=len(seen)
    return " ".join(str(component[q-1]) for q in queries)


def social_random(rng):
    n=rng.randint(1,10); edges=[]
    for u in range(1,n+1):
        for v in range(u+1,n+1):
            if rng.random()<0.24: edges.append((u,v))
    if edges and rng.random()<0.2: edges.append(rng.choice(edges))
    queries=[rng.randint(1,n) for _ in range(rng.randint(1,n+2))]
    return n,edges,queries


add(
    id="oa-rubrik-2", title="Social Connections (Visible Profiles per Query)", company="Rubrik",
    source_ids=["oa-rubrik-2"], raw_path="web/content/docs/companies/rubrik.mdx",
    raw_blob="27ce8deadb8ef015ef1db75b5f6f5b1a3dd036c2",
    tags=["图论","并查集"],
    encode=social_encode, oracle=social_oracle, random=social_random,
    samples=[(7,[(1,2),(2,3),(3,4),(5,6)],[1,3,5,7]), (1,[],[1]), (4,[(1,2),(2,3),(3,4)],[1,2,4])],
    edges=[((6,[],[1,6]), "1 1"), ((5,[(1,2),(1,2),(3,3)],[1,2,3,4,5]), None), ((3,[(1,2)],[1,1,3]), "2 2 1")],
    desc="给定无向社交图。每个查询用户可见其所在连通分量内的所有用户（含自己），对每个查询按原顺序输出该连通分量大小。",
    input="第一行 `N E Q`；随后 E 行为一条无向边 `u v`；最后一行 Q 个查询用户编号。OAMaster 示例使用 1-based 用户编号；本站明确 1≤N≤200000、0≤E,Q≤200000 且 E+Q≤200000、所有编号在 1..N。允许重复边与自环（均不改变连通分量）。",
    output="输出一行 Q 个整数，依查询顺序给出各用户所在连通分量的顶点数。",
    output_limit=4*1024,
    idea="用并查集处理全部边，采用路径压缩和按大小合并；查询时读取根节点记录的集合大小。",
    proof="并查集在处理完每条无向边后，恰好把边可达的顶点合并在一起：逐边归纳可知每个集合包含且仅包含其连通分量。按大小合并维护根节点集合大小，因此每个查询输出的就是用户所在分量人数。",
    complexity="时间 O((N+E+Q) α(N))，空间 O(N+E)。",
    code='''import sys
def solve(raw):
    t=list(map(int,raw.split())); n,e,q=t[:3]; edges=t[3:3+2*e]; queries=t[3+2*e:3+2*e+q]
    parent=list(range(n+1)); size=[1]*(n+1)
    def find(x):
        while parent[x]!=x:
            parent[x]=parent[parent[x]]; x=parent[x]
        return x
    for i in range(0,len(edges),2):
        a=find(edges[i]); b=find(edges[i+1])
        if a!=b:
            if size[a]<size[b]: a,b=b,a
            parent[b]=a; size[a]+=size[b]
    return " ".join(str(size[find(x)]) for x in queries)
''',
    mutants=[
        ("只返回直接邻居数量加自身", '''import sys
def solve(raw):
    t=list(map(int,raw.split())); n,e,q=t[:3]; p=3; degree=[0]*(n+1)
    for _ in range(e):
        u,v=t[p:p+2]; p+=2; degree[u]+=1; degree[v]+=1
    return " ".join(str(degree[x]+1) for x in t[p:p+q])
'''),
        ("重复查询用户只输出一次", '''import sys
def solve(raw):
    t=list(map(int,raw.split())); n,e,q=t[:3]; p=3; graph=[[] for _ in range(n+1)]
    for _ in range(e):
        u,v=t[p:p+2]; p+=2; graph[u].append(v); graph[v].append(u)
    answers=[]
    for x in dict.fromkeys(t[p:p+q]):
        seen={x}; stack=[x]
        while stack:
            u=stack.pop()
            for v in graph[u]:
                if v not in seen: seen.add(v); stack.append(v)
        answers.append(str(len(seen)))
    return " ".join(answers)
'''),
    ],
    raw_source_note="原始 OAMaster MDX 逐字定义无向图、直接/传递可见关系及按查询返回连通分量大小；源题未提供约束与编号起点，本站明示 1-based 编号和规模界。",
)


def compress_encode(value):
    word,k=value
    return f"{word} {k}\n"


def compress_oracle(value):
    word,k=value
    while True:
        i=0; out=[]; removed=False
        while i<len(word):
            j=i+1
            while j<len(word) and word[j]==word[i]: j+=1
            run=j-i
            if not removed and run>=k:
                out.extend(word[i+k:j]); removed=True
            else:
                out.append(word[i:j])
            i=j
        new="".join(out)
        if not removed: return new
        word=new


def compress_random(rng):
    while True:
        word="".join(rng.choice("abc") for _ in range(rng.randint(2,28)))
        k=rng.randint(2,min(8,len(word)))
        if compress_oracle((word,k)):
            return word,k


add(
    id="oa-rubrik-5", title="Word Compression (Remove k Consecutive Equal Characters)", company="Rubrik",
    source_ids=["oa-rubrik-5"], raw_path="web/content/docs/companies/rubrik.mdx",
    raw_blob="27ce8deadb8ef015ef1db75b5f6f5b1a3dd036c2",
    tags=["字符串","栈","模拟"],
    encode=compress_encode, oracle=lambda value: compress_oracle(value), random=compress_random,
    samples=[("abbbaac",3), ("aaab",3), ("abcd",2)],
    edges=[(("aaabbbxxxa",3), None), (("a"*100000+"b",100001), "a"*100000+"b"), (("aabbbaa",3), "a")],
    desc="反复删除单词中任意一组恰好 K 个连续相同字符，直到无法继续；题面保证最终至少剩一个字符，且称最终结果唯一。",
    input="一行输入小写 ASCII 单词 word 与整数 K。原始 MDX 未给 K 或长度范围；本站补充 2≤K≤200000、2≤|word|≤200000。输入须满足按规则压缩后的结果非空（与原题保证一致）。",
    output="输出最终剩余单词。",
    output_limit=4*1024,
    idea="从左到右扫描字符，维护 `(字符, 连续计数)` 栈。计数达到 K 时弹出该组；弹出后后续字符自然与新的栈顶合并，处理连锁删除。",
    proof="扫描到任意前缀时，栈表示该前缀依题意反复删除后的唯一稳定结果，并且栈内相邻字符组不同。读入新字符时，若与栈顶相同则只可能延长该组；长度达到 K 后立即删除一组，得到该前缀的稳定结果。若字符不同则新建一组。对前缀长度归纳，终止时栈展开即为全串稳定结果；题面保证结果唯一，因此与操作顺序无关。",
    complexity="n 为 word 长度。时间 O(n)，空间 O(n)。",
    code='''import sys
def solve(raw):
    word,k=raw.split(); k=int(k); stack=[]
    for c in word:
        if stack and stack[-1][0]==c:
            stack[-1][1]+=1
            if stack[-1][1]==k: stack.pop()
        else:
            stack.append([c,1])
    return "".join(c*count for c,count in stack)
''',
    mutants=[
        ("只移除原始输入中已有的长游程", '''import sys
def solve(raw):
    word,k=raw.split(); k=int(k); out=[]; i=0
    while i<len(word):
        j=i+1
        while j<len(word) and word[j]==word[i]: j+=1
        if j-i<k: out.append(word[i:j])
        i=j
    return "".join(out)
'''),
        ("达到 K 后只减计数而不删除整组", '''import sys
def solve(raw):
    word,k=raw.split(); k=int(k); stack=[]
    for c in word:
        if stack and stack[-1][0]==c:
            stack[-1][1]+=1
            if stack[-1][1]==k: stack[-1][1]=0
        else: stack.append([c,1])
    return "".join(c*count for c,count in stack)
'''),
    ],
    raw_source_note="原始 OAMaster MDX 给出操作定义、终止条件、唯一性及非空结果保证；无字母域/K/n 约束，故本站明确使用小写 ASCII 和长度/K 上限，并只纳入结果非空输入。",
)


def gems_encode(values):
    return vector_encode(values)


def gems_oracle(values):
    best=0
    for mask in range(1<<len(values)):
        stamina=0; count=0; valid=True
        for i,value in enumerate(values):
            if mask>>i&1:
                stamina+=value; count+=1
                if stamina<0: valid=False; break
        if valid: best=max(best,count)
    return str(best)


def gems_random(rng):
    return [rng.randint(-8,8) for _ in range(rng.randint(1,14))]


add(
    id="oa-rubrik-20", title="Mike and Gems", company="Rubrik",
    source_ids=["oa-rubrik-20"], raw_path="fastprep/Rubrik/rubrik-mike-and-gems.md",
    raw_blob="a9836195164bcab8fe7f7ae87483ac9f5fe2187c",
    tags=["数组","贪心","优先队列"],
    encode=gems_encode, oracle=gems_oracle, random=gems_random,
    samples=[[1,-1], [2,-3,1,0], [-5,-1,-3]],
    edges=[([0]*100000, "100000"), ([10**9]*100000, "100000"), ([-10**9]*100000, "0"), ([10,-8,-3,-6], "3")],
    desc="沿固定顺序经过 n 颗宝石，每颗必须选择拾取或摧毁。拾取第 i 颗使当前体力增加 a[i]；任意时刻体力不能低于 0。初始体力按题意为 0。求最多拾取颗数。",
    input="第一行 n；第二行 n 个整数 a[i]。原始 FastPrep 约束：1≤n≤100000，−1000000000≤a[i]≤1000000000。",
    output="输出可在全过程保持体力非负时最多拾取的宝石数。",
    idea="从左到右先暂时拾取每颗宝石并维护体力和与已选数值最小堆；若和变负，就摧毁当前已选中负值最小的宝石（弹出堆顶），直到体力非负。",
    proof="扫描任意前缀时，算法维护一个可行的最大基数选择集。加入新宝石后若体力仍非负，基数增加一。若变负，任何包含该前缀所有已选宝石的集合都不可行；要恢复可行且尽量保留数量，删除所选中数值最小的宝石能最大程度增加体力、且只损失一个计数。重复直到可行。归纳每个前缀得到最大可行基数；终点即全程最大拾取数。",
    complexity="时间 O(n log n)，空间 O(n)。",
    code='''import heapq
import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; values=t[1:1+n]
    heap=[]; stamina=0
    for value in values:
        heapq.heappush(heap,value); stamina+=value
        if stamina<0: stamina-=heapq.heappop(heap)
    return str(len(heap))
''',
    mutants=[
        ("直接丢弃所有负值", '''import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; return str(sum(x>=0 for x in t[1:1+n]))
'''),
        ("体力变负时只丢弃当前宝石", '''import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; chosen=[]; stamina=0
    for x in t[1:1+n]:
        if stamina+x>=0: chosen.append(x); stamina+=x
    return str(len(chosen))
'''),
    ],
    raw_source_note="原始 FastPrep Markdown 包含明确输入输出与完整 n/a_i 约束；未依赖/执行上游解法。",
)


def execute(path, stdin):
    result=subprocess.run([sys.executable,"-I",str(path)],input=stdin,text=True,capture_output=True,timeout=8,check=True)
    return result.stdout.rstrip("\n")


def normalize_package(raw):
    script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    result=subprocess.run(["node","--import","tsx","-e",script],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout


def main():
    for folder in ("packages","editorials","references","oracles","mutants","negative-controls","reviews","candidate-batches","validation"):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    batch_items=[]; reports=[]; reviews=[]
    for spec in SPECS:
        identifier=spec["id"]; source=SOURCES[spec["source_ids"][0]]
        rng=random.Random(20261005+int(identifier.rsplit("-",1)[1]))
        reference_code=textwrap.dedent(spec["code"]).strip()+"\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
        reference=OUT/"references"/f"{identifier}.py"; reference.write_text(reference_code)
        values=spec["samples"]+[spec["random"](rng) for _ in range(160)]
        oracle_cases=[]
        for value in values:
            expected=spec["oracle"](value); stdin=spec["encode"](value)
            actual=execute(reference,stdin)
            assert actual==expected,(identifier,"oracle mismatch",value,expected,actual)
            oracle_cases.append({"input":stdin,"expectedOutput":expected+"\n"})
        edge_cases=[]
        for value,expected in spec["edges"]:
            stdin=spec["encode"](value)
            if expected is None: expected=spec["oracle"](value)
            actual=execute(reference,stdin)
            assert actual==expected,(identifier,"edge mismatch",value,expected,actual)
            edge_cases.append({"input":stdin,"expectedOutput":expected+"\n"})
        tests=oracle_cases[:3]+edge_cases+oracle_cases[3:27]
        cases=[]
        for i,test in enumerate(tests):
            cases.append({"name":f"公开样例 {i+1}" if i<3 else f"隐藏验证 {i-2}",**test,"hidden":i>=3,"weight":1})
        mutants=[]; kill_report=[]
        for label,mutant_source in spec["mutants"]:
            mutant_code=textwrap.dedent(mutant_source).strip()+"\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
            control=OUT/"negative-controls"/f"{identifier}-{len(mutants)+1}.py"; control.write_text(mutant_code)
            rejected=[]
            for i,case in enumerate(cases):
                if execute(control,case["input"])!=case["expectedOutput"].rstrip("\n"):
                    rejected.append(i)
            assert rejected,(identifier,"mutant survived",label)
            mutants.append({"name":label,"code":mutant_code})
            kill_report.append({"name":label,"rejectedByCases":rejected})
        problem={"id":identifier,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"中等","tags":["OA",spec["company"]]+spec["tags"],"description":spec["desc"]+"\n\n输入格式、样例与评测数据由 CSWork 整理编写；原题来源与本站补充限制见题面。","input":spec["input"],"output":spec["output"],"explanation":"按以上规则处理输入；思路、正确性证明和复杂度见配套讲义。","hints":[spec["idea"]],"timeLimit":3,"memoryLimit":262144,"outputLimit":spec.get("output_limit",16384),"checker":"tokens","languages":["python","go","java","cpp"]}
        normalized=normalize_package({"schemaVersion":1,"problem":problem,"cases":cases})
        package=json.loads(normalized)
        editorial_text=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        authored=[{"language":"python","code":reference_code}]
        editorial={"schemaVersion":1,"id":identifier,"title":spec["title"],"explanation":editorial_text,"solutions":authored,"sourceUrl":source["sourceUrl"],"sourceContentHash":source["contentHash"],"author":"CSWork"}
        for folder,document in (("packages",package),("oracles",oracle_cases),("mutants",mutants),("editorials",editorial)):
            (OUT/folder/f"{identifier}.json").write_text(json.dumps(document,ensure_ascii=False,indent=2)+"\n")
        batch_items.append({"id":identifier,"sourceContentHash":source["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":editorial_text,"authoredSolutions":authored})
        reports.append({"id":identifier,"oracleCases":len(oracle_cases),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":kill_report,"referenceSha256":hashlib.sha256(reference_code.encode()).hexdigest()})
        reviews.append({"id":identifier,"status":"authored","reason":spec["raw_source_note"]+" 输入协议和所有本站补充范围均在题面明确说明；离线 oracle、参考程序与两个正常退出错误程序均验证通过。","sourceCommit":"e66f809f4c953bce129f68491726176615db6afc","rawPath":spec["raw_path"],"rawGitBlob":spec["raw_blob"],"catalogContentHash":source["contentHash"]})
        print(f"{identifier}: {len(oracle_cases)} independent oracle checks; {len(cases)} judge cases; {len(mutants)} normal-exit mutants rejected",flush=True)
    reviews.extend([
        {"id":"oa-akuna-capital-14","status":"blocked","reason":"原题 Indicator 2 的例子与可直接编码的定义/页面现有解法冲突：`[2,2,4,4,4,4,4,4]` 的文字答案只计 index 2，但若按 1-based index k 检查 arr[k]=k 且向后 k 个值相等，index 4 也会计入；“恰好 k 个”是否要求后续值不再相同亦未说明。未猜语义。","sourceCommit":"e66f809f4c953bce129f68491726176615db6afc","rawPath":"web/content/docs/companies/akuna-capital.mdx","rawGitBlob":"f55d4a120afd4d53753815e8a7c810c6c12626b4","catalogContentHash":SOURCES["oa-akuna-capital-14"]["contentHash"]},
        {"id":"oa-akuna-capital-21","status":"blocked","reason":"样例 2 选择 [9,4,5]，连续跳过 −1 与 −3 两部电影，与题干‘不能连续跳过两部’直接冲突；最大化目标无法唯一确定，不臆造修正。","sourceCommit":"e66f809f4c953bce129f68491726176615db6afc","rawPath":"web/content/docs/companies/akuna-capital.mdx","rawGitBlob":"f55d4a120afd4d53753815e8a7c810c6c12626b4","catalogContentHash":SOURCES["oa-akuna-capital-21"]["contentHash"]},
    ])
    candidate={"schemaVersion":1,"items":batch_items}
    batch_folder = "batches" if (OUT/"reports"/"akuna-rubrik-next.json").exists() else "candidate-batches"
    (OUT/batch_folder/"akuna-rubrik-next.json").write_text(json.dumps(candidate,ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation"/"akuna-rubrik-next.json").write_text(json.dumps({"schemaVersion":1,"seed":20261005,"problems":reports,"note":"Offline authored reference/oracle/mutant validation only. Not verified in production GoJudge and not published."},ensure_ascii=False,indent=2)+"\n")
    (OUT/"reviews"/"akuna-rubrik-next.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")


if __name__=="__main__":
    main()
