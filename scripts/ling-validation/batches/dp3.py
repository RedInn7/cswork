"""Third authored DP batch; domains transcribed from reviewed local READMEs."""
import itertools
import math
from collections import Counter,defaultdict,deque
MOD=1000000007
IDS=[32,115,132,233,397,413,446,467,552,576,600,639,698,718,801,935,940,1027,1105,1155,1218,1220,1269,1411,1416,1547,1641,1653,2320,2466]
KEYPAD={(0,0):1,(0,1):2,(0,2):3,(1,0):4,(1,1):5,(1,2):6,(2,0):7,(2,1):8,(2,2):9,(3,1):0}
KNIGHT={v:[w for (r2,c2),w in KEYPAD.items() if sorted((abs(r-r2),abs(c-c2)))==[1,2]] for (r,c),v in KEYPAD.items()}
VOWELS={'a':'e','e':'ai','i':'aeou','o':'iu','u':'a'}


def subsequences(v):
 for mask in range(1<<len(v)):yield [v[i] for i in range(len(v)) if mask>>i&1]

def oracle(pid,a):
 x=a[0]
 if pid==32:
  def good(s):
   balance=0
   for c in s:
    balance+=1 if c=='(' else -1
    if balance<0:return False
   return balance==0
  return max([0]+[j-i for i in range(len(x)) for j in range(i+1,len(x)+1) if good(x[i:j])])
 if pid==115:return sum(''.join(s)==a[1] for s in subsequences(x))
 if pid==132:
  def split(i):return 0 if i==len(x) else min(1+split(j) for j in range(i+1,len(x)+1) if x[i:j]==x[i:j][::-1])
  return split(0)-1
 if pid==233:return sum(str(n).count('1') for n in range(x+1))
 if pid==397:
  q=deque([(x,0)]);seen={x}
  while q:
   n,d=q.popleft()
   if n==1:return d
   for v in ([n//2] if n%2==0 else [n-1,n+1]):
    if v not in seen:seen.add(v);q.append((v,d+1))
 if pid in (413,446,1027,1218):
  seqs=(x[i:j] for i in range(len(x)) for j in range(i+3,len(x)+1)) if pid==413 else subsequences(x)
  good=[]
  for s in seqs:
   if len(s)<(3 if pid in (413,446) else 1):continue
   d=a[1] if pid==1218 else s[1]-s[0] if len(s)>1 else 0
   if all(v-u==d for u,v in zip(s,s[1:])):good.append(len(s))
  return len(good) if pid in (413,446) else max(good)
 if pid==467:return len({x[i:j] for i in range(len(x)) for j in range(i+1,len(x)+1) if all((ord(v)-ord(u))%26==1 for u,v in zip(x[i:j],x[i+1:j]))})
 if pid==552:return sum(s.count('A')<=1 and 'LLL' not in ''.join(s) for s in itertools.product('APL',repeat=x))%MOD
 if pid==576:
  m,n,steps,row,col=a
  def walk(r,c,left):
   if not(0<=r<m and 0<=c<n):return 1
   if left==0:return 0
   return sum(walk(r+dr,c+dc,left-1) for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)))
  return walk(row,col,steps)%MOD
 if pid==600:return sum('11' not in bin(v) for v in range(x+1))
 if pid==639:
  total=0
  for digits in itertools.product(*('123456789' if c=='*' else c for c in x)):
   s=''.join(digits)
   def decode(i):
    if i==len(s):return 1
    if s[i]=='0':return 0
    return decode(i+1)+(decode(i+2) if i+1<len(s) and int(s[i:i+2])<=26 else 0)
   total+=decode(0)
  return total%MOD
 if pid==698:
  k=a[1];total=sum(x)
  if total%k:return 0
  target=total//k
  # Enumerate valid subset masks, then exact-cover disjoint subsets. The first
  # uncovered position breaks permutation symmetry of otherwise unlabeled groups.
  masks=[mask for mask in range(1,1<<len(x)) if sum(x[i] for i in range(len(x)) if mask>>i&1)==target]
  def cover(remaining):
   if not remaining:return True
   bit=remaining&-remaining
   return any(cover(remaining^mask) for mask in masks if mask&bit and mask&remaining==mask)
  return int(cover((1<<len(x))-1))
 if pid==718:
  y=a[1];return max([0]+[k for i in range(len(x)) for j in range(len(y)) for k in range(1,min(len(x)-i,len(y)-j)+1) if x[i:i+k]==y[j:j+k]])
 if pid==801:
  y=a[1];best=len(x)+1
  for mask in range(1<<len(x)):
   p=[y[i] if mask>>i&1 else x[i] for i in range(len(x))];q=[x[i] if mask>>i&1 else y[i] for i in range(len(x))]
   if all(u<v for s in (p,q) for u,v in zip(s,s[1:])):best=min(best,mask.bit_count())
  return best
 if pid==935:
  def walk(v,left):return 1 if left==0 else sum(walk(w,left-1) for w in KNIGHT[v])
  return sum(walk(v,x-1) for v in range(10))%MOD
 if pid==940:return (len({tuple(s) for s in subsequences(x)})-1)%MOD
 if pid==1105:
  books,width=a
  def shelves(i):
   if i==len(books):return 0
   candidates=[]
   for j in range(i+1,len(books)+1):
    if sum(b[0] for b in books[i:j])<=width:candidates.append(max(b[1] for b in books[i:j])+shelves(j))
   return min(candidates)
  return shelves(0)
 if pid==1155:return sum(sum(v)==a[2] for v in itertools.product(range(1,a[1]+1),repeat=x))%MOD
 if pid==1220:return sum(all(v in VOWELS[u] for u,v in zip(s,s[1:])) for s in itertools.product('aeiou',repeat=x))%MOD
 if pid==1269:
  def walk(pos,left):
   if left==0:return int(pos==0)
   return sum(walk(nxt,left-1) for nxt in (pos-1,pos,pos+1) if 0<=nxt<a[1])
  return walk(0,x)%MOD
 if pid==1411:
  return sum(all(cells[3*r+c]!=cells[3*r+c+1] for r in range(x) for c in range(2)) and all(cells[3*r+c]!=cells[3*(r+1)+c] for r in range(x-1) for c in range(3)) for cells in itertools.product(range(3),repeat=3*x))%MOD
 if pid==1416:
  def split(i):
   if i==len(x):return 1
   if x[i]=='0':return 0
   return sum(split(j) for j in range(i+1,len(x)+1) if int(x[i:j])<=a[1])
  return split(0)%MOD
 if pid==1547:
  n,cuts=a;best=10**20
  for order in itertools.permutations(cuts):
   used=[0,n];cost=0
   for c in order:
    cost+=min(v for v in used if v>c)-max(v for v in used if v<c);used.append(c)
   best=min(best,cost)
  return best
 if pid==1641:return sum(tuple(sorted(s))==s for s in itertools.product(range(5),repeat=x))
 if pid==1653:return min(len(x)-len(s) for s in subsequences(x) if ''.join(s)==''.join(sorted(s)))
 if pid==2320:
  masks=[mask for mask in range(1<<x) if not(mask&(mask<<1))]
  return sum(1 for _ in itertools.product(masks,repeat=2))%MOD
 if pid==2466:
  low,high,zero,one=a;words=set()
  def grow(s):
   if low<=len(s)<=high:words.add(s)
   if len(s)+zero<=high:grow(s+'0'*zero)
   if len(s)+one<=high:grow(s+'1'*one)
  grow('');return len(words)%MOD
 raise ValueError(pid)

KIND={pid:'scalar' for pid in IDS}
KIND.update({32:'string',115:'strings',132:'string',413:'array',446:'array',467:'string',639:'string',698:'array-k',718:'arrays',801:'arrays',940:'string',1027:'array',1105:'books',1218:'array-k',1416:'string-k',1547:'cuts',1653:'string'})

def encode(pid,a):
 kind=KIND[pid]
 if kind=='scalar':return ' '.join(map(str,a))+'\n'
 if kind in ('string','strings'):return '\n'.join(a)+'\n'
 if kind=='string-k':return a[0]+'\n'+str(a[1])+'\n'
 if kind=='arrays':return f'{len(a[0])} {len(a[1])}\n'+' '.join(map(str,a[0]))+'\n'+' '.join(map(str,a[1]))+'\n'
 if kind=='books':return f'{len(a[0])} {a[1]}\n'+'\n'.join(f'{w} {h}' for w,h in a[0])+'\n'
 if kind=='cuts':return f'{a[0]} {len(a[1])}\n'+' '.join(map(str,a[1]))+'\n'
 return str(len(a[0]))+(' '+str(a[1]) if kind=='array-k' else '')+'\n'+' '.join(map(str,a[0]))+'\n'

def parse(pid):
 kind=KIND[pid]
 if kind=='scalar':return 'args=list(map(int,sys.stdin.read().split()))'
 if kind in ('string','strings'):return "args=[sys.stdin.readline().rstrip('\\r\\n') for _ in range("+str(2 if kind=='strings' else 1)+")]"
 if kind=='string-k':return "args=[sys.stdin.readline().strip(),int(sys.stdin.readline())]"
 if kind=='arrays':return 'm,n=map(int,sys.stdin.readline().split());args=[list(map(int,sys.stdin.readline().split())),list(map(int,sys.stdin.readline().split()))];assert len(args[0])==m and len(args[1])==n'
 if kind=='books':return 'n,w=map(int,sys.stdin.readline().split());args=[[list(map(int,sys.stdin.readline().split())) for _ in range(n)],w];assert all(len(b)==2 for b in args[0])'
 if kind=='cuts':return 'n,k=map(int,sys.stdin.readline().split());args=[n,list(map(int,sys.stdin.readline().split()))];assert len(args[1])==k'
 return 'v=list(map(int,sys.stdin.read().split()));assert len(v)==v[0]+'+('2;args=[v[2:],v[1]]' if kind=='array-k' else '1;args=[v[1:]]')


def random_args(pid,r):
 n=r.randint(1,8)
 if pid==32:return [''.join(r.choices('()',k=r.randint(0,10)))]
 if pid==115:return [''.join(r.choices('aAb',k=n)),''.join(r.choices('aAb',k=r.randint(1,5)))]
 if pid in (132,940):return [''.join(r.choices('abc',k=n))]
 if pid==233:return [r.randint(0,1000)]
 if pid==397:return [r.randint(1,200)]
 if pid in (413,446,1027,1218):
  x=[r.randint(0 if pid==1027 else -5,8) for _ in range(max(2,n) if pid==1027 else n)]
  return [x,r.randint(-3,3)] if pid==1218 else [x]
 if pid==467:return [''.join(r.choices('abcyz',k=n))]
 if pid==552:return [r.randint(1,7)]
 if pid==576:
  m,k=r.randint(1,4),r.randint(1,4);return [m,k,r.randint(0,5),r.randrange(m),r.randrange(k)]
 if pid==600:return [r.randint(1,1000)]
 if pid==639:
  s=[r.choice('012367') for _ in range(min(n,6))]
  for i in r.sample(range(len(s)),r.randint(0,min(2,len(s)))):s[i]='*'
  return [''.join(s)]
 if pid==698:
  values=r.sample([i for i in range(1,9) for _ in range(4)],n);return [values,r.randint(1,n)]
 if pid==718:return [[r.randrange(4) for _ in range(n)],[r.randrange(4) for _ in range(r.randint(1,8))]]
 if pid==801:
  n=max(2,n);x=sorted(r.sample(range(40),n));y=sorted(r.sample(range(40),n))
  for i in range(n):
   if r.randrange(2):x[i],y[i]=y[i],x[i]
  return [x,y]
 if pid==935:return [r.randint(1,6)]
 if pid==1105:
  width=r.randint(1,8);return [[[r.randint(1,width),r.randint(1,10)] for _ in range(n)],width]
 if pid==1155:return [r.randint(1,5),r.randint(1,5),r.randint(1,25)]
 if pid==1220:return [r.randint(1,5)]
 if pid==1269:return [r.randint(1,8),r.randint(1,5)]
 if pid==1411:return [r.randint(1,3)]
 if pid==1416:return [r.choice('123456789')+''.join(r.choices('01239',k=n-1)),r.randint(1,200)]
 if pid==1547:
  length=r.randint(2,20);return [length,r.sample(range(1,length),r.randint(1,min(6,length-1))) ]
 if pid==1641:return [r.randint(1,5)]
 if pid==1653:return [''.join(r.choices('ab',k=n))]
 if pid==2320:return [n]
 if pid==2466:
  low=r.randint(1,7);return [low,r.randint(low,10),r.randint(1,low),r.randint(1,low)]
 raise ValueError(pid)


def attendance(n):
 states={(0,0):1}
 for _ in range(n):
  nxt=defaultdict(int)
  for (absent,late),count in states.items():
   nxt[absent,0]=(nxt[absent,0]+count)%MOD
   if not absent:nxt[1,0]=(nxt[1,0]+count)%MOD
   if late<2:nxt[absent,late+1]=(nxt[absent,late+1]+count)%MOD
  states=nxt
 return sum(states.values())%MOD

def transfer(n,states,allowed):
 counts={s:1 for s in states}
 for _ in range(n-1):counts={s:sum(counts[t] for t in states if allowed(t,s))%MOD for s in states}
 return sum(counts.values())%MOD

def exit_count(m,n,moves,row,col):
 states={(row,col):1};total=0
 for _ in range(moves):
  nxt=defaultdict(int)
  for (r,c),v in states.items():
   for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
    w=(r+dr,c+dc)
    if not(0<=w[0]<m and 0<=w[1]<n):total=(total+v)%MOD
    else:nxt[w]=(nxt[w]+v)%MOD
  states=nxt
 return total

def wildcard_count(n):
 before,now=1,9
 for _ in range(1,n):before,now=now,(9*now+15*before)%MOD
 return now

def bounded_compositions(n,k):
 dp=[1]
 for i in range(1,n+1):dp.append(sum(dp[max(0,i-k):i])%MOD)
 return dp[-1]

def houses(n):
 a,b=1,2
 for _ in range(1,n):a,b=b,(a+b)%MOD
 return b*b%MOD

EDGES={32:[['(()'],[''],[')()())'],['()()'],['((((']],115:[['rabbbit','rabbit'],['a','A'],['a','aa'],['aaa','aa']],132:[['aab'],['a'],['ab'],['abccba']],233:[[13],[0],[1],[10],[111]],397:[[8],[1],[3],[7],[15]],413:[[[1,2,3,4]],[[1]],[[1,1,1]],[[1,2,4,6,8]]],446:[[[2,4,6,8,10]],[[7,7,7,7,7]],[[1,2]],[[2147483647,0,-2147483648]]],467:[['zab'],['a'],['cac'],['abca'],['za']],552:[[2],[1],[3],[5]],576:[[2,2,2,0,0],[1,3,3,0,1],[1,1,0,0,0],[1,1,1,0,0]],600:[[5],[1],[2],[3],[7]],639:[['*'],['1*'],['2*'],['**'],['0'],['*0'],['10']],698:[[[4,3,2,3,5,2,1],4],[[1,2,3,4],3],[[1],1],[[2,2,2,2,3,4,5],4]],718:[[[1,2,3,2,1],[3,2,1,4,7]],[[0],[0]],[[1,2,3],[1,3]],[[1,1,1],[1,1]]],801:[[[1,3,5,4],[1,2,3,7]],[[0,3,5,8,9],[2,1,4,6,9]],[[1,2],[1,2]]],935:[[1],[2],[3],[4]],940:[['abc'],['aba'],['aaa'],['a']],1027:[[[3,6,9,12]],[[9,4,7,2,10]],[[20,1,15,3,10,5,8]],[[0,0,0]]],1105:[[[[1,1],[2,3],[2,3],[1,1],[1,1],[1,1],[1,2]],4],[[[1,4]],1],[[[1,1],[1,3],[1,3]],2]],1155:[[2,6,7],[1,6,3],[1,1,2],[2,2,2]],1218:[[[1,2,3,4],1],[[1,3,5,7],1],[[1,5,7,8,5,3,4,2,1],-2],[[0,0,0],0]],1220:[[1],[2],[5]],1269:[[3,2],[2,4],[4,2],[1,1]],1411:[[1],[2],[3]],1416:[['1000',10000],['1000',10],['1317',2000],['10',1],['1',1]],1547:[[7,[1,3,4,5]],[9,[5,6,1,4,2]],[2,[1]]],1641:[[2],[1],[4]],1653:[['aababbab'],['bbaaaaabb'],['a'],['ba'],['abba']],2320:[[1],[2],[3]],2466:[[3,3,1,1],[2,3,1,2],[1,1,1,1],[2,2,2,2]]}
COLOR_ROWS=[s for s in itertools.product(range(3),repeat=3) if s[0]!=s[1] and s[1]!=s[2]]
PRESSURE={32:[(['('*15000+')'*15000],30000),([')('*15000],29998)],115:[(['a'*1000,'a'*1000],1),(['a'*1000,'a'*999],1000)],132:[(['a'*2000],0),(['ab'*1000],1)],233:[([1000000000],900000001),([999999999],900000000)],397:[([2147483647],32),([1073741824],30)],413:[([[1000]*5000],4999*4998//2),([[-1000,1000]*2500],0)],446:[([list(range(1000))],sum(sum(1000-k*d for k in range(2,1000//d+1) if k*d<1000) for d in range(1,500))),([[0]*31],2**31-1-31-465)],467:[([('abcdefghijklmnopqrstuvwxyz'*3847)[:100000]],2600000-325),(['a'*100000],1)],552:[([100000],attendance(100000)),([99999],attendance(99999))],576:[([50,50,50,25,25],exit_count(50,50,50,25,25)),([1,1,50,0,0],4)],600:[([1000000000],2178309),([2**29-1],1346269)],639:[(['*'*100000],wildcard_count(100000)),(['0'*100000],0)],698:[([[10000,9999,9998,9997]*4,4],1),([[2]*4+[4]*4+[6]*4+[9]*4,7],0)],718:[([[0]*1000,[0]*1000],1000),([[0]*1000,[1]*1000],0)],801:[([[i if i%2==0 else i+100000 for i in range(100000)],[i+100000 if i%2==0 else i for i in range(100000)]],50000),([list(range(100000)),list(range(100000))],0)],935:[([5000],transfer(5000,range(10),lambda u,v:v in KNIGHT[u])),([4999],transfer(4999,range(10),lambda u,v:v in KNIGHT[u]))],940:[(['a'*2000],2000),(['a'*1000+'b'*1000],1002000)],1027:[([[500]*1000],1000),([[0,500]*500],500)],1105:[([[[1000,1000]]*1000,1000],1000000),([[[1,1000]]*1000,1000],1000)],1155:[([30,30,900],1),([30,30,1000],0),([30,30,450],sum((-1)**i*math.comb(30,i)*math.comb(450-30*i-1,29) for i in range(15))%MOD)],1218:[([[1]*100000,0],100000),([[-10000]*100000,-10000],1)],1220:[([20000],transfer(20000,'aeiou',lambda u,v:v in VOWELS[u])),([19999],transfer(19999,'aeiou',lambda u,v:v in VOWELS[u]))],1269:[([500,1000000],sum(math.comb(500,2*k)*math.comb(2*k,k)//(k+1) for k in range(251))%MOD),([500,1],1)],1411:[([5000],transfer(5000,COLOR_ROWS,lambda u,v:all(a!=b for a,b in zip(u,v)))),([4999],transfer(4999,COLOR_ROWS,lambda u,v:all(a!=b for a,b in zip(u,v))))],1416:[(['1'*100000,1],1),(['1'*100000,1000000000],bounded_compositions(100000,9))],1547:[([101,list(range(1,101))],680),([1000000,[500000]],1000000)],1641:[([50],math.comb(54,4)),([49],math.comb(53,4))],1653:[(['b'*50000+'a'*50000],50000),(['ab'*50000],49999)],2320:[([10000],houses(10000)),([9999],houses(9999))],2466:[([100000,100000,1,1],pow(2,100000,MOD)),([1,100000,1,1],(pow(2,100001,MOD)-2)%MOD),([100000,100000,100000,100000],2)]}


def validate(pid,a):
 def ints(v,lo,hi):assert all(type(n)is int and lo<=n<=hi for n in v)
 count=5 if pid==576 else 4 if pid==2466 else 3 if pid==1155 else 2 if KIND[pid] in ('strings','array-k','arrays','books','string-k','cuts') or pid==1269 else 1
 assert type(a)is list and len(a)==count;x=a[0]
 scalar={233:(0,10**9),397:(1,2**31-1),552:(1,100000),600:(1,10**9),935:(1,5000),1220:(1,20000),1411:(1,5000),1641:(1,50),2320:(1,10000)}
 if pid in scalar:ints(a,*scalar[pid])
 elif KIND[pid] in ('string','strings','string-k'):
  limit={32:30000,115:1000,132:2000,467:100000,639:100000,940:2000,1416:100000,1653:100000}[pid]
  for s in (a if pid==115 else a[:1]):
   assert type(s)is str and (0 if pid==32 else 1)<=len(s)<=limit
   alphabet='()' if pid==32 else '0123456789*' if pid==639 else '0123456789' if pid==1416 else 'ab' if pid==1653 else 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' if pid==115 else 'abcdefghijklmnopqrstuvwxyz'
   assert all(c in alphabet for c in s)
  if pid==115:
   target=a[1];dp=[1]+[0]*len(target)
   for c in x:
    for j in range(len(target)-1,-1,-1):
     if target[j]==c:dp[j+1]+=dp[j]
   assert dp[-1]<=2147483647
  if pid==1416:assert x[0]!='0';ints(a[1:],1,10**9)
 elif pid in (413,446,698,1027,1218):
  nmin,nmax,lo,hi={413:(1,5000,-1000,1000),446:(1,1000,-2**31,2**31-1),698:(1,16,1,10000),1027:(2,1000,0,500),1218:(1,100000,-10000,10000)}[pid]
  assert type(x)is list and nmin<=len(x)<=nmax;ints(x,lo,hi)
  if pid==698:ints(a[1:],1,len(x));assert max(Counter(x).values())<=4
  if pid==1218:ints(a[1:],-10000,10000)
  if pid==446:
   dp=[defaultdict(int) for _ in x];total=0
   for i,v in enumerate(x):
    for j in range(i):
     d=v-x[j];total+=dp[j][d];dp[i][d]+=dp[j][d]+1
   assert total<=2147483647
 elif pid==576:
  ints(a[:2],1,50);ints(a[2:3],0,50);ints(a[3:4],0,x-1);ints(a[4:5],0,a[1]-1)
 elif pid in (718,801):
  for v in a:assert type(v)is list and (2 if pid==801 else 1)<=len(v)<=(100000 if pid==801 else 1000);ints(v,0,200000 if pid==801 else 100)
  if pid==801:
   y=a[1];assert len(y)==len(x);states={0,1}
   for i in range(1,len(x)):
    states={new for old in states for new in (0,1) if (y[i-1] if old else x[i-1])<(y[i] if new else x[i]) and (x[i-1] if old else y[i-1])<(x[i] if new else y[i])}
    assert states
 elif pid==1105:
  ints(a[1:],1,1000);assert 1<=len(x)<=1000
  for b in x:assert len(b)==2;ints(b[:1],1,a[1]);ints(b[1:],1,1000)
 elif pid==1155:ints(a[:2],1,30);ints(a[2:],1,1000)
 elif pid==1269:ints(a[:1],1,500);ints(a[1:],1,1000000)
 elif pid==1547:
  ints(a[:1],2,1000000);assert 1<=len(a[1])<=min(x-1,100) and len(set(a[1]))==len(a[1]);ints(a[1],1,x-1)
 elif pid==2466:ints(a[:2],1,100000);assert x<=a[1];ints(a[2:],1,x)
 else:raise ValueError(pid)
 return True

MISTAKES={
32:('counts matched symbol totals without checking order',"s=args[0];print(2*min(s.count('('),s.count(')')))"),
115:('ignores the order of target characters',"s,t=args;print(math.prod(math.comb(s.count(c),n) if s.count(c)>=n else 0 for c,n in collections.Counter(t).items()))"),
132:('cuts once per distinct character instead of testing palindromes','print(len(set(args[0]))-1)'),
233:('counts numbers containing 1 rather than digit occurrences',"print(sum('1' in str(n) for n in range(args[0]+1)))"),
397:('always decrements odd integers','n=args[0];count=0\nwhile n>1:n=n-1 if n%2 else n//2;count+=1\nprint(count)'),
413:('counts only length-three slices','a=args[0];print(sum(a[i]-a[i-1]==a[i-1]-a[i-2] for i in range(2,len(a))))'),
446:('counts contiguous arithmetic slices rather than subsequences','a=args[0];print(sum(all(a[k]-a[k-1]==a[i+1]-a[i] for k in range(i+2,j)) for i in range(len(a)) for j in range(i+3,len(a)+1)))'),
467:('counts equal wraparound substrings repeatedly',"s=args[0];print(sum(all((ord(v)-ord(u))%26==1 for u,v in zip(s[i:j],s[i+1:j])) for i in range(len(s)) for j in range(i+1,len(s)+1)))"),
552:('restricts absences but forgets the late streak limit',"print(sum(s.count('A')<=1 for s in itertools.product('APL',repeat=args[0]))%1000000007)"),
576:('counts only exits on the final permitted move',"m,n,k,r,c=args\ndef f(r,c,left):\n    if not(0<=r<m and 0<=c<n):return int(left==0)\n    if not left:return 0\n    return sum(f(r+dr,c+dc,left-1) for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)))\nprint(f(r,c,k))"),
600:('accepts only values with at most one set bit','print(1+args[0].bit_length())'),
639:('omits all two-digit decoding choices',"print(9**args[0].count('*') if '0' not in args[0] else 0)"),
698:('checks divisibility without checking a possible partition','print(int(sum(args[0])%args[1]==0))'),
718:('computes common subsequence instead of common subarray','a,b=args;dp=[0]*(len(b)+1)\nfor x in a:\n    old=dp[:]\n    for j,y in enumerate(b):dp[j+1]=old[j]+1 if x==y else max(old[j+1],dp[j])\nprint(dp[-1])'),
801:('counts original inversions without propagating swaps','a,b=args;print(sum(a[i]<=a[i-1] or b[i]<=b[i-1] for i in range(1,len(a))))'),
935:('assumes every digit has exactly two knight moves','print(10*2**(args[0]-1))'),
940:('counts index subsets rather than distinct resulting text','print(2**len(args[0])-1)'),
1027:('only checks contiguous arithmetic progressions','a=args[0];best=run=2\nfor i in range(2,len(a)):\n    run=run+1 if a[i]-a[i-1]==a[i-1]-a[i-2] else 2;best=max(best,run)\nprint(best)'),
1105:('greedily fills every shelf before starting another','books,width=args;used=height=total=0\nfor w,h in books:\n    if used+w>width:total+=height;used=height=0\n    used+=w;height=max(height,h)\nprint(total+height)'),
1155:('does not distinguish dice order','n,k,t=args;print(sum(sum(v)==t for v in itertools.combinations_with_replacement(range(1,k+1),n)))'),
1218:('sorts input and destroys subsequence ordering','a,d=args;dp={}\nfor x in sorted(a):dp[x]=dp.get(x-d,0)+1\nprint(max(dp.values()))'),
1220:('permits arbitrary following vowels','print(5**args[0]%1000000007)'),
1269:('permits stepping to negative indices','n,length=args;print(sum(math.comb(n,2*k)*math.comb(2*k,k) for k in range(n//2+1)))'),
1411:('checks horizontal but not vertical neighbors','print(12**args[0]%1000000007)'),
1416:('accepts leading zeros within a number','s,k=args\ndef f(i):\n    if i==len(s):return 1\n    return sum(f(j) for j in range(i+1,len(s)+1) if 1<=int(s[i:j])<=k)\nprint(f(0))'),
1547:('always performs cuts in increasing position order','n,cuts=args;last=0;total=0\nfor c in sorted(cuts):total+=n-last;last=c\nprint(total)'),
1641:('requires strictly increasing instead of nondecreasing vowels','print(math.comb(5,args[0]) if args[0]<=5 else 0)'),
1653:('counts adjacent ba pairs only',"s=args[0];print(sum(u=='b' and v=='a' for u,v in zip(s,s[1:])))"),
2320:('counts only one street side','a,b=1,2\nfor _ in range(1,args[0]):a,b=b,a+b\nprint(b)'),
2466:('merges equal block lengths even though their characters differ','lo,hi,z,o=args;dp=[1]+[0]*hi\nfor i in range(1,hi+1):dp[i]=sum(dp[i-c] for c in set((z,o)) if c<=i)\nprint(sum(dp[lo:]))'),
}
EDGES[115].append(['ab','ba'])
EDGES[1416].append(['101',100])
EDGES[32].append([')(()'])
EDGES[801].append([[9,13,15,19,34,30],[9,13,29,30,27,36]])
EDGES[132].append(['aaba'])
EDGES[600].append([4])
MISTAKES[132]=('greedily takes the longest palindromic prefix',"s=args[0];parts=0\nwhile s:\n    k=max(i for i in range(1,len(s)+1) if s[:i]==s[:i][::-1]);s=s[k:];parts+=1\nprint(parts-1)")
MISTAKES[600]=('counts all values of the same bit width, ignoring the upper bound',"a,b=1,2\nfor _ in range(1,args[0].bit_length()):a,b=b,a+b\nprint(b)")
MISTAKES[1220]=('incorrectly permits i to follow itself',"allowed={'a':'e','e':'ai','i':'aeiou','o':'iu','u':'a'}\nprint(sum(all(v in allowed[u] for u,v in zip(s,s[1:])) for s in itertools.product('aeiou',repeat=args[0])))")

META={
32:('longestValidParentheses','最长有效括号','Longest Valid Parentheses','求最长连续合法括号片段的长度。合法串可完全匹配所有左右括号，匹配过程中右括号不能超前。','Return the longest contiguous balanced-parenthesis segment length. Every parenthesis must match and no prefix may have more closing than opening parentheses.'),
115:('numDistinct','不同的子序列','Distinct Subsequences','从s删除字符保持顺序，统计得到t的下标选择数。相同文本由不同下标得到时分别计数，区分大小写。','Count index selections from s whose characters in order form t. Different selections count separately even if their text matches; letters are case-sensitive.'),
132:('minCut','分割回文串 II','Palindrome Partitioning II','将字符串完整切分为若干非空回文段，求最少切割次数。整串为回文时为0。','Partition the entire string into nonempty palindromic blocks with the fewest cuts. An already palindromic string needs zero cuts.'),
233:('countDigitOne','数字1的个数','Number of Digit One','统计0至n所有整数的通常十进制表示中，数字1出现的总次数，不写前导零。','Count every occurrence of digit 1 in ordinary decimal representations of all integers from 0 through n, without leading zeroes.'),
397:('integerReplacement','整数替换','Integer Replacement','偶数可除以2，奇数可加1或减1，求将正整数n变成1所需的最少操作数。','An even integer may be halved; an odd integer may increase or decrease by one. Minimize operations to turn positive n into 1.'),
413:('numberOfArithmeticSlices','等差数列划分','Arithmetic Slices','统计长度至少3、相邻差值相同的连续子数组数。按下标区间分别计数。','Count contiguous subarrays of length at least three with a constant adjacent difference. Different index intervals count separately.'),
446:('numberOfArithmeticSlices','等差数列划分 II — 子序列','Arithmetic Slices II — Subsequence','统计长度至少3的等差子序列数。可跳过元素但保持顺序，不同下标选择分别计数。','Count arithmetic subsequences of length at least three. Elements may be skipped without reordering; different index selections count separately.'),
467:('findSubstringInWraproundString','环绕字符串中的唯一子字符串','Unique Substrings in Wraparound String','无限重复abcdefghijklmnopqrstuvwxyz。统计s的非空连续子串中也出现在该无限串中的不同文本数，相同文本仅计一次。','The alphabet abcdefghijklmnopqrstuvwxyz repeats forever. Count distinct nonempty substring texts of s that also occur in that infinite string; duplicate text counts once.'),
552:('checkRecord','学生出勤记录 II','Student Attendance Record II','长度n记录由A缺席、L迟到、P出勤构成。至多一个A且不出现连续三个L，求合法记录数，答案模1000000007。','Count length-n records over A (absent), L (late), P (present) containing at most one A and no LLL substring. Return the count modulo 1000000007.'),
576:('findPaths','出界的路径数','Out of Boundary Paths','从m×n网格指定位置出发，每步向上下左右移动一格。统计至多maxMove步第一次出界的不同移动序列，出界立即结束，答案取模1000000007。','Start at the specified cell of an m by n grid and move one cell up/down/left/right. Count sequences first exiting within maxMove moves, stopping upon exit, modulo 1000000007.'),
600:('findIntegers','不含连续1的非负整数','Non-negative Integers without Consecutive Ones','统计0至n的整数中，通常二进制表示不含连续11的数量，0也计入。','Count integers from 0 through n whose ordinary binary representation contains no consecutive ones. Include zero.'),
639:('numDecodings','解码方法 II','Decode Ways II','1至26对应字母A至Z，*可替换为1至9任意数字。统计所有替换和合法解码分段方案，代码不能前导零，答案模1000000007。','Codes 1 through 26 map to A through Z; each * independently represents a digit 1 through 9. Count all replacements and valid decoding partitions without leading zeroes, modulo 1000000007.'),
698:('canPartitionKSubsets','划分为k个相等的子集','Partition to K Equal Sum Subsets','将所有数组位置划分为k个非空子集，每个位置恰好使用一次。能使每组总和相同输出1，否则0。','Partition every array position exactly once into k nonempty subsets. Print 1 if all subset sums can be equal, otherwise 0.'),
718:('findLength','最长重复子数组','Maximum Length of Repeated Subarray','返回两个数组中内容相同的最长连续子数组长度。不能跳过中间元素。','Return the longest length of a contiguous subarray appearing in both arrays. Internal elements cannot be skipped.'),
801:('minSwap','使序列递增的最小交换次数','Minimum Swaps To Make Sequences Increasing','一次可交换两数组同一下标的元素。保证存在方案使两个数组均严格递增，求最少交换次数。','One operation swaps elements at the same index between the two arrays. A solution making both arrays strictly increasing exists; minimize the number of swaps.'),
935:('knightDialer','骑士拨号器','Knight Dialer','数字键盘前三行为123、456、789，第四行中间为0。每次按国际象棋骑士跳法移动（横二竖一或横一竖二），仅落数字键。任选起点，求长度n的数字序列数，模1000000007。','Use a keypad with rows 123, 456, 789 and 0 centered below. A chess knight moves only between digit keys. From any starting digit count length-n sequences modulo 1000000007.'),
940:('distinctSubseqII','不同的子序列 II','Distinct Subsequences II','统计字符串的不同非空子序列文本数。删除字符但不重排，相同文本仅计一次，答案模1000000007。','Count distinct nonempty subsequence texts obtainable by deletions without reordering. Identical text counts once; return modulo 1000000007.'),
1027:('longestArithSeqLength','最长等差数列','Longest Arithmetic Subsequence','求保持原顺序、相邻数值差恒定的最长子序列长度，可跳过元素。','Find the longest subsequence with a constant adjacent numerical difference, allowing skipped elements but preserving order.'),
1105:('minHeightShelves','填充书架','Filling Bookcase Shelves','书必须按给定顺序放在若干层。每层厚度总和不超过shelfWidth，高度是该层最高书的高度，求各层高度之和的最小值。','Place books in their given order across shelves. Total thickness per shelf is at most shelfWidth; its height is its tallest book. Minimize the sum of shelf heights.'),
1155:('numRollsToTarget','掷骰子等于目标和的方法数','Number of Dice Rolls With Target Sum','n个有顺序的骰子，每个面值为1至k，求总和恰为target的结果数，不同骰子排列分别计数，答案取模1000000007。','Roll n distinguishable dice with face values 1 through k. Count ordered outcomes totaling target, modulo 1000000007.'),
1218:('longestSubsequence','最长定差子序列','Longest Arithmetic Subsequence of Given Difference','求最长子序列长度，使每个后继值减前驱值恰为difference，保持原数组顺序。','Find the longest subsequence in original order whose each next value minus its predecessor equals difference.'),
1220:('countVowelPermutation','统计元音字母序列的数目','Count Vowels Permutation','长度n仅含aeiou；a后仅可e，e后可a/i，i后可a/e/o/u，o后可i/u，u后仅可a。求合法字符串数，模1000000007。','Count length-n vowel strings where allowed followers are a→e, e→a/i, i→a/e/o/u, o→i/u, u→a. Return modulo 1000000007.'),
1269:('numWays','停在原地的方案数','Number of Ways to Stay in the Same Place After Some Steps','从长arrLen数组的下标0开始，每步左移、右移或原地，不能越界。恰好steps步后仍在0的方案数取模1000000007。','Start at index 0 of an array of length arrLen. Each move goes left, right, or stays without leaving the array. Count ways to end at 0 after exactly steps moves, modulo 1000000007.'),
1411:('numOfWays','给N×3网格图涂色的方案数','Number of Ways to Paint N by 3 Grid','用三种颜色涂满n行3列网格，所有水平或垂直相邻格颜色不同，求方案数，模1000000007。','Color an n-row, 3-column grid using three colors so horizontally or vertically adjacent cells differ. Count colorings modulo 1000000007.'),
1416:('numberOfArrays','恢复数组','Restore The Array','将数字串完整切成若干整数，每个在1至k范围内且不含前导零，统计切分方案数，模1000000007。','Partition the digit string completely into integers between 1 and k, each without leading zeroes. Count partitions modulo 1000000007.'),
1547:('minCost','切棍子的最小成本','Minimum Cost to Cut a Stick','长度n的棍子必须在cuts的每个位置切开，顺序任选。每次成本是当时所切那段的长度，求总成本最小值。','Cut a length-n stick at every position in cuts, in any order. Each cut costs the length of its current segment. Minimize total cost.'),
1641:('countVowelStrings','统计字典序元音字符串的数目','Count Sorted Vowel Strings','统计长度n、仅含aeiou且按a<e<i<o<u非递减排列的字符串数，允许重复字母。','Count length-n strings over a,e,i,o,u in nondecreasing alphabetical order. Repeated letters are allowed.'),
1653:('minimumDeletions','使字符串平衡的最少删除次数','Minimum Deletions to Make String Balanced','字符串仅含a/b，删除尽可能少的字符，使所有a都在所有b之前；可只剩一种字母或为空。','Delete the fewest characters from an a/b string so all a characters precede all b characters. One letter type or an empty result is allowed.'),
2320:('countHousePlacements','统计放置房子的方式数','Count Number of Ways to Place Houses','道路两侧各有n个位置，每处可放一栋房或留空，同侧不能相邻有房，对面不受限制。统计方案数，模1000000007。','A street has n plots on each side. Each plot may hold a house; houses cannot be adjacent on the same side, while opposite plots are independent. Count arrangements modulo 1000000007.'),
2466:('countGoodStrings','统计构造好字符串的方案数','Count Ways To Build Good Strings','从空串开始，每次追加zero个0或one个1。统计长度在low至high闭区间的不同字符串数，模1000000007。','Starting empty, append a block of 0s of length `zero` or a block of 1s of length `one`. Count distinct resulting strings of lengths `low` through `high` inclusive, modulo 1000000007.'),
}

INPUT={
32:('一行仅含(和)的字符串，可为空，长度≤30000。','One line of ( and ) characters, possibly empty; length≤30000.'),
115:('两行字符串s、t，均为大小写英文字母，长度1–1000。保证最终答案≤2147483647。','Two lines: s and t, containing uppercase/lowercase English letters, each length 1–1000. The final answer is at most 2147483647.'),
132:('一行小写英文字符串，长度1–2000。','One lowercase English string of length 1–2000.'),
233:('一行n，0≤n≤1000000000。','One integer n, 0≤n≤1000000000.'),
397:('一行n，1≤n≤2147483647。','One integer n, 1≤n≤2147483647.'),
413:('第一行n；第二行n个整数。1≤n≤5000，值在[-1000,1000]。','First line: n; second line: n integers. 1≤n≤5000; values in [-1000,1000].'),
446:('第一行n；第二行n个整数。1≤n≤1000，值在[-2147483648,2147483647]，最终答案≤2147483647。','First line: n; second line: n integers. 1≤n≤1000; values in [-2147483648,2147483647]; final answer≤2147483647.'),
467:('一行小写英文字符串，长度1–100000。','One lowercase English string of length 1–100000.'),
552:('一行n，1≤n≤100000。','One integer n, 1≤n≤100000.'),
576:('一行m n maxMove startRow startColumn。1≤m,n≤50，0≤maxMove≤50；行列下标从0起，起点必须在网格内。','One line: m n maxMove startRow startColumn. 1≤m,n≤50; 0≤maxMove≤50. Row/column indices start at 0 and the start must be inside the grid.'),
600:('一行n，1≤n≤1000000000。','One integer n, 1≤n≤1000000000.'),
639:('一行仅含数字与*的字符串，长度1–100000。','One string containing digits and *, length 1–100000.'),
698:('第一行n k；第二行n个正整数。1≤k≤n≤16，值1–10000，每个不同值出现次数最多4。','First line: n k; second line: n positive integers. 1≤k≤n≤16; values 1–10000; no value occurs more than four times.'),
718:('第一行m n；第二行m个整数；第三行n个整数。1≤m,n≤1000，值0–100。','First line: m n; second line: m integers; third line: n integers. 1≤m,n≤1000; values 0–100.'),
801:('第一行m n，要求m=n；第二、三行各n个整数。2≤n≤100000，值0–200000，保证存在可行交换方案。','First line: m n with m=n; next two lines each contain n integers. 2≤n≤100000; values 0–200000; a valid swap selection is guaranteed.'),
935:('一行n，1≤n≤5000。','One integer n, 1≤n≤5000.'),
940:('一行小写英文字符串，长度1–2000。','One lowercase English string of length 1–2000.'),
1027:('第一行n；第二行n个整数。2≤n≤1000，值0–500。','First line: n; second line: n integers. 2≤n≤1000; values 0–500.'),
1105:('第一行n shelfWidth；后n行各为thickness height。1≤n≤1000，1≤thickness≤shelfWidth≤1000，height为1–1000。','First line: n shelfWidth; next n lines: thickness height. 1≤n≤1000; 1≤thickness≤shelfWidth≤1000; height 1–1000.'),
1155:('一行n k target。1≤n,k≤30，1≤target≤1000。','One line: n k target. 1≤n,k≤30; 1≤target≤1000.'),
1218:('第一行n difference；第二行n个整数。1≤n≤100000，元素和difference均在[-10000,10000]。','First line: n difference; second line: n integers. 1≤n≤100000; elements and difference in [-10000,10000].'),
1220:('一行n，1≤n≤20000。','One integer n, 1≤n≤20000.'),
1269:('一行steps arrLen。1≤steps≤500，1≤arrLen≤1000000。','One line: steps arrLen. 1≤steps≤500; 1≤arrLen≤1000000.'),
1411:('一行n，1≤n≤5000。','One integer n, 1≤n≤5000.'),
1416:('第一行数字串s；第二行k。1≤s长度≤100000，s本身不以前导零开头，1≤k≤1000000000。','First line: digit string s; second line: k. s length 1–100000 with no leading zero; 1≤k≤1000000000.'),
1547:('第一行n k；第二行k个不同切割位置。2≤n≤1000000，1≤k≤min(n-1,100)，切割位置在1至n-1，可无序。','First line: n k; second line: k distinct cut positions. 2≤n≤1000000; 1≤k≤min(n−1,100); cut positions 1 through n−1, in any order.'),
1641:('一行n，1≤n≤50。','One integer n, 1≤n≤50.'),
1653:('一行只含a和b的字符串，长度1–100000。','One string containing only a and b, length 1–100000.'),
2320:('一行n，1≤n≤10000。','One integer n, 1≤n≤10000.'),
2466:('一行low high zero one。1≤low≤high≤100000，1≤zero,one≤low。','One line: low high zero one. 1≤low≤high≤100000; 1≤zero,one≤low.'),
}
PROBLEMS={}
for pid,(method,zh,en,dzh,den) in META.items():
 izh,ien=INPUT[pid];name,body=MISTAKES[pid]
 PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dzh,descriptionEn=den,inputZh=izh,inputEn=ien,outputZh='输出1表示能，0表示不能。' if pid==698 else '输出一个整数和换行。',outputEn='Print 1 for yes, 0 for no.' if pid==698 else 'Print one integer followed by a newline.',difficulty='困难' if pid in (32,115,132,233,446,552,600,639,940,1220,1269,1411,1416,1547) else '中等',edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r,p=pid:random_args(p,r),oracle=lambda a,p=pid:oracle(p,a),encode=lambda a,p=pid:encode(p,a),parse=parse(pid),validate=lambda a,p=pid:validate(p,a),mutants=[dict(name=name,source='import sys,math,collections,itertools\n'+parse(pid)+'\n'+body+'\n')])
