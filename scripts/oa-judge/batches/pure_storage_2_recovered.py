"""Build and locally verify an isolated candidate for Pure Storage OA #2.

This generator writes only oa-pure-storage-2-specific artifacts. It never
changes shared coverage/registry/README files and never contacts a judge.
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
PID = "oa-pure-storage-2"
BATCH = "pure-storage-2-recovered"
SEED = 20261006
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/pure-storage.mdx"
SOURCE_BLOB = "6a5991fb239872af4569cc58543bdcd9d3043229"
SOURCE_SHA256 = "d29d6103dc0c4190c72c0f1ace0e2e9e0f7b7500b256e82d2d468bbdcaa0981c"
SOURCE_URL = "https://oamaster.com/docs/companies/pure-storage#2-amazon-regex-generator"
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
FULL = f"[{ALPHABET}]"
PREVIOUS_REASON = (
    "原题解将排除 z[i] 的位置选为最早可行位置，却未证明字典序最小；"
    "字典序比较表明较早位置维持全字母组可能更小，需重做 reference 与 oracle 后另行复审，故本批不注册。"
)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = r'''import sys

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
FULL = "[" + ALPHABET + "]"

def solve(raw):
    lines = raw.split()
    if len(lines) != 4:
        raise ValueError("expected n followed by x, y, and z")
    n = int(lines[0])
    x, y, z = lines[1:]
    if not (1 <= n <= 1_000_000) or len(x) != n or len(y) != n or len(z) != n:
        raise ValueError("invalid lengths")
    if any(any(ch < "A" or ch > "Z" for ch in s) for s in (x, y, z)):
        raise ValueError("strings must contain uppercase English letters")

    # A position can reject z only when z[i] is absent from both required
    # strings. Omitting exactly one such character preserves maximum length.
    star = -1
    for i in range(n - 1, -1, -1):
        if z[i] != x[i] and z[i] != y[i]:
            star = i
            break
    if star < 0:
        return "-1"
    reduced = "[" + ALPHABET.replace(z[star], "") + "]"
    return FULL * star + reduced + FULL * (n - star - 1)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def encode(x: str, y: str, z: str) -> str:
    return f"{len(x)}\n{x}\n{y}\n{z}\n"


def parse(raw: str) -> tuple[str, str, str]:
    lines = raw.split()
    assert len(lines) == 4
    n = int(lines[0])
    x, y, z = lines[1:]
    assert 1 <= n <= 1_000_000 and len(x) == len(y) == len(z) == n
    assert all(c in ALPHABET for s in (x, y, z) for c in s)
    return x, y, z


def independent_oracle(raw: str) -> str:
    """Enumerate every one-position exclusion candidate and compare strings."""
    x, y, z = parse(raw)
    candidates = []
    for i, (a, b, c) in enumerate(zip(x, y, z)):
        if c != a and c != b:
            group = "[" + "".join(letter for letter in ALPHABET if letter != c) + "]"
            candidates.append(FULL * i + group + FULL * (len(x) - i - 1))
    return min(candidates) if candidates else "-1"


def brute_small(x: str, y: str, z: str, alphabet: str = "ABC") -> str:
    """Enumerate every regex group subset for a tiny alphabet and input."""
    groups = []
    for a, b in zip(x, y):
        groups.append([
            "[" + "".join(ch for j, ch in enumerate(alphabet) if mask & (1 << j)) + "]"
            for mask in range(1, 1 << len(alphabet))
            if alphabet.index(a) < len(alphabet)
            and alphabet.index(b) < len(alphabet)
            and mask & (1 << alphabet.index(a))
            and mask & (1 << alphabet.index(b))
        ])
    best = None
    for choices in itertools.product(*groups):
        pattern = "".join(choices)
        matches_x = all(xi in group[1:-1] for xi, group in zip(x, choices))
        matches_y = all(yi in group[1:-1] for yi, group in zip(y, choices))
        matches_z = all(zi in group[1:-1] for zi, group in zip(z, choices))
        if matches_x and matches_y and not matches_z:
            if best is None or len(pattern) > len(best) or (len(pattern) == len(best) and pattern < best):
                best = pattern
    return best if best is not None else "-1"


_FUNCTIONS: dict[str, object] = {}


def run_code(code: str, raw: str) -> str:
    fn = _FUNCTIONS.get(code)
    if fn is None:
        env: dict[str, object] = {"__name__": "candidate"}
        exec(compile(code, "<candidate>", "exec"), env)
        fn = env["solve"]
        _FUNCTIONS[code] = fn
    return str(fn(raw))


LEFTMOST_MUTANT = r'''def solve(raw):
    n, x, y, z = raw.split()
    n = int(n)
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    full = "[" + alphabet + "]"
    star = next((i for i in range(n) if z[i] != x[i] and z[i] != y[i]), -1)
    if star < 0:
        return "-1"
    reduced = "[" + alphabet.replace(z[star], "") + "]"
    return full * star + reduced + full * (n - star - 1)
'''

OMIT_EVERYWHERE_MUTANT = r'''def solve(raw):
    n, x, y, z = raw.split()
    n = int(n)
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    groups = []
    for i in range(n):
        omit = z[i] if z[i] != x[i] and z[i] != y[i] else ""
        groups.append("[" + alphabet.replace(omit, "") + "]")
    return "".join(groups) if any(z[i] != x[i] and z[i] != y[i] for i in range(n)) else "-1"
'''


def main() -> None:
    start = time.perf_counter()
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(x for x in catalog["items"] if x["id"] == PID)
    assert item["title"] == "Amazon Regex Generator"
    assert item["contentHash"] == "17d3cc16979da7c96fbe7de05bcd10c888e5533155d855bd15dd0ebfc4ab7661"
    assert item["sourceUrl"] == SOURCE_URL
    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] == "blocked", state
    reviews = json.loads((OA / "reviews/pure-storage-next.json").read_text())
    previous = next(x for x in reviews["items"] if x["id"] == PID)
    assert previous["status"] == "blocked" and previous["reason"] == PREVIOUS_REASON

    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            manifest = json.loads(path.read_text())
            if folder == "candidate-batches" and path.name == f"{BATCH}.json":
                continue
            assert all(entry["id"] != PID for entry in manifest.get("items", [])), (folder, path)

    # The page/catalog define the regex problem; an unrelated local OCR list
    # labels its own item #2 as Find Repetitions. Do not mix those source sets.
    page = subprocess.run(
        ["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    assert sha(page) == SOURCE_SHA256
    assert "## 2. Amazon Regex Generator" in page
    assert "lexicographically smallest" in page
    assert "1 ≤ n ≤ 10⁶" in page
    unrelated_blob = subprocess.run(
        ["git", "show", f"{COMMIT}:OA LIST/Pure_Storage_OA/002_image.txt"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    assert unrelated_blob.startswith("# 2. Find Repetitions")

    # Source provides no input/output examples. These are clearly labeled site examples.
    public_inputs = [
        encode("AAA", "BBB", "CCC"),  # all positions feasible; tie must omit at rightmost
        encode("ABCA", "BCAB", "CAAC"),  # feasible positions at both ends
        encode("AZA", "ZAZ", "AAA"),  # no feasible position
    ]
    random_inputs = []
    seen = set(public_inputs)
    rng = random.Random(SEED)
    alphabet = "ABCD"
    while len(random_inputs) < 160:
        n = rng.randint(1, 8)
        raw = encode(
            "".join(rng.choice(alphabet) for _ in range(n)),
            "".join(rng.choice(alphabet) for _ in range(n)),
            "".join(rng.choice(alphabet) for _ in range(n)),
        )
        if raw not in seen:
            random_inputs.append(raw)
            seen.add(raw)
    oracle_inputs = public_inputs + random_inputs
    oracle_rows = []
    for raw in oracle_inputs:
        expected = independent_oracle(raw)
        assert run_code(REFERENCE, raw) == expected, raw
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    # Exhaust all 3^6 triples for n=2 over a small alphabet using all possible
    # group subsets; this oracle does not use the maximum-length argument.
    exhaustive = 0
    for chars in itertools.product("ABC", repeat=6):
        x, y, z = "".join(chars[:2]), "".join(chars[2:4]), "".join(chars[4:])
        expected_small = brute_small(x, y, z)
        # Generalize the actual full alphabet by keeping all outside letters in
        # every maximum group; the only choice is which feasible z character to omit.
        feasible = [i for i in range(2) if z[i] != x[i] and z[i] != y[i]]
        candidates = [
            "[" + "".join(c for c in "ABC" if c != z[i]) + "]"
            for i in feasible
        ]
        generalized = "-1"
        if candidates:
            full3 = "[ABC]"
            generalized = min(full3 * i + candidates[j] + full3 * (1 - i)
                              for j, i in enumerate(feasible))
        assert expected_small == generalized, (x, y, z, expected_small, generalized)
        # Independently map restricted-alphabet groups to the 26-letter domain.
        if feasible:
            full26 = FULL
            expanded = min(
                full26 * i
                + "[" + "".join(c for c in ALPHABET if c != z[i]) + "]"
                + full26 * (1 - i)
                for i in feasible
            )
        else:
            expanded = "-1"
        assert run_code(REFERENCE, encode(x, y, z)) == expanded
        exhaustive += 1

    # Formal set includes boundary letters A/Z and exactly one feasible slot.
    formal_inputs = public_inputs + [
        encode("A", "B", "Z"),
        encode("Z", "A", "B"),
        encode("ABC", "BCA", "AAC"),
        encode("A" * 1000, "B" * 1000, "C" * 1000),
        encode("A" * 1000, "A" * 1000, "A" * 1000),
    ] + random_inputs[:24]
    formal_cases = []
    expected_formal = []
    for i, raw in enumerate(formal_inputs):
        expected = independent_oracle(raw)
        expected_formal.append(expected)
        formal_cases.append({
            "name": (
                f"自建样例 {i + 1}" if i < 3
                else f"边界 {i - 2}" if i < 8
                else f"随机区分 {i - 7}"
            ),
            "input": raw,
            "expectedOutput": expected + "\n",
            "hidden": i >= 3,
            "weight": 1,
        })

    mutants = [
        {"name": "选最左可行的排除位置", "code": LEFTMOST_MUTANT},
        {"name": "在所有可行位置都排除对应字符", "code": OMIT_EVERYWHERE_MUTANT},
    ]
    controls = []
    for mutant in mutants:
        rejected = [
            i for i, raw in enumerate(formal_inputs)
            if run_code(mutant["code"], raw) != expected_formal[i]
        ]
        assert rejected, mutant["name"]
        controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    editorial = """## 思路

每个位置是一个独立字符组。为同时匹配 x[i]、y[i]，字符组必须包含这两个字符；要让整个串不匹配 z，至少有一个位置不能包含 z[i]。因此可行位置必须满足 z[i] 与 x[i]、y[i] 都不同。

最长答案在每个位置都使用 A-Z 全集，只在一个可行位置删掉 z[i]，长度为 28n−1。若删多个字符会更短；若删在不满足条件的位置会无法匹配 x/y。

在任一可行位置删一个字母时，其他位置都相同。被删字符之后，缩短的组会遇到更大的下一个字符（若删 Z，则遇到 `]`；`Z` 仍小于 `]`），所以较早出现缩短组的字符串字典序更大。故应选最右侧可行位置。没有可行位置时输出 `-1`。

## 正确性证明

任何合法 regex 的第 i 个字符组都必须包含 x[i] 和 y[i]。若要拒绝 z，至少有一组不包含 z[i]；该位置必满足 z[i]≠x[i] 且 z[i]≠y[i]。完整组长 28，缩短一个字符的组长 27，因此任意可行答案长度至多 28n−1；只选一个可行位置删去 z[i]，其余全用完整组，达到上界。候选间比较时，第一处不同组之前都相同，完整组在被删字符处小于缩短组的下一个字符（包括删 Z 时的右方括号），所以把唯一缩短组尽量后移可得到字典序最小值。算法从右向左找到首个可行位置并构造该上界答案，符合要求。若不存在该位置，每组都必须包含对应 z[i]，任何同时匹配 x/y 的 regex 也会匹配 z，故无解。

## 复杂度

扫描输入 O(n)，构造输出 O(n)；额外工作空间 O(1)，输出空间 O(n)。

## 验证

163 个输入由独立 oracle 枚举每个可行排除位置、生成完整候选后直接比较字符串；额外对长度 2 的 A/B/C 输入穷举全部 3⁶=729 种 x/y/z，并枚举每个位置所有可能的字符组子集。正式测试覆盖无解、唯一/多个可行位置、排除 A/Z 和 n=1000。另在本地直接构造 n=10⁶ 输出校验长度及匹配/失配性质。两个正常返回的错误程序分别被正式用例击杀。

## 来源与本站协议

固定上游 OAMaster 的 Pure Storage 页面/catalog 将 #2 标为 Amazon Regex Generator，明确大写字母/方括号组、同时匹配 x/y、拒绝 z、最长及同长取字典序最小，并给出 n≤10⁶。固定提交的配套 Python/Java/C++ 参考代码都选了最早可行位置；此候选按题面规则重写，修正为最右可行位置。上游没有 stdin/stdout 样例；本站补充第一行 n、随后三行 x/y/z 的协议及 A-Z 字符集校验。

另有一份本地 `OA LIST/Pure_Storage_OA/002_image.txt` 将其自身的 #2 标为 Find Repetitions，与固定站点/catalog 编号内容不同。本候选只对应固定 OAMaster Pure Storage 页面/catalog 的 #2，不混用该本地列表。"""

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID,
            "courseId": "gomall",
            "lessonId": "00-overview",
            "title": "最长且字典序最小的正则表达式（Pure Storage OA）",
            "difficulty": "中等",
            "tags": ["OA", "Pure Storage", "字符串", "贪心", "字典序"],
            "description": (
                "给定长度均为 n 的大写字符串 x、y、z。正则由单个大写字母或方括号字符组组成，"
                "字符组内字母不重复，整条正则按位置拼接。找一个同时匹配 x 与 y、但不匹配 z 的最长正则；"
                "若有多个同长答案，输出字典序最小者；若不存在输出 -1。本站补充标准输入输出协议。"
            ),
            "input": "第一行 n（1≤n≤1000000）；接下来三行依次为 x、y、z，每行恰含 n 个 A-Z 大写英文字母。",
            "output": "输出最长且字典序最小、匹配 x/y 但不匹配 z 的正则；若无解输出 -1。",
            "explanation": "完整推导、正确性证明与来源说明见配套题解。",
            "hints": ["先找能拒绝 z 的位置。", "全字母组可使长度最大；同长候选比较时注意缩短组第一次出现的位置。"],
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
    proc = subprocess.run(
        ["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
        input=json.dumps(raw_package, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    )
    package = json.loads(proc.stdout)
    package_checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    entry = {
        "id": PID,
        "sourceContentHash": item["contentHash"],
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
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": item["contentHash"], "author": "CSWork",
    })
    for i, mutant in enumerate(mutants, 1):
        control = "# " + mutant["name"] + "\n" + mutant["code"]
        control += "\nif __name__ == \"__main__\":\n    import sys\n    print(solve(sys.stdin.read()))\n"
        (OA / "negative-controls" / f"{PID}-{i}.py").write_text(control)
    put_json(OA / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [entry]})
    put_json(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT,
        "origin": "https://oamaster.com",
        "items": {PID: {
            "url": SOURCE_URL,
            "contentHash": item["contentHash"],
            "catalogContentHash": item["contentHash"],
            "company": item["companyName"],
            "title": item["title"],
            "path": SOURCE_PATH,
            "gitBlobSha": SOURCE_BLOB,
            "sourceFileSha256": SOURCE_SHA256,
            "semanticConflict": "Fixed website/catalog #2 is Amazon Regex Generator. Separate local OA LIST/Pure_Storage_OA/002_image.txt says Find Repetitions; it is a distinct, conflicting numbering/source set and was not used to define this candidate.",
            "resolution": "Use only the fixed OAMaster Pure Storage page and catalog entry at commit e66f809f4c953bce129f68491726176615db6afc. The statement is complete; replace the provided earliest-feasible exclusion implementation with the rightmost-feasible choice required by lexicographic minimization.",
        }},
    })
    put_json(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": PID,
            "batch": BATCH,
            "sourceContentHash": item["contentHash"],
            "previousReason": previous["reason"],
            "reason": "固定题面语义完整；独立推导证实原解最早可行位置并非字典序最小，候选改为最右可行位置。与另一份本地编号表的 #2 标题冲突已披露且不混用。标准 I/O 由本站补充。仅为离线候选，尚未运行真实 GoJudge。",
        }],
    })

    stdio_rows = oracle_rows + [{"input": c["input"], "expectedOutput": c["expectedOutput"]} for c in formal_cases]
    for row in stdio_rows:
        proc = subprocess.run(
            ["python3", "-I", str(reference_path)], cwd=ROOT,
            input=row["input"], text=True, capture_output=True, timeout=5, check=True,
        )
        assert proc.stdout == row["expectedOutput"], (row["input"][:80], proc.stdout[:100], row["expectedOutput"][:100])

    # Maximum source n; inspect the full produced value but store no multi-MB case.
    n = 1_000_000
    stress_raw = encode("A" * n, "B" * n, "C" * n)
    stress_output = run_code(REFERENCE, stress_raw)
    assert len(stress_output) == 28 * n - 1
    assert stress_output.startswith(FULL) and stress_output.endswith("[" + ALPHABET.replace("C", "") + "]")
    assert stress_output.count("[") == n
    assert stress_output.count("C") == n - 1
    assert all(ch in stress_output for ch in "AB")

    put_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "seed": SEED,
        "problems": [{
            "id": PID,
            "oracleCases": len(oracle_rows),
            "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
            "referenceStdioCases": len(stdio_rows),
            "publicCases": len(public_inputs),
            "hiddenCases": len(formal_cases) - len(public_inputs),
            "randomOracleCases": len(random_inputs),
            "exhaustiveDifferentialComparisons": exhaustive,
            "stress": {"n": n, "outputLength": len(stress_output), "verified": True},
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
        "formalCases": len(formal_cases),
        "exhaustiveSmallAlphabet": exhaustive,
        "stressN": n,
        "outputLength": len(stress_output),
        "negativeControls": controls,
        "totalSeconds": round(time.perf_counter() - start, 3),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
