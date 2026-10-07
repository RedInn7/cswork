#!/usr/bin/env python3
"""Generate an isolated offline candidate for Goldman Sachs #27 only."""

from __future__ import annotations

import hashlib
import heapq
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
REVIEW = ROOT / "content" / "oa-judge" / "reviews" / "goldman-sachs-remaining.json"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/goldman-sachs.mdx"
RAW_BLOB = "8efc97a5920a15a0815088ee41e197524a0517ca"
RAW_SHA256 = "14ea24f08c2a8fdfb8176adf6107d1ac025a14c49b7463c4f44c0efff63318b7"
FULL_RAW_PATH = "fastprep/Goldman Sachs/max-min.md"
FULL_RAW_BLOB = "58929dbd6a6b2b12dfd0ace05a9838b4e6b06c48"
FULL_RAW_SHA256 = "675e71ec431bf0ddfda396bdcc5c2e82774610fdf150a20d665f013bd1bf4ad3"
CONTENT_HASH = "3083bfb4749cf0427402d9df7458552226dac21ce447d68b6548c9a43a21b4ae"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw: dict) -> str:
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT,
                          input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout


REFERENCE = r'''import heapq
import sys

def solve(raw):
    tokens = raw.split()
    if not tokens:
        raise ValueError("missing operation count")
    n = int(tokens[0])
    if len(tokens) != 1 + 2 * n:
        raise ValueError("operation count does not match input")
    minimum_heap = []
    maximum_heap = []
    frequency = {}
    products = []
    pos = 1
    for _ in range(n):
        operation = tokens[pos].decode("ascii")
        value = int(tokens[pos + 1])
        pos += 2
        if operation == "push":
            frequency[value] = frequency.get(value, 0) + 1
            heapq.heappush(minimum_heap, value)
            heapq.heappush(maximum_heap, -value)
        else:
            count = frequency[value]
            if count == 1:
                del frequency[value]
            else:
                frequency[value] = count - 1
        while minimum_heap and frequency.get(minimum_heap[0], 0) == 0:
            heapq.heappop(minimum_heap)
        while maximum_heap and frequency.get(-maximum_heap[0], 0) == 0:
            heapq.heappop(maximum_heap)
        if frequency:
            products.append(minimum_heap[0] * -maximum_heap[0])
        else:
            products.append(0)
    return "\n".join(map(str, products))

if __name__ == "__main__":
    import sys
    result = solve(sys.stdin.buffer.read())
    if result:
        print(result)
'''


def encode(operations: list[tuple[str, int]]) -> str:
    return str(len(operations)) + "\n" + "\n".join(f"{op} {value}" for op, value in operations) + "\n"


def run(code: str, raw: str, timeout: int = 15) -> str:
    with tempfile.TemporaryDirectory(prefix="goldman27-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=timeout, check=True)
        return proc.stdout.decode("ascii").strip()


def oracle(operations: list[tuple[str, int]]) -> str:
    values: list[int] = []
    products = []
    for operation, value in operations:
        if operation == "push":
            values.append(value)
        else:
            values.remove(value)
        products.append(str(min(values) * max(values)) if values else "0")
    return "\n".join(products)


def order_statistic_oracle(operations):
    """Independent compressed Fenwick multiset, with no heaps or lazy deletion."""
    keys = sorted({value for _, value in operations})
    positions = {value: index + 1 for index, value in enumerate(keys)}
    tree = [0] * (len(keys) + 1)
    counts = [0] * len(keys)
    total = 0
    products = []

    def kth(rank):
        index = 0
        step = 1 << (len(keys).bit_length() - 1)
        while step:
            other = index + step
            if other < len(tree) and tree[other] < rank:
                rank -= tree[other]
                index = other
            step >>= 1
        return keys[index]

    for operation, value in operations:
        assert operation in ("push", "pop") and 1 <= value <= 10**9
        delta = 1 if operation == "push" else -1
        index = positions[value]
        counts[index - 1] += delta
        assert counts[index - 1] >= 0
        total += delta
        while index < len(tree):
            tree[index] += delta
            index += index & -index
        products.append(str(kth(1) * kth(total)) if total else "0")
    return "\n".join(products)


def full_boundaries():
    size = 100000
    yield ([("push", 10**9)] * size,
           "\n".join([str(10**18)] * size), "10万操作与最大乘积输出")
    half = size // 2
    operations = [("push", x) for x in range(1, half + 1)]
    operations += [("pop", x) for x in range(1, half + 1)]
    expected = list(range(1, half + 1))
    expected += [half * (x + 1) if x < half else 0 for x in range(1, half + 1)]
    yield operations, "\n".join(map(str, expected)), "10万不同值与逐个清理最小堆"
    operations = [("push", x) for x in range(1, half + 1)]
    operations += [("pop", x) for x in range(half, 0, -1)]
    expected = list(range(1, half + 1)) + list(range(half - 1, -1, -1))
    yield operations, "\n".join(map(str, expected)), "10万不同值与逐个清理最大堆"
    yield ([("push", 10**9), ("push", 10**9), ("pop", 10**9), ("pop", 10**9)] * (size // 4),
           "\n".join([str(10**18), str(10**18), str(10**18), "0"] * (size // 4)),
           "10万重复值清空并重新插入")


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-goldman-sachs-27", "goldman-sachs-27-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    formal = [
        ([('push', 1), ('push', 2), ('push', 3), ('pop', 1)], "来源样例"),
        ([('push', 5), ('pop', 5)], "删除至空集"),
        ([('push', 4), ('push', 4), ('pop', 4)], "重复元素删除一个副本"),
        ([('push', 4), ('push', 4), ('pop', 4), ('pop', 4)], "重复元素最终清空"),
        ([('push', 10**9), ('push', 10**9)], "最大元素乘积使用 64 位结果"),
        ([('push', 9), ('push', 2), ('push', 5), ('pop', 2), ('push', 1)], "最值变化"),
        ([('push', 8), ('push', 3), ('push', 5), ('pop', 8)], "删除最大值后刷新最大堆"),
        ([('push', 8), ('push', 3), ('push', 5), ('pop', 3)], "删除最小值后刷新最小堆"),
        ([('push', 7), ('push', 7), ('push', 2), ('pop', 7), ('push', 4)], "重复最大值保留一个副本"),
        ([('push', 7), ('push', 2), ('push', 2), ('pop', 2), ('push', 4)], "重复最小值保留一个副本"),
        ([('push', 1), ('push', 100), ('pop', 1), ('push', 2), ('pop', 100)], "交替删除两端"),
        ([('push', 3), ('pop', 3), ('push', 9), ('pop', 9), ('push', 5)], "多次从空集合重新开始"),
        ([('push', 1), ('push', 2), ('push', 3), ('pop', 2), ('pop', 1), ('pop', 3)], "逐步删除直至空集"),
        ([('push', 10**9), ('push', 1), ('pop', 1)], "最大值与最小值相乘"),
        ([('push', 1), ('push', 10**9), ('push', 10**9), ('pop', 10**9)], "大值重复删除一个副本"),
        ([('push', 6), ('push', 6), ('push', 6), ('pop', 6), ('pop', 6)], "三份重复值留下单份"),
        ([('push', 2), ('push', 9), ('push', 4), ('pop', 9), ('push', 8), ('pop', 2)], "删除端点后插入新极值"),
        ([('push', 11), ('push', 5), ('push', 11), ('push', 5), ('pop', 11), ('pop', 5)], "两端各有重复值"),
        ([('push', 1), ('push', 2), ('push', 3), ('push', 4), ('pop', 4), ('pop', 3), ('push', 9)], "堆顶连续惰性清理"),
        ([('push', 4), ('push', 1), ('push', 9), ('pop', 1), ('pop', 9), ('push', 3), ('push', 7)], "连续变更后重建两端"),
        ([('push', 13), ('push', 13), ('pop', 13), ('push', 13), ('pop', 13), ('pop', 13)], "同值重复插入删除再清空"),
    ]
    cases = []
    for i, (operations, name) in enumerate(formal):
        raw = encode(operations)
        expected = oracle(operations)
        assert order_statistic_oracle(operations) == expected
        assert run(REFERENCE, raw) == expected
        cases.append({"name": name, "input": raw, "expectedOutput": expected + "\n",
                      "hidden": i != 0, "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    while len(random_cases) < 120:
        operations: list[tuple[str, int]] = []
        values: list[int] = []
        for _ in range(rng.randint(1, 40)):
            if not values or rng.random() < 0.58:
                value = rng.randint(1, 30)
                values.append(value)
                operations.append(("push", value))
            else:
                value = rng.choice(values)
                values.remove(value)
                operations.append(("pop", value))
        raw = encode(operations)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(operations)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        ("pop 时错误删除该值的全部副本", REFERENCE.replace(
            "count = frequency[value]", "count = frequency.get(value, 0)").replace(
            "            if count == 1:\n                del frequency[value]\n            else:\n                frequency[value] = count - 1",
            "            frequency.pop(value, None)")),
        ("空集合时错误沿用前一状态的乘积", REFERENCE.replace(
            "        else:\n            products.append(0)",
            "        else:\n            products.append(products[-1] if products else 0)")),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for i, (operations, _) in enumerate(formal):
            if run(code, encode(operations)) != oracle(operations):
                rejected.append(i)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    # Full-range cases are imported formal cases, not local-only stress.
    boundary_evidence = []
    for operations, closed_form, name in full_boundaries():
        assert len(operations) == 100000
        independent = order_statistic_oracle(operations)
        assert independent == closed_form, name
        raw = encode(operations)
        assert run(REFERENCE, raw) == independent, name
        expected = independent + "\n"
        assert len(expected.encode()) <= 8192 * 1024
        cases.append({"name": name, "input": raw, "expectedOutput": expected,
                      "hidden": True, "weight": 1})
        boundary_evidence.append({"name": name, "n": len(operations),
            "inputBytes": len(raw.encode()), "outputBytes": len(expected.encode()),
            "independentMethod": "Fenwick order statistics plus closed-form structured expectations"})
    max_n = 100000
    max_output_bytes = max(row["outputBytes"] for row in boundary_evidence)

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Product of the Maximum and Minimum in a Dataset", "difficulty": "中等",
        "tags": ["OA", "Goldman Sachs", "数据结构", "堆", "multiset"],
        "description": "从空 multiset 开始依次处理操作：`push x` 插入一个 x；`pop x` 删除一个当前存在的 x 的单个副本。每次操作后输出当前集合最小值与最大值的乘积；若集合为空，按固定源中 Python、Java、C++ 三份实现一致输出 0。",
        "input": "第一行输入操作数 n，随后 n 行每行输入 `push x` 或 `pop x`。完整原约束：1≤n≤100000，1≤x≤10^9；每个 pop 执行时当前 multiset 中至少有一个 x。保留固定完整 raw 的范围；标准输入输出为本站包装。",
        "output": "每行输出对应操作后的乘积；multiset 为空时输出 0。乘积按 64 位整数计算。",
        "explanation": "重复值按 multiset 处理，pop 只移除一个副本；这些行为与固定源中的三种语言参考实现一致。",
        "hints": ["使用最小堆、最大堆和频次表；删除元素时用频次表延迟清理堆顶。"],
        "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 8192,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n维护元素频次、最小堆和最大堆。push 时频次加一，并分别将 x、−x 入堆；pop 时只将频次减一。读取答案前，反复移除频次已为 0 的堆顶。两个堆顶分别给出当前最小值和最大值，乘积即答案；集合为空时按源代码约定输出 0。\n\n"
        "## 正确性\n\n频次表精确记录 multiset 中每个值的副本数。延迟删除时，堆中频次为 0 的元素不属于当前集合，清理后最小堆/最大堆的有效堆顶分别是当前最小值/最大值；乘积正确。若频次表为空，三份源实现均返回 0，候选沿用该规则。\n\n"
        "## 复杂度\n\n每次操作至多向两堆各插入一次，并且每个堆元素最多弹出一次，时间 O(n log n)，空间 O(n)。完整支持原始 n≤100000、x≤10^9；乘积最大10^18，64位有符号整数足够。最多100000行、每行19位数字加换行，共2000000字节，低于本题8192 KiB输出限额。独立验证采用直接列表oracle及压缩Fenwick顺序统计oracle，完整规模再与闭式期望交叉核对。"
    )
    write_json(OA / "packages" / f"{identifier}.json", package)
    (OA / "references" / f"{identifier}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", random_cases)
    write_json(OA / "mutants" / f"{identifier}.json", [{"name": name, "code": code} for name, code in mutants])
    write_json(OA / "editorials" / f"{identifier}.json", {"schemaVersion": 1, "id": identifier,
        "title": problem["title"], "explanation": editorial,
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"})
    write_json(OA / "candidate-batches" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
        "editorial": editorial, "authoredSolutions": [{"language": "python", "code": reference}],
    }]})
    write_json(OA / "source-evidence" / f"{batch}.json", {"schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master", "commit": COMMIT, "origin": "https://oamaster.com",
        "items": [{"id": identifier, "sourceUrl": source["sourceUrl"], "catalogContentHash": source["contentHash"],
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [2683, 2788]},
                {"path": FULL_RAW_PATH, "blob": FULL_RAW_BLOB, "sha256": FULL_RAW_SHA256}],
            "resolvedSemantics": {"multiset": "Push inserts one occurrence; pop removes one occurrence. All three fixed-source language implementations use multiset-like structures.",
                "emptyResult": "Return 0 after an operation leaves the collection empty; explicit in all three fixed-source reference implementations.",
                "siteInputSupplement": "The original n<=100000 and x<=1e9 are preserved. Only standard I/O is a site supplement; outputLimit is 8192 KiB, enough for the 2000000-byte full-range output."}}]})
    review_items = json.loads(REVIEW.read_text(encoding="utf-8"))["items"]
    review_reason = next(item["reason"] for item in review_items if item["id"] == identifier)
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": review_reason,
        "reason": "固定快照中的 Python、Java、C++ 参考实现均明确规定操作后空集合的结果为 0；三者也均使用保留重复次数的数据结构，并在 pop 时只删除一个副本。题意其余部分和 64 位乘积约束明确。现恢复完整原始 n≤100000、x≤10^9；四个10万操作正式用例使用独立Fenwick oracle与闭式期望验证，另保留120个直接列表oracle及两个正常退出负控。变更后须重跑真实GoJudge，旧报告不得复用。"}]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(random_cases), "negativeControls": controls,
            "maxN": max_n, "maxOutputBytes": max_output_bytes,
            "fullBoundaryFormalCases": boundary_evidence}],
        "note": "本地独立list/Fenwick oracle与四个十万操作正式边界通过；两个正常退出mutant被拒；本次未连接GoJudge，须刷新报告。"})
    print(f"{identifier}: formal={len(cases)}, unique oracle={len(random_cases)}, mutants={len(controls)} killed, n stress={max_n}")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    actual_blob = subprocess.check_output(["git", "rev-parse", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT, text=True).strip()
    raw_source = subprocess.check_output(["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT)
    assert actual_blob == RAW_BLOB
    assert hashlib.sha256(raw_source).hexdigest() == RAW_SHA256
    full_source = subprocess.check_output(["git", "show", f"{COMMIT}:{FULL_RAW_PATH}"], cwd=ROOT)
    assert hashlib.sha256(full_source).hexdigest() == FULL_RAW_SHA256
    full_blob = subprocess.check_output(["git", "hash-object", "--stdin"], input=full_source, cwd=ROOT).decode().strip()
    assert full_blob == FULL_RAW_BLOB
    rng = random.Random(20261006)
    build(catalog, rng)


if __name__ == "__main__":
    main()
