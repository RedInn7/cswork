#!/usr/bin/env python3
"""Generate and locally validate an isolated candidate for IMC #1."""

from __future__ import annotations

import bisect
import hashlib
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
REVIEW = OA / "reviews" / "trading-platform-candidates.json"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/imc.mdx"
RAW_BLOB = "528cd8cffa74943bf5e0f26741ecd4d13ab26a27"
RAW_SHA256 = "e44923f8e0aad18c9104e219998b38b300eb43038803d008512657ebd311989e"
CONTENT_HASH = "6b291f9fe330f3a64def816434d4d277d3055442c6cf79b57ecd89eaee7e88c2"


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


REFERENCE = r'''import bisect
import sys

def min_waste_set(requirements, container_sets):
    best_index = -1
    best_waste = None
    for index, containers in enumerate(container_sets, 1):
        ordered = sorted(containers)
        total = 0
        feasible = True
        for required in requirements:
            pos = bisect.bisect_left(ordered, required)
            if pos == len(ordered):
                feasible = False
                break
            total += ordered[pos] - required
        if feasible and (best_waste is None or total < best_waste):
            best_index = index
            best_waste = total
    return best_index

def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) < 2:
        raise ValueError("missing requirement/set counts")
    r, s = values[0], values[1]
    if len(values) < 2 + r:
        raise ValueError("missing requirements")
    requirements = values[2:2 + r]
    pos = 2 + r
    container_sets = []
    for _ in range(s):
        if pos >= len(values):
            raise ValueError("missing container count")
        count = values[pos]
        pos += 1
        if pos + count > len(values):
            raise ValueError("missing container sizes")
        container_sets.append(values[pos:pos + count])
        pos += count
    if pos != len(values):
        raise ValueError("unexpected trailing input")
    return str(min_waste_set(requirements, container_sets))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read()))
'''


def encode(requirements: list[int], container_sets: list[list[int]]) -> str:
    lines = [f"{len(requirements)} {len(container_sets)}", " ".join(map(str, requirements))]
    for containers in container_sets:
        lines.append(str(len(containers)))
        lines.append(" ".join(map(str, containers)))
    return "\n".join(lines) + "\n"


def run(code: str, raw: str, timeout: int = 10) -> str:
    with tempfile.TemporaryDirectory(prefix="imc1-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=timeout, check=True)
        return proc.stdout.decode("ascii").strip()


def oracle(requirements: list[int], container_sets: list[list[int]]) -> str:
    best_index = -1
    best_waste = None
    for i, containers in enumerate(container_sets, 1):
        total = 0
        feasible = True
        for required in requirements:
            options = [size for size in containers if size >= required]
            if not options:
                feasible = False
                break
            total += min(options) - required
        if feasible and (best_waste is None or total < best_waste):
            best_index, best_waste = i, total
    return str(best_index)


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-imc-1", "imc-1-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    formal = [
        ([10, 15], [[5, 30, 20, 10], [10, 5, 15, 20, 30]], "原题示例"),
        ([10], [[9, 10], [10, 100]], "并列浪费时选更早的容器组"),
        ([10, 20], [[9, 10]], "没有任何容器组能完成所有订单"),
        ([5], [[6, 100], [5]], "精确匹配优先于更大容器"),
        ([10, 20], [[10, 19], [11, 20]], "订单逐项累计浪费"),
        ([1], [[1_000_000_000]], "本站最大容量边界"),
        ([2], [[3]], "单订单单容器组"),
        ([7, 7], [[7], [8, 8]], "重复需求与零浪费"),
        ([4, 9], [[4, 8], [5, 9]], "只存在一个可行组"),
        ([3], [[3, 3, 10], [3, 8]], "重复容量"),
        ([6, 10], [[6, 9], [7, 10], [6, 10]], "三个容器组比较"),
        ([5], [[4, 4], [6], [7]], "并列时仍选最低下标"),
        ([5, 10], [[5, 9], [5, 10]], "较早组无法完成后续订单"),
        ([2, 4, 6], [[2, 4, 6]], "每笔订单均精确匹配"),
        ([2, 4, 6], [[3, 5, 7]], "每笔订单均产生单位浪费"),
        ([10], [[1, 10, 10, 20]], "容量列表已排序且有重复"),
        ([10], [[20, 10, 1]], "容量列表逆序"),
        ([10, 11], [[10, 10], [11, 12]], "分组中缺少一个订单容量"),
        ([1, 1, 1], [[2], [1]], "重复订单分别计入总浪费"),
        ([100], [[99, 100], [101]], "相邻需求边界"),
        ([1], [[1], [1], [1]], "多个完全相同方案的并列"),
        ([9, 10, 11], [[9, 10, 11], [10, 11, 12]], "多订单总浪费决策"),
        ([10, 20], [[10, 20], [11, 21]], "两组总浪费相同"),
        ([30], [[29], [30], [31]], "低于需求的容量不可用"),
        ([1] * 2000, [[1_000_000_000]], "本站订单数上界与 64 位浪费累计"),
        ([1_000_000_000], [[999_999_999], [1_000_000_000]], "最大需求精确匹配"),
        ([8, 16], [[8, 15], [9, 16], [10, 17]], "需跨不同容量选择"),
        ([5, 5, 12], [[5, 11], [6, 12], [5, 12]], "重复需求影响总浪费"),
        ([12], [[12, 13, 14], [13, 13, 13]], "单组内部多种更大容量"),
        ([3, 5], [[3, 4], [5, 6], [3, 5]], "可行组与不可行组交错"),
    ]
    cases = []
    for i, (requirements, sets, name) in enumerate(formal):
        raw = encode(requirements, sets)
        expected = oracle(requirements, sets)
        assert run(REFERENCE, raw) == expected
        cases.append({"name": name, "input": raw, "expectedOutput": expected + "\n",
                      "hidden": i != 0, "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    while len(random_cases) < 160:
        requirements = [rng.randint(1, 30) for _ in range(rng.randint(1, 9))]
        sets = [[rng.randint(1, 35) for _ in range(rng.randint(1, 10))]
                for _ in range(rng.randint(1, 7))]
        raw = encode(requirements, sets)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(requirements, sets)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    largest_mutant = REFERENCE.replace(
        "total += ordered[pos] - required", "total += ordered[-1] - required")
    skip_unfillable_mutant = REFERENCE.replace(
        "            if pos == len(ordered):\n                feasible = False\n                break\n            total += ordered[pos] - required",
        "            if pos < len(ordered):\n                total += ordered[pos] - required")
    mutants = [
        ("选择满足订单的最大容器而不是最小容器", largest_mutant),
        ("忽略没有可用容器的订单，错误地接受不完整容器组", skip_unfillable_mutant),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for i, (requirements, sets, _) in enumerate(formal):
            if run(code, encode(requirements, sets)) != oracle(requirements, sets):
                rejected.append(i)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    stress_requirements = list(range(1, 2001))
    stress_sets = [[rng.randint(1, 1_000_000_000) for _ in range(500)] for _ in range(100)]
    stress_input = encode(stress_requirements, stress_sets)
    stress_output = run(REFERENCE, stress_input, timeout=20)
    assert len(stress_output) <= 4

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Pharmaceutical Waste Reduction", "difficulty": "中等",
        "tags": ["OA", "IMC", "排序", "二分查找", "贪心"],
        "description": "给定多个容器组和多个订单。每个订单必须由单个容器完整装满；对当前容器组，选择容量不小于订单需求的最小容器，浪费为容量减需求。若某组无法完成任一订单，则该组不可行。求总浪费最少的可行容器组，返回其 1-based 下标；并列时取下标最小者。若没有可行组，原题三种参考实现均返回 -1，本站明确采用 -1。",
        "input": "第一行输入订单数 R 和容器组数 S。第二行输入 R 个需求量。随后对每组输入一行容器数 C，再输入 C 个容量。本站资源边界：1≤R≤2000，1≤S≤100，1≤C≤2000，所有需求量及容量为 1..10^9，所有容器组容量总数≤100000。原题未给数值规模；此处只补资源上限，不改变选容器与浪费定义。",
        "output": "输出最优容器组的 1-based 下标；若不存在能完成全部订单的容器组，输出 -1（这是本站约定，与固定源的 Python、Java、C++ 三实现一致）。",
        "explanation": "对每组容器排序。对每个订单二分查找第一个容量不小于需求的容器；找到后累计差值，找不到则放弃此容器组。最终比较所有可行组的总浪费。",
        "hints": ["对每个容器组先排序，再用 lower_bound 找每笔订单对应的最小可行容量。"],
        "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n对每个容器组单独排序。对每笔需求 r 使用 lower_bound 找到第一个容量 `c≥r` 的容器，贡献 `c-r`。若任何订单找不到这样的容器，该组不可行；否则累加总浪费。扫描容器组，保留总浪费严格更小者，因此并列时自然保留更早下标。若所有组都不可行，按本站约定返回 -1。\n\n"
        "## 正确性\n\n固定订单 r 后，所有能装满它的容器容量都满足 `c≥r`，浪费随 c 增大而增大，所以 lower_bound 找到的最小可行容器产生最小浪费。各订单独立使用一个容器，故逐单最小化后求和得到该容器组的最小总浪费。遍历所有可行容器组并按严格小于更新即可得到全局最优及最早下标；无可行组时输出 -1。\n\n"
        "## 复杂度\n\n令 S 为容器组数，R 为订单数，C_i 为第 i 组容量数。时间 `O(Σ C_i log C_i + RΣ log C_i)`，空间 `O(max C_i)`。"
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
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [12, 113]}],
            "resolvedSemantics": {
                "selection": "For each requirement independently, use the smallest available container size >= the requirement; sum waste across all requirements and minimize over feasible sets.",
                "ties": "The statement specifies the lowest 1-based set index; all three implementations update only on strictly lower waste.",
                "no_feasible_set": "The source statement does not specify this result. Python, Java, and C++ fixed-snapshot implementations all initialize the result index to -1 and return it when no set is feasible; candidate adopts -1 as an explicit site convention.",
                "siteConstraints": "Source has no numeric scale limits. Candidate adds R<=2000, S<=100, each C_i<=2000, sum(C_i)<=100000, and positive integer values <=1e9 solely as resource bounds."
            }}]})
    review_items = json.loads(REVIEW.read_text(encoding="utf-8"))["items"]
    review_reason = next(item["reason"] for item in review_items if item["id"] == identifier)
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": review_reason,
        "reason": "题面明确了订单装箱、剩余量、最小化总浪费和并列规则。唯一未定义行为是所有容器组均无法覆盖全部订单；固定快照的 Python、Java、C++ 三份实现都返回 -1，候选将其标明为本站约定。另只增加订单数、容器组数、容量总数及正整数值域上限以控制资源，不改核心目标。独立直接枚举 oracle、不可行组/并列/精确匹配边界和两个正常退出 mutant 验证通过。"
    }]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(seen) - len(cases), "negativeControls": controls,
            "stressRequirements": len(stress_requirements), "stressSets": len(stress_sets),
            "stressTotalContainers": sum(map(len, stress_sets)), "stressOutput": stress_output}],
        "note": "本地独立暴力选容器 oracle、无可行组/并列/容量边界及两个正常退出 mutant 验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, unique oracle={len(random_cases)}, mutants={len(controls)} killed, stress=R{len(stress_requirements)}/S{len(stress_sets)}")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    build(catalog, random.Random(20261006))


if __name__ == "__main__":
    main()
