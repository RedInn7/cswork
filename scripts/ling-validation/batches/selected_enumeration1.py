"""Authored exhaustive-output tasks: row ordering/multiplicity follow each problem."""
import inspect,itertools,math,string
from collections import Counter,deque
from tree_codec import from_level_order,to_level_order,TreeNode,valid_tree
IDS=[15,18,78,77,46,90,47,39,40,216,491,254,113,417,336,1192]
BAGS={15,18,78,77,90,39,40,216,254,1192}

def normalize(pid,rows):
 return sorted(tuple(sorted(row)) if pid in BAGS else tuple(row) for row in rows)

def oracle(pid,a):
 x=a[0]
 if pid in (15,18):
  count=3 if pid==15 else 4;target=0 if pid==15 else a[1]
  return [list(t) for t in sorted({tuple(sorted(v)) for v in itertools.combinations(x,count) if sum(v)==target})]
 if pid in (78,90):return [list(t) for t in sorted({tuple(sorted(x[i] for i in range(len(x)) if mask>>i&1)) for mask in range(1<<len(x))})]
 if pid==77:return [list(t) for t in itertools.combinations(range(1,x+1),a[1])]
 if pid in (46,47):return [list(t) for t in sorted(set(itertools.permutations(x)))]
 if pid==39:
  vals=sorted(x);out=[]
  # Independent integer multiplicity vectors, not path search over candidates.
  for counts in itertools.product(*(range(a[1]//v+1) for v in vals)):
   if sum(v*k for v,k in zip(vals,counts))==a[1]:out.append([v for v,k in zip(vals,counts) for _ in range(k)])
  return out
 if pid==40:return [list(t) for t in sorted({tuple(sorted(x[i] for i in range(len(x)) if mask>>i&1)) for mask in range(1<<len(x)) if sum(x[i] for i in range(len(x)) if mask>>i&1)==a[1]})]
 if pid==216:return [list(t) for t in itertools.combinations(range(1,10),x) if sum(t)==a[1]]
 if pid==491:
  result=set()
  for mask in range(1<<len(x)):
   t=tuple(x[i] for i in range(len(x)) if mask>>i&1)
   if len(t)>=2 and all(u<=v for u,v in zip(t,t[1:])):result.add(t)
  return [list(t) for t in sorted(result)]
 if pid==254:
  # Enumerate multiplicities of all proper divisors using a product-state DP.
  divisors=[v for v in range(2,x) if x%v==0];states={1:{()}}
  for v in divisors:
   for product in sorted(list(states)):
    rows=list(states[product]);p=product;k=0
    while p*v<=x and x%(p*v)==0:
     p*=v;k+=1
     states.setdefault(p,set()).update(row+(v,)*k for row in rows)
  return [list(row) for row in sorted(states.get(x,set())) if len(row)>1]
 if pid==113:
  if not x:return []
  # Independent slot/path representation, without constructing TreeNode objects.
  paths=[(x[0],)];children=[0];slots=deque([(0,0),(0,1)])
  for value in x[1:]:
   parent,side=slots.popleft()
   if value is not None:
    i=len(paths);paths.append(paths[parent]+(value,));children.append(0);children[parent]+=1;slots.extend(((i,0),(i,1)))
  return [list(p) for p,c in zip(paths,children) if c==0 and sum(p)==a[1]]
 if pid==417:
  m,n=len(x),len(x[0]);out=[]
  for i in range(m):
   for j in range(n):
    seen={(i,j)};q=[(i,j)]
    while q:
     u,v=q.pop()
     for p,t in ((u-1,v),(u+1,v),(u,v-1),(u,v+1)):
      if 0<=p<m and 0<=t<n and (p,t) not in seen and x[p][t]<=x[u][v]:seen.add((p,t));q.append((p,t))
    if any(u==0 or v==0 for u,v in seen) and any(u==m-1 or v==n-1 for u,v in seen):out.append([i,j])
  return out
 if pid==336:return [[i,j] for i,u in enumerate(x) for j,v in enumerate(x) if i!=j and u+v==(u+v)[::-1]]
 if pid==1192:
  out=[]
  for skip,edge in enumerate(a[1]):
   reached={0}
   while True:
    more={v for k,(u,v) in enumerate(a[1]) if k!=skip and u in reached}|{u for k,(u,v) in enumerate(a[1]) if k!=skip and v in reached}
    more-=reached
    if not more:break
    reached|=more
   if len(reached)<x:out.append(sorted(edge))
  return out
 raise AssertionError(pid)

def fast(pid,a,bug=0):
 x=a[0]
 if pid in (15,18):
  values=sorted(x);size=3 if pid==15 else 4;target=0 if pid==15 else a[1];out=[]
  def search(start,k,total,path):
   if k==2:
    l,r=start,len(values)-1
    while l<r:
     value=values[l]+values[r]
     if value==total:
      out.append(path+[values[l],values[r]]);l+=1;r-=1
      while l<r and values[l]==values[l-1]:l+=1
      while l<r and values[r]==values[r+1]:r-=1
     elif value<total:l+=1
     else:r-=1
    return
   for i in range(start,len(values)-k+1):
    if i>start and values[i]==values[i-1]:continue
    search(i+1,k-1,total-values[i],path+[values[i]])
  if bug==1:
   # Incorrect set conversion loses the multiplicity needed within a tuple.
   values=sorted(set(values))
  search(0,size,target,[])
  if bug==2:return out[:1]
  return out
 if pid in (78,90):
  out=[[]]
  for value in sorted(x):out+= [row+[value] for row in out]
  if pid==90 and bug!=1:out=[list(t) for t in sorted(set(map(tuple,out)))]
  if pid==78 and bug==1:out=[row for row in out if row]
  if bug==2:out=[row for row in out if len(row)<=1]
  return out
 if pid==77:
  out=[]
  def choose(start,path):
   if len(path)==a[1]:out.append(path);return
   for v in range(start,x+(0 if bug==1 else 1)):choose(v+1,path+[v])
  choose(1,[]);return out[:1] if bug==2 else out
 if pid in (46,47):
  counts=Counter(x);out=[]
  def perm(path):
   if len(path)==len(x):out.append(path);return
   for v in counts:
    if counts[v]:counts[v]-=1;perm(path+[v]);counts[v]+=1
  perm([])
  if bug==1:
   if pid==47:return [list(p) for p in itertools.permutations(x)]
   return [sorted(x)]
  if bug==2:return [row for row in out if row[0]==min(x)]
  return out
 if pid in (39,40,216):
  vals=sorted(set(x)) if pid==39 else sorted(x) if pid==40 else list(range(1,10));target=a[1];out=[]
  def visit(start,total,path):
   if total==0:
    if pid!=216 or len(path)==x:out.append(path)
    return
   if pid==216 and len(path)>=x:return
   for i in range(start,len(vals)):
    if i>start and vals[i]==vals[i-1] and not (bug==2 and pid==40):continue
    if vals[i]>total:break
    reuse=(pid==39 and bug!=1) or (pid in (40,216) and bug==1)
    visit(i if reuse else i+1,total-vals[i],path+[vals[i]])
  visit(0,target,[])
  if bug==2 and pid!=40:return out[:1]
  return out
 if pid==491:
  out=[]
  def visit(start,path):
   if len(path)>=2:out.append(path)
   used=set()
   for i in range(start,len(x)):
    if x[i] in used and bug!=2:continue
    if path and (x[i]<=path[-1] if bug==1 else x[i]<path[-1]):continue
    used.add(x[i]);visit(i+1,path+[x[i]])
  visit(0,[]);return out
 if pid==254:
  out=[]
  def split(n,minimum,path):
   for d in range(minimum,math.isqrt(n)+1):
    if n%d==0:
     out.append(path+[d,n//d]);split(n//d,d,path+[d])
  split(x,2,[])
  if bug==1:return [[x]]+out
  if bug==2:return [row for row in out if len(row)==2]
  return out
 if pid==113:
  root=from_level_order(x);stack=[(root,[],0)] if root else [];out=[]
  while stack:
   u,path,total=stack.pop();path=path+[u.val];total+=u.val
   if total==a[1] and (bug==1 or not u.left and not u.right):out.append(path)
   if u.right:stack.append((u.right,path,total))
   if u.left:stack.append((u.left,path,total))
  return [list(row) for row in set(map(tuple,out))] if bug==2 else out
 if pid==417:
  m,n=len(x),len(x[0])
  def reach(starts):
   seen=set(starts);q=deque(starts)
   while q:
    i,j=q.popleft()
    for u,v in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
     if 0<=u<m and 0<=v<n and (u,v) not in seen and (x[u][v]>x[i][j] if bug==1 else x[u][v]>=x[i][j]):seen.add((u,v));q.append((u,v))
   return seen
  left=reach([(i,0) for i in range(m)]+[(0,j) for j in range(n)]);right=reach([(i,n-1) for i in range(m)]+[(m-1,j) for j in range(n)])
  return [list(p) for p in sorted(left|right if bug==2 else left&right)]
 if pid==336:
  lookup={w:i for i,w in enumerate(x)};out=set()
  for i,w in enumerate(x):
   for k in range(len(w)+1):
    l,r=w[:k],w[k:]
    if l==l[::-1] and r[::-1] in lookup:
     j=lookup[r[::-1]]
     if i!=j and (bug!=1 or len(x[j])==len(w)):out.add((j,i))
    if r==r[::-1] and l[::-1] in lookup:
     j=lookup[l[::-1]]
     if i!=j and (bug!=1 or len(x[j])==len(w)):out.add((i,j))
  return [list(p) for p in sorted(out) if bug!=2 or p[0]<p[1]]
 if pid==1192:
  graph=[[] for _ in range(x)]
  for i,(u,v) in enumerate(a[1]):graph[u].append((v,i));graph[v].append((u,i))
  depth=[-1]*x;low=[-1]*x;parent=[-1]*x;edgeid=[-1]*x;depth[0]=low[0]=0;clock=1;out=[];stack=[(0,0)]
  while stack:
   u,index=stack[-1]
   if index<len(graph[u]):
    v,e=graph[u][index];stack[-1]=(u,index+1)
    if e==edgeid[u]:continue
    if depth[v]<0:parent[v]=u;edgeid[v]=e;depth[v]=low[v]=clock;clock+=1;stack.append((v,0))
    else:low[u]=min(low[u],depth[v])
   else:
    stack.pop();p=parent[u]
    if p>=0:
     if low[u]>=depth[p] if bug==1 else low[u]>depth[p]:out.append([p,u])
     low[p]=min(low[p],low[u])
  if bug==2:return [[u,v] for u,v in a[1] if len(graph[u])==1 or len(graph[v])==1]
  return out
 raise AssertionError(pid)

def combo_count(values,target):
 ways=[1]+[0]*target
 for v in values:
  for total in range(v,target+1):ways[total]+=ways[total-v]
 return ways[target]

def random_args(pid,r):
 if pid in (15,18):return [[r.randint(-6,6) for _ in range(r.randint(3 if pid==15 else 1,9))]]+([r.randint(-10,10)] if pid==18 else [])
 if pid in (78,90,46,47,491):
  n=r.randint(1,7 if pid in (90,491) else 6 if pid in (78,47) else 5)
  return [r.sample(range(-6,7),n) if pid in (78,46) else [r.randint(-3,3) for _ in range(n)]]
 if pid==77:
  n=r.randint(1,8);return [n,r.randint(1,n)]
 if pid==39:return [r.sample(range(2,10),r.randint(1,4)),r.randint(1,15)]
 if pid==40:return [[r.randint(1,9) for _ in range(r.randint(1,10))],r.randint(1,20)]
 if pid==216:return [r.randint(2,9),r.randint(1,60)]
 if pid==254:return [r.randint(1,120)]
 if pid==113:
  n=r.randint(0,10)
  if not n:return [[],r.randint(-5,5)]
  root=TreeNode(r.randint(-3,3));available=[root]
  for _ in range(n-1):
   u=r.choice(available);side=r.choice([s for s in ('left','right') if getattr(u,s) is None]);v=TreeNode(r.randint(-3,3));setattr(u,side,v);available.append(v)
   if u.left and u.right:available.remove(u)
  return [to_level_order(root),r.randint(-8,8)]
 if pid==417:
  m,n=r.randint(1,5),r.randint(1,5);return [[[r.randint(0,5) for _ in range(n)] for _ in range(m)]]
 if pid==336:
  values=set()
  while len(values)<8:values.add(''.join(r.choice('abc') for _ in range(r.randint(0,5))))
  return [sorted(values)[:r.randint(1,8)]]
 if pid==1192:
  n=r.randint(2,9);edges={(i,r.randrange(i)) for i in range(1,n)}
  edges={tuple(sorted(e)) for e in edges}
  for u in range(n):
   for v in range(u+1,n):
    if r.random()<.2:edges.add((u,v))
  rows=[list(e) for e in sorted(edges)];r.shuffle(rows);return [n,rows]

def validate(pid,a):
 def num(v,low,high):assert type(v) is int and low<=v<=high
 x=a[0]
 domains={15:(3,3000,-100000,100000),18:(1,200,-10**9,10**9),78:(1,10,-10,10),90:(1,10,-10,10),46:(1,6,-10,10),47:(1,8,-10,10),39:(1,30,2,40),40:(1,100,1,50),491:(1,15,-100,100)}
 if pid in domains:
  lo,hi,mn,mx=domains[pid];assert type(x) is list and lo<=len(x)<=hi
  for v in x:num(v,mn,mx)
  if pid in (78,46,39):assert len(set(x))==len(x)
 if pid==18:num(a[1],-10**9,10**9)
 if pid==77:num(x,1,20);num(a[1],1,x)
 if pid in (39,40):
  num(a[1],1,40 if pid==39 else 30)
  if pid==39:assert combo_count(x,a[1])<150
 if pid==216:num(x,2,9);num(a[1],1,60)
 if pid==254:num(x,1,10**7)
 if pid==113:valid_tree(x,max_nodes=5000,min_value=-1000,max_value=1000);num(a[1],-1000,1000)
 if pid==417:
  assert type(x) is list and 1<=len(x)<=200 and type(x[0]) is list and 1<=len(x[0])<=200
  for row in x:
   assert type(row) is list and len(row)==len(x[0])
   for v in row:num(v,0,100000)
 if pid==336:
  assert type(x) is list and 1<=len(x)<=5000 and len(set(x))==len(x)
  for w in x:assert type(w) is str and 0<=len(w)<=300 and all(c in string.ascii_lowercase for c in w)
 if pid==1192:
  num(x,2,100000);assert type(a[1]) is list and x-1<=len(a[1])<=100000
  edges=set();parent=list(range(x))
  def find(i):
   while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
   return i
  for row in a[1]:
   assert type(row) is list and len(row)==2
   u,v=row;num(u,0,x-1);num(v,0,x-1);assert u!=v
   edge=tuple(sorted(row));assert edge not in edges;edges.add(edge);parent[find(u)]=find(v)
  assert len({find(i) for i in range(x)})==1
 return True

def encode(pid,a):
 x=a[0]
 if pid in (77,216):return f'{x} {a[1]}\n'
 if pid==254:return str(x)+'\n'
 if pid==336:return str(len(x))+'\n'+'\n'.join(x)+'\n'
 if pid==1192:return f'{x} {len(a[1])}\n'+''.join(f'{u} {v}\n' for u,v in a[1])
 if pid==417:return f'{len(x)} {len(x[0])}\n'+''.join(' '.join(map(str,row))+'\n' for row in x)
 return str(len(x))+'\n'+' '.join('null' if v is None else str(v) for v in x)+'\n'+(str(a[1])+'\n' if len(a)>1 else '')

def parse(pid):
 if pid==336:return "n=int(sys.stdin.readline());args=[[sys.stdin.readline().rstrip('\\n') for _ in range(n)]]"
 if pid==113:return "it=iter(sys.stdin.read().split());n=int(next(it));args=[[None if (v:=next(it))=='null' else int(v) for _ in range(n)],int(next(it))]"
 prefix="it=iter(map(int,sys.stdin.read().split()))\n"
 if pid in (77,216):return prefix+'args=[next(it),next(it)]'
 if pid==254:return prefix+'args=[next(it)]'
 if pid==1192:return prefix+'n,m=next(it),next(it);args=[n,[[next(it),next(it)] for _ in range(m)]]'
 if pid==417:return prefix+'m,n=next(it),next(it);args=[[[next(it) for _ in range(n)] for _ in range(m)]]'
 return prefix+'n=next(it);args=[[next(it) for _ in range(n)]]'+(';args.append(next(it))' if pid in (18,39,40) else '')

EDGE={15:[[[-1,0,1,2,-1,-4]],[[0,0,0]],[[-2,0,0,2,2]]],18:[[[1,0,-1,0,-2,2],0],[[2,2,2,2,2],8],[[10**9]*4,-294967296]],78:[[[1,2,3]],[[0]]],77:[[4,2],[1,1]],46:[[[1,2,3]],[[0,1]]],90:[[[1,2,2]],[[0]]],47:[[[1,1,2]],[[1,2,3]]],39:[[[2,3,6,7],7],[[2,3,5],8]],40:[[[10,1,2,7,6,1,5],8],[[2,5,2,1,2],5]],216:[[3,7],[3,9],[2,4]],491:[[[4,6,7,7]],[[1,1]]],254:[[12],[1],[16]],113:[[[5,4,8,11,None,13,4,7,2,None,None,5,1],22],[[1,2,2],3],[[1,2],1],[[],0]],417:[[[[1,2,2,3,5],[3,2,3,4,4],[2,4,5,3,1],[6,7,1,4,5],[5,1,1,2,4]]],[[[1,1],[1,1]]],[[[1,2],[2,3]]]],336:[[['abcd','dcba','lls','s','sssll']],[['','a','aa']],[['a','b']]],1192:[[4,[[0,1],[1,2],[2,0],[1,3]]],[5,[[0,1],[1,2],[2,3],[3,4]]],[3,[[0,1],[1,2],[2,0]]]]}

def prime_factor_groups(twos,fives):
 """Mathematical exponent-budget enumeration for the 10^7 pressure case."""
 out=[];pairs=sorted((2**i*5**j,i,j) for i in range(twos+1) for j in range(fives+1) if i+j)
 def walk(start,t,f,path):
  if t==f==0:
   if len(path)>1:out.append(path)
   return
  for k in range(start,len(pairs)):
   value,i,j=pairs[k]
   if i<=t and j<=f:walk(k,t-i,f-j,path+[value])
 walk(0,twos,fives,[]);return out

def repeated_path_pressure():
 root=TreeNode(0);u=root
 for _ in range(3000):u.right=TreeNode(0);u=u.right
 # Replace the final chain node by the root of a 1999-node complete subtree:
 # 3000 strict ancestors + 1999 nodes = 4999; add one ancestor for 5000.
 u.right=TreeNode(0);u=u.right
 nodes=[u]
 for i in range(1,1999):
  v=TreeNode(0);setattr(nodes[(i-1)//2],'left' if i%2 else 'right',v);nodes.append(v)
 return [to_level_order(root),0],[[0]*(3001+(i+1).bit_length()) for i in range(999,1999)]

def palindrome_pressure_words():
 words=[]
 for i in range(5000):
  digits=[];v=i
  for _ in range(3):digits.append(chr(97+v%26));v//=26
  words.append('a'+''.join(digits)+'a'*295+'b')
 return words

PRESSURE={15:[([[0]*3000],[[0,0,0]])],18:[([[0]*200,0],[[0,0,0,0]])],78:[([list(range(1,11))],[list(v) for k in range(11) for v in itertools.combinations(range(1,11),k)])],77:[([20,10],[list(v) for v in itertools.combinations(range(1,21),10)])],46:[([list(range(1,7))],[list(v) for v in itertools.permutations(range(1,7))])],90:[([[10]*10],[[10]*k for k in range(11)])],47:[([list(range(1,9))],[list(v) for v in itertools.permutations(range(1,9))])],39:[([list(range(11,41)),40],[[40]]+[[a,40-a] for a in range(11,21)]+[[a,b,40-a-b] for a in range(11,14) for b in range(a,(40-a)//2+1)])],40:[([[1]*100,30],[[1]*30])],216:[([9,60],[])],491:[([list(range(1,16))],[list(v) for k in range(2,16) for v in itertools.combinations(range(1,16),k)])],254:[([10000000],prime_factor_groups(7,7))],113:[repeated_path_pressure()],417:[([[[100000]*200 for _ in range(200)]],[[i,j] for i in range(200) for j in range(200)])],336:[([palindrome_pressure_words()],[])],1192:[([100000,[[i,i+1] for i in range(99999)]+[[0,2]]],[[i,i+1] for i in range(2,99999)])]}

META={15:('threeSum','三数之和','Three Sum','输出三个不同下标的值之和为0的所有三元组，按值去重。','Return all distinct value triples from three different indices that sum to zero.'),18:('fourSum','四数之和','Four Sum','输出四个不同下标的值之和为target的所有四元组，按值去重。','Return all distinct value quadruples from four different indices that sum to target.'),78:('subsets','全部子集','All Subsets','返回数组的全部子集，包含空集与完整集合。','Return every subset, including the empty and full subsets.'),77:('combine','组合枚举','Combinations','返回从整数1到n中选出k个不同整数的全部组合。','Return all combinations of k distinct integers chosen from 1 through n.'),46:('permute','全部排列','Permutations','输出使用所有输入元素各一次的全部排列，排列内次序有意义。','Return every permutation using each input element once; order within a permutation matters.'),90:('subsetsWithDup','含重复值的子集','Subsets with Duplicates','返回所有按值去重的子集，输入出现多次的值可以按实际次数选取，包含空集。','Return distinct value-multiset subsets, using repeated values up to their input multiplicities and including the empty subset.'),47:('permuteUnique','含重复值的排列','Unique Permutations','使用所有输入元素，输出按值序列去重的全部排列。','Return all distinct value-sequence permutations using every input element.'),39:('combinationSum','可重复选择的组合和','Reusable Combination Sum','每个候选值可使用任意次，返回总和为target的全部不同组合。','Each candidate can be used arbitrarily many times; return all distinct combinations summing to target.'),40:('combinationSum2','每项使用一次的组合和','Single-Use Combination Sum','每个输入位置最多使用一次，返回总和为target的全部不同值组合。','Use each input position at most once and return all distinct value combinations summing to target.'),216:('combinationSum3','一到九的组合和','Combination Sum from One to Nine','从1到9中选择恰好k个不同整数，总和为n，输出所有组合。','Choose exactly k distinct integers from 1 through 9 summing to n and return all combinations.'),491:('findSubsequences','非递减子序列','Nondecreasing Subsequences','返回长度至少2、保持原下标顺序且值非递减的全部不同子序列，相等值允许相邻。','Return all distinct nondecreasing subsequences of length at least two in original index order, allowing equal adjacent values.'),254:('getFactors','因数组合','Factor Combinations','返回由至少两个整数相乘得到n的全部因数组合，各因子在2到n-1之间。','Return every combination of at least two integer factors whose product is n, with each factor between 2 and n-1.'),113:('pathSum','根叶路径和','Root-to-Leaf Path Sums','返回从根到叶且节点值总和为targetSum的全部路径；每行按根到叶次序，不同节点路径即使值序列相同也分别保留。','Return all root-to-leaf paths summing to targetSum. Preserve root-to-leaf order within each row and retain separate node paths even when their value sequences coincide.'),417:('pacificAtlantic','太平洋大西洋水流','Pacific Atlantic Water Flow','水只能上下左右流向高度不高于当前的格子。太平洋接触上边与左边，大西洋接触下边与右边；输出能流入两洋的所有格子坐标[row,col]。','Water moves in four directions to cells of no greater height. The Pacific touches the top/left borders and the Atlantic the bottom/right borders. Return every [row,col] coordinate that can reach both.'),336:('palindromePairs','回文有序对','Palindrome Pairs','返回所有不同下标的有序对[i,j]，使words[i]+words[j]为回文串；[i,j]与[j,i]是不同答案。','Return every ordered pair of distinct indices [i,j] for which words[i]+words[j] is a palindrome; [i,j] and [j,i] are different answers.'),1192:('criticalConnections','关键连接','Critical Connections','给定连通无向简单图，输出删除后使图不连通的全部边；每条边的两个端点次序不限。','Given a connected undirected simple graph, return every edge whose removal disconnects it; either endpoint order is accepted.')}

INPUT={15:('第一行n，随后n个整数。3≤n≤3000，值[-100000,100000]。','Give n followed by n integers; 3≤n≤3000, values in [-100000,100000].'),18:('第一行n，随后n个整数，最后target。1≤n≤200，元素及target均在[-1000000000,1000000000]。','Give n, n integers, then target. 1≤n≤200; values and target lie in [-1000000000,1000000000].'),78:('第一行n，随后n个互异整数。1≤n≤10，值[-10,10]。','Give n then n distinct integers; 1≤n≤10, values in [-10,10].'),77:('两个整数n k，1≤n≤20，1≤k≤n。','Two integers n k, 1≤n≤20 and 1≤k≤n.'),46:('第一行n，随后n个互异整数。1≤n≤6，值[-10,10]。','Give n then n distinct integers; 1≤n≤6, values in [-10,10].'),90:('第一行n，随后n个整数。1≤n≤10，值[-10,10]，允许重复。','Give n then n integers; 1≤n≤10, values in [-10,10], possibly repeated.'),47:('第一行n，随后n个整数。1≤n≤8，值[-10,10]，允许重复。','Give n then n integers; 1≤n≤8, values in [-10,10], possibly repeated.'),39:('第一行候选数m，随后m个互异整数，最后target。1≤m≤30，候选值2–40，1≤target≤40；保证满足条件的不同组合少于150个。','Give candidate count m, m distinct integers, then target. 1≤m≤30, candidates are 2–40 and 1≤target≤40. Fewer than 150 distinct valid combinations are guaranteed.'),40:('第一行候选数m，随后m个整数，最后target。1≤m≤100，值1–50，1≤target≤30；候选值可以重复。','Give candidate count m, m integers, then target. 1≤m≤100, values are 1–50 and 1≤target≤30; candidates may repeat.'),216:('两个整数k n，2≤k≤9，1≤n≤60。','Two integers k n, 2≤k≤9 and 1≤n≤60.'),491:('第一行n，随后n个整数。1≤n≤15，值[-100,100]。','Give n then n integers; 1≤n≤15, values in [-100,100].'),254:('一个整数n，1≤n≤10000000。','One integer n, 1≤n≤10000000.'),113:('先输入层序标记数m，再输入m个整数或null，最后targetSum。只有非空父节点消耗后续两个孩子位置，去掉末尾null；空树m=0。节点数0–5000，节点值及targetSum均在[-1000,1000]。','Give level-order token count m, then m integers or null, then targetSum. Only non-null parents consume the following two child positions; omit trailing nulls and use m=0 for an empty tree. There are 0–5000 nodes; values and targetSum are in [-1000,1000].'),417:('先输入m n，再输入m行、每行n个高度。1≤m,n≤200，高度0–100000。','Give m n and m rows of n heights; 1≤m,n≤200, heights are 0–100000.'),336:('第一行单词数n，接下来n行每行一个单词；空行表示空串。1≤n≤5000，单词互不相同，长度0–300，仅小写英文字母。','Give word count n, then n word lines; an empty line represents the empty string. 1≤n≤5000, words are distinct, lengths are 0–300, and letters are lowercase English.'),1192:('第一行节点数n和边数m，随后m行端点u v。2≤n≤100000，n-1≤m≤100000，端点0–n-1，无自环、无重复无向边，并保证全图连通。','Give n and edge count m, then m endpoint pairs u v. 2≤n≤100000, n-1≤m≤100000, endpoints are 0–n-1. There are no loops or duplicate undirected edges, and the graph is connected.')}
WRONG={15:('先去重输入导致丢失可用重复值','只返回首个三元组'),18:('先去重输入导致丢失可用重复值','只返回首个四元组'),78:('遗漏空集','只返回长度至多一的子集'),77:('漏掉候选数字n','只返回首个组合'),46:('只返回排序后的排列','强制最小元素放在首位'),90:('重复子集未去重','只返回长度至多一的子集'),47:('重复排列未去重','强制最小元素放在首位'),39:('候选值错误限制只用一次','只返回首个组合'),40:('错误允许候选重复使用','同层重复候选未跳过'),216:('错误允许重复数字','只返回首个组合'),491:('把非递减写成严格递增','同层重复值未跳过'),254:('错误允许单因子n','遗漏三个及以上因子'),113:('非叶前缀也计为路径','错误合并值序列相同的路径'),417:('只允许逆向严格上坡','两洋可达取并集'),336:('仅寻找等长反转单词','遗漏反向有序配对'),1192:('桥条件错误使用大于等于','只报告连接叶子的边')}
LIMITS={15:65536,18:32768,78:64,77:8192,46:64,90:64,47:2048,39:64,40:1024,216:64,491:4096,254:2048,113:65536,417:512,336:65536,1192:2048}

def make(pid):
 method,zh,en,dz,de=META[pid];iz,ie=INPUT[pid];kind='integer-bag-row-set' if pid in BAGS else 'integer-row-multiset' if pid==113 else 'integer-row-set'
 oz='第一行输出行数；随后每行先写长度，再写该行整数。空结果写0；包含空行结果时该行写长度0。'
 oe='Print the row count, then each row as its length followed by its integers. An empty result is 0; an empty member row is represented by length 0.'
 if pid in BAGS:oz+='行序及行内元素次序不限，但保留元素重复次数，不得重复输出等价行。';oe+=' Both outer and inner order are arbitrary, but preserve element multiplicities and do not repeat equivalent rows.'
 elif pid==113:oz+='外层行序不限，行内必须按根到叶次序；重复值序列的不同路径需重复输出。';oe+=' Outer order is arbitrary, inner order must run root to leaf, and repeated value sequences from different paths must appear with their multiplicity.'
 else:oz+='外层行序不限，行内次序必须符合题意，不得重复行。';oe+=' Outer order is arbitrary, inner order must follow the problem, and duplicate rows are forbidden.'
 helper='import itertools,math\nfrom collections import Counter,deque\n'+inspect.getsource(TreeNode)+'\n'+inspect.getsource(from_level_order)+'\n'+inspect.getsource(fast)
 spec=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='困难' if pid in (336,1192) else '中等',resultKind=kind,outputLimit=LIMITS[pid],edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[dict(name=name,source='import sys\n'+helper+'\n'+parse(pid)+f'\nresult=fast({pid},args,{i+1})\nprint(len(result))\nfor row in result:print(len(row),*row)\n') for i,name in enumerate(WRONG[pid])])
 if pid==113:spec['treeArgs']=[0]
 if pid==417:spec['resultAdapter']='integer-rows'
 return spec
PROBLEMS={pid:make(pid) for pid in IDS}
