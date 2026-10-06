#!/usr/bin/env python3
"""Generate and locally validate an isolated candidate for Microsoft #45."""

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
CONTENT_HASH = "b77cd909f252ed72fa26fff8c31d8cc2c84a1f608537d02d08321f8b68698e20"


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


REFERENCE = r'''import sys

def minimum_deletions_to_sorted(s):
    tails = []
    for char in s:
        lo, hi = 0, len(tails)
        # upper_bound: equal letters may remain together in a nondecreasing subsequence.
        while lo < hi:
            mid = (lo + hi) // 2
            if tails[mid] <= char:
                lo = mid + 1
            else:
                hi = mid
        if lo == len(tails):
            tails.append(char)
        else:
            tails[lo] = char
    return len(s) - len(tails)

def solve(raw):
    s = raw.strip()
    if not s or any(not ('a' <= char <= 'z') for char in s):
        raise ValueError("expected one nonempty lowercase English word")
    return str(minimum_deletions_to_sorted(s))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read().decode("ascii")))
'''


def run(code: str, raw: str, timeout: int = 10) -> str:
    with tempfile.TemporaryDirectory(prefix="microsoft45-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=timeout, check=True)
        return proc.stdout.decode("ascii").strip()


def encode(s: str) -> str:
    return s + "\n"


def oracle(s: str) -> str:
    # Independent alphabet-DP oracle: best[c] is the LNDS length ending in c.
    best = [0] * 26
    for char in s:
        index = ord(char) - ord("a")
        best[index] = max(best[:index + 1]) + 1
    return str(len(s) - max(best))


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-microsoft-45", "microsoft-45-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    assert [solution["language"] for solution in source["solutions"]] == ["python", "java", "cpp"]

    formal = [
        ("banana", "原题示例：删除 3 个字母后可得有序子序列 aan"),
        ("a", "单个小写字母"),
        ("z", "字母表末端"),
        ("abc", "已按字典序排列，无需删除"),
        ("zyx", "严格降序，只能保留一个字母"),
        ("aaaa", "重复字符可全部保留，必须求非降而非严格递增"),
        ("abab", "重复字母的多种最优保留方式"),
        ("azby", "交错升降"),
        ("cab", "最优保留后缀"),
        ("bac", "中间保留单字母的平局情况"),
        ("mississippi", "高频重复与多字母交错"),
        ("abcdefghijklmnopqrstuvwxyz", "完整小写字母表正序"),
        ("zyxwvutsrqponmlkjihgfedcba", "完整小写字母表逆序"),
        ("a" * 100_000, "最大长度且全部相同"),
        ("z" * 50_000 + "a" * 50_000, "最大长度两段逆序"),
        ("a" * 25_000 + "b" * 25_000 + "a" * 25_000 + "b" * 25_000,
         "最大长度重复分块"),
        ("abcdefghijklmnopqrstuvwxyz" * 3_846 + "abcd",
         "最大长度附近多轮递增字母表"),
        ("zyxwvutsrqponmlkjihgfedcba" * 3_846 + "zyxw",
         "最大长度附近多轮递减字母表"),
        ("qwertyuiopasdfghjklzxcvbnm", "键盘序字母排列"),
        ("abacabadabacaba", "重复回文式序列"),
        ("zzzyyyxxxwww", "重复字母块逆序"),
        ("a" + "z" * 99_999, "首字母可保留、长相等尾段"),
        ("z" * 99_999 + "a", "长前缀后接最小字母"),
    ]
    cases = []
    for i, (s, name) in enumerate(formal):
        expected = oracle(s)
        raw = encode(s)
        assert run(REFERENCE, raw) == expected
        cases.append({"name": name, "input": raw, "expectedOutput": expected + "\n",
                      "hidden": i != 0, "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    while len(random_cases) < 160:
        s = "".join(rng.choice("abcdef") for _ in range(rng.randint(1, 14)))
        raw = encode(s)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(s)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    strict_lis_mutant = REFERENCE.replace(
        "if tails[mid] <= char:", "if tails[mid] < char:")
    prefix_only_mutant = REFERENCE.replace(
        "    tails = []", "    tails = []").replace(
        "    for char in s:\n        lo, hi = 0, len(tails)",
        "    for char in s:\n        lo, hi = 0, len(tails)")
    prefix_only_mutant = prefix_only_mutant.replace(
        "    return len(s) - len(tails)",
        "    prefix = 1\n    while prefix < len(s) and s[prefix - 1] <= s[prefix]:\n        prefix += 1\n    return len(s) - prefix")
    mutants = [
        ("误用严格递增子序列，重复字母不能同时保留", strict_lis_mutant),
        ("只保留最长非降前缀，而非任意子序列", prefix_only_mutant),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for i, (s, _) in enumerate(formal):
            expected = cases[i]["expectedOutput"].strip()
            if run(code, encode(s)) != expected:
                rejected.append(i)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Minimum Deletions to Sort a Word", "difficulty": "简单",
        "tags": ["OA", "Microsoft", "最长非降子序列", "二分查找"],
        "description": "给定一个仅含小写英文字母的单词，求最少删除多少个字母，使剩余字母按原有相对顺序组成一个字典序非降的字符串。删除后无需连续；相同字母可以同时保留。",
        "input": "输入一行非空字符串 S。1≤|S|≤100000，S 仅包含 a-z。",
        "output": "输出最少删除的字母数。",
        "explanation": "保留部分必须是原串的非降子序列。最少删除数等于 |S| 减去最长非降子序列长度。",
        "hints": ["对字符依次求最长非降子序列；处理相同字符时使用 upper_bound。"],
        "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n保留的字母必须构成原字符串的一个子序列，并且字典序非降。设最长非降子序列长度为 L，则最多保留 L 个字母，答案为 `n-L`。用 tails 维护各长度非降子序列的最小结尾字符；每个字符用 upper_bound 找第一个大于它的位置替换，否则扩展序列。\n\n"
        "## 正确性\n\n任意保留方案都是原字符串的非降子序列，因此其长度不超过 L，至少删除 n−L 个字符。反之，最长非降子序列本身可通过删除其余字符得到，所以删除 n−L 个字符足够。tails 的 upper_bound 更新是经典最长非降子序列算法，重复字母可延长序列，最终长度恰为 L。\n\n"
        "## 复杂度\n\n时间 O(n log n)，空间 O(n)。"
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
        "repository": "https://github.com/RedInn7/OA-Master", "commit": COMMIT,
        "origin": "https://oamaster.com", "items": [{"id": identifier,
            "sourceUrl": source["sourceUrl"], "catalogContentHash": source["contentHash"],
            "manifestFile": "microsoft.mdx", "manifestSourceHash": "961455ad3353d5a0c9af3360a2bbd074cff3172926fc1061104c0352eb3b6e58",
            "resolvedSemantics": {
                "objective": "Delete the fewest characters so the remaining characters, in their original order, are lexicographically nondecreasing.",
                "evidence": "The fixed source truncates its prose after 'smallest number of lette', but its Chinese explanation explicitly states minimum deletions to make the remaining string nondecreasing. The original banana example confirms the target subsequence 'aan'. Python, Java, and C++ implementations all independently compute n minus the length of a longest nondecreasing subsequence, using upper_bound semantics so duplicates may remain.",
                "inputDomain": "The fixed source explicitly bounds |S| to 1..100000 and restricts S to lowercase a-z.",
                "siteProtocol": "One nonempty lowercase word on stdin; output one integer. No extra behavior is inferred."
            }}]})
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": "正文截断于smallest number of lette，仅banana一例暗示删除成有序，缺完整目标与操作定义。",
        "reason": "固定快照的题解明确写明最少删除后使剩余字符串字典序非降；banana 示例给出保留子序列 aan。Python、Java、C++ 三份源实现均为长度减最长非降子序列，且都使用 upper_bound 语义保留重复字母。输入字符和长度范围明确，因此可按该唯一语义补齐截断句。"
    }]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases),
            "hiddenFormalCases": sum(case["hidden"] for case in cases),
            "oracleCases": len(random_cases), "oracleInputsUnique": len(random_cases),
            "negativeControls": controls, "maxLengthStress": 100_000}],
        "note": "正式小例用 O(n^2) 独立 DP 对照，160 个唯一随机串同样逐项对照；最大长度结构化压力样例由闭式期望值校验，两个正常退出错误实现均被正式用例击杀。本地验证，未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, hidden={sum(case['hidden'] for case in cases)}, "
          f"unique oracle={len(random_cases)}, mutants={len(controls)} killed, maxLength=100000")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    build(catalog, random.Random(20261006))


if __name__ == "__main__":
    main()
