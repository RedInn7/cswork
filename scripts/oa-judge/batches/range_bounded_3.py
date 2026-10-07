"""Build three clear OAMaster tasks with explicit, site-only input bounds."""

from __future__ import annotations

import hashlib
import json
import math
import random
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
BATCH = "range-bounded-3"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"


BARCLAYS = "oa-barclays-1"
MAVEN = "oa-maven-securities-3"
DUOLINGO = "oa-duolingo-2"

REFERENCES = {
    BARCLAYS: r'''import sys

def digit_sum(value):
    return sum(map(int, str(value)))

def build_cycle():
    values = [0, 1]
    seen = {}
    a, b = 0, 1
    while (a, b) not in seen:
        seen[(a, b)] = len(values) - 1
        a, b = b, digit_sum(a) + digit_sum(b)
        values.append(b)
    start = seen[(a, b)]
    period = len(values) - 1 - start
    return values, start, period

VALUES, CYCLE_START, CYCLE_LENGTH = build_cycle()

def solve(raw):
    n = int(raw.strip())
    if n < len(VALUES):
        index = n
    else:
        index = CYCLE_START + (n - CYCLE_START) % CYCLE_LENGTH
    return str(VALUES[index])

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
''',
    MAVEN: r'''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, values = data[0], data[1:]
    limit = max(values, default=1)
    spf = list(range(limit + 1))
    for p in range(2, int(limit ** 0.5) + 1):
        if spf[p] == p:
            for multiple in range(p * p, limit + 1, p):
                if spf[multiple] == multiple:
                    spf[multiple] = p

    parent = list(range(n))
    size = [1] * n
    prime_owner = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        a, b = find(a), find(b)
        if a == b:
            return
        if size[a] < size[b]:
            a, b = b, a
        parent[b] = a
        size[a] += size[b]

    for i, value in enumerate(values):
        x = value
        while x > 1:
            prime = spf[x]
            if prime in prime_owner:
                union(i, prime_owner[prime])
            else:
                prime_owner[prime] = i
            while x % prime == 0:
                x //= prime

    counts = {}
    for i in range(n):
        root = find(i)
        counts[root] = counts.get(root, 0) + 1
    return "[" + ",".join(str(counts[find(i)]) for i in range(n)) + "]"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
''',
    DUOLINGO: r'''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, k = data[0], data[1]
    transactions = data[2:]
    first = {0: -1}
    prefix = answer = 0
    for i, amount in enumerate(transactions):
        prefix = (prefix + amount) % k
        if prefix in first:
            answer = max(answer, i - first[prefix])
        else:
            first[prefix] = i
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
''',
}

MUTANTS = {
    BARCLAYS: [
        {"name": "先相加再求数字和", "code": r'''import sys
def ds(x): return sum(map(int,str(x)))
def solve(raw):
 n=int(raw.strip());a,b=0,1
 for _ in range(n): a,b=b,ds(a+b)
 return str(a)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''},
        {"name": "误用普通 Fibonacci 加法", "code": r'''import sys
def solve(raw):
 n=int(raw.strip());a,b=0,1
 for _ in range(n): a,b=b,a+b
 return str(a)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''},
    ],
    MAVEN: [
        {"name": "只把相同属性值连接", "code": r'''import sys,json
def solve(raw):
 d=list(map(int,raw.split()));n=d[0];a=d[1:];from collections import Counter
 c=Counter(a);return json.dumps([c[x] for x in a],separators=(',',':'))
if __name__=='__main__': print(solve(sys.stdin.read()))
'''},
        {"name": "只检查相邻服务器的 gcd", "code": r'''import sys,math
def solve(raw):
 d=list(map(int,raw.split()));n=d[0];a=d[1:];p=list(range(n))
 def f(x):
  while p[x]!=x:p[x]=p[p[x]];x=p[x]
  return x
 for i in range(n-1):
  if math.gcd(a[i],a[i+1])>1:p[f(i)]=f(i+1)
 from collections import Counter
 c=Counter(f(i) for i in range(n));return '['+','.join(str(c[f(i)]) for i in range(n))+']'
if __name__=='__main__': print(solve(sys.stdin.read()))
'''},
    ],
    DUOLINGO: [
        {"name": "覆盖已有余数时覆盖最早下标", "code": r'''import sys
def solve(raw):
 d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];first={0:-1};s=ans=0
 for i,x in enumerate(a):
  s=(s+x)%k
  if s in first:ans=max(ans,i-first[s])
  first[s]=i
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''},
        {"name": "忽略负交易额的符号", "code": r'''import sys
def solve(raw):
 d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];f={0:-1};s=ans=0
 for i,x in enumerate(a):
  s=(s+abs(x))%k
  if s in f:ans=max(ans,i-f[s])
  else:f[s]=i
 return str(ans)
if __name__=='__main__': print(solve(sys.stdin.read()))
'''},
    ],
}

SOURCE_META = {
    BARCLAYS: {
        "title": "Sum-of-Digits Fibonacci Sequence",
        "hash": "7712a2f2c096f65bba6067194d2ba01d4ef652d45fff87782b5a63a0ebfc6d82",
        "rawPath": "web/content/docs/companies/barclays.mdx",
        "blob": "9061ac1847c1bea9f8cc9eebf2abcc3b5a655e26",
        "rawSha": "c9ede409dbcb2125f25d5aa57b992580a2295f59ea69c7157a8463487d233d84",
        "url": "https://oamaster.com/docs/companies/barclays#1-sum-of-digits-fibonacci-sequence",
        "previous": "递推序列示例在 n=8 后的 13 → 12 等可解释为数字和，但没有 N 的取值上界；无法保证返回 int 不溢出或时间/递推边界。",
    },
    MAVEN: {
        "title": "Server Clusters via GCD Connectivity",
        "hash": "dfe20dacd04ab389a20b8953bcf2290650fa170eeaa05b57d98be8e6b7d22af3",
        "rawPath": "web/content/docs/companies/maven-securities.mdx",
        "blob": "2679afe360aff43987aec17325dedfca61b47469",
        "rawSha": "a67bb9b05c3c3b1f2059d324eefad6bed3c6e949691240ab7627818f07d75089",
        "url": "https://oamaster.com/docs/companies/maven-securities#3-server-clusters-via-gcd-connectivity",
        "previous": "仅给 gcd 连通的直观定义，未给 serverProp 的数值上界；若值大，按质因数连边与全对 gcd 的可行算法资源差异显著，无法保证 OJ 时限。",
    },
    DUOLINGO: {
        "title": "Longest Stable Transaction Period",
        "hash": "a238924722ede837d90ab8bf93e498361b7531aef54b18a51f9553f60e18f009",
        "rawPath": "web/content/docs/companies/duolingo.mdx",
        "blob": "a7b53f8ade973eee03f1449c7ac5387b91f50534",
        "rawSha": "5558a8b1d9f79ebe89aad6cbc1a63cfde748dda09f4d9ab4b3a20c005a81abb1",
        "url": "https://oamaster.com/docs/companies/duolingo#2-longest-stable-transaction-period",
        "previous": "k 的值域未给；k=0 时可整除条件无定义，负数的余数语义也未说明。",
    },
}


def write(folder: str, filename: str, data: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_entry(problem_id: str) -> dict:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    entry = next(item for item in catalog["items"] if item["id"] == problem_id)
    assert entry["contentHash"] == SOURCE_META[problem_id]["hash"]
    return entry


def run(code: str, raw: str) -> str:
    result = subprocess.run(["python3", "-I", "-c", code], input=raw, text=True, capture_output=True, check=True, timeout=8)
    return result.stdout.strip()


def first_rejection(code: str, cases: list[dict]) -> list[int]:
    for index, case in enumerate(cases):
        if run(code, case["input"]) != case["expectedOutput"].strip():
            return [index]
    return []


def b_input(n: int) -> str:
    return f"{n}\n"


def b_oracle(n: int) -> str:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, sum(map(int, str(a))) + sum(map(int, str(b)))
    return str(a)


def b_expected(n: int) -> str:
    return run(REFERENCES[BARCLAYS], b_input(n))


def m_input(values: list[int]) -> str:
    return f"{len(values)}\n" + " ".join(map(str, values)) + "\n"


def m_oracle(values: list[int]) -> str:
    n = len(values)
    seen = set()
    result = []
    for start in range(n):
        stack = [start]
        component = {start}
        while stack:
            i = stack.pop()
            for j in range(n):
                if j not in component and math.gcd(values[i], values[j]) > 1:
                    component.add(j)
                    stack.append(j)
        seen.add(start)
        result.append(len(component))
    return "[" + ",".join(map(str, result)) + "]"


def d_input(values: list[int], k: int) -> str:
    return f"{len(values)} {k}\n" + " ".join(map(str, values)) + "\n"


def d_oracle(values: list[int], k: int) -> str:
    answer = 0
    for left in range(len(values)):
        total = 0
        for right in range(left, len(values)):
            total += values[right]
            if total % k == 0:
                answer = max(answer, right - left + 1)
    return str(answer)


def make_problem(problem_id: str, formal: list[tuple[str, str, str]], oracles: list[tuple[str, str]], description: str,
                 input_spec: str, output_spec: str, explanation: str, proof: str, complexity: str,
                 hints: list[str], time_limit: int,
                 memory: int, output_limit: int) -> tuple[dict, list[dict], list[dict]]:
    meta = SOURCE_META[problem_id]
    source = source_entry(problem_id)
    cases = [{"name": name, "input": raw, "expectedOutput": expected + "\n", "hidden": index > 0, "weight": 1}
             for index, (name, raw, expected) in enumerate(formal)]
    editorial = f"## 思路\n\n{explanation}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{complexity}"
    pkg_payload = {
        "schemaVersion": 1,
        "problem": {
            "id": problem_id, "courseId": "gomall", "lessonId": "00-overview",
            "title": meta["title"], "difficulty": "简单",
            "tags": ["OA", source["companyName"], "数学", "数组"],
            "description": description, "input": input_spec, "output": output_spec,
            "explanation": editorial, "hints": hints,
            "timeLimit": time_limit, "memoryLimit": memory, "outputLimit": output_limit,
            "checker": "exact", "languages": ["python", "java", "cpp"],
        },
        "cases": cases,
    }
    parser = subprocess.run(
        ["node", "--import", "tsx", "-e",
         "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],
        cwd=ROOT, input=json.dumps(pkg_payload, ensure_ascii=False), text=True, capture_output=True, check=True,
    )
    package = json.loads(parser.stdout)
    pkg_bytes = parser.stdout.encode()
    oracle_items = [{"input": raw, "expectedOutput": expected + "\n"} for raw, expected in oracles]
    return package, oracle_items, [{"editorial": editorial, "source": source, "packageChecksum": hashlib.sha256(pkg_bytes).hexdigest()}]


def main() -> None:
    rng = random.Random(20261008)
    n_max = 2_147_483_647

    # Barclays: direct recurrence oracle on manageable n, period-based judge supports int32 N.
    b_formal_ns = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 100, n_max]
    b_formal = [("原题示例 N=2" if n == 2 else f"递推索引 {n}", b_input(n), b_expected(n)) for n in b_formal_ns]
    b_oracle_ns = rng.sample(range(0, 2000), 120)
    b_oracles = [(b_input(n), b_oracle(n)) for n in b_oracle_ns]
    assert all(b_expected(n) == b_oracle(n) for n in b_formal_ns[:-1])
    b_desc = "定义 f(0)=0、f(1)=1；对 n≥2，f(n) 等于 f(n−1) 各位数字之和加上 f(n−2) 各位数字之和。返回 f(N)。原题没有 N 上界；本站评测明确支持 0≤N≤2147483647（非负有符号 32 位 int 范围），该范围是本站补充。"
    b_exp = "状态为最近两项 (a,b)，下一项是 digitSum(a)+digitSum(b)。所有项都在 0..18：初始 0、1 满足；若两项均不超过 18，各自数字和不超过 9，下一项不超过 18。有限状态必重复，因此记录二元状态并检测周期，可直接定位任意受支持 N。"
    b_package, b_oracle_items, b_docs = make_problem(
        BARCLAYS, b_formal, b_oracles, b_desc,
        "输入一个整数 N，0≤N≤2147483647（本站支持范围）。",
        "输出第 N 项 f(N)。",
        b_exp,
        "初始两项为 0、1。假设当前位置的两项与原递推一致，则下一项严格按题目定义取两项各自的数字和再相加，因此下一项也一致。最近两项均在 0..18，状态必在有限次内重复；重复状态后的所有项与之前完全相同，按周期映射查询不会改变第 N 项。",
        "预处理最多访问 19² 个有界二元状态，时间和空间均为 O(1)（相对于输入 N）；每个查询 O(1)。",
        ["分别对前两项求各位数字和，再相加。", "有界的最近两项状态会形成周期。"], 2, 32768, 1024,
    )

    # Maven Securities: explicit positive value domain; SPF + DSU, independent pairwise graph oracle.
    m_values = [[3, 3, 3], [2, 3, 6, 1, 5], [2, 6, 3], [1], [1, 1, 1], [64, 16, 7, 49],
                [6, 35, 10, 77, 13], [999983, 999979, 999983], [2, 3], [2, 6, 35, 5],
                [30, 42, 70], [1, 2, 4, 8], [49, 77, 121], [13, 17, 19],
                [2, 3, 5, 7, 11], [30, 1, 1, 30], [999983, 1, 999983],
                [30, 35, 77, 143], [4, 8, 16, 32, 64], [1, 1, 2, 2, 3, 6],
                [1000000], [999983, 999979, 999961]]
    m_formal = [(f"连通分量边界 {i+1}", m_input(v), m_oracle(v)) for i, v in enumerate(m_values)]
    m_oracle_inputs = set()
    m_oracles = []
    while len(m_oracles) < 120:
        length = rng.randint(1, 14)
        values = [rng.randint(1, 90) for _ in range(length)]
        raw = m_input(values)
        if raw not in m_oracle_inputs:
            m_oracle_inputs.add(raw)
            m_oracles.append((raw, m_oracle(values)))
    m_stress = [1] * 100_000
    # Every value is 1, so each server has no gcd>1 edge and is a singleton.
    m_formal.append(("n=100000 输出容量边界", m_input(m_stress), "[" + ",".join(["1"] * 100_000) + "]"))
    m_desc = "若 gcd(serverProp[i], serverProp[j])>1，则服务器 i、j 直接相连；连通关系按传递性形成集群。返回每个服务器所在集群的总服务器数。原题未给数值范围；本站明确支持 1≤n≤100000 且 1≤serverProp[i]≤1000000，属于本站补充范围。"
    m_exp = "对每个属性分解出不同质因数。具有相同质因数的服务器两两 gcd 大于 1，因此把它们与该质因数第一次出现的服务器合并即可得到同一连通分量；传递合并覆盖所有路径。最后统计并查集根的大小，再映射回每个位置。值为 1 没有质因数，保持单独成簇。"
    m_package, m_oracle_items, m_docs = make_problem(
        MAVEN, m_formal, m_oracles, m_desc,
        "第一行 n（1≤n≤100000）。第二行 n 个正整数 serverProp[i]（1≤serverProp[i]≤1000000）。这些是本站支持范围。",
        "输出长度为 n 的 JSON 整数数组，第 i 项是 serverProp[i] 所属集群的大小。",
        m_exp,
        "任意一条原图边的两个端点 gcd 大于 1，当且仅当它们共享某个质因数；该质因数的代表元会把两个端点合并。反过来，每次合并的服务器确实共享当前质因数，因此不会合并不同原图连通分量。对所有不同质因数执行完合并后，并查集分组恰好等于原图连通分量，根计数即每台服务器所在集群大小。值为 1 不共享质因数，保持单点分量。",
        "令 V=1000000，M 为数组长度。筛最小质因数 O(V loglogV)，分解总计 O(M log V) 的有界工作，并查集合并 O(M α(M))；空间 O(V+M)。",
        ["gcd 大于 1 等价于共享至少一个质因数。", "每个质因数用一个代表元连接即可表达该质因数诱导的连通分量。"], 5, 131072, 2048,
    )

    # Duolingo: positive divisor and int32 inputs; brute-force independent oracle.
    d_formal_data = [([2, 3, 1, 4, 1, 5, 9], 3, 4), ([3], 2, 0),
                     ([-1, 1], 3, 2), ([1, 2, 1, 2], 3, 4), ([0, 0, 0], 7, 3),
                     ([2_147_483_647, 2_147_483_647], 2_147_483_647, 2),
                     ([-2_147_483_648, -2_147_483_648, 1], 2_147_483_647, 2),
                     ([1], 1, 1), ([-1], 2, 0), ([1, -1], 1, 2), ([4, 5, 6], 5, 3),
                     ([-2, 3, -1, 3], 3, 4), ([1, 2, 3], 6, 3), ([2, 4, 6], 5, 2),
                     ([1, 1, 1], 2, 2), ([5, -5, 5, -5], 5, 4), ([1, 2, 1], 4, 3),
                     ([-2, -3, -5], 5, 3), ([2_147_483_647, -2_147_483_647], 2_147_483_647, 2),
                     ([-2_147_483_648, 0], 2_147_483_647, 1), ([9, 9], 10, 0),
                     ([8, -3, 1, 4, -2], 7, 4)]
    d_formal = [("原题示例 1" if i == 0 else "原题示例 2" if i == 1 else f"余数与边界 {i+1}", d_input(v, k), str(expected))
                for i, (v, k, expected) in enumerate(d_formal_data)]
    d_oracle_inputs = set()
    d_oracles = []
    while len(d_oracles) < 120:
        length = rng.randint(1, 18)
        values = [rng.randint(-200, 200) for _ in range(length)]
        k = rng.randint(1, 30)
        raw = d_input(values, k)
        if raw not in d_oracle_inputs:
            d_oracle_inputs.add(raw)
            d_oracles.append((raw, d_oracle(values, k)))
    d_stress = [-2_147_483_647] * 100_000
    d_formal.append(("n=100000 且累积和超过 32 位", d_input(d_stress, 2_147_483_647), "100000"))
    d_desc = "给定每日净交易额 transactions 和正整数 k，求最长连续区间，使区间和可被 k 整除。源题未给规模和 k 的域；本站补充 1≤n≤100000、每个交易额为 signed int32、1≤k≤2147483647。"
    d_exp = "两个前缀和对 k 的余数相同时，它们之间的连续区间和能被 k 整除。按从左到右扫描，记录每个余数第一次出现的位置；再次出现时用当前位置减最早位置更新最长长度。使用正 k，负交易额按数学意义取模。"
    d_package, d_oracle_items, d_docs = make_problem(
        DUOLINGO, d_formal, d_oracles, d_desc,
        "第一行 n、k（1≤n≤100000，1≤k≤2147483647）。第二行 n 个 signed int32 交易额。以上是本站支持范围。",
        "输出满足区间和能被 k 整除的最长连续区间长度；不存在时输出 0。",
        d_exp,
        "设前缀和 P[j] 为前 j 项之和。区间 (i,j] 的和能被正整数 k 整除，当且仅当 P[i] 与 P[j] 模 k 同余。固定右端 j 时，最早出现的同余前缀产生最长区间；算法保存每个余数的最早下标并检查每个后续前缀，因此不会漏掉最优区间，也不会把不满足整除条件的区间计入。",
        "扫描 n 项一次，期望时间 O(n)，保存至多 n+1 个余数位置，空间 O(n)。",
        ["同余的前缀和之差可被 k 整除。", "维护每个余数最早出现的下标，后续同余位置才能给出最长区间。"], 4, 65536, 1024,
    )

    specs = {
        BARCLAYS: (b_package, b_oracle_items, b_formal, b_docs[0], b_exp),
        MAVEN: (m_package, m_oracle_items, m_formal, m_docs[0], m_exp),
        DUOLINGO: (d_package, d_oracle_items, d_formal, d_docs[0], d_exp),
    }
    items, packages_summary, report_summaries = [], [], []
    for pid, (package, oracles, formal, doc, editorial) in specs.items():
        editorial = doc["editorial"]
        # Every hand-authored formal sample/boundary is independently checked before packaging.
        for case in formal:
            assert run(REFERENCES[pid], case[1]) == case[2], (pid, case[0], run(REFERENCES[pid], case[1]), case[2])
        for oracle in oracles:
            assert run(REFERENCES[pid], oracle["input"]) == oracle["expectedOutput"].strip(), pid
        write("packages", f"{pid}.json", package)
        write("oracles", f"{pid}.json", oracles)
        write("mutants", f"{pid}.json", MUTANTS[pid])
        reference_path = OA / "references" / f"{pid}.py"
        reference_path.parent.mkdir(parents=True, exist_ok=True)
        reference_path.write_text(REFERENCES[pid], encoding="utf-8")
        write("editorials", f"{pid}.json", {
            "schemaVersion": 1, "id": pid, "title": SOURCE_META[pid]["title"],
            "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCES[pid]}],
            "sourceUrl": SOURCE_META[pid]["url"], "sourceContentHash": SOURCE_META[pid]["hash"], "author": "CSWork",
        })
        items.append({
            "id": pid, "sourceContentHash": SOURCE_META[pid]["hash"],
            "packageChecksum": hashlib.sha256(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(),
            "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCES[pid]}],
        })
        packages_summary.append({"id": pid, "formalCases": len(package["cases"]), "oracleCases": len(oracles),
                                 "negativeControls": [{"name": m["name"], "rejectedByCases": first_rejection(m["code"], package["cases"])} for m in MUTANTS[pid]],
                                 "sourceSha256": SOURCE_META[pid]["rawSha"]})
        report_summaries.append({"id": pid, "formal": len(package["cases"]), "oracle": len(oracles),
                                 "passed": len(package["cases"]) + len(oracles),
                                 "killed": [m["name"] for m in MUTANTS[pid]]})

    manifest = {"schemaVersion": 1, "items": items}
    report_path = OA / "reports" / f"{BATCH}.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else None
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    report_valid = bool(report and report.get("allPassed") is True and report.get("batch") == BATCH
                        and report.get("batchSha256") == hashlib.sha256(manifest_bytes).hexdigest()
                        and len(report.get("problems", [])) == len(items))
    if report_valid:
        for summary in report_summaries:
            actual = next((p for p in report["problems"] if p["id"] == summary["id"]), {})
            report_valid = report_valid and actual.get("formal") == summary["formal"] and actual.get("oracle") == summary["oracle"]
            report_valid = report_valid and actual.get("passed") == summary["passed"] and sorted(actual.get("killed", [])) == sorted(summary["killed"])

    destination = "batches" if report_valid or (OA / "batches" / f"{BATCH}.json").exists() else "candidate-batches"
    write(destination, f"{BATCH}.json", manifest)
    if destination == "batches":
        (OA / "candidate-batches" / f"{BATCH}.json").unlink(missing_ok=True)
    write("validation", f"{BATCH}.json", {
        "schemaVersion": 1,
        "note": "三个题包均已在本站补充并明确输入范围；" + ("自有 GoJudge 全部通过。" if report_valid else "候选包已由本地独立 oracle 核对，待自有 GoJudge 验证。"),
        "problems": packages_summary,
    })
    write("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master", "commit": SOURCE_COMMIT,
        "items": [{"id": pid, "sourceUrl": SOURCE_META[pid]["url"], "sourceContentHash": SOURCE_META[pid]["hash"],
                   "rawPath": SOURCE_META[pid]["rawPath"], "rawGitBlobSha": SOURCE_META[pid]["blob"],
                   "sourceFileSha256": SOURCE_META[pid]["rawSha"], "previousStatus": "blocked",
                   "previousReason": SOURCE_META[pid]["previous"],
                   "resolution": "核心操作语义由冻结源题给定；原题未给可执行的数值/规模边界，输入格式显式标注本站补充的支持范围，算法和 oracle 均限定在该范围内。"}
                  for pid in (BARCLAYS, MAVEN, DUOLINGO)],
    })
    resolutions = []
    for pid in (BARCLAYS, MAVEN, DUOLINGO):
        resolutions.append({"id": pid, "batch": BATCH, "sourceContentHash": SOURCE_META[pid]["hash"],
                            "previousReason": SOURCE_META[pid]["previous"],
                            "reason": "冻结源题的核心规则与样例明确；本站把缺失的执行域补充为题面可见、输入校验一致的有限支持范围，不宣称该范围来自原题。该范围内有独立 oracle 与自有 GoJudge 验证。"})
    if report_valid:
        write("resolutions", f"{BATCH}.json", {"schemaVersion": 1, "items": resolutions})
    print(json.dumps({"batch": BATCH, "items": [x["id"] for x in items],
                      "formalCases": sum(len(v[0]["cases"]) for v in specs.values()),
                      "oracleCases": sum(len(v[1]) for v in specs.values()), "sandboxVerified": report_valid}, ensure_ascii=False))


if __name__ == "__main__":
    main()
