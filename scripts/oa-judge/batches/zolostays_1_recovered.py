"""Recover Zolostays #1 with an explicitly corrected source sample."""
from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
BATCH = "zolostays-1-recovered"
PID = "oa-zolostays-1"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/zolostays.mdx"
SOURCE_BLOB = "c856db2fc854ebab4bf4c4c18c103907870bba3c"
SOURCE_HASH = "50c0c06011e600c36c746e789637bbb5b416b982d5b76868f6d0b13b132ccbc1"
PREVIOUS_REASON = (
    "Range Sum 样例2与定义冲突：直接枚举连续子数组得到13个和落在[-2,6]，"
    "源样例却输出8；其余样例不能消歧该错误，需修正源样例再做唯一判题。"
)
SEED = 20261006

REFERENCE = r'''import sys

def count_range_sum(arr, lower, upper):
    prefix = [0]
    for value in arr:
        prefix.append(prefix[-1] + value)
    scratch = [0] * len(prefix)

    def sort_count(lo, hi):
        if hi - lo <= 1:
            return 0
        mid = (lo + hi) // 2
        count = sort_count(lo, mid) + sort_count(mid, hi)
        left_bound = right_bound = mid
        for i in range(lo, mid):
            while left_bound < hi and prefix[left_bound] - prefix[i] < lower:
                left_bound += 1
            while right_bound < hi and prefix[right_bound] - prefix[i] <= upper:
                right_bound += 1
            count += right_bound - left_bound
        i, j, k = lo, mid, lo
        while i < mid and j < hi:
            if prefix[i] <= prefix[j]:
                scratch[k] = prefix[i]
                i += 1
            else:
                scratch[k] = prefix[j]
                j += 1
            k += 1
        while i < mid:
            scratch[k] = prefix[i]
            i += 1
            k += 1
        while j < hi:
            scratch[k] = prefix[j]
            j += 1
            k += 1
        prefix[lo:hi] = scratch[lo:hi]
        return count

    return sort_count(0, len(prefix))

def solve(raw):
    tokens = list(map(int, raw.split()))
    if not tokens:
        raise ValueError("missing n")
    n = tokens[0]
    if not 1 <= n <= 50000 or len(tokens) != n + 3:
        raise ValueError("site protocol: 1 <= n <= 50000, n values, lower, upper")
    arr = tokens[1:n + 1]
    lower, upper = tokens[n + 1:]
    if any(not -(2**31) <= value < 2**31 for value in arr + [lower, upper]):
        raise ValueError("array values and bounds must be signed 32-bit integers")
    if lower > upper:
        raise ValueError("lower must not exceed upper")
    return str(count_range_sum(arr, lower, upper))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode(arr: list[int], lower: int, upper: int) -> str:
    return f"{len(arr)}\n" + " ".join(map(str, arr)) + f"\n{lower} {upper}\n"


def oracle(arr: list[int], lower: int, upper: int) -> str:
    """Independent O(n^2) definition: enumerate every contiguous subarray."""
    total = 0
    for start in range(len(arr)):
        running = 0
        for end in range(start, len(arr)):
            running += arr[end]
            total += lower <= running <= upper
    return str(total)


def execute(code: str, raw: str) -> str:
    completed = subprocess.run(
        [sys.executable, "-c", code], input=raw, text=True,
        capture_output=True, check=True, timeout=5,
    )
    return completed.stdout.strip()


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(x for x in catalog["items"] if x["id"] == PID)
    assert item["contentHash"] == SOURCE_HASH
    assert item["sourceUrl"].endswith("#1-range-sum")
    assert "number of range sums" in item["statement"]
    assert "There are eight ranges" in item["statement"]
    source = subprocess.run(
        ["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    blob = subprocess.run(
        ["git", "rev-parse", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    assert blob == SOURCE_BLOB
    assert "Return the number of range sums that lie in `[lower, upper]` inclusive." in source
    assert "arr = [1, -3, 5, 2, 5, 2, -5]" in source
    assert "**Output:**\n```\n8\n```" in source
    assert "int countRangeSum(int[] arr, int lower, int upper)" in source

    public = [
        ([-2, 5, -1], -2, 2, "3"),
        ([1, -3, 5, 2, 5, 2, -5], -2, 6, "13"),
        ([1, -3, 5, -2, 2, 5, -1, 10], 5, 9, "12"),
    ]
    assert [oracle(a, lo, hi) for a, lo, hi, _ in public] == ["3", "13", "12"]
    hidden = [
        ([0], 0, 0), ([1], -1, 1), ([-1], -1, -1), ([1, -1], 0, 0),
        ([1, 1, 1], 2, 2), ([2, -2, 2, -2], 0, 0),
        ([3, -1, -2, 5], 0, 0), ([-4, 2, 2, -4], -4, 0),
        ([5, 5, -10, 0], 0, 5), ([2, -1, 2, -1], 1, 2),
        ([-3, -3, 6, -6], -6, -3), ([0, 0, 0, 0], 0, 0),
        ([7, -7, 7, -7], -1, 1), ([1, 2, 3], 3, 6),
        ([-2, -2, -2], -4, -2), ([9, -4, -3, 1], 2, 6),
        ([1, -1, 1, -1, 1], 1, 1), ([2, 2, 2, 2], 4, 8),
        ([-5, 10, -5], 0, 0), ([4, -9, 7, -2, 1], -3, 4),
    ]

    rng = random.Random(SEED)
    cases = []
    expected_formal = []
    for i, (arr, lower, upper, *given) in enumerate(public + [(*case, None) for case in hidden]):
        expected = given[0] if given and given[0] is not None else oracle(arr, lower, upper)
        assert oracle(arr, lower, upper) == expected
        raw = encode(arr, lower, upper)
        assert execute(REFERENCE, raw) == expected
        expected_formal.append(expected)
        cases.append({
            "name": f"样例 {i + 1}" if i < len(public) else f"隐藏边界 {i - len(public) + 1}",
            "input": raw, "expectedOutput": expected + "\n",
            "hidden": i >= len(public), "weight": 1,
        })

    mutants = [
        {
            "name": "只统计非负区间和",
            "code": """import sys\nt=list(map(int,sys.stdin.read().split()));n=t[0];a=t[1:n+1];lo,hi=t[n+1:];c=0\nfor i in range(n):\n s=0\n for x in a[i:]:\n  s+=x\n  if lo<=s<=hi and s>=0:c+=1\nprint(c)\n""",
        },
        {
            "name": "错误地把 upper 当成开区间",
            "code": REFERENCE.replace("<= upper", "< upper"),
        },
    ]
    negative_controls = []
    for mutant in mutants:
        rejected = [i for i, case in enumerate(cases)
                    if execute(mutant["code"], case["input"]) != expected_formal[i]]
        assert rejected, mutant["name"]
        negative_controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    oracle_rows = []
    seen = {case["input"] for case in cases}
    for index in range(180):
        n = 1 + index % 36
        arr = [rng.randint(-20, 20) for _ in range(n)]
        lower = rng.randint(-30, 0)
        upper = rng.randint(0, 30)
        raw = encode(arr, lower, upper)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(arr, lower, upper)
        assert execute(REFERENCE, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})
    assert len(oracle_rows) >= 120

    editorial = """## 为什么正确

令 `prefix[0]=0`，`prefix[j]` 表示前 j 个数之和。以 j 结尾的连续子数组和为 `prefix[j]-prefix[i]`，其中 `i<j`。要让和落在闭区间 `[lower, upper]`，需满足 `prefix[i]+lower <= prefix[j] <= prefix[i]+upper`。

对前缀和做归并排序。在左右两段各自有序时，固定左段的 `prefix[i]`，用两个单调指针统计右段中差值落入闭区间的元素个数；再合并两段。每个递归层处理 O(n) 个元素，总时间 O(n log n)，空间 O(n)。

## 样例勘误

固定来源对样例 2 只写了“有 8 个”，没有列出区间；按题目明确定义直接枚举全部连续子数组，和处于 `[-2, 6]` 的共有 13 个。输入和题意不改，只将该样例输出由 8 更正为 13。样例 1 与样例 3 的答案分别仍为 3 和 12。

## 本站输入格式

第一行 n，第二行 n 个整数，第三行 lower 和 upper。本站将 n 限定为 `1..50000`，数组元素和边界取 32 位有符号整数，且 `lower<=upper`；该大小限制保证结果最大值 `n(n+1)/2` 可由 32 位有符号输出容纳。原固定来源没有给出约束，因此这些是本站为了定义可执行接口与数值范围所加的边界，不冒充来源约束。"""

    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "区间和计数（Zolostays OA）", "difficulty": "中等",
        "tags": ["OA", "Zolostays", "前缀和", "归并排序"],
        "description": "给定整数数组 arr 和闭区间 [lower, upper]，统计有多少个连续非空子数组的元素和落在该区间内。等价子数组按起止位置分别计数。固定来源的第二个样例输出从 8 更正为 13，依据见讲义。",
        "input": "第一行 n（1≤n≤50000）；第二行 n 个 32 位有符号整数；第三行 lower upper（均为 32 位有符号整数且 lower≤upper）。",
        "output": "输出连续子数组和处于闭区间 [lower, upper] 的数量。",
        "explanation": "用前缀和把区间和转为两个前缀和之差，再通过归并排序与双指针在 O(n log n) 时间内计数。第二个公开样例的来源输出误写为 8，直接枚举定义得 13。",
        "hints": ["使用 n+1 个前缀和并包含空前缀 0。", "在归并过程中，左右半区的前缀和均已排序。", "上下界都是闭区间，两个移动指针分别寻找 lower 与 upper 的边界。"],
        "timeLimit": 3, "memoryLimit": 65536, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    package = {"schemaVersion": 1, "problem": problem, "cases": cases}
    checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode())
    entry = {
        "id": PID, "sourceContentHash": SOURCE_HASH, "packageChecksum": checksum,
        "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }
    source_evidence = {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT,
        "sourceFile": {"path": SOURCE_PATH, "gitBlob": SOURCE_BLOB},
        "catalogContentHash": SOURCE_HASH,
        "sampleCorrection": {
            "example": 2, "sourceOutput": 8, "correctedOutput": 13,
            "basis": "Exhaustive direct enumeration of the seven-element array under the explicitly stated inclusive interval rule gives 13; examples 1 and 3 independently agree with the same definition.",
        },
        "sourceConstraints": "The fixed source does not specify constraints. Candidate site protocol uses 1<=n<=50000 and signed 32-bit array/bound values; this is explicitly a site-added contract, not source metadata.",
        "siteProtocol": "n, then n integers, then lower upper; lower<=upper.",
    }
    resolution = {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": SOURCE_HASH,
            "previousReason": PREVIOUS_REASON,
            "reason": "The fixed source uniquely defines counting non-empty contiguous subarrays whose sum lies in the inclusive interval. Its example 2 output is arithmetically wrong: independent exhaustive enumeration yields 13; examples 1 and 3 verify the same semantics. The candidate preserves the definition and corrects only example 2's answer. Since the source gives no constraints, site-added limits are disclosed rather than represented as upstream facts.",
        }],
    }
    validation = {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
            "referenceStdioCases": len(oracle_rows),
            "publicCases": len(public), "hiddenCases": len(hidden),
            "negativeControls": negative_controls,
            "sampleOracle": {"example2SourceOutput": 8, "independentOutput": 13},
            "localValidationOnly": True,
        }],
    }

    for folder, name, value in [
        ("packages", PID + ".json", package),
        ("references", PID + ".py", REFERENCE),
        ("oracles", PID + ".json", oracle_rows),
        ("mutants", PID + ".json", mutants),
        ("editorials", PID + ".json", {
            "schemaVersion": 1, "id": PID, "title": problem["title"],
            "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
            "sourceUrl": item["sourceUrl"], "sourceContentHash": SOURCE_HASH, "author": "CSWork",
        }),
        ("source-evidence", BATCH + ".json", source_evidence),
        ("resolutions", BATCH + ".json", resolution),
        ("validation", BATCH + ".json", validation),
    ]:
        path = OA / folder / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(value, str):
            path.write_text(value, encoding="utf-8")
        else:
            put(path, value)
    for index, mutant in enumerate(mutants, 1):
        path = OA / "negative-controls" / f"{PID}-{index}.py"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(mutant["code"], encoding="utf-8")
    put(OA / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [entry]})
    print(json.dumps({
        "id": PID, "status": "candidate", "oracleCases": len(oracle_rows),
        "formalCases": len(cases), "sampleCorrectedFrom": 8,
        "sampleCorrectedTo": 13, "mutantsKilled": len(negative_controls),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
