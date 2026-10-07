"""Prepare the source-backed BNY Mellon and Optiver OA candidates."""

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
BATCH = "bny-optiver-recovered"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"

SOURCE = {
    "oa-bny-mellon-2": {
        "hash": "24eeedabdb7b3dda04f4b6fb2c8b7f13947d995ea69a7cd6f8ad20ee47746d30",
        "title": "Count Subsequences", "url": "https://oamaster.com/docs/companies/bny-mellon#2-count-subsequences",
        "path": "web/content/docs/companies/bny-mellon.mdx",
        "blob": "d2c4fbc6f20a8cf7c6e45e1f68c1eeef573dfbf4",
        "sha": "9cd05ade51e70d5c9b547a1c2545ee98df3e4cdb6392903b5234e81e773ab6ca",
        "range": [118, 160],
    },
    "oa-optiver-3": {
        "hash": "b3eda53e3279ee861de861d9a0d89385906d70163d8f87d0d84508d2e6bdf0e1",
        "title": "Days Between", "url": "https://oamaster.com/docs/companies/optiver#3-days-between",
        "path": "web/content/docs/companies/optiver.mdx",
        "blob": "e3a8b5c9234fe60dc8045f19a5f74e3cbe0292fe",
        "sha": "61a4bfa9ec4574136c2ff4620d9bc4578b78a54a0413bd5f6b381685a67191fe",
        "range": [203, 315],
    },
}

MOD = 1_000_000_007

MEX_REF = r'''import sys

MOD = 1_000_000_007

def solve(raw):
    data = list(map(int, raw.split()))
    n, left, right = data[:3]
    values = data[3:]
    counts = [0] * (n + 1)
    for value in values:
        if value <= n:
            counts[value] += 1
    powers = [1] * (n + 1)
    for i in range(1, n + 1):
        powers[i] = powers[i - 1] * 2 % MOD

    answer = prefix = 0
    product = 1
    remaining = n
    for mex in range(min(n, right) + 1):
        count = counts[mex]
        remaining -= count
        if mex >= left:
            answer = (answer + product * powers[remaining]) % MOD
        product = product * (powers[count] - 1) % MOD
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

DATE_REF = r'''import sys

MONTHS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
PREFIX = (0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334)

def is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

def ordinal(year, month, day):
    previous = year - 1
    total = 365 * previous + previous // 4 - previous // 100 + previous // 400
    total += PREFIX[month - 1]
    if month > 2 and is_leap(year):
        total += 1
    return total + day - 1

def solve(raw):
    y1, m1, d1, y2, m2, d2 = map(int, raw.split())
    return str(ordinal(y2, m2, d2) - ordinal(y1, m1, d1))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(code: str, raw: str) -> str:
    proc = subprocess.run(["python3", "-I", "-c", code], input=raw, text=True,
                          capture_output=True, timeout=20, check=True)
    return proc.stdout.strip()


def normalize(problem: dict, rows: list[tuple[str, str, str, bool]]) -> tuple[dict, str]:
    cases = [{"name": name, "input": raw, "expectedOutput": expected + "\n",
              "hidden": hidden, "weight": 1}
             for name, raw, expected, hidden in rows]
    raw = {"schemaVersion": 1, "problem": problem, "cases": cases}
    script = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
              "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
              "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
    proc = subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT,
                          input=json.dumps(raw, ensure_ascii=False), text=True,
                          capture_output=True, check=True)
    encoded = proc.stdout
    return json.loads(encoded), hashlib.sha256(encoded.encode()).hexdigest()


def source_item(identifier: str) -> dict:
    item = next(entry for entry in CATALOG["items"] if entry["id"] == identifier)
    assert item["contentHash"] == SOURCE[identifier]["hash"]
    return item


def editorial(title: str, idea: str, proof: str, complexity: str) -> str:
    return f"## 思路\n\n{idea}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{complexity}"


def build_mex(rng: random.Random) -> tuple[dict, dict]:
    identifier = "oa-bny-mellon-2"
    source = source_item(identifier)
    formal: list[tuple[list[int], int, int]] = [
        ([0, 1, 2], 1, 2),  # Source sample.
        ([0, 0], 1, 1), ([0, 0], 0, 0), ([1], 0, 1), ([2], 0, 3),
        ([0, 1], 2, 5), ([0, 1, 1], 1, 3), ([0, 0, 1, 1], 1, 2),
        ([3, 4, 5], 0, 4), ([0, 2, 2, 2], 0, 4), ([1, 1, 1], 0, 3),
        ([0, 1, 2, 3], 0, 4), ([0, 2, 3, 4], 1, 4),
        ([0, 0, 0, 0, 0], 0, 5), ([2, 2, 2, 2], 0, 4),
        ([0, 1, 1, 2, 4], 0, 5), ([0, 1, 2, 2, 3, 3], 2, 6),
        ([1_000_000_000], 0, 1), ([0, 1_000_000_000], 0, 2),
        ([0] * 100, 0, 100), ([0] * 300_000, 0, 300_000),
        ([1_000_000_000] * 300_000, 0, 0),
        (list(range(1000)), 1000, 1_000_000_000),
        ([0, 1] * 150_000, 0, 300_000),
    ]

    def brute(values: list[int], left: int, right: int) -> int:
        total = 0
        for mask in range(1 << len(values)):
            present = {values[i] for i in range(len(values)) if mask >> i & 1}
            mex = 0
            while mex in present:
                mex += 1
            if left <= mex <= right:
                total += 1
        return total % MOD

    def expected_for(values: list[int], left: int, right: int) -> int:
        n = len(values)
        if n <= 15:
            return brute(values, left, right)
        counts = [0] * (n + 1)
        for value in values:
            if value <= n:
                counts[value] += 1
        powers = [pow(2, i, MOD) for i in range(n + 1)]
        product_value = 1
        remaining = n
        answer = 0
        for mex in range(min(n, right) + 1):
            remaining -= counts[mex]
            if mex >= left:
                answer = (answer + product_value * powers[remaining]) % MOD
            product_value = product_value * (powers[counts[mex]] - 1) % MOD
        return answer

    def make_input(values: list[int], left: int, right: int) -> str:
        return f"{len(values)} {left} {right}\n" + " ".join(map(str, values)) + "\n"

    rows: list[tuple[str, str, str, bool]] = []
    for index, (values, left, right) in enumerate(formal):
        raw = make_input(values, left, right)
        expected = str(expected_for(values, left, right))
        assert run(MEX_REF, raw) == expected
        rows.append((f"样例与边界 {index + 1}", raw, expected, index >= 3))

    oracle_rows = []
    seen = set()
    while len(oracle_rows) < 120:
        values = [rng.randint(0, 12) for _ in range(rng.randint(1, 10))]
        left = rng.randint(0, len(values) + 2)
        right = rng.randint(left, len(values) + 4)
        raw = make_input(values, left, right)
        if raw in seen:
            continue
        seen.add(raw)
        expected = str(brute(values, left, right))
        assert run(MEX_REF, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    dedupe_mutant = MEX_REF.replace("counts[value] += 1", "counts[value] = 1")
    include_k_mutant = MEX_REF.replace("remaining -= count", "remaining -= count\n        count_at_k = count").replace(
        "powers[count] - 1", "powers[count_at_k]")
    mutants = [{"name": "相同数值按不同值而非位置去重", "code": dedupe_mutant},
               {"name": "错误地允许选择 MEX 本身", "code": include_k_mutant}]
    for mutant in mutants:
        mutant["rejectedByCases"] = [i for i, (values, left, right) in enumerate(formal)
                                     if run(mutant["code"], make_input(values, left, right))
                                     != str(expected_for(values, left, right))]
        assert mutant["rejectedByCases"], mutant["name"]

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "统计 MEX 落在区间内的子序列", "difficulty": "中等",
        "tags": ["OA", "BNY Mellon", "子序列", "MEX", "组合计数"],
        "description": "给定数组 arr，统计其 MEX 位于闭区间 [l,r] 的子序列数量。子序列由选择原数组中的若干位置构成，空子序列也计入；不同位置选择即使值序列相同也分别计数。答案对 1,000,000,007 取模。",
        "input": "第一行输入 n、l、r，第二行输入 n 个整数 arr[i]。原题范围：1≤n≤3×10⁵，0≤arr[i]≤10⁹，0≤l≤r≤10⁹。",
        "output": "输出 MEX 位于 [l,r] 的位置子序列数量，对 1,000,000,007 取模。",
        "explanation": "原题对 subsequence 的定义是删除任意位置元素且保留顺序，并明确空子序列 MEX=0；源解公式 (2^c−1) 也确认相同值按不同位置计数。",
        "hints": ["若 MEX=k，则每个 0..k−1 至少选一个、值 k 一个也不选、大于 k 的元素可任意选。"],
        "timeLimit": 5, "memoryLimit": 262144, "outputLimit": 1024,
        "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    pkg, checksum = normalize(problem, rows)
    text = editorial(problem["title"],
        "令 cnt[v] 为值 v 在原数组中的出现次数。MEX=k 的位置子序列必须对每个 v<k 至少选一个位置（有 2^cnt[v]−1 种），不选任何值为 k 的位置，而所有值>k 的位置可自由选择（共 2^rest 种）。因此贡献为这些因子的乘积。只需枚举 k≤n，因为长度 n 的子序列不可能有更大的 MEX。",
        "固定 k，MEX 恰为 k 当且仅当子序列至少含一个每个小于 k 的值、不含 k、并可任意选择大于 k 的元素。对每个 v<k，有 2^cnt[v]−1 种非空位置子集；值 k 的选择唯一为空；其余位置有 2^rest 种选择。位置集合决定唯一子序列选择，所以乘积恰好统计所有 MEX=k 的子序列且无重复。不同 k 的 MEX 互斥，将区间内贡献相加即得答案。MEX≤n，故扫描至 min(n,r) 足够。",
        "时间 O(n)，空间 O(n)；n≤3×10⁵。")
    reference = MEX_REF.strip() + "\n"
    return ({"id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
             "editorial": text, "authoredSolutions": [{"language": "python", "code": reference}]},
            {"package": pkg, "reference": reference, "oracle": oracle_rows,
             "mutants": mutants, "editorial": {"schemaVersion": 1, "id": identifier,
                "title": problem["title"], "explanation": text,
                "solutions": [{"language": "python", "code": reference}],
                "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"},
             "validation": {"id": identifier, "formalCases": len(rows),
                "hiddenFormalCases": sum(row[3] for row in rows), "oracleCases": len(oracle_rows),
                "oracleInputsUnique": len(seen),
                "negativeControls": [{"name": m["name"], "rejectedByCases": m["rejectedByCases"]} for m in mutants]}})


def leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def ordinal_slow(year: int, month: int, day: int) -> int:
    months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    days = sum(366 if leap(y) else 365 for y in range(1, year))
    days += sum(months[:month - 1])
    if month > 2 and leap(year):
        days += 1
    return days + day - 1


def date_input(first: tuple[int, int, int], second: tuple[int, int, int]) -> str:
    return " ".join(map(str, first + second)) + "\n"


def build_dates(rng: random.Random) -> tuple[dict, dict]:
    identifier = "oa-optiver-3"
    source = source_item(identifier)
    formal = [
        ((2010, 5, 1), (2011, 5, 1)),
        ((2020, 2, 27), (2020, 3, 1)),
        ((2019, 12, 31), (2020, 1, 1)),
        ((1900, 2, 28), (1900, 3, 1)),
        ((2000, 2, 28), (2000, 3, 1)),
        ((1, 1, 1), (1, 1, 2)),
        ((1, 1, 1), (9999, 12, 31)),
        ((4, 2, 28), (4, 3, 1)),
        ((100, 2, 28), (100, 3, 1)),
        ((400, 2, 28), (400, 3, 1)),
        ((2024, 2, 29), (2024, 3, 1)),
        ((2023, 3, 1), (2024, 3, 1)),
        ((2023, 1, 1), (2023, 12, 31)),
        ((9998, 12, 31), (9999, 1, 1)),
        ((1600, 2, 28), (1600, 3, 1)),
        ((1700, 2, 28), (1700, 3, 1)),
        ((1800, 2, 28), (1800, 3, 1)),
        ((2400, 2, 28), (2400, 3, 1)),
        ((2001, 1, 31), (2001, 2, 1)),
        ((1999, 12, 30), (2000, 1, 2)),
        ((2024, 1, 1), (2025, 1, 1)),
        ((2024, 2, 29), (2025, 2, 28)),
        ((9999, 1, 1), (9999, 12, 31)),
        ((1, 12, 31), (2, 1, 1)),
    ]
    rows: list[tuple[str, str, str, bool]] = []
    for index, (first, second) in enumerate(formal):
        raw = date_input(first, second)
        expected = str(ordinal_slow(*second) - ordinal_slow(*first))
        assert run(DATE_REF, raw) == expected
        rows.append((f"样例与边界 {index + 1}", raw, expected, index >= 3))

    month_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    def random_date(year: int) -> tuple[int, int, int]:
        month = rng.randint(1, 12)
        limit = month_days[month - 1] + int(month == 2 and leap(year))
        return year, month, rng.randint(1, limit)

    oracle_rows = []
    seen = set()
    while len(oracle_rows) < 120:
        first_year = rng.randint(1, 9998)
        first = random_date(first_year)
        second = random_date(rng.randint(first_year, 9999))
        if ordinal_slow(*first) >= ordinal_slow(*second):
            continue
        raw = date_input(first, second)
        if raw in seen:
            continue
        seen.add(raw)
        expected = str(ordinal_slow(*second) - ordinal_slow(*first))
        assert run(DATE_REF, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    century_mutant = DATE_REF.replace("year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)", "year % 4 == 0")
    no_leap_day_mutant = DATE_REF.replace("if month > 2 and is_leap(year):", "if False and month > 2 and is_leap(year):")
    mutants = [{"name": "把所有 4 的倍数年份都当闰年", "code": century_mutant},
               {"name": "遗漏当年闰日", "code": no_leap_day_mutant}]
    for mutant in mutants:
        mutant["rejectedByCases"] = [i for i, (first, second) in enumerate(formal)
                                     if run(mutant["code"], date_input(first, second)) != rows[i][2]]
        assert mutant["rejectedByCases"], mutant["name"]

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "计算两个日期之间的天数", "difficulty": "简单",
        "tags": ["OA", "Optiver", "日期", "闰年"],
        "description": "给定两个有效日期，且第一个早于第二个，计算两日期之间经过的天数；不使用系统日期对象或日期差函数。",
        "input": "输入六个整数 year1 month1 day1 year2 month2 day2。月份和日期必须组成有效的前推格里历日期，且第一日期早于第二日期。原题未限制年份；本站明确限制 1≤year1,year2≤9999。",
        "output": "输出两日期相差的天数，不包含起始日。",
        "explanation": "采用公历闰年规则：能被 4 整除的年份为闰年，但整百年除非也能被 400 整除。年份上限 9999 是本站为保障 int 输出安全增加的限制，不是原题约束。",
        "hints": ["将日期转换成从公元 1 年 1 月 1 日起的序号，再相减。完整年份可用闰年计数公式一次计算。"],
        "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 1024,
        "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    pkg, checksum = normalize(problem, rows)
    text = editorial(problem["title"],
        "定义日期序号为该日期之前经过的天数。年份 y 之前的闰年数为 floor((y−1)/4)−floor((y−1)/100)+floor((y−1)/400)；加上平年总天数、当年此前完整月份和 day−1。答案是第二个序号减第一个。",
        "Gregorian 年 y 之前共有 y−1 个完整年份，其中闰年数由 4 年一闰、100 年不闰、400 年再闰的容斥公式精确给出。月份前缀表加上闰年 2 月后的额外一天和 day−1，得到从公元 1 年 1 月 1 日起的精确经过天数。两个日期序号之差即经过天数；题目保证顺序，因此无需取绝对值。",
        "时间 O(1)，空间 O(1)。本站年份范围内答案不超过 3,652,058，int32 安全。")
    reference = DATE_REF.strip() + "\n"
    return ({"id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
             "editorial": text, "authoredSolutions": [{"language": "python", "code": reference}]},
            {"package": pkg, "reference": reference, "oracle": oracle_rows,
             "mutants": mutants, "editorial": {"schemaVersion": 1, "id": identifier,
                "title": problem["title"], "explanation": text,
                "solutions": [{"language": "python", "code": reference}],
                "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"},
             "validation": {"id": identifier, "formalCases": len(rows),
                "hiddenFormalCases": sum(row[3] for row in rows), "oracleCases": len(oracle_rows),
                "oracleInputsUnique": len(seen),
                "negativeControls": [{"name": m["name"], "rejectedByCases": m["rejectedByCases"]} for m in mutants]}})


def persist(identifier: str, files: dict) -> None:
    write_json(OA / "packages" / f"{identifier}.json", files["package"])
    (OA / "references" / f"{identifier}.py").write_text(files["reference"], encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", files["oracle"])
    write_json(OA / "mutants" / f"{identifier}.json", files["mutants"])
    write_json(OA / "editorials" / f"{identifier}.json", files["editorial"])


def main() -> None:
    rng = random.Random(SEED)
    mex_entry, mex_files = build_mex(rng)
    date_entry, date_files = build_dates(rng)
    for identifier, files in (("oa-bny-mellon-2", mex_files), ("oa-optiver-3", date_files)):
        persist(identifier, files)

    write_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1, "items": [mex_entry, date_entry]})
    evidence = []
    for identifier in ("oa-bny-mellon-2", "oa-optiver-3"):
        meta = SOURCE[identifier]
        evidence.append({"id": identifier, "sourceUrl": meta["url"], "catalogContentHash": meta["hash"],
            "rawFiles": [{"path": meta["path"], "blob": meta["blob"], "sha256": meta["sha"],
                          "lineRange": meta["range"]}],
            "resolvedSemantics": {"sourceTitle": meta["title"],
                "siteInputSupplement": "标准输入协议为本站补充；Optiver 年份上限 9999 也是本站限制，非源题约束。"}})
    write_json(OA / "source-evidence" / f"{BATCH}.json", {"schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master", "commit": COMMIT,
        "origin": "https://oamaster.com", "items": evidence})
    write_json(OA / "resolutions" / f"{BATCH}.json", {"schemaVersion": 1, "items": [
        {"id": "oa-bny-mellon-2", "batch": BATCH, "sourceContentHash": SOURCE["oa-bny-mellon-2"]["hash"],
         "previousReason": "源题数组约束句截断为“where 1A subsequence...”，缺少 arr[i] 的合法范围/数据域；公式会依赖每个值频次，无法确认边界与重复语义。",
         "reason": "固定源后续约束明确 n≤3×10⁵、0≤arr[i]≤10⁹、0≤l≤r≤10⁹；开头 where 1A 是不影响后续约束的损坏残片。子序列按位置计数由题面定义及源解 (2^cnt−1) 确认；样例 3 正确。120 组独立子集穷举 oracle、重复值和 30 万项边界及两个错误实现通过 GoJudge。"},
        {"id": "oa-optiver-3", "batch": BATCH, "sourceContentHash": SOURCE["oa-optiver-3"]["hash"],
         "previousReason": "原题只有月份范围和有效日期保证，没有年份上界；返回类型为 int，无法保证跨任意合法年份的天数差可由 int 表示，不能自行添加年份限制。",
         "reason": "三个原始样例与公历经过天数一致，源解明确采用 4/100/400 闰年规则。本站明确补充 1≤year≤9999，此时最大差 3,652,058，int32 安全。包含世纪闰年、完整年份跨度、120 个慢速逐年独立 oracle 和两个错误实现，并通过 GoJudge。"}
    ]})
    write_json(OA / "validation" / f"{BATCH}.json", {"schemaVersion": 1, "seed": SEED,
        "problems": [mex_files["validation"], date_files["validation"]],
        "note": "确定性本地差分、边界和错误实现验证；GoJudge 报告另行保存。"})
    print("prepared", BATCH, "local formal/oracle/mutant checks passed")


if __name__ == "__main__":
    main()
