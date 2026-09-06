"""Second authored DP batch: exhaustive oracles; no downloaded code executed."""
import itertools
import math
from collections import Counter,deque
from functools import lru_cache
MOD=1000000007
IDS=[45,55,97,122,123,139,188,264,309,486,516,647,714,740,790,918,931,983,1014,1035,1043,1130,1140,1186,1191,1262,1277,1289,1690,1937]


def oracle(pid,a):
 x=a[0]
 if pid in (45,55):
  q=deque([(0,0)]);seen={0}
  while q:
   i,d=q.popleft()
   if i==len(x)-1:return d if pid==45 else 1
   for j in range(i+1,min(len(x),i+x[i]+1)):
    if j not in seen:seen.add(j);q.append((j,d+1))
  return 0 if pid==55 else -1
 if pid==97:
  x,y,z=a
  if len(x)+len(y)!=len(z):return 0
  return int(any(''.join(x[i] if c else y[j] for c,i,j in steps)==z for steps in interleavings(x,y)))
 if pid in (122,123,188,309,714):
  prices=a[1] if pid==188 else x;cap=a[0] if pid==188 else 2 if pid==123 else len(prices)
  fee=a[1] if pid==714 else 0
  def play(day,held,sales,blocked):
   if day==len(prices):return -10**12 if held else 0
   options=[play(day+1,held,sales,False)]
   if held and sales<cap:options.append(prices[day]-fee+play(day+1,False,sales+1,pid==309))
   if not held and not blocked and sales<cap:options.append(-prices[day]+play(day+1,True,sales,False))
   return max(options)
  return play(0,False,0,False)
 if pid==139:
  def split(i):return i==len(x) or any(x.startswith(w,i) and split(i+len(w)) for w in a[1])
  return int(split(0))
 if pid==264:
  count=n=0
  while count<x:
   n+=1;k=n
   for p in (2,3,5):
    while k%p==0:k//=p
   if k==1:count+=1
  return n
 if pid==486:
  def game(v):return v[0] if len(v)==1 else max(v[0]-game(v[1:]),v[-1]-game(v[:-1]))
  return int(game(x)>=0)
 if pid==516:
  return max(len(s) for mask in range(1<<len(x)) for s in [''.join(x[i] for i in range(len(x)) if mask>>i&1)] if s==s[::-1])
 if pid==647:return sum(x[i:j]==x[i:j][::-1] for i in range(len(x)) for j in range(i+1,len(x)+1))
 if pid==740:
  values=sorted(set(x));c=Counter(x)
  return max(sum(v*c[v] for i,v in enumerate(values) if mask>>i&1) for mask in range(1<<len(values)) if all(not(mask>>i&1 and mask>>j&1) or abs(v-w)!=1 for i,v in enumerate(values) for j,w in enumerate(values) if i<j))
 if pid==790:
  cells=frozenset((r,c) for r in range(2) for c in range(x));shapes=set()
  for r,c in cells:
   for other in ((r+1,c),(r,c+1)):
    tile=frozenset(((r,c),other))
    if tile<=cells:shapes.add(tile)
   square={(r,c),(r+1,c),(r,c+1),(r+1,c+1)}
   for missing in square:
    tile=frozenset(square-{missing})
    if tile<=cells:shapes.add(tile)
  def tile(remaining):
   if not remaining:return 1
   first=min(remaining)
   return sum(tile(remaining-s) for s in shapes if first in s and s<=remaining)
  return tile(cells)%MOD
 if pid in (918,1186,1191):
  if pid==1191:
   v=x*a[1];return max([0]+[sum(v[i:j]) for i in range(len(v)) for j in range(i+1,len(v)+1)])%MOD
  if pid==918:return max(sum((x+x)[i:i+k]) for i in range(len(x)) for k in range(1,len(x)+1))
  return max(sum(x[i:j])-(x[k] if k is not None else 0) for i in range(len(x)) for j in range(i+1,len(x)+1) for k in [None]+(list(range(i,j)) if j-i>1 else []))
 if pid in (931,1289,1937):
  m,n=len(x),len(x[0]);scores=[]
  for path in itertools.product(range(n),repeat=m):
   if pid==931 and any(abs(u-v)>1 for u,v in zip(path,path[1:])):continue
   if pid==1289 and any(u==v for u,v in zip(path,path[1:])):continue
   score=sum(x[i][c] for i,c in enumerate(path))
   if pid==1937:score-=sum(abs(u-v) for u,v in zip(path,path[1:]))
   scores.append(score)
  return max(scores) if pid==1937 else min(scores)
 if pid==983:
  def buy(i):
   if i==len(x):return 0
   return min(c+buy(next((j for j in range(i,len(x)) if x[j]>=x[i]+d),len(x))) for c,d in zip(a[1],(1,7,30)))
  return buy(0)
 if pid==1014:return max(x[i]+x[j]+i-j for i in range(len(x)) for j in range(i+1,len(x)))
 if pid==1035:
  def subseq(v):return {tuple(v[i] for i in range(len(v)) if mask>>i&1) for mask in range(1<<len(v))}
  return max(map(len,subseq(x)&subseq(a[1])))
 if pid==1043:
  def split(i):return 0 if i==len(x) else max(max(x[i:j])*(j-i)+split(j) for j in range(i+1,min(i+a[1],len(x))+1))
  return split(0)
 if pid==1130:
  def tree(v):
   if len(v)==1:return [0]
   return [l+r+max(v[:k])*max(v[k:]) for k in range(1,len(v)) for l in tree(v[:k]) for r in tree(v[k:])]
  return min(tree(x))
 if pid==1140:
  def game(v,m):return 0 if not v else max(sum(v[:k])+sum(v[k:])-game(v[k:],max(m,k)) for k in range(1,min(2*m,len(v))+1))
  return game(x,1)
 if pid==1262:return max(sum(x[i] for i in range(len(x)) if mask>>i&1) for mask in range(1<<len(x)) if sum(x[i] for i in range(len(x)) if mask>>i&1)%3==0)
 if pid==1277:return sum(all(x[r][c] for r in range(i,i+k) for c in range(j,j+k)) for i in range(len(x)) for j in range(len(x[0])) for k in range(1,min(len(x)-i,len(x[0])-j)+1))
 if pid==1690:
  def game(v):return 0 if len(v)==1 else max(sum(v[1:])-game(v[1:]),sum(v[:-1])-game(v[:-1]))
  return game(x)
 raise ValueError(pid)


def interleavings(x,y):
 # Enumerate all choices of source positions, preserving each source's order.
 for positions in itertools.combinations(range(len(x)+len(y)),len(x)):
  chosen=set(positions);i=j=0;steps=[]
  for k in range(len(x)+len(y)):
   steps.append((k in chosen,i,j))
   if k in chosen:i+=1
   else:j+=1
  yield steps

KIND={pid:'array' for pid in IDS}
KIND.update({97:'three-strings',139:'dictionary',188:'k-array',264:'scalar',516:'string',647:'string',714:'array-k',790:'scalar',931:'grid',983:'tickets',1035:'two-arrays',1043:'array-k',1191:'array-k',1277:'grid',1289:'grid',1937:'grid'})

def encode(pid,a):
 kind=KIND[pid]
 if kind=='scalar':return str(a[0])+'\n'
 if kind in ('string','three-strings'):return '\n'.join(a)+'\n'
 if kind=='dictionary':return a[0]+'\n'+str(len(a[1]))+'\n'+'\n'.join(a[1])+'\n'
 if kind=='grid':return f'{len(a[0])} {len(a[0][0])}\n'+'\n'.join(' '.join(map(str,row)) for row in a[0])+'\n'
 if kind=='tickets':return str(len(a[0]))+'\n'+' '.join(map(str,a[0]))+'\n'+' '.join(map(str,a[1]))+'\n'
 if kind=='two-arrays':return f'{len(a[0])} {len(a[1])}\n'+' '.join(map(str,a[0]))+'\n'+' '.join(map(str,a[1]))+'\n'
 nums=a[1] if kind=='k-array' else a[0];k=a[0] if kind=='k-array' else a[1] if kind=='array-k' else None
 return str(len(nums))+(' '+str(k) if k is not None else '')+'\n'+' '.join(map(str,nums))+'\n'

def parse(pid):
 kind=KIND[pid]
 if kind=='scalar':return 'args=[int(sys.stdin.read())]'
 if kind in ('string','three-strings'):return "args=[sys.stdin.readline().rstrip('\\r\\n') for _ in range("+str(3 if kind=='three-strings' else 1)+")]"
 if kind=='dictionary':return "s=sys.stdin.readline().strip();n=int(sys.stdin.readline());args=[s,[sys.stdin.readline().strip() for _ in range(n)]]"
 if kind=='grid':return 'm,n=map(int,sys.stdin.readline().split());args=[[list(map(int,sys.stdin.readline().split())) for _ in range(m)]];assert all(len(row)==n for row in args[0])'
 if kind=='tickets':return 'n=int(sys.stdin.readline());args=[list(map(int,sys.stdin.readline().split())),list(map(int,sys.stdin.readline().split()))];assert len(args[0])==n and len(args[1])==3'
 if kind=='two-arrays':return 'm,n=map(int,sys.stdin.readline().split());args=[list(map(int,sys.stdin.readline().split())),list(map(int,sys.stdin.readline().split()))];assert len(args[0])==m and len(args[1])==n'
 return 'v=list(map(int,sys.stdin.read().split()));assert len(v)==v[0]+'+('1;args=[v[1:]]' if kind=='array' else '2;args='+('[v[1],v[2:]]' if kind=='k-array' else '[v[2:],v[1]]'))


def random_args(pid,r):
 n=r.randint(2 if pid in (1014,1130,1690) else 1,8)
 if pid in (45,55):return [[r.randint(1 if pid==45 else 0,4) for _ in range(n)]]
 if pid==97:
  a=[''.join(r.choices('ab',k=r.randint(0,4))) for _ in range(2)]
  return a+[''.join(r.choices('ab',k=len(a[0])+len(a[1])))]
 if pid==139:return [''.join(r.choices('ab',k=n)),r.sample(['a','b','ab','ba','aa','bb','aaa'],r.randint(1,7))]
 if pid in (264,790):return [r.randint(1,20 if pid==264 else 6)]
 if pid in (516,647):return [''.join(r.choices('abc',k=n))]
 if KIND[pid]=='grid':
  m=r.randint(1,4);n=m if pid in (931,1289) else r.randint(1,4)
  return [[[r.randint(-5 if pid in (931,1289) else 0,1 if pid==1277 else 8) for _ in range(n)] for _ in range(m)]]
 if pid==983:return [sorted(r.sample(range(1,60),n)),[r.randint(1,20) for _ in range(3)]]
 if pid==1035:return [[r.randint(1,4) for _ in range(n)],[r.randint(1,4) for _ in range(r.randint(1,8))]]
 values=[r.randint(-8 if pid in (918,1186,1191) else 0 if pid in (122,123,188,309,486,1043) else 1,15) for _ in range(n)]
 if pid==188:return [r.randint(1,4),values]
 if pid in (714,1043,1191):return [values,r.randint(0 if pid==714 else 1,5 if pid!=1043 else n)]
 return [values]

EDGES={
45:[[[2,3,1,1,4]],[[0]],[[1,0]],[[2,0,0]],[[1,2,0,1]]],
55:[[[2,3,1,1,4]],[[3,2,1,0,4]],[[0]],[[1,0,1]],[[2,0,0]]],
97:[['aabcc','dbbca','aadbbcbcac'],['','',''],['a','b','ba'],['ab','cd','adbc'],['a','b','a'],['aabcc','dbbca','aadbbbaccc']],
122:[[[7,1,5,3,6,4]],[[1]],[[4,3,2,1]],[[1,2,1,2,1,2]]],
123:[[[3,3,5,0,0,3,1,4]],[[1]],[[1,2,1,2,1,2]],[[5,4,3]]],
139:[['leetcode',['leet','code']],['applepenapple',['apple','pen']],['catsandog',['cats','dog','sand','and','cat']],['aaaaaaa',['aaaa','aaa']],['aaaaaa',['aaaa','aaa']],['ab',['a','ba']]],
188:[[2,[2,4,1]],[1,[1]],[1,[1,2,1,2]],[2,[3,2,6,5,0,3]]],
264:[[10],[1],[2],[11]],309:[[[1,2,3,0,2]],[[1]],[[1,2,1,2]],[[3,2,1]]],
486:[[[1,5,2]],[[1,5,233,7]],[[0]],[[1,1]],[[1,0,0]]],
516:[['bbbab'],['a'],['cbbd'],['abc'],['agbdba']],647:[['abc'],['aaa'],['a'],['abba'],['ababa']],
714:[[[1,3,2,8,4,9],2],[[1],0],[[1,3,2,4],2],[[2,2,2],1]],
740:[[[3,4,2]],[[2,2,3,3,3,4]],[[1]],[[1,3,5]],[[1,1,1,2,3]]],
790:[[3],[1],[2],[4],[6]],918:[[[1,-2,3,-2]],[[5,-3,5]],[[-3,-2,-3]],[[0]],[[3,-1,2,-1]]],
931:[[[[2,1,3],[6,5,4],[7,8,9]]],[[[-19,57],[-40,-5]]],[[[0]]]],
983:[[[1,4,6,7,8,20],[2,7,15]],[[1],[10,1,10]],[[1,8],[2,3,10]],[[1,7,8],[2,3,10]]],
1014:[[[8,1,5,2,6]],[[1,2]],[[1,1,1]],[[1,10,1,1,10]]],
1035:[[[1,4,2],[1,2,4]],[[1],[2]],[[1,1],[1]],[[1,2,3],[3,2,1]]],
1043:[[[1,15,7,9,2,5,10],3],[[0],1],[[1,2,3],1],[[1,9,1],3]],
1130:[[[6,2,4]],[[1,1]],[[15,1,15]],[[7,12,8,10]]],
1140:[[[2,7,9,4,4]],[[1]],[[1,2,3,4,5,100]],[[1,1,1,1,1]]],
1186:[[[1,-2,0,3]],[[-1,-1,-1]],[[-5]],[[1,-2,-2,3]],[[0,0]]],
1191:[[[1,2],3],[[1,-2,1],5],[[-1,-2],7],[[0],1],[[2,-1,2],2]],
1262:[[[3,6,5,1,8]],[[4]],[[1,2,3,4,4]],[[1,1,1]],[[2,2]]],
1277:[[[[0,1,1,1],[1,1,1,1],[0,1,1,1]]],[[[0]]],[[[1]]],[[[1,1],[1,1]]]],
1289:[[[[1,2,3],[4,5,6],[7,8,9]]],[[[7]]],[[[1,9],[1,9]]],[[[-1,-2],[-3,-4]]]],
1690:[[[5,3,1,4,2]],[[1,1]],[[1,2,3]],[[7,90,5,1,100,10,10,2]]],
1937:[[[[1,2,3],[1,5,1],[3,1,1]]],[[[0]]],[[[5,0],[0,5]]],[[[1],[2],[3]]]],
}

def tiling_count(n):
 # Frontier counting reduces to T(n)=2*T(n-1)+T(n-3); small boards are
 # independently exhaustively tiled by oracle(). Large recurrence is modulo M.
 t=[1,1,2]
 for k in range(3,n+1):t.append((2*t[-1]+t[-3])%MOD)
 return t[n]

PRESSURE={
45:[([[1]*10000],9999),([[1000]*10000],10)],
55:[([[1]*10000],1),([[1]*9998+[0,1]],0)],
97:[(['a'*100,'b'*100,'ab'*100],1),(['a'*100,'b'*100,'a'*199+'b'],0)],
122:[([[0,10000]*15000],150000000),([[10000]*30000],0)],
123:[([[0,100000]*50000],200000),([[100000]*100000],0)],
139:[(['a'*300,['a']],1),(['a'*299+'b',['a'*i for i in range(1,21)]],0)],
188:[([100,[0,1000]*500],100000),([1,[1000]*1000],0)],
264:[([1690],2123366400),([1689],2109375000)],
309:[([[0,1000]*2500],1250000),([[1000]*5000],0)],
486:[([[10000000]*20],1),([[10000000]*19],1)],
516:[(['a'*1000],1000),(['a'*500+'b'*500],500)],
647:[(['a'*1000],500500),(['ab'*500],250500)],
714:[([[1,49999]*25000,1],1249925000),([[49999]*50000,49999],0)],
740:[([[10000]*20000],200000000),([[9999,10000]*10000],100000000)],
790:[([1000],tiling_count(1000)),([999],tiling_count(999))],
918:[([[30000]*30000],900000000),([[-30000]*30000],-30000)],
931:[([[[-100]*100 for _ in range(100)]],-10000),([[[100]*100 for _ in range(100)]],10000)],
983:[([list(range(1,366)),[1,1000,1000]],365),([list(range(1,366)),[1,1,1]],13)],
1014:[([[1000]*50000],1999),([[1000]+[1]*49998+[1000]],1000)],
1035:[([[2000]*500,[2000]*500],500),([[1]*500,[2]*500],0)],
1043:[([[4000000]*500,500],2000000000),([[0]*500,1],0),([[1000000000,1],1],1000000001)],
1130:[([[15]*40],8775),([[1]*40],39)],
1140:[([[10000]*100],500000),([[1]*100],50)],
1186:[([[10000]*100000],1000000000),([[-10000]*100000],-10000)],
1191:[([[10000]*100000,100000],(10**14)%MOD),([[-10000]*100000,100000],0)],
1262:[([[9999]*40000],399960000),([[10000]*40000],399990000)],
1277:[([[[1]*300 for _ in range(300)]],300*301*601//6),([[[0]*300 for _ in range(300)]],0)],
1289:[([[[-99]*200 for _ in range(200)]],-19800),([[[99]*200 for _ in range(200)]],19800)],
1690:[([[1000]*1000],500000),([[1]*999],499)],
1937:[([[[100000]*200 for _ in range(500)]],50000000),([[[100000]+[0]*49999,[0]*49999+[100000]]],150001),([[[100000] for _ in range(100000)]],10000000000)],
}

ARRAY_LIMITS={45:(1,10000,0,1000),55:(1,10000,0,100000),122:(1,30000,0,10000),123:(1,100000,0,100000),309:(1,5000,0,1000),486:(1,20,0,10000000),714:(1,50000,1,49999),740:(1,20000,1,10000),918:(1,30000,-30000,30000),1014:(2,50000,1,1000),1043:(1,500,0,1000000000),1130:(2,40,1,15),1140:(1,100,1,10000),1186:(1,100000,-10000,10000),1191:(1,100000,-10000,10000),1262:(1,40000,1,10000),1690:(2,1000,1,1000)}

def validate(pid,a):
 def ints(v,lo,hi):assert all(type(k)is int and lo<=k<=hi for k in v)
 def lower(s,lo,hi):assert type(s)is str and lo<=len(s)<=hi and all('a'<=c<='z' for c in s)
 kind=KIND[pid];assert type(a)is list and len(a)==(3 if pid==97 else 2 if kind in ('array-k','k-array','tickets','dictionary','two-arrays') else 1)
 x=a[0]
 if pid in ARRAY_LIMITS:
  lo,hi,mn,mx=ARRAY_LIMITS[pid];assert type(x)is list and lo<=len(x)<=hi;ints(x,mn,mx)
  if pid==45:
   far=0
   for i,v in enumerate(x):assert i<=far;far=max(far,i+v)
  if pid==714:ints(a[1:],0,49999)
  if pid==1191:ints(a[1:],1,100000)
  if pid==1043:
   ints(a[1:],1,len(x));dp=[0]*(len(x)+1)
   for i in range(1,len(x)+1):
    high=0
    for j in range(i-1,max(-1,i-a[1]-1),-1):high=max(high,x[j]);dp[i]=max(dp[i],dp[j]+high*(i-j))
   assert dp[-1]<=2147483647
 elif pid==188:ints([x],1,100);assert 1<=len(a[1])<=1000;ints(a[1],0,1000)
 elif pid==97:
  for i,s in enumerate(a):lower(s,0,200 if i==2 else 100)
 elif pid==139:
  lower(x,1,300);assert type(a[1])is list and 1<=len(a[1])<=1000 and len(set(a[1]))==len(a[1])
  for w in a[1]:lower(w,1,20)
 elif pid in (264,790):ints(a,1,1690 if pid==264 else 1000)
 elif pid in (516,647):lower(x,1,1000)
 elif kind=='grid':
  assert type(x)is list and x and type(x[0])is list and x[0];m,n=len(x),len(x[0]);assert all(len(row)==n for row in x)
  if pid==1937:assert m*n<=100000
  elif pid in (931,1289):assert m==n and n<=(100 if pid==931 else 200)
  else:assert m<=300 and n<=300
  mn,mx={931:(-100,100),1277:(0,1),1289:(-99,99),1937:(0,100000)}[pid]
  for row in x:ints(row,mn,mx)
 elif pid==983:
  assert 1<=len(x)<=365 and x==sorted(set(x));ints(x,1,365);assert len(a[1])==3;ints(a[1],1,1000)
 elif pid==1035:
  for v in a:assert 1<=len(v)<=500;ints(v,1,2000)
 else:raise ValueError(pid)
 return True

MISTAKES={
45:('uses the first jump as the number of jumps','print(args[0][0])'),
55:('rejects any zero, including a reachable final zero','print(int(0 not in args[0]))'),
97:('checks only character counts and ignores source ordering',"print(int(sorted(args[0]+args[1])==sorted(args[2])))"),
122:('allows only one transaction',"a=args[0];print(max([0]+[a[j]-a[i] for i in range(len(a)) for j in range(i+1,len(a))]))"),
123:('permits unlimited transactions','a=args[0];print(sum(max(0,v-u) for u,v in zip(a,a[1:])))'),
139:('greedily chooses longest matching dictionary word',"s,words=args;i=0\nwhile i<len(s):\n    found=sorted([w for w in words if s.startswith(w,i)],key=len,reverse=True)\n    if not found:break\n    i+=len(found[0])\nprint(int(i==len(s)))"),
188:('ignores the transaction limit','a=args[1];print(sum(max(0,v-u) for u,v in zip(a,a[1:])))'),
264:('counts only multiples of two three or five','n=args[0];v=1;count=1\nwhile count<n:\n    v+=1\n    if v%2==0 or v%3==0 or v%5==0:count+=1\nprint(v)'),
309:('ignores the cooldown day','a=args[0];print(sum(max(0,v-u) for u,v in zip(a,a[1:])))'),
486:('assumes player one can select the larger parity sum','a=args[0];print(int(max(sum(a[::2]),sum(a[1::2]))*2>=sum(a)))'),
516:('finds palindromic substrings instead of subsequences',"s=args[0];print(max(j-i for i in range(len(s)) for j in range(i+1,len(s)+1) if s[i:j]==s[i:j][::-1]))"),
647:('deduplicates palindromes with the same characters',"s=args[0];print(len({s[i:j] for i in range(len(s)) for j in range(i+1,len(s)+1) if s[i:j]==s[i:j][::-1]}))"),
714:('ignores transaction fees','a=args[0];print(sum(max(0,v-u) for u,v in zip(a,a[1:])))'),
740:('collects only one distinct value','a=args[0];print(max(v*a.count(v) for v in set(a)))'),
790:('allows dominoes but omits trominoes','a,b=1,1\nfor _ in range(args[0]):a,b=b,a+b\nprint(a)'),
918:('does not allow wrapping around the array','a=args[0];best=cur=a[0]\nfor v in a[1:]:cur=max(v,cur+v);best=max(best,cur)\nprint(best)'),
931:('takes each row minimum without checking adjacent columns','print(sum(map(min,args[0])))'),
983:('buys only one-day tickets','print(len(args[0])*args[1][0])'),
1014:('omits the distance penalty','print(sum(sorted(args[0])[-2:]))'),
1035:('ignores crossing and counts matching multisets','print(sum((collections.Counter(args[0])&collections.Counter(args[1])).values()))'),
1043:('treats the partition bound as unlimited','print(len(args[0])*max(args[0]))'),
1130:('merges leaves left to right','a=args[0];top=a[0];cost=0\nfor v in a[1:]:cost+=top*v;top=max(top,v)\nprint(cost)'),
1140:('always takes the maximum available piles','a=args[0];m=1;i=0;turn=0;total=0\nwhile i<len(a):\n    k=min(2*m,len(a)-i)\n    if turn==0:total+=sum(a[i:i+k])\n    i+=k;m=max(m,k);turn=1-turn\nprint(total)'),
1186:('allows deleting the sole element and returning empty sum','a=args[0];print(max([0]+[sum(a[i:j])-min(0,min(a[i:j])) for i in range(len(a)) for j in range(i+1,len(a)+1)]))'),
1191:('multiplies single-copy maximum even when copies contain negative separators','a,k=args;print(max([0]+[sum(a[i:j]) for i in range(len(a)) for j in range(i+1,len(a)+1)])*k%1000000007)'),
1262:('keeps only individually divisible elements','print(sum(v for v in args[0] if v%3==0))'),
1277:('counts only single-cell squares','print(sum(map(sum,args[0])))'),
1289:('takes row minima even in the same column','print(sum(map(min,args[0])))'),
1690:('scores the removed stone instead of the remaining sum','print(sum(args[0]))'),
1937:('ignores the column-change penalty','print(sum(map(max,args[0])))'),
}

META={
45:('jump','跳跃游戏 II','Jump Game II','从下标0出发，在下标i可向右跳1至nums[i]格。保证能到末尾，求到最后下标的最少跳跃次数。','Starting at index 0, jump right by 1 through nums[i] positions from index i. The final index is reachable; return the fewest jumps.'),
55:('canJump','跳跃游戏','Jump Game','从下标0出发，在下标i可向右跳1至nums[i]格。能到达最后下标输出1，否则0。','From index 0, jump right by 1 through nums[i] positions. Return 1 if the last index is reachable, otherwise 0.'),
97:('isInterleave','交错字符串','Interleaving String','将s1和s2所有字符交错合并，各自内部顺序不变，能否恰好得到s3？是输出1，否则0。','Can all characters of s1 and s2 be interleaved to form exactly s3 while preserving each source order? Print 1 for yes, 0 for no.'),
122:('maxProfit','买卖股票的最佳时机 II','Best Time to Buy and Sell Stock II','prices为逐日股价，可进行任意次买入后卖出交易，同时最多持有一股，求最大利润，可不交易。','Given daily prices, maximize profit using any number of buy-then-sell transactions while holding at most one share. Trading is optional.'),
123:('maxProfit','买卖股票的最佳时机 III','Best Time to Buy and Sell Stock III','逐日股价已知，最多完成两次买入后卖出交易，同时最多持有一股，求最大利润，可不交易。','Maximize profit from at most two buy-then-sell transactions on the daily prices. Hold at most one share; trading is optional.'),
139:('wordBreak','单词拆分','Word Break','能否把s完整分段，每段都是字典中的一个词？词可以重复使用，是输出1，否则0。','Can s be completely segmented into dictionary words? Words may be reused. Print 1 for yes, 0 for no.'),
188:('maxProfit','买卖股票的最佳时机 IV','Best Time to Buy and Sell Stock IV','给定逐日股价，最多完成k次买入后卖出交易，同时最多持有一股，求最大利润。','Maximize profit using at most k buy-then-sell transactions on daily prices, holding at most one share.'),
264:('nthUglyNumber','丑数 II','Ugly Number II','只含质因子2、3、5的正整数称为丑数，1也算。按从小到大返回第n个。','A positive integer whose prime factors are only 2, 3, and 5 is ugly; 1 is included. Return the nth smallest ugly number.'),
309:('maxProfit','买卖股票的最佳时机含冷冻期','Best Time to Buy and Sell Stock with Cooldown','可任意次交易，同时最多持有一股；卖出后的下一天不能买入。求最大利润。','Maximize profit with any number of transactions and at most one held share. Buying is forbidden on the day immediately after a sale.'),
486:('predictTheWinner','预测赢家','Predict the Winner','两人轮流取数组左端或右端一个数并计入自己得分，双方最优。先手最终得分至少与后手相同则输出1，否则0。','Two optimal players alternate taking and scoring one element from either end. Return 1 if the first player can finish with at least the second player’s score; otherwise 0.'),
516:('longestPalindromeSubseq','最长回文子序列','Longest Palindromic Subsequence','删除任意字符但保持顺序，求可得到的最长回文序列长度。','Find the maximum palindrome length obtainable by deleting characters without reordering.'),
647:('countSubstrings','回文子串','Palindromic Substrings','统计非空连续回文子串数。起点或终点不同分别计数，即使内容相同。','Count nonempty contiguous palindromic substrings. Different start or end positions count separately even when their text matches.'),
714:('maxProfit','买卖股票的最佳时机含手续费','Best Time to Buy and Sell Stock with Transaction Fee','逐日股价已知，可多次交易，同时最多持有一股。每笔完整买卖收取一次fee，求最大利润。','Maximize profit using repeated transactions while holding at most one share. Charge fee once per completed buy/sell transaction.'),
740:('deleteAndEarn','删除并获得点数','Delete and Earn','每次选一个值x获得x分并移除该元素，同时移除所有值为x-1和x+1的元素。可重复操作，求最高总分。','Choose an element x, earn x points, and remove it plus every element valued x−1 or x+1. Repeat optionally to maximize total points.'),
790:('numTilings','多米诺和托米诺平铺','Domino and Tromino Tiling','用1×2多米诺和L形三格骨牌无重叠地铺满2×n板，允许旋转。按占据格子划分不同计数，答案模1000000007。','Tile a 2 by n board without overlap using 1 by 2 dominoes and L-shaped three-cell trominoes, allowing rotations. Distinct cell partitions count separately; return the count modulo 1000000007.'),
918:('maxSubarraySumCircular','环形子数组的最大和','Maximum Sum Circular Subarray','数组首尾相接，求非空连续片段的最大和；一个片段不能重复使用任何位置。','In a circular array, maximize the sum of a nonempty contiguous segment without visiting any position twice.'),
931:('minFallingPathSum','下降路径最小和','Minimum Falling Path Sum','从首行任意列出发，每行取一格，下一行列号只能相同或相差1。求到末行的最小路径和。','Start in any first-row column and select one cell per row. Each next column must differ by at most one. Minimize the path sum through the last row.'),
983:('mincostTickets','最低票价','Minimum Cost for Tickets','days列出需要出行的日期。1、7、30天票价依次为costs，购票当天起连续有效，求覆盖全部出行日的最低总价。','days lists travel dates. costs gives prices for passes valid for 1, 7, or 30 consecutive days starting on purchase. Minimize total cost covering every travel day.'),
1014:('maxScoreSightseeingPair','最佳观光组合','Best Sightseeing Pair','选择两个下标i<j，最大化 values[i]+values[j]+i-j。','Choose indices i<j maximizing values[i]+values[j]+i−j.'),
1035:('maxUncrossedLines','不相交的线','Uncrossed Lines','两个数组按顺序平行排列，仅可连接值相同的元素，每个位置最多连接一次，连线不可相交。求最多连线数。','Connect equal values between two parallel ordered arrays. Each position is used at most once and lines cannot cross. Return the most connections.'),
1043:('maxSumAfterPartitioning','分隔数组以得到最大和','Partition Array for Maximum Sum','将数组完整切成长度至多k的连续段，每段所有值替换成该段最大值，求替换后的最大总和。','Partition the whole array into contiguous blocks of length at most k. Replace every value within a block by its maximum, and maximize the resulting sum.'),
1130:('mctFromLeafValues','叶值的最小代价生成树','Minimum Cost Tree From Leaf Values','构造有序满二叉树，叶子从左到右恰为arr。每个非叶子值为左右子树最大叶值的乘积，求全部非叶子值之和的最小值。','Build an ordered full binary tree whose leaves left to right are arr. Each internal node is the product of the largest leaf in each child subtree. Minimize the sum of internal-node values.'),
1140:('stoneGameII','石子游戏 II','Stone Game II','两人轮流从剩余堆最前端取X堆，1≤X≤2M，之后M更新为max(M,X)。初始M=1，双方最优，求先手最多获得的石子数。','Two optimal players alternate taking the first X remaining piles, where 1≤X≤2M, then update M=max(M,X). Starting with M=1, return the most stones the first player can obtain.'),
1186:('maximumSum','删除一次得到子数组最大和','Maximum Subarray Sum with One Deletion','选择一个连续子数组，可从中删除至多一个元素，但删除后必须非空。求剩余元素最大和。','Choose a contiguous subarray and optionally delete one element from it, leaving at least one element. Maximize the remaining sum.'),
1191:('kConcatenationMaxSum','K次串联后最大子数组之和','K-Concatenation Maximum Sum','将arr顺序重复k次，求最大连续子数组和，允许空数组得到0。输出最大值模1000000007。','Repeat arr k times in order and find the maximum contiguous subarray sum, allowing an empty subarray of sum 0. Return the maximum modulo 1000000007.'),
1262:('maxSumDivThree','可被三整除的最大和','Greatest Sum Divisible by Three','选若干数组位置，使总和能被3整除，求最大总和，可以不选。','Select array positions to maximize a sum divisible by three. Selecting none is allowed.'),
1277:('countSquares','统计全为1的正方形子矩阵','Count Square Submatrices with All Ones','统计矩阵中全为1的轴对齐正方形子矩阵数量，不同位置或边长分别计数。','Count all axis-aligned square submatrices containing only ones. Different positions or side lengths count separately.'),
1289:('minFallingPathSum','下降路径最小和 II','Minimum Falling Path Sum II','每行恰选一格，相邻行所选列号必须不同，求最小总和。单行时直接选该行一格。','Select one cell per row, using different columns in consecutive rows. Minimize the total. A one-row grid simply selects one cell.'),
1690:('stoneGameVII','石子游戏 VII','Stone Game VII','双方最优轮流移除最左或最右一颗石子，本轮获得剩余石子的总和。求先手总分减后手总分。','Optimal players alternate removing the leftmost or rightmost stone and scoring the sum of the remaining stones. Return the first player’s total minus the second player’s total.'),
1937:('maxPoints','扣分后的最大得分','Maximum Number of Points with Cost','每行恰选一格，得分为选中格值总和减去相邻行所选列号距离之和，求最高得分。','Select one cell in every row. Maximize the sum of selected values minus the sum of absolute column differences between consecutive rows.'),
}

SPECIAL_INPUT={
97:('三行小写英文字符串s1、s2、s3，可为空；前两串长度≤100，第三串长度≤200。','Three lines containing lowercase strings s1, s2, s3, possibly empty; lengths at most 100, 100, and 200 respectively.'),
139:('第一行小写字符串s；第二行字典大小n；后n行是不同的小写单词。s长度1–300，n在1–1000，每词长度1–20。','First line: lowercase s; second line: dictionary size n; next n lines: distinct lowercase words. s length 1–300; n 1–1000; word lengths 1–20.'),
188:('第一行n k；第二行n个股价。1≤n≤1000，1≤k≤100，股价0–1000。','First line: n k; second line: n prices. 1≤n≤1000; 1≤k≤100; prices 0–1000.'),
264:('一行n，1≤n≤1690。','One integer n, 1≤n≤1690.'),
516:('一行小写英文字符串，长度1–1000。','One lowercase English string, length 1–1000.'),
647:('一行小写英文字符串，长度1–1000。','One lowercase English string, length 1–1000.'),
790:('一行n，1≤n≤1000。','One integer n, 1≤n≤1000.'),
931:('第一行m n（m=n）；后m行每行n个整数。1≤n≤100，格值[-100,100]。','First line: m n with m=n; then m rows of n integers. 1≤n≤100; values [-100,100].'),
983:('第一行n；第二行n个严格递增日期；第三行三个票价，依次对应1、7、30天。1≤n≤365，日期1–365，票价1–1000。','First line: n; second line: n strictly increasing travel dates; third line: prices for 1-, 7-, and 30-day passes. 1≤n≤365; dates 1–365; prices 1–1000.'),
1035:('第一行m n；第二行m个整数；第三行n个整数。1≤m,n≤500，元素1–2000。','First line: m n; second line: m integers; third line: n integers. 1≤m,n≤500; values 1–2000.'),
1277:('第一行m n；后m行每行n个0或1。1≤m,n≤300。','First line: m n; then m rows of n zeroes or ones. 1≤m,n≤300.'),
1289:('第一行m n（m=n）；后m行每行n个整数。1≤n≤200，格值[-99,99]。','First line: m n with m=n; then m rows of n integers. 1≤n≤200; values [-99,99].'),
1937:('第一行m n；后m行每行n个整数。1≤m,n≤100000，m×n≤100000，格值0–100000。','First line: m n; then m rows of n integers. 1≤m,n≤100000; m×n≤100000; values 0–100000.'),
}

def input_text(pid):
 if pid in SPECIAL_INPUT:return SPECIAL_INPUT[pid]
 low,high,mn,mx=ARRAY_LIMITS[pid]
 param=' fee' if pid==714 else ' k' if pid in (1043,1191) else ''
 zh=f'第一行n{param}；第二行n个整数。{low}≤n≤{high}，元素在[{mn},{mx}]。'
 en=f'First line: n{param}; second line: n integers. {low}≤n≤{high}; values in [{mn},{mx}].'
 if pid==45:zh+='保证末尾可达。';en+=' The last index is guaranteed reachable.'
 if pid==714:zh+='0≤fee<50000。';en+=' 0≤fee<50000.'
 if pid==1043:zh+='1≤k≤n，最终答案在有符号32位范围内。';en+=' 1≤k≤n; the final answer fits signed 32-bit.'
 if pid==1191:zh+='1≤k≤100000。';en+=' 1≤k≤100000.'
 return zh,en

# Include the dictionary entry-count boundary without importing any source data.
PRESSURE[139].append((['a'*300,['a']+[''.join(v) for v in itertools.islice(itertools.product('abcdefghijklmnopqrstuvwxyz',repeat=3),999)]],1))

PROBLEMS={}
for pid,(method,zh,en,dzh,den) in META.items():
 izh,ien=input_text(pid);name,body=MISTAKES[pid]
 PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dzh,descriptionEn=den,inputZh=izh,inputEn=ien,outputZh='输出一个整数；判断题用1表示是、0表示否。',outputEn='Print one integer; for yes/no questions use 1 for yes and 0 for no.',difficulty='困难' if pid in (123,188,1289) else '中等',edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r,p=pid:random_args(p,r),oracle=lambda a,p=pid:oracle(p,a),encode=lambda a,p=pid:encode(p,a),parse=parse(pid),validate=lambda a,p=pid:validate(p,a),mutants=[dict(name=name,source='import sys,math,collections\n'+parse(pid)+'\n'+body+'\n')])
