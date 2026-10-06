#!/usr/bin/env python3
"""Build one local-only candidate for Twilio #1. Never calls GoJudge."""
from __future__ import annotations
import hashlib
import json
import random
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
IDENT = "oa-twilio-1"
BATCH = "twilio-1-recovered"
SEED = 20261006
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/twilio.mdx"
SOURCE_URL = "https://oamaster.com/docs/companies/twilio#1-count-groups"
SOURCE_BLOB = "2854338de400f49f6d1abdaf0425109924c3036b"
SOURCE_HASH = "bb856490739e9b0be808a23d74f7030503b561a98814756002719c83b0dee6a0"
OLD_REASON = "核心目标可定义，但固定源解法对每个查询遍历全部标签，无法满足题面 n,q≤10^5；本批不发布明显超限解。"

REFERENCE = '''import sys
from math import isqrt

def solve(raw):
    data = list(map(int, raw.split()))
    n, q = data[0], data[1]
    tags = data[2:2+n]
    offset = 2+n
    queries = [(data[offset+2*i]-1, data[offset+2*i+1]-1, i) for i in range(q)]
    block = max(1, n // max(1, isqrt(q)))
    queries.sort(key=lambda x: (x[0]//block, x[1] if (x[0]//block)%2 == 0 else -x[1]))
    freq = {}
    answers = [0]*q
    groups = 0
    left, right = 0, -1
    for ql, qr, qi in queries:
        while left > ql:
            left -= 1
            v = tags[left]
            old = freq.get(v, 0)
            groups += old & 1
            freq[v] = old + 1
        while right < qr:
            right += 1
            v = tags[right]
            old = freq.get(v, 0)
            groups += old & 1
            freq[v] = old + 1
        while left < ql:
            v = tags[left]
            old = freq[v]
            groups -= (old - 1) & 1
            if old == 1:
                del freq[v]
            else:
                freq[v] = old - 1
            left += 1
        while right > qr:
            v = tags[right]
            old = freq[v]
            groups -= (old - 1) & 1
            if old == 1:
                del freq[v]
            else:
                freq[v] = old - 1
            right -= 1
        answers[qi] = groups
    return " ".join(map(str, answers))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read().decode()))
'''

def encode(tags, queries):
    return "\n".join([f"{len(tags)} {len(queries)}",
        " ".join(map(str, tags)),
        *(f"{l} {r}" for l, r in queries)]) + "\n"

def brute(tags, queries):
    out = []
    for l, r in queries:
        counts = {}
        for value in tags[l-1:r]:
            counts[value] = counts.get(value, 0) + 1
        out.append(sum(count//2 for count in counts.values()))
    return out

def run(path, raw, timeout=10):
    start = time.perf_counter()
    proc = subprocess.run([sys.executable, "-I", str(path)], input=raw,
        text=True, capture_output=True, timeout=timeout, check=True)
    return proc.stdout.rstrip("\n"), time.perf_counter()-start

def normalize(package):
    js = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
      "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
      "process.stdin.on('end',()=>process.stdout.write(JSON.stringify("
      "ojImportSchema.parse(JSON.parse(s)))));")
    result = subprocess.run(["node", "--import", "tsx", "-e", js], cwd=ROOT,
      input=json.dumps(package, ensure_ascii=False), text=True,
      capture_output=True, check=True)
    return json.loads(result.stdout)

def main():
    for folder in ("packages", "references", "oracles", "mutants", "editorials",
      "source-evidence", "resolutions", "validation", "candidate-batches",
      "negative-controls"):
        (OA/folder).mkdir(parents=True, exist_ok=True)
    refpath = OA/"references"/f"{IDENT}.py"
    refpath.write_text(REFERENCE, encoding="utf-8")

    public = [
      ("OAMaster 样例 1", [2,3,4,2], [(1,4),(3,4)], [1,0]),
      ("OAMaster 样例 2", [2,2,2,2], [(1,4)], [2]),
      ("边界：单个 cable", [10**9], [(1,1)], [0]),
    ]
    directed = [
      ("奇数频次取 floor(count/2)", [7,7,7], [(1,3)], [1]),
      ("多个标签分别配对", [1,2,1,2,1,2], [(1,6)], [2]),
      ("闭区间端点", [4,9,4,9], [(2,3),(1,3),(2,4)], [0,1,1]),
      ("查询独立且保持输入顺序", [5,5,8,8,8], [(1,2),(3,5),(1,5),(5,5)], [1,1,2,0]),
      ("不同标签不可互配", [1,2,3,4], [(1,4),(2,3)], [0,0]),
    ]
    rng = random.Random(SEED)
    random_cases = []
    seen = {encode(tags, queries) for _, tags, queries, _ in public}
    while len(random_cases) < 200:
        n = rng.randint(1,24)
        palette = [rng.randint(1,10**9) for _ in range(rng.randint(1,min(8,n)))]
        tags = [rng.choice(palette) for _ in range(n)]
        queries = []
        for _ in range(rng.randint(1,20)):
            l = rng.randint(1,n)
            queries.append((l, rng.randint(l,n)))
        raw = encode(tags, queries)
        if raw in seen:
            continue
        seen.add(raw)
        random_cases.append((tags, queries, brute(tags,queries)))

    oracle_specs = public + [(f"随机暴力对拍 {i+1}",*c) for i,c in enumerate(random_cases)]
    oracle = []
    for name,tags,queries,expected in oracle_specs:
        raw = encode(tags,queries)
        actual,_ = run(refpath,raw)
        want = " ".join(map(str,expected))
        assert actual == want, (name,want,actual)
        oracle.append({"input":raw,"expectedOutput":want+"\n"})
    assert len(oracle) == len(seen) == 203

    specs = public + directed + [(f"随机正式用例 {i+1}",*c) for i,c in enumerate(random_cases[:24])]
    formal = []
    public_names = {row[0] for row in public}
    for name,tags,queries,expected in specs:
        raw = encode(tags,queries)
        actual,_ = run(refpath,raw)
        want = " ".join(map(str,expected))
        assert actual == want, (name,want,actual)
        formal.append({"name":name,"input":raw,"expectedOutput":want+"\n",
          "hidden":name not in public_names,"weight":1})

    # Maximum n=q. Adjacent equal values form fixed pairs, independently
    # counted by the interval-overlap formula below.
    n=q=100_000
    tags=[i//2 for i in range(n)]
    queries=[]
    for i in range(q):
        l=1+(i*7919 % n)
        r=min(n,l+(i*104729 % 50000))
        queries.append((min(l,r),max(l,r)))
    raw=encode(tags,queries)
    expected=[]
    for l,r in queries:
        zl,zr=l-1,r-1
        expected.append(max(0,(zr+1)//2-(zl+1)//2))
    large_want=" ".join(map(str,expected))
    t0=time.perf_counter()
    large_got,elapsed=run(refpath,raw,timeout=30)
    stress_seconds=time.perf_counter()-t0
    assert large_got==large_want
    formal.append({"name":"最大约束 n=q=100000：重复标签及随机区间压力",
      "input":raw,"expectedOutput":large_want+"\n","hidden":True,"weight":1})

    mutant_a=REFERENCE.replace("groups += old & 1","groups += old")
    mutant_b=REFERENCE.replace('return " ".join(map(str, answers))',
      'return " ".join([str(groups)] * q)')
    mutants=[]
    for i,(name,code) in enumerate([
      ("把所有同标签组合都误算成 disjoint groups",mutant_a),
      ("忽略每个查询区间并复用最终活动窗口",mutant_b)],1):
        path=OA/"negative-controls"/f"{IDENT}-{i}.py"
        path.write_text(code,encoding="utf-8")
        rejected=[]
        for ci,case in enumerate(formal):
            proc=subprocess.run([sys.executable,"-I",str(path)],input=case["input"],
              text=True,capture_output=True,timeout=30)
            assert proc.returncode==0,(name,case["name"],proc.stderr)
            if proc.stdout.rstrip("\n")+"\n" != case["expectedOutput"]:
                rejected.append(ci)
        assert rejected,name+" survived"
        mutants.append({"name":name,"code":code,"rejectedByCases":rejected})

    catalog=json.loads((ROOT/"content/oa-master/catalog.json").read_text())
    item=next(x for x in catalog["items"] if x["id"]==IDENT)
    assert item["contentHash"]==SOURCE_HASH and item["sourceUrl"]==SOURCE_URL
    package=normalize({"schemaVersion":1,"problem":{
      "id":IDENT,"courseId":"gomall","lessonId":"00-overview",
      "title":"Count Groups","difficulty":"简单",
      "tags":["OA","Twilio","Mo 算法","区间查询"],
      "description":"给定 cable 的数值标签。每个独立查询区间内，只能把标签相同的两个 cable 配成一组，且每个 cable 至多使用一次。求该区间最多可组成多少组。题意及约束来自 OAMaster 固定题面；以下为本站标准输入输出协议。",
      "input":"第一行 n、q；第二行 n 个标签；随后 q 行各输入 l、r，表示 1-based 闭区间。查询彼此独立。",
      "output":"按输入顺序输出 q 个答案，以空格分隔。每个答案为区间中各标签出现次数除以 2 向下取整后之和。",
      "explanation":"使用 Mo 算法按区间端点移动，维护各标签频数与已组成组数。正确性证明见配套讲义。",
      "hints":["标签频次从奇数加到偶数时组数加一；从偶数删到奇数时组数减一。"],
      "timeLimit":10,"memoryLimit":262144,"outputLimit":2048,"checker":"tokens",
      "languages":["python","go","java","cpp"]},"cases":formal})
    (OA/"packages"/f"{IDENT}.json").write_text(json.dumps(package,ensure_ascii=False,indent=2)+"\n")
    (OA/"oracles"/f"{IDENT}.json").write_text(json.dumps(oracle,ensure_ascii=False,indent=2)+"\n")
    (OA/"mutants"/f"{IDENT}.json").write_text(json.dumps(mutants,ensure_ascii=False,indent=2)+"\n")

    explanation="""## 思路

区间中某个标签出现 c 次，可组成 floor(c/2) 组；总答案是各标签贡献之和。逐查询扫区间或逐题遍历所有标签都可能达到 O(nq)。使用 Mo 算法按区间排序，只在相邻查询之间移动端点。

维护 freq[v] 与 groups=Σfloor(freq[v]/2)。加入 v 时，旧频次为奇数才新增一组；删除 v 时，旧频次为偶数才减少一组。使用左右分块交错右端点顺序，降低来回移动。

## 正确性

不同标签互不影响；对标签 v，最多能取 floor(c/2) 个互不重叠的二元组。加入一个 v 的变化量 floor((c+1)/2)-floor(c/2)，仅在 c 为奇数时为 1。删除一个 v 的变化量 floor((c-1)/2)-floor(c/2)，仅在旧 c 为偶数时为 -1。因此每次端点移动后 groups 都等于当前区间答案。Mo 算法对每个查询将窗口移动至该查询区间，故所得结果正确。

## 复杂度

块长约 n/sqrt(q)。排序 O(q log q)；端点移动 O(n sqrt(q)+qn/B)，每次移动期望 O(1)，空间 O(n+q)。

## 来源与本站协议

OAMaster 固定题面给出同标签、每组两根、每根至多一组、独立区间查询及 n,q≤100000、tag≤10^9。本站用 1-based 闭区间，输入 n、q、标签数组和 q 组端点，输出 q 个答案。"""
    editorial={"schemaVersion":1,"id":IDENT,"title":"Count Groups",
      "sourceUrl":SOURCE_URL,"sourceContentHash":SOURCE_HASH,"author":"CSWork",
      "explanation":explanation}
    (OA/"editorials"/f"{IDENT}.json").write_text(json.dumps(editorial,ensure_ascii=False,indent=2)+"\n")

    checksum=hashlib.sha256(json.dumps(package,ensure_ascii=False,separators=(",",":")).encode()).hexdigest()
    entry={"id":IDENT,"sourceContentHash":SOURCE_HASH,"packageChecksum":checksum,
      "authoredSolutions":[{"language":"python","code":REFERENCE}],
      "editorial":explanation}
    (OA/"candidate-batches"/f"{BATCH}.json").write_text(json.dumps(
      {"schemaVersion":1,"items":[entry]},ensure_ascii=False,indent=2)+"\n")

    source_bytes=subprocess.run(["git","show",f"{SOURCE_COMMIT}:{SOURCE_PATH}"],
      cwd=ROOT,capture_output=True,check=True).stdout
    blob=subprocess.run(["git","hash-object","--stdin"],cwd=ROOT,input=source_bytes,
      capture_output=True,check=True).stdout.decode().strip()
    assert blob==SOURCE_BLOB
    source_sha=hashlib.sha256(source_bytes).hexdigest()
    evidence={"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master",
      "origin":"https://oamaster.com","commit":SOURCE_COMMIT,"items":{
      IDENT:{"sourceCommit":SOURCE_COMMIT,"rawPath":SOURCE_PATH,"rawGitBlob":blob,
       "sourceFileSha256":source_sha,"catalogContentHash":SOURCE_HASH,
       "sourceUrl":SOURCE_URL,"decision":"authored",
       "reason":"固定题面完整；重写 Mo 参考解，以逐查询直接计频作为独立 brute oracle；样例、随机、边界与最大规模压力在本机验证通过，未连接 GoJudge。"}}}
    (OA/"source-evidence"/f"{BATCH}.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n")

    review=next(p for p in (OA/"reviews").glob("*.json")
      if any(x["id"]==IDENT for x in json.loads(p.read_text())["items"]))
    previous=next(x for x in json.loads(review.read_text())["items"] if x["id"]==IDENT)
    assert previous["status"]=="blocked" and previous["reason"]==OLD_REASON
    resolution={"schemaVersion":1,"items":[{"id":IDENT,"batch":BATCH,
      "sourceContentHash":SOURCE_HASH,"previousReason":OLD_REASON,
      "reason":"固定题面和规模完整，原阻塞仅因参考算法效率不足。重写 Mo 解法，以逐区间直接频次数组扫描作为独立 oracle；203 个互异 oracle 输入、33 个正式用例（含 n=q=100000 压力）及两个正常退出错误程序均通过本地验证。仍待真实 GoJudge 沙箱验证。"}]}
    (OA/"resolutions"/f"{BATCH}.json").write_text(json.dumps(resolution,ensure_ascii=False,indent=2)+"\n")
    validation={"schemaVersion":1,"seed":SEED,
      "note":"仅本机参考程序、独立暴力 oracle、样例、边界、随机及最大规模压力验证；没有连接 GoJudge，不代表沙箱验收或线上发布。",
      "problems":[{"id":IDENT,"oracleCases":len(oracle),
       "uniqueOracleInputs":len(seen),"formalCases":len(formal),
       "publicCases":len(public),"hiddenCases":len(formal)-len(public),
       "randomOracleCases":len(random_cases),
       "stress":{"n":n,"q":q,"elapsedSeconds":round(stress_seconds,3),
        "answerFormula":"tags=[0,0,1,1,...] 时统计闭区间内完整相邻二元组"},
       "negativeControls":[{"name":m["name"],"rejectedByCases":m["rejectedByCases"]} for m in mutants],
       "allLocalChecksPassed":True}]}
    (OA/"validation"/f"{BATCH}.json").write_text(json.dumps(validation,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"candidate":IDENT,"formalCases":len(formal),
      "oracleCases":len(oracle),"stressSeconds":round(stress_seconds,3),
      "mutantsKilled":len(mutants),"packageChecksum":checksum},ensure_ascii=False))

if __name__=="__main__":
    main()
