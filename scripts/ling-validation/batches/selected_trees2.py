"""Unique tree transformations and ordered traversals; entirely authored fixtures.

701 is excluded because insertion shape is not unique. 257 needs repeated-path
multiset semantics and is intentionally not converted to a set.
"""
import inspect
from collections import deque, defaultdict
from tree_codec import TreeNode, from_level_order, to_level_order, valid_tree

IDS=[226,617,102,107,103,314,987,545,105,106,654,114,700,669,538,99]
ROWS={102,107,103,314,987}
CONSTRUCT={105,106,654}
BOUNDS={226:(0,100,-100,100),617:(0,2000,-10000,10000),102:(0,2000,-1000,1000),107:(0,2000,-1000,1000),103:(0,2000,-100,100),314:(0,100,-100,100),987:(1,1000,0,1000),545:(1,10000,-1000,1000),114:(0,2000,-100,100),700:(1,5000,1,10**7),669:(1,10000,0,10000),538:(0,10000,-10000,10000),99:(2,1000,-2**31,2**31-1)}

def positions(tokens):
 """Independent path-address map: never constructs shared transport TreeNodes."""
 if not tokens:return {}
 result={():tokens[0]};slots=deque([(0,),(1,)])
 for value in tokens[1:]:
  path=slots.popleft()
  if value is not None:result[path]=value;slots.extend((path+(0,),path+(1,)))
 return result

def serialize(mapping):
 if not mapping:return []
 out=[];q=deque([()])
 while q:
  p=q.popleft();out.append(mapping.get(p))
  if p in mapping:q.extend((p+(0,),p+(1,)))
 while out and out[-1] is None:out.pop()
 return out

def oracle(pid,args):
 if pid in CONSTRUCT:
  def build(a,b,path):
   if not a:return {}
   if pid==654:
    root=max(a);k=a.index(root);left,right=a[:k],a[k+1:];bl=br=[]
   elif pid==105:
    root=a[0];k=b.index(root);left,right=a[1:k+1],a[k+1:];bl,br=b[:k],b[k+1:]
   else:
    root=b[-1];k=a.index(root);left,right=a[:k],a[k+1:];bl,br=b[:k],b[k:-1]
   return {path:root,**build(left,bl,path+(0,)),**build(right,br,path+(1,))}
  return serialize(build(args[0],args[1] if len(args)>1 else [],()))
 m=positions(args[0]);paths=sorted(m);n=len(m)
 if pid==226:return serialize({tuple(1-s for s in p):v for p,v in m.items()})
 if pid==617:
  other=positions(args[1]);return serialize({p:m.get(p,0)+other.get(p,0) for p in m.keys()|other.keys()})
 if pid in ROWS:
  if pid in (102,107,103):
   rows=[[m[p] for p in paths if len(p)==d] for d in range(max(map(len,paths),default=-1)+1)]
   if pid==107:rows.reverse()
   if pid==103:rows=[r[::-1] if i%2 else r for i,r in enumerate(rows)]
   return rows
  cols=sorted({sum(2*s-1 for s in p) for p in paths})
  return [[m[p] for p in sorted((p for p in paths if sum(2*s-1 for s in p)==c),key=(lambda p:(len(p),m[p],p)) if pid==987 else (lambda p:(len(p),p)))] for c in cols]
 if pid==545:
  leaf=lambda p:p+(0,) not in m and p+(1,) not in m
  left=[];p=(0,)
  while p in m:
   if not leaf(p):left.append(p)
   p=p+((0,) if p+(0,) in m else (1,))
  right=[];p=(1,)
  while p in m:
   if not leaf(p):right.append(p)
   p=p+((1,) if p+(1,) in m else (0,))
  order=[()]+left+[p for p in paths if p and leaf(p)]+right[::-1]
  return [m[p] for p in order]
 if pid==114:return serialize({(1,)*i:m[p] for i,p in enumerate(paths)})
 if pid==700:
  hit=next((p for p in paths if m[p]==args[1]),None)
  return [] if hit is None else serialize({p[len(hit):]:v for p,v in m.items() if p[:len(hit)]==hit})
 if pid==669:
  def trim(p):
   if p not in m:return {}
   if m[p]<args[1]:return trim(p+(1,))
   if m[p]>args[2]:return trim(p+(0,))
   return {():m[p],**{(0,)+q:v for q,v in trim(p+(0,)).items()},**{(1,)+q:v for q,v in trim(p+(1,)).items()}}
  return serialize(trim(()))
 if pid==538:return serialize({p:sum(v for v in m.values() if v>=old) for p,old in m.items()})
 if pid==99:
  # Exhaust every possible swapped pair and check strict BST ancestor bounds.
  for i,p in enumerate(paths):
   for q in paths[i+1:]:
    trial=dict(m);trial[p],trial[q]=trial[q],trial[p]
    if all(all(trial[t]<trial[t[:k]] if s==0 else trial[t]>trial[t[:k]] for k,s in enumerate(t)) for t in paths):return serialize(trial)
  raise AssertionError('not one swapped pair')
 raise AssertionError(pid)

def fast(pid,args,bug=0):
 """Separate node-based implementation, also supplies realistic wrong variants."""
 def nodes(root,order='pre'):
  out=[];stack=[(root,0)] if root else []
  while stack:
   u,state=stack.pop()
   if u is None:continue
   if state:out.append(u);continue
   if order=='in':stack.extend(((u.right,0),(u,1),(u.left,0)))
   elif order=='post':stack.extend(((u,1),(u.right,0),(u.left,0)))
   else:out.append(u);stack.extend(((u.right,0),(u.left,0)))
  return out
 if pid in CONSTRUCT:
  if pid==654:
   stack=[]
   for value in args[0]:
    u=TreeNode(value)
    while stack and (stack[-1].val<value if bug!=1 else stack[-1].val>value):u.left=stack.pop()
    if stack:stack[-1].right=u
    stack.append(u)
   root=stack[0]
  else:
   # Iterative interval tasks avoid recursion at the genuine skewed limit.
   first,second=args;ino=second if pid==105 else first;order=first if pid==105 else second;loc={v:i for i,v in enumerate(ino)}
   dummy=TreeNode();todo=[(0,len(ino),0,len(order),dummy,'left')]
   while todo:
    l,h,a,b,parent,side=todo.pop()
    if l==h:continue
    value=order[a] if pid==105 else order[b-1];k=loc[value];u=TreeNode(value);setattr(parent,side,u);size=k-l
    if pid==105:todo.extend(((k+1,h,a+1+size,b,u,'right'),(l,k,a+1,a+1+size,u,'left')))
    else:todo.extend(((k+1,h,a+size,b-1,u,'right'),(l,k,a,a+size,u,'left')))
   root=dummy.left
   if bug==1:
    for u in nodes(root):u.left,u.right=u.right,u.left
  if bug==2:
   # Incorrectly emit the traversal values as a complete level-order tree.
   return args[0][:]
  return to_level_order(root)
 root=from_level_order(args[0])
 if pid==226:
  for u in ([root] if bug==1 and root else nodes(root)):
   if bug==2 and u.left is None:continue
   u.left,u.right=u.right,u.left
 if pid==617:
  other=from_level_order(args[1]);dummy=TreeNode();todo=[(root,other,dummy,'left')]
  while todo:
   a,b,parent,side=todo.pop()
   if a is None and b is None:continue
   if bug==1 and (a is None or b is None):continue
   u=TreeNode((a.val if a else 0)+(b.val if b and bug!=2 else 0));setattr(parent,side,u)
   todo.extend(((a.left if a else None,b.left if b else None,u,'left'),(a.right if a else None,b.right if b else None,u,'right')))
  root=dummy.left
 if pid in ROWS:
  q=deque([(root,0,0)] if root else []);levels=defaultdict(list);cols=defaultdict(list)
  while q:
   u,d,c=q.popleft();levels[d].append(u.val);cols[c].append((d,u.val))
   if u.left:q.append((u.left,d+1,c-1))
   if u.right:q.append((u.right,d+1,c+1))
  if pid in (102,107,103):
   result=list(levels.values())
   if pid==107 and bug!=1:result.reverse()
   if pid==103:result=[v[::-1] if (i%2==1 if bug!=1 else i%2==0) else v for i,v in enumerate(result)]
   if pid==102 and bug==1:result.reverse()
   if bug==2:result=[sorted(row) for row in result]
  else:
   result=[]
   for c in sorted(cols,reverse=bug==1):
    row=cols[c]
    if (pid==987 and bug!=2) or (pid==314 and bug==2):row=sorted(row)
    result.append([v for d,v in row])
  return result
 if pid==545:
  leaf=lambda u:not u.left and not u.right
  result=[root.val];u=root.left
  while u:
   if not leaf(u) or bug==1:result.append(u.val)
   u=u.left or u.right
  result.extend(u.val for u in nodes(root) if u is not root and leaf(u))
  right=[];u=root.right
  while u:
   if not leaf(u) or bug==1:right.append(u.val)
   u=u.right or u.left
  return result+(right if bug==2 else right[::-1])
 if pid==114:
  order=nodes(root,'in' if bug==1 else 'pre')
  for i,u in enumerate(order):
   if bug!=2:u.left=None
   u.right=order[i+1] if i+1<len(order) else None
  root=order[0] if order else None
  if bug==2:
   # A common shortcut keeps only the original right chain, dropping left nodes.
   return to_level_order(from_level_order(args[0]))
 if pid==700:
  while root and root.val!=args[1]:
   if bug==1:root=None;break
   root=root.left if (args[1]<root.val if bug!=2 else args[1]>root.val) else root.right
 if pid==669:
  low,high=args[1:]
  if bug==1:low+=1;high-=1
  def acceptable(u):
   while u and not low<=u.val<=high:u=u.right if u.val<low else u.left
   return u
  root=acceptable(root)
  for u in nodes(root,'post'):
   if bug!=2:u.left=acceptable(u.left);u.right=acceptable(u.right)
 if pid==538:
  total=0
  for u in nodes(root,'in')[::1 if bug==2 else -1]:
   old=u.val;total+=old;u.val=total-old if bug==1 else total
 if pid==99:
  arr=nodes(root,'in');bad=[i for i in range(len(arr)-1) if arr[i].val>arr[i+1].val]
  if bug==1:
   i=min(range(len(arr)),key=lambda i:arr[i].val);j=max(range(len(arr)),key=lambda i:arr[i].val)
  else:i,j=bad[0],bad[0]+1 if bug==2 else bad[-1]+1
  arr[i].val,arr[j].val=arr[j].val,arr[i].val
 return to_level_order(root)

def right_chain(values):
 out=[]
 for value in values:
  if out:out.append(None)
  out.append(value)
 return out

def balanced(values):
 if not values:return []
 root=TreeNode();todo=[(root,0,len(values))]
 while todo:
  u,l,h=todo.pop();m=(l+h)//2;u.val=values[m]
  if l<m:u.left=TreeNode();todo.append((u.left,l,m))
  if m+1<h:u.right=TreeNode();todo.append((u.right,m+1,h))
 return to_level_order(root)

def traversals(tokens):
 m=positions(tokens)
 pre=[m[p] for p in sorted(m)]
 # Inorder path order is the lexicographic order of path digits with terminator 1,
 # left encoded 0 and right 2.
 ino=[m[p] for p in sorted(m,key=lambda p:tuple(2*s for s in p)+(1,))]
 post=[m[p] for p in sorted(m,key=lambda p:tuple(s for s in p)+(2,))]
 return pre,ino,post

def random_args(pid,r):
 if pid in CONSTRUCT:
  values=r.sample(range(0,30) if pid==654 else range(-30,31),r.randint(1,9))
  if pid==654:return [values]
  # Random insertion builds a genuine compatible traversal pair.
  root=TreeNode(values[0])
  for value in values[1:]:
   u=root
   while True:
    side=r.choice(('left','right'))
    if getattr(u,side) is None:setattr(u,side,TreeNode(value));break
    u=getattr(u,side)
  pre,ino,post=traversals(to_level_order(root));return [pre,ino] if pid==105 else [ino,post]
 lo,hi,mn,mx=BOUNDS[pid];n=r.randint(max(lo,2 if pid==99 else 0),9)
 if pid in (700,669,538,99):
  vals=sorted(r.sample(range(max(mn,0),min(mx,100)+1),n));tokens=balanced(vals)
  if pid==99:
   ix=r.sample([i for i,v in enumerate(tokens) if v is not None],2);tokens[ix[0]],tokens[ix[1]]=tokens[ix[1]],tokens[ix[0]]
 else:
  tokens=[]
  if n:
   root=TreeNode(r.randint(max(mn,-10),min(mx,10)));available=[root]
   for _ in range(n-1):
    u=r.choice(available);side=r.choice([s for s in ('left','right') if getattr(u,s) is None]);v=TreeNode(r.randint(max(mn,-10),min(mx,10)));setattr(u,side,v);available.append(v)
    if u.left and u.right:available.remove(u)
   tokens=to_level_order(root)
 if pid==617:return [tokens,random_args(226,r)[0]]
 if pid==700:return [tokens,r.choice([v for v in tokens if v is not None]+[101])]
 if pid==669:
  a,b=sorted([r.randint(0,100),r.randint(0,100)]);return [tokens,a,b]
 return [tokens]

def validate(pid,args):
 if pid in CONSTRUCT:
  n=len(args[0]);assert 1<=n<=(1000 if pid==654 else 3000)
  for arr in args:
   assert type(arr) is list and len(arr)==n and len(set(arr))==n
   assert all(type(v) is int and (0<=v<=1000 if pid==654 else -3000<=v<=3000) for v in arr)
  if pid!=654:
   assert len(args)==2 and set(args[0])==set(args[1])
   # Compatible traversals: iterative interval membership, not just same set.
   first,second=args;ino=second if pid==105 else first;order=first if pid==105 else second;loc={v:i for i,v in enumerate(ino)};todo=[(0,n,0,n)]
   while todo:
    l,h,a,b=todo.pop()
    if l==h:continue
    k=loc[order[a] if pid==105 else order[b-1]];assert l<=k<h;size=k-l
    if pid==105:todo.extend(((l,k,a+1,a+1+size),(k+1,h,a+1+size,b)))
    else:todo.extend(((l,k,a,a+size),(k+1,h,a+size,b-1)))
  return True
 minimum,maximum,low,high=BOUNDS[pid]
 for t in args[:2 if pid==617 else 1]:valid_tree(t,min_nodes=minimum,max_nodes=maximum,min_value=low,max_value=high,bst=pid in (700,669,538))
 if pid==700:assert type(args[1]) is int and 1<=args[1]<=10**7
 if pid==669:assert all(type(v) is int for v in args[1:]) and 0<=args[1]<=args[2]<=10000
 if pid==99:
  # Strict inorder must differ from its sorted form at precisely two positions.
  root=from_level_order(args[0]);stack=[];vals=[]
  while stack or root:
   while root:stack.append(root);root=root.left
   root=stack.pop();vals.append(root.val);root=root.right
  assert len(set(vals))==len(vals) and sum(a!=b for a,b in zip(vals,sorted(vals)))==2
 return True

def encode(pid,args):
 out=[]
 for arr in args[:2 if pid in (617,105,106) else 1]:out.extend((str(len(arr)),' '.join('null' if v is None else str(v) for v in arr)))
 if pid in (700,669):out.append(' '.join(map(str,args[1:])))
 return '\n'.join(out)+'\n'

def parse(pid):
 return "tokens=iter(sys.stdin.read().split())\ndef read():\n n=int(next(tokens));return [None if (v:=next(tokens))=='null' else int(v) for _ in range(n)]\nargs=[read()"+(',read()' if pid in (617,105,106) else '')+"]"+(';args.extend(int(next(tokens)) for _ in range('+str(1 if pid==700 else 2)+'))' if pid in (700,669) else '')

EDGE={
226:[[[4,2,7,1,3,6,9]],[[]],[[1,None,2,3]]],617:[[[1,3,2,5],[2,1,3,None,4,None,7]],[[],[1]],[[1],[]]],
102:[[[3,9,20,None,None,15,7]],[[]],[[1,5,2,4]]],107:[[[3,9,20,None,None,15,7]],[[]],[[1,5,2,4]]],103:[[[3,9,20,None,None,15,7]],[[]],[[1,2,5,9,8,7,6]]],
314:[[[3,9,8,4,0,1,7]],[[]],[[1,2,3,None,9,4]]],987:[[[3,9,20,None,None,15,7]],[[1,2,3,None,9,4]],[[1]]],
545:[[[1,2,3,4,5,6,7]],[[1]],[[1,None,2,None,3,None,4]]],
105:[[[3,9,20,15,7],[9,3,15,20,7]],[[1],[1]],[[2,1,3],[1,2,3]]],106:[[[9,3,15,20,7],[9,15,7,20,3]],[[1],[1]],[[1,2,3],[1,3,2]]],654:[[[3,2,1,6,0,5]],[[1]],[[1,2,3]]],
114:[[[1,2,5,3,4,None,6]],[[]],[[1,2]]],700:[[[4,2,7,1,3],2],[[4,2,7,1,3],5],[[1],1]],
669:[[[3,0,4,None,2,None,None,1],1,3],[[2,1,3],1,3],[[1],2,3]],538:[[[4,1,6,0,2,5,7,None,None,None,3,None,None,None,8]],[[]],[[-1,-2,0]]],
99:[[[3,1,4,None,None,2]],[[1,3,None,None,2]],[[2,3,1]],[[2,-2147483648,2147483647]]]
}
# The final 99 example must have exactly two displaced values.
EDGE[99][-1]=[[2,2147483647,-2147483648]]

PRESSURE={
226:[([right_chain([100]*100)],serialize({(0,)*i:100 for i in range(100)}))],
617:[([[10000]*2000,[10000]*2000],[20000]*2000)],
102:[([right_chain([1000]*2000)],[[1000] for _ in range(2000)])],107:[([right_chain([1000]*2000)],[[1000] for _ in range(2000)])],103:[([right_chain([100]*2000)],[[100] for _ in range(2000)])],
314:[([right_chain([100]*100)],[[100] for _ in range(100)])],987:[([right_chain([1000]*1000)],[[1000] for _ in range(1000)])],
545:[([right_chain([1000]*10000)],[1000]*10000)],
105:[([list(range(3000)),list(range(3000))],right_chain(list(range(3000))))],106:[([list(range(3000)),list(range(2999,-1,-1))],right_chain(list(range(3000))))],
654:[([list(range(999,-1,-1))],right_chain(list(range(999,-1,-1))))],114:[([[100]*2000],right_chain([100]*2000))],
700:[([right_chain(list(range(1,5001))),5000],[5000])],669:[([right_chain(list(range(10000))),5000,9999],right_chain(list(range(5000,10000))))],
538:[([balanced(list(range(10000)))],[None if v is None else (v+9999)*(10000-v)//2 for v in balanced(list(range(10000)))])],
99:[([right_chain([999]+list(range(1,999))+[0])],right_chain(list(range(1000))))]
}

META={
226:('invertTree','翻转二叉树','Invert Binary Tree','交换每个节点的左右子树，输出镜像树。','Swap every node’s left and right subtrees and return the mirrored tree.'),
617:('mergeTrees','合并二叉树','Merge Binary Trees','从两棵根开始重叠；重叠节点的值相加，只有一棵存在的节点保留原子树。','Overlay the two roots: sum overlapping node values and retain the subtree where only one tree has a node.'),
102:('levelOrder','二叉树层序遍历','Level Order Traversal','从顶层到底层，每层从左到右输出节点值。','Return levels from top to bottom, each ordered left to right.'),
107:('levelOrderBottom','自底向上层序遍历','Bottom-Up Level Order','从底层到顶层，每层仍从左到右输出节点值。','Return levels from bottom to top, preserving left-to-right order within each level.'),
103:('zigzagLevelOrder','之字形层序遍历','Zigzag Level Order','从顶层到底层，根所在层从左到右，下一层从右到左，交替进行。','Return levels from top to bottom, alternating left-to-right and right-to-left, starting left-to-right at the root.'),
314:('verticalOrder','二叉树垂直遍历','Vertical Order Traversal','根坐标为行0列0；左孩子行加1列减1，右孩子行加1列加1。按列从左到右、每列从上到下输出；同行同列按树中从左到右的次序。','Place the root at row 0, column 0; children increment the row and move one column left/right. Output columns left to right, top to bottom within a column; ties retain tree left-to-right order.'),
987:('verticalTraversal','按值打破并列的垂直遍历','Vertical Traversal with Value Ties','根坐标行0列0；左孩子行加1列减1，右孩子行加1列加1。按列递增分组，组内行递增；同行同列按节点值递增。保留重复值。','Root coordinates are (0,0); children move one row down and one column left/right. Group by increasing column, then increasing row; break row/column ties by increasing value, preserving duplicates.'),
545:('boundaryOfBinaryTree','二叉树边界','Boundary of Binary Tree','依次输出根、左边界非叶节点、从左到右所有叶节点、逆序右边界非叶节点，不重复节点。左边界从根左孩子出发优先向左，无左向右；右边界从根右孩子出发优先向右，无右向左。根本身是叶时只输出一次。','Output the root, nonleaf left boundary, all leaves left to right, then reversed nonleaf right boundary, without repeating nodes. Start boundaries at the corresponding root child, preferring the outer child and otherwise the inner child. A leaf root appears once.'),
105:('buildTree','前序中序重建树','Build from Preorder and Inorder','给定同一棵树的前序遍历和中序遍历，节点值互不相同，重建唯一二叉树。','Reconstruct the unique tree from its preorder and inorder traversals with distinct node values.'),
106:('buildTree','中序后序重建树','Build from Inorder and Postorder','给定同一棵树的中序遍历和后序遍历，节点值互不相同，重建唯一二叉树。','Reconstruct the unique tree from its inorder and postorder traversals with distinct node values.'),
654:('constructMaximumBinaryTree','最大二叉树','Maximum Binary Tree','根取数组最大值，最大值左侧子数组递归生成左子树，右侧生成右子树；空子数组对应空树。','Use the maximum array value as root and recursively construct left/right subtrees from the portions before/after it; an empty portion yields an empty subtree.'),
114:('flatten','按前序展开二叉树','Flatten in Preorder','按原树前序次序把节点连接成仅有右孩子的链，所有左孩子置空，输出修改后的树。','Connect nodes into a right-child-only chain in original preorder, clearing every left child; output the modified tree.'),
700:('searchBST','搜索二叉搜索树','Search a BST','在严格二叉搜索树中寻找目标值，输出以该节点为根的完整子树；不存在输出空树。','Find the target in a strict BST and return the complete subtree rooted there, or an empty tree when absent.'),
669:('trimBST','修剪二叉搜索树','Trim a BST','只保留值在闭区间[low,high]的节点，保留剩余节点间的相对祖先结构。根可以改变，答案唯一。','Keep only values in the inclusive interval [low,high], preserving the relative ancestor structure of remaining nodes. The root may change; the result is unique.'),
538:('convertBST','二叉搜索树累加树','Greater Sum Tree','每个节点值替换为原树中大于或等于该值的所有节点值之和，保持树形不变。','Replace each value with the sum of original values greater than or equal to it, preserving the tree shape.'),
99:('recoverTree','恢复交换节点的搜索树','Recover Swapped BST','恰好两个节点值被交换，使严格二叉搜索树出错；交换回来恢复搜索树，不能改变结构。','Exactly two node values were swapped in a strict BST; restore their correct values without changing the tree structure.')
}
WRONG={226:('只翻转根','跳过缺少左孩子的节点'),617:('丢弃不重叠子树','忘记加第二棵树'),102:('自底向上输出','每层按值排序'),107:('自顶向下输出','每层按值排序'),103:('反转错误的层','每层排序'),314:('列顺序反向','同行同列错误按值排序'),987:('列顺序反向','同行同列没有按值排序'),545:('边界叶子重复','右边界没有逆序'),105:('左右子树交换','把前序当层序'),106:('左右子树交换','把中序当层序'),654:('用最小值作为根','把原数组当层序'),114:('按中序连接','未做展开'),700:('只检查根','走错搜索方向'),669:('错误排除区间端点','仅修剪根'),538:('遗漏节点自身','累加较小值'),99:('交换最小最大值','只修复首个逆序对')}

def input_text(pid):
 if pid in CONSTRUCT:
  if pid==654:return ('第一行n，第二行n个互异整数；1≤n≤1000，值0–1000。','First line n, then n distinct integers; 1≤n≤1000, values 0–1000.')
  order='前序、中序' if pid==105 else '中序、后序';eng='preorder, inorder' if pid==105 else 'inorder, postorder'
  return (f'按{order}顺序输入两组数组，每组先输入长度n，再输入n个整数。两组长度相同，1≤n≤3000，值在[-3000,3000]且互异，保证是同一棵树的合法遍历。',f'Provide two arrays in {eng} order, each as length n followed by n integers. Both lengths match, 1≤n≤3000, values lie in [-3000,3000] and are distinct. Traversals are guaranteed compatible with the same tree.')
 mi,ma,lo,hi=BOUNDS[pid]
 zh=f'每棵树先输入层序标记数m，再输入m个整数或null；只有非空父节点消耗接下来的两个孩子位置。空树m=0，不写冗余末尾null。每棵树节点数{mi}–{ma}，值[{lo},{hi}]。'
 en=f'For each tree, give its level-order token count m followed by m integers or null. Only non-null parents consume the next two child positions. An empty tree has m=0; omit redundant trailing nulls. Each tree has {mi}–{ma} nodes with values in [{lo},{hi}].'
 if pid==617:zh+='依次输入两棵树。';en+=' Supply root1 followed by root2.'
 if pid in (700,669,538):zh+='保证是节点值互异的严格二叉搜索树。';en+=' The tree is a strict BST with distinct values.'
 if pid==700:zh+='树后输入目标值val，1≤val≤10000000。';en+=' After the tree give target val, 1≤val≤10000000.'
 if pid==669:zh+='树后输入low和high，0≤low≤high≤10000。';en+=' After the tree give low and high, 0≤low≤high≤10000.'
 if pid==99:zh+='保证原为严格搜索树且恰好一对节点值被交换。';en+=' The original tree was a strict BST and exactly one pair of node values was swapped.'
 return zh,en

def make(pid):
 method,zh,en,dz,de=META[pid];iz,ie=input_text(pid)
 kind='integer-rows' if pid in ROWS else 'integer-array' if pid==545 else 'nullable-integer-array'
 if pid in ROWS:
  oz='第一行输出行数；随后每行先输出本行长度，再输出该行所有整数，保留重复值与指定次序。例如[[3],[9,20]]输出：2\n1 3\n2 9 20。空结果只输出0。'
  oe='Print the row count, then one line per row containing its length followed by its integers, preserving repetitions and order. Example [[3],[9,20]]: 2\n1 3\n2 9 20. For an empty result print only 0.'
 else:
  oz='第一行输出元素数量，之后输出按要求排序的整数。' if pid==545 else '第一行输出规范层序标记数，之后输出整数或null；按输入的非空父节点规则展开，去掉末尾null。空树只输出0。'
  oe='Print the element count, followed by integers in the required order.' if pid==545 else 'Print the canonical level-order token count, then integers or null using the input non-null-parent rule. Omit trailing nulls; print only 0 for an empty tree.'
 helper='from collections import deque,defaultdict\n'+inspect.getsource(TreeNode)+'\n'+inspect.getsource(from_level_order)+'\n'+inspect.getsource(to_level_order)+'\nROWS='+repr(ROWS)+'\nCONSTRUCT='+repr(CONSTRUCT)+'\n'+inspect.getsource(fast)
 emit="print(len(result))\nfor row in result:print(len(row),*row)" if pid in ROWS else "print(len(result))\nprint(*('null' if v is None else v for v in result)) if result else None"
 spec=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='困难' if pid in {99,987,545} else '简单' if pid in {226,617,700} else '中等',resultKind=kind,outputLimit=512,edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[dict(name=name,source='import sys\n'+helper+'\n'+parse(pid)+f'\nresult=fast({pid},args,{i+1})\n'+emit+'\n') for i,name in enumerate(WRONG[pid])])
 if pid not in CONSTRUCT:spec['treeArgs']=[0,1] if pid==617 else [0]
 if kind=='nullable-integer-array':spec['resultTree']='arg0' if pid in {114,99} else 'return'
 return spec
PROBLEMS={pid:make(pid) for pid in IDS}
