#!/usr/bin/env python3
"""Generate and locally validate an isolated candidate for Stripe OA #3.

Only oa-stripe-3-specific candidate artifacts are written. Shared reviews,
coverage, registries, and formal batches are intentionally left untouched.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
IDENTIFIER = "oa-stripe-3"
BATCH = "stripe-3-recovered"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/stripe.mdx"
SOURCE_BLOB = "a96a0563731861954d02ac5b50b0f0e3f40bf873"
SOURCE_SHA256 = "b0cecf071f81fd71908e279c4c77f70e56b70411a42d5f082359b697164b69aa"
CATALOG_HASH = "56e6011596ce4573d8a1ef2de3e6dfa1e43589545261f1c2aab6374b128023c5"
SOURCE_URL = "https://oamaster.com/docs/companies/stripe#3-risk-engineering-merchant-clustering"
PREVIOUS_REASON = "聚类目标、特征距离与结果要求不充分。"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw: dict) -> str:
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    result = subprocess.run(
        ["node", "--import", "tsx", "-e", script], cwd=ROOT,
        input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout


REFERENCE = r'''def solve(raw):
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    cursor = 0
    day_count = int(lines[cursor]); cursor += 1
    batches = []
    for _day in range(day_count):
        count = int(lines[cursor]); cursor += 1
        batch = []
        for line in lines[cursor:cursor + count]:
            merchant, link_type, duration = line.split()
            batch.append((merchant, link_type, int(duration)))
        cursor += count
        batches.append(batch)

    active_records = []
    output = []
    for day, batch in enumerate(batches, 1):
        for merchant, link_type, duration in batch:
            active_records.append((merchant, link_type, day, day + duration))

        # The task describes active same-type links as graph connections.
        # Collapse duplicate merchant/type observations to one membership.
        members_by_type = {}
        for merchant, link_type, added, expires in active_records:
            if added <= day < expires:
                members_by_type.setdefault(link_type, set()).add(merchant)

        graph = {}
        for members in members_by_type.values():
            ordered = sorted(members)
            for merchant in ordered:
                graph.setdefault(merchant, set())
            for i, left in enumerate(ordered):
                for right in ordered[i + 1:]:
                    graph[left].add(right)
                    graph[right].add(left)

        visited = set()
        clusters = []
        for start in sorted(graph):
            if start in visited:
                continue
            stack = [start]
            visited.add(start)
            component = []
            while stack:
                merchant = stack.pop()
                component.append(merchant)
                for neighbor in graph[merchant]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        stack.append(neighbor)
            # Highest unique-neighbor degree; equal degree uses the smallest ID.
            pin = min(component, key=lambda merchant: (-len(graph[merchant]), merchant))
            clusters.append((component, pin))

        clusters.sort(key=lambda item: (-len(item[0]), item[1]))
        output.append(f"Day {day}")
        output.extend(f"  cluster size={len(component)} pin={pin}"
                      for component, pin in clusters)
    return "\n".join(output)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def encode(batches: list[list[tuple[str, str, int]]]) -> str:
    lines = [str(len(batches))]
    for batch in batches:
        lines.append(str(len(batch)))
        lines.extend(f"{merchant} {link_type} {duration}"
                     for merchant, link_type, duration in batch)
    return "\n".join(lines) + "\n"


def independent_oracle(raw: str) -> str:
    """Build each daily graph with pairwise matching + DSU, not the reference BFS."""
    lines = [line.split() for line in raw.splitlines() if line.strip()]
    day_count = int(lines[0][0])
    cursor = 1
    records = []
    output = []
    for day in range(1, day_count + 1):
        count = int(lines[cursor][0]); cursor += 1
        today = []
        for row in lines[cursor:cursor + count]:
            merchant, link_type, duration = row
            today.append((merchant, link_type, int(duration)))
        cursor += count
        records.extend((merchant, link_type, day, day + duration)
                       for merchant, link_type, duration in today)

        active = [(merchant, link_type) for merchant, link_type, start, end in records
                  if start <= day < end]
        vertices = {merchant for merchant, _kind in active}
        parent = {merchant: merchant for merchant in vertices}
        neighbors = {merchant: set() for merchant in vertices}

        def find(node):
            while parent[node] != node:
                parent[node] = parent[parent[node]]
                node = parent[node]
            return node

        by_kind = {}
        for merchant, link_type in active:
            by_kind.setdefault(link_type, set()).add(merchant)
        for members in by_kind.values():
            values = sorted(members)
            for i, left in enumerate(values):
                for right in values[i + 1:]:
                    neighbors[left].add(right)
                    neighbors[right].add(left)
                    a, b = find(left), find(right)
                    if a != b:
                        parent[max(a, b)] = min(a, b)

        groups = {}
        for merchant in vertices:
            groups.setdefault(find(merchant), []).append(merchant)
        ranked = []
        for members in groups.values():
            pin = sorted(members, key=lambda merchant: (-len(neighbors[merchant]), merchant))[0]
            ranked.append((members, pin))
        ranked.sort(key=lambda item: (-len(item[0]), item[1]))
        output.append(f"Day {day}")
        output.extend(f"  cluster size={len(members)} pin={pin}" for members, pin in ranked)
    return "\n".join(output)


def run_code(code: str, raw: str) -> str:
    with tempfile.TemporaryDirectory(prefix="stripe3-run-") as directory:
        file = Path(directory) / "solution.py"
        file.write_text(code, encoding="utf-8")
        result = subprocess.run(
            [sys.executable, "-I", str(file)], input=raw, text=True,
            capture_output=True, timeout=5, check=True,
        )
        return result.stdout.rstrip("\n")


def curated_inputs() -> list[str]:
    return [
        # No records: every day still has its header.
        encode([[], [], []]),
        # A shared type creates a complete component; a different type does not.
        encode([[('a', 'email', 3), ('b', 'email', 3), ('c', 'email', 3),
                 ('x', 'phone', 3), ('y', 'phone', 3)], [], []]),
        # One active merchant is a singleton component under the site's explicit graph convention.
        encode([[('solo', 'device', 3)], [], []]),
        # A duration of one expires before day 2; a second day's link merges again.
        encode([[('a', 'shared', 1), ('b', 'shared', 1)],
                [('b', 'later', 2), ('c', 'later', 2)], []]),
        # Expiration splits a component and recomputes degree/pin for each remainder.
        encode([[('a', 'ab', 1), ('b', 'ab', 3), ('b', 'bc', 3), ('c', 'bc', 3),
                 ('c', 'cd', 1), ('d', 'cd', 3)], [], []]),
        # Equal highest degrees use lexicographically smallest ID, not insertion order.
        encode([[('z', 'left', 3), ('b', 'left', 3), ('a', 'right', 3),
                 ('b', 'right', 3)], [], []]),
        # Distinct components sort by size descending then pin ascending.
        encode([[('z9', 'large', 3), ('z1', 'large', 3), ('z2', 'large', 3),
                 ('a9', 'small', 3), ('a1', 'small', 3)], [], []]),
        # Duration zero is never active; repeated type/merchant on later days is allowed.
        encode([[('a', 'edge', 0), ('b', 'edge', 0)],
                [('a', 'edge', 2), ('b', 'edge', 2)], []]),
        # Lexical ID comparison is string ordering, so m10 precedes m2.
        encode([[('m2', 'x', 3), ('m10', 'x', 3)], [], []]),
        # Repeated active membership is collapsed; two types can provide the same edge.
        encode([[('a', 'x', 3), ('b', 'x', 3), ('a', 'y', 3), ('b', 'y', 3)], [], []]),
    ]


def random_input(rng: random.Random) -> str:
    merchant_count = rng.randint(1, 8)
    merchants = [f"m{i}" for i in range(merchant_count)]
    kinds = [f"kind{i}" for i in range(rng.randint(1, 5))]
    batches = []
    for _day in range(3):
        pairs = [(merchant, kind) for merchant in merchants for kind in kinds]
        rng.shuffle(pairs)
        count = rng.randint(0, min(12, len(pairs)))
        batches.append([(merchant, kind, rng.randint(0, 3))
                        for merchant, kind in pairs[:count]])
    return encode(batches)


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == IDENTIFIER)
    assert source["contentHash"] == CATALOG_HASH
    assert source["sourceUrl"] == SOURCE_URL
    raw_blob = subprocess.check_output(
        ["git", "rev-parse", f"{SOURCE_COMMIT}:{SOURCE_PATH}"], cwd=ROOT, text=True,
    ).strip()
    raw_source = subprocess.check_output(
        ["git", "show", f"{SOURCE_COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
    )
    assert raw_blob == SOURCE_BLOB, raw_blob
    assert hashlib.sha256(raw_source).hexdigest() == SOURCE_SHA256
    source_text = raw_source.decode("utf-8")
    assert "Two merchants are connected if they share an active link of the same `link_type`." in source_text
    assert "highest degree (ties → smallest `merchant_id`)" in source_text

    coverage = json.loads((OA / "coverage.json").read_text(encoding="utf-8"))
    state = next(item for item in coverage["items"] if item["id"] == IDENTIFIER)
    assert state["status"] == "blocked", state
    reviews = json.loads((OA / "reviews/stripe-next.json").read_text(encoding="utf-8"))
    prior = next(item for item in reviews["items"] if item["id"] == IDENTIFIER)
    assert prior["status"] == "blocked" and prior["reason"] == PREVIOUS_REASON
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            if folder == "candidate-batches" and path.name == f"{BATCH}.json":
                continue
            document = json.loads(path.read_text(encoding="utf-8"))
            assert all(item["id"] != IDENTIFIER for item in document.get("items", [])), (folder, path)

    formal = curated_inputs()
    # Add fixed-seed formal cases after edge cases; reserve >=20 as hidden.
    formal_rng = random.Random(20261009)
    seen_formal = set(formal)
    while len(formal) < 32:
        raw = random_input(formal_rng)
        if raw not in seen_formal:
            seen_formal.add(raw)
            formal.append(raw)

    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    cases = []
    for index, raw in enumerate(formal):
        expected = independent_oracle(raw)
        actual = run_code(reference, raw)
        assert actual == expected, (index, raw, actual, expected)
        cases.append({
            "name": f"源规则/边界 {index + 1}", "input": raw,
            "expectedOutput": expected + "\n", "hidden": index >= 8, "weight": 1,
        })

    oracle_rng = random.Random(20261010)
    oracle_inputs, oracle_seen = [], set(formal)
    while len(oracle_inputs) < 120:
        raw = random_input(oracle_rng)
        if raw in oracle_seen:
            continue
        oracle_seen.add(raw)
        expected = independent_oracle(raw)
        assert run_code(reference, raw) == expected
        oracle_inputs.append({"input": raw, "expectedOutput": expected + "\n"})
    assert len({item["input"] for item in oracle_inputs}) == 120

    mutants = [
        ("pin 误选最低度数 merchant", REFERENCE.replace(
            "(-len(graph[merchant]), merchant)", "(len(graph[merchant]), merchant)", 1)),
        ("cluster 按成员数升序排列", REFERENCE.replace(
            "(-len(item[0]), item[1])", "(len(item[0]), item[1])", 1)),
    ]
    killed = []
    for name, code in mutants:
        rejects = [index for index, raw in enumerate(formal)
                   if run_code(textwrap.dedent(code).strip() + "\n", raw) != independent_oracle(raw)]
        assert rejects, f"mutant survived: {name}"
        killed.append({"name": name, "rejectedByCases": rejects})

    problem = {
        "id": IDENTIFIER, "courseId": "gomall", "lessonId": "00-overview",
        "title": "商户关联关系的每日聚类", "difficulty": "中等",
        "tags": ["OA", "Stripe", "图", "连通分量"],
        "description": (
            "每天会新增若干商户与 link_type 的关联，并持续指定天数。当天仍有效的同类型关联会让相关商户两两连边。"
            "对每日图求连通分量；每个分量的 pin 是度数最高的商户，平手取 merchant_id 字典序最小者。"
            "按分量人数降序、pin 字典序升序输出。过期关联移除后需重新计算，分量可能分裂。"
        ),
        "input": (
            "第一行 D（固定为 3）。随后按第 1、2、3 天依次给出批次：每批先给整数 k，再给 k 行 "
            "`merchant_id link_type duration`。该行表示当天新增一条关联，持续 duration 天；当天有效区间为 "
            "`add_day <= day < add_day + duration`。merchant_id 和 link_type 为 1..16 位 ASCII 字母、数字、下划线或连字符；"
            "duration 为 0..3 的整数；每批至多 100 行，总行数至多 200。同一批中 `(merchant_id, link_type)` 不重复；"
            "同一商户可关联多个类型，同类型可关联多个商户。这里的批次日号替代上游 tuple 中显式的 day 字段，属本站输入协议补充。"
        ),
        "output": (
            "输出三段，每段先输出 `Day 1`、`Day 2` 或 `Day 3`。之后每个连通分量一行："
            "`  cluster size=<人数> pin=<merchant_id>`。图顶点是当天至少有一条有效关联的商户；"
            "若该商户没有与其他商户共享有效 link_type，则作为大小为 1 的孤立分量。分量按人数降序、pin 字典序升序排列；"
            "没有有效关联时该日只输出标题行。行尾为 LF。孤立顶点处理和文本序列化是本站明确补充。"
        ),
        "explanation": (
            "固定上游文字定义同 `link_type` 的活跃关系构成连边、cluster 是连通分量，pin 取最高 degree 并在平手时取最小 ID，"
            "最终按人数和 pin 排序。本站补充了批次输入、输出文本、限制，以及将只有一条有效关系且未与其他商户共享类型的商户作为 singleton。"
        ),
        "hints": [
            "逐日加入新关系并筛选尚未过期的关系。按 link_type 汇总当天商户，组内任意两商户连边；用 DFS/BFS 求分量，"
            "累计每个点的不同邻居数，按题定规则选 pin 并排序。",
        ],
        "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 32768,
        "checker": "exact", "languages": ["python", "go", "java", "cpp"],
    }
    package_text = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(package_text)
    package_checksum = hashlib.sha256(package_text.encode()).hexdigest()

    editorial = (
        "## 为什么正确\n\n"
        "按日加入新关系，保留满足 `add_day <= day < add_day + duration` 的有效关系。相同 `link_type` 的商户形成组，"
        "组内两两连边。随后遍历图求连通分量；对每个分量统计不同邻居数，度数最大者作为 pin，平手时选 ID 字典序最小者。"
        "最后按分量大小降序、pin 升序排列。\n\n"
        "## 正确性\n\n"
        "每个有效同类型关系组中的任意两商户按规则相连，故构造出的边集恰是当日所有关系边。DFS/BFS 恰好访问每个顶点所在的连通分量；"
        "不同邻居数即图中度数，因此 pin 选择与题意一致。最终排序键也与题目规定一致。每一天从当前有效关系重建图，"
        "所以关系过期后产生的分裂会自然反映在新分量中。\n\n"
        "## 复杂度\n\n"
        "设某日有效记录数为 E、商户数为 V。组内两两连边最坏 O(E²)，遍历为 O(V+E_graph)，空间 O(V+E_graph)。"
        "本站限制总记录数 200，因此最坏建图量有明确上界。singleton 顶点按本站题面约定保留。"
    )
    source_evidence = {
        "schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT,
        "origin": "https://oamaster.com",
        "items": [{
            "id": IDENTIFIER,
            "sourceUrl": SOURCE_URL,
            "catalogContentHash": CATALOG_HASH,
            "rawFiles": [{
                "path": SOURCE_PATH, "blob": SOURCE_BLOB,
                "sha256": SOURCE_SHA256, "lineRange": [334, 345],
            }],
            "sourceRules": {
                "edge": "Two merchants are connected iff they share an active link of the same link_type.",
                "activeWindow": "The source solution defines an added-on-day-d link of duration t as active for d <= day < d+t.",
                "component": "A cluster is a connected component over active links; expiration can split a component, so components are recomputed per day.",
                "pin": "Highest degree in the component; tie goes to lexicographically smallest merchant_id.",
                "order": "Descending component member count, then pin name ascending.",
            },
            "siteProtocolSupplement": {
                "days": "Exactly three batches, matching source day1/day2/day3. Batch number supplies the tuple's day field.",
                "io": "Whitespace-tokenized stdin records and exact three-day textual stdout format are site-added.",
                "bounds": "At most 200 records total, at most 100 per day, identifiers 1..16 ASCII alphanumeric/underscore/hyphen, duration 0..3.",
                "vertices": "The source text does not explicitly say whether a merchant with an active but unshared link appears. This candidate follows the standard graph interpretation and explicit site rule: all merchants with an active link are vertices, including singleton components.",
                "duplicates": "To avoid multiplicity ambiguity, a batch cannot repeat the same (merchant_id, link_type) pair; memberships from separate days are deduplicated while active.",
                "format": "Each cluster prints size and pin, matching the source's accompanying Python solution format; blank days print only Day X.",
                "unverified": "Offline candidate only; not tested against GoJudge or production.",
            },
        }],
    }

    write_json(OA / "packages" / f"{IDENTIFIER}.json", package)
    (OA / "references" / f"{IDENTIFIER}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{IDENTIFIER}.json", oracle_inputs)
    write_json(OA / "mutants" / f"{IDENTIFIER}.json", [
        {"name": name, "code": textwrap.dedent(code).strip() + "\n"}
        for name, code in mutants
    ])
    write_json(OA / "editorials" / f"{IDENTIFIER}.json", {
        "schemaVersion": 1, "id": IDENTIFIER, "title": problem["title"],
        "explanation": editorial,
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": CATALOG_HASH, "author": "CSWork",
    })
    write_json(OA / "source-evidence" / f"{BATCH}.json", source_evidence)
    write_json(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": IDENTIFIER, "batch": BATCH,
            "sourceContentHash": CATALOG_HASH,
            "previousReason": PREVIOUS_REASON,
            "reason": (
                "固定上游快照补全了边定义、每日报过期/重算、连通分量、pin 规则与结果排序；"
                "本站仅补充 stdin/stdout、有限约束及 singleton 顶点规则，并已通过 120 个唯一暴力 DSU oracle 输入、"
                "32 个正式用例和两个正常退出错误程序的本地差分。尚未通过真实 GoJudge 沙箱验证。"
            ),
        }],
    })
    write_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": IDENTIFIER, "sourceContentHash": CATALOG_HASH,
            "packageChecksum": package_checksum,
            "editorial": editorial,
            "authoredSolutions": [{"language": "python", "code": reference}],
        }],
    })
    write_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1, "seed": 20261010,
        "problems": [{
            "id": IDENTIFIER, "formalCases": len(cases),
            "oracleCases": len(oracle_inputs), "oracleInputsUnique": len(oracle_inputs),
            "formalOracleUnionUnique": len(oracle_seen),
            "hiddenCases": sum(case["hidden"] for case in cases),
            "negativeControls": killed,
            "sourceCommit": SOURCE_COMMIT, "sourceBlob": SOURCE_BLOB,
            "referenceSha256": hashlib.sha256(reference.encode()).hexdigest(),
        }],
        "note": "本地 reference/独立 DSU oracle 对照完成；候选未连接 GoJudge，未进行 sandbox 或 production 验证。",
    })
    print(f"{IDENTIFIER}: formal={len(cases)}, unique oracle={len(oracle_inputs)}, mutants={len(killed)} killed")


if __name__ == "__main__":
    main()
