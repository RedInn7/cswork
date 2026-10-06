#!/usr/bin/env python3
"""Build and independently validate MathWorks #21 as a source-backed alias."""

import copy
import hashlib
import json
import random
import subprocess
import sys
from collections import deque
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
SOURCE_ID = "oa-snowflake-15"
TARGET_ID = "oa-mathworks-21"
BATCH = "mathworks-21-alias"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "fastprep/MathWorks/mathworks-get-minimum-operations.md"
SOURCE_BLOB = "5188e314031c35b1735a4c4d3c6c2f0b4951dec6"
DUPLICATE_PATH = "fastprep/Snowflake/get-minimum-operations.md"
DUPLICATE_BLOB = "786561478dd593bea13597f7047792051011d972"
OLD_REASON = "关键规则在 ‘where y’ 后截断，缺少 x/y 关系。"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def digest(value):
    return hashlib.sha256(value).hexdigest()


def brute_force(times, x, y):
    start = tuple(times)
    queue = deque([(start, 0)])
    seen = {start}
    while queue:
        state, distance = queue.popleft()
        if not any(state):
            return distance
        for major, remaining in enumerate(state):
            if remaining == 0:
                continue
            next_state = tuple(
                max(0, value - y - (x - y if index == major else 0))
                for index, value in enumerate(state)
            )
            if next_state not in seen:
                seen.add(next_state)
                queue.append((next_state, distance + 1))
    raise AssertionError("all jobs must eventually complete")


def encode(times, x, y):
    return f"{len(times)} {x} {y}\n" + " ".join(map(str, times)) + "\n"


def run_python(path, code, input_text):
    source = path
    if code is not None:
        source = path.with_suffix(".mutant.py")
        source.write_text(code, encoding="utf-8")
    try:
        result = subprocess.run(
            [sys.executable, "-I", str(source)],
            input=input_text,
            text=True,
            capture_output=True,
            timeout=8,
            check=True,
        )
        return result.stdout.strip().split()
    finally:
        if code is not None:
            source.unlink(missing_ok=True)


def main():
    catalog = read_json(CATALOG)
    source_items = {item["id"]: item for item in catalog["items"]}
    source = source_items[TARGET_ID]
    canonical = source_items[SOURCE_ID]
    assert source["companySlug"] == "mathworks"
    assert canonical["companySlug"] == "snowflake"
    assert source["sourceUrl"].endswith("#21-job-execution")

    canonical_package = read_json(OA / "packages" / f"{SOURCE_ID}.json")
    package = copy.deepcopy(canonical_package)
    problem = package["problem"]
    problem["id"] = TARGET_ID
    problem["title"] = "并行任务执行的最少操作数（MathWorks #21）"
    problem["tags"] = ["OA", "MathWorks", "二分", "贪心"]
    problem["description"] = (
        "每轮选择一个任务作为主任务执行 x 秒，其余任务各执行 y 秒；"
        "任务累计执行时间达到所需时间后完成并退出。求全部任务完成所需的最少轮数。"
        "MathWorks #21 原始题面在 OAMaster 页面快照中间截断；固定源码仓库的同版本原始 Markdown "
        "完整写明 y < x，且与 Snowflake #15 的规则、函数签名和约束相同。"
        "下列公开样例和标准输入格式由 CSWork 整理，不是来源样例。"
    )
    problem["input"] = (
        "首行 n x y，第二行 n 个正整数 executionTime。"
        "1≤n≤100000，1≤executionTime[i]≤10^9，1≤y<x≤10^9。"
    )
    problem["output"] = "输出全部任务完成所需的最少操作数。"
    problem["explanation"] = (
        "二分操作数 T。若执行 T 轮，每个任务至少获得 T·y 的基础执行量；"
        "其余需求每次主任务操作额外获得 x−y，因此任务 i 还需被选为主任务 "
        "ceil(max(0, executionTime[i]−T·y)/(x−y)) 次。所需次数总和不超过 T 时可行。"
    )
    problem["hints"] = [
        "对候选轮数 T 计算每项还需要多少次主任务额外执行；总数≤T 即可完成。"
    ]
    package["cases"] = copy.deepcopy(canonical_package["cases"])

    reference_source = OA / "references" / f"{SOURCE_ID}.py"
    reference_path = OA / "references" / f"{TARGET_ID}.py"
    reference = reference_source.read_text(encoding="utf-8")
    reference_path.write_text(reference, encoding="utf-8")

    rng = random.Random(20261006)
    oracle = []
    seen = set()
    while len(oracle) < 120:
        count = rng.randint(1, 4)
        x = rng.randint(2, 9)
        y = rng.randint(1, x - 1)
        times = [rng.randint(1, 10) for _ in range(count)]
        input_text = encode(times, x, y)
        if input_text in seen:
            continue
        seen.add(input_text)
        expected = str(brute_force(times, x, y))
        assert run_python(reference_path, None, input_text) == [expected]
        oracle.append({"input": input_text, "expectedOutput": expected + "\n"})

    for case in package["cases"]:
        assert run_python(reference_path, None, case["input"]) == case[
            "expectedOutput"
        ].strip().split()
    assert len(package["cases"]) >= 30
    assert sum(not case["hidden"] for case in package["cases"]) == 3
    assert sum(case["hidden"] for case in package["cases"]) >= 20
    assert max(len(case["input"].encode()) for case in package["cases"]) < 4 * 1024 * 1024

    mutants = read_json(OA / "mutants" / f"{SOURCE_ID}.json")
    negative_controls = []
    for index, mutant in enumerate(mutants, start=1):
        rejected = []
        for case_index, case in enumerate(package["cases"], start=1):
            actual = run_python(reference_path, mutant["code"], case["input"])
            assert actual, (mutant["name"], case_index, "mutant exited without output")
            if actual != case["expectedOutput"].strip().split():
                rejected.append(case_index)
                break
        assert rejected, f"formal cases did not detect mutant {mutant['name']}"
        control_path = OA / "negative-controls" / f"{TARGET_ID}-{index}.py"
        control_path.write_text(mutant["code"], encoding="utf-8")
        negative_controls.append(
            {
                "file": str(control_path.relative_to(ROOT)),
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
            + problem["explanation"]
            + "\n\n## 正确性证明\n\n"
            "固定 T 时，每个任务先获得 T·y 的执行量；每次被选为主任务再增加 x−y。"
            "因此各任务至少需要上述向上取整次数，总数不超过 T 是必要条件。"
            "若总数不超过 T，按这些次数安排主任务即可完成；可行性随 T 单调，二分得到最小值。"
            "\n\n## 复杂度\n\n时间 O(n log(max executionTime))，存储执行时间数组需 O(n) 额外空间。"
        ),
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source["sourceUrl"],
        "sourceContentHash": source["contentHash"],
        "sourceNote": (
            "题面恢复依据：OAMaster 固定源码提交 e66f809 中的 "
            "fastprep/MathWorks/mathworks-get-minimum-operations.md；" 
            "规则与同提交 Snowflake #15 原始题面完全一致。"
        ),
        "author": "CSWork",
    }
    write_json(OA / "editorials" / f"{TARGET_ID}.json", editorial)

    authored = {
        "id": TARGET_ID,
        "sourceContentHash": source["contentHash"],
        "packageChecksum": digest(
            json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
        ),
        "editorial": editorial["explanation"],
        "authoredSolutions": [{"language": "python", "code": reference}],
    }
    write_json(
        OA / "batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [authored]}
    )
    write_json(
        OA / "validation" / f"{BATCH}.json",
        {
            "schemaVersion": 1,
            "seed": 20261006,
            "sourceCommit": SOURCE_COMMIT,
            "note": (
                "MathWorks #21 与 Snowflake #15 的固定来源规则一致。"
                "120 个有界输入由独立状态搜索求最优轮数；正式用例逐一运行参考程序，"
                "两个正常退出错误程序均由正式用例识别。此文件是本地验证，"
                "GoJudge 报告另行生成。"
            ),
            "problems": [
                {
                    "id": TARGET_ID,
                    "oracleCases": len(oracle),
                    "formal": len(package["cases"]),
                    "publicCases": sum(not case["hidden"] for case in package["cases"]),
                    "hiddenCases": sum(case["hidden"] for case in package["cases"]),
                    "negativeControls": negative_controls,
                    "maxFormalInputBytes": max(
                        len(case["input"].encode()) for case in package["cases"]
                    ),
                }
            ],
        },
    )

    previous = next(
        item
        for item in read_json(OA / "reviews" / "mathworks-next.json")["items"]
        if item["id"] == TARGET_ID
    )
    resolution = {
        "schemaVersion": 1,
        "items": [
            {
                "id": TARGET_ID,
                "batch": BATCH,
                "sourceContentHash": source["contentHash"],
                "previousReason": OLD_REASON,
                "reason": (
                    "MathWorks #21 与 Snowflake #15 的固定来源仓库原始题面在规则、函数签名和完整约束上相同；"
                    "MathWorks 原始 Markdown 明确为 1≤y<x≤10^9，故不依赖截断的网页文本。"
                    "保留来源本身未给的 stdin/stdout 约定并在题面标作本站协议；3 个公开样例也是本站整理。"
                    "120 个独立小状态搜索输入、31 个正式用例和两个正常退出错误程序通过本地核对；"
                    "GoJudge 报告绑定本批次。"
                ),
            }
        ],
    }
    write_json(OA / "resolutions" / f"{BATCH}.json", resolution)
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
            "duplicateRawSourcePath": DUPLICATE_PATH,
            "duplicateRawSourceBlob": DUPLICATE_BLOB,
            "equivalence": {
                "rule": "每轮选一个主任务累计 x 秒，所有其它任务累计 y 秒；累计执行达到 executionTime 后退出；求最少轮数。",
                "function": "getMinimumOperations(int executionTime[n], int x, int y) -> int，两份固定原始题面相同。",
                "constraints": "两份固定原始 Markdown 均为 1≤n≤10^5、1≤executionTime[i]≤10^9、1≤y<x≤10^9。",
                "sourceSamples": "两份固定原始题面均没有样例；题包中的三个公开样例由 CSWork 整理。",
                "inputSupplement": "n x y 与 n 个 executionTime 的 stdin/stdout 顺序是 CSWork 为本平台补充的协议，非来源格式。",
                "verification": "在提交 e66f809 的 MathWorks 与 Snowflake 原始 Markdown 中逐项核对规则、签名和约束；只采用明确写出的 y<x 关系。",
            },
        },
    )
    assert previous["reason"] == OLD_REASON

    print(
        json.dumps(
            {
                "id": TARGET_ID,
                "formal": len(package["cases"]),
                "oracle": len(oracle),
                "killedMutants": len(negative_controls),
            }
        )
    )


if __name__ == "__main__":
    main()
