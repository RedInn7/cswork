from __future__ import annotations

import hashlib
import itertools
import json
import random
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
ITEM = next(x for x in CATALOG["items"] if x["id"] == "oa-goldman-sachs-14")
PID = ITEM["id"]
SEED = 20261006
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_BLOB = "8978a4b2429efd2497a72f74abb93f0b1ab1aa4a"
PREVIOUS_REASON = "原文约束未知，且要求在任意升降比较模式下重排另一组数并最大化相邻绝对差；现有整理解法的局部峰谷分配没有证明全局最优，不能可靠判定。"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = '''def maximize_niceness(ramu, sonu):
    n = len(ramu)
    if len(sonu) != n or n == 0 or n > 14:
        raise ValueError("site limit: 1 <= n <= 14")
    full = (1 << n) - 1
    # dp[mask][last] is the best sum for a valid prefix using mask and ending
    # with sonu[last]. A position's direction is fixed by adjacent Ramu values.
    dp = [[None] * n for _ in range(1 << n)]
    for j in range(n):
        dp[1 << j][j] = 0
    for mask in range(1 << n):
        position = mask.bit_count() - 1
        if position < 0 or position == n - 1:
            continue
        for last in range(n):
            score = dp[mask][last]
            if score is None:
                continue
            for nxt in range(n):
                bit = 1 << nxt
                if mask & bit:
                    continue
                should_rise = ramu[position] < ramu[position + 1]
                if (sonu[last] < sonu[nxt]) != should_rise:
                    continue
                new_mask = mask | bit
                value = score + abs(sonu[last] - sonu[nxt])
                old = dp[new_mask][nxt]
                if old is None or value > old:
                    dp[new_mask][nxt] = value
    result = [x for x in dp[full] if x is not None]
    if not result:
        raise ValueError("no valid arrangement")
    return max(result)

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        raise ValueError("expected n and two arrays")
    n = data[0]
    if n < 1 or n > 14 or len(data) != 1 + 2 * n:
        raise ValueError("expected n, then n Ramu lengths and n Sonu lengths")
    ramu, sonu = data[1:1+n], data[1+n:]
    if len(set(ramu)) != n or len(set(sonu)) != n:
        raise ValueError("each student's chalk lengths are distinct")
    return str(maximize_niceness(ramu, sonu))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def input_for(ramu: list[int], sonu: list[int]) -> str:
    return f"{len(ramu)}\n" + " ".join(map(str, ramu)) + "\n" + " ".join(map(str, sonu)) + "\n"


def brute_force(ramu: list[int], sonu: list[int]) -> int:
    best = -1
    for order in itertools.permutations(sonu):
        if all((ramu[i] < ramu[i + 1]) == (order[i] < order[i + 1])
               for i in range(len(ramu) - 1)):
            best = max(best, sum(abs(order[i] - order[i + 1])
                                 for i in range(len(order) - 1)))
    if best < 0:
        raise AssertionError("strict comparison pattern must have a valid rank permutation")
    return best


def run_code(code: str, raw: str) -> str:
    proc = subprocess.run(["python3", "-I", "-c", code], cwd=ROOT,
                          input=raw, text=True, capture_output=True,
                          timeout=10, check=False)
    if proc.returncode:
        raise RuntimeError(f"reference failed for input {raw!r}: {proc.stderr}")
    return proc.stdout.rstrip("\n")


ENV: dict[str, object] = {}
exec(compile(REFERENCE, "<goldman-14-reference>", "exec"), ENV)


def main() -> None:
    assert ITEM["contentHash"] == "f0e323de37b0f99a5803006e9bc1d7140f10d0edb565c1363d1e05c2b3ca754d"
    prior_file = json.loads((OA / "reviews/goldman-sachs-remaining.json").read_text())
    prior = next(x for x in prior_file["items"] if x["id"] == PID)
    assert prior["status"] == "blocked" and prior["reason"] == PREVIOUS_REASON
    evidence = json.loads((OA / "source-evidence/goldman-sachs-remaining.json").read_text())
    source = next(x for x in evidence["items"] if x["id"] == PID)
    assert source["catalogContentHash"] == ITEM["contentHash"]
    assert source["sourceUrl"] == ITEM["sourceUrl"]
    assert source["gitBlobSha"] == SOURCE_BLOB
    assert evidence["commit"] == UPSTREAM_COMMIT
    blob = subprocess.run(["git", "cat-file", "-p", SOURCE_BLOB], cwd=ROOT,
                          text=True, capture_output=True, check=True).stdout
    assert "distinct chalks" in blob and "positive integers" in blob
    assert "sum of the absolute length differences between all adjacent chalks" in blob
    assert "Unknown for now" in blob

    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] in ("blocked", "awaiting_sandbox"), state
    assert state.get("batch") in (None, "goldman-sachs-14-recovered"), state
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            if folder == "candidate-batches" and path.name == "goldman-sachs-14-recovered.json":
                continue
            manifest = json.loads(path.read_text())
            assert all(x["id"] != PID for x in manifest.get("items", [])), (folder, path)
    registry = json.loads((OA / "registry.json").read_text())
    assert PID not in json.dumps(registry)

    rng = random.Random(SEED)
    public = [([4, 1, 3, 2], [10, 1, 9, 3]),
              ([1, 2], [9, 2]),
              ([4, 3, 2, 1], [40, 10, 30, 20])]
    random_inputs: list[tuple[list[int], list[int]]] = []
    for _ in range(120):
        n = rng.randint(1, 8)
        ramu = rng.sample(range(1, 100), n)
        sonu = rng.sample(range(1, 1000), n)
        random_inputs.append((ramu, sonu))

    start = time.perf_counter()
    oracle_rows = []
    for ramu, sonu in public + random_inputs:
        expected = brute_force(ramu, sonu)
        actual = int(run_code(REFERENCE, input_for(ramu, sonu)))
        assert actual == expected, (ramu, sonu, actual, expected)
        oracle_rows.append({"input": input_for(ramu, sonu), "expectedOutput": f"{expected}\n"})

    exhaustive_count = 0
    # For all strict-up/down patterns through n=7 and all permutations of 1..n,
    # compare the DP against independently enumerated feasible permutations.
    for n in range(1, 8):
        sonu = list(range(1, n + 1))
        for pattern in itertools.product((False, True), repeat=max(0, n - 1)):
            ramu = [0]
            for rise in pattern:
                ramu.append(ramu[-1] + (1 if rise else -1))
            # Shift to positive lengths; the fixed source only requires positives.
            offset = 1 - min(ramu)
            ramu = [x + offset for x in ramu]
            expected = brute_force(ramu, sonu)
            assert int(ENV["maximize_niceness"](ramu, sonu)) == expected
            exhaustive_count += 1

    formal = public + [
        ([1], [999999999999999999999999]),
        ([1, 2, 3], [10**30, 1, 10**20]),
        ([6, 2, 7, 1, 5], [90, 4, 80, 3, 50]),
        ([1, 3, 2, 4, 6, 5], [100, 2, 90, 10, 80, 20]),
        ([1, 4, 2, 5, 3, 6, 7], [999999999999, 8, 888888888888, 7, 777777777777, 6, 555555555555]),
        ([i + 1 for i in range(14)], [10**35 - i * 10**20 for i in range(14)]),
        ([1, 3, 2, 4], [40, 10, 30, 20]),
        ([4, 2, 3, 1], [10, 40, 20, 30]),
        ([1, 3, 5, 4, 2], [90, 10, 70, 30, 50]),
        ([5, 3, 1, 2, 4], [50, 20, 80, 10, 60]),
        ([1, 4, 2, 6, 3, 5], [12, 100, 13, 90, 14, 80]),
        ([6, 5, 4, 3, 2, 1], [1, 100, 2, 99, 3, 98]),
        ([1, 2, 3, 4, 5, 6], [100, 90, 80, 70, 60, 50]),
        ([4, 1, 5, 2, 6, 3, 7], [70, 10, 60, 20, 50, 30, 40]),
        ([7, 6, 5, 4, 3, 2, 1], [15, 35, 25, 45, 5, 55, 65]),
        ([1, 3, 5, 4, 2, 6, 8, 7], [1000, 5, 900, 10, 800, 15, 700, 20]),
        ([8, 1, 7, 2, 6, 3, 5, 4], [3, 100, 4, 90, 5, 80, 6, 70]),
        ([1, 4, 2, 6, 3, 8, 5, 7], [18, 2, 16, 4, 14, 6, 12, 8]),
        ([2, 4, 6, 8, 7, 5, 3, 1], [101, 1, 99, 3, 97, 5, 95, 7]),
        ([5, 1, 4, 2, 3, 6, 8, 7], [17, 93, 21, 89, 25, 85, 29, 81]),
    ]
    cases = []
    expected_formal = []
    for i, (ramu, sonu) in enumerate(formal):
        expected = brute_force(ramu, sonu) if len(ramu) <= 8 else int(ENV["maximize_niceness"](ramu, sonu))
        expected_formal.append(expected)
        cases.append({"name": f"样例 {i + 1}" if i < len(public) else f"边界 {i-len(public)+1}",
                      "input": input_for(ramu, sonu), "expectedOutput": f"{expected}\n",
                      "hidden": i >= len(public), "weight": 1})

    mutants = [
        {"name": "不重排 Sonu 的数组，直接按输入次序计分",
         "code": "import sys\nx=list(map(int,sys.stdin.read().split()));n=x[0];a=x[1:1+n];b=x[1+n:];\nprint(sum(abs(b[i]-b[i+1]) for i in range(n-1)) if all((a[i]<a[i+1])==(b[i]<b[i+1]) for i in range(n-1)) else -1)\n"},
        {"name": "忽略 Ramu 的升降模式，只按升序排列后计分",
         "code": "import sys\nx=list(map(int,sys.stdin.read().split()));n=x[0];b=sorted(x[1+n:]);print(sum(abs(b[i]-b[i+1]) for i in range(n-1)))\n"},
    ]
    killed = []
    for mutant in mutants:
        rejects = []
        for i, (ramu, sonu) in enumerate(formal):
            proc = subprocess.run(["python3", "-I", "-c", mutant["code"]], cwd=ROOT,
                                  input=input_for(ramu, sonu), text=True,
                                  capture_output=True, timeout=10, check=True)
            if int(proc.stdout.strip()) != expected_formal[i]:
                rejects.append(i)
        assert rejects, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejects})

    editorial = """## 思路\n\n先把 Ramu 每一对相邻粉笔的关系转成固定方向：上升或下降。Sonu 的数组只允许重排，因此用位掩码表示已经放入的粉笔，用最后一个粉笔作为状态。`dp[mask][last]` 保存满足前缀方向条件、并以 `last` 结束时可取得的最大相邻差和。下一步只在符合对应方向时转移，代价增加两根粉笔长度差的绝对值。\n\n## 正确性\n\n任一合法排列的前缀都使用某个集合 `mask` 并以唯一的最后一个值结束。该排列的前缀得分不超过 `dp[mask][last]`；把它的下一项加到状态时，转移恰按 Ramu 对应位置的升降关系筛选，并加上唯一新增的相邻差。反过来，每条 DP 转移都满足相同方向限制，故生成的每个状态代表合法排列。归纳可知终态枚举了全部且仅有合法排列，取最大值得全局最优。\n\n## 复杂度\n\n本站限制 `1≤N≤14`，精确子集 DP 时间 `O(N²·2^N)`、空间 `O(N·2^N)`。长度值按任意精度整数计算。\n\n## 来源与本站约定\n\n固定原文明确两组各有 N 根不同长度的粉笔，Sonu 必须逐位置复制 Ramu 相邻长度的严格升降关系，并最大化相邻绝对差之和。原文没有公布 N、数值约束或 I/O 样例；本题不声称恢复原站隐藏限制。本站仅补充标准输入：N、Ramu 的 N 个正整数、Sonu 的 N 个正整数，并将 N 限为 14，以保证精确算法资源可控。"""

    package_raw = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "保持相邻升降模式的最大粉笔差值和", "difficulty": "困难",
            "tags": ["OA", "Goldman Sachs", "动态规划", "排列"],
            "description": "给定 Ramu 与 Sonu 各自 N 根长度互不相同的粉笔。Sonu 可以重排自己的粉笔，但每一相邻位置必须与 Ramu 对应位置保持相同的严格升降方向。求 Sonu 相邻粉笔长度差绝对值之和的最大值。",
            "input": "第一行 N（本站范围 1≤N≤14）。第二行 N 个正整数表示 Ramu 的粉笔长度；第三行 N 个正整数表示 Sonu 的粉笔长度。每组长度互不相同。",
            "output": "输出满足相邻升降模式的最大绝对差之和。",
            "explanation": "用 bitmask 表示已经安排的粉笔，以最后一根粉笔作为状态；逐位匹配 Ramu 的升降关系并最大化总差值。",
            "hints": ["位置方向由 Ramu 的相邻长度关系决定。", "子集与最后一个值足以描述已完成前缀的转移边界。", "N≤14 时可以保留所有子集状态并求精确最优。"],
            "timeLimit": 5, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    schema_script = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    proc = subprocess.run(["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
                          input=json.dumps(package_raw, ensure_ascii=False), text=True,
                          capture_output=True, check=True)
    package = json.loads(proc.stdout)
    checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    manifest_item = {"id": PID, "sourceContentHash": ITEM["contentHash"],
                     "packageChecksum": checksum, "editorial": editorial,
                     "authoredSolutions": [{"language": "python", "code": REFERENCE}]}

    for ramu, sonu in public + random_inputs + [(a, b) for a, b in formal if len(a) <= 8]:
        expected = brute_force(ramu, sonu)
        actual = int(run_code(REFERENCE, input_for(ramu, sonu)))
        assert actual == expected, (ramu, sonu, actual, expected)
    # Maximum supported state count, using large arbitrary-precision values.
    max_n = list(range(1, 15))
    max_sonu = [10**35 - i * 10**20 for i in range(14)]
    assert int(run_code(REFERENCE, input_for(max_n, max_sonu))) == int(ENV["maximize_niceness"](max_n, max_sonu))

    put_json(OA / "packages" / f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE)
    put_json(OA / "oracles" / f"{PID}.json", oracle_rows)
    put_json(OA / "mutants" / f"{PID}.json", mutants)
    put_json(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": ITEM["sourceUrl"], "sourceContentHash": ITEM["contentHash"], "author": "CSWork",
    })
    put_json(OA / "candidate-batches" / "goldman-sachs-14-recovered.json",
             {"schemaVersion": 1, "items": [manifest_item]})
    put_json(OA / "source-evidence" / "goldman-sachs-14-recovered.json", {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": UPSTREAM_COMMIT, "origin": "https://oamaster.com",
        "items": {PID: {
            "url": ITEM["sourceUrl"], "contentHash": ITEM["contentHash"],
            "catalogContentHash": ITEM["contentHash"], "company": ITEM["companyName"],
            "title": ITEM["title"], "sourcePath": source["path"], "gitBlobSha": SOURCE_BLOB,
            "fixedSourceEvidence": "Raw immutable source blob explicitly says both students have N distinct chalk lengths, requires each Sonu adjacent comparison to match Ramu's corresponding greater-than/less-than relation, and defines niceness as the sum of absolute adjacent length differences. The source constraints are literally Unknown for now; no original numeric or size bounds are inferred.",
            "siteAddedContract": "Standard input format and 1<=N<=14 are site additions only, clearly shown in the package. Positive integer input follows the source's positive-integer length description; lengths within each student's set are distinct as stated by source.",
        }},
    })
    reason = "固定源题意完整且可验证：两组粉笔各自长度互异，Sonu 必须复制 Ramu 每个相邻位置的严格升降方向，并最大化绝对差总和。原源未给约束，因此本站明确标注 N≤14 为资源边界，使用精确子集 DP；独立排列 oracle、方向模式穷举、边界和两个错误实现验证通过，仍待真实评测沙箱。"
    put_json(OA / "resolutions" / "goldman-sachs-14-recovered.json", {
        "schemaVersion": 1, "items": [{"id": PID, "batch": "goldman-sachs-14-recovered",
        "sourceContentHash": ITEM["contentHash"], "previousReason": prior["reason"], "reason": reason}],
    })
    put_json(OA / "validation/goldman-sachs-14-recovered.json", {
        "schemaVersion": 1, "seed": SEED, "problems": [{
            "id": PID, "oracleCases": len(oracle_rows), "uniqueOracleInputs": len({r["input"] for r in oracle_rows}),
            "referenceStdioCases": len(public) + len(random_inputs) + len([x for x in formal if len(x[0]) <= 8]) + 1,
            "publicCases": len(public), "hiddenCases": len(cases) - len(public),
            "exhaustiveDirectionPatternsThroughN7": exhaustive_count,
            "negativeControls": killed, "maxN": 14, "arbitraryPrecisionValues": True,
            "referenceSha256": sha(REFERENCE), "localValidationOnly": True,
        }],
    })
    print(json.dumps({"id": PID, "candidateBatch": "goldman-sachs-14-recovered",
                      "statusBefore": state["status"], "oracleCases": len(oracle_rows),
                      "formalCases": len(cases), "exhaustiveDirectionPatternsThroughN7": exhaustive_count,
                      "negativeControls": killed, "totalSeconds": round(time.perf_counter() - start, 3)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
