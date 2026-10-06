#!/usr/bin/env python3
"""Generate an isolated offline candidate for D. E. Shaw Group #9 only."""

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
REVIEW = ROOT / "content" / "oa-judge" / "reviews" / "deshaw-next.json"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "fastprep/The D. E. Shaw Group/deshaw-min-acquire-cost.md"
RAW_BLOB = "d930449673e73af140ab62982504b9efca4eb457"
RAW_SHA256 = "e8f2e83d276d8e7012e3aab74951070de1698db3c7f9b0b7512a69912962170e"
CONTENT_HASH = "bd03c821dee1b45225d7a37409225acbe0e25bf3572c8ec1126572dc8502d2b9"


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

def min_acquire_cost(stations, capacity):
    occupied = set(stations)
    frontier = []
    for station in stations:
        heapq.heappush(frontier, (1, station - 1))
        heapq.heappush(frontier, (1, station + 1))
    total = 0
    bought = 0
    while bought < capacity:
        distance, position = heapq.heappop(frontier)
        if position in occupied:
            continue
        occupied.add(position)
        total += distance
        bought += 1
        heapq.heappush(frontier, (distance + 1, position - 1))
        heapq.heappush(frontier, (distance + 1, position + 1))
    return total

def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) < 2:
        raise ValueError("expected n and capacity")
    n, capacity = values[:2]
    if len(values) != n + 2:
        raise ValueError("station count does not match header")
    return str(min_acquire_cost(values[2:], capacity))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.buffer.read()))
'''


def encode(stations: list[int], capacity: int) -> str:
    return f"{len(stations)} {capacity}\n" + " ".join(map(str, stations)) + "\n"


def run(code: str, raw: str, timeout: int = 15) -> str:
    with tempfile.TemporaryDirectory(prefix="deshaw9-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=timeout, check=True)
        return proc.stdout.decode("ascii").strip()


def oracle(stations: list[int], capacity: int) -> str:
    # Exhaustively inspect every integer site within capacity of at least one
    # station. The capacity sites immediately left of the minimum station
    # already provide capacity eligible locations with costs <= capacity, so
    # no optimal choice can lie farther from every station.
    occupied = set(stations)
    candidates_by_position = set()
    for station in stations:
        for distance in range(1, capacity + 1):
            candidates_by_position.add(station - distance)
            candidates_by_position.add(station + distance)
    candidates = []
    for position in candidates_by_position:
        if position not in occupied:
            candidates.append(min(abs(position - station) for station in stations))
    candidates.sort()
    assert len(candidates) >= capacity
    return str(sum(candidates[:capacity]))


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-the-d-e-shaw-group-9", "deshaw-9-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    formal = [
        ([7, 8], 4, "来源样例"),
        ([0], 1, "单站一个地块"),
        ([0], 4, "单站对称距离层"),
        ([0, 10], 4, "相距较远的两个站"),
        ([-2, -1, 0, 1, 2], 4, "连续站点外侧扩展"),
        ([1_000_000_000], 4, "坐标上界平移不变"),
        ([-1_000_000_000, 1_000_000_000], 6, "坐标极值和跨大间距"),
    ]
    cases = []
    for index, (stations, capacity, name) in enumerate(formal):
        expected = oracle(stations, capacity)
        assert run(REFERENCE, encode(stations, capacity)) == expected
        cases.append({"name": name, "input": encode(stations, capacity), "expectedOutput": expected + "\n",
                      "hidden": index != 0, "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    while len(random_cases) < 120:
        n = rng.randint(1, 12)
        stations = sorted(rng.sample(range(-30, 31), n))
        capacity = rng.randint(1, 24)
        raw = encode(stations, capacity)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(stations, capacity)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        ("允许购买警局所在坐标", REFERENCE.replace("occupied = set(stations)", "occupied = set()")),
        ("扩展时只加入右侧位置", REFERENCE.replace(
            "        heapq.heappush(frontier, (distance + 1, position - 1))\n", "")),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for index, (stations, capacity, _) in enumerate(formal):
            if run(code, encode(stations, capacity)) != oracle(stations, capacity):
                rejected.append(index)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    max_capacity = 50000
    stress_input = encode([0], max_capacity)
    max_int_safe_cost = 2 * sum(range(1, max_capacity // 2 + 1))
    assert max_int_safe_cost == 625025000
    assert run(REFERENCE, stress_input, timeout=30) == str(max_int_safe_cost)

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Police Station", "difficulty": "中等",
        "tags": ["OA", "The D. E. Shaw Group", "贪心", "优先队列", "多源 BFS"],
        "description": "一条无限长的一维数轴上有若干警局，坐标互不相同。恰好购买 capacity 个互不相同且不与任何警局重合的整数坐标。每个地块的费用是它到最近警局的距离，求最低总费用。",
        "input": "第一行输入 n 和 capacity，第二行输入 n 个互不相同的警局整数坐标。本站补充约束：1≤n≤100000，1≤capacity≤50000，|station[i]|≤10^9。原 Fastprep 文本的 Constraints 为 unknown；本站上限保证最坏答案不超过 625025000，符合原函数 int 返回范围。",
        "output": "输出最低总费用。",
        "explanation": "地块只能取整数坐标；每个警局相邻的两个可用坐标费用为 1。原题约束缺失，因此本站显式补充站点数、坐标和 capacity 上限；capacity≤50000 时，即使只有一个警局，购买最近的 capacity 个非警局坐标的总费用至多 625025000。",
        "hints": ["把所有警局相邻位置作为距离 1 的起点，用最小堆按距离扩展。警局坐标和已购买坐标都不能重复购买。"],
        "timeLimit": 4, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n从每个警局左右相邻的整数坐标开始，以距离 1 入最小堆。每次取出距离最近且不是警局、也未购买过的坐标，将其费用加入答案，再把左右相邻坐标以距离 `d+1` 入堆。已购买坐标用集合去重。最小堆保证按最近距离递增选地块，直到选满 capacity 个。\n\n"
        "## 正确性\n\n每个警局的两个相邻坐标距离为 1，作为搜索源。对任一非警局整数坐标，沿数轴从最近警局向该坐标逐格移动；若中间遇到另一个警局，该警局也已作为源扩展其相邻坐标。因此该坐标会由一个不被阻断的更近坐标继续生成，且首次按距离弹出时距离就是它到最近警局的距离。最小堆每次选择当前所有未购买可达地块中的最小费用；故重复 capacity 次恰好选出费用最小的 capacity 个互异合法坐标。\n\n"
        "## 复杂度\n\n设警局数为 n、购买数为 k。初始加入 2n 个位置，每购买一块最多加入两个邻点；每个有效坐标只购买一次，堆操作总数 O(n+k)，时间 O((n+k)log(n+k))，空间 O(n+k)。本站 k≤50000，最坏答案为 625025000，可由 int 表示。"
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
        "repository": "https://github.com/RedInn7/cswork", "commit": COMMIT, "origin": "https://fastprep.io",
        "items": [{"id": identifier, "sourceUrl": "https://www.fastprep.io/problems/deshaw-min-acquire-cost",
            "catalogContentHash": source["contentHash"],
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [1, 84]}],
            "resolvedSemantics": {"cost": "For each acquired integer coordinate, cost is its minimum absolute distance to any police station.",
                "selection": "Acquire exactly capacity distinct integer coordinates, excluding all station and previously acquired coordinates, minimizing total cost.",
                "sourceConstraint": "The original source literally states constraints are unknown; it does not supply numeric bounds.",
                "siteInputSupplement": "This candidate discloses n<=100000, capacity<=50000 and |station[i]|<=1e9. The capacity bound guarantees answer <=625025000 so it fits the source int return type."}}]})
    review_items = json.loads(REVIEW.read_text(encoding="utf-8"))["items"]
    review_reason = next(item["reason"] for item in review_items if item["id"] == identifier)
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": review_reason,
        "reason": "已在固定 e66f809 快照中核实原始 Fastprep 文件 `deshaw-min-acquire-cost.md`，因此旧 review 所称对应源文件缺失不成立。原文对选址目标、互异/避开警局、最近距离成本和恰好购买 capacity 个定义完整；唯一缺口是约束文本为 unknown。候选没有猜原约束，而是显式增加本站边界，并证明最大答案 625025000 符合 int。120 个穷举有限坐标域的独立 oracle、边界和两个正常退出 mutants 通过。"}]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(seen) - len(cases), "negativeControls": controls,
            "maxCapacity": max_capacity, "maxIntSafeCost": max_int_safe_cost}],
        "note": "本地独立穷举 oracle、重复/相邻警局与坐标平移边界、int 上界压力和两个正常退出 mutant 验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, unique oracle={len(random_cases)}, mutants={len(controls)} killed, capacity stress={max_capacity}")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    actual_blob = subprocess.check_output(["git", "rev-parse", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT, text=True).strip()
    raw_source = subprocess.check_output(["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT)
    assert actual_blob == RAW_BLOB
    assert hashlib.sha256(raw_source).hexdigest() == RAW_SHA256
    rng = random.Random(20261006)
    build(catalog, rng)


if __name__ == "__main__":
    main()
