from pathlib import Path
import hashlib,json,random,subprocess,textwrap
ROOT=Path(__file__).resolve().parents[3]; OA=ROOT/"content/oa-judge"
CAT=json.loads((ROOT/"content/oa-master/catalog.json").read_text())
SRC=CAT["source"]; ITEMS={x["id"]:x for x in CAT["items"]}
PID="oa-sig-2"; batch="trading-platform-candidates"; seed=20261005
src=ITEMS[PID]
code='''def solve(raw):
 s=raw.strip();v=s.count("U")-s.count("D")
 return "U" if v>0 else "D" if v<0 else ""
if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
'''
def oracle(s):
 p=0
 for c in s:p+=1 if c=="U" else -1
 return "U" if p>0 else "D" if p<0 else ""
samples=["UUDDUU","UD","DDU"]
values=samples[:]
for i in range(1,11):
 for j in range(1,11):
  s="U"*i+"D"*j
  if s not in values:values.append(s)
r=random.Random(seed)
while len(values)<120:
 s="".join(r.choice("UD") for _ in range(r.randint(1,80)))
 if s not in values:values.append(s)
inputs=[s+"\n" for s in values]
runner="import json,sys\nd=json.load(sys.stdin);g={'__name__':'candidate'};exec(d['code'],g);print(json.dumps([g['solve'](x) for x in d['inputs']]))\n"
def run(c,ins):
 p=subprocess.run(["python3","-I","-c",runner],input=json.dumps({"code":c,"inputs":ins}),text=True,capture_output=True,check=True,timeout=20)
 return json.loads(p.stdout)
wants=[oracle(x) for x in values]
assert run(code,inputs)==wants
cases=[{"name":("公开样例 " if i<3 else "隐藏测试 ")+str(i+1 if i<3 else i-2),"input":inputs[i],"expectedOutput":wants[i]+"\n","hidden":i>=3,"weight":1} for i in range(30)]
bad1=code.replace('s.count("U")-s.count("D")','s.count("D")-s.count("U")')
bad2=code.replace('else ""','else "U"')
mutants=[];killed=[]
for name,bad in [("上下方向颠倒",bad1),("零位移误判",bad2)]:
 answers=run(bad,[c["input"] for c in cases]);rejected=[i for i,(a,c) in enumerate(zip(answers,cases)) if a!=c["expectedOutput"].rstrip("\n")]
 assert rejected
 mutants.append({"name":name,"code":bad});killed.append({"name":name,"rejectedByCases":rejected})
problem={"id":PID,"courseId":"gomall","lessonId":"00-overview","title":"机器人竖直移动终点方向","difficulty":"简单","tags":["OA","SIG","模拟"],"description":"机器人从竖直线起点出发，U 向上一步，D 向下一步。判断处理完所有命令后相对起点的位置。题意来自 OAMaster 固定快照；本站补充标准输入输出协议。","input":"一行由至少一个 U 或 D 字符组成。","output":"终点在起点上方输出 U，下方输出 D，恰在起点输出空串。","explanation":"统计 U 与 D 的净位移。","hints":["把每个 U 记为 +1、D 记为 -1。"],"timeLimit":1,"memoryLimit":65536,"outputLimit":1024,"checker":"exact","languages":["python","go","java","cpp"]}
raw={"schemaVersion":1,"problem":problem,"cases":cases}
normjs="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
norm=subprocess.run(["node","--import","tsx","-e",normjs],cwd=Path("/Users/capsfly/Desktop/cswork/platform"),input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True)
if norm.returncode:raise RuntimeError(norm.stderr)
pkg=json.loads(norm.stdout);canonical=json.dumps(pkg,ensure_ascii=False,separators=(",",":"))
editorial="## 思路\n\n统计 U 与 D 的净位移。\n\n## 正确性证明\n\n每个 U 贡献 +1、每个 D 贡献 −1；净和符号唯一决定最终相对位置。\n\n## 复杂度\n\n时间 O(n)，空间 O(1)。\n\n## 来源说明\n\n依据 OAMaster 固定题面；本站另行定义标准输入输出协议。"
ed={"schemaVersion":1,"id":PID,"title":problem["title"],"explanation":editorial,"solutions":[{"language":"python","code":code}],"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"],"author":"CSWork"}
for d in ["packages","references","oracles","mutants","editorials","candidate-batches","validation","reviews","source-evidence"]:(OA/d).mkdir(parents=True,exist_ok=True)
(OA/"packages"/(PID+".json")).write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+"\n")
(OA/"references"/(PID+".py")).write_text(code)
ref_path=OA/"references"/(PID+".py")
for case in cases:
 cli=subprocess.run(["python3","-I",str(ref_path)],input=case["input"],text=True,capture_output=True,timeout=5)
 assert cli.returncode==0 and cli.stdout==case["expectedOutput"],(case["name"],cli.returncode,cli.stdout,cli.stderr)
oracle_rows=[{"input":x,"expectedOutput":y+"\n"} for x,y in zip(inputs,wants)]
(OA/"oracles"/(PID+".json")).write_text(json.dumps(oracle_rows,ensure_ascii=False,indent=2)+"\n")
(OA/"mutants"/(PID+".json")).write_text(json.dumps(mutants,ensure_ascii=False,indent=2)+"\n")
(OA/"editorials"/(PID+".json")).write_text(json.dumps(ed,ensure_ascii=False,indent=2)+"\n")
entry={"id":PID,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(canonical.encode()).hexdigest(),"editorial":editorial,"authoredSolutions":[{"language":"python","code":code}]}
(OA/"candidate-batches"/(batch+".json")).write_text(json.dumps({"schemaVersion":1,"items":[entry]},ensure_ascii=False,indent=2)+"\n")
(OA/"validation"/(batch+".json")).write_text(json.dumps({"schemaVersion":1,"seed":seed,"problems":[{"id":PID,"oracleCases":120,"uniqueOracleInputs":len(set(inputs)),"referenceCliCases":len(cases),"referenceSha256":hashlib.sha256(code.encode()).hexdigest(),"publicCases":3,"hiddenCases":27,"negativeControls":killed}],"note":"Local-only validation, including execution of the saved reference through stdin/stdout; no GoJudge sandbox report."},ensure_ascii=False,indent=2)+"\n")
authored={"id":PID,"status":"authored","reason":"已核对固定 OAMaster 题面；120 个独立 oracle 输入与两个正常退出 mutant 通过本地比对。尚未运行 GoJudge。","sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"catalogContentHash":src["contentHash"]}
blocked=[]
reasons={
"oa-flexport-1":"long integer 未规定取模，答案可超过 64 位。",
"oa-flexport-2":"没有说明越过数轴边界的子序列如何处理。",
"oa-flexport-3":"源题明确约束未知，数字串长度无上界。",
"oa-flexport-4":"最大边数问题的添加后连通/特殊员工限制难由现有样例唯一确认。",
"oa-tradedesk-1":"多阶段状态 API 没有调用序列及返回值的标准序列化协议。",
"oa-tradedesk-2":"关键原始图缺失，输出“sections”的计数单位不明。",
"oa-tradedesk-3":"收益公式与窗口操作依赖缺失原图，文字不足以确定。",
"oa-tradedesk-6":"样例文字对匹配对阈值的解释互相矛盾。",
"oa-tradedesk-8":"示例 Dooddle、Pepper、unsuccessfully 均不含三个连续相同字母，但输出为 3。",
"oa-weride-2":"没有定义对相同值位置差的聚合方式。",
"oa-weride-3":"最短路返回距离还是路径未定义。",
"oa-weride-6":"distinct pairs 未说明有序/无序，亦无输入规模约束。",
"oa-weride-7":"原题约束未知，示例终点描述与函数定义不一致。",
"oa-weride-8":"可重排演讲的时长、顺序、时间窗规则缺失。",
"oa-optiver-1":"可行日程不唯一，未给唯一优化目标或校验规则。",
"oa-optiver-2":"服务台数量及同一时刻到达的处理方式未由源题完整定义。",
"oa-optiver-4":"out-of-order 后最近一小时的时间基准有歧义。",
"oa-imc-1":"未定义无容器能满足订单时的返回行为。",
"oa-imc-3":"样例 size/direction 长度不一致，且约束标为未知。",
"oa-imc-4":"样例/规则未能确定路径经过障碍时距离的定义。",
"oa-imc-5":"规则写严格小于 K，样例却接受和等于 K。",
"oa-sig-1":"未完整定义收益与余额约束。",
"oa-sig-3":"wildcard 能否复用骨架字符不明。",
"oa-sig-5":"题面要求长度为 8 的倍数，示例却给 15 位并要求补零。",
"oa-sig-6":"固定行宽与公开样例长度冲突，含空格的 word 定义也不完整。",
"oa-sig-7":"集合是问答题而非单一程序题，无法定义统一 I/O。",
"oa-valkyrie-trading-1":"样例空格像素的含义和无解时坐标未定义。",
"oa-valkyrie-trading-2":"BST 插入值范围及重复值处理缺少可复现协议。",
"oa-valkyrie-trading-3":"重复最大值时返回哪个下标未定义。"
}
for x in CAT["items"]:
 if x["companySlug"] not in {"flexport","tradedesk","weride","optiver","imc","sig","valkyrie-trading"} or x["id"]==PID:continue
 if x["id"] not in reasons:continue
 reason=reasons[x["id"]]
 blocked.append({"id":x["id"],"status":"blocked","reason":reason,"sourceUrls":[x["sourceUrl"]],"sourceContentHashes":[x["contentHash"]],"catalogContentHash":x["contentHash"]})
reviews={"schemaVersion":1,"items":[authored]+blocked}
(OA/"reviews"/(batch+".json")).write_text(json.dumps(reviews,ensure_ascii=False,indent=2)+"\n")
evidence={"schemaVersion":1,"upstreamCommit":SRC["commit"],"upstreamRepository":SRC["repository"],"origin":SRC["origin"],"catalogFingerprints":{x["id"]:x["contentHash"] for x in [src]+[z for z in CAT["items"] if z["id"] in {b["id"] for b in blocked}]},"candidateBatch":batch,"decisions":{x["id"]:x["reason"] for x in blocked},"note":"Fingerprint hashes are taken from contentHash in the immutable repository catalog snapshot; this candidate is not in formal batches or registry."}
(OA/"source-evidence"/(batch+".json")).write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n")
print("candidate=1 blocked="+str(len(blocked)))
