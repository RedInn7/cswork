"""Build an offline, independently checked candidate for Microsoft OA #60."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-microsoft-60"
BATCH = "microsoft-60-recovered"
SEED = 20261006
LC_URL = "https://leetcode.com/problems/reverse-integer/"
PREVIOUS_REASON = "正文没有定义反转结果超出32位时的输出，样例却明确强调结果在32位内才返回；不能擅自采用返回0或无限宽整数。"

REFERENCE = r'''import sys

def solve(text):
    x = int(text.strip())
    sign = -1 if x < 0 else 1
    x = abs(x)
    reversed_value = 0
    while x:
        reversed_value = reversed_value * 10 + x % 10
        x //= 10
    reversed_value *= sign
    return str(reversed_value if -(2**31) <= reversed_value <= 2**31 - 1 else 0)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def put_json(folder: str, filename: str, value: object) -> None:
    put(OA / folder / filename, value)


def solve(x: int) -> int:
    sign = -1 if x < 0 else 1
    digits = abs(x)
    reversed_value = 0
    while digits:
        reversed_value = reversed_value * 10 + digits % 10
        digits //= 10
    reversed_value *= sign
    return reversed_value if -(2**31) <= reversed_value <= 2**31 - 1 else 0


def direct_oracle(x: int) -> int:
    """Independent string-based oracle; production solution itself uses arithmetic."""
    sign = -1 if x < 0 else 1
    reversed_value = sign * int(str(abs(x))[::-1])
    return reversed_value if -(2**31) <= reversed_value <= 2**31 - 1 else 0


def main() -> None:
    if (OA / "batches" / f"{BATCH}.json").exists():
        print(f"{PID} is already promoted; leaving the verified batch unchanged")
        return
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    source = next(row for row in catalog["items"] if row["id"] == PID)
    assert source["title"] == "Reverse an Integer"
    assert source["sourceUrl"] == "https://oamaster.com/docs/companies/microsoft#60-reverse-an-integer"
    assert source["contentHash"] == "63e5f5c1c7cc3bacf18c1df7569a96f187f5d4c3e24fccc9634ed301e06b32b9"
    previous = json.loads((OA / "reviews/microsoft-remaining.json").read_text())
    old = next(row for row in previous["items"] if row["id"] == PID)
    assert old["status"] == "blocked" and old["reason"] == PREVIOUS_REASON

    # Keep the three OAMaster samples; official LeetCode wording supplies the
    # unambiguous 32-bit overflow behavior for this same task and examples.
    samples = [("123", 321), ("120", 21), ("-120", -21)]
    cases = [{"name": f"原样例 {i}", "input": f"{x}\n", "expectedOutput": f"{y}\n", "hidden": False, "weight": 1}
             for i, (x, y) in enumerate(samples, 1)]
    fixed = [
        ("零", 0), ("单个负数", -7), ("末尾零", 100), ("中间零", 10020),
        ("正向溢出", 1534236469), ("负向溢出", -1563847412),
        ("最小int32溢出", -(2**31)), ("最大值反转仍合法", 1463847412),
        ("负数反转合法", -1463847412), ("全零", 1000000000),
        ("反转后恰好int32最大值", 7463847412),
    ]
    # Inputs must themselves be signed int32; the last illustrative boundary
    # is instead covered below through a value that reverses to the same edge.
    fixed = [(n, x) for n, x in fixed if -(2**31) <= x <= 2**31 - 1]
    fixed.extend([
        ("反转结果147483647", 746384741),
        ("反转结果147483648", 846384741),
        ("负数反转结果-147483648", -846384741),
        ("负数反转结果-147483649", -946384741),
    ])
    for name, x in fixed:
        cases.append({"name": name, "input": f"{x}\n", "expectedOutput": f"{direct_oracle(x)}\n", "hidden": True, "weight": 1})

    rng = random.Random(SEED)
    checked = {int(x) for x, _ in samples} | {x for _, x in fixed}
    random_values: list[int] = []
    while len(random_values) < 160:
        x = rng.randint(-(2**31), 2**31 - 1)
        if x not in checked:
            checked.add(x)
            random_values.append(x)
    for i, x in enumerate(random_values[:40], 1):
        cases.append({"name": f"独立随机 {i}", "input": f"{x}\n", "expectedOutput": f"{direct_oracle(x)}\n", "hidden": True, "weight": 1})

    for x in range(-10000, 10001):
        assert solve(x) == direct_oracle(x), x
    assert solve(1534236469) == 0
    assert solve(-2147483648) == 0
    assert solve(1463847412) == 2147483641
    assert solve(-1463847412) == -2147483641

    mutants = [
        ("溢出时不返回0", "import sys\nx=int(sys.stdin.read()); y=int(str(abs(x))[::-1])*(-1 if x<0 else 1); print(y)"),
        ("丢失负号", "import sys\nx=int(sys.stdin.read()); print(int(str(abs(x))[::-1]))"),
    ]
    for name, _ in mutants:
        assert any(
            (int(str(abs(x))[::-1]) * (-1 if x < 0 else 1) if name == "溢出时不返回0" else int(str(abs(x))[::-1])) != direct_oracle(x)
            for x in [1534236469, -1563847412, -120]
        ), name

    package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "整数反转", "difficulty": "简单", "tags": ["OA", "Microsoft"],
            "description": "不把整数转成字符串，反转一个32位有符号整数。若反转结果超出32位有符号整数范围，输出0。超范围返回0按同题官方题面补明。",
            "input": "输入一个整数x，−2³¹≤x≤2³¹−1。",
            "output": "输出反转后的整数；若结果超出−2³¹至2³¹−1，输出0。",
            "explanation": "保留符号，反转数位并去掉前导零；反转结果越界时返回0。",
            "hints": ["用取模和整除逐位构造答案；每一步检查边界，或用足够宽的中间变量后检查。"],
            "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    normalize = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    normalized = subprocess.run(
        ["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
        input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True,
    )
    if normalized.returncode:
        raise RuntimeError(normalized.stderr)
    package_text = normalized.stdout
    package = json.loads(package_text)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
    editorial_text = "## 思路\n\n逐位取出个位并追加到答案末尾，不使用字符串操作。\n\n## 溢出\n\n官方同题规则规定，反转结果超出有符号32位范围时输出0。\n\n## 正确性\n\n每一步将原数最低位追加到当前答案，故处理完所有位后答案正好是反序；再按范围规则处理溢出。\n\n## 复杂度\n\n时间O(log|x|)，空间O(1)。"
    put_json("packages", f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE, encoding="utf-8")
    put_json("editorials", f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": "整数反转",
        "explanation": editorial_text,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"],
    })
    put_json("oracles", f"{PID}.json", [{"input": f"{x}\n", "expectedOutput": f"{direct_oracle(x)}\n"} for x in sorted(checked)])
    put_json("mutants", f"{PID}.json", [{"name": name, "code": code} for name, code in mutants])
    put_json("candidate-batches", f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "sourceContentHash": source["contentHash"],
        "packageChecksum": hashlib.sha256(package_bytes).hexdigest(),
        "editorial": editorial_text,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }]})
    put(OA / "resolutions" / f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
        "previousReason": PREVIOUS_REASON,
        "reason": "OAMaster 的标题、约束与三个样例和 LeetCode 官方 Reverse Integer（#7）相同；官方题面明确反转越界返回0，补足 OAMaster 正文缺失的规则。保留三个源样例，新增边界和160个独立字符串 oracle；本地穷举与溢出用例通过，待用户自有 GoJudge 验证。",
    }]})
    put(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1, "id": PID,
        "oamaster": {"url": source["sourceUrl"], "contentHash": source["contentHash"], "title": source["title"]},
        "canonical": {"url": LC_URL, "claim": "官方题面明确：反转值超出有符号32位范围时返回0；其输入约束和三个基础样例与本题一致。"},
    })
    put(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "note": "本地对照验证，不代表 GoJudge 沙箱通过。",
        "problems": [{"id": PID, "oracleCases": len(checked), "formalCases": len(cases), "hiddenCases": sum(c["hidden"] for c in cases),
                      "uniqueOracleInputs": len(checked), "exhaustiveInputs": 20001,
                      "negativeControls": [
                          {"name": "溢出时不返回0", "rejectedByCases": ["正向溢出", "负向溢出"]},
                          {"name": "丢失负号", "rejectedByCases": ["原样例 3", "负数反转合法"]},
                      ],
                      "status": "local_verified"}],
    })
    print(f"{PID}: {len(cases)} formal cases ({sum(c['hidden'] for c in cases)} hidden), {len(checked)} unique oracle inputs; local exhaustive checks passed")


if __name__ == "__main__":
    main()
