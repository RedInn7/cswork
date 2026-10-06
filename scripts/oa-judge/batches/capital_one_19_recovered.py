from __future__ import annotations

import hashlib
import itertools
import json
import random
import subprocess
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
ITEM = next(x for x in CATALOG["items"] if x["id"] == "oa-capital-one-19")
PID = ITEM["id"]
SEED = 20261006
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_BLOB = "772a74d8b9eeed782c007b460d6e7652465e39a1"
SOURCE_FILE_SHA = "0ba5ef56625f6f86e98625430b25a7b6eac53d70d65a41d2c23a5d0a7ebf1626"
PREVIOUS_REASON = "并列出现多个众数时未说明返回规则，且数字字符串是否允许负号/前导符号未定义。"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = '''from collections import Counter

def digital_root(text):
    digit_sum = sum(ord(ch) - ord("0") for ch in text)
    if digit_sum == 0:
        return 0
    return 1 + (digit_sum - 1) % 9

def sum_digits_until_one(numbers):
    roots = [digital_root(text) for text in numbers]
    counts = Counter(roots)
    maximum_frequency = max(counts.values())
    # Site contract: if several roots are modes, return the largest one.
    return max(root for root, frequency in counts.items()
               if frequency == maximum_frequency)

def solve(raw):
    data = raw.split()
    if not data:
        raise ValueError("expected list length and numeric strings")
    n = int(data[0])
    if not 1 <= n <= 200000 or len(data) != n + 1:
        raise ValueError("site limit: 1 <= n <= 200000")
    values = data[1:]
    if any(not value or any(ch < "0" or ch > "9" for ch in value)
           or len(value) > 100000 for value in values):
        raise ValueError("site contract: non-negative decimal strings")
    if sum(map(len, values)) > 2000000:
        raise ValueError("site limit: total digit count <= 2000000")
    return str(sum_digits_until_one(values))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def input_for(values: list[str]) -> str:
    return f"{len(values)}\n" + "\n".join(values) + "\n"


def brute_root(text: str) -> int:
    while len(text) > 1:
        text = str(sum(ord(ch) - ord("0") for ch in text))
    return int(text)


def oracle(values: list[str]) -> int:
    counts = Counter(brute_root(value) for value in values)
    max_freq = max(counts.values())
    return max(root for root, freq in counts.items() if freq == max_freq)


def run_reference(raw: str) -> str:
    proc = subprocess.run(["python3", "-I", "-c", REFERENCE], cwd=ROOT,
                          input=raw, text=True, capture_output=True,
                          timeout=10, check=True)
    return proc.stdout.strip()


def main() -> None:
    assert ITEM["contentHash"] == "d28e8340de136dc74da717ff7c4c7f21c5037daa642fd59803aa27e66ba621ca"
    evidence = json.loads((OA / "source-evidence/rubrik-capital-one-review-next.json").read_text())
    assert evidence["commit"] == COMMIT
    raw = subprocess.run(["git", "cat-file", "-p", SOURCE_BLOB], cwd=ROOT,
                         text=True, capture_output=True, check=True).stdout
    assert "repeatedly sum the digits until it becomes a single-digit number" in raw
    assert "return the mode of the resulting numbers" in raw
    assert "# 取频次最高，多个同频取最大" in raw
    assert evidence["items"]["oa-capital-one-14"]["rawGitBlob"] == SOURCE_BLOB
    assert len(raw.encode()) > 0
    assert __import__("hashlib").sha256(raw.encode()).hexdigest() == SOURCE_FILE_SHA

    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert (
        (state["status"] == "blocked" and state["reason"] == PREVIOUS_REASON)
        or (state["status"] in ("awaiting_sandbox", "sandbox_verified") and state.get("batch") == "capital-one-19-recovered")
    ), state
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            if path.name == "capital-one-19-recovered.json":
                continue
            manifest = json.loads(path.read_text())
            assert all(x["id"] != PID for x in manifest.get("items", [])), (folder, path)
    if state["status"] != "sandbox_verified":
        assert PID not in json.dumps(json.loads((OA / "registry.json").read_text()))

    public = [["1234", "24", "33"]]
    rng = random.Random(SEED)
    random_cases = []
    for _ in range(150):
        values = []
        for _ in range(rng.randint(1, 30)):
            number = rng.randint(0, 999999999)
            text = str(number)
            if rng.random() < 0.3:
                text = "0" * rng.randint(1, 4) + text
            values.append(text)
        random_cases.append(values)

    start = time.perf_counter()
    oracle_rows = []
    for values in public + random_cases:
        expected = oracle(values)
        actual = int(run_reference(input_for(values)))
        assert actual == expected, (values, actual, expected)
        oracle_rows.append({"input": input_for(values), "expectedOutput": f"{expected}\n"})

    exhaustive = 0
    domain = ["0", "1", "2", "8", "9", "10", "11", "18", "19", "99", "123", "009", "0018"]
    env: dict[str, object] = {}
    exec(compile(REFERENCE, "<capital-one-19-reference>", "exec"), env)
    for n in range(1, 5):
        for values in itertools.product(domain, repeat=n):
            expected = oracle(list(values))
            actual = env["sum_digits_until_one"](list(values))
            assert actual == expected, (values, actual, expected)
            exhaustive += 1

    formal = public + [
        ["0", "0", "0"],
        ["0000", "0009", "0018"],
        ["1", "9"],
        ["123456789"],
        ["9" * 100000],
        ["0" * 100000, "0000", "9"],
        ["1", "2", "3", "4"],
        # Additional hidden cases: every digital root, leading-zero equivalence,
        # and ties that distinguish the site's explicitly documented max-mode rule.
        ["0", "9", "18", "27", "36"],
        ["1", "10", "19", "28", "37"],
        ["2", "11", "20", "29", "38"],
        ["3", "12", "21", "30", "39"],
        ["4", "13", "22", "31", "40"],
        ["5", "14", "23", "32", "41"],
        ["6", "15", "24", "33", "42"],
        ["7", "16", "25", "34", "43"],
        ["8", "17", "26", "35", "44"],
        ["0001", "01", "00010", "0019"],
        ["000", "00", "0000", "0009"],
        ["9", "18", "1", "10"],
        ["8", "17", "7", "16"],
        ["12345678901234567890", "99999999999999999999", "00000000000000000000"],
    ]
    cases, formal_expected = [], []
    for i, values in enumerate(formal):
        expected = oracle(values)
        formal_expected.append(expected)
        cases.append({"name": "样例 1" if i == 0 else f"边界 {i}",
                      "input": input_for(values), "expectedOutput": f"{expected}\n",
                      "hidden": i > 0, "weight": 1})
    assert sum(case["hidden"] for case in cases) >= 20

    mutants = [
        {"name": "零值错误地映射到数根 9",
         "code": "import sys\nd=sys.stdin.read().split();n=int(d[0]);v=d[1:];r=[1+(sum(map(int,s))-1)%9 for s in v];from collections import Counter\nc=Counter(r);m=max(c.values());print(max(x for x,k in c.items() if k==m))\n"},
        {"name": "多个众数并列时返回较小数根",
         "code": "import sys\nd=sys.stdin.read().split();n=int(d[0]);v=d[1:];r=[(0 if sum(map(int,s))==0 else 1+(sum(map(int,s))-1)%9) for s in v];from collections import Counter\nc=Counter(r);m=max(c.values());print(min(x for x,k in c.items() if k==m))\n"},
    ]
    killed = []
    for mutant in mutants:
        rejected = []
        for i, values in enumerate(formal):
            proc = subprocess.run(["python3", "-I", "-c", mutant["code"]], cwd=ROOT,
                                  input=input_for(values), text=True,
                                  capture_output=True, timeout=10, check=True)
            if int(proc.stdout.strip()) != formal_expected[i]:
                rejected.append(i)
        assert rejected, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejected})

    editorial = """## 思路

对每个数字字符串反复求各位数字和，直到得到一位数。非负整数的数根可以在线性扫描中计算：所有数字和为 0 时结果为 0；否则结果为 1 + (数字和−1) mod 9。统计所有结果的频次，取出现次数最多的数根。

## 并列与输入约定

题干没有定义多个数根并列为 mode 时返回哪一个。随题固定源附带的解释/实现选择较大数根；本站将此作为明示规则。参数是数字字符串，固定解释把输入称为正整数；本站支持非负十进制数字串，允许前导零，并禁止负号或其他符号。输入输出和规模限制也均为本站补充。

## 为什么正确

对非零十进制数，数根只由其数字和模 9 决定，公式与反复求和等价；全零字符串的数根为 0。频次表统计每个输入数的最终单数字结果，取最大频次并列中的最大值，符合本站 mode 约定。时间为总位数 O(D)，额外空间 O(10)。"""

    package_raw = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "反复求和后的数根众数", "difficulty": "简单",
            "tags": ["OA", "Capital One", "数组", "字符串", "数根"],
            "description": "给定数字字符串列表。对每个值反复求各位数字和，直到剩下一位数；返回这些一位数中出现频次最高的 mode。并列时本站返回较大数根。",
            "input": "第一行 N（本站限制 1≤N≤200000），接下来 N 行各有一个非负十进制数字字符串。允许前导零，不允许符号；单串长度≤100000，总位数≤2000000。",
            "output": "输出 mode；若多个数根的频次同为最高，输出其中较大的数根。",
            "explanation": "扫描各位求和并对 9 取数根，统计频次；零单独映射为 0。",
            "hints": ["数根可由数字和模 9 计算。", "全零字符串的数根为 0。", "众数并列时按本站规则取较大值。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "tokens", "languages": ["python", "java", "cpp"],
        },
        "cases": cases,
    }
    schema_script = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    proc = subprocess.run(["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
                          input=json.dumps(package_raw, ensure_ascii=False), text=True,
                          capture_output=True, check=True)
    package = json.loads(proc.stdout)
    checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    editorial = editorial
    reason = "固定题干清楚定义对数字字符串逐位求和直至一位数后取 mode；随题附带的解释/实现选择并列众数中的最大值，本站将其明示为并列规则。本站补充非负数字串（允许前导零）、标准 I/O 和资源边界。独立反复求和 oracle、小域枚举、零/前导零/超长边界及两个 mutant 均通过，仍待沙箱。"

    put(OA / "packages" / f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE)
    put(OA / "oracles" / f"{PID}.json", oracle_rows)
    put(OA / "mutants" / f"{PID}.json", mutants)
    put(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": ITEM["sourceUrl"], "sourceContentHash": ITEM["contentHash"], "author": "CSWork",
    })
    put(OA / "candidate-batches/capital-one-19-recovered.json", {"schemaVersion": 1, "items": [{
        "id": PID, "sourceContentHash": ITEM["contentHash"], "packageChecksum": checksum,
        "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }]})
    put(OA / "source-evidence/capital-one-19-recovered.json", {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT, "origin": "https://oamaster.com",
        "items": {PID: {
            "url": ITEM["sourceUrl"], "contentHash": ITEM["contentHash"],
            "catalogContentHash": ITEM["contentHash"], "company": ITEM["companyName"],
            "title": ITEM["title"], "sourcePath": "web/content/docs/companies/capital-one.mdx",
            "gitBlobSha": SOURCE_BLOB, "sourceFileSha256": SOURCE_FILE_SHA,
            "fixedSourceEvidence": "The immutable MDX defines repeatedly summing decimal digits to one digit, then taking the mode. Its sample confirms 1234→1, 24→6, 33→6, answer 6. The accompanying explanation and solution choose the largest root on frequency ties; this convention is disclosed by this site package because the statement itself does not specify ties.",
            "siteAddedContract": "Non-negative decimal digit strings only; leading zeroes are allowed and have the same value under the source's numeric conversion. Negative signs are excluded because the source discusses positive integers and digit sums, not signed notation. Largest tied mode follows the supplied explanation/implementation but is explicitly labeled as a site rule. Standard stdin/stdout and finite limits are site additions.",
        }},
    })
    put(OA / "resolutions/capital-one-19-recovered.json", {
        "schemaVersion": 1, "items": [{"id": PID, "batch": "capital-one-19-recovered",
        "sourceContentHash": ITEM["contentHash"], "previousReason": PREVIOUS_REASON, "reason": reason}],
    })
    put(OA / "validation/capital-one-19-recovered.json", {
        "schemaVersion": 1, "seed": SEED, "problems": [{
            "id": PID, "oracleCases": len(oracle_rows), "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
            "referenceStdioCases": len(public) + len(random_cases), "publicCases": len(public),
            "hiddenCases": len(cases) - len(public), "exhaustiveLists": exhaustive,
            "negativeControls": killed, "maxN": 200000, "maxTokenLength": 100000,
            "maxTotalDigits": 2000000, "referenceSha256": sha(REFERENCE), "localValidationOnly": True,
        }],
    })
    print(json.dumps({"id": PID, "candidateBatch": "capital-one-19-recovered",
                      "statusBefore": state["status"], "oracleCases": len(oracle_rows),
                      "formalCases": len(cases), "exhaustiveLists": exhaustive,
                      "negativeControls": killed, "seconds": round(time.perf_counter()-start, 3)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
