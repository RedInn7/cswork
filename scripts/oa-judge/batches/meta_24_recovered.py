#!/usr/bin/env python3
"""Generate an isolated candidate for Meta OA #24 from a fixed source snapshot."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/meta.mdx"
SOURCE_BLOB = "06fedf2f99742b7a3a9b7556dce29ced6d248910"
SOURCE_CONTENT_HASH = "a593c760ead9bffff0c1e7bdc69f17028ece67e9f8641d955b24c057c08bd53c"
PID = "oa-meta-24"
BATCH = "meta-24-recovered"
SEED = 20261006
SOURCE_URL = "https://oamaster.com/docs/companies/meta#24-get-minimum-round-trip-cost"
SUPPORT_URL = "https://www.1point3acres.com/interview/problems/meta-solve-transportation-problem"
PREVIOUS_REASON = (
    "未说明返程日j是否必须≥出发日i（或严格>），唯一单调样例对三种解释答案相同。"
    "例如去程[100,1]、返程[1,100]，无日期限制答案2、有先后限制答案101，不能自行假定。"
)

REFERENCE = r'''import sys


def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    n = data[0]
    if not 2 <= n <= 200_000 or len(data) != 1 + 2 * n:
        raise ValueError("expected n >= 2 followed by two arrays of length n")
    departing = data[1:1 + n]
    returning = data[1 + n:]
    if any(not -1_000_000_000 <= x <= 1_000_000_000 for x in departing + returning):
        raise ValueError("fare is outside the site-supported range")

    best_return = returning[-1]
    answer = departing[-2] + best_return
    for i in range(n - 2, -1, -1):
        best_return = min(best_return, returning[i + 1])
        answer = min(answer, departing[i] + best_return)
    return str(answer)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    (
        "忽略返程必须晚于出发日，分别取两数组最小值",
        r'''import sys
def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; d=a[1:1+n]; r=a[1+n:]
 return str(min(d)+min(r))
print(solve(sys.stdin.read()))
''',
    ),
    (
        "允许同一天返程（错误地使用 j >= i）",
        r'''import sys
def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; d=a[1:1+n]; r=a[1+n:]
 return str(min(d[i]+min(r[i:]) for i in range(n)))
print(solve(sys.stdin.read()))
''',
    ),
]


def write_json(folder: str, filename: str, document: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode(departing: list[int], returning: list[int]) -> str:
    assert len(departing) == len(returning)
    return f"{len(departing)}\n{' '.join(map(str, departing))}\n{' '.join(map(str, returning))}\n"


def oracle(departing: list[int], returning: list[int]) -> int:
    # Independent O(n^2) definition-level enumeration over all valid i < j.
    return min(departing[i] + returning[j]
               for i in range(len(departing))
               for j in range(i + 1, len(returning)))


def run(program: str, raw: str) -> str:
    with tempfile.TemporaryDirectory(prefix="meta24-run-") as directory:
        path = Path(directory) / "solution.py"
        path.write_text(program, encoding="utf-8")
        result = subprocess.run(
            [sys.executable, "-I", str(path)], input=raw, text=True,
            capture_output=True, timeout=8, check=False,
        )
        if result.returncode != 0:
            raise AssertionError((result.returncode, result.stderr[:300], raw[:300]))
        return result.stdout.strip()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_source() -> tuple[dict, dict]:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    assert source["contentHash"] == SOURCE_CONTENT_HASH
    assert source["sourceUrl"] == SOURCE_URL
    assert source["title"] == "Get Minimum Round Trip Cost"
    source_blob = subprocess.check_output(
        ["git", "rev-parse", f"{SOURCE_COMMIT}:{SOURCE_PATH}"], cwd=ROOT, text=True,
    ).strip()
    source_text = subprocess.check_output(
        ["git", "show", f"{SOURCE_COMMIT}:{SOURCE_PATH}"], cwd=ROOT, text=True,
    )
    assert source_blob == SOURCE_BLOB
    section = source_text.split("## 24. Get Minimum Round Trip Cost", 1)[1].split("## 25.", 1)[0]
    assert "departing = [1, 2, 3, 4]" in section
    assert "returning = [4, 3, 2, 1]" in section and "2" in section
    assert "return min(departing) + min(returning)" in section

    review = json.loads((OA / "reviews/meta-remaining.json").read_text(encoding="utf-8"))
    review_item = next(item for item in review["items"] if item["id"] == PID)
    assert review_item["status"] == "blocked" and review_item["reason"] == PREVIOUS_REASON
    return source, review_item


def main() -> None:
    source, review_item = validate_source()
    fixed = [
        ([1, 2, 3, 4], [4, 3, 2, 1]),  # verbatim upstream example: answer 2
        ([100, 1], [1, 100]),           # distinguishes no-order (2) from i < j (101)
        ([8, 1, 5], [7, 2, 9]),         # equal-index and suffix-min traps
        ([4, 4], [3, 3]),               # smallest supported input
        ([-5, 8, -2], [7, -9, 4]),      # negative fares are included in site bounds
        ([1, 2, 3, 4], [1, 2, 3, 4]),  # strict inequality differs from same-day return
    ]
    rng = random.Random(SEED)
    cases_data = list(fixed)
    seen = {encode(a, b) for a, b in cases_data}
    while len(cases_data) < 120:
        n = rng.randint(2, 9)
        departing = [rng.randint(-50, 50) for _ in range(n)]
        returning = [rng.randint(-50, 50) for _ in range(n)]
        raw = encode(departing, returning)
        if raw not in seen:
            seen.add(raw)
            cases_data.append((departing, returning))

    oracle_rows = []
    for departing, returning in cases_data:
        raw = encode(departing, returning)
        expected = str(oracle(departing, returning))
        assert run(REFERENCE, raw) == expected, raw
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    # Formal examples include the original public sample and deterministic edge cases.
    formal_data = fixed + cases_data[len(fixed):32]
    cases = []
    for index, (departing, returning) in enumerate(formal_data):
        cases.append({
            "name": "示例 1" if index == 0 else f"边界用例 {index}" if index < len(fixed) else f"隐藏用例 {index}",
            "input": encode(departing, returning),
            "expectedOutput": str(oracle(departing, returning)) + "\n",
            "hidden": index >= len(fixed), "weight": 1,
        })

    n = 200_000
    large_departing = [1_000_000_000] * n
    large_returning = [1_000_000_000] * n
    large_departing[0] = -1_000_000_000
    large_returning[1] = -1_000_000_000
    large_case = {
        "name": "最大规模与数值边界", "input": encode(large_departing, large_returning),
        "expectedOutput": "-2000000000\n", "hidden": True, "weight": 1,
    }
    assert run(REFERENCE, large_case["input"]) == "-2000000000"
    cases.append(large_case)

    killed = []
    mutant_docs = []
    for name, program in MUTANTS:
        # Mutants are intentionally simple quadratic examples, so keep their
        # kill-set checks to the small formal cases rather than the stress case.
        rejected = [index for index, case in enumerate(cases[:-1])
                    if run(program, case["input"]) != case["expectedOutput"].strip()]
        assert rejected, f"surviving mutant: {name}"
        killed.append({"name": name, "rejectedByCases": rejected})
        mutant_docs.append({"name": name, "code": program})

    title = "最小往返机票费用"
    description = (
        "给定等长数组 departing 和 returning，分别表示第 i 天的去程、返程票价。"
        "选择出发日 i 与返程日 j，且返程必须严格晚于出发（j > i），求 departing[i] + returning[j] 的最小值。"
        "这条严格先后约束由同题公开报告补全；固定 OAMaster 快照原文与解法没有写出该条件，且其解法分别取两数组最小值，会忽略日期顺序。"
    )
    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": title, "difficulty": "简单", "tags": ["OA", "Meta", "数组", "后缀最小值"],
        "description": (
            description + "\n\n本站约束：2≤n≤200000，-1000000000≤任一票价≤1000000000。"
            "固定 OAMaster 快照未提供约束；以上范围及 stdin/stdout 格式为本站补充。\n\n"
            f"原题来源：{SOURCE_URL}\n同题条件来源：{SUPPORT_URL}。"
        ),
        "input": "第一行 n；第二行 n 个去程票价 departing；第三行 n 个返程票价 returning。",
        "output": "输出满足返程日 j 严格大于出发日 i 的最小总费用。",
        "explanation": "从右向左维护 returning[i+1..n-1] 的最小值，与 departing[i] 配对后更新答案。",
        "hints": ["固定出发日 i 后，只需知道其后最便宜的返程票。", "预处理后缀最小值，或从右向左边更新边计算。"],
        "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
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

遍历出发日 i 时，返程必须在之后，因此只考虑 returning[i+1..n-1]。从右向左维护这段的最小票价，与 departing[i] 相加并更新答案。

## 正确性证明

对任意固定出发日 i，所有合法返程日恰为 j>i；后缀最小值正好是这些合法返程票价中的最小值，因此与 departing[i] 相加得到该 i 下的最优合法费用。遍历每个 i 后取最小值，覆盖所有合法出发日，故得到全局最优解。

## 复杂度

时间 O(n)，额外空间 O(1)（输入数组除外）。

## 来源与本站约定

固定 OAMaster 快照（{SOURCE_URL}，内容指纹 {source['contentHash']}）写了数组定义和原样例，但漏掉返程日限制；其三语示例解法分别取两个数组最小值，忽略日期顺序。1Point3Acres 同题报告明确要求 j>i：{SUPPORT_URL}。原样例在此严格条件下仍为 2（第 0 天去程 1、第 3 天返程 1）。快照没有给约束；本站的 n、票价范围以及 stdin/stdout 协议均为补充约定。
"""

    write_json("candidate-batches", f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "sourceContentHash": source["contentHash"],
        "packageChecksum": sha(package_bytes), "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }]})
    write_json("packages", f"{PID}.json", package)
    ref_path = OA / "references" / f"{PID}.py"
    ref_path.parent.mkdir(parents=True, exist_ok=True)
    ref_path.write_text(REFERENCE, encoding="utf-8")
    write_json("editorials", f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": title, "explanation": editorial,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"],
    })
    write_json("oracles", f"{PID}.json", oracle_rows)
    write_json("mutants", f"{PID}.json", mutant_docs)
    write_json("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT, "catalogContentHash": source["contentHash"],
        "items": [{
            "id": PID, "company": "Meta", "title": source["title"],
            "sourceUrl": SOURCE_URL, "previousStatus": review_item["status"],
            "previousReason": review_item["reason"],
            "fixedSource": {
                "path": SOURCE_PATH, "gitBlobSha": SOURCE_BLOB,
                "evidence": "固定提交中的题面和原样例已校验；其三语言实现一致地分别求两个数组最小值，但该策略不满足返程必须晚于出发的同题原帖条件。",
            },
            "supportingSources": [{
                "url": SUPPORT_URL,
                "evidence": "同题 Meta 面试题页面明确写出返程索引 j > i、返回最小总价及 O(n) 要求；固定 OAMaster 样例在该严格条件下仍输出 2。",
            }],
            "interpretation": "要求返程日期严格晚于出发日期（j>i）；穷举所有合法索引对时，本站 oracle 与后缀最小值参考实现吻合。",
            "upstreamConflict": "OAMaster 快照的三语言解法直接 min(departing)+min(returning)，会在 [100,1] / [1,100] 上返回 2，而 j>i 的正确答案是 101。",
            "siteAdditions": ["n 与票价范围", "stdin/stdout 输入协议"],
        }],
    })
    write_json("resolutions", f"{BATCH}.json", {
        "schemaVersion": 1, "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
            "previousReason": PREVIOUS_REASON,
            "reason": "1Point3Acres 同题报告明确规定返程日 j>i；固定 OAMaster 原样例在该条件下答案仍为 2。快照三语言解法忽略先后顺序，已在 source evidence 中明确记录并由反例覆盖。120 个唯一暴力枚举 oracle、样例/边界/最大规模测试及两个错误实现自检均本地通过；待自有 GoJudge 验收。",
        }],
    })
    write_json("validation", f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({row["input"] for row in oracle_rows}),
            "publicCases": 1, "hiddenCases": len(cases) - 1,
            "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode()),
        }],
        "note": "仅本地暴力枚举、原样例/边界/最大规模和错误实现自检；未连接 GoJudge。",
    })
    print(json.dumps({"id": PID, "candidateBatch": BATCH,
                      "oracleCases": len(oracle_rows), "uniqueOracleInputs": len(seen),
                      "formalCases": len(cases), "mutantsKilled": len(killed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
