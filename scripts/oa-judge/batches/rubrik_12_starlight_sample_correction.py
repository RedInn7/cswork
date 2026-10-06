"""Prepare a source-backed candidate correcting Rubrik #12's bad sample."""
from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-rubrik-12"
BATCH = "rubrik-12-starlight-sample-correction"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/rubrik.mdx"
SOURCE_BLOB = "27ce8deadb8ef015ef1db75b5f6f5b1a3dd036c2"
SOURCE_HASH = "d6ff718ac94280f3fb10f4f0e1a6443215dffe018ac9a3ba127bfe098b428552"
PREVIOUS_REASON = "公开样例 2 的输出值与所给变换结果的最大连续子数组和不一致，无法判断目标究竟是整体和还是连续子数组和。"
SEED = 20261006

REFERENCE = r'''import sys

def solve(raw):
    tokens = list(map(int, raw.split()))
    if len(tokens) < 2:
        raise ValueError("expected n z and n array values")
    n, z = tokens[:2]
    arr = tokens[2:]
    if not 1 <= n <= 200000 or len(arr) != n:
        raise ValueError("site protocol: 1<=n<=200000, followed by exactly n values")
    if not -100 <= z <= 100 or any(not -10**9 <= x <= 10**9 for x in arr):
        raise ValueError("site protocol: -100<=z<=100 and -1e9<=arr[i]<=1e9")
    neg = -(10**30)
    before, inside, after = 0, neg, neg
    best = 0
    for x in arr:
        before_next = max(0, before + x)
        inside_next = max(before + z * x, inside + z * x)
        after_next = max(inside + x, after + x)
        before, inside, after = before_next, inside_next, after_next
        best = max(best, before, inside, after)
    return str(best)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode(arr: list[int], z: int) -> str:
    return f"{len(arr)} {z}\n" + " ".join(map(str, arr)) + "\n"


def kadane(arr: list[int]) -> int:
    best = current = 0
    for x in arr:
        current = max(0, current + x)
        best = max(best, current)
    return best


def brute(arr: list[int], z: int) -> int:
    """Enumerate every amplified interval and independently run Kadane."""
    best = kadane(arr)
    for left in range(len(arr)):
        for right in range(left, len(arr)):
            changed = arr[:]
            for i in range(left, right + 1):
                changed[i] *= z
            best = max(best, kadane(changed))
    return best


def execute(code: str, raw: str) -> str:
    run = subprocess.run([sys.executable, "-I", "-c", code], input=raw,
                         text=True, capture_output=True, check=True, timeout=5)
    return run.stdout.strip()


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    item = next(row for row in catalog["items"] if row["id"] == PID)
    assert item["contentHash"] == SOURCE_HASH
    assert item["sourceUrl"].endswith("#12-starlight")
    statement = item["statement"]
    assert "maximum overall sum" in statement and "consecutive light cluster" in statement
    assert "at most once" in statement and "range from none of the stars" in statement
    assert "arr = [-5, -9, -2, 1, -6]" in statement
    assert "sum of `[9, 6, -3, 18]` which is `30`" in statement
    source = subprocess.run(["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
                            text=True, capture_output=True, check=True).stdout
    blob = subprocess.run(["git", "rev-parse", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
                          text=True, capture_output=True, check=True).stdout.strip()
    assert blob == SOURCE_BLOB
    assert "maximum overall sum of luminance of any\nconsecutive light cluster" in source
    assert "any chosen segment\nwithin the constellation by a factor of `z`" in source
    assert "30\n```" in source

    public = [([3, 2], 2, 10), ([-5, -9, -2, 1, -6], -3, 63), ([1, 2, 4, 5], -2, 12)]
    assert [brute(a, z) for a, z, _ in public] == [10, 63, 12]
    hidden = [
        ([-4], -2), ([0], 0), ([7], -1), ([-3, -5, -1, -4], 2),
        ([1, -1], -2), ([-5, -9, -2, 1, -6], -3), ([4, -8, 5, -2], 3),
        ([3, 2, -7, 4], -1), ([-1, -1, -1], -100), ([2, -5, 7], 0),
        ([5, -10, 5, -10, 5], -2), ([-6, 4, -3, 8, -9], 4),
        ([1, 1, 1, 1], -1), ([-2, 0, 2, 0, -2], 5), ([9, -20, 9], -3),
        ([2, -1, 2, -1, 2], 2), ([-1, 3, -1, 3, -1], -2),
        ([0, -5, 0], 100), ([10, -1, -1, 10], -3), ([-7, 2, 2, -7], 1),
    ]
    cases, oracle_rows = [], []
    all_cases = [(a, z, ans, False) for a, z, ans in public]
    all_cases += [(a, z, brute(a, z), True) for a, z in hidden]
    for idx, (arr, z, expected, is_hidden) in enumerate(all_cases):
        raw = encode(arr, z)
        assert brute(arr, z) == expected
        assert execute(REFERENCE, raw) == str(expected), (arr, z, expected)
        case = {"name": f"样例 {idx + 1}" if not is_hidden else f"隐藏边界 {idx - len(public) + 1}",
                "input": raw, "expectedOutput": f"{expected}\n", "hidden": is_hidden, "weight": 1}
        cases.append(case)
        oracle_rows.append({"input": raw, "expectedOutput": f"{expected}\n"})

    rng = random.Random(SEED)
    unique = {row["input"] for row in oracle_rows}
    while len(oracle_rows) < 180:
        arr = [rng.randint(-20, 20) for _ in range(rng.randint(1, 8))]
        z = rng.randint(-5, 5)
        raw = encode(arr, z)
        if raw in unique:
            continue
        expected = brute(arr, z)
        assert execute(REFERENCE, raw) == str(expected)
        unique.add(raw)
        oracle_rows.append({"input": raw, "expectedOutput": f"{expected}\n"})

    mutants = [
        {"name": "错误地只允许放大一个元素", "code": "import sys\nt=list(map(int,sys.stdin.read().split()));n,z=t[:2];a=t[2:];b=0\nfor i in range(n):\n c=a[:];c[i]*=z;s=m=0\n for x in c:s=max(0,s+x);m=max(m,s)\n b=max(b,m)\nprint(b)\n"},
        {"name": "错误地只能放大整个数组", "code": "import sys\nt=list(map(int,sys.stdin.read().split()));n,z=t[:2];a=t[2:]\ndef k(b):\n s=m=0\n for x in b:s=max(0,s+x);m=max(m,s)\n return m\nprint(max(k(a),k([x*z for x in a])))\n"},
    ]
    controls = []
    for mutant in mutants:
        rejected = [i for i, case in enumerate(cases)
                    if execute(mutant["code"], case["input"]) != case["expectedOutput"].strip()]
        assert rejected, mutant["name"]
        controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    editorial = """## 思路

使用三个状态描述计分连续段处于放大段之前、放大段之内、放大段之后。状态记录以当前位置结尾的最大连续和；普通位置加 `x`，放大位置加 `z*x`。答案包含空区间 0，因为原题明确全负数组 beauty 为 0，也允许不使用放大器。时间 O(n)，空间 O(1)。

## 为什么正确

任意最优计分连续段中的位置只有三种阶段：放大区间之前、之内、之后，且顺序不能逆转。三个状态逐位置保留各阶段下以当前位置结尾的最大和；转移分别只允许普通延续、开始或延续放大区间、结束放大区间后的普通延续，因此覆盖所有合法选择且不生成非法顺序。取所有阶段与空区间的最大值即为全局最优。

## 样例勘误

固定题源定义为放大一个连续片段后，求任意连续片段的最大和；被放大的片段可以是整个数组。样例 2 整个数组乘以 -3 后为 `[15,27,6,-3,18]`，其总和及最大连续和都是 63。原输出 30 以及解释所列的 `[9,6,-3,18]` 都与原数组不符。只修正该样例输出及解释，不改规则。题源下界 `10^-9` 与整数类型及负数示例冲突；本站采用明确披露的可执行边界 `n<=200000`、`-10^9<=a[i]<=10^9`、`-100<=z<=100`，不声称这是已知上游约束。"""
    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "星光放大（Rubrik OA）", "difficulty": "中等",
        "tags": ["OA", "Rubrik", "动态规划", "最大子数组"],
        "description": "给定整数数组和乘数 z，至多一次选择连续片段将其中每个数乘以 z，再求变换后数组的最大连续子数组和。允许不放大及空子数组，答案至少为 0。固定来源样例 2 的输出由 30 更正为 63。",
        "input": "第一行 n z（1≤n≤200000，-100≤z≤100）；第二行 n 个整数（-10^9≤a[i]≤10^9）。",
        "output": "输出最大可能的连续子数组和。",
        "explanation": "用三个状态记录计分连续段在放大段前、段内、段后的最大和。来源样例 2 整个数组乘以 -3 可得 63，原答案 30 有误。",
        "hints": ["按计分连续段与放大段的相对位置划分状态。", "放大段必须非空；不使用放大器时保留普通最大子数组和。", "空连续段的得分为 0。"],
        "timeLimit": 3, "memoryLimit": 65536, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    package = {"schemaVersion": 1, "problem": problem, "cases": cases}
    checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode())
    entry = {"id": PID, "sourceContentHash": SOURCE_HASH, "packageChecksum": checksum,
             "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCE}]}
    source_evidence = {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT, "sourceFile": {"path": SOURCE_PATH, "gitBlob": SOURCE_BLOB},
        "catalogContentHash": SOURCE_HASH,
        "sampleCorrection": {"example": 2, "sourceOutput": 30, "correctedOutput": 63,
            "basis": "The source permits multiplying any chosen contiguous segment, including the whole array, and scores the maximum contiguous sum. Multiplying the full sample by -3 yields [15,27,6,-3,18], whose total and maximum contiguous sum are 63."},
        "sourceConstraintCaveat": "The source lower bound 10^-9 conflicts with integer values and negative examples. Site input limits are explicitly site-added, not upstream facts.",
        "siteProtocol": "n z then n signed integers; n<=200000, -1e9<=a[i]<=1e9, -100<=z<=100; signed 64-bit result.",
    }
    resolution = {"schemaVersion": 1, "items": [{
        "id": PID, "batch": BATCH, "sourceContentHash": SOURCE_HASH,
        "previousReason": PREVIOUS_REASON,
        "reason": "The source explicitly says the beauty is the maximum sum of a consecutive segment, the multiplier may be applied to any chosen segment, and amplification is at most once. Multiplying the whole displayed array is therefore allowed and gives [15,27,6,-3,18], whose maximum consecutive sum is 63. Output 30 and the explanation's purported subarray are inconsistent with the fixed source semantics. Candidate changes only that example and discloses site-added bounds because the source's lower-bound typography conflicts with the integer/negative examples.",
    }]}
    validation = {"schemaVersion": 1, "seed": SEED, "problems": [{
        "id": PID, "oracleCases": len(oracle_rows),
        "uniqueOracleInputs": len({r["input"] for r in oracle_rows}),
        "referenceStdioCases": len(oracle_rows), "publicCases": len(public),
        "hiddenCases": len(hidden), "negativeControls": controls,
        "sampleOracle": {"example2SourceOutput": 30, "independentOutput": 63},
        "localValidationOnly": True,
    }]}
    outputs = [
        ("packages", PID + ".json", package), ("references", PID + ".py", REFERENCE),
        ("oracles", PID + ".json", oracle_rows), ("mutants", PID + ".json", mutants),
        ("editorials", PID + ".json", {"schemaVersion": 1, "id": PID, "title": problem["title"],
            "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
            "sourceUrl": item["sourceUrl"], "sourceContentHash": SOURCE_HASH, "author": "CSWork"}),
        ("source-evidence", BATCH + ".json", source_evidence),
        ("resolutions", BATCH + ".json", resolution), ("validation", BATCH + ".json", validation),
    ]
    for folder, filename, value in outputs:
        path = OA / folder / filename
        if isinstance(value, str):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(value, encoding="utf-8")
        else:
            put(path, value)
    for number, mutant in enumerate(mutants, 1):
        path = OA / "negative-controls" / f"{PID}-{number}.py"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(mutant["code"], encoding="utf-8")
    put(OA / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [entry]})
    print(json.dumps({"id": PID, "status": "candidate", "oracleCases": len(oracle_rows),
                      "formalCases": len(cases), "sampleCorrection": "30 -> 63",
                      "mutantsKilled": len(controls)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
