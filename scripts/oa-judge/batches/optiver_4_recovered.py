#!/usr/bin/env python3
"""Generate an isolated offline candidate for Optiver #4 only."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
REVIEW = ROOT / "content" / "oa-judge" / "reviews" / "trading-platform-candidates.json"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/optiver.mdx"
RAW_BLOB = "e3a8b5c9234fe60dc8045f19a5f74e3cbe0292fe"
RAW_SHA256 = "61a4bfa9ec4574136c2ff4620d9bc4578b78a54a0413bd5f6b381685a67191fe"
CONTENT_HASH = "fd993dfcbdc2c2e675db0da837ce0284e7f6effce7e725cf11a92d6527eac98d"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw: dict) -> str:
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT,
                          input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout


REFERENCE = r'''from array import array
import sys

MASK = (1 << 64) - 1

class LogIndex:
    def __init__(self):
        self.timestamps = array("q", [0])
        self.log_ids = array("q", [0])
        self.sequences = array("q", [0])
        self.priorities = array("Q", [MASK])
        self.left = array("i", [0])
        self.right = array("i", [0])
        self.sizes = array("i", [0])
        self.root = 0
        self.maximum_timestamp = None
        self.sequence = 0

    def _size(self, node):
        return self.sizes[node] if node else 0

    def _pull(self, node):
        self.sizes[node] = 1 + self._size(self.left[node]) + self._size(self.right[node])

    def _priority(self, value):
        # SplitMix64 gives deterministic, well-distributed treap priorities.
        z = (value + 0x9E3779B97F4A7C15) & MASK
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK
        return z ^ (z >> 31)

    def _rotate_right(self, node):
        child = self.left[node]
        self.left[node] = self.right[child]
        self.right[child] = node
        self._pull(node)
        self._pull(child)
        return child

    def _rotate_left(self, node):
        child = self.right[node]
        self.right[node] = self.left[child]
        self.left[child] = node
        self._pull(node)
        self._pull(child)
        return child

    def _key_less(self, a, b):
        return (self.timestamps[a], self.sequences[a]) < (self.timestamps[b], self.sequences[b])

    def _insert(self, root, node):
        if not root:
            return node
        if self._key_less(node, root):
            self.left[root] = self._insert(self.left[root], node)
            if self.priorities[self.left[root]] < self.priorities[root]:
                root = self._rotate_right(root)
        else:
            self.right[root] = self._insert(self.right[root], node)
            if self.priorities[self.right[root]] < self.priorities[root]:
                root = self._rotate_left(root)
        self._pull(root)
        return root

    def add(self, log_id, timestamp):
        self.sequence += 1
        seq = self.sequence
        self.timestamps.append(timestamp)
        self.log_ids.append(log_id)
        self.sequences.append(seq)
        self.priorities.append(self._priority(seq))
        self.left.append(0)
        self.right.append(0)
        self.sizes.append(1)
        self.root = self._insert(self.root, seq)
        if self.maximum_timestamp is None or timestamp > self.maximum_timestamp:
            self.maximum_timestamp = timestamp

    def _rank_less(self, timestamp, sequence):
        """Number of keys strictly less than (timestamp, sequence)."""
        node = self.root
        count = 0
        while node:
            if (self.timestamps[node], self.sequences[node]) < (timestamp, sequence):
                count += self._size(self.left[node]) + 1
                node = self.right[node]
            else:
                node = self.left[node]
        return count

    def _collect(self, node, first, last, base, result):
        if not node or first >= last:
            return
        left_size = self._size(self.left[node])
        position = base + left_size
        if first < position:
            self._collect(self.left[node], first, min(last, position), base, result)
        if first <= position < last:
            result.append(node)
        if last > position + 1:
            self._collect(self.right[node], max(first, position + 1), last, position + 1, result)

    def window_bounds(self):
        if self.maximum_timestamp is None:
            return 0, 0
        cutoff = self.maximum_timestamp - 3600
        left = self._rank_less(cutoff + 1, 0)  # exclude timestamps <= cutoff
        right = self._rank_less(self.maximum_timestamp + 1, 0)
        return left, right

    def get_logs(self, limit):
        left, right = self.window_bounds()
        first = max(left, right - limit)
        selected = []
        self._collect(self.root, first, right, 0, selected)
        return ",".join(str(self.log_ids[node]) for node in selected)

    def get_count(self):
        left, right = self.window_bounds()
        return right - left

def solve_stream(stream, output):
    first = stream.readline().split()
    if len(first) != 2:
        raise ValueError("expected m q header")
    limit, operation_count = map(int, first)
    if not 1 <= limit <= 1000 or not 1 <= operation_count <= 1000000:
        raise ValueError("header outside stated constraints")
    index = LogIndex()
    for _ in range(operation_count):
        parts = stream.readline().split()
        if not parts:
            raise ValueError("missing operation")
        if parts[0] == b"RECORD" and len(parts) == 3:
            log_id, timestamp = map(int, parts[1:])
            if not -1000000000 <= log_id <= 1000000000 or not -1000000000000 <= timestamp <= 1000000000000:
                raise ValueError("value outside site input supplement")
            index.add(log_id, timestamp)
        elif parts[0] == b"GET_LOGS" and len(parts) == 1:
            output.write(index.get_logs(limit) + "\n")
        elif parts[0] == b"COUNT" and len(parts) == 1:
            output.write(str(index.get_count()) + "\n")
        else:
            raise ValueError("invalid operation")

if __name__ == "__main__":
    solve_stream(sys.stdin.buffer, sys.stdout)
'''


def encode(limit: int, operations: list[str]) -> str:
    return f"{limit} {len(operations)}\n" + "\n".join(operations) + "\n"


def run(code: str, raw: str, timeout: int = 15) -> str:
    with tempfile.TemporaryDirectory(prefix="optiver4-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw.encode("ascii"),
                              capture_output=True, timeout=timeout, check=True)
        return proc.stdout.decode("ascii")


def oracle(limit: int, operations: list[str]) -> str:
    logs: list[tuple[int, int, int]] = []
    maximum = None
    sequence = 0
    outputs = []
    for operation in operations:
        parts = operation.split()
        if parts[0] == "RECORD":
            log_id, timestamp = map(int, parts[1:])
            sequence += 1
            logs.append((timestamp, sequence, log_id))
            maximum = timestamp if maximum is None else max(maximum, timestamp)
        elif parts[0] == "GET_LOGS":
            if maximum is None:
                outputs.append("")
                continue
            in_window = sorted(item for item in logs if maximum - 3600 < item[0] <= maximum)
            outputs.append(",".join(str(item[2]) for item in in_window[-limit:]))
        else:
            if maximum is None:
                outputs.append("0")
            else:
                outputs.append(str(sum(maximum - 3600 < item[0] <= maximum for item in logs)))
    return "".join(value + "\n" for value in outputs)


def build(catalog: dict, rng: random.Random) -> None:
    identifier, batch = "oa-optiver-4", "optiver-4-recovered"
    source = next(item for item in catalog["items"] if item["id"] == identifier)
    assert source["contentHash"] == CONTENT_HASH
    formal = [
        (100, ["RECORD 1 0", "RECORD 2 300", "GET_LOGS", "COUNT", "RECORD 3 1200",
               "RECORD 1 1800", "GET_LOGS", "COUNT", "RECORD 4 3900", "GET_LOGS"], "来源样例"),
        (5, ["GET_LOGS", "COUNT", "RECORD 7 100", "GET_LOGS", "COUNT"], "空库查询"),
        (5, ["RECORD 1 0", "RECORD 2 3600", "GET_LOGS", "COUNT"], "严格排除恰好一小时前"),
        (1, ["RECORD 10 10000", "RECORD 20 7000", "GET_LOGS", "COUNT"], "乱序写入仍以最大时间戳为窗口锚点"),
        (2, ["RECORD 1 5", "RECORD 2 5", "RECORD 3 5", "GET_LOGS", "COUNT"], "同时间戳按接收先后排序并截取最近 m 条"),
        (2, ["RECORD 1 0", "RECORD 2 100", "RECORD 3 200", "COUNT", "GET_LOGS"], "返回数受 m 限制而计数不受限"),
        (3, ["RECORD -1 -4000", "RECORD 0 -3999", "RECORD 1 -100", "GET_LOGS", "COUNT"], "负时间戳与窗口边界"),
        (10, ["RECORD 1 100", "RECORD 2 200", "GET_LOGS", "COUNT", "RECORD 3 300", "GET_LOGS"], "递增时间戳全部处于窗口"),
        (10, ["RECORD 1 100", "RECORD 2 3700", "COUNT", "GET_LOGS"], "恰好一小时边界之前的记录被排除"),
        (10, ["RECORD 1 100", "RECORD 2 3701", "COUNT", "GET_LOGS"], "一小时边界内一秒的记录保留"),
        (10, ["RECORD 5 1000", "RECORD 5 1100", "COUNT", "GET_LOGS"], "重复 logId 保留为两条日志"),
        (2, ["RECORD 1 1", "RECORD 2 2", "RECORD 3 3", "RECORD 4 4", "COUNT", "GET_LOGS"], "只限制返回条数不限制窗口计数"),
        (3, ["RECORD 1 100", "RECORD 2 100", "RECORD 3 100", "GET_LOGS"], "同一时间戳按接收顺序稳定排序"),
        (1, ["RECORD 1 100", "RECORD 2 200", "RECORD 3 150", "GET_LOGS", "COUNT"], "乱序写入不改变最大时间锚点"),
        (5, ["RECORD 1 0", "RECORD 2 7201", "RECORD 3 3601", "COUNT", "GET_LOGS"], "旧记录整体过期但中间时间仍有效"),
        (4, ["COUNT", "GET_LOGS", "RECORD 8 99", "COUNT", "GET_LOGS"], "多次空查询后首次写入"),
        (2, ["RECORD -1 -10", "RECORD 0 -9", "RECORD 1 -8", "GET_LOGS", "COUNT"], "负时间戳上的窗口查询"),
        (3, ["RECORD 1 0", "RECORD 2 3599", "RECORD 3 3600", "COUNT", "GET_LOGS"], "窗口端点相邻秒验证"),
        (10, ["RECORD 1 5000", "RECORD 2 4000", "RECORD 3 3000", "GET_LOGS", "COUNT"], "全乱序输入仍按时间戳输出"),
        (3, ["RECORD 1 20", "RECORD 2 10", "RECORD 3 20", "RECORD 4 10", "GET_LOGS"], "两个时间戳各自稳定排序"),
        (1, ["RECORD 1 100", "RECORD 2 200", "RECORD 3 300", "RECORD 4 400", "GET_LOGS", "COUNT"], "返回最新一条但完整计数"),
    ]
    cases = []
    for i, (limit, operations, name) in enumerate(formal):
        raw = encode(limit, operations)
        expected = oracle(limit, operations)
        assert run(REFERENCE, raw) == expected
        cases.append({"name": name, "input": raw, "expectedOutput": expected,
                      "hidden": i != 0, "weight": 1})

    random_cases = []
    seen = {case["input"] for case in cases}
    for _ in range(120):
        while True:
            limit = rng.randint(1, 8)
            operations = []
            next_id = 1
            clock = rng.randint(-5000, 5000)
            for _ in range(rng.randint(8, 35)):
                action = rng.choices(["RECORD", "GET_LOGS", "COUNT"], [6, 2, 2])[0]
                if action == "RECORD":
                    clock += rng.randint(-5000, 5000)
                    operations.append(f"RECORD {next_id} {clock}")
                    next_id += 1
                else:
                    operations.append(action)
            raw = encode(limit, operations)
            if raw not in seen:
                break
        seen.add(raw)
        expected = oracle(limit, operations)
        assert run(REFERENCE, raw) == expected
        random_cases.append({"input": raw, "expectedOutput": expected})

    mutants = [
        ("把最后写入的时间戳当作窗口锚点", REFERENCE.replace(
            "if self.maximum_timestamp is None or timestamp > self.maximum_timestamp:",
            "if True:")),
        ("错误纳入恰好 3600 秒前的日志", REFERENCE.replace(
            "self._rank_less(cutoff + 1, 0)", "self._rank_less(cutoff, 0)")),
    ]
    controls = []
    for name, code in mutants:
        rejected = []
        for i, (limit, operations, _) in enumerate(formal):
            if run(code, encode(limit, operations)) != oracle(limit, operations):
                rejected.append(i)
        assert rejected, f"surviving mutant: {name}"
        controls.append({"name": name, "rejectedByCases": rejected})

    # Large online stream: out-of-order keys, duplicate timestamps and many
    # count/read queries. Keeping m small bounds output while testing updates.
    stress_ops = []
    for i in range(100000):
        stress_ops.append(f"RECORD {i} {(i * 7919) % 1000003}")
        if i % 100 == 99:
            stress_ops.extend(["COUNT", "GET_LOGS"])
    stress_input = encode(10, stress_ops)
    stress_expected = oracle(10, stress_ops)
    assert run(REFERENCE, stress_input, timeout=45) == stress_expected

    problem = {
        "id": identifier, "courseId": "gomall", "lessonId": "00-overview",
        "title": "Record Log", "difficulty": "中等",
        "tags": ["OA", "Optiver", "数据结构", "有序集合", "滑动窗口"],
        "description": "实现日志记录器。每条日志包含整数 logId、timestamp 和接收顺序；日志可能乱序到达且 logId 可重复。窗口锚点取已记录日志中的最大 timestamp。窗口为严格早于锚点 3600 秒之前的日志不计入，即只统计 `timestamp > 最大时间戳 - 3600` 的记录。GET_LOGS 按 timestamp 升序、同时间按接收顺序升序排列，返回窗口内最新的至多 m 个 logId；getLogCount 返回窗口内全部日志数。",
        "input": "首行输入 m 和 q。随后 q 行操作：`RECORD logId timestamp`、`GET_LOGS` 或 `COUNT`。每次查询各输出一行：GET_LOGS 输出逗号分隔的 logId（没有符合项时为空行），COUNT 输出窗口内记录数。本站补充限制：1≤m≤1000，1≤q≤1000000，|logId|≤10^9，|timestamp|≤10^12，所有查询输出合计不超过 65536 字节。窗口锚点和同时间戳规则按固定源实现明确。",
        "output": "按输入顺序为每条 GET_LOGS/COUNT 查询输出一行结果；RECORD 不产生输出。",
        "explanation": "固定源参考解将 maximum timestamp 作为锚点，使用严格大于 timestamp−3600 的窗口，并以接收顺序打破时间戳平局。本站仅补充命令行输入输出及数值边界。",
        "hints": ["用按 (timestamp, 接收序号) 排序的 order-statistic treap；前缀排名可求窗口日志数量，按排名截取最后 m 条。"],
        "timeLimit": 5, "memoryLimit": 262144, "outputLimit": 65536,
        "checker": "exact", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    checksum = hashlib.sha256(normalized.encode()).hexdigest()
    reference = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial = (
        "## 思路\n\n维护一棵按 `(timestamp, 接收序号)` 排序的 order-statistic treap，并保存当前最大时间戳。每条日志以唯一接收序号插入，因此相同时间戳仍按接收先后排序。令 `cutoff=maxTimestamp-3600`：通过排名查询得到 `timestamp≤cutoff` 的日志数和 `timestamp≤maxTimestamp` 的日志数，两者相减即窗口计数。GET_LOGS 从窗口对应排名区间中取最后 m 项并中序输出。\n\n"
        "## 正确性\n\ntreap 的键按时间戳、接收序号字典序排列，故中序遍历与题目排序一致。`rank_less(cutoff+1,0)` 计算时间戳不大于 cutoff 的前缀长度，恰好排除差值不少于 3600 秒的日志；`rank_less(maxTimestamp+1,0)` 截至最新时间戳。两者的排名区间正是严格一小时窗口。COUNT 返回区间长度；GET_LOGS 取该区间最后至多 m 个，因此是窗口内最新 m 条且输出升序。\n\n"
        "## 复杂度\n\n每次插入、排名查询期望 O(log q)；输出 GET_LOGS 另需 O(min(m,窗口日志数))。空间 O(q)。"
    )
    write_json(OA / "packages" / f"{identifier}.json", package)
    (OA / "references" / f"{identifier}.py").write_text(reference, encoding="utf-8")
    write_json(OA / "oracles" / f"{identifier}.json", random_cases)
    write_json(OA / "mutants" / f"{identifier}.json", [{"name": name, "code": code} for name, code in mutants])
    write_json(OA / "editorials" / f"{identifier}.json", {"schemaVersion": 1, "id": identifier,
        "title": problem["title"], "explanation": editorial,
        "solutions": [{"language": "python", "code": reference}],
        "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"], "author": "CSWork"})
    write_json(OA / "candidate-batches" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "sourceContentHash": source["contentHash"], "packageChecksum": checksum,
        "editorial": editorial, "authoredSolutions": [{"language": "python", "code": reference}],
    }]})
    write_json(OA / "source-evidence" / f"{batch}.json", {"schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master", "commit": COMMIT, "origin": "https://oamaster.com",
        "items": [{"id": identifier, "sourceUrl": source["sourceUrl"], "catalogContentHash": source["contentHash"],
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256, "lineRange": [343, 421]}],
            "resolvedSemantics": {"windowAnchor": "Maximum timestamp among records received so far; this is explicitly how the fixed source reference implementation updates max_ts.",
                "windowBoundary": "timestamp > anchor - 3600; the exact one-hour-old boundary is excluded.",
                "order": "Timestamp ascending, then receive sequence ascending; return the last m in this order.",
                "siteInputSupplement": "The source gives class methods and a maximum q but no stdin/stdout serialization. This candidate uses m q followed by one operation per line and discloses signed numeric site bounds."}}]})
    review_items = json.loads(REVIEW.read_text(encoding="utf-8"))["items"]
    review_reason = next(item["reason"] for item in review_items if item["id"] == identifier)
    write_json(OA / "resolutions" / f"{batch}.json", {"schemaVersion": 1, "items": [{
        "id": identifier, "batch": batch, "sourceContentHash": source["contentHash"],
        "previousReason": review_reason,
        "reason": "固定源参考实现明确将最大 timestamp 作为乱序日志窗口锚点，严格过滤早于/等于 anchor−3600 的记录，并按 (timestamp, 接收序号) 排序后取最后 m 条；候选按该可执行定义恢复，不猜测。120 个小规模独立列表排序 oracle、正式边界及两个正常退出错误实现均通过，另在 10 万条记录混合查询上做了本地压力验证。"}]})
    write_json(OA / "validation" / f"{batch}.json", {"schemaVersion": 1, "seed": 20261006,
        "problems": [{"id": identifier, "formalCases": len(cases), "oracleCases": len(random_cases),
            "oracleInputsUnique": len(seen) - len(cases), "negativeControls": controls,
            "stressRecords": 100000, "stressQueries": len(stress_ops) - 100000}],
        "note": "本地独立排序 oracle、窗口边界、乱序/平局、多查询和两个正常退出 mutant 验证；未连接 GoJudge。"})
    print(f"{identifier}: formal={len(cases)}, unique oracle={len(random_cases)}, mutants={len(controls)} killed, stress records=100000")


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    actual_blob = subprocess.check_output(["git", "rev-parse", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT, text=True).strip()
    raw_source = subprocess.check_output(["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT)
    assert actual_blob == RAW_BLOB
    assert hashlib.sha256(raw_source).hexdigest() == RAW_SHA256
    rng = random.Random(20261006)
    build(catalog, rng)


if __name__ == "__main__":
    main()
