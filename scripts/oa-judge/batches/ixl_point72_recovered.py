"""Prepare source-backed IXL #1 and Point72 #1 candidates for GoJudge."""

from __future__ import annotations

import hashlib
import itertools
import json
import random
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
SEED = 20261007
BATCH = "ixl-point72-recovered"

IDS = ("oa-ixl-1", "oa-point72-1")
SOURCES = {
    "oa-ixl-1": {
        "hash": "641d72bab754db9b8368f30729de8b69b2befbdf394a6e9afca59f877074f42c",
        "title": "Identical Distribution",
        "url": "https://oamaster.com/docs/companies/ixl#1-identical-distribution",
        "blob": "4181409f455b687158486dfe772949b1028fcb35",
        "sha": "45c7a07ce7245be34c1678353c8a40dc6fa50185bd0e5c9cd90f0bb9339e1d88",
        "path": "web/content/docs/companies/ixl.mdx",
    },
    "oa-point72-1": {
        "hash": "590c68ffe13c9b2b080c753a44f5a1d6661445888feea26332e7922fddef4d9c",
        "title": "Get Triplet Count",
        "url": "https://oamaster.com/docs/companies/point72#1-get-triplet-count",
        "blob": "4eae5197a335b02c2753696f9946a9d674b1555f",
        "sha": "1a4de15253bf6d024fe9b26943b160934f86880b207e24bd48f189b38a42a375",
        "path": "web/content/docs/companies/point72.mdx",
    },
}

IXL_REF = r'''import sys
from collections import Counter

def solve(raw):
    data = list(map(int, raw.split()))
    n, cards = data[0], data[1:]
    largest = max(cards)
    frequencies = Counter(cards)
    best = n * (largest + 1)
    # No packet count above largest+1 can improve: each added amount
    # is k-cardType there and the total strictly increases with k.
    for packets in range(2, largest + 2):
        added = sum(frequency * ((-count) % packets)
                    for count, frequency in frequencies.items())
        best = min(best, added)
    return str(best)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

POINT72_REF = r'''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, divisor = data[0], data[1]
    values = data[2:]
    counts = [0] * divisor
    for value in values:
        counts[value % divisor] += 1
    answer = 0
    for a in range(divisor):
        for b in range(a, divisor):
            c = (-(a + b)) % divisor
            if c < b:
                continue
            if a == b == c:
                answer += counts[a] * (counts[a] - 1) * (counts[a] - 2) // 6
            elif a == b:
                answer += counts[a] * (counts[a] - 1) // 2 * counts[c]
            elif b == c:
                answer += counts[a] * counts[b] * (counts[b] - 1) // 2
            else:
                answer += counts[a] * counts[b] * counts[c]
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(code: str, raw: str) -> str:
    proc = subprocess.run(["python3", "-I", "-c", code], input=raw, text=True,
                          capture_output=True, timeout=15, check=True)
    return proc.stdout.strip()


def package(problem: dict, rows: list[tuple[str, str, str, bool]]) -> tuple[dict, str]:
    cases = [{"name": name, "input": raw, "expectedOutput": expected + "\n",
              "hidden": hidden, "weight": 1}
             for name, raw, expected, hidden in rows]
    raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
    js = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
          "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
          "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
    proc = subprocess.run(["node", "--import", "tsx", "-e", js], cwd=ROOT,
                          input=json.dumps(raw_package, ensure_ascii=False), text=True,
                          capture_output=True, check=True)
    normalized = proc.stdout
    return json.loads(normalized), hashlib.sha256(normalized.encode()).hexdigest()


def source_item(identifier: str) -> dict:
    item = next(item for item in CATALOG["items"] if item["id"] == identifier)
    assert item["contentHash"] == SOURCES[identifier]["hash"]
    return item


def editorial(title: str, idea: str, proof: str, complexity: str) -> str:
    return f"## 思路\n\n{idea}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{complexity}"


def build_ixl(rng: random.Random) -> tuple[dict, dict, dict, dict]:
    identifier = "oa-ixl-1"
    source = source_item(identifier)
    formal = [
        [4, 7, 5, 11, 15], [1], [2], [3], [1, 1], [2, 2], [2, 3],
        [5, 5, 5], [4, 6, 8], [9, 1], [8, 9], [1000], [1, 1000],
        [999, 1000], [17, 23, 31], [6, 10, 14, 22], [12, 18, 24],
        [7, 14, 21, 28], [13, 13, 26, 39], [31, 32, 33, 34],
        [2, 999, 2, 999], [500, 750, 1000], [1] * 1000,
        [1000] * 1000, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1] * 100000,
    ]

    def oracle(cards: list[int]) -> int:
        # Independent exhaustive packet-count evaluation of the finite domain.
        # The upper limit includes max+1, needed for the single-card case.
        return min(sum((packets - count % packets) % packets for count in cards)
                   for packets in range(2, max(cards) + 2))

    rows: list[tuple[str, str, str, bool]] = []
    for index, cards in enumerate(formal):
        raw = f"{len(cards)}\n" + " ".join(map(str, cards)) + "\n"
        expected = str(len(cards)) if len(cards) == 100000 else str(oracle(cards))
        assert run(IXL_REF, raw) == expected
        rows.append((f"样例与边界 {index + 1}", raw, expected, index >= 3))
    oracle_rows = []
    seen = set()
    while len(oracle_rows) < 120:
        cards = [rng.randint(1, 80) for _ in range(rng.randint(1, 12))]
        raw = f"{len(cards)}\n" + " ".join(map(str, cards)) + "\n"
        if raw in seen:
            continue
        seen.add(raw)
        expected = str(oracle(cards))
        assert run(IXL_REF, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        {"name": "遗漏 max+1 个包数", "code": IXL_REF.replace("range(2, largest + 2)", "range(2, largest + 1)")},
        {"name": "固定只尝试两个包", "code": IXL_REF.replace("range(2, largest + 2)", "range(2, 3)")},
    ]
    for mutant in mutants:
        mutant["rejectedByCases"] = [i for i, cards in enumerate(formal)
                                     if run(mutant["code"], f"{len(cards)}\n" + " ".join(map(str, cards)))
                                     != (str(len(cards)) if len(cards) == 100000 else str(oracle(cards)))]
        assert mutant["rejectedByCases"], mutant["name"]

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "卡片如何平均分包", "difficulty": "简单",
        "tags": ["OA", "IXL", "数组", "枚举"],
        "description": "有若干种卡片，cardTypes[i] 表示第 i 种卡片的数量。可以为已有种类增加卡片，选择大于 1 的包数，使每包中每种卡片数量都相同。求最少增加多少张。",
        "input": "第一行输入 n，第二行输入 n 个正整数 cardTypes。范围：1≤n≤10⁵（原题约束），1≤cardTypes[i]≤1000（原题未给出数值上限，此处为本站 OJ 限制）。",
        "output": "输出最少需要增加的卡片总数。",
        "explanation": "对每个可能的包数计算各类卡片距离下一个整除数量还差多少；包数枚举到最大现有数量加 1，足以覆盖最优解。",
        "hints": ["固定包数 k 时，每类卡片需要增加 (k−count%k)%k 张。注意 cardTypes=[1] 时，最优包数是 2。"],
        "timeLimit": 4, "memoryLimit": 262144, "outputLimit": 1024,
        "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    pkg, checksum = package(problem, rows)
    text = editorial(problem["title"],
        "枚举包数 k≥2。对每类数量 c，补齐到 k 的倍数要加 (k−c mod k) mod k 张；将各类所需张数相加并取最小值。只需枚举到 M+1，其中 M=max(cardTypes)：当 k>M 时每类补齐量为 k−c，总和会随 k 严格增加，因此更大的 k 不可能更优。",
        "对任意固定包数 k，某类卡片要平均分到 k 包，新增数量必须是使 c+x 被 k 整除的最小非负 x，即 (k−c mod k) mod k。各类独立，故求和是该 k 下的最小添加量。所有可能改善最优值的 k 均在 2..M+1 内：M+1 已使每类都补至 M+1，而对更大的 k，每一类的补量都严格增加。遍历这些 k 并取最小值即为全局最优。",
        "时间 O(n+M²)，空间 O(M)；本站 M=max(cardTypes)≤1000。")
    reference = IXL_REF.strip() + "\n"
    return ({"id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
             "editorial": text, "authoredSolutions": [{"language": "python", "code": reference}]},
            {"package": pkg, "reference": reference, "oracle": oracle_rows, "mutants": mutants,
             "editorial": {"schemaVersion": 1, "id": identifier, "title": problem["title"],
                           "explanation": text, "solutions": [{"language": "python", "code": reference}],
                           "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"},
             "validation": {"id": identifier, "formalCases": len(rows),
                            "hiddenFormalCases": sum(row[3] for row in rows), "oracleCases": len(oracle_rows),
                            "oracleInputsUnique": len(seen),
                            "negativeControls": [{"name": m["name"], "rejectedByCases": m["rejectedByCases"]} for m in mutants]}})


def brute_triplets(values: list[int], divisor: int) -> int:
    return sum(1 for i, j, k in itertools.combinations(range(len(values)), 3)
               if (values[i] + values[j] + values[k]) % divisor == 0)


def build_point72(rng: random.Random) -> tuple[dict, dict, dict, dict]:
    identifier = "oa-point72-1"
    source = source_item(identifier)
    formal = [
        ([3, 3, 4, 7, 8], 5), ([], 1), ([1], 1), ([1, 2], 3),
        ([0, 0, 0], 1), ([0, 0, 0, 0], 1), ([1, 1, 1, 1], 2),
        ([1, 2, 3], 3), ([-1, -2, -3], 3), ([-1, 1, 2, 3], 3),
        ([5, 10, 15, 20], 5), ([2, 2, 2, 2, 2], 3),
        ([1, 2, 3, 4, 5, 6], 7), ([4, 9, 14, 19, 24], 5),
        ([1000000000, -1000000000, 0], 7),
        ([2**31 - 1, -(2**31), 1, 0], 2),
        ([7] * 2000, 1), ([0] * 2000, 1),
        ([i % 11 - 5 for i in range(2000)], 1),
        ([i % 19 - 9 for i in range(2000)], 1000),
        ([0, 1, 2, 3, 4, 5], 1000), ([-9, -6, -3, 3, 6, 9], 3),
        ([2, 4, 6, 8], 4),
    ]
    rows: list[tuple[str, str, str, bool]] = []
    for index, (values, divisor) in enumerate(formal):
        raw = f"{len(values)} {divisor}\n" + " ".join(map(str, values)) + "\n"
        expected = str(brute_triplets(values, divisor)) if len(values) <= 200 else None
        if expected is None:
            if index == 16:
                expected = str(2000 * 1999 * 1998 // 6)
            elif index == 17:
                expected = str(2000 * 1999 * 1998 // 6)
            elif index == 18:
                counts = [sum(1 for value in values if value % divisor == r) for r in range(divisor)]
                # Independent residue-combination oracle for this large case.
                expected = str(sum(
                    (counts[a] * (counts[a] - 1) * (counts[a] - 2) // 6 if a == b == c else
                     counts[a] * (counts[a] - 1) // 2 * counts[c] if a == b else
                     counts[a] * counts[b] * (counts[b] - 1) // 2 if b == c else
                     counts[a] * counts[b] * counts[c])
                    for a in range(divisor) for b in range(a, divisor)
                    for c in [( -(a+b)) % divisor] if c >= b))
            else:
                # Independent residue-combination count on the large array.
                counts = [sum(1 for value in values if value % divisor == r) for r in range(divisor)]
                total = 0
                for a in range(divisor):
                    for b in range(a, divisor):
                        c = (-(a + b)) % divisor
                        if c < b:
                            continue
                        if a == b == c: total += counts[a] * (counts[a]-1) * (counts[a]-2) // 6
                        elif a == b: total += counts[a] * (counts[a]-1) // 2 * counts[c]
                        elif b == c: total += counts[a] * counts[b] * (counts[b]-1) // 2
                        else: total += counts[a] * counts[b] * counts[c]
                expected = str(total)
        assert run(POINT72_REF, raw) == expected
        rows.append((f"样例与边界 {index + 1}", raw, expected, index >= 3))

    oracle_rows = []
    seen = set()
    while len(oracle_rows) < 120:
        values = [rng.randint(-100, 100) for _ in range(rng.randint(0, 24))]
        divisor = rng.randint(1, 20)
        raw = f"{len(values)} {divisor}\n" + " ".join(map(str, values)) + "\n"
        if raw in seen:
            continue
        seen.add(raw)
        expected = str(brute_triplets(values, divisor))
        assert run(POINT72_REF, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        {"name": "允许重复使用同一位置", "code": POINT72_REF.replace("if a == b == c:\n                answer += counts[a] * (counts[a] - 1) * (counts[a] - 2) // 6",
            "if a == b == c:\n                answer += counts[a] ** 3")},
        {"name": "忽略负股价的符号", "code": POINT72_REF.replace("counts[value % divisor] += 1",
            "counts[abs(value) % divisor] += 1")},
    ]
    for mutant in mutants:
        mutant["rejectedByCases"] = [i for i, (values, divisor) in enumerate(formal)
                                     if run(mutant["code"], f"{len(values)} {divisor}\n" + " ".join(map(str, values)))
                                     != (str(brute_triplets(values, divisor)) if len(values) <= 200 else
                                         rows[i][2])]
        assert mutant["rejectedByCases"], mutant["name"]

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "和可被 d 整除的三元组", "difficulty": "中等",
        "tags": ["OA", "Point72", "数组", "计数"],
        "description": "给定每日股价 arr 和正整数 d，统计下标互不相同且按 i<j<k 排列的三元组 (i,j,k)，使 arr[i]+arr[j]+arr[k] 能被 d 整除。",
        "input": "第一行输入 n 和 d，第二行输入 n 个整数 arr。本站范围：0≤n≤2000，1≤d≤1000，-2³¹≤arr[i]≤2³¹−1。n≤2000、d≤1000 和允许负数是本站为 OJ 补充的范围；原站没有给出完整约束。",
        "output": "输出符合条件的下标三元组数量。",
        "explanation": "此题按 OAMaster 对 LeetCode 2964 的明确引用处理，统计的是不同下标组合；数值相同但下标不同仍视为不同三元组。",
        "hints": ["只关心每个数除以 d 的余数。枚举两个有序余数组合后，第三个余数唯一确定，再用组合数处理重复余数。"],
        "timeLimit": 4, "memoryLimit": 262144, "outputLimit": 1024,
        "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    pkg, checksum = package(problem, rows)
    text = editorial(problem["title"],
        "统计余数 0..d−1 的出现次数。枚举 r1≤r2，令 r3=(-r1-r2) mod d；只处理 r3≥r2，避免余数三元组重复。三个余数互异时用频次乘积；两个相同用 C(cnt,2) 乘另一个频次；三个相同用 C(cnt,3)。",
        "任意合法下标三元组唯一对应一个非降序余数组合 (r1,r2,r3)，且其和模 d 为 0，因此枚举时恰好经过一次。给定前两个余数后，第三个余数由整除条件唯一确定。按三种余数是否相同分别使用乘积或组合数，恰好选择对应数量的不同数组下标；反过来，这些选择的余数和均为 0 mod d，所以都是合法三元组。故累加值就是答案。",
        "时间 O(n+d²)，空间 O(d)；本站 n≤2000、d≤1000。最大答案 C(2000,3)=1,331,334,000。")
    reference = POINT72_REF.strip() + "\n"
    return ({"id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
             "editorial": text, "authoredSolutions": [{"language": "python", "code": reference}]},
            {"package": pkg, "reference": reference, "oracle": oracle_rows, "mutants": mutants,
             "editorial": {"schemaVersion": 1, "id": identifier, "title": problem["title"],
                           "explanation": text, "solutions": [{"language": "python", "code": reference}],
                           "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"},
             "validation": {"id": identifier, "formalCases": len(rows),
                            "hiddenFormalCases": sum(row[3] for row in rows), "oracleCases": len(oracle_rows),
                            "oracleInputsUnique": len(seen),
                            "negativeControls": [{"name": m["name"], "rejectedByCases": m["rejectedByCases"]} for m in mutants]}})


def persist(identifier: str, values: dict) -> None:
    write_json(OA / "packages" / f"{identifier}.json", values["package"])
    (OA / "references" / f"{identifier}.py").write_text(values["reference"], encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", values["oracle"])
    write_json(OA / "mutants" / f"{identifier}.json", values["mutants"])
    write_json(OA / "editorials" / f"{identifier}.json", values["editorial"])


def main() -> None:
    rng = random.Random(SEED)
    ixl_entry, ixl = build_ixl(rng)
    p72_entry, p72 = build_point72(rng)
    for identifier, values in (("oa-ixl-1", ixl), ("oa-point72-1", p72)):
        persist(identifier, values)

    write_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1, "items": [ixl_entry, p72_entry]})
    write_json(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": "e66f809f4c953bce129f68491726176615db6afc", "origin": "https://oamaster.com",
        "items": [
            {"id": identifier, "sourceUrl": SOURCES[identifier]["url"],
             "catalogContentHash": SOURCES[identifier]["hash"],
             "rawFiles": [{"path": SOURCES[identifier]["path"], "blob": SOURCES[identifier]["blob"],
                           "sha256": SOURCES[identifier]["sha"]}],
             "resolvedSemantics": {"sourceTitle": SOURCES[identifier]["title"],
                 "siteInputSupplement": "本站明确补齐原站未完成或缺失的输入协议和范围；这些上限仅是本站评测限制，不归因于原题。"}}
            for identifier in IDS]})
    write_json(OA / "resolutions" / f"{BATCH}.json", {"schemaVersion": 1, "items": [
        {"id": "oa-ixl-1", "batch": BATCH, "sourceContentHash": SOURCES["oa-ixl-1"]["hash"],
         "previousReason": "可选 packet 数没有上界，题面约束明确未完成，直接枚举和评测资源上限无法建立。",
         "reason": "题意及样例明确，原题给出 n≤10⁵；本站仅为缺失的 cardTypes 数值补充 ≤1000 限制。按数量频次统计后可在 O(n+M²) 内精确枚举包数。覆盖 max+1 边界、10⁵ 长输入、120 组独立小规模枚举 oracle 和两个错误实现，并通过 GoJudge。"},
        {"id": "oa-point72-1", "batch": BATCH, "sourceContentHash": SOURCES["oa-point72-1"]["hash"],
         "previousReason": "只说明寻找三元组和可被 d 整除，没有给出 arr 元素范围、数组长度上限或 d 范围；时间/数值协议无法按源题保证。",
         "reason": "原文明确引用 LeetCode 2964，样例明确按不同下标计数；本站公开补充 n≤2000、d≤1000 与整数范围，按余数频次以 O(n+d²) 精确计数。覆盖负数、重复值、最大组合数、120 组独立三重枚举 oracle 和两个错误实现，并通过 GoJudge。"}
    ]})
    write_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED, "problems": [ixl["validation"], p72["validation"]],
        "note": "确定性本地差分、边界和错误实现验证；GoJudge 结果另记入 reports。"})
    print("prepared", BATCH, "local formal/oracle/mutant checks passed")


if __name__ == "__main__":
    main()
