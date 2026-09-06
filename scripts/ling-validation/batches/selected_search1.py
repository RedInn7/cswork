"""Original selected search fixtures; downloaded sources are never executed."""
import itertools,inspect,re,heapq,math
from collections import Counter,deque
from fractions import Fraction
from functools import lru_cache
MOD=1000000007
IDS=[1007,678,826,630,871,1642,502,1383,1802,1074,1079,291,1593,79,52,679,1239,1255,93,320,267,301,282,212]
SETS={93,320,267,301,282,212}

def subsets(n):
 for mask in range(1<<n):yield [i for i in range(n) if mask>>i&1]

def balanced(s):
 b=0
 for c in s:
  b+=(c=='(')-(c==')')
  if b<0:return False
 return b==0

def abbreviations(word):
 result=[]
 for mask in range(1<<len(word)):
  pieces=[];count=0
  for i,c in enumerate(word):
   if mask>>i&1:count+=1
   else:
    if count:pieces.append(str(count));count=0
    pieces.append(c)
  if count:pieces.append(str(count))
  result.append(''.join(pieces))
 return sorted(result)

def expression_value(expr):
 # Original two-pass integer parser: collapse multiplication, then add terms.
 tokens=re.findall(r'\d+|[+*-]',expr);total=0;term=int(tokens[0]);sign=1
 for op,s in zip(tokens[1::2],tokens[2::2]):
  v=int(s)
  if op=='*':term*=v
  else:total+=sign*term;sign=1 if op=='+' else -1;term=v
 return total+sign*term

def board_exists(board,word):
 # Breadth-first enumeration of simple paths; no shared mutable visited grid.
 rows,cols=len(board),len(board[0]);q=deque()
 for r in range(rows):
  for c in range(cols):
   if board[r][c]==word[0]:q.append((r,c,1,frozenset([(r,c)])))
 while q:
  r,c,i,seen=q.popleft()
  if i==len(word):return True
  for u,v in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
   if 0<=u<rows and 0<=v<cols and (u,v) not in seen and board[u][v]==word[i]:q.append((u,v,i+1,seen|{(u,v)}))
 return False

def oracle(pid,a):
 x=a[0];n=len(x) if hasattr(x,'__len__') else x
 if pid==1007:
  best=n+1
  for chosen in subsets(n):
   top=[a[1][i] if i in chosen else x[i] for i in range(n)];bottom=[x[i] if i in chosen else a[1][i] for i in range(n)]
   if len(set(top))==1 or len(set(bottom))==1:best=min(best,len(chosen))
  return -1 if best>n else best
 if pid==678:return int(any(balanced(''.join(chars)) for chars in itertools.product(*(['(',')',''] if c=='*' else [c] for c in x))))
 if pid==826:return sum(max([0]+[p for d,p in zip(x,a[1]) if d<=w]) for w in a[2])
 if pid==630:
  def schedule(mask,time):return max([0]+[1+schedule(mask|1<<i,time+d) for i,(d,end) in enumerate(x) if not mask>>i&1 and time+d<=end])
  return schedule(0,0)
 if pid==871:
  target,fuel,stations=a;best=len(stations)+1
  for chosen in subsets(len(stations)):
   reach=fuel
   for i in chosen:
    if reach<stations[i][0]:break
    reach+=stations[i][1]
   else:
    if reach>=target:best=min(best,len(chosen))
  return -1 if best>len(stations) else best
 if pid==1642:
  best=0
  for end in range(1,n):
   jumps=[max(0,v-u) for u,v in zip(x[:end],x[1:end+1])]
   if any(sum(v for i,v in enumerate(jumps) if i not in chosen)<=a[1] for chosen in subsets(len(jumps)) if len(chosen)<=a[2]):best=end
  return best
 if pid==502:
  k,w,profits,capital=a
  def pick(mask,money,left):return max([money]+[pick(mask|1<<i,money+p,left-1) for i,p in enumerate(profits) if left and not mask>>i&1 and capital[i]<=money])
  return pick(0,w,k)
 if pid==1383:
  n,speed,eff,k=a;return max(sum(speed[i] for i in chosen)*min(eff[i] for i in chosen) for chosen in subsets(n) if 1<=len(chosen)<=k)%MOD
 if pid==1802:
  n,index,budget=a;best=0
  def build(v,left):
   nonlocal best
   if len(v)==n:best=max(best,v[index]);return
   for w in range(1,left-(n-len(v)-1)+1):
    if not v or abs(v[-1]-w)<=1:build(v+[w],left-w)
  build([],budget);return best
 if pid==1074:
  rows,cols=len(x),len(x[0]);return sum(sum(x[i][j] for i in range(t,b) for j in range(l,r))==a[1] for t in range(rows) for b in range(t+1,rows+1) for l in range(cols) for r in range(l+1,cols+1))
 if pid==1079:return len({''.join(p) for k in range(1,n+1) for p in itertools.permutations(x,k)})
 if pid==291:
  pattern,s=a
  for cuts in itertools.combinations(range(1,len(s)),len(pattern)-1):
   words=[s[i:j] for i,j in zip((0,)+cuts,cuts+(len(s),))];mapping={};used=set()
   for c,w in zip(pattern,words):
    if c in mapping:
     if mapping[c]!=w:break
    elif w in used:break
    else:mapping[c]=w;used.add(w)
   else:return 1
  return 0
 if pid==1593:
  best=1
  for mask in range(1<<(n-1)):
   cuts=[0]+[i+1 for i in range(n-1) if mask>>i&1]+[n];parts=[x[i:j] for i,j in zip(cuts,cuts[1:])]
   if len(parts)==len(set(parts)):best=max(best,len(parts))
  return best
 if pid==79:return int(board_exists(x,a[1]))
 if pid==52:return sum(len({r+c for r,c in enumerate(cols)})==n and len({r-c for r,c in enumerate(cols)})==n for cols in itertools.permutations(range(n)))
 if pid==679:
  # Exact rational arithmetic independently checks the downloaded float solver.
  def values(items):
   if len(items)==1:return items[0]==24
   for i in range(len(items)):
    for j in range(i+1,len(items)):
     u,v=items[i],items[j];rest=[w for k,w in enumerate(items) if k not in (i,j)]
     options={u+v,u-v,v-u,u*v}
     if v:options.add(u/v)
     if u:options.add(v/u)
     if any(values(rest+[w]) for w in options):return True
   return False
  return int(values(list(map(Fraction,x))))
 if pid==1239:return max(len(s) for chosen in subsets(n) if len(s:=''.join(x[i] for i in chosen))==len(set(s)))
 if pid==1255:
  stock=Counter(a[1]);best=0
  for chosen in subsets(n):
   need=Counter(''.join(x[i] for i in chosen))
   if all(c<=stock[w] for w,c in need.items()):best=max(best,sum(a[2][ord(w)-97]*c for w,c in need.items()))
  return best
 if pid==93:
  result=[]
  for cuts in itertools.combinations(range(1,n),3):
   parts=[x[i:j] for i,j in zip((0,)+cuts,cuts+(n,))]
   if all(len(p)<=3 and int(p)<=255 and (len(p)==1 or p[0]!='0') for p in parts):result.append('.'.join(parts))
  return sorted(result)
 if pid==320:return abbreviations(x)
 if pid==267:return sorted({''.join(p) for p in itertools.permutations(x) if p==p[::-1]})
 if pid==301:
  positions=[i for i,c in enumerate(x) if c in '()'];best=n+1;out=set()
  for chosen in subsets(len(positions)):
   removed={positions[j] for j in chosen};s=''.join(c for i,c in enumerate(x) if i not in removed)
   if balanced(s):
    if len(chosen)<best:best=len(chosen);out=set()
    if len(chosen)==best:out.add(s)
  return sorted(out)
 if pid==282:
  out=[]
  for mask in range(1<<(n-1)):
   cuts=[0]+[i+1 for i in range(n-1) if mask>>i&1]+[n];parts=[x[i:j] for i,j in zip(cuts,cuts[1:])]
   if any(len(p)>1 and p[0]=='0' for p in parts):continue
   for ops in itertools.product('+-*',repeat=len(parts)-1):
    expr=parts[0]+''.join(op+v for op,v in zip(ops,parts[1:]))
    if expression_value(expr)==a[1]:out.append(expr)
  return sorted(out)
 if pid==212:return sorted(w for w in a[1] if board_exists(x,w))
 raise AssertionError(pid)

def find_words(board,words,bug=0):
 trie={}
 for word in words:
  node=trie
  for c in word:node=node.setdefault(c,{})
  node['']=word
 found=set();rows,cols=len(board),len(board[0])
 def search(r,c,node,seen):
  if not(0<=r<rows and 0<=c<cols) or bug!=1 and (r,c) in seen:return
  child=node.get(board[r][c])
  if child is None:return
  if '' in child:found.add(child.pop(''))
  if child:
   for u,v in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):search(u,v,child,seen|{(r,c)})
  if not child:node.pop(board[r][c],None)
 for r in range(rows):
  for c in range(cols):
   if bug!=2 or r==c==0:search(r,c,trie,set())
 return sorted(found)

def variant(pid,a,bug=0):
 x=a[0];n=len(x) if hasattr(x,'__len__') else x
 if pid==1007:
  best=n+1
  for value in ([x[0]] if bug==1 else range(1,7)):
   if all(u==value or v==value for u,v in zip(x,a[1])):
    costs=[sum(u!=value for u in x)]
    if bug!=2:costs.append(sum(v!=value for v in a[1]))
    best=min(best,*costs)
  return -1 if best>n else best
 if pid==678:
  if bug==1:return int(balanced(x.replace('*','')))
  low=high=0
  for c in x:
   low+=1 if c=='(' else -1;high+=-1 if c==')' else 1
   if high<0 and bug!=2:return 0
   low=max(0,low)
  return int(low==0)
 if pid==826:
  jobs=sorted(zip(x,a[1]));i=best=total=0
  for w in sorted(a[2]):
   while i<len(jobs) and (jobs[i][0]<w if bug==1 else jobs[i][0]<=w):best=max(best,jobs[i][1]);i+=1
   total+=best
   if bug==2:best=0
  return total
 if pid==630:
  heap=[];time=0
  for d,end in sorted(x,key=lambda v:v[0] if bug==1 else v[1]):
   heapq.heappush(heap,-d);time+=d
   if time>end:
    if bug==2:heap.remove(-d);heapq.heapify(heap);time-=d
    else:time+=heapq.heappop(heap)
  return len(heap)
 if pid==871:
  target,fuel,stations=a;reach=fuel;heap=[];i=stops=0
  while reach<target:
   while i<len(stations) and (stations[i][0]<reach if bug==1 else stations[i][0]<=reach):heapq.heappush(heap,stations[i][1] if bug==2 else -stations[i][1]);i+=1
   if not heap:return -1
   amount=heapq.heappop(heap);reach+=amount if bug==2 else -amount;stops+=1
  return stops
 if pid==1642:
  heap=[];bricks=a[1];ladders=a[2]
  for i,(u,v) in enumerate(zip(x,x[1:])):
   d=v-u
   if d<=0:continue
   if bug==1:
    if ladders:ladders-=1
    else:bricks-=d
   elif bug==2:
    if bricks>=d:bricks-=d
    elif ladders:ladders-=1
    else:return i
   else:
    heapq.heappush(heap,d)
    if len(heap)>ladders:bricks-=heapq.heappop(heap)
   if bricks<0:return i
  return n-1
 if pid==502:
  k,w,profits,capital=a;jobs=sorted(zip(capital,profits));heap=[];i=0
  for _ in range(k):
   while i<len(jobs) and (jobs[i][0]<w if bug==1 else jobs[i][0]<=w):heapq.heappush(heap,jobs[i][1] if bug==2 else -jobs[i][1]);i+=1
   if not heap:break
   p=heapq.heappop(heap);w+=p if bug==2 else -p
  return w
 if pid==1383:
  n,speed,eff,k=a;heap=[];total=best=0
  for e,s in sorted(zip(eff,speed),reverse=True):
   heapq.heappush(heap,s);total+=s
   if len(heap)>k:total-=heapq.heappop(heap)
   if bug!=1 or len(heap)==k:best=max(best,total*(max(eff) if bug==2 else e))
  return best%MOD
 if pid==1802:
  n,index,budget=a
  def side(height,length):
   count=min(height-1,length);return count*(2*height-count-1)//2+(0 if bug==1 else length-count)
  lo,hi=1,budget
  while lo<hi:
   mid=(lo+hi+1)//2;cost=mid+side(mid,index)+side(mid,n-index-1)
   if cost<budget if bug==2 else cost<=budget:lo=mid
   else:hi=mid-1
  return lo
 if pid==1074:
  rows,cols=len(x),len(x[0]);answer=0
  for top in range(rows):
   sums=[0]*cols
   for bottom in range(top,rows):
    for c in range(cols):sums[c]+=x[bottom][c]
    seen={0:1};prefix=0
    for v in sums:
     prefix+=v;answer+=seen.get(prefix-a[1],0)
     seen[prefix]=1 if bug==1 else seen.get(prefix,0)+1
    if bug==2:break
  return answer
 if pid==1079:
  counts=Counter(x)
  if bug==1:return sum(math.factorial(n)//math.factorial(n-k) for k in range(1,n+1))
  def count():
   total=0
   for c in counts:
    if counts[c]:counts[c]-=1;total+=1+count();counts[c]+=1
   return total
  return count()+(1 if bug==2 else 0)
 if pid==291:
  pattern,s=a;mapping={};used=set()
  def match(i,j):
   if i==len(pattern):return j==len(s)
   c=pattern[i]
   if c in mapping:return s.startswith(mapping[c],j) and match(i+1,j+len(mapping[c]))
   for end in range(j+1,(min(len(s),j+1) if bug==2 else len(s))+1):
    word=s[j:end]
    if word in used and bug!=1:continue
    mapping[c]=word;previous=word in used;used.add(word)
    if match(i+1,end):return True
    del mapping[c]
    if not previous:used.remove(word)
   return False
  return int(match(0,0))
 if pid==1593:
  if bug==1:return len(set(x))
  best=0
  def cut(i,seen,count):
   nonlocal best
   if i==n:best=max(best,count);return
   for j in range(i+1,n+1):
    part=x[i:j]
    if bug==2 or part not in seen:cut(j,seen|{part},count+1)
  cut(0,set(),0);return best
 if pid in (79,212):
  result=find_words(x,[a[1]] if pid==79 else a[1],bug);return int(bool(result)) if pid==79 else result
 if pid==52:
  def solve(row,cols,up,down):
   if row==x:return 1
   return sum(solve(row+1,cols|{c},up|{row+c},down|{row-c}) for c in range(x) if c not in cols and (bug==1 or row+c not in up) and (bug==2 or row-c not in down))
  return solve(0,set(),set(),set())
 if pid==679:
  # Enumerate all permutations and five binary parenthesizations via interval DP.
  for p in itertools.permutations(x):
   @lru_cache(None)
   def results(lo,hi):
    if hi-lo==1:return {Fraction(p[lo])}
    out=set()
    for k in range(lo+1,hi):
     if bug==2 and k!=hi-1:continue
     for u in results(lo,k):
      for v in results(k,hi):
       out.update((u+v,u-v,u*v))
       if v:out.add(Fraction(int(u/v)) if bug==1 else u/v)
    return out
   if 24 in results(0,4):return 1
  return 0
 if pid==1239:
  possible={0}
  for s in x:
   bits=0
   for c in s:bits|=1<<(ord(c)-97)
   if bits.bit_count()!=len(s) and bug!=1:continue
   possible|={v|bits for v in list(possible) if bug==2 or not v&bits}
  return max(v.bit_count() for v in possible)
 if pid==1255:
  stock=Counter(a[1]);weights=a[2];counts=[Counter(w) for w in x]
  def choose(i):
   if i==n:return 0
   skip=choose(i+1);need=counts[i]
   if any(c>stock[w] for w,c in need.items()):return skip
   for w,c in need.items():stock[w]-=c
   score=sum(weights[ord(w)-97]*(1 if bug==1 else c) for w,c in need.items())
   if bug==2:
    for w,c in need.items():stock[w]+=c
    return max(skip,score+choose(i+1))
   take=score+choose(i+1)
   for w,c in need.items():stock[w]+=c
   return max(skip,take)
  return choose(0)
 if pid==93:
  out=[]
  def cut(i,parts):
   if len(parts)==4:
    if i==n:out.append('.'.join(parts))
    return
   for j in range(i+1,min(n,i+3)+1):
    s=x[i:j]
    if (bug==1 or len(s)==1 or s[0]!='0') and (bug==2 or int(s)<=255):cut(j,parts+[s])
  cut(0,[]);return sorted(out)
 if pid==320:
  out=[]
  def build(i,text,count):
   if i==n:out.append(text+(str(count) if count else ''));return
   build(i+1,text+(str(count) if count else '')+x[i],0)
   if bug==1:build(i+1,text+'1',0)
   elif bug!=2 or count==0:build(i+1,text,count+1)
  build(0,'',0);return sorted(out)
 if pid==267:
  counts=Counter(x);odds=[c for c,v in counts.items() if v%2]
  if len(odds)>1 and bug!=2:return []
  half=''.join(c*(v//2) for c,v in sorted(counts.items()));middle=odds[0] if odds else ''
  values=[tuple(half)] if bug==1 else set(itertools.permutations(half))
  return sorted(''.join(p)+middle+''.join(reversed(p)) for p in values)
 if pid==301:
  if bug==1:return [''.join(c for c in x if c not in '()')]
  left=right=0
  for c in x:
   if c=='(':left+=1
   elif c==')':
    if left:left-=1
    else:right+=1
  out=set()
  def dfs(i,text,balance,l,r):
   if l<0 or r<0 or balance<0:return
   if i==n:
    if balance==l==r==0:out.add(text)
    return
   c=x[i]
   if c=='(':dfs(i+1,text,balance,l-1,r);dfs(i+1,text+c,balance+1,l,r)
   elif c==')':dfs(i+1,text,balance,l,r-1);dfs(i+1,text+c,balance-1,l,r)
   else:dfs(i+1,text+c,balance,l,r)
  dfs(0,'',0,left,right);answer=sorted(out);return answer[:1] if bug==2 else answer
 if pid==282:
  out=[]
  def build(i,text,total,last):
   if i==n:
    if total==a[1]:out.append(text)
    return
   for j in range(i+1,n+1):
    part=x[i:j]
    if len(part)>1 and part[0]=='0' and bug!=2:break
    v=int(part)
    if i==0:build(j,part,v,v)
    else:
     build(j,text+'+'+part,total+v,v);build(j,text+'-'+part,total-v,-v)
     build(j,text+'*'+part,total*v if bug==1 else total-last+last*v,last*v)
  build(0,'',0,0);return sorted(out)
 raise AssertionError(pid)

EDGES={1007:[[[2,1,2,4,2,2],[5,2,6,2,3,2]],[[1,2],[2,2]],[[1,2,3],[4,5,6]]],678:[['(*)'],['*)('],[')*('],['(']],826:[[[2,4,6,8,10],[10,20,30,40,50],[4,5,6,7]],[[1],[5],[1,1]]],630:[[[[100,200],[200,1300],[1000,1250],[2000,3200]]],[[[5,5],[4,6],[2,6]]]],871:[[100,10,[[10,60],[20,30],[30,30],[60,40]]],[1,1,[]],[100,1,[[10,100]]]],1642:[[[4,2,7,6,9,14,12],5,1],[[1,2,12],1,1],[[1,6,7],1,1]],502:[[2,0,[1,2,3],[0,1,1]],[1,0,[1],[0]]],1383:[[6,[2,10,3,1,5,8],[5,4,3,9,7,2],2],[2,[1,1],[100,1],2]],1802:[[4,2,6],[1,0,10],[10,0,10]],1074:[[[[0,1,0],[1,1,1],[0,1,0]],0],[[[0],[0]],0],[[[0,0]],0]],1079:[['AAB'],['A'],['ABC']],291:[['abab','redblueredblue'],['ab','aa'],['aa','xx']],1593:[['ababccc'],['aa'],['aba']],79:[[[list('ABCE'),list('SFCS'),list('ADEE')],'ABCCED'],[[['A']],'AA'],[[list('AB')],'B']],52:[[4],[1],[2]],679:[[[4,1,8,7]],[[3,3,8,8]],[[1,2,1,2]]],1239:[[['un','iq','ue']],[['aa']],[['ab','bc']]],1255:[[['dog','cat','dad','good'],list('aacdddgoo'),[1,0,9,5,0,0,3,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0]],[['aa'],list('aa'),[1]*26],[['a','a'],['a'],[1]*26]],93:[['25525511135'],['010010'],['2561111']],320:[['word'],['aa']],267:[['aabb'],['abc'],['a']],301:[['()())()'],['(a)())()'],['abc']],282:[['123',6],['105',5],['232',8]],212:[[[list('oaan'),list('etae'),list('ihkr'),list('iflv')],['oath','pea','eat','rain']],[[['a']],['aa','a']],[[list('ab')],['b','ab']]]}

def code_word(i):
 s=''
 for _ in range(5):s=chr(97+i%26)+s;i//=26
 return 'b'+s

PRESSURE={1007:[([[1,2]*10000,[2]*20000],0)],678:[['*'*100,1]],826:[([[100000]*10000,[100000]*10000,[100000]*10000],10**9)],630:[([[[1,10000] for _ in range(10000)]],10000)],871:[([501,1,[[i,1] for i in range(1,501)]],500),([10**9,10**9,[[i,999999999] for i in range(1,501)]],0)],1642:[([list(range(1,100001)),99999,0],99999)],502:[([100000,10**9,[10000]*100000,[10**9]*100000],2*10**9)],1383:[([100000,[100000]*100000,[10**8]*100000,100000],10**18%MOD)],1802:[([10**9,500000000,10**9],1),([1,0,10**9],10**9)],1074:[([[[0]*100 for _ in range(100)],0],(100*101//2)**2)],1079:[(['ABCDEFG'],sum(math.factorial(7)//math.factorial(7-k) for k in range(1,8)))],291:[(['a'*20,'b'*20],1),(['a'*20,'b'*19+'c'],0)],1593:[(['abcdefghijklmnop'],16),(['a'*16],5)],79:[([[[c for c in 'aaaaaa'] for _ in range(6)],'a'*15],1)],52:[([9],352)],679:[([[9,9,9,9]],0)],1239:[([['abcdefghijklmnopqrstuvwxyz']*16],26)],1255:[([['a'*15]*14,list('a'*100),[10]*26],900)],93:[(['9'*20],[])],320:[(['abcdefghijklmno'],abbreviations('abcdefghijklmno'))],267:[(['aabbccddeeffgghh'],sorted(''.join(p)+''.join(p[::-1]) for p in itertools.permutations('abcdefgh')))],301:[([')'*10+'('*10+'abcde'],['abcde'])],282:[(['0'*10,0],sorted('0'+''.join(op+'0' for op in ops) for ops in itertools.product('+-*',repeat=9)))],212:[([[['a']*12 for _ in range(12)],['a'*i for i in range(1,11)]+[code_word(i) for i in range(29990)]],['a'*i for i in range(1,11)])]}
# Normalize the deliberately simple scalar fixture to the common (args,answer) shape.
PRESSURE[678]=[(['*'*100],1)]

def random_args(pid,r):
 n=r.randint(1,7)
 if pid==1007:return [[r.randint(1,4) for _ in range(max(2,n))],[r.randint(1,4) for _ in range(max(2,n))]]
 if pid==678:return [''.join(r.choice('()*') for _ in range(n))]
 if pid==826:return [[r.randint(1,10) for _ in range(n)],[r.randint(1,15) for _ in range(n)],[r.randint(1,12) for _ in range(r.randint(1,8))]]
 if pid==630:return [[[r.randint(1,7),r.randint(1,18)] for _ in range(n)]]
 if pid==871:return [20,r.randint(1,20),[[p,r.randint(1,12)] for p in sorted(r.sample(range(1,20),n))]]
 if pid==1642:return [[r.randint(1,15) for _ in range(n)],r.randint(0,15),r.randint(0,n)]
 if pid==502:
  n=min(n,6);return [r.randint(1,n+2),r.randint(0,5),[r.randint(0,8) for _ in range(n)],[r.randint(0,12) for _ in range(n)]]
 if pid==1383:return [n,[r.randint(1,10) for _ in range(n)],[r.randint(1,10) for _ in range(n)],r.randint(1,n)]
 if pid==1802:
  n=r.randint(1,4);return [n,r.randrange(n),r.randint(n,10)]
 if pid==1074:return [[[r.randint(-2,2) for _ in range(3)] for _ in range(r.randint(1,3))],r.randint(-4,4)]
 if pid==1079:return [''.join(r.choice('ABC') for _ in range(min(n,6)))]
 if pid==291:return [''.join(r.choice('ab') for _ in range(r.randint(1,4))),''.join(r.choice('ab') for _ in range(n))]
 if pid==1593:return [''.join(r.choice('abc') for _ in range(n))]
 if pid in (79,212):
  board=[[r.choice('abAB' if pid==79 else 'ab') for _ in range(3)] for _ in range(2)]
  words=[''.join(r.choice('abAB' if pid==79 else 'ab') for _ in range(r.randint(1,5))) for _ in range(n)]
  return [board,words[0] if pid==79 else sorted(set(words))]
 if pid==52:return [r.randint(1,7)]
 if pid==679:return [[r.randint(1,9) for _ in range(4)]]
 if pid==1239:return [[''.join(r.choice('abcdef') for _ in range(r.randint(1,4))) for _ in range(n)]]
 if pid==1255:return [[''.join(r.choice('abc') for _ in range(r.randint(1,4))) for _ in range(min(n,6))],list(''.join(r.choice('abc') for _ in range(r.randint(1,10)))),[r.randint(0,5) for _ in range(26)]]
 if pid==93:return [''.join(r.choice('012569') for _ in range(r.randint(1,12)))]
 if pid==320:return [''.join(r.choice('abc') for _ in range(n))]
 if pid==267:return [''.join(r.choice('abc') for _ in range(min(n,6)))]
 if pid==301:return [''.join(r.choice('()ab') for _ in range(n))]
 if pid==282:return [''.join(r.choice('0123') for _ in range(r.randint(1,5))),r.randint(-15,15)]
 raise AssertionError(pid)

def validate(pid,a):
 count={1007:2,826:3,871:3,1642:3,502:4,1383:4,1802:3,1074:2,291:2,79:2,1255:3,282:2,212:2}.get(pid,1)
 assert type(a) is list and len(a)==count;x=a[0]
 def integer(v,lo,hi):assert type(v) is int and lo<=v<=hi
 def vector(v,lo,hi,vlo,vhi):
  assert type(v) is list and lo<=len(v)<=hi
  for z in v:integer(z,vlo,vhi)
 def text(s,lo,hi,chars):assert type(s) is str and lo<=len(s)<=hi and set(s)<=set(chars)
 lower='abcdefghijklmnopqrstuvwxyz';upper=lower.upper()
 if pid==1007:vector(x,2,20000,1,6);vector(a[1],len(x),len(x),1,6)
 if pid==678:text(x,1,100,'()*')
 if pid==826:vector(x,1,10000,1,100000);vector(a[1],len(x),len(x),1,100000);vector(a[2],1,10000,1,100000)
 if pid==630:
  assert type(x) is list and 1<=len(x)<=10000
  for row in x:vector(row,2,2,1,10000)
 if pid==871:
  integer(x,1,10**9);integer(a[1],1,10**9);assert type(a[2]) is list and len(a[2])<=500;last=0
  for row in a[2]:vector(row,2,2,1,10**9-1);assert last<row[0]<x;last=row[0]
 if pid==1642:vector(x,1,100000,1,1000000);integer(a[1],0,10**9);integer(a[2],0,len(x))
 if pid==502:integer(x,1,100000);integer(a[1],0,10**9);vector(a[2],1,100000,0,10000);vector(a[3],len(a[2]),len(a[2]),0,10**9)
 if pid==1383:integer(x,1,100000);vector(a[1],x,x,1,100000);vector(a[2],x,x,1,10**8);integer(a[3],1,x)
 if pid==1802:integer(x,1,10**9);integer(a[1],0,x-1);integer(a[2],x,10**9)
 if pid==1074:
  assert type(x) is list and 1<=len(x)<=100 and type(x[0]) is list and 1<=len(x[0])<=100
  for row in x:vector(row,len(x[0]),len(x[0]),-1000,1000)
  integer(a[1],-10**8,10**8)
 if pid==1079:text(x,1,7,upper)
 if pid==291:text(x,1,20,lower);text(a[1],1,20,lower)
 if pid==1593:text(x,1,16,lower)
 if pid in (79,212):
  size=6 if pid==79 else 12;chars=lower+upper if pid==79 else lower
  assert type(x) is list and 1<=len(x)<=size and type(x[0]) is list and 1<=len(x[0])<=size
  for row in x:
   assert type(row) is list and len(row)==len(x[0])
   for c in row:text(c,1,1,chars)
  if pid==79:text(a[1],1,15,chars)
  else:
   assert type(a[1]) is list and 1<=len(a[1])<=30000 and len(set(a[1]))==len(a[1])
   for s in a[1]:text(s,1,10,lower)
 if pid==52:integer(x,1,9)
 if pid==679:vector(x,4,4,1,9)
 if pid==1239:
  assert type(x) is list and 1<=len(x)<=16
  for s in x:text(s,1,26,lower)
 if pid==1255:
  assert type(x) is list and 1<=len(x)<=14
  for s in x:text(s,1,15,lower)
  assert type(a[1]) is list and 1<=len(a[1])<=100
  for c in a[1]:text(c,1,1,lower)
  vector(a[2],26,26,0,10)
 if pid==93:text(x,1,20,'0123456789')
 if pid==320:text(x,1,15,lower)
 if pid==267:text(x,1,16,lower)
 if pid==301:text(x,1,25,lower+'()');assert sum(c in '()' for c in x)<=20
 if pid==282:text(x,1,10,'0123456789');integer(a[1],-2**31,2**31-1)
 return True

def encode(pid,a):
 def line(values):return ' '.join(map(str,values))+'\n'
 x=a[0]
 if pid in (678,1079,1593,93,320,267,301):return x+'\n'
 if pid==291:return x+'\n'+a[1]+'\n'
 if pid==282:return x+'\n'+str(a[1])+'\n'
 if pid==52:return str(x)+'\n'
 if pid==679:return line(x)
 if pid==1007:return str(len(x))+'\n'+line(x)+line(a[1])
 if pid==826:return line([len(x),len(a[2])])+line(x)+line(a[1])+line(a[2])
 if pid==630:return str(len(x))+'\n'+''.join(line(row) for row in x)
 if pid==871:return line([x,a[1],len(a[2])])+''.join(line(row) for row in a[2])
 if pid==1642:return line([len(x),a[1],a[2]])+line(x)
 if pid==502:return line([len(a[2]),x,a[1]])+line(a[2])+line(a[3])
 if pid==1383:return line([x,a[3]])+line(a[1])+line(a[2])
 if pid==1802:return line(a)
 if pid==1074:return line([len(x),len(x[0]),a[1]])+''.join(line(row) for row in x)
 if pid in (79,212):return line([len(x),len(x[0])]+([len(a[1])] if pid==212 else []))+''.join(''.join(row)+'\n' for row in x)+(a[1]+'\n' if pid==79 else '\n'.join(a[1])+'\n')
 if pid==1239:return str(len(x))+'\n'+'\n'.join(x)+'\n'
 if pid==1255:return str(len(x))+'\n'+'\n'.join(x)+'\n'+''.join(a[1])+'\n'+line(a[2])
 raise AssertionError(pid)

def parse(pid):
 if pid in (678,1079,1593,93,320,267,301):return "args=[sys.stdin.readline().rstrip('\\n')]"
 if pid==291:return "args=[sys.stdin.readline().rstrip('\\n'),sys.stdin.readline().rstrip('\\n')]"
 if pid==282:return "args=[sys.stdin.readline().rstrip('\\n'),int(sys.stdin.readline())]"
 if pid==52:return 'args=[int(sys.stdin.readline())]'
 if pid==679:return 'args=[list(map(int,sys.stdin.readline().split()))]'
 if pid in (79,212):return ("m,n=map(int,sys.stdin.readline().split()); args=[[list(sys.stdin.readline().rstrip('\\n')) for _ in range(m)],sys.stdin.readline().rstrip('\\n')]" if pid==79 else "m,n,k=map(int,sys.stdin.readline().split()); args=[[list(sys.stdin.readline().rstrip('\\n')) for _ in range(m)],[sys.stdin.readline().rstrip('\\n') for _ in range(k)]]")
 if pid==1239:return "n=int(sys.stdin.readline()); args=[[sys.stdin.readline().rstrip('\\n') for _ in range(n)]]"
 if pid==1255:return "n=int(sys.stdin.readline()); args=[[sys.stdin.readline().rstrip('\\n') for _ in range(n)],list(sys.stdin.readline().rstrip('\\n')),list(map(int,sys.stdin.readline().split()))]"
 prefix='it=iter(map(int,sys.stdin.read().split()))\n'
 code={1007:'n=next(it); args=[[next(it) for _ in range(n)],[next(it) for _ in range(n)]]',826:'n,m=next(it),next(it); args=[[next(it) for _ in range(n)],[next(it) for _ in range(n)],[next(it) for _ in range(m)]]',630:'n=next(it); args=[[[next(it),next(it)] for _ in range(n)]]',871:'target,fuel,n=next(it),next(it),next(it); args=[target,fuel,[[next(it),next(it)] for _ in range(n)]]',1642:'n,b,l=next(it),next(it),next(it); args=[[next(it) for _ in range(n)],b,l]',502:'n,k,w=next(it),next(it),next(it); args=[k,w,[next(it) for _ in range(n)],[next(it) for _ in range(n)]]',1383:'n,k=next(it),next(it); args=[n,[next(it) for _ in range(n)],[next(it) for _ in range(n)],k]',1802:'args=[next(it),next(it),next(it)]',1074:'m,n,target=next(it),next(it),next(it); args=[[[next(it) for _ in range(n)] for _ in range(m)],target]'}
 return prefix+code[pid]

META={
1007:('minDominoRotations','最少骨牌翻转','Minimum Domino Rotations','每次交换一张骨牌上下两面的值，使上排或下排全部相同。求最少翻转数，无解返回-1。','Swap the two faces of selected dominoes to make either row constant. Minimize swaps, or return -1 if impossible.'),
678:('checkValidString','星号括号串','Wildcard Parentheses','每个星号可表示左括号、右括号或空串。判断能否得到合法括号串，能输出1，否则0。','Each star may become an opening parenthesis, a closing parenthesis or nothing. Return 1 if a balanced string can result, otherwise 0.'),
826:('maxProfitAssignment','安排工作最大收益','Maximum Work Assignment Profit','每个工人最多做一项难度不高于其能力的工作，同一种工作可由多人做。求最大总收益。','Each worker may do one job no harder than their ability. Multiple workers may perform the same job. Maximize total profit.'),
630:('scheduleCourse','截止日期前选课','Maximum Courses Before Deadlines','从第1天开始连续安排课程，一次只能上一门，每门耗时duration且须在lastDay结束前完成。可重排，求最多完成门数。','Starting on day 1, take nonoverlapping courses of the given durations, finishing each by its deadline. Reorder courses to maximize the number completed.'),
871:('minRefuelStops','最少加油次数','Minimum Refueling Stops','初始油量startFuel，每走一单位耗一单位油，油箱无限。在站点可取走全部燃油，求到target最少加油次数，无解返回-1。','Start with startFuel and consume one fuel per distance unit. The tank is unlimited and a stop takes all fuel at that station. Reach target with the fewest stops, or return -1.'),
1642:('furthestBuilding','能到达的最远楼','Furthest Reachable Building','从第0栋楼向右走，上升需支付高度差数量的砖或一架梯子，平走和下降免费。求最远可达下标。','Move right from building 0. An upward step costs its height difference in bricks or one ladder; level and downward steps are free. Return the furthest reachable index.'),
502:('findMaximizedCapital','项目投资最终资金','Maximum Final Capital','最多选择k个不同项目，每项需当前资金达到capital门槛，完成后增加profit而不扣门槛。求最大最终资金。','Complete at most k distinct projects. Current capital must meet a project threshold; completion adds its profit without spending the threshold. Maximize final capital.'),
1383:('maxPerformance','团队最大表现','Maximum Team Performance','选至多k人，表现为速度总和乘最小效率。先求最大表现，再对1000000007取模。','Choose at most k workers. Performance is total speed times minimum efficiency. Maximize performance before taking modulo 1000000007.'),
1802:('maxValue','受限数组指定位置最大值','Maximum Value in a Bounded Array','构造n个正整数，相邻差绝对值不超过1，总和不超过maxSum。最大化index位置的值。','Construct n positive integers with adjacent absolute differences at most one and sum at most maxSum. Maximize the value at index.'),
1074:('numSubmatrixSumTarget','目标和子矩阵计数','Count Target-Sum Submatrices','统计由连续行和连续列构成、元素和恰好为target的非空子矩阵数量。','Count nonempty rectangles of consecutive rows and columns whose entries sum exactly to target.'),
1079:('numTilePossibilities','字母牌不同序列数','Distinct Tile Sequences','每张字母牌最多用一次，任选非空部分并排列，求不同结果字符串的数量。','Use each letter tile at most once. Count distinct nonempty strings obtainable by selecting and arranging tiles.'),
291:('wordPatternMatch','模式与子串双射','Pattern-to-Substring Bijection','为pattern每种字母映射一个非空子串，不同字母映射必须不同；按pattern连接后应等于s。可行输出1，否则0。','Map each pattern letter to a nonempty substring, with distinct letters mapped distinctly. Return 1 if concatenating the mappings produces s, otherwise 0.'),
1593:('maxUniqueSplit','最多互异子串切分','Maximum Distinct Substring Split','把整串切成非空连续段，各段文本互不相同，求最多段数。','Split the whole string into nonempty consecutive pieces with pairwise distinct text. Maximize the number of pieces.'),
79:('exist','网格单词路径','Word Path in a Grid','从任意格开始，只能上下左右走，同一条路径不能重复用格子。判断能否拼出word，能输出1，否则0。','Start anywhere and move orthogonally without reusing a cell. Return 1 if a path spells word, otherwise 0.'),
52:('totalNQueens','N皇后方案数','Count N-Queens Arrangements','在n×n棋盘放n个皇后，任意两枚不能同行、同列或同对角线，求方案数。','Place n queens on an n-by-n board without shared rows, columns or diagonals. Count arrangements.'),
679:('judgePoint24','四张牌凑24','Make Twenty-Four','恰好用四张牌各一次，可加减乘除和加括号，除法为实数除法，不允许拼接数字。能得到24输出1，否则0。','Use each of four cards once with addition, subtraction, multiplication, real division and parentheses. Do not concatenate digits. Return 1 if 24 is achievable, otherwise 0.'),
1239:('maxLength','拼接串最多互异字母','Longest Unique-Letter Concatenation','选取部分字符串按原顺序拼接，要求结果不含重复字母，求最大长度，可选空集。','Concatenate a subsequence of the strings so every letter is unique. Maximize length; choosing nothing is allowed.'),
1255:('maxScoreWords','库存字母组成单词的最大分','Maximum Word Score from Letter Stock','每个输入单词位置最多选择一次，消耗其全部字母。总消耗不能超过letters库存，求按字母score计分的最大总分。','Select each word occurrence at most once, consuming all its letters from the available stock. Maximize the sum of per-letter scores.'),
93:('restoreIpAddresses','恢复IPv4地址','Restore IPv4 Addresses','把数字串切成四个十进制段，每段0至255且无多余前导零，输出全部不同合法IPv4地址。','Split the digit string into four decimal fields, each 0 through 255 with no extra leading zeros. Output all distinct valid IPv4 addresses.'),
320:('generateAbbreviations','全部广义缩写','All Generalized Abbreviations','将任意不相交字母连续段替换为该段长度；相邻被缩写字符须合并计数。输出全部不同结果，包含原词。','Replace selected letter runs by their lengths, merging adjacent abbreviated letters into one count. Output all distinct results, including the original word.'),
267:('generatePalindromes','全部回文排列','All Palindromic Permutations','重排全部字符，输出所有不同回文字符串；无合法排列则输出空集合。','Rearrange every character and output all distinct palindromes, or an empty collection if impossible.'),
301:('removeInvalidParentheses','最少删除括号的全部结果','All Minimum-Deletion Balanced Results','只允许删除圆括号，删除数量必须最少，使结果合法。保留全部字母，输出所有不同合法结果。','Delete only parentheses, using the fewest deletions needed for balance. Preserve every letter and output all distinct optimal results.'),
282:('addOperators','插入运算符达到目标','Insert Operators to Reach a Target','在数字间插入+、-或*，也可不插入；数值段不能有多余前导零，遵循通常乘法优先级。输出所有结果等于target的不同表达式。','Insert +, - or * between digits, optionally leaving gaps unseparated. Numeric fields cannot have extra leading zeros. Use normal precedence and output all distinct expressions equal to target.'),
212:('findWords','网格中全部字典词','Find Dictionary Words in a Grid','对字典每个词，判断能否从任意格出发上下左右走拼出，同一路径不能重复格子。输出所有找到的不同词。','For each dictionary word, seek an orthogonal grid path starting anywhere without reusing cells. Output all distinct words found.')}
INPUT={
1007:('第一行n，第二、三行各n个上下排值；2≤n≤20000，值1–6。','First line n, then n top and n bottom values on separate lines; 2≤n≤20000, values 1–6.'),
678:('一行由(、)、*组成的串，长度1–100。','One string of (, ) and *, length 1–100.'),
826:('第一行n m，后面三行依次为n个difficulty、n个profit、m个worker；1≤n,m≤10000，所有数值1–100000。','First line n m; next lines contain n difficulties, n profits and m worker abilities. 1≤n,m≤10000; all values 1–100000.'),
630:('第一行n，接着n行duration lastDay；1≤n≤10000，两项值均1–10000。','First line n, then n duration-deadline pairs; 1≤n≤10000, both values 1–10000.'),
871:('第一行target startFuel n，接着n行position fuel；1≤target,startFuel≤1000000000，0≤n≤500；站点严格按位置递增，1≤position<target，1≤fuel<1000000000。','First line target startFuel n, then n position-fuel pairs. 1≤target,startFuel≤1000000000, 0≤n≤500. Positions strictly increase with 1≤position<target; 1≤fuel<1000000000.'),
1642:('第一行n bricks ladders，第二行n个高度；1≤n≤100000，高度1–1000000，0≤bricks≤1000000000，0≤ladders≤n。','First line n bricks ladders, then n heights. 1≤n≤100000, heights 1–1000000, 0≤bricks≤1000000000, 0≤ladders≤n.'),
502:('第一行n k w，第二行n个profits，第三行n个capital；1≤n,k≤100000，0≤w,capital[i]≤1000000000，0≤profits[i]≤10000，最终答案保证在32位有符号范围。','First line n k w, then n profits and n capital thresholds. 1≤n,k≤100000; 0≤w,capital[i]≤1000000000; 0≤profits[i]≤10000; final answer fits signed 32-bit integers.'),
1383:('第一行n k，第二行n个speed，第三行n个efficiency；1≤k≤n≤100000，速度1–100000，效率1–100000000。','First line n k, then n speeds and n efficiencies. 1≤k≤n≤100000; speeds 1–100000, efficiencies 1–100000000.'),
1802:('一行n index maxSum；1≤n≤maxSum≤1000000000，0≤index<n。','One line n index maxSum; 1≤n≤maxSum≤1000000000, 0≤index<n.'),
1074:('第一行m n target，接着m行各n个整数；1≤m,n≤100，元素[-1000,1000]，target在[-100000000,100000000]。','First line m n target, then m rows of n integers. 1≤m,n≤100, entries in [-1000,1000], target in [-100000000,100000000].'),
1079:('一行大写英文字母串，长度1–7。','One uppercase English string, length 1–7.'),
291:('第一行pattern，第二行s；均为小写英文字母，长度各1–20。','Two lines: pattern and s, each lowercase English and length 1–20.'),
1593:('一行小写英文字母串，长度1–16。','One lowercase English string, length 1–16.'),
79:('第一行m n，接着m行各n个大小写英文字母，最后一行word；1≤m,n≤6，word长1–15，区分大小写。','First line m n, then m rows of n English letters, then word. 1≤m,n≤6, word length 1–15; uppercase and lowercase letters are distinct.'),
52:('一行n，1≤n≤9。','One integer n, 1≤n≤9.'),
679:('一行恰好四个整数，每个在1–9。','One line of exactly four integers, each 1–9.'),
1239:('第一行n，接着n行小写英文串；1≤n≤16，每串长度1–26。','First line n, then n lowercase English strings; 1≤n≤16, each length 1–26.'),
1255:('第一行n，接着n行words，再一行letters和一行26个score，按a到z排列；1≤n≤14，词长1–15，letters长1–100，均小写，0≤score≤10。','First line n, then n words, one letters line and one line of 26 scores for a through z. 1≤n≤14, word lengths 1–15, letters length 1–100, all lowercase; scores 0–10.'),
93:('一行数字串，长度1–20；可能无解。','One digit string, length 1–20; it may have no solution.'),
320:('一行小写英文单词，长度1–15。','One lowercase English word, length 1–15.'),
267:('一行小写英文字母串，长度1–16。','One lowercase English string, length 1–16.'),
301:('一行小写字母和圆括号组成的串，长度1–25，其中括号最多20个。','One string of lowercase letters and parentheses, length 1–25, with at most 20 parentheses.'),
282:('第一行数字串num，长度1–10；第二行target，在[-2147483648,2147483647]。','First line num, a digit string of length 1–10; second line target in [-2147483648,2147483647].'),
212:('第一行m n k，接着m行各n个小写字母，再k行不同单词；1≤m,n≤12，1≤k≤30000，词长1–10且均小写。','First line m n k, then m rows of n lowercase letters and k distinct words. 1≤m,n≤12, 1≤k≤30000, word lengths 1–10, all lowercase.')}
MISTAKES={1007:('只尝试第一张上面的值','只尝试把上排变相同'),678:('把所有星号删除','忽略前缀右括号过多'),826:('不允许能力恰好等于难度','误认为工作不可重复'),630:('按耗时而非截止时间排序','超时时只丢弃当前课'),871:('不能在油量恰好用完时加油','优先取最少燃油站'),1642:('梯子按遇到顺序先用','砖按遇到顺序先用'),502:('门槛错误使用严格小于','优先选择利润最低项目'),1383:('要求恰好选k人','使用全体最大效率'),1802:('忽略两侧正整数最低值','总和限制写成严格小于'),1074:('相同前缀和只计一次','仅计单行子矩阵'),1079:('按牌下标计数未去重','计入空序列'),291:('不同字母允许同一子串','每个字母只匹配一字符'),1593:('直接返回不同字母数','允许重复子串分段'),79:('允许同一路径重复格子','只从左上角开始'),52:('漏掉一条对角线约束','漏掉另一条对角线约束'),679:('除法错误截断为整数','只枚举左结合表达式'),1239:('忽略单个串内部重复','忽略不同串之间重复'),1255:('每种字母仅计一次分','选词后不扣减库存'),93:('允许前导零','允许数段超过255'),320:('连续缩写未合并计数','禁止连续两个字符缩写'),267:('只输出一种半串顺序','忽略多个奇数频次'),301:('删除所有括号','只输出第一个最优解'),282:('乘法按从左到右运算','允许多位数前导零'),212:('允许路径重复格子','只从左上角查词')}
EDGES[678].extend([['(*'],[')']])
EDGES[630].append([[[2,17],[1,12],[2,9],[6,6]]])
EDGES[871].append([20,10,[[2,12],[3,2]]])
EDGES[1642].append([[1,8,11,15],7,1])
EDGES[79].append([[list('AB')],'ABA'])
EDGES[679].append([[7,1,7,1]])
EDGES[212].append([[list('ab')],['aba']])
PREFIX='import itertools,re,heapq,math,sys\nfrom collections import Counter,deque\nfrom fractions import Fraction\nfrom functools import lru_cache\nMOD=1000000007\n'+inspect.getsource(balanced)+inspect.getsource(find_words)+inspect.getsource(variant)
PROBLEMS={}
for pid in IDS:
 method,zh,en,dzh,den=META[pid];izh,ien=INPUT[pid];kind='string-set' if pid in SETS else 'integer'
 outputZh='第一行输出结果个数，随后每行一个不同结果，顺序不限；空字符串结果占一整空行。' if pid in SETS else '输出一个整数并换行。'
 outputEn='Print the result count, then one distinct result per line in any order; an empty-string result occupies an empty line.' if pid in SETS else 'Print one integer followed by a newline.'
 suffix='value=variant(PID,args,BUG)\n'+('print(len(value))\nfor s in value: print(s)' if pid in SETS else 'print(value)')
 PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dzh,descriptionEn=den,inputZh=izh,inputEn=ien,outputZh=outputZh,outputEn=outputEn,difficulty='困难' if pid in (630,871,502,1383,1074,291,52,1255,301,282,212) else '中等',edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r,p=pid:random_args(p,r),oracle=lambda a,p=pid:oracle(p,a),encode=lambda a,p=pid:encode(p,a),parse=parse(pid),validate=lambda a,p=pid:validate(p,a),resultKind=kind,outputLimit=4096 if pid==301 else 1024 if pid in SETS else 64,mutants=[dict(name=name,source=PREFIX+'\n'+parse(pid)+'\n'+suffix.replace('PID',str(pid)).replace('BUG',str(bug))+'\n') for bug,name in enumerate(MISTAKES[pid],1)])
