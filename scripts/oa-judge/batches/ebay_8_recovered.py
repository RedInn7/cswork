#!/usr/bin/env python3
"""Generate and locally validate an isolated candidate for eBay #8."""

from __future__ import annotations

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
REVIEW = OA / "reviews" / "ebay-next.json"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/ebay.mdx"
RAW_BLOB = "a23244e93e3dae0097a070529d1b7883507e08a9"
RAW_SHA256 = "f425ac54e5fcf2c9a60b55946357b5f079f8c358035776b29472dfacd09902d4"
CONTENT_HASH = "3e33c5dede37f8aa928bc09e06e55c9f4a3577ee15940079b59eaa78eb2fbd83"


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


REFERENCE = r'''import sys

def solve(raw):
    tokens = raw.split()
    if not tokens:
        raise ValueError("missing query count")
    n = int(tokens[0])
    if len(tokens) != n + 1:
        raise ValueError("query count does not match input")
    starts = {}
    ends = {}
    best = 0
    answers = []
    for token in tokens[1:]:
        q = int(token)
        left = q
        right = q
        if q - 1 in ends:
            left = ends.pop(q - 1)
            starts.pop(left)
        if q + 1 in starts:
            right = starts.pop(q + 1)
            ends.pop(right)
        starts[left] = right
        ends[right] = left
        best = max(best, right - left + 1)
        answers.append(str(best))
    return "\n".join(answers)

if __name__ == "__main__":
    result = solve(sys.stdin.buffer.read())
    if result:
        print(result)
'''


def encode(queries: list[int]) -> str:
    return str(len(queries)) + "\n" + "\n".join(map(str, queries)) + "\n"


def run(code: str, raw: str, timeout: int = 10) -> str:
    with tempfile.TemporaryDirectory(prefix="ebay8-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=timeout, check=True)
        return proc.stdout.decode("ascii").strip()


def oracle(queries: list[int]) -> str:
    occupied: set[int] = set()
    answers = []
    for q in queries:
        occupied.add(q)
        best = current = 0
        previous = None
        for value in sorted(occupied):
            current = current + 1 if previous is not None and value == previous + 1 else 1
            best = max(best, current)
            previous = value
        answers.append(str(best))
    return "\n".join(answers)


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-ebay-8", "ebay-8-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    formal = [
        ([2, 1, 3], "原题示例：逐步合并左右相邻房屋"),
        ([1, 3, 0, 4], "原题示例：保留多个连续段中的最大值"),
        ([7], "单次建房"),
        ([0, 2, 1], "插入后同时连接左右区间"),
        ([-1_000_000_000, 1_000_000_000], "坐标边界与分离区间"),
        ([5, 4, 3, 2, 1], "反向逐步扩展长区间"),
    ]
    cases = []
    for i, (queries, name) in enumerate(formal):
        raw = encode(queries)
        expected = oracle(queries)
        assert run(REFERENCE, raw) == expected
        cases.append({"name": name, "input": raw, "expectedOutput": expected + "\n",
                      "hidden": i not in (0, 1), "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    while len(random_cases) < 160:
        n = rng.randint(1, 35)
        queries = rng.sample(range(-100, 101), n)
        raw = encode(queries)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(queries)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        ("只与左侧区间合并，忽略右侧相邻区间", REFERENCE.replace(
            "        if q + 1 in starts:\n            right = starts.pop(q + 1)\n            ends.pop(right)\n", "")),
        ("插入时最多只扩展一格，不合并完整左右区间", REFERENCE.replace(
            "        if q - 1 in ends:\n            left = ends.pop(q - 1)\n            starts.pop(left)\n        if q + 1 in starts:\n            right = starts.pop(q + 1)\n            ends.pop(right)",
            "        if q - 1 in ends:\n            left = ends.pop(q - 1)\n            starts.pop(left)\n            right = q\n        elif q + 1 in starts:\n            right = starts.pop(q + 1)\n            ends.pop(right)")),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for i, (queries, _) in enumerate(formal):
            if run(code, encode(queries)) != oracle(queries):
                rejected.append(i)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    max_n = 10_000
    stress_queries = list(range(max_n))
    stress_input = encode(stress_queries)
    stress_output = run(REFERENCE, stress_input, timeout=20)
    assert stress_output == "\n".join(map(str, range(1, max_n + 1)))
    assert len((stress_output + "\n").encode()) <= 65_536

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "House Density (Longest Contiguous Segment)", "difficulty": "中等",
        "tags": ["OA", "eBay", "并查集", "区间合并"],
        "description": "数轴上按 queries 顺序逐个建房，房屋位置互不重复。每次建房后，返回所有房屋位置中最长连续整数区间的长度。固定源中的示例与三种语言实现都包含插入时与已有房屋相邻的情形，因此本站按这些可执行定义判题：插入可以与左侧、右侧或两侧区间相邻，并立即合并。",
        "input": "第一行输入 q（1≤q≤10000），随后 q 行各输入一个位置 x（−10^9≤x≤10^9）；所有位置互不相同。原题没有给出数值边界，q 和 x 的范围为本站补充；q≤10000 确保逐次输出不超过题库 65536 字节上限。",
        "output": "输出 q 行；第 i 行为前 i 次建房后最长连续房屋区间的长度。",
        "explanation": "连续区间按整数位置定义；新房屋只会合并相邻的左区间、右区间或二者。答案是每一步所有区间长度的最大值。",
        "hints": ["维护每个连续区间的左右端点；插入 x 时检查 x−1 和 x+1 是否为现有区间端点。"],
        "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 65536,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n用两个哈希表记录连续区间的左右端点：`starts[l]=r`，`ends[r]=l`。插入 x 时，若 `ends` 中有 x−1，则吸收左区间；若 `starts` 中有 x+1，则吸收右区间。登记合并后的新区间，并更新历史最大长度。\n\n"
        "## 正确性\n\n插入前每个已建房屋恰好属于一个连续区间。新位置 x 只可能连接以 x−1 结尾的左区间和以 x+1 开始的右区间；检查并移除这两个端点后登记合并区间，其他区间不变。因此区间表始终准确表示全部房屋的最大连续段。由于只新增房屋，历史最大值不会下降。\n\n"
        "## 复杂度\n\n每次插入进行常数次哈希表操作，期望时间 O(q)，空间 O(q)。"
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
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [549, 584]}],
            "resolvedSemantics": {
                "positionUniqueness": "Locations are distinct, as the source states.",
                "adjacencyErratum": "The sentence claiming a new house is never adjacent contradicts both examples and all three Python/Java/C++ implementations, which merge neighboring intervals. Candidate removes only this contradictory non-adjacency restriction; insertions may touch either or both existing intervals.",
                "siteConstraints": "The source has no numeric bounds. Candidate adds q<=10000 and -1e9<=x<=1e9; q bound keeps at most 6 output bytes per answer within the 65536-byte package output limit."
            }}]})
    review_items = json.loads(REVIEW.read_text(encoding="utf-8"))["items"]
    review_reason = next(item["reason"] for item in review_items if item["id"] == identifier)
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": review_reason,
        "reason": "固定快照中的两个样例及 Python、Java、C++ 三份实现都允许新房屋与已有房屋相邻并合并；这与正文中的“建造时不相邻”一句直接冲突。候选保留位置唯一规则，明确按三个实现和样例移除矛盾限制。原源未给规模，本站补 q≤10000、坐标绝对值≤10^9，并将 q 限制在单题 65536 字节输出上限内。独立排序集合 oracle、边界样例和两个正常退出错误实现均验证通过。"
    }]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(seen) - len(cases), "negativeControls": controls,
            "maxQ": max_n, "stressOutputBytes": len((stress_output + "\n").encode())}],
        "note": "本地独立排序集合 oracle、两侧区间合并/坐标边界和两个正常退出 mutant 验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, unique oracle={len(random_cases)}, mutants={len(controls)} killed, q stress={max_n}")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    build(catalog, random.Random(20261006))


if __name__ == "__main__":
    main()
