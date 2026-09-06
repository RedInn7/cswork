"""Third original array batch. Domains checked against both local statement languages.
No downloaded solution or old fixture generator is imported/executed.
"""
import math
import itertools
from collections import Counter, deque
from functools import lru_cache

IDS=[2176,2269,2367,2379,2423,2441,2506,2529,2540,2558,2696,2748,2760,2765,2784,2815,2824,2848,2960,2980,3010,3090,3105,3258,3354,3364,3375,3396,3427,3432]
METHODS=dict(zip(IDS,['countPairs','divisorSubstrings','arithmeticTriplets','minimumRecolors','equalFrequency','findMaxK','similarPairs','maximumCount','getCommon','pickGifts','minLength','countBeautifulPairs','longestAlternatingSubarray','alternatingSubarray','isGood','maxSum','countPairs','numberOfPoints','countTestedDevices','hasTrailingZeros','minimumCost','maximumLengthSubstring','longestMonotonicSubarray','countKConstraintSubstrings','countValidSelections','minimumSumSubarray','minOperations','minimumOperations','subarraySum','countPartitions']))


def oracle(pid,args):
 a=args[0]
 if pid==2176:return sum(a[i]==a[j] and i*j%args[1]==0 for i,j in itertools.combinations(range(len(a)),2))
 if pid==2269:
  s=str(a);k=args[1];return sum(int(s[i:i+k])!=0 and a%int(s[i:i+k])==0 for i in range(len(s)-k+1))
 if pid==2367:return sum(a[j]-a[i]==args[1] and a[k]-a[j]==args[1] for i,j,k in itertools.combinations(range(len(a)),3))
 if pid==2379:return min(a[i:i+args[1]].count('W') for i in range(len(a)-args[1]+1))
 if pid==2423:return int(any(len(set(Counter(a[:i]+a[i+1:]).values()))==1 for i in range(len(a))))
 if pid==2441:return max([-1]+[x for x in a if x>0 and any(x==-y for y in a)])
 if pid==2506:return sum(set(x)==set(y) for x,y in itertools.combinations(a,2))
 if pid==2529:return max(sum(x<0 for x in a),sum(x>0 for x in a))
 if pid==2540:return min([x for x in a if any(x==y for y in args[1])],default=-1)
 if pid==2558:
  a=a[:]
  for _ in range(args[1]):
   i=a.index(max(a));a[i]=math.isqrt(a[i])
  return sum(a)
 if pid==2696:
  @lru_cache(None)
  def solve(s):return min([len(s)]+[solve(s[:i]+s[i+2:]) for i in range(len(s)-1) if s[i:i+2] in ('AB','CD')])
  return solve(a)
 if pid==2748:return sum(not any(int(str(a[i])[0])%d==0 and a[j]%10%d==0 for d in range(2,10)) for i,j in itertools.combinations(range(len(a)),2))
 if pid==2760:return max([0]+[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if a[i]%2==0 and all(x<=args[1] for x in a[i:j]) and all(a[k]%2!=a[k+1]%2 for k in range(i,j-1))])
 if pid==2765:return max([-1]+[j-i for i in range(len(a)) for j in range(i+2,len(a)+1) if all(a[k]==a[i]+(k-i)%2 for k in range(i,j))])
 if pid==2784:
  n=len(a)-1;return int(n>=1 and all(a.count(x)==(2 if x==n else 1) for x in range(1,n+1)) and all(1<=x<=n for x in a))
 if pid==2815:return max([-1]+[x+y for x,y in itertools.combinations(a,2) if max(str(x))==max(str(y))])
 if pid==2824:return sum(x+y<args[1] for x,y in itertools.combinations(a,2))
 if pid==2848:return sum(any(lo<=x<=hi for lo,hi in a) for x in range(1,101))
 if pid==2960:
  a=a[:];count=0
  for i in range(len(a)):
   if a[i]:
    count+=1
    for j in range(i+1,len(a)):a[j]=max(0,a[j]-1)
  return count
 if pid==2980:
  for size in range(2,len(a)+1):
   for chosen in itertools.combinations(a,size):
    v=0
    for x in chosen:v|=x
    if v%2==0:return 1
  return 0
 if pid==3010:return min(a[0]+a[i]+a[j] for i,j in itertools.combinations(range(1,len(a)),2))
 if pid==3090:return max(j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if all(x<=2 for x in Counter(a[i:j]).values()))
 if pid==3105:return max(j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if all(a[k]<a[k+1] for k in range(i,j-1)) or all(a[k]>a[k+1] for k in range(i,j-1)))
 if pid==3258:return sum(a[i:j].count('0')<=args[1] or a[i:j].count('1')<=args[1] for i in range(len(a)) for j in range(i+1,len(a)+1))
 if pid==3354:
  count=0
  for start in range(len(a)):
   if a[start]:continue
   for direction in (-1,1):
    b=a[:];i=start
    while 0<=i<len(b):
     if b[i]:b[i]-=1;direction=-direction
     i+=direction
    count+=not any(b)
  return count
 if pid==3364:return min((sum(a[i:j]) for i in range(len(a)) for j in range(i+args[1],min(len(a),i+args[2])+1) if sum(a[i:j])>0),default=-1)
 if pid==3375:
  k=args[1];start=tuple(a);q=deque([(start,0)]);seen={start}
  while q:
   state,steps=q.popleft()
   if all(x==k for x in state):return steps
   for h in range(k,max(state)):
    above={x for x in state if x>h}
    if len(above)==1:
     nxt=tuple(min(x,h) for x in state)
     if nxt not in seen:seen.add(nxt);q.append((nxt,steps+1))
  return -1
 if pid==3396:return next(steps for steps in range((len(a)+2)//3+1) if len(set(a[steps*3:]))==len(a[steps*3:]))
 if pid==3427:return sum(a[j] for i in range(len(a)) for j in range(max(0,i-a[i]),i+1))
 if pid==3432:return sum((sum(a[:i])-sum(a[i:]))%2==0 for i in range(1,len(a)))
 raise KeyError(pid)


def random_args(pid,r):
 n=r.randint(1,7);nums=lambda lo,hi,n=n:[r.randint(lo,hi) for _ in range(n)]
 word=lambda alphabet,n=n:''.join(r.choice(alphabet) for _ in range(n))
 if pid==2176:return [nums(1,5),r.randint(1,10)]
 if pid==2269:
  x=r.randint(1,999999);return [x,r.randint(1,len(str(x)))]
 if pid==2367:return [sorted(r.sample(range(21),max(3,n))),r.randint(1,5)]
 if pid==2379:return [word('BW'),r.randint(1,n)]
 if pid==2423:return [word('abc',max(2,n))]
 if pid==2441:return [[r.choice([-1,1])*r.randint(1,5) for _ in range(n)]]
 if pid==2506:return [[word('abc',r.randint(1,5)) for _ in range(n)]]
 if pid==2529:return [sorted(nums(-5,5))]
 if pid==2540:return [sorted(nums(1,10)),sorted(nums(1,10,r.randint(1,7)))]
 if pid==2558:return [nums(1,100),r.randint(1,8)]
 if pid==2696:return [word('ABCDX')]
 if pid==2748:return [[r.choice([x for x in range(1,200) if x%10]) for _ in range(max(2,n))]]
 if pid==2760:return [nums(1,10),r.randint(1,10)]
 if pid==2765:return [nums(1,6,max(2,n))]
 if pid==2784:
  a=list(range(1,n))+[max(1,n-1)] if r.randrange(2) else nums(1,8);r.shuffle(a);return [a]
 if pid==2815:return [nums(1,99,max(2,n))]
 if pid==2824:return [nums(-10,10),r.randint(-10,10)]
 if pid==2848:
  out=[]
  for _ in range(n):
   a=r.randint(1,10);out.append([a,r.randint(a,15)])
  return [out]
 if pid==2960:return [nums(0,6)]
 if pid==2980:return [nums(1,10,max(2,n))]
 if pid==3010:return [nums(1,10,max(3,n))]
 if pid==3090:return [word('abc',max(2,n))]
 if pid==3105:return [nums(1,6)]
 if pid==3258:return [word('01'),r.randint(1,n)]
 if pid==3354:
  a=nums(0,4);a[r.randrange(n)]=0;return [a]
 if pid==3364:
  lo=r.randint(1,n);return [nums(-8,8),lo,r.randint(lo,n)]
 if pid==3375:return [nums(1,6),r.randint(1,6)]
 if pid==3396:return [nums(1,5)]
 if pid==3427:return [nums(1,10)]
 if pid==3432:return [nums(1,10,max(2,n))]
 raise KeyError(pid)

EDGE={2176:[[[3,1,2,2,2,1,3],2],[[1],1],[[1,1],100]],2269:[[240,2],[430043,2],[1,1],[1000,1]],2367:[[[0,1,4,6,7,10],3],[[0,1,2],1],[[1,4,8],2]],2379:[['WBBWWBBWBW',7],['B',1],['W',1],['WWBB',2]],2423:[['abcc'],['aazz'],['aa'],['ab'],['aabbccc']],2441:[[[-1,2,-3,3]],[[-1,10,6,7,-7,1]],[[1]],[[1000,-1000]]],2506:[[['aba','aabb','abcd','bac','aabc']],[['a']],[['ab','ba']],[['a','aa','aaa']]],2529:[[[-2,-1,-1,1,2,3]],[[0,0]],[[1]],[[0,1]]],2540:[[[1,2,3],[2,4]],[[1],[2]],[[2,3],[1,2,3]],[[1,1],[1]]],2558:[[[25,64,9,4,100],4],[[1],10],[[10],1]],2696:[['ABFCACDB'],['ACBBD'],['ABCD'],['AABB'],['X']],2748:[[[2,5,1,4]],[[11,21]],[[99,99]],[[12,34,56]]],2760:[[[3,2,5,4],5],[[1],1],[[2],2],[[2,4,3],4],[[2],1]],2765:[[[2,3,4,3,4]],[[4,5,6]],[[2,1]],[[1,2,1,2]]],2784:[[[1,3,3,2]],[[1,1]],[[1]],[[1,1,2,3]]],2815:[[[51,71,17,24,42]],[[1,2]],[[11,1]],[[99,9]]],2824:[[[-1,1,2,3,1],2],[[1,1],2],[[1],2]],2848:[[[[3,6],[1,5],[4,7]]],[[[1,1]]],[[[1,2],[3,4]]]],2960:[[[1,1,2,1,3]],[[0,1,2]],[[0]],[[1,1]]],2980:[[[1,2,3,4,5]],[[1,3]],[[2,1]],[[2,2]]],3010:[[[1,2,3,12]],[[10,3,1,1]],[[3,2,1]]],3090:[['bcbbbcba'],['aaaa'],['ab'],['abcabc']],3105:[[[1,4,3,3,2]],[[3,3,3]],[[1]],[[5,4,3,2,1]]],3258:[['10101',1],['0',1],['01',1],['00000',1]],3354:[[[1,0,2,0,3]],[[2,3,4,0,4,1,0]],[[0]],[[0,1]],[[0,0]]],3364:[[[3,-2,1,4],2,3],[[-2,2,-3,1],2,3],[[0],1,1],[[1],1,1]],3375:[[[5,2,5,4,5],2],[[2,1,2],2],[[9,7,5,3],1],[[3,3],3]],3396:[[[1,2,3,4,2,3,3,5,7]],[[1,1]],[[1,2,3]],[[1,2,3,1]]],3427:[[[2,3,1]],[[3,1,1,2]],[[1]]],3432:[[[10,10,3,7,6]],[[1,2]],[[1,1]] ]}

PRESSURE={2176:[([[100]*100,1],4950)],2269:[([10**9,1],1),([10**9,10],1)],2367:[([list(range(200)),1],198),([list(range(200)),50],100)],2379:[(['W'*100,100],100)],2423:[(['a'*100],1),(['a'*50+'b'*50],0)],2441:[([[-1000]*500+[1000]*500],1000)],2506:[([['a'*100]*100],4950)],2529:[([[-2000]*1000+[0]*1000],1000)],2540:[([[10**9]*100000,[10**9]*100000],10**9),([[1]*100000,[10**9]*100000],-1)],2558:[([[10**9]*1000,1000],31622000)],2696:[(['A'*50+'B'*50],0),(['Z'*100],100)],2748:[([[9999]*100],0),([[1111]*100],4950)],2760:[([[98,99]*50,100],100),([[100]*100,1],0)],2765:[([[9999,10000]*50],100),([list(range(100,0,-1))],-1)],2784:[([list(range(1,100))+[99]],1),([[200]*100],0)],2815:[([[10000]*100],20000)],2824:[([[-50]*50,50],1225),([[50]*50,50],0)],2848:[([[[1,100]]*100],100)],2960:[([[100]*100],100),([[0]*100],0)],2980:[([[100]*100],1),([[99]*100],0)],3010:[([[50]*50],150)],3090:[(['ab'*50],4),(['a'*100],2)],3105:[([list(range(1,51))],50)],3258:[(['01'*25,50],1275),(['01'*25,1],147)],3354:[([[0]*100],200),([[100]*49+[0]+[100]*50],0)],3364:[([[1000]*100,100,100],100000),([[-1000]*100,1,100],-1)],3375:[([list(range(1,101)),1],99),([[100]*100,100],0)],3396:[([[100]*100],33)],3427:[([[1000]*100],5050000)],3432:[([[100]*100],99),([[100]*99+[99]],0)]}

META={
2176:('统计数组中相等且可以被整除的数对','Count Equal and Divisible Pairs in an Array','下标从 0 开始，统计 i<j、nums[i]=nums[j] 且 i*j 能被 k 整除的下标对。','Using zero-based indices, count pairs i<j with nums[i]=nums[j] and i*j divisible by k.'),
2269:('找到一个数字的K美丽值','Find the K-Beauty of a Number','取 num 十进制表示中每个长度恰为 k 的连续片段，统计对应整数非零且能整除 num 的片段数。片段可有前导零，不同位置分别计数。','Inspect every length-k contiguous fragment of decimal num. Count fragments representing nonzero divisors of num. Fragments may have leading zeroes; different positions count separately.'),
2367:('等差三元组的数目','Number of Arithmetic Triplets','统计 i<j<k，满足 nums[j]-nums[i]=diff 且 nums[k]-nums[j]=diff 的三元组数。','Count triples i<j<k satisfying nums[j]-nums[i]=diff and nums[k]-nums[j]=diff.'),
2379:('得到K个黑块的最少涂色次数','Minimum Recolors to Get K Consecutive Black Blocks','B 为黑块、W 为白块。每次可将一个白块变黑，求使至少 k 个连续块全黑的最少次数。','B denotes black and W white. Each operation recolors one white block black. Return the fewest operations needed for at least k consecutive black blocks.'),
2423:('删除字符使频率相同','Remove Letter To Equalize Frequency','必须恰好删除一个字符，判断能否使剩余所有出现的字母的出现次数相同；不出现的字母不参与比较。','Delete exactly one character. Decide whether all letters remaining in the string can have equal frequencies. Absent letters do not participate.'),
2441:('与对应负数同时存在的最大正整数','Largest Positive Integer That Exists With Its Negative','返回数组中同时存在 k 和 -k 的最大正整数 k；不存在返回 -1。','Return the largest positive k such that both k and -k occur in the array, or -1 if absent.'),
2506:('统计相似字符串对的数目','Count Pairs Of Similar Strings','两个字符串相似当且仅当包含的不同字母集合相同，字母次数和顺序不重要。统计相似下标对 i<j 的数量。','Strings are similar exactly when their sets of distinct letters match; multiplicities and order do not matter. Count similar index pairs i<j.'),
2529:('正整数和负整数的最大计数','Maximum Count of Positive Integer and Negative Integer','分别统计严格正数与严格负数的数量，返回两者较大值。0 不属于任一类。','Count strictly positive and strictly negative values and return the larger count. Zero belongs to neither category.'),
2540:('最小公共值','Minimum Common Value','返回两个数组都包含的最小整数；没有公共值返回 -1。','Return the smallest integer occurring in both arrays, or -1 if no common value exists.'),
2558:('从数量最多的堆取走礼物','Take Gifts From the Richest Pile','执行恰好 k 次操作，每次选当前礼物数最多的一堆，将其数量变为该数量平方根向下取整，其他堆不变。并列最多时任取，返回最终总数。','Perform exactly k operations: choose a currently largest pile and replace its size by the floor of its square root. Other piles stay unchanged. Ties may be broken arbitrarily. Return the final total.'),
2696:('删除子串后的字符串最小长度','Minimum String Length After Removing Substrings','每次可删除任一连续 AB 或 CD，删除后两侧拼接，可继续删除新形成的片段。求可达到的最短长度。','Delete any contiguous AB or CD, joining the remaining sides. Newly formed fragments may also be deleted. Return the minimum achievable length.'),
2748:('美丽下标对的数目','Number of Beautiful Pairs','统计 i<j，满足 nums[i] 的十进制首位与 nums[j] 的十进制末位互质的下标对；互质表示最大公约数为 1。','Count pairs i<j for which the first decimal digit of nums[i] and last decimal digit of nums[j] are coprime, meaning their greatest common divisor is 1.'),
2760:('最长奇偶子数组','Longest Even Odd Subarray With Threshold','寻找最长连续片段，要求第一个数为偶数、相邻元素奇偶性不同、每个值都不超过 threshold。单个合法偶数可构成长度 1，找不到返回 0。','Find the longest contiguous segment starting with an even value, alternating parity between neighbors, with every value at most threshold. A single valid even value has length 1. Return 0 if absent.'),
2765:('最长交替子数组','Longest Alternating Subarray','寻找长度至少 2 的最长连续片段，其相邻差必须依次为 +1,-1,+1,-1……，第一步必须是 +1。不存在返回 -1。','Find the longest contiguous segment of length at least 2 whose successive differences are +1,-1,+1,-1 and so on, starting with +1. Return -1 if absent.'),
2784:('检查数组是否是好的','Check if Array is Good','判断数组能否重排为某个 [1,2,...,m-1,m,m]，其中 m≥1，1 至 m-1 各一次且 m 恰两次。','Decide whether the array can be rearranged into [1,2,...,m-1,m,m] for some m≥1: each value below m occurs once and m twice.'),
2815:('数组中的最大数对和','Max Pair Sum in an Array','选择两个不同下标，要求两个数各自十进制表示中的最大数字相同。返回最大两数和，找不到返回 -1。','Choose two distinct indices whose values have equal largest decimal digits. Return the maximum pair sum, or -1 if absent.'),
2824:('统计和小于目标的下标对数目','Count Pairs Whose Sum is Less than Target','统计满足 i<j 且 nums[i]+nums[j] 严格小于 target 的下标对数量。','Count pairs i<j whose sum nums[i]+nums[j] is strictly less than target.'),
2848:('与车相交的点','Points That Intersect With Cars','每个闭区间 [start,end] 表示一辆车覆盖的点。返回至少被一个区间覆盖的不同整数点数量，包括端点。','Each inclusive interval [start,end] describes covered points. Return the number of distinct integer points covered by at least one interval, including endpoints.'),
2960:('统计已测试设备','Count Tested Devices After Test Operations','从左到右处理电量数组。当前电量大于 0 时测试该设备，并将其右侧所有电量减 1、最低保持 0；当前为 0 时跳过。返回测试设备数。','Process battery levels from left to right. If the current level is positive, test that device and decrease all later levels by 1, clamping at zero. Skip a zero-level device. Return the number tested.'),
2980:('检查按位或是否存在尾随零','Check if Bitwise OR Has Trailing Zeros','可选择至少两个不同下标，判断所选值按位或的二进制表示能否以 0 结尾，也就是结果为偶数。','Choose at least two distinct indices. Decide whether the bitwise OR of their values can end in a zero bit, equivalently be even.'),
3010:('将数组分成最小总代价的子数组I','Divide an Array Into Subarrays With Minimum Cost I','将整个数组按顺序分为恰好三个非空连续子数组，每段代价是该段第一个元素，求三段总代价最小值。','Partition the entire array in order into exactly three nonempty contiguous subarrays. Each cost is its first element. Return the minimum sum of the three costs.'),
3090:('每个字符最多出现两次的最长子字符串','Maximum Length Substring With Two Occurrences','返回最长连续子串的长度，要求其中每个字符出现至多两次。','Return the maximum length of a contiguous substring in which every character occurs at most twice.'),
3105:('最长严格递增或递减子数组','Longest Strictly Increasing or Strictly Decreasing Subarray','返回最长严格递增或严格递减连续子数组的长度，不能跳过元素。单个元素满足条件。','Return the longest contiguous strictly increasing or strictly decreasing subarray length. Elements cannot be skipped; a singleton qualifies.'),
3258:('统计满足K约束的子字符串数量I','Count Substrings That Satisfy K-Constraint I','统计非空连续二进制子串数量，要求 0 的数量至多 k 或者 1 的数量至多 k，满足任一条件即可。','Count nonempty contiguous binary substrings having at most k zeros OR at most k ones; either condition suffices.'),
3354:('使数组元素等于零','Make Array Elements Equal to Zero','选择一个值为 0 的起点和左或右方向。位置越界则结束；遇 0 沿原方向走一步；遇正数先减 1、反向、再走一步。统计结束后全数组为 0 的起点与初始方向组合数。','Choose a zero-valued start and initial direction left or right. Stop outside the array. At zero, step in the same direction; at a positive value, decrement it, reverse direction, then step. Count start/direction pairs leaving every value zero when finished.'),
3364:('最小正和子数组','Minimum Positive Sum Subarray','在长度介于 l 和 r（含两端）的连续子数组中，返回严格正的最小元素和；不存在返回 -1。','Among contiguous subarrays with lengths in inclusive [l,r], return the smallest strictly positive element sum, or -1 if absent.'),
3375:('使数组的值全部为K的最少操作次数','Minimum Operations to Make Array Values Equal to K','若当前所有大于整数 h 的元素具有同一个值，则 h 合法。一次操作选择合法 h，将所有大于 h 的元素降为 h。求全部元素等于 k 的最少次数，不可能返回 -1。','An integer h is valid when all current values greater than h are equal to each other. One operation chooses valid h and reduces every value above h to h. Return the fewest operations to make all values k, or -1 if impossible.'),
3396:('使数组元素互不相同的最少操作次数','Minimum Number of Operations to Make Elements in Array Distinct','每次必须从数组开头删除三个元素，不足三个时全删。求使剩余元素互不相同所需最少次数，空数组也满足条件。','Each operation removes three elements from the beginning, or all remaining elements if fewer than three remain. Return the fewest operations making remaining values distinct; an empty array qualifies.'),
3427:('变长子数组求和','Sum of Variable Length Subarrays','对每个从 0 开始的下标 i，取 start=max(0,i-nums[i])，将闭区间 nums[start..i] 的元素和累加，返回所有下标的总和。','For every zero-based index i, let start=max(0,i-nums[i]). Sum elements in inclusive nums[start..i], then add these sums over all indices.'),
3432:('统计元素和差值为偶数的分区方案','Count Partitions with Even Sum Difference','将数组切成两个非空连续部分，统计左侧元素和减右侧元素和为偶数的切分位置数量。','Split the array into two nonempty contiguous parts. Count cut positions where the left sum minus the right sum is even.'),
}

SINGLE_STRING={2423,2696,3090}
STRING_PARAM={2379,3258}
ARRAY_PARAM={2176,2367,2558,2760,2824,3375}
BOOL={2423,2784,2980}
LIMITS={2176:(1,100,1,100),2367:(3,200,0,200),2441:(1,1000,-1000,1000),2529:(1,2000,-2000,2000),2540:(1,100000,1,10**9),2558:(1,1000,1,10**9),2748:(2,100,1,9999),2760:(1,100,1,100),2765:(2,100,1,10000),2784:(1,100,1,200),2815:(2,100,1,10000),2824:(1,50,-50,50),2960:(1,100,0,100),2980:(2,100,1,100),3010:(3,50,1,50),3105:(1,50,1,50),3354:(1,100,0,100),3364:(1,100,-1000,1000),3375:(1,100,1,100),3396:(1,100,1,100),3427:(1,100,1,1000),3432:(2,100,1,100)}
STR_LIMITS={2379:(1,100,'BW'),2423:(2,100,'abcdefghijklmnopqrstuvwxyz'),2696:(1,100,'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),3090:(2,100,'abcdefghijklmnopqrstuvwxyz'),3258:(1,50,'01')}

def encode(pid,args):
 if pid in SINGLE_STRING:return args[0]+'\n'
 if pid in STRING_PARAM:return args[0]+'\n'+str(args[1])+'\n'
 if pid==2269:return ' '.join(map(str,args))+'\n'
 if pid==2506:return str(len(args[0]))+'\n'+'\n'.join(args[0])+'\n'
 if pid==2540:return f'{len(args[0])} {len(args[1])}\n'+' '.join(map(str,args[0]))+'\n'+' '.join(map(str,args[1]))+'\n'
 if pid==2848:return str(len(args[0]))+'\n'+'\n'.join(' '.join(map(str,x)) for x in args[0])+'\n'
 return str(len(args[0]))+(' '+' '.join(map(str,args[1:])) if len(args)>1 else '')+'\n'+' '.join(map(str,args[0]))+'\n'

def parse(pid):
 if pid in SINGLE_STRING:return "args=[sys.stdin.readline().strip()]"
 if pid in STRING_PARAM:return "args=[sys.stdin.readline().strip(),int(sys.stdin.readline())]"
 if pid==2269:return 'args=list(map(int,sys.stdin.read().split()))'
 if pid==2506:return "n=int(sys.stdin.readline()); args=[[sys.stdin.readline().strip() for _ in range(n)]]"
 if pid==2540:return 'v=list(map(int,sys.stdin.read().split())); n,m=v[:2]; assert len(v)==n+m+2; args=[v[2:2+n],v[2+n:]]'
 if pid==2848:return 'v=list(map(int,sys.stdin.read().split())); n=v[0]; assert len(v)==2*n+1; args=[[v[1+2*i:3+2*i] for i in range(n)]]'
 extra=2 if pid==3364 else 1 if pid in ARRAY_PARAM else 0
 return f'v=list(map(int,sys.stdin.read().split())); n=v[0]; assert len(v)==n+{extra+1}; args=[v[{extra+1}:]]+v[1:{extra+1}]'

def validate(pid,args):
 count=3 if pid==3364 else 2 if pid in ARRAY_PARAM|STRING_PARAM|{2269,2540} else 1
 assert isinstance(args,list) and len(args)==count
 a=args[0]
 if pid in STR_LIMITS:
  lo,hi,chars=STR_LIMITS[pid];assert isinstance(a,str) and lo<=len(a)<=hi and set(a)<=set(chars)
  if pid in STRING_PARAM:assert type(args[1]) is int and 1<=args[1]<=len(a)
  return
 if pid==2269:assert type(a) is int and 1<=a<=10**9 and type(args[1]) is int and 1<=args[1]<=len(str(a));return
 if pid==2506:assert isinstance(a,list) and 1<=len(a)<=100 and all(isinstance(s,str) and 1<=len(s)<=100 and all('a'<=c<='z' for c in s) for s in a);return
 if pid==2848:assert isinstance(a,list) and 1<=len(a)<=100 and all(isinstance(x,list) and len(x)==2 and all(type(t) is int for t in x) and 1<=x[0]<=x[1]<=100 for x in a);return
 lo,hi,vlo,vhi=LIMITS[pid];assert isinstance(a,list) and lo<=len(a)<=hi and all(type(x) is int and vlo<=x<=vhi for x in a)
 if pid in ARRAY_PARAM:
  assert type(args[1]) is int
  low,high=(-50,50) if pid==2824 else (1,50) if pid==2367 else (1,1000) if pid==2558 else (1,100)
  assert low<=args[1]<=high
 if pid==2367:assert a==sorted(set(a))
 if pid==2441:assert all(a)
 if pid==2529:assert a==sorted(a)
 if pid==2540:assert a==sorted(a) and isinstance(args[1],list) and 1<=len(args[1])<=100000 and args[1]==sorted(args[1]) and all(type(x) is int and 1<=x<=10**9 for x in args[1])
 if pid==2748:assert all(x%10 for x in a)
 if pid==3354:assert 0 in a
 if pid==3364:assert type(args[1]) is int and type(args[2]) is int and 1<=args[1]<=args[2]<=len(a)

WRONG={2176:('uses sum of indices instead of product',"a,k=args; print(sum(a[i]==a[j] and (i+j)%k==0 for i,j in itertools.combinations(range(len(a)),2)))"),2269:('deduplicates equal-valued fragments',"n,k=args; s=str(n); print(sum(x!=0 and n%x==0 for x in {int(s[i:i+k]) for i in range(len(s)-k+1)}))"),2367:('ignores requested common difference',"a,d=args; print(sum(a[j]-a[i]==a[k]-a[j] for i,j,k in itertools.combinations(range(len(a)),3)))"),2379:('recolors all whites instead of selecting a window',"print(args[0].count('W'))"),2423:('allows zero deletions when all frequencies already match',"s=args[0]; print(int(len(set(Counter(s).values()))==1 or any(len(set(Counter(s[:i]+s[i+1:]).values()))==1 for i in range(len(s)))))"),2441:('chooses maximum positive without requiring its negative',"print(max([x for x in args[0] if x>0],default=-1))"),2506:('requires identical multiplicities instead of letter sets',"print(sum(sorted(a)==sorted(b) for a,b in itertools.combinations(args[0],2)))"),2529:('counts zeros as positive',"a=args[0]; print(max(sum(x<0 for x in a),sum(x>=0 for x in a)))"),2540:('returns largest common value',"print(max(set(args[0])&set(args[1]),default=-1))"),2558:('rounds square roots upward',"a,k=args\nfor _ in range(k):\n i=a.index(max(a)); a[i]=math.ceil(math.sqrt(a[i]))\nprint(sum(a))"),2696:('makes only one replacement pass',"print(len(args[0].replace('AB','').replace('CD','')))"),2748:('takes gcd of full numbers rather than end digits',"print(sum(math.gcd(x,y)==1 for x,y in itertools.combinations(args[0],2)))"),2760:('allows an odd initial element',"a,t=args; print(max([0]+[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if all(x<=t for x in a[i:j]) and all(a[k]%2!=a[k+1]%2 for k in range(i,j-1))]))"),2765:('allows either initial direction and nonalternating steps',"a=args[0]; print(max([-1]+[j-i for i in range(len(a)) for j in range(i+2,len(a)+1) if all(abs(a[k+1]-a[k])==1 for k in range(i,j-1))]))"),2784:('only checks maximum against array length',"print(int(max(args[0])+1==len(args[0])))"),2815:('compares first digits rather than maximum digits',"print(max([-1]+[x+y for x,y in itertools.combinations(args[0],2) if str(x)[0]==str(y)[0]]))"),2824:('uses inclusive target comparison',"print(sum(x+y<=args[1] for x,y in itertools.combinations(args[0],2)))"),2848:('counts overlap repeatedly',"print(sum(hi-lo+1 for lo,hi in args[0]))"),2960:('ignores battery drain from earlier tests',"print(sum(x>0 for x in args[0]))"),2980:('selects a singleton even value',"print(int(any(x%2==0 for x in args[0])))"),3010:('chooses globally smallest three and omits mandatory first value',"print(sum(sorted(args[0])[:3]))"),3090:('ignores substring contiguity',"print(sum(min(2,c) for c in Counter(args[0]).values()))"),3105:('allows equality in monotonic runs',"a=args[0]; print(max(j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if all(a[k]<=a[k+1] for k in range(i,j-1)) or all(a[k]>=a[k+1] for k in range(i,j-1))))"),3258:('requires both counts at most k',"s,k=args; print(sum(s[i:j].count('0')<=k and s[i:j].count('1')<=k for i in range(len(s)) for j in range(i+1,len(s)+1)))"),3354:('counts zero positions instead of successful direction choices',"print(args[0].count(0))"),3364:('admits zero as a positive sum',"a,l,r=args; print(min((sum(a[i:j]) for i in range(len(a)) for j in range(i+l,min(len(a),i+r)+1) if sum(a[i:j])>=0),default=-1))"),3375:('assumes target is present among input levels',"a,k=args; print(-1 if min(a)<k else len(set(a))-1)"),3396:('removes one element per operation instead of three',"a=args[0]; print(next(i for i in range(len(a)+1) if len(set(a[i:]))==len(a[i:])))"),3427:('excludes the current endpoint from each subarray',"a=args[0]; print(sum(sum(a[max(0,i-a[i]):i]) for i in range(len(a))))"),3432:('counts odd rather than even sum differences',"a=args[0]; print(sum((sum(a[:i])-sum(a[i:]))%2!=0 for i in range(1,len(a))))")}
EDGE[2367].append([[0,1,2],2])

EXTRA={2176:('1≤k≤100。','1≤k≤100.'),2367:('数组严格递增；1≤diff≤50。','Strictly increasing array; 1≤diff≤50.'),2441:('元素不能为 0。','Values cannot be zero.'),2529:('数组非递减。','Nondecreasing array.'),2540:('第二个数组也满足相同长度和值域约束，两个数组均非递减。','The second array obeys the same length and value bounds; both arrays are nondecreasing.'),2558:('1≤k≤1000。','1≤k≤1000.'),2748:('每个数的末位都非 0。','Every value has a nonzero final digit.'),2760:('1≤threshold≤100。','1≤threshold≤100.'),2824:('-50≤target≤50。','-50≤target≤50.'),3354:('至少有一个元素为 0。','At least one element is zero.'),3364:('1≤l≤r≤数组长度。','1≤l≤r≤array length.'),3375:('1≤k≤100。','1≤k≤100.')}


def make(pid):
 zh,en,desc,eng=META[pid]
 if pid in SINGLE_STRING:iz,ie='一行字符串 s。','One line: string s.'
 elif pid in STRING_PARAM:iz,ie='第一行字符串，第二行 k。','First line: string. Second line: k.'
 elif pid==2269:iz,ie='一行 num k；1≤num≤1000000000，1≤k≤num 的十进制位数。','One line: num k. 1≤num≤1000000000; 1≤k≤the number of decimal digits in num.'
 elif pid==2506:iz,ie='第一行字符串数量 n，随后 n 行每行一个字符串；1≤n≤100，每个字符串长度为 1 至 100，仅含小写英文字母。','First line: string count n; then n lines containing one string each. 1≤n≤100; each length 1–100, lowercase English letters only.'
 elif pid==2540:iz,ie='第一行 n m；第二行第一个数组的 n 个整数；第三行第二个数组的 m 个整数。','First line: n m. Second line: n integers of the first array. Third line: m integers of the second array.'
 elif pid==2848:iz,ie='第一行区间数量 n，随后 n 行，每行 start end。1≤n≤100，1≤start≤end≤100。','First line: interval count n; then n lines start end. 1≤n≤100; 1≤start≤end≤100.'
 else:
  tail=' l r' if pid==3364 else ' diff' if pid==2367 else ' threshold' if pid==2760 else ' target' if pid==2824 else ' k' if pid in ARRAY_PARAM else ''
  iz,ie='第一行数组长度 n'+tail+'；第二行 n 个整数。','First line: array length n'+tail+'. Second line: n integers.'
 if pid in LIMITS:
  lo,hi,vlo,vhi=LIMITS[pid];iz+=f' {lo}≤数组长度≤{hi}，{vlo}≤元素值≤{vhi}。';ie+=f' Array length {lo}–{hi}; values in [{vlo},{vhi}].'
 if pid in STR_LIMITS:
  lo,hi,chars=STR_LIMITS[pid];cz='小写英文字母' if chars.startswith('abc') else '大写英文字母' if len(chars)==26 else chars;ce='lowercase English letters' if chars.startswith('abc') else 'uppercase English letters' if len(chars)==26 else chars
  iz+=f' 字符串长度为 {lo} 至 {hi}，仅含{cz}。';ie+=f' String length {lo}–{hi}; characters limited to {ce}.'
  if pid in STRING_PARAM:iz+=' 1≤k≤字符串长度。';ie+=' 1≤k≤string length.'
 if pid in EXTRA:iz+=' '+EXTRA[pid][0];ie+=' '+EXTRA[pid][1]
 name,body=WRONG[pid]
 return dict(method=METHODS[pid],titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh=iz,inputEn=ie,outputZh='成立输出 1，否则输出 0。' if pid in BOOL else '输出一个整数和换行。',outputEn='Print 1 if true, otherwise 0.' if pid in BOOL else 'Print one integer followed by a newline.',difficulty='简单',edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda r:random_args(pid,r),oracle=lambda a:int(oracle(pid,a)),encode=lambda a:encode(pid,a),parse=parse(pid),mutants=[dict(name=name,source='import sys, math, itertools\nfrom collections import Counter\n'+parse(pid)+'\n'+body+'\n')],validate=lambda a:validate(pid,a))

PROBLEMS={pid:make(pid) for pid in IDS}
