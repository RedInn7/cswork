#!/usr/bin/env python3
"""Generate deterministic, offline-validated Intuit OA candidate packages."""

from __future__ import annotations

import bisect
import hashlib
import itertools
import json
import random
import subprocess
import sys
from collections import Counter, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
CATALOG = {
    item["id"]: item
    for item in json.loads((ROOT / "content/oa-master/catalog.json").read_text())["items"]
}


REFERENCES = {
    1: '''from collections import deque
import sys

def solve(text):
    lines = text.splitlines()
    b, p = map(int, lines[0].split())
    grid = [line.split() for line in lines[1:1 + b]]
    start = end = None
    for r in range(b):
        for c in range(p):
            if grid[r][c] == "Q": start = (r, c)
            if grid[r][c] == "W": end = (r, c)
    q = deque([(start[0], start[1], -1, 0)])
    seen = {(start[0], start[1], -1, 0)}
    dirs = ((-1, 0), (1, 0), (0, -1), (0, 1))
    while q:
        r, c, old, turns = q.popleft()
        for d, (dr, dc) in enumerate(dirs):
            nt = turns + (old != -1 and old != d)
            nr, nc = r + dr, c + dc
            state = (nr, nc, d, nt)
            if nt <= 2 and 0 <= nr < b and 0 <= nc < p and grid[nr][nc] != "x" and state not in seen:
                if (nr, nc) == end: return "DRIVE!"
                seen.add(state); q.append(state)
    return "DON'T DRIVE!"

if __name__ == "__main__": print(solve(sys.stdin.read()))
''',
    9: '''from bisect import bisect_left
from collections import defaultdict
import sys

def solve(text):
    s = text.strip()
    n = len(s)
    all_pairs = 0
    for j in range(n):
        threshold = n - j
        small = min(j, threshold)
        all_pairs += small * (small + 1) // 2 + (j - small) * threshold
    positions = defaultdict(list)
    for i, ch in enumerate(s): positions[ch].append(i)
    equal_pairs = 0
    for places in positions.values():
        prefix = [0]
        for i in places: prefix.append(prefix[-1] + i + 1)
        for k, j in enumerate(places):
            split = bisect_left(places, n - j, 0, k)
            equal_pairs += prefix[split] + (k - split) * (n - j)
    return str(all_pairs - equal_pairs)

if __name__ == "__main__": print(solve(sys.stdin.read()))
''',
    15: '''import heapq
import sys

def solve(text):
    data = text.split()
    n, removals = map(int, data[:2])
    counts = [0] * 26
    for ch in data[2].strip(): counts[ord(ch) - 97] += 1
    heap = [-x for x in counts if x]
    heapq.heapify(heap)
    for _ in range(min(removals, n)):
        largest = -heapq.heappop(heap)
        if largest > 1: heapq.heappush(heap, -(largest - 1))
    return str(sum(x * x for x in heap))

if __name__ == "__main__": print(solve(sys.stdin.read()))
''',
    21: '''import sys

def solve(text):
    s = text.strip()
    ones = [0] * 26
    parity_count = [1, 0]
    prefix_count = [0] * 26
    mask = 0
    total_odd_letters = 0
    odd_length_substrings = 0
    prefix_index = 0
    for ch in s:
        mask ^= 1 << (ord(ch) - 97)
        prefix_index += 1
        for bit in range(26):
            total_odd_letters += prefix_count[bit] if not (mask >> bit) & 1 else prefix_index - prefix_count[bit]
        prefix_count = [prefix_count[bit] + (((mask >> bit) & 1) == 1) for bit in range(26)]
        parity = prefix_index & 1
        odd_length_substrings += parity_count[1 - parity]
        parity_count[parity] += 1
    return str((total_odd_letters - odd_length_substrings) // 2)

if __name__ == "__main__": print(solve(sys.stdin.read()))
''',
}


SPECS = {
    1: {
        "title": "GPS for Autonomous Driving — Max 2 Turns",
        "difficulty": "中等",
        "description": "在含障碍的网格中，从 Q 到 W，判断是否存在最多转向两次的路径。车辆只能上下左右移动；每次改变移动方向计一次转向。",
        "input": "首行 b p，随后 b 行各 p 个字符（以空格分隔）：o 表示空地、x 表示障碍、Q 为起点、W 为终点。本站范围：1≤b,p≤1000；Q/W 各出现一次。",
        "output": "可达输出 DRIVE!，否则输出 DON'T DRIVE!。",
        "formal": [
            ("4 4\nQ o o o\no o o o\no o o o\no o o W\n", "DRIVE!"),
            ("3 5\nQ x o o W\no x o x o\no o o o o\n", "DON'T DRIVE!"),
            ("3 3\nQ o o\nx x o\nW o o\n", "DRIVE!"),
        ],
        "bounds": "若有解，存在不重复格子的简单路径；BFS 在 (row,column,direction,turns) 状态图上至多访问 12bp 个状态。",
        "proof": "BFS 对状态图按路径长度穷举。状态保留当前位置、最后方向和已转向次数，因而两个具有不同可行后续的路径不会被错误合并。只有不超过两次转向的状态入队；抵达 W 即存在合法路径，遍历结束仍未抵达则不存在。",
        "max_input": 5_000_000,
    },
    9: {
        "title": "DNA Sequencing — Palindrome Transformation Cost",
        "difficulty": "困难",
        "description": "对字符串的每个连续子串，计算最少修改多少个字符才能让该子串成为回文，再求所有子串代价之和。本站按原题的原序回文定义，不允许重排字符。",
        "input": "一行仅含小写英文字母的字符串 dna。题源未给长度上限；本站按 1≤|dna|≤100000 设置。",
        "output": "输出所有连续子串的回文修改代价之和。",
        "formal": [("asbsd\n", "7"), ("a\n", "0"), ("aaa\n", "0")],
        "bounds": "对每个位置对 (i,j)，若字符不同，它会作为对称字符出现在 min(i+1,n-j) 个子串中。总权重可线性计算；相等字符对按字符分组并用前缀和二分扣除。",
        "proof": "一个子串要成为回文，左右对称且不相等的字符对至少需要一次修改，修改其中任一字符即可满足该对；各镜像位置对互不重叠，所以代价正好是镜像不等对数。固定下标 i<j 的字符对在某个子串中对称，当且仅当子串左右端点向外扩展相同距离；合法扩展数为 min(i+1,n-j)。因此答案是全部位置对的权重和减去相等字符位置对的权重和。",
        "max_input": 100_001,
    },
    15: {
        "title": "Letter Candles",
        "difficulty": "中等",
        "description": "每种小写字母的频次平方之和是盒子成本。最多移除 M 根蜡烛，求能达到的最小成本。",
        "input": "三行依次为 N、M、字符串 S。|S|=N，S 只含小写英文字母。题源未给数值范围；本站按 1≤N≤1000000、0≤M≤N 设置。",
        "output": "输出最小成本。",
        "formal": [("4\n2\naabb\n", "2"), ("5\n2\naaaab\n", "5"), ("3\n0\nabc\n", "3")],
        "bounds": "每次从当前频次最高的字符移除一根可获得最大边际收益；字母种类固定为 26，堆模拟最多 min(M,N) 次。",
        "proof": "频次为 f 的字符再移除一根后成本下降 f²−(f−1)²=2f−1。该边际收益随 f 增大而增大，因此若某一步未从当前最高频字符移除、却移除了较低频字符，交换这一步的选择不会增加成本。重复此贪心恰好模拟最优的最多 M 次删除。",
        "max_input": 1_000_010,
    },
    21: {
        "title": "Set Total Palindrome Transformation Cost",
        "difficulty": "困难",
        "description": "字符串可重新排列成回文称为 palindrome-like。对任意子串，允许修改字符，求使其变为 palindrome-like 所需的最少修改数；输出所有子串代价之和。这里按题面定义允许重新排列。",
        "input": "一行仅含小写英文字母的字符串 s，1≤|s|≤100000。",
        "output": "输出所有子串的 palindrome-like 修改代价总和。",
        "formal": [("abca\n", "6"), ("aabb\n", "2"), ("abc\n", "1")],
        "bounds": "维护各前缀的 26 位奇偶掩码。子串奇数频字符数为两个前缀掩码 XOR 的 popcount；按字符位累加异或贡献，再扣除奇数长度项并除二。",
        "proof": "一个子串可重排成回文，当且仅当至多一个字符出现奇数次。每次修改一个字符最多同时改变两个奇偶位，因此代价为 floor(odd/2)。对所有前缀奇偶掩码对，odd 数量等于 XOR 的置位数。逐字符位累计当前掩码与此前掩码不同的次数即可得到所有 odd 总和；odd 的奇偶性与子串长度奇偶相同，因此减去奇数长度子串数后除以二，恰为总代价。",
        "max_input": 100_001,
    },
}


def write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def encode(pid: int, value: object) -> str:
    if pid == 1:
        grid = value
        return f"{len(grid)} {len(grid[0])}\n" + "".join(" ".join(row) + "\n" for row in grid)
    if pid in (9, 21):
        return str(value) + "\n"
    n, m, s = value
    return f"{n}\n{m}\n{s}\n"


def reference(pid: int, encoded: str) -> str:
    namespace = {"__name__": "candidate"}
    exec(compile(REFERENCES[pid], "<reference>", "exec"), namespace)
    return namespace["solve"](encoded).strip()


def oracle(pid: int, value: object) -> str:
    if pid == 1:
        grid = value
        b, p = len(grid), len(grid[0])
        start = end = None
        for r in range(b):
            for c in range(p):
                if grid[r][c] == "Q": start = (r, c)
                if grid[r][c] == "W": end = (r, c)
        directions = ((-1, 0), (1, 0), (0, -1), (0, 1))

        def paths(r, c, previous, turns, remaining):
            if (r, c) == end: return True
            if remaining == 0: return False
            for d, (dr, dc) in enumerate(directions):
                next_turns = turns + (previous != -1 and previous != d)
                if next_turns > 2: continue
                nr, nc = r, c
                for _ in range(max(b, p)):
                    nr += dr; nc += dc
                    if not (0 <= nr < b and 0 <= nc < p) or grid[nr][nc] == "x": break
                    if paths(nr, nc, d, next_turns, remaining - 1): return True
            return False

        return "DRIVE!" if paths(*start, -1, 0, 3) else "DON'T DRIVE!"
    if pid == 9:
        s = str(value); total = 0
        for left in range(len(s)):
            for right in range(left + 1, len(s)):
                total += sum(s[left + offset] != s[right - offset] for offset in range((right - left + 1) // 2))
        return str(total)
    if pid == 15:
        n, m, s = value
        counts = list(Counter(s).values())
        best = n * n

        def distribute(i, left, cost):
            nonlocal best
            if i == len(counts):
                best = min(best, cost); return
            for removed in range(min(left, counts[i]) + 1):
                next_cost = cost + (counts[i] - removed) ** 2
                if next_cost < best: distribute(i + 1, left - removed, next_cost)

        distribute(0, m, 0)
        return str(best)
    s = str(value); total = 0
    for left in range(len(s)):
        counts = Counter()
        for right in range(left, len(s)):
            counts[s[right]] += 1
            total += sum(count & 1 for count in counts.values()) // 2
    return str(total)


def random_case(pid: int, rng: random.Random) -> object:
    if pid == 1:
        b, p = rng.randint(2, 6), rng.randint(2, 6)
        cells = [["x" if rng.random() < 0.24 else "o" for _ in range(p)] for _ in range(b)]
        sr, sc = rng.randrange(b), rng.randrange(p)
        er, ec = sr, sc
        while (er, ec) == (sr, sc): er, ec = rng.randrange(b), rng.randrange(p)
        cells[sr][sc], cells[er][ec] = "Q", "W"
        return cells
    if pid in (9, 21):
        return "".join(rng.choice("abcde") for _ in range(rng.randint(1, 12)))
    n = rng.randint(1, 14)
    s = "".join(rng.choice("abcde") for _ in range(n))
    return n, rng.randint(0, n), s


MUTANTS = {
    1: [
        ("允许任意次数转向", '''import sys
from collections import deque
g=[x.split() for x in sys.stdin.read().splitlines()[1:]];b=len(g);p=len(g[0]);q=deque();seen=set()
for i in range(b):
 for j in range(p):
  if g[i][j]=='Q':q.append((i,j));seen.add((i,j))
while q:
 r,c=q.popleft()
 for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
  x,y=r+dr,c+dc
  if 0<=x<b and 0<=y<p and g[x][y]!='x' and (x,y) not in seen:
   if g[x][y]=='W':print('DRIVE!');raise SystemExit
   seen.add((x,y));q.append((x,y))
print("DON'T DRIVE!")
'''),
        ("只允许一次转向", '''import sys
from collections import deque
lines=sys.stdin.read().splitlines();b,p=map(int,lines[0].split());g=[x.split() for x in lines[1:1+b]];q=deque();seen=set()
for r in range(b):
 for c in range(p):
  if g[r][c]=='Q':
   for d in range(4):q.append((r,c,d,0));seen.add((r,c,d,0))
dirs=((1,0),(-1,0),(0,1),(0,-1))
while q:
 r,c,d,t=q.popleft()
 for nd,(dr,dc) in enumerate(dirs):
  nt=t+(nd!=d);x,y=r+dr,c+dc;z=(x,y,nd,nt)
  if nt<=1 and 0<=x<b and 0<=y<p and g[x][y]!='x' and z not in seen:
   if g[x][y]=='W':print('DRIVE!');raise SystemExit
   seen.add(z);q.append(z)
print("DON'T DRIVE!")
'''),
    ],
    9: [
        ("只统计每个子串内相邻字符不同", '''import sys
s=sys.stdin.read().strip();z=0
for i in range(len(s)):
 for j in range(i+1,len(s)):z+=s[j]!=s[j-1]
print(z)
'''),
        ("只检查每个子串首尾字符是否不同", '''import sys
s=sys.stdin.read().strip();print(sum(s[i]!=s[j] for i in range(len(s)) for j in range(i+1,len(s))))
'''),
    ],
    15: [
        ("优先从最低频字符删除", '''import sys
d=sys.stdin.read().split();n,m=map(int,d[:2]);s=d[2];c=[s.count(chr(i+97)) for i in range(26)]
for _ in range(min(m,n)):
 i=min((i for i in range(26) if c[i]),key=lambda i:c[i],default=-1)
 if i>=0:c[i]-=1
print(sum(x*x for x in c))
'''),
        ("忽略最多删除数量，只计算原始成本", '''import sys
n,m,s=sys.stdin.read().split();from collections import Counter
print(sum(v*v for v in Counter(s).values()))
'''),
    ],
    21: [
        ("把代价错误地向上取整", '''import sys
s=sys.stdin.read().strip();ans=0
for i in range(len(s)):
 c={}
 for j in range(i,len(s)):
  c[s[j]]=c.get(s[j],0)+1;ans+=(sum(v%2 for v in c.values())+1)//2
print(ans)
'''),
        ("把字符串按原顺序做回文而非先可重排", '''import sys
s=sys.stdin.read().strip();print(sum(s[i]!=s[-1-i] for i in range(len(s)) for j in range(i,len(s)) for _ in []))
'''),
    ],
}


def main() -> None:
    rng = random.Random(20261005)
    batch_items = []
    validation = {"formal": [], "oracle": []}
    reviews = []
    source_evidence = []
    for pid, spec in SPECS.items():
        problem_id = f"oa-intuit-{pid}"
        source = CATALOG[problem_id]
        ref = REFERENCES[pid]
        (OA / "references" / f"{problem_id}.py").write_text(ref)
        controls = []
        for mutant_index, (name, code) in enumerate(MUTANTS[pid], 1):
            path = OA / "negative-controls" / f"{problem_id}-{mutant_index}.py"
            path.write_text(code)
            controls.append((name, code, path))

        if pid == 1:
            formal_values = [
                [["Q", "o", "o", "o"], ["o", "o", "o", "o"], ["o", "o", "o", "o"], ["o", "o", "o", "W"]],
                [["Q", "x", "o", "o", "W"], ["x", "x", "x", "x", "x"], ["o", "o", "o", "o", "o"]],
                [["Q", "o", "o"], ["x", "x", "o"], ["W", "o", "o"]],
            ]
        elif pid == 9:
            formal_values = ["asbsd", "a", "aaa"]
        elif pid == 15:
            formal_values = [(4, 2, "aabb"), (5, 2, "aaaab"), (3, 0, "abc")]
        else:
            formal_values = ["abca", "aabb", "abc"]

        formal_cases = []
        values = []
        for value in formal_values:
            expected = oracle(pid, value)
            actual = reference(pid, encode(pid, value))
            assert actual.split() == expected.split(), (problem_id, value, actual, expected)
            values.append((value, expected, False))
        for _ in range(27):
            value = random_case(pid, rng)
            expected = oracle(pid, value)
            actual = reference(pid, encode(pid, value))
            assert actual.split() == expected.split(), (problem_id, value, actual, expected)
            values.append((value, expected, True))
        if pid == 1:
            value = [["o"] * 100 for _ in range(100)]
            value[0][0], value[-1][-1] = "Q", "W"
            stress_expected = "DRIVE!"
        elif pid == 9:
            value, stress_expected = "a" * 100000, "0"
        elif pid == 15:
            value, stress_expected = (100000, 99999, "a" * 100000), "1"
        else:
            value, stress_expected = "a" * 100000, "0"
        stress_actual = reference(pid, encode(pid, value))
        assert stress_actual.split() == stress_expected.split(), (problem_id, "stress", stress_actual, stress_expected)
        values.append((value, stress_expected, True))
        for index, (value, expected, hidden) in enumerate(values):
            formal_cases.append({
                "name": f"样例 {index + 1}" if index < 3 else f"随机边界 {index - 2}",
                "input": encode(pid, value),
                "expectedOutput": expected + "\n",
                "hidden": hidden,
                "weight": 1,
            })

        oracle_cases = []
        seen_inputs = set()
        while len(oracle_cases) < 163:
            value = random_case(pid, rng)
            encoded = encode(pid, value)
            if encoded in seen_inputs: continue
            seen_inputs.add(encoded)
            expected = oracle(pid, value)
            actual = reference(pid, encoded)
            assert actual.split() == expected.split(), (problem_id, "oracle mismatch", value)
            oracle_cases.append({"input": encoded, "expectedOutput": expected + "\n"})

        reference_results = values[:]
        for item in oracle_cases:
            namespace = {"__name__": "candidate"}
            exec(compile(ref, "<reference>", "exec"), namespace)
            output = namespace["solve"](item["input"]).strip()
            assert output.split() == item["expectedOutput"].split()

        for name, code, path in controls:
            rejected = []
            for case_index, case in enumerate(formal_cases + oracle_cases):
                proc = subprocess.run([sys.executable, "-c", code], input=case["input"], text=True, capture_output=True, timeout=5)
                assert proc.returncode == 0, (problem_id, name, case_index, proc.stderr)
                if proc.stdout.strip().split() != case["expectedOutput"].split():
                    rejected.append(case_index)
                    break
            assert rejected, (problem_id, name, "mutant survived")

        problem = {
            "id": problem_id,
            "courseId": "gomall",
            "lessonId": "00-overview",
            "title": spec["title"],
            "difficulty": spec["difficulty"],
            "tags": ["OA", "Intuit"],
            "description": spec["description"] + "\n\n本站输入格式和约束见下方。",
            "input": spec["input"],
            "output": spec["output"],
            "explanation": spec["bounds"],
            "hints": [spec["bounds"]],
            "timeLimit": 5,
            "memoryLimit": 262144,
            "outputLimit": 4096,
            "checker": "tokens",
            "languages": ["python", "go", "java", "cpp"],
        }
        package = {"schemaVersion": 1, "problem": problem, "cases": formal_cases}
        write(OA / "packages" / f"{problem_id}.json", package)
        write(OA / "oracles" / f"{problem_id}.json", oracle_cases)
        write(OA / "mutants" / f"{problem_id}.json", [{"name": name, "code": code} for name, code, _ in controls])

        editorial = (
            "## 思路\n\n" + spec["bounds"] + "\n\n## 正确性证明\n\n" + spec["proof"]
            + "\n\n## 复杂度\n\n" + ("时间 O(bp)，空间 O(bp)。" if pid == 1 else "时间 O(n log n)，空间 O(n)。" if pid == 9 else "时间 O(M log 26)，空间 O(26)。" if pid == 15 else "时间 O(26n)，空间 O(26)。")
        )
        authored_solution = {"language": "python", "code": ref}
        write(OA / "editorials" / f"{problem_id}.json", {
            "schemaVersion": 1, "id": problem_id, "title": spec["title"], "explanation": editorial,
            "solutions": [authored_solution], "sourceUrl": source["sourceUrl"],
            "sourceContentHash": source["contentHash"], "author": "CSWork",
        })
        package_checksum = hashlib.sha256(json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
        batch_items.append({
            "id": problem_id, "sourceContentHash": source["contentHash"],
            "packageChecksum": package_checksum, "editorial": editorial,
            "authoredSolutions": [authored_solution],
        })
        validation["formal"].append({"id": problem_id, "count": len(formal_cases)})
        validation["oracle"].append({
            "id": problem_id, "oracleCases": len(oracle_cases),
            "negativeControls": [
                {"file": str(path.relative_to(ROOT)), "description": name, "rejectedByCases": [next(i for i, case in enumerate(formal_cases + oracle_cases) if subprocess.run([sys.executable, "-c", code], input=case["input"], text=True, capture_output=True, timeout=5).stdout.strip().split() != case["expectedOutput"].split())]}
                for name, code, path in controls
            ],
        })
        evidence_path = {
            1: "content/oa-master/catalog.json",
            9: "content/oa-master/catalog.json",
            15: "fastprep/Intuit/intuit-letter-candles.md",
            21: "fastprep/Intuit/intuit-set-total-palindrome-transformation-cost.md",
        }[pid]
        source_evidence.append({
            "id": problem_id, "path": evidence_path,
            "catalogContentHash": source["contentHash"],
            "restoredRules": [
                "逐题按固定 OAMaster catalog 快照的原始题意审计；标准输入输出、测试范围和说明由本站明确制定，不冒充来源未提供的信息。",
                "独立参考程序及 oracle 均为本站新写；未执行导入题解。",
            ],
        })
        reviews.append({"id": problem_id, "status": "authored", "reason": "题意可判定；独立 oracle、正式样例/边界及正常退出错误程序均通过离线验证，尚未经过 GoJudge。"})

    # Keep this offline candidate separate from the already sandbox-verified
    # intuit-next batch so Git and the authoring tools cannot confuse them.
    candidate_path = OA / "candidate-batches/intuit-remaining-next.json"
    write(candidate_path, {"schemaVersion": 1, "items": batch_items})
    validation_path = OA / "validation/intuit-remaining-next.json"
    write(validation_path, {
        "schemaVersion": 1,
        "seed": 20261005,
        "sourceCommit": SOURCE_COMMIT,
        "note": "本候选批次每题 163 个唯一独立 oracle 输入、31 个正式用例（含大输入边界）和两个正常退出 mutant；不代表 GoJudge 沙箱报告。",
        "problems": [
            {
                "id": item["id"],
                "oracleCases": item["oracleCases"],
                "formal": 31,
                "negativeControls": item["negativeControls"],
            }
            for item in validation["oracle"]
        ],
    })

    reviews_path = OA / "reviews/intuit-next.json"
    old_reviews = json.loads(reviews_path.read_text())
    review_items = {item["id"]: item for item in old_reviews["items"]}
    for item in reviews: review_items[item["id"]] = item
    blocked = {
        2: "需要题源补齐 n、x 上限；直接模拟在未给约束时可能达到 O(x²)，无法保证线上评测时限。",
        3: "SQL 题没有可固定的建表与样例数据协议；当前 OA OJ 的受支持评测包不能直接执行 SQL。",
        4: "题面样例 n=3 输出 9758 与题意‘每行、每列不可全同色’冲突；按题意穷举为 9750，暂不猜测哪个有误。",
        5: "源题 statement 为空，只有若干 Bash 函数代码，缺少输入输出、完整任务定义和可判定结果。",
        6: "未给字符串长度约束；删除相同字符块的操作语义也未定义是否可在一次操作中同时删除多个分离区间。",
        7: "SQL 题源 statement 为空，缺少 schema、期望输出和判定数据。",
        8: "源题 statement 为空，只有描述性 Bash 函数名称，没有完整行为定义或输入输出协议。",
        10: "SQL 题缺少可核对的完整样例数据与目标 SQL 执行环境；当前 OJ 评测包不能执行 SQL。",
        11: "固定选择题没有编程输入输出与代码评测目标，不伪装成 OJ 编程题。",
        13: "题面未说明棍子高度减 K 后是否允许负数，公开样例无法消歧。",
        14: "样例冲突：起点 (1,2) 到目标 (6,2) 的欧氏距离正好为 X=5，按规则一步可达，但给出的答案为 2。",
        19: "题面要求全局字典序最小排列，但仅有一个样例且未给字符集/重复字符约束；需补全输入域规则后才能安全固定答案。",
        22: "未给 N/M/K、坐标域约定或限制；无法判断输入点对应的整数格点范围及可接受算法复杂度。",
    }
    for pid, reason in blocked.items():
        item_id = f"oa-intuit-{pid}"
        review_items.setdefault(item_id, {"id": item_id, "status": "blocked", "reason": reason})
    write(reviews_path, {"schemaVersion": 1, "items": list(review_items.values())})

    evidence_path = OA / "source-evidence/intuit-remaining-next.json"
    write(evidence_path, {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT,
        "reason": "本批依据固定 catalog 项目指纹与相关原始 FastPrep markdown 只读核验；未执行来源代码。",
        "items": source_evidence,
    })
    print(f"Generated {len(batch_items)} Intuit candidates; {len(reviews)} new candidate reviews.")


if __name__ == "__main__":
    main()
