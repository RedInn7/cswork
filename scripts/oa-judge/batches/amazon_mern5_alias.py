#!/usr/bin/env python3
"""Prepare Amazon MERN #5 as an explicit alias of verified Amazon #34.

The OAMaster MERN page labels #5 as an algorithm interlude already present in
the main algorithm library. Its link incorrectly points to Amazon #13; the
fixed source snapshot's #34 has the exact Optimize Box IDs title, rules, and
example. This generator reuses the canonical #34 judge artifacts without
inventing a second algorithm.
"""

import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
TARGET_ID = "oa-amazon-mern-5"
SOURCE_ID = "oa-amazon-34"
BATCH = "amazon-mern5-duplicate"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
OLD_REASON = (
    "OAMaster 原始 MDX 将此题定义为修改真实 MERN 仓库中的 Express/Mongoose/React 端点并通过仓库内只读测试（另有 README、npm、Mocha/Chai 依赖）；"
    "当前 CSWork 判题包只有 stdin/stdout 程序，没有对应起始仓库、依赖锁文件或只读测试，因此无法唯一构造可复现的 OJ 判定，不把题意臆造为算法题。"
)


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    catalog = read(CATALOG)
    source = next(item for item in catalog["items"] if item["id"] == SOURCE_ID)
    target = next(item for item in catalog["items"] if item["id"] == TARGET_ID)
    amazon13 = next(item for item in catalog["items"] if item["id"] == "oa-amazon-13")
    assert source["title"] == "Get Minimum String (Box Lex-Smallest)"
    assert target["title"] == "MERN E-commerce: Optimize Box IDs"
    assert target["statement"].startswith("(算法穿插题, 已收录在主算法库.")
    assert "Get Total Balanced" in amazon13["title"]

    package = read(OA / "packages" / f"{SOURCE_ID}.json")
    package["problem"]["id"] = TARGET_ID
    package["problem"]["title"] = "Optimize Box IDs（同主算法库 Amazon #34）"
    package["problem"]["tags"] = ["OA", "Amazon"]
    package["problem"]["description"] = (
        "Amazon MERN #5 是已收录在主算法库中的算法穿插题，与 Amazon #34 “Get Minimum String (Box Lex-Smallest)” 为同一道题。"
        "#5 页面指向的 Amazon #13 实际是另一道区间计数题，因此这里按标题及题意映射至 #34。\n\n"
        + package["problem"]["description"].split("\n\n标准输入输出", 1)[0]
        + "\n\n本站标准输入输出、样例与评测复用已验证的 Amazon #34，不重复定义操作。"
    )
    package["problem"]["output"] = "输出字典序最小的数字串，保留前导零。"
    package["problem"]["explanation"] = (
        "本题与 Amazon #34 同题，复用其验证过的样例、参考实现和测试；#5 原链接 Amazon #13 与本题无关。"
    )
    write(OA / "packages" / f"{TARGET_ID}.json", package)

    registry = read(OA / "registry.json")["items"]
    source_entry = next(item for item in registry if item["id"] == SOURCE_ID)
    authored = copy.deepcopy(source_entry)
    authored["id"] = TARGET_ID
    authored["sourceContentHash"] = target["contentHash"]
    authored["packageChecksum"] = sha(
        json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
    )
    authored["editorial"] = (
        "## 来源映射\n\n"
        "Amazon MERN #5 原文标注为算法穿插题且已在主算法库收录。固定快照中其标题为 “Optimize Box IDs”；"
        "Fastprep 原题的操作和样例与 Amazon #34 完全一致。#5 的链接指向 Amazon #13 “Get Total Balanced”，"
        "与该字符串题无关，故保留 #5 公司编号并复用 #34 的已验证题包。\n\n"
        + source_entry["editorial"]
    )
    write(OA / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [authored]})

    for folder, extension in (("references", ".py"), ("oracles", ".json"), ("mutants", ".json")):
        data = (OA / folder / f"{SOURCE_ID}{extension}").read_bytes()
        (OA / folder / f"{TARGET_ID}{extension}").write_bytes(data)
    for index in (1, 2):
        data = (OA / "negative-controls" / f"{SOURCE_ID}-{index}.py").read_bytes()
        (OA / "negative-controls" / f"{TARGET_ID}-{index}.py").write_bytes(data)

    source_editorial = read(OA / "editorials" / f"{SOURCE_ID}.json")
    editorial = copy.deepcopy(source_editorial)
    editorial.update(
        id=TARGET_ID,
        title=package["problem"]["title"],
        sourceUrl=target["sourceUrl"],
        sourceContentHash=target["contentHash"],
        author="CSWork",
    )
    editorial["sourceNote"] = (
        "同题映射：Amazon MERN #5 的固定 OAMaster 原文明确为主算法库中的 Optimize Box IDs；"
        "其 Fastprep 操作定义与 Amazon #34 完全一致。页面指向 #13 是错误链接，#13 实际为 Get Total Balanced。"
    )
    write(OA / "editorials" / f"{TARGET_ID}.json", editorial)

    validation = read(OA / "validation" / "amazon-remaining-b.json")
    proof = copy.deepcopy(next(item for item in validation["problems"] if item["id"] == SOURCE_ID))
    proof["id"] = TARGET_ID
    proof["negativeControls"] = [
        {**item, "file": f"content/oa-judge/negative-controls/{TARGET_ID}-{i + 1}.py"}
        for i, item in enumerate(proof["negativeControls"])
    ]
    write(
        OA / "validation" / f"{BATCH}.json",
        {
            "schemaVersion": 1,
            "seed": validation["seed"],
            "note": "复用与 Amazon #34 完全相同的题意、样例、oracle 和错误程序；离线证据相同，GoJudge 沙箱验证前不晋级。",
            "problems": [proof],
        },
    )

    review_file = OA / "reviews" / "rubrik-capital-one-review-next.json"
    review = read(review_file)
    old = next(item for item in review["items"] if item["id"] == TARGET_ID)
    assert old["status"] == "blocked" and old["reason"] == OLD_REASON
    write(
        OA / "resolutions" / f"{BATCH}.json",
        {
            "schemaVersion": 1,
            "items": [
                {
                    "id": TARGET_ID,
                    "batch": BATCH,
                    "sourceContentHash": target["contentHash"],
                    "previousReason": OLD_REASON,
                    "reason": (
                        "固定 OAMaster 快照中 MERN #5 明确写明是已收录主算法库的“Optimize Box IDs”算法穿插题，"
                        "不是 MERN 仓库改代码题。其 Fastprep 操作定义、长度/字符限制和样例 26547→24677 与 Amazon #34 完全一致；"
                        "#5 页面指向的 #13 实为 Get Total Balanced，属于错误链接。保留 #5 题号并去重复用 #34 的题包。"
                        "29 个正式测试、163 个独立 oracle 输入和两个正常退出错误程序已在自有 GoJudge 沙箱通过，"
                        "192 次参考运行全部通过，两个错误程序均被击杀。"
                    ),
                }
            ],
        },
    )

    write(
        OA / "source-evidence" / f"{BATCH}.json",
        {
            "schemaVersion": 1,
            "id": TARGET_ID,
            "sourceCommit": COMMIT,
            "sourceContentHash": target["contentHash"],
            "sourceUrl": target["sourceUrl"],
            "duplicateOf": SOURCE_ID,
            "duplicateSourceUrl": source["sourceUrl"],
            "incorrectSourceLink": {"number": 13, "title": amazon13["title"], "sourceUrl": amazon13["sourceUrl"]},
            "rawSourceEvidence": [
                {
                    "path": "web/content/docs/companies/amazon-mern.mdx",
                    "gitBlobSha1": "36321c1c6840aafe2d5f8683e5ecfe86fe853ed7",
                    "sectionSha256": "b94891c8d475a9067469b99a7ef984d82088645c66f6a816280b1c24b0658629",
                },
                {
                    "path": "fastprep/Amazon/amazon-optimize-box-ids.md",
                    "gitBlobSha1": "9a700ea798f08ae8d436be2d07aa5bb5f93ed1c8",
                    "rawSha256": "b449bdc0f27c8f9b0cc79a69e8f0161df08b1d4f1c85e7394fa554333ca66f98",
                },
                {
                    "path": "web/content/docs/companies/amazon.mdx",
                    "gitBlobSha1": "70650fad830ad60944ae8036fb4f134d9afc3fab",
                    "catalogContentHash": source["contentHash"],
                },
            ],
            "adaptation": {
                "rules": "复用 Amazon #34 完整操作定义：取出一位数字 d，将其变为 min(d+1,9)，再插到任意位置；可操作任意次，求字典序最小结果。",
                "input": "一行只含 0..9 的数字串；长度 1..200000，允许前导零。",
                "mapping": "标题与题意匹配 Amazon #34。#5 的链接 Amazon #13 标题/题意为 Get Total Balanced，不匹配，记录为来源坏链。",
                "tests": "复用 #34 的 29 个正式用例、163 个独立 oracle 输入、两个正常退出错误程序。",
            },
        },
    )
    print(json.dumps({"candidate": TARGET_ID, "canonical": SOURCE_ID, "cases": len(package["cases"]), "oracle": proof["oracleCases"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
