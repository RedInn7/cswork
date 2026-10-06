#!/usr/bin/env python3
"""Prepare Amazon #223 by adapting the verified Amazon #175 judge.

The candidate adds #223's explicit n field and restricts tests to its
minGap <= 100 domain. It remains offline until a real GoJudge report exists.
"""

import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3] / "content" / "oa-judge"
CATALOG = ROOT.parent / "oa-master" / "catalog.json"
SOURCE_ID = "oa-amazon-175"
TARGET_ID = "oa-amazon-223"
BATCH = "amazon-223-duplicate"
SOURCE_HASH = "7e260f4de7d7074855010b1ee1f9f8c433909bf542a01ed61cf14a9b1bc8fade"
OLD_REASON = "原始e66f809的amazon-get-min-time-two.md未定义minGap为开始时间差还是中间空闲冷却长度，且无样例。aa,gap=1分别可得2或3；来源解法不足以确定核心规则，保留阻塞。"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def transform_input(raw):
    lines = raw.strip().split()
    requests, gap = lines[0], int(lines[1])
    if gap > 100:
        gap = 100
    return f"{len(requests)}\n{requests}\n{gap}\n"


def main():
    catalog = read_json(CATALOG)
    by_id = {item["id"]: item for item in catalog["items"]}
    target = by_id[TARGET_ID]
    source = by_id[SOURCE_ID]
    assert target["contentHash"] == SOURCE_HASH
    assert target["companySlug"] == source["companySlug"] == "amazon"

    package = read_json(ROOT / "packages" / f"{SOURCE_ID}.json")
    package["problem"]["id"] = TARGET_ID
    package["problem"]["title"] = "限流请求的最短处理时间"
    package["problem"]["description"] = (
        "有 n 个请求，每个请求耗时 1 个时间单位，字符串 requests[i] 表示所属地区。"
        "可以任意调整顺序，也可以插入空闲时间；同一地区的两个请求之间必须至少空闲 minGap 个完整时间单位。"
        "求完成全部请求所需的最短时间。\n\n"
        "本题采用 CSWork 整理的标准输入输出格式。间隔语义由题意相同的 Amazon #175 官方样例明确；"
        "下方三个说明样例取自 #175。"
    )
    package["problem"]["input"] = (
        "第一行 n（1 ≤ n ≤ 100000）；第二行长度为 n 的小写字符串 requests；"
        "第三行 minGap（0 ≤ minGap ≤ 100）。"
    )
    for case in package["cases"]:
        case["input"] = transform_input(case["input"])
        fields = case["input"].split()
        if case["hidden"] and int(fields[2]) == 100:
            counts = {char: fields[1].count(char) for char in set(fields[1])}
            max_freq = max(counts.values())
            max_count = sum(freq == max_freq for freq in counts.values())
            case["expectedOutput"] = f"{max(len(fields[1]), (max_freq - 1) * 101 + max_count)}\n"
    package["problem"]["explanation"] = (
        "前三组说明样例来自规则相同的 Amazon #175，用于明确 minGap 表示同类请求之间的空闲时间单位。"
    )
    write_json(ROOT / "packages" / f"{TARGET_ID}.json", package)

    reference = read_json(ROOT / "registry.json")["items"]
    source_entry = next(item for item in reference if item["id"] == SOURCE_ID)
    authored = copy.deepcopy(source_entry)
    authored["id"] = TARGET_ID
    authored["sourceContentHash"] = SOURCE_HASH

    source_code = (ROOT / "references" / f"{SOURCE_ID}.py").read_text(encoding="utf-8")
    reference_code = source_code.replace(
        "s=d[0];gap=int(d[1]);",
        "n=int(d[0]);s=d[1];gap=int(d[2]);assert len(s)==n;",
    )
    assert reference_code != source_code
    authored["authoredSolutions"][0]["code"] = reference_code
    (ROOT / "references" / f"{TARGET_ID}.py").write_text(reference_code, encoding="utf-8")

    oracle = read_json(ROOT / "oracles" / f"{SOURCE_ID}.json")
    for case in oracle:
        case["input"] = transform_input(case["input"])
    write_json(ROOT / "oracles" / f"{TARGET_ID}.json", oracle)

    mutants = read_json(ROOT / "mutants" / f"{SOURCE_ID}.json")
    for mutant in mutants:
        mutant["code"] = mutant["code"].replace(
            "s=d[0];gap=int(d[1]);",
            "n=int(d[0]);s=d[1];gap=int(d[2]);assert len(s)==n;",
        )
    write_json(ROOT / "mutants" / f"{TARGET_ID}.json", mutants)
    for index in (1, 2):
        old = ROOT / "negative-controls" / f"{SOURCE_ID}-{index}.py"
        code = old.read_text(encoding="utf-8").replace(
            "s=d[0];gap=int(d[1]);",
            "n=int(d[0]);s=d[1];gap=int(d[2]);assert len(s)==n;",
        )
        (ROOT / "negative-controls" / f"{TARGET_ID}-{index}.py").write_text(code, encoding="utf-8")

    editorial = read_json(ROOT / "editorials" / f"{SOURCE_ID}.json")
    editorial["id"] = TARGET_ID
    editorial["title"] = package["problem"]["title"]
    editorial["sourceUrl"] = target["sourceUrl"]
    editorial["sourceContentHash"] = SOURCE_HASH
    editorial["sourceNote"] = "间隔单位由题意相同的 Amazon #175 官方样例明确；已验证题包的约束覆盖本题。"
    write_json(ROOT / "editorials" / f"{TARGET_ID}.json", editorial)

    package_checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode())
    authored["packageChecksum"] = package_checksum
    authored["editorial"] = editorial["explanation"]
    write_json(ROOT / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [authored],
    })

    old_validation = read_json(ROOT / "validation" / "amazon-remaining-h.json")
    evidence = copy.deepcopy(next(item for item in old_validation["problems"] if item["id"] == SOURCE_ID))
    evidence["id"] = TARGET_ID
    evidence["maximumCanonicalInputBytesBound"] = 100020
    evidence["negativeControls"] = [
        {**item, "file": f"content/oa-judge/negative-controls/{TARGET_ID}-{i + 1}.py"}
        for i, item in enumerate(evidence["negativeControls"])
    ]
    write_json(ROOT / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": old_validation["seed"],
        "note": "Local adapted-I/O checks only; gap is capped to the source problem's <=100 range. Not GoJudge acceptance evidence.",
        "problems": [evidence],
    })

    review_path = next(path for path in (ROOT / "reviews").glob("*.json") if any(item["id"] == TARGET_ID for item in read_json(path)["items"]))
    previous = next(item for item in read_json(review_path)["items"] if item["id"] == TARGET_ID)
    write_json(ROOT / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": TARGET_ID,
            "batch": BATCH,
            "sourceContentHash": SOURCE_HASH,
            "previousReason": OLD_REASON,
            "reason": "Amazon #223 与 #175 的限流规则同义；#175 的官方样例明确 minGap 是同类请求之间的空闲时间单位。#175 已验证题包覆盖请求长度上限，候选按 #223 增加 n 字段并将间隔测试限制在 0..100。196 个参考与 oracle 用例、正式测试和错误程序仍须本候选完成本地及线上验证后才可开放。",
        }],
    })
    write_json(ROOT / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "id": TARGET_ID,
        "sourceContentHash": SOURCE_HASH,
        "sourceUrl": target["sourceUrl"],
        "duplicateOf": SOURCE_ID,
        "duplicateSourceUrl": source["sourceUrl"],
        "rawSourceEvidence": previous["sourceEvidence"],
        "adaptation": {
            "rule": "同地区请求之间至少空闲 minGap 个完整时间单位，语义由相同题意 #175 的官方排程样例澄清。",
            "input": "本站第一行增加 n，第二行 requests，第三行 minGap，并校验 n == len(requests)。",
            "constraints": "requests 长度 1..100000、字符为小写英文字母、minGap 0..100；测试未超出该范围。",
            "samples": "三个说明样例从题意相同的 Amazon #175 取得，并在适配的 stdin 协议下运行。",
        },
    })
    print(json.dumps({"candidate": TARGET_ID, "formal": len(package["cases"]), "oracle": len(oracle), "packageSha256": package_checksum}))


if __name__ == "__main__":
    main()
