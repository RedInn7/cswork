from __future__ import annotations

import hashlib
import json
import random
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
ITEMS = {x["id"]: x for x in CATALOG["items"]}
SOURCE = CATALOG["source"]
BATCH = "rubrik-capital-remaining"
SEED = 20261005
RNG = random.Random(SEED)


def dump(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sha(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def execute(code: str, raw: str) -> str:
    p = subprocess.run(
        ["python3", "-I", "-c", code],
        input=raw, text=True, capture_output=True, timeout=5,
    )
    if p.returncode:
        raise AssertionError((p.stderr, raw))
    return p.stdout


def with_cli(code: str) -> str:
    """Store a runnable stdin/stdout solution, not only the judge function."""
    if "sys.stdin.read()" in code:
        return code
    return (
        "import sys\n" + code.rstrip() +
        "\n\nif __name__ == '__main__':\n    print(solve(sys.stdin.read()))\n"
    )


def normalize_package(raw: dict) -> dict:
    js = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    p = subprocess.run(["node", "--import", "tsx", "-e", js], cwd=ROOT,
                       input=json.dumps(raw, ensure_ascii=False), text=True,
                       capture_output=True, check=True)
    return json.loads(p.stdout)


def case(name: str, raw: str, out: str, hidden: bool) -> dict:
    return {"name": name, "input": raw, "expectedOutput": out.rstrip("\n") + "\n",
            "hidden": hidden, "weight": 1}


def add_problem(pid: str, title: str, tags: list[str], description: str,
                input_desc: str, output_desc: str, code: str, editorial: str,
                inputs: list[str], oracle, mutant_defs: list[tuple[str, str]]) -> dict:
    source = ITEMS[pid]
    code = with_cli(code)
    mutant_defs = [(name, with_cli(bad)) for name, bad in mutant_defs]
    oracle_rows = [{"input": raw, "expectedOutput": oracle(raw) + "\n"} for raw in inputs]
    cases = [case(("公开样例 " + str(i + 1)) if i < 3 else ("隐藏测试 " + str(i - 2)),
                  row["input"], row["expectedOutput"], i >= 3)
             for i, row in enumerate(oracle_rows[:30])]
    for row in oracle_rows:
        assert execute(code, row["input"]) == row["expectedOutput"], (pid, row)
    mutants = []
    controls = []
    for name, bad in mutant_defs:
        rejected = [i for i, row in enumerate(oracle_rows[:30])
                    if execute(bad, row["input"]) != row["expectedOutput"]]
        assert rejected, (pid, name, "mutant survived")
        mutants.append({"name": name, "code": bad})
        controls.append({"name": name, "rejectedByCases": rejected})

    raw_package = {
        "schemaVersion": 1,
        "problem": {
            "id": pid, "courseId": "gomall", "lessonId": "00-overview",
            "title": title, "difficulty": "中等",
            "tags": ["OA", source["companyName"], *tags],
            "description": description,
            "input": input_desc, "output": output_desc,
            "explanation": "完整思路、正确性证明与复杂度见配套题解。",
            "hints": ["按定义逐条处理操作，并注意边界。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 8192,
            "checker": "tokens", "languages": ["python", "go", "java", "cpp"],
        },
        "cases": cases,
    }
    package = normalize_package(raw_package)
    canonical = json.dumps(package, ensure_ascii=False, separators=(",", ":"))
    dump(OA / "packages" / f"{pid}.json", package)
    (OA / "references" / f"{pid}.py").write_text(code)
    dump(OA / "oracles" / f"{pid}.json", oracle_rows)
    dump(OA / "mutants" / f"{pid}.json", mutants)
    for i, (name, bad) in enumerate(mutant_defs, 1):
        (OA / "negative-controls" / f"{pid}-{i}.py").write_text("# " + name + "\n" + bad)
    dump(OA / "editorials" / f"{pid}.json", {
        "schemaVersion": 1, "id": pid, "title": title,
        "explanation": editorial,
        "solutions": [{"language": "python", "code": code}],
        "sourceUrl": source["sourceUrl"],
        "sourceContentHash": source["contentHash"], "author": "CSWork",
    })
    return {
        "entry": {"id": pid, "sourceContentHash": source["contentHash"],
                  "packageChecksum": sha(canonical), "editorial": editorial,
                  "authoredSolutions": [{"language": "python", "code": code}]},
        "validation": {"id": pid, "oracleCases": len(oracle_rows),
                       "uniqueOracleInputs": len({x["input"] for x in oracle_rows}),
                       "referenceCliCases": len(cases), "referenceSha256": sha(code),
                       "publicCases": sum(not x["hidden"] for x in cases),
                       "hiddenCases": sum(x["hidden"] for x in cases),
                       "negativeControls": controls},
    }


def build_inputs(make_one, count: int = 120) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    while len(values) < count:
        raw = make_one()
        if raw not in seen:
            seen.add(raw)
            values.append(raw)
    return values


def main() -> None:
    results: list[dict] = []
    evidence: dict[str, dict] = {}
    reviews: list[dict] = []

    # Capital One 3: matrix mutation commands.
    matrix_code = r'''def solve(raw):
 t=raw.split();it=iter(t);r,c=int(next(it)),int(next(it));a=[[int(next(it)) for _ in range(c)] for _ in range(r)];q=int(next(it))
 for _ in range(q):
  op=next(it)
  if op=='swapRows':
   x,y=int(next(it)),int(next(it));a[x],a[y]=a[y],a[x]
  elif op=='swapColumns':
   x,y=int(next(it)),int(next(it))
   for row in a:row[x],row[y]=row[y],row[x]
  elif op=='reverseRow':a[int(next(it))].reverse()
  elif op=='reverseColumn':
   x=int(next(it))
   for i in range(len(a)//2):a[i][x],a[-i-1][x]=a[-i-1][x],a[i][x]
  else:a=[list(row) for row in zip(*a[::-1])]
 return '\n'.join(' '.join(map(str,row)) for row in a)
'''
    def matrix_oracle(raw: str) -> str:
        t=raw.split();r,c=int(t[0]),int(t[1]);i=2
        a=[[int(t[i+x*c+y]) for y in range(c)] for x in range(r)];i+=r*c;q=int(t[i]);i+=1
        for _ in range(q):
            op=t[i];i+=1
            if op=="swapRows":
                x,y=int(t[i]),int(t[i+1]);i+=2;a[x],a[y]=a[y],a[x]
            elif op=="swapColumns":
                x,y=int(t[i]),int(t[i+1]);i+=2
                a=[[v if j not in (x,y) else row[y] if j==x else row[x] for j,v in enumerate(row)] for row in a]
            elif op=="reverseRow":
                x=int(t[i]);i+=1;a[x]=list(reversed(a[x]))
            elif op=="reverseColumn":
                x=int(t[i]);i+=1;a=[[row[j] if j!=x else a[r-1-k][x] for j in range(c)] for k,row in enumerate(a)]
            else:
                a=[[a[r-1-j][x] for j in range(r)] for x in range(c)];r,c=c,r
        return "\n".join(" ".join(map(str,row)) for row in a)
    def gen_matrix() -> str:
        r,c=RNG.randint(1,5),RNG.randint(1,5);initial=[[RNG.randint(-8,20) for _ in range(c)] for _ in range(r)]
        ops=[]
        for _ in range(RNG.randint(1,10)):
            choices=["swapRows","swapColumns","reverseRow","reverseColumn"]+(["rotate90Clockwise"] if r==c else [])
            op=RNG.choice(choices)
            if op=="swapRows":args=[RNG.randrange(r),RNG.randrange(r)]
            elif op=="swapColumns":args=[RNG.randrange(c),RNG.randrange(c)]
            elif op=="reverseRow":args=[RNG.randrange(r)]
            elif op=="reverseColumn":args=[RNG.randrange(c)]
            else:args=[]
            ops.append(" ".join(map(str,[op,*args])))
        return f"{r} {c}\n"+"\n".join(" ".join(map(str,x)) for x in initial)+f"\n{len(ops)}\n"+"\n".join(ops)+"\n"
    matrix_inputs=["2 3\n1 2 3\n4 5 6\n3\nswapRows 0 1\nreverseColumn 1\nswapColumns 0 2\n",
                   "2 2\n1 2\n3 4\n1\nrotate90Clockwise\n",
                   "3 2\n1 2\n3 4\n5 6\n2\nreverseRow 1\nreverseColumn 0\n"]
    matrix_inputs.extend(build_inputs(gen_matrix,117))
    bad_rotation=matrix_code.replace("zip(*a[::-1])", "zip(*a)")
    bad_reverse=matrix_code.replace("a[i][x],a[-i-1][x]=a[-i-1][x],a[i][x]", "a[i][x],a[-i][x]=a[-i][x],a[i][x]")
    results.append(add_problem("oa-capital-one-3","Robot Matrix Commands",["矩阵","模拟"],
        "按顺序执行行/列交换、反转及顺时针旋转。坐标使用 0-based 下标。",
        "r c；接着 r 行矩阵；然后 q；接着 q 行命令。命令为 `swapRows r1 r2`、`swapColumns c1 c2`、`reverseRow r`、`reverseColumn c` 或 `rotate90Clockwise`。旋转时矩阵必须为正方形。本站补充：r,c≤50，q≤500。",
        "输出最终矩阵，每行一行，数值以空格分隔。",matrix_code,
        "## 思路\n\n按输入顺序直接执行矩阵操作。\n\n## 正确性证明\n\n每条操作都按定义应用于当时的矩阵，顺序执行后的状态即为全部命令的结果。\n\n## 复杂度\n\n每条操作 O(rc)，空间 O(rc)。\n\n## 来源说明\n\n原题未给 stdin/stdout 格式或坐标基准；本题补充 0-based 序列化协议，并约定仅正方矩阵可旋转。",
        matrix_inputs,matrix_oracle,[("顺时针旋转误写成逆时针",bad_rotation),("反转列取错镜像行",bad_reverse)]))

    # Capital One 5: aligned block allocator.
    alloc_code = r'''def solve(raw):
 t=list(map(int,raw.split()));n,q=t[:2];mem=t[2:2+n];ids=[0]*n;nextid=1;out=[];i=2+n
 for _ in range(q):
  typ,x=t[i:i+2];i+=2
  if typ==0:
   s=next((s for s in range(0,n,8) if s+x<=n and all(v==0 for v in mem[s:s+x])),-1)
   if s<0:out.append(-1)
   else:
    for j in range(s,s+x):mem[j]=1;ids[j]=nextid
    out.append(s);nextid+=1
  else:
   freed=0
   for j in range(n):
    if ids[j]==x:ids[j]=0;mem[j]=0;freed+=1
   out.append(freed if freed else -1)
 return ' '.join(map(str,out))
'''
    def alloc_oracle(raw: str) -> str:
        t=list(map(int,raw.split()));n,q=t[:2];memory=t[2:2+n];id_at=[None]*n;allocations={};i=n+2;nextid=1;ans=[]
        for _ in range(q):
            typ,arg=t[i:i+2];i+=2
            if typ==0:
                starts=[s for s in range(n) if s%8==0 and s+arg<=n and memory[s:s+arg]==[0]*arg]
                if not starts:ans.append("-1")
                else:
                    s=starts[0];cells=list(range(s,s+arg));allocations[nextid]=cells
                    for c in cells:memory[c]=1;id_at[c]=nextid
                    ans.append(str(s));nextid+=1
            else:
                cells=allocations.pop(arg,[])
                for c in cells:memory[c]=0;id_at[c]=None
                ans.append(str(len(cells) if cells else -1))
        return " ".join(ans)
    def gen_alloc() -> str:
        n=RNG.randint(8,64);q=RNG.randint(5,35);mem=[RNG.choice([0,0,0,1]) for _ in range(n)]
        qs=[(RNG.choice([0,0,1]),RNG.randint(1,min(n,20))) for _ in range(q)]
        return f"{n} {q}\n"+" ".join(map(str,mem))+"\n"+"\n".join(f"{x} {y}" for x,y in qs)+"\n"
    alloc_inputs=["24 6\n"+" ".join(["0"]*24)+"\n0 9\n0 8\n1 1\n0 8\n1 2\n1 99\n",
                  "16 4\n"+" ".join(["0"]*16)+"\n0 1\n0 1\n1 1\n0 8\n",
                  "8 3\n1 0 0 0 0 0 0 0\n0 1\n1 1\n0 8\n"]
    alloc_inputs.extend(build_inputs(gen_alloc,117))
    bad_align=alloc_code.replace("range(0,n,8)","range(0,n,4)")
    bad_release=alloc_code.replace("if ids[j]==x:ids[j]=0;mem[j]=0;freed+=1","if ids[j]==x and freed==0:ids[j]=0;mem[j]=0;freed+=1")
    results.append(add_problem("oa-capital-one-5","Memory Allocator — Aligned Alloc + Erase",["数组","模拟"],
        "从 8 个单元边界开始分配最靠左的连续空闲块，之后可按分配 ID 释放整个块。",
        "n q；一行 n 个 0/1 初始状态；随后 q 行：`0 x` 申请 x 个单元，`1 id` 释放 id。下标从 0 开始；初始占用单元不属于可释放分配。本站补充：n≤5000、q≤1000、x≥1。",
        "每个请求输出一行：申请返回起点或 -1；释放返回释放单元数或 -1。",alloc_code,
        "## 思路\n\n按 8 的倍数递增检查候选起点，找到首个容量足够且全部空闲的区间即分配，并将新 ID 记入区间每个单元。释放时按 ID 扫描并清空所有对应单元。\n\n## 正确性证明\n\n递增枚举完整覆盖所有合法对齐起点，首个符合连续空闲条件者就是最左可分配块。每个成功分配使用唯一 ID，完整扫描精确释放其全部单元。\n\n## 复杂度\n\n每次操作 O(n)，空间 O(n)。\n\n## 来源说明\n\n本站补充输入协议及初始占用单元不可释放的约定。",
        alloc_inputs,alloc_oracle,[("错误使用 4 单元对齐",bad_align),("释放时只清一个单元",bad_release)]))

    # Capital One 8: half-open byte ranges.
    segment_code = r'''def solve(raw):
 t=list(map(int,raw.split()));n,m=t[:2];i=2;segments=[]
 for _ in range(n):segments.append((t[i],t[i+1]));i+=2
 data=t[i:i+m];seen=set();done=[False]*n;count=0;out=[]
 for byte in data:
  seen.add(byte)
  for j,(start,length) in enumerate(segments):
   if not done[j] and all(x in seen for x in range(start,start+length)):done[j]=True;count+=1
  out.append(str(count))
 return ' '.join(out)
'''
    def segment_oracle(raw: str) -> str:
        t=list(map(int,raw.split()));n,m=t[:2];i=2;seg=[]
        for _ in range(n):seg.append(set(range(t[i],t[i]+t[i+1])));i+=2
        seen=set();complete=set();answer=[]
        for b in t[i:i+m]:
            seen.add(b)
            for j,s in enumerate(seg):
                if j not in complete and s.issubset(seen):complete.add(j)
            answer.append(str(len(complete)))
        return " ".join(answer)
    def gen_segments() -> str:
        n=RNG.randint(1,8);m=RNG.randint(1,20);ss=[(RNG.randint(0,15),RNG.randint(1,6)) for _ in range(n)];bs=[RNG.randint(0,22) for _ in range(m)]
        return f"{n} {m}\n"+"\n".join(f"{s} {l}" for s,l in ss)+"\n"+" ".join(map(str,bs))+"\n"
    seg_inputs=["3 7\n0 3\n2 3\n8 1\n2 0 1 3 2 8 8\n","2 4\n5 1\n0 2\n0 1 0 5\n","1 3\n0 1\n2 2 2\n"]
    seg_inputs.extend(build_inputs(gen_segments,117))
    bad_right=segment_code.replace("range(start,start+length)","range(start,start+length+1)")
    bad_seen=segment_code.replace("seen.add(byte)","seen.clear();seen.add(byte)")
    results.append(add_problem("oa-capital-one-8","File Transfer Segments — Count Unique After Each Byte",["数组","哈希表"],
        "字节逐个到达；每次到达后统计已完整收到的文件段。段覆盖半开区间 [start,start+length)。",
        "n m；随后 n 行 `start length`；最后一行 m 个非负字节偏移。本站补充：n,m≤1000，总区间长度≤20000，偏移≤200000。",
        "输出 m 个整数，以空格分隔；第 i 个数为前 i 个字节到达后已完成段数。",segment_code,
        "## 思路\n\n维护已收到的偏移集合。每到一个偏移，检查还未完成的段是否其半开区间中的每个位置都出现；完成后只计数一次。\n\n## 正确性证明\n\n区间集合包含恰好段要求的字节位置；子集检查等价于段完全收到。每一时刻更新所有未完成段，因此累计完成数准确。\n\n## 复杂度\n\n时间 O(mL)，L 为所有段总长度；空间 O(L+m)。\n\n## 来源说明\n\n原文明确采用 `[start,start+length)`；本站补充 stdin/stdout 协议与规模界。",
        seg_inputs,segment_oracle,[("右端点错误地闭区间",bad_right),("只保留最后收到的字节",bad_seen)]))

    # Capital One 11: deterministic right-first movement and teleports.
    maze_code = r'''def solve(raw):
 t=list(map(int,raw.split()));n,m=t[:2];i=2;b=t[i];i+=1;obs=set()
 for _ in range(b):obs.add((t[i],t[i+1]));i+=2
 k=t[i];i+=1;tele={}
 for _ in range(k):tele[(t[i],t[i+1])]=(t[i+2],t[i+3]);i+=4
 p=(0,0);steps=1;seen=set()
 while True:
  if p in seen:return '-2'
  seen.add(p)
  if p in tele:p=tele[p];steps+=1;continue
  if p==(n-1,m-1):return str(steps)
  r,c=p;right=(r,c+1);down=(r+1,c)
  if c+1<m and right not in obs:p=right
  elif r+1<n and down not in obs:p=down
  else:return '-1'
  steps+=1
'''
    def maze_oracle(raw: str) -> str:
        t=list(map(int,raw.split()));n,m=t[:2];i=2;b=t[i];i+=1;walls=set()
        for _ in range(b):walls.add((t[i],t[i+1]));i+=2
        k=t[i];i+=1;warp={}
        for _ in range(k):warp[(t[i],t[i+1])]=(t[i+2],t[i+3]);i+=4
        p=(0,0);steps=1;trail=[]
        while p not in trail:
            trail.append(p)
            if p in warp:p=warp[p];steps+=1;continue
            if p==(n-1,m-1):return str(steps)
            x,y=p
            candidates=[(x,y+1),(x+1,y)]
            p=next((v for idx,v in enumerate(candidates) if ((idx==0 and y+1<m) or (idx==1 and x+1<n)) and v not in walls),None)
            if p is None:return "-1"
            steps+=1
        return "-2"
    def gen_maze() -> str:
        n,m=RNG.randint(1,6),RNG.randint(1,6);cells=[(r,c) for r in range(n) for c in range(m) if (r,c)!=(0,0)];RNG.shuffle(cells)
        walls=cells[:RNG.randint(0,min(4,len(cells)))];tele=[];free=[x for x in cells if x not in walls]
        if len(free)>1 and RNG.random()<.4:tele=[(*free[0],*free[1])]
        return f"{n} {m}\n{len(walls)}\n"+"\n".join(f"{r} {c}" for r,c in walls)+("\n" if walls else "")+f"{len(tele)}\n"+"\n".join(" ".join(map(str,x)) for x in tele)+"\n"
    maze_inputs=["3 4\n1\n0 1\n1\n1 1 2 2\n","3 3\n2\n0 1\n1 0\n0\n","3 3\n0\n2\n0 1 1 0\n1 1 0 1\n"]
    maze_inputs.extend(build_inputs(gen_maze,117))
    bad_preference=maze_code.replace("if c+1<m and right not in obs:p=right", "if r+1<n and down not in obs:p=down").replace("elif r+1<n and down not in obs:p=down", "elif c+1<m and right not in obs:p=right")
    bad_count=maze_code.replace("p=tele[p];steps+=1;continue", "p=tele[p];continue")
    results.append(add_problem("oa-capital-one-11","Labyrinth Right-Then-Down with Teleports",["模拟","图"],
        "从左上角开始，优先向右；只有右侧不可走时才向下。碰到传送起点立即传送并继续。",
        "n m；障碍数 b 和 b 行 0-based 坐标；传送数 k 和 k 行 `sr sc er ec`。传送起点唯一，终点不是起点，所有传送端点都非障碍。本站补充：n,m≤100。",
        "到达右下角输出经过的格子数（起点、传送起点和终点都计入）；无路输出 -1；重访格子造成无限循环输出 -2。",
        maze_code,"## 思路\n\n逐格确定性模拟，记录已经进入的坐标以检测循环。每步先执行传送，再检查出口；普通移动优先右、否则下。\n\n## 正确性证明\n\n模拟状态转换与题面规则逐条一致，且计数覆盖起点、移动到的格子以及传送终点。若重访同一位置，由于地图和选择规则固定，此后路径将周期重复。\n\n## 复杂度\n\n每步 O(1)，最多访问 O(nm) 个格子；空间 O(nm)。\n\n## 来源说明\n\n源文把右下角索引写成 (n,m)；本站按矩阵 0-based 下标明确为 (n−1,m−1)。",
        maze_inputs,maze_oracle,[("错误地优先向下",bad_preference),("传送终点漏计",bad_count)]))

    # Capital One 17: exclusive execution time with inclusive end timestamp.
    time_code = r'''def solve(raw):
 t=raw.split();n,m=int(t[0]),int(t[1]);ans=[0]*n;st=[];prev=0
 for log in t[2:2+m]:
  fid,kind,ts=log.split(':');fid=int(fid);ts=int(ts)
  if kind=='start':
   if st:ans[st[-1]]+=ts-prev
   st.append(fid);prev=ts
  else:ans[st.pop()]+=ts-prev+1;prev=ts+1
 return ' '.join(map(str,ans))
'''
    def time_oracle(raw: str) -> str:
        t=raw.split();n,m=int(t[0]),int(t[1]);ev=[x.split(":") for x in t[2:2+m]];starts={};ends={}
        for f,k,ts in ev:(starts if k=="start" else ends).setdefault(int(ts),[]).append(int(f))
        ans=[0]*n;stack=[]
        for ts in range(max([*starts.keys(),*ends.keys()],default=-1)+1):
            stack.extend(starts.get(ts,[]))
            if stack:ans[stack[-1]]+=1
            for f in ends.get(ts,[]):
                if not stack or stack[-1]!=f:raise ValueError("invalid event sequence")
                stack.pop()
        return " ".join(map(str,ans))
    def gen_time() -> str:
        n=RNG.randint(1,5);ev=[];now=0
        for _ in range(RNG.randint(1,6)):
            f=RNG.randrange(n);ev.append(f"{f}:start:{now}");now+=RNG.randint(1,4)-1;ev.append(f"{f}:end:{now}");now+=1
        return f"{n} {len(ev)}\n"+"\n".join(ev)+"\n"
    time_inputs=["3 6\n0:start:0\n2:start:4\n2:end:5\n1:start:7\n1:end:10\n0:end:11\n","1 2\n0:start:2\n0:end:4\n","2 4\n0:start:0\n1:start:1\n1:end:1\n0:end:2\n"]
    time_inputs.extend(build_inputs(gen_time,117))
    bad_end=time_code.replace("ts-prev+1","ts-prev")
    bad_pause=time_code.replace("ans[st[-1]]+=ts-prev","ans[st[-1]]+=ts-prev+1")
    results.append(add_problem("oa-capital-one-17","Get Function Execution Time",["栈","模拟"],
        "依据按时间排序的 start/end 日志，统计每个函数独占 CPU 的时长；调用结束的时间戳也计入。",
        "第一行 n m；随后 m 行 `function_id:start:timestamp` 或 `function_id:end:timestamp`。日志形成合法嵌套调用序列。本站补充 timestamp≤1000000。",
        "输出 n 个独占时间，以空格分隔。",time_code,
        "## 思路\n\n调用栈顶是当前运行函数。新事件到来时，把从 prev 到事件时刻前的时间计给栈顶；start 压栈，end 将含结束秒的一段记给该函数并弹栈。\n\n## 正确性证明\n\n两个相邻事件之间只由栈顶函数执行；start 时刻切换到新栈顶，end 时刻用 +1 计入结束函数。故所有执行秒恰好分配给当时运行的函数。\n\n## 复杂度\n\n时间 O(m)，空间 O(n)。\n\n## 来源说明\n\n原始描述部分截断，但给出的完整示例与标准独占时间定义相符；本站补充日志序列化格式。",
        time_inputs,time_oracle,[("结束时刻漏计",bad_end),("抢占边界重复计入旧函数",bad_pause)]))

    # Rubrik 11: relative order of each parity is invariant under allowed swaps.
    smart_code = r'''def solve(raw):
 t=raw.split();q=int(t[0]);out=[]
 for s in t[1:1+q]:
  e=[c for c in s if int(c)%2==0];o=[c for c in s if int(c)%2==1];i=j=0;ans=[]
  while i<len(e) and j<len(o):
   if e[i]<o[j]:ans.append(e[i]);i+=1
   else:ans.append(o[j]);j+=1
  ans.extend(e[i:]);ans.extend(o[j:]);out.append(''.join(ans))
 return '\n'.join(out)
'''
    def smart_oracle(raw: str) -> str:
        t=raw.split();q=int(t[0]);answers=[]
        for s in t[1:1+q]:
            # Exhaustive interleavings are an independent oracle for the small generated strings.
            ev=[x for x in s if int(x)%2==0];od=[x for x in s if int(x)%2==1];best=None
            def visit(i: int,j: int,prefix: str) -> None:
                nonlocal best
                if best is not None and prefix>best[:len(prefix)]:return
                if i==len(ev) and j==len(od):best=prefix;return
                if i<len(ev):visit(i+1,j,prefix+ev[i])
                if j<len(od):visit(i,j+1,prefix+od[j])
            visit(0,0,"");answers.append(best or "")
        return "\n".join(answers)
    def gen_smart() -> str:
        q=RNG.randint(1,7);ss=["".join(RNG.choice("0123456789") for _ in range(RNG.randint(1,12))) for _ in range(q)]
        return str(q)+"\n"+"\n".join(ss)+"\n"
    smart_inputs=["1\n4321\n","3\n97531\n02468\n9081726354\n","2\n1203\n5550\n"]
    smart_inputs.extend(build_inputs(gen_smart,117))
    bad_merge=smart_code.replace("if e[i]<o[j]","if e[i]>o[j]")
    bad_class=smart_code.replace("o=[c for c in s if int(c)%2==1]", "o=[c for c in s if int(c)%2==0]")
    results.append(add_problem("oa-rubrik-11","Doing Smart Work",["贪心","字符串"],
        "可任意次交换相邻且奇偶性不同的数字，求能够得到的最小数字，允许前导零。",
        "第一行 t；随后 t 行数字串。本站补充：t≤10000，总长度≤200000。",
        "每个测试用例输出最小数字串一行。",smart_code,
        "## 思路\n\n不同奇偶数字可交换，但相同奇偶数字无法互相越过，所以奇数子序列和偶数子序列内部顺序固定。将两条子序列按队首较小者归并。\n\n## 正确性证明\n\n允许交换恰能产生保持两个子序列相对顺序的所有交错。每一步若选择较大队首而非较小队首，当前第一个不同位置会更大；选择较小队首是字典序最优。\n\n## 复杂度\n\n时间 O(n)，空间 O(n)。\n\n## 来源说明\n\n原题明确允许任意次数交换相邻异奇偶数字；本站补充标准输入输出格式及总长度界。",
        smart_inputs,smart_oracle,[("归并时选较大队首",bad_merge),("奇偶分类方向错误",bad_class)]))

    # Rubrik 16: count i<j<k by residue. Triple-loop oracle remains independent.
    triple_code = r'''def solve(raw):
 t=list(map(int,raw.split()));n,d=t[:2];a=t[2:2+n];ans=0
 for i in range(n-2):
  freq={}
  for k in range(i+1,n):
   r=a[k]%d;freq[r]=freq.get(r,0)+1
  for j in range(i+1,n-1):
   r=a[j]%d;freq[r]-=1;ans+=freq.get((-a[i]-a[j])%d,0)
 return str(ans)
'''
    def triple_oracle(raw: str) -> str:
        t=list(map(int,raw.split()));n,d=t[:2];a=t[2:2+n]
        return str(sum(1 for i in range(n) for j in range(i+1,n) for k in range(j+1,n) if (a[i]+a[j]+a[k])%d==0))
    def gen_triples() -> str:
        n=RNG.randint(3,28);d=RNG.randint(2,15);a=[RNG.randint(1,1000000) for _ in range(n)]
        return f"{n} {d}\n"+" ".join(map(str,a))+"\n"
    triple_inputs=["5 5\n3 3 4 7 8\n","3 3\n1 1 1\n","6 2\n1 2 3 4 5 6\n"]
    triple_inputs.extend(build_inputs(gen_triples,117))
    bad_index=triple_code.replace("r=a[j]%d;freq[r]-=1;ans+=freq.get", "r=a[j]%d;ans+=freq.get")
    bad_residue=triple_code.replace("(-a[i]-a[j])%d", "(a[i]+a[j])%d")
    results.append(add_problem("oa-rubrik-16","Stock Prices",["数组","计数"],
        "统计下标递增三元组 (i,j,k)，使三天价格之和能被 d 整除。相同价格的不同下标组合分别计数。",
        "第一行 n d；第二行 n 个正整数价格。原题约束 n≤1000、price≤10^9、2≤d≤10^6。",
        "输出满足条件的下标三元组数量。",triple_code,
        "## 思路\n\n固定 i，建立右侧价格模 d 的频次。遍历 j 时先移除 j，再查询所需余数 `(-a[i]-a[j]) mod d` 的数量作为所有 k>j 的贡献。\n\n## 正确性证明\n\n移除 j 后频次恰含下标 k>j。余数条件与三数和被 d 整除等价。每个 i<j<k 唯一对应一次查询，因此计数无遗漏也无重复。\n\n## 复杂度\n\n时间 O(n²)，空间 O(n)。",
        triple_inputs,triple_oracle,[("把当前 j 也当作 k",bad_index),("目标余数符号错误",bad_residue)]))

    candidate_ids={x["entry"]["id"] for x in results}
    blocked_reasons={
        "oa-capital-one-1":"题目没有规定多段落之间是否留空行、右对齐行的宽度和边框是否含填充空格，输出布局不唯一。",
        "oa-capital-one-18":"原题明确依赖缺失的示意图片；仅文本无法唯一确定由两条对角线划分的区域边界与元素置换。",
        "oa-capital-one-19":"并列出现多个众数时未说明返回规则，且数字字符串是否允许负号/前导符号未定义。",
        "oa-rubrik-7":"同一符号 n 同时表示 universe/sample 数量，输入格式又将 m 定义为样本数，数量和字符串长度无法唯一解析。",
        "oa-rubrik-8":"约束全部被抓取成残缺数字；递归子树复活规则与样例过程无法确定一致的最终存活语义。",
        "oa-rubrik-9":"关键约束与计数公式被 HTML 清理成残缺符号，分段目标函数和 bitonic 定义不完整。",
        "oa-rubrik-10":"保留时间说明在关键位置截断；约束声称时间唯一但样例有重复，输出的链首依赖顺序也未明确定义。",
        "oa-rubrik-12":"公开样例 2 的输出值与所给变换结果的最大连续子数组和不一致，无法判断目标究竟是整体和还是连续子数组和。",
        "oa-rubrik-13":"事件日志的 type 1/type 2 文字定义被截断，且服务下标起点未说明，无法构造唯一输入/输出协议。",
        "oa-rubrik-14":"未说明一次移动后能否再次移动同一数字，也未限定操作次数；不同解释会导致不同最小串。",
        "oa-rubrik-15":"约束只剩 `:o`，每轮是否必须递减、递减元素如何选及 NULL 赋值时序不足以确定最小操作数。",
        "oa-rubrik-18":"题目依赖的组织关系图缺失，样例的直属汇报关系不完整，无法判定管理范围。",
        "oa-rubrik-21":"原文允许移动到前序 crate 或其后的 crates，未明确是仅相邻箱还是可任意选择后续箱；代价目标因此不同。",
        "oa-rubrik-24":"样例逐步数组与操作列表矛盾（append 值和复制结果均对不上），无法确定重复数组的具体语义。",
        "oa-rubrik-25":"例 2 输出与其展示的块切分/复用过程不符；任意位置匹配和非重叠分块两种描述也存在冲突。",
    }
    # This source cohort was previously reviewed on main. Its current coverage
    # status is therefore blocked/awaiting_sandbox, not unreviewed; keep the
    # generator's reviewed scope explicit and stable across promotion rebases.
    expected={
        "oa-capital-one-1", "oa-capital-one-3", "oa-capital-one-5",
        "oa-capital-one-8", "oa-capital-one-11", "oa-capital-one-17",
        "oa-capital-one-18", "oa-capital-one-19", "oa-rubrik-7",
        "oa-rubrik-8", "oa-rubrik-9", "oa-rubrik-10", "oa-rubrik-11",
        "oa-rubrik-12", "oa-rubrik-13", "oa-rubrik-14", "oa-rubrik-15",
        "oa-rubrik-16", "oa-rubrik-18", "oa-rubrik-21", "oa-rubrik-24",
        "oa-rubrik-25",
    }
    assert candidate_ids | set(blocked_reasons) == expected
    assert not candidate_ids & set(blocked_reasons)

    for result in results:
        pid=result["entry"]["id"];q=ITEMS[pid]
        reviews.append({"id":pid,"status":"authored",
                        "reason":"按固定 OAMaster 题源快照核对题意并补充显式 stdin/stdout 协议；独立 oracle 120 例、CLI 样例及两个正常退出错误解本地验证通过，未运行 GoJudge。",
                        "sourceUrls":[q["sourceUrl"]],"sourceContentHashes":[q["contentHash"]],"catalogContentHash":q["contentHash"]})
    for pid,reason in blocked_reasons.items():
        q=ITEMS[pid]
        reviews.append({"id":pid,"status":"blocked","reason":reason,
                        "sourceUrls":[q["sourceUrl"]],"sourceContentHashes":[q["contentHash"]],"catalogContentHash":q["contentHash"]})

    raw_meta={
        "rubrik":{"rawPath":"web/content/docs/companies/rubrik.mdx","rawGitBlob":"27ce8deadb8ef015ef1db75b5f6f5b1a3dd036c2","sourceFileSha256":"b7d37e4538b67205f2ee1be998ea8b393df72f0b6d0d15f0d8cee332422349af"},
        "capital-one":{"rawPath":"web/content/docs/companies/capital-one.mdx","rawGitBlob":"772a74d8b9eeed782c007b460d6e7652465e39a1","sourceFileSha256":"0ba5ef56625f6f86e98625430b25a7b6eac53d70d65a41d2c23a5d0a7ebf1626"},
    }
    ev_items={}
    for item in reviews:
        q=ITEMS[item["id"]]
        ev_items[item["id"]]={"sourceCommit":SOURCE["commit"],**raw_meta[q["companySlug"]],
                               "catalogContentHash":q["contentHash"],"sourceUrl":q["sourceUrl"],
                               "decision":item["status"],"reason":item.get("reason","")}
    dump(OA/"candidate-batches"/(BATCH+".json"),{"schemaVersion":1,"items":[x["entry"] for x in results]})
    dump(OA/"reviews"/(BATCH+".json"),{"schemaVersion":1,"items":reviews})
    dump(OA/"source-evidence"/(BATCH+".json"),{"schemaVersion":1,"repository":SOURCE["repository"],
         "origin":SOURCE["origin"],"commit":SOURCE["commit"],"items":ev_items})
    dump(OA/"validation"/(BATCH+".json"),{"schemaVersion":1,"seed":SEED,
         "problems":[x["validation"] for x in results],
         "note":"只做离线验证；用独立 oracle 对比 120 个唯一输入，执行保存的 reference CLI，并验证两个正常退出 mutant 均被公开/隐藏 formal cases 捕获。未运行 GoJudge。"})
    print(f"candidate={len(results)} reviewed={len(reviews)} blocked={len(blocked_reasons)}")


if __name__=="__main__":
    main()
