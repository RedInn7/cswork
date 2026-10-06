"""Recover ZipRecruiter #6 from the fixed source; correct its erroneous sample count."""
from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
BATCH = "ziprecruiter-6-recovered"
PID = "oa-ziprecruiter-6"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "fastprep/ZipRecruiter/ziprecruiter-cycle-shift.md"
SOURCE_BLOB = "09f3e2c1916314ba1a924bfa42dfcbd042253a0b"
SOURCE_HASH = "e3aaaa7b35f2dd54da5dd226eb0ec49a484eded066a5257d6b108783bd6a32b4"
PREVIOUS_REASON = "Cycle Shift 题面规则与样例冲突：按轮转等价及解释列出的匹配对计数为 5，原输出为 3。"
SEED = 20261006

REFERENCE = r'''from collections import Counter
import sys

def canonical(value):
    text = str(value)
    return min(text[i:] + text[:i] for i in range(len(text)))

def count_pairs(values):
    counts = Counter(canonical(value) for value in values)
    return sum(count * (count - 1) // 2 for count in counts.values())

def solve(raw):
    tokens = list(map(int, raw.split()))
    if not tokens:
        raise ValueError("missing n")
    n, values = tokens[0], tokens[1:]
    if not 1 <= n <= 100 or len(values) != n:
        raise ValueError("site protocol: 1 <= n <= 100 and n values")
    if any(not 1 <= value <= 10000 for value in values):
        raise ValueError("source constraint: 1 <= a[i] <= 10000")
    return str(count_pairs(values))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def input_text(values: list[int]) -> str:
    return f"{len(values)}\n" + " ".join(map(str, values)) + "\n"


def oracle(values: list[int]) -> str:
    """Independent pairwise definition, deliberately not canonical grouping."""
    total = 0
    for i, left in enumerate(values):
        a = str(left)
        for right in values[i + 1 :]:
            b = str(right)
            if len(a) != len(b):
                continue
            if any(a[k:] + a[:k] == b for k in range(len(a))):
                total += 1
    return str(total)


def execute(code: str, raw: str) -> str:
    completed = subprocess.run(
        [sys.executable, "-c", code], input=raw, text=True,
        capture_output=True, check=True, timeout=3,
    )
    return completed.stdout.strip()


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(x for x in catalog["items"] if x["id"] == PID)
    assert item["contentHash"] == SOURCE_HASH
    assert item["sourceUrl"].endswith("#6-cycle-shift")
    assert "one can become the other by performing a cyclic shift" in item["statement"]
    assert "five pairs" in item["statement"] and "**Output:**\n```\n3\n```" in item["statement"]
    source = subprocess.run(
        ["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    blob = subprocess.run(
        ["git", "rev-parse", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    assert blob == SOURCE_BLOB
    assert "five pairs" in source and "Output" in source

    # The explanation itself names five matching pairs. An independent direct
    # rotation check confirms 3 + 1 + 1 pairs, so the printed sample answer is a typo.
    sample = [13, 5604, 31, 2, 13, 4560, 546, 654, 456]
    assert oracle(sample) == "5"

    public = [
        (sample, "5"),
        ([11, 11, 11, 11], "6"),
        ([123, 231, 312, 132], "3"),
    ]
    hidden = [
        [12, 21], [123, 132], [100, 10, 1000], [100, 1, 10000],
        [1234, 2341, 3412, 4123, 1234], [7], [9999, 9999],
        [120, 201, 12, 1200], [1001, 1100, 110, 1010],
        [1234, 2341, 3412, 4123, 1234],
    ]
    rng = random.Random(SEED)
    rotations = [1234, 2341, 3412, 4123]
    for _ in range(10):
        size = rng.randint(1, 25)
        values = []
        for _ in range(size):
            if rng.random() < 0.6:
                values.append(rng.choice(rotations))
            else:
                values.append(rng.randint(1, 10000))
        hidden.append(values)
    assert len(hidden) == 20

    formal_cases = []
    expected_formal = []
    for i, (values, expected) in enumerate(public + [(x, oracle(x)) for x in hidden]):
        assert oracle(values) == expected
        raw = input_text(values)
        actual = execute(REFERENCE, raw)
        assert actual == expected, (i, values, actual, expected)
        expected_formal.append(expected)
        formal_cases.append({
            "name": f"样例 {i + 1}" if i < len(public) else f"隐藏边界 {i - len(public) + 1}",
            "input": raw,
            "expectedOutput": expected + "\n",
            "hidden": i >= len(public),
            "weight": 1,
        })

    mutants = [
        {
            "name": "把循环移位等价误写成数字字符排序",
            "code": """import sys
from collections import Counter
a=list(map(int,sys.stdin.read().split()))[1:]
c=Counter(''.join(sorted(str(x))) for x in a)
print(sum(v*(v-1)//2 for v in c.values()))
""",
        },
        {
            "name": "只接受固定方向的一次右移而漏掉其它循环移位",
            "code": """import sys
a=list(map(int,sys.stdin.read().split()))[1:]
ans=0
for i,x in enumerate(a):
 s=str(x)
 for y in a[i+1:]:
  t=str(y)
  if len(s)==len(t) and (s==t or s[1:]+s[:1]==t): ans+=1
print(ans)
""",
        },
    ]
    negative_controls = []
    for mutant in mutants:
        rejected = [
            i for i, case in enumerate(formal_cases)
            if execute(mutant["code"], case["input"]) != expected_formal[i]
        ]
        assert rejected, mutant["name"]
        negative_controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    oracle_rows = []
    seen = set()
    for index in range(160):
        size = 1 + (index * 37 % 100)
        values = [rng.randint(1, 10000) for _ in range(size)]
        if index % 4 == 0:
            base = rng.randint(1000, 9999)
            text = str(base)
            values[: min(size, 4)] = [int(text[k:] + text[:k]) for k in range(min(size, 4))]
        raw = input_text(values)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(values)
        actual = execute(REFERENCE, raw)
        assert actual == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})
    assert len(oracle_rows) >= 120

    editorial = """## 为什么正确

两个正整数只有位数相同时才可能组成题目所说的 cyclic pair。固定一个数，把它的十进制串从每个下标切开并交换前后两段，就得到它全部循环移位；取其中字典序最小的串作为等价类标识。两个数能互相循环移位，当且仅当标识相同。因此每个等价类里有 c 个输入位置时，贡献恰好是 C(c,2)，重复输入也按不同下标计数。

## 样例勘误

固定来源的规则、约束和解释把样例中的五个匹配对都明确列出，但样例输出误写为 3。直接逐对枚举得到：`13/31/13` 贡献 3 对，`5604/4560` 贡献 1 对，`546/654` 贡献 1 对，总计 5。题意与输入保持原样，只将公开样例答案更正为 5。

## 复杂度与本站输入格式

设 n 为数组长度、L 为最大位数。参考解用循环移位构造等价类，时间 O(nL²)，空间 O(nL)。本站标准输入为 n 和 n 个正整数；采用源约束 `1≤n≤100`、`1≤a[i]≤10000`，仅把原文误写的 `years.length/years[i]` 绑定到正文中的数组 `a`。"""

    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "循环移位等价数对计数（ZipRecruiter OA）",
        "difficulty": "简单", "tags": ["OA", "ZipRecruiter", "字符串", "哈希表"],
        "description": "给定正整数数组，统计下标 i<j 的数对：两数十进制位数相同，且其中一个可通过任意次循环移位（可移 0 位）变成另一个。重复值按不同下标分别计数。固定来源样例答案从 3 更正为 5；勘误依据见讲义。",
        "input": "第一行 n（本站范围 1≤n≤100），第二行 n 个正整数 a[i]（来源范围 1≤a[i]≤10000）。",
        "output": "输出满足条件的下标对数量。",
        "explanation": "按十进制字符串全部循环移位的最小值分组，每组贡献 C(频次,2)。公开样例输出依源解释中列出的五个匹配对更正为 5。",
        "hints": ["循环移位只保留字符顺序，不是任意排列。", "相同数值出现在两个下标时仍是一个合法数对。", "先按位数分层或在等价类中保留位数。"],
        "timeLimit": 2, "memoryLimit": 65536, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    package = {"schemaVersion": 1, "problem": problem, "cases": formal_cases}
    checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode())
    entry = {
        "id": PID, "sourceContentHash": SOURCE_HASH, "packageChecksum": checksum,
        "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }
    source_evidence = {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT,
        "sourceFile": {"path": SOURCE_PATH, "gitBlob": SOURCE_BLOB},
        "catalogContentHash": SOURCE_HASH,
        "sampleCorrection": {
            "sourceOutput": 3, "correctedOutput": 5,
            "basis": "The statement explanation says five pairs; exhaustive pairwise cyclic-shift checking gives 3+1+1=5.",
        },
        "siteProtocol": "n followed by n positive integers, n<=100, values<=10000 as stated in source (variable years corrected to body variable a).",
    }
    resolution = {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": SOURCE_HASH,
            "previousReason": PREVIOUS_REASON,
            "reason": "The fixed statement defines pair semantics, the source explanation explicitly says five pairs, and pairwise enumeration confirms the only error is the printed sample value 3. The candidate preserves the rule and corrects only that answer to 5; constraints are mapped from the obvious variable typo years to the body variable a and disclosed.",
        }],
    }
    validation = {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
            "referenceStdioCases": len(oracle_rows),
            "publicCases": len(public), "hiddenCases": len(hidden),
            "negativeControls": negative_controls,
            "sampleOracle": {"sourceOutput": 3, "independentOutput": 5},
            "localValidationOnly": True,
        }],
    }

    for folder, name, value in [
        ("packages", PID + ".json", package),
        ("references", PID + ".py", REFERENCE),
        ("oracles", PID + ".json", oracle_rows),
        ("mutants", PID + ".json", mutants),
        ("editorials", PID + ".json", {
            "schemaVersion": 1, "id": PID, "title": problem["title"],
            "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
            "sourceUrl": item["sourceUrl"], "sourceContentHash": SOURCE_HASH, "author": "CSWork",
        }),
        ("source-evidence", BATCH + ".json", source_evidence),
        ("resolutions", BATCH + ".json", resolution),
        ("validation", BATCH + ".json", validation),
    ]:
        path = OA / folder / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(value, str):
            path.write_text(value, encoding="utf-8")
        else:
            put(path, value)
    (OA / "negative-controls").mkdir(exist_ok=True)
    for index, mutant in enumerate(mutants, 1):
        (OA / "negative-controls" / f"{PID}-{index}.py").write_text(mutant["code"], encoding="utf-8")
    put(OA / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [entry]})
    print(json.dumps({
        "id": PID, "status": "candidate", "oracleCases": len(oracle_rows),
        "formalCases": len(formal_cases), "sampleCorrectedFrom": 3,
        "sampleCorrectedTo": 5, "mutantsKilled": len(negative_controls),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
