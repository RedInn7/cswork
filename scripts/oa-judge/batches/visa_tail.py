"""Build offline Visa tail candidates; never writes formal batches or registry."""
from pathlib import Path
import hashlib,json,random,subprocess,sys,textwrap

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/"content/oa-judge"
CAT={x["id"]:x for x in json.loads((ROOT/"content/oa-master/catalog.json").read_text())["items"]}
SOURCE_COMMIT="e66f809f4c953bce129f68491726176615db6afc"
MDX_BLOB="1fcf3d36148af03975bb074843e1d4a559ad662e"
MDX_SHA="3ecef8fa0f9f9d683cf601b1b54299c4053a15a4d6ad6c68938799c1196b40c2"

def run(path,data):
    return subprocess.run([sys.executable,"-I",str(path)],input=data,text=True,capture_output=True,check=True,timeout=10).stdout.rstrip("\n")

def ec(v): return v+"\n"
def oc(s): return str(sum(1 if "A"<=c<="Z" else -1 if "a"<=c<="z" else 0 for c in s))
def rc(r): return "".join(r.choice("AaBbCcXYZxyz") for _ in range(r.randint(1,50)))

def echat(events):
    lines=[str(len(events))]
    for e in events:
        if e[0]=="M":
            _,sender,ts,tokens=e
            lines.append("MESSAGE "+sender+" "+str(ts)+" "+str(len(tokens))+(" "+" ".join(tokens) if tokens else ""))
        else: lines.append("OFFLINE "+e[1])
    return "\n".join(lines)+"\n"
def ochat(events):
    users=set(); active=set(); counts={}
    for e in events:
        if e[0]=="M":
            _,sender,ts,tokens=e; users.add(sender); active.add(sender); mentioned=set()
            for token in tokens:
                if token=="ALL": mentioned |= users
                elif token=="HERE": mentioned |= active
                else: mentioned.add(token)
            for uid in mentioned: counts[uid]=counts.get(uid,0)+1
        else: active.discard(e[1])
    return " ".join(f"{u}={counts[u]}" for u in sorted(counts))
def rchat(r):
    ids=[f"id{i}" for i in range(1,6)]; events=[]
    for t in range(r.randint(1,18)):
        if r.random()<.25: events.append(("O",r.choice(ids)))
        else:
            toks=[r.choice(ids+["ALL","HERE"]) for _ in range(r.randint(0,6))]
            events.append(("M",r.choice(ids),t,toks))
    return events

def earr(a): return f"{len(a)}\n"+" ".join(map(str,a))+"\n"
def opeak(a):
    cur=list(a)
    while True:
        nxt=[]
        for i,x in enumerate(cur):
            if i==0 or i==len(cur)-1 or (x>cur[i-1] and x>cur[i+1]): nxt.append(x)
        if nxt==cur: return str(len(cur))+" "+" ".join(map(str,cur))
        cur=nxt
def rarr(r): return [r.randint(-20,30) for _ in range(r.randint(1,30))]

def emat(rows):
    return f"{len(rows)} {len(rows[0])}\n"+"\n".join(" ".join(map(str,row)) for row in rows)+"\n"
def make_blocks(miss,holes):
    n=len(miss); rows=[[0]*(4*n) for _ in range(4)]
    for b,(v,hole) in enumerate(zip(miss,holes)):
        vals=[x for x in range(1,17) if x!=v]; k=0
        for z in range(16):
            r,c=divmod(z,4); rows[r][4*b+c]=-1 if z==hole else vals[k]
            if z!=hole: k+=1
    return rows
def omatrix(rows):
    n=len(rows[0])//4; blocks=[]
    for b in range(n):
        vals=[rows[r][4*b+c] for r in range(4) for c in range(4)]
        v=136-sum(x for x in vals if x!=-1); k=0; full=[]
        for x in vals:
            if x==-1: full.append(v)
            else: full.append(x)
        blocks.append((v,b,full))
    order=sorted(blocks,key=lambda x:(x[0],x[1]))
    out=[[0]*(4*n) for _ in range(4)]
    for b,(_,_,flat) in enumerate(order):
        for z,v in enumerate(flat): r,c=divmod(z,4); out[r][4*b+c]=v
    return "\n".join(" ".join(map(str,row)) for row in out)
def rmatrix(r):
    n=r.randint(1,9); return make_blocks([r.randint(1,16) for _ in range(n)],[r.randrange(16) for _ in range(n)])

def ecity(a): return f"{len(a)}\n"+" ".join(map(str,a))+"\n"
def ocity(a):
    best=0
    for l in range(len(a)):
        low=a[l]
        for r in range(l,len(a)):
            low=min(low,a[r]); side=min(low,r-l+1); best=max(best,side)
    return str(best*best)
def rcity(r): return [r.randint(0,25) for _ in range(r.randint(1,20))]

def eblocks(rows): return emat(rows)
def oblocks(rows):
    n=len(rows[0])//4; blocks=[]
    for b in range(n):
        vals=[rows[r][4*b+c] for r in range(4) for c in range(4)]
        missing=136-sum(x for x in vals if x!=-1)
        filled=[missing if x==-1 else x for x in vals]
        blocks.append((missing,b,filled))
    blocks.sort(key=lambda x:(x[0],x[1]))
    out=[[0]*(4*n) for _ in range(4)]
    for dest,(_,_,flat) in enumerate(blocks):
        for z,x in enumerate(flat): row,col=divmod(z,4); out[row][dest*4+col]=x
    return "\n".join(" ".join(map(str,row)) for row in out)
def rblocks(r):
    n=r.randint(1,10); return make_blocks([r.randint(1,16) for _ in range(n)],[r.randrange(16) for _ in range(n)])

def spec(pid,title,desc,inp,out,encode,oracle,random_case,samples,code,mutants,idea,proof,complexity,tags):
    return locals()

SPECS=[
spec("oa-visa-1","Letter Case Difference","统计 typedText 中大写英文字母数减去小写英文字母数。","输入仅含英文字母 A-Z、a-z 的非空字符串；长度 1..200000（本站补充）。","输出大写数减小写数。",ec,oc,rc,["AbCd","Aaa","xyzXYZ"],"""import sys
def solve(s):
 t=s.strip(); return str(sum(1 if 'A'<=c<='Z' else -1 if 'a'<=c<='z' else 0 for c in t))
""",[("reverse-sign","1 if 'A'<=c<='Z' else -1 if 'a'<=c<='z' else 0","-1 if 'A'<=c<='Z' else 1 if 'a'<=c<='z' else 0"),("ignore-lowercase","else -1 if 'a'<=c<='z' else 0","else 0")],"单次扫描字符串，遇大写字母加一，遇小写字母减一。","每个字符对答案的贡献恰为大写 +1、小写 −1；逐字符相加即为目标差值。","时间 O(n)，额外空间 O(1)。",["字符串","计数"]),
spec("oa-visa-3","Chat Mention Counter","按事件顺序处理消息和离线事件。消息发送者在发言时成为已存在且活跃用户。提及 token 可为用户 ID、ALL 或 HERE；ALL 覆盖所有已存在用户，HERE 覆盖当前活跃用户。每个用户每条消息最多计数一次；自我提及计数。输出有正计数的 ID 及次数，按 ID 字典序排列。","q（1≤q≤1000）。后接 q 行：MESSAGE sender timestamp m token1..tokenm，或 OFFLINE user。m≥0，ID 形如 id 加正整数；时间戳为非负整数，按输入事件顺序处理。所有直接提及 token 总数≤200000；q≤1000 是本站补充的展开规模限制。","每行输出 id=count，按 ID 字典序排列，以空格分隔；没有计数时输出空行。",echat,ochat,rchat,[[("M","id1",1,["id1","id2","id2"])],[("M","id1",1,["ALL"])],[("M","id1",1,["HERE"]),("O","id1"),("M","id2",2,["HERE"])]],"""import sys
def solve(raw):
 lines=raw.splitlines(); q=int(lines[0]); users=set(); active=set(); cnt={}
 for line in lines[1:1+q]:
  p=line.split()
  if p[0]=='OFFLINE': active.discard(p[1]); continue
  sender=p[1]; users.add(sender); active.add(sender); m=int(p[3]); toks=p[4:4+m]
  mentioned=set(); direct=[]
  for tok in toks:
   if tok=='ALL': mentioned.update(users)
   elif tok=='HERE': mentioned.update(active)
   else: direct.append(tok)
  mentioned.update(direct)
  for u in mentioned: cnt[u]=cnt.get(u,0)+1
 return ' '.join(f'{u}={cnt[u]}' for u in sorted(cnt))
""",[("count-duplicate-direct","mentioned.update(direct)","mentioned.update(set(direct))\n  # direct duplicates must count separately\n  mentioned.update([])\n  # placeholder"),("offline-deletes-existing","active.discard(p[1]); continue","active.discard(p[1]); users.discard(p[1]); continue")],"维护已存在用户集合、活跃用户集合和计数表。消息先激活发送者，再把本条的显式提及及 ALL/HERE 展开后合并为集合，集合中每个用户只增加一次。OFFLINE 仅移出活跃集合。","逐条处理事件可保持状态与事件序一致。对任意一条消息，提及集合恰由直接 ID、已存在用户或活跃用户按 token 并集而成；集合去重确保一人本条最多计一次。只从 active 删除用户不会抹去其存在性。","设 U 为已出现 ID 数，q≤1000，直接 token 总数 M。最坏显式展开 O(qU+M)，空间 O(U+M)；本站限制保证展开规模可控。",["哈希表","模拟"]),
spec("oa-visa-5","Greater-Than-Neighbors Stabilization","重复同步过滤数组：保留首尾元素，以及严格大于其左右邻居的内部元素；每轮比较使用本轮开始时的数组。直到一轮不再变化，返回最终数组。","n（1≤n≤200000），随后 n 个整数（绝对值≤10^9，本站补充）。","输出最终数组长度及元素。",earr,opeak,rarr,[[3,6,4,8,2,9],[1],[1,2,2,1,5]],"""import sys
def solve(s):
 z=list(map(int,s.split())); a=z[1:]
 while True:
  b=[]
  for i,x in enumerate(a):
   if i==0 or i==len(a)-1 or (x>a[i-1] and x>a[i+1]): b.append(x)
  if b==a: return str(len(a))+' '+' '.join(map(str,a))
  a=b
""",[("allow-equal-peak","x>a[i-1] and x>a[i+1]","x>=a[i-1] and x>=a[i+1]"),("one-round-only","while True:","if True:")],"每轮根据旧数组标记首尾及严格局部峰并同时保留；若结果未变即稳定，否则对新数组重复。","某轮中每个元素是否保留只由该轮原数组的邻居决定，故扫描得到的列表正是下一轮数组。循环直到不变，满足定义的固定点，且每个变化轮至少删去一个元素，必终止。","每轮 O(n)，内部严格局部峰不能相邻，因此非平凡一轮后数组长度至多约减半，轮数 O(log n)；总时间 O(n log n)，空间 O(n)。",["数组","模拟"]),
spec("oa-visa-14","Arrange Squares by Missing Values","给定 4×4n 网格，划分为 n 个并排 4×4 方块。每块包含 1..16 中除一个值外的其余值，缺失格标 -1。用 136 减去其余 15 格之和求缺失值，再把完整方块按缺失值升序从左到右排列。若缺失值相同，本站补充按原先从左到右顺序稳定排列。","第一行 n（1≤n≤10000，本站补充），随后 4 行各 4n 个数。每个 4×4 块必须恰含 -1 和 1..16 中其余 15 个不同值。","输出重排后的 4 行网格。",eblocks,oblocks,rblocks,[make_blocks([12,7],[0,15]),make_blocks([4],[5]),make_blocks([7,7,3],[2,8,14])],"""import sys
def solve(s):
 t=list(map(int,s.split())); rows,cols=t[:2]; raw=t[2:]; mat=[raw[r*cols:(r+1)*cols] for r in range(4)]; n=cols//4; blocks=[]
 for b in range(n):
  flat=[mat[r][4*b+c] for r in range(4) for c in range(4)]; miss=136-sum(x for x in flat if x!=-1)
  full=[miss if x==-1 else x for x in flat]; blocks.append((miss,b,full))
 blocks.sort(key=lambda x:(x[0],x[1])); out=[[0]*cols for _ in range(4)]
 for b,(_,_,flat) in enumerate(blocks):
  for z,x in enumerate(flat): r,c=divmod(z,4); out[r][4*b+c]=x
 return '\\n'.join(' '.join(map(str,row)) for row in out)
""",[("descending-missing","blocks.sort(key=lambda x:(x[0],x[1]))","blocks.sort(key=lambda x:(-x[0],x[1]))"),("keep-original-order","blocks.sort(key=lambda x:(x[0],x[1]))","blocks.sort(key=lambda x:x[1])")],"逐块求缺失值并构造填好的 4×4 方块；按 (缺失值, 原列序号) 排序，将完整块写入输出列组。","每个输出块仍是原输入中的一个完整方块。排序键确保缺失值非递减，第二关键字仅在相同缺失值时保留原顺序；这满足题意并确定唯一输出。","缺失值计算 O(n)，排序 O(n log n)，复制网格 O(n)，总时间 O(n log n)，空间 O(n)。",["数组","排序"]),
spec("oa-visa-15","Largest Square Area in Cityscape","给定非负楼高数组。求在一段连续楼房下方可容纳的最大正方形面积；边长 s 可行当且仅当存在连续 s 栋楼且每栋高度至少 s。此判定对应来源解法段的明确条件。","n（1≤n≤200000），n 个高度 h（0≤h≤10^9）；范围为本站补充。","输出最大正方形面积。",ecity,ocity,rcity,[[1,2,3,2,1],[0,0],[3,3,3]],"""import sys
from collections import deque
def solve(s):
 z=list(map(int,s.split())); n=z[0]; h=z[1:]
 def ok(k):
  d=deque()
  for i,x in enumerate(h):
   while d and d[0]<=i-k: d.popleft()
   while d and h[d[-1]]>=x: d.pop()
   d.append(i)
   if i>=k-1 and h[d[0]]>=k: return True
  return False
 lo,hi=0,min(n,max(h,default=0))
 while lo<hi:
  mid=(lo+hi+1)//2
  if ok(mid): lo=mid
  else: hi=mid-1
 return str(lo*lo)
""",[("strict-height","h[d[0]]>=k","h[d[0]]>k"),("return-side-not-area","return str(lo*lo)","return str(lo)")],"边长为 k 的正方形可行性可用滑动窗口最小值判断：是否存在宽 k 的窗口，其最低楼高≥k。可行性对 k 单调，二分最大边长并平方。","任一边长 k 的正方形必须由至少 k 栋连续楼承托，且每栋高度≥k；满足该条件的窗口也确实容得下 k×k 正方形。因此窗口判定充要。增大 k 后条件只会更难，故可二分最大 k。","每次判定 O(n)，二分 O(log min(n,max(h)))，空间 O(n)。",["数组","单调队列","二分"])
]

for _s in SPECS:
    if _s["pid"]=="oa-visa-3":
        _s["samples"][2]=[("M","id1",1,["HERE"]),("O","id1"),("M","id2",2,["ALL"])]
        old="mentioned.update(direct)\n  for u in mentioned: cnt[u]=cnt.get(u,0)+1"
        new=old+"\n  for u in direct: cnt[u]=cnt.get(u,0)+1"
        _s["mutants"][0]=("double-count-direct",old,new)

BLOCKED=[
("oa-visa-2","正文与同页参考程序对边界搜索矛盾：题面样例在向左搜索越界后会改向右继续，而给出的程序直接 break。决定统一语义需要原题澄清。"),
("oa-visa-7","题面要求按缺失单元格的全矩阵 row-major 次序回填；来源实现按 4×4 子块顺序记录位置，两者不等价，样例不能消除差异。"),
("oa-visa-9","Level 1–4 银行系统缺少关键状态转换约定：转账过期后的冻结款处理、账户合并时待处理转账归属等；来源示例代码对此也未一致处理，无法据此定义唯一评测行为。"),
("oa-visa-10","题面允许至多 k 次 arr[i]=arr[i]*arr[i+1]，未禁止重复或重叠操作；来源 DP 却把一次合并后跳过 i+1。若同一 i 可再次操作，结果不同，规则需澄清。")
]

def main():
    for d in ("packages","editorials","references","oracles","mutants","negative-controls","reviews","candidate-batches","validation"):
        (OUT/d).mkdir(parents=True,exist_ok=True)
    batch=[]; reports=[]; reviews=[]; seed=20261006
    for s in SPECS:
        pid=s["pid"]; src=CAT[pid]; code=textwrap.dedent(s["code"]).strip()+"\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"
        ref=OUT/"references"/f"{pid}.py"; ref.write_text(code)
        rng=random.Random(seed+int(pid.rsplit("-",1)[1])); values=list(s["samples"]); seen={json.dumps(v,sort_keys=True) for v in values}
        while len(values)<163:
            v=s["random_case"](rng); key=json.dumps(v,sort_keys=True)
            if key not in seen: seen.add(key); values.append(v)
        oracle=[]
        for value in values:
            data=s["encode"](value); expected=s["oracle"](value); actual=run(ref,data)
            assert actual==expected,(pid,value,expected,actual)
            oracle.append({"input":data,"expectedOutput":expected+"\n"})
        cases=[{"name":f"样例 {i+1}",**x,"hidden":False,"weight":1} for i,x in enumerate(oracle[:3])]
        cases += [{"name":f"隐藏测试 {i+1}",**x,"hidden":True,"weight":1} for i,x in enumerate(oracle[3:33])]
        mutant_docs=[]; kill=[]
        for i,(name,old,new) in enumerate(s["mutants"],1):
            assert old in code,(pid,"mutation anchor",old)
            mutant=code.replace(old,new); ctrl=OUT/"negative-controls"/f"{pid}-{i}.py"; ctrl.write_text(mutant)
            rejects=[j for j,c in enumerate(cases) if run(ctrl,c["input"])!=c["expectedOutput"].rstrip("\n")]
            assert rejects,(pid,"mutant survived",name)
            mutant_docs.append({"name":name,"code":mutant}); kill.append({"name":name,"rejectedByCases":rejects})
        problem={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":s["title"],"difficulty":"简单" if pid=="oa-visa-1" else "中等",
          "tags":["OA","Visa"]+s["tags"],"description":s["desc"]+"\n\n规则依据 OAMaster 原题；输入输出协议与标为‘本站补充’的边界由本站整理。",
          "input":s["inp"],"output":s["out"],"explanation":"详见配套题解。","hints":["逐条对照题目定义，注意同步更新和边界语义。"],
          "timeLimit":3,"memoryLimit":262144,"outputLimit":4096,"checker":"exact","languages":["python","go","java","cpp"]}
        raw={"schemaVersion":1,"problem":problem,"cases":cases}
        cmd="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
        norm=subprocess.run(["node","--import","tsx","-e",cmd],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True)
        if norm.returncode: raise RuntimeError(norm.stderr)
        explanation=f"## 思路\n\n{s['idea']}\n\n## 正确性\n\n{s['proof']}\n\n## 复杂度\n\n{s['complexity']}"
        editorial={"schemaVersion":1,"id":pid,"title":s["title"],"explanation":explanation,"solutions":[{"language":"python","code":code}],
                   "sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"],"author":"CSWork"}
        package=json.loads(norm.stdout)
        for folder,obj in (("packages",package),("editorials",editorial),("oracles",oracle),("mutants",mutant_docs)):
            (OUT/folder/f"{pid}.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
        batch.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(norm.stdout.encode()).hexdigest(),"editorial":explanation,"authoredSolutions":editorial["solutions"]})
        reports.append({"id":pid,"oracleCases":len(oracle),"uniqueOracleInputs":len({x["input"] for x in oracle}),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":kill,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
        reason=("来源主描述开头截断；本候选仅采用同页解法段明确写出的边长可行条件，并在题面显式写全该判定和本站约束。" if pid=="oa-visa-15" else "已核对 OAMaster 来源；本站补充的协议和限制明确写入题面。")+"参考程序经独立小规模 oracle 与两个正常退出错误程序验证。"
        reviews.append({"id":pid,"status":"authored","reason":reason,"sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"catalogContentHash":src["contentHash"]})
        print(f"{pid}: {len(oracle)} oracle inputs, {len(cases)} cases, {len(kill)} mutants killed",flush=True)
    for pid,reason in BLOCKED:
        # The original MDX is complete for all these entries; the problem-specific ambiguity is recorded rather than guessed.
        src=CAT[pid]; reviews.append({"id":pid,"status":"blocked","reason":reason,"sourceCommit":SOURCE_COMMIT,"rawPath":"web/content/docs/companies/visa.mdx","rawGitBlob":MDX_BLOB,"rawSha256":MDX_SHA,"catalogContentHash":src["contentHash"]})
    (OUT/"candidate-batches/visa-tail.json").write_text(json.dumps({"schemaVersion":1,"items":batch},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation/visa-tail.json").write_text(json.dumps({"schemaVersion":1,"seed":seed,"problems":reports,"note":"Local authored-code/oracle/mutant checks only. No real GoJudge sandbox report or production publication."},ensure_ascii=False,indent=2)+"\n")
    (OUT/"reviews/visa-tail.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")

if __name__=="__main__": main()
