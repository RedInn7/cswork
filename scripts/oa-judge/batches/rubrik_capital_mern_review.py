"""Prepare a small, source-bound Rubrik / Capital One candidate batch.

The Amazon MERN records are explicitly reviewed as blocked: the upstream
source describes repository-level fixes and read-only tests, while CSWork's
current judge only accepts independent stdin/stdout programs.
"""
from pathlib import Path
import hashlib
import json
import random
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SOURCE_FILES = {
    item["file"]: item["sourceHash"]
    for item in json.loads((ROOT / "content/oa-master/manifest.json").read_text())["files"]
}
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW = {
    "rubrik": ("web/content/docs/companies/rubrik.mdx", "27ce8deadb8ef015ef1db75b5f6f5b1a3dd036c2"),
    "capital-one": ("web/content/docs/companies/capital-one.mdx", "772a74d8b9eeed782c007b460d6e7652465e39a1"),
    "amazon-mern": ("web/content/docs/companies/amazon-mern.mdx", "36321c1c6840aafe2d5f8683e5ecfe86fe853ed7"),
}
BATCH = "rubrik-capital-one-review-next"


def run_many(code, inputs):
    harness = (
        "import json,sys\nns={'__name__':'solution'}\n"
        + "exec(" + repr(code) + ",ns)\n"
        + "values=json.loads(sys.stdin.read())\n"
        + "print(json.dumps([ns['solve'](value) for value in values]))\n"
    )
    proc = subprocess.run([sys.executable, "-I", "-c", harness],
                          input=json.dumps(inputs), text=True, capture_output=True,
                          timeout=10, check=True)
    return json.loads(proc.stdout)


def word_oracle(s):
    vowels = set("aeiouAEIOU")
    return str(sum(
        bool(re.fullmatch(r"[A-Za-z0-9]{3,}", word))
        and bool(set(word) & vowels)
        and any("A" <= c <= "Z" or "a" <= c <= "z" for c in word if c not in vowels)
        for word in s.split()
    ))


def power_oracle(s):
    if not s or any(ch not in "01" for ch in s):
        return "False"
    number = int(s, 2)
    return "True" if number > 0 and number & (number - 1) == 0 else "False"


def subseq_oracle(x, y):
    best = 0
    # Enumerate every substring of y and greedily test it as a subsequence of x.
    for left in range(len(y)):
        for right in range(left + 1, len(y) + 1):
            target = y[left:right]
            pos = 0
            for ch in x:
                if pos < len(target) and ch == target[pos]:
                    pos += 1
            if pos == len(target):
                best = max(best, len(target))
    return str(best)


PHASES = ["NewMoon", "Crescent", "Quarter", "Gibbous", "Full", "Waning", "Eclipse", "Twilight"]
MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def phase_oracle(month, day, start):
    phase = PHASES.index(start)
    elapsed_days = sum(MONTHS[:month - 1]) + day - 1
    for _ in range(elapsed_days):
        phase = (phase + 1) % len(PHASES)
    return PHASES[phase]


def stock_oracle(value):
    prices, algo, k = value
    best = None
    for start in range(len(prices) - k + 1):
        changed = algo[:]
        changed[start:start + k] = [1] * k
        revenue = sum(price if action else -price for price, action in zip(prices, changed))
        best = revenue if best is None else max(best, revenue)
    return str(best)


SPECS = [
    {
        "id": "oa-rubrik-3", "company": "Rubrik", "sourceId": "oa-rubrik-3", "rawKey": "rubrik",
        "title": "Word Count Tool (Validate Words)", "tags": ["字符串", "模拟"],
        "description": "按空白拆分字符串。一个单词有效，当且仅当它至少有 3 个 ASCII 字符、所有字符均为英文字母或数字、至少含一个元音 a/e/i/o/u（大小写均可）和一个辅音。统计有效单词数。",
        "input": "一行字符串 s（长度 0..200000；本站补充的边界）。只按空白字符分词。",
        "output": "输出有效单词数。",
        "samples": ["Hello world\n", "a1b xx! CAT\n", "AEI bcd u8Q\n"],
        "encode": lambda x: x + "\n", "oracle": lambda x: word_oracle(x),
        "random": lambda r: " ".join("".join(r.choice("abCDxyzAEIOU019!_") for _ in range(r.randint(1, 8))) for _ in range(r.randint(0, 12))),
        "code": """import sys\ndef solve(raw):\n    s=raw.strip('\\n')\n    vowels=set('aeiouAEIOU')\n    return str(sum(1 for w in s.split() if len(w)>=3 and w.isascii() and w.isalnum() and any(c in vowels for c in w) and any(c.isalpha() and c not in vowels for c in w)))\nif __name__ == '__main__': print(solve(sys.stdin.read()))\n""",
        "mutants": [
            ("只识别小写元音", """import sys\ndef solve(raw):\n s=raw.strip('\\n');v=set('aeiou')\n return str(sum(1 for w in s.split() if len(w)>=3 and w.isascii() and w.isalnum() and any(c in v for c in w) and any(c.isalpha() and c not in v for c in w)))\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
            ("不排除标点字符", """import sys\ndef solve(raw):\n s=raw.strip('\\n');v=set('aeiouAEIOU')\n return str(sum(1 for w in s.split() if len(w)>=3 and any(c in v for c in w) and any(c.isalpha() and c not in v for c in w)))\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
        ],
        "idea": "扫描空白切出的 token，分别记录是否合法、是否含元音、是否含辅音。",
        "proof": "每个 token 只在同时满足字符域、长度和两类字母条件时计数；这与原题定义逐项等价，且每个 token 恰处理一次。",
        "complexity": "时间 O(|s|)，空间 O(1)（不计分词结果）。",
    },
    {
        "id": "oa-rubrik-4", "company": "Rubrik", "sourceId": "oa-rubrik-4", "rawKey": "rubrik",
        "title": "Two's Power (Regex Match)", "tags": ["字符串", "正则表达式"],
        "description": "判断二进制字符串所表示的正整数是否为 2 的幂。允许前导零；零本身不是 2 的幂。原题要求正则匹配，本题把锁定的匹配结果作为标准输出 True/False。",
        "input": "输入一行非空二进制字符串 s（长度 1..200000；本站补充边界）。",
        "output": "输出 True 或 False。",
        "samples": ["1\n", "0001000\n", "101\n"],
        "encode": lambda x: x + "\n", "oracle": lambda x: power_oracle(x),
        "random": lambda r: "0" * r.randint(0, 4) + "".join(r.choice("01") for _ in range(r.randint(1, 30))),
        "code": """import sys\ndef solve(raw):\n s=raw.strip()\n t=s.lstrip('0')\n return 'True' if t=='1'+'0'*(len(t)-1) and bool(t) else 'False'\nif __name__ == '__main__': print(solve(sys.stdin.read()))\n""",
        "mutants": [
            ("不接受合法前导零", """import sys\ndef solve(raw):\n s=raw.strip()\n return 'True' if s and s[0]=='1' and s.count('1')==1 else 'False'\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
            ("把单个 1 判为非幂", """import sys\ndef solve(raw):\n s=raw.strip().lstrip('0')\n return 'True' if len(s)>1 and s[0]=='1' and set(s[1:])=={'0'} else 'False'\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
        ],
        "idea": "去掉前导零后，二进制表示是 1 后面跟若干个 0，当且仅当它是 2 的幂。",
        "proof": "2^k 的二进制表示恰为 1 后接 k 个零；前导零不改变数值，全零串表示 0，故应返回 False。",
        "complexity": "时间 O(|s|)，空间 O(|s|)。",
    },
    {
        "id": "oa-rubrik-6", "company": "Rubrik", "sourceId": "oa-rubrik-6", "rawKey": "rubrik",
        "title": "Longest Subsequence Matching a Substring", "tags": ["字符串", "贪心"],
        "description": "给定字符串 x、y，求 x 的最长子序列长度，使该子序列同时是 y 的一个非空连续子串。",
        "input": "两行非空 ASCII 字符串 x、y；本站补充 |x|,|y|≤2000。",
        "output": "输出所求长度；若不存在非空匹配则输出 0。",
        "samples": ["abcd\nabdc\n", "hackerranks\nhackers\n", "abc\nXYZ\n"],
        "encode": lambda x: x[0] + "\n" + x[1] + "\n", "oracle": lambda x: subseq_oracle(*x),
        "random": lambda r: ("".join(r.choice("abc") for _ in range(r.randint(1, 10))), "".join(r.choice("abc") for _ in range(r.randint(1, 10)))),
        "code": """import sys\ndef solve(raw):\n x,y=raw.split()\n best=0\n for start in range(len(y)):\n  i=matched=0\n  while i<len(x) and start+matched<len(y):\n   if x[i]==y[start+matched]: matched+=1\n   i+=1\n  best=max(best,matched)\n return str(best)\nif __name__ == '__main__': print(solve(sys.stdin.read()))\n""",
        "mutants": [
            ("错误地要求 x 中连续匹配", """import sys\ndef solve(raw):\n x,y=raw.split();best=0\n for start in range(len(y)):\n  for end in range(start+1,len(y)+1):\n   if y[start:end] in x: best=max(best,end-start)\n return str(best)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
            ("只检查 y 的前缀", """import sys\ndef solve(raw):\n x,y=raw.split();m=0;i=0\n for c in y:\n  if i<len(x) and x[i]==c: i+=1;m+=1\n return str(m)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
        ],
        "idea": "枚举 y 中的子串起点，将该后缀与 x 贪心匹配；每个起点的最长可匹配前缀即为从该起点出发的最优子串长度。",
        "proof": "对固定子串起点，逐字符从左到右在 x 中取最早可匹配位置，不会减少后续可匹配字符，因此贪心能得到该起点的最长子串。枚举全部起点覆盖所有候选子串。",
        "complexity": "设 n=|x|、m=|y|，时间 O(nm)，额外空间 O(1)。",
    },
    {
        "id": "oa-capital-one-2", "company": "Capital One", "sourceId": "oa-capital-one-2", "rawKey": "capital-one",
        "title": "Octavian Lunar Calendar — Phase of Date", "tags": ["模拟", "日期"],
        "description": "Octavian 年按地球公历的 12 个月长度划分（固定非闰年），有 8 个循环月相：NewMoon、Crescent、Quarter、Gibbous、Full、Waning、Eclipse、Twilight。给定年初月相、月份和当月日号，求该日期的月相。",
        "input": "一行三个字段：startPhase month day。startPhase 为上述 8 个名称之一；1≤month≤12，day 在该月合法范围内。",
        "output": "输出该日对应的月相名称。",
        "samples": ["NewMoon 1 1\n", "NewMoon 1 2\n", "Twilight 12 31\n"],
        "encode": lambda x: f"{x[0]} {x[1]} {x[2]}\n", "oracle": lambda x: phase_oracle(x[1], x[2], x[0]),
        "random": lambda r: (r.choice(PHASES), r.randint(1, 12), 1),
        "code": """import sys\ndef solve(raw):\n phase,month,day=raw.split();month=int(month);day=int(day)\n names=['NewMoon','Crescent','Quarter','Gibbous','Full','Waning','Eclipse','Twilight']\n days=[31,28,31,30,31,30,31,31,30,31,30,31]\n offset=sum(days[:month-1])+day-1\n return names[(names.index(phase)+offset)%8]\nif __name__ == '__main__': print(solve(sys.stdin.read()))\n""",
        "mutants": [
            ("每个月错误地按 30 天计算", """import sys\ndef solve(raw):\n p,m,d=raw.split();m=int(m);d=int(d);names=['NewMoon','Crescent','Quarter','Gibbous','Full','Waning','Eclipse','Twilight']\n return names[(names.index(p)+30*(m-1)+d-1)%8]\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
            ("把年初月相误作第一天之前的月相", """import sys\ndef solve(raw):\n p,m,d=raw.split();m=int(m);d=int(d);names=['NewMoon','Crescent','Quarter','Gibbous','Full','Waning','Eclipse','Twilight'];days=[31,28,31,30,31,30,31,31,30,31,30,31]\n return names[(names.index(p)+sum(days[:int(m)-1])+int(d))%8]\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
        ],
        "idea": "把日期转换成年内从 0 开始的天数偏移，再对 8 取模加到起始月相序号。",
        "proof": "每经过一天，月相在 8 个状态中前进一位。年内经过的天数正是此前完整月份天数加当月日号减一，所以按该偏移循环移动得到唯一答案。",
        "complexity": "时间 O(12)，空间 O(1)。",
    },
    {
        "id": "oa-capital-one-10", "company": "Capital One", "sourceId": "oa-capital-one-10", "rawKey": "capital-one",
        "title": "Stock Trading with Algo Override", "tags": ["数组", "滑动窗口"],
        "description": "给定每日股价 prices[i] 和操作数组 algo[i]（0 代表买入、1 代表卖出），原始收益为卖出价格之和减买入价格之和。可选择一个长度恰为 k 的连续区间，将区间内 algo 全设为 1。求修改后可达到的最大总收益。假设持有足够多股票，不受卖出库存限制。",
        "input": "第一行 n、k；第二行 n 个正整数 prices[i]；第三行 n 个 0/1 值 algo[i]。本站补充 1≤k≤n≤200000、1≤prices[i]≤10^9。",
        "output": "输出最大总收益（有符号 64 位整数）。",
        "samples": ["7 4\n2 4 1 5 2 6 7\n0 1 0 0 1 0 0\n", "3 3\n5 1 9\n0 0 1\n", "4 1\n3 8 2 5\n1 1 1 1\n"],
        "encode": lambda x: f"{len(x[0])} {x[2]}\n{' '.join(map(str,x[0]))}\n{' '.join(map(str,x[1]))}\n",
        "oracle": stock_oracle,
        "random": lambda r: (lambda n: ([r.randint(1, 50) for _ in range(n)], [r.randrange(2) for _ in range(n)], r.randint(1, n)))(r.randint(1, 16)),
        "code": """import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[0],t[1];p=t[2:2+n];a=t[2+n:2+2*n]\n base=sum(v if b else -v for v,b in zip(p,a))\n gains=[2*v if b==0 else 0 for v,b in zip(p,a)]\n window=sum(gains[:k]);best=window\n for i in range(k,n):\n  window+=gains[i]-gains[i-k];best=max(best,window)\n return str(base+best)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n""",
        "mutants": [
            ("只考虑最左侧的 k 天", """import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[:2];p=t[2:2+n];a=t[2+n:2+2*n];b=sum(v if z else -v for v,z in zip(p,a));return str(b+sum(2*v for v,z in zip(p[:k],a[:k]) if not z))\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
            ("买转卖增量少算一倍", """import sys\ndef solve(raw):\n t=list(map(int,raw.split()));n,k=t[:2];p=t[2:2+n];a=t[2+n:2+2*n];b=sum(v if z else -v for v,z in zip(p,a));g=[v if not z else 0 for v,z in zip(p,a)];w=sum(g[:k]);best=w\n for i in range(k,n): w+=g[i]-g[i-k];best=max(best,w)\n return str(b+best)\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"""),
        ],
        "idea": "基础收益对所有方案相同。把某一天从买入改成卖出的收益增量是 2×price；已卖出的天增量为 0。用长度 k 的滑动窗口最大化增量。",
        "proof": "每个长度 k 区间修改后收益等于原收益加区间内所有 0 位对应的 2×price。滑动窗口枚举所有合法区间并维护该增量之和，因此取最大值后加基础收益即为全局最优。",
        "complexity": "时间 O(n)，空间 O(n)。",
    },
]


def main():
    rng = random.Random(20261005)
    for folder in ("packages", "references", "oracles", "mutants", "negative-controls", "editorials", "candidate-batches", "validation", "reviews", "source-evidence"):
        (OA / folder).mkdir(parents=True, exist_ok=True)
    manifests, reports, reviews, evidence = [], [], [], {}
    for spec in SPECS:
        source = SOURCES[spec["sourceId"]]
        pid = spec["id"]
        examples = spec["samples"]
        cases = []
        for index, raw in enumerate(examples):
            value = {
                "oa-rubrik-3": ["Hello world", "a1b xx! CAT", "AEI bcd u8Q"][index],
                "oa-rubrik-4": ["1", "0001000", "101"][index],
                "oa-rubrik-6": [("abcd", "abdc"), ("hackerranks", "hackers"), ("abc", "XYZ")][index],
                "oa-capital-one-2": [("NewMoon", 1, 1), ("NewMoon", 1, 2), ("Twilight", 12, 31)][index],
                "oa-capital-one-10": [([2,4,1,5,2,6,7], [0,1,0,0,1,0,0], 4), ([5,1,9], [0,0,1], 3), ([3,8,2,5], [1,1,1,1], 1)][index],
            }[pid]
            expected = spec["oracle"](value)
            cases.append({"name": f"公开样例 {index+1}", "input": raw, "expectedOutput": expected + "\n", "hidden": False, "weight": 1})
        oracle_cases = []
        for i in range(120):
            value = spec["random"](rng)
            raw = spec["encode"](value)
            expected = spec["oracle"](value)
            oracle_cases.append({"input": raw, "expectedOutput": expected + "\n"})
            if i < 20:
                cases.append({"name": f"隐藏验证 {i+1}", "input": raw, "expectedOutput": expected + "\n", "hidden": True, "weight": 1})
        assert run_many(spec["code"], [case["input"] for case in cases]) == [case["expectedOutput"].rstrip("\n") for case in cases], pid
        assert run_many(spec["code"], [row["input"] for row in oracle_cases]) == [row["expectedOutput"].rstrip("\n") for row in oracle_cases], pid
        killed = []
        controls = []
        for mutant_name, mutant_code in spec["mutants"]:
            actual = run_many(mutant_code, [row["input"] for row in oracle_cases])
            wrong = [i for i, (value, row) in enumerate(zip(actual, oracle_cases))
                     if value != row["expectedOutput"].rstrip("\n")]
            assert wrong, (pid, mutant_name, "survived")
            killed.append(mutant_name)
            controls.append({"name": mutant_name, "rejectedByCases": wrong})
            (OA / "negative-controls" / f"{pid}-{len(controls)}.py").write_text(mutant_code)
        problem = {
            "id": pid, "courseId": "gomall", "lessonId": "00-overview", "title": spec["title"],
            "difficulty": "中等", "tags": ["OA", spec["company"]] + spec["tags"],
            "description": spec["description"] + "\n\n输入输出协议与明确标注的本站补充约束由 CSWork 整理。",
            "input": spec["input"], "output": spec["output"], "explanation": "完整思路与证明见配套题解。",
            "hints": ["先把原题规则转成精确的输入输出，再按规则逐步计算。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096, "checker": "tokens",
            "languages": ["python", "go", "java", "cpp"],
        }
        package = {"schemaVersion": 1, "problem": problem, "cases": cases}
        normalized = json.dumps(package, ensure_ascii=False, separators=(",", ":"))
        (OA / "packages" / f"{pid}.json").write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n")
        (OA / "references" / f"{pid}.py").write_text(spec["code"])
        (OA / "oracles" / f"{pid}.json").write_text(json.dumps(oracle_cases, ensure_ascii=False, indent=2) + "\n")
        (OA / "mutants" / f"{pid}.json").write_text(json.dumps([{"name": n, "code": c} for n, c in spec["mutants"]], ensure_ascii=False, indent=2) + "\n")
        source_url = source["sourceUrl"]
        editorial = {
            "schemaVersion": 1, "id": pid, "title": spec["title"],
            "explanation": f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}",
            "solutions": [{"language": "python", "code": spec["code"]}],
            "sourceUrl": source_url, "sourceContentHash": source["contentHash"], "author": "CSWork",
        }
        (OA / "editorials" / f"{pid}.json").write_text(json.dumps(editorial, ensure_ascii=False, indent=2) + "\n")
        manifests.append({"id": pid, "sourceContentHash": source["contentHash"], "packageChecksum": hashlib.sha256(normalized.encode()).hexdigest(), "editorial": editorial["explanation"], "authoredSolutions": [{"language": "python", "code": spec["code"]}]})
        reports.append({"id": pid, "oracleCases": len(oracle_cases), "formalCases": len(cases), "publicCases": 3, "hiddenCases": len(cases) - 3, "negativeControls": controls})
        path, blob = RAW[spec["rawKey"]]
        source_file_sha = SOURCE_FILES[path.rsplit("/", 1)[-1]]
        evidence[pid] = {"sourceCommit": SOURCE_COMMIT, "rawPath": path, "rawGitBlob": blob, "sourceFileSha256": source_file_sha, "catalogContentHash": source["contentHash"], "sourceUrl": source_url, "decision": "authored", "reason": "逐条对照 OAMaster 固定提交的原始 MDX；未运行上游解法。题意明确；CSWork 输入输出协议及补充边界已标注。参考程序逐个通过 120 个独立 oracle 输入，两个正常退出 mutant 均被拒绝。"}
        reviews.append({"id": pid, "status": "authored", "reason": evidence[pid]["reason"], "sourceCommit": SOURCE_COMMIT, "rawPath": path, "rawGitBlob": blob, "sourceUrls": [source_url], "sourceContentHashes": [source["contentHash"]], "catalogContentHash": source["contentHash"]})
        print(f"{pid}: 120 oracle inputs; {len(cases)} judge cases; 2 mutants rejected", flush=True)

    blocked = {
        **{f"oa-amazon-mern-{n}": "OAMaster 原始 MDX 将此题定义为修改真实 MERN 仓库中的 Express/Mongoose/React 端点并通过仓库内只读测试（另有 README、npm、Mocha/Chai 依赖）；当前 CSWork 判题包只有 stdin/stdout 程序，没有对应起始仓库、依赖锁文件或只读测试，因此无法唯一构造可复现的 OJ 判定，不把题意臆造为算法题。" for n in range(2, 11)},
        "oa-capital-one-14": "原始题面自己声明 t 的语义有歧义（给定 t 检查一次，还是可以选择 t）；不擅自选择其中一种。",
        "oa-capital-one-16": "原始规则称系统内人数大于 10 时拒绝，但样例又称 12 人同时到达时前 11 人均服务；这两个规则给出不同容量。",
        "oa-rubrik-17": "固定提交的源题自述只‘约 98% 匹配原题’，示例中的初始边将 1 写成 2 的子节点，与解法假设的‘1 为根’冲突；n/q 与初始边数也对不上。无法依样例确定初始树输入，保留阻塞。",
        "oa-rubrik-19": "原始题将 disparity 写为 min(e_i)-max(e_j)，同时要求最大化，但边约束描述与输入中已知方向没有输入协议；无法确认目标符号与约束编码。",
        "oa-rubrik-22": "固定提交中的原始题面在更新操作描述处被截断（仅剩 `such that m_i (x`），更新规则不完整，不能唯一确定操作。",
        "oa-rubrik-23": "原始题面只提到枪能量 m、摧毁子树和保留子树 evilness<k，但没有定义一次开枪的可选子树/能量约束；给出的样例也无解释，无法确定最少次数。",
    }
    for pid, reason in blocked.items():
        source = SOURCES[pid]
        raw_key = source["companySlug"]
        path, blob = RAW[raw_key]
        row = {"id": pid, "status": "blocked", "reason": reason, "sourceCommit": SOURCE_COMMIT, "rawPath": path, "rawGitBlob": blob, "sourceUrls": [source["sourceUrl"]], "sourceContentHashes": [source["contentHash"]], "catalogContentHash": source["contentHash"]}
        reviews.append(row)
        source_file_sha = SOURCE_FILES[path.rsplit("/", 1)[-1]]
        evidence[pid] = {"sourceCommit": SOURCE_COMMIT, "rawPath": path, "rawGitBlob": blob, "sourceFileSha256": source_file_sha, "catalogContentHash": source["contentHash"], "sourceUrl": source["sourceUrl"], "decision": "blocked", "reason": reason}

    (OA / "candidate-batches" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "items": manifests}, ensure_ascii=False, indent=2) + "\n")
    (OA / "validation" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "seed": 20261005, "problems": reports, "note": "Local authored reference/oracle/mutant validation only. Not tested against production GoJudge and not published."}, ensure_ascii=False, indent=2) + "\n")
    (OA / "reviews" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "items": reviews}, ensure_ascii=False, indent=2) + "\n")
    (OA / "source-evidence" / f"{BATCH}.json").write_text(json.dumps({"schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master", "commit": SOURCE_COMMIT, "items": evidence}, ensure_ascii=False, indent=2) + "\n")
    print(f"candidate={len(manifests)} blocked={len(blocked)}")


if __name__ == "__main__":
    main()
