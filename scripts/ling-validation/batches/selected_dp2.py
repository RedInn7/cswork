"""Selected stack, interval and scheduling problems; all fixtures are authored.

Small oracles enumerate candidates or directly simulate the statement. Sources
were read for domains only and are never executed by this module.
"""
import itertools,inspect,re,heapq
from collections import Counter,deque
from functools import lru_cache
MOD=1000000007
IDS=[227,772,726,496,503,84,85,907,2104,456,962,402,316,735,946,921,1190,215,1834,2402,239,862,134,135,1029,1338,621,881,948,945]
ARRAY_RESULTS={496,503,735,1834,239}
STRING_RESULTS={726,402,316,1190}

def div(a,b):return (1 if a*b>=0 else -1)*(abs(a)//abs(b))

def calculator(s,bug=0):
 """Iterative operator-precedence grammar validator and evaluator."""
 tokens=re.findall(r'\d+|[()+*/-]',s);values=[];ops=[];expect=True
 def apply():
  op=ops.pop();b,a=values.pop(),values.pop()
  if op=='/':assert b!=0
  v={'+':lambda:a+b,'-':lambda:a-b,'*':lambda:a*b,'/':lambda:((1 if a*b>=0 else -1)*((abs(a)+abs(b)//2)//abs(b)) if bug==2 else div(a,b))}[op]()
  assert -2**31<=v<2**31;values.append(v)
 for t in tokens:
  if t.isdigit():
   assert expect;v=int(t);assert v<2**31;values.append(v);expect=False
  elif t=='(':assert expect;ops.append(t)
  elif t==')':
   assert not expect
   while ops and ops[-1]!='(':apply()
   assert ops;ops.pop()
  else:
   assert not expect
   while ops and ops[-1]!='(' and (bug==1 or ops[-1] in '*/' or t in '+-'):apply()
   ops.append(t);expect=True
 assert not expect
 while ops:assert ops[-1]!='(';apply()
 assert len(values)==1;return values[0]

def formula_counts(s):
 """Iterative grammar/size validator: counts have no unbounded expansion."""
 stack=[Counter()];i=0
 while i<len(s):
  if s[i]=='(':stack.append(Counter());i+=1;continue
  if s[i]==')':
   assert len(stack)>1 and stack[-1];v=stack.pop();i+=1
  else:
   assert 'A'<=s[i]<='Z';j=i+1
   while j<len(s) and 'a'<=s[j]<='z':j+=1
   v=Counter({s[i:j]:1});i=j
  j=i
  while j<len(s) and s[j].isdigit():j+=1
  amount=int(s[i:j]) if j>i else 1
  assert amount>=1 and (j==i or amount>1 and s[i]!='0')
  for k,n in v.items():stack[-1][k]+=n*amount;assert stack[-1][k]<2**31
  i=j
 assert len(stack)==1 and stack[0];return stack[0]

def formula_text(c):return ''.join(k+(str(c[k]) if c[k]>1 else '') for k in sorted(c))

def oracle(pid,a):
 x=a[0];n=len(x) if hasattr(x,'__len__') else x
 if pid in (227,772):
  tokens=re.findall(r'\d+|[()+*/-]',x);i=0
  def atom():
   nonlocal i
   t=tokens[i];i+=1
   if t!='(':return int(t)
   v=expr();assert tokens[i]==')';i+=1;return v
  def term():
   nonlocal i
   v=atom()
   while i<len(tokens) and tokens[i] in '*/':
    op=tokens[i];i+=1;w=atom();v=v*w if op=='*' else div(v,w)
   return v
  def expr():
   nonlocal i
   v=term()
   while i<len(tokens) and tokens[i] in '+-':
    op=tokens[i];i+=1;w=term();v=v+w if op=='+' else v-w
   return v
  answer=expr();assert i==len(tokens);return answer
 if pid==726:
  # Recursive group expansion into a list of atom names, for small inputs only.
  tokens=re.findall(r'[A-Z][a-z]*|\d+|[()]',x);i=0
  def group():
   nonlocal i
   result=[]
   while i<len(tokens) and tokens[i]!=')':
    t=tokens[i];i+=1
    if t=='(':part=group();i+=1
    else:part=[t]
    count=1
    if i<len(tokens) and tokens[i].isdigit():count=int(tokens[i]);i+=1
    result+=part*count
   return result
  return formula_text(Counter(group()))
 if pid==496:return [next((w for w in a[1][a[1].index(v)+1:] if w>v),-1) for v in x]
 if pid==503:return [next((x[(i+k)%n] for k in range(1,n) if x[(i+k)%n]>v),-1) for i,v in enumerate(x)]
 if pid==84:return max(min(x[i:j])*(j-i) for i in range(n) for j in range(i+1,n+1))
 if pid==85:
  return max([0]+[(b-t)*(r-l) for t in range(n) for b in range(t+1,n+1) for l in range(len(x[0])) for r in range(l+1,len(x[0])+1) if all(x[i][j]=='1' for i in range(t,b) for j in range(l,r))])
 if pid==907:return sum(min(x[i:j]) for i in range(n) for j in range(i+1,n+1))%MOD
 if pid==2104:return sum(max(x[i:j])-min(x[i:j]) for i in range(n) for j in range(i+1,n+1))
 if pid==456:return int(any(x[i]<x[k]<x[j] for i,j,k in itertools.combinations(range(n),3)))
 if pid==962:return max([0]+[j-i for i in range(n) for j in range(i+1,n) if x[i]<=x[j]])
 if pid==402:
  vals=[''.join(x[i] for i in chosen).lstrip('0') or '0' for chosen in itertools.combinations(range(n),n-a[1])]
  return min(vals,key=lambda s:(len(s),s))
 if pid==316:
  chars=set(x);return min(''.join(x[i] for i in c) for c in itertools.combinations(range(n),len(chars)) if {x[i] for i in c}==chars)
 if pid==735:
  v=x[:]
  while True:
   i=next((i for i in range(len(v)-1) if v[i]>0>v[i+1]),None)
   if i is None:return v
   u,w=v[i:i+2];v[i:i+2]=[u] if u>-w else [w] if u<-w else []
 if pid==946:
  def walk(i,stack,out):
   if out==n:return True
   return bool(stack and stack[-1]==a[1][out] and walk(i,stack[:-1],out+1)) or i<n and walk(i+1,stack+(x[i],),out)
  return int(walk(0,(),0))
 if pid==921:
  # Longest balanced subsequence leaves exactly the brackets needing partners.
  best=0
  for mask in range(1<<n):
   bal=count=0
   for i,c in enumerate(x):
    if mask>>i&1:
     bal+=1 if c=='(' else -1;count+=1
     if bal<0:break
   else:
    if bal==0:best=max(best,count)
  return n-best
 if pid==1190:
  s=x
  while '(' in s:s=re.sub(r'\(([a-z]*)\)',lambda m:m[1][::-1],s)
  return s
 if pid==215:return sorted(x,reverse=True)[a[1]-1]
 if pid==1834:
  pending=set(range(n));time=0;out=[]
  while pending:
   available=[i for i in pending if x[i][0]<=time]
   if not available:time=min(x[i][0] for i in pending);continue
   i=min(available,key=lambda i:(x[i][1],i));time+=x[i][1];pending.remove(i);out.append(i)
  return out
 if pid==2402:
  end=[0]*x;counts=[0]*x
  for s,e in sorted(a[1]):
   free=[i for i in range(x) if end[i]<=s];i=min(free) if free else min(range(x),key=lambda i:(end[i],i))
   end[i]=max(s,end[i])+e-s;counts[i]+=1
  return max(range(x),key=lambda i:(counts[i],-i))
 if pid==239:return [max(x[i:i+a[1]]) for i in range(n-a[1]+1)]
 if pid==862:return min([n+1]+[j-i for i in range(n) for j in range(i+1,n+1) if sum(x[i:j])>=a[1]]) if any(sum(x[i:j])>=a[1] for i in range(n) for j in range(i+1,n+1)) else -1
 if pid==134:
  valid=[]
  for start in range(n):
   tank=0
   for k in range(n):
    i=(start+k)%n;tank+=x[i]-a[1][i]
    if tank<0:break
   else:valid.append(start)
  assert len(valid)<=1;return valid[0] if valid else -1
 if pid==135:
  # Exhaustive assignments for <=6 children; reject any adjacent inequality.
  return min(sum(c) for c in itertools.product(range(1,n+1),repeat=n) if all(x[i]==x[i+1] or (c[i]>c[i+1] if x[i]>x[i+1] else c[i]<c[i+1]) for i in range(n-1)))
 if pid==1029:return min(sum(x[i][0 if i in chosen else 1] for i in range(n)) for chosen in itertools.combinations(range(n),n//2))
 if pid==1338:
  counts=Counter(x);keys=list(counts)
  return min(len(c) for k in range(len(keys)+1) for c in itertools.combinations(keys,k) if sum(counts[v] for v in c)>=n//2)
 if pid==621:
  keys=sorted(set(x));start=tuple(x.count(k) for k in keys)
  @lru_cache(None)
  def schedule(left,wait):
   if not any(left):return 0
   options=[i for i in range(len(keys)) if left[i] and wait[i]==0]
   if not options:return 1+schedule(left,tuple(max(0,v-1) for v in wait))
   answer=10**9
   for i in options:
    l=list(left);l[i]-=1;w=[max(0,v-1) for v in wait];w[i]=a[1];answer=min(answer,1+schedule(tuple(l),tuple(w)))
   return answer
  return schedule(start,(0,)*len(keys))
 if pid==881:
  @lru_cache(None)
  def boats(mask):
   if not mask:return 0
   i=(mask&-mask).bit_length()-1;rest=mask^(1<<i)
   return 1+min([boats(rest)]+[boats(rest^(1<<j)) for j in range(n) if rest>>j&1 and x[i]+x[j]<=a[1]])
  return boats((1<<n)-1)
 if pid==948:
  @lru_cache(None)
  def play(mask,power,score):
   best=score
   for i,v in enumerate(x):
    if not mask>>i&1:
     if power>=v:best=max(best,play(mask|1<<i,power-v,score+1))
     if score:best=max(best,play(mask|1<<i,power+v,score-1))
   return best
  return play(0,a[1],0)
 if pid==945:
  # Minimum injective assignment above each value, enumerated for small arrays.
  vals=sorted(x)
  def assign(i,last):
   if i==n:return 0
   return min((v-vals[i]+assign(i+1,v) for v in range(max(vals[i],last+1),max(vals)+n)),default=10**9)
  return assign(0,-1)
 raise AssertionError(pid)

def variant(pid,a,bug=0):
 x=a[0];n=len(x) if hasattr(x,'__len__') else x
 if pid in (227,772):return calculator(x,bug)
 if pid==726:
  counts=formula_counts(re.sub(r'\)\d+',')',x) if bug==1 else x)
  return ''.join(k+str(counts[k]) for k in sorted(counts)) if bug==2 else formula_text(counts)
 if pid in (496,503):
  values=a[1] if pid==496 else x;m=len(values);result=[-1]*m;stack=[]
  for i in range(m*(1 if pid==496 or bug==1 else 2)):
   v=values[i%m]
   while stack and (values[stack[-1]]<v or bug==2 and values[stack[-1]]==v):result[stack.pop()]=v
   if i<m:stack.append(i)
  if pid==496:
   if bug==1:return [max(a[1][a[1].index(v)+1:],default=-1) for v in x]
   if bug==2:return [next((w for w in reversed(a[1][:a[1].index(v)]) if w>v),-1) for v in x]
   return [result[a[1].index(v)] for v in x]
  return result
 if pid in (84,85):
  def area(v):
   stack=[-1];best=0;values=v+[0]
   for i,h in enumerate(values):
    while stack[-1]!=-1 and values[stack[-1]]>h:
     height=values[stack.pop()];best=max(best,height*(i-stack[-1]-(0 if bug==1 else 1)))
    stack.append(i)
   return best
  if pid==84:return max(x) if bug==2 else area(x)
  heights=[0]*len(x[0]);best=0
  for row in x:
   heights=[h+1 if c=='1' else (h if bug==2 else 0) for h,c in zip(heights,row)];best=max(best,area(heights))
  return best
 if pid in (907,2104):
  def sums(values):
   stack=[];ans=0
   for i in range(len(values)+1):
    while stack and (i==len(values) or values[stack[-1]]>=values[i]):
     j=stack.pop();left=stack[-1] if stack else -1;ans+=values[j]*(j-left)*(i-j)
    stack.append(i)
   return ans
  if pid==907:
   if bug==1:return sum(x)%MOD
   ans=sums(x);return ans if bug==2 else ans%MOD
  if bug==1:return max(x)-min(x)
  if bug==2:return sum(abs(v-u) for u,v in zip(x,x[1:]))
  return -sums([-v for v in x])-sums(x)
 if pid==456:
  if bug==1:return int(any(x[i]<x[i+2]<x[i+1] for i in range(n-2)))
  third=-float('inf');stack=[]
  for v in reversed(x):
   if v<third or bug==2 and v==third:return 1
   while stack and stack[-1]<v:third=stack.pop()
   stack.append(v)
  return 0
 if pid==962:
  if bug==2:return max([0]+[i for i in range(n) if x[i]>=x[0]])
  stack=[];best=0
  for i,v in enumerate(x):
   if not stack or v<x[stack[-1]]:stack.append(i)
  for j in range(n-1,-1,-1):
   while stack and (x[stack[-1]]<x[j] if bug==1 else x[stack[-1]]<=x[j]):best=max(best,j-stack.pop())
  return best
 if pid==402:
  k=a[1];stack=[]
  for c in x:
   while k and stack and (stack[-1]<c if bug==1 else stack[-1]>c):stack.pop();k-=1
   stack.append(c)
  if k and bug!=2:stack=stack[:-k]
  return ''.join(stack).lstrip('0') or '0'
 if pid==316:
  if bug==1:return ''.join(sorted(set(x)))
  remaining=Counter(x);seen=set();stack=[]
  for c in x:
   remaining[c]-=1
   if c in seen:continue
   while stack and stack[-1]>c and (bug==2 or remaining[stack[-1]]):seen.remove(stack.pop())
   seen.add(c);stack.append(c)
  return ''.join(stack)
 if pid==735:
  stack=[]
  for v in x:
   alive=True
   while stack and (stack[-1]>0>v or bug==1 and stack[-1]<0<v):
    if abs(stack[-1])<abs(v):stack.pop();continue
    if abs(stack[-1])==abs(v) and bug!=2:stack.pop()
    alive=False;break
   if alive:stack.append(v)
  return stack
 if pid==946:
  if bug==1:return int(x==a[1] or x[::-1]==a[1])
  stack=[];j=0
  for v in x:
   stack.append(v)
   while stack and stack[-1]==a[1][j]:
    stack.pop();j+=1
    if bug==2:break
  return int(j==n)
 if pid==921:
  if bug==1:return abs(x.count('(')-x.count(')'))
  bal=missing=0
  for c in x:
   if c=='(':bal+=1
   elif bal:bal-=1
   else:missing+=1
  return missing if bug==2 else missing+bal
 if pid==1190:
  if bug==1:return x.replace('(','').replace(')','')[::-1]
  stack=[];text=''
  for c in x:
   if c=='(':stack.append(text);text=''
   elif c==')':text=stack.pop()+(text if bug==2 else text[::-1])
   else:text+=c
  return text
 if pid==215:
  v=sorted(set(x) if bug==1 else x,reverse=bug!=2);return v[min(a[1],len(v))-1]
 if pid==1834:
  tasks=sorted((s,t,i) for i,(s,t) in enumerate(x));heap=[];clock=0;i=0;ans=[]
  while i<n or heap:
   if not heap:clock=max(clock,tasks[i][0])
   while i<n and tasks[i][0]<=clock:
    s,t,j=tasks[i];heapq.heappush(heap,(j if bug==1 else t,-j if bug==2 else j,t,j));i+=1
   _,_,t,j=heapq.heappop(heap);clock+=t;ans.append(j)
  return ans
 if pid==2402:
  free=list(range(x));busy=[];counts=[0]*x
  for s,e in sorted(a[1]):
   while busy and (busy[0][0]<s if bug==1 else busy[0][0]<=s):_,i=heapq.heappop(busy);heapq.heappush(free,i)
   if free:i=heapq.heappop(free);end=e
   else:until,i=heapq.heappop(busy);end=until+e-s
   heapq.heappush(busy,(end,i));counts[i]+=1
  return max(range(x),key=lambda i:(counts[i],i if bug==2 else -i))
 if pid==239:
  k=a[1];q=deque();out=[]
  for i,v in enumerate(x):
   while q and q[0]<=i-k:q.popleft()
   while q and (x[q[-1]]>v if bug==1 else x[q[-1]]<v):q.pop()
   q.append(i)
   if i>=k-1:out.append(x[q[-1] if bug==2 else q[0]])
  return out
 if pid==862:
  if bug==1:
   left=total=0;best=n+1
   for i,v in enumerate(x):
    total+=v
    while left<=i and total>=a[1]:best=min(best,i-left+1);total-=x[left];left+=1
   return best if best<=n else -1
  prefix=[0]
  for v in x:prefix.append(prefix[-1]+v)
  q=deque();best=n+1
  for i,v in enumerate(prefix):
   while q and (v-prefix[q[0]]>a[1] if bug==2 else v-prefix[q[0]]>=a[1]):best=min(best,i-q.popleft())
   while q and prefix[q[-1]]>=v:q.pop()
   q.append(i)
  return best if best<=n else -1
 if pid==134:
  if bug==1:return max(range(n),key=lambda i:x[i]-a[1][i])
  total=tank=start=0
  for i,(g,c) in enumerate(zip(x,a[1])):
   total+=g-c;tank+=g-c
   if tank<0:start=i+1;tank=0
  return start%n if bug==2 or total>=0 else -1
 if pid==135:
  left=[1]*n;right=[1]*n
  for i in range(1,n):
   if x[i]>x[i-1] or bug==2 and x[i]==x[i-1]:left[i]=left[i-1]+1
  for i in range(n-2,-1,-1):
   if x[i]>x[i+1] or bug==2 and x[i]==x[i+1]:right[i]=right[i+1]+1
  return sum(left) if bug==1 else sum(max(u,v) for u,v in zip(left,right))
 if pid==1029:
  costs=sorted(x,key=lambda p:p[0] if bug==1 else p[0]-p[1]);half=n//2
  if bug==2:return sum(min(v) for v in x)
  return sum(v[0] if i<half else v[1] for i,v in enumerate(costs))
 if pid==1338:
  counts=sorted(Counter(x).values(),reverse=bug!=1);total=0
  for i,c in enumerate(counts):
   total+=c
   if total>n//2 if bug==2 else total>=n//2:return i+1
 if pid==621:
  counts=Counter(x);peak=max(counts.values());ties=sum(c==peak for c in counts.values())
  formula=(peak-1)*(a[1]+1)+(1 if bug==2 else ties)
  return formula if bug==1 else max(n,formula)
 if pid==881:
  v=sorted(x);left=0;right=n-1;boats=0
  while left<=right:
   if left<right and (v[left]+v[right]<a[1] if bug==1 else v[left]+v[right]<=a[1]):left+=1
   elif bug==2 and left<right and v[left]+v[left+1]<=a[1]:left+=2;boats+=1;continue
   right-=1;boats+=1
  return boats
 if pid==948:
  v=sorted(x);lo=0;hi=n-1;power=a[1];score=best=0
  while lo<=hi:
   if power>=v[lo]:power-=v[lo];lo+=1;score+=1;best=max(best,score)
   elif score and bug!=1:power+=v[hi];hi-=1;score-=1
   else:break
  return score if bug==2 else best
 if pid==945:
  v=x if bug==1 else sorted(x);last=-1;cost=0
  for w in v:
   target=max(w,last+(0 if bug==2 else 1));cost+=target-w;last=target
  return cost
 raise AssertionError(pid)

EDGES={227:[['3+2*2'],['3/2'],[' 0-7/3 ']],772:[['2*(5+5*2)/3+(6/2+8)'],['3/2'],['(0-7)/3']],726:[['K4(ON(SO3)2)2'],['H2O'],['Mg(OH)2']],496:[[[4,1,2],[1,3,4,2]],[[1],[1,3,2,4]]],503:[[[1,2,1]],[[2,1]],[[1,1]]],84:[[[2,1,5,6,2,3]],[[2,2]],[[0]]],85:[[[list('10100'),list('10111'),list('11111'),list('10010')]],[[list('11'),list('00'),list('11')]]],907:[[[3,1,2,4]],[[1,1]],[[30000]*4]],2104:[[[1,2,3]],[[1,1,1]],[[3,1,3]]],456:[[[3,1,4,2]],[[1,3,4,2]],[[1,2,1]]],962:[[[6,0,8,2,1,5]],[[1,1]],[[9,1,2]]],402:[['1432219',3],['12345',2],['10',2]],316:[['cbacdcbc'],['bcabc'],['ba']],735:[[[5,10,-5]],[[8,-8]],[[-2,1]],[[10,2,-5]]],946:[[[1,2,3,4,5],[4,5,3,2,1]],[[1,2,3],[2,1,3]],[[1,2,3],[3,1,2]]],921:[['())'],['(('],[')(']],1190:[['(u(love)i)'],['a(bc)d'],['abc']],215:[[[3,2,1,5,6,4],2],[[2,2,1],2]],1834:[[[[1,2],[2,4],[3,2],[4,1]]],[[[1,3],[1,1],[1,1]]]],2402:[[2,[[0,10],[1,5],[2,7],[3,4]]],[2,[[0,2],[1,5],[2,3]]],[2,[[0,10],[1,2]]]],239:[[[1,3,-1,-3,5,3,6,7],3],[[2,1],2]],862:[[[2,-1,2],3],[[1],1],[[84,-37,32,40,95],167]],134:[[[1,2,3,4,5],[3,4,5,1,2]],[[2,3,4],[3,4,3]],[[2,0,1],[1,2,0]]],135:[[[1,0,2]],[[1,2,2]],[[3,2,1]]],1029:[[[[10,20],[30,200],[400,50],[30,20]]],[[[1,2],[2,100]]]],1338:[[[3,3,3,3,5,5,5,2,2,7]],[[1,1,2,2]],[[1,1,1,2,3,4]]],621:[[list('AAABBB'),2],[list('ABCDEF'),1]],881:[[[3,2,2,1],3],[[1,2],3],[[1,1,2,2],3]],948:[[[100,200,300,400],200],[[100,200],150],[[],0]],945:[[[3,2,1,2,1,7]],[[1,1]],[[2,1]]]}
PRESSURE={
227:[(['1+'*149999+'1 '],150000)],772:[(['('*4999+'1'+')'*4999],1),(['1+'*4999+'1'],5000)],726:[(['H'*1000],'H1000'),(['('*499+'H'+')'*499],'H')],
496:[([list(range(1000)),list(range(1000))],list(range(1,1000))+[-1])],503:[([[10**9]*10000],[-1]*10000)],84:[([[10000]*100000],10**9)],85:[([[['1']*200 for _ in range(200)]],40000)],907:[([[30000]*30000],30000*30000*30001//2%MOD)],2104:[([[-10**9,10**9]*500],1000*999//2*2*10**9)],456:[([list(range(200000))],0)],962:[([[50000]*50000],49999)],402:[(['9'*100000,99999],'9')],316:[(['abcdefghijklmnopqrstuvwxyz'*384+'abcd'],'abcdefghijklmnopqrstuvwxyz')],735:[([[1000]*5000+[-1000]*5000],[])],946:[([list(range(1000)),list(range(999,-1,-1))],1)],921:[([')'*1000],1000)],1190:[(['('*999+'ab'+')'*999],'ba')],215:[([[10000]*100000,100000],10000)],1834:[([[[1,10**9] for _ in range(100000)]],list(range(100000)))],2402:[([100,[[i,i+1] for i in range(100000)]],0)],239:[([[10000]*100000,50000],[10000]*50001)],862:[([[-100000]*100000,10**9],-1)],134:[([[0]*99999+[1],[1]+[0]*99999],99999)],135:[([list(range(20000))],20000*20001//2)],1029:[([[[1000,1000] for _ in range(100)]],100000)],1338:[([list(range(1,100001))],50000)],621:[(['A'*10000,100],9999*101+1)],881:[([[30000]*50000,30000],50000)],948:[([[0]*1000,0],1000)],945:[([[0]*50000+list(range(50000,100000))],50000*49999//2),([[100000]*65536],65536*65535//2)]}

def random_args(pid,r):
 n=r.randint(1,8)
 if pid in (227,772):
  def expr(depth):
   if depth==0 or r.random()<.3:return str(r.randint(0,9))
   left=expr(depth-1);op=r.choice('+-*');right=expr(depth-1)
   return '('+left+op+right+')'
  if pid==772:return [expr(3)]
  return [''.join([str(r.randint(0,9))]+[r.choice('+-*/')+str(r.randint(1,9)) for _ in range(n)])]
 if pid==726:
  def f(d):return r.choice(['H','He','Na','O'])+r.choice(['','2','3']) if d==0 else '('+f(d-1)+f(d-1)+')'+r.choice(['','2','3'])
  return [f(r.randint(0,2))]
 if pid==496:
  y=r.sample(range(20),n);return [r.sample(y,r.randint(1,n)),y]
 if pid==503:return [[r.randint(-5,5) for _ in range(n)]]
 if pid==84:return [[r.randint(0,9) for _ in range(n)]]
 if pid==85:return [[[r.choice('01') for _ in range(4)] for _ in range(r.randint(1,4))]]
 if pid==907:return [[r.randint(1,8) for _ in range(n)]]
 if pid in (2104,456):return [[r.randint(-5,5) for _ in range(n)]]
 if pid==962:return [[r.randint(0,8) for _ in range(max(2,n))]]
 if pid==402:return [r.choice('123456789')+''.join(r.choice('0123456789') for _ in range(n-1)),r.randint(1,n)]
 if pid==316:return [''.join(r.choice('abcd') for _ in range(n))]
 if pid==735:return [[r.choice([-4,-3,-2,-1,1,2,3,4]) for _ in range(max(2,n))]]
 if pid==946:
  x=r.sample(range(10),n);return [x,r.sample(x,n)]
 if pid==921:return [''.join(r.choice('()') for _ in range(n))]
 if pid==1190:
  def s(d):return r.choice(['a','bc','']) if d==0 else r.choice(['a',''])+'('+s(d-1)+')'+r.choice(['bc',''])
  return [s(r.randint(1,3))]
 if pid in (215,239):return [[r.randint(-8,8) for _ in range(n)],r.randint(1,n)]
 if pid==1834:return [[[r.randint(1,10),r.randint(1,7)] for _ in range(n)]]
 if pid==2402:return [r.randint(1,4),[[v,v+r.randint(1,8)] for v in r.sample(range(15),n)]]
 if pid==862:return [[r.randint(-5,7) for _ in range(n)],r.randint(1,15)]
 if pid==134:
  # Retry small candidates until the statement's unique-answer promise holds.
  while True:
   gas=[r.randint(0,4) for _ in range(n)];cost=[r.randint(0,4) for _ in range(n)]
   try:oracle(134,[gas,cost]);return [gas,cost]
   except AssertionError:pass
 if pid==135:return [[r.randint(0,4) for _ in range(r.randint(1,5))]]
 if pid==1029:return [[[r.randint(1,20),r.randint(1,20)] for _ in range(2*r.randint(1,4))]]
 if pid==1338:return [[r.randint(1,6) for _ in range(2*r.randint(1,4))]]
 if pid==621:return [list(''.join(r.choice('ABC') for _ in range(r.randint(1,7)))),r.randint(0,3)]
 if pid==881:
  limit=r.randint(1,10);return [[r.randint(1,limit) for _ in range(n)],limit]
 if pid==948:return [[r.randint(0,12) for _ in range(n%7)],r.randint(0,15)]
 if pid==945:return [[r.randint(0,5) for _ in range(r.randint(1,5))]]
 raise AssertionError(pid)


def validate(pid,a):
 expected=2 if pid in (496,402,946,215,2402,239,862,134,621,881,948) else 1
 assert type(a) is list and len(a)==expected;x=a[0]
 def num(v,lo,hi):assert type(v) is int and lo<=v<=hi
 def vec(v,nlo,nhi,lo,hi):
  assert type(v) is list and nlo<=len(v)<=nhi
  for w in v:num(w,lo,hi)
 if pid in (227,772):
  assert type(x) is str and 1<=len(x)<=(300000 if pid==227 else 10000) and re.fullmatch(r'[0-9+*/ -]+' if pid==227 else r'[0-9+*/()-]+',x);calculator(x)
 if pid==726:assert type(x) is str and 1<=len(x)<=1000 and re.fullmatch('[A-Za-z0-9()]+',x);formula_counts(x)
 domains={503:(1,10000,-10**9,10**9),84:(1,100000,0,10000),907:(1,30000,1,30000),2104:(1,1000,-10**9,10**9),456:(1,200000,-10**9,10**9),962:(2,50000,0,50000),735:(2,10000,-1000,1000),215:(1,100000,-10000,10000),239:(1,100000,-10000,10000),862:(1,100000,-100000,100000),135:(1,20000,0,20000),1338:(2,100000,1,100000),948:(0,1000,0,9999),945:(1,100000,0,100000)}
 if pid in domains:vec(x,*domains[pid])
 if pid in (496,946):
  vec(x,1,1000,0,10000 if pid==496 else 1000);vec(a[1],len(x),1000 if pid==496 else len(x),0,10000 if pid==496 else 1000)
  assert len(set(x))==len(x) and len(set(a[1]))==len(a[1]);assert set(x)<=set(a[1]) if pid==496 else set(x)==set(a[1])
 if pid==85:
  assert type(x) is list and 1<=len(x)<=200 and type(x[0]) is list and 1<=len(x[0])<=200
  for row in x:assert type(row) is list and len(row)==len(x[0]) and all(type(c) is str and c in ('0','1') for c in row)
 if pid==402:assert type(x) is str and 1<=len(x)<=100000 and re.fullmatch('[0-9]+',x) and (x=='0' or x[0]!='0');num(a[1],1,len(x))
 if pid==316:assert type(x) is str and 1<=len(x)<=10000 and re.fullmatch('[a-z]+',x)
 if pid==735:assert 0 not in x
 if pid in (921,1190):
  assert type(x) is str and 1<=len(x)<=(1000 if pid==921 else 2000) and re.fullmatch('[()]+' if pid==921 else '[a-z()]+',x)
  if pid==1190:
   balance=0
   for c in x:
    balance+=(c=='(')-(c==')');assert balance>=0
   assert balance==0
 if pid in (215,239):num(a[1],1,len(x))
 if pid==1834:
  assert type(x) is list and 1<=len(x)<=100000
  for row in x:vec(row,2,2,1,10**9)
 if pid==2402:
  num(x,1,100);assert type(a[1]) is list and 1<=len(a[1])<=100000
  for row in a[1]:vec(row,2,2,0,500000);assert row[0]<row[1]
  assert len({row[0] for row in a[1]})==len(a[1])
 if pid==862:num(a[1],1,10**9)
 if pid==134:
  vec(x,1,100000,0,10000);vec(a[1],len(x),len(x),0,10000)
  # A start is valid iff the minimum of its following n cumulative sums is
  # at least its current sum. A deque checks all rotations in linear time.
  d=[g-c for g,c in zip(x,a[1])];prefix=[0]
  for v in d+d:prefix.append(prefix[-1]+v)
  q=deque();valid=0;n=len(x)
  for i in range(1,2*n+1):
   while q and prefix[q[-1]]>=prefix[i]:q.pop()
   q.append(i)
   while q and q[0]<=i-n:q.popleft()
   if n<=i<2*n:valid+=prefix[q[0]]>=prefix[i-n]
  assert valid<=1
 if pid==1029:
  assert type(x) is list and 2<=len(x)<=100 and len(x)%2==0
  for row in x:vec(row,2,2,1,1000)
 if pid==1338:assert len(x)%2==0
 if pid==621:
  assert type(x) is list and 1<=len(x)<=10000 and all(type(c) is str and len(c)==1 and 'A'<=c<='Z' for c in x);num(a[1],0,100)
 if pid==881:num(a[1],1,30000);vec(x,1,50000,1,a[1])
 if pid==948:num(a[1],0,9999)
 if pid==945:
  # The original problem promises that the minimum cost fits signed int32.
  previous=-1;cost=0
  for value in sorted(x):
   assigned=max(value,previous+1);cost+=assigned-value;previous=assigned
  assert cost<2**31
 return True


def encode(pid,a):
 x=a[0]
 def line(v):return ' '.join(map(str,v))+'\n'
 if pid in (227,772,726,316,921,1190):return x+'\n'
 if pid==402:return x+'\n'+str(a[1])+'\n'
 if pid in (496,946,134):return line([len(x),len(a[1])])+line(x)+line(a[1])
 if pid==85:return line([len(x),len(x[0])])+''.join(''.join(row)+'\n' for row in x)
 if pid in (1834,1029):return str(len(x))+'\n'+''.join(line(row) for row in x)
 if pid==2402:return line([x,len(a[1])])+''.join(line(row) for row in a[1])
 if pid==621:return ''.join(x)+'\n'+str(a[1])+'\n'
 return str(len(x))+'\n'+line(x)+(str(a[1])+'\n' if len(a)==2 else '')

def parse(pid):
 if pid in (227,772,726,316,921,1190):return "args=[sys.stdin.readline().rstrip('\\n')]"
 if pid==402:return "args=[sys.stdin.readline().rstrip('\\n'),int(sys.stdin.readline())]"
 if pid==621:return "args=[list(sys.stdin.readline().rstrip('\\n')),int(sys.stdin.readline())]"
 if pid==85:return "m,n=map(int,sys.stdin.readline().split()); args=[[list(sys.stdin.readline().rstrip('\\n')) for _ in range(m)]]"
 prefix="it=iter(map(int,sys.stdin.read().split()))\n"
 if pid in (496,946,134):return prefix+"m,n=next(it),next(it); args=[[next(it) for _ in range(m)],[next(it) for _ in range(n)]]"
 if pid in (1834,1029):return prefix+"n=next(it); args=[[[next(it),next(it)] for _ in range(n)]]"
 if pid==2402:return prefix+"n,m=next(it),next(it); args=[n,[[next(it),next(it)] for _ in range(m)]]"
 return prefix+"n=next(it); args=[[next(it) for _ in range(n)]]"+("; args.append(next(it))" if pid in (215,239,862,881,948) else '')

META={
227:('calculate','基本计算器II','Basic Calculator II','按通常优先级计算加减乘除表达式，除法向零截断。','Evaluate addition, subtraction, multiplication and division with normal precedence; division truncates toward zero.'),
772:('calculate','带括号四则计算器','Parenthesized Calculator','计算含圆括号的四则表达式，括号优先，乘除先于加减，除法向零截断。','Evaluate arithmetic with parentheses, multiplication/division before addition/subtraction, and division truncated toward zero.'),
726:('countOfAtoms','化学式原子计数','Count Atoms','元素名由一个大写字母后接小写字母组成，元素或括号组后数字表示倍数，省略表示1。按名称字典序输出总计数，计数1省略。','Element names start uppercase and continue lowercase. A number after an element or parenthesized group multiplies it; absence means one. Output names in lexical order followed by totals, omitting a total of one.'),
496:('nextGreaterElement','下一个更大值','Next Greater Value','对nums1每个值，在nums2中找到其位置右侧第一个严格更大值；不存在返回-1，按nums1顺序输出。','For each value in nums1, find the first strictly greater value to its right in nums2, or -1. Preserve nums1 order.'),
503:('nextGreaterElements','循环数组下一个更大值','Circular Next Greater Values','数组视为循环，对每个位置向右寻找第一个严格更大值，没有则为-1。','Treat the array as circular. For each position return the first strictly greater value encountered to the right, or -1.'),
84:('largestRectangleArea','柱状图最大矩形','Largest Histogram Rectangle','柱子宽均为1，高度由数组给出，求完全位于柱状图内部的最大矩形面积。','All bars have width one and the supplied heights. Find the largest rectangle contained in the histogram.'),
85:('maximalRectangle','全一最大矩形','Largest All-One Rectangle','在二进制矩阵中选取连续行和连续列构成全为1的矩形，求最大面积。','Choose consecutive rows and columns forming an all-one rectangle in a binary matrix. Return its maximum area.'),
907:('sumSubarrayMins','子数组最小值之和','Sum of Subarray Minimums','求每个非空连续子数组的最小值之和，结果模1000000007。','Sum the minimum of every nonempty contiguous subarray, modulo 1000000007.'),
2104:('subArrayRanges','子数组极差之和','Sum of Subarray Ranges','对每个非空连续子数组计算最大值减最小值，再求总和。','Sum maximum minus minimum over all nonempty contiguous subarrays.'),
456:('find132pattern','132模式','Find a 132 Pattern','判断是否存在i<j<k且nums[i]<nums[k]<nums[j]，存在输出1，否则0。','Return 1 if indices i<j<k satisfy nums[i]<nums[k]<nums[j], otherwise 0.'),
962:('maxWidthRamp','最宽坡','Maximum Width Ramp','在i<j且nums[i]≤nums[j]的下标对中最大化j-i；没有合法对时返回0。','Maximize j-i over i<j with nums[i]≤nums[j]. Return 0 if no pair exists.'),
402:('removeKdigits','删数字得到最小数','Remove Digits for the Smallest Number','从数字串中恰好删除k位，保持剩余顺序，使数值最小。输出去掉前导零的结果，空串视为0。','Delete exactly k digits while preserving order to minimize the number. Strip leading zeros and represent an empty result as 0.'),
316:('removeDuplicateLetters','去重的最小字典序子序列','Smallest Distinct-Letter Subsequence','从字符串中删除部分字符，使每种出现过的字母恰好保留一次，并令结果字典序最小。','Delete characters so every distinct input letter appears exactly once, minimizing the remaining subsequence lexicographically.'),
735:('asteroidCollision','小行星碰撞','Asteroid Collisions','正数向右、负数向左移动，绝对值是大小。相向相遇时小者消失，同大小都消失；输出最终按位置排列的幸存者。','Positive asteroids move right and negative ones left; magnitude is size. On collision the smaller disappears, or both disappear if equal. Output survivors in positional order.'),
946:('validateStackSequences','验证栈序列','Validate Stack Sequences','元素必须按pushed顺序入栈，可穿插弹出。判断能否恰好按popped顺序弹完，能输出1，否则0。','Push elements in pushed order with arbitrary interleaved pops. Return 1 if popped can be the complete pop order, otherwise 0.'),
921:('minAddToMakeValid','补成合法括号串','Minimum Parenthesis Additions','可在任意位置插入左右括号，求使整串括号合法的最少插入次数。','Insert opening or closing parentheses anywhere to make the whole string balanced with the fewest insertions.'),
1190:('reverseParentheses','括号内逐层反转','Reverse Parenthesized Substrings','从最内层开始反转每对括号中的字符串，最终移除所有括号并输出结果。','Reverse the contents of each parenthesis pair from the inside out, then remove all parentheses.'),
215:('findKthLargest','数组第K大','Kth Largest Array Element','排序后按从大到小取第k项，重复值分别占位置。','Return the kth element in descending sorted order, counting duplicates separately.'),
1834:('getOrder','单线程任务次序','Single-Threaded Task Order','单线程空闲时从已到达任务中选择耗时最短者，同耗时选原下标最小者；没有可用任务则等待。任务不可中断，输出执行下标次序。','Whenever idle, choose the available task with shortest duration, breaking ties by original index. Wait when none is available. Tasks are nonpreemptive; output execution indices.'),
2402:('mostBooked','最常用会议室','Most-Used Meeting Room','按原开始时间处理会议，优先使用最小编号空房；无空房则延迟至最早房间空闲，保持时长，时间并列选最小编号。返回使用次数最多的房间编号，并列取最小。','Process meetings by original start time. Use the lowest free room, or delay to the earliest release while preserving duration and breaking release ties by room index. Return the most-used room, choosing the smallest on ties.'),
239:('maxSlidingWindow','滑动窗口最大值','Sliding Window Maximums','窗口宽k，从左向右每次移动一位，按顺序输出每个窗口的最大值。','Slide a window of width k one position at a time and output each maximum in order.'),
862:('shortestSubarray','含负数的最短达标子数组','Shortest Subarray Reaching a Target','求元素和至少k的最短非空连续子数组长度，元素可为负数；不存在返回-1。','Find the shortest nonempty contiguous subarray with sum at least k, allowing negative elements. Return -1 if none exists.'),
134:('canCompleteCircuit','环形加油站','Circular Gas Stations','从空油箱出发，到站i先获得gas[i]，再花cost[i]到下一站。求能绕一圈的唯一起点下标，无解返回-1。','Start with an empty tank, gain gas[i] at station i, then pay cost[i] to move onward. Return the unique feasible starting index for a full loop, or -1.'),
135:('candy','相邻评分分糖','Candy Allocation','每人至少一颗糖，相邻两人中评分高者糖必须更多。求最少糖总数。','Give everyone at least one candy, with each higher-rated adjacent child receiving more than their neighbor. Minimize total candies.'),
1029:('twoCitySchedCost','两城调度','Two-City Scheduling','每人去A、B有不同费用，要求恰好一半去每座城市，求最小总费用。','Each person has costs for cities A and B. Send exactly half to each city at minimum total cost.'),
1338:('minSetSize','删去一半数组','Remove Half the Array','选取若干不同数值并删除它们的全部出现，至少删除数组一半元素，求最少选几种数。','Choose distinct values and remove every occurrence of them. Remove at least half the array using the fewest chosen values.'),
621:('leastInterval','带冷却任务调度','Task Scheduling with Cooldown','每项任务耗时1，相同字母任务之间至少间隔n个时间单位，可任意重排且允许空闲。求最短完成时间。','Each task takes one unit. Equal letters must be separated by at least n time units. Reorder tasks and insert idle units to minimize completion time.'),
881:('numRescueBoats','救生船最少数量','Minimum Rescue Boats','每条船最多两人且总重不超过limit，求运走所有人的最少船数。','Each boat carries at most two people with total weight at most limit. Minimize boats needed for everyone.'),
948:('bagOfTokensScore','令牌换分','Token Trading Score','初始分数0；每枚令牌最多用一次：支付其数值的能量得1分，或有至少1分时支付1分换其能量。求任意时刻可达到的最高分。','Start with score zero. Use each token at most once: spend its energy cost to gain one point, or spend one point to gain its energy. Maximize the score reached at any time.'),
945:('minIncrementForUnique','递增至互异','Minimum Increments for Uniqueness','每次可把任一元素加1，求使所有值不同的最少操作次数。','Increment any element by one per operation. Minimize operations needed to make all values distinct.')}
INPUT={
227:('一行表达式，长度1–300000，含非负整数、+-*/和空格；每个整数及所有中间值在32位有符号范围，保证合法且不除零。','One expression, length 1–300000, using nonnegative integers, +-*/ and spaces; literals and all intermediate results fit signed 32-bit integers. Valid, with no division by zero.'),
772:('一行合法表达式，长度1–10000，由非负整数、+-*/和圆括号组成，无空格；所有中间值在32位有符号范围，不除零。','One valid expression of length 1–10000 using nonnegative integers, +-*/ and parentheses, without spaces. All intermediate results fit signed 32-bit integers; no division by zero.'),
726:('一行合法化学式，长度1–1000，仅含英文字母、数字和圆括号；显式倍数必须大于1，输出中每种原子总数≤2147483647。','One valid formula of length 1–1000, containing English letters, digits and parentheses. Explicit counts exceed one; each final atom count is at most 2147483647.'),
496:('第一行m n，第二行nums1，第三行nums2；1≤m≤n≤1000，值0–10000，两数组各自无重复且nums1为nums2的子集。','First line m n, then nums1 and nums2 on separate lines. 1≤m≤n≤1000, values 0–10000, each array distinct, nums1 a subset of nums2.'),
503:('第一行n，第二行n个整数；1≤n≤10000，值[-1000000000,1000000000]。','First line n, second line n integers; 1≤n≤10000, values in [-1000000000,1000000000].'),
84:('第一行n，第二行n个高度；1≤n≤100000，高度0–10000。','First line n, second line n heights; 1≤n≤100000, heights 0–10000.'),
85:('第一行m n，接着m行各n个连续的0或1字符；1≤m,n≤200。','First line m n, then m rows of n consecutive 0/1 characters; 1≤m,n≤200.'),
907:('第一行n，第二行n个整数；1≤n≤30000，值1–30000。','First line n, second line n integers; 1≤n≤30000, values 1–30000.'),
2104:('第一行n，第二行n个整数；1≤n≤1000，值[-1000000000,1000000000]。','First line n, second line n integers; 1≤n≤1000, values in [-1000000000,1000000000].'),
456:('第一行n，第二行n个整数；1≤n≤200000，值[-1000000000,1000000000]。','First line n, second line n integers; 1≤n≤200000, values in [-1000000000,1000000000].'),
962:('第一行n，第二行n个整数；2≤n≤50000，值0–50000。','First line n, second line n integers; 2≤n≤50000, values 0–50000.'),
402:('第一行数字串num，第二行k；1≤k≤串长≤100000，除单独的0外输入无前导零。','First line digit string num, second line k; 1≤k≤length≤100000; no leading zero except the single string 0.'),
316:('一行小写英文字母串，长度1–10000。','One lowercase English string of length 1–10000.'),
735:('第一行n，第二行n个非零整数；2≤n≤10000，值[-1000,1000]。','First line n, second line n nonzero integers; 2≤n≤10000, values in [-1000,1000].'),
946:('第一行m n且m=n，第二行pushed，第三行popped；1≤n≤1000，值0–1000，pushed无重复，popped是其排列。','First line m n with m=n, then pushed and popped. 1≤n≤1000, values 0–1000; pushed is distinct and popped is its permutation.'),
921:('一行仅含左右圆括号的串，长度1–1000。','One string of opening/closing parentheses, length 1–1000.'),
1190:('一行含小写字母与圆括号的串，长度1–2000；括号保证平衡。','One string of lowercase letters and balanced parentheses, length 1–2000.'),
215:('第一行n，第二行n个整数，第三行k；1≤k≤n≤100000，值[-10000,10000]。','First line n, second line n integers, third line k; 1≤k≤n≤100000, values in [-10000,10000].'),
1834:('第一行n，接着n行enqueueTime processingTime，按输入顺序编号0至n-1；1≤n≤100000，两个时间均1–1000000000。','First line n, then n enqueueTime-processingTime pairs, indexed 0 through n-1 in input order. 1≤n≤100000, both times 1–1000000000.'),
2402:('第一行n m，接着m行start end；1≤n≤100，1≤m≤100000，0≤start<end≤500000，开始时间互不相同。','First line room count n and meeting count m, then m start-end pairs. 1≤n≤100, 1≤m≤100000, 0≤start<end≤500000; starts are distinct.'),
239:('第一行n，第二行n个整数，第三行k；1≤k≤n≤100000，值[-10000,10000]。','First line n, second line n integers, third line k; 1≤k≤n≤100000, values in [-10000,10000].'),
862:('第一行n，第二行n个整数，第三行k；1≤n≤100000，值[-100000,100000]，1≤k≤1000000000。','First line n, second line n integers, third line k; 1≤n≤100000, values in [-100000,100000], 1≤k≤1000000000.'),
134:('第一行m n且m=n，第二行gas，第三行cost；1≤n≤100000，值0–10000；保证最多一个可行起点。','First line m n with m=n, then gas and cost. 1≤n≤100000, values 0–10000; at most one valid starting index is guaranteed.'),
135:('第一行n，第二行n个评分；1≤n≤20000，评分0–20000。','First line n, second line n ratings; 1≤n≤20000, ratings 0–20000.'),
1029:('第一行偶数m，接着m行aCost bCost；2≤m≤100，两项费用均1–1000。','First line even count m, then m aCost-bCost pairs; 2≤m≤100, costs 1–1000.'),
1338:('第一行偶数n，第二行n个整数；2≤n≤100000，值1–100000。','First line even n, second line n integers; 2≤n≤100000, values 1–100000.'),
621:('第一行连续大写字母组成的任务串，长度1–10000；第二行冷却时间n，0≤n≤100。','First line uppercase task letters, length 1–10000; second line cooldown n, 0≤n≤100.'),
881:('第一行n，第二行n个重量，第三行limit；1≤n≤50000，1≤重量≤limit≤30000。','First line n, second line n weights, third line limit; 1≤n≤50000, 1≤weight≤limit≤30000.'),
948:('第一行n，第二行n个令牌数值（n=0时空行），第三行power；0≤n≤1000，令牌数值和power均0–9999。','First line n, second line n token values (empty when n=0), third line power; 0≤n≤1000, token values and power 0–9999.'),
945:('第一行n，第二行n个整数；1≤n≤100000，值0–100000。保证最少操作次数不超过2147483647。','First line n, second line n integers; 1≤n≤100000, values 0–100000. The minimum number of operations is guaranteed to be at most 2147483647.')}
MISTAKES={227:('忽略乘除优先级','除法四舍五入'),772:('括号内忽略乘除优先级','除法四舍五入'),726:('遗漏括号后的倍数','错误输出数量1'),496:('取右侧最大而非首个更大','误找左侧更大值'),503:('不考虑循环回绕','把相等元素当作更大'),84:('矩形宽度多算一列','只考虑单根柱子'),85:('矩形宽度多算一列','遇零不清空高度'),907:('只统计长度一子数组','遗漏取模'),2104:('只计算全数组极差','只计算相邻差'),456:('只寻找连续三元组','允许模式端点相等'),962:('把非严格条件写成严格','只考虑第零个位置起坡'),402:('维护错误方向单调栈','未用完预算时忘记尾删'),316:('字母直接排序丢失顺序','未确认以后可补回就弹栈'),735:('背向运动也发生碰撞','相同大小只删除一个'),946:('只接受正序或倒序弹出','每次入栈后最多弹一次'),921:('只比较左右括号总数','漏计剩余左括号'),1190:('简单删除括号再整体反转','不反转括号内容'),215:('把排名误当去重排名','返回第k小'),1834:('优先原下标而非耗时','相同耗时取较大下标'),2402:('释放条件错误使用严格小于','最终并列取较大房间号'),239:('窗口最小值代替最大值','取队尾而非队首'),862:('含负数仍使用普通滑窗','把至少写成严格大于'),134:('选择单站净油量最大者','遗漏总油量不足判定'),135:('只满足左侧评分约束','相等评分也要求糖递增'),1029:('按去A绝对费用排序','忽略两城人数限制'),1338:('优先删除频次最少者','要求严格超过一半'),621:('公式未和任务总数取最大','忽略最高频任务并列'),881:('船重限制使用严格小于','优先配最轻两人'),948:('永不换回能量','只返回最后分数而非峰值'),945:('未先排序即贪心递增','允许相邻最终值相等')}
EDGES[2402].append([2,[[5,10],[6,13],[13,15],[3,4],[4,6],[0,3],[8,10]]])
EDGES[621].append([list('BBCBBB'),0])
EDGES[881].append([[1,1,2,2,3],3])
PRESSURE[134]=[([[0]*99999+[10000],[0]*89999+[1]*10000+[0]],99999)]
PRESSURE[621]=[([list('A'*10000),100],9999*101+1)]
PREFIX='import sys,itertools,re,heapq\nfrom collections import Counter,deque\nMOD=1000000007\n'+inspect.getsource(div)+inspect.getsource(calculator)+inspect.getsource(formula_counts)+inspect.getsource(formula_text)+inspect.getsource(variant)
PROBLEMS={}
for pid in IDS:
 method,zh,en,dzh,den=META[pid];izh,ien=INPUT[pid];kind='integer-array' if pid in ARRAY_RESULTS else 'string' if pid in STRING_RESULTS else 'integer'
 outzh='先输出元素个数，再输出按要求顺序排列的整数，用空白分隔。' if kind=='integer-array' else '输出结果字符串并换行。' if kind=='string' else '输出一个整数并换行。'
 outen='Print the element count, then integers in the required order separated by whitespace.' if kind=='integer-array' else 'Print the result string followed by a newline.' if kind=='string' else 'Print one integer followed by a newline.'
 emit="value=variant(PID,args,BUG)\n"+("print(len(value)); print(*value)" if kind=='integer-array' else 'print(value)')
 PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dzh,descriptionEn=den,inputZh=izh,inputEn=ien,outputZh=outzh,outputEn=outen,difficulty='困难' if pid in (772,726,84,85,2402,239,862,135) else '中等',edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r,p=pid:random_args(p,r),oracle=lambda a,p=pid:oracle(p,a),encode=lambda a,p=pid:encode(p,a),parse=parse(pid),validate=lambda a,p=pid:validate(p,a),resultKind=kind,outputLimit=1024 if pid in (1834,239) else 128,mutants=[dict(name=name,source=PREFIX+'\n'+parse(pid)+'\n'+emit.replace('PID',str(pid)).replace('BUG',str(bug))+'\n') for bug,name in enumerate(MISTAKES[pid],1)])
