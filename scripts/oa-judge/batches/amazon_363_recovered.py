"""Recover and independently validate Amazon #363 from the complete OAMaster page.

This generator is deliberately scoped to one candidate. It does not modify the
runtime registry or aggregate batches; GoJudge verification and promotion are
separate release gates.
"""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content" / "oa-judge"
BATCH = "amazon-363-recovered"
IDENT = "oa-amazon-363"
SEED = 20261006
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_MDX = "web/content/docs/companies/amazon.mdx"
SOURCE_MDX_BLOB = "70650fad830ad60944ae8036fb4f134d9afc3fab"
SOURCE_URL = "https://oamaster.com/docs/companies/amazon#363-count-spikes"
SOURCE_CONTENT_HASH = "2c3df236860f5dcddb75f93bf3da179965831424daa0379a18647c68caa87c51"


REFERENCE = """from bisect import bisect_left


class Fenwick:
    def __init__(self, size):
        self.tree = [0] * (size + 1)

    def add(self, index, delta):
        while index < len(self.tree):
            self.tree[index] += delta
            index += index & -index

    def prefix_sum(self, index):
        total = 0
        while index > 0:
            total += self.tree[index]
            index -= index & -index
        return total


def count_spikes(prices, k):
    n = len(prices)
    ordered = sorted(set(prices))
    ranks = [bisect_left(ordered, value) + 1 for value in prices]
    left_less = [0] * n
    right_less = [0] * n

    bit = Fenwick(len(ordered))
    for i, rank in enumerate(ranks):
        left_less[i] = bit.prefix_sum(rank - 1)
        bit.add(rank, 1)

    bit = Fenwick(len(ordered))
    for i in range(n - 1, -1, -1):
        rank = ranks[i]
        right_less[i] = bit.prefix_sum(rank - 1)
        bit.add(rank, 1)

    return sum(left_less[i] >= k and right_less[i] >= k for i in range(n))


def solve(raw):
    data = list(map(int, raw.split()))
    n, k = data[0], data[1]
    prices = data[2:2 + n]
    return str(count_spikes(prices, k))


if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
"""


def encode(prices: list[int], k: int) -> str:
    return f"{len(prices)} {k}\n" + " ".join(map(str, prices)) + "\n"


def oracle(prices: list[int], k: int) -> int:
    """Directly count smaller values on both sides; intentionally O(n^2)."""
    answer = 0
    for i, value in enumerate(prices):
        left = sum(other < value for other in prices[:i])
        right = sum(other < value for other in prices[i + 1:])
        answer += left >= k and right >= k
    return answer


def random_case(rng: random.Random) -> tuple[list[int], int]:
    n = rng.randint(1, 18)
    # A compact value range intentionally creates ties, which exercise strictness.
    prices = [rng.randint(1, 8) for _ in range(n)]
    return prices, rng.randint(1, n)


def run_python(path: Path, stdin: str) -> str:
    result = subprocess.run(
        [sys.executable, "-I", str(path)], input=stdin, text=True,
        capture_output=True, timeout=10, check=True,
    )
    return result.stdout.rstrip("\n")


def normalize(package: dict) -> dict:
    js = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');"
        "let s='';process.stdin.setEncoding('utf8');"
        "process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write("
        "JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    result = subprocess.run(
        ["node", "--import", "tsx", "-e", js], cwd=ROOT,
        input=json.dumps(package, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    )
    return json.loads(result.stdout)


def main() -> None:
    for folder in (
        "packages", "references", "oracles", "editorials", "mutants",
        "negative-controls", "candidate-batches", "validation",
        "source-evidence", "reviews",
    ):
        (OUT / folder).mkdir(parents=True, exist_ok=True)

    reference_path = OUT / "references" / f"{IDENT}.py"
    reference_path.write_text(REFERENCE, encoding="utf-8")

    public_examples = [
        ("官网样例 1", [1, 2, 8, 5, 3, 4], 2, 2),
        ("本站补充公开边界样例 1", [1, 2, 2, 1, 2], 1, 2),
        ("本站补充公开边界样例 2", [7, 7, 7, 7, 7], 1, 0),
    ]
    tied_values = ([2, 1, 2, 1, 2, 1, 2], 2)
    value_boundary = ([1, 1_000_000_000, 1, 1_000_000_000, 1], 1)
    rng = random.Random(SEED)
    generated = [random_case(rng) for _ in range(160)]

    oracle_cases = []
    for _, prices, k, expected in public_examples:
        assert oracle(prices, k) == expected
        assert run_python(reference_path, encode(prices, k)) == str(expected)
        oracle_cases.append({"input": encode(prices, k), "expectedOutput": f"{expected}\n"})
    tied_expected = oracle(*tied_values)
    assert run_python(reference_path, encode(*tied_values)) == str(tied_expected)
    oracle_cases.append({"input": encode(*tied_values), "expectedOutput": f"{tied_expected}\n"})
    boundary_expected = oracle(*value_boundary)
    assert run_python(reference_path, encode(*value_boundary)) == str(boundary_expected)
    oracle_cases.append({"input": encode(*value_boundary), "expectedOutput": f"{boundary_expected}\n"})
    for prices, k in generated:
        expected = oracle(prices, k)
        actual = run_python(reference_path, encode(prices, k))
        assert actual == str(expected), (prices, k, expected, actual)
        oracle_cases.append({"input": encode(prices, k), "expectedOutput": f"{expected}\n"})

    # These exact counts follow from the definition, without using the slow oracle.
    stress = [
        (list(range(1, 50_001)) + list(range(50_000, 0, -1)), 25_000, 50_000, "最大规模对称峰形"),
        (list(range(1, 100_001)), 1, 0, "最大规模严格递增"),
        (list(range(100_000, 0, -1)), 1, 0, "最大规模严格递减"),
        ([9] * 100_000, 1, 0, "最大规模全重复"),
    ]
    case_specs = [(prices, k, expected, False, label)
                  for label, prices, k, expected in public_examples]
    case_specs.append((*tied_values, tied_expected, True, "重复值严格比较"))
    case_specs.append((*value_boundary, boundary_expected, True, "值域边界：1 与 1e9"))
    case_specs.extend(
        (prices, k, oracle(prices, k), True, f"随机差分 {i + 1}")
        for i, (prices, k) in enumerate(generated[:26])
    )
    case_specs.extend(
        (prices, k, expected, True, label)
        for prices, k, expected, label in stress
    )

    judge_cases = []
    for prices, k, expected, hidden, name in case_specs:
        stdin = encode(prices, k)
        actual = run_python(reference_path, stdin)
        assert actual == str(expected), (name, expected, actual)
        judge_cases.append({
            "name": name,
            "input": stdin,
            "expectedOutput": f"{expected}\n",
            "hidden": hidden,
            "weight": 1,
        })

    mutants = [
        (
            "把严格小于误写成小于等于",
            REFERENCE.replace("bit.prefix_sum(rank - 1)", "bit.prefix_sum(rank)"),
        ),
        (
            "把至少 k 个误写成多于 k 个",
            REFERENCE.replace(
                "left_less[i] >= k and right_less[i] >= k",
                "left_less[i] > k and right_less[i] > k",
            ),
        ),
    ]
    mutant_docs = []
    kills = []
    for number, (name, mutant_code) in enumerate(mutants, start=1):
        assert mutant_code != REFERENCE, name
        mutant_path = OUT / "negative-controls" / f"{IDENT}-{number}.py"
        mutant_path.write_text(mutant_code, encoding="utf-8")
        rejected = [
            index for index, case in enumerate(judge_cases)
            if run_python(mutant_path, case["input"])
            != case["expectedOutput"].rstrip("\n")
        ]
        assert rejected, (name, "mutant survived")
        mutant_docs.append({"name": name, "code": mutant_code})
        kills.append({"name": name, "rejectedByCases": rejected})

    problem = {
        "id": IDENT,
        "courseId": "gomall",
        "lessonId": "00-overview",
        "title": "统计 k-Spike 数量",
        "difficulty": "中等",
        "tags": ["OA", "Amazon", "数组", "树状数组"],
        "description": (
            "若 prices[i] 左侧至少有 k 个严格小于 prices[i] 的元素，且右侧也至少有 k 个，"
            "则称它为 k-Spike。给定数组 prices 和整数 k，统计 k-Spike 的数量。"
        ),
        "input": (
            "第一行输入 n 和 k；第二行输入 n 个整数 prices[i]。"
            "约束：1≤n≤100000，1≤k≤n，1≤prices[i]≤1000000000。"
        ),
        "output": "输出 k-Spike 的数量。",
        "explanation": "示例答案为 2：值 8 和值 5 均满足条件。",
        "hints": ["分别统计每个位置左侧、右侧严格更小元素的数量；可用坐标压缩和树状数组。"],
        "timeLimit": 5,
        "memoryLimit": 262144,
        "outputLimit": 4096,
        "checker": "tokens",
        "languages": ["python", "go", "java", "cpp"],
    }
    package = normalize({
        "schemaVersion": 1,
        "problem": problem,
        "cases": judge_cases,
    })
    package_json = json.dumps(package, ensure_ascii=False, separators=(",", ":"))
    editorial_text = (
        "## 思路\n\n"
        "坐标压缩后从左向右扫描，树状数组查询当前值之前的频次，得到左侧严格更小的数量；"
        "再从右向左做同样的查询得到右侧数量。两者都不少于 k 时计数。相同值的 rank 不包含在查询前缀中。\n\n"
        "## 正确性证明\n\n"
        "坐标压缩保持数值大小关系。处理位置 i 时，树状数组恰好包含其一侧所有位置的值；"
        "查询 rank[i]-1 只累计严格小于 prices[i] 的值，等值不会被计入。正向扫描因此精确得到每个位置左侧较小元素数，"
        "反向扫描精确得到右侧较小元素数。按定义同时满足两侧计数至少为 k，当且仅当该位置是 k-Spike，逐项累加即为答案。\n\n"
        "## 复杂度\n\n时间 O(n log n)，空间 O(n)。"
    )
    editorial = {
        "schemaVersion": 1,
        "id": IDENT,
        "title": problem["title"],
        "explanation": editorial_text,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL,
        "sourceContentHash": SOURCE_CONTENT_HASH,
        "author": "CSWork",
    }

    (OUT / "packages" / f"{IDENT}.json").write_text(
        json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "references" / f"{IDENT}.py").write_text(REFERENCE, encoding="utf-8")
    (OUT / "oracles" / f"{IDENT}.json").write_text(
        json.dumps(oracle_cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "editorials" / f"{IDENT}.json").write_text(
        json.dumps(editorial, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "mutants" / f"{IDENT}.json").write_text(
        json.dumps(mutant_docs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    candidate = {
        "schemaVersion": 1,
        "items": [{
            "id": IDENT,
            "sourceContentHash": SOURCE_CONTENT_HASH,
            "packageChecksum": hashlib.sha256(package_json.encode()).hexdigest(),
            "editorial": editorial_text,
            "authoredSolutions": editorial["solutions"],
        }],
    }
    (OUT / "candidate-batches" / f"{BATCH}.json").write_text(
        json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    validation = {
        "schemaVersion": 1,
        "seed": SEED,
        "problems": [{
            "id": IDENT,
            "oracleCases": len(oracle_cases),
            "publicCases": 3,
            "hiddenCases": len(judge_cases) - 3,
            "negativeControls": kills,
            "referenceSha256": hashlib.sha256(REFERENCE.encode()).hexdigest(),
            "maxInputN": 100_000,
        }],
        "note": "独立 O(n^2) oracle 与 Fenwick 参考解本地差分通过；3 个 n=100000 边界输入通过；两个 mutant 均被拒。尚未运行 GoJudge，也未发布。",
    }
    (OUT / "validation" / f"{BATCH}.json").write_text(
        json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    evidence = {
        "sourceCommit": SOURCE_COMMIT,
        "mdxPath": SOURCE_MDX,
        "mdxGitBlob": SOURCE_MDX_BLOB,
        "catalogPath": "content/oa-master/catalog.json",
        "items": [{
            "id": IDENT,
            "title": "Count Spikes",
            "sourceUrl": SOURCE_URL,
            "catalogContentHash": SOURCE_CONTENT_HASH,
            "liveSourceCheckedAt": "2026-10-06",
            "liveSourceHttpStatus": 200,
            "confirmedStatement": "左右两侧分别至少有 k 个严格小于 prices[i] 的元素。",
            "confirmedConstraints": [
                "1 ≤ n ≤ 10^5", "1 ≤ k ≤ n", "1 ≤ prices[i] ≤ 10^9",
            ],
            "confirmedOfficialExample1": "prices=[1,2,8,5,3,4], k=2 -> 2",
            "supplementalPublicExamples": [
                "本站补充：prices=[1,2,2,1,2], k=1 -> 2（覆盖重复值与严格比较）",
                "本站补充：prices=[7,7,7,7,7], k=1 -> 0（覆盖全相等边界）",
            ],
            "supersedesEarlierBlockedClaim": (
                "旧扫描依据 fastprep/Amazon/count-spikes.md 的 OCR/HTML 文本，该原始摘录在条件处截断且无数值约束；"
                "OAMaster 正式题页当前正文明确给出两侧严格较小条件、完整约束和一致样例。"
            ),
            "priorTruncatedSource": {
                "path": "fastprep/Amazon/count-spikes.md",
                "gitBlobSha1": "c4f83bdcea7cf2a73f0bb6d45984cab0c5ee9727",
            },
        }],
    }
    (OUT / "source-evidence" / f"{BATCH}.json").write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    review = {
        "schemaVersion": 1,
        "items": [{
            "id": IDENT,
            "status": "authored",
            "reason": "官网完整题面已复核；独立 oracle、Fenwick 标准解、边界输入与两个语义 mutant 均通过本地验证。待 GoJudge 沙箱验证。",
            "sourceCommit": SOURCE_COMMIT,
            "rawPath": SOURCE_MDX,
            "rawGitBlob": SOURCE_MDX_BLOB,
            "catalogContentHash": SOURCE_CONTENT_HASH,
        }],
    }
    (OUT / "reviews" / f"{BATCH}.json").write_text(
        json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(
        f"{IDENT}: {len(oracle_cases)} independent oracle cases; "
        f"{len(judge_cases)} package cases; both mutants killed; "
        "n=100000 boundary checks passed. Candidate only; not published.",
        flush=True,
    )


if __name__ == "__main__":
    main()
