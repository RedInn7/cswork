from __future__ import annotations

import hashlib
import inspect
import json
import random
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
MANIFEST = json.loads((ROOT / "content/oa-master/manifest.json").read_text())
ITEMS = {x["id"]: x for x in CATALOG["items"]}
SEED = 20261007
RNG = random.Random(SEED)


def dump(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sha(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def run(code: str, raw: str) -> str:
    p = subprocess.run(["python3", "-I", "-c", code + "\nimport sys; print(solve(sys.stdin.read()))"],
                       input=raw, text=True, capture_output=True, timeout=5)
    if p.returncode:
        raise AssertionError((p.stderr, raw))
    return p.stdout.rstrip("\n")


def normalize(package: dict) -> dict:
    js = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    p = subprocess.run(["node", "--import", "tsx", "-e", js], cwd=ROOT,
                       input=json.dumps(package, ensure_ascii=False), text=True,
                       capture_output=True, check=True)
    return json.loads(p.stdout)


def mkcase(name: str, raw: str, expected: str, hidden: bool) -> dict:
    return {"name": name, "input": raw, "expectedOutput": expected + "\n",
            "hidden": hidden, "weight": 1}


def uniq(generator, count=120):
    values, seen = [], set()
    while len(values) < count:
        raw = generator()
        if raw not in seen:
            seen.add(raw)
            values.append(raw)
    return values


def complete(base, generator, count=120):
    values = list(dict.fromkeys(base))
    seen = set(values)
    while len(values) < count:
        raw = generator()
        if raw not in seen:
            seen.add(raw)
            values.append(raw)
    return values


def add(pid, tags, title, difficulty, description, inp, out, hint, editorial,
        code, oracle, inputs, mutants):
    src = ITEMS[pid]
    rows = []
    for raw in inputs:
        expected = oracle(raw)
        actual = run(code, raw)
        if actual != expected:
            raise AssertionError((pid, raw, expected, actual))
        rows.append({"input": raw, "expectedOutput": expected + "\n"})
    if len(rows) < 120 or len({r["input"] for r in rows}) != len(rows):
        raise AssertionError((pid, "oracle inputs must be 120 unique cases"))
    cases = [mkcase(f"公开样例 {i+1}" if i < 3 else f"隐藏用例 {i-2}",
                    r["input"], r["expectedOutput"].rstrip("\n"), i >= 3)
             for i, r in enumerate(rows[:30])]
    controls, mutant_rows = [], []
    for name, bad_code in mutants:
        killed = [i for i, c in enumerate(cases)
                  if run(bad_code, c["input"]) != c["expectedOutput"].rstrip("\n")]
        if not killed:
            raise AssertionError((pid, "mutant survived", name))
        controls.append({"name": name, "rejectedByCases": killed})
        mutant_rows.append({"name": name, "code": bad_code})

    pkg = normalize({"schemaVersion": 1, "problem": {
        "id": pid, "courseId": "gomall", "lessonId": "00-overview",
        "title": title, "difficulty": difficulty, "tags": ["OA", src["companyName"], *tags],
        "description": description + "\n\n本站补充标准输入输出协议；不代表原站函数题原有该协议。",
        "input": inp, "output": out, "explanation": "完整思路、证明和复杂度见配套讲义。",
        "hints": [hint], "timeLimit": 3, "memoryLimit": 262144,
        "outputLimit": 8192, "checker": "tokens", "languages": ["python", "go", "java", "cpp"]},
        "cases": cases})
    editorial_text = editorial + "\n\n## 来源说明\n\n题意按固定 OAMaster 快照整理；标准输入输出协议为本站补充，不声称原站提供该协议。"
    solution = {"language": "python", "code": code}
    editorial_doc = {"schemaVersion": 1, "id": pid, "title": title,
        "explanation": editorial_text, "solutions": [solution],
        "sourceUrl": src["sourceUrl"], "sourceContentHash": src["contentHash"],
        "author": "Chunyu Sui"}
    canonical = json.dumps(pkg, ensure_ascii=False, separators=(",", ":"))
    for folder, doc in (("packages", pkg), ("editorials", editorial_doc),
                        ("oracles", rows), ("mutants", mutant_rows)):
        dump(OUT / folder / f"{pid}.json", doc)
    (OUT / "references" / f"{pid}.py").write_text(code)
    for i, (name, bad_code) in enumerate(mutants, 1):
        (OUT / "negative-controls" / f"{pid}-{i}.py").write_text(f"# {name}\n{bad_code}")
    return ({"entry": {"id": pid, "sourceContentHash": src["contentHash"],
             "packageChecksum": sha(canonical), "editorial": editorial_text,
             "authoredSolutions": [solution]},
        "validation": {"id": pid, "oracleCases": len(rows),
            "uniqueOracleInputs": len({x["input"] for x in rows}),
            "referenceCliCases": len(cases), "referenceSha256": sha(code),
            "publicCases": 3, "hiddenCases": len(cases) - 3,
            "negativeControls": controls}})


def jane_ref(raw):
    stack = []
    for ch in raw.rstrip("\n"):
        if stack and (stack[-1], ch) in (("A", "B"), ("B", "A"), ("C", "D"), ("D", "C")):
            stack.pop()
        else:
            stack.append(ch)
    return "".join(stack)


def jane_oracle(raw):
    s = raw.rstrip("\n")
    while True:
        for i in range(len(s) - 1):
            if s[i:i+2] in ("AB", "BA", "CD", "DC"):
                s = s[:i] + s[i+2:]
                break
        else:
            return s


def jane():
    alphabet = "ABCD"
    return complete(["AB", "ABCD", "A", ""],
        lambda: "".join(RNG.choice(alphabet) for _ in range(RNG.randint(0, 18))))


def imc_ref(raw):
    t = list(map(int, raw.split())); n = t[0]; parent = t[1:n+1]; q = t[n+1]; at = n+2
    children = [[] for _ in range(n)]
    for v in range(1, n): children[parent[v]].append(v)
    tour, tin, size = [], [0]*n, [0]*n
    stack = [(0, 0)]
    while stack:
        u, phase = stack.pop()
        if phase == 0:
            tin[u] = len(tour); tour.append(u); stack.append((u, 1))
            for v in reversed(children[u]): stack.append((v, 0))
        else:
            size[u] = len(tour) - tin[u]
    ans=[]
    for _ in range(q):
        p,k=t[at:at+2];at+=2;ans.append(str(tour[tin[p]+k-1] if 1 <= k <= size[p] else -1))
    return " ".join(ans)


def imc_oracle(raw):
    t=list(map(int,raw.split()));n=t[0];par=t[1:n+1];q=t[n+1];at=n+2
    kids=[[] for _ in range(n)]
    for x in range(1,n):kids[par[x]].append(x)
    ans=[]
    for _ in range(q):
        p,k=t[at:at+2];at+=2;order=[];st=[p]
        while st:
            u=st.pop();order.append(u);st.extend(reversed(kids[u]))
        ans.append(str(order[k-1] if k<=len(order) else -1))
    return " ".join(ans)


def imc_inputs():
    samples=["9\n-1 0 0 1 1 1 2 6 7\n4\n0 4\n1 3\n5 1\n6 2\n",
             "1\n-1\n2\n0 1\n0 2\n",
             "5\n-1 0 0 1 1\n3\n0 3\n1 2\n2 2\n"]
    def gen():
        n=RNG.randint(1,20);par=[-1]*n;added=[0]
        order=list(range(1,n));RNG.shuffle(order)
        for v in order:par[v]=RNG.choice(added);added.append(v)
        qs=[(RNG.randrange(n),RNG.randint(1,n+2)) for _ in range(RNG.randint(1,8))]
        return f"{n}\n"+" ".join(map(str,par))+f"\n{len(qs)}\n"+"\n".join(f"{p} {k}" for p,k in qs)+"\n"
    return complete(samples,gen)


def geneva_ref(raw):
    t=list(map(int,raw.split()));n=t[0];p=[x-1 for x in t[1:n+1]];seen=[False]*n;mod=10**9+7
    spf=list(range(n+1))
    for i in range(2,int(n**0.5)+1):
        if spf[i]==i:
            for j in range(i*i,n+1,i):
                if spf[j]==j:spf[j]=i
    max_power={}
    for i in range(n):
        if not seen[i]:
            u=i;length=0
            while not seen[u]:seen[u]=True;length+=1;u=p[u]
            x=length
            while x>1:
                prime=spf[x];power=0
                while x%prime==0:x//=prime;power+=1
                max_power[prime]=max(max_power.get(prime,0),power)
    ans=1
    for prime,power in max_power.items():ans=ans*pow(prime,power,mod)%mod
    return str(ans)


def geneva_oracle(raw):
    t=list(map(int,raw.split()));n=t[0];p=[x-1 for x in t[1:n+1]];pos=list(range(n));k=0
    while True:
        pos=[pos[p[i]] for i in range(n)];k+=1
        if pos==list(range(n)):return str(k%1_000_000_007)


def geneva_inputs():
    vals=["3\n1 3 2\n", "4\n2 1 4 3\n", "5\n2 3 1 5 4\n"]
    def gen():
        n=RNG.randint(1,10);p=list(range(1,n+1));RNG.shuffle(p)
        return f"{n}\n"+" ".join(map(str,p))+"\n"
    return complete(vals,gen)


def power_ref(raw):
    n=int(raw.strip())
    return str(int(n>0 and (n&(n-1))==0))


def power_oracle(raw):
    n=int(raw.strip())
    if n<1:return "0"
    while n%2==0:n//=2
    return "1" if n==1 else "0"


def power_inputs():
    base=["1", "2", "3", "0", "-1", str(1<<30), str((1<<30)-1)]
    return complete(base,lambda: str(RNG.randint(-(1<<31),(1<<31)-1)))


def sofi_ref(raw):
    n,m,k=map(int,raw.split());mod=10**9+7
    def side(cnt,x):
        full=min(cnt,x-1);return ((x-1+x-full)*full)//2+max(0,cnt-full)
    def need(x):return x+side(k-1,x)+side(n-k,x)
    lo,hi,ans=1,m,1
    while lo<=hi:
        mid=(lo+hi)//2
        if need(mid)<=m:ans=mid;lo=mid+1
        else:hi=mid-1
    return str(ans)


def sofi_oracle(raw):
    n,m,k=map(int,raw.split());best=1
    # Exhaust all weak compositions for small generated bounds; require every slot >=1.
    def visit(a,left):
        nonlocal best
        i=len(a)
        if i==n:
            if left==0 and all(abs(a[j]-a[j-1])<=1 for j in range(1,n)):
                best=max(best,a[k-1])
            return
        remain=n-i-1
        for x in range(1,left-remain+1):visit(a+[x],left-x)
    visit([],m)
    return str(best)


def sofi_inputs():
    vals=["5 11 5\n","5 11 3\n","1 9 1\n"]
    def gen():
        n=RNG.randint(1,7);m=RNG.randint(n,min(30,n+18));k=RNG.randint(1,n)
        return f"{n} {m} {k}\n"
    return complete(vals,gen)


def main():
    specs=[]
    imc_code=inspect.getsource(imc_ref).replace("def imc_ref(raw):", "def solve(raw):", 1)
    geneva_code=inspect.getsource(geneva_ref).replace("def geneva_ref(raw):", "def solve(raw):", 1)
    power_code=inspect.getsource(power_ref).replace("def power_ref(raw):", "def solve(raw):", 1)
    sofi_code=inspect.getsource(sofi_ref).replace("def sofi_ref(raw):", "def solve(raw):", 1)
    specs.append(add("oa-jane-street-1",["字符串","栈"],"Transform String","简单",
      "字符串只含 A、B、C、D。可反复删除任意相邻的 A/B（任意顺序）或 C/D（任意顺序）。输出任意无法继续删除的结果。",
      "输入一行字符串 S；空串用空行表示。","输出一个不可再约简的字符串；若结果为空输出空行。",
      "只需检查新字符与当前结果末尾是否构成可删除对。",
      "## 思路\n\n从左到右扫描并用栈保存未消除字符。新字符与栈顶构成 AB、BA、CD 或 DC 时弹出栈顶，否则压入新字符。\n\n## 正确性证明\n\n扫描前缀的栈是该前缀按规则消除后的一个不可继续消除结果。加入一个新字符后，任何新产生的相邻可删对只能跨越新字符与旧前缀末尾；若匹配就消去这两者，否则新字符保留。归纳得到最终串不可继续变换且可由原串变换得到。\n\n## 复杂度\n\n时间 O(n)，空间 O(n)。",
      "def solve(raw):\n s=raw.rstrip('\\n');st=[]\n for c in s:\n  if st and (st[-1],c) in {('A','B'),('B','A'),('C','D'),('D','C')}:st.pop()\n  else:st.append(c)\n return ''.join(st)\n",
      jane_oracle,jane(),[("漏掉 CD 对", "def solve(raw):\n s=raw.rstrip('\\n');st=[]\n for c in s:\n  if st and (st[-1],c) in {('A','B'),('B','A')}:st.pop()\n  else:st.append(c)\n return ''.join(st)\n"),("只按一个方向识别 AB", "def solve(raw):\n s=raw.rstrip('\\n');st=[]\n for c in s:\n  if st and (st[-1],c) in {('A','B'),('C','D')}:st.pop()\n  else:st.append(c)\n return ''.join(st)\n")]))

    specs.append(add("oa-imc-2",["树","DFS"],"Chain of Command (Tree DFS Order, k-th Receiver)","中等",
      "给定以 0 为根的树，parent[0]=-1。向节点 p 发出的通知按先序 DFS 顺序传递，且同一节点的孩子按编号升序访问。每个查询 (p,k) 返回 p 子树先序序列中的第 k 个节点（1-based，包含 p）；若 k 超出子树大小返回 -1。",
      "n；一行 n 个 parent 值；q；随后 q 行 p k。节点编号和查询中的 p 为 0-based。约定 parent[0]=-1，且 parent 数组表示以 0 为根的有效树。本站补充 n≤200000、q≤200000。",
      "按查询顺序输出答案，以空格分隔。",
      "用迭代 DFS 构造整棵树的先序序列，并记录每个子树的连续区间。",
      "## 思路\n\n先按编号升序建立孩子列表，再做迭代先序 DFS。记录节点进入序列时的位置 tin；离开时可由当前序列长度得到子树大小。查询 (p,k) 对应序列下标 tin[p]+k−1，若 k 不超过子树大小便返回该点。\n\n## 正确性证明\n\n按序压栈保证孩子以升序先序访问。DFS 的先序遍历中任一节点的子树构成连续区间，因此该区间第 k 个元素就是查询要求的第 k 个接收者。边界判断恰好排除越过该子树的 k。\n\n## 复杂度\n\n构树和遍历 O(n)，回答 q 个查询 O(q)，空间 O(n+q)。",
      imc_code,imc_oracle,imc_inputs(),[("孩子顺序降序",imc_code.replace("for v in reversed(children[u]): stack.append((v, 0))","for v in children[u]: stack.append((v, 0))")),("把 k 大于 1 的序号左移",imc_code.replace("tin[p]+k-1","tin[p]+max(0,k-2)"))]))

    specs.append(add("oa-geneva-trading-1",["置换","循环"],"Minimum Number of Permutation Operations","中等",
      "给定 1..n 的一个排列 p。一次操作对每个 1-based 下标 i 同时令 temp[i]=arr[p[i]]，随后 arr=temp。求对任意 n 个互异元素的初始数组，至少执行多少次操作才能回到初始数组；答案对 1,000,000,007 取模。",
      "n；第二行 n 个排列值 p[i]。",
      "输出最小操作次数模 1,000,000,007。",
      "分解排列循环；恢复原数组所需次数是所有循环长度的最小公倍数。",
      "## 思路\n\n排列由互不相交的循环组成。一次操作沿置换把每个位置的元素移动一格；长度为 L 的循环经过 L 次才逐项回到原位。因此总步数必须且只需是所有循环长度的公倍数，最小正步数为其最小公倍数。由于 LCM 可能很大，统计各循环长度中每个质因子的最大指数，再模乘恢复 LCM。\n\n## 正确性证明\n\n若执行 t 次后数组恢复，因为数组元素互异，每个位置都必须回到原位置；在每个循环上这等价于 L|t。所有循环同时恢复当且仅当 t 是所有循环长度的公倍数。一个数能被所有循环长度整除，当且仅当其每个质因子指数不小于各循环长度中的最大指数，因此质因子最高幂的乘积正是最小正整数解。\n\n## 复杂度\n\n分解循环长度和建最小质因子表，时间 O(n log n)，空间 O(n)。",
      geneva_code,
      geneva_oracle,geneva_inputs(),[("以最大循环长度代替最小公倍数", "def solve(raw):\n t=list(map(int,raw.split()));n=t[0];p=[x-1 for x in t[1:n+1]];seen=[False]*n;ans=1\n for i in range(n):\n  if not seen[i]:\n   u=i;length=0\n   while not seen[u]:seen[u]=True;length+=1;u=p[u]\n   ans=max(ans,length)\n return str(ans)\n"),("循环长度直接相乘", "def solve(raw):\n t=list(map(int,raw.split()));n=t[0];p=[x-1 for x in t[1:n+1]];seen=[False]*n;ans=1;mod=1000000007\n for i in range(n):\n  if not seen[i]:\n   u=i;length=0\n   while not seen[u]:seen[u]=True;length+=1;u=p[u]\n   ans=ans*length%mod\n return str(ans)\n")]))

    specs.append(add("oa-valkyrie-trading-4",["位运算","数学"],"Is Power of 2","简单",
      "给定整数 n，若 n 是 2 的非负整数次幂则返回 1，否则返回 0。示例中 1=2⁰，因此 1 属于 2 的幂。",
      "输入一个有符号 32-bit 整数 n（−2^31≤n≤2^31−1），按原题函数签名的 int 类型补齐范围。",
      "输出 1 或 0。",
      "正整数只有一个二进制位为 1 时是 2 的幂。",
      "## 思路\n\n先排除非正数。对正数，若 n 是 2 的幂，其二进制只有最低位的一个 1；n−1 会把该位变成 0 并把其右侧变成 1，因此 n&(n−1)=0。反过来，该等式成立时 n 只能有一个置位。\n\n## 正确性证明\n\nn>0 且 n&(n−1)=0 当且仅当 n 的二进制恰含一个 1 位，正好等价于 n=2^k (k≥0)。\n\n## 复杂度\n\n时间 O(1)，空间 O(1)。",
      power_code,
      power_oracle,power_inputs(),[("将零误判为 2 的幂", "def solve(raw):\n n=int(raw.strip())\n return '1' if (n&(n-1))==0 else '0'\n"),("检查相邻奇偶位", "def solve(raw):\n n=int(raw.strip())\n return '1' if n>0 and (n&(n+1))==0 else '0'\n")]))

    specs.append(add("oa-sofi-1",["二分查找","贪心"],"Job Scheduling","中等",
      "将 m 个工作分给 n 个处理器，每台至少一个。相邻处理器的工作数之差至多为 1。指定的第 k 台效率最高；求在合法分配中它最多能拿到多少工作。",
      "输入 n m k，其中 k 为 1-based。",
      "输出第 k 台处理器可获得的最大工作数。",
      "固定峰值 x 时，为让总数最少，两侧工作数从 x−1 开始逐个递减，到 1 后保持 1。",
      "## 思路\n\n二分指定处理器的工作数 x。固定 x 时，为尽量少用工作，向左右相邻处理器依次放 x−1、x−2……，降到 1 后其余位置放 1。分别用等差数列求左右两边的最小和。若最小总和不超过 m，则 x 可行；该条件随 x 单调，因此二分最大可行值。\n\n## 正确性证明\n\n相邻差不超过 1 且指定值为 x 时，每向外走一步，处理器工作数至少是前一个值减 1，并且至少为 1。上述构造逐点取该下界，得到所有可行配置中的最小总和。于是 x 可行当且仅当该最小和≤m；可行性对 x 单调，二分得到最大值。\n\n## 复杂度\n\n时间 O(log m)，空间 O(1)。",
      sofi_code,sofi_oracle,sofi_inputs(),[("左侧少计一个处理器",sofi_code.replace("side(k-1,x)","side(max(0,k-2),x)")),("右侧少计一个处理器",sofi_code.replace("side(n-k,x)","side(max(0,n-k-1),x)"))]))

    # Every item in the explicitly scoped source list receives an individual decision.
    blocked = {
      "oa-optiver-3": "原题只有月份范围和有效日期保证，没有年份上界；返回类型为 int，无法保证跨任意合法年份的天数差可由 int 表示，不能自行添加年份限制。",
      "oa-drw-1": "正文称各方块采用 source prompt 中展示的固定朝向，但固定形状定义依赖示意图；现存文本快照未保留图形，不能仅凭解答代码推断所有朝向后当作原题语义。",
      "oa-walleye-capital-1": "样例输出与所给 cache_time=3、server_time=5 及命中解释冲突（首次未命中仍输出 3，命中却出现 2/5），无法确定期望判题结果。",
      "oa-headlands-1": "题目规模允许 10^7 条日志，原文没有明确总 token/字符上限；给出的 DSU 小并查集方案还要为每个连通分量维护路径映射，无法据现有界限给出可执行且可验证的资源协议。",
      "oa-dtcc-1": "有限小数例子 1/8 要求输出 `0.1250 0`，但文字未定义终止小数末尾零的数量/周期表示；`0.125 0` 与样例数值相同却字符串不同。",
      "oa-gemini-1": "原题明确没有数值上界，而答案类型是 int；既无法保证结果不溢出，也不能据此选择可执行的输入规模和算法限制。",
      "oa-affirm-1": "事件含日期但资格只写 net redeemed count，未说明统计截止到 cutoffDate 的历史事件，亦未定义负净次数或超过上限的坏数据；按全部事件求净值和按截止日前事件求净值会产生不同答案。",
    }
    target_ids = ["oa-jane-street-1","oa-optiver-3","oa-drw-1","oa-imc-2",
      "oa-walleye-capital-1","oa-geneva-trading-1","oa-headlands-1",
      "oa-valkyrie-trading-4","oa-dtcc-1","oa-gemini-1","oa-affirm-1","oa-sofi-1"]
    authored = {x["entry"]["id"] for x in specs}
    reviews=[]; sources={}
    for pid in target_ids:
        src=ITEMS[pid]
        decision="authored" if pid in authored else "blocked"
        reason=("按不可变 OAMaster 原始题源快照核对；补充了透明的 stdin/stdout 协议。120 个唯一小规模 oracle 输入均由独立慢速模型核对，30 个正式用例上的两个正常退出变异解均被击杀。未运行 GoJudge。" if decision=="authored" else blocked[pid])
        reviews.append({"id":pid,"status":decision,"reason":reason,
            "sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],
            "catalogContentHash":src["contentHash"]})
        manifest_file=next(f for f in MANIFEST["files"] if f["file"]==src["companySlug"]+".mdx")
        raw=subprocess.run(["git","-C","/private/tmp/oa-master-readonly","show",
          f'{CATALOG["source"]["commit"]}:web/content/docs/companies/{src["companySlug"]}.mdx'],
          capture_output=True,check=True).stdout
        blob=subprocess.run(["git","-C","/private/tmp/oa-master-readonly","hash-object","--stdin"],
          input=raw,capture_output=True,check=True,text=False).stdout.decode().strip()
        sources[pid]={"sourceCommit":CATALOG["source"]["commit"],
          "rawPath":f'web/content/docs/companies/{src["companySlug"]}.mdx',
          "rawGitBlob":blob,"sourceFileSha256":manifest_file["sourceHash"],
          "catalogContentHash":src["contentHash"],"sourceUrl":src["sourceUrl"],
          "decision":decision,"reason":reason}

    docs={
      "candidate-batches/trading-firms-special.json":{"schemaVersion":1,"items":[x["entry"] for x in specs]},
      "reviews/trading-firms-special.json":{"schemaVersion":1,"items":reviews},
      "source-evidence/trading-firms-special.json":{"schemaVersion":1,
        "upstreamRepository":CATALOG["source"]["repository"],
        "upstreamCommit":CATALOG["source"]["commit"],"origin":CATALOG["source"]["origin"],
        "items":sources,"note":"每题 rawPath、Git blob、整文件 SHA256 和 catalog 题目指纹均对应固定上游提交；blocked 项未生成可评测题包。"},
      "validation/trading-firms-special.json":{"schemaVersion":1,"seed":SEED,
        "problems":[x["validation"] for x in specs],
        "note":"本地 Python 参考实现、独立 oracle 和正常退出变异解验证；尚未运行 GoJudge 或生产沙箱。"}}
    for rel,doc in docs.items():dump(OUT/rel,doc)
    print(f"Authored {len(specs)} candidates; individually reviewed {len(target_ids)-len(specs)} blocked items.")


if __name__ == "__main__":
    main()
