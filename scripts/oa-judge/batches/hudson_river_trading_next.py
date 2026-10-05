"""Create candidate-only Hudson River Trading judge content with local evidence."""
from functools import lru_cache
from pathlib import Path
import hashlib, json, random, subprocess, sys, textwrap

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/"content/oa-judge"
UP=Path("/tmp/oa-master-readonly")
UPSHA="e66f809f4c953bce129f68491726176615db6afc"
CAT=json.loads((ROOT/"content/oa-master/catalog.json").read_text())
SRC={x["id"]:x for x in CAT["items"]}
RUN="\nif __name__ == '__main__':\n import sys\n print(solve(sys.stdin.read()))\n"

def run(path,data):
 r=subprocess.run([sys.executable,"-I",str(path)],input=data,text=True,capture_output=True,timeout=15,check=True)
 return r.stdout.rstrip("\n")
def normalize(doc):
 js="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 return subprocess.run(["node","--import","tsx","-e",js],cwd=ROOT,input=json.dumps(doc,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
def add(i,title,tags,samples,rand,edges,desc,inp,out,idea,proof,complexity,code,mutants,oracle,encode,notes=""):
 SPECS.append(dict(id=f"oa-hudson-river-trading-{i}",title=title,tags=tags,samples=samples,rand=rand,edges=edges,desc=desc,inp=inp,out=out,idea=idea,proof=proof,complexity=complexity,code=code,mutants=mutants,oracle=oracle,encode=encode,notes=notes))
SPECS=[]

# 1. Integer-to-string; the built-in prohibition is a coding constraint, not output semantics.
def int_enc(v): return "\n".join(map(str,v))+"\n"
def int_oracle(v): return "\n".join(str(x) for x in v)
def int_rand(r): return [r.randint(-100000,100000) for _ in range(r.randint(1,15))]
intcode="""def digits(n):
 if n==0: return "0"
 neg=n<0; x=-n if neg else n; out=[]
 while x:
  out.append(chr(ord('0')+x%10)); x//=10
 if neg: out.append('-')
 return ''.join(reversed(out))
def solve(raw):
 return "\\n".join(digits(int(line)) for line in raw.splitlines() if line.strip())
"""
intbadneg="""def digits(n):
 if n==0: return "0"
 x=abs(n); out=[]
 while x: out.append(chr(48+x%10)); x//=10
 return ''.join(reversed(out))
def solve(raw): return "\\n".join(digits(int(x)) for x in raw.splitlines() if x.strip())
"""
intbadzero="""def digits(n):
 if n==0: return ""
 neg=n<0; x=-n if neg else n; out=[]
 while x: out.append(chr(48+x%10)); x//=10
 if neg: out.append('-')
 return ''.join(reversed(out))
def solve(raw): return "\\n".join(digits(int(x)) for x in raw.splitlines() if x.strip())
"""
add(1,"整数转十进制字符串",["字符串","数学"],[
[0,42,-17,2147483647,-2147483648],[0],[-1000000000,1000000000]],int_rand,
[([-(2**31),2**31-1],None)],
"实现整数到十进制字符串的转换，不使用内置数字转字符串函数。输入中的每个有符号 32 位整数各输出一行；负数保留负号，0 输出 0。",
"每行一个有符号 32 位整数；1..100000 行。输入末行可有或没有换行符。","每个输入整数对应一行十进制表示。",
"反复取绝对值的个位并除以 10，倒序拼接，最后按需补负号。0 单独处理。为覆盖 INT_MIN，使用不溢出的整数表示。",
"每步取模恰得当前十进制最低位，整除 10 删除该位；全部位倒序后恢复原顺序和符号，因此所得字符与十进制表示逐位相同。",
"设总十进制位数为 D，时间 O(D)，除输出外空间 O(D)。",intcode,
[("负数漏掉负号",intbadneg),("零转换为空串",intbadzero)],int_oracle,int_enc,
notes="上游原题限制 built-in conversion helper；本站判题只能验证输出，不能静态证明选手未调用内置转换函数。")

# 2. Signals are formed by nonzero price changes; source example requires flats to be skipped, not reset the run.
def stock_enc(v):
 p,b,s=v; return f"{len(p)} {len(b)} {len(s)}\n"+" ".join(map(str,p))+"\n"+" ".join(map(str,b))+"\n"+" ".join(map(str,s))+"\n"
def stock_oracle(v):
 prices,buy,sell=v; events=[0]*len(prices); signs=[]
 for i in range(1,len(prices)):
  if prices[i]!=prices[i-1]: signs.append((1 if prices[i]>prices[i-1] else -1,i))
 for j,(x,idx) in enumerate(signs):
  if len(signs[:j+1])>=len(buy) and [z for z,_ in signs[j-len(buy)+1:j+1]]==buy: events[idx]+=1
  if len(signs[:j+1])>=len(sell) and [z for z,_ in signs[j-len(sell)+1:j+1]]==sell: events[idx]-=1
 out=[]; pos=0
 for delta in events: pos+=delta; out.append(str(pos))
 return " ".join(out)
def stock_rand(r):
 n=r.randint(1,18); p=[r.randint(0,30) for _ in range(n)]
 return p,[r.choice([-1,1]) for _ in range(r.randint(1,5))],[r.choice([-1,1]) for _ in range(r.randint(1,5))]
stockcode="""def kmp_events(signs, pattern, delta, amount):
 m=len(pattern); pi=[0]*m
 for i in range(1,m):
  j=pi[i-1]
  while j and pattern[i]!=pattern[j]: j=pi[j-1]
  if pattern[i]==pattern[j]: j+=1
  pi[i]=j
 j=0
 for sign,price_index in signs:
  while j and sign!=pattern[j]: j=pi[j-1]
  if sign==pattern[j]: j+=1
  if j==m: delta[price_index]+=amount; j=pi[j-1]
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); b=next(it); s=next(it)
 p=[next(it) for _ in range(n)]; buy=[next(it) for _ in range(b)]; sell=[next(it) for _ in range(s)]
 signs=[(1 if p[i]>p[i-1] else -1,i) for i in range(1,n) if p[i]!=p[i-1]]
 delta=[0]*n; kmp_events(signs,buy,delta,1)
 kmp_events(signs,sell,delta,-1)
 pos=0; out=[]
 for x in delta: pos+=x; out.append(str(pos))
 return " ".join(out)
"""
stockzero="""def match(a,p):
 return len(a)>=len(p) and a[-len(p):]==p
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); b=next(it); s=next(it)
 prices=[next(it) for _ in range(n)]; buy=[next(it) for _ in range(b)]; sell=[next(it) for _ in range(s)]
 signs=[(1 if prices[i]>prices[i-1] else -1 if prices[i]<prices[i-1] else 0,i) for i in range(1,n)]
 stream=[]; delta=[0]*n
 for sign,idx in signs:
  stream.append(sign)
  if match(stream,buy): delta[idx]+=1
  if match(stream,sell): delta[idx]-=1
 pos=0; out=[]
 for d in delta: pos+=d; out.append(str(pos))
 return " ".join(out)
"""
stockshift="""def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); b=next(it); s=next(it)
 p=[next(it) for _ in range(n)]; buy=[next(it) for _ in range(b)]; sell=[next(it) for _ in range(s)]
 stream=[(1 if p[i]>p[i-1] else -1,i) for i in range(1,n) if p[i]!=p[i-1]]
 d=[0]*n
 for pat,sign in ((buy,1),(sell,-1)):
  for j in range(len(pat)-1,len(stream)):
   if [x for x,_ in stream[j-len(pat)+1:j+1]]==pat: d[min(stream[j][1]+1,n-1)]+=sign
 pos=0; out=[]
 for x in d: pos+=x; out.append(str(pos))
 return " ".join(out)
"""
stock_sample=([51,56,56,58,60,59,54,57,52,48],[1,1],[-1,-1,1])
add(2,"价格信号与持仓变化",["字符串","KMP","模拟"],[
stock_sample,([51,56,56,58,58],[1,1],[-1]),([1,3,2],[1,-1],[1,-1])],stock_rand,
[(([7]*200000,[1,1],[-1,-1,1]),None)],
"用价格变化信号更新持仓。上涨记 +1，下跌记 -1，相等价格不产生信号且不打断此前非零变化序列。每当最近的变化序列匹配 buyIndicator，持仓加 1；匹配 sellIndicator，持仓减 1。两种信号同一位置同时匹配时相互抵消。输出每个价格时刻结束后的持仓。",
"首行 n b s（1≤n≤200000，1≤b,s≤n）；接着 n 个非负价格（≤10^9）、b 个 +1/-1、s 个 +1/-1。","输出 n 个空格分隔的整数，初始持仓为 0。",
"对相邻价格变化生成非零方向流，并记录每个方向对应的原价格下标。分别用 KMP 匹配买入和卖出模式，将信号加到对应的价格下标，再前缀累加。",
"每个模式的 KMP 在非零方向流中恰在且仅在完整匹配结束时触发一次；记录的下标正是当前信号所对应的价格。将买卖增量相加并做前缀和，得到每个时刻所有已触发信号的净持仓。",
"时间 O(n+b+s)，空间 O(n+b+s)。",stockcode,
[("平价变化错误地打断方向序列",stockzero),("把信号增量延后一日",stockshift)],stock_oracle,stock_enc,
notes="原文示例 51,56,56,58 明确把两次上涨看作连续信号；平价既不触发信号，也不能重置非零变化序列。上游整理版 MDX 的 0 方向实现会与这个原始示例冲突，本站遵循原始规则和示例并记录该差异。")

# 3. Positive base-4 numbers with digits 0/1 below n.
def fancy_enc(n): return str(n)+"\n"
def fancy_oracle(n):
 stack=[1]; count=0
 while stack:
  x=stack.pop()
  if x<n:
   count+=1
   stack.append(x*4); stack.append(x*4+1)
 return str(count)
def fancy_rand(r): return r.randint(1,5000)
fancycode="""def solve(raw):
 n=int(raw.strip()); ds=[]
 while n: ds.append(n%4); n//=4
 ds=ds[::-1]; length=len(ds); ans=sum(2**(k-1) for k in range(1,length))
 if not ds: return "0"
 if ds[0]>1: return str(ans+2**(length-1))
 if ds[0]<1: return str(ans)
 for i in range(1,length):
  smaller=sum(x<ds[i] for x in (0,1))
  ans+=smaller*2**(length-i-1)
  if ds[i] not in (0,1): return str(ans)
 return str(ans)
"""
fancyinc="""def solve(raw):
 n=int(raw.strip()); stack=[1]; ans=0
 while stack:
  x=stack.pop()
  if x<=n: ans+=1; stack.extend((x*4,x*4+1))
 return str(ans)
"""
fancyall="""def solve(raw): return str(int(raw.strip())-1)
"""
add(3,"统计四进制只含 0 和 1 的正整数",["数位动态规划","进制"],[
1,10,17],lambda r:r.randint(1,5000),[(10**9,None)],
"正整数若其四进制表示只包含数字 0 和 1，则称为 fancy。给定 n，统计严格小于 n 的正 fancy 整数个数；0 不计入。",
"输入一个整数 n（1≤n≤10^9）。","输出满足条件的正整数个数。",
"将 n 转成四进制。先计入位数更短的所有合法正数，再从高位到低位统计当前位可选的更小合法数字组合；首位只能为 1。",
"位数更短的正 fancy 数有 2^(k-1) 个。固定相同长度后，首位只能是 1；遇到每位时先累计小于 n 当前数字的合法选择及其后缀组合数，若当前数字不是 0/1，后续前缀已不可能相等，可结束。故每个小于 n 的合法数恰计一次。",
"时间 O(log n)，空间 O(log n)。",fancycode,
[("把严格小于改成小于等于",fancyinc),("误把所有小于 n 的整数都计入",fancyall)],fancy_oracle,fancy_enc)

# Shared increasing-path graph primitives for distinct problem IDs.
def grid_enc(rows):
 return str(len(rows))+"\n"+"".join(str(len(row))+" "+" ".join(map(str,row))+"\n" for row in rows)
def grid_decode(raw):
 it=iter(map(int,raw.split())); r=next(it); rows=[]
 for _ in range(r):
  c=next(it); rows.append([next(it) for _ in range(c)])
 return rows
def path_oracle(rows):
 cells={(r,c):v for r,row in enumerate(rows) for c,v in enumerate(row)}
 @lru_cache(None)
 def from_cell(r,c):
  v=cells[(r,c)]; total=0
  for nr,nc in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
   if (nr,nc) in cells and cells[(nr,nc)]>v: total+=1+from_cell(nr,nc)
  return total
 return str(sum(from_cell(r,c) for r,c in cells))
def grid_rand(rng):
 r=rng.randint(1,4); return [[rng.randint(0,10) for _ in range(rng.randint(1,4))] for _ in range(r)]
def path_code(vertical=False):
 restriction=" and nc==c" if vertical else ""
 return """def solve(raw):
 rows=grid_decode(raw); cells={(r,c):v for r,row in enumerate(rows) for c,v in enumerate(row)}
 dp={}; total=0
 for (r,c),v in sorted(cells.items(),key=lambda x:x[1]):
  ways=1
  for nr,nc in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
   if (nr,nc) in cells and cells[(nr,nc)]<v"""+restriction+""": ways+=dp[(nr,nc)]
  dp[(r,c)]=ways; total+=ways-1
 return str(total)
"""
grid_helpers="def grid_decode(raw):\n it=iter(map(int,raw.split())); r=next(it); a=[]\n for _ in range(r):\n  c=next(it); a.append([next(it) for _ in range(c)])\n return a\n"

ragged=[[5],[1],[2,7]]
simple=[[1,2],[2]]
path_base=grid_helpers+path_code()
path_vertical=grid_helpers+path_code(True)
equal_grid=[[4]*15 for _ in range(15)]
def monotone_grid(): return [[r+c for c in range(15)] for r in range(15)]
add(5,"统计递增路径（路径数不超过 2000）",["图论","动态规划","网格"],[
ragged,[[9]],simple],grid_rand,[(equal_grid,None)],
"网格中一条路径由至少两个格子组成；相邻格子必须上下左右相邻，且每步数值严格增大。路径按格子位置序列区分。统计所有递增路径数；题目保证路径数不超过 2000。",
"第一行行数 R（1..15）；随后 R 行，每行先给列数 C_r（1..15），再给出该行 C_r 个整数（0..65535）。各行可不等长；仅存在的格子可相邻。",
"输出长度至少为 2 的严格递增路径总数。",
"将格子视为有向无环图，较小值指向相邻较大值。按值从小到大动态规划：以格子结束的路径数等于 1（单格）加所有较小邻居的路径数；最终减去所有单格路径。",
"严格递增使路径图无环，值升序保证每个格子处理前其所有较小邻居已完成。每条以当前格子结尾且长度至少 2 的路径，唯一来自一个较小邻居路径追加当前格子；因此递推完整且不重不漏。减去的每个单格正好对应一个不符合长度要求的路径。",
"设 V 为格子数、E≤4V。时间 O(V log V+E)，空间 O(V)。",path_base,
[("把单格路径也计入",grid_helpers+path_base.replace("total+=ways-1","total+=ways")),("忽略水平方向相邻格子",path_vertical)],
path_oracle,grid_enc,
notes="原始示例输出 4 符合邻接路径定义，但所列路径端点说明不准确：实际四条为 1→5、1→2、2→7、1→2→7。本站保留规则及答案，纠正说明并记录原解释错误。")

# Part 2 source sample is independently audited, but its expected count conflicts with its grid.
matrix15=[]
for r in range(15):
 row=list(range(r,r+15))
 if r==9: row=[11,10]+list(range(11,24))
 matrix15.append(row)
def path_bottomup(rows):
 cells={(r,c):v for r,row in enumerate(rows) for c,v in enumerate(row)}
 dp={}; total=0
 for (r,c),v in sorted(cells.items(),key=lambda item:item[1]):
  ways=1
  for nr,nc in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
   if (nr,nc) in cells and cells[(nr,nc)]<v: ways+=dp[(nr,nc)]
  dp[(r,c)]=ways; total+=ways-1
 return total
assert int(path_oracle(matrix15))==path_bottomup(matrix15)==600537344
assert path_bottomup(matrix15)!=601079908

BLOCKED={
"oa-hudson-river-trading-4":"Max Harvested Crops 原作者明确注明输入与例子可能不正确、等候补充资料；例子中的采集得分也缺乏完整权重定义，现有文字不足以确定路径和收获量。",
"oa-hudson-river-trading-6":"Increasing Paths part 2 的固定 15×15 样例按题目规定的上下左右相邻、严格递增和路径至少两格规则，由独立反向 DFS 与独立升序 DP 均计算为 600537344，与上游所列 601079908 冲突；不能伪造通过样例。",
"oa-hudson-river-trading-7":"Future Stock Prices 没有可复现样例或完整约束；多只股票在不同日期间如何转仓、同日是否可连续交易、日期与价格格式/精度均未定义，目录解法对各股票分别计算也无法解释共享的初始资金。"
}

def main():
 for folder in ("packages","editorials","references","oracles","mutants","negative-controls","reviews","candidate-batches","validation","source-evidence"):
  (OUT/folder).mkdir(parents=True,exist_ok=True)
 batch="hudson-river-trading-next"; entries=[]; reports=[]; reviews=[]; files=[]
 for path in subprocess.run(["git","-C",str(UP),"ls-tree","-r","--name-only",UPSHA,"fastprep/Hudson River Trading"],text=True,capture_output=True,check=True).stdout.splitlines():
  blob=subprocess.run(["git","-C",str(UP),"rev-parse",f"{UPSHA}:{path}"],text=True,capture_output=True,check=True).stdout.strip(); files.append({"path":path,"blobSha":blob})
 rawfiles=list(files)
 for path in subprocess.run(["git","-C",str(UP),"ls-tree","-r","--name-only",UPSHA,"OA LIST/Hudson River Trading"],text=True,capture_output=True,check=True).stdout.splitlines():
  blob=subprocess.run(["git","-C",str(UP),"rev-parse",f"{UPSHA}:{path}"],text=True,capture_output=True,check=True).stdout.strip(); rawfiles.append({"path":path,"blobSha":blob})
 page="web/content/docs/companies/hudson-river-trading.mdx"
 pageblob=subprocess.run(["git","-C",str(UP),"rev-parse",f"{UPSHA}:{page}"],text=True,capture_output=True,check=True).stdout.strip()
 for spec in SPECS:
  pid=spec["id"]; src=SRC[pid]; rng=random.Random(20261005+int(pid.rsplit("-",1)[1]))
  code=textwrap.dedent(spec["code"]).strip()+"\n"+RUN
  if pid.startswith("oa-hudson-river-trading-5") or pid.startswith("oa-hudson-river-trading-6"): code=grid_helpers+textwrap.dedent(spec["code"]).strip()+"\n"+RUN
  ref=OUT/"references"/(pid+".py"); ref.write_text(code)
  vals=spec["samples"]+[spec["rand"](rng) for _ in range(160)]; oracle_cases=[]
  for value in vals:
   data=spec["encode"](value); expected=spec["oracle"](value); actual=run(ref,data)
   assert actual==expected,(pid,value,expected,actual)
   oracle_cases.append({"input":data,"expectedOutput":expected+"\n"})
  if pid=="oa-hudson-river-trading-6": assert oracle_cases[0]["expectedOutput"].strip()=="601079908"
  edges=[]
  for value,expected in spec["edges"]:
   if expected is None: expected=spec["oracle"](value)
   data=spec["encode"](value); assert run(ref,data)==expected,(pid,"edge",expected,run(ref,data))
   edges.append({"input":data,"expectedOutput":expected+"\n"})
  tests=oracle_cases[:3]+edges+oracle_cases[3:27]
  cases=[{"name":f"公开样例 {i+1}" if i<3 else f"隐藏验证 {i-2}",**case,"hidden":i>=3,"weight":1} for i,case in enumerate(tests)]
  mutants=[]; kills=[]
  for k,(label,mut) in enumerate(spec["mutants"],1):
   full=textwrap.dedent(mut).strip()+"\n"+RUN
   if pid.startswith("oa-hudson-river-trading-5") or pid.startswith("oa-hudson-river-trading-6"): full=grid_helpers+textwrap.dedent(mut).strip()+"\n"+RUN
   control=OUT/"negative-controls"/f"{pid}-{k}.py"; control.write_text(full)
   rejected=[i for i,c in enumerate(cases) if run(control,c["input"])!=c["expectedOutput"].rstrip("\n")]
   assert rejected,(pid,"mutant survived",label)
   mutants.append({"name":label,"code":full}); kills.append({"name":label,"rejectedByCases":rejected})
  desc=spec["desc"]+"\n\n"+spec["notes"]+"\n\n本站的标准输入输出协议由 CSWork 明确补充，不代表上游函数题原有该协议。"
  problem={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"中等","tags":["OA","Hudson River Trading"]+spec["tags"],"description":desc,"input":spec["inp"],"output":spec["out"],"explanation":"按规则处理；思路、正确性证明与复杂度见配套题解。","hints":[spec["idea"]],"timeLimit":4,"memoryLimit":262144,"outputLimit":65536,"checker":"tokens","languages":["python","go","java","cpp"]}
  normalized=normalize({"schemaVersion":1,"problem":problem,"cases":cases}); pkg=json.loads(normalized)
  editorial_text=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}\n\n## 来源说明\n\n{spec['notes']}\n\n本站另行整理了标准输入输出协议；不声称原站提供该协议。"
  solutions=[{"language":"python","code":code}]
  editorial={"schemaVersion":1,"id":pid,"title":spec["title"],"explanation":editorial_text,"solutions":solutions,"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"],"author":"Chunyu Sui"}
  for folder,doc in (("packages",pkg),("editorials",editorial),("oracles",oracle_cases),("mutants",mutants)):
   (OUT/folder/(pid+".json")).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n")
  entries.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":editorial_text,"authoredSolutions":solutions})
  reports.append({"id":pid,"oracleCases":len(oracle_cases),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":kills,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
  reviews.append({"id":pid,"status":"authored","reason":"已核对不可变原始题源；规则可明确整理为标准输入输出。"+spec["notes"],"sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"catalogContentHash":src["contentHash"]})
  print(f"{pid}: {len(oracle_cases)} oracle cases, {len(cases)} test cases; all {len(mutants)} mutants killed",flush=True)
 for pid,reason in BLOCKED.items():
  src=SRC[pid]; reviews.append({"id":pid,"status":"blocked","reason":reason,"sourceUrls":[src["sourceUrl"]],"catalogContentHash":src["contentHash"]})
 reviews.sort(key=lambda x:int(x["id"].rsplit("-",1)[1]))
 (OUT/"candidate-batches"/(batch+".json")).write_text(json.dumps({"schemaVersion":1,"items":entries},ensure_ascii=False,indent=2)+"\n")
 (OUT/"validation"/(batch+".json")).write_text(json.dumps({"schemaVersion":1,"seed":20261005,"problems":reports,"note":"Local reference/oracle/mutant validation only. No GoJudge sandbox acceptance or production publication."},ensure_ascii=False,indent=2)+"\n")
 (OUT/"reviews"/(batch+".json")).write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
 source_doc={"schemaVersion":1,"upstreamCommit":UPSHA,"rawFiles":rawfiles,"companyPage":{"path":page,"blobSha":pageblob},"catalogFingerprints":{f"oa-hudson-river-trading-{i}":SRC[f"oa-hudson-river-trading-{i}"]["contentHash"] for i in range(1,8)},"candidateSourceById":{"oa-hudson-river-trading-1":"fastprep/Hudson River Trading/hudson-river-trading-integer-to-string.md","oa-hudson-river-trading-2":"fastprep/Hudson River Trading/hudsonriver-buy-sell-stock.md","oa-hudson-river-trading-3":"fastprep/Hudson River Trading/hudsonriver-count-fancy-numbers.md","oa-hudson-river-trading-5":"fastprep/Hudson River Trading/hudsonriver-increasing-paths-1.md"},"decisions":{"oa-hudson-river-trading-2":"Raw statement and example mean zero price changes emit no sign and do not reset the nonzero-sign run; this differs from the catalog MDX solution which inserts 0 and resets.","oa-hudson-river-trading-5":"Official count 4 is consistent with the adjacency rule; the prose list of paths is inaccurate. Candidate corrects the path enumeration rather than claiming those listed routes.","oa-hudson-river-trading-6":"For the exact upstream grid, reverse DFS and a separately implemented ascending-value DP both count 600537344, versus upstream output 601079908; blocked rather than inventing tests."}}
 (OUT/"source-evidence"/(batch+".json")).write_text(json.dumps(source_doc,ensure_ascii=False,indent=2)+"\n")

if __name__=="__main__": main()
