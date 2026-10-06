"""Recover and validate Rubrik #13 (Horizontal Pod Autoscaler).

The original page's proposed historical global floor is unsafe when a point
assignment can lower a pod. The reference keeps the last point assignment and
applies the maximum type-2 value strictly after that timestamp.
"""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
IDENT = "oa-rubrik-13"
BATCH = "rubrik-13-recovered"
SEED = 20261006
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/rubrik.mdx"
SOURCE_BLOB = "27ce8deadb8ef015ef1db75b5f6f5b1a3dd036c2"
SOURCE_SHA256 = "b7d37e4538b67205f2ee1be998ea8b393df72f0b6d0d15f0d8cee332422349af"
CATALOG_HASH = "816aa8fcc9938841d943a80e3c5e7d457066b9c7bc501db18e14f4c37c5a2c46"
SOURCE_URL = "https://oamaster.com/docs/companies/rubrik#13-horizontal-pod-autoscaler"

REFERENCE = r'''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, m = data[0], data[1]
    pods = data[2:2 + n]
    logs = [data[i:i + 3] for i in range(2 + n, 2 + n + 3 * m, 3)]

    # suffix[i] = largest type-2 target at operation i or later.
    suffix = [0] * (m + 1)
    for i in range(m - 1, -1, -1):
        typ, _, x = logs[i]
        suffix[i] = max(suffix[i + 1], x if typ == 2 else 0)

    last_value = pods[:]
    last_assignment = [0] * n  # initial values are assigned at time 0
    for time, (typ, p, x) in enumerate(logs, start=1):
        if typ == 1:
            last_value[p - 1] = x
            last_assignment[p - 1] = time

    answer = [max(last_value[i], suffix[last_assignment[i]]) for i in range(n)]
    return " ".join(map(str, answer))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def encode(pods: list[int], logs: list[tuple[int, int, int]]) -> str:
    rows = [f"{len(pods)} {len(logs)}", " ".join(map(str, pods))]
    rows.extend(f"{typ} {p} {x}" for typ, p, x in logs)
    return "\n".join(rows) + "\n"


def direct_oracle(pods: list[int], logs: list[tuple[int, int, int]]) -> list[int]:
    """Literal operation-by-operation simulation; intentionally small-input only."""
    state = pods[:]
    for typ, p, x in logs:
        if typ == 1:
            state[p - 1] = x
        else:
            state = [max(value, x) for value in state]
    return state


def run(path: Path, raw: str, timeout: int = 10) -> str:
    proc = subprocess.run([sys.executable, "-I", str(path)], input=raw,
                          text=True, capture_output=True, timeout=timeout,
                          check=True)
    return proc.stdout.rstrip("\n")


def normalize(package: dict) -> dict:
    js = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write("
        "JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(["node", "--import", "tsx", "-e", js], cwd=ROOT,
                          input=json.dumps(package, ensure_ascii=False),
                          text=True, capture_output=True, check=True)
    return json.loads(proc.stdout)


def main() -> None:
    for folder in ("packages", "references", "oracles", "mutants", "editorials",
                   "source-evidence", "resolutions", "validation", "candidate-batches",
                   "negative-controls"):
        (OA / folder).mkdir(parents=True, exist_ok=True)
    reference_path = OA / "references" / f"{IDENT}.py"
    reference_path.write_text(REFERENCE, encoding="utf-8")

    samples = [
        ("OAMaster 样例 1", [2, 4, 1, 4], [(1, 2, 30), (1, 3, 4), (2, -1, 10)], [10, 30, 10, 10]),
        ("OAMaster 样例 2", [3, 50, 2, 1, 10], [(1, 2, 0), (2, -1, 8), (1, 3, 20)], [8, 8, 20, 8, 10]),
    ]
    # Critical source-code counterexample: an old high target must not survive
    # a later point decrease and a subsequent lower, but still effective, HPA.
    regression = ([100], [(2, -1, 50), (1, 1, 1), (2, -1, 10)], [10])
    # A later point assignment is exempt from all earlier type-2 operations.
    earlier_floor = ([4, 2], [(2, -1, 9), (1, 1, 3)], [3, 9])
    # The suffix maximum after the last point assignment matters, not merely
    # the final type-2 value.
    suffix_max_case = ([1], [(1, 1, 2), (2, -1, 20), (2, -1, 7)], [20])

    rng = random.Random(SEED)
    generated: list[tuple[list[int], list[tuple[int, int, int]]]] = []
    seen: set[str] = set()
    while len(generated) < 120:
        n = rng.randint(1, 9)
        m = rng.randint(1, 18)
        pods = [rng.randint(1, 30) for _ in range(n)]
        logs = []
        for _ in range(m):
            if rng.random() < 0.57:
                logs.append((1, rng.randint(1, n), rng.randint(0, 30)))
            else:
                logs.append((2, -1, rng.randint(0, 30)))
        raw = encode(pods, logs)
        if raw not in seen:
            seen.add(raw)
            generated.append((pods, logs))

    oracle_rows: list[dict] = []
    input_seen: set[str] = set()
    for pods, logs, expected in [*[(p, l, e) for _, p, l, e in samples],
                                 regression, earlier_floor, suffix_max_case,
                                 *[(p, l, direct_oracle(p, l)) for p, l in generated]]:
        raw = encode(pods, logs)
        assert raw not in input_seen, "oracle inputs must be unique"
        input_seen.add(raw)
        actual = run(reference_path, raw)
        assert actual == " ".join(map(str, expected)), (raw, expected, actual)
        oracle_rows.append({"input": raw, "expectedOutput": " ".join(map(str, expected)) + "\n"})
    assert len(oracle_rows) >= 120

    specs: list[tuple[str, list[int], list[tuple[int, int, int]], list[int], bool]] = []
    specs.extend((name, pods, logs, expected, False) for name, pods, logs, expected in samples)
    specs.extend([
        ("回归：历史较大 HPA 不能覆盖点赋值后的较小 HPA", *regression, True),
        ("点赋值后不受此前 HPA 影响", *earlier_floor, True),
        ("后缀取最大 HPA 而非最后一个", *suffix_max_case, True),
    ])
    for i, (pods, logs) in enumerate(generated[:24], start=1):
        specs.append((f"随机差分 {i}", pods, logs, direct_oracle(pods, logs), True))
    specs.extend([
        ("最大边界：n=m=200000，连续 HPA", [1] * 200_000,
         [(2, -1, 1_000_000_000)] * 200_000,
         [1_000_000_000] * 200_000, True),
        ("最大值边界：逐点下调后无后续 HPA", [1_000_000_000] * 100_000,
         [(1, i, 0) for i in range(1, 100_001)], [0] * 100_000, True),
    ])
    cases = []
    for name, pods, logs, expected, hidden in specs:
        raw = encode(pods, logs)
        actual = run(reference_path, raw, timeout=20)
        assert actual == " ".join(map(str, expected)), name
        cases.append({"name": name, "input": raw,
                      "expectedOutput": " ".join(map(str, expected)) + "\n",
                      "hidden": hidden, "weight": 1})
    assert len(cases) >= 30

    # Mutant A uses a historical maximum as an eternal floor (the upstream
    # reference's unsafe assumption). Mutant B uses only the last type-2 event.
    mutant_a = REFERENCE.replace(
        "    answer = [max(last_value[i], suffix[last_assignment[i]]) for i in range(n)]",
        "    historical_floor = max((x for typ, _, x in logs if typ == 2), default=0)\n"
        "    answer = [max(last_value[i], historical_floor) for i in range(n)]")
    mutant_b = REFERENCE.replace(
        "    answer = [max(last_value[i], suffix[last_assignment[i]]) for i in range(n)]",
        "    last_hpa = [0] * (m + 1)\n"
        "    for time, (typ, _, x) in enumerate(logs, start=1):\n"
        "        if typ == 2:\n"
        "            last_hpa[time] = x\n"
        "    answer = [max(last_value[i], last_hpa[m]) for i in range(n)]")
    mutant_rows = []
    for index, (name, code) in enumerate([
            ("把历史最大 HPA 永久当作 floor", mutant_a),
            ("只使用最后一条 HPA 而不是后缀最大值", mutant_b)], start=1):
        assert code != REFERENCE
        path = OA / "negative-controls" / f"{IDENT}-{index}.py"
        path.write_text(code, encoding="utf-8")
        rejects = []
        for case_index, case in enumerate(cases):
            result = subprocess.run([sys.executable, "-I", str(path)],
                                    input=case["input"], text=True,
                                    capture_output=True, timeout=20)
            assert result.returncode == 0, (name, case["name"], result.stderr)
            if result.stdout.rstrip("\n") + "\n" != case["expectedOutput"]:
                rejects.append(case_index)
        assert rejects, (name, "mutant survived")
        mutant_rows.append({"name": name, "code": code,
                            "rejectedByCases": rejects})

    source = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(entry for entry in source["items"] if entry["id"] == IDENT)
    assert item["contentHash"] == CATALOG_HASH
    assert item["sourceUrl"] == SOURCE_URL
    package = normalize({
        "schemaVersion": 1,
        "problem": {
            "id": IDENT, "courseId": "gomall", "lessonId": "00-overview",
            "title": "Horizontal Pod Autoscaler",
            "difficulty": "中等", "tags": ["OA", "Rubrik", "数组", "模拟"],
            "description": "维护 n 个微服务的 pod 数量。操作 1 将指定服务的数量直接设为 x（可增加也可减少）；操作 2 将所有小于 x 的服务数量提升到 x。按顺序执行全部操作并输出最终数组。",
            "input": "第一行输入 n、m；第二行输入 n 个初始 pods；随后 m 行各输入 typ p x。typ=1 表示将 1-based 服务 p 直接设为 x；typ=2 时 p 必须为 -1，表示对所有 pods 执行 max(pods[i],x)。原始 MDX 未提供范围；本站补充 1≤n,m≤200000、1≤pods[i]≤10^9、0≤x≤10^9，并定义此 stdin/stdout 协议。",
            "output": "输出 n 个最终 pod 数量，以空格分隔。",
            "explanation": "完整思路、正确性证明与复杂度见配套题解。",
            "hints": ["点赋值可以降低单个值；不要把历史 HPA 最大值当成永远有效的下界。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 8192,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    })
    (OA / "packages" / f"{IDENT}.json").write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OA / "oracles" / f"{IDENT}.json").write_text(json.dumps(oracle_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OA / "mutants" / f"{IDENT}.json").write_text(json.dumps(mutant_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    editorial = {
        "schemaVersion": 1, "id": IDENT, "title": "Horizontal Pod Autoscaler",
        "sourceUrl": SOURCE_URL, "sourceContentHash": CATALOG_HASH, "author": "CSWork",
        "explanation": """## 思路

操作 2 对每个当前值执行 chmax(x)，而操作 1 会覆盖单个位置、允许把它降低。因此不能把所有历史 HPA 的最大值作为永久 floor。对每个位置记录最后一次初始/点赋值的值与时间；再从右向左计算每个时间点之后（含该时刻位置）的 type-2 最大 x。最终每项为 `max(最后点赋值值, 最后赋值之后的 HPA 最大 x)`。

## 正确性证明

固定一个服务 i。它的初值或最后一次 type-1 操作把当前值精确设为 `last_value[i]`。之后，type-1 不再影响它；每条 type-2 操作把它与 x 取最大值。连续应用这些操作的结果等于与这些 x 的最大值取最大值。因此答案是 `max(last_value[i], suffix_max[last_assignment[i]])`。赋值之前的 HPA 已被该 type-1 覆盖，不会被错误计入。

## 复杂度

时间 O(n+m)，空间 O(n+m)。

## 来源说明

固定 OAMaster 源码说明了两类操作，但该 MDX 未提供完整输入协议与范围；本站明确补充 1-based 点下标及规模边界。上游附带的单调历史 floor 解法在点赋值可降低数值时不正确，本题使用后缀最大值修正。""",
    }
    (OA / "editorials" / f"{IDENT}.json").write_text(json.dumps(editorial, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    package_checksum = hashlib.sha256(
        json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    manifest = {
        "id": IDENT,
        "sourceContentHash": CATALOG_HASH,
        "packageChecksum": package_checksum,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
        "editorial": editorial["explanation"],
    }
    (OA / "candidate-batches" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "items": [manifest]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    source_file_bytes = subprocess.run(
        ["git", "show", f"{SOURCE_COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        capture_output=True, check=True).stdout
    git_blob = subprocess.run(["git", "hash-object", "--stdin"], cwd=ROOT,
                              input=source_file_bytes, capture_output=True,
                              check=True, text=False).stdout.decode().strip()
    assert git_blob == SOURCE_BLOB
    assert hashlib.sha256(source_file_bytes).hexdigest() == SOURCE_SHA256
    evidence = {"schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
                "origin": "https://oamaster.com", "commit": SOURCE_COMMIT,
                "items": {IDENT: {"sourceCommit": SOURCE_COMMIT, "rawPath": SOURCE_PATH,
                                  "rawGitBlob": SOURCE_BLOB, "sourceFileSha256": SOURCE_SHA256,
                                  "catalogContentHash": CATALOG_HASH, "sourceUrl": SOURCE_URL,
                                  "decision": "authored",
                                  "reason": "按固定题源核对操作语义；独立逐操作模拟 oracle 120 例、最大边界及两个正常退出错误解本地验证通过。"}}}
    (OA / "source-evidence" / f"{BATCH}.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    review_doc = json.loads((OA / "reviews" / "rubrik-capital-remaining.json").read_text(encoding="utf-8"))
    previous_reason = next(item["reason"] for item in review_doc["items"] if item["id"] == IDENT)
    resolution = {"schemaVersion": 1, "items": [{
        "id": IDENT,
        "batch": BATCH,
        "sourceContentHash": CATALOG_HASH,
        "previousReason": previous_reason,
        "reason": "按固定题源中给出的两类操作补全本站 stdin/stdout 协议，并明确服务下标为 1-based。点赋值是直接覆盖，允许降低值；其后全局操作等价于取后缀最大 x。125 组独立模拟、31 组正式测试与 2 个错误解均通过 Dot GoJudge。",
    }]}
    (OA / "resolutions" / f"{BATCH}.json").write_text(json.dumps(resolution, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    validation = {"schemaVersion": 1, "seed": SEED,
                  "note": "本地独立模拟与错误解验证通过；Dot GoJudge 结果见对应 reports 文件。",
                  "problems": [{"id": IDENT, "oracleCases": len(oracle_rows),
                                "negativeControls": [{"name": row["name"],
                                                     "rejectedByCases": row["rejectedByCases"]}
                                                    for row in mutant_rows]}]}
    (OA / "validation" / f"{BATCH}.json").write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{IDENT}: {len(cases)} formal cases; {len(oracle_rows)} unique direct-oracle cases; 2 normal-exit mutants killed; max n/m bounds covered.")


if __name__ == "__main__":
    main()
