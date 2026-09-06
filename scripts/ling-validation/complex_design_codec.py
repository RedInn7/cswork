"""Fixed reference dispatch for mixed JSON design traces; no dynamic method names."""
import json,math
from complex_design_semantics import IDS,CLASSES,METHODS
from tree_codec import TreeNode,from_level_order

def tree_result(root):
 if root is None:return []
 queue=[root];head=0;out=[];seen=set()
 while head<len(queue):
  u=queue[head];head+=1
  if u is None:out.append(None);continue
  if id(u) in seen or len(seen)>=10000 or type(u.val)is not int:raise ValueError('invalid round-trip tree')
  seen.add(id(u));out.append(u.val);queue.extend((u.left,u.right))
 while out and out[-1] is None:out.pop()
 return out

def run_complex_design(pid,scope,args):
 if type(pid)is not int or pid not in IDS or type(args)is not list or len(args)!=2:raise ValueError('design protocol')
 ops,params=args
 if not ops or len(ops)!=len(params) or ops[0]!=CLASSES[pid]:raise ValueError('trace')
 ctor=params[0][:]
 if pid==173:ctor=[from_level_order(ctor[0])]
 obj=scope[CLASSES[pid]](*ctor);out=[None]
 for method,p in zip(ops[1:],params[1:]):
  if method not in METHODS[pid]:raise ValueError('method not allowed')
  if pid in (297,449):value=tree_result(obj.deserialize(obj.serialize(from_level_order(p[0]))))
  else:value=getattr(obj,method)(*p)
  if type(value)is bool:value=int(value)
  if isinstance(value,float) and not math.isfinite(value):raise ValueError('nonfinite output')
  if value is not None and type(value) not in (int,float,str,list):raise ValueError('unsupported mixed result')
  out.append(value)
 return json.dumps(out,separators=(',',':'),ensure_ascii=True,allow_nan=False)
