"""Author D. E. Shaw candidates from the fixed OA-Master raw snapshot.

Only code in this file and the generated references is executed; imported OA
source programs are never run.  All generated work remains candidate-only.
"""
from array import array
from itertools import product
from math import comb
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys

import amazon_remaining_h as helper

ROOT = helper.ROOT
OUT = ROOT / 'content/oa-judge'
BATCH = 'deshaw-next'
SEED = 20261005
SOURCE_COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW = {
    1: ('fastprep/The D. E. Shaw Group/deshaw-subarray-removal.md', 'cf3e1b03257132bc3268e68867fee983ff923672'),
    2: ('fastprep/The D. E. Shaw Group/deshaw-calculate-total-region.md', 'd12faf619658b1b05edb51f21d7f77a8e73555ad'),
    3: ('fastprep/The D. E. Shaw Group/deshaw-count-the-number-of-incremovable-subarrays-ii.md', 'fcd695ed9f384875e03ac5946f9bbf7140ba28a3'),
    4: ('fastprep/The D. E. Shaw Group/deshaw-find-maximum-beauty.md', '748420e6fd1f03f3be3e78aa33196c62880fd314'),
    5: ('fastprep/The D. E. Shaw Group/deshaw-find-number-of-interesting-pairs.md', '87000c3fd9d257583507e18db87bd1744325ef34'),
    6: ('fastprep/The D. E. Shaw Group/deshaw-get-min-cost.md', 'f38a0996f39e0d4e61dfc0408fb25724e7476bb5'),
    7: ('fastprep/The D. E. Shaw Group/deshaw-get-minimum-cost.md', 'e38369fc18a63cdf8b4416eb98680112342102a3'),
    8: ('fastprep/The D. E. Shaw Group/deshaw-maximum-size-subarray-sum.md', 'd0ea876f14e22310c825544a24c2921309b3b22e'),
    9: (None, None),
    10: ('fastprep/The D. E. Shaw Group/deshaw-minimum-operations-to-make-array-equal.md', 'ff5f82d06dc4eeac85c051605fad8885ce62d53a'),
    11: ('fastprep/The D. E. Shaw Group/deshaw-perfect-break.md', '96724acff86bbb7fd0514d2bd2ce183cbf97c073'),
    12: ('fastprep/The D. E. Shaw Group/deshaw-tree-points.md', 'dba73574b6acc73a5df138b64b1b995ca58eba05'),
}


def enc_array(values):
    return f'{len(values)}\n' + ' '.join(map(str, values)) + '\n'


def inc_removal_oracle(nums):
    n = len(nums)
    answer = 0
    for left in range(n):
        for right in range(left, n):
            kept = nums[:left] + nums[right + 1:]
            if all(kept[i - 1] < kept[i] for i in range(1, len(kept))):
                answer += 1
    return answer


def random_incremovable(rng):
    return [rng.randint(1, 12) for _ in range(rng.randint(1, 10))]


INC_CODE = '''def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]
    left=0
    while left+1<n and a[left]<a[left+1]: left+=1
    if left==n-1: return str(n*(n+1)//2)
    right=n-1
    while right>0 and a[right-1]<a[right]: right-=1
    ans=0; j=right
    for i in range(left+2):
        j=max(j,i+1)
        if i:
            while j<n and a[j]<=a[i-1]: j+=1
        ans+=n-j+1
    return str(ans)
'''


def encode_values_sum(data):
    values, target = data
    return f'{len(values)} {target}\n' + ' '.join(map(str, values)) + '\n'


def interesting_oracle(data):
    values, target = data
    return sum(abs(values[i] - values[j]) + abs(values[i] + values[j]) == target
               for i in range(len(values)) for j in range(i + 1, len(values)))


def random_pairs(rng):
    values = [rng.randint(-20, 20) for _ in range(rng.randint(1, 12))]
    target = rng.choice([-1, 0, 2 * rng.randint(0, 20), rng.randint(1, 40)])
    return values, target


PAIRS_CODE = '''def solve(raw):
    v=list(map(int,raw.split())); n,target=v[:2]; a=v[2:2+n]
    if target<0 or target%2: return '0'
    radius=target//2
    le=sum(abs(x)<=radius for x in a)
    lt=sum(abs(x)<radius for x in a)
    return str(le*(le-1)//2-lt*(lt-1)//2)
'''


def encode_min_remove(values):
    return enc_array(values)


def min_remove_oracle(values):
    from functools import lru_cache

    @lru_cache(None)
    def visit(state):
        if len(state) < 3:
            return max(state, default=0)
        best = None
        for pair in ((0, 1), (0, 2), (1, 2)):
            keep = next(i for i in range(3) if i not in pair)
            remaining = (state[keep],) + state[3:]
            cost = max(state[pair[0]], state[pair[1]]) + visit(remaining)
            best = cost if best is None else min(best, cost)
        return best

    return visit(tuple(values))


def random_min_remove(rng):
    return [rng.randint(1, 20) for _ in range(rng.randint(1, 9))]


REMOVE_CODE = '''def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]
    if n<3: return str(max(a))
    # dp maps the remaining first value to the least cost so far.
    x,y,z=a[:3]; dp={}
    for keep, paid in ((x,max(y,z)),(y,max(x,z)),(z,max(x,y))):
        dp[keep]=min(dp.get(keep,10**30),paid)
    i=3
    while i+1<n:
        p,q=a[i],a[i+1]; nxt={}
        for carry,cost in dp.items():
            for keep,paid in ((carry,max(p,q)),(p,max(carry,q)),(q,max(carry,p))):
                nxt[keep]=min(nxt.get(keep,10**30),cost+paid)
        dp=nxt; i+=2
    if i<n:
        return str(min(cost+max(carry,a[i]) for carry,cost in dp.items()))
    return str(min(cost+carry for carry,cost in dp.items()))
'''


def random_region(rng):
    return [rng.randint(-8, 8) for _ in range(rng.randint(1, 14))]


def region_oracle(values):
    total = 0
    for i, value in enumerate(values):
        left = i
        while left > 0 and values[left - 1] <= value:
            left -= 1
        right = i
        while right + 1 < len(values) and values[right + 1] <= value:
            right += 1
        total += right - left + 1
    return total


REGION_CODE = '''def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]
    left=[-1]*n; st=[]
    for i,x in enumerate(a):
        while st and a[st[-1]]<=x: st.pop()
        left[i]=st[-1] if st else -1; st.append(i)
    right=[n]*n; st=[]
    for i in range(n-1,-1,-1):
        while st and a[st[-1]]<=a[i]: st.pop()
        right[i]=st[-1] if st else n; st.append(i)
    return str(sum(right[i]-left[i]-1 for i in range(n)))
'''


def encode_difference(data):
    source, target = data
    return f'{len(source)}\n' + ' '.join(map(str, source)) + '\n' + ' '.join(map(str, target)) + '\n'


def min_ops_oracle(data):
    source, target = data
    y = [((target[i] - source[i]) if i % 2 == 0 else (source[i] - target[i])) for i in range(len(source))]
    boundary = [0] * (len(y) + 1)
    previous = 0
    for i, value in enumerate(y):
        boundary[i] = value - previous
        previous = value
    boundary[len(y)] = -previous
    answer = 0
    for parity in (0, 1):
        group = boundary[parity::2]
        prefix = 0
        for value in group:
            prefix += value
            if (parity == 0 and prefix < 0) or (parity == 1 and prefix > 0):
                return -1
        if prefix != 0:
            return -1
        answer += sum(max(0, value) for value in group)
    return answer


def random_difference(rng):
    n = rng.randint(1, 6)
    source = [rng.randint(-3, 3) for _ in range(n)]
    target = source[:]
    # Usually construct a reachable target by applying the fixed +,- operation.
    if rng.random() < 0.65:
        for _ in range(rng.randint(0, 4)):
            left = rng.randrange(n)
            ends = [right for right in range(left + 1, n) if (right - left + 1) % 2 == 0]
            if not ends:
                continue
            right = rng.choice(ends)
            for i in range(left, right + 1):
                target[i] += 1 if (i - left) % 2 == 0 else -1
    else:
        target = [rng.randint(-3, 3) for _ in range(n)]
    return source, target


DIFF_CODE = '''def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; s=v[1:1+n]; t=v[1+n:1+2*n]
    y=[(t[i]-s[i]) if i%2==0 else (s[i]-t[i]) for i in range(n)]
    z=[0]*(n+1); prev=0
    for i,x in enumerate(y): z[i]=x-prev; prev=x
    z[n]=-prev
    answer=0
    for parity in (0,1):
        prefix=0
        for i in range(parity,n+1,2):
            prefix+=z[i]
            if (parity==0 and prefix<0) or (parity==1 and prefix>0): return '-1'
            answer+=max(0,z[i])
        if prefix: return '-1'
    return str(answer)
'''


def encode_array_break(values):
    return enc_array(values)


def break_oracle(values):
    answer = 0
    for b in product(*(range(value + 1) for value in values)):
        c = [values[i] - b[i] for i in range(len(values))]
        if all(b[i] <= b[i + 1] and c[i] >= c[i + 1] for i in range(len(values) - 1)):
            answer += 1
    return answer % 1_000_000_007


def random_break(rng):
    return [rng.randint(1, 5) for _ in range(rng.randint(1, 5))]


BREAK_CODE = '''def solve(raw):
    MOD=1000000007
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]
    dp=[1]*(a[0]+1)
    for i in range(1,n):
        need=max(0,a[i]-a[i-1]); pref=[0]*len(dp); running=0
        for j,x in enumerate(dp): running=(running+x)%MOD; pref[j]=running
        nxt=[0]*(a[i]+1)
        for b in range(a[i]+1):
            prev=b-need
            if prev>=0: nxt[b]=pref[min(prev,len(dp)-1)]
        dp=nxt
    return str(sum(dp)%MOD)
'''


def encode_tree(data):
    values, cost, edges = data
    return f'{len(values)} {cost}\n' + ' '.join(map(str, values)) + '\n' + ''.join(f'{u} {v}\n' for u, v in edges)


def tree_oracle(data):
    values, cost, edges = data
    n = len(values)
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v); adj[v].append(u)
    parent = [-1] * n; order = [0]
    for u in order:
        for v in adj[u]:
            if v == parent[u]: continue
            parent[v] = u; order.append(v)
    descendants = [[] for _ in range(n)]
    for u in range(n):
        todo = [u]
        while todo:
            v = todo.pop(); descendants[u].append(v)
            todo.extend(w for w in adj[v] if parent[w] == v)
    best = 0
    for mask in range(1 << n):
        current = values[:]; score = 0
        for u in order:
            if mask >> u & 1:
                for v in descendants[u]: current[v] //= 2
                score += current[u]
            else:
                score += current[u] - cost
        best = max(best, score)
    return best


def random_tree(rng):
    n = rng.randint(1, 8)
    edges = [(rng.randrange(i), i) for i in range(1, n)]
    rng.shuffle(edges)
    return [rng.randint(1, 30) for _ in range(n)], rng.randint(1, 12), edges


TREE_CODE = '''def solve(raw):
    from array import array
    v=list(map(int,raw.split())); n=v[0]; k=v[1]; a=v[2:2+n]; adj=[[] for _ in range(n)]; p=2+n
    for _ in range(n-1):
        u,w=v[p:p+2]; p+=2; adj[u].append(w); adj[w].append(u)
    # Each DFS frame accumulates the children's values for every inherited halving count.
    stack=[[0,-1,0,array('q',[0])*31]]
    while stack:
        frame=stack[-1]; u,parent,index,child_sum=frame
        if index<len(adj[u]):
            w=adj[u][index]; frame[2]+=1
            if w!=parent: stack.append([w,u,0,array('q',[0])*31])
            continue
        dp=array('q',[0])*31
        for shift in range(30,-1,-1):
            dp[shift]=max((a[u]>>shift)-k+child_sum[shift], (a[u]>>(shift+1))+child_sum[min(shift+1,30)])
        stack.pop()
        if stack:
            parent_sum=stack[-1][3]
            for shift in range(31): parent_sum[shift]+=dp[shift]
        else:
            return str(dp[0])
'''


SPECS = [
    dict(number=3, title='删除一个子数组后的严格递增数组',
         desc='给定正整数数组。删除一个非空连续子数组后，剩余数组（允许为空）若为严格递增，则该删除方案有效。统计所有有效方案数。',
         limits='第一行 n（1≤n≤100000）；第二行 n 个正整数，1≤nums[i]≤10^9。范围取自原题约束。',
         output='输出有效的连续子数组个数，以 64 位整数保存。',
         idea='找到最长严格递增前缀和后缀。枚举保留前缀长度 i，双指针找到与它衔接且严格递增的最早后缀起点 j；j 之后的所有后缀起点都可行，累计方案数。',
         proof='删除段 [i,j) 后，剩余部分严格递增当且仅当前缀自身严格递增、后缀自身严格递增，且两者相接时前缀末值小于后缀首值；任一侧为空时无需比较。前缀长度只可能在最长递增前缀范围内，后缀起点只可能位于最长递增后缀之后。随着前缀末值递增，最小可行后缀起点不会左移，因此双指针逐一计入全部且仅有的非空删除区间。',
         complexity='时间 O(n)，额外空间 O(n)（输入）。',
         samples=[[1,2,3,4],[6,5,7,8],[8,7,6,6]], random=random_incremovable, oracle=inc_removal_oracle, encode=enc_array, code=INC_CODE,
         mutants=[('把严格递增误作非递减','a[left]<a[left+1]','a[left]<=a[left+1]'),('错误排除删除整个数组','ans+=n-j+1','ans+=n-j')],
         edges=[(list(range(1,100001)),100000*100001//2),([9]*100000,3)], bound=1200010, source_reason='原题明确严格递增并明确空数组按严格递增处理；保留其完整约束。'),
    dict(number=5, title='满足绝对值条件的无序数对',
         desc='给定整数数组和 sumVal。不同下标组成的无序数对 (i,j) 在 |arr[i]-arr[j]|+|arr[i]+arr[j]| 等于 sumVal 时称为有趣数对。统计数对数量。',
         limits='第一行 n 与 sumVal，第二行 n 个整数。本站补充：1≤n≤100000，−10^9≤arr[i]≤10^9，−2×10^9≤sumVal≤2×10^9；结果使用 64 位整数。原快照未提供这些范围。',
         output='输出满足条件的无序下标对数量。',
         idea='恒等式 |x−y|+|x+y|=2·max(|x|,|y|)。若 sumVal 为非负偶数，令 r=sumVal/2；答案是绝对值不超过 r 的元素对数，减去两者绝对值都小于 r 的元素对数。',
         proof='把实数 x,y 分别按符号同异分两种情形，表达式均等于 2 倍较大绝对值。因此合法对的最大绝对值恰为 r。所有绝对值≤r 的数对中，排除最大值<r 的数对，剩下的每一对至少有一个值绝对值等于 r，且恰好对应题目条件。',
         complexity='时间 O(n)，额外空间 O(1)。',
         samples=[([1,4,-1,2],4),([0,0,3],0),([2,-2,4],4)], random=random_pairs, oracle=interesting_oracle, encode=encode_values_sum, code=PAIRS_CODE,
         mutants=[('忽略负数的绝对值','abs(x)<=radius','x<=radius'),('把小于半径的数对也算入答案','le*(le-1)//2-lt*(lt-1)//2','le*(le-1)//2')],
         edges=[(([10**9]*100000,2*10**9),100000*99999//2),(([0]*100000,0),100000*99999//2)], bound=1200030, source_reason='定义及样例可判定；原快照没有 Constraints，题面明确列出本站补充范围及 64 位结果格式。'),
    dict(number=6, title='从队首三项中移除两项的最小代价',
         desc='数组中每次从当前数组的前三个元素中任取两个删除，操作代价是被删两数的较大值。若剩余少于三个元素，则一次性删除全部剩余元素，代价为这些元素的最大值。求删空数组的最小总成本。',
         limits='第一行 n（1≤n≤1000）；第二行 n 个正整数，1≤arr[i]≤10^6。范围取自原题约束。',
         output='输出最小总代价。',
         idea='第一次处理前三项后恰剩一项。用动态规划记录“当前队首保留值→到达该状态的最小已付成本”。每轮把该值与接下来两项一起考虑，枚举留下哪一项；末尾不足三项时按题面一次性结算。',
         proof='任一操作都从队首前三项删除两项，因此操作后队列可唯一表示为一个保留值和未处理后缀。转移枚举前三项中唯一留下的元素，并对另外两项支付题面规定的最大值，故覆盖全部可能操作且无遗漏。对同一保留值只保留较低成本不会影响未来选择，因此状态压缩保持最优性。最后依照少于三项的规则结算，取最小即全局最优。',
         complexity='设 n 为数组长度，状态至多 n 个、处理至多 n/2 轮；时间 O(n²)，空间 O(n)。',
         samples=[[7],[4,2],[1,2,3,4,5]], random=random_min_remove, oracle=min_remove_oracle, encode=encode_min_remove, code=REMOVE_CODE,
         mutants=[('错误地留下前三项中的最大值','for keep,paid in ((carry,max(p,q)),(p,max(carry,q)),(q,max(carry,p))):','for keep,paid in ((max(carry,p,q),min(carry,p,q)),):'),('末尾不足三项时漏算最终删除费用',"return str(min(cost+carry for carry,cost in dp.items()))","return str(min(cost for carry,cost in dp.items()))")],
         edges=[([1]*1000,500)], bound=8000, source_reason='原题操作、末尾结算及 n/value 约束明确；其原始快照没有示例，本站用题面规则生成公开例子。'),
    dict(number=8, title='最大值所能覆盖的最长子数组长度之和',
         desc='对数组中每个位置 i，求包含 i 且 a[i] 是该连续子数组最大值的最长子数组长度，得到数组 b。输出 b 所有元素之和。允许子数组包含与 a[i] 相等的其他最大值。',
         limits='第一行 n（本站补充 1≤n≤100000）；第二行 n 个整数（本站补充 −10^9≤a[i]≤10^9）。原快照只给出 n≤10^5，没有给出元素范围；答案按 64 位整数输出。',
         output='输出所有位置对应的最长子数组长度之和，以 64 位整数保存。',
         idea='对每个位置寻找左右两侧最近的严格更大元素。它们之间的所有元素都不大于当前值，因此最大合法区间长度是两侧边界之间的宽度。用单调栈在线性时间求边界。',
         proof='最近的严格更大元素不能纳入区间，因为会使 a[i] 不再是最大值；在任一侧再远一步之前的全部元素都不大于 a[i]，可纳入且不破坏最大值条件。故左右最近严格更大的元素唯一确定最大区间，长度为 right-left-1。逐位置相加即为目标和。',
         complexity='时间 O(n)，额外空间 O(n)。',
         samples=[[10,20,10,9,12,14],[5,5],[3,2,1]], random=random_region, oracle=region_oracle, encode=enc_array, code=REGION_CODE,
         mutants=[('把相等值误当成阻挡边界','a[st[-1]]<=x','a[st[-1]]<x'),('只统计每个区间的单个位置','right[i]-left[i]-1','1')],
         edges=[([7]*100000,10**10),([100000-i for i in range(100000)],100000*100001//2)], bound=1200010, source_reason='选择 #8 作为该语义在本题组的唯一收录版本：原始样例完整且可复算。#2 是同义重复项，但其原始说明注明图示答案 5 与文字结果 6 冲突，故 #2 暂缓。'),
    dict(number=10, title='交替增减偶数长度区间的最少操作数',
         desc='每次可任选一个非空偶数长度连续子数组，从左至右对其中元素依次执行 +1、−1、+1、−1。可对同一区间重复操作，也可选择不同区间。求把 source 变为 target 的最少操作数；不可实现时输出 −1。',
         limits='第一行 n（原题 1≤n≤10^5）；随后两行分别为 n 个 source 和 n 个 target 值（原题 −10^9≤元素≤10^9）。',
         output='输出最少操作次数；不可达输出 −1。',
         idea='令 y[i]=(-1)^i·(target[i]−source[i])，则一次合法操作会给 y 的偶数长度区间整体加一个常量；常量由区间左端下标奇偶决定。对 y 做相邻差分，在两个同奇偶边界产生方向固定的一单位变化。分别检查每种奇偶边界的前缀差分方向与总和；可行时所需操作数等于正差分单位数。',
         proof='区间 [l,r] 长度为偶数，变换后每个位置增加 s=(-1)^l。相邻差分只在 l 处增加 s、在 r+1 处减少 s；因 r+1−l 为偶数，两个边界下标同奇偶。对偶数边界，每个操作在较早端点 +1、较晚端点 −1，因此任一前缀的差分和必须非负；对奇数边界符号相反，前缀和必须非正。两组总和还都必须为零。反过来，若这些条件成立，从左到右扫描即可把每个较早端点的待处理单位与后续相反端点配对；它们同奇偶且先后有序，唯一确定合法偶数区间。每次操作恰好提供一个单位，因此正差分单位总数就是最小操作数。',
         complexity='时间 O(n)，额外空间 O(n)。',
         samples=[([0,0],[1,-1]),([0,0],[-1,1]),([0,0,0,0],[1,-1,1,-1])], random=random_difference, oracle=min_ops_oracle, encode=encode_difference, code=DIFF_CODE,
         mutants=[('变换时未按下标交替改符号','else (s[i]-t[i])','else (t[i]-s[i])'),('忽略区间方向导致的前缀约束','if (parity==0 and prefix<0) or (parity==1 and prefix>0): return \'-1\'','if False: return \'-1\'')],
         edges=[(([0]*100000,[1 if i%2==0 else -1 for i in range(100000)]),1),(([7]*100000,[7]*100000),0)], bound=2400030, source_reason='原题定义与 n/value 约束完整；原始快照未附公开示例，题面明确本站补充示例。'),
    dict(number=11, title='数组的非降与非升拆分方案数',
         desc='给定正整数数组 arr。统计有多少对长度均为 n 的非负整数数组 b、c，满足 b 非降、c 非升，且对每个 i 都有 b[i]+c[i]=arr[i]。答案对 1000000007 取模。',
         limits='第一行 n（1≤n≤3000）；第二行 n 个整数（1≤arr[i]≤3000）。范围与模数取自原题约束。',
         output='输出满足条件的 (b,c) 有序数组对数模 1000000007。',
         idea='给定前一项 b[i−1] 后，下一项 x=b[i] 必须至少为 b[i−1]+max(0,arr[i]−arr[i−1])，同时 x≤arr[i]。维护每个末值的方案数及其前缀和即可 O(n·max(arr)) 转移。',
         proof='由 c[i]=arr[i]−b[i]，条件 b[i]≥b[i−1] 且 c[i]≤c[i−1] 合并为 b[i]−b[i−1]≥max(0,arr[i]−arr[i−1])。因此对于当前末值 x，所有合法前态恰为不超过 x−need 的末值。前缀和准确汇总这些互斥前态，转移得到以 x 结尾的所有方案；求和即覆盖所有可能的 b，而 c 被 b 唯一确定。',
         complexity='时间 O(n·M)，空间 O(M)，M=max(arr[i])≤3000。',
         samples=[[2,3,2],[3,2],[1]], random=random_break, oracle=break_oracle, encode=encode_array_break, code=BREAK_CODE,
         mutants=[('忽略 c 非升约束','need=max(0,a[i]-a[i-1])','need=0'),('把非降条件误作严格递增','need=max(0,a[i]-a[i-1])','need=max(1,a[i]-a[i-1])')],
         edges=[([3000]*3000, comb(6000,3000)%1_000_000_007)], bound=16000, source_reason='原题约束、条件与两个示例完整；按原规则精确翻译 b/c 单调性。'),
    dict(number=12, title='树上收集点数最大化',
         desc='给定以节点 0 为根的无向树和每个节点的正整数 A[u]。从根开始，只有在父节点已收集后才可处理该节点。处理节点可选择：收集当前值减 K 的点；或收集当前值整除 2 的点，并把该节点及其整棵子树中尚未处理的节点值都整除 2。可以出现负的单步收益，最大化总点数。',
         limits='第一行 n K（1≤n≤100000，1≤K≤10^9）；第二行 n 个值 A[u]（1≤A[u]≤10^9）；随后 n−1 行为 0-based 无向边 u v。其余树约束取自原题。',
         output='输出可获得的最大总点数，使用 64 位整数。',
         idea='树形动态规划。设 dp[u][s] 为节点 u 及其子树在进入时所有值已被整除 2 共 s 次时的最大得分。选择扣 K 时子节点沿用 s；选择减半时节点得 floor(A[u]/2^(s+1))，子节点状态变为 s+1。超过 30 次减半后所有值归零。',
         proof='任一合法方案在节点 u 处恰有两种选择。扣 K 不改变未处理子树值，因此所有子节点状态仍为 s；减半会将 u 的每个后代值都变为原值再右移一位，故所有子节点状态统一变为 s+1。子树之间没有边连接，固定 u 的选择后各子树可以独立取最优值，因此两种候选收益之最大值就是 dp[u][s]。自底向上计算覆盖所有方案。',
         complexity='时间 O(31n)，额外空间 O(n)。',
         samples=[([10,10,3,3],5,[(0,1),(1,2),(2,3)]),([3],5,[]),([8,4,2],3,[(0,1),(1,2)])], random=random_tree, oracle=tree_oracle, encode=encode_tree, code=TREE_CODE,
         mutants=[('扣 K 后错误地仍把子树减半','child_sum[shift]','child_sum[min(shift+1,30)]'),('半值分支错误地沿用同一状态','child_sum[min(shift+1,30)]','child_sum[shift]')],
         edges=[(([1]*100000,1,[(i-1,i) for i in range(1,100000)]),0)], bound=1900030, source_reason='原题树根、两种收益、子树减半语义、约束及公开示例均完整。本站 I/O 显式规定 K 与边的顺序。'),
]


BLOCKED = {
    1: '原始 fastprep 约束只有损坏占位符 O_O；“sorted in increasing order”没有明确说明严格递增还是允许相等，而公开例子不足以消歧。未擅自补成 #3 的严格语义。',
    2: '原题原始文本写明第一个示例区域长度之和为 6，同时备注来源图示答案为 5；题面与原图答案直接矛盾。#8 是同义重复题且有独立、可复算样例，故只保留 #8。',
    4: '原始约束明确写 unknown for now；“允许删除直到数组大小为 1”与唯一示例最终保留 5 个元素不一致，停止条件/可否任意时刻停止无法唯一确定。',
    7: '题意未给任何约束或公开样例；免费服务器的可用时段、其是否能同时执行多任务、任务与付费任务的时间重叠规则均未说明，补任何调度假设都会决定答案。',
    9: '固定提交 e66f809 的 fastprep/The D. E. Shaw Group 目录中没有 Police Station 对应原始题面文件；当前仅见整理 catalog 条目，无法按要求核对原题规则、样例与边界。',
}


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','candidate-batches','validation','reviews','source-evidence'):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    catalog=json.loads((ROOT/'content/oa-master/catalog.json').read_text())
    sources={item['id']:item for item in catalog['items']}
    batch_items=[]; reports=[]; reviews=[]; evidence=[]; skipped={}
    for spec in sorted(SPECS,key=lambda s:s['number']):
        number=spec['number']; ident=f'oa-the-d-e-shaw-group-{number}'; source=sources[ident]
        code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
        reference=OUT/'references'/f'{ident}.py'; reference.write_text(code)
        rng=random.Random(SEED+number)
        oracle_inputs=spec['samples']+[spec['random'](rng) for _ in range(160)]
        oracle=[dict(input=spec['encode'](case),expectedOutput=str(spec['oracle'](case))+'\n') for case in oracle_inputs]
        formal=oracle[:3]+[dict(input=spec['encode'](case),expectedOutput=str(expected)+'\n') for case,expected in spec.get('edges',[])]+oracle[3:31]
        assert len(oracle)==163 and len(formal)<=64
        for case in oracle+formal:
            assert len(case['input'].encode())<=spec['bound'],(ident,len(case['input'].encode()),spec['bound'])
            assert '\ufffd' not in case['input']+case['expectedOutput']
        actual=helper.execute(reference,[case['input'] for case in oracle+formal])
        for i,(got,case) in enumerate(zip(actual,oracle+formal)):
            assert got.split()==case['expectedOutput'].split(),(ident,i,got[:200],case['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**case,hidden=i>=3,weight=1) for i,case in enumerate(formal)]
        mutants=[]; killed=[]
        for j,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code,(ident,name,old)
            mutant=code.replace(old,new,1)
            path=OUT/'negative-controls'/f'{ident}-{j}.py';path.write_text(mutant)
            outputs=helper.execute(path,[case['input'] for case in cases])
            rejected=[i for i,(got,case) in enumerate(zip(outputs,cases)) if got.split()!=case['expectedOutput'].split()]
            assert rejected,(ident,name,'mutant survived')
            mutants.append(dict(name=name,code=mutant));killed.append(dict(name=name,rejectedByCases=rejected))
        p=dict(id=ident,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','The D. E. Shaw Group'],description=spec['desc']+'\n\n标准输入输出、本站补充范围和示例按本题说明执行；来源范围缺失处均明确标记为本站补充。',input=spec['limits'],output=spec['output'],explanation=spec['idea'],hints=[spec['idea']],timeLimit=spec.get('time',6),memoryLimit=spec.get('memory',262144),outputLimit=spec.get('outputLimit',4096),checker='tokens',languages=['python','go','java','cpp'])
        parsed=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=p,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert parsed.returncode==0,parsed.stderr[:3000]
        normalized=parsed.stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        solution=[dict(language='python',code=code)]
        docs=dict(packages=json.loads(normalized),oracles=oracle,mutants=mutants,editorials=dict(schemaVersion=1,id=ident,title=spec['title'],explanation=editorial,solutions=solution,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork'))
        for folder,data in docs.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        batch_items.append(dict(id=ident,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solution))
        reports.append(dict(id=ident,oracleCases=len(oracle),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=spec['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        path,blob=RAW[number]
        reviews.append(dict(id=ident,status='authored',reason=f"核对固定 raw 快照 {path}（blob {blob}）与 catalog 指纹 {source['contentHash']}；{spec['source_reason']} 已通过 163 组独立 oracle、边界用例及两个正常退出错误程序的离线检查；尚未做真实沙箱验证。"))
        evidence.append(dict(id=ident,catalogContentHash=source['contentHash'],sourceUrl=source['sourceUrl'],status='authored',reason=spec['source_reason'],path=path,gitBlobSha=blob))
        print(ident,'163 oracle,',len(cases)-3,'hidden; 2 normal-exit mutants rejected',flush=True)
    for number,reason in BLOCKED.items():
        ident=f'oa-the-d-e-shaw-group-{number}';source=sources[ident];path,blob=RAW[number]
        reviews.append(dict(id=ident,status='blocked',reason=reason))
        evidence.append(dict(id=ident,catalogContentHash=source['contentHash'],sourceUrl=source['sourceUrl'],status='blocked',reason=reason,path=path,gitBlobSha=blob))
        skipped[ident]=reason
    for collection in (batch_items,reports,reviews,evidence):collection.sort(key=lambda x:int(x['id'].rsplit('-',1)[1]))
    (OUT/'candidate-batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=batch_items),ensure_ascii=False,indent=2)+'\n')
    note='本地独立 oracle/参考解对照及两个正常退出错误程序验证通过；所有题目仍是候选，未运行 GoJudge，不表示线上可提交。'
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped=skipped,note=note),ensure_ascii=False,indent=2)+'\n')
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
    (OUT/'source-evidence'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,repository='https://github.com/RedInn7/OA-Master',commit=SOURCE_COMMIT,reason='逐题只读核对固定原始题源；不执行来源仓库中的代码。',items=evidence),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':
    main()
