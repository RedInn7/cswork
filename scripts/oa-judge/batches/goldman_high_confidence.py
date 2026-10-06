"""Build the two new Goldman Sachs offline OJ candidates.

The nine Goldman problems already present in ``goldman-sachs-remaining`` are
deliberately not regenerated: their package hashes are tied to existing judge
reports. This script only writes #6 and #26, which are still blocked.
"""
from collections import deque
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SEED = 20261006


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def package_checksum(package):
    return digest(canonical_json(package).encode())


def execute(path, data):
    result = subprocess.run(
        [sys.executable, "-I", str(path)], input=data, text=True,
        capture_output=True, timeout=8, check=True,
    )
    return result.stdout.rstrip("\n")


def enc6(case):
    lengths, cost, price = case
    return f"{len(lengths)} {cost} {price}\n" + " ".join(map(str, lengths)) + "\n"


def oracle6(case):
    lengths, cost, price = case
    best = 0
    for sale_length in range(1, max(lengths) + 1):
        profit = 0
        for rod in lengths:
            pieces = rod // sale_length
            if not pieces:
                continue
            remainder = rod % sale_length
            # Independently enumerate every possible number of saleable pieces.
            # Producing all pieces from an exact multiple saves one cut; every
            # partial extraction (or non-zero remainder) requires one cut per
            # retained piece, with the remainder discarded for no revenue.
            rod_best = 0
            for kept in range(1, pieces + 1):
                cuts = kept - 1 if kept == pieces and remainder == 0 else kept
                rod_best = max(rod_best, kept * sale_length * price - cuts * cost)
            profit += rod_best
        best = max(best, profit)
    return str(best)


def ref6():
    return """import sys
def solve(raw):
    values=list(map(int,raw.split()));n,cost,price=values[:3];lengths=values[3:3+n]
    best=0
    for sale in range(1,max(lengths)+1):
        revenue_per_piece=sale*price
        profit=0
        for rod in lengths:
            pieces,remainder=divmod(rod,sale)
            if pieces==0:continue
            if remainder:
                # Every saleable segment must be cut away from the scrap.
                gain=pieces*(revenue_per_piece-cost)
            else:
                # Either make all pieces (one fewer cut) or keep at most
                # pieces-1 and discard the rest after cutting each kept piece.
                all_gain=pieces*revenue_per_piece-(pieces-1)*cost
                partial_gain=max(0,(pieces-1)*(revenue_per_piece-cost))
                gain=max(0,all_gain,partial_gain)
            profit+=max(0,gain)
        best=max(best,profit)
    return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
"""


def enc26(case):
    return " ".join(map(str, case)) + "\n"


def oracle26(case):
    a, b, c, d = case
    pending = deque([(a, b)])
    seen = {(a, b)}
    while pending:
        x, y = pending.popleft()
        if (x, y) == (c, d):
            return "Yes"
        for nxt in ((x + y, y), (x, x + y)):
            if nxt[0] <= c and nxt[1] <= d and nxt not in seen:
                seen.add(nxt)
                pending.append(nxt)
    return "No"


def ref26():
    return """import sys
def solve(raw):
    a,b,c,d=map(int,raw.split())
    if c<a or d<b:return 'No'
    # Each reverse step is forced: if c>d, only (c-d,d) can precede
    # (c,d); if d>c, only (c,d-c) can precede it. Coordinates stay positive.
    while (c,d)!=(a,b):
        if c<a or d<b:return 'No'
        if c==d:return 'No'
        if c>d:c-=d
        else:d-=c
    return 'Yes'
if __name__=='__main__':print(solve(sys.stdin.read()))
"""


SPECS = {
    "oa-goldman-sachs-6": {
        "title": "Cutting Metal Surplus",
        "tags": ["贪心", "枚举"],
        "description": (
            "给定若干根金属棒、每次切割成本和每单位长度售价。可选一个正整数 saleLength；"
            "棒材可切成若干段 saleLength，其他余料丢弃且无收益。可不处理某根棒，"
            "目标是最大化总销售额减切割成本。"
        ),
        "input": (
            "第一行输入 n、costPerCut、salePrice；第二行输入 n 个 rod length。"
            "原题范围：1≤n≤50，1≤length[i]≤10000，1≤costPerCut,salePrice≤100。"
            "本站明确按棒材分别选择保留 saleLength 成品段数；完整利用整除棒时最后一段不需切离，"
            "有余料或只保留部分段时，每段成品均需一次切割，余料不计收益。"
        ),
        "output": "输出可达到的最大总利润。",
        "idea": (
            "枚举 saleLength=1..max(length)。对每根棒计算可得的成品段数 k。若有余料，"
            "每保留一段需要一次切割，选择正利润时保留全部 k 段。若恰好整除，比较："
            "全部 k 段只需 k−1 刀；或至多保留 k−1 段、逐段从余料切离；也可整根不切。"
        ),
        "proof": (
            "固定 saleLength 后，各棒的收益互不影响。非整除时保留 t 段的利润为"
            "t·(saleLength·salePrice−costPerCut)，故最优在 t=0 或 t=k。整除时，"
            "t=k 的利润为 k·saleLength·salePrice−(k−1)·costPerCut；对 0≤t<k，"
            "利润为 t·(saleLength·salePrice−costPerCut)，线性函数的最大值在 t=0 或 t=k−1。"
            "逐棒取这些选项的最大收益，再对所有 saleLength 取最大，即枚举了所有合法切割方案。"
        ),
        "complexity": "设 L=max(length)，时间 O(nL)，空间 O(1)。",
        "encode": enc6,
        "oracle": oracle6,
        "reference": ref6,
        "mutants": [
            {
                "name": "余料成品少算一次切割",
                "description": "非整除时误按 k−1 刀计算，漏掉切下最后一段余料所需的刀数。",
                "code": """import sys
def solve(raw):
    v=list(map(int,raw.split()));n,cost,price=v[:3];a=v[3:3+n];best=0
    for sale in range(1,max(a)+1):
        gain=0
        for rod in a:
            k=rod//sale
            if k:gain+=max(0,k*sale*price-(k-1)*cost)
        best=max(best,gain)
    return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
""",
            },
            {
                "name": "强制亏损棒材全部切完",
                "description": "即使某根棒的全切收益为负也计入总利润，没有选择丢弃未处理棒材。",
                "code": """import sys
def solve(raw):
    v=list(map(int,raw.split()));n,cost,price=v[:3];a=v[3:3+n];best=0
    for sale in range(1,max(a)+1):
        gain=0
        for rod in a:
            k=rod//sale
            if k:
                cuts=k-1 if rod%sale==0 else k
                gain+=k*sale*price-cuts*cost
        best=max(best,gain)
    return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
""",
            },
        ],
        "samples": [
            ([30, 59, 110], 1, 10),
            ([26, 103, 59], 100, 10),
            ([1], 100, 1),
        ],
        "random": lambda r: (
            [r.randint(1, 45) for _ in range(r.randint(1, 7))],
            r.randint(1, 35), r.randint(1, 20),
        ),
        "edges": [
            (([5, 6], 2, 1), "8"),
            (([50] * 10 + [100], 1100, 10), "5000"),
            (([10000] * 50, 100, 100), "50000000"),
        ],
    },
    "oa-goldman-sachs-26": {
        "title": "Is Possible",
        "tags": ["数学", "数论"],
        "description": (
            "从正整数对 (a,b) 出发，可重复执行 (a,b)→(a+b,b) 或 (a,b)→(a,a+b)。"
            "判断是否能得到目标正整数对 (c,d)，可以执行零次操作。"
        ),
        "input": "一行输入 a b c d。原题范围：1≤a,b,c,d≤1000。",
        "output": "可达输出 Yes，否则输出 No。",
        "idea": (
            "从 (c,d) 反向还原。若 c>d，唯一可能前驱是 (c−d,d)；若 d>c，"
            "唯一可能前驱是 (c,d−c)。每次减去较小坐标，若坐标低于起点或进入非起点的相等状态则不可达。"
        ),
        "proof": (
            "正向操作每次只增加一个坐标。对于任意正目标对，若 c>d，则它不可能由第二种操作产生"
            "（第二种会使第二坐标更大）；因此唯一前驱为 (c−d,d)。d>c 时对称。"
            "不断应用唯一前驱不会漏掉任何路径；一旦到达 (a,b) 即存在对应正向路径。若任何坐标低于起点，"
            "由于正向操作只增不减就不可能从起点到达；若 c=d，除非已等于起点，否则该状态不可能由正向操作到达。"
        ),
        "complexity": "每步至少减少一个坐标，坐标不超过1000；时间 O(c+d)，空间 O(1)。",
        "encode": enc26,
        "oracle": oracle26,
        "reference": ref26,
        "mutants": [
            {
                "name": "只比较最大公因数",
                "description": "把 gcd 相等误当成可达的充分条件。",
                "code": """import sys,math
def solve(raw):
    a,b,c,d=map(int,raw.split());return 'Yes' if math.gcd(a,b)==math.gcd(c,d) else 'No'
if __name__=='__main__':print(solve(sys.stdin.read()))
""",
            },
            {
                "name": "把非起点相等目标判为可达",
                "description": "在反向过程中遇到 c==d 就错误接受，而非拒绝不可达相等状态。",
                "code": """import sys
def solve(raw):
    a,b,c,d=map(int,raw.split())
    while c>=a and d>=b:
        if (c,d)==(a,b):return 'Yes'
        if c==d:return 'Yes'
        if c>d:c-=d
        else:d-=c
    return 'No'
if __name__=='__main__':print(solve(sys.stdin.read()))
""",
            },
        ],
        "samples": [(1, 1, 3, 2), (2, 3, 5, 8), (1, 2, 2, 2)],
        "random": lambda r: tuple(r.randint(1, 24) for _ in range(4)),
        "edges": [
            ((1, 2, 1000, 999), "Yes"),
            ((2, 3, 1000, 999), "No"),
            ((1, 2, 3, 3), "No"),
        ],
    },
}


def make_tests(spec, rng):
    cases = []
    for index, sample in enumerate(spec["samples"], 1):
        cases.append({
            "name": f"本站样例 {index}",
            "input": spec["encode"](sample),
            "expectedOutput": spec["oracle"](sample) + "\n",
            "hidden": False,
            "weight": 1,
        })
    for index, (value, expected) in enumerate(spec["edges"], 1):
        assert spec["oracle"](value) == expected, (value, spec["oracle"](value), expected)
        cases.append({
            "name": f"边界验证 {index}",
            "input": spec["encode"](value),
            "expectedOutput": expected + "\n",
            "hidden": True,
            "weight": 1,
        })
    used = {case["input"] for case in cases}
    while len(cases) < 32:
        value = spec["random"](rng)
        data = spec["encode"](value)
        if data in used:
            continue
        used.add(data)
        cases.append({
            "name": f"随机隐藏验证 {len(cases) - 4}",
            "input": data,
            "expectedOutput": spec["oracle"](value) + "\n",
            "hidden": True,
            "weight": 1,
        })
    return cases


def make_oracles(spec, rng):
    values = []
    seen = set()
    for value in spec["samples"]:
        data = spec["encode"](value)
        seen.add(data)
        values.append({"input": data, "expectedOutput": spec["oracle"](value)})
    # Explicit edge cases are also independently checked against the oracle.
    for value, expected in spec["edges"]:
        data = spec["encode"](value)
        if data in seen:
            continue
        assert spec["oracle"](value) == expected
        seen.add(data)
        values.append({"input": data, "expectedOutput": expected})
    while len(values) < 120:
        value = spec["random"](rng)
        data = spec["encode"](value)
        if data in seen:
            continue
        seen.add(data)
        values.append({"input": data, "expectedOutput": spec["oracle"](value)})
    return values


def main():
    for folder in (
        "packages", "references", "oracles", "mutants", "negative-controls",
        "editorials", "candidate-batches", "validation", "source-evidence",
    ):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    coverage = json.loads((OUT / "coverage.json").read_text())
    statuses = {item["id"]: item["status"] for item in coverage["items"]}
    for problem_id in SPECS:
        assert statuses.get(problem_id) in {"blocked", "sandbox_verified"}, (
            problem_id, statuses.get(problem_id)
        )

    rng = random.Random(SEED)
    manifest = {"schemaVersion": 1, "items": []}
    validation = {
        "schemaVersion": 1,
        "seed": SEED,
        "note": "离线本地验证，不代表 GoJudge 沙箱或线上已验收。",
        "problems": [],
    }
    evidence = {
        "schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT,
        "reason": "只读核对不可变 fastprep 原始快照；未执行来源仓库代码。",
        "items": [],
    }
    for problem_id, spec in SPECS.items():
        source = SOURCES[problem_id]
        reference = spec["reference"]()
        reference_path = OUT / "references" / f"{problem_id}.py"
        reference_path.write_text(reference)
        cases = make_tests(spec, rng)
        package = {
            "schemaVersion": 1,
            "problem": {
                "id": problem_id,
                "courseId": "gomall",
                "lessonId": "00-overview",
                "title": spec["title"],
                "difficulty": "中等",
                "tags": ["OA", "Goldman Sachs", *spec["tags"]],
                "description": spec["description"] + "\n\n本站输入格式与明确标注的范围由 CSWork 整理，不冒充原 OA 平台 I/O。",
                "input": spec["input"],
                "output": spec["output"],
                "explanation": "解题思路、正确性证明及复杂度见配套题解。",
                "hints": [spec["idea"]],
                "timeLimit": 3,
                "memoryLimit": 262144,
                "outputLimit": 4096,
                "checker": "tokens",
                "languages": ["python", "go", "java", "cpp"],
            },
            "cases": cases,
        }
        (OUT / "packages" / f"{problem_id}.json").write_text(
            json.dumps(package, ensure_ascii=False, indent=2) + "\n"
        )
        oracle = make_oracles(spec, rng)
        (OUT / "oracles" / f"{problem_id}.json").write_text(
            json.dumps(oracle, ensure_ascii=False, indent=2) + "\n"
        )
        editorial = (
            f"# {spec['title']}\n\n## 思路\n\n{spec['idea']}\n\n"
            f"## 正确性证明\n\n{spec['proof']}\n\n"
            f"## 复杂度\n\n{spec['complexity']}\n\n"
            f"## 参考实现\n\n```python\n{reference}```\n"
        )
        (OUT / "editorials" / f"{problem_id}.json").write_text(
            json.dumps({
                "schemaVersion": 1,
                "id": problem_id,
                "title": spec["title"],
                "explanation": editorial,
                "solutions": [{"language": "python", "code": reference}],
                "sourceUrl": source["sourceUrl"],
                "sourceContentHash": source["contentHash"],
                "author": "CSWork",
            }, ensure_ascii=False, indent=2) + "\n"
        )
        mutant_entries = []
        killed = []
        for index, mutant in enumerate(spec["mutants"], 1):
            mutant_path = OUT / "negative-controls" / f"{problem_id}-{index}.py"
            mutant_path.write_text(mutant["code"])
            mutant_entries.append({
                "name": mutant["name"],
                "description": mutant["description"],
                "code": mutant["code"],
                "sha256": digest(mutant["code"].encode()),
            })
            rejected = []
            for case_index, case in enumerate(cases):
                actual = execute(mutant_path, case["input"])
                expected = case["expectedOutput"].rstrip("\n")
                if actual != expected:
                    rejected.append(case_index)
            assert rejected, (problem_id, mutant["name"])
            killed.append({"name": mutant["name"], "rejectedByCases": rejected})
        (OUT / "mutants" / f"{problem_id}.json").write_text(
            json.dumps(mutant_entries, ensure_ascii=False, indent=2) + "\n"
        )

        reference_digest = digest(reference.encode())
        for index, case in enumerate(cases):
            expected = case["expectedOutput"].rstrip("\n")
            actual = execute(reference_path, case["input"])
            assert actual == expected, (problem_id, index, actual, expected)
        for index, case in enumerate(oracle):
            actual = execute(reference_path, case["input"])
            assert actual == case["expectedOutput"], (problem_id, index, actual, case["expectedOutput"])

        manifest["items"].append({
            "id": problem_id,
            "sourceContentHash": source["contentHash"],
            "packageChecksum": package_checksum(package),
            "editorial": editorial,
            "authoredSolutions": [{"language": "python", "code": reference}],
        })
        validation["problems"].append({
            "id": problem_id,
            "oracleCases": len(oracle),
            "formalCases": len(cases),
            "negativeControls": killed,
            "referenceSha256": reference_digest,
            "oracleSha256": digest((OUT / "oracles" / f"{problem_id}.json").read_bytes()),
        })
        evidence["items"].append({
            "id": problem_id,
            "title": spec["title"],
            "sourceUrl": source["sourceUrl"],
            "sourceContentHash": source["contentHash"],
            "path": (
                "fastprep/Goldman Sachs/cutting-metal-surplus.md"
                if problem_id.endswith("-6") else "fastprep/Goldman Sachs/is-possible.md"
            ),
            "gitBlobSha": (
                "36a5aa9b3165a9461d13c7997808ea23f8d99742"
                if problem_id.endswith("-6") else "423a616c2fd1c33c6de6d1a62cded0a37750a278"
            ),
            "status": "candidate",
            "reason": (
                "原题函数、约束和利润定义完整；本站明确输入格式和逐棒保留策略后，可唯一计算最优利润。"
                if problem_id.endswith("-6") else
                "原题正整数起点/目标与两种加法操作、返回值和全部数值约束完整；反向前驱唯一。"
            ),
            "addedProtocol": spec["input"],
        })

    (OUT / "candidate-batches/goldman-high-confidence.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    )
    (OUT / "validation/goldman-high-confidence.json").write_text(
        json.dumps(validation, ensure_ascii=False, indent=2) + "\n"
    )
    (OUT / "source-evidence/goldman-high-confidence.json").write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
    )
    print("goldman-high-confidence: 2 candidates, each 120 oracle inputs, 32 formal cases, 2 killed mutants")


if __name__ == "__main__":
    main()
