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
ITEM = next(x for x in CATALOG["items"] if x["id"] == "oa-sig-4")
PID = ITEM["id"]
SEED = 20261006
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
PREVIOUS_REASON = "串接对的“different ways”虽说明按位置计数，但正整数是否允许前导零、accessCode 的表示形式及输入范围未规定；不能自行规定数值/字符串比较语义。"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = '''def count_ways(fragments, access_code):
    target = str(access_code)
    answer = 0
    counts = {}
    for fragment in fragments:
        text = str(fragment)
        counts[text] = counts.get(text, 0) + 1
    for cut in range(1, len(target)):
        left, right = target[:cut], target[cut:]
        left_count = counts.get(left, 0)
        right_count = counts.get(right, 0)
        answer += left_count * right_count
        if left == right:
            answer -= left_count
    return answer

def solve(raw):
    data = list(map(int, raw.split()))
    if len(data) < 2 or len(data) != data[0] + 2:
        raise ValueError("expected n, accessCode, then n fragments")
    n, access_code = data[:2]
    return str(count_ways(data[2:], access_code))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def input_for(fragments: list[int], access_code: int) -> str:
    return f"{len(fragments)} {access_code}\n" + " ".join(map(str, fragments)) + "\n"


def brute_force(fragments: list[int], access_code: int) -> int:
    target = str(access_code)
    return sum(
        1
        for i, first in enumerate(fragments)
        for j, second in enumerate(fragments)
        if i != j and str(first) + str(second) == target
    )


def run_code(code: str, raw: str) -> str:
    proc = subprocess.run(["python3", "-I", "-c", code], cwd=ROOT,
                          input=raw, text=True, capture_output=True,
                          timeout=10, check=True)
    return proc.stdout.rstrip("\n")


_ENV: dict[str, object] = {}
exec(compile(REFERENCE, "<sig-4-reference>", "exec"), _ENV)


def run_reference(fragments: list[int], access_code: int) -> int:
    return int(_ENV["count_ways"](fragments, access_code))


def main() -> None:
    assert ITEM["contentHash"] == "d4d72e31741ca5be7bea26b3bc070b9d17b56f0a31a39edcd972757b88f3c554"
    review = json.loads((OA / "reviews/trading-firms-remaining.json").read_text())
    prior = next(x for x in review["items"] if x["id"] == PID)
    assert prior["status"] == "blocked" and prior["reason"] == PREVIOUS_REASON
    evidence = json.loads((OA / "source-evidence/trading-firms-remaining.json").read_text())
    source = evidence["items"][PID]
    assert source["contentHash"] == ITEM["contentHash"]
    assert source["url"] == ITEM["sourceUrl"]
    assert evidence["upstreamCommit"] == UPSTREAM_COMMIT

    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] in {"blocked", "awaiting_sandbox"}, state
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            manifest = json.loads(path.read_text())
            if folder == "candidate-batches" and path.name == "sig-4-recovered.json":
                continue
            assert all(x["id"] != PID for x in manifest.get("items", [])), (folder, path)
    registry = json.loads((OA / "registry.json").read_text())
    assert PID not in json.dumps(registry)

    public = [
        ([1, 212, 12, 12], 1212),
        ([2, 12, 1, 21], 121),
        ([212, 1], 1212),
    ]
    rng = random.Random(SEED)
    random_inputs: list[tuple[list[int], int]] = []
    for _ in range(160):
        fragments = [rng.randint(1, 999) for _ in range(rng.randint(1, 18))]
        if rng.random() < 0.65 and len(fragments) >= 2:
            i, j = rng.sample(range(len(fragments)), 2)
            access_code = int(f"{fragments[i]}{fragments[j]}")
        else:
            access_code = rng.randint(1, 10**6)
        random_inputs.append((fragments, access_code))

    start = time.perf_counter()
    oracle_rows = []
    for fragments, access_code in public + random_inputs:
        expected = brute_force(fragments, access_code)
        assert int(run_code(REFERENCE, input_for(fragments, access_code))) == expected
        oracle_rows.append({"input": input_for(fragments, access_code),
                            "expectedOutput": f"{expected}\n"})

    exhaustive = 0
    alphabet = [1, 2, 12, 21]
    for n in range(1, 7):
        # All arrays over a tiny alphabet, tested against every target formed by
        # concatenating two alphabet values. Oracle examines ordered positions.
        count = len(alphabet) ** n
        for code in range(count):
            q, fragments = code, []
            for _ in range(n):
                fragments.append(alphabet[q % len(alphabet)])
                q //= len(alphabet)
            targets = {int(f"{a}{b}") for a in alphabet for b in alphabet}
            for access_code in targets:
                expected = brute_force(fragments, access_code)
                assert run_reference(fragments, access_code) == expected
                exhaustive += n * (n - 1)

    formal = public + [
        ([1], 11),
        ([12, 12], 1212),
        ([21, 1], 121),
        ([1, 21, 12], 121),
        ([7, 7, 7], 77),
        ([10, 1, 10], 1010),
        ([10**9, 10**9], 10**18),
        ([1] * 100000, 11),
    ] + [
        ([rng.randint(1, 999999) for _ in range(rng.randint(1, 30))],
         rng.randint(1, 10**12))
        for _ in range(22)
    ]
    cases, expected_formal = [], []
    for i, (fragments, access_code) in enumerate(formal):
        expected = (brute_force(fragments, access_code) if len(fragments) <= 1000
                    else len(fragments) * (len(fragments) - 1))
        assert int(run_code(REFERENCE, input_for(fragments, access_code))) == expected
        expected_formal.append(expected)
        cases.append({
            "name": f"样例 {i + 1}" if i < len(public) else f"边界 {i - len(public) + 1}",
            "input": input_for(fragments, access_code),
            "expectedOutput": f"{expected}\n",
            "hidden": i >= len(public), "weight": 1,
        })

    mutants = [
        {"name": "相同片段只按无序位置对计一次",
         "code": "import sys\nn,t,*a=map(int,sys.stdin.read().split());s=list(map(str,a));z=str(t);ans=0\nfor i,x in enumerate(s):\n for j,y in enumerate(s):\n  if i<j and x+y==z:ans+=1\nprint(ans)\n"},
        {"name": "只按输入顺序拼接，忽略片段可以任意排序",
         "code": "import sys\nn,t,*a=map(int,sys.stdin.read().split());s=list(map(str,a));z=str(t);print(sum(s[i]+s[j]==z for i in range(n) for j in range(i+1,n)))\n"},
    ]
    killed = []
    for mutant in mutants:
        rejects = [i for i, (fragments, access_code) in enumerate(formal)
                   if len(fragments) <= 1000
                   if int(run_code(mutant["code"], input_for(fragments, access_code))) != expected_formal[i]]
        assert rejects, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejects})

    editorial = """## 思路

把目标 accessCode 写成规范十进制字符串。每种拼接方式都对应一个非空切分 `target = left + right`。统计数组中各整数的出现次数，累加 `count(left) × count(right)`。当左右片段相等时，同一位置不能同时使用两次，因此从乘积中减去 `count(left)`。

该计数是按有序角色分配位置：例如两个数值相同的 `12` 片段能拼成 `1212`，互换这两个位置仍是另一种使用方式。若两个不同片段都能以相反顺序组成目标，各自的切分会分别计入。

## 正确性证明

任意有效方式由一个第一片段和一个不同位置的第二片段组成，二者的十进制串连接后恰好等于目标，因此对应目标串唯一的一个非空切分。该切分在数组中有 `count(left)×count(right)` 个有序位置选择；若左右文本相同，其中每个位置都不能与自身配对，需减去 `count(left)` 个非法选择。反过来，任一计入的有序位置对，其两片段文本恰好拼出目标且位置不同，所以都是合法方式。因此算法恰好统计全部合法拼接对。

## 复杂度

目标最多 18 位，最多检查 17 个切分。时间 `O(N + D)`，空间 `O(U + D)`，其中 `U` 是不同片段数，`D` 是目标位数。

## 来源及本站约定

固定题面称 fragments/accessCode 为正整数、明确是相邻拼接而非数值相加，并按具体位置的片段对计不同方式。原样例 `[1,212,12,12]`、目标 `1212` 的输出 3 可由 `1+212` 的一个有序方式与两个不同位置的 `12+12` 方式复算。输入仅为函数签名，本站补充标准 I/O 与限制：`1≤N≤100000`，`1≤fragment≤10^9`，`1≤accessCode≤10^18`。整数用规范十进制表示，不含前导零。"""

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "拼接片段形成访问码的有序位置对数", "difficulty": "中等",
            "tags": ["OA", "SIG", "字符串", "哈希表"],
            "description": "给定正整数片段和正整数 accessCode。两个不同位置的片段可以任意选择先后，并把十进制表示直接连接（不是相加）。统计所有有序位置对，使连接结果等于 accessCode。每个片段位置只能使用一次；交换两个相同数值片段的位置也算不同方式。",
            "input": "第一行输入 N 和 accessCode（1≤N≤100000，1≤accessCode≤10^18）。第二行输入 N 个正整数片段，每个不超过10^9。整数按规范十进制表示，不含前导零。",
            "output": "输出可形成 accessCode 的有序位置对数量。",
            "explanation": "枚举 accessCode 的所有非空切分。每一切分分别查询左右片段的出现次数；两侧相同时，要减去同一位置被重复使用的情况。",
            "hints": ["拼接数对应目标字符串的一处切分。", "按位置计数意味着相同值的不同位置彼此可区分。", "左右片段相同的切分要排除自己和自己配对。"],
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
    put_json(OA / "candidate-batches" / "sig-4-recovered.json",
             {"schemaVersion": 1, "items": [manifest_item]})
    put_json(OA / "source-evidence" / "sig-4-recovered.json", {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": UPSTREAM_COMMIT, "origin": "https://oamaster.com",
        "items": {PID: {
            "url": ITEM["sourceUrl"], "contentHash": ITEM["contentHash"],
            "catalogContentHash": ITEM["contentHash"], "company": ITEM["companyName"],
            "title": ITEM["title"],
            "fixedSourceEvidence": "The immutable catalog snapshot at content/oa-master/catalog.json matches the sourceContentHash. It states integer fragments/accessCode, direct concatenation, position-distinct pairs, and includes the sample whose output 3 confirms ordered position assignments for two equal fragments.",
            "interpretation": "Positive integer inputs use canonical decimal representation. This follows the integer type in the fixed source; input limits and stdin/stdout are explicitly site-added.",
        }},
    })
    reason = "固定题面定义正整数片段直接拼接、按具体位置对计数，原样例输出 3 明确验证重复 12 位置的两个有序组合；正整数采用规范十进制表示。本站仅补标准 I/O 和规模上限；暴力 oracle、穷举和边界验证通过，仍待真实沙箱。"
    put_json(OA / "resolutions" / "sig-4-recovered.json", {
        "schemaVersion": 1, "items": [{"id": PID, "batch": "sig-4-recovered",
        "sourceContentHash": ITEM["contentHash"], "previousReason": prior["reason"], "reason": reason}],
    })

    stdio_count = 0
    for fragments, access_code in public + random_inputs + [x for x in formal if len(x[0]) <= 1000]:
        expected = brute_force(fragments, access_code)
        assert int(run_code(REFERENCE, input_for(fragments, access_code))) == expected
        stdio_count += 1
    large_expected = 100000 * 99999
    assert int(run_code(REFERENCE, input_for([1] * 100000, 11))) == large_expected
    stdio_count += 1
    put_json(OA / "validation" / "sig-4-recovered.json", {
        "schemaVersion": 1, "seed": SEED, "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({r["input"] for r in oracle_rows}),
            "referenceStdioCases": stdio_count, "publicCases": len(public),
            "hiddenCases": len(cases) - len(public),
            "exhaustiveDifferentialIndexPairs": exhaustive,
            "negativeControls": killed, "maxArrayLength": 100000,
            "maxFragment": 10**9, "maxAccessCode": 10**18,
            "referenceSha256": sha(REFERENCE), "localValidationOnly": True,
        }],
    })
    print(json.dumps({"id": PID, "candidateBatch": "sig-4-recovered",
                      "statusBefore": state["status"], "oracleCases": len(oracle_rows),
                      "formalCases": len(cases), "exhaustiveDifferentialIndexPairs": exhaustive,
                      "negativeControls": killed, "totalSeconds": round(time.perf_counter()-start, 3)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
