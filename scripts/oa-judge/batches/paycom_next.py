"""Create offline-only, explicitly generalized Paycom code-tracing candidates.

Only local authored references, oracles and mutants are executed. OA-Master source
snippets are treated as immutable text evidence and are never run.
"""
from pathlib import Path
import hashlib
import json
import math
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SEED = 20261005


def run(path, data):
    proc = subprocess.run([sys.executable, "-I", str(path)], input=data, text=True,
                          capture_output=True, timeout=8, check=True)
    return proc.stdout.rstrip("\n")


def gcd_encode(value):
    return f"{value[0]} {value[1]}\n"


def gcd_oracle(value):
    return str(math.gcd(*value))


def gcd_random(rng):
    return rng.randint(1, 200), rng.randint(1, 200)


def parity_encode(value):
    return f"{value}\n"


def parity_oracle(value):
    return "1" if value % 2 else "0"


def parity_random(rng):
    return rng.randint(-100000, 100000)


def finally_encode(value):
    return f"{value[0]} {value[1]}\n"


def finally_oracle(value):
    return "Exception Finally" if value[1] == 0 else "Finally"


def finally_random(rng):
    return rng.randint(-100000, 100000), rng.choice([0, 0, 0, -10, -1, 1, 2, 7])


def continue_encode(value):
    return f"{value[0]} {value[1]} {value[2]}\n"


def continue_oracle(value):
    n, first, second = value
    cutoff = min(first, second)
    return " ".join(str(s) for s in range(1, n + 1) if s >= cutoff)


def continue_random(rng):
    n = rng.randint(1, 120)
    return n, rng.randint(1, n), rng.randint(1, n)


SPECS = [
    {
        "id": "oa-paycom-2", "title": "Mystery Algorithm — Generalized Euclidean Subtraction",
        "tags": ["数学", "模拟", "最大公约数"],
        "description": ("原题给出重复相减的伪代码，并询问 a=2437、b=875 的结果。"
                        "本站将同一算法推广为读取任意两个正整数，输出算法终止时的 x=y。"),
        "input": "一行两个正整数 a、b。本站补充范围：1≤a,b≤10^9。",
        "output": "输出该重复相减算法最终得到的相等值。",
        "encode": gcd_encode, "oracle": gcd_oracle, "random": gcd_random,
        "samples": [(2437,875), (12,18), (1,999999)],
        "public": ["1", "6", "1"],
        "reference": '''import sys
def solve(raw):
 a,b=map(int,raw.split())
 while b:
  a,b=b,a%b
 return str(a)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("返回两个原始输入的较小值", "return str(a)", "return str(min(map(int,raw.split())))"),
            ("把所有答案都当成 1", "return str(a)", "return '1'"),
        ],
        "editorial": "## 思路\n\n每次将较大数减去较小数不会改变两数的最大公约数；过程结束时两数相等，该值正是最大公约数。实现不必逐次相减，可用欧几里得取余迭代得到同一结果。\n\n## 正确性\n\n对 a≥b>0，有 gcd(a,b)=gcd(a−b,b)=gcd(a mod b,b)。因此将减法步骤批量化为取余不会改变最终公约数。余数迭代在每步严格缩小第二个数，最终到达 0，此时另一个数即原伪代码终止时的相等值。\n\n## 复杂度\n\n时间 O(log(min(a,b)))，额外空间 O(1)。本站把固定样例泛化为正整数输入，避免只有一个固定答案的常量输出题。",
    },
    {
        "id": "oa-paycom-4", "title": "C Function Calls — Nested Parity Output",
        "tags": ["模拟", "条件判断"],
        "description": ("原题给出 C 函数：奇数输入返回 0，偶数输入返回 1，并将 i=3 连续调用两次。"
                        "本站保留该函数与调用次数，改为从输入读取初始 i，输出第二次调用后的值。"),
        "input": "一行一个有符号 32 位整数 i。",
        "output": "输出连续调用两次原题函数后的整数结果。",
        "encode": parity_encode, "oracle": parity_oracle, "random": parity_random,
        "samples": [3, 2, 0], "public": ["1", "0", "0"],
        "reference": '''import sys
def f(x):
 return 0 if x%2 else 1
def solve(raw):
 i=int(raw); i=f(i); i=f(i)
 return str(i)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("只调用一次函数", "i=f(i); i=f(i)", "i=f(i)"),
            ("函数始终返回 0", "return 0 if x%2 else 1", "return 0"),
        ],
        "editorial": "## 思路\n\n严格按原题顺序调用 f 两次。f 对奇数返回 0、对偶数返回 1。连续两次调用后，初始奇数得到 1，初始偶数得到 0。\n\n## 正确性\n\n若初值为奇数，第一次返回 0，第二次把偶数 0 映射为 1；若初值为偶数，第一次返回 1，第二次把奇数 1 映射为 0。故结果等于初始值的奇偶指示量。\n\n## 复杂度\n\n时间与额外空间均为 O(1)。本站只把原题固定的 i=3 改成输入参数，函数体和调用次数保持不变。",
    },
    {
        "id": "oa-paycom-6", "title": "Java try / catch / finally — Console Trace",
        "tags": ["模拟", "异常处理"],
        "description": ("给定原题 divide(a,b) 代码的整数输入。除法异常时 catch 打印 `Exception `；"
                        "finally 始终打印 `Finally `。返回值不会被打印。本站补充：为了标准输出可判，"
                        "将 System.err 上按时间顺序产生的文本合并为一条控制台轨迹。"),
        "input": "一行两个有符号 32 位整数 a、b。",
        "output": "按原代码执行顺序输出控制台文本；b=0 时为 `Exception Finally`，否则为 `Finally`。",
        "encode": finally_encode, "oracle": finally_oracle, "random": finally_random,
        "samples": [(4,0), (4,2), (-2147483648,-1)],
        "public": ["Exception Finally", "Finally", "Finally"],
        "reference": '''import sys
def solve(raw):
 a,b=map(int,raw.split()); trace=[]
 try:
  _=a//b
 except ZeroDivisionError:
  trace.append('Exception')
 finally:
  trace.append('Finally')
 return ' '.join(trace)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("异常时漏掉 catch 输出", "trace.append('Exception')", "pass"),
            ("把 finally 输出放到异常提示之前", "trace.append('Finally')", "trace.insert(0,'Finally')"),
        ],
        "editorial": "## 思路\n\n若除数为 0，整数除法抛出异常，catch 先打印 Exception；随后无论是否异常都会执行 finally 并打印 Finally。若除数非 0，只打印 Finally。返回的 c 从未传给打印语句，因此不出现在输出中。\n\n## 正确性\n\ntry 中只有除法可能抛出 ArithmeticException。除数为零时控制流进入 catch，再离开 try/catch 执行 finally；除数非零时跳过 catch，也执行 finally。两条路径产生的输出顺序分别唯一对应题面定义。本站明确把同一 System.err 流上的文本作为标准输出轨迹比较。\n\n## 复杂度\n\n时间与额外空间均为 O(1)。本站把原题固定调用 divide(4,0) 泛化为任意整数输入，便于测试正常与异常两条分支。",
    },
    {
        "id": "oa-paycom-15", "title": "C continue Statement — Generalized Loop Output",
        "tags": ["模拟", "循环"],
        "description": ("原题代码中 s 从 0 开始，在 `while (s++ < 10)` 中递增；当 s 同时小于两个阈值时 continue，否则打印 s。"
                        "本站将上限和两个阈值改为输入，循环与条件语义保持不变。"),
        "input": "一行三个整数 n、a、b。本站补充范围：1≤n≤100000，1≤a,b≤n。",
        "output": "按原循环打印顺序输出所有未被 continue 跳过的 s，以空格分隔。",
        "encode": continue_encode, "oracle": continue_oracle, "random": continue_random,
        "samples": [(10,4,9), (5,1,5), (5,8,3)],
        "public": ["4 5 6 7 8 9 10", "1 2 3 4 5", "3 4 5"],
        "reference": '''import sys
def solve(raw):
 n,a,b=map(int,raw.split()); s=0; out=[]
 cut=min(a,b)
 while s<n:
  s+=1
  if s<cut: continue
  out.append(str(s))
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("continue 条件多跳过了阈值本身", "if s<cut:", "if s<=cut:"),
            ("只按较大的阈值判断", "cut=min(a,b)", "cut=max(a,b)"),
        ],
        "editorial": "## 思路\n\n`while (s++ < n)` 每轮先判断旧值再递增，因此循环体内 s 依次为 1 到 n。continue 条件 `s<a && s<b` 等价于 `s<min(a,b)`；其余值依次输出。\n\n## 正确性\n\n循环体对每个整数 s∈[1,n] 恰执行一次。若 s 小于两个阈值，continue 跳过打印；否则条件为假并打印。由合取条件等价于 s<min(a,b)，输出集合恰为 min(a,b) 到 n，且顺序递增。\n\n## 复杂度\n\n时间 O(n)，额外空间 O(n)（用于缓冲输出）。本站参数化了原题常量，但完整保留自增、循环边界和 continue 判断。",
    },
]


BLOCKED = {
    "oa-paycom-1": "原题是固定选择题而非可编程输入输出任务；同一名称/参数类型与不同实现对应 overriding，题目用词容易把 overloading 混入。为了不退化为只需输出固定选项的常量程序，暂不做代码评测。",
    "oa-paycom-3": "仅为‘哪个结构处理函数调用’的固定概念选择题，具体 ABI 下参数也可能通过寄存器传递；没有可泛化的程序输入输出。",
    "oa-paycom-5": "Java overriding 返回类型的固定知识选择题（void 方法不能改成 int，但允许兼容的 covariant reference return 仅适用于引用类型）；没有编程输入输出语义。",
    "oa-paycom-7": "删除资源成功时 200、202、204 均可能成立，取决于服务端是返回表示、接受异步处理还是无内容响应；题面缺少上下文且选项没有 204，‘None’ 并非唯一规范答案。",
    "oa-paycom-8": "HTTP 动词识别固定选择题，不能从原题构造有意义的程序输入输出；常量打印选项会退化成非编程评测。",
    "oa-paycom-9": "单选题答案是 Unit Testing，但题目仅考术语，没有算法或可参数化的 I/O。",
    "oa-paycom-10": "JavaScript 语句末尾分号不是必需，答案依赖自动分号插入的语言规则；这是固定知识题而非程序输入输出任务。",
    "oa-paycom-11": "固定语法选择题，虽正确选项明确，但无可泛化的输入输出；输出一个固定选项不能检验代码能力。",
    "oa-paycom-12": "固定 C 编译判断题。数组不可赋值，原程序编译失败；但候选 OJ 不能把编译失败代码片段当作运行时输入来判定。",
    "oa-paycom-13": "固定哈希表输出选择题，正确选项只需辨认键唯一性；没有可泛化的程序 I/O，常量答案无法形成有意义的隐藏测试。",
    "oa-paycom-14": "固定 HTTP 状态码知识选择题（500 是服务器错误），没有可泛化的编程输入输出。",
    "oa-paycom-16": "固定 Java try/finally 路径选择题，badMethod 为空时答案为 ACD；没有可泛化输入，常量输出不能形成程序评测。",
    "oa-paycom-17": "固定 JavaScript 类型选择题（Array 不是原始类型），没有可泛化的程序输入输出。",
    "oa-paycom-18": "固定事件循环单选题。虽然给出的时序有明确答案，但需要将固定代码片段改造成计时器调度题才有多组测试，超出了原题规则，不以补造题意方式接入。",
    "oa-paycom-19": "固定 Java 布尔表达式选择题，按 Java 运算符优先级答案为 dokey；没有可泛化的输入输出程序任务。",
    "oa-paycom-20": "声明与定义的区别取决于 C/C++ 等语言语境；题面未指定语言，而不同语言中 declaration/definition 术语并不完全一致。",
}


RAW_BLOBS = [
    "9960286f273ba75386799d057bc46e5c1d36a7ff", "a6720319d7277406c530d6ca2f76fed03c72c9cc",
    "b87aad62a7db30a768c84a27d8cb6e939d91b2d9", "99ee8f51a31709bbcafb63172a8ed09201437cc1",
    "ffd5b145d72fe47ca635dd819f16f83f6f3e940c", "8c0e11e65a7d689a0bbd3970582be9ca4f250c5e",
    "b8177db1f44e0b82d31a0a526fcaba5cc040979b", "54b7c948eb52aaf8b2d79ee1e43aaea87b997ad4",
    "aeed56b1f6e43a81077e002235bc73e67ac993ed", "9404162b27c50fa0e64e570fd4143219cc4d063e",
    "3180f405c1d58826f10c6e25a901e108cb402d69", "48291f6f1d90f17800e665c7c9bb49ef010d170c",
    "470e7a10086e725059652d6e10a5fbdcd5e95ff3", "1e9fb3eeea6d373ed72c7ac48e9b604962dfc614",
    "36e01966c931f60c25568dd6d66c8d5fd6cf85aa", "39e459d930a227976f59c99412cfe7db03d3d67b",
    "6c355faaef4adc7125e942d4d22c49565e4507c4", "f64d92f4693b1184e779344ed5888e01feb7a91c",
    "6182952d26bb4b79153bf22db5204437b52e867a", "766edfb2a8a2fcc056bfb5d39a82e79c2bfb0f1b",
]


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants",
                   "negative-controls", "reviews", "candidate-batches", "validation",
                   "source-evidence"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    manifest, reports, reviews, evidence = [], [], [], []
    authored_ids = {spec["id"] for spec in SPECS}
    for number, blob in enumerate(RAW_BLOBS, 1):
        pid = f"oa-paycom-{number}"
        source = SOURCES[pid]
        evidence.append({"id":pid, "path":f"OA LIST/Paycom_OA/{number:03d}_image.txt",
                         "gitBlobSha":blob, "catalogContentHash":source["contentHash"],
                         "sourceUrl":source["sourceUrl"],
                         "status":"authored" if pid in authored_ids else "blocked",
                         "reason":("原始 C/Java 代码追踪规则清楚；本站输入协议明确参数化固定样例。"
                                   if pid in authored_ids else BLOCKED[pid])})

    for spec in SPECS:
        pid, source = spec["id"], SOURCES[spec["id"]]
        code = spec["reference"].lstrip()
        ref = OUT / "references" / f"{pid}.py"
        ref.write_text(code)
        rng = random.Random(SEED + int(pid.rsplit("-",1)[1]))
        values = spec["samples"] + [spec["random"](rng) for _ in range(160)]
        oracle_cases=[]
        for value in values:
            stdin=spec["encode"](value); expected=spec["oracle"](value)
            actual=run(ref,stdin)
            assert actual==expected, (pid,value,expected,actual)
            if len(oracle_cases)<3:
                assert expected==spec["public"][len(oracle_cases)], (pid,"source sample mismatch",expected)
            oracle_cases.append({"input":stdin,"expectedOutput":expected+"\n"})

        cases=[{"name":f"公开样例 {i+1}",**oracle_cases[i],"hidden":False,"weight":1}
               for i in range(3)]
        cases.extend({"name":f"随机隐藏测试 {i+1}",**oracle_cases[i+3],"hidden":True,"weight":1}
                     for i in range(24))
        if pid=="oa-paycom-2":
            for edge_index,(pair, expected) in enumerate([((10**9,10**9-1),"1"),((10**9,500000000),"500000000")],1):
                stdin=spec["encode"](pair); assert run(ref,stdin)==expected
                cases.append({"name":f"十亿范围边界 {edge_index}","input":stdin,"expectedOutput":expected+"\n","hidden":True,"weight":1})
        elif pid=="oa-paycom-4":
            for edge_index,(value, expected) in enumerate([(-2147483648,"0"),(2147483647,"1")],1):
                stdin=spec["encode"](value); assert run(ref,stdin)==expected
                cases.append({"name":f"32位有符号整数边界 {edge_index}","input":stdin,"expectedOutput":expected+"\n","hidden":True,"weight":1})
        elif pid=="oa-paycom-6":
            for edge_index,(pair, expected) in enumerate([((-2147483648,0),"Exception Finally"),((2147483647,1),"Finally")],1):
                stdin=spec["encode"](pair); assert run(ref,stdin)==expected
                cases.append({"name":f"32位整数与异常分支边界 {edge_index}","input":stdin,"expectedOutput":expected+"\n","hidden":True,"weight":1})
        else:
            value=(5000,2500,4000); stdin=spec["encode"](value); expected=spec["oracle"](value)
            assert run(ref,stdin)==expected
            cases.append({"name":"循环规模边界","input":stdin,"expectedOutput":expected+"\n","hidden":True,"weight":1})

        mutants=[]; controls=[]
        for index,(name,old,new) in enumerate(spec["mutants"],1):
            assert old in code, (pid,"mutation anchor missing",old)
            mutant_code=code.replace(old,new)
            control=OUT/"negative-controls"/f"{pid}-{index}.py"
            control.write_text(mutant_code)
            killed=[]
            for case_index,case in enumerate(cases):
                if run(control,case["input"])!=case["expectedOutput"].rstrip("\n"):
                    killed.append(case_index)
            assert killed, (pid,"mutant survives",name)
            mutants.append({"name":name,"code":mutant_code})
            controls.append({"name":name,"rejectedByCases":killed})

        problem={
            "id":pid,"courseId":"gomall","lessonId":"00-overview",
            "title":spec["title"],"difficulty":"简单",
            "tags":["OA","Paycom"]+spec["tags"],
            "description":spec["description"]+"\n\n输入协议和泛化范围是本站补充；不代表原题以 stdin/stdout 呈现。",
            "input":spec["input"],"output":spec["output"],
            "explanation":"思路、正确性和复杂度见配套题解。",
            "hints":["逐步追踪状态变化；特别注意循环条件的自增时机及 finally 的执行顺序。"],
            "timeLimit":3,"memoryLimit":262144,"outputLimit":65536,
            "checker":"tokens","languages":["python","go","java","cpp"],
        }
        raw_package={"schemaVersion":1,"problem":problem,"cases":cases}
        normalize=("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
                   "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
                   "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
        result=subprocess.run(["node","--import","tsx","-e",normalize],cwd=ROOT,
                              input=json.dumps(raw_package,ensure_ascii=False),text=True,capture_output=True)
        if result.returncode: raise RuntimeError(result.stderr)
        normalized=result.stdout; package=json.loads(normalized)
        editorial_text=spec["editorial"]
        editorial={"schemaVersion":1,"id":pid,"title":spec["title"],
                   "explanation":editorial_text,"solutions":[{"language":"python","code":code}],
                   "sourceUrl":source["sourceUrl"],"sourceContentHash":source["contentHash"],"author":"CSWork"}
        for folder,document in (("packages",package),("oracles",oracle_cases),
                                ("mutants",mutants),("editorials",editorial)):
            (OUT/folder/f"{pid}.json").write_text(json.dumps(document,ensure_ascii=False,indent=2)+"\n")
        manifest.append({"id":pid,"sourceContentHash":source["contentHash"],
                         "packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),
                         "editorial":editorial_text,"authoredSolutions":[{"language":"python","code":code}]})
        reports.append({"id":pid,"oracleCases":len(oracle_cases),"publicCases":3,
                        "hiddenCases":len(cases)-3,"negativeControls":controls,
                        "referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
        reviews.append({"id":pid,"status":"authored",
                        "reason":"已核对 e66f809 原始代码题；本站参数化规则有明确标注，163 个独立 oracle 输入和两个正常退出 mutant 均通过离线验证。",
                        "sourceUrls":[source["sourceUrl"]],"sourceContentHashes":[source["contentHash"]],
                        "sourceCommit":CATALOG["source"]["commit"],"catalogContentHash":source["contentHash"]})
        print(f"{pid}: {len(oracle_cases)} oracle inputs; {len(cases)} judge cases; "
              f"{len(controls)} mutants rejected",flush=True)

    reviews.extend({"id":pid,"status":"blocked","reason":reason} for pid,reason in BLOCKED.items())
    reviews.sort(key=lambda item:int(item["id"].rsplit("-",1)[1]))
    batch="paycom-next"
    # Once production GoJudge evidence exists, emit the formal runtime batch;
    # otherwise keep the authored work out of the runtime registry.
    target_dir = "batches" if (OUT/"reports"/f"{batch}.json").exists() else "candidate-batches"
    (OUT/target_dir/f"{batch}.json").write_text(
        json.dumps({"schemaVersion":1,"items":manifest},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation"/f"{batch}.json").write_text(json.dumps(
        {"schemaVersion":1,"seed":SEED,"problems":reports,
         "note":"Offline authored-code/oracle/mutant validation only; not tested against production GoJudge."},
        ensure_ascii=False,indent=2)+"\n")
    (OUT/"reviews"/f"{batch}.json").write_text(json.dumps(
        {"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
    (OUT/"source-evidence"/f"{batch}.json").write_text(json.dumps(
        {"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master",
         "commit":CATALOG["source"]["commit"],
         "reason":"Read-only review of all twenty immutable raw source snippets; imported snippets were not executed.",
         "companySummaryBlob":"e207f235860813014c80ce2a23d6eddf5f9de248",
         "items":evidence},ensure_ascii=False,indent=2)+"\n")


if __name__=="__main__":
    main()
