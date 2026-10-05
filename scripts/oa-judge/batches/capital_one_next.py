"""Author six Capital One OA packages with independent local oracles.

Only files under this batch's authored content names are written. Local
validation is not GoJudge acceptance and this script does not touch registry.
"""
from collections import Counter
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import textwrap
import time

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}


def run(path, stdin):
    result = subprocess.run([sys.executable, "-I", str(path)], input=stdin, text=True,
                            capture_output=True, timeout=8, check=True)
    return result.stdout.rstrip("\n")


def path_encode(value):
    n, edges = value
    return f"{n}\n" + "".join(f"{a} {b}\n" for a, b in edges)


def path_oracle(value):
    n, edges = value
    graph = {}
    for a, b in edges:
        graph.setdefault(a, []); graph.setdefault(b, [])
        graph[a].append(b); graph[b].append(a)
    ends = sorted(v for v in graph if len(graph[v]) == 1)
    cur, prev = ends[0], None
    order = []
    while cur is not None:
        order.append(cur)
        nxt = next((v for v in graph[cur] if v != prev), None)
        prev, cur = cur, nxt
    return " ".join(map(str, order))


def random_path(rng):
    n = rng.randint(2, 14)
    order = rng.sample(range(1, 1000), n)
    edges = [(order[i], order[i + 1]) for i in range(n - 1)]
    rng.shuffle(edges)
    return n, edges


def pair_encode(value):
    a, b, qs = value
    return f"{len(a)} {len(b)} {len(qs)}\n{' '.join(map(str,a))}\n{' '.join(map(str,b))}\n" + "".join(
        (f"0 {i} {x}\n" if kind == 0 else f"1 {x}\n") for kind, i, x in qs)


def pair_oracle(value):
    a, b, qs = value
    a = a[:]
    out = []
    for kind, i, x in qs:
        if kind == 0:
            a[i] += x
        else:
            out.append(str(sum(1 for av in a for bv in b if av + bv == x)))
    return " ".join(out)


def random_pair(rng):
    a = [rng.randint(-8, 12) for _ in range(rng.randint(1, 9))]
    b = [rng.randint(-8, 12) for _ in range(rng.randint(1, 9))]
    qs = []
    for _ in range(rng.randint(1, 12)):
        if rng.random() < .42:
            qs.append((0, rng.randrange(len(a)), rng.randint(-6, 8)))
        else:
            qs.append((1, 0, rng.randint(-15, 20)))
    if not any(q[0] == 1 for q in qs): qs.append((1, 0, 0))
    return a, b, qs


def square_encode(h): return f"{len(h)}\n{' '.join(map(str,h))}\n"
def square_oracle(h):
    best = 0
    for left in range(len(h)):
        low = h[left]
        for right in range(left, len(h)):
            low = min(low, h[right])
            side = min(low, right - left + 1)
            best = max(best, side * side)
    return str(best)
def random_square(rng): return [rng.randint(0, 15) for _ in range(rng.randint(1, 16))]


def titles_encode(items): return f"{len(items)}\n" + "".join(f"{s}\n" for s in items)
def titles_oracle(items):
    return str(sum(i != j and items[j].startswith(items[i])
                   for i in range(len(items)) for j in range(len(items))))
def random_titles(rng):
    alphabet = "abc"
    return ["".join(rng.choice(alphabet) for _ in range(rng.randint(1, 7)))
            for _ in range(rng.randint(1, 12))]


def recipes_encode(value):
    ingredients, recipes = value
    return f"{len(ingredients)} {len(recipes)}\n" + "\n".join(ingredients + recipes) + "\n"
def word_break(word, ingredients):
    reachable = [False] * (len(word) + 1); reachable[0] = True
    for i in range(len(word)):
        if reachable[i]:
            for ing in ingredients:
                if word.startswith(ing, i): reachable[i + len(ing)] = True
    return reachable[-1]
def recipes_oracle(value):
    ingredients, recipes = value
    return " ".join("YES" if word_break(word, ingredients) else "NO" for word in recipes)
def random_recipes(rng):
    ingredients = list(dict.fromkeys("".join(rng.choice("abc") for _ in range(rng.randint(1, 3)))
                                     for _ in range(rng.randint(1, 6))))
    recipes = ["".join(rng.choice("abcx") for _ in range(rng.randint(1, 10)))
               for _ in range(rng.randint(1, 8))]
    if rng.random() < .5:
        recipes[0] = "".join(rng.choice(ingredients) for _ in range(rng.randint(1, 3)))
    return ingredients, recipes


def digits_encode(nums): return f"{len(nums)}\n{' '.join(map(str, nums))}\n"
def digits_oracle(nums): return str(sum(len(str(x)) % 2 == 0 for x in nums))
def random_digits(rng): return [rng.randint(0, 10**9) for _ in range(rng.randint(1, 25))]


SPECS = [
 dict(id="oa-capital-one-4", title="Reconstruct Journey from Photo Pairs", tags=["图", "路径"],
      desc="旅途中每个地标恰好访问一次。每张照片记录一对连续访问的不同地标，照片对的先后顺序不确定。根据全部照片还原完整旅程；正向或反向均有效。本站为输出确定性，要求从两个端点中编号较小者开始输出。",
      inp="第一行 n（2≤n≤200000），随后 n−1 行各含两个不同整数 u、v，表示一张照片。地标编号互不重复出现为节点标签，绝对值不超过 10^9。本站补充保证这些边构成一条简单路径。",
      out="输出从较小编号端点出发的 n 个地标编号，以空格分隔。较大端点起始的反向路径与其等价，但本站统一要求较小端点开头以便精确比较。",
      code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; g={}\n for i in range(1,len(t),2):\n  a,b=t[i],t[i+1]; g.setdefault(a,[]).append(b); g.setdefault(b,[]).append(a)\n cur=min(v for v,ns in g.items() if len(ns)==1); prev=None; out=[]\n while True:\n  out.append(cur); nxt=next((x for x in g[cur] if x!=prev),None)\n  if nxt is None: break\n  prev,cur=cur,nxt\n return ' '.join(map(str,out))\n''', encode=path_encode, oracle=path_oracle, random=random_path,
      samples=[(5,[(3,5),(1,4),(2,4),(1,5)]),(2,[(9,-2)]),(4,[(20,3),(3,10),(10,-7)])],
      mutants=[("选编号最小节点而非路径端点", "cur=min(v for v,ns in g.items() if len(ns)==1)", "cur=min(g)"),
               ("只从起点走到相邻节点后停止", "while True:\n  out.append(cur); nxt=next((x for x in g[cur] if x!=prev),None)", "out.append(cur); nxt=None\n while False:")]),
 dict(id="oa-capital-one-6", title="Pair Sum Queries", tags=["哈希表", "动态更新"],
      desc="给定整数数组 a、b，依次处理两类查询：`0 i x` 将 a[i] 增加 x，其中 i 为 0-based 下标；`1 x` 查询满足 a[i]+b[j]=x 的下标对 (i,j) 数量。不同位置分别计数。",
      inp="第一行 n m q。第二行 n 个整数为 a，第三行 m 个整数为 b，之后 q 行为查询。本站补充范围：1≤n,m≤200000，1≤q≤200000；初值、增量及目标值绝对值≤10^9，保证更新后的 a[i] 绝对值≤10^12；并保证所有类型 1 查询中，Σ min(Da,Db)≤10^7，其中 Da、Db 分别是该次查询时 a、b 的不同值数量。该限制对应程序每次查询遍历较小的频次表。",
      out="对每条 `1 x` 查询依次输出对应下标对数量，以空格分隔；无此类查询时输出空行。",
      code='''import sys\ndef solve(raw):\n it=iter(map(int,raw.split())); n,m,q=next(it),next(it),next(it); a=[next(it) for _ in range(n)]; b=[next(it) for _ in range(m)]\n ca={}; cb={}\n for x in a: ca[x]=ca.get(x,0)+1\n for x in b: cb[x]=cb.get(x,0)+1\n out=[]\n for _ in range(q):\n  typ=next(it)\n  if typ==0:\n   i,x=next(it),next(it); old=a[i]; ca[old]-=1\n   if ca[old]==0: del ca[old]\n   a[i]+=x; ca[a[i]]=ca.get(a[i],0)+1\n  else:\n   x=next(it)\n   if len(ca)<=len(cb): total=sum(c*cb.get(x-v,0) for v,c in ca.items())\n   else: total=sum(c*ca.get(x-v,0) for v,c in cb.items())\n   out.append(str(total))\n return ' '.join(out)\n''', encode=pair_encode, oracle=pair_oracle, random=random_pair,
      samples=[([1,1,2],[2,3],[(1,0,4),(0,0,2),(1,0,4)]),([0],[0],[(1,0,0)]),([-1,4],[2,-2],[(1,0,1),(0,1,-3),(1,0,1)])],
      mutants=[("更新后未从旧频次移除", "ca[old]-=1", "ca[old]-=0"),
               ("求和时使用错误补数", "cb.get(x-v,0)", "cb.get(x+v,0)")]),
 dict(id="oa-capital-one-7", title="Largest Square in Skyscraper Outline", tags=["二分", "单调性"],
      desc="一排相邻摩天楼宽度均为 1，高度由数组 cityLine 给出。求完全位于建筑轮廓内的最大正方形面积。",
      inp="第一行 n（1≤n≤200000），第二行 n 个非负整数 h_i（0≤h_i≤10^9）。这些输入范围为本站补充，原题未列出约束。",
      out="输出可容纳的最大正方形面积。",
      code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; h=t[1:]; lo,hi=0,min(n,max(h,default=0))\n def ok(s):\n  run=0\n  for x in h:\n   run=run+1 if x>=s else 0\n   if run>=s: return True\n  return s==0\n while lo<hi:\n  mid=(lo+hi+1)//2\n  if ok(mid): lo=mid\n  else: hi=mid-1\n return str(lo*lo)\n''', encode=square_encode, oracle=square_oracle, random=random_square,
      samples=[[1,2,3,2,1],[4,3,4],[0,0,5,5,5]],
      mutants=[("求最大矩形面积而非正方形面积", "return str(lo*lo)", "return str(max((min(h[i:j+1])*(j-i+1) for i in range(n) for j in range(i,n)),default=0))"),
               ("正方形高度允许差一", "if x>=s else 0", "if x>=s-1 else 0")]),
 dict(id="oa-capital-one-9", title="Book Title Catalog — Count Titles That Are Prefix of Another", tags=["字符串", "Trie"],
      desc="给定书名列表 titles，统计有序下标对 (i,j) 的数量，其中 i≠j 且 titles[i] 是 titles[j] 的前缀。相同书名位于不同下标时也算作前缀关系。",
      inp="第一行 n（1≤n≤200000），随后 n 行各为一个只含小写英文字母的非空书名，长度为 1..1000；所有书名总长度≤2×10^6。字符集和约束是本站补充。",
      out="输出满足条件的有序下标对数量。",
      code='''import sys\ndef solve(raw):\n lines=raw.splitlines(); n=int(lines[0]); words=lines[1:1+n]; trie={}; END='#'\n for w in words:\n  node=trie\n  for c in w: node=node.setdefault(c,{})\n  node[END]=node.get(END,0)+1\n total=0\n for w in words:\n  node=trie\n  for c in w:\n   node=node[c]; total+=node.get(END,0)\n  total-=1\n return str(total)\n''', encode=titles_encode, oracle=titles_oracle, random=random_titles,
      samples=[["wall","wallpaper","science","wallet","philosophy","phil"],["a"],["ab","ab","abc","b"]],
      mutants=[("不排除同一书名自身", "total-=1", "total+=0"),
               ("只统计完整相同书名", "for c in w:\n   node=node[c]; total+=node.get(END,0)", "for c in w:\n   node=node[c]\n  total+=node.get(END,0)")]),
 dict(id="oa-capital-one-12", title="Recipes — Is Each Recipe a Prep-list Combination?", tags=["动态规划", "字符串"],
      desc="给定原料字符串 ingredients 和多个 recipe。若 recipe 能拆成一个或多个连续、非空的片段，且每段都恰好等于 ingredients 中的某个字符串，则它是 prep-list combination。逐个判断。",
      inp="第一行 n r（1≤n,r≤200000），接下来 n 行为非空小写原料名，再接 r 行为非空小写 recipe。本站补充范围：每个原料长度≤100，所有原料总字符数≤200000；recipe 总字符数≤100000，且最大原料长度 × recipe 总字符数 ≤10^7。上述输入格式和性能范围是本站补充。",
      out="按 recipe 输入顺序输出 YES 或 NO，以空格分隔。",
      code='''import sys\ndef solve(raw):\n lines=raw.splitlines(); n,r=map(int,lines[0].split()); words=lines[1:1+n]; recipes=lines[1+n:1+n+r]; end='#'; trie={}\n for word in words:\n  node=trie\n  for ch in word: node=node.setdefault(ch,{})\n  node[end]=True\n ans=[]\n for w in recipes:\n  dp=[False]*(len(w)+1); dp[0]=True\n  for i in range(len(w)):\n   if not dp[i]: continue\n   node=trie; j=i\n   while j<len(w):\n    node=node.get(w[j])\n    if node is None: break\n    j+=1\n    if end in node: dp[j]=True\n  ans.append('YES' if dp[-1] else 'NO')\n return ' '.join(ans)\n''', encode=recipes_encode, oracle=recipes_oracle, random=random_recipes,
      samples=[(["flour","sugar","eggs"],["floursugar","random","flour","sugarflour","sugareggs"]),(["a","ab"],["ab","aba","b"]),(["xy"],["xy","xyxy","x"] )],
      mutants=[("只允许单个原料完成拆分", "if end in node: dp[j]=True", "if end in node and i==0: dp[j]=True"),
               ("只接受长度为一的原料", "if end in node: dp[j]=True", "if end in node and j==i+1: dp[j]=True")]),
 dict(id="oa-capital-one-13", title="Count Numbers with Even Number of Digits", tags=["数组", "字符串"],
      desc="给定整数数组 nums，统计十进制表示具有偶数位数的元素个数。0 的十进制表示为一位。",
      inp="第一行 n（1≤n≤100000），第二行 n 个整数（0≤nums[i]≤10^9）。长度及取值约束为本站采用的常见范围；数字位数按十进制表示计算。",
      out="输出位数为偶数的元素数量。",
      code='''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); return str(sum(len(str(abs(x)))%2==0 for x in t[1:]))\n''', encode=digits_encode, oracle=digits_oracle, random=random_digits,
      samples=[[12,345,2,6,7896],[555,901,482,1771],[0,10,100,1000]],
      mutants=[("把奇数位数计入答案", "len(str(abs(x)))%2==0", "len(str(abs(x)))%2==1"),
               ("0 错误算作两位数", "len(str(abs(x)))%2==0", "(x==0 or len(str(abs(x)))%2==0)")]),
]

EDITORIAL = {
    "oa-capital-one-4": (
        "先由照片对建立无向邻接表。简单路径恰有两个度为 1 的端点；从编号较小的端点出发，每次走向不是上一个节点的邻居即可恢复顺序。",
        "路径端点只有一个尚未访问的相邻节点（起点除外）。沿边前进且不回头，因此每个地标恰访问一次；走到另一端后没有新邻居，得到完整路径。",
        "时间 O(n)，空间 O(n)。"),
    "oa-capital-one-6": (
        "维护 a、b 两边的值频次。更新时从 a 的旧值计数中减一，再将新值计数加一。查询目标 x 时遍历不同值数较少的一侧，累加 `freqA[v] × freqB[x-v]`。",
        "每个下标对 (i,j) 唯一对应两数组中的一对互补值。遍历较小频次表中的每个不同值 v，并乘以另一侧中目标值减 v 的频次，恰好计出所有满足条件的下标对，因此既不漏计也不重复计数。",
        "令 Da、Db 为一次查询时两侧不同值数。更新期望 O(1)，查询 O(min(Da,Db))；本站保证所有查询的该项之和不超过 10^7。空间 O(n+m)。"),
    "oa-capital-one-7": (
        "枚举正方形边长 s 的可行性：扫描高度数组，检查是否存在至少 s 个连续楼高均不低于 s。可行性随 s 增大单调不增，故二分最大 s，答案为 s²。",
        "高度连续达 s 的楼群可容纳宽 s、高 s 的正方形，反之任何边长 s 的正方形都必须覆盖至少 s 个连续楼且这些楼高均至少为 s。因此检查条件与可行性等价；单调二分找到最大边长。",
        "二分 O(n log(min(n,max(h))))，额外空间 O(1)。"),
    "oa-capital-one-9": (
        "将每个标题插入 Trie，并在终止节点记录该完整标题出现次数。对每个标题沿 Trie 前进，累加路径上各终止节点的次数；最后减去当前标题自身一次。",
        "对固定标题 j，所有作为其前缀的标题恰好对应 Trie 根到其终点路径上的终止节点。终止次数包含重复标题的不同下标，而减去 1 仅移除 j 与自身配对，正好满足 i≠j。",
        "设所有标题字符总数为 L。构建和查询均为 O(L)，空间 O(L)。"),
    "oa-capital-one-12": (
        "把所有原料放入 Trie。dp[i] 表示 recipe 的前 i 个字符可被拆分。仅从 dp[i] 为真的位置开始沿 Trie 向后扫描；每遇到原料终止节点就令对应 dp[j] 为真。",
        "dp[0] 为真对应空前缀。从可达位置 i 沿 Trie 到终点 j，恰表示 recipe[i:j] 是一个原料，因此可扩展有效拆分。任何有效拆分最后一段必是原料，Trie 扫描必能找到该终点，故转移必要且充分。",
        "设原料总长度为 S、最大原料长度为 M、所有 recipe 总长为 L。建 Trie 为 O(S)，DP 扫描最多 O(LM) 次边；本站补充保证 LM≤10^7。空间 O(S+Lmax)。"),
    "oa-capital-one-13": (
        "逐个计算非负整数的十进制位数，若位数为偶数则计数。位数可通过十进制字符串长度得到；0 表示为一位。",
        "每个数组元素仅在其十进制表示长度为偶数时贡献 1，否则贡献 0。逐项相加即为题目所求，且每项恰好处理一次。",
        "时间 O(n·d)，其中 d≤10；空间 O(1)（不计解析输入所需空间）。"),
}


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants", "negative-controls", "reviews", "candidate-batches", "validation"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    batch_items, reports, reviews = [], [], []
    for spec in SPECS:
        pid = spec["id"]
        source = SOURCES[pid]
        code = textwrap.dedent(spec["code"]).strip() + "\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
        ref = OUT / "references" / f"{pid}.py"
        ref.write_text(code)
        rng = random.Random(20261005 + int(pid.rsplit("-", 1)[1]))
        values = spec["samples"] + [spec["random"](rng) for _ in range(160)]
        oracle_cases = []
        for value in values:
            stdin, expected = spec["encode"](value), spec["oracle"](value)
            actual = run(ref, stdin)
            assert actual == expected, (pid, value, expected, actual)
            oracle_cases.append({"input": stdin, "expectedOutput": expected + "\n"})
        cases = [{"name": f"样例 {i+1}", **c, "hidden": False, "weight": 1}
                 for i, c in enumerate(oracle_cases[:3])]
        cases += [{"name": f"隐藏测试 {i+1}", **c, "hidden": True, "weight": 1}
                  for i, c in enumerate(oracle_cases[3:27])]
        mutant_docs, kill = [], []
        for i, (name, old, new) in enumerate(spec["mutants"], 1):
            assert old in code, (pid, "mutation anchor missing", old)
            mutant = code.replace(old, new)
            control = OUT / "negative-controls" / f"{pid}-{i}.py"
            control.write_text(mutant)
            rejected = [j for j, case in enumerate(cases)
                        if run(control, case["input"]) != case["expectedOutput"].rstrip("\n")]
            assert rejected, (pid, "mutant survived", name)
            mutant_docs.append({"name": name, "code": mutant})
            kill.append({"name": name, "rejectedByCases": rejected})
        problem = {
            "id": pid, "courseId": "gomall", "lessonId": "00-overview", "title": spec["title"],
            "difficulty": "中等", "tags": ["OA", "Capital One"] + spec["tags"],
            "description": spec["desc"] + "\n\n输入协议和约束范围中标明‘本站补充’的部分由本站整理，不是原题额外条件。",
            "input": spec["inp"], "output": spec["out"],
            "explanation": "按上述规则处理输入；思路、正确性证明与复杂度见配套题解。",
            "hints": ["先明确题目中的计数/路径/拆分定义，再选择适合的图遍历、频次统计或动态规划。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "exact", "languages": ["python", "go", "java", "cpp"]}
        raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
        normalizer = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
        normalized_result = subprocess.run(["node", "--import", "tsx", "-e", normalizer], cwd=ROOT,
                                           input=json.dumps(raw_package, ensure_ascii=False), text=True,
                                           capture_output=True)
        if normalized_result.returncode:
            raise RuntimeError(normalized_result.stderr)
        normalized = normalized_result.stdout
        package = json.loads(normalized)
        idea, proof, complexity = EDITORIAL[pid]
        editorial_text = f"## 思路\n\n{idea}\n\n## 正确性\n\n{proof}\n\n## 复杂度\n\n{complexity}"
        solutions = [{"language": "python", "code": code}]
        editorial = {"schemaVersion": 1, "id": pid, "title": spec["title"],
                     "explanation": editorial_text, "solutions": solutions,
                     "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"}
        for folder, document in (("packages", package), ("oracles", oracle_cases),
                                 ("mutants", mutant_docs), ("editorials", editorial)):
            (OUT / folder / f"{pid}.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        package_checksum = hashlib.sha256(normalized.encode()).hexdigest()
        batch_items.append({"id": pid, "sourceContentHash": source["contentHash"],
                            "packageChecksum": package_checksum, "editorial": editorial_text,
                            "authoredSolutions": solutions})
        reports.append({"id": pid, "oracleCases": len(oracle_cases), "publicCases": 3,
                        "hiddenCases": len(cases) - 3, "negativeControls": kill,
                        "referenceSha256": hashlib.sha256(code.encode()).hexdigest()})
        reviews.append({"id": pid, "status": "authored",
                        "reason": "题目语义依照 OAMaster 源题；本站补充的 I/O 协议和范围均在题面显式说明。",
                        "sourceUrls": [source["sourceUrl"]], "sourceContentHashes": [source["contentHash"]],
                        "catalogContentHash": source["contentHash"]})
        print(f"{pid}: {len(oracle_cases)} oracle inputs; {len(cases)} judge cases; {len(kill)} mutants killed", flush=True)
    batch = "capital-one-next"
    stress_checks = []
    pair_n, pair_q = 200000, 50
    pair_stress = (f"{pair_n} {pair_n} {pair_q}\n" +
                   " ".join(map(str, range(pair_n))) + "\n" +
                   " ".join(map(str, range(pair_n))) + "\n" +
                   (f"1 {pair_n - 1}\n" * pair_q))
    pair_started = time.perf_counter()
    pair_actual = run(OUT / "references/oa-capital-one-6.py", pair_stress)
    pair_elapsed = time.perf_counter() - pair_started
    assert pair_actual == " ".join([str(pair_n)] * pair_q), pair_actual[:100]
    stress_checks.append({"id": "oa-capital-one-6", "inputShape": "a,b 各 200000 个不同值；50 次查询，每次遍历较小频次表",
                          "frequencyIterations": pair_n * pair_q, "expectedOutput": "50 个 200000",
                          "elapsedSeconds": round(pair_elapsed, 3)})

    max_word, recipe_len = 100, 100000
    recipe_stress = (f"{max_word} 1\n" +
                     "\n".join("a" * size for size in range(1, max_word + 1)) + "\n" +
                     "a" * recipe_len + "\n")
    recipe_started = time.perf_counter()
    recipe_actual = run(OUT / "references/oa-capital-one-12.py", recipe_stress)
    recipe_elapsed = time.perf_counter() - recipe_started
    assert recipe_actual == "YES", recipe_actual[:100]
    trie_steps = sum(min(max_word, recipe_len - i) for i in range(recipe_len))
    stress_checks.append({"id": "oa-capital-one-12", "inputShape": "原料为 a 至 a×100；recipe 为 100000 个 a（所有起点均可达）",
                          "trieEdgeChecksUpperBound": trie_steps, "expectedOutput": "YES",
                          "elapsedSeconds": round(recipe_elapsed, 3)})

    (OUT / "candidate-batches" / f"{batch}.json").write_text(
        json.dumps({"schemaVersion": 1, "items": batch_items}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "validation" / f"{batch}.json").write_text(json.dumps(
        {"schemaVersion": 1, "seed": 20261005, "problems": reports, "stressChecks": stress_checks,
         "note": "Local authored-code/oracle/mutant validation only. Not production GoJudge acceptance or publication."},
        ensure_ascii=False, indent=2) + "\n")
    (OUT / "reviews" / f"{batch}.json").write_text(json.dumps(
        {"schemaVersion": 1, "items": reviews}, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
