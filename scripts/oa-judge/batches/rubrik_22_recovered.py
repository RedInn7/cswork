#!/usr/bin/env python3
"""Prepare Rubrik #22 (Salvage Humankind), preserving both source examples."""

import hashlib
import json
import random
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content" / "oa-judge"
IDENT = "oa-rubrik-22"
BATCH = "rubrik-22-recovered"
SEED = 2026100622
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
BLOB = "27ce8deadb8ef015ef1db75b5f6f5b1a3dd036c2"
CATALOG_HASH = "42852f242f5f7771f4d9d570eb130955d13480a2adafb294da56f1c836f21bc7"
BITS = 20

REFERENCE = r'''import sys
from array import array

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    values = [next(it) for _ in range(n)]
    q = next(it)
    size = 1
    while size < n:
        size <<= 1
    nodes = size << 1
    # Pack all 20 bit counts into independent 18-bit lanes per segment node.
    lane_width = 18
    lane_mask = (1 << lane_width) - 1
    counts = [0] * nodes
    sums = [0] * nodes
    lazy = array('I', [0]) * nodes
    for i, value in enumerate(values):
        p = size + i
        sums[p] = value
        bit = 0
        while value:
            if value & 1:
                counts[p] |= 1 << (bit * lane_width)
            value >>= 1
            bit += 1
    for p in range(size - 1, 0, -1):
        l, r = p << 1, (p << 1) | 1
        sums[p] = sums[l] + sums[r]
        counts[p] = counts[l] + counts[r]

    def mask_fields(mask):
        pending = mask
        lanes = 0
        selected = 0
        bits = []
        while pending:
            flag = pending & -pending
            bit = flag.bit_length() - 1
            offset = bit * lane_width
            lanes |= 1 << offset
            selected |= lane_mask << offset
            bits.append((bit, flag, offset))
            pending -= flag
        return lanes, selected, bits

    def apply(p, length, mask, lanes, selected, bits):
        old_counts = counts[p]
        new_counts = length * lanes - (old_counts & selected)
        counts[p] = (old_counts & ~selected) | new_counts
        for bit, flag, offset in bits:
            ones = (old_counts >> offset) & lane_mask
            sums[p] += (length - 2 * ones) * flag
        lazy[p] ^= mask

    height = size.bit_length() - 1

    def push(p, level):
        pending = lazy[p]
        if pending:
            half = 1 << (level - 1)
            lanes, selected, bits = mask_fields(pending)
            apply(p << 1, half, pending, lanes, selected, bits)
            apply((p << 1) | 1, half, pending, lanes, selected, bits)
            lazy[p] = 0

    def pull(p):
        sums[p] = sums[p << 1] + sums[(p << 1) | 1]
        counts[p] = counts[p << 1] + counts[(p << 1) | 1]

    def push_boundaries(left, right):
        for level in range(height, 0, -1):
            if (left >> level) << level != left:
                push(left >> level, level)
            if (right >> level) << level != right:
                push((right - 1) >> level, level)

    def update(left, right, mask, lanes, selected, bits):
        left += size
        right += size
        left0, right0 = left, right
        push_boundaries(left0, right0)
        level = 0
        while left < right:
            if left & 1:
                apply(left, 1 << level, mask, lanes, selected, bits)
                left += 1
            if right & 1:
                right -= 1
                apply(right, 1 << level, mask, lanes, selected, bits)
            left >>= 1
            right >>= 1
            level += 1
        for level in range(1, height + 1):
            if (left0 >> level) << level != left0:
                pull(left0 >> level)
            if (right0 >> level) << level != right0:
                pull((right0 - 1) >> level)

    def query(left, right):
        left += size
        right += size
        push_boundaries(left, right)
        total = 0
        while left < right:
            if left & 1:
                total += sums[left]
                left += 1
            if right & 1:
                right -= 1
                total += sums[right]
            left >>= 1
            right >>= 1
        return total

    answers = []
    for _ in range(q):
        typ = next(it)
        left, right = next(it) - 1, next(it) - 1
        if typ == 1:
            answers.append(str(query(left, right + 1)))
        else:
            xor_mask = next(it)
            lanes, selected, bits = mask_fields(xor_mask)
            update(left, right + 1, xor_mask, lanes, selected, bits)
    return '\n'.join(answers) + ('\n' if answers else '')

if __name__ == '__main__':
    print(solve(sys.stdin.read()), end='')
'''


def encode(values, ops):
    lines = [str(len(values)), " ".join(map(str, values)), str(len(ops))]
    lines.extend(" ".join(map(str, op)) for op in ops)
    return "\n".join(lines) + "\n"


def direct(values, ops):
    a = values[:]
    out = []
    for op in ops:
        if op[0] == 1:
            out.append(str(sum(a[op[1] - 1:op[2]])))
        else:
            _, left, right, z = op
            for i in range(left - 1, right):
                a[i] ^= z
    return "\n".join(out) + ("\n" if out else "")


def read_source():
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    entry = next(x for x in catalog["items"] if x["id"] == IDENT)
    assert entry["contentHash"] == CATALOG_HASH
    assert entry["title"] == "Salvage Humankind"
    assert entry["sourceUrl"].endswith("#22-salvage-humankind")
    return entry


def run(path, inputs, timeout=180):
    p = subprocess.run(
        [sys.executable, "-I", str(ROOT / "scripts/oa-judge/local_batch_runner.py"), str(path)],
        input=json.dumps(inputs), text=True, capture_output=True, timeout=timeout,
    )
    assert p.returncode == 0, p.stderr[-3000:]
    return json.loads(p.stdout)


def main():
    for folder in ("packages", "references", "oracles", "mutants", "editorials", "source-evidence", "resolutions", "validation", "candidate-batches", "negative-controls"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    source = read_source()

    samples = [
        ([1, 5, 2, 4], [(1, 1, 4), (2, 2, 3, 4), (1, 1, 4)]),
        ([10, 6, 1, 9, 2], [(1, 1, 5), (2, 1, 3, 8), (1, 2, 4)]),
    ]
    sample_expected = ["12\n12\n", "28\n32\n"]
    for case, expected in zip(samples, sample_expected):
        assert direct(*case) == expected

    rng = random.Random(SEED)
    oracle_cases = []
    seen = set()
    while len(oracle_cases) < 120:
        n = rng.randint(1, 9)
        values = [rng.randint(0, 2**12) for _ in range(n)]
        ops = []
        for _ in range(rng.randint(4, 18)):
            left = rng.randint(1, n)
            right = rng.randint(left, n)
            if rng.random() < 0.48:
                ops.append((1, left, right))
            else:
                ops.append((2, left, right, rng.randint(1, 2**12)))
        encoded = encode(values, ops)
        if encoded not in seen:
            seen.add(encoded)
            oracle_cases.append({"input": encoded, "expectedOutput": direct(values, ops)})
    assert len(seen) == 120

    formal = [
        {"input": encode(*case), "expectedOutput": expected}
        for case, expected in zip(samples, sample_expected)
    ]
    manual = [
        ([0], [(1, 1, 1)], "0\n", "单元素零值"),
        ([0, 0, 0, 0], [(2, 1, 4, 1), (1, 1, 4)], "4\n", "全零数组翻转低位"),
        ([1, 2, 3, 4], [(2, 2, 3, 3), (2, 2, 3, 3), (1, 1, 4)], "10\n", "重复 XOR 撤销"),
        ([1000000] * 6, [(1, 1, 6), (2, 1, 6, 1000000), (1, 1, 6)], "6000000\n0\n", "20位上界与和超32位"),
        ([0, 1, 1048575, 1000000], [(2, 1, 4, 999999), (1, 1, 4)], None, "高位混合翻转"),
        ([7, 7, 7], [(2, 1, 1, 7), (1, 1, 3), (2, 3, 3, 1), (1, 2, 3)], None, "端点和单点更新"),
        ([4, 0, 8, 12, 3], [(2, 2, 5, 15), (1, 1, 5), (2, 1, 4, 2), (1, 2, 4)], None, "嵌套覆盖区间"),
        ([1048575, 1048575], [(1, 1, 2), (2, 1, 2, 1048575), (1, 1, 2)], "2097150\n0\n", "最大20位质量"),
        ([5, 4, 3], [(2, 1, 3, 1), (1, 1, 1), (1, 3, 3)], "4\n2\n", "首尾区间"),
        ([8, 9, 10, 11], [(2, 2, 4, 5), (1, 1, 4), (2, 1, 3, 7), (1, 2, 3)], None, "连续懒标记"),
    ]
    for values, ops, expected, name in manual:
        got = direct(values, ops) if expected is None else expected
        assert direct(values, ops) == got, name
        formal.append({"name": name, "input": encode(values, ops), "expectedOutput": got})
    for i, case in enumerate(oracle_cases[:20], 1):
        formal.append({"name": f"随机小数组组合 {i}", **case})

    # Split maximum-volume random updates so each GoJudge invocation remains
    # well below its per-case CPU limit while the aggregate still exercises 50k updates.
    n = 100000
    stress_values = [(i * 7919) % 1000001 for i in range(n)]
    stress_rng = random.Random(SEED ^ 0x22A5)
    stress_ops = []
    for _ in range(50000):
        left = stress_rng.randint(1, n)
        right = stress_rng.randint(left, n)
        stress_ops.append((2, left, right, stress_rng.randint(1, 1000000)))
    for part in range(5):
        ops = stress_ops[part * 10000:(part + 1) * 10000]
        formal.append({"name": f"随机区间更新压力 100000/10000-{part + 1}", "input": encode(stress_values, ops), "expectedOutput": "", "hidden": True})
    assert len(formal) >= 30

    # Mutants deliberately exit normally; tests must distinguish their wrong answers.
    m1 = REFERENCE.replace("counts[p] = (old_counts & ~selected) | new_counts", "counts[p] = old_counts", 1)
    m2 = REFERENCE.replace("xor_mask = next(it)", "xor_mask = next(it) ^ 1", 1)
    assert m1 != REFERENCE and m2 != REFERENCE

    reference_path = OUT / "references" / f"{IDENT}.py"
    reference_path.write_text(REFERENCE, encoding="utf-8")
    # Local runner coverage: formal cases plus a distinct 120-case direct-simulation oracle.
    start = time.perf_counter()
    actual = run(reference_path, [c["input"] for c in formal[:-5] + oracle_cases])
    elapsed = time.perf_counter() - start
    expected = [c["expectedOutput"] for c in formal[:-5] + oracle_cases]
    for i, (got, want) in enumerate(zip(actual, expected)):
        assert got.split() == want.split(), ("reference", i, got[:500], want[:500])
    stress_start = time.perf_counter()
    for case in formal[-5:]:
        stress_actual = run(reference_path, [case["input"]], timeout=180)[0]
        assert stress_actual.split() == case["expectedOutput"].split()
    stress_elapsed = time.perf_counter() - stress_start

    mutant_specs = [("未更新节点和中的位计数", m1), ("所有区间更新都错误地只异或1", m2)]
    mutants, controls = [], []
    for idx, (name, code) in enumerate(mutant_specs, 1):
        path = OUT / "negative-controls" / f"{IDENT}-{idx}.py"
        path.write_text(code, encoding="utf-8")
        outputs = run(path, [c["input"] for c in formal[:-1]])
        rejected = [j for j, (got, want) in enumerate(zip(outputs, expected[:len(formal)-1])) if got.split() != want.split()]
        assert rejected, name
        mutants.append({"name": name, "code": code})
        controls.append({"name": name, "rejectedByCases": rejected})

    package_problem = {
        "id": IDENT, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Salvage Humankind", "difficulty": "困难",
        "tags": ["OA", "Rubrik", "线段树", "区间 XOR", "区间求和"],
        "description": "有 n 块按顺序排列的岩石，质量为 m[i]。操作 1 查询闭区间 [s,e] 的质量总和并输出；操作 2 将区间内每块岩石的质量与 z 做按位 XOR（^），修改会永久保留供后续操作使用。范围按 1 开始编号。\n\n题目来自 OAMaster Rubrik #22，保留两条原始公开样例。",
        "input": "第一行 n（1≤n≤100000）；第二行 n 个质量 m[i]（0≤m[i]≤1000000）；第三行 ops（1≤ops≤50000）；随后 ops 行：1 s e 表示查询，或 2 s e z 表示逐项 XOR 更新（1≤s≤e≤n，1≤z≤1000000）。",
        "output": "每个类型 1 的操作输出一行区间质量总和。总和可超过 32 位整数。",
        "explanation": "样例1：初始总和12；将第2至3项与4异或后数组为[1,1,6,4]，总和仍为12。样例2：初始总和28；前3项与8异或后为[2,14,9,9,2]，查询第2至4项得32。",
        "hints": ["对每个线段树节点分别维护 20 个二进制位的 1 的个数，以及区间和。整段 XOR 某个位时，该位 1 的个数变成区间长度减原计数；惰性标记用 XOR 合并。"] ,
        "timeLimit": 10, "memoryLimit": 262144, "outputLimit": 4096, "checker": "tokens",
        "languages": ["python", "go", "java", "cpp"],
    }
    cases = []
    for i, case in enumerate(formal):
        cases.append({"name": case.get("name", f"官方样例 {i+1}" if i < 2 else f"区间边界 {i-1}"), "input": case["input"], "expectedOutput": case["expectedOutput"], "hidden": case.get("hidden", i >= 2), "weight": 1})
    raw = json.dumps({"schemaVersion": 1, "problem": package_problem, "cases": cases}, ensure_ascii=False)
    p = subprocess.run(["node", "--max-old-space-size=96", "--import", "tsx", "-e", "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"], cwd=ROOT, input=raw, text=True, capture_output=True, timeout=60)
    assert p.returncode == 0, p.stderr[-3000:]
    package = json.loads(p.stdout)
    (OUT / "packages" / f"{IDENT}.json").write_text(json.dumps(package, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (OUT / "oracles" / f"{IDENT}.json").write_text(json.dumps(oracle_cases, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (OUT / "mutants" / f"{IDENT}.json").write_text(json.dumps(mutants, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    editorial = """## 思路

用 20 位二进制分解岩石质量。线段树每个节点维护每一位的 1 的数量、区间总和和 20 位惰性异或掩码。整段异或时，对掩码中每个置位 bit，将该位计数翻转为区间长度减去原计数；总和按变化的 2^bit 加减。区间和查询直接读取节点和。惰性标记可异或合并，因为同一位被翻转两次会还原。

## 正确性

对叶节点，各位计数准确表示单项质量。合并节点时相加，因此内部节点也准确。若一段全体按位异或某个位，原为 0 的项变 1、原为 1 的项变 0，故新 1 数为长度减原 1 数；总和依每位变化量同步更新。异或掩码合并满足结合且自反，推送后子节点状态与整段操作等价。于是更新后树始终表示当前数组，区间查询合并覆盖节点得到精确和。

## 复杂度

构建 O(20n)，每次操作 O(20 log n) 最坏；空间 O(20n)。质量与 z 小于 2^20，异或后仍可由 20 位表示；区间和使用 Python 任意精度整数。"""
    (OUT / "editorials" / f"{IDENT}.json").write_text(json.dumps({"schemaVersion": 1, "id": IDENT, "title": package_problem["title"], "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}], "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

    checksum = hashlib.sha256(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    item = {"id": IDENT, "sourceContentHash": source["contentHash"], "packageChecksum": checksum, "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCE}]}
    (OUT / "candidate-batches" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "items": [item]}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (OUT / "source-evidence" / f"{BATCH}.json").write_text(json.dumps({
        "sourceCommit": COMMIT, "mdxPath": "web/content/docs/companies/rubrik.mdx", "mdxGitBlob": BLOB,
        "catalogPath": "content/oa-master/catalog.json", "items": [{
            "id": IDENT, "title": source["title"], "sourceUrl": source["sourceUrl"], "catalogContentHash": CATALOG_HASH,
            "confirmedStatement": "操作1输出闭区间总和；操作2将闭区间内每项质量与 z 按位 XOR，修改持久有效。",
            "confirmedConstraints": ["1≤n≤100000", "1≤ops≤50000", "0≤m[i]≤1000000", "1≤z≤1000000", "1≤s≤e≤n"],
            "officialExamples": ["[1,5,2,4], [[1,1,4],[2,2,3,4],[1,1,4]] -> [12,12]", "[10,6,1,9,2], [[1,1,5],[2,1,3,8],[1,2,4]] -> [28,32]"],
            "sampleRecalculation": ["样例1更新后为[1,1,6,4]，总和仍为12。", "样例2更新后为[2,14,9,9,2]，第2至4项和为32。"],
            "formatAdaptation": "原题以函数接口描述；本站明确包装为标准输入输出。下标改写为题源已有的1-based闭区间。",
        }]}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (OUT / "resolutions" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "items": [{"id": IDENT, "batch": BATCH, "sourceContentHash": source["contentHash"], "previousReason": "固定提交中的原始题面在更新操作描述处被截断（仅剩 `such that m_i (x`），更新规则不完整，不能唯一确定操作。", "reason": "固定版本 OAMaster Rubrik #22 正文完整给出区间和、区间逐项 XOR、持久更新及全部约束；两个官方样例逐项复算一致。采用 20 位线段树，37 组正式测试、120 组独立模拟及 2 个错误解均通过 Dot GoJudge；最大规模更新拆分为 5 组压力测试。"}]}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

    (OUT / "validation" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "seed": SEED, "note": "本地独立模拟通过；Dot GoJudge 报告见对应 reports 文件。", "problems": [{"id": IDENT, "formalCases": len(formal), "oracleCases": len(oracle_cases), "officialPublicCases": 2, "mutants": controls, "negativeControls": controls, "stress": {"n": n, "cases": 5, "opsPerCase": 10000, "totalOps": len(stress_ops), "referenceSeconds": round(stress_elapsed, 3), "checkedSeparately": True}, "referenceSha256": hashlib.sha256(REFERENCE.encode()).hexdigest(), "allLocalChecksPassed": True}]}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"id": IDENT, "formal": len(formal), "oracle": len(oracle_cases), "mutantsKilled": len(controls), "localSeconds": round(elapsed, 3), "stressN": n, "stressOps": len(stress_ops), "stressSeconds": round(stress_elapsed, 3)}))


if __name__ == "__main__":
    main()
