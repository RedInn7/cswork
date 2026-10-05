"""Author IBM #55 and Capital One #15 as offline-only OA candidates.

The upstream OA-Master snapshot is pinned by content/oa-master/catalog.json.
Nothing in this script reads or modifies the runtime registry or GoJudge.
"""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SEED = 20261005


def run(path, data):
    proc = subprocess.run([sys.executable, "-I", str(path)], input=data, text=True,
                          capture_output=True, timeout=8, check=True)
    return proc.stdout.rstrip("\n")


def chair_encode(simulations):
    return str(len(simulations)) + "\n" + "\n".join(simulations) + "\n"


def chair_oracle(simulations):
    result = []
    for simulation in simulations:
        chairs = occupied = away = 0
        for event in simulation:
            if event == "C":
                if occupied == chairs:
                    chairs += 1
                occupied += 1
            elif event == "R":
                occupied -= 1
                away += 1
            elif event == "U":
                away -= 1
                if occupied == chairs:
                    chairs += 1
                occupied += 1
            else:  # L: an in-room employee leaves permanently.
                occupied -= 1
        result.append(str(chairs))
    return " ".join(result)


def random_simulation(rng, length):
    inside = away = 0
    events = []
    for _ in range(length):
        choices = ["C"]
        if inside:
            choices += ["R", "L"]
        if away:
            choices.append("U")
        event = rng.choice(choices)
        events.append(event)
        if event == "C":
            inside += 1
        elif event == "R":
            inside -= 1
            away += 1
        elif event == "U":
            away -= 1
            inside += 1
        else:
            inside -= 1
    return "".join(events)


def walls_encode(case):
    n, operations = case
    return f"{n} {len(operations)}\n" + "".join(
        f"build {op[1]}\n" if op[0] == "build" else f"query {op[1]} {op[2]}\n"
        for op in operations
    )


def walls_oracle(case):
    _, operations = case
    walls, output = set(), []
    for op in operations:
        if op[0] == "build":
            walls.add(op[1])
        else:
            output.append("1" if any(i in walls for i in range(op[1], op[2] + 1)) else "0")
    return " ".join(output)


def random_walls(rng):
    n = rng.randint(1, 35)
    operations = []
    for _ in range(rng.randint(1, 60)):
        if rng.random() < 0.48:
            operations.append(("build", rng.randrange(n)))
        else:
            left = rng.randrange(n)
            right = rng.randrange(left, n)
            operations.append(("query", left, right))
    if not any(op[0] == "query" for op in operations):
        operations.append(("query", 0, n - 1))
    return n, operations


SPECS = [
    {
        "id": "oa-ibm-55",
        "title": "Chairs Requirement",
        "tags": ["数组", "模拟"],
        "description": (
            "给定多条员工进出模拟，求每条模拟最少需要购买多少把椅子。初始没有椅子，员工总是先使用空椅；没有空椅时购买一把。"
            "C 表示新员工进入，R 表示员工暂时去会议室，U 表示员工从会议室回来，L 表示员工永久离开。"
            "本站补充：每条模拟都是合法事件序列；R/L 执行时至少有一名员工在室内，U 执行时至少有一名员工在会议室。"
            "不区分员工身份，只需遵守上述人数状态。"
        ),
        "input": "第一行 n；接下来 n 行各给一个仅含 C、R、U、L 的模拟字符串。1≤n≤100，1≤每条长度≤10000。",
        "output": "按输入顺序输出 n 个整数，以空格分隔，每个整数为该模拟至少要购买的椅子数。",
        "oracle": chair_oracle,
        "encode": chair_encode,
        "samples": [["C"], ["CCCRLCC"], ["CCRRCRUU"]],
        "random": lambda rng: [random_simulation(rng, rng.randint(1, 80))
                               for _ in range(rng.randint(1, 8))],
        "reference": """import sys
def solve(raw):
 lines=raw.splitlines(); n=int(lines[0]); answers=[]
 for simulation in lines[1:1+n]:
  inside=best=0
  for event in simulation:
   if event in 'CU': inside+=1
   else: inside-=1
   best=max(best,inside)
  answers.append(str(best))
 return ' '.join(answers)
if __name__ == '__main__':
 print(solve(sys.stdin.read()))
""",
        "mutants": [
            ("员工永久离开时没有释放椅子", "else: inside-=1", "elif event=='R': inside-=1"),
            ("会议室员工返回时没有占用椅子", "if event in 'CU': inside+=1", "if event=='C': inside+=1"),
        ],
        "public": ["1", "3", "3"],
        "editorial": "## 思路\n\n模拟室内员工数，C 和 U 使人数加一，R 和 L 使人数减一。答案是整个过程中室内人数的最大值；每次进入时若没有空椅，恰好需要再买一把。\n\n## 正确性\n\n任一时刻室内员工都必须各有一把椅子，因此椅子数至少为室内人数最大值。按规则复用空椅，并在进入时人数达到已购椅子数才购买，购买后椅子数始终等于截至当前的室内人数最大值。结束时购买数正好达到该下界。合法事件序列保证每次离开或返回都对应已有员工，状态唯一。\n\n## 复杂度\n\n设所有模拟字符总数为 L，时间 O(L)，额外空间 O(1)。",
    },
    {
        "id": "oa-capital-one-15",
        "title": "Dynamic Wall Building and Range Query",
        "tags": ["数据结构", "Fenwick树"],
        "description": (
            "在下标为 0 至 n−1 的一维位置上动态建墙。初始没有墙。build i 在位置 i 建墙，重复建墙不改变状态；"
            "query l r 查询闭区间 [l,r] 是否至少有一堵墙。"
            "本站输入约定为第一行 n q，之后 q 行各是一条 build i 或 query l r。"
            "本站补充范围：1≤n,q≤200000，所有下标均在 0..n−1 内，查询满足 l≤r。"
        ),
        "input": "第一行 n q；随后 q 行操作 build i 或 query l r。",
        "output": "按查询顺序输出 0 或 1，以空格分隔；区间含墙为 1，否则为 0。",
        "oracle": walls_oracle,
        "encode": walls_encode,
        "samples": [
            (5, [("query", 0, 4)]),
            (5, [("build", 2), ("query", 0, 4), ("query", 3, 4)]),
            (3, [("build", 0), ("build", 0), ("query", 0, 0), ("query", 1, 2)]),
        ],
        "random": random_walls,
        "reference": """import sys
def solve(raw):
 t=raw.split(); it=iter(t); n=int(next(it)); q=int(next(it)); bit=[0]*(n+1); built=bytearray(n); out=[]
 def add(i):
  i+=1
  while i<=n: bit[i]+=1; i+=i&-i
 def prefix(i):
  total=0
  while i: total+=bit[i]; i-=i&-i
  return total
 for _ in range(q):
  op=next(it)
  if op=='build':
   i=int(next(it))
   if not built[i]: built[i]=1; add(i)
  else:
   l=int(next(it)); r=int(next(it)); out.append('1' if prefix(r+1)-prefix(l)>0 else '0')
 return ' '.join(out)
if __name__ == '__main__':
 print(solve(sys.stdin.read()))
""",
        "mutants": [
            ("建墙位置右移一格", "if not built[i]: built[i]=1; add(i)", "if not built[i]: built[i]=1; add((i+1)%n)"),
            ("闭区间右端点被排除", "prefix(r+1)-prefix(l)", "prefix(r)-prefix(l)"),
        ],
        "public": ["0", "1 0", "1 0"],
        "editorial": "## 思路\n\n用 Fenwick 树维护每个位置是否已建墙。首次 build 将该位置加一；重复 build 不更新。查询闭区间 [l,r] 的墙数，用前缀和 prefix(r+1)−prefix(l) 计算。\n\n## 正确性\n\n每个已建位置在树中恰有一个单位贡献，未建位置贡献为零；幂等更新保证重复操作不改变贡献。Fenwick 前缀和返回半开区间 [0,x) 的总贡献，因此两前缀之差恰好是闭区间 [l,r] 的墙数。该数大于零当且仅当区间存在墙。\n\n## 复杂度\n\n每次操作时间 O(log n)，空间 O(n)。",
    },
]


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants",
                   "negative-controls", "reviews", "candidate-batches", "validation", "resolutions"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    manifest, reports, reviews, resolutions = [], [], [], []
    resolution_previous = next(
        item["reason"] for item in json.loads((OUT / "reviews/ibm-remaining-a.json").read_text())["items"]
        if item["id"] == "oa-ibm-55"
    )
    source = SOURCES["oa-ibm-55"]
    resolutions.append({"id": "oa-ibm-55", "previousReason": resolution_previous,
                        "sourceContentHash": source["contentHash"],
                        "sourceCommit": CATALOG["source"]["commit"],
                        "sourcePath": "fastprep/IBM/ibm-min-chairs.md",
                        "sourceBlob": "a42ac907f772c1782c4fdbf5c9145ff9b19549aa",
                        "batch": "ibm-capital-one-next",
                        "reason": "本站明确限定事件序列合法；在该范围内 R/L 释放室内占用，U 恢复会议室员工，模拟输出唯一。"})

    for spec in SPECS:
        pid = spec["id"]
        source = SOURCES[pid]
        code = spec["reference"].lstrip()
        ref = OUT / "references" / f"{pid}.py"
        ref.write_text(code)
        rng = random.Random(SEED + int(pid.rsplit("-", 1)[1]))
        values = spec["samples"] + [spec["random"](rng) for _ in range(160)]
        oracle_cases = []
        for value in values:
            stdin = spec["encode"](value)
            expected = spec["oracle"](value)
            actual = run(ref, stdin)
            assert actual == expected, (pid, value, expected, actual)
            oracle_cases.append({"input": stdin, "expectedOutput": expected + "\n"})

        cases = [{"name": f"公开样例 {i+1}", **oracle_cases[i], "hidden": False, "weight": 1}
                 for i in range(3)]
        cases.extend({"name": f"隐藏测试 {i+1}", **oracle_cases[i+3], "hidden": True, "weight": 1}
                     for i in range(30))
        if pid == "oa-ibm-55":
            big = ["C" * 10000]
            stdin = spec["encode"](big)
            expected = spec["oracle"](big)
            assert run(ref, stdin) == expected == "10000"
            cases.append({"name": "单条模拟最大长度", "input": stdin,
                          "expectedOutput": expected + "\n", "hidden": True, "weight": 1})
        else:
            n = 200000
            ops = [("build", n - 1), ("query", 0, n - 1), ("query", n - 1, n - 1),
                   ("query", n - 2, n - 2), ("build", n - 1)]
            ops.extend(("query", i, i) for i in range(n - 2, -1, -1))
            stress = (n, ops)
            stdin = spec["encode"](stress)
            expected = spec["oracle"]((n, ops[:5])) + " " + " ".join(["0"] * (n - 1))
            actual = run(ref, stdin)
            assert actual == expected
            cases.append({"name": "20万位置边界与单点查询", "input": stdin,
                          "expectedOutput": expected + "\n", "hidden": True, "weight": 1})

        mutants, negative_controls = [], []
        for index, (name, old, new) in enumerate(spec["mutants"], 1):
            assert old in code, (pid, "mutation anchor missing", old)
            mutant_code = code.replace(old, new)
            control = OUT / "negative-controls" / f"{pid}-{index}.py"
            control.write_text(mutant_code)
            rejected = [case_index for case_index, case in enumerate(cases)
                        if run(control, case["input"]) != case["expectedOutput"].rstrip("\n")]
            assert rejected, (pid, "mutant survives", name)
            mutants.append({"name": name, "code": mutant_code})
            negative_controls.append({"name": name, "rejectedByCases": rejected})

        problem = {
            "id": pid, "courseId": "gomall", "lessonId": "00-overview",
            "title": spec["title"], "difficulty": "中等",
            "tags": ["OA", "IBM" if "ibm" in pid else "Capital One"] + spec["tags"],
            "description": spec["description"] + "\n\n输入协议与显式标注的‘本站补充’范围属于本站整理，不是原题额外条件。",
            "input": spec["input"], "output": spec["output"],
            "explanation": "思路、正确性证明和复杂度见配套题解。",
            "hints": ["先明确每种操作对状态的影响，再选择直接模拟或支持区间计数的数据结构。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "exact", "languages": ["python", "go", "java", "cpp"],
        }
        raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
        normalize = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
                     "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
                     "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
        result = subprocess.run(["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
                                input=json.dumps(raw_package, ensure_ascii=False), text=True,
                                capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        normalized = result.stdout
        package = json.loads(normalized)
        editorial_text = spec["editorial"]
        editorial = {"schemaVersion": 1, "id": pid, "title": spec["title"],
                     "explanation": editorial_text,
                     "solutions": [{"language": "python", "code": code}],
                     "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"],
                     "author": "CSWork"}
        for folder, document in (("packages", package), ("oracles", oracle_cases),
                                 ("mutants", mutants), ("editorials", editorial)):
            (OUT / folder / f"{pid}.json").write_text(
                json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        checksum = hashlib.sha256(normalized.encode()).hexdigest()
        manifest.append({"id": pid, "sourceContentHash": source["contentHash"],
                         "packageChecksum": checksum, "editorial": editorial_text,
                         "authoredSolutions": [{"language": "python", "code": code}]})
        reports.append({"id": pid, "oracleCases": len(oracle_cases), "publicCases": 3,
                        "hiddenCases": len(cases) - 3, "negativeControls": negative_controls,
                        "referenceSha256": hashlib.sha256(code.encode()).hexdigest()})
        if pid != "oa-ibm-55":  # The explicit source-bound resolution promotes its earlier blocked review.
            reviews.append({"id": pid, "status": "authored",
                            "reason": "题意按 OAMaster 快照核对；本站补充的输入协议与范围均在题面显式注明。",
                            "sourceUrls": [source["sourceUrl"]], "sourceContentHashes": [source["contentHash"]],
                            "sourceCommit": CATALOG["source"]["commit"],
                            "catalogContentHash": source["contentHash"]})
        print(f"{pid}: {len(oracle_cases)} oracle inputs; {len(cases)} judge cases; "
              f"{len(negative_controls)} mutants rejected", flush=True)

    batch = "ibm-capital-one-next"
    (OUT / "candidate-batches" / f"{batch}.json").write_text(
        json.dumps({"schemaVersion": 1, "items": manifest}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "validation" / f"{batch}.json").write_text(json.dumps(
        {"schemaVersion": 1, "seed": SEED, "problems": reports,
         "note": "Offline authored-code/oracle/mutant validation only; not tested against production GoJudge."},
        ensure_ascii=False, indent=2) + "\n")
    (OUT / "reviews" / f"{batch}.json").write_text(
        json.dumps({"schemaVersion": 1, "items": reviews}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "resolutions" / f"{batch}.json").write_text(
        json.dumps({"schemaVersion": 1, "items": resolutions}, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
