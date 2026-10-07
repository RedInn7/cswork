"""Generate the offline-only candidate package for Amazon OA #114."""

from __future__ import annotations

from array import array
import hashlib
import json
import random
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-amazon-114"
BATCH = "amazon-114-recovered"
SEED = 20261006
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/amazon.mdx"
RAW_BLOB = "70650fad830ad60944ae8036fb4f134d9afc3fab"
CONTENT_HASH = "63ec2fda108af359626b92313939c6fc97d2e3962a39fc0cb8e0b3f43af2ecb2"
SOURCE_URL = "https://oamaster.com/docs/companies/amazon#114-compute-beauty-of-array-products"
REDDIT_URL = "https://www.reddit.com/r/leetcode/comments/1et4ojn/amazon_oa_question/"
PREVIOUS_REASON = "美丽度条件中比较对象与不等号被截断，单个例子不足以恢复定义。"

REFERENCE = '''from array import array

def solve(raw):
    data = array("q", map(int, raw.split()))
    if not data:
        return ""
    n, k = data[0], data[1]
    if not (1 <= n <= 200_000 and 1 <= k <= n):
        raise ValueError("input outside the site-defined bounds")
    if len(data) != n + 2:
        raise ValueError("expected exactly n product values")
    products = data[2:]
    if any(value < -1_000_000_000 or value > 1_000_000_000 for value in products):
        raise ValueError("product value outside the site-defined bounds")

    # The deque contains the strict suffix maxima of the active window.
    # Equal values discard the earlier index because the comparison is strict.
    queue = []
    head = 0
    total = 0
    for right, value in enumerate(products):
        left = right - k + 1
        while head < len(queue) and queue[head] < left:
            head += 1
        while len(queue) > head and products[queue[-1]] <= value:
            queue.pop()
        queue.append(right)
        if right >= k - 1:
            total += len(queue) - head
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def put(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def input_text(values: list[int], k: int) -> str:
    return f"{len(values)} {k}\n" + " ".join(map(str, values)) + "\n"


def direct_oracle(values: list[int], k: int) -> int:
    """Literal O(nk) reading of the definition; independent of the deque."""
    total = 0
    for left in range(len(values) - k + 1):
        end = left + k
        for i in range(left, end):
            if all(values[i] > values[j] for j in range(i + 1, end)):
                total += 1
    return total


def run(code: str, raw: str) -> str:
    scope: dict[str, object] = {"__name__": "candidate"}
    exec(compile(code, "<oa-amazon-114>", "exec"), scope)
    return str(scope["solve"](raw))


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    source_item = next(item for item in catalog["items"] if item["id"] == PID)
    assert (source_item["contentHash"], source_item["sourceUrl"], source_item["title"]) == (
        CONTENT_HASH, SOURCE_URL, "Compute Beauty of Array Products"
    )
    raw_source = subprocess.run(
        ["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    blob = subprocess.run(
        ["git", "hash-object", "--stdin"], cwd=ROOT, input=raw_source,
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    assert blob == RAW_BLOB
    assert "114. Compute Beauty of Array Products" in raw_source
    assert "for every index j such that i products[j]" in raw_source
    assert "products = [3, 6, 2, 9, 4, 1]" in raw_source
    reviews = json.loads((OA / "reviews/amazon-remaining-e.json").read_text())
    old = next(item for item in reviews["items"] if item["id"] == PID)
    assert old["status"] == "blocked" and old["reason"] == PREVIOUS_REASON

    bounds = (
        "本站补充：标准输入第一行 n k、第二行 n 个整数；"
        "1≤n≤200000、1≤k≤n、−10^9≤products[i]≤10^9。"
        "原始题源未保留这些范围或输入输出协议。"
    )

    specs: list[tuple[str, list[int], int, bool]] = [
        ("OAMaster 样例", [3, 6, 2, 9, 4, 1], 3, False),
        ("单元素窗口", [4, -2, 4, 0], 1, True),
        ("全数组严格递减", [9, 7, 5, 3, 1], 5, True),
        ("全数组严格递增", [1, 3, 5, 7, 9], 5, True),
        ("全相等只计窗口末项", [6, 6, 6, 6, 6], 3, True),
        ("重复峰值只计较右者", [8, 8, 3, 2], 4, True),
        ("窗口内重复值", [5, 3, 5, 4, 4, 1], 3, True),
        ("k=n 且含负值", [-1, -5, -3, -8], 4, True),
        ("k=1", [0, -1, 0, 1], 1, True),
        ("递增且 k=n", [1, 2, 3, 4, 5, 6], 6, True),
        ("严格递减滑窗", [12, 11, 10, 9, 8, 7], 3, True),
        ("严格递增滑窗", [2, 4, 6, 8, 10, 12], 4, True),
        ("平台后下降", [7, 7, 7, 3, 3, 1], 4, True),
        ("负数重复峰值", [-1, -4, -1, -2, -5], 3, True),
        ("数值边界", [1_000_000_000, -1_000_000_000, 0], 2, True),
        ("重复峰后下降", [10, 10, 9, 8, 7], 5, True),
        ("交错重复值", [2, 1, 2, 1, 2, 1], 2, True),
        ("负数严格递减", [-1, -2, -3, -4, -5], 2, True),
        ("负数严格递增", [-5, -4, -3, -2, -1], 2, True),
        ("峰值移出窗口", [10, 4, 3, 9, 2], 3, True),
        ("相等值不满足严格大于", [4, 2, 4, 3, 2], 4, True),
        ("窗口末位计入", [1, 5, 2], 3, True),
        ("不同窗口峰值", [2, 5, 1, 5, 0], 3, True),
        ("交错高低峰", [9, 1, 9, 1, 9, 1], 4, True),
        ("平台后新最大", [3, 3, 3, 4, 2], 4, True),
        ("零值平台", [0, 0, -1, 0, -2], 3, True),
        ("最短完整窗口", [3, 1, 2], 3, True),
        ("窗口数为二", [5, 4, 3, 2], 3, True),
        ("重复峰值反复过期", [4, 4, 1, 4, 4, 1, 4], 3, True),
        ("相等值再被更大值遮挡", [8, 8, 9, 8, 8], 5, True),
        ("连续产生新峰", [1, 7, 2, 8, 3, 9], 2, True),
        ("最小 n", [42], 1, True),
        ("交替负数与零", [-3, 0, -3, 0, -3, 0], 4, True),
        ("重复低值在峰值右侧", [6, 2, 2, 2, 1], 4, True),
        ("边界峰值重复", [1_000_000_000, 1_000_000_000, -1_000_000_000], 3, True),
    ]
    n_max, k_max = 200_000, 100_000
    specs.append(("最大 n 且答案溢出 32 位", list(range(n_max, 0, -1)), k_max, True))

    cases, formal_inputs, expected_values = [], [], []
    unique_formal: set[str] = set()
    for name, values, k, hidden in specs:
        raw = input_text(values, k)
        assert raw not in unique_formal, name
        unique_formal.add(raw)
        expected = (k * (len(values) - k + 1) if len(values) > 100
                    else direct_oracle(values, k))
        if name == "OAMaster 样例":
            assert expected == 8
        actual = run(REFERENCE, raw)
        assert actual == str(expected), (name, expected, actual)
        formal_inputs.append(raw)
        expected_values.append(expected)
        cases.append({
            "name": name, "input": raw, "expectedOutput": f"{expected}\n",
            "hidden": hidden, "weight": 1,
        })

    rng = random.Random(SEED)
    oracle_data = [([3, 6, 2, 9, 4, 1], 3)]
    oracle_keys = {input_text(*oracle_data[0])}
    while len(oracle_data) < 160:
        n = rng.randint(1, 24)
        k = rng.randint(1, n)
        values = [rng.randint(-12, 12) for _ in range(n)]
        raw = input_text(values, k)
        if raw not in oracle_keys:
            oracle_keys.add(raw)
            oracle_data.append((values, k))

    started = time.perf_counter()
    oracle_rows = []
    for values, k in oracle_data:
        expected = direct_oracle(values, k)
        raw = input_text(values, k)
        assert run(REFERENCE, raw) == str(expected), (raw, expected)
        oracle_rows.append({"input": raw, "expectedOutput": f"{expected}\n"})

    mutants = [
        {
            "name": "把严格大于误写为大于等于",
            "code": '''def solve(raw):
 a=list(map(int,raw.split())); n,k=a[:2]; x=a[2:]; q=[]; h=0; z=0
 for r,v in enumerate(x):
  left=r-k+1
  while h<len(q) and q[h]<left: h+=1
  while len(q)>h and x[q[-1]]<v: q.pop()
  q.append(r)
  if r>=k-1: z+=len(q)-h
 return str(z)
''',
        },
        {
            "name": "每个窗口只计一个最大值",
            "code": '''def solve(raw):
 a=list(map(int,raw.split())); n,k=a[:2]; return str(n-k+1)
''',
        },
    ]
    killed = []
    for mutant in mutants:
        rejected = [i for i, raw in enumerate(formal_inputs)
                    if run(mutant["code"], raw) != str(expected_values[i])]
        assert rejected, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejected})
    elapsed = round(time.perf_counter() - started, 3)

    editorial_text = (
        "## 正确性\n\n"
        "从左到右扫描，队列存当前窗口内的严格后缀最大值下标，按下标递增、值严格递减排列。"
        "新值 x 入队前，队尾所有值 `<= x` 的位置都不再可能大于其右侧所有值，应删除；"
        "过期的队首也删除。剩余位置恰好是窗口中满足对每个后续 j 都有 `products[i] > products[j]` 的下标，"
        "所以队列长度就是窗口 beauty。逐窗口累加即可。相等值要淘汰较早者，不能将严格大于改成大于等于。\n\n"
        "## 复杂度\n\nO(n) 时间、O(k) 队列空间；每个位置最多入队和出队一次。\n\n"
        "## 来源与边界\n\n"
        f"[OAMaster 原题快照]({SOURCE_URL}) 的关键比较式发生截断。已打开核对的 [Amazon OA 报告讨论帖]({REDDIT_URL}) "
        "解释为每个窗口内严格大于右侧所有元素的位置数；其样例输入、k、逐窗口贡献 `2,1,2,3` 与 OAMaster 总输出 8 一致。"
        "该帖为候选人报告和社区解释，并非 Amazon 官方题面。\n\n"
        f"{bounds}"
    )
    package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "固定长度窗口的严格后缀最大值计数",
            "difficulty": "中等", "tags": ["OA", "Amazon", "数组", "滑动窗口", "单调队列"],
            "description": (
                "对每个长度 k 的连续窗口，统计其中严格大于窗口内所有后续元素的位置数，"
                "再将所有窗口的统计值相加。窗口末位因没有后续元素而计入。\n\n" + bounds
            ),
            "input": "第一行 n k，第二行 n 个整数 products[i]。\n\n" + bounds,
            "output": "输出所有长度为 k 的窗口 beauty 总和。",
            "explanation": "正确性证明见配套讲义。",
            "hints": [
                "维护当前窗口的严格后缀最大值下标。",
                "新值会淘汰队尾所有不大于它的值；窗口末位也计入。",
                "相等值的处理必须保留严格比较。",
            ],
            "timeLimit": 2, "memoryLimit": 65536, "outputLimit": 4096,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    # Hash the canonical compact JSON used by the coverage verifier.
    package_checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    authored = [{"language": "python", "code": REFERENCE}]
    put(OA / f"packages/{PID}.json", package)
    (OA / f"references/{PID}.py").write_text(REFERENCE)
    put(OA / f"editorials/{PID}.json", {
        "schemaVersion": 1, "id": PID,
        "title": "滑动窗口中的严格后缀最大值",
        "explanation": editorial_text, "solutions": authored,
    })
    put(OA / f"oracles/{PID}.json", oracle_rows)
    put(OA / f"mutants/{PID}.json", mutants)
    put(OA / f"candidate-batches/{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "sourceContentHash": CONTENT_HASH,
            "packageChecksum": package_checksum,
            "editorial": editorial_text,
            "authoredSolutions": authored,
        }],
    })
    put(OA / f"source-evidence/{BATCH}.json", {
        "schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT,
        "origin": "https://oamaster.com",
        "items": {
            PID: {
                "url": SOURCE_URL, "contentHash": CONTENT_HASH,
                "catalogContentHash": CONTENT_HASH,
                "company": "Amazon", "title": "Compute Beauty of Array Products",
                "path": RAW_PATH, "gitBlobSha": RAW_BLOB,
                "blobVerification": "immutable source read via git show; git hash-object matched the blob SHA",
                "upstreamRuleStatus": "comparison clause is truncated after 'for every index j such that i products[j]'; sample and aggregate explanation remain",
                "corroboratingSource": {
                    "url": REDDIT_URL, "title": "Amazon OA question (candidate report and discussion)",
                    "verifiedOn": "2026-10-06",
                    "supports": "Opened page discussion defines each counted position as strictly greater than all later elements in the same window; same sample [3,6,2,9,4,1], k=3 has per-window counts 2,1,2,3 and total 8.",
                    "relationship": "same Amazon OA narrative/sample; secondary candidate report, not an official Amazon statement",
                },
                "recoveredRule": "For each window [l,r], count i such that products[i] > products[j] for every j with i<j<=r; empty suffix is true.",
                "siteAdded": "standard input protocol, 1<=n<=200000, 1<=k<=n and -1e9<=products[i]<=1e9; not retained in source snapshot",
            }
        },
    })
    put(OA / f"resolutions/{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID, "batch": BATCH, "sourceContentHash": CONTENT_HASH,
            "previousReason": PREVIOUS_REASON,
            "reason": (
                "Amazon OA 同题报告/社区解释与 OAMaster 固定样例相符：逐窗口 beauty=2,1,2,3，总和 8；"
                "规则恢复为严格大于右侧所有元素。本站 IO 和输入范围已明确标注。"
                "160 个唯一直接暴力 oracle、36 个正式用例和两个正常退出错误解本地检查通过；尚未做线上沙箱验证。"
            ),
        }],
    })
    put(OA / f"validation/{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{
            "id": PID, "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len(oracle_keys),
            "referenceFormalCases": len(cases),
            "publicCases": sum(not row["hidden"] for row in cases),
            "hiddenCases": sum(row["hidden"] for row in cases),
            "negativeControls": killed,
            "referenceSha256": sha(REFERENCE),
            "siteAddedBounds": {"nMax": 200_000, "kRange": "1..n", "values": "-1000000000..1000000000"},
            "maxFormalAnswer": max(expected_values),
            "oracleMethod": "direct O(nk) strict comparison to all later elements in each window",
            "localValidationOnly": True, "oracleElapsedSeconds": elapsed,
        }],
    })
    print(f"{PID}: {len(oracle_rows)} unique direct-oracle inputs passed")
    print(f"{PID}: {len(cases)} formal cases; {len(killed)} mutants killed")
    print(f"{PID}: max answer {max(expected_values)}; candidate files generated locally only")


if __name__ == "__main__":
    main()
