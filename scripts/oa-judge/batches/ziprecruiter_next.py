"""Build deterministic ZipRecruiter OA candidates; never changes runtime registry."""
from collections import Counter, deque
from fractions import Fraction
from pathlib import Path
import hashlib, json, random, subprocess, sys, textwrap

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/"content/oa-judge"
UP=Path("/tmp/oa-master-readonly")
UPSHA="e66f809f4c953bce129f68491726176615db6afc"
CAT=json.loads((ROOT/"content/oa-master/catalog.json").read_text())
SRC={x["id"]:x for x in CAT["items"]}
RUN="\nif __name__ == '__main__':\n import sys\n print(solve(sys.stdin.read()))\n"

def call(path, data):
 r=subprocess.run([sys.executable,"-I",str(path)],input=data,text=True,capture_output=True,timeout=12,check=True)
 return r.stdout.rstrip("\n")

def normalize(doc):
 js="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
 return subprocess.run(["node","--import","tsx","-e",js],cwd=ROOT,input=json.dumps(doc,ensure_ascii=False),text=True,capture_output=True,check=True).stdout

def F(ident,title,tags,samples,rand,edges,desc,inp,out,idea,proof,complexity,code,mutants,oracle,encode):
 return dict(id="oa-ziprecruiter-"+str(ident),title=title,tags=tags,samples=samples,rand=rand,edges=edges,desc=desc,inp=inp,out=out,idea=idea,proof=proof,complexity=complexity,code=code,mutants=mutants,oracle=oracle,encode=encode)

def fish_enc(v):
 a,b=v; return f"{len(a)} {len(b)}\n"+ " ".join(map(str,a))+"\n"+" ".join(map(str,b))+"\n"
def fish_oracle(v):
 fish,baits=v; best=0
 def go(i,used,n):
  nonlocal best
  if i==len(fish): best=max(best,n); return
  go(i+1,used,n)
  for j,b in enumerate(baits):
   if fish[i]>b and used[j]<3:
    used[j]+=1; go(i+1,used,n+1); used[j]-=1
 go(0,[0]*len(baits),0); return str(best)
def fish_rand(r):
 return ([r.randint(1,20) for _ in range(r.randint(1,8))],[r.randint(1,20) for _ in range(r.randint(1,4))])
fishcode="""def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); m=next(it)
 fish=sorted(next(it) for _ in range(n)); baits=sorted(next(it) for _ in range(m))
 i=ans=0
 for b in baits:
  while i<n and fish[i]<=b: i+=1
  used=0
  while i<n and used<3: ans+=1; i+=1; used+=1
 return str(ans)
"""
SPECS=[
F(2,"最多能钓到多少条鱼",["排序","贪心"],[([1,2,3],[1]),([2,3,4,5],[1,2]),([5,5,6,2],[1,4])],fish_rand,[(([1,2,2,5],[2]),None)],
"每条鱼和鱼饵都有正整数大小。鱼饵必须严格小于鱼才能钓到鱼；每个鱼饵最多使用 3 次，每条鱼最多钓一次。求最多能钓到的鱼数。",
"第一行 n m（1..100000）；第二行 n 个鱼大小，第三行 m 个鱼饵大小，值均为 1..10^9。","输出最多钓到的鱼数。",
"鱼和鱼饵从小到大排序。对每个鱼饵，跳过不大于它的鱼，再用它钓最多三条当前最小的可钓鱼。",
"小鱼饵可钓集合包含更大鱼饵可钓集合。将当前鱼饵分配给最小的可钓鱼不会减少后续匹配；否则可将最优解中较大的匹配鱼与该更小鱼交换。重复即得最大匹配数。",
"时间 O(n log n + m log m)，空间 O(n+m)。",fishcode,
[("把严格小于误写成小于等于",fishcode.replace("fish[i]<=b","fish[i]<b")),("每个鱼饵最多用一次",fishcode.replace("used<3","used<1"))],fish_oracle,fish_enc),

]
def coder_enc(v): return str(len(v))+"\n"+"".join(f"{n} {g}\n" for n,g in v)
def coder_oracle(v):
 d={}
 for n,g in v:
  s,c=d.get(n,(0,0)); d[n]=(s+g,c+1)
 return max(d,key=lambda n:Fraction(*d[n]))
def coder_rand(r):
 while True:
  v=[]
  for i in range(r.randint(2,6)): v.extend((f"s{i}",r.randint(1,5)) for _ in range(r.randint(1,5)))
  d={}
  for n,g in v: s,c=d.get(n,(0,0)); d[n]=(s+g,c+1)
  if len({Fraction(*x) for x in d.values()})==len(d): return v
coder="""def solve(raw):
 p=raw.split(); n=int(p[0]); d={}
 for i in range(n):
  name=p[1+2*i]; grade=int(p[2+2*i]); s,c=d.get(name,(0,0)); d[name]=(s+grade,c+1)
 best=None
 for name,(s,c) in d.items():
  if best is None or s*best[2]>best[1]*c: best=(name,s,c)
 return best[0]
"""
codermax="""def solve(raw):
 p=raw.split(); n=int(p[0]); best=''; score=-1
 for i in range(n):
  name=p[1+2*i]; grade=int(p[2+2*i])
  if grade>=score: best=name; score=grade
 return best
"""
SPECS.append(F(3,"找出平均成绩最高的学生",["哈希表","精确比较"],[
[("John",5),("Michael",4),("Ruby",2),("Ruby",5),("Michael",5)],
[("Kate",5),("Kate",5),("Maria",2),("John",5),("Michael",4),("John",4)],
[("A",5),("A",5),("B",4),("B",4),("B",4)]],coder_rand,
[([( "x",5)]*50000+[("y",4)]*50000,None)],
"给定学生成绩，每位学生至少出现一次，成绩为 1 到 5。找出平均成绩最高者；不同学生的平均成绩互不相同。",
"第一行 n（1..100000），接着 n 行为姓名（英文字母、不含空格、大小写敏感）和成绩（1..5）。",
"输出平均成绩最高的学生姓名。","按姓名累加总分和人数。以交叉相乘比较平均数，避免浮点误差。",
"累加值给出每人的平均分分子和分母；正分母下交叉相乘等价于比较平均数。遍历所有学生保留最大者，唯一性保证结果唯一。",
"时间 O(n+k)，空间 O(k)，k 为不同学生数。",coder,
[("只比较总分不除人数",coder.replace("s*best[2]>best[1]*c","s>best[1]")),("只比较单次最高成绩",codermax)],coder_oracle,coder_enc))
def sw_enc(v): return str(len(v))+"\n"+" ".join(map(str,v))+"\n"
def validpair(a,b):
 x,y=str(a),str(b)
 if len(x)!=len(y): return False
 d=[i for i,(u,v) in enumerate(zip(x,y)) if u!=v]
 return not d or (len(d)==2 and x[d[0]]==y[d[1]] and x[d[1]]==y[d[0]])
def sw_oracle(v): return str(sum(validpair(v[i],v[j]) for i in range(len(v)) for j in range(i+1,len(v))))
def sw_rand(r): return [r.randint(0,9999) for _ in range(r.randint(1,10))]
swcode="""from collections import defaultdict
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); freq=defaultdict(int); ans=0
 for val in (next(it) for _ in range(n)):
  s=str(val); c=list(s); cand={s}
  for i in range(len(c)):
   for j in range(i+1,len(c)):
    if c[i]==c[j] or (i==0 and c[j]=='0'): continue
    c[i],c[j]=c[j],c[i]; cand.add(''.join(c)); c[i],c[j]=c[j],c[i]
  ans+=sum(freq[x] for x in cand); freq[s]+=1
 return str(ans)
"""
swmut="""from collections import Counter
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); f=Counter(); ans=0
 for x in (next(it) for _ in range(n)): ans+=f[x]; f[x]+=1
 return str(ans)
"""
SPECS.append(F(4,"统计可通过一次数字交换匹配的数对",["哈希表","枚举"],[
[12,21,12,123],[7,7],[1,10,100,1000]],lambda r:[r.randint(0,9999) for _ in range(r.randint(1,10))],
[([7]*100000,str(100000*99999//2)),([0,0,10,1],None)],
"对每个 i<j，若 numbers[j] 的十进制表示经至多一次交换（交换一对位置）可得到 numbers[i]，则该数对有效；不交换也允许，只统计位数相同的数，求数对数。交换不得产生前导零。",
"第一行 n（1..100000），第二行 n 个整数（0..10^9），使用普通十进制表示。","输出有效数对数，结果可超过 32 位。",
"从左到右处理。枚举当前数不交换以及交换任意一对不同位置后能形成的合法表示，用前缀频次累加。",
"每个前缀位置计一次。枚举集合恰包含所有至多一次合法交换的结果；对集合中每个结果累加此前出现次数，恰好计入右端为当前下标的全部有效数对一次。",
"时间 O(n d²)，d≤10；空间 O(n d²) 最坏。",swcode,
[("只统计相等元素",swmut),("漏掉不交换的数对",swcode.replace("cand={s}","cand=set()"))],sw_oracle,sw_enc))
def word_enc(v): return v+"\n"
def word_oracle(v):
 n=0
 for word in v.split():
  cnt=Counter(ch.lower() for ch in word)
  n+=any(x>=3 for x in cnt.values())
 return str(n)
def word_rand(r):
 a="abcdeABC"; return " ".join("".join(r.choice(a) for _ in range(r.randint(1,12))) for _ in range(r.randint(1,8)))
wordcode="""from collections import Counter
def solve(raw):
 return str(sum(any(n>=3 for n in Counter(w.lower()).values()) for w in raw.split()))
"""
wordcase="""from collections import Counter
def solve(raw):
 return str(sum(any(n>=3 for n in Counter(w).values()) for w in raw.split()))
"""
wordletters="""from collections import Counter
def solve(raw):
 return str(sum(sum(n>=3 for n in Counter(w.lower()).values()) for w in raw.split()))
"""
SPECS.append(F(5,"统计含重复三次字母的单词",["字符串","哈希表"],[
"Dooddle moodle Pepper unsuccessfully","aA AaA abc","Bookkeeper tree"],word_rand,
[(("aaa "*25000).strip(),None)],
"给定只含英文字母与空格的句子，统计至少有一个字母（忽略大小写）出现三次或以上的单词数。每个单词只计一次。",
"输入一行 1..100000 个 ASCII 字符，仅有英文单词及空格，首尾无空格，无标点。",
"输出符合条件的单词数。","逐词忽略大小写统计字母频次。若存在频次至少为 3 的字母，该词计一。",
"频次条件与题意相同，逐词只作一次布尔计数，因而每词最多贡献 1；对所有词求和即为答案。",
"时间 O(L)，空间 O(1) 字母表。",wordcode,
[("区分大小写",wordcase),("将一个单词内每种重复字母分别计数",wordletters)],word_oracle,word_enc))
def ev_enc(v): return str(len(v))+"\n"+" ".join(map(str,v))+"\n"
def ev_ref(raw):
 it=iter(map(int,raw.split())); n=next(it); q=deque(); out=[]
 for t in (next(it) for _ in range(n)):
  while q and q[0]<=t: q.popleft()
  wait=max(0,len(q)-1)
  if wait>10: out.append(t)
  elif not q: q.append(t+300); out.append(t+300)
  else: q.append(q[-1]+300); out.append(q[-1])
 return " ".join(map(str,out))
def ev_oracle(v):
 end=None; wait=0; out=[]
 for t in v:
  while end is not None and end<=t:
   if wait: wait-=1; end+=300
   else: end=None
  if wait>10: out.append(t)
  elif end is None: end=t+300; out.append(end)
  else: wait+=1; out.append(end+wait*300)
 return " ".join(map(str,out))
def ev_rand(r):
 t=r.randint(0,10); v=[]
 for _ in range(r.randint(1,50)): t+=r.randint(0,400); v.append(t)
 return v
evcode='''from collections import deque
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); q=deque(); out=[]
 for t in (next(it) for _ in range(n)):
  while q and q[0]<=t: q.popleft()
  wait=max(0,len(q)-1)
  if wait>10: out.append(t)
  elif not q: q.append(t+300); out.append(t+300)
  else: q.append(q[-1]+300); out.append(q[-1])
 return " ".join(map(str,out))
'''
evthreshold=evcode.replace("wait>10","wait>=10")
evpriority="""from collections import deque
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); q=deque(); out=[]
 for t in (next(it) for _ in range(n)):
  while q and q[0]<t: q.popleft()
  if q and q[0]==t and len(q)>1:
   a=list(q); q=deque([t+300]+[x+300 for x in a[1:]]); out.append(t+300)
  else:
   wait=max(0,len(q)-1)
   if wait>10: out.append(t)
   elif not q: q.append(t+300); out.append(t+300)
   else: q.append(q[-1]+300); out.append(q[-1])
 return " ".join(map(str,out))
"""
SPECS.append(F(9,"独家活动排队入场",["队列","模拟"],[
[4,400,450,500],list(range(1,16)),[0,1,300]],ev_rand,
[(list(range(5000)),None)],
"客人按非递减顺序到达。证件检查耗时 300 秒。正在检查者不计入等待队列；到达时若等待人数已大于 10，该客人离开并输出到达时间。若在检查完成的同一时刻到达，先让已等待客人开始检查，新客人排在队尾。输出每位客人的完成时间；离开者输出到达时间。",
"第一行 n（1..5000）；第二行 n 个非递减的非负整数到达时间（≤10^9）。",
"按到达顺序输出 n 个整数，空格分隔。",
"维护未来完成时间队列。到达前移除所有已完成者；队首若存在就是当前服务者，其余人数为等待人数。超过 10 则离开，否则排到队尾。",
"归纳每次到达：移除完成者后队列为空表示空闲；否则首项为服务者、其余为等待者。阈值判断准确；被接纳客人排在现有所有服务/等待之后，完成时间为队尾时间加 300。等时规则由先处理完成事件再入队实现。",
"时间 O(n)，空间 O(n)。",evcode,
[("将服务中的人计入等待上限",evthreshold),("恰好完成时让新客人插队",evpriority)],ev_oracle,ev_enc))
def time_enc(v): return str(len(v))+"\n"+" ".join(map(str,v))+"\n"
def time_oracle(v): return str(sum(1 if b>a else 2 if b<a else 0 for a,b in zip(v,v[1:])))
def time_rand(r): return [r.randint(1,10000) for _ in range(r.randint(1,100))]
timecode="""def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); a=[next(it) for _ in range(n)]
 return str(sum(1 if b>a else 2 if b<a else 0 for a,b in zip(a,a[1:])))
"""
SPECS.append(F(13,"计算时间旅行总耗时",["数组","模拟"],[
[2000,1990,2005,2050],[2000,2021,2005],[2021,2021,2005]],time_rand,
[([10000,1]*50,None),([42],None)],
"按给定顺序经过一组年份。相邻年份相同耗时 0；前往更晚年份耗时 1；返回更早年份耗时 2。求总耗时。",
"第一行 n（1..100）；第二行 n 个年份（1..10000）。","输出总耗时。",
"逐对比较相邻年份：递增记 1、递减记 2、相同记 0，然后求和。",
"旅程恰由 n−1 段相邻转换组成；每段独立贡献题目定义的 0、1 或 2，逐段求和即为总耗时。",
"时间 O(n)，空间 O(n)（存储输入）。",timecode,
[("颠倒向前与向后耗时",timecode.replace("1 if b>a else 2 if b<a else 0","2 if b>a else 1 if b<a else 0")),("把耗时当成年份差",timecode.replace("1 if b>a else 2 if b<a else 0","abs(b-a)"))],time_oracle,time_enc))

BLOCKED={
"oa-ziprecruiter-1":"四级银行题合并账户后历史余额的定义含混：将两条历史按时间合并会把合并前另一账户余额当作合并账户余额，原文未确定已合并账户在合并前的 getBalance 应返回自身历史还是总余额；不猜测该核心语义。",
"oa-ziprecruiter-6":"Cycle Shift 题面规则与样例冲突：按轮转等价及解释列出的匹配对计数为 5，原输出为 3。",
"oa-ziprecruiter-7":"分配数组题的多数规则、过程解释、输出顺序彼此矛盾，无法唯一计算结果。",
"oa-ziprecruiter-8":"Event Time 未规定到达时刻与检查完成时刻相同的处理次序。",
"oa-ziprecruiter-10":"Fantasy Card Duel 缺少原始规则，只有不完整样例，无法定义确定的胜负判定。",
"oa-ziprecruiter-11":"Lamps and Control Points 未提供可读原题规则，不能确认区间端点和任务定义。",
"oa-ziprecruiter-12":"Neighboring Record IDs 的题干在核心描述中截断；样例不足以确认缺失 ID、重复 ID 与边界项行为。",
"oa-ziprecruiter-14":"Triplets With Unique Chars 题干在定义之前截断，损坏的图片标签及两个输出不能确定所数三元组。"
}

def main():
 for folder in ("packages","editorials","references","oracles","mutants","negative-controls","reviews","candidate-batches","validation","source-evidence"):
  (OUT/folder).mkdir(parents=True,exist_ok=True)
 batch="ziprecruiter-next"; items=[]; reports=[]; reviews=[]
 oracle_files=[]; names=[]
 for path in subprocess.run(["git","-C",str(UP),"ls-tree","-r","--name-only",UPSHA,"fastprep/ZipRecruiter"],text=True,capture_output=True,check=True).stdout.splitlines():
  blob=subprocess.run(["git","-C",str(UP),"rev-parse",f"{UPSHA}:{path}"],text=True,capture_output=True,check=True).stdout.strip(); oracle_files.append({"path":path,"blobSha":blob})
 rawfiles=list(oracle_files)
 for spec in SPECS:
  pid=spec["id"]; src=SRC[pid]; rng=random.Random(20261005+int(pid.rsplit("-",1)[1]))
  code=textwrap.dedent(spec["code"]).strip()+"\n"+RUN; ref=OUT/"references"/(pid+".py"); ref.write_text(code)
  vals=spec["samples"]+[spec["rand"](rng) for _ in range(160)]; oracles=[]
  for v in vals:
   data=spec["encode"](v); expected=spec["oracle"](v)
   assert call(ref,data)==expected,(pid,v,expected,call(ref,data))
   oracles.append({"input":data,"expectedOutput":expected+"\n"})
  edges=[]
  for v,expected in spec["edges"]:
   if expected is None: expected=spec["oracle"](v)
   data=spec["encode"](v); assert call(ref,data)==expected,(pid,"edge",expected)
   edges.append({"input":data,"expectedOutput":expected+"\n"})
  tests=oracles[:3]+edges+oracles[3:27]
  cases=[{"name":f"公开样例 {i+1}" if i<3 else f"隐藏验证 {i-2}",**x,"hidden":i>=3,"weight":1} for i,x in enumerate(tests)]
  mutants=[]; kill=[]
  for k,(label,mut) in enumerate(spec["mutants"],1):
   full=textwrap.dedent(mut).strip()+"\n"+RUN; control=OUT/"negative-controls"/f"{pid}-{k}.py"; control.write_text(full)
   rejected=[i for i,c in enumerate(cases) if call(control,c["input"])!=c["expectedOutput"].rstrip("\n")]
   assert rejected,(pid,"mutant survived",label)
   mutants.append({"name":label,"code":full}); kill.append({"name":label,"rejectedByCases":rejected})
  statement=spec["desc"]+"\n\n输入协议与本批样例由 CSWork 整理。"
  problem={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":spec["title"],"difficulty":"中等","tags":["OA","ZipRecruiter"]+spec["tags"],"description":statement,"input":spec["inp"],"output":spec["out"],"explanation":"依照以上确定规则处理；思路、正确性证明和复杂度见配套题解。","hints":[spec["idea"]],"timeLimit":4,"memoryLimit":262144,"outputLimit":65536,"checker":"tokens","languages":["python","go","java","cpp"]}
  normalized=normalize({"schemaVersion":1,"problem":problem,"cases":cases}); pkg=json.loads(normalized)
  ed=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}\n\n## 来源说明\n\n本站补充确定的标准输入输出协议。上游第 9 题密集到达样例漏列了一个已接纳客人的完成时间；本站按明确的 300 秒服务和队列规则修正为 3301，并在来源证据中如实说明。"
  solution=[{"language":"python","code":code}]
  editorial={"schemaVersion":1,"id":pid,"title":spec["title"],"explanation":ed,"solutions":solution,"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"],"author":"Chunyu Sui"}
  for folder,doc in (("packages",pkg),("oracles",oracles),("mutants",mutants),("editorials",editorial)): (OUT/folder/(pid+".json")).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n")
  items.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":ed,"authoredSolutions":solution})
  reports.append({"id":pid,"oracleCases":len(oracles),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":kill,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
  reviews.append({"id":pid,"status":"authored","reason":"原规则可确定；本站补充明确 I/O 与边界。第 9 题原样例少一个完成时间，本站据规则修正并公开注明。","sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"catalogContentHash":src["contentHash"]})
  print(f"{pid}: {len(oracles)} oracle cases; {len(cases)} judge cases; {len(mutants)} mutants killed",flush=True)
 for pid,reason in BLOCKED.items():
  src=SRC[pid]; reviews.append({"id":pid,"status":"blocked","reason":reason,"sourceUrls":[src["sourceUrl"]],"catalogContentHash":src["contentHash"]})
 reviews.sort(key=lambda x:int(x["id"].rsplit("-",1)[1]))
 (OUT/"candidate-batches"/(batch+".json")).write_text(json.dumps({"schemaVersion":1,"items":items},ensure_ascii=False,indent=2)+"\n")
 (OUT/"validation"/(batch+".json")).write_text(json.dumps({"schemaVersion":1,"seed":20261005,"problems":reports,"note":"Local authored-code/oracle/mutant validation only; not GoJudge acceptance or production publication."},ensure_ascii=False,indent=2)+"\n")
 (OUT/"reviews"/(batch+".json")).write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
 page="web/content/docs/companies/ziprecruiter.mdx"; blob=subprocess.run(["git","-C",str(UP),"rev-parse",f"{UPSHA}:{page}"],text=True,capture_output=True,check=True).stdout.strip()
 for path in subprocess.run(["git","-C",str(UP),"ls-tree","-r","--name-only",UPSHA,"OA LIST/ZipRecruiter"],text=True,capture_output=True,check=True).stdout.splitlines():
  rawfiles.append({"path":path,"blobSha":subprocess.run(["git","-C",str(UP),"rev-parse",f"{UPSHA}:{path}"],text=True,capture_output=True,check=True).stdout.strip()})
 source_by_id={"oa-ziprecruiter-1":["OA LIST/ZipRecruiter/_chapter.md","OA LIST/ZipRecruiter/001_QQ_1760291496774.txt"]}
 fastprep={
  2:"ziprecruiter-caught-fish.md",3:"ziprecruiter-coder-writing.md",
  4:"ziprecruiter-count-distinct-swappable-digit-pairs.md",5:"ziprecruiter-count-triple.md",
  6:"ziprecruiter-cycle-shift.md",7:"ziprecruiter-disctribute-integers-between-arrays.md",
  8:"ziprecruiter-event-time.md",9:"ziprecruiter-exclusive-event-entry.md",
  10:"ziprecruiter-fantasy-card-duel.md",11:"ziprecruiter-lamp-and-control-points.md",
  12:"ziprecruiter-neighboring-record-ids.md",13:"ziprecruiter-time-travel.md",
  14:"ziprecruiter-triplets-with-unique-chars.md"}
 for n,name in fastprep.items(): source_by_id[f"oa-ziprecruiter-{n}"]=[f"fastprep/ZipRecruiter/{name}"]
 source_doc={"schemaVersion":1,"upstreamCommit":UPSHA,"rawFiles":rawfiles,"sourcePathByCatalogId":source_by_id,"companyPage":{"path":page,"blobSha":blob},"catalogFingerprints":{f"oa-ziprecruiter-{n}":SRC[f"oa-ziprecruiter-{n}"]["contentHash"] for n in range(1,15)},"sampleCorrection":{"id":"oa-ziprecruiter-9","upstreamIssue":"The arrival times 1..15 output omits completion 3301 although that accepted guest exists under the stated queue rule.","siteResolution":"The site sample includes 3301, then 3601 and leave times 13, 14, 15. This is our rule-derived output, not a claim about upstream output."}}
 (OUT/"source-evidence"/(batch+".json")).write_text(json.dumps(source_doc,ensure_ascii=False,indent=2)+"\n")

if __name__=="__main__": main()
