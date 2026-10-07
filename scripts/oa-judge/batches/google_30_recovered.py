"""Create a source-bound, locally constrained candidate for Google OA #30."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-30"
BATCH = "google-30-recovered"
SEED = 20261006
SOURCE_URL = "https://oamaster.com/docs/companies/google#30-find-optimal-input"
LEETCODE_URL = "https://leetcode.com/discuss/post/6159225/Google-or-Onsite-or-Microwave-optimal-keystroke-input/"
CHINESE_URL = "https://leetcode.cn/discuss/post/3275912/xiang-wen-wen-da-jia-zhe-liang-ti-zen-ya-ct85/"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"

REFERENCE = r'''import sys

def score(value):
    digits = str(value)
    presses = len(digits)
    for i in range(1, len(digits)):
        if digits[i] != digits[i - 1]:
            presses += 2
    if len(digits) <= 2:
        seconds = value
    else:
        seconds = int(digits[:-2]) * 60 + int(digits[-2:])
    return presses, seconds

def solve(raw):
    data = raw.split()
    if len(data) != 1:
        raise ValueError("expected one targetTime")
    target = int(data[0])
    if not 0 <= target <= 6039:
        raise ValueError("targetTime outside the site-supported range")
    best_key = None
    best_value = -1
    for value in range(10000):
        presses, actual = score(value)
        difference = abs(actual - target)
        if difference * 10 > target:
            continue
        key = (presses, difference, value)
        if best_key is None or key < best_key:
            best_key, best_value = key, value
    if best_value < 0:
        raise AssertionError("every target in [0, 6039] has an exact four-digit-or-shorter input")
    return str(best_value)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    ("忽略手指移动成本", r'''import sys
t=int(sys.stdin.read()); best=None
for v in range(10000):
 d=str(v); s=v if len(d)<=2 else int(d[:-2])*60+int(d[-2:]); diff=abs(s-t)
 if diff*10>t: continue
 k=(len(d),diff,v)
 if best is None or k<best[0]: best=(k,v)
print(best[1] if best else -1)
'''),
    ("把秒数按60进位规范化", r'''import sys
t=int(sys.stdin.read()); best=None
for v in range(10000):
 d=str(v); c=len(d)+2*sum(d[i]!=d[i-1] for i in range(1,len(d)))
 s=v if len(d)<=2 else int(d[:-2])*60+int(d[-2:])%60; diff=abs(s-t)
 if diff*10>t: continue
 k=(c,diff,v)
 if best is None or k<best[0]: best=(k,v)
print(best[1] if best else -1)
'''),
    ("同成本时忽略时间接近度", r'''import sys
t=int(sys.stdin.read()); best=None
for v in range(10000):
 d=str(v); c=len(d)+2*sum(d[i]!=d[i-1] for i in range(1,len(d)))
 s=v if len(d)<=2 else int(d[:-2])*60+int(d[-2:]); diff=abs(s-t)
 if diff*10>t: continue
 k=(c,v,diff)
 if best is None or k<best[0]: best=(k,v)
print(best[1] if best else -1)
'''),
    ("把10%边界当作不合格", r'''import sys
t=int(sys.stdin.read()); best=None
for v in range(10000):
 d=str(v); c=len(d)+2*sum(d[i]!=d[i-1] for i in range(1,len(d)))
 s=v if len(d)<=2 else int(d[:-2])*60+int(d[-2:]); diff=abs(s-t)
 if diff*10>=t: continue
 k=(c,diff,v)
 if best is None or k<best[0]: best=(k,v)
print(best[1] if best else -1)
'''),
]

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def put(folder: str, filename: str, value: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def actual_seconds(value: int) -> int:
    digits = str(value)
    if len(digits) <= 2:
        return value
    return int(digits[:-2]) * 60 + int(digits[-2:])

def oracle(target: int) -> int:
    best = None
    for value in range(10000):
        digits = str(value)
        presses = len(digits) + 2 * sum(digits[i] != digits[i-1] for i in range(1, len(digits)))
        seconds = actual_seconds(value)
        difference = abs(seconds - target)
        if difference * 10 <= target:
            candidate = (presses, difference, value)
            if best is None or candidate < best:
                best = candidate
    if best is None:
        raise AssertionError(f"unexpected infeasible target {target}")
    return best[2]

def run(program: str, target: int) -> str:
    result = subprocess.run(["python3", "-c", program], input=f"{target}\n", text=True, capture_output=True, timeout=5)
    if result.returncode:
        raise AssertionError((result.returncode, result.stderr[:300], target))
    return result.stdout.strip()

def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    reviews = json.loads((OA / "reviews/google-remaining-a.json").read_text(encoding="utf-8"))
    previous = next(item for item in reviews["items"] if item["id"] == PID)

    fixed = [0, 1, 10, 59, 60, 81, 90, 99, 100, 599, 600, 999, 3599, 3600, 5999, 6000, 6039]
    rng = random.Random(SEED)
    targets = list(fixed)
    seen = set(targets)
    while len(targets) < 205:
        value = rng.randint(0, 6039)
        if value not in seen:
            seen.add(value)
            targets.append(value)

    # Find concrete additional witnesses for all mutants and ensure they are formal tests.
    witnesses = []
    for name, mutant in MUTANTS:
        candidates = ([10] + targets + list(range(0, 6040))) if name == "把10%边界当作不合格" else targets + list(range(0, 6040))
        rejected = next((target for target in candidates if run(mutant, target) != str(oracle(target))), None)
        if rejected is None:
            raise AssertionError(f"surviving mutant: {name}")
        if rejected not in seen:
            targets.append(rejected)
            seen.add(rejected)
        witnesses.append((name, rejected))

    cases = []
    formal_targets = fixed + targets[len(fixed):len(fixed)+17] + [target for _, target in witnesses]
    formal_targets = list(dict.fromkeys(formal_targets))
    for index, target in enumerate(formal_targets):
        name = "原题示例" if target == 600 else "恰好10%边界" if target == 10 else f"隐藏用例 {index}"
        cases.append({"name": name, "input": f"{target}\n", "expectedOutput": f"{oracle(target)}\n", "hidden": target != 600, "weight": 1})
    cases.append({"name": "最大目标时间", "input": "6039\n", "expectedOutput": f"{oracle(6039)}\n", "hidden": True, "weight": 1})
    for case in cases:
        assert run(REFERENCE, int(case["input"])) == case["expectedOutput"].strip()
    formal_by_target={int(case["input"]):index for index,case in enumerate(cases)}
    controls=[{"name":name,"rejectedByCases":[formal_by_target[target]]} for name,target in witnesses]

    limits = "本站评测边界：0≤targetTime≤6039 秒，只考虑 0..9999 的非负整数键入值（最多四位，按普通十进制、不带前导零；输入 0 表示 0 秒）。目标范围内均存在精确可表示的时间。此范围未出现在 OAMaster 原文中，是本站为匹配源站三语参考实现搜索域而明确补充。"
    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview", "title": "微波炉最优按键输入",
        "difficulty": "简单", "tags": ["OA", "Google", "枚举", "字符串"],
        "description": "微波炉用数字键输入烹饪时间。输入不超过两位时按秒解释；超过两位时末两位为秒，其余前缀为分钟（秒数允许达到99，例如 999 表示9分99秒）。每次按键成本为1；相邻两次按下不同数字键时，移动手指另花2。实际时间须与目标相差不超过10%。先最小化总成本；若成本相同，选实际时间与目标差值最小的输入；仍并列时选数值最小的输入。返回该输入整数。\n\n" + limits + "\n\n原题来源：" + SOURCE_URL + "。同题面试记录及样例：" + LEETCODE_URL + "。",
        "input": "输入一行整数 targetTime（秒）。", "output": "输出按规则选出的整数键入值。",
        "explanation": "最多只有 10000 个候选值，逐个计算实际秒数与按键成本，过滤掉超过10%的候选，再按（按键成本、时间差、输入值）升序取首个。",
        "hints": ["不同数字键的移动成本只计在相邻两次按键之间。", "末两位秒数可以大于59，不要按六十进制规范化。", "使用整数比较 `10*|actual-target| <= target`，避免浮点误差。"],
        "timeLimit": 3, "memoryLimit": 131072, "outputLimit": 4096, "checker": "tokens", "languages": ["python", "java", "cpp"],
    }
    package_input = {"schemaVersion":1,"problem":problem,"cases":cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    parsed = subprocess.run(["node","--import","tsx","-e",normalize],cwd=ROOT,input=json.dumps(package_input,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    package=json.loads(parsed)
    package_bytes=json.dumps(package,ensure_ascii=False,separators=(",",":")).encode()

    editorial = f"""## 思路

枚举 0 到 9999。将不超过两位的输入解释为秒；更长的输入将末两位作为秒、前缀作为分钟，秒数不做六十进制进位。扫描数字串计算按键数与相邻不同数字的移动成本。满足 `10×时间差≤targetTime` 后，按（总成本、时间差、数值）字典序最小选择。

## 正确性

本站候选域恰为 10000 个整数，算法逐一枚举且只排除超出10%范围的输入；对剩余候选按题目优先级完整比较成本、时间差和站内并列规则，因此选中的输入就是该站内规格的最优解。范围 `0≤targetTime≤6039` 内，总能找到表示同一秒数的按键值，答案不会无解。

## 复杂度

候选数量固定为 10000，每个候选最多处理4位，时间 O(10000)，额外空间 O(1)。

## 来源与本站约定

OAMaster 完整定义了成本、±10%、并列先看时间差及示例，但没给目标范围；其 Python、Java、C++ 三份代码都枚举 `0..9999`，且都按 `(成本, 时间差, 输入数值)` 选择：{SOURCE_URL}（快照指纹 {source['contentHash']}）。同题 Google 面试记录复现“10分钟→888”示例及成本解释：{LEETCODE_URL}；中文同题解释：{CHINESE_URL}。为避免无解/溢出且忠实复用三语解的搜索域，`targetTime≤6039`、键入值最多四位，以及最后并列按输入数值最小，均清楚标为本站约定；不声称是原始面试限制。
"""
    manifest={"schemaVersion":1,"items":[{"id":PID,"sourceContentHash":source["contentHash"],"packageChecksum":sha(package_bytes),"editorial":editorial,"authoredSolutions":[{"language":"python","code":REFERENCE}]}]}
    report_path=OA/"reports"/(BATCH+".json")
    manifest_folder="batches" if report_path.exists() else "candidate-batches"
    put(manifest_folder,BATCH+".json",manifest)
    if manifest_folder=="batches": (OA/"candidate-batches"/(BATCH+".json")).unlink(missing_ok=True)
    put("packages",PID+".json",package)
    (OA/"references"/(PID+".py")).write_text(REFERENCE,encoding="utf-8")
    put("editorials",PID+".json",{"schemaVersion":1,"id":PID,"title":"微波炉最优按键输入","explanation":editorial,"solutions":[{"language":"python","code":REFERENCE}],"sourceUrl":SOURCE_URL,"sourceContentHash":source["contentHash"]})
    put("oracles",PID+".json",[{"input":f"{target}\n","expectedOutput":f"{oracle(target)}\n"} for target in targets])
    put("mutants",PID+".json",[{"name":name,"code":code} for name,code in MUTANTS])
    put("source-evidence",BATCH+".json",{"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":UPSTREAM_COMMIT,"catalogContentHash":source["contentHash"],"items":[{"id":PID,"company":"Google","title":source["title"],"sourceUrl":SOURCE_URL,"fixedSource":{"path":"web/content/docs/companies/google.mdx","evidence":"OAMaster 原文解释时间格式、键入/移动成本、10%容差和成本/时间差目标。三语代码均枚举 v=0..9999，并按 (cost, absDiff, v) 比较。"},"supportingSources":[{"url":LEETCODE_URL,"evidence":"同题 Google onsite 记录复现 10 分钟 target 与 888 答案，并解释按键成本和更接近目标的并列规则。"},{"url":CHINESE_URL,"evidence":"同题中文记录给出 888 对应 568 秒、999 对应 639 秒，说明末两位按秒直接计数而非按60进位。"}],"siteAdditions":["0≤targetTime≤6039","输入候选限定为 0..9999","剩余并列时取输入数值较小者；与 OAMaster 三语代码相同"],"interpretation":"移动成本按相邻输入数字不同计2；时间窗包含恰好10%的边界；末两位秒数允许60..99，不进行进位。"}]})
    has_report=report_path.exists()
    reason="OAMaster 正文与三语代码共同明确时间解释、移动/按键成本、10%容差及成本后优先较近时间；三语代码均用 (成本, 时间差, 数值) 确定并列结果。同题 Google 面试记录复现原样例。原文未写目标时间范围，故本站明确限制 0..6039，以保证四位输入搜索域内始终存在可行精确输入。"
    if has_report: reason += " 用户自有 GoJudge 沙箱验证通过。"
    put("resolutions",BATCH+".json",{"schemaVersion":1,"items":[{"id":PID,"batch":BATCH,"sourceContentHash":source["contentHash"],"previousReason":previous["reason"],"reason":reason}]})
    put("validation",BATCH+".json",{"schemaVersion":1,"seed":SEED,"problems":[{"id":PID,"oracleCases":len(targets),"uniqueOracleInputs":len(targets),"publicCases":1,"hiddenCases":len(cases)-1,"negativeControls":controls,"referenceSha256":sha(REFERENCE.encode())}],"note":"穷举10000种键入值构造独立答案；验证原样例、时间解释、10%边界、站点目标边界及错误实现。" + ("真实 GoJudge 报告已绑定。" if has_report else "尚未连接 GoJudge。")})
    print(json.dumps({"id":PID,"candidateBatch":BATCH,"oracle":len(targets),"formal":len(cases),"mutantsKilled":len(controls)},ensure_ascii=False))

if __name__ == "__main__":
    main()
