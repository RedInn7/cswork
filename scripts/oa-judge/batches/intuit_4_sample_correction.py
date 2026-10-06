"""Build an offline candidate correcting Intuit #4's conflicting sample outputs."""
from __future__ import annotations

import hashlib
import itertools
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
PID = "oa-intuit-4"
BATCH = "intuit-4-sample-correction"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/intuit.mdx"
SOURCE_BLOB = "29669a0924bebd4ca9fd5e2ef5b7c1d3a544a628"
SOURCE_HASH = "690ff47920b14cea9d8e35b8069afda43e3eee2e6ef132a4117de40dd547f78f"
SEED = 20261006

REFERENCE = r'''import sys
MOD = 1_000_000_007

def solve(raw):
    n = int(raw.strip())
    if not 1 <= n <= 10**18:
        raise ValueError("site protocol: 1 <= n <= 10^18")
    # Inclusion-exclusion over the three monochromatic-column events.
    return str((pow(24, n, MOD) - 9 * pow(8, n, MOD)
                + 9 * pow(2, n, MOD) + 18 * pow(3, n, MOD) - 24) % MOD)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def execute(code: str, raw: str) -> str:
    p = subprocess.run([sys.executable, "-I", "-c", code], input=raw,
                       text=True, capture_output=True, timeout=4, check=True)
    return p.stdout.strip()


def input_text(n: int) -> str:
    return f"{n}\n"


def ie_oracle(n: int) -> str:
    """Direct assignment-level inclusion-exclusion over column bad events."""
    total = 0
    # Choose a subset of columns to force monochromatic, then enumerate their
    # colors. A row has 3^(3-k) completions, less its monochromatic completion
    # when all fixed colors agree.
    for mask in range(1 << 3):
        chosen = [c for c in range(3) if (mask >> c) & 1]
        sign = -1 if len(chosen) % 2 else 1
        for colors in itertools.product(range(3), repeat=len(chosen)):
            if not chosen:
                total += pow(24, n, 1_000_000_007)
                continue
            all_same = bool(chosen) and len(set(colors)) == 1
            row_ways = 3 ** (3 - len(chosen)) - int(all_same)
            total += sign * pow(row_ways, n, 1_000_000_007)
    return str(total % 1_000_000_007)


def brute(n: int) -> int:
    valid = 0
    for cells in itertools.product(range(3), repeat=3 * n):
        if any(cells[r * 3] == cells[r * 3 + 1] == cells[r * 3 + 2]
               for r in range(n)):
            continue
        if any(all(cells[r * 3 + c] == cells[c] for r in range(n))
               for c in range(3)):
            continue
        valid += 1
    return valid


def put(folder: str, name: str, value: object) -> None:
    path = OUT / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    item = next(x for x in catalog["items"] if x["id"] == PID)
    assert item["contentHash"] == SOURCE_HASH
    assert item["sourceUrl"].endswith("#4-coloring-a-grid--n--3-with-rgb")
    assert "no row or column contains cells that are all the same color" in item["statement"]
    upstream = Path("/private/tmp/oa-master-readonly")
    raw_source = subprocess.run(
        ["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=upstream,
        text=True, capture_output=True, check=True,
    ).stdout
    blob = subprocess.run(
        ["git", "rev-parse", f"{COMMIT}:{SOURCE_PATH}"], cwd=upstream,
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    assert blob == SOURCE_BLOB
    assert "## 4. Coloring a Grid" in raw_source
    assert "n=3` → `9758" in raw_source and "n=4` → `290490" in raw_source

    # Direct enumeration checks the literal grid rule without using the closed form.
    for n in range(1, 5):
        expected = ie_oracle(n)
        assert str(brute(n) % 1_000_000_007) == expected
        assert execute(REFERENCE, input_text(n)) == expected
    assert ie_oracle(2) == "174"
    assert ie_oracle(3) == "9750"
    assert ie_oracle(4) == "296490"

    public = [2, 3, 4]
    hidden = [1, 5, 6, 7, 10, 17, 31, 100, 10**9, 10**18]
    rng = random.Random(SEED)
    hidden.extend(rng.randint(1, 10**18) for _ in range(20))
    cases = []
    oracle_cases = []
    for idx, n in enumerate(public + hidden):
        expected = ie_oracle(n)
        actual = execute(REFERENCE, input_text(n))
        assert actual == expected, (n, expected, actual)
        case = {
            "name": f"公开样例 {idx + 1}" if idx < 3 else f"隐藏测试 {idx - 2}",
            "input": input_text(n), "expectedOutput": expected + "\n",
            "hidden": idx >= 3, "weight": 1,
        }
        cases.append(case)
        oracle_cases.append({"input": case["input"], "expectedOutput": case["expectedOutput"]})

    known_oracle_inputs = {row["input"] for row in oracle_cases}
    while len(known_oracle_inputs) < 120:
        n = rng.randint(1, 10**18)
        raw = input_text(n)
        if raw in known_oracle_inputs:
            continue
        expected = ie_oracle(n)
        assert execute(REFERENCE, raw) == expected
        oracle_cases.append({"input": raw, "expectedOutput": expected + "\n"})
        known_oracle_inputs.add(raw)

    mutants = [
        {
            "name": "只禁止列全同色，漏掉行全同色",
            "code": "import sys\nn=int(sys.stdin.read()); M=10**9+7; print(pow((pow(3,n,M)-3)%M,3,M))",
        },
        {
            "name": "只禁止行全同色，漏掉列全同色",
            "code": "import sys\nn=int(sys.stdin.read()); print(pow(24,n,10**9+7))",
        },
    ]
    controls = []
    for mutant in mutants:
        rejected = [i for i, case in enumerate(cases)
                    if execute(mutant["code"], case["input"]) != case["expectedOutput"].strip()]
        assert rejected, mutant["name"]
        controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "三色网格染色计数（Intuit OA）", "difficulty": "中等",
        "tags": ["OA", "Intuit", "组合计数", "容斥"],
        "description": "用红、绿、蓝三种颜色给 n×3 网格染色。合法方案要求每一行、每一列都至少包含两种颜色。来源的 n=3、n=4 样例输出与题意不符，按题意分别更正为 9750、296490；推导见题解。",
        "input": "输入一个整数 n（本站范围 1≤n≤10^18；来源未提供 n 的约束）。",
        "output": "输出合法染色方案数，对 1,000,000,007 取模。",
        "explanation": "对三列各自全同色的事件做容斥，答案为 24^n−9·8^n+9·2^n+18·3^n−24（取模）。",
        "hints": ["每行有 3^3−3=24 种非单色排列。", "对‘某一列全同色’的三个事件做容斥。"],
        "timeLimit": 2, "memoryLimit": 65536, "outputLimit": 4096,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    editorial = """## 计数与样例勘误

每行必须非单色，所以单行有 24 种颜色排列。先统计所有行均合法的网格，再对三个“某列从上到下全同色”的事件做容斥。

固定一组 k 列要求全同色并指定这些列的颜色：当被选列颜色不全相同时，每行有 3^(3-k) 种选择；当它们同色时，还要排除剩余列也都取该颜色的一种选择。将各组代入容斥并合并，得到：

`24^n - 9·8^n + 9·2^n + 18·3^n - 24`。

对 n=2、3、4，结果依次为 174、9750、296490。原始规则明确要求每行和每列都不能全同色；直接枚举 3^(3n) 个网格（n≤4）及独立的六事件容斥均得到相同结果。因此来源的 n=3 输出 9758、n=4 输出 290490 是样例数值错误，题意不变，仅更正这两个答案。

## 正确性

先按行限制只保留 24 种非单色行，故每个行序列恰好对应一个满足行条件的网格。容斥准确剔除至少含一个全同色列的网格：每个网格按其全同色列集合在容斥和中的总系数为 1（若集合为空）或 0（若非空）。化简后的式子因此恰好计数同时满足行、列条件的染色。

## 复杂度

使用快速模幂计算常数项的幂，时间 O(log n)，额外空间 O(1)。本站输入范围为 1≤n≤10^18；来源未给 n 上限。"""

    assert len({row["input"] for row in oracle_cases}) >= 120
    validation = {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_cases), "bruteForceN": [1, 2, 3, 4],
                      "publicCases": 3, "hiddenCases": len(cases) - 3,
                      "negativeControls": controls,
                      "referenceSha256": digest(REFERENCE.encode())}],
        "note": "Local independent IE oracle and exhaustive grids n<=4; not tested against GoJudge.",
    }
    script = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    p = subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT,
                       input=json.dumps({"schemaVersion": 1, "problem": problem, "cases": cases}, ensure_ascii=False),
                       text=True, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr)
    normalized = p.stdout
    package = json.loads(normalized)
    editorial_doc = {"schemaVersion": 1, "id": PID, "title": problem["title"],
                     "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
                     "sourceUrl": item["sourceUrl"], "sourceContentHash": SOURCE_HASH}
    manifest_entry = {"id": PID, "sourceContentHash": SOURCE_HASH,
                      "packageChecksum": digest(normalized.encode()), "editorial": editorial,
                      "authoredSolutions": [{"language": "python", "code": REFERENCE}]}
    evidence = {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": COMMIT, "sourceFile": {"path": SOURCE_PATH, "gitBlobSha": SOURCE_BLOB},
        "catalogContentHash": SOURCE_HASH,
        "sampleCorrection": {"n=3": {"source": 9758, "corrected": 9750},
                             "n=4": {"source": 290490, "corrected": 296490}},
        "basis": "Literal row/column non-monochromatic rule; verified via exhaustive enumeration and independent six-event inclusion-exclusion.",
    }
    previous = next(
        row
        for path in sorted((OUT / "reviews").glob("*.json"))
        for row in json.loads(path.read_text(encoding="utf-8"))["items"]
        if row["id"] == PID
    )
    resolution = {
        "schemaVersion": 1,
        "items": [{
            "id": PID,
            "batch": BATCH,
            "sourceContentHash": SOURCE_HASH,
            "previousReason": previous["reason"],
            "reason": "固定源规则唯一要求每一行和每一列都非单色；按该精确定义，n=3、n=4 的样例输出分别错为 9758、290490。直接穷举小网格及独立容斥一致得到 9750、296490，仅修正错误样例答案。来源未给 n 上限，本站范围单独披露。",
        }],
    }
    for folder, obj in (("packages", package), ("editorials", editorial_doc),
                        ("oracles", oracle_cases), ("mutants", mutants),
                        ("source-evidence", evidence)):
        put(folder, f"{PID}.json", obj)
    put("validation", f"{BATCH}.json", validation)
    put("resolutions", f"{BATCH}.json", resolution)
    (OUT / "references" / f"{PID}.py").write_text(REFERENCE, encoding="utf-8")
    for i, mutant in enumerate(mutants, 1):
        (OUT / "negative-controls" / f"{PID}-{i}.py").write_text(mutant["code"] + "\n", encoding="utf-8")
    put("candidate-batches", f"{BATCH}.json", {"schemaVersion": 1, "items": [manifest_entry]})
    print(f"{PID}: {len(oracle_cases)} oracle cases, exhaustive n=1..4, {len(cases)} formal cases, 2 mutants rejected")


if __name__ == "__main__":
    main()
