"""Build and locally verify an isolated candidate for Fortinet OA #2."""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-fortinet-2"
BATCH = "fortinet-2-recovered"
SEED = 20261006
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "fastprep/Fortinet/fortinet-compute-checksum-aggregation.md"
RAW_BLOB = "71ac2087c87dc2084de665af52b43f0d426d1c7e"
RAW_SHA256 = "414752b5944a88835099dde30de1a8c330ac5d9d7d4147d38aff6f9ae3640b50"
MDX_PATH = "web/content/docs/companies/fortinet.mdx"
MDX_BLOB = "64439f3d71a675886de96eaf5236c309b0f9ac9c"
MDX_SHA256 = "286f9e152eadb1012c17dbdbae43a1f583551f2490fb0184d5164d8855ffcf90"
SOURCE_URL = "https://oamaster.com/docs/companies/fortinet#2-checksum-aggregator"
CATALOG_HASH = "97fc7982fbd48e129125077eb4cccfec15fa258d3b5d104f92775c44e5693129"
PREVIOUS_REASON = "题面在要枚举的 pair 区间 `(1 ...` 处截断，无法确定完整求和范围。"
MOD = 1_000_000_007
MAX_N = 1_000_000


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = r'''import sys

MOD = 1_000_000_007

def solve(raw):
    tokens = raw.split()
    if len(tokens) != 1:
        raise ValueError("expected one integer n")
    n = int(tokens[0])
    if not 1 <= n <= 1_000_000:
        raise ValueError("n must be in [1, 1000000]")

    # For fixed j, residues i % j over i=1..n form q full cycles
    # (sum j*(j-1)/2 each), then residues 1..r.
    one_mod_sum = 0
    for j in range(1, n + 1):
        q, r = divmod(n, j)
        residue_sum = q * j * (j - 1) // 2 + r * (r + 1) // 2
        one_mod_sum = (one_mod_sum + residue_sum) % MOD

    # The two terms in C(i,j) have identical totals over the independent
    # i,j ranges. Diagonal terms are zero and may be omitted.
    return str((2 * one_mod_sum) % MOD)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def encode(n: int) -> str:
    return f"{n}\n"


def independent_oracle(raw: str) -> str:
    """Directly enumerate every ordered pair of distinct IDs."""
    fields = list(map(int, raw.split()))
    assert len(fields) == 1 and 1 <= fields[0] <= 1_000_000
    n = fields[0]
    total = 0
    for i in range(1, n + 1):
        for j in range(1, n + 1):
            if i != j:
                total += i % j + j % i
    return str(total % MOD)


def alternate_formula(n: int) -> str:
    """Independent quotient-sum identity for scale checks.

    For each j, sum(i % j) = n(n+1)/2 - j*sum(floor(i/j)).
    If n=qj+r, sum floor(i/j) = j*q(q-1)/2 + q(r+1).
    """
    triangular = n * (n + 1) // 2
    total = 0
    for j in range(1, n + 1):
        q, r = divmod(n, j)
        quotient_sum = j * q * (q - 1) // 2 + q * (r + 1)
        total += triangular - j * quotient_sum
    return str((2 * total) % MOD)


_FUNCTIONS: dict[str, object] = {}


def run_code(code: str, raw: str) -> str:
    fn = _FUNCTIONS.get(code)
    if fn is None:
        env: dict[str, object] = {"__name__": "candidate"}
        exec(compile(code, "<candidate>", "exec"), env)
        fn = env["solve"]
        _FUNCTIONS[code] = fn
    return str(fn(raw))


MUTANTS = [
    {
        "name": "只累加 i mod j，遗漏 j mod i",
        "code": r'''def solve(raw):
 n=int(raw.split()[0]);m=1000000007;s=0
 for j in range(1,n+1):
  q,r=divmod(n,j);s=(s+q*j*(j-1)//2+r*(r+1)//2)%m
 return str(s)
''',
    },
    {
        "name": "错误地跳过至少一项模运算为零的 distinct pair",
        "code": r'''def solve(raw):
 n=int(raw.split()[0]);s=0
 for i in range(1,n+1):
  for j in range(1,n+1):
   if i!=j and i%j and j%i:s+=i%j+j%i
 return str(s%1000000007)
''',
    },
]


def main() -> None:
    start = time.perf_counter()
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(x for x in catalog["items"] if x["id"] == PID)
    assert item["title"] == "Checksum Aggregator"
    assert item["contentHash"] == CATALOG_HASH and item["sourceUrl"] == SOURCE_URL
    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] == "blocked", state
    review = json.loads((OA / "reviews/saas-tech-remaining.json").read_text())
    previous = next(x for x in review["items"] if x["id"] == PID)
    assert previous["status"] == "blocked" and previous["reason"] == PREVIOUS_REASON
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            manifest = json.loads(path.read_text())
            if folder == "candidate-batches" and path.name == f"{BATCH}.json":
                continue
            assert all(entry["id"] != PID for entry in manifest.get("items", [])), (folder, path)

    raw_source = subprocess.run(
        ["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    mdx_source = subprocess.run(
        ["git", "show", f"{COMMIT}:{MDX_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    assert sha(raw_source) == RAW_SHA256
    assert sha(mdx_source) == MDX_SHA256
    assert "C(i, j) = i mod j + j mod i" in raw_source
    assert "all possible pairs of packets within the network" in raw_source
    assert "1 <= i <= n" in raw_source and "1 <= j <= n" in raw_source
    assert "10 ** 9 + 7" in raw_source and "1 <= n <= 10 ** 6" in raw_source
    assert "Calculate the sum of `C(i, j)` for all pairs `(1" in mdx_source  # conversion truncates at '<'

    public_ns = [1, 2, 3]
    random_ns = []
    seen = set(public_ns)
    rng = random.Random(SEED)
    while len(random_ns) < 160:
        n = rng.randint(1, 240)
        if n not in seen:
            random_ns.append(n)
            seen.add(n)
    oracle_ns = public_ns + random_ns
    oracle_rows = []
    for n in oracle_ns:
        raw = encode(n)
        expected = independent_oracle(raw)
        assert run_code(REFERENCE, raw) == expected, n
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    # Full independent brute force over every input n in a compact interval.
    exhaustive_n = 80
    for n in range(1, exhaustive_n + 1):
        raw = encode(n)
        assert run_code(REFERENCE, raw) == independent_oracle(raw)

    formal_ns = public_ns + [4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 31, 64, 127, 1000, MAX_N]
    formal_ns += random_ns[:17]
    cases = []
    expected_formal = []
    for i, n in enumerate(formal_ns):
        expected = alternate_formula(n) if n == MAX_N else independent_oracle(encode(n))
        expected_formal.append(expected)
        cases.append({
            "name": f"自建样例 {i + 1}" if i < 3 else f"边界/随机 {i - 2}",
            "input": encode(n),
            "expectedOutput": expected + "\n",
            "hidden": i >= 3,
            "weight": 1,
        })

    controls = []
    for mutant in MUTANTS:
        rejected = [i for i, n in enumerate(formal_ns) if n <= 127
                    if run_code(mutant["code"], encode(n)) != expected_formal[i]]
        assert rejected, mutant["name"]
        controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    editorial = """## 思路

题目给出 `C(i,j)=i mod j+j mod i`。题面所列 i、j 是两个独立的 1..n 范围，因此按所有有序 `(i,j)` 组合求和；同一编号对角项为 0，不影响结果。全体 `i mod j` 与全体 `j mod i` 的总和相同，所以答案是 `2T`，其中 `T=Σ[j=1..n] Σ[i=1..n] (i mod j)`。

固定 j，令 `n=qj+r`。序列 `1 mod j, 2 mod j, ...` 每 j 项完整重复一次，其一轮和为 `j(j−1)/2`；剩余 r 项的余数为 `1..r`，和为 `r(r+1)/2`。于是该 j 的贡献为 `q·j(j−1)/2+r(r+1)/2`。累加后乘 2 并对 1,000,000,007 取模。

## 正确性证明

对固定 j，前 qj 个 i 可拆为 q 个完整周期，每周期余数恰为 0 到 j−1，最后 r 个余数为 1 到 r，因此公式准确计算 `Σ_i i mod j`。交换求和变量可知 `Σ_{i,j} j mod i` 与 `Σ_{i,j} i mod j` 相同；每个对角项为零，故总 checksum 正好是 2T。算法逐一遍历每个 j 计算其精确贡献，最后模化不改变模意义上的结果。

## 复杂度

时间 O(n)，额外空间 O(1)。

## 验证

163 个 oracle 输入直接枚举所有有序 distinct pair；另对 n=1..80 全部对拍。正式测试包含 n=1、2、3、多个小值、模边界规模以及 n=10⁶。最大规模期望由独立恒等式 `Σ_i i mod j = n(n+1)/2 − j·Σ_i floor(i/j)` 计算。两个正常退出错误程序分别漏掉对称项、错误跳过整除相关 pair，均被用例拒绝。

## 来源与本站协议

固定提交中的原始 FastPrep 文档明确公式、参数 n、模数 10⁹+7、n≤10⁶，以及 i 和 j 各自独立遍历 1..n；OAMaster MDX/catalog 的转换文本在范围中的 `<` 处截断。按两个独立范围解读为有序对；题目同时说 distinct，因此不需要对角项（即使代入公式也为 0）。本站补充 stdin/stdout：输入一个 n，输出模后的整数。"""

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID,
            "courseId": "gomall",
            "lessonId": "00-overview",
            "title": "Checksum Aggregator（Fortinet OA）",
            "difficulty": "中等",
            "tags": ["OA", "Fortinet", "数学", "模运算"],
            "description": "对所有 1≤i,j≤n 的有序编号对，按 C(i,j)=i mod j+j mod i 求和并对 1,000,000,007 取模。题面限定两个编号不同，对角项为零。输入输出协议由本站补充。",
            "input": "输入一个整数 n（1≤n≤1000000）。",
            "output": "输出所有 distinct ordered pairs 的 checksum 总和，对 1000000007 取模。",
            "explanation": "按固定 j 将 1..n 的余数分为完整周期和尾段。",
            "hints": ["固定 j，余数每 j 项循环一次。", "i mod j 与 j mod i 在全体有序对上的和相同。"],
            "timeLimit": 3,
            "memoryLimit": 262144,
            "outputLimit": 4096,
            "checker": "exact",
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
    package_checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    editorial_entry = {
        "id": PID,
        "sourceContentHash": CATALOG_HASH,
        "packageChecksum": package_checksum,
        "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }

    put_json(OA / "packages" / f"{PID}.json", package)
    ref_path = OA / "references" / f"{PID}.py"
    ref_path.write_text(REFERENCE)
    put_json(OA / "oracles" / f"{PID}.json", oracle_rows)
    put_json(OA / "mutants" / f"{PID}.json", MUTANTS)
    put_json(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": CATALOG_HASH, "author": "CSWork",
    })
    for i, mutant in enumerate(MUTANTS, 1):
        text = "# " + mutant["name"] + "\n" + mutant["code"]
        text += "\nif __name__ == \"__main__\":\n    import sys\n    print(solve(sys.stdin.read()))\n"
        (OA / "negative-controls" / f"{PID}-{i}.py").write_text(text)
    put_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1, "items": [editorial_entry],
    })
    put_json(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT,
        "origin": "https://oamaster.com",
        "items": {PID: {
            "url": SOURCE_URL,
            "contentHash": CATALOG_HASH,
            "catalogContentHash": CATALOG_HASH,
            "company": item["companyName"],
            "title": item["title"],
            "rawPath": RAW_PATH,
            "rawGitBlob": RAW_BLOB,
            "rawSha256": RAW_SHA256,
            "mdxPath": MDX_PATH,
            "mdxGitBlob": MDX_BLOB,
            "mdxSha256": MDX_SHA256,
            "resolution": "The fixed FastPrep source snapshot supplies the full double range omitted by the MDX/catalog HTML conversion. The source says distinct packets and separately ranges both i and j over 1..n; use the ordered Cartesian product, excluding i=j (whose formula value is zero regardless).",
        }},
    })
    put_json(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID,
            "batch": BATCH,
            "sourceContentHash": CATALOG_HASH,
            "previousReason": previous["reason"],
            "reason": "固定提交 FastPrep 原始文件含完整双重求和范围和约束，补足转换后的 MDX/catalog 截断。本站按 i、j 独立范围解释为有序对，排除题干说的对角 pair；补 stdin/stdout。独立暴力 oracle、80 个 n 穷举、n=10^6 独立恒等式边界和两个错误控制均通过；仍待真实沙箱。",
        }],
    })

    stdio_rows = oracle_rows + [{"input": c["input"], "expectedOutput": c["expectedOutput"]} for c in cases]
    for row in stdio_rows:
        proc = subprocess.run(
            ["python3", "-I", str(ref_path)], cwd=ROOT,
            input=row["input"], text=True, capture_output=True, timeout=5, check=True,
        )
        assert proc.stdout == row["expectedOutput"], (row["input"], proc.stdout, row["expectedOutput"])

    stress_raw = encode(MAX_N)
    stress_output = run_code(REFERENCE, stress_raw)
    assert stress_output == alternate_formula(MAX_N)
    assert 0 <= int(stress_output) < MOD

    put_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": SEED,
        "problems": [{
            "id": PID,
            "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
            "referenceStdioCases": len(stdio_rows),
            "publicCases": len(public_ns),
            "hiddenCases": len(cases) - len(public_ns),
            "randomOracleCases": len(random_ns),
            "exhaustiveNChecks": exhaustive_n,
            "stress": {"n": MAX_N, "result": stress_output, "independentIdentityPassed": True},
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
        "formalCases": len(cases),
        "exhaustiveNChecks": exhaustive_n,
        "stressN": MAX_N,
        "stressResult": stress_output,
        "negativeControls": controls,
        "totalSeconds": round(time.perf_counter() - start, 3),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
