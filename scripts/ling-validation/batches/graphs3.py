"""Original scalar-output math/graph fixtures, checked against local source constraints."""
import math
import itertools
from collections import deque
from functools import lru_cache
from .graphs import scalar_codec, SCALAR_PARSE
MOD=1000000007
PROBLEMS={}

def small_oracle(pid,a):
 n=a[0]
 if pid==223:
  x1,y1,x2,y2,u1,v1,u2,v2=a
  return sum((x1<=x<x2 and y1<=y<y2) or (u1<=x<u2 and v1<=y<v2) for x in range(min(x1,u1),max(x2,u2)) for y in range(min(y1,v1),max(y2,v2)))
 if pid==357:return sum(len(set(str(x)))==len(str(x)) for x in range(10**n))
 if pid==365:
  x,y,t=a;q=deque([(0,0)]);seen={(0,0)}
  while q:
   u,v=q.popleft()
   if t in (u,v,u+v):return 1
   uv=min(u,y-v);vu=min(v,x-u)
   for nxt in ((x,v),(u,y),(0,v),(u,0),(u-uv,v+uv),(u+vu,v-vu)):
    if nxt not in seen:seen.add(nxt);q.append(nxt)
  return 0
 if pid==390:
  values=list(range(1,n+1));right=False
  while len(values)>1:
   values=values[::-1] if right else values
   values=values[1::2]
   if right:values.reverse()
   right=not right
  return values[0]
 if pid==458:
  buckets,die,test=a;states=test//die+1;p=0
  while states**p<buckets:p+=1
  return p
 if pid==625:
  if n==1:return 1
  choices=[]
  def factors(left,lo,digits):
   if left==1:
    value=int(''.join(map(str,digits)));choices.append(value);return
   for d in range(lo,10):
    if left%d==0:factors(left//d,d,digits+[d])
  factors(n,2,[]);best=min(choices,default=0)
  return best if best<=2147483647 else 0
 if pid==660:
  x=count=0
  while count<n:
   x+=1
   if '9' not in str(x):count+=1
  return x
 if pid==829:return sum(sum(range(start,start+k))==n for start in range(1,n+1) for k in range(1,math.isqrt(2*n)+2))
 if pid==858:
  p,q=a;height=q;width=p
  # Track successive unfolded wall hits until the height is a corner multiple.
  hit=1
  while height%p:hit+=1;height+=q
  return 1 if hit%2 and (height//p)%2 else 0 if hit%2 else 2
 if pid in (878,1201):
  wanted=a[0];divs=a[1:];count=0;x=0
  while count<wanted:
   x+=1
   if any(x%d==0 for d in divs):count+=1
  return x%MOD if pid==878 else x
 if pid==1015:
  remainder=0;seen=set()
  for length in range(1,n+2):
   remainder=(10*remainder+1)%n
   if remainder==0:return length
   if remainder in seen:return -1
   seen.add(remainder)
 if pid==1359:
  # Enumerate all action permutations and enforce pickup preceding delivery.
  return sum(all(p.index(i)<p.index(i+n) for i in range(n)) for p in itertools.permutations(range(2*n)))%MOD
 if pid==1387:
  lo,hi,k=a
  def power(x):
   steps=0
   while x!=1:x=x//2 if x%2==0 else 3*x+1;steps+=1
   return steps
  return sorted(range(lo,hi+1),key=lambda x:(power(x),x))[k-1]
 if pid==1401:
  r,cx,cy,x1,y1,x2,y2=a
  # The nearest point on an integral axis-aligned rectangle to an integral center is integral.
  return int(any((x-cx)**2+(y-cy)**2<=r*r for x in range(x1,x2+1) for y in range(y1,y2+1)))
 if pid==1414:
  fib=[1,2]
  while fib[-1]<n:fib.append(sum(fib[-2:]))
  q=deque([(0,0)]);seen={0}
  while q:
   x,d=q.popleft()
   if x==n:return d
   for f in fib:
    if x+f<=n and x+f not in seen:seen.add(x+f);q.append((x+f,d+1))
 if pid==1806:
  perm=list(range(n));count=0
  while True:
   perm=[perm[i//2] if i%2==0 else perm[n//2+(i-1)//2] for i in range(n)];count+=1
   if perm==list(range(n)):return count
 if pid==2549:
  found={n}
  for _ in range(n):
   nxt=found|{i for x in found for i in range(1,n+1) if x%i==1}
   if nxt==found:break
   found=nxt
  return len(found)
 if pid==2566:
  values=[int(str(n).replace(str(i),str(j))) for i in range(10) for j in range(10)]
  return max(values)-min(values)
 if pid==2843:
  lo,hi=a
  return sum(len(str(x))%2==0 and sum(map(int,str(x)[:len(str(x))//2]))==sum(map(int,str(x)[len(str(x))//2:])) for x in range(lo,hi+1))
 raise KeyError(pid)

META={
223:('computeArea','矩形面积','Rectangle Area','两轴对齐矩形分别由左下、右上坐标定义，返回它们覆盖的总面积，交集只计一次。允许矩形退化成线或点。','Two axis-aligned rectangles are specified by lower-left and upper-right coordinates. Return their total covered area, counting overlap once. Degenerate rectangles with zero area are allowed.',[(-10000,10000)]*8),
357:('countNumbersWithUniqueDigits','统计各位数字都不同的数字个数','Count Numbers with Unique Digits','统计 0≤x<10^n 中十进制各位互不相同的整数；0 也计入，通常十进制表示不加前导零。','Count integers 0≤x<10^n with distinct decimal digits. Include zero and do not pad representations with leading zeroes.',[(0,8)]),
365:('canMeasureWater','水壶问题','Water and Jug Problem','容量 x,y 的两个壶起初为空，可装满、清空或向另一个壶倒水至源空或目标满。判断能否使一个壶或两壶合计恰有 target 单位水。','Two initially empty jugs have capacities x,y. Fill, empty, or pour until the source empties or destination fills. Determine whether one jug or both together can hold exactly target units.',[(1,1000)]*3),
390:('lastRemaining','消除游戏','Elimination Game','整数 1 到 n 升序排列，先从左到右删除第一个及其后每隔一个数，再从右到左同样删除，方向交替直到剩一个数，返回它。','Start with ordered integers 1 through n. Delete the first and every other number left-to-right, then similarly right-to-left. Alternate directions until one remains and return it.',[(1,1000000000)]),
458:('poorPigs','可怜的小猪','Poor Pigs','buckets 桶中恰有一桶有毒，喝毒药后恰在 minutesToDie 分钟死亡。允许同轮混喝多桶并安排多轮测试，要求在 minutesToTest 分钟内确定毒桶，求最少小猪数。','Exactly one of buckets is poisoned. A pig drinking poison dies after minutesToDie minutes. Pigs may drink mixtures and testing may use multiple rounds. Find minimum pigs identifying the bucket within minutesToTest minutes.',[(1,1000),(1,100),(1,100)]),
625:('smallestFactorization','最小因式分解','Minimum Factorization','求十进制各位数字乘积为 num 的最小正整数。如果不存在，或结果超过有符号32位最大整数，返回 0。','Return the least positive integer whose decimal digits multiply to num. Return 0 if none exists or it exceeds signed 32-bit maximum.',[(1,2147483647)]),
660:('newInteger','移除 9','Remove 9','从正整数序列中删掉十进制表示含数字 9 的所有整数，返回剩余序列第 n 个数（从1开始）。','Remove all positive integers whose decimal representation contains digit 9. Return the nth remaining integer, using one-based indexing.',[(1,800000000)]),
829:('consecutiveNumbersSum','连续整数求和','Consecutive Numbers Sum','统计把 n 写成一个或多个连续正整数之和的方法数。','Count representations of n as the sum of one or more consecutive positive integers.',[(1,1000000000)]),
858:('mirrorReflection','镜面反射','Mirror Reflection','边长 p 的正方形镜室，光线从西南角发出，第一次到东墙时距地面 q。东南、东北、西北角感受器分别编号0、1、2，返回首先到达的感受器。','In a square mirror room of side p, a ray starts southwest and first hits the east wall at height q. Receptors southeast, northeast and northwest are numbered 0,1,2. Return the first receptor reached.',[(1,1000)]*2),
878:('nthMagicalNumber','第 N 个神奇数字','Nth Magical Number','正整数能被 a 或 b 整除即为神奇数字，返回第 n 个神奇数字模 1000000007，重复只计一次。','A positive integer is magical if divisible by a or b. Return the nth such number modulo 1000000007, counting duplicates once.',[(1,1000000000),(2,40000),(2,40000)]),
1015:('smallestRepunitDivByK','可被 K 整除的最小整数','Smallest Integer Divisible by K','求仅含数字 1 且能被 k 整除的最短正整数的位数；不存在返回 -1。','Return the shortest length of a positive decimal integer containing only 1s and divisible by k, or -1 if none exists.',[(1,100000)]),
1201:('nthUglyNumber','丑数 III','Ugly Number III','求能被 a、b、c 中至少一个整除的第 n 个正整数，重复只计一次。','Return the nth positive integer divisible by at least one of a,b,c, counting duplicates once.',[(1,1000000000)]*4),
1359:('countOrders','有效的快递序列数目','Count All Valid Pickup and Delivery Options','n 个互不相同的订单各有一次取件和送达，要求每单取件早于送达。返回这 2n 个动作的合法排列数模1000000007。','Each of n distinct orders has one pickup and one delivery. Count permutations of all 2n actions in which each pickup precedes its delivery, modulo 1000000007.',[(1,500)]),
1387:('getKth','将整数按权重排序','Sort Integers by The Power Value','偶数除2、奇数乘3加1，直到变1所需次数称权重。将闭区间[lo,hi]按权重升序、相同权重按数值升序排列，返回第k个数。','Power is the number of steps to reach 1 by halving even numbers or replacing odd numbers with 3x+1. Sort inclusive [lo,hi] by power, then value, and return its kth entry.',[(1,1000)]*3),
1401:('checkOverlap','圆和矩形是否有重叠','Circle and Rectangle Overlapping','输入圆半径及圆心、轴对齐矩形左下右上角。判断是否存在同时属于闭圆盘和闭矩形的点，边界相切也算。','Given a circle radius and center and an axis-aligned rectangle, determine whether the closed disk and closed rectangle share any point. Tangency counts.',[(1,2000)]+[(-10000,10000)]*6),
1414:('findMinFibonacciNumbers','和为 K 的最少斐波那契数字数目','Find the Minimum Number of Fibonacci Numbers Whose Sum Is K','斐波那契数从1,1开始，以后每项为前两项之和，可重复选取，求凑出 k 所需最少项数。','Fibonacci numbers begin 1,1 and each later number sums the previous two. With repeated use allowed, return the minimum number of terms summing to k.',[(1,1000000000)]),
1806:('reinitializePermutation','还原排列的最少操作步数','Minimum Number of Operations to Reinitialize a Permutation','初始 perm[i]=i。每次同步变换：偶数 i 取旧 perm[i/2]，奇数 i 取旧 perm[n/2+(i-1)/2]。返回恢复初始排列的最小正操作次数。','Initially perm[i]=i. Each simultaneous operation sets even i from old perm[i/2] and odd i from old perm[n/2+(i-1)/2]. Return the least positive operations restoring the original permutation.',[(2,1000)]),
2549:('distinctIntegers','统计桌面上的不同数字','Count Distinct Numbers on Board','桌上初始只有 n。每天对桌上每个 x，将[1,n]中满足 x mod i=1 的所有 i 放上桌，旧数字保留。10^9天后有多少不同整数？','The board initially contains n. Each day, for each existing x, add every i in [1,n] satisfying x mod i=1, retaining old values. Count distinct integers after 10^9 days.',[(1,100)]),
2566:('minMaxDifference','替换一个数字后的最大差值','Maximum Difference by Remapping a Digit','一次替换选择一个数字字符并把它所有出现换成另一数字，允许前导零。分别选择替换得到最大值和最小值，返回二者差。','A remapping replaces every occurrence of one decimal digit with another, allowing leading zeroes. Independently obtain the maximum and minimum possible values and return their difference.',[(1,100000000)]),
2843:('countSymmetricIntegers','统计对称整数的数目','Count Symmetric Integers','十进制位数为偶数且前一半数字和等于后一半数字和的正整数为对称整数。统计闭区间[low,high]中的个数，不加前导零。','A positive integer is symmetric when it has an even number of decimal digits and the sums of its two halves match. Count such integers in inclusive [low,high], without leading zeroes.',[(1,10000)]*2),
}
E={223:[[0,0,2,2,1,1,3,3],[0,0,0,1,0,0,1,1],[0,0,1,1,1,0,2,1]],357:[[0],[1],[2],[3]],365:[[3,5,4],[2,6,5],[1,1,2],[1,1,3]],390:[[1],[2],[9],[10]],458:[[1,1,1],[4,15,15],[4,15,30],[1000,15,60]],625:[[1],[48],[15],[11]],660:[[1],[8],[9],[18]],829:[[1],[5],[9],[15]],858:[[2,1],[3,1],[3,2],[1,1]],878:[[1,2,3],[4,2,3],[5,2,4]],1015:[[1],[2],[3],[7]],1201:[[3,2,3,5],[4,2,3,4],[5,2,2,2]],1359:[[1],[2],[3]],1387:[[12,15,2],[1,1,1],[7,11,4]],1401:[[1,0,0,1,-1,3,1],[1,0,0,2,2,3,3],[1,2,2,1,1,3,3]],1414:[[1],[7],[10],[19]],1806:[[2],[4],[6],[8]],2549:[[1],[2],[5]],2566:[[11891],[90],[999]],2843:[[1,100],[1200,1230],[11,11],[10,10]]}
def base9(n):
 digits=''
 while n:digits=str(n%9)+digits;n//=9
 return int(digits)
def fibcount(n):
 f=[1,2]
 while f[-1]<n:f.append(sum(f[-2:]))
 c=0
 for v in reversed(f):
  if v<=n:n-=v;c+=1
 return c
P={223:[([-10000,-10000,10000,10000,-10000,-10000,10000,10000],400000000)],357:[([8],2345851)],365:[([1000,1000,999],0),([1000,1,1000],1)],390:[([1000000000],534765398)],458:[([1000,100,100],10),([1000,1,100],2)],625:[([2147483647],0)],660:[([800000000],base9(800000000))],829:[([1000000000],10),([536870912],1)],858:[([1000,999],2),([1000,1000],1)],878:[([1000000000,40000,40000],40000000000000%MOD)],1015:[([100000],-1),([99999],45)],1201:[([1000000000,1,1,1],1000000000),([2,1000000000,1000000000,1],2)],1359:[([500],math.factorial(1000)//2**500%MOD)],1387:[([1,1000,1000],871)],1401:[([2000,10000,10000,8000,8000,9000,9000],1),([2000,-10000,-10000,8000,8000,10000,10000],0)],1414:[([1000000000],fibcount(1000000000)),([701408733],1)],1806:[([1000],36)],2549:[([100],99)],2566:[([100000000],900000000)],2843:[([1,10000],624)]}
M={223:('adds both areas without removing overlap','(a[2]-a[0])*(a[3]-a[1])+(a[6]-a[4])*(a[7]-a[5])'),357:('counts all numbers including repeated digits','10**a[0]'),365:('only checks combined capacity','a[2]<=a[0]+a[1]'),390:('always keeps odd-positioned numbers','1'),458:('requires one pig for every bucket','a[0]'),625:('returns the number itself','a[0]'),660:('does not skip numbers containing nine','a[0]'),829:('excludes the one-term representation','0'),858:('always reports the northeast receptor','1'),878:('counts multiples of the smaller divisor only','a[0]*min(a[1:])%1000000007'),1015:('returns k rather than the shortest length','a[0]'),1201:('counts only the smallest divisor','a[0]*min(a[1:])'),1359:('permutes orders as indivisible blocks','__import__("math").factorial(a[0])'),1387:('sorts by value only','a[0]+a[2]-1'),1401:('checks only circle center inside rectangle','a[3]<=a[1]<=a[5] and a[4]<=a[2]<=a[6]'),1414:('uses ones only','a[0]'),1806:('returns n instead of permutation order','a[0]'),2549:('omits the initial value for n=1','a[0]-1'),2566:('forbids leading zeroes in minimizing','0'),2843:('counts all even-length numbers','sum(len(str(x))%2==0 for x in range(a[0],a[1]+1))')}
def valid_scalar(pid,a):
 b=META[pid][-1];assert len(a)==len(b) and all(type(x)is int and lo<=x<=hi for x,(lo,hi) in zip(a,b))
 if pid==223:assert a[0]<=a[2] and a[1]<=a[3] and a[4]<=a[6] and a[5]<=a[7]
 if pid==458:assert a[1]<=a[2]
 if pid==858:assert a[1]<=a[0]
 if pid==1201:
  n,x,y,z=a;assert x*y*z<=10**18
  count=sum(2000000000//d for d in (x,y,z))-sum(2000000000//math.lcm(i,j) for i,j in ((x,y),(x,z),(y,z)))+2000000000//math.lcm(x,y,z)
  assert count>=n
 if pid==1387:assert a[0]<=a[1] and a[2]<=a[1]-a[0]+1
 if pid==1401:assert a[3]<a[5] and a[4]<a[6]
 if pid==1806:assert a[0]%2==0
 if pid==2843:assert a[0]<=a[1]
def random_scalar(pid,r):
 if pid==223:
  a=[]
  for _ in range(2):
   x=r.randint(-3,3);y=r.randint(-3,3);a.extend([x,y,x+r.randint(0,4),y+r.randint(0,4)])
  return a
 if pid==357:return [r.randrange(4)]
 if pid==1359:return [r.randint(1,3)]
 if pid==365:return [r.randint(1,8),r.randint(1,8),r.randint(1,16)]
 if pid==458:
  die=r.randint(1,10);return [r.randint(1,30),die,r.randint(die,50)]
 if pid==858:
  p=r.randint(1,20);return [p,r.randint(1,p)]
 if pid in (878,1201):return [r.randint(1,15)]+[r.randint(2 if pid==878 else 1,12) for _ in range(2 if pid==878 else 3)]
 if pid==1387:
  lo=r.randint(1,30);hi=lo+r.randint(0,20);return [lo,hi,r.randint(1,hi-lo+1)]
 if pid==1401:
  x=r.randint(-4,4);y=r.randint(-4,4);return [r.randint(1,4),r.randint(-4,4),r.randint(-4,4),x,y,x+r.randint(1,4),y+r.randint(1,4)]
 if pid==1806:return [2*r.randint(1,20)]
 if pid==2843:
  lo=r.randint(1,100);return [lo,lo+r.randint(0,100)]
 return [r.randint(1,100)]
for pid,(method,zh,en,desc,eng,bounds) in META.items():
 name,expr=M[pid]
 inp='一行按题意顺序输入整数。'+'；'.join(f'参数{i+1}在[{lo},{hi}]' for i,(lo,hi) in enumerate(bounds))+'。'
 ein='One line of integers in the order named above. '+'; '.join(f'Argument {i+1} in [{lo},{hi}]' for i,(lo,hi) in enumerate(bounds))+'.'
 if pid==223:inp+='顺序为 ax1 ay1 ax2 ay2 bx1 by1 bx2 by2；每个左下坐标不得大于对应右上坐标。';ein+=' Order: ax1 ay1 ax2 ay2 bx1 by1 bx2 by2; each lower coordinate must not exceed its corresponding upper coordinate.'
 if pid==458:inp+='minutesToDie≤minutesToTest。';ein+=' minutesToDie≤minutesToTest.'
 if pid==858:inp+='q≤p。';ein+=' q≤p.'
 if pid==1201:inp+='a*b*c≤10^18，保证结果≤2*10^9。';ein+=' a*b*c≤10^18; result is guaranteed ≤2*10^9.'
 if pid==1387:inp+='lo≤hi，1≤k≤hi-lo+1。';ein+=' lo≤hi; 1≤k≤hi-lo+1.'
 if pid==1401:inp+='顺序 radius xCenter yCenter x1 y1 x2 y2；x1<x2，y1<y2。';ein+=' Order: radius xCenter yCenter x1 y1 x2 y2; x1<x2 and y1<y2.'
 if pid==1806:inp+='n为偶数。';ein+=' n is even.'
 if pid==2843:inp+='low≤high。';ein+=' low≤high.'
 PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh=inp,inputEn=ein,outputZh='成立输出1，否则输出0。' if pid in (365,1401) else '输出一个整数。',outputEn='Print 1 if true, otherwise 0.' if pid in (365,1401) else 'Print one integer.',difficulty='中等',edges=E[pid],pressure=P[pid],random_args=lambda r,p=pid:random_scalar(p,r),oracle=lambda a,p=pid:small_oracle(p,a),encode=scalar_codec,parse=SCALAR_PARSE,validate=lambda a,p=pid:valid_scalar(p,a),mutants=[dict(name=name,source='a=list(map(int,open(0).read().split()))\nprint(int('+expr+'))\n')])

def structured_oracle(pid,a):
 x=a[0]
 if pid==593:
  for p in itertools.permutations(a):
   vectors=[(p[(i+1)%4][0]-p[i][0],p[(i+1)%4][1]-p[i][1]) for i in range(4)]
   lengths=[u*u+v*v for u,v in vectors]
   if lengths[0]>0 and len(set(lengths))==1 and all(vectors[i][0]*vectors[(i+1)%4][0]+vectors[i][1]*vectors[(i+1)%4][1]==0 for i in range(4)):return 1
  return 0
 if pid==611:return sum(min(u+v-w,u+w-v,v+w-u)>0 for u,v,w in itertools.combinations(x,3))
 if pid==810:
  @lru_cache(None)
  def win(t):
   xor=0
   for v in t:xor^=v
   if xor==0:return True
   return any(xor^v and not win(t[:i]+t[i+1:]) for i,v in enumerate(t))
  return int(win(tuple(x)))
 if pid==1131:return max(abs(x[i]-x[j])+abs(a[1][i]-a[1][j])+abs(i-j) for i in range(len(x)) for j in range(len(x)))
 if pid==1250:
  modulus=min(x);seen={0};q=deque([0])
  while q:
   v=q.popleft()
   for z in x:
    nxt=(v+z)%modulus
    if nxt not in seen:seen.add(nxt);q.append(nxt)
  return int(modulus==1 or 1 in seen)
 if pid==1390:
  total=0
  for n in x:
   divisors=[d for d in range(1,n+1) if n%d==0]
   if len(divisors)==4:total+=sum(divisors)
  return total
 if pid==1573:return sum(x[:i].count('1')==x[i:j].count('1')==x[j:].count('1') for i in range(1,len(x)) for j in range(i+1,len(x)))%MOD
 if pid==2425:
  ans=0
  for u in x:
   for v in a[1]:ans^=u^v
  return ans
 if pid==2521:return sum(all(d%v for v in range(2,math.isqrt(d)+1)) and any(n%d==0 for n in x) for d in range(2,max(x)+1))
 if pid==835:
  counts={}
  for i,row in enumerate(x):
   for j,v in enumerate(row):
    if not v:continue
    for k,row2 in enumerate(a[1]):
     for l,w in enumerate(row2):
      if w:counts[(k-i,l-j)]=counts.get((k-i,l-j),0)+1
  return max(counts.values(),default=0)
 raise KeyError(pid)

SMETA={593:('validSquare','有效的正方形','Valid Square','给定四个整数坐标点，顺序任意且允许重复。判断是否能构成边长大于0的正方形，可旋转。','Given four integer-coordinate points in arbitrary order, possibly repeated, decide whether they form a square of positive side length, allowing rotation.'),611:('triangleNumber','有效三角形的个数','Valid Triangle Number','从数组选取三个不同下标，统计其数值能组成非退化三角形边长的组合数。相同数值不同下标分开计数。','Count triples of distinct indices whose values form side lengths of a nondegenerate triangle. Equal values at different indices are distinct choices.'),810:('xorGame','黑板异或游戏','Chalkboard XOR Game','两人轮流擦掉数组的一个元素。若擦除后所有剩余数异或为0，操作者输；若轮到某人时异或已经为0，该玩家直接赢。返回先手能否必胜。','Players alternate erasing one array element. Erasing so the remaining XOR becomes zero loses; if a turn starts with XOR already zero, that player immediately wins. Determine whether the first player can force a win.'),1131:('maxAbsValExpr','绝对值表达式的最大值','Maximum of Absolute Value Expression','两个等长数组，求所有下标i,j中 |arr1[i]-arr1[j]|+|arr2[i]-arr2[j]|+|i-j| 的最大值。','For equal-length arrays, maximize |arr1[i]-arr1[j]|+|arr2[i]-arr2[j]|+|i-j| over all indices i,j.'),1250:('isGoodArray','检查好数组','Check If It Is a Good Array','判断是否可以选择若干数组元素，各自乘以任意整数（可为负数或0），使乘积之和为1。','Determine whether some array elements can each be multiplied by arbitrary integers, including negative or zero coefficients, so the resulting sum is 1.'),1390:('sumFourDivisors','四因数','Four Divisors','对数组中恰有四个不同正因子的每个元素，累加其四个因子之和。重复元素分别计数。','For every array element having exactly four distinct positive divisors, add the sum of those four divisors. Count duplicate entries separately.'),1573:('numWays','分割字符串的方案数','Number of Ways to Split a String','把二进制字符串切成三个非空连续部分，要求各部分1的数量相同。返回不同切分位置方案数模1000000007。','Split a binary string into three nonempty contiguous parts having equal numbers of ones. Count distinct pairs of cuts modulo 1000000007.'),2425:('xorAllNums','所有数对的异或和','Bitwise XOR of All Pairings','对两个数组的每个跨数组配对计算异或，再将全部结果异或，返回最终整数。','XOR the two values of every cross-array pair, then XOR all those results and return the final integer.'),2521:('distinctPrimeFactors','数组乘积中的不同质因数数目','Distinct Prime Factors of Product of Array','返回所有数组元素乘积中不同质因子的数量，无需输出巨大乘积。','Return the number of distinct prime factors of the product of all array elements. The potentially huge product need not be output.'),835:('largestOverlap','图像重叠','Image Overlap','两个等大正方形0/1图像，允许将第一张平移任意整数格，不允许旋转。求重叠位置都为1的最大数量，移出边界的格子丢弃。','Translate the first of two equally sized square binary images by any integer offset, without rotation. Maximize positions where both images contain 1; discard translated cells outside the other image.')}
SE={593:[[[0,0],[1,1],[1,0],[0,1]],[[0,0],[0,0],[1,1],[1,0]],[[0,0],[2,0],[2,1],[0,1]],[[0,1],[1,0],[0,-1],[-1,0]]],611:[[[2,2,3,4]],[[0,1,1]],[[1,1,2]],[[1,1,1]]],810:[[[1,1,2]],[[0]],[[1]],[[1,2]]],1131:[[[1,2,3,4],[-1,4,5,6]],[[1,1],[1,1]],[[1,-2],[3,1]]],1250:[[[12,5,7,23]],[[6,10,15]],[[2,4]],[[1]]],1390:[[[21,4,7]],[[6,6]],[[8]],[[1]]],1573:[['10101'],['000'],['0000'],['111'],['1001']],2425:[[[2,1,3],[10,2,5,0]],[[1],[2]],[[1,2],[3]]],2521:[[[2,4,3,7,10,6]],[[4,8,16]],[[2]]],835:[[[[1]],[[1]]],[[[0]],[[1]]],[[[1,0],[0,0]],[[0,0],[0,1]]],[[[1,1],[1,1]],[[1,0],[0,1]]]]}
SP={593:[([[-10000,-10000],[10000,-10000],[10000,10000],[-10000,10000]],1)],611:[([[1000]*1000],math.comb(1000,3)),([[0]*1000],0)],810:[([[65535]*1000],1),([[65535]*999],0)],1131:[([[-1000000,1000000]*20000,[-1000000,1000000]*20000],4039999)],1250:[([[1000000000]*100000],0),([[1000000000]*99999+[999999999]],1)],1390:[([[6]*10000],120000),([[100000]*10000],0)],1573:[(['0'*100000],math.comb(99999,2)%MOD),(['1'*99999+'0'],1)],2425:[([[1000000000]*100000,[1000000000]*100000],0),([[1000000000]*99999,[0]*99999],1000000000)],2521:[([[1000]*10000],2)],835:[([[[1]*30 for _ in range(30)],[[1]*30 for _ in range(30)]],900)]}

def enc(pid,a):
 if pid==1573:return a[0]+'\n'
 if pid==593:return '\n'.join(' '.join(map(str,p)) for p in a)+'\n'
 if pid==835:return str(len(a[0]))+'\n'+''.join(' '.join(map(str,row))+'\n' for g in a for row in g)
 if pid in (1131,2425):return f'{len(a[0])} {len(a[1])}\n'+' '.join(map(str,a[0]))+'\n'+' '.join(map(str,a[1]))+'\n'
 return str(len(a[0]))+'\n'+' '.join(map(str,a[0]))+'\n'
PARSE={1573:"args=[sys.stdin.readline().strip()]",593:'v=list(map(int,sys.stdin.read().split())); assert len(v)==8; args=[v[2*i:2*i+2] for i in range(4)]',835:'v=list(map(int,sys.stdin.read().split())); n=v[0]; assert len(v)==1+2*n*n; args=[[v[1+g*n*n+i*n:1+g*n*n+(i+1)*n] for i in range(n)] for g in range(2)]'}
BOUNDS={611:(1,1000,0,1000),810:(1,1000,0,65535),1131:(2,40000,-1000000,1000000),1250:(1,100000,1,1000000000),1390:(1,10000,1,100000),2425:(1,100000,0,1000000000),2521:(1,10000,2,1000)}
def vstruct(pid,a):
 if pid==593:assert len(a)==4 and all(len(p)==2 and all(type(v)is int and -10000<=v<=10000 for v in p) for p in a);return
 if pid==1573:assert len(a)==1 and isinstance(a[0],str) and 3<=len(a[0])<=100000 and set(a[0])<={'0','1'};return
 if pid==835:
  assert len(a)==2 and 1<=len(a[0])<=30 and len(a[0])==len(a[1]);n=len(a[0]);assert all(len(row)==n and all(type(v)is int and v in (0,1) for v in row) for g in a for row in g);return
 lo,hi,x,y=BOUNDS[pid];assert len(a)==(2 if pid in (1131,2425) else 1)
 assert all(lo<=len(row)<=hi and all(type(v)is int and x<=v<=y for v in row) for row in a)
 if pid==1131:assert len(a[0])==len(a[1])
def rstruct(pid,r):
 if pid==593:return [[r.randint(-3,3),r.randint(-3,3)] for _ in range(4)]
 if pid==1573:return [''.join(r.choice('01') for _ in range(r.randint(3,12)))]
 if pid==835:
  n=r.randint(1,5);return [[[r.randint(0,1) for _ in range(n)] for _ in range(n)] for _ in range(2)]
 lo,hi,x,y=BOUNDS[pid];n=r.randint(lo,7);a=[[r.randint(max(x,-10),min(y,20)) for _ in range(n)]]
 if pid in (1131,2425):a.append([r.randint(max(x,-10),min(y,20)) for _ in range(n if pid==1131 else r.randint(1,7))])
 return a
SM={593:('accepts every rectangle','1'),611:('allows degenerate zero-area triangles','sum(min(x+y-z,x+z-y,y+z-x)>=0 for x,y,z in __import__("itertools").combinations(v[1:],3))'),810:('assumes zero XOR is the only winning case','__import__("functools").reduce(lambda x,y:x^y,v[1:],0)==0'),1131:('omits the index distance','max(abs(v[2+i]-v[2+j])+abs(v[2+v[0]+i]-v[2+v[0]+j]) for i in range(v[0]) for j in range(v[0]))'),1250:('requires an existing element one','1 in v[1:]'),1390:('sums values rather than qualifying divisors','sum(v[1:])'),1573:('requires equal part lengths','int(len(s)%3==0)'),2425:('uses only the first cross-array pair','v[2]^v[2+v[0]]'),2521:('counts distinct array values rather than primes','len(set(v[1:]))'),835:('checks only zero translation','sum(x*y for x,y in zip(v[1:1+v[0]*v[0]],v[1+v[0]*v[0]:]))')}
for pid,(method,zh,en,desc,eng) in SMETA.items():
 if pid in BOUNDS:
  lo,hi,x,y=BOUNDS[pid];iz=f'第一行数组长度 n；第二行 n 个整数。{lo}≤n≤{hi}，值在[{x},{y}]。';ie=f'First line n; second line n array integers. {lo}≤n≤{hi}; values in [{x},{y}].'
  if pid in (1131,2425):iz=f'第一行 n m；第二行 arr1 的 n 个整数，第三行 arr2 的 m 个整数。两个数组长度均在[{lo},{hi}]，值在[{x},{y}]。';ie=f'First line n m; second line n arr1 values; third line m arr2 values. Both lengths in [{lo},{hi}]; values in [{x},{y}].'
  if pid==1131:iz+='n=m。';ie+=' n=m.'
 elif pid==593:iz='四行，每行一个点 x y，坐标在[-10000,10000]。';ie='Four lines, each a point x y; coordinates in [-10000,10000].'
 elif pid==1573:iz='一行仅含0和1的字符串 s，3≤长度≤100000。';ie='One binary string s; length 3–100000.'
 else:iz='第一行 n；随后先 img1 的 n 行，再 img2 的 n 行，每行 n 个空格分隔0/1。1≤n≤30。';ie='First line n; then n rows of img1 followed by n rows of img2, each with n space-separated 0/1 values. 1≤n≤30.'
 parse=PARSE.get(pid,'v=list(map(int,sys.stdin.read().split())); n,m=v[:2]; assert len(v)==2+n+m; args=[v[2:2+n],v[2+n:]]' if pid in (1131,2425) else 'v=list(map(int,sys.stdin.read().split())); assert len(v)==v[0]+1; args=[v[1:]]')
 name,expr=SM[pid];source="s=input()\n" if pid==1573 else 'v=list(map(int,open(0).read().split()))\n'
 PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh=iz,inputEn=ie,outputZh='成立输出1，否则输出0。' if pid in (593,810,1250) else '输出一个整数。',outputEn='Print 1 if true, otherwise 0.' if pid in (593,810,1250) else 'Print one integer.',difficulty='中等',edges=SE[pid],pressure=SP[pid],random_args=lambda r,p=pid:rstruct(p,r),oracle=lambda a,p=pid:structured_oracle(p,a),encode=lambda a,p=pid:enc(p,a),parse=parse,validate=lambda a,p=pid:vstruct(p,a),mutants=[dict(name=name,source=source+'print(int('+expr+'))\n')])

# Local problem 660 has no reference implementation in either README or source;
# it is excluded until independently verifiable reference material is available.
del PROBLEMS[660]
def remainder_oracle(a):
 nums,p=a;total=sum(nums)
 return min([j-i for i in range(len(nums)+1) for j in range(i,len(nums)+1) if j-i<len(nums) and (total-sum(nums[i:j]))%p==0],default=-1)
def remainder_validate(a):
 assert len(a)==2 and 1<=len(a[0])<=100000 and all(type(x)is int and 1<=x<=1000000000 for x in a[0]) and type(a[1])is int and 1<=a[1]<=1000000000
PROBLEMS[1590]=dict(method='minSubarray',titleZh='使数组和能被 P 整除',titleEn='Make Sum Divisible by P',descriptionZh='删除最短的连续子数组（允许不删，但不得删除整个数组），使剩余元素和能被 p 整除。返回删除长度，不存在返回 -1。',descriptionEn='Remove a shortest contiguous subarray so the remaining sum is divisible by p. Removing nothing is allowed, but removing the entire array is forbidden. Return its length, or -1 if impossible.',inputZh='第一行 n p，第二行 n 个整数。1≤n≤100000，1≤nums[i]≤10^9，1≤p≤10^9。',inputEn='First line n p; second line n integers. 1≤n≤100000; 1≤nums[i]≤10^9; 1≤p≤10^9.',outputZh='输出一个整数。',outputEn='Print one integer.',difficulty='中等',edges=[[[3,1,4,2],6],[[1],2],[[1,2,3],3],[[6,3,5,2],9]],pressure=[([[1000000000]*100000,1000000000],0),([[1]*100000,100001],-1)],random_args=lambda r:[[r.randint(1,15) for _ in range(r.randint(1,8))],r.randint(1,20)],oracle=remainder_oracle,validate=remainder_validate,encode=lambda a:f'{len(a[0])} {a[1]}\n'+' '.join(map(str,a[0]))+'\n',parse='v=list(map(int,sys.stdin.read().split())); n,p=v[:2]; assert len(v)==n+2; args=[v[2:],p]',mutants=[dict(name='allows removing the entire array',source='v=list(map(int,open(0).read().split())); n,p=v[:2]; a=v[2:]; total=sum(a); print(min(j-i for i in range(n+1) for j in range(i,n+1) if (total-sum(a[i:j]))%p==0))\n')])
