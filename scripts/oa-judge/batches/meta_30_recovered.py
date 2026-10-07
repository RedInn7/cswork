"""Author and validate Meta OA #30 from the fixed three-language snapshot."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-meta-30"
BATCH = "meta-30-recovered"
SEED = 20261009
SOURCE_URL = "https://oamaster.com/docs/companies/meta#30-enumerating-narrative-sections"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
MAX_N = 200_000
MAX_VALUE = 1_000_000_000

REFERENCE = r'''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    if len(data) < 2:
        raise ValueError("expected N, K and N values")
    size, needed = data[:2]
    values = data[2:]
    if not 1 <= size <= 200_000 or len(values) != size:
        raise ValueError("N is outside the supported range or value count differs")
    if not 1 <= needed <= 200_000 or any(not -1_000_000_000 <= x <= 1_000_000_000 for x in values):
        raise ValueError("K or a value is outside the supported range")

    frequency = {}
    disjoint_pairs = 0
    left = 0
    answer = 0
    for right, value in enumerate(values):
        count = frequency.get(value, 0) + 1
        frequency[value] = count
        if count % 2 == 0:
            disjoint_pairs += 1
        while disjoint_pairs >= needed:
            answer += size - right
            left_value = values[left]
            left += 1
            frequency[left_value] -= 1
            if frequency[left_value] % 2 == 1:
                disjoint_pairs -= 1
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    (
        "把同一值的任意两项组合都算成不同 pair（C(freq,2)）",
        r'''import sys
d=list(map(int,sys.stdin.read().split())); n,k=d[:2]; a=d[2:]; ans=0
for i in range(n):
 c={}; pairs=0
 for j in range(i,n):
  v=a[j]; c[v]=c.get(v,0)+1; pairs+=c[v]-1
  if pairs>=k: ans+=1
print(ans)
''',
    ),
    (
        "每种重复值只算一对，忽略第三、第四次出现",
        r'''import sys
d=list(map(int,sys.stdin.read().split())); n,k=d[:2]; a=d[2:]; ans=0
for i in range(n):
 c={}; pairs=0
 for j in range(i,n):
  c[a[j]]=c.get(a[j],0)+1
  pairs=sum(v>=2 for v in c.values())
  if pairs>=k: ans+=1
print(ans)
''',
    ),
]


def encode(values: list[int], needed: int) -> str:
    return f"{len(values)} {needed}\n{' '.join(map(str, values))}\n"


def brute(values: list[int], needed: int) -> int:
    """Enumerate every subarray and independently sum floor(freq[value] / 2)."""
    answer = 0
    for start in range(len(values)):
        counts: dict[int, int] = {}
        for value in values[start:]:
            counts[value] = counts.get(value, 0) + 1
            pairs = sum(count // 2 for count in counts.values())
            if pairs >= needed:
                answer += 1
    return answer


def run(program: str, raw: str) -> str:
    result = subprocess.run(["python3", "-c", program], input=raw, text=True,
                            capture_output=True, timeout=8, check=False)
    if result.returncode != 0:
        raise AssertionError((result.returncode, result.stderr[:300], raw[:200]))
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
    old_review = next(item for item in json.loads((OA / "reviews/meta-remaining.json").read_text(encoding="utf-8"))["items"] if item["id"] == PID)

    fixed = [
        ([0, 1, 0, 1, 0], 2),  # Source example: the three listed sections.
        ([1], 1),
        ([4, 4], 1),
        ([4, 4, 4], 2),
        ([4, 4, 4, 4], 2),
        ([1, 2, 3, 4], 1),
        ([-1, -1, 2, 2], 2),
        ([0, 0, 1, 1, 0, 0], 2),
        ([8, 8, 8, 8, 8, 8], 3),
        ([1, 2, 1, 2, 3, 3], 2),
    ]
    rng = random.Random(SEED)
    values = list(fixed)
    seen = {(tuple(array), needed) for array, needed in values}
    while len(values) < 121:
        size = rng.randint(1, 12)
        array = [rng.randint(-4, 4) for _ in range(size)]
        needed = rng.randint(1, 7)
        item = (tuple(array), needed)
        if item not in seen:
            values.append((array, needed))
            seen.add(item)

    oracle_rows = []
    for array, needed in values:
        expected = str(brute(array, needed))
        raw = encode(array, needed)
        assert run(REFERENCE, raw) == expected, (array, needed, expected)
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    formal_values = fixed + [
        ([2, 2, 2, 2, 2], 1), ([2, 2, 2, 2, 2], 2),
        ([0, 1, 0, 1, 0, 1], 3), ([-5, -5, -5, -5, -5, -5], 3),
        ([1, 2, 1, 2, 1, 2, 1], 2), ([9, 8, 7, 6, 5], 1),
        ([0, 0, 1, 1, 2, 2, 3, 3], 4), ([1, 2, 3], 2),
    ]
    # Add deterministic varied examples to reach the common 34-case package size.
    while len(formal_values) < 34:
        formal_values.append(values[len(formal_values) % len(values)])
    cases = []
    for index, (array, needed) in enumerate(formal_values):
        expected = str(brute(array, needed)) + "\n"
        cases.append({
            "name": "示例 1" if index == 0 else f"边界用例 {index}",
            "input": encode(array, needed), "expectedOutput": expected,
            "hidden": index != 0, "weight": 1,
        })

    # Large cases exercise input/memory bounds and a 64-bit result without brute force.
    large_n = [4] * MAX_N
    cases.extend([
        {"name": "最大规模与 64 位答案", "input": encode(large_n, 1),
         "expectedOutput": f"{MAX_N * (MAX_N - 1) // 2}\n", "hidden": True, "weight": 1},
        {"name": "最大规模边界 pair 数", "input": encode(large_n, MAX_N // 2),
         "expectedOutput": "1\n", "hidden": True, "weight": 1},
    ])
    assert run(REFERENCE, cases[-2]["input"]) == cases[-2]["expectedOutput"].strip()
    assert run(REFERENCE, cases[-1]["input"]) == "1"

    killed = []
    mutant_docs = []
    # The deliberately quadratic negative controls only run on small cases.
    for name, program in MUTANTS:
        rejects = [index for index, case in enumerate(cases[:len(formal_values)])
                   if run(program, case["input"]) != case["expectedOutput"].strip()]
        assert rejects, f"surviving mutant: {name}"
        killed.append({"name": name, "rejectedByCases": rejects})
        mutant_docs.append({"name": name, "code": program})

    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "统计含有足够不重叠相同数对的连续区间", "difficulty": "中等",
        "tags": ["OA", "Meta", "滑动窗口", "哈希表"],
        "description": (
            "给定整数数组 bucket 和正整数 k，统计包含至少 k 对相同数字的非空连续子数组数量。"
            "每一对由两个不同下标且数值相同的元素组成；不同 pair 不能共享下标。"
            "因此某个值出现 c 次时，最多贡献 floor(c/2) 对。"
            f"\n\n本站约束：1≤N≤{MAX_N}，1≤k≤{MAX_N}，-10^9≤bucket[i]≤10^9。"
            "原快照约束标为 Unknown；数值范围为本站支持范围。\n\n原题来源：" + SOURCE_URL
            + "（固定快照内容指纹 " + source["contentHash"] + "）。"
        ),
        "input": "第一行输入 N 和 k；第二行输入 N 个整数 bucket[i]。",
        "output": "输出满足条件的连续子数组数量。",
        "explanation": "维护滑动窗口中每个值的出现次数，并令 pairs 为所有 floor(freq/2) 之和。加入一个值后，若其次数变为偶数，pairs 加一；当窗口达到 k 对时，当前左端点下所有更靠右的结束位置也都满足，因此一次计入 N-right 个子数组，再移除当前最左元素继续收缩。",
        "hints": ["把每个值出现 c 次能提供的互不重叠 pair 数写成一个公式。", "固定右端点时，满足条件的左端点形成一个前缀区间。"],
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

用双指针维护窗口。每个数值出现 c 次时，最多组成 floor(c/2) 对不共享下标的相同数对。窗口新增一个值后，若其出现次数变成偶数，pair 数加一。只要当前窗口至少有 k 对，就为当前左端点计入所有以当前右端点或更靠右端点结束的区间，再移除最左元素继续收缩。

## 正确性

对每个值独立配对，出现 c 次最多可取 floor(c/2) 个互不重叠 pair，因此窗口的 pair 总数恰为各值 floor(freq/2) 之和。固定左端点后，右端点越靠右只会增加元素，不会减少 pair 数。当窗口首次满足条件时，所有终点不小于当前 right 的子数组都满足，一次计入 N-right 个。随后左端点右移；若仍满足，就为这个新左端点计入相应的后缀区间。双指针单调前进，所以每个满足的左端点恰在最早可行右端点处被处理，每个子数组被且仅被计入一次。移除元素时，仅当频次从偶数降为奇数才减少一对。

## 复杂度

时间 O(N)，空间 O(U)，其中 U 是窗口中不同值的数量。

## 来源与本站约定

原题样例列出 `[0,1,0,1,0]、k=2` 的三个区间；固定快照的 Python、Java、C++ 解法均在每个值出现次数达到偶数时增加一对，定义为不重叠配对。原快照约束未知；N、k、值域均按题面中的本站约束执行。来源：{SOURCE_URL}
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
        "title": "统计含有足够不重叠相同数对的连续区间", "explanation": editorial,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"]})
    put("oracles", f"{PID}.json", oracle_rows)
    put("mutants", f"{PID}.json", mutant_docs)
    put("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": UPSTREAM_COMMIT, "catalogContentHash": source["contentHash"],
        "items": [{"id": PID, "company": "Meta", "title": source["title"],
            **({"status": "authored", "verification": f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项（{report_problem['formal']} formal + {report_problem['oracle']} oracle），两个 mutant 均被击杀。"} if report_valid else {}),
            "sourceUrl": SOURCE_URL, "previousStatus": old_review["status"],
            "previousReason": old_review["reason"],
            "fixedSource": {"path": "web/content/docs/companies/meta.mdx",
                "evidence": "固定快照中 Python、Java、C++ 三种实现均在每个值的频次变为偶数时增加一对，删除左端后在频次变奇数时减少一对；原样例与此规则一致。"},
            "siteAdditions": ["不同 pair 不能共用数组下标", "本站 N、k、元素值范围", "stdin/stdout 输入协议"],
            "interpretation": "同值出现 c 次最多贡献 floor(c/2) 个不重叠 pair；统计至少有 k 个此类 pair 的非空连续子数组。"}],
    })
    verification = (f"121 个唯一暴力 oracle、36 个正式用例（含 N=200000 与 64 位答案）及两个错误程序均通过用户自有 GoJudge，共 {report_problem['passed']} 项。"
                    if report_valid else "121 个唯一暴力 oracle、正式边界用例（含 N=200000 与 64 位答案）及两个错误程序已在本地验证；待用户自有 GoJudge 验收。")
    put("resolutions", f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
        "previousReason": old_review["reason"],
        "reason": "固定 OAMaster 快照中的 Python/Java/C++ 三语实现一致采用每个值 floor(freq/2) 个不重叠 pair，且原样例与该规则相符；本站将 pair 不共享下标及输入范围明确写入题面。" + verification,
    }]})
    put("validation", f"{BATCH}.json", {"schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({row['input'] for row in oracle_rows}),
            "publicCases": 1, "hiddenCases": len(cases) - 1,
            "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode())}],
        "note": (f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项，两个 mutant 均被击杀。" if report_valid
                 else "本地源样例、边界、独立暴力 oracle 和 mutant 验证通过；待用户自有 GoJudge 验收。")})
    print(json.dumps({"id": PID, "candidateBatch": BATCH,
        "oracle": len(oracle_rows), "formal": len(cases), "mutantsKilled": len(killed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
