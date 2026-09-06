"""Selected interval/binary-search fixtures, independently authored from local domains."""
import itertools,string
from collections import Counter
IDS=[2090,1109,1094,370,2381,435,452,253,1288,1851,2055,2602,34,81,74,240,540,2300,875,1011,1482,1283,1760,2187,2226,1898,410,1552,378,719]
METHODS=dict(zip(IDS,['getAverages','corpFlightBookings','carPooling','getModifiedArray','shiftingLetters','eraseOverlapIntervals','findMinArrowShots','minMeetingRooms','removeCoveredIntervals','minInterval','platesBetweenCandles','minOperations','searchRange','search','searchMatrix','searchMatrix','singleNonDuplicate','successfulPairs','minEatingSpeed','shipWithinDays','minDays','smallestDivisor','minimumSize','minimumTime','maximumCandies','maximumRemovals','splitArray','maxDistance','kthSmallest','smallestDistancePair']))
ARRAY={2090,1109,370,1851,2055,2602,34,2300}
INTERVAL={435,452,253,1288}
MATRIX={74,240,378}

def oracle(p,a):
 x=a[0]
 if p==2090:return [sum(x[i-a[1]:i+a[1]+1])//(2*a[1]+1) if a[1]<=i<len(x)-a[1] else -1 for i in range(len(x))]
 if p==1109:return [sum(s for l,r,s in x if l<=i<=r) for i in range(1,a[1]+1)]
 if p==1094:return int(all(sum(n for n,l,r in x if l<=i<r)<=a[1] for i in range(1001)))
 if p==370:return [sum(v for l,r,v in a[1] if l<=i<=r) for i in range(x)]
 if p==2381:return ''.join(chr(97+(ord(c)-97+sum(1 if d else -1 for l,r,d in a[1] if l<=i<=r))%26) for i,c in enumerate(x))
 if p==435:
  best=0
  for mask in range(1<<len(x)):
   chosen=[v for i,v in enumerate(x) if mask>>i&1]
   if all(r<=u or v<=l for (l,r),(u,v) in itertools.combinations(chosen,2)):best=max(best,len(chosen))
  return len(x)-best
 if p==452:
  ends=sorted({r for l,r in x})
  return next(k for k in range(1,len(x)+1) if any(all(any(l<=v<=r for v in pos) for l,r in x) for pos in itertools.combinations(ends,k)))
 if p==253:return max(sum(l<=t<r for l,r in x) for t in {l for l,r in x})
 if p==1288:return sum(not any(i!=j and u<=l and r<=v for j,(u,v) in enumerate(x)) for i,(l,r) in enumerate(x))
 if p==1851:return [min([r-l+1 for l,r in x if l<=q<=r],default=-1) for q in a[1]]
 if p==2055:
  out=[]
  for l,r in a[1]:
   out.append(sum(c=='*' and '|' in x[l:i] and '|' in x[i+1:r+1] for i,c in enumerate(x) if l<=i<=r))
  return out
 if p==2602:return [sum(abs(v-q) for v in x) for q in a[1]]
 if p==34:
  ids=[i for i,v in enumerate(x) if v==a[1]];return [ids[0],ids[-1]] if ids else [-1,-1]
 if p in {81,74,240}:return int(a[1] in (x if p==81 else [v for row in x for v in row]))
 if p==540:return next(v for v in x if x.count(v)==1)
 if p==2300:return [sum(v*w>=a[2] for w in a[1]) for v in x]
 if p in {875,1283}:return next(v for v in range(1,max(x)+1) if sum((n+v-1)//v for n in x)<=a[1])
 if p in {1011,410}:
  return min(max(sum(x[l:r]) for l,r in zip((0,)+cuts,cuts+(len(x),))) for cuts in itertools.combinations(range(1,len(x)),a[1]-1))
 if p==1482:
  m,k=a[1:]
  if m*k>len(x):return -1
  return min(max(x[i+j] for i in starts for j in range(k)) for starts in itertools.combinations(range(len(x)-k+1),m) if all(v-u>=k for u,v in zip(starts,starts[1:])))
 if p==1760:return next(v for v in range(1,max(x)+1) if sum((n-1)//v for n in x)<=a[1])
 if p==2187:
  completions=x[:];answer=0
  for _ in range(a[1]):
   i=min(range(len(x)),key=lambda j:completions[j]);answer=completions[i];completions[i]+=x[i]
  return answer
 if p==2226:return max([0]+[v for v in range(1,max(x)+1) if sum(n//v for n in x)>=a[1]])
 if p==1898:
  # Enumerate every embedding of pattern, maximizing the earliest removed index.
  s,pat,rem=a;rank={idx:i for i,idx in enumerate(rem)}
  return max(min([rank.get(idx,len(rem)) for idx in inds],default=len(rem)) for inds in itertools.combinations(range(len(s)),len(pat)) if ''.join(s[i] for i in inds)==pat)
 if p==1552:return max(min(v-u for u,v in zip(t,t[1:])) for t in itertools.combinations(sorted(x),a[1]))
 if p==378:return sorted(v for row in x for v in row)[a[1]-1]
 if p==719:return sorted(abs(u-v) for u,v in itertools.combinations(x,2))[a[1]-1]
 raise AssertionError(p)

def encode(p,a):
 if p==1898:return a[0]+'\n'+a[1]+'\n'+str(len(a[2]))+'\n'+' '.join(map(str,a[2]))+'\n'
 if p in {2381,2055}:return a[0]+'\n'+str(len(a[1]))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in a[1])
 if p==370:return f'{a[0]} {len(a[1])}\n'+''.join(' '.join(map(str,row))+'\n' for row in a[1])
 if p in INTERVAL:return str(len(a[0]))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in a[0])
 if p in {1109,1094}:return f'{len(a[0])} {a[1]}\n'+''.join(' '.join(map(str,row))+'\n' for row in a[0])
 if p==1851:return f'{len(a[0])} {len(a[1])}\n'+''.join(' '.join(map(str,row))+'\n' for row in a[0])+' '.join(map(str,a[1]))+'\n'
 if p in MATRIX:return f'{len(a[0])} {len(a[0][0])} {a[1]}\n'+''.join(' '.join(map(str,row))+'\n' for row in a[0])
 if p in {2602,2300}:return f'{len(a[0])} {len(a[1])}\n'+' '.join(map(str,a[0]))+'\n'+' '.join(map(str,a[1]))+'\n'+(str(a[2])+'\n' if p==2300 else '')
 return str(len(a[0]))+'\n'+' '.join(map(str,a[0]))+'\n'+(' '.join(map(str,a[1:]))+'\n' if len(a)>1 else '')

def parse(p):
 z='t=iter(sys.stdin.read().split())\n'
 if p==1898:return z+'s=next(t);p=next(t);n=int(next(t));args=[s,p,[int(next(t)) for _ in range(n)]]'
 if p in {2381,2055}:return z+'s=next(t);n=int(next(t));args=[s,[[int(next(t)) for _ in range('+str(3 if p==2381 else 2)+')] for _ in range(n)]]'
 if p==370:return z+'length=int(next(t));n=int(next(t));args=[length,[[int(next(t)) for _ in range(3)] for _ in range(n)]]'
 if p in INTERVAL:return z+'n=int(next(t));args=[[[int(next(t)),int(next(t))] for _ in range(n)]]'
 if p in {1109,1094}:return z+'n=int(next(t));v=int(next(t));args=[[[int(next(t)) for _ in range(3)] for _ in range(n)],v]'
 if p==1851:return z+'n=int(next(t));m=int(next(t));args=[[[int(next(t)),int(next(t))] for _ in range(n)],[int(next(t)) for _ in range(m)]]'
 if p in MATRIX:return z+'n=int(next(t));m=int(next(t));v=int(next(t));args=[[[int(next(t)) for _ in range(m)] for _ in range(n)],v]'
 if p in {2602,2300}:return z+'n=int(next(t));m=int(next(t));args=[[int(next(t)) for _ in range(n)],[int(next(t)) for _ in range(m)]]'+('\nargs.append(int(next(t)))' if p==2300 else '')
 return z+'n=int(next(t));args=[[int(next(t)) for _ in range(n)]]'+('' if p==540 else '\nargs.extend(map(int,t))')

def validate(p,a):
 assert type(a)is list;x=a[0]
 def ints(v,lo,hi,mn=1,mx=100000):assert type(v)is list and mn<=len(v)<=mx and all(type(t)is int and lo<=t<=hi for t in v)
 def num(v,lo,hi):assert type(v)is int and lo<=v<=hi
 def text(s,chars,lo,hi):assert type(s)is str and lo<=len(s)<=hi and set(s)<=set(chars)
 def intervals(rows,nmax,lo,hi,closed=False):
  assert 1<=len(rows)<=nmax
  for row in rows:
   ints(row,lo,hi,2,2);assert row[0]<=row[1] if closed else row[0]<row[1]
 if p==2090:ints(x,0,100000);num(a[1],0,100000)
 elif p==1109:
  num(a[1],1,20000);assert 1<=len(x)<=20000
  for l,r,s in x:num(l,1,a[1]);num(r,l,a[1]);num(s,1,10000)
 elif p==1094:
  num(a[1],1,100000);assert 1<=len(x)<=1000
  for n,l,r in x:num(n,1,100);num(l,0,999);num(r,l+1,1000)
 elif p==370:
  num(x,1,100000);assert len(a[1])<=10000
  for l,r,v in a[1]:num(l,0,x-1);num(r,l,x-1);num(v,-1000,1000)
 elif p==2381:
  text(x,string.ascii_lowercase,1,50000);assert 1<=len(a[1])<=50000
  for l,r,d in a[1]:num(l,0,len(x)-1);num(r,l,len(x)-1);num(d,0,1)
 elif p in INTERVAL:
  bound={435:(100000,-50000,50000),452:(100000,-2**31,2**31-1),253:(10000,0,1000000),1288:(1000,0,100000)}[p];intervals(x,*bound)
  if p==1288:assert len(set(map(tuple,x)))==len(x)
 elif p==1851:intervals(x,100000,1,10000000,True);ints(a[1],1,10000000)
 elif p==2055:
  text(x,'*|',3,100000);intervals(a[1],100000,0,len(x)-1,True)
 elif p==2602:ints(x,1,10**9);ints(a[1],1,10**9)
 elif p==34:ints(x,-10**9,10**9,0);assert x==sorted(x);num(a[1],-10**9,10**9)
 elif p==81:
  ints(x,-10000,10000,1,5000);num(a[1],-10000,10000);assert sum(x[i]>x[(i+1)%len(x)] for i in range(len(x)))<=1
 elif p in MATRIX:
  limit=100 if p==74 else 300;bound=10000 if p==74 else 10**9
  assert 1<=len(x)<=limit and 1<=len(x[0])<=limit
  for row in x:ints(row,-bound,bound,len(x[0]),len(x[0]));assert row==sorted(row)
  assert all(x[i][j]<=x[i+1][j] for i in range(len(x)-1) for j in range(len(x[0])))
  if p==74:assert all(x[i][-1]<x[i+1][0] for i in range(len(x)-1))
  if p==378:assert len(x)==len(x[0]);num(a[1],1,len(x)**2)
  else:num(a[1],-bound,bound)
 elif p==540:
  ints(x,0,100000);assert x==sorted(x);freq=list(Counter(x).values());assert freq.count(1)==1 and all(v in (1,2) for v in freq)
 elif p==2300:ints(x,1,100000);ints(a[1],1,100000);num(a[2],1,10**10)
 elif p==875:ints(x,1,10**9,1,10000);num(a[1],len(x),10**9)
 elif p==1011:ints(x,1,500,1,50000);num(a[1],1,len(x))
 elif p==1482:ints(x,1,10**9);num(a[1],1,1000000);num(a[2],1,len(x))
 elif p==1283:ints(x,1,1000000,1,50000);num(a[1],len(x),1000000)
 elif p==1760:ints(x,1,10**9);num(a[1],1,10**9)
 elif p==2187:ints(x,1,10000000);num(a[1],1,10000000)
 elif p==2226:ints(x,1,10000000);num(a[1],1,10**12)
 elif p==1898:
  text(x,string.ascii_lowercase,1,100000);text(a[1],string.ascii_lowercase,1,len(x));ints(a[2],0,len(x)-1,0,len(x)-1);assert len(set(a[2]))==len(a[2]);it=iter(x);assert all(c in it for c in a[1])
 elif p==410:ints(x,0,1000000,1,1000);num(a[1],1,min(50,len(x)))
 elif p==1552:ints(x,1,10**9,2);assert len(set(x))==len(x);num(a[1],2,len(x))
 elif p==719:ints(x,0,1000000,2,10000);num(a[1],1,len(x)*(len(x)-1)//2)
 else:raise AssertionError(p)


def random_args(p,r):
 if p==2090:return [[r.randrange(20) for _ in range(r.randint(1,12))],r.randrange(8)]
 if p==1109:
  n=r.randint(1,12);return [[sorted(r.choices(range(1,n+1),k=2))+[r.randint(1,10)] for _ in range(r.randint(1,8))],n]
 if p==1094:return [[[r.randint(1,10)]+sorted(r.sample(range(11),2)) for _ in range(r.randint(1,8))],r.randint(1,25)]
 if p==370:
  n=r.randint(1,12);return [n,[sorted(r.choices(range(n),k=2))+[r.randint(-5,5)] for _ in range(r.randrange(9))]]
 if p==2381:
  s=''.join(r.choices('abcz',k=r.randint(1,12)));return [s,[sorted(r.choices(range(len(s)),k=2))+[r.randrange(2)] for _ in range(r.randint(1,8))]]
 if p in INTERVAL:
  rows=[sorted(r.sample(range(12),2)) for _ in range(r.randint(1,8))]
  return [[list(t) for t in sorted(set(map(tuple,rows)))]] if p==1288 else [rows]
 if p==1851:return [[sorted(r.choices(range(1,15),k=2)) for _ in range(r.randint(1,8))],[r.randint(1,15) for _ in range(r.randint(1,8))]]
 if p==2055:
  s=''.join(r.choices('*|',k=r.randint(3,15)));return [s,[sorted(r.choices(range(len(s)),k=2)) for _ in range(r.randint(1,8))]]
 if p==2602:return [[r.randint(1,20) for _ in range(r.randint(1,10))],[r.randint(1,20) for _ in range(r.randint(1,10))]]
 if p in {34,81}:
  x=sorted(r.choices(range(-5,6),k=r.randint(0 if p==34 else 1,12)))
  if p==81:i=r.randrange(len(x));x=x[i:]+x[:i]
  return [x,r.randint(-6,6)]
 if p in MATRIX:
  n=r.randint(1,5);m=n if p==378 else r.randint(1,5)
  if p==74:
   v=sorted(r.sample(range(-30,31),n*m));x=[v[i*m:(i+1)*m] for i in range(n)]
  else:
   rows=sorted(r.choices(range(-8,9),k=n));cols=sorted(r.choices(range(-8,9),k=m));x=[[u+v for v in cols] for u in rows]
  return [x,r.randint(1,n*n) if p==378 else r.choice([r.choice(r.choice(x)),r.randint(-30,30)])]
 if p==540:
  values=r.sample(range(20),r.randint(1,8));single=r.choice(values);return [sorted([v for v in values for _ in range(1 if v==single else 2)])]
 if p==2300:return [[r.randint(1,12) for _ in range(r.randint(1,10))],[r.randint(1,12) for _ in range(r.randint(1,10))],r.randint(1,150)]
 if p in {875,1283}:
  x=[r.randint(1,30) for _ in range(r.randint(1,10))];return [x,r.randint(len(x),len(x)*10)]
 if p in {1011,410}:
  x=[r.randint(0 if p==410 else 1,20) for _ in range(r.randint(1,9))];return [x,r.randint(1,len(x))]
 if p==1482:
  x=[r.randint(1,15) for _ in range(r.randint(1,9))];return [x,r.randint(1,6),r.randint(1,len(x))]
 if p in {1760,2187,2226}:return [[r.randint(1,20) for _ in range(r.randint(1,8))],r.randint(1,30)]
 if p==1898:
  s=''.join(r.choices('abc',k=r.randint(1,10)));inds=sorted(r.sample(range(len(s)),r.randint(1,len(s))));return [s,''.join(s[i] for i in inds),r.sample(range(len(s)),r.randrange(len(s)))]
 if p==1552:
  x=r.sample(range(1,30),r.randint(2,9));return [x,r.randint(2,len(x))]
 if p==719:
  x=[r.randrange(20) for _ in range(r.randint(2,10))];return [x,r.randint(1,len(x)*(len(x)-1)//2)]
 raise AssertionError(p)

EDGE={
2090:[[[7,4,3,9,1,8,5,2,6],3],[[1],0],[[1,2],100000]],1109:[[[[1,2,10],[2,3,20],[2,5,25]],5],[[[1,1,5]],1]],1094:[[[[2,1,5],[3,3,7]],4],[[[2,1,5],[3,5,7]],3]],370:[[5,[[1,3,2],[2,4,3],[0,2,-2]]],[1,[]],[1,[[0,0,-1000]]]],2381:[['abc',[[0,1,0],[1,2,1],[0,2,1]]],['a',[[0,0,0]]]],435:[[[[1,2],[2,3],[3,4],[1,3]]],[[[1,2],[1,2],[1,2]]]],452:[[[[10,16],[2,8],[1,6],[7,12]]],[[[1,2],[2,3]]]],253:[[[[0,30],[5,10],[15,20]]],[[[0,1],[1,2]]]],1288:[[[[1,4],[3,6],[2,8]]],[[[1,4],[1,3],[2,3]]]],1851:[[[[1,4],[2,4],[3,6],[4,4]],[2,3,4,5]],[[[2,2]],[1,2,3]]],2055:[['**|**|***|',[[2,5],[5,9]]],['***',[[0,2]]],['|*|',[[0,1],[1,2],[0,2]]]],2602:[[[3,1,6,8],[1,5]],[[1],[1]],[[2,2],[2,3]]],34:[[[5,7,7,8,8,10],8],[[],0],[[1,1],1],[[1],2]],81:[[[2,5,6,0,0,1,2],0],[[1,0,1,1,1],0],[[1,1],2]],74:[[[[1,3,5,7],[10,11,16,20],[23,30,34,60]],3],[[[1]],2]],240:[[[[1,4,7],[2,5,8],[3,6,9]],6],[[[1,4],[2,5]],3]],540:[[[1,1,2,3,3,4,4,8,8]],[[1]],[[0,0,1]]],2300:[[[5,1,3],[1,2,3,4,5],7],[[2],[3],6]],875:[[[3,6,7,11],8],[[30,11,23,4,20],5]],1011:[[[1,2,3,4,5,6,7,8,9,10],5],[[1,2,3],3],[[1,1],1]],1482:[[[1,10,3,10,2],3,1],[[1,10,3,10,2],3,2],[[7,7,7,7,12,7,7],2,3]],1283:[[[1,2,5,9],6],[[2,2],2]],1760:[[[9],2],[[2,4,8,2],4],[[1],1]],2187:[[[1,2,3],5],[[2],1]],2226:[[[5,8,6],3],[[2,5],11]],1898:[['abcacb','ab',[3,1,0]],['abc','abc',[]],['aaaa','aa',[2,0,3]]],410:[[[7,2,5,10,8],2],[[0,0,0],2],[[1,2,3],3]],1552:[[[1,2,3,4,7],3],[[5,4,3,2,1,1000000000],2]],378:[[[[1,5,9],[10,11,13],[12,13,15]],8],[[[-5]],1]],719:[[[1,3,1],1],[[1,1,1],2],[[0,10],1]],
}
PRESSURE={
2090:[([[100000]*100000,49999],[-1]*49999+[100000,100000]+[-1]*49999)],
1109:[([[[1,20000,10000]]*20000,20000],[200000000]*20000)],
1094:[([[[100,0,1000]]*1000,100000],1)],
370:[([100000,[[0,99999,1000]]*10000],[10000000]*100000)],
2381:[(['z'*50000,[[0,49999,1]]*50000],'b'*50000)],
435:[([[[-50000,50000]]*100000],99999)],
452:[([[[-2**31,2**31-1]]*100000],1)],
253:[([[[0,1000000]]*10000],10000)],
1288:[([[[i,100000-i] for i in range(1000)]],1)],
1851:[([[[1,10000000]]*100000,[10000000]*100000],[10000000]*100000)],
2055:[(['|'+'*'*99998+'|',[[0,99999]]*100000],[99998]*100000)],
2602:[([[1000000000]*100000,[1]*100000],[99999999900000]*100000)],
34:[([[1000000000]*100000,1000000000],[0,99999])],
81:[([[1]*2499+[0]+[1]*2500,0],1)],
74:[([[[i*100+j-5000 for j in range(100)] for i in range(100)],4999],1)],
240:[([[[i+j for j in range(300)] for i in range(300)],1000000000],0)],
540:[([[v for v in range(49999) for _ in range(2)]+[100000]],100000)],
2300:[([[100000]*100000,[100000]*100000,10000000000],[100000]*100000)],
875:[([[1000000000]*10000,10000],1000000000),([[1000000000]*10000,1000000000],10000)],
1011:[([[500]*50000,1],25000000)],
1482:[([[1000000000]*100000,1,100000],1000000000),([[1]*100000,1000000,1],-1)],
1283:[([[1000000]*50000,50000],1000000)],
1760:[([[1000000000]*100000,1000000000],99991)],
2187:[([[10000000]*100000,10000000],1000000000),([[10000000],10000000],100000000000000)],
2226:[([[10000000]*100000,1000000000000],1)],
1898:[(['a'*100000,'a',list(range(99999))],99999)],
410:[([[1000000]*1000,50],20000000)],
1552:[([list(range(1,100000))+[1000000000],2],999999999)],
378:[([[[1000000000]*300 for _ in range(300)],90000],1000000000)],
719:[([[0]*10000,49995000],0)],
}

# Deliberate algorithm variants, not mutations of oracle answers.
WRONG={
2090:[('requires extra element on right boundary',"n=len(x);k=args[1];result=[sum(x[i-k:i+k+1])//(2*k+1) if k<=i<n-k-1 else -1 for i in range(n)]"),('uses window sum without dividing',"n=len(x);k=args[1];result=[sum(x[i-k:i+k+1]) if k<=i<n-k else -1 for i in range(n)]")],
1109:[('excludes final booked flight',"result=[sum(s for l,r,s in x if l<=i<r) for i in range(1,args[1]+1)]"),('takes maximum instead of adding bookings',"result=[max([0]+[s for l,r,s in x if l<=i<=r]) for i in range(1,args[1]+1)]")],
1094:[('keeps passengers at dropoff station',"result=int(all(sum(n for n,l,r in x if l<=i<=r)<=args[1] for i in range(1001)))"),('only checks each trip independently',"result=int(max(n for n,l,r in x)<=args[1])")],
370:[('excludes update right endpoint',"result=[sum(v for l,r,v in args[1] if l<=i<r) for i in range(x)]"),('overwrites rather than adds overlapping updates',"result=[0]*x\nfor l,r,v in args[1]:\n for i in range(l,r+1):result[i]=v")],
2381:[('ignores backwards shifts',"result=''.join(chr(97+(ord(c)-97+sum(d for l,r,d in args[1] if l<=i<=r))%26) for i,c in enumerate(x))"),('excludes right endpoint',"result=''.join(chr(97+(ord(c)-97+sum(1 if d else -1 for l,r,d in args[1] if l<=i<r))%26) for i,c in enumerate(x))")],
435:[('treats touching intervals as overlapping',"last=-10**20;keep=0\nfor l,r in sorted(x,key=lambda z:z[1]):\n if l>last:keep+=1;last=r\nresult=len(x)-keep"),('selects by start rather than end',"last=-10**20;keep=0\nfor l,r in sorted(x):\n if l>=last:keep+=1;last=r\nresult=len(x)-keep")],
452:[('does not share arrows at equal endpoints',"last=-10**20;result=0\nfor l,r in sorted(x,key=lambda z:z[1]):\n if l>=last:result+=1;last=r"),('counts connected union components',"end=-10**20;result=0\nfor l,r in sorted(x):\n if l>end:result+=1\n end=max(end,r)")],
253:[('counts ending meetings as still active',"result=max(sum(l<=t<=r for l,r in x) for t in {l for l,r in x})"),('counts overlapping pairs rather than peak concurrency',"result=1+sum(max(l,u)<min(r,v) for (l,r),(u,v) in itertools.combinations(x,2))")],
1288:[('requires strictly smaller endpoints for coverage',"result=sum(not any(u<l and r<v for u,v in x) for l,r in x)"),('keeps inner rather than outer intervals',"result=sum(not any(i!=j and l<=u and v<=r for j,(u,v) in enumerate(x)) for i,(l,r) in enumerate(x))")],
1851:[('forgets inclusive interval length',"result=[min([r-l for l,r in x if l<=q<=r],default=-1) for q in args[1]]"),('returns first covering interval',"result=[next((r-l+1 for l,r in x if l<=q<=r),-1) for q in args[1]]")],
2055:[('counts plates without bounding candles',"result=[x[l:r+1].count('*') for l,r in args[1]]"),('counts candles rather than plates',"result=[x[l:r+1].count('|') for l,r in args[1]]")],
2602:[('takes absolute value after summation',"result=[abs(sum(x)-q*len(x)) for q in args[1]]"),('ignores duplicate array values',"result=[sum(abs(v-q) for v in set(x)) for q in args[1]]")],
34:[('returns one occurrence for both boundaries',"i=x.index(args[1]) if args[1] in x else -1;result=[i,i]"),('uses insertion point for absent target',"result=[bisect.bisect_left(x,args[1]),bisect.bisect_right(x,args[1])-1]")],
81:[('binary searches rotated array as if sorted',"i=bisect.bisect_left(x,args[1]);result=int(i<len(x) and x[i]==args[1])"),('requires strictly increasing half to detect duplicates',"l=0;r=len(x)-1;result=0\nwhile l<=r:\n m=(l+r)//2\n if x[m]==args[1]:result=1;break\n if x[l]<x[m]:\n  if x[l]<=args[1]<x[m]:r=m-1\n  else:l=m+1\n else:\n  if x[m]<args[1]<=x[r]:l=m+1\n  else:r=m-1")],
74:[('checks only first row',"result=int(args[1] in x[0])"),('treats range membership as exact presence',"result=int(x[0][0]<=args[1]<=x[-1][-1])")],
240:[('treats row-major order as globally sorted',"v=[n for row in x for n in row];i=bisect.bisect_left(v,args[1]);result=int(i<len(v) and v[i]==args[1])"),('checks only first row and column',"result=int(args[1] in x[0] or args[1] in [row[0] for row in x])")],
540:[('returns first value unconditionally assuming singleton first',"result=x[0]"),('assumes singleton is at middle index',"result=x[len(x)//2]")],
2300:[('uses strict product comparison',"result=[sum(v*w>args[2] for w in args[1]) for v in x]"),('deduplicates potions',"result=[sum(v*w>=args[2] for w in set(args[1])) for v in x]")],
875:[('ignores per-pile rounding',"result=(sum(x)+args[1]-1)//args[1]"),('uses floor division for hours',"result=next(v for v in range(1,max(x)+1) if sum(n//v for n in x)<=args[1])")],
1011:[('uses average lower bound without checking order',"result=max(max(x),(sum(x)+args[1]-1)//args[1])"),('requires every parcel to have own day unless one day',"result=sum(x) if args[1]<len(x) else max(x)")],
1482:[('ignores adjacent flower requirement',"m,k=args[1:];result=sorted(x)[m*k-1] if m*k<=len(x) else -1"),('allows bouquet positions to overlap',"m,k=args[1:];result=next((d for d in sorted(set(x)) if sum(max(x[i:i+k])<=d for i in range(len(x)-k+1))>=m),-1)")],
1283:[('uses floor instead of ceil division',"result=next(v for v in range(1,max(x)+1) if sum(n//v for n in x)<=args[1])"),('uses strict threshold',"result=next((v for v in range(1,max(x)+1) if sum((n+v-1)//v for n in x)<args[1]),-1)")],
1760:[('counts parts rather than split operations',"result=next((v for v in range(1,max(x)+1) if sum((n+v-1)//v for n in x)<=args[1]),max(x))"),('allocates all operations to largest bag',"m=max(x);others=x[:];others.remove(m);result=max(others+[(m+args[1])//(args[1]+1)])")],
2187:[('uses only fastest vehicle',"result=min(x)*args[1]"),('rounds incomplete trips upward',"result=next(t for t in range(1,min(x)*args[1]+1) if sum((t+v-1)//v for v in x)>=args[1])")],
2226:[('pools different candy piles',"result=sum(x)//args[1]"),('uses strict child count',"result=max([0]+[v for v in range(1,max(x)+1) if sum(n//v for n in x)>args[1]])")],
1898:[('requires remaining pattern contiguous',"s,pat,rem=args;result=0\nfor k in range(len(rem)+1):\n t=''.join(c for i,c in enumerate(s) if i not in set(rem[:k]))\n if pat in t:result=k"),('removes indices in sorted order',"s,pat,rem=args;result=0\nfor k in range(len(rem)+1):\n t=iter(c for i,c in enumerate(s) if i not in set(sorted(rem)[:k]))\n if all(c in t for c in pat):result=k")],
410:[('uses average without contiguous feasibility',"result=max(max(x),(sum(x)+args[1]-1)//args[1])"),('partitions into equal element counts',"n=len(x);k=args[1];result=max(sum(x[i*n//k:(i+1)*n//k]) for i in range(k))")],
1552:[('uses endpoint average without available positions',"result=(max(x)-min(x))//(args[1]-1)"),('chooses first sorted positions',"s=sorted(x)[:args[1]];result=min(v-u for u,v in zip(s,s[1:]))")],
378:[('treats matrix row-major as sorted',"result=[v for row in x for v in row][args[1]-1]"),('deduplicates equal matrix entries',"v=sorted(set(n for row in x for n in row));result=v[min(args[1]-1,len(v)-1)]")],
719:[('only counts adjacent pair distances',"s=sorted(x);d=sorted(v-u for u,v in zip(s,s[1:]));result=d[min(args[1]-1,len(d)-1)]"),('removes repeated pair distances',"d=sorted(set(abs(u-v) for u,v in itertools.combinations(x,2)));result=d[min(args[1]-1,len(d)-1)]")],
}
EDGE[435].append([[[1,10],[2,3],[3,4]]])
EDGE[452].append([[[1,3],[2,4],[4,5]]])
EDGE[1288].append([[[1,10],[2,3],[4,5]]])
EDGE[74].extend([[[[1,3],[5,7]],5],[[[1,3]],2]])
EDGE[540].append([[0,1,1,2,2]])
EDGE[2300].append([[2],[3,3],6])
EDGE[1482].append([[1,1,1],2,2])
EDGE[1760].append([[9,9],2])
EDGE[1898].extend([['abc','ac',[]],['abcb','ab',[3,1,0]]])
EDGE[410].append([[1,1,1,9],2])
EDGE[1552].append([[1,2,3,100],3])
EDGE[378].append([[[1,2],[1,3]],2])
EDGE[719].extend([[[0,2,10],3],[[0,0,2],2]])

META={
2090:('半径为k的子数组平均值','K Radius Subarray Averages','对每个下标i，取[i−k,i+k]的整数平均值，向下取整；窗口越界时结果为−1。','For every index i, return the floor of the average over [i−k,i+k], or −1 if that window crosses an array boundary.','1≤n≤100000；0≤nums[i],k≤100000。','1≤n≤100000; 0≤nums[i],k≤100000.'),
1109:('航班预订统计','Corporate Flight Bookings','航班编号1到n。每条[first,last,seats]为闭区间内每个航班增加seats个预订座位，返回各航班累计座位数。','Flights are numbered 1..n. Each [first,last,seats] adds seats to every flight in the inclusive range. Return the total booked seats for each flight.','第一行预订数m和航班数n；随后m行first last seats。1≤m,n≤20000；1≤first≤last≤n；1≤seats≤10000。','First line booking count m and flight count n; then m lines first last seats. 1≤m,n≤20000; 1≤first≤last≤n; 1≤seats≤10000.'),
1094:('拼车','Car Pooling','每条[乘客数,上车位置,下车位置]要求在上车处接人、下车处放人。车辆只向前行驶，同一位置可先下车后上车，判断是否始终不超容量。','Each trip specifies passenger count, pickup, and dropoff. The vehicle moves forward only; passengers may leave before others board at the same location. Determine whether capacity is never exceeded.','第一行行程数n与capacity；随后n行passengers from to。1≤n≤1000；1≤passengers≤100；0≤from<to≤1000；1≤capacity≤100000。','First line trip count n and capacity, then n lines passengers from to. 1≤n≤1000; 1≤passengers≤100; 0≤from<to≤1000; 1≤capacity≤100000.'),
370:('区间加法','Range Addition','长度为length的数组初始全零。每个[l,r,inc]给闭区间[l,r]的元素加inc，返回最终数组。','Start with a zero array of length length. Each [l,r,inc] adds inc to the inclusive range [l,r]. Return the final array.','第一行length和更新数m；随后m行l r inc，下标从0开始。1≤length≤100000；0≤m≤10000；0≤l≤r<length；−1000≤inc≤1000。','First line length and update count m, then m lines l r inc, using zero-based indices. 1≤length≤100000; 0≤m≤10000; 0≤l≤r<length; −1000≤inc≤1000.'),
2381:('字母移位 II','Shifting Letters II','对每个[start,end,direction]，将闭区间字符循环移动一位，direction为1则向后一个字母移动，为0则向前一个字母移动，a与z循环相接。','For each [start,end,direction], cyclically shift the inclusive character range by one: direction 1 advances to the next letter, and 0 goes to the previous letter, wrapping between a and z.','第一行小写字符串s，第二行操作数m，随后m行start end direction。1≤|s|,m≤50000；0≤start≤end<|s|；direction为0或1。','First line lowercase string s, second line operation count m, then m lines start end direction. 1≤|s|,m≤50000; 0≤start≤end<|s|; direction is 0 or 1.'),
435:('无重叠区间','Non-overlapping Intervals','删除最少区间，使剩余区间互不重叠；仅端点相接不算重叠。','Remove the fewest intervals so the remainder do not overlap; touching at endpoints is allowed.','1≤n≤100000；−50000≤start<end≤50000。','1≤n≤100000; −50000≤start<end≤50000.'),
452:('用最少数量的箭引爆气球','Minimum Number of Arrows to Burst Balloons','每个气球覆盖闭区间[start,end]，在任意实数位置射一箭会引爆包含该位置的所有气球。返回最少箭数。','Each balloon occupies an inclusive interval [start,end]. An arrow at any real position bursts every balloon containing it. Return the minimum arrows required.','1≤n≤100000；−2147483648≤start<end≤2147483647。','1≤n≤100000; −2147483648≤start<end≤2147483647.'),
253:('会议室 II','Meeting Rooms II','每场会议占用[start,end)，结束时刻可立即开始另一场。返回容纳所有会议所需最少会议室数。','Each meeting occupies [start,end); a room may be reused at its end time. Return the minimum number of rooms required.','1≤n≤10000；0≤start<end≤1000000。','1≤n≤10000; 0≤start<end≤1000000.'),
1288:('删除被覆盖区间','Remove Covered Intervals','若区间[l,r]被另一区间[u,v]满足u≤l且r≤v覆盖，就删除它；返回不被其他区间覆盖的区间数量。','An interval [l,r] is covered by another [u,v] if u≤l and r≤v. Return the number of intervals not covered by any other interval.','1≤n≤1000；0≤l<r≤100000；所有区间互不相同。','1≤n≤1000; 0≤l<r≤100000; all intervals are distinct.'),
1851:('包含每个查询的最小区间','Minimum Interval to Include Each Query','对每个查询q，返回包含它的最短闭区间长度right−left+1；不存在则−1。答案按查询输入顺序排列。','For each query q, return the smallest inclusive interval length right−left+1 containing q, or −1 if none exists. Preserve query order.','第一行区间数n、查询数m；随后n行left right，最后一行m个查询。1≤n,m≤100000；1≤left≤right≤10000000；查询值1..10000000。','First line interval count n and query count m; then n lines left right; final line m queries. 1≤n,m≤100000; 1≤left≤right≤10000000; queries 1..10000000.'),
2055:('蜡烛之间的盘子','Plates Between Candles','*表示盘子，|表示蜡烛。每次查询闭区间[l,r]，统计区间内左右都存在蜡烛的盘子数量。按查询顺序返回。','A * is a plate and a | is a candle. For each inclusive query [l,r], count plates that have candles on both sides within that range. Preserve query order.','第一行s，第二行查询数m，随后m行l r。3≤|s|≤100000；仅含*和|；1≤m≤100000；0≤l≤r<|s|。','First line s, second line query count m, then m lines l r. 3≤|s|≤100000; characters are * or |; 1≤m≤100000; 0≤l≤r<|s|.'),
2602:('使数组元素全部相等的最少操作次数','Minimum Operations to Make All Array Elements Equal','每次可将一个元素加一或减一。对每个独立查询q，返回将原数组所有值变为q的最少操作数；查询之间不保留修改。','Each operation increments or decrements one element. For each independent query q, return the minimum operations to turn all original values into q; queries do not retain changes.','1≤n,m≤100000；数组值和查询值均在1..1000000000。','1≤n,m≤100000; array values and queries are 1..1000000000.'),
34:('查找元素的第一个和最后一个位置','Find First and Last Position of Element in Sorted Array','在非递减数组中查找target的首次和末次位置，下标从0开始。不存在时返回[-1,-1]。','Find the first and last zero-based positions of target in a nondecreasing array, or [-1,-1] if absent.','0≤n≤100000；数组值与target均在−1000000000..1000000000；数组非递减。n=0时数组行为空。','0≤n≤100000; values and target are −1000000000..1000000000; the array is nondecreasing. For n=0 its line is empty.'),
81:('搜索旋转排序数组 II','Search in Rotated Sorted Array II','非递减数组经某个位置循环旋转，允许重复值。判断target是否存在。','A nondecreasing array has been cyclically rotated and may contain duplicates. Determine whether target occurs.','1≤n≤5000；数组值与target都在−10000..10000；保证数组为某个非递减数组的旋转。','1≤n≤5000; values and target are −10000..10000; the input is a rotation of a nondecreasing array.'),
74:('搜索二维矩阵','Search a 2D Matrix','矩阵每行非递减，且每行第一个元素严格大于上一行最后一个元素。判断target是否存在。','Each matrix row is nondecreasing, and its first value is strictly greater than the previous row’s last value. Determine whether target exists.','1≤rows,cols≤100；矩阵值和target在−10000..10000；满足题意的行间有序条件。','1≤rows,cols≤100; entries and target are −10000..10000; rows satisfy the stated ordering across row boundaries.'),
240:('搜索二维矩阵 II','Search a 2D Matrix II','矩阵每行从左到右、每列从上到下均非递减。判断target是否存在。','Every row and every column is nondecreasing. Determine whether target appears in the matrix.','1≤rows,cols≤300；矩阵值和target在−1000000000..1000000000；行列均非递减。','1≤rows,cols≤300; entries and target are −1000000000..1000000000; rows and columns are nondecreasing.'),
540:('有序数组中的单一元素','Single Element in a Sorted Array','非递减数组中只有一个值出现一次，其余每个值恰好出现两次。返回单一值。','In a nondecreasing array, exactly one value occurs once and every other value occurs twice. Return the singleton.','1≤n≤100000；值在0..100000；数组非递减，保证单一值唯一，其余值恰好出现两次。','1≤n≤100000; values are 0..100000; the array is nondecreasing with exactly one singleton and all other values occurring twice.'),
2300:('咒语和药水的成功对数','Successful Pairs of Spells and Potions','对每个咒语，统计与其乘积至少为success的药水数量。保留咒语输入顺序，重复药水分别计数。','For each spell, count potions whose product with it is at least success. Preserve spell order and count duplicate potions separately.','1≤n,m≤100000；咒语和药水值1..100000；1≤success≤10000000000。','1≤n,m≤100000; spell and potion values are 1..100000; 1≤success≤10000000000.'),
875:('爱吃香蕉的珂珂','Koko Eating Bananas','每小时只吃一堆，最多吃k根；该堆不足k根也消耗整小时。返回h小时内吃完所有香蕉的最小正整数速度k。','In each hour eat from one pile only, at most k bananas; finishing a smaller pile still consumes the hour. Return the smallest positive integer speed k finishing all piles within h hours.','1≤n≤10000；1≤piles[i]≤1000000000；n≤h≤1000000000。','1≤n≤10000; 1≤piles[i]≤1000000000; n≤h≤1000000000.'),
1011:('在D天内送达包裹的能力','Capacity To Ship Packages Within D Days','按原顺序装运包裹，每天总重量不能超过船的容量。返回days天内全部送达的最小容量。','Ship packages in their original order, with daily total weight bounded by capacity. Return the minimum capacity finishing within days.','1≤days≤n≤50000；包裹重量1..500。','1≤days≤n≤50000; weights are 1..500.'),
1482:('制作m束花所需的最少天数','Minimum Number of Days to Make m Bouquets','第i朵花在bloomDay[i]开放。每束需要k朵相邻且已开放的花，每朵只能用一次。返回做成m束的最早日期，不可能则−1。','Flower i blooms on bloomDay[i]. Each bouquet requires k adjacent bloomed flowers, using each flower at most once. Return the earliest day to make m bouquets, or −1 if impossible.','1≤n≤100000；开放日期1..1000000000；1≤m≤1000000；1≤k≤n。','1≤n≤100000; bloom dates are 1..1000000000; 1≤m≤1000000; 1≤k≤n.'),
1283:('使结果不超过阈值的最小除数','Find the Smallest Divisor Given a Threshold','每个数除以正整数除数并向上取整，将结果求和。返回使总和不超过threshold的最小除数。','Divide each value by a positive integer divisor, round upward, and sum. Return the smallest divisor whose sum does not exceed threshold.','1≤n≤50000；值1..1000000；n≤threshold≤1000000。','1≤n≤50000; values are 1..1000000; n≤threshold≤1000000.'),
1760:('袋子里最少数目的球','Minimum Limit of Balls in a Bag','每次将一个袋子分成两个非空袋子，最多操作maxOperations次。返回能达到的最小最大袋子球数。','An operation splits one bag into two nonempty bags. With at most maxOperations operations, minimize the maximum number of balls in any bag.','1≤n≤100000；袋子球数与maxOperations均在1..1000000000。','1≤n≤100000; bag sizes and maxOperations are 1..1000000000.'),
2187:('完成旅途的最少时间','Minimum Time to Complete Trips','车辆可同时运行，车i每次行程耗时time[i]，完成后立即再出发。返回累计完成totalTrips次完整行程的最少时间。','Vehicles run concurrently; vehicle i takes time[i] per trip and restarts immediately. Return the minimum time to complete totalTrips whole trips in total.','1≤n≤100000；time[i]和totalTrips在1..10000000。','1≤n≤100000; time[i] and totalTrips are 1..10000000.'),
2226:('每个小孩最多能分到多少糖果','Maximum Candies Allocated to K Children','每堆可拆分但不能合并。给k个孩子各分一堆等量糖果，允许剩余糖果，返回每人最多数量；无法每人得到一颗则0。','Piles may be split but not merged. Give each of k children one pile of equal size, allowing leftovers. Return the maximum per-child amount, or 0 if one candy each is impossible.','1≤n≤100000；candies[i]在1..10000000；1≤k≤1000000000000。','1≤n≤100000; candies[i] is 1..10000000; 1≤k≤1000000000000.'),
1898:('可移除字符的最大数目','Maximum Number of Removable Characters','按removable给出的顺序删除s的原始下标，求最多删除前k个后p仍是子序列的k。删除不改变其他下标的含义。','Remove original indices of s in the order given by removable. Return the largest prefix length k of removals after which p remains a subsequence. Indices always refer to the original s.','前两行s和p，第三行删除下标数m，第四行m个整数。1≤|p|≤|s|≤100000；均为小写；p原本是s子序列；0≤m<|s|；下标互异且在0..|s|−1，m=0时第四行为空。','First two lines s and p; third line removal count m; fourth line m indices. 1≤|p|≤|s|≤100000; both lowercase; p is initially a subsequence; 0≤m<|s|; distinct indices are in 0..|s|−1. The fourth line is empty when m=0.'),
410:('分割数组的最大值','Split Array Largest Sum','把数组切为恰好k个非空连续子数组，最小化各段和的最大值。','Split the array into exactly k nonempty contiguous subarrays and minimize the largest subarray sum.','1≤n≤1000；值0..1000000；1≤k≤min(50,n)。','1≤n≤1000; values are 0..1000000; 1≤k≤min(50,n).'),
1552:('两球之间的磁力','Magnetic Force Between Two Balls','在互不相同的位置中选择m个放球，最大化任意两球距离的最小值。','Choose m distinct available positions for balls and maximize the minimum distance between any two balls.','2≤n≤100000；位置1..1000000000且互不相同；2≤m≤n。','2≤n≤100000; positions are distinct and in 1..1000000000; 2≤m≤n.'),
378:('有序矩阵中第K小的元素','Kth Smallest Element in a Sorted Matrix','矩阵每行每列非递减，返回按值排序后的第k个元素，重复元素占不同名次。','Rows and columns are nondecreasing. Return the kth element in sorted order; duplicate entries occupy separate ranks.','rows=cols，1≤rows≤300；值在−1000000000..1000000000；行列非递减；1≤k≤rows²。','rows=cols, 1≤rows≤300; entries are −1000000000..1000000000; rows and columns are nondecreasing; 1≤k≤rows².'),
719:('找出第K小的数对距离','Find K-th Smallest Pair Distance','对每对不同下标i<j计算绝对差，排序后返回第k小距离，重复距离分别计数。','Compute absolute differences for all pairs of distinct indices i<j, and return the kth smallest distance, counting repeated distances separately.','2≤n≤10000；值0..1000000；1≤k≤n(n−1)/2。','2≤n≤10000; values are 0..1000000; 1≤k≤n(n−1)/2.'),
}

def make(p):
 zh,en,dz,de,iz,ie=META[p]
 if p in INTERVAL:iz='第一行n，随后n行，每行两个端点。'+iz;ie='First line n, then n rows of two endpoints. '+ie
 elif p in MATRIX:iz='第一行rows cols '+('k' if p==378 else 'target')+'，随后rows行各cols个整数。'+iz;ie='First line rows cols '+('k' if p==378 else 'target')+', then rows lines with cols integers each. '+ie
 elif p in {2602,2300}:
  iz='第一行n m；第二行n个'+('咒语' if p==2300 else '数组值')+'；第三行m个'+('药水' if p==2300 else '查询')+'。'+('第四行success。' if p==2300 else '')+iz
  ie='First line n m; second line n '+('spells' if p==2300 else 'array values')+'; third line m '+('potions' if p==2300 else 'queries')+'. '+('Fourth line success. ' if p==2300 else '')+ie
 elif p not in {1109,1094,370,2381,1851,2055,1898}:
  tail={2090:'k',34:'target',81:'target',875:'h',1011:'days',1482:'m k',1283:'threshold',1760:'maxOperations',2187:'totalTrips',2226:'k',410:'k',1552:'m',719:'k'}.get(p)
  iz='第一行n，第二行n个整数。'+('第三行'+tail+'。' if tail else '')+iz;ie='First line n; second line n integers. '+('Third line '+tail+'. ' if tail else '')+ie
 k='string' if p==2381 else 'integer-array' if p in ARRAY else 'integer'
 if k=='string':oz='输出结果字符串原文和换行，不加引号。';oe='Print the raw result string followed by a newline, without quotes.';emit='print(result)'
 elif k=='integer-array':oz='第一行输出元素个数，随后按题目规定顺序输出所有整数，用空白分隔。';oe='Print the count on the first line, then all integers in the required order, separated by whitespace.';emit="print(len(result));print(*result) if result else None"
 else:oz='输出一个整数。'+('真为1，假为0。' if p in {1094,81,74,240} else '');oe='Print one integer.'+(' Use 1 for true and 0 for false.' if p in {1094,81,74,240} else '');emit='print(result)'
 return dict(method=METHODS[p],titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='中等',resultKind=k,outputLimit={2090:512,1109:256,370:1024,1851:1024,2055:1024,2602:2048,2300:1024}.get(p,64),edges=EDGE[p],pressure=PRESSURE[p],random_args=lambda r:random_args(p,r),oracle=lambda a:oracle(p,a),validate=lambda a:validate(p,a),encode=lambda a:encode(p,a),parse=parse(p),mutants=[dict(name=name,source='import sys,itertools,bisect,math\n'+parse(p)+'\nx=args[0]\n'+body+'\n'+emit+'\n') for name,body in WRONG[p]])

EDGE[240].append([[[1,4],[2,5]],4])
EDGE[719].append([[0,1,2],2])
PROBLEMS={p:make(p) for p in IDS}
