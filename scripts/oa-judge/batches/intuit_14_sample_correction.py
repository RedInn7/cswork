"""Recover Intuit #14 by correcting the sample's destination typo."""
from __future__ import annotations

from array import array
from collections import deque
import hashlib
import json
import math
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
PID = "oa-intuit-14"
BATCH = "intuit-14-sample-correction"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "fastprep/Intuit/intuit-jumping-kady.md"
SOURCE_BLOB = "94e21134e54780d714de7bcb2c89bc343409827b"
SOURCE_HASH = "e48395a9c525367eaabe0e60fa410d0293ad569a6a38fbfbe110ea58902b2f3d"
SEED = 20261006

REFERENCE = r'''from array import array
from collections import deque
import math
import sys

def solve(raw):
    m,n,x,p,q,u,v=map(int,raw.split())
    if not (1<=m<=1000 and 1<=n<=1000 and 1<=x<=1000 and 1<=p<=m and 1<=u<=m and 1<=q<=n and 1<=v<=n):
        raise ValueError("outside source constraints")
    sr,sc,tr,tc=p-1,q-1,u-1,v-1
    if (sr,sc)==(tr,tc): return "0"
    moves=set()
    for dr in range(x+1):
        rem=x*x-dr*dr; dc=math.isqrt(rem)
        if dc*dc==rem:
            for a in {dr,-dr}:
                for b in {dc,-dc}: moves.add((a,b))
    moves.discard((0,0))
    if not moves: return "-1"
    dist=array('i',[-1])*(m*n); start=sr*n+sc; target=tr*n+tc
    dist[start]=0; queue=array('i',[start]); head=0
    while head<len(queue):
        cur=queue[head]; head+=1; r,c=divmod(cur,n); nd=dist[cur]+1
        for dr,dc in moves:
            nr,nc=r+dr,c+dc
            if 0<=nr<m and 0<=nc<n:
                nxt=nr*n+nc
                if dist[nxt]<0:
                    if nxt==target: return str(nd)
                    dist[nxt]=nd; queue.append(nxt)
    return "-1"

if __name__=="__main__": print(solve(sys.stdin.read()))
'''


def enc(v: tuple[int, ...]) -> str:
    return " ".join(map(str, v)) + "\n"


def oracle(v: tuple[int, ...]) -> str:
    """BFS oracle derives neighbors by scanning rows, not from the solution's move set."""
    m,n,x,p,q,u,vv=v
    src=(p-1,q-1); dst=(u-1,vv-1)
    if src==dst: return "0"
    d={src:0}; todo=deque([src]); x2=x*x
    while todo:
        r,c=todo.popleft(); nd=d[(r,c)]+1
        for nr in range(max(0,r-x),min(m,r+x+1)):
            rem=x2-(nr-r)**2
            if rem<0: continue
            dc=math.isqrt(rem)
            if dc*dc!=rem: continue
            for nc in {c+dc,c-dc}:
                nxt=(nr,nc)
                if not 0<=nc<n or nxt in d: continue
                if nxt==dst: return str(nd)
                d[nxt]=nd; todo.append(nxt)
    return "-1"


def run(code: str, raw: str) -> str:
    p=subprocess.run([sys.executable,"-I","-c",code],input=raw,text=True,capture_output=True,timeout=8,check=True)
    return p.stdout.strip()


def put(folder: str, name: str, obj: object) -> None:
    path=OUT/folder/name; path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def sha(data: bytes) -> str: return hashlib.sha256(data).hexdigest()


def main() -> None:
    catalog=json.loads((ROOT/"content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source=next(x for x in catalog["items"] if x["id"]==PID)
    assert source["contentHash"]==SOURCE_HASH and "exactly `X` units each time" in source["statement"]
    upstream=Path("/private/tmp/oa-master-readonly")
    raw=subprocess.run(["git","show",f"{COMMIT}:{SOURCE_PATH}"],cwd=upstream,text=True,capture_output=True,check=True).stdout
    blob=subprocess.run(["git","rev-parse",f"{COMMIT}:{SOURCE_PATH}"],cwd=upstream,text=True,capture_output=True,check=True).stdout.strip()
    assert blob==SOURCE_BLOB and "From (6,2) he can go to (2,5)" in raw and "u = 6\nv = 2" in raw

    # The prose narrates a two-edge route ending at (2,5); input instead names
    # its intermediate point (6,2). Preserve that route and correct only u,v.
    sample=(6,5,5,1,2,2,5)
    assert oracle(sample)=="2" and oracle((6,5,5,1,2,6,2))=="1"
    public=[sample,(2,2,1,1,1,2,2),(6,5,5,1,2,1,2)]
    rng=random.Random(SEED)
    hidden=[]
    while len(hidden)<20:
        m,n,x=rng.randint(1,14),rng.randint(1,14),rng.randint(1,12)
        case=(m,n,x,rng.randint(1,m),rng.randint(1,n),rng.randint(1,m),rng.randint(1,n))
        if case not in public and case not in hidden: hidden.append(case)
    hidden.extend([(1,1,1000,1,1,1,1),(1000,1000,1000,1,1,1,1)])
    cases=[]; oracle_rows=[]
    for i,case in enumerate(public+hidden):
        expected=oracle(case); actual=run(REFERENCE,enc(case)); assert expected==actual,(case,expected,actual)
        row={"input":enc(case),"expectedOutput":expected+"\n"}; oracle_rows.append(row)
        cases.append({"name":f"公开样例 {i+1}" if i<3 else f"隐藏测试 {i-2}",**row,"hidden":i>=3,"weight":1})
    known={row["input"] for row in oracle_rows}
    while len(known)<120:
        m,n,x=rng.randint(1,18),rng.randint(1,18),rng.randint(1,20)
        case=(m,n,x,rng.randint(1,m),rng.randint(1,n),rng.randint(1,m),rng.randint(1,n))
        raw_input=enc(case)
        if raw_input in known: continue
        expected=oracle(case); assert run(REFERENCE,raw_input)==expected
        oracle_rows.append({"input":raw_input,"expectedOutput":expected+"\n"}); known.add(raw_input)

    mutants=[
        {"name":"把恰好 X 放宽为不超过 X","code":REFERENCE.replace("if dc*dc==rem:","if dc*dc<=rem:")},
        {"name":"只允许水平或竖直跳跃","code":REFERENCE.replace("for a in {dr,-dr}:\n                for b in {dc,-dc}: moves.add((a,b))","if dr==0 or dc==0:\n                for a in {dr,-dr}:\n                    for b in {dc,-dc}: moves.add((a,b))")},
    ]
    killed=[]
    for mutant in mutants:
        rejected=[i for i,c in enumerate(cases) if run(mutant["code"],c["input"])!=c["expectedOutput"].strip()]
        assert rejected,mutant["name"]; killed.append({"name":mutant["name"],"rejectedByCases":rejected})

    problem={"id":PID,"courseId":"gomall","lessonId":"00-overview","title":"固定距离跳跃最少步数（Intuit OA）","difficulty":"中等","tags":["OA","Intuit","BFS","图论"],
      "description":"在 m×n 方格中，每次必须跳恰好 X 个单位（欧氏距离），求从起点到终点的最少跳数，不可跳出棋盘；无法到达返回 -1。固定来源样例解释描述终点为 (2,5)，而输入误填为中间点 (6,2)，故将样例 u,v 更正为 2,5。",
      "input":"一行七个整数 m n X p q u v，分别为棋盘行数、列数、跳跃距离、起点与目标坐标。范围遵循来源约束。","output":"输出最少跳数；不可达输出 -1。","explanation":"预计算满足 dr²+dc²=X² 的整数位移，在棋盘格上运行 BFS。","hints":["欧氏距离必须恰好为 X。","将格子视为节点，合法跳跃视为无权边。"],"timeLimit":5,"memoryLimit":262144,"outputLimit":4096,"checker":"tokens","languages":["python","go","java","cpp"]}
    editorial="""## 思路与样例勘误

合法跳跃对应整数位移 `(dr,dc)`，满足 `dr²+dc²=X²`。把棋盘格视为节点、这些位移视为无权边，从起点 BFS；首次到达终点即为最少步数，遍历完仍未到达则返回 -1。

固定来源的跳跃规则明确要求距离恰好为 X。原样例把目标填为 `(6,2)`，它与 `(1,2)` 的距离是 5，按规则一步即达；但来源解释明确写出路线 `(1,2)→(6,2)→(2,5)` 并称需要 2 步，所以说明中的最终目标是 `(2,5)`，样例输入误把中间点填成了终点。将 `u,v` 从 `6,2` 改为 `2,5` 后，解释中的两步均长为 5，且起终点距离为 √10，不可能一步到达。只修正样例坐标，不改题意与答案。

## 正确性

算法只添加满足平方和等式且不越界的边，因而每条图路径都是合法跳跃路径。反过来，所有合法跳跃都对应枚举出的整数位移，所以原问题的每条路线都在图中。无权图 BFS 首次访问目标的距离是最少边数；未访问表示不可达。

## 复杂度

设 V=mn，D 为整数位移数。扫描平方差预计算耗时 O(X)，BFS 时间 O(VD)，空间 O(V+D)。采用来源约束 m,n,X≤1000。"""
    normalized_script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    parsed=subprocess.run(["node","--import","tsx","-e",normalized_script],cwd=ROOT,input=json.dumps({"schemaVersion":1,"problem":problem,"cases":cases},ensure_ascii=False),text=True,capture_output=True)
    if parsed.returncode: raise RuntimeError(parsed.stderr)
    package=json.loads(parsed.stdout); checksum=sha(parsed.stdout.encode())
    editorial_doc={"schemaVersion":1,"id":PID,"title":problem["title"],"explanation":editorial,"solutions":[{"language":"python","code":REFERENCE}],"sourceUrl":source["sourceUrl"],"sourceContentHash":SOURCE_HASH}
    manifest={"schemaVersion":1,"items":[{"id":PID,"sourceContentHash":SOURCE_HASH,"packageChecksum":checksum,"editorial":editorial,"authoredSolutions":[{"language":"python","code":REFERENCE}]}]}
    validation={"schemaVersion":1,"seed":SEED,"problems":[{"id":PID,"oracleCases":len(oracle_rows),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":killed,"referenceSha256":sha(REFERENCE.encode())}],"note":"Independent coordinate-scan BFS oracle; not tested against GoJudge."}
    evidence={"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":COMMIT,"sourceFile":{"path":SOURCE_PATH,"gitBlobSha":SOURCE_BLOB},"catalogContentHash":SOURCE_HASH,"sampleCorrection":{"sourceTarget":[6,2],"correctedTarget":[2,5],"basis":"Immutable source explanation explicitly states the two-jump route ends at (2,5)."}}
    prior=next(row for file in sorted((OUT/"reviews").glob("*.json")) for row in json.loads(file.read_text(encoding="utf-8"))["items"] if row["id"]==PID)
    resolution={"schemaVersion":1,"items":[{"id":PID,"batch":BATCH,"sourceContentHash":SOURCE_HASH,"previousReason":prior["reason"],"reason":"固定源明确规定每步欧氏距离恰为 X；样例说明的两步路线终点为 (2,5)，但输入将中间点 (6,2) 误填为目标。更正坐标后，独立坐标扫描 BFS 确认最短距离为2；保留原题规则和输出。"}]}
    for folder,obj in (("packages",package),("editorials",editorial_doc),("oracles",oracle_rows),("mutants",mutants),("source-evidence",evidence)):
        put(folder,f"{PID}.json",obj)
    put("validation",f"{BATCH}.json",validation); put("candidate-batches",f"{BATCH}.json",manifest); put("resolutions",f"{BATCH}.json",resolution)
    (OUT/"references"/f"{PID}.py").write_text(REFERENCE,encoding="utf-8")
    for i,mutant in enumerate(mutants,1): (OUT/"negative-controls"/f"{PID}-{i}.py").write_text(mutant["code"]+"\n",encoding="utf-8")
    print(f"{PID}: {len(oracle_rows)} oracle inputs; {len(cases)} formal cases; 2 mutants rejected")


if __name__=="__main__": main()
