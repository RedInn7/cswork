"""Build source-reviewed Expedia candidates without touching the runtime registry."""
from collections import deque
from pathlib import Path
import hashlib, itertools, json, random, subprocess, sys

ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/"content/oa-judge"
CAT=json.loads((ROOT/"content/oa-master/catalog.json").read_text())
SRC={x["id"]:x for x in CAT["items"]}; COMMIT=CAT["source"]["commit"]; SEED=20261005

MINREF='''import sys\ndef solve(a,b):\n i=j=0\n while i<len(a) and j<len(b):\n  if a[i]==b[j]: i+=1\n  j+=1\n return str(len(a)-i)\nif __name__=="__main__":\n z=list(map(int,sys.stdin.buffer.read().split())); n=z[0]; print(solve(z[1:1+n],z[1+n:1+2*n]))\n'''
RANKREF='''import sys\ndef solve(n,m,p):\n pos=[[0]*m for _ in range(n)]\n for u,row in enumerate(p):\n  for k,s in enumerate(row): pos[u][s]=k\n wins=[0]*m\n for x in range(m):\n  for y in range(m):\n   if x==y: continue\n   v=sum(pos[u][x]<pos[u][y] for u in range(n))\n   if 2*v>n or (2*v==n and x<y): wins[x]+=1\n return " ".join(map(str,sorted(range(m),key=lambda s:(-wins[s],s))))\nif __name__=="__main__":\n z=list(map(int,sys.stdin.buffer.read().split())); n,m=z[:2]; p=[z[2+i*m:2+(i+1)*m] for i in range(n)]; print(solve(n,m,p))\n'''
BOTREF='''import sys\ndef solve(sx,sy,tx,ty):\n while tx>=sx and ty>=sy:\n  if tx==sx and ty==sy:return "Yes"\n  if tx>ty:\n   if ty==sy:return "Yes" if (tx-sx)%ty==0 else "No"\n   tx%=ty\n  else:\n   if tx==sx:return "Yes" if (ty-sy)%tx==0 else "No"\n   ty%=tx\n return "No"\nif __name__=="__main__": print(solve(*map(int,sys.stdin.buffer.read().split())))\n'''
EFFREF='''import sys\ndef solve(a):\n a=sorted(a); low=0-a[0]; best=None\n for j in range(1,len(a)):\n  best=max(best if best is not None else -10**30,(j-a[j])-low+1)\n  low=min(low,j-a[j])\n return str(best)\nif __name__=="__main__":\n z=list(map(int,sys.stdin.buffer.read().split())); print(solve(z[1:]))\n'''

def run(path,data):
 return subprocess.run([sys.executable,"-I",str(path)],input=data,text=True,capture_output=True,timeout=10,check=True).stdout.rstrip("\n")
def min_encode(v):
 a,b=v;return f"{len(a)}\n"+" ".join(map(str,a))+"\n"+" ".join(map(str,b))+"\n"
def min_oracle(v):
 a,b=v; q=deque([(tuple(a),0)]); seen={tuple(a)}
 while q:
  state,d=q.popleft()
  if state==tuple(b):return str(d)
  last=state[-1]; rest=state[:-1]
  for k in range(len(state)):
   nxt=rest[:k]+(last,)+rest[k:]
   if nxt not in seen:seen.add(nxt);q.append((nxt,d+1))
 raise AssertionError("all permutations reachable")
def rank_encode(v):
 n,m,p=v;return f"{n} {m}\n"+"\n".join(" ".join(map(str,row)) for row in p)+"\n"
def rank_oracle(v):
 n,m,p=v;beats=[0]*m
 for x in range(m):
  for y in range(m):
   if x!=y:
    votes=0
    for row in p:
     for ix,s in enumerate(row):
      if s==x: px=ix
      if s==y: py=ix
     votes += px<py
    beats[x] += 2*votes>n or (2*votes==n and x<y)
 return " ".join(map(str,sorted(range(m),key=lambda x:(-beats[x],x))))
def bot_encode(v):return " ".join(map(str,v))+"\n"
def bot_oracle(v):
 sx,sy,tx,ty=v; q=deque([(sx,sy)]); seen={(sx,sy)}
 while q:
  x,y=q.popleft()
  if (x,y)==(tx,ty):return "Yes"
  for nxt in ((x+y,y),(x,x+y)):
   if nxt[0]<=tx and nxt[1]<=ty and nxt not in seen:seen.add(nxt);q.append(nxt)
 return "No"
def eff_encode(a):return str(len(a))+"\n"+" ".join(map(str,a))+"\n"
def eff_oracle(a):
 b=sorted(a);return str(max(j-i+1-(b[j]-b[i]) for i in range(len(b)) for j in range(i+1,len(b))))

def gen_min(r):
 n=r.randint(1,7);a=list(range(1,n+1));b=a[:];r.shuffle(a);r.shuffle(b);return a,b
def gen_rank(r):
 m=r.randint(1,7);n=r.randint(1,8);p=[]
 for _ in range(n):
  row=list(range(m));r.shuffle(row);p.append(row)
 return n,m,p
def gen_bot(r):return (r.randint(1,6),r.randint(1,6),r.randint(1,30),r.randint(1,30))
def gen_eff(r):return [r.randint(1,40) for _ in range(r.randint(2,12))]

MINPOS='''import sys\nz=list(map(int,sys.stdin.buffer.read().split())); n=z[0]; a=z[1:1+n]; b=z[1+n:1+2*n]; k=0\nwhile k<n and a[k]==b[k]: k+=1\nprint(n-k)\n'''
MINSUFF='''import sys\nz=list(map(int,sys.stdin.buffer.read().split())); n=z[0]; a=z[1:1+n]; b=z[1+n:1+2*n]; k=0\nwhile k<n and a[n-1-k]==b[n-1-k]: k+=1\nprint(n-k)\n'''
RANKFIRST='''import sys\nz=list(map(int,sys.stdin.buffer.read().split())); n,m=z[:2]; p=[z[2+i*m:2+(i+1)*m] for i in range(n)]; print(" ".join(map(str,p[0])))\n'''
BOTGCD='''import sys,math\nsx,sy,tx,ty=map(int,sys.stdin.buffer.read().split()); print("Yes" if tx>=sx and ty>=sy and math.gcd(sx,sy)==math.gcd(tx,ty) else "No")\n'''
EFFADJ='''import sys\nz=list(map(int,sys.stdin.buffer.read().split())); a=sorted(z[1:]); print(max(2-(a[i+1]-a[i]) for i in range(len(a)-1)))\n'''

def run_mutants(spec,ref,cases):
 controls=[]; saved=[]
 for i,(name,code) in enumerate(spec["mutants"],1):
  if code is None:
   code={"oa-expedia-1":MINSUFF,"oa-expedia-2":RANKFIRST,"oa-expedia-3":BOTGCD,"oa-expedia-5":EFFADJ}[spec["id"]]
  if spec["id"]=="oa-expedia-1" and i==2:code=MINSUFF
  path=OUT/"negative-controls"/f'{spec["id"]}-{i}.py';path.write_text(code)
  killed=[j for j,c in enumerate(cases) if run(path,c["input"])!=c["expectedOutput"].rstrip("\n")]
  assert killed,(spec["id"],name,"mutant survived")
  saved.append({"name":name,"code":code});controls.append({"name":name,"rejectedByCases":killed})
 return saved,controls

SPECS=[
 {"id":"oa-expedia-1","title":"Minimum Steps to Reorder Neural Network Layers","code":MINREF,"samples":[([2,1,3,5,4],[2,4,1,5,3]),([1,2,3],[1,2,3]),([3,2,1],[1,2,3])],"encode":min_encode,"oracle":min_oracle,"random":gen_min,"boundary":([*range(200000,0,-1)],list(range(1,200001))),"boundaryExpected":"199999","input":"第一行 n (1≤n≤200000)，第二行 current，第三行 desired。两数组均为 1..n 的排列。","output":"输出最少操作数。","description":"每步只能取当前列表末尾的层，并将其插入任意位置。保证 desired 可达。","tags":["数组","贪心"],"mutants":[("只保留相同元素位置前缀",MINPOS),("只保留当前位置相同的最长前缀",MINPOS)],"editorial":"## 思路\n\n从 current 的末尾搬动若干层，未搬动的部分必为 current 的一个前缀。要最少操作，就找 current 的最长前缀，使其仍按原序出现在 desired 中；其余层从尾部依次取出并插入目标位置即可。双指针扫描 desired 匹配 current 前缀，答案为 n−保留长度。\n\n## 正确性\n\n任何不被移动的元素只能来自 current 前缀，否则必须先移走它之后的所有元素，该元素本身也会被移动。未移动前缀的相对顺序不变，所以它必须是 desired 的子序列。反过来，若前缀是 desired 的子序列，可以从 current 尾部逐个取出其余元素并插入到 desired 对应空位，恰好用 n−前缀长度次操作。因此最大可保留前缀给出最少操作数。\n\n## 复杂度\n\nO(n) 时间，O(1) 额外空间。"},
 {"id":"oa-expedia-2","title":"Song Preference Ranking","code":RANKREF,"samples":[(3,3,[[0,1,2],[0,2,1],[1,2,0]]),(2,2,[[0,1],[1,0]]),(1,1,[[0]])],"encode":rank_encode,"oracle":rank_oracle,"random":gen_rank,"boundary":(200,200,[list(range(200)) for _ in range(200)]),"input":"第一行 n m (1≤n,m≤200)，随后 n 行各为 0..m−1 的一个排列，表示一位用户从最喜欢到最不喜欢的歌曲顺序。","output":"按击败歌曲数降序排列歌曲 id；击败数相同时 id 小者在前，空格分隔输出。","description":"一首歌击败另一首歌，当喜欢前者的用户数超过半数，或恰好一半且前者 id 较小。歌曲的受欢迎程度是击败歌曲的数量。","tags":["排序","模拟"],"mutants":[("平票时让 id 大的歌曲获胜",RANKREF.replace('(2*v==n and x<y)','(2*v==n and x>y)')),("误用第一位用户偏好直接作为排名",None)],"editorial":"## 思路\n\n先把每位用户的偏好排列转换成每首歌的名次。对每对不同歌曲 (x,y) 统计偏好 x 的用户数，根据多数规则及 id 平票规则决定 x 是否击败 y。统计每首歌击败的歌曲数后，按击败数降序、id 升序排序。\n\n## 正确性\n\n名次表能精确判断每个用户是否偏好 x 胜过 y。逐一考察所有其他歌曲并应用题目给定的多数/平票规则，累计值恰好是定义中的击败数。最后的排序键与题目规定完全相同，因此得到唯一排名。\n\n## 复杂度\n\nO(nm² + m log m) 时间，O(nm) 空间；本站将 n,m 限制为 200。"},
 {"id":"oa-expedia-3","title":"Bot Reach Coordinates","code":BOTREF,"samples":[(1,1,3,5),(2,1,1,2),(1,1,2,2)],"encode":bot_encode,"oracle":bot_oracle,"random":gen_bot,"boundary":(1,1,1000000000,1),"input":"一行四个正整数 sx sy tx ty，分别为起点和目标坐标；本站补充 1≤sx,sy,tx,ty≤1000000000。","output":"可达输出 Yes，否则输出 No。","description":"从 (x,y) 只能走到 (x+y,y) 或 (x,x+y)，判断能否从起点到达目标。","tags":["数学","数论"],"mutants":[("仅比较起点终点 gcd",None),("坐标不小于起点就判可达",BOTREF.replace('while tx>=sx and ty>=sy:', 'if tx>=sx and ty>=sy:return "Yes"\n while False:'))],"editorial":"## 思路\n\n从目标反向还原。若 tx>ty，最后一步只能是第一坐标增加了 ty，因此前驱的第一坐标为 tx−ty；连续反推可用取模一次跳过多步。对称地处理 ty>tx。若一坐标已经等于起点对应值，另一坐标必须能通过固定步长整除回起点。\n\n## 正确性\n\n每次正向操作只增加一个坐标，且增加量恰为另一个正坐标。因此目标坐标较大的那一维决定最后一步及唯一前驱；连续相同方向的减法可由模运算合并。到达起点时成功；越过起点或固定另一坐标时余数不匹配则不可能存在合法前驱链。\n\n## 复杂度\n\n每次模运算至少将一坐标显著缩小，时间 O(log(max(tx,ty)))，空间 O(1)。"},
 {"id":"oa-expedia-5","title":"Get Maximum Efficiency","code":EFFREF,"samples":[[9,1,3,5,6],[4,2,1],[1,1000000000]],"encode":eff_encode,"oracle":eff_oracle,"random":gen_eff,"boundary":[*range(1,200001)],"input":"第一行 n (2≤n≤200000)，第二行 n 个到达时间，1≤arrivalTime[i]≤1000000000。","output":"输出至少处理两个测试用例时可达到的最大效率。","description":"选定一次激活时间段 [t1,t2]，执行该闭区间内到达的全部测试用例。效率为执行数减去持续时间 t2−t1；同一到达时间的多个用例均执行，答案允许为负。","tags":["排序","前缀最值"],"mutants":[("窗口只取相邻两个用例",None),("忽略激活时长",EFFREF.replace('(j-a[j])-low+1','j+1-low'))],"editorial":"## 思路\n\n排序到达时间。若选取排序下标区间 [i,j]（至少两个用例），最短激活区间覆盖两端，效率为 (j−i+1)−(a[j]−a[i])。改写为 (j−a[j])−(i−a[i])+1。遍历 j 时维护合法 i<j 的最小 i−a[i]，即可在线性时间求最大值。\n\n## 正确性\n\n任意激活区间内的测试用例在排序后构成连续区间；缩短区间到首末到达时刻不会丢失其中用例且不会增加时长，因此存在最优解对应某个连续区间。公式变换后，对每个右端 j，最佳左端恰是之前 i<j 中 i−a[i] 最小者。前缀最小值枚举并选出所有区间的最大效率。\n\n## 复杂度\n\n排序 O(n log n)，扫描 O(n)，空间 O(n)。"},
]

BLOCKED={
 "oa-expedia-4":"原题将开关题的约束损坏为颜文字，未说明操作数与最大开关编号；Java 函数签名称返回 int，但来源解法使用 long，结果范围可能溢出 32 位。为避免擅自缩窄范围或改变返回契约，暂缓。"
}
RAW={
 "oa-expedia-1":("fastprep/Expedia/expedia-get-min-steps.md","22bb0f0773904f009e3f75fe9abfd42227908e9f"),
 "oa-expedia-2":("fastprep/Expedia/expedia-rank-songs-by-popularity.md","eae3af2e8fe5ca6defc403c1b3b4799271f54ff6"),
 "oa-expedia-3":("OA LIST/Expedia_OA/001_image.txt","d20e1ebb9d2f9fba59a689915f09a0953afdaa2d"),
 "oa-expedia-4":("fastprep/Expedia/expedia-calculate-the-sum.md","1ab6d2b568112366d351d6b24d0f78232f16b321"),
 "oa-expedia-5":("fastprep/Expedia/expedia-get-max-efficiency.md","4313474dc86c437be308aacd70c4f6d54c8706f6")
}

def main():
 for d in ("packages","editorials","references","oracles","mutants","negative-controls","candidate-batches","validation","reviews","source-evidence"):(OUT/d).mkdir(parents=True,exist_ok=True)
 authored={s["id"] for s in SPECS}; reviews=[]; source_items=[]
 for pid,(path,blob) in RAW.items():
  src=SRC[pid]; status="authored" if pid in authored else "blocked"; reason=("已核对固定快照原始题面；本站输入协议和补充边界已在题面明示，163 个独立 oracle 与两个 mutant 离线通过。" if status=="authored" else BLOCKED[pid])
  reviews.append({"id":pid,"status":status,"reason":reason,"catalogContentHash":src["contentHash"],"sourceUrl":src["sourceUrl"],"sourceCommit":COMMIT,"rawPath":path,"rawGitBlob":blob})
  source_items.append({"id":pid,"status":status,"reason":reason,"catalogContentHash":src["contentHash"],"sourceUrl":src["sourceUrl"],"path":path,"gitBlobSha":blob})
 manifest=[]; reports=[]
 for spec in SPECS:
  pid=spec["id"]; src=SRC[pid]; code=spec["code"].lstrip(); ref=OUT/"references"/f"{pid}.py"; ref.write_text(code)
  rng=random.Random(SEED+int(pid.rsplit("-",1)[1])); values=spec["samples"]+[spec["random"](rng) for _ in range(160)]; oracle=[]
  for value in values:
   expected=spec["oracle"](value); actual=run(ref,spec["encode"](value)); assert actual==expected,(pid,value,expected,actual)
   oracle.append({"input":spec["encode"](value),"expectedOutput":expected+"\n"})
  cases=[{"name":f"公开样例 {i+1}",**oracle[i],"hidden":False,"weight":1} for i in range(3)]
  cases += [{"name":f"随机隐藏测试 {i+1}",**oracle[i+3],"hidden":True,"weight":1} for i in range(30)]
  boundary=spec["boundary"]; inp=spec["encode"](boundary)
  expected=spec.get("boundaryExpected")
  if expected is None:
   if pid=="oa-expedia-1":expected=str(len(boundary[0])-1)
   elif pid=="oa-expedia-2":expected=" ".join(map(str,range(200)))
   elif pid=="oa-expedia-3":expected="Yes"
   else:expected="1"
  assert run(ref,inp)==expected,(pid,"boundary",expected)
  cases.append({"name":"上限边界","input":inp,"expectedOutput":expected+"\n","hidden":True,"weight":1})
  if pid=="oa-expedia-5":
   value=[5,5,5,5]; inp=eff_encode(value); expected=eff_oracle(value)
   assert run(ref,inp)==expected
   cases.append({"name":"同一时刻的多个用例","input":inp,"expectedOutput":expected+"\n","hidden":True,"weight":1})
  mutants,controls=run_mutants(spec,ref,cases)
  pdef={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"中等","tags":["OA","Expedia"]+spec["tags"],"description":spec["description"]+"\n\n本站标准输入输出协议及题面中注明的补充限制为站内判题约定，不代表原始 OA 平台提供了相同协议。","input":spec["input"],"output":spec["output"],"explanation":"思路、正确性证明和复杂度见配套题解。","hints":["优先从规则中识别不变量、边界和必须同时满足的条件。"],"timeLimit":3,"memoryLimit":262144,"outputLimit":65536,"checker":"exact","languages":["python","go","java","cpp"]}
  norm="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
  proc=subprocess.run(["node","--import","tsx","-e",norm],cwd=ROOT,input=json.dumps({"schemaVersion":1,"problem":pdef,"cases":cases},ensure_ascii=False),text=True,capture_output=True)
  if proc.returncode:raise RuntimeError(proc.stderr)
  normalized=proc.stdout; package=json.loads(normalized); editorial={"schemaVersion":1,"id":pid,"title":spec["title"],"explanation":spec["editorial"],"solutions":[{"language":"python","code":code}],"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"]}
  for folder,obj in (("packages",package),("oracles",oracle),("mutants",mutants),("editorials",editorial)):(OUT/folder/f"{pid}.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
  manifest.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":spec["editorial"],"authoredSolutions":[{"language":"python","code":code}]})
  reports.append({"id":pid,"oracleCases":len(oracle),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":controls,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
  print(f"{pid}: 163 oracle cases, {len(cases)} formal cases, two mutants rejected",flush=True)
 (OUT/"candidate-batches/expedia-next.json").write_text(json.dumps({"schemaVersion":1,"items":manifest},ensure_ascii=False,indent=2)+"\n")
 (OUT/"validation/expedia-next.json").write_text(json.dumps({"schemaVersion":1,"seed":SEED,"problems":reports,"note":"Offline authored-code/oracle/mutant validation only; not tested against GoJudge."},ensure_ascii=False,indent=2)+"\n")
 (OUT/"reviews/expedia-next.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
 (OUT/"source-evidence/expedia-next.json").write_text(json.dumps({"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":COMMIT,"reason":"Verified pinned raw statements including the Expedia image-source statement; upstream solution code was not executed.","items":source_items},ensure_ascii=False,indent=2)+"\n")

if __name__=="__main__":main()
