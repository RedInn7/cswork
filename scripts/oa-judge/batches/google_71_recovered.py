"""Create a source-bound, directed-graph candidate for Google OA #71."""

from __future__ import annotations

import hashlib
import heapq
import json
from pathlib import Path
import random
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-71"
BATCH = "google-71-directed-path"
SEED = 20261006
SOURCE_URL = "https://oamaster.com/docs/companies/google#71-shortest-path-with-mandatory-waypoint"
SUPPORT_URL = "https://www.fastprep.io/problems/google-shortest-path-with-mandatory-waypoint"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"

REFERENCE = r'''import heapq
import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) < 2:
        raise ValueError("expected n and m")
    n, m = values[:2]
    if not (1 <= n <= 200_000 and 0 <= m <= 300_000) or len(values) != 2 + 3*m + 3:
        raise ValueError("input size does not match the supported constraints")
    graph = [[] for _ in range(n)]
    at = 2
    for _ in range(m):
        u, v, w = values[at:at+3]
        at += 3
        if not (0 <= u < n and 0 <= v < n and 0 <= w <= 1_000_000_000):
            raise ValueError("invalid directed edge")
        graph[u].append((v, w))
    start, target, waypoint = values[at:at+3]
    if any(not 0 <= x < n for x in (start, target, waypoint)):
        raise ValueError("node outside graph")

    inf = 10**30
    def dijkstra(source):
        dist = [inf] * n
        dist[source] = 0
        queue = [(0, source)]
        while queue:
            cost, u = heapq.heappop(queue)
            if cost != dist[u]:
                continue
            for v, weight in graph[u]:
                candidate = cost + weight
                if candidate < dist[v]:
                    dist[v] = candidate
                    heapq.heappush(queue, (candidate, v))
        return dist

    from_start = dijkstra(start)
    from_waypoint = dijkstra(waypoint)
    direct = from_start[target]
    via = from_start[waypoint] + from_waypoint[target]
    if from_start[waypoint] == inf or from_waypoint[target] == inf:
        via = -1
    return f"{direct if direct != inf else -1} {via}"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    ("把有向边误当作无向边", r'''import heapq,sys
x=list(map(int,sys.stdin.read().split()));n,m=x[:2];g=[[]for _ in range(n)];p=2
for _ in range(m):u,v,w=x[p:p+3];p+=3;g[u].append((v,w));g[v].append((u,w))
s,t,z=x[p:p+3]
def d(a):
 q=[(0,a)];r=[10**30]*n;r[a]=0
 while q:
  c,u=heapq.heappop(q)
  if c!=r[u]:continue
  for v,w in g[u]:
   if c+w<r[v]:r[v]=c+w;heapq.heappush(q,(r[v],v))
 return r
a=d(s);b=d(z);print(a[t] if a[t]<10**30 else -1, a[z]+b[t] if a[z]<10**30 and b[t]<10**30 else -1)
'''),
    ("错误地要求途经路线不能重访节点", r'''import heapq,sys
x=list(map(int,sys.stdin.read().split()));n,m=x[:2];g=[[]for _ in range(n)];p=2
for _ in range(m):u,v,w=x[p:p+3];p+=3;g[u].append((v,w))
s,t,z=x[p:p+3]
def d(a,b):
 q=[(0,a)];r=[10**30]*n;r[a]=0
 while q:
  c,u=heapq.heappop(q)
  if c!=r[u]:continue
  for v,w in g[u]:
   if c+w<r[v]:r[v]=c+w;heapq.heappush(q,(c+w,v))
 return r[b] if r[b]<10**30 else -1
best=d(s,t); via=10**30
def dfs(u,cost,seen,hit):
 global via
 if cost>=via:return
 if u==t:
  if hit:via=cost
  return
 for v,w in g[u]:
  if v not in seen:dfs(v,cost+w,seen|{v},hit or v==z)
dfs(s,0,{s},s==z)
print(best,-1 if via==10**30 else via)
'''),
]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(folder: str, filename: str, value: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def oracle(n: int, edges: list[tuple[int, int, int]], start: int, target: int, waypoint: int) -> tuple[int, int]:
    inf = 10**30
    dist = [[inf] * n for _ in range(n)]
    for i in range(n):
        dist[i][i] = 0
    for u, v, w in edges:
        dist[u][v] = min(dist[u][v], w)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
    direct = dist[start][target]
    via = dist[start][waypoint] + dist[waypoint][target]
    return (-1 if direct == inf else direct, -1 if via >= inf else via)


def encode(n: int, edges: list[tuple[int, int, int]], start: int, target: int, waypoint: int) -> str:
    rows = [f"{n} {len(edges)}", *(f"{u} {v} {w}" for u, v, w in edges), f"{start} {target} {waypoint}"]
    return "\n".join(rows) + "\n"


def run(program: str, data: str) -> str:
    result = subprocess.run(["python3", "-c", program], input=data, text=True, capture_output=True, timeout=5)
    if result.returncode:
        raise AssertionError((result.returncode, result.stderr[:300], data[:300]))
    return " ".join(result.stdout.split())


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    reviews = json.loads((OA / "reviews/google-tail.json").read_text(encoding="utf-8"))
    previous = next(item for item in reviews["items"] if item["id"] == PID)

    fixtures: list[tuple[str, int, list[tuple[int, int, int]], int, int, int]] = [
        ("原题示例一", 5, [(0,1,2),(1,2,3),(0,3,10),(2,4,1),(3,4,2),(1,3,2)], 0, 4, 1),
        ("原题示例二", 4, [(0,1,1),(1,3,1),(0,2,1)], 0, 3, 2),
        ("途经点需要重访起点", 4, [(0,2,1),(2,0,1),(0,1,1),(1,3,1)], 0, 3, 2),
        ("距离超过32位整数", 4, [(0,1,1_000_000_000),(1,2,1_000_000_000),(2,3,1_000_000_000)], 0, 3, 2),
        ("起点终点相同", 3, [(0,1,4),(1,2,5)], 0, 0, 2),
        ("零权重边与同点途经", 3, [(0,1,0),(1,2,0),(0,2,3)], 0, 2, 0),
        ("空图", 1, [], 0, 0, 0),
    ]
    rng = random.Random(SEED)
    random_cases = []
    for _ in range(220):
        n = rng.randint(2, 8)
        edges = [(u, v, rng.randint(0, 30)) for u in range(n) for v in range(n) if u != v and rng.random() < 0.22]
        random_cases.append((f"随机小图 {len(random_cases)+1}", n, edges, rng.randrange(n), rng.randrange(n), rng.randrange(n)))
    all_cases = fixtures + random_cases
    tests = []
    for name, n, edges, start, target, waypoint in all_cases:
        data = encode(n, edges, start, target, waypoint)
        expected = " ".join(map(str, oracle(n, edges, start, target, waypoint)))
        if run(REFERENCE, data) != expected:
            raise AssertionError((name, data, expected, run(REFERENCE, data)))
        tests.append((name, data, expected))

    witnesses = []
    for name, mutant in MUTANTS:
        witness = next((case for case in tests if run(mutant, case[1]) != case[2]), None)
        if witness is None:
            raise AssertionError(f"surviving mutant: {name}")
        witnesses.append((name, witness[0]))

    formal = [tests[i] for i in range(len(fixtures))]
    formal += [tests[len(fixtures) + i] for i in range(18)]
    for _, witness_name in witnesses:
        found = next(case for case in tests if case[0] == witness_name)
        if found not in formal:
            formal.append(found)
    cases = [{"name": name, "input": data, "expectedOutput": expected + "\n", "hidden": not name.startswith("原题示例"), "weight": 1}
             for name, data, expected in formal]
    formal_names = {name: index for index, (name, _, _) in enumerate(formal)}
    controls = [{"name": name, "rejectedByCases": [formal_names[witness]]} for name, witness in witnesses]

    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview", "title": "带必经点的最短路径",
        "difficulty": "中等", "tags": ["OA", "Google", "图论", "最短路"],
        "description": "给定 n 个点的带权有向图，边 [u,v,w] 表示从 u 到 v 的单向边，权重非负。输出 start 到 target 的最短距离，以及必须经过 waypoint 的最短路线距离；不存在时对应输出 -1。途经 waypoint 的路线允许重复经过节点和边。\n\n本站补充：输入按 0 开始编号；路线是 walk，因此可在去 waypoint 或离开 waypoint 的路径段中重访节点；距离使用 64 位整数。原快照的三语代码将边反向也加入图中，与其第二个样例矛盾；本站依据相同函数签名、样例及约束的有向图版本修正为单向边。",
        "input": "第一行 n m；接着 m 行每行 u v w；最后一行 start target waypoint。",
        "output": "输出两个整数：最短距离和经过 waypoint 的最短距离；若无解则对应值为 -1。",
        "explanation": "分别在原有向图上从 start 和 waypoint 运行 Dijkstra。第一项取 start 到 target；第二项取 start 到 waypoint 再加 waypoint 到 target。因为边权非负，最优受限路线可由两段最短路拼接；路线允许重访节点。",
        "hints": ["边是单向的，不要自动添加反向边。", "经过 waypoint 的路线可以重访顶点。", "最大答案可能超过 32 位整数，请使用 64 位距离。"],
        "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096, "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    package_input = {"schemaVersion": 1, "problem": problem, "cases": cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    parsed = subprocess.run(["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
                            input=json.dumps(package_input, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    package = json.loads(parsed)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()

    editorial = f"""## 思路

将每条边严格按 `u→v` 加入图。分别从 `start` 和 `waypoint` 运行 Dijkstra，得到 `dist(start,target)` 与 `dist(start,waypoint)+dist(waypoint,target)`；任一必要路段不可达时输出 -1。使用 64 位整数。

## 正确性

任意经过 waypoint 的路线都可拆成 start→waypoint 与 waypoint→target 两段，所以其长度至少为两段最短距离之和；拼接这两段最短路可得到合法路线，且题面允许重访节点。因此该和恰是受限最短距离。另一项由一次从 start 的 Dijkstra 得到。

## 复杂度

两次 Dijkstra，时间 O((n+m)log n)，空间 O(n+m)。

## 来源与本站补充

OAMaster 原题快照：{SOURCE_URL}（指纹 `{source['contentHash']}`）。其正文标注无向边，但示例二 `[2,-1]` 与三语代码“为每条边添加反向边”矛盾：按无向图可从 `2→0→1→3` 到达 target。相同函数签名、样例、约束的外部版本明确规定有向边并给出同样两个答案：{SUPPORT_URL}。因此本站按有向图解释并移除反向边；允许路线重访节点是本站明确补充，便于精确定义“路线”而非简单路径。本站将返回距离保存为64位，以覆盖原约束下的大权重路径。第三方版本的 `int[]` 返回签名不适用于最大约束，本站数据流使用 64 位结果。
"""
    manifest = {"schemaVersion": 1, "items": [{"id": PID, "sourceContentHash": source["contentHash"], "packageChecksum": sha(package_bytes),
        "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCE}]}]}
    report_path = OA / "reports" / (BATCH + ".json")
    manifest_folder = "batches" if report_path.exists() else "candidate-batches"
    put(manifest_folder, BATCH + ".json", manifest)
    if manifest_folder == "batches": (OA / "candidate-batches" / (BATCH + ".json")).unlink(missing_ok=True)
    put("packages", PID + ".json", package)
    (OA / "references" / (PID + ".py")).write_text(REFERENCE, encoding="utf-8")
    put("editorials", PID + ".json", {"schemaVersion": 1, "id": PID, "title": problem["title"], "explanation": editorial,
        "solutions": [{"language": "python", "code": REFERENCE}], "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"]})
    put("oracles", PID + ".json", [{"input": data, "expectedOutput": expected + "\n"} for _, data, expected in tests])
    put("mutants", PID + ".json", [{"name": name, "code": code} for name, code in MUTANTS])
    put("source-evidence", BATCH + ".json", {"schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master", "commit": UPSTREAM_COMMIT,
        "catalogContentHash": source["contentHash"], "items": [{"id": PID, "company": "Google", "title": source["title"], "sourceUrl": SOURCE_URL,
        "fixedSource": {"path": "web/content/docs/companies/google.mdx", "evidence": "原题题面、两组样例以及与样例二冲突的三语双向加边实现；不能将原快照描述为有向图实现。"},
        "supportingSources": [{"url": SUPPORT_URL, "evidence": "对应函数签名、两个样例与约束；题面明确每条边为有向边。"}],
        "siteAdditions": ["路线按 walk 定义，可重复访问节点和边。", "答案使用64位整数以覆盖题面最大约束。"],
        "interpretation": "按同题外部版本与原样例，将图定义为有向非负权图；途经点路线由两段最短路拼接。"}]})
    has_report = report_path.exists()
    reason = "原题三语实现把边反向加入图，与原题示例二的 -1 冲突；相同签名、样例、约束的对应版本明确为有向图。本站采用有向边、walk可重访规则，使用Floyd-Warshall独立oracle、随机小图和区分错误边方向/简单路径的反例验证。"
    if has_report: reason += " 用户自有 GoJudge 沙箱验证通过。"
    put("resolutions", BATCH + ".json", {"schemaVersion": 1, "items": [{"id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"], "previousReason": previous["reason"], "reason": reason}]})
    unique_inputs = {data for _, data, _ in tests}
    public_cases = sum(not case["hidden"] for case in cases)
    put("validation", BATCH + ".json", {"schemaVersion": 1, "seed": SEED, "problems": [{"id": PID, "oracleCases": len(tests), "uniqueOracleInputs": len(unique_inputs),
        "publicCases": public_cases, "hiddenCases": len(cases)-public_cases, "negativeControls": controls, "referenceSha256": sha(REFERENCE.encode())}],
        "note": "基于独立Floyd-Warshall生成220个随机小图的精确答案，覆盖原例、方向差异、必须重访节点、零权边、不可达与64位距离。" + ("GoJudge报告已绑定。" if has_report else "尚未连接GoJudge。")})
    print(json.dumps({"id": PID, "candidateBatch": BATCH, "oracle": len(tests), "formal": len(cases), "mutantsKilled": len(controls)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
