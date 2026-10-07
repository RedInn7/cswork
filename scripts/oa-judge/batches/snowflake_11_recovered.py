"""Recover and validate Snowflake OA #11 from its fixed source snapshot."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-snowflake-11"
BATCH = "snowflake-11-recovered"
SEED = 20261010
SOURCE_URL = "https://oamaster.com/docs/companies/snowflake#11-maximum-order-volume-weighted-interval-scheduling"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
UPSTREAM_BLOB = "1091a782a0f60117925eb1a9a96ee4cf9df4e5bb"
UPSTREAM_SHA = "a2cd5b9918339feb1b7715d70c79a1cbf064f9a5358fe7f97bebeb5b5bb171c0"
MAX_N = 100_000
MAX_FIELD = 1_000_000_000

REFERENCE = r'''import sys
from bisect import bisect_right

def solve(raw):
    data = list(map(int, raw.split()))
    if len(data) < 1:
        raise ValueError("expected N and three arrays")
    n = data[0]
    if not 1 <= n <= 100_000 or len(data) != 1 + 3 * n:
        raise ValueError("N is outside the supported range or array lengths differ")
    starts = data[1:1 + n]
    durations = data[1 + n:1 + 2 * n]
    volumes = data[1 + 2 * n:]
    if any(not 1 <= x <= 1_000_000_000 for x in starts + durations + volumes):
        raise ValueError("start, duration and volume must be in [1, 10^9]")
    intervals = sorted((s, s + d, v) for s, d, v in zip(starts, durations, volumes))
    intervals.sort(key=lambda item: item[1])
    ends = [end for _, end, _ in intervals]
    best = [0] * (n + 1)
    for i, (start, _, volume) in enumerate(intervals, 1):
        previous = bisect_right(ends, start, 0, i - 1)
        best[i] = max(best[i - 1], best[previous] + volume)
    return str(best[n])

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    (
        "把结束时刻等于下一开始时刻也判为冲突",
        r'''import sys
from bisect import bisect_left
d=list(map(int,sys.stdin.read().split())); n=d[0]; s=d[1:1+n]; dur=d[1+n:1+2*n]; v=d[1+2*n:]
a=sorted((x,x+y,z) for x,y,z in zip(s,dur,v)); a.sort(key=lambda x:x[1]); ends=[x[1] for x in a]; f=[0]*(n+1)
for i,(start,end,volume) in enumerate(a,1):
 p=bisect_left(ends,start,0,i-1); f[i]=max(f[i-1],f[p]+volume)
print(f[n])
''',
    ),
    (
        "按单个电话的 volume 贪心，漏掉总量更大的组合",
        r'''import sys
d=list(map(int,sys.stdin.read().split())); n=d[0]; s=d[1:1+n]; dur=d[1+n:1+2*n]; v=d[1+2*n:]
a=sorted(((z,x,x+y) for x,y,z in zip(s,dur,v)),reverse=True); chosen=[]; ans=0
for volume,start,end in a:
 if all(end<=a0 or b0<=start for a0,b0 in chosen): chosen.append((start,end)); ans+=volume
print(ans)
''',
    ),
]


def encode(starts: list[int], durations: list[int], volumes: list[int]) -> str:
    n = len(starts)
    return f"{n}\n{' '.join(map(str, starts))}\n{' '.join(map(str, durations))}\n{' '.join(map(str, volumes))}\n"


def brute(starts: list[int], durations: list[int], volumes: list[int]) -> int:
    intervals = [(s, s + d, v) for s, d, v in zip(starts, durations, volumes)]
    best = 0
    for mask in range(1 << len(starts)):
        picked = sorted(intervals[i] for i in range(len(starts)) if mask >> i & 1)
        if all(picked[i][1] <= picked[i + 1][0] for i in range(len(picked) - 1)):
            best = max(best, sum(item[2] for item in picked))
    return best


def run(program: str, raw: str) -> str:
    result = subprocess.run(["python3", "-c", program], input=raw, text=True,
                            capture_output=True, timeout=8, check=False)
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
    old_review = next(item for item in json.loads((OA / "reviews/snowflake-first.json").read_text(encoding="utf-8"))["items"] if item["id"] == PID)

    fixed = [
        ([10, 5, 15, 18, 30], [30, 12, 20, 35, 35], [50, 51, 20, 25, 10]),
        ([1, 2], [1, 1], [5, 7]),  # Source-code contract: adjacent half-open intervals can be chained.
        ([1, 2], [2, 1], [5, 7]),
        ([1], [1], [MAX_FIELD]),
        ([1, 1, 1], [10, 2, 1], [100, 20, 10]),
        ([1, 3, 5, 7], [2, 2, 2, 2], [4, 8, 3, 9]),
        ([3, 1, 2], [2, 5, 1], [7, 12, 6]),
        ([1, 4, 2, 7], [2, 2, 5, 1], [6, 8, 20, 4]),
    ]
    rng = random.Random(SEED)
    values = list(fixed)
    seen = {tuple(tuple(row) for row in item) for item in values}
    while len(values) < 121:
        n = rng.randint(1, 10)
        starts = [rng.randint(1, 30) for _ in range(n)]
        durations = [rng.randint(1, 12) for _ in range(n)]
        volumes = [rng.randint(1, 50) for _ in range(n)]
        item = (tuple(starts), tuple(durations), tuple(volumes))
        if item not in seen:
            values.append((starts, durations, volumes))
            seen.add(item)

    oracle_rows = []
    for starts, durations, volumes in values:
        expected = str(brute(starts, durations, volumes))
        raw = encode(starts, durations, volumes)
        assert run(REFERENCE, raw) == expected, (starts, durations, volumes, expected)
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    formal_values = list(fixed)
    while len(formal_values) < 34:
        formal_values.append(values[len(formal_values) % len(values)])
    cases = []
    for index, (starts, durations, volumes) in enumerate(formal_values):
        cases.append({
            "name": "原题示例" if index == 0 else f"边界用例 {index}",
            "input": encode(starts, durations, volumes),
            "expectedOutput": str(brute(starts, durations, volumes)) + "\n",
            "hidden": index != 0, "weight": 1,
        })

    large_starts = [2 * index + 1 for index in range(MAX_N)]
    large_durations = [1] * MAX_N
    large_volumes = [MAX_FIELD] * MAX_N
    cases.append({
        "name": "最大规模与 64 位订单量",
        "input": encode(large_starts, large_durations, large_volumes),
        "expectedOutput": f"{MAX_N * MAX_FIELD}\n", "hidden": True, "weight": 1,
    })
    assert run(REFERENCE, cases[-1]["input"]) == cases[-1]["expectedOutput"].strip()

    killed = []
    mutant_docs = []
    for name, program in MUTANTS:
        rejects = [index for index, case in enumerate(cases[:len(formal_values)])
                   if run(program, case["input"]) != case["expectedOutput"].strip()]
        assert rejects, f"surviving mutant: {name}"
        killed.append({"name": name, "rejectedByCases": rejects})
        mutant_docs.append({"name": name, "code": program})

    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "最大接单量", "difficulty": "中等",
        "tags": ["OA", "Snowflake", "动态规划", "二分查找", "区间调度"],
        "description": (
            "超市一天内收到 n 个电话，每个电话有开始时刻 start、持续时间 duration 和订单量 volume。选择互不冲突的电话，使订单量总和最大。"
            "电话区间按来源三语实现采用半开区间 [start, start+duration)：前一通结束时刻等于后一通开始时刻时，两通电话可以连续接听。"
            f"\n\n原题约束：1≤n≤{MAX_N}，1≤start[i], duration[i], volume[i]≤10^9。"
            "\n\n原题来源：" + SOURCE_URL + "（固定快照内容指纹 " + source["contentHash"] + "）。"
        ),
        "input": "第一行输入 n；随后三行分别输入 n 个 start、duration、volume。",
        "output": "输出可获得的最大订单量总和。",
        "explanation": "按结束时刻排序。令 dp[i] 表示前 i 个电话的最大订单量；选择第 i 个电话时，二分查找所有结束时刻不晚于其开始时刻的电话数量 p，转移为 max(dp[i-1], dp[p]+volume[i])。",
        "hints": ["按电话结束时刻排序。", "选择当前电话前，二分找出最后一个能与它衔接的电话。"],
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

按结束时刻排序。设 dp[i] 是前 i 个电话可取得的最大订单量。对于第 i 个电话，用二分查找结束时刻不晚于它开始时刻的电话数量 p：不接当前电话时为 dp[i-1]，接听时为 dp[p]+volume[i]，取较大值。

## 正确性

对按结束时刻排序后的前 i 个电话，最优方案要么不选第 i 个电话，此时收益至多 dp[i-1]；要么选第 i 个电话。采用来源三语实现的半开区间规则，所有可与它衔接的电话恰是结束时刻≤start[i] 的区间，且这些区间构成排序前缀 p，故选择它时的最优收益为 dp[p]+volume[i]。两种情形覆盖所有可行方案，取最大即得 dp[i]。对 i 归纳可得 dp[n] 是全局最优值。

## 复杂度

时间 O(n log n)，空间 O(n)。

## 来源与本站约定

原题示例可选电话 2 和 4，订单量为 76。原题已给出输入范围，但没有写明端点相等时是否冲突；固定快照 Python、Java、C++ 三种实现都以 `end ≤ next start` 判定可衔接，本站将该实现规则明确解释为半开区间 `[start, start+duration)`。本站补充 stdin/stdout 输入格式。来源：{SOURCE_URL}
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
        "title": "最大接单量", "explanation": editorial,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"]})
    put("oracles", f"{PID}.json", oracle_rows)
    put("mutants", f"{PID}.json", mutant_docs)
    put("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": UPSTREAM_COMMIT, "catalogContentHash": source["contentHash"],
        "items": [{"id": PID, "company": "Snowflake", "title": source["title"],
            **({"status": "authored", "verification": f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项（{report_problem['formal']} formal + {report_problem['oracle']} oracle），两个 mutant 均被击杀。"} if report_valid else {}),
            "sourceUrl": SOURCE_URL, "previousStatus": old_review["status"],
            "previousReason": old_review["reason"],
            "fixedSource": {"path": "web/content/docs/snowflake.mdx", "gitBlobSha": UPSTREAM_BLOB, "rawSha256": UPSTREAM_SHA,
                "evidence": "固定快照中 Python 使用 bisect_right、Java 二分与 C++ upper_bound 均允许前一 end 等于下一 start。"},
            "siteAdditions": ["端点相等时按三语实现解释为可连续接听", "stdin/stdout 输入协议"],
            "interpretation": "两个电话不冲突当且仅当前一 end≤后一 start，与快照三语实现一致。"}],
    })
    verification = (f"121 个唯一枚举子集 oracle、35 个正式用例（含端点相等边界、n=100000 与 64 位答案）及两个错误程序均通过用户自有 GoJudge，共 {report_problem['passed']} 项。"
                    if report_valid else "121 个唯一枚举子集 oracle、正式边界用例（含端点相等、n=100000 与 64 位答案）及两个错误程序已在本地验证；待用户自有 GoJudge 验收。")
    put("resolutions", f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
        "previousReason": old_review["reason"],
        "reason": "固定 OAMaster 快照的 Python/Java/C++ 三种实现均以 end≤next start 判断电话可衔接；本站据此明确解释端点相等规则，并只补充 stdin/stdout 输入协议。" + verification,
    }]})
    put("validation", f"{BATCH}.json", {"schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({row['input'] for row in oracle_rows}),
            "publicCases": 1, "hiddenCases": len(cases) - 1,
            "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode())}],
        "note": (f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项，两个 mutant 均被击杀。" if report_valid
                 else "本地原题样例、边界、独立子集枚举 oracle 和 mutant 验证通过；待用户自有 GoJudge 验收。")})
    print(json.dumps({"id": PID, "candidateBatch": BATCH,
        "oracle": len(oracle_rows), "formal": len(cases), "mutantsKilled": len(killed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
