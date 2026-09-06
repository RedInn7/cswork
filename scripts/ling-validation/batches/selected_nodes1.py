"""Identity-aware special-node fixtures. Fixed codec integration is required.

708 and 652 require their fixed semantic checkers; other outputs are uniquely
specified node identities or structural rows, never just equal node values.
"""
import inspect,json,random
from collections import Counter,deque
from special_node_codec import prepare_special,SPECIAL_IDS,TREE_IDS
from tree_codec import valid_tree,TreeNode,to_level_order
IDS=list(SPECIAL_IDS)
IDENTITY={142,160,236,1644,1650,1123,235,285}
ARRAYS={708,430,116,117,426,1110,652,863}
BOUNDS={863:(1,500,0,500),116:(0,4095,-1000,1000),117:(0,6000,-100,100),236:(2,100000,-10**9,10**9),1644:(1,10000,-10**9,10**9),1650:(2,100000,-10**9,10**9),1123:(1,1000,0,1000),235:(2,100000,-10**9,10**9),285:(1,10000,-100000,100000),426:(0,2000,-1000,1000),1110:(0,1000,1,1000),652:(1,5000,-200,200)}

def adjacency(tokens):
 if not tokens:return [],[],[]
 values=[tokens[0]];parents=[-1];children=[[-1,-1]];slots=deque([(0,0),(0,1)])
 for v in tokens[1:]:
  p,side=slots.popleft()
  if v is not None:
   i=len(values);values.append(v);parents.append(p);children.append([-1,-1]);children[p][side]=i;slots.extend(((i,0),(i,1)))
 return values,parents,children

def signatures(tokens):
 values,parents,children=adjacency(tokens);table={};ids=[0]*len(values)
 for i in range(len(values)-1,-1,-1):
  left,right=children[i];key=(values[i],ids[left] if left>=0 else 0,ids[right] if right>=0 else 0)
  if key not in table:table[key]=len(table)+1
  ids[i]=table[key]
 return ids

def oracle(pid,a):
 x=a[0]
 if pid==141:return int(a[1]>=0)
 if pid==142:return a[1]
 if pid==160:return len(x)+len(a[1]) if a[2] else -1
 if pid==138:return [row[:] for row in x]
 if pid==708:
  if not x:return [a[1]]
  for i in range(1,len(x)+1):
   out=x[:i]+[a[1]]+x[i:]
   if sum(out[j]>out[(j+1)%len(out)] for j in range(len(out)))<=1:return out
  raise AssertionError('no insertion')
 if pid==430:
  # Each child/next step defines a lexicographic visit address.
  if not x:return []
  pending=[(0,())];paths={}
  while pending:
   i,path=pending.pop();paths[i]=path
   if x[i][1]>=0:pending.append((x[i][1],path+(1,)))
   if x[i][2]>=0:pending.append((x[i][2],path+(0,)))
  return sorted(paths,key=paths.__getitem__)
 values,parent,children=adjacency(x);n=len(values);paths=[]
 for i,p in enumerate(parent):paths.append((i,) if p<0 else paths[p]+(i,))
 if pid==863:
  target,k=a[1:];out=[]
  for i in range(n):
   common=len(set(paths[i])&set(paths[target]));distance=len(paths[i])+len(paths[target])-2*common
   if distance==k:out.append(values[i])
  return out
 if pid in (116,117):
  out=[-1]*n
  for i in range(n):
   out[i]=next((j for j in range(i+1,n) if len(paths[j])==len(paths[i])),-1)
  return out
 if pid in (236,1644,1650,235):
  p,q=a[1:]
  if pid==1644:
   if 'external' in p or 'external' in q:return -1
   p,q=p['id'],q['id']
  return max(set(paths[p])&set(paths[q]),key=lambda i:len(paths[i]))
 if pid==1123:
  depth=max(map(len,paths));deep=[set(p) for p in paths if len(p)==depth];common=set.intersection(*deep)
  return max(common,key=lambda i:len(paths[i]))
 if pid==285:return min((i for i in range(n) if values[i]>values[a[1]]),key=values.__getitem__,default=-1)
 if pid==426:return sorted(range(n),key=values.__getitem__)
 if pid==1110:return [i for i in range(n) if values[i] not in a[1] and (parent[i]<0 or values[parent[i]] in a[1])]
 if pid==652:
  # Serialize each candidate recursively, independently of interned fast IDs.
  def shape(i):return None if i<0 else (values[i],shape(children[i][0]),shape(children[i][1]))
  shapes=[shape(i) for i in range(n)];out=[];seen=set()
  for i,s in enumerate(shapes):
   if shapes.count(s)>1 and s not in seen:seen.add(s);out.append(i)
  return out
 raise AssertionError(pid)

def fast(pid,a,bug=0):
 x=a[0]
 if pid==141:return int(len(set(x))<len(x)) if bug==1 else int(a[1]>0) if bug==2 else int(a[1]>=0)
 if pid==142:
  if bug==1:
   seen={}
   for i,v in enumerate(x):
    if v in seen:return seen[v]
    seen[v]=i
   return -1
  return 0 if a[1]>=0 and bug==2 else a[1]
 if pid==160:
  if bug==1:return next((i for i,v in enumerate(x+a[2]) if v in a[1]+a[2]),-1)
  if bug==2:return 0 if a[2] else -1
  return len(x)+len(a[1]) if a[2] else -1
 if pid==138:
  return [[v,-1 if bug==1 else i if bug==2 and r>=0 else r] for i,(v,r) in enumerate(x)]
 if pid==708:
  if bug==1:return x[:]
  if bug==2:return sorted(x+[a[1]])
  if not x:return [a[1]]
  for i,v in enumerate(x):
   w=x[(i+1)%len(x)]
   if v<=a[1]<=w or v>w and (a[1]>=v or a[1]<=w):return x[:i+1]+[a[1]]+x[i+1:]
  return x+[a[1]]
 if pid==430:
  stack=[0] if x else [];out=[]
  while stack:
   i=stack.pop();out.append(i);nxt,child=x[i][1:]
   order=(nxt,child) if bug!=1 else (child,nxt)
   for v in order:
    if v>=0 and not(bug==2 and v==child):stack.append(v)
  return out
 values,parent,children=adjacency(x);n=len(values)
 if pid==863:
  q=deque([(a[1],0)]);seen={a[1]};out=[];k=a[2]-(bug==2)
  while q:
   u,d=q.popleft()
   if d==k:out.append(values[u]);continue
   for v in children[u]+([] if bug==1 else [parent[u]]):
    if v>=0 and v not in seen:seen.add(v);q.append((v,d+1))
  return out
 if pid in (116,117):
  out=[-1]*n;q=[0] if n else []
  while q:
   for i,u in enumerate(q):out[u]=q[i+1] if i+1<len(q) else -1
   q=[v for u in q for v in children[u] if v>=0]
  if bug==1:return [i+1 if i+1<n else -1 for i in range(n)]
  if bug==2:return [-1]*n
  return out
 if pid in (236,235,1650,1644):
  p,q=a[1:]
  if pid==1644:
   if 'external' in p or 'external' in q:
    return p.get('id',q.get('id',-1)) if bug==1 else -1
   p,q=p['id'],q['id']
  if bug==1:return parent[p]
  if bug==2:return 0
  ancestors=set()
  while p>=0:ancestors.add(p);p=parent[p]
  while q not in ancestors:q=parent[q]
  return q
 if pid==1123:
  if bug==1:return n-1
  if bug==2:return 0
  depth=[0]*n;answer=list(range(n))
  for i in range(n-1,-1,-1):
   l,r=children[i];dl=depth[l] if l>=0 else 0;dr=depth[r] if r>=0 else 0;depth[i]=1+max(dl,dr);answer[i]=i if dl==dr else answer[l] if dl>dr else answer[r]
  return answer[0]
 if pid in (285,426):
  order=[];stack=[];u=0 if n else -1
  while stack or u>=0:
   while u>=0:stack.append(u);u=children[u][0]
   u=stack.pop();order.append(u);u=children[u][1]
  if pid==426:return list(range(n)) if bug==1 else order[::-1] if bug==2 else order
  index=order.index(a[1]);return children[a[1]][1] if bug==1 else parent[a[1]] if bug==2 else order[index+1] if index+1<n else -1
 if pid==1110:
  alive={i for i,v in enumerate(values) if v not in a[1]}
  if bug==1:return [0] if 0 in alive else []
  if bug==2:return sorted(alive)
  return [i for i in alive if parent[i] not in alive]
 if pid==652:
  ids=signatures(x);counts=Counter(ids);out=[];used=set()
  for i,key in enumerate(ids):
   if counts[key]>1 and (key not in used or bug==2):out.append(i);used.add(key)
  if bug==1:
   seen=Counter(values);return [values.index(v) for v in seen if seen[v]>1]
  return out
 raise AssertionError(pid)

def accepts(pid,args,got,want):
 if pid==708:
  old=args[0]
  return type(got)is list and len(got)==len(old)+1 and all(type(v)is int for v in got) and any(got[i]==args[1] and got[:i]+got[i+1:]==old for i in range(1 if old else 0,len(got))) and sum(got[i]>got[(i+1)%len(got)] for i in range(len(got)))<=1
 if pid==652:
  ids=signatures(args[0]);counts=Counter(ids)
  return type(got)is list and all(type(i)is int and 0<=i<len(ids) for i in got) and len(got)==len({ids[i] for i in got}) and {ids[i] for i in got}=={key for key,c in counts.items() if c>1}
 if pid in (1110,863):return len(got)==len(set(got)) and set(got)==set(want)
 return got==want

def bst(values):
 if not values:return []
 root=TreeNode();stack=[(root,0,len(values))]
 while stack:
  u,l,r=stack.pop();m=(l+r)//2;u.val=values[m]
  if l<m:u.left=TreeNode();stack.append((u.left,l,m))
  if m+1<r:u.right=TreeNode();stack.append((u.right,m+1,r))
 return to_level_order(root)

def right_chain(values):
 out=[]
 for v in values:
  if out:out.append(None)
  out.append(v)
 return out

def random_args(pid,r):
 if pid in (141,142):
  n=r.randint(0,10);return [[r.randint(-3,3) for _ in range(n)],r.randint(-1,n-1)]
 if pid==160:
  tail=[r.randint(1,4) for _ in range(r.randint(0,5))];return [[r.randint(1,4) for _ in range(r.randint(0 if tail else 1,5))] for _ in range(2)]+[tail]
 if pid==138:
  n=r.randint(0,8);return [[[r.randint(-3,3),r.randint(-1,n-1)] for _ in range(n)]]
 if pid==708:
  vals=sorted(r.randint(-3,3) for _ in range(r.randint(0,8)));k=r.randrange(len(vals)) if vals else 0;return [vals[k:]+vals[:k],r.randint(-4,4)]
 if pid==430:
  n=r.randint(0,9);rows=[[r.randint(1,5),-1,-1] for _ in range(n)];available=[0] if n else []
  for i in range(1,n):
   p=r.choice(available);slot=r.choice([s for s in (1,2) if rows[p][s]<0]);rows[p][slot]=i;available.append(i)
   if min(rows[p][1:])>=0:available.remove(p)
  return [rows]
 low,high,mn,mx=BOUNDS[pid]
 if pid==116:
  n=2**r.randint(0,3)-1;tokens=[r.randint(-3,3) for _ in range(n)]
 elif pid in (235,285,426):
  n=r.randint(low,9);tokens=bst(sorted(r.sample(range(-20,21),n)))
 else:
  n=r.randint(low,10);values=r.sample(range(max(mn,-20),min(mx,30)+1),n) if pid not in (117,652) else [r.randint(max(mn,-3),min(mx,3)) for _ in range(n)];tokens=[]
  if n:
   root=TreeNode(values[0]);available=[root]
   for value in values[1:]:
    u=r.choice(available);side=r.choice([s for s in ('left','right') if getattr(u,s) is None]);v=TreeNode(value);setattr(u,side,v);available.append(v)
    if u.left and u.right:available.remove(u)
   tokens=to_level_order(root)
 if pid in (236,235,1650):return [tokens]+r.sample(range(n),2)
 if pid==1644:
  options=[{'id':i} for i in range(n)]+[{'external':-1000000},{'external':-1000001}];return [tokens]+r.sample(options,2)
 if pid==285:return [tokens,r.randrange(n)]
 if pid==863:return [tokens,r.randrange(n),r.randint(0,12)]
 if pid==1110:return [tokens,r.sample(range(1,31),r.randint(0,8))]
 return [tokens]

def validate(pid,a):
 def num(v,lo,hi):assert type(v)is int and lo<=v<=hi
 x=a[0]
 if pid in (141,142):
  assert type(x)is list and len(x)<=10000
  for v in x:num(v,-100000,100000)
  num(a[1],-1,len(x)-1)
 if pid==160:
  assert len(a)==3
  for arr in a:
   assert type(arr)is list
   for v in arr:num(v,1,100000)
  assert 1<=len(x)+len(a[2])<=30000 and 1<=len(a[1])+len(a[2])<=30000
 if pid==138:
  assert type(x)is list and len(x)<=1000
  for row in x:assert type(row)is list and len(row)==2;num(row[0],-10000,10000);num(row[1],-1,len(x)-1)
 if pid==708:
  assert type(x)is list and len(x)<=50000
  for v in x+[a[1]]:num(v,-1000000,1000000)
  assert not x or sum(x[i]>x[(i+1)%len(x)] for i in range(len(x)))<=1
 if pid==430:
  assert type(x)is list and len(x)<=1000
  for row in x:assert type(row)is list and len(row)==3;num(row[0],1,100000);num(row[1],-1,len(x)-1);num(row[2],-1,len(x)-1)
 if pid in TREE_IDS:
  low,high,mn,mx=BOUNDS[pid];n=valid_tree(x,min_nodes=low,max_nodes=high,min_value=mn,max_value=mx,bst=pid in (235,285,426));values=[v for v in x if v is not None]
  if pid not in (116,117,652):assert len(set(values))==len(values)
  if pid==116:assert None not in x and (n+1)&n==0
  if pid in (236,235,1650):num(a[1],0,n-1);num(a[2],0,n-1);assert a[1]!=a[2]
  if pid==1644:
   identities=[];external=[]
   for target in a[1:]:
    assert type(target)is dict and len(target)==1
    if 'id' in target:num(target['id'],0,n-1);identities.append(('id',target['id']))
    else:assert 'external' in target;num(target['external'],-10**9,10**9);assert target['external'] not in values;identities.append(('external',target['external']));external.append(target['external'])
   assert len(identities)==2 and identities[0]!=identities[1]
  if pid==285:num(a[1],0,n-1)
  if pid==863:num(a[1],0,n-1);num(a[2],0,1000)
  if pid==1110:
   assert type(a[1])is list and len(a[1])<=1000 and len(set(a[1]))==len(a[1])
   for v in a[1]:num(v,1,1000)
 # Shared codec checks graph reachability, child ownership and canonical IDs.
 try:prepare_special(pid,a)
 except (ValueError,IndexError,TypeError):raise AssertionError('invalid special-node transport')
 return True

def encode(pid,a):return json.dumps(a,separators=(',',':'))+'\n'
PARSE='args=json.load(sys.stdin)'
EDGE={863:[[[3,5,1,6,2,0,8,None,None,7,4],1,2],[[1],0,0]],141:[[[3,2,0,-4],1],[[1,1],-1],[[1],0],[[],-1]],142:[[[3,2,0,-4],1],[[1,1],-1],[[1],0],[[],-1]],160:[[[4,1],[5,6,1],[8,4,5]],[[1],[1],[]],[[],[],[7]]],138:[[[[7,-1],[13,0],[11,4],[10,2],[1,0]]],[[[1,1],[1,0]]],[[]]],708:[[[3,4,1],2],[[1,1],2],[[],1]],430:[[[[1,1,2],[2,-1,-1],[3,3,-1],[4,-1,-1]]],[[]]],116:[[[1,2,3,4,5,6,7]],[[]]],117:[[[1,2,3,4,5,None,7]],[[]]],236:[[[3,5,1,6,2,0,8,None,None,7,4],1,4],[[3,5,1,6,2,0,8,None,None,7,4],3,8]],1644:[[[3,5,1,6,2],{'id':1},{'external':9}],[[3,5,1,6,2],{'id':3},{'id':4}]],1650:[[[3,5,1,6,2],1,4],[[3,5,1,6,2],3,4]],1123:[[[3,5,1,6,2,0,8,None,None,7,4]],[[1,2,3]]],235:[[[6,2,8,0,4,7,9,None,None,3,5],1,4],[[6,2,8,0,4,7,9,None,None,3,5],3,7]],285:[[[5,3,7,2,4,6,8],0],[[5,3,7,2,4,6,8],4]],426:[[[4,2,5,1,3]],[[]]],1110:[[[1,2,3,4,5,6,7],[3,5]],[[1,2,3],[1]]],652:[[[1,2,3,4,None,2,4,None,None,4]],[[1,2,2,3,None,None,3]]]}
BIG_BST=bst(list(range(100000)))
SMALL_BST=bst(list(range(10000)))
CIRCULAR_BST=bst(list(range(-1000,1000)))
PERFECT=[1]*4095
PRESSURE={863:[([right_chain(list(range(500))),0,499],[499]),([right_chain(list(range(500))),250,1000],[])],141:[([[1]*10000,0],1)],142:[([[1]*10000,9999],9999)],160:[([[1]*29999,[1]*29999,[1]],59998)],138:[([[[10000,(i+1)%1000] for i in range(1000)]],[[10000,(i+1)%1000] for i in range(1000)])],708:[([[1]*50000,2],[1]*50000+[2])],430:[([[[100000,-1,i+1 if i<999 else -1] for i in range(1000)]],list(range(1000)))],116:[([[-1000]*4095],[i+1 if (i+2)&(i+1) else -1 for i in range(4095)])],117:[([[100]*6000],[i+1 if i+1<6000 and (i+2)&(i+1) else -1 for i in range(6000)])],236:[([BIG_BST,1,2],0)],1644:[([SMALL_BST,{'id':1},{'external':-1000000000}],-1)],1650:[([BIG_BST,1,2],0)],1123:[([right_chain(list(range(1000)))],999)],235:[([BIG_BST,1,2],0)],285:[([SMALL_BST,[v for v in SMALL_BST if v is not None].index(9999)],-1)],426:[([CIRCULAR_BST],sorted(range(2000),key=lambda i:[v for v in CIRCULAR_BST if v is not None][i]))],1110:[([list(range(1,1001)),list(range(1,1001))],[])],652:[([right_chain([0]*5000)],[]),([PERFECT],[2**d-1 for d in range(1,12)])]}
META={863:('distanceK','距离目标K的节点','Nodes at Distance K','从目标原节点出发，沿父子边任意方向走恰好k条边，输出所有这样的节点值，顺序不限。','Return the values of all nodes exactly k parent/child edges from the original target node, in any order.'),141:('hasCycle','环形链表','Linked List Cycle','判断next指针是否形成环，输出1或0。','Return 1 if next pointers form a cycle, otherwise 0.'),160:('getIntersectionNode','相交链表','Intersecting Linked Lists','返回两条链表首次共享的原节点编号；值相同但对象不同不算相交，不相交为-1。','Return the input ID of the first shared node, or -1; equal values in distinct nodes do not constitute intersection.'),142:('detectCycle','环入口节点','Cycle Entry Node','返回环入口原节点编号，无环为-1。','Return the original node ID at the cycle entry, or -1 if acyclic.'),138:('copyRandomList','随机指针链表复制','Copy a Random-Pointer List','输出复制链表的结构，每行是value和random目标下标，空指针为-1。本平台验收输出结构，不以stdio结果证明内存分配独立性。','Output the copied list structure as rows [value,random target index], using -1 for null. This platform checks structural output; stdout does not prove independent memory allocation.'),708:('insert','循环有序链表插入','Insert into a Sorted Cycle','向循环非递减链表插入一个值并保留原head；输出从原head开始的一圈值，允许合法插入位置不同。空输入输出单节点。','Insert one value into a circular nondecreasing list while retaining its head. Output one cycle of values starting at the original head; any valid insertion position is accepted. Empty input yields one node.'),430:('flatten','展开多级双向链表','Flatten a Multilevel Doubly Linked List','对子链表先深度展开，再接回原next，输出展开后原节点ID次序；prev与next互逆，所有child清空。','Flatten each child list before continuing the original next chain. Output original node IDs in flattened order; prev and next are inverse and all child pointers are cleared.'),116:('connect','连接完美树同层节点','Connect Perfect-Tree Neighbors','完美二叉树每节点next指向同层右侧紧邻节点，最右为null；按输入节点ID次序输出next目标ID，null为-1。','Set each perfect-tree node’s next to its immediate right neighbor on the same level, or null at the end. Output next target IDs in input ID order, using -1 for null.'),117:('connect','连接任意树同层节点','Connect Tree Neighbors','任意二叉树每节点next指向同层右侧紧邻节点，最右为null；按输入ID顺序输出next目标ID，null为-1。','Set next to the immediate right neighbor on the same level, or null at the end. Output next target IDs in input ID order, using -1 for null.'),236:('lowestCommonAncestor','二叉树最近公共祖先','Binary Tree LCA','返回两个目标原节点的最近公共祖先ID，节点可以是自身祖先。','Return the input ID of the lowest common ancestor of both targets; a node may be its own ancestor.'),1644:('lowestCommonAncestor','目标可能缺失的最近公共祖先','LCA with Possibly Missing Targets','仅当两个目标节点都存在于树中才返回最近公共祖先原ID，否则-1。','Return the original LCA ID only if both targets occur in the tree; otherwise return -1.'),1650:('lowestCommonAncestor','带父指针的最近公共祖先','LCA with Parent Pointers','参考接口只接收p和q，节点具有parent指针；返回最近公共祖先原ID。','The reference receives only p and q with parent pointers; return the original LCA ID.'),1123:('lcaDeepestLeaves','最深叶子的共同祖先','LCA of Deepest Leaves','返回所有最大深度叶子的最近公共祖先原ID。','Return the original ID of the lowest common ancestor of all deepest leaves.'),235:('lowestCommonAncestor','搜索树最近公共祖先','BST LCA','在严格搜索树中返回两个目标节点的最近公共祖先原ID。','Return the original LCA ID of two target nodes in a strict BST.'),285:('inorderSuccessor','搜索树中序后继','Inorder Successor in a BST','返回目标p中序遍历中的下一个原节点ID，无后继为-1。','Return the original ID immediately after p in inorder traversal, or -1 if none exists.'),426:('treeToDoublyList','搜索树转循环双向链表','BST to Circular Doubly Linked List','原地把所有原节点连接成升序循环双向链表，left为前驱、right为后继，head必须是最小值节点；输出一圈原节点ID。','Link the original nodes in place into a sorted circular doubly linked list, using left as predecessor and right as successor. Start at the minimum node and output one cycle of original IDs.'),1110:('delNodes','删除节点并返回森林','Delete Nodes and Return a Forest','删除指定值的节点，剩余边保持原样；输出结果森林所有根的原节点ID，顺序不限。','Delete specified node values, preserving surviving edges. Output the original root IDs of the resulting forest in any order.'),652:('findDuplicateSubtrees','重复子树代表','Duplicate Subtree Representatives','结构和值完全相同视为同类；对至少出现两次的每类子树，输出任意一个原根ID作为代表，每类恰好一个，顺序不限。','Subtrees are equivalent when shape and values match. For every type occurring at least twice, return any one original root ID, exactly one per type, in any order.')}

def input_text(pid):
 if pid in (141,142):return ('一行JSON [values,pos]；0–10000节点，值[-100000,100000]。ID为数组下标，末节点next指向pos，pos=-1表示无环。','One JSON line [values,pos]; 0–10000 nodes with values in [-100000,100000]. IDs are array indices; the last next points to pos, or null for pos=-1.')
 if pid==160:return ('一行JSON [prefixA,prefixB,sharedTail]。ID先按prefixA、再prefixB、再共享尾部分配，两前缀各自接同一尾部。两条完整链长度各1–30000，值1–100000；空sharedTail表示不相交。','One JSON line [prefixA,prefixB,sharedTail]. Allocate IDs through prefixA, then prefixB, then the shared tail; both prefixes point to the same tail. Each complete list has length 1–30000 and values 1–100000. An empty tail means disjoint lists.')
 if pid==138:return ('一行JSON [rows]，每行[value,randomID]；0–1000节点，值[-10000,10000]，randomID为-1或有效下标，next按数组顺序。','One JSON line [rows], with each row [value,randomID]. There are 0–1000 nodes, values are in [-10000,10000], randomID is -1 or a valid index, and next follows array order.')
 if pid==708:return ('一行JSON [valuesFromHead,insertVal]。0–50000个原节点，所有值及插入值在[-1000000,1000000]；非空数组形成有序环，最后连接首节点，最多一个严格下降边。','One JSON line [valuesFromHead,insertVal]. There are 0–50000 original nodes, and all values lie in [-1000000,1000000]. The last node connects to the first; a sorted cycle has at most one strict descent.')
 if pid==430:return ('一行JSON [rows]，第i行[value,nextID,childID]定义原节点i，-1为空；head为ID0，空数组为空链。0–1000节点，值1–100000。结构可达且无环、无共享节点；每段next构成双向链，child指向子链头，prev由next自动建立。','One JSON line [rows], with row i [value,nextID,childID] defining node i and -1 for null. Head is ID0, or null for no rows. There are 0–1000 nodes with values 1–100000. All nodes are reachable without cycles or sharing; each next segment is doubly linked and child points to a sublist head. Prev is derived from next.')
 lo,hi,mn,mx=BOUNDS[pid];params='[tree,pID,qID]' if pid in (236,235,1650) else '[tree,pLocator,qLocator]' if pid==1644 else '[tree,targetID,k]' if pid==863 else '[tree,pID]' if pid==285 else '[tree,to_delete]' if pid==1110 else '[tree]'
 zh=f'一行JSON {params}。tree为规范层序整数/null数组，只有非空父节点消耗后续两个孩子位置，去掉末尾null，空树[]。原ID按非空节点BFS顺序从0分配。节点数{lo}–{hi}，值[{mn},{mx}]。'
 en=f'One JSON line {params}. tree is a canonical level-order integer/null array; only non-null parents consume two child positions. Omit trailing nulls and use [] for empty. Original IDs number non-null nodes in BFS order from 0. There are {lo}–{hi} nodes with values in [{mn},{mx}].'
 if pid==116:zh+='保证完美二叉树，所有叶子深度相同且内部节点都有两个孩子。';en+=' The tree is perfect: leaves share a depth and internal nodes have two children.'
 if pid not in (116,117,652):zh+='节点值互异。';en+=' Node values are distinct.'
 if pid in (235,285,426):zh+='保证严格BST。';en+=' The tree is a strict BST.'
 if pid in (236,235,1650):zh+='pID和qID不同且均有效。';en+=' pID and qID are distinct valid IDs.'
 if pid==285:zh+='pID是有效节点ID。';en+=' pID is a valid ID.'
 if pid==863:zh+='targetID为有效原节点ID，0≤k≤1000。';en+=' targetID is a valid original node ID and 0≤k≤1000.'
 if pid==1644:zh+='定位符为{"id":有效ID}或{"external":外部节点值}；两目标不同，外部值在相同值域且与树和另一目标值互异。';en+=' A locator is {"id":valid ID} or {"external":external node value}. Targets differ; external values share the value domain and are distinct from all tree and other target values.'
 if pid==1110:zh+='删除值数组长度0–1000，互异值1–1000，可以不在树中。';en+=' The deletion array has length 0–1000 with distinct values 1–1000, possibly absent from the tree.'
 return zh,en

WRONG={863:('只向孩子搜索','距离少算一'),141:('把重复值当成环','漏掉入口是head的环'),142:('返回重复值首次出现位置','有环就返回head'),160:('按节点值判断相交','有共享尾就返回headA'),138:('清空所有random','把random改为自己'),708:('忘记插入新节点','排序后改变原head'),430:('先展开next后展开child','忽略child链'),116:('跨层连接next','全部next为空'),117:('跨层连接next','全部next为空'),236:('只返回p的父亲','固定返回根'),1644:('只有一个目标存在也返回它','固定返回根'),1650:('只返回p的父亲','固定返回根'),1123:('只返回最后的叶子','固定返回根'),235:('只返回p的父亲','固定返回根'),285:('仅看p的右孩子','仅返回p的父亲'),426:('按层序连接','按降序连接'),1110:('仅保留原根','把所有幸存节点都当根'),652:('仅按根节点值去重','每次重复出现都输出')}

def make(pid):
 method,zh,en,dz,de=META[pid];iz,ie=input_text(pid);kind='integer-rows' if pid==138 else 'integer-set' if pid in (1110,863) else 'integer-array' if pid in ARRAYS else 'integer'
 if kind=='integer-rows':oz='第一行节点数；随后每行写2 value randomID，保留链表顺序。';oe='Print the node count, then rows 2 value randomID in list order.';emit='print(len(result))\nfor row in result:print(len(row),*row)'
 elif kind=='integer':oz='输出一个整数；节点ID题用-1表示null，判断题用0/1。';oe='Print one integer; node-ID answers use -1 for null and predicates use 0/1.';emit='print(result)'
 else:oz='第一行元素数，随后输出整数数组。';oe='Print the element count followed by the integer array.';emit='print(len(result));print(*result) if result else None'
 helper='from collections import Counter,deque\n'+inspect.getsource(adjacency)+'\n'+inspect.getsource(signatures)+'\n'+inspect.getsource(fast)
 spec=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='简单' if pid in (141,160,235) else '中等',specialId=pid,resultKind=kind,outputLimit=1024,edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=PARSE,mutants=[dict(name=name,source='import sys,json\n'+helper+'\n'+PARSE+f'\nresult=fast({pid},args,{i+1})\n'+emit+'\n') for i,name in enumerate(WRONG[pid])])
 if pid in (708,652):spec['semanticId']=pid
 return spec
PROBLEMS={pid:make(pid) for pid in IDS}
