#!/usr/bin/env python3
"""Generate and locally validate an isolated correction candidate for Amazon #308."""
from __future__ import annotations

import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "fastprep/Amazon/amazon-minimum-value-calculation-by-replacing.md"
RAW_BLOB = "49b2fd436c67912a4c071fc5ec7e7b3d33a97acb"
RAW_SHA256 = "5ec110e281f012028cd0f0b18d16fba011cb57f207145eb88f2159cca7276d3a"
CONTENT_HASH = "b4c77510ad7ec62e1b10eb4dd5b15621a1c532321864ce3ada707ff84158a5a0"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw: dict) -> str:
    script = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
              "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
              "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
    proc = subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT,
                          input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout


REFERENCE = r'''import sys

def calculate_minimum_value(s, x, y):
    inf = 10**100
    cost = [inf, inf]
    if s[0] in "0!": cost[0] = 0
    if s[0] in "1!": cost[1] = 0
    for char in s[1:]:
        next_cost = [inf, inf]
        for bit in (0, 1):
            if char != "!" and int(char) != bit:
                continue
            for previous in (0, 1):
                add = x if (previous, bit) == (0, 1) else y if (previous, bit) == (1, 0) else 0
                next_cost[bit] = min(next_cost[bit], cost[previous] + add)
        cost = next_cost
    return min(cost)

def solve(raw):
    parts = raw.split()
    if len(parts) != 3:
        raise ValueError("expected S, x, and y")
    s, x_text, y_text = parts
    x, y = int(x_text), int(y_text)
    if not s or any(char not in "01!" for char in s) or "!" not in s:
        raise ValueError("S must contain 0, 1, and at least one !")
    if not (0 <= x <= 2**31 - 1 and 0 <= y <= 2**31 - 1):
        raise ValueError("x and y must be nonnegative 32-bit integers")
    return str(calculate_minimum_value(s, x, y))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read().decode("ascii")))
'''


def run(code: str, raw: str) -> str:
    with tempfile.TemporaryDirectory(prefix="amazon308-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=10, check=True)
        return proc.stdout.decode("ascii").strip()


def encode(s: str, x: int, y: int) -> str:
    return f"{s}\n{x} {y}\n"


def oracle(s: str, x: int, y: int) -> str:
    # Exhaustively enumerate wildcard assignments and score each adjacent edge directly.
    positions = [i for i, char in enumerate(s) if char == "!"]
    best = None
    for choices in itertools.product("01", repeat=len(positions)):
        chars = list(s)
        for index, bit in zip(positions, choices):
            chars[index] = bit
        total = sum(x if chars[i:i + 2] == ["0", "1"] else
                    y if chars[i:i + 2] == ["1", "0"] else 0
                    for i in range(len(chars) - 1))
        best = total if best is None else min(best, total)
    assert best is not None
    return str(best)


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-amazon-308", "amazon-308-sample-correction"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    assert [solution["language"] for solution in source["solutions"]] == ["python", "java", "cpp"]

    formal = [
        ("01!0", 2, 3, "5", "原题示例 1：按相邻字符对逐对计费"),
        ("!0!1", 3, 4, "3", "原题示例 2：两个 ! 都可替换为 0"),
        ("!10", 10, 1, "1", "必须保留一次 10 转换"),
        ("0!1", 100, 100, "100", "固定两端仍需一次 01 转换"),
        ("!01", 0, 9, "0", "x 为零"),
        ("10!", 9, 0, "0", "y 为零"),
        ("1!0", 4, 4, "4", "对称代价"),
        ("!0!", 7, 11, "0", "两端通配符"),
        ("0!1!0", 5, 8, "13", "多个通配符"),
        ("1!!0", 13, 2, "2", "连续通配符"),
        ("!", 2**31 - 1, 2**31 - 1, "0", "单字符通配符与最大 int 成本"),
        ("0!0", 2**31 - 1, 2**31 - 1, "0", "大成本但存在零代价完成"),
        ("!010!", 2**31 - 1, 2**31 - 1, str(2 * (2**31 - 1)), "答案超过有符号 32 位"),
        ("01!10", 3, 8, "11", "固定边界影响两侧代价"),
        ("!111!", 2, 100, "0", "通配符可与固定连续 1 合并"),
        ("000!!", 17, 29, "0", "全零后缀可避免所有转换"),
        ("1!!!", 17, 29, "0", "全一前缀可避免所有转换"),
        ("0!!1", 17, 29, "17", "固定端点强制一次 01"),
        ("01!!0", 0, 9, "9", "零成本 01 后仍被固定边界强制一次 10"),
        ("1!01", 3, 20, "23", "内部固定转换与通配符选择"),
        ("010!101", 7, 4, "29", "多段固定转换与单个通配符"),
        ("!0!1!", 0, 31, "0", "零成本方向覆盖多个通配符"),
    ]
    cases = []
    for i, (s, x, y, expected, name) in enumerate(formal):
        raw = encode(s, x, y)
        assert expected == oracle(s, x, y), (s, x, y, expected, oracle(s, x, y))
        assert run(REFERENCE, raw) == expected
        cases.append({"name": name, "input": raw, "expectedOutput": expected + "\n",
                      "hidden": i >= 2, "weight": 1})

    oracle_cases, seen = [], {case["input"] for case in cases}
    while len(oracle_cases) < 240:
        s = "".join(rng.choice("01!") for _ in range(rng.randint(1, 16)))
        if "!" not in s:
            s = s[:-1] + "!"
        x = rng.choice([0, 1, 2, 7, 19, 10**9, 2**31 - 1])
        y = rng.choice([0, 1, 3, 11, 23, 10**9, 2**31 - 1])
        raw = encode(s, x, y)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(s, x, y)
        assert run(REFERENCE, raw) == expected
        oracle_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    omit_10 = REFERENCE.replace(
        "add = x if (previous, bit) == (0, 1) else y if (previous, bit) == (1, 0) else 0",
        "add = x if (previous, bit) == (0, 1) else 0")
    all_zero = REFERENCE.replace(
        '    cost = [inf, inf]\n    if s[0] in "0!": cost[0] = 0\n    if s[0] in "1!": cost[1] = 0',
        '    cost = [0, inf] if s[0] in "0!" else [inf, 0]').replace(
        '            if char != "!" and int(char) != bit:\n                continue',
        '            if char == "!" and bit == 1:\n                continue\n            if char != "!" and int(char) != bit:\n                continue')
    mutants = [("忽略相邻 10 的 y 代价", omit_10), ("把所有 ! 固定替换为 0", all_zero)]
    controls = []
    for name, code in mutants:
        rejected = [i for i, (s, x, y, expected, _) in enumerate(formal)
                    if run(code, encode(s, x, y)) != expected]
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "替换 ! 后的最小相邻变化代价", "difficulty": "中等",
        "tags": ["OA", "Amazon", "动态规划", "字符串"],
        "description": "给定只含 0、1 和 ! 的字符串 S。每个 ! 可独立替换为 0 或 1。替换后，每个相邻对 01 计 x、10 计 y，其他相邻对计 0。求总费用最小值。",
        "input": "输入第一行为 S（长度 1..100000，且至少包含一个 !）。第二行输入非负 32 位整数 x、y。",
        "output": "输出最小总费用。",
        "explanation": "每个位置只需记录当前位置取 0 或 1 时的最小前缀费用；转移时只看新增的最后一对字符。",
        "hints": ["设 dp[b] 为处理到当前位置且当前位置取 b 时的最低代价。"],
        "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
    normalized = normalize_package(raw_package)
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = REFERENCE.strip() + "\n"
    editorial = (
        "## 思路\n\n令 `dp[b]` 表示处理完当前位置、并令该位为 `b` 时的最低费用。固定字符只有一种可选值，`!` 有 0、1 两种。枚举当前位 `b` 和前一位 `p`，从 `dp[p]` 转移；新增费用只由相邻对 `(p,b)` 决定：`01` 加 `x`，`10` 加 `y`，相同位不加。最终答案是最后一位取 0 或 1 的较小值。\n\n"
        "## 样例核对\n\n样例 1 的两种替换分别为 `0100`、`0110`，费用都为 `x+y=5`，所以最小值是 5，不是原文的 8。样例 2 可替换成 `0001`，只有一个 `01`，费用为 3；原文的 7 只是另一种替换 `1001` 的费用，并非最小值。原题 Python、Java、C++ 三份实现都按相同转移求全局最小值。\n\n"
        "## 正确性\n\n对每个前缀及其末位取值，dp 保存该状态的最小可行费用。初始单字符没有相邻对，费用为 0。扩展一个字符时，所有合法延伸只需选择当前位；由转移把新增相邻对的准确费用加入此前最优值。因此归纳可知每步 dp 均等于该状态的最小费用。末位两种状态覆盖所有完整替换，取较小者即为全局最小值。\n\n"
        "## 复杂度\n\n时间 `O(n)`，额外空间 `O(1)`。"
    )
    write_json(OA / "packages" / f"{identifier}.json", package)
    (OA / "references" / f"{identifier}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", oracle_cases)
    write_json(OA / "mutants" / f"{identifier}.json", [{"name": n, "code": c} for n, c in mutants])
    write_json(OA / "editorials" / f"{identifier}.json", {
        "schemaVersion": 1, "id": identifier, "title": problem["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"})
    write_json(OA / "candidate-batches" / f"{batch}.json", {
        "schemaVersion": 1, "items": [{"id": identifier, "sourceContentHash": source["contentHash"],
            "packageChecksum": checksum, "editorial": editorial,
            "authoredSolutions": [{"language": "python", "code": reference}]}]})
    write_json(OA / "source-evidence" / f"{batch}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": COMMIT, "origin": "https://oamaster.com",
        "items": [{"id": identifier, "sourceUrl": source["sourceUrl"],
            "catalogContentHash": source["contentHash"], "rawPath": RAW_PATH,
            "rawGitBlob": RAW_BLOB, "rawSha256": RAW_SHA256,
            "resolvedSemantics": {
                "objective": "Replace every ! with 0 or 1 and minimize the sum over adjacent pairs: 01 costs x, 10 costs y.",
                "evidence": "The fixed raw statement explicitly scores every adjacent pair as 01 -> x and 10 -> y, and asks for the minimum after replacing every !. The Python, Java and C++ implementations all perform the same two-state minimum-cost DP. Direct enumeration gives 5 for Example 1 and 3 for Example 2; the published values are not minima.",
                "inputDomain": "Raw source: S uses 0, 1, !; length 1..100000; at least one !; x,y are nonnegative integers. The site protocol bounds x,y to nonnegative signed 32-bit values, matching the original Java/C++ int parameters; the answer fits signed 64-bit.",
                "siteProtocol": "Line 1: S. Line 2: x y. Output the minimum as an integer. The 32-bit input bound is disclosed as matching the original signatures."}}]})
    write_json(OA / "resolutions" / f"{batch}.json", {
        "schemaVersion": 1, "items": [{"id": identifier, "batch": batch,
            "sourceContentHash": source["contentHash"],
            "previousReason": "两个公开样例的输出均与题面定义及源代码的最小化目标冲突，尚未确认应信样例还是明确的相邻对计价规则。",
            "reason": "按固定原始题源中明确的相邻对计费规则穷举所有替换：样例 1 的 0100、0110 费用都为 x+y=5，应将输出 8 改为 5；样例 2 可替换为 0001，只有一个 01，费用为 3，应将输出 7 改为 3。原始 Python、Java、C++ 三份实现都以两状态 DP 求所有替换的最小值，与该修正一致。只修正样例预期值并改写讲义说明，不补题面规则。"}]})
    write_json(OA / "validation" / f"{batch}.json", {
        "schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases),
            "hiddenFormalCases": sum(case["hidden"] for case in cases),
            "oracleCases": len(oracle_cases), "oracleInputsUnique": len(oracle_cases),
            "negativeControls": controls, "maxLengthStress": 100000}],
        "note": "全部正式用例均与独立穷举替换 oracle 对照；另有 240 个唯一随机输入由 oracle 逐项验证。两个 mutant 均正常退出并被正式用例击杀。最大长度压力由 O(n) 求解器校验；GoJudge 服务端验证记录单独保存。"})

    stress_s = "01!" * 33_332 + "0!!!"
    assert len(stress_s) == 100_000
    stress_answer = run(REFERENCE, encode(stress_s, 2, 3))
    assert stress_answer.isdigit()
    print(f"{identifier}: formal={len(cases)}, hidden={sum(c['hidden'] for c in cases)}, "
          f"unique oracle={len(oracle_cases)}, mutants={len(controls)} killed, maxLength=100000")


def main() -> None:
    catalog = json.loads((ROOT / "content" / "oa-master" / "catalog.json").read_text(encoding="utf-8"))
    build(catalog, random.Random(20261006))


if __name__ == "__main__":
    main()
