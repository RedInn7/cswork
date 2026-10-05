"""Offline-authored Visa candidate batch; never publishes to registry."""
from pathlib import Path
import hashlib, json, random, subprocess, sys, textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CAT = {x["id"]: x for x in json.loads((ROOT / "content/oa-master/catalog.json").read_text())["items"]}

def run(path, data):
    return subprocess.run([sys.executable, "-I", str(path)], input=data, text=True,
                         capture_output=True, timeout=8, check=True).stdout.rstrip("\n")

def spec(num, title, description, inp, output, encode, oracle, generate, samples, code, mutants, idea, proof, complexity, tags=()):
    return locals()

def elamp(v):
    seg,p=v
    return f"{len(seg)} {len(p)}\n"+"".join(f"{a} {b}\n" for a,b in seg)+" ".join(map(str,p))+"\n"
def olamp(v):
    seg,p=v
    return " ".join(str(sum(a<=x<=b for a,b in seg)) for x in p)
def rlamp(r):
    seg=[]
    for _ in range(r.randint(1,12)):
        a=r.randint(-12,12); seg.append((a,r.randint(a,15)))
    return seg,[r.randint(-15,18) for _ in range(r.randint(1,12))]

def erev(w): return w+"\n"
def orev(w): return min([w[:k][::-1]+w[k:] for k in range(1,len(w)+1)]+[w[:-k]+w[-k:][::-1] for k in range(1,len(w)+1)])
def rrev(r): return "".join(r.choice("abcde") for _ in range(r.randint(1,18)))

def estr(a): return f"{len(a)}\n"+"\n".join(a)+"\n"
def ostr(a): return str(sum(i!=j and a[j].startswith(a[i]) for i in range(len(a)) for j in range(len(a))))
def rstr(r):
    a=["".join(r.choice("abc") for _ in range(r.randint(1,7))) for _ in range(r.randint(1,12))]
    if len(a)>1 and r.random()<.6: a[-1]=a[0]+r.choice("abc")
    return a

def etrip(v):
    a,t=v; return f"{len(a)} {t}\n"+" ".join(map(str,a))+"\n"
def otrip(v):
    a,t=v; return str(sum(a[i]+a[j]+a[k]<=t for i in range(len(a)) for j in range(i+1,len(a)) for k in range(j+1,len(a))))
def rtrip(r): return sorted(r.sample(range(1,80),r.randint(3,12))),r.randint(3,120)

def ecache(v):
    e,q=v; return f"{len(e)} {len(q)}\n"+"".join(f"{k} {t} {x}\n" for k,t,x in e)+"".join(f"{k} {t}\n" for k,t in q)
def ocache(v):
    e,q=v; return " ".join(next(x for kk,tt,x in e if kk==k and tt==t) for k,t in q)
def rcache(r):
    keys=[f"k{i}" for i in range(r.randint(1,8))]
    times=[f"00:00:{i:02d}" for i in range(r.randint(1,10))]
    pairs=[(k,t) for k in keys for t in times]; r.shuffle(pairs); pairs=pairs[:r.randint(1,len(pairs))]
    return [(k,t,str(r.randint(-100,200))) for k,t in pairs],[r.choice(pairs) for _ in range(r.randint(1,12))]

def eint(a): return f"{len(a)}\n"+" ".join(map(str,a))+"\n"
def oint(a):
    n=len(a); best=max(sum(x*(-1 if mask>>i&1 else 1) for i,x in enumerate(a))
                       for mask in range(1<<n) if mask.bit_count()%2==0)
    return str(best)
def rint(r): return [r.randint(-25,25) for _ in range(r.randint(2,14))]

def esel(v):
    a,b=v; return f"{len(a)}\n"+" ".join(map(str,a))+"\n"+" ".join(map(str,b))+"\n"
def osel(v):
    a,b=v; dp=[(a[0],1),(b[0],1)]; best=1
    for i in range(1,len(a)):
        nd=[]
        for val in (a[i],b[i]):
            opts=[n+1 for prev,n in dp if prev<=val]
            nd.append((val,max(opts) if opts else 1))
        dp=nd; best=max(best,max(n for _,n in dp))
    return str(best)
def rsel(r):
    n=r.randint(1,15); return [r.randint(-10,20) for _ in range(n)],[r.randint(-10,20) for _ in range(n)]

def egain(v):
    a,b,k=v; return f"{len(a)} {k}\n"+" ".join(map(str,a))+"\n"+" ".join(map(str,b))+"\n"
def ogain(v):
    a,b,k=v; best=None
    for mask in range(1<<len(a)):
        if mask.bit_count()>k: continue
        score=sum(min(x,2*y if mask>>i&1 else y) for i,(x,y) in enumerate(zip(a,b)))
        best=score if best is None else max(best,score)
    return str(best)
def rgain(r):
    n=r.randint(1,14); return [r.randint(-25,30) for _ in range(n)],[r.randint(-25,30) for _ in range(n)],r.randint(0,n)

def equota(rows): return f"{len(rows)}\n"+"".join(f"{c} {x} {y}\n" for c,x,y in rows)
def oquota(rows):
    ans=[]; n=len(rows)
    for k in range(1,n+1):
        best=None
        for mask in range(1<<n):
            x=y=c=0
            for i,(cost,a,b) in enumerate(rows):
                if mask>>i&1: c+=cost; x+=a; y+=b
            if x>=k and y>=k: best=c if best is None else min(best,c)
        ans.append(str(best if best is not None else -1))
    return " ".join(ans)
def rquota(r): return [(r.randint(0,30),r.randrange(2),r.randrange(2)) for _ in range(r.randint(1,10))]

SPECS = [
spec(4,"Lamp Illumination Count","每盏灯照亮闭区间 [l,r]；对每个位置 p，统计满足 l≤p≤r 的灯数。","n,q（1≤n,q≤200000），随后 n 行 l,r（−10⁹..10⁹，l≤r），再给 q 个位置 p。范围为本站补充。","输出各位置覆盖数，以空格分隔。",elamp,olamp,rlamp,[([(1,5),(3,7)],[4,6]), ([(0,0)],[-1,0,1]),([(-5,2),(2,9)],[2,3,-5])],"""import sys
from bisect import bisect_left,bisect_right
def solve(s):
 t=list(map(int,s.split())); n,q=t[:2]; z=t[2:2+2*n]; l=sorted(z[::2]); r=sorted(z[1::2])
 return ' '.join(str(bisect_right(l,p)-bisect_left(r,p)) for p in t[2+2*n:])
""", [("strict-left","bisect_right(l,p)","bisect_left(l,p)"),("strict-right","bisect_left(r,p)","bisect_right(r,p)")],"分别排序区间左右端点，覆盖 p 的区间数为左端点不大于 p 的数量减去右端点小于 p 的数量。","区间包含 p 当且仅当 l≤p 且 r≥p。upper_bound(l,p) 计入左端点等于 p 的区间，lower_bound(r,p) 仅排除 r<p 的区间，因此端点条件正确。","预处理 O(n log n)，每次查询 O(log n)，空间 O(n)。",["数组","二分查找"]),
spec(6,"Lexicographically Smallest by Reversing Prefix or Suffix","给定小写字符串，恰好一次反转一个非空前缀或后缀，求所有结果中字典序最小者。","输入非空小写字符串；本站补充 |word|≤2000，以支持直接枚举全部候选。","输出最小结果。",erev,orev,rrev,["edcba","a","bac"],"""import sys
def solve(s):
 w=s.strip(); c=[]
 for k in range(1,len(w)+1): c.extend((w[:k][::-1]+w[k:],w[:-k]+w[-k:][::-1]))
 return min(c)
""", [("prefix-only","c.extend((w[:k][::-1]+w[k:],w[:-k]+w[-k:][::-1]))","c.append(w[:k][::-1]+w[k:])"),("omit-last-char","w[:k][::-1]","w[:max(0,k-1)][::-1]")],"枚举 k=1..n，构造前缀反转和后缀反转两种结果，取最小。","恰有 2n 种定义内操作；循环逐一构造且比较，最小者即所求。未把原串额外加入候选，符合恰好操作一次。","时间 O(n²)，候选空间 O(n²)；本站补充 n≤2000。",["字符串","枚举"]),
spec(8,"Library Prefix Pairs","统计有序下标对 i≠j，使书名 i 是书名 j 的前缀；相同书名的不同下标也计数。","n（1≤n≤200000），接着 n 行非空小写字符串，长度≤1000，总长≤200000；范围为本站补充，以约束 Trie 内存。","输出有序对数量。",estr,ostr,rstr,[["ab","abc","ab"],["a"],["car","cart","cat","car"]],"""import sys
def solve(s):
 z=s.splitlines(); n=int(z[0]); a=z[1:1+n]; t={}; end='!'
 for w in a:
  x=t
  for c in w: x=x.setdefault(c,{})
  x[end]=x.get(end,0)+1
 ans=0
 for w in a:
  x=t
  for c in w: x=x[c]; ans+=x.get(end,0)
  ans-=1
 return str(ans)
""", [("include-self","ans-=1","pass"),("exact-only","for c in w: x=x[c]; ans+=x.get(end,0)","for c in w: x=x[c]\n  ans+=x.get(end,0)")],"将书名插入 Trie 并记录终止次数。查询每个书名时，累加路径上所有终止节点次数，再减去当前下标自身一次。","固定被匹配书名 j，其所有前缀正好是根到其终点路径上的终止书名。节点计数按下标计算，覆盖重复书名；减去自身后恰为 i≠j。","时间和空间均 O(L)，L 为总字符数。",["字符串","Trie"]),
spec(11,"Count Triplets with Sum at Most t","给定互不相同的正整数数组，统计 i<j<k 且三数和≤t 的三元组。","n,t（3≤n≤2500），随后 n 个互异正整数（≤10⁹）。限制为本站补充。","输出三元组数量。",etrip,otrip,rtrip,[([1,2,3,4,5],8),([1,2,3],6),([2,5,8,11],10)],"""import sys
def solve(s):
 z=list(map(int,s.split())); n,t=z[:2]; a=sorted(z[2:]); ans=0
 for i in range(n-2):
  l,r=i+1,n-1
  while l<r:
   if a[i]+a[l]+a[r]<=t: ans+=r-l; l+=1
   else: r-=1
 return str(ans)
""", [("strict-sum","<=t","<t"),("count-one","ans+=r-l","ans+=1")],"排序后固定 i，以双指针 l、r 扫描剩余元素。若和≤t，则 l 与 r 间所有位置均可作第三项，累计 r−l；否则减小 r。","排序后满足 a[i]+a[l]+a[r]≤t 时，对每个 k∈(l,r] 都成立并形成不同三元组。若超限，减小最大项才可能恢复可行。每个 i<j<k 唯一计数。","时间 O(n²)，空间 O(n)；本站补充 n≤2500。",["数组","双指针"]),
spec(12,"Cache Query Handler","缓存记录给出 timestamp、key、value；对每个 (key,timestamp) 查询返回对应 value。","n,q≤200000；随后 n 行 key timestamp value，再给 q 行 key timestamp。时间为 HH:MM:SS，value 为整数。本站补充保证 (key,timestamp) 唯一，消除原题未说明的重复键冲突。","按序输出各 value，以空格分隔。",ecache,ocache,rcache,[([("a","10:00:00","7"),("b","10:00:00","9")],[("b","10:00:00"),("a","10:00:00")]),([("x","00:00:00","-1")],[("x","00:00:00")]),([("a","12:30:00","4"),("a","12:31:00","5")],[("a","12:31:00"),("a","12:30:00")])],"""import sys
def solve(s):
 z=s.split(); n,q=map(int,z[:2]); d={}; p=2
 for _ in range(n): k,t,v=z[p:p+3]; p+=3; d[k,t]=v
 out=[]
 for _ in range(q): k,t=z[p:p+2]; p+=2; out.append(d[k,t])
 return ' '.join(out)
""", [("ignore-key","out.append(d[k,t])","out.append(next(v for (kk,tt),v in d.items() if tt==t))"),("ignore-time","out.append(d[k,t])","out.append(next(v for (kk,tt),v in d.items() if kk==k))")],"用 (key,timestamp) 组成字典键；逐个查询精确查找并输出 value。","本站保证查询存在且键唯一。完整二元键查找当且仅当两个字段都匹配，因而得到唯一对应记录。","期望时间 O(n+q)，空间 O(n)。",["哈希表","查询"]),
spec(13,"Maximum Sum by Sign-Flip Pairs","每次可选两个不同位置同时乘以 −1；可重复操作，求数组可能达到的最大和。","n（2≤n≤200000），n 个整数（−10⁹..10⁹）。来自源题约束。","输出最大和，使用 64 位整数。",eint,oint,rint,[[-5,-1,7],[-2,-3],[0,-5,8]],"""import sys
def solve(s):
 a=list(map(int,s.split()))[1:]; z=sum(map(abs,a))
 return str(z if sum(x<0 for x in a)%2==0 else z-2*min(map(abs,a)))
""", [("ignore-parity","else z-2*min(map(abs,a))","else z"),("always-subtract","z if sum(x<0 for x in a)%2==0 else z-2*min(map(abs,a))","z-2*min(map(abs,a))")],"符号翻转每次改变两个位置，负数数量奇偶性不变。负数为偶数可全翻正；为奇数时留下绝对值最小者为负。","负号奇偶性是操作不变量。偶数负号可两两消除；奇数负号至少留一个。最小绝对值项造成最小损失，答案因此为绝对值和，或减去两倍最小绝对值。","时间 O(n)，空间 O(1)。",["贪心","数学"]),
spec(16,"Longest Selectable Non-Decreasing Subarray","A、B 等长；对连续子数组每个位置恰选 A[i] 或 B[i]，求能形成非递减序列的最长长度。","n（1≤n≤200000），两行数组 A、B，元素绝对值≤10⁹；范围为本站补充。","输出最大长度。",esel,osel,rsel,[([1,3,5,4],[2,2,6,7]),([5,4,3],[1,2,3]),([3],[1])],"""import sys
def solve(s):
 z=list(map(int,s.split())); n=z[0]; a=z[1:1+n]; b=z[1+n:1+2*n]; x=y=best=1
 for i in range(1,n):
  nx=ny=1
  if a[i-1]<=a[i]: nx=max(nx,x+1)
  if b[i-1]<=a[i]: nx=max(nx,y+1)
  if a[i-1]<=b[i]: ny=max(ny,x+1)
  if b[i-1]<=b[i]: ny=max(ny,y+1)
  x,y=nx,ny; best=max(best,x,y)
 return str(best)
""", [("omit-B-to-A","if b[i-1]<=a[i]: nx=max(nx,y+1)","pass"),("strict-increase","<=","<")],"维护两个状态：当前位置选 A[i] 或 B[i] 时，以此结尾的最长合法连续段。检查前一位置两种选择是否≤当前值；无可转移状态时从当前位置重开。","任一合法段接到当前位置前，只可能来自前一项 A[i−1] 或 B[i−1]，且必须不大于当前值。两个状态穷尽可能性；取可延伸的最长段最优，否则长度为 1。","时间 O(n)，空间 O(1)。",["动态规划","数组"]),
spec(17,"Maximize Capped Contribution Sum","初值为 Σmin(a[i],b[i])；可选至多 k 个不同位置，将该处 b[i] 改为 2b[i]，求最大总和。","n,k（1≤n≤200000，0≤k≤n），随后两行各 n 个整数，范围 −10⁹..10⁹（本站补充，允许负数）。","输出最大总和，使用 64 位整数。",egain,ogain,rgain,[([10,8,6],[3,6,10],2),([5,5],[10,10],2),([-5,4],[3,-3],1)],"""import sys
def solve(s):
 z=list(map(int,s.split())); n,k=z[:2]; a=z[2:2+n]; b=z[2+n:2+2*n]
 g=sorted((min(x,2*y)-min(x,y) for x,y in zip(a,b)),reverse=True)
 return str(sum(min(x,y) for x,y in zip(a,b))+sum(max(0,v) for v in g[:k]))
""", [("must-use-k","sum(max(0,v) for v in g[:k])","sum(g[:k])"),("wrong-delta","min(x,2*y)-min(x,y) for x,y in zip(a,b)","min(x,y) for x,y in zip(a,b)")],"每个位置的操作增益为 min(aᵢ,2bᵢ)−min(aᵢ,bᵢ)。基准分加上最大的至多 k 个正增益。","方案分数等于基准分与所选增益之和。位置间无相互作用，因此在至多 k 项中取最大正增益和即为全局最优。","时间 O(n log n)，空间 O(n)。",["贪心","排序"]),
spec(18,"Minimum Cost to Select People for Skill Quotas","每个人有非负成本与两个技能标记。对 K=1..n，求至少 K 人有技能 1、至少 K 人有技能 2 的最小花费；双技能者同时计入两边；不可行输出 −1。","n（1≤n≤200000），接着 n 行 cost skill1 skill2。cost 为 0..10⁹，技能为 0/1。非负成本为本站补充；答案用 64 位整数。","依次输出 K=1..n 的最小成本或 −1。",equota,oquota,rquota,[[(5,1,1),(4,1,0),(4,0,1)],[(3,1,0),(2,0,1)],[(0,1,1),(7,1,1)]],"""import sys
from itertools import accumulate
def solve(s):
 z=list(map(int,s.split())); n=z[0]; groups=[[],[],[],[]]
 for i in range(n):
  c,x,y=z[1+3*i:4+3*i]; groups[0 if x and y else 1 if x else 2 if y else 3].append(c)
 both,one,two,_=groups
 for a in (both,one,two): a.sort()
 pref=[list(accumulate([0]+a)) for a in (both,one,two)]; B,X,Y=pref
 nb,nx,ny=map(len,(both,one,two)); ans=[]
 for k in range(1,n+1):
  lo=max(0,k-nx,k-ny); hi=min(k,nb)
  if lo>hi: ans.append('-1'); continue
  def cost(j): return B[j]+X[k-j]+Y[k-j]
  l,r=lo,hi
  while l<r:
   m=(l+r)//2
   if cost(m+1)-cost(m)>=0: r=m
   else: l=m+1
  ans.append(str(cost(l)))
 return ' '.join(ans)
""", [("drop-dual-skill","0 if x and y else 1 if x else 2 if y else 3","1 if x else 2 if y else 3"),("too-small-upper-bound","lo=max(0,k-nx,k-ny); hi=min(k,nb)","lo=max(0,k-nx,k-ny); hi=min(k,nb,max(0,k-1))")],"将人分成双技能 B、仅技能1的 X、仅技能2的 Y、无技能四组；非负成本下无技能者无需选。固定选 j 个 B 后，另外两类各补 K−j 人，代价 f(j)=PB[j]+PX[K−j]+PY[K−j]。可行 j 区间为 [max(0,K−|X|,K−|Y|),min(K,|B|)]。","给定双技能人数 j，最便宜的可行方案必取各组最便宜的所需人数，得到 f(j)。排序成本的前缀和具有非递减边际成本；f 的差分为 B[j] 的边际成本减去 X、Y 被移除的末位边际成本，随 j 非递减，故 f 离散凸。二分首个非负差分找到区间最小值。非负成本允许删掉不必要的人；非负限制为本站补充。","排序 O(n log n)，对每个 K 二分 O(log n)，总时间 O(n log n)，空间 O(n)。",["贪心","二分","前缀和"])
]

def main():
    for folder in ("packages","editorials","references","oracles","mutants","negative-controls","reviews","candidate-batches","validation"):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    items=[]; reports=[]; reviews=[]; seed=20261005
    for s in SPECS:
        pid=f"oa-visa-{s['num']}"; src=CAT[pid]; code=textwrap.dedent(s["code"]).strip()+"\nif __name__=='__main__': print(solve(sys.stdin.read()))\n"
        ref=OUT/"references"/f"{pid}.py"; ref.write_text(code)
        rng=random.Random(seed+s["num"]); vals=list(s["samples"]); seen={json.dumps(v,sort_keys=True) for v in vals}
        while len(vals)<163:
            v=s["generate"](rng); key=json.dumps(v,sort_keys=True)
            if key not in seen: seen.add(key); vals.append(v)
        oracle=[]
        for v in vals:
            data=s["encode"](v); expected=s["oracle"](v); actual=run(ref,data)
            assert actual==expected,(pid,v,expected,actual)
            oracle.append({"input":data,"expectedOutput":expected+"\n"})
        cases=[{"name":f"样例 {i+1}",**x,"hidden":False,"weight":1} for i,x in enumerate(oracle[:3])]
        cases += [{"name":f"隐藏测试 {i+1}",**x,"hidden":True,"weight":1} for i,x in enumerate(oracle[3:33])]
        muts=[]; killed=[]
        for i,(name,old,new) in enumerate(s["mutants"],1):
            assert old in code,(pid,"mutation anchor",old)
            mutant=code.replace(old,new); ctrl=OUT/"negative-controls"/f"{pid}-{i}.py"; ctrl.write_text(mutant)
            rejects=[j for j,c in enumerate(cases) if run(ctrl,c["input"])!=c["expectedOutput"].rstrip("\n")]
            assert rejects,(pid,"surviving mutant",name)
            muts.append({"name":name,"code":mutant}); killed.append({"name":name,"rejectedByCases":rejects})
        p={"id":pid,"courseId":"gomall","lessonId":"00-overview","title":s["title"],"difficulty":"中等","tags":["OA","Visa"]+s["tags"],
           "description":s["description"]+"\n\n语义依照 OAMaster 原题。输入协议或标有‘本站补充’的范围、保证由本站补充整理，不表示原题提供了这些限制。",
           "input":s["inp"],"output":s["output"],"explanation":"思路、正确性证明与复杂度见配套题解。","hints":["先厘清边界、操作和计数规则，再选择适合的数据结构或状态转移。"],
           "timeLimit":3,"memoryLimit":262144,"outputLimit":4096,"checker":"exact","languages":["python","go","java","cpp"]}
        raw={"schemaVersion":1,"problem":p,"cases":cases}
        cmd="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
        norm=subprocess.run(["node","--import","tsx","-e",cmd],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True)
        if norm.returncode: raise RuntimeError(norm.stderr)
        package=json.loads(norm.stdout); idea,proof,complexity=s["idea"],s["proof"],s["complexity"]
        explanation=f"## 思路\n\n{idea}\n\n## 正确性\n\n{proof}\n\n## 复杂度\n\n{complexity}"
        editorial={"schemaVersion":1,"id":pid,"title":s["title"],"explanation":explanation,"solutions":[{"language":"python","code":code}],"sourceUrl":src["sourceUrl"],"sourceContentHash":src["contentHash"],"author":"CSWork"}
        for folder,obj in (("packages",package),("oracles",oracle),("mutants",muts),("editorials",editorial)):
            (OUT/folder/f"{pid}.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
        items.append({"id":pid,"sourceContentHash":src["contentHash"],"packageChecksum":hashlib.sha256(norm.stdout.encode()).hexdigest(),"editorial":explanation,"authoredSolutions":editorial["solutions"]})
        reports.append({"id":pid,"oracleCases":len(oracle),"uniqueOracleInputs":len({x["input"] for x in oracle}),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":killed,"referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
        reviews.append({"id":pid,"status":"authored","reason":"已核对 OAMaster 原题；本站补充的输入协议和边界约束均在题面标明。独立 oracle、参考程序和正常退出错误变异程序通过本地验证。","sourceUrls":[src["sourceUrl"]],"sourceContentHashes":[src["contentHash"]],"catalogContentHash":src["contentHash"]})
        print(f"{pid}: {len(oracle)} unique oracle inputs; {len(cases)} judge cases; {len(killed)} mutants rejected",flush=True)
    batch_folder = "batches" if (OUT/"reports/visa-next.json").exists() else "candidate-batches"
    (OUT/batch_folder/"visa-next.json").write_text(json.dumps({"schemaVersion":1,"items":items},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation/visa-next.json").write_text(json.dumps({"schemaVersion":1,"seed":seed,"problems":reports,"note":"Local authored-code/oracle/mutant validation only; not real GoJudge sandbox acceptance or publication."},ensure_ascii=False,indent=2)+"\n")
    (OUT/"reviews/visa-next.json").write_text(json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")

if __name__=="__main__": main()
