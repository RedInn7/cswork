"""Original selected-window fixtures. Downloaded references are never executed here."""
import math
import inspect
from collections import Counter, deque

IDS=[42,567,1052,159,340,904,424,1493,1208,713,76,30,395,992,1658,1838,1234,1358,1438,2024,2516,2302,2537,560,525,523,974,930,1248,1423]
ARRAY_ONLY={42,904,1493,525}
ARRAY_K={713,992,1658,1838,1438,2302,2537,560,523,974,930,1248,1423}
STRING_ONLY={159,1234,1358}
STRING_K={340,424,395,2024,2516}

def windows(a):
 for i in range(len(a)):
  for j in range(i+1,len(a)+1):yield a[i:j]

def minimum_window(s,t):
 need=Counter(t);missing=len(t);left=0;best_length=len(s)+1;best_left=0;ties=0
 for right,c in enumerate(s):
  if need[c]>0:missing-=1
  need[c]-=1
  while missing==0:
   width=right-left+1
   if width<best_length:best_length=width;best_left=left;ties=1
   elif width==best_length:ties+=1
   old=s[left];need[old]+=1;left+=1
   if need[old]>0:missing+=1
 return (s[best_left:best_left+best_length] if best_length<=len(s) else ''),ties

def oracle(pid,a):
 x=a[0];n=len(x)
 if pid==42:return sum(max(0,min(max(x[:i+1]),max(x[i:]))-h) for i,h in enumerate(x))
 if pid==567:
  s,t=a;return int(any(sorted(t[i:i+len(s)])==sorted(s) for i in range(len(t)-len(s)+1)))
 if pid==1052:
  customers,grumpy,minutes=a
  return max(sum(v for i,v in enumerate(customers) if not grumpy[i] or start<=i<start+minutes) for start in range(n-minutes+1))
 if pid in (159,340,904):return max([0]+[len(w) for w in windows(x) if len(set(w))<=(a[1] if pid==340 else 2)])
 if pid in (424,2024):return max([0]+[len(w) for w in windows(x) if len(w)-max(Counter(w).values())<=a[1]])
 if pid==1493:
  best=0
  for i in range(n):
   run=0
   for v in x[:i]+x[i+1:]:run=run+1 if v else 0;best=max(best,run)
  return best
 if pid==1208:
  s,t,k=a;return max([0]+[j-i for i in range(n) for j in range(i+1,n+1) if sum(abs(ord(s[p])-ord(t[p])) for p in range(i,j))<=k])
 if pid==713:return sum(math.prod(w)<a[1] for w in windows(x))
 if pid==76:
  need=Counter(a[1]);valid=[w for w in windows(x) if not need-Counter(w)]
  return min(valid,key=len) if valid else ''
 if pid==30:
  s,words=a;size=len(words[0]);width=size*len(words);need=sorted(words)
  return [i for i in range(n-width+1) if sorted(s[j:j+size] for j in range(i,i+width,size))==need]
 if pid==395:return max([0]+[len(w) for w in windows(x) if min(Counter(w).values())>=a[1]])
 if pid==992:return sum(len(set(w))==a[1] for w in windows(x))
 if pid in (1658,2516):
  valid=[]
  for left in range(n+1):
   for right in range(n-left+1):
    chosen=x[:left]+(x[n-right:] if right else x[:0])
    yes=sum(chosen)==a[1] if pid==1658 else all(chosen.count(c)>=a[1] for c in 'abc')
    if yes:valid.append(left+right)
  return min(valid,default=-1)
 if pid==1838:
  # Enumerate which existing entries become equal, independent of sorted windows.
  best=1
  for mask in range(1,1<<n):
   chosen=[v for i,v in enumerate(x) if mask>>i&1]
   if max(chosen)*len(chosen)-sum(chosen)<=a[1]:best=max(best,len(chosen))
  return best
 if pid==1234:
  limit=n//4
  return min(j-i for i in range(n+1) for j in range(i,n+1) if all((x[:i]+x[j:]).count(c)<=limit for c in 'QWER'))
 if pid==1358:return sum(set(w)==set('abc') for w in windows(x))
 if pid==1438:return max(len(w) for w in windows(x) if max(w)-min(w)<=a[1])
 if pid==2302:return sum(sum(w)*len(w)<a[1] for w in windows(x))
 if pid==2537:return sum(sum(w[i]==w[j] for i in range(len(w)) for j in range(i+1,len(w)))>=a[1] for w in windows(x))
 if pid in (560,930):return sum(sum(w)==a[1] for w in windows(x))
 if pid==525:return max([0]+[len(w) for w in windows(x) if w.count(0)==w.count(1)])
 if pid==523:return int(any(len(w)>=2 and sum(w)%a[1]==0 for w in windows(x)))
 if pid==974:return sum(sum(w)%a[1]==0 for w in windows(x))
 if pid==1248:return sum(sum(v%2 for v in w)==a[1] for w in windows(x))
 if pid==1423:
  k=a[1];return max(sum(x[:left])+sum(x[n-(k-left):]) for left in range(k+1))
 raise AssertionError(pid)

def fast(pid,a):
 """Independent optimized implementation for local differential/pressure checks."""
 x=a[0];n=len(x)
 if pid==42:
  left,right=0,n-1;lm=rm=result=0
  while left<=right:
   if lm<=rm:lm=max(lm,x[left]);result+=lm-x[left];left+=1
   else:rm=max(rm,x[right]);result+=rm-x[right];right-=1
  return result
 if pid==567:
  s,t=a;m=len(s);need=Counter(s);current=Counter()
  for i,c in enumerate(t):
   current[c]+=1
   if i>=m:
    old=t[i-m];current[old]-=1
    if not current[old]:del current[old]
   if i+1>=m and current==need:return 1
  return 0
 if pid==1052:
  customers,grumpy,k=a;base=sum(v for v,g in zip(customers,grumpy) if not g);gain=sum(v*g for v,g in zip(customers[:k],grumpy[:k]));best=gain
  for i in range(k,n):gain+=customers[i]*grumpy[i]-customers[i-k]*grumpy[i-k];best=max(best,gain)
  return base+best
 if pid in (159,340,904,424,2024,395,992):
  if pid==395:
   best=0
   for wanted in range(1,len(set(x))+1):
    counts=Counter();left=0;valid=0
    for right,c in enumerate(x):
     counts[c]+=1
     if counts[c]==a[1]:valid+=1
     while len(counts)>wanted:
      old=x[left]
      if counts[old]==a[1]:valid-=1
      counts[old]-=1;left+=1
      if not counts[old]:del counts[old]
     if valid==wanted:best=max(best,right-left+1)
   return best
  def at_most(k,count_windows=False):
   if k<0:return 0
   left=0;counts=Counter();best=0
   for right,c in enumerate(x):
    counts[c]+=1
    while (right-left+1-max(counts.values(),default=0)>k if pid in (424,2024) else len(counts)>k):
     old=x[left];counts[old]-=1;left+=1
     if not counts[old]:del counts[old]
    best=best+right-left+1 if count_windows else max(best,right-left+1)
   return best
  if pid==992:return at_most(a[1],True)-at_most(a[1]-1,True)
  return at_most(a[1] if pid in (340,424,2024) else 2)
 if pid==1493:
  left=zeros=answer=0
  for right,v in enumerate(x):
   zeros+=v==0
   while zeros>1:zeros-=x[left]==0;left+=1
   answer=max(answer,right-left)
  return answer
 if pid==1208:
  s,t,k=a;left=cost=answer=0
  for right,(u,v) in enumerate(zip(s,t)):
   cost+=abs(ord(u)-ord(v))
   while cost>k:cost-=abs(ord(s[left])-ord(t[left]));left+=1
   answer=max(answer,right-left+1)
  return answer
 if pid==713:
  if a[1]<=1:return 0
  left=answer=0;product=1
  for right,v in enumerate(x):
   product*=v
   while product>=a[1]:product//=x[left];left+=1
   answer+=right-left+1
  return answer
 if pid==76:return minimum_window(*a)[0]
 if pid==30:
  s,words=a;size=len(words[0]);need=Counter(words);answer=[]
  for offset in range(size):
   left=offset;current=Counter();count=0
   for right in range(offset,n-size+1,size):
    word=s[right:right+size]
    if word not in need:current.clear();count=0;left=right+size;continue
    current[word]+=1;count+=1
    while current[word]>need[word]:old=s[left:left+size];current[old]-=1;left+=size;count-=1
    if count==len(words):answer.append(left)
  return sorted(answer)
 if pid==1658:
  target=sum(x)-a[1]
  if target<0:return -1
  left=total=0;best=0 if target==0 else -1
  for right,v in enumerate(x):
   total+=v
   while total>target and left<=right:total-=x[left];left+=1
   if total==target:best=max(best,right-left+1)
  return n-best if best>=0 else -1
 if pid==1838:
  values=sorted(x);left=total=best=0
  for right,v in enumerate(values):
   total+=v
   while v*(right-left+1)-total>a[1]:total-=values[left];left+=1
   best=max(best,right-left+1)
  return best
 if pid in (1234,2516):
  outside=Counter(x);left=0;answer=n
  if pid==2516 and any(outside[c]<a[1] for c in 'abc'):return -1
  valid=lambda: all(outside[c]<=n//4 for c in 'QWER') if pid==1234 else all(outside[c]>=a[1] for c in 'abc')
  if pid==1234 and valid():return 0
  if pid==2516:
   best=0
   for right,c in enumerate(x):
    outside[c]-=1
    while not valid():outside[x[left]]+=1;left+=1
    best=max(best,right-left+1)
   return n-best
  for right,c in enumerate(x):
   outside[c]-=1
   while valid() and left<=right:answer=min(answer,right-left+1);outside[x[left]]+=1;left+=1
  return answer
 if pid==1358:
  last={c:-1 for c in 'abc'};answer=0
  for i,c in enumerate(x):last[c]=i;answer+=min(last.values())+1
  return answer
 if pid==1438:
  low=deque();high=deque();left=best=0
  for right,v in enumerate(x):
   while low and x[low[-1]]>v:low.pop()
   while high and x[high[-1]]<v:high.pop()
   low.append(right);high.append(right)
   while x[high[0]]-x[low[0]]>a[1]:
    if low[0]==left:low.popleft()
    if high[0]==left:high.popleft()
    left+=1
   best=max(best,right-left+1)
  return best
 if pid==2302:
  left=total=answer=0
  for right,v in enumerate(x):
   total+=v
   while total*(right-left+1)>=a[1] and left<=right:total-=x[left];left+=1
   answer+=right-left+1
  return answer
 if pid==2537:
  counts=Counter();left=pairs=answer=0
  for v in x:
   pairs+=counts[v];counts[v]+=1
   while pairs>=a[1]:old=x[left];counts[old]-=1;pairs-=counts[old];left+=1
   answer+=left
  return answer
 if pid in (560,930,974,1248,525,523):
  prefix=answer=0;counts=Counter({0:1});first={0:-1}
  for i,v in enumerate(x):
   prefix+=(v%2 if pid==1248 else (1 if v else -1) if pid==525 else v)
   if pid in (974,523):prefix%=a[1]
   if pid==525:
    if prefix in first:answer=max(answer,i-first[prefix])
    else:first[prefix]=i
   elif pid==523:
    if prefix in first:
     if i-first[prefix]>=2:return 1
    else:first[prefix]=i
   else:answer+=counts[prefix-(0 if pid==974 else a[1])];counts[prefix]+=1
  return answer
 if pid==1423:
  width=n-a[1];total=sum(x[:width]);smallest=total
  for i in range(width,n):total+=x[i]-x[i-width];smallest=min(smallest,total)
  return sum(x)-smallest
 raise AssertionError(pid)

def encode(pid,a):
 if pid in ARRAY_ONLY:return str(len(a[0]))+'\n'+' '.join(map(str,a[0]))+'\n'
 if pid in ARRAY_K:return f'{len(a[0])} {a[1]}\n'+' '.join(map(str,a[0]))+'\n'
 if pid==1052:return f'{len(a[0])} {a[2]}\n'+' '.join(map(str,a[0]))+'\n'+' '.join(map(str,a[1]))+'\n'
 if pid==30:return a[0]+'\n'+str(len(a[1]))+'\n'+'\n'.join(a[1])+'\n'
 return '\n'.join(map(str,a))+'\n'

def parse(pid):
 if pid in ARRAY_ONLY:return 'v=list(map(int,sys.stdin.read().split()));args=[v[1:]]'
 if pid in ARRAY_K:return 'v=list(map(int,sys.stdin.read().split()));args=[v[2:],v[1]]'
 if pid==1052:return 'v=list(map(int,sys.stdin.read().split()));n=v[0];args=[v[2:n+2],v[n+2:],v[1]]'
 if pid==30:return 'lines=sys.stdin.read().splitlines();args=[lines[0],lines[2:]]'
 if pid in STRING_K:return 'lines=sys.stdin.read().splitlines();args=[lines[0],int(lines[1])]'
 if pid==1208:return 'lines=sys.stdin.read().splitlines();args=[lines[0],lines[1],int(lines[2])]'
 return 'args=sys.stdin.read().splitlines()'

def validate(pid,a):
 def integer(v,lo,hi):assert type(v)is int and lo<=v<=hi
 def array(v,lo,hi,maximum):
  assert type(v)is list and 1<=len(v)<=maximum
  for item in v:integer(item,lo,hi)
 def string(v,alphabet,maximum,minimum=1):
  assert type(v)is str and minimum<=len(v)<=maximum and not any(c in v for c in '\r\n\0\v\f\x1c\x1d\x1e\x85\u2028\u2029')
  if alphabet:assert set(v)<=set(alphabet)
 lower='abcdefghijklmnopqrstuvwxyz';upper=lower.upper()
 if pid in ARRAY_ONLY|ARRAY_K:
  assert len(a)==(1 if pid in ARRAY_ONLY else 2);n=len(a[0])
  bounds={42:(0,100000,20000),904:(0,n-1,100000),1493:(0,1,100000),525:(0,1,100000),713:(1,1000,30000),992:(1,n,20000),1658:(1,10000,100000),1838:(1,100000,100000),1438:(1,10**9,100000),2302:(1,100000,100000),2537:(1,10**9,100000),560:(-1000,1000,20000),523:(0,10**9,100000),974:(-10000,10000,30000),930:(0,1,30000),1248:(1,100000,50000),1423:(1,10000,100000)}
  array(a[0],*bounds[pid])
  if pid in ARRAY_K:
   limits={713:(0,10**6),992:(1,n),1658:(1,10**9),1838:(1,100000),1438:(0,10**9),2302:(1,10**15),2537:(1,10**9),560:(-10**7,10**7),523:(1,2**31-1),974:(2,10000),930:(0,n),1248:(1,n),1423:(1,n)}
   integer(a[1],*limits[pid])
  if pid==523:assert sum(a[0])<=2**31-1
  return
 if pid==1052:
  assert len(a)==3;array(a[0],0,1000,20000);array(a[1],0,1,20000);assert len(a[0])==len(a[1]);integer(a[2],1,len(a[0]));return
 if pid==30:
  assert len(a)==2;string(a[0],lower,10000);assert type(a[1])is list and 1<=len(a[1])<=5000
  for word in a[1]:string(word,lower,30)
  assert len({len(w) for w in a[1]})==1;return
 if pid in (567,76):
  assert len(a)==2
  for s in a:string(s,lower if pid==567 else lower+upper,10000 if pid==567 else 100000)
  if pid==76:assert minimum_window(*a)[1]<=1,'fixture must have unique shortest window (or none)'
  return
 if pid==1208:
  assert len(a)==3
  for s in a[:2]:string(s,lower,100000)
  assert len(a[0])==len(a[1]);integer(a[2],0,10**6);return
 assert len(a)==(2 if pid in STRING_K else 1)
 bounds={159:(lower+upper,100000,1),340:(None,50000,1),424:(upper,100000,1),395:(lower,10000,1),1234:('QWER',100000,4),1358:('abc',50000,3),2024:('TF',50000,1),2516:('abc',100000,1)}
 string(a[0],*bounds[pid])
 if pid==1234:assert len(a[0])%4==0
 if pid in STRING_K:
  limits={340:(0,50),424:(0,len(a[0])),395:(1,100000),2024:(1,len(a[0])),2516:(0,len(a[0]))};integer(a[1],*limits[pid])

def random_args(pid,r):
 n=r.randint(1,8)
 if pid in ARRAY_ONLY|ARRAY_K:
  bounds={42:(0,9),904:(0,n-1),1493:(0,1),525:(0,1),713:(1,8),992:(1,n),1658:(1,8),1838:(1,12),1438:(1,12),2302:(1,8),2537:(1,4),560:(-3,3),523:(0,8),974:(-8,8),930:(0,1),1248:(1,10),1423:(1,10)}
  nums=[r.randint(*bounds[pid]) for _ in range(n)]
  if pid in ARRAY_ONLY:return [nums]
  limits={713:(0,30),992:(1,n),1658:(1,sum(nums)+5),1838:(1,15),1438:(0,10),2302:(1,100),2537:(1,12),560:(-10,10),523:(1,12),974:(2,10),930:(0,n),1248:(1,n),1423:(1,n)}
  return [nums,r.randint(*limits[pid])]
 if pid==1052:return [[r.randint(0,9) for _ in range(n)],[r.randrange(2) for _ in range(n)],r.randint(1,n)]
 if pid in (567,76):
  while True:
   a=[''.join(r.choice('abC' if pid==76 else 'abc') for _ in range(r.randint(1,8))) for _ in range(2)]
   if pid!=76 or minimum_window(*a)[1]<=1:return a
 if pid==30:
  size=r.randint(1,3);return [''.join(r.choice('ab') for _ in range(r.randint(1,12))),[''.join(r.choice('ab') for _ in range(size)) for _ in range(r.randint(1,4))]]
 if pid==1208:return [''.join(r.choice('abcd') for _ in range(n)),''.join(r.choice('abcd') for _ in range(n)),r.randint(0,10)]
 alphabet={159:'abAB',340:'aA !',424:'ABC',395:'abc',1234:'QWER',1358:'abc',2024:'TF',2516:'abc'}[pid]
 if pid==1234:n=r.choice([4,8])
 if pid==1358:n=r.randint(3,8)
 s=''.join(r.choice(alphabet) for _ in range(n))
 if pid in STRING_ONLY:return [s]
 limits={340:(0,5),424:(0,n),395:(1,n+2),2024:(1,n),2516:(0,n)}
 return [s,r.randint(*limits[pid])]

EDGE={42:[[[0,1,0,2,1,0,1,3,2,1,2,1]],[[0]],[[5,0,5]]],567:[['ab','eidbaooo'],['ab','eidboaoo'],['abc','ab']],1052:[[[1,0,1,2,1,1,7,5],[0,1,0,1,0,1,0,1],3],[[9],[1],1],[[1,8],[0,1],1]],159:[['eceba'],['aa'],['aAbB']],340:[['eceba',2],['a',0],['a a',1]],904:[[[1,2,1]],[[0,1,2,2]],[[0]]],424:[['AABABBA',1],['ABAB',2],['A',0]],1493:[[[1,1,0,1]],[[1,1,1]],[[0]]],1208:[['abcd','bcdf',3],['a','z',0],['abc','abc',0]],713:[[[10,5,2,6],100],[[1,1],1],[[1,2],0]],76:[['ADOBECODEBANC','ABC'],['a','a'],['a','aa'],['aab','ab']],30:[['barfoothefoobarman',['foo','bar']],['wordgoodgoodgoodbestword',['word','good','best','good']],['aaaaaa',['aa','aa']]],395:[['aaabb',3],['ababbc',2],['abc',4]],992:[[[1,2,1,2,3],2],[[1],1],[[1,1,2],1]],1658:[[[1,1,4,2,3],5],[[5,6,7,8,9],4],[[1,1],2]],1838:[[[1,2,4],5],[[3,9,6],2],[[1],1]],1234:[['QWER'],['QQWE'],['QQQQ']],1358:[['abcabc'],['aaacb'],['aaa']],1438:[[[8,2,4,7],4],[[1],0],[[1,5,1],0]],2024:[['TTFF',2],['TFFT',1],['T',1]],2516:[['aabaaaacaabc',2],['a',1],['abc',0]],2302:[[[2,1,4,3,5],10],[[1],1],[[1,1],4]],2537:[[[1,1,1,1,1],10],[[1,2,1,2],1],[[1],1]],560:[[[1,1,1],2],[[0,0],0],[[-1,1],0]],525:[[[0,1]],[[0,1,0]],[[1,1]]],523:[[[23,2,4,6,7],6],[[6],6],[[0,0],7]],974:[[[4,5,0,-2,-3,1],5],[[-1,1],2],[[0,0],3]],930:[[[1,0,1,0,1],2],[[0,0],0],[[1],0]],1248:[[[1,1,2,1,1],3],[[2,4,6],1],[[1,2,1],1]],1423:[[[1,2,3,4,5,6,1],3],[[9,1,1,9],2],[[1,2],2]]}

# Closed-form pressure answers, deliberately independent from fast().
# Every nonconstant construction documents its combinatorial interpretation.
PRESSURE={
42:[(([100000]+[0]*19998+[100000],),1999800000),(([100000]*20000,),0)],
567:[(['a'*10000,'a'*10000],1),(['a'*9999+'b','a'*10000],0)],
1052:[([[1000]*20000,[1]*20000,20000],20000000),([[1000]*20000,[0,1]*10000,1],10001000)],
159:[(['aA'*50000],100000),(['abc'*33333+'a'],2)],
340:[([' '*50000,1],50000),(['a'*50000,0],0),(['aA'*25000,50],50000)],
904:[([[0,1]*50000],100000),([[i%3 for i in range(100000)]],2)],
424:[(['A'*100000,0],100000),(['AB'*50000,100000],100000),(['AB'*50000,0],1)],
1493:[([[1]*100000],99999),([[0]*100000],0),([[1]*49999+[0]+[1]*50000],99999)],
1208:[(['a'*100000,'a'*100000,0],100000),(['a'*100000,'z'*100000,1000000],40000)],
713:[([[1]*30000,2],450015000),([[1000]*30000,1000000],30000),([[1]*30000,0],0)],
76:[(['a'*100000,'a'*100000],'a'*100000),(['a'*99999+'b','a'*49999+'b'],'a'*49999+'b'),(['a'*100000,'b'],'')],
30:[(['a'*10000,['a']],list(range(10000))),(['a'*10000,['a'*30]*5000],[]),(['a'*10000,['aa']*5000],[0])],
395:[(['a'*10000,10000],10000),(['a'*10000,100000],0),(['a'*4999+'b'+'a'*5000,5000],5000)],
992:[([[1]*20000,1],200010000),([list(range(1,20001)),20000],1),([[1,2]*10000,2],199990000)],
1658:[([[10000]*100000,10**9],100000),([[10000]*100000,1],-1),([[1]*100000,99999],99999)],
1838:[([[100000]*100000,100000],100000),([[1]*99999+[100000],100000],99999)],
1234:[(['QWER'*25000],0),(['Q'*100000],75000),(['Q'*50000+'W'*50000],50000)],
1358:[(['a'*49998+'bc'],49998),(['a'*50000],0),(['abc'*16666+'ab'],(50000-2)*(50000-1)//2)],
1438:[([[10**9]*100000,0],100000),([[1,10**9]*50000,10**9],100000),([[1,10**9]*50000,0],1)],
2024:[(['TF'*25000,50000],50000),(['TF'*25000,1],3),(['T'*50000,1],50000)],
2516:[(['a'*100000,1],-1),(['a'*33333+'b'*33333+'c'*33334,33333],99999),(['abc'*33333+'a',0],0)],
2302:[([[100000]*100000,10**15],5000050000),([[1]*100000,1],0),([[1]*100000,10000000000],5000049999)],
2537:[([[1]*100000,1],4999950000),([list(range(1,100001)),10**9],0)],
560:[([[0]*20000,0],200010000),([[1000]*20000,10**7],10001),([[-1000]*20000,-10**7],10001)],
525:[([[0,1]*50000],100000),([[0]*100000],0)],
523:[([[0]*100000,2**31-1],1),([[1]+[0]*99999,2**31-1],1),([[10**9,10**9,147483647],2**31-1],1)],
974:[([[0]*30000,10000],450015000),([[-10000]*30000,10000],450015000)],
930:[([[0]*30000,0],450015000),([[1]*30000,30000],1)],
1248:[([[2]*50000,50000],0),([[1]*50000,1],50000),([[1]*50000,50000],1)],
1423:[([[10000]*100000,100000],10**9),([[10000]+[1]*99998+[10000],2],20000)],
}
# Keep args uniformly lists, including the first height-array fixtures.
PRESSURE={pid:[(list(a),v) for a,v in cases] for pid,cases in PRESSURE.items()}

META={
42:('接雨水','Trapping Rain Water','trap','给定每根宽度为1的柱子高度，计算下雨后柱子之间能积存的总水量。','Each bar has width one. Return the total water trapped between the bars after rainfall.'),
567:('字符串的排列','Permutation in String','checkInclusion','判断s2是否包含s1的某个排列作为连续子串，重复字符的数量必须匹配。','Determine whether s2 contains a permutation of s1 as a contiguous substring, including matching character multiplicities.'),
1052:('爱生气的书店老板','Grumpy Bookstore Owner','maxSatisfied','第i分钟有customers[i]位顾客，grumpy[i]=1时这些顾客不满意，否则满意。老板可选择一次连续minutes分钟不生气。返回最多满意顾客数，每位顾客只属于其到店分钟。','At minute i, customers[i] customers arrive and are satisfied exactly when grumpy[i]=0. The owner can suppress grumpiness for one contiguous interval of minutes minutes. Maximize the total satisfied customers.'),
159:('至多两个不同字符的最长子串','Longest Substring with At Most Two Distinct Characters','lengthOfLongestSubstringTwoDistinct','返回字符串中至多包含两种不同字符的最长连续子串长度，大小写视为不同字符。','Return the longest contiguous substring containing at most two distinct characters. Uppercase and lowercase characters are distinct.'),
340:('至多k个不同字符的最长子串','Longest Substring with At Most K Distinct Characters','lengthOfLongestSubstringKDistinct','返回字符串中至多包含k种不同字符的最长连续子串长度。空格也是字符，k为0时答案为0。','Return the longest contiguous substring containing at most k distinct characters. Spaces count as characters; when k=0 the answer is zero.'),
904:('水果成篮','Fruit Into Baskets','totalFruit','从任意位置开始连续向右采摘，每棵树摘一个水果，最多装两种水果，不能跳过中间树。返回最多采摘数量。','Start anywhere and pick one fruit from every consecutive tree moving right. Keep at most two fruit types and do not skip trees. Return the maximum number picked.'),
424:('替换后的最长重复字符','Longest Repeating Character Replacement','characterReplacement','最多替换k个字符为任意大写英文字母，返回可得到的最长相同字符连续子串长度。','Replace at most k characters with any uppercase English letters. Return the longest possible contiguous run of one repeated character.'),
1493:('删除一个元素后的最长全1子数组','Longest Subarray of 1s After Deleting One Element','longestSubarray','必须恰好删除一个数组元素，返回剩余数组中最长全1连续子数组的长度；没有1则为0。','Delete exactly one array entry. Return the longest all-one contiguous subarray in the remaining array, or zero if none exists.'),
1208:('预算内转换相同子串','Get Equal Substrings Within Budget','equalSubstring','把s[i]改为t[i]的费用是两个字符编码差的绝对值。返回可在maxCost预算内转换的最长连续区间长度。','Changing s[i] to t[i] costs the absolute difference of their character codes. Return the longest contiguous interval whose total conversion cost is at most maxCost.'),
713:('乘积小于k的子数组','Subarray Product Less Than K','numSubarrayProductLessThanK','统计元素乘积严格小于k的非空连续子数组数量。','Count nonempty contiguous subarrays whose element product is strictly less than k.'),
76:('最小覆盖子串','Minimum Window Substring','minWindow','返回s中包含t全部字符（含重复次数）的最短连续子串。若不存在返回空串。输入保证存在解时最短窗口唯一，字符大小写敏感。','Return the shortest contiguous substring of s containing all characters of t with their multiplicities. Return an empty string if none exists. Inputs guarantee a unique shortest window when one exists; matching is case-sensitive.'),
30:('串联所有单词的子串','Substring with Concatenation of All Words','findSubstring','words中所有单词长度相同。返回s中能由words的全部单词按某种顺序恰好串联而成的子串起点下标；每个单词出现次数必须完全匹配，允许匹配区间重叠。','All words have the same length. Return the zero-based starts of substrings formed by concatenating every word in any order, matching all multiplicities exactly. Matching intervals may overlap.'),
395:('每个字符至少重复k次的最长子串','Longest Substring with At Least K Repeating Characters','longestSubstring','返回最长连续子串长度，使其中每种出现过的字符均至少出现k次。','Return the longest contiguous substring length such that every character appearing in that substring occurs at least k times.'),
992:('恰好k个不同整数的子数组','Subarrays with K Different Integers','subarraysWithKDistinct','统计恰好包含k种不同整数的非空连续子数组数量。','Count nonempty contiguous subarrays containing exactly k distinct integer values.'),
1658:('把x减到0的最少操作','Minimum Operations to Reduce X to Zero','minOperations','每次移除数组最左或最右元素并从x中减去该值。返回使x恰好变为0的最少操作次数；无法做到则返回-1。','Each operation removes the leftmost or rightmost array entry and subtracts it from x. Return the fewest operations making x exactly zero, or -1 if impossible.'),
1838:('最高频元素的频数','Frequency of the Most Frequent Element','maxFrequency','每次操作可将一个元素加1，最多操作k次。返回操作后某个值能达到的最大出现次数。','An operation increments one array entry by one. With at most k operations, maximize the frequency of any value.'),
1234:('替换子串得到平衡字符串','Replace the Substring for Balanced String','balancedString','字符串只含Q、W、E、R，长度为4的倍数。可选择一个连续子串替换为任意等长字符串，使四种字符各出现n/4次。返回最短替换长度，已平衡时返回0。','The string contains Q,W,E,R and has length divisible by four. Replace one contiguous substring with any equally long string so each character occurs n/4 times. Return the minimum replacement length, or zero if already balanced.'),
1358:('包含三种字符的子串数量','Number of Substrings Containing All Three Characters','numberOfSubstrings','字符串只含a、b、c。统计同时至少包含一个a、一个b和一个c的连续子串数量。','The string contains only a,b,c. Count contiguous substrings containing at least one occurrence of each of the three characters.'),
1438:('极差不超过限制的最长子数组','Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit','longestSubarray','返回非空连续子数组的最大长度，使其中任意两个元素的绝对差都不超过limit。','Return the longest nonempty contiguous subarray in which the absolute difference between any pair of entries is at most limit.'),
2024:('考试中最长连续答案','Maximize the Confusion of an Exam','maxConsecutiveAnswers','答案串只含T、F，最多修改k个答案。返回可得到的最长连续相同答案长度。','The answer string contains T and F. Change at most k answers and return the longest possible run of identical answers.'),
2516:('从两端取走每种字符至少k个','Take K of Each Character From Left and Right','takeCharacters','字符串只含a、b、c。每分钟从左端或右端取走一个字符，返回取到每种字符至少k个的最少分钟数，做不到返回-1。','The string contains only a,b,c. Each minute removes one character from either end. Return the fewest minutes needed to take at least k of every character, or -1 if impossible.'),
2302:('得分小于k的子数组','Count Subarrays With Score Less Than K','countSubarrays','非空连续子数组的得分为元素和乘以其长度。统计得分严格小于k的子数组数量。','A nonempty contiguous subarray has score equal to its sum times its length. Count subarrays with score strictly less than k.'),
2537:('至少k对相等元素的子数组','Count the Number of Good Subarrays','countGood','统计非空连续子数组数量，使其中至少有k对不同下标i<j满足元素相等。一个值出现c次贡献c(c-1)/2对。','Count nonempty contiguous subarrays containing at least k index pairs i<j with equal values. A value occurring c times contributes c(c-1)/2 pairs.'),
560:('和为k的子数组','Subarray Sum Equals K','subarraySum','统计元素和等于k的非空连续子数组数量，数组可以含负数和0。','Count nonempty contiguous subarrays whose sum equals k. Values may be negative or zero.'),
525:('0和1数量相同的最长子数组','Contiguous Array','findMaxLength','返回0和1数量相同的最长连续子数组长度，不存在则返回0。','Return the longest contiguous subarray with equal numbers of zeros and ones, or zero if none exists.'),
523:('连续子数组和','Continuous Subarray Sum','checkSubarraySum','判断是否存在长度至少为2、元素和为k的整数倍的连续子数组。0也是k的整数倍。','Determine whether a contiguous subarray of length at least two has sum divisible by k. Zero is a multiple of k.'),
974:('和能被k整除的子数组','Subarray Sums Divisible by K','subarraysDivByK','统计元素和能被k整除的非空连续子数组数量，数组允许负数和0。','Count nonempty contiguous subarrays whose sum is divisible by k. Negative values and zeros are allowed.'),
930:('和为目标值的二元子数组','Binary Subarrays With Sum','numSubarraysWithSum','数组只含0和1。统计元素和恰好等于goal的非空连续子数组数量。','The array contains only zero and one. Count nonempty contiguous subarrays whose sum is exactly goal.'),
1248:('恰有k个奇数的子数组','Count Number of Nice Subarrays','numberOfSubarrays','统计恰好包含k个奇数的非空连续子数组数量。','Count nonempty contiguous subarrays containing exactly k odd numbers.'),
1423:('两端取牌的最大得分','Maximum Points You Can Obtain from Cards','maxScore','每次只能拿走最左或最右的一张牌，共恰好拿k张，返回拿到的分数总和的最大值。','Take exactly k cards, each time from the left or right end. Return the maximum total score of the cards taken.'),
}

INPUT={
42:('第一行n，第二行n个高度。1≤n≤20000，0≤高度≤100000。','First line n, then n heights. 1≤n≤20000; heights in [0,100000].'),
567:('两行分别为s1、s2，均仅含小写英文字母，长度均为1至10000。','Two lines: s1, then s2, both lowercase English strings of length 1–10000.'),
1052:('第一行n和minutes；第二行n个customers值；第三行n个grumpy值。1≤minutes≤n≤20000，customers在[0,1000]，grumpy为0或1。','First line n and minutes; second n customers values; third n grumpy flags. 1≤minutes≤n≤20000; customers in [0,1000]; flags 0 or 1.'),
159:('一行s，长度1至100000，仅含大小写英文字母。','One line s, length 1–100000, containing only uppercase and lowercase English letters.'),
340:('第一行完整字符串s，第二行k。1≤字符数≤50000，0≤k≤50。保留空格；本标准输入格式中字符串不得包含换行、行分隔符或空字符。','First line is the entire string s; second line k. 1≤character count≤50000; 0≤k≤50. Preserve spaces; this line-based input excludes newline/line-separator and NUL characters.'),
904:('第一行n，第二行n个水果类型。1≤n≤100000，0≤fruits[i]<n。','First line n, then n fruit types. 1≤n≤100000; 0≤fruits[i]<n.'),
424:('第一行s，第二行k。s仅含大写英文字母，1≤长度≤100000，0≤k≤长度。','First line s; second k. Uppercase English letters only; length 1–100000; 0≤k≤length.'),
1493:('第一行n，第二行n个0或1。1≤n≤100000。','First line n, then n binary entries. 1≤n≤100000.'),
1208:('三行分别为s、t、maxCost。s和t均仅含小写英文字母，长度相等且为1至100000；0≤maxCost≤1000000。','Three lines: s, t, maxCost. Both strings contain lowercase English letters and have equal lengths 1–100000; 0≤maxCost≤1000000.'),
713:('第一行n和k，第二行n个整数。1≤n≤30000，值在[1,1000]，0≤k≤1000000。','First line n and k, then n integers. 1≤n≤30000; values in [1,1000]; 0≤k≤1000000.'),
76:('两行分别为s和t，均仅含大小写英文字母，长度均为1至100000。若存在覆盖子串，保证最短覆盖窗口唯一。','Two lines: s and t, each containing uppercase/lowercase English letters, length 1–100000. A shortest covering window, when it exists, is unique.'),
30:('第一行s，第二行单词数m，之后m行每行一个单词。1≤s长度≤10000，1≤m≤5000，单词等长且长度为1至30；所有字符串仅含小写英文字母。','First line s; second word count m; next m lines one word each. s length 1–10000; 1≤m≤5000; all words have the same length 1–30. Lowercase English letters only.'),
395:('第一行s，第二行k。仅含小写英文字母，1≤长度≤10000，1≤k≤100000。','First line s; second k. Lowercase English letters only, length 1–10000; 1≤k≤100000.'),
992:('第一行n和k，第二行n个整数。1≤n≤20000，数组值和k均在[1,n]。','First line n and k, then n integers. 1≤n≤20000; values and k are in [1,n].'),
1658:('第一行n和x，第二行n个整数。1≤n≤100000，值在[1,10000]，1≤x≤1000000000。','First line n and x, then n integers. 1≤n≤100000; values in [1,10000]; 1≤x≤1000000000.'),
1838:('第一行n和k，第二行n个整数。1≤n≤100000，数组值和k均在[1,100000]。','First line n and k, then n integers. 1≤n≤100000; values and k in [1,100000].'),
1234:('一行s，仅含Q、W、E、R，长度4至100000且为4的倍数。','One line s using only Q,W,E,R. Length 4–100000 and divisible by four.'),
1358:('一行s，仅含a、b、c，长度3至50000。','One line s using only a,b,c, length 3–50000.'),
1438:('第一行n和limit，第二行n个整数。1≤n≤100000，值在[1,1000000000]，0≤limit≤1000000000。','First line n and limit, then n integers. 1≤n≤100000; values in [1,1000000000]; 0≤limit≤1000000000.'),
2024:('第一行answerKey，第二行k。仅含T或F，长度n在[1,50000]，1≤k≤n。','First line answerKey; second k. Only T/F, length n in [1,50000]; 1≤k≤n.'),
2516:('第一行s，第二行k。仅含a、b、c，长度n在[1,100000]，0≤k≤n。','First line s; second k. Only a,b,c, length n in [1,100000]; 0≤k≤n.'),
2302:('第一行n和k，第二行n个整数。1≤n≤100000，值在[1,100000]，1≤k≤10^15。','First line n and k, then n integers. 1≤n≤100000; values in [1,100000]; 1≤k≤10^15.'),
2537:('第一行n和k，第二行n个整数。1≤n≤100000，数组值和k均在[1,1000000000]。','First line n and k, then n integers. 1≤n≤100000; values and k in [1,1000000000].'),
560:('第一行n和k，第二行n个整数。1≤n≤20000，值在[-1000,1000]，k在[-10000000,10000000]。','First line n and k, then n integers. 1≤n≤20000; values in [-1000,1000]; k in [-10000000,10000000].'),
525:('第一行n，第二行n个0或1。1≤n≤100000。','First line n, then n binary entries. 1≤n≤100000.'),
523:('第一行n和k，第二行n个整数。1≤n≤100000，值在[0,1000000000]，总和≤2147483647；1≤k≤2147483647。','First line n and k, then n integers. 1≤n≤100000; values in [0,1000000000]; their sum≤2147483647; 1≤k≤2147483647.'),
974:('第一行n和k，第二行n个整数。1≤n≤30000，值在[-10000,10000]，2≤k≤10000。','First line n and k, then n integers. 1≤n≤30000; values in [-10000,10000]; 2≤k≤10000.'),
930:('第一行n和goal，第二行n个0或1。1≤n≤30000，0≤goal≤n。','First line n and goal, then n binary entries. 1≤n≤30000; 0≤goal≤n.'),
1248:('第一行n和k，第二行n个整数。1≤n≤50000，值在[1,100000]，1≤k≤n。','First line n and k, then n integers. 1≤n≤50000; values in [1,100000]; 1≤k≤n.'),
1423:('第一行n和k，第二行n个分数。1≤n≤100000，分数在[1,10000]，1≤k≤n。','First line n and k, then n scores. 1≤n≤100000; scores in [1,10000]; 1≤k≤n.'),
}

WRONG={
42:[('uses global walls for every column','result=sum(max(0,min(args[0][0],args[0][-1])-v) for v in args[0])'),('counts underwater positions rather than volume','result=sum(v<max(args[0][:i+1]) and v<max(args[0][i:]) for i,v in enumerate(args[0]))')],
567:[('requires original order','result=int(args[0] in args[1])'),('ignores multiplicity and contiguous positions','result=int(set(args[0])<=set(args[1]))')],
1052:[('uses only the first interval','c,g,k=args;result=sum(v for i,v in enumerate(c) if i<k or not g[i])'),('does not count already satisfied customers outside window','c,g,k=args;result=max(sum(c[i:i+k]) for i in range(len(c)-k+1))')],
159:[('requires exactly two character types','result=0 if len(set(args[0]))<2 else fast(159,args)'),('ignores lowercase-uppercase distinction','result=fast(159,[args[0].lower()])')],
340:[('requires at least one distinct type even for k zero','result=fast(340,[args[0],max(1,args[1])])'),('strips meaningful whitespace','result=fast(340,[args[0].strip(),args[1]])')],
904:[('uses total frequency rather than contiguous window','result=sum(sorted(Counter(args[0]).values(),reverse=True)[:2])'),('allows just one basket','result=max(len(list(g)) for _,g in itertools.groupby(args[0]))')],
424:[('requires a replacement strictly below budget','result=fast(424,[args[0],max(0,args[1]-1)])'),('changes only into A','s,k=args;left=cost=result=0\nfor right,c in enumerate(s):\n cost+=c!="A"\n while cost>k:cost-=s[left]!="A";left+=1\n result=max(result,right-left+1)')],
1493:[('forgets mandatory deletion','result=fast(1493,args)+1'),('counts total ones instead of a run','result=max(0,sum(args[0])-(0 not in args[0]))')],
1208:[('uses signed character differences','s,t,k=args;result=len(s) if sum(ord(u)-ord(v) for u,v in zip(s,t))<=k else 0'),('requires positive budget','result=0 if args[2]==0 else fast(1208,args)')],
713:[('accepts product equal to threshold','result=fast(713,[args[0],args[1]+1])'),('excludes single entry windows','result=fast(713,args)-sum(v<args[1] for v in args[0])')],
76:[('ignores target duplicate characters','result=fast(76,[args[0],"".join(dict.fromkeys(args[1]))])'),('treats matching as case insensitive','result=fast(76,[args[0].lower(),args[1].lower()])')],
30:[('does not allow word permutation','s,w=args;t="".join(w);result=[i for i in range(len(s)-len(t)+1) if s[i:i+len(t)]==t]'),('only checks offsets divisible by word width','result=[i for i in fast(30,args) if i%len(args[1][0])==0]')],
395:[('checks total string frequencies only','s,k=args;result=len(s) if any(v>=k for v in Counter(s).values()) else 0'),('accepts one fewer repeat','result=fast(395,[args[0],max(1,args[1]-1)])')],
992:[('counts at most k distinct','result=sum(fast(992,[args[0],k]) for k in range(1,args[1]+1))'),('counts k minus one distinct','result=fast(992,[args[0],args[1]-1])')],
1658:[('removes from left only','total=0;result=-1\nfor i,v in enumerate(args[0]):\n total+=v\n if total==args[1]:result=i+1;break'),('does not allow deleting the entire array','result=-1 if sum(args[0])==args[1] else fast(1658,args)')],
1838:[('does not sort before choosing adjacent values','nums,k=args;result=max(Counter(nums).values())'),('spends one fewer increment','result=fast(1838,[args[0],args[1]-1])')],
1234:[('uses total excess without contiguity','result=sum(max(0,v-len(args[0])//4) for v in Counter(args[0]).values())'),('forbids empty replacement','result=max(1,fast(1234,args))')],
1358:[('counts length three windows only','s=args[0];result=sum(set(s[i:i+3])==set("abc") for i in range(len(s)-2))'),('counts every length at least three','n=len(args[0]);result=(n-1)*(n-2)//2')],
1438:[('uses strict difference','result=0 if args[1]==0 else fast(1438,[args[0],args[1]-1])'),('checks consecutive differences only','nums,k=args;run=result=1\nfor i in range(1,len(nums)):\n run=run+1 if abs(nums[i]-nums[i-1])<=k else 1;result=max(result,run)')],
2024:[('changes only to T','s,k=args;left=cost=result=0\nfor right,c in enumerate(s):\n cost+=c=="F"\n while cost>k:cost-=s[left]=="F";left+=1\n result=max(result,right-left+1)'),('spends one fewer change','result=fast(2024,[args[0],args[1]-1])')],
2516:[('uses total required count without end restriction','result=3*args[1] if all(args[0].count(c)>=args[1] for c in "abc") else -1'),('rejects empty removal','result=-1 if args[1]==0 else fast(2516,args)')],
2302:[('accepts score equal to threshold','result=fast(2302,[args[0],args[1]+1])'),('checks sum only instead of sum times length','nums,k=args;left=total=result=0\nfor right,v in enumerate(nums):\n total+=v\n while total>=k and left<=right:total-=nums[left];left+=1\n result+=right-left+1')],
2537:[('requires more than k pairs','result=fast(2537,[args[0],args[1]+1])'),('counts whole array only','c=Counter(args[0]);result=int(sum(v*(v-1)//2 for v in c.values())>=args[1])')],
560:[('counts empty subarrays for zero target','result=fast(560,args)+(len(args[0])+1 if args[1]==0 else 0)'),('forgets initial zero prefix','result=fast(560,args)-sum(sum(args[0][:i])==args[1] for i in range(1,len(args[0])+1))')],
525:[('balances the whole multiset rather than contiguous positions','result=2*min(args[0].count(0),args[0].count(1))'),('forgets prefix before the first entry','v=args[0];result=fast(525,[v[1:]]) if len(v)>1 else 0')],
523:[('allows a length one subarray','result=int(any(v%args[1]==0 for v in args[0])) or fast(523,args)'),('checks total array sum only','result=int(len(args[0])>=2 and sum(args[0])%args[1]==0)')],
974:[('counts zero sum instead of divisible sum','result=fast(560,[args[0],0])'),('uses truncating negative remainders','total=result=0;c=Counter({0:1})\nfor v in args[0]:\n total+=v;r=total%args[1] if total>=0 else -((-total)%args[1]);result+=c[r];c[r]+=1')],
930:[('ignores zero target','result=0 if args[1]==0 else fast(930,args)'),('counts at most goal','nums,k=args;left=total=result=0\nfor right,v in enumerate(nums):\n total+=v\n while total>k:total-=nums[left];left+=1\n result+=right-left+1')],
1248:[('counts odd numbers in the whole array only','result=int(sum(v%2 for v in args[0])==args[1])'),('counts at most k odd entries','nums,k=args;left=total=result=0\nfor right,v in enumerate(nums):\n total+=v%2\n while total>k:total-=nums[left]%2;left+=1\n result+=right-left+1')],
1423:[('takes k largest values ignoring positions','result=sum(sorted(args[0],reverse=True)[:args[1]])'),('takes only from one side','result=max(sum(args[0][:args[1]]),sum(args[0][-args[1]:]))')],
}

# Add explicit witnesses for errors that the standard examples do not expose.
EDGE[904].append([[1,2,3,1,2,3]])
EDGE[567].append(['aab','ab'])
EDGE[340].append(['  a',1])
EDGE[424].append(['BBBC',1])
EDGE[1493].append([[1,0,0,1,1]])
EDGE[76].extend([['aab','aab'],['Aa','a']])
EDGE[30].append(['xbarfoo',['bar','foo']])
EDGE[1234].append(['QWQWQWQEQERR'])
EDGE[1438].append([[1,2,3],1])
EDGE[2024].append(['FFFFT',1])
EDGE[525].append([[0,0,0,1,0,0,0,1]])
EDGE[523].append([[1,2,4],6])
EDGE[974].append([[-1,2,1],2])
EDGE[1423].append([[1,100,1,1],1])
PRESSURE[2302][0]=(PRESSURE[2302][0][0],5000049999) # full-length score equals k, so is excluded
PRESSURE[523].append(([[1]*100000,2**31-1],0))

HARD={42,76,30,340,992,2302}
EASY=set()
def make(pid):
 zh,en,method,dz,de=META[pid];iz,ie=INPUT[pid]
 kind='string' if pid==76 else 'integer-set' if pid==30 else 'integer'
 oz='输出原始字符串和换行，不加引号；空答案输出一个空行。' if kind=='string' else '第一行输出起点数量，随后用空白分隔0起始整数下标；顺序不限，不得重复。空集合仅输出0和换行。' if kind=='integer-set' else '输出一个整数；判断题用1表示是、0表示否。'
 oe='Print the raw string followed by a newline, without quotes; an empty answer is a blank line.' if kind=='string' else 'Print the count on the first line, followed by whitespace-separated zero-based integer indices in any order, without duplicates. An empty set is just 0 and a newline.' if kind=='integer-set' else 'Print one integer; for a yes/no question print 1 for yes and 0 for no.'
 prefix='import sys,math,itertools\nfrom collections import Counter,deque\n'+inspect.getsource(minimum_window)+'\n'+inspect.getsource(fast)+'\n'+parse(pid)+'\n'
 emit='print(len(result));print(*result) if result else None' if kind=='integer-set' else 'print(result)'
 return dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='困难' if pid in HARD else '中等',resultKind=kind,outputLimit=128 if pid==76 else 64,edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:oracle(pid,a),validate=lambda a:validate(pid,a),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[{'name':name,'source':prefix+body+'\n'+emit+'\n'} for name,body in WRONG[pid]])
PROBLEMS={pid:make(pid) for pid in IDS}
