#!/usr/bin/env python3
"""Generate isolated offline candidates for Confluent #3 and #4 only."""

from __future__ import annotations

import hashlib
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
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/confluent.mdx"
RAW_BLOB = "50e645cfcc72ad720a081c7618eec450a0a8d1d6"
RAW_SHA256 = "ceca87f4fb034bf477334354e50da934d3732911b07cbef84a142782eb9d166a"


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw):
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


SUBSET_REF = r'''def solve(raw):
    tokens = list(map(int, raw.split()))
    if not tokens:
        return "0"
    n, target = tokens[0], tokens[1]
    values = tokens[2:2+n]
    mid = n // 2
    left_values, right_values = values[:mid], values[mid:]
    left_sums = [0]
    for x in left_values:
        size = len(left_sums)
        left_sums.extend(left_sums[i] + x for i in range(size))
    reachable = set(left_sums)
    total = 0
    previous_gray = 0
    for mask in range(1 << len(right_values)):
        gray = mask ^ (mask >> 1)
        if mask:
            changed = gray ^ previous_gray
            bit = changed.bit_length() - 1
            total += right_values[bit] if gray & changed else -right_values[bit]
        if target - total in reachable:
            return "1"
        previous_gray = gray
    return "0"

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.buffer.read()))
'''


TAIL_REF = r'''def decode(data):
    pos = 0
    def line():
        nonlocal pos
        end = data.find(b"\n", pos)
        if end < 0:
            raise ValueError("missing header newline")
        value = data[pos:end]
        pos = end + 1
        return value
    count, keep = map(int, line().split())
    values = []
    for _ in range(count):
        length = int(line())
        if length < 0 or pos + length >= len(data) or data[pos + length:pos + length + 1] != b"\n":
            raise ValueError("invalid length-prefixed string")
        values.append(data[pos:pos + length])
        pos += length + 1
    if pos != len(data):
        raise ValueError("trailing bytes")
    return keep, values

def encode(values):
    out = [str(len(values)).encode() + b"\n"]
    for value in values:
        out.extend((str(len(value)).encode() + b"\n", value, b"\n"))
    return b"".join(out)

def solve(data):
    keep, values = decode(data)
    if keep < 0:
        raise ValueError("n must be nonnegative")
    return encode(values[-keep:] if keep else [])

if __name__ == "__main__":
    import sys
    sys.stdout.buffer.write(solve(sys.stdin.buffer.read()))
'''


def run(code: str, raw: bytes | str) -> bytes:
    with tempfile.TemporaryDirectory(prefix="confluent34-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        if isinstance(raw, str):
            proc = subprocess.run([sys.executable, "-I", str(source)], input=raw,
                                  text=True, capture_output=True, timeout=15, check=True)
            return proc.stdout.encode("utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw,
                              capture_output=True, timeout=15, check=True)
        return proc.stdout


def brute_subset(values, target):
    reachable = {0}
    for value in values:
        reachable |= {s + value for s in tuple(reachable)}
    return "1" if target in reachable else "0"


def subset_input(values, target):
    return f"{len(values)} {target}\n" + " ".join(map(str, values)) + "\n"


def vector_input(values, keep):
    chunks = [f"{len(values)} {keep}\n".encode()]
    for value in values:
        raw = value.encode("utf-8")
        assert b"\n" not in raw
        chunks.extend((str(len(raw)).encode() + b"\n", raw, b"\n"))
    return b"".join(chunks)


def vector_output(values):
    chunks = [f"{len(values)}\n".encode()]
    for value in values:
        raw = value.encode("utf-8")
        chunks.extend((str(len(raw)).encode() + b"\n", raw, b"\n"))
    return b"".join(chunks)


def source_item(catalog, identifier):
    return next(item for item in catalog["items"] if item["id"] == identifier)


def build_subset(catalog, rng):
    identifier, batch = "oa-confluent-3", "confluent-3-recovered"
    source = source_item(catalog, identifier)
    assert source["contentHash"] == "490ade68cb8e572c0625b26403cda94e00a3dd20918722fecbef26a8bf6513d3"
    formal_values = [
        ([1, 2, 3], 5), ([1, 2], 4), ([], 0), ([], 1),
        ([-5, 4, 9], -1), ([8, -3, -5], 0), ([7, 7, 7], 14),
        ([10**9, -10**9, 4, -4], 0), ([1, 2, 4, 8, 16], 31),
        ([3] * 40, 61),
        ([10**9 if i % 2 == 0 else -(10**9) for i in range(40)], 10**9),
        ([5, -5], 0),
        ([4, 7, -3, -8], 0),
        ([2, 4, 8, 16, 32], 62),
        ([-1, -2, -4, -8, -16], -31),
        ([9, -9, 9, -9, 3], 3),
        ([6, 10, 14, 18], 24),
        ([1, 2, 4, 8, 16, 32], 63),
        ([7, 11, 13, 17, 19], 1),
        ([-10, 3, 7, 20], 30),
        ([0, 0, 0, 0, 0], 0),
        ([10**9, -10**9, 10**9, -10**9, 5], 5),
    ]
    cases = []
    for i, (values, target) in enumerate(formal_values):
        cases.append({"name": f"样例与边界 {i+1}", "input": subset_input(values, target),
                      "expectedOutput": brute_subset(values, target) + "\n", "hidden": i >= 2, "weight": 1})
    assert sum(case["hidden"] for case in cases) >= 20
    oracle = []
    seen = set()
    while len(oracle) < 120:
        values = [rng.randint(-30, 30) for _ in range(rng.randint(0, 16))]
        target = rng.randint(-100, 100)
        raw = subset_input(values, target)
        if raw in seen:
            continue
        seen.add(raw)
        expected = brute_subset(values, target)
        assert run(SUBSET_REF, raw).decode().strip() == expected
        oracle.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        ("忽略负数交易", SUBSET_REF.replace("left_values, right_values = values[:mid], values[mid:]",
                                             "values = [x for x in values if x >= 0]\n    n = len(values)\n    mid = n // 2\n    left_values, right_values = values[:mid], values[mid:]")),
        ("不允许空子集", SUBSET_REF.replace("if target - total in reachable:",
                                             "if mask == 0 and n == 0:\n            pass\n        elif target - total in reachable:")),
    ]
    mutant_results = []
    for name, code in mutants:
        rejected = [i for i, (vals, target) in enumerate(formal_values)
                    if run(code, subset_input(vals, target)).decode().strip() != brute_subset(vals, target)]
        assert rejected, f"surviving subset mutant: {name}"
        mutant_results.append({"name": name, "rejectedByCases": rejected})

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "交易子集能否达到目标余额", "difficulty": "中等",
        "tags": ["OA", "Confluent", "子集和", "Meet in the Middle"],
        "description": "给定一组有正有负的整数交易额，判断是否存在任意子集（可为空）的和恰好等于目标值；存在输出 1，否则输出 0。",
        "input": "第一行输入整数 n 和 target，随后一行输入 n 个整数（n=0 时该行可为空）。本站约束：0≤n≤40，|target|≤10^12，|transaction[i]|≤10^9。每笔交易最多选择一次。",
        "output": "输出单个整数：存在符合条件的子集输出 1，否则输出 0。空子集的和为 0。",
        "explanation": "按子集和定义判断；为支持大绝对值交易额，本站将缺失的规模补为 n≤40，可采用 meet-in-the-middle。",
        "hints": ["把交易拆成两半，枚举一半的子集和；另一半逐个枚举并查找 target−sum。用 Gray code 可在常数时间更新相邻枚举的和。"],
        "timeLimit": 4, "memoryLimit": 262144, "outputLimit": 1024,
        "checker": "exact", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(SUBSET_REF).strip() + "\n"
    editorial = (
        "## 思路\n\n将数组从中间分成两半，枚举左半所有子集和并放入集合。右半用 Gray code 顺序枚举；每次只翻转一个元素，因此可 O(1) 更新当前和。对每个右半和 `s`，检查 `target-s` 是否存在于左半集合。空子集自然对应和 0。\n\n"
        "## 正确性\n\n任意子集唯一拆成左半子集与右半子集。若其总和为 target，则右半和为 s 时左半和必为 target−s，查找会命中；反之若集合中存在该差值，将对应的两半子集合并即得和为 target 的原数组子集。\n\n"
        "## 复杂度\n\n时间 O(2^(n/2))，空间 O(2^(n/2))；本站 n≤40。"
    )
    write_json(OA / "packages" / f"{identifier}.json", package)
    (OA / "references" / f"{identifier}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", oracle)
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
        "items": [{"id": identifier, "sourceUrl": source["sourceUrl"],
            "catalogContentHash": source["contentHash"],
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [259, 340]}],
            "resolvedSemantics": {"subset": "Each transaction may be selected at most once; an empty subset is allowed.",
                "result": "1 if a subset sums exactly to target, else 0.",
                "siteInputSupplement": "The source provides no n/value bounds or standard I/O format. This candidate sets n<=40, |value|<=1e9, |target|<=1e12 and a line-based integer protocol; these are disclosed OJ limits, not upstream constraints."}}]})
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": "缺少 n 和交易额范围，题面将指数枚举与 DP 作为讨论题；无法设定可信的在线评测界限。",
        "reason": "原文的判定语义与输出 1/0 明确；仅缺平台输入协议和约束。明确补充 n≤40、交易/target范围后用 meet-in-the-middle 得到可靠复杂度；120 个小规模独立穷举 oracle、11 个正式边界用例及两个错误实现验证通过。本站增加的输入约束已披露。"}]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases),
            "hiddenFormalCases": sum(case["hidden"] for case in cases), "oracleCases": len(oracle),
            "oracleInputsUnique": len(seen), "negativeControls": mutant_results}],
        "note": "本地差分与边界验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, oracle={len(oracle)}, mutants={len(mutant_results)} killed")


def tail_reference_output(raw):
    with tempfile.TemporaryDirectory(prefix="tail-oracle-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(TAIL_REF, encoding="utf-8")
        return subprocess.run([sys.executable, "-I", str(source)], input=raw,
                              capture_output=True, timeout=15, check=True).stdout


def tail_oracle(raw):
    # Independent byte-level decoder + direct suffix slice.
    pos = 0
    head_end = raw.index(b"\n")
    count, keep = map(int, raw[:head_end].split())
    pos = head_end + 1
    values = []
    for _ in range(count):
        end = raw.index(b"\n", pos)
        length = int(raw[pos:end]); pos = end + 1
        value = raw[pos:pos + length]
        assert raw[pos + length:pos + length + 1] == b"\n"
        pos += length + 1
        values.append(value)
    chosen = values[-keep:] if keep else []
    chunks = [f"{len(chosen)}\n".encode()]
    for value in chosen:
        chunks.extend((f"{len(value)}\n".encode(), value, b"\n"))
    return b"".join(chunks)


def build_tail(catalog, rng):
    identifier, batch = "oa-confluent-4", "confluent-4-recovered"
    source = source_item(catalog, identifier)
    assert source["contentHash"] == "156bdf3f839e54cd920a5ca4c9297ca81554b9c3ba28df872a0e9e00d483cbdf"
    examples = [(["a", "b", "c", "d", "e"], 2), (["a", "b", "c"], 5), ([], 3),
                (["", "  lead", "mid  ", "two words", "\t", "终"], 3),
                (["one", "", "three"], 0), (["same", "same", "same"], 1),
                (["keep trailing  ", "tail"], 2)]
    examples.extend([
        (["first", "second", "third", "fourth"], 1),
        (["α", "β", "γ", "δ"], 3),
        (["", "", "", ""], 2),
        ([" left", "right ", "  both  "], 1),
        (["a\tb", "c\td", "e\tf"], 2),
        (["猫", "dog", "🙂", "終"], 0),
        (["x", "y", "z"], 4),
        (["same", "same", "different", "same"], 3),
        (["\u00e9", "e\u0301", "漢字", "かな", "한글"], 4),
        ([" leading", "middle", "trailing ", "  both  "], 2),
        (["", "nonempty", "", "last"], 3),
        (["one", "two", "three", "four", "five", "six"], 5),
        (["a\tb\tc", "plain", "\t", "end"], 2),
        (["line-1", "line-2", "line-3", "line-4", "line-5"], 3),
        (["零", "一", "二", "三"], 2),
    ])
    cases = []
    for i, (lines, keep) in enumerate(examples):
        raw = vector_input(lines, keep)
        expected = vector_output(lines[-keep:] if keep else [])
        assert tail_reference_output(raw) == expected == tail_oracle(raw)
        cases.append({"name": f"样例与边界 {i+1}", "input": raw.decode("utf-8"),
                      "expectedOutput": expected.decode("utf-8"), "hidden": i >= 2, "weight": 1})
    assert sum(case["hidden"] for case in cases) >= 20
    oracle = []
    seen = {case["input"].encode("utf-8") for case in cases}
    alphabet = ["", " ", " x", "y ", "a b", "\t", "é", "猫"]
    while len(oracle) < 120:
        lines = ["".join(rng.choice(alphabet) for _ in range(rng.randint(0, 3)))
                 for _ in range(rng.randint(0, 25))]
        keep = rng.randint(0, len(lines) + 4)
        raw = vector_input(lines, keep)
        if raw in seen:
            continue
        seen.add(raw)
        expected = tail_oracle(raw)
        assert tail_reference_output(raw) == expected
        oracle.append({"input": raw.decode("utf-8"), "expectedOutput": expected.decode("utf-8")})

    mutants = [
        ("读取时去除首尾空白", TAIL_REF.replace(
            "values.append(data[pos:pos + length])", "values.append(data[pos:pos + length].strip())")),
        ("读取时错误删除字符串末尾空格", TAIL_REF.replace(
            "values.append(data[pos:pos + length])", "values.append(data[pos:pos + length].rstrip(b' '))")),
    ]
    mutant_result = []
    for name, mutant in mutants:
        rejected = [i for i, (lines, keep) in enumerate(examples)
                    if run(mutant, vector_input(lines, keep)) != vector_output(lines[-keep:] if keep else [])]
        assert rejected, f"surviving tail mutant: {name}"
        mutant_result.append({"name": name, "rejectedByCases": rejected})

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "保留原文的 Tail N Lines", "difficulty": "简单",
        "tags": ["OA", "Confluent", "字符串", "队列"],
        "description": "给定一个字符串数组 lines（每个元素代表一行，不含换行符）和非负整数 n，返回最后 n 行并保持原顺序。n=0 返回空数组；n 大于数组长度时返回全部行。",
        "input": "首行输入 `lineCount n`。随后对每一行字符串，先输入其 UTF-8 字节长度 L，再下一行给出恰好 L 个原始字节作为内容，之后紧跟一个 LF 分隔符。字符串可以为空并可包含空格、制表符及非 ASCII UTF-8 字符，但不能含 LF。0≤lineCount≤5000、0≤n≤5000、所有 payload 总长≤30000 字节。此长度前缀协议用于无损保留空行和行内空白。",
        "output": "使用相同的长度前缀协议输出结果：先输出返回行数，随后每行输出 UTF-8 字节长度和原始内容；空数组只输出 `0`。",
        "explanation": "来源语义明确；本站用 UTF-8 字节长度前缀补充 I/O 编码，避免空字符串、空格和制表符在 token 输入中丢失。",
        "hints": ["只需保留大小至多 n 的队列；遍历到新行时入队，超出容量便移除最早的一行。"],
        "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 65536,
        "checker": "exact", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(TAIL_REF).strip() + "\n"
    editorial = (
        "## 思路\n\n顺序读入长度前缀字符串，用双端队列保留至多 n 项。每读取一项就加入队尾，若数量超过 n 则删除队首。读完时队列即为末尾 n 行；n=0 时队列始终为空。序列化时同样按 UTF-8 字节长度写出，可完整保留空字符串和行内空格。\n\n"
        "## 正确性\n\n遍历处理前 i 行后，队列保存这 i 行中最后 min(i,n) 行且顺序不变：新行追加到队尾，超过 n 时删掉最早项，归纳成立。处理完所有行后正是题目要求；n=0 情况为空。\n\n"
        "## 复杂度\n\n设输入内容总字节数为 L，返回行数为 r，时间 O(L)，辅助空间 O(min(n,lineCount)) 个字符串引用，序列化输出另需 O(L_out)。"
    )
    write_json(OA / "packages" / f"{identifier}.json", package)
    (OA / "references" / f"{identifier}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", oracle)
    write_json(OA / "mutants" / f"{identifier}.json", [{"name": name, "code": mutant} for name, mutant in mutants])
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
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [342, 405]}],
            "resolvedSemantics": {"tail": "Return a suffix of the given array, preserving order; n=0 gives empty array and n>=length gives all lines, as the source solution documents.",
                "siteInputSupplement": "The source does not specify serialization. This candidate uses a byte-length-prefixed UTF-8 protocol, allows empty/whitespace/non-ASCII lines, prohibits LF inside an element, and bounds total payload to 30000 bytes. This preserves the exact input array values."}}]})
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": "输入是任意字符串行，标准 token 判题会丢失空行与行内空格；本批未定义可保真序列化协议。",
        "reason": "原题给定的是字符串数组而非原始文件文本，suffix 语义明确；新增长度前缀 UTF-8 协议可无损保留空行、行内空白与非 ASCII 字符。120 个随机数组与独立字节级 slice oracle、两个正常退出的空白处理错误实现均验证通过。"}]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases),
            "hiddenFormalCases": sum(case["hidden"] for case in cases), "oracleCases": len(oracle),
            "oracleInputsUnique": len(seen), "negativeControls": mutant_result}],
        "note": "本地长度前缀往返和独立切片 oracle 验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, oracle={len(oracle)}, mutants={len(mutant_result)} killed")


def main():
    # These exact per-ID outputs were checked absent before authoring. Permit
    # deterministic reruns of this generator for its own two IDs.
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    assert subprocess.check_output(["git", "rev-parse", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT, text=True).strip() == RAW_BLOB
    raw = subprocess.check_output(["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT)
    assert hashlib.sha256(raw).hexdigest() == RAW_SHA256
    rng = random.Random(20261006)
    if sys.argv[1:] == ["--tail-only"]:
        build_tail(catalog, rng)
    else:
        build_subset(catalog, rng)
        build_tail(catalog, rng)


if __name__ == "__main__":
    main()
