from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
ITEM = next(x for x in CATALOG["items"] if x["id"] == "oa-geico-2")
PID = ITEM["id"]
BATCH = "geico-2-recovered"
SEED = 20261007
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "fastprep/Geico/geico-implement-lru-cache.md"
SOURCE_BLOB = "615beb2f27bd5a5b138417a8e8c17fa840bd3598"
SOURCE_HASH = "7d4f89ad7f86046a3ef9e64bd953b6b88bfc2b50c76e6e6ce880aa420cee9369"
PREVIOUS_REASON = "LRU 操作本身清楚，但快照中首个多步样例漏掉一个 get(1) 的 -1 输出，内嵌样例与后面的修订示例输出长度不一致；需要修正来源题面后再纳入。"


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = '''from collections import OrderedDict
import sys

def solve(raw):
    lines = raw.strip().splitlines()
    if not lines or not lines[0].startswith("capacity="):
        raise ValueError("expected capacity=N")
    capacity = int(lines[0].split("=", 1)[1])
    if capacity <= 0:
        raise ValueError("capacity must be positive")
    cache = OrderedDict()
    output = []
    for line in lines[1:]:
        line = line.strip()
        if line.startswith("put(") and line.endswith(")"):
            key, value = map(int, line[4:-1].split(","))
            cache[key] = value
            cache.move_to_end(key)
            if len(cache) > capacity:
                cache.popitem(last=False)
        elif line.startswith("get(") and line.endswith(")"):
            key = int(line[4:-1])
            if key not in cache:
                output.append("-1")
            else:
                cache.move_to_end(key)
                output.append(str(cache[key]))
        else:
            raise ValueError("invalid operation: " + line)
    return "\\n".join(output)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def input_for(capacity: int, operations: list[tuple]) -> str:
    lines = [f"capacity={capacity}"]
    lines.extend(
        f"put({op[1]},{op[2]})" if op[0] == "put" else f"get({op[1]})"
        for op in operations
    )
    return "\n".join(lines) + "\n"


def oracle(capacity: int, operations: list[tuple]) -> str:
    # Independent list model: index 0 is least recently used.
    entries: list[tuple[int, int]] = []
    output = []
    for op in operations:
        if op[0] == "get":
            key = op[1]
            found = next((i for i, pair in enumerate(entries) if pair[0] == key), None)
            if found is None:
                output.append("-1")
            else:
                key, value = entries.pop(found)
                entries.append((key, value))
                output.append(str(value))
        else:
            _, key, value = op
            found = next((i for i, pair in enumerate(entries) if pair[0] == key), None)
            if found is not None:
                entries.pop(found)
            entries.append((key, value))
            if len(entries) > capacity:
                entries.pop(0)
    return "\n".join(output)


def execute(code: str, raw: str) -> str:
    result = subprocess.run(
        [sys.executable, "-c", code], input=raw, text=True,
        capture_output=True, check=True, timeout=5,
    )
    return result.stdout.rstrip("\n")


def main() -> None:
    assert ITEM["contentHash"] == SOURCE_HASH
    blob = subprocess.run(
        ["git", "rev-parse", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    assert blob == SOURCE_BLOB
    source = subprocess.run(
        ["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    assert "get(1)</p><p class='mt-3'>put(3,3)" in source
    assert "<p class='mt-3'>-1</p><p class='mt-3'>3</p>" in source
    assert '["1", "-1", "-1", "3", "4"]' in ITEM["statement"]

    coverage = json.loads((OA / "coverage.json").read_text())
    status = next(x for x in coverage["items"] if x["id"] == PID)
    assert status["status"] in {"blocked", "awaiting_sandbox", "sandbox_verified"}, status
    if status["status"] == "sandbox_verified":
        assert status["batch"] == BATCH, status
    review = json.loads((OA / "reviews/extra-30-review.json").read_text())
    prior = next(x for x in review["items"] if x["id"] == PID)
    assert prior["reason"] == PREVIOUS_REASON

    sample1 = [
        ("put", 1, 1), ("put", 2, 2), ("get", 1), ("put", 3, 3),
        ("get", 2), ("put", 4, 4), ("get", 1), ("get", 3), ("get", 4),
    ]
    public = [
        (2, sample1, "1\n-1\n-1\n3\n4"),
        (1, [("put", 1, 1), ("put", 2, 2), ("get", 1), ("get", 2)], "-1\n2"),
        (2, [("put", 1, 1), ("put", 1, 10), ("get", 1)], "10"),
        (3, [("get", 42)], "-1"),
        (2, [("put", 1, 1), ("put", 2, 2), ("put", 3, 3),
             ("get", 1), ("get", 2), ("get", 3)], "-1\n2\n3"),
    ]
    assert oracle(2, sample1) == public[0][2]
    rng = random.Random(SEED)
    oracle_cases: dict[str, str] = {}
    while len(oracle_cases) < 120:
        cap = rng.randint(1, 8)
        operations = []
        for _ in range(rng.randint(1, 24)):
            if rng.random() < 0.54:
                operations.append(("put", rng.randint(-8, 8), rng.randint(-100, 100)))
            else:
                operations.append(("get", rng.randint(-8, 8)))
        raw = input_for(cap, operations)
        oracle_cases[raw] = oracle(cap, operations)
    for cap, operations, expected in public:
        raw = input_for(cap, operations)
        assert oracle(cap, operations) == expected
        assert execute(REFERENCE, raw) == expected

    cases = []
    for i, (cap, operations, expected) in enumerate(public):
        cases.append({
            "name": f"样例 {i + 1}", "input": input_for(cap, operations),
            "expectedOutput": expected + "\n", "hidden": False, "weight": 1,
        })
    formal_ops = [
        (2, [("put", 1, 1), ("put", 2, 2), ("get", 1), ("put", 3, 3), ("get", 1), ("get", 2)]),
        (2, [("put", 1, 1), ("put", 2, 2), ("put", 1, 10), ("put", 3, 3), ("get", 1), ("get", 2)]),
        (3, [("put", 1, 5), ("put", 2, 5), ("put", 3, 5), ("get", 2), ("put", 4, 5), ("get", 1)]),
    ]
    rng2 = random.Random(SEED + 1)
    while len(formal_ops) < 20:
        cap = rng2.randint(1, 12)
        ops = []
        for _ in range(rng2.randint(30, 160)):
            if rng2.random() < 0.57:
                ops.append(("put", rng2.randint(-20, 20), rng2.randint(-(2**31), 2**31 - 1)))
            else:
                ops.append(("get", rng2.randint(-20, 20)))
        formal_ops.append((cap, ops))
    for i, (cap, operations) in enumerate(formal_ops):
        raw = input_for(cap, operations)
        expected = oracle(cap, operations)
        assert execute(REFERENCE, raw) == expected
        cases.append({
            "name": f"隐藏 LRU 场景 {i + 1}", "input": raw,
            "expectedOutput": expected + "\n", "hidden": True, "weight": 1,
        })
    assert len(cases) == 25 and sum(x["hidden"] for x in cases) == 20
    oracle_rows = [
        {"input": raw, "expectedOutput": result + "\n"}
        for raw, result in oracle_cases.items()
    ]
    assert len(oracle_rows) == 120
    for row in oracle_rows:
        assert execute(REFERENCE, row["input"]) + "\n" == row["expectedOutput"]

    mutants = [
        {
            "name": "get 不刷新最近使用顺序",
            "code": '''from collections import OrderedDict
import sys
def solve(raw):
 lines=raw.strip().splitlines(); c=int(lines[0].split("=")[1]); d=OrderedDict(); out=[]
 for s in lines[1:]:
  if s.startswith("put("):
   k,v=map(int,s[4:-1].split(",")); d[k]=v; d.move_to_end(k)
   if len(d)>c:d.popitem(last=False)
  else:
   k=int(s[4:-1]); out.append(str(d.get(k,-1)))
 return "\\n".join(out)
print(solve(sys.stdin.read()))
''',
        },
        {
            "name": "已有键更新后不刷新最近使用顺序",
            "code": '''from collections import OrderedDict
import sys
def solve(raw):
 lines=raw.strip().splitlines(); c=int(lines[0].split("=")[1]); d=OrderedDict(); out=[]
 for s in lines[1:]:
  if s.startswith("put("):
   k,v=map(int,s[4:-1].split(",")); existed=k in d; d[k]=v
   if not existed:d.move_to_end(k)
   if len(d)>c:d.popitem(last=False)
  else:
   k=int(s[4:-1])
   if k not in d:out.append("-1")
   else:d.move_to_end(k); out.append(str(d[k]))
 return "\\n".join(out)
print(solve(sys.stdin.read()))
''',
        },
    ]
    killed = []
    negative_control_evidence = []
    mutant_texts = []
    all_test_inputs = [(x["input"], x["expectedOutput"].rstrip("\n")) for x in cases]
    all_test_inputs.extend((x["input"], x["expectedOutput"].rstrip("\n")) for x in oracle_rows)
    for mutant in mutants:
        mutant_texts.append({"name": mutant["name"], "code": mutant["code"]})
        rejected = [
            index + 1
            for index, (raw, expected) in enumerate(all_test_inputs)
            if execute(mutant["code"], raw) != expected
        ]
        assert rejected
        killed.append(mutant["name"])
        negative_control_evidence.append({
            "name": mutant["name"], "rejectedByCases": rejected,
        })

    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": ITEM["title"], "difficulty": "中等",
        "tags": ["OA", "Geico", "LRU", "缓存"],
        "description": ITEM["statement"].replace(
            "**Output:**\n1\n-1\n3\n4",
            "**Output:**\n1\n-1\n-1\n3\n4",
            1,
        ) + "\n\n**来源勘误：** 首个多步样例漏列了 `get(1)` 在 `put(4,4)` 后返回的 `-1`。后附的重复 Example 1 已列出五个结果；按同一 LRU 规则重放也得到 `1, -1, -1, 3, 4`。",
        "input": "第一行 capacity=N（正整数），后续每行一个 `put(key,value)` 或 `get(key)` 操作。",
        "output": "每次 get 输出一行；put 不输出。",
        "explanation": "维护从最久未使用到最近使用的顺序。命中 get 和任何 put（包括更新已有键）都会将该键移至最近端；超容量时删除最久未使用键。题面首个样例漏写一个 -1，题面重复的 Example 1 输出及逐步状态均确认更正值。",
        "hints": ["查询命中也会改变后续淘汰对象。", "更新已存在键也算一次最近使用。", "哈希表配合有序双向链表可实现每次操作 O(1)。"],
        "timeLimit": 2, "memoryLimit": 65536, "outputLimit": 65536,
        "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    package = {"schemaVersion": 1, "problem": problem, "cases": cases}
    package_checksum = digest(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode())
    editorial = "## 为什么正确\n\n`get` 命中会把键标为最近使用，`put` 插入或更新也会刷新最近使用顺序；超容量时删除最久未使用的键。来源首个多步样例的输出漏了一个 `get(1)` 结果：在 `put(4,4)` 后键 1 已被淘汰，故该查询输出 `-1`。来源后面重复的 Example 1 明确给出五项输出，逐步模拟也得到 `1, -1, -1, 3, 4`。只修正该输出，不更改操作语义。\n\n## 算法\n\n哈希表保存键到值，`OrderedDict` 保存从最久未使用到最近使用的顺序。命中或 put 后移动到末尾；超容量时弹出首项。每次操作期望 O(1)，空间 O(capacity)。"
    evidence = {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT,
        "sourceFile": {"path": SOURCE_PATH, "gitBlob": SOURCE_BLOB},
        "catalogContentHash": SOURCE_HASH,
        "sampleCorrection": {
            "firstOutputSource": ["1", "-1", "3", "4"],
            "firstOutputCorrected": ["1", "-1", "-1", "3", "4"],
            "basis": "The same fixed source repeats Example 1 later with the five-line output; replaying the stated LRU operations also yields five get results.",
        },
        "siteProtocol": "capacity=N followed by one put(key,value) or get(key) per line; emit one line per get.",
    }
    resolution = {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": SOURCE_HASH,
            "previousReason": PREVIOUS_REASON,
            "reason": "The fixed source repeats the same operation sequence in Example 1 and gives five outputs there; direct LRU replay also gives 1,-1,-1,3,4. Only the earlier duplicate sample output omitted the third get result. Correct that sample line without changing semantics.",
        }],
    }
    validation = {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
            "referenceStdioCases": len(oracle_rows),
            "publicCases": len(public), "hiddenCases": len(cases) - len(public),
            "negativeControls": negative_control_evidence,
            "sampleOracle": {"source": ["1", "-1", "3", "4"], "independent": ["1", "-1", "-1", "3", "4"]},
            "localValidationOnly": True,
        }],
    }
    for folder, name, data in [
        ("packages", PID + ".json", package),
        ("references", PID + ".py", REFERENCE),
        ("oracles", PID + ".json", oracle_rows),
        ("mutants", PID + ".json", mutant_texts),
        ("editorials", PID + ".json", {
            "schemaVersion": 1, "id": PID, "title": ITEM["title"],
            "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
            "sourceUrl": ITEM["sourceUrl"], "sourceContentHash": SOURCE_HASH, "author": "CSWork",
        }),
        ("source-evidence", BATCH + ".json", evidence),
        ("resolutions", BATCH + ".json", resolution),
        ("validation", BATCH + ".json", validation),
    ]:
        path = OA / folder / name
        if isinstance(data, str):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(data, encoding="utf-8")
        else:
            put(path, data)
    for i, mutant in enumerate(mutants, 1):
        path = OA / "negative-controls" / f"{PID}-{i}.py"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(mutant["code"], encoding="utf-8")
    put(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{"id": PID, "sourceContentHash": SOURCE_HASH,
                   "packageChecksum": package_checksum, "editorial": editorial,
                   "authoredSolutions": [{"language": "python", "code": REFERENCE}]}],
    })
    print(json.dumps({"id": PID, "oracleCases": len(oracle_rows),
                      "formalCases": len(cases), "mutantsKilled": len(killed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
