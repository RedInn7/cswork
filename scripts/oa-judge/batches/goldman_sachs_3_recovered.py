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
RAW_PATH = "fastprep/Goldman Sachs/compare-strings.md"
RAW_BLOB = "854544620ee4b2eab58041a238cb0ae67ffba543"
RAW_SHA256 = "cfcf1fb9c678a953252cc6b1845b75a0b1ecf540a723123b75fe8d13918e850d"
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
    """Independent reverse scan: count pending erasures without a stack."""
    def surviving(value: str):
        skip = 0
        for char in reversed(value):
            if char == "#":
                skip += 1
            elif skip:
                skip -= 1
            else:
                yield char
    from itertools import zip_longest
    return "1" if all(a == b for a, b in zip_longest(
        surviving(s1), surviving(s2), fillvalue=None)) else "0"


def full_boundaries():
    """Legal nonempty inputs at the original 200000-character boundary."""
    return [
        ("a" * 200000, "a" * 200000, "20万完整保留且相等"),
        ("a" * 199999 + "b", "a" * 200000, "20万末尾不同"),
        ("b" + "a" * 199999, "a" * 200000, "20万开头不同"),
        ("x" * 100000 + "#" * 100000,
         "z" * 100000 + "#" * 100000, "20万退格全部清空"),
        ("#" * 199999 + "a", "a", "20万前导多余退格"),
        ("a#" * 100000, "#", "20万交替输入退格"),
        ("#" * 200000, "z#", "20万全退格"),
        ("a" * 100000 + "#" * 99999 + "b", "ab", "20万部分清空并追加"),
    ]

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
        ("#a##", "z#", "退格处理后两侧均为空串"),
        ("a##", "x#", "字符后多余退格后均为空串"),
        ("##abc", "abc", "开头多余退格不影响后续字符"),
        ("ab###c", "c", "清空后追加字符"),
        ("a#b#c#", "x#", "逐个删除至空串"),
        ("abc###x", "x", "完全清空后保留末尾字符"),
        ("x#y#z", "z", "交替输入和退格"),
        ("ab##c", "ac#", "两个结果长度相同但内容不同"),
        ("a##b", "b", "前缀清空后单字符相等"),
        ("abc##", "a#c", "多次退格的处理次序"),
        ("xy#z", "xz", "删除中间字符"),
    ]
    formal.extend(full_boundaries())
    cases = []
    for index, (s1, s2, name) in enumerate(formal):
        assert 1 <= len(s1) <= 200000 and 1 <= len(s2) <= 200000
        assert all(char in "abcdefghijklmnopqrstuvwxyz#" for char in s1 + s2)
        expected = oracle(s1, s2)
        assert run(REFERENCE, f"{s1}\n{s2}\n") == expected
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

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Backspace String Compare", "difficulty": "简单",
        "tags": ["OA", "Goldman Sachs", "字符串", "双指针", "栈"],
        "description": "给定两个仅由小写英文字母和 `#` 组成的字符串。`#` 表示退格，会删除当前字符串中紧邻它之前的一个字符；若此时字符串为空，则不产生影响。判断分别处理后两个字符串是否相同，相同输出 1，否则输出 0。",
        "input": "输入两行非空字符串 s1、s2。完整原约束：1≤|s1|,|s2|≤200000；字符仅为小写英文字母或 `#`。范围来自固定提交的完整 raw；整理版 MDX 的 `1 5` 是损坏片段。两行标准输入输出为本站包装。",
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
        "## 复杂度\n\n设两个字符串长度分别为 n、m，时间 O(n+m)，辅助空间 O(n+m)。完整原始上限为每串 200000，正式题包含完整范围的保留、清空、多余退格和相等/不等边界。"
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
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256}],
            "resolvedSemantics": {"backspace": "Each # removes the immediately preceding character if one exists; applying backspace to an empty string leaves it empty.",
                "comparison": "Compare the two fully processed strings; return 1 iff equal, else 0.",
                "sourceConstraint": "The fixed full raw establishes 1 <= length(s1), length(s2) <= 200000; the MDX constraint was damaged.",
                "siteInputSupplement": "Only the two-line standard input/output protocol is a site supplement. Original nonempty 200000-character bounds are preserved."}}]})
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": "最大长度约束原文损坏为“1 5”，无法据此确认输入上限。",
        "reason": "完整 raw 恢复两串各 1≤长度≤200000，保留原字符域、退格与比较语义；以完整原约束替换早期本站10万上限，修正空输入用例，加入20万正式边界并用反向跳过计数 oracle 独立验证。变更后必须重新运行真实 GoJudge 并刷新报告。"}]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(seen) - len(cases), "negativeControls": controls,
            "maxFormalStringLength": max(max(len(a), len(b)) for a, b, _ in formal),
            "maxBoundaryStressStringLength": 200000,
            "fullBoundaryFormalCases": len(full_boundaries())}],
        "note": "本地栈参考与独立反向跳过 oracle 差分，完整20万正式边界和两个正常退出 mutant 验证；本次生成未连接 GoJudge，旧报告不可复用。"})
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
