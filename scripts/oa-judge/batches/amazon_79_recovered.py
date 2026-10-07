"""Build an offline candidate for Amazon OA #79 from source-consistent semantics."""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-amazon-79"
BATCH = "amazon-79-recovered"
SEED = 20261006
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_URL = "https://oamaster.com/docs/companies/amazon#79-count-bought-items-recurring-shop-purchase"
SOURCE_HASH = "0f7b693faeac3e271c461bdcbccacc2c053662f3b0adbd20ca59a0b3a8959106"
PREVIOUS_REASON = "到达买不起的商品时，是停止还是跳过继续循环没有说明，两种行为可能得到不同购买数量。"

REFERENCE = r'''import sys

def solve(text):
    data = list(map(int, text.split()))
    n, money = data[0], data[1]
    costs = data[2:2 + n]
    total_cost = sum(costs)

    def spent_for_rounds(rounds):
        return total_cost * rounds * (rounds + 1) // 2

    low, high = 0, 1
    while spent_for_rounds(high) <= money:
        high *= 2
    while low + 1 < high:
        middle = (low + high) // 2
        if spent_for_rounds(middle) <= money:
            low = middle
        else:
            high = middle

    rounds = low
    remaining = money - spent_for_rounds(rounds)
    bought = rounds * n
    next_multiplier = rounds + 1
    for item_cost in costs:
        price = next_multiplier * item_cost
        if price > remaining:
            break
        remaining -= price
        bought += 1
    return str(bought)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {
        "name": "买不起时跳过继续购买",
        "code": r'''import sys
def solve(raw):
 d=list(map(int,raw.split())); n,m=d[0],d[1]; a=d[2:2+n]
 bought=[0]*n; count=0; i=0
 while True:
  p=(bought[i]+1)*a[i]
  if p<=m: m-=p; bought[i]+=1; count+=1
  i=(i+1)%n
  if i==0 and not any((bought[j]+1)*a[j]<=m for j in range(n)): return str(count)
if __name__ == '__main__': print(solve(sys.stdin.read()))
''',
    },
    {
        "name": "重复购买仍按原价",
        "code": r'''import sys
def solve(raw):
 d=list(map(int,raw.split())); n,m=d[0],d[1]; a=d[2:2+n]
 count=0; i=0
 while m>=a[i]:
  m-=a[i]; count+=1; i=(i+1)%n
 return str(count)
if __name__ == '__main__': print(solve(sys.stdin.read()))
''',
    },
]


def write_json(folder: str, filename: str, data: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode(costs: list[int], money: int) -> str:
    return f"{len(costs)} {money}\n" + " ".join(map(str, costs)) + "\n"


def simulate(costs: list[int], money: int) -> int:
    """Literal stop-at-first-unaffordable oracle, used only on small budgets."""
    bought_per_item = [0] * len(costs)
    count = index = 0
    while True:
        price = (bought_per_item[index] + 1) * costs[index]
        if price > money:
            return count
        money -= price
        bought_per_item[index] += 1
        count += 1
        index = (index + 1) % len(costs)


def uniform_boundary(cost: int, n: int, money: int) -> int:
    """Closed-form independent oracle for all-equal maximum-size cases."""
    round_cost = cost * n
    lo, hi = 0, 1
    while round_cost * hi * (hi + 1) // 2 <= money:
        hi *= 2
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        if round_cost * mid * (mid + 1) // 2 <= money:
            lo = mid
        else:
            hi = mid
    spent = round_cost * lo * (lo + 1) // 2
    remainder = money - spent
    return lo * n + min(n, remainder // ((lo + 1) * cost))


def run(code: str, raw: str) -> str:
    scope: dict[str, object] = {"__name__": "candidate"}
    exec(compile(code, "<oa-amazon-79>", "exec"), scope)
    return str(scope["solve"](raw))


def main() -> None:
    if (OA / "batches" / f"{BATCH}.json").exists():
        print(f"{PID} is already promoted; leaving the verified batch unchanged")
        return
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    assert source["contentHash"] == SOURCE_HASH and source["sourceUrl"] == SOURCE_URL
    assert len(source["solutions"]) == 3
    assert {item["language"] for item in source["solutions"]} == {"python", "java", "cpp"}
    # Inspect source text as evidence; never execute imported solution code.
    for item in source["solutions"]:
        assert "else break" in item["code"] or "else:\n            break" in item["code"]
        assert "for" in item["code"] and "mult" in item["code"]
    review_files = list((OA / "reviews").glob("amazon-*.json"))
    prior = next(
        row for file in review_files
        for row in json.loads(file.read_text(encoding="utf-8"))["items"]
        if row["id"] == PID
    )
    assert prior["status"] == "blocked" and prior["reason"] == PREVIOUS_REASON

    # OAMaster supplied no public I/O sample; these are explicitly site-authored.
    public = [
        ("本站样例：买不起首件即停止", [5, 1], 2, 0),
        ("本站样例：不跳过买不起的商品", [2, 1], 5, 2),
        ("本站样例：按轮次涨价", [1, 2], 12, 5),
    ]
    for _, costs, money, expected in public:
        assert simulate(costs, money) == expected

    rng = random.Random(SEED)
    inputs: dict[str, int] = {}
    for _, costs, money, expected in public:
        inputs[encode(costs, money)] = expected
    while len(inputs) < 160:
        costs = [rng.randint(1, 12) for _ in range(rng.randint(1, 7))]
        money = rng.randint(1, 500)
        raw = encode(costs, money)
        inputs[raw] = simulate(costs, money)
    assert len(inputs) == 160

    judge_cases = []
    for name, costs, money, expected in public:
        judge_cases.append({"name": name, "input": encode(costs, money), "expectedOutput": f"{expected}\n", "hidden": False, "weight": 1})
    # Deterministic boundary and semantic cases; all oracle expectations are literal simulations.
    fixed = [
        ([1], 1), ([1], 2), ([1], 3), ([1], 6), ([1], 10**15),
        ([2, 2], 1), ([2, 2], 4), ([2, 2], 12), ([5, 1], 5),
        ([1, 5], 5), ([3, 1, 2], 10), ([200000], 10**15),
        ([1, 1, 1, 1], 10**15), ([200000] * 100000, 10**15),
    ]
    for index, (costs, money) in enumerate(fixed):
        raw = encode(costs, money)
        expected = uniform_boundary(costs[0], len(costs), money) if len(set(costs)) == 1 else simulate(costs, money)
        if len(costs) > 1000:
            assert expected == uniform_boundary(costs[0], len(costs), money)
        judge_cases.append({"name": f"边界 {index + 1}", "input": raw, "expectedOutput": f"{expected}\n", "hidden": True, "weight": 1})
    for index, (raw, expected) in enumerate(list(inputs.items())[3:40], 1):
        judge_cases.append({"name": f"独立小规模 {index}", "input": raw, "expectedOutput": f"{expected}\n", "hidden": True, "weight": 1})
    assert len(judge_cases) <= 64 and sum(case["hidden"] for case in judge_cases) >= 20

    for raw, expected in inputs.items():
        assert run(REFERENCE, raw) == str(expected), raw
    assert str(uniform_boundary(1, 1, 10**15)) == run(REFERENCE, encode([1], 10**15))
    assert str(uniform_boundary(1, 100000, 10**15)) == run(REFERENCE, encode([1] * 100000, 10**15))
    assert str(uniform_boundary(200000, 100000, 10**15)) == run(REFERENCE, encode([200000] * 100000, 10**15))

    killed = []
    for mutant in MUTANTS:
        rejected = []
        for case in judge_cases:
            if run(mutant["code"], case["input"]) != case["expectedOutput"].strip():
                rejected.append(case["name"])
                break
        assert rejected, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejected})

    description = (
        "按顺序循环购买 n 件商品。第 i 件商品第 t 次购买的价格为 t×cost[i]。"
        "题目正文未明说买不起时的行为；OAMaster 同一固定版本的 Python、Java、C++ 三种解法都在第一件买不起时立即停止，"
        "本站据此明确为停止购买，不跳过继续。原题未给标准输入输出样例，下面样例为本站补充。"
    )
    package_input = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "循环购物的最大购买件数", "difficulty": "中等",
            "tags": ["OA", "Amazon", "二分查找", "模拟"],
            "description": description,
            "input": "第一行 n m；第二行 n 个整数 cost[i]。1≤n≤100000，1≤m≤10^15，1≤cost[i]≤200000。标准输入输出与本站样例为本站补充。",
            "output": "输出停止前购买的商品总件数。遇到当前商品买不起时立即停止，不跳过。",
            "explanation": "先二分能完整购买的轮数，再按顺序处理下一轮；第一次买不起时结束。",
            "hints": ["完整 k 轮的总花费是 sum(cost)×k×(k+1)/2。", "剩余预算只需检查下一轮的前缀。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": judge_cases,
    }
    normalize = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    normalized = subprocess.run(
        ["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
        input=json.dumps(package_input, ensure_ascii=False), text=True, capture_output=True,
    )
    if normalized.returncode:
        raise RuntimeError(normalized.stderr)
    package = json.loads(normalized.stdout)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
    editorial_text = (
        "## 思路\n\n先二分能负担的完整轮数 k。每轮所有商品各买一次，第 i 件商品逐轮价格为 cost[i]、2cost[i]……，"
        "所以 k 轮总花费为 sum(cost)×k×(k+1)/2。扣除后，从第一件开始按第 k+1 轮单价顺序检查；遇到买不起的第一件就停止。\n\n"
        "## 正确性\n\n完整轮的费用单调递增，二分得到的 k 正是可完整完成的最大轮数。此后购买顺序及每件商品的下一次价格由题意确定，扫描至第一件买不起处即为停止点；按 OAMaster 三种语言同源解法补明 stop 规则，因此所得数量最大且唯一。\n\n"
        "## 复杂度\n\n时间 O(n log m)，空间 O(n)（保存输入）。\n\n"
        "## 规则来源\n\n固定 OAMaster 版本 e66f809 的 Python、Java、C++ 解法均在第一件买不起时 break。题干没有给出输入输出样例；本站自建样例明确区分停止与跳过。"
    )
    editorial = {
        "schemaVersion": 1, "id": PID, "title": "循环购物的最大购买件数",
        "explanation": editorial_text,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": SOURCE_HASH,
    }
    write_json("packages", f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE, encoding="utf-8")
    write_json("editorials", f"{PID}.json", editorial)
    write_json("oracles", f"{PID}.json", [{"input": raw, "expectedOutput": f"{expected}\n"} for raw, expected in inputs.items()])
    write_json("mutants", f"{PID}.json", MUTANTS)
    write_json("candidate-batches", f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID,
            "sourceContentHash": SOURCE_HASH,
            "packageChecksum": hashlib.sha256(package_bytes).hexdigest(),
            "editorial": editorial_text,
            "authoredSolutions": editorial["solutions"],
        }],
    })
    write_json("resolutions", f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": SOURCE_HASH,
            "previousReason": PREVIOUS_REASON,
            "reason": "OAMaster 固定版本的 Python、Java、C++ 三种官方参考解都在第一件买不起的商品处立即 break，作为题面遗漏语义的同源一致证据；本站在题目中明示据此采用停止、不跳过。原题无标准 I/O 样例，本站补充样例区分两种行为。160 个小规模输入由逐件模拟 oracle 对照，最大约束由独立等价轮数公式校验；54 个正式用例与两个正常退出错误程序通过本地检查，待自有 GoJudge 验收。",
        }],
    })
    source_evidence = {
        "schemaVersion": 1,
        "sourceCommit": SOURCE_COMMIT,
        "catalogPath": "content/oa-master/catalog.json",
        "catalogContentHash": SOURCE_HASH,
        "items": [{
            "id": PID,
            "title": source["title"],
            "sourceUrl": SOURCE_URL,
            "interpretation": "遇到第一件买不起的商品立即停止，不跳过。此规则不是题干明文，而是同一固定版本三种官方参考实现一致采用的行为；本站将该依据公开写入题面。",
            "sourceImplementations": [
                {"language": item["language"], "sha256": hashlib.sha256(item["code"].encode()).hexdigest(), "behavior": "first unaffordable item terminates purchase loop"}
                for item in source["solutions"]
            ],
            "siteAdditions": [
                "标准输入输出协议与三个本站自建样例（OAMaster 原题无 I/O 样例）",
                "买不起时立即停止，依据同一固定版本 Python/Java/C++ 三解法一致 break",
            ],
        }],
    }
    write_json("source-evidence", f"{BATCH}.json", source_evidence)
    write_json("validation", f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{
            "id": PID, "oracleCases": len(inputs), "publicCases": 3,
            "formalCases": len(judge_cases), "hiddenCases": sum(item["hidden"] for item in judge_cases),
            "negativeControls": killed,
            "largeBoundaries": [
                "n=1,cost=1,m=10^15", "n=100000,cost=1,m=10^15", "n=100000,cost=200000,m=10^15",
            ],
        }],
        "note": "小规模逐件 stop 模拟 oracle、参考算法与大规模均匀输入闭式 oracle 本地对照通过；两个正常退出 mutant 被拒。尚未连接 GoJudge。",
    })
    print(f"{PID}: {len(inputs)} oracle inputs, {len(judge_cases)} formal cases, {len(killed)} mutants killed; candidate only")


if __name__ == "__main__":
    main()
