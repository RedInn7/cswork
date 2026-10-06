"""Generate the isolated candidate package for Hudson River Trading #6."""
from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
PID = "oa-hudson-river-trading-6"
BATCH = "hudson-river-trading-6-recovered"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
PATH1 = "fastprep/Hudson River Trading/hudsonriver-increasing-paths-1.md"
PATH2 = "fastprep/Hudson River Trading/hudsonriver-increasing-paths-2.md"
PAGE = "web/content/docs/companies/hudson-river-trading.mdx"
PART1_HASH = "bd6b46581b9f89560a382cf3f10c9707483dd3a782ecb9f97575f7c12f50185e"
PART2_HASH = "eb19423d30e0c5f771d21ba70f4906320cd6897fc185fc7dd1985781fadc465b"
PREVIOUS_REASON = (
    "Increasing Paths part 2 的固定 15×15 样例按题目规定的上下左右相邻、严格递增和路径至少两格规则，"
    "由独立反向 DFS 与独立升序 DP 均计算为 600537344，与上游所列 601079908 冲突；不能伪造通过样例。"
)
ITEMS = {item["id"]: item for item in CATALOG["items"]}


REFERENCE = '''def decode(raw):
    data = list(map(int, raw.split()))
    rows = data[0]
    grid = []
    pos = 1
    for _ in range(rows):
        cols = data[pos]
        pos += 1
        grid.append(data[pos:pos + cols])
        pos += cols
    if pos != len(data):
        raise ValueError("unexpected trailing input")
    return grid

def solve(raw):
    grid = decode(raw)
    cells = {(r, c): value for r, row in enumerate(grid) for c, value in enumerate(row)}
    ways = {}
    answer = 0
    for (r, c), value in sorted(cells.items(), key=lambda item: item[1], reverse=True):
        count = 0
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if (nr, nc) in cells and cells[(nr, nc)] > value:
                count += 1 + ways[(nr, nc)]
        ways[(r, c)] = count
        answer += count
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def encode(grid: list[list[int]]) -> str:
    return str(len(grid)) + "\n" + "".join(
        str(len(row)) + " " + " ".join(map(str, row)) + "\n" for row in grid
    )


def decode(raw: str) -> list[list[int]]:
    data = list(map(int, raw.split()))
    rows, pos, grid = data[0], 1, []
    for _ in range(rows):
        cols = data[pos]
        pos += 1
        grid.append(data[pos:pos + cols])
        pos += cols
    assert pos == len(data)
    return grid


def oracle(raw: str) -> int:
    """Independent memoized DFS over each cell's strictly greater neighbors."""
    grid = decode(raw)
    cells = {(r, c): value for r, row in enumerate(grid) for c, value in enumerate(row)}

    @lru_cache(None)
    def paths_from(r: int, c: int) -> int:
        value = cells[(r, c)]
        return sum(
            1 + paths_from(nr, nc)
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1))
            if (nr, nc) in cells and cells[(nr, nc)] > value
        )

    return sum(paths_from(r, c) for r, c in cells)


def alternate_ascending_dp(grid: list[list[int]]) -> int:
    """Second implementation used to audit the fixed 15x15 source sample."""
    cells = {(r, c): value for r, row in enumerate(grid) for c, value in enumerate(row)}
    ending = {}
    total = 0
    for (r, c), value in sorted(cells.items(), key=lambda item: item[1]):
        count = 1
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if (nr, nc) in cells and cells[(nr, nc)] < value:
                count += ending[(nr, nc)]
        ending[(r, c)] = count
        total += count - 1
    return total


def run_code(code: str, raw: str) -> str:
    proc = subprocess.run(
        [sys.executable, "-I", "-c", code], cwd=ROOT, input=raw,
        text=True, capture_output=True, timeout=15, check=True,
    )
    return proc.stdout.rstrip("\n")


def normalize(package: dict) -> str:
    js = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    return subprocess.run(
        ["node", "--import", "tsx", "-e", js], cwd=ROOT,
        input=json.dumps(package, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    ).stdout


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def git_blob(path: str) -> str:
    return subprocess.check_output(
        ["git", "-C", "/tmp/oa-master-readonly", "rev-parse", f"{UPSTREAM_COMMIT}:{path}"],
        text=True,
    ).strip()


def git_bytes(path: str) -> bytes:
    return subprocess.check_output(
        ["git", "-C", "/tmp/oa-master-readonly", "show", f"{UPSTREAM_COMMIT}:{path}"],
    )


def source_grid() -> list[list[int]]:
    grid = [list(range(r, r + 15)) for r in range(15)]
    grid[9] = [11, 10] + list(range(11, 24))
    return grid


def random_grid(rng: random.Random) -> list[list[int]]:
    row_count = rng.randint(1, 6)
    return [[rng.randint(0, 12) for _ in range(rng.randint(1, 6))]
            for _ in range(row_count)]


def main() -> None:
    source = ITEMS[PID]
    inherited = ITEMS["oa-hudson-river-trading-5"]
    assert source["contentHash"] == PART2_HASH
    assert inherited["contentHash"] == PART1_HASH
    assert source["sourceUrl"] == "https://oamaster.com/docs/companies/hudson-river-trading#6-increasing-paths-part-2"
    for path, expected_blob in ((PATH1, "1b8ef3d822aa032666513172efa73cf860f3194c"),
                                (PATH2, "e3b83e671124856713fe80fd4245479b8ff6e101")):
        assert git_blob(path) == expected_blob
    assert hashlib.sha256(git_bytes(PATH1)).hexdigest() == "d0c41b869c934aefe28e7bbe55224f0eb2c8f5fa7ba4dd41f54c33db5fdbe8de"
    assert hashlib.sha256(git_bytes(PATH2)).hexdigest() == "e4048e464cd9153de9672367056838f054f3f2c3e290779d7b25978ac38701ed"

    sample = source_grid()
    source_sample_count = oracle(encode(sample))
    assert source_sample_count == alternate_ascending_dp(sample) == 600537344
    assert source_sample_count != 601079908
    assert run_code(REFERENCE, encode(sample)) == str(source_sample_count)

    # The source count is wrong, so publish the same fixed grid with the
    # independently established answer and explicitly identify the correction.
    formal_grids = [
        [[0]],
        [[1, 2]],
        [[2], [1]],
        [[3, 3], [3, 3]],
        [[0, 1], [1, 2]],
        [[5], [1], [2, 7]],
        [[0] * 15 for _ in range(15)],
        [[r + c for c in range(15)] for r in range(15)],
        [[(r + c) % 2 for c in range(15)] for r in range(15)],
        [list(range(15)) for _ in range(15)],
    ]
    seen_formal = {encode(sample), *(encode(grid) for grid in formal_grids)}
    rng = random.Random(20261006)
    while len(formal_grids) < 20:
        grid = random_grid(rng)
        raw = encode(grid)
        if raw in seen_formal:
            continue
        seen_formal.add(raw)
        formal_grids.append(grid)
    formal = [sample] + formal_grids
    cases = []
    for index, grid in enumerate(formal):
        raw = encode(grid)
        expected = str(oracle(raw))
        assert run_code(REFERENCE, raw) == expected
        cases.append({
            "name": "来源样例（更正上游错误答案）" if index == 0 else f"隐藏验证 {index}",
            "input": raw,
            "expectedOutput": expected + "\n",
            "hidden": index > 0,
            "weight": 1,
        })

    oracle_rng = random.Random(20261007)
    oracle_cases = []
    seen_oracle = set(seen_formal)
    while len(oracle_cases) < 160:
        raw = encode(random_grid(oracle_rng))
        if raw in seen_oracle:
            continue
        seen_oracle.add(raw)
        expected = str(oracle(raw))
        assert run_code(REFERENCE, raw) == expected
        oracle_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    mutant_singletons = REFERENCE.replace("count += 1 + ways[(nr, nc)]", "count += 1 + ways[(nr, nc)]")
    mutant_singletons = mutant_singletons.replace("answer += count", "answer += count + 1")
    mutant_down_right = REFERENCE.replace(
        "((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1))",
        "((r + 1, c), (r, c + 1))",
    )
    mutants = [
        ("错误地把单格路径也计入答案", mutant_singletons),
        ("只检查向下和向右的邻居", mutant_down_right),
    ]
    controls = []
    for index, (name, code) in enumerate(mutants, 1):
        rejected = [i for i, case in enumerate(cases)
                    if run_code(code, case["input"]) != case["expectedOutput"].strip()]
        assert rejected, f"mutant survived: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})
        (OA / "negative-controls" / f"{PID}-{index}.py").write_text(code)

    description = (
        "给定一个最多 15×15 的网格，每个格子的值在 0..65535 之间。路径是由至少两个格子组成的序列，"
        "相邻格子必须上下左右相邻，且每一步的值严格大于前一步。不同位置序列视为不同路径。"
        "统计递增路径总数；Part 2 保证答案不超过 20,000,000,000，需使用 64 位整数。\n\n"
        "来源样例的网格未作修改，但上游输出 601079908 与规则不符。独立反向 DFS 和独立升序动态规划均得 600537344；"
        "本站将公开答案更正为 600537344，并在来源证据中保留差异。\n\n"
        "原题为函数题，没有规定标准输入输出协议；本站补充下述协议。"
    )
    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview",
        "title": "统计递增路径（64 位计数）", "difficulty": "中等",
        "tags": ["OA", "Hudson River Trading", "图论", "动态规划", "网格"],
        "description": description,
        "input": "第一行输入行数 R（1..15）；之后每行输入列数 Cᵢ（1..15），再输入该行 Cᵢ 个整数（0..65535）。各行可不等长；仅给出的格子存在。",
        "output": "输出长度至少为 2 的严格递增路径总数。",
        "explanation": "来源题 Part 2 仅扩大路径数上限至 20 billion；路径和网格规则继承 Part 1。上游样例答案经双算法核对后更正。",
        "hints": ["严格递增使路径图成为 DAG。可从每个格子 DFS 统计后缀路径，也可按值排序做动态规划。"],
        "timeLimit": 4, "memoryLimit": 262144, "outputLimit": 65536,
        "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = REFERENCE.rstrip() + "\n"
    explanation = (
        "## 思路\n\n把格子视为有向无环图，每个格子连向上下左右数值更大的邻格。按值从大到小处理，"
        "令 `ways[u]` 为从 u 出发、至少再走一步的递增路径数，则 `ways[u] = Σ(1 + ways[v])`，"
        "其中 v 遍历更大的相邻格子。将所有 `ways[u]` 相加即为答案。\n\n"
        "## 正确性证明\n\n任意递增路径有唯一首格 u 和唯一第二格 v。v 必是 u 的更大相邻格；以 v 为首的后缀要么在 v 结束（对应 1），"
        "要么继续到更大邻格（对应 `ways[v]`）。因此对所有合法 v 求和恰好枚举每条从 u 开始的路径一次。严格递增保证处理 u 时所有更大邻格已完成，"
        "求和覆盖所有首格后便得到全部且不重不漏的路径。\n\n"
        "## 复杂度\n\n设格子数 V≤225，邻接边数 E≤4V。排序耗时 O(V log V)，动态规划 O(E)，空间 O(V)。\n\n"
        "## 来源与样例校正\n\nPart 2 明确沿用 Part 1，仅将路径数量上限扩大到 20 billion。固定的 15×15 网格按两种独立算法计算均为 `600537344`，"
        "而原页面标注 `601079908`。本站保留原网格，修正公开答案并明确注明源样例错误；标准输入输出格式是本站补充。"
    )
    editorial = {
        "schemaVersion": 1, "id": PID, "title": problem["title"],
        "explanation": explanation,
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"],
        "author": "CSWork",
    }

    write_json(OA / "packages" / f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(reference)
    write_json(OA / "oracles" / f"{PID}.json", oracle_cases)
    write_json(OA / "mutants" / f"{PID}.json", [{"name": name, "code": code} for name, code in mutants])
    write_json(OA / "editorials" / f"{PID}.json", editorial)
    candidate = {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "sourceContentHash": source["contentHash"],
            "packageChecksum": checksum, "editorial": explanation,
            "authoredSolutions": [{"language": "python", "code": reference}],
        }],
    }
    write_json(OA / "candidate-batches" / f"{BATCH}.json", candidate)

    path1_bytes, path2_bytes = git_bytes(PATH1), git_bytes(PATH2)
    source_evidence = {
        "schemaVersion": 1,
        "upstreamCommit": UPSTREAM_COMMIT,
        "item": {
            "id": PID, "sourceUrl": source["sourceUrl"],
            "catalogContentHash": source["contentHash"],
            "inheritedRulesFrom": {
                "id": "oa-hudson-river-trading-5", "sourceUrl": inherited["sourceUrl"],
                "catalogContentHash": inherited["contentHash"],
            },
            "rawFiles": [
                {"path": PATH1, "blob": git_blob(PATH1), "sha256": hashlib.sha256(path1_bytes).hexdigest()},
                {"path": PATH2, "blob": git_blob(PATH2), "sha256": hashlib.sha256(path2_bytes).hexdigest()},
            ],
            "resolvedSemantics": {
                "grid": "At most 15 rows and 15 columns; each existing value is 0..65535 inclusive. Ragged rows are allowed by the inherited source example.",
                "path": "A sequence of at least two cells; consecutive cells are orthogonally adjacent and values strictly increase.",
                "identity": "Paths with different cell-location sequences are distinct, even when values match.",
                "countBound": "Part 2 raises the maximum count to 20 billion; use 64-bit output.",
                "sampleCorrection": "The exact source 15x15 grid yields 600537344 under memoized reverse DFS and ascending-value DP. The source's 601079908 is incorrect; candidate retains the grid and corrects only the answer.",
                "siteInputSupplement": "Rows, per-row column counts, and values are serialized as whitespace-separated integers; the source is a function problem and did not define stdin/stdout.",
            },
            "sampleAudit": {
                "sourceOutput": 601079908, "reverseDfs": source_sample_count,
                "ascendingDynamicProgramming": alternate_ascending_dp(sample),
            },
        },
    }
    write_json(OA / "source-evidence" / f"{BATCH}.json", source_evidence)

    write_json(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
            "previousReason": PREVIOUS_REASON,
            "reason": (
                "固定 Part 1 明确网格至多 15×15、值域 0..65535、上下左右相邻、路径长度至少 2、严格递增及位置序列区分；"
                "Part 2 唯一变化是路径计数上限扩大至 20 billion。固定 15×15 网格由 memoized reverse DFS 与独立升序 DP 都计算为 600537344，"
                "证实来源输出 601079908 有误。本站保留原输入并公开更正答案，明确标记为源样例修正，不声称源答案正确；补充标准 I/O 协议。"
                "160 个独立 oracle 输入、20 个互异隐藏正式用例、两种独立样例复算及两个正常运行 mutant 检查均通过，候选仍待沙箱验证。"
            ),
        }],
    })
    write_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1, "seed": 20261006,
        "problems": [{
            "id": PID, "formalCases": len(cases), "publicCases": 1,
            "hiddenCases": sum(case["hidden"] for case in cases),
            "oracleCases": len(oracle_cases),
            "uniqueOracleInputs": len({case["input"] for case in oracle_cases}),
            "sourceSampleReverseDfs": source_sample_count,
            "sourceSampleAscendingDp": alternate_ascending_dp(sample),
            "sourceSampleListedOutput": 601079908,
            "negativeControls": controls,
            "referenceSha256": hashlib.sha256(reference.encode()).hexdigest(),
            "localValidationOnly": True,
        }],
        "note": "本地 reference/oracle、双算法源样例复算、formal hidden cases 与 mutants 验证；未连接 GoJudge。",
    })
    print(json.dumps({
        "id": PID, "formalCases": len(cases), "hiddenCases": sum(case["hidden"] for case in cases),
        "oracleCases": len(oracle_cases), "sourceSample": source_sample_count,
        "mutantsKilled": len(controls), "checksum": checksum,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
