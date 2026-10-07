#!/usr/bin/env python3
"""Source-corrected Amazon 23 offline candidate; never publish or aggregate."""
from functools import lru_cache
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content/oa-judge"
PID = "oa-amazon-23"
BATCH = "amazon-23-recovered"
SEED = 20261007
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "fastprep/Amazon/amazon-get-max-charge.md"
RAW_BLOB = "1a722282f962cf3275dfc970c666308fb56ce2ec"
MDX_PATH = "web/content/docs/companies/amazon.mdx"
MDX_BLOB = "70650fad830ad60944ae8036fb4f134d9afc3fab"
CONTENT_HASH = "7cf4d87c2247894ae7a1b224a989cf1488f54d0efd9a0bf741574f794e43bc23"
URL = "https://oamaster.com/docs/companies/amazon#23-get-maximum-charge"
PREVIOUS = "任意丢弃内部元素与必须连续子数组相矛盾；样例[-2,4,3,-2,1] 的最大连续和7、任意保留正数和8均非给定9。"

REFERENCE = '''import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    n = next(tokens)
    even = odd = 0
    largest = -1000000001
    for index in range(n):
        value = next(tokens)
        largest = max(largest, value)
        if value > 0:
            if index % 2:
                odd += value
            else:
                even += value
    return str(max(even, odd) if max(even, odd) > 0 else largest)

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read()))
'''

MUTANTS = [
    {"name":"误把删除合并当作最大连续子数组", "code":'''import sys
a=list(map(int,sys.stdin.buffer.read().split()))[1:]
best=current=a[0]
for value in a[1:]:
    current=max(value,current+value)
    best=max(best,current)
print(best)
'''},
    {"name":"忽略奇偶不可混合而累加全部正值", "code":'''import sys
a=list(map(int,sys.stdin.buffer.read().split()))[1:]
positive=sum(value for value in a if value>0)
print(positive if positive>0 else max(a))
'''},
]

EDITORIAL = '''## 来源更正

固定提交 e66f809f4c953bce129f68491726176615db6afc 的 fastprep/Amazon/amazon-get-max-charge.md 明确规定：删除选中系统，若它同时有左右邻居，两个邻居自动合并，其电荷为两邻居的和；被删除元素自身的值不计入。端点只删除。本站据此纠正早期 catalog 的“把自己加给邻居”“任意删除内部元素”和“最大连续子数组”等不一致描述。

主 raw 的三个样例输出依次为4、9、3；首例[-2,4,3,-2,1]在catalog中误写9，本站公开更正为4。主raw只说最大可获得电荷，同提交 amazon-maximum-charge-after-removal.md 明确持续到仅剩一个系统；二者最优值等价，因为任意中间系统都可通过不断删除两端的其他系统最终单独保留。本站不复用其他raw变体中的错误操作解释，不执行来源题解代码。

完整保留来源范围1≤n≤200000、−10^9≤charge[i]≤10^9；标准输入输出协议为本站补充。最后必须剩一个系统，不能把全负数组的答案写成空集合的0。

## 算法

分别累加原数组0-based偶数下标、奇数下标的全部正值。若存在正数，答案为两者较大值；否则答案为原数组最大元素（可能是0或负数）。

## 正确性

给原始下标按奇偶着两种颜色。始终有两个不变量：每个当前系统由同一颜色的一组原值相加而成；当前系统的颜色交替。初始显然成立；删除端点保持交替；删除内部系统时，它左右邻居同色，合并后仍保持两个不变量。因此最终系统只能由原数组某一种奇偶类的非空子集组成。有正数时，其和不超过该类全部正数之和；没有正数时，任何非空子集和都不超过全局最大元素。

为了达到正数上界，选择正数和较大的奇偶类。先不断删除端点，去掉该类首个正值之前与末个正值之后的元素。然后逐个删除该类内部的非正系统，这些删除只会合并另一类邻居，不会损伤目标正值。此时目标正值之间各隔一个另一类系统，依次删除这些间隔系统，所有目标正值便合并为它们的和。若没有正值，通过删两端保留一个最大元素即可。上界均可达到，算法正确。

## 复杂度与整数范围

O(n)时间、O(1)额外计算空间；参考程序的输入分词仍需O(n)空间。最大结果为100000×10^9=10^14，Java/C++/Go应使用64位整数。n=1时不需要操作。

## 合法样例过程与独立验证

首例先删左端−2得到[4,3,−2,1]，再连续删右端1、−2、3，留下4。第二例不断删两端直到保留9；第三例删除左端−1、右端2，留下3。展示真正合并的补充例子：[4,−100,5]删除中间−100，两个邻居合并为9；这也说明不是Kadane问题。

独立oracle逐状态枚举每一个可删除位置：端点直接删去；内部删除自身并以左右邻居之和替换这三个系统，递归直到长度1，取所有操作序列的最大结果。不使用奇偶公式。163组唯一小输入与参考程序逐一通过真实Python子进程对拍；完整规模用例用可直接证明的同号/交替结构计算期望值。两种错误程序均正常退出，并被正式用例拒绝。
'''


def encode(values):
    return str(len(values)) + "\n" + " ".join(map(str, values)) + "\n"


@lru_cache(None)
def literal_oracle(state):
    """Enumerate every legal current deletion and recursively maximize terminal charge."""
    if len(state) == 1:
        return state[0]
    following = [state[1:], state[:-1]]
    for i in range(1, len(state)-1):
        following.append(state[:i-1] + (state[i-1] + state[i+1],) + state[i+2:])
    return max(literal_oracle(next_state) for next_state in following)


def run(path, raw):
    result = subprocess.run([sys.executable,"-I",str(path)],input=raw,text=True,
        capture_output=True,check=True,timeout=12)
    assert not result.stderr, result.stderr
    return result.stdout.strip()


def sha(raw):
    return hashlib.sha256(raw.encode() if isinstance(raw,str) else raw).hexdigest()


def put(folder, name, obj):
    path = OA / folder / name
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def main():
    started = time.perf_counter()
    catalog = json.loads((ROOT/"content/oa-master/catalog.json").read_text())
    source = next(row for row in catalog["items"] if row["id"] == PID)
    assert source["contentHash"] == CONTENT_HASH and source["sourceUrl"] == URL
    prior = json.loads((OA/"reviews/amazon-remaining-a.json").read_text())
    old = next(row for row in prior["items"] if row["id"] == PID)
    assert old["status"] == "blocked" and old["reason"] == PREVIOUS
    sources=[]
    for path,blob in [(RAW_PATH,RAW_BLOB),(MDX_PATH,MDX_BLOB)]:
        raw=subprocess.check_output(["git","show",f"{COMMIT}:{path}"],cwd=ROOT)
        actual=subprocess.check_output(["git","hash-object","--stdin"],input=raw,cwd=ROOT,text=False).decode().strip()
        assert actual==blob
        sources.append({"path":path,"gitBlobSha":blob,"sha256":sha(raw)})
        if path==RAW_PATH:
            text=raw.decode()
            assert "No combination will take place if the system is the leftmost or rightmost" in text
            assert "1 <= n <= 2 * 10^5" in text and "-10^9 <= charge[i] <= 10^9" in text
            assert "charge = [-2, 4, 3, -2, 1]" in text and "\n4\n" in text
        else:
            section=raw.decode().split("## 23. Get Maximum Charge\n",1)[1].split("\n## 24.",1)[0]
            assert "answer = 9" in section and "charge = [-2, 4, 3, -2, 1]" in section
    terminal_path="fastprep/Amazon/amazon-maximum-charge-after-removal.md"
    terminal_raw=subprocess.check_output(["git","show",f"{COMMIT}:{terminal_path}"],cwd=ROOT)
    assert b"until only one system remains" in terminal_raw
    terminal_blob=subprocess.check_output(["git","hash-object","--stdin"],input=terminal_raw,cwd=ROOT).decode().strip()
    sources.append({"path":terminal_path,"gitBlobSha":terminal_blob,"sha256":sha(terminal_raw),
        "supports":"Same literal deletion/neighbor merge rule; explicitly continues until one system remains."})
    public=[([-2,4,3,-2,1],4),([-2,4,9,1,-1],9),([-1,3,2],3)]
    fixed=[[4,-100,5],[-1,-2,-3],[0],[-1000000000],[1000000000],
        [0,0,0],[-3,0,-2],[1,2],[2,1],[1,2,3,4],
        [8,100,-7,100,9],[10,-2,-30,-2,20],[10,100,-1,100,-1,100,20],
        [-4,8,-4,9,-4],[5,-100,0,-100,6],[5,-100,-2,-100,6],
        [1000000000,-1000000000,1000000000],[1]*7,[-1]*8,
        [-100,4,-100,5,-100,6,-100],[1,-1,1,-1,1,-1,1]]
    oracle_specs=[a for a,_ in public]+fixed
    keys={encode(a) for a in oracle_specs}
    assert len(keys)==len(oracle_specs)
    rng=random.Random(SEED)
    while len(oracle_specs)<163:
        values=[rng.randint(-15,15) for _ in range(rng.randint(1,9))]
        text=encode(values)
        if text not in keys:
            keys.add(text);oracle_specs.append(values)
    refpath=OA/f"references/{PID}.py"
    refpath.parent.mkdir(parents=True,exist_ok=True)
    refpath.write_text(REFERENCE,encoding="utf-8")
    oracles=[]
    for i,values in enumerate(oracle_specs):
        expected=literal_oracle(tuple(values));text=encode(values)
        literal_oracle.cache_clear()
        assert run(refpath,text)==str(expected),(values,expected)
        if i<3:assert expected==public[i][1]
        oracles.append({"input":text,"expectedOutput":f"{expected}\n"})
    assert len(oracles)==len(keys)==163
    print(f"{PID}: 163 unique literal-operation oracle subprocess checks passed",flush=True)
    cases=[]
    for i,row in enumerate(oracles[:35]):
        name=["raw首例：纠正catalog的9为4","raw第二例","raw第三例"][i] if i<3 else f"独立边界与组合{i-2}"
        cases.append({"name":name,**row,"hidden":i>=3,"weight":1})
    boundaries=[("20万正上界：1e14",[10**9]*200000,10**14),
        ("20万负上界：不可空取零",[-10**9]*200000,-10**9),
        ("20万正负交替",[10**9,-10**9]*100000,10**14),
        ("最大奇数长度正上界",[10**9]*199999,10**14),
        ("20万全零",[0]*200000,0)]
    boundary_evidence=[]
    for name,values,expected in boundaries:
        text=encode(values)
        cases.append({"name":name,"input":text,"expectedOutput":f"{expected}\n","hidden":True,"weight":1})
        boundary_evidence.append({"name":name,"n":len(values),"inputBytes":len(text.encode()),"expectedOutput":str(expected)})
    assert len({row["input"] for row in cases})==len(cases)
    for row in cases:
        assert run(refpath,row["input"])==row["expectedOutput"].strip(),row["name"]
    killed=[]
    for i,mutant in enumerate(MUTANTS,1):
        path=OA/f"negative-controls/{PID}-{i}.py"
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(mutant["code"],encoding="utf-8")
        rejected=[]
        for j,row in enumerate(cases):
            if run(path,row["input"])!=row["expectedOutput"].strip():rejected.append(j)
        assert rejected,mutant["name"]
        killed.append({"name":mutant["name"],"rejectedByCases":rejected,"normalExitVerified":True})
    print(f"{PID}: {len(cases)} formal subprocess cases; 2 normal-exit mutants rejected",flush=True)
    package={"schemaVersion":1,"problem":{
        "id":PID,"courseId":"gomall","lessonId":"00-overview","title":"删除系统并合并两邻居的最大电荷",
        "difficulty":"中等","tags":["OA","Amazon","贪心","奇偶性"],
        "description":"给定非空整数数组charge。重复选择并删除一个当前系统：如果它同时有左右邻居，"
            "这两个邻居自动合并为一个系统，其值为两邻居的和；被删除系统的值直接丢弃。"
            "如果删除当前最左或最右系统，只删除它，不合并。操作持续到仅剩一个系统，求其最大可能值。"
            "n=1时无需操作，不能删除最后一个系统。\n\n"
            "本站依固定完整raw纠正catalog：不是把被删值加给邻居，也不允许无代价删除任意内点后保留两邻居。"
            "首例[-2,4,3,-2,1]正确答案为4，catalog误写的9不采用。完整保留原raw的数值和规模范围。",
        "input":"第一行整数n，第二行n个整数charge[i]。1≤n≤200000，−10^9≤charge[i]≤10^9。"
            "以上数值范围来自完整原始题面；标准输入协议由本站补充。",
        "output":"输出一个整数，表示最后剩下系统的最大电荷值，可能为负数。",
        "explanation":"三个公开样例均来自完整raw，答案依次4、9、3。样例1先删左端−2，"
            "再依次删右端1、−2、3，留下4；样例2从两端依次删除9之外的元素，留下9；"
            "样例3删左端−1，再删右端2，留下3。",
        "hints":["按原始下标奇偶性着色，观察哪些颜色可以合并。","分别考虑存在正值和所有值非正两种情况。"],
        "timeLimit":4,"memoryLimit":262144,"outputLimit":4096,"checker":"tokens",
        "languages":["python","go","java","cpp"]},"cases":cases}
    normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(["node","--import","tsx","-e",normalize],cwd=ROOT,
        input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    package=json.loads(normalized)
    authored=[{"language":"python","code":REFERENCE}]
    put("packages",f"{PID}.json",package)
    put("oracles",f"{PID}.json",oracles)
    put("mutants",f"{PID}.json",MUTANTS)
    put("editorials",f"{PID}.json",{"schemaVersion":1,"id":PID,"title":"奇偶类非空子集和的上界与构造",
        "explanation":EDITORIAL,"solutions":authored})
    put("candidate-batches",f"{BATCH}.json",{"schemaVersion":1,"items":[{
        "id":PID,"sourceContentHash":CONTENT_HASH,"packageChecksum":sha(normalized),
        "editorial":EDITORIAL,"authoredSolutions":authored}]})
    put("source-evidence",f"{BATCH}.json",{"schemaVersion":1,"upstreamCommit":COMMIT,
        "upstreamRepository":"https://github.com/RedInn7/OA-Master","items":{PID:{
        "url":URL,"contentHash":CONTENT_HASH,"catalogContentHash":CONTENT_HASH,
        "path":RAW_PATH,"gitBlobSha":RAW_BLOB,"sources":sources,
        "recoveredRule":"Delete the chosen current system; if internal, merge its two neighbors into their sum. The removed value is discarded. Endpoint deletion does not merge.",
        "sampleCorrection":{"input":[-2,4,3,-2,1],"catalogPrintedAnswer":9,"rawAndVerifiedAnswer":4},
        "rawBounds":"1<=n<=200000; -1e9<=charge[i]<=1e9",
        "siteAdded":"Standard I/O and explicit nonempty terminal condition; maximum intermediate charge can always be preserved by deleting other endpoint systems.",
        "upstreamCodeExecuted":False}}})
    put("resolutions",f"{BATCH}.json",{"schemaVersion":1,"items":[{
        "id":PID,"batch":BATCH,"sourceContentHash":CONTENT_HASH,"previousReason":PREVIOUS,
        "reason":"完整raw恢复删除自身并合并两邻居的规则，首例答案4而非catalog9。原始完整范围保留；"
            "163唯一字面操作oracle与40正式测试含n20万、1e14边界真实子进程通过，两正常退出负控被拒绝。"
            "仅离线候选，尚未做真实GoJudge验证。"}]})
    put("validation",f"{BATCH}.json",{"schemaVersion":1,"seed":SEED,"problems":[{
        "id":PID,"oracleCases":163,"uniqueOracleInputs":163,"publicCases":3,"hiddenCases":len(cases)-3,
        "referenceFormalCases":len(cases),"negativeControls":killed,"referenceSha256":sha(REFERENCE),
        "oracleMethod":"Literal recursive enumeration of every current deletion, with automatic neighbor merging, until a single system remains; independent of parity formula.",
        "largeBoundaries":boundary_evidence,"largeBoundaryMethod":"Same-sign and alternating signed arrays with directly proved parity/nonempty upper bounds.",
        "subprocessValidation":True,"normalExitChecked":True,"localValidationOnly":True,
        "elapsedSeconds":round(time.perf_counter()-started,3)}]})
    print(f"{PID}: candidate generated; registry/coverage/reports untouched",flush=True)


if __name__=="__main__":
    main()
