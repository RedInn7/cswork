from __future__ import annotations

import hashlib
import json
import random
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
ITEM = next(x for x in CATALOG["items"] if x["id"] == "oa-databricks-26")
PID = ITEM["id"]
SEED = 20261006
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "fastprep/Databricks/dd-count-pairs.md"
RAW_BLOB = "55d7a4beb0f1c67ac8cd8a60b1dd4399a8eac703"
MDX_PATH = "web/content/docs/companies/databricks.mdx"
MDX_BLOB = "7fd09106d12e021e873ef086e882682d8dbdda76"
PREVIOUS_REASON = "规则说最多交换两位数字，但整理页解法按数字重排后分组；对四位以上数字该解法不等价，且前导零处理没有定义，暂缓。"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = '''def count_pairs(values):
    seen = {}
    answer = 0
    for value in values:
        digits = list(str(value))
        reachable = {value}
        for i in range(len(digits)):
            for j in range(i + 1, len(digits)):
                digits[i], digits[j] = digits[j], digits[i]
                reachable.add(int("".join(digits)))
                digits[i], digits[j] = digits[j], digits[i]
        answer += sum(seen.get(candidate, 0) for candidate in reachable)
        seen[value] = seen.get(value, 0) + 1
    return answer

def solve(raw):
    data = list(map(int, raw.split()))
    if not data or len(data) != data[0] + 1:
        raise ValueError("expected n followed by n integers")
    return str(count_pairs(data[1:]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def input_for(values: list[int]) -> str:
    return f"{len(values)}\n" + " ".join(map(str, values)) + "\n"


def pair_oracle(source: int, target: int) -> bool:
    if source == target:
        return True
    s, t = str(source), str(target)
    if len(s) > len(t):
        return False
    s = s.zfill(len(t))
    diff = [i for i, (a, b) in enumerate(zip(s, t)) if a != b]
    return (len(diff) == 2 and s[diff[0]] == t[diff[1]]
            and s[diff[1]] == t[diff[0]])


def oracle(values: list[int]) -> int:
    return sum(pair_oracle(values[i], values[j])
               for i in range(len(values)) for j in range(i + 1, len(values)))


def run_code(code: str, raw: str) -> str:
    proc = subprocess.run(["python3", "-I", "-c", code], cwd=ROOT,
                          input=raw, text=True, capture_output=True,
                          timeout=10, check=True)
    return proc.stdout.rstrip("\n")


def main() -> None:
    assert ITEM["contentHash"] == "faad6b1d946901e5ace3a65139c20104c60784283d8321104eed47c2b0680d3a"
    raw = subprocess.run(["git", "cat-file", "-p", RAW_BLOB], cwd=ROOT,
                         capture_output=True, check=True).stdout
    mdx = subprocess.run(["git", "cat-file", "-p", MDX_BLOB], cwd=ROOT,
                         capture_output=True, check=True).stdout
    assert b"swapping no more than" in raw and b"fruits[x] = fruits[y]" in raw
    assert b"Count Distinct Pairs" in mdx
    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] in {"blocked", "awaiting_sandbox"}, state
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            manifest = json.loads(path.read_text())
            if folder == "candidate-batches" and path.name == "databricks-26-recovered.json":
                continue
            assert all(x["id"] != PID for x in manifest.get("items", [])), (folder, path)
    assert PID not in json.dumps(json.loads((OA / "registry.json").read_text()))
    reviews = json.loads((OA / "reviews/databricks-remaining-next.json").read_text())
    prior = next(x for x in reviews["items"] if x["id"] == PID)
    assert prior["status"] == "blocked" and prior["reason"] == PREVIOUS_REASON
    evidence = json.loads((OA / "source-evidence/databricks-remaining-next.json").read_text())
    source_record = next(x for x in evidence["items"] if x["id"] == PID)
    assert source_record["sourceFiles"][0] == {"path": RAW_PATH, "gitBlobSha": RAW_BLOB}
    assert source_record["sourceFiles"][1]["gitBlobSha"] == MDX_BLOB
    assert source_record["catalogContentHash"] == ITEM["contentHash"]

    public = [
        [1, 23, 156, 1650, 651, 165, 32],
        [123, 321, 123],
        [1, 1000, 10, 100],
    ]
    rng = random.Random(SEED)
    random_values = [[rng.randint(1, 99999) for _ in range(rng.randint(1, 35))]
                     for _ in range(160)]
    start = time.perf_counter()
    oracle_rows = []
    for values in public + random_values:
        expected = oracle(values)
        assert int(run_code(REFERENCE, input_for(values))) == expected
        oracle_rows.append({"input": input_for(values), "expectedOutput": f"{expected}\n"})

    exhaustive_pairs = 0
    for values in (list(range(1, 121)), list(range(120, 0, -1))):
        expected = oracle(values)
        assert int(run_code(REFERENCE, input_for(values))) == expected
        exhaustive_pairs += len(values) * (len(values) - 1) // 2

    formal = public + [
        [7], [77, 77, 77], [12345, 32154, 12354], [1, 10, 100, 1000],
        [1000000000, 1, 1000000000], [rng.randint(1, 10**9) for _ in range(1000)],
        [111111111] * 10000,
    ] + [[rng.randint(1, 10**9) for _ in range(rng.randint(1, 60))]
         for _ in range(22)]
    cases, expected_formal = [], []
    for i, values in enumerate(formal):
        expected = oracle(values) if len(values) <= 1000 else len(values) * (len(values) - 1) // 2
        assert int(run_code(REFERENCE, input_for(values))) == expected
        expected_formal.append(expected)
        cases.append({
            "name": f"样例 {i + 1}" if i < len(public) else f"边界 {i - len(public) + 1}",
            "input": input_for(values), "expectedOutput": f"{expected}\n",
            "hidden": i >= len(public), "weight": 1,
        })

    mutants = [
        {"name": "把排序数字相同误当成一次交换可达",
         "code": "import sys\nfrom collections import Counter\nn,*a=map(int,sys.stdin.read().split())\nc=Counter(''.join(sorted(str(x))) for x in a)\nprint(sum(v*(v-1)//2 for v in c.values()))\n"},
        {"name": "忽略交换后前导零按整数解释的情况",
         "code": "import sys\nfrom collections import Counter\nn,*a=map(int,sys.stdin.read().split());seen=Counter();ans=0\nfor x in a:\n s=list(str(x));r={x}\n for i in range(len(s)):\n  for j in range(i+1,len(s)):\n   s[i],s[j]=s[j],s[i];t=''.join(s)\n   if t[0]!='0':r.add(int(t))\n   s[i],s[j]=s[j],s[i]\n ans+=sum(seen[y] for y in r);seen[x]+=1\nprint(ans)\n"},
        {"name": "遗漏无需交换的相等整数对",
         "code": "import sys\nfrom collections import Counter\nn,*a=map(int,sys.stdin.read().split());seen=Counter();ans=0\nfor x in a:\n s=list(str(x));r=set()\n for i in range(len(s)):\n  for j in range(i+1,len(s)):\n   s[i],s[j]=s[j],s[i];r.add(int(''.join(s)));s[i],s[j]=s[j],s[i]\n ans+=sum(seen[y] for y in r);seen[x]+=1\nprint(ans)\n"},
    ]
    killed = []
    for mutant in mutants:
        rejects = [i for i, values in enumerate(formal)
                   if int(run_code(mutant["code"], input_for(values))) != expected_formal[i]]
        assert rejects, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejects})

    editorial = """## 思路

从左到右枚举较大下标对应的数 `y`。把 `y` 的十进制数字零次或交换任意一对位置，得到所有可达整数。查询此前每个可达整数出现的次数，并累加；再把 `y` 加入频次表。可达集合需要去重，避免重复数字产生同一个目标值时重复计数。

交换后按整数比较；若数字串以零开头，按普通十进制整数读法忽略前导零。例如 `1000` 首尾交换后为 `0001`，对应整数 `1`。

## 正确性

固定右端下标 `j`。源题只允许对 `fruits[j]` 零次或一次交换，因此枚举的位置对恰好生成所有合法目标整数。频次表只含 `i<j` 的元素，所以累加候选频次正好统计所有有效左端下标；集合去重确保每个下标对只计一次。遍历每个 `j` 即得到全部答案。

## 复杂度

最多 10 位，每个数检查至多 45 个位置对。时间 `O(N·D²)`，空间 `O(N+D²)`，其中 `D≤10`。

## 来源与本站约定

固定 FastPrep 原文明确要求 `i<j`、至多交换两个数字，并明确不交换也算。原始实现按排序后的数字分组，会把需要多次交换的排列误计；本题按题面独立实现。来源只给函数签名，本站补标准输入输出；结果按整数比较，因此前导零不保留。"""

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "一次数字交换可达的下标对数", "difficulty": "中等",
            "tags": ["OA", "Databricks", "数组", "字符串"],
            "description": "给定正整数数组。对每个下标对 i<j，若把 fruits[j] 的十进制表示中零次或一次交换两个位置的数字后，所得整数等于 fruits[i]，则该下标对有效。统计有效下标对数量。零次交换允许，因此相等值也算。交换后的数字串按普通十进制整数解释，前导零不保留。",
            "input": "第一行整数 n（1≤n≤10000）；第二行 n 个正整数 fruits[i]（1≤fruits[i]≤10^9）。",
            "output": "输出有效下标对数量。",
            "explanation": "按右端值枚举零次或一次交换可达的整数，并查询此前值的出现次数。不要把所有数字相同的数都视作可互相到达；一次交换只能改变两个位置。",
            "hints": ["按右端下标从左向右扫描。", "十位数最多检查45个位置对。", "重复数字可能生成同一目标，先去重。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    schema_script = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    proc = subprocess.run(["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
                          input=json.dumps(raw_package, ensure_ascii=False), text=True,
                          capture_output=True, check=True)
    package = json.loads(proc.stdout)
    checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    manifest_item = {"id": PID, "sourceContentHash": ITEM["contentHash"],
                     "packageChecksum": checksum, "editorial": editorial,
                     "authoredSolutions": [{"language": "python", "code": REFERENCE}]}
    put_json(OA / "packages" / f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE)
    put_json(OA / "oracles" / f"{PID}.json", oracle_rows)
    put_json(OA / "mutants" / f"{PID}.json", mutants)
    put_json(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": ITEM["sourceUrl"], "sourceContentHash": ITEM["contentHash"], "author": "CSWork",
    })
    put_json(OA / "candidate-batches" / "databricks-26-recovered.json",
             {"schemaVersion": 1, "items": [manifest_item]})
    put_json(OA / "source-evidence" / "databricks-26-recovered.json", {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": UPSTREAM_COMMIT, "origin": "https://oamaster.com",
        "items": {PID: {
            "url": ITEM["sourceUrl"], "contentHash": ITEM["contentHash"],
            "catalogContentHash": ITEM["contentHash"], "company": ITEM["companyName"],
            "title": ITEM["title"], "sourceFiles": [
                {"path": RAW_PATH, "gitBlobSha": RAW_BLOB},
                {"path": MDX_PATH, "gitBlobSha": MDX_BLOB}],
            "fixedBlobVerification": "Fixed raw FastPrep and MDX blobs were read from the repository object database and matched the recorded SHA-1s. The raw statement contains the pair direction, one-swap rule, no-op clause, constraints, and both examples.",
            "semanticInterpretation": "The inputs and outputs are integers. After swapping digit positions, the resulting digit string is interpreted as an ordinary base-10 integer; leading zeroes are therefore insignificant.",
        }},
    })
    reason = "固定 FastPrep 原文明确要求 i<j、至多交换两个数字位置且允许不交换；原解按数字排序分组不符合规则。本站补标准 I/O 协议，按整数语义比较交换结果；独立 oracle、差分、边界和错误程序均通过，仍待真实沙箱。"
    put_json(OA / "resolutions" / "databricks-26-recovered.json", {
        "schemaVersion": 1, "items": [{"id": PID, "batch": "databricks-26-recovered",
        "sourceContentHash": ITEM["contentHash"], "previousReason": prior["reason"], "reason": reason}],
    })

    stdio_count = 0
    for values in public + random_values + formal:
        expected = oracle(values) if len(values) <= 1000 else len(values) * (len(values) - 1) // 2
        assert int(run_code(REFERENCE, input_for(values))) == expected
        stdio_count += 1
    put_json(OA / "validation" / "databricks-26-recovered.json", {
        "schemaVersion": 1, "seed": SEED, "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({r["input"] for r in oracle_rows}),
            "referenceStdioCases": stdio_count, "publicCases": len(public),
            "hiddenCases": len(cases) - len(public),
            "exhaustiveDifferentialPairs": exhaustive_pairs,
            "negativeControls": killed, "maxArrayLength": 10000, "maxDigits": 10,
            "referenceSha256": sha(REFERENCE), "localValidationOnly": True,
        }],
    })
    print(json.dumps({"id": PID, "candidateBatch": "databricks-26-recovered",
                      "statusBefore": state["status"], "oracleCases": len(oracle_rows),
                      "formalCases": len(cases), "exhaustiveDifferentialPairs": exhaustive_pairs,
                      "negativeControls": killed, "totalSeconds": round(time.perf_counter()-start, 3)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
