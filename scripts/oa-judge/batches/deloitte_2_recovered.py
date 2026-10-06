"""Build and locally verify an isolated candidate for Deloitte OA #2."""

from __future__ import annotations

import hashlib
import itertools
import json
import random
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-deloitte-2"
BATCH = "deloitte-2-recovered"
SEED = 20261006
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/deloitte.mdx"
SOURCE_BLOB = "62419bfb711cf0ce870e12af47046e9c7b9ba9c2"
SOURCE_SHA256 = "3af02594080adb72f89dc1db2227f014ce99ab4b8bf1729c1d74e541d1e716d7"
SOURCE_URL = "https://oamaster.com/docs/companies/deloitte#2-count-balanced-nodes-in-a-tree"
CATALOG_HASH = "bf5f0197c427de3cf538858d1c9b1d465e4b23dd89d0d191a6eac2f1e6bf87c3"
PREVIOUS_REASON = "没有输入格式和节点编号/根节点约定；本批不猜树的序列化协议。"
MAX_N = 200_000


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = r'''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    n = data[0]
    if not 1 <= n <= 200_000 or len(data) != n:
        raise ValueError("expected n and n-1 parent IDs")
    children = [[] for _ in range(n)]
    for node in range(1, n):
        parent = data[node] - 1
        if not 0 <= parent < n or parent == node:
            raise ValueError("invalid parent ID")
        children[parent].append(node)

    # Iterative traversal supports a 200,000-node chain without recursion.
    order = []
    stack = [0]
    seen = bytearray(n)
    seen[0] = 1
    while stack:
        node = stack.pop()
        order.append(node)
        for child in children[node]:
            if seen[child]:
                raise ValueError("parent relation is not a rooted tree")
            seen[child] = 1
            stack.append(child)
    if len(order) != n:
        raise ValueError("all nodes must be reachable from root 1")

    subtree_size = [1] * n
    balanced_count = 0
    for node in reversed(order):
        expected = None
        balanced = True
        for child in children[node]:
            size = subtree_size[child]
            subtree_size[node] += size
            if expected is None:
                expected = size
            elif size != expected:
                balanced = False
        if balanced:
            balanced_count += 1
    return str(balanced_count)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def serialize(parents: list[int]) -> str:
    """parents[i] is the 0-based parent of node i+1; root is node 0."""
    return str(len(parents) + 1) + "\n" + " ".join(str(p + 1) for p in parents) + "\n"


def parse(raw: str) -> list[int]:
    data = list(map(int, raw.split()))
    assert data and 1 <= data[0] <= MAX_N and len(data) == data[0]
    n = data[0]
    parents = [-1] + [value - 1 for value in data[1:]]
    assert all(0 <= parents[v] < n and parents[v] != v for v in range(1, n))
    return parents


def independent_oracle(raw: str) -> str:
    """For every child, explicitly walk all descendants to count its subtree."""
    parents = parse(raw)
    n = len(parents)
    children = [[] for _ in range(n)]
    for node in range(1, n):
        children[parents[node]].append(node)
    order = []
    pending = [0]
    while pending:
        node = pending.pop()
        order.append(node)
        pending.extend(children[node])
    assert len(order) == n

    balanced = 0
    for node in range(n):
        sizes = []
        for child in children[node]:
            size = 0
            pending = [child]
            while pending:
                current = pending.pop()
                size += 1
                pending.extend(children[current])
            sizes.append(size)
        if not sizes or all(size == sizes[0] for size in sizes):
            balanced += 1
    return str(balanced)


_FUNCTIONS: dict[str, object] = {}


def run_code(code: str, raw: str) -> str:
    fn = _FUNCTIONS.get(code)
    if fn is None:
        env: dict[str, object] = {"__name__": "candidate"}
        exec(compile(code, "<candidate>", "exec"), env)
        fn = env["solve"]
        _FUNCTIONS[code] = fn
    return str(fn(raw))


def random_tree(n: int, rng: random.Random) -> list[int]:
    if n == 1:
        return []
    graph = [[] for _ in range(n)]
    for node in range(1, n):
        parent = rng.randrange(node)
        graph[parent].append(node)
        graph[node].append(parent)
    # Relabel non-root vertices so parent IDs need not be topologically ordered.
    permutation = [0] + rng.sample(list(range(1, n)), n - 1)
    remap = [0] * n
    for old, new in enumerate(permutation):
        remap[old] = new
    relabeled = [[] for _ in range(n)]
    for u in range(n):
        for v in graph[u]:
            relabeled[remap[u]].append(remap[v])
    parents = [-1] * n
    stack = [0]
    visited = bytearray(n)
    visited[0] = 1
    while stack:
        u = stack.pop()
        for v in relabeled[u]:
            if not visited[v]:
                visited[v] = 1
                parents[v] = u
                stack.append(v)
    return parents[1:]


MUTANTS = [
    {
        "name": "比较每个孩子的直接孩子数，而不是子树节点数",
        "code": r'''def solve(raw):
 d=list(map(int,raw.split()));n=d[0];ch=[[] for _ in range(n)]
 for v,p in enumerate(d[1:],1):ch[p-1].append(v)
 ans=0;st=[0];order=[]
 while st:
  u=st.pop();order.append(u);st.extend(ch[u])
 for u in range(n):
  vals=[len(ch[v]) for v in ch[u]]
  if not vals or len(set(vals))==1:ans+=1
 return str(ans)
''',
    },
    {
        "name": "不把叶子节点计为平衡",
        "code": r'''def solve(raw):
 d=list(map(int,raw.split()));n=d[0];ch=[[] for _ in range(n)]
 for v,p in enumerate(d[1:],1):ch[p-1].append(v)
 order=[];st=[0]
 while st:
  u=st.pop();order.append(u);st.extend(ch[u])
 sz=[1]*n;ans=0
 for u in reversed(order):
  vals=[sz[v] for v in ch[u]]
  for v in ch[u]:sz[u]+=sz[v]
  if vals and len(set(vals))==1:ans+=1
 return str(ans)
''',
    },
]


def main() -> None:
    start = time.perf_counter()
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(x for x in catalog["items"] if x["id"] == PID)
    assert item["title"] == "Count Balanced Nodes in a Tree"
    assert item["contentHash"] == CATALOG_HASH and item["sourceUrl"] == SOURCE_URL
    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] == "blocked", state
    review = json.loads((OA / "reviews/saas-companies-high-confidence.json").read_text())
    previous = next(x for x in review["items"] if x["id"] == PID)
    assert previous["status"] == "blocked" and previous["reason"] == PREVIOUS_REASON
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            manifest = json.loads(path.read_text())
            if folder == "candidate-batches" and path.name == f"{BATCH}.json":
                continue
            assert all(entry["id"] != PID for entry in manifest.get("items", [])), (folder, path)

    page = subprocess.run(
        ["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    assert sha(page) == SOURCE_SHA256
    assert "## 2. Count Balanced Nodes in a Tree" in page
    assert "A node is *balanced* if all of its subtrees (one per direct child) have the same size." in page
    assert "A leaf has zero children, so trivially balanced." in page

    # The source contains no serialization example or input-size bound. Site
    # protocol: n, then n-1 parent IDs for nodes 2..n; root is node 1.
    public_parents = [
        [],                         # singleton
        [0, 1, 2],                  # chain
        [0, 0, 1],                  # root has unequal child subtree sizes
    ]
    public_inputs = [serialize(p) for p in public_parents]
    rng = random.Random(SEED)
    random_inputs = []
    seen = set(public_inputs)
    while len(random_inputs) < 160:
        n = rng.randint(1, 12)
        raw = serialize(random_tree(n, rng))
        if raw not in seen:
            random_inputs.append(raw)
            seen.add(raw)

    oracle_inputs = public_inputs + random_inputs
    oracle_rows = []
    for raw in oracle_inputs:
        expected = independent_oracle(raw)
        assert run_code(REFERENCE, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    # Exhaust every parent assignment for n<=5, retaining precisely the valid
    # trees rooted at node 1. The oracle uses explicit descendant walks.
    exhaustive = 0
    for n in range(1, 6):
        for values in itertools.product(range(n), repeat=n - 1):
            parents = [-1, *values]
            if any(parents[v] == v for v in range(1, n)):
                continue
            raw = serialize(parents[1:])
            try:
                expected = independent_oracle(raw)
            except AssertionError:
                continue
            assert run_code(REFERENCE, raw) == expected, (n, values)
            exhaustive += 1

    boundary_parents = [
        list(range(MAX_N - 1)),                 # maximum chain
        [0] * (MAX_N - 1),                      # maximum star
    ]
    discriminating_a = [0, 0, 1, 1, 3, 2, 2]  # equal child counts, unequal subtree sizes
    discriminating_b = [0, 0, 1, 1, 3, 2, 6, 6, 6]  # equal child heights, unequal sizes
    formal_inputs = public_inputs + [
        serialize(discriminating_a),
        serialize(discriminating_b),
        serialize(boundary_parents[0]),
        serialize(boundary_parents[1]),
    ] + random_inputs[:24]
    cases = []
    expected_formal = []
    for i, raw in enumerate(formal_inputs):
        if i == len(public_inputs) + 2 or i == len(public_inputs) + 3:
            # Both maximum-size boundary shapes consist entirely of leaves or
            # unary nodes, so every node is balanced by the source definition.
            expected = str(MAX_N)
        else:
            expected = independent_oracle(raw)
        expected_formal.append(expected)
        cases.append({
            "name": f"自建样例 {i + 1}" if i < 3 else f"边界/随机 {i - 2}",
            "input": raw,
            "expectedOutput": expected + "\n",
            "hidden": i >= 3,
            "weight": 1,
        })

    negative_controls = []
    for mutant in MUTANTS:
        rejected = [i for i, raw in enumerate(formal_inputs)
                    if run_code(mutant["code"], raw) != expected_formal[i]]
        assert rejected, mutant["name"]
        negative_controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    editorial = """## 思路

对每个节点统计以它为根的子树节点总数。按后序顺序处理节点时，子树大小等于 1 加上所有直接孩子的子树大小之和；该节点平衡当且仅当这些孩子的子树大小全部相同。没有孩子时条件真空成立，因此叶子也计入答案。

为适配深度可达 200,000 的树，使用显式栈生成遍历顺序，再反向计算，不使用递归。

## 正确性证明

反向遍历保证节点的所有孩子先于节点完成处理，因此每个孩子的 `subtree_size` 已等于定义中的节点数。算法将这些直接孩子的值逐一比较，正好实现题目对平衡节点的定义；没有孩子时无不同值，按题面叶子规则计入。每个节点恰处理一次，故计数即所有平衡节点总数。

## 复杂度

时间 O(n)，空间 O(n)。

## 验证

163 个输入与独立 oracle 对照；oracle 对每个节点/孩子显式遍历后代计数，不复用后序子树大小算法。额外穷举 n≤5 的所有 parent 赋值并仅保留以 1 为根的合法树。正式测试有单点、链、星、子树大小不等、直接孩子数相同但子树大小不同、孩子高度相同但子树大小不同，以及 n=200000 链/星压力用例。两个正常返回的错误程序分别被正式用例拒绝。

## 来源和本站输入协议

固定 OAMaster Deloitte #2 明确给出 rooted tree、平衡定义（比较每个直接孩子对应子树的节点数）及叶子算平衡，但没有标准输入格式、节点编号/根标号约定或规模上限。本站补充：第一项为 n，后续 n−1 个整数依次表示节点 2..n 的父节点，根固定为节点 1；输入保证构成以 1 为根的树。本站资源上限为 1≤n≤200000。这些是本站序列化/资源约定，不声称是原题约束。

候选只按题面语义实现，仍待真实 GoJudge 沙箱验证。"""

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID,
            "courseId": "gomall",
            "lessonId": "00-overview",
            "title": "统计平衡节点（Deloitte OA）",
            "difficulty": "中等",
            "tags": ["OA", "Deloitte", "树", "后序遍历"],
            "description": "给定一棵以节点 1 为根的树。若一个节点的所有直接孩子所对应子树大小相同，则该节点平衡；叶子节点按题意视为平衡。输出平衡节点总数。本站补充 parent-list 输入协议和规模上限。",
            "input": "第一行 n（1≤n≤200000）；第二行包含 n−1 个整数，依次为节点 2..n 的父节点编号（1-based）。n=1 时第二行可为空。输入保证构成以节点 1 为根的树。",
            "output": "输出平衡节点的数量。",
            "explanation": "详细算法、证明及本站协议说明见配套题解。",
            "hints": ["先求每个节点的子树大小。", "比较的是直接孩子的子树大小，不是孩子数或树高。"],
            "timeLimit": 3,
            "memoryLimit": 262144,
            "outputLimit": 4096,
            "checker": "exact",
            "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    schema_script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(
        ["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
        input=json.dumps(raw_package, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    )
    package = json.loads(proc.stdout)
    package_checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    entry = {
        "id": PID,
        "sourceContentHash": item["contentHash"],
        "packageChecksum": package_checksum,
        "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }

    put_json(OA / "packages" / f"{PID}.json", package)
    reference_path = OA / "references" / f"{PID}.py"
    reference_path.write_text(REFERENCE)
    put_json(OA / "oracles" / f"{PID}.json", oracle_rows)
    put_json(OA / "mutants" / f"{PID}.json", MUTANTS)
    put_json(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": CATALOG_HASH, "author": "CSWork",
    })
    for i, mutant in enumerate(MUTANTS, 1):
        text = "# " + mutant["name"] + "\n" + mutant["code"]
        text += "\nif __name__ == \"__main__\":\n    import sys\n    print(solve(sys.stdin.read()))\n"
        (OA / "negative-controls" / f"{PID}-{i}.py").write_text(text)
    put_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID,
            "sourceContentHash": CATALOG_HASH,
            "packageChecksum": package_checksum,
            "editorial": editorial,
            "authoredSolutions": [{"language": "python", "code": REFERENCE}],
        }],
    })
    put_json(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT,
        "origin": "https://oamaster.com",
        "items": {PID: {
            "url": SOURCE_URL,
            "contentHash": CATALOG_HASH,
            "catalogContentHash": CATALOG_HASH,
            "company": item["companyName"],
            "title": item["title"],
            "path": SOURCE_PATH,
            "gitBlobSha": SOURCE_BLOB,
            "sourceFileSha256": SOURCE_SHA256,
            "sourceFacts": "The immutable page states the rooted-tree definition, compares subtree sizes one per direct child, and explicitly says a leaf with no children is trivially balanced.",
            "siteAdditions": "The upstream has no serialization format, root/node-label convention, or size bound. This candidate uses root node 1 with a parent list for nodes 2..n and site cap n<=200000; these are site I/O/resource additions, not upstream rules.",
        }},
    })
    put_json(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID,
            "batch": BATCH,
            "sourceContentHash": CATALOG_HASH,
            "previousReason": previous["reason"],
            "reason": "题意语义完整；root=1/parent-list 仅作为本站标准输入表示根树，不改变定义。规模上限 n≤200000 为本站资源限制，非原题约束。通过独立后代遍历 oracle、全域小树穷举、边界用例和两个错误控制；仍待真实 GoJudge 沙箱。",
        }],
    })

    stdio_rows = oracle_rows + [{"input": c["input"], "expectedOutput": c["expectedOutput"]} for c in cases]
    for row in stdio_rows:
        proc = subprocess.run(
            ["python3", "-I", str(reference_path)], cwd=ROOT,
            input=row["input"], text=True, capture_output=True, timeout=8, check=True,
        )
        assert proc.stdout == row["expectedOutput"], (row["input"][:100], proc.stdout[:100], row["expectedOutput"][:100])

    stress = []
    for label, parents in (("chain", boundary_parents[0]), ("star", boundary_parents[1])):
        raw = serialize(parents)
        got = run_code(REFERENCE, raw)
        expected = str(MAX_N)
        assert got == expected, (label, got)
        stress.append({"shape": label, "n": MAX_N, "expected": expected, "passed": True})

    put_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": SEED,
        "problems": [{
            "id": PID,
            "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
            "referenceStdioCases": len(stdio_rows),
            "publicCases": len(public_inputs),
            "hiddenCases": len(cases) - len(public_inputs),
            "randomOracleCases": len(random_inputs),
            "exhaustiveTreeComparisons": exhaustive,
            "stress": stress,
            "negativeControls": negative_controls,
            "referenceSha256": sha(REFERENCE),
            "localValidationOnly": True,
            "allLocalChecksPassed": True,
        }],
    })
    print(json.dumps({
        "id": PID,
        "candidateBatch": BATCH,
        "statusBefore": state["status"],
        "oracleCases": len(oracle_rows),
        "formalCases": len(cases),
        "exhaustiveValidTrees": exhaustive,
        "stress": stress,
        "negativeControls": negative_controls,
        "totalSeconds": round(time.perf_counter() - start, 3),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
