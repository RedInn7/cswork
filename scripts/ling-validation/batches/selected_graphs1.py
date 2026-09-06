"""Authored graph/grid fixtures; independent small exhaustive/closure oracles."""
import itertools
import math
import inspect
from collections import deque,Counter

IDS=[329,934,490,505,1293,323,261,684,1319,785,886,2101,1466,2359,802,1136,127,433,752,773,909,815,743,787,1631,778,847,1584,1168,310]
MATRIX={329,934,490,505,1293,773,909,1631,778}
N_EDGES={323,261,1319,886,1466,1136,310}
ADJ={785,802,847}
INF=10**30

def neighbors(r,c,m,n):
 return [(u,v) for u,v in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)) if 0<=u<m and 0<=v<n]

def distances(n,edges,directed=False):
 d=[[INF]*n for _ in range(n)]
 for i in range(n):d[i][i]=0
 for a,b,w in edges:
  d[a][b]=min(d[a][b],w)
  if not directed:d[b][a]=min(d[b][a],w)
 for k in range(n):
  for i in range(n):
   for j in range(n):d[i][j]=min(d[i][j],d[i][k]+d[k][j])
 return d

def components(n,edges):
 links=[[] for _ in range(n)]
 for u,v in edges:links[u].append(v);links[v].append(u)
 seen=set();count=0
 for u in range(n):
  if u in seen:continue
  count+=1;seen.add(u);q=[u]
  while q:
   v=q.pop()
   for w in links[v]:
    if w not in seen:seen.add(w);q.append(w)
 return count

def islands(grid):
 m,n=len(grid),len(grid[0]);unseen={(i,j) for i in range(m) for j in range(n) if grid[i][j]};groups=[]
 while unseen:
  first=unseen.pop();group={first};q=[first]
  while q:
   i,j=q.pop()
   for nxt in neighbors(i,j,m,n):
    if nxt in unseen:unseen.remove(nxt);group.add(nxt);q.append(nxt)
  groups.append(group)
 return groups

def mst_brute(n,edges):
 answer=INF
 for selected in itertools.combinations(edges,n-1):
  if components(n,[(u,v) for u,v,_ in selected])==1:answer=min(answer,sum(w for _,_,w in selected))
 return answer

def oracle(pid,a):
 x=a[0]
 if pid==329:
  m,n=len(x),len(x[0])
  def visit(i,j):return 1+max((visit(u,v) for u,v in neighbors(i,j,m,n) if x[u][v]>x[i][j]),default=0)
  return max(visit(i,j) for i in range(m) for j in range(n))
 if pid==934:
  first,second=islands(x);return min(abs(i-u)+abs(j-v)-1 for i,j in first for u,v in second)
 if pid in (490,505):
  grid,start,end=a;m,n=len(grid),len(grid[0]);cells=[(i,j) for i in range(m) for j in range(n) if not grid[i][j]];index={p:i for i,p in enumerate(cells)};edges=[]
  for i,j in cells:
   for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
    u,v=i,j;steps=0
    while (u+di,v+dj) in index:u+=di;v+=dj;steps+=1
    if steps:edges.append((index[i,j],index[u,v],steps))
  value=distances(len(cells),edges,True)[index[tuple(start)]][index[tuple(end)]]
  return int(value<INF) if pid==490 else value if value<INF else -1
 if pid==1293:
  grid,k=a;m,n=len(grid),len(grid[0]);blocked=[(i,j) for i in range(m) for j in range(n) if grid[i][j]];answer=INF
  for size in range(min(k,len(blocked))+1):
   for removed in itertools.combinations(blocked,size):
    walls=set(blocked)-set(removed);q=deque([((0,0),0)]);seen={(0,0)}
    while q:
     (i,j),d=q.popleft()
     if (i,j)==(m-1,n-1):answer=min(answer,d);break
     for p in neighbors(i,j,m,n):
      if p not in walls and p not in seen:seen.add(p);q.append((p,d+1))
  return answer if answer<INF else -1
 if pid in (323,261,1319):
  n,edges=a;d=distances(n,[(u,v,1) for u,v in edges]);count=sum(all(d[i][j]==INF for j in range(i)) for i in range(n))
  return count if pid==323 else int(count==1 and len(edges)==n-1) if pid==261 else count-1 if len(edges)>=n-1 else -1
 if pid==684:
  edges=x;n=len(edges)
  for i in range(n-1,-1,-1):
   remaining=[(u-1,v-1) for j,(u,v) in enumerate(edges) if i!=j]
   if components(n,remaining)==1:return edges[i][:]
 if pid in (785,886):
  n=len(x) if pid==785 else x
  edges=[(u,v) for u,row in enumerate(x) for v in row] if pid==785 else [(u-1,v-1) for u,v in a[1]]
  return int(any(all((mask>>u&1)!=(mask>>v&1) for u,v in edges) for mask in range(1<<n)))
 if pid==2101:
  edges=[(i,j,1) for i,(u,v,r) in enumerate(x) for j,(s,t,_) in enumerate(x) if (u-s)**2+(v-t)**2<=r*r];d=distances(len(x),edges,True)
  return max(sum(v<INF for v in row) for row in d)
 if pid==1466:
  n,edges=a;answer=0
  for index,(u,v) in enumerate(edges):
   remaining=[(s,t,1) for j,(s,t) in enumerate(edges) if j!=index]
   answer+=distances(n,remaining)[0][u]<INF
  return answer
 if pid==2359:
  edges,node1,node2=a;d=distances(len(edges),[(i,v,1) for i,v in enumerate(edges) if v>=0],True)
  choices=[(max(d[node1][v],d[node2][v]),v) for v in range(len(edges)) if d[node1][v]<INF and d[node2][v]<INF]
  return min(choices)[1] if choices else -1
 if pid==802:
  n=len(x);reach=[[j in x[i] for j in range(n)] for i in range(n)]
  for k in range(n):
   for i in range(n):
    for j in range(n):reach[i][j]=reach[i][j] or (reach[i][k] and reach[k][j])
  return [i for i in range(n) if not any(reach[j][j] and (i==j or reach[i][j]) for j in range(n))]
 if pid==1136:
  n,edges=a;requirements=[0]*n
  for u,v in edges:requirements[v-1]|=1<<(u-1)
  q=deque([(0,0)]);seen={0}
  while q:
   done,steps=q.popleft()
   if done==(1<<n)-1:return steps
   available=sum(1<<i for i in range(n) if not done>>i&1 and requirements[i]&done==requirements[i]);subset=available
   while subset:
    nxt=done|subset
    if nxt not in seen:seen.add(nxt);q.append((nxt,steps+1))
    subset=(subset-1)&available
  return -1
 if pid in (127,433):
  start,end,bank=a
  if start==end:return 0 if pid==433 else 1
  if end not in bank:return -1 if pid==433 else 0
  words=list(dict.fromkeys([start]+bank));edges=[(i,j,1) for i,u in enumerate(words) for j,v in enumerate(words) if sum(c!=d for c,d in zip(u,v))==1];d=distances(len(words),edges)
  value=d[words.index(start)][words.index(end)]
  return value+(pid==127) if value<INF else -1 if pid==433 else 0
 if pid==752:
  dead={int(v) for v in x};target=int(a[1])
  if 0 in dead:return -1
  q=deque([(0,0)]);seen={0}
  while q:
   value,steps=q.popleft()
   if value==target:return steps
   for place in (1,10,100,1000):
    digit=value//place%10
    for new_digit in ((digit+1)%10,(digit-1)%10):
     nxt=value+(new_digit-digit)*place
     if nxt not in dead and nxt not in seen:seen.add(nxt);q.append((nxt,steps+1))
  return -1
 if pid==773:
  start=tuple(v for row in x for v in row);q=deque([(start,0)]);seen={start}
  while q:
   state,steps=q.popleft()
   if state==(1,2,3,4,5,0):return steps
   zero=state.index(0)
   for j in range(6):
    if abs(zero//3-j//3)+abs(zero%3-j%3)==1:
     nxt=list(state);nxt[zero],nxt[j]=nxt[j],nxt[zero];nxt=tuple(nxt)
     if nxt not in seen:seen.add(nxt);q.append((nxt,steps+1))
  return -1
 if pid==909:
  n=len(x);dest=[]
  for i,row in enumerate(x[::-1]):dest.extend(row if i%2==0 else row[::-1])
  edges=[]
  for i in range(n*n):
   for j in range(i+1,min(i+7,n*n)):
    edges.append((i,j if dest[j]<0 else dest[j]-1,1))
  value=distances(n*n,edges,True)[0][-1];return value if value<INF else -1
 if pid==815:
  routes,source,target=a
  if source==target:return 0
  sets=list(map(set,routes));edges=[(i,j,1) for i,u in enumerate(sets) for j,v in enumerate(sets) if u&v];d=distances(len(routes),edges)
  best=min((d[i][j]+1 for i,u in enumerate(sets) for j,v in enumerate(sets) if source in u and target in v),default=INF)
  return best if best<INF else -1
 if pid==743:
  times,n,k=a;d=distances(n,[(u-1,v-1,w) for u,v,w in times],True);answer=max(d[k-1]);return answer if answer<INF else -1
 if pid==787:
  n,flights,source,target,k=a;links=[[] for _ in range(n)]
  for u,v,w in flights:links[u].append((v,w))
  def visit(u,remaining):
   if u==target:return 0
   if not remaining:return INF
   return min((w+visit(v,remaining-1) for v,w in links[u]),default=INF)
  answer=visit(source,k+1);return answer if answer<INF else -1
 if pid in (1631,778):
  m,n=len(x),len(x[0]);thresholds=sorted({0}|({abs(x[i][j]-x[u][v]) for i in range(m) for j in range(n) for u,v in neighbors(i,j,m,n)} if pid==1631 else {v for row in x for v in row}))
  for threshold in thresholds:
   if pid==778 and x[0][0]>threshold:continue
   seen={(0,0)};q=[(0,0)]
   while q:
    i,j=q.pop()
    for u,v in neighbors(i,j,m,n):
     allowed=abs(x[i][j]-x[u][v])<=threshold if pid==1631 else x[u][v]<=threshold
     if allowed and (u,v) not in seen:seen.add((u,v));q.append((u,v))
   if (m-1,n-1) in seen:return threshold
 if pid==847:
  n=len(x);d=distances(n,[(i,j,1) for i,row in enumerate(x) for j in row]);return min(sum(d[u][v] for u,v in zip(order,order[1:])) for order in itertools.permutations(range(n)))
 if pid==1584:return mst_brute(len(x),[(i,j,abs(u-v)+abs(s-t)) for i,(u,s) in enumerate(x) for j,(v,t) in enumerate(x) if i<j])
 if pid==1168:
  n,wells,pipes=a;return mst_brute(n+1,[(0,i+1,w) for i,w in enumerate(wells)]+[tuple(p) for p in pipes])
 if pid==310:
  n,edges=a;d=distances(n,[(u,v,1) for u,v in edges]);height=[max(row) for row in d];return [i for i,v in enumerate(height) if v==min(height)]
 raise AssertionError(pid)

def encode(pid,a):
 if pid in MATRIX:
  g=a[0];out=[f'{len(g)} {len(g[0])}']+[' '.join(map(str,row)) for row in g]
  for extra in a[1:]:out.append(' '.join(map(str,extra)) if isinstance(extra,list) else str(extra))
 elif pid in N_EDGES:out=[f'{a[0]} {len(a[1])}']+[' '.join(map(str,e)) for e in a[1]]
 elif pid in ADJ:out=[str(len(a[0]))]+[' '.join(map(str,[len(row)]+row)) for row in a[0]]
 elif pid in (684,2101,1584):out=[str(len(a[0]))]+[' '.join(map(str,row)) for row in a[0]]
 elif pid==2359:out=[f'{len(a[0])} {a[1]} {a[2]}',' '.join(map(str,a[0]))]
 elif pid in (127,433):out=[a[0],a[1],str(len(a[2]))]+a[2]
 elif pid==752:out=[str(len(a[0]))]+a[0]+[a[1]]
 elif pid==815:out=[f'{len(a[0])} {a[1]} {a[2]}']+[' '.join(map(str,[len(row)]+row)) for row in a[0]]
 elif pid==743:out=[f'{len(a[0])} {a[1]} {a[2]}']+[' '.join(map(str,e)) for e in a[0]]
 elif pid==787:out=[f'{a[0]} {len(a[1])} {a[2]} {a[3]} {a[4]}']+[' '.join(map(str,e)) for e in a[1]]
 elif pid==1168:out=[f'{a[0]} {len(a[2])}',' '.join(map(str,a[1]))]+[' '.join(map(str,e)) for e in a[2]]
 return '\n'.join(out)+'\n'

def parse(pid):
 if pid in (127,433):return 's=sys.stdin.read().splitlines();args=[s[0],s[1],s[3:]]'
 if pid==752:return 's=sys.stdin.read().splitlines();n=int(s[0]);args=[s[1:n+1],s[n+1]]'
 prefix='v=list(map(int,sys.stdin.read().split()));it=iter(v)\n'
 if pid in MATRIX:
  suffix='args.extend([[next(it),next(it)],[next(it),next(it)]])' if pid in (490,505) else 'args.append(next(it))' if pid==1293 else ''
  return prefix+'m=next(it);n=next(it);args=[[[next(it) for _ in range(n)] for _ in range(m)]]\n'+suffix
 if pid in N_EDGES:return prefix+'n=next(it);m=next(it);args=[n,[[next(it),next(it)] for _ in range(m)]]'
 if pid in ADJ:return prefix+'n=next(it);args=[[[next(it) for _ in range(next(it))] for _ in range(n)]]'
 if pid in (684,2101,1584):return prefix+f'n=next(it);args=[[[next(it) for _ in range({3 if pid==2101 else 2})] for _ in range(n)]]'
 if pid==2359:return prefix+'n=next(it);u=next(it);w=next(it);args=[[next(it) for _ in range(n)],u,w]'
 if pid==815:return prefix+'n=next(it);s=next(it);t=next(it);args=[[[next(it) for _ in range(next(it))] for _ in range(n)],s,t]'
 if pid==743:return prefix+'m=next(it);n=next(it);k=next(it);args=[[[next(it) for _ in range(3)] for _ in range(m)],n,k]'
 if pid==787:return prefix+'n=next(it);m=next(it);s=next(it);t=next(it);k=next(it);args=[n,[[next(it) for _ in range(3)] for _ in range(m)],s,t,k]'
 if pid==1168:return prefix+'n=next(it);m=next(it);args=[n,[next(it) for _ in range(n)],[[next(it) for _ in range(3)] for _ in range(m)]]'

def validate(pid,a):
 def integer(v,lo,hi):assert type(v)is int and lo<=v<=hi
 def ints(values,lo,hi,width=None):
  assert type(values)is list and (width is None or len(values)==width)
  for v in values:integer(v,lo,hi)
 def pairs(edges,n,base=0,maximum=100000,minimum=0,ordered=False,directed=False):
  assert type(edges)is list and minimum<=len(edges)<=maximum
  seen=set()
  for e in edges:
   ints(e,base,n-1+base,2);u,v=e;assert u!=v
   if ordered:assert u<v
   key=tuple(e) if directed else tuple(sorted(e));assert key not in seen;seen.add(key)
 if pid in MATRIX:
  assert len(a)==(3 if pid in (490,505) else 2 if pid==1293 else 1)
  grid=a[0];assert type(grid)is list and grid and type(grid[0])is list and grid[0];m,n=len(grid),len(grid[0]);maximum={329:200,934:100,490:100,505:100,1293:40,773:3,909:20,1631:100,778:50}[pid]
  assert m<=maximum and n<=maximum
  lo,hi=(0,2**31-1) if pid==329 else (-1,n*n) if pid==909 else (1,10**6) if pid==1631 else (0,n*n-1) if pid==778 else (0,5) if pid==773 else (0,1)
  for row in grid:ints(row,lo,hi,n)
  if pid in (934,909,778):assert m==n and n>=(2 if pid in (934,909) else 1)
  if pid==934:assert len(islands(grid))==2
  if pid in (490,505):
   for point in a[1:]:ints(point,0,max(m,n)-1,2);assert point[0]<m and point[1]<n and grid[point[0]][point[1]]==0
   assert a[1]!=a[2]
  if pid==1293:integer(a[1],1,m*n);assert grid[0][0]==grid[-1][-1]==0
  if pid==773:assert m==2 and n==3 and sorted(v for row in grid for v in row)==list(range(6))
  if pid==909:assert grid[-1][0]==-1 and grid[0][0 if n%2==0 else -1]==-1 and all(v!=0 for row in grid for v in row)
  if pid==778:assert sorted(v for row in grid for v in row)==list(range(n*n))
  return
 if pid in N_EDGES:
  assert len(a)==2;n,edges=a;maximum={323:2000,261:2000,1319:100000,886:2000,1466:50000,1136:5000,310:20000}[pid];integer(n,2 if pid==1466 else 1,maximum)
  pairs(edges,n,base=1 if pid in (886,1136) else 0,maximum={323:5000,261:5000,1319:100000,886:10000,1466:n-1,1136:5000,310:n-1}[pid],minimum=1 if pid in (323,1319,1136) else 0,ordered=pid in (323,886),directed=pid==1136)
  if pid in (1466,310):assert len(edges)==n-1 and components(n,edges)==1
  return
 if pid in ADJ:
  assert len(a)==1;g=a[0];integer(len(g),1,{785:100,802:10000,847:12}[pid])
  for i,row in enumerate(g):
   ints(row,0,len(g)-1);assert len(row)==len(set(row))
   if pid==802:assert row==sorted(row)
   else:assert i not in row and all(i in g[j] for j in row)
  if pid==802:assert 1<=sum(map(len,g))<=40000
  if pid==847:assert components(len(g),[(i,j) for i,row in enumerate(g) for j in row])==1
  return
 if pid==684:
  assert len(a)==1;n=len(a[0]);integer(n,3,1000);pairs(a[0],n,base=1,maximum=n,minimum=n,ordered=True);assert components(n,[(u-1,v-1) for u,v in a[0]])==1;return
 if pid in (2101,1584):
  assert len(a)==1;rows=a[0];integer(len(rows),1,100 if pid==2101 else 1000)
  for row in rows:ints(row,1 if pid==2101 else -10**6,100000 if pid==2101 else 10**6,3 if pid==2101 else 2)
  if pid==1584:assert len(set(map(tuple,rows)))==len(rows)
  return
 if pid==2359:
  assert len(a)==3;n=len(a[0]);integer(n,2,100000);ints(a[0],-1,n-1);assert all(v!=i for i,v in enumerate(a[0]));integer(a[1],0,n-1);integer(a[2],0,n-1);return
 if pid in (127,433,752):
  assert len(a)==(2 if pid==752 else 3)
  if pid==752:bank,target=a;integer(len(bank),1,500);words=bank+[target];length=4;alphabet='0123456789';assert target not in bank
  else:
   start,end,bank=a;integer(len(bank),1 if pid==127 else 0,5000 if pid==127 else 10);words=[start,end]+bank;length=len(start);alphabet='abcdefghijklmnopqrstuvwxyz' if pid==127 else 'ACGT'
   if pid==127:integer(length,1,10);assert start!=end and len(bank)==len(set(bank))
   else:assert length==8
  assert all(type(w)is str and len(w)==length and set(w)<=set(alphabet) for w in words);return
 if pid==815:
  assert len(a)==3;routes,s,t=a;integer(len(routes),1,500);assert sum(map(len,routes))<=100000
  for route in routes:assert 1<=len(route)<=100000 and len(set(route))==len(route);ints(route,0,999999)
  integer(s,0,999999);integer(t,0,999999);return
 if pid in (743,787):
  assert len(a)==(3 if pid==743 else 5)
  edges,n,k=a if pid==743 else (a[1],a[0],a[4]);integer(n,1 if pid==743 else 2,100);assert (1 if pid==743 else 0)<=len(edges)<=(6000 if pid==743 else n*(n-1)//2)
  base=1 if pid==743 else 0;seen=set()
  for e in edges:
   assert len(e)==3;u,v,w=e;integer(u,base,n-1+base);integer(v,base,n-1+base);integer(w,0 if pid==743 else 1,100 if pid==743 else 10000);assert u!=v and (u,v) not in seen;seen.add((u,v))
  integer(k,base,n-1+base)
  if pid==787:integer(a[2],0,n-1);integer(a[3],0,n-1);assert a[2]!=a[3]
  return
 if pid==1168:
  assert len(a)==3;n,wells,pipes=a;integer(n,2,10000);ints(wells,0,100000,n);assert 1<=len(pipes)<=10000
  for e in pipes:assert len(e)==3;integer(e[0],1,n);integer(e[1],1,n);integer(e[2],0,100000);assert e[0]!=e[1]
  return
 raise AssertionError(pid)

def adjacency(n,edges):
 g=[[] for _ in range(n)]
 for u,v in edges:g[u].append(v);g[v].append(u)
 return [sorted(row) for row in g]

def random_args(pid,r):
 if pid in MATRIX:
  if pid==773:
   values=r.sample(range(6),6);return [[values[:3],values[3:]]]
  n=r.randint(2 if pid in (934,909,490,505) else 1,3);m=n if pid in (934,909,778) else r.randint(1,3)
  if pid in (490,505) and m*n<2:m=2
  if pid==778:
   values=r.sample(range(n*n),n*n);return [[values[i*n:(i+1)*n] for i in range(n)]]
  grid=[[r.randint(1,10) if pid==1631 else r.randint(0,9) if pid==329 else r.randrange(2) for _ in range(n)] for _ in range(m)]
  if pid==934:
   while len(islands(grid))!=2:grid=[[r.randrange(2) for _ in range(n)] for _ in range(n)]
  if pid in (490,505):
   s,t=r.sample([(i,j) for i in range(m) for j in range(n)],2)
   for i,j in (s,t):grid[i][j]=0
   return [grid,list(s),list(t)]
  if pid==1293:grid[0][0]=grid[-1][-1]=0;return [grid,r.randint(1,m*n)]
  if pid==909:
   grid=[[-1 if r.randrange(3) else r.randint(1,n*n) for _ in range(n)] for _ in range(n)];grid[-1][0]=-1;grid[0][0 if n%2==0 else -1]=-1
  return [grid]
 if pid in N_EDGES|ADJ|{684}:
  n=r.randint(3 if pid==684 else 2 if pid in (323,1319,1136,1466,802) else 1,6)
  tree=[[r.randrange(i),i] for i in range(1,n)]
  if pid in (310,1466,847):edges=tree
  elif pid==684:
   choices=[list(e) for e in itertools.combinations(range(n),2) if list(e) not in tree];edges=tree+[r.choice(choices)];r.shuffle(edges)
  else:
   choices=list(itertools.permutations(range(n),2)) if pid in (1136,802) else list(itertools.combinations(range(n),2));minimum=1 if pid in (323,1319,1136,802) else 0;edges=[list(e) for e in r.sample(choices,r.randint(minimum,len(choices)))]
  if pid==1466:edges=[e if r.randrange(2) else e[::-1] for e in edges]
  if pid in (886,1136,684):edges=[[u+1,v+1] for u,v in edges]
  if pid==684:return [edges]
  if pid in ADJ:
   if pid==802:
    g=[[] for _ in range(n)]
    for u,v in edges:g[u].append(v)
    return [[sorted(row) for row in g]]
   return [adjacency(n,edges)]
  return [n,edges]
 if pid==2101:return [[[r.randint(1,12),r.randint(1,12),r.randint(1,10)] for _ in range(r.randint(1,5))]]
 if pid==2359:
  n=r.randint(2,7);return [[r.choice([-1]+[j for j in range(n) if j!=i]) for i in range(n)],r.randrange(n),r.randrange(n)]
 if pid==127:
  words=[''.join(w) for w in itertools.product('ab',repeat=3)];start,end=r.sample(words,2);return [start,end,r.sample(words,r.randint(1,8))]
 if pid==433:
  words=['AAAAA'+''.join(w) for w in itertools.product('AC',repeat=3)];return [r.choice(words),r.choice(words),r.sample(words,r.randint(0,8))]
 if pid==752:
  target=f'{r.randrange(10000):04d}';dead=r.sample([f'{i:04d}' for i in range(10000) if f'{i:04d}'!=target],r.randint(1,5));return [dead,target]
 if pid==815:
  routes=[r.sample(range(10),r.randint(1,5)) for _ in range(r.randint(1,5))];return [routes,r.randrange(10),r.randrange(10)]
 if pid in (743,787):
  n=r.randint(2,5);pairs=list(itertools.permutations(range(n),2));edges=[[u+(pid==743),v+(pid==743),r.randint(0 if pid==743 else 1,10)] for u,v in r.sample(pairs,r.randint(1 if pid==743 else 0,min(len(pairs),n*(n-1)//2)))];s,t=r.sample(range(n),2)
  return [edges,n,s+1] if pid==743 else [n,edges,s,t,r.randrange(n)]
 if pid==1584:return [r.sample([[i,j] for i in range(-3,4) for j in range(-3,4)],r.randint(1,5))]
 if pid==1168:
  n=r.randint(2,4);pipes=[[u,v,r.randint(0,10)] for u,v in r.choices(list(itertools.combinations(range(1,n+1),2)),k=r.randint(1,5))];return [n,[r.randint(0,10) for _ in range(n)],pipes]
 raise AssertionError(pid)

EDGE={329:[[[[9,9,4],[6,6,8],[2,1,1]]],[[[1]]],[[[1,2],[4,3]]]],934:[[[[0,1],[1,0]]],[[[1,0,0],[0,0,0],[0,0,1]]]],490:[[[[0,0,0],[0,0,0],[0,0,0]],[0,0],[1,1]],[[[0,0],[0,0]],[0,0],[1,1]]],505:[[[[0,0,0],[0,0,0],[0,0,0]],[0,0],[1,1]],[[[0,0],[0,0]],[0,0],[1,1]]],1293:[[[[0,1,0],[1,1,0],[0,0,0]],1],[[[0]],1]],323:[[5,[[0,1],[1,2],[3,4]]],[3,[[0,1]]]],261:[[5,[[0,1],[0,2],[0,3],[1,4]]],[3,[[0,1],[1,2],[2,0]]],[1,[]]],684:[[[1,2],[1,3],[2,3]]],1319:[[4,[[0,1],[0,2],[1,2]]],[4,[[0,1]]]],785:[[[1,3],[0,2],[1,3],[0,2]]],886:[[4,[[1,2],[1,3],[2,4]]],[3,[[1,2],[1,3],[2,3]]]],2101:[[[[2,1,3],[6,1,4]]],[[[1,1,1],[10,10,1]]]],1466:[[6,[[0,1],[1,3],[2,3],[4,0],[4,5]]],[2,[[1,0]]]],2359:[[[2,2,3,-1],0,1],[[-1,-1],0,1]],802:[[[[1,2],[2,3],[5],[0],[5],[],[]]]],1136:[[3,[[1,3],[2,3]]],[3,[[1,2],[2,3],[3,1]]]],127:[['hit','cog',['hot','dot','dog','lot','log','cog']],['hit','cog',['hot']]],433:[['AACCGGTT','AACCGGTA',['AACCGGTA']],['AAAAAAAA','AAAAAAAA',[]]],752:[[['0201','0101','0102','1212','2002'],'0202'],[['0000'],'8888'],[['9999'],'0000']],773:[[[[1,2,3],[4,0,5]]],[[[1,2,3],[5,4,0]]]],909:[[[[-1,-1],[-1,-1]]],[[[-1,-1,-1],[-1,2,-1],[-1,9,-1]]]],815:[[[[1,2,7],[3,6,7]],1,6],[[[1,2]],5,5],[[[1,2]],1,3]],743:[[[[2,1,1],[2,3,1],[3,4,1]],4,2],[[[1,2,0]],2,1]],787:[[4,[[0,1,100],[1,2,100],[2,0,100],[1,3,600],[2,3,200]],0,3,1],[2,[],0,1,0]],1631:[[[[1,2,2],[3,8,2],[5,3,5]]],[[[1]]]],778:[[[[0,2],[1,3]]],[[[0]]]],847:[[[[1,2,3],[0],[0],[0]]],[[[]]]],1584:[[[[0,0],[2,2],[3,10],[5,2],[7,0]]],[[[0,0]]]],1168:[[3,[1,2,2],[[1,2,1],[2,3,1]]],[2,[0,0],[[1,2,100]]]],310:[[4,[[1,0],[1,2],[1,3]]],[1,[]]]}
# Normalize the two compact examples to args containing one adjacency/edge list.
EDGE[684]=[[EDGE[684][0]]]
EDGE[785]=[[EDGE[785][0]]]

def word_code(i):
 chars=[]
 for _ in range(3):chars.append(chr(97+i%26));i//=26
 return 'aaaaaaa'+''.join(chars[::-1])

def square(n,value):return [[value(i,j) if callable(value) else value for j in range(n)] for i in range(n)]
PRESSURE={
329:[([square(200,lambda i,j:i*200+(j if i%2==0 else 199-j))],40000),([square(200,2**31-1)],1)],
934:[([square(100,lambda i,j:int((i,j) in ((0,0),(99,99))))],197),([square(100,lambda i,j:int(j in (0,99)))],98)],
490:[([square(100,0),[0,0],[99,99]],1),([square(100,0),[0,0],[50,50]],0)],
505:[([square(100,0),[0,0],[99,99]],198),([square(100,0),[0,0],[50,50]],-1)],
1293:[([square(40,lambda i,j:int((i,j) not in ((0,0),(39,39)))),1600],78),([square(40,lambda i,j:int((i,j) not in ((0,0),(39,39)))),1],-1)],
323:[([2000,[list(e) for e in itertools.islice(itertools.combinations(range(2000),2),5000)]],1),([2000,[[0,1]]],1999)],
261:[([2000,[[i,i+1] for i in range(1999)]],1),([2000,[[i,i+1] for i in range(1999)]+[[0,2]]],0)],
684:[([[[i,i+1] for i in range(1,1000)]+[[1,1000]]],[1,1000])],
1319:[([100000,[[i,i+1] for i in range(99999)]+[[0,2]]],0),([100000,[[0,1]]],-1)],
785:[([adjacency(100,[(i,j) for i in range(50) for j in range(50,100)])],1),([adjacency(100,list(itertools.combinations(range(100),2)))],0)],
886:[([2000,[[i,j] for i in range(1,101) for j in range(101,201)]],1),([2000,[[1,2],[1,3],[2,3]]],0)],
2101:[([[[100000,100000,100000] for _ in range(100)]],100),([[[i*1000+1,1,1] for i in range(100)]],1)],
1466:[([50000,[[i,i+1] for i in range(49999)]],49999),([50000,[[i+1,i] for i in range(49999)]],0)],
2359:[([list(range(1,100000))+[-1],0,99999],99999),([[-1]*100000,0,99999],-1)],
802:[([[[i+1] if i<9999 else [] for i in range(10000)]],list(range(10000))),([[sorted((i+j)%10000 for j in range(1,5)) for i in range(10000)]],[])],
1136:[([5000,[[i,i+1] for i in range(1,5000)]],5000),([5000,[[i,i+1] for i in range(1,5000)]+[[5000,1]]],-1)],
127:[(['aaaaaaaaaa','aaaaaaaaab',[word_code(i) for i in range(5000)]],2),(['aaaaaaaaaa','zzzzzzzzzz',[word_code(i) for i in range(5000)]],0)],
433:[(['AAAAAAAA','CCCCCCCC',['C'*i+'A'*(8-i) for i in range(1,9)]+['TAAAAAAA','GAAAAAAA']],8),(['AAAAAAAA','CCCCCCCC',[]],-1)],
752:[([[f'{i:04d}' for i in range(1000,1500)],'0001'],1),([['0000']+[f'{i:04d}' for i in range(1000,1499)],'9999'],-1)],
773:[([[[1,2,3],[4,5,0]]],0),([[[1,2,3],[5,4,0]]],-1)],
909:[([square(20,-1)],67)],
815:[([[[i,i+1]+list(range(1000+i*198,1000+(i+1)*198)) for i in range(500)],0,500],500),([[list(range(100000))],0,99999],1)],
743:[([[[u+1,v+1,100] for u,v in itertools.islice(itertools.permutations(range(100),2),6000)],100,1],100),([[[u+1,v+1,0] for u,v in itertools.islice(itertools.permutations(range(100),2),6000)],100,1],0)],
787:[([100,[[u,v,10000] for u,v in itertools.combinations(range(100),2)],0,99,0],10000),([100,[[i,i+1,10000] for i in range(99)],0,99,98],990000)],
1631:[([square(100,1)],0),([square(100,lambda i,j:1 if (i+j)%2 else 1000000)],999999)],
778:[([square(50,lambda i,j:i*50+j)],2499),([square(50,lambda i,j:2499-i*50-j)],2499)],
847:[([adjacency(12,list(itertools.combinations(range(12),2)))],11),([adjacency(12,[(0,j) for j in range(1,12)])],20)],
1584:[([[[i*2000-1000000,0] for i in range(1000)]],1998000),([[[-1000000,-1000000],[-1000000,1000000],[1000000,-1000000],[1000000,1000000]]],6000000)],
1168:[([10000,[100000]*10000,[[i,i+1,1] for i in range(1,10000)]+[[1,2,0]]],109998),([10000,[0]*10000,[[i,i+1,100000] for i in range(1,10000)]+[[1,2,0]]],0)],
310:[([20000,[[i,i+1] for i in range(19999)]],[9999,10000]),([20000,[[0,i] for i in range(1,20000)]],[0])],
}
_ladder=square(20,-1);_ladder[-1][1]=400;PRESSURE[909].append(([_ladder],1))

META={
329:('矩阵中的最长递增路径','Longest Increasing Path in a Matrix','longestIncreasingPath','从任意格出发，每步上下左右移动到值严格更大的相邻格。返回最长路径包含的格子数，不能对角移动或绕回边界。','Start at any cell and move up, down, left or right only to a strictly larger value. Return the maximum number of cells on such a path; no diagonal moves or wrapping.'),
934:('连接两座岛的最短桥','Shortest Bridge','shortestBridge','0是水、1是陆地，四邻接恰有两座岛。把最少数量的水格变为陆地，使两岛连通，返回翻转数。','Zero is water and one is land, with exactly two four-connected islands. Flip the fewest water cells to land so the islands connect; return the number flipped.'),
490:('迷宫中的滚动球','The Maze','hasPath','球选上下左右方向后会一直滚到墙或边界前才停下，只有停下后可再选方向。判断能否恰好停在destination，而非仅经过它。','The ball rolls in a chosen cardinal direction until stopped by a wall or boundary, then may choose another direction. Determine whether it can stop at destination; merely passing it is insufficient.'),
505:('滚动迷宫最短距离','The Maze II','shortestDistance','球沿一个方向一直滚到墙或边界前才停止。求从start恰好停在destination的最少经过格数，不计起点；不可达返回-1。','The ball rolls until a wall or boundary stops it. Return the minimum number of cells traveled, excluding the start, to stop at destination; return -1 if impossible.'),
1293:('消除障碍后的最短路径','Shortest Path in a Grid with Obstacles Elimination','shortestPath','从左上到右下四邻接移动，最多可消除k个值为1的障碍。返回最少移动步数，不存在路径返回-1。','Move in four cardinal directions from top-left to bottom-right, removing at most k obstacle cells marked one. Return the minimum moves, or -1 if unreachable.'),
323:('无向图的连通分量','Number of Connected Components in an Undirected Graph','countComponents','给出n个编号0至n-1的节点及无向边，返回连通分量数，孤立节点也算一个分量。','Given n vertices numbered 0 through n-1 and undirected edges, count connected components, including isolated vertices.'),
261:('判断无向图是否为树','Graph Valid Tree','validTree','判断给定n个节点和无向边是否组成一棵树，即整个图连通且没有环。','Determine whether the undirected graph on n vertices is connected and acyclic, hence a tree.'),
684:('冗余连接','Redundant Connection','findRedundantConnection','一个n节点无向连通图由树增加一条边得到。删除一条边后应仍为树；若有多个选择，返回输入中最后出现的可删除边，端点按原顺序返回。','An undirected connected graph on n vertices is a tree plus one edge. Return the last edge in input order whose removal leaves a tree, preserving its endpoint order.'),
1319:('连通网络的最少操作','Number of Operations to Make Network Connected','makeConnected','可拆下一条已有网络线缆并连接任意两个不同计算机。返回使n台计算机全部连通的最少操作数，线缆不足时返回-1。','An operation removes an existing cable and reconnects it between any two distinct computers. Return the fewest operations to connect all n computers, or -1 if there are too few cables.'),
785:('判断二分图','Is Graph Bipartite','isBipartite','判断能否把所有节点分成两组，使每条无向边的两端分属不同组。图可能不连通。','Determine whether all vertices can be divided into two groups so every undirected edge crosses groups. The graph may be disconnected.'),
886:('可能的二分法','Possible Bipartition','possibleBipartition','n个人编号1至n，dislikes给出不能同组的两人。判断能否分为两组满足全部限制。','People are numbered 1 through n. Each dislike pair must belong to different groups. Determine whether two groups can satisfy all constraints.'),
2101:('最多引爆的炸弹','Detonate the Maximum Bombs','maximumDetonation','每个炸弹为[x,y,r]，引爆后触发距离其中心不超过r的所有其他炸弹并连锁传播。选择一个起爆点，返回最多能引爆的炸弹数，距离为欧氏距离。','Each bomb is [x,y,r]. Detonating it triggers every other bomb within Euclidean distance r, causing a chain reaction. Choose one initial bomb to maximize the total detonated.'),
1466:('重新规划路线','Reorder Routes to Make All Paths Lead to the City Zero','minReorder','忽略方向后道路构成一棵树。一次可反转一条有向道路，返回使每座城市都能沿有向路到达城市0的最少反转数。','Ignoring directions, roads form a tree. Reverse the fewest directed roads so every city can reach city zero; return the reversal count.'),
2359:('两个起点的最近公共节点','Find Closest Node to Given Two Nodes','closestMeetingNode','每个节点至多有一条出边，-1表示无出边。返回两个起点都可到达且两段距离最大值最小的节点；并列取编号最小者，无公共可达节点返回-1。','Each vertex has at most one outgoing edge; -1 means none. Among vertices reachable from both starts, minimize the maximum of their distances. Break ties by smallest index; return -1 if none exists.'),
802:('最终安全节点','Find Eventual Safe States','eventualSafeNodes','终止节点没有出边。若从某节点出发的所有可能路径最终都到达终止节点，则该节点安全。按编号升序返回所有安全节点。','Terminal vertices have no outgoing edges. A vertex is safe when every possible path starting there eventually reaches a terminal vertex. Return all safe vertices in increasing order.'),
1136:('并行课程的最少学期','Parallel Courses','minimumSemesters','课程编号1至n。每学期可同时修任意多门课程，但每门课所有先修课必须在更早学期完成。返回完成全部课程的最少学期，存在依赖环返回-1。','Courses are numbered 1 through n. Take any number per semester, provided all prerequisites finished in earlier semesters. Return the minimum semesters to finish all courses, or -1 for cyclic dependencies.'),
127:('单词接龙','Word Ladder','ladderLength','每次只改变一个字母，除起始单词外每个中间及结束单词都必须在wordList中。返回最短beginWord到endWord序列的单词数，无法到达返回0。','Change one letter per step. Every word after beginWord, including endWord, must be in wordList. Return the number of words in the shortest transformation sequence, or zero if impossible.'),
433:('最少基因变化','Minimum Genetic Mutation','minMutation','基因串每次改变一个位置，新串必须在bank中。返回startGene变为endGene的最少变化次数，无法到达返回-1。起始串本身不要求在bank中。','Change one gene position per step; each new string must be in bank. Return the minimum mutations from startGene to endGene, or -1 if impossible. The initial string need not be in bank.'),
752:('打开转盘锁','Open the Lock','openLock','四位锁从0000开始，每步将某一位加1或减1，9与0循环相邻。不能进入deadends，包括初始位置。返回到target的最少步数，无法到达返回-1。','Start a four-wheel lock at 0000. Each move increments or decrements one digit, wrapping 9 and 0. Never enter deadends, including the initial position. Return the fewest moves to target or -1.'),
773:('滑动拼图','Sliding Puzzle','slidingPuzzle','2×3棋盘中0为空位，每步与上下左右相邻数字交换。返回变成第一行1,2,3、第二行4,5,0的最少步数，无解返回-1。','On a 2-by-3 board, swap the zero blank with a cardinally adjacent tile. Return the minimum moves to rows [1,2,3] and [4,5,0], or -1 if unsolvable.'),
909:('蛇梯棋','Snakes and Ladders','snakesAndLadders','格子从左下开始按行交替左右方向编号1至n²。每次前进1至6格，不超过终点；落点有蛇或梯则立即跳到指定编号，每回合最多跳一次。返回到终点的最少回合数，无法到达返回-1。','Squares are numbered 1 through n² starting bottom-left, reversing direction each row. Move 1–6 squares without passing the end. If the landing square has a snake or ladder, follow it once only that turn. Return the minimum turns to the end or -1.'),
815:('公交换乘','Bus Routes','numBusesToDestination','每条公交线路循环经过给出的所有站点，顺序不影响乘坐同一辆车的可达性。返回source到target最少乘坐的公交车辆数，不可达返回-1，同站返回0。','Each bus route cycles through all listed stops. Return the minimum number of buses boarded from source to target, or -1 if unreachable; identical source and target require zero buses.'),
743:('网络延迟时间','Network Delay Time','networkDelayTime','从节点k发出信号，times为有向边[u,v,w]及非负传播时间。返回所有n个节点收到信号的最早时间；有节点收不到返回-1。','Send a signal from k. Each directed edge [u,v,w] has nonnegative travel time. Return the earliest time by which all n vertices receive it, or -1 if any is unreachable.'),
787:('限定中转次数的最便宜航班','Cheapest Flights Within K Stops','findCheapestPrice','有向航班[from,to,price]，从src到dst最多经过k个中间停靠城市（最多k+1段航班）。返回最低价格，无合法路线返回-1。','Flights are directed [from,to,price]. Travel from src to dst with at most k intermediate stops, hence at most k+1 flights. Return the lowest price, or -1 if impossible.'),
1631:('最小体力消耗路径','Path With Minimum Effort','minimumEffortPath','从左上四邻接走到右下，路径体力为相邻两格高度差绝对值的最大值。返回最小可能体力。','Move cardinally from top-left to bottom-right. A path’s effort is its maximum absolute height difference across an edge. Return the minimum possible effort.'),
778:('水位上升后的最早通行时间','Swim in Rising Water','swimInWater','时刻t水位为t，只能进入高度不超过t的格子。四邻接移动本身不耗时，返回从左上到右下的最早时刻，起点也必须被淹没。','At time t, cells of elevation at most t are traversable. Cardinal movement takes no additional time. Return the earliest time to reach bottom-right from top-left, including submerging the start.'),
847:('访问所有节点的最短路径','Shortest Path Visiting All Nodes','shortestPathLength','在连通无向图中可从任意节点开始、任意节点结束，允许重复经过边和节点。返回访问过每个节点至少一次的最少边数。','Start and end anywhere in a connected undirected graph. Repeated vertices and edges are allowed. Return the fewest edges needed to visit every vertex at least once.'),
1584:('连接所有点的最小费用','Min Cost to Connect All Points','minCostConnectPoints','连接两点的费用为曼哈顿距离。选择若干连线使所有点连通，返回最小总费用。','Connecting two points costs their Manhattan distance. Choose connections making every point connected and minimize the total cost.'),
1168:('村庄供水的最低费用','Optimize Water Distribution in a Village','minCostToSupplyWater','房屋编号1至n。可花wells[i-1]在房屋i打井，或修建双向管道[u,v,cost]。每座房屋必须通过井及管道获得水，返回最小总费用；允许同一对房屋有多条候选管道。','Houses are numbered 1 through n. Build a well at house i for wells[i-1], or bidirectional candidate pipes [u,v,cost]. Supply every house through wells and pipes at minimum total cost. Parallel candidate pipes are allowed.'),
310:('最小高度树的根','Minimum Height Trees','findMinHeightTrees','给定无向树，选择根后高度是根到最远节点的边数。返回所有能使树高度最小的根编号，顺序不限。','Given an undirected tree, rooted height is the maximum edge distance from its root. Return all roots attaining minimum height, in any order.'),
}

CONSTRAINTS={
329:('1≤行、列≤200，值在[0,2147483647]。','1≤rows,columns≤200; values in [0,2147483647].'),934:('方阵边长2至100，值为0或1，恰好两座四邻接岛。','Square side 2–100; binary values; exactly two four-connected islands.'),490:('1≤行、列≤100，值0为空地、1为墙；起终点为不同空地，坐标0起始且在矩阵内。','1≤rows,columns≤100; 0 empty, 1 wall; start and destination are distinct empty cells with valid zero-based coordinates.'),505:('1≤行、列≤100，值0为空地、1为墙；起终点为不同空地，坐标0起始且在矩阵内。','1≤rows,columns≤100; 0 empty, 1 wall; start and destination are distinct empty cells with valid zero-based coordinates.'),1293:('1≤行、列≤40，值0或1，起终点均为0；1≤k≤行×列。','1≤rows,columns≤40; binary entries; both endpoints zero; 1≤k≤rows×columns.'),
323:('1≤n≤2000，1≤m≤5000；0≤u<v<n，无重复边。','1≤n≤2000; 1≤m≤5000; 0≤u<v<n; no duplicate edges.'),261:('1≤n≤2000，0≤m≤5000；端点在[0,n-1]，无自环、重复无向边。','1≤n≤2000; 0≤m≤5000; endpoints in [0,n-1]; no self-loops or duplicate undirected edges.'),684:('边数n在[3,1000]，节点为1至n；1≤u<v≤n，无重复边且图连通。','Edge count n in [3,1000]; vertices 1–n; 1≤u<v≤n; no duplicate edges and the graph is connected.'),1319:('1≤n≤100000，1≤m≤min(n(n-1)/2,100000)；端点在[0,n-1]，无自环和重复无向连接。','1≤n≤100000; 1≤m≤min(n(n-1)/2,100000); endpoints in [0,n-1]; no loops or duplicate undirected connections.'),785:('1≤n≤100，邻居在[0,n-1]，无自环和重复邻居，邻接关系双向一致。','1≤n≤100; neighbors in [0,n-1]; no loops or repeated neighbors; adjacency is symmetric.'),886:('1≤n≤2000，0≤m≤10000；1≤u<v≤n，各对不同。','1≤n≤2000; 0≤m≤10000; 1≤u<v≤n; all pairs distinct.'),2101:('1≤n≤100；每行x,y,r均在[1,100000]。','1≤n≤100; each x,y,r is in [1,100000].'),1466:('2≤n≤50000，m=n-1，端点在[0,n-1]；忽略方向后保证是一棵树。','2≤n≤50000; m=n-1; endpoints in [0,n-1]; ignoring directions the graph is a tree.'),2359:('2≤n≤100000，edges[i]在[-1,n-1]且不等于i；两个起点在[0,n-1]，可以相同。','2≤n≤100000; edges[i] in [-1,n-1] and not i; starts in [0,n-1] and may coincide.'),802:('1≤n≤10000，总边数1至40000；每行邻居在[0,n-1]且严格递增，允许自环。','1≤n≤10000; total edges 1–40000; each neighbor list is strictly increasing in [0,n-1]; self-loops allowed.'),1136:('1≤n≤5000，1≤m≤5000；端点在[1,n]且不同，所有有序关系不同。','1≤n≤5000; 1≤m≤5000; distinct endpoints in [1,n]; directed pairs are unique.'),127:('所有字符串等长且为1至10个小写英文字母；起止不同；词表1至5000个互不相同单词。','All strings have equal length 1–10 and lowercase English letters; start differs from end; dictionary has 1–5000 unique words.'),433:('所有基因恰为8个A/C/G/T字符；bank长度0至10；起点不要求在bank中。','All genes contain exactly 8 A/C/G/T characters; bank length 0–10; the start need not be in bank.'),752:('1≤死锁数≤500，所有状态恰为4个数字，target不在死锁列表中。','1–500 deadends; all states are exactly four decimal digits; target is not a deadend.'),773:('矩阵必须2行3列，0至5各出现一次。','Exactly 2 rows and 3 columns, containing each value 0 through 5 once.'),909:('方阵边长2至20；值为-1或[1,n²]；编号1和n²格没有蛇或梯起点。','Square side 2–20; values -1 or [1,n²]; squares 1 and n² do not start snakes or ladders.'),815:('1≤线路数≤500，各线路1至100000站且线路内站号不重复，站数总和≤100000；站号、source、target在[0,999999]。','1–500 routes; each has 1–100000 unique stops; total stops≤100000; stop IDs, source and target in [0,999999].'),743:('1≤k≤n≤100，1≤m≤6000；端点在[1,n]且不同，时间在[0,100]，无重复有向边。','1≤k≤n≤100; 1≤m≤6000; distinct endpoints in [1,n]; time in [0,100]; no repeated directed edges.'),787:('2≤n≤100，0≤m≤n(n-1)/2；节点0至n-1，无自环或重复有向航班，价格1至10000；src≠dst，0≤src,dst,k<n。','2≤n≤100; 0≤m≤n(n-1)/2; vertices 0–n-1; no loops or duplicate directed flights; price 1–10000; src≠dst and 0≤src,dst,k<n.'),1631:('1≤行、列≤100，高度1至1000000。','1≤rows,columns≤100; heights 1–1000000.'),778:('方阵边长1至50，格子值是0至n²-1的一个排列。','Square side 1–50; entries are a permutation of 0 through n²-1.'),847:('1≤n≤12，邻居在[0,n-1]，无自环和重复邻居，双向对称，保证图连通。','1≤n≤12; neighbors in [0,n-1]; no loops or duplicates; symmetric adjacency; the graph is connected.'),1584:('1≤n≤1000，坐标在[-1000000,1000000]，所有点互不相同。','1≤n≤1000; coordinates in [-1000000,1000000]; all points distinct.'),1168:('2≤n≤10000，恰有n个井费用；1≤m≤10000；井和管道费用在[0,100000]；管道端点不同且在[1,n]，允许平行边。','2≤n≤10000; exactly n well costs; 1≤m≤10000; well/pipe costs in [0,100000]; distinct pipe endpoints in [1,n]; parallel edges allowed.'),310:('1≤n≤20000，m=n-1；端点在[0,n-1]，无自环或重复边，保证连通无环。','1≤n≤20000; m=n-1; endpoints in [0,n-1]; no loops or duplicate edges; connected and acyclic.'),
}

def input_text(pid):
 if pid in MATRIX:
  zh='第一行行数和列数，之后每行一行矩阵整数。';en='First line: row count and column count; then one row of matrix integers per line.'
  if pid in (490,505):zh+='矩阵后两行分别为start的行列坐标、destination的行列坐标。';en+=' After the matrix: start row/column, then destination row/column on separate lines.'
  if pid==1293:zh+='矩阵后单独一行k。';en+=' After the matrix, one line k.'
 elif pid in N_EDGES:zh='第一行n和边数m，之后m行每行两个端点，方向按题意。';en='First line n and edge count m, then m endpoint pairs, directed as stated.'
 elif pid in ADJ:zh='第一行节点数n，随后n行，第i行先给邻居数，再给节点i的所有邻居编号。';en='First line vertex count n; next n lines give a neighbor count followed by that vertex’s neighbors, in vertex order.'
 elif pid in (684,2101,1584):zh='第一行记录数n，之后每行一条记录：'+('两个边端点。' if pid==684 else 'x y r。' if pid==2101 else 'x y。');en='First line record count n; then one '+('endpoint pair' if pid==684 else 'x y r triple' if pid==2101 else 'x y point')+' per line.'
 elif pid==2359:zh='第一行n node1 node2，第二行n个edges值。';en='First line n node1 node2; second line n edges values.'
 elif pid in (127,433):zh='第一行起始串，第二行目标串，第三行词表/基因库条数m，之后m行每行一个字符串。';en='Start string, target string, then dictionary/bank count m on three lines; next m lines contain one string each.'
 elif pid==752:zh='第一行死锁数m，之后m行死锁字符串，最后一行target。';en='First line deadend count m; then m deadend strings; final line target.'
 elif pid==815:zh='第一行线路数n source target；之后n行每行先给站数，再给该线路站号。';en='First line route count n, source, target; next n lines give a stop count followed by that route’s stop IDs.'
 elif pid==743:zh='第一行边数m 节点数n 起点k，之后m行u v w。';en='First line edge count m, vertex count n, source k; then m lines u v w.'
 elif pid==787:zh='第一行n m src dst k，之后m行from to price。';en='First line n m src dst k; then m lines from to price.'
 else:zh='第一行房屋数n 管道数m，第二行n个井费用，之后m行house1 house2 cost。';en='First line house count n and pipe count m; second line n well costs; then m lines house1 house2 cost.'
 a,b=CONSTRAINTS[pid];return zh+a,en+' '+b

WRONG={
329:[('counts all cells instead of one increasing path','result=len(args[0])*len(args[0][0])'),('counts all distinct values without adjacency','result=len({v for row in args[0] for v in row})')],
934:[('counts land endpoint in bridge length','groups=islands(args[0]);result=min(abs(i-u)+abs(j-v) for i,j in groups[0] for u,v in groups[1])'),('allows diagonal bridge steps','groups=islands(args[0]);result=min(max(abs(i-u),abs(j-v))-1 for i,j in groups[0] for u,v in groups[1])')],
490:[('can stop at any traversed empty cell','g,s,t=args;q=[tuple(s)];seen={tuple(s)}\nwhile q:\n i,j=q.pop()\n for u,v in neighbors(i,j,len(g),len(g[0])):\n  if not g[u][v] and (u,v) not in seen:seen.add((u,v));q.append((u,v))\nresult=int(tuple(t) in seen)'),('requires start and destination on one straight line','result=int(args[1][0]==args[2][0] or args[1][1]==args[2][1])')],
505:[('ignores stopping rules and walls','result=abs(args[1][0]-args[2][0])+abs(args[1][1]-args[2][1])'),('counts one direction choice as one distance unit','result=1')],
1293:[('assumes obstacle budget always sufficient','result=len(args[0])+len(args[0][0])-2'),('counts visited cells rather than moves','result=len(args[0])+len(args[0][0])-1')],
323:[('subtracts every edge even on cycles','result=args[0]-len(args[1])'),('assumes all nonempty graphs connected','result=1')],
261:[('checks edge count alone','result=int(len(args[1])==args[0]-1)'),('checks connectivity but ignores cycles','result=int(components(args[0],args[1])==1)')],
684:[('returns first edge','result=args[0][0]'),('returns last edge even when outside cycle','result=args[0][-1]')],
1319:[('ignores insufficient cable count','result=components(args[0],args[1])-1'),('requires n cables rather than n minus one','result=-1 if len(args[1])<args[0] else components(args[0],args[1])-1')],
785:[('only checks absence of self loops','result=int(all(i not in row for i,row in enumerate(args[0])))'),('requires a connected graph','g=args[0];result=int(components(len(g),[(i,j) for i,row in enumerate(g) for j in row])==1)')],
886:[('only checks absence of self dislikes','result=int(all(u!=v for u,v in args[1]))'),('rejects all odd numbers of people','result=int(args[0]%2==0)')],
2101:[('counts only directly triggered bombs','b=args[0];result=max(sum((x-u)**2+(y-v)**2<=r*r for u,v,_ in b) for x,y,r in b)'),('uses Manhattan rather than Euclidean radius','b=args[0];n=len(b);d=distances(n,[(i,j,1) for i,(x,y,r) in enumerate(b) for j,(u,v,_) in enumerate(b) if abs(x-u)+abs(y-v)<=r],True);result=max(sum(v<INF for v in row) for row in d)')],
1466:[('orients by numeric label instead of root paths','result=sum(u<v for u,v in args[1])'),('reverses every edge','result=args[0]-1')],
2359:[('returns first starting node without reachability','result=args[1]'),('breaks ties toward largest index','edges,u,v=args;d=distances(len(edges),[(i,j,1) for i,j in enumerate(edges) if j>=0],True);choices=[(max(d[u][j],d[v][j]),-j) for j in range(len(edges)) if d[u][j]<INF and d[v][j]<INF];result=-min(choices)[1] if choices else -1')],
802:[('returns only terminal vertices','result=[i for i,row in enumerate(args[0]) if not row]'),('assumes all vertices safe','result=list(range(len(args[0])))')],
1136:[('takes one course per semester','result=args[0]'),('counts edges instead of dependency depth','result=len(args[1])+1')],
127:[('allows only direct transformation','s,t,b=args;result=2 if t in b and sum(x!=y for x,y in zip(s,t))==1 else 0'),('counts transformations rather than words','result=max(0,oracle(127,args)-1)')],
433:[('ignores bank membership','result=sum(x!=y for x,y in zip(args[0],args[1]))'),('assumes at least one mutation required','result=1 if args[1] in args[2] else -1')],
752:[('ignores deadends','result=sum(min(int(c),10-int(c)) for c in args[1])'),('does not wrap digits at nine','result=sum(map(int,args[1]))')],
773:[('uses blank distance only','state=sum(args[0],[]);i=state.index(0);result=abs(i//3-1)+abs(i%3-2)'),('counts misplaced tiles only','result=sum(v!=0 and v!=i+1 for i,v in enumerate(sum(args[0],[])))')],
909:[('ignores snakes and ladders','result=(len(args[0])**2-1+5)//6'),('assumes at least one ladder is necessary','result=1 if any(v!=-1 for row in args[0] for v in row) else -1')],
815:[('counts every route as a required bus','result=len(args[0])'),('permits no transfers','routes,s,t=args;result=1 if any(s in row and t in row for row in routes) else -1')],
743:[('uses largest single edge not accumulated distance','result=max(w for _,_,w in args[0])'),('sums every edge rather than shortest arrival times','result=sum(w for _,_,w in args[0])')],
787:[('only considers direct flights','n,flights,s,t,k=args;result=min((w for u,v,w in flights if u==s and v==t),default=-1)'),('allows k flights instead of k plus one','n,flights,s,t,k=args;d=[INF]*n;d[s]=0\nfor _ in range(k):\n nxt=d[:]\n for u,v,w in flights:nxt[v]=min(nxt[v],d[u]+w)\n d=nxt\nresult=d[t] if d[t]<INF else -1')],
1631:[('uses global height range','v=sum(args[0],[]);result=max(v)-min(v)'),('compares only start and destination heights','result=abs(args[0][0][0]-args[0][-1][-1])')],
778:[('checks destination elevation only','result=args[0][-1][-1]'),('starts without waiting for water','result=0')],
847:[('assumes a Hamiltonian path exists','result=len(args[0])-1'),('returns full DFS round-trip length','result=2*(len(args[0])-1)')],
1584:[('connects every point to the first','p=args[0];result=sum(abs(x-p[0][0])+abs(y-p[0][1]) for x,y in p)'),('uses bounding box perimeter half','p=args[0];result=max(x for x,y in p)-min(x for x,y in p)+max(y for x,y in p)-min(y for x,y in p)')],
1168:[('builds a well at every house','result=sum(args[1])'),('forgets the cost of a source well','result=sum(w for _,_,w in args[2])')],
310:[('takes just one highest-degree vertex','n,e=args;c=Counter(v for edge in e for v in edge);result=[max(range(n),key=lambda i:c[i])]'),('always chooses vertex zero','result=[0]')],
}
EDGE[1293].append([[[0,1,1],[1,1,1],[1,1,0]],1])
EDGE[323].append([3,[[0,1],[0,2],[1,2]]])
EDGE[261].append([4,[[0,1],[1,2],[0,2]]])
EDGE[684].append([[[1,2],[2,3],[1,3],[3,4]]])
EDGE[1319].append([3,[[0,1],[1,2]]])
EDGE[785].extend([[[[1,2],[0,2],[0,1]]],[[[],[]]]])
EDGE[886].append([3,[]])
EDGE[2101].extend([[[[1,1,2],[3,1,2],[5,1,2],[7,1,2]]],[[[1,1,3],[3,3,1]]]])
EDGE[2359].append([[1,0],0,1])
EDGE[433].append(['AAAAAAAA','AAAAAAAC',[]])
EDGE[778].append([[[3,0],[1,2]]])
EDGE[310].append([4,[[0,1],[1,2],[2,3]]])

HARD={329,505,1293,127,773,815,778,847,1168}

def make(pid):
 zh,en,method,dz,de=META[pid];iz,ie=input_text(pid);kind='integer-set' if pid==310 else 'integer-array' if pid in (684,802) else 'integer'
 helpers='import sys,itertools,math\nfrom collections import deque,Counter\nINF=10**30\n'+''.join(inspect.getsource(f)+'\n' for f in (neighbors,distances,components,islands,mst_brute,oracle))
 emit='print(len(result));print(*result) if result else None' if kind!='integer' else 'print(int(result))'
 oz='第一行输出元素数量，随后空白分隔整数；'+('顺序不限，不得重复。' if pid==310 else '严格保持题目规定的端点/升序顺序。') if kind!='integer' else '输出一个整数；判断题用1表示是、0表示否。'
 oe='Print the count on the first line, then whitespace-separated integers; '+('any order, without duplicates.' if pid==310 else 'preserve the specified endpoint/increasing order.') if kind!='integer' else 'Print one integer; for a yes/no question use 1 for yes and 0 for no.'
 return dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='困难' if pid in HARD else '中等',resultKind=kind,edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[{'name':name,'source':helpers+parse(pid)+'\n'+body+'\n'+emit+'\n'} for name,body in WRONG[pid]])
PROBLEMS={pid:make(pid) for pid in IDS}
