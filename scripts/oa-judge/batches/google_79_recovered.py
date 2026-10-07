"""Author and validate the recoverable, acyclic-input form of Google OA #79."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import re
import subprocess


ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-79"
BATCH = "google-79-recovered"
SEED = 20261007
SOURCE_URL = "https://oamaster.com/docs/companies/google#79-substitute-templates"
SUPPORT_URL = "https://oamaster.com/docs/companies/google#79-substitute-templates"
TOKEN = re.compile(r"%([A-Za-z][A-Za-z0-9_]*)%")
MAX_TEXT = 4096
MAX_OUTPUT = 1_048_576

REFERENCE = r'''import json, re, sys

TOKEN = re.compile(r"%([A-Za-z][A-Za-z0-9_]*)%")
MAX_TEXT = 4096
MAX_OUTPUT = 1_048_576

def solve(raw):
    data = json.loads(raw)
    if not isinstance(data, dict) or set(data) != {"substitutions", "template"}:
        raise ValueError("expected substitutions and template only")
    substitutions = data["substitutions"]
    template = data["template"]
    if not isinstance(substitutions, dict) or len(substitutions) > 100:
        raise ValueError("substitutions must be an object with at most 100 entries")
    if not isinstance(template, str) or len(template) > MAX_TEXT:
        raise ValueError("template exceeds the supported length")

    for key, value in substitutions.items():
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,31}", key):
            raise ValueError("invalid key")
        if (not isinstance(value, str) or len(value) > MAX_TEXT
                or any(not 32 <= ord(char) <= 126 for char in value)):
            raise ValueError("value exceeds the supported length")
    if any(not 32 <= ord(char) <= 126 for char in template):
        raise ValueError("template must contain printable ASCII only")

    visiting = set()
    resolved = {}
    def resolve_key(key):
        if key in resolved:
            return resolved[key]
        if key in visiting or key not in substitutions:
            raise ValueError("cyclic or missing reference")
        visiting.add(key)
        value = expand(substitutions[key])
        visiting.remove(key)
        resolved[key] = value
        return value

    def expand(text):
        out = []
        cursor = 0
        for match in TOKEN.finditer(text):
            literal = text[cursor:match.start()]
            if "%" in literal:
                raise ValueError("malformed placeholder")
            out.append(literal)
            out.append(resolve_key(match.group(1)))
            if sum(map(len, out)) > MAX_OUTPUT:
                raise ValueError("expanded output exceeds the supported limit")
            cursor = match.end()
        tail = text[cursor:]
        if "%" in tail:
            raise ValueError("malformed placeholder")
        out.append(tail)
        result = "".join(out)
        if len(result) > MAX_OUTPUT:
            raise ValueError("expanded output exceeds the supported limit")
        return result

    for key in substitutions:
        resolve_key(key)
    return json.dumps(expand(template), ensure_ascii=True)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    (
        "只替换模板中的直接引用，不递归展开替换值",
        r'''import json, re, sys
token=re.compile(r"%([A-Za-z][A-Za-z0-9_]*)%")
d=json.loads(sys.stdin.read()); s=d["substitutions"]
print(json.dumps(token.sub(lambda m:s[m.group(1)],d["template"])))
''',
    ),
    (
        "用贪婪百分号匹配吞掉多个占位符之间的文本",
        r'''import json, re, sys
d=json.loads(sys.stdin.read()); s=d["substitutions"]
print(json.dumps(re.sub(r"%(.*)%",lambda m:s.get(m.group(1),""),d["template"])))
''',
    ),
]


def encode(substitutions: dict[str, str], template: str) -> str:
    return json.dumps({"substitutions": substitutions, "template": template}, separators=(",", ":")) + "\n"


def oracle(substitutions: dict[str, str], template: str) -> str:
    """Expand via dependency ordering and a separate token substitution pass."""
    dependencies = {
        key: TOKEN.findall(value)
        for key, value in substitutions.items()
    }
    order: list[str] = []
    state: dict[str, int] = {}

    def visit(key: str) -> None:
        if state.get(key) == 1:
            raise ValueError("cycle")
        if state.get(key) == 2:
            return
        state[key] = 1
        for dependency in dependencies[key]:
            if dependency not in substitutions:
                raise ValueError("missing reference")
            visit(dependency)
        state[key] = 2
        order.append(key)

    for key in substitutions:
        visit(key)

    expanded: dict[str, str] = {}
    for key in order:
        expanded[key] = TOKEN.sub(lambda m: expanded[m.group(1)], substitutions[key])
        if len(expanded[key]) > MAX_OUTPUT:
            raise ValueError("expanded output exceeds supported limit")
    result = TOKEN.sub(lambda m: expanded[m.group(1)], template)
    if len(result) > MAX_OUTPUT:
        raise ValueError("expanded output exceeds supported limit")
    return json.dumps(result, ensure_ascii=True)


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


def make_large_case() -> tuple[dict[str, str], str]:
    substitutions = {"K0": '"'}
    for index in range(1, 21):
        previous = f"K{index - 1}"
        substitutions[f"K{index}"] = f"%{previous}%%{previous}%"
    return substitutions, "%K20%"


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    old_review = next(
        item for item in json.loads((OA / "reviews/google-tail.json").read_text(encoding="utf-8"))["items"]
        if item["id"] == PID
    )

    fixed = [
        ({"X": "123", "Y": "456", "Z": "abc"}, "%X%_%Y%"),
        ({"X": "123", "Y": "456", "Z": "abc%Y%"}, "%X%_%Y%_%Z%"),
        ({"A": "left", "B": "<%A%>", "C": "%B%/%A%"}, "%C%:%C%"),
        ({"EMPTY": "", "A": "ok"}, "[%EMPTY%]%A%%EMPTY%"),
        ({"A": "first second", "B": "[%A%]"}, "%B%!"),
        ({"A": 'quote " text'}, "[%A%]"),
        ({"K0": "seed", **{f"K{i}": f"%K{i-1}%" for i in range(1, 100)}}, "%K99%"),
    ]
    rng = random.Random(SEED)
    values = list(fixed)
    seen = {encode(substitutions, template) for substitutions, template in values}
    while len(values) < 121:
        count = rng.randint(2, 12)
        substitutions: dict[str, str] = {}
        for index in range(count):
            key = f"K{index}"
            pieces = [rng.choice(["a", "b", "_", " ", str(index)])]
            if index and rng.random() < 0.6:
                dependency = f"K{rng.randrange(index)}"
                pieces.insert(0, f"%{dependency}%")
            substitutions[key] = "".join(pieces)
        template = rng.choice(["%K0%_%K1%", "%K1%%K0%", "plain:%K0%", "%K0%/%K0%"])
        raw = encode(substitutions, template)
        if raw not in seen:
            seen.add(raw)
            values.append((substitutions, template))

    oracle_rows = []
    for substitutions, template in values:
        raw = encode(substitutions, template)
        expected = oracle(substitutions, template)
        assert run(REFERENCE, raw) == expected
        oracle_rows.append({"input": raw, "expectedOutput": expected + "\n"})

    formal_values = values[:33]
    cases = []
    for index, (substitutions, template) in enumerate(formal_values):
        cases.append({
            "name": "示例 1" if index == 0 else "示例 2" if index == 1 else f"隐藏用例 {index}",
            "input": encode(substitutions, template),
            "expectedOutput": oracle(substitutions, template) + "\n",
            "hidden": index >= 2,
            "weight": 1,
        })

    large_substitutions, large_template = make_large_case()
    large_input = encode(large_substitutions, large_template)
    large_expected = oracle(large_substitutions, large_template)
    assert len(json.loads(large_expected)) == MAX_OUTPUT
    assert len(large_expected.encode()) + 1 <= 4096 * 1024
    assert run(REFERENCE, large_input) == large_expected
    cases.append({
        "name": "最大展开长度",
        "input": large_input,
        "expectedOutput": large_expected + "\n",
        "hidden": True,
        "weight": 1,
    })

    killed = []
    mutant_docs = []
    for name, program in MUTANTS:
        rejects = [index for index, case in enumerate(cases)
                   if run(program, case["input"]) != case["expectedOutput"].strip()]
        assert rejects, f"surviving mutant: {name}"
        killed.append({"name": name, "rejectedByCases": rejects})
        mutant_docs.append({"name": name, "code": program})

    additions = (
        "本站补充有效输入边界：键为 1–32 位英文字母/数字/下划线且以字母开头；最多 100 个键；"
        "模板和值仅含可打印 ASCII 且最长 4096 字符；所有占位符必须成对、引用必须存在、引用图必须无环；"
        "每个映射值的递归展开结果及最终输出都最多 1,048,576 个可打印 ASCII 字符。上述是本站支持范围，不归因于原题。"
    )
    description = (
        "给定 substitutions 映射和 template 字符串。每个 `%KEY%` 替换为映射中 KEY 对应的字符串；"
        "替换值中仍可包含占位符，并继续递归展开。输出最终字符串。\n\n"
        + additions + "\n\n"
        + f"原题来源：{SOURCE_URL}（固定快照内容指纹 {source['contentHash']}）。"
    )
    problem = {
        "id": PID,
        "courseId": "gomall",
        "lessonId": "00-overview",
        "title": "模板递归替换",
        "difficulty": "中等",
        "tags": ["OA", "Google", "字符串", "递归", "图"],
        "description": description,
        "input": "输入一行 JSON 对象，且只能有 `substitutions` 和 `template` 两个字段；`substitutions` 是键和值均为字符串的对象，`template` 是字符串。",
        "output": "输出 JSON 字符串，内容为递归替换后的结果。",
        "explanation": "把每个占位符看作对映射值的引用；递归解析引用值后再拼回模板。引用图必须无环，且每个映射值的展开结果和最终输出均不超过本站上限。",
        "hints": ["先扫描成对的 `%KEY%`。", "替换值里可能继续出现其他键；用 DFS 解析并记录当前访问路径。"],
        "timeLimit": 3,
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
    package = json.loads(subprocess.run(
        ["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
        input=json.dumps(package_input, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    ).stdout)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
    editorial = f"""## 思路

扫描模板中的 `%KEY%`，将键对应的值继续递归解析后拼接。用 DFS 记录访问中的键，检测循环；已完成的键可以缓存。

## 正确性

对无环引用图按依赖顺序归纳：没有引用的值保持原样；若某值引用的键都已正确展开，则将每个 `%KEY%` 替换为对应展开值，所得字符串正是该值的递归展开。将同样过程用于主模板，得到题目要求的最终字符串。

## 复杂度

设输入长度为 S、被解析的展开文本总长度为 L。时间 O(S+L)，空间 O(L)；每个映射值的展开结果和最终输出均受本站 1,048,576 字符上限约束。

## 来源与本站约定

固定 OAMaster 快照明确递归展开替换值，并包含两个原始例子；Python、Java、C++ 三份实现一致。原题没有约束循环、缺失键、字面百分号及输入大小，因此本站只接收格式正确、所有引用存在、引用图无环且每个映射值和最终展开均不超过上限的输入；这些有效输入约束是本站补充。标准输入输出协议同样是本站补充。
"""
    manifest = {"schemaVersion": 1, "items": [{
        "id": PID, "sourceContentHash": source["contentHash"],
        "packageChecksum": sha(package_bytes), "editorial": editorial,
        "authoredSolutions": [{"language": "python", "code": REFERENCE}],
    }]}
    manifest_folder = "batches" if (OA / "reports" / f"{BATCH}.json").exists() else "candidate-batches"
    put(manifest_folder, f"{BATCH}.json", manifest)
    if manifest_folder == "batches":
        (OA / "candidate-batches" / f"{BATCH}.json").unlink(missing_ok=True)
    put("packages", f"{PID}.json", package)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE, encoding="utf-8")
    put("editorials", f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": problem["title"],
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": source["contentHash"],
    })
    put("oracles", f"{PID}.json", oracle_rows)
    put("mutants", f"{PID}.json", mutant_docs)
    put("source-evidence", f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": "e66f809f4c953bce129f68491726176615db6afc",
        "catalogContentHash": source["contentHash"],
        "items": [{
            "id": PID, "company": "Google", "title": source["title"],
            "sourceUrl": SOURCE_URL, "previousStatus": old_review["status"],
            "previousReason": old_review["reason"],
            "fixedSource": {"path": "web/content/docs/companies/google.mdx",
                            "evidence": "固定快照的题面和三个语言实现均明确 `%KEY%` 替换及递归展开；两个样例原样保留。"},
            "supportingSources": [],
            "siteAdditions": ["JSON stdin/stdout 协议", "输入键/字符串大小上限", "拒收循环与缺失引用", "展开长度上限"],
            "interpretation": "按快照三语言实现采用最近配对的 `%KEY%` 并递归解析值；仅允许格式有效、引用存在、无环且展开有界的输入。",
        }],
    })
    report_path = OA / "reports" / f"{BATCH}.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else None
    report_problem = report["problems"][0] if report and report.get("problems") else {}
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    report_valid = bool(
        report and report.get("allPassed") and report.get("batchSha256") == sha(manifest_bytes)
        and report_problem.get("formal") == len(cases)
        and report_problem.get("oracle") == len(oracle_rows)
        and report_problem.get("passed") == len(cases) + len(oracle_rows)
    )
    if report_valid:
        evidence = {"status": "authored", "verification": f"用户自有 GoJudge 全部通过 {report_problem['passed']} 项（{report_problem['formal']} formal + {report_problem['oracle']} oracle），两个 mutant 均被击杀。"}
        reason = f"固定 OAMaster 快照的题面、两道原样例和三语实现共同明确递归替换规则；循环、缺失引用及大小限制只作为本站有效输入约束。121 个唯一 oracle、{report_problem['formal']} 个正式用例及两个 mutant 均通过用户自有 GoJudge。"
        note = evidence["verification"]
    else:
        evidence = {}
        reason = "固定 OAMaster 快照的题面、两道原样例和三语实现共同明确递归替换规则；循环、缺失引用及大小限制只作为本站有效输入约束。121 个唯一 oracle、正式用例及两个 mutant 已离线验证；待用户自有 GoJudge 验收。"
        note = "仅完成本地独立 oracle、原样例/边界及错误实现验证；尚未连接 GoJudge。"
    evidence_path = OA / "source-evidence" / f"{BATCH}.json"
    evidence_document = json.loads(evidence_path.read_text(encoding="utf-8"))
    if report_valid:
        evidence_document["items"][0].update(evidence)
    put("source-evidence", f"{BATCH}.json", evidence_document)
    put("resolutions", f"{BATCH}.json", {"schemaVersion": 1, "items": [{
        "id": PID, "batch": BATCH, "sourceContentHash": source["contentHash"],
        "previousReason": old_review["reason"], "reason": reason,
    }]})
    put("validation", f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_rows),
                      "uniqueOracleInputs": len({row["input"] for row in oracle_rows}),
                      "publicCases": 2, "hiddenCases": len(cases) - 2,
                      "negativeControls": killed, "referenceSha256": sha(REFERENCE.encode())}],
        "note": note,
    })
    print(json.dumps({"id": PID, "batch": BATCH, "oracle": len(oracle_rows),
                      "formal": len(cases), "mutantsKilled": len(killed)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
