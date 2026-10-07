"""Build and locally validate the Amazon #151 K-level permutation candidate."""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-amazon-151"
BATCH = "amazon-151-k-level-recovered"
SEED = 20261006
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/amazon.mdx"
RAW_BLOB = "70650fad830ad60944ae8036fb4f134d9afc3fab"
CONTENT_HASH = "268b9e03a1a2d646ddae095d2f5be5f4e0ee371e11e96e0df98780474251b943"
SOURCE_URL = "https://oamaster.com/docs/companies/amazon#151-find-k-level-permutation"
AMAZON_SOURCE = "https://www.1point3acres.com/interview/problems/amazon-find-k-level-permutation"
CF_SOURCE = "https://codeforces.com/contest/1927/problem/E"
PREVIOUS_REASON = "原始题干截断于1到N数组，K-level条件未定义，单个排列样例不能恢复规则。"


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def construct(n: int, k: int) -> list[int]:
    """Alternate low/high value runs across residues modulo even k."""
    result = [0] * n
    low, high = 1, n
    for residue in range(k):
        for index in range(residue, n, k):
            if residue % 2 == 0:
                result[index] = low
                low += 1
            else:
                result[index] = high
                high -= 1
    return result


def check_spec(n: int, k: int, permutation: list[int]) -> bool:
    """Independent semantic oracle: permutation and all contiguous K sums."""
    if not (2 <= k <= n <= 200_000 and k % 2 == 0):
        return False
    if len(permutation) != n or sorted(permutation) != list(range(1, n + 1)):
        return False
    window = sum(permutation[:k])
    minimum = maximum = window
    for index in range(k, n):
        window += permutation[index] - permutation[index - k]
        minimum = min(minimum, window)
        maximum = max(maximum, window)
        if maximum - minimum > 1:
            return False
    return True


REFERENCE = '''def construct(n, k):
    result = [0] * n
    low, high = 1, n
    for residue in range(k):
        for index in range(residue, n, k):
            if residue % 2 == 0:
                result[index] = low
                low += 1
            else:
                result[index] = high
                high -= 1
    return result

def solve(raw):
    n, k = map(int, raw.split())
    if not (2 <= k <= n <= 200_000 and k % 2 == 0):
        raise ValueError("require 2 <= K <= N <= 200000 and even K")
    return " ".join(map(str, construct(n, k)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def solve_code(code: str, n: int, k: int) -> list[int]:
    scope: dict[str, object] = {"__name__": "candidate"}
    exec(compile(code, "<candidate>", "exec"), scope)
    text = str(scope["solve"](f"{n} {k}\n"))
    return list(map(int, text.split())) if text.strip() else []


def main() -> None:
    start_time = time.perf_counter()
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(row for row in catalog["items"] if row["id"] == PID)
    assert (item["contentHash"], item["sourceUrl"], item["title"]) == (
        CONTENT_HASH, SOURCE_URL, "Find K-Level Permutation"
    )
    raw = subprocess.run(
        ["git", "show", f"{UPSTREAM_COMMIT}:{RAW_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    blob = subprocess.run(
        ["git", "hash-object", "--stdin"], cwd=ROOT, input=raw,
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    assert blob == RAW_BLOB
    assert "151. Find K-Level Permutation" in raw
    assert "N = 7\nK = 4" in raw
    assert "[1, 7, 3, 5, 2, 6, 4]" in raw
    reviews = json.loads((OA / "reviews/amazon-remaining-g.json").read_text())
    prior = next(row for row in reviews["items"] if row["id"] == PID)
    assert prior["reason"] == PREVIOUS_REASON

    # Oracle inputs are distinct, deterministic and independently judged from
    # the semantic contract rather than by comparing one exact permutation.
    rng = random.Random(SEED)
    oracle_inputs = [(7, 4)]
    seen = set(oracle_inputs)
    while len(oracle_inputs) < 160:
        n = rng.randint(2, 100)
        k = rng.choice(list(range(2, n + 1, 2)))
        if (n, k) not in seen:
            seen.add((n, k))
            oracle_inputs.append((n, k))
    oracle_rows = []
    for n, k in oracle_inputs:
        permutation = construct(n, k)
        assert check_spec(n, k, permutation), (n, k, permutation)
        oracle_rows.append({
            "input": f"{n} {k}\n",
            "expectedOutput": " ".join(map(str, permutation)) + "\n",
        })

    # Exhaustively prove the constructed output against the literal definition
    # over every small valid N/K pair; check_spec recomputes each window sum.
    exhaustive = 0
    for n in range(2, 81):
        for k in range(2, n + 1, 2):
            permutation = construct(n, k)
            assert check_spec(n, k, permutation), (n, k, permutation)
            exhaustive += 1

    formal_inputs = [(7, 4)]
    formal_inputs += [(k, k) for k in range(2, 26, 2)]
    formal_inputs += [(k + 1, k) for k in range(2, 26, 2)]
    formal_inputs += [
        (200_000, 2),
        (200_000, 200_000),
        (200_000, 100_000),
        (199_999, 199_998),
        (100_001, 100_000),
        (73, 24),
        (128, 10),
    ]
    assert len(formal_inputs) == 32 and len(set(formal_inputs)) == 32
    formal_cases = []
    expected_by_input = {}
    for index, (n, k) in enumerate(formal_inputs):
        permutation = construct(n, k)
        assert check_spec(n, k, permutation), (n, k)
        expected = " ".join(map(str, permutation)) + "\n"
        name = "OAMaster 样例" if index == 0 else f"边界与构造 {index:02d}"
        formal_cases.append({
            "name": name, "input": f"{n} {k}\n",
            "expectedOutput": expected, "hidden": index != 0, "weight": 1,
        })
        expected_by_input[(n, k)] = expected

    old_solution = '''def solve(raw):
 n,k=map(int,raw.split()); out=[]; lo,hi=1,k+1
 while lo<=hi:
  out.append(lo)
  if lo!=hi: out.append(hi)
  lo+=1; hi-=1
 out.extend(range(k+2,n+1)); return " ".join(map(str,out))
'''
    monotone_residues = '''def solve(raw):
 n,k=map(int,raw.split()); out=[0]*n; value=1
 for r in range(k):
  for i in range(r,n,k): out[i]=value; value+=1
 return " ".join(map(str,out))
'''
    mutants = [
        {"name": "沿用旧的 K+1 折返后顺序追加构造", "code": old_solution},
        {"name": "每个余数类都递增填入而未交替高低", "code": monotone_residues},
    ]
    killed = []
    for mutant in mutants:
        rejected = []
        for index, (n, k) in enumerate(formal_inputs):
            out = solve_code(mutant["code"], n, k)
            if not check_spec(n, k, out):
                rejected.append(index)
        assert rejected, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejected})

    sample = construct(7, 4)
    assert sample == [1, 7, 3, 5, 2, 6, 4]
    sample_sums = [sum(sample[i : i + 4]) for i in range(4)]
    assert sample_sums == [16, 17, 16, 17]

    editorial = f"""## 构造

把位置按下标对 K 取余分为 K 组，编号 0,1,…,K−1。偶数组按从左到右的顺序填入当前最小值 1,2,…；奇数组按从左到右填入当前最大值 N,N−1,…。每一步递增 low 或递减 high。遍历结束时恰好使用 1..N 各一次。

## 正确性证明

任意长度 K 的连续窗口恰好包含每个余数类的一个位置。将窗口左端从 i 移到 i+1，窗口和的变化是 `p[i+K]−p[i]`。两个位置属于同一余数类；该组中相邻元素在构造序列里恰差 1：偶数组递增，故差为 +1；奇数组递减，故差为 −1。因为 K 为偶数，i 与 i+K 的奇偶性相同；当左端每次右移一格，所经过的位置余数奇偶交替，窗口和变化便交替为 +1、−1。因此所有窗口和只会在两个相邻整数之间交替，最大值与最小值之差不超过 1。N=K 时仅有一个窗口，条件显然成立。

## 复杂度

每个位置只写入一次，时间 O(N)，空间 O(N)（用于输出排列）。

## 验证

用独立的排列/滑动窗口定义检查 160 个唯一 oracle 输入；对每个 2≤N≤80 及每个偶数 K≤N 穷举构造，共 {exhaustive:,} 组。32 个正式用例包括固定 OAMaster 样例及 N=200000 的边界。两个错误构造在语义检查器下均被拒绝。

## 来源与本站补充

Amazon 同题页给出 “所有长度 K 的连续窗口中最大和与最小和之差不超过 1” 的定义。[1Point3Acres](https://www.1point3acres.com/interview/problems/amazon-find-k-level-permutation) 明确重述同一条件；Codeforces 官方 [1927E Klever Permutation](https://codeforces.com/contest/1927/problem/E) 也给出相同定义和偶数 K 条件。固定 OAMaster 样例 `[1,7,3,5,2,6,4]` 的四个窗口和为 {sample_sums}，最大值 17、最小值 16。本站补充单组标准输入输出协议以及 2≤K≤N、K 为偶数、N≤200000；不声称这些界限来自 OAMaster。"""

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "K 级排列构造", "difficulty": "中等",
            "tags": ["OA", "Amazon", "构造", "排列"],
            "description": "给定 N 和偶数 K，构造 1..N 的一个排列，使所有长度 K 的连续子数组和中，最大值与最小值之差不超过 1。可返回任意一个满足条件的排列。完整定义由 Amazon 同题来源及 Codeforces 1927E 对照恢复。",
            "input": "一行两个整数 N K。本站补充约束：2≤K≤N≤200000，且 K 为偶数。",
            "output": "输出 N 个整数，代表一个满足条件的排列。允许任意合法排列，不要求与样例或题解顺序相同。",
            "explanation": "固定 OAMaster 样例输出 [1,7,3,5,2,6,4]；四个长度 4 窗口和为 16、17、16、17。",
            "hints": ["长度 K 的窗口每次滑动一格，只会移出一个数、移入 K 位之后的数。", "将位置按模 K 分组；K 偶数允许相邻窗口和变化交替。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "oa-k-level-permutation", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": formal_cases,
    }
    schema_script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    parsed = subprocess.run(
        ["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
        input=json.dumps(raw_package, ensure_ascii=False), text=True,
        capture_output=True,
    )
    if parsed.returncode:
        raise RuntimeError(parsed.stderr)
    package = json.loads(parsed.stdout)
    canonical = json.dumps(package, ensure_ascii=False, separators=(",", ":"))
    authored = [{"language": "python", "code": REFERENCE}]
    put(OA / f"packages/{PID}.json", package)
    (OA / f"references/{PID}.py").write_text(REFERENCE)
    put(OA / f"oracles/{PID}.json", oracle_rows)
    put(OA / f"mutants/{PID}.json", mutants)
    put(OA / f"editorials/{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": authored,
        "sourceUrl": SOURCE_URL, "sourceContentHash": CONTENT_HASH,
        "author": "Chunyu Sui",
    })
    put(OA / f"candidate-batches/{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "sourceContentHash": CONTENT_HASH,
        "packageChecksum": sha(canonical), "editorial": editorial,
        "authoredSolutions": authored,
    }]})
    put(OA / f"source-evidence/{BATCH}.json", {
        "schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": UPSTREAM_COMMIT,
        "origin": "https://oamaster.com",
        "items": {PID: {
            "url": SOURCE_URL, "contentHash": CONTENT_HASH,
            "catalogContentHash": CONTENT_HASH,
            "company": "Amazon", "title": "Find K-Level Permutation",
            "path": RAW_PATH, "gitBlobSha": RAW_BLOB,
            "blobVerification": "Read from the immutable commit; git hash-object matches the recorded blob SHA.",
            "corroboratingSources": [
                {"url": AMAZON_SOURCE, "verifiedOn": "2026-10-06", "supports": "Identifies the same Amazon question and states the max-minus-min length-K window sum condition; its page says source constraints are unspecified."},
                {"url": CF_SOURCE, "verifiedOn": "2026-10-06", "supports": "Official statement defines any two length-K continuous segment sums differing by at most one and says K is even."},
            ],
            "sampleVerification": {"input": "N=7,K=4", "permutation": [1, 7, 3, 5, 2, 6, 4], "windowSums": [16, 17, 16, 17]},
            "siteAdded": "Single-case stdin/stdout protocol and 2≤K≤N≤200000, even K; these are site limits, not attributed to the OAMaster source.",
            "upstreamSolutionNote": "The stored OAMaster explanatory text/code describes a different adjacent-difference construction and does not satisfy the recovered window-sum condition; candidate does not copy that implementation.",
        }},
    })
    put(OA / f"resolutions/{BATCH}.json", {
        "schemaVersion": 1, "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": CONTENT_HASH,
            "previousReason": prior["reason"],
            "reason": "1Point3Acres 同题定义与 Codeforces 官方 1927E 定义一致，均要求长度 K 窗口和的 max-min≤1 且 K 为偶数；固定 OAMaster 样例逐个计算为 16/17，确认匹配。旧 OAMaster 解释/代码未满足条件，已独立重写。本站输入协议和 N≤200000 明确标为补充。构造经完整证明、小域穷举、随机 oracle 与错误构造验证；待 GoJudge。",
        }],
    })
    put(OA / f"validation/{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED, "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({row["input"] for row in oracle_rows}),
            "referenceStdioCases": len(oracle_rows) + len(formal_cases),
            "publicCases": 1, "hiddenCases": len(formal_cases) - 1,
            "exhaustiveDifferentialComparisons": exhaustive,
            "negativeControls": killed,
            "sampleWindowSums": sample_sums,
            "maxNFormalCase": 200_000,
            "referenceSha256": sha(REFERENCE),
            "localValidationOnly": True,
        }],
    })

    ref_path = OA / f"references/{PID}.py"
    for row in oracle_rows + [
        {"input": case["input"], "expectedOutput": case["expectedOutput"]}
        for case in formal_cases
    ]:
        result = subprocess.run(
            ["python3", "-I", str(ref_path)], cwd=ROOT,
            input=row["input"], text=True, capture_output=True,
            timeout=5, check=True,
        )
        assert result.stdout == row["expectedOutput"]
        n, k = map(int, row["input"].split())
        assert check_spec(n, k, list(map(int, result.stdout.split())))

    # Exercise the same production semantic checker against the generated
    # outputs, including acceptance of a distinct correct solution.
    node = '''const { matchesOaSemantic }=require('./lib/oa-semantic-checkers.mjs');
const input='7 4\\n', expected='1 7 3 5 2 6 4\\n';
if(!matchesOaSemantic('oa-k-level-permutation','1 6 3 7 2 5 4\\n',expected,input)) process.exit(1);
'''
    subprocess.run(["node", "-e", node], cwd=ROOT, check=True)
    print(json.dumps({
        "id": PID, "candidateBatch": BATCH,
        "oracleCases": len(oracle_rows), "uniqueOracleInputs": len(seen),
        "formalCases": len(formal_cases),
        "exhaustiveDifferentialComparisons": exhaustive,
        "negativeControls": killed,
        "sampleWindowSums": sample_sums,
        "elapsedSeconds": round(time.perf_counter() - start_time, 3),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
