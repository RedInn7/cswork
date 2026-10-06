from __future__ import annotations

import hashlib
import itertools
import json
import random
import subprocess
import time
from collections import Counter
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
PID = "oa-unknown-15"
ITEMS = {x["id"]: x for x in CATALOG["items"]
         if x["id"] in {"oa-unknown-15", "oa-unknown-16", "oa-unknown-17"}}
ITEM = ITEMS[PID]
SEED = 20261006
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
PREVIOUS_REASON = "Part 2 依赖未随题面提供的 Part 1 完整规则，且 Jaccard 的多重集含义要到 Part 3 才补充；本题自身样例为占位说明。"
SOURCES = {
    "oa-unknown-15": ("fastprep/Unknown/unknown-most-unique-elements-part2.md",
                      "d176abf6fb8c08f4c87291deca5cf6b2fc495dc4"),
    "oa-unknown-16": ("fastprep/Unknown/unknown-most-unique-elements-part3.md",
                      "f870e77ddb286f22e1f230530dc818aceabdb3b1"),
    "oa-unknown-17": ("fastprep/Unknown/unknown-most-unique-elements.md",
                      "ac4b79600c09d2957ace523e1c156022e474bdf7"),
}


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


REFERENCE = '''import json
from collections import Counter
from fractions import Fraction

def solve_object(data):
    strings, use_jaccard = data["strings"], data["useJaccard"]
    counts = [Counter(s) for s in strings]
    n = len(strings)
    if use_jaccard:
        scores = []
        for i in range(n):
            total = Fraction(0, 1)
            for j in range(n):
                if i == j:
                    continue
                chars = counts[i].keys() | counts[j].keys()
                intersection = sum(min(counts[i][c], counts[j][c]) for c in chars)
                union = sum(max(counts[i][c], counts[j][c]) for c in chars)
                total += Fraction(intersection, union)
            scores.append(total / (n - 1))
    else:
        scores = [Fraction(max(c.values()), len(s)) for c, s in zip(counts, strings)]
    best = min(scores)
    selected = [i for i, score in enumerate(scores) if score == best]
    selected_set = set(selected)
    other_chars = set().union(*(set(strings[i]) for i in range(n) if i not in selected_set)) if len(selected) < n else set()
    answer = "".join(ch for i in selected for ch in strings[i] if ch not in other_chars)
    return answer

def solve(raw):
    data = json.loads(raw)
    if not isinstance(data, dict) or set(data) != {"strings", "useJaccard"}:
        raise ValueError("expected strings and useJaccard")
    strings, flag = data["strings"], data["useJaccard"]
    if not isinstance(strings, list) or not 2 <= len(strings) <= 80:
        raise ValueError("site limit: 2 <= number of strings <= 80")
    if type(flag) is not bool or any(not isinstance(s, str) or not 1 <= len(s) <= 1000 for s in strings):
        raise ValueError("site limit: boolean and non-empty strings of length <= 1000")
    if sum(map(len, strings)) > 10000:
        raise ValueError("site limit: total length <= 10000")
    return json.dumps(solve_object(data), ensure_ascii=False)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def input_for(strings: list[str], flag: bool) -> str:
    return json.dumps({"strings": strings, "useJaccard": flag}, ensure_ascii=False) + "\n"


def oracle(strings: list[str], flag: bool) -> str:
    counts = [Counter(s) for s in strings]
    if flag:
        scores = []
        for i, left in enumerate(counts):
            values = []
            for j, right in enumerate(counts):
                if i == j:
                    continue
                intersection = sum((left & right).values())
                union = sum((left | right).values())
                values.append(Fraction(intersection, union))
            scores.append(sum(values, Fraction()) / len(values))
    else:
        scores = [Fraction(max(c.values()), len(s)) for c, s in zip(counts, strings)]
    best = min(scores)
    selected = [i for i, value in enumerate(scores) if value == best]
    unselected_chars = set().union(*(set(strings[i]) for i in range(len(strings)) if i not in selected)) if len(selected) < len(strings) else set()
    return "".join(ch for i in selected for ch in strings[i] if ch not in unselected_chars)


def run_ref(raw: str) -> str:
    proc = subprocess.run(["python3", "-I", "-c", REFERENCE], cwd=ROOT,
                          input=raw, text=True, capture_output=True, timeout=10, check=True)
    return json.loads(proc.stdout)


def main() -> None:
    assert ITEMS[PID]["contentHash"] == "5653896c6164886f171a228aabb5a93e69ff7b05ecc52ab48222f538426aede5"
    assert ITEMS["oa-unknown-16"]["contentHash"] == "d22ead1480c069baa0b8935e5047b1b6711244f374f22e3314fcd1405fb0c9e4"
    assert ITEMS["oa-unknown-17"]["contentHash"] == "9ad04e604a4744fce6fd114fdc4b446e5cd51d6fc91740ec88857bb7d3f52eec"
    reviews = json.loads((OA / "reviews/unknown-company-review.json").read_text())
    prior = next(x for x in reviews["items"] if x["id"] == PID)
    assert prior["status"] == "blocked" and "Part 1" in prior["reason"]
    evidence = json.loads((OA / "source-evidence/unknown-company-review.json").read_text())
    evidence_by_id = {x["id"]: x for x in evidence["items"]}
    raw_sources = {}
    for source_id, (path, blob_id) in SOURCES.items():
        item = evidence_by_id[source_id]
        assert item["catalogContentHash"] == ITEMS[source_id]["contentHash"]
        assert item["path"] == f"content/oa-master/catalog.json#items/{source_id}"
        tree = subprocess.run(["git", "ls-tree", "-r", COMMIT, "--", path], cwd=ROOT,
                              text=True, capture_output=True, check=True).stdout
        assert blob_id in tree and path in tree
        raw_sources[source_id] = subprocess.run(["git", "cat-file", "-p", blob_id], cwd=ROOT,
                                                text=True, capture_output=True, check=True).stdout
    assert "lowest average Jaccard Similarity" in raw_sources["oa-unknown-15"]
    assert "lowest proportion in Part 1" in raw_sources["oa-unknown-15"]
    assert "uniquely present in the selected strings across the entire list" in raw_sources["oa-unknown-15"]
    assert "smallest proportion" in raw_sources["oa-unknown-17"]
    assert "only present in the selected strings" in raw_sources["oa-unknown-17"]
    assert "including repeats" in raw_sources["oa-unknown-16"]
    assert "intersection(A, B) / union(A, B)" in raw_sources["oa-unknown-16"]

    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] == "blocked", state
    for folder in ("candidate-batches", "batches"):
        for path in (OA / folder).glob("*.json"):
            if folder == "candidate-batches" and path.name == "unknown-15-recovered.json":
                continue
            manifest = json.loads(path.read_text())
            assert all(x["id"] != PID for x in manifest.get("items", [])), (folder, path)
    assert PID not in json.dumps(json.loads((OA / "registry.json").read_text()))

    public = [(["aba", "ab", "abbcdd"], False),
              (["baa", "abbc", "ab"], True),
              (["a", "a", "aa"], True),
              (["aaab", "aabb", "abbb", "cccc"], True)]
    rng = random.Random(SEED)
    alphabet = "abc"
    random_cases = []
    for _ in range(160):
        n = rng.randint(2, 7)
        strings = ["".join(rng.choice(alphabet) for _ in range(rng.randint(1, 8))) for _ in range(n)]
        random_cases.append((strings, rng.choice((False, True))))

    start = time.perf_counter()
    oracle_rows = []
    for strings, flag in public + random_cases:
        expected = oracle(strings, flag)
        actual = run_ref(input_for(strings, flag))
        assert actual == expected, (strings, flag, actual, expected)
        oracle_rows.append({"input": input_for(strings, flag),
                            "expectedOutput": json.dumps(expected, ensure_ascii=False) + "\n"})

    tiny = ["a", "b", "aa", "ab", "ba", "bb", "aba"]
    exhaustive = 0
    env: dict[str, object] = {}
    exec(compile(REFERENCE, "<unknown-15-reference>", "exec"), env)
    for n in range(2, 5):
        for strings in itertools.product(tiny, repeat=n):
            for flag in (False, True):
                expected = oracle(list(strings), flag)
                actual = env["solve_object"]({"strings": list(strings), "useJaccard": flag})
                assert actual == expected
                exhaustive += 1

    formal = public + [
        (["aaab", "abbb"], True),
        (["aabb", "ab", "bbb"], True),
        (["a", "b", "c", "d"], False),
        (["ééa", "éa", "zz"], True),
        (["repeat", "repeat", "repeats"], False),
        (["x" * 1000, "x" * 999 + "y"], True),
        (["u" * 1000, "v" * 1000], False),
    ]
    cases, expected_formal = [], []
    for i, (strings, flag) in enumerate(formal):
        expected = oracle(strings, flag)
        expected_formal.append(expected)
        cases.append({"name": f"样例 {i+1}" if i < len(public) else f"边界 {i-len(public)+1}",
                      "input": input_for(strings, flag),
                      "expectedOutput": json.dumps(expected, ensure_ascii=False) + "\n",
                      "hidden": i >= len(public), "weight": 1})

    mutants = [
        {"name": "Jaccard 忽略重复次数，按普通字符集合交并比计算",
         "code": '''import json,sys
d=json.load(sys.stdin);ss=d["strings"];n=len(ss);flag=d["useJaccard"];scores=[]
for i,s in enumerate(ss):
 if flag:scores.append(sum(len(set(s)&set(t))/len(set(s)|set(t)) for j,t in enumerate(ss) if i!=j)/(n-1))
 else:
  from collections import Counter
  c=Counter(s);scores.append(max(c.values())/len(s))
b=min(scores);sel=[i for i,x in enumerate(scores) if x==b];other=set().union(*(set(ss[i]) for i in range(n) if i not in sel)) if len(sel)<n else set()
print(json.dumps("".join(ch for i in sel for ch in ss[i] if ch not in other),ensure_ascii=False))
''' },
        {"name": "忽略开关，始终采用 Part 1 最高字符占比",
         "code": '''import json,sys
from collections import Counter
d=json.load(sys.stdin);ss=d["strings"];scores=[max(Counter(s).values())/len(s) for s in ss];b=min(scores);sel=[i for i,x in enumerate(scores) if x==b];other=set().union(*(set(ss[i]) for i in range(len(ss)) if i not in sel)) if len(sel)<len(ss) else set()
print(json.dumps("".join(ch for i in sel for ch in ss[i] if ch not in other),ensure_ascii=False))
''' },
    ]
    killed = []
    for mutant in mutants:
        rejected = []
        for i, (strings, flag) in enumerate(formal):
            proc = subprocess.run(["python3", "-I", "-c", mutant["code"]], cwd=ROOT,
                                  input=input_for(strings, flag), text=True,
                                  capture_output=True, timeout=10, check=True)
            if json.loads(proc.stdout) != expected_formal[i]:
                rejected.append(i)
        assert rejected, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejected})

    editorial = """## 评分规则

Part 2 明确继承 Part 1：useJaccard=false 时，对每个字符串计算最高字符频次占比，选最低占比的所有字符串。useJaccard=true 时，对每个字符串计算它与其余每个字符串的 Jaccard 相似度平均值，再选最低平均值的所有字符串。列表中的重复字符串按不同位置分别计算。分数使用精确分数比较，避免浮点误差。

Part 3 定义 Jaccard 的字符交集、并集都包括重复次数：每个字符的交集计数取两边频次较小值，并集计数取较大值，交集大小除以并集大小。例如 baa 与 abbc 的交集大小为 2、并集大小为 5，因此相似度为 0.4。

## 输出

对所有选中的字符串，保留那些未出现在任何未选字符串中的字符。按选中字符串的输入顺序拼接；每个字符串内部保持原字符顺序并保留重复次数。Part 1 样例选中 abbcdd，其他字符串含 a、b 而不含 c、d，因此输出 cdd。这个稳定顺序是本站的输出格式约定。

## 正确性与复杂度

每个字符串位置根据对应模式得到唯一分数。精确比较后保留且仅保留全局最小分数位置，包含全部并列项。输出过滤只排除未选字符串中出现的字符，因此恰好保留只存在于所选字符串组的字符。设 n 为字符串数、u 为单串不同字符数、L 为总字符数，时间 O(L+n²u)，空间 O(L+n²)。

## 固定来源与本站补充

固定 Part 2 源明确引用 Part 1 与 Part 3。不可变快照 Part 1 定义最高字符频次占比、并列全选和唯一字符输出；Part 3 定义重复字符参与的 Jaccard 交并，并以 baa/abbc=0.4 为例。三题 Company 字段都为 Unknown，因此本站仍标记 Unknown，不从 URL 名称猜测雇主。本站只补 JSON 输入输出包装、稳定拼接顺序、非空字符串和资源上限。
"""
    package_raw = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "按低占比或低 Jaccard 选择字符串", "difficulty": "中等",
            "tags": ["OA", "Unknown", "字符串", "计数", "Jaccard"],
            "description": "给定字符串列表和布尔值 useJaccard。false 时按 Part 1 的最高字符频次占比选择占比最低的所有字符串；true 时按 Part 3 的多重集 Jaccard 平均相似度选择平均值最低的所有字符串。最后返回只出现在所选字符串组中的字符。",
            "input": "输入 JSON 对象：{\"strings\":[非空字符串...],\"useJaccard\":true或false}。本站限制：2≤字符串数≤80，单串长度≤1000，总长度≤10000；按 Unicode 码点处理。",
            "output": "输出 JSON 字符串。所选字符串按输入顺序拼接，内部按原字符顺序保留重复，只排除也出现在未选字符串中的字符。",
            "explanation": "Part 1/Part 3 分支逐字符串计算分数；用精确分数比较最低分及并列项，再过滤未选字符串中出现的字符。",
            "hints": ["Part 1 的比例为最高字符频次除以字符串长度。", "Part 3 的字符交并集按重复次数计数。", "平均分使用精确有理数比较。"],
            "timeLimit": 5, "memoryLimit": 262144, "outputLimit": 65536,
            "checker": "exact", "languages": ["python"],
        },
        "cases": cases,
    }
    schema_script = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    proc = subprocess.run(["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
                          input=json.dumps(package_raw, ensure_ascii=False), text=True,
                          capture_output=True, check=True)
    package = json.loads(proc.stdout)
    checksum = sha(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    manifest = {"schemaVersion": 1, "items": [{
        "id": PID, "sourceContentHash": ITEM["contentHash"], "packageChecksum": checksum,
        "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }]}
    reason = "固定快照 Part 2 明确继承 Part 1/3；Part 1 定义最低最高字符比例、并列全选与唯一字符输出，Part 3 明确重复字符参与 Jaccard 交并并以 baa/abbc=0.4 验证。三个源条目 Company 均为 Unknown，本站不推断公司。仅补 I/O、稳定输出顺序和资源边界；独立 oracle、穷举与两个 mutant 验证通过，仍待沙箱。"

    put(OA / "packages" / f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE)
    put(OA / "oracles" / f"{PID}.json", oracle_rows)
    put(OA / "mutants" / f"{PID}.json", mutants)
    put(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": package["problem"]["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": ITEM["sourceUrl"], "sourceContentHash": ITEM["contentHash"], "author": "CSWork",
    })
    put(OA / "candidate-batches/unknown-15-recovered.json", manifest)
    put(OA / "source-evidence/unknown-15-recovered.json", {
        "schemaVersion": 1, "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": COMMIT, "origin": "https://oamaster.com",
        "companyClassification": "Unknown in all three fixed source records; no company is inferred from URL slugs.",
        "items": {PID: {
            "url": ITEM["sourceUrl"], "contentHash": ITEM["contentHash"],
            "catalogContentHash": ITEM["contentHash"], "company": "Unknown", "title": ITEM["title"],
            "sourcePath": SOURCES[PID][0], "gitBlobSha": SOURCES[PID][1],
            "fixedSourceEvidence": "Part 2 links and explicitly inherits Part 1 and Part 3. Part 1 defines least maximum-character proportion, selecting all ties, and characters present only among selected strings. Part 2 switches to lowest average pairwise Jaccard when true and keeps Part 1 scoring when false. Part 3 defines intersection/union with repeats and confirms baa/abbc=0.4.",
            "dependencies": [{"id": sid, "url": ITEMS[sid]["sourceUrl"],
                              "catalogContentHash": ITEMS[sid]["contentHash"],
                              "sourcePath": SOURCES[sid][0], "gitBlobSha": SOURCES[sid][1],
                              "company": "Unknown"} for sid in ("oa-unknown-17", "oa-unknown-16")],
            "siteAddedContract": "JSON I/O, stable concatenation order (selected input order, then original character order, retaining repeats), non-empty strings, and finite input limits are site additions. The company remains Unknown.",
        }},
    })
    put(OA / "resolutions/unknown-15-recovered.json", {
        "schemaVersion": 1, "items": [{"id": PID, "batch": "unknown-15-recovered",
        "sourceContentHash": ITEM["contentHash"], "previousReason": prior["reason"], "reason": reason}],
    })
    put(OA / "validation/unknown-15-recovered.json", {
        "schemaVersion": 1, "seed": SEED, "problems": [{
            "id": PID, "oracleCases": len(oracle_rows), "uniqueOracleInputs": len({r["input"] for r in oracle_rows}),
            "referenceStdioCases": len(public) + len(random_cases), "publicCases": len(public),
            "hiddenCases": len(cases) - len(public), "exhaustiveInputs": exhaustive,
            "negativeControls": killed, "maxStrings": 80, "maxStringLength": 1000,
            "maxTotalLength": 10000, "referenceSha256": sha(REFERENCE), "localValidationOnly": True,
        }],
    })
    print(json.dumps({"id": PID, "candidateBatch": "unknown-15-recovered",
                      "statusBefore": state["status"], "oracleCases": len(oracle_rows),
                      "formalCases": len(cases), "exhaustiveInputs": exhaustive,
                      "negativeControls": killed, "seconds": round(time.perf_counter()-start, 3)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
