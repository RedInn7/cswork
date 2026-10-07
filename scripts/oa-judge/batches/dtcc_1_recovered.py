"""Author and independently verify the OAMaster DTCC recurring-decimal OA."""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
IDENT = "oa-dtcc-1"
BATCH = "dtcc-1-recovered"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_URL = "https://oamaster.com/docs/companies/dtcc#1-find-reciprocal"
SOURCE_HASH = "70cfcc291ba0cede2e3560160c36140ba63bada16f29a6855a26c4f473786a9b"
SOURCE_SHA256 = "830ee5d830b4114acb98debf63cb102bb2bec04b7129b322418fb12d448289ea"
SOURCE_BLOB = "8fe92058a343d7c1cdea6005b65ae251bcd48dbe"
PREVIOUS_REASON = "有限小数例子 1/8 要求输出 `0.1250 0`，但文字未定义终止小数末尾零的数量/周期表示；`0.125 0` 与样例数值相同却字符串不同。"

REFERENCE = r'''import sys

def solve(raw):
    n = int(raw.strip())
    digits = []
    first_position = {}
    remainder = 1
    while remainder != 0 and remainder not in first_position:
        first_position[remainder] = len(digits)
        remainder *= 10
        digits.append(str(remainder // n))
        remainder %= n
    if remainder == 0:
        prefix = "".join(digits)
        cycle = "0"
    else:
        start = first_position[remainder]
        prefix = "".join(digits[:start])
        cycle = "".join(digits[start:])
    return f"0.{prefix}{cycle} {cycle}"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {
        "name": "忽略有限小数后的非循环前缀",
        "code": r'''import sys
def solve(raw):
 n=int(raw.strip());r=1;seen={};digits=[]
 while r not in seen:
  seen[r]=len(digits);r*=10;digits.append(str(r//n));r%=n
 cycle="".join(digits[seen[r]:])
 return "0."+cycle+" "+cycle
if __name__ == "__main__": print(solve(sys.stdin.read()))
''',
    },
    {
        "name": "只输出循环节的首位",
        "code": r'''import sys
def solve(raw):
 n=int(raw.strip());r=1;seen={};digits=[]
 while r not in seen:
  seen[r]=len(digits);r*=10;digits.append(str(r//n));r%=n
 start=seen[r];prefix="".join(digits[:start]);cycle=digits[start]
 return "0."+prefix+cycle+" "+cycle
if __name__ == "__main__": print(solve(sys.stdin.read()))
''',
    },
]


def write(folder: str, filename: str, value: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode(n: int) -> str:
    return f"{n}\n"


def oracle(n: int) -> str:
    """Independent number-theoretic oracle: factor the preperiod, then find the order."""
    denominator = n
    twos = fives = 0
    while denominator % 2 == 0:
        denominator //= 2
        twos += 1
    while denominator % 5 == 0:
        denominator //= 5
        fives += 1
    prefix_length = max(twos, fives)
    scale = 10**prefix_length
    prefix_value = scale // n
    prefix = str(prefix_value).zfill(prefix_length) if prefix_length else ""
    if denominator == 1:
        cycle = "0"
    else:
        period = 1
        residue = 10 % denominator
        while residue != 1:
            residue = (residue * 10) % denominator
            period += 1
        remainder = 10**prefix_length % n
        cycle_digits = []
        for _ in range(period):
            remainder *= 10
            cycle_digits.append(str(remainder // n))
            remainder %= n
        cycle = "".join(cycle_digits)
    return f"0.{prefix}{cycle} {cycle}"


def source_entry() -> dict:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    entry = next(item for item in catalog["items"] if item["id"] == IDENT)
    assert entry["contentHash"] == SOURCE_HASH
    return entry


def run(code: str, n: int) -> str:
    completed = subprocess.run(
        ["python3", "-I", "-c", code], input=encode(n), text=True,
        capture_output=True, check=True, timeout=3,
    )
    return completed.stdout.strip()


def main() -> None:
    rng = random.Random(20261007)
    formal_numbers = [2, 3, 8, 9, 6, 12, 20, 7, 11, 13, 14, 15, 16, 18, 25, 28, 40, 56, 81, 125, 99989, 99991]
    candidates = list(range(2, 1000))
    rng.shuffle(candidates)
    oracle_numbers = []
    for n in candidates:
        if n not in formal_numbers:
            oracle_numbers.append(n)
        if len(oracle_numbers) == 120:
            break
    # Each oracle input is unique and kept disjoint from the formal package cases.
    cases = []
    for index, n in enumerate(formal_numbers):
        cases.append({
            "name": "OAMaster 示例 1（1/8）" if n == 8 else "OAMaster 示例 2（1/9）" if n == 9 else f"循环边界 {index + 1}",
            "input": encode(n), "expectedOutput": oracle(n) + "\n",
            "hidden": index >= 2, "weight": 1,
        })
    for n in oracle_numbers:
        assert run(REFERENCE, n) == oracle(n), (n, run(REFERENCE, n), oracle(n))
    for n in formal_numbers:
        assert run(REFERENCE, n) == oracle(n), (n, run(REFERENCE, n), oracle(n))
    rejected = []
    for mutant in MUTANTS:
        witness = next(n for n in formal_numbers if run(mutant["code"], n) != oracle(n))
        rejected.append({"name": mutant["name"], "rejectedByInputs": [encode(witness)]})

    editorial = """## 思路

用长除法跟踪余数。余数第一次出现的位置是小数循环的起点；之后再次出现，循环节就确定。若余数变为 0，则小数有限，之后循环节按题意取 0。

## 样例格式说明

将小数写成“非循环前缀 + 一次循环节”，空格后再输出一次循环节。于是 1/8 = 0.125000… 的前缀是 125、循环节是 0，输出 `0.1250 0`；1/9 的前缀为空、循环节是 1，输出 `0.1 1`。两个源样例共同确定有限小数按循环 0 表示，并非任意补零。

## 正确性

十进制长除法的每一步由当前余数唯一决定。余数为 0 表示后续数字全为 0；非零余数最多只有 N-1 种，重复时其后的数字序列从此周期重复。首次出现位置因此给出最短非循环前缀和对应循环节。

## 复杂度

最多处理 N 个余数，时间和空间均为 O(N)。"""
    reference_path = OA / "references" / f"{IDENT}.py"
    reference_path.parent.mkdir(parents=True, exist_ok=True)
    reference_path.write_text(REFERENCE, encoding="utf-8")
    problem = {
        "id": IDENT, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Find Reciprocal", "difficulty": "简单",
        "tags": ["OA", "DTCC", "数学", "循环小数"],
        "description": "给定整数 N，求 1/N 的十进制展开。输出小数的非循环前缀加一次循环节，空格后再输出一次循环节。有限小数按循环节 0 处理。",
        "input": "输入一个整数 N（2 ≤ N ≤ 10^5）。",
        "output": "输出 `0.`、非循环前缀、一次循环节、一个空格和第二次循环节。若小数有限，循环节为 0。",
        "explanation": "保存长除法中每个余数首次出现的位置；余数重复处开始循环。余数为 0 时，剩余小数位无限重复 0。",
        "hints": ["先不要用浮点数；用余数生成小数位。", "有限小数的循环节按两个样例取 0。"],
        "timeLimit": 4, "memoryLimit": 65536, "outputLimit": 512,
        "checker": "exact", "languages": ["python", "java", "cpp"],
    }
    parse = subprocess.run(
        ["node", "--import", "tsx", "-e",
         "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],
        cwd=ROOT, input=json.dumps({"schemaVersion": 1, "problem": problem, "cases": cases}, ensure_ascii=False),
        text=True, capture_output=True, check=True,
    )
    package_bytes = parse.stdout.encode()
    package = json.loads(parse.stdout)
    write("packages", f"{IDENT}.json", package)
    oracles = [{"input": encode(n), "expectedOutput": oracle(n) + "\n"} for n in oracle_numbers]
    write("oracles", f"{IDENT}.json", oracles)
    write("mutants", f"{IDENT}.json", MUTANTS)
    write("editorials", f"{IDENT}.json", {
        "schemaVersion": 1, "id": IDENT, "title": "Find Reciprocal",
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": SOURCE_HASH, "author": "CSWork",
    })
    batch = {"schemaVersion": 1, "items": [{
        "id": IDENT, "sourceContentHash": SOURCE_HASH,
        "packageChecksum": hashlib.sha256(package_bytes).hexdigest(),
        "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }]}
    report_path = OA / "reports" / f"{BATCH}.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else None
    item_report = report["problems"][0] if report and report.get("problems") else {}
    manifest_bytes = (json.dumps(batch, ensure_ascii=False, indent=2) + "\n").encode()
    report_valid = bool(
        report and report.get("allPassed") is True
        and report.get("batch") == BATCH
        and report.get("batchSha256") == hashlib.sha256(manifest_bytes).hexdigest()
        and item_report.get("id") == IDENT
        and item_report.get("formal") == len(cases)
        and item_report.get("oracle") == len(oracles)
        and item_report.get("passed") == len(cases) + len(oracles)
        and sorted(item_report.get("killed", [])) == sorted(m["name"] for m in MUTANTS)
    )
    destination = "batches" if report_valid or (OA / "batches" / f"{BATCH}.json").exists() else "candidate-batches"
    write(destination, f"{BATCH}.json", batch)
    if destination == "batches":
        (OA / "candidate-batches" / f"{BATCH}.json").unlink(missing_ok=True)
    write("validation", f"{BATCH}.json", {
        "schemaVersion": 1,
        "note": (f"自有 GoJudge 通过 {item_report['passed']} 项（{item_report['formal']} 正式用例 + {item_report['oracle']} 独立 oracle），两个正常退出的错误实现均被击杀。"
                 if report_valid else "本地参考解与独立数论 oracle 一致；尚待自有 GoJudge 沙箱验证。"),
        "problems": [{"id": IDENT, "formalCases": len(cases), "oracleCases": len(oracles),
                      "negativeControls": [{"name": item["name"], "rejectedByCases": [index for index, c in enumerate(cases) if run(item["code"], int(c["input"])) != c["expectedOutput"].strip()]} for item in MUTANTS],
                      "sourceSha256": SOURCE_SHA256}],
    })
    write("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT, "items": [{
            "id": IDENT, "sourceUrl": SOURCE_URL, "sourceContentHash": SOURCE_HASH,
            "rawPath": "web/content/docs/companies/dtcc.mdx", "rawGitBlobSha": SOURCE_BLOB,
            "sourceFileSha256": SOURCE_SHA256, "previousStatus": "blocked",
            "previousReason": PREVIOUS_REASON,
            "resolution": "题面称有限小数末尾无限重复；两个样例共同定义格式：输出非循环前缀 + 一次循环节，再以空格重复循环节。有限小数循环节为 0。",
        }],
    })
    if report_valid:
        write("resolutions", f"{BATCH}.json", {
            "schemaVersion": 1, "items": [{"id": IDENT, "batch": BATCH,
                "sourceContentHash": SOURCE_HASH, "previousReason": PREVIOUS_REASON,
                "reason": "题面输出是非循环前缀 + 一次循环节，空格后重复该循环节；1/8 与 1/9 两个样例确定有限小数的循环节为 0。",
            }],
        })
    print(json.dumps({"id": IDENT, "batch": BATCH, "formalCases": len(cases),
                      "oracleCases": len(oracles), "mutants": len(MUTANTS),
                      "mutantsRejected": rejected, "sandboxVerified": report_valid}, ensure_ascii=False))


if __name__ == "__main__":
    main()
