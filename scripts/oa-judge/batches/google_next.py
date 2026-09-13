"""Second authored batch; imports no source code and does not modify the registry."""
import collections
import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'


def board_oracle(s):
    tokens = sum(1 << i for i,c in enumerate(s) if c == 'T')
    coins = sum(1 << i for i,c in enumerate(s) if c == 'C')
    seen = {(tokens,coins)}; queue = [(tokens,coins)]; best = 0
    for ts,cs in queue:
        best = max(best, coins.bit_count()-cs.bit_count())
        for i in range(len(s)-3):
            if ts >> i & 1 and not ts >> (i+3) & 1:
                state = (ts ^ (1 << i) ^ (1 << (i+3)),cs & ~(1 << (i+3)))
                if state not in seen:
                    seen.add(state); queue.append(state)
    return str(best)


def tree_oracle(x):
    values, edges = x
    if len(values) == 1: return '0'
    answers = []
    for mask in range(1 << len(values)):
        if all((mask >> a & 1) != (mask >> b & 1) for a,b in edges):
            groups = [[v for i,v in enumerate(values) if (mask >> i & 1)==c] for c in (0,1)]
            answers.append(sum(max(g)-min(g) for g in groups))
    return str(min(answers))


def locker_oracle(visits):
    occupied = {}; answer = 0
    for visitor in visits:
        if visitor in occupied: del occupied[visitor]
        else:
            answer = 1
            while answer in occupied.values(): answer += 1
            occupied[visitor] = answer
    return str(answer)


def subsequence_oracle(x):
    a,k=x
    return max(''.join(map(str,c)) for c in itertools.combinations(a,k)).lstrip('0') or '0'


def pizza_oracle(x):
    pizzas,toppings,budget=x
    possible = []
    for mask in range(1 << len(toppings)):
        if mask.bit_count() <= 2:
            extra = sum(v for i,v in enumerate(toppings) if mask >> i & 1)
            possible.extend(p+extra for p in pizzas)
    return str(min(possible,key=lambda cost:(abs(cost-budget),cost)))


CODE_COUNTS=collections.Counter(sum(map(int,f'{i:04d}')) for i in range(10000))


def houses_oracle(x):
    houses,stores=x
    return ' '.join(str(min(stores,key=lambda s:(abs(s-h),s))) for h in houses)


def logs_oracle(a):
    target=min(collections.Counter(a).values()); answer=0
    for i in range(len(a)):
        for j in range(i+1,len(a)+1):
            if max(collections.Counter(a[i:j]).values())==target: answer=max(answer,j-i)
    return str(answer)


def minmax_oracle(a):
    return str(max(min(a[i:j])+max(a[i:j]) for i in range(len(a)) for j in range(i+2,len(a)+1)))


def expression(r,depth=0):
    if depth>=4 or r.random()<.4:
        n=r.randint(-50,50); return (str(n),n)
    left,a=expression(r,depth+1); right,b=expression(r,depth+1)
    op=r.choice(['add','sub']); space=r.choice(['',' '])
    return (f'{op}({space}{left},{space}{right}{space})',a+b if op=='add' else a-b)


def array_input(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'


SPECS=[
dict(id=4,title='向右跳三格收集金币',tags=['贪心'],desc='棋盘由 .（空格）、T（棋子）、C（金币）组成。每步选一个棋子，向右恰好跳三格，落点必须在棋盘内且没有其他棋子。落点上的金币被收集且不再出现。求最多收集多少枚金币。',
 input='输入长度为 1..100 的棋盘字符串，只含 .、T、C。',
 idea='把下标按模 3 分成三条互不影响的链。每条链只统计最左棋子右侧的金币。',proof='棋子只能停在同一余数类，因此最左棋子左侧的金币永远不可达。链上从右到左依次移动棋子到无法继续的位置，较右棋子不会阻止较左棋子收集它们之间的金币，最终能收集最左棋子之后的全部金币。三条链结果相加。',complexity='时间 O(n)，额外空间 O(n)（字符串切片）。',
 samples=['TT.TCCCC','T...CCCC','C..TT.CT.C'],random=lambda r:''.join(r.choice('.TC') for _ in range(r.randint(1,9))),
 edges=[('T', '0'),('C'*100,'0'),('TTT'+'C'*97,'97'),('C'*97+'TTT','0')],encode=lambda s:s+'\n',oracle=board_oracle,
 code='''def solve(data):
    board=data[0]; answer=0
    for residue in range(3):
        started=False
        for cell in board[residue::3]:
            if cell=='T': started=True
            elif cell=='C' and started: answer+=1
    return str(answer)
''',mutants=[('忽略可达性',"elif cell=='C' and started:","elif cell=='C':"),('把跳跃距离当成1','range(3)','range(1)')]),
dict(id=6,title='树的二分组费用',tags=['树','二分图'],desc='给定一棵树，每个节点有一个正整数值。将节点分为尽可能少的非空组，同组内不能有相邻节点。每组费用是该组最大值减最小值。输出各组费用之和。只有一个节点时分一组，费用为 0。',input='第一行 n（1..100000），第二行 n 个值（1..10⁹），随后 n−1 行边 u v，节点编号 1..n。保证输入是一棵树。',
 idea='用迭代遍历对树进行黑白染色，分别维护两种颜色的最小值和最大值。',proof='至少两个节点的树含边，因此至少需要两组。按深度奇偶分组可行，而且连通树的二染色除交换颜色外唯一，所以这两个颜色组就是最少组数下的分组。单节点单独处理。',complexity='时间 O(n)，额外空间 O(n)。',samples=[([7],[]),([1,10],[(0,1)]),([2,9,7,3],[(0,1),(1,2),(1,3)])],random=lambda r:(lambda n:([r.randint(1,30) for _ in range(n)],[(i,r.randrange(i)) for i in range(1,n)]))(r.randint(1,8)),edges=[(([1]*100000,[(i-1,i) for i in range(1,100000)]),'0'),(([1]+list(range(1,100000)),[(0,i) for i in range(1,100000)]),'99998')],encode=lambda x:array_input(x[0])+''.join(f'{a+1} {b+1}\n' for a,b in x[1]),oracle=tree_oracle,
 code='''def solve(data):
    n=int(data[0]); values=list(map(int,data[1:n+1]))
    if n==1:return '0'
    edges=list(map(int,data[n+1:])); graph=[[] for _ in range(n)]
    for i in range(0,len(edges),2):
        a,b=edges[i]-1,edges[i+1]-1; graph[a].append(b); graph[b].append(a)
    low=[10**18,10**18]; high=[0,0]; stack=[(0,-1,0)]
    while stack:
        u,parent,color=stack.pop(); low[color]=min(low[color],values[u]); high[color]=max(high[color],values[u])
        for v in graph[u]:
            if v!=parent:stack.append((v,u,1-color))
    return str(sum(high[i]-low[i] for i in range(2)))
''',mutants=[('错误地合并两组','1-color','color'),('只计算一个颜色组','for i in range(2)','for i in range(1)')]),
dict(id=8,title='最小编号储物柜',tags=['堆','哈希表'],desc='储物柜编号从 1 开始，数量足够。每次访客到来：如果尚未占用柜子，就分配当前空闲的最小编号；否则释放其柜子。求整个序列中最后一次分配的柜子编号。最后一个事件可能是释放。',input='第一行 n（1..100000），随后 n 个访客标识。本站输入标识为长度 1..32 的英文字母或数字字符串，不含空白。',idea='用哈希表记录每位访客占用的柜子，最小堆保存已释放的编号；没有可复用编号时使用递增的新编号。',proof='未使用过的柜子编号都不小于 next，已释放柜子的最小编号由堆顶给出且小于 next。因此每次分配恰为所有空闲柜子的最小值。仅在分配时更新答案，便保留了最后一次分配结果。',complexity='时间 O(n log n)，额外空间 O(n)。',samples=[['Alice','Eve','Bob','Eve','Carl','Alice'],['a','b','a','c'],['a','a']],random=lambda r:[r.choice('abcde') for _ in range(r.randint(1,18))],edges=[(['u'+str(i) for i in range(100000)],'100000'),(['a']*100000,'1'),(['a','b','c','b','a','d'],'1')],encode=lambda a:str(len(a))+'\n'+'\n'.join(a)+'\n',oracle=locker_oracle,
 code='''def solve(data):
    import heapq
    occupied={}; free=[]; next_id=1; answer=0
    for visitor in data[1:]:
        if visitor in occupied:heapq.heappush(free,occupied.pop(visitor))
        else:
            if free:answer=heapq.heappop(free)
            else:answer=next_id; next_id+=1
            occupied[visitor]=answer
    return str(answer)
''',mutants=[('不复用柜子','if free:answer=heapq.heappop(free)','if False:answer=heapq.heappop(free)'),('把访客重复当新增', 'if visitor in occupied:', 'if False:')]),
dict(id=10,title='选取 k 位组成最大整数',tags=['单调栈','贪心'],desc='给定 n 个十进制数字，必须保持原顺序选出恰好 k 个数字，拼成尽可能大的整数。允许前导零，输出不保留前导零；全零输出 0。',input='第一行 n k（1 ≤ k ≤ n ≤ 100000），第二行 n 个数字（0..9）。',idea='允许删除 n−k 位。维护单调栈，新数字更大时，只要仍可删除，就弹掉末尾较小数字。最后截取前 k 位。',proof='若仍可删除，保留位于较大数字之前的较小数字会使第一个不同位更小；删去它只会改善结果。不能再弹出时保留当前前缀，剩余删除量从尾部去掉。因此逐步获得字典序最大的 k 位子序列。',complexity='时间 O(n)，额外空间 O(n)。',samples=[([4,9,0,2],2),([0,0,5,7],3),([0,0,0],2)],random=lambda r:(lambda a:(a,r.randint(1,len(a))))([r.randint(0,9) for _ in range(r.randint(1,9))]),edges=[(([0]*100000,100000),'0'),(([1]*99999+[9],1),'9'),(([9]*100000,100000),'9'*100000),(([9,8,7,6],2),'98')],encode=lambda x:f'{len(x[0])} {x[1]}\n'+ ' '.join(map(str,x[0]))+'\n',oracle=subsequence_oracle,
 code='''def solve(data):
    n,k=map(int,data[:2]); remove=n-k; stack=[]
    for digit in data[2:]:
        while remove and stack and stack[-1]<digit:stack.pop(); remove-=1
        stack.append(digit)
    return ''.join(stack[:k]).lstrip('0') or '0'
''',mutants=[('错误选择较小前缀','stack[-1]<digit','stack[-1]>digit'),('重复数字也删除','stack[-1]<digit','stack[-1]<=digit')]),
dict(id=13,title='最接近预算的披萨订单',tags=['枚举'],desc='恰好买一份披萨，并选择 0、1 或 2 种配料，每种配料最多选一次。求总价最接近预算的订单价格。差值相同时选更低价格。不同下标是不同的配料种类，即使价格相同。',input='第一行 n m x，分别为披萨种数、配料种数和预算（1≤n≤10，0≤m≤10，1≤x≤10000）。第二行 n 个披萨价格；第三行 m 个配料价格（m=0 时可为空行）。所有价格 1..10000，配料总价不超过10000。',idea='枚举每份披萨，以及不加配料、加一种和加两种不同下标配料。用 (绝对差值, 总价) 比较候选。',proof='任何合法订单都恰好包含一份披萨和一个大小不超过 2 的配料集合，枚举完整覆盖这些集合且不重复使用同一种配料。比较规则先最小差值后最小价格，与题意一致。',complexity='时间 O(nm²+n)，额外空间 O(m²+1)。',samples=[([800,850,900],[100,150],1000),([1100,900],[200],1000),([800],[100],1000)],random=lambda r:([r.randint(1,30) for _ in range(r.randint(1,4))],[r.randint(1,15) for _ in range(r.randint(0,6))],r.randint(1,60)),edges=[(([10000]*10,[1000]*10,10000),'10000'),(([1],[],10000),'1'),(([10],[5,5],20),'20')],encode=lambda x:f'{len(x[0])} {len(x[1])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',oracle=pizza_oracle,
 code='''def solve(data):
    n,m,target=map(int,data[:3]); pizzas=list(map(int,data[3:3+n])); toppings=list(map(int,data[3+n:])); answer=pizzas[0]
    for pizza in pizzas:
        extras=[0]+toppings+[toppings[i]+toppings[j] for i in range(m) for j in range(i+1,m)]
        for extra in extras:
            cost=pizza+extra
            if (abs(cost-target),cost)<(abs(answer-target),answer):answer=cost
    return str(answer)
''',mutants=[('允许同种配料两份','range(i+1,m)','range(i,m)'),('只允许一种配料','range(i+1,m)','range(m,m)')]),
dict(id=14,title='数字和为 S 的四位代码',tags=['动态规划'],desc='四位代码从 0000 到 9999，允许前导零。给定 S，求四个数字之和等于 S 的代码数量。',input='输入整数 S（0..36）。',idea='dp[s] 记录已填写若干位后数字和为 s 的数量。每填一位，把每个旧状态向添加数字 0..9 的状态转移。',proof='初始只有空代码一种、数字和为零。每个长度加一的代码都唯一来自删除最后一位得到的旧代码和该末位数字，因此转移不会重计或漏计。完成四位后的 dp[S] 就是答案。',complexity='时间 O(4×37×10)，额外空间 O(37)。',samples=[35,4,2],random=lambda r:r.randint(0,36),edges=[(i,str(CODE_COUNTS[i])) for i in range(37)],encode=lambda s:str(s)+'\n',oracle=lambda s:str(CODE_COUNTS[s]),
 code='''def solve(data):
    target=int(data[0]); dp=[0]*37; dp[0]=1
    for position in range(4):
        next_dp=[0]*37
        for total in range(37):
            for digit in range(10):
                if total+digit<37:next_dp[total+digit]+=dp[total]
        dp=next_dp
    return str(dp[target])
''',mutants=[('只填三位','range(4)','range(3)'),('漏掉数字9','range(10)','range(9)')]),
dict(id=16,title='嵌套加减表达式求值',tags=['栈','解析'],desc='表达式是整数，或 add(x,y)、sub(x,y)，参数也可以是表达式。add 表示加法，sub 表示前者减后者。输入合法，允许符号之间出现空格，整数可为负数。求结果。',input='一行表达式，长度 1..200000。整数和最终结果均在32位有符号整数范围内；使用足够宽的整数保存中间值。整数内部不含空格。',idea='词法扫描出 add、sub、有符号整数和右括号。用操作栈和数值栈，在右括号出现时弹出两个值完成一次运算，避免深层递归。',proof='遇到右括号时，其两个参数的子表达式已经完成求值，数值栈顶依次是右参数和左参数。按最近未完成操作计算并压回，等价替换整个子表达式。自内向外消去全部运算后只剩总结果。',complexity='时间 O(L)，额外空间 O(L)。',samples=[('add(1,sub(1,0))',2),('add(sub(5,2),sub(1,4))',0),('sub(add(7,8),sub(3,1))',13)],random=expression,edges=[(('add(1,'*20000+'0'+')'*20000,20000),'20000'),(('-2147483648',-2147483648),'-2147483648'),(('sub(-1,-5)',4),'4')],encode=lambda x:x[0]+'\n',oracle=lambda x:str(x[1]),
 code='''def solve(data):
    import re
    expression=' '.join(data); operations=[]; values=[]
    for token in re.findall(r'add|sub|-?\\d+|\\)',expression):
        if token in ('add','sub'):operations.append(token)
        elif token==')':
            right=values.pop(); left=values.pop(); op=operations.pop()
            values.append(left+right if op=='add' else left-right)
        else:values.append(int(token))
    return str(values[0])
''',mutants=[('减法顺序相反','else left-right','else right-left'),('把减法当加法','else left-right','else left+right')]),
dict(id=18,title='每栋房屋最近的商店',tags=['排序','二分查找'],desc='房屋和商店位于一维数轴上。对每栋房屋返回距离最近的商店位置，距离相同时返回位置较小者。允许重复位置，结果按房屋原始顺序输出。',input='第一行 n m（1..100000），第二行 n 个房屋位置，第三行 m 个商店位置；位置都是 0..10⁹ 的整数。',idea='排序商店位置。二分查找每栋房屋的插入位置，只需比较左右相邻商店。',proof='位于房屋左边的商店中最靠右者距离最小，右边同理；任何其它商店都不会更近。比较这两个候选并按位置打破平局即可。',complexity='时间 O(m log m+n log m)，额外空间 O(m+n)。',samples=[([5,10,17],[1,5,20,11,16]),([2,4,2],[5,1,2,3]),([4,8,1,1],[5,3,1,2,6])],random=lambda r:([r.randint(0,30) for _ in range(r.randint(1,8))],[r.randint(0,30) for _ in range(r.randint(1,8))]),edges=[(([10**9]*100000,[0]),' '.join(['0']*100000)),(([0],[10**9]*100000),str(10**9)),(([5],[0,10]),'0')],encode=lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',oracle=houses_oracle,
 code='''def solve(data):
    import bisect
    n,m=map(int,data[:2]); houses=list(map(int,data[2:2+n])); stores=sorted(map(int,data[2+n:])); result=[]
    for house in houses:
        index=bisect.bisect_left(stores,house); candidates=[]
        if index<m:candidates.append(stores[index])
        if index>0:candidates.append(stores[index-1])
        result.append(str(min(candidates,key=lambda s:(abs(s-house),s))))
    return ' '.join(result)
''',mutants=[('平局选较大位置','abs(s-house),s','abs(s-house),-s'),('只看最小商店','index=bisect.bisect_left(stores,house)','index=0')]),
dict(id=19,title='最长一致日志片段',tags=['滑动窗口','计数'],desc='给定玩家编号数组。先求整个数组里所有出现过的玩家的最小出现次数 k。寻找最长连续子数组，使其中出现次数最多的玩家恰好出现 k 次。输出其长度。',input='第一行 n（1..10000），第二行 n 个玩家编号。本站评测约定编号为 1..10⁹ 的整数。',idea='用滑动窗口维护所有玩家出现次数不超过 k。加入新玩家后，若其次数超过 k，则移动左端直到合法，记录最长窗口。',proof='对于“所有频数≤k”的条件，合法窗口的左端可以单调移动，因此滑窗找到最大长度。其最大窗口必含频数恰为 k 的玩家：否则若不是全数组可继续扩展；若是全数组，至少一个玩家的全局频数就是 k。因此该最大长度满足原题的等号条件。',complexity='时间 O(n)，额外空间 O(n)。',samples=[[1,2,1,3,4,2,4,3,3,4],[1,2,3],[7,7,7]],random=lambda r:[r.randint(1,4) for _ in range(r.randint(1,10))],edges=[([1]*10000,'10000'),(list(range(1,10001)),'10000'),([1,1,1,2],'2')],encode=array_input,oracle=logs_oracle,
 code='''def solve(data):
    from collections import Counter
    a=list(map(int,data[1:])); limit=min(Counter(a).values()); counts=Counter(); left=0; answer=0
    for right,value in enumerate(a):
        counts[value]+=1
        while counts[value]>limit:counts[a[left]]-=1; left+=1
        answer=max(answer,right-left+1)
    return str(answer)
''',mutants=[('强制全部不重复','limit=min(Counter(a).values())','limit=1'),('使用全局最大频数','limit=min(Counter(a).values())','limit=max(Counter(a).values())')]),
dict(id=20,title='子数组的最小值加最大值',tags=['观察','贪心'],desc='给定正整数数组，选择长度至少为 2 的连续子数组，最大化其中最小值与最大值的和。输出这个最大和。',input='第一行 n（2..100000），第二行 n 个正整数（1..10⁹）。',idea='只需枚举每一对相邻元素，取它们的和的最大值。',proof='任取一个合法区间，取其中最大元素 M，它在区间内至少有一个相邻元素 x。因为 x 不小于整个区间的最小值 m，所以这对相邻元素的和 M+x≥M+m。因而任意长区间都不优于某个长度为 2 的区间。',complexity='时间 O(n)，除输入外额外空间 O(1)。',samples=[[4,6,2,8,10],[6,2,9,1,7],[5,5]],random=lambda r:[r.randint(1,30) for _ in range(r.randint(2,10))],edges=[([10**9]*100000,str(2*10**9)),([100,1,100],'101'),([1,2],'3')],encode=array_input,oracle=minmax_oracle,
 code='''def solve(data):
    a=list(map(int,data[1:])); return str(max(a[i]+a[i+1] for i in range(len(a)-1)))
''',mutants=[('错误使用全局最大两项','max(a[i]+a[i+1] for i in range(len(a)-1))','sum(sorted(a)[-2:])'),('只求全局最小加最大','max(a[i]+a[i+1] for i in range(len(a)-1))','min(a)+max(a)')]),
]


def execute(file,stdin):
    result=subprocess.run([sys.executable,'-I',str(file)],input=stdin,text=True,capture_output=True,timeout=8,check=True)
    return result.stdout.strip()


def main():
    for folder in ('packages','editorials','references','oracles','mutants','batches','validation'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    catalog=json.loads((ROOT/'content/oa-master/catalog.json').read_text()); sources={x['id']:x for x in catalog['items']}; registry=[]; reports=[]
    for spec in SPECS:
        identifier=f"oa-google-{spec['id']}"; rng=random.Random(20260914+spec['id'])
        code=textwrap.dedent(spec['code'])+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        reference=OUT/'references'/f'{identifier}.py'; reference.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)]
        oracles=[]
        for value in values:
            expected=spec['oracle'](value); stdin=spec['encode'](value)
            assert execute(reference,stdin)==expected,(identifier,value,expected)
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        tests=oracles[:3]+[dict(input=spec['encode'](x),expectedOutput=y+'\n') for x,y in spec['edges']]+oracles[3:27]
        cases=[]
        for i,test in enumerate(tests):
            assert execute(reference,test['input'])==test['expectedOutput'].strip(),(identifier,i)
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**test,hidden=i>=3,weight=1))
        mutants=[]; kills=[]
        for label,old,new in spec['mutants']:
            assert old in code
            mutation=code.replace(old,new); temp=OUT/'references'/f'{identifier}-mutation.py'; temp.write_text(mutation)
            rejected=[i for i,c in enumerate(cases) if execute(temp,c['input'])!=c['expectedOutput'].strip()]
            temp.unlink(); assert rejected,(identifier,label,'survived')
            mutants.append(dict(name=label,code=mutation)); kills.append(dict(name=label,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Google']+spec['tags'],description=spec['desc']+'\n\n输入格式、样例与评测数据由 CSWork 整理编写。',input=spec['input'],output='按题意输出答案；多项结果按顺序以空格分隔。',explanation='样例输入输出直接遵循上述规则；完整算法见题解。',hints=[spec['idea']],timeLimit=3,memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        raw=dict(schemaVersion=1,problem=problem,cases=cases)
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 为什么正确\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        authored=[dict(language='python',code=code)]
        for folder,document in [('packages',json.loads(normalized)),('oracles',oracles),('mutants',mutants),('editorials',dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=authored,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork'))]:
            (OUT/folder/f'{identifier}.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
        registry.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=authored))
        reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=kills,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracles),'oracle checks;',len(cases),'judge cases; 2 mutants rejected',flush=True)
    (OUT/'batches/google-next.json').write_text(json.dumps(dict(schemaVersion=1,items=registry),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation/google-next.json').write_text(json.dumps(dict(schemaVersion=1,seed=20260914,problems=reports,skipped={'oa-google-11':'样例把连续区间未覆盖缺口视作覆盖，语义矛盾。','oa-google-12':'小写字母及下划线约定与大写和空格样例不一致。','oa-google-15':'样例1解释错误：半径1不能触发距离2的炸弹。'},note='Local authored-code checks only; sandbox acceptance is a separate release gate.'),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
