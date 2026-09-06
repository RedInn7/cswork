"""Original deterministic array/string fixtures; never loads reference/test archives."""
import itertools
import math
from collections import Counter

IDS = [28,33,125,136,153,154,169,219,409,455,459,485,521,561,605,628,674,680,696,724,796,844,852,860,914,925,961,976,1004,1005]
METHODS = dict(zip(IDS, ['strStr','search','isPalindrome','singleNumber','findMin','findMin','majorityElement','containsNearbyDuplicate','longestPalindrome','findContentChildren','repeatedSubstringPattern','findMaxConsecutiveOnes','findLUSlength','arrayPairSum','canPlaceFlowers','maximumProduct','findLengthOfLCIS','validPalindrome','countBinarySubstrings','pivotIndex','rotateString','backspaceCompare','peakIndexInMountainArray','lemonadeChange','hasGroupsSizeX','isLongPressedName','repeatedNTimes','largestPerimeter','longestOnes','largestSumAfterKNegations']))

def brute(pid, args):
    a = args[0]
    if pid == 28:
        b=args[1]
        return next((i for i in range(len(a)-len(b)+1) if a[i:i+len(b)]==b),-1)
    if pid == 33: return next((i for i,x in enumerate(a) if x==args[1]),-1)
    if pid == 852: return a.index(max(a))
    if pid == 1004: return max([0]+[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if a[i:j].count(0)<=args[1]])
    if pid == 125:
        s=''.join(x.lower() for x in a if x.isascii() and x.isalnum())
        return all(s[i]==s[-i-1] for i in range(len(s)//2))
    if pid in (136,961):
        return next(x for x in a if a.count(x)==(1 if pid==136 else len(a)//2))
    if pid in (153,154): return sorted(a)[0]
    if pid == 169: return next(x for x in a if a.count(x)>len(a)//2)
    if pid == 219: return any(a[i]==a[j] and j-i<=args[1] for i in range(len(a)) for j in range(i+1,len(a)))
    if pid == 409:
        # Exhaust all possible chosen character multiplicities, independently of greedy pairing.
        counts=list(Counter(a).values())
        return max(sum(v) for v in itertools.product(*(range(c+1) for c in counts)) if sum(c%2 for c in v)<=1)
    if pid == 455:
        cookies=args[1]
        def visit(i,used):
            if i==len(a): return 0
            return max([visit(i+1,used)]+[1+visit(i+1,used|{j}) for j,c in enumerate(cookies) if j not in used and c>=a[i]])
        return visit(0,set())
    if pid == 459: return any(len(a)%k==0 and all(a[i]==a[i%k] for i in range(len(a))) for k in range(1,len(a)))
    if pid == 485: return max([0]+[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if all(a[i:j])])
    if pid == 521:
        b=args[1]
        def subs(s): return {''.join(s[i] for i in range(len(s)) if m>>i&1) for m in range(1<<len(s))}
        return max([len(x) for x in subs(a)^subs(b)]+[-1])
    if pid == 561:
        def pair(v):
            if not v:return 0
            return max(min(v[0],v[i])+pair(v[1:i]+v[i+1:]) for i in range(1,len(v)))
        return pair(a)
    if pid == 605:
        empty=[i for i,v in enumerate(a) if not v]
        for ix in itertools.combinations(empty,args[1]):
            b=a[:]
            for i in ix:b[i]=1
            if not any(x and y for x,y in zip(b,b[1:])):return True
        return False
    if pid == 628: return max(math.prod(v) for v in itertools.combinations(a,3))
    if pid == 674: return max(j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if all(a[k]<a[k+1] for k in range(i,j-1)))
    if pid == 680: return a==a[::-1] or any(a[:i]+a[i+1:]==(a[:i]+a[i+1:])[::-1] for i in range(len(a)))
    if pid == 696:
        total=0
        for i in range(len(a)):
            for j in range(i+2,len(a)+1,2):
                s=a[i:j];k=len(s)//2
                total+=s[:k]==s[0]*k and s[k:]==s[-1]*k and s[0]!=s[-1]
        return total
    if pid == 724: return next((i for i in range(len(a)) if sum(a[:i])==sum(a[i+1:])), -1)
    if pid == 796: return len(a)==len(args[1]) and any(a[i:]+a[:i]==args[1] for i in range(len(a)))
    if pid == 844:
        def erase(s):
            while '#' in s:
                i=s.index('#');s=s[:max(0,i-1)]+s[i+1:]
            return s
        return erase(a)==erase(args[1])
    if pid == 860:
        states={(0,0)}
        for bill in a:
            states={(f-x+(bill==5),t-y+(bill==10)) for f,t in states for x in range(f+1) for y in range(t+1) if 5*x+10*y==bill-5}
        return bool(states)
    if pid == 914: return any(all(a.count(x)%size==0 for x in set(a)) for size in range(2,len(a)+1))
    if pid == 925:
        name,typed=args
        reachable={0}
        for ch in name:
            nxt=set()
            for i in reachable:
                j=i
                while j<len(typed) and typed[j]==ch:j+=1;nxt.add(j)
            reachable=nxt
        return len(typed) in reachable
    if pid == 976: return max([0]+[sum(t) for t in itertools.combinations(a,3) if sum(t)>2*max(t)])
    if pid == 1005:
        states={tuple(a)}
        for _ in range(args[1]): states={s[:i]+(-s[i],)+s[i+1:] for s in states for i in range(len(s))}
        return max(map(sum,states))
    raise KeyError(pid)

def random_args(pid,r):
    n=r.randint(1,8)
    word=lambda n: ''.join(r.choice('abc') for _ in range(n))
    if pid==28:return [word(r.randint(1,15)),word(r.randint(1,5))]
    if pid in (33,153,154):
        a=sorted(r.sample(range(-30,31),n)) if pid!=154 else sorted(r.choices(range(-3,4),k=n))
        k=r.randrange(n);a=a[k:]+a[:k]
        return [a,r.choice(a+[99])] if pid==33 else [a]
    if pid==125:return [''.join(r.choice('aAbB019 !?:') for _ in range(n))]
    if pid==136:
        v=r.sample(range(-30,31),n);a=[v[0]]+v[1:]*2;r.shuffle(a);return [a]
    if pid==169:
        x=r.randint(-2,2);a=[x]*(n//2+1)+[r.randint(-2,2) for _ in range(n-n//2-1)];r.shuffle(a);return [a]
    if pid==219:return [[r.randint(-3,3) for _ in range(n)],r.randint(0,n+1)]
    if pid in (409,459,680):return [word(n)]
    if pid==455:return [[r.randint(1,8) for _ in range(r.randint(1,5))],[r.randint(1,8) for _ in range(r.randint(0,5))]]
    if pid in (485,696):
        a=[r.randrange(2) for _ in range(n)];return [''.join(map(str,a))] if pid==696 else [a]
    if pid==521:return [word(n),word(r.randint(1,8))]
    if pid==561:return [[r.randint(-8,8) for _ in range(2*r.randint(1,4))]]
    if pid==605:
        a=[0]*n
        for i in range(n):
            if (i==0 or not a[i-1]) and r.randrange(3)==0:a[i]=1
        return [a,r.randint(0,n)]
    if pid in (628,976):return [[r.randint(-10 if pid==628 else 1,10) for _ in range(max(3,n))]]
    if pid in (674,724):return [[r.randint(-5,5) for _ in range(n)]]
    if pid==796:
        a=word(n);k=r.randrange(n);return [a,a[k:]+a[:k] if r.randrange(2) else word(n)]
    if pid==844:return [''.join(r.choice('ab#') for _ in range(n)),''.join(r.choice('ab#') for _ in range(n))]
    if pid==860:return [[r.choice([5,10,20]) for _ in range(n)]]
    if pid==914:return [[r.randrange(3) for _ in range(n)]]
    if pid==925:
        a=word(n);return [a,''.join(c*r.randint(1,3) for c in a) if r.randrange(2) else word(n)]
    if pid==961:
        n=max(2,n);v=r.sample(range(30),n+1);a=[v[0]]*n+v[1:];r.shuffle(a);return [a]
    if pid==1005:return [[r.randint(-5,5) for _ in range(min(5,n))],r.randint(1,5)]
    if pid==1004:return [[r.randrange(2) for _ in range(n)],r.randint(0,n)]
    if pid==852:
        left=sorted(r.sample(range(20),r.randint(1,6)));right=sorted(r.sample(range(20),r.randint(1,6)),reverse=True)
        return [left+[30]+right]
    raise KeyError(pid)

EDGE={
28:[['sadbutsad','sad'],['a','a'],['a','aa'],['abababc','ababc'],['abc','d']],
33:[[[4,5,6,7,0,1,2],0],[[1],0],[[1],1],[[3,1],1],[[1,3],3]],
125:[['A man, a plan, a canal: Panama'],[' '],['0P'],['race a car'],['.,']],
136:[[[2,2,1]],[[-1]],[[0,1,1]],[[4,1,2,1,2]]],
153:[[[3,4,5,1,2]],[[1]],[[1,2]],[[2,1]]],
154:[[[2,2,2,0,1]],[[1]],[[1,1,1]],[[3,1,3,3]],[[1,1,1,0,1]]],
169:[[[3,2,3]],[[1]],[[2,2,1,1,1,2,2]],[[-1,-1,0]],[[1,2,2]]],
219:[[[1,2,3,1],3],[[1,1],0],[[1,2,3,1],2],[[1],1]],
409:[['abccccdd'],['a'],['Aa'],['abc'],['aabb']],
455:[[[1,2,3],[1,1]],[[1],[]],[[2],[2]],[[1,2],[1,2,3]]],
459:[['abab'],['a'],['aba'],['aaaa'],['abcabcabc']],
485:[[[1,1,0,1,1,1]],[[0]],[[1]],[[1,0,1,0,1]]],
521:[['aba','cdc'],['aaa','aaa'],['ab','a'],['a','b']],
561:[[[1,4,3,2]],[[-3,-2]],[[6,2,6,5,1,2]]],
605:[[[1,0,0,0,1],1],[[0],1],[[1],0],[[0,0],2],[[0,0,0],2]],
628:[[[1,2,3]], [[-10,-10,1,2,3]],[[-5,-4,-3,-2]],[[0,0,1]]],
674:[[[1,3,5,4,7]],[[2,2,2]],[[1]],[[3,2,1]]],
680:[['aba'],['abca'],['abc'],['a'],['deeee']],
696:[['00110011'],['0'],['01'],['0101'],['000111']],
724:[[[1,7,3,6,5,6]],[[1]],[[1,2,3]],[[2,1,-1]],[[0,0,0]]],
796:[['abcde','cdeab'],['a','a'],['ab','aa'],['ab','aba']],
844:[['ab#c','ad#c'],['a##c','#a#c'],['a#','#'],['a','b']],
860:[[[5,5,5,10,20]],[[10]],[[5,5,10,10,20]],[[5,5,5,5,10,5,10,10,10,20]]],
914:[[[1,2,3,4,4,3,2,1]],[[1]],[[1,1,2,2,2,2]],[[1,1,1,2,2]]],
925:[['alex','aaleex'],['saeed','ssaaedd'],['a','aa'],['a','ab'],['aa','a']],
961:[[[1,2,3,3]],[[2,1,2,5,3,2]],[[1,2,1,3]]],
976:[[[2,1,2]],[[1,2,3]],[[3,6,2,3]],[[1,1,1]]],
1005:[[[4,2,3],1],[[-4,-2,-3],2],[[0,1],5],[[2],2],[[2],3]],
852:[[[0,1,0]],[[0,2,1,0]],[[1,3,5,4]],[[0,10,5,2]]],
1004:[[[1,1,1,0,0,0,1,1,1,1,0],2],[[0],0],[[0],1],[[1],0],[[0,0,1,1,0,1],1]],
}

# Each pressure answer follows a closed-form construction, not a reference solution.
PRESSURE={
28:[(['a'*9999+'b','a'*4999+'b'],5000),(['a'*10000,'b'], -1)],
33:[([list(range(2500,5000))+list(range(2500)),0],2500),([list(range(5000)),10000],-1)],
125:[(['A'*100000+'!'+'a'*99999],True),(['a'*199999+'b'],False)],
136:[([list(range(14999))*2+[-30000]],-30000)],
153:[([list(range(2500,5000))+list(range(2500))],0)],
154:[([[1]*2499+[0]+[1]*2500],0),([[1]*5000],1)],
169:[([[1]*25001+[2]*24999],1)],
219:[([list(range(100000)),99999],False),([[0]+list(range(1,99999))+[0],99999],True)],
409:[(['a'*1999+'b'],1999)],
455:[([[2]*30000,[1]*30000],0),([[1]*30000,[1]*30000],30000)],
459:[(['ab'*5000],True),(['a'*9999+'b'],False)],
485:[([[1]*100000],100000),([[1,0]*50000],1)],
521:[(['a'*100,'a'*100],-1),(['a'*100,'b'*100],100)],
561:[([[10000]*20000],100000000),([[-10000]*20000],-100000000)],
605:[([[0]*20000,10000],True),([[0]*20000,10001],False)],
628:[([[-1000]*9997+[1000,1000,1000]],1000000000)],
674:[([list(range(10000))],10000),([[1]*10000],1)],
680:[(['a'*100000],True),(['a'*99997+'bcd'],False)],
696:[(['0'*50000+'1'*50000],50000),(['01'*50000],99999)],
724:[([[0]*10000],0),([[1]*10000],-1)],
796:[(['a'*99+'b','b'+'a'*99],True),(['a'*100,'a'*99+'b'],False)],
844:[(['a#'*100,'#'*200],True),(['#'*199+'a','#'*200],False)],
852:[([list(range(50000))+list(range(50000,0,-1))],50000)],
860:[([[5]*100000],True),([[5,10]*49999+[20,20]],False)],
914:[([[1]*5000+[2]*5000],True),([[1]*4999+[2]*5001],False)],
925:[(['a'*1000,'a'*1000],True),(['a'*999+'b','a'*1000],False)],
961:[([[10000]*5000+list(range(5000))],10000)],
976:[([[1000000]*10000],3000000),([[1]*9999+[1000000]],3)],
1004:[([[0]*100000,50000],50000),([[1]*100000,0],100000)],
1005:[([[-100]*10000,10000],1000000),([[100]*10000,9999],999800)],
}

# Title and short, original specification. Input constraints are below.
META={
28:('找出字符串中第一个匹配项的下标','Find the Index of the First Occurrence in a String','返回 needle 在 haystack 中首次连续出现的起始下标（从 0 开始）；不存在返回 -1。','Return the zero-based starting index of the first contiguous occurrence of needle in haystack, or -1 if absent.'),
33:('搜索旋转排序数组','Search in Rotated Sorted Array','严格递增数组旋转后得到 nums。返回 target 的下标（从 0 开始）；不存在返回 -1。','An array of distinct increasing integers was rotated. Return the zero-based index of target, or -1 if absent.'),
125:('验证回文串','Valid Palindrome','移除所有非 ASCII 英文字母和数字，并忽略字母大小写，判断剩余字符串是否为回文。空的剩余字符串是回文。','Discard all characters except ASCII letters and digits, ignoring letter case. Decide whether the remaining string is a palindrome; the empty result is a palindrome.'),
136:('只出现一次的数字','Single Number','数组中恰有一个值出现一次，其余每个值出现两次，返回该单独的值。','Exactly one value occurs once and every other value occurs twice. Return the value occurring once.'),
153:('寻找旋转排序数组中的最小值','Find Minimum in Rotated Sorted Array','严格递增数组经过旋转（允许不旋转），返回其最小值。','Return the minimum value of a rotated strictly increasing array; rotation by zero is allowed.'),
154:('寻找旋转排序数组中的最小值 II','Find Minimum in Rotated Sorted Array II','非递减数组经过旋转（允许不旋转），元素可重复，返回最小值。','Return the minimum of a rotated nondecreasing array. Duplicates and rotation by zero are allowed.'),
169:('多数元素','Majority Element','返回数组中出现次数严格超过数组长度一半的值；保证存在。','Return the value occurring strictly more than half the array length. Such a value is guaranteed to exist.'),
219:('存在重复元素 II','Contains Duplicate II','判断是否存在不同下标 i、j，使 nums[i]=nums[j] 且 |i-j|≤k。','Decide whether distinct indices i and j satisfy nums[i]=nums[j] and |i-j|≤k.'),
409:('最长回文串','Longest Palindrome','可任取字符串中的字符并重新排列，求能构成的最长回文串长度。大小写字符不同。','Choose and rearrange any characters of the string. Return the maximum possible palindrome length. Uppercase and lowercase letters are distinct.'),
455:('分发饼干','Assign Cookies','每个孩子最多得到一块饼干，饼干大小至少等于胃口才满足。每块饼干只能分给一人，求最多满足人数。','Give at most one cookie to each child and use each cookie at most once. A child is satisfied if its cookie size is at least its greed. Return the maximum satisfied count.'),
459:('重复的子字符串','Repeated Substring Pattern','判断整个字符串能否由一个更短的非空字符串重复至少两次得到。','Decide whether the whole string is formed by repeating a shorter nonempty string at least twice.'),
485:('最大连续 1 的个数','Max Consecutive Ones','返回二进制数组中最长连续全为 1 的片段长度。','Return the length of the longest contiguous run of ones in a binary array.'),
521:('最长特殊序列 I','Longest Uncommon Subsequence I','子序列可删除字符但不能改变顺序。求属于两个字符串之一、却不属于另一个的子序列的最大长度；不存在返回 -1。','A subsequence is obtained by deleting characters without reordering. Return the largest length of a subsequence of one string that is not a subsequence of the other, or -1 if none exists.'),
561:('数组拆分','Array Partition','将 2n 个数分为 n 对，每个数恰用一次。最大化每对较小值的总和。','Partition 2n numbers into n pairs using each number once. Maximize the sum of the smaller value in each pair.'),
605:('种花问题','Can Place Flowers','花坛中 1 表示已有花、0 表示空位，已有花互不相邻。判断能否在不移走花的条件下再种 n 朵，且任意两朵不能相邻。','In a flowerbed, 1 is an existing flower and 0 an empty plot. Existing flowers are nonadjacent. Decide whether n additional flowers can be planted without moving flowers or making any two adjacent.'),
628:('三个数的最大乘积','Maximum Product of Three Numbers','选择三个不同下标的元素，返回它们乘积的最大值。','Choose values at three distinct indices and return the maximum possible product.'),
674:('最长连续递增序列','Longest Continuous Increasing Subsequence','返回最长严格递增连续片段的长度；连续片段不能跳过元素。','Return the length of the longest contiguous strictly increasing segment; elements cannot be skipped.'),
680:('验证回文串 II','Valid Palindrome II','判断字符串删除至多一个字符后能否成为回文，允许不删除。','Decide whether deleting at most one character can make the string a palindrome; deleting none is allowed.'),
696:('计数二进制子串','Count Binary Substrings','统计连续子串数量：0 与 1 数量相等，且所有 0 连续、所有 1 连续。不同位置分别计数。','Count contiguous substrings containing equal numbers of zeros and ones with each digit forming one contiguous group. Count different positions separately.'),
724:('寻找数组的中心下标','Find Pivot Index','返回最左下标，使左侧所有元素之和等于右侧所有元素之和（不含本元素）；空侧和为 0，不存在返回 -1。','Return the leftmost index whose strictly left sum equals its strictly right sum. Empty sides sum to zero; return -1 if absent.'),
796:('旋转字符串','Rotate String','每次可将字符串第一个字符移到末尾。判断进行零次或多次操作能否变成 goal。','Move the first character to the end zero or more times. Decide whether the string can become goal.'),
844:('比较含退格的字符串','Backspace String Compare','从空文本依次输入字符，# 删除前一个未删除字符；空文本遇到 # 保持空。判断两次输入最终文本是否相同。','Type each string into an empty text buffer. # deletes the previous remaining character, doing nothing on an empty buffer. Decide whether the final texts match.'),
852:('山脉数组的峰顶索引','Peak Index in a Mountain Array','数组先严格递增后严格递减，两段均非空。返回唯一峰顶的下标（从 0 开始）。','The array strictly increases and then strictly decreases, with both slopes nonempty. Return the zero-based index of its unique peak.'),
860:('柠檬水找零','Lemonade Change','每杯售价 5，顾客按顺序支付 5、10 或 20。起初没有零钱，必须使用此前收到且尚未花掉的钱立即准确找零，判断能否完成所有交易。','Each drink costs 5. Customers pay 5, 10 or 20 in order. Start with no change and give exact change immediately using only money received and not spent earlier. Decide whether all transactions can succeed.'),
914:('卡牌分组','X of a Kind in a Deck of Cards','判断能否选择整数 X≥2，将所有牌分为若干组，每组恰有 X 张且组内数值相同。','Decide whether some integer X≥2 partitions all cards into groups of exactly X cards with equal values within each group.'),
925:('长按键入','Long Pressed Name','输入 name 的每个字符时可将该字符重复一次或多次，顺序不变。判断能否恰好得到 typed。','Each character of name may be typed one or more times consecutively, preserving order. Decide whether this can produce exactly typed.'),
961:('在长度 2N 的数组中找出重复 N 次的元素','N-Repeated Element in Size 2N Array','数组长 2n，有 n+1 个不同的值，恰有一个值重复 n 次，其余各出现一次。返回重复值。','An array has length 2n and n+1 distinct values. Exactly one value occurs n times and all others once. Return the repeated value.'),
976:('三角形的最大周长','Largest Perimeter Triangle','从数组选择三个不同下标作为边长，组成面积严格大于 0 的三角形。返回最大周长；不能组成返回 0。','Choose three distinct indices as side lengths of a positive-area triangle. Return the maximum perimeter, or 0 if no such triangle exists.'),
1004:('最大连续 1 的个数 III','Max Consecutive Ones III','可将至多 k 个 0 改为 1，返回能得到的最长连续全为 1 的片段长度。','Flip at most k zeros to ones. Return the maximum length of a contiguous all-one segment obtainable.'),
1005:('K 次取反后最大化的数组和','Maximize Sum Of Array After K Negations','必须恰好操作 k 次，每次选择一个元素取相反数；同一下标可重复选择。返回最大总和。','Perform exactly k operations, each negating one array element. The same index may be chosen repeatedly. Return the maximum final sum.'),
}

SINGLE_STRING={125,409,459,680,696}
TWO_STRINGS={28,521,796,844,925}
ARRAY_PARAM={33,219,605,1004,1005}
BOOL_IDS={125,219,459,605,680,796,844,860,914,925}

def encode(pid,args):
    if pid in SINGLE_STRING|TWO_STRINGS:return '\n'.join(args)+'\n'
    if pid==455:return f'{len(args[0])} {len(args[1])}\n'+ ' '.join(map(str,args[0]))+'\n'+' '.join(map(str,args[1]))+'\n'
    a=args[0]
    return str(len(a))+((' '+str(args[1])) if pid in ARRAY_PARAM else '')+'\n'+' '.join(map(str,a))+'\n'

def parse(pid):
    if pid in SINGLE_STRING:return "args=[sys.stdin.readline().rstrip('\\n').rstrip('\\r')]"
    if pid in TWO_STRINGS:return "args=[sys.stdin.readline().rstrip('\\n').rstrip('\\r') for _ in range(2)]"
    if pid==455:return "v=list(map(int,sys.stdin.read().split())); n,m=v[:2]; assert len(v)==n+m+2; args=[v[2:2+n],v[2+n:]]"
    if pid in ARRAY_PARAM:return "v=list(map(int,sys.stdin.read().split())); n,k=v[:2]; assert len(v)==n+2; args=[v[2:],k]"
    return "v=list(map(int,sys.stdin.read().split())); n=v[0]; assert len(v)==n+1; args=[v[1:]]"

CONSTRAINTS={
28:('1≤两个字符串长度≤10000，仅小写英文字母。','Both string lengths 1–10000; lowercase English letters only.'),
33:('1≤长度≤5000，元素互异且在 [-10000,10000]，target 同范围；数组为严格递增数组的旋转。','Length 1–5000; distinct values and target in [-10000,10000]; a rotation of a strictly increasing array.'),
125:('1≤长度≤200000，仅可打印 ASCII 字符，保留空格。','Length 1–200000; printable ASCII only; preserve spaces.'),
136:('1≤长度≤30000，值在 [-30000,30000]；一个值出现一次，其余各两次。','Length 1–30000; values in [-30000,30000]; one occurs once, all others twice.'),
153:('1≤长度≤5000，互异元素在 [-5000,5000]；严格递增数组的旋转。','Length 1–5000; distinct values in [-5000,5000]; rotated strictly increasing array.'),
154:('1≤长度≤5000，元素在 [-5000,5000]；非递减数组的旋转。','Length 1–5000; values in [-5000,5000]; rotated nondecreasing array.'),
169:('1≤长度≤50000，值在 [-1000000000,1000000000]；保证多数元素存在。','Length 1–50000; values in [-1000000000,1000000000]; a strict majority exists.'),
219:('1≤长度≤100000，值在 [-1000000000,1000000000]，0≤k≤100000。','Length 1–100000; values in [-1000000000,1000000000]; 0≤k≤100000.'),
409:('1≤长度≤2000，仅大小写英文字母。','Length 1–2000; uppercase and lowercase English letters only.'),
455:('1≤孩子数≤30000，0≤饼干数≤30000；胃口和饼干大小在 [1,2147483647]。','Children count 1–30000; cookie count 0–30000; greed and sizes in [1,2147483647].'),
459:('1≤长度≤10000，仅小写英文字母。','Length 1–10000; lowercase English letters only.'),
485:('1≤长度≤100000，所有元素为 0 或 1。','Length 1–100000; each value is 0 or 1.'),
521:('两个字符串长度均为 1 至 100，仅小写英文字母。','Both lengths 1–100; lowercase English letters only.'),
561:('数组长度为偶数，2≤长度≤20000，值在 [-10000,10000]。','Even array length 2–20000; values in [-10000,10000].'),
605:('1≤长度≤20000，值为 0 或 1，不含相邻的 1；0≤待种数量≤长度。','Length 1–20000; binary values with no adjacent ones; additional count from 0 to the array length.'),
628:('3≤长度≤10000，值在 [-1000,1000]。','Length 3–10000; values in [-1000,1000].'),
674:('1≤长度≤10000，值在 [-1000000000,1000000000]。','Length 1–10000; values in [-1000000000,1000000000].'),
680:('1≤长度≤100000，仅小写英文字母。','Length 1–100000; lowercase English letters only.'),
696:('1≤长度≤100000，仅字符 0 和 1。','Length 1–100000; only characters 0 and 1.'),
724:('1≤长度≤10000，值在 [-1000,1000]。','Length 1–10000; values in [-1000,1000].'),
796:('两个字符串长度均为 1 至 100，仅小写英文字母。','Both lengths 1–100; lowercase English letters only.'),
844:('两个字符串长度均为 1 至 200，仅小写英文字母和 #。','Both lengths 1–200; lowercase English letters and # only.'),
852:('3≤长度≤100000，值在 [0,1000000]；唯一峰顶不在首尾，两侧分别严格递增、严格递减。','Length 3–100000; values in [0,1000000]; unique interior peak, strictly increasing before it and strictly decreasing afterward.'),
860:('1≤顾客数≤100000，每笔支付仅为 5、10 或 20。','Customer count 1–100000; each payment is 5, 10 or 20.'),
914:('1≤长度≤10000，牌值在 [0,9999]。','Length 1–10000; card values in [0,9999].'),
925:('两个字符串长度均为 1 至 1000，仅小写英文字母。','Both lengths 1–1000; lowercase English letters only.'),
961:('长度为 2n，2≤n≤5000，值在 [0,10000]；n+1 个不同值，恰有一个出现 n 次，其余各一次。','Length 2n, 2≤n≤5000; values in [0,10000]; n+1 distinct values, one occurring n times and others once.'),
976:('3≤长度≤10000，边长在 [1,1000000]。','Length 3–10000; side lengths in [1,1000000].'),
1004:('1≤长度≤100000，值为 0 或 1；0≤k≤长度。','Length 1–100000; binary values; 0≤k≤length.'),
1005:('1≤长度≤10000，值在 [-100,100]；1≤k≤10000。','Length 1–10000; values in [-100,100]; 1≤k≤10000.'),
}

def validate(pid,args):
    assert isinstance(args,list)
    expected=2 if pid in TWO_STRINGS|ARRAY_PARAM|{455} else 1
    assert len(args)==expected
    a=args[0]
    if pid in SINGLE_STRING|TWO_STRINGS:
        bound={28:10000,125:200000,409:2000,459:10000,521:100,680:100000,696:100000,796:100,844:200,925:1000}[pid]
        for s in args:
            assert isinstance(s,str) and 1<=len(s)<=bound
            assert all(32<=ord(c)<=126 for c in s) if pid==125 else all(c in '01' for c in s) if pid==696 else all(c.isascii() and c.isalpha() for c in s) if pid==409 else all('a'<=c<='z' or (pid==844 and c=='#') for c in s)
        return
    limits={33:(1,5000,-10000,10000),136:(1,30000,-30000,30000),153:(1,5000,-5000,5000),154:(1,5000,-5000,5000),169:(1,50000,-10**9,10**9),219:(1,100000,-10**9,10**9),455:(1,30000,1,2**31-1),485:(1,100000,0,1),561:(2,20000,-10000,10000),605:(1,20000,0,1),628:(3,10000,-1000,1000),674:(1,10000,-10**9,10**9),724:(1,10000,-1000,1000),852:(3,100000,0,10**6),860:(1,100000,5,20),914:(1,10000,0,9999),961:(4,10000,0,10000),976:(3,10000,1,10**6),1004:(1,100000,0,1),1005:(1,10000,-100,100)}
    lo,hi,vlo,vhi=limits[pid]
    assert isinstance(a,list) and lo<=len(a)<=hi and all(type(x) is int and vlo<=x<=vhi for x in a)
    if pid in ARRAY_PARAM:
        assert type(args[1]) is int
        if pid==33: assert -10000<=args[1]<=10000
        elif pid==219: assert 0<=args[1]<=100000
        elif pid==1005: assert 1<=args[1]<=10000
        else: assert 0<=args[1]<=len(a)
    if pid in (33,153,154):
        assert sum(x>y for x,y in zip(a,a[1:]+a[:1]))<=1
        if pid!=154:assert len(set(a))==len(a)
    if pid==136: assert sorted(Counter(a).values())==[1]+[2]*((len(a)-1)//2)
    if pid==169: assert max(Counter(a).values())>len(a)//2
    if pid==455: assert isinstance(args[1],list) and len(args[1])<=30000 and all(type(x) is int and 1<=x<=2**31-1 for x in args[1])
    if pid==561:assert len(a)%2==0
    if pid==605:assert not any(x and y for x,y in zip(a,a[1:]))
    if pid==852:
        p=a.index(max(a));assert 0<p<len(a)-1 and all(x<y for x,y in zip(a[:p],a[1:p+1])) and all(x>y for x,y in zip(a[p:],a[p+1:]))
    if pid==860:assert set(a)<={5,10,20}
    if pid==961:assert len(a)%2==0 and sorted(Counter(a).values())==[1]*(len(a)//2)+[len(a)//2]

WRONG={
28:('returns last occurrence instead of first',"print(args[0].rfind(args[1]))"),
33:('returns index in sorted array',"a=sorted(args[0]); print(a.index(args[1]) if args[1] in a else -1)"),
125:('ignores case but fails to remove punctuation',"s=args[0].lower(); print(int(s==s[::-1]))"),
136:('returns minimum rather than unpaired value',"print(min(args[0]))"),
153:('assumes no rotation',"print(args[0][0])"),
154:('assumes minimum is at an endpoint',"print(min(args[0][0],args[0][-1]))"),
169:('takes first element without majority vote',"print(args[0][0])"),
219:('uses strict distance instead of inclusive boundary',"a,k=args; print(int(any(a[i]==a[j] and j-i<k for i in range(len(a)) for j in range(i+1,len(a)))))"),
409:('omits allowable odd central character',"print(sum(v//2*2 for v in Counter(args[0]).values()))"),
455:('requires cookie strictly larger than greed',"g,s=map(sorted,args); i=0\nfor c in s:\n    if i<len(g) and c>g[i]: i+=1\nprint(i)"),
459:('accepts single repetition due to inclusive divisor bound',"s=args[0]; print(int(any(s==s[:k]*(len(s)//k) for k in range(1,len(s)+1))))"),
485:('counts all ones ignoring contiguity',"print(sum(args[0]))"),
521:('uses common subsequence logic for equal strings',"print(max(map(len,args)))"),
561:('pairs adjacent values without sorting',"print(sum(min(args[0][i:i+2]) for i in range(0,len(args[0]),2)))"),
605:('counts empty plots without adjacency restrictions',"print(int(args[0].count(0)>=args[1]))"),
628:('considers only three largest values',"print(math.prod(sorted(args[0])[-3:]))"),
674:('counts increasing transitions across breaks',"a=args[0]; print(1+sum(x<y for x,y in zip(a,a[1:])))"),
680:('does not allow deleting one character',"s=args[0]; print(int(s==s[::-1]))"),
696:('counts transitions rather than balanced substrings',"s=args[0]; print(sum(x!=y for x,y in zip(s,s[1:])))"),
724:('returns rightmost pivot',"a=args[0]; print(next((i for i in range(len(a)-1,-1,-1) if sum(a[:i])==sum(a[i+1:])), -1))"),
796:('checks containment in doubled string without equal lengths',"a,b=args; print(int(b in a+a))"),
844:('removes only backspace symbols',"print(int(args[0].replace('#','')==args[1].replace('#','')))"),
852:('returns peak value instead of index',"print(max(args[0]))"),
860:('tracks money total without denominations',"money=0; ok=True\nfor x in args[0]:\n    if money<x-5: ok=False\n    money+=5\nprint(int(ok))"),
914:('requires all multiplicities equal',"c=list(Counter(args[0]).values()); print(int(min(c)>=2 and len(set(c))==1))"),
925:('treats subsequence as sufficient for long press',"a,b=args; it=iter(b); print(int(all(c in it for c in a)))"),
961:('assumes duplicate values are adjacent',"a=args[0]; print(next((x for x,y in zip(a,a[1:]) if x==y),-1))"),
976:('accepts degenerate triangles',"a=sorted(args[0]); print(next((sum(a[i-2:i+1]) for i in range(len(a)-1,1,-1) if a[i-2]+a[i-1]>=a[i]),0))"),
1004:('uses total number of ones instead of contiguous window',"a,k=args; print(min(len(a),sum(a)+k))"),
1005:('negates each chosen index at most once',"a,k=args; a=sorted(a); print(sum(-x if i<k else x for i,x in enumerate(a)))"),
}

def make_problem(pid):
    zh,en,dzh,den=META[pid]
    if pid in SINGLE_STRING:izh,ien='一行字符串 s。','One line: string s.'
    elif pid in TWO_STRINGS:izh,ien='两行字符串，依次为 '+('haystack、needle。' if pid==28 else 'name、typed。' if pid==925 else 's、goal。' if pid==796 else 'a、b。'),'Two lines containing '+('haystack and needle.' if pid==28 else 'name and typed.' if pid==925 else 's and goal.' if pid==796 else 'a and b.')
    elif pid==455:izh,ien='第一行孩子数 n 和饼干数 m；第二行 n 个胃口，第三行 m 个饼干大小（m=0 时该行为空）。','First line: child count n and cookie count m. Second: n greed values. Third: m cookie sizes (empty when m=0).'
    elif pid in ARRAY_PARAM:izh,ien='第一行数组长度 n 和 '+('target' if pid==33 else '待种数量' if pid==605 else 'k')+'；第二行 n 个数组元素。','First line: array length n and '+('target' if pid==33 else 'additional flower count' if pid==605 else 'k')+'. Second line: n array elements.'
    else:izh,ien='第一行数组长度 n；第二行 n 个数组元素。','First line: array length n. Second line: n array elements.'
    name,body=WRONG[pid]
    return dict(method=METHODS[pid],titleZh=zh,titleEn=en,descriptionZh=dzh,descriptionEn=den,inputZh=izh+' '+CONSTRAINTS[pid][0],inputEn=ien+' '+CONSTRAINTS[pid][1],outputZh='成立输出 1，否则输出 0。' if pid in BOOL_IDS else '输出一个整数和换行。',outputEn='Print 1 if true, otherwise 0.' if pid in BOOL_IDS else 'Print one integer followed by a newline.',difficulty='困难' if pid==154 else '中等' if pid in {33,153,852,1004} else '简单',edges=EDGE[pid],pressure=PRESSURE[pid],random_args=lambda rng:random_args(pid,rng),oracle=lambda args:int(brute(pid,args)),encode=lambda args:encode(pid,args),parse=parse(pid),mutants=[dict(name=name,source='import sys, math\nfrom collections import Counter\n'+parse(pid)+'\n'+body+'\n')],validate=lambda args:validate(pid,args))

PROBLEMS={pid:make_problem(pid) for pid in IDS}
