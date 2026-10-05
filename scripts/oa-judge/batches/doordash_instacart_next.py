"""Offline candidate packages for reviewed DoorDash and Instacart tasks."""
from pathlib import Path
import hashlib, json, random, subprocess, sys, textwrap
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/"content/oa-judge"
CAT={x["id"]:x for x in json.loads((ROOT/"content/oa-master/catalog.json").read_text())["items"]}
COMMIT="e66f809f4c953bce129f68491726176615db6afc"
def run(path,data): return subprocess.run([sys.executable,"-I",str(path)],input=data,text=True,capture_output=True,timeout=8,check=True).stdout.rstrip("\n")
def spec(pid,title,desc,inp,out,enc,oracle,gen,samples,code,mutants,idea,proof,complexity,raw,blob,tags):
 return locals()
def price_enc(v):
 a,qs=v; return f"{len(a)} {len(qs)}\n"+" ".join(map(str,a))+"\n"+"".join(" ".join(map(str,q))+"\n" for q in qs)
def price_or(v):
 a,qs=v;a=a[:]
 for t,x,y in qs:
  if t==1:a[x-1]=y
  else:a=[max(z,x) for z in a]
 return " ".join(map(str,a))
def price_gen(r):
 n=r.randint(1,10);return [r.randint(1,25) for _ in range(n)],[(1,r.randint(1,n),r.randint(1,25)) if r.random()<.55 else (2,r.randint(1,25),0) for _ in range(r.randint(1,14))]
def grid_enc(v):
 g,qs=v;return f"{len(g)} {len(g[0])} {len(qs)}\n"+"\n".join("".join(x) for x in g)+"\n"+"".join(f"{a} {b}\n" for a,b in qs)
def grid_or(v):
 from collections import deque
 g,qs=v;R=len(g);C=len(g[0]);ans=[]
 for sr,sc in qs:
  if not(0<=sr<R and 0<=sc<C) or g[sr][sc]=="X":ans.append(-1);continue
  q=deque([(sr,sc,0)]);seen={(sr,sc)};d=-1
  while q:
   r,c,k=q.popleft()
   if g[r][c]=="D":d=k;break
   for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
    x,y=r+dr,c+dc
    if 0<=x<R and 0<=y<C and g[x][y]!="X" and (x,y) not in seen:seen.add((x,y));q.append((x,y,k+1))
  ans.append(d)
 return " ".join(map(str,ans))
def grid_gen(r):
 R=r.randint(1,6);C=r.randint(1,6);g=[["X" if r.random()<.25 else " " for _ in range(C)] for _ in range(R)];g[r.randrange(R)][r.randrange(C)]="D"
 return g,[(r.randrange(-1,R+1),r.randrange(-1,C+1)) for _ in range(r.randint(1,10))]
def friends_enc(v):
 n,qs=v;return f"{n} {len(qs)}\n"+"".join(f"{t} {a} {b}\n" for t,a,b in qs)
def friends_or(v):
 n,qs=v;groups=[{i} for i in range(n+1)];who=list(range(n+1));ans=0
 for t,a,b in qs:
  if t=="F" and who[a]!=who[b]:
   x,y=who[a],who[b];groups[x]|=groups[y]
   for z in groups[y]:who[z]=x
   groups[y]=set()
  elif t=="T":ans+=len(groups[who[a]])+len(groups[who[b]])
 return str(ans)
def friends_gen(r):
 n=r.randint(1,10);return n,[(r.choice("FFFT"),r.randint(1,n),r.randint(1,n)) for _ in range(r.randint(1,18))]
def chefs_enc(v):
 a,d,p=v;return f"{len(a)}\n"+" ".join(map(str,a))+f"\n{len(d)}\n"+" ".join(map(str,d))+"\n"+" ".join(map(str,p))+"\n"
def chefs_or(v):
 a,d,p=v;return str(sum(max([x for y,x in zip(d,p) if y<=s]+[0]) for s in a))
def chefs_gen(r):
 a=[r.randint(0,15) for _ in range(r.randint(1,10))];d=[r.randint(0,15) for _ in range(r.randint(1,10))]
 return a,d,[r.randint(0,30) for _ in d]
def team_enc(v):
 a,k,m=v;return f"{len(a)} {m} {k}\n"+" ".join(map(str,a))+"\n"
def team_or(v):
 a,k,m=v;a=a[:];ans=0
 for _ in range(m):
  ids=list(range(min(k,len(a))))+list(range(max(0,len(a)-k),len(a)))
  i=min(ids,key=lambda x:(-a[x],x));ans+=a.pop(i)
 return str(ans)
def team_gen(r):
 n=r.randint(1,20);return [r.randint(-10,30) for _ in range(n)],r.randint(1,n),r.randint(1,n)
def balloon_enc(v):
 n,qs=v;return f"{n} {len(qs)}\n"+"".join(f"{i} {c}\n" for i,c in qs)
def balloon_or(v):
 n,qs=v;a=[None]*n;out=[]
 for i,c in qs:
  a[i]=c;out.append(sum(a[j] is not None and a[j]==a[j+1] for j in range(n-1)))
 return " ".join(map(str,out))
def balloon_gen(r):
 n=r.randint(1,14);return n,[(r.randrange(n),r.randint(1,5)) for _ in range(r.randint(1,18))]
def sticks_enc(v):
 a,b=v;return f"{len(a)} {b}\n"+" ".join(map(str,a))+"\n"
def sticks_or(v):
 a,b=v;left=[i for i in range(b-1,-1,-1) if a[i]];right=[i for i in range(b+1,len(a)) if a[i]];li=ri=0;side=1;total=0;out=[]
 while total<100:
  if side==1:i=right[ri];ri+=1
  else:i=left[li];li+=1
  out.append(i);total+=a[i];side=-side
 return " ".join(map(str,out))
def sticks_gen(r):
 n=r.randint(6,22);b=r.randrange(2,n-2);a=[r.randint(0,90) for _ in range(n)];a[b+1]=r.randint(50,90);a[b-1]=r.randint(50,90);return a,b
S=[
spec("oa-doordash-1","Adjust Prices","依次执行操作：1 x v 将第 x 件商品改价为 v；2 v 0 将所有低于 v 的价格提高到 v。原题将第二类操作写作 2 v v，因后两字段重复，本站规范化为 2 v 0；仍以第二字段 v 表示全局下限。","n q (1≤n,q≤100000)，初始价格数组，随后 q 行操作。价格 1..10⁹，点下标 1-based。","输出最终价格。",price_enc,price_or,price_gen,[([3,1,8],[(2,5,0),(1,2,2),(2,7,0)]),([1],[(1,1,9),(2,4,0)]),([10,20],[(2,10,0),(1,1,1)])],
"""import sys
def solve(s):
 z=list(map(int,s.split()));n,q=z[:2];a=z[2:2+n];ops=[z[2+n+3*i:5+n+3*i] for i in range(q)];floor=0;last=[None]*n
 for t,x,v in reversed(ops):
  if t==2:floor=max(floor,x)
  elif last[x-1] is None:last[x-1]=max(v,floor)
 return " ".join(str(max(a[i],floor) if last[i] is None else last[i]) for i in range(n))
""",[("omit-post-assignment-floor","max(v,floor)","v"),("ignore-final-floor","max(a[i],floor) if last[i] is None else last[i]","max(a[i],floor) if last[i] is None else max(last[i],floor)")],"倒序扫描操作，维护后续全局抬价的最大下限；每件商品只需记录最后一次正向单点赋值及其后的抬价。","反向遇到的首个单点赋值就是该位置最后一次正向赋值，其后全局操作影响其最终值；若从未被赋值，则初始价经历所有全局下限。两种情形由数组记录与初值分别精确计算。","O(n+q) 时间与空间。","fastprep/DoorDash/doordash-adjust-prices.md","8f6dfd7f2cb5830221d04ad22ff09876873c0fb7",["数组","倒序"]),
spec("oa-doordash-2","Closest DashMart","网格字符：空格为道路、X 为墙、D 为仓库。只能上下左右移动，查询到最近仓库的最短距离；墙格、越界或不可达查询返回 -1。","R C Q，R 行字符网格，Q 个 0-based 坐标。本站补充 R,C≤1000、RC≤200000、Q≤200000。","输出 Q 个距离。",grid_enc,grid_or,grid_gen,[([list("D  "),list(" XX"),list("   ")],[(0,0),(0,2),(2,0),(1,1),(9,0)]),([list("XDX")],[(0,0),(0,1),(0,2)]),([list("D"),list("X")],[(0,0),(1,0)])],
"""import sys
from collections import deque
def solve(s):
 z=s.splitlines();R,C,Q=map(int,z[0].split());g=[list(x) for x in z[1:1+R]];d=[[-1]*C for _ in range(R)];q=deque()
 for i in range(R):
  for j in range(C):
   if g[i][j]=="D":d[i][j]=0;q.append((i,j))
 while q:
  i,j=q.popleft()
  for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
   x,y=i+di,j+dj
   if 0<=x<R and 0<=y<C and g[x][y]!="X" and d[x][y]<0:d[x][y]=d[i][j]+1;q.append((x,y))
 return " ".join(str(d[i][j] if 0<=i<R and 0<=j<C else -1) for i,j in (map(int,x.split()) for x in z[1+R:1+R+Q]))
""",[("diagonal-walk","((1,0),(-1,0),(0,1),(0,-1))","((1,1),(-1,-1),(1,-1),(-1,1))"),("enter-walls",'g[x][y]!="X"',"True")],"从全部仓库同时执行多源 BFS，得到每个可通行位置到最近仓库的距离，逐个回答查询。","BFS 按距离递增扩展；首次访问某格即是其从任一仓库出发的最短四邻接距离。墙不入队，未访问及非法坐标均返回 -1。","O(RC+Q) 时间，O(RC) 空间。","fastprep/DoorDash/doordash-closest-dashmart.md","8d090c3c272fa4a6ab841f6d85b4286123f5aa41",["图","BFS"]),
spec("oa-doordash-5","Get Sizes of Friends Groups","初始每人属于一个单人组。F a b 合并两人所在组；T a b 将两人所在组的人数之和累计。若两人已在同组，按题面两个对象分别取组大小，即计两次。输出所有 T 的总和。","n q≤100000，接着 q 行 F/T 和两个 1..n 的 ID。","输出累计值，使用 64 位整数。",friends_enc,friends_or,friends_gen,[(4,[("F",1,2),("F",2,3),("T",1,4)]),(2,[("T",1,1)]),(3,[("F",1,2),("T",1,2),("F",1,2),("T",1,3)])],
"""import sys
def solve(s):
 z=s.split();n,q=map(int,z[:2]);p=list(range(n+1));sz=[1]*(n+1)
 def f(x):
  while x!=p[x]:p[x]=p[p[x]];x=p[x]
  return x
 ans=0;i=2
 for _ in range(q):
  t=z[i];a,b=map(int,z[i+1:i+3]);i+=3;x,y=f(a),f(b)
  if t=="F" and x!=y:
   if sz[x]<sz[y]:x,y=y,x
   p[y]=x;sz[x]+=sz[y]
  elif t=="T":ans+=sz[x]+sz[y]
 return str(ans)
""",[("same-group-once",'ans+=sz[x]+sz[y]','ans+=sz[x] if x==y else sz[x]+sz[y]'),("skip-size-update","sz[x]+=sz[y]","pass")],"并查集维护代表元和组大小。F 按大小合并，T 将两组规模相加并累计。","代表元标识连通分量，合并维护正确组大小。每个 Total 查询按两个学生分别取各自所在组规模，因此同组时也按题面计两次。","O((n+q)α(n)) 时间，O(n) 空间。","fastprep/DoorDash/doordash-get-sizes-of-friends-groups.md","4babe198b5cca414ade5da150c20427da6dbceda",["并查集"]),
spec("oa-doordash-6","Maximize Total Profit by Assigning Chefs to Dishes","每位厨师最多做一道菜，菜品可被多人选；厨师仅能做难度≤技能的菜，并为每位厨师选择可做菜中的最高利润。没有可做菜时利润为 0。","n（1..200000）和 n 个技能值；m（1..200000）、m 个难度及 m 个利润；所有值为 0..10⁹。本站采用原题给出的典型限制。","输出总利润（64 位）。",lambda v:f"{len(v[0])}\n"+" ".join(map(str,v[0]))+f"\n{len(v[1])}\n"+" ".join(map(str,v[1]))+"\n"+" ".join(map(str,v[2]))+"\n",lambda v:str(sum(max([p for d,p in zip(v[1],v[2]) if d<=s]+[0]) for s in v[0])),chefs_gen,[([1,2,3],[1,2,3],[1,2,3]),([0,1],[2,0],[100,7]),([2,2],[1,3],[8,99])],
"""import sys
from bisect import bisect_right
def solve(s):
 z=list(map(int,s.split()));p=0;n=z[p];p+=1;a=z[p:p+n];p+=n;m=z[p];p+=1;d=z[p:p+m];p+=m;v=z[p:p+m];pairs=sorted(zip(d,v));ds=[];best=[];mx=0
 for x,y in pairs:mx=max(mx,y);ds.append(x);best.append(mx)
 return str(sum(best[i-1] if (i:=bisect_right(ds,x)) else 0 for x in a))
""",[("too-hard-allowed","bisect_right(ds,x)","bisect_right(ds,x-1)"),("last-profit-only","mx=max(mx,y)","mx=y")],"按难度排序并预计算前缀最大利润；对每个厨师二分出可胜任菜品前缀并累加其最大利润。","每位厨师可独立选择，菜品不互斥；其可行集合恰为按难度排序的前缀，最优即前缀最大利润。","O((n+m)log m) 时间，O(m) 空间。","fastprep/DoorDash/doordash-maximize-total-profit-chef-dish-assignment.md","6c6be5474da885bd84fb050fc4ef4bd705e67e71",["排序","二分"]),
spec("oa-doordash-8","Team Formation","每轮从剩余序列前 k 人和后 k 人的并集中选择最高分者；窗口重叠只计一次。同分选择原始下标最小者。移除并累计，直到选满 team_size。","n team_size k，1≤n≤2000、1≤team_size,k≤n；随后 n 个分数（−10⁹..10⁹）。n 与分数范围为本站补充。","输出分数总和，使用 64 位整数。",team_enc,team_or,team_gen,[([17,12,10,2,7,2,11,20,8],4,3),([5,5,5,5],1,3),([-1,-8,-2],2,2)],
"""import sys
def solve(s):
 z=list(map(int,s.split()));n,m,k=z[:3];a=list(enumerate(z[3:3+n]));ans=0
 for _ in range(m):
  cand=a[:k]+a[max(0,len(a)-k):];idx,val=min(cand,key=lambda x:(-x[1],x[0]));ans+=val;a.remove((idx,val))
 return str(ans)
""",[("tie-rightmost","(-x[1],x[0])","(-x[1],-x[0])"),("ignore-back-window","a[:k]+a[max(0,len(a)-k):]","a[:k]")],"每轮构造两个候选窗口的并集，按分数降序、原下标升序选择，再将该员工从序列删除。","候选集合与题面两个窗口的并集一致；排序键实现最高分优先且同分取最早下标。逐轮删除保持剩余序列顺序，符合定义。","O(n·team_size) 时间；本站 n≤2000，O(n) 空间。","fastprep/DoorDash/doordash-team-formation.md","490e3608129bf0d39b7c35f30ab29a05d87f9f3b",["模拟"]),
spec("oa-instacart-1","Balloon Color Pairs","位置初始为空；每个查询将位置染成给定颜色（可以覆盖）。每次查询后统计相邻、均已染色且颜色相同的位置对。","length,q≤200000，随后 q 行 0-based index 与正颜色值。","每次操作后的计数。",balloon_enc,balloon_or,balloon_gen,[(5,[(0,1),(1,1),(2,1),(1,3)]),(1,[(0,4),(0,4)]),(3,[(0,2),(2,2),(1,2)])],
"""import sys
def solve(s):
 z=list(map(int,s.split()));n,q=z[:2];a=[0]*n;p=0;out=[]
 for j in range(q):
  i,c=z[2+2*j:4+2*j]
  if a[i]:
   if i and a[i-1]==a[i]:p-=1
   if i+1<n and a[i+1]==a[i]:p-=1
  a[i]=c
  if i and a[i-1]==c:p+=1
  if i+1<n and a[i+1]==c:p+=1
  out.append(p)
 return " ".join(map(str,out))
""",[("omit-old-contribution","if a[i]:","if False:"),("count-empty-neighbor","if i and a[i-1]==c:p+=1","if i and (a[i-1]==c or a[i-1]==0):p+=1")],"维护数组和相邻同色对数。更新前撤销该位置与左右邻居的旧贡献，换色后再添加新贡献。","更新只可能改变与该位置相邻的两条边；移除旧贡献、加入新贡献后，其余边不变，因此计数保持正确。","O(q) 时间，O(length) 空间。","fastprep/Instacart/instacart-balloon-color-pairs.md","5f051b01582f3c61915fc902a1ffd7b01def3944",["数组"]),
spec("oa-instacart-2","Collect Sticks","鸟从空位出发，先向右取最近的非空木棍并返回起点，之后向左、向右交替，直到取走木棍长度总和至少 100。保证所需方向总有木棍。输出取走的 0-based 索引。","n≤2000，n 个长度（0..10⁹，0 为空），以及 0-based 空位 bird；起点为空，并保证到累计长度至少 100 前，当前方向总有木棍可取。n 上限与长度范围为本站补充。内部累计长度可超过 32 位。","索引顺序。",sticks_enc,sticks_or,sticks_gen,[([0,50,0,30,0,25],2),([40,0,0,60,0,50,0,10],2),([5,0,60,0,50],1)],
"""import sys
def solve(s):
 z=list(map(int,s.split()));n,b=z[:2];a=z[2:];total=0;d=1;out=[]
 while total<100:
  i=b+d
  while a[i]==0:i+=d
  out.append(i);total+=a[i];a[i]=0;d=-d
 return " ".join(map(str,out))
""",[("start-left","d=1","d=-1"),("stop-too-early","while total<100:","while total<50:")],"从起点按当前方向线性扫描到最近剩余木棍，取走、累计长度并反转方向；总长达到 100 即停止。","线性扫描找到该方向最近非空位置；清零保证不重复取。交替方向与题意一致，循环条件使停止时恰在首次达到阈值后。","O(n²) 最坏；本站 n≤2000，O(1) 额外空间。","fastprep/Instacart/instacart-collect-sticks.md","d4c1a6089e3dc3bb95e2e8294dc90e7bd2d4a8d0",["模拟"])
]
BLOCK=[
{"id":"oa-doordash-3","status":"blocked","reason":"原题与样例无法消除关键歧义：是否必须删除字符、可否删除整个字符串以及无解表示均不明确，不同解释产生不同答案。"},
{"id":"oa-doordash-4","status":"blocked","reason":"题意与 DoorDash #1 Adjust Prices 重复，不作为独立题目重复收录。"},
{"id":"oa-doordash-7","status":"blocked","reason":"题面与样例对局部峰值选择规则冲突，平局、端点及不存在峰值时的规则缺失，无法唯一确定输出。"},
{"id":"oa-instacart-3","status":"blocked","reason":"规则写的是选中泡泡的四个对角邻居，样例解释却暗示继续级联检查，且说明有错误；级联语义不能可靠确定，暂缓。"}]
def main():
 for d in ("packages","editorials","references","oracles","mutants","negative-controls","candidate-batches","validation","reviews"):(OUT/d).mkdir(parents=True,exist_ok=True)
 items=[];reports=[];reviews=[];seed=20261005
 for s in S:
  pid=s["pid"];src=CAT[pid];code=textwrap.dedent(s["code"]).strip()+"\nif __name__=='__main__': print(solve(sys.stdin.read()))\n";ref=OUT/"references"/f"{pid}.py";ref.write_text(code)
  rng=random.Random(seed+int(pid.rsplit("-",1)[1])+(100 if "instacart" in pid else 0));vals=list(s["samples"]);seen={json.dumps(v,sort_keys=True) for v in vals}
  while len(vals)<163:
   v=s["gen"](rng);k=json.dumps(v,sort_keys=True)
   if k not in seen:seen.add(k);vals.append(v)
  oracle=[]
  for v in vals:
   data=s["enc"](v);expected=s["oracle"](v);actual=run(ref,data);assert actual==expected,(pid,v,expected,actual);oracle.append({"input":data,"expectedOutput":expected+"\n"})
  cases=[{"name":f"样例 {i+1}",**x,"hidden":False,"weight":1} for i,x in enumerate(oracle[:3])]+[{"name":f"隐藏测试 {i+1}",**x,"hidden":True,"weight":1} for i,x in enumerate(oracle[3:33])]
  muts=[];killed=[]
  for i,(name,old,new) in enumerate(s["mutants"],1):
   assert old in code,(pid,"mutation anchor",old);mut=code.replace(old,new);ctrl=OUT/"negative-controls"/f"{pid}-{i}.py";ctrl.write_text(mut)
   rejected=[j for j,c in enumerate(cases) if run(ctrl,c["input"])!=c["expectedOutput"].rstrip("\n")]
   assert rejected,(pid,"surviving mutant",name);muts.append({"name":name,"code":mut});killed.append({"name":name,"rejectedByCases":rejected})
  p={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":s["title"],"difficulty":"中等","tags":["OA",src["companyName"]]+s["tags"],"description":s["desc"]+"\n\n语义依照 OAMaster 原题。输入协议及‘本站补充’的限制由本站整理，不表示原题提供这些限制。","input":s["inp"],"output":s["out"],"explanation":"思路、正确性证明与复杂度见配套题解。","hints":["先厘清边界、操作和计数规则，再选适合的数据结构或状态转移。"],"timeLimit":3,"memoryLimit":262144,"outputLimit":4096,"checker":"tokens","languages":["python","go","java","cpp"]}
  raw={"schemaVersion":1,"problem":p,"cases":cases};cmd="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
  norm=subprocess.run(["node","--import","tsx","-e",cmd],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True);assert norm.returncode==0,norm.stderr;package=json.loads(norm.stdout)
  idea,proof,complexity=s["idea"],s["proof"],s["complexity"];ex=f"## 思路\n\n{idea}\n\n## 正确性\n\n{proof}\n\n## 复杂度\n\n{complexity}";editorial={"schemaVersion":1,"id":pid,"title":s["title"],"explanation":ex,"solutions":[{"language":"python","code":code}],"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"],"author":"CSWork"}
  for folder,obj in (("packages",package),("oracles",oracle),("mutants",muts),("editorials",editorial)):(OUT/folder/f"{pid}.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
  items.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(norm.stdout.encode()).hexdigest(),"editorial":ex,"authoredSolutions":editorial["solutions"]})
  reports.append({"id":pid,"oracleCases":163,"uniqueOracleInputs":len({x["input"] for x in oracle}),"publicCases":3,"hiddenCases":30,"negativeControls":killed,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
  reviews.append({"id":pid,"status":"authored","reason":"已核对 OAMaster 固定快照原题；本站协议与补充限制已写入题面。163 个独立 oracle 输入、参考程序及两个正常退出错误变异程序通过本地验证；未做真实 GoJudge 验证。","sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"sourceCommit":COMMIT,"rawPath":s["raw"],"rawGitBlob":s["blob"],"catalogContentHash":src["contentHash"]})
  print(f"{pid}: 163 unique oracle inputs, 33 cases, two mutants rejected",flush=True)
 batch="doordash-instacart-next"
 # A real GoJudge report is the only condition that promotes this manifest
 # into the runtime batch directory; offline authoring stays candidate-only.
 target="batches" if (OUT/f"reports/{batch}.json").exists() else "candidate-batches"
 (OUT/f"{target}/{batch}.json").write_text(json.dumps({"schemaVersion":1,"items":items},ensure_ascii=False,indent=2)+"\n")
 (OUT/f"validation/{batch}.json").write_text(json.dumps({"schemaVersion":1,"seed":seed,"problems":reports,"note":"Local-only validation; no real GoJudge sandbox acceptance or publication."},ensure_ascii=False,indent=2)+"\n")
 for x in BLOCK:
  c=CAT[x["id"]];x.update({"sourceUrls":[c["sourceUrl"]],"sourceContentHashes":[c["contentHash"]],"sourceCommit":COMMIT,"catalogContentHash":c["contentHash"]})
 (OUT/f"reviews/{batch}.json").write_text(json.dumps({"schemaVersion":1,"items":reviews+BLOCK},ensure_ascii=False,indent=2)+"\n")
 raw_items=[]
 for s in S:
  src=CAT[s["pid"]];raw_items.append({"id":s["pid"],"catalogContentHash":src["contentHash"],"sourceUrl":src["sourceUrl"],"status":"authored","reason":"已核对固定快照原始题面；协议补充和离线验证结论见对应 review。","path":s["raw"],"gitBlobSha":s["blob"]})
 blocked_raw={"oa-doordash-3":("fastprep/DoorDash/doordash-find-difference-value.md","1105648829cce907ce197aa9299643ec3492309d"),"oa-doordash-4":("fastprep/DoorDash/doordash-get-final-price.md","ed828ab7f308c1c34388b6ea45b06b94d97d4a43"),"oa-doordash-7":("fastprep/DoorDash/doordash-return-priority-of-order-ids.md","c7dcf2ffec77a1fe7307c8821ca0dfb3c510132c"),"oa-instacart-3":("fastprep/Instacart/instacart-pop-bubbles.md","7f23cc455c533e8e353454e6e811e42eecba33be")}
 for x in BLOCK:
  c=CAT[x["id"]];path,blob=blocked_raw[x["id"]];raw_items.append({"id":x["id"],"catalogContentHash":c["contentHash"],"sourceUrl":c["sourceUrl"],"status":"blocked","reason":x["reason"],"path":path,"gitBlobSha":blob})
 (OUT/f"source-evidence/{batch}.json").write_text(json.dumps({"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":COMMIT,"reason":"Read-only inspection of the immutable source snapshot; upstream solution code was not executed.","items":raw_items},ensure_ascii=False,indent=2)+"\n")
if __name__=="__main__":main()
