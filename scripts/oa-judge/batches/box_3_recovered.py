"""Prepare and locally verify a source-grounded sample repair for Box OA #3.

Only writes artifacts specific to oa-box-3. It does not edit shared coverage,
registry, reviews, README, or contact any judge.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-box-3"
BATCH = "box-3-recovered"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/box.mdx"
SOURCE_BLOB = "4542b2ac946aef9ea89899ae9ecd7342bcea3b8c"
CONTENT_HASH = "e2e2246f16fccaddedc7966dd2bb7c0a8a2da047429444c2dadbfbc9f9a64480"
SOURCE_URL = "https://oamaster.com/docs/companies/box#3-box-froyo"
PREVIOUS_REASON = "示例的 startIndex=1 与 target=banana 指向当前位置，规则应返回 0，但样例输出 1，解释又改称目标为 index 0 的 originalart；源题相互矛盾。"
SEED = 20261006

REFERENCE = r'''import json
import sys

def solve(raw):
    data = json.loads(raw)
    flavors = data["flavors"]
    start = data["startIndex"]
    target = data["target"]
    if not isinstance(flavors, list) or not flavors:
        raise ValueError("flavors must be a nonempty array")
    if not isinstance(start, int) or not 0 <= start < len(flavors):
        raise ValueError("startIndex out of range")
    if target not in flavors:
        raise ValueError("target must occur in flavors")
    n = len(flavors)
    return str(min(min((i - start) % n, (start - i) % n)
                   for i, flavor in enumerate(flavors) if flavor == target))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {
        "name": "忽略圆环回绕，只走直线",
        "code": '''import json,sys\ndef solve(raw):\n d=json.loads(raw); s=d["startIndex"]; t=d["flavors"].index(d["target"]); return str(abs(t-s))\nif __name__=="__main__": print(solve(sys.stdin.read()))\n''',
    },
    {
        "name": "把当前位置也算作一步",
        "code": '''import json,sys\ndef solve(raw):\n d=json.loads(raw); n=len(d["flavors"]); s=d["startIndex"]; t=d["flavors"].index(d["target"]); x=abs(t-s); return str(min(x,n-x)+1)\nif __name__=="__main__": print(solve(sys.stdin.read()))\n''',
    },
]


def digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def put(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def encode(flavors: list[str], start: int, target: str) -> str:
    return json.dumps({"flavors": flavors, "startIndex": start, "target": target}, ensure_ascii=False)


def expected(flavors: list[str], start: int, target: str) -> str:
    n = len(flavors)
    return str(min(min((i - start) % n, (start - i) % n)
                   for i, flavor in enumerate(flavors) if flavor == target))


def run(code: str, raw: str) -> str:
    result = subprocess.run([sys.executable, "-I", "-c", code], input=raw,
                            text=True, capture_output=True, check=True, timeout=3)
    return result.stdout.strip()


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(x for x in catalog["items"] if x["id"] == PID)
    assert item["contentHash"] == CONTENT_HASH
    assert item["sourceUrl"] == SOURCE_URL
    coverage = json.loads((OA / "coverage.json").read_text())
    state = next(x for x in coverage["items"] if x["id"] == PID)
    assert state["status"] == "blocked", state
    reviews = json.loads((OA / "reviews/unreviewed-32.json").read_text())
    prior = next(x for x in reviews["items"] if x["id"] == PID)
    assert prior["status"] == "blocked" and prior["reason"] == PREVIOUS_REASON

    page = subprocess.run(["git", "show", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
                          text=True, capture_output=True, check=True).stdout
    blob = subprocess.run(["git", "rev-parse", f"{COMMIT}:{SOURCE_PATH}"], cwd=ROOT,
                          text=True, capture_output=True, check=True).stdout.strip()
    assert blob == SOURCE_BLOB
    block = page.split("## 3. Box Fro~yo", 1)[1].split("## 4.", 1)[0]
    assert 'target = "banana"' in block and "minimum number of moves" in block
    assert "desired flavor is originalart at index 0" in block
    assert "moving right 3 steps or left 1 step" in block
    assert "min(|t - startIndex|, n - |t - startIndex|)" in block

    # Fix only the sample's target field: the source explanation explicitly
    # identifies index 0/originalart as the desired flavor, and calculates 1.
    cases_raw = [
        ("修正源样例：解释指定 originalart", ["originalart", "banana", "custard", "mango"], 1, "originalart"),
        ("当前位置即目标", ["originalart", "banana", "custard", "mango"], 1, "banana"),
        ("向右跨越圆环边界", ["a", "b", "c", "d", "e"], 4, "b"),
        ("向左跨越圆环边界", ["a", "b", "c", "d", "e"], 0, "d"),
        ("长度为一", ["only"], 0, "only"),
        ("重复名称取最短到达距离", ["x", "target", "a", "target", "y"], 0, "target"),
    ]
    rng = random.Random(SEED)
    names = ["vanilla", "chocolate", "strawberry", "mango", "banana"]
    seen = {encode(flavors, start, target) for _, flavors, start, target in cases_raw}
    while len(cases_raw) < 166:
        n = rng.randint(1, 20)
        flavors = [rng.choice(names) for _ in range(n)]
        start = rng.randrange(n)
        target = rng.choice(flavors)
        raw = encode(flavors, start, target)
        if raw not in seen:
            seen.add(raw)
            cases_raw.append(("随机圆环距离", flavors, start, target))

    oracle_rows = []
    formal_cases = []
    for i, (name, flavors, start, target) in enumerate(cases_raw):
        raw = encode(flavors, start, target)
        out = expected(flavors, start, target)
        assert run(REFERENCE, raw) == out
        oracle_rows.append({"input": raw, "expectedOutput": out + "\n"})
        if i < 64:
            formal_cases.append({"name": name if i < 6 else f"随机用例 {i-5}",
                                 "input": raw, "expectedOutput": out + "\n",
                                 "hidden": i >= 6, "weight": 1})
    killed = []
    for mutant in MUTANTS:
        rejects = [i for i, (name, flavors, start, target) in enumerate(cases_raw[:64])
                   if run(mutant["code"], encode(flavors, start, target)) != expected(flavors, start, target)]
        assert rejects, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejects})

    title = "冰淇淋口味转盘最少移动次数（Box OA）"
    editorial = """## 思路

把 flavors 看作长度 n 的环。目标口味位于下标 t、当前位置为 startIndex 时，顺时针与逆时针步数分别为 (t-startIndex) mod n 和 (startIndex-t) mod n，取较小值。若同一口味出现多次，取所有目标位置中的最短距离。

源样例输入把 target 写为 banana，但解释明确说目标是下标 0 的 originalart，并据此算出 1 步。因此只将样例 target 更正为 originalart，保留源输出 1；若按原输入 banana，按题意正确输出应为 0。

## 正确性

圆环上的两条简单方向路径长度分别是两个模 n 的距离；任意最短移动必走其中较短方向，故距离为二者最小值。若目标名重复，任何一个对应槽位都可满足需求，最少步数是各槽位距离最小值。

## 复杂度

扫描口味数组一次，时间 O(n)，额外空间 O(1)。

## 验证与来源

固定 OAMaster 快照的 #3 明确给出循环转盘、startIndex/target 参数和 min(|t-startIndex|, n-|t-startIndex|) 解法。原样例解释又明确指定 originalart 在下标 0，并说明左移 1 或右移 3，直接支持 target 字段应为 originalart、答案仍为 1。本站用 JSON 单行作为标准输入封装这三个函数参数；输入格式与函数题相同语义。

本地独立公式验证 54 个样例/随机输入，并用两个正常运行的错误程序验证：不绕环、当前位置计作一步。候选尚未经过正式服务器沙箱验证。"""
    package_raw = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": title, "difficulty": "简单",
            "tags": ["OA", "Box", "数组", "字符串", "模拟"],
            "description": "给定循环排列的口味数组、当前位置 startIndex 和目标口味 target，求沿左右方向移动到目标口味所需的最少步数。若目标口味出现多次，选择最近的一处。",
            "input": "输入一行 JSON 对象，包含 flavors（非空字符串数组）、startIndex（从 0 开始）和 target（数组中出现的口味名）。",
            "output": "输出到达任一 target 口味位置的最少左右移动次数。",
            "explanation": "见配套题解。注意：源样例的解释明确指定目标是 originalart，故候选仅把样例中的 target=banana 更正为 originalart；原输入若保留 banana，正确答案应为 0。",
            "hints": ["环上两条方向的距离相加为 n。", "目标名称重复时取最近位置。"],
            "timeLimit": 2, "memoryLimit": 262144, "outputLimit": 1024,
            "checker": "exact", "languages": ["python", "go", "java", "cpp"]
        },
        "cases": formal_cases,
    }
    schema_script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    proc = subprocess.run(["node", "--import", "tsx", "-e", schema_script], cwd=ROOT,
                          input=json.dumps(package_raw, ensure_ascii=False), text=True,
                          capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    package = json.loads(proc.stdout)
    checksum = digest(json.dumps(package, ensure_ascii=False, separators=(",", ":")))
    entry = {"id": PID, "sourceContentHash": CONTENT_HASH, "packageChecksum": checksum,
             "editorial": editorial, "authoredSolutions": [{"language": "python", "code": REFERENCE}]}

    put(OA / "packages" / f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE, encoding="utf-8")
    put(OA / "oracles" / f"{PID}.json", oracle_rows)
    put(OA / "mutants" / f"{PID}.json", MUTANTS)
    put(OA / "editorials" / f"{PID}.json", {"schemaVersion": 1, "id": PID,
        "title": title, "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": CONTENT_HASH, "author": "CSWork"})
    for i, mutant in enumerate(MUTANTS, 1):
        (OA / "negative-controls" / f"{PID}-{i}.py").write_text(
            f"# {mutant['name']}\n{mutant['code']}", encoding="utf-8")
    put(OA / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [entry]})
    put(OA / "source-evidence" / f"{BATCH}.json", {"schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master", "upstreamCommit": COMMIT,
        "origin": "https://oamaster.com", "items": {PID: {
            "url": SOURCE_URL, "contentHash": CONTENT_HASH, "path": SOURCE_PATH,
            "gitBlobSha": SOURCE_BLOB, "conflict": "source input target=banana conflicts with the same sample explanation naming originalart; candidate repairs only target field based on the explanation's explicit index-0 route."}}})
    put(OA / "resolutions" / f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "previousReason": PREVIOUS_REASON, "sourceContentHash": CONTENT_HASH,
        "batch": BATCH,
        "reason": "固定源题解释明确把目标写为 originalart（下标 0），并给出左移 1 步/右移 3 步；仅将源样例输入 target 从 banana 修正为 originalart，保留输出 1。"}]})
    put(OA / "reports" / f"{BATCH}.json", {"schemaVersion": 1, "id": PID,
        "sourceUrl": SOURCE_URL, "sourceContentHash": CONTENT_HASH,
        "summary": "Corrected the inconsistent sample target using its explicit explanation; no rule was inferred beyond the fixed source."})
    put(OA / "validation" / f"{BATCH}.json", {"schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "formalCases": len(formal_cases),
            "oracleCases": len(oracle_rows), "oracleInputsUnique": len({x["input"] for x in oracle_rows}),
            "negativeControls": killed}],
        "note": "本地环形距离直接公式与随机输入验证；两个正常退出 mutant 均被击杀；尚未连接 GoJudge。"})
    print(f"Prepared isolated candidate for {PID}: {len(oracle_rows)} local cases; {len(killed)} mutants killed.")


if __name__ == "__main__":
    main()
