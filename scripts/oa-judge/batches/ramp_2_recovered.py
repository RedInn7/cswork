"""Build and locally verify an isolated candidate for Ramp OA #2.

This script writes only oa-ramp-2-specific candidate artifacts. It does not
change shared coverage/registry/README files and never contacts a judge.
"""

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
PID = "oa-ramp-2"
BATCH = "ramp-2-recovered"
SEED = 20261006
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/ramp.mdx"
SOURCE_BLOB = "b889171abc2e693b513b5d43a65bd4b26fbeb7b2"
SOURCE_SHA256 = "dec7dcf6529263eaba62084edad633bff9349f23d7b665d00e38e97dcf2668ad"
SOURCE_URL = "https://oamaster.com/docs/companies/ramp#2-bot-bank--depositwithdraw-with-cashback-stateless-solution"
SOURCE_HASH = "e18fd8d39a909b4fdb9fc031237a025e18a334c94b4bef6990cf10defaa18fef"
DAY_SECONDS = 86_400


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = r'''import heapq
import json
import sys

DAY_SECONDS = 86_400

def solve(raw):
    tokens = raw.split()
    if len(tokens) < 2:
        raise ValueError("expected account and request counts")
    n, q = int(tokens[0]), int(tokens[1])
    if not (1 <= n <= 100_000 and 0 <= q <= 200_000):
        raise ValueError("input exceeds station limits")
    if len(tokens) != 2 + n + 4 * q:
        raise ValueError("wrong number of input fields")
    balance = list(map(int, tokens[2:2+n]))
    if any(x < 0 or x > 1_000_000_000_000 for x in balance):
        raise ValueError("invalid initial balance")

    requests = []
    at = 2 + n
    previous_ts = 0
    for _ in range(q):
        op = tokens[at]
        ts, account, amount = map(int, tokens[at+1:at+4])
        at += 4
        if op not in ("deposit", "withdraw"):
            raise ValueError("unknown operation")
        if not (1 <= ts <= 1_000_000_000_000 and ts > previous_ts):
            raise ValueError("timestamps must be strictly increasing")
        if not (0 <= amount <= 1_000_000_000):
            raise ValueError("invalid amount")
        previous_ts = ts
        requests.append((op, ts, account, amount))

    pending = []
    for request_id, (op, ts, account, amount) in enumerate(requests, 1):
        # The statement explicitly orders due cashback before same-second work.
        while pending and pending[0][0] <= ts:
            _, index, refund = heapq.heappop(pending)
            balance[index] += refund

        if account < 1 or account > n:
            return json.dumps([-request_id], separators=(",", ":"))
        index = account - 1
        if op == "deposit":
            balance[index] += amount
        else:
            if balance[index] < amount:
                return json.dumps([-request_id], separators=(",", ":"))
            balance[index] -= amount
            refund = (amount * 2) // 100
            heapq.heappush(pending, (ts + DAY_SECONDS, index, refund))

    # Do not process refunds after the timestamp of the final request.
    return json.dumps(balance, separators=(",", ":"))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def encode(balances: list[int], requests: list[tuple[str, int, int, int]]) -> str:
    lines = [f"{len(balances)} {len(requests)}", " ".join(map(str, balances))]
    lines.extend(f"{op} {ts} {account} {amount}" for op, ts, account, amount in requests)
    return "\n".join(lines) + "\n"


def decode(raw: str) -> tuple[list[int], list[tuple[str, int, int, int]]]:
    tokens = raw.split()
    n, q = map(int, tokens[:2])
    balances = list(map(int, tokens[2:2+n]))
    at = 2 + n
    requests = []
    for _ in range(q):
        requests.append((tokens[at], int(tokens[at+1]), int(tokens[at+2]), int(tokens[at+3])))
        at += 4
    return balances, requests


def independent_oracle(raw: str) -> str:
    """Slow reference: scan the pending-event list at each request, no heap."""
    balances, requests = decode(raw)
    pending: list[tuple[int, int, int]] = []
    for request_id, (op, ts, account, amount) in enumerate(requests, 1):
        due_now = [event for event in pending if event[0] <= ts]
        pending = [event for event in pending if event[0] > ts]
        for _, index, refund in due_now:
            balances[index] += refund

        if not 1 <= account <= len(balances):
            return json.dumps([-request_id], separators=(",", ":"))
        index = account - 1
        if op == "deposit":
            balances[index] += amount
        else:
            if balances[index] < amount:
                return json.dumps([-request_id], separators=(",", ":"))
            balances[index] -= amount
            pending.append((ts + DAY_SECONDS, index, (amount * 2) // 100))
    return json.dumps(balances, separators=(",", ":"))


def run_code(code: str, raw: str, cache: dict[str, object]) -> str:
    fn = cache.get(code)
    if fn is None:
        env: dict[str, object] = {"__name__": "candidate"}
        exec(compile(code, "<candidate>", "exec"), env)
        fn = env["solve"]
        cache[code] = fn
    return str(fn(raw))


STRICT_BEFORE_MUTANT = r'''import heapq, json
def solve(raw):
    t = raw.split(); n, q = map(int, t[:2]); b = list(map(int, t[2:2+n])); p=[]; at=2+n
    for i in range(1, q+1):
        op, ts, account, amount = t[at], *map(int, t[at+1:at+4]); at += 4
        while p and p[0][0] < ts:  # Bug: due refund at this exact second is postponed.
            _, idx, value = heapq.heappop(p); b[idx] += value
        if account < 1 or account > n: return json.dumps([-i], separators=(",", ":"))
        idx=account-1
        if op == "deposit": b[idx] += amount
        else:
            if b[idx] < amount: return json.dumps([-i], separators=(",", ":"))
            b[idx] -= amount; heapq.heappush(p, (ts+86400, idx, amount*2//100))
    return json.dumps(b, separators=(",", ":"))
'''


IMMEDIATE_CASHBACK_MUTANT = r'''import heapq, json
def solve(raw):
    t = raw.split(); n, q = map(int, t[:2]); b = list(map(int, t[2:2+n])); p=[]; at=2+n
    for i in range(1, q+1):
        op, ts, account, amount = t[at], *map(int, t[at+1:at+4]); at += 4
        while p and p[0][0] <= ts:
            _, idx, value = heapq.heappop(p); b[idx] += value
        if account < 1 or account > n: return json.dumps([-i], separators=(",", ":"))
        idx=account-1
        if op == "deposit": b[idx] += amount
        else:
            if b[idx] < amount: return json.dumps([-i], separators=(",", ":"))
            b[idx] -= amount; b[idx] += amount*2//100  # Bug: cashback is not immediate.
    return json.dumps(b, separators=(",", ":"))
'''


def make_random_case(rng: random.Random) -> tuple[list[int], list[tuple[str, int, int, int]]]:
    n = rng.randint(1, 4)
    balances = [rng.choice([0, 1, 2, 49, 50, 99, 100, 250, 1_000_000]) for _ in range(n)]
    q = rng.randint(0, 18)
    ts = rng.randint(1, 100)
    requests = []
    for _ in range(q):
        ts += rng.choice([1, 2, 10, 86_399, 86_400, 86_401, 100_000])
        op = rng.choice(["deposit", "withdraw"])
        account = rng.choice([0, 1, n, n+1])
        amount = rng.choice([1, 2, 49, 50, 99, 100, 101, 251, 1_000_000])
        requests.append((op, ts, account, amount))
    return balances, requests


def main() -> None:
    started = time.perf_counter()
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(entry for entry in catalog["items"] if entry["id"] == PID)
    assert item["contentHash"] == SOURCE_HASH
    assert item["sourceUrl"] == SOURCE_URL
    assert "same timestamp" in item["statement"]
    assert "invalid account number" in item["statement"]
    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(entry for entry in coverage["items"] if entry["id"] == PID)
    assert (
        state["status"] == "blocked"
        or (state["status"] in {"awaiting_sandbox", "sandbox_verified"} and state.get("batch") == BATCH)
    ), state

    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            if path.name == f"{BATCH}.json":
                continue
            manifest = json.loads(path.read_text())
            assert all(entry["id"] != PID for entry in manifest.get("items", [])), path

    source = subprocess.run(
        ["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    assert sha(source) == SOURCE_SHA256
    assert "Bot Bank" in source and "86400" in source
    assert "same timestamp" in source and "[-request_id]" in source

    # These are CSWork wrapper examples, not examples claimed to be in OAMaster.
    public_cases = [
        ("到期退款先于同秒操作", [200], [
            ("withdraw", 1, 1, 100), ("withdraw", 86_401, 1, 100),
        ]),
        ("不足 50 的提现返现为零", [49], [("withdraw", 1, 1, 49)]),
        ("首个请求的非法账号", [100], [("deposit", 1, 0, 1)]),
        ("首个请求余额不足", [49], [("withdraw", 1, 1, 50)]),
        ("第二个请求非法则返回负二", [100], [
            ("deposit", 1, 1, 5), ("withdraw", 2, 2, 1),
        ]),
        ("末条请求后未到期退款不计入余额", [100], [("withdraw", 1, 1, 100)]),
        ("返现落在两条请求之间", [100], [
            ("withdraw", 1, 1, 100), ("deposit", 86_402, 1, 5),
        ]),
        ("多个账号分别处理", [10, 10], [
            ("deposit", 1, 1, 3), ("withdraw", 2, 2, 10),
        ]),
    ]
    reference_cache: dict[str, object] = {}
    oracle_rows = []
    seen = set()
    for _, balances, requests in public_cases:
        raw = encode(balances, requests)
        expected = independent_oracle(raw)
        assert run_code(REFERENCE, raw, reference_cache) == expected
        assert raw not in seen
        seen.add(raw)
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    # Exhaust small one-account programs, with boundary amounts around cashback.
    amounts = [1, 49, 50, 99, 100]
    choices = [(op, amount) for op in ("deposit", "withdraw") for amount in amounts]
    exhaustive = 0
    for initial in (0, 1, 49, 50, 100):
        for q in range(1, 4):
            for selected in itertools.product(choices, repeat=q):
                # Alternate short gaps and the exact refund delay.
                gaps = [1 if j % 2 == 0 else DAY_SECONDS for j in range(q)]
                ts = 1
                requests = []
                for j, (op, amount) in enumerate(selected):
                    if j:
                        ts += gaps[j]
                    requests.append((op, ts, 1, amount))
                raw = encode([initial], requests)
                expected = independent_oracle(raw)
                assert run_code(REFERENCE, raw, reference_cache) == expected, raw
                exhaustive += 1

    rng = random.Random(SEED)
    random_inputs = []
    while len(random_inputs) < 180:
        balances, requests = make_random_case(rng)
        raw = encode(balances, requests)
        if raw not in seen:
            seen.add(raw)
            expected = independent_oracle(raw)
            assert run_code(REFERENCE, raw, reference_cache) == expected, raw
            oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})
            random_inputs.append(raw)

    # Public cases plus carefully selected state/temporal edge cases and random differentiators.
    formal_inputs = [encode(b, r) for _, b, r in public_cases] + [
        encode([0, 25], []),
        encode([0], [("withdraw", 1, 1, 0)]),
        encode([100], [("withdraw", 1, 1, 100), ("deposit", 86_401, 1, 1)]),
        encode([100], [("withdraw", 1, 1, 99), ("withdraw", 86_400, 1, 1)]),
        encode([100], [("withdraw", 1, 1, 100), ("withdraw", 86_400, 1, 100)]),
    ] + random_inputs[:24]
    formal_cases = []
    formal_expected = []
    for index, raw in enumerate(formal_inputs):
        expected = independent_oracle(raw)
        formal_expected.append(expected)
        if index < len(public_cases):
            name = public_cases[index][0]
        else:
            name = f"隐藏边界 {index - len(public_cases) + 1}" if index < len(public_cases) + 5 else f"随机区分 {index - len(public_cases) - 4}"
        formal_cases.append({
            "name": name,
            "input": raw,
            "expectedOutput": expected + "\n",
            "hidden": index >= len(public_cases),
            "weight": 1,
        })

    mutants = [
        {"name": "同秒到期退款延迟到下一条请求", "code": STRICT_BEFORE_MUTANT},
        {"name": "提现成功后立即发放返现", "code": IMMEDIATE_CASHBACK_MUTANT},
    ]
    controls = []
    for mutant in mutants:
        rejected = [
            i for i, raw in enumerate(formal_inputs)
            if run_code(mutant["code"], raw, reference_cache) != formal_expected[i]
        ]
        assert rejected, mutant["name"]
        controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    editorial = """## 为什么正确

按请求时间顺序模拟账户余额。维护一个按返现到期秒数排序的最小堆；处理每条请求前，先发放所有到期时间不晚于当前请求的返现。这也保证同秒到期返现先于该请求处理。

账户号按固定源附带的 Python 实现采用 1 起算。若账号超出 `1..N`，或提现额高于当前余额，立即输出该请求的负序号。存款直接加余额；提现成功时扣款，并把 `floor(amount×2/100)` 与 `timestamp+86400` 放入堆。全部请求处理完后，直接返回此时余额；请求结束时间之后才到期的返现不提前支付。

## 正确性要点

处理时间为 t 的请求之前，堆中所有 `refundTime≤t` 的返现都已入账，其余事件尚未到期，因此账户余额恰为题意规定的 t 时刻可用余额。对请求执行账号与余额校验后，存款/提现的状态变更与规则一致；每笔成功提现只创建一笔固定到期、按整数向下取整的返现。首次非法请求立即返回其 1-based 序号的相反数，之后无需继续模拟。由请求时间严格递增，按序处理即可得到最后一条请求时刻的余额。

## 复杂度

设 Q 条请求，最多 Q 笔返现事件。每笔事件恰好入堆、出堆一次，时间 O(Q log Q)，额外空间 O(Q)。

## 来源与本站输入约定

固定 OAMaster Ramp #2 说明秒级时间戳严格递增，提现返还 2%（向下取整）且延迟 86400 秒；若请求与返现同秒，返现先处理；非法账号或余额不足时返回首次非法请求的负序号；随附 Python 实现将账号按 1 起算。

原题没有规定 stdin/stdout、数组最大长度、余额/金额/时间数值上限。本站补充：首行 `N Q`，次行为 N 个初始余额，之后 Q 行为 `operation timestamp holder_id amount`；输出 JSON 数组。本站限制 `1≤N≤100000`、`0≤Q≤200000`、初始余额 `0..10^12`、非负整数金额 `0..10^9`、正整数秒级时间戳严格递增且不超过 `10^12`。账号使用整数，1..N 为有效，其余值按源题非法账号规则处理。以上资源和序列化限制是本站约定，不冒充原题约束。"""

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID,
            "courseId": "gomall",
            "lessonId": "00-overview",
            "title": "银行存取款与延迟返现（Ramp OA）",
            "difficulty": "中等",
            "tags": ["OA", "Ramp", "模拟", "优先队列", "状态管理"],
            "description": "按时间处理银行存款和提现。成功提现会在24小时后返还提现额的2%（向下取整）；有到期返现时，先返现再处理同秒请求。遇到第一笔无效账号或余额不足的请求，返回其负的1起始请求序号。",
            "input": "首行 N Q（本站：1≤N≤100000，0≤Q≤200000）；第二行 N 个初始非负余额（每个≤10^12）。随后 Q 行：operation timestamp holder_id amount。operation 为 deposit 或 withdraw；timestamp 为严格递增的正整数秒（≤10^12）；amount 为非负整数（≤10^9）；holder_id 为整数，1..N 为有效账号，其他值按题意视为非法账号。",
            "output": "输出 JSON 整数数组。若所有请求合法，返回最后一条请求时间戳处理完后的账户余额；若第 i 条请求首次非法，输出 [-i]。最后请求之后才到期的返现不计入最终余额。",
            "explanation": "使用最小堆管理返现到期时间；完整说明见配套题解。",
            "hints": ["每条请求前先处理所有已到期返现。", "返现到期时间与请求时间相等时也要先入账。"],
            "timeLimit": 3,
            "memoryLimit": 262144,
            "outputLimit": 32768,
            "checker": "exact",
            "languages": ["python", "go", "java", "cpp"],
        },
        "cases": formal_cases,
    }
    schema_script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    parsed = subprocess.run(
        ["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
        input=json.dumps(raw_package, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    )
    package = json.loads(parsed.stdout)
    package_checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    manifest_item = {
        "id": PID,
        "sourceContentHash": SOURCE_HASH,
        "packageChecksum": package_checksum,
        "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }

    put_json(OA / "packages" / f"{PID}.json", package)
    reference_path = OA / "references" / f"{PID}.py"
    reference_path.write_text(REFERENCE)
    put_json(OA / "oracles" / f"{PID}.json", oracle_rows)
    put_json(OA / "mutants" / f"{PID}.json", mutants)
    put_json(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1,
        "id": PID,
        "title": package["problem"]["title"],
        "explanation": editorial,
        "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL,
        "sourceContentHash": SOURCE_HASH,
        "author": "CSWork",
    })
    for number, mutant in enumerate(mutants, 1):
        code = "# " + mutant["name"] + "\n" + mutant["code"]
        code += "\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
        (OA / "negative-controls" / f"{PID}-{number}.py").write_text(code)
    put_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [manifest_item],
    })
    put_json(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT,
        "origin": "https://oamaster.com",
        "items": {
            PID: {
                "url": SOURCE_URL,
                "contentHash": SOURCE_HASH,
                "catalogContentHash": SOURCE_HASH,
                "company": "Ramp",
                "title": item["title"],
                "path": SOURCE_PATH,
                "gitBlobSha": SOURCE_BLOB,
                "sourceFileSha256": SOURCE_SHA256,
                "sourceRules": [
                    "timestamps are in seconds and strictly increasing",
                    "withdrawal cashback is floor(2% of amount), refunded after 86400 seconds",
                    "cashback due at a request's timestamp is processed first",
                    "invalid account number or insufficient funds returns the negative 1-based request id on first invalid request",
                    "the accompanying Python solution indexes holder_id as 1-based",
                ],
                "siteOnlyRules": [
                    "stdin/stdout serialization",
                    "N≤100000 and Q≤200000 resource caps",
                    "balance, timestamp and amount numeric caps",
                    "strictly positive amount and nonnegative initial balances",
                ],
            }
        },
    })
    put_json(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID,
            "batch": BATCH,
            "sourceContentHash": SOURCE_HASH,
            "previousReason": "cashback 到期时余额不足、同一时刻事件排序及非法请求状态变更规则需对照完整阶段题面；本批暂缓。",
            "reason": "固定题面明确了提现返现延迟、同秒到期顺序和首个非法请求返回约定；原解说明返现事件按请求时间逐次入账，不足余额只影响提现校验，不会阻止已产生的返现。独立逐事件 oracle 与堆实现差分通过。本站 I/O 及有限数值/规模上限已明确标注为本站规则。候选待真实沙箱验证。",
        }],
    })

    # Every saved oracle row is also exercised through the actual standalone file.
    stdio_rows = oracle_rows + [
        {"input": case["input"], "expectedOutput": case["expectedOutput"]}
        for case in formal_cases
    ]
    stdio_seconds = 0.0
    for row in stdio_rows:
        before = time.perf_counter()
        proc = subprocess.run(
            ["python3", "-I", str(reference_path)], cwd=ROOT,
            input=row["input"], text=True, capture_output=True, timeout=5, check=True,
        )
        stdio_seconds += time.perf_counter() - before
        assert proc.stdout == row["expectedOutput"], (row["input"], proc.stdout, row["expectedOutput"])

    # Boundary load: many withdrawals keep the event heap populated and then
    # cross the one-day expiry frontier. The closed-form balance is independent.
    stress_q = 100_000
    stress_balance = 1_000_000_000_000
    stress_requests = [("withdraw", ts, 1, 100) for ts in range(1, stress_q + 1)]
    stress_raw = encode([stress_balance], stress_requests)
    before = time.perf_counter()
    stress_result = run_code(REFERENCE, stress_raw, reference_cache)
    stress_seconds = time.perf_counter() - before
    matured = max(0, stress_q - DAY_SECONDS)
    expected_stress = [stress_balance - 100 * stress_q + 2 * matured]
    assert json.loads(stress_result) == expected_stress, (stress_result, expected_stress)

    put_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": SEED,
        "problems": [{
            "id": PID,
            "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({row["input"] for row in oracle_rows}),
            "formalCases": len(formal_cases),
            "referenceStdioCases": len(stdio_rows),
            "publicCases": len(public_cases),
            "hiddenCases": len(formal_cases) - len(public_cases),
            "randomOracleCases": len(random_inputs),
            "exhaustiveDifferentialComparisons": exhaustive,
            "stress": {
                "requests": stress_q,
                "finalBalance": expected_stress[0],
                "runtimeSeconds": round(stress_seconds, 4),
                "verifiedAgainstIndependentClosedForm": True,
            },
            "stdioReplaySeconds": round(stdio_seconds, 3),
            "negativeControls": controls,
            "referenceSha256": sha(REFERENCE),
            "localValidationOnly": True,
            "allLocalChecksPassed": True,
        }],
    })

    print(json.dumps({
        "id": PID,
        "candidateBatch": BATCH,
        "statusBefore": state["status"],
        "oracleCases": len(oracle_rows),
        "exhaustiveDifferentialComparisons": exhaustive,
        "formalCases": len(formal_cases),
        "stressRequests": stress_q,
        "stressSeconds": round(stress_seconds, 4),
        "negativeControls": controls,
        "totalSeconds": round(time.perf_counter() - started, 3),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
