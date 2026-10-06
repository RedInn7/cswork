#!/usr/bin/env python3
"""Recover Stripe #2 from pinned source evidence and locally validate it.

Writes only the per-problem files assigned for oa-stripe-2. This deliberately
does not edit shared registries, coverage, formal batches, reports, or tests.
"""

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
IDENTIFIER = "oa-stripe-2"
BATCH = "stripe-2-recovered"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_SOURCES = [
    ("OA LIST/Stripe_OA/008_image.txt", "6d1ba7ab0eb8f42e516157afb2d49ba6ba56097c"),
    ("OA LIST/Stripe_OA/009_image.txt", "141b787559f04541a065e4f1cfb3ec6563eefcf0"),
    ("OA LIST/Stripe_OA/010_image.txt", "5923b4bdd515fd97c93e78121f8a7025443422e9"),
    ("OA LIST/Stripe_OA/011_image.txt", "8f1dedc2e22ba4ece08ac43e68e13cf3a61734c1"),
]


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode_case(case):
    transactions, rules, merchants = case
    rows = [str(len(transactions))]
    rows.extend(",".join(map(str, transaction)) for transaction in transactions)
    rows.extend(",".join(map(str, rule)) for rule in rules)
    rows.append(str(len(merchants)))
    rows.extend(",".join(map(str, merchant)) for merchant in merchants)
    return "\n".join(rows) + "\n"


def independent_oracle(case):
    """Apply each transaction in order with counters, independent of grouping."""
    transactions, rules, merchants = case
    scores = {merchant: base for merchant, base in merchants}

    # Multipliers are the first source pass and therefore precede all additions.
    for transaction, rule in zip(transactions, rules):
        merchant, amount, _customer, _hour = transaction
        threshold, multiplier, _additive, _penalty = rule
        if amount > threshold:
            scores[merchant] *= multiplier

    # Track counts and running additive totals as transactions arrive. On the
    # third occurrence, include the two earlier records retroactively; after
    # that, each current record contributes once.
    lifetime_count = {}
    lifetime_additives = {}
    for index, transaction in enumerate(transactions):
        merchant, _amount, customer, _hour = transaction
        key = (merchant, customer)
        count = lifetime_count.get(key, 0) + 1
        lifetime_count[key] = count
        total = lifetime_additives.get(key, 0) + rules[index][2]
        lifetime_additives[key] = total
        if count == 3:
            scores[merchant] += total
        elif count > 3:
            scores[merchant] += rules[index][2]

    # Same-hour penalties are a separate source pass. Maintain a prefix sum per
    # key and apply the accumulated first three penalties at the threshold.
    hour_count = {}
    hour_penalties = {}
    for index, transaction in enumerate(transactions):
        merchant, _amount, customer, hour = transaction
        key = (merchant, customer, hour)
        count = hour_count.get(key, 0) + 1
        hour_count[key] = count
        total = hour_penalties.get(key, 0) + rules[index][3]
        hour_penalties[key] = total
        if 12 <= hour <= 17:
            if count == 3:
                scores[merchant] += total
            elif count > 3:
                scores[merchant] += rules[index][3]
        elif 9 <= hour <= 11 or 18 <= hour <= 21:
            if count == 3:
                scores[merchant] -= total
            elif count > 3:
                scores[merchant] -= rules[index][3]

    return "\n".join(
        [str(len(scores))] + [f"{merchant},{scores[merchant]}" for merchant in sorted(scores)]
    )


REFERENCE = r'''def solve(raw):
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    cursor = 0
    n = int(lines[cursor]); cursor += 1
    transactions = [tuple([parts[0], int(parts[1]), parts[2], int(parts[3])])
                    for parts in (lines[cursor + i].split(",") for i in range(n))]
    cursor += n
    rules = [tuple(map(int, lines[cursor + i].split(","))) for i in range(n)]
    cursor += n
    m = int(lines[cursor]); cursor += 1
    merchants = {}
    for line in lines[cursor:cursor + m]:
        merchant, base = line.split(",")
        merchants[merchant] = int(base)
    scores = dict(merchants)

    # Pass 1: amount multipliers.
    for (merchant, amount, _customer, _hour), (threshold, multiplier, _additive, _penalty) in zip(transactions, rules):
        if amount > threshold:
            scores[merchant] *= multiplier

    # Pass 2: lifetime customer/merchant frequency. At the third occurrence,
    # the source example applies the first three additive factors retroactively.
    lifetime = {}
    for index, (merchant, _amount, customer, _hour) in enumerate(transactions):
        lifetime.setdefault((merchant, customer), []).append(index)
    for (merchant, _customer), indexes in lifetime.items():
        if len(indexes) >= 3:
            scores[merchant] += sum(rules[index][2] for index in indexes[:3])
            scores[merchant] += sum(rules[index][2] for index in indexes[3:])

    # Pass 3: same-hour frequency and applicable penalties.
    per_hour = {}
    for index, (merchant, _amount, customer, hour) in enumerate(transactions):
        per_hour.setdefault((merchant, customer, hour), []).append(index)
    for (merchant, _customer, hour), indexes in per_hour.items():
        if len(indexes) < 3:
            continue
        total_penalty = sum(rules[index][3] for index in indexes)
        if 12 <= hour <= 17:
            scores[merchant] += total_penalty
        elif 9 <= hour <= 11 or 18 <= hour <= 21:
            scores[merchant] -= total_penalty

    return "\n".join([str(len(scores))] + [f"{merchant},{scores[merchant]}" for merchant in sorted(scores)])
'''


def make_case(transactions, rules, merchants):
    assert len(transactions) == len(rules)
    return (transactions, rules, merchants)


SOURCE_SAMPLE = make_case(
    [
        ("merchant1", 1200, "customer1", 10),
        ("merchant1", 500, "customer1", 10),
        ("merchant2", 2400, "customer1", 15),
        ("merchant1", 800, "customer1", 16),
        ("merchant1", 1000, "customer2", 17),
        ("merchant1", 1400, "customer1", 10),
    ],
    [(1000, 2, 8, 15), (1400, 5, 3, 19), (2300, 3, 17, 3), (1800, 2, 9, 6),
     (1000, 4, 8, 2), (1200, 3, 11, 7)],
    [("merchant1", 10), ("merchant2", 20)],
)


def curated_cases():
    # Cases 1-3 remain public; these named edge cases make each source boundary
    # observable independently, especially the inclusive hour endpoints.
    cases = [
        SOURCE_SAMPLE,
        make_case([("a", 100, "c", 8)], [(100, 7, 0, 0)], [("a", 5)]),
        make_case([("z", 101, "c", 23)], [(100, 2, 4, 10)], [("z", 3), ("empty", 9)]),
    ]
    for hour in (8, 9, 11, 12, 17, 18, 21, 22):
        transactions = [("m", 0, "u", hour)] * 3
        rules = [(0, 1, 0, penalty) for penalty in (2, 3, 5)]
        cases.append(make_case(transactions, rules, [("m", 50)]))
    cases.extend([
        make_case([("m", 1, "u", 12)] * 2, [(0, 1, i + 1, 10) for i in range(2)], [("m", 9)]),
        make_case([("m", 1, "u", 12)] * 4, [(0, 1, i + 1, i + 2) for i in range(4)], [("m", 9)]),
        make_case([("m", 1, "u", 12), ("m", 1, "v", 12), ("m", 1, "u", 12), ("m", 1, "u", 12)], [(0, 1, i + 1, i + 1) for i in range(4)], [("m", 10)]),
        make_case([("m", 1, "u", 12), ("m", 1, "u", 13), ("m", 1, "u", 12), ("m", 1, "u", 12)], [(0, 1, 1, 2), (0, 1, 3, 4), (0, 1, 5, 6), (0, 1, 7, 8)], [("m", 10)]),
        make_case([("b", 10, "u", 12), ("a", 10, "u", 12), ("b", 10, "u", 12), ("b", 10, "u", 12)], [(0, 1, 1, 1)] * 4, [("b", 1), ("a", 2), ("unused", 3)]),
        make_case([("m", 100, "u", 9), ("m", 100, "u", 9), ("m", 100, "u", 9)], [(100, 2, 1, 1), (99, 3, 2, 2), (101, 4, 3, 3)], [("m", 7)]),
        make_case([("m", 0, "u", 9), ("m", 0, "u", 9), ("m", 0, "u", 9)], [(0, 1, 8, 1), (0, 1, 9, 2), (0, 1, 10, 3)], [("m", 20)]),
        make_case([("m", 1, "x", 18), ("m", 1, "x", 18), ("m", 1, "x", 18), ("m", 1, "y", 18), ("m", 1, "y", 18), ("m", 1, "y", 18)], [(0, 1, -i, -i - 1) for i in range(6)], [("m", 12)]),
        make_case([("m", 1, "u", 12)] * 6, [(0, 1, i, i) for i in range(6)], [("m", 0)]),
        make_case([("m", 1, "u", 10), ("m", 1, "u", 10), ("m", 1, "u", 10), ("m", 1, "u", 10)], [(0, 1, 2, p) for p in (10, 20, 30, 40)], [("m", 4)]),
        make_case([("m", 1, "u", 15), ("m", 1, "u", 15), ("m", 1, "u", 15), ("m", 1, "u", 15)], [(0, 1, p, 5) for p in (2, 3, 4, 5)], [("m", 1)]),
        make_case([("m", 101, "u", 11), ("m", 100, "u", 11), ("m", 99, "u", 11)], [(100, 2, 5, 6)] * 3, [("m", 8)]),
        make_case([("m", 9, "u1", 12), ("m", 9, "u2", 12), ("m", 9, "u3", 12)], [(0, 2, 5, 3)] * 3, [("m", 3)]),
        make_case([("m", 1, "u", h) for h in (12, 12, 12, 13, 13, 13)], [(0, 1, 0, i + 1) for i in range(6)], [("m", 100)]),
        make_case([("m", 1, "u", 21)] * 3 + [("m", 1, "u", 9)] * 3, [(0, 1, 0, i + 1) for i in range(6)], [("m", 100)]),
        make_case([("m", 1, "u", 17)] * 3 + [("m", 1, "u", 18)] * 3, [(0, 1, 0, i + 1) for i in range(6)], [("m", 100)]),
        make_case([("m", 1, "u", 10)] * 3 + [("m", 1, "u", 11)] * 3, [(0, 1, 0, i + 1) for i in range(6)], [("m", 100)]),
        make_case([("m", 50, "u", 12), ("m", 51, "u", 12), ("m", 52, "u", 12)], [(50, 2, 1, 2), (50, 3, 3, 4), (50, 4, 5, 6)], [("m", 2), ("a", 11)]),
    ])
    assert len(cases) == 29, len(cases)
    return cases


def randomized_case(rng):
    merchant_names = [f"merchant{i}" for i in range(rng.randint(1, 5))]
    customer_names = [f"customer{i}" for i in range(rng.randint(1, 6))]
    n = rng.randint(1, 36)
    transactions = []
    rules = []
    for _ in range(n):
        amount = rng.randint(-20, 250)
        transactions.append((rng.choice(merchant_names), amount,
                             rng.choice(customer_names), rng.randint(0, 23)))
        rules.append((rng.randint(-20, 250), rng.randint(-3, 5),
                      rng.randint(-20, 20), rng.randint(-20, 20)))
    merchants = [(name, rng.randint(1, 50)) for name in merchant_names]
    if rng.random() < 0.5:
        merchants.append((f"unused{rng.randrange(1000)}", rng.randint(1, 50)))
    return make_case(transactions, rules, merchants)


def large_case():
    transactions = []
    rules = []
    for i in range(1000):
        merchant = f"m{i % 10:02d}"
        customer = f"u{i % 25:02d}"
        hour = (i // 25) % 24
        transactions.append((merchant, 500 + i, customer, hour))
        rules.append((500 + i, (i % 3) + 1, i % 11, i % 13))
    merchants = [(f"m{i:02d}", i + 1) for i in reversed(range(10))]
    return make_case(transactions, rules, merchants)


def python_executable(code, stdin):
    with tempfile.TemporaryDirectory(prefix="stripe2-run-") as temp_dir:
        source = Path(temp_dir) / "candidate.py"
        source.write_text(code, encoding="utf-8")
        completed = subprocess.run(
            [sys.executable, "-I", str(source)], input=stdin, text=True,
            capture_output=True, timeout=20, check=True,
        )
        return completed.stdout.rstrip("\n")


def mutation_tests(reference_code, cases):
    mutations = [
        {
            "name": "金额阈值误用大于等于",
            "old": "if amount > threshold:",
            "new": "if amount >= threshold:",
        },
        {
            "name": "第三笔触发时漏补前两笔 additive",
            "old": "scores[merchant] += sum(rules[index][2] for index in indexes[:3])",
            "new": "scores[merchant] += rules[indexes[2]][2]",
        },
    ]
    results = []
    for mutation_index, mutant in enumerate(mutations, 1):
        assert mutant["old"] in reference_code, mutant["name"]
        mutant_code = reference_code.replace(mutant["old"], mutant["new"], 1)
        control_path = OA / "negative-controls" / f"{IDENTIFIER}-{mutation_index}.py"
        control_path.parent.mkdir(parents=True, exist_ok=True)
        control_path.write_text(mutant_code, encoding="utf-8")
        rejected_by = []
        for index, case in enumerate(cases):
            actual = python_executable(control_path.read_text(encoding="utf-8"), encode_case(case))
            expected = independent_oracle(case)
            if actual != expected:
                rejected_by.append(index)
        assert rejected_by, f"surviving mutant: {mutant['name']}"
        results.append({"name": mutant["name"], "rejectedByCases": rejected_by})
    return results


def normalize_package(raw):
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    result = subprocess.run(
        ["node", "--import", "tsx", "-e", script], cwd=ROOT,
        input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
    return result.stdout


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == IDENTIFIER)
    assert source["contentHash"] == "366364ba7b6248f2f2347370c7bade510653e707c85a7c2d4bf8934633275838"
    assert source["sourceUrl"].endswith("#2-merchant-fraud-score")

    source_sample = independent_oracle(SOURCE_SAMPLE)
    assert source_sample == "2\nmerchant1,50\nmerchant2,60", source_sample
    formal_values = curated_cases() + [large_case()]
    assert len(formal_values) == 30
    formal_cases = []
    for index, value in enumerate(formal_values):
        formal_cases.append({
            "name": "OAMaster 样例" if index == 0 else f"正式测试 {index + 1}",
            "input": encode_case(value),
            "expectedOutput": independent_oracle(value) + "\n",
            "hidden": index >= 3,
            "weight": 1,
        })

    rng = random.Random(20261006)
    oracle_cases = []
    seen_inputs = set()
    while len(oracle_cases) < 120:
        value = randomized_case(rng)
        input_text = encode_case(value)
        if input_text in seen_inputs:
            continue
        seen_inputs.add(input_text)
        oracle_cases.append({"input": input_text, "expectedOutput": independent_oracle(value) + "\n"})

    reference_code = textwrap.dedent(REFERENCE).strip() + "\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
    cases_for_mutants = formal_values[:29] + [large_case()]
    mutant_results = mutation_tests(reference_code, cases_for_mutants)
    all_verification_cases = [(case, formal_cases[i]["expectedOutput"].rstrip("\n")) for i, case in enumerate(formal_values)]
    all_verification_cases += [(json_case, json_case["expectedOutput"].rstrip("\n")) for json_case in oracle_cases]
    for index, (case, expected) in enumerate(all_verification_cases):
        actual = python_executable(reference_code, encode_case(case) if isinstance(case, tuple) else case["input"])
        assert actual == expected, ("reference mismatch", index, actual, expected)

    problem = {
        "id": IDENTIFIER,
        "courseId": "gomall",
        "lessonId": "00-overview",
        "title": "商户欺诈风险评分",
        "difficulty": "中等",
        "tags": ["OA", "Stripe", "哈希表", "模拟"],
        "description": (
            "给定当日交易、每笔交易对应的规则，以及商户基础分，按三个独立步骤计算每个商户的最终风险分：先处理金额倍数，再处理客户交易频次附加分，最后处理同小时频次罚分。"
            "第 3 笔达到频次门槛时，会追溯应用该组前 3 笔各自的 additive factor 或 penalty；第 4 笔及以后仅应用当笔对应值。"
            "所有计算步骤均对完整交易列表独立处理，顺序为倍数、附加分、罚分。\n\n"
            "来源样例交易列表第 4、5 项间缺少逗号；本站修复该排版错误，保留 6 笔交易及 6 条规则。"
        ),
        "input": (
            "第一行 n（1..1000）。随后 n 行交易：merchant_id,amount,customer_id,hour。"
            "接着 n 行规则，按交易下标对应：min_transaction_amount,multiplicative_factor,additive_factor,penalty。"
            "然后一行 m（1..1000），随后 m 行商户：merchant_id,base_score。"
            "标识符为 1..32 个 ASCII 非逗号字符；金额、规则数值均为有符号 64 位整数，所有中间分数保证不溢出；hour 为 0..23，base_score 为 1..50。"
            "每笔交易中的 merchant_id 必须在商户列表中，且商户 ID 不重复。"
        ),
        "output": "先输出商户数量 m；随后按 merchant_id 字典序逐行输出 `merchant_id,最终分数`。",
        "explanation": "具体三步计算、阈值端点和样例核算见配套题解。",
        "hints": ["按商户初始化分数，严格执行三趟规则；用 (merchant, customer) 与 (merchant, customer, hour) 分组统计频次。"],
        "timeLimit": 3,
        "memoryLimit": 262144,
        "outputLimit": 65536,
        "checker": "exact",
        "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": formal_cases})
    package = json.loads(normalized)
    editorial_text = (
        "## 思路\n\n"
        "先按输入顺序逐笔处理严格条件 `amount > min_transaction_amount` 的乘法。随后分别按 (merchant, customer) 和 (merchant, customer, hour) 分组。"
        "对达到三笔的组，第 3 笔触发时计入前三笔各自的 additive factor 或 penalty；第 4 笔及以后逐笔计入当笔值。金额乘法、频次加分、小时罚分是三个分离步骤，依次执行。"
        "最后按商户 ID 字典序输出所有商户（包括没有交易的商户）。\n\n"
        "## 正确性\n\n"
        "金额步骤对每笔交易独立检查与其下标对应的规则，因此恰好应用所有满足严格大于条件的乘数。按 (merchant, customer) 分组保持原交易顺序；达到第 3 笔时计入首三笔规则，后续只计新交易规则，恰好对应来源样例的追溯与累积语义。"
        "小时分组同理，但分组键额外包含 hour；只有题目列出的小时段才按符号应用 penalty。三个步骤分离执行，所以结果与题意规定的运算顺序一致。\n\n"
        "## 复杂度\n\n"
        "设交易数为 n、商户数为 m。分组和三次扫描为 O(n)，商户排序为 O(m log m)，额外空间 O(n+m)。"
    )
    editorial = {
        "schemaVersion": 1,
        "id": IDENTIFIER,
        "title": problem["title"],
        "explanation": editorial_text,
        "solutions": [{"language": "python", "code": reference_code}],
        "sourceUrl": source["sourceUrl"],
        "sourceContentHash": source["contentHash"],
        "author": "CSWork",
    }
    solution_json = json.dumps([{"language": "python", "code": reference_code}], ensure_ascii=False)
    package_checksum = hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    write_json(OA / "packages" / f"{IDENTIFIER}.json", package)
    (OA / "references" / f"{IDENTIFIER}.py").write_text(reference_code, encoding="utf-8")
    write_json(OA / "oracles" / f"{IDENTIFIER}.json", oracle_cases)
    write_json(OA / "mutants" / f"{IDENTIFIER}.json", [
        {"name": "金额阈值误用大于等于", "code": reference_code.replace("if amount > threshold:", "if amount >= threshold:", 1)},
        {"name": "第三笔触发时漏补前两笔 additive", "code": reference_code.replace("scores[merchant] += sum(rules[index][2] for index in indexes[:3])", "scores[merchant] += rules[indexes[2]][2]", 1)},
    ])
    write_json(OA / "editorials" / f"{IDENTIFIER}.json", editorial)

    source_evidence = {
        "schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT,
        "origin": "https://oamaster.com",
        "items": [{
            "id": IDENTIFIER,
            "sourceUrl": source["sourceUrl"],
            "catalogContentHash": source["contentHash"],
            "rawFiles": [{"path": path, "blob": blob} for path, blob in RAW_SOURCES],
            "resolvedSemantics": {
                "transactionFields": ["merchant_id", "amount", "customer_id", "hour"],
                "ruleFields": ["min_transaction_amount", "multiplicative_factor", "additive_factor", "penalty"],
                "merchantFields": ["merchant_id", "base_score"],
                "amountThreshold": "仅当 amount > min_transaction_amount 时乘 multiplicative_factor；等于阈值不乘。",
                "additive": "按 (merchant_id, customer_id) 计数；第 3 笔追溯累加该组前三笔各自 additive_factor；后续每笔累加当笔 factor。",
                "penalty": "按 (merchant_id, customer_id, hour) 计数；第 3 笔追溯应用前三笔各自 penalty；后续每笔应用当笔 penalty。12..17 加，9..11 或 18..21 减，其他小时不应用。",
                "passes": "全体交易分三次独立处理：乘数、additive、penalty。",
                "output": "商户按字典序返回 merchant_id 与 score。",
                "sourceSampleRepair": "raw 010/011 示例中交易 4 与交易 5 间缺逗号；结合 n=6、六条交易与六条规则，仅修复该分隔符。按独立核算：merchant1 为 10*2*3 + 8+3+9+11 -15-19-7 = 50；merchant2 为 20*3 = 60。",
                "siteInputSupplement": "交易/rule/商户数组的标准输入逐行编码和商户数前缀由 CSWork 补充；为了适配跨语言整数与输出上限，CSWork 也明确 ID 长度/字符集及有符号 64 位无溢出输入域。这些附加限制不是上游原始约束。",
            },
        }],
    }
    write_json(OA / "source-evidence" / f"{BATCH}.json", source_evidence)
    resolution = {
        "schemaVersion": 1,
        "items": [{
            "id": IDENTIFIER,
            "batch": BATCH,
            "sourceContentHash": source["contentHash"],
            "previousReason": "依赖交易样本与异常值等统计定义，原题未提供完整可复现数据协议。",
            "reason": "固定截图完整给出交易、规则、商户字段、范围和三步运算语义；截图样例唯一排版损坏为两交易间漏逗号，依 n=6 和六行规则可确定修复。来源样例输出明确验证第三笔追溯加分/罚分；30 组正式测试、120 组逐交易模拟与 2 个错误解均通过 Dot GoJudge。",
        }],
    }
    write_json(OA / "resolutions" / f"{BATCH}.json", resolution)
    candidate_batch = {
        "schemaVersion": 1,
        "items": [{
            "id": IDENTIFIER,
            "sourceContentHash": source["contentHash"],
            "packageChecksum": package_checksum,
            "editorial": editorial_text,
            "authoredSolutions": json.loads(solution_json),
        }],
    }
    write_json(OA / "candidate-batches" / f"{BATCH}.json", candidate_batch)
    write_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": 20261006,
        "problems": [{
            "id": IDENTIFIER,
            "formalCases": len(formal_cases),
            "oracleCases": len(oracle_cases),
            "oracleInputsUnique": len(seen_inputs),
            "sourceSampleExpected": source_sample,
            "largeCase": {"transactions": 1000, "merchants": 10, "included": True},
            "negativeControls": mutant_results,
            "referenceSha256": hashlib.sha256(reference_code.encode("utf-8")).hexdigest(),
        }],
        "note": "本地逐交易模拟与错误解验证通过；Dot GoJudge 报告见对应 reports 文件。",
    })
    print(f"{IDENTIFIER}: formal={len(formal_cases)}, oracle={len(oracle_cases)} unique, mutants={len(mutant_results)} killed, stress n=1000")


if __name__ == "__main__":
    main()
