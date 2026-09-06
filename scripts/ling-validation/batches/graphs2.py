"""Second original graph/math batch. Downloaded sources are never executed here."""
import math
import itertools
from functools import lru_cache
from collections import deque
from .graphs import scalar_codec, SCALAR_PARSE

MOD=1000000007
PROBLEMS={}

def prime(n):return n>=2 and all(n%d for d in range(2,math.isqrt(n)+1))
def apple_count(r):return 2*r*(r+1)*(2*r+1)
def apples(n):
    r=0;total=0
    while total<n:
        r+=1
        # Sum |x|+|y| over the newly included square boundary.
        total+=sum(abs(x)+r for x in range(-r,r+1))*2+sum(r+abs(y) for y in range(-r+1,r))*2
    return 8*r

def game(n,squares=False):
    @lru_cache(None)
    def win(k):
        choices=(range(1,math.isqrt(k)+1) if squares else range(1,k))
        return any((squares or k%d==0) and not win(k-(d*d if squares else d)) for d in choices)
    return int(win(n))

@lru_cache(maxsize=8)
def prime_permutation_count(n):
    """Enumerate actual arrangements, avoiding the reference's factorial formula.

    Repeated random values reuse at most eight tiny results; all permutations
    for n=1..8 together number fewer than 47,000.
    """
    assert 1<=n<=8, 'Permutation oracle is restricted to small instances'
    prime_values={v for v in range(1,n+1) if sum(v%d==0 for d in range(1,v+1))==2}
    return sum(all(value not in prime_values or index in prime_values
                   for index,value in enumerate(order,1))
               for order in itertools.permutations(range(1,n+1)))

def scalar_oracle(pid,a):
    n=a[0]
    if pid==190:return int(f'{n:032b}'[::-1],2)
    if pid==371:return sum(a)
    if pid==1318:
        # Exhaustively choose new two-bit assignments independently at each position.
        return sum(min((x!=((n>>k)&1))+(y!=((a[1]>>k)&1)) for x,y in itertools.product((0,1),repeat=2) if x|y==((a[2]>>k)&1)) for k in range(30))
    if pid==1680:return int(''.join(bin(x)[2:] for x in range(1,n+1)),2)%MOD
    if pid==3226:
        old=f'{n:020b}';new=f'{a[1]:020b}'
        return -1 if any(x=='0' and y=='1' for x,y in zip(old,new)) else sum(x!=y for x,y in zip(old,new))
    if pid==9:return int(n>=0 and str(n)==str(n)[::-1])
    if pid==172:
        s=str(math.factorial(n));return len(s)-len(s.rstrip('0'))
    if pid==204:return sum(prime(x) for x in range(2,n))
    if pid==319:
        bulbs=[0]*(n+1)
        for x in range(1,n+1):
            for j in range(x,n+1,x):bulbs[j]^=1
        return sum(bulbs)
    if pid==507:return int(n>1 and sum(x for x in range(1,n) if n%x==0)==n)
    if pid==633:return int(any(x*x+y*y==n for x in range(math.isqrt(n)+1) for y in range(math.isqrt(n)+1)))
    if pid==836:
        r,s=a;return int(any(r[0]<=x<r[2] and r[1]<=y<r[3] and s[0]<=x<s[2] and s[1]<=y<s[3] for x in range(min(r[0],s[0]),max(r[2],s[2])) for y in range(min(r[1],s[1]),max(r[3],s[3]))))
    if pid==1025:return game(n)
    if pid==1492:
        factors=[x for x in range(1,n+1) if n%x==0];return factors[a[1]-1] if a[1]<=len(factors) else -1
    if pid==1510:return game(n,True)
    if pid==1780:
        powers=[3**k for k in range(16) if 3**k<=n]
        return int(any(sum(powers[i] for i in range(len(powers)) if mask>>i&1)==n for mask in range(1<<len(powers))))
    if pid==1823:
        players=list(range(1,n+1));idx=0
        while len(players)>1:idx=(idx+a[1]-1)%len(players);players.pop(idx)
        return players[0]
    if pid==1925:return sum(x*x+y*y==z*z for x in range(1,n+1) for y in range(1,n+1) for z in range(1,n+1))
    if pid==1952:return int(sum(n%x==0 for x in range(1,n+1))==3)
    if pid==1175:return prime_permutation_count(n)
    if pid==1922:
        return sum(all(int(c) in ((0,2,4,6,8) if i%2==0 else (2,3,5,7)) for i,c in enumerate(s)) for s in itertools.product('0123456789',repeat=n))%MOD
    if pid==1954:return apples(n)
    raise KeyError(pid)

# Every row is independently authored; bounds are the original problem domain.
META={
190:('reverseBits','颠倒二进制位','Reverse Bits','将一个无符号 32 位整数的 32 个二进制位逆序，返回其无符号十进制值，前导零也参与逆序。','Reverse all 32 bits of an unsigned 32-bit integer, including leading zeroes; return the unsigned decimal value.',[(0,2147483646)]),
371:('getSum','两整数之和','Sum of Two Integers','返回整数 a 和 b 的和。算法要求不使用加号或减号。','Return the sum of integers a and b. The intended algorithm does not use plus or minus operators.',[(-1000,1000),(-1000,1000)]),
1318:('minFlips','或运算的最小翻转次数','Minimum Flips to Make a OR b Equal to c','一次操作可翻转 a 或 b 的任意一个二进制位。求使 a 按位或 b 等于 c 的最少操作次数。','One operation flips one bit of a or b. Find the fewest operations making the bitwise OR of a and b equal c.',[(1,1000000000)]*3),
1680:('concatenatedBinary','连接连续二进制数字','Concatenation of Consecutive Binary Numbers','依次拼接 1 到 n 的无前导零二进制表示，返回所得整数模 1000000007。','Concatenate binary representations of 1 through n, without leading zeroes, and return the resulting integer modulo 1000000007.',[(1,100000)]),
3226:('minChanges','使两个整数相等的位更改次数','Number of Bit Changes to Make Two Integers Equal','每次只能将 n 的一个 1 位改为 0，求把 n 变成 k 的最少次数；不可能返回 -1。','Each operation changes one set bit of n to zero. Return the minimum operations to obtain k, or -1 if impossible.',[(1,1000000)]*2),
9:('isPalindrome','回文数','Palindrome Number','判断整数 x 的十进制表示是否为回文。负数因负号不能构成回文。','Determine whether the decimal representation of x is a palindrome. Negative numbers are not palindromes because of the minus sign.',[(-2147483648,2147483647)]),
172:('trailingZeroes','阶乘后的零','Factorial Trailing Zeroes','返回 n! 的十进制表示末尾连续零的个数；0!=1。','Count trailing zeroes in the decimal representation of n factorial; 0!=1.',[(0,10000)]),
204:('countPrimes','计数质数','Count Primes','统计严格小于非负整数 n 的质数个数，质数是恰有两个正因子的正整数。','Count primes strictly less than nonnegative n. A prime has exactly two positive divisors.',[(0,5000000)]),
319:('bulbSwitch','灯泡开关','Bulb Switcher','n 盏灯初始关闭，第 i 轮翻转编号为 i 倍数的灯，完成第 1 到 n 轮后返回亮灯数量。编号从 1 开始。','All n bulbs start off. Round i toggles every bulb whose one-based index is divisible by i. Return the number on after rounds 1 through n.',[(0,1000000000)]),
507:('checkPerfectNumber','完美数','Perfect Number','判断正整数 num 是否等于所有小于它的正因子之和。','Determine whether positive num equals the sum of its positive divisors strictly smaller than itself.',[(1,100000000)]),
633:('judgeSquareSum','平方数之和','Sum of Square Numbers','判断非负整数 c 是否能写为两个非负整数的平方和。','Determine whether nonnegative c is the sum of squares of two nonnegative integers.',[(0,2147483647)]),
1025:('divisorGame','除数博弈','Divisor Game','两人轮流从 n 减去一个正真因子 x（0<x<n 且 n 能被 x 整除）。无法操作者输，先手在最优策略下是否获胜？','Players alternate subtracting a positive proper divisor x of the current n (0<x<n). A player unable to move loses. Determine whether the first player wins under optimal play.',[(1,1000)]),
1492:('kthFactor','n 的第 k 个因子','The kth Factor of n','将 n 的所有正因子从小到大排列，返回第 k 个（从 1 开始），不存在返回 -1。','Sort all positive factors of n increasingly. Return the kth, using one-based indexing, or -1 if fewer exist.',[(1,1000),(1,1000)]),
1510:('winnerSquareGame','石子游戏 IV','Stone Game IV','两人轮流从 n 颗石子中移走正平方数颗石子，不能操作者输。返回最优策略下先手是否必胜。','Players alternate removing a positive square number of stones from a pile of n. A player unable to move loses. Determine whether the first player can force a win.',[(1,100000)]),
1780:('checkPowersOfThree','判断一个数字是否可以表示成三的幂的和','Check if Number Is a Sum of Powers of Three','判断 n 能否表示成若干互不相同的 3 的非负整数次幂之和，每个幂最多使用一次。','Determine whether n is a sum of distinct nonnegative integer powers of 3. Each power may be used at most once.',[(1,10000000)]),
1823:('findTheWinner','找出游戏的获胜者','Find the Winner of the Circular Game','1 到 n 按顺时针围成一圈，从 1 开始包含当前人计数 k 人并淘汰第 k 人，再从下一人继续，返回最后剩下的编号。','Players 1 through n form a clockwise circle. Starting at 1, count k players including the current player, remove the kth, and resume at the next. Return the last remaining label.',[(1,500),(1,500)]),
1925:('countTriples','统计平方和三元组的数目','Count Square Sum Triples','统计满足 1≤a,b,c≤n 且 a²+b²=c² 的有序三元组数量；交换 a,b 按不同三元组计算。','Count ordered triples with 1≤a,b,c≤n and a²+b²=c². Swapping a and b counts separately.',[(1,250)]),
1952:('isThree','三除数','Three Divisors','判断 n 是否恰有三个不同的正因子。','Determine whether n has exactly three distinct positive divisors.',[(1,10000)]),
1175:('numPrimeArrangements','质数排列','Prime Arrangements','将 1 到 n 排列，使每个质数处于质数编号位置（位置从 1 开始）。返回不同排列数模 1000000007。','Permute 1 through n so every prime value occupies a prime-numbered position (one-based). Return the number of valid permutations modulo 1000000007.',[(1,100)]),
1922:('countGoodNumbers','统计好数字的数目','Count Good Numbers','长度 n 的数字字符串允许前导零，偶数下标为偶数数字 0,2,4,6,8，奇数下标为质数数字 2,3,5,7。下标从 0 开始，返回数量模 1000000007。','Count digit strings of length n, allowing leading zeroes, whose zero-based even indices contain 0,2,4,6,8 and odd indices contain 2,3,5,7. Return the count modulo 1000000007.',[(1,1000000000000000)]),
1954:('minimumPerimeter','收集足够苹果的最小花园周长','Minimum Garden Perimeter to Collect Enough Apples','整数坐标 (x,y) 的树有 |x|+|y| 个苹果。选取以原点为中心、边平行坐标轴且边界为整数坐标的正方形，包含边界的苹果总数至少 neededApples，返回最小周长。','A tree at each integer point (x,y) has |x|+|y| apples. Choose an axis-aligned square centered at the origin with integer-coordinate boundaries. Return its minimum perimeter containing at least neededApples apples, including its boundary.',[(1,1000000000000000)]),
}
EDGES={190:[[0],[2],[43261596],[2147483646]],371:[[0,0],[-1,1],[-5,-7],[3,5]],1318:[[2,6,5],[1,1,2],[1,2,3]],1680:[[1],[2],[3],[12]],3226:[[1,1],[5,1],[1,2],[13,4]],9:[[-121],[0],[10],[121],[12321]],172:[[0],[4],[5],[25],[100]],204:[[0],[1],[2],[3],[10]],319:[[0],[1],[2],[3],[4],[9]],507:[[1],[6],[12],[28]],633:[[0],[1],[2],[3],[4],[5]],1025:[[1],[2],[3],[4]],1492:[[1,1],[1,2],[12,3],[7,3]],1510:[[1],[2],[3],[4],[7],[17]],1780:[[1],[2],[3],[12],[21],[91]],1823:[[1,1],[5,2],[6,5]],1925:[[1],[4],[5],[10]],1952:[[1],[2],[4],[9],[16]],1175:[[1],[2],[5],[10]],1922:[[1],[2],[3],[4]],1954:[[1],[12],[13],[1000]]}
PRESSURE={190:[([2147483646],2147483646),([1073741824],2)],371:[([-1000,-1000],-2000)],1318:[([1000000000]*3,0)],1680:[([100000],int(''.join(bin(x)[2:] for x in range(1,100001)),2)%MOD)],3226:[([1000000,1000000],0),([1000000,1],-1)],9:[([2147483647],0),([-2147483648],0)],172:[([10000],2499)],204:[([5000000],348513)],319:[([1000000000],31622)],507:[([100000000],0),([33550336],1)],633:[([2147395600],1),([2147483647],0)],1025:[([1000],1),([999],0)],1492:[([1000,1000],-1),([1000,16],1000)],1510:[([99856],1),([100000],1)],1780:[([10000000],0),([4782969],1)],1823:[([500,1],500),([500,2],489)],1925:[([250],330)],1952:[([10000],0),([9409],1)],1175:[([100],math.factorial(25)*math.factorial(75)%MOD)],1922:[([10**15],pow(20,5*10**14,MOD))],1954:[([10**15],503968)]}
MUT={190:('reverses only significant bits',"int(bin(a[0])[2:][::-1],2)"),371:('ignores carry bits','a[0]^a[1]'),1318:('counts differing OR bits, missing two flips','((a[0]|a[1])^a[2]).bit_count()'),1680:('concatenates decimal instead of binary','int("".join(map(str,range(1,a[0]+1))))%1000000007'),3226:('allows zero bits to turn on','(a[0]^a[1]).bit_count()'),9:('ignores minus sign','str(abs(a[0]))==str(abs(a[0]))[::-1]'),172:('counts only multiples of five','a[0]//5'),204:('counts n itself if prime','sum(x>1 and all(x%d for d in range(2,x)) for x in range(a[0]+1))'),319:('rounds square root upward','__import__("math").ceil(a[0]**.5)'),507:('includes number itself as a proper divisor','sum(x for x in range(1,a[0]+1) if a[0]%x==0)==a[0]'),633:('requires both squares to be positive','any(x*x+y*y==a[0] for x in range(1,__import__("math").isqrt(a[0])+1) for y in range(1,__import__("math").isqrt(a[0])+1))'),1025:('assumes odd inputs win','a[0]%2'),1492:('returns k instead of the kth factor','a[1] if a[0]%a[1]==0 else -1'),1510:('only recognizes immediate square wins','__import__("math").isqrt(a[0])**2==a[0]'),1780:('allows powers of three to be reused','1'),1823:('returns zero-based survivor','(__import__("functools").reduce(lambda s,i:(s+a[1])%i,range(1,a[0]+1),0))'),1925:('counts unordered legs','sum(x*x+y*y==z*z for x in range(1,a[0]+1) for y in range(x+1,a[0]+1) for z in range(1,a[0]+1))'),1952:('accepts every square','__import__("math").isqrt(a[0])**2==a[0]'),1175:('allows all permutations','__import__("math").factorial(a[0])%1000000007'),1922:('uses four choices at every position','4**a[0]%1000000007'),1954:('ignores all but the first ring','8')}
BOOL={9,507,633,1025,1510,1780,1952}
def validate_scalar(pid,a):
    bounds=META[pid][-1];assert len(a)==len(bounds) and all(type(x)is int and lo<=x<=hi for x,(lo,hi) in zip(a,bounds))
    if pid==190:assert a[0]%2==0
    if pid in (1492,1823):assert a[1]<=a[0]
def random_scalar(pid,r):
    if pid==190:return [2*r.randrange(31)]
    if pid in (1492,1823):
        n=r.randint(1,60);return [n,r.randint(1,n)]
    if pid==1922:return [r.randint(1,3)]
    if pid==1175:return [r.randint(1,8)]
    if pid==1925:return [r.randint(1,18)]
    if pid==633:return [r.randrange(150)]
    if pid==1954:return [r.randint(1,10000)]
    return [r.randint(max(lo,-25),min(hi,60)) for lo,hi in META[pid][-1]]
for pid,(method,zh,en,desc,eng,bounds) in META.items():
    name,expr=MUT[pid]
    PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh='一行按题意顺序输入整数。'+ '；'.join(f'参数{i+1} ∈ [{lo},{hi}]' for i,(lo,hi) in enumerate(bounds))+'。',inputEn='One line of integers in the order named above. '+ '; '.join(f'Argument {i+1} is in [{lo},{hi}]' for i,(lo,hi) in enumerate(bounds))+'.',outputZh='成立输出 1，否则输出 0。' if pid in BOOL else '输出一个整数。',outputEn='Print 1 if true, otherwise 0.' if pid in BOOL else 'Print one integer.',difficulty='中等' if pid in (1318,1680,633,1510,1780,1922,1954) else '简单',edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r,p=pid:random_scalar(p,r),oracle=lambda a,p=pid:scalar_oracle(p,a),encode=scalar_codec,parse=SCALAR_PARSE,mutants=[dict(name=name,source='a=list(map(int,open(0).read().split()))\nprint(int('+expr+'))\n')],validate=lambda a,p=pid:validate_scalar(p,a))

def structured_oracle(pid,a):
    nums=a[0]
    if pid==477:return sum(sum(x!=y for x,y in zip(f'{u:030b}',f'{v:030b}')) for i,u in enumerate(nums) for v in nums[i+1:])
    if pid==1558:
        target=tuple(nums);start=(0,)*len(nums);seen={start};q=deque([(start,0)])
        while q:
            cur,d=q.popleft()
            if cur==target:return d
            nxt=[tuple(x*2 for x in cur)]+[cur[:i]+(cur[i]+1,)+cur[i+1:] for i in range(len(cur))]
            for state in nxt:
                if state not in seen and all(x<=y for x,y in zip(state,target)):seen.add(state);q.append((state,d+1))
    if pid==1835:
        value=0
        for x in nums:
            for y in a[1]:value^=x&y
        return value
    if pid==2917:return sum(1<<i for i in range(31) if sum(x//(1<<i)%2 for x in nums)>=a[1])
    if pid==836:return scalar_oracle(pid,a)
    if pid==1232:return int(all((y[0]-x[0])*(z[1]-x[1])==(y[1]-x[1])*(z[0]-x[0]) for x,y,z in itertools.combinations(nums,3)))
    if pid==1266:
        total=0
        for start,end in zip(nums,nums[1:]):
            start=tuple(start);end=tuple(end);q=deque([(start,0)]);seen={start}
            while q:
                (x,y),d=q.popleft()
                if (x,y)==end:total+=d;break
                for dx,dy in itertools.product((-1,0,1),repeat=2):
                    p=(x+dx,y+dy)
                    if p not in seen and min(start[0],end[0])<=p[0]<=max(start[0],end[0]) and min(start[1],end[1])<=p[1]<=max(start[1],end[1]):seen.add(p);q.append((p,d+1))
        return total
    if pid==841:
        seen={0}
        while True:
            nxt=seen|{key for i in seen for key in nums[i]}
            if seen==nxt:return int(len(seen)==len(nums))
            seen=nxt
    if pid==207:
        n,edges=a
        return int(any(all(order.index(v)<order.index(u) for u,v in edges) for order in itertools.permutations(range(n))))
    raise KeyError(pid)

STRUCT={
477:('totalHammingDistance','汉明距离总和','Total Hamming Distance','求数组中所有不同下标对 i<j 的二进制汉明距离之和。','Sum binary Hamming distances over all index pairs i<j.'),
1558:('minOperations','得到目标数组的最少函数调用次数','Minimum Numbers of Function Calls to Make Target Array','从等长全零数组出发，一次可将单个元素加 1，或将所有元素乘 2。求得到非负目标数组 nums 的最少次数。','Start from an equally sized zero array. One operation increments one element by 1 or doubles every element. Return minimum operations to obtain nonnegative nums.'),
1835:('getXORSum','所有数对按位与结果的异或和','Find XOR Sum of All Pairs Bitwise AND','对 arr1 和 arr2 的所有跨数组有序配对取按位与，再将全部结果按位异或。','Compute bitwise AND for every cross-array pair from arr1 and arr2, then XOR all these results.'),
2917:('findKOr','找出数组中的 K-or 值','Find the K-or of an Array','结果的第 i 位为 1 当且仅当数组中至少 k 个元素的第 i 位为 1。返回结果整数。','Set result bit i exactly when at least k array elements have bit i set. Return that integer.'),
836:('isRectangleOverlap','矩形重叠','Rectangle Overlap','两个轴对齐矩形各用 [x1,y1,x2,y2] 表示左下和右上角。判断交集面积是否大于 0；仅共边或共点不算重叠。','Each axis-aligned rectangle is [x1,y1,x2,y2], its lower-left and upper-right corners. Determine whether their intersection has positive area; touching edges or corners do not count.'),
1232:('checkStraightLine','缀点成线','Check If It Is a Straight Line','给定至少两个互不相同的整数坐标点，判断是否全部在同一直线上。','Given at least two distinct integer-coordinate points, determine whether they all lie on one straight line.'),
1266:('minTimeToVisitAllPoints','访问所有点的最小时间','Minimum Time Visiting All Points','按给定顺序访问所有整数坐标点。每秒可横向、纵向或斜向移动一个单位，求最少秒数；途中经过未来点不代表已按顺序访问。','Visit integer-coordinate points in their given order. Each second moves one unit horizontally, vertically or diagonally. Return minimum seconds; passing a later point does not count as its ordered visit.'),
841:('canVisitAllRooms','钥匙和房间','Keys and Rooms','房间编号 0 到 n-1，初始只有房间 0 可进入。rooms[i] 列出房间 i 中可获得的钥匙对应房号。判断能否访问全部房间。','Rooms are numbered 0 through n-1 and only room 0 is initially accessible. rooms[i] lists room keys found inside room i. Determine whether all rooms can be visited.'),
207:('canFinish','课程表','Course Schedule','有 numCourses 门课程，编号 0 到 n-1。每对 [a,b] 表示学 a 前必须完成 b。判断能否完成所有课程。','Courses are numbered 0 through numCourses-1. Each prerequisite [a,b] requires finishing b before a. Determine whether every course can be completed.'),
}
SEDGES={477:[[[0]],[[4,14,2]],[[1,1,1]],[[0,7]]],1558:[[[0]],[[1,5]],[[2,2]],[[0,0,0]]],1835:[[[1],[1]],[[1,2,3],[6,5]],[[0,0],[7]]],2917:[[[1],1],[[1,2],1],[[1,2],2],[[7,7,0],2]],836:[[[0,0,1,1],[1,0,2,1]],[[0,0,2,2],[1,1,3,3]],[[0,0,1,1],[2,2,3,3]]],1232:[[[[0,0],[1,1]]],[[[0,0],[1,1],[2,3]]],[[[0,0],[0,1],[0,2]]]],1266:[[[[0,0]]],[[[0,0],[1,1]]],[[[1,1],[3,4],[-1,0]]]],841:[[[[1],[]]],[[[0],[]]],[[[1],[2],[]]],[[[1],[0],[]]]],207:[[1,[]],[2,[[1,0]]],[2,[[1,0],[0,1]]],[1,[[0,0]]]]}
SPRESSURE={477:[([[0]*5000+[1000000000]*5000],325000000)],1558:[([[1000000000]*100000],1300029)],1835:[([[1000000000]*100000,[1000000000]*100000],0),([[1000000000]*99999,[1000000000]*99999],1000000000)],2917:[([[2147483647]*50,50],2147483647)],836:[([[-1000000000,-1000000000,1000000000,1000000000],[-1,-1,1,1]],1)],1232:[([[[i,i] for i in range(1000)]],1)],1266:[([[[(-1000 if i%2==0 else 1000)]*2 for i in range(100)]],198000)],841:[([[[i+1] if i<999 else [] for i in range(1000)]],1)],207:[([2000,[[i+1,i] for i in range(1999)]],1),([2000,[[i+1,i] for i in range(1999)]+[[0,1999]]],0)]}

def encode_struct(pid,a):
    if pid==836:return '\n'.join(' '.join(map(str,row)) for row in a)+'\n'
    if pid==207:return f'{a[0]} {len(a[1])}\n'+''.join(f'{u} {v}\n' for u,v in a[1])
    if pid==841:return str(len(a[0]))+'\n'+''.join(str(len(row))+(' '+' '.join(map(str,row)) if row else '')+'\n' for row in a[0])
    if pid in (1232,1266):return str(len(a[0]))+'\n'+''.join(f'{x} {y}\n' for x,y in a[0])
    if pid==1835:return f'{len(a[0])} {len(a[1])}\n'+' '.join(map(str,a[0]))+'\n'+' '.join(map(str,a[1]))+'\n'
    return str(len(a[0]))+(' '+str(a[1]) if pid==2917 else '')+'\n'+' '.join(map(str,a[0]))+'\n'
PARSES={836:'v=list(map(int,sys.stdin.read().split())); assert len(v)==8; args=[v[:4],v[4:]]',207:'v=list(map(int,sys.stdin.read().split())); n,m=v[:2]; assert len(v)==2+2*m; args=[n,[v[2+2*i:4+2*i] for i in range(m)]]',841:'n=int(sys.stdin.readline()); rows=[list(map(int,sys.stdin.readline().split())) for _ in range(n)]; assert all(row[0]==len(row)-1 for row in rows); args=[[row[1:] for row in rows]]',1835:'v=list(map(int,sys.stdin.read().split())); n,m=v[:2]; assert len(v)==2+n+m; args=[v[2:2+n],v[2+n:]]',2917:'v=list(map(int,sys.stdin.read().split())); n,k=v[:2]; assert len(v)==n+2; args=[v[2:],k]'}

def validate_struct(pid,a):
    if pid==836:
        assert len(a)==2 and all(len(x)==4 and all(type(v)is int and -10**9<=v<=10**9 for v in x) and x[0]<x[2] and x[1]<x[3] for x in a);return
    if pid==207:
        n,e=a;assert 1<=n<=2000 and len(e)<=5000 and len({tuple(x) for x in e})==len(e) and all(len(x)==2 and all(type(v)is int and 0<=v<n for v in x) for x in e);return
    if pid==841:
        rooms=a[0];assert len(a)==1 and 2<=len(rooms)<=1000 and 1<=sum(map(len,rooms))<=3000
        assert all(len(row)<=1000 and len(set(row))==len(row) and all(type(v)is int and 0<=v<len(rooms) for v in row) for row in rooms);return
    if pid in (1232,1266):
        pts=a[0];lo,hi,lim=(2,1000,10000) if pid==1232 else (1,100,1000)
        assert len(a)==1 and lo<=len(pts)<=hi and all(len(p)==2 and all(type(x)is int and -lim<=x<=lim for x in p) for p in pts)
        if pid==1232:assert len(set(map(tuple,pts)))==len(pts)
        return
    lim=10000 if pid==477 else 50 if pid==2917 else 100000
    arrs=a if pid==1835 else a[:1]
    assert len(a)==(2 if pid in (1835,2917) else 1)
    assert all(1<=len(row)<=lim and all(type(x)is int and 0<=x<=(2147483647 if pid==2917 else 1000000000) for x in row) for row in arrs)
    if pid==2917:assert 1<=a[1]<=len(a[0])

def random_struct(pid,r):
    if pid==207:
        n=r.randint(1,6);return [n,[[i,j] for i in range(n) for j in range(n) if r.random()<.15]]
    if pid==841:
        n=r.randint(2,7);rooms=[[j for j in range(n) if r.random()<.25] for _ in range(n)]
        if not any(rooms):rooms[0]=[0]
        return [rooms]
    if pid==836:
        out=[]
        for _ in range(2):
            x=r.randint(-3,2);y=r.randint(-3,2);out.append([x,y,x+r.randint(1,3),y+r.randint(1,3)])
        return out
    if pid in (1232,1266):return [[list(p) for p in r.sample(list(itertools.product(range(-3,4),repeat=2)),r.randint(2,6))]]
    nums=[r.randint(0,4 if pid==1558 else 63) for _ in range(r.randint(1,3 if pid==1558 else 8))]
    return [nums,[r.randrange(64) for _ in range(r.randint(1,8))]] if pid==1835 else [nums,r.randint(1,len(nums))] if pid==2917 else [nums]
SINPUT={477:('第一行 n，第二行 n 个整数；1≤n≤10000，0≤nums[i]≤10^9。','First line n; second line n integers. 1≤n≤10000; 0≤nums[i]≤10^9.'),1558:('第一行 n，第二行 n 个整数；1≤n≤100000，0≤nums[i]≤10^9。','First line n; second line n integers. 1≤n≤100000; 0≤nums[i]≤10^9.'),1835:('第一行 n m，第二行 arr1 的 n 个整数，第三行 arr2 的 m 个整数；1≤n,m≤100000，元素在[0,10^9]。','First line n m, second line n arr1 integers, third line m arr2 integers. 1≤n,m≤100000; values in [0,10^9].'),2917:('第一行 n k，第二行 n 个整数；1≤n≤50，1≤k≤n，0≤nums[i]<2^31。','First line n k; second line n integers. 1≤n≤50; 1≤k≤n; 0≤nums[i]<2^31.'),836:('两行，每行 x1 y1 x2 y2。坐标在[-10^9,10^9]，x1<x2 且 y1<y2。','Two lines, each x1 y1 x2 y2. Coordinates lie in [-10^9,10^9], with x1<x2 and y1<y2.'),1232:('第一行 n，随后 n 行每行 x y；2≤n≤1000，坐标在[-10000,10000]，点不重复。','First line n, followed by n lines x y. 2≤n≤1000; coordinates in [-10000,10000]; points are distinct.'),1266:('第一行 n，随后 n 行每行 x y；1≤n≤100，坐标在[-1000,1000]。','First line n, followed by n lines x y. 1≤n≤100; coordinates in [-1000,1000].'),841:('第一行 n；随后 n 行：每行先输入钥匙数量 d，再输入 d 个不重复房号。2≤n≤1000，每行 d≤1000，总钥匙数在[1,3000]，房号在[0,n-1]。','First line n; then n lines, each a key count d followed by d distinct room numbers. 2≤n≤1000; d≤1000 per room; total keys in [1,3000]; labels in [0,n-1].'),207:('第一行 n m，随后 m 行每行 a b；1≤n≤2000，0≤m≤5000，0≤a,b<n，依赖对不重复。','First line n m; then m lines a b. 1≤n≤2000; 0≤m≤5000; 0≤a,b<n; prerequisite pairs are distinct.')}
SMUT={477:('compares only adjacent numbers',"sum((x^y).bit_count() for x,y in zip(v[1:],v[2:]))"),1558:('uses increments only','sum(v[1:])'),1835:('ANDs only the first pair','v[2]&v[2+v[0]]'),2917:('counts bit support strictly greater than k','sum(1<<i for i in range(31) if sum(x>>i&1 for x in v[2:])>v[1])'),836:('counts edge touching as positive overlap','max(v[0],v[4])<=min(v[2],v[6]) and max(v[1],v[5])<=min(v[3],v[7])'),1232:('rejects all vertical lines','v[1]!=v[3]'),1266:('uses Manhattan distance', 'sum(abs(v[1+2*i]-v[3+2*i])+abs(v[2+2*i]-v[4+2*i]) for i in range(v[0]-1))'),841:('assumes all rooms can be reached','1'),207:('assumes every prerequisite set is acyclic','1')}
for pid,(method,zh,en,desc,eng) in STRUCT.items():
    parse=PARSES.get(pid,'v=list(map(int,sys.stdin.read().split())); n=v[0]; assert len(v)==1+2*n; args=[[v[1+2*i:3+2*i] for i in range(n)]]' if pid in (1232,1266) else 'v=list(map(int,sys.stdin.read().split())); assert len(v)==v[0]+1; args=[v[1:]]')
    name,expr=SMUT[pid]
    PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh=SINPUT[pid][0],inputEn=SINPUT[pid][1],outputZh='成立输出1，否则输出0。' if pid in (836,1232,841,207) else '输出一个整数。',outputEn='Print 1 if true, otherwise 0.' if pid in (836,1232,841,207) else 'Print one integer.',difficulty='中等' if pid in (477,1558,1835,841,207) else '简单',edges=SEDGES[pid],pressure=SPRESSURE[pid],random_args=lambda r,p=pid:random_struct(p,r),oracle=lambda a,p=pid:structured_oracle(p,a),encode=lambda a,p=pid:encode_struct(p,a),parse=parse,mutants=[dict(name=name,source='v=list(map(int,open(0).read().split()))\nprint(int('+expr+'))\n')],validate=lambda a,p=pid:validate_struct(p,a))

PROBLEMS[190]['inputZh'] += ' n 必须为偶数。'
PROBLEMS[190]['inputEn'] += ' n must be even.'
PROBLEMS[1823]['inputZh'] += ' k 不得大于 n。'
PROBLEMS[1823]['inputEn'] += ' k must not exceed n.'
PROBLEMS[1492]['inputZh'] += ' k 不得大于 n。'
PROBLEMS[1492]['inputEn'] += ' k must not exceed n.'
PROBLEMS[1492]['edges'] = [[1,1],[12,3],[7,3]]
PROBLEMS[1492]['edges'].append([12,5])
PROBLEMS[1835]['edges'].append([[1,2],[2]])
PROBLEMS[1175]['edges']=[[1],[2],[5],[8]]
PROBLEMS[1318]['pressure'].extend([
    ([536870912,536870912,1],3),  # Clear bit 29 twice and set bit 0 once.
    ([1,1,536870913],1),         # Set bit 29 while preserving an existing low bit.
])
