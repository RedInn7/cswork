#!/usr/bin/env python3
"""Generate an isolated offline candidate for Goldman Sachs #3 only."""

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
RAW_PATH = "web/content/docs/companies/goldman-sachs.mdx"
RAW_BLOB = "8efc97a5920a15a0815088ee41e197524a0517ca"
RAW_SHA256 = "14ea24f08c2a8fdfb8176adf6107d1ac025a14c49b7463c4f44c0efff63318b7"
CONTENT_HASH = "8ce7272efa6e3367c2ece67eaa635cf6745139b680a946454cee69d7f753e058"


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


REFERENCE = r'''def compare(s1, s2):
    def process(value):
        stack = []
        for char in value:
            if char == "#":
                if stack:
                    stack.pop()
            else:
                stack.append(char)
        return stack
    return 1 if process(s1) == process(s2) else 0

def solve(raw):
    lines = raw.decode("ascii").splitlines()
    if len(lines) != 2:
        raise ValueError("expected exactly two input lines")
    return str(compare(lines[0], lines[1]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.buffer.read()))
'''


def run(code: str, raw: str) -> str:
    with tempfile.TemporaryDirectory(prefix="goldman3-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=10, check=True)
        return proc.stdout.decode("ascii").strip()


def oracle(s1: str, s2: str) -> str:
    def reduce(value: str) -> list[str]:
        stack: list[str] = []
        for char in value:
            if char == "#":
                if stack:
                    stack.pop()
            else:
                stack.append(char)
        return stack
    return "1" if reduce(s1) == reduce(s2) else "0"


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-goldman-sachs-3", "goldman-sachs-3-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH

    formal = [
        ("axx#b#b#c", "axbdf#c#c", "来源样例"),
        ("#a", "a", "开头退格为空操作"),
        ("ab##", "x#", "连续退格后均为空"),
        ("ab#c", "ac", "退格删除前一个字符"),
        ("abc#", "ab", "尾部退格"),
        ("a", "a", "单字符相等"),
        ("a", "b", "单字符不等"),
        ("a#b##c", "c", "多次退格并保留后续字符"),
        ("zz##x", "x", "连续清空后追加"),
        ("abc#", "ac", "删除后长度不同"),
    ]
    cases = []
    for index, (s1, s2, name) in enumerate(formal):
        expected = oracle(s1, s2)
        cases.append({"name": name, "input": f"{s1}\n{s2}\n", "expectedOutput": expected + "\n",
                      "hidden": index != 0, "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    alphabet = "abcxyz##"
    while len(random_cases) < 120:
        s1 = "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 40)))
        s2 = "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 40)))
        raw = f"{s1}\n{s2}\n"
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(s1, s2)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        ("把 # 当作普通字符", REFERENCE.replace(
            'if char == "#":\n                if stack:\n                    stack.pop()\n            else:\n                stack.append(char)',
            'stack.append(char)')),
        ("每次退格错误删除两个字符", REFERENCE.replace(
            'if stack:\n                    stack.pop()',
            'if stack:\n                    stack.pop()\n                    if stack:\n                        stack.pop()')),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for index, (s1, s2, _) in enumerate(formal):
            raw = f"{s1}\n{s2}\n"
            if run(code, raw) != oracle(s1, s2):
                rejected.append(index)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    # Exercise the disclosed candidate limit without inflating the imported
    # package's sample payload. Both strings are exactly 100000 characters.
    stress_a = "x" * 50000 + "#" * 50000
    stress_b = "z" * 50000 + "#" * 50000
    assert run(REFERENCE, f"{stress_a}\n{stress_b}\n") == "1"

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Backspace String Compare", "difficulty": "简单",
        "tags": ["OA", "Goldman Sachs", "字符串", "双指针", "栈"],
        "description": "给定两个仅由小写英文字母和 `#` 组成的字符串。`#` 表示退格，会删除当前字符串中紧邻它之前的一个字符；若此时字符串为空，则不产生影响。判断分别处理后两个字符串是否相同，相同输出 1，否则输出 0。",
        "input": "输入两行非空字符串 s1、s2。本站补充约束：1≤|s1|,|s2|≤100000；字符仅为小写英文字母或 `#`。源题的长度约束损坏为 `1 5`，无法还原原始上限；本题明确使用本站长度上限，不将其表述为原题约束。",
        "output": "相同输出 1，否则输出 0。",
        "explanation": "退格为空串时无操作；其余规则按原题定义。可从右向左扫描并统计待跳过字符，也可使用栈。",
        "hints": ["从右向左扫描时，遇到 # 就增加待跳过字符数；普通字符若有待跳过计数则跳过，否则参与比较。"],
        "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 1024,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
    normalized = normalize_package(raw_package)
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n用栈分别处理两个字符串。遇到小写字母就压栈；遇到 `#`，若栈非空则弹出一个字符，栈为空时忽略。最后比较两个栈是否相等。\n\n"
        "## 正确性\n\n扫描每个字符串的任意前缀后，栈中恰好保存该前缀按题意执行所有退格后留下的字符，且顺序不变：普通字符追加到末尾，退格在栈非空时删除末尾字符、为空时保持不变。对完整字符串应用该结论，比较两个结果即得到正确答案。\n\n"
        "## 复杂度\n\n设两个字符串长度分别为 n、m，时间 O(n+m)，辅助空间 O(n+m)。本站长度上限为 100000；这是本站补充，不是从损坏的源约束恢复出的数值。"
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
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [202, 254]}],
            "resolvedSemantics": {"backspace": "Each # removes the immediately preceding character if one exists; applying backspace to an empty string leaves it empty.",
                "comparison": "Compare the two fully processed strings; return 1 iff equal, else 0.",
                "sourceConstraint": "The fixed source literally contains `1 5`, which is damaged and does not establish the original maximum length.",
                "siteInputSupplement": "This candidate independently sets nonempty strings of length at most 100000 for safe judging. It is disclosed as a CSWork limit and is not claimed to recover the upstream bound."}}]})
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": "最大长度约束原文损坏为“1 5”，无法据此确认输入上限。",
        "reason": "原题的字符域、退格行为、空串退格行为、比较目标及 0/1 输出均明确，歧义仅在长度上限。候选没有猜测原上限，而是显式增加本站 1≤长度≤100000 的评测边界；在该边界内算法线性且资源可控。固定源 MDX、catalog hash 与 review 已核对。"}]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(seen) - len(cases), "negativeControls": controls,
            "maxFormalStringLength": max(max(len(a), len(b)) for a, b, _ in formal),
            "maxBoundaryStressStringLength": 100000}],
        "note": "本地参考程序与独立栈 oracle 差分、正式边界和两个正常退出 mutant 验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, unique oracle={len(random_cases)}, mutants={len(controls)} killed")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    actual_blob = subprocess.check_output(["git", "rev-parse", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT, text=True).strip()
    raw_source = subprocess.check_output(["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT)
    assert actual_blob == RAW_BLOB
    assert hashlib.sha256(raw_source).hexdigest() == RAW_SHA256
    rng = random.Random(20261006)
    build(catalog, rng)


if __name__ == "__main__":
    main()
