"""Fourth original DP suite. Domains checked against each local README_EN.

The exhaustive small oracles enumerate choices, partitions, paths or subsets.
Downloaded solutions are never imported or executed here.
"""
import inspect
import itertools
from functools import lru_cache
from bisect import bisect_left,bisect_right
from collections import deque
MOD=1000000007
IDS=[375,376,403,646,823,845,873,879,926,1039,1048,1235,1335,1402,1493,1513,1546,1626,1671,1696,1911,1955,1981,2008,2140,2222,2266,2369,2606,2684]

def subsets(x):
 for mask in range(1<<len(x)):yield [v for i,v in enumerate(x) if mask>>i&1]

def mountain(x):
 return any(all(x[j]<x[j+1] for j in range(p)) and all(x[j]>x[j+1] for j in range(p,len(x)-1)) for p in range(1,len(x)-1))

def oracle(pid,a):
 x=a[0]
 if pid==375:
  # Exhaustive decision trees; memoization only merges identical subgames.
  @lru_cache(None)
  def tree(lo,hi):return 0 if lo>=hi else min(v+max(tree(lo,v-1),tree(v+1,hi)) for v in range(lo,hi+1))
  return tree(1,x)
 if pid==376:
  return max(len(s) for s in subsets(x) if s and all(u!=v for u,v in zip(s,s[1:])) and all((s[i]-s[i-1])*(s[i+1]-s[i])<0 for i in range(1,len(s)-1)))
 if pid==403:
  def paths(pos,step):return pos==x[-1] or any(paths(v,v-pos) for v in x if v>pos and v-pos in (step-1,step,step+1))
  return int(paths(0,0))
 if pid==646:
  return max([0]+[len(s) for s in subsets(sorted(x)) if all(u[1]<v[0] for u,v in zip(s,s[1:]))])
 if pid==823:
  # Explicitly enumerate ordered tree structures, including the leaf at each root.
  def trees(root):
   ans={(root,)}
   for u in x:
    for v in x:
     if u*v==root:
      ans.update((root,l,r) for l in trees(u) for r in trees(v))
   return ans
  return sum(len(trees(v)) for v in x)%MOD
 if pid in (845,1671):
  seqs=(x[i:j] for i in range(len(x)) for j in range(i+3,len(x)+1)) if pid==845 else subsets(x)
  longest=max([0]+[len(s) for s in seqs if mountain(s)])
  return longest if pid==845 else len(x)-longest
 if pid==873:return max([0]+[len(s) for s in subsets(x) if len(s)>=3 and all(s[i]+s[i+1]==s[i+2] for i in range(len(s)-2))])
 if pid==879:
  n,p,g,v=a
  return sum(sum(g[i] for i in s)<=n and sum(v[i] for i in s)>=p for s in subsets(list(range(len(g)))))%MOD
 if pid==926:return min(sum(c!=('0' if i<k else '1') for i,c in enumerate(x)) for k in range(len(x)+1))
 if pid==1039:
  # Enumerate every sequence of removing ears; each gives a triangulation.
  def ears(v):
   if len(v)==3:return v[0]*v[1]*v[2]
   return min(v[i-1]*v[i]*v[(i+1)%len(v)]+ears(v[:i]+v[i+1:]) for i in range(len(v)))
  return ears(x)
 if pid==1048:
  def chain(w):return 1+max([0]+[chain(v) for v in set(x) if len(v)==len(w)+1 and any(v[:i]+v[i+1:]==w for i in range(len(v)))])
  return max(map(chain,x))
 if pid in (1235,2008):
  jobs=list(zip(*a)) if pid==1235 else [(s,e,e-s+t) for s,e,t in a[1]]
  return max([0]+[sum(v[2] for v in s) for s in subsets(sorted(jobs)) if all(u[1]<=v[0] for u,v in zip(s,s[1:]))])
 if pid==1335:
  d=a[1]
  if len(x)<d:return -1
  return min(sum(max(x[u:v]) for u,v in zip((0,)+cuts,cuts+(len(x),))) for cuts in itertools.combinations(range(1,len(x)),d-1))
 if pid==1402:
  # For fixed chosen dishes, exchanging an inverted adjacent pair improves score.
  return max(sum((i+1)*v for i,v in enumerate(sorted(s))) for s in subsets(x))
 if pid==1493:
  best=0
  for i in range(len(x)):
   run=0
   for v in x[:i]+x[i+1:]:
    run=run+1 if v else 0;best=max(best,run)
  return best
 if pid==1513:return sum(set(x[i:j])=={'1'} for i in range(len(x)) for j in range(i+1,len(x)+1))%MOD
 if pid==1546:
  def choose(i):return 0 if i==len(x) else max([choose(i+1)]+[1+choose(j) for j in range(i+1,len(x)+1) if sum(x[i:j])==a[1]])
  return choose(0)
 if pid==1626:
  return max(sum(x[i] for i in s) for s in subsets(list(range(len(x)))) if all(a[1][i]>=a[1][j] or x[i]<=x[j] for i in s for j in s))
 if pid==1696:
  def jump(i):return x[i] if i==len(x)-1 else x[i]+max(jump(j) for j in range(i+1,min(len(x),i+a[1]+1)))
  return jump(0)
 if pid==1911:return max(sum((-1)**i*v for i,v in enumerate(s)) for s in subsets(x))
 if pid==1955:return sum(bool(s) and set(s)=={0,1,2} and s==sorted(s) for s in subsets(x))%MOD
 if pid==1981:return min(abs(sum(v)-a[1]) for v in itertools.product(*x))
 if pid==2140:
  return max(sum(x[i][0] for i in s) for s in subsets(list(range(len(x)))) if all(j>i+x[i][1] for i,j in zip(s,s[1:])))
 if pid==2222:return sum(x[i]==x[k]!=x[j] for i,j,k in itertools.combinations(range(len(x)),3))
 if pid==2266:
  def split(i):return 1 if i==len(x) else sum(split(j) for j in range(i+1,min(len(x),i+(4 if x[i] in '79' else 3))+1) if len(set(x[i:j]))==1)
  return split(0)%MOD
 if pid==2369:
  def split(i):
   if i==len(x):return True
   return any(split(i+k) for k in (2,3) if i+k<=len(x) and (len(set(x[i:i+k]))==1 or k==3 and x[i:i+k]==list(range(x[i],x[i]+3))))
  return int(split(0))
 if pid==2606:
  costs=dict(zip(a[1],a[2]));v=[costs.get(c,ord(c)-96) for c in x]
  return max([0]+[sum(v[i:j]) for i in range(len(v)) for j in range(i+1,len(v)+1)])
 if pid==2684:
  def path(r,c):return max([0]+[1+path(t,c+1) for t in range(max(0,r-1),min(len(x),r+2)) if c+1<len(x[0]) and x[t][c+1]>x[r][c]])
  return max(path(r,0) for r in range(len(x)))
 raise AssertionError(pid)

# Independent efficient implementations supply two plausible, named mistakes.
# bug=0 is only for authored regression comparisons; official expected data uses oracle.
def variant(pid,a,bug=0):
 x=a[0]
 if pid==375:
  f=[[0]*(x+2) for _ in range(x+2)]
  for width in range(2,x+1):
   for lo in range(1,x-width+2):
    hi=lo+width-1
    pivots=[(lo+hi)//2] if bug==1 else range(lo,hi+1)
    f[lo][hi]=min(k+(min if bug==2 else max)(f[lo][k-1],f[k+1][hi]) for k in pivots)
  return f[1][x]
 if pid==376:
  up=down=1
  for u,v in zip(x,x[1:]):
   if v>u or bug==1 and v==u:up=down+1
   elif v<u:down=up+1
  return up if bug==2 else max(up,down)
 if pid==403:
  reach={v:set() for v in x};reach[0]={0}
  for p in x:
   for k in list(reach[p]):
    for d in ((k,k+1) if bug==1 else (k-1,k,k+1)):
     if d>0 and p+d in reach and (not bug==2 or p!=0 or d==2):reach[p+d].add(d)
   if bug==2 and p==0 and 2 in reach:reach[2].add(2)
  return int(bool(reach[x[-1]]))
 if pid==646:
  last=-10**9;ans=0
  for u,v in sorted(x,key=lambda q:q[0 if bug==2 else 1]):
   if u>last or bug==1 and u==last:ans+=1;last=v
  return ans
 if pid==823:
  f={}
  for v in sorted(x):
   f[v]=0 if bug==1 else 1
   for u in list(f):
    if v%u==0 and v//u in f and (bug!=2 or u<=v//u):f[v]=(f[v]+f[u]*f[v//u])%MOD
  return sum(f.values())%MOD
 if pid in (845,1671):
  n=len(x);up=[1]*n;down=[1]*n
  if pid==845:
   for i in range(1,n):
    if x[i]>x[i-1] or bug==1 and x[i]==x[i-1]:up[i]=up[i-1]+1
   for i in range(n-2,-1,-1):
    if x[i]>x[i+1] or bug==1 and x[i]==x[i+1]:down[i]=down[i+1]+1
  else:
   for i in range(n):
    up[i]=1+max([0]+[up[j] for j in range(i) if x[j]<x[i] or bug==1 and x[j]==x[i]])
   for i in range(n-1,-1,-1):down[i]=1+max([0]+[down[j] for j in range(i+1,n) if x[j]<x[i] or bug==1 and x[j]==x[i]])
  best=max([0]+[u+d-1 for u,d in zip(up,down) if bug==2 or u>1 and d>1])
  return best if pid==845 else n-best
 if pid==873:
  vals=set(x);best=2 if bug==1 else 0
  for i,u in enumerate(x):
   for v in x[i+1:]:
    p,q=u,v;count=2
    while p+q in vals:p,q=q,p+q;count+=1
    if count>=3:best=max(best,count-(1 if bug==2 else 0))
  return best
 if pid==879:
  n,target,g,v=a;f={(0,0):1}
  for people,money in zip(g,v):
   nxt=dict(f)
   for (used,got),count in f.items():
    if used+people<=n:
     key=(used+people,min(target,got+money));nxt[key]=(nxt.get(key,0)+count)%MOD
   f=nxt
  return sum(c for (u,p),c in f.items() if p==target and (bug!=1 or u==n) and (bug!=2 or u>0))%MOD
 if pid==926:
  if bug==1:return min(x.count('0'),x.count('1'))
  ones=flips=0
  for c in x:
   if c=='1':ones+=1
   else:flips=min(flips+1,ones)
  return flips+(1 if bug==2 and '10' not in x else 0)
 if pid==1039:
  n=len(x)
  if bug:return sum(x[0 if bug==1 else n-1]*x[i]*x[i+1] for i in (range(1,n-1) if bug==1 else range(n-2)))
  f=[[0]*n for _ in x]
  for d in range(2,n):
   for i in range(n-d):
    j=i+d;f[i][j]=min(f[i][k]+f[k][j]+x[i]*x[k]*x[j] for k in range(i+1,j))
  return f[0][-1]
 if pid==1048:
  f={}
  for w in (x if bug==1 else sorted(x,key=len)):
   parents=[w[:-1]] if bug==2 else [w[:i]+w[i+1:] for i in range(len(w))]
   f[w]=max(f.get(w,0),1+max([0]+[f.get(v,0) for v in parents]))
  return max(f.values())
 if pid in (1235,2008):
  jobs=sorted(zip(*a),key=lambda v:v[1]) if pid==1235 else sorted([(s,e,t+(0 if bug==2 else e-s)) for s,e,t in a[1]],key=lambda v:v[1])
  if pid==1235 and bug==2:return max(v[2] for v in jobs)
  ends=[];f=[0]
  for s,e,p in jobs:
   j=(bisect_left if bug==1 else bisect_right)(ends,s);f.append(max(f[-1],p+f[j]));ends.append(e)
  return f[-1]
 if pid==1335:
  n=len(x);d=a[1]
  if n<d:return 0 if bug==1 else -1
  if bug==2:return sum(sorted(x,reverse=True)[:d])
  f=[0]+[10**12]*n
  for _ in range(d):
   nxt=[10**12]*(n+1)
   for i in range(1,n+1):
    peak=0
    for j in range(i-1,-1,-1):peak=max(peak,x[j]);nxt[i]=min(nxt[i],f[j]+peak)
   f=nxt
  return f[-1]
 if pid==1402:
  seq=[v for v in x if v>=0] if bug==1 else x
  if bug==2:return sum((i+1)*v for i,v in enumerate(sorted(seq)))
  total=ans=0
  for v in sorted(seq,reverse=True):
   total+=v
   if total<=0:break
   ans+=total
  return ans
 if pid==1493:
  left=zeros=best=0
  for right,v in enumerate(x):
   zeros+=v==0
   while zeros>(0 if bug==2 else 1):zeros-=x[left]==0;left+=1
   best=max(best,right-left+(1 if bug==1 else 0))
  return best
 if pid==1513:
  ans=run=0
  for c in x:
   run=run+1 if c=='1' else 0;ans+=1 if bug==1 and c=='1' else run if bug!=1 else 0
  return ans if bug==2 else ans%MOD
 if pid==1546:
  seen={0};total=ans=0
  for v in x:
   total+=v
   if total-a[1] in seen:
    ans+=1
    if bug!=1:seen=set() if bug==2 else {total}
   seen.add(total)
  return ans
 if pid==1626:
  items=sorted(zip(a[1],x));f=[]
  for i,(age,score) in enumerate(items):
   f.append(score+max([0]+[f[j] for j in range(i) if (items[j][1]<score if bug==1 else items[j][1]<=score) and (bug!=2 or items[j][0]<age)]))
  return max(f)
 if pid==1696:
  if bug==1:return sum(x)
  if bug==2:return x[0]+sum(v for v in x[1:-1] if v>0)+(x[-1] if len(x)>1 else 0)
  f=[x[0]];q=deque([0])
  for i in range(1,len(x)):
   while q[0]<i-a[1]:q.popleft()
   f.append(x[i]+f[q[0]])
   while q and f[q[-1]]<=f[i]:q.pop()
   q.append(i)
  return f[-1]
 if pid==1911:
  if bug==1:return sum((-1)**i*v for i,v in enumerate(x))
  if bug==2:return max(x)
  plus=minus=0
  for v in x:plus,minus=max(plus,minus+v),max(minus,plus-v)
  return max(plus,minus)
 if pid==1955:
  f=[0,0,0]
  for v in x:f[v]=(f[v]*(1 if bug==1 else 2)+(1 if v==0 else f[v-1]))%MOD
  return sum(f)%MOD if bug==2 else f[2]
 if pid==1981:
  if bug==1:return abs(sum(min(row) for row in x)-a[1])
  if bug==2:return abs(sum(max(row) for row in x)-a[1])
  possible={0}
  for row in x:possible={v+w for v in possible for w in set(row)}
  return min(abs(v-a[1]) for v in possible)
 if pid==2140:
  if bug==2:return sum(v[0] for v in x)
  f=[0]*(len(x)+1)
  for i in range(len(x)-1,-1,-1):f[i]=max(f[i+1],x[i][0]+f[min(len(x),i+x[i][1]+(0 if bug==1 else 1))])
  return f[0]
 if pid==2222:
  if bug==1:return sum(x[i:i+3] in ('010','101') for i in range(len(x)-2))
  f=[0]*6
  for c in x:
   k=int(c);f[4+k]+=f[3-k];f[2+k]+=f[1-k];f[k]+=1
  return f[4] if bug==2 else f[4]+f[5]
 if pid==2266:
  f=[1]+[0]*len(x)
  for i in range(1,len(x)+1):
   for k in range(1,(3 if bug==1 or x[i-1] not in '79' else 4)+1):
    if i>=k and len(set(x[i-k:i]))==1:f[i]+=f[i-k]
   if bug!=2:f[i]%=MOD
  return f[-1]
 if pid==2369:
  f=[True]+[False]*len(x)
  for i in range(2,len(x)+1):
   f[i]=f[i-2] and x[i-1]==x[i-2]
   if i>=3:f[i]|=f[i-3] and ((bug!=1 and x[i-3]==x[i-2]==x[i-1]) or (bug!=2 and x[i-2]==x[i-3]+1 and x[i-1]==x[i-2]+1))
  return int(f[-1])
 if pid==2606:
  costs={} if bug==1 else dict(zip(a[1],a[2]));best=run=0
  for c in x:
   v=costs.get(c,ord(c)-96);run=max(0,run+v);best=max(best,run)
  return sum(max(0,costs.get(c,ord(c)-96)) for c in x) if bug==2 else best
 if pid==2684:
  rows=set(range(len(x))) if bug!=2 else {0}
  for c in range(len(x[0])-1):
   nxt={r for p in rows for r in range(max(0,p-1),min(len(x),p+2)) if x[r][c+1]>x[p][c] or bug==1 and x[r][c+1]==x[p][c]}
   if not nxt:return c
   rows=nxt
  return len(x[0])-1
 raise AssertionError(pid)

EDGES={
375:[[10],[1],[2],[4]],376:[[[1,7,4,9,2,5]],[[1,1,1]],[[3,2,1]],[[1]]],
403:[[[0,1,3,5,6,8,12,17]],[[0,2]],[[0,1]],[[0,1,3,6,7]]],
646:[[[[1,2],[2,3],[3,4]]],[[[1,10],[2,3],[4,5]]],[[[-2,-1]]]],
823:[[[2,4]],[[2,4,8]],[[3]],[[2,4,5,10]]],845:[[[2,1,4,7,3,2,5]],[[1,2,3]],[[1,2,2,1]],[[1]]],
873:[[[1,2,3,4,5,6,7,8]],[[1,3,7]],[[1,2,3]]],879:[[5,3,[2,2],[2,3]],[5,0,[2],[0]],[1,0,[2],[0]]],
926:[['00110'],['000'],['111'],['010110']],1039:[[[1,3,1,4,1,5]],[[3,7,4,5]],[[1,2,3]]],
1048:[[['a','b','ba','bca','bda','bdca']],[['abc','ab','a']],[['a','ba']]],
1235:[[[1,2,3,3],[3,4,5,6],[50,10,40,70]],[[1,2],[2,3],[5,5]]],
1335:[[[6,5,4,3,2,1],2],[[1],2],[[1,2,3],2]],1402:[[[-1,-8,0,5,-9]],[[-5,-2]],[[-1,5]]],
1493:[[[1,1,0,1]],[[1,1,1]],[[0]],[[1,0,1]]],1513:[['0110111'],['11'],['0']],
1546:[[[1,1,1,1,1],2],[[1,-1,1,-1],0],[[1],1]],1626:[[[1,3,5,10,15],[1,2,3,4,5]],[[2,2],[1,2]],[[2,3],[1,1]]],
1671:[[[2,1,1,5,6,2,3,1]],[[1,2,3,4,3]],[[1,2,2,1]]],1696:[[[1,-1,-2,4,-7,3],2],[[1,-2,-3,4],1],[[7],100]],
1911:[[[4,2,5,3]],[[1,3,2,5]],[[2,3]]],1955:[[[0,1,2,2]],[[0]],[[2,1,0]]],1981:[[[[1,2,3],[4,5,6],[7,8,9]],13],[[[1,5]],3]],
2008:[[5,[[2,5,4],[1,5,1]]],[3,[[1,2,1],[2,3,1]]]],2140:[[[[3,2],[4,3],[4,4],[2,5]]],[[[1,1],[10,1]]]],
2222:[['001101'],['101'],['010'],['000']],2266:[['22233'],['7777'],['2']],2369:[[[4,4,4,5,6]],[[1,1,1]],[[1,2,3]],[[1,2]]],
2606:[['adaa','d',[-1000]],['a','a',[-1]],['azb','z',[-100]]],2684:[[[[2,4,3,5],[5,4,9,3],[3,4,2,11],[10,9,13,15]]],[[[1,1],[1,1]]],[[[100,1,1],[1,2,3]]]]}

def random_args(pid,r):
 n=r.randint(1,9)
 if pid==375:return [r.randint(1,15)]
 if pid==376:return [[r.randint(0,9) for _ in range(n)]]
 if pid==403:return [[0]+sorted(r.sample(range(1,28),r.randint(1,8))) ]
 if pid==646:return [[[u,u+r.randint(1,5)] for u in [r.randint(-7,7) for _ in range(n)]]]
 if pid==823:return [r.sample([2,3,4,5,6,8,9,10,12,16],r.randint(1,6))]
 if pid==845:return [[r.randint(0,7) for _ in range(n)]]
 if pid==873:return [sorted(r.sample(range(1,30),r.randint(3,9)))]
 if pid==879:return [r.randint(1,9),r.randint(0,12),[r.randint(1,6) for _ in range(n)],[r.randint(0,7) for _ in range(n)]]
 if pid in (926,1513,2222):return [''.join(r.choice('01') for _ in range(max(3,n) if pid==2222 else n))]
 if pid==1039:return [[r.randint(1,9) for _ in range(r.randint(3,7))]]
 if pid==1048:return [[''.join(r.choice('ab') for _ in range(r.randint(1,5))) for _ in range(n)]]
 if pid==1235:
  starts=[r.randint(1,10) for _ in range(n)];return [starts,[s+r.randint(1,5) for s in starts],[r.randint(1,20) for _ in starts]]
 if pid==1335:return [[r.randint(0,12) for _ in range(n)],r.randint(1,10)]
 if pid==1402:return [[r.randint(-8,8) for _ in range(n)]]
 if pid==1493:return [[r.randrange(2) for _ in range(n)]]
 if pid==1546:return [[r.randint(-3,3) for _ in range(n)],r.randint(0,6)]
 if pid==1626:return [[r.randint(1,10) for _ in range(n)],[r.randint(1,5) for _ in range(n)]]
 if pid==1671:return [[1,9]+[r.randint(1,9) for _ in range(n%6)]+[1]]
 if pid==1696:return [[r.randint(-9,9) for _ in range(n)],r.randint(1,12)]
 if pid==1911:return [[r.randint(1,12) for _ in range(n)]]
 if pid==1955:return [[r.randrange(3) for _ in range(n)]]
 if pid==1981:
  cols=r.randint(1,4);return [[[r.randint(1,9) for _ in range(cols)] for _ in range(r.randint(1,5))],r.randint(1,40)]
 if pid==2008:
  start=[r.randint(1,10) for _ in range(n)];return [15,[[s,s+r.randint(1,5),r.randint(1,10)] for s in start]]
 if pid==2140:return [[[r.randint(1,12),r.randint(1,5)] for _ in range(n)]]
 if pid==2266:return [''.join(r.choice('22779') for _ in range(n))]
 if pid==2369:return [[r.randint(1,4) for _ in range(max(2,n))]]
 if pid==2606:
  chars=''.join(r.sample('abcd',r.randint(1,4)));return [''.join(r.choice('abcde') for _ in range(n)),chars,[r.randint(-8,8) for _ in chars]]
 if pid==2684:return [[[r.randint(1,12) for _ in range(4)] for _ in range(r.randint(2,5))]]
 raise AssertionError(pid)

def compositions(n,k):
 f=[1]+[0]*n
 for i in range(1,n+1):f[i]=sum(f[max(0,i-k):i])%MOD
 return f[n]

PRESSURE={
375:[([200],952)],376:[([[0,1000]*500],1000),([[1000]*1000],1)],
403:[([list(range(2000))],1),([[0]+list(range(2,2000))+[2**31-1]],0)],
646:[([[[2*i-1000,2*i-999] for i in range(1000)]],1000)],
823:[([list(range(10**9-999,10**9+1))],1000)],845:[([list(range(5001))+list(range(4999,0,-1))],10000),([[10000]*10000],0)],
873:[([list(range(10**9-999,10**9+1))],0)],879:[([100,0,[1]*100,[0]*100],pow(2,100,MOD)),([100,100,[100]*100,[100]*100],100)],
926:[(['10'*50000],50000)],1039:[([[100]*50],48000000)],1048:[([['a'*i for i in range(1,17)]+['a'*16]*984],16)],
1235:[([list(range(1,50001)),list(range(2,50002)),[10000]*50000],500000000)],
1335:[([[1000]*300,10],10000)],1402:[([[1000]*500],125250000)],1493:[([[1]*100000],99999)],
1513:[(['1'*100000],100000*100001//2%MOD)],1546:[([[0]*100000,0],100000)],
1626:[([[1000000]*1000,[1000]*1000],1000000000)],1671:[([list(range(1,501))+list(range(500,0,-1))],1)],
1696:[([[10000]*100000,100000],1000000000),([[-10000]*100000,1],-1000000000)],
1911:[([[100000,1]*50000],4999950001)],1955:[([[0]*33333+[1]*33333+[2]*33334],((pow(2,33333,MOD)-1)**2*(pow(2,33334,MOD)-1))%MOD)],
1981:[([[[70]*70 for _ in range(70)],800],4100)],
2008:[([100000,[[i,i+1,100000] for i in range(1,30001)]],3000030000)],
2140:[([[[100000,1] for _ in range(100000)]],5000000000)],
2222:[(['0'*33333+'1'*33334+'0'*33333],33333*33334*33333)],
2266:[(['7'*100000],compositions(100000,4)),(['23'*50000],1)],
2369:[([[1000000]*100000],1)],2606:[(['z'*100000,'a',[-1000]],2600000)],
2684:[([[list(range(1,1001)) for _ in range(100)]],999),([[[1000000]*100 for _ in range(1000)]],0)]}

# Human-readable constraints are duplicated in validate so malformed generators fail closed.
def validate(pid,a):
 def num(v,lo,hi):assert type(v) is int and lo<=v<=hi
 def vec(v,nlo,nhi,lo,hi):
  assert type(v) is list and nlo<=len(v)<=nhi
  for w in v:num(w,lo,hi)
 def string(s,lo,hi,alphabet):assert type(s) is str and lo<=len(s)<=hi and set(s)<=set(alphabet)
 expected={879:4,1235:3,2606:3,1335:2,1546:2,1626:2,1696:2,1981:2,2008:2}.get(pid,1)
 assert type(a) is list and len(a)==expected
 x=a[0]
 domains={376:(1,1000,0,1000),823:(1,1000,2,10**9),845:(1,10000,0,10000),873:(3,1000,1,10**9),1039:(3,50,1,100),1335:(1,300,0,1000),1402:(1,500,-1000,1000),1493:(1,100000,0,1),1546:(1,100000,-10000,10000),1626:(1,1000,1,1000000),1671:(3,1000,1,10**9),1696:(1,100000,-10000,10000),1911:(1,100000,1,100000),1955:(1,100000,0,2),2369:(2,100000,1,1000000)}
 if pid in domains:vec(x,*domains[pid])
 if pid==375:num(x,1,200)
 if pid==403:
  vec(x,2,2000,0,2**31-1);assert x[0]==0 and all(u<v for u,v in zip(x,x[1:]))
 if pid==646:
  assert type(x) is list and 1<=len(x)<=1000
  for p in x:vec(p,2,2,-1000,1000);assert p[0]<p[1]
 if pid==823:assert len(set(x))==len(x)
 if pid==873:assert all(u<v for u,v in zip(x,x[1:]))
 if pid==879:num(x,1,100);num(a[1],0,100);vec(a[2],1,100,1,100);vec(a[3],len(a[2]),len(a[2]),0,100)
 if pid in (926,1513,2222):string(x,3 if pid==2222 else 1,100000,'01')
 if pid==1048:
  assert type(x) is list and 1<=len(x)<=1000
  for w in x:string(w,1,16,'abcdefghijklmnopqrstuvwxyz')
 if pid==1235:
  vec(x,1,50000,1,10**9);vec(a[1],len(x),len(x),1,10**9);vec(a[2],len(x),len(x),1,10000);assert all(u<v for u,v in zip(x,a[1]))
 if pid==1335:num(a[1],1,10)
 if pid==1546:num(a[1],0,1000000)
 if pid==1626:vec(a[1],len(x),len(x),1,1000)
 if pid==1671:
  # Existence of one interior strict peak with smaller elements on both sides.
  lo=x[0];right=[0]*len(x);right[-1]=x[-1]
  for i in range(len(x)-2,-1,-1):right[i]=min(x[i],right[i+1])
  feasible=False
  for i in range(1,len(x)-1):feasible|=lo<x[i] and right[i+1]<x[i];lo=min(lo,x[i])
  assert feasible
 if pid==1696:num(a[1],1,100000)
 if pid in (1981,2684):
  bound=70 if pid==1981 else 1000;low=1 if pid==1981 else 2
  assert type(x) is list and low<=len(x)<=bound and type(x[0]) is list and low<=len(x[0])<=bound
  for row in x:vec(row,len(x[0]),len(x[0]),1,70 if pid==1981 else 1000000)
  if pid==1981:num(a[1],1,800)
  else:assert len(x)*len(x[0])<=100000
 if pid==2008:
  num(x,1,100000);assert type(a[1]) is list and 1<=len(a[1])<=30000
  for row in a[1]:vec(row,3,3,1,100000);assert row[0]<row[1]<=x
 if pid==2140:
  assert type(x) is list and 1<=len(x)<=100000
  for row in x:vec(row,2,2,1,100000)
 if pid==2266:string(x,1,100000,'23456789')
 if pid==2606:
  string(x,1,100000,'abcdefghijklmnopqrstuvwxyz');string(a[1],1,26,'abcdefghijklmnopqrstuvwxyz');assert len(set(a[1]))==len(a[1]);vec(a[2],len(a[1]),len(a[1]),-1000,1000)
 return True

# Each argument occupies a documented line or block; count prefixes are consumed strictly.
def encode(pid,a):
 def line(v):return ' '.join(map(str,v))+'\n'
 x=a[0]
 if pid==375:return str(x)+'\n'
 if pid in (926,1513,2222,2266):return x+'\n'
 if pid==2606:return x+'\n'+a[1]+'\n'+line(a[2])
 if pid==879:return line([x,a[1],len(a[2])])+line(a[2])+line(a[3])
 if pid==1235:return str(len(x))+'\n'+''.join(line(v) for v in a)
 if pid==2008:return line([x,len(a[1])])+''.join(line(row) for row in a[1])
 if pid in (1981,2684):return line([len(x),len(x[0])])+''.join(line(row) for row in x)+(str(a[1])+'\n' if pid==1981 else '')
 if pid in (646,2140):return str(len(x))+'\n'+''.join(line(row) for row in x)
 if pid==1048:return str(len(x))+'\n'+'\n'.join(x)+'\n'
 return str(len(x))+'\n'+line(x)+(''.join(line(v) if isinstance(v,list) else str(v)+'\n' for v in a[1:]))

def parse_code(pid):
 if pid in (926,1513,2222,2266):return "args=[sys.stdin.readline().rstrip('\\n')]"
 if pid==2606:return "args=[sys.stdin.readline().rstrip('\\n'),sys.stdin.readline().rstrip('\\n'),list(map(int,sys.stdin.readline().split()))]"
 if pid==1048:return "n=int(sys.stdin.readline()); args=[[sys.stdin.readline().rstrip('\\n') for _ in range(n)]]"
 prefix="it=iter(map(int,sys.stdin.read().split()))\n"
 if pid==375:return prefix+"args=[next(it)]"
 if pid==879:return prefix+"n,p,k=next(it),next(it),next(it); args=[n,p,[next(it) for _ in range(k)],[next(it) for _ in range(k)]]"
 if pid==1235:return prefix+"n=next(it); args=[[next(it) for _ in range(n)] for _ in range(3)]"
 if pid==2008:return prefix+"n,k=next(it),next(it); args=[n,[[next(it) for _ in range(3)] for _ in range(k)]]"
 if pid in (1981,2684):return prefix+"m,n=next(it),next(it); args=[[[next(it) for _ in range(n)] for _ in range(m)]]"+("; args.append(next(it))" if pid==1981 else '')
 if pid in (646,2140):return prefix+"n=next(it); args=[[[next(it),next(it)] for _ in range(n)]]"
 return prefix+"n=next(it); args=[[next(it) for _ in range(n)]]"+("; args.append([next(it) for _ in range(n)])" if pid==1626 else "; args.append(next(it))" if pid in (1335,1546,1696) else '')

# Selected-only exports below. Earlier helpers are retained from the paused,
# unpublished authored batch; only the following 25 IDs enter this suite.
IDS=[2369,1049,879,691,354,646,1048,873,1626,1671,2707,1039,312,1911,926,2140,1235,2008,1335,403,1696,375,150,394,224]
from collections import Counter
import re

def trunc_div(u,v):return (1 if u*v>=0 else -1)*(abs(u)//abs(v))

def rpn_tree(tokens):
 # Parse backward into a syntax tree, independently of the standard stack evaluator.
 def expression(i):
  t=tokens[i]
  if t not in ('+','-','*','/'):return int(t),i-1
  right,j=expression(i-1);left,k=expression(j)
  return {'+':lambda:left+right,'-':lambda:left-right,'*':lambda:left*right,'/':lambda:trunc_div(left,right)}[t](),k
 value,i=expression(len(tokens)-1);assert i==-1;return value

def arithmetic(s):
 # Iterative shunting yard: also validates grammar and every intermediate result.
 tokens=re.findall(r'\d+|[()+-]',s);values=[];operators=[];need_value=True
 def apply():
  op=operators.pop()
  if op=='~':v=-values.pop()
  else:
   right,left=values.pop(),values.pop();v=left+right if op=='+' else left-right
  assert -2**31<=v<2**31;values.append(v)
 for token in tokens:
  if token.isdigit():
   assert need_value;v=int(token);assert v<2**31;values.append(v);need_value=False
   while operators and operators[-1]=='~':apply()
  elif token=='(':
   assert need_value;operators.append(token)
  elif token==')':
   assert not need_value
   while operators and operators[-1]!='(':apply()
   assert operators;operators.pop()
   while operators and operators[-1]=='~':apply()
   need_value=False
  elif need_value:
   assert token=='-' and (not operators or operators[-1]=='(');operators.append('~')
  else:
   while operators and operators[-1]!='(':apply()
   operators.append(token);need_value=True
 assert not need_value
 while operators:assert operators[-1]!='(';apply()
 assert len(values)==1;return values[0]

def decoded(s):
 # Repeated innermost replacement has no explicit nesting stack.
 while '[' in s:
  updated,n=re.subn(r'(\d+)\[([a-z]*)\]',lambda m:int(m[1])*m[2],s)
  assert n and len(updated)<=100030;s=updated
 assert re.fullmatch('[a-z]*',s);assert len(s)<=100000;return s

_base_oracle=oracle

def oracle(pid,a):
 x=a[0]
 if pid==1049:
  # Explore all legal physical collision choices, not a subset-sum reduction.
  @lru_cache(None)
  def smash(stones):
   if len(stones)<2:return sum(stones)
   return min(smash(tuple(sorted([v for k,v in enumerate(stones) if k not in (i,j)]+([abs(stones[i]-stones[j])] if stones[i]!=stones[j] else [])))) for i in range(len(stones)) for j in range(i+1,len(stones)))
  return smash(tuple(sorted(x)))
 if pid==691:
  needed=Counter(a[1]);counts=[Counter(s) for s in x]
  for k in range(len(a[1])+1):
   for choices in itertools.combinations_with_replacement(range(len(x)),k):
    if all(sum(counts[i][c] for i in choices)>=n for c,n in needed.items()):return k
  return -1
 if pid==354:return max(len(s) for s in subsets(sorted(x)) if all(u[0]<v[0] and u[1]<v[1] for u,v in zip(s,s[1:])))
 if pid==2707:
  def split(i):return 0 if i==len(x) else min([1+split(i+1)]+[split(i+len(w)) for w in a[1] if x.startswith(w,i)])
  return split(0)
 if pid==312:
  def pop(v):
   if not v:return 0
   return max((v[i-1] if i else 1)*v[i]*(v[i+1] if i+1<len(v) else 1)+pop(v[:i]+v[i+1:]) for i in range(len(v)))
  return pop(x)
 if pid==150:return rpn_tree(x)
 if pid==394:return decoded(x)
 if pid==224:return arithmetic(x)
 return _base_oracle(pid,a)

# Both new and restored incorrect programs are original and run independently
# of the brute-force oracle. No downloaded solution is executed to construct them.
def extra_variant(pid,a,bug=0):
 x=a[0]
 if pid==1049:
  if bug==1:
   v=sorted(x)
   while len(v)>1:
    t=v.pop()-v.pop()
    if t:v.append(t);v.sort()
   return sum(v)
  total=sum(x);cap=total//2;possible={0}
  for v in x:possible|={s+v for s in list(possible) if s+v<=cap}
  return total-max(possible) if bug==2 else total-2*max(possible)
 if pid==691:
  need=Counter(a[1]);alphabet=sorted(need);start=tuple(need[c] for c in alphabet);q=deque([(start,0)]);seen={start}
  counts=[Counter(s) for s in x]
  if bug==1:counts=[Counter(set(s)) for s in x]
  if bug==2:
   dp={start:0}
   for count in counts:
    updated=dict(dp)
    for state,cost in dp.items():
     nxt=tuple(max(0,n-count[c]) for c,n in zip(alphabet,state));updated[nxt]=min(updated.get(nxt,10**9),cost+1)
    dp=updated
   return dp.get((0,)*len(start),-1)
  while q:
   state,steps=q.popleft()
   if not any(state):return steps
   for count in counts:
    nxt=tuple(max(0,n-count[c]) for c,n in zip(alphabet,state))
    if nxt not in seen:seen.add(nxt);q.append((nxt,steps+1))
  return -1
 if pid==354:
  tails=[]
  for w,h in sorted(x,key=lambda p:(p[0],p[1] if bug==1 else -p[1])):
   j=(bisect_right if bug==2 else bisect_left)(tails,h)
   if j==len(tails):tails.append(h)
   else:tails[j]=h
  return len(tails)
 if pid==2707:
  if bug==1:
   i=cost=0
   while i<len(x):
    choices=[w for w in a[1] if x.startswith(w,i)]
    if choices:i+=len(max(choices,key=len))
    else:i+=1;cost+=1
   return cost
  f=[0]+[len(x)]*len(x)
  for i in range(1,len(x)+1):
   f[i]=f[i-1]+1
   for w in a[1]:
    if i>=len(w) and x[i-len(w):i]==w:f[i]=min(f[i],f[i-len(w)]+(1 if bug==2 else 0))
  return f[-1]
 if pid==312:
  if bug:
   v=x[:];ans=0
   while v:
    scores=[(v[i-1] if i else 1)*v[i]*(v[i+1] if i+1<len(v) else 1) for i in range(len(v))]
    i=max(range(len(v)),key=lambda j:scores[j]) if bug==1 else min(range(len(v)),key=lambda j:v[j]);ans+=scores[i];v.pop(i)
   return ans
  v=[1]+x+[1];n=len(v);f=[[0]*n for _ in v]
  for width in range(2,n):
   for i in range(n-width):
    j=i+width;f[i][j]=max(f[i][k]+f[k][j]+v[i]*v[k]*v[j] for k in range(i+1,j))
  return f[0][-1]
 if pid==150:
  stack=[]
  for token in x:
   if token not in ('+','-','*','/'):stack.append(int(token));continue
   v,u=stack.pop(),stack.pop()
   if token=='+':z=u+v
   elif token=='-':z=v-u if bug==2 else u-v
   elif token=='*':z=u*v
   else:z=u//v if bug==1 else trunc_div(u,v)
   stack.append(z)
  return stack[0]
 if pid==394:
  stack=[];text='';k=0
  for c in x:
   if c.isdigit():k=(0 if bug==1 else k*10)+int(c)
   elif c=='[':stack.append((text,k));text='';k=0
   elif c==']':before,k=stack.pop();text=(text*k+before) if bug==2 else before+text*k;k=0
   else:text+=c
  return text
 if pid==224:
  # Context-sign scan differs from the shunting-yard oracle.
  contexts=[1];sign=1;ans=0;i=0
  while i<len(x):
   c=x[i]
   if c.isdigit():
    j=i
    while j<len(x) and x[j].isdigit():j+=1
    ans+=sign*int(x[i:j]);i=j;continue
   if c in '+-':sign=contexts[-1]*(1 if c=='+' else -1)
   elif c=='(':contexts.append(1 if bug==1 else sign)
   elif c==')':contexts.pop()
   i+=1
  if bug==2:
   # Wrong lexer reads each digit as a separate number while retaining signs.
   contexts=[1];sign=1;ans=0
   for c in x:
    if c.isdigit():ans+=sign*int(c)
    elif c in '+-':sign=contexts[-1]*(1 if c=='+' else -1)
    elif c=='(':contexts.append(sign)
    elif c==')':contexts.pop()
  return ans
 if pid==926 and bug==2:
  # Wrongly requires both the zero prefix and the one suffix to be nonempty.
  total=x.count('0');zero=0;best=len(x)
  for i,c in enumerate(x[:-1],1):zero+=c=='0';best=min(best,i-zero+total-zero)
  return best
 return variant(pid,a,bug)

EDGES.update({1049:[[[2,7,4,1,8,1]],[[31,26,33,21,40]],[[1]],[[1,1]]],691:[[['with','example','science'],'thehat'],[['a'],'aa'],[['aa'],'aa'],[['ab','bc'],'abc'],[['a'],'b']],354:[[[[5,4],[6,4],[6,7],[2,3]]],[[[1,1],[1,2]]],[[[1,1],[2,1]]]],2707:[['leetscode',['leet','code','leetcode']],['abcde',['ab','abc','cde']],['a',['a']]],312:[[[3,1,5,8]],[[1,5]],[[0]],[[2,3,4]]],150:[[['2','1','+','3','*']],[['-7','3','/']],[['5','3','-']]],394:[['3[a2[c]]'],['12[a]'],['ab2[c]'],['2[ab]3[cd]ef']],224:[['(1+(4+5+2)-3)+(6+8)'],['1-(2+3)'],['12+3'],['-(2-3)']]})
PRESSURE.update({1049:[([[100]*30],0),([[100]*29+[99]],1)],691:[([['abcdefghij']*50,'abcdefghijabcde'],2),([['a'*10]*50,'a'*15],2)],354:[([[[i,i] for i in range(1,100001)]],100000),([[[100000,i] for i in range(1,100001)]],1)],2707:[(['a'*50,['a'*i for i in range(1,51)]],0),(['a'*50,['b'*i for i in range(1,51)]],50)],312:[([[100]*300],298010100),([[0]*300],0)],150:[([['1']*5000+['+']*4999],5000)],394:[(['10[100[100[a]]]'],'a'*100000),(['abcdefghijklmnopqrstuvwxyzaaaa'],'abcdefghijklmnopqrstuvwxyzaaaa')],224:[(['1+'*149999+'1'],150000),(['('*149999+'1'+')'*149999],1)]})

_base_random=random_args

def random_args(pid,r):
 if pid==1049:return [[r.randint(1,12) for _ in range(r.randint(1,7))]]
 if pid==691:return [[''.join(r.choice('abc') for _ in range(r.randint(1,5))) for _ in range(r.randint(1,4))],''.join(r.choice('abc') for _ in range(r.randint(1,6)))]
 if pid==354:return [[[r.randint(1,8),r.randint(1,8)] for _ in range(r.randint(1,9))]]
 if pid==2707:return [''.join(r.choice('abc') for _ in range(r.randint(1,9))),sorted({''.join(r.choice('abc') for _ in range(r.randint(1,4))) for _ in range(r.randint(1,7))})]
 if pid==312:return [[r.randint(0,6) for _ in range(r.randint(1,6))]]
 if pid==150:
  def expr(depth):
   if depth==0 or r.random()<.35:
    v=r.randint(-10,10);return [str(v)],v
   l,u=expr(depth-1);right,v=expr(depth-1);op=r.choice('+-*/' if v else '+-*')
   z={'+':lambda:u+v,'-':lambda:u-v,'*':lambda:u*v,'/':lambda:trunc_div(u,v)}[op]();return l+right+[op],z
  return [expr(3)[0]]
 if pid==394:
  def enc(d):
   if d==0 or r.random()<.3:return ''.join(r.choice('abc') for _ in range(r.randint(1,3)))
   return str(r.randint(1,5))+'['+enc(d-1)+']'+r.choice(['','a','bc'])
  return [enc(3)]
 if pid==224:
  def expr(depth):
   if depth==0 or r.random()<.25:return str(r.randint(0,100))
   return '('+('-(' if r.random()<.2 else '(')+expr(depth-1)+r.choice([' + ',' - '])+expr(depth-1)+'))'
  return [expr(3)]
 return _base_random(pid,r)

_base_validate=validate

def validate(pid,a):
 if pid not in (1049,691,354,2707,312,150,394,224):return _base_validate(pid,a)
 assert type(a) is list and len(a)==(2 if pid in (691,2707) else 1);x=a[0]
 def string(s,lo,hi):assert type(s) is str and lo<=len(s)<=hi and re.fullmatch('[a-z]+',s)
 if pid in (1049,312):
  assert type(x) is list and 1<=len(x)<=(30 if pid==1049 else 300)
  for v in x:assert type(v) is int and (1 if pid==1049 else 0)<=v<=100
 if pid==691:
  assert type(x) is list and 1<=len(x)<=50
  for s in x:string(s,1,10)
  string(a[1],1,15)
 if pid==354:
  assert type(x) is list and 1<=len(x)<=100000
  for v in x:assert type(v) is list and len(v)==2 and all(type(t) is int and 1<=t<=100000 for t in v)
 if pid==2707:
  string(x,1,50);assert type(a[1]) is list and 1<=len(a[1])<=50 and len(set(a[1]))==len(a[1])
  for s in a[1]:string(s,1,50)
 if pid==150:
  assert type(x) is list and 1<=len(x)<=10000;stack=[]
  for token in x:
   assert type(token) is str
   if token in ('+','-','*','/'):
    assert len(stack)>=2;v,u=stack.pop(),stack.pop()
    if token=='/':assert v!=0
    z={'+':lambda:u+v,'-':lambda:u-v,'*':lambda:u*v,'/':lambda:trunc_div(u,v)}[token]()
   else:assert re.fullmatch(r'-?\d+',token);z=int(token);assert -200<=z<=200
   assert -2**31<=z<2**31;stack.append(z)
  assert len(stack)==1
 if pid==394:
  assert type(x) is str and 1<=len(x)<=30 and re.fullmatch(r'[a-z0-9\[\]]+',x)
  count=0;stack=[];i=0
  while i<len(x):
   if x[i].isdigit():
    j=i
    while j<len(x) and x[j].isdigit():j+=1
    repeat=int(x[i:j]);assert 1<=repeat<=300 and j<len(x) and x[j]=='[';stack.append((count,repeat));count=0;i=j+1
   elif x[i]==']':
    assert stack;old,k=stack.pop();count=old+k*count;i+=1
   else:assert x[i].isalpha();count+=1;i+=1
   assert count<=100000
  assert not stack and count<=100000
 if pid==224:
  assert type(x) is str and 1<=len(x)<=300000 and re.fullmatch('[0-9()+ -]+',x);arithmetic(x)
 return True

_base_encode=encode
_base_parse=parse_code

def encode(pid,a):
 if pid in (394,224):return a[0]+'\n'
 if pid==150:return str(len(a[0]))+'\n'+' '.join(a[0])+'\n'
 if pid==691:return str(len(a[0]))+'\n'+'\n'.join(a[0])+'\n'+a[1]+'\n'
 if pid==2707:return a[0]+'\n'+str(len(a[1]))+'\n'+'\n'.join(a[1])+'\n'
 if pid==354:return str(len(a[0]))+'\n'+''.join(' '.join(map(str,v))+'\n' for v in a[0])
 return _base_encode(pid,a)

def parse_code(pid):
 if pid in (394,224):return "args=[sys.stdin.readline().rstrip('\\n')]"
 if pid==150:return "n=int(sys.stdin.readline()); args=[sys.stdin.readline().split()]"
 if pid==691:return "n=int(sys.stdin.readline()); args=[[sys.stdin.readline().rstrip('\\n') for _ in range(n)],sys.stdin.readline().rstrip('\\n')]"
 if pid==2707:return "s=sys.stdin.readline().rstrip('\\n'); n=int(sys.stdin.readline()); args=[s,[sys.stdin.readline().rstrip('\\n') for _ in range(n)]]"
 if pid==354:return "it=iter(map(int,sys.stdin.read().split())); n=next(it); args=[[[next(it),next(it)] for _ in range(n)]]"
 return _base_parse(pid)

META={
2369:('validPartition','检查有效分组','Check a Valid Partition','把整个数组分成连续组，每组是两个相等数、三个相等数，或三个依次加一的数。能完全分组输出1，否则0。','Partition the entire array into consecutive groups: two equal values, three equal values, or three values increasing by one. Return 1 if possible, otherwise 0.'),
1049:('lastStoneWeightII','石头碰撞的最小余重','Minimum Remaining Stone Weight','任选两块石头碰撞，等重则都消失，否则留下重量差。重复到最多一块，求最小可能余重。','Repeatedly choose two stones. Equal weights disappear; unequal weights leave their difference. Minimize the final weight when at most one stone remains.'),
879:('profitableSchemes','满足收益的方案数','Profitable Job Subsets','每个任务需要group中的人数并产生profit中的收益，每项最多选一次。总人数不超过n且收益至少minProfit的子集有多少个？结果模1000000007。','Each job consumes its group size and earns its profit; select each job at most once. Count subsets using at most n people and earning at least minProfit, modulo 1000000007.'),
691:('minStickers','拼出目标的最少贴纸','Fewest Stickers for the Target','每种贴纸可无限次使用；每次使用可剪取其中任意字母组成目标串，不要求顺序。求最少贴纸数，不能组成返回-1。','Use unlimited copies of each sticker. Letters may be cut out and rearranged to form the target. Minimize stickers used, returning -1 if impossible.'),
354:('maxEnvelopes','信封嵌套','Nested Envelopes','只有宽和高都严格更小的信封才能放入另一个信封，不允许旋转。求最多嵌套层数。','An envelope fits inside another only when both dimensions are strictly smaller. Rotation is forbidden. Find the longest nesting chain.'),
646:('findLongestChain','数对链长度','Longest Pair Chain','数对[a,b]可接在[c,d]后当且仅当d<a。可重排并选取部分数对，求最长链长度。','A pair [a,b] may follow [c,d] exactly when d<a. Reorder and select pairs to maximize chain length.'),
1048:('longestStrChain','最长单词链','Longest Word Chain','每一步给单词任意位置插入一个字母得到下一单词。所有单词都须在输入中，求最长链包含的单词数。','Each step inserts exactly one letter anywhere in a word to produce the next word. All words must occur in the input. Maximize the number of words in the chain.'),
873:('lenLongestFibSubseq','最长斐波那契子序列','Longest Fibonacci Subsequence','从严格递增数组中保持下标顺序选数，使长度至少三且每项从第三项起等于前两项和。求最长长度，不存在返回0。','Select an order-preserving subsequence of at least three values such that each value from the third equals the previous two summed. Return its maximum length, or 0.'),
1626:('bestTeamScore','无冲突球队得分','Best Conflict-Free Team','选取球员使总分最大。若年轻球员分数严格高于年长球员则冲突；同龄球员间不冲突。','Maximize the total score of a selected team. A younger player scoring strictly more than an older player causes a conflict; equal ages never conflict.'),
1671:('minimumMountainRemovals','删除成山形数组','Minimum Mountain Removals','删除最少元素，使剩余数组先严格上升再严格下降，峰顶两侧都至少一个元素。保证可构造。','Delete as few elements as possible to leave a strictly increasing then strictly decreasing array, with both sides of the peak nonempty. A solution is guaranteed.'),
2707:('minExtraChar','分词剩余字符','Minimum Extra Characters','选取若干互不重叠的连续子串，每段须是字典中的单词，单词可重复用。求未被选中字符的最少个数。','Select nonoverlapping substrings that are dictionary words, allowing words to be reused. Minimize the number of uncovered characters.'),
1039:('minScoreTriangulation','多边形三角剖分','Minimum Triangulation Score','凸多边形顶点按环顺序带权。每个三角形得分为三个顶点权重之积，求无交叉三角剖分的最小总分。','A convex polygon has weighted vertices in cyclic order. A triangle scores the product of its vertex weights. Minimize total score over triangulations.'),
312:('maxCoins','戳气球的最大分数','Maximum Balloon Coins','每次戳一个气球，获得它与当前左右邻居值之积，边界外视为1。所有气球都要戳完，求最大总分。','Burst every balloon in any order. Each burst earns the product of its value and its current neighbors, treating missing boundary neighbors as 1. Maximize total coins.'),
1911:('maxAlternatingSum','最大交替子序列和','Maximum Alternating Sum','保持顺序选取子序列，按所选位置依次加、减、加、减，求最大结果。','Select an order-preserving subsequence and alternately add and subtract its values, starting with addition. Maximize the result.'),
926:('minFlipsMonoIncr','翻转成单调二进制串','Minimum Monotone Flips','每次翻转一个二进制字符，求使字符串成为若干0后接若干1的最少次数。任一段可为空。','Flip individual bits to obtain zero or more zeros followed by zero or more ones. Return the minimum flips.'),
2140:('mostPoints','跳题后的最大得分','Maximum Question Points','按顺序处理问题。可跳过当前题，或答题取得points分并强制跳过后续brainpower道题。求最大总分。','Process questions in order. Skip a question, or earn its points and then skip the next brainpower questions. Maximize total points.'),
1235:('jobScheduling','带收益工作调度','Weighted Job Scheduling','第i项工作占用[startTime[i],endTime[i])并获得profit[i]。选取不重叠工作使总收益最大，端点相接允许。','Job i occupies [startTime[i],endTime[i]) and earns profit[i]. Maximize profit from nonoverlapping jobs; touching endpoints are compatible.'),
2008:('maxTaxiEarnings','出租车最大收益','Maximum Taxi Earnings','沿1到n单向行驶，一次最多一名乘客。订单[start,end,tip]收入为end-start+tip；允许在下客点立即接客。求最大收益。','Travel forward from 1 to n, carrying at most one passenger. A ride [start,end,tip] earns end-start+tip. Drop-off and pick-up may share an endpoint. Maximize earnings.'),
1335:('minDifficulty','分天调度难度','Minimum Daily Job Difficulty','按原顺序把全部任务分到恰好d天，每天至少一个任务。每天难度是当天最大任务难度，求总难度最小值；无解返回-1。','Split all jobs in original order across exactly d nonempty days. Each day costs its maximum job difficulty. Minimize total cost, returning -1 if impossible.'),
403:('canCross','青蛙过河','Frog Crossing','青蛙从位置0出发，第一跳必须长度1；上次跳k则下次可跳正数k-1、k或k+1，且必须落在石头上。能到最后石头输出1，否则0。','Start at position 0 with a required first jump of 1. After a jump k, the next positive jump may be k-1, k, or k+1 and must land on a stone. Return 1 if the final stone is reachable, otherwise 0.'),
1696:('maxResult','有限跳跃最大得分','Maximum Bounded-Jump Score','从下标0到最后一个位置，每次向右跳1至k步，将经过位置的值相加，包括起终点。求最大分数。','Move from index 0 to the final index, jumping 1 through k positions rightward. Sum all visited values, including both endpoints, and maximize the score.'),
375:('getMoneyAmount','猜数的最坏费用','Minimum Worst-Case Guessing Cost','隐藏整数在1至n。猜错数字x需支付x，并获知应猜更大或更小；猜对不收费。求保证找到答案所需的最小最坏总费用。','A hidden integer lies in 1 through n. A wrong guess x costs x and reveals higher or lower; a correct guess costs nothing. Minimize the worst-case total cost required to guarantee success.'),
150:('evalRPN','逆波兰表达式求值','Evaluate Postfix Arithmetic','计算合法后缀表达式，支持加减乘除。除法向零截断，输入保证不除零且所有中间结果在32位有符号范围。','Evaluate a valid postfix expression using addition, subtraction, multiplication and division. Division truncates toward zero; no division by zero occurs and all intermediate results fit signed 32-bit integers.'),
394:('decodeString','嵌套重复解码','Decode Nested Repetition','把k[内容]展开为内容重复k次，方括号可嵌套；普通小写字母直接保留。输出完整解码结果。','Expand k[content] as content repeated k times, allowing nested brackets. Keep ordinary lowercase letters and output the full decoded string.'),
224:('calculate','带括号加减表达式','Evaluate Parenthesized Addition','计算包含非负整数、加减和圆括号的合法表达式。支持一元负号，不支持一元正号；空格不改变表达式。','Evaluate a valid expression of nonnegative integers, addition, subtraction and parentheses. Unary minus is supported, unary plus is not; spaces do not change the expression.')}
INPUT={
2369:('第一行n，第二行n个整数；2≤n≤100000，值1–1000000。','First line n, second line n integers; 2≤n≤100000, values 1–1000000.'),
1049:('第一行n，第二行n个重量；1≤n≤30，重量1–100。','First line n, second line n weights; 1≤n≤30, weights 1–100.'),
879:('第一行n minProfit m，第二行m个人数，第三行m个收益；1≤n,m≤100，0≤minProfit≤100，人数1–100，收益0–100。','First line n minProfit m; next lines contain m group sizes and m profits. 1≤n,m≤100, 0≤minProfit≤100, sizes 1–100, profits 0–100.'),
691:('第一行贴纸数n，接着n行贴纸，最后一行target；1≤n≤50，贴纸长度1–10，target长度1–15，均为小写英文字母。','First line sticker count n, followed by n sticker lines and one target line. 1≤n≤50; sticker lengths 1–10, target length 1–15; lowercase English letters only.'),
354:('第一行n，接着n行宽和高；1≤n≤100000，宽高均1–100000。','First line n, followed by n width-height pairs; 1≤n≤100000, dimensions 1–100000.'),
646:('第一行n，接着n行left right；1≤n≤1000，-1000≤left<right≤1000。','First line n, followed by n left-right pairs; 1≤n≤1000, -1000≤left<right≤1000.'),
1048:('第一行n，接着n行单词；1≤n≤1000，词长1–16，均为小写英文字母，可有重复词。','First line n, followed by n words; 1≤n≤1000, lengths 1–16, lowercase English letters; duplicate words are allowed.'),
873:('第一行n，第二行n个严格递增整数；3≤n≤1000，值1–1000000000。','First line n, second line n strictly increasing integers; 3≤n≤1000, values 1–1000000000.'),
1626:('第一行n，第二行n个scores，第三行n个ages；1≤n≤1000，分数1–1000000，年龄1–1000。','First line n, second line n scores, third line n ages; 1≤n≤1000, scores 1–1000000, ages 1–1000.'),
1671:('第一行n，第二行n个整数；3≤n≤1000，值1–1000000000，保证删除部分元素后能构造合法山形数组。','First line n, second line n integers; 3≤n≤1000, values 1–1000000000; a valid mountain subsequence is guaranteed.'),
2707:('第一行s，第二行字典大小m，接着m行不同单词；s长度1–50，1≤m≤50，单词长度1–50，均为小写英文字母。','First line s, second line dictionary size m, then m distinct words. s length 1–50, 1≤m≤50, word lengths 1–50; lowercase English letters only.'),
1039:('第一行n，第二行环序排列的n个顶点权重；3≤n≤50，权重1–100。','First line n, second line n vertex weights in cyclic order; 3≤n≤50, weights 1–100.'),
312:('第一行n，第二行n个气球值；1≤n≤300，值0–100。','First line n, second line n balloon values; 1≤n≤300, values 0–100.'),
1911:('第一行n，第二行n个整数；1≤n≤100000，值1–100000。','First line n, second line n integers; 1≤n≤100000, values 1–100000.'),
926:('一行二进制字符串，长度1–100000。','One binary string of length 1–100000.'),
2140:('第一行n，接着n行points brainpower；1≤n≤100000，两项值均1–100000。','First line n, followed by n points-brainpower pairs; 1≤n≤100000, both values 1–100000.'),
1235:('第一行n，接着三行依次为n个startTime、endTime、profit；1≤n≤50000，1≤startTime[i]<endTime[i]≤1000000000，收益1–10000。','First line n, then three lines of n start times, end times and profits. 1≤n≤50000, 1≤startTime[i]<endTime[i]≤1000000000, profits 1–10000.'),
2008:('第一行n m，接着m行start end tip；1≤n≤100000，1≤m≤30000，1≤start<end≤n，1≤tip≤100000。','First line n m, then m start-end-tip triples; 1≤n≤100000, 1≤m≤30000, 1≤start<end≤n, 1≤tip≤100000.'),
1335:('第一行n，第二行n个任务难度，第三行d；1≤n≤300，难度0–1000，1≤d≤10。','First line n, second line n difficulties, third line d; 1≤n≤300, difficulties 0–1000, 1≤d≤10.'),
403:('第一行n，第二行n个严格递增石头坐标；2≤n≤2000，第一个为0，坐标0–2147483647。','First line n, second line n strictly increasing stone positions; 2≤n≤2000, first position 0, positions 0–2147483647.'),
1696:('第一行n，第二行n个值，第三行k；1≤n,k≤100000，元素在[-10000,10000]。','First line n, second line n values, third line k; 1≤n,k≤100000, values in [-10000,10000].'),
375:('一行n，1≤n≤200。','One integer n, 1≤n≤200.'),
150:('第一行token数n，第二行n个空格分隔token；1≤n≤10000，token为+、-、*、/或[-200,200]的整数。保证合法、不除零，所有运算中间值和最终值均为32位有符号整数。','First line token count n, second line n space-separated tokens. 1≤n≤10000; tokens are +, -, *, / or integers in [-200,200]. The expression is valid, never divides by zero, and every intermediate and final value fits signed 32-bit integers.'),
394:('一行合法编码，长度1–30，由小写字母、数字和方括号组成，重复次数1–300。数字只用于重复次数；解码长度不超过100000。','One valid encoding of length 1–30, using lowercase letters, digits and brackets; repeat counts 1–300. Digits occur only as repeat counts; decoded length is at most 100000.'),
224:('一行表达式，长度1–300000，含数字、+、-、圆括号和空格。保证合法，无一元+、无连续运算符，数字与所有中间值均在32位有符号整数范围。','One expression of length 1–300000, containing digits, +, -, parentheses and spaces. It is valid, has no unary + or consecutive operators, and every literal and intermediate value fits signed 32-bit integers.')}
MISTAKES={
2369:('不允许三个相等值成组','漏掉连续递增三元组'),1049:('总是碰撞最大两块','将两组差误写为较大组重量'),879:('要求恰好用满人数','遗漏合法空子集'),691:('忽略贴纸内重复字母','把每种贴纸误认为只能用一次'),354:('同宽信封按高度升序','把相等高度当作递增'),646:('错误允许端点相等','按起点而非终点贪心'),1048:('按输入顺序处理依赖','只允许尾部插入字母'),873:('不存在时仍返回二','漏计序列最后一项'),1626:('错误禁止相等分数','错误禁止同龄队员共存'),1671:('允许非严格山形','允许峰顶缺少一侧'),2707:('当前位置贪心取最长单词','把字典段也计作多余字符'),1039:('固定首顶点扇形剖分','固定末顶点扇形剖分'),312:('贪心戳当前收益最大气球','贪心戳当前最小值气球'),1911:('强制选取整个数组','只选择单个最大值'),926:('只考虑翻为同一字符','强制零段与一段都非空'),2140:('跳过数量少算一题','忽略跳题限制'),1235:('错误禁止端点相接','只选择收益最大的单项工作'),2008:('错误禁止上下客同一点','收入遗漏行驶距离'),1335:('任务不足天数仍返回零','取最大的d项作为每天难度'),403:('遗漏减小一步的跳法','首跳错误允许二而非一'),1696:('强制访问所有位置','忽略跳跃距离限制'),375:('固定猜区间中点','最坏情况误用较小分支'),150:('负数除法向下取整','减法操作数顺序颠倒'),394:('多位重复次数只取末位','重复块错误放在原前缀之前'),224:('进入括号丢失外层负号','把多位数字拆成各位相加')}
EDGES[1671].append([[1,2,3,4,1,5,6,7,8]])
EDGES[403].append([[0,1,3,6,8]])
PRESSURE[224][0]=(['1+'*149999+'1 '],150000)
MUTANT_PREFIX='import sys\nfrom collections import Counter,deque\nfrom bisect import bisect_left,bisect_right\nMOD=1000000007\n'+inspect.getsource(trunc_div)+'\n'+inspect.getsource(variant)+'\n'+inspect.getsource(extra_variant)+'\n'
EDGES={pid:EDGES[pid] for pid in IDS}
PRESSURE={pid:PRESSURE[pid] for pid in IDS}
PROBLEMS={}
for pid in IDS:
 method,zh,en,dzh,den=META[pid];izh,ien=INPUT[pid]
 kind='string' if pid==394 else 'integer'
 PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dzh,descriptionEn=den,inputZh=izh,inputEn=ien,outputZh='输出解码字符串并换行。' if pid==394 else '输出一个整数并换行。',outputEn='Print the decoded string followed by a newline.' if pid==394 else 'Print one integer followed by a newline.',difficulty='困难' if pid in (879,691,354,1671,1039,312,1235,1335,403,224) else '中等',edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r,p=pid:random_args(p,r),oracle=lambda a,p=pid:oracle(p,a),encode=lambda a,p=pid:encode(p,a),parse=parse_code(pid),validate=lambda a,p=pid:validate(p,a),resultKind=kind,outputLimit=128 if pid==394 else 64,mutants=[dict(name=name,source=MUTANT_PREFIX+parse_code(pid)+f'\nprint(extra_variant({pid},args,{bug}))\n') for bug,name in enumerate(MISTAKES[pid],1)])
