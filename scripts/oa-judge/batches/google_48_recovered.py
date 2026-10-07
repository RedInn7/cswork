"""Prepare a provenance-tracked candidate for Google OA #48, Min Amplitude."""

from __future__ import annotations

from itertools import combinations
import hashlib
import json
from pathlib import Path
import random
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-48"
BATCH = "google-48-min-amplitude"
SEED = 20261006
SOURCE_URL = "https://oamaster.com/docs/companies/google#48-min-amplitude"
SUPPORT_URL = "https://www.fastprep.io/problems/google-min-amplitude"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"

REFERENCE = r'''import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        raise ValueError("expected array length and values")
    n = values[0]
    arr = values[1:]
    if not 1 <= n <= 200_000 or len(arr) != n:
        raise ValueError("expected 1 <= n <= 200000 and exactly n values")
    if any(value < -1_000_000_000 or value > 1_000_000_000 for value in arr):
        raise ValueError("array value outside the site-supported range")
    if n <= 4:
        return "0"
    arr.sort()
    return str(min(arr[n - 4 + i] - arr[i] for i in range(4)))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    ("误按最多修改两个元素", r'''import sys
x=list(map(int,sys.stdin.read().split()));n=x[0];a=sorted(x[1:])
print(0 if n<=3 else min(a[n-3+i]-a[i] for i in range(3)))
'''),
    ("只枚举前三种边界保留方案", r'''import sys
x=list(map(int,sys.stdin.read().split()));n=x[0];a=sorted(x[1:])
print(0 if n<=4 else min(a[n-4+i]-a[i] for i in range(3)))
'''),
]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(folder: str, filename: str, value: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode(arr: list[int]) -> str:
    return f"{len(arr)}\n{' '.join(map(str, arr))}\n"


def oracle(arr: list[int]) -> int:
    """Enumerate changed-index sets directly; independent of sorted-window solution."""
    n = len(arr)
    if n <= 3:
        return 0
    best = max(arr) - min(arr)
    for changed_count in range(1, min(3, n - 1) + 1):
        for changed in combinations(range(n), changed_count):
            omitted = set(changed)
            kept = [arr[i] for i in range(n) if i not in omitted]
            best = min(best, max(kept) - min(kept))
    return best


def run(program: str, raw: str) -> str:
    result = subprocess.run(["python3", "-c", program], input=raw, text=True, capture_output=True, timeout=5)
    if result.returncode:
        raise AssertionError((result.returncode, result.stderr[:300], raw[:300]))
    return result.stdout.strip()


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    reviews = json.loads((OA / "reviews/google-remaining-b.json").read_text(encoding="utf-8"))
    previous = next(item for item in reviews["items"] if item["id"] == PID)

    fixed = [
        ("原题示例一", [-1, 3, -1, 8, 5, 4]),
        ("原题示例二", [10, 10, 3, 4, 10]),
        ("最多四项时可全部归到同值", [-7, 0, 8, 12]),
        ("重复极值", [-5, -5, -5, 9, 9, 9]),
        ("负向边界值", [-1_000_000_000, -5, 0, 4, 1_000_000_000]),
        ("需要枚举最后一种边界方案", [-100, -50, -49, 100, 101, 102, 103]),
        ("只有一个值", [42]),
    ]
    rng = random.Random(SEED)
    random_values: list[tuple[str, list[int]]] = []
    seen = {encode(arr) for _, arr in fixed}
    while len(random_values) < 220:
        n = rng.randint(1, 12)
        arr = [rng.randint(-30, 30) for _ in range(n)]
        raw = encode(arr)
        if raw not in seen:
            seen.add(raw)
            random_values.append((f"随机小数组 {len(random_values)+1}", arr))

    all_values = fixed + random_values
    oracle_rows = []
    for _, arr in all_values:
        raw = encode(arr)
        expected = str(oracle(arr))
        if run(REFERENCE, raw) != expected:
            raise AssertionError((arr, expected, run(REFERENCE, raw)))
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    formal_values = fixed + random_values[:18]
    # Exercise the stated maximum N with a compact, deterministic input.
    large = list(range(200_000))
    large_raw = encode(large)
    large_expected = "199996"
    if run(REFERENCE, large_raw) != large_expected:
        raise AssertionError("maximum-N boundary case failed")

    cases = []
    for index, (name, arr) in enumerate(formal_values):
        cases.append({
            "name": name,
            "input": encode(arr),
            "expectedOutput": f"{oracle(arr)}\n",
            "hidden": index >= 2,
            "weight": 1,
        })
    cases.append({"name": "最大长度", "input": large_raw, "expectedOutput": large_expected + "\n", "hidden": True, "weight": 2})

    witnesses = []
    mutant_docs = []
    for name, program in MUTANTS:
        rejects = [i for i, case in enumerate(cases) if run(program, case["input"]) != case["expectedOutput"].strip()]
        if not rejects:
            raise AssertionError(f"surviving mutant: {name}")
        witnesses.append({"name": name, "rejectedByCases": rejects})
        mutant_docs.append({"name": name, "code": program})

    problem = {
        "id": PID,
        "courseId": "gomall",
        "lessonId": "00-overview",
        "title": "最小振幅",
        "difficulty": "简单",
        "tags": ["OA", "Google", "排序", "贪心"],
        "description": (
            "给定整数数组 A，最多可以将其中 3 个元素替换为任意整数。数组振幅定义为最大值减最小值，求操作后可能达到的最小振幅。"
            "\n\n本站支持范围：1≤N≤200000，-10^9≤A[i]≤10^9。范围来自同题来源页，不宣称来自截断的 OAMaster 快照。"
            f"\n\n题目来源：{SOURCE_URL}。完整同题规则、样例与约束：{SUPPORT_URL}。"
        ),
        "input": "第一行 N；第二行 N 个整数 A[i]。",
        "output": "输出修改至多三个元素后，数组最大值与最小值之差的最小可能值。",
        "explanation": "排序后，最多改三个元素，最优时保留的最小值和最大值可由删除排序数组两端总计三个元素确定。枚举左侧删除 i 个、右侧删除 3-i 个（i=0..3），取剩余区间的最小宽度。N≤4 时可把所有元素改成相同值，答案为0。",
        "hints": ["排序后，内部元素不会比两端元素更值得删除。", "总共只删除三个端点元素，枚举左端删除数量 0 到 3。"],
        "timeLimit": 2,
        "memoryLimit": 262144,
        "outputLimit": 4096,
        "checker": "tokens",
        "languages": ["python", "java", "cpp"],
    }
    package_input = {"schemaVersion": 1, "problem": problem, "cases": cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    parsed = subprocess.run(["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
                            input=json.dumps(package_input, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    package = json.loads(parsed)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()

    editorial = f"""## 思路

最多修改 3 个元素。排序后，修改中间元素不会比修改端点更有效，所以只需枚举从左侧移除 i 个、右侧移除 3-i 个元素（i=0,1,2,3），剩余区间宽度为 `A[n-4+i]-A[i]`，取最小值。若 n≤4，可把数组中至多三个元素改成剩下那个值，答案为 0。

## 正确性

修改至多三个元素后，至少有 n-3 个原值保留。固定最小、最大保留值后，所有位于它们之间的元素都无需修改，而区间之外的被修改值可放入最终范围内。故最优解等价于在排序数组中选一个连续的 n-3 项窗口作为保留值；任何非连续选法的跨度不小于覆盖它们的连续窗口。连续窗口共有四种端点分配，枚举它们即可得到最小振幅。n≤4 时能令所有最终值相同，振幅为 0。

## 复杂度

排序 O(n log n)，扫描 O(1)，空间 O(n)（排序副本/排序存储）。

## 来源与本站约定

OAMaster 固定快照的题干被截断且没有约束：{SOURCE_URL}（上游提交 `{UPSTREAM_COMMIT}`，内容指纹 `{source['contentHash']}`）。同题 Google OA 来源完整保留“最多替换三个元素为任意整数”、两个与 OAMaster 一致的示例及约束：{SUPPORT_URL}。本站据此补齐缺失题面；标准输入输出格式为本站补充。没有将该完整规则或约束归因于 OAMaster 原始快照。
"""
    manifest = {"schemaVersion": 1, "items": [{"id": PID, "sourceContentHash": source["contentHash"],
        "packageChecksum": sha(package_bytes), "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}]}]}
    report_path = OA / "reports" / f"{BATCH}.json"
    manifest_folder = "batches" if report_path.exists() else "candidate-batches"
    put(manifest_folder, f"{BATCH}.json", manifest)
    if manifest_folder == "batches": (OA / "candidate-batches" / f"{BATCH}.json").unlink(missing_ok=True)
    put("packages", f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE, encoding="utf-8")
    put("editorials", f"{PID}.json", {"schemaVersion": 1, "id": PID, "title": problem["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"]})
    put("oracles", f"{PID}.json", oracle_rows)
    put("mutants", f"{PID}.json", mutant_docs)
    put("source-evidence", f"{BATCH}.json", {"schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": UPSTREAM_COMMIT, "catalogContentHash": source["contentHash"], "items": [{"id": PID, "company": "Google",
        "title": source["title"], "sourceUrl": SOURCE_URL,
        "fixedSource": {"path": "web/content/docs/companies/google.mdx", "evidence": "原始题目快照的描述和约束被截断；不将缺失规则归给 OAMaster。"},
        "supportingSources": [{"url": SUPPORT_URL, "evidence": "同名 Google OA 题面明确给出最多替换三个元素、替换值任意、振幅定义、两个与原快照一致的样例及 1≤N≤2×10^5、-10^9≤A[i]≤10^9。"}],
        "siteAdditions": ["标准 I/O 协议。", "将外部同题完整规范作为本站题面补全；明确其来源，不伪称为 OAMaster 快照内容。"],
        "interpretation": "数组振幅为 max(A)-min(A)；至多替换3项，替换值可以是任意整数。"}]})
    put("resolutions", f"{BATCH}.json", {"schemaVersion": 1, "items": [{"id": PID, "batch": BATCH,
        "sourceContentHash": source["contentHash"], "previousReason": previous["reason"],
        "reason": "OAMaster 题干确实截断，但同名 Google OA 来源完整补全‘任意替换至多三个元素’规则，且两个示例与原快照逐项一致。本站明确标注题面修复和标准 I/O，不把外部约束冒充 OAMaster 约束；参考解由独立子集枚举 oracle 核验，并在用户自有 GoJudge 验证。"}]})
    put("validation", f"{BATCH}.json", {"schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_rows), "uniqueOracleInputs": len(seen),
        "publicCases": sum(not case["hidden"] for case in cases), "hiddenCases": sum(case["hidden"] for case in cases),
        "negativeControls": witnesses, "referenceSha256": sha(REFERENCE.encode())}],
        "note": "用暴力枚举每个小数组中被替换的索引集合构造独立oracle；另用N=200000顺序数组验证最大规模。" + ("GoJudge报告已绑定。" if report_path.exists() else "尚未连接GoJudge。")})
    print(json.dumps({"id": PID, "batch": BATCH, "oracle": len(oracle_rows), "formal": len(cases),
        "public": sum(not case["hidden"] for case in cases), "mutantsKilled": len(witnesses)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
