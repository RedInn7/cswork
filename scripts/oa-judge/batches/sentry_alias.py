#!/usr/bin/env python3
"""Prepare Sentry #2 as a source-bound alias of the verified Persona #3 judge.

The candidate is offline-only until it passes GoJudge. Its stdin/stdout format
and boundary constraints are explicit CSWork additions, not claims about the
incomplete OAMaster statement.
"""

from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parents[3]
OA = REPO / "content" / "oa-judge"
CATALOG_PATH = REPO / "content" / "oa-master" / "catalog.json"
MANIFEST_PATH = REPO / "content" / "oa-master" / "manifest.json"
SOURCE_ID = "oa-persona-3"
TARGET_ID = "oa-sentry-2"
BATCH = "sentry-alias"
SOURCE_HASH = "dccdc79813b5710252dcd99604ca7e2ab8510131f4c277942ca570e4c400bbc6"
PREVIOUS_REASON = (
    "这是 Part 2 摘要，未完整保留 Part 1 的网格移动、墙体输入与边界规则；"
    "无法仅凭当前固定快照唯一确定标准输入输出契约。"
)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def run_program(path: Path, inputs: list[str]) -> list[str]:
    result = subprocess.run(
        [sys.executable, "-I", str(REPO / "scripts/oa-judge/local_batch_runner.py"), str(path)],
        input=json.dumps(inputs, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=True,
        timeout=300,
    )
    return json.loads(result.stdout)


def tokens(value: str) -> list[str]:
    return value.split()


def main() -> None:
    catalog = read_json(CATALOG_PATH)
    sentry = next(item for item in catalog["items"] if item["id"] == TARGET_ID)
    persona = next(item for item in catalog["items"] if item["id"] == SOURCE_ID)
    assert sentry["contentHash"] == SOURCE_HASH
    assert sentry["companySlug"] == "sentry"
    assert persona["title"] == sentry["title"]
    assert "treasures=[[0,1]]" in sentry["statement"]

    manifest = read_json(MANIFEST_PATH)
    sentry_page = next(
        item
        for item in manifest["files"]
        if item["file"] == "sentry.mdx"
    )
    persona_page = next(
        item
        for item in manifest["files"]
        if item["file"] == "persona.mdx"
    )

    package = read_json(OA / "packages" / f"{SOURCE_ID}.json")
    package["problem"]["id"] = TARGET_ID
    package["problem"]["title"] = sentry["title"]
    package["problem"]["tags"] = ["OA", "Sentry", "BFS", "动态规划", "网格"]
    package["problem"]["description"] = (
        "给定一个由可通行格和墙组成的网格，以及起点、出口和若干宝藏。"
        "每个宝藏最多拾取一次。求从起点到出口的最少移动步数；在所有最短路径中，"
        "再求最多能收集的宝藏数。无法到达出口时输出 `-1 0`。\n\n"
        "OAMaster 的 Sentry #2 只给出了函数目标和一个示例，没有提供在线判题的标准输入格式或边界。"
        "以下 stdin/stdout 协议与约束是 CSWork 为本题补充的站内定义，不代表 OAMaster 原文。"
    )
    package["problem"]["input"] = (
        "第一行输入 rows cols；第二行输入墙的数量 wallCount；接下来 wallCount 行各输入一个墙坐标 row col；"
        "然后输入宝藏数量 treasureCount；接下来 treasureCount 行各输入一个宝藏坐标 row col；"
        "最后两行分别输入起点和出口坐标。坐标均为 0-based。"
        "站内约束：1 <= rows, cols <= 200；所有坐标均在网格内；起点和出口不是墙；"
        "宝藏坐标互不相同。墙坐标重复时按同一面墙处理。"
    )
    package["problem"]["output"] = (
        "输出两个整数：最少步数和所有最短路径中可收集的最多宝藏数。"
        "起点格上的宝藏计入结果；不可达时输出 `-1 0`。"
    )

    # Keep the Sentry source example as sample 1. The remaining compatible
    # Persona examples are retained as clearly site-authored supplemental cases.
    package["cases"][0]["name"] = "OAMaster 样例"
    package["cases"][1]["name"] = "补充样例 1"
    package["cases"][2]["name"] = "补充样例 2"
    assert package["cases"][0]["input"] == (
        "3 3\n1\n1 1\n1\n0 1\n0 0\n2 2\n"
    )
    assert tokens(package["cases"][0]["expectedOutput"]) == ["4", "1"]

    write_json(OA / "packages" / f"{TARGET_ID}.json", package)

    for folder, suffix in (
        ("references", ".py"),
        ("oracles", ".json"),
        ("mutants", ".json"),
    ):
        (OA / folder / f"{TARGET_ID}{suffix}").write_bytes(
            (OA / folder / f"{SOURCE_ID}{suffix}").read_bytes()
        )
    negative_controls = []
    for index in (1, 2):
        source_path = OA / "negative-controls" / f"{SOURCE_ID}-{index}.py"
        target_path = OA / "negative-controls" / f"{TARGET_ID}-{index}.py"
        target_path.write_text(
            source_path.read_text(encoding="utf-8").replace(SOURCE_ID, TARGET_ID),
            encoding="utf-8",
        )

    editorial = read_json(OA / "editorials" / f"{SOURCE_ID}.json")
    editorial["id"] = TARGET_ID
    editorial["title"] = sentry["title"]
    editorial["sourceUrl"] = sentry["sourceUrl"]
    editorial["sourceContentHash"] = SOURCE_HASH
    editorial["sourceNote"] = (
        "Sentry #2 与已验证 Persona #3 的题目目标、返回值、宝藏规则及唯一公开示例一致。"
        "OAMaster 对 Sentry #2 缺少标准输入输出和范围；本题输入协议、0-based 坐标及 1..200 网格范围为 CSWork 站内补充。"
    )
    write_json(OA / "editorials" / f"{TARGET_ID}.json", editorial)

    source_registry = next(
        item for item in read_json(OA / "registry.json")["items"] if item["id"] == SOURCE_ID
    )
    entry = copy.deepcopy(source_registry)
    entry["id"] = TARGET_ID
    entry["sourceContentHash"] = SOURCE_HASH
    entry["packageChecksum"] = digest(
        json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
    )
    entry["editorial"] = editorial["explanation"]
    write_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [entry],
    })

    oracle = read_json(OA / "oracles" / f"{TARGET_ID}.json")
    assert len({item["input"] for item in oracle}) >= 120
    formal_inputs = [item["input"] for item in package["cases"]]
    oracle_inputs = [item["input"] for item in oracle]
    reference_path = OA / "references" / f"{TARGET_ID}.py"
    reference_oracle_outputs = run_program(reference_path, oracle_inputs)
    reference_formal_outputs = run_program(reference_path, formal_inputs)
    assert all(
        tokens(actual) == tokens(expected["expectedOutput"])
        for actual, expected in zip(reference_formal_outputs, package["cases"])
    )
    assert all(
        tokens(actual) == tokens(expected["expectedOutput"])
        for actual, expected in zip(reference_oracle_outputs, oracle)
    )

    mutants = read_json(OA / "mutants" / f"{TARGET_ID}.json")
    all_inputs = formal_inputs + oracle_inputs
    formal_control_results = []
    for index, mutant in enumerate(mutants, 1):
        mutant_path = OA / "negative-controls" / f"{TARGET_ID}-{index}.py"
        outputs = run_program(mutant_path, all_inputs)
        expected_outputs = reference_formal_outputs + [item["expectedOutput"] for item in oracle]
        rejected = [
            case_index
            for case_index, (actual, expected) in enumerate(zip(outputs, expected_outputs))
            if tokens(actual) != tokens(expected)
        ]
        assert rejected, f"mutant survived all formal and oracle cases: {mutant['name']}"
        formal_control_results.append({
            "name": mutant["name"],
            "rejectedByCases": rejected,
        })
    negative_controls = formal_control_results

    validation = {
        "schemaVersion": 1,
        "seed": 20261006,
        "sourceAlias": SOURCE_ID,
        "note": (
            "Reused the verified Persona #3 reference/oracle/mutants after confirming the identical algorithmic contract and Sentry public example. "
            "CSWork-only input semantics and limits are stated in the package and source evidence. Offline checks only; real GoJudge validation is still required."
        ),
        "problems": [{
            "id": TARGET_ID,
            "oracleCases": len(oracle),
            "uniqueOracleInputs": len({item["input"] for item in oracle}),
            "publicCases": sum(not item["hidden"] for item in package["cases"]),
            "hiddenCases": sum(item["hidden"] for item in package["cases"]),
            "negativeControls": negative_controls,
            "referenceSha256": digest(reference_path.read_bytes()),
            "method": "independent existing oracle outputs checked against adapted package reference; formal cases and both normal-exit mutants executed locally",
        }],
    }
    write_json(OA / "validation" / f"{BATCH}.json", validation)

    review_reason = (
        "Sentry #2 的函数目标、优化顺序（先最少步数，再在最短路径中最大化宝藏数）、不可达返回值和唯一公开示例均与已验证 Persona #3 一致；"
        "将其作为独立 Sentry 来源题保留，并复用同一参考解、120 个独立 oracle 输入、正式用例与两个错误程序。"
        "在线判题所需输入协议及 1..200 网格约束由 CSWork 明确补充，不能视为 OAMaster 原题约束。"
        "离线验证通过，GoJudge 尚未运行。"
    )
    write_json(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": TARGET_ID,
            "batch": BATCH,
            "sourceContentHash": SOURCE_HASH,
            "previousReason": PREVIOUS_REASON,
            "reason": review_reason,
        }],
    })
    write_json(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master",
        "commit": catalog["source"]["commit"],
        "id": TARGET_ID,
        "sourceUrl": sentry["sourceUrl"],
        "sourceContentHash": SOURCE_HASH,
        "rawPage": {
            "path": f"web/content/docs/companies/{sentry_page['file']}",
            "pageSourceHash": sentry_page["sourceHash"],
            "audit": next(row for row in sentry_page["audit"] if row["id"] == TARGET_ID),
        },
        "catalogContentHash": SOURCE_HASH,
        "aliasOf": SOURCE_ID,
        "aliasSource": {
            "sourceUrl": persona["sourceUrl"],
            "sourceContentHash": persona["contentHash"],
            "rawPage": {
                "path": f"web/content/docs/companies/{persona_page['file']}",
                "pageSourceHash": persona_page["sourceHash"],
                "audit": next(row for row in persona_page["audit"] if row["id"] == SOURCE_ID),
            },
        },
        "equivalence": {
            "sharedContract": [
                "four-direction grid movement with walls",
                "minimize path length before maximizing treasure count",
                "each treasure is collected at most once",
                "return (-1, 0) when the exit is unreachable",
                "the only Sentry sample is byte-for-byte the adapted package's first formal input and yields (4, 1)",
            ],
            "sentryOriginalScope": "OAMaster Sentry #2 specifies a Treasure class, escape() returning (min_steps, max_treasures), and one 3x3 example; it does not specify stdin/stdout serialization or numeric bounds.",
            "siteDefinedSemantics": {
                "input": package["problem"]["input"],
                "limits": "1 <= rows, cols <= 200",
                "coordinates": "0-based and in bounds; start/end are not walls; treasure coordinates are unique; duplicate wall coordinates are treated as one wall",
                "startingCellTreasure": "counted once",
            },
        },
        "verification": {
            "oracleCases": len(oracle),
            "uniqueOracleInputs": len({item["input"] for item in oracle}),
            "formalCases": len(package["cases"]),
            "mutants": len(mutants),
            "goJudge": "awaiting_sandbox",
            "note": validation["note"],
        },
    })

    print(json.dumps({
        "candidate": TARGET_ID,
        "status": "awaiting_sandbox",
        "formalCases": len(package["cases"]),
        "oracleCases": len(oracle),
        "uniqueOracleInputs": len({item["input"] for item in oracle}),
        "mutantsKilled": len(negative_controls),
        "sourceContentHash": SOURCE_HASH,
        "packageChecksum": entry["packageChecksum"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
