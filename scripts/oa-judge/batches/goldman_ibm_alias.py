#!/usr/bin/env python3
"""Prepare Goldman Sachs #24 as an offline semantic alias of IBM #55.

Both immutable upstream statements are word-for-word identical in their
problem rules and constraints. The package retains an explicitly disclosed
CSWork-only guarantee that each event sequence is legal; neither upstream
statement supplies that guarantee. This prepares an offline candidate only.
"""

import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[3] / "content" / "oa-judge"
CATALOG = ROOT.parent / "oa-master" / "catalog.json"
SOURCE_ID = "oa-ibm-55"
TARGET_ID = "oa-goldman-sachs-24"
BATCH = "goldman-ibm-alias"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_HASH = "7eaffb814ced0ac93607501947d09c0cb5527c168a2e3e9ee9717964ce9ccd13"
TARGET_HASH = "a19ad065b00c7f50af1241ed7b8ccd17ad7c2edb2c8266a5297d1934f1681895"
SOURCE_BLOB = "a42ac907f772c1782c4fdbf5c9145ff9b19549aa"
TARGET_BLOB = "ef6d198fe91c35934cfbaef0d986beceab15bbd7"
OLD_REASON = (
    "R/L/U 的员工状态前置条件未在原题约束中声明（例如无室内员工时 R/L、"
    "无外出员工时 U 如何处理）；本站若补成合法事件序列将新增关键限制，暂不收录。"
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_solution(path, data):
    return subprocess.run(
        [sys.executable, "-I", str(path)], input=data, text=True,
        capture_output=True, timeout=8, check=True,
    ).stdout.rstrip("\n")


def main():
    catalog = read_json(CATALOG)
    by_id = {item["id"]: item for item in catalog["items"]}
    source, target = by_id[SOURCE_ID], by_id[TARGET_ID]
    assert source["contentHash"] == TARGET_HASH
    assert target["contentHash"] == SOURCE_HASH
    assert source["companySlug"] == "ibm" and target["companySlug"] == "goldman-sachs"
    for field in ("statement",):
        assert source[field] == target[field], f"upstream {field} differs"
    assert source["statement"].count("1 ≤ n ≤ 100") == 1
    assert source["statement"].count("1 ≤ length of each simulation[i] ≤ 10000") == 1

    package = read_json(ROOT / "packages" / f"{SOURCE_ID}.json")
    package["problem"]["id"] = TARGET_ID
    package["problem"]["tags"] = ["OA", "Goldman Sachs", "数组", "模拟"]
    package["problem"]["description"] = (
        package["problem"]["description"].replace("。本站补充：", "。本站补充：")
        + "\n\n题意、函数和约束与 Goldman Sachs #24 原始题面相同。"
        "每条模拟序列均合法是本站为使输出唯一而补充的输入保证，并非原题明示条件。"
        "下列公开样例由本站整理，不是来源样例。"
    )
    write_json(ROOT / "packages" / f"{TARGET_ID}.json", package)

    source_entry = next(item for item in read_json(ROOT / "registry.json")["items"] if item["id"] == SOURCE_ID)
    authored = copy.deepcopy(source_entry)
    authored["id"] = TARGET_ID
    authored["sourceContentHash"] = SOURCE_HASH

    source_reference = ROOT / "references" / f"{SOURCE_ID}.py"
    target_reference = ROOT / "references" / f"{TARGET_ID}.py"
    reference = source_reference.read_text(encoding="utf-8")
    target_reference.write_text(reference, encoding="utf-8")
    authored["authoredSolutions"][0]["code"] = reference

    for folder, suffix in (("oracles", ".json"), ("mutants", ".json")):
        (ROOT / folder / f"{TARGET_ID}{suffix}").write_bytes(
            (ROOT / folder / f"{SOURCE_ID}{suffix}").read_bytes()
        )
    negative_files = []
    for index in (1, 2):
        target_path = ROOT / "negative-controls" / f"{TARGET_ID}-{index}.py"
        target_path.write_bytes((ROOT / "negative-controls" / f"{SOURCE_ID}-{index}.py").read_bytes())
        negative_files.append(target_path)

    editorial = read_json(ROOT / "editorials" / f"{SOURCE_ID}.json")
    editorial["id"] = TARGET_ID
    editorial["sourceUrl"] = target["sourceUrl"]
    editorial["sourceContentHash"] = SOURCE_HASH
    editorial["sourceNote"] = (
        "原始 Goldman Sachs #24 与 IBM #55 的规则和约束逐字相同；本站仅在题面显式补充合法事件序列保证。"
    )
    write_json(ROOT / "editorials" / f"{TARGET_ID}.json", editorial)

    oracle = read_json(ROOT / "oracles" / f"{TARGET_ID}.json")
    assert len(oracle) == 163
    for case in oracle:
        assert run_solution(target_reference, case["input"]) == case["expectedOutput"].rstrip("\n")

    mutants = read_json(ROOT / "mutants" / f"{TARGET_ID}.json")
    formal_cases = package["cases"]
    assert sum(not case["hidden"] for case in formal_cases) == 3
    assert sum(case["hidden"] for case in formal_cases) == 31
    negative_controls = []
    for index, mutant in enumerate(mutants):
        rejected = []
        control = negative_files[index]
        for case_index, case in enumerate(formal_cases, 1):
            actual = run_solution(control, case["input"])
            if actual != case["expectedOutput"].rstrip("\n"):
                rejected.append(case_index)
        assert rejected, f"mutant {mutant['name']} survived all formal cases"
        negative_controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    package_checksum = digest(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode())
    authored["packageChecksum"] = package_checksum
    authored["editorial"] = editorial["explanation"]
    write_json(ROOT / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [authored]})

    write_json(ROOT / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": 20261005,
        "sourceCommit": SOURCE_COMMIT,
        "note": "163 个本地参考解/oracle 对照全部通过；3 个公开样例、31 个隐藏用例通过，两个正常退出 mutant 均被拒绝。复用 IBM #55 的合法序列数据与本站输入保证；未运行 GoJudge。",
        "problems": [{
            "id": TARGET_ID,
            "oracleCases": len(oracle),
            "publicCases": 3,
            "hiddenCases": 31,
            "negativeControls": negative_controls,
            "referenceSha256": digest(reference.encode()),
        }],
    })

    write_json(ROOT / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": TARGET_ID,
            "batch": BATCH,
            "sourceContentHash": SOURCE_HASH,
            "previousReason": OLD_REASON,
            "reason": "在固定 OA-Master e66f809 快照中，Goldman Sachs #24 与 IBM #55 的原始规则、函数签名及完整约束逐字一致；两者都未规定员工状态前置条件。保留候选题面中明确标注的本站合法事件序列补充保证，不将其归为原题规则。候选从 IBM #55 的 163 个独立 oracle、3 个本站整理公开样例、31 个隐藏用例和两个正常退出错误程序派生，经本地复验；仍为离线候选，未运行 GoJudge。",
        }],
    })

    write_json(ROOT / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "id": TARGET_ID,
        "sourceCommit": SOURCE_COMMIT,
        "sourceUrl": target["sourceUrl"],
        "sourceContentHash": SOURCE_HASH,
        "rawSourcePath": "fastprep/Goldman Sachs/goldman-min-chair.md",
        "rawSourceBlob": TARGET_BLOB,
        "duplicateOf": SOURCE_ID,
        "duplicateSourceUrl": source["sourceUrl"],
        "duplicateSourceContentHash": TARGET_HASH,
        "duplicateRawSourcePath": "fastprep/IBM/ibm-min-chairs.md",
        "duplicateRawSourceBlob": SOURCE_BLOB,
        "equivalence": {
            "rule": "两份原始题面逐字相同：C/U 为员工进入；R/L 为员工离开室内并释放椅子；从无椅子开始，返回每条模拟至少购买的椅子数。",
            "function": "minChair(string simulation[n]) -> int[n]，签名描述完全相同。",
            "constraints": "两边完整约束均为 1≤n≤100，1≤length of each simulation[i]≤10000。",
            "sourceSamples": "两份固定原始题面均没有样例。候选 3 个公开样例为本站整理，不归属任一来源。",
            "inputSupplement": "两边来源都没有保证事件序列合法。为令 R/L/U 状态无歧义，候选显式增加本站保证：R/L 时室内至少有一名员工，U 时会议室至少有一名员工；不声称是任一原题的规则。",
            "verification": "逐字比较固定提交 e66f809 原始 Markdown 的 Problem Statement 与 Constraints；Goldman blob ef6d198fe91c35934cfbaef0d986beceab15bbd7，IBM blob a42ac907f772c1782c4fdbf5c9145ff9b19549aa。",
        },
    })

    print(json.dumps({
        "candidate": TARGET_ID,
        "batch": BATCH,
        "oracleCases": len(oracle),
        "formalCases": len(formal_cases),
        "mutantsRejected": len(negative_controls),
        "packageSha256": package_checksum,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
