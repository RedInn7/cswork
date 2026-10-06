#!/usr/bin/env python3
"""Build and locally verify the Amazon #32 Domino Removal candidate only."""
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
IDENT = "oa-amazon-32"
BATCH = "amazon-32-recovered"
SEED = 20261006
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SOURCE_PATH = "web/content/docs/companies/amazon.mdx"
SOURCE_URL = "https://oamaster.com/docs/companies/amazon#32-domino-removal-problem"
SOURCE_BLOB = "70650fad830ad60944ae8036fb4f134d9afc3fab"
SOURCE_FILE_SHA256 = "07d33d58794347890f76b4199a9805d5fac529f0702dea6884e6fce484b69985"
SOURCE_HASH = "d57f3152741908c6689196515009b51d5b71a6e52f3add83f0af0573c1328a9e"
OLD_REASON = "没有约定初始最长严格递增子序列不足min_order时的返回值；约束允许此情况，例如[2,1],min_order=2，无合法k。"

REFERENCE = '''import sys
from bisect import bisect_left

def solve(raw):
    data = list(map(int, raw.split()))
    n, min_order = data[0], data[1]
    domino = data[2:2+n]
    remove = data[2+n:2+2*n]

    def lis_after(k):
        alive = bytearray([1]) * n
        for i in range(k):
            alive[remove[i]] = 0
        tails = []
        for i, value in enumerate(domino):
            if alive[i]:
                pos = bisect_left(tails, value)
                if pos == len(tails):
                    tails.append(value)
                else:
                    tails[pos] = value
        return len(tails)

    low, high, answer = 0, n, -1
    while low <= high:
        mid = (low + high) // 2
        if lis_after(mid) >= min_order:
            answer = mid
            low = mid + 1
        else:
            high = mid - 1
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read().decode()))
'''

def encode(domino, remove, min_order):
    return "\n".join([
        f"{len(domino)} {min_order}",
        " ".join(map(str, domino)),
        " ".join(map(str, remove)),
    ]) + "\n"

def exhaustive_oracle(domino, remove, min_order):
    """Enumerate subsequences for every removal prefix; small-input oracle."""
    n = len(domino)
    active = (1 << n) - 1
    removed = [0] * (n + 1)
    for k in range(n + 1):
        if k:
            active &= ~(1 << remove[k - 1])
        found = False
        subset = active
        while subset:
            if subset.bit_count() >= min_order:
                indexes = [i for i in range(n) if subset & (1 << i)]
                if all(domino[indexes[j-1]] < domino[indexes[j]]
                       for j in range(1, len(indexes))):
                    found = True
                    break
            subset = (subset - 1) & active
        if found:
            removed[k] = 1
    answer = max((k for k, ok in enumerate(removed) if ok), default=-1)
    return str(answer)

def run(path, raw, timeout=10):
    start = time.perf_counter()
    proc = subprocess.run([sys.executable, "-I", str(path)], input=raw,
        text=True, capture_output=True, timeout=timeout, check=True)
    return proc.stdout.rstrip("\n"), time.perf_counter() - start

def normalize(package):
    js = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
      "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
      "process.stdin.on('end',()=>process.stdout.write(JSON.stringify("
      "ojImportSchema.parse(JSON.parse(s)))));")
    proc = subprocess.run(["node", "--import", "tsx", "-e", js], cwd=ROOT,
        input=json.dumps(package, ensure_ascii=False), text=True,
        capture_output=True, check=True)
    return json.loads(proc.stdout)

def main():
    for folder in ("packages", "references", "oracles", "mutants",
        "editorials", "source-evidence", "resolutions", "validation",
        "candidate-batches", "negative-controls"):
        (OA/folder).mkdir(parents=True, exist_ok=True)
    refpath = OA/"references"/f"{IDENT}.py"
    refpath.write_text(REFERENCE, encoding="utf-8")

    public = [
      ("OAMaster 样例", [1,4,4,2,5,3], [2,1,4,0,5,3], 3, "3"),
      ("本站样例：删除中间值后仍保留严格 LIS", [1,2,3], [1,0,2], 2, "1"),
      ("本站样例：初始 LIS 已不足门槛，按本站协议输出 -1",
       [2,1], [0,1], 2, "-1"),
    ]
    directed = [
      ("重复值不能组成严格递增长度", [3,3,3], [1,0,2], 2, "-1"),
      ("重复值与不同值", [1,1,2], [0,2,1], 2, "1"),
      ("门槛为1时不能删除唯一递增元素", [5], [0], 1, "0"),
      ("门槛等于n且原数组严格递增", [1,2,3,4], [3,2,1,0], 4, "0"),
      ("移除顺序决定存活集合", [1,2,4,3,5], [2,0,4,1,3], 3, "2"),
    ]
    rng = random.Random(SEED)
    random_cases = []
    seen = {encode(a,b,c) for _,a,b,c,_ in public}
    while len(random_cases) < 120:
        n = rng.randint(1,10)
        domino = [rng.randint(1,8) for _ in range(n)]
        remove = list(range(n))
        rng.shuffle(remove)
        min_order = rng.randint(1,n)
        raw = encode(domino,remove,min_order)
        if raw in seen:
            continue
        seen.add(raw)
        random_cases.append((domino,remove,min_order,
                             exhaustive_oracle(domino,remove,min_order)))

    oracle_specs = [(name,a,b,k,want) for name,a,b,k,want in public]
    oracle_specs += [(f"随机穷举对拍 {i+1}",*case)
                     for i,case in enumerate(random_cases)]
    oracle=[]
    for name,domino,remove,min_order,want in oracle_specs:
        raw=encode(domino,remove,min_order)
        actual,_=run(refpath,raw)
        assert actual==want,(name,want,actual)
        oracle.append({"input":raw,"expectedOutput":want+"\n"})
    assert len(oracle)==len(seen)==123

    specs=[(name,a,b,k,want) for name,a,b,k,want in public]
    specs+=directed
    specs += [(f"随机正式用例 {i+1}",*case)
              for i,case in enumerate(random_cases[:24])]
    formal=[]
    public_names={x[0] for x in public}
    for name,domino,remove,min_order,want in specs:
        raw=encode(domino,remove,min_order)
        if name != "最大 n=100000 严格递增压力":
            assert exhaustive_oracle(domino,remove,min_order)==want, (name,want)
        actual,_=run(refpath,raw)
        assert actual==want,(name,want,actual)
        formal.append({"name":name,"input":raw,"expectedOutput":want+"\n",
          "hidden":name not in public_names,"weight":1})

    # Maximum n: all values are strictly increasing, so every surviving
    # subsequence is increasing and the answer is n-min_order, independent
    # of the removal permutation.
    n=100_000
    domino=list(range(1,n+1))
    remove=list(reversed(range(n)))
    min_order=50_000
    stress_input=encode(domino,remove,min_order)
    t0=time.perf_counter()
    stress_got,reference_seconds=run(refpath,stress_input,timeout=30)
    stress_seconds=time.perf_counter()-t0
    assert stress_got==str(n-min_order),stress_got
    formal.append({"name":"最大 n=100000 严格递增压力",
      "input":stress_input,"expectedOutput":f"{n-min_order}\n",
      "hidden":True,"weight":1})

    mutant_a=REFERENCE.replace("from bisect import bisect_left",
      "from bisect import bisect_left, bisect_right").replace(
      "pos = bisect_left(tails, value)","pos = bisect_right(tails, value)")
    mutant_b=REFERENCE.replace("alive[remove[i]] = 0",
      "alive[remove[i] - 1] = 0")
    mutants=[]
    for i,(name,code) in enumerate([
      ("把严格递增误作非递减 LIS",mutant_a),
      ("把0-based remove 下标误作1-based",mutant_b)],1):
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
      "title":"Domino Removal Problem","difficulty":"中等",
      "tags":["OA","Amazon","LIS","二分答案"],
      "description":"给定多米诺骨牌的数值、一个0-based移除位置排列和门槛 min_order。按排列顺序依次移除前 k 张，剩余骨牌保持原数组相对顺序。求最长严格递增子序列长度仍至少为 min_order 时的最大 k。若初始数组的 LIS 已低于门槛、因而连 k=0 都不满足，本站协议规定输出 -1；原题没有定义此种输入的返回值。",
      "input":"第一行 n、min_order；第二行 n 个 domino 值；第三行 n 个 remove 下标。remove 是 0..n-1 的排列。此 stdin/stdout 布局及无解输出为本站协议补充。",
      "output":"若至少有一个 k∈[0,n] 满足条件，输出最大 k；若不存在（初始 LIS < min_order），输出 -1。-1 仅为本站对原题未定义输入域的补充约定。",
      "explanation":"对 k 二分，保留 remove[k:] 指定的原数组位置，再用严格 LIS 的 patience sorting 判定。无解按本站协议输出 -1。",
      "hints":["可行性随删除数 k 单调：删得越多，剩余 LIS 不会变长。","严格递增对应 bisect_left/lower_bound，而不是 upper_bound。"],
      "timeLimit":10,"memoryLimit":262144,"outputLimit":1024,
      "checker":"tokens","languages":["python","go","java","cpp"]},"cases":formal})
    (OA/"packages"/f"{IDENT}.json").write_text(json.dumps(package,ensure_ascii=False,indent=2)+"\n")
    (OA/"oracles"/f"{IDENT}.json").write_text(json.dumps(oracle,ensure_ascii=False,indent=2)+"\n")
    (OA/"mutants"/f"{IDENT}.json").write_text(json.dumps(mutants,ensure_ascii=False,indent=2)+"\n")

    explanation="""## 思路

设 f(k) 为按 remove 顺序删除前 k 张后，剩余 dominos 的严格 LIS 长度。删去元素不会增加 LIS，所以条件 f(k)≥min_order 关于 k 单调，可以二分最大可行 k。对每个 k 以 bytearray 标记存活位置，再扫描原数组，用 patience sorting 维护严格 LIS 的 tails。

## 正确性

固定 k 时，剩余位置恰是 remove[k:] 指向的位置，扫描时维持原数组顺序；bisect_left 将相等值替换在同一 tails 长度，不会把重复值拼成严格递增子序列，因此判定值就是该剩余序列的 LIS 长度。若 k 可行，则任意更小删除数的存活集合包含当前集合，LIS 不小于当前值；若 k 不可行，则任何更大的删除数也不可能可行。因此可行 k 构成从 0 开始的前缀，二分返回其最大端点。

若 k=0 已不可行，源题所求可行集合为空，没有定义返回值。本站明确补充输出 -1；不把这一补充说成原题规则。

## 复杂度

单次检查 O(n log n)，二分 O(log n) 次，整体 O(n log²n) 时间，O(n) 空间。

## 来源与本站协议

固定 OAMaster 题面规定 remove 是 0-based 的 [0..n-1] 排列，domino 按原顺序保留，门槛针对严格 LIS。本站补充输入布局；对原题未定义的“初始 LIS 已低于门槛”情形规定输出 -1。""";
    editorial={"schemaVersion":1,"id":IDENT,"title":"Domino Removal Problem",
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
    file_sha=hashlib.sha256(source_bytes).hexdigest()
    assert blob==SOURCE_BLOB and file_sha==SOURCE_FILE_SHA256
    evidence={"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master",
      "origin":"https://oamaster.com","commit":SOURCE_COMMIT,"items":{
      IDENT:{"sourceCommit":SOURCE_COMMIT,"rawPath":SOURCE_PATH,"rawGitBlob":blob,
       "sourceFileSha256":file_sha,"catalogContentHash":SOURCE_HASH,
       "sourceUrl":SOURCE_URL,"decision":"authored",
       "reason":"固定题面的移除顺序、严格 LIS、约束和样例完整；对源题未定义的初始 LIS 不达门槛输入，本站明文约定 -1。使用子序列穷举 oracle 通过本地差分；未连接 GoJudge。"}}}
    (OA/"source-evidence"/f"{BATCH}.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n")

    review_path=next(p for p in (OA/"reviews").glob("*.json")
      if any(x["id"]==IDENT for x in json.loads(p.read_text())["items"]))
    old=next(x for x in json.loads(review_path.read_text())["items"] if x["id"]==IDENT)
    assert old["status"]=="blocked" and old["reason"]==OLD_REASON
    resolution={"schemaVersion":1,"items":[{"id":IDENT,"batch":BATCH,
      "sourceContentHash":SOURCE_HASH,"previousReason":OLD_REASON,
      "reason":"固定题面完整，本站仅补充原题未定义的无解输出：若初始 LIS < min_order 则输出 -1，并在题面标明这不是原题约定。123 个互异的子序列穷举 oracle 输入、33 个正式用例（包括重复值、初始无解、随机及 n=100000 压力）和两个正常退出错误程序均通过本地验证；仍待真实 GoJudge 沙箱验证。"}]}
    (OA/"resolutions"/f"{BATCH}.json").write_text(json.dumps(resolution,ensure_ascii=False,indent=2)+"\n")
    validation={"schemaVersion":1,"seed":SEED,
      "note":"仅本机执行二分+patience-sorting 作者参考解、子序列枚举独立 oracle、样例/边界/随机/最大约束压力及 mutants；没有连接 GoJudge。",
      "problems":[{"id":IDENT,"oracleCases":len(oracle),
       "uniqueOracleInputs":len(seen),"formalCases":len(formal),
       "publicCases":len(public),"hiddenCases":len(formal)-len(public),
       "randomOracleCases":len(random_cases),
       "stress":{"n":n,"elapsedSeconds":round(stress_seconds,3),
        "referenceSeconds":round(reference_seconds,3),
        "expected":"n-min_order，因原数组严格递增"},
       "negativeControls":[{"name":m["name"],"rejectedByCases":m["rejectedByCases"]} for m in mutants],
       "allLocalChecksPassed":True}]}
    (OA/"validation"/f"{BATCH}.json").write_text(json.dumps(validation,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"candidate":IDENT,"formalCases":len(formal),
      "oracleCases":len(oracle),"stressSeconds":round(stress_seconds,3),
      "mutantsKilled":len(mutants),"packageChecksum":checksum},ensure_ascii=False))

if __name__=="__main__":
    main()
