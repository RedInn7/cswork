"""Author two source-backed OA candidates and record one blocked review.

Writes candidate artifacts only. It does not edit coverage/runtime batches and
does not execute code from the upstream OA-Master repository.
"""
from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
BATCH = "duolingo-flexport5-review"
SEED = 20261008


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def compare(actual: str, expected: str, checker: str) -> bool:
    if checker == "exact":
        return actual.replace("\r\n", "\n") == expected.replace("\r\n", "\n")
    return actual.split() == expected.split()


def run_program(path: Path, inputs: list[str]) -> list[str]:
    result = subprocess.run(
        [sys.executable, "-I", str(ROOT / "scripts/oa-judge/local_batch_runner.py"), str(path)],
        cwd=ROOT,
        input=json.dumps(inputs, ensure_ascii=False),
        text=True,
        capture_output=True,
        timeout=180,
        check=True,
    )
    outputs = json.loads(result.stdout)
    assert len(outputs) == len(inputs)
    return outputs


def validate_package(package: dict) -> str:
    result = subprocess.run(
        [
            "node", "--max-old-space-size=512", "--import", "tsx", "-e",
            "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
            "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
            "process.stdin.on('end',()=>process.stdout.write(JSON.stringify("
            "ojImportSchema.parse(JSON.parse(s)))));",
        ],
        cwd=ROOT,
        input=json.dumps(package, ensure_ascii=False, separators=(",", ":")),
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr[:4000])
    return result.stdout


VOWELS = set("aeiouAEIOU")
CONSONANTS = "bcdfghjklmnpqrstvwxyz"


def consonant_oracle(case: tuple[str, int]) -> str:
    message, n = case
    seen = 0
    output = []
    for char in message:
        if char in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" and char not in VOWELS:
            seen += 1
            if seen % n == 0:
                lower = char.lower()
                output.append(CONSONANTS[(CONSONANTS.index(lower) + 1) % len(CONSONANTS)].upper()
                              if char.isupper()
                              else CONSONANTS[(CONSONANTS.index(lower) + 1) % len(CONSONANTS)])
                continue
        output.append(char)
    return "".join(output)


def encode_consonant(case: tuple[str, int]) -> str:
    return f"{case[0]}\n{case[1]}\n"


def random_consonant(rng: random.Random) -> tuple[str, int]:
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ,.!?-"
    return "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 22))), rng.randint(1, 7)


CONSONANT_REFERENCE = '''def solve(raw):
    lines = raw.splitlines()
    message, n = lines[0], int(lines[1])
    vowels = set("aeiouAEIOU")
    consonants = "bcdfghjklmnpqrstvwxyz"
    count = 0
    out = []
    for char in message:
        lower = char.lower()
        if "a" <= lower <= "z" and char not in vowels:
            count += 1
            if count % n == 0:
                shifted = consonants[(consonants.index(lower) + 1) % len(consonants)]
                out.append(shifted.upper() if char.isupper() else shifted)
                continue
        out.append(char)
    return "".join(out)
'''

CONSONANT_MUTANTS = [
    (
        "按字符串字符位置而非辅音序号计数",
        '''def solve(raw):
    lines=raw.splitlines();message,n=lines[0],int(lines[1]);out=[];cons="bcdfghjklmnpqrstvwxyz"
    for i,c in enumerate(message):
        if (i+1)%n==0 and c.lower() in cons:
            x=cons[(cons.index(c.lower())+1)%len(cons)];out.append(x.upper() if c.isupper() else x)
        else:out.append(c)
    return "".join(out)
''',
    ),
    (
        "替换时只将字符码加一，未跳过元音且未按辅音表回绕",
        '''def solve(raw):
    lines=raw.splitlines();message,n=lines[0],int(lines[1]);out=[];count=0
    for c in message:
        if c.isascii() and c.isalpha() and c.lower() not in "aeiou":
            count+=1
            if count%n==0:
                out.append(chr(ord(c)+1));continue
        out.append(c)
    return "".join(out)
''',
    ),
]


def point_route_cost(player: int, locations: list[int]) -> int:
    left, right = min(locations), max(locations)
    if right <= player:
        return player - left
    if left >= player:
        return right - player
    left_distance, right_distance = player - left, right - player
    return min(2 * left_distance + right_distance, left_distance + 2 * right_distance)


def points_oracle(case: tuple[list[int], list[int]]) -> int:
    players, points = case
    best = 10**30
    assignment = [0] * len(points)

    def visit(index: int) -> None:
        nonlocal best
        if index == len(points):
            loads = [[] for _ in players]
            for point_index, player_index in enumerate(assignment):
                loads[player_index].append(points[point_index])
            time = max((point_route_cost(player, load) for player, load in zip(players, loads) if load), default=0)
            best = min(best, time)
            return
        for player_index in range(len(players)):
            assignment[index] = player_index
            visit(index + 1)

    visit(0)
    return best


def encode_points(case: tuple[list[int], list[int]]) -> str:
    players, points = case
    return (f"{len(players)} {len(points)}\n" + " ".join(map(str, players)) + "\n"
            + " ".join(map(str, points)) + "\n")


def random_points(rng: random.Random) -> tuple[list[int], list[int]]:
    players = [rng.randint(1, 20) for _ in range(rng.randint(1, 3))]
    points = [rng.randint(1, 20) for _ in range(rng.randint(1, 7))]
    return players, points


POINTS_REFERENCE = '''def solve(raw):
    values = list(map(int, raw.split()))
    n, m = values[:2]
    players = sorted(values[2:2+n])
    points = sorted(values[2+n:2+n+m])

    def feasible(time):
        first = 0
        for player in players:
            if first == m:
                return True
            point = points[first]
            if point < player - time:
                return False
            if point > player + time:
                continue
            if point <= player:
                leftmost = point
                while first < m and points[first] <= player:
                    first += 1
                left_distance = player - leftmost
                reach = max(
                    player + time - 2 * left_distance,
                    player + (time - left_distance) // 2,
                )
            else:
                reach = player + time
            while first < m and points[first] <= reach:
                first += 1
        return first == m

    low, high = 0, 2_000_000_001
    while low < high:
        middle = (low + high) // 2
        if feasible(middle):
            high = middle
        else:
            low = middle + 1
    return str(low)
'''

POINTS_MUTANTS = [
    (
        "逐点只取最近玩家距离，忽略同一玩家收集多个点的行程",
        '''def solve(raw):
    v=list(map(int,raw.split()));n,m=v[:2];p=v[2:2+n];x=v[2+n:2+n+m]
    return str(max(min(abs(z-q) for q in p) for z in x))
''',
    ),
    (
        "先去左侧点时少扣一次回程代价",
        POINTS_REFERENCE.replace(
            "player + time - 2 * left_distance",
            "player + time - left_distance",
        ),
    ),
]


BLOCKED_REASON = (
    "固定题面只说可删除恰好一个节点，没有说明候选是否限于初始感染节点；"
    "现有解释与解法擅自将候选限制为 malware=1。任意节点删除与感染节点删除可产生不同答案；"
    "题面也未保证至少一个感染节点，且示例无法消歧。可按题面字面补充‘传播前可删除任一节点’，"
    "或明确‘只可删除初始感染节点’并保证感染集合非空；两种口径都可用节点删除后重新 BFS 求解。"
)


def build_spec(identifier: str, source: dict, cases: list, encode, oracle, reference: str,
               mutants: list, title: str, description: str, limits: str, output: str,
               idea: str, proof: str, complexity: str, checker: str, time_limit: int,
               max_bytes: int) -> dict:
    code = reference + '\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
    seen = {encode(case) for case in cases}
    rng = random.Random(SEED + sum(map(ord, identifier)))
    generator = random_consonant if identifier == "oa-duolingo-3" else random_points
    oracle = oracle
    attempts = 0
    while len(cases) < 120 and attempts < 30000:
        attempts += 1
        case = generator(rng)
        raw = encode(case)
        if raw not in seen:
            seen.add(raw)
            cases.append(case)
    assert len(cases) == 120, (identifier, len(cases))

    oracle_cases = [dict(input=encode(case), expectedOutput=str(oracle(case)) + "\n") for case in cases]
    formal_cases = oracle_cases[:32]
    reference_path = OUT / "references" / f"{identifier}.py"
    reference_path.write_text(code)
    outputs = run_program(reference_path, [case["input"] for case in oracle_cases])
    for index, (actual, expected) in enumerate(zip(outputs, oracle_cases)):
        assert compare(actual, expected["expectedOutput"], checker), (identifier, index, repr(actual), repr(expected))

    mutant_results = []
    mutant_payload = []
    for index, (name, mutant_body) in enumerate(mutants, 1):
        mutant_code = mutant_body + '\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
        mutant_path = OUT / "negative-controls" / f"{identifier}-{index}.py"
        mutant_path.write_text(mutant_code)
        bad_outputs = run_program(mutant_path, [case["input"] for case in formal_cases])
        rejected = [i for i, (actual, expected) in enumerate(zip(bad_outputs, formal_cases))
                    if not compare(actual, expected["expectedOutput"], checker)]
        assert rejected, (identifier, name, "mutant survived formal cases")
        mutant_payload.append(dict(name=name, code=mutant_code))
        mutant_results.append(dict(name=name, rejectedByCases=rejected))

    sample_count = 3
    package_cases = [
        dict(name=f"公开样例 {i+1}" if i < sample_count else f"隐藏用例 {i-sample_count+1}",
             **case, hidden=i >= sample_count, weight=1)
        for i, case in enumerate(formal_cases)
    ]
    description += "\n\n以下 ASCII 字符集、边界及标准输入输出格式为本站补充契约，不声称是来源题面的原始约束。"
    package = dict(
        schemaVersion=1,
        problem=dict(
            id=identifier, courseId="gomall", lessonId="00-overview", title=title,
            difficulty="中等", tags=["OA", source["companyName"]], description=description,
            input=limits, output=output, explanation=idea, hints=[idea], timeLimit=time_limit,
            memoryLimit=262144, outputLimit=16384, checker=checker,
            languages=["python", "go", "java", "cpp"],
        ),
        cases=package_cases,
    )
    normalized = validate_package(package)
    write_json(OUT / "packages" / f"{identifier}.json", json.loads(normalized))
    write_json(OUT / "oracles" / f"{identifier}.json", oracle_cases)
    write_json(OUT / "mutants" / f"{identifier}.json", mutant_payload)
    editorial = (f"## 思路\n\n{idea}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{complexity}")
    write_json(OUT / "editorials" / f"{identifier}.json", dict(
        schemaVersion=1, id=identifier, title=title, explanation=editorial,
        solutions=[dict(language="python", code=code)], sourceUrl=source["sourceUrl"],
        sourceContentHash=source["contentHash"], author="CSWork",
    ))
    candidate = dict(
        id=identifier, sourceContentHash=source["contentHash"],
        packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(), editorial=editorial,
        authoredSolutions=[dict(language="python", code=code)],
    )
    report = dict(
        id=identifier, oracleCases=len(oracle_cases), uniqueOracleInputs=len({x["input"] for x in oracle_cases}),
        publicCases=sample_count, hiddenCases=len(package_cases)-sample_count,
        maximumCanonicalInputBytesBound=max_bytes, negativeControls=mutant_results,
        packageSha256=hashlib.sha256((OUT / "packages" / f"{identifier}.json").read_bytes()).hexdigest(),
        referenceSha256=hashlib.sha256(code.encode()).hexdigest(),
        oracleSha256=hashlib.sha256((OUT / "oracles" / f"{identifier}.json").read_bytes()).hexdigest(),
        mutantsSha256=hashlib.sha256((OUT / "mutants" / f"{identifier}.json").read_bytes()).hexdigest(),
    )
    return dict(candidate=candidate, report=report, editorial=editorial)


def main() -> None:
    for folder in ("packages", "references", "oracles", "mutants", "negative-controls",
                   "editorials", "candidate-batches", "validation", "reviews", "source-evidence"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    catalog = {item["id"]: item for item in json.loads((ROOT / "content/oa-master/catalog.json").read_text())["items"]}

    consonant_examples = [("Codesignal", 3), ("bdf", 1), ("xyz", 1)]
    points_examples = [([5], [3, 7]), ([1, 9], [2, 8]), ([4, 1], [8, 2, 6])]
    details = [
        ("oa-duolingo-3", consonant_examples, encode_consonant, consonant_oracle, CONSONANT_REFERENCE,
         CONSONANT_MUTANTS, "Replace Nth Consonant",
         "对 message 中每第 n 个英文字母辅音，替换成字母表顺序中的下一个辅音；保留大小写，其他字符保持不变。来源样例输出 `CodeTignam` 中的大写 T 与原始小写 s、大小写保留规则及解释不符；本站按文字规则和解释修正为 `Codetignam`。",
         "两行输入：第一行 message（1..200000 个 ASCII 字符，不含换行）；第二行整数 n（1≤n≤200000）。仅 ASCII A-Z/a-z 参与辅音判断，元音为 a、e、i、o、u，y 视为辅音；其他 ASCII 字符原样保留。",
         "输出转换后的整行 message。", "扫描字符串并维护已见辅音数；每当计数是 n 的倍数时，在 21 个英文字母辅音组成的循环中前进一位。",
         "逐字符扫描保证非目标字符不变；计数只在英文字母且非元音时递增，因此第 k 个辅音恰在计数达到 k 时被判定。循环辅音表的后继运算直接实现题面规定的下一个辅音及 z→b 回绕，大小写分别映射后再恢复。",
         "时间 O(|message|)，额外空间 O(|message|)。", "exact", 4, 200010),
        ("oa-flexport-5", points_examples, encode_points, points_oracle, POINTS_REFERENCE,
         POINTS_MUTANTS, "Collect Points",
         "n 个玩家在数轴上同时独立移动，每秒最多移动一个单位。任一玩家访问某点即算收集。求收集全部 points 所需的最少秒数。",
         "第一行 n m（1≤n,m≤100000）；第二行 n 个玩家坐标；第三行 m 个点坐标。所有坐标为 1..10^9 的整数。输入顺序不保证有序。",
         "输出最少秒数。", "二分总时间。将玩家和点排序；按点从左到右依次分配给玩家。当前玩家先收集途中必经的未覆盖左侧点，再计算时间 t 内可到达的最远右侧点，推进指针。",
         "任何可行分配中，已由更左侧玩家覆盖的点可从左到右固定为前缀。若首个未覆盖点 x 在玩家左侧，去 x 的途中会收集所有不大于 p 的未覆盖点；再覆盖右端 r 有两种路线：先左后右，或先右后回到 x。两者允许的最远边界分别为 p+t−2(p−x) 与 p+⌊(t−(p−x))/2⌋，取较大值。若 x 在右侧，边界为 p+t。超出时间可达区间的首点不可能由当前或更右的玩家补救；依此贪心推进不会漏掉可行解。可行性关于 t 单调，二分得到最小时间。",
         "设范围 V≤2×10^9；时间 O((n+m) log V)，空间 O(n+m)。", "exact", 5, 3000000),
    ]

    candidates = []
    reports = []
    review_items = []
    evidence_items = []
    pages = {}
    for (identifier, examples, encode, oracle, reference, mutants, title, description,
         limits, output, idea, proof, complexity, checker, time_limit, max_bytes) in details:
        source = catalog[identifier]
        result = build_spec(identifier, source, list(examples), encode, oracle, reference, mutants,
                             title, description, limits, output, idea, proof, complexity, checker,
                             time_limit, max_bytes)
        candidates.append(result["candidate"])
        reports.append(result["report"])
        reason = ("已核对固定上游 MDX 与 catalog 题面；补充契约公开标明为本站定义。独立参考实现与穷举/直接 oracle 对照 120 个互异输入，两个正常退出 mutant 均被正式用例击杀。仅完成离线验证，未运行 GoJudge。")
        if identifier == "oa-duolingo-3":
            reason += " 来源样例将小写 s 的替换结果印成大写 T，与保留大小写规则及解释中的 s→t 冲突；本站依规则保留小写并将样例输出更正为 Codetignam。"
        review_items.append(dict(id=identifier, status="authored", reason=reason))
        slug = source["companySlug"]
        path = f"web/content/docs/companies/{slug}.mdx"
        blob = subprocess.run(["git", "rev-parse", f"{SOURCE_COMMIT}:{path}"], cwd=ROOT,
                              text=True, capture_output=True, check=True).stdout.strip()
        content = subprocess.run(["git", "show", f"{SOURCE_COMMIT}:{path}"], cwd=ROOT,
                                 capture_output=True, check=True).stdout
        pages[slug] = dict(path=path, gitBlobSha=blob, sha256=hashlib.sha256(content).hexdigest())
        evidence_items.append(dict(
            id=identifier, status="authored", sourceCommit=SOURCE_COMMIT, rawPath=path,
            rawGitBlob=blob, sourceUrl=source["sourceUrl"], catalogContentHash=source["contentHash"],
            reason=reason,
        ))
        print(f"{identifier}: 120 unique oracle inputs; both normal-exit mutants killed", flush=True)

    blocked_id = "oa-flexport-6"
    source = catalog[blocked_id]
    path = f"web/content/docs/companies/{source['companySlug']}.mdx"
    blob = subprocess.run(["git", "rev-parse", f"{SOURCE_COMMIT}:{path}"], cwd=ROOT,
                          text=True, capture_output=True, check=True).stdout.strip()
    review_items.append(dict(id=blocked_id, status="blocked", reason=BLOCKED_REASON))
    evidence_items.append(dict(
        id=blocked_id, status="blocked", sourceCommit=SOURCE_COMMIT, rawPath=path, rawGitBlob=blob,
        sourceUrl=source["sourceUrl"], catalogContentHash=source["contentHash"], reason=BLOCKED_REASON,
    ))
    pages[source["companySlug"]] = dict(
        path=path, gitBlobSha=blob,
        sha256=hashlib.sha256(subprocess.run(["git", "show", f"{SOURCE_COMMIT}:{path}"], cwd=ROOT,
                                             capture_output=True, check=True).stdout).hexdigest(),
    )
    candidates.sort(key=lambda item: item["id"])
    reports.sort(key=lambda item: item["id"])
    review_items.sort(key=lambda item: item["id"])
    evidence_items.sort(key=lambda item: item["id"])
    blocked = {blocked_id: BLOCKED_REASON}
    write_json(OUT / "candidate-batches" / f"{BATCH}.json", dict(schemaVersion=1, items=candidates))
    write_json(OUT / "validation" / f"{BATCH}.json", dict(
        schemaVersion=1, seed=SEED, problems=reports, skipped=blocked,
        note="离线独立 oracle 与正常退出 mutant 验证；未调用 GoJudge，不是线上验收结果。",
    ))
    write_json(OUT / "reviews" / f"{BATCH}.json", dict(schemaVersion=1, items=review_items))
    write_json(OUT / "source-evidence" / f"{BATCH}.json", dict(
        schemaVersion=1, repository="https://github.com/RedInn7/OA-Master", commit=SOURCE_COMMIT,
        reason="固定提交中的源 MDX 作为不可变输入；未执行上游来源程序。",
        pages=[dict(company=company, **record) for company, record in sorted(pages.items())],
        items=evidence_items,
    ))
    print("candidate=2 blocked=1; coverage.json and runtime batches unchanged", flush=True)


if __name__ == "__main__":
    main()
