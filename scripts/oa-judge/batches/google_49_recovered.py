"""Generate an isolated, offline candidate for Google OA #49."""

from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path
import random
import subprocess


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-49"
BATCH = "google-49-recovered"
SEED = 20261006
SOURCE_URL = "https://oamaster.com/docs/companies/google#49-min-days-to-bloom"
LEETCODE_URL = "https://leetcode.com/discuss/post/334191/google-oa-min-days-to-bloom/"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
UPSTREAM_GOOGLE_BLOB = "300032c24800642c2ecedab9d930e86db3cdb54a"

REFERENCE = r'''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    size, bouquet_size, needed = data[:3]
    bloom = data[3:]
    if len(data) != 3 + size:
        raise ValueError("expected N, K, M, followed by N bloom days")
    if size < 1 or size > 200_000 or not 1 <= bouquet_size <= 200_000:
        raise ValueError("N and K are outside the supported range")
    if not 1 <= needed <= 200_000 or any(day < 0 or day > 1_000_000_000 for day in bloom):
        raise ValueError("M or a bloom day is outside the supported range")
    if bouquet_size * needed > size:
        return "-1"

    def possible(day):
        bouquets = run = 0
        for bloom_day in bloom:
            if bloom_day <= day:
                run += 1
                if run == bouquet_size:
                    bouquets += 1
                    run = 0
                    if bouquets >= needed:
                        return True
            else:
                run = 0
        return False

    low, high = min(bloom), max(bloom)
    while low < high:
        middle = (low + high) // 2
        if possible(middle):
            high = middle
        else:
            low = middle + 1
    return str(low)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    (
        "把连续花束误当作任意 K 朵已开花玫瑰",
        r'''import sys
def solve(raw):
    a=list(map(int,raw.split())); n,k,m=a[:3]; roses=a[3:]
    return str(sorted(roses)[m*k-1] if m*k<=n else -1)
print(solve(sys.stdin.read()))
''',
    ),
    (
        "允许相邻花束重叠复用玫瑰",
        r'''import sys
def solve(raw):
    a=list(map(int,raw.split())); n,k,m=a[:3]; roses=a[3:]
    if m*k>n: return -1
    lo,hi=min(roses),max(roses)
    while lo<hi:
        day=(lo+hi)//2; count=run=0
        for x in roses:
            if x<=day:
                run+=1
                if run>=k: count+=1
            else: run=0
        if count>=m: hi=day
        else: lo=day+1
    return lo
print(solve(sys.stdin.read()))
''',
    ),
]


def encode(roses: list[int], k: int, m: int) -> str:
    return f"{len(roses)} {k} {m}\n{' '.join(map(str, roses))}\n"


def oracle(roses: list[int], k: int, m: int) -> int:
    n = len(roses)
    if k * m > n:
        return -1
    infinity = 10**30

    @lru_cache(None)
    def choose(start: int, left: int) -> int:
        if left == 0:
            return 0
        if n - start < k * left:
            return infinity
        best = infinity
        for begin in range(start, n - k + 1):
            rest = choose(begin + k, left - 1)
            if rest != infinity:
                bouquet_ready = max(roses[begin:begin + k])
                best = min(best, max(bouquet_ready, rest))
        return best

    result = choose(0, m)
    return -1 if result == infinity else result


def run(program: str, raw: str) -> str:
    result = subprocess.run(
        ["python3", "-c", program], input=raw, text=True,
        capture_output=True, timeout=5, check=False,
    )
    if result.returncode != 0:
        raise AssertionError((result.returncode, result.stderr[:300], raw[:300]))
    return result.stdout.strip()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(folder: str, filename: str, document: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    old_review = next(
        item for item in json.loads((OA / "reviews/google-remaining-b.json").read_text(encoding="utf-8"))["items"]
        if item["id"] == PID
    )

    fixed = [
        ([1, 2, 4, 9, 3, 4, 1], 2, 2),
        ([1, 1, 1], 2, 2),
        ([1, 10, 3, 10, 2], 1, 3),
        ([1, 2, 3, 1, 2, 3], 3, 2),
        ([1, 100, 1, 100, 1, 100, 1], 2, 2),
        ([0, 999_999_999, 1_000_000_000], 2, 1),
    ]
    rng = random.Random(SEED)
    values = list(fixed)
    seen = {encode(roses, k, m) for roses, k, m in values}
    while len(values) < 121:
        size = rng.randint(1, 10)
        roses = [rng.randint(0, 30) for _ in range(size)]
        k = rng.randint(1, 5)
        m = rng.randint(1, 5)
        raw = encode(roses, k, m)
        if raw not in seen:
            seen.add(raw)
            values.append((roses, k, m))

    oracle_rows = []
    for roses, k, m in values:
        raw = encode(roses, k, m)
        expected = str(oracle(roses, k, m))
        assert run(REFERENCE, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    # The first three readable cases include the verbatim source example.
    formal_values = fixed[:3] + values[3:33]
    cases = []
    for index, (roses, k, m) in enumerate(formal_values):
        expected = str(oracle(roses, k, m)) + "\n"
        cases.append({
            "name": "示例 1" if index == 0 else f"隐藏用例 {index}" if index >= 3 else f"边界示例 {index}",
            "input": encode(roses, k, m),
            "expectedOutput": expected,
            "hidden": index >= 3,
            "weight": 1,
        })

    # An upper-bound case exercises the full supported array length and day range.
    large = [index % 100_000 + 1 for index in range(200_000)]
    cases.append({
        "name": "最大规模与较大开花日",
        "input": encode(large, 1, len(large)),
        "expectedOutput": "100000\n",
        "hidden": True,
        "weight": 1,
    })
    assert run(REFERENCE, cases[-1]["input"]) == "100000"

    killed = []
    mutant_docs = []
    for name, program in MUTANTS:
        rejects = [
            index for index, case in enumerate(cases)
            if run(program, case["input"]) != case["expectedOutput"].strip()
        ]
        assert rejects, f"surviving mutant: {name}"
        killed.append({"name": name, "rejectedByCases": rejects})
        mutant_docs.append({"name": name, "code": program})

    description = (
        "给定数组 roses，roses[i] 表示第 i 朵玫瑰开放的日子；给定 k（每束需要的相邻玫瑰数）和 n（需要的花束数），"
        "求最早能做出 n 束花的日子。每朵玫瑰最多用于一束花。若总数不足 n*k，返回 -1。"
    )
    limits = (
        "本站输入范围：1≤N≤200000，1≤k,n≤200000，0≤roses[i]≤1000000000。"
        "OAMaster 未提供约束；上述数值范围是本站支持范围。"
    )
    problem = {
        "id": PID,
        "courseId": "gomall",
        "lessonId": "00-overview",
        "title": "最早开花日",
        "difficulty": "中等",
        "tags": ["OA", "Google", "二分查找", "数组"],
        "description": (
            description + "\n\n" + limits + "\n\n原题来源：" + SOURCE_URL
            + "（固定快照内容指纹 " + source["contentHash"] + "）。"
            + "同题说明与原样例：" + LEETCODE_URL + "。"
        ),
        "input": "第一行 N、k、n；第二行 N 个整数 roses[i]。",
        "output": "输出最早开放日；若无法制作指定数量的花束，输出 -1。",
        "explanation": "对答案日 d 二分。线性扫描已开放的连续区间，每累计 k 朵就完成一束并重置长度，统计能做出的互不重叠花束数。",
        "hints": ["固定一个候选日期，判断能否完成。", "未开放玫瑰会把连续段截断；一段长度 L 最多可做 floor(L/k) 束。"],
        "timeLimit": 3,
        "memoryLimit": 262144,
        "outputLimit": 4096,
        "checker": "tokens",
        "languages": ["python", "go", "java", "cpp"],
    }

    package_input = {"schemaVersion": 1, "problem": problem, "cases": cases}
    normalize = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    parsed = subprocess.run(
        ["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
        input=json.dumps(package_input, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    ).stdout
    package = json.loads(parsed)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()

    editorial = f"""## 思路

二分最早日期 d。检查时从左到右数连续已开放玫瑰；每凑满 k 朵就制作一束并把当前段清零，未开放玫瑰则清零。若能做出至少 n 束，d 可行，否则不可行。可行性随日期单调，因此二分答案。

## 正确性

固定日期 d 后，每段连续开放区间长度为 L 时，最多能得到 floor(L/k) 束互不重叠的花；按扫描中每 k 朵立即成束正好达到这个数量。因此扫描得到的束数不少于 n，当且仅当该日期可行。日期越晚开放的玫瑰只会增加，不会减少可行束数，所以可行性单调；二分找到的首个可行日期即为最早日期。若 N<n*k，则玫瑰总数不足，答案为 -1。

## 复杂度

设 N 为玫瑰数量、D 为最大开花日。时间 O(N log D)，额外空间 O(N)（保存输入）。

## 来源与本站约定

固定 OAMaster 快照的题目代码三语均将 k 作为每束相邻玫瑰数、n 作为花束数量，并在 N<n*k 时返回 -1；上游可核查页面为 {SOURCE_URL}。LeetCode 的同题说明复现了完整定义和完全相同的原始例子：{LEETCODE_URL}。上游没有发布约束，题面列出的数值范围与 stdin/stdout 协议均为本站补充。
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
    report_valid = bool(
        report
        and report.get("allPassed")
        and report.get("batchSha256") == sha(manifest_bytes)
        and report_problem.get("formal") == len(cases)
        and report_problem.get("oracle") == len(oracle_rows)
        and report_problem.get("passed") == len(cases) + len(oracle_rows)
    )
    put("packages", f"{PID}.json", package)
    reference_path = OA / "references" / f"{PID}.py"
    reference_path.parent.mkdir(parents=True, exist_ok=True)
    reference_path.write_text(REFERENCE, encoding="utf-8")
    put("editorials", f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": "最早开花日",
        "explanation": editorial,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"],
    })
    put("oracles", f"{PID}.json", oracle_rows)
    put("mutants", f"{PID}.json", mutant_docs)
    put("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": UPSTREAM_COMMIT, "catalogContentHash": source["contentHash"],
        "items": [{
            "id": PID, "company": "Google", "title": source["title"],
            **({"status": "authored", "verification": f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项（{report_problem['formal']} formal + {report_problem['oracle']} oracle），两个 mutant 均被击杀。"} if report_valid else {}),
            "sourceUrl": SOURCE_URL, "previousStatus": old_review["status"],
            "previousReason": old_review["reason"],
            "fixedSource": {"path": "web/content/docs/companies/google.mdx", "gitBlobSha": UPSTREAM_GOOGLE_BLOB,
                            "evidence": "快照正文的定义段落截断，但同一内容指纹条目的 Python/Java/C++ 签名、实现和原始示例明确了 roses[i]、相邻 k 朵和目标 n 束。"},
            "supportingSources": [{"url": LEETCODE_URL,
                                   "evidence": "同题 Google OA 原帖完整写明 roses[i] 为开放日期、k 为制作一束所需的相邻开放玫瑰数、n 为花束数，并复现完全相同的数组、参数和输出。"}],
            "siteAdditions": ["stdin/stdout 输入协议", "N、k、n 和开花日的有效数值范围"],
            "interpretation": "每朵玫瑰最多用于一束；每束必须由原数组中的 k 个连续位置组成且当天全部开放。总数不足 n*k 时为 -1，与固定快照三语实现相同。",
        }],
    })
    if report_valid:
        result = report_problem
        verification_summary = (
            f"121 个唯一独立组合 oracle、34 个正式用例（含 N=200000、最大开花日 10^9 边界）及两个错误程序均通过用户自有 GoJudge，共 {result['passed']} 项。"
        )
        validation_note = f"用户自有 GoJudge 全部通过 {result['passed']} 项（{result['formal']} formal + {result['oracle']} oracle），两个 mutant 均被击杀。"
    else:
        verification_summary = "121 个唯一独立组合 oracle、34 个正式用例（含 N=200000、最大开花日 10^9 边界）及两个正常退出错误程序均已离线验证；待在用户自有 GoJudge 验收。"
        validation_note = "仅本地独立组合枚举 oracle、源样例/边界和 mutant 验证；尚未连接 GoJudge。"
    put("resolutions", f"{BATCH}.json", {
        "schemaVersion": 1, "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
            "previousReason": old_review["reason"],
            "reason": "固定 OAMaster 快照的三语实现与同题 Google OA 原帖共同恢复完整定义；原帖重现相同样例并明确 k 是每束相邻玫瑰数、n 是花束数。输入协议与数值范围仅作为本站补充。" + verification_summary,
        }],
    })
    put("validation", f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_rows), "uniqueOracleInputs": len({row["input"] for row in oracle_rows}),
                      "publicCases": 3, "hiddenCases": len(cases) - 3,
                      "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode())}],
        "note": validation_note,
    })
    print(json.dumps({"id": PID, "candidateBatch": BATCH, "oracle": len(oracle_rows),
                      "formal": len(cases), "mutantsKilled": len(killed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
