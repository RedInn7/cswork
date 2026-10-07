"""Recover Cisco OA #9 using the canonical OAMaster contract."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-cisco-9"
BATCH = "cisco-9-recovered"
SEED = 20261011
SOURCE_URL = "https://oamaster.com/docs/companies/cisco#9-calculate-mean-and-mode"
FASTPREP_URL = "https://www.fastprep.io/problems/cisco-calculate-mean-and-mode"
FASTPREP_SECONDARY_URL = "https://www.fastprep.io/problems/cisco-find-mean-and-mode"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_BLOB = "e86c00f54290277ff64458d50d1f24acdc6be9d2"
RAW_SHA = "d8788b2f6b77fc7290b1c5b3d057c3d271efe0be17974faaa32e4fffe1ddcd91"
RAW_SECONDARY_BLOB = "25f371e098296f8c7e66e5d26aecf09457878dd1"
RAW_SECONDARY_SHA = "b667787230823db4091e05e5ecc3a640537b6ed3ed9aef85425443fb27c86b26"
MAX_N = 100_000
MAX_VALUE = 1_000_000_000

REFERENCE = r'''import sys
from collections import Counter

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        raise ValueError("expected N and N integer values")
    n, values = data[0], data[1:]
    if not 1 <= n <= 100_000 or len(values) != n:
        raise ValueError("N is outside the supported range or value count differs")
    if any(not -1_000_000_000 <= value <= 1_000_000_000 for value in values):
        raise ValueError("an input value is outside [-10^9, 10^9]")
    mean = sum(values) // n  # Python // implements mathematical floor for negatives.
    counts = Counter(values)
    maximum_frequency = max(counts.values())
    mode = min(value for value, frequency in counts.items() if frequency == maximum_frequency)
    return f"{mean} {mode}"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    (
        "负均值用向零截断代替 floor",
        r'''import sys
d=list(map(int,sys.stdin.read().split())); n=d[0]; a=d[1:]; s=sum(a)
mean=(abs(s)//n)*(1 if s>=0 else -1); c={}
for x in a:c[x]=c.get(x,0)+1
m=max(c.values()); mode=min(x for x,v in c.items() if v==m)
print(mean,mode)
''',
    ),
    (
        "并列众数时返回最大值而非题面规定的最小值",
        r'''import sys
d=list(map(int,sys.stdin.read().split())); n=d[0]; a=d[1:]; c={}
for x in a:c[x]=c.get(x,0)+1
m=max(c.values()); print(sum(a)//n,max(x for x,v in c.items() if v==m))
''',
    ),
]


def encode(values: list[int]) -> str:
    return f"{len(values)}\n{' '.join(map(str, values))}\n"


def oracle(values: list[int]) -> str:
    counts: dict[int, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    mean = sum(values) // len(values)
    mode_frequency = max(counts.values())
    mode = min(value for value, count in counts.items() if count == mode_frequency)
    return f"{mean} {mode}"


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
    old_review = next(item for item in json.loads((OA / "reviews/cisco-first.json").read_text(encoding="utf-8"))["items"] if item["id"] == PID)

    fixed = [
        [1, 2, 7, 3, 2],  # OAMaster / Fastprep example.
        [0],
        [-1, 0],           # -0.5 floors to -1; both values tie as mode.
        [-2, -1],          # -1.5 floors to -2.
        [-3, -2, -1],      # Three-way mode tie; OAMaster selects the smallest.
        [1, 1, 2, 2],       # Two-way mode tie.
        [-10, -5, -5],
        [1, 2, 3, 4, 5, 6],
        [MAX_VALUE, MAX_VALUE, -MAX_VALUE],
    ]
    rng = random.Random(SEED)
    values = list(fixed)
    seen = {tuple(item) for item in values}
    while len(values) < 121:
        size = rng.randint(1, 12)
        array = [rng.randint(-20, 20) for _ in range(size)]
        key = tuple(array)
        if key not in seen:
            values.append(array)
            seen.add(key)

    oracle_rows = []
    for array in values:
        expected = oracle(array)
        raw = encode(array)
        assert run(REFERENCE, raw) == expected, (array, expected)
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    formal_values = fixed[:]
    while len(formal_values) < 34:
        formal_values.append(values[len(formal_values) % len(values)])
    cases = []
    for index, array in enumerate(formal_values):
        cases.append({
            "name": "原题示例" if index == 0 else f"边界用例 {index}",
            "input": encode(array), "expectedOutput": oracle(array) + "\n",
            "hidden": index != 0, "weight": 1,
        })

    large = [MAX_VALUE] * MAX_N
    cases.append({
        "name": "最大规模与 32 位求和溢出",
        "input": encode(large), "expectedOutput": f"{MAX_VALUE} {MAX_VALUE}\n",
        "hidden": True, "weight": 1,
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
        "title": "计算平均数与众数", "difficulty": "简单",
        "tags": ["OA", "Cisco", "数组", "哈希表"],
        "description": (
            "给定整数数组，输出两个整数：向下取整的算术平均数，以及出现频率最高的众数。"
            "若有多个众数，返回其中最小的值。"
            f"\n\n原题约束：1≤N≤{MAX_N}，-10^9≤inputNums[i]≤10^9。"
            "\n\n原题来源：" + SOURCE_URL + "（固定快照内容指纹 " + source["contentHash"] + "）。"
            "另一份同题 Fastprep 记录未写并列众数规则；本题按 OAMaster 原题页面明确给出的最小值规则。"
        ),
        "input": "第一行输入 N；第二行输入 N 个整数 inputNums[i]。",
        "output": "按 `mean mode` 顺序输出，两个整数以空格分隔。",
        "explanation": "平均数为 floor(sum(inputNums)/N)，注意负数非整除时向负无穷取整。用频次表统计每个值出现次数，在最高频值中取最小者。",
        "hints": ["Java/C++ 的整数除法对负数向零截断，不能直接代替数学 floor。", "并列众数按题面返回最小值。"],
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

一次扫描累加元素得到总和，同时统计每个整数的频次。平均数按数学定义取 floor(sum/N)，众数取频次最高者；若并列，取最小值。

## 正确性

数组算术平均数按题面定义为总和除以 N 后向下取整，所以结果唯一为 floor(sum/N)，尤其负数不能按向零截断。众数按定义是出现次数达到最大值的元素；在这些元素中取最小值正好满足题面的并列规则。一次完整频次统计即可得到最大频次和最小众数。

## 复杂度

时间 O(N)，空间 O(U)，U 为不同整数的数量。

## 来源与边界

OAMaster 原题示例输出 3 2；示例解释把平均数写成了 15/2=3，这是原文笔误：数组有 5 个元素，正确计算是 15/5=3，预期输出不变。其正文明确并列众数时取最小值，约束为 N≤10⁵、元素绝对值≤10⁹。第二份 Fastprep 同题记录确认负数均值应 floor，但未写并列众数；本站遵循 OAMaster 的明文 tie 规则。输入输出协议由本站补充。来源：{SOURCE_URL}；补充同题记录：{FASTPREP_URL}、{FASTPREP_SECONDARY_URL}。
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
        "title": "计算平均数与众数", "explanation": editorial,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"]})
    put("oracles", f"{PID}.json", oracle_rows)
    put("mutants", f"{PID}.json", mutant_docs)
    put("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": UPSTREAM_COMMIT, "catalogContentHash": source["contentHash"],
        "items": [{"id": PID, "company": "Cisco", "title": source["title"],
            **({"status": "authored", "verification": f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项（{report_problem['formal']} formal + {report_problem['oracle']} oracle），两个 mutant 均被击杀。"} if report_valid else {}),
            "sourceUrl": SOURCE_URL, "previousStatus": old_review["status"],
            "previousReason": old_review["reason"],
            "sourceErrata": [{"location": "OAMaster 原题示例解释", "original": "15/2=3", "correction": "15/5=3", "reason": "示例输入包含 5 个整数且总和为 15；原解释中的除数写错，但预期均值及输出正确。"}],
            "fixedSource": {"path": "web/content/docs/companies/cisco.mdx",
                "evidence": "固定 OAMaster 页面正文明确 floor 平均数、并列众数取最小值及输入范围；OAMaster Python 代码使用 //，其 Java/C++ 对负均值用截断除法，与 floor 题意不符，本站参考解按题意修正。"},
            "supportingSources": [
                {"url": FASTPREP_URL, "gitBlobSha": RAW_BLOB, "rawSha256": RAW_SHA,
                 "evidence": "Fastprep 同题样例一致，摘录在题意正文处截断；未给并列众数规则。"},
                {"url": FASTPREP_SECONDARY_URL, "gitBlobSha": RAW_SECONDARY_BLOB, "rawSha256": RAW_SECONDARY_SHA,
                 "evidence": "同题完整正文明确非整数均值向下取整；未给并列众数规则。"},
            ],
            "siteAdditions": ["stdin/stdout 输入协议"],
            "interpretation": "遵循 OAMaster 明文规则：均值为 floor(sum/N)，众数并列时取最小值；Fastprep 副本作为同题交叉佐证，不覆盖 OAMaster 的并列规则。"}],
    })
    verification = (f"121 个独立频次 oracle、35 个正式用例（含负数 floor、并列众数、N=100000 和 32 位累加溢出边界）及两个错误程序均通过用户自有 GoJudge，共 {report_problem['passed']} 项。"
                    if report_valid else "121 个独立频次 oracle、正式边界用例（含负数 floor、并列众数、N=100000 和 32 位累加溢出边界）及两个错误程序已在本地验证；待用户自有 GoJudge 验收。")
    put("resolutions", f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
        "previousReason": old_review["reason"],
        "reason": "按 OAMaster 页面中明确写出的 floor 均值、最小并列众数及其输入约束接入；两份 Fastprep 副本未写并列规则但不与 OAMaster 明文冲突。修正源 Java/C++ 对负数除法向零截断的问题。" + verification,
    }]})
    put("validation", f"{BATCH}.json", {"schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({row['input'] for row in oracle_rows}),
            "publicCases": 1, "hiddenCases": len(cases) - 1,
            "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode())}],
        "note": (f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项，两个 mutant 均被击杀。" if report_valid
                 else "本地原题样例、负数/并列边界、独立频次 oracle 和 mutant 验证通过；待用户自有 GoJudge 验收。")})
    print(json.dumps({"id": PID, "candidateBatch": BATCH,
        "oracle": len(oracle_rows), "formal": len(cases), "mutantsKilled": len(killed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
