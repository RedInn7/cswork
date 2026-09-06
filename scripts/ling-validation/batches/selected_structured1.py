"""Authored interval/matrix/graph fixtures with lossless structured outputs."""
import inspect,itertools,string
from collections import deque
INF=2**31-1
IDS=[220,273,1023,56,57,986,1314,733,286,542,1129,1462]
ROWS={56,57,986,1314,733,286,542}
MATRICES={1314,733,286,542}
ONES=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
TENS=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

def oracle(pid,a):
 x=a[0]
 if pid==220:return int(any(j-i<=a[1] and abs(x[i]-x[j])<=a[2] for i in range(len(x)) for j in range(i+1,len(x))))
 if pid==273:
  if x==0:return 'Zero'
  groups=[];digits=str(x);chunks=[]
  while digits:chunks.append(digits[-3:].zfill(3));digits=digits[:-3]
  for i,chunk in reversed(list(enumerate(chunks))):
   h,t,u=map(int,chunk);words=[]
   if h:words.extend((ONES[h],'Hundred'))
   if t<2:
    if t*10+u:words.append(ONES[t*10+u])
   else:
    words.append(TENS[t])
    if u:words.append(ONES[u])
   if words:
    if i:words.append(['','Thousand','Million','Billion'][i])
    groups.extend(words)
  return ' '.join(groups)
 if pid==1023:
  pattern=a[1];answers=[]
  for word in x:
   matches=False
   for selected in itertools.combinations(range(len(word)),len(pattern)):
    if ''.join(word[i] for i in selected)==pattern and all(word[i].islower() for i in range(len(word)) if i not in selected):matches=True;break
   answers.append(int(matches))
  return answers
 if pid in (56,57):
  intervals=x+([a[1]] if pid==57 else []);unused=set(range(len(intervals)));out=[]
  while unused:
   component={unused.pop()};changed=True
   while changed:
    changed=False
    for i in list(unused):
     if any(max(intervals[i][0],intervals[j][0])<=min(intervals[i][1],intervals[j][1]) for j in component):unused.remove(i);component.add(i);changed=True
   out.append([min(intervals[i][0] for i in component),max(intervals[i][1] for i in component)])
  return sorted(out)
 if pid==986:return sorted([max(l,u),min(r,v)] for l,r in x for u,v in a[1] if max(l,u)<=min(r,v))
 if pid==1314:
  m,n=len(x),len(x[0]);k=a[1]
  return [[sum(x[u][v] for u in range(m) for v in range(n) if abs(u-i)<=k and abs(v-j)<=k) for j in range(n)] for i in range(m)]
 if pid==733:
  m,n=len(x),len(x[0]);sr,sc,color=a[1:];component={(sr,sc)}
  while True:
   more={(i,j) for i in range(m) for j in range(n) if x[i][j]==x[sr][sc] and any(abs(i-u)+abs(j-v)==1 for u,v in component)}-component
   if not more:break
   component|=more
  return [[color if (i,j) in component else x[i][j] for j in range(n)] for i in range(m)]
 if pid==542:
  zeros=[(i,j) for i,row in enumerate(x) for j,v in enumerate(row) if v==0]
  return [[min(abs(i-u)+abs(j-v) for u,v in zeros) for j in range(len(x[0]))] for i in range(len(x))]
 if pid==286:
  m,n=len(x),len(x[0]);out=[row[:] for row in x]
  for i in range(m):
   for j in range(n):
    if x[i][j]!=INF:continue
    q=deque([(i,j,0)]);seen={(i,j)}
    while q:
     u,v,d=q.popleft()
     if x[u][v]==0:out[i][j]=d;break
     for p,t in ((u-1,v),(u+1,v),(u,v-1),(u,v+1)):
      if 0<=p<m and 0<=t<n and x[p][t]!=-1 and (p,t) not in seen:seen.add((p,t));q.append((p,t,d+1))
  return out
 if pid==1129:
  # Bellman-Ford on (vertex,last edge color), independent of BFS reference.
  dist=[[INF]*2 for _ in range(x)];dist[0]=[0,0]
  for _ in range(2*x):
   previous=[v[:] for v in dist]
   for c,edges in enumerate(a[1:]):
    for u,v in edges:dist[v][c]=min(dist[v][c],previous[u][1-c]+1)
   if previous==dist:break
  return [-1 if min(v)==INF else min(v) for v in dist]
 if pid==1462:
  result=[]
  for start,target in a[2]:
   reached={start}
   while True:
    more={v for u,v in a[1] if u in reached}-reached
    if not more:break
    reached|=more
   result.append(int(target in reached))
  return result
 raise AssertionError(pid)

def fast(pid,a,bug=0):
 x=a[0]
 if pid==220:
  width=a[2]+1;buckets={}
  for i,v in enumerate(x):
   key=v//width
   for other in (key-1,key,key+1):
    if other in buckets and (abs(v-buckets[other])<a[2] if bug==1 else abs(v-buckets[other])<=a[2]):return 1
   buckets[key]=v
   if bug!=2 and i>=a[1]:buckets.pop(x[i-a[1]]//width,None)
  return 0
 if pid==273:
  def words(n):
   if n==0:return []
   if n<20:return [ONES[n]]
   if n<100:return [TENS[n//10]]+words(n%10)
   for base,label in ((10**9,'Billion'),(10**6,'Million'),(1000,'Thousand'),(100,'Hundred')):
    if n>=base:return words(n//base)+[label]+words(n%base)
  if bug==1 and x>=1000:x%=1000
  result=' '.join(words(x)) if x else 'Zero'
  return result.replace('Forty','Fourty') if bug==2 else result
 if pid==1023:
  out=[]
  for word in x:
   if bug==2:out.append(int(''.join(c for c in word if c.isupper())==''.join(c for c in a[1] if c.isupper())));continue
   j=0;good=True
   for c in word:
    if j<len(a[1]) and c==a[1][j]:j+=1
    elif c.isupper() and bug!=1:good=False
   out.append(int(good and j==len(a[1])))
  return out
 if pid in (56,57):
  intervals=x+([a[1]] if pid==57 else []);out=[]
  for l,r in (intervals if bug==2 else sorted(intervals)):
   if not out or (out[-1][1]<=l if bug==1 else out[-1][1]<l):out.append([l,r])
   else:out[-1][1]=max(out[-1][1],r)
  return out
 if pid==986:
  i=j=0;out=[]
  while i<len(x) and j<len(a[1]):
   l=max(x[i][0],a[1][j][0]);r=min(x[i][1],a[1][j][1])
   if l<r if bug==1 else l<=r:out.append([l,r])
   if bug==2:i+=1;j+=1
   elif x[i][1]<a[1][j][1]:i+=1
   else:j+=1
  return out
 if pid==1314:
  m,n=len(x),len(x[0]);k=a[1]-(bug==1);prefix=[[0]*(n+1) for _ in range(m+1)]
  for i in range(m):
   for j in range(n):prefix[i+1][j+1]=x[i][j]+prefix[i][j+1]+prefix[i+1][j]-prefix[i][j]
  out=[]
  for i in range(m):
   row=[]
   for j in range(n):
    t,b=max(0,i-k),min(m,i+k+1);l,r=max(0,j-k),min(n,j+k+1)
    if bug==2:t,b=i,i+1
    row.append(prefix[b][r]-prefix[t][r]-prefix[b][l]+prefix[t][l])
   out.append(row)
  return out
 if pid==733:
  out=[v[:] for v in x];m,n=len(x),len(x[0]);sr,sc,color=a[1:];old=x[sr][sc]
  if bug==2:return [[color if v==old else v for v in row] for row in x]
  q=deque([(sr,sc)]);seen={(sr,sc)}
  while q:
   i,j=q.popleft();out[i][j]=color
   offsets=[(u,v) for u in (-1,0,1) for v in (-1,0,1) if (u or v)] if bug==1 else [(-1,0),(1,0),(0,-1),(0,1)]
   for u,v in offsets:
    p,t=i+u,j+v
    if 0<=p<m and 0<=t<n and (p,t) not in seen and x[p][t]==old:seen.add((p,t));q.append((p,t))
  return out
 if pid in (286,542):
  m,n=len(x),len(x[0]);zeros=[(i,j) for i in range(m) for j in range(n) if x[i][j]==0]
  if bug==1:
   return [[-1 if x[i][j]==-1 else min((max(abs(i-u),abs(j-v)) if pid==542 else abs(i-u)+abs(j-v) for u,v in zeros),default=INF) for j in range(n)] for i in range(m)]
  if bug==2:zeros=zeros[:1]
  out=[[-1 if x[i][j]==-1 else INF for j in range(n)] for i in range(m)];q=deque(zeros)
  for i,j in zeros:out[i][j]=0
  while q:
   i,j=q.popleft()
   for u,v in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
    if 0<=u<m and 0<=v<n and out[u][v]==INF:out[u][v]=out[i][j]+1;q.append((u,v))
  return out
 if pid==1129:
  graph=[[[] for _ in range(x)] for _ in range(2)]
  for c,edges in enumerate(a[1:]):
   for u,v in edges:graph[c][u].append(v)
  dist=[[-1]*2 for _ in range(x)];q=deque([(0,1)] if bug==2 else [(0,0),(0,1)])
  for u,c in q:dist[u][c]=0
  while q:
   u,c=q.popleft()
   for nextcolor in ((0,1) if bug==1 else (1-c,)):
    for v in graph[nextcolor][u]:
     if dist[v][nextcolor]<0:dist[v][nextcolor]=dist[u][c]+1;q.append((v,nextcolor))
  return [min((v for v in row if v>=0),default=-1) for row in dist]
 if pid==1462:
  reach=[[False]*x for _ in range(x)]
  for u,v in a[1]:reach[u][v]=True
  if bug!=1:
   for k in range(x):
    for i in range(x):
     if reach[i][k]:
      for j in range(x):reach[i][j]|=reach[k][j]
  return [int(reach[v][u] if bug==2 else reach[u][v]) for u,v in a[2]]
 raise AssertionError(pid)

def disjoint(r,n,strict=False):
 out=[];end=-1
 for _ in range(n):
  start=end+r.randint(1,3);end=start+r.randint(1 if strict else 0,3);out.append([start,end])
 return out

def random_args(pid,r):
 if pid==220:
  n=r.randint(2,12);return [[r.randint(-20,20) for _ in range(n)],r.randint(1,n),r.randint(0,15)]
 if pid==273:return [r.choice([r.randint(0,999),r.randint(0,INF),r.randint(1,2000)*1000])]
 if pid==1023:return [[''.join(r.choice('abAB') for _ in range(r.randint(1,8))) for _ in range(r.randint(1,6))],''.join(r.choice('abAB') for _ in range(r.randint(1,4)))]
 if pid==56:return [[sorted([r.randint(0,15),r.randint(0,15)]) for _ in range(r.randint(1,8))]]
 if pid==57:return [disjoint(r,r.randint(0,7)),sorted([r.randint(0,25),r.randint(0,25)])]
 if pid==986:
  n=r.randint(0,7);return [disjoint(r,n,True),disjoint(r,r.randint(1 if n==0 else 0,7),True)]
 if pid in MATRICES:
  m,n=r.randint(1,5),r.randint(1,5);values=[1,2,3] if pid==1314 else [0,1,2] if pid==733 else [-1,0,INF] if pid==286 else [0,1]
  mat=[[r.choice(values) for _ in range(n)] for _ in range(m)]
  if pid==1314:return [mat,r.randint(1,6)]
  if pid==733:return [mat,r.randrange(m),r.randrange(n),r.randint(0,3)]
  if pid==542:mat[r.randrange(m)][r.randrange(n)]=0
  return [mat]
 if pid==1129:
  n=r.randint(1,7);return [n]+[[[r.randrange(n),r.randrange(n)] for _ in range(r.randint(0,15))] for _ in range(2)]
 if pid==1462:
  n=r.randint(2,8);order=r.sample(range(n),n);edges=[[order[i],order[j]] for i in range(n) for j in range(i+1,n) if r.random()<.3];queries=[r.sample(range(n),2) for _ in range(r.randint(1,12))];return [n,edges,queries]

def validate(pid,a):
 def integer(v,lo,hi):assert type(v) is int and lo<=v<=hi
 def interval(row,limit,strict=False):
  assert type(row) is list and len(row)==2
  for v in row:integer(v,0,limit)
  assert row[0]<row[1] if strict else row[0]<=row[1]
 x=a[0]
 if pid==220:
  assert type(x) is list and 2<=len(x)<=100000
  for v in x:integer(v,-10**9,10**9)
  integer(a[1],1,len(x));integer(a[2],0,10**9)
 if pid==273:integer(x,0,INF)
 if pid==1023:
  assert type(x) is list and 1<=len(x)<=100
  for s in x+[a[1]]:assert type(s) is str and 1<=len(s)<=100 and all(c in string.ascii_letters for c in s)
 if pid in (56,57,986):
  arrays=a[:2] if pid==986 else [x]
  for arr in arrays:
   assert type(arr) is list and (1 if pid==56 else 0)<=len(arr)<=(1000 if pid==986 else 10000)
   for row in arr:interval(row,10**9 if pid==986 else 100000 if pid==57 else 10000,pid==986)
   if pid!=56:assert all(u[1]<v[0] for u,v in zip(arr,arr[1:]))
  if pid==57:interval(a[1],100000)
  if pid==986:assert len(x)+len(a[1])>=1
 if pid in MATRICES:
  limit={1314:100,733:50,286:250,542:10000}[pid]
  assert type(x) is list and 1<=len(x)<=limit and type(x[0]) is list and 1<=len(x[0])<=limit
  for row in x:
   assert type(row) is list and len(row)==len(x[0])
   for v in row:
    if pid==1314:integer(v,1,100)
    elif pid==733:integer(v,0,65535)
    else:assert type(v) is int and v in ((-1,0,INF) if pid==286 else (0,1))
  if pid==1314:integer(a[1],1,100)
  if pid==733:integer(a[1],0,len(x)-1);integer(a[2],0,len(x[0])-1);integer(a[3],0,65535)
  if pid==542:assert len(x)*len(x[0])<=10000 and any(0 in row for row in x)
 if pid in (1129,1462):
  integer(x,1 if pid==1129 else 2,100)
  for index,arr in enumerate(a[1:],1):
   assert type(arr) is list and (1 if pid==1462 and index==2 else 0)<=len(arr)<=(400 if pid==1129 else 10000 if index==2 else x*(x-1)//2)
   for row in arr:
    assert type(row) is list and len(row)==2
    for v in row:integer(v,0,x-1)
    if pid==1462:assert row[0]!=row[1]
  if pid==1462:
   assert len(set(map(tuple,a[1])))==len(a[1]);degree=[0]*x;graph=[[] for _ in range(x)]
   for u,v in a[1]:degree[v]+=1;graph[u].append(v)
   todo=deque(i for i,d in enumerate(degree) if d==0);count=0
   while todo:
    u=todo.popleft();count+=1
    for v in graph[u]:
     degree[v]-=1
     if degree[v]==0:todo.append(v)
   assert count==x
 return True

def encode(pid,a):
 def rows(mat):return str(len(mat))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in mat)
 x=a[0]
 if pid==273:return str(x)+'\n'
 if pid==220:return str(len(x))+'\n'+' '.join(map(str,x))+'\n'+str(a[1])+' '+str(a[2])+'\n'
 if pid==1023:return str(len(x))+'\n'+'\n'.join(x)+'\n'+a[1]+'\n'
 if pid in (56,57,986):return rows(x)+(rows(a[1]) if pid==986 else ' '.join(map(str,a[1]))+'\n' if pid==57 else '')
 if pid in MATRICES:return str(len(x))+' '+str(len(x[0]))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in x)+(' '.join(map(str,a[1:]))+'\n' if len(a)>1 else '')
 return str(x)+'\n'+rows(a[1])+rows(a[2])

def parse(pid):
 if pid==1023:return "q=int(sys.stdin.readline());args=[[sys.stdin.readline().strip() for _ in range(q)],sys.stdin.readline().strip()]"
 prefix="it=iter(map(int,sys.stdin.read().split()))\n"
 if pid==273:return prefix+'args=[next(it)]'
 if pid==220:return prefix+'n=next(it);args=[[next(it) for _ in range(n)],next(it),next(it)]'
 if pid in (56,57,986):return prefix+'def read():\n return [[next(it),next(it)] for _ in range(next(it))]\nargs=[read()'+(',read()' if pid==986 else ',[next(it),next(it)]' if pid==57 else '')+']'
 if pid in MATRICES:return prefix+'m,n=next(it),next(it);args=[[[next(it) for _ in range(n)] for _ in range(m)]]'+(';args.extend(next(it) for _ in range('+str(1 if pid==1314 else 3)+'))' if pid in (1314,733) else '')
 return prefix+'n=next(it)\ndef read():\n return [[next(it),next(it)] for _ in range(next(it))]\nargs=[n,read(),read()]'

EDGE={220:[[[1,2,3,1],3,0],[[1,5,9,1,5,9],2,3],[[-1,-1],1,0],[[0,3],1,3]],273:[[123],[0],[1000],[40],[1000001],[2147483647]],1023:[[['FooBar','FooBarTest','FootBall','FrameBuffer','ForceFeedBack'],'FB'],[['Ab','Acb','AB','A'],'Ab']],56:[[[[1,3],[2,6],[8,10],[15,18]]],[[[1,4],[4,5]]],[[[4,7],[1,4]]],[[[0,0],[0,0]]]],57:[[[[1,3],[6,9]],[2,5]],[[[1,4]],[4,5]],[[],[0,0]]],986:[[[[0,2],[5,10],[13,23],[24,25]],[[1,5],[8,12],[15,24],[25,26]]],[[[1,3]],[[3,5]]],[[[1,3]],[]]],1314:[[[[1,2,3],[4,5,6],[7,8,9]],1],[[[1]],100]],733:[[[[1,1,1],[1,1,0],[1,0,1]],1,1,2],[[[0,0],[0,0]],0,0,0]],286:[[[[INF,-1,0,INF],[INF,INF,INF,-1],[INF,-1,INF,-1],[0,-1,INF,INF]]],[[[0,INF,0]]],[[[-1]]],[[[INF]]]],542:[[[[0,0,0],[0,1,0],[1,1,1]]],[[[0,1],[1,1]]],[[[0,1,0]]]],1129:[[3,[[0,1],[1,2]],[]],[2,[],[[0,1]]],[3,[[0,1]],[[1,2]]],[1,[[0,0]],[[0,0]]]],1462:[[2,[[1,0]],[[0,1],[1,0]]],[3,[[0,1],[1,2]],[[0,2],[2,0]]],[2,[],[[0,1]]]]}

PRESSURE={
220:[([list(range(0,10**9,10000)),100000,9999],0),([[-10**9,10**9]*50000,1,10**9],0)],
273:[([2147483647],'Two Billion One Hundred Forty Seven Million Four Hundred Eighty Three Thousand Six Hundred Forty Seven')],
1023:[([['A'*100]*50+['A'*99+'B']*50,'A'*100],[1]*50+[0]*50)],
56:[([[[i,i+1] for i in range(10000)]],[[0,10000]])],
57:[([[[2*i,2*i] for i in range(10000)],[0,100000]],[[0,100000]])],
986:[([[[i*1000000,i*1000000+500000] for i in range(1000)],[[i*1000000+500000,i*1000000+999999] for i in range(1000)]],[[i*1000000+500000]*2 for i in range(1000)])],
1314:[([[[100]*100 for _ in range(100)],100],[[1000000]*100 for _ in range(100)])],
733:[([[[0]*50 for _ in range(50)],0,0,65535],[[65535]*50 for _ in range(50)])],
286:[([[[0]+[INF]*249]+[[INF]*250 for _ in range(249)]],[[i+j for j in range(250)] for i in range(250)]),([[[INF]*250 for _ in range(250)]],[[INF]*250 for _ in range(250)])],
542:[([[[0]+[1]*9999]],[list(range(10000))]),([[[0]]+[[1] for _ in range(9999)]],[[i] for i in range(10000)])],
1129:[([100,[[i,i+1] for i in range(0,99,2)]+[[99,99]]*350,[[i,i+1] for i in range(1,99,2)]+[[99,99]]*351],list(range(100)))],
1462:[([100,[[i,j] for i in range(100) for j in range(i+1,100)],[[i,j] for i in range(100) for j in range(100) if i!=j]+[[0,99]]*100],[int(i<j) for i in range(100) for j in range(100) if i!=j]+[1]*100)]
}

META={220:('containsNearbyAlmostDuplicate','存在近邻近值重复','Nearby Almost Duplicates','判断是否存在不同下标i,j，同时满足|i-j|≤indexDiff且|nums[i]-nums[j]|≤valueDiff。','Decide whether distinct indices i,j satisfy both |i-j|≤indexDiff and |nums[i]-nums[j]|≤valueDiff.'),273:('numberToWords','整数转英文','Integer to English Words','把非负整数转为英文词语，每词首字母大写、单空格分隔；不写and或连字符，无首尾空格。使用Hundred、Thousand、Million、Billion，0写Zero。例如123为One Hundred Twenty Three，40为Forty。','Spell the nonnegative integer in English with capitalized words separated by single spaces, without and, hyphens or surrounding spaces. Use Hundred, Thousand, Million and Billion; zero is Zero. For example, 123 is One Hundred Twenty Three and 40 is Forty.'),1023:('camelMatch','驼峰式匹配','Camelcase Matching','仅允许向pattern任意位置插入小写英文字母，判断能否得到每个query，按查询顺序输出0或1。','For each query, decide whether inserting only lowercase English letters anywhere into pattern can produce it. Return 0 or 1 in query order.'),56:('merge','合并重叠区间','Merge Intervals','合并所有相交闭区间；接触端点也相交。输出覆盖完全相同区域的最大不重叠区间，区间之间次序不限。','Merge all overlapping closed intervals, including intervals touching at endpoints. Return maximal disjoint intervals covering exactly the original region; interval order is arbitrary.'),57:('insert','插入区间','Insert Interval','原区间已按起点递增且互不相交，插入新闭区间并合并所有相交部分。输出必须仍按起点递增。','Insert a new closed interval into intervals sorted by start and pairwise disjoint, merging overlaps. Return the intervals in increasing start order.'),986:('intervalIntersection','两组区间交集','Interval List Intersections','两组闭区间各自递增且互不相交，求两组的所有交集区间，包含仅交于一个端点的情况。结果区间次序不限。','Each list contains sorted pairwise-disjoint closed intervals. Return all interval intersections, including single-point intersections. Result interval order is arbitrary.'),1314:('matrixBlockSum','矩阵区域和','Matrix Block Sum','结果[i][j]是所有满足|r-i|≤k、|c-j|≤k且在矩阵内的元素之和，边界处截断窗口。','At (i,j), sum all in-bounds cells (r,c) with |r-i|≤k and |c-j|≤k, clipping the window at matrix borders.'),733:('floodFill','图像洪水填充','Flood Fill','从(sr,sc)出发，将通过上下左右同色路径可达的像素全部改为color，其余像素不变。','Starting at (sr,sc), recolor every pixel reachable through a four-direction path of the original color; leave all other pixels unchanged.'),286:('wallsAndGates','墙与门','Walls and Gates','-1表示墙，0表示门，2147483647表示空房。将空房更新为绕过墙、上下左右到最近门的最少步数；不可达保持2147483647，墙和门不变。','Cells are walls (-1), gates (0), or empty rooms (2147483647). Replace each empty room with the shortest four-direction distance to any gate without crossing walls; unreachable rooms remain 2147483647. Walls and gates retain their values.'),542:('updateMatrix','到零的最近距离','Distance to Nearest Zero','对每个格子，返回上下左右移动到任意0格子的最少步数。','For every cell, return the fewest four-direction steps to any zero cell.'),1129:('shortestAlternatingPaths','交替颜色最短路径','Shortest Alternating Paths','有向图的边分红蓝，可含自环和重边。从0出发求到各点的最短路，连续边颜色必须不同，首条边颜色不限；不可达为-1，起点距离0。','Directed edges are red or blue and may include loops or parallel edges. From vertex 0, find shortest paths with alternating consecutive edge colors, allowing either initial color. Return -1 for unreachable vertices and 0 for the source.'),1462:('checkIfPrerequisite','课程先修查询','Prerequisite Queries','边[a,b]表示a必须先于b修读，包括经多条边的间接先修。对每个查询[u,v]输出u是否为v的先修课程，结果保持查询顺序。','An edge [a,b] means a must precede b. Include indirect prerequisites through multiple edges. For each [u,v], report whether u is a prerequisite of v in query order.')}
INPUT={220:('第一行n，第二行n个整数，最后输入indexDiff和valueDiff。2≤n≤100000，值[-1000000000,1000000000]，1≤indexDiff≤n，0≤valueDiff≤1000000000。','Give n, then n integers, then indexDiff and valueDiff. 2≤n≤100000, values in [-1000000000,1000000000], 1≤indexDiff≤n, 0≤valueDiff≤1000000000.'),273:('一个整数num，0≤num≤2147483647。','One integer num, 0≤num≤2147483647.'),1023:('第一行查询数q，随后q行各一个query，最后一行pattern。1≤q≤100，每个字符串长度1–100，仅含大小写英文字母。','First give query count q, then q query lines, then pattern on its own line. 1≤q≤100; all strings contain only English letters and have length 1–100.'),56:('第一行区间数n，随后n行各输入start end。1≤n≤10000，0≤start≤end≤10000；输入无序且可重复。','First give interval count n, then n lines start end. 1≤n≤10000, 0≤start≤end≤10000; input may be unsorted and contain duplicates.'),57:('第一行n，随后n行原区间，最后一行新start end。0≤n≤10000，所有端点0–100000，start≤end；原区间递增且相邻前end严格小于后start。','First give n, then n original interval lines, then the new start end. 0≤n≤10000; endpoints are 0–100000 with start≤end. Original intervals are sorted and each previous end is strictly below the next start.'),986:('依次输入两组区间，每组先输入数量n，再输入n行start end。每组0–1000个，总数至少1；0≤start<end≤1000000000，每组相邻前end严格小于后start。','Supply two interval lists, each as its count followed by start end lines. Each has 0–1000 intervals and total count is at least one. 0≤start<end≤1000000000; each previous end is strictly below the next start.'),1314:('先输入m n，再输入m行、每行n个整数，最后输入k。1≤m,n,k≤100，元素1–100。','Give m n, then m rows of n integers, then k. 1≤m,n,k≤100 and entries are 1–100.'),733:('先输入m n，再输入m行、每行n个整数，最后输入sr sc color。1≤m,n≤50，元素和color在0–65535；0≤sr<m，0≤sc<n。','Give m n, then m rows of n integers, then sr sc color. 1≤m,n≤50; entries and color are 0–65535; 0≤sr<m and 0≤sc<n.'),286:('先输入m n，再输入m行、每行n个整数。1≤m,n≤250；元素只能是-1、0或2147483647，不保证存在门。','Give m n and m rows of n integers. 1≤m,n≤250; entries are only -1, 0 or 2147483647. A gate need not exist.'),542:('先输入m n，再输入m行、每行n个0或1。1≤m,n≤10000，1≤m*n≤10000，至少一个0。','Give m n and m rows of n binary integers. 1≤m,n≤10000, 1≤m*n≤10000, with at least one zero.'),1129:('先输入节点数n，再输入红边数量及每条红边的u v，再输入蓝边数量及每条蓝边的u v。1≤n≤100，每色0–400条边，端点0–n-1，允许自环和重复边。','Give n, then the red-edge count and red u v pairs, then the blue-edge count and blue u v pairs. 1≤n≤100, 0–400 edges per color, endpoints 0–n-1; loops and duplicate edges are allowed.'),1462:('先输入课程数n，再输入先修边数及各a b，再输入查询数及各u v。2≤n≤100，边数0–n(n-1)/2，边无重复、无自环、无环。查询1–10000条，可重复；各端点0–n-1，每对端点不同。','Give n, then prerequisite count and a b pairs, then query count and u v pairs. 2≤n≤100, 0–n(n-1)/2 unique prerequisite edges with no loops or cycles. There are 1–10000 queries, possibly repeated. All endpoints are 0–n-1 and each pair has distinct endpoints.')}
WRONG={220:('将值差上界误写严格小于','忽略下标距离限制'),273:('丢弃千位以上部分','把Forty拼为Fourty'),1023:('允许插入大写字母','只比较大写字母序列'),56:('相接端点不合并','未先排序'),57:('相接端点不合并','直接追加后未排序'),986:('遗漏单点交集','每轮同时前进两组'),1314:('窗口半径少一','仅累加同一行'),733:('错误连通对角像素','修改所有同色像素'),286:('忽略墙直接用曼哈顿距离','只使用第一个门'),542:('错误允许对角移动','只使用第一个零'),1129:('忽略颜色限制','只允许红色作为首边'),1462:('只检查直接先修','颠倒先修方向')}

def make(pid):
 method,zh,en,dz,de=META[pid];iz,ie=INPUT[pid];kind='integer-row-set' if pid in (56,986) else 'integer-rows' if pid in ROWS else 'string' if pid==273 else 'integer' if pid==220 else 'integer-array'
 oz,oe=('第一行行数；随后每行先输出长度，再输出本行整数。例如[[1,3],[5,8]]输出2\n2 1 3\n2 5 8。','Print the row count, then each row as its length followed by its integers. Example [[1,3],[5,8]]: 2\n2 1 3\n2 5 8.') if pid in ROWS else ('输出一行英文原文。','Print the English text on one line.') if pid==273 else ('输出一个整数，1表示存在，0表示不存在。','Print one integer: 1 if a qualifying pair exists, otherwise 0.') if pid==220 else ('第一行元素数量，之后输出整数数组，保持输入查询或节点编号次序，判断值用0或1。','Print the element count and then the integer array in query or vertex-index order; boolean answers use 0 or 1.')
 if pid in (56,986):oz+='行之间顺序不限，不得重复行；行内端点按start end顺序。';oe+=' Row order is arbitrary, duplicate rows are forbidden, and each row retains start end order.'
 helper='from collections import deque\nINF='+str(INF)+'\nONES='+repr(ONES)+'\nTENS='+repr(TENS)+'\n'+inspect.getsource(fast)
 emit='print(len(result))\nfor row in result:print(len(row),*row)' if pid in ROWS else 'print(result)' if pid in (273,220) else 'print(len(result));print(*result)'
 spec=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='困难' if pid in (220,273) else '简单' if pid==733 else '中等',resultKind=kind,outputLimit=1024 if pid==286 else 256,edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[dict(name=name,source='import sys\n'+helper+'\n'+parse(pid)+f'\nresult=fast({pid},args,{i+1})\n'+emit+'\n') for i,name in enumerate(WRONG[pid])])
 if pid in (1023,1462):spec['resultAdapter']='boolean-array'
 if pid==286:spec['resultAdapter']='arg0'
 return spec
PROBLEMS={pid:make(pid) for pid in IDS}
