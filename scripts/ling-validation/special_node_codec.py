"""Authored identity-preserving adapters for special-node judge references.

Integration contract:
  namespace.update(special_symbols(pid)) BEFORE executing the reference source;
  call_args, context = prepare_special(pid, raw_json_args)
  result = Solution().method(*call_args)
  normalized = finish_special(pid, result, context)

Raw inputs/normalized outputs are JSON-compatible. Checks on reference aliases
are transport guards; ordinary stdin structural output does not prove a user's
in-memory allocation behavior. Node IDs always refer to input construction order.
"""
from collections import deque, Counter

SPECIAL_IDS=(141,160,142,138,708,430,116,117,236,1644,1650,1123,235,285,426,1110,652,863)
TREE_IDS={116,117,236,1644,1650,1123,235,285,426,1110,652,863}
IDENTITY_IDS={160,142,236,1644,1650,1123,235,285}

class ListNode:
 def __init__(self,val=0,next=None):self.val=val;self.next=next
class TreeNode:
 def __init__(self,val=0,left=None,right=None):self.val=val;self.left=left;self.right=right
class RandomNode:
 def __init__(self,val=0,next=None,random=None):self.val=val;self.next=next;self.random=random
class CircularNode:
 def __init__(self,val=None,next=None):self.val=val;self.next=next
class MultiNode:
 def __init__(self,val=0,prev=None,next=None,child=None):self.val=val;self.prev=prev;self.next=next;self.child=child
class NextNode:
 def __init__(self,val=0,left=None,right=None,next=None):self.val=val;self.left=left;self.right=right;self.next=next
class ParentNode:
 def __init__(self,val=0,left=None,right=None,parent=None):self.val=val;self.left=left;self.right=right;self.parent=parent
class DoublyNode:
 def __init__(self,val=0,left=None,right=None):self.val=val;self.left=left;self.right=right

def special_symbols(pid):
 if type(pid) is not int or pid not in SPECIAL_IDS:raise ValueError('unsupported special node protocol')
 cls={138:RandomNode,708:CircularNode,430:MultiNode,116:NextNode,117:NextNode,1650:ParentNode,426:DoublyNode}.get(pid,TreeNode)
 return {'Node':cls,'TreeNode':TreeNode,'ListNode':ListNode}

def require(condition,message='invalid special node structure'):
 if not condition:raise ValueError(message)

def integer(value):
 require(type(value)is int,'node data must be integers')
 return value

def pointer(nodes,index):
 integer(index);require(-1<=index<len(nodes),'node index outside input')
 return None if index==-1 else nodes[index]

def tree_nodes(tokens,cls=TreeNode):
 require(type(tokens)is list and len(tokens)<=200001)
 if not tokens:return []
 require(tokens[0] is not None and tokens[-1] is not None,'noncanonical level order')
 nodes=[cls(integer(tokens[0]))];head=0;i=1
 while i<len(tokens):
  require(head<len(nodes),'unreachable tree tokens');parent=nodes[head];head+=1
  for side in ('left','right'):
   if i==len(tokens):break
   value=tokens[i];i+=1
   if value is not None:
    child=cls(integer(value));setattr(parent,side,child);nodes.append(child)
    if hasattr(child,'parent'):child.parent=parent
 return nodes

def snapshot(nodes,fields):
 return [(node.val,tuple(getattr(node,f) for f in fields)) for node in nodes]

def unchanged(ctx,fields=None):
 fields=ctx['fields'] if fields is None else fields
 for node,(value,pointers) in zip(ctx['nodes'],ctx['snapshot']):
  require(type(node.val)is int and node.val==value,'reference modified original node values')
  for f,p in zip(ctx['fields'],pointers):
   if f in fields:require(getattr(node,f) is p,'reference changed protected input pointers')

def prepare_special(pid,args):
 special_symbols(pid);require(type(args)is list)
 nodes=[];fields=();context={'pid':pid,'args':args}
 if pid in (141,142):
  require(len(args)==2 and type(args[0])is list and len(args[0])<=10000)
  nodes=[ListNode(integer(v)) for v in args[0]]
  for left,right in zip(nodes,nodes[1:]):left.next=right
  pos=integer(args[1]);require(-1<=pos<len(nodes))
  if nodes and pos>=0:nodes[-1].next=nodes[pos]
  call=[nodes[0] if nodes else None];fields=('next',)
 elif pid==160:
  require(len(args)==3 and all(type(v)is list for v in args));prefixa,prefixb,tail=args
  require(1<=len(prefixa)+len(tail)<=30000 and 1<=len(prefixb)+len(tail)<=30000)
  groups=[[ListNode(integer(v)) for v in values] for values in args];nodes=sum(groups,[])
  for group in groups:
   for left,right in zip(group,group[1:]):left.next=right
  for group in groups[:2]:
   if group and groups[2]:group[-1].next=groups[2][0]
  call=[group[0] if group else groups[2][0] for group in groups[:2]];fields=('next',)
 elif pid==138:
  require(len(args)==1 and type(args[0])is list and len(args[0])<=1000)
  for row in args[0]:require(type(row)is list and len(row)==2)
  nodes=[RandomNode(integer(row[0])) for row in args[0]]
  for i,node in enumerate(nodes):node.next=nodes[i+1] if i+1<len(nodes) else None;node.random=pointer(nodes,args[0][i][1])
  call=[nodes[0] if nodes else None];fields=('next','random')
 elif pid==708:
  require(len(args)==2 and type(args[0])is list and len(args[0])<=50000);integer(args[1])
  nodes=[CircularNode(integer(v)) for v in args[0]]
  for i,node in enumerate(nodes):node.next=nodes[(i+1)%len(nodes)]
  require(not nodes or sum(nodes[i].val>nodes[(i+1)%len(nodes)].val for i in range(len(nodes)))<=1,'input cycle not sorted')
  call=[nodes[0] if nodes else None,args[1]];fields=('next',)
 elif pid==430:
  require(len(args)==1 and type(args[0])is list and len(args[0])<=1000)
  for row in args[0]:require(type(row)is list and len(row)==3)
  nodes=[MultiNode(integer(row[0])) for row in args[0]];incoming=Counter()
  for i,node in enumerate(nodes):
   node.next=pointer(nodes,args[0][i][1]);node.child=pointer(nodes,args[0][i][2])
   for target in (node.next,node.child):
    if target is not None:incoming[id(target)]+=1
   if node.next:node.next.prev=node
  if nodes:
   require(incoming[id(nodes[0])]==0 and all(incoming[id(u)]==1 for u in nodes[1:]),'multi-level lists must not share nodes')
   seen=set();todo=[nodes[0]]
   while todo:
    u=todo.pop();require(id(u) not in seen,'multi-level cycle');seen.add(id(u))
    if u.next:todo.append(u.next)
    if u.child:require(u.child.prev is None,'child head cannot have a previous node');todo.append(u.child)
   require(len(seen)==len(nodes),'unreachable multi-level node')
  call=[nodes[0] if nodes else None];fields=('next','prev','child')
 else:
  require(args and pid in TREE_IDS)
  cls=special_symbols(pid)['Node'] if pid in (116,117,1650,426) else TreeNode
  nodes=tree_nodes(args[0],cls);root=nodes[0] if nodes else None;fields=('left','right')+('parent',) if pid==1650 else ('left','right')
  def locator(value,external=False):
   if external:
    require(type(value)is dict and len(value)==1)
    if 'external' in value:return TreeNode(integer(value['external']))
    require('id' in value);value=value['id']
   result=pointer(nodes,value);require(result is not None,'target must be a node');return result
  if pid in (236,235):require(len(args)==3);call=[root,locator(args[1]),locator(args[2])]
  elif pid==1644:require(len(args)==3);call=[root,locator(args[1],True),locator(args[2],True)]
  elif pid==1650:require(len(args)==3);call=[locator(args[1]),locator(args[2])]
  elif pid==285:require(len(args)==2);call=[root,locator(args[1])]
  elif pid==863:require(len(args)==3);call=[root,locator(args[1]),integer(args[2])]
  elif pid==1110:require(len(args)==2 and type(args[1])is list);call=[root,args[1][:]]
  else:require(len(args)==1);call=[root]
 context.update(nodes=nodes,index={id(node):i for i,node in enumerate(nodes)},fields=fields,snapshot=snapshot(nodes,fields),call=call)
 return call,context

def finish_special(pid,result,ctx):
 require(pid==ctx['pid']);nodes=ctx['nodes'];indices=ctx['index'];n=len(nodes)
 def nodeid(node):
  if node is None:return -1
  require(id(node) in indices,'returned a foreign node instead of an input identity')
  return indices[id(node)]
 if pid==863:
  unchanged(ctx);require(type(result)is list and all(type(v)is int for v in result),'distance output must be integer values');return result
 if pid==141:
  unchanged(ctx);require(type(result)is bool,'cycle predicate must be boolean');return int(result)
 if pid in IDENTITY_IDS:
  unchanged(ctx);return nodeid(result)
 if pid==138:
  unchanged(ctx);out=[];seen={};u=result
  while u is not None:
   require(len(out)<1000 and id(u) not in seen,'copy must be a finite list')
   require(id(u) not in indices,'copy aliases an original node');integer(u.val);seen[id(u)]=len(out);out.append(u);u=u.next
  require(len(out)==n,'copy length differs')
  rows=[]
  for u in out:
   require(u.random is None or id(u.random) in seen,'copy random pointer leaves copied list');rows.append([u.val,-1 if u.random is None else seen[id(u.random)]])
  return rows
 if pid==708:
  require(result is not None and (not nodes or result is nodes[0]),'insertion must retain the original head')
  out=[];visited=set();u=result
  while id(u) not in visited:
   require(u is not None and len(out)<n+1,'invalid inserted cycle');visited.add(id(u));out.append(u);u=u.next
  require(u is result and len(out)==n+1,'cycle has wrong length or closure')
  original=[u for u in out if id(u) in indices];added=[u for u in out if id(u) not in indices]
  require(original==nodes and len(added)==1,'insertion lost/reordered original nodes')
  for u,(value,_) in zip(nodes,ctx['snapshot']):require(type(u.val)is int and u.val==value,'insertion changed original values')
  require(type(added[0].val)is int and added[0].val==ctx['args'][1]);values=[u.val for u in out]
  require(sum(values[i]>values[(i+1)%len(values)] for i in range(len(values)))<=1,'result cycle is not sorted')
  return values
 if pid==430:
  out=[];seen=set();previous=None;u=result
  require(result is (nodes[0] if nodes else None),'flatten changed head identity')
  while u is not None:
   i=nodeid(u);require(i not in seen,'flatten produced cycle');seen.add(i);require(u.prev is previous and u.child is None,'invalid flattened prev/child');require(u.val==ctx['snapshot'][i][0]);out.append(i);previous=u;u=u.next
  require(len(out)==n,'flatten omitted nodes');return out
 if pid in (116,117):
  unchanged(ctx);require(result is (nodes[0] if nodes else None),'connect changed root identity')
  return [nodeid(u.next) for u in nodes]
 if pid==426:
  if not nodes:require(result is None);return []
  out=[];seen=set();u=result
  while u is not None and id(u) not in seen:
   i=nodeid(u);seen.add(id(u));require(u.left is not None and u.right is not None and u.left.right is u and u.right.left is u,'broken doubly-linked circular pointers');require(u.val==ctx['snapshot'][i][0]);out.append(i);u=u.right
  require(u is result and len(out)==n,'conversion omitted nodes or has non-circular tail')
  require(all(nodes[a].val<nodes[b].val for a,b in zip(out,out[1:])),'conversion must start at minimum in ascending order');return out
 if pid in (1110,652):
  require(type(result)is list,'forest roots must be a list');out=[nodeid(u) for u in result];require(-1 not in out and len(set(out))==len(out),'duplicate/null root identity')
  if pid==652:unchanged(ctx)
  else:
   deleted=set(ctx['args'][1])
   for i,u in enumerate(nodes):
    require(u.val==ctx['snapshot'][i][0],'forest changed values')
    if u.val not in deleted:
     for side,original in zip(('left','right'),ctx['snapshot'][i][1]):require(getattr(u,side) is (None if original and original.val in deleted else original),'forest changed surviving edges')
  return out
 raise ValueError('unsupported special result')
