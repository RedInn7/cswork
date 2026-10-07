"""Generate isolated offline candidate assets for Google OA #21."""

from __future__ import annotations

import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-21"
BATCH = "google-21-recovered"
SEED = 20261006
SOURCE_URL = "https://oamaster.com/docs/companies/google#21-find-largest-number-google-early-career"
SUPPORTING_URL = "https://www.1point3acres.com/interview/problems/google-find-largest-number"
UPSTREAM_REPOSITORY = "https://github.com/RedInn7/OA-Master"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
UPSTREAM_GOOGLE_BLOB = "300032c24800642c2ecedab9d930e86db3cdb54a"
SOURCE_CONTENT_HASH = "df9e04f772003ef1996bb410a0e9712db3d5fb1c857806257d19cdbea2362698"

REFERENCE = r'''import sys


def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        return ""
    n = values[0]
    digits = values[1:]
    if not 3 <= n <= 50 or len(digits) != n:
        raise ValueError("expected N in [3, 50], followed by N digits")
    if any(digit < 0 or digit > 9 for digit in digits):
        raise ValueError("each value must be a decimal digit")

    best = -1
    for i in range(n - 2):
        if digits[i] == 0:
            continue
        for j in range(i + 1, n - 1):
            for k in range(j + 1, n):
                best = max(best, digits[i] * 100 + digits[j] * 10 + digits[k])
    # The source OA does not define this edge case. This site returns -1 when
    # no valid three-digit subsequence exists.
    return str(best)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    (
        "忽略原数组相对顺序，直接重排取最大的三个数字",
        r'''import sys
def solve(raw):
    a=list(map(int,raw.split())); n=a[0]; digits=a[1:]
    chosen=sorted(digits, reverse=True)[:3]
    return str(chosen[0]*100+chosen[1]*10+chosen[2])
print(solve(sys.stdin.read()))
''',
    ),
    (
        "允许首位为零",
        r'''import sys,itertools
def solve(raw):
    a=list(map(int,raw.split())); n=a[0]; digits=a[1:]
    return str(max((digits[i]*100+digits[j]*10+digits[k]
                    for i,j,k in itertools.combinations(range(n),3)), default=-1))
print(solve(sys.stdin.read()))
''',
    ),
]


def encode(digits: list[int]) -> str:
    return f"{len(digits)}\n{' '.join(map(str, digits))}\n"


def oracle(digits: list[int]) -> int:
    best = -1
    for i, j, k in itertools.combinations(range(len(digits)), 3):
        if digits[i] != 0:
            best = max(best, digits[i] * 100 + digits[j] * 10 + digits[k])
    return best


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
    if source["contentHash"] != SOURCE_CONTENT_HASH:
        raise RuntimeError("fixed OAMaster catalog hash changed; audit the new source before generation")
    old_review = next(
        item for item in json.loads((OA / "reviews/google-remaining-a.json").read_text(encoding="utf-8"))["items"]
        if item["id"] == PID
    )

    fixed = [
        [7, 4, 3, 8, 2],       # exact OAMaster example: choose 7, 8, 2 -> 782
        [0, 9, 8],             # no legal non-zero-leading three-digit subsequence: site rule -> -1
        [0, 9, 9, 8],          # skip leading zero; choose 9, 9, 8 -> 998
        [9, 8, 7],             # minimum supported length
        [8, 9, 9, 9],          # preserve order: 899, not reordered 999
        [1, 9, 8, 9, 9],       # later pair yields 999
        [0, 0, 0, 0],          # no valid answer, explicit site-defined -1
    ]
    rng = random.Random(SEED)
    values = list(fixed)
    seen = {encode(digits) for digits in values}
    while len(values) < 120:
        digits = [rng.randint(0, 9) for _ in range(rng.randint(3, 50))]
        raw = encode(digits)
        if raw not in seen:
            seen.add(raw)
            values.append(digits)

    oracle_rows = []
    for digits in values:
        raw = encode(digits)
        expected = str(oracle(digits))
        assert run(REFERENCE, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})
    assert len({row["input"] for row in oracle_rows}) == 120

    # Three readable public cases, followed by deterministic hidden oracle cases.
    formal_values = fixed[:3] + values[7:33]
    cases = []
    for index, digits in enumerate(formal_values):
        cases.append({
            "name": ["OAMaster 示例 1", "无合法三位数（本站定义）", "首位零不可选"][index]
                    if index < 3 else f"隐藏用例 {index - 2}",
            "input": encode(digits),
            "expectedOutput": str(oracle(digits)) + "\n",
            "hidden": index >= 3,
            "weight": 1,
        })
    long_case = [rng.randint(0, 9) for _ in range(50)]
    if all(digit == 0 for digit in long_case):
        long_case[-1] = 1
    cases.append({
        "name": "最大长度 N=50",
        "input": encode(long_case),
        "expectedOutput": str(oracle(long_case)) + "\n",
        "hidden": True,
        "weight": 1,
    })
    assert run(REFERENCE, cases[-1]["input"]) == cases[-1]["expectedOutput"].strip()

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
        "给定由十进制数位组成的数组，按数组中的相对先后顺序恰好选取三个数位并连接成三位数，"
        "求能组成的最大数。首位必须非零。固定上游样例 [7,4,3,8,2] 的答案是 782；"
        "这与保序选择 7、8、2 一致，而把数位重排会得到不同结果。"
    )
    limits = (
        "本站补充输入范围：3≤N≤50，0≤nums[i]≤9。本站采用标准输入输出，不声称这些约束或协议来自原 OA。"
    )
    edge_note = (
        "原 OA 未定义不存在合法三位数时的返回值；本站明确规定此时输出 -1。"
    )
    problem = {
        "id": PID,
        "courseId": "gomall",
        "lessonId": "00-overview",
        "title": "按顺序组成最大三位数",
        "difficulty": "简单",
        "tags": ["OA", "Google", "数组", "枚举"],
        "description": (
            description + "\n\n" + limits + "\n" + edge_note + "\n\n"
            + "原题来源：" + SOURCE_URL + "（固定 OAMaster 快照内容指纹 " + source["contentHash"] + "）。"
            + "同题资料：" + SUPPORTING_URL + "；该资料只确认从数组选三个元素组成最大三位数，不提供顺序样例。"
        ),
        "input": "第一行输入整数 N；第二行输入 N 个整数 nums[i]。",
        "output": "输出按原数组相对顺序选取三个数位可组成的最大三位数；若不存在首位非零的合法选择，输出 -1（本站定义）。",
        "explanation": "枚举 i<j<k 的所有三元下标组合，跳过 nums[i]=0 的组合，计算三位数并取最大值。N≤50，O(N³) 足够。",
        "hints": ["选取必须保持下标递增。", "枚举三个下标；首位为零的组合不是三位数。"],
        "timeLimit": 2,
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

    editorial_text = f"""## 思路

枚举三个下标 `i < j < k`。若 `nums[i]` 不为零，就计算 `100×nums[i] + 10×nums[j] + nums[k]` 并更新最大值。数组长度最多 50，直接三重枚举即可。没有合法选择时按本站约定输出 -1。

## 正确性

每个合法答案都对应唯一的一组三个递增下标 `i < j < k`，且首个数位非零。算法枚举所有这类下标并计算对应三位数，因此不会漏掉任何合法答案；取其中最大值即为题目要求。若没有任何符合首位非零条件的组合，枚举结果保持 -1，符合本站补充的无解约定。

## 复杂度

时间 O(N³)，额外空间 O(1)。

## 来源与本站约定

固定 OAMaster 快照：{SOURCE_URL}；内容指纹 `{SOURCE_CONTENT_HASH}`。其样例 `[7,4,3,8,2] → 782` 与按原数组顺序选择 `7,8,2` 相符；若可任意重排，最大值会是 874。同题 1Point3Acres 资料只确认从数组选三个元素组成最大三位数，不提供足以确认顺序的样例：{SUPPORTING_URL}。因此顺序按固定 OAMaster 样例恢复。原 OA 没有定义不存在合法三位数时的输出；本站明确规定为 -1。N、数位范围和标准输入输出协议均是本站补充，不代表上游约束。
"""
    editorial = {
        "schemaVersion": 1, "id": PID, "title": "按顺序组成最大三位数",
        "explanation": editorial_text,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"],
    }
    put("candidate-batches", f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "sourceContentHash": source["contentHash"],
            "packageChecksum": sha(package_bytes), "editorial": editorial_text,
            "authoredSolutions": [{"language": "python", "code": REFERENCE}],
        }],
    })
    put("packages", f"{PID}.json", package)
    reference_path = OA / "references" / f"{PID}.py"
    reference_path.parent.mkdir(parents=True, exist_ok=True)
    reference_path.write_text(REFERENCE, encoding="utf-8")
    put("editorials", f"{PID}.json", editorial)
    put("oracles", f"{PID}.json", oracle_rows)
    put("mutants", f"{PID}.json", mutant_docs)
    put("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1,
        "repository": UPSTREAM_REPOSITORY,
        "commit": UPSTREAM_COMMIT,
        "catalogContentHash": source["contentHash"],
        "items": [{
            "id": PID, "company": "Google", "title": source["title"],
            "sourceUrl": SOURCE_URL, "previousStatus": old_review["status"],
            "previousReason": old_review["reason"],
            "fixedSource": {
                "path": "web/content/docs/companies/google.mdx",
                "gitBlobSha": UPSTREAM_GOOGLE_BLOB,
                "catalogContentHash": source["contentHash"],
                "evidence": "固定快照的原题样例 [7,4,3,8,2] 输出 782；选择下标递增的 7、8、2 得到该结果。若允许重排，最大数为 874。因此本站将原数组相对顺序视为规则。",
            },
            "supportingSources": [{
                "url": SUPPORTING_URL,
                "evidence": "同题资料确认从数组选三个元素组成最大三位数，但没有给出样例或说明顺序；不将其作为保序证据。",
            }],
            "siteAdditions": [
                "标准输入输出协议：N 后跟 N 个数位",
                "支持范围 3≤N≤50 与 0≤nums[i]≤9；上游快照未提供 constraints",
                "不存在合法三位数时输出 -1；原 OA 未定义此边界行为",
            ],
            "interpretation": "在原数组中选取递增下标 i<j<k；首位数位不得为 0；求最大结果。该解释受 OAMaster 原样例区分支持，并非 1Point3Acres 页面本身说明了顺序。",
        }],
    })
    put("resolutions", f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
            "previousReason": old_review["reason"],
            "reason": "固定 OAMaster 样例 [7,4,3,8,2]→782 区分保序选择与任意重排（后者为 874）；同题 1Point3Acres 仅支持选三个元素，不单独支持顺序。原题未定义无合法三位数时的返回值，本站明示补充为 -1；输入协议与约束亦仅属本站约定。120 个唯一组合枚举 oracle、30 个正式用例（含 N=50 边界）及两个正常退出错误程序已离线验证；尚未连接 GoJudge。",
        }],
    })
    put("validation", f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({row["input"] for row in oracle_rows}),
            "publicCases": 3, "hiddenCases": sum(case["hidden"] for case in cases),
            "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode()),
        }],
        "note": "仅本地三下标枚举 oracle/reference/mutant 验证；未连接 GoJudge。无解输出 -1 是本站定义。",
    })
    print(json.dumps({
        "id": PID, "candidateBatch": BATCH, "oracle": len(oracle_rows),
        "uniqueOracleInputs": len({row["input"] for row in oracle_rows}),
        "formal": len(cases), "mutantsKilled": len(killed),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
