"""Generate an isolated, offline candidate for Google OA #45.

This script writes only the files belonging to `oa-google-45` and its unique
`google-45-recovered` candidate batch. It never contacts GoJudge or production.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-45"
BATCH = "google-45-recovered"
SEED = 20261006
UPSTREAM_REPOSITORY = "https://github.com/RedInn7/OA-Master"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
UPSTREAM_PAGE_PATH = "web/content/docs/companies/google.mdx"
UPSTREAM_PAGE_BLOB = "300032c24800642c2ecedab9d930e86db3cdb54a"
UPSTREAM_FASTPREP_PATH = "fastprep/Google/google-meeting-rooms-ii.md"
UPSTREAM_FASTPREP_BLOB = "86330450e6ee83b33cb77db3a8d44f227365252e"
SOURCE_URL = "https://oamaster.com/docs/companies/google#45-minimum-number-of-chairs"
FASTPREP_URL = "https://www.fastprep.io/problems/google-meeting-rooms-ii"
LEETCODE_URL = "https://leetcode.com/discuss/post/356520/google-oa-2019-min-number-of-chairs/"


REFERENCE = r'''import sys


def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        return ""
    n = values[0]
    if n < 1 or n > 200_000 or len(values) != 1 + 2 * n:
        raise ValueError("expected N, then N arrivals and N departures")
    starts = values[1:1 + n]
    ends = values[1 + n:]
    events = []
    for start, end in zip(starts, ends):
        if not (-1_000_000_000 <= start < end <= 1_000_000_000):
            raise ValueError("each interval must satisfy -1e9 <= S < E <= 1e9")
        events.append((start, 1))
        events.append((end, -1))
    # In half-open [S, E) intervals, departures release chairs before
    # arrivals at the same instant. Sorting delta ascending implements that.
    events.sort()
    occupied = answer = 0
    for _, delta in events:
        occupied += delta
        answer = max(answer, occupied)
    return str(answer)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


MUTANTS = [
    (
        "同刻到达先于离开",
        REFERENCE.replace("events.sort()", "events.sort(key=lambda event: (event[0], -event[1]))"),
    ),
    (
        "把区间重叠关系误当成可同时占用关系",
        r'''import sys

def solve(raw):
    values = list(map(int, raw.split()))
    n = values[0]
    starts, ends = values[1:1+n], values[1+n:]
    degree = []
    for i in range(n):
        degree.append(sum(
            starts[j] < ends[i] and starts[i] < ends[j]
            for j in range(n) if i != j
        ))
    return str(max(degree, default=0) + (1 if n else 0))

print(solve(sys.stdin.read()))
''',
    ),
]


def encode(starts: list[int], ends: list[int]) -> str:
    return f"{len(starts)}\n{' '.join(map(str, starts))}\n{' '.join(map(str, ends))}\n"


def oracle(starts: list[int], ends: list[int]) -> int:
    # Independent O(N^2) point scan: occupancy can only increase at arrivals,
    # so checking every distinct start time is sufficient for half-open ranges.
    return max(
        (sum(start <= t < end for start, end in zip(starts, ends)) for t in starts),
        default=0,
    )


def run(program: str, raw: str) -> str:
    result = subprocess.run(
        ["python3", "-c", program], input=raw, text=True,
        capture_output=True, timeout=5, check=False,
    )
    if result.returncode != 0:
        raise AssertionError((result.returncode, result.stderr[:300], raw[:300]))
    return result.stdout.strip()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put(folder: str, filename: str, document: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    review_file = OA / "reviews/google-remaining-b.json"
    old_review = next(
        item for item in json.loads(review_file.read_text(encoding="utf-8"))["items"]
        if item["id"] == PID
    )
    source_hash = source["contentHash"]

    fixed = [
        ([1, 2, 6, 5, 3], [5, 5, 7, 6, 8]),  # original same-question example
        ([0, 2, 3], [3, 4, 5]),              # departure at 3 frees before arrival
        ([-4, 2, 8], [-1, 5, 10]),           # no overlap; one chair suffices
    ]
    rng = random.Random(SEED)
    values = list(fixed)
    seen = {encode(starts, ends) for starts, ends in values}
    while len(values) < 120:
        n = rng.randint(1, 14)
        starts = [rng.randint(-12, 12) for _ in range(n)]
        ends = [start + rng.randint(1, 10) for start in starts]
        raw = encode(starts, ends)
        if raw not in seen:
            seen.add(raw)
            values.append((starts, ends))

    oracle_rows = []
    for starts, ends in values:
        raw = encode(starts, ends)
        expected = str(oracle(starts, ends))
        assert run(REFERENCE, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    # Keep three readable public cases and 27 fixed hidden cases.
    formal_values = fixed + values[3:30]
    cases = []
    for index, (starts, ends) in enumerate(formal_values):
        raw = encode(starts, ends)
        expected = str(oracle(starts, ends)) + "\n"
        cases.append({
            "name": f"示例 {index + 1}" if index < 3 else f"隐藏用例 {index - 2}",
            "input": raw,
            "expectedOutput": expected,
            "hidden": index >= 3,
            "weight": 1,
        })

    killed = []
    mutant_docs = []
    for name, program in MUTANTS:
        rejects = [
            index for index, case in enumerate(cases)
            if run(program, case["input"]) != case["expectedOutput"].strip()
        ]
        assert rejects, f"surviving mutant: {name}"
        killed.append({"name": name, "rejectedByCases": rejects})
        mutant_docs.append({"name": name, "code": program})

    description = (
        "给定 n 位客人的到达时间 S[i] 和离开时间 E[i]，计算整个活动期间同一时刻最多有多少位客人需要座位。"
        "按半开区间 [S[i], E[i]) 处理：在时刻 t 离开的客人已释放座位，因此同一时刻离开和到达可以复用椅子。"
    )
    limits = (
        "本站有效输入范围：1≤n≤200000；所有时间为整数，-10^9≤S[i]<E[i]≤10^9。"
        "这是本站补充范围，不声称来自 OAMaster；原始题面没有公布约束。"
    )
    problem = {
        "id": PID,
        "courseId": "gomall",
        "lessonId": "00-overview",
        "title": "最少椅子",
        "difficulty": "简单",
        "tags": ["OA", "Google", "排序", "扫描线"],
        "description": (
            description + "\n\n" + limits + "\n\n"
            + "原题来源：" + SOURCE_URL + "（固定 OAMaster 快照指纹 " + source_hash + "）。"
            + "同题补充证据：" + LEETCODE_URL + "；端点约定：" + FASTPREP_URL + "。"
        ),
        "input": "第一行 n；第二行给出 n 个到达时间 S[i]；第三行给出对应的 n 个离开时间 E[i]。",
        "output": "输出活动期间同时在场的客人最大数量，也就是所需的最少椅子数。",
        "explanation": "把到达记为 +1、离开记为 -1；同一时刻先处理离开，再处理到达，扫描人数的最大值。",
        "hints": ["将每次到达和离开看成时间事件。", "半开区间要求同刻离开先于到达。"],
        "timeLimit": 2,
        "memoryLimit": 262144,
        "outputLimit": 4096,
        "checker": "tokens",
        "languages": ["python", "go", "java", "cpp"],
    }

    package_input = {"schemaVersion": 1, "problem": problem, "cases": cases}
    normalize = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    parsed = subprocess.run(
        ["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
        input=json.dumps(package_input, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    ).stdout
    package = json.loads(parsed)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()

    explanation = f"""## 思路

把每位客人建成半开区间 [S[i], E[i])。到达事件使在场人数加一，离开事件使人数减一。按时间排序；同一时刻先处理离开，再处理到达，记录人数最大值。

## 正确性

对任意时刻 t，半开区间 [S,E) 覆盖 t 当且仅当 S≤t<E。事件扫描在每个时刻先移除所有 E=t 的区间，再加入所有 S=t 的区间，因此处理完该时刻后的人数，正好等于覆盖该时刻右侧瞬间的区间数；这也是该时刻之后直到下个事件前的在场人数。所有人数变化只发生在到达或离开事件处，所以扫描到的最大人数就是任何时刻的最大同时在场人数，也就是所需椅子数。

## 复杂度

对 2n 个事件排序，时间 O(n log n)，空间 O(n)。

## 来源与本站约定

原始 OAMaster 题目只给出 S/E 到离场定义，未列约束，也未包含示例。固定题目快照：{SOURCE_URL}；上游提交 `{UPSTREAM_COMMIT}`，Google 页面 Git blob `{UPSTREAM_PAGE_BLOB}`。同题公开问题页给出完全相同的叙述与样例，明确说明同一时刻离开与到达时可复用座位：{LEETCODE_URL}。另一份同题页将出席区间明确标为半开区间：{FASTPREP_URL}。本站明确补充 n≤200000 与时间范围，方便标准输入输出评测；不把这些范围归因于原题。"""
    editorial = {
        "schemaVersion": 1,
        "id": PID,
        "title": "最少椅子",
        "explanation": explanation,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL,
        "sourceContentHash": source_hash,
    }
    manifest_item = {
        "id": PID,
        "sourceContentHash": source_hash,
        "packageChecksum": sha(package_bytes),
        "editorial": explanation,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }
    candidate_manifest = {"schemaVersion": 1, "items": [manifest_item]}
    validation = {
        "schemaVersion": 1,
        "seed": SEED,
        "problems": [{
            "id": PID,
            "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len(seen),
            "publicCases": 3,
            "hiddenCases": sum(case["hidden"] for case in cases),
            "negativeControls": killed,
            "referenceSha256": sha(REFERENCE.encode()),
        }],
        "note": "仅本地独立 oracle/reference/mutant 验证；未连接 GoJudge，也未访问生产服务器。",
    }
    source_evidence = {
        "schemaVersion": 1,
        "repository": UPSTREAM_REPOSITORY,
        "commit": UPSTREAM_COMMIT,
        "catalogContentHash": source_hash,
        "items": [{
            "id": PID,
            "company": "Google",
            "title": source["title"],
            "sourceUrl": SOURCE_URL,
            "rawFiles": [
                {"path": UPSTREAM_PAGE_PATH, "gitBlobSha": UPSTREAM_PAGE_BLOB,
                 "excerpt": "There are n guests ... the k-th guest will attend at S[k] and leave at E[k]; return the minimum number of chairs."},
                {"path": UPSTREAM_FASTPREP_PATH, "gitBlobSha": UPSTREAM_FASTPREP_BLOB,
                 "excerpt": "Same source snapshot's FastPrep markdown retains the identical OAMaster text; constraints are explicitly unknown."},
            ],
            "supportingPages": [
                {"url": LEETCODE_URL,
                 "supports": "Exact same Google OA statement and example; narrative explicitly says simultaneous leaving guests free chairs for arrivals."},
                {"url": FASTPREP_URL,
                 "supports": "Same question page states half-open attendance intervals and arrival/departure constraints; cited only to resolve endpoint interpretation and as a cross-check, not as OAMaster-authored constraints."},
            ],
            "interpretation": {
                "interval": "[S[i], E[i]); departure at t frees a chair for an arrival at t.",
                "siteInputLimits": "1<=n<=200000 and -1e9<=S[i]<E[i]<=1e9; local supported domain, not claimed to be the unknown OAMaster bounds.",
                "inputProtocol": "stdin: n, then n arrival times, then n departure times; protocol is supplied by this site.",
                "confidence": "The original fixed snapshot alone does not specify endpoint behavior. An exact matching OA discussion and a same-question page independently specify it; treat candidate as needing GoJudge and source-owner review before publication.",
            },
        }],
    }
    resolution = {
        "schemaVersion": 1,
        "items": [{
            "id": PID,
            "batch": BATCH,
            "sourceContentHash": source_hash,
            "previousReason": old_review["reason"],
            "reason": (
                "同题的原始 OAMaster 快照正文与本地拷贝一致；其同题 OA 讨论复现完全相同的题意和示例，并在时间相同处明确说明离开的客人先释放椅子。"
                "本站补充半开区间约定、标准 I/O 和约束；约束只声明为本站支持范围。候选仍未通过 GoJudge。"
            ),
        }],
    }
    files = [
        ("packages", f"{PID}.json", package),
        ("editorials", f"{PID}.json", editorial),
        ("oracles", f"{PID}.json", oracle_rows),
        ("mutants", f"{PID}.json", mutant_docs),
        ("source-evidence", f"{BATCH}.json", source_evidence),
        ("resolutions", f"{BATCH}.json", resolution),
        ("validation", f"{BATCH}.json", validation),
        ("candidate-batches", f"{BATCH}.json", candidate_manifest),
    ]
    for folder, filename, document in files:
        put(folder, filename, document)
    path = OA / "references" / f"{PID}.py"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(REFERENCE, encoding="utf-8")
    for index, mutant in enumerate(mutant_docs, 1):
        path = OA / "negative-controls" / f"{PID}-{index}.py"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(mutant["code"].rstrip() + "\n", encoding="utf-8")

    print(
        f"{PID}: {len(oracle_rows)} unique oracle inputs; {len(cases)} formal cases "
        f"({len(cases) - 3} hidden); {len(killed)} normal-exit mutants killed"
    )


if __name__ == "__main__":
    main()
