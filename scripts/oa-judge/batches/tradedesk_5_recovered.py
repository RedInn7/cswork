#!/usr/bin/env python3
"""Generate an isolated offline candidate for TradeDesk #5 only."""

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
REVIEW = ROOT / "content" / "oa-judge" / "reviews" / "saas-tech-remaining.json"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/tradedesk.mdx"
RAW_BLOB = "dd4d6b5e48ccc7a948fdd9de8156fdd9da329dd3"
RAW_SHA256 = "f99c4bf947fd8c9d7cba033842abd6203f254113b0bb09fade95c7fea0df2032"
CONTENT_HASH = "9dc700907325e644f5ac3c0c96e0343b3bd07b3dddaeb3a34820406ec71142b1"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw: dict) -> str:
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT,
                          input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout


REFERENCE = r'''def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) < 3:
        raise ValueError("expected n m journeys and two schedules")
    n, m, journeys = values[:3]
    if len(values) != 3 + n + m:
        raise ValueError("schedule length does not match header")
    c2d = values[3:3+n]
    d2c = values[3+n:]
    time = 0
    outbound = return_flight = 0
    for _ in range(journeys):
        while outbound < n and c2d[outbound] < time:
            outbound += 1
        if outbound == n:
            return "-1"
        time = c2d[outbound] + 100
        outbound += 1

        while return_flight < m and d2c[return_flight] < time:
            return_flight += 1
        if return_flight == m:
            return "-1"
        time = d2c[return_flight] + 100
        return_flight += 1
    return str(time)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.buffer.read()))
'''


def encode(c2d: list[int], d2c: list[int], journeys: int) -> str:
    return f"{len(c2d)} {len(d2c)} {journeys}\n" + " ".join(map(str, c2d)) + "\n" + " ".join(map(str, d2c)) + "\n"


def run(code: str, raw: str) -> str:
    with tempfile.TemporaryDirectory(prefix="tradedesk5-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=10, check=True)
        return proc.stdout.decode("ascii").strip()


def oracle(c2d: list[int], d2c: list[int], journeys: int) -> str:
    # Independent direct search: for each leg choose the earliest unused
    # departure not earlier than arrival, rather than using moving pointers.
    time = 0
    used_out: set[int] = set()
    used_return: set[int] = set()
    for _ in range(journeys):
        choices = [(departure, i) for i, departure in enumerate(c2d)
                   if i not in used_out and departure >= time]
        if not choices:
            return "-1"
        departure, index = min(choices)
        used_out.add(index)
        time = departure + 100

        choices = [(departure, i) for i, departure in enumerate(d2c)
                   if i not in used_return and departure >= time]
        if not choices:
            return "-1"
        departure, index = min(choices)
        used_return.add(index)
        time = departure + 100
    return str(time)


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-tradedesk-5", "tradedesk-5-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    formal = [
        ([0, 200, 500], [99, 210, 450], 1, "来源样例"),
        ([0], [100], 1, "恰好到达时可登机"),
        ([300], [450], 1, "等待后续航班"),
        ([0, 400, 800], [200, 600, 1000], 2, "连续完成两次往返"),
        ([0, 1], [100, 101], 2, "航班数量足够但时刻不足"),
        ([0, 0], [100, 100], 2, "重复时刻也不能完成超出的行程"),
        ([0, 100], [100, 200], 1, "返程选择最早可用班次"),
        ([0, 250, 500], [100, 350, 600], 3, "每次都等待恰好抵达时刻"),
        ([10**9], [10**9], 1, "最大出发时刻"),
    ]
    # Add deterministic, distinct schedule shapes as hidden formal cases; the
    # random oracle corpus alone is not part of the judge's formal test count.
    existing_inputs = {encode(c2d, d2c, journeys) for c2d, d2c, journeys, _ in formal}
    for index in range(12):
        n = 2 + index % 5
        m = 2 + (index * 3) % 5
        c2d = sorted(index * 37 + j * (41 + index) for j in range(n))
        d2c = sorted(index * 53 + j * (67 + 2 * index) for j in range(m))
        journeys = 1 + index % min(n, m)
        raw = encode(c2d, d2c, journeys)
        assert raw not in existing_inputs
        existing_inputs.add(raw)
        formal.append((c2d, d2c, journeys, f"隐藏时刻表场景 {index + 1}"))
    cases = []
    for index, (c2d, d2c, journeys, name) in enumerate(formal):
        expected = oracle(c2d, d2c, journeys)
        assert run(REFERENCE, encode(c2d, d2c, journeys)) == expected
        cases.append({"name": name, "input": encode(c2d, d2c, journeys), "expectedOutput": expected + "\n",
                      "hidden": index != 0, "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    while len(random_cases) < 120:
        n = rng.randint(1, 12)
        m = rng.randint(1, 12)
        c2d = sorted(rng.randint(0, 1200) for _ in range(n))
        d2c = sorted(rng.randint(0, 1200) for _ in range(m))
        journeys = rng.randint(1, min(n, m))
        raw = encode(c2d, d2c, journeys)
        if raw in seen:
            continue
        seen.add(raw)
        expected = oracle(c2d, d2c, journeys)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    mutants = [
        ("拒绝恰好抵达时刻的航班", REFERENCE.replace("c2d[outbound] < time", "c2d[outbound] <= time")
         .replace("d2c[return_flight] < time", "d2c[return_flight] <= time")),
        ("把单程耗时误写为 90 分钟", REFERENCE.replace("+ 100", "+ 90")),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for index, (c2d, d2c, journeys, _) in enumerate(formal):
            if run(code, encode(c2d, d2c, journeys)) != oracle(c2d, d2c, journeys):
                rejected.append(index)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    # Maximum-size, valid sorted schedules: each trip uses the next pair of
    # services. This also exercises the O(n + journeys) pointer walk.
    size = 100000
    stress_out = list(range(0, size * 300, 300))
    stress_back = list(range(100, 100 + size * 300, 300))
    stress_input = encode(stress_out, stress_back, size)
    expected_stress = str(stress_back[-1] + 100)
    assert run(REFERENCE, stress_input) == expected_stress

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Flights", "difficulty": "简单",
        "tags": ["OA", "TradeDesk", "数组", "双指针", "模拟"],
        "description": "给定 C→D 与 D→C 两个按出发时刻升序排列的航班时刻表，以及计划完成的往返次数。每程飞行 100 分钟；从当前所在城市出发时，乘坐出发时刻不早于当前时刻的最早一班。模拟所有往返，返回最后抵达 C 的时刻；若任一程没有可乘航班，返回 -1。",
        "input": "第一行输入 n、m、journeys，分别表示两个方向的航班数和计划往返次数。第二行输入 n 个非降序排列的 C→D 出发时刻；第三行输入 m 个非降序排列的 D→C 出发时刻。约束：1≤n,m≤100000，1≤journeys≤min(n,m)，0≤所有出发时刻≤10^9。恰好等于抵达时刻的航班可乘坐。",
        "output": "输出完成所有计划往返后的抵达时刻；若无法完成，输出 -1。",
        "explanation": "该函数题的原文没有标准输入输出协议；本站按数组长度及两行时刻表补充序列化。恰好抵达时可登机由来源代码中的 lower_bound/bisect_left 规则明确。",
        "hints": ["两个时刻表已排序。沿当前时间单调前进，为每个方向维护一个指针，跳过早于当前时刻的航班。"],
        "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 1024,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n从时刻 0 开始，按计划逐次往返。C→D 方向从指针开始跳过所有早于当前时刻的航班，乘坐第一个不早于当前时刻的班次，抵达时间加 100；再以同样方法选择 D→C 航班。两个方向的时刻单调递增，各用一个指针即可。任一方向的航班耗尽则输出 -1。\n\n"
        "## 正确性\n\n每一段出发时刻表已升序。指针跳过的航班都早于到达时刻，不能乘坐；指针停下的第一班正是所有可乘航班中最早的一班。按定义乘坐后当前时间增加 100，继续处理下一段，因此逐段模拟始终选择题目要求的航班。若没有候选班次就无法继续计划行程，返回 -1；全部完成时当前时间即最后抵达时刻。\n\n"
        "## 复杂度\n\n设两个方向航班数为 n、m，往返次数为 k。每个指针只前进不后退，总时间 O(n+m+k)，额外空间 O(1)。"
    )
    write_json(OA / "packages" / f"{identifier}.json", package)
    (OA / "references" / f"{identifier}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", random_cases)
    write_json(OA / "mutants" / f"{identifier}.json", [{"name": name, "code": code} for name, code in mutants])
    write_json(OA / "editorials" / f"{identifier}.json", {"schemaVersion": 1, "id": identifier,
        "title": problem["title"], "explanation": editorial,
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"})
    write_json(OA / "candidate-batches" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
        "editorial": editorial, "authoredSolutions": [{"language": "python", "code": reference}],
    }]})
    write_json(OA / "source-evidence" / f"{batch}.json", {"schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master", "commit": COMMIT, "origin": "https://oamaster.com",
        "items": [{"id": identifier, "sourceUrl": source["sourceUrl"], "catalogContentHash": source["contentHash"],
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [624, 723]}],
            "resolvedSemantics": {"tripDuration": "100 minutes in each direction.",
                "selection": "For each leg take the earliest departure not earlier than the current arrival time; exact-time boarding is allowed by the source's bisect_left/lower_bound implementations.",
                "failure": "The source implementations return -1 if no eligible flight remains for a required leg.",
                "siteInputSupplement": "The source gives array parameters but no standard stdin/stdout format. This candidate encodes n, m, journeys followed by each sorted schedule on its own line."}}]})
    review_items = json.loads(REVIEW.read_text(encoding="utf-8"))["items"]
    review_reason = next(item["reason"] for item in review_items if item["id"] == identifier)
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": review_reason,
        "reason": "固定 MDX 已明确每段 100 分钟、数组按升序排列、journeys 范围及最大规模；同一抵达时刻可登机由来源 Python bisect_left 和 Java/C++ lower_bound 实现明确。候选仅补充标准输入输出协议，没有依赖缺失图片的未定义内容。120 个随机输入与独立逐段最早班次枚举 oracle、正式边界和两个正常退出错误实现均验证通过。"}]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "hiddenCases": sum(1 for case in cases if case["hidden"]), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(seen) - len(cases), "negativeControls": controls,
            "maxScheduleSizeStress": size, "stressJourneys": size}],
        "note": "本地独立逐段枚举 oracle、正式边界、最大数组规模指针压力与两个正常退出 mutant 验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, unique oracle={len(random_cases)}, mutants={len(controls)} killed, max n={size}")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    actual_blob = subprocess.check_output(["git", "rev-parse", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT, text=True).strip()
    raw_source = subprocess.check_output(["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT)
    assert actual_blob == RAW_BLOB
    assert hashlib.sha256(raw_source).hexdigest() == RAW_SHA256
    rng = random.Random(20261006)
    build(catalog, rng)


if __name__ == "__main__":
    main()
