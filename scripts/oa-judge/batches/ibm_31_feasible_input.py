"""Build a source-checked offline candidate for IBM #31.

Only writes artifacts for oa-ibm-31. The source asks to sell exactly m items,
so feasible inputs necessarily satisfy m <= sum(quantity); that consequence
is stated explicitly as a valid-input precondition instead of inventing an
insufficient-stock result. Both published sample outputs are preserved:
independent exhaustive optimization gives 55 and 11.
"""
from __future__ import annotations

from functools import lru_cache
import hashlib
import heapq
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
PID = "oa-ibm-31"
BATCH = "ibm-31-feasible-input"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "fastprep/IBM/ibm-get-maximum-amount.md"
SOURCE_BLOB = "638583073e075a671810f3366a899489b922eac9"
SOURCE_HASH = "1941a7434b4a11faf8d409615f26d656ab14ab31a52e1585414cc4fa6daf3cfc"
SEED = 20261006

REFERENCE = r'''import heapq
import sys

def solve(raw):
    tokens = list(map(int, raw.split()))
    if len(tokens) < 3:
        raise ValueError("expected n, m, and quantities")
    n, m = tokens[:2]
    quantity = tokens[2:]
    if not (1 <= n <= 100000 and 1 <= m <= 100000 and len(quantity) == n):
        raise ValueError("outside stated source bounds")
    if any(not 1 <= q <= 100000 for q in quantity):
        raise ValueError("outside stated source bounds")
    if m > sum(quantity):
        raise ValueError("valid input must contain at least m items")
    heap = [-q for q in quantity]
    heapq.heapify(heap)
    revenue = 0
    for _ in range(m):
        q = -heapq.heappop(heap)
        revenue += q
        if q > 1:
            heapq.heappush(heap, -(q - 1))
    return str(revenue)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(folder: str, filename: str, value: object) -> None:
    path = OUT / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode(quantity: tuple[int, ...] | list[int], m: int) -> str:
    return f"{len(quantity)} {m}\n" + " ".join(map(str, quantity)) + "\n"


def brute_oracle(quantity: tuple[int, ...] | list[int], m: int) -> str:
    """Exhaustively try each available type at each sale; unlike the heap reference."""
    @lru_cache(None)
    def visit(state: tuple[int, ...], remaining: int) -> int:
        if remaining == 0:
            return 0
        best = -1
        for i, q in enumerate(state):
            if q == 0:
                continue
            next_state = list(state)
            next_state[i] -= 1
            best = max(best, q + visit(tuple(next_state), remaining - 1))
        assert best >= 0, "oracle input must have sufficient inventory"
        return best

    return str(visit(tuple(quantity), m))


def execute(code: str, raw: str) -> str:
    result = subprocess.run([sys.executable, "-I", "-c", code], input=raw,
                            text=True, capture_output=True, check=True, timeout=4)
    return result.stdout.strip()


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    assert source["contentHash"] == SOURCE_HASH
    assert source["sourceUrl"].endswith("#31-get-maximum-amount")
    statement = source["statement"]
    assert "selling exactly `m` items" in statement
    assert "1 ≤ m ≤ 10⁵" in statement and "1 ≤ quantity[i] ≤ 10⁵" in statement
    assert "**Output:**\n```\n55\n```" in statement
    upstream = Path("/private/tmp/oa-master-readonly")
    raw_source = subprocess.run(["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=upstream,
                                text=True, capture_output=True, check=True).stdout
    blob = subprocess.run(["git", "rev-parse", f"{COMMIT}:{SOURCE_PATH}"], cwd=upstream,
                          text=True, capture_output=True, check=True).stdout.strip()
    assert blob == SOURCE_BLOB
    assert "selling exactly <code>m</code> items" in raw_source
    assert "55" in raw_source and "11" in raw_source

    sample1 = ((10, 10, 8, 9, 1), 6)
    sample2 = ((1, 2, 4), 4)
    # Independent exhaustive optimization confirms the source examples.
    assert brute_oracle(*sample1) == "55"
    assert brute_oracle(*sample2) == "11"
    assert execute(REFERENCE, encode(*sample1)) == "55"
    assert execute(REFERENCE, encode(*sample2)) == "11"

    public = [sample1, sample2, ((5, 5, 5), 7)]
    hidden = [
        ((1,), 1), ((7,), 7), ((7,), 6), ((2, 1), 3), ((2, 1), 2),
        ((3, 3), 1), ((3, 3), 2), ((3, 3), 3), ((3, 3), 4),
        ((1, 5, 2), 8), ((4, 4, 1), 7), ((8, 1, 8, 1), 10),
        ((100000, 1), 10), ((100000, 100000), 10),
        ((1, 2, 3, 4, 5), 15), ((4, 4, 4, 4), 16),
        ((2, 2, 2), 6), ((6, 2, 2), 8),
        ((1, 1, 1, 1, 1), 5), ((1, 1, 1, 1, 1), 4),
    ]
    cases = []
    for index, (quantity, m) in enumerate(public + hidden):
        expected = brute_oracle(quantity, m)
        raw = encode(quantity, m)
        actual = execute(REFERENCE, raw)
        assert actual == expected, (quantity, m, expected, actual)
        cases.append({
            "name": f"公开样例 {index + 1}" if index < len(public) else f"隐藏测试 {index - len(public) + 1}",
            "input": raw, "expectedOutput": expected + "\n",
            "hidden": index >= len(public), "weight": 1,
        })
    assert len([case for case in cases if case["hidden"]]) >= 20

    # Keep oracle inputs small enough for exhaustive state search, but vary
    # both quantity shape and m; de-duplicate by serialized input.
    rng = random.Random(SEED)
    oracle_rows = []
    seen = set()
    while len(oracle_rows) < 160:
        n = rng.randint(1, 5)
        quantity = tuple(rng.randint(1, 7) for _ in range(n))
        m = rng.randint(1, min(sum(quantity), 12))
        raw = encode(quantity, m)
        if raw in seen:
            continue
        expected = brute_oracle(quantity, m)
        actual = execute(REFERENCE, raw)
        assert actual == expected, (quantity, m, expected, actual)
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})
        seen.add(raw)
    assert len(seen) >= 120

    mutants = [
        {
            "name": "每次都选当前最小库存而非最大库存",
            "code": REFERENCE.replace("heap = [-q for q in quantity]", "heap = quantity.copy()").replace(
                "heapq.heappop(heap)", "-heapq.heappop(heap)").replace(
                "heapq.heappush(heap, -(q - 1))", "heapq.heappush(heap, q - 1)"),
        },
        {
            "name": "售出后把原库存数量原样放回，未递减价格",
            "code": REFERENCE.replace(
                "heapq.heappush(heap, -(q - 1))",
                "heapq.heappush(heap, -q)",
            ),
        },
    ]
    killed = []
    for mutant in mutants:
        # execute() uses check=True: any abnormal exit on any candidate case
        # fails generation, rather than being counted as a killed mutant.
        outputs = [execute(mutant["code"], case["input"]) for case in cases]
        rejected = [i for i, (output, case) in enumerate(zip(outputs, cases))
                    if output != case["expectedOutput"].strip()]
        assert rejected, (mutant["name"], "mutant survived")
        killed.append({"name": mutant["name"], "rejectedByCases": rejected})

    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "动态库存售卖最大收入（IBM OA）", "difficulty": "中等",
        "tags": ["OA", "IBM", "贪心", "优先队列"],
        "description": "有 n 类商品，第 i 类当前剩余 quantity[i] 件。每卖出一件，该件售价等于售出前该类的剩余件数。按最优顺序恰好售出 m 件，求最大总收入。有效输入须至少有 m 件库存；这是“恰好售出 m 件”的可行性条件，来源数值界未把它写出。来源两个样例输出均按规则通过独立穷举确认。",
        "input": "第一行 n、m，第二行 n 个整数 quantity[i]。遵循来源范围 1≤n,m≤100000、1≤quantity[i]≤100000；本站明确限定 m≤sum(quantity)，以保证恰好售出 m 件可行。",
        "output": "输出最大总收入。",
        "explanation": "每次选择当前剩余库存最多的品类，收入增加该库存数，然后库存减一。",
        "hints": ["一次售出会改变该类别下一件的价格。", "优先选择当前剩余数量最大的类别。"],
        "timeLimit": 2, "memoryLimit": 65536, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    editorial = """## 思路

用最大堆维护每类商品当前剩余数量。每次取出最大值 q，收入增加 q；售出后若 q>1，将 q−1 放回堆。恰好重复 m 次。

来源样例一按最优规则的前六个售价为 10、10、9、9、9、8，总计 55；样例二的售价为 4、3、2、2，总计 11。两例均与来源输出一致。

原约束没有明写总库存下界，但“恰好售出 m 件”要求输入可行，故本站将必要条件 `m ≤ sum(quantity)` 明示为有效输入域。该条件不规定任何库存不足时的行为，也不改变可行输入上的题意。

## 正确性

当前库存为 q 的商品若现在出售，可立刻获得 q；此后同一类别可获得的价格只会下降。若一次最优方案未先选当前最大库存类别，而选择库存更小的类别，将两类的首次选择次序交换：较大库存先卖的即时收益不低，且它后续逐次下降的序列逐项不低于较小库存序列，交换不会降低总收益。等价地，每一步选取最大当前价格均满足贪心选择性质。售出并将 q−1 放回堆精确呈现下一时刻的库存，归纳得到总收益最大。

## 复杂度

堆初始化 O(n)，每次销售至多一次弹出和插入，时间 O(n + m log n)，空间 O(n)。最大收入不超过 10^10，使用 64 位整数足够。"""

    schema_script = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    parsed = subprocess.run(["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
                           input=json.dumps({"schemaVersion": 1, "problem": problem, "cases": cases}, ensure_ascii=False),
                           text=True, capture_output=True)
    if parsed.returncode:
        raise RuntimeError(parsed.stderr)
    normalized = parsed.stdout
    package = json.loads(normalized)
    editorial_doc = {"schemaVersion": 1, "id": PID, "title": problem["title"],
                     "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
                     "sourceUrl": source["sourceUrl"], "sourceContentHash": SOURCE_HASH}
    manifest = {"schemaVersion": 1, "items": [{
        "id": PID, "sourceContentHash": SOURCE_HASH,
        "packageChecksum": sha(normalized.encode()), "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }]}
    evidence = {
        "schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master",
        "commit": COMMIT,
        "sourceFile": {"path": SOURCE_PATH, "gitBlobSha": SOURCE_BLOB},
        "catalogContentHash": SOURCE_HASH,
        "interpretation": {
            "feasibleInputSupplement": "m <= sum(quantity), logically necessary for the stated requirement to sell exactly m items; no behavior for infeasible input is added.",
            "sample1": {"sourceOutput": 55, "confirmedOutput": 55, "salePrices": [10, 10, 9, 9, 9, 8]},
        },
        "crossLanguageSourceAlgorithms": ["Python max-heap", "Java reverse priority queue", "C++ max-priority queue"],
    }
    review_path = next(path for path in sorted((OUT / "reviews").glob("*.json"))
                       if any(row["id"] == PID for row in json.loads(path.read_text(encoding="utf-8"))["items"]))
    previous = next(row for row in json.loads(review_path.read_text(encoding="utf-8"))["items"] if row["id"] == PID)
    resolution = {"schemaVersion": 1, "items": [{
        "id": PID, "batch": BATCH, "sourceContentHash": SOURCE_HASH,
        "previousReason": previous["reason"],
        "reason": "固定题意要求恰好售出 m 件，因此有效输入必然满足 m≤sum(quantity)；来源没有定义库存不足时的行为，本站仅将这个逻辑必要的可行性条件明示为有效输入域。重新独立穷举后，样例1前六个最优售价为 10、10、9、9、9、8、总额 55；样例2为 4、3、2、2、总额 11。两个来源输出都正确，不作样例修改。",
    }]}
    validation = {"schemaVersion": 1, "seed": SEED, "problems": [{
        "id": PID, "oracleCases": len(oracle_rows), "publicCases": len(public),
        "hiddenCases": sum(case["hidden"] for case in cases),
        "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode()),
    }], "note": "Exhaustive recursive state oracle explores each available item type at each sale; not tested against GoJudge."}

    for folder, value in (("packages", package), ("editorials", editorial_doc),
                          ("oracles", oracle_rows), ("mutants", mutants),
                          ("source-evidence", evidence), ("validation", validation),
                          ("candidate-batches", manifest), ("resolutions", resolution)):
        put(folder, f"{BATCH}.json" if folder in {"validation", "candidate-batches", "resolutions"} else f"{PID}.json", value)
    (OUT / "references" / f"{PID}.py").write_text(REFERENCE, encoding="utf-8")
    for index, mutant in enumerate(mutants, 1):
        path = OUT / "negative-controls" / f"{PID}-{index}.py"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(mutant["code"].rstrip() + "\n", encoding="utf-8")
    print(f"{PID}: {len(oracle_rows)} unique oracle inputs; {len(cases)} formal cases ({len(hidden)} hidden); 2 mutants killed")


if __name__ == "__main__":
    main()
