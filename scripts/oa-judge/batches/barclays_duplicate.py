#!/usr/bin/env python3
"""Prepare Barclays #2 as an audited reuse of the verified Google #1 judge.

This creates an offline candidate only. It does not claim GoJudge acceptance
or add the solution to the runtime registry.
"""

import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3] / "content" / "oa-judge"
CATALOG = ROOT.parent / "oa-master" / "catalog.json"
SOURCE_ID = "oa-google-1"
TARGET_ID = "oa-barclays-2"
BATCH = "barclays-duplicate"
SOURCE_HASH = "78ba31d7ed2aeb75a9ef6c7c8afdb1721abb73070cf0f6a311a9468cfc7c10f6"
OLD_REASON = "与另一家公司题完全重复，尚未核实两条上游是否应视为同一题还是分别保留；不重复发布题包。"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    catalog = read_json(CATALOG)
    source = next(item for item in catalog["items"] if item["id"] == TARGET_ID)
    assert source["contentHash"] == SOURCE_HASH
    assert source["companySlug"] == "barclays"

    package = read_json(ROOT / "packages" / f"{SOURCE_ID}.json")
    package["problem"]["id"] = TARGET_ID
    package["problem"]["title"] = "相邻代币得分"
    package["problem"]["tags"] = ["OA", "Barclays", "数组", "模拟"]
    package["problem"]["description"] = (
        "一排有 n 个格子，每格有分值 points[i]，状态 T 表示有代币，E 表示空格。"
        "每个 T 格子贡献自身分值；每一对相邻的 T 格子额外贡献 1 分。求总分。\n\n"
        "本题采用 CSWork 整理的标准输入输出格式；规则、约束和两个公开样例对应 Barclays 原题。"
    )
    package["cases"][0] = {
        "name": "样例 1",
        "input": "5\n3 2 1 2 2\nETTTE\n",
        "expectedOutput": "7\n",
        "hidden": False,
        "weight": 1,
    }
    package["cases"][2] = {
        "name": "补充样例",
        "input": "5\n3 4 5 2 3\nTEETT\n",
        "expectedOutput": "9\n",
        "hidden": False,
        "weight": 1,
    }
    write_json(ROOT / "packages" / f"{TARGET_ID}.json", package)

    for folder, suffix in (("references", ".py"), ("oracles", ".json"), ("mutants", ".json")):
        source_path = ROOT / folder / f"{SOURCE_ID}{suffix}"
        target_path = ROOT / folder / f"{TARGET_ID}{suffix}"
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(source_path.read_bytes())

    for index in (1, 2):
        source_path = ROOT / "negative-controls" / f"{SOURCE_ID}-{index}.py"
        target_path = ROOT / "negative-controls" / f"{TARGET_ID}-{index}.py"
        code = source_path.read_text(encoding="utf-8").replace(SOURCE_ID, TARGET_ID)
        target_path.write_text(code, encoding="utf-8")

    editorial = read_json(ROOT / "editorials" / f"{SOURCE_ID}.json")
    editorial["id"] = TARGET_ID
    editorial["title"] = "相邻代币得分"
    editorial["sourceUrl"] = source["sourceUrl"]
    editorial["sourceContentHash"] = SOURCE_HASH
    editorial["sourceNote"] = "对应 Barclays #2；与已验证的 Google #1 为同一评分规则。"
    write_json(ROOT / "editorials" / f"{TARGET_ID}.json", editorial)

    registry_entry = read_json(ROOT / "registry.json")["items"]
    source_entry = next(item for item in registry_entry if item["id"] == SOURCE_ID)
    authored = copy.deepcopy(source_entry)
    authored["id"] = TARGET_ID
    authored["sourceContentHash"] = SOURCE_HASH
    authored["packageChecksum"] = digest(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode())
    authored["editorial"] = editorial["explanation"]
    write_json(ROOT / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [authored],
    })

    old_validation = read_json(ROOT / "validation.json")
    evidence = copy.deepcopy(next(item for item in old_validation["problems"] if item["id"] == SOURCE_ID))
    evidence["id"] = TARGET_ID
    evidence["negativeControls"] = [
        {
            **control,
            "file": control["file"].replace(SOURCE_ID, TARGET_ID),
        }
        for control in evidence["negativeControls"]
    ]
    write_json(ROOT / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": old_validation["seed"],
        "sourceCommit": old_validation["sourceCommit"],
        "note": "Local authored-code checks only; identical source tests reused from the verified duplicate. This is not a GoJudge acceptance claim.",
        "problems": [evidence],
    })

    write_json(ROOT / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": TARGET_ID,
            "batch": BATCH,
            "sourceContentHash": SOURCE_HASH,
            "previousReason": OLD_REASON,
            "reason": "逐项核对 Barclays #2 与已验证 Google #1：计分规则、输入范围完全一致，两个公开样例也完全相同；复用相同参考程序、163 个独立 oracle 输入、31 个正式测试和两个错误程序，不另造题意。当前仍待真实 GoJudge 验证。",
        }],
    })

    write_json(ROOT / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "id": TARGET_ID,
        "sourceContentHash": SOURCE_HASH,
        "sourceUrl": source["sourceUrl"],
        "duplicateOf": SOURCE_ID,
        "duplicateSourceUrl": next(item for item in catalog["items"] if item["id"] == SOURCE_ID)["sourceUrl"],
        "equivalence": {
            "rule": "每个 T 格子的 points[i] 加分；每一对相邻 T-T 再加 1。",
            "constraints": "1 <= N <= 100; 1 <= points[i] <= 1000; tokens[i] in {E,T}.",
            "sharedPublicExamples": ["ETTTE -> 7", "TTTT -> 11"],
            "verification": "Catalog statements and official source URLs were compared; package reuse preserves the original published examples and adds only cases derived from the identical rule.",
        },
    })

    pkg_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
    print(json.dumps({"candidate": TARGET_ID, "cases": len(package["cases"]), "oracle": 163, "packageSha256": digest(pkg_bytes)}))


if __name__ == "__main__":
    main()
