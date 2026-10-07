#!/usr/bin/env python3
"""Author and locally validate Uber #26 and #36 in isolated candidate artifacts.

This generator intentionally does not modify shared review, coverage, registry,
or formal batch files. It validates the fixed upstream source snapshot before
writing any ID-specific candidate artifacts.
"""

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
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/uber.mdx"
SOURCE_BLOB = "e7f6ba66bd8c83d46cc6392e5550e001da075bed"
SOURCE_SHA256 = "6ab55dc6ebb1486ee72776561a824b35579f87e50cb4953baa882ad0da6fff29"
BATCH = "uber-26-36-recovered"
PREVIOUS_REASONS = {
    "oa-uber-26": "正文没有可定义的条件，仅给[1,2,3]结果1，无法知道在统计什么。",
    "oa-uber-36": "题干截断于Given two arrays of strictly i；仅凭[123,4,5,955]和[12345,63,95,2]输出3不能确定比较规则。",
}
SOURCE_URLS = {
    "oa-uber-26": "https://oamaster.com/docs/companies/uber#26-count-elements-with-at-least-one-smaller-and-one-greater-value",
    "oa-uber-36": "https://oamaster.com/docs/companies/uber#36-find-length-of-longest-common-prefix",
}
CATALOG_HASHES = {
    "oa-uber-26": "9dcb94388ae360e2eb1df31d2eb9fbfef32ce93fcf3764f24c6da369ff23e5a9",
    "oa-uber-36": "f397cc7f27f92f51c7c043f84283075084bea701587a27af3d7bc05d6ca9041f",
}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw: dict) -> str:
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    result = subprocess.run(
        ["node", "--import", "tsx", "-e", script], cwd=ROOT,
        input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout


REFERENCE_26 = r'''import sys


def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    n = data[0]
    if n < 1 or n > 100_000 or len(data) != n + 1:
        raise ValueError("expected n followed by n integers")
    nums = data[1:]
    if any(not -1_000_000_000 <= x <= 1_000_000_000 for x in nums):
        raise ValueError("nums values must be within the site bounds")
    low, high = min(nums), max(nums)
    return str(sum(low < value < high for value in nums))


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

REFERENCE_36 = r'''import sys


def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    n, m = data[0], data[1]
    if not (1 <= n <= 50_000 and 1 <= m <= 50_000):
        raise ValueError("array lengths must be within the site bounds")
    if len(data) != 2 + n + m:
        raise ValueError("expected n, m, then both arrays")
    arr1 = data[2:2 + n]
    arr2 = data[2 + n:]
    if any(not 1 <= value <= 1_000_000_000 for value in arr1 + arr2):
        raise ValueError("array values must be positive and within the site bounds")

    prefixes = set()
    for value in arr1:
        digits = str(value)
        for end in range(1, len(digits) + 1):
            prefixes.add(digits[:end])
    answer = 0
    for value in arr2:
        digits = str(value)
        for end in range(1, len(digits) + 1):
            if digits[:end] not in prefixes:
                break
            answer = max(answer, end)
    return str(answer)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def encode_26(nums: list[int]) -> str:
    return f"{len(nums)}\n" + " ".join(map(str, nums)) + "\n"


def encode_36(arr1: list[int], arr2: list[int]) -> str:
    return (f"{len(arr1)} {len(arr2)}\n" + " ".join(map(str, arr1)) + "\n"
            + " ".join(map(str, arr2)) + "\n")


def oracle_26(raw: str) -> str:
    nums = list(map(int, raw.split()))[1:]
    # Independent definition: for each position, explicitly search for both
    # witnesses instead of reducing to global extrema.
    count = 0
    for index, value in enumerate(nums):
        has_lower = any(other < value for j, other in enumerate(nums) if j != index)
        has_higher = any(other > value for j, other in enumerate(nums) if j != index)
        count += has_lower and has_higher
    return str(count)


def common_prefix_len(left: int, right: int) -> int:
    a, b = str(left), str(right)
    index = 0
    while index < min(len(a), len(b)) and a[index] == b[index]:
        index += 1
    return index


def oracle_36(raw: str) -> str:
    data = list(map(int, raw.split()))
    n, m = data[:2]
    arr1 = data[2:2 + n]
    arr2 = data[2 + n:]
    # Direct pair enumeration is deliberately independent of the reference's
    # prefix-set strategy and is bounded to small oracle inputs.
    return str(max((common_prefix_len(a, b) for a in arr1 for b in arr2), default=0))


def run_code(code: str, raw: str) -> str:
    with tempfile.TemporaryDirectory(prefix="uber26-36-run-") as directory:
        file = Path(directory) / "solution.py"
        file.write_text(code, encoding="utf-8")
        result = subprocess.run(
            [sys.executable, "-I", str(file)], input=raw, text=True,
            capture_output=True, timeout=8, check=True,
        )
        return result.stdout.rstrip("\n")


def validate_source() -> dict[str, dict]:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    entries = {item["id"]: item for item in catalog["items"]
               if item["id"] in CATALOG_HASHES}
    for identifier, expected_hash in CATALOG_HASHES.items():
        assert entries[identifier]["contentHash"] == expected_hash
        assert entries[identifier]["sourceUrl"] == SOURCE_URLS[identifier]
    blob = subprocess.check_output(
        ["git", "rev-parse", f"{SOURCE_COMMIT}:{SOURCE_PATH}"], cwd=ROOT, text=True,
    ).strip()
    raw = subprocess.check_output(
        ["git", "show", f"{SOURCE_COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
    )
    assert blob == SOURCE_BLOB, blob
    assert hashlib.sha256(raw).hexdigest() == SOURCE_SHA256
    source = raw.decode("utf-8")
    assert "Count Elements with at Least One Smaller and One Greater Value" in source
    assert "nums = [1, 2, 3]" in source and "Only element 2 satisfies the condition." in source
    assert "Find Length of Longest Common Prefix" in source
    assert "arr1 = [123, 4, 5, 955]" in source
    assert "arr2 = [12345, 63, 95, 2]" in source
    assert "Longest Common Prefix" in source
    coverage = json.loads((OA / "coverage.json").read_text(encoding="utf-8"))
    reviews = json.loads((OA / "reviews" / "uber-next.json").read_text(encoding="utf-8"))
    for identifier, reason in PREVIOUS_REASONS.items():
        state = next(item for item in coverage["items"] if item["id"] == identifier)
        assert (state["status"] == "blocked" or
                (state["status"] in {"awaiting_sandbox", "sandbox_verified"}
                 and state.get("batch") == BATCH)), state
        review = next(item for item in reviews["items"] if item["id"] == identifier)
        assert review["status"] == "blocked" and review["reason"] == reason
        for folder in ("candidate-batches", "batches"):
            for path in (OA / folder).glob("*.json"):
                if folder == "candidate-batches" and (
                    path.name == f"{BATCH}.json" or path.name.startswith(f"{BATCH}-")
                ):
                    continue
                document = json.loads(path.read_text(encoding="utf-8"))
                for item in document.get("items", []):
                    assert (item.get("id") != identifier or
                            (folder == "batches" and path.name == f"{BATCH}.json")), (identifier, path)
    return entries


def build_26(entry: dict) -> tuple[dict, list[dict], list[dict], dict]:
    reference = textwrap.dedent(REFERENCE_26).strip() + "\n"
    formal_nums = [
        [1, 2, 3], # exact OAMaster sample
        [7], [4, 4], [1, 2, 2, 3], [-5, -1, -1, 0, 8],
        [-1_000_000_000, 0, 1_000_000_000],
        [1_000_000_000] * 40 + [0] * 20 + [-1_000_000_000] * 40,
        [-9, -8, -7, -6], [5, 4, 3, 2, 1], [0, 0, 0, 1, 1, 2],
    ]
    rng = random.Random(2026102601)
    seen = {tuple(values) for values in formal_nums}
    while len(formal_nums) < 32:
        nums = [rng.randint(-20, 20) for _ in range(rng.randint(1, 32))]
        key = tuple(nums)
        if key not in seen:
            seen.add(key)
            formal_nums.append(nums)
    cases = []
    for index, nums in enumerate(formal_nums):
        raw = encode_26(nums)
        expected = oracle_26(raw)
        assert run_code(reference, raw) == expected, ("oa-uber-26", index, nums)
        cases.append({"name": f"源规则/边界 {index + 1}", "input": raw,
                      "expectedOutput": expected + "\n", "hidden": index >= 8, "weight": 1})

    oracle_inputs, oracle_seen = [], {tuple(nums) for nums in formal_nums}
    oracle_rng = random.Random(2026102602)
    while len(oracle_inputs) < 120:
        nums = [oracle_rng.randint(-50, 50) for _ in range(oracle_rng.randint(1, 24))]
        key = tuple(nums)
        if key in oracle_seen:
            continue
        oracle_seen.add(key)
        raw = encode_26(nums)
        expected = oracle_26(raw)
        assert run_code(reference, raw) == expected
        oracle_inputs.append({"input": raw, "expectedOutput": expected + "\n"})

    boundary_nums = [1_000_000_000] * 33_333 + [0] * 33_334 + [-1_000_000_000] * 33_333
    boundary_raw = encode_26(boundary_nums)
    # The independently derived answer is the number of middle positions;
    # the quadratic oracle is intentionally reserved for small inputs.
    boundary_expected = "33334"
    assert boundary_expected == "33334" and run_code(reference, boundary_raw) == boundary_expected
    cases.append({"name": "本站最大规模与数值边界", "input": boundary_raw,
                  "expectedOutput": boundary_expected + "\n", "hidden": True, "weight": 1})

    mutant_codes = [
        ("把小于最小值/大于最大值端点条件放宽为非严格比较",
         reference.replace("low < value < high", "low <= value <= high")),
        ("误把相同数值只计一次",
         reference.replace("return str(sum(low < value < high for value in nums))",
                           "return str(len({value for value in nums if low < value < high}))")),
    ]
    mutants, negative = [], []
    for name, code in mutant_codes:
        code = textwrap.dedent(code).strip() + "\n"
        assert run_code(code, encode_26(formal_nums[0])) is not None
        rejected = [i for i, case in enumerate(cases)
                    if run_code(code, case["input"]) != case["expectedOutput"].strip()]
        assert rejected, f"oa-uber-26 mutant survived: {name}"
        mutants.append({"name": name, "code": code})
        negative.append({"name": name, "rejectedByCases": rejected})

    package = package_for(
        identifier="oa-uber-26", title="Count Elements with at Least One Smaller and One Greater Value",
        display_title="统计两侧都有更小和更大元素的数量", company="Uber",
        tags=["OA", "Uber", "数组", "最小值", "最大值"],
        description=(
            "给定整数数组 nums，统计有多少个数组元素同时存在一个严格更小的元素和一个严格更大的元素。"
            "等价于统计满足 min(nums) < nums[i] < max(nums) 的位置；相同值出现在多个位置时，符合条件的每个位置都要计数。"
            "\n\n本站有效输入范围：1≤n≤100000，−10^9≤nums[i]≤10^9。原 OAMaster 快照未提供约束，以上范围为本站补充。"
            f"\n\n原题：{SOURCE_URLS['oa-uber-26']}（上游快照 {SOURCE_COMMIT}，catalog 内容指纹 {entry['contentHash']}）。"
            "\n语义交叉核对：LeetCode 2148《Count Elements With Strictly Smaller and Greater Elements》，"
            "https://leetcode.com/problems/count-elements-with-strictly-smaller-and-greater-elements/。"
        ),
        input_text="第一行 n；第二行给出 n 个整数 nums[i]。",
        output_text="输出满足 min(nums)<nums[i]<max(nums) 的数组位置个数。",
        explanation="只要一个值严格大于全局最小值且严格小于全局最大值，就同时有更小和更大的元素。统计所有满足条件的位置，不去重。",
        cases=cases,
    )
    source_evidence = {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT, "origin": "https://oamaster.com",
        "items": [{
            "id": "oa-uber-26", "sourceUrl": SOURCE_URLS["oa-uber-26"],
            "catalogContentHash": entry["contentHash"],
            "rawFiles": [{"path": SOURCE_PATH, "blob": SOURCE_BLOB, "sha256": SOURCE_SHA256,
                          "excerpt": "OAMaster preserves the exact title, nums=[1,2,3] -> 1 and explanation 'Only element 2 satisfies the condition.'; the statement body is missing."}],
            "supportingPages": [{
                "url": "https://leetcode.com/problems/count-elements-with-strictly-smaller-and-greater-elements/",
                "supports": "Canonical same semantic rule: count each array element that has both a strictly smaller and strictly larger value somewhere in nums; matches OAMaster's exact [1,2,3] -> 1 sample and explanation.",
            }],
            "siteInputLimits": "1<=n<=100000; -1e9<=nums[i]<=1e9. Explicit local limits because OAMaster published none.",
            "sourceBoundResolution": PREVIOUS_REASONS["oa-uber-26"],
        }],
    }
    validation = {"negativeControls": negative, "formalCases": len(cases),
                  "oracleCases": len(oracle_inputs), "oracleInputsUnique": len(oracle_inputs),
                  "referenceSha256": hashlib.sha256(reference.encode()).hexdigest()}
    return package, oracle_inputs, mutants, {"reference": reference, "evidence": source_evidence, "validation": validation}


def build_36(entry: dict) -> tuple[dict, list[dict], list[dict], dict]:
    reference = textwrap.dedent(REFERENCE_36).strip() + "\n"
    formal_pairs = [
        ([123, 4, 5, 955], [12345, 63, 95, 2]), # exact OAMaster sample
        ([7], [8]), ([9], [9]), ([10], [1000]), ([1200, 7], [1234, 12]),
        ([1, 98], [10, 99]), ([999_999_999], [999_999_999]),
        ([2, 123456789], [2, 123456780]), ([10, 100], [99, 9]),
        ([123, 9], [923, 12]), ([98], [1, 987]),
    ]
    rng = random.Random(2026103601)
    seen = {(tuple(a), tuple(b)) for a, b in formal_pairs}
    while len(formal_pairs) < 32:
        a = [rng.randint(1, 1_000_000) for _ in range(rng.randint(1, 12))]
        b = [rng.randint(1, 1_000_000) for _ in range(rng.randint(1, 12))]
        key = (tuple(a), tuple(b))
        if key not in seen:
            seen.add(key)
            formal_pairs.append((a, b))
    cases = []
    for index, (a, b) in enumerate(formal_pairs):
        raw = encode_36(a, b)
        expected = oracle_36(raw)
        assert run_code(reference, raw) == expected, ("oa-uber-36", index, a, b)
        cases.append({"name": f"源规则/边界 {index + 1}", "input": raw,
                      "expectedOutput": expected + "\n", "hidden": index >= 8, "weight": 1})

    oracle_inputs, oracle_seen = [], {(tuple(a), tuple(b)) for a, b in formal_pairs}
    oracle_rng = random.Random(2026103602)
    while len(oracle_inputs) < 120:
        a = [oracle_rng.randint(1, 999_999) for _ in range(oracle_rng.randint(1, 7))]
        b = [oracle_rng.randint(1, 999_999) for _ in range(oracle_rng.randint(1, 7))]
        key = (tuple(a), tuple(b))
        if key in oracle_seen:
            continue
        oracle_seen.add(key)
        raw = encode_36(a, b)
        expected = oracle_36(raw)
        assert run_code(reference, raw) == expected
        oracle_inputs.append({"input": raw, "expectedOutput": expected + "\n"})

    # True array-size/value boundary using a constant-time analytical witness;
    # a later item carries a long prefix so implementations that only inspect
    # the first values or miss late pairs are exposed.
    large_left = [7] * 49_999 + [123_456_789]
    large_right = [7] * 49_999 + [123_456_780]
    boundary_raw = encode_36(large_left, large_right)
    boundary_expected = "8"
    assert run_code(reference, boundary_raw) == boundary_expected
    cases.append({"name": "本站最大数组规模与长前缀", "input": boundary_raw,
                  "expectedOutput": boundary_expected + "\n", "hidden": True, "weight": 1})

    mutant_codes = [
        ("只比较两数组首元素", reference.replace(
            "for value in arr2:\n        digits = str(value)",
            "for value in arr2[:1]:\n        digits = str(value)", 1)),
        ("误比较十进制后缀而不是前缀", reference.replace(
            "digits[:end] not in prefixes", "digits[-end:] not in prefixes")),
    ]
    mutants, negative = [], []
    for name, code in mutant_codes:
        code = textwrap.dedent(code).strip() + "\n"
        assert run_code(code, encode_36([1], [1])) is not None
        rejected = [i for i, case in enumerate(cases)
                    if run_code(code, case["input"]) != case["expectedOutput"].strip()]
        assert rejected, f"oa-uber-36 mutant survived: {name}"
        mutants.append({"name": name, "code": code})
        negative.append({"name": name, "rejectedByCases": rejected})

    package = package_for(
        identifier="oa-uber-36", title="Find Length of Longest Common Prefix",
        display_title="两个数组数字的最长公共前缀", company="Uber",
        tags=["OA", "Uber", "字符串", "前缀", "Trie"],
        description=(
            "给定两个由正整数组成的数组 arr1 和 arr2。将每个整数写成通常的十进制字符串；"
            "从 arr1 与 arr2 中各选一个数，比较它们从最高位开始的公共前缀。返回所有数对中最长公共前缀的长度；"
            "没有共同首位时结果为 0。前缀可以等于其中一个完整数字，例如 123 与 12345 的共同前缀长度是 3。"
            "\n\n本站有效输入范围：1≤|arr1|,|arr2|≤50000；1≤arr[i]≤10^9。原 OAMaster 快照没有公布约束，以上是本站补充范围；数组长度与 LeetCode 3043 的约束同级。"
            f"\n\n原题：{SOURCE_URLS['oa-uber-36']}（上游快照 {SOURCE_COMMIT}，catalog 内容指纹 {entry['contentHash']}）。"
            "\n同题 OA 讨论（题意和 OAMaster 样例完全一致）：https://leetcode.com/discuss/post/5378805/Uber-OA-Question/。"
            "\n标准题意交叉核对：LeetCode 3043 https://leetcode.com/problems/find-the-length-of-the-longest-common-prefix/。"
        ),
        input_text="第一行 n m；第二行 n 个正整数表示 arr1；第三行 m 个正整数表示 arr2。",
        output_text="输出两数组任取一对十进制表示的最长公共前缀长度。",
        explanation="把 arr1 中每个整数的所有非空前缀存入集合，再扫描 arr2 中每个数的前缀并更新最大长度。遇到第一个不存在的前缀即可停止该数的扫描。",
        cases=cases,
    )
    source_evidence = {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT, "origin": "https://oamaster.com",
        "items": [{
            "id": "oa-uber-36", "sourceUrl": SOURCE_URLS["oa-uber-36"],
            "catalogContentHash": entry["contentHash"],
            "rawFiles": [{"path": SOURCE_PATH, "blob": SOURCE_BLOB, "sha256": SOURCE_SHA256,
                          "excerpt": "OAMaster retains the exact sample arr1=[123,4,5,955], arr2=[12345,63,95,2] -> 3; statement truncates after 'Given two arrays of strictly i'."}],
            "supportingPages": [
                {"url": "https://leetcode.com/discuss/post/5378805/Uber-OA-Question/",
                 "supports": "Exact same Uber OA example arrays and result 3; says find the length of the longest common prefix of any pair of numbers from the two arrays."},
                {"url": "https://leetcode.com/problems/find-the-length-of-the-longest-common-prefix/",
                 "supports": "Canonical definition: arrays of positive integers; maximize decimal-string longest common prefix across pairs."},
            ],
            "siteInputLimits": "1<=n,m<=50000; 1<=arr[i]<=1e9. Explicit local input limits because OAMaster published none; length matches canonical LeetCode 3043 scale.",
            "inputProtocol": "Whitespace-tokenized stdin: n m, then n arr1 values and m arr2 values.",
            "sourceBoundResolution": PREVIOUS_REASONS["oa-uber-36"],
        }],
    }
    validation = {"negativeControls": negative, "formalCases": len(cases),
                  "oracleCases": len(oracle_inputs), "oracleInputsUnique": len(oracle_inputs),
                  "referenceSha256": hashlib.sha256(reference.encode()).hexdigest()}
    return package, oracle_inputs, mutants, {"reference": reference, "evidence": source_evidence, "validation": validation}


def package_for(*, identifier: str, title: str, display_title: str, company: str,
                tags: list[str], description: str, input_text: str, output_text: str,
                explanation: str, cases: list[dict]) -> dict:
    return {"schemaVersion": 1, "problem": {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": display_title, "difficulty": "简单", "tags": tags,
        "description": description, "input": input_text, "output": output_text,
        "explanation": explanation, "hints": [
            "先明确数组位置与元素值的区别。",
            "用字符串逐位比较十进制表示，不要把前缀误当作任意子串。",
        ], "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }, "cases": cases}


def emit(identifier: str, entry: dict, built: tuple[dict, list[dict], list[dict], dict]) -> tuple[dict, dict]:
    package_raw, oracle_inputs, mutants, extras = built
    reference = extras["reference"]
    package_text = normalize_package(package_raw)
    package = json.loads(package_text)
    checksum = hashlib.sha256(package_text.encode()).hexdigest()
    source_url = SOURCE_URLS[identifier]
    previous_reason = PREVIOUS_REASONS[identifier]
    if identifier == "oa-uber-26":
        editorial_body = (
            "## 思路\n\n"
            "设 lo=min(nums)、hi=max(nums)。数组中的一个位置满足题意，当且仅当其值严格位于 lo 与 hi 之间；逐位置计数，因此相同的中间值不会被去重。\n\n"
            "## 正确性证明\n\n"
            "若 lo < x < hi，则数组中存在取到 lo 的元素和取到 hi 的元素，它们分别严格小于、大于 x，所以 x 满足题意。反过来，若 x 满足题意，就存在更小元素和更大元素，因此 x 必须严格大于全局最小值且严格小于全局最大值。故满足条件的位置恰好是 lo < nums[i] < hi 的位置，算法逐位置统计所得答案正确。\n\n"
            "## 复杂度\n\n"
            "两次线性扫描，时间 O(n)，额外空间 O(1)。"
        )
    else:
        editorial_body = (
            "## 思路\n\n"
            "把 arr1 中每个数的十进制表示的所有非空前缀放入集合。再扫描 arr2 中每个数的前缀；每遇到一个存在于集合的前缀，就更新最大长度，首次缺失后无需继续扫描该数。\n\n"
            "## 正确性证明\n\n"
            "对任意 arr1 中的数 x 和 arr2 中的数 y，x 与 y 的公共前缀必然是 x 的一个前缀，因而已被加入集合；扫描 y 时，该公共前缀会命中集合。反之，若 y 的某个前缀命中集合，它就是 arr1 中某个数的前缀，也同时是 y 的前缀，因此对应一个合法数对。算法检查了所有可能的前缀并取最大长度，故得到所有跨数组数对中的最长公共前缀。\n\n"
            "## 复杂度\n\n"
            "设 D 为两个数组中所有数字的总位数。集合构造和查询的期望时间为 O(D)，额外空间为 O(D)。"
        )
    editorial = {
        "schemaVersion": 1, "id": identifier, "title": package["problem"]["title"],
        "explanation": editorial_body
        + f"\n\n## 来源与本站约定\n\n本站输入协议和边界见题面。固定 OAMaster 快照：{source_url}；原始 blocked 原因：{previous_reason}",
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source_url, "sourceContentHash": entry["contentHash"], "author": "CSWork",
    }
    resolution = {
        "schemaVersion": 1, "items": [{
            "id": identifier, "batch": BATCH, "sourceContentHash": entry["contentHash"],
            "previousReason": previous_reason,
            "reason": (
                ("固定 OAMaster 快照保存了题名、[1,2,3]→1 的样例和‘只有元素2满足条件’的解释；"
                 "LeetCode 2148 独立确认严格介于全局最小与最大之间的定义。本站补充了明确输入协议和约束。"
                 if identifier == "oa-uber-26" else
                 "固定 OAMaster 快照保留了完整样例；同题 Uber OA 讨论给出相同两数组和输出3，并明确是跨数组数对的最长公共前缀；"
                 "LeetCode 3043 交叉确认正整数按十进制前缀比较。本站补充了输入协议和约束。")
                + "本候选通过 120 个唯一独立 oracle 输入、至少 32 个正式用例（含原例及边界）和两个正常退出错误程序的本地差分；尚未连接 GoJudge。"
            ),
        }],
    }
    candidate = {"schemaVersion": 1, "items": [{
        "id": identifier, "sourceContentHash": entry["contentHash"],
        "packageChecksum": checksum, "editorial": editorial["explanation"],
        "authoredSolutions": [{"language": "python", "code": reference}],
    }]}
    validation_problem = {"id": identifier, **extras["validation"]}

    write_json(OA / "packages" / f"{identifier}.json", package)
    (OA / "references" / f"{identifier}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", oracle_inputs)
    write_json(OA / "mutants" / f"{identifier}.json", mutants)
    write_json(OA / "editorials" / f"{identifier}.json", editorial)
    write_json(OA / "source-evidence" / f"{identifier}-recovered.json", extras["evidence"])
    write_json(OA / "resolutions" / f"{identifier}-recovered.json", resolution)
    print(f"{identifier}: formal={len(package['cases'])}, unique oracle={len(oracle_inputs)}, mutants={len(mutants)} killed")
    return candidate["items"][0], validation_problem


def main() -> None:
    entries = validate_source()
    coverage = json.loads((OA / "coverage.json").read_text(encoding="utf-8"))
    states = {item["id"]: item for item in coverage["items"]}
    already_promoted = all(
        states[identifier]["status"] == "sandbox_verified"
        and states[identifier].get("batch") == BATCH
        for identifier in PREVIOUS_REASONS
    )
    candidate_items = []
    validation_problems = []
    for identifier in ("oa-uber-26", "oa-uber-36"):
        built = build_26(entries[identifier]) if identifier == "oa-uber-26" else build_36(entries[identifier])
        candidate_item, validation_problem = emit(identifier, entries[identifier], built)
        candidate_items.append(candidate_item)
        validation_problems.append(validation_problem)
    if not already_promoted:
        write_json(OA / "candidate-batches" / f"{BATCH}.json", {
            "schemaVersion": 1, "items": candidate_items,
        })
        write_json(OA / "validation" / f"{BATCH}.json", {
            "schemaVersion": 1, "seed": 20261006, "problems": validation_problems,
            "note": "仅本地独立 oracle/reference/mutant 验证；未连接 GoJudge，未访问服务器或发布。",
        })


if __name__ == "__main__":
    main()
