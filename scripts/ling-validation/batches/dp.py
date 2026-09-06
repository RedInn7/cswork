"""Original DP fixtures: exhaustive small oracles and mathematically constructed stress cases."""
import itertools
import math
from collections import deque


def oracle(pid, a):
    x = a[0]
    if pid == 62:
        m, n = a
        return sum(sum(p) == m-1 for p in itertools.product((0, 1), repeat=m+n-2))
    if pid in (63, 64, 174, 120):
        paths = []
        def walk(i, j, vals):
            if pid == 63 and x[i][j]: return
            vals = vals + [x[i][j]]
            if i == len(x)-1 and (pid == 120 or j == len(x[0])-1):
                paths.append(vals); return
            if pid == 120:
                walk(i+1, j, vals); walk(i+1, j+1, vals)
            else:
                if i+1 < len(x): walk(i+1, j, vals)
                if j+1 < len(x[0]): walk(i, j+1, vals)
        walk(0, 0, [])
        if pid == 63: return len(paths)
        if pid in (64, 120): return min(map(sum, paths))
        return min(1-min([0]+list(itertools.accumulate(p))) for p in paths)
    if pid in (70, 509, 1137):
        def f(n):
            if pid == 70: return 1 if n <= 1 else f(n-1)+f(n-2)
            if pid == 509: return n if n <= 1 else f(n-1)+f(n-2)
            return (0, 1, 1)[n] if n < 3 else f(n-1)+f(n-2)+f(n-3)
        return f(x)
    if pid == 72:
        y = a[1]
        def f(i, j):
            if i == len(x): return len(y)-j
            if j == len(y): return len(x)-i
            if x[i] == y[j]: return f(i+1, j+1)
            return 1+min(f(i+1, j), f(i, j+1), f(i+1, j+1))
        return f(0, 0)
    if pid == 91:
        def f(i):
            if i == len(x): return 1
            if x[i] == '0': return 0
            return f(i+1)+(f(i+2) if i+1<len(x) and int(x[i:i+2])<=26 else 0)
        return f(0)
    if pid == 96:
        def shape(p):
            if not p: return None
            return (shape(tuple(v for v in p if v<p[0])), shape(tuple(v for v in p if v>p[0])))
        return len({shape(p) for p in itertools.permutations(range(x))})
    if pid == 152:
        return max(math.prod(x[i:j]) for i in range(len(x)) for j in range(i+1, len(x)+1))
    if pid == 213:
        return max(sum(x[i] for i in range(len(x)) if mask>>i&1) for mask in range(1<<len(x)) if len(x)==1 or all(not(mask>>i&1 and mask>>((i+1)%len(x))&1) for i in range(len(x))))
    if pid == 221:
        return max([0]+[k*k for i in range(len(x)) for j in range(len(x[0])) for k in range(1,min(len(x)-i,len(x[0])-j)+1) if all(x[r][c]=='1' for r in range(i,i+k) for c in range(j,j+k))])
    if pid in (279, 650):
        start = 0 if pid == 279 else (1,0)
        queue=deque([(start,0)]); seen={start}
        while queue:
            v,d=queue.popleft()
            if (v if pid==279 else v[0]) == x: return d
            neighbors = [v+k*k for k in range(1,math.isqrt(x-v)+1)] if pid==279 else [(v[0],v[0])]+([(v[0]+v[1],v[1])] if v[1] and v[0]+v[1]<=x else [])
            for w in neighbors:
                if w not in seen: seen.add(w); queue.append((w,d+1))
    if pid in (300, 673):
        seq = [tuple(x[i] for i in range(len(x)) if mask>>i&1) for mask in range(1,1<<len(x))]
        lengths = [len(s) for s in seq if all(u<v for u,v in zip(s,s[1:]))]
        return max(lengths) if pid==300 else lengths.count(max(lengths))
    if pid == 343:
        def parts(n, lo):
            yield [n]
            for k in range(lo,n//2+1):
                for tail in parts(n-k,k): yield [k]+tail
        return max(math.prod(p) for p in parts(x,1) if len(p)>1)
    if pid == 377:
        def f(left): return 1 if left==0 else sum(f(left-v) for v in x if v<=left)
        return f(a[1])
    if pid in (392, 583, 712, 1143, 1312):
        y = x[::-1] if pid==1312 else a[1]
        def subseq(s): return {''.join(s[i] for i in range(len(s)) if mask>>i&1) for mask in range(1<<len(s))}
        if pid == 392: return int(x in subseq(y))
        common = subseq(x)&subseq(y)
        best = max(map(len,common))
        if pid == 1143: return best
        if pid == 1312: return len(x)-best
        if pid == 583: return len(x)+len(y)-2*best
        return sum(map(ord,x+y))-2*max(sum(map(ord,s)) for s in common)
    if pid == 416:
        return int(any(2*sum(x[i] for i in range(len(x)) if mask>>i&1)==sum(x) for mask in range(1<<len(x))))
    if pid == 474:
        return max(mask.bit_count() for mask in range(1<<len(x)) if sum(s.count('0') for i,s in enumerate(x) if mask>>i&1)<=a[1] and sum(s.count('1') for i,s in enumerate(x) if mask>>i&1)<=a[2])
    if pid == 494:
        return sum(sum(v*s for v,s in zip(x,signs))==a[1] for signs in itertools.product((-1,1),repeat=len(x)))
    if pid == 518:
        amount,coins=a
        def f(i,left):
            if i==len(coins): return int(left==0)
            return sum(f(i+1,left-k*coins[i]) for k in range(left//coins[i]+1))
        return f(0,amount)
    if pid == 746:
        def f(i): return 0 if i>=len(x) else x[i]+min(f(i+1),f(i+2))
        return min(f(0),f(1))
    raise ValueError(pid)

SCALAR={70,96,279,343,509,650,1137}
ARRAY={152,213,300,416,673,746}
STRINGS={72,392,583,712,1143}
STRING={91,1312}
GRID={63,64,174,221}

def encode(pid,a):
    if pid in SCALAR|{62}: return ' '.join(map(str,a))+'\n'
    if pid in ARRAY: return str(len(a[0]))+'\n'+' '.join(map(str,a[0]))+'\n'
    if pid in STRINGS|STRING: return '\n'.join(a)+'\n'
    if pid in GRID:
        return f'{len(a[0])} {len(a[0][0])}\n'+'\n'.join(' '.join(map(str,row)) for row in a[0])+'\n'
    if pid==120: return str(len(a[0]))+'\n'+'\n'.join(' '.join(map(str,row)) for row in a[0])+'\n'
    if pid==474: return f'{len(a[0])} {a[1]} {a[2]}\n'+'\n'.join(a[0])+'\n'
    nums,target=(a[1],a[0]) if pid==518 else a
    return f'{len(nums)} {target}\n'+' '.join(map(str,nums))+'\n'

def parse(pid):
    if pid in SCALAR|{62}: return 'args=list(map(int,sys.stdin.read().split()))'
    if pid in STRINGS|STRING: return "args=[sys.stdin.readline().rstrip('\\r\\n') for _ in range("+str(2 if pid in STRINGS else 1)+")]"
    if pid in ARRAY: return 'v=list(map(int,sys.stdin.read().split()));assert len(v)==v[0]+1;args=[v[1:]]'
    if pid in GRID:
        return "m,n=map(int,sys.stdin.readline().split());args=[["+('list(sys.stdin.readline().split())' if pid==221 else 'list(map(int,sys.stdin.readline().split()))')+" for _ in range(m)]];assert all(len(row)==n for row in args[0])"
    if pid==120: return 'n=int(sys.stdin.readline());args=[[list(map(int,sys.stdin.readline().split())) for _ in range(n)]];assert all(len(row)==i+1 for i,row in enumerate(args[0]))'
    if pid==474: return "n,m,k=map(int,sys.stdin.readline().split());args=[[sys.stdin.readline().strip() for _ in range(n)],m,k]"
    return 'v=list(map(int,sys.stdin.read().split()));assert len(v)==v[0]+2;args='+('[v[1],v[2:]]' if pid==518 else '[v[2:],v[1]]')


def random_args(pid,r):
    n=r.randint(1,9)
    if pid==62: return [r.randint(1,5),r.randint(1,5)]
    if pid in GRID:
        values=['0','1'] if pid==221 else [0,0,1] if pid==63 else list(range(-8,9)) if pid==174 else list(range(8))
        m,n=r.randint(1,4),r.randint(1,4)
        return [[[r.choice(values) for _ in range(n)] for _ in range(m)]]
    if pid==120: return [[[r.randint(-9,9) for _ in range(i+1)] for i in range(r.randint(1,6))]]
    if pid in SCALAR:
        return [r.randint(2 if pid==343 else 1 if pid in (70,96,279,650) else 0,7 if pid==96 else 12 if pid in (70,509,1137) else 18)]
    if pid in STRINGS: return [''.join(r.choices('abc',k=r.randint(0 if pid in (72,392) else 1,6))) for _ in range(2)]
    if pid==91: return [''.join(r.choices('012367',k=n))]
    if pid==1312: return [''.join(r.choices('abcd',k=n))]
    if pid in ARRAY: return [[r.randint(-3 if pid==152 else -8 if pid in (300,673) else 0 if pid in (213,746) else 1,4 if pid==152 else 15) for _ in range(max(2,n) if pid==746 else n)]]
    if pid==377: return [r.sample(range(1,8),r.randint(1,5)),r.randint(1,9)]
    if pid==494: return [[r.randint(0,7) for _ in range(n)],r.randint(-20,20)]
    if pid==474: return [[''.join(r.choices('01',k=r.randint(1,5))) for _ in range(n)],r.randint(1,8),r.randint(1,8)]
    if pid==518: return [r.randint(0,20),r.sample(range(1,12),r.randint(1,5))]
    raise ValueError(pid)

# Sample first, then discriminating boundaries. All are independently evaluated above.
EDGES={
62:[[3,7],[1,1],[1,8],[8,1],[2,2]],
63:[[[[0,0,0],[0,1,0],[0,0,0]]],[[[1]]],[[[0]]],[[[0,1]]],[[[0],[1],[0]]]],
64:[[[[1,3,1],[1,5,1],[4,2,1]]],[[[0]]],[[[8,1,2]]],[[[2],[3],[1]]]],
70:[[2],[1],[3],[10]],72:[['horse','ros'],['',''],['a',''],['','abc'],['ab','ba']],
91:[['12'],['0'],['06'],['10'],['100'],['226'],['27'],['11106']],96:[[3],[1],[2],[6]],
120:[[[[2],[3,4],[6,5,7],[4,1,8,3]]],[[[-10]]],[[[0],[-1,-2],[-3,-4,-5]]]],
152:[[[2,3,-2,4]],[[-2,0,-1]],[[-2]],[[-2,-3,-4]],[[0,0]],[[0,2,-1,3]]],
174:[[[[-2,-3,3],[-5,-10,1],[10,30,-5]]],[[[0]]],[[[10]]],[[[-10]]],[[[1,-3,3]]]],
213:[[[2,3,2]],[[1]],[[0]],[[1,2,3,1]],[[5,1,1,5]],[[2,1,1,2,1]]],
221:[[[['1','0'],['1','1']]],[[['0']]],[[['1']]],[[['1','1'],['1','1']]]],
279:[[12],[1],[2],[3],[4],[7],[13]],300:[[[10,9,2,5,3,7,101,18]],[[2,2,2]],[[3,2,1]],[[0]],[[1,3,2,4]]],
343:[[10],[2],[3],[4],[7]],377:[[[1,2,3],4],[[2],3],[[1],1],[[2,3],5]],
392:[['abc','ahbgdc'],['',''],['aa','a'],['ab','ba'],['axc','ahbgdc']],
416:[[[1,5,11,5]],[[1]],[[1,2,5]],[[2,2]],[[1,2,3,5]]],
474:[[['10','0001','111001','1','0'],5,3],[['0','1'],1,1],[['00','00','1'],2,1]],
494:[[[1,1,1,1,1],3],[[0],0],[[0,0,0,1],1],[[1],-1],[[1],0]],
509:[[2],[0],[1],[10]],518:[[5,[1,2,5]],[0,[1]],[3,[2]],[5,[5]],[4,[1,2]]],
583:[['sea','eat'],['a','b'],['abc','abc'],['abc','cba']],650:[[3],[1],[2],[6],[9]],
673:[[[1,3,5,4,7]],[[2,2,2,2,2]],[[1]],[[3,2,1]],[[1,1,2,2,3,3]]],
712:[['sea','eat'],['delete','leet'],['a','z'],['ab','ba']],
746:[[[10,15,20]],[[0,0]],[[1,100,1,1,1,100,1,1,100,1]],[[1,2]]],
1143:[['abcde','ace'],['abc','def'],['abc','abc'],['a','aaaa']],
1137:[[4],[0],[1],[2],[10]],1312:[['zzazz'],['a'],['ab'],['leetcode'],['abcba']],
}
PRESSURE={
62:[([100,1],1),([17,17],math.comb(32,16))],
63:[([[[0]*100]+[[0]+[1]*99 for _ in range(99)]],0),([[[1]*100 for _ in range(100)]],0)],
64:[([[[200]*200 for _ in range(200)]],200*399),([[[0]*200 for _ in range(200)]],0)],
70:[([45],1836311903),([44],1134903170)],
72:[(['a'*500,'b'*500],500),(['ab'*250,'ab'*250],0)],
91:[(['10'*50],1),(['0'+'1'*99],0)],96:[([19],1767263190),([18],477638700)],
120:[([[[10000]*(i+1) for i in range(200)]],2000000),([[[-10000]*(i+1) for i in range(200)]],-2000000)],
152:[([[1]*20000],1),([[-1]*20000],1)],
174:[([[[-1000]*200 for _ in range(200)]],399001),([[[1000]*200 for _ in range(200)]],1)],
213:[([[1000]*100],50000),([[0]*99+[1000]],1000)],
221:[([[['1']*300 for _ in range(300)]],90000),([[['0']*300 for _ in range(300)]],0)],
279:[([10000],1),([9999],4)],300:[([list(range(2500))],2500),([[7]*2500],1)],
343:[([58],1549681956),([57],1162261467)],377:[([[1],1000],1),([[2,4],999],0)],
392:[(['a'*100,'a'*10000],1),(['b','a'*10000],0)],
416:[([[100]*200],1),([[100]*199+[99]],0)],
474:[([['0']*300+['1']*300,100,100],200),([['01'*50]*600,100,100],2)],
494:[([[0]*20,0],1048576),([[50]*20,0],184756)],
509:[([30],832040),([29],514229)],518:[([5000,[1]],1),([4999,[2]],0)],
583:[(['a'*500,'b'*500],1000),(['a'*500,'a'*500],0)],
650:[([1000],21),([997],997)],
673:[([list(range(2000))],1),([[2]*2000],2000)],
712:[(['z'*1000,'a'*1000],219000),(['z'*1000,'z'*1000],0)],
746:[([[999]*1000],499500),([[0,999]*500],0)],
1143:[(['a'*1000,'a'*1000],1000),(['a'*1000,'b'*1000],0)],
1137:[([37],2082876103),([36],1132436852)],
1312:[(['a'*250+'b'*250],250),(['a'*500],0)],
}

# Descriptions and constraints are authored summaries, not copied problem text.
META={
62:('uniquePaths','不同路径','Unique Paths','从 m×n 网格左上走到右下，每步仅向右或向下，求路线数。','Count routes from the top left to the bottom right of an m by n grid, moving only right or down.','一行 m n；1≤m,n≤100，答案≤2×10^9。','One line: m n. 1≤m,n≤100; the answer is at most 2×10^9.'),
63:('uniquePathsWithObstacles','不同路径 II','Unique Paths II','从左上走到右下，仅向右或向下；值为 1 的格子不可经过。求路线数。','Count right/down routes from the top left to the bottom right, avoiding cells containing 1.','第一行 m n，后 m 行每行 n 个 0/1。1≤m,n≤100，答案≤2×10^9。','First line: m n; then m rows of n values (0 or 1). 1≤m,n≤100; answer≤2×10^9.'),
64:('minPathSum','最小路径和','Minimum Path Sum','从左上走到右下，每步仅向右或向下，最小化经过格子的数值总和（含两端）。','Minimize the sum of visited cells on a right/down route from the top left to the bottom right, including both endpoints.','第一行 m n，后 m 行每行 n 个整数。1≤m,n≤200，格值在[0,200]。','First line: m n; then m rows of n integers. 1≤m,n≤200; values in [0,200].'),
70:('climbStairs','爬楼梯','Climbing Stairs','每次爬 1 或 2 级台阶，恰好爬 n 级有多少种有序走法？','Count ordered sequences of one-step and two-step moves totaling n steps.','一行 n，1≤n≤45。','One integer n, 1≤n≤45.'),
72:('minDistance','编辑距离','Edit Distance','通过插入、删除、替换一个字符将 word1 变成 word2，求最少操作数。','Find the fewest single-character insertions, deletions, and substitutions transforming word1 into word2.','两行小写英文字符串 word1、word2，均可为空，长度≤500。','Two lines: lowercase strings word1 and word2, possibly empty; each length≤500.'),
91:('numDecodings','解码方法','Decode Ways','数字串可按 1→A 到 26→Z 解码。分段不能含前导零，求完整解码数量。','Count partitions of the digit string into valid codes 1 through 26. Leading zeroes are invalid.','一行数字串，长度1–100，答案不超过有符号32位整数上限。','One digit string of length 1–100; the answer fits a signed 32-bit integer.'),
96:('numTrees','不同的二叉搜索树','Unique Binary Search Trees','键值恰为 1 到 n，每个使用一次，可以构成多少种不同结构的二叉搜索树？','Count structurally distinct binary search trees using every key from 1 through n exactly once.','一行 n，1≤n≤19。','One integer n, 1≤n≤19.'),
120:('minimumTotal','三角形最小路径和','Triangle','从三角形顶端到底边，每次从第 i 行下标 j 移到下一行 j 或 j+1，求最小路径和。','Minimize the top-to-bottom triangle path sum, moving from column j to j or j+1 in the next row.','第一行 n；随后 n 行，第 i 行有 i 个整数（i从1开始）。1≤n≤200，值在[-10000,10000]。','First line: n; then n rows, row i containing i integers (i starts at 1). 1≤n≤200; values in [-10000,10000].'),
152:('maxProduct','乘积最大子数组','Maximum Product Subarray','返回非空连续子数组的最大乘积。','Return the largest product of a nonempty contiguous subarray.','第一行 n，第二行 n 个整数。1≤n≤20000，值在[-10,10]；任意连续子数组乘积均在有符号32位范围内。','First line: n; second line: n integers. 1≤n≤20000; values in [-10,10]; every contiguous subarray product fits signed 32-bit.'),
174:('calculateMinimumHP','地下城游戏','Dungeon Game','从左上向右或下走至右下，进入每格后生命增加该格数值。生命始终至少为1，求最少初始生命。','Move right/down from the top left to the bottom right, adding each visited cell value to health. Find the minimum starting health that keeps health at least 1 throughout.' ,'第一行 m n；随后 m 行 n 个整数。1≤m,n≤200，值在[-1000,1000]。','First line: m n; then m rows of n integers. 1≤m,n≤200; values in [-1000,1000].'),
213:('rob','打家劫舍 II','House Robber II','房屋排成环，不能选择相邻房屋（首尾也相邻），求可取得的最大金额。单间房屋可选。','Houses form a cycle. Maximize the selected value with no neighboring houses selected, including first/last neighbors. A single house may be selected.','第一行 n；第二行 n 个金额。1≤n≤100，金额在[0,1000]。','First line: n; second line: n amounts. 1≤n≤100; amounts in [0,1000].'),
221:('maximalSquare','最大正方形','Maximal Square','求二进制矩阵中全部为1的轴对齐正方形的最大面积。','Return the largest area of an axis-aligned square consisting entirely of ones.','第一行 m n；随后 m 行，每行 n 个空格分隔的0/1。1≤m,n≤300。','First line: m n; then m rows, each with n space-separated 0/1 characters. 1≤m,n≤300.'),
279:('numSquares','完全平方数','Perfect Squares','求将 n 表示为若干正整数平方之和所需的最少项数，可重复使用。','Find the fewest positive perfect-square terms whose sum is n; repetition is allowed.','一行 n，1≤n≤10000。','One integer n, 1≤n≤10000.'),
300:('lengthOfLIS','最长递增子序列','Longest Increasing Subsequence','允许删除元素但不重排，求严格递增子序列的最大长度。','Find the longest strictly increasing subsequence, allowing deletions but preserving order.','第一行 n；第二行 n 个整数。1≤n≤2500，值在[-10000,10000]。','First line: n; second line: n integers. 1≤n≤2500; values in [-10000,10000].'),
343:('integerBreak','整数拆分','Integer Break','把 n 拆成至少两个正整数的和，求这些整数的最大乘积。','Split n into the sum of at least two positive integers and maximize their product.','一行 n，2≤n≤58。','One integer n, 2≤n≤58.'),
377:('combinationSum4','组合总和 IV','Combination Sum IV','用给定不同正整数重复取值，求总和为 target 的有序序列数，顺序不同算不同方案。','Count ordered sequences totaling target using the distinct positive input values, each reusable. Different orders count separately.','第一行 n target；第二行 n 个不同正整数。1≤n≤200，值1–1000，1≤target≤1000；答案在有符号32位范围内。','First line: n target; second line: n distinct positive integers. 1≤n≤200; values 1–1000; target 1–1000; answer fits signed 32-bit.'),
392:('isSubsequence','判断子序列','Is Subsequence','判断 s 是否可由 t 删除若干字符得到，保留相对顺序。是输出1，否则0。','Determine whether deleting characters from t can produce s without reordering. Print 1 if yes, otherwise 0.','两行小写字符串 s、t，均可为空；s长度≤100，t长度≤10000。','Two lines: lowercase strings s and t, possibly empty; lengths at most 100 and 10000 respectively.'),
416:('canPartition','分割等和子集','Partition Equal Subset Sum','能否将所有元素分成两个总和相同的子集？每个位置恰好分到一边，是输出1，否则0。','Can all elements be partitioned into two subsets of equal sum, each position assigned exactly once? Print 1 for yes, 0 for no.','第一行 n；第二行 n 个正整数。1≤n≤200，值1–100。','First line: n; second line: n positive integers. 1≤n≤200; values 1–100.'),
474:('findMaxForm','一和零','Ones and Zeroes','从字符串列表中选尽可能多的位置，使所选字符串合计至多 m 个0和 n 个1。相同字符串的不同位置可分别选。','Select the most list entries whose total counts are at most m zeroes and n ones. Equal strings at different positions are separate selectable entries.','第一行 k m n；后 k 行为二进制字符串。1≤k≤600，1≤m,n≤100，每串长度1–100。','First line: k m n; then k binary strings. 1≤k≤600; 1≤m,n≤100; each string length 1–100.'),
494:('findTargetSumWays','目标和','Target Sum','为每个数组元素独立添加正号或负号，求表达式总值等于 target 的符号分配数。','Assign a plus or minus sign independently to each array element and count assignments totaling target.','第一行 n target；第二行 n 个整数。1≤n≤20，值0–1000，总和≤1000，-1000≤target≤1000。','First line: n target; second line: n integers. 1≤n≤20; values 0–1000; sum≤1000; target in [-1000,1000].'),
509:('fib','斐波那契数','Fibonacci Number','F(0)=0，F(1)=1；之后每项等于前两项之和，求F(n)。','F(0)=0, F(1)=1; each later value is the sum of the previous two. Return F(n).','一行 n，0≤n≤30。','One integer n, 0≤n≤30.'),
518:('change','零钱兑换 II','Coin Change II','每种硬币无限供应，求恰好组成 amount 的组合数，不区分硬币排列顺序。','Count coin combinations totaling amount with unlimited copies of each denomination. Coin order does not distinguish combinations.','第一行 n amount；第二行 n 个不同面值。1≤n≤300，面值1–5000，0≤amount≤5000；答案在有符号32位范围内。','First line: n amount; second line: n distinct denominations. 1≤n≤300; denominations 1–5000; amount 0–5000; answer fits signed 32-bit.'),
583:('minDistance','两个字符串的删除操作','Delete Operation for Two Strings','只能删除字符，求让两个字符串完全相同所需的最少删除总数。','Using only deletions, find the minimum total deletions needed to make the two strings identical.','两行小写英文字符串，长度均1–500。','Two lowercase English strings on separate lines; each length 1–500.'),
650:('minSteps','只有两个键的键盘','2 Keys Keyboard','初始屏幕只有一个A，剪贴板为空。一次操作可复制全部屏幕字符或粘贴剪贴板。求得到恰好 n 个A的最少操作数。','Start with one A and an empty clipboard. One operation copies the entire screen or pastes the clipboard. Minimize operations to obtain exactly n copies of A.','一行 n，1≤n≤1000。','One integer n, 1≤n≤1000.'),
673:('findNumberOfLIS','最长递增子序列的个数','Number of Longest Increasing Subsequences','求最长严格递增子序列的数量。选择的下标不同视为不同子序列。','Count longest strictly increasing subsequences. Different chosen indices distinguish subsequences.','第一行 n；第二行 n 个整数。1≤n≤2000，值在[-1000000,1000000]；答案在有符号32位范围内。','First line: n; second line: n integers. 1≤n≤2000; values in [-1000000,1000000]; answer fits signed 32-bit.'),
712:('minimumDeleteSum','两个字符串的最小ASCII删除和','Minimum ASCII Delete Sum for Two Strings','删除字符让两串相同，删除成本为字符ASCII值之和，求最小总成本。','Delete characters to make the strings identical, minimizing the sum of ASCII values of all deleted characters.','两行小写英文字符串，长度均1–1000。','Two lowercase English strings on separate lines; each length 1–1000.'),
746:('minCostClimbingStairs','使用最小花费爬楼梯','Min Cost Climbing Stairs','可从下标0或1开始，每次支付当前台阶费用后向上1或2级，越过末尾到楼顶，求最小总费用。','Start at index 0 or 1. Pay the current step cost then move one or two steps. Minimize total cost to reach beyond the last step.','第一行 n；第二行 n 个费用。2≤n≤1000，费用0–999。','First line: n; second line: n costs. 2≤n≤1000; costs 0–999.'),
1143:('longestCommonSubsequence','最长公共子序列','Longest Common Subsequence','求两个字符串最长公共子序列的长度。子序列可不连续，但字符顺序不变。','Find the length of the longest subsequence shared by both strings, preserving order without requiring contiguity.','两行小写英文字符串，长度均1–1000。','Two lowercase English strings on separate lines; each length 1–1000.'),
1137:('tribonacci','第N个泰波那契数','N-th Tribonacci Number','T(0)=0，T(1)=T(2)=1，之后每项是前三项之和，求T(n)。','T(0)=0 and T(1)=T(2)=1; later terms sum the preceding three. Return T(n).','一行 n，0≤n≤37。','One integer n, 0≤n≤37.'),
1312:('minInsertions','让字符串成为回文串的最少插入次数','Minimum Insertion Steps to Make a String Palindrome','可以在任意位置插入字符，求使字符串成为回文串的最少插入次数。','Insert characters at arbitrary positions and find the minimum insertions needed to obtain a palindrome.','一行小写英文字符串，长度1–500。','One lowercase English string of length 1–500.'),
}

def validate(pid,a):
    def ints(v,lo,hi):
        assert all(type(z) is int and lo<=z<=hi for z in v)
    x=a[0]
    assert len(a)==(2 if pid in STRINGS|{62,377,494,518} else 3 if pid==474 else 1)
    if pid in SCALAR:
        lo,hi={70:(1,45),96:(1,19),279:(1,10000),343:(2,58),509:(0,30),650:(1,1000),1137:(0,37)}[pid]
        ints(a,lo,hi)
    elif pid==62:
        ints(a,1,100); assert math.comb(sum(a)-2,a[0]-1)<=2000000000
    elif pid in GRID:
        lim=100 if pid==63 else 300 if pid==221 else 200
        assert 1<=len(x)<=lim and 1<=len(x[0])<=lim and all(len(row)==len(x[0]) for row in x)
        if pid==221: assert all(c in ('0','1') and type(c) is str for row in x for c in row)
        else:
            for row in x: ints(row,-1000 if pid==174 else 0,1000 if pid==174 else 200 if pid==64 else 1)
        if pid==63:
            dp=[1]+[0]*(len(x[0])-1)
            for row in x:
                for j,v in enumerate(row): dp[j]=0 if v else dp[j]+(dp[j-1] if j else 0)
            assert dp[-1]<=2000000000
    elif pid==120:
        assert 1<=len(x)<=200
        for i,row in enumerate(x): assert len(row)==i+1; ints(row,-10000,10000)
    elif pid in ARRAY:
        nmax,lo,hi={152:(20000,-10,10),213:(100,0,1000),300:(2500,-10000,10000),416:(200,1,100),673:(2000,-1000000,1000000),746:(1000,0,999)}[pid]
        assert (2 if pid==746 else 1)<=len(x)<=nmax; ints(x,lo,hi)
        if pid==152:
            low=high=1
            for v in x:
                low,high=min(v,low*v,high*v),max(v,low*v,high*v)
                assert -2147483648<=low<=high<=2147483647
        if pid==673:
            # Independently enforce the source problem's promised result bound.
            lengths=[1]*len(x); counts=[1]*len(x)
            for i,v in enumerate(x):
                for j in range(i):
                    if x[j]<v:
                        if lengths[j]+1>lengths[i]: lengths[i],counts[i]=lengths[j]+1,counts[j]
                        elif lengths[j]+1==lengths[i]: counts[i]+=counts[j]
            assert sum(c for k,c in zip(lengths,counts) if k==max(lengths))<=2147483647
    elif pid in STRINGS|STRING:
        for j,s in enumerate(a):
            lim=100 if pid==91 or pid==392 and j==0 else 10000 if pid==392 else 1000 if pid in (712,1143) else 500
            assert (0 if pid in (72,392) else 1)<=len(s)<=lim
            assert all(c in ('0123456789' if pid==91 else 'abcdefghijklmnopqrstuvwxyz') for c in s)
        if pid==91:
            prev,cur=1,int(x[0]!='0')
            for i in range(1,len(x)):
                prev,cur=cur,(cur if x[i]!='0' else 0)+(prev if 10<=int(x[i-1:i+1])<=26 else 0)
            assert cur<=2147483647
    elif pid==474:
        assert 1<=len(x)<=600; ints(a[1:],1,100)
        assert all(1<=len(s)<=100 and set(s)<={'0','1'} for s in x)
    elif pid==494:
        assert 1<=len(x)<=20; ints(x,0,1000); assert sum(x)<=1000; ints(a[1:],-1000,1000)
    elif pid in (377,518):
        coins,target=(x,a[1]) if pid==377 else (a[1],x)
        assert 1<=len(coins)<=(200 if pid==377 else 300) and len(set(coins))==len(coins)
        ints(coins,1,1000 if pid==377 else 5000); ints([target],1 if pid==377 else 0,1000 if pid==377 else 5000)
        dp=[1]+[0]*target
        if pid==377:
            for t in range(1,target+1): dp[t]=sum(dp[t-c] for c in coins if c<=t)
        else:
            for c in coins:
                for t in range(c,target+1): dp[t]+=dp[t-c]
        assert dp[target]<=2147483647
    else: raise ValueError(pid)
    return True

MISTAKES={
62:('multiplies dimensions instead of counting paths','print(args[0]*args[1])'),
63:('ignores blocked cells','g=args[0];print(math.comb(len(g)+len(g[0])-2,len(g)-1))'),
64:('greedily selects the cheaper next cell',"g=args[0];i=j=0;total=g[0][0]\nwhile i+1<len(g) or j+1<len(g[0]):\n    if i+1<len(g) and (j+1==len(g[0]) or g[i+1][j]<g[i][j+1]): i+=1\n    else: j+=1\n    total+=g[i][j]\nprint(total)"),
70:('assumes one way for each first jump position','print(args[0])'),
72:('ignores substitutions and relative character order','print(abs(len(args[0])-len(args[1])))'),
91:('treats invalid zero codes as valid single characters',"s=args[0];print(2**sum(10<=int(s[i:i+2])<=26 for i in range(len(s)-1)))"),
96:('counts insertion permutations rather than distinct trees','print(math.factorial(args[0]))'),
120:('chooses the minimum of each row regardless of connectivity','print(sum(min(row) for row in args[0]))'),
152:('only considers single elements','print(max(args[0]))'),
174:('only checks total health, ignoring negative prefixes','print(max(1,1-sum(map(sum,args[0]))))'),
213:('chooses fixed odd or even house positions on the cycle','a=args[0];print(max(sum(a[::2]),sum(a[1::2])))'),
221:('counts all ones instead of a square',"print(sum(v=='1' for row in args[0] for v in row))"),
279:('greedily subtracts the largest square',"n=args[0];count=0\nwhile n: n-=math.isqrt(n)**2;count+=1\nprint(count)"),
300:('allows equal elements in an increasing subsequence',"a=[]\nfor x in args[0]:\n    i=bisect.bisect_right(a,x)\n    if i==len(a): a.append(x)\n    else: a[i]=x\nprint(len(a))"),
343:('splits into exactly two balanced parts','n=args[0];print((n//2)*(n-n//2))'),
377:('counts unordered combinations instead of sequences',"a,t=args;dp=[1]+[0]*t\nfor c in a:\n    for k in range(c,t+1): dp[k]+=dp[k-c]\nprint(dp[t])"),
392:('ignores order and multiplicity',"print(int(set(args[0])<=set(args[1])))"),
416:('assumes every even total is partitionable','print(int(sum(args[0])%2==0))'),
474:('ignores each string resource cost','a,m,n=args;print(min(len(a),m+n))'),
494:('deduplicates equal reachable totals and loses multiplicities',"a,t=args;s={0}\nfor x in a: s={z+x for z in s}|{z-x for z in s}\nprint(int(t in s))"),
509:('uses F(0)=1 rather than 0',"a=b=1\nfor _ in range(args[0]): a,b=b,a+b\nprint(a)"),
518:('counts different coin orders separately',"t,a=args;dp=[1]+[0]*t\nfor k in range(1,t+1): dp[k]=sum(dp[k-c] for c in a if c<=k)\nprint(dp[t])"),
583:('only accounts for length difference','print(abs(len(args[0])-len(args[1])))'),
650:('assumes only doubling operations are needed','print(2*math.ceil(math.log2(args[0])))'),
673:('returns LIS length rather than its count',"a=[]\nfor x in args[0]:\n    i=bisect.bisect_left(a,x)\n    if i==len(a): a.append(x)\n    else: a[i]=x\nprint(len(a))"),
712:('ignores repeated character occurrences and order','print(sum(map(ord,set(args[0])^set(args[1]))))'),
746:('commits to one parity of stairs','a=args[0];print(min(sum(a[::2]),sum(a[1::2])))'),
1143:('counts common characters without enforcing order','print(sum((collections.Counter(args[0])&collections.Counter(args[1])).values()))'),
1137:('uses the Fibonacci recurrence',"a,b=0,1\nfor _ in range(args[0]): a,b=b,a+b\nprint(a)"),
1312:('assumes one insertion fixes each mismatched mirrored pair','s=args[0];print(sum(s[i]!=s[-i-1] for i in range(len(s)//2)))'),
}
PRESSURE[63].append(([[[0]*100]+[[1]*99+[0] for _ in range(99)]],1))
PRESSURE[152].append(([[-2]*31+[0]*19969],1073741824))
PRESSURE[377].append(([list(range(801,1001)),1000],1))
PRESSURE[518].append(([5000,list(range(4701,5001))],1))
PRESSURE[673].append(([[i for i in range(9) for _ in range(10)]],1000000000))
EDGES[120].append([[[1],[1,100],[100,100,1]]])
EDGES[1143].append(['abc','cba'])
EDGES[64].append([[[1,2,100],[3,100,100],[1,1,1]]])

PROBLEMS={}
for pid,(method,zh,en,dzh,den,izh,ien) in META.items():
    mistake,body=MISTAKES[pid]
    PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=dzh,descriptionEn=den,inputZh=izh,inputEn=ien,outputZh='输出一个整数和换行；判断题用1表示是、0表示否。',outputEn='Print one integer followed by a newline; for yes/no questions use 1 for yes and 0 for no.',difficulty='简单' if pid in (70,392,509,746,1137) else '困难' if pid in (72,174,1312) else '中等',edges=EDGES[pid],pressure=PRESSURE[pid],random_args=lambda r,p=pid:random_args(p,r),oracle=lambda a,p=pid:oracle(p,a),encode=lambda a,p=pid:encode(p,a),parse=parse(pid),validate=lambda a,p=pid:validate(p,a),mutants=[dict(name=mistake,source='import sys, math, bisect, collections\n'+parse(pid)+'\n'+body+'\n')])
