"""Author and locally validate deterministic Stripe OA problems.

This generator only writes files whose ids start with oa-stripe-. It does not
modify the main registry, aggregate reports, or production sandbox evidence.
"""
from collections import defaultdict
from datetime import datetime, date, time, timedelta
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SPECS = []


def add(**spec):
    SPECS.append(spec)


def email_encode(logs):
    return str(len(logs)) + "\n" + "".join(
        f"{ts} {sender} {receiver}" + (f" {subject}" if subject else "") + "\n"
        for ts, sender, receiver, subject in logs
    )


def email_oracle(logs):
    grouped = defaultdict(list)
    for ts, sender, receiver, subject in logs:
        grouped[sender].append((ts, receiver, subject))
    out = []
    for sender in sorted(grouped):
        out.append(f"sender: {sender}")
        out.extend(
            f"{ts} {receiver}" + (f" {subject}" if subject else "")
            for ts, receiver, subject in sorted(grouped[sender])
        )
    return str(len(out)) + "\n" + "\n".join(out)


def email_random(rng):
    n = rng.randint(1, 12)
    senders = [f"user{i}@example.com" for i in range(rng.randint(1, 5))]
    receivers = [f"to{i}@example.net" for i in range(4)]
    subjects = ["", "status", "meeting notes", "A subject", "payment received"]
    return [(rng.randint(0, 5), rng.choice(senders), rng.choice(receivers), rng.choice(subjects)) for _ in range(n)]


email_samples = [
    [(100, "alice@a.com", "bob@b.com", "hello"), (90, "alice@a.com", "carl@c.com", "meeting notes"), (90, "dan@d.com", "e@e.com", "hi"), (90, "alice@a.com", "bob@b.com", "a-subject"), (100, "dan@d.com", "a@a.com", "ping")],
    [(0, "a@a.com", "b@b.com", "hi")],
    [(7, "z@e.com", "b@e.com", "same"), (7, "z@e.com", "a@e.com", "same"), (7, "a@e.com", "z@e.com", "")],
]
add(
    id="oa-stripe-13", title="邮件日志分组与排序", tags=["排序", "哈希表"],
    source_ids=["oa-stripe-13"], encode=email_encode, oracle=email_oracle,
    samples=email_samples, random=email_random,
    edges=[
        ([(i % 17, f"s{i % 31}@x.com", f"r{i % 43}@y.com", f"subject {i % 9}") for i in range(2000)], None),
        ([(1, "b@x.com", "r@x.com", "z"), (1, "a@x.com", "r@x.com", "a")], None),
        ([(5, "a@x.com", "b@x.com", ""), (5, "a@x.com", "b@x.com", "x")], None),
    ],
    desc="给定邮件事件日志，按发件人分组。发件人组按字典序排列；每组内部先按时间戳升序，再按收件人和主题字典序升序。主题可以包含空格，也可以为空。",
    input="第一行 n（1..200000），随后 n 行：非负整数时间戳、发件人、收件人、主题。发件人和收件人不含空白；主题为该行第 4 个字段起至行尾的原文。单行不超过 300 字符。",
    output="先输出结果行数；之后按规则输出 `sender: <发件人>`，再输出该组的 `<时间戳> <收件人> [主题]` 行。空主题时不输出多余空格。",
    idea="按发件人收集记录，再用三元键 `(时间戳, 收件人, 主题)` 排序；最后按发件人键排序输出。",
    proof="每条记录恰好进入其发件人对应的组。组键升序给出题目规定的组顺序，三元组字典序与组内三级排序完全一致，因此输出覆盖且只覆盖所有输入日志，并满足全部排序规则。",
    complexity="设日志数为 n。排序总耗时 O(n log n)，空间 O(n)。",
    code='''from collections import defaultdict
def solve(raw):
    lines=raw.splitlines(); n=int(lines[0]); groups=defaultdict(list)
    for line in lines[1:n+1]:
        parts=line.split(None,3)
        ts=int(parts[0]); sender=parts[1]; receiver=parts[2]
        subject=parts[3] if len(parts)>3 else ""
        groups[sender].append((ts,receiver,subject))
    out=[]
    for sender in sorted(groups):
        out.append(f"sender: {sender}")
        for ts,receiver,subject in sorted(groups[sender]):
            out.append(f"{ts} {receiver}"+(f" {subject}" if subject else ""))
    return str(len(out))+"\\n"+"\\n".join(out)
''',
    mutants=[
        ("同时间戳时不按收件人排序", "groups[sender].append((ts,receiver,subject))", "groups[sender].append((ts,subject,receiver))"),
        ("发件人组按输入顺序输出", "for sender in sorted(groups):", "for sender in groups:"),
    ],
)


def dt(s):
    return datetime.strptime(s, "%Y-%m-%d %H:%M")


def slot_label(start):
    return start.strftime("%Y-%m-%d %H:%M")


def slots_encode(value):
    start, end, windows = value
    return f"{start}\n{end}\n{len(windows)}\n" + "".join(f"{weekday} {a} {b}\n" for weekday, a, b in windows)


def slots_oracle(value):
    start_s, end_s, windows = value
    start, end = dt(start_s), dt(end_s)
    by_day = defaultdict(list)
    for weekday, a, b in windows:
        by_day[weekday].append((time.fromisoformat(a), None if b == "24:00" else time.fromisoformat(b)))
    out = set()
    day = start.date()
    while day <= end.date():
        for a, b in by_day[day.weekday()]:
            window_start = datetime.combine(day, a)
            window_end = datetime.combine(day + (timedelta(days=1) if b is None else timedelta()), b or time(0, 0))
            candidate = datetime.combine(day, time(0, 0))
            while candidate < window_end:
                finish = candidate + timedelta(minutes=30)
                if candidate >= window_start and (candidate - window_start).total_seconds() % 1800 == 0 and candidate >= start and finish <= min(end, window_end):
                    out.add(f"{slot_label(candidate)},{slot_label(finish)}")
                candidate += timedelta(minutes=1)
        day += timedelta(days=1)
    ordered = sorted(out)
    return str(len(ordered)) + ("\n" + "\n".join(ordered) if ordered else "")


def slots_random(rng):
    origin = date(2026, 1, 5)  # Monday
    start_day = origin + timedelta(days=rng.randint(0, 10))
    end_day = start_day + timedelta(days=rng.randint(0, 7))
    start_minute = rng.randrange(0, 24 * 60)
    end_minute = rng.randrange(0, 24 * 60)
    start = datetime.combine(start_day, time()) + timedelta(minutes=start_minute)
    end = datetime.combine(end_day, time()) + timedelta(minutes=end_minute)
    if end < start:
        end = start + timedelta(minutes=rng.randint(0, 6 * 24 * 60))
    windows = []
    for _ in range(rng.randint(0, 7)):
        weekday = rng.randrange(7)
        a = rng.randrange(0, 23 * 60)
        b = rng.randrange(a + 1, 24 * 60 + 1)
        def fmt(m): return f"{m // 60:02}:{m % 60:02}"
        windows.append((weekday, fmt(a), "24:00" if b == 1440 else fmt(b)))
    return start.strftime("%Y-%m-%d %H:%M"), end.strftime("%Y-%m-%d %H:%M"), windows


slots_samples = [
    ("2026-01-05 09:10", "2026-01-05 10:40", [(0, "09:00", "12:00")]),
    ("2026-01-05 08:00", "2026-01-12 10:00", [(0, "09:00", "10:30")]),
    ("2026-01-05 10:00", "2026-01-05 10:30", [(0, "10:00", "10:30")]),
]
add(
    id="oa-stripe-18", title="生成每周工作时段内的可用时间槽", tags=["日期处理", "枚举"],
    source_ids=["oa-stripe-18"], encode=slots_encode, oracle=slots_oracle,
    samples=slots_samples, random=slots_random,
    edges=[
        (("2026-01-05 09:10", "2026-01-05 10:40", [(0, "09:00", "12:00")]), None),
        (("2026-01-05 23:00", "2026-01-06 01:00", [(0, "23:00", "24:00"), (1, "00:00", "01:00")]), None),
        (("2026-01-05 09:00", "2026-01-05 09:29", [(0, "09:00", "10:00")]), None),
        (("2026-01-05 09:00", "2026-01-05 10:00", [(0, "09:00", "10:00"), (0, "09:00", "10:00")]), None),
    ],
    desc="给定闭区间日期时间范围以及按星期重复的工作时段，输出范围内所有完整的 30 分钟时间槽。时间槽必须完全落在范围和对应工作时段内。每个工作时段的时间槽网格从该时段起点开始，每隔 30 分钟产生一个候选槽；重复时段产生的相同槽只输出一次。",
    input="前两行分别为起始和结束时间，格式 `YYYY-MM-DD HH:MM`；第三行是工作时段数 w，随后 w 行为 `weekday start end`。weekday 为 0（周一）到 6（周日）；时刻为 `HH:MM`，结束允许写 `24:00`。每个时段为同日半开区间 `[start,end)`，且 start < end。范围不超过 366 天，0≤w≤1000。",
    output="先输出时间槽数量；随后每行输出一个 `起始时间,结束时间`，按时间升序。没有可用槽时只输出 0。",
    idea="逐日取出对应星期的工作时段，从时段起点按 30 分钟步长枚举候选；仅保留起点不早于给定范围起点且终点不晚于范围终点的完整槽，并去重排序。",
    proof="任何有效时间槽都属于某个工作时段，且相对该时段起点是 30 分钟的整数倍，因此枚举必会检查它。边界过滤恰好表达槽完整包含于给定范围。反过来，枚举后通过两条边界检查的槽满足全部条件。集合去重处理重叠/重复时段，排序给出要求的时间顺序。",
    complexity="设日期数为 D、工作时段数为 w、候选槽数为 s。时间 O(48Dw+s log s)，空间 O(s)。",
    code='''from datetime import datetime,timedelta
def solve(raw):
    lines=raw.splitlines(); start=datetime.strptime(lines[0],"%Y-%m-%d %H:%M"); end=datetime.strptime(lines[1],"%Y-%m-%d %H:%M")
    count=int(lines[2]); windows={i:[] for i in range(7)}
    for line in lines[3:3+count]:
        weekday,a,b=line.split(); windows[int(weekday)].append((a,b))
    found=set(); day=start.date()
    while day<=end.date():
        for a,b in windows[day.weekday()]:
            base=datetime.combine(day,datetime.strptime(a,"%H:%M").time())
            finish=datetime.combine(day,datetime.strptime(b,"%H:%M").time()) if b!="24:00" else datetime.combine(day+timedelta(days=1),datetime.min.time())
            cur=base
            while cur+timedelta(minutes=30)<=finish:
                nxt=cur+timedelta(minutes=30)
                if cur>=start and nxt<=end: found.add(cur.strftime("%Y-%m-%d %H:%M")+","+nxt.strftime("%Y-%m-%d %H:%M"))
                cur=nxt
        day+=timedelta(days=1)
    ordered=sorted(found)
    return str(len(ordered))+("\\n"+"\\n".join(ordered) if ordered else "")
''',
    mutants=[
        ("不检查起始边界", "if cur>=start and nxt<=end:", "if nxt<=end:"),
        ("不检查结束边界", "if cur>=start and nxt<=end:", "if cur>=start:"),
    ],
)


def payments_encode(commands):
    return str(len(commands)) + "\n" + "\n".join(commands) + "\n"


def payments_parse(command):
    parts = command.split()
    ts = int(parts[0])
    return ts, parts[1], parts[2:]


def payments_oracle(commands):
    merchants = {}  # id -> [balance, refund limit]
    intents = {}    # id -> [merchant, amount, state, refunded, success time]
    for line in commands:
        ts, op, args = payments_parse(line)
        if op == "INIT":
            merchant, balance = args[0], int(args[1])
            limit = int(args[2]) if len(args) > 2 else None
            if merchant not in merchants:
                merchants[merchant] = [balance, limit]
        elif op == "CREATE":
            intent, merchant, amount = args[0], args[1], int(args[2])
            if intent not in intents and merchant in merchants and amount >= 0:
                intents[intent] = [merchant, amount, "REQUIRES_ACTION", False, None]
        elif op in ("ATTEMPT", "SUCCEED", "FAIL", "UPDATE", "REFUND"):
            key = args[0]
            if key not in intents:
                continue
            item = intents[key]
            if op == "ATTEMPT" and item[2] == "REQUIRES_ACTION":
                item[2] = "PROCESSING"
            elif op == "SUCCEED" and item[2] == "PROCESSING":
                item[2] = "COMPLETED"; merchants[item[0]][0] += item[1]; item[4] = ts
            elif op == "FAIL" and item[2] == "PROCESSING":
                item[2] = "REQUIRES_ACTION"
            elif op == "UPDATE" and item[2] == "REQUIRES_ACTION" and int(args[1]) >= 0:
                item[1] = int(args[1])
            elif op == "REFUND" and item[2] == "COMPLETED" and not item[3]:
                limit = merchants[item[0]][1]
                permitted = limit is None or limit < 0 or (limit > 0 and ts - item[4] <= limit)
                if permitted:
                    merchants[item[0]][0] -= item[1]; item[3] = True
    out = [f"{name} {merchants[name][0]}" for name in sorted(merchants)]
    return str(len(out)) + ("\n" + "\n".join(out) if out else "")


def payments_random(rng):
    names = ["m0", "m1", "m2"]
    commands = []
    ts = 0
    for i, name in enumerate(names):
        ts += 1; commands.append(f"{ts} INIT {name} {rng.randint(-20, 100)} {rng.choice([-1, 0, 4, 20])}")
    for i in range(rng.randint(1, 20)):
        ts += 1
        intent = f"p{rng.randrange(6)}"; merchant = rng.choice(names)
        op = rng.choice(["CREATE", "ATTEMPT", "SUCCEED", "FAIL", "UPDATE", "REFUND"])
        if op == "CREATE": commands.append(f"{ts} CREATE {intent} {merchant} {rng.randint(-3, 100)}")
        elif op == "UPDATE": commands.append(f"{ts} UPDATE {intent} {rng.randint(-3, 100)}")
        else: commands.append(f"{ts} {op} {intent}")
    return commands


payments_samples = [
    ["1 INIT m1 0", "2 CREATE p1 m1 50", "3 UPDATE p1 100", "4 ATTEMPT p1", "5 SUCCEED p1"],
    ["1 INIT m1 0 5", "2 CREATE p1 m1 100", "3 CREATE p2 m1 50", "4 ATTEMPT p1", "5 ATTEMPT p2", "8 SUCCEED p1", "10 SUCCEED p2", "11 REFUND p1", "16 REFUND p2"],
    ["1 INIT m2 10 -1", "2 INIT m1 5 0", "3 CREATE p m2 20", "4 ATTEMPT p", "5 FAIL p", "6 UPDATE p 30", "7 ATTEMPT p", "8 SUCCEED p", "9 SUCCEED p", "10 REFUND p", "11 REFUND p"],
]
add(
    id="oa-stripe-17", title="Payment Intent 状态机与限时退款", tags=["模拟", "状态机"],
    source_ids=["oa-stripe-17", "oa-stripe-14", "oa-stripe-15", "oa-stripe-16"],
    encode=payments_encode, oracle=payments_oracle, samples=payments_samples, random=payments_random,
    edges=[
        (["1 INIT m 0 5", "2 CREATE p m 10", "3 ATTEMPT p", "4 SUCCEED p", "9 REFUND p"], "1\nm 0"),
        (["1 INIT m 0 5", "2 CREATE p m 10", "3 ATTEMPT p", "4 SUCCEED p", "10 REFUND p"], "1\nm 10"),
        (["1 INIT m 0 0", "2 CREATE p m 0", "3 ATTEMPT p", "4 SUCCEED p", "5 REFUND p"], "1\nm 0"),
        (["1 INIT m 0 -1", "2 CREATE p m 7", "3 ATTEMPT p", "4 SUCCEED p", "100 REFUND p"], "1\nm 0"),
    ],
    desc="执行 Stripe 原站相互关联的 Payment Intent 第 1–4 部分命令。Intent 状态为 REQUIRES_ACTION、PROCESSING、COMPLETED；非法状态转换或无效创建/修改均忽略。每条命令时间戳严格递增。退款仅能对已完成且未退款的 Intent 成功，并按商户退款时限判定。",
    input="第一行 q（1..200000），随后 q 行命令：`timestamp INIT merchant starting_balance [refund_limit]`、`timestamp CREATE intent merchant amount`、`timestamp ATTEMPT intent`、`timestamp SUCCEED intent`、`timestamp FAIL intent`、`timestamp UPDATE intent new_amount` 或 `timestamp REFUND intent`。ID 为不含空白的字符串。余额、金额、退款时限为有符号 64 位整数。商户首次 INIT 生效；重复商户、重复 Intent ID、未知商户、负创建金额均忽略。退款时限缺省或为负表示不限时，0 表示不允许退款，正数 n 表示退款时间戳须不晚于成功时间戳+n。",
    output="先输出已初始化商户数；之后按商户 ID 字典序逐行输出 `merchant_id balance`。",
    idea="用哈希表分别保存商户余额/退款时限与 Intent 的商户、金额、状态、退款标记、成功时间。按时间顺序扫描命令，仅在当前状态符合转换条件时更新；最后排序商户并输出。",
    proof="逐条命令按定义检查唯一的前置状态。INIT/CREATE 的存在性检查保证标识不被覆盖；每个状态转换只在其规定起态执行，且成功只会从 PROCESSING 到 COMPLETED 一次，因此余额只入账一次。退款同时检查完成态、未退款标记和时限，标记成功退款避免重复扣款。归纳命令前缀可知表中状态与按规则执行的系统一致，最终余额正确。",
    complexity="设命令数为 q、商户数为 m。状态处理平均 O(q)，最后排序 O(m log m)，空间 O(q+m)。",
    code='''def solve(raw):
    lines=raw.splitlines(); q=int(lines[0]); merchants={}; intents={}
    for line in lines[1:q+1]:
        p=line.split(); ts=int(p[0]); op=p[1]; a=p[2:]
        if op=="INIT":
            name=a[0]; balance=int(a[1]); limit=int(a[2]) if len(a)>2 else None
            if name not in merchants: merchants[name]=[balance,limit]
        elif op=="CREATE":
            pid,name,amount=a[0],a[1],int(a[2])
            if pid not in intents and name in merchants and amount>=0: intents[pid]=[name,amount,"REQUIRES_ACTION",False,None]
        elif op in ("ATTEMPT","SUCCEED","FAIL","UPDATE","REFUND"):
            pid=a[0]
            if pid not in intents: continue
            item=intents[pid]
            if op=="ATTEMPT" and item[2]=="REQUIRES_ACTION": item[2]="PROCESSING"
            elif op=="SUCCEED" and item[2]=="PROCESSING":
                item[2]="COMPLETED"; merchants[item[0]][0]+=item[1]; item[4]=ts
            elif op=="FAIL" and item[2]=="PROCESSING": item[2]="REQUIRES_ACTION"
            elif op=="UPDATE" and item[2]=="REQUIRES_ACTION" and int(a[1])>=0: item[1]=int(a[1])
            elif op=="REFUND" and item[2]=="COMPLETED" and not item[3]:
                limit=merchants[item[0]][1]
                if limit is None or limit<0 or (limit>0 and ts-item[4]<=limit):
                    merchants[item[0]][0]-=item[1]; item[3]=True
    out=[f"{name} {merchants[name][0]}" for name in sorted(merchants)]
    return str(len(out))+("\\n"+"\\n".join(out) if out else "")
''',
    mutants=[
        ("重复成功时再次入账", 'elif op=="SUCCEED" and item[2]=="PROCESSING":', 'elif op=="SUCCEED":'),
        ("退款不检查时限", 'if limit is None or limit<0 or (limit>0 and ts-item[4]<=limit):', 'if True:'),
    ],
)


def execute(path, stdin):
    result = subprocess.run([sys.executable, "-I", str(path)], input=stdin, text=True, capture_output=True, timeout=8, check=True)
    return result.stdout.rstrip("\n")


def normalize_package(raw):
    script = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    return subprocess.run(["node", "--import", "tsx", "-e", script], cwd=ROOT, input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True, check=True).stdout


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants", "negative-controls", "reviews", "candidate-batches", "validation"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    batch_items=[]; reports=[]; reviews=[]
    for spec in SPECS:
        identifier=spec["id"]
        rng=random.Random(20260923 + int(identifier.rsplit("-",1)[1]))
        code=textwrap.dedent(spec["code"]).strip()+"\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
        reference=OUT/"references"/f"{identifier}.py"; reference.write_text(code)
        values=spec["samples"]+[spec["random"](rng) for _ in range(160)]
        oracle_cases=[]
        for value in values:
            expected=spec["oracle"](value); stdin=spec["encode"](value)
            assert execute(reference,stdin)==expected, (identifier, value, expected, execute(reference,stdin))
            oracle_cases.append({"input":stdin,"expectedOutput":expected+"\n"})
        edge_cases=[]
        for value, expected in spec["edges"]:
            if expected is None: expected=spec["oracle"](value)
            stdin=spec["encode"](value)
            assert execute(reference,stdin)==expected, (identifier,"edge",value,expected,execute(reference,stdin))
            edge_cases.append({"input":stdin,"expectedOutput":expected+"\n"})
        tests=oracle_cases[:3]+edge_cases+oracle_cases[3:27]
        cases=[]
        for i,test in enumerate(tests):
            cases.append({"name":f"公开样例 {i+1}" if i<3 else f"隐藏验证 {i-2}",**test,"hidden":i>=3,"weight":1})
        mutants=[]; kill_report=[]
        for label, old, new in spec["mutants"]:
            assert old in code, (identifier,"mutation anchor missing",old)
            mutant_code=code.replace(old,new)
            control=OUT/"negative-controls"/f"{identifier}-{len(mutants)+1}.py"
            control.write_text(mutant_code)
            rejected=[]
            for i,case in enumerate(cases):
                if execute(control,case["input"])!=case["expectedOutput"].rstrip("\n"):
                    rejected.append(i)
            assert rejected, (identifier,"mutant survived",label)
            mutants.append({"name":label,"code":mutant_code})
            kill_report.append({"name":label,"rejectedByCases":rejected})
        src=[SOURCES[sid] for sid in spec["source_ids"]]
        source=src[0]
        problem={"id":identifier,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"中等","tags":["OA","Stripe"]+spec["tags"],"description":spec["desc"]+"\n\n输入格式、样例与评测数据由 CSWork 整理编写。","input":spec["input"],"output":spec["output"],"explanation":"按上述规则处理输入；思路、正确性证明和复杂度见配套题解。","hints":[spec["idea"]],"timeLimit":3,"memoryLimit":262144,"outputLimit":16384,"checker":"exact","languages":["python","go","java","cpp"]}
        normalized=normalize_package({"schemaVersion":1,"problem":problem,"cases":cases})
        package=json.loads(normalized)
        editorial_text=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        solution=[{"language":"python","code":code}]
        editorial={"schemaVersion":1,"id":identifier,"title":spec["title"],"explanation":editorial_text,"solutions":solution,"sourceUrl":source["sourceUrl"],"sourceContentHash":source["contentHash"],"author":"CSWork"}
        for folder,document in (("packages",package),("oracles",oracle_cases),("mutants",mutants),("editorials",editorial)):
            (OUT/folder/f"{identifier}.json").write_text(json.dumps(document,ensure_ascii=False,indent=2)+"\n")
        batch_items.append({"id":identifier,"sourceContentHash":source["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":editorial_text,"authoredSolutions":solution})
        reports.append({"id":identifier,"oracleCases":len(oracle_cases),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":kill_report,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
        reviews.append({"id":identifier,"status":"authored","reason":"题意可整理为确定的标准输入输出；输入协议与必要边界约定已在本站题面明示。","sourceUrls":[item["sourceUrl"] for item in src],"sourceContentHashes":[item["contentHash"] for item in src],"catalogContentHash":source["contentHash"]})
        print(f"{identifier}: {len(oracle_cases)} oracle checks; {len(cases)} judge cases; {len(mutants)} mutants killed",flush=True)
    batch="stripe-next"
    (OUT/"candidate-batches"/f"{batch}.json").write_text(json.dumps({"schemaVersion":1,"items":batch_items},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation"/f"{batch}.json").write_text(json.dumps({"schemaVersion":1,"seed":20260923,"problems":reports,"note":"Local authored-code/oracle/mutant validation only. This is not production sandbox acceptance or publication."},ensure_ascii=False,indent=2)+"\n")
    skipped={"oa-stripe-1":"多阶段负载均衡需求细节不足，且不同阶段共享状态的淘汰/重路由规则不完整。","oa-stripe-2":"依赖交易样本与异常值等统计定义，原题未提供完整可复现数据协议。","oa-stripe-3":"聚类目标、特征距离与结果要求不充分。","oa-stripe-4":"多阶段请求路由的状态和健康迁移规则不完整。","oa-stripe-5":"依赖外部 cuisine 数据/Pandas 表结构，题面未给数据集。","oa-stripe-6":"需要图像数据与训练/推理环境。","oa-stripe-7":"选择题不是代码评测题。","oa-stripe-8":"卡号混淆含多阶段规则但可见题面缺少完整输入约束。","oa-stripe-9":"卡号混淆依赖前置题，不能独立确认规则。","oa-stripe-10":"卡号混淆依赖前置题，不能独立确认规则。","oa-stripe-11":"卡号混淆依赖前置题，不能独立确认规则。","oa-stripe-12":"用量块计费及计划切换的 allowance 舍入规则不充分，暂不补猜。","oa-stripe-14":"仅作为 oa-stripe-17 合并状态机的组成部分，不重复发布为独立题目。","oa-stripe-15":"仅作为 oa-stripe-17 合并状态机的组成部分，不重复发布为独立题目。","oa-stripe-16":"仅作为 oa-stripe-17 合并状态机的组成部分，不重复发布为独立题目。","oa-stripe-19":"命令协议对时间戳、状态转换及退款细节与 Payment Intent 四部分内容不一致，先用原站互相关联的第1–4部分作为完整状态机。","oa-stripe-20":"Haversine 最近整数及浮点边界在跨语言评测中可能不稳定；优先选择完全离散题目。"}
    reviews.extend({"id":identifier,"status":"blocked","reason":reason,"catalogContentHash":SOURCES[identifier]["contentHash"]} for identifier,reason in skipped.items())
    reviews.sort(key=lambda item:int(item["id"].rsplit("-",1)[1]))
    (OUT/"reviews"/f"{batch}.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")


if __name__ == "__main__":
    main()
