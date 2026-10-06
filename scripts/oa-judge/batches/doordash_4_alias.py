#!/usr/bin/env python3
"""Build and independently validate DoorDash #4 as a source-backed alias."""

import copy
import hashlib
import json
import random
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
SOURCE_ID = "oa-doordash-1"
TARGET_ID = "oa-doordash-4"
BATCH = "doordash-4-alias"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "fastprep/DoorDash/doordash-get-final-price.md"
SOURCE_BLOB = "ed828ab7f308c1c34388b6ea45b06b94d97d4a43"
CANONICAL_PATH = "fastprep/DoorDash/doordash-adjust-prices.md"
CANONICAL_BLOB = "8f6dfd7f2cb5830221d04ad22ff09876873c0fb7"
OLD_REASON = "题意与 DoorDash #1 Adjust Prices 重复，不作为独立题目重复收录。"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def digest(value):
    return hashlib.sha256(value).hexdigest()


def normalize_input(text):
    """Keep source type-2 rows in their original `2 v v` form."""
    values = list(map(int, text.split()))
    n, q = values[:2]
    prices = values[2 : 2 + n]
    cursor = 2 + n
    operations = []
    for _ in range(q):
        kind, first, second = values[cursor : cursor + 3]
        cursor += 3
        if kind == 2:
            operations.extend((2, first, first))
        else:
            operations.extend((kind, first, second))
    assert cursor == len(values)
    return (
        f"{n} {q}\n"
        + " ".join(map(str, prices))
        + "\n"
        + "\n".join(
            " ".join(map(str, operations[i : i + 3]))
            for i in range(0, len(operations), 3)
        )
        + "\n"
    )


def direct_oracle(text):
    """Forward, deliberately simple simulation used only on small inputs."""
    values = list(map(int, text.split()))
    n, q = values[:2]
    prices = values[2 : 2 + n]
    cursor = 2 + n
    for _ in range(q):
        kind, first, second = values[cursor : cursor + 3]
        cursor += 3
        if kind == 1:
            prices[first - 1] = second
        else:
            assert second == first, "source type-2 rows repeat the threshold"
            prices = [max(price, first) for price in prices]
    return " ".join(map(str, prices)) + "\n"


def run_program(path, input_text, code=None):
    if code is None:
        source = path
        temporary = None
    else:
        temporary = tempfile.TemporaryDirectory(prefix="doordash4-mutant-")
        source = Path(temporary.name) / "mutant.py"
        source.write_text(code, encoding="utf-8")
    try:
        result = subprocess.run(
            [sys.executable, "-I", str(source)],
            input=input_text,
            text=True,
            capture_output=True,
            timeout=20,
            check=True,
        )
        return result.stdout.strip().split()
    finally:
        if temporary is not None:
            temporary.cleanup()


def large_boundary_case():
    n = q = 100_000
    operations = [f"1 {index} {index}" for index in range(1, 50_001)]
    operations.extend(f"2 {threshold} {threshold}" for threshold in range(1, 50_001))
    input_text = (
        f"{n} {q}\n"
        + " ".join(["1"] * n)
        + "\n"
        + "\n".join(operations)
        + "\n"
    )
    return {
        "name": "本站边界 n=q=100000",
        "input": input_text,
        "expectedOutput": ("50000 " * (n - 1)) + "50000\n",
        "hidden": True,
        "weight": 1,
    }


def main():
    catalog = read_json(CATALOG)
    source_items = {item["id"]: item for item in catalog["items"]}
    source = source_items[TARGET_ID]
    canonical = source_items[SOURCE_ID]
    assert source["companySlug"] == canonical["companySlug"] == "doordash"
    assert source["sourceUrl"].endswith("#4-discount-events")
    assert canonical["sourceUrl"].endswith("#1-adjust-prices")
    assert source["contentHash"] == "129cf5e454586707eb0e470ed707c84a84c2dcbd373bd8f6ff3ef00389741977"

    canonical_package = read_json(OA / "packages" / f"{SOURCE_ID}.json")
    package = copy.deepcopy(canonical_package)
    problem = package["problem"]
    problem["id"] = TARGET_ID
    problem["title"] = "Discount Events（DoorDash #4）"
    problem["tags"] = ["OA", "DoorDash", "数组", "倒序"]
    problem["description"] = (
        "本题与 DoorDash #1 Adjust Prices 的操作语义相同；保留 #4 的原编号和公司标签。"
        "操作 1 x v 将第 x 项设为 v；操作 2 v v 将低于 v 的价格提高到 v。"
        "原始样例保留为公开样例 1；本站另设两个样例。来源没有给出约束和标准输入格式，"
        "页面明确列出的边界与输入协议均为 CSWork 补充。"
    )
    problem["input"] = (
        "首行 n q，第二行 n 个初始价格，之后 q 行各含三个整数。"
        "操作 1 x v 表示单点赋值；操作 2 v v 表示全局下限（第三个 v 按来源格式重复）。"
        "CSWork 补充范围：1≤n,q≤100000，所有价格与 v 在 1..10^9；下标从 1 开始。"
    )
    problem["output"] = "输出依次执行所有操作后的 n 个价格。"
    problem["explanation"] = "题解按该编号与原始样例单独编写，见配套题解。"

    cases = copy.deepcopy(canonical_package["cases"])
    for case in cases:
        case["input"] = normalize_input(case["input"])
    cases[0] = {
        "name": "OAMaster 原样例 1",
        "input": "3 3\n7 5 4\n2 6 6\n1 2 9\n2 8 8\n",
        "expectedOutput": "8 9 8\n",
        "hidden": False,
        "weight": 1,
    }
    cases[1]["name"] = "本站样例 2：单元素与上调"
    cases[2]["name"] = "本站样例 3：单点赋值可低于之前的下限"
    cases.extend([large_boundary_case()])
    package["cases"] = cases

    reference_path = OA / "references" / f"{TARGET_ID}.py"
    reference = (OA / "references" / f"{SOURCE_ID}.py").read_text(
        encoding="utf-8"
    )
    reference_path.write_text(reference, encoding="utf-8")
    assert run_program(reference_path, cases[0]["input"]) == ["8", "9", "8"]

    rng = random.Random(20261006)
    oracle = []
    seen = set()
    while len(oracle) < 120:
        n = rng.randint(1, 8)
        q = rng.randint(1, 25)
        prices = [rng.randint(1, 100) for _ in range(n)]
        operations = []
        for _ in range(q):
            if rng.randrange(2):
                operations.append(
                    (1, rng.randint(1, n), rng.randint(1, 100))
                )
            else:
                threshold = rng.randint(1, 100)
                operations.append((2, threshold, threshold))
        input_text = (
            f"{n} {q}\n"
            + " ".join(map(str, prices))
            + "\n"
            + "\n".join(" ".join(map(str, row)) for row in operations)
            + "\n"
        )
        if input_text in seen:
            continue
        seen.add(input_text)
        expected = direct_oracle(input_text)
        assert run_program(reference_path, input_text) == expected.strip().split()
        oracle.append({"input": input_text, "expectedOutput": expected})

    for case_index, case in enumerate(cases, start=1):
        expected = case["expectedOutput"].strip().split()
        actual = run_program(reference_path, case["input"])
        assert actual == expected, (case["name"], case_index, actual[:8], expected[:8])
    assert len(cases) >= 30
    assert sum(not case["hidden"] for case in cases) == 3
    assert sum(case["hidden"] for case in cases) >= 20
    assert max(len(case["input"].encode()) for case in cases) < 4 * 1024 * 1024

    mutants = read_json(OA / "mutants" / f"{SOURCE_ID}.json")
    negative_controls = []
    for index, mutant in enumerate(mutants, start=1):
        rejected = []
        for case_index, case in enumerate(cases, start=1):
            actual = run_program(reference_path, case["input"], mutant["code"])
            if actual != case["expectedOutput"].strip().split():
                rejected.append(case_index)
                break
        assert rejected, f"formal cases did not detect mutant {mutant['name']}"
        path = OA / "negative-controls" / f"{TARGET_ID}-{index}.py"
        path.write_text(mutant["code"], encoding="utf-8")
        negative_controls.append(
            {
                "file": str(path.relative_to(ROOT)),
                "description": mutant["name"],
                "rejectedByCases": rejected,
            }
        )

    package_path = OA / "packages" / f"{TARGET_ID}.json"
    write_json(package_path, package)
    write_json(OA / "oracles" / f"{TARGET_ID}.json", oracle)
    write_json(OA / "mutants" / f"{TARGET_ID}.json", mutants)

    editorial = {
        "schemaVersion": 1,
        "id": TARGET_ID,
        "title": problem["title"],
        "explanation": (
            "## 思路\n\n"
            "倒序处理操作，维护尚未覆盖到的全局下限 `floor`。每个位置只需记录反向遇到的第一个单点赋值；"
            "若没有单点赋值，则取初始价格与最终下限的较大值。\n\n"
            "## 正确性证明\n\n"
            "全局下限操作在正向时间上只会提高价格。反向扫描时，累计的 `floor` 恰好是某次单点赋值之后"
            "可能作用到该位置的所有下限中的最大值。该位置最后一次单点赋值之后的下限已被纳入 `floor`，"
            "故其最终值为 `max(赋值, floor)`；若不存在赋值，所有下限都作用于初始值，结果为"
            "`max(初始值, floor)`。逐位置独立计算即得到唯一最终数组。\n\n"
            "## 复杂度\n\n时间 O(n+q)，空间 O(n+q)。"
        ),
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source["sourceUrl"],
        "sourceContentHash": source["contentHash"],
        "sourceNote": (
            "来源固定为 OAMaster 提交 e66f809。与同站 DoorDash #1 的规则相同，但保留原 #4 编号。"
            "DoorDash #4 原题给出的约束未知；本题数值上限和 stdin/stdout 格式均明确标为 CSWork 补充。"
            "公开样例 1 为 OAMaster 原例，样例 2、3 为 CSWork 补充。"
        ),
        "author": "CSWork",
    }
    write_json(OA / "editorials" / f"{TARGET_ID}.json", editorial)

    entry = {
        "id": TARGET_ID,
        "sourceContentHash": source["contentHash"],
        "packageChecksum": digest(
            json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
        ),
        "editorial": editorial["explanation"],
        "authoredSolutions": [{"language": "python", "code": reference}],
    }
    write_json(
        OA / "batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [entry]}
    )
    write_json(
        OA / "validation" / f"{BATCH}.json",
        {
            "schemaVersion": 1,
            "seed": 20261006,
            "sourceCommit": SOURCE_COMMIT,
            "note": (
                "OAMaster #4 原例逐步模拟得 [8,9,8]；120 个固定种子小输入由直接正向模拟独立求值。"
                "34 个正式用例均运行参考程序，包括 n=q=100000 的本站边界；两个正常退出错误程序均被识别。"
                "此文件是本地验证，不代表真实 GoJudge 验证。"
            ),
            "problems": [
                {
                    "id": TARGET_ID,
                    "oracleCases": len(oracle),
                    "formal": len(cases),
                    "publicCases": sum(not case["hidden"] for case in cases),
                    "hiddenCases": sum(case["hidden"] for case in cases),
                    "negativeControls": negative_controls,
                    "maxFormalInputBytes": max(
                        len(case["input"].encode()) for case in cases
                    ),
                }
            ],
        },
    )
    write_json(
        OA / "source-evidence" / f"{BATCH}.json",
        {
            "schemaVersion": 1,
            "id": TARGET_ID,
            "sourceCommit": SOURCE_COMMIT,
            "sourceUrl": source["sourceUrl"],
            "sourceContentHash": source["contentHash"],
            "rawSourcePath": SOURCE_PATH,
            "rawSourceBlob": SOURCE_BLOB,
            "duplicateOf": SOURCE_ID,
            "duplicateSourceUrl": canonical["sourceUrl"],
            "duplicateSourceContentHash": canonical["contentHash"],
            "duplicateRawSourcePath": CANONICAL_PATH,
            "duplicateRawSourceBlob": CANONICAL_BLOB,
            "equivalence": {
                "rule": "两题均为两类查询：1 x v 将第 x 项设为 v；2 v v 将所有小于 v 的值改为 v。",
                "function": "DoorDash #4 为 getFinalPrice，#1 为 adjustPrices；仅函数名不同，输入数据结构与返回最终价格数组的语义相同。",
                "constraints": "固定来源提交中的 #1 与 #4 都未给出可执行约束；本题的 1≤n,q≤100000、1≤price[i],v≤10^9 是 CSWork 标注的范围，不冒称来源约束。",
                "sourceSample": "#4 原样例 price=[7,5,4]、queries=[[2,6,6],[1,2,9],[2,8,8]]，逐步计算为 [8,9,8]；题包保留该样例并使用来源的重复参数形式 2 v v。",
                "inputSupplement": "n q、价格数组和 q 行查询的 stdin/stdout 顺序是 CSWork 补充；对类型 2 保留原题格式 2 v v，不把第三字段解释为另一参数。",
                "verification": "已检视提交 e66f809 两个 raw Markdown 的全部题意、函数签名、约束标注和示例；核心操作逐项相同。原始约束均未知，因此范围只由本站补充。",
            },
        },
    )
    write_json(
        OA / "resolutions" / f"{BATCH}.json",
        {
            "schemaVersion": 1,
            "items": [
                {
                    "id": TARGET_ID,
                    "batch": BATCH,
                    "sourceContentHash": source["contentHash"],
                    "previousReason": OLD_REASON,
                    "reason": (
                        "原始 DoorDash #4 与 #1 的两类查询规则完全相同；固定来源确认 #4 的样例能按规则得到 [8,9,8]。"
                        "为覆盖原站编号，将 #4 作为独立公司条目保留并在题面标出同题；缺失的来源约束与输入格式明确标作本站补充。"
                        "34 个正式用例（含来源样例及 n=q=100000 边界）、120 个独立正向模拟 oracle 和两个正常退出错误程序通过本地验证；GoJudge 证据另行绑定。"
                    ),
                }
            ],
        },
    )
    print(
        json.dumps(
            {
                "event": "doordash4_alias_generated",
                "formal": len(cases),
                "oracle": len(oracle),
                "mutants": len(mutants),
                "maxFormalInputBytes": max(
                    len(case["input"].encode()) for case in cases
                ),
            }
        )
    )


if __name__ == "__main__":
    main()
