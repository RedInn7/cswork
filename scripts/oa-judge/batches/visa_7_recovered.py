from __future__ import annotations

import hashlib
import json
import random
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
ITEM = next(x for x in CATALOG["items"] if x["id"] == "oa-visa-7")
PID = ITEM["id"]
SEED = 20261006
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/visa.mdx"
RAW_BLOB = "1fcf3d36148af03975bb074843e1d4a559ad662e"
PREVIOUS_REASON = "题面要求按缺失单元格的全矩阵 row-major 次序回填；来源实现按 4×4 子块顺序记录位置，两者不等价，样例不能消除差异。"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = '''def solve(raw):
    data = list(map(int, raw.split()))
    n = data[0]
    size = 4 * n
    values = data[1:]
    if len(values) != size * size:
        raise ValueError("expected an (4n) x (4n) matrix")
    matrix = [values[r * size:(r + 1) * size] for r in range(size)]

    missing_values = []
    for br in range(n):
        for bc in range(n):
            total = 0
            for dr in range(4):
                for dc in range(4):
                    value = matrix[4 * br + dr][4 * bc + dc]
                    if value != -1:
                        total += value
            missing_values.append(136 - total)

    # The destination positions are ordered by the entire matrix, not by blocks.
    positions = [(r, c) for r in range(size) for c in range(size)
                 if matrix[r][c] == -1]
    for (r, c), value in zip(positions, sorted(missing_values)):
        matrix[r][c] = value
    return "\\n".join(" ".join(map(str, row)) for row in matrix)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def make_matrix(n: int, block_specs: list[tuple[int, int]] | None = None,
                rng: random.Random | None = None) -> list[list[int]]:
    size = 4 * n
    matrix = [[0] * size for _ in range(size)]
    for bi in range(n):
        for bj in range(n):
            index = bi * n + bj
            if block_specs is not None:
                missing_value, missing_offset = block_specs[index]
            else:
                assert rng is not None
                missing_value = rng.randint(1, 16)
                missing_offset = rng.randrange(16)
            cells = [v for v in range(1, 17) if v != missing_value]
            j = 0
            for offset in range(16):
                r = 4 * bi + offset // 4
                c = 4 * bj + offset % 4
                if offset == missing_offset:
                    matrix[r][c] = -1
                else:
                    matrix[r][c] = cells[j]
                    j += 1
    return matrix


def serialize_input(matrix: list[list[int]]) -> str:
    n = len(matrix) // 4
    return str(n) + "\n" + "\n".join(" ".join(map(str, row)) for row in matrix) + "\n"


def independent_oracle(raw: str) -> str:
    data = list(map(int, raw.split()))
    n = data[0]
    size = 4 * n
    matrix = [data[1 + r * size:1 + (r + 1) * size] for r in range(size)]

    # Set-complement (not the reference's sum identity) recovers each missing value.
    missing = []
    for br in range(n):
        for bc in range(n):
            present = {
                matrix[4 * br + dr][4 * bc + dc]
                for dr in range(4) for dc in range(4)
                if matrix[4 * br + dr][4 * bc + dc] != -1
            }
            missing.append(next(v for v in range(1, 17) if v not in present))
    row_major = [(r, c) for r in range(size) for c in range(size) if matrix[r][c] == -1]
    for (r, c), value in zip(row_major, sorted(missing)):
        matrix[r][c] = value
    return "\n".join(" ".join(map(str, row)) for row in matrix)


_FUNCTIONS: dict[str, object] = {}


def run_code(code: str, raw: str) -> str:
    fn = _FUNCTIONS.get(code)
    if fn is None:
        env: dict[str, object] = {"__name__": "candidate"}
        exec(compile(code, "<candidate>", "exec"), env)
        fn = env["solve"]
        _FUNCTIONS[code] = fn
    return str(fn(raw))


def main() -> None:
    assert ITEM["contentHash"] == "c52180b84e34597acb1b892647e2eeed843d36e5131140ae78a799ff36e4cd3c"
    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] in {"blocked", "awaiting_sandbox"}, state
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            manifest = json.loads(path.read_text())
            if folder == "candidate-batches" and path.name == "visa-7-recovered.json":
                continue
            assert all(x["id"] != PID for x in manifest.get("items", [])), (folder, path)

    reviews = json.loads((OA / "reviews/visa-tail.json").read_text())
    prior = next(x for x in reviews["items"] if x["id"] == PID)
    assert prior["status"] == "blocked" and prior["reason"] == PREVIOUS_REASON
    assert prior["sourceCommit"] == UPSTREAM_COMMIT
    assert prior["rawPath"] == RAW_PATH and prior["rawGitBlob"] == RAW_BLOB
    assert prior["catalogContentHash"] == ITEM["contentHash"]

    # The second sample deliberately distinguishes global row-major from block order:
    # block traversal sees missing positions (3,0),(0,4),(4,0),(7,4).
    sample1 = make_matrix(1, [(9, 5)])
    sample2 = make_matrix(2, [(15, 12), (2, 4), (13, 0), (4, 15)])
    sample3 = make_matrix(2, [(7, 0), (7, 3), (3, 12), (3, 15)])
    public_matrices = [sample1, sample2, sample3]
    rng = random.Random(SEED)
    oracle_inputs = [serialize_input(m) for m in public_matrices]
    oracle_inputs.extend(
        serialize_input(make_matrix(rng.randint(1, 5), rng=rng)) for _ in range(160)
    )

    start = time.perf_counter()
    oracle_rows = []
    for raw in oracle_inputs:
        expected = independent_oracle(raw)
        assert run_code(REFERENCE, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    # Exhaust every missing value/location pair for a one-block matrix.
    exhaustive = 0
    for missing_value in range(1, 17):
        for missing_offset in range(16):
            raw = serialize_input(make_matrix(1, [(missing_value, missing_offset)]))
            expected = independent_oracle(raw)
            assert run_code(REFERENCE, raw) == expected
            exhaustive += 1

    formal_matrices = public_matrices + [
        make_matrix(1, [(1, 0)]),
        make_matrix(1, [(16, 15)]),
        make_matrix(3, rng=rng),
        make_matrix(4, rng=rng),
        make_matrix(100, rng=rng),
    ]
    formal_seen = {serialize_input(matrix) for matrix in formal_matrices}
    while len(formal_matrices) < 23:
        matrix = make_matrix(rng.randint(1, 5), rng=rng)
        raw = serialize_input(matrix)
        if raw in formal_seen:
            continue
        formal_seen.add(raw)
        formal_matrices.append(matrix)
    cases = []
    expected_formal = []
    for i, matrix in enumerate(formal_matrices):
        raw = serialize_input(matrix)
        expected = independent_oracle(raw)
        expected_formal.append(expected)
        cases.append({
            "name": (f"样例 {i + 1}" if i < 3 else
                     f"边界 {i - 2}" if i < 8 else f"隐藏矩阵场景 {i - 7}"),
            "input": raw,
            "expectedOutput": expected + "\n",
            "hidden": i >= 3,
            "weight": 1,
        })

    mutants = [
        {
            "name": "按 4×4 子块遍历顺序回填",
            "code": '''def solve(raw):
 d=list(map(int,raw.split())); n=d[0];N=4*n;m=[d[1+r*N:1+(r+1)*N] for r in range(N)];pos=[];vals=[]
 for bi in range(n):
  for bj in range(n):
   s=0;where=None
   for i in range(4):
    for j in range(4):
     r=4*bi+i;c=4*bj+j
     if m[r][c]==-1:where=(r,c)
     else:s+=m[r][c]
   pos.append(where);vals.append(136-s)
 for (r,c),v in zip(pos,sorted(vals)):m[r][c]=v
 return "\\n".join(" ".join(map(str,row)) for row in m)
''',
        },
        {
            "name": "不排序，按块顺序直接写入全局行优先位置",
            "code": '''def solve(raw):
 d=list(map(int,raw.split())); n=d[0];N=4*n;m=[d[1+r*N:1+(r+1)*N] for r in range(N)];vals=[]
 for bi in range(n):
  for bj in range(n):
   s=sum(m[4*bi+i][4*bj+j] for i in range(4) for j in range(4) if m[4*bi+i][4*bj+j]!=-1);vals.append(136-s)
 pos=[(r,c) for r in range(N) for c in range(N) if m[r][c]==-1]
 for (r,c),v in zip(pos,vals):m[r][c]=v
 return "\\n".join(" ".join(map(str,row)) for row in m)
''',
        },
    ]
    killed = []
    for mutant in mutants:
        rejected = [i for i, matrix in enumerate(formal_matrices)
                    if run_code(mutant["code"], serialize_input(matrix)) != expected_formal[i]]
        assert rejected, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejected})

    editorial = """## 思路

逐个 4×4 子块计算缺失值 `136−当前和`。同时注意，题面规定的回填位置是整个 `(4n)×(4n)` 矩阵中按行、再按列排列的所有 `-1`，不是按子块遍历的顺序。将所有缺失值排序后，逐一写入全局行优先位置。

## 正确性证明

每块恰含 1..16 中除一个数外的所有数，故块内和为 `136−missing`，计算值唯一。题目要求收集这些值并升序排列，再映射到按全矩阵 row-major 排列的缺失位置；算法分别按这两条明文规则构造序列并一一赋值，所以输出矩阵与题意完全一致。

## 复杂度

设矩阵边长 `N=4n`。扫描所有单元格和排序 `n²` 个缺失值，时间 `O(N²+n² log n)`，空间 `O(N²)`（用于矩阵及输入输出）。

## 验证

163 组 oracle 输入由独立的集合补集算法恢复每块缺失值；额外穷举单块全部 16 种缺失值 ×16 个缺失位置，共256组。正式用例包含一个能区分全局 row-major 和子块遍历顺序的 8×8 矩阵、n=100 最大边界矩阵，以及 15 个输入互异的隐藏矩阵场景。两个正常退出错误程序均被用例拒绝。

## 来源说明

原题和固定上游提交明确要求按缺失位置的全矩阵 row-major 顺序回填。上游参考代码实际按子块顺序记录位置，与文字不一致；本题严格按题面步骤实现，并重写了本站样例。原题未给 n 上限，本站补充 `1≤n≤100`，使输入输出保持在 OJ 容量限制内；标准输入输出协议也由本站补充。"""

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID,
            "courseId": "gomall",
            "lessonId": "00-overview",
            "title": "按全局行序恢复矩阵缺失值",
            "difficulty": "中等",
            "tags": ["OA", ITEM["companyName"], "矩阵", "排序"],
            "description": "一个边长为 4n 的正方形矩阵被分成 n² 个 4×4 子块。每个子块包含整数 1..16 中除一个数以外的全部数，缺失位置标为 -1。先用 136 减去该子块现有数字之和，得到每块缺失值；然后把全部缺失值升序排列，依次填入原矩阵所有 -1 位置。位置顺序按整个矩阵的行优先（先行后列）排列，不按子块顺序。本站限制 1≤n≤100。",
            "input": "第一行整数 n（1..100），表示每边有 n 个 4×4 子块。接下来输入 4n 行，每行 4n 个整数。每个子块恰有一个 -1，其余值是 1..16 中除某一值外的15个不同整数。",
            "output": "输出恢复后的 4n 行矩阵，每行 4n 个整数。",
            "explanation": "样例2中，按子块顺序看到的缺失位置与全矩阵行优先位置不同；因此必须先独立排序缺失值，再按所有 -1 的全局行优先顺序回填。",
            "hints": ["每块数字总和应为 136。", "位置顺序与子块枚举顺序是两回事。"],
            "timeLimit": 3,
            "memoryLimit": 262144,
            "outputLimit": 1024,
            "checker": "tokens",
            "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    schema_script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(
        ["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
        input=json.dumps(raw_package, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    )
    package = json.loads(proc.stdout)
    canonical = json.dumps(package, ensure_ascii=False, separators=(",", ":"))
    entry = {
        "id": PID,
        "sourceContentHash": ITEM["contentHash"],
        "packageChecksum": sha(canonical),
        "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }
    put_json(OA / "packages" / f"{PID}.json", package)
    reference_path = OA / "references" / f"{PID}.py"
    reference_path.write_text(REFERENCE)
    put_json(OA / "oracles" / f"{PID}.json", oracle_rows)
    put_json(OA / "mutants" / f"{PID}.json", mutants)
    put_json(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": ITEM["sourceUrl"], "sourceContentHash": ITEM["contentHash"], "author": "CSWork",
    })
    put_json(OA / "candidate-batches" / "visa-7-recovered.json", {
        "schemaVersion": 1, "items": [entry],
    })
    put_json(OA / "source-evidence" / "visa-7-recovered.json", {
        "schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": UPSTREAM_COMMIT,
        "origin": "https://oamaster.com",
        "items": {PID: {
            "url": ITEM["sourceUrl"], "contentHash": ITEM["contentHash"],
            "catalogContentHash": ITEM["contentHash"], "company": ITEM["companyName"],
            "title": ITEM["title"], "path": RAW_PATH, "gitBlobSha": RAW_BLOB,
            "blobVerification": "Fetched original Visa MDX from the exact upstream commit via GitHub API; git hash-object matched the existing review's raw Git blob SHA.",
            "semanticConflict": "Statement lines 449-454 explicitly use global matrix row-major missing positions; upstream Python/Java/C++ implementations enumerate positions by 4x4 block. The candidate follows the statement, not the inconsistent implementation.",
        }},
    })
    resolution_reason = "以固定上游题面步骤2的全矩阵 row-major 文字规则为准；上游参考实现按子块顺序的差异已明确披露。原题没有 n 上限，本站补充 n≤100 以满足现有 OJ 输入/输出资源限制；候选已通过独立集合oracle和位置顺序反例验证，仍待真实 GoJudge 沙箱。"
    put_json(OA / "resolutions" / "visa-7-recovered.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "batch": "visa-7-recovered",
            "sourceContentHash": ITEM["contentHash"],
            "previousReason": prior["reason"],
            "reason": resolution_reason,
        }],
    })

    stdio_rows = oracle_rows + [
        {"input": case["input"], "expectedOutput": case["expectedOutput"]}
        for case in cases
    ]
    for row in stdio_rows:
        proc = subprocess.run(
            ["python3", "-I", str(reference_path)], cwd=ROOT,
            input=row["input"], text=True, capture_output=True, timeout=5, check=True,
        )
        assert proc.stdout == row["expectedOutput"], (row["input"][:200], proc.stderr)

    put_json(OA / "validation" / "visa-7-recovered.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{
            "id": PID,
            "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
            "referenceStdioCases": len(stdio_rows),
            "publicCases": len(public_matrices),
            "hiddenCases": len(cases) - len(public_matrices),
            "exhaustiveDifferentialComparisons": exhaustive,
            "negativeControls": killed,
            "referenceSha256": sha(REFERENCE),
            "maxBlocksPerSide": 100,
            "localValidationOnly": True,
        }],
    })
    print(json.dumps({
        "id": PID,
        "candidateBatch": "visa-7-recovered",
        "statusBefore": state["status"],
        "oracleCases": len(oracle_rows),
        "formalCases": len(cases),
        "exhaustiveDifferentialComparisons": exhaustive,
        "negativeControls": killed,
        "totalSeconds": round(time.perf_counter() - start, 3),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
