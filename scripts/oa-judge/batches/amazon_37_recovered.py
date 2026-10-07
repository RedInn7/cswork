#!/usr/bin/env python3
"""Generate Amazon #37 offline candidate; never publish or update registry."""
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
PID = "oa-amazon-37"
BATCH = "amazon-37-recovered"
SEED = 20261007
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW = "fastprep/Amazon/amazon-calculate-max-quality-score.md"
RAW_BLOB = "00fdfdb91f15a1790812f0d42a81a68fd5c3f8dc"
CATALOG_PATH = "web/content/docs/companies/amazon.mdx"
CATALOG_BLOB = "70650fad830ad60944ae8036fb4f134d9afc3fab"
HASH = "f2ce6c0bbdacb1a0def8403d05e0f18c7e73877db5b3182746a462b4ee328ccc"
URL = "https://oamaster.com/docs/companies/amazon#37-calculate-max-quality-score"
PREVIOUS = "impactFactor未给范围，0会除零，负数会改变取整和操作性质；无法据现有约束确定完整输入域。"
BOUNDS = ("本站标准输入与合并范围：1≤n≤200000，1≤impactFactor≤10000，"
          "−10^9≤ratings[i]≤10^9。完整 raw 题源为 n≤200000、|ratings[i]|≤100000；"
          "catalog 为 n≤100000、|ratings[i]|≤10^9，未保留因子范围。"
          "本站取二者范围包络并采用 raw 的正整数因子范围，不声称这是原 raw 的约束。")

REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, factor = data[:2]
    ratings = data[2:]
    if not (1 <= n <= 200000 and 1 <= factor <= 10000 and len(ratings) == n):
        raise ValueError("invalid input shape or factor")
    if any(abs(x) > 1000000000 for x in ratings):
        raise ValueError("rating outside site range")
    answer = None
    for divide in (False, True):
        before = inside = after = None
        for x in ratings:
            changed = (abs(x) // factor) * (1 if x >= 0 else -1) if divide else x * factor
            new_before = x if before is None else max(x, before + x)
            new_inside = changed
            if before is not None:
                new_inside = max(new_inside, before + changed)
            if inside is not None:
                new_inside = max(new_inside, inside + changed)
            new_after = None if inside is None else inside + x
            if after is not None:
                new_after = after + x if new_after is None else max(new_after, after + x)
            before, inside, after = new_before, new_inside, new_after
            candidate = inside if after is None else max(inside, after)
            answer = candidate if answer is None else max(answer, candidate)
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

GAIN_MUTANT = '''import sys
def solve(raw):
    data = list(map(int, raw.split())); factor = data[1]; ratings = data[2:]
    def best(values):
        current = answer = values[0]
        for x in values[1:]:
            current = max(x, current + x); answer = max(answer, current)
        return answer
    base = best(ratings)
    gains = [(factor - 1) * x for x in ratings]
    divisions = [(abs(x)//factor)*(1 if x>=0 else -1)-x for x in ratings]
    return str(max(base, base + best(gains), base + best(divisions)))
if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''


def encode(values, factor):
    return f"{len(values)} {factor}\n" + " ".join(map(str, values)) + "\n"


def oracle(values, factor):
    """Enumerate the operation and every resulting nonempty subarray; no DP."""
    best = None
    n = len(values)
    for left in range(n):
        for right in range(left, n):
            for divide in (False, True):
                modified = list(values)
                for i in range(left, right + 1):
                    if divide:
                        q, remainder = divmod(values[i], factor)
                        modified[i] = q + (values[i] < 0 and remainder != 0)
                    else:
                        modified[i] = values[i] * factor
                for begin in range(n):
                    total = 0
                    for end in range(begin, n):
                        total += modified[end]
                        best = total if best is None else max(best, total)
    return best


def run(path, raw):
    proc = subprocess.run([sys.executable, "-I", str(path)], input=raw,
        text=True, capture_output=True, check=True, timeout=12)
    assert not proc.stderr, (path, proc.stderr)
    return proc.stdout.strip()


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


def put(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize(package):
    code = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify("
        "ojImportSchema.parse(JSON.parse(s)))));")
    result = subprocess.run(["node", "--import", "tsx", "-e", code], cwd=ROOT,
        input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def main():
    started = time.perf_counter()
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
    source = next(x for x in catalog["items"] if x["id"] == PID)
    assert (source["contentHash"], source["sourceUrl"]) == (HASH, URL)
    sources = []
    for path, blob in ((RAW, RAW_BLOB), (CATALOG_PATH, CATALOG_BLOB)):
        raw = subprocess.run(["git", "show", f"{COMMIT}:{path}"], cwd=ROOT,
            text=True, capture_output=True, check=True).stdout
        actual = subprocess.run(["git", "hash-object", "--stdin"], cwd=ROOT,
            input=raw, text=True, capture_output=True, check=True).stdout.strip()
        assert actual == blob
        sources.append({"path": path, "gitBlobSha": blob, "sha256": sha(raw)})
        if path == RAW:
            assert "1 <= impactFactor <= 10^4" in raw
            assert "use the ceiling value" in raw and "impactFactor = 2" in raw
        else:
            section = raw.split("## 37. Calculate Max Quality Score\n", 1)[1].split("\n## 38.", 1)[0]
            assert "impactFactor = 3" in section and "answer = 12" in section
    reviews = json.loads((OA / "reviews/amazon-remaining-b.json").read_text())
    old = next(x for x in reviews["items"] if x["id"] == PID)
    assert old["status"] == "blocked" and old["reason"] == PREVIOUS

    public = [
        ("完整 raw 原样例", [5,-3,-3,2,4], 2, 12),
        ("catalog 样例纠错：因子3应为18", [5,-3,-3,2,4], 3, 18),
        ("因子1仍恰好操作一次", [-2,3,-3,-1], 1, 3),
        ("负数朝0截断", [-5], 2, -2),
    ]
    directed = [([5,-100,5],2), ([-1],10000), ([-5],1), ([0],10000),
        ([-5,-3],2), ([1],1), ([1],10000), ([-1000000000],10000),
        ([1000000000,-1000000000,1000000000],10000),
        ([1000000000,1000000000],10000), ([5,-2,5],3), ([5,-1,0,5],2),
        ([0,0,0],3), ([-4,-3,-2],3), ([-9,8,-7,6],1), ([4,-5,5,-7,1],2),
        ([3,0,3],10000), ([0,-1,0],10000), ([-100,5,-100],7),
        ([5,-1,-1,5],2), ([1,-9,8,-9,1],4), ([-9,-8,-7],10000)]
    rng = random.Random(SEED)
    oracle_specs = [(a,k) for _,a,k,_ in public] + directed
    keys = {encode(a,k) for a,k in oracle_specs}
    assert len(keys) == len(oracle_specs)
    while len(oracle_specs) < 163:
        a = [rng.randint(-20,20) for _ in range(rng.randint(1,8))]
        k = rng.choice([1,2,3,4,7,10000])
        raw = encode(a,k)
        if raw not in keys:
            keys.add(raw); oracle_specs.append((a,k))
    reference = OA / f"references/{PID}.py"
    reference.parent.mkdir(parents=True, exist_ok=True)
    reference.write_text(REFERENCE, encoding="utf-8")
    oracle_rows = []
    for a,k in oracle_specs:
        raw = encode(a,k); expected = oracle(a,k)
        assert run(reference, raw) == str(expected), (a,k,expected)
        oracle_rows.append({"input": raw, "expectedOutput": f"{expected}\n"})
    assert len(oracle_rows) == len(keys) == 163
    print(f"{PID}: 163 unique brute oracle subprocess checks passed", flush=True)
    cases = []
    for index, row in enumerate(oracle_rows[:34]):
        name = public[index][0] if index < len(public) else f"边界与独立组合 {index-len(public)+1}"
        if index < len(public):
            assert int(row["expectedOutput"]) == public[index][3]
        cases.append({"name": name, **row, "hidden": index >= len(public), "weight": 1})
    for name,a,k,expected in [
        ("合并包络20万元素：2e18", [10**9]*200000,10000,2*10**18),
        ("20万元素全负", [-10**9]*200000,10000,-100000),
        ("raw原上界20万元素", [10**5]*200000,10000,2*10**14),
        ("20万元素因子1", [10**9]*200000,1,2*10**14),
    ]:
        raw = encode(a,k)
        cases.append({"name": name,"input":raw,"expectedOutput":f"{expected}\n","hidden":True,"weight":1})
    formal_inputs = {row["input"] for row in cases}
    assert len(formal_inputs) == len(cases)
    for row in cases:
        assert run(reference,row["input"]) == row["expectedOutput"].strip(), row["name"]
    mutants = [
        {"name":"原最大和与独立增益区间错误相加", "code":GAIN_MUTANT},
        {"name":"负数除法错误向下取整", "code":REFERENCE.replace(
            "(abs(x) // factor) * (1 if x >= 0 else -1)", "x // factor")},
    ]
    killed = []
    for index, mutant in enumerate(mutants, 1):
        path = OA / f"negative-controls/{PID}-{index}.py"
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(mutant["code"], encoding="utf-8")
        rejected = []
        for i,row in enumerate(cases):
            if run(path,row["input"]) != row["expectedOutput"].strip():
                rejected.append(i)
        assert rejected, mutant["name"]
        killed.append({"name":mutant["name"],"rejectedByCases":rejected,"normalExitVerified":True})
    print(f"{PID}: {len(cases)} formal subprocess checks; 2 normal-exit mutants killed", flush=True)
    editorial = (
        "## 思路\n\n对乘法和除法分别扫描，维护以当前位置结尾的非空计分区间："
        "B尚未修改、M正在修改、A已经结束修改。当前原值x、变换值t，使用旧状态同时计算："
        "`B'=max(x,B+x)`，`M'=max(t,B+t,M+t)`，`A'=max(M+x,A+x)`。"
        "不可达状态不参加转移；答案只取每个位置的M/A，再取两策略较大者。"
        "负数除法用 `-(abs(x)//factor)`，不能直接用Python的负数整除。\n\n"
        "## 正确性\n\n三状态顺序只允许未改、改一次非空区间、改后延续，覆盖所有"
        "计分区间与修改区间相交的方案。交叠区间之外的修改可删去而不影响计分。"
        "若最优计分区间与修改区间不相交，则计分区间含非负值时可改为乘其中一个非负值；"
        "若全负则可除其中一个负值。因factor≥1，两者都不会降低得分。"
        "故在同时允许乘/除的本题，相交方案中必有最优；不能声称固定某一策略也总成立。"
        "转移逐项枚举开始计分、开始修改、延续修改及结束修改，因此不漏解且无非法二次修改。"
        "不允许空子数组，全负且factor=1也必须返回负数。\n\n"
        "## 复杂度\n\n两次扫描O(n)时间、O(1)额外DP空间；程序保存输入需O(n)空间。"
        "结果最大2×10^18，Java/C++/Go须使用有符号64位且在相乘前提升类型。\n\n"
        "## 来源纠错与独立验证\n\n完整raw中factor=2，数组[5,-3,-3,2,4]答案12；"
        "catalog将factor改成3仍写12，是可直接复算的错误：乘最后2、4得到6、12，答案18。"
        "不能把原最大子数组和与任意独立增益相加，如[5,-100,5],factor=2真实10而该错法得到55。"
        "本站仅根据固定题面独立编写算法，未运行上游代码。"
        "163组唯一oracle枚举所有非空修改区间、两策略，再枚举结果的所有非空子数组；"
        "没有复用DP或Kadane。大边界采用同号数组直接公式，2个错误程序均正常退出且被正式用例否决。\n\n"
        + BOUNDS
    )
    package = normalize({"schemaVersion":1,"problem":{
        "id":PID,"courseId":"gomall","lessonId":"00-overview",
        "title":"恰改一个连续区间后的最大质量分（合并范围）","difficulty":"中等",
        "tags":["OA","Amazon","动态规划","最大子数组"],
        "description":"给定整数数组ratings和正整数impactFactor。必须恰好选择一次非空连续区间，"
            "将其中所有元素乘impactFactor，或全部除以impactFactor并朝0取整（正数向下、负数向上）。"
            "两种策略只选一种。操作后在整个数组中选非空连续子数组，以其元素和作为质量分。"
            "求能达到的最大质量分。修改区间和最终计分区间不要求相同。\n\n"+BOUNDS,
        "input":"第一行n impactFactor；第二行n个整数ratings[i]。\n\n"+BOUNDS,
        "output":"输出一个整数，表示恰好操作一次后的最大非空连续子数组和。",
        "explanation":"样例1乘最后两项得4、8，答案12。样例2同数组因子3，乘最后两项得6、12，"
            "答案18，纠正catalog原误写的12。样例3因子1不改变数组，答案3。样例4把−5除2朝0得−2。",
        "hints":["分别处理乘、除策略。","维护尚未修改、正在修改、已经修改结束三状态。",
            "负数必须朝0取整；不要独立相加两个不兼容区间的最优和。"],
        "timeLimit":4,"memoryLimit":262144,"outputLimit":4096,"checker":"tokens",
        "languages":["python","go","java","cpp"]},"cases":cases})
    authored = [{"language":"python","code":REFERENCE}]
    put(OA/f"packages/{PID}.json",package)
    put(OA/f"oracles/{PID}.json",oracle_rows)
    put(OA/f"mutants/{PID}.json",mutants)
    put(OA/f"editorials/{PID}.json",{"schemaVersion":1,"id":PID,
        "title":"一次区间变换的三阶段最大子数组DP","explanation":editorial,"solutions":authored})
    put(OA/f"candidate-batches/{BATCH}.json",{"schemaVersion":1,"items":[{
        "id":PID,"sourceContentHash":HASH,"packageChecksum":sha(json.dumps(package,ensure_ascii=False,separators=(",",":"))),
        "editorial":editorial,"authoredSolutions":authored}]})
    put(OA/f"source-evidence/{BATCH}.json",{"schemaVersion":1,
        "upstreamRepository":"https://github.com/RedInn7/OA-Master","upstreamCommit":COMMIT,
        "origin":"https://oamaster.com","items":{PID:{"url":URL,"contentHash":HASH,
        "catalogContentHash":HASH,"company":"Amazon","title":source["title"],
        "path":RAW,"gitBlobSha":RAW_BLOB,"sources":sources,
        "blobVerification":"git show immutable commit and git hash-object verified both exact source blobs",
        "recoveredRule":"Exactly one nonempty contiguous multiply or divide operation; division truncates toward zero; k is an integer in 1..10000.",
        "rawBounds":"n<=200000; |rating|<=100000; 1<=factor<=10000",
        "catalogBounds":"n<=100000; |rating|<=1000000000; factor bounds omitted",
        "siteAdded":BOUNDS,"sampleCorrection":{"rawFactor":2,"rawAnswer":12,
        "catalogFactor":3,"catalogPrintedAnswer":12,"correctAnswer":18},
        "relationshipToAmazon103":"Same complete raw statement; this candidate preserves Amazon37 catalog identity and explicitly tests the combined numeric envelope."}}})
    put(OA/f"resolutions/{BATCH}.json",{"schemaVersion":1,"items":[{
        "id":PID,"batch":BATCH,"sourceContentHash":HASH,"previousReason":PREVIOUS,
        "reason":"固定完整raw补全正整数factor范围1..10000，除法朝0。本站明确合并两来源数值范围，"
            "公开纠正catalog因子3样例为18。163唯一独立暴力和38正式用例真实子进程通过，"
            "两正常退出mutant被拒绝；仅离线候选，尚未做真实沙箱验证。"}]})
    put(OA/f"validation/{BATCH}.json",{"schemaVersion":1,"seed":SEED,"problems":[{
        "id":PID,"oracleCases":len(oracle_rows),"uniqueOracleInputs":len(keys),
        "referenceFormalCases":len(cases),"publicCases":4,"hiddenCases":len(cases)-4,
        "negativeControls":killed,"referenceSha256":sha(REFERENCE),
        "oracleMethod":"Enumerate every nonempty modification interval, both strategies, and every resulting nonempty scoring subarray; no Kadane or DP",
        "largeBoundaryMethod":"constant positive arrays give n*value*factor; constant negative array optimum truncates one element toward zero",
        "siteAddedBounds":{"nMax":200000,"factorMax":10000,"absoluteRatingMax":1000000000},
        "maxFormalAnswer":2*10**18,"localValidationOnly":True,
        "subprocessValidation":True,"normalExitChecked":True,
        "elapsedSeconds":round(time.perf_counter()-started,3)}]})
    print(f"{PID}: generated candidate only; registry/reports untouched",flush=True)


if __name__ == "__main__":
    main()
