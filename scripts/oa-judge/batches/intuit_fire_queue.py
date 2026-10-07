"""Build independently validated Intuit fire-grid and queue candidates."""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
from collections import deque
from itertools import product
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
SEED = 20261007
BATCH = "intuit-fire-queue"
IDS = ("oa-intuit-22", "oa-intuit-2")
RAW_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/intuit.mdx"
RAW_BLOB = "29669a0924bebd4ca9fd5e2ef5b7c1d3a544a628"
RAW_SHA = "a5da1dba476f4de2a217a3594becd921e20843658234c157fd28915017b6abe4"

SOURCE = {
    "oa-intuit-22": {
        "hash": "b367c3eb964fd009c6c5a789c47990af04792b02f3ebb4a0482f7e83f3c65b34",
        "title": "Spreading Fire (Intuit India)",
        "url": "https://oamaster.com/docs/companies/intuit#22-spreading-fire-intuit-india",
        "range": [1693, 1767],
        "extra": {"path": "fastprep/Intuit/intuit-spreading-fire.md",
                  "blob": "33f5b67e8ef6bbdeb2eb1ec8eeb5e4e7611fdc9e",
                  "sha256": "a0a6b62cd2bb0972179df5f964d36b38dcf4d0e122ce93e3277fa2bb6c573cf5"},
    },
    "oa-intuit-2": {
        "hash": "79360b13168df2814dba5041eb72728e69dd998864384fce29d1d2f84e0151b0",
        "title": "The Chosen Ones — Queue Iterations",
        "url": "https://oamaster.com/docs/companies/intuit#2-the-chosen-ones--queue-iterations",
        "range": [123, 135],
    },
}

FIRE_REF = r'''import sys

def solve(raw):
    values = list(map(int, raw.split()))
    n, m, k = values[:3]
    points = [(values[i], values[i + 1]) for i in range(3, 3 + 2 * k, 2)]
    radius = values[3 + 2 * k] * values[4 + 2 * k]
    radius2 = radius * radius
    safe = 0
    for x in range(n + 1):
        for y in range(m + 1):
            if all((x - fx) ** 2 + (y - fy) ** 2 > radius2 for fx, fy in points):
                safe += 1
    return str(safe)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

QUEUE_REF = r'''import sys
from collections import deque

def solve(raw):
    data = list(map(int, raw.split()))
    n, x = data[:2]
    queue = deque((index + 1, value) for index, value in enumerate(data[2:2+n]))
    selected = []
    for _ in range(x):
        batch = [queue.popleft() for _ in range(min(x, len(queue)))]
        chosen = max(range(len(batch)), key=lambda i: batch[i][1])
        selected.append(batch[chosen][0])
        for index, value in batch[:chosen] + batch[chosen + 1:]:
            queue.append((index, max(0, value - 1)))
    return " ".join(map(str, selected))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(code: str, raw: str) -> str:
    result = subprocess.run(["python3", "-I", "-c", code], input=raw, text=True,
                            capture_output=True, timeout=15, check=True)
    return result.stdout.strip()


def package(problem: dict, rows: list[tuple[str, str, str, bool]]) -> tuple[dict, str]:
    cases = [{"name": name, "input": raw, "expectedOutput": expected + "\n",
              "hidden": hidden, "weight": 1}
             for name, raw, expected, hidden in rows]
    raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
    script = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
              "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
              "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
    result = subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT,
                            input=json.dumps(raw_package, ensure_ascii=False), text=True,
                            capture_output=True, check=True)
    normalized = result.stdout
    return json.loads(normalized), hashlib.sha256(normalized.encode()).hexdigest()


def source_item(identifier: str) -> dict:
    item = next(item for item in CATALOG["items"] if item["id"] == identifier)
    assert item["contentHash"] == SOURCE[identifier]["hash"]
    return item


def editorial(title: str, idea: str, proof: str, complexity: str) -> str:
    return f"## 思路\n\n{idea}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{complexity}"


def build_fire(rng: random.Random) -> tuple[dict, dict]:
    identifier = "oa-intuit-22"
    source = source_item(identifier)
    formal = [
        (4, 4, [(1, 1), (3, 3)], 1, 2),  # Source example.
        (1, 1, [(0, 0)], 1, 1),           # Circle boundary is included.
        (1, 1, [(0, 0)], 0, 10),
        (4, 4, [(2, 2)], 0, 0),
        (2, 3, [(0, 0), (2, 3)], 1, 1),
        (5, 4, [(0, 2), (5, 2)], 1, 1),
        (3, 3, [(1, 1), (1, 1)], 1, 1),
        (2, 2, [(0, 0)], 10, 10),
        (3, 2, [(0, 1), (3, 1)], 1, 2),
        (1, 4, [(1, 0)], 1, 1),
        (4, 1, [(2, 1)], 1, 1),
        (6, 6, [(0, 0), (6, 6)], 2, 1),
        (5, 5, [(2, 2)], 1, 2),
        (4, 3, [(0, 3), (4, 0)], 1, 1),
        (10, 9, [(5, 4)], 2, 3),
        (7, 8, [(0, 8), (7, 0), (7, 8)], 1, 3),
        (11, 13, [(3, 7), (9, 2)], 0, 1),
        (9, 8, [(4, 4)], 3, 1),
        (13, 10, [(0, 0), (13, 10)], 2, 2),
        (5, 12, [(2, 6), (4, 9)], 1, 4),
        (100, 100, [(0, 0)] * 100, 0, 100),
        (100, 100, [(50, 50)], 100, 100),
        (2, 2, [(2, 2)], 0, 1),
    ]

    def oracle(n: int, m: int, points: list[tuple[int, int]], radius: int, time: int) -> int:
        # Mark burned lattice points by disk enumeration, independently of the
        # reference's per-grid-point all-sources scan.
        burned: set[tuple[int, int]] = set()
        r2 = (radius * time) ** 2
        for fx, fy in points:
            for x in range(max(0, fx - radius * time), min(n, fx + radius * time) + 1):
                for y in range(max(0, fy - radius * time), min(m, fy + radius * time) + 1):
                    if (x - fx) ** 2 + (y - fy) ** 2 <= r2:
                        burned.add((x, y))
        return (n + 1) * (m + 1) - len(burned)

    def input_for(n: int, m: int, points: list[tuple[int, int]], radius: int, time: int) -> str:
        flattened = " ".join(f"{x} {y}" for x, y in points)
        return f"{n} {m} {len(points)}\n{flattened}\n{radius} {time}\n"

    rows: list[tuple[str, str, str, bool]] = []
    for index, (n, m, points, radius, time) in enumerate(formal):
        raw = input_for(n, m, points, radius, time)
        expected = str(oracle(n, m, points, radius, time))
        assert run(FIRE_REF, raw) == expected
        rows.append((f"样例与边界 {index + 1}", raw, expected, index >= 3))

    oracle_rows = []
    seen = set()
    while len(oracle_rows) < 120:
        n, m = rng.randint(1, 8), rng.randint(1, 8)
        points = [(rng.randint(0, n), rng.randint(0, m)) for _ in range(rng.randint(1, 5))]
        radius, time = rng.randint(0, 4), rng.randint(0, 4)
        raw = input_for(n, m, points, radius, time)
        if raw in seen:
            continue
        seen.add(raw)
        expected = str(oracle(n, m, points, radius, time))
        assert run(FIRE_REF, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        {"name": "遗漏平面最外侧一行和一列", "code": FIRE_REF.replace("range(n + 1)", "range(n)").replace("range(m + 1)", "range(m)")},
        {"name": "把圆周边界误判为安全", "code": FIRE_REF.replace("> radius2", ">= radius2")},
    ]
    for mutant in mutants:
        mutant["rejectedByCases"] = [i for i, case in enumerate(formal)
                                     if run(mutant["code"], input_for(*case)) != rows[i][2]]
        assert mutant["rejectedByCases"], mutant["name"]

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "火势扩散后还剩多少安全格点", "difficulty": "简单",
        "tags": ["OA", "Intuit", "网格", "几何"],
        "description": "矩形平面内有 K 个起火格点。火从每个起点向外扩散成圆，t=1 时半径为 R，之后每单位时间半径增加 R。求 T 时刻未被任何火源触及的整数格点数。",
        "input": "第一行输入 N M K；随后 K 行输入火源坐标 x y；最后一行输入 R T。按题目样例，整数格点包含边界，即 0≤x≤N、0≤y≤M。本站限制：1≤N,M≤100，1≤K≤100，0≤R,T≤100，火源坐标在上述格点范围内。",
        "output": "输出未触火的整数格点数量。距任一火源小于或等于 R×T 的点视为已触火。",
        "explanation": "题目样例枚举的边界点说明该平面共有 (N+1)×(M+1) 个整数格点；圆周也算被触及。本站补充了输入范围以保证枚举时间可控。",
        "hints": ["对每个边界格点，比较它到所有火源的平方距离与 (R×T)²，无需计算平方根。"],
        "timeLimit": 4, "memoryLimit": 262144, "outputLimit": 1024,
        "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    pkg, checksum = package(problem, rows)
    text = editorial(problem["title"],
        "T 时刻的火势半径为 R×T。遍历完整整数格点矩形，对每个点检查到各火源的平方距离；若所有距离都大于半径平方，该点安全。题目样例的坐标列表按 0..N、0..M 的闭区间逐点枚举。",
        "每个格点只在双层循环中访问一次。对该点，算法恰好检查每个起火点；存在距离平方不超过半径平方的火源当且仅当点位于对应闭圆内，故算法会且仅会将未进入任何火源闭圆的点计为安全点。样例确定边界格点也属于平面，因此遍历区间必须包含 N 和 M。",
        "时间 O(NMK)，空间 O(K)；本站 N,M,K≤100。")
    reference = FIRE_REF.strip() + "\n"
    entry = {"id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
             "editorial": text, "authoredSolutions": [{"language": "python", "code": reference}]}
    files = {"package": pkg, "reference": reference, "oracle": oracle_rows, "mutants": mutants,
             "editorial": {"schemaVersion": 1, "id": identifier, "title": problem["title"],
                           "explanation": text, "solutions": [{"language": "python", "code": reference}],
                           "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"},
             "validation": {"id": identifier, "formalCases": len(rows),
                            "hiddenFormalCases": sum(row[3] for row in rows), "oracleCases": len(oracle_rows),
                            "oracleInputsUnique": len(seen),
                            "negativeControls": [{"name": m["name"], "rejectedByCases": m["rejectedByCases"]} for m in mutants]}}
    return entry, files


def queue_input(values: list[int], x: int) -> str:
    return f"{len(values)} {x}\n" + " ".join(map(str, values)) + "\n"


def queue_oracle(values: list[int], x: int) -> list[int]:
    queue = [(i + 1, value) for i, value in enumerate(values)]
    chosen = []
    for _ in range(x):
        batch, queue = queue[:x], queue[x:]
        best_position = max(range(len(batch)), key=lambda i: batch[i][1])
        chosen.append(batch[best_position][0])
        queue.extend((i, max(0, value - 1)) for i, value in batch if i != batch[best_position][0])
    return chosen


def build_queue(rng: random.Random) -> tuple[dict, dict]:
    identifier = "oa-intuit-2"
    source = source_item(identifier)
    formal = [
        ([1, 2, 2, 3, 4, 5, 5], 5),  # Source input; output is independently derived.
        ([0], 1), ([0, 0], 1), ([0, 0, 0, 0], 2),
        ([4, 4, 4, 4], 2), ([1, 3, 2, 3, 1], 3),
        ([9, 8, 7, 6, 5], 1), ([9, 8, 7, 6, 5], 5),
        ([0, 1, 0, 1, 0, 1], 3), ([10, 10, 9, 10, 8, 10], 4),
        ([5, 4, 3, 2, 1, 0], 2), ([1, 2, 3, 4, 5, 6], 6),
        ([7, 7, 7, 7, 7, 7, 7], 4), ([0, 0, 1, 0, 2, 0], 3),
        ([2, 1, 2, 1, 2, 1, 2, 1], 5), ([20, 0, 0, 0, 0, 0], 3),
        ([3, 2, 1, 0], 4), ([0, 0, 0, 0], 4),
        ([1000000000, 999999999, 1000000000, 0], 2),
        ([i % 7 for i in range(30)], 10),
        ([0] * 1000, 1000), ([i % 100 for i in range(1000)], 100),
        ([10**9] * 1000, 1000), ([1], 1), ([10, 0, 0], 3),
    ]
    rows: list[tuple[str, str, str, bool]] = []
    for index, (values, x) in enumerate(formal):
        raw = queue_input(values, x)
        expected = " ".join(map(str, queue_oracle(values, x)))
        assert run(QUEUE_REF, raw) == expected
        rows.append((f"样例与边界 {index + 1}", raw, expected, index >= 3))

    oracle_rows = []
    seen = set()
    while len(oracle_rows) < 120:
        n = rng.randint(1, 20)
        values = [rng.randint(0, 30) for _ in range(n)]
        x = rng.randint(1, n)
        raw = queue_input(values, x)
        if raw in seen:
            continue
        seen.add(raw)
        expected = " ".join(map(str, queue_oracle(values, x)))
        assert run(QUEUE_REF, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    tie_mutant = QUEUE_REF.replace("key=lambda i: batch[i][1]", "key=lambda i: (batch[i][1], i)")
    zero_mutant = QUEUE_REF.replace("max(0, value - 1)", "value - 1")
    mutants = [{"name": "并列最大值错误选择靠后的元素", "code": tie_mutant},
               {"name": "零值仍被递减为负数", "code": zero_mutant}]
    for mutant in mutants:
        mutant["rejectedByCases"] = [i for i, case in enumerate(formal)
                                     if run(mutant["code"], queue_input(*case)) != rows[i][2]]
        assert mutant["rejectedByCases"], mutant["name"]

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "按轮次从队列中选出最大值", "difficulty": "简单",
        "tags": ["OA", "Intuit", "队列", "模拟"],
        "description": "给定 n 个非负整数和整数 x，执行 x 轮。每轮从队头取最多 x 个数，选出其中最大值；并列时选择最靠前者。其余数值减 1（最低为 0），按原相对顺序放回队尾。输出被选元素最初的 1-based 下标。",
        "input": "第一行输入 n 和 x，第二行输入 n 个非负整数。本站限制：1≤x≤n≤1000，0≤queue[i]≤10⁹。x≤n 是本站限制，用于保证每轮开始时队列非空。",
        "output": "输出 x 个被选元素的原始下标，按选出顺序排列，以空格分隔。",
        "explanation": "原题输入样例没有提供输出。根据原文逐轮模拟，该样例所选下标为 5 6 7 4 1；此结果是本站复算，不冒充源站答案。",
        "hints": ["每轮先取出当前队列前 x 项，记录首个最大值，再把其余元素按顺序减值后放回。"],
        "timeLimit": 4, "memoryLimit": 262144, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    pkg, checksum = package(problem, rows)
    text = editorial(problem["title"],
        "用双端队列保存每项的原始下标和值。每轮弹出前 min(x,队列长度) 项，扫描得到第一个最大值并记下其下标；将该批其他项的值减 1、下限设为 0，再按原顺序放回队尾。",
        "每轮取出的 batch 与规则规定的队头至多 x 项完全相同。按从前到后的扫描只在严格变大时更新最大位置，因此并列时保留最早出现者。该项被记录且不放回；其余项逐个执行 max(0,value−1) 并按原顺序入队，恰与题目操作一致。对轮数归纳，队列状态和已选下标序列均与题意一致。",
        "时间 O(x²)，空间 O(n+x)；本站 x,n≤1000。")
    reference = QUEUE_REF.strip() + "\n"
    entry = {"id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
             "editorial": text, "authoredSolutions": [{"language": "python", "code": reference}]}
    files = {"package": pkg, "reference": reference, "oracle": oracle_rows, "mutants": mutants,
             "editorial": {"schemaVersion": 1, "id": identifier, "title": problem["title"],
                           "explanation": text, "solutions": [{"language": "python", "code": reference}],
                           "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"},
             "validation": {"id": identifier, "formalCases": len(rows),
                            "hiddenFormalCases": sum(row[3] for row in rows), "oracleCases": len(oracle_rows),
                            "oracleInputsUnique": len(seen),
                            "negativeControls": [{"name": m["name"], "rejectedByCases": m["rejectedByCases"]} for m in mutants]}}
    return entry, files


def persist(identifier: str, files: dict) -> None:
    write_json(OA / "packages" / f"{identifier}.json", files["package"])
    (OA / "references" / f"{identifier}.py").write_text(files["reference"], encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", files["oracle"])
    write_json(OA / "mutants" / f"{identifier}.json", files["mutants"])
    write_json(OA / "editorials" / f"{identifier}.json", files["editorial"])


def main() -> None:
    rng = random.Random(SEED)
    fire_entry, fire_files = build_fire(rng)
    queue_entry, queue_files = build_queue(rng)
    for identifier, files in (("oa-intuit-22", fire_files), ("oa-intuit-2", queue_files)):
        persist(identifier, files)

    write_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1, "items": [fire_entry, queue_entry]})
    evidence_items = []
    for identifier in IDS:
        meta = SOURCE[identifier]
        raw_files = [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA,
                      "lineRange": meta["range"]}]
        if "extra" in meta:
            raw_files.append(meta["extra"])
        evidence_items.append({
            "id": identifier, "sourceUrl": meta["url"], "catalogContentHash": meta["hash"],
            "rawFiles": raw_files,
            "resolvedSemantics": {"sourceTitle": meta["title"],
                "siteInputSupplement": "本站公开补充输入协议和资源上限；这部分不归因于上游。"},
        })
    write_json(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": RAW_COMMIT, "origin": "https://oamaster.com", "items": evidence_items})
    write_json(OA / "resolutions" / f"{BATCH}.json", {"schemaVersion": 1, "items": [
        {"id": "oa-intuit-22", "batch": BATCH, "sourceContentHash": SOURCE["oa-intuit-22"]["hash"],
         "previousReason": "未给 N/M/K、坐标域约定或限制；无法判断输入点对应的整数格点范围及可接受算法复杂度。",
         "reason": "原题样例列出的安全点唯一支持闭格点域 0≤x≤N、0≤y≤M，触火边界按闭圆处理；本站明确 N,M,K,R,T≤100，用 O(NMK) 扫描，并用独立圆盘并集 oracle、样例逐点复算和两个错误程序验证，GoJudge 通过。"},
        {"id": "oa-intuit-2", "batch": BATCH, "sourceContentHash": SOURCE["oa-intuit-2"]["hash"],
         "previousReason": "需要题源补齐 n、x 上限；直接模拟在未给约束时可能达到 O(x²)，无法保证线上评测时限。",
         "reason": "原题逐轮取队头、最大值平局取最先、其余值减一并保持顺序的规则明确；本站设 1≤x≤n≤1000、非负值上限 10⁹，直接双端队列模拟为 O(x²)。源示例没有输出；本站按题面独立复算为 [5,6,7,4,1]，另有 120 组独立数组模拟 oracle、n=x=1000 的 50 万级队列处理边界和两个正常退出错误程序，GoJudge 通过。"}
    ]})
    write_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [fire_files["validation"], queue_files["validation"]],
        "note": "确定性本地差分、边界和错误实现验证；GoJudge 报告另行保存。"})
    print("prepared", BATCH, "local formal/oracle/mutant checks passed")


if __name__ == "__main__":
    main()
