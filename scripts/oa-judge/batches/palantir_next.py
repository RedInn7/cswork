"""Build offline-only, source-checked Palantir OA candidates."""
from pathlib import Path
import hashlib, itertools, json, random, subprocess, sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCE = {x["id"]: x for x in CATALOG["items"]}
COMMIT = CATALOG["source"]["commit"]
SEED = 20261005


def run(path, data):
    return subprocess.run([sys.executable, "-I", str(path)], input=data, text=True,
                          capture_output=True, timeout=10, check=True).stdout.rstrip("\n")


def largest_encode(s): return s + "\n"


def largest_reference(s):
    odds = sorted((c for c in s if int(c) % 2), reverse=True)
    evens = sorted((c for c in s if not int(c) % 2), reverse=True)
    oi = ei = 0; out = []
    for c in s:
        if int(c) % 2: out.append(odds[oi]); oi += 1
        else: out.append(evens[ei]); ei += 1
    return "".join(out)


def largest_oracle(s):
    groups = [[c for c in s if int(c) % 2 == p] for p in (0, 1)]
    choices = []
    for group in groups:
        choices.append(sorted({"".join(p) for p in itertools.permutations(group)}, reverse=True))
    best = ""
    for a in choices[0]:
        for b in choices[1]:
            ia = ib = 0; cur = []
            for c in s:
                if int(c) % 2: cur.append(b[ib]); ib += 1
                else: cur.append(a[ia]); ia += 1
            best = max(best, "".join(cur))
    return best


def largest_mutant(s):
    out = list(s); i = 0
    while i < len(out):
        j = i + 1
        while j < len(out) and int(out[j]) % 2 == int(out[i]) % 2: j += 1
        out[i:j] = sorted(out[i:j], reverse=True); i = j
    return "".join(out)


LARGEST_REF = '''import sys\ndef solve(s):\n s=s.strip(); odd=sorted((c for c in s if int(c)%2),reverse=True); even=sorted((c for c in s if not int(c)%2),reverse=True); i=j=0; out=[]\n for c in s:\n  if int(c)%2: out.append(odd[i]); i+=1\n  else: out.append(even[j]); j+=1\n return "".join(out)\nif __name__=="__main__": print(solve(sys.stdin.read()))\n'''
LARGEST_MUTANTS = [
    ("只在连续同奇偶段内排序", LARGEST_REF.replace(
        ' odd=sorted((c for c in s if int(c)%2),reverse=True); even=sorted((c for c in s if not int(c)%2),reverse=True); i=j=0; out=[]\n for c in s:\n  if int(c)%2: out.append(odd[i]); i+=1\n  else: out.append(even[j]); j+=1\n return "".join(out)',
        ' out=list(s); i=0\n while i<len(out):\n  j=i+1\n  while j<len(out) and int(out[j])%2==int(out[i])%2: j+=1\n  out[i:j]=sorted(out[i:j],reverse=True); i=j\n return "".join(out)')),
    ("将偶数按升序排列", LARGEST_REF.replace('even=sorted((c for c in s if not int(c)%2),reverse=True)', 'even=sorted(c for c in s if not int(c)%2)')),
]


def words_encode(words): return str(len(words)) + "\n" + "\n".join(words) + "\n"


def words_reference(words):
    answers=[]
    for word in words:
        changes=0; last=None
        for c in word:
            if c == last: changes += 1; last = None
            else: last = c
        answers.append(str(changes))
    return " ".join(answers)


def words_oracle(words):
    # Independent DP: choose any lowercase replacement for each character.
    result=[]
    for word in words:
        dp={c: (0 if c == word[0] else 1) for c in "abcdefghijklmnopqrstuvwxyz"}
        for original in word[1:]:
            best=min(dp.values()); nxt={}
            for c in "abcdefghijklmnopqrstuvwxyz":
                nxt[c]=(min(v for prev,v in dp.items() if prev != c)
                        + (c != original))
            dp=nxt
        result.append(str(min(dp.values())))
    return " ".join(result)


WORDS_REF = '''import sys\ndef solve(raw):\n z=raw.split(); n=int(z[0]); out=[]\n for w in z[1:1+n]:\n  changes=0; last=None\n  for c in w:\n   if c==last: changes+=1; last=None\n   else: last=c\n  out.append(str(changes))\n return " ".join(out)\nif __name__=="__main__": print(solve(sys.stdin.read()))\n'''
WORDS_MUTANTS = [
    ("把重复相邻字符对逐对计数", WORDS_REF.replace(
        'if c==last: changes+=1; last=None\n   else: last=c',
        'if c==last: changes+=1\n   last=c')),
    ("每个重复字符都单独替换", WORDS_REF.replace(
        'if c==last: changes+=1; last=None\n   else: last=c',
        'if c==last and c=="a": changes+=1; last=None\n   else: last=c')),
]


def main():
    folders=("packages","editorials","references","oracles","mutants","negative-controls",
             "candidate-batches","validation","reviews","source-evidence")
    for folder in folders: (OUT/folder).mkdir(parents=True,exist_ok=True)
    specs=[
        {"id":"oa-palantir-1","title":"Swap Parity","description":"给定数字字符串。可任意次交换相邻且奇偶性相同的数字，求能得到的最大数字。每个奇偶位序列中的数字可以任意重排。",
         "input":"输入一行仅含数字 0–9 的字符串 num，1≤长度≤100000。","output":"输出可得到的最大数字字符串。",
         "encode":largest_encode,"oracle":largest_oracle,"reference":LARGEST_REF,"mutants":LARGEST_MUTANTS,
         "samples":["7596801","0082663","0"],"random":lambda r: ''.join(str(r.randrange(10)) for _ in range(r.randint(1,9))),
         "long":("10"*50000,""),"tags":["字符串","排序"],"editorial":"## 思路\n\n一次相邻交换只会交换同奇偶的数字，因此每个位置的奇偶性固定；同一奇偶子序列内部则能通过相邻交换任意重排。分别将奇数和偶数降序排列，再按原字符串的奇偶位置填回即可。\n\n## 正确性\n\n奇偶不同的数字永远不能交换，所以每个位置最终只能接收与该位置同奇偶的数字。相同奇偶的数字能在其子序列内任意交换。为了使结果字典序最大，各奇偶子序列都应按降序放入对应位置，算法因此产生所有合法结果中的最大者。\n\n## 复杂度\n\n排序时间 O(n log n)，空间 O(n)。"},
        {"id":"oa-palantir-3","title":"No Pairs Allowed","description":"给定 n 个小写英文字母单词。对每个单词，可将任意字符替换为任意小写英文字母，求使最终字符串不存在相邻相同字符所需的最少替换次数。",
         "input":"第一行 n (1≤n≤100)，接下来 n 行各一个单词，2≤每个单词长度≤100000，字符均为 a–z。","output":"按输入顺序输出每个单词的最少替换次数，以空格分隔。",
         "encode":words_encode,"oracle":words_oracle,"reference":WORDS_REF,"mutants":WORDS_MUTANTS,
         "samples":[["add","boook","break"],["aa","aaa"],["ab","zzzz"]],
         "random":lambda r: ["".join(r.choice("abcd") for _ in range(r.randint(2,24))) for _ in range(r.randint(1,8))],
         "long":(["a"*100000,"ab"*50000],""),"tags":["字符串","贪心"],"editorial":"## 思路\n\n从左到右扫描每个单词。若当前字符与上一个保留字符相同，就必须替换其中一个；替换当前字符即可，并让它不再与下一个原字符形成重复。否则保留当前字符。\n\n## 正确性\n\n每段长度为 L 的连续相同字符至少要替换 floor(L/2) 个字符，因为一次替换最多打断一对相邻重复，而保留每隔一个字符、替换其余字符恰好达到该下界。贪心在每次相邻冲突时替换当前字符，正好对每段每两个字符计一次，不会影响之后不同字符段，因此达到全局最小值。\n\n## 复杂度\n\n设字符总数为 L，时间 O(L)，额外空间 O(1)（不计输出）。"},
    ]
    manifest=[]; reports=[]; review_items=[]; evidence=[]
    source_evidence={
      "oa-palantir-1":("fastprep/Palantir/palantir-get-largest-number.md","a88a4ae608d105a0ba9d37885eeace267528bd6b"),
      "oa-palantir-2":("fastprep/Palantir/palantir-get-phone-numbers.md","ace944acc5cdf9a89f983fc05cd1e25b4851fbad"),
      "oa-palantir-3":("fastprep/Palantir/palantir-minimal-operations.md","57ed2aeab638f9e995808fd10f6407c188fde2e0"),
      "oa-palantir-4":("fastprep/Palantir/palantir-minimize-path-value.md","fb4121843016a86977144abbde2c01547111d412")}
    blocked={"oa-palantir-2":"原题要求实时查询外部 HackerRank JSON API，返回结果依赖外部服务且没有可复现的站内输入协议；原始 C++ 参考实现也明确是需要外部库的伪代码占位。未擅自替换为静态国家数据或 mock API。",
             "oa-palantir-4":"已核对原始 fastprep 题源；Constraints 只有损坏占位符“🍉🍉”，没有 N/M、节点编号或边权范围，无法确认图规模及负权等关键边界。样例不足以补全，故暂缓。"}
    for pid,(raw,blob) in source_evidence.items():
        src=SOURCE[pid]
        item={"id":pid,"catalogContentHash":src["contentHash"],"sourceUrl":src["sourceUrl"],"status":"authored" if pid in {x["id"] for x in specs} else "blocked","reason":"原题规则明确；本站标准输入输出协议及限制已写入题面，并完成独立 oracle 与错误程序离线验证。" if pid in {x["id"] for x in specs} else blocked[pid],"path":raw,"gitBlobSha":blob}
        evidence.append(item)
    for spec in specs:
        pid=spec["id"]; src=SOURCE[pid]; code=spec["reference"].lstrip()
        (OUT/"references"/f"{pid}.py").write_text(code)
        seed=SEED+int(pid.rsplit("-",1)[1]); rng=random.Random(seed)
        values=spec["samples"]+[spec["random"](rng) for _ in range(160)]
        oracle=[]
        for value in values:
            expected=spec["oracle"](value); actual=run(OUT/"references"/f"{pid}.py",spec["encode"](value))
            assert actual==expected,(pid,value,expected,actual)
            oracle.append({"input":spec["encode"](value),"expectedOutput":expected+"\n"})
        cases=[{"name":f"公开样例 {i+1}",**oracle[i],"hidden":False,"weight":1} for i in range(3)]
        cases += [{"name":f"随机隐藏样例 {i+1}",**oracle[i+3],"hidden":True,"weight":1} for i in range(30)]
        long_value=spec["long"][0]
        long_expected=(largest_reference(long_value) if pid=="oa-palantir-1"
                       else words_reference(long_value))
        long_case={"name":"最大长度边界","input":spec["encode"](long_value),"expectedOutput":long_expected+"\n","hidden":True,"weight":1}
        assert run(OUT/"references"/f"{pid}.py",long_case["input"])==long_expected
        cases.append(long_case)
        mutants=[]; controls=[]
        for index,(name,code_variant) in enumerate(spec["mutants"],1):
            control=OUT/"negative-controls"/f"{pid}-{index}.py"; control.write_text(code_variant)
            rejected=[i for i,c in enumerate(cases) if run(control,c["input"])!=c["expectedOutput"].rstrip("\n")]
            assert rejected,(pid,name,"mutant survived")
            mutants.append({"name":name,"code":code_variant}); controls.append({"name":name,"rejectedByCases":rejected})
        problem={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"简单","tags":["OA","Palantir"]+spec["tags"],"description":spec["description"]+"\n\n输入输出协议为本站整理，不代表原题给定标准输入输出。","input":spec["input"],"output":spec["output"],"explanation":"思路、正确性证明和复杂度见配套题解。","hints":["先区分可以交换或修改的对象，再观察局部操作对整体结果的影响。"],"timeLimit":3,"memoryLimit":262144,"outputLimit":4096,"checker":"exact","languages":["python","go","java","cpp"]}
        package_raw={"schemaVersion":1,"problem":problem,"cases":cases}
        normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
        result=subprocess.run(["node","--import","tsx","-e",normalize],cwd=ROOT,input=json.dumps(package_raw,ensure_ascii=False),text=True,capture_output=True)
        if result.returncode: raise RuntimeError(result.stderr)
        normalized=result.stdout; package=json.loads(normalized); editorial={"schemaVersion":1,"id":pid,"title":spec["title"],"explanation":spec["editorial"],"solutions":[{"language":"python","code":code}],"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"]}
        for folder,data in (("packages",package),("oracles",oracle),("mutants",mutants),("editorials",editorial)):
            (OUT/folder/f"{pid}.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
        checksum=hashlib.sha256(normalized.encode()).hexdigest()
        manifest.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":checksum,"editorial":spec["editorial"],"authoredSolutions":[{"language":"python","code":code}]})
        reports.append({"id":pid,"oracleCases":len(oracle),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":controls,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
        review_items.append({"id":pid,"status":"authored","reason":f"已核对 {COMMIT[:7]} 原始 fastprep 题源；本站输入协议已在题面明示。163 个独立 oracle 输入、最大长度边界与两个正常退出错误程序通过离线验证；未做 GoJudge 验证。","sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"sourceCommit":COMMIT,"rawPath":source_evidence[pid][0],"rawGitBlob":source_evidence[pid][1],"catalogContentHash":src["contentHash"]})
        print(f"{pid}: {len(oracle)} oracle cases, {len(cases)} formal cases, {len(controls)} mutants rejected",flush=True)
    (OUT/"candidate-batches/palantir-next.json").write_text(json.dumps({"schemaVersion":1,"items":manifest},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation/palantir-next.json").write_text(json.dumps({"schemaVersion":1,"seed":SEED,"problems":reports,"note":"Offline authored-code/oracle/mutant validation only; not tested against GoJudge."},ensure_ascii=False,indent=2)+"\n")
    review_items += [{"id":pid,"status":"blocked","reason":reason,"catalogContentHash":SOURCE[pid]["contentHash"]} for pid,reason in blocked.items()]
    review_items.sort(key=lambda x:int(x["id"].rsplit("-",1)[1]))
    (OUT/"reviews/palantir-next.json").write_text(json.dumps({"schemaVersion":1,"items":review_items},ensure_ascii=False,indent=2)+"\n")
    (OUT/"source-evidence/palantir-next.json").write_text(json.dumps({"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":COMMIT,"reason":"Verified immutable raw statements; no upstream solution code executed.","items":evidence},ensure_ascii=False,indent=2)+"\n")


if __name__=="__main__": main()
