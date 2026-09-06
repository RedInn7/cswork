"""Second original scalar-returning array/string batch; no imported testcase data."""
import itertools
import math
from collections import Counter
from functools import lru_cache

IDS=[1046,1217,1221,1287,1323,1332,1385,1399,1422,1446,1502,1512,1534,1539,1588,1668,1716,1742,1827,1863,1869,1979,1984,1991,1995,2016,2027,2078,2144,2154]
METHODS=dict(zip(IDS,['lastStoneWeight','minCostToMoveChips','balancedStringSplit','findSpecialInteger','maximum69Number','removePalindromeSub','findTheDistanceValue','countLargestGroup','maxScore','maxPower','canMakeArithmeticProgression','numIdenticalPairs','countGoodTriplets','findKthPositive','sumOddLengthSubarrays','maxRepeating','totalMoney','countBalls','minOperations','subsetXORSum','checkZeroOnes','findGCD','minimumDifference','findMiddleIndex','countQuadruplets','maximumDifference','minimumMoves','maxDistance','minimumCost','findFinalValue']))


def oracle(pid,args):
 a=args[0]
 if pid==1046:
  a=a[:]
  while len(a)>1:
   x=max(a);a.remove(x);y=max(a);a.remove(y)
   if x!=y:a.append(x-y)
  return a[0] if a else 0
 if pid==1217:
  # Enumerate every chip's location as destination and count unavoidable odd displacements.
  return min(sum(abs(x-y)%2 for x in a) for y in a)
 if pid==1221:
  @lru_cache(None)
  def solve(i):
   if i==len(a):return 0
   return max([0]+[1+solve(j) for j in range(i+2,len(a)+1) if a[i:j].count('L')==a[i:j].count('R')])
  return solve(0)
 if pid==1287:return next(x for x in a if a.count(x)*4>len(a))
 if pid==1323:
  s=str(a);return max([a]+[int(s[:i]+('9' if c=='6' else '6')+s[i+1:]) for i,c in enumerate(s)])
 if pid==1332:
  @lru_cache(None)
  def solve(s):
   if not s:return 0
   best=len(s)
   for mask in range(1,1<<len(s)):
    chosen=''.join(c for i,c in enumerate(s) if mask>>i&1)
    if chosen==chosen[::-1]:best=min(best,1+solve(''.join(c for i,c in enumerate(s) if not mask>>i&1)))
   return best
  return solve(a)
 if pid==1385:return sum(not any(abs(x-y)<=args[2] for y in args[1]) for x in a)
 if pid==1399:
  groups=Counter(sum(map(int,str(x))) for x in range(1,a+1));return sum(v==max(groups.values()) for v in groups.values())
 if pid==1422:return max(a[:i].count('0')+a[i:].count('1') for i in range(1,len(a)))
 if pid==1446:return max(j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if len(set(a[i:j]))==1)
 if pid==1502:return any(len(set(p[i+1]-p[i] for i in range(len(p)-1)))<=1 for p in itertools.permutations(a))
 if pid==1512:return sum(a[i]==a[j] for i in range(len(a)) for j in range(i+1,len(a)))
 if pid==1534:
  x,y,z=args[1:];return sum(abs(a[i]-a[j])<=x and abs(a[j]-a[k])<=y and abs(a[i]-a[k])<=z for i,j,k in itertools.combinations(range(len(a)),3))
 if pid==1539:
  missing=[x for x in range(1,max(a)+args[1]+1) if x not in a];return missing[args[1]-1]
 if pid==1588:return sum(sum(a[i:j]) for i in range(len(a)) for j in range(i+1,len(a)+1,2))
 if pid==1668:
  b=args[1];return max([0]+[k for k in range(1,len(a)//len(b)+1) if any(a[i:i+k*len(b)]==b*k for i in range(len(a)-k*len(b)+1))])
 if pid==1716:return sum(1+i//7+i%7 for i in range(a))
 if pid==1742:
  counts=Counter(sum(map(int,str(x))) for x in range(a,args[1]+1));return max(counts.values())
 if pid==1827:
  # Independent exhaustive increment choices for small inputs, rather than a greedy scan.
  @lru_cache(None)
  def solve(i,previous):
   if i==len(a):return 0
   return min((x-a[i]+solve(i+1,x) for x in range(max(a[i],previous+1),max(a)+len(a)+1)),default=10**9)
  return solve(0,0)
 if pid==1863:
  total=0
  for mask in range(1<<len(a)):
   value=0
   for i,x in enumerate(a):
    if mask>>i&1:value^=x
   total+=value
  return total
 if pid==1869:
  best=lambda c:max([0]+[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if a[i:j]==c*(j-i)])
  return int(best('1')>best('0'))
 if pid==1979:return max(d for d in range(1,min(a)+1) if min(a)%d==0 and max(a)%d==0)
 if pid==1984:return min(max(s)-min(s) for s in itertools.combinations(a,args[1]))
 if pid==1991:return next((i for i in range(len(a)) if sum(a[:i])==sum(a[i+1:])), -1)
 if pid==1995:return sum(a[i]+a[j]+a[k]==a[l] for i,j,k,l in itertools.combinations(range(len(a)),4))
 if pid==2016:return max([-1]+[a[j]-a[i] for i in range(len(a)) for j in range(i+1,len(a)) if a[j]>a[i]])
 if pid==2027:
  # Exhaust subsets of length-three operations; overlapping operations are allowed.
  need={i for i,c in enumerate(a) if c=='X'}
  return min(mask.bit_count() for mask in range(1<<(len(a)-2)) if need<={j for i in range(len(a)-2) if mask>>i&1 for j in range(i,i+3)})
 if pid==2078:return max(j-i for i in range(len(a)) for j in range(i+1,len(a)) if a[i]!=a[j])
 if pid==2144:
  # Enumerate which disjoint triples are purchased together; remaining candy is paid individually.
  @lru_cache(None)
  def solve(v):
   if len(v)<3:return sum(v)
   best=sum(v)
   for ids in itertools.combinations(range(len(v)),3):
    selected=[v[i] for i in ids]
    best=min(best,sum(selected)-min(selected)+solve(tuple(x for i,x in enumerate(v) if i not in ids)))
   return best
  return solve(tuple(a))
 if pid==2154:
  x=args[1]
  for _ in range(len(a)+1):
   if not any(y==x for y in a):return x
   x*=2
 raise KeyError(pid)


def random_args(pid,r):
 n=r.randint(1,7);word=lambda n,alphabet:''.join(r.choice(alphabet) for _ in range(n))
 if pid==1046:return [[r.randint(1,20) for _ in range(n)]]
 if pid==1217:return [[r.randint(1,20) for _ in range(n)]]
 if pid==1221:
  a=list('LR'*r.randint(1,5));r.shuffle(a);return [''.join(a)]
 if pid==1287:
  n=r.randint(4,12);v=r.randrange(10);return [sorted([v]*(n//2+1)+list(range(20,20+n-n//2-1)))]
 if pid==1323:return [int(word(r.randint(1,4),'69'))]
 if pid==1332:return [word(n,'ab')]
 if pid==1385:return [[r.randint(-10,10) for _ in range(n)],[r.randint(-10,10) for _ in range(r.randint(1,7))],r.randint(0,5)]
 if pid==1399:return [r.randint(1,150)]
 if pid==1422:return [word(max(2,n),'01')]
 if pid==1446:return [word(n,'abc')]
 if pid==1502:return [[r.randint(-4,4) for _ in range(max(2,min(n,6)))]]
 if pid==1512:return [[r.randint(1,4) for _ in range(n)]]
 if pid==1534:return [[r.randint(0,10) for _ in range(max(3,n))],*[r.randint(0,10) for _ in range(3)]]
 if pid==1539:return [sorted(r.sample(range(1,20),n)),r.randint(1,12)]
 if pid==1588:return [[r.randint(1,10) for _ in range(n)]]
 if pid==1668:return [word(r.randint(1,15),'ab'),word(r.randint(1,5),'ab')]
 if pid==1716:return [r.randint(1,100)]
 if pid==1742:
  lo=r.randint(1,200);return [lo,lo+r.randint(0,100)]
 if pid==1827:return [[r.randint(1,6) for _ in range(min(n,5))]]
 if pid==1863:return [[r.randint(1,20) for _ in range(n)]]
 if pid==1869:return [word(n,'01')]
 if pid==1979:return [[r.randint(1,30) for _ in range(max(2,n))]]
 if pid==1984:return [[r.randint(0,20) for _ in range(n)],r.randint(1,n)]
 if pid==1991:return [[r.randint(-5,5) for _ in range(n)]]
 if pid==1995:return [[r.randint(1,12) for _ in range(max(4,n))]]
 if pid==2016:return [[r.randint(1,15) for _ in range(max(2,n))]]
 if pid==2027:return [word(max(3,n),'XO')]
 if pid==2078:
  a=[r.randint(0,3) for _ in range(max(2,n))];a[0]=0;a[-1]=1;return [a]
 if pid==2144:return [[r.randint(1,10) for _ in range(n)]]
 if pid==2154:return [[r.randint(1,20) for _ in range(n)],r.randint(1,12)]
 raise KeyError(pid)

EDGE={1046:[[[2,7,4,1,8,1]],[[1]],[[1,1]],[[9,3,2]]],1217:[[[1,2,3]],[[2,2,2,3,3]],[[1]],[[2,4]]],1221:[['RLRRLLRLRL'],['LR'],['LLRR'],['LRLR']],1287:[[[1,2,2,6,6,6,6,7,10]],[[1]],[[1,1,2,3]],[[0,1,2,3,3,3,3]]],1323:[[9669],[9999],[6],[6699]],1332:[['ababa'],['ab'],['a'],['abb']],1385:[[[4,5,8],[10,9,1,8],2],[[1],[3],2],[[1],[3],1],[[0],[-1,1],0]],1399:[[13],[1],[2],[24]],1422:[['011101'],['00'],['11'],['01'],['10']],1446:[['leetcode'],['a'],['abbccc'],['abab']],1502:[[[3,5,1]],[[1,2,4]],[[2,2]],[[3,3,3]],[[0,0,1]]],1512:[[[1,2,3,1,1,3]],[[1]],[[1,1,1,1]],[[1,2,3]]],1534:[[[3,0,1,1,9,7],7,2,3],[[0,0,0],0,0,0],[[1,2,3],1,1,1]],1539:[[[2,3,4,7,11],5],[[1,2,3,4],2],[[2],1],[[1],1]],1588:[[[1,4,2,5,3]],[[1]],[[1,2]],[[2,2,2]]],1668:[['ababc','ab'],['aaaaa','aa'],['a','aa'],['abaaba','aba']],1716:[[4],[7],[8],[20]],1742:[[1,10],[5,15],[19,28],[100000,100000]],1827:[[[1,1,1]],[[1]],[[3,2,1]],[[1,2,3]]],1863:[[[1,3]],[[5]],[[1,1]],[[3,4,5,6,7,8]]],1869:[['1101'],['111000'],['0'],['1'],['101010']],1979:[[[2,5,6,9,10]],[[6,10,15]],[[7,7]],[[1,1000]]],1984:[[[9,4,1,7],2],[[90],1],[[1,1],2],[[1,3],2]],1991:[[[2,3,-1,8,4]],[[1]],[[1,2]],[[0,0,0]]],1995:[[[1,2,3,6]],[[3,3,6,4,5]],[[1,1,1,3,5]],[[1,1,1,1]]],2016:[[[7,1,5,4]],[[9,4,3,2]],[[1,1]],[[1,5,2,10]]],2027:[['XXX'],['OOOO'],['XXOX'],['OXOOX'],['XOOXOOX']],2078:[[[1,1,1,6,1,1,1]],[[1,8,3,8,3]],[[0,1]],[[1,1,2,1]]],2144:[[[1,2,3]],[[6,5,7,9,2,2]],[[5]],[[1,1,1,1]]],2154:[[[5,3,6,1,12],3],[[1],2],[[1,2,4,8],1],[[3,3],3]]}

PRESSURE={1046:[([[1000]*30],0),([[1000]*29],1000)],1217:[([[10**9]*50+[999999999]*50],50)],1221:[(['LR'*500],500),(['L'*500+'R'*500],1)],1287:[([[100000]*10000],100000)],1323:[([6666],9666),([9999],9999)],1332:[(['a'*999+'b'],2),(['a'*1000],1)],1385:[([[1000]*500,[-1000]*500,100],500),([[1000]*500,[1000]*500,0],0)],1399:[([10000],1)],1422:[(['0'*250+'1'*250],500),(['1'*500],499)],1446:[(['a'*500],500),(['ab'*250],1)],1502:[([list(range(1000,0,-1))],1),([[1]*999+[2]],0)],1512:[([[100]*100],4950)],1534:[([[1000]*100,1000,1000,1000],161700)],1539:[([list(range(1,1001)),1000],2000)],1588:[([[1000]*100],85850000)],1668:[(['a'*100,'a'],100),(['a'*100,'aa'],50)],1716:[([1000],74926)],1742:[([1,100000],6000)],1827:[([[1]*5000],12497500)],1863:[([[20]*12],40960)],1869:[(['1'*50+'0'*50],0),(['1'*100],1)],1979:[([[1000]*1000],1000)],1984:[([[100000]*1000,1000],0)],1991:[([[0]*100],0)],1995:[([[1]*49+[3]],18424)],2016:[([list(range(1000,0,-1))],-1),([[1]*999+[10**9]],999999999)],2027:[(['X'*1000],334)],2078:[([[0]*99+[100]],99)],2144:[([[100]*100],6700)],2154:[([[1000]*1000,1000],2000)]}

META={
1046:('最后一块石头的重量','Last Stone Weight','反复取最重的两块石头 x≥y；若相等则都消失，否则换成重量 x-y 的一块。返回最后重量，没有石头返回 0。','Repeatedly remove the two heaviest stones x≥y. Equal stones disappear; otherwise insert one stone weighing x-y. Return the remaining weight, or 0 if none remain.'),
1217:('玩筹码','Minimum Cost to Move Chips to The Same Position','移动一枚筹码 2 格免费，移动 1 格花费 1，方向任意，可重复移动。求将所有筹码放在同一位置的最小总花费。','Moving a chip by two positions is free; moving it by one costs 1. Either direction and repeated moves are allowed. Return the minimum total cost to gather all chips at one position.'),
1221:('分割平衡字符串','Split a String in Balanced Strings','输入中 L 和 R 总数量相等。将整个字符串切成非空连续段，要求每段 L 和 R 数量相等，返回最多段数。','The input contains equal total numbers of L and R. Partition the entire string into nonempty contiguous pieces, each with equally many L and R. Return the maximum number of pieces.'),
1287:('有序数组中出现次数超过25%的元素','Element Appearing More Than 25% In Sorted Array','非递减数组中恰有一个值出现次数严格超过长度的四分之一，返回该值。','In a nondecreasing array, exactly one value occurs strictly more than one quarter of its length. Return that value.'),
1323:('6和9组成的最大数字','Maximum 69 Number','数字的十进制表示只含 6 和 9，可至多将一个 6 改为 9 或将一个 9 改为 6，返回最大结果。','The decimal representation contains only 6 and 9. Change at most one digit from 6 to 9 or from 9 to 6. Return the maximum result.'),
1332:('删除回文子序列','Remove Palindromic Subsequences','每次删除一个非空回文子序列，余下字符顺序保持。字符串仅含 a 和 b，求删空所需最少次数；子序列不必连续。','Each operation deletes a nonempty palindromic subsequence, retaining the order of remaining characters. The string contains only a and b. Return the fewest operations to empty it; subsequences need not be contiguous.'),
1385:('两个数组间的距离值','Find the Distance Value Between Two Arrays','统计 arr1 中满足下列条件的元素个数：与 arr2 中任一元素之差的绝对值都严格大于 d。重复元素按位置分别计数。','Count elements of arr1 whose absolute difference from every element of arr2 is strictly greater than d. Count duplicates separately by position.'),
1399:('统计最大组的数目','Count Largest Group','将 1 到 n 的整数按十进制各位数字之和分组，返回人数最多的组有多少个。','Group integers from 1 through n by their decimal digit sum. Return how many groups attain the largest group size.'),
1422:('分割字符串的最大得分','Maximum Score After Splitting a String','将二进制字符串切成两个非空连续部分，得分为左侧 0 的数量加右侧 1 的数量，返回最大得分。','Split the binary string into two nonempty contiguous parts. Score the number of zeros on the left plus ones on the right. Return the maximum score.'),
1446:('连续字符','Consecutive Characters','返回字符串中仅由一个相同字符组成的最长非空连续片段长度。','Return the maximum length of a nonempty contiguous run of one repeated character.'),
1502:('判断能否形成等差数列','Can Make Arithmetic Progression From Sequence','允许任意重排数组，判断是否能使相邻元素的差全部相同。','Reorder the array arbitrarily. Decide whether every adjacent difference can be made equal.'),
1512:('好数对的数目','Number of Good Pairs','统计满足 i<j 且 nums[i]=nums[j] 的下标对数量。','Count index pairs i<j with nums[i]=nums[j].'),
1534:('统计好三元组','Count Good Triplets','统计下标 i<j<k，满足 |arr[i]-arr[j]|≤a、|arr[j]-arr[k]|≤b、|arr[i]-arr[k]|≤c 的三元组数。','Count triples i<j<k satisfying |arr[i]-arr[j]|≤a, |arr[j]-arr[k]|≤b and |arr[i]-arr[k]|≤c.'),
1539:('第k个缺失的正整数','Kth Missing Positive Number','给定严格递增正整数数组，按从小到大顺序返回不在数组中的第 k 个正整数。','Given a strictly increasing positive integer array, return the kth positive integer absent from the array, in increasing order.'),
1588:('所有奇数长度子数组的和','Sum of All Odd Length Subarrays','计算每一个非空、奇数长度连续子数组的元素和，再将这些和全部相加。','Sum the elements of every nonempty contiguous subarray of odd length, then add all these subarray sums.'),
1668:('最大重复子字符串','Maximum Repeating Substring','返回最大的非负整数 k，使 word 连续重复 k 次后得到的整个字符串是 sequence 的连续子串。','Return the largest nonnegative k such that word repeated k times consecutively is a contiguous substring of sequence.'),
1716:('计算力扣银行的钱','Calculate Money in Leetcode Bank','从星期一开始存钱，第一周依次存 1 至 7 元，以后每一天比上周同一天多存 1 元，求前 n 天总额。','Start saving on Monday: deposit 1 through 7 during the first week. On each later day, deposit 1 more than on the same weekday one week earlier. Return the total for the first n days.'),
1742:('盒子中小球的最大数量','Maximum Number of Balls in a Box','闭区间 [lowLimit,highLimit] 的每个整数对应一球，放入编号为其十进制数字和的盒子，返回最多的盒中球数。','Each integer in inclusive [lowLimit,highLimit] contributes one ball to the box numbered by its decimal digit sum. Return the largest box population.'),
1827:('最少操作使数组递增','Minimum Operations to Make the Array Increasing','每次可将任一元素增加 1，求使整个数组严格递增所需的最少操作次数。','An operation increases any one element by 1. Return the fewest operations needed to make the entire array strictly increasing.'),
1863:('所有子集异或和的再求和','Sum of All Subset XOR Totals','对所有下标子集分别计算元素按位异或，再将结果相加。空子集结果为 0，数值相同但下标不同的选择分别计算。','Compute the bitwise XOR for every subset of indices and sum the results. The empty subset contributes 0; equal values at different indices are distinct choices.'),
1869:('哪种连续子字符串更长','Longer Contiguous Segments of Ones than Zeros','判断二进制字符串中最长连续 1 片段是否严格长于最长连续 0 片段。某字符不存在时，其最长长度视为 0。','Decide whether the longest contiguous run of ones is strictly longer than the longest run of zeros. An absent digit has maximum run length 0.'),
1979:('找出数组的最大公约数','Find Greatest Common Divisor of Array','返回数组最小值与最大值的最大公约数。','Return the greatest common divisor of the minimum and maximum array values.'),
1984:('学生分数的最小差值','Minimum Difference Between Highest and Lowest of K Scores','选择恰好 k 个不同下标，最小化所选元素最大值减最小值的差。','Select exactly k distinct indices, minimizing the difference between the maximum and minimum selected values.'),
1991:('找到数组的中间位置','Find the Middle Index in Array','返回最左下标，使其左边所有元素之和等于右边所有元素之和，两侧都不含本元素；空侧和为 0。不存在返回 -1。','Return the leftmost index whose strictly left sum equals its strictly right sum. Empty sides sum to zero. Return -1 if no such index exists.'),
1995:('统计特殊四元组','Count Special Quadruplets','统计下标 a<b<c<d，满足 nums[a]+nums[b]+nums[c]=nums[d] 的四元组数量。','Count quadruplets a<b<c<d satisfying nums[a]+nums[b]+nums[c]=nums[d].'),
2016:('增量元素之间的最大差值','Maximum Difference Between Increasing Elements','在 i<j 且 nums[i]<nums[j] 的条件下，最大化 nums[j]-nums[i]；没有可选下标对则返回 -1。','Maximize nums[j]-nums[i] subject to i<j and nums[i]<nums[j]. Return -1 if no valid pair exists.'),
2027:('转换字符串的最少操作次数','Minimum Moves to Convert String','每次选取恰好三个连续字符并全部变为 O，原有 O 保持不变。返回将只含 X 和 O 的字符串全部变为 O 的最少次数。','Each operation chooses exactly three consecutive characters and changes them all to O. Existing O stays unchanged. Return the fewest operations needed to turn an X/O string entirely into O.'),
2078:('两栋颜色不同且距离最远的房子','Two Furthest Houses With Different Colors','下标代表房屋位置，元素代表颜色。选择颜色不同的两栋房屋，返回最大的下标绝对差；保证至少两种颜色。','Indices represent house positions and values represent colors. Return the largest absolute index difference between houses of different colors. At least two colors exist.'),
2144:('打折购买糖果的最小开销','Minimum Cost of Buying Candies With Discount','一次购买两颗糖可免费选一颗，免费糖价格不得超过这两颗中较便宜的一颗。每颗糖只能使用一次，允许不凑齐三颗，求买下所有糖的最低总价。','Buying two candies allows one free candy costing at most the cheaper of the purchased two. Each candy is used once; incomplete groups may be purchased normally. Return the minimum cost to acquire all candy.'),
2154:('将找到的值乘以2','Keep Multiplying Found Values by Two','若数组包含当前 original，就将 original 乘 2 并继续查找；否则立即停止，返回停止时的值。','If the array contains the current original, double original and repeat; otherwise stop immediately. Return the value when the process stops.'),
}

SINGLE_STRING={1221,1332,1422,1446,1869,2027}
TWO_STRINGS={1668}
SCALARS={1323,1399,1716,1742}
ARRAY_PARAM={1539,1984,2154}
BOOL={1502,1869}

def encode(pid,args):
 if pid in SINGLE_STRING|TWO_STRINGS:return '\n'.join(args)+'\n'
 if pid in SCALARS:return ' '.join(map(str,args))+'\n'
 if pid==1385:return f'{len(args[0])} {len(args[1])} {args[2]}\n'+' '.join(map(str,args[0]))+'\n'+' '.join(map(str,args[1]))+'\n'
 return str(len(args[0]))+(' '+' '.join(map(str,args[1:])) if len(args)>1 else '')+'\n'+' '.join(map(str,args[0]))+'\n'

def parse(pid):
 if pid in SINGLE_STRING:return "args=[sys.stdin.readline().strip()]"
 if pid in TWO_STRINGS:return "args=[sys.stdin.readline().strip() for _ in range(2)]"
 if pid in SCALARS:return 'args=list(map(int,sys.stdin.read().split()))'
 if pid==1385:return 'v=list(map(int,sys.stdin.read().split())); n,m,d=v[:3]; assert len(v)==n+m+3; args=[v[3:3+n],v[3+n:],d]'
 extras=3 if pid==1534 else 1 if pid in ARRAY_PARAM else 0
 return f'v=list(map(int,sys.stdin.read().split())); n=v[0]; assert len(v)==n+{extras+1}; args=[v[{extras+1}:]]+v[1:{extras+1}]'

LIMITS={1046:(1,30,1,1000),1217:(1,100,1,10**9),1287:(1,10000,0,100000),1385:(1,500,-1000,1000),1502:(2,1000,-10**6,10**6),1512:(1,100,1,100),1534:(3,100,0,1000),1539:(1,1000,1,1000),1588:(1,100,1,1000),1827:(1,5000,1,10000),1863:(1,12,1,20),1979:(2,1000,1,1000),1984:(1,1000,0,100000),1991:(1,100,-1000,1000),1995:(4,50,1,100),2016:(2,1000,1,10**9),2078:(2,100,0,100),2144:(1,100,1,100),2154:(1,1000,1,1000)}
STR_LIMITS={1221:(2,1000,'LR'),1332:(1,1000,'ab'),1422:(2,500,'01'),1446:(1,500,'abcdefghijklmnopqrstuvwxyz'),1668:(1,100,'abcdefghijklmnopqrstuvwxyz'),1869:(1,100,'01'),2027:(3,1000,'XO')}

def validate(pid,args):
 count=3 if pid==1385 else 4 if pid==1534 else 2 if pid in ARRAY_PARAM|TWO_STRINGS|{1742} else 1
 assert isinstance(args,list) and len(args)==count
 a=args[0]
 if pid in STR_LIMITS:
  lo,hi,chars=STR_LIMITS[pid]
  assert all(isinstance(s,str) and lo<=len(s)<=hi and set(s)<=set(chars) for s in args)
  if pid==1221:assert a.count('L')==a.count('R')
  return
 if pid in SCALARS:
  assert all(type(x) is int for x in args)
  if pid==1323:assert 1<=a<=10000 and set(str(a))<=set('69')
  elif pid==1399:assert 1<=a<=10000
  elif pid==1716:assert 1<=a<=1000
  else:assert 1<=a<=args[1]<=100000
  return
 lo,hi,vlo,vhi=LIMITS[pid]
 assert isinstance(a,list) and lo<=len(a)<=hi and all(type(x) is int and vlo<=x<=vhi for x in a)
 if pid==1287:assert a==sorted(a) and sum(v*4>len(a) for v in Counter(a).values())==1
 if pid==1385:assert isinstance(args[1],list) and 1<=len(args[1])<=500 and all(type(x) is int and -1000<=x<=1000 for x in args[1]) and type(args[2]) is int and 0<=args[2]<=100
 if pid==1534:assert all(type(x) is int and 0<=x<=1000 for x in args[1:])
 if pid==1539:assert a==sorted(set(a)) and type(args[1]) is int and 1<=args[1]<=1000
 if pid==1984:assert type(args[1]) is int and 1<=args[1]<=len(a)
 if pid==2154:assert type(args[1]) is int and 1<=args[1]<=1000
 if pid==2078:assert len(set(a))>=2

EXTRA_CONSTRAINTS={1287:('数组非递减，恰有一个值出现次数超过长度四分之一。','Nondecreasing; exactly one value occurs more than a quarter of the length.'),1385:('第二数组长 1 至 500，值在 [-1000,1000]；0≤d≤100。','Second array length 1–500 with values in [-1000,1000]; 0≤d≤100.'),1534:('0≤a,b,c≤1000。','0≤a,b,c≤1000.'),1539:('数组严格递增；1≤k≤1000。','Strictly increasing array; 1≤k≤1000.'),1984:('1≤k≤数组长度。','1≤k≤array length.'),2078:('至少两种不同颜色。','At least two distinct colors.'),2154:('1≤original≤1000。','1≤original≤1000.')}

WRONG={1046:('returns absolute sum difference of alternating sorted stones',"print(abs(sum(sorted(args[0])[::2])-sum(sorted(args[0])[1::2])))"),1217:('counts chips at nonmodal positions rather than parity',"c=Counter(args[0]); print(len(args[0])-max(c.values()))"),1221:('allows unmatched leftover characters in each piece',"print(len(args[0])//2)"),1287:('returns median even when special value lies elsewhere',"print(args[0][len(args[0])//2])"),1323:('changes rightmost six rather than leftmost',"s=str(args[0]); i=s.rfind('6'); print(int(s if i<0 else s[:i]+'9'+s[i+1:]))"),1332:('counts distinct letters even for an existing palindrome',"print(len(set(args[0])))"),1385:('uses strict inequality for the forbidden distance',"a,b,d=args; print(sum(all(abs(x-y)>=d for y in b) for x in a))"),1399:('returns maximum group size rather than number of groups',"print(max(Counter(sum(map(int,str(x))) for x in range(1,args[0]+1)).values()))"),1422:('allows an empty split side',"s=args[0]; print(max(s[:i].count('0')+s[i:].count('1') for i in range(len(s)+1)))"),1446:('counts global frequency rather than consecutive run',"print(max(Counter(args[0]).values()))"),1502:('checks input order without allowing rearrangement',"a=args[0]; print(int(len(set(y-x for x,y in zip(a,a[1:])))==1))"),1512:('counts both pair orders',"print(sum(c*(c-1) for c in Counter(args[0]).values()))"),1534:('omits the first-to-third distance condition',"v,a,b,c=args; print(sum(abs(v[i]-v[j])<=a and abs(v[j]-v[k])<=b for i,j,k in itertools.combinations(range(len(v)),3)))"),1539:('counts missing values only beyond final element',"print(args[0][-1]+args[1])"),1588:('includes even-length subarrays',"a=args[0]; print(sum(sum(a[i:j]) for i in range(len(a)) for j in range(i+1,len(a)+1)))"),1668:('counts separated occurrences as consecutive repeats',"print(args[0].count(args[1]))"),1716:('repeats identical weekly deposits',"print(sum(1+i%7 for i in range(args[0])))"),1742:('assigns boxes by the last digit only',"print(max(Counter(x%10 for x in range(args[0],args[1]+1)).values()))"),1827:('enforces nondecreasing instead of strictly increasing',"a=args[0]; prev=0; cost=0\nfor x in a:\n y=max(prev,x); cost+=y-x; prev=y\nprint(cost)"),1863:('XORs entire array only',"v=0\nfor x in args[0]: v^=x\nprint(v)"),1869:('compares total ones and zeros',"s=args[0]; print(int(s.count('1')>s.count('0')))"),1979:('uses gcd of every value instead of minimum and maximum',"print(math.gcd(*args[0]))"),1984:('looks only at first k values',"a,k=args; print(max(a[:k])-min(a[:k]))"),1991:('chooses rightmost qualifying index',"a=args[0]; print(next((i for i in range(len(a)-1,-1,-1) if sum(a[:i])==sum(a[i+1:])), -1))"),1995:('ignores required order of indices',"a=args[0]; print(sum(sum(a[i] for i in t)==a[j] for t in itertools.combinations(range(len(a)),3) for j in range(len(a)) if j not in t))"),2016:('ignores temporal index ordering',"a=args[0]; print(max(a)-min(a))"),2027:('divides total X count by three ignoring positions',"print((args[0].count('X')+2)//3)"),2078:('compares endpoints only',"a=args[0]; print(len(a)-1 if a[0]!=a[-1] else 0)"),2144:('applies free candy offer in ascending groups',"a=sorted(args[0]); print(sum(x for i,x in enumerate(a) if i%3!=2))"),2154:('performs only a single doubling',"a,x=args; print(x*2 if x in a else x)")}

# Explicit witnesses for errors whose ordinary examples can agree by coincidence.
EDGE[1534].extend([[[0,1000,0],1000,1000,0],[[0,1000,0],999,1000,0],[[0,0,1000],0,1000,999]])
EDGE[1046].append([[1,1,1,2,3]])
EDGE[1287].append([[1,1,1,2,3,4,5,6]])
EDGE[1668].append(['abxxab','ab'])
EDGE[1742].append([1,20])
EDGE[1869].append(['110010101'])
EDGE[1995].append([[6,1,2,3]])


def make(pid):
 zh,en,dzh,den=META[pid]
 if pid in SINGLE_STRING:
  izh,ien='一行字符串 s。','One line: string s.'
 elif pid in TWO_STRINGS:izh,ien='第一行 sequence，第二行 word。','First line: sequence. Second line: word.'
 elif pid in SCALARS:
  name='lowLimit highLimit' if pid==1742 else 'num' if pid==1323 else 'n';izh,ien='一行 '+name+'。','One line: '+name+'.'
 elif pid==1385:izh,ien='第一行 n m d；第二行 arr1 的 n 个整数；第三行 arr2 的 m 个整数。','First line: n m d. Second: n arr1 integers. Third: m arr2 integers.'
 else:
  tail=' a b c' if pid==1534 else ' k' if pid in {1539,1984} else ' original' if pid==2154 else ''
  izh,ien='第一行数组长度 n'+tail+'；第二行 n 个整数。','First line: array length n'+tail+'. Second line: n integers.'
 if pid in LIMITS:
  lo,hi,vlo,vhi=LIMITS[pid];izh+=f' {lo}≤数组长度≤{hi}，{vlo}≤元素值≤{vhi}。';ien+=f' Array length {lo}–{hi}; values in [{vlo},{vhi}].'
  if pid in EXTRA_CONSTRAINTS:izh+=' '+EXTRA_CONSTRAINTS[pid][0];ien+=' '+EXTRA_CONSTRAINTS[pid][1]
 elif pid in STR_LIMITS:
  lo,hi,chars=STR_LIMITS[pid];alphabet='小写英文字母' if len(chars)==26 else chars;english='lowercase English letters' if len(chars)==26 else chars
  izh+=f' 每个字符串长度 {lo} 至 {hi}，仅含{alphabet}。';ien+=f' Each length {lo}–{hi}; characters limited to {english}.'
  if pid==1221:izh+=' L、R 数量相等。';ien+=' Equal numbers of L and R.'
 else:
  c={1323:('1≤num≤10000，十进制仅含 6 和 9。','1≤num≤10000; decimal digits only 6 and 9.'),1399:('1≤n≤10000。','1≤n≤10000.'),1716:('1≤n≤1000。','1≤n≤1000.'),1742:('1≤lowLimit≤highLimit≤100000。','1≤lowLimit≤highLimit≤100000.')}[pid];izh+=' '+c[0];ien+=' '+c[1]
 name,body=WRONG[pid]
 return dict(method=METHODS[pid],titleZh=zh,titleEn=en,descriptionZh=dzh,descriptionEn=den,inputZh=izh,inputEn=ien,outputZh='成立输出 1，否则输出 0。' if pid in BOOL else '输出一个整数和换行。',outputEn='Print 1 if true, otherwise 0.' if pid in BOOL else 'Print one integer followed by a newline.',difficulty='简单',edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:int(oracle(pid,a)),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[dict(name=name,source='import sys, math, itertools\nfrom collections import Counter\n'+parse(pid)+'\n'+body+'\n')],validate=lambda a:validate(pid,a))

PROBLEMS={pid:make(pid) for pid in IDS}
