"""Fixed semantic judges; no student supplied code and no downloaded imports."""
import json
import re
from collections import Counter

SEMANTIC_IDS=(5,1044,1092,1249,767,1405,162,324,870,368,210,269,373,2392,701,108,450,109,1171,708,652)
SEMANTIC_KINDS={**{i:'string' for i in (5,1044,1092,1249,767,1405,269)},162:'integer',**{i:'integer-array' for i in (324,870,368,210,1171,708,652)},373:'integer-rows',2392:'integer-rows',**{i:'nullable-integer-array' for i in (701,108,450,109)}}

def semantic_checker_id(checker):
 for pid in SEMANTIC_IDS:
  if checker==f'semantic-lc-{pid}':return pid
 return None

SPACE=r'[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'
INTEGER=re.compile(r'^[+-]?[0-9]+$')
COUNT=re.compile(r'^(0|[1-9][0-9]*)$')
MAX_SAFE=2**53-1

def parts(text):return re.split(SPACE+'+',re.sub('^'+SPACE+'+|'+SPACE+'+$','',text))
def number(text):
 if not INTEGER.fullmatch(text):raise ValueError('integer')
 result=int(text)
 if abs(result)>MAX_SAFE:raise ValueError('unsafe integer')
 return result

def integers(text):
 tokens=parts(text)
 if not COUNT.fullmatch(tokens[0]):raise ValueError('count')
 n=int(tokens[0])
 if n>100000 or len(tokens)!=n+1:raise ValueError('length')
 return [number(t) for t in tokens[1:]]

def rows(text):
 tokens=parts(text);n=number(tokens[0]);i=1;out=[]
 if not 0<=n<=10000:raise ValueError('row count')
 for _ in range(n):
  size=number(tokens[i]);i+=1
  if not 0<=size<=100000 or i+size>len(tokens):raise ValueError('row length')
  out.append([number(t) for t in tokens[i:i+size]]);i+=size
 if i!=len(tokens):raise ValueError('extra tokens')
 return out

def line(text):
 text=text.replace('\r\n','\n')
 if not text.endswith('\n') or any(c in text[:-1] for c in '\r\n\0'):raise ValueError('line')
 return text[:-1]

def subsequence(a,b):
 it=iter(b)
 return all(any(x==c for x in it) for c in a)

def tree(values):
 if type(values)is not list or len(values)>200001 or any(v is not None and (type(v)is not int or abs(v)>MAX_SAFE) for v in values):raise ValueError('tree value')
 if not values:return []
 if values[0] is None or values[-1] is None:raise ValueError('noncanonical tree')
 nodes=[[values[0],None,None]];head=0;i=1
 while i<len(values):
  if head==len(nodes):raise ValueError('unreachable node')
  parent=head;head+=1
  for side in (1,2):
   if i==len(values):break
   v=values[i];i+=1
   if v is not None:nodes[parent][side]=len(nodes);nodes.append([v,None,None])
 return nodes

def tree_output(text):
 tokens=parts(text)
 if not COUNT.fullmatch(tokens[0]) or len(tokens)!=int(tokens[0])+1:raise ValueError('tree count')
 return tree([None if t=='null' else number(t) for t in tokens[1:]])

def inorder(nodes):
 out=[];stack=[];u=0 if nodes else None
 while stack or u is not None:
  while u is not None:stack.append(u);u=nodes[u][1]
  u=stack.pop();out.append(nodes[u][0]);u=nodes[u][2]
 return out

def balanced(nodes):
 heights={None:0}
 for i in range(len(nodes)-1,-1,-1):
  l,r=nodes[i][1:]
  if abs(heights[l]-heights[r])>1:return False
  heights[i]=1+max(heights[l],heights[r])
 return True

def matches_semantic(pid,actual,expected,input):
 try:
  if type(actual)is not str or type(expected)is not str or type(input)is not str:return False
  if len(actual.encode('utf-16-le',errors='surrogatepass'))//2>4*1024*1024 or len(input.encode('utf-16-le',errors='surrogatepass'))//2>4*1024*1024:return False
  def bad_constant(x):raise ValueError('non JSON constant')
  args=json.loads(input,parse_constant=bad_constant)
  if type(args)is not list or type(pid)is not int:return False
  if pid==708:
   if len(args)!=2 or type(args[0])is not list or any(type(v)is not int or abs(v)>MAX_SAFE for v in args[0]) or type(args[1])is not int:return False
   original,value=args;got=integers(actual)
   if len(got)!=len(original)+1:return False
   if not original:return got==[value]
   if got[0]!=original[0] or sum(got[i]>got[(i+1)%len(got)] for i in range(len(got)))>1:return False
   j=0;skipped=False
   for v in got:
    if j<len(original) and v==original[j]:j+=1
    elif not skipped and v==value:skipped=True
    else:return False
   return j==len(original) and skipped
  if pid==652:
   if len(args)!=1:return False
   nodes=tree(args[0]);got=integers(actual)
   signatures={};by_node={None:0};counts=Counter()
   for i in range(len(nodes)-1,-1,-1):
    v,left,right=nodes[i];key=(v,by_node[left],by_node[right])
    signature=signatures.setdefault(key,len(signatures)+1);by_node[i]=signature;counts[signature]+=1
   wanted={signature for signature,count in counts.items() if count>1}
   if any(i<0 or i>=len(nodes) for i in got):return False
   actual_signatures=[by_node[i] for i in got]
   return len(actual_signatures)==len(wanted) and set(actual_signatures)==wanted
  if pid in (5,1044,1092,1249,767,1405,269):
   got,want=line(actual),line(expected)
   if pid==5:return len(got)==len(want) and got in args[0] and got==got[::-1]
   if pid==1044:
    first=args[0].find(got)
    return len(got)==len(want) and (not got or first>=0 and args[0].find(got,first+1)>=0)
   if pid==1092:return len(got)==len(want) and subsequence(args[0],got) and subsequence(args[1],got)
   if pid==1249:
    if len(got)!=len(want) or not subsequence(got,args[0]) or re.sub(r'[()]','',got)!=re.sub(r'[()]','',args[0]):return False
    depth=0
    for c in got:
     if c=='(':depth+=1
     elif c==')':
      depth-=1
      if depth<0:return False
    return depth==0
   if pid==767:return got=='' if want=='' else Counter(got)==Counter(args[0]) and all(a!=b for a,b in zip(got,got[1:]))
   if pid==1405:return len(got)==len(want) and not re.search('[^abc]|aaa|bbb|ccc',got) and all(got.count(c)<=args[i] for i,c in enumerate('abc'))
   if not want:return not got
   words=args[0]
   if Counter(got)!=Counter(set(''.join(words))):return False
   positions={c:i for i,c in enumerate(got)}
   for a,b in zip(words,words[1:]):
    j=0
    while j<len(a) and j<len(b) and a[j]==b[j]:j+=1
    if j==len(b) and j<len(a):return False
    if j<len(a) and j<len(b) and positions[a[j]]>=positions[b[j]]:return False
   return True
  if pid==162:
   value=re.sub('^'+SPACE+'+|'+SPACE+'+$','',actual);i=number(value);nums=args[0]
   return 0<=i<len(nums) and (i==0 or nums[i]>nums[i-1]) and (i==len(nums)-1 or nums[i]>nums[i+1])
  if pid in (324,870,368,210,1171,708,652):
   got,want=integers(actual),integers(expected)
   if pid==324:return Counter(got)==Counter(args[0]) and all(v>got[i-1] if i%2 else v<got[i-1] for i,v in enumerate(got) if i)
   if pid==870:return Counter(got)==Counter(args[0]) and sum(x>y for x,y in zip(got,args[1]))==sum(x>y for x,y in zip(want,args[1]))
   if pid==368:
    ordered=sorted(got)
    return len(got)==len(want) and len(set(got))==len(got) and all(v in set(args[0]) for v in got) and all(v%ordered[i-1]==0 for i,v in enumerate(ordered) if i)
   if pid==210:
    if not want:return not got
    n=args[0]
    if len(got)!=n or set(got)!=set(range(n)):return False
    positions={v:i for i,v in enumerate(got)}
    return all(positions[b]<positions[a] for a,b in args[1])
   nums=args[0];prefix=[0]
   for v in nums:prefix.append(prefix[-1]+v)
   running=0;seen={0}
   for v in got:
    running+=v
    if running in seen:return False
    seen.add(running)
   if running!=prefix[-1]:return False
   previous={0}
   for v in got:
    allowed=set();following=set()
    for j,x in enumerate(nums):
     if j in previous:allowed.add(prefix[j])
     if x==v and prefix[j] in allowed:following.add(j+1)
    previous=following
    if not previous:return False
   return any(prefix[p]==prefix[-1] for p in previous)
  if pid==373:
   got,want=rows(actual),rows(expected)
   if len(got)!=len(want) or any(len(row)!=2 for row in got):return False
   a,b=Counter(args[0]),Counter(args[1]);seen=Counter(map(tuple,got))
   return all(n<=a[x]*b[y] for (x,y),n in seen.items()) and Counter(map(sum,got))==Counter(map(sum,want))
  if pid==2392:
   got,want=rows(actual),rows(expected)
   if not want:return not got
   k=args[0]
   if len(got)!=k or any(len(row)!=k for row in got):return False
   pos={}
   for i,row in enumerate(got):
    for j,v in enumerate(row):
     if v<0 or v>k or v and v in pos:return False
     if v:pos[v]=(i,j)
   return len(pos)==k and all(pos[a][axis]<pos[b][axis] for axis,edges in enumerate(args[1:3]) for a,b in edges)
  if pid in (701,108,450,109):
   got=tree_output(actual);values=inorder(got)
   if any(v<values[i-1] if pid==109 else v<=values[i-1] for i,v in enumerate(values) if i):return False
   if pid in (108,109):return Counter(values)==Counter(args[0]) and balanced(got)
   required=inorder(tree(args[0]))
   if pid==701:required.append(args[1])
   elif args[1] in required:required.remove(args[1])
   return Counter(values)==Counter(required)
  return False
 except (ValueError,TypeError,IndexError,KeyError,OverflowError,ZeroDivisionError,RecursionError):return False
