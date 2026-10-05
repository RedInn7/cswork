"""Offline eBay OA candidate generator (source snapshot e66f809)."""
from pathlib import Path
import hashlib,json,random,subprocess,sys,textwrap
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/"content/oa-judge"
COMMIT="e66f809f4c953bce129f68491726176615db6afc";RAW="web/content/docs/companies/ebay.mdx";BLOB="a23244e93e3dae0097a070529d1b7883507e08a9"
CAT={x["id"]:x for x in json.loads((ROOT/"content/oa-master/catalog.json").read_text())["items"]}
def run(path,data):return subprocess.run([sys.executable,"-I",str(path)],input=data,text=True,capture_output=True,timeout=8,check=True).stdout.rstrip("\n")
def spec(num,title,desc,inp,out,enc,oracle,gen,samples,code,mutants,idea,proof,complexity,tags=(),checker="tokens"):return locals()
def ez(v):return f"{len(v)}\n"+" ".join(map(str,v))+"\n"
def oz(v):return " ".join(map(str,[v[i//2] if i%2==0 else v[-1-i//2] for i in range(len(v))]))
def rz(r):return [r.randint(-10**9,10**9) for _ in range(r.randint(5,20))]
def ec(v):n,s=v;return f"{n}\n{s}\n"
def oc(v):
 n,s=v;cs="bcdfghjklmnpqrstvwxyz";out=[];cnt=0
 for c in s:
  if c.lower() in cs:
   cnt+=1
   if cnt%n==0:
    x=cs[(cs.index(c.lower())+1)%len(cs)];out.append(x.upper() if c.isupper() else x);continue
  out.append(c)
 return "".join(out)
def rc(r):return r.randint(1,10),"".join(r.choice("abcdeghijklmnopqrstuvwxyz ABCXYZ!?,.-0123") for _ in range(r.randint(1,40)))
def eb(v):
 g,r=v;h=len(g);w=len(g[0]);return f"{h} {w} {r}\n"+"\n".join(" ".join(map(str,x)) for x in g)+"\n"
def ob(v):
 g,r=v;h=len(g);w=len(g[0]);o=[x[:] for x in g]
 for i in range(r,h-r):
  for j in range(r,w-r):o[i][j]=sum(g[x][y] for x in range(i-r,i+r+1) for y in range(j-r,j+r+1))//((2*r+1)**2)
 return "\n".join(" ".join(map(str,x)) for x in o)
def rb(r):
 h=r.randint(1,7);w=r.randint(1,7);return [[r.randrange(256) for _ in range(w)] for _ in range(h)],r.randint(0,min(h,w))
def et(v):
 a,b,k=v;return f"{len(a)} {k}\n"+" ".join(map(str,a))+"\n"+" ".join(map(str,b))+"\n"
def ot(v):
 from itertools import product
 a,b,k=v;n=len(a);base=sum(-x*y for x,y in zip(a,b));best=base
 for l in range(n-k+1):
  fixed=base+sum(a[i]*b[i] for i in range(l,l+k))
  for p in product((-1,0,1),repeat=k):best=max(best,fixed-sum(a[l+j]*x for j,x in enumerate(p)))
 return str(best)
def rt(r):
 n=r.randint(1,8);return [r.randint(0,50) for _ in range(n)],[r.choice((-1,0,1)) for _ in range(n)],r.randint(1,min(5,n))
def eo(v):return f"{len(v)}\n"+" ".join(map(str,v))+"\n"
def oo(v):return str(sum(str(x).count("0")%2 for x in v))
def ro(r):return [r.randint(0,10**12) for _ in range(r.randint(1,25))]
def ex(g):return f"{len(g)} {len(g[0])}\n"+"\n".join("".join(x) for x in g)+"\n"
def ox(v):
 g=v;h=len(g);w=len(g[0]);ans=0
 for i in range(h):
  for j in range(w):
   if not g[i][j].isdigit():continue
   for di,dj in ((0,1),(1,0)):
    r,c=i+di,j+dj;val=int(g[i][j]);ans=max(ans,val);needop=True;sg=1
    while r<h and c<w:
     ch=g[r][c]
     if needop and ch in "+-":sg=1 if ch=="+" else -1;needop=False
     elif not needop and ch.isdigit():val+=sg*int(ch);ans=max(ans,val);needop=True
     else:break
     r+=di;c+=dj
 return str(ans)
def rx(r):
 h=r.randint(1,8);w=r.randint(1,8);g=[[r.choice("0123456789+-") for _ in range(w)] for _ in range(h)]
 if not any(c.isdigit() for row in g for c in row):g[0][0]=str(r.randrange(10))
 return g
S=[
spec(1,"Zigzag Reorder","依次输出原数组首项、末项、第二项、倒数第二项，交替从两端取数直至用完。","n（原题 5≤n≤1000），随后 n 个整数（本站补充 −10⁹..10⁹）。","输出重排后的 n 个数。",ez,oz,rz,[[1,6,9,4,3,7,8],[1,1,2,2,3],[9,-1,0,8,7]],"""import sys
def solve(s):
 z=list(map(int,s.split()));n=z[0];a=z[1:1+n];l=0;r=n-1;o=[]
 while l<=r:
  o.append(a[l]);l+=1
  if l<=r:o.append(a[r]);r-=1
 return " ".join(map(str,o))
""",[("take-right-first","o.append(a[l]);l+=1","o.append(a[r]);r-=1"),("take-left-twice","if l<=r:o.append(a[r]);r-=1","if l<=r:o.append(a[l]);l+=1")],"双指针逐轮取左端，再取右端（若仍有元素）。","每轮移除尚未输出的最左元素和最右元素，不重不漏；区间缩至空时输出次序正是左右交替规则。","O(n) 时间、O(n) 输出空间。",["数组","模拟"]),
spec(2,"Shift n-th Consonant","从左统计辅音；第 n、2n、3n…个辅音替换为下一个辅音，保持大小写，z 回绕 b。元音及非 ASCII 字母原样保留且不计数。","第一行 n（1..10⁹），第二行 message（≤200000 ASCII 可打印字符，可含空格）。只将 A-Z/a-z 作为英文字母，规则为本站明确补充。","原样输出变换后的整行字符串，空格必须保留。",ec,oc,rc,[(1,"z Z abc!"),(3,"Abc xyz! 09"),(100,"Hello, World!")],"""import sys
CS="bcdfghjklmnpqrstvwxyz"
def solve(s):
 n,word=s.split("\\n",1);n=int(n);word=word.removesuffix("\\n");cnt=0;o=[]
 for c in word:
  if c.isascii() and c.isalpha() and c.lower() not in "aeiou":
   cnt+=1
   if cnt%n==0:
    x=CS[(CS.index(c.lower())+1)%len(CS)];o.append(x.upper() if c.isupper() else x);continue
  o.append(c)
 return "".join(o)
""",[("shift-every-consonant","if cnt%n==0:","if True:"),("do-not-shift-target",'x=CS[(CS.index(c.lower())+1)%len(CS)]','x=c.lower()')],"维护辅音序号，仅在其为 n 的倍数时，在固定辅音字母表内前进一位。","辅音字母表按英文字母顺序去除元音，模表长实现循环。扫描只计 ASCII 字母辅音，因此空格、数字、标点与非 ASCII 字符原样输出。","O(|message|) 时间与输出空间。",["字符串"],"exact"),
spec(3,"Image Blur","对完整落在图像内的中心像素，以其为中心、行列偏移不超过 radius 的正方形窗口求均值并向下取整。边界不完整的窗口对应像素保持原值，所有窗口均基于原始图像。","h,w（1..500，hw≤250000），radius（0..500），随后像素矩阵；像素为 0..255。范围为本站补充。","输出 h 行像素矩阵。",eb,ob,rb,[([[0,0,1],[0,1,1],[0,1,0]],1),([[7]],0),([[1,9,3,4],[5,2,8,6]],1)],"""import sys
def solve(s):
 z=list(map(int,s.split()));h,w,r=z[:3];a=[z[3+i*w:3+(i+1)*w] for i in range(h)];p=[[0]*(w+1) for _ in range(h+1)]
 for i in range(h):
  for j in range(w):p[i+1][j+1]=a[i][j]+p[i][j+1]+p[i+1][j]-p[i][j]
 o=[x[:] for x in a];d=2*r+1
 for i in range(r,h-r):
  for j in range(r,w-r):
   q=p[i+r+1][j+r+1]-p[i-r][j+r+1]-p[i+r+1][j-r]+p[i-r][j-r];o[i][j]=q//(d*d)
 return "\\n".join(" ".join(map(str,x)) for x in o)
""",[("round-up-average","q//(d*d)","(q+d*d-1)//(d*d)"),("skip-first-center-row","range(r,h-r)","range(r+1,h-r)")],"二维前缀和支持常数时间求任意正方形窗口和，合法中心替换为整除窗口面积的商。","前缀和容斥得到原图窗口和，向下整除即题目 floor 均值；仅写入完整窗口中心，其他格子保持原值。","O(hw) 时间与空间。",["矩阵","前缀和"]),
spec(4,"Currency Trading Strategy","策略值限于 −1（卖）、0（持有）、+1（买），当日利润为 −strategy[i]×rate[i]。恰选一个长度 k 的连续窗口，将窗口内策略重设为这三种合法值之一，求最大总利润。将 any value 解释为策略取值集合内任意值，是本站明确的类型约定。","n,k（1≤k≤n≤200000），rates 为 0..10⁹，strategy 为 −1/0/+1。范围为本站补充。","输出总利润（64 位）。",et,ot,rt,[([1,1,10],[0,0,1],1),([5,2,8],[1,-1,0],2),([4],[0],1)],"""import sys
def solve(s):
 z=list(map(int,s.split()));n,k=z[:2];a=z[2:2+n];b=z[2+n:2+2*n];base=sum(-x*y for x,y in zip(a,b));g=[abs(x)+x*y for x,y in zip(a,b)];w=sum(g[:k]);best=w
 for i in range(k,n):w+=g[i]-g[i-k];best=max(best,w)
 return str(base+best)
""",[("wrong-slide-update","w+=g[i]-g[i-k]","w+=g[i]+g[i-k]"),("wrong-window-gain","abs(x)+x*y","abs(x)-x*y")],"基准利润为 −Σstrategy×rate。重设某日策略后的最佳利润是 |rate|，所以窗口内单日增益为 |rate|+strategy×rate；滑窗取最大增益。","窗口外策略固定。窗口内每一天可独立取 −1、0、+1，最佳利润为费率绝对值；故对所有长度 k 窗口逐一比较增益即可得最优。","O(n) 时间、O(n) 空间。",["数组","滑动窗口"]),
spec(5,"Count Odd Digit-Zero Occurrences","统计十进制表示含有奇数个 0 的元素个数。整数 0 的表示为 0，因此自身含一个零。","n（1..200000），随后 n 个非负整数（≤10¹⁸）。范围为本站补充。","输出符合条件的元素个数。",eo,oo,ro,[[0,10,100,1010,1203],[1,2,3],[10001,10000,1000000,90909]],"""import sys
def solve(s):
 z=list(map(int,s.split()));n=z[0];ans=0
 for x in z[1:1+n]:
  if x==0:c=1
  else:
   c=0
   while x:
    c+=x%10==0;x//=10
  ans+=c%2
 return str(ans)
""",[("zero-has-no-zero-digit","if x==0:c=1","if x==0:c=0"),("skip-every-other-digit","x//=10","x//=100")],"逐位剥离每个十进制数并数零，数字 0 单独算作含一个零。","整数的每一个十进制位恰好被个位取模访问一次；特判 0 与其标准表示一致，奇偶判定直接等价于题意。","O(N log V) 时间、O(1) 额外空间。",["数字","模拟"]),
spec(7,"Max Valid Expression in Puzzle Matrix","表达式从任意数字格开始，只能一直向右或一直向下，不能转弯。字符必须按数字、+/-、数字交替；单个数字也是合法表达式。求合法路径表达式最大值。","h,w（1..100，hw≤10000），字符矩阵仅含数字、+、−，且至少一个数字。本站补充规模。","输出最大值。",ex,ox,rx,[([list("9-1+8")]),([["8"],["+"],["9"],["+"],["9"]]),([list("1+2"),list("3-4")])],"""import sys
def scan(a):
 ans=0;prev=None;sg=None;digit=False
 for c in a:
  if c.isdigit():
   x=int(c);v=x if sg is None or prev is None else max(x,prev+sg*x);ans=max(ans,v);prev=v;sg=None;digit=True
  elif c in "+-" and digit:sg=1 if c=="+" else -1;digit=False
  else:prev=None;sg=None;digit=False
 return ans
def solve(s):
 z=s.splitlines();h,w=map(int,z[0].split());g=[list(x) for x in z[1:1+h]];ans=max(scan(x) for x in g)
 for j in range(w):ans=max(ans,scan([g[i][j] for i in range(h)]))
 return str(ans)
""",[("swap-operator-signs",'sg=1 if c=="+" else -1','sg=-1 if c=="+" else 1'),("omit-vertical-paths","for j in range(w):","for j in []:")],"逐行及逐列线性扫描，记录以当前数字结束的最大表达式；合法的前一项可按中间符号延伸，也可在当前数字重新开始。","任何合法表达式都对应一行或一列上的连续片段。状态覆盖以当前数字结尾的所有片段：要么从当前数字新起，要么接在上一数字片段之后；遇到不合法字符即断开。枚举行列取最大得到全局最优。","O(hw) 时间，O(max(h,w)) 空间。",["动态规划","字符串"])
]
BLOCK=[
{"id":"oa-ebay-6","status":"blocked","reason":"题面示例 [3,3,5,2,3] 输出 6 与明确操作规则及源代码冲突：按规则第一次累加 3，变为 [0,0,2,2,0]；第二次累加 2，总和为 5。"},
{"id":"oa-ebay-8","status":"blocked","reason":"题面称每次新建房屋时与已有房屋均不相邻，但示例 [2,1,3] 第二步插入 1 已与已有 2 相邻；示例 [1,3,0,4] 亦违反该约束。"}
]
def main():
 for d in ("packages","editorials","references","oracles","mutants","negative-controls","candidate-batches","validation","reviews","source-evidence"):(OUT/d).mkdir(parents=True,exist_ok=True)
 items=[];reports=[];reviews=[];seed=20261005
 for s in S:
  pid=f"oa-ebay-{s['num']}";src=CAT[pid];code=textwrap.dedent(s["code"]).strip()+"\nif __name__=='__main__': print(solve(sys.stdin.read()))\n";ref=OUT/"references"/f"{pid}.py";ref.write_text(code)
  rng=random.Random(seed+s["num"]);vals=list(s["samples"]);seen={json.dumps(v,sort_keys=True,ensure_ascii=False) for v in vals}
  while len(vals)<163:
   v=s["gen"](rng);key=json.dumps(v,sort_keys=True,ensure_ascii=False)
   if key not in seen:seen.add(key);vals.append(v)
  oracle=[]
  for v in vals:
   data=s["enc"](v);want=s["oracle"](v);got=run(ref,data);assert got==want,(pid,v,want,got);oracle.append({"input":data,"expectedOutput":want+"\n"})
  cases=[{"name":f"样例 {i+1}",**x,"hidden":False,"weight":1} for i,x in enumerate(oracle[:3])]+[{"name":f"隐藏测试 {i+1}",**x,"hidden":True,"weight":1} for i,x in enumerate(oracle[3:33])]
  mutants=[];killed=[]
  for i,(name,old,new) in enumerate(s["mutants"],1):
   assert old in code,(pid,"anchor",old);m=code.replace(old,new);path=OUT/"negative-controls"/f"{pid}-{i}.py";path.write_text(m);bad=[j for j,c in enumerate(cases) if run(path,c["input"])!=c["expectedOutput"].rstrip("\n")];assert bad,(pid,"surviving or abnormal mutant",name);mutants.append({"name":name,"code":m});killed.append({"name":name,"rejectedByCases":bad})
  prob={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":s["title"],"difficulty":"中等","tags":["OA","eBay"]+list(s["tags"]),"description":s["desc"]+"\n\n题意依据 OAMaster 固定快照；本站补充的输入协议和限制由本站定义。","input":s["inp"],"output":s["out"],"explanation":"完整思路、证明和复杂度见配套题解。","hints":["先将题意转成明确的状态或局部操作。"],"timeLimit":3,"memoryLimit":262144,"outputLimit":4096,"checker":s["checker"],"languages":["python","go","java","cpp"]}
  raw={"schemaVersion":1,"problem":prob,"cases":cases};cmd="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
  norm=subprocess.run(["node","--import","tsx","-e",cmd],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True);assert norm.returncode==0,norm.stderr;pkg=json.loads(norm.stdout);explain=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['complexity']}";ed={"schemaVersion":1,"id":pid,"title":s["title"],"explanation":explain,"solutions":[{"language":"python","code":code}],"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"],"author":"CSWork"}
  for folder,obj in (("packages",pkg),("oracles",oracle),("mutants",mutants),("editorials",ed)):(OUT/folder/f"{pid}.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
  items.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(norm.stdout.encode()).hexdigest(),"editorial":explain,"authoredSolutions":ed["solutions"]})
  reports.append({"id":pid,"oracleCases":163,"uniqueOracleInputs":len({x["input"] for x in oracle}),"publicCases":3,"hiddenCases":30,"negativeControls":killed,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
  reviews.append({"id":pid,"status":"authored","reason":"已核对固定上游原始题面；本站协议和补充限制写入题面，163 个独立 oracle 输入及两个正常退出 mutant 通过本地验证；没有运行真实 GoJudge。","sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"sourceCommit":COMMIT,"rawPath":RAW,"rawGitBlob":BLOB,"catalogContentHash":src["contentHash"]})
  print(f"{pid}: 163 unique oracle inputs; 33 cases; two mutants killed",flush=True)
 batch="ebay-next";(OUT/f"candidate-batches/{batch}.json").write_text(json.dumps({"schemaVersion":1,"items":items},ensure_ascii=False,indent=2)+"\n");(OUT/f"validation/{batch}.json").write_text(json.dumps({"schemaVersion":1,"seed":seed,"problems":reports,"note":"Offline author/oracle/mutant checks only; no production sandbox validation."},ensure_ascii=False,indent=2)+"\n")
 for x in BLOCK:
  src=CAT[x["id"]];x.update({"sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"sourceCommit":COMMIT,"rawPath":RAW,"rawGitBlob":BLOB,"catalogContentHash":src["contentHash"]})
 (OUT/f"reviews/{batch}.json").write_text(json.dumps({"schemaVersion":1,"items":reviews+BLOCK},ensure_ascii=False,indent=2)+"\n")
 evidence=[]
 for x in CAT.values():
  if x["id"].startswith("oa-ebay-"):evidence.append({"id":x["id"],"catalogContentHash":x["contentHash"],"sourceUrl":x["sourceUrl"],"status":"blocked" if x["id"] in {b["id"] for b in BLOCK} else "authored","path":RAW,"gitBlobSha":BLOB})
 (OUT/f"source-evidence/{batch}.json").write_text(json.dumps({"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":COMMIT,"reason":"Read-only audit of the immutable original eBay MDX; no source solution code was executed.","items":evidence},ensure_ascii=False,indent=2)+"\n")
if __name__=="__main__":main()
