"""Recover and validate Google OA #56 from its three-language snapshot."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-56"
BATCH = "google-56-recovered"
SEED = 20261008
SOURCE_URL = "https://oamaster.com/docs/companies/google#56-minimum-operations-to-make-binary-palindromic"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
UPSTREAM_GOOGLE_BLOB = "b44446404ff98e6bf74fd5f10b0b0a052137ca8517023ae77b14aa159093ea8d"
MAX_N = 2_000_000_000

REFERENCE = r'''import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) != 1 or not 0 <= values[0] <= 2_000_000_000:
        raise ValueError("expected one N in [0, 2000000000]")
    n = values[0]
    best = n
    for bits in range(1, 32):
        half = (bits + 1) // 2
        low = 1 << (half - 1)
        high = (1 << half) - 1
        prefix = n >> (bits // 2)
        for first in {low, high, max(low, min(high, prefix)), max(low, min(high, prefix - 1)), max(low, min(high, prefix + 1))}:
            text = format(first, "b")
            mirrored = text + (text[:-1] if bits % 2 else text)[::-1]
            candidate = int(mirrored, 2)
            best = min(best, abs(candidate - n))
    return str(best)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    (
        "只检查 N 本身，不向两侧寻找",
        r'''import sys
n=int(sys.stdin.read())
b=bin(n)[2:]
print(0 if b==b[::-1] else 1)
''',
    ),
    (
        "只生成不大于 N 的回文数，遗漏向上最近值",
        r'''import sys
n=int(sys.stdin.read()); best=n
for x in range(max(0,n-1000),n+1):
 b=bin(x)[2:]
 if b==b[::-1]: best=min(best,n-x)
print(best)
''',
    ),
]


def run(program: str, raw: str) -> str:
    result = subprocess.run(["python3", "-c", program], input=raw, text=True,
                            capture_output=True, timeout=5, check=False)
    if result.returncode != 0:
        raise AssertionError((result.returncode, result.stderr[:300], raw[:100]))
    return result.stdout.strip()


def is_binary_palindrome(value: int) -> bool:
    bits = format(value, "b")
    return bits == bits[::-1]


def oracle_small(value: int) -> int:
    """Independent outward scan, used only for small generated values."""
    distance = 0
    while True:
        if value - distance >= 0 and is_binary_palindrome(value - distance):
            return distance
        if is_binary_palindrome(value + distance):
            return distance
        distance += 1


def nearest_from_exhaustive_candidates(value: int) -> int:
    """Enumerate every palindrome up to 31 bits for large boundary checks."""
    candidates = []
    for bits in range(1, 32):
        half = (bits + 1) // 2
        for prefix in range(1 << (half - 1), 1 << half):
            text = format(prefix, "b")
            mirrored = text + (text[:-1] if bits % 2 else text)[::-1]
            candidates.append(int(mirrored, 2))
    return min(abs(value - candidate) for candidate in candidates)


def encode(value: int) -> str:
    return f"{value}\n"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(folder: str, filename: str, document: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    review_path = OA / "reviews/google-remaining-b.json"
    old_review = next(item for item in json.loads(review_path.read_text(encoding="utf-8"))["items"] if item["id"] == PID)

    fixed = [0, 1, 2, 5, 6, 7, 8, 9, 10, 15, 16, 17, 31, 32, 33,
             2**30 - 1, 2**30, 2**30 + 1, MAX_N - 2, MAX_N - 1, MAX_N]
    rng = random.Random(SEED)
    values = list(fixed)
    seen = set(values)
    while len(values) < 121:
        value = rng.randint(0, 10_000)
        if value not in seen:
            values.append(value)
            seen.add(value)

    oracle_rows = []
    for value in values:
        expected = (str(oracle_small(value)) if value <= 10_000
                    else str(nearest_from_exhaustive_candidates(value)))
        raw = encode(value)
        assert run(REFERENCE, raw) == expected, (value, expected)
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    formal_values = [6, 0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14,
                     15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
                     28, 31, 32, 2**30, MAX_N - 1, MAX_N]
    cases = []
    for index, value in enumerate(formal_values):
        expected = (str(oracle_small(value)) if value <= 10_000
                    else str(nearest_from_exhaustive_candidates(value))) + "\n"
        cases.append({
            "name": "示例 1" if index == 0 else f"边界用例 {index}",
            "input": encode(value), "expectedOutput": expected,
            "hidden": index != 0, "weight": 1,
        })

    killed = []
    mutant_docs = []
    for name, program in MUTANTS:
        rejects = [index for index, case in enumerate(cases)
                   if run(program, case["input"]) != case["expectedOutput"].strip()]
        assert rejects, f"surviving mutant: {name}"
        killed.append({"name": name, "rejectedByCases": rejects})
        mutant_docs.append({"name": name, "code": program})

    description = (
        "给定非负整数 N。一次操作可以将当前整数加 1 或减 1（结果不能小于 0）。"
        "当 N 的标准二进制表示从左到右与从右到左相同时，称它为二进制回文数。"
        "求把 N 变成任意二进制回文数所需的最少操作次数。"
    )
    limits = f"本站输入范围：0≤N≤{MAX_N}。OAMaster 快照未给出额外约束；该范围按快照列出的约束收录。"
    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "最少操作变成二进制回文数", "difficulty": "简单",
        "tags": ["OA", "Google", "数学", "字符串"],
        "description": (description + "\n\n" + limits + "\n\n原题来源：" + SOURCE_URL
                        + "（固定快照内容指纹 " + source["contentHash"] + "）。"),
        "input": "输入一个整数 N。", "output": "输出最少操作次数。",
        "explanation": "枚举不超过 31 位的二进制回文数，取与 N 的绝对差最小值。对每种位数，只需构造由回文左右对称决定的前半部分候选；与 N 最接近的候选来自 N 对应前缀及相邻前缀，另检查该位数的最小和最大回文。",
        "hints": ["枚举目标回文数的二进制位数。", "固定位数后，回文的后半部分由前半部分唯一确定。"],
        "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }

    package_input = {"schemaVersion": 1, "problem": problem, "cases": cases}
    normalize = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    parsed = subprocess.run(["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
                            input=json.dumps(package_input, ensure_ascii=False), text=True,
                            capture_output=True, check=True).stdout
    package = json.loads(parsed)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()

    editorial = f"""## 思路

将目标二进制回文数按位数枚举。对固定位数，回文的后半段由前半段镜像得到。设 N 的高位前缀为 p，最接近的同位数候选只需检查 p 及相邻前缀（并限制在该位数的合法范围）；还检查该位数的最小和最大回文，以覆盖跨越位数边界的情况。枚举 1 至 31 位候选，取与 N 的最小绝对差。

## 正确性

固定位数后，合法二进制回文与其前半部分一一对应，且数值随前半部分严格递增。候选回文与 N 的距离只会在前缀跨过 N 对应前缀时发生最优值变化，因此检查相邻前缀即可得到该位数内最近值；合法前缀区间两端也纳入检查。N 不超过 2×10⁹，小于 2³¹，最近回文必在 1 至 31 位范围内。对所有位数取最小差，即为最少加减操作数。

## 复杂度

最多枚举 31 个位数，每个位数检查常数个候选；时间 O(log N)，额外空间 O(1)。

## 来源与本站约定

固定 OAMaster 快照的 Python、Java、C++ 实现均按加减整数并检查标准二进制表示是否回文；原始示例 N=6 的答案为 1。快照约束为 0≤N≤2×10⁹。输入输出格式由本站补充。来源：{SOURCE_URL}
"""
    manifest = {"schemaVersion": 1, "items": [{
        "id": PID, "sourceContentHash": source["contentHash"],
        "packageChecksum": sha(package_bytes), "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }]}
    manifest_folder = "batches" if (OA / "reports" / f"{BATCH}.json").exists() else "candidate-batches"
    put(manifest_folder, f"{BATCH}.json", manifest)
    if manifest_folder == "batches":
        (OA / "candidate-batches" / f"{BATCH}.json").unlink(missing_ok=True)
    report_path = OA / "reports" / f"{BATCH}.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else None
    report_problem = report["problems"][0] if report and report.get("problems") else {}
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    report_valid = bool(report and report.get("allPassed")
                        and report.get("batchSha256") == sha(manifest_bytes)
                        and report_problem.get("formal") == len(cases)
                        and report_problem.get("oracle") == len(oracle_rows)
                        and report_problem.get("passed") == len(cases) + len(oracle_rows))
    put("packages", f"{PID}.json", package)
    reference_path = OA / "references" / f"{PID}.py"
    reference_path.parent.mkdir(parents=True, exist_ok=True)
    reference_path.write_text(REFERENCE, encoding="utf-8")
    put("editorials", f"{PID}.json", {"schemaVersion": 1, "id": PID,
        "title": "最少操作变成二进制回文数", "explanation": editorial,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"]})
    put("oracles", f"{PID}.json", oracle_rows)
    put("mutants", f"{PID}.json", mutant_docs)
    put("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": UPSTREAM_COMMIT, "catalogContentHash": source["contentHash"],
        "items": [{"id": PID, "company": "Google", "title": source["title"],
            **({"status": "authored", "verification": f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项（{report_problem['formal']} formal + {report_problem['oracle']} oracle），两个 mutant 均被击杀。"} if report_valid else {}),
            "sourceUrl": SOURCE_URL, "previousStatus": old_review["status"],
            "previousReason": old_review["reason"],
            "fixedSource": {"path": "web/content/docs/companies/google.mdx", "gitBlobSha": UPSTREAM_GOOGLE_BLOB,
                "evidence": "固定快照中三种语言的函数均逐距离检查 N-d、N+d，并对标准二进制表示作回文判断；原始示例 N=6 输出 1。"},
            "siteAdditions": ["stdin/stdout 输入协议"],
            "interpretation": "一次操作将整数加 1 或减 1，不能低于 0；求到最近标准二进制回文非负整数的最小距离。"}],
    })
    verification = (f"121 个唯一 oracle、{len(cases)} 个正式用例（含 0、位数边界和 N=2×10⁹）及两个错误程序均通过用户自有 GoJudge，共 {report_problem['passed']} 项。"
                    if report_valid else "121 个唯一 oracle、正式边界用例（含 0、位数边界和 N=2×10⁹）及两个错误程序已在本地验证；待用户自有 GoJudge 验收。")
    put("resolutions", f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
        "previousReason": old_review["reason"],
        "reason": "固定 OAMaster 快照的三语实现与原始示例一致地支持最近二进制回文定义；将操作、非负下界与输入输出格式明确写入本站题面。" + verification,
    }]})
    put("validation", f"{BATCH}.json", {"schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({row['input'] for row in oracle_rows}),
            "publicCases": 1, "hiddenCases": len(cases) - 1,
            "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode())}],
        "note": (f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项，两个 mutant 均被击杀。" if report_valid
                 else "本地源样例、边界、独立 oracle 和 mutant 验证通过；待用户自有 GoJudge 验收。")})
    print(json.dumps({"id": PID, "candidateBatch": BATCH,
        "oracle": len(oracle_rows), "formal": len(cases), "mutantsKilled": len(killed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
