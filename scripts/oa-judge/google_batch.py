"""Authored OA judging contracts. Never execute imported OA Master code.

Generate packages and independently check them:
    python3 scripts/oa-judge/google_batch.py
The output directory is private server data, never a public asset directory.
"""
from __future__ import annotations

import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "content/oa-judge"


def board_oracle(x):
    points, tokens = x
    occupied = [i for i, token in enumerate(tokens) if token == "T"]
    return sum(points[i] for i in occupied) + sum(
        abs(i-j) == 1 for i, j in itertools.combinations(occupied, 2))


def triplet_oracle(a):
    candidates = [set(range(i, i+3)) for i in range(len(a)-2) if sum(a[i:i+3]) == 0]
    best = 0
    for mask in range(1 << len(candidates)):
        used, count = set(), 0
        for i, triple in enumerate(candidates):
            if mask >> i & 1:
                if used & triple:
                    break
                used |= triple
                count += 1
        else:
            best = max(best, count)
    return best


def coin_oracle(events):
    table, purse = [], []
    for event in events:
        if event == "i":
            table.append(object())
        elif event == "d" and table:
            table.pop()
        elif event == "w":
            purse.extend(table)
            table = []
    return len(purse)


def digit_oracle(a):
    best = 0
    for size in range(1, len(a)+1):
        for group in itertools.combinations(a, size):
            common = set("0123456789")
            for value in group:
                common &= set(str(value))
            if common:
                best = size
                break
    return best


def transform_oracle(target):
    # Breadth-first search of every legal interval increment on small states.
    start = (0,) * len(target)
    target = tuple(target)
    frontier, seen, depth = [start], {start}, 0
    while frontier:
        following = []
        for state in frontier:
            if state == target:
                return depth
            for left in range(len(state)):
                for right in range(left, len(state)):
                    value = list(state)
                    for i in range(left, right+1):
                        value[i] += 1
                    value = tuple(value)
                    if all(value[i] <= target[i] for i in range(len(state))) and value not in seen:
                        seen.add(value)
                        following.append(value)
        frontier, depth = following, depth+1
    raise AssertionError("target must be reachable")


def biggest_oracle(a):
    return max(int("".join(map(str, group)))
               for size in range(1, 4) for group in itertools.combinations(a, size))


SPECS = [
    dict(number=1, title="棋盘上的代币得分", tags=["模拟"],
         description="棋盘有 n 个格子。第 i 格的分值为 points[i]，状态 T 表示有代币，E 表示空格。每个有代币的格子贡献自身分值；每一对相邻且都有代币的格子额外贡献 1 分。求总分。",
         input="第一行 n（1 ≤ n ≤ 100）；第二行 n 个整数 points[i]（1 ≤ points[i] ≤ 1000）；第三行长度为 n 的字符串，只含 E 和 T。",
         idea="先累加所有 T 格子的分值，再对每一对相邻格子检查是否都是 T。连续 k 个 T 贡献 k−1 个相邻对，不是只加一次。",
         proof="每一项基础分唯一对应一个 T 格子，每一项奖励分唯一对应一条 T-T 相邻边。循环对每个格子和每条相邻边恰好检查一次，因此没有重复或遗漏。",
         complexity="时间 O(n)，除输入外额外空间 O(1)。",
         explanation="样例 1 的代币在 0、3、4 号格，基础分 3+2+3=8，相邻对 (3,4) 再加 1，总分 9。",
         samples=[([3,4,5,2,3], "TEETT"), ([2,2,2,2], "TTTT"), ([7], "E")],
         random=lambda r: ([r.randint(1,1000) for _ in range(8)], ''.join(r.choice('ET') for _ in range(8))),
         edges=[([1],"T"),([1000]*100,"T"*100),([1000]*100,"E"*100),([2]*100,"TE"*50)],
         encode=lambda x: f"{len(x[0])}\n{' '.join(map(str,x[0]))}\n{x[1]}\n", oracle=board_oracle,
         code='''
def solve(data):
    n = int(data[0]); points = list(map(int, data[1:n+1])); tokens = data[n+1]
    score = 0
    for i in range(n):
        if tokens[i] == 'T':
            score += points[i]
            if i > 0 and tokens[i-1] == 'T':
                score += 1
    return score
''', mutants=[("忽略相邻奖励", "score += 1", "score += 0"), ("误计空格分值", "if tokens[i] == 'T':", "if True:")]),
    dict(number=2, title="互不重叠的零和三元组", tags=["贪心"],
         description="给定整数数组 A。可以选择若干长度恰好为 3 的连续片段，每个片段的元素和必须为 0，任意两个所选片段不能共用数组位置。求最多能选几个片段。不能重排数组，也不能选择不连续的三个数。",
         input="第一行 n（1 ≤ n ≤ 100）；第二行 n 个整数 A[i]（−100 ≤ A[i] ≤ 100）。",
         idea="从左到右找第一个和为 0 的三元组，选中后直接跳过它的三个位置；否则向右移动一格。",
         proof="所有候选区间长度相同，最先开始的候选也最先结束。把任意最优方案的第一个区间替换为最先结束的候选，不会与后续区间产生重叠。对剩余后缀重复交换论证，贪心选择保持最优。",
         complexity="时间 O(n)，除输入外额外空间 O(1)。",
         explanation="样例 1 可以选位置 1..3 的 [1,0,−1]，再选位置 4..6 的 [0,0,0]，答案为 2。下标从 0 开始。",
         samples=[[-4,1,0,-1,0,0,0,0,0],[-1,-2,3,-1,0,1],[1,2]],
         random=lambda r: [r.randint(-2,2) for _ in range(r.randint(1,9))],
         edges=[[0]*100,[100]*100,[0]*4,[0]*5,[-100,0,100]*33,[1,0,0,0]],
         encode=lambda x: f"{len(x)}\n{' '.join(map(str,x))}\n", oracle=triplet_oracle,
         code='''
def solve(data):
    n = int(data[0]); a = list(map(int, data[1:])); i = 0; answer = 0
    while i + 2 < n:
        if a[i] + a[i+1] + a[i+2] == 0:
            answer += 1
            i += 3
        else:
            i += 1
    return answer
''', mutants=[("允许重叠", "i += 3", "i += 1"), ("漏掉末尾三元组", "while i + 2 < n:", "while i + 3 < n:")]),
    dict(number=3, title="硬币游戏的累计奖励", tags=["模拟"],
         description="桌面开始为空。按顺序处理事件：i 放入一枚硬币；d 取走一枚硬币，桌面为空则不操作；w 赢得桌上所有硬币并清空桌面。求所有 w 事件累计赢得的硬币数。最后留在桌上的硬币不算奖励。",
         input="输入一行事件字符串，长度为 1 到 200，只含 i、d、w。",
         idea="用 table 记录桌面硬币数，answer 记录已经赢得的数量。d 时把 table 限制在非负数；w 时先结算，再将 table 清零。",
         proof="处理每个前缀后，table 恰好是尚未结算的桌面硬币数，answer 恰好是此前所有 w 的奖励。三种更新分别对应规则，保持不变量。结束时只输出 answer，故不会把未赢得的剩余硬币算入。",
         complexity="时间 O(n)，除输入外额外空间 O(1)。",
         explanation="样例 1 连续的 d 不会使桌面出现负数，最后两个 i 放入两枚硬币，w 赢得 2 枚。",
         samples=["idddiiw","iiwdiwi","iiii"], random=lambda r: ''.join(r.choice('idw') for _ in range(r.randint(1,20))),
         edges=["w","d","i","i"*199+"w","w"*200,"d"*198+"iw","iiww"],
         encode=lambda x:x+'\n',oracle=coin_oracle,
         code='''
def solve(data):
    table = 0; answer = 0
    for event in data[0]:
        if event == 'i': table += 1
        elif event == 'd': table = max(0, table-1)
        else:
            answer += table
            table = 0
    return answer
''',mutants=[("允许负硬币", "max(0, table-1)", "table-1"),("结算后不清空", "            table = 0", "            table = table")]),
    dict(number=5,title="含共同数字的最大分组",tags=["计数"],
         description="给定 n 个两位正整数。选出尽可能多的数组元素，使它们都包含某个共同的十进制数字。相同数值出现在不同位置时可以分别选入；一个数的十位和个位相同也只算一个元素。求可选元素的最大数量。",
         input="第一行 n（1 ≤ n ≤ 100）；第二行 n 个整数（10 ≤ numbers[i] ≤ 99）。",
         idea="分别统计数字 0..9 出现在多少个数组元素中。对一个数先给十位加一，仅当个位不同于十位时再给个位加一。最大的计数就是答案。",
         proof="任何合法分组必有一个所有成员共有的数字 d，成员数不超过包含 d 的元素数。反过来，全部包含 d 的元素必能组成合法分组，因此十个计数的最大值同时给出上界和可实现解。",
         complexity="时间 O(n)，除输入外额外空间 O(1)。",
         explanation="样例 1 可选 52、25、52、55，都包含数字 5，因此答案为 4；重复的 52 来自不同数组位置。",
         samples=[[52,25,11,52,34,55],[11,33,55],[90,90,90]],random=lambda r:[r.randint(10,99) for _ in range(r.randint(1,8))],
         edges=[[11],[11]*100,[10,20,30,40,50,60,70,80,90],[12,23,31],[12,21,22]],
         encode=lambda x:f"{len(x)}\n{' '.join(map(str,x))}\n",oracle=digit_oracle,
         code='''
def solve(data):
    counts = [0]*10
    for value in map(int, data[1:]):
        tens, ones = divmod(value, 10)
        counts[tens] += 1
        if ones != tens: counts[ones] += 1
    return max(counts)
''',mutants=[("重复计算相同数字", "if ones != tens:", "if True:"),("忽略个位", "if ones != tens:", "if False:")]),
    dict(number=7,title="区间加一的最少次数",tags=["贪心","差分"],
         description="开始时有一个长度为 n 的全零数组。一次操作可以选择一个非空连续子数组，将其中所有数同时加 1。给定非负目标数组 arr，求变成目标数组所需的最少操作次数。",
         input="第一行 n（1 ≤ n ≤ 100000）；第二行 n 个整数 arr[i]（0 ≤ arr[i] ≤ 10⁹）。答案可能超过 32 位整数范围。",
         idea="第一个位置需要 arr[0] 次操作。后续位置只有比前一个位置更高时，才需要新开始 arr[i]−arr[i−1] 次操作。把所有正增量相加。",
         proof="令 arr[−1]=0。每个上升处至少要新开始对应增量的区间，因为跨越前一位置的操作最多只有 arr[i−1] 次。这给出下界。扫描数组，在上升处开始新区间，在下降处结束足够多的区间，就能达到目标且操作数恰等于这个下界，故最优。",
         complexity="时间 O(n)，除输入外额外空间 O(1)。使用 64 位整数保存答案。",
         explanation="样例 1 在位置 0 新开始 2 次操作，在位置 3 再开始 2 次操作，共 4 次。",
         samples=[[2,1,0,2],[0,0,0],[3,3,3]],random=lambda r:[r.randint(0,3) for _ in range(r.randint(1,4))],
         edges=[[10**9],[0],[1,0,1,0,1],[10**9,0]*50000,list(range(100000)),[100000-i for i in range(100000)]],
         encode=lambda x:f"{len(x)}\n{' '.join(map(str,x))}\n",oracle=transform_oracle,
         code='''
def solve(data):
    answer = 0; previous = 0
    for current in map(int, data[1:]):
        answer += max(0, current-previous)
        previous = current
    return answer
''',mutants=[("把下降也计入", "max(0, current-previous)", "abs(current-previous)"),("逐点累加", "max(0, current-previous)", "current")]),
    dict(number=9,title="按原顺序组成最大的三位数",tags=["动态规划"],
         description="给定 n 个十进制数字，从中按原顺序选择 1 到 3 个数字拼成一个整数，求能得到的最大整数。所选数字不要求连续；不能改变相对顺序；允许前导零，输出整数时不保留前导零。",
         input="第一行 n（3 ≤ n ≤ 50）；第二行 n 个数字（0 ≤ digits[i] ≤ 9）。",
         idea="best[k] 保存已处理前缀中恰好选 k 位可组成的最大值。读入数字 d 时，倒序更新 best[k]=max(best[k],best[k−1]×10+d)，避免一个数字被用多次。",
         proof="对前缀长度归纳。恰选 k 位的最优解要么不用当前数字，来自旧 best[k]；要么以它结尾，由前缀中最优的 k−1 位追加该数字得到。两种情况完整且互斥。倒序确保读取的是上一个前缀的状态。最后取 1..3 位状态的最大值即符合“最多三位”。",
         complexity="时间 O(n)，除输入外额外空间 O(1)。",
         explanation="样例 1 按下标 0、4、5 选择 7、4、9，得到 749；不能把 9 移到 7 前面。",
         samples=[[7,2,3,3,4,9],[0,0,5,7],[0,0,0]],random=lambda r:[r.randint(0,9) for _ in range(r.randint(3,9))],
         edges=[[9,0,0],[1,2,9],[9]*50,[0]*49+[1],[1,9,0,9,0],[0,0,1]],
         encode=lambda x:f"{len(x)}\n{' '.join(map(str,x))}\n",oracle=biggest_oracle,
         code='''
def solve(data):
    best = [0,-1,-1,-1]
    for digit in map(int, data[1:]):
        for count in range(3,0,-1):
            if best[count-1] >= 0:
                best[count] = max(best[count], best[count-1]*10+digit)
    return max(best[1:])
''',mutants=[("重复使用当前数字", "range(3,0,-1)", "range(1,4)"),("丢失原始顺序", "map(int, data[1:])", "sorted(map(int, data[1:]), reverse=True)")]),
]


def execute(path, stdin):
    result = subprocess.run([sys.executable, "-I", str(path)], input=stdin,
                            text=True, capture_output=True, timeout=5, check=True)
    return int(result.stdout.strip())


def main():
    for directory in ("packages", "editorials", "references", "negative-controls", "oracles", "mutants"):
        (OUT / directory).mkdir(parents=True, exist_ok=True)
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    source_items = {item["id"]: item for item in catalog["items"]}
    report = []
    registry = []
    for spec in SPECS:
        identifier = f"oa-google-{spec['number']}"
        source = source_items[identifier]
        code = textwrap.dedent(spec["code"]).lstrip() + '\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        reference = OUT / "references" / f"{identifier}.py"
        reference.write_text(code)
        rng = random.Random(20260912+spec["number"])
        random_cases = [spec["random"](rng) for _ in range(160)]
        small_cases = spec["samples"] + random_cases
        oracle_cases = []
        for value in small_cases:
            actual = execute(reference, spec["encode"](value))
            expected = spec["oracle"](value)
            assert actual == expected, (identifier, value, actual, expected)
            oracle_cases.append(dict(input=spec["encode"](value),expectedOutput=f"{expected}\n"))
        (OUT / "oracles" / f"{identifier}.json").write_text(json.dumps(oracle_cases,ensure_ascii=False,indent=2)+'\n')
        # Explicit large inputs use simple independent expectations where exhaustive
        # oracles would be exponential; all small tests above remain exhaustive.
        large_expected = {
            2: [33, 0, 1, 1, 33, 1],
            5: [1, 100, 9, 2, 3],
            7: [10**9, 0, 3, 50000*10**9, 99999, 100000],
        }
        cases = []
        values = spec["samples"] + spec["edges"] + random_cases[:24]
        for i, value in enumerate(values):
            if 3 <= i < 3+len(spec["edges"]) and spec["number"] in large_expected:
                expected = large_expected[spec["number"]][i-3]
            else:
                expected = spec["oracle"](value)
            stdin = spec["encode"](value)
            assert execute(reference, stdin) == expected, (identifier, i)
            cases.append(dict(name=f"样例 {i+1}" if i < 3 else f"边界与组合 {i-2}",
                              input=stdin, expectedOutput=f"{expected}\n", hidden=i>=3, weight=1))
        controls = []
        mutants = []
        for index, (label, old, new) in enumerate(spec["mutants"], 1):
            assert old in code
            mutant = OUT / "negative-controls" / f"{identifier}-{index}.py"
            mutant.write_text(code.replace(old,new))
            mutants.append(dict(name=label,code=code.replace(old,new)))
            killed = [i for i,c in enumerate(cases) if execute(mutant,c["input"]) != int(c["expectedOutput"])]
            assert killed, (identifier, label, "survived")
            controls.append(dict(file=str(mutant.relative_to(ROOT)), description=label, rejectedByCases=killed))
        (OUT / "mutants" / f"{identifier}.json").write_text(json.dumps(mutants,ensure_ascii=False,indent=2)+'\n')
        problem = dict(id=identifier,courseId="gomall",lessonId="00-overview",title=spec["title"],
                       difficulty="简单" if spec["number"] in (1,3,5) else "中等",tags=["OA","Google"]+spec["tags"],
                       description=spec["description"]+"\n\n本题采用 CSWork 整理的标准输入输出格式；算法规则对应来源题目，样例与评测数据由 CSWork 编写。",
                       input=spec["input"],output="输出一个整数，表示答案。",explanation=spec["explanation"],
                       hints=[spec["idea"]],timeLimit=2,memoryLimit=262144,outputLimit=1024,
                       checker="tokens",languages=["python","go","java","cpp"])
        package = dict(schemaVersion=1,problem=problem,cases=cases)
        normalized = subprocess.run(["node", "--import", "tsx", "-e", "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"], cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        package = json.loads(normalized)
        (OUT / "packages" / f"{identifier}.json").write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n')
        editorial = dict(schemaVersion=1,id=identifier,title=spec["title"],
                         explanation=f"## 思路\n\n{spec['idea']}\n\n## 为什么正确\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}",
                         solutions=[dict(language="python",code=code)],sourceUrl=source["sourceUrl"],
                         sourceContentHash=source["contentHash"],author="CSWork")
        (OUT / "editorials" / f"{identifier}.json").write_text(json.dumps(editorial,ensure_ascii=False,indent=2)+'\n')
        checksum = hashlib.sha256(normalized.encode()).hexdigest()
        registry.append(dict(id=identifier,sourceContentHash=source["contentHash"],packageChecksum=checksum,
                             editorial=editorial["explanation"],authoredSolutions=editorial["solutions"]))
        report.append(dict(id=identifier,oracleCases=len(small_cases),publicCases=3,
                           hiddenCases=len(cases)-3,negativeControls=controls,
                           referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(f"{identifier}: {len(small_cases)} independent oracle checks, {len(cases)} judge cases, 2 negative controls killed",flush=True)
    validation=dict(schemaVersion=1,seed=20260912,sourceCommit=catalog["source"]["commit"],
                    note="Deterministic authored references; source solutions are never executed. Large structured expected values are checked explicitly. This report is not a sandbox acceptance claim.",problems=report)
    (OUT / "validation.json").write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
    (OUT / "batches").mkdir(exist_ok=True)
    (OUT / "batches" / "first-google.json").write_text(json.dumps(dict(schemaVersion=1,items=registry),ensure_ascii=False,indent=2)+'\n')


if __name__ == "__main__":
    main()
