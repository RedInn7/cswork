#!/usr/bin/env python3
"""Generate and locally validate an isolated candidate for Palantir #4."""

from __future__ import annotations

import hashlib
import heapq
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
REVIEW = OA / "reviews" / "palantir-next.json"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "fastprep/Palantir/palantir-minimize-path-value.md"
RAW_BLOB = "fb4121843016a86977144abbde2c01547111d412"
RAW_SHA256 = "45589460c8313a29068894ef7c4e816d657c1430bc0c3290543c280f77a22351"
CONTENT_HASH = "5e6534b95f7ca1b58f39205a4ef20d831132be99f1fc71410bc00081497151ed"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw: dict) -> str:
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT,
                          input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout


REFERENCE = r'''import heapq
import sys

def minimize_path_value(n, edges, source, destination):
    if source == destination:
        return 0
    graph = [[] for _ in range(n + 1)]
    for u, v, weight in edges:
        graph[u].append((v, weight))
        graph[v].append((u, weight))
    infinity = 10**30
    best = [infinity] * (n + 1)
    best[source] = 0
    heap = [(0, source)]
    while heap:
        stress, u = heapq.heappop(heap)
        if stress != best[u]:
            continue
        if u == destination:
            return stress
        for v, weight in graph[u]:
            candidate = max(stress, weight)
            if candidate < best[v]:
                best[v] = candidate
                heapq.heappush(heap, (candidate, v))
    return -1

def solve(raw):
    tokens = list(map(int, raw.split()))
    if len(tokens) < 4:
        raise ValueError("incomplete graph input")
    n, m = tokens[0], tokens[1]
    if len(tokens) != 2 + 3 * m + 2:
        raise ValueError("edge count does not match input")
    edges = []
    pos = 2
    for _ in range(m):
        edges.append((tokens[pos], tokens[pos + 1], tokens[pos + 2]))
        pos += 3
    return str(minimize_path_value(n, edges, tokens[pos], tokens[pos + 1]))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read()))
'''


def encode(n: int, edges: list[tuple[int, int, int]], source: int, destination: int) -> str:
    lines = [f"{n} {len(edges)}"]
    lines.extend(f"{u} {v} {w}" for u, v, w in edges)
    lines.append(f"{source} {destination}")
    return "\n".join(lines) + "\n"


def run(code: str, raw: str, timeout: int = 10) -> str:
    with tempfile.TemporaryDirectory(prefix="palantir4-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=timeout, check=True)
        return proc.stdout.decode("ascii").strip()


def oracle(n: int, edges: list[tuple[int, int, int]], source: int, destination: int) -> str:
    if source == destination:
        return "0"
    graph = [[] for _ in range(n + 1)]
    for u, v, w in edges:
        graph[u].append((v, w))
        graph[v].append((u, w))
    answer = None
    stack = [(source, {source}, 0)]
    while stack:
        u, visited, maximum = stack.pop()
        for v, w in graph[u]:
            if v == destination:
                value = max(maximum, w)
                answer = value if answer is None else min(answer, value)
            elif v not in visited:
                stack.append((v, visited | {v}, max(maximum, w)))
    return str(answer if answer is not None else -1)


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-palantir-4", "palantir-4-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    formal = [
        (4, [(1, 2, 100), (2, 3, 200), (1, 4, 10), (4, 3, 20)], 1, 3, "原题样例"),
        (3, [(1, 2, 8), (1, 3, 5), (3, 2, 5)], 1, 2, "最小最大边与最小边权和路径不同"),
        (2, [(1, 2, 7)], 2, 1, "无向边可反向通行"),
        (4, [(1, 2, 3), (3, 4, 1)], 1, 4, "不可达返回 -1"),
        (1, [], 1, 1, "单节点起终点相同"),
        (4, [(1, 2, 4), (2, 3, 4), (3, 4, 4), (1, 4, 9)], 1, 4, "重复边权"),
        (3, [(1, 2, 1_000_000_000), (2, 3, 1_000_000_000)], 1, 3, "本站权值上界"),
        (4, [(1, 2, 0), (2, 4, 9), (1, 3, 4), (3, 4, 4)], 1, 4, "零权边参与更优瓶颈路径"),
        (5, [(1, 2, 7), (2, 3, 2), (3, 5, 7), (1, 4, 7), (4, 5, 7)], 1, 5, "多个路径具有同一最优瓶颈"),
        (4, [(1, 2, 3), (2, 3, 3), (3, 4, 3), (1, 4, 3)], 1, 4, "瓶颈权重相同的直达和多跳"),
        (4, [(1, 2, 100), (2, 3, 1), (3, 4, 1), (1, 4, 8)], 1, 4, "低和路径不如较低最大边路径"),
        (5, [(1, 2, 2), (2, 3, 8), (3, 5, 2), (1, 4, 5), (4, 5, 5)], 1, 5, "优先降低最大边而非路径长度"),
        (4, [(1, 2, 6), (2, 3, 6), (3, 4, 6), (1, 4, 10)], 1, 4, "多条等瓶颈路径"),
        (3, [(1, 2, 0), (2, 3, 0), (1, 3, 1)], 1, 3, "最优瓶颈为零"),
        (5, [(1, 2, 10), (1, 3, 4), (3, 4, 4), (4, 5, 4), (2, 5, 10)], 1, 5, "较短两边路径的瓶颈高于较长路径"),
        (5, [(1, 2, 3), (2, 3, 11), (3, 5, 3), (1, 4, 7), (4, 5, 7)], 1, 5, "选择三边路径降低最大权重"),
        (6, [(1, 2, 20), (2, 3, 1), (3, 6, 1), (1, 4, 8), (4, 5, 8), (5, 6, 8)], 1, 6, "比较高单边与多边中瓶颈"),
        (5, [(1, 2, 4), (2, 5, 4), (1, 3, 4), (3, 4, 1), (4, 5, 4)], 1, 5, "重复最优边权的不同路线"),
        (4, [(1, 2, 5), (2, 3, 12), (3, 4, 5), (1, 4, 8), (2, 4, 7)], 1, 4, "中间节点提供瓶颈更低的捷径"),
        (5, [(1, 2, 6), (2, 3, 2), (3, 4, 6), (4, 5, 2), (1, 5, 9)], 1, 5, "交替权值链的最优值"),
        (6, [(1, 2, 1), (2, 3, 15), (3, 6, 1), (1, 4, 8), (4, 5, 8), (5, 6, 8)], 1, 6, "较长的绕行路线降低瓶颈"),
    ]
    cases = []
    for i, (n, edges, start, target, name) in enumerate(formal):
        raw = encode(n, edges, start, target)
        expected = oracle(n, edges, start, target)
        assert run(REFERENCE, raw) == expected
        cases.append({"name": name, "input": raw, "expectedOutput": expected + "\n",
                      "hidden": i != 0, "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    while len(random_cases) < 160:
        n = rng.randint(2, 8)
        pairs = [(u, v) for u in range(1, n + 1) for v in range(u + 1, n + 1)]
        rng.shuffle(pairs)
        edges = [(u, v, rng.randint(0, 50)) for u, v in pairs[:rng.randint(0, len(pairs))]]
        start, target = rng.sample(range(1, n + 1), 2)
        raw = encode(n, edges, start, target)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(n, edges, start, target)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    additive_mutant = REFERENCE.replace(
        "candidate = max(stress, weight)", "candidate = stress + weight")
    directed_mutant = REFERENCE.replace(
        "        graph[v].append((u, weight))\n", "")
    mutants = [
        ("按路径边权总和而不是最大边权优化", additive_mutant),
        ("错误地把无向图当成有向图", directed_mutant),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for i, (n, edges, start, target, _) in enumerate(formal):
            if run(code, encode(n, edges, start, target)) != oracle(n, edges, start, target):
                rejected.append(i)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    stress_n = 5_000
    stress_edges = [(i, i + 1, i % 997 + 1) for i in range(1, stress_n)]
    stress_edges.extend((1, i, 998) for i in range(3, stress_n + 1, 2))
    stress_input = encode(stress_n, stress_edges, 1, stress_n)
    stress_output = run(REFERENCE, stress_input, timeout=20)
    assert stress_output == "997"

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Minimize Path Value", "difficulty": "中等",
        "tags": ["OA", "Palantir", "图论", "最小瓶颈路径", "Dijkstra"],
        "description": "给定一个带权无向图、起点 source 和终点 destination。路径的 stress level 是路径上边权的最大值；请找出 stress level 最小的路径。若两点不连通，返回 -1。若 source=destination，按三种固定源实现返回 0。",
        "input": "第一行 N M；接下来 M 行各为 u v w；最后一行 source destination。节点编号为 1..N。本站补充约束：1≤N≤5000，0≤M≤20000，1≤u,v,source,destination≤N，0≤w≤10^9。题源 Constraints 是损坏占位符，以上规模及非负权域为本站明示边界；没有额外要求图连通，允许平行边和自环。",
        "output": "输出一个整数：最小可能的路径最大边权；若不可达输出 -1。source=destination 时输出 0。",
        "explanation": "在图上维护从 source 出发的最小瓶颈值。扩展 u→v 时，新路径的 stress 为 max(当前 stress, w)。使用优先队列，每次确定当前瓶颈值最小的节点。",
        "hints": ["将路径状态定义为到达节点时的最小可能最大边权，而不是路径长度。"],
        "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n使用 Dijkstra 风格的优先队列，但路径代价不是边权和。令 `best[v]` 为从 source 到 v 的最小瓶颈值。沿权重 w 的边扩展时，候选值是 `max(best[u], w)`；若更小就更新。\n\n"
        "## 正确性\n\n任意到 v 的路径扩展一条边 w 后，其瓶颈恰为 `max(原路径瓶颈,w)`。优先队列每次取出当前瓶颈最小的未定状态；由于扩展函数对路径瓶颈单调不减，之后经过其它节点不可能找到更小状态，因此更新规则得到每个可达点的最优瓶颈。无向邻接表保证两方向可通行；未到达 destination 则不可达。\n\n"
        "## 复杂度\n\n时间 O((N+M) log N)，空间 O(N+M)。"
    )
    write_json(OA / "packages" / f"{identifier}.json", package)
    (OA / "references" / f"{identifier}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", random_cases)
    write_json(OA / "mutants" / f"{identifier}.json", [{"name": name, "code": code} for name, code in mutants])
    write_json(OA / "editorials" / f"{identifier}.json", {"schemaVersion": 1, "id": identifier,
        "title": problem["title"], "explanation": editorial,
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"})
    write_json(OA / "candidate-batches" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
        "editorial": editorial, "authoredSolutions": [{"language": "python", "code": reference}],
    }]})
    write_json(OA / "source-evidence" / f"{batch}.json", {"schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master", "commit": COMMIT, "origin": "https://oamaster.com",
        "items": [{"id": identifier, "sourceUrl": source["sourceUrl"], "catalogContentHash": source["contentHash"],
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [10, 48]}],
            "resolvedSemantics": {
                "objective": "Minimize the maximum edge weight along a path in an undirected weighted graph, exactly as stated in the source.",
                "nodeIndexing": "The sample uses nodes 1..N and each of the three source implementations allocates arrays of size N+1; candidate uses 1-based IDs.",
                "sourceDestinationEqual": "All three source implementations initialize dist[source]=0 and return that value immediately when source is destination; candidate makes this explicit.",
                "siteConstraints": "The original Constraints contains only a damaged placeholder. Candidate adds N<=5000, M<=20000, 1<=node IDs<=N, and 0<=w<=1e9. Nonnegative weights define the site-supported domain; graph connectivity is not assumed."
            }}]})
    review_items = json.loads(REVIEW.read_text(encoding="utf-8"))["items"]
    review_reason = next(item["reason"] for item in review_items if item["id"] == identifier)
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": review_reason,
        "reason": "源题对目标函数、无向图与不可达返回值的定义完整；固定快照中的 Python/Java/C++ 三份实现和样例相互一致。题源约束损坏为占位符，因此本站明确增加 1-based 节点编号、N/M 上限和非负边权范围；不增加连通性假设。有限非负权域与源代码使用的整数 Dijkstra 保持一致。独立小图简单路径枚举 oracle、边界和两个正常退出 mutant 验证通过。"
    }]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(seen) - len(cases), "negativeControls": controls,
            "stressN": stress_n, "stressM": len(stress_edges), "stressOutput": stress_output}],
        "note": "本地独立简单路径枚举 oracle、source=destination/不可达/重复权边界和两个正常退出 mutant 验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, unique oracle={len(random_cases)}, mutants={len(controls)} killed, stress={stress_n}/{len(stress_edges)}")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    build(catalog, random.Random(20261006))


if __name__ == "__main__":
    main()
