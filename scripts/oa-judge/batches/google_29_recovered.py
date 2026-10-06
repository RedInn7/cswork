"""Build and locally verify a source-bound candidate for Google OA #29.

The generated item remains an unpromoted candidate. This script performs no
network or judge calls and writes only files named for this single problem.
"""

from array import array
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
CONTENT = ROOT / "content" / "oa-judge"
PROBLEM_ID = "oa-google-29"
CANDIDATE_NAME = "google-29-recovered"
SEED = 20261006
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/google.mdx"
SOURCE_BLOB = "300032c24800642c2ecedab9d930e86db3cdb54a"
SOURCE_FILE_SHA256 = "22bfaeeadfa0e3dc25aa2a9c46fd9d81981e26f12cd27527fa772ed2237b90a9"
SOURCE_URL = "https://oamaster.com/docs/companies/google#29-find-minimum-possible-diameter"

SOLUTION = r'''from array import array
import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        return ""
    n, k = values[0], values[1]
    if n < 1 or not 0 <= k < n:
        raise ValueError("require n >= 1 and 0 <= k < n")
    if len(values) != 2 + 2 * (n - 1):
        raise ValueError("expected n-1 edges")
    required = n - k
    graph = [[] for _ in range(n)]
    cursor = 2
    for _ in range(n - 1):
        a, b = values[cursor] - 1, values[cursor + 1] - 1
        cursor += 2
        if not (0 <= a < n and 0 <= b < n) or a == b:
            raise ValueError("invalid tree edge")
        graph[a].append(b)
        graph[b].append(a)

    # Rooting and Euler intervals support subtree-by-depth counting.
    parent = [-2] * n
    depth = [0] * n
    entry = [0] * n
    exit_ = [0] * n
    preorder = []
    parent[0] = -1
    todo = [(0, False)]
    while todo:
        node, leaving = todo.pop()
        if leaving:
            exit_[node] = len(preorder)
            continue
        entry[node] = len(preorder)
        preorder.append(node)
        todo.append((node, True))
        for child in reversed(graph[node]):
            if child == parent[node]:
                continue
            if parent[child] != -2:
                raise ValueError("input graph is not a tree")
            parent[child] = node
            depth[child] = depth[node] + 1
            todo.append((child, False))
    if len(preorder) != n:
        raise ValueError("input tree is disconnected")

    # Persistent prefix histograms over Euler positions, keyed by depth.
    roots = array("i", [0])
    left = array("i", [0])
    right = array("i", [0])
    count = array("i", [0])
    for vertex in preorder:
        previous = roots[-1]
        root = len(count)
        left.append(left[previous])
        right.append(right[previous])
        count.append(count[previous] + 1)
        old_node, new_node = previous, root
        low, high, value = 0, n - 1, depth[vertex]
        while low < high:
            middle = (low + high) >> 1
            if value <= middle:
                old_child = left[old_node]
                new_child = len(count)
                left.append(left[old_child])
                right.append(right[old_child])
                count.append(count[old_child] + 1)
                left[new_node] = new_child
                old_node, new_node, high = old_child, new_child, middle
            else:
                old_child = right[old_node]
                new_child = len(count)
                left.append(left[old_child])
                right.append(right[old_child])
                count.append(count[old_child] + 1)
                right[new_node] = new_child
                old_node, new_node, low = old_child, new_child, middle + 1
        roots.append(root)

    def subtree_count_by_depth(vertex, radius):
        if radius < 0:
            return 0
        limit = depth[vertex] + radius
        if limit >= n - 1:
            return exit_[vertex] - entry[vertex]
        right_root = roots[exit_[vertex]]
        left_root = roots[entry[vertex]]
        low, high, result = 0, n - 1, 0
        while low < high:
            middle = (low + high) >> 1
            if limit <= middle:
                right_root = left[right_root]
                left_root = left[left_root]
                high = middle
            else:
                result += count[left[right_root]] - count[left[left_root]]
                right_root = right[right_root]
                left_root = right[left_root]
                low = middle + 1
        if low <= limit:
            result += count[right_root] - count[left_root]
        return result

    # Centroid ancestor paths; three compact arrays per vertex avoid storing
    # millions of Python tuple objects at n=100000.
    centroids = [array("i") for _ in range(n)]
    distances = [array("i") for _ in range(n)]
    branches = [array("i") for _ in range(n)]
    removed = bytearray(n)
    scratch_parent = [-2] * n
    subtree_size = [0] * n
    whole_histogram = [None] * n
    branch_histograms = [None] * n
    pending = [0]

    while pending:
        seed = pending.pop()
        if removed[seed]:
            continue
        component = []
        walk = [(seed, -1)]
        while walk:
            u, p = walk.pop()
            scratch_parent[u] = p
            component.append(u)
            for v in graph[u]:
                if not removed[v] and v != p:
                    walk.append((v, u))
        component_size = len(component)
        for u in reversed(component):
            size = 1
            for v in graph[u]:
                if not removed[v] and scratch_parent[v] == u:
                    size += subtree_size[v]
            subtree_size[u] = size
        center = seed
        for u in component:
            largest_part = component_size - subtree_size[u]
            for v in graph[u]:
                if (not removed[v] and scratch_parent[v] == u
                        and subtree_size[v] > largest_part):
                    largest_part = subtree_size[v]
            if largest_part <= component_size // 2:
                center = u
                break

        removed[center] = 1
        centroids[center].append(center)
        distances[center].append(0)
        branches[center].append(-1)
        all_frequency = [1]
        child_histograms = {}
        for neighbor in graph[center]:
            if removed[neighbor]:
                continue
            pending.append(neighbor)
            branch_distances = []
            walk = [(neighbor, center, 1)]
            while walk:
                u, p, d = walk.pop()
                centroids[u].append(center)
                distances[u].append(d)
                branches[u].append(neighbor)
                branch_distances.append(d)
                if len(all_frequency) <= d:
                    all_frequency.extend([0] * (d + 1 - len(all_frequency)))
                all_frequency[d] += 1
                for v in graph[u]:
                    if v != p and not removed[v]:
                        walk.append((v, u, d + 1))
            local_frequency = [0] * (max(branch_distances) + 1)
            for d in branch_distances:
                local_frequency[d] += 1
            subtotal = 0
            for i, amount in enumerate(local_frequency):
                subtotal += amount
                local_frequency[i] = subtotal
            child_histograms[neighbor] = array("i", local_frequency)
        subtotal = 0
        for i, amount in enumerate(all_frequency):
            subtotal += amount
            all_frequency[i] = subtotal
        whole_histogram[center] = array("i", all_frequency)
        branch_histograms[center] = child_histograms

    def ball_size(vertex, radius):
        answer = 0
        chain_c = centroids[vertex]
        chain_d = distances[vertex]
        chain_b = branches[vertex]
        for i in range(len(chain_c)):
            remaining = radius - chain_d[i]
            if remaining < 0:
                continue
            center = chain_c[i]
            hist = whole_histogram[center]
            answer += hist[remaining] if remaining < len(hist) else hist[-1]
            branch = chain_b[i]
            if branch >= 0:
                hist = branch_histograms[center][branch]
                answer -= hist[remaining] if remaining < len(hist) else hist[-1]
        return answer

    lower, upper = 0, n - 1
    while lower < upper:
        limit = (lower + upper) // 2
        radius = limit // 2
        balls = [ball_size(v, radius) for v in range(n)]
        enough = max(balls) >= required
        if not enough and limit % 2:
            # Edge-centred radius-r balls: parent side plus child side.
            for child in range(1, n):
                p = parent[child]
                size = balls[p] - subtree_count_by_depth(child, radius - 1)
                size += subtree_count_by_depth(child, radius)
                if size >= required:
                    enough = True
                    break
        if enough:
            upper = limit
        else:
            lower = limit + 1
    return str(lower)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def format_tree(n, k, edges):
    return f"{n} {k}\n" + "".join(f"{u + 1} {v + 1}\n" for u, v in edges)


def diameter_by_bfs(n, edges, mask):
    if mask.bit_count() < 2:
        return 0
    graph = [[] for _ in range(n)]
    for a, b in edges:
        graph[a].append(b)
        graph[b].append(a)

    def farthest(source):
        distances = {source: 0}
        queue = [source]
        for u in queue:
            for v in graph[u]:
                if (mask >> v) & 1 and v not in distances:
                    distances[v] = distances[u] + 1
                    queue.append(v)
        endpoint = max(distances, key=distances.get)
        return endpoint, distances[endpoint]

    start = (mask & -mask).bit_length() - 1
    endpoint, _ = farthest(start)
    return farthest(endpoint)[1]


def exhaustive_oracle(n, k, edges):
    """Enumerate connected retained vertex sets; independent of the solution."""
    graph = [[] for _ in range(n)]
    for a, b in edges:
        graph[a].append(b)
        graph[b].append(a)
    target = n - k
    best = n
    for mask in range(1, 1 << n):
        if mask.bit_count() < target:
            continue
        first = (mask & -mask).bit_length() - 1
        reached = 1 << first
        queue = [first]
        for u in queue:
            for v in graph[u]:
                bit = 1 << v
                if (mask & bit) and not (reached & bit):
                    reached |= bit
                    queue.append(v)
        if reached == mask:
            best = min(best, diameter_by_bfs(n, edges, mask))
    return best


def random_tree(rng, n):
    return [(rng.randrange(v), v) for v in range(1, n)]


def unpack(raw):
    values = list(map(int, raw.split()))
    n, k = values[:2]
    edges = [(values[i] - 1, values[i + 1] - 1)
             for i in range(2, len(values), 2)]
    return n, k, edges


def greedy_wrong(raw):
    n, k, edges = unpack(raw)
    graph = [set() for _ in range(n)]
    alive = [True] * n
    degree = [0] * n
    for u, v in edges:
        graph[u].add(v)
        graph[v].add(u)
        degree[u] += 1
        degree[v] += 1
    for _ in range(k):
        if sum(alive) == 1:
            break
        leaf = next(i for i in range(n) if alive[i] and degree[i] <= 1)
        alive[leaf] = False
        for v in graph[leaf]:
            if alive[v]:
                degree[v] -= 1
    start = next(i for i in range(n) if alive[i])

    def farthest(source):
        dist = {source: 0}
        queue = [source]
        for u in queue:
            for v in graph[u]:
                if alive[v] and v not in dist:
                    dist[v] = dist[u] + 1
                    queue.append(v)
        end = max(dist, key=dist.get)
        return end, dist[end]

    end, _ = farthest(start)
    return str(farthest(end)[1])


def no_op_wrong(raw):
    n, _, edges = unpack(raw)
    return str(diameter_by_bfs(n, edges, (1 << n) - 1))


def formal_inputs(rng):
    fixed = [
        (4, 0, [(0, 1), (1, 2), (2, 3)], "公开样例 1"),
        (4, 1, [(1, 2), (2, 3), (0, 3)], "公开样例 2"),
        (5, 1, [(1, 2), (2, 3), (3, 4), (0, 2)], "非中心叶子删除反例"),
        (1, 0, [], "单点树"),
        (2, 0, [(0, 1)], "两节点不删除"),
        (2, 1, [(0, 1)], "删除到单点"),
        (6, 5, [(i, i + 1) for i in range(5)], "长链保留单点"),
        (7, 5, [(0, i) for i in range(1, 7)], "星形保留一条边"),
        (9, 4, [(0, 1), (1, 2), (1, 3), (3, 4), (3, 5),
                (5, 6), (5, 7), (7, 8)], "双中心分支树"),
    ]
    seen = set()
    out = []
    for index, (n, k, edges, label) in enumerate(fixed):
        raw = format_tree(n, k, edges)
        seen.add(raw)
        out.append((raw, label, index < 2))
    while len(out) < 27:
        n = rng.randint(4, 10)
        edges = random_tree(rng, n)
        k = rng.randrange(n)
        raw = format_tree(n, k, edges)
        if raw in seen:
            continue
        seen.add(raw)
        out.append((raw, f"随机边界 {len(out) - 8}", False))
    return out


def make_formal_cases(rng):
    cases = []
    scope = {"__name__": "google29_reference"}
    exec(SOLUTION, scope)
    for raw, label, public in formal_inputs(rng):
        n, k, edges = unpack(raw)
        expected = exhaustive_oracle(n, k, edges)
        actual = int(scope["solve"](raw))
        assert actual == expected, (label, raw, expected, actual)
        cases.append({
            "name": label,
            "input": raw,
            "expectedOutput": f"{expected}\n",
            "hidden": not public,
            "weight": 1,
        })
    return cases


def make_oracles(rng, forbidden):
    taken = set(forbidden)
    cases = []
    while len(cases) < 120:
        n = rng.randint(1, 10)
        edges = random_tree(rng, n)
        k = rng.randrange(n)
        raw = format_tree(n, k, edges)
        if raw in taken:
            continue
        taken.add(raw)
        cases.append({
            "input": raw,
            "expectedOutput": f"{exhaustive_oracle(n, k, edges)}\n",
        })
    return cases


def artifact_mutants():
    return [
        {
            "name": "每次删除编号最小的叶子",
            "code": r'''import sys
def solve(raw):
 d=list(map(int,raw.split())); n,k=d[:2]; g=[set() for _ in range(n)]
 for i in range(2,len(d),2):
  u,v=d[i]-1,d[i+1]-1; g[u].add(v); g[v].add(u)
 alive=[1]*n; degree=list(map(len,g))
 for _ in range(k):
  if sum(alive)==1: break
  u=next(i for i in range(n) if alive[i] and degree[i]<=1); alive[u]=0
  for v in g[u]:
   if alive[v]: degree[v]-=1
 def far(s):
  dist={s:0}; q=[s]
  for u in q:
   for v in g[u]:
    if alive[v] and v not in dist: dist[v]=dist[u]+1; q.append(v)
  z=max(dist,key=dist.get); return z,dist[z]
 if sum(alive)==1: return '0'
 s=next(i for i in range(n) if alive[i]); return str(far(far(s)[0])[1])
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        },
        {
            "name": "不进行任何叶子删除",
            "code": r'''import sys
def solve(raw):
 d=list(map(int,raw.split())); n=d[0]; g=[[] for _ in range(n)]
 for i in range(2,len(d),2):
  u,v=d[i]-1,d[i+1]-1; g[u].append(v); g[v].append(u)
 def far(s):
  dist={s:0}; q=[s]
  for u in q:
   for v in g[u]:
    if v not in dist: dist[v]=dist[u]+1; q.append(v)
  z=max(dist,key=dist.get); return z,dist[z]
 return str(far(far(0)[0])[1])
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        },
    ]


def write_candidate():
    rng = random.Random(SEED)
    cases = make_formal_cases(rng)
    oracle = make_oracles(rng, [raw for raw, _, _ in formal_inputs(random.Random(SEED))])
    namespace = {"__name__": "google29_reference"}
    exec(SOLUTION, namespace)
    solve = namespace["solve"]
    for index, case in enumerate(oracle):
        n, k, edges = unpack(case["input"])
        answer = exhaustive_oracle(n, k, edges)
        assert str(answer) == case["expectedOutput"].strip(), ("oracle", index)
        assert solve(case["input"]).strip() == str(answer), ("reference", index)

    mutants = artifact_mutants()
    validation_controls = []
    for mutant, local_control in zip(mutants, [greedy_wrong, no_op_wrong]):
        control_ns = {"__name__": "google29_mutant"}
        exec(mutant["code"], control_ns)
        rejected = []
        for index, case in enumerate(cases):
            assert control_ns["solve"](case["input"]).strip() == local_control(case["input"]).strip()
            if control_ns["solve"](case["input"]).strip() != case["expectedOutput"].strip():
                rejected.append(index)
        assert rejected, mutant["name"]
        validation_controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    catalog = json.loads((ROOT / "content" / "oa-master" / "catalog.json").read_text())
    source = next(item for item in catalog["items"] if item["id"] == PROBLEM_ID)
    assert catalog["source"]["commit"] == SOURCE_COMMIT
    assert source["sourceUrl"] == SOURCE_URL
    old_reason = None
    for path in sorted((CONTENT / "reviews").glob("*.json")):
        review = json.loads(path.read_text())
        for item in review.get("items", []):
            if item.get("id") == PROBLEM_ID and item.get("status") == "blocked":
                old_reason = item["reason"]
                break
        if old_reason:
            break
    assert old_reason, "The source-bound blocked review was not found."

    statement = (
        "给定一棵含 n 个顶点的无向树。每次可以删除一个叶节点，最多操作 k 次；"
        "删除后至少保留一个顶点。求剩余树可能达到的最小直径（直径按边数计算）。\n\n"
        "原站约束写作 0 < k < n，但其公开样例 1 明确使用 k=0，二者冲突。"
        "本候选明确修订为 0 ≤ k < n，以保留样例且符合‘最多 k 次’的含义；n=1,k=0 合法，"
        "保留一个顶点时直径为 0。此处是本站显式修订，不将它说成原站约束。\n\n"
        "标准输入：第一行 n k，随后 n−1 行各含一条 1-based 边 u v。保证输入是合法树。"
        "输出一个整数。原站对象样例在这里改写为标准输入输出。"
    )
    package = {
        "schemaVersion": 1,
        "problem": {
            "id": PROBLEM_ID,
            "courseId": "gomall",
            "lessonId": "00-overview",
            "title": "删至多 k 个叶子后的最小树直径（Google OA）",
            "difficulty": "困难",
            "tags": ["OA", "Google", "树", "重心分解", "二分"],
            "description": statement,
            "input": "第一行 n k（1≤n≤100000，0≤k<n）；接着 n−1 行，每行两个整数 u v，表示 1-based 顶点间的一条无向边。保证构成一棵树。",
            "output": "输出最多删除 k 个叶节点后能得到的最小直径。单点树的直径为 0。",
            "explanation": "推导、正确性证明与复杂度见候选讲义。",
            "hints": [
                "保留点集必须连通；任何连通子树都能通过从外向内删除叶子得到。",
                "二分最大允许直径 D，检查是否能保留至少 n−k 个点。",
                "偶数 D 看顶点半径球；奇数 D 还要检查以边为中心、两侧各深 r 的节点集合。",
            ],
            "timeLimit": 20,
            "memoryLimit": 524288,
            "outputLimit": 65536,
            "checker": "tokens",
            "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    package_raw = json.dumps(package, ensure_ascii=False, separators=(",", ":"))
    checksum = hashlib.sha256(package_raw.encode()).hexdigest()
    resolution_reason = (
        "已按题意重写精确解：将最小剩余直径转成单调阈值判定，以树中心定理枚举顶点球/边双球，"
        "重心分解加 Euler 深度前缀结构支持 n≤100000；用独立连通子集穷举生成120条唯一oracle并随机差分，"
        "完成长链/星形满规模本地压力测试。公开修正原 0<k<n 与 k=0 样例冲突为 0≤k<n；"
        "目前只是候选，尚未经过正式在线评测。"
    )
    manifest = {
        "schemaVersion": 1,
        "items": [{
            "id": PROBLEM_ID,
            "sourceContentHash": source["contentHash"],
            "packageChecksum": checksum,
            "editorial": (
                "## 思路\n\n"
                "删叶子后剩余的点集始终连通；反过来，对任意连通子树，按补集分支由外向内删叶子即可得到它。"
                "所以问题是：保留至少 q=n−k 个点的连通子树，最小化直径。\n\n"
                "二分直径上限 D。D=2r 时，任何直径≤D的树都有顶点中心，所有节点距中心至多 r；"
                "候选集合是原树每个顶点的半径 r 球。D=2r+1 时，还要考虑中心落在边上的情况："
                "边两侧分别保留距端点至多 r 的点。每个候选集合连通且直径≤D；树中心定理也保证任何可行子树都包含在对应候选中，"
                "故最大候选规模≥q 当且仅当 D 可行。\n\n"
                "重心分解的距离频数前缀回答顶点球大小。将原树根化后，用 Euler 子树区间和深度持久化前缀统计边一侧的范围人数。"
                "总预处理 O(n log n)，一次判定 O(n log n)，二分后的总时间 O(n log² n)，空间 O(n log n)。\n\n"
                "## 源约束更正\n\n"
                "原源写 0<k<n，但样例 1 使用 k=0；本候选明确改为 0≤k<n，让样例和‘最多 k 次’定义一致，且 n=1,k=0 输出0。"
                "标准输入输出协议是本站补充。"
            ),
            "authoredSolutions": [{"language": "python", "code": SOLUTION}],
        }],
    }
    validation = {
        "schemaVersion": 1,
        "seed": SEED,
        "problems": [{
            "id": PROBLEM_ID,
            "oracleCases": len(oracle),
            "uniqueOracleInputs": len({case["input"] for case in oracle}),
            "publicCases": sum(not case["hidden"] for case in cases),
            "hiddenCases": sum(case["hidden"] for case in cases),
            "negativeControls": validation_controls,
            "referenceSha256": hashlib.sha256(SOLUTION.encode()).hexdigest(),
            "constraintCorrection": "0 < k < n -> 0 <= k < n (public sample 1 uses k=0)",
            "localOnly": True,
        }],
    }
    resolution = {
        "schemaVersion": 1,
        "items": [{
            "id": PROBLEM_ID,
            "batch": CANDIDATE_NAME,
            "sourceContentHash": source["contentHash"],
            "previousReason": old_reason,
            "reason": resolution_reason,
        }],
    }
    source_evidence = {
        "schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master",
        "origin": "https://oamaster.com",
        "commit": SOURCE_COMMIT,
        "items": {
            PROBLEM_ID: {
                "sourceCommit": SOURCE_COMMIT,
                "rawPath": SOURCE_PATH,
                "rawGitBlob": SOURCE_BLOB,
                "sourceFileSha256": SOURCE_FILE_SHA256,
                "catalogContentHash": source["contentHash"],
                "sourceUrl": SOURCE_URL,
                "decision": "candidate-authored",
                "sourceFacts": {
                    "constraint": {
                        "line": 2990,
                        "text": "`0 < k < n`",
                    },
                    "firstSample": {
                        "line": 2996,
                        "text": "k = 0",
                    },
                    "conflict": "原约束排除 k=0，但同一题面公开样例 1 明确使用 k=0，约束与样例冲突。",
                    "resolution": "候选明确将合法范围写为 0 ≤ k < n，保留样例 1，并将 n=1,k=0 定义为保留单点、直径为 0。",
                    "snapshotExcerpt": (
                        "**Constraints**\n"
                        "`0 < n ≤ 1e5`\n"
                        "`0 < k < n`\n"
                        "### Example 1\n"
                        "n = 4\n"
                        "k = 0"
                    ),
                },
                "reason": "本候选只修正源约束与自带样例的矛盾；题意和测试构造均绑定上述固定 OAMaster 快照。",
            }
        },
    }

    outputs = {
        CONTENT / "packages" / f"{PROBLEM_ID}.json": package,
        CONTENT / "references" / f"{PROBLEM_ID}.py": SOLUTION,
        CONTENT / "oracles" / f"{PROBLEM_ID}.json": oracle,
        CONTENT / "mutants" / f"{PROBLEM_ID}.json": mutants,
        CONTENT / "candidate-batches" / f"{CANDIDATE_NAME}.json": manifest,
        CONTENT / "validation" / f"{CANDIDATE_NAME}.json": validation,
        CONTENT / "resolutions" / f"{CANDIDATE_NAME}.json": resolution,
        CONTENT / "source-evidence" / f"{CANDIDATE_NAME}.json": source_evidence,
    }
    for path, value in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(value, str):
            path.write_text(value, encoding="utf-8")
        else:
            path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"candidate generated: {PROBLEM_ID}; formal={len(cases)}, oracle={len(oracle)}, sha256={checksum}")


def differential_test(trials=2500):
    namespace = {"__name__": "google29_reference"}
    exec(SOLUTION, namespace)
    run = namespace["solve"]
    rng = random.Random(SEED + 1)
    for case_no in range(trials):
        n = rng.randint(1, 10)
        edges = random_tree(rng, n)
        k = rng.randrange(n)
        raw = format_tree(n, k, edges)
        exact = exhaustive_oracle(n, k, edges)
        got = int(run(raw))
        assert got == exact, (case_no, n, k, edges, exact, got)
    print(f"differential passed: {trials} random trees, n<=10, seed={SEED + 1}")


def full_size_pressure():
    n = 100000
    cases = [
        ("chain", n, n // 2, [(i, i + 1) for i in range(n - 1)]),
        ("star", n, n // 3, [(0, i) for i in range(1, n)]),
    ]
    with tempfile.TemporaryDirectory(prefix="oa-google29-pressure-") as tmp:
        for label, size, k, edges in cases:
            raw = format_tree(size, k, edges)
            started = time.perf_counter()
            proc = subprocess.run(
                [sys.executable, "-c", SOLUTION], input=raw, text=True,
                capture_output=True, check=True, cwd=tmp, timeout=180,
            )
            elapsed = time.perf_counter() - started
            answer = int(proc.stdout.strip())
            expected = size - k - 1 if label == "chain" else (0 if k == size - 1 else 2)
            assert answer == expected, (label, answer, expected)
            print(f"pressure {label}: n={size}, k={k}, answer={answer}, seconds={elapsed:.3f}")


if __name__ == "__main__":
    args = set(sys.argv[1:])
    if not args or "--verify" in args:
        differential_test()
    if "--generate" in args:
        write_candidate()
    if "--stress" in args:
        full_size_pressure()
