"""Author locally verifiable Pure Storage candidates; never invokes GoJudge."""
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
    proc = subprocess.run([sys.executable, "-I", str(path)], input=data,
                          text=True, capture_output=True, timeout=20, check=True)
    return proc.stdout.rstrip("\r\n")


def prices_encode(a):
    return f"{len(a)}\n" + " ".join(map(str, a)) + "\n"


def prices_oracle(a):
    # Independent day-by-day dynamic program over cash/holding states.
    cash, holding = 0, 0  # the initial unit has zero acquisition cost
    for price in a:
        cash, holding = max(cash, holding + price), max(holding, cash - price)
    return str(cash % 10**9)


def random_prices(rng):
    return [rng.randint(0, 30) for _ in range(rng.randint(1, 14))]


def picks_encode(a):
    return f"{len(a)}\n" + " ".join(map(str, a)) + "\n"


def picks_oracle(v):
    a = tuple(v)
    from functools import lru_cache
    @lru_cache(None)
    def best(mask, turn):
        if not mask:
            return 0
        values = []
        bits = mask
        while bits:
            bit = bits & -bits
            i = bit.bit_length() - 1
            values.append((a[i] if turn == 0 else -a[i]) + best(mask ^ bit, 1 - turn))
            bits -= bit
        return max(values) if turn == 0 else min(values)
    return str(best((1 << len(a)) - 1, 0))


def random_picks(rng):
    return [rng.randint(-20, 20) for _ in range(rng.randint(1, 9))]


def score_encode(s):
    return s + "\n"


def score_oracle(value):
    s = str(value)
    score = sum(c == "5" for c in s) * 2
    score += sum(int(c) % 2 for c in s)
    score += sum(4 for i in range(len(s) - 1) if s[i:i + 2] == "33")
    i = 0
    while i < len(s):
        j = i + 1
        while j < len(s) and int(s[j]) == int(s[j - 1]) + 1:
            j += 1
        score += (j - i) ** 2
        i = j
    score += 6 if int(value) % 5 == 0 else 0
    return str(score)


def random_score(rng):
    return str(rng.randint(1, 10**18))


def locks_encode(events):
    return str(len(events)) + "\n" + "".join(f"{op} {name}\n" for op, name in events)


def locks_oracle(events):
    stack = []
    for i, (op, name) in enumerate(events, 1):
        if op == "ACQUIRE":
            if name in stack:
                return str(i)
            stack.append(name)
        elif not stack or stack[-1] != name:
            return str(i)
        else:
            stack.pop()
    return str(0 if not stack else len(events) + 1)


def random_locks(rng):
    names = [f"L{i}" for i in range(rng.randint(1, 6))]
    events = []
    for _ in range(rng.randint(0, 24)):
        events.append((rng.choice(["ACQUIRE", "RELEASE"]), rng.choice(names)))
    return events


def palindrome_encode(s):
    return s + "\n"


def palindrome_oracle(s):
    total = 0
    for i in range(len(s)):
        for j in range(i + 1, len(s) + 1):
            part = s[i:j]
            total += part == part[::-1]
    return str(total)


def random_palindrome(rng):
    return "".join(rng.choice("abc") for _ in range(rng.randint(1, 18)))


def bakery_encode(items):
    return str(len(items)) + "\n" + "".join(f"{a} {b}\n" for a, b in items)


def bakery_oracle(items):
    return str(sum(sorted(a) != sorted(b) for a, b in items))


def random_bakery(rng):
    alphabet = "abcd"
    items = []
    for _ in range(rng.randint(0, 20)):
        a = "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 10)))
        if rng.randrange(2):
            b = "".join(rng.sample(list(a), len(a))) if len(set(a)) == len(a) else "".join(rng.choice(alphabet) for _ in range(len(a)))
        else:
            b = "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 10)))
        items.append((a, b))
    return items


def doubles_encode(a):
    return f"{len(a)}\n" + " ".join(map(str, a)) + "\n"


def doubles_oracle(a):
    result = []
    for x in a:
        count = sum(y == 2 * x for y in a)
        if count == 1:
            result.append(x)
    return " ".join(map(str, sorted(result)))


def random_doubles(rng):
    return [rng.randint(0, 40) for _ in range(rng.randint(1, 35))]


def repeat_encode(v):
    a, b = v
    return a + "\n" + b + "\n"


def repeat_oracle(v):
    short, long = v
    if not short or not long:
        return "0"
    best = 0
    m = len(short)
    for start in range(len(long)):
        count = 0
        pos = start
        while long.startswith(short, pos):
            count += 1
            pos += m
        best = max(best, count)
    return str(best)


def random_repeat(rng):
    short = "".join(rng.choice("ABC") for _ in range(rng.randint(1, 5)))
    pieces = []
    for _ in range(rng.randint(1, 8)):
        pieces.append(short if rng.randrange(3) else rng.choice("ABC"))
    return short, "".join(pieces)


def race_encode(v):
    racers, rows = v
    return f"{racers} {len(rows)}\n" + "".join(
        f"{race} {racer} {pos}\n" for race, racer, pos in rows)


def race_oracle(v):
    racers, rows = v
    points = [10, 6, 4, 3, 2, 1]
    totals = [0] * racers
    for _race, racer, position in rows:
        if 1 <= position <= 6:
            totals[racer - 1001] += points[position - 1]
    winner = min(range(racers), key=lambda i: (-totals[i], i))
    return f"{winner + 1001} {totals[winner]}"


def random_race(rng):
    racers = rng.randint(1, 12)
    races = rng.randint(0, 6)
    rows = []
    for race in range(races):
        attendees = list(range(racers))
        rng.shuffle(attendees)
        for position, racer in enumerate(attendees, 1):
            if rng.randrange(5):
                rows.append((2001 + race, 1001 + racer, position))
    return racers, rows


SPECS = [
    {
        "id": "oa-pure-storage-1", "title": "Maximum Historical Income",
        "tags": ["数组", "贪心"],
        "description": "每天的价格为 A[i]。初始持有 1 单位资产，同一时刻最多持有 1 单位；可在任意日卖出并在不持有时买入。求最大总收益，输出收益对 10^9 取模。",
        "input": "第一行 n；第二行 n 个价格。1≤n≤200000，0≤A[i]≤10^9。",
        "output": "输出最大总收益 mod 1000000000。",
        "encode": prices_encode, "oracle": prices_oracle, "random": random_prices,
        "samples": [[1, 2, 3, 3, 2, 1, 5], [5, 1, 1], [0, 10**9, 0, 10**9]],
        "public": ["7\n1 2 3 3 2 1 5\n", "3\n5 1 1\n", "4\n0 1000000000 0 1000000000\n"],
        "expected": ["7", "5", "0"],
        "reference": '''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]\n profit=a[0]+sum(max(0,a[i]-a[i-1]) for i in range(1,n))\n return str(profit%10**9)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("把价格下降也计入收益", "max(0,a[i]-a[i-1])", "a[i]-a[i-1]"),
            ("忘记对十亿取模", "str(profit%10**9)", "str(profit)"),
        ],
        "editorial": "## 思路\n\n初始持有的一单位可在第一天按 A[0] 变现；此后逐日累加所有正向涨幅，最后对 10^9 取模。\n\n## 正确性\n\n先卖出初始单位得到 A[0]。此后每次买入可在价格下降后进行、在后续上涨时卖出；把任一持有区间拆成每日差分，负差分不应持有，所有正差分都可通过独立交易取得。故最大收益等于 A[0] 加全部正相邻差，最后取模。\n\n## 复杂度\n\n时间 O(n)，额外空间 O(1)。",
    },
    {
        "id": "oa-pure-storage-3", "title": "Two-Player Optimal Pick Difference",
        "tags": ["排序", "博弈"],
        "description": "给定整数数组。两名玩家轮流从剩余元素中任取一个，双方都最大化自己的分数总和，先手先取。输出最优策略下先手总分减后手总分。",
        "input": "第一行 n；第二行 n 个整数。本站补充范围：1≤n≤200000，|points[i]|≤10^9。",
        "output": "输出 score1−score2。",
        "encode": picks_encode, "oracle": picks_oracle, "random": random_picks,
        "samples": [[4, 1, 2, 3], [10], [-5, 7, -2]],
        "public": ["4\n4 1 2 3\n", "1\n10\n", "3\n-5 7 -2\n"], "expected": ["2", "10", "4"],
        "reference": '''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; a=sorted(t[1:1+n],reverse=True)\n return str(sum(v if i%2==0 else -v for i,v in enumerate(a)))\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("按原数组顺序轮流拿取", "a=sorted(t[1:1+n],reverse=True)", "a=t[1:1+n]"),
            ("按升序排序后交替拿取", "reverse=True", "reverse=False"),
        ],
        "editorial": "## 思路\n\n把分数按降序排列。两人每次都会拿当前最大的剩余分数，因此先手获得排序后偶数下标元素，后手获得奇数下标元素，交替累加差值。\n\n## 正确性\n\n轮到任一玩家时，取走当前最大值不会减少该玩家最终可得分：若他不取，下一位对手可取走它；交换策略中该玩家取最大值只会把对手原本可取的另一个元素留给后续。归纳可知双方最优选择等价于按降序依次拿取，轮次决定归属。\n\n## 复杂度\n\n排序 O(n log n)，额外空间 O(n)。",
    },
    {
        "id": "oa-pure-storage-5", "title": "Compute Number Score",
        "tags": ["字符串", "模拟"],
        "description": "按十进制表示计算正整数 n 的分数，以下独立规则可以对同一位重复计分：每个数字 5 加 2；每一对相邻数字 33 加 4；每个最大连续且后一位恰比前一位大 1 的游程长度为 L 时加 L²；若 n 可被 5 整除加 6；每个奇数位加 1。",
        "input": "输入一行正十进制整数，不含正负号或前导零。本站补充：最多 100000 位。",
        "output": "输出总分。",
        "encode": score_encode, "oracle": score_oracle, "random": random_score,
        "samples": ["5", "12345", "3333"], "public": ["5\n", "12345\n", "3333\n"],
        "expected": ["10", "36", "20"],
        "reference": '''import sys\ndef solve(raw):\n s=raw.strip(); score=0\n for i,c in enumerate(s):\n  if c=='5': score+=2\n  if int(c)%2: score+=1\n  if i and s[i-1:i+1]=='33': score+=4\n if int(s[-1])==0 or int(s[-1])==5: score+=6\n i=0\n while i<len(s):\n  j=i+1\n  while j<len(s) and ord(s[j])==ord(s[j-1])+1: j+=1\n  score+=(j-i)*(j-i); i=j\n return str(score)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("连续 3 只按一个相邻对计分", "if i and s[i-1:i+1]=='33': score+=4", "if i and s[i-1:i+1]=='33' and s[i-2:i-1]!='3': score+=4"),
            ("忽略长度为 1 的递增游程", "score+=(j-i)*(j-i); i=j", "score+=((j-i)*(j-i) if j-i>1 else 0); i=j"),
        ],
        "editorial": "## 思路\n\n扫描数字串累计 5、奇数位和相邻 33 对的分数；再按相邻位差为 1 切分最大递增游程，累加游程长度平方；最后根据末位是否为 0 或 5 加上整除奖励。\n\n## 正确性\n\n逐位规则在每一位检查一次，故 5 和奇数项不漏不重；遍历相邻位置恰好统计全部 33 相邻对；切分条件恰好在非递增相邻处结束，得到所有最大 +1 游程；末位判定等价于十进制数被 5 整除。各分项独立相加符合题意。\n\n## 复杂度\n\nd 为数字位数，时间 O(d)，额外空间 O(d)。",
    },
    {
        "id": "oa-pure-storage-6", "title": "Lock Acquire/Release Log Checker",
        "tags": ["栈", "哈希集合"],
        "description": "事件为 ACQUIRE lock 或 RELEASE lock。释放必须按获取的逆序；已持有的锁不可重复获取，未持有的锁不可释放。返回首个错误事件的 1-based 序号；若无事件错误且结束仍有锁未释放，返回事件数+1；否则返回 0。",
        "input": "第一行 n；随后 n 行为 ACQUIRE name 或 RELEASE name。本站补充：0≤n≤200000，name 为不含空白的 ASCII 标识符。",
        "output": "输出首个错误序号、dangling 时的 n+1，或 0。",
        "encode": locks_encode, "oracle": locks_oracle, "random": random_locks,
        "samples": [[("ACQUIRE", "A"), ("ACQUIRE", "B"), ("RELEASE", "B"), ("RELEASE", "A")], [("ACQUIRE", "A"), ("RELEASE", "B")], [("ACQUIRE", "A"), ("ACQUIRE", "B"), ("RELEASE", "A")]],
        "public": ["4\nACQUIRE A\nACQUIRE B\nRELEASE B\nRELEASE A\n", "2\nACQUIRE A\nRELEASE B\n", "3\nACQUIRE A\nACQUIRE B\nRELEASE A\n"], "expected": ["0", "2", "3"],
        "reference": '''import sys\ndef solve(raw):\n lines=raw.splitlines(); n=int(lines[0]); stack=[]; held=set()\n for i,line in enumerate(lines[1:1+n],1):\n  op,name=line.split()\n  if op=='ACQUIRE':\n   if name in held: return str(i)\n   held.add(name); stack.append(name)\n  else:\n   if not stack or stack[-1]!=name: return str(i)\n   stack.pop(); held.remove(name)\n return str(0 if not stack else n+1)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("允许任意顺序释放仍持有的锁", "if not stack or stack[-1]!=name: return str(i)", "if name not in held: return str(i)"),
            ("dangling 返回 n 而非 n+1", "n+1)", "n)"),
        ],
        "editorial": "## 思路\n\n用栈记录获取顺序、集合记录当前持有的锁。ACQUIRE 若已在集合中即违规，否则压栈并加入集合；RELEASE 必须匹配栈顶，否则违规；匹配后弹栈并移除集合成员。遍历后栈非空表示 dangling。\n\n## 正确性\n\n集合恰好刻画所有已获取未释放锁，因此可在常数时间识别重复获取。栈顶是尚未释放的最近一次获取，题目要求逆序释放，故只允许释放栈顶。第一个违反任一条件的事件就是首个违规下标；无违规时，栈空与全部释放等价，否则按规则返回 n+1。\n\n## 复杂度\n\n每个事件至多入栈、出栈一次，时间 O(n)，空间 O(n)。",
    },
    {
        "id": "oa-pure-storage-7", "title": "Count Palindromic Substrings",
        "tags": ["字符串", "Manacher"],
        "description": "给定小写字符串 s，统计所有位置对 (i,j)，i≤j，使 s[i..j] 是回文。相同内容出现在不同位置时分别计数。上游第二个示例把 wowyouwin 的输出写为 14，与该定义冲突；按题面逐位置计算应为 10，本站采用 10。",
        "input": "输入一行只含 a-z 的非空字符串。本站补充：1≤|s|≤200000。",
        "output": "输出回文子串出现次数，使用 64 位整数。",
        "encode": palindrome_encode, "oracle": palindrome_oracle, "random": random_palindrome,
        "samples": ["hellolle", "wowyouwin", "aa"], "public": ["hellolle\n", "wowyouwin\n", "aa\n"], "expected": ["13", "10", "3"],
        "reference": '''import sys\ndef solve(raw):\n s=raw.strip(); n=len(s); ans=0; d1=[0]*n; l=0; r=-1\n for i in range(n):\n  k=1 if i>r else min(d1[l+r-i],r-i+1)\n  while i-k>=0 and i+k<n and s[i-k]==s[i+k]: k+=1\n  d1[i]=k; ans+=k\n  if i+k-1>r: l=i-k+1; r=i+k-1\n d2=[0]*n; l=0; r=-1\n for i in range(n):\n  k=0 if i>r else min(d2[l+r-i+1],r-i+1)\n  while i-k-1>=0 and i+k<n and s[i-k-1]==s[i+k]: k+=1\n  d2[i]=k; ans+=k\n  if i+k-1>r: l=i-k; r=i+k-1\n return str(ans)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("只统计不同字符数而忽略回文长度", "return str(ans)", "return str(len(set(s)))"),
            ("漏掉偶数长度回文", "ans+=k\n  if i+k-1>r: l=i-k; r=i+k-1", "# omitted even palindrome contribution\n  if i+k-1>r: l=i-k; r=i+k-1"),
        ],
        "editorial": "## 思路\n\n使用 Manacher 算法分别计算每个中心的最长奇数、偶数回文半径。每个中心的半径值就是以该中心结束的回文子串数量，将其累加。\n\n## 正确性\n\n对每个奇数中心，半径 k 表示从长度 1 到 2k−1 的 k 个回文；偶数中心同理对应长度 2 到 2k 的 k 个回文。Manacher 扩展和镜像复用只改变求半径的效率，不遗漏或重复中心，因此所有位置对均恰好计一次。\n\n## 复杂度\n\n时间 O(n)，空间 O(n)。",
    },
    {
        "id": "oa-pure-storage-10", "title": "Bakery Quality Control",
        "tags": ["字符串", "频次统计"],
        "description": "逐对比较盒内物品字符串 box 与模板 template。字符顺序不重要，但每种物品的数量必须一致；返回不匹配的盒子数。",
        "input": "第一行 n，随后 n 行各含 box 和 template 两个只含小写 a-z、且不含空格的字符串。0≤n≤1000，每个字符串长度为 1..10。",
        "output": "输出不匹配的配对数量。",
        "encode": bakery_encode, "oracle": bakery_oracle, "random": random_bakery,
        "samples": [[("pcm", "mcp"), ("ddp", "dpd"), ("cc", "c")], [("abc", "cab"), ("aab", "abb")], [("z", "z")]],
        "public": ["3\npcm mcp\nddp dpd\ncc c\n", "2\nabc cab\naab abb\n", "1\nz z\n"], "expected": ["1", "1", "0"],
        "reference": '''import sys\nfrom collections import Counter\ndef solve(raw):\n t=raw.split(); n=int(t[0]); ans=0\n for i in range(n):\n  a,b=t[1+2*i:3+2*i]\n  ans+=Counter(a)!=Counter(b)\n return str(ans)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("忽略重复物品数量而只比较字符集合", "Counter(a)!=Counter(b)", "set(a)!=set(b)"),
            ("把顺序也作为匹配条件", "Counter(a)!=Counter(b)", "a!=b"),
        ],
        "editorial": "## 思路\n\n对每一对字符串分别统计字符频次，若频次映射不相等则该盒子不匹配。\n\n## 正确性\n\n题意要求物品顺序无关但重复数量必须保留。字符频次表对排列不敏感，且只有每个字符数量均相等时两表才相同，恰好等价于盒内物品多重集合一致。逐对统计并累加即可。\n\n## 复杂度\n\n每对长度至多 10，时间 O(n·10)，空间 O(26)。",
    },
    {
        "id": "oa-pure-storage-12", "title": "Find Doubles",
        "tags": ["数组", "频次统计"],
        "description": "给定整数列表。对列表中的每个元素 x，如果列表中恰有一个元素等于 2x，则将这个 x 纳入答案；答案保留输入中 x 的重复出现，并按升序输出。0 的两倍仍为 0。",
        "input": "第一行 n；第二行 n 个整数。原题上限为 100000；本站因评测单例输出上限 65536 字节而收窄为 0≤n≤16000，0≤value≤1000。",
        "output": "按升序输出所有命中元素，以空格分隔；若答案为空输出空行。",
        "encode": doubles_encode, "oracle": doubles_oracle, "random": random_doubles,
        "samples": [[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 8], [7, 17, 11, 1, 23], [1, 1, 2]],
        "public": ["11\n1 2 3 4 5 6 7 8 9 0 8\n", "5\n7 17 11 1 23\n", "3\n1 1 2\n"],
        "expected": ["0 1 2 3", "", "1 1"],
        "reference": '''import sys\nfrom collections import Counter\ndef solve(raw):\n t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]; c=Counter(a)\n return ' '.join(map(str,sorted(x for x in a if c.get(2*x,0)==1)))\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("把同一候选值去重", "sorted(x for x in a if c.get(2*x,0)==1)", "sorted({x for x in a if c.get(2*x,0)==1})"),
            ("要求双倍值至少出现一次而非恰好一次", "c.get(2*x,0)==1", "c.get(2*x,0)>=1"),
        ],
        "editorial": "## 思路\n\n统计每个值的频次。对输入中每个元素 x 检查 freq[2x] 是否恰为 1；符合时加入答案，最后排序。\n\n## 正确性\n\n频次数组精确反映列表中每个整数出现次数。对每个输入位置按条件检查会保留所有重复的 x；恰有一个 2x 的限制由频次等于 1 精确表达。排序满足输出顺序。\n\n## 复杂度\n\n时间 O(n log n)，空间 O(1001+n)。",
    },
    {
        "id": "oa-pure-storage-13", "title": "Find Repetitions",
        "tags": ["字符串", "扫描"],
        "description": "给定模式串 short_s 和文本 long_s，求 short_s 在 long_s 中连续重复出现的最大次数。出现间不允许夹杂其他字符。任一字符串为空时答案为 0。",
        "input": "两行大写英文字母串：第一行为 short_s，第二行为 long_s；长度分别 0..9 和 0..999999。空串用空行表示。",
        "output": "输出最大连续重复次数。",
        "encode": repeat_encode, "oracle": repeat_oracle, "random": random_repeat,
        "samples": [("AB", "ABBAC"), ("AB", "ABCABCABAB"), ("", "ABC")],
        "public": ["AB\nABBAC\n", "AB\nABCABCABAB\n", "\nABC\n"], "expected": ["1", "2", "0"],
        "reference": '''import sys\ndef solve(raw):\n lines=raw.splitlines(); p=lines[0] if lines else ''; s=lines[1] if len(lines)>1 else ''\n if not p or not s: return '0'\n m=len(p); dp=[0]*(len(s)+1); best=0\n for end in range(m,len(s)+1):\n  if s[end-m:end]==p: dp[end]=dp[end-m]+1; best=max(best,dp[end])\n return str(best)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("遇到不匹配后没有重置连续计数", "if s[end-m:end]==p: dp[end]=dp[end-m]+1; best=max(best,dp[end])", "if s[end-m:end]==p: dp[end]=dp[end-m]+1; best=max(best,dp[end])\n  else: dp[end]=dp[end-1]"),
            ("只检查从文本开头开始的对齐位置", "for end in range(m,len(s)+1):", "for end in range(m,len(s)+1,m):"),
        ],
        "editorial": "## 思路\n\n令 dp[i] 表示恰好在 long_s 前 i 个字符结束的模式连续重复次数。若末尾长度 m 的子串等于模式，则 dp[i]=dp[i−m]+1，否则为 0。答案是 dp 最大值。\n\n## 正确性\n\n任何连续重复段的最后一个模式副本必结束于某个位置 i，且此前恰好在 i−m 处结束了一个更短的连续重复段；递推因此得到真实段长。若末尾不匹配，该位置不可能属于一个以此结束的重复段，值为 0。遍历所有结束位置即可覆盖全部候选。\n\n## 复杂度\n\n设模式长度 m、文本长度 n，m<10，时间 O(nm)，空间 O(n)。",
    },
    {
        "id": "oa-pure-storage-14", "title": "Racing Results",
        "tags": ["哈希表", "排序"],
        "description": "根据每场比赛的 (race, racer_id, position) 记录累计得分。名次 1..6 分别得 10、6、4、3、2、1 分，其他名次 0 分。总分最高者获胜；同分时 racer_id 最小者获胜。",
        "input": "第一行 R M，R 为选手数，M 为结果记录数；随后 M 行为 race racer_id position。本站补充：1≤R≤100，0≤M≤10000，race∈[2001,2100]，选手 ID 连续为 1001..1000+R；每个 (race,racer_id) 至多一条记录，position∈[1,R]。未出现在记录中的选手按 0 分参与排名。",
        "output": "输出获胜者 ID 与总分，以空格分隔。",
        "encode": race_encode, "oracle": race_oracle, "random": random_race,
        "samples": [(3, [(2001, 1001, 3), (2001, 1002, 2), (2002, 1003, 1), (2002, 1001, 2), (2002, 1002, 3), (2001, 1003, 1)]), (8, [(2001, 1002, 8)]), (6, [(2001, 1002, 6)])],
        "public": ["3 6\n2001 1001 3\n2001 1002 2\n2002 1003 1\n2002 1001 2\n2002 1002 3\n2001 1003 1\n", "8 1\n2001 1002 8\n", "6 1\n2001 1002 6\n"], "expected": ["1003 20", "1001 0", "1002 1"],
        "reference": '''import sys\ndef solve(raw):\n t=list(map(int,raw.split())); r,m=t[:2]; score=[0]*r; pts=(0,10,6,4,3,2,1); p=2\n for _ in range(m):\n  race,who,pos=t[p:p+3]; p+=3\n  if pos<=6: score[who-1001]+=pts[pos]\n i=min(range(r),key=lambda j:(-score[j],j))\n return f'{1001+i} {score[i]}'\nif __name__=='__main__': print(solve(sys.stdin.read()))\n''',
        "mutants": [
            ("同分时选 ID 更大的选手", "key=lambda j:(-score[j],j)", "key=lambda j:(-score[j],-j)"),
            ("把第六名也记作零分", "pts=(0,10,6,4,3,2,1)", "pts=(0,10,6,4,3,2,0)"),
        ],
        "editorial": "## 思路\n\n用长度 R 的数组累计每位选手得分。只对名次 1..6 加对应分数；其余名次不加分。最后按 (总分降序, 选手序号升序) 选择最小键者。\n\n## 正确性\n\n每条结果记录恰对应一位选手在一场比赛中的名次，按给定映射累加即可得到其总分。排序键首先最大化总分，再最小化连续选手 ID；包含所有 R 位选手也确保未出现的选手以零分参与平局。\n\n## 复杂度\n\n时间 O(R+M)，空间 O(R)。",
    },
]


FORMAL_EXTRAS = {
    "oa-pure-storage-6": [[("ACQUIRE", "A")]],
    "oa-pure-storage-13": [("AB", "ABXAB"), ("AB", "XABAB")],
    "oa-pure-storage-14": [(4, [])],
}


BLOCKED = {
    "oa-pure-storage-2": "原题解将排除 z[i] 的位置选为最早可行位置，却未证明字典序最小；字典序比较表明较早位置维持全字母组可能更小，需重做 reference 与 oracle 后另行复审，故本批不注册。",
    "oa-pure-storage-4": "只说明找出恰出现两次的值，但没有输出示例或格式；随附函数把每个命中值输出两份，无法确认应输出 unique 值还是保留两次原始出现。",
    "oa-pure-storage-8": "题目允许任意反例或 CORRECT，附带长篇推演自身互相矛盾；tokens checker 不能接受任意合法 witness，也未确定规范 witness。",
    "oa-pure-storage-9": "这是多项选择题而非算法 I/O；多个答案依赖未给出的代码、图示或内存布局假设，Q17 图 OCR 缺失、Q18 数字明确被 redacted，不能作为确定判题题目。",
    "oa-pure-storage-11": "题面要求不同的回文子串，但 hellolle 输出 13 与 #7 的按位置计数一致；第二例的解释‘每个字母 + wow + rer’也无法得到输出 14，样例和规则冲突。",
}


EVIDENCE = {
    "rawPath": "web/content/docs/companies/pure-storage.mdx",
    "rawGitBlob": "6a5991fb239872af4569cc58543bdcd9d3043229",
    "sourceHash": "d29d6103dc0c4190c72c0f1ace0e2e9e0f7b7500b256e82d2d468bbdcaa0981c",
}


def make_large(spec):
    pid = spec["id"]
    if pid == "oa-pure-storage-1":
        a = [0 if i % 2 == 0 else 999999999 for i in range(200000)]
        return a, str((a[0] + 100000 * 999999999) % 10**9)
    if pid == "oa-pure-storage-3":
        a = [(-1 if i % 2 else 1) * 10**9 for i in range(200000)]
        return (a, str(sum(v if i % 2 == 0 else -v for i, v in enumerate(sorted(a, reverse=True)))))
    if pid == "oa-pure-storage-5":
        s = "1" + "3" * 99999
        return (s, None)
    if pid == "oa-pure-storage-6":
        events = [("ACQUIRE", f"L{i}") for i in range(100000)] + [("RELEASE", f"L{i}") for i in range(99999, -1, -1)]
        return events, "0"
    if pid == "oa-pure-storage-7":
        n = 200000
        return "a" * n, str(n * (n + 1) // 2)
    if pid == "oa-pure-storage-10":
        return [("abcdefghij", "jihgfedcba")] * 1000, "0"
    if pid == "oa-pure-storage-12":
        return [0] * 16000, ""
    if pid == "oa-pure-storage-13":
        s = "ABCDEFGHI"
        return (s, s * 111111), "111111"
    if pid == "oa-pure-storage-14":
        rows = [(2001 + race, 1001 + racer, racer + 1) for race in range(100) for racer in range(100)]
        points = [0] * 100
        mapping = (0, 10, 6, 4, 3, 2, 1)
        for _race, racer, pos in rows:
            if pos <= 6: points[racer - 1001] += mapping[pos]
        i = min(range(100), key=lambda j: (-points[j], j))
        return (100, rows), f"{1001+i} {points[i]}"


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants",
                   "negative-controls", "reviews", "candidate-batches", "validation",
                   "source-evidence"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    manifest, validations, reviews, evidence_items = [], [], [], []
    specs_by_id = {spec["id"]: spec for spec in SPECS}
    all_ids = [f"oa-pure-storage-{i}" for i in range(1, 15)]
    for pid in all_ids:
        source = SOURCES[pid]
        if pid in specs_by_id:
            status = "authored"
            reason = "已核对 e66f809 原始 MDX；本站 stdin/stdout 协议和必要边界已明确；163 个独立输入通过本地独立 oracle，参考程序及两个正常退出 mutant 均经样例/隐藏测试验证。未运行 GoJudge。"
        else:
            status = "blocked"
            reason = BLOCKED[pid]
        evidence_items.append({"id": pid, "catalogContentHash": source["contentHash"],
                               "sourceUrl": source["sourceUrl"], "status": status,
                               "reason": reason, "path": EVIDENCE["rawPath"],
                               "gitBlobSha": EVIDENCE["rawGitBlob"]})

    for spec in SPECS:
        pid, src = spec["id"], SOURCES[spec["id"]]
        ref_code = spec["reference"].lstrip()
        ref = OUT / "references" / f"{pid}.py"
        ref.write_text(ref_code)
        rng = random.Random(SEED + int(pid.rsplit("-", 1)[1]))
        sample_values = spec["samples"]
        assert [spec["encode"](v) for v in sample_values] == spec["public"]
        assert [spec["oracle"](v) for v in sample_values] == spec["expected"]
        random_values = []
        seen_inputs = {spec["encode"](value) for value in sample_values}
        while len(random_values) < 160:
            value = spec["random"](rng)
            encoded = spec["encode"](value)
            if encoded in seen_inputs:
                continue
            seen_inputs.add(encoded)
            random_values.append(value)
        oracle_data = []
        for value in sample_values + random_values:
            stdin = spec["encode"](value)
            expected = spec["oracle"](value)
            actual = run(ref, stdin)
            assert actual == expected, (pid, value, expected, actual)
            oracle_data.append({"input": stdin, "expectedOutput": expected + "\n"})

        formal_values = sample_values + random_values[:29] + FORMAL_EXTRAS.get(pid, [])
        cases = []
        for i, value in enumerate(formal_values):
            stdin = spec["encode"](value)
            expected = spec["oracle"](value)
            cases.append({"name": (f"公开样例 {i+1}" if i < 3 else f"随机隐藏测试 {i-2}"),
                          "input": stdin, "expectedOutput": expected + "\n",
                          "hidden": i >= 3, "weight": 1})
        if pid == "oa-pure-storage-12":
            boundary = [500] * 15999 + [1000]
            stdin, expected = doubles_encode(boundary), " ".join(["500"] * 15999)
            assert run(ref, stdin) == expected
            cases.append({"name": "16,000 项及输出长度上界", "input": stdin,
                          "expectedOutput": expected + "\n", "hidden": True, "weight": 1})
        large_value, large_expected = make_large(spec)
        if pid == "oa-pure-storage-5":
            # One singleton '1', then 99,999 singleton '3' runs; 99,998 adjacent 33 pairs.
            large_expected = "599992"
        large_input = spec["encode"](large_value)
        actual_large = run(ref, large_input)
        assert actual_large == large_expected, (pid, "boundary", large_expected, actual_large)
        cases.append({"name": "本站补充最大边界", "input": large_input,
                      "expectedOutput": large_expected + "\n", "hidden": True, "weight": 1})

        mutants, negative_controls = [], []
        for i, (name, old, new) in enumerate(spec["mutants"], 1):
            assert old in ref_code, (pid, "mutation anchor missing", old)
            mutant_code = ref_code.replace(old, new)
            control = OUT / "negative-controls" / f"{pid}-{i}.py"
            control.write_text(mutant_code)
            rejected = []
            for case_no, case in enumerate(cases):
                actual = run(control, case["input"])
                if actual != case["expectedOutput"].rstrip("\n"):
                    rejected.append(case_no)
            assert rejected, (pid, "surviving mutant", name)
            mutants.append({"name": name, "code": mutant_code})
            negative_controls.append({"name": name, "rejectedByCases": rejected})

        problem = {
            "id": pid, "courseId": "gomall", "lessonId": "00-overview",
            "title": spec["title"], "difficulty": "中等",
            "tags": ["OA", "Pure Storage"] + spec["tags"],
            "description": spec["description"] + "\n\n输入输出协议及标注为‘本站补充’的限制由本站整理；原题未给出的限制不视为原始来源内容。",
            "input": spec["input"], "output": spec["output"],
            "explanation": "算法思路、正确性证明和复杂度见配套题解。",
            "hints": ["先区分原题明确规则与本站补充的 stdin/stdout 约定。"],
            "timeLimit": 3, "memoryLimit": 262144,
            "outputLimit": 65536 if pid == "oa-pure-storage-12" else 4096,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        }
        raw_pkg = {"schemaVersion": 1, "problem": problem, "cases": cases}
        normalize = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
                     "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
                     "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
        proc = subprocess.run(["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
                              input=json.dumps(raw_pkg, ensure_ascii=False), text=True,
                              capture_output=True)
        if proc.returncode:
            raise RuntimeError(proc.stderr)
        package = json.loads(proc.stdout)
        editorial_text = spec["editorial"]
        editorial = {"schemaVersion": 1, "id": pid, "title": spec["title"],
                     "explanation": editorial_text,
                     "solutions": [{"language": "python", "code": ref_code}],
                     "sourceUrl": src["sourceUrl"], "sourceContentHash": src["contentHash"],
                     "author": "CSWork"}
        for folder, doc in (("packages", package), ("oracles", oracle_data),
                            ("mutants", mutants), ("editorials", editorial)):
            (OUT / folder / f"{pid}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        normalized = proc.stdout
        manifest.append({"id": pid, "sourceContentHash": src["contentHash"],
                         "packageChecksum": hashlib.sha256(normalized.encode()).hexdigest(),
                         "editorial": editorial_text,
                         "authoredSolutions": [{"language": "python", "code": ref_code}]})
        validations.append({"id": pid, "oracleCases": len(oracle_data),
                            "uniqueOracleInputs": len({item["input"] for item in oracle_data}),
                            "publicCases": 3, "hiddenCases": len(cases) - 3,
                            "negativeControls": negative_controls,
                            "referenceSha256": hashlib.sha256(ref_code.encode()).hexdigest()})
        review_reason = "已核对 e66f809 原始 MDX；本站 stdin/stdout 协议和必要边界已明确；163 个独立输入通过本地独立 oracle，参考程序及两个正常退出 mutant 均经样例/隐藏测试验证。未运行 GoJudge。"
        if pid == "oa-pure-storage-7":
            review_reason += " 上游样例 wowyouwin→14 与题面按位置计数定义冲突；直接枚举可复现结果为 10，本站采用 10 并在题面注明修正。"
        reviews.append({"id": pid, "status": "authored", "reason": review_reason,
                        "sourceUrls": [src["sourceUrl"]], "sourceContentHashes": [src["contentHash"]],
                        "sourceCommit": CATALOG["source"]["commit"],
                        "catalogContentHash": src["contentHash"]})
        print(f"{pid}: 163 oracle inputs, {len(cases)} formal cases, all mutants killed", flush=True)

    for pid, reason in BLOCKED.items():
        reviews.append({"id": pid, "status": "blocked", "reason": reason})
    reviews.sort(key=lambda item: int(item["id"].rsplit("-", 1)[1]))
    (OUT / "candidate-batches" / "pure-storage-next.json").write_text(
        json.dumps({"schemaVersion": 1, "items": manifest}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "validation" / "pure-storage-next.json").write_text(
        json.dumps({"schemaVersion": 1, "seed": SEED, "problems": validations,
                    "note": "仅离线运行本站作者参考程序、独立 oracle、边界用例及错误程序；未运行 GoJudge。"},
                   ensure_ascii=False, indent=2) + "\n")
    (OUT / "reviews" / "pure-storage-next.json").write_text(
        json.dumps({"schemaVersion": 1, "items": reviews}, ensure_ascii=False, indent=2) + "\n")
    source_items = []
    for i in range(1, 15):
        pid = f"oa-pure-storage-{i}"
        source = SOURCES[pid]
        entry = next(x for x in reviews if x["id"] == pid)
        source_items.append({"id": pid, "catalogContentHash": source["contentHash"],
                             "sourceUrl": source["sourceUrl"], "status": entry["status"],
                             "reason": entry["reason"], "path": EVIDENCE["rawPath"],
                             "gitBlobSha": EVIDENCE["rawGitBlob"]})
    (OUT / "source-evidence" / "pure-storage-next.json").write_text(
        json.dumps({"schemaVersion": 1, "repository": CATALOG["source"]["repository"],
                    "commit": CATALOG["source"]["commit"],
                    "reason": "Immutable raw MDX source audit; imported solutions were never executed.",
                    "items": source_items}, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
