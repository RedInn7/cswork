"""Authored multi-answer tasks; fixed semantic judges validate alternatives."""
import inspect,itertools,json,heapq,string
from collections import Counter,deque
from functools import lru_cache
from tree_codec import TreeNode,from_level_order,to_level_order,valid_tree
IDS=[5,1044,1092,1249,767,1405,162,324,870,368,210,269,373,2392,701,108,450,109,1171]
STRINGS={5,1044,1092,1249,767,1405,269}
TREES={701,108,450,109}

def balanced(values):
 if not values:return []
 root=TreeNode();todo=[(root,0,len(values))]
 while todo:
  u,l,r=todo.pop();m=(l+r)//2;u.val=values[m]
  if l<m:u.left=TreeNode();todo.append((u.left,l,m))
  if m+1<r:u.right=TreeNode();todo.append((u.right,m+1,r))
 return to_level_order(root)

def topo(n,edges,offset=0):
 graph=[set() for _ in range(n)];degree=[0]*n
 for u,v in edges:
  u-=offset;v-=offset
  if v not in graph[u]:graph[u].add(v);degree[v]+=1
 q=deque(i for i,d in enumerate(degree) if not d);out=[]
 while q:
  u=q.popleft();out.append(u+offset)
  for v in sorted(graph[u]):
   degree[v]-=1
   if not degree[v]:q.append(v)
 return out if len(out)==n else []

def alien_edges(words):
 edges=[];chars=sorted(set(''.join(words)))
 for a,b in zip(words,words[1:]):
  for u,v in zip(a,b):
   if u!=v:edges.append((chars.index(u),chars.index(v)));break
  else:
   if len(a)>len(b):return chars,None
 return chars,edges

def oracle(pid,a):
 x=a[0]
 if pid==5:return max((x[i:j] for i in range(len(x)) for j in range(i+1,len(x)+1) if x[i:j]==x[i:j][::-1]),key=len)
 if pid==1044:return max(['']+[x[i:j] for i in range(len(x)) for j in range(i+1,len(x)+1) if x.find(x[i:j],i+1)>=0],key=len)
 if pid==1092:
  @lru_cache(None)
  def solve(i,j):
   if i==len(x):return a[1][j:]
   if j==len(a[1]):return x[i:]
   if x[i]==a[1][j]:return x[i]+solve(i+1,j+1)
   return min(x[i]+solve(i+1,j),a[1][j]+solve(i,j+1),key=len)
  return solve(0,0)
 if pid==1249:
  positions=[i for i,c in enumerate(x) if c in '()'];answers=[]
  for mask in range(1<<len(positions)):
   remove={p for i,p in enumerate(positions) if mask>>i&1};s=''.join(c for i,c in enumerate(x) if i not in remove);depth=0
   for c in s:
    depth+=(c=='(')-(c==')')
    if depth<0:break
   else:
    if depth==0:answers.append(s)
  return max(answers,key=len)
 if pid==767:
  return next((''.join(p) for p in itertools.permutations(x) if all(u!=v for u,v in zip(p,p[1:]))),'')
 if pid==1405:
  @lru_cache(None)
  def solve(left,last):
   options=['']
   for i,c in enumerate('abc'):
    if left[i] and last!=c*2:
     other=list(left);other[i]-=1;options.append(c+solve(tuple(other),(last+c)[-2:]))
   return max(options,key=len)
  return solve(tuple(a),'')
 if pid==162:return next(i for i,v in enumerate(x) if (i==0 or v>x[i-1]) and (i+1==len(x) or v>x[i+1]))
 if pid==324:return list(next(p for p in itertools.permutations(x) if all(p[i]>p[i-1] if i%2 else p[i]<p[i-1] for i in range(1,len(p)))))
 if pid==870:return list(max(itertools.permutations(x),key=lambda p:sum(u>v for u,v in zip(p,a[1]))))
 if pid==368:
  subsets=[[x[i] for i in range(len(x)) if mask>>i&1] for mask in range(1<<len(x))]
  return max((s for s in subsets if all(u%v==0 or v%u==0 for u,v in itertools.combinations(s,2))),key=len)
 if pid in (210,269,2392):
  def brute(nodes,edges):
   for order in itertools.permutations(nodes):
    pos={v:i for i,v in enumerate(order)}
    if all(pos[u]<pos[v] for u,v in edges):return list(order)
   return []
  if pid==210:return brute(range(x),[(v,u) for u,v in a[1]])
  if pid==269:
   chars,edges=alien_edges(x)
   if edges is None:return ''
   order=brute(range(len(chars)),edges);return ''.join(chars[i] for i in order)
  rows=brute(range(1,x+1),a[1]);cols=brute(range(1,x+1),a[2])
  if not rows or not cols:return []
  out=[[0]*x for _ in range(x)]
  for i,v in enumerate(rows):out[i][cols.index(v)]=v
  return out
 if pid==373:return [list(v) for v in sorted(itertools.product(x,a[1]),key=sum)[:a[2]]]
 if pid in TREES:
  values=sorted(v for v in x if v is not None)
  if pid==701:values.append(a[1]);values.sort()
  if pid==450 and a[1] in values:values.remove(a[1])
  # A recursively chosen lower median differs from the iterative upper-median
  # reference model while meeting the same balance and inorder properties.
  def build(vals):
   if not vals:return None
   m=(len(vals)-1)//2;return TreeNode(vals[m],build(vals[:m]),build(vals[m+1:]))
  return to_level_order(build(values))
 if pid==1171:
  pending=[tuple(x)];seen=set(pending);terminal=[]
  while pending:
   current=pending.pop();found=False
   for i in range(len(current)):
    for j in range(i+1,len(current)+1):
     if sum(current[i:j])==0:
      found=True;row=current[:i]+current[j:]
      if row not in seen:seen.add(row);pending.append(row)
   if not found:terminal.append(current)
  return list(min(terminal))
 raise AssertionError(pid)

def fast(pid,a,bug=0):
 x=a[0]
 if pid==5:
  answer=''
  for i in range(len(x)):
   for l,r in ((i,i),(i,i+1)):
    if bug==1 and l!=r:continue
    while l>=0 and r<len(x) and x[l]==x[r]:
     if r-l+1>len(answer):answer=x[l:r+1]
     l-=1;r+=1
  return x if bug==2 else answer
 if pid==1044:
  if bug==1:return x[:len(x)//2] if x[:len(x)//2]==x[len(x)//2:] else ''
  # Exact verified rolling-hash search; hash collisions never establish equality.
  mod=(1<<61)-1;base=911382323;prefix=[0];power=[1]
  for c in x:prefix.append((prefix[-1]*base+ord(c))%mod);power.append(power[-1]*base%mod)
  def repeated(k):
   seen={}
   for i in range(len(x)-k+1):
    key=(prefix[i+k]-prefix[i]*power[k])%mod
    for j in seen.get(key,[]):
     if x[i:i+k]==x[j:j+k]:return x[i:i+k]
    seen.setdefault(key,[]).append(i)
   return None
  low,high=0,len(x);answer=''
  while low+1<high:
   mid=(low+high)//2;value=repeated(mid)
   if value is not None:low=mid;answer=value
   else:high=mid
  return x if bug==2 else answer
 if pid==1092:
  if bug==1:return x+a[1]
  m,n=len(x),len(a[1]);dp=[[0]*(n+1) for _ in range(m+1)]
  for i in range(m-1,-1,-1):
   for j in range(n-1,-1,-1):dp[i][j]=1+dp[i+1][j+1] if x[i]==a[1][j] else max(dp[i+1][j],dp[i][j+1])
  i=j=0;out=[]
  while i<m and j<n:
   if x[i]==a[1][j]:out.append(x[i]);i+=1;j+=1
   elif dp[i+1][j]>=dp[i][j+1]:out.append(x[i]);i+=1
   else:out.append(a[1][j]);j+=1
  return ''.join(out) if bug==2 else ''.join(out)+x[i:]+a[1][j:]
 if pid==1249:
  if bug==1:return ''.join(c for c in x if c not in '()')
  stack=[];removed=set()
  for i,c in enumerate(x):
   if c=='(':stack.append(i)
   elif c==')':
    if stack:stack.pop()
    else:removed.add(i)
  if bug!=2:removed.update(stack)
  return ''.join(c for i,c in enumerate(x) if i not in removed)
 if pid in (767,1405):
  counts=Counter(x) if pid==767 else dict(zip('abc',a));out=[]
  while True:
   choices=sorted(counts,key=lambda c:(-counts[c],c));chosen=None
   for c in choices:
    blocked=bool(out) and out[-1]==c if pid==767 else len(out)>=2 and out[-1]==out[-2]==c
    if counts[c] and (not blocked or bug==1):chosen=c;break
   if chosen is None:break
   out.append(chosen);counts[chosen]-=1
  result=''.join(out)
  if pid==767 and any(counts.values()):result=''
  return result[:-1] if bug==2 else result
 if pid==162:
  if bug==1:return 0
  if bug==2:return min(range(len(x)),key=x.__getitem__)
  l,r=0,len(x)-1
  while l<r:
   m=(l+r)//2
   if x[m]<x[m+1]:l=m+1
   else:r=m
  return l
 if pid==324:
  vals=sorted(x)
  if bug==1:return vals
  if bug==2:return vals[::2]+vals[1::2]
  middle=(len(vals)+1)//2;out=[0]*len(vals);out[::2]=vals[:middle][::-1];out[1::2]=vals[middle:][::-1];return out
 if pid==870:
  if bug==1:return sorted(x)
  if bug==2:return x[:]
  values=deque(sorted(x));out=[0]*len(x)
  for i in sorted(range(len(x)),key=lambda i:a[1][i],reverse=True):out[i]=values.pop() if values[-1]>a[1][i] else values.popleft()
  return out
 if pid==368:
  values=sorted(x);chains=[]
  for i,v in enumerate(values):chains.append(max((chains[j] for j in range(i) if v%values[j]==0),key=len,default=[])+[v])
  if bug==1:return values
  if bug==2:return [values[0]]
  return max(chains,key=len)
 if pid==210:
  order=topo(x,[(v,u) for u,v in a[1]])
  if bug==1:return list(range(x))
  if bug==2:return order[::-1]
  return order
 if pid==269:
  chars,edges=alien_edges(x)
  if bug==1:return ''.join(chars)
  if edges is None:return ''
  out=topo(len(chars),edges)
  result=''.join(chars[i] for i in out)
  return result[::-1] if bug==2 else result
 if pid==373:
  if bug==1:return [[u,v] for u in x for v in a[1]][:a[2]]
  heap=[(x[i]+a[1][0],i,0) for i in range(min(len(x),a[2]))];heapq.heapify(heap);out=[]
  while heap and len(out)<a[2]:
   total,i,j=heapq.heappop(heap);out.append([x[i],a[1][j]])
   if j+1<len(a[1]):heapq.heappush(heap,(x[i]+a[1][j+1],i,j+1))
  return [list(row) for row in dict.fromkeys(map(tuple,out))] if bug==2 else out
 if pid==2392:
  rows=topo(x,a[1],1);cols=topo(x,a[2],1)
  if not rows or not cols:return []
  if bug==1:rows=rows[::-1]
  if bug==2:cols=cols[::-1]
  out=[[0]*x for _ in range(x)];positions={v:i for i,v in enumerate(cols)}
  for i,v in enumerate(rows):out[i][positions[v]]=v
  return out
 if pid in TREES:
  values=sorted(v for v in x if v is not None)
  if pid==701 and bug!=1:values.append(a[1]);values.sort()
  if pid==450 and a[1] in values and bug!=1:values.remove(a[1])
  if bug==1 and pid in (108,109):
   out=[]
   for v in values:
    if out:out.append(None)
    out.append(v)
   return out
  if bug==2:values=values[:-1]
  return balanced(values)
 if pid==1171:
  if bug==1:return [v for v in x if v!=0]
  if bug==2:
   out=[]
   for v in x:
    if out and out[-1]+v==0:out.pop()
    else:out.append(v)
   return out
  prefix=[0]
  for v in x:prefix.append(prefix[-1]+v)
  last={v:i for i,v in enumerate(prefix)};out=[];i=0
  while i<len(x):
   i=last[prefix[i]]
   if i<len(x):out.append(x[i]);i+=1
  return out
 raise AssertionError(pid)

def random_args(pid,r):
 if pid in (5,1044,1249,767):return [''.join(r.choice('ab12A' if pid==5 else '()ab' if pid==1249 else 'abc') for _ in range(r.randint(2 if pid==1044 else 1,7)))]
 if pid==1092:return [''.join(r.choice('abc') for _ in range(r.randint(1,6))) for _ in range(2)]
 if pid==1405:
  a=[r.randint(0,4) for _ in range(3)]
  return a if any(a) else [1,0,0]
 if pid==162:
  vals=[r.randint(-6,6)]
  for _ in range(r.randint(0,9)):vals.append(r.choice([v for v in range(-6,7) if v!=vals[-1]]))
  return [vals]
 if pid==324:
  while True:
   a=[[r.randint(0,4) for _ in range(r.randint(1,7))]];v=fast(pid,a)
   if all(v[i]>v[i-1] if i%2 else v[i]<v[i-1] for i in range(1,len(v))):return a
 if pid==870:
  n=r.randint(1,7);return [[r.randint(0,9) for _ in range(n)] for _ in range(2)]
 if pid==368:return [r.sample(range(1,40),r.randint(1,8))]
 if pid==210:
  n=r.randint(1,6);return [n,[[i,j] for i in range(n) for j in range(n) if i!=j and r.random()<.2]]
 if pid==269:return [[''.join(r.choice('abc') for _ in range(r.randint(1,4))) for _ in range(r.randint(1,6))]]
 if pid==373:
  x,y=[sorted(r.randint(-5,5) for _ in range(r.randint(1,6))) for _ in range(2)];return [x,y,r.randint(1,len(x)*len(y))]
 if pid==2392:
  k=r.randint(2,5);return [k]+[[r.sample(range(1,k+1),2) for _ in range(r.randint(1,7))] for _ in range(2)]
 if pid in TREES:
  values=sorted(r.sample(range(-20,21),r.randint(0 if pid!=108 else 1,9)))
  if pid==109:values=sorted(r.randint(-3,3) for _ in range(r.randint(0,9)))
  if pid==108 or pid==109:return [values]
  target=r.choice([v for v in range(-21,22) if v not in values]) if pid==701 else r.randint(-21,21)
  return [balanced(values),target]
 if pid==1171:return [[r.randint(-3,3) for _ in range(r.randint(1,8))]]

def validate(pid,a):
 def num(v,lo,hi):assert type(v) is int and lo<=v<=hi
 def arr(v,lo,hi,mn,mx):
  assert type(v) is list and lo<=len(v)<=hi
  for z in v:num(z,mn,mx)
 x=a[0]
 if pid in STRINGS-{1405,269}:
  for s in a:
   limit={5:1000,1044:30000,1092:1000,1249:100000,767:500}[pid];allowed=string.ascii_letters+string.digits if pid==5 else string.ascii_lowercase+'()' if pid==1249 else string.ascii_lowercase
   assert type(s) is str and (2 if pid==1044 else 1)<=len(s)<=limit and all(c in allowed for c in s)
 if pid==1405:
  assert len(a)==3
  for v in a:num(v,0,100)
  assert sum(a)>0
 if pid==162:arr(x,1,1000,-2**31,2**31-1);assert all(u!=v for u,v in zip(x,x[1:]))
 if pid==324:
  arr(x,1,50000,0,5000);v=fast(pid,a);assert all(v[i]>v[i-1] if i%2 else v[i]<v[i-1] for i in range(1,len(v)))
 if pid==870:
  arr(x,1,100000,0,10**9);arr(a[1],len(x),len(x),0,10**9)
 if pid==368:arr(x,1,1000,1,2*10**9);assert len(set(x))==len(x)
 if pid in (210,2392):
  num(x,1 if pid==210 else 2,2000 if pid==210 else 400)
  for edges in a[1:]:
   assert type(edges) is list and (0 if pid==210 else 1)<=len(edges)<=(x*(x-1) if pid==210 else 10000)
   for row in edges:arr(row,2,2,0 if pid==210 else 1,x-1 if pid==210 else x);assert row[0]!=row[1]
   if pid==210:assert len(set(map(tuple,edges)))==len(edges)
 if pid==269:
  assert type(x) is list and 1<=len(x)<=100
  for s in x:assert type(s) is str and 1<=len(s)<=100 and all(c in string.ascii_lowercase for c in s)
 if pid==373:
  for v in a[:2]:arr(v,1,100000,-10**9,10**9);assert all(i<=j for i,j in zip(v,v[1:]))
  num(a[2],1,min(10000,len(x)*len(a[1])))
 if pid in (701,450):
  lim=10**8 if pid==701 else 100000;valid_tree(x,max_nodes=10000,min_value=-lim,max_value=lim,bst=True);num(a[1],-lim,lim)
  if pid==701:assert a[1] not in x
 if pid==108:arr(x,1,10000,-10000,10000);assert all(u<v for u,v in zip(x,x[1:]))
 if pid==109:arr(x,0,20000,-100000,100000);assert all(u<=v for u,v in zip(x,x[1:]))
 if pid==1171:arr(x,1,1000,-1000,1000)
 return True

def encode(pid,a):return json.dumps(a,separators=(',',':'),ensure_ascii=True)+'\n'
PARSE='args=json.load(sys.stdin)'
EDGE={5:[['babad'],['cbbd'],['a']],1044:[['banana'],['aaaaa'],['abcd']],1092:[['abac','cab'],['abc','abc'],['a','b']],1249:[['lee(t(c)o)de)'],['a)b(c)d'],['((']],767:[['aab'],['aaab'],['ab']],1405:[[1,1,7],[7,1,0],[2,2,1]],162:[[[1,2,3,1]],[[1]],[[3,1,2]]],324:[[[1,5,1,1,6,4]],[[1,3,2,2,3,1]],[[1]]],870:[[[2,7,11,15],[1,10,4,11]],[[12,24,8,32],[13,25,32,11]]],368:[[[1,2,3]],[[1,2,4,8]],[[2]]],210:[[2,[[1,0]]],[2,[[0,1],[1,0]]],[3,[[0,1]]]],269:[[['wrt','wrf','er','ett','rftt']],[['abc','ab']],[['z','x','z']]],373:[[[1,7,11],[2,4,6],3],[[1,1],[1,1],4],[[1,2],[1,10],2]],2392:[[3,[[1,2],[3,2]],[[2,1],[3,2]]],[2,[[1,2],[2,1]],[[1,2]]]],701:[[[4,2,7,1,3],5],[[],0]],108:[[[-10,-3,0,5,9]],[[1,2,3,4]]],450:[[[5,3,6,2,4,None,7],3],[[],0],[[1],1]],109:[[[-10,-3,0,5,9]],[[1,1,1,1]],[[]]],1171:[[[1,2,-3,3,1]],[[1,2,3,-3,4]],[[0]]]}
PRESSURE={5:[(['a'*1000],'a'*1000)],1044:[(['a'*30000],'a'*29999)],1092:[(['a'*1000,'b'*1000],'a'*1000+'b'*1000)],1249:[([')'*50000+'('*50000],'')],767:[(['a'*250+'b'*250],'ab'*250)],1405:[([100,100,100],'abc'*100)],162:[([list(range(1000))],999)],324:[([[0]*25000+[5000]*25000],[0,5000]*25000)],870:[([[10**9]*100000,[0]*100000],[10**9]*100000)],368:[([list(range(1000000000,1000001000))],[1000000000])],210:[([2000,[[i+1,i] for i in range(1999)]],list(range(2000)))],269:[([['a'*99+c for c in string.ascii_lowercase]+['a'*99+'z']*74],string.ascii_lowercase)],373:[([[-10**9]*100000,[10**9]*100000,10000],[[-10**9,10**9] for _ in range(10000)])],2392:[([400,[[i,i+1] for i in range(1,400)]+[[1,400]]*9601,[[i,i+1] for i in range(1,400)]+[[1,400]]*9601],[[i+1 if i==j else 0 for j in range(400)] for i in range(400)])],701:[([balanced(list(range(10000))),10000],balanced(list(range(10001))))],108:[([list(range(10000))],balanced(list(range(10000))))],450:[([balanced(list(range(10000))),5000],balanced(list(range(5000))+list(range(5001,10000))))],109:[([[100000]*20000],balanced([100000]*20000))],1171:[([[1000,-1000]*500],[])]}
META={5:('longestPalindrome','最长回文子串','Longest Palindromic Substring','返回最长连续回文子串；并列最优均可。','Return any longest contiguous palindromic substring.'),1044:('longestDupSubstring','最长重复子串','Longest Duplicate Substring','返回至少出现两次的最长连续子串，两次出现可以重叠；没有重复则空串，并列均可。','Return any longest substring occurring at least twice, allowing overlapping occurrences; return empty when no duplicate exists.'),1092:('shortestCommonSupersequence','最短公共超序列','Shortest Common Supersequence','返回包含两个输入串作为子序列的最短字符串，并列均可。','Return any shortest string containing both inputs as subsequences.'),1249:('minRemoveToMakeValid','最少删除括号','Minimum Parenthesis Removal','只删除最少数量的圆括号，使剩余括号合法，保留全部字母及原顺序；任一最优结果均可。','Remove the fewest parentheses to balance the remainder, preserving all letters and original order; any optimum is accepted.'),767:('reorganizeString','重排相邻不同','Reorganize String','重排全部字符，使相邻字符不同；任一重排均可，不可能则输出空串。','Rearrange all characters so neighbors differ; any arrangement is valid, or return empty if impossible.'),1405:('longestDiverseString','最长快乐字符串','Longest Happy String','最多使用a,b,c指定数量的字母a,b,c，禁止连续三个相同字符，返回任一最长字符串。','Use at most the supplied counts of a,b,c without three consecutive equal characters and return any longest string.'),162:('findPeakElement','寻找峰值','Find a Peak','返回任一严格大于相邻元素的下标，数组外两侧视为负无穷。','Return any index strictly greater than its neighbors, treating both outside boundaries as negative infinity.'),324:('wiggleSort','严格摆动排序','Strict Wiggle Sort','重排原数组，使nums[0]<nums[1]>nums[2]<nums[3]交替成立，输出修改后的数组。','Rearrange the original multiset so nums[0]<nums[1]>nums[2]<nums[3] alternates strictly and return the modified array.'),870:('advantageCount','优势最大重排','Advantage Shuffle','重排nums1，使其在相同下标严格大于nums2的次数最大；任一最优排列均可。','Permute nums1 to maximize the number of indices where it strictly exceeds nums2; any optimum is accepted.'),368:('largestDivisibleSubset','最大整除子集','Largest Divisible Subset','返回元素数最多的子集，使任意两元素中一个整除另一个，结果排列顺序不限。','Return any maximum-size subset in which one of every pair divides the other; element order is arbitrary.'),210:('findOrder','课程合法次序','Course Order','每对[a,b]表示先完成b才能完成a，返回所有课程的任一合法次序；存在环则返回空数组。','Each [a,b] requires b before a. Return any valid ordering of all courses, or an empty array if cyclic.'),269:('alienOrder','外星字母顺序','Alien Alphabet','输入单词已按未知字母表排序，返回所有出现字母的任一一致排列；前缀倒置或环导致无解时输出空串。','Given words sorted by an unknown alphabet, return any consistent ordering of all occurring letters; return empty for a prefix violation or cycle.'),373:('kSmallestPairs','最小和数对','K Smallest-Sum Pairs','从两个数组各选一个位置形成数对，返回和最小的k个位置组合对应的值；并列任取，保留相同值来自不同位置的次数，行序不限。','Choose one index from each array and return the k pairs with smallest sums, breaking ties arbitrarily. Preserve repeated value pairs up to their index multiplicity; row order is arbitrary.'),2392:('buildMatrix','按约束构造矩阵','Build a Constrained Matrix','构造k乘k矩阵，1到k各出现一次其余为0；rowConditions每对要求前者行严格靠上，colConditions要求前者列严格靠左。任一解均可，无解空矩阵。','Build a k-by-k matrix containing each value 1..k once and zeros elsewhere. Each row condition requires its first value strictly above the second; column conditions require strictly left. Return any solution or an empty matrix if impossible.'),701:('insertIntoBST','插入搜索树','Insert into BST','插入新值，输出包含原值及新值的任一严格二叉搜索树，允许树形改变。','Insert the new value and return any strict BST containing exactly the original values and the inserted value; shape may change.'),108:('sortedArrayToBST','有序数组转平衡树','Sorted Array to Balanced BST','将严格递增数组转换为高度平衡搜索树，每个节点两子树高度差至多1；任一合法树形均可。','Convert the strictly increasing array into any height-balanced BST; each node’s subtree heights differ by at most one.'),450:('deleteNode','删除搜索树节点','Delete a BST Node','若key存在则删除该值一次，否则保留原值集合。输出任一包含所需值集合的严格搜索树。','Delete key once if present, otherwise preserve the value set; return any strict BST with the required values.'),109:('sortedListToBST','有序链表转平衡树','Sorted List to Balanced BST','给定非递减链表，保留所有重复值并构造高度平衡树；中序遍历必须等于原链表，每节点两子树高度差至多1。','Convert the nondecreasing list, retaining duplicates, into a height-balanced tree whose inorder traversal equals the list and whose subtree heights differ by at most one at every node.'),1171:('removeZeroSumSublists','反复移除零和片段','Remove Zero-Sum Sublists','可反复删除链表中和为0的连续片段，直到不存在此类非空片段；输出任一通过这些操作可达的最终链表。','Repeatedly remove contiguous zero-sum segments until none remains; return any final list reachable through these operations.')}
DOMAINS={5:('s长度1–1000，仅英文字母和数字。','s has length 1–1000 and contains only English letters and digits.'),1044:('s长度2–30000，仅小写英文字母。','s has length 2–30000 and contains only lowercase English letters.'),1092:('两个字符串长度均1–1000，仅小写英文字母。','Both strings have length 1–1000 and contain only lowercase English letters.'),1249:('s长度1–100000，仅小写字母及圆括号。','s has length 1–100000 and contains only lowercase English letters and parentheses.'),767:('s长度1–500，仅小写英文字母。','s has length 1–500 and contains only lowercase English letters.'),1405:('三个数量各0–100，总和至少1。','Each count is 0–100 and their total is positive.'),162:('数组长度1–1000，值在32位有符号整数范围，相邻值不同。','Array length is 1–1000, values are signed 32-bit integers, and adjacent values differ.'),324:('数组长度1–50000，值0–5000，保证存在严格摆动重排。','Array length is 1–50000, values are 0–5000, and a strict wiggle permutation is guaranteed.'),870:('两个数组长度相同，均1–100000，值0–1000000000。','Both arrays have equal length 1–100000 and values 0–1000000000.'),368:('数组长度1–1000，互异整数1–2000000000。','Array length is 1–1000 with distinct integers 1–2000000000.'),210:('1≤numCourses≤2000；0–n(n-1)条不同先修对，端点0–n-1，每对端点不同，允许有环。','1≤numCourses≤2000; 0–n(n-1) distinct prerequisite pairs use endpoints 0–n-1 with unequal endpoints; cycles are allowed.'),269:('1–100个单词，每词长度1–100，仅小写英文字母；不保证存在一致顺序。','There are 1–100 words, each of length 1–100 over lowercase English letters; a consistent alphabet need not exist.'),373:('两个数组均非递减，长度1–100000，值[-1000000000,1000000000]；1≤k≤10000且k不超过两数组长度乘积。','Both arrays are nondecreasing, with lengths 1–100000 and values in [-1000000000,1000000000]; 1≤k≤10000 and k does not exceed their length product.'),2392:('2≤k≤400，每组条件1–10000条，每对不同端点均在1–k，允许重复条件和环。','2≤k≤400; each condition list has 1–10000 pairs with distinct endpoints in 1..k; repeated conditions and cycles are allowed.'),701:('原树0–10000节点，值互异且构成严格BST；节点值和val在[-100000000,100000000]，val原来不存在。','The strict BST has 0–10000 distinct-valued nodes; node values and val lie in [-100000000,100000000], and val is absent initially.'),108:('数组严格递增，长度1–10000，值[-10000,10000]。','The array is strictly increasing, length 1–10000, with values in [-10000,10000].'),450:('原树0–10000节点，互异值且严格BST，节点值及key在[-100000,100000]。','The strict BST has 0–10000 distinct-valued nodes; node values and key lie in [-100000,100000].'),109:('非递减链表0–20000节点，值[-100000,100000]，允许重复。','The nondecreasing list has 0–20000 nodes with values in [-100000,100000]; duplicates are allowed.'),1171:('链表长度1–1000，值[-1000,1000]。','List length is 1–1000 and values lie in [-1000,1000].')}
PARAMS={5:'[s]',1044:'[s]',1092:'[str1,str2]',1249:'[s]',767:'[s]',1405:'[a,b,c]',162:'[nums]',324:'[nums]',870:'[nums1,nums2]',368:'[nums]',210:'[numCourses,prerequisites]',269:'[words]',373:'[nums1,nums2,k]',2392:'[k,rowConditions,colConditions]',701:'[root,val]',108:'[nums]',450:'[root,key]',109:'[head]',1171:'[head]'}
WRONG={5:('遗漏偶数长度回文','把全串当回文'),1044:('只检测两半重复','把原串当重复子串'),1092:('直接拼接未缩短','遗漏剩余字符'),1249:('删除所有括号','忘记删除剩余左括号'),767:('忽略相邻相同限制','遗漏一个字符'),1405:('忽略三个相同限制','少输出一个字符'),162:('固定返回首下标','返回最小值位置'),324:('仅排序','按奇偶索引拆排'),870:('排序后直接逐位配对','保持原次序'),368:('返回全部值','只返回单元素'),210:('固定数字次序','颠倒拓扑次序'),269:('直接按英语字母排序','颠倒合法字母序'),373:('按笛卡尔积枚举顺序截取','把重复值对去重'),2392:('颠倒行拓扑顺序','颠倒列拓扑顺序'),701:('没有插入值','丢失最大值'),108:('生成不平衡右链','遗漏一个节点'),450:('没有删除值','多删除一个节点'),109:('生成不平衡右链','遗漏一个节点'),1171:('只删除单个零','只删除相邻相反数')}

def make(pid):
 method,zh,en,dz,de=META[pid];iz,ie=DOMAINS[pid];kind='string' if pid in STRINGS else 'integer' if pid==162 else 'nullable-integer-array' if pid in TREES else 'integer-rows' if pid in (373,2392) else 'integer-array'
 iz='输入一行JSON参数数组，顺序为'+PARAMS[pid]+'。'+iz;ie='Input one line containing a JSON argument array in order '+PARAMS[pid]+'. '+ie
 if pid in (701,450):iz+='root为规范层序整数/null数组，只有非空父节点消耗两个孩子位置，去掉末尾null，空树为[]。';ie+=' root is a canonical level-order integer/null array; only non-null parents consume two child positions, trailing nulls are omitted, and [] is empty.'
 if pid in (109,1171):iz+='head用按链表次序的整数数组表示。';ie+=' Represent head as an integer array in list order.'
 if kind=='string':oz='输出一行字符串原文；空串输出一个换行。';oe='Print the raw string on one line; an empty string is one newline.';emit='print(result)'
 elif kind=='integer':oz='输出一个整数下标。';oe='Print one integer index.';emit='print(result)'
 elif kind=='integer-rows':oz='第一行行数，随后每行先输出长度再输出该行整数；空结果只输出0。';oe='Print the row count, then each row as its length followed by integers; an empty result is 0.';emit='print(len(result))\nfor row in result:print(len(row),*row)'
 else:oz='第一行元素数，随后输出整数'+('或null，按规范树层序且去掉末尾null。' if kind=='nullable-integer-array' else '，保持结果内部顺序。');oe='Print the element count, then integers'+(' or null in canonical tree level order with trailing nulls omitted.' if kind=='nullable-integer-array' else ', preserving result order.');emit="print(len(result))\nprint(*('null' if v is None else v for v in result)) if result else None"
 oz+='任何符合题意的最优或合法结果都可通过。';oe+=' Any optimal or valid result meeting the problem is accepted.'
 helper='import heapq\nfrom collections import Counter,deque\n'+inspect.getsource(TreeNode)+'\n'+inspect.getsource(from_level_order)+'\n'+inspect.getsource(to_level_order)+'\nTREES='+repr(TREES)+'\n'+inspect.getsource(balanced)+'\n'+inspect.getsource(topo)+'\n'+inspect.getsource(alien_edges)+'\n'+inspect.getsource(fast)
 spec=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='困难' if pid in {1044,1092,269,2392} else '简单' if pid==108 else '中等',semanticId=pid,resultKind=kind,outputLimit=2048 if pid==870 else 1024,edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=PARSE,mutants=[dict(name=name,source='import sys,json\n'+helper+'\n'+PARSE+f'\nresult=fast({pid},args,{i+1})\n'+emit+'\n') for i,name in enumerate(WRONG[pid])])
 if pid==324:spec['resultAdapter']='arg0'
 if pid in (701,450):spec['treeArgs']=[0]
 if pid in TREES:spec['resultTree']='return'
 if pid==109:spec['listArgs']=[0]
 if pid==1171:spec['listArgs']=[0];spec['resultLinked']='return'
 return spec
PROBLEMS={pid:make(pid) for pid in IDS}
