"""Build offline-only BlackRock OA candidates; never touches the runtime registry."""
from pathlib import Path
import hashlib, json, random, subprocess, sys

ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/"content/oa-judge"
CAT=json.loads((ROOT/"content/oa-master/catalog.json").read_text())
SRC={x["id"]:x for x in CAT["items"]}; COMMIT=CAT["source"]["commit"]; SEED=20261005

ROAD='''import sys\ndef solve(raw):\n ds=[]\n for x in raw.strip().split(";"):\n  if x.strip(): ds.append(int(x.rsplit(",",1)[1].strip()))\n ds.sort()\n return ", ".join(str(ds[0] if i==0 else ds[i]-ds[i-1]) for i in range(len(ds)))\nif __name__=="__main__": print(solve(sys.stdin.read()))\n'''
HAPPY='''import sys\ndef solve(n):\n seen=set()\n while n!=1 and n not in seen:\n  seen.add(n); s=0\n  while n: n,d=divmod(n,10); s+=d*d\n  n=s\n return "1" if n==1 else "0"\nif __name__=="__main__": print(solve(int(sys.stdin.read())))\n'''

def run(path,data):
    return subprocess.run([sys.executable,"-I",str(path)],input=data,text=True,capture_output=True,timeout=15,check=True).stdout.rstrip("\n")
def road_enc(cities): return "; ".join(f"{name}, {distance}" for name,distance in cities)+";\n"
def road_oracle(cities):
    points=sorted([0]+[d for _,d in cities])
    return ", ".join(str(points[i+1]-points[i]) for i in range(len(points)-1))
def happy_oracle(n):
    seen=[]
    while n!=1 and n not in seen:
        seen.append(n); n=sum(int(d)**2 for d in str(n))
    return "1" if n==1 else "0"

ROAD_MUTANTS=[
 ("按输入顺序而不是距离排序", ROAD.replace('ds.sort()','pass')),
 ("遗漏起点到首站的路段", ROAD.replace('return ", ".join(str(ds[0] if i==0 else ds[i]-ds[i-1]) for i in range(len(ds)))','return ", ".join(str(ds[i]-ds[i-1]) for i in range(1,len(ds)))')),
]
HAPPY_MUTANTS=[
 ("误用各位数字和而不是平方和", HAPPY.replace('s+=d*d','s+=d')),
 ("只判断一次变换是否为 1", HAPPY.replace(' seen=set()\n while n!=1 and n not in seen:\n  seen.add(n); s=0\n  while n: n,d=divmod(n,10); s+=d*d\n  n=s\n return "1" if n==1 else "0"',' s=sum(int(d)**2 for d in str(n))\n return "1" if s==1 else "0"')),
]

SPECS=[
 {"id":"oa-blackrock-1","title":"Road Trip","description":"给出沿直线路线各城市加油站距起点的距离，输出从起点到第一站、再到后续各相邻站之间的路程。","input":"一行包含 1..5000 个 `城市名, 距离` 项，项间以分号分隔，可有末尾分号。城市名非空且不含逗号/分号；距离为 0..1000000000 的整数。","output":"按距起点升序排列后，输出起点至首站及相邻站间距，以英文逗号和空格分隔；同位置的站间距为 0。","samples":[[("Rkbs",5453),("Wdqiz",1245),("Rwds",3890),("Ujma",5589),("Tbzmo",1303)],[("Near",0)],[("Far",1000000000),("Other",1000000000),("Middle",500000000)]],"encode":road_enc,"oracle":road_oracle,"code":ROAD,"mutants":ROAD_MUTANTS,"random":lambda r:[(f"C{r.randrange(1000)}",r.randint(0,10**9)) for _ in range(r.randint(1,30))],"boundary":[(f"C{i}",i*200000) for i in range(5000)],"tags":["排序","模拟"],"editorial":"## 思路\n\n将加油站距离升序排序。第一段是最近站点到起点的距离，之后每段等于相邻距离之差。\n\n## 正确性\n\n一维路线沿选定方向延伸，距起点排序即为沿途顺序。把起点视为坐标 0，所有相邻路段恰为排序后相邻坐标差，因此算法输出唯一正确的路段长度；重复距离对应长度 0。\n\n## 复杂度\n\n排序 O(n log n)，空间 O(n)。"},
 {"id":"oa-blackrock-5","title":"Happy Number","description":"给定正整数 n，反复将其替换为各位数字的平方和。若过程到达 1 则输出快乐数标记；若进入不含 1 的循环则输出非快乐数标记。","input":"输入一个整数 n，1≤n≤2147483647。","output":"快乐数输出 1，否则输出 0。","samples":[19,2,11],"encode":lambda n:f"{n}\n","oracle":happy_oracle,"code":HAPPY,"mutants":HAPPY_MUTANTS,"random":lambda r:r.randint(1,2147483647),"boundary":2147483647,"tags":["数学","哈希表"],"editorial":"## 思路\n\n模拟数字平方和变换，并用集合保存访问过的数字。到达 1 时答案为 1；若某个非 1 状态重复，则之后必重复同一循环，答案为 0。\n\n## 正确性\n\n变换是确定性的，重复状态意味着未来状态序列完全重复且不包含 1。另一方面，若到达 1 即符合快乐数定义。正整数序列最终到达 1 或重复状态，集合检测恰好区分这两种情形。\n\n## 复杂度\n\n若变换 k 次、数字有 d 位，则时间 O(kd)，空间 O(k)。"},
]

def main():
    dirs=("packages","editorials","references","oracles","mutants","negative-controls","candidate-batches","validation","reviews","source-evidence")
    for d in dirs:(OUT/d).mkdir(parents=True,exist_ok=True)
    raw={"oa-blackrock-1":("fastprep/Blackrock/blackrock-calculate-distance.md","16e794ff1b4ff9336cda562af41d66c53683d227"),"oa-blackrock-2":("fastprep/Blackrock/blackrock-corporate-ladder.md","bc562cae103ead1390af907c227c462952c21dd5"),"oa-blackrock-3":("fastprep/Blackrock/blackrock-count-levels.md","380372718c039f685e431a99b9169eead386b1a6"),"oa-blackrock-4":("fastprep/Blackrock/blackrock-efficient-matching.md","f5a69aabcdccca6a0b1960877014ab8414ae52ee"),"oa-blackrock-5":("fastprep/Blackrock/blackrock-is-happy-number.md","a1cd1e9f67d76b844cba48f05be17d3a0e46eb87")}
    blocked={"oa-blackrock-2":"跨分支层级语义与来源样例冲突：Ben 与 Jon 在完整树中最短路径为 4，但原例输出 0；无法判断仅计祖先链还是任意树路径。","oa-blackrock-3":"原题只用直系上下级例子，却提示可能位于组织不同部分，没有定义跨分支答案；Constraints 为 N/A，无法确定路径/层级语义。","oa-blackrock-4":"“alpha-numeric sort”没有定义混合数字/字母 token 的排序规则，约束也缺失；单个样例无法区分 ASCII 字典序与自然排序等解释。"}
    authored={s["id"] for s in SPECS}; reviews=[]; evid=[]
    for pid,(path,blob) in raw.items():
        src=SRC[pid]; status="authored" if pid in authored else "blocked"; reason="原始规则明确；本站输入协议及缺失边界的显式补充已写入题面，163 个 oracle 与两个正常退出 mutant 离线通过。" if pid in authored else blocked[pid]
        reviews.append({"id":pid,"status":status,"reason":reason,"catalogContentHash":src["contentHash"],"sourceUrl":src["sourceUrl"],"sourceCommit":COMMIT,"rawPath":path,"rawGitBlob":blob})
        evid.append({"id":pid,"status":status,"reason":reason,"catalogContentHash":src["contentHash"],"sourceUrl":src["sourceUrl"],"path":path,"gitBlobSha":blob})
    manifest=[]; reports=[]
    for spec in SPECS:
        pid=spec["id"]; src=SRC[pid]; code=spec["code"].lstrip(); ref=OUT/"references"/f"{pid}.py"; ref.write_text(code)
        rng=random.Random(SEED+int(pid.rsplit("-",1)[1])); values=spec["samples"]+[spec["random"](rng) for _ in range(160)]; oracle=[]
        for val in values:
            expect=spec["oracle"](val); actual=run(ref,spec["encode"](val)); assert actual==expect,(pid,val,expect,actual)
            oracle.append({"input":spec["encode"](val),"expectedOutput":expect+"\n"})
        cases=[{"name":f"公开样例 {i+1}",**oracle[i],"hidden":False,"weight":1} for i in range(3)]
        cases += [{"name":f"随机隐藏测试 {i+1}",**oracle[i+3],"hidden":True,"weight":1} for i in range(30)]
        val=spec["boundary"]
        if pid=="oa-blackrock-1":
            expected=road_oracle(val); inp=road_enc(val)
        else: expected=happy_oracle(val); inp=spec["encode"](val)
        assert run(ref,inp)==expected,(pid,"boundary")
        cases.append({"name":"规模/数值边界","input":inp,"expectedOutput":expected+"\n","hidden":True,"weight":1})
        mutants=[]; controls=[]
        for i,(name,mutant) in enumerate(spec["mutants"],1):
            f=OUT/"negative-controls"/f"{pid}-{i}.py";f.write_text(mutant)
            killed=[j for j,c in enumerate(cases) if run(f,c["input"])!=c["expectedOutput"].rstrip("\n")]
            assert killed,(pid,name,"survived")
            mutants.append({"name":name,"code":mutant});controls.append({"name":name,"rejectedByCases":killed})
        problem={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"简单","tags":["OA","BlackRock"]+spec["tags"],"description":spec["description"]+"\n\n输入协议为本站整理；Road Trip 的数量和距离范围为本站明确补充，不代表原题原有限制。","input":spec["input"],"output":spec["output"],"explanation":"思路、正确性证明和复杂度见配套题解。","hints":["先将文字规则转为明确状态，再独立验证边界。"],"timeLimit":3,"memoryLimit":262144,"outputLimit":65536 if pid=="oa-blackrock-1" else 4096,"checker":"exact","languages":["python","go","java","cpp"]}
        script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
        p=subprocess.run(["node","--import","tsx","-e",script],cwd=ROOT,input=json.dumps({"schemaVersion":1,"problem":problem,"cases":cases},ensure_ascii=False),text=True,capture_output=True)
        if p.returncode:raise RuntimeError(p.stderr)
        normalized=p.stdout;package=json.loads(normalized);editorial={"schemaVersion":1,"id":pid,"title":spec["title"],"explanation":spec["editorial"],"solutions":[{"language":"python","code":code}],"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"]}
        for folder,obj in (("packages",package),("oracles",oracle),("mutants",mutants),("editorials",editorial)):(OUT/folder/f"{pid}.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
        manifest.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":spec["editorial"],"authoredSolutions":[{"language":"python","code":code}]})
        reports.append({"id":pid,"oracleCases":len(oracle),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":controls,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
        print(f"{pid}: {len(oracle)} oracle inputs; {len(cases)} formal cases; 2 mutants rejected",flush=True)
    (OUT/"candidate-batches/blackrock-next.json").write_text(json.dumps({"schemaVersion":1,"items":manifest},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation/blackrock-next.json").write_text(json.dumps({"schemaVersion":1,"seed":SEED,"problems":reports,"note":"Offline authored-code/oracle/mutant validation only; not tested against GoJudge."},ensure_ascii=False,indent=2)+"\n")
    (OUT/"reviews/blackrock-next.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
    (OUT/"source-evidence/blackrock-next.json").write_text(json.dumps({"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":COMMIT,"reason":"Read-only verification of immutable raw statements; no upstream solution code executed.","items":evid},ensure_ascii=False,indent=2)+"\n")

if __name__=="__main__":main()
