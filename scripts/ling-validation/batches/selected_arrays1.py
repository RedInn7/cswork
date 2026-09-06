"""Fresh fixtures for the SDE selection, reviewed against each local README.
Oracles use small exhaustive searches; downloaded solutions are read only elsewhere.
"""
import itertools,re,string
from collections import Counter
from functools import lru_cache
from fractions import Fraction

IDS=[20,448,645,287,334,128,454,187,266,1679,2342,2364,1814,1010,1657,554,1930,2131,8,65,686,275,809,1750,1328,1763,214,1870,167,16]
METHODS=dict(zip(IDS,['isValid','findDisappearedNumbers','findErrorNums','findDuplicate','increasingTriplet','longestConsecutive','fourSumCount','findRepeatedDnaSequences','canPermutePalindrome','maxOperations','maximumSum','countBadPairs','countNicePairs','numPairsDivisibleBy60','closeStrings','leastBricks','countPalindromicSubsequence','longestPalindrome','myAtoi','isNumber','repeatedStringMatch','hIndex','expressiveWords','minimumLength','breakPalindrome','longestNiceSubstring','shortestPalindrome','minSpeedOnTime','twoSum','threeSumClosest']))
TEXT={20,187,266,1930,8,65,1750,1328,1763,214}
TAIL={1679,167,16,1870}

def oracle(p,a):
 x=a[0]
 if p==20:
  while any(t in x for t in ('()','[]','{}')):
   for t in ('()','[]','{}'):x=x.replace(t,'')
  return int(not x)
 if p==448:return [v for v in range(1,len(x)+1) if all(t!=v for t in x)]
 if p==645:return [next(v for v in x if x.count(v)==2),next(v for v in range(1,len(x)+1) if v not in x)]
 if p==287:return next(v for v in x if x.count(v)>1)
 if p==334:return int(any(x[i]<x[j]<x[k] for i,j,k in itertools.combinations(range(len(x)),3)))
 if p==128:
  return max([0]+[next((k for k in range(1,len(x)+1) if v+k not in x),len(x)) for v in x])
 if p==454:return sum(sum(t)==0 for t in itertools.product(*a))
 if p==187:return sorted({x[i:i+10] for i in range(len(x)-9) if any(x[i:i+10]==x[j:j+10] for j in range(i+1,len(x)-9))})
 if p==266:return int(any(t==t[::-1] for t in itertools.permutations(x)))
 if p==1679:
  @lru_cache(None)
  def f(t):
   if len(t)<2:return 0
   return max([f(t[1:])]+[1+f(t[1:i]+t[i+1:]) for i in range(1,len(t)) if t[0]+t[i]==a[1]])
  return f(tuple(x))
 if p==2342:return max([-1]+[u+v for u,v in itertools.combinations(x,2) if sum(map(int,str(u)))==sum(map(int,str(v)))])
 if p==2364:return sum(j-i!=x[j]-x[i] for i,j in itertools.combinations(range(len(x)),2))
 if p==1814:return sum(u+int(str(v)[::-1])==v+int(str(u)[::-1]) for u,v in itertools.combinations(x,2))%1000000007
 if p==1010:return sum((u+v)%60==0 for u,v in itertools.combinations(x,2))
 if p==1657:
  if set(x)!=set(a[1]):return 0
  letters=sorted(set(x));want=Counter(a[1])
  return int(any(Counter(dict(zip(letters,perm))[c] for c in x)==want for perm in itertools.permutations(letters)))
 if p==554:
  # An optimum lies at an internal edge; evaluate crossings directly row by row.
  edges={sum(row[:i]) for row in x for i in range(1,len(row))}
  return min([len(x)]+[sum(not any(sum(row[:i])==pos for i in range(1,len(row))) for row in x) for pos in edges])
 if p==1930:return len({x[i]+x[j]+x[k] for i,j,k in itertools.combinations(range(len(x)),3) if x[i]==x[k]})
 if p==2131:
  for n in range(len(x),0,-1):
   for seq in itertools.permutations(x,n):
    s=''.join(seq)
    if s==s[::-1]:return 2*n
  return 0
 if p==8:
  m=re.match(r' *([+-]?[0-9]+)',x)
  return min(2**31-1,max(-2**31,int(m[1]))) if m else 0
 if p==65:
  # Grammar recognition, independent of the reference's character scan.
  return int(re.fullmatch(r'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?',x) is not None)
 if p==686:return next((k for k in range(1,len(a[1])+2) if a[1] in x*k),-1)
 if p==275:return max(h for h in range(len(x)+1) if sum(v>=h for v in x)>=h)
 if p==809:
  # Enumerate how original word positions map onto target runs: run boundaries
  # are explicit groups, and only groups length>=3 may have been expanded.
  target=[(c,len(list(g))) for c,g in itertools.groupby(x)];ans=0
  for word in a[1]:
   groups=[(c,len(list(g))) for c,g in itertools.groupby(word)]
   ans+=len(groups)==len(target) and all(c==d and (n==m or n>=3 and 1<=m<n) for (c,n),(d,m) in zip(target,groups))
  return ans
 if p==1750:
  @lru_cache(None)
  def f(s):
   choices=[len(s)]
   for i in range(1,len(s)):
    if len(set(s[:i]))!=1:break
    for j in range(i,len(s)):
     if set(s[j:])==set(s[:i]):choices.append(f(s[i:j]))
   return min(choices)
  return f(x)
 if p==1328:
  choices=[x[:i]+c+x[i+1:] for i in range(len(x)) for c in string.ascii_lowercase if c!=x[i]]
  return min((s for s in choices if s!=s[::-1]),default='')
 if p==1763:
  best=''
  for i in range(len(x)):
   for j in range(i+1,len(x)+1):
    s=x[i:j]
    if len(s)>len(best) and all(c.swapcase() in s for c in s):best=s
  return best
 if p==214:
  return next(x[i:][::-1]+x for i in range(len(x),-1,-1) if x[:i]==x[:i][::-1])
 if p==1870:
  hour=Fraction(str(a[1]))
  if hour<=len(x)-1:return -1
  # Enumerate integer speeds on bounded random cases; large pressures use proofs.
  for v in range(1,10001):
   if sum((d+v-1)//v for d in x[:-1])+Fraction(x[-1],v)<=hour:return v
  raise AssertionError('oracle generator exceeded small speed bound')
 if p==167:return next([i+1,j+1] for i,j in itertools.combinations(range(len(x)),2) if x[i]+x[j]==a[1])
 if p==16:
  sums={sum(c) for c in itertools.combinations(x,3)};distance=min(abs(s-a[1]) for s in sums);answers=[s for s in sums if abs(s-a[1])==distance];assert len(answers)==1;return answers[0]
 raise AssertionError(p)

def encode(p,a):
 if p in TEXT:return a[0]+'\n'
 if p in {1657,686}:return '\n'.join(a)+'\n'
 if p==454:return str(len(a[0]))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in a)
 if p==554:return str(len(a[0]))+'\n'+''.join(str(len(row))+' '+' '.join(map(str,row))+'\n' for row in a[0])
 if p==809:return a[0]+'\n'+str(len(a[1]))+'\n'+' '.join(a[1])+'\n'
 out=str(len(a[0]))+'\n'+' '.join(map(str,a[0]))+'\n'
 if p in TAIL:out+=str(a[1])+'\n'
 return out

def parse(p):
 if p in TEXT:return "args=[sys.stdin.readline().rstrip('\\r\\n')]"
 if p in {1657,686}:return "args=[sys.stdin.readline().rstrip('\\r\\n'),sys.stdin.readline().rstrip('\\r\\n')]"
 z='t=iter(sys.stdin.read().split())\n'
 if p==454:return z+'n=int(next(t));args=[[int(next(t)) for _ in range(n)] for _ in range(4)]'
 if p==554:return z+'n=int(next(t));args=[[[int(next(t)) for _ in range(int(next(t)))] for _ in range(n)]]'
 if p==809:return z+'s=next(t);n=int(next(t));args=[s,[next(t) for _ in range(n)]]'
 z+='n=int(next(t));args=[['+('next(t)' if p==2131 else 'int(next(t))')+' for _ in range(n)]]'
 if p in TAIL:z+='\nargs.append('+('float' if p==1870 else 'int')+'(next(t)))'
 return z

def validate(p,a):
 assert type(a) is list
 x=a[0];lower=string.ascii_lowercase
 def ints(v,lo,hi,nlo=1,nhi=100000):assert type(v) is list and nlo<=len(v)<=nhi and all(type(t) is int and lo<=t<=hi for t in v)
 def text(v,chars,nlo,nhi):assert type(v) is str and nlo<=len(v)<=nhi and set(v)<=set(chars)
 if p==20:text(x,'()[]{}',1,10000)
 elif p==448:ints(x,1,len(x))
 elif p==645:
  ints(x,1,len(x),2,10000);assert sorted(Counter(x).values())==[1]*(len(x)-2)+[2]
 elif p==287:
  ints(x,1,len(x)-1,2,100001);assert sum(c>1 for c in Counter(x).values())==1
 elif p==334:ints(x,-2**31,2**31-1,1,500000)
 elif p==128:ints(x,-10**9,10**9,0,100000)
 elif p==454:
  assert len(a)==4
  for row in a:ints(row,-2**28,2**28,len(x),len(x))
  assert 1<=len(x)<=200
 elif p==187:text(x,'ACGT',1,100000)
 elif p==266:text(x,lower,1,5000)
 elif p==1679:ints(x,1,10**9);assert type(a[1]) is int and 1<=a[1]<=10**9
 elif p in {2342,2364}:ints(x,1,10**9)
 elif p==1814:ints(x,0,10**9)
 elif p==1010:ints(x,1,500,1,60000)
 elif p==1657:
  assert len(a)==2
  for s in a:text(s,lower,1,100000)
 elif p==554:
  assert 1<=len(x)<=10000 and sum(map(len,x))<=20000 and len(set(map(sum,x)))==1
  for row in x:ints(row,1,2**31-1,1,10000)
 elif p==1930:text(x,lower,3,100000)
 elif p==2131:
  assert 1<=len(x)<=100000
  for s in x:text(s,lower,2,2)
 elif p==8:text(x,string.ascii_letters+string.digits+' +-.',0,200)
 elif p==65:text(x,string.ascii_letters+string.digits+'+-.',1,20)
 elif p==686:
  for s in a:text(s,lower,1,10000)
 elif p==275:ints(x,0,1000);assert x==sorted(x)
 elif p==809:
  text(x,lower,1,100);assert 1<=len(a[1])<=100
  for s in a[1]:text(s,lower,1,100)
 elif p==1750:text(x,'abc',1,100000)
 elif p==1328:text(x,lower,1,1000);assert x==x[::-1]
 elif p==1763:text(x,string.ascii_letters,1,100)
 elif p==214:text(x,lower,0,50000)
 elif p==1870:
  ints(x,1,100000);h=Fraction(str(a[1]));assert 1<=h<=10**9 and (h*100).denominator==1
 elif p==167:
  ints(x,-1000,1000,2,30000);assert x==sorted(x) and type(a[1]) is int and -1000<=a[1]<=1000
  c=Counter(x);count=sum(v*(v-1)//2 if 2*k==a[1] else v*c.get(a[1]-k,0) if k<a[1]-k else 0 for k,v in c.items());assert count==1
 elif p==16:
  ints(x,-1000,1000,3,500);assert type(a[1]) is int and -10000<=a[1]<=10000
  # Only distinct value triples are needed to validate the unique closest sum.
  c=Counter(x);vals=sorted(c);best=None;answers=set()
  for i,u in enumerate(vals):
   l=i;r=len(vals)-1
   while l<=r:
    v,w=vals[l],vals[r]
    if any(c[t]<need for t,need in Counter((u,v,w)).items()):
     if l==i and c[u]<2:l+=1;continue
     if l==r:break
    else:
     total=u+v+w;dist=abs(total-a[1])
     if best is None or dist<best:best=dist;answers={total}
     elif dist==best:answers.add(total)
    if u+v+w<a[1]:l+=1
    else:r-=1
  assert len(answers)==1
 else:raise AssertionError(p)


def random_args(p,r):
 if p==20:return [''.join(r.choices('()[]{}',k=r.randint(1,12)))]
 if p==448:
  n=r.randint(1,12);return [[r.randint(1,n) for _ in range(n)]]
 if p==645:
  n=r.randint(2,12);x=list(range(1,n+1));i,j=r.sample(range(n),2);x[i]=x[j];r.shuffle(x);return [x]
 if p==287:
  n=r.randint(1,12);d=r.randint(1,n);count=r.randint(2,n+1);x=r.sample([v for v in range(1,n+1) if v!=d],n+1-count)+[d]*count;r.shuffle(x);return [x]
 if p in {334,128}:return [[r.randint(-8,8) for _ in range(r.randint(1 if p==334 else 0,12))]]
 if p==454:
  n=r.randint(1,5);return [[r.randint(-3,3) for _ in range(n)] for _ in range(4)]
 if p==187:
  s=''.join(r.choices('ACGT',k=r.randint(1,12)));return [s*(r.randint(1,3))]
 if p==266:return [''.join(r.choices('abc',k=r.randint(1,7)))]
 if p==1679:return [[r.randint(1,10) for _ in range(r.randint(1,10))],r.randint(1,20)]
 if p in {2342,2364,1814,1010}:return [[r.randint(0 if p==1814 else 1,500) for _ in range(r.randint(1,12))]]
 if p==1657:
  x=''.join(r.choices('abc',k=r.randint(1,10)))
  if r.randrange(2):
   chars=sorted(set(x));mapped=chars[:];r.shuffle(mapped);d=dict(zip(chars,mapped));y=[d[c] for c in x];r.shuffle(y);return [x,''.join(y)]
  return [x,''.join(r.choices('abc',k=r.randint(1,10)))]
 if p==554:
  width=r.randint(1,12);rows=[]
  for _ in range(r.randint(1,8)):
   cuts=[0]+sorted(r.sample(range(1,width),r.randrange(width)))+[width];rows.append([v-u for u,v in zip(cuts,cuts[1:])])
  return [rows]
 if p==1930:return [''.join(r.choices('abcd',k=r.randint(3,12)))]
 if p==2131:return [[r.choice(['ab','ba','aa','bb','ac','ca']) for _ in range(r.randint(1,6))]]
 if p==8:
  return [r.choice(['',' ','   ','+','-',' -',' +','words '])+str(r.randint(-10**10,10**10))+r.choice(['','abc','.3',' 42'])]
 if p==65:
  if r.randrange(2):return [''.join(r.choices('012eE+-.abc',k=r.randint(1,12)))]
  return [r.choice(['','+','-'])+str(r.randint(0,99))+r.choice(['','.','.'+str(r.randint(0,99))])+r.choice(['','e'+str(r.randint(-99,99))])]
 if p==686:return [''.join(r.choices('ab',k=r.randint(1,5))),''.join(r.choices('ab',k=r.randint(1,12)))]
 if p==275:return [sorted(r.randint(0,20) for _ in range(r.randint(1,12)))]
 if p==809:
  return [''.join(r.choices('ab',k=r.randint(1,10))),[''.join(r.choices('ab',k=r.randint(1,8))) for _ in range(r.randint(1,7))]]
 if p==1750:return [''.join(r.choices('abc',k=r.randint(1,10)))]
 if p==1328:
  s=''.join(r.choices('abc',k=r.randint(0,4)));return [s+r.choice('abc')+s[::-1]]
 if p==1763:return [''.join(r.choices('abABcC',k=r.randint(1,12)))]
 if p==214:return [''.join(r.choices('abc',k=r.randint(0,12)))]
 if p==1870:return [[r.randint(1,20) for _ in range(r.randint(1,6))],r.randint(100,1200)/100]
 if p in {167,16}:
  while True:
   x=[r.randint(-10,10) for _ in range(r.randint(2 if p==167 else 3,10))];target=r.randint(-15,15);x.sort() if p==167 else None
   if p==167:
    if sum(u+v==target for u,v in itertools.combinations(x,2))==1:return [x,target]
   else:
    sums={sum(t) for t in itertools.combinations(x,3)};best=min(abs(s-target) for s in sums)
    if sum(abs(s-target)==best for s in sums)==1:return [x,target]
 raise AssertionError(p)

EDGE={
20:[['()[]{}'],['([)]'],['('],['(())']],448:[[[4,3,2,7,8,2,3,1]],[[1,1]],[[1]]],645:[[[1,2,2,4]],[[2,1,2]],[[1,1]]],287:[[[1,3,4,2,2]],[[2,2,2,2]],[[1,1]]],334:[[[2,1,5,0,4,6]],[[1,1,1]],[[1,3,2,4]],[[-2**31,0,2**31-1]]],128:[[[100,4,200,1,3,2]],[[]],[[1,2,2,3]],[[3,2,1]]],454:[[[1,2],[-2,-1],[-1,2],[0,2]],[[0,0],[0,0],[0,0],[0,0]],[[1],[-1],[1],[-1]]],187:[['AAAAACCCCCAAAAACCCCCCAAAAAGGGTTT'],['AAAAAAAAAAA'],['ACGT']],266:[['aab'],['carerac'],['abc'],['a']],1679:[[[1,2,3,4],5],[[3,1,3,4,3],6],[[2],4]],2342:[[[18,43,36,13,7]],[[10,12,19,14]],[[51,71,17,42]],[[1]]],2364:[[[4,1,3,3]],[[1,2,3,4]],[[1,1,1]]],1814:[[[42,11,1,97]],[[0,0]],[[10,1,100,1]]],1010:[[[30,20,150,100,40]],[[60,60,60]],[[30,30]]],1657:[['abc','bca'],['a','aa'],['cabbba','abbccc'],['aab','bbc'],['aaabb','aabbb']],554:[[[1,2,2,1],[3,1,2],[1,3,2],[2,4],[3,1,2],[1,3,1,1]]],1930:[['aabca'],['adc'],['bbcbaba'],['aaaaa']],2131:[[['lc','cl','gg']],[['ab','ty','yt','lc','cl','ab']],[['aa','bb']],[['aa','aa','aa']]],8:[['   -42'],['4193 with words'],['words and 987'],['-91283472332'],['+'],[''],['2147483648'],['  +0012a42']],65:[['2'],['-0.1'],['3.'],['.1'],['2e10'],['e3'],['1e'],['+'],['.'],['nan']],686:[['abcd','cdabcdab'],['a','aa'],['a','b']],275:[[[0,1,3,5,6]],[[0]],[[1]],[[100,100]]],809:[['heeellooo',['hello','hi','helo']],['ab',['aab','ab']],['aa',['a']]],1750:[['ca'],['cabaabac'],['aabccabba'],['aaa'],['a']],1328:[['abccba'],['a'],['aba'],['aa']],1763:[['YazaAay'],['a'],['dDzeE'],['BbAa']],214:[['aacecaaa'],['abcd'],[''],['a']],1870:[[[1,3,2],6.0],[[1,3,2],2.7],[[1,3,2],1.9],[[1,1],1.01]],167:[[[2,7,11,15],9],[[-1,0],-1],[[0,0,3],0]],16:[[[ -1,2,1,-4],1],[[0,0,0],1],[[1,1,1,0],-100]],
}
EDGE[554]+=[[[1],[1],[1]],[[1,1],[2]]]
PRESSURE={
20:[(['('*5000+')'*5000],1),(['('*5000+')'*4999+']'],0)],448:[([[1]*100000],list(range(2,100001)))],645:[([list(range(1,10000))+[9999]],[9999,10000])],287:[([[100000]*100001],100000)],334:[([[0]*499998+[1,2]],1),([[0]*500000],0)],128:[([list(range(-50000,50000))],100000),([[-10**9,10**9]],1)],454:[([[0]*200 for _ in range(4)],1600000000),([[-2**28]*200,[-2**28]*200,[2**28]*200,[2**28]*200],1600000000)],187:[(['ACGT'*25000],['ACGTACGTAC','CGTACGTACG','GTACGTACGT','TACGTACGTA'])],266:[(['a'*4999+'b'],0),(['a'*5000],1)],1679:[([[500000000]*100000,1000000000],50000)],2342:[([[1000000000]*100000],2000000000)],2364:[([[1]*100000],4999950000)],1814:[([[0]*100000],999949972)],1010:[([[60]*60000],1799970000)],1657:[(['a'*50000+'b'*50000,'b'*50000+'a'*50000],1)],554:[([[[2**31-1,2**31-1]]*10000],0),([[[2**31-1]]*10000],10000),([[[1]*10000,[1]*10000]],0)],1930:[([(string.ascii_lowercase*3847)[:100000]],676)],2131:[([['aa']*100000],200000)],8:[(['9'*200],2**31-1),(['-'+'9'*199],-2**31)],65:[(['1'*16+'e+12'],1),(['1'*19+'e'],0)],686:[(['a'*10000,'a'*9999+'b'],-1),(['a','a'*10000],10000)],275:[([[1000]*100000],1000)],809:[(['a'*100,['a']*100],100)],1750:[(['a'*100000],0),(['a'+'b'*99998+'c'],100000)],1328:[(['z'*1000],'a'+'z'*999)],1763:[(['aA'*50],'aA'*50)],214:[(['a'+'b'*49999],'b'*49999+'a'+'b'*49999)],1870:[([[100000]*100000,100000.0],100000),([[1]*99999+[100000],99999.01],10000000),([[100000],1000000000.0],1)],167:[([[-1000,1]+[1000]*29998,-999],[1,2])],16:[([[1000]*500,-10000],3000)],
}

WRONG={
20:[('only checks counts',"result=int(all(x.count(l)==x.count(r) for l,r in ['()','[]','{}']))"),('accepts only adjacent pairs',"result=int(len(x)%2==0 and all(x[i:i+2] in ['()','[]','{}'] for i in range(0,len(x),2)))")],
448:[('reports duplicates instead of missing values',"result=[v for v,c in Counter(x).items() if c>1]"),('excludes upper endpoint',"result=[v for v in range(1,len(x)) if v not in set(x)]")],
645:[('reverses result fields',"c=Counter(x);result=[next(i for i in range(1,len(x)+1) if i not in c),next(i for i in c if c[i]==2)]"),('assumes equal values are adjacent',"d=next((x[i] for i in range(len(x)-1) if x[i]==x[i+1]),x[0]);result=[d,len(x)*(len(x)+1)//2-sum(x)+d]")],
287:[('uses sum difference despite repeated copies',"result=sum(x)-(len(x)-1)*len(x)//2"),('assumes a duplicate must be adjacent',"result=next((x[i] for i in range(len(x)-1) if x[i]==x[i+1]),-1)")],
334:[('only checks contiguous triples',"result=int(any(x[i]<x[i+1]<x[i+2] for i in range(len(x)-2)))"),('allows equal values',"result=int(any(u<=v<=w for u,v,w in itertools.combinations(x,3)))")],
128:[('does not deduplicate sorted values',"s=sorted(x);best=run=0;previous=None\nfor v in s:\n run=run+1 if previous is not None and v==previous+1 else 1;best=max(best,run);previous=v\nresult=best"),('requires input order to be consecutive',"best=run=0;previous=None\nfor v in x:\n run=run+1 if previous is not None and v==previous+1 else 1;best=max(best,run);previous=v\nresult=best")],
454:[('deduplicates value tuples',"result=len({t for t in itertools.product(*args) if sum(t)==0})"),('only combines matching indices',"result=sum(sum(t)==0 for t in zip(*args))")],
187:[('requires nonoverlapping repeated occurrences',"result=sorted({x[i:i+10] for i in range(len(x)-9) if x[i:i+10] in x[i+10:]})"),('returns every observed length ten substring',"result=sorted({x[i:i+10] for i in range(len(x)-9)})")],
266:[('requires original order to be a palindrome',"result=int(x==x[::-1])"),('requires all frequencies even',"result=int(all(c%2==0 for c in Counter(x).values()))")],
1679:[('counts all pairs without removing used elements',"result=sum(u+v==args[1] for u,v in itertools.combinations(x,2))"),('pairs each value with itself even without another copy',"c=Counter(x);result=sum(min(v,c.get(args[1]-k,0)) for k,v in c.items())//2 + int(any(2*k==args[1] and v%2 for k,v in c.items()))")],
2342:[('groups by last digit only',"result=max([-1]+[u+v for u,v in itertools.combinations(x,2) if u%10==v%10])"),('reuses one element for both positions',"result=2*max(x)")],
2364:[('counts good pairs instead',"result=sum(j-i==x[j]-x[i] for i,j in itertools.combinations(range(len(x)),2))"),('uses value plus index as group key',"result=sum(x[i]+i!=x[j]+j for i,j in itertools.combinations(range(len(x)),2))")],
1814:[('counts self pairs too',"result=sum(u+int(str(v)[::-1])==v+int(str(u)[::-1]) for i,u in enumerate(x) for v in x[i:])%1000000007"),('groups only by reversed number',"c=Counter(int(str(v)[::-1]) for v in x);result=sum(n*(n-1)//2 for n in c.values())%1000000007")],
1010:[('accepts only a sum of sixty',"result=sum(u+v==60 for u,v in itertools.combinations(x,2))"),('includes self pairs',"result=sum((u+v)%60==0 for i,u in enumerate(x) for v in x[i:])")],
1657:[('ignores which letters exist',"result=int(sorted(Counter(x).values())==sorted(Counter(args[1]).values()))"),('only allows rearrangement without renaming',"result=int(Counter(x)==Counter(args[1]))")],
554:[('allows cutting at outer edge',"result=0"),('only counts first internal boundary',"c=Counter(row[0] for row in x if len(row)>1);result=len(x)-max(c.values(),default=0)")],
1930:[('counts index triples rather than distinct strings',"result=sum(x[i]==x[k] for i,j,k in itertools.combinations(range(len(x)),3))"),('only counts contiguous palindromes',"result=len({x[i:i+3] for i in range(len(x)-2) if x[i]==x[i+2]})")],
2131:[('uses every symmetric word as a center',"c=Counter(x);result=sum(2*v if s==s[::-1] else 4*min(v,c[s[::-1]]) if s<s[::-1] else 0 for s,v in c.items())"),('forgets an unmatched center',"c=Counter(x);result=sum(4*(v//2) if s==s[::-1] else 4*min(v,c[s[::-1]]) if s<s[::-1] else 0 for s,v in c.items())")],
8:[('extracts digits after arbitrary leading words',"m=re.search(r'[+-]?[0-9]+',x);result=max(-2**31,min(2**31-1,int(m[0]))) if m else 0"),('omits signed integer clamping',"m=re.match(r' *([+-]?[0-9]+)',x);result=int(m[1]) if m else 0")],
65:[('uses float parser accepting nan',"try:float(x);result=1\nexcept ValueError:result=0"),('requires digits on both sides of decimal point',"result=int(re.fullmatch(r'[+-]?[0-9]+(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?',x) is not None)")],
686:[('tests only ceil target length copies',"k=(len(args[1])+len(x)-1)//len(x);result=k if args[1] in x*k else -1"),('accepts matching character sets without order',"result=(len(args[1])+len(x)-1)//len(x) if set(args[1])<=set(x) else -1")],
275:[('returns maximum citations as h index',"result=max(x)"),('uses strict citation comparison',"result=max(h for h in range(len(x)+1) if sum(v>h for v in x)>=h)")],
809:[('allows all run contraction lengths',"a=[(c,len(list(g))) for c,g in itertools.groupby(x)];result=0\nfor w in args[1]:\n b=[(c,len(list(g))) for c,g in itertools.groupby(w)];result+=int(len(a)==len(b) and all(c==d and n>=m for (c,n),(d,m) in zip(a,b)))"),('only matches run letters ignoring lengths',"result=sum([c for c,g in itertools.groupby(w)]==[c for c,g in itertools.groupby(x)] for w in args[1])")],
1750:[('deletes only one matching pair',"result=len(x)-2 if len(x)>1 and x[0]==x[-1] else len(x)"),('always preserves the last character',"i=0;j=len(x)-1\nwhile i<j and x[i]==x[j]:\n c=x[i]\n while i<j and x[i]==c:i+=1\n while i<j and x[j]==c:j-=1\nresult=j-i+1")],
1328:[('modifies center when it is first non a',"s=list(x);i=next((i for i,c in enumerate(s) if c!='a'),len(s)-1);s[i]='a' if s[i]!='a' else 'b';result=''.join(s) if len(s)>1 else ''"),('changes first a to b as fallback',"s=list(x);i=next((i for i in range(len(s)//2) if s[i]!='a'),0);s[i]='a' if s[i]!='a' else 'b';result=''.join(s) if len(s)>1 else ''")],
1763:[('chooses latest tied longest substring',"result=''\nfor i in range(len(x)):\n for j in range(i+1,len(x)+1):\n  s=x[i:j]\n  if len(s)>=len(result) and all(c.swapcase() in s for c in s):result=s"),('only requires one uppercase and one lowercase',"result=''\nfor i in range(len(x)):\n for j in range(i+1,len(x)+1):\n  s=x[i:j]\n  if len(s)>len(result) and any(c.isupper() for c in s) and any(c.islower() for c in s):result=s")],
214:[('adds reversed whole string',"result=x[::-1]+x"),('appends instead of prepending',"i=next(i for i in range(len(x)+1) if x[i:]==x[i:][::-1]);result=x+x[:i][::-1]")],
1870:[('rounds final leg upward too',"result=next((v for v in range(1,10001) if sum((d+v-1)//v for d in x)<=args[1]),-1)"),('ignores waiting between legs',"result=math.ceil(sum(x)/args[1])")],
167:[('returns zero based indices',"result=next([i,j] for i,j in itertools.combinations(range(len(x)),2) if x[i]+x[j]==args[1])"),('allows reusing one index',"result=next([i+1,j+1] for i in range(len(x)) for j in range(i,len(x)) if x[i]+x[j]==args[1])")],
16:[('only checks contiguous triples',"result=min((sum(x[i:i+3]) for i in range(len(x)-2)),key=lambda v:abs(v-args[1]))"),('returns distance instead of sum',"result=min(abs(sum(t)-args[1]) for t in itertools.combinations(x,3))")],
}
EDGE[645].append([[1,3,2,2]])
EDGE[187].append(['ACGTACGTAA'])
EDGE[167].append([[1,2,3],4])
EDGE[16].append([[0,10,1,2],3])
EDGE[809].append(['ab',['aab']])
EDGE[686].append(['ab','ba'])

META={
20:('有效的括号','Valid Parentheses','判断括号是否按类型正确配对且闭合顺序正确。','Determine whether all brackets match by type and close in the correct order.','一行s，长度1..10000，仅含()[]{}。','One line s of length 1..10000, containing only ()[]{}.'),
448:('找到所有数组中消失的数字','Find All Numbers Disappeared in an Array','返回1到n中所有未出现在数组的整数。','Return every integer in 1..n absent from the array.','n在1..100000，数组值在1..n。','n is 1..100000; array values are 1..n.'),
645:('错误的集合','Set Mismatch','1到n中的一个数被另一个数替换，造成一个数恰好出现两次、另一个缺失。依次返回重复数、缺失数。','One number in 1..n was replaced by another, leaving one duplicated number and one missing number. Return [duplicate, missing].','n在2..10000，值在1..n；保证恰有一个重复值和一个缺失值。','n is 2..10000; values are 1..n, with exactly one duplicate and one missing value.'),
287:('寻找重复数','Find the Duplicate Number','数组长度为n+1，所有值在1到n；仅一个值重复，重复次数可以超过两次。返回该值，不修改输入数组。','An array has n+1 entries in 1..n. Exactly one distinct value occurs more than once, possibly more than twice. Return that value without modifying the input array.','第一行长度m=n+1；第二行m个整数。1≤n≤100000，值在1..n，保证只有一个不同的重复值。','First line m=n+1; second line m integers. 1≤n≤100000; values are 1..n and exactly one distinct value is repeated.'),
334:('递增的三元子序列','Increasing Triplet Subsequence','是否存在i<j<k且nums[i]<nums[j]<nums[k]？元素不必相邻。','Determine whether i<j<k exist with nums[i]<nums[j]<nums[k]; elements need not be adjacent.','n在1..500000，值在−2147483648..2147483647。','n is 1..500000; values are −2147483648..2147483647.'),
128:('最长连续序列','Longest Consecutive Sequence','忽略数组顺序，返回能够组成整数连续序列的最大长度；重复值不增加长度，空数组返回0。','Ignoring input order, return the longest run of consecutive integer values. Duplicates do not increase its length; an empty array gives 0.','n在0..100000，值在−1000000000..1000000000；n为0时第二行为空。','n is 0..100000; values are −1000000000..1000000000. When n=0, the second line is empty.'),
454:('四数相加 II','4Sum II','从四个数组各选一个下标，统计四个值之和为0的下标四元组数量；相同值在不同下标处仍是不同选择。','Choose one index from each of four arrays. Count index quadruples whose values sum to zero; equal values at different indices remain distinct choices.','第一行n，随后四行，每行n个整数。1≤n≤200，值在−268435456..268435456。','First line n, then four lines of n integers each. 1≤n≤200; values are −268435456..268435456.'),
187:('重复的DNA序列','Repeated DNA Sequences','返回所有出现至少两次的长度10连续子串，出现位置可以重叠，每个结果只返回一次。','Return all length-10 contiguous substrings occurring at least twice. Occurrences may overlap; include each result once.','一行s，长度1..100000，仅含ACGT。','One line s of length 1..100000, containing only ACGT.'),
266:('回文排列','Palindrome Permutation','判断能否重排全部字符得到一个回文串。','Determine whether all characters can be rearranged into a palindrome.','一行小写英文字母串s，长度1..5000。','One lowercase English string s, length 1..5000.'),
1679:('K和数对的最大数目','Max Number of K-Sum Pairs','每次移除两个和为k的元素，返回最多能进行的操作次数；每个下标只能用一次。','Each operation removes two elements summing to k. Maximize operations; each index may be used only once.','n在1..100000，数组值和k都在1..1000000000。','n is 1..100000; array values and k are 1..1000000000.'),
2342:('数位和相等数对的最大和','Max Sum of a Pair With Equal Sum of Digits','选择不同下标且十进制数位和相等的两个数，返回最大的两数之和；无合法数对时返回−1。','Choose two distinct indices whose values have equal decimal digit sums. Return their maximum sum, or −1 if no pair exists.','n在1..100000，值在1..1000000000。','n is 1..100000; values are 1..1000000000.'),
2364:('统计坏数对的数目','Count Number of Bad Pairs','统计i<j且j−i不等于nums[j]−nums[i]的下标对，使用从0开始的下标。','Count zero-based index pairs i<j for which j−i differs from nums[j]−nums[i].','n在1..100000，值在1..1000000000。','n is 1..100000; values are 1..1000000000.'),
1814:('统计一个数组中好对子的数目','Count Nice Pairs in an Array','rev将十进制数字反转并丢弃前导零，rev(0)=0。统计i<j且nums[i]+rev(nums[j])=nums[j]+rev(nums[i])的数对，结果模1000000007。','rev reverses decimal digits and discards leading zeros, with rev(0)=0. Count i<j satisfying nums[i]+rev(nums[j])=nums[j]+rev(nums[i]), modulo 1000000007.','n在1..100000，值在0..1000000000。','n is 1..100000; values are 0..1000000000.'),
1010:('总持续时间可被60整除的歌曲','Pairs of Songs With Total Durations Divisible by 60','统计不同歌曲下标i<j且时长之和可被60整除的数对。','Count pairs of distinct song indices i<j whose durations sum to a multiple of 60.','n在1..60000，时长在1..500。','n is 1..60000; durations are 1..500.'),
1657:('确定两个字符串是否接近','Determine if Two Strings Are Close','可任意交换两个位置，也可选择两个已存在的字符，将它们的所有出现相互替换。判断能否将word1变成word2。','You may swap any two positions, or choose two existing characters and exchange every occurrence of those characters. Determine whether word1 can become word2.','两行分别为word1和word2，均为小写英文字母，长度各在1..100000。','Two lines: word1 and word2. Both contain lowercase English letters and have lengths 1..100000.'),
554:('砖墙','Brick Wall','所有行等宽。画一条不在墙两侧边缘的竖线，经过砖之间的缝隙不算穿砖，求最少穿过的砖数。','All rows have equal width. Draw a vertical line strictly inside the wall; passing through a brick edge does not count as crossing a brick. Minimize crossed bricks.','第一行行数n；随后每行先给该行砖数k，再给k个宽度。1≤n≤10000，每行1..10000块，总砖数≤20000；宽度1..2147483647；各行宽度总和相等。','First line row count n. Each following row gives brick count k followed by k widths. 1≤n≤10000; 1..10000 bricks per row; at most 20000 bricks total; widths 1..2147483647. All row width sums are equal.'),
1930:('长度为3的不同回文子序列','Unique Length-3 Palindromic Subsequences','选i<j<k构造长度3的回文子序列。返回不同结果字符串的数量，相同字符串的不同下标选择只计一次。','Choose i<j<k to form a length-3 palindromic subsequence. Count distinct resulting strings, counting repeated index choices for the same string only once.','一行小写英文字母串s，长度3..100000。','One lowercase English string s, length 3..100000.'),
2131:('连接两字母单词得到的最长回文串','Longest Palindrome by Concatenating Two Letter Words','任意选取并重排数组中的单词进行连接，每个下标最多使用一次。返回能组成的最长回文串字符数。','Select and reorder words, using each index at most once, and concatenate them. Return the maximum character length of a palindrome obtainable.','第一行n；第二行n个空白分隔单词。1≤n≤100000，每个单词恰含两个小写英文字母。','First line n; second line n whitespace-separated words. 1≤n≤100000; each word has exactly two lowercase English letters.'),
8:('字符串转换整数','String to Integer (atoi)','先跳过开头空格，读取一个可选正负号，再读取连续数字，遇到其他字符立即停止。没有数字返回0；结果截断到有符号32位整数范围。','Skip leading spaces, read an optional sign, then consecutive decimal digits until another character occurs. Return 0 if no digits were read; clamp the result to the signed 32-bit integer range.','读取完整一行s，保留空格，允许空行。长度0..200；仅含英文字母、数字、空格、+、−和小数点（减号使用ASCII -）。','Read one complete line s, preserving spaces; it may be empty. Length 0..200; allowed characters are English letters, digits, space, ASCII + and -, and dot.'),
65:('有效数字','Valid Number','合法数由可选符号、整数或小数，以及可选指数组成。小数点两侧至少一侧有数字；指数为e/E后接可选符号和至少一位整数数字，不允许空白或其他字母。','A valid number has an optional sign, an integer or decimal mantissa, and an optional exponent. A decimal requires digits on at least one side of the dot. An exponent is e/E followed by an optional sign and one or more digits. Whitespace and other letters are invalid.','一行s，长度1..20；输入字符限英文字母、数字、ASCII +、-和小数点。','One line s, length 1..20; input characters are English letters, digits, ASCII + and -, and dot.'),
686:('重复叠加字符串匹配','Repeated String Match','把a重复连接若干次，使b成为连续子串，返回最少重复次数；不可能则返回−1。','Repeat a until b is a contiguous substring. Return the minimum repetition count, or −1 if impossible.','两行分别为a和b，均由小写英文字母组成，长度各在1..10000。','Two lines a and b, each containing lowercase English letters, with lengths 1..10000.'),
275:('H指数 II','H-Index II','引用数已排序。返回最大的h，使至少h篇论文分别有至少h次引用。','Citation counts are sorted. Return the largest h such that at least h papers have at least h citations each.','n在1..100000，引用数在0..1000，按非递减顺序排列。','n is 1..100000; citation counts are 0..1000 in nondecreasing order.'),
809:('情感丰富的文字','Expressive Words','可将单词中的同字符连续段扩展，但扩展后的段长必须至少为3。统计words中能扩展为s的单词数量；相同单词的不同下标分别计数。','A run of equal characters may be expanded only if its resulting length is at least 3. Count words that can be expanded into s; equal words at different indices count separately.','第一行s，第二行单词数量n，第三行n个空白分隔单词。1≤n≤100，s和每个单词长度1..100，均仅含小写英文字母。','First line s; second line word count n; third line n whitespace-separated words. 1≤n≤100; s and each word have lengths 1..100 and use lowercase English letters only.'),
1750:('删除字符串两端相同字符后的最短长度','Minimum Length of String After Deleting Similar Ends','每次选择不重叠的非空前缀与后缀，要求两段都只包含同一种字符，然后同时删除。返回最短剩余长度。','Each operation removes a nonempty prefix and suffix that do not overlap and both consist entirely of the same character. Return the minimum remaining length.','一行s，长度1..100000，仅含abc。','One line s, length 1..100000, containing only abc.'),
1328:('破坏回文串','Break a Palindrome','将给定回文串恰好一个字符改为其他小写字母，使结果不再是回文，并取得字典序最小结果；不可能则返回空串。','Replace exactly one character of the given palindrome with another lowercase letter. Return the lexicographically smallest result that is not a palindrome, or an empty string if impossible.','一行小写英文字母串，长度1..1000，保证原串是回文。','One lowercase English string of length 1..1000, guaranteed to be a palindrome.'),
1763:('最长的美好子字符串','Longest Nice Substring','若子串中的每个字母都同时出现大小写，则称为美好。返回最长的美好连续子串，并列取出现最早的；不存在则返回空串。','A substring is nice if each letter in it appears in both uppercase and lowercase. Return the longest nice contiguous substring, breaking ties by earliest position; return an empty string if none exists.','一行s，长度1..100，仅含大小写英文字母。','One line s of length 1..100, containing uppercase and lowercase English letters only.'),
214:('最短回文串','Shortest Palindrome','只能在s前面添加字符，返回这样得到的最短回文串。','Add characters only before s and return the shortest resulting palindrome.','一行小写英文字母串s，长度0..50000，允许空行。','One lowercase English string s of length 0..50000; an empty line is allowed.'),
1870:('准时到达的列车最小时速','Minimum Speed to Arrive on Time','依次乘坐列车，所有列车速度为同一正整数。除末段外，每段结束后必须等到下一个整数小时才能出发，已在整数时刻则不等待。返回在hour小时内到达的最小速度，不可能则−1；有解时答案不超过10000000。','Take trains in order at a common positive integer speed. Before each ride after the first, wait until the next integer hour, with no wait if already at an integer time. Return the minimum speed arriving within hour, or −1 if impossible. A feasible answer is guaranteed not to exceed 10000000.','n在1..100000，距离在1..100000；最后一行hour在1..1000000000，最多两位小数。','n is 1..100000; distances are 1..100000. The last line is hour in 1..1000000000 with at most two decimal places.'),
167:('两数之和 II - 输入有序数组','Two Sum II - Input Array Is Sorted','找出两个不同下标，其值之和为target，依次返回较小和较大的下标，下标从1开始。保证恰有一组下标答案。','Find two distinct indices whose values sum to target. Return the smaller then larger index, using one-based indices. Exactly one index pair is guaranteed.','n在2..30000，数组非递减，值与target都在−1000..1000，保证唯一答案。','n is 2..30000; the array is nondecreasing; values and target are −1000..1000; the answer is unique.'),
16:('最接近的三数之和','3Sum Closest','选择三个不同下标，使三数之和最接近target。返回三数之和而非距离，保证最接近的和值唯一。','Choose three distinct indices whose values sum closest to target. Return the sum, not its distance to target. The closest sum is guaranteed unique.','n在3..500，值在−1000..1000，target在−10000..10000；保证最接近和值唯一。','n is 3..500; values are −1000..1000; target is −10000..10000; the closest sum is unique.'),
}

def kind(p):return 'integer-set' if p==448 else 'string-set' if p==187 else 'integer-array' if p in {645,167} else 'string' if p in {1328,1763,214} else 'integer'

def make(p):
 zh,en,dz,de,iz,ie=META[p];k=kind(p)
 if p not in TEXT|{287,454,1657,554,686,2131,809}:
  iz='第一行数组长度n，第二行n个空白分隔整数。'+('第三行'+{1679:'k',167:'target',16:'target',1870:'hour'}[p]+'。' if p in TAIL else '')+iz
  ie='First line: array length n; second line: n whitespace-separated integers. '+('Third line: '+{1679:'k',167:'target',16:'target',1870:'hour'}[p]+'. ' if p in TAIL else '')+ie
 if k=='integer':oz='输出一个整数。'+('真为1，假为0。' if p in {20,334,266,1657,65} else '');oe='Print one integer.'+(' Use 1 for true and 0 for false.' if p in {20,334,266,1657,65} else '');emit='print(result)'
 elif k=='string':oz='输出结果原文和换行，不加引号；空串输出空行。';oe='Print the raw result followed by a newline, without quotes; an empty string is a blank line.';emit='print(result)'
 elif k=='string-set':oz='第一行输出数量，随后每行一个结果字符串；顺序任意，不得重复。';oe='Print the count first, then one result string per line in any order without duplicates.';emit="print(len(result));print('\\n'.join(result)) if result else None"
 else:
  oz='第一行输出数量，随后用空白分隔所有整数。'+('顺序任意，不得重复。' if k=='integer-set' else '按题目规定顺序输出。');oe='Print the count first, then all integers separated by whitespace. '+('Any order without duplicates is allowed.' if k=='integer-set' else 'Use the order specified in the statement.');emit="print(len(result));print(' '.join(map(str,result))) if result else None"
 return dict(method=METHODS[p],titleZh=zh,titleEn=en,descriptionZh=dz,descriptionEn=de,inputZh=iz,inputEn=ie,outputZh=oz,outputEn=oe,difficulty='中等',resultKind=k,outputLimit={448:1024,187:2048,214:128}.get(p,64),edges=EDGE[p],pressure=PRESSURE[p],random_args=lambda r:random_args(p,r),oracle=lambda a:oracle(p,a),encode=lambda a:encode(p,a),parse=parse(p),validate=lambda a:validate(p,a),mutants=[dict(name=name,source='import sys,re,itertools,math\nfrom collections import Counter\n'+parse(p)+'\nx=args[0]\n'+body+'\n'+emit+'\n') for name,body in WRONG[p]])

EDGE[554]=[[[[1,2,2,1],[3,1,2],[1,3,2],[2,4],[3,1,2],[1,3,1,1]]],[[[1],[1],[1]]],[[[1,1],[2]]]]
EDGE[287].extend([[[1,1,1,1]],[[1,3,4,2,3]]])
EDGE[16].append([[-1000,-1000,-1000],10000])
PROBLEMS={p:make(p) for p in IDS}
PROBLEMS[645]['edges'].append([[1,2,3,2]])
