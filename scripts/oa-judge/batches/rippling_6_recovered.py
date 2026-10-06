#!/usr/bin/env python3
"""Build and locally validate the offline candidate for OAMaster Rippling #6."""

from __future__ import annotations

import hashlib
import itertools
import json
import random
import subprocess
import sys
import time
from collections import deque
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content" / "oa-judge"
IDENT = "oa-rippling-6"
BATCH = "rippling-6-recovered"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/rippling.mdx"
SOURCE_BLOB = "d1a341bf2798e4dc901bcbf151b3e8e1e9e6310d"
SOURCE_SHA256 = "09adeb721c0756e87209f7449d61785e481ab98c2606f41f0e1c8f7c97b19395"
CATALOG_HASH = "f148de21bfbd492ca9dba31e2f08f2928f7ead694fcb3b67f9981421e8dce147"
SOURCE_URL = "https://oamaster.com/docs/companies/rippling#6-maximum-time-required-to-transfer-data"
SEED = 2026100606
MAX_N = 200_000  # Explicit CSWork resource limit; not present in source.

REFERENCE = r'''import sys
from collections import deque

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    graph = [[] for _ in range(n + 1)]
    for _ in range(n - 1):
        u, v = next(it), next(it)
        graph[u].append(v)
        graph[v].append(u)

    def farthest(start):
        distance = [-1] * (n + 1)
        distance[start] = 0
        queue = deque([start])
        best_node = start
        while queue:
            u = queue.popleft()
            for v in graph[u]:
                if distance[v] == -1:
                    distance[v] = distance[u] + 1
                    if distance[v] > distance[best_node]:
                        best_node = v
                    queue.append(v)
        return best_node, distance[best_node]

    endpoint, _ = farthest(1)
    _, diameter = farthest(endpoint)
    return f"{diameter}\n"

if __name__ == "__main__":
    print(solve(sys.stdin.read()), end="")
'''

MUTANT_ROOT_SWEEP = r'''import sys
from collections import deque

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    g = [[] for _ in range(n + 1)]
    for _ in range(n - 1):
        a, b = next(it), next(it)
        g[a].append(b); g[b].append(a)
    d = [-1] * (n + 1); d[1] = 0; q = deque([1])
    while q:
        u = q.popleft()
        for v in g[u]:
            if d[v] < 0:
                d[v] = d[u] + 1; q.append(v)
    return f"{max(d)}\n"

if __name__ == "__main__":
    print(solve(sys.stdin.read()), end="")
'''

MUTANT_DIRECTED = r'''import sys
from collections import deque

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    g = [[] for _ in range(n + 1)]
    for _ in range(n - 1):
        a, b = next(it), next(it)
        g[a].append(b)
    best = 0; q = deque([(1, 0)]); seen = {1}
    while q:
        u, d = q.popleft(); best = max(best, d)
        for v in g[u]:
            if v not in seen:
                seen.add(v); q.append((v, d + 1))
    return f"{best}\n"

if __name__ == "__main__":
    print(solve(sys.stdin.read()), end="")
'''


def encode(n: int, edges: list[tuple[int, int]]) -> str:
    assert n >= 1 and len(edges) == n - 1
    lines = [str(n)]
    lines.extend(f"{u} {v}" for u, v in edges)
    return "\n".join(lines) + "\n"


def reference(raw: str) -> str:
    it = iter(map(int, raw.split()))
    n = next(it)
    graph = [[] for _ in range(n + 1)]
    for _ in range(n - 1):
        u, v = next(it), next(it)
        graph[u].append(v)
        graph[v].append(u)

    def farthest(start: int) -> tuple[int, int]:
        distances = [-1] * (n + 1)
        distances[start] = 0
        queue = deque([start])
        best = start
        while queue:
            u = queue.popleft()
            for v in graph[u]:
                if distances[v] == -1:
                    distances[v] = distances[u] + 1
                    if distances[v] > distances[best]:
                        best = v
                    queue.append(v)
        return best, distances[best]

    endpoint, _ = farthest(1)
    return f"{farthest(endpoint)[1]}\n"


def oracle_all_sources(raw: str) -> str:
    """Independent brute-force oracle: BFS from every vertex."""
    it = iter(map(int, raw.split()))
    n = next(it)
    graph = [[] for _ in range(n + 1)]
    for _ in range(n - 1):
        u, v = next(it), next(it)
        graph[u].append(v)
        graph[v].append(u)
    diameter = 0
    for source in range(1, n + 1):
        distance = [-1] * (n + 1)
        distance[source] = 0
        queue = deque([source])
        while queue:
            u = queue.popleft()
            for v in graph[u]:
                if distance[v] == -1:
                    distance[v] = distance[u] + 1
                    diameter = max(diameter, distance[v])
                    queue.append(v)
    return f"{diameter}\n"


def prufer_tree(n: int, code: tuple[int, ...]) -> list[tuple[int, int]]:
    if n == 1:
        return []
    if n == 2:
        return [(1, 2)]
    degree = [0] + [1] * n
    for x in code:
        degree[x] += 1
    edges: list[tuple[int, int]] = []
    for x in code:
        leaf = next(v for v in range(1, n + 1) if degree[v] == 1)
        edges.append((leaf, x))
        degree[leaf] -= 1
        degree[x] -= 1
    leaves = [v for v in range(1, n + 1) if degree[v] == 1]
    edges.append((leaves[0], leaves[1]))
    return edges


def random_tree(rng: random.Random, n: int) -> list[tuple[int, int]]:
    return [(v, rng.randrange(1, v)) for v in range(2, n + 1)]


def run(program: Path, inputs: list[str], timeout: int = 180) -> list[str]:
    proc = subprocess.run(
        [sys.executable, "-I", str(ROOT / "scripts/oa-judge/local_batch_runner.py"), str(program)],
        input=json.dumps(inputs), text=True, capture_output=True, timeout=timeout,
    )
    assert proc.returncode == 0, proc.stderr[-4000:]
    outputs = json.loads(proc.stdout)
    assert len(outputs) == len(inputs)
    return outputs


def normalized_hash(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def main() -> None:
    # Prove the source evidence still binds to the fixed repository snapshot.
    blob = subprocess.check_output(["git", "rev-parse", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT, text=True).strip()
    source_bytes = subprocess.check_output(["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT)
    assert blob == SOURCE_BLOB
    assert hashlib.sha256(source_bytes).hexdigest() == SOURCE_SHA256
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source_problem = next(p for p in catalog["items"] if p["id"] == IDENT)
    assert source_problem["contentHash"] == CATALOG_HASH
    assert source_problem["sourceUrl"] == SOURCE_URL

    for folder in ("packages", "references", "oracles", "mutants", "negative-controls", "editorials", "source-evidence", "resolutions", "validation", "candidate-batches"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)

    official = [
        (3, [(1, 2), (2, 3)], 2, "官方样例 1"),
        (5, [(1, 5), (1, 3), (1, 2), (5, 4)], 3, "官方样例 2"),
    ]
    manual = [
        (1, [], 0, "单节点树"),
        (2, [(1, 2)], 1, "两个节点"),
        (8, [(1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8)], 2, "星形树"),
        (9, [(i, i + 1) for i in range(1, 9)], 8, "链状树"),
        (7, [(1, 2), (2, 3), (3, 4), (4, 5), (4, 6), (4, 7)], 4, "自建合法树：直径在非根分支"),
        (10, [(1, 2), (2, 3), (3, 4), (4, 5), (1, 6), (6, 7), (7, 8), (8, 9), (9, 10)], 9, "双臂树"),
    ]
    rng = random.Random(SEED)
    random_cases: list[dict[str, str]] = []
    seen: set[str] = set()
    while len(random_cases) < 160:
        n = rng.randint(1, 35)
        edges = random_tree(rng, n)
        rng.shuffle(edges)
        encoded = encode(n, edges)
        if encoded in seen:
            continue
        seen.add(encoded)
        random_cases.append({"input": encoded, "expectedOutput": oracle_all_sources(encoded)})

    # Exhaust all labeled trees through six vertices using Prüfer sequences.
    exhaustive: list[dict[str, str]] = []
    for n in range(1, 7):
        codes = [()] if n <= 2 else itertools.product(range(1, n + 1), repeat=n - 2)
        for code in codes:
            edges = prufer_tree(n, tuple(code))
            raw = encode(n, edges)
            expected = oracle_all_sources(raw)
            assert reference(raw) == expected
            exhaustive.append({"input": raw, "expectedOutput": expected})

    # The full supported path exercises the maximum input size and iterative traversal.
    max_path_edges = [(i, i + 1) for i in range(1, MAX_N)]
    max_path = {"name": "本站最大节点数的链", "input": encode(MAX_N, max_path_edges), "expectedOutput": f"{MAX_N - 1}\n"}
    assert reference(max_path["input"]) == max_path["expectedOutput"]
    max_star_edges = [(1, i) for i in range(2, MAX_N + 1)]
    max_star = encode(MAX_N, max_star_edges)
    assert reference(max_star) == "2\n"

    formal = []
    for n, edges, expected, name in official:
        raw = encode(n, edges)
        assert reference(raw) == f"{expected}\n"
        formal.append({"name": name, "input": raw, "expectedOutput": f"{expected}\n", "hidden": False})
    for n, edges, expected, name in manual:
        raw = encode(n, edges)
        assert reference(raw) == f"{expected}\n"
        formal.append({"name": name, "input": raw, "expectedOutput": f"{expected}\n", "hidden": True})
    for i, case in enumerate(random_cases[:20], 1):
        formal.append({"name": f"随机树 {i}", **case, "hidden": True})
    formal.append({**max_path, "hidden": True})

    # Every oracle item is differentially checked by the authored program.
    oracle_cases = [
        {"input": encode(n, edges), "expectedOutput": f"{expected}\n"}
        for n, edges, expected, _ in official + manual
    ] + random_cases + exhaustive
    for item in oracle_cases:
        assert reference(item["input"]) == item["expectedOutput"], (item["input"], reference(item["input"]), item["expectedOutput"])
    assert len(exhaustive) == 1442

    ref_path = OUT / "references" / f"{IDENT}.py"
    ref_path.write_text(REFERENCE, encoding="utf-8")
    mutant_defs = [
        ("只计算从服务器1出发的最远距离", MUTANT_ROOT_SWEEP),
        ("把无向边误作输入方向的有向边", MUTANT_DIRECTED),
    ]
    for index, (_, code) in enumerate(mutant_defs, 1):
        (OUT / "negative-controls" / f"{IDENT}-{index}.py").write_text(code, encoding="utf-8")
    formal_inputs = [c["input"] for c in formal]
    formal_expected = [c["expectedOutput"] for c in formal]
    ref_outputs = run(ref_path, formal_inputs + [max_star])
    assert [x.split() for x in ref_outputs[:-1]] == [x.split() for x in formal_expected]
    assert ref_outputs[-1].split() == ["2"]
    mutant_records = []
    control_records = []
    for index, (name, code) in enumerate(mutant_defs, 1):
        mutant_path = OUT / "negative-controls" / f"{IDENT}-{index}.py"
        outputs = run(mutant_path, formal_inputs)
        rejected = [i for i, (got, expected) in enumerate(zip(outputs, formal_expected)) if got.split() != expected.split()]
        assert rejected, f"mutant survived: {name}"
        assert all(0 <= index < len(formal) for index in rejected), (name, rejected, len(formal))
        mutant_records.append({"name": name, "code": code})
        control_records.append({"name": name, "rejectedByCases": rejected})

    problem = {
        "id": IDENT,
        "courseId": "gomall",
        "lessonId": "00-overview",
        "title": "Maximum Time Required to Transfer Data",
        "difficulty": "中等",
        "tags": ["OA", "Rippling", "树", "树的直径", "广度优先搜索"],
        "description": "给定一棵由 g_nodes 台服务器和 g_nodes−1 条无向边组成的树。每条边传输数据耗时 1 个单位，求系统中任意两台服务器之间的最大传输时间。\n\n题目来自固定版本 OAMaster Rippling #6。原题没有给出节点数上限；本站为评测资源明确补充 1≤g_nodes≤200000，此上限不是原题约束。固定源第3个样例只给了5条边却声明7个节点，违反树及 g_nodes−1 条边条件；本站不猜测补边，也不将该样例作为评测用例。",
        "input": "第一行 g_nodes（本站执行范围 1≤g_nodes≤200000）；随后 g_nodes−1 行，每行两个整数 u、v（1≤u,v≤g_nodes），表示一条无向边。输入保证这些边构成一棵树。g_nodes=1 时没有边行。",
        "output": "输出任意两台服务器之间的最大传输时间；每条边耗时 1，单节点树输出 0。",
        "explanation": "树上两点的传输时间等于它们之间路径的边数，因此答案是树的直径。先从任意节点遍历找到最远端点，再从该端点遍历一次；第二次得到的最远距离就是直径。",
        "hints": ["树中从任意点最远到达的点是某条直径的端点；从该端点再遍历可得到直径长度。"],
        "timeLimit": 5,
        "memoryLimit": 262144,
        "outputLimit": 1024,
        "checker": "tokens",
        "languages": ["python", "go", "java", "cpp"],
    }
    cases = [{"name": c["name"], "input": c["input"], "expectedOutput": c["expectedOutput"], "hidden": c["hidden"], "weight": 1} for c in formal]
    raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
    validation_js = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(["node", "--max-old-space-size=256", "--import", "tsx", "-e", validation_js], cwd=ROOT, input=json.dumps(raw_package, ensure_ascii=False), text=True, capture_output=True, timeout=90)
    assert normalized.returncode == 0, normalized.stderr[-4000:]
    package = json.loads(normalized.stdout)
    (OUT / "packages" / f"{IDENT}.json").write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "oracles" / f"{IDENT}.json").write_text(json.dumps(oracle_cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "mutants" / f"{IDENT}.json").write_text(json.dumps(mutant_records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    editorial = """## 思路

答案是树的直径。任选一个服务器进行遍历，找出离它最远的服务器 u；再从 u 遍历，所得的最远距离就是树的直径。这里每条边权都是 1，所以用 BFS 即可。采用迭代队列，避免长链导致递归栈溢出。本站的最大节点数 200000 是资源限制，原题未给此上限。

## 正确性

树上任意两点间路径唯一。从任意点出发，最远点必为树某条直径的端点；因此以该端点 u 为起点遍历时，能达到的最大距离恰为全树最大点对距离。两次 BFS 分别计算该距离，故返回值就是任意两台服务器间的最大传输时间。

## 复杂度

每次遍历访问每个节点和边至多一次。两次 BFS 总时间 O(n)，邻接表、队列和距离数组空间 O(n)。
"""
    (OUT / "editorials" / f"{IDENT}.json").write_text(json.dumps({"schemaVersion": 1, "id": IDENT, "title": problem["title"], "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}], "sourceUrl": SOURCE_URL, "sourceContentHash": CATALOG_HASH, "author": "CSWork"}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    checksum = normalized_hash(package)
    item = {"id": IDENT, "sourceContentHash": CATALOG_HASH, "packageChecksum": checksum, "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCE}]}
    (OUT / "candidate-batches" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "items": [item]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "source-evidence" / f"{BATCH}.json").write_text(json.dumps({
        "schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master",
        "commit": COMMIT,
        "pages": [{"company": "rippling", "path": SOURCE_PATH, "gitBlobSha1": SOURCE_BLOB, "rawSha256": SOURCE_SHA256}],
        "items": [{
            "id": IDENT,
            "title": source_problem["title"],
            "sourceUrl": SOURCE_URL,
            "catalogContentHash": CATALOG_HASH,
            "confirmedRules": ["图是 g_nodes 个服务器组成的树", "边数为 g_nodes−1", "g_from[i] 与 g_to[i] 之间为无向边", "每条边传输耗时1", "目标为任意两台服务器之间的最大传输时间", "函数返回整数"],
            "sourceExamplesUsed": ["n=3, edges (1,2),(2,3) → 2", "n=5, edges (1,5),(1,3),(1,2),(5,4) → 3"],
            "malformedSourceExampleExcluded": {"input": "n=7, edges (4,2),(4,7),(2,5),(1,6),(2,3)", "statedOutput": 4, "evidence": "只有5条边，少于题面要求的 g_nodes−1=6；该图不连通。未推测缺失边。"},
            "siteConstructedCase": "另有合法7节点树，边(1,2),(2,3),(3,4),(4,5),(4,6),(4,7)，直径4；标记为本站自建用例，不冒称源题样例。",
            "siteInputLimit": {"range": "1≤g_nodes≤200000", "reason": "固定源没有节点数上限；本站明确新增此资源上限，未声称是原题约束。"},
            "formatAdaptation": "固定源为函数签名；本站以 n 后跟 n−1 对 1-based 端点的标准输入输出包装。",
        }]
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "resolutions" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "items": [{
        "id": IDENT,
        "batch": BATCH,
        "sourceContentHash": CATALOG_HASH,
        "previousReason": "原始页面后续示例/约束未完全审计；“transfer time between connected servers”与最大任意点对距离可算树直径，但需先确认完整题面输入范围。",
        "reason": "已核对固定 e66f809 MDX：树结构、g_nodes−1 条无向单位边、任意点对最大传输时间、函数签名明确；前两个样例合法。固定源第3个样例声明7节点但只给5边，不构成题面要求的树；没有猜缺失边并将其排除。源题未给 g_nodes 上限，题面显式增加本站资源限制 1≤g_nodes≤200000。用独立逐源 BFS oracle 穷举1442棵小树、对160棵固定种子随机树差分；两个正常退出错误程序被正式用例识别；最大规模链和星形树均本地验证。候选仍需正式沙箱验证。",
    }]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "validation" / f"{BATCH}.json").write_text(json.dumps({
        "schemaVersion": 1,
        "seed": SEED,
        "note": "仅本地验证；未连接 GoJudge/服务器。",
        "problems": [{
            "id": IDENT,
            "officialCases": len(official),
            "formalCases": len(formal),
            "oracleCases": len(oracle_cases),
            "exhaustiveLabeledTrees": len(exhaustive),
            "randomCases": len(random_cases),
            "mutants": control_records,
            "negativeControls": control_records,
            "stress": [{"shape": "chain", "n": MAX_N, "expected": MAX_N - 1}, {"shape": "star", "n": MAX_N, "expected": 2}],
            "referenceSha256": hashlib.sha256(REFERENCE.encode()).hexdigest(),
            "packageChecksum": checksum,
            "allLocalChecksPassed": True,
        }]
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({"candidate": IDENT, "formalCases": len(formal), "oracleCases": len(oracle_cases), "exhaustiveTrees": len(exhaustive), "randomTrees": len(random_cases), "mutantsKilled": len(control_records), "maxN": MAX_N, "maxPathInputBytes": len(max_path["input"].encode()), "maxStarInputBytes": len(max_star.encode()), "packageChecksum": checksum}, ensure_ascii=False))


if __name__ == "__main__":
    main()
