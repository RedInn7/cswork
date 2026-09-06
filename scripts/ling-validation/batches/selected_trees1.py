"""Selected ordinary binary trees: independent serialized-tree oracles and constraints."""
import inspect
import itertools
from collections import deque, Counter
from tree_codec import TreeNode, from_level_order, to_level_order, valid_tree

IDS=[104,111,100,101,404,513,110,543,572,222,958,662,112,129,1448,437,124,1530,938,98,230,530,337,144,94,145,199]
ARRAY_IDS={144,94,145,199}
TWO_TREES={100,572}
EXTRA={112:1,437:1,1530:1,938:2,230:1}
# (minimum nodes, maximum nodes, minimum value, maximum value)
BOUNDS={104:(0,10000,-100,100),111:(0,100000,-1000,1000),100:(0,100,-10000,10000),101:(1,1000,-100,100),404:(1,1000,-1000,1000),513:(1,10000,-2**31,2**31-1),110:(0,5000,-10000,10000),543:(1,10000,-100,100),572:(1,2000,-10000,10000),222:(0,50000,0,50000),958:(1,100,1,1000),662:(1,3000,-100,100),112:(0,5000,-1000,1000),129:(1,1000,0,9),1448:(1,100000,-10000,10000),437:(0,1000,-10**9,10**9),124:(1,30000,-1000,1000),1530:(1,1024,1,100),938:(1,20000,1,100000),98:(1,10000,-2**31,2**31-1),230:(1,10000,0,10000),530:(2,10000,0,100000),337:(1,10000,0,10000),144:(0,100,-100,100),94:(0,100,-100,100),145:(0,100,-100,100),199:(0,100,-100,100)}

def adjacency(tokens):
 """Independent index model: reserve child slots instead of building TreeNodes."""
 if not tokens:return [],[],[]
 values=[tokens[0]];parents=[-1];children=[[-1,-1]];slots=deque([(0,0),(0,1)])
 for value in tokens[1:]:
  parent,side=slots.popleft()
  if value is not None:
   index=len(values);values.append(value);parents.append(parent);children.append([-1,-1]);children[parent][side]=index;slots.extend(((index,0),(index,1)))
 return values,parents,children

def oracle(pid,args):
 values,parents,children=adjacency(args[0]);n=len(values)
 depth=[];paths=[]
 for i,p in enumerate(parents):
  depth.append(1 if p<0 else depth[p]+1)
  paths.append((i,) if p<0 else paths[p]+(i,))
 leaves=[i for i,c in enumerate(children) if c==[-1,-1]]
 if pid==104:return max(depth,default=0)
 if pid==111:return min((depth[i] for i in leaves),default=0)
 if pid==100:return int(args[0]==args[1])
 if pid==101:
  positions={():values[0]};todo=[(0,())]
  while todo:
   i,path=todo.pop()
   for side,child in enumerate(children[i]):
    if child>=0:positions[path+(side,)]=values[child];todo.append((child,path+(side,)))
  return int(all(positions.get(tuple(1-b for b in path),object())==value for path,value in positions.items()))
 if pid==404:return sum(values[i] for i in leaves if parents[i]>=0 and children[parents[i]][0]==i)
 if pid==513:return values[depth.index(max(depth))]
 if pid==110:
  def height(start):
   if start<0:return 0
   q=[(start,1)];best=0
   while q:
    i,d=q.pop();best=max(best,d);q.extend((c,d+1) for c in children[i] if c>=0)
   return best
  return int(all(abs(height(left)-height(right))<=1 for left,right in children))
 if pid in (543,124,1530):
  answer=values[0] if pid==124 else 0
  for start in range(n):
   queue=deque([(start,-1,0,values[start])])
   while queue:
    i,previous,d,total=queue.popleft()
    if pid==543:answer=max(answer,d)
    if pid==124:answer=max(answer,total)
    if pid==1530 and i>start and start in leaves and i in leaves and d<=args[1]:answer+=1
    for child in children[i]+[parents[i]]:
     if child>=0 and child!=previous:queue.append((child,i,d+1,total+values[child]))
  return answer
 if pid==572:
  small,_,links=adjacency(args[1])
  def same(i,j):
   if i<0 or j<0:return i==j
   return values[i]==small[j] and all(same(u,v) for u,v in zip(children[i],links[j]))
  return int(any(same(i,0) for i in range(n)))
 if pid==222:return n
 if pid in (958,662):
  position=[0]*n
  for i,p in enumerate(parents):
   if p>=0:position[i]=2*position[p]+(1 if children[p][0]==i else 2)
  if pid==958:return int(set(position)==set(range(n)))
  return max(max(position[i] for i in range(n) if depth[i]==d)-min(position[i] for i in range(n) if depth[i]==d)+1 for d in set(depth))
 if pid==112:return int(any(sum(values[j] for j in paths[i])==args[1] for i in leaves))
 if pid==129:return sum(int(''.join(str(values[j]) for j in paths[i])) for i in leaves)
 if pid==1448:return sum(values[i]>=max(values[j] for j in paths[i]) for i in range(n))
 if pid==437:return sum(sum(values[j] for j in path[start:])==args[1] for path in paths for start in range(len(path)))
 if pid==938:return sum(v for v in values if args[1]<=v<=args[2])
 if pid==98:
  for i in range(n):
   current=i
   while parents[current]>=0:
    p=parents[current]
    if children[p][0]==current and values[i]>=values[p]:return 0
    if children[p][1]==current and values[i]<=values[p]:return 0
    current=p
  return 1
 if pid==230:return sorted(values)[args[1]-1]
 if pid==530:return min(abs(a-b) for a,b in itertools.combinations(values,2))
 if pid==337:
  return max(sum(values[i] for i in range(n) if mask>>i&1) for mask in range(1<<n) if all(not (mask>>i&1 and mask>>p&1) for i,p in enumerate(parents) if p>=0))
 if pid in (144,94,145):
  def visit(i):
   if i<0:return []
   l,r=children[i];left=visit(l);right=visit(r)
   return [values[i]]+left+right if pid==144 else left+[values[i]]+right if pid==94 else left+right+[values[i]]
  return visit(0) if n else []
 if pid==199:return [values[max(i for i in range(n) if depth[i]==d)] for d in sorted(set(depth))]
 raise AssertionError(pid)

def fast(pid,args):
 """Iterative second implementation. Safe for the true 100000-node chain."""
 root=from_level_order(args[0]);nodes=[];depth={};parent={};side={};q=deque([(root,1)]) if root else deque()
 while q:
  node,d=q.popleft();nodes.append(node);depth[node]=d
  for child,s in ((node.left,0),(node.right,1)):
   if child:parent[child]=node;side[child]=s;q.append((child,d+1))
 leaves=[u for u in nodes if not u.left and not u.right]
 if pid==104:return max(depth.values(),default=0)
 if pid==111:return min((depth[u] for u in leaves),default=0)
 if pid in (100,101,572):
  def same(a,b,mirror=False):
   stack=[(a,b)]
   while stack:
    u,v=stack.pop()
    if u is None or v is None:
     if u is not v:return False
    elif u.val!=v.val:return False
    else:stack.extend(((u.left,v.right if mirror else v.left),(u.right,v.left if mirror else v.right)))
   return True
  if pid==100:return int(same(root,from_level_order(args[1])))
  if pid==101:return int(same(root,root,True))
  other=from_level_order(args[1]);return int(any(same(node,other) for node in nodes))
 if pid==404:return sum(u.val for u in leaves if side.get(u)==0)
 if pid==513:
  deepest=max(depth.values());return next(u.val for u in nodes if depth[u]==deepest)
 if pid in (110,543,124,337,1530):
  state={None:0};answer=0 if pid!=124 else root.val;balanced=True
  for node in nodes[::-1]:
   l=state.get(node.left,0);r=state.get(node.right,0)
   if pid in (110,543):
    if abs(l-r)>1:balanced=False
    answer=max(answer,l+r);state[node]=1+max(l,r)
   elif pid==124:answer=max(answer,node.val+max(l,0)+max(r,0));state[node]=node.val+max(0,l,r)
   elif pid==337:
    take_l,skip_l=state.get(node.left,(0,0)) if node.left else (0,0);take_r,skip_r=state.get(node.right,(0,0)) if node.right else (0,0)
    state[node]=(node.val+skip_l+skip_r,max(take_l,skip_l)+max(take_r,skip_r))
   else:
    left=state.get(node.left,[]) if node.left else [];right=state.get(node.right,[]) if node.right else []
    answer+=sum(a+b+2<=args[1] for a in left for b in right)
    state[node]=[0] if not node.left and not node.right else [d+1 for d in left+right if d+1<args[1]]
  if pid==110:return int(balanced)
  if pid==337:return max(state[root])
  return answer
 if pid==222:return len(nodes)
 if pid==958:
  queue=deque([root]);gap=False
  while queue:
   u=queue.popleft()
   if u is None:gap=True
   else:
    if gap:return 0
    queue.extend((u.left,u.right))
  return 1
 if pid==662:
  queue=[(root,0)];best=0
  while queue:
   best=max(best,queue[-1][1]-queue[0][1]+1);offset=queue[0][1];nxt=[]
   for u,index in queue:
    if u.left:nxt.append((u.left,2*(index-offset)))
    if u.right:nxt.append((u.right,2*(index-offset)+1))
   queue=nxt
  return best
 if pid in (112,129,1448):
  sums={};good=0
  for u in nodes:
   previous=sums.get(parent.get(u),None)
   if pid==129:sums[u]=(previous or 0)*10+u.val
   elif pid==112:sums[u]=(previous or 0)+u.val
   else:sums[u]=u.val if previous is None else max(previous,u.val);good+=u.val==sums[u]
  if pid==112:return int(any(sums[u]==args[1] for u in leaves))
  if pid==129:return sum(sums[u] for u in leaves)
  return good
 if pid==437:
  counts=Counter({0:1});answer=0;stack=[(root,0,False)] if root else []
  while stack:
   u,total,exit=stack.pop()
   if exit:counts[total]-=1;continue
   total+=u.val;answer+=counts[total-args[1]];counts[total]+=1;stack.append((u,total,True))
   if u.right:stack.append((u.right,total,False))
   if u.left:stack.append((u.left,total,False))
  return answer
 if pid==938:
  stack=[root];total=0
  while stack:
   u=stack.pop()
   if args[1]<=u.val<=args[2]:total+=u.val
   if u.left and u.val>args[1]:stack.append(u.left)
   if u.right and u.val<args[2]:stack.append(u.right)
  return total
 if pid in (98,230,530,94):
  order=[];stack=[];u=root
  while u or stack:
   while u:stack.append(u);u=u.left
   u=stack.pop();order.append(u.val);u=u.right
  if pid==98:return int(all(a<b for a,b in zip(order,order[1:])))
  if pid==230:return order[args[1]-1]
  if pid==530:return min(b-a for a,b in zip(order,order[1:]))
  return order
 if pid in (144,145):
  out=[];stack=[(root,False)] if root else []
  while stack:
   u,done=stack.pop()
   if done:out.append(u.val);continue
   if pid==144:out.append(u.val)
   else:stack.append((u,True))
   if u.right:stack.append((u.right,False))
   if u.left:stack.append((u.left,False))
  return out
 if pid==199:
  last={}
  for u in nodes:last[depth[u]]=u.val
  return list(last.values())
 raise AssertionError(pid)

def validate(pid,args):
 assert len(args)==(2 if pid in TWO_TREES else 1+EXTRA.get(pid,0))
 for index in range(2 if pid in TWO_TREES else 1):
  low,high,lo,hi=BOUNDS[pid]
  if pid==572 and index==1:high=1000
  count=valid_tree(args[index],min_nodes=low,max_nodes=high,min_value=lo,max_value=hi,max_depth=10 if pid==129 else None,complete=pid==222,bst=pid in (938,230,530))
 if pid in (112,437):assert type(args[1])is int and -1000<=args[1]<=1000
 if pid==1530:assert type(args[1])is int and 1<=args[1]<=10
 if pid==938:assert all(type(v)is int for v in args[1:]) and 1<=args[1]<=args[2]<=100000
 if pid==230:assert type(args[1])is int and 1<=args[1]<=count
 if pid in (129,662):assert fast(pid,args)<=2**31-1

def encode(pid,args):
 out=[]
 for i in range(2 if pid in TWO_TREES else 1):
  tree=args[i];out.extend([str(len(tree)),' '.join('null' if v is None else str(v) for v in tree)])
 out.extend(map(str,args[2 if pid in TWO_TREES else 1:]));return '\n'.join(out)+'\n'

def parse(pid):
 count=2 if pid in TWO_TREES else 1
 return f'''tokens=sys.stdin.read().split();cursor=0;args=[]
for _ in range({count}):
 n=int(tokens[cursor]);cursor+=1
 args.append([None if v=='null' else int(v) for v in tokens[cursor:cursor+n]]);cursor+=n
args.extend(map(int,tokens[cursor:]))'''

def chain(n,value=1,right=False):
 if not n:return []
 values=[value(i) if callable(value) else value for i in range(n)];out=[values[0]]
 for v in values[1:]:out.extend((None,v) if right else (v,None))
 while out[-1]is None:out.pop()
 return out

def balanced_bst(values):
 def build(lo,hi):
  if lo>=hi:return None
  mid=(lo+hi)//2;return TreeNode(values[mid],build(lo,mid),build(mid+1,hi))
 return to_level_order(build(0,len(values)))

def random_args(pid,r):
 low,high,lo,hi=BOUNDS[pid]
 def random_tree(index=0):
  n=r.randint(low,max(low,9))
  if pid in (938,230,530):return balanced_bst(sorted(r.sample(range(1,50),n)))
  if pid==222:return [r.randint(0,20) for _ in range(n)]
  if not n:return []
  root=TreeNode(r.randint(max(lo,-5),min(hi,9)));slots=[(root,'left'),(root,'right')]
  for _ in range(n-1):
   index=r.randrange(len(slots));parent,side=slots.pop(index);node=TreeNode(r.randint(max(lo,-5),min(hi,9)));setattr(parent,side,node);slots.extend(((node,'left'),(node,'right')))
  return to_level_order(root)
 tree=random_tree();args=[tree]
 if pid in TWO_TREES:args.append(tree[:] if r.randrange(3)==0 else random_tree(1))
 if pid in (112,437):args.append(r.randint(-10,15))
 if pid==1530:args.append(r.randint(1,10))
 if pid==938:
  a,b=sorted([r.randint(1,50),r.randint(1,50)]);args.extend((a,b))
 if pid==230:args.append(r.randint(1,sum(v is not None for v in tree)))
 return args

EDGE={104:[[[3,9,20,None,None,15,7]],[[]],[[1]]],111:[[[1,None,2]],[[]],[[3,9,20,None,None,15,7]]],100:[[[1,2,3],[1,2,3]],[[],[]],[[1,2],[1,None,2]]],101:[[[1,2,2,3,4,4,3]],[[1,2,2,None,3,None,3]],[[1]]],404:[[[3,9,20,None,None,15,7]],[[1]],[[1,None,2]]],513:[[[2,1,3]],[[1,None,2]],[[1,2,3,4]]],110:[[[3,9,20,None,None,15,7]],[[1,2,None,3]],[[]]],543:[[[1,2,3,4,5]],[[1]],[[1,None,2]]],572:[[[3,4,5,1,2],[4,1,2]],[[3,4,5,1,2,None,None,None,None,0],[4,1,2]],[[1],[1]]],222:[[[1,2,3,4,5,6]],[[]],[[1]]],958:[[[1,2,3,4,5,6]],[[1,None,2]],[[1]]],662:[[[1,3,2,5,3,None,9]],[[1]],[[1,None,2,None,3]]],112:[[[5,4,8,11,None,13,4,7,2,None,None,None,1],22],[[],0],[[1,2],1]],129:[[[1,2,3]],[[0]],[[4,9,0,5,1]]],1448:[[[3,1,4,3,None,1,5]],[[2,2,2]],[[3,1,2]]],437:[[[10,5,-3,3,2,None,11,3,-2,None,1],8],[[0,0,0],0],[[],0]],124:[[[-10,9,20,None,None,15,7]],[[-3]],[[-2,1]]],1530:[[[1,2,3,None,4],3],[[1],1],[[1,2,3],2]],938:[[[10,5,15,3,7,None,18],7,15],[[1],1,1],[[2,1,3],1,3]],98:[[[2,1,3]],[[5,1,4,None,None,3,6]],[[1,1]],[[5,3,7,None,6]]],230:[[[3,1,4,None,2],1],[[1],1],[[2,1,3],3]],530:[[[4,2,6,1,3]],[[1,None,3]],[[10,5,15,None,9]]],337:[[[3,2,3,None,3,None,1]],[[3,4,5,1,3,None,1]],[[0]]],144:[[[1,None,2,3]],[[]],[[1,2,3]]],94:[[[1,None,2,3]],[[]],[[1,2,3]]],145:[[[1,None,2,3]],[[]],[[1,2,3]]],199:[[[1,2,3,None,5,None,4]],[[]],[[1,2,3,4]]]}

def two_arms(depth,value=1):
 root=TreeNode(value);left=right=root
 for _ in range(depth):
  left.left=TreeNode(value);left=left.left;right.right=TreeNode(value);right=right.right
 return to_level_order(root)

PRESSURE={
104:[([chain(10000)],10000),([[1]*10000],14)],
111:[([chain(100000,right=True)],100000),([[1]*100000],16)],
100:[([chain(100,-10000),chain(100,-10000)],1),([chain(100,-10000),chain(100,lambda i:10000 if i==99 else -10000)],0)],
101:[([[1]*1000],0),([two_arms(499)],1)],
404:[([chain(1000,-1000)],-1000),([chain(1000,1000,right=True)],0)],
513:[([chain(10000,lambda i:2**31-1 if i==9999 else -2**31)],2**31-1),([[-2**31]*10000],-2**31)],
110:[([chain(5000)],0),([[10000]*5000],1)],
543:[([chain(10000)],9999),([[1]*8191],24)],
572:[([chain(2000,1),chain(1000,1)],1),([chain(2000,1),chain(1000,2)],0)],
222:[([[50000]*50000],50000),([[0]*32767],32767)],
958:[([[1000]*100],1),([chain(100,right=True)],0)],
662:[([chain(3000,right=True)],1),([two_arms(30)],2**30),([[1]*3000],1024)],
112:[([chain(5000,0),0],1),([chain(5000,1),1000],0)],
129:[([[0]*500+[9]*500],4500),([[0]*1000],0),([chain(10,lambda i:1 if i==0 else 0)],1000000000)],
1448:[([chain(100000,-10000,right=True)],100000),([chain(100000,lambda i:10000 if i==0 else -10000)],1)],
437:[([chain(1000,0),0],500500),([chain(1000,lambda i:10**9 if i%2==0 else -10**9),0],250000),([chain(1000,1),1000],1)],
124:[([chain(30000,1000)],30000000),([chain(30000,-1000)],-1000)],
1530:[([chain(1024),10],0),([[1]*1023,2],256),([[1]*1023,10],16*32*31//2)],
938:[([balanced_bst(list(range(1,20001))),1,100000],200010000),([chain(20000,lambda i:i+1,right=True),99999,100000],0)],
98:[([chain(10000,lambda i:i,right=True)],1),([[0,-2**31,2**31-1]],1),([chain(10000,0)],0)],
230:[([balanced_bst(list(range(10000))),10000],9999),([chain(10000,lambda i:i,right=True),1],0)],
530:[([balanced_bst(list(range(0,100000,10)))],10),([chain(10000,lambda i:i*10,right=True)],10)],
337:[([chain(10000,10000)],50000000),([[0]*10000],0)],
144:[([chain(100,lambda i:i,right=True)],list(range(100))),([chain(100,lambda i:i)],list(range(100)))],
94:[([chain(100,lambda i:i,right=True)],list(range(100))),([chain(100,lambda i:i)],list(range(99,-1,-1)))],
145:[([chain(100,lambda i:i,right=True)],list(range(99,-1,-1))),([chain(100,lambda i:i)],list(range(99,-1,-1)))],
199:[([chain(100,lambda i:i,right=True)],list(range(100))),([chain(100,lambda i:i)],list(range(100)))],
}

META={
104:('二叉树的最大深度','Maximum Depth of Binary Tree','maxDepth','返回从根到最远叶子的路径所含节点数。空树深度为0。','Return the number of nodes on the longest root-to-leaf path. An empty tree has depth zero.'),
111:('二叉树的最小深度','Minimum Depth of Binary Tree','minDepth','返回从根到最近叶子的路径所含节点数。叶子没有左右孩子；空树深度为0。','Return the number of nodes on the shortest root-to-leaf path. A leaf has no children. An empty tree has depth zero.'),
100:('相同的树','Same Tree','isSameTree','判断两棵树的结构和每个对应节点的值是否完全相同。','Determine whether both trees have exactly the same shape and matching values at every corresponding node.'),
101:('对称二叉树','Symmetric Tree','isSymmetric','判断二叉树是否关于根左右镜像对称；结构与对应值都必须匹配。','Determine whether the tree is mirror-symmetric about its root, including both shape and corresponding values.'),
404:('左叶子之和','Sum of Left Leaves','sumOfLeftLeaves','返回所有左叶子的值之和。左叶子是其父节点的左孩子，且自身没有孩子；根不算左叶子。','Sum the values of all left leaves. A left leaf is its parent’s left child and has no children. The root is not a left leaf.'),
513:('最深层最左侧的值','Find Bottom Left Tree Value','findBottomLeftValue','返回树最深一层中最左侧节点的值。','Return the value of the leftmost node in the deepest level.'),
110:('平衡二叉树','Balanced Binary Tree','isBalanced','判断每个节点的左右子树高度差是否都不超过1；空树平衡。','Determine whether every node’s left and right subtree heights differ by at most one. An empty tree is balanced.'),
543:('二叉树的直径','Diameter of Binary Tree','diameterOfBinaryTree','返回树中任意两个节点之间最长路径的边数。路径不必经过根，单节点树答案为0。','Return the maximum number of edges on a path between any two nodes. The path need not pass through the root. A single-node tree has diameter zero.'),
572:('另一棵树的子树','Subtree of Another Tree','isSubtree','判断root中是否有一个节点，其全部后代组成的整棵子树与subRoot结构和值完全一致。不能跳过该节点的额外后代。','Determine whether a node of root and all its descendants form a subtree identical in shape and values to subRoot. Extra descendants cannot be ignored.'),
222:('完全二叉树的节点数','Count Complete Tree Nodes','countNodes','输入保证为完全二叉树：除最后一层外每层填满，最后一层节点从左向右连续排列。返回节点总数。','The input is a complete binary tree: all levels except possibly the last are full, and the last level is left-packed. Return its node count.'),
958:('判断完全二叉树','Check Completeness of a Binary Tree','isCompleteTree','判断树是否完全：除最后一层外每层填满，最后一层节点必须连续靠左。','Determine whether all levels except possibly the last are full and the last level has no gaps before its final node.'),
662:('二叉树最大宽度','Maximum Width of Binary Tree','widthOfBinaryTree','一层宽度为最左与最右非空节点之间的完整二叉树位置数，包含中间空位。返回所有层的最大宽度；答案保证不超过有符号32位整数上限。','A level’s width counts complete-tree positions from its leftmost to rightmost non-null node, including internal gaps. Return the maximum level width; the answer fits a signed 32-bit integer.'),
112:('根到叶路径和','Path Sum','hasPathSum','判断是否存在根到叶的路径，其节点值之和等于targetSum。空路径或止于非叶节点的路径不算。','Determine whether a root-to-leaf path has node sum targetSum. Empty paths and paths ending at an internal node do not count.'),
129:('根到叶数字之和','Sum Root to Leaf Numbers','sumNumbers','每个节点是一位十进制数字，按根到叶的顺序连接得到一个数字。返回所有根到叶数字的和；答案保证能用有符号32位整数表示。','Each node is a decimal digit. Concatenate digits along every root-to-leaf path and sum the resulting numbers. The result fits a signed 32-bit integer.'),
1448:('统计好节点','Count Good Nodes in Binary Tree','goodNodes','如果从根到该节点路径上没有任何值比该节点更大，该节点为好节点。返回好节点数量，根本身一定是好节点。','A node is good if no node on its root-to-node path has a greater value. Count good nodes; the root always qualifies.'),
437:('任意起点的向下路径和','Path Sum III','pathSum','统计和为targetSum的非空向下路径数量。路径可以从任意节点开始、任意后代结束，但只能沿父到子的方向。','Count nonempty downward paths summing to targetSum. A path may start at any node and end at any descendant, but follows only parent-to-child edges.'),
124:('二叉树最大路径和','Binary Tree Maximum Path Sum','maxPathSum','路径由相邻节点组成，不重复经过节点，并且至少包含一个节点。返回任意起点与终点之间路径的最大节点值之和，不要求经过根。','A path consists of adjacent nodes without repeating a node and contains at least one node. Return the maximum path sum over arbitrary endpoints; the path need not include the root.'),
1530:('距离内的叶子对','Number of Good Leaf Nodes Pairs','countPairs','统计不同叶子的无序对，使它们之间最短路径的边数不超过distance。每对只计一次。','Count unordered pairs of distinct leaves whose connecting path has at most distance edges. Count each pair once.'),
938:('二叉搜索树范围和','Range Sum of BST','rangeSumBST','输入是节点值互不相同的二叉搜索树。返回值在闭区间[low,high]中的所有节点值之和。','The input is a binary search tree with unique values. Sum all node values in the inclusive range [low,high].'),
98:('验证二叉搜索树','Validate Binary Search Tree','isValidBST','判断每个节点是否都满足整个左子树值严格更小、整个右子树值严格更大。相等值也违反条件，不能只检查直接孩子。','Determine whether every node has strictly smaller values throughout its left subtree and strictly greater values throughout its right subtree. Equal values are invalid; checking immediate children alone is insufficient.'),
230:('二叉搜索树第k小值','Kth Smallest Element in a BST','kthSmallest','输入是二叉搜索树，返回按值从小到大排列后从1开始计数的第k个节点值。','Given a binary search tree, return its one-based kth smallest node value.'),
530:('二叉搜索树最小差值','Minimum Absolute Difference in BST','getMinimumDifference','返回二叉搜索树中任意两个不同节点值的绝对差的最小值。','Return the minimum absolute difference between the values of any two distinct nodes in the binary search tree.'),
337:('树形打家劫舍','House Robber III','rob','每个节点是一所房子的金额。可选择任意节点，但不能同时选择直接相连的父子节点。返回能得到的最大金额。','Each node stores money in a house. Select any nodes without selecting both endpoints of a parent-child edge. Return the maximum total money.'),
144:('二叉树前序遍历','Binary Tree Preorder Traversal','preorderTraversal','返回按根、左子树、右子树顺序遍历得到的节点值数组。','Return node values in preorder: root, left subtree, right subtree.'),
94:('二叉树中序遍历','Binary Tree Inorder Traversal','inorderTraversal','返回按左子树、根、右子树顺序遍历得到的节点值数组。','Return node values in inorder: left subtree, root, right subtree.'),
145:('二叉树后序遍历','Binary Tree Postorder Traversal','postorderTraversal','返回按左子树、右子树、根顺序遍历得到的节点值数组。','Return node values in postorder: left subtree, right subtree, root.'),
199:('二叉树右侧视图','Binary Tree Right Side View','rightSideView','从上到下返回每一层最右侧节点的值，空树返回空数组。','Return the rightmost node value of each level from top to bottom. An empty tree returns an empty array.'),
}

TREE_ZH='每棵树用两行表示：第一行为层序token数量m，第二行为m个空白分隔的整数或null。按BFS只对非空父节点依次读取左、右孩子；不是堆下标编码。省略末尾null；空树为m=0和一个空行。m包含null，不等于实际节点数。'
TREE_EN='Each tree uses two lines: token count m, then m whitespace-separated integers or null. In BFS order, consume left and right children only for non-null parents; this is not heap-index encoding. Omit trailing nulls. An empty tree is m=0 followed by a blank line. m includes nulls and differs from the node count.'

def input_text(pid):
 lo,hi,a,b=BOUNDS[pid]
 zh=TREE_ZH+f'实际节点数在[{lo},{hi}]，节点值在[{a},{b}]。'
 en=TREE_EN+f' Actual node count in [{lo},{hi}]; values in [{a},{b}].'
 if pid in TWO_TREES:
  zh+='依次给出两棵树。';en+=' Supply the two trees in argument order.'
  if pid==572:zh+='第二棵树实际节点数为1至1000。';en+=' The second tree has 1–1000 nodes.'
 if pid in (112,437):zh+='树段之后一行targetSum，范围[-1000,1000]。';en+=' After the tree, one line targetSum in [-1000,1000].'
 if pid==1530:zh+='树段之后一行distance，1至10。';en+=' After the tree, one line distance in [1,10].'
 if pid==938:zh+='树段之后两行low、high，1≤low≤high≤100000。树为严格BST且所有节点值唯一。';en+=' After the tree, two lines low, high with 1≤low≤high≤100000. The tree is a strict BST with unique values.'
 if pid==230:zh+='树段之后一行k，1≤k≤实际节点数。树为严格BST。';en+=' After the tree, one line k, 1≤k≤actual node count. The tree is a strict BST.'
 if pid==530:zh+='树为严格BST。';en+=' The tree is a strict BST.'
 if pid==129:zh+='深度最多10层，根到叶数字总和≤2147483647。';en+=' Depth is at most 10 levels and the total root-to-leaf number sum is at most 2147483647.'
 if pid==662:zh+='最大宽度≤2147483647。';en+=' Maximum width is at most 2147483647.'
 if pid==222:zh+='保证为完全二叉树。';en+=' The tree is guaranteed complete.'
 return zh,en

WRONG={
104:[('counts edges instead of nodes','result=max(0,fast(104,args)-1)'),('uses minimum depth','result=fast(111,args)')],
111:[('uses maximum depth','result=fast(104,args)'),('treats missing child as a leaf','root=from_level_order(args[0]);q=deque([(root,1)]) if root else deque();result=0\nwhile q:\n u,d=q.popleft()\n if not u.left or not u.right:result=d;break\n q.extend(((u.left,d+1),(u.right,d+1)))')],
100:[('compares values while discarding null structure','result=int([v for v in args[0] if v is not None]==[v for v in args[1] if v is not None])'),('compares node counts alone','result=int(sum(v is not None for v in args[0])==sum(v is not None for v in args[1]))')],
101:[('requires identical rather than mirrored subtrees','r=from_level_order(args[0]);result=fast(100,[to_level_order(r.left),to_level_order(r.right)])'),('ignores null positions','a=[v for v in args[0][1:] if v is not None];result=int(a==a[::-1])')],
404:[('counts all leaves','r=from_level_order(args[0]);q=[r];result=0\nwhile q:\n u=q.pop()\n if not u.left and not u.right:result+=u.val\n if u.left:q.append(u.left)\n if u.right:q.append(u.right)'),('counts every left child','r=from_level_order(args[0]);q=[r];result=0\nwhile q:\n u=q.pop()\n if u.left:result+=u.left.val;q.append(u.left)\n if u.right:q.append(u.right)')],
513:[('takes deepest rightmost value','result=fast(199,args)[-1]'),('follows left children only','r=from_level_order(args[0])\nwhile r.left:r=r.left\nresult=r.val')],
110:[('checks only the root','r=from_level_order(args[0]);result=1 if r is None else int(abs(fast(104,[to_level_order(r.left)])-fast(104,[to_level_order(r.right)]))<=1)'),('requires exactly equal heights','r=from_level_order(args[0]);result=1 if r is None else int(fast(104,[to_level_order(r.left)])==fast(104,[to_level_order(r.right)]))')],
543:[('counts diameter nodes instead of edges','result=fast(543,args)+1'),('forces path to pass through root','r=from_level_order(args[0]);result=fast(104,[to_level_order(r.left)])+fast(104,[to_level_order(r.right)])')],
572:[('checks root equality only','result=fast(100,args)'),('only checks whether subtree root value occurs','result=int(args[1][0] in args[0])')],
222:[('counts edges rather than nodes','result=max(0,len(args[0])-1)'),('assumes the last level is full','result=2**fast(104,args)-1')],
958:[('confuses complete with balanced','result=fast(110,args)'),('confuses complete with perfect','result=int(sum(v is not None for v in args[0])==2**fast(104,args)-1)')],
662:[('ignores internal null gaps','r=from_level_order(args[0]);q=[r];result=0\nwhile q:\n result=max(result,len(q));q=[c for u in q for c in (u.left,u.right) if c]'),('uses tree depth as width','result=fast(104,args)')],
112:[('accepts any downward path','result=int(fast(437,args)>0)'),('ignores the target and tests total tree sum','result=int(sum(v for v in args[0] if v is not None)==args[1])')],
129:[('sums digits without place values','result=sum(v for v in args[0] if v is not None)'),('uses binary place values','r=from_level_order(args[0]);q=[(r,0)];result=0\nwhile q:\n u,v=q.pop();v=2*v+u.val\n if not u.left and not u.right:result+=v\n if u.left:q.append((u.left,v))\n if u.right:q.append((u.right,v))')],
1448:[('requires strictly greater than all ancestors','r=from_level_order(args[0]);q=[(r,float("-inf"))];result=0\nwhile q:\n u,m=q.pop();result+=u.val>m;m=max(m,u.val)\n if u.left:q.append((u.left,m))\n if u.right:q.append((u.right,m))'),('compares only to immediate parent','r=from_level_order(args[0]);q=[r];result=1\nwhile q:\n u=q.pop()\n for c in (u.left,u.right):\n  if c:result+=c.val>=u.val;q.append(c)')],
437:[('counts only root to leaf existence','result=fast(112,args)'),('counts empty paths when target is zero','result=fast(437,args)+(sum(v is not None for v in args[0])+1 if args[1]==0 else 0)')],
124:[('allows empty path on negative trees','result=max(0,fast(124,args))'),('sums all positive nodes even across branches','result=sum(max(0,v) for v in args[0] if v is not None)')],
1530:[('uses strict distance cutoff','result=fast(1530,[args[0],args[1]-1])'),('counts ordered leaf pairs twice','result=2*fast(1530,args)')],
938:[('excludes range endpoints','result=sum(v for v in args[0] if v is not None and args[1]<v<args[2])'),('sums the entire tree','result=sum(v for v in args[0] if v is not None)')],
98:[('checks immediate children only','r=from_level_order(args[0]);q=[r];result=1\nwhile q:\n u=q.pop()\n if u.left:result &= int(u.left.val<u.val);q.append(u.left)\n if u.right:result &= int(u.right.val>u.val);q.append(u.right)'),('allows duplicate BST values','a=fast(94,args);result=int(all(x<=y for x,y in zip(a,a[1:])))')],
230:[('uses zero based k','a=fast(94,[args[0]]);result=a[min(args[1],len(a)-1)]'),('uses preorder rank','result=fast(144,[args[0]])[args[1]-1]')],
530:[('checks only parent child differences','r=from_level_order(args[0]);q=[r];result=float("inf")\nwhile q:\n u=q.pop()\n for c in (u.left,u.right):\n  if c:result=min(result,abs(u.val-c.val));q.append(c)'),('takes maximum minus minimum','a=[v for v in args[0] if v is not None];result=max(a)-min(a)')],
337:[('chooses one depth parity globally','r=from_level_order(args[0]);q=[(r,0)];s=[0,0]\nwhile q:\n u,d=q.pop();s[d%2]+=u.val\n if u.left:q.append((u.left,d+1))\n if u.right:q.append((u.right,d+1))\nresult=max(s)'),('sums every node','result=sum(v for v in args[0] if v is not None)')],
144:[('uses inorder','result=fast(94,args)'),('uses breadth first order','result=[v for v in args[0] if v is not None]')],
94:[('uses preorder','result=fast(144,args)'),('sorts values instead of traversing','result=sorted(v for v in args[0] if v is not None)')],
145:[('uses preorder','result=fast(144,args)'),('reverses preorder without swapping children','result=fast(144,args)[::-1]')],
199:[('takes leftmost node per level','r=from_level_order(args[0]);q=[r] if r else [];result=[]\nwhile q:\n result.append(q[0].val);q=[c for u in q for c in (u.left,u.right) if c]'),('follows the right child chain only','r=from_level_order(args[0]);result=[]\nwhile r:result.append(r.val);r=r.right')],
}

# Small witnesses distinguish each intentionally wrong semantic rule.
EDGE[100].append([[1],[2]])
EDGE[101].append([[1,2,2,None,3,3]])
EDGE[404].append([[1,2,None,3]])
EDGE[110].extend([[[1,2,2,3,None,None,3,4,None,None,4]],[[1,2]]])
EDGE[543].append([[1,2,None,3,4,5,None,None,6]])
EDGE[1448].append([[5,1,None,2]])
EDGE[530].append([[20,10,30,None,19]])
EDGE[337].append([[1,10,1,None,None,10,10]])
EDGE[144].append([[1,2,3,4]])


def make(pid):
 zh,en,method,dz,de=META[pid];iz,ie=input_text(pid);kind='integer-array' if pid in ARRAY_IDS else 'integer'
 # Only authored helpers are embedded in mutant stdin programs. The reference
 # wrapper embeds tree_codec separately and applies treeArgs on both input paths.
 helper='from collections import deque,Counter\n'+inspect.getsource(TreeNode)+'\n'+inspect.getsource(from_level_order)+'\n'+inspect.getsource(to_level_order)+'\n'+inspect.getsource(fast)+'\n'
 emit='print(len(result));print(*result) if result else None' if pid in ARRAY_IDS else 'print(int(result))'
 return dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh='第一行输出元素数量，随后用空白分隔所有整数，严格保留遍历顺序和重复值。' if pid in ARRAY_IDS else '输出一个整数；判断题输出1表示是、0表示否。',outputEn='Print the element count on the first line, then whitespace-separated integers in the required traversal order, preserving repeated values.' if pid in ARRAY_IDS else 'Print one integer; for a yes/no answer use 1 for yes and 0 for no.',difficulty='困难' if pid==124 else '简单' if pid in {104,111,100,101,404,110,543,572,222,112,938,530,144,94,145} else '中等',treeArgs=[0,1] if pid in TWO_TREES else [0],resultKind=kind,edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[{'name':name,'source':'import sys\n'+helper+parse(pid)+'\n'+body+'\n'+emit+'\n'} for name,body in WRONG[pid]])
PROBLEMS={pid:make(pid) for pid in IDS}
