"""Generate the isolated offline candidate for Google OA #37."""

from __future__ import annotations

from itertools import combinations, product
import hashlib
import json
from pathlib import Path
import random
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-google-37"
BATCH = "google-37-recovered"
SEED = 20261006
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/google.mdx"
CONTENT_HASH = "cd7e4c68b6ebd7ed14973e3182cd0938ce8f756c75c51c6d9e398b204ffb8025"
RAW_BLOB = "300032c24800642c2ecedab9d930e86db3cdb54a"
SOURCE_URL = "https://oamaster.com/docs/companies/google#37-is-balanced-string"
LEETCODE_URL = "https://leetcode.com/discuss/post/6582615/google-phone-screen-by-ashokkumarmula422-qjfm/"
PREVIOUS_REASON = "平衡定义把不平衡的 ()) 作为例子，且“仅数量相等”与通常前缀合法性冲突；来源贪心删括号规则也无法从题面确定。"

REFERENCE = r'''import sys

def solve(raw):
    s = raw.strip()
    if not s:
        return ""
    if len(s) > 200_000 or any(ch not in "()0123456789" for ch in s):
        raise ValueError("input outside the site-defined format")

    # All reachable states have the same survivor count. Their balance
    # values form an interval with step two, so only its endpoints are needed.
    survivors = 0
    low = high = 0  # balance = remaining '(' count - remaining ')' count
    for ch in s:
        if ch == "(":
            survivors += 1
            low += 1
            high += 1
        elif ch == ")":
            survivors += 1
            low -= 1
            high -= 1
        else:
            # Match the source implementation when d exceeds the number
            # currently available: remove every available parenthesis.
            removed = min(ord(ch) - ord("0"), survivors)
            if removed == 0:
                continue
            old_survivors = survivors
            low = max(removed - old_survivors, low - removed)
            high = min(old_survivors - removed, high + removed)
            survivors -= removed
    return "1" if survivors % 2 == 0 and low <= 0 <= high else "0"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def put(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def brute(s: str) -> int:
    """Enumerate every legal deletion choice; independent of the interval DP."""
    states = {""}
    for ch in s:
        if ch in "()":
            states = {state + ch for state in states}
            continue
        amount = min(int(ch), len(next(iter(states))))
        next_states: set[str] = set()
        for state in states:
            assert len(state) >= amount
            for deleted in combinations(range(len(state)), amount):
                removed = set(deleted)
                next_states.add("".join(c for i, c in enumerate(state) if i not in removed))
        states = next_states
    return int(any(state.count("(") == state.count(")") for state in states))


def run(code: str, raw: str) -> str:
    scope: dict[str, object] = {"__name__": "candidate"}
    exec(compile(code, "<oa-google-37>", "exec"), scope)
    return str(scope["solve"](raw))


def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    item = next(row for row in catalog["items"] if row["id"] == PID)
    assert (item["contentHash"], item["sourceUrl"], item["title"]) == (
        CONTENT_HASH, SOURCE_URL, "Is Balanced String"
    )
    source = subprocess.run(
        ["git", "show", f"{COMMIT}:{RAW_PATH}"], cwd=ROOT,
        text=True, capture_output=True, check=True,
    ).stdout
    raw_blob = subprocess.run(
        ["git", "hash-object", "--stdin"], cwd=ROOT, input=source,
        text=True, capture_output=True, check=True,
    ).stdout.strip()
    assert raw_blob == RAW_BLOB
    assert "37. Is Balanced String" in source
    assert "if inp == )(1" in source
    assert "s = \")1()\"" in source
    old = json.loads((OA / "reviews/google-remaining-a.json").read_text())
    review = next(row for row in old["items"] if row["id"] == PID)
    assert review["status"] == "blocked" and review["reason"] == PREVIOUS_REASON

    # OAMaster's three input/output examples are kept unchanged. The separate
    # malformed definition example `())` is explicitly corrected below.
    samples = ["(()1(1))", ")1()", ")(1))"]
    specs: list[tuple[str, str, bool]] = [
        ("OAMaster 样例 1", samples[0], False),
        ("OAMaster 样例 2", samples[1], False),
        ("OAMaster 样例 3", samples[2], False),
        ("纠正：数量相等的 )( 也算平衡", ")(", True),
        ("纠正：()) 的括号数量不相等", "())", True),
        ("删除后可平衡", "(()1", True),
        ("数字可任选括号", ")((2", True),
        ("数字不能删除后续括号", "(1)", True),
        ("连续数字分别操作", "((11", True),
        ("删除量超过已有括号", ")2", True),
        ("0 不删除括号", "()0", True),
        ("空括号串", "0", True),
        ("需完整删去多余括号", "(()0", True),
        ("删除所有历史括号后重新开始", "(1))", True),
        ("先删两个任意括号再追加右括号", "(()2)", True),
        ("数字大于现存括号数并截断", "(()9", True),
        ("零夹在连续的括号段之间", "((0))", True),
        ("连续数字分别删除左右括号", "()11", True),
        ("零不消耗括号而后一位数字会", "()01", True),
        ("连续数字导致剩余数量为奇数", "((11(", True),
        ("删除两枚右括号再遇到两枚左括号", "))2((", True),
        ("每次数字删除当前全部历史括号", ")(2(", True),
    ]
    formal: dict[str, int] = {}
    for name, s, _ in specs:
        assert s not in formal, name
        formal[s] = brute(s)

    rng = random.Random(SEED)
    alphabet = "()0123456789"
    oracle_inputs = set(formal)
    while len(oracle_inputs) < 160:
        size = rng.randint(1, 12)
        candidate = "".join(rng.choice(alphabet) for _ in range(size))
        if candidate not in oracle_inputs:
            oracle_inputs.add(candidate)

    # Exhaustively compare all short strings too; this checks the endpoint
    # transition independently beyond the required 120 generated inputs.
    exhaustive_alphabet = "()01"
    exhaustive = ["".join(chars) for n in range(1, 8)
                  for chars in product(exhaustive_alphabet, repeat=n)]
    started = time.perf_counter()
    for s in exhaustive:
        expected = brute(s)
        actual = run(REFERENCE, s)
        assert actual == str(expected), ("exhaustive", s, expected, actual)

    oracle_rows = []
    for s in sorted(oracle_inputs):
        expected = brute(s)
        actual = run(REFERENCE, s)
        assert actual == str(expected), (s, expected, actual)
        oracle_rows.append({"input": s + "\n", "expectedOutput": f"{expected}\n"})

    # Independent focused counterexamples for common wrong interpretations.
    mutants = [
        {
            "name": "错误要求每个前缀都合法",
            "code": '''def solve(raw):
 s=raw.strip(); bal=0; survivors=[]
 for c in s:
  if c=='(': bal+=1
  elif c==')':
   bal-=1
   if bal<0:return '0'
  elif c.isdigit():
   d=int(c)
   # This mutant otherwise uses a stack-like greedy policy.
   while d and survivors:
    survivors.pop(); d-=1
 return '1' if bal==0 else '0'
''',
        },
        {
            "name": "遇数字时总优先删除右括号",
            "code": '''def solve(raw):
 o=c=0
 for ch in raw.strip():
  if ch=='(': o+=1
  elif ch==')': c+=1
  else:
   d=min(int(ch),o+c); take=min(d,c); c-=take; d-=take; o-=min(d,o)
 return '1' if o==c else '0'
''',
        },
    ]
    formal_inputs = [s for _, s, _ in specs]
    killed = []
    for mutant in mutants:
        rejected = [i for i, s in enumerate(formal_inputs)
                    if run(mutant["code"], s + "\n") != str(formal[s])]
        assert rejected, mutant["name"]
        killed.append({"name": mutant["name"], "rejectedByCases": rejected})

    maximum = "(" * 100_000 + ")" * 100_000
    assert run(REFERENCE, maximum + "\n") == "1"
    bounds = (
        "本站补充：标准输入为一行字符串，长度 1..200000，字符仅含 `(`、`)`、`0`..`9`；"
        "若数字大于此前尚未删除的括号数，则删除全部尚存括号。原题未给长度范围或输入输出协议。"
    )
    cases = []
    for i, (name, s, hidden) in enumerate(specs):
        expected = formal[s]
        cases.append({"name": name, "input": s + "\n", "expectedOutput": f"{expected}\n",
                      "hidden": hidden, "weight": 1})
    cases.append({"name": "最大长度边界", "input": maximum + "\n", "expectedOutput": "1\n",
                  "hidden": True, "weight": 1})

    idea = (
        "从左向右扫描，维护当前仍存括号总数 T，以及所有可达选择中差值 D=左括号数−右括号数的最小值 low 和最大值 high。"
        "所有可达差值具有相同奇偶性且构成步长为 2 的连续区间，因此无需保存每个状态。读到括号时 T 和区间端点同时加减 1。"
        "读到数字 d 时令 r=min(d,T)。最小差值状态能留下的最小差值为 low−r（其左括号至少 r 个），否则为 r−T；"
        "最大差值状态能留下的最大差值为 high+r（其右括号至少 r 个），否则为 T−r。之后 T 减 r。"
        "最终 0 落在 [low,high] 中即存在一种删除选择使两类括号数量相等。"
    )
    proof = (
        "归纳证明可达差值集合始终为同奇偶性的连续区间。初态只有差值 0。追加 `(` 或 `)` 是对所有差值整体平移 1，性质不变。"
        "处理数字时，固定旧差值 D 时，若旧括号数为 O、C，则删除 r 个括号可选删除开括号数 x，"
        "其中 max(0,r−C)≤x≤min(r,O)；新差值为 D+r−2x，因此是连续步长 2 的区间。"
        "该状态的区间端点化简为 L(D)=max(r−T,D−r)、U(D)=min(T−r,D+r)，其中 T=O+C。"
        "旧可达 D 每增加 2，L、U 各至多增加 2；并且 U(D)≥L(D+2)−2，因此相邻状态的结果在步长 2 的差值格点上相接或重叠。"
        "全局最小值由 D=low 取得、最大值由 D=high 取得，故新端点分别为 max(r−T,low−r) 与 min(T−r,high+r)，正是实现中的更新式。"
        "所以端点足以完整表示所有可达状态。扫描结束后，差值区间含 0 且剩余总数为偶数，当且仅当存在左右数量相等的状态。"
    )
    complexity = "时间 O(n)，额外空间 O(1)。"
    correction = (
        "## 来源错误更正\n\n"
        "LeetCode Google 面试原帖和固定 OAMaster 快照都把 `())` 列为平衡例子，但它有 2 个左括号、1 个右括号，"
        "与同一题面的“左右括号数量相等”定义直接矛盾；该示例标注为源错误，不沿用。按明确定义，`())` 输出 0，`)(` 输出 1。"
        "原帖解释数字会删除其左侧任意 d 个括号、连续数字逐位处理；其示例 `)(1` 可任选删除左侧括号之一。"
        "快照三种语言实现对 d 大于现存括号数时会删掉所有现存括号，本站沿用该可观察行为。"
    )
    editorial = (
        f"## 思路\n\n{idea}\n\n## 正确性证明\n\n{proof}\n\n## 复杂度\n\n{complexity}\n\n"
        f"{correction}\n\n[OAMaster 题目快照]({SOURCE_URL})；"
        f"[LeetCode Google 面试原帖]({LEETCODE_URL})。\n\n{bounds}"
    )
    package = {
        "schemaVersion": 1,
        "problem": {
            "id": PID, "courseId": "gomall", "lessonId": "00-overview",
            "title": "删除数字指定数量括号后判断计数平衡",
            "difficulty": "中等", "tags": ["OA", "Google", "字符串", "动态规划"],
            "description": (
                "字符串只含左括号 `(`、右括号 `)` 和数字字符。按从左到右处理；每遇到数字 d，可以从它左侧仍未删除的括号中任意删除 d 个。"
                "数字逐字符独立处理，例如 `11` 表示先处理 1 再处理 1。处理完毕后，只要剩余左括号数等于右括号数就算平衡；不要求任何前缀满足括号合法性。\n\n"
                "**说明：** 上游示例把 `())` 错列为平衡串；它数量不相等，正确结果应为 0。\n\n" + bounds
            ),
            "input": "输入一行字符串 s。\n\n" + bounds,
            "output": "若存在一种合法删除选择使剩余左右括号数量相等，输出 1，否则输出 0。",
            "explanation": "详见配套讲义中的端点动态规划证明。",
            "hints": [
                "同一前缀处理后，剩余括号总数与删除选择无关。",
                "对相同剩余总数，可达的左右数量差值形成同奇偶性的连续区间。",
                "每个数字只需更新差值区间的两个端点。",
            ],
            "timeLimit": 2, "memoryLimit": 65536, "outputLimit": 4096,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    # Validate against the repository's actual import schema before emitting.
    normalized = subprocess.run(
        ["node", "--import", "tsx", "-e",
         "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],
        cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True,
        capture_output=True, check=True,
    ).stdout
    package = json.loads(normalized)
    put(OA / "packages" / f"{PID}.json", package)
    put(OA / "oracles" / f"{PID}.json", oracle_rows)
    put(OA / "mutants" / f"{PID}.json", mutants)
    (OA / "references" / f"{PID}.py").write_text(REFERENCE)
    put(OA / "editorials" / f"{PID}.json", {
        "schemaVersion": 1, "id": PID, "title": "删除数字指定数量括号后判断计数平衡",
        "explanation": editorial, "solutions": [{"language": "python", "code": REFERENCE}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": CONTENT_HASH, "author": "CSWork",
    })
    put(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{"id": PID, "sourceContentHash": CONTENT_HASH,
                   "packageChecksum": sha(normalized), "editorial": editorial,
                   "authoredSolutions": [{"language": "python", "code": REFERENCE}]}],
    })
    put(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": COMMIT, "sourceContentHash": CONTENT_HASH,
        "fixedSource": {"path": RAW_PATH, "gitBlobSha": RAW_BLOB,
                        "evidence": "固定快照中的题面、三种语言函数与三个输入输出例子一致；函数逐字符读取括号/数字，并按左右计数判断结果。"},
        "primarySupportingSource": {
            "url": LEETCODE_URL,
            "evidence": "Google Phone Screen 原帖重述：数字出现时删除其左边 d 个括号、可任选删除、数字逐字符处理；平衡定义明确为左括号数等于右括号数，并举 )(1 可删左括号之一。",
        },
        "sourceError": {
            "text": "())",
            "reason": "来源把它列为平衡例子，但其中左括号 2 个、右括号 1 个，与同一题面明示的数量相等定义矛盾。",
            "resolution": "以原帖的明确定义和固定快照实现为准；该串答案为 0。另以 )( 为不要求前缀合法的正确例子，答案为 1。",
        },
        "interpretation": "扫描时仅能删除当前数字左侧尚未删除的括号；最终只比较剩余左右括号数量，不要求任一前缀合法。连续数字逐位独立处理。若 d 超过现存括号数，则按快照三语实现的 min(d,现存数) 行为删除全部现存括号。",
        "siteAdditions": ["标准输入输出协议", "字符串长度 1..200000", "允许字符集合", "当 d 超出现存括号数时明示沿用上游实现的删除全部行为"],
    })
    put(OA / "reports" / f"{BATCH}.json", {
        "schemaVersion": 1, "problemId": PID, "sourceCases": 3,
        "uniqueOracleCases": len(oracle_rows), "exhaustiveStrings": len(exhaustive),
        "formalCases": len(cases), "largeBoundaryLength": len(maximum),
        "mutants": killed, "localOnly": True,
        "correctedCases": {"())": "0 (source example is arithmetically inconsistent)", ")(": "1 (counts balance despite invalid prefix)"},
        "counterexamples": {"()1": "答案 0：剩余一个括号，揭示只检查区间跨 0 而不检查奇偶性的错误。",
                            "(()1": "答案 1：删除一个左括号后剩一左一右，击杀总是优先删右括号的贪心。",
                            ")1()": "答案 1：先删除历史右括号后剩一对括号，前缀合法性不是判定条件。"},
        "algorithm": {"name": "可达差值区间端点 DP", "proof": "同总括号数下可达的差值同奇偶且连续。固定差值 D 时删 r 个，删除左括号数 x 的范围为 max(0,r−C)..min(r,O)，新差值 D+r−2x 连续；相邻旧差值相差 2 时，新区间相接或重叠。故只保存最小/最大可达差值即可，端点状态给出删除优先左/右括号的极值公式。最终要求 0 在区间中且总数为偶数。",
                        "time": "O(n)", "space": "O(1)"},
    })
    put(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1, "seed": SEED,
        "problems": [{"id": PID, "oracleCases": len(oracle_rows),
                      "uniqueOracleInputs": len(oracle_inputs), "publicCases": 3,
                      "hiddenCases": len(cases) - 3, "negativeControls": killed,
                      "referenceSha256": sha(REFERENCE)}],
        "note": "离线作者验证：21,844 个短串全枚举及 160 个唯一直接删除 oracle；GoJudge 尚未验证。",
    })
    print(json.dumps({"problem": PID, "oracle": len(oracle_rows), "exhaustive": len(exhaustive),
                      "formal": len(cases), "mutants": killed,
                      "exhaustiveSeconds": round(time.perf_counter() - started, 3)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
