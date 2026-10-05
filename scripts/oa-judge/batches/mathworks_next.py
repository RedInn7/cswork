#!/usr/bin/env python3
"""Generate and locally verify five MathWorks OA candidate packages."""
import hashlib, itertools, json, random, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; OA=ROOT/"content/oa-judge"; MOD=1000000007
QUESTIONS={q["id"]:q for q in json.loads((ROOT/"content/oa-master/catalog.json").read_text())["items"]}
REF={
6:"""def solve(s):
 it=iter(s.split());n=int(next(it));lo=int(next(it));hi=int(next(it));a=[int(next(it)) for _ in range(n)];ans=0;start=0;lm=lh=-1
 for i,x in enumerate(a):
  if x<lo or x>hi:start=i+1;lm=lh=-1;continue
  if x==lo:lm=i
  if x==hi:lh=i
  if lm>=start and lh>=start:ans+=min(lm,lh)-start+1
 return str(ans)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
7:"""MOD=1000000007
def solve(s):
 n,k=map(int,s.split());d=[0]*(n+1);d[1]=26;w=0
 for i in range(2,n+1):
  w=(w+d[i-1])%MOD
  if i-k>=1:w=(w-d[i-k])%MOD
  d[i]=(25*w+(26 if i<k else 0))%MOD
 return str(d[n])
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
11:"""def solve(s):
 it=iter(map(int,s.split()));n=next(it);k=next(it);a=[next(it) for _ in range(n)];b=[next(it) for _ in range(n)]
 return str(sum(b)+sum(sorted((x-y for x,y in zip(a,b)),reverse=True)[:k]))
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
13:"""def solve(s):
 it=iter(s.split());n=int(next(it));q=int(next(it));a=[next(it) for _ in range(n)];p=[0]
 for x in a:p.append(p[-1]+(x[0] in 'aeiou' and x[-1] in 'aeiou'))
 z=[]
 for _ in range(q):l,r=map(int,next(it).split('-'));z.append(str(p[r]-p[l-1]))
 return '\\n'.join(z)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
""",
14:"""def solve(s):
 it=iter(map(int,s.split()));n=next(it);m=next(it);a=[next(it) for _ in range(m)];lo=max(a);hi=sum(a)
 while lo<hi:
  mid=(lo+hi)//2;parts=1;load=0
  for x in a:
   if load+x>mid:parts+=1;load=x
   else:load+=x
  if parts<=n:hi=mid
  else:lo=mid+1
 return str(lo)
if __name__=="__main__":
 import sys;print(solve(sys.stdin.read()))
"""}
def enc(n,x):
 if n==6:
  a,l,h=x;return "%d %d %d\n%s\n"%(len(a),l,h," ".join(map(str,a)))
 if n==7:return "%d %d\n"%x
 if n==11:
  k,a,b=x;return "%d %d\n%s\n%s\n"%(len(a),k," ".join(map(str,a))," ".join(map(str,b)))
 if n==13:
  a,q=x;return "%d %d\n%s\n%s"%(len(a),len(q)," ".join(a),"".join("%d-%d\n"%v for v in q))
 a,j=x;return "%d %d\n%s\n"%(a,len(j)," ".join(map(str,j)))
def oracle(n,x):
 if n==6:
  a,l,h=x;z=0
  for i in range(len(a)):
   mn=10**20;mx=-1
   for j in range(i,len(a)):
    mn=min(mn,a[j]);mx=max(mx,a[j]);z+=mn==l and mx==h
  return z
 if n==7:
  m,k=x;d=[[0]*k for _ in range(m+1)]
  for r in range(1,k):d[1][r]=26 if r==1 else 0
  for i in range(2,m+1):
   d[i][1]=sum(d[i-1])*25%MOD
   for r in range(2,k):d[i][r]=d[i-1][r-1]
  return sum(d[m])%MOD
 if n==11:
  k,a,b=x;return max(sum(a[i] if i in c else b[i] for i in range(len(a))) for c in itertools.combinations(range(len(a)),k))
 if n==13:
  a,q=x;return [sum(a[i-1][0] in "aeiou" and a[i-1][-1] in "aeiou" for i in range(l,r+1)) for l,r in q]
 servers,a=x
 return min(max(sum(a[b[i]:b[i+1]]) for i in range(servers)) for c in itertools.combinations(range(1,len(a)),servers-1) for b in [(0,)+c+(len(a),)])
def rand(n,r):
 if n==6:
  a=[r.randint(1,8) for _ in range(r.randint(1,8))];l=r.randint(1,6);return a,l,r.randint(l,8)
 if n==7:
  m=r.randint(2,30);return m,r.randint(2,m)
 if n==11:
  m=r.randint(1,9);return r.randint(0,m),[r.randint(1,12) for _ in range(m)],[r.randint(1,12) for _ in range(m)]
 if n==13:
  m=r.randint(1,10);a=["".join(r.choice("aeioubcdf") for _ in range(r.randint(1,4))) for _ in range(m)];q=[]
  for _ in range(r.randint(1,10)):l=r.randint(1,m);q.append((l,r.randint(l,m)))
  return a,q
 m=r.randint(1,9);return r.randint(1,m),[r.randint(1,10) for _ in range(m)]
S={
6:("Investable Periods","中等","给定每日价格、目标最低价和最高价，统计连续子数组中最小值恰为目标最低价且最大值恰为目标最高价的数量。","首行 n min_price max_price，次行 n 个价格。1≤n≤100000，1≤price[i]≤10^9，1≤min_price≤max_price≤10^9。","输出满足条件的连续区间数量。答案可能超过32位有符号整数范围，应使用64-bit integer。","题源三个样例可直接核对；本地题目统计闭区间子数组，最大值和最小值必须分别恰等于目标。", [([4,5,3,3,1],3,5),([2,2,1,5,1],1,2),([1,2,3,2],2,3)], [(([5]*100000,5,5),5000050000),(([1,2,1,3,2],2,3),1)],1100000),
7:("Valid Passwords","中等","密码长度为 n，只含小写英文字母，且不得出现 k 个连续相同字符。统计不同合法密码数并模 1,000,000,007。","一行 n k。2≤k≤n≤100000。","输出合法密码总数模 1,000,000,007。","保留题源 k≤n 约束，边界测试 k=2 和 k=n。",[(3,2),(3,3),(5,2)],[((100000,2),26*pow(25,99999,MOD)%MOD),((100000,100000),(pow(26,100000,MOD)-26)%MOD)],200),
11:("Task Completion","简单","两人分配 n 个任务，任务 i 交给第一人得 reward_1[i]，交给第二人得 reward_2[i]。第一人必须恰做 k 项，求两人总奖励最大值。题源示例1输出21正确，但文字解释算式矛盾；本站按题意及输出校正说明。","首行 n k，随后两行各 n 个整数 reward_1、reward_2。1≤n≤100000，0≤k≤n，奖励均为1..10000。","输出最大总奖励。","示例1：第二人全做得15分，换给第一人差值最大的三项增加6，总计21；题源解释的加数与其输出矛盾，按题意和输出为准。",[(3,[5,4,3,2,1],[1,2,3,4,5]),(2,[2,3,4,2],[1,1,1,1]),(0,[3,3],[4,2])],[((50000,[10000]*100000,[1]*100000),500050000),((0,[10000]*100000,[1]*100000),100000)],2200000),
13:("Has Vowels","简单","给定小写字符串数组。闭区间查询 [i,r]（1-based）询问其中首字符和末字符均为元音 a/e/i/o/u 的字符串数。","首行 n q；次行 n 个非空小写字符串；随后 q 行，每行 i-r。1≤n,q≤100000，字符串长1..10，1≤i≤r≤n。","每行输出一个查询答案。","按题源解释使用 1-based 闭区间。",[(["aba","bcb","ece","aa","e"],[(1,3),(2,5),(2,2)]),(["a","b","u"],[(1,1),(2,3),(1,3)]),(["abc","xyz"],[(1,2),(2,2),(1,1)])],[((["a"]*10000,[(1,10000)]*10000),[10000]*10000),((["b"]*10000,[(1,10000)]*10000),[0]*10000)],2600000),
14:("Load Balancing","中等","按给定顺序把 m 个任务分给 n 台资源，每台获得一个连续且非空的任务区间。最小化各资源负载总和的最大值。","首行 n m，次行 m 个处理时间。1≤n≤m≤100000，1≤burstTime[i]≤10000。","输出最小可能的最大资源负载。","正任务且 m≥n 时，不超过 n 段的可行分配可以细分成恰好 n 段且不会提高最大负载。",[(3,[7,2,3,4,5]),(2,[1,1,1]),(1,[1,2,3])],[((50000,[1]*100000),2),((100000,[10000]*100000),10000)],2200000)}
M={
6:[("不要求两个端点值都出现","def solve(s):\n it=iter(map(int,s.split()));n=next(it);l=next(it);h=next(it);a=[next(it) for _ in range(n)];z=0\n for i in range(n):\n  mn=10**9;mx=0\n  for j in range(i,n):mn=min(mn,a[j]);mx=max(mx,a[j]);z+=mn>=l and mx<=h\n print(z)\nimport sys;solve(sys.stdin.read())"),("把端点同时出现错当作出现任一端点","def solve(s):\n it=iter(map(int,s.split()));n=next(it);l=next(it);h=next(it);a=[next(it) for _ in range(n)];z=0\n for i in range(n):\n  mn=10**9;mx=0\n  for j in range(i,n):mn=min(mn,a[j]);mx=max(mx,a[j]);z+=mn==l or mx==h\n print(z)\nimport sys;solve(sys.stdin.read())")],
7:[("忽略连续字符限制","import sys\nn,k=map(int,sys.stdin.read().split());print(pow(26,n,1000000007))"),("误把所有后续字符都限制为不同于前一字符","import sys\nn,k=map(int,sys.stdin.read().split());print(26*pow(25,n-1,1000000007)%1000000007)")],
11:[("按输入顺序直接分配前k项","import sys\nd=list(map(int,sys.stdin.read().split()));n,k=d[:2];a=d[2:2+n];b=d[2+n:];print(sum(a[:k])+sum(b[k:]))"),("选择最小的k个奖励差","import sys\nd=list(map(int,sys.stdin.read().split()));n,k=d[:2];a=d[2:2+n];b=d[2+n:];print(sum(b)+sum(sorted(x-y for x,y in zip(a,b))[:k]))")],
13:[("只看首字符是否元音","import sys\nd=sys.stdin.read().split();n,q=map(int,d[:2]);a=d[2:2+n];p=[0]\nfor x in a:p.append(p[-1]+(x[0] in 'aeiou'))\nprint('\\n'.join(str(p[int(r)]-p[int(l)-1]) for l,r in (x.split('-') for x in d[2+n:])))"),("把查询左端点多减一","import sys\nd=sys.stdin.read().split();n,q=map(int,d[:2]);a=d[2:2+n];p=[0]\nfor x in a:p.append(p[-1]+(x[0] in 'aeiou' and x[-1] in 'aeiou'))\nprint('\\n'.join(str(p[int(r)]-p[max(0,int(l)-2)]) for l,r in (x.split('-') for x in d[2+n:])))")],
14:[("不顾连续限制理想均分","import sys\nd=list(map(int,sys.stdin.read().split()));n,m=d[:2];a=d[2:];print((sum(a)+n-1)//n)"),("按任务数平均切块","import sys\nd=list(map(int,sys.stdin.read().split()));n,m=d[:2];a=d[2:];q,r=divmod(m,n);p=0;z=[]\nfor i in range(n):j=p+q+(i<r);z.append(sum(a[p:j]));p=j\nprint(max(z))")]
}
PROOFS={
6:"固定右端时，合法左端必须在未越界连续段中，且不晚于最近一次出现两种端点值的位置中较早者。这样的左端全包含两个端点值，之后的起点缺少至少一个；累加贡献不重不漏。",
7:"按末尾连续相同字符长度分类。追加不同字符有25种选择；追加相同字符会把原末段延长1。分类求和等于25乘以最近至多k−1个长度状态之和，滚动窗口仅优化该求和，等价于独立的末段长度DP。",
11:"以全部任务交给第二人为基准。任务i改给第一人的增益为reward_1[i]−reward_2[i]。恰选k项时，若遗漏更大增益而选了较小增益，交换会改善或保持总分，因此应选最大的k个差值。",
13:"prefix[t]记录前t个字符串中首尾皆为元音的数量。闭区间[i,r]的答案恰为prefix[r]−prefix[i−1]。",
14:"给定负载上限，按序尽量填满当前连续段得到所需最少段数。段数超过n则无解；不超过n时，因m≥n且任务正数，可细分为恰好n段而不增加最大负载。可行性随上限单调，所以二分得最小值。"}
def run(code,inp):
 env={"__name__":"candidate"};exec(compile(code,"<authored-reference>","exec"),env);return env["solve"](inp).strip()
def sha(b):return hashlib.sha256(b).hexdigest()
def write(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
def main():
 random.seed(20261005);(OA/"candidate-batches").mkdir(exist_ok=True);items=[];reports=[]
 for n,spec in S.items():
  title,difficulty,desc,inptext,outtext,explain,samples,edges,limit=spec;pid="oa-mathworks-%d"%n;source=QUESTIONS[pid];ref=REF[n];(OA/"references"/(pid+".py")).write_text(ref)
  cases=[]
  for v,answer,hidden in [(v,oracle(n,v),False) for v in samples]+[(rand(n,random),None,True) for _ in range(22)]+[(v,a,True) for v,a in edges]:
   text=enc(n,v);answer=oracle(n,v) if answer is None else answer;want=" ".join(map(str,answer)) if isinstance(answer,list) else str(answer)
   actual=run(ref,text);assert actual.split()==want.split(),(pid,v,actual,want)
   cases.append(dict(name="样例 %d"%(len(cases)+1) if len(cases)<3 else "边界与组合 %d"%(len(cases)-2),input=text,expectedOutput=want+"\n",hidden=hidden,weight=1))
  oracle_cases=[];seen=set()
  while len(oracle_cases)<120:
   v=rand(n,random);text=enc(n,v)
   if text in seen:continue
   seen.add(text);answer=oracle(n,v);want=" ".join(map(str,answer)) if isinstance(answer,list) else str(answer)
   assert run(ref,text).split()==want.split(),(pid,"oracle",len(oracle_cases))
   oracle_cases.append(dict(input=text,expectedOutput=want+"\n"))
  controls=[]
  for j,(name,code) in enumerate(M[n],1):
   rejected=[]
   for ci,c in enumerate(cases[:25]+oracle_cases):
    proc=subprocess.run([sys.executable,"-c",code],input=c["input"],text=True,capture_output=True,timeout=5);assert proc.returncode==0,(pid,name,ci,proc.stderr)
    if proc.stdout.strip().split()!=c["expectedOutput"].split():rejected.append(ci);break
   assert rejected,(pid,name,"not killed")
   f=OA/"negative-controls"/("%s-%d.py"%(pid,j));f.write_text(code);controls.append(dict(file=str(f.relative_to(ROOT)),description=name,rejectedByCases=rejected[:30]))
  write(OA/"oracles"/(pid+".json"),oracle_cases);write(OA/"mutants"/(pid+".json"),[dict(name=a,code=b) for a,b in M[n]])
  problem=dict(id=pid,courseId="gomall",lessonId="00-overview",title=title,difficulty=difficulty,tags=["OA","MathWorks"],description=desc+"\n\n本站输入输出协议见下方；不执行来源仓库题解。",input=inptext,output=outtext,explanation=explain,hints=[explain],timeLimit=4,memoryLimit=262144,outputLimit=4096,checker="tokens",languages=["python","go","java","cpp"])
  package=dict(schemaVersion=1,problem=problem,cases=cases);write(OA/"packages"/(pid+".json"),package)
  editorial="## 思路\n\n"+explain+"\n\n## 正确性证明\n\n"+PROOFS[n]+"\n\n## 复杂度\n\n"+{6:"时间O(n)，空间O(n)。",7:"时间O(n)，空间O(n)。",11:"时间O(n log n)，空间O(n)。",13:"时间O(n+q)，空间O(n)。",14:"时间O(m log(sum(burstTime)))，空间O(m)。"}[n]
  sols=[dict(language="python",code=ref)];write(OA/"editorials"/(pid+".json"),dict(schemaVersion=1,id=pid,title=title,explanation=editorial,solutions=sols,sourceUrl=source["sourceUrl"],sourceContentHash=source["contentHash"],author="CSWork"))
  norm=json.dumps(package,ensure_ascii=False,separators=(",",":"));items.append(dict(id=pid,sourceContentHash=source["contentHash"],packageChecksum=sha(norm.encode()),editorial=editorial,authoredSolutions=sols))
  reports.append(dict(id=pid,oracleCases=len(oracle_cases),formal=len(cases),passed=len(cases)+len(oracle_cases),negativeControls=controls,referenceSha256=sha(ref.encode()),maxLegalInputBytesUpperBound=limit,maxTestInputBytes=max(len(c["input"].encode()) for c in cases)))
 write(OA/"candidate-batches/mathworks-next.json",dict(schemaVersion=1,items=items))
 write(OA/"validation/mathworks-next.json",dict(schemaVersion=1,seed=20261005,sourceCommit="e66f809f4c953bce129f68491726176615db6afc",note="本地标准输入输出验证：独立枚举/DP oracle，每题120个唯一小输入，另测公开样例、结构化边界与正常退出错误程序；不代表 GoJudge 沙箱报告。",problems=reports))
 print("Validated 5 candidates and",sum(x["oracleCases"] for x in reports),"independent inputs.")
if __name__=="__main__":main()
