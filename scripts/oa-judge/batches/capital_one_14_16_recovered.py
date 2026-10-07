from __future__ import annotations

"""Build source-backed, locally validated candidates for Capital One #14/#16.

This generator only writes this batch's candidate artifacts. It never promotes
the problems to the runtime registry and does not contact a judge server.
"""

import hashlib
import json
import random
import subprocess
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
ITEMS = {item["id"]: item for item in CATALOG["items"]}
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_BLOB = "772a74d8b9eeed782c007b460d6e7652465e39a1"
SOURCE_FILE_SHA256 = "0ba5ef56625f6f86e98625430b25a7b6eac53d70d65a41d2c23a5d0a7ebf1626"
BATCH = "capital-one-14-16-recovered"
SEED = 20261007
PREVIOUS_REASONS = {
    "oa-capital-one-14": "原始题面自己声明 t 的语义有歧义（给定 t 检查一次，还是可以选择 t）；不擅自选择其中一种。",
    "oa-capital-one-16": "原始规则称系统内人数大于 10 时拒绝，但样例又称 12 人同时到达时前 11 人均服务；这两个规则给出不同容量。",
}


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def normalize(raw: dict) -> dict:
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify("
        "ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(
        ["node", "--import", "tsx", "-e", script], cwd=ROOT,
        input=json.dumps(raw, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    )
    return json.loads(proc.stdout)


def run(code: str, raw: str) -> str:
    proc = subprocess.run(
        [sys.executable, "-I", "-c", code], input=raw, text=True,
        capture_output=True, timeout=5, check=True,
    )
    return proc.stdout.rstrip("\n")


def canonical_hash(package: dict) -> str:
    return sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))


ROTATE_REFERENCE = '''import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        raise ValueError("expected n, array, and shift t")
    n = values[0]
    if not 1 <= n <= 200000 or len(values) != n + 2:
        raise ValueError("site input requires 1 <= n <= 200000 and n values plus t")
    nums, t = values[1:n + 1], values[-1]
    if not 0 <= t < n or any(not -(10**9) <= x <= 10**9 for x in nums):
        raise ValueError("input is outside the stated constraints")
    previous = nums[(n - t) % n]
    for i in range(1, n):
        current = nums[(i - t) % n]
        if previous <= current:
            return "false"
        previous = current
    return "true"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def rotate_encode(nums: tuple[int, ...] | list[int], t: int) -> str:
    return f"{len(nums)}\n{' '.join(map(str, nums))}\n{t}\n"


def rotate_oracle(nums: tuple[int, ...] | list[int], t: int) -> str:
    # Independent literal construction of the shifted array, then full scan.
    rotated = list(nums[-t:]) + list(nums[:-t]) if t else list(nums)
    return "true" if all(rotated[i] > rotated[i + 1]
                         for i in range(len(rotated) - 1)) else "false"


QUEUE_REFERENCE = '''import sys
from collections import deque

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        raise ValueError("expected n and arrival times")
    n, arrivals = data[0], data[1:]
    if not 1 <= n <= 200000 or len(arrivals) != n:
        raise ValueError("site input requires 1 <= n <= 200000 arrivals")
    if any(x < 0 or x > 10**9 for x in arrivals):
        raise ValueError("arrival time must be in [0, 10^9]")
    if any(arrivals[i] > arrivals[i + 1] for i in range(n - 1)):
        raise ValueError("arrival times must be non-decreasing")
    # A finish time equal to a's arrival has already left the system.
    active_finish_times = deque()
    result = []
    for arrival in arrivals:
        while active_finish_times and active_finish_times[0] <= arrival:
            active_finish_times.popleft()
        # Source rule says reject only when current occupancy is > 10;
        # therefore at most 11 people may be in the system after admission.
        if len(active_finish_times) > 10:
            result.append("null")
            continue
        start = max(arrival, active_finish_times[-1] if active_finish_times else arrival)
        result.append(str(start))
        active_finish_times.append(start + 30)
    return " ".join(result)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def queue_encode(arrivals: tuple[int, ...] | list[int]) -> str:
    return f"{len(arrivals)}\n{' '.join(map(str, arrivals))}\n"


def queue_oracle(arrivals: tuple[int, ...] | list[int]) -> str:
    # This sparse boundary has no overlap: the first service completes at 30,
    # long before the second arrival. Avoid a billion idle simulation ticks.
    if tuple(arrivals) == (0, 1000000000):
        return "0 1000000000"
    assert len(arrivals) <= 1000 and max(arrivals, default=0) <= 10000, \
        "second-by-second oracle is only for bounded small-domain inputs"
    # Independent second-by-second event simulation. Service completion and
    # promotion happen before arrivals at the same timestamp.
    arrivals_at: dict[int, list[int]] = {}
    for index, arrival in enumerate(arrivals):
        arrivals_at.setdefault(arrival, []).append(index)
    answer: list[str | None] = [None] * len(arrivals)
    waiting: deque[int] = deque()
    serving: int | None = None
    finish_at: int | None = None
    final_event = max(arrivals, default=-1) + 30 * len(arrivals) + 1
    for now in range(final_event):
        if serving is not None and finish_at == now:
            serving, finish_at = None, None
        if serving is None and waiting:
            serving = waiting.popleft()
            answer[serving] = str(now)
            finish_at = now + 30
        for person in arrivals_at.get(now, []):
            occupancy = len(waiting) + (serving is not None)
            if occupancy > 10:
                answer[person] = "null"
            elif serving is None:
                serving = person
                answer[person] = str(now)
                finish_at = now + 30
            else:
                waiting.append(person)
    return " ".join(value if value is not None else "null" for value in answer)


def make_rotate_cases() -> list[tuple[tuple[int, ...], int]]:
    rng = random.Random(SEED)
    fixed = [
        ((3, 2, 1), 0), ((1, 3, 2), 1), ((2, 1, 3), 2),
        ((4, 3, 2, 1), 1), ((2, 1), 1), ((5,), 0), ((7,), 0),
        ((1, 1, 0), 0), ((-3, -4, -5), 0),
        ((3, 2, 1), 1), ((8, 7, 6, 5), 3),
        ((0, -1, -2), 2), ((10, 9, 8, 7, 6), 4),
    ]
    seen = set(fixed)
    result = fixed[:]
    while len(result) < 150:
        n = rng.randint(1, 9)
        nums = tuple(rng.randint(-4, 4) for _ in range(n))
        t = rng.randrange(n)
        key = (nums, t)
        if key not in seen:
            seen.add(key)
            result.append(key)
    return result


def make_queue_cases() -> list[tuple[int, ...]]:
    rng = random.Random(SEED + 1)
    fixed = [
        (0, 0, 0), (0, 10, 20), (0, 100), (0, 15, 15, 16),
        tuple([0] * 11), tuple([0] * 12),
        (0, 30), (0, 29), (0, 30, 30),
        tuple([0] * 11 + [30]), tuple([0] * 11 + [30] * 11),
        (0, 1, 2, 29, 30, 31, 60), (0, 0, 29, 30, 30, 31),
        (5,), (0, 1000000000),
    ]
    seen = set(fixed)
    result = fixed[:]
    while len(result) < 150:
        n = rng.randint(1, 18)
        # Discrete times create many same-time arrivals and exact 30s boundaries.
        arrivals = tuple(sorted(rng.choice((0, 1, 15, 29, 30, 31, 59, 60, 90, 120))
                                for _ in range(n)))
        if arrivals not in seen:
            seen.add(arrivals)
            result.append(arrivals)
    return result


def case(name: str, raw: str, expected: str, hidden: bool) -> dict:
    return {"name": name, "input": raw, "expectedOutput": expected + "\n",
            "hidden": hidden, "weight": 1}


def build_problem(pid: str, title: str, tags: list[str], description: str,
                  input_desc: str, output_desc: str, reference: str,
                  oracle_rows: list[dict], formal_raw: list[str],
                  mutants: list[tuple[str, str]], editorial: str) -> tuple[dict, dict, dict]:
    item = ITEMS[pid]
    expected_by_input = {
        row["input"]: row["expectedOutput"].rstrip("\n") for row in oracle_rows
    }
    formal_expected = [expected_by_input[raw] for raw in formal_raw]
    for raw, expected in zip(formal_raw, formal_expected):
        assert run(reference, raw) == expected, (pid, "formal reference mismatch", raw[:200])
    cases = [case(f"公开样例 {i + 1}" if i < 3 else f"边界测试 {i}", raw,
                  expected, i >= 3)
             for i, (raw, expected) in enumerate(zip(formal_raw, formal_expected))]
    controls = []
    mutant_payload = []
    for name, bad_code in mutants:
        rejected = []
        for index, (raw, expected) in enumerate(zip(formal_raw, formal_expected)):
            actual = run(bad_code, raw)
            if actual != expected:
                rejected.append(index)
        assert rejected, f"mutant survived: {pid}: {name}"
        mutant_payload.append({"name": name, "code": bad_code})
        controls.append({"name": name, "rejectedByCases": rejected})

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": pid, "courseId": "gomall", "lessonId": "00-overview",
            "title": title, "difficulty": "中等",
            "tags": ["OA", "Capital One", *tags],
            "description": description,
            "input": input_desc, "output": output_desc,
            "explanation": "完整思路、正确性证明与复杂度见配套题解。",
            "hints": ["按题面给定的顺序模拟，并注意相等边界。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 8192,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    package = normalize(raw_package)
    return package, mutant_payload, {
        "id": pid,
        "oracleCases": len(oracle_rows),
        "uniqueOracleInputs": len({row["input"] for row in oracle_rows}),
        "formalCases": len(cases),
        "publicCases": sum(not test["hidden"] for test in cases),
        "hiddenCases": sum(test["hidden"] for test in cases),
        "referenceSha256": sha(reference),
        "negativeControls": controls,
    }


def main() -> None:
    assert CATALOG["source"]["commit"] == COMMIT
    raw_source = subprocess.run(["git", "cat-file", "-p", SOURCE_BLOB], cwd=ROOT,
                                text=True, capture_output=True, check=True).stdout
    assert sha(raw_source) == SOURCE_FILE_SHA256
    assert "assumes t is given and you check the result after one shift" in raw_source
    assert "12 people arrive at time 0 → first 11 served, 12th leaves" in raw_source
    assert "arrivalTimes is non-decreasing; ties are enqueued in input order" in raw_source
    assert ITEMS["oa-capital-one-14"]["contentHash"] == "cde232d40384b50f2ae736ba4ffd40cd892f2386a29e25d3ac8fc7b32ab34586"
    assert ITEMS["oa-capital-one-16"]["contentHash"] == "12cd52cc18f6280d1307f1b6c323569c86b0343f3df6bd5c69c9ee4654df7708"

    # Small-domain test inputs each have an independently computed literal oracle.
    rotate_values = make_rotate_cases()
    rotate_rows = []
    for nums, t in rotate_values:
        raw = rotate_encode(nums, t)
        expected = rotate_oracle(nums, t)
        assert run(ROTATE_REFERENCE, raw) == expected
        rotate_rows.append({"input": raw, "expectedOutput": expected + "\n"})
    assert len(rotate_rows) >= 120

    queue_values = make_queue_cases()
    queue_rows = []
    for arrivals in queue_values:
        raw = queue_encode(arrivals)
        expected = queue_oracle(arrivals)
        assert run(QUEUE_REFERENCE, raw) == expected
        queue_rows.append({"input": raw, "expectedOutput": expected + "\n"})
    assert len(queue_rows) >= 120

    # Formal sample/boundary cases include n=1, t endpoints, duplicates,
    # capacity 11/12, exact completion at 30s, simultaneous arrival order.
    rotate_formal = [rotate_encode(*item) for item in [
        ((3, 2, 1), 0), ((1, 3, 2), 1), ((2, 1, 3), 2),
        ((4, 3, 2, 1), 1), ((2, 1), 1), ((7,), 0),
        ((1, 1, 0), 0), ((3, 2, 1), 1), ((8, 7, 6, 5), 3),
        ((-3, -4, -5), 0), ((0, -1, -2), 2), ((10, 9, 8, 7, 6), 4),
        ((2, 2), 0), ((-1, -2, -3, -4), 0), ((4, 1, 3, 2), 1),
        ((1, 4, 3, 2), 1), ((6, 5, 4, 3, 2, 1), 5),
        ((0, -1, -2, -3), 3), ((9, 8, 7, 6, 5), 2),
        ((-4, -5, -6, -7), 1), ((3, 1, 2), 2),
        ((100, 0, -1, -2), 3), ((5, 4, 3, 2, 1), 4),
        ((8, 6, 7, 5), 1), ((2, 1, 0, -1), 0),
    ]]
    max_n = 200000
    descending_target = list(range(max_n, 0, -1))
    rotate_true_max = descending_target[1:] + descending_target[:1]
    broken_target = descending_target[:]
    broken_target[-1] = broken_target[-2]
    rotate_broken_max = broken_target[1:] + broken_target[:1]
    rotate_formal.extend([
        rotate_encode(rotate_true_max, 1),
        rotate_encode(rotate_broken_max, 1),
    ])
    queue_formal = [queue_encode(arrivals) for arrivals in [
        (0, 0, 0), (0, 10, 20), (0, 100), (0, 15, 15, 16),
        tuple([0] * 11), tuple([0] * 12), (0, 30), (0, 29),
        (0, 30, 30), tuple([0] * 11 + [30]),
        tuple([0] * 11 + [30] * 11), (0, 1, 2, 29, 30, 31, 60),
        (0, 0, 29, 30, 30, 31), (5,), (0, 1000000000),
        (0, 30, 60, 90, 120), (1, 31, 61, 91),
        (0, 0, 0, 30, 30, 60, 60), tuple(range(0, 301, 30)),
        (0, 29, 58, 87, 116, 145), (10, 10, 40, 70, 100),
        (0, 1, 30, 31, 60, 61), tuple([30] * 12),
        tuple([0] * 12 + [30] * 12),
        (0, 30), (0, 29), (0, 30, 30), tuple([0] * 11),
        tuple([0] * 12), tuple([0] * 11 + [30]),
        tuple([0] * 11 + [30] * 11), (0, 1, 2, 29, 30, 31, 60),
        (0, 15, 15, 16), tuple([0] * 11 + [29]),
        tuple([0] * 10 + [30] * 3),
        tuple([0] * 10 + [30] * 2 + [31]),
        (0, 0, 29, 30, 30, 31), (0, 1000000000),
    ]]
    queue_formal.extend([
        queue_encode([0] * max_n),
        queue_encode(list(range(0, max_n * 30, 30))),
    ])
    # Ensure all formal test answers derive from the independent oracle.
    rotate_by_input = {row["input"]: row["expectedOutput"].rstrip("\n") for row in rotate_rows}
    queue_by_input = {row["input"]: row["expectedOutput"].rstrip("\n") for row in queue_rows}
    # Add explicitly specified larger cases to oracle data using the independent
    # reference-independent algorithms, then require >=24 hidden package cases.
    for raw in rotate_formal:
        if raw not in rotate_by_input:
            tokens = list(map(int, raw.split()))
            n, nums, t = tokens[0], tokens[1:-1], tokens[-1]
            assert len(nums) == n
            rotate_by_input[raw] = rotate_oracle(nums, t)
            rotate_rows.append({"input": raw,
                                "expectedOutput": rotate_by_input[raw] + "\n"})
    for raw in queue_formal:
        if raw not in queue_by_input:
            tokens = list(map(int, raw.split()))
            n, arrivals = tokens[0], tokens[1:]
            assert len(arrivals) == n
            # These structured maximum-size boundaries have direct mathematical
            # answers independent of the reference's finish-time queue.
            if n > 1000:
                if all(arrival == 0 for arrival in arrivals):
                    expected = [str(30 * i) if i < 11 else "null"
                                for i in range(n)]
                else:
                    assert all(arrival == 30 * i
                               for i, arrival in enumerate(arrivals)), \
                        "add an independent formula for any new large boundary"
                    expected = [str(arrival) for arrival in arrivals]
                queue_by_input[raw] = " ".join(expected)
            else:
                queue_by_input[raw] = queue_oracle(arrivals)
            queue_rows.append({"input": raw,
                               "expectedOutput": queue_by_input[raw] + "\n"})
    assert all(raw in rotate_by_input for raw in rotate_formal)
    assert all(raw in queue_by_input for raw in queue_formal)
    assert len(rotate_formal) >= 27 and len(queue_formal) >= 27

    rotate_mutants = [
        ("把右旋误作左旋", ROTATE_REFERENCE
         .replace("nums[(n - t) % n]", "nums[t % n]")
         .replace("nums[(i - t) % n]", "nums[(i + t) % n]")),
        ("允许相邻元素相等而非严格递减", ROTATE_REFERENCE.replace("previous <= current", "previous < current")),
    ]
    queue_mutants = [
        ("把容量上限误设为 10 人", QUEUE_REFERENCE.replace("len(active_finish_times) > 10", "len(active_finish_times) >= 10")),
        ("恰好在服务完成时仍视为占用", QUEUE_REFERENCE.replace("active_finish_times[0] <= arrival", "active_finish_times[0] < arrival")),
    ]
    rotate_editorial = """## 思路

题目给定本次右旋位数 t，不需要选择 t。旋转后第 i 个元素等于原数组下标 `(i-t) mod n` 的元素。按旋转后的顺序扫描相邻元素，只要存在 `a[i] <= a[i+1]` 就不是严格递减。

## 正确性证明

模下标公式恰好把末尾 t 个元素移到数组前端，并保持其余元素相对次序，因此扫描检查的正是旋转后全部 n−1 对相邻元素。严格递减当且仅当每对都满足前者大于后者。

## 复杂度

扫描阶段额外空间 O(1)；读取并保存输入数组需 O(n) 空间。总时间 O(n)。

## 输入约定

原站函数参数为完整输入文本；本站将其整理为 stdin/stdout：n、n 个整数、t。本站采用来源给出的建议范围 `1≤n≤200000`、`0≤t<n` 和 `|nums[i]|≤10^9`。"""
    queue_editorial = """## 思路

按非递减到达时间逐人模拟。维护系统中尚未完成服务的完成时刻队列；到达时先移除所有 `finish≤arrival` 的人，因为在该时刻已经完成并离开。若剩余人数大于 10，则当前人立即离开并输出 null；否则接纳，服务开始于到达时刻与队尾完成时刻的较大值，服务结束时刻为开始时间加 30。

题面规则是“当前人数大于 10 时拒绝”，所以人数恰为 10 时仍接纳；系统接纳后的最大人数为 11。这也与同刻 12 人时前 11 人接收、第 12 人拒绝的样例一致。同刻到达按输入顺序处理。

## 正确性证明

完成时刻队列按服务顺序递增。移除所有不晚于当前到达的完成事件后，它恰好包含此刻仍在服务或等待的人。根据题定阈值判断拒绝/接纳，因此不会漏掉已离开者或错收超限者。接纳时从到达时刻或最后一位完成时刻开始服务，正好满足单服务台 FCFS 规则。

## 复杂度

每个人最多入队和出队一次，时间 O(n)，额外空间 O(n)。

## 输入约定

本站使用 n 加 n 个到达时刻的 stdin/stdout 格式，并采用来源给出的建议范围 `1≤n≤200000`、`0≤arrival[i]≤10^9`，保留原题非递减及同刻输入顺序要求。"""

    rotate_package, rotate_mutant_payload, rotate_validation = build_problem(
        "oa-capital-one-14", "Cyclic Shift to Strictly Descending Array",
        ["数组", "模拟"],
        "给定整数数组 nums 和本次右旋位数 t。将最后 t 个元素移到数组前面一次，判断结果是否严格递减。t 是输入给定的值，不需要选择。",
        "第一行 n（本站采用来源建议范围 1≤n≤200000），第二行 n 个整数 nums[i]（本站采用来源建议范围 |nums[i]|≤10^9），第三行 t（本站采用来源建议范围 0≤t<n）。",
        "输出 true 或 false。", ROTATE_REFERENCE, rotate_rows, rotate_formal,
        rotate_mutants, rotate_editorial,
    )
    queue_package, queue_mutant_payload, queue_validation = build_problem(
        "oa-capital-one-16", "Queue Check-in Simulation with Capacity Limit",
        ["队列", "模拟"],
        "单服务台按先到先服务，每人办理 30 秒。到达时，若系统内人数当前大于 10，则此人立即离开；否则接纳并输出其服务开始时刻。未被接纳者输出 null。",
        "第一行 n（本站采用来源建议范围 1≤n≤200000），第二行 n 个非递减到达时刻 arrival[i]（本站采用来源建议范围 0≤arrival[i]≤10^9）。相同时间按输入顺序入队。",
        "按输入顺序输出每人的服务开始时刻或 null，以空格分隔。题面规则意味着系统最大接纳人数为 11；在恰好完成的时刻，已完成者先离开。",
        QUEUE_REFERENCE, queue_rows, queue_formal, queue_mutants, queue_editorial,
    )
    for package in (rotate_package, queue_package):
        assert sum(test["hidden"] for test in package["cases"]) >= 24

    specs = [
        ("oa-capital-one-14", rotate_package, ROTATE_REFERENCE, rotate_rows,
         rotate_mutant_payload, rotate_validation, rotate_editorial),
        ("oa-capital-one-16", queue_package, QUEUE_REFERENCE, queue_rows,
         queue_mutant_payload, queue_validation, queue_editorial),
    ]
    entries, validations = [], []
    evidence_items = {}
    for pid, package, reference, oracle_rows, mutants, validation, editorial in specs:
        item = ITEMS[pid]
        package_checksum = canonical_hash(package)
        put(OA / "packages" / f"{pid}.json", package)
        (OA / "references" / f"{pid}.py").write_text(reference)
        put(OA / "oracles" / f"{pid}.json", oracle_rows)
        put(OA / "mutants" / f"{pid}.json", mutants)
        for index, mutant in enumerate(mutants, 1):
            (OA / "negative-controls" / f"{pid}-{index}.py").write_text(
                "# " + mutant["name"] + "\n" + mutant["code"]
            )
        put(OA / "editorials" / f"{pid}.json", {
            "schemaVersion": 1, "id": pid, "title": package["problem"]["title"],
            "explanation": editorial,
            "solutions": [{"language": "python", "code": reference}],
            "sourceUrl": item["sourceUrl"],
            "sourceContentHash": item["contentHash"], "author": "CSWork",
        })
        entries.append({
            "id": pid, "sourceContentHash": item["contentHash"],
            "packageChecksum": package_checksum, "editorial": editorial,
            "authoredSolutions": [{"language": "python", "code": reference}],
        })
        validations.append(validation)
        evidence_items[pid] = {
            "sourceCommit": COMMIT,
            "rawPath": "web/content/docs/companies/capital-one.mdx",
            "rawGitBlob": SOURCE_BLOB,
            "sourceFileSha256": SOURCE_FILE_SHA256,
            "catalogContentHash": item["contentHash"],
            "sourceUrl": item["sourceUrl"],
            "decision": "authored_pending_sandbox",
            "resolution": {
                "batch": BATCH,
                "previousReason": PREVIOUS_REASONS[pid],
                "reason": (
                    "同一固定版本原题的完整描述明确说 t 是给定值并检查一次右旋结果；保留这一句及其样例，采用 O(n) 相邻比较，不再把可选择 t 当作候选语义。"
                    if pid.endswith("-14") else
                    "固定源同时写明当前系统人数大于 10 才拒绝，并给出同刻 12 人时前 11 人接收、第 12 人拒绝；两者共同确定接纳阈值为当前人数≤10（接纳后最多11人）。按源题非递减到达与同刻输入顺序处理，完成时刻先离开。"
                ),
            },
        }

    manifest = {"schemaVersion": 1, "items": entries}
    # Preserve an already-promoted manifest's location, but never promote based
    # on a report merely existing: promotion needs separate evidence checks.
    batch_path = OA / "batches" / f"{BATCH}.json"
    if batch_path.exists():
        put(batch_path, manifest)
    else:
        put(OA / "candidate-batches" / f"{BATCH}.json", manifest)
    put(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED, "problems": validations,
        "note": "独立小域 oracle 和本地正式用例验证；未连接、也未运行 GoJudge，候选仍待远端沙箱。",
    })
    put(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master",
        "commit": COMMIT, "rawPath": "web/content/docs/companies/capital-one.mdx",
        "rawGitBlob": SOURCE_BLOB, "sourceFileSha256": SOURCE_FILE_SHA256,
        "items": evidence_items,
    })
    put(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": pid, "batch": BATCH,
            "sourceContentHash": ITEMS[pid]["contentHash"],
            "previousReason": PREVIOUS_REASONS[pid],
            "reason": evidence_items[pid]["resolution"]["reason"],
        } for pid in ITEMS if pid in evidence_items],
    })
    print(json.dumps({"batch": BATCH, "problems": validations},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
