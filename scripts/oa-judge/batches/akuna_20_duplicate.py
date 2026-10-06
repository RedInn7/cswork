#!/usr/bin/env python3
"""Prepare Akuna Capital #20 by reusing verified Goldman Sachs #22."""

import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3] / "content" / "oa-judge"
CATALOG = ROOT.parent / "oa-master" / "catalog.json"
SOURCE_ID = "oa-goldman-sachs-22"
TARGET_ID = "oa-akuna-capital-20"
BATCH = "akuna-20-duplicate"
SOURCE_HASH = "729f5cfe3c44aa8a825ecb9b9d4a23893a8c8350798b4f0775caf74925b6c8d9"
OLD_REASON = "题意没有说明会议是否必须按输入顺序、是否可重排，以及‘保持正数’约束是在每场之后还是仅统计正值场次；不同解释会改变最优答案。"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    catalog = read_json(CATALOG)
    by_id = {item["id"]: item for item in catalog["items"]}
    source, target = by_id[SOURCE_ID], by_id[TARGET_ID]
    assert target["contentHash"] == SOURCE_HASH
    assert source["companySlug"] == "goldman-sachs"
    assert target["companySlug"] == "akuna-capital"

    package = read_json(ROOT / "packages" / f"{SOURCE_ID}.json")
    package["problem"]["id"] = TARGET_ID
    package["problem"]["title"] = "保持正向指数的最多会议数"
    package["problem"]["tags"] = ["OA", "Akuna Capital", "贪心", "堆"]
    package["problem"]["description"] = (
        "初始 effectiveness index 为 0。每场会议使指数增加或减少 effectiveness[i]。"
        "可以任意选择并重排会议；每场被安排的会议结束后，指数都必须严格大于 0。"
        "求最多能安排多少场会议。\n\n"
        "本题使用 CSWork 标准输入输出格式。Akuna #20 与 Goldman Sachs #22 题意和范围相同；"
        "由于 Akuna 原页没有样例，下面的说明样例取自 #22，用来明确会议可重排。"
    )
    package["problem"]["explanation"] = "示例取自题意相同的 Goldman Sachs #22；其排程顺序说明会议可以重排。"
    write_json(ROOT / "packages" / f"{TARGET_ID}.json", package)

    registry = read_json(ROOT / "registry.json")["items"]
    source_entry = next(item for item in registry if item["id"] == SOURCE_ID)
    authored = copy.deepcopy(source_entry)
    authored["id"] = TARGET_ID
    authored["sourceContentHash"] = SOURCE_HASH

    for folder, suffix in (("references", ".py"), ("oracles", ".json"), ("mutants", ".json")):
        src = ROOT / folder / f"{SOURCE_ID}{suffix}"
        dst = ROOT / folder / f"{TARGET_ID}{suffix}"
        dst.write_bytes(src.read_bytes())

    for i in (1, 2):
        src = ROOT / "negative-controls" / f"{SOURCE_ID}-{i}.py"
        dst = ROOT / "negative-controls" / f"{TARGET_ID}-{i}.py"
        dst.write_bytes(src.read_bytes())

    editorial = read_json(ROOT / "editorials" / f"{SOURCE_ID}.json")
    editorial["id"] = TARGET_ID
    editorial["title"] = package["problem"]["title"]
    editorial["sourceUrl"] = target["sourceUrl"]
    editorial["sourceContentHash"] = SOURCE_HASH
    editorial["sourceNote"] = "题面语义同 Goldman Sachs #22；唯一官方样例来自该同文题并明确可重排。"
    write_json(ROOT / "editorials" / f"{TARGET_ID}.json", editorial)

    authored["packageChecksum"] = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode())
    authored["editorial"] = editorial["explanation"]
    write_json(ROOT / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [authored]})

    old_validation = read_json(ROOT / "validation" / "goldman-sachs-remaining.json")
    evidence = copy.deepcopy(next(item for item in old_validation["problems"] if item["id"] == SOURCE_ID))
    evidence["id"] = TARGET_ID
    evidence["negativeControls"] = [
        {**item, "file": f"content/oa-judge/negative-controls/{TARGET_ID}-{i + 1}.py"}
        for i, item in enumerate(evidence["negativeControls"])
    ]
    write_json(ROOT / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": old_validation["seed"],
        "note": "Local duplicate-package checks only; GoJudge acceptance is pending.",
        "problems": [evidence],
    })

    review_path = ROOT / "reviews" / "akuna-next.json"
    review = read_json(review_path)
    previous = next(item for item in review["items"] if item["id"] == TARGET_ID)
    write_json(ROOT / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": TARGET_ID,
            "batch": BATCH,
            "sourceContentHash": SOURCE_HASH,
            "previousReason": OLD_REASON,
            "reason": "Akuna #20 与 Goldman Sachs #22 的题干及范围一致。#22 的官方样例给出重排 [3,-2,1,-20]，明确最大化满足每一步指数严格为正的会议数。复用其独立参考程序、oracle、正式测试与错误程序；待本题 GoJudge 验证后开放。",
        }],
    })
    write_json(ROOT / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "id": TARGET_ID,
        "sourceContentHash": SOURCE_HASH,
        "sourceUrl": target["sourceUrl"],
        "duplicateOf": SOURCE_ID,
        "duplicateSourceUrl": source["sourceUrl"],
        "rawSourceEvidence": {
            key: previous[key]
            for key in ("sourceCommit", "rawPath", "rawGitBlob", "catalogContentHash")
        },
        "equivalence": {
            "rule": "初始指数为0，会议可重排，最大化每场后指数严格为正的会议数。",
            "constraints": "n <= 100000; -1e9 <= effectiveness[i] <= 1e9; both statements match.",
            "sample": "Akuna #20 has no sample; the identical Goldman Sachs #22 example explicitly demonstrates reordering.",
        },
    })
    print(json.dumps({"candidate": TARGET_ID, "formal": len(package["cases"]), "oracle": len(read_json(ROOT / "oracles" / f"{TARGET_ID}.json")), "packageSha256": authored["packageChecksum"]}))


if __name__ == "__main__":
    main()
