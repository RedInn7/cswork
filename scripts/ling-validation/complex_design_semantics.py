"""Fixed mixed-result design judges; independent of downloaded implementations."""
import json,math,heapq,bisect
from collections import Counter
IDS=(173,1472,981,2353,295,588,432,380,381,297,449)
CLASSES={173:'BSTIterator',1472:'BrowserHistory',981:'TimeMap',2353:'FoodRatings',295:'MedianFinder',588:'FileSystem',432:'AllOne',380:'RandomizedSet',381:'RandomizedCollection',297:'Codec',449:'Codec'}
METHODS={173:{'next','hasNext'},1472:{'visit','back','forward'},981:{'set','get'},2353:{'changeRating','highestRated'},295:{'addNum','findMedian'},588:{'ls','mkdir','addContentToFile','readContentFromFile'},432:{'inc','dec','getMaxKey','getMinKey'},380:{'insert','remove','getRandom'},381:{'insert','remove','getRandom'},297:{'roundTrip'},449:{'roundTrip'}}

def inorder(tokens):
 if not tokens:return []
 nodes=[[tokens[0],-1,-1]];head=0;i=1
 while i<len(tokens):
  if head>=len(nodes):raise ValueError('tree')
  for side in (1,2):
   if i==len(tokens):break
   v=tokens[i];i+=1
   if v is not None:nodes[head][side]=len(nodes);nodes.append([v,-1,-1])
  head+=1
 out=[];stack=[];u=0
 while stack or u>=0:
  while u>=0:stack.append(u);u=nodes[u][1]
  u=stack.pop();out.append(nodes[u][0]);u=nodes[u][2]
 return out

def exact(a,b):
 if type(b)is int:return type(a) in (int,float) and math.isfinite(a) and a==b
 if type(a)is not type(b):return False
 if type(a)is list:return len(a)==len(b) and all(exact(x,y) for x,y in zip(a,b))
 return a==b

def design_results(pid,args,actual=None):
 """Generate one valid trace, or validate supplied results at each state."""
 if type(pid)is not int or pid not in IDS or type(args)is not list or len(args)!=2:raise ValueError('design id/input')
 ops,params=args
 if type(ops)is not list or type(params)is not list or not ops or len(ops)!=len(params) or ops[0]!=CLASSES[pid] or len(ops)>200001:raise ValueError('trace')
 if any(type(p)is not list for p in params):raise ValueError('parameters')
 if actual is not None and (type(actual)is not list or len(actual)!=len(ops)):return False
 ctor=params[0];out=[None]
 if actual is not None and actual[0] is not None:return False
 seq=inorder(ctor[0]) if pid==173 else [];index=0
 history=ctor[:] if pid==1472 else [];cursor=0;versions={}
 foods={};cuisine_heaps={}
 if pid==2353:
  for food,cuisine,rating in zip(*ctor):foods[food]=(cuisine,rating);heapq.heappush(cuisine_heaps.setdefault(cuisine,[]),(-rating,food))
 lower=[];upper=[];directories={'/':set()};files={};counts={};minheap=[];maxheap=[]
 # The test bounds sampling error; it does not prove mathematical randomness.
 random_samples=Counter();random_n=0
 def flush_random():
  nonlocal random_n
  if random_n>=2000:
   total=sum(counts.values());m=len(counts)
   if not total:return False
   threshold=math.sqrt(random_n*math.log(2*m/1e-15)/2)
   if any(abs(random_samples.get(value,0)-random_n*weight/total)>threshold for value,weight in counts.items()):return False
  random_samples.clear();random_n=0
  return True
 for step,(op,p) in enumerate(zip(ops[1:],params[1:]),1):
  if op not in METHODS[pid]:raise ValueError('method')
  result=None;accept=None
  if pid==173:
   if op=='next':result=seq[index];index+=1
   else:result=int(index<len(seq))
  elif pid==1472:
   if op=='visit':history=history[:cursor+1]+[p[0]];cursor+=1
   else:cursor=max(0,cursor-p[0]) if op=='back' else min(len(history)-1,cursor+p[0]);result=history[cursor]
  elif pid==981:
   if op=='set':versions.setdefault(p[0],[]).append((p[2],p[1]))
   else:
    records=versions.get(p[0],[]);i=bisect.bisect_right(records,(p[1],chr(0x10ffff)))-1;result=records[i][1] if i>=0 else ''
  elif pid==2353:
   if op=='changeRating':cuisine,_=foods[p[0]];foods[p[0]]=(cuisine,p[1]);heapq.heappush(cuisine_heaps[cuisine],(-p[1],p[0]))
   else:
    heap=cuisine_heaps[p[0]]
    while -heap[0][0]!=foods[heap[0][1]][1]:heapq.heappop(heap)
    result=heap[0][1]
  elif pid==295:
   if op=='addNum':
    v=p[0]
    if not lower or v<=-lower[0]:heapq.heappush(lower,-v)
    else:heapq.heappush(upper,v)
    if len(lower)>len(upper)+1:heapq.heappush(upper,-heapq.heappop(lower))
    if len(upper)>len(lower):heapq.heappush(lower,-heapq.heappop(upper))
   else:
    result=float(-lower[0]) if len(lower)>len(upper) else (-lower[0]+upper[0])/2
    accept=lambda v:type(v) in (int,float) and math.isfinite(v) and abs(v-result)<=1e-5
  elif pid==588:
   path=p[0]
   if op=='mkdir':
    current=''
    for name in filter(None,path.split('/')[1:]):
     parent=current or '/';current+='/'+name;directories[parent].add(name);directories.setdefault(current,set())
   elif op=='addContentToFile':
    parent,name=path.rsplit('/',1);directories[parent or '/'].add(name);files[path]=files.get(path,'')+p[1]
   elif op=='readContentFromFile':result=files[path]
   else:result=[path.rsplit('/',1)[1]] if path in files else sorted(directories[path])
  elif pid==432:
   if op in ('inc','dec'):
    key=p[0];value=counts.get(key,0)+(1 if op=='inc' else -1)
    if value:counts[key]=value;heapq.heappush(minheap,(value,key));heapq.heappush(maxheap,(-value,key))
    else:del counts[key]
   else:
    heap=minheap if op=='getMinKey' else maxheap;sign=1 if op=='getMinKey' else -1
    while heap and counts.get(heap[0][1],0)!=sign*heap[0][0]:heapq.heappop(heap)
    result=heap[0][1] if heap else '';wanted=counts.get(result,0)
    accept=lambda v:type(v)is str and (v=='' if not counts else counts.get(v)==wanted)
  elif pid in (380,381):
   if op!='getRandom' and not flush_random():return False
   if op=='insert':result=int(not counts.get(p[0],0));counts[p[0]]=counts.get(p[0],0)+1 if pid==381 else 1
   elif op=='remove':
    result=int(bool(counts.get(p[0],0)))
    if result:
     counts[p[0]]-=1
     if not counts[p[0]]:del counts[p[0]]
   else:
    if not counts:return False
    result=next(iter(counts));accept=lambda v:type(v) in (int,float) and math.isfinite(v) and v==int(v) and counts.get(v,0)>0
  elif pid in (297,449):result=p[0]
  if actual is not None:
   if not (accept(actual[step]) if accept else exact(actual[step],result)):return False
   if pid in (380,381) and op=='getRandom':random_samples[actual[step]]+=1;random_n+=1
  out.append(result)
 if not flush_random():return False
 return out if actual is None else True

def matches_complex_design(pid,actual,expected,input):
 try:
  if type(actual)is not str or type(input)is not str or len(actual.encode())>64*1024*1024 or len(input.encode())>64*1024*1024:return False
  def bad(v):raise ValueError('nonfinite')
  values=json.loads(actual,parse_constant=bad);args=json.loads(input,parse_constant=bad)
  return design_results(pid,args,values) is True
 except (ValueError,TypeError,IndexError,KeyError,OverflowError,RecursionError,StopIteration):return False
