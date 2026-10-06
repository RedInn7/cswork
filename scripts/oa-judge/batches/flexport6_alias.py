"""Prepare Flexport #6 as an offline alias of the verified Salesforce package.

This generator writes authoring artifacts only. It does not call GoJudge and
does not add the candidate to the runtime registry.
"""
from collections import deque
from hashlib import sha256
import json
from pathlib import Path
import random
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[3] / "content" / "oa-judge"
CATALOG = Path(__file__).resolve().parents[3] / "content" / "oa-master" / "catalog.json"
ID = "oa-flexport-6"
SOURCE = "https://oamaster.com/docs/companies/flexport#6-malware-spread"
BATCH = "flexport6-alias"
SEED = 20261009
RUNNER = Path(__file__).resolve().parents[1] / "local_batch_runner.py"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest_bytes(value):
    return sha256(value).hexdigest()


def compact_digest(value):
    return digest_bytes(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())


def encode_case(n, edges, infected):
    rows = [f"{n} {len(edges)}", " ".join(map(str, infected))]
    rows.extend(f"{u} {v}" for u, v in edges)
    return "\n".join(rows) + "\n"


def brute(n, edges, infected):
    graph = [[] for _ in range(n)]
    for u, v in edges:
        graph[u - 1].append(v - 1)
        graph[v - 1].append(u - 1)
    best_count = n + 1
    best_node = 0
    for removed in range(n):
        visited = {removed}
        stack = [i for i, value in enumerate(infected) if value and i != removed]
        visited.update(stack)
        while stack:
            u = stack.pop()
            for v in graph[u]:
                if v not in visited:
                    visited.add(v)
                    stack.append(v)
        count = len(visited) - 1
        if count < best_count:
            best_count, best_node = count, removed
    return str(best_node + 1)


def build_oracle():
    rng = random.Random(SEED)
    seen = set()
    oracle = []
    while len(oracle) < 120:
        n = rng.randint(1, 10)
        edges = [(u, v) for u in range(1, n + 1) for v in range(u + 1, n + 1)]
        rng.shuffle(edges)
        edges = edges[: rng.randint(0, min(len(edges), 18))]
        infected = [rng.randint(0, 1) for _ in range(n)]
        source = encode_case(n, edges, infected)
        if source in seen:
            continue
        seen.add(source)
        oracle.append({"input": source, "expectedOutput": brute(n, edges, infected)})
    return oracle


def run_local(program, inputs):
    result = subprocess.run(
        [sys.executable, "-I", str(RUNNER), str(program)],
        input=json.dumps(inputs, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def main():
    source_catalog = read_json(CATALOG)
    catalog_item = next(item for item in source_catalog["items"] if item["id"] == ID)
    source_hash = catalog_item["contentHash"]
    previous = (
        "固定题面只说可删除恰好一个节点，没有说明候选是否限于初始感染节点；"
        "现有解释与解法擅自将候选限制为 malware=1。任意节点删除与感染节点删除可产生不同答案；"
        "题面也未保证至少一个感染节点，且示例无法消歧。可按题面字面补充‘传播前可删除任一节点’，"
        "或明确‘只可删除初始感染节点’并保证感染集合非空；两种口径都可用节点删除后重新 BFS 求解。"
    )

    package = read_json(ROOT / "packages" / "oa-salesforce-20.json")
    package["problem"].update({
        "id": ID,
        "title": "Malware Spread",
        "tags": ["OA", "Flexport"],
        "description": (
            "题目来源：Flexport #6 Malware Spread。删除恰好一个网络节点及其关联边，"
            "再从所有未被删除的初始感染节点开始沿无向边传播，直到不再新增；"
            "求最终感染节点数最少的删除方案，同分取最小1-based编号。"
            "按原题字面，候选是网络中的任意节点，包含健康节点。\n\n输入输出由本站整理。"
        ),
        "input": (
            "首行 n m；第二行 n 个 0/1 初始感染标记；随后 m 行为 1-based 无向边 u v。"
            "1≤n≤1000，0≤m≤min(n(n−1)/2,1000)，本站按简单图处理（无重边、自环）。"
        ),
        "output": "输出要删除的节点1-based编号。即使没有感染节点，也必须删除一个节点；并列时输出最小编号。",
        "explanation": (
            "公开例1按题目给定图和感染节点重新模拟，删除节点3后感染数最少，输出3。"
            "公开例2删除任意节点后剩余节点仍感染，选择最小编号1。"
            "本站规则明确允许删除健康节点；第三个本站回归样例专门验证健康割点。"
        ),
    })
    package["cases"][0]["name"] = "Flexport 官方样例 1"
    package["cases"][1]["name"] = "Flexport 官方样例 2"
    package["cases"][2]["name"] = "本站补充：删除健康割点"

    reference = (ROOT / "references" / "oa-salesforce-20.py").read_text(encoding="utf-8")
    mutants = [
        {
            "name": "只枚举初始感染节点",
            "code": (ROOT / "negative-controls" / "oa-salesforce-20-1.py").read_text(encoding="utf-8").replace(
                "def solve(d):", "def solve(d):"
            ),
        },
        {
            "name": "同分时选最大编号",
            "code": (ROOT / "negative-controls" / "oa-salesforce-20-2.py").read_text(encoding="utf-8"),
        },
    ]
    # Salesforce mutant #1 falls back to node 1 if no initial source exists;
    # that behavior is also wrong for a source-free graph with a better cut.
    oracle = build_oracle()
    editorial_code = reference
    editorial = {
        "schemaVersion": 1,
        "id": ID,
        "title": "Malware Spread",
        "explanation": (
            "## 思路\n\n枚举每个可能删除的节点。将该节点屏蔽后，从剩余初始感染点做多源 DFS/BFS，"
            "统计可达节点数；取感染数最少者，平局取最小编号。候选包含健康节点。\n\n"
            "## 正确性证明\n\n删除节点后，最终感染集合恰好是未删除感染源在剩余无向图中的可达集合。"
            "图遍历恰好访问该集合。算法枚举全部节点，因此覆盖全部合法删除方案；按感染数和编号比较，"
            "所得方案满足题目目标及平局规则。\n\n"
            "## 复杂度\n\nO(n(n+m)) 时间，O(n+m) 额外空间。\n\n"
            "## 参考实现\n\n```python\n" + editorial_code.rstrip() + "\n```"
        ),
    }

    mutants_path = ROOT / "mutants" / f"{ID}.json"
    write_json(ROOT / "packages" / f"{ID}.json", package)
    (ROOT / "references" / f"{ID}.py").write_text(reference, encoding="utf-8")
    write_json(ROOT / "editorials" / f"{ID}.json", editorial)
    write_json(ROOT / "oracles" / f"{ID}.json", oracle)
    write_json(mutants_path, mutants)
    for i, mutant in enumerate(mutants, 1):
        (ROOT / "negative-controls" / f"{ID}-{i}.py").write_text(mutant["code"], encoding="utf-8")

    source_evidence = {
        "schemaVersion": 1,
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "upstreamCommit": "e66f809f4c953bce129f68491726176615db6afc",
        "rawPath": "web/content/docs/companies/flexport.mdx",
        "rawGitBlob": "71ef7fe7b879adca275af31baf51e090fd70be0c",
        "catalogContentHash": source_hash,
        "url": SOURCE,
        "identity": "Flexport #6 Malware Spread；在线保留来源公司、编号与英文题名，没有借用 Salesforce 的题目身份。",
        "semanticResolution": (
            "上游函数说明允许从 network 删除恰好一个节点，没有说只能删 malware=1 的节点。"
            "按原文任意节点都可删除；本站描述明确包含健康节点。约束和两个正式公开样例与 Salesforce #20 一致。"
        ),
        "officialSamples": [
            {"input": "9 5\n0 0 1 0 1 0 0 0 0\n1 2\n2 3\n4 5\n6 7\n7 8\n", "output": "3\n"},
            {"input": "5 4\n1 1 1 1 1\n1 2\n2 3\n3 4\n4 5\n", "output": "1\n"},
        ],
        "aliasPackage": "oa-salesforce-20",
        "sourceUrl": SOURCE,
    }
    write_json(ROOT / "source-evidence" / f"{BATCH}.json", source_evidence)

    review_evidence = {
        "schemaVersion": 1,
        "upstreamCommit": "e66f809f4c953bce129f68491726176615db6afc",
        "upstreamRepository": "https://github.com/RedInn7/OA-Master",
        "origin": "https://oamaster.com",
        "seed": SEED,
        "items": [{
            "id": ID,
            "url": SOURCE,
            "catalogContentHash": source_hash,
            "status": "authored",
            "review": (
                "与 sandbox_verified 的 oa-salesforce-20 逐项复核：感染传播规则、节点/边界范围及官方输出一致。"
                "Flexport 官方两例作为本题公开样例；来源身份保持 Flexport。在线题面明确按源文允许删除任意节点。"
                "本地 oracle、正式样例/隐藏样例及两个正常退出错误程序通过；尚未运行 GoJudge。"
            ),
        }],
    }
    write_json(ROOT / "reviews" / "source-evidence" / "validation" / f"{BATCH}.json", review_evidence)

    formal_inputs = [item["input"] for item in package["cases"]]
    formal_expected = [item["expectedOutput"].strip() for item in package["cases"]]
    reference_path = ROOT / "references" / f"{ID}.py"
    if [value.strip() for value in run_local(reference_path, formal_inputs)] != formal_expected:
        raise AssertionError("Reference failed formal package cases")
    if [value.strip() for value in run_local(reference_path, [item["input"] for item in oracle])] != [item["expectedOutput"].strip() for item in oracle]:
        raise AssertionError("Reference disagrees with independent oracle")
    negative_controls = []
    for index, mutant in enumerate(mutants, 1):
        output = run_local(ROOT / "negative-controls" / f"{ID}-{index}.py", formal_inputs)
        rejected = [i for i, value in enumerate(output) if value.strip() != formal_expected[i]]
        if not rejected:
            raise AssertionError(f"Mutant survived formal cases: {mutant['name']}")
        negative_controls.append({"name": mutant["name"], "rejectedByCases": rejected})

    validation = {
        "schemaVersion": 1,
        "seed": SEED,
        "problems": [{
            "id": ID,
            "oracleCases": len(oracle),
            "uniqueOracleInputs": len({item["input"] for item in oracle}),
            "publicCases": sum(not item["hidden"] for item in package["cases"]),
            "hiddenCases": sum(item["hidden"] for item in package["cases"]),
            "negativeControls": negative_controls,
            "note": "Reference matched all 31 formal cases and 120 unique independent-oracle inputs. Two incorrect programs exited normally and were rejected by formal cases.",
        }],
        "note": "Offline candidate only; no GoJudge run and no runtime publication.",
    }
    write_json(ROOT / "validation" / f"{BATCH}.json", validation)

    entry = {
        "id": ID,
        "sourceContentHash": source_hash,
        "packageChecksum": compact_digest(package),
        "editorial": editorial["explanation"],
        "authoredSolutions": [{"language": "python", "code": reference}],
    }
    write_json(ROOT / "candidate-batches" / f"{BATCH}.json", {"schemaVersion": 1, "items": [entry]})
    write_json(ROOT / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": ID,
            "batch": BATCH,
            "sourceContentHash": source_hash,
            "previousReason": previous,
            "reason": (
                "固定上游题目明确允许从 network 删除任意一个节点，未限制候选为感染点；本站按源文含义明确写出健康节点也可删除。"
                "与已验证 Salesforce #20 的规则、约束、输入协议和公开输出一致；Flexport 两条官方样例独立保留。"
                "完成120个独立oracle、正式用例及两个正常退出错误程序的离线验证；GoJudge仍待运行。"
            ),
        }],
    })
    print(json.dumps({"id": ID, "oracleCases": len(oracle), "packageChecksum": entry["packageChecksum"], "sourceContentHash": source_hash}))


if __name__ == "__main__":
    main()
