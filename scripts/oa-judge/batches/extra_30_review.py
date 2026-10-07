"""Source-bound review of 30 remaining OA-Master entries.

Only candidate artifacts are written. This generator never edits coverage or the
runtime registry, and never runs upstream solutions or a production judge.
"""
from collections import Counter, deque, OrderedDict
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys

import amazon_remaining_h as helper

ROOT = helper.ROOT
OUT = ROOT / 'content/oa-judge'
BATCH = 'extra-30-review'
SOURCE_COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SEED = 20261006
SPECS = []


def add(company, number, title, description, limits, output, idea, proof,
        complexity, encode, oracle, reference, mutants, samples, random_case,
        bound=1000000):
    SPECS.append(dict(company=company, number=number, title=title,
                      description=description, limits=limits, output=output,
                      idea=idea, proof=proof, complexity=complexity,
                      encode=encode, oracle=oracle, reference=reference,
                      mutants=mutants, samples=samples,
                      random=random_case, bound=bound))


def arr(values):
    return f'{len(values)}\n' + ' '.join(map(str, values)) + '\n'


def arrange_coins_encode(coins):
    return f'{len(coins)}\n' + ' '.join(map(str, coins)) + '\n'


def arrange_coins_oracle(coins):
    # Deliberately use a direct staircase simulation, independent from the
    # binary-search implementation used by the reference solution.
    result = []
    for value in coins:
        rows = 0
        next_row_cost = 1
        remaining = value
        while remaining >= next_row_cost:
            remaining -= next_row_cost
            rows += 1
            next_row_cost += 1
        result.append(rows)
    return ' '.join(map(str, result))


add('alarm', 1, 'Arrange Coins',
    '给定若干非负整数 coins。对每个 n，从第一行开始按顺序摆放硬币：第 1 行需要 1 枚、第 2 行需要 2 枚，以此类推。只有填满的行才计入结果；求每个 n 最多能填满多少行。',
    '第一行是数组长度 N，第二行是 N 个整数。本站约束：1≤N≤100000，0≤coins[i]≤10^9。',
    '输出 N 个整数，依次表示每个 coins[i] 能填满的行数。',
    '对每个 n，找到最大的 k，使 1+2+…+k = k(k+1)/2 ≤ n。可对 k 二分；判断中使用整数乘法避免浮点舍入。',
    '若 k 行已填满，恰好消耗 k(k+1)/2 枚；因此可填满的行数正是满足该不等式的最大非负整数。二分搜索单调的三角数即可唯一求得每个结果。',
    '设 N 为数组长度。时间 O(N log C)，空间 O(N)，其中 C=max(coins)。',
    arrange_coins_encode, arrange_coins_oracle,
    '''def solve(raw):
    values = list(map(int, raw.split()))
    n, coins = values[0], values[1:]
    if len(coins) != n:
        raise ValueError("expected N coin counts")
    result = []
    for coins_count in coins:
        lo, hi = 0, 1
        while hi * (hi + 1) // 2 <= coins_count:
            hi *= 2
        while lo + 1 < hi:
            mid = (lo + hi) // 2
            if mid * (mid + 1) // 2 <= coins_count:
                lo = mid
            else:
                hi = mid
        result.append(str(lo))
    return " ".join(result)
''', [
        ('把 sqrt(2n) 当作完整行数',
         'if mid * (mid + 1) // 2 <= coins_count:',
         'if mid * mid <= 2 * coins_count:'),
        ('把未填满的下一行也计为完整',
         'mid * (mid + 1) // 2 <= coins_count',
         'mid * (mid + 1) // 2 < coins_count')],
    [[3, 4, 6], [0, 1, 2, 3, 5, 8, 10], [999999999, 1000000000]],
    lambda r: [r.randint(0, 10**6) for _ in range(r.randint(1, 24))],
    bound=1200000)


def geico_bridge_encode(case):
    limit, weights = case
    return f'{limit}\n{len(weights)}\n' + ' '.join(map(str, weights)) + '\n'


def geico_bridge_oracle(case):
    limit, weights = case
    best = 0
    for mask in range(1 << len(weights)):
        kept = [weights[i] for i in range(len(weights)) if mask >> i & 1]
        if all(w<=limit for w in kept) and all(kept[i - 1] + kept[i] <= limit for i in range(1, len(kept))):
            best = max(best, len(kept))
    return len(weights) - best


add('geico', 1, 'Bridge Weight Limit — Minimum Drivers Turn Back',
    '保留原队列的一个子序列，使保留序列中每对相邻车辆的重量和不超过桥梁上限 U。输出最少需要离开的司机数。单车重量超过 U 的车辆也必须离开。',
    '输入 U、N、N 个车辆重量。1≤N≤100000，1≤weight[i],U≤10^9。',
    '输出最少离开的司机数。',
    '对每辆车 i，计算以 i 结尾的最长安全子序列：dp[i]=1+max(dp[j])，其中 j<i 且 weight[j]≤U−weight[i]。对重量坐标压缩后用 Fenwick 树维护前缀最大值。若 weight[i]>U，则不能保留。',
    '任意安全保留子序列按原顺序排列；其最后一辆车的前驱必为更早且重量满足阈值的保留车。递推枚举所有可能前驱并取最大值，Fenwick 树只加速该前缀最大查询，因此得到最大可保留数，补集大小即最少离开数。',
    '时间 O(N log N)，空间 O(N)。', geico_bridge_encode, geico_bridge_oracle,
    '''def solve(raw):
    from bisect import bisect_right
    values=list(map(int,raw.split()));limit,n=values[:2];weights=values[2:2+n]
    coords=sorted(set(weights));tree=[0]*(len(coords)+1);best=0
    def query(i):
        value=0
        while i:
            value=max(value,tree[i]);i-=i&-i
        return value
    def update(i,value):
        while i<len(tree):
            tree[i]=max(tree[i],value);i+=i&-i
    for weight in weights:
        if weight<=limit:
            prior=query(bisect_right(coords,limit-weight))
            length=prior+1;update(bisect_right(coords,weight),length);best=max(best,length)
    return str(n-best)
''', [
        ('忽略相邻车辆重量之和','prior=query(bisect_right(coords,limit-weight))','prior=query(len(coords))'),
        ('错误地允许超重单车上桥','if weight<=limit:','if True:')],
    [(9,[5,3,8,1,8,7,7,6]),(7,[7,6,5,2,7,4,5,4]),(7,[3,4,3,1]),(2,[3,7,5,5,6,3,9,10,8,4])],
    lambda r:(r.randint(1,18),[r.randint(1,18) for _ in range(r.randint(1,10))]),
    bound=2500000)


def harvey_encode(case):
    return '\n'.join(case)+'\n'


def harvey_oracle(commands):
    cells={};out=[]
    def has_cycle(start):
        active=set();done=set()
        def visit(label):
            if label in active:return True
            if label not in cells or label in done:return False
            active.add(label)
            found=any(visit(part.strip()) for part in cells[label].split('+') if not part.strip().isdigit())
            active.remove(label);done.add(label);return found
        return visit(start)
    def eval_cell(label,active):
        if label not in cells or label in active:raise ValueError
        return sum(int(part.strip()) if part.strip().isdigit() else eval_cell(part.strip(),active|{label}) for part in cells[label].split('+'))
    for command in commands:
        op,rest=command.split(' ',1)
        if op=='GET':
            try: out.append(str(eval_cell(rest.strip(),set())))
            except (ValueError,RecursionError): out.append('ERROR')
        else:
            label,expr=rest.split(' ',1);old=cells.get(label);cells[label]=expr
            try:
                if has_cycle(label):raise ValueError
                out.append('OK')
            except (ValueError,RecursionError):
                if old is None: cells.pop(label,None)
                else: cells[label]=old
                out.append('ERROR')
    return '\n'.join(out)


add('harvey', 2, 'Spreadsheet Formula Evaluator',
    '实现 SET label expression 与 GET label。表达式仅由非负整数和单元格标签通过加号相连。SET 若会形成依赖环则拒绝并保持原值；GET 对未设置或引用链不可求值的单元格返回 ERROR。',
    '每行一条命令，最多1000条且最多300个不同标签；标签为大写字母后接数字；加法表达式最多50项，字面量≤10^9，所有可求值结果保证在有符号64位整数范围内。引用未设置单元格不构成环，GET 时返回 ERROR。',
    '每条命令输出 OK、ERROR 或整数。',
    '暂存 SET 后沿依赖图 DFS 检测是否能回到被赋值单元格；若有环恢复旧值，否则提交。GET 按当前定义递归求和，并缓存仅在本次读取中的中间结果。',
    '加法式的依赖图中出现环，当且仅当某次递归访问到当前路径上的节点。SET 暂存后从该标签开始 DFS 足以检查新建环；恢复旧定义可保证拒绝操作不改变状态。GET 递归使用同一环检测，因此未定义引用也能返回 ERROR。',
    '设单元格数为 V、引用总数为 E；每条命令 O(V+E)，空间 O(V+E)。',
    harvey_encode, harvey_oracle,
'''def solve(raw):
    commands=raw.splitlines();cells={};out=[]
    def cyclic(start):
        active=set();done=set()
        def visit(label):
            if label in active:return True
            if label not in cells or label in done:return False
            active.add(label);found=any(visit(t.strip()) for t in cells[label].split('+') if not t.strip().isdigit());active.remove(label);done.add(label);return found
        return visit(start)
    def evaluate(label,active,memo):
        if label not in cells or label in active:raise ValueError
        if label in memo:return memo[label]
        active.add(label);value=sum(int(t.strip()) if t.strip().isdigit() else evaluate(t.strip(),active,memo) for t in cells[label].split('+'));active.remove(label);memo[label]=value;return value
    for command in commands:
        if not command:continue
        op,rest=command.split(' ',1)
        if op=='GET':
            try:out.append(str(evaluate(rest.strip(),set(),{})))
            except (ValueError,RecursionError):out.append('ERROR')
        else:
            label,expr=rest.split(' ',1);old=cells.get(label);cells[label]=expr
            try:
                if cyclic(label):raise ValueError
                out.append('OK')
            except (ValueError,RecursionError):
                if old is None:cells.pop(label,None)
                else:cells[label]=old
                out.append('ERROR')
    return '\\n'.join(out)
''', [
        ('接受造成环的赋值','if cyclic(label):raise ValueError','if False:raise ValueError'),
        ('GET 未设置单元格时返回 0','if label not in cells or label in active:raise ValueError','if label in active:raise ValueError\n        cells.setdefault(label,\'0\')')],
    [['SET A1 7','GET A1'],['SET A1 B1','GET A1','SET B1 4','GET A1'],['SET A1 B1','SET B1 A1','GET A1']],
    lambda r: (lambda cmds:cmds)(['SET A1 '+str(r.randint(0,20))]+[r.choice(['GET A1','SET B1 A1+1','GET B1','SET A1 B1+2']) for _ in range(r.randint(1,7))]),
    bound=12000)


def othello_encode(s):return s+'\n'


def othello_oracle(transcript):
    board=['B','W']
    for turn,side in enumerate(transcript):
        color='B' if turn%2==0 else 'W'
        if side=='L':
            board.insert(0,color)
            try: target=board.index(color,1)
            except ValueError: continue
            for i in range(1,target):board[i]=color
        else:
            board.append(color)
            try: target=len(board)-2-board[-2::-1].index(color)
            except ValueError: continue
            for i in range(target+1,len(board)-1):board[i]=color
    return f'{board.count("B")} {board.count("W")}'


add('money-forward', 2, 'Count Tiles in 1D Othello',
    '初始棋盘从左到右为黑、白棋。转录每个字符为一次落子：第1、3、5…步落黑棋，第2、4、6…步落白棋；L/R 表示落在当前棋串左/右端。落子后若沿该方向存在最近的同色棋子，就翻转新棋子与它之间的全部棋子；否则不翻转。输出终局黑白棋数量。',
    '输入仅含 L、R 的转录字符串，长度1..3000。每步必落子。',
    '输出黑棋数和白棋数，以一个空格分隔。',
    '按转录逐步模拟一维棋盘。在落子方向上寻找最近的同色棋子，翻转其与新棋子之间的棋子。',
    '每个转录字符唯一确定落子颜色和棋盘端点。题目规定只有最近同色棋子存在时才翻转中间区间；逐步维护整个棋串因而与规则完全一致。',
    '时间 O(|S|²)，空间 O(|S|)；本站将长度限制在3000以适配直接模拟。',
    othello_encode, othello_oracle,
    '''def solve(raw):
    transcript=raw.strip();board=['B','W']
    for turn,side in enumerate(transcript):
        color='B' if turn%2==0 else 'W'
        if side=='L':
            board.insert(0,color)
            try:target=board.index(color,1)
            except ValueError:continue
            for i in range(1,target):board[i]=color
        else:
            board.append(color)
            try:target=len(board)-2-board[-2::-1].index(color)
            except ValueError:continue
            for i in range(target+1,len(board)-1):board[i]=color
    return f'{board.count("B")} {board.count("W")}'
''', [
        ('完全不翻转棋子','for i in range(1,target):board[i]=color','for i in range(1,target):pass'),
        ('所有回合都落黑棋','color=\'B\' if turn%2==0 else \'W\'','color=\'B\'')],
    ['L','R','LRRL'],
    lambda r: ''.join(r.choice('LR') for _ in range(r.randint(1,14))),
    bound=4000)


def zalando_encode(s):return s+'\n'


def zalando_oracle(s):
    seen={s};queue=[s];terminal=set()
    for cur in queue:
        moves=[]
        for i in range(len(cur)-1):
            if cur[i] in 'AB' and cur[i+1] in 'AB' and cur[i]!=cur[i+1]:moves.append(cur[:i]+cur[i+2:])
            if cur[i] in 'CD' and cur[i+1] in 'CD' and cur[i]!=cur[i+1]:moves.append(cur[:i]+cur[i+2:])
        if not moves:terminal.add(cur)
        for nxt in moves:
            if nxt not in seen:seen.add(nxt);queue.append(nxt)
    assert len(terminal)==1
    return next(iter(terminal))


add('zalando', 2, 'Zalando Manipulation',
    '字符串只包含 A、B、C、D。可反复删除相邻且分别为 A/B 或 C/D 的两个字符，顺序不限。输出任意无法继续删除的结果。',
    '输入一行字符串，长度0..250000，只含 A、B、C、D。',
    '输出任一 irreducible 字符串；空结果输出空行。',
    '从左到右维护栈。若新字符与栈顶构成 A/B 或 C/D 的异类配对则弹栈，否则压栈。',
    '规则等价于两组互逆符号 A↔B、C↔D 的相邻约简。栈算法只保留已处理前缀的约简形式；新字符至多与栈顶消去，递归消去已由栈处理。该逆元字母表的约简形式唯一，因此输出是合法且不可再约简的结果。',
    '时间 O(N)，空间 O(N)。', zalando_encode, zalando_oracle,
    '''def solve(raw):
    stack=[]
    for ch in raw.strip():
        if stack and ((stack[-1] in 'AB' and ch in 'AB' and stack[-1]!=ch) or (stack[-1] in 'CD' and ch in 'CD' and stack[-1]!=ch)):
            stack.pop()
        else:stack.append(ch)
    return ''.join(stack)
''', [
        ('漏掉 C/D 配对消除','stack[-1] in \'CD\' and ch in \'CD\'','False'),
        ('只接受 A 后接 B','stack[-1]!=ch','stack[-1]==\'A\' and ch==\'B\'')],
    ['CBACD','CABABD','ACBDACBD'],
    lambda r: ''.join(r.choice('ABCD') for _ in range(r.randint(0,12))),
    bound=250002)


def juspay_encode(edges):return str(len(edges))+'\n'+' '.join(map(str,edges))+'\n'


def juspay_oracle(edges):
    best=-1
    for start in range(len(edges)):
        path=[];where={};node=start
        while node!=-1 and node not in where:
            where[node]=len(path);path.append(node);node=edges[node]
        if node!=-1:best=max(best,sum(path[where[node]:]))
    return best


add('juspay', 1, 'Converging Maze: Largest Sum Cycle',
    '每个编号0..N−1的格子至多有一个单向出口 edge[i]；edge[i]=−1 表示没有出口。输出所有有向环中节点编号和的最大值；无环时输出−1。',
    '第一行 N（1..200000），第二行 N 个整数，取值为 −1 或 [0,N−1]。',
    '输出最大环节点编号和，或 −1。',
    '逐个起点沿唯一后继前进，记录当前路径中每个节点的下标；再次遇到当前路径节点时，计算新环节点和。整轮完成后标记路径已处理。',
    '函数图中的每个节点出度至多为1。当前路径重复节点恰好切出一个有向环；不同已完成路径不会再发现新环。每个节点只进入一次工作路径，因此所有环均被检查一次并取最大值。',
    '时间 O(N)，空间 O(N)。', juspay_encode, juspay_oracle,
    '''def solve(raw):
    v=list(map(int,raw.split()));n=v[0];edges=v[1:1+n];done=[False]*n;best=-1
    for start in range(n):
        if done[start]:continue
        path=[];index={};node=start
        while node!=-1 and not done[node] and node not in index:
            index[node]=len(path);path.append(node);node=edges[node]
        if node!=-1 and node in index:best=max(best,sum(path[index[node]:]))
        for u in path:done[u]=True
    return str(best)
''', [
        ('漏加环的最后一个节点','sum(path[index[node]:])','sum(path[index[node]:-1])'),
        ('只取遇到的第一个环','best=max(best,sum(path[index[node]:]))','best=sum(path[index[node]:])')],
    [[4,4,1,4,13,8,8,8,0,8,14,9,15,11,-1,10,15,22,22,22,22,22,21],[-1],[1,0,3,2]],
    lambda r:[(lambda n:[r.choice([-1]+list(range(n))) for _ in range(n)])(r.randint(1,10))][0],
    bound=1400000)


def happy_encode(case):
    n,m,p=case;return f'{n}\n{m}\n'+' '.join(map(str,p))+'\n'


def happy_oracle(case):
    n,m,p=case;occupied=set()
    for day,house in enumerate(p,1):
        occupied.add(house)
        if any(all(x in occupied for x in range(start,start+m)) for start in range(1,n-m+2)):
            return day
    raise AssertionError('permutation must eventually occupy every length-M interval')


def happy_random(r):
    n=r.randint(1,12);return n,r.randint(1,n),r.sample(range(1,n+1),n)


add('hackerearth', 1, 'Happy Neighbourhood',
    '房子编号1..N，按给定排列依次有人入住。找最早的第几天，使某段包含 M 个房子的连续区间全部入住。',
    '输入 N、M 和长度为 N 的排列。1≤N≤100000，1≤M≤N。',
    '输出首次出现长度为 M 的全已入住连续区间的天数。',
    '记录每个房子的入住日。对每个连续长度 M 的窗口取入住日最大值，再对所有窗口取最小值。',
    '某窗口全部入住的最早一天等于其中最后入住的房子的入住日，即窗口入住日最大值。枚举所有窗口并取最小值恰好得到首次满足条件的日期。',
    '时间 O(N)，空间 O(N)。', happy_encode, happy_oracle,
    '''def solve(raw):
    from collections import deque
    v=list(map(int,raw.split()));n,m=v[:2];p=v[2:2+n];day=[0]*(n+1)
    for i,x in enumerate(p,1):day[x]=i
    q=deque();answer=n
    for i in range(1,n+1):
        while q and day[q[-1]]<=day[i]:q.pop()
        q.append(i)
        while q and q[0]<=i-m:q.popleft()
        if i>=m:answer=min(answer,day[q[0]])
    return str(answer)
''', [
        ('窗口日取最小而非最大','answer=min(answer,day[q[0]])','answer=min(answer,min(day[i] for i in range(max(1,q[0]-m+1),q[0]+1)))'),
        ('错误地输出窗口起点编号','answer=min(answer,day[q[0]])','answer=min(answer,q[0])')],
    [(3,1,[3,2,1]),(10,8,[8,4,9,10,3,1,7,2,6,5]),(20,2,[16,12,14,7,11,13,15,4,1,20,9,3,10,8,6,2,17,19,18,5]),(5,5,[5,4,1,2,3])],
    happy_random,
    bound=2000000)


def prom_encode(case):
    return f'{len(case)}\n{case}\n'


def prom_oracle(s):
    girls=[];answers=[]
    for i,ch in enumerate(s,1):
        if ch=='0':girls.append(i)
        else:answers.append(girls.pop() if girls else -1)
    return ' '.join(map(str,answers))


def prom_random(r):
    return ''.join(r.choice('01') for _ in range(r.randint(1,25)))


add('hackerearth', 2, 'The Prom',
    '按从左到右的顺序处理队伍。0 表示女生，1 表示男生。每个男生和此时排在他前面且尚未配对的最近一位女生跳舞；双方离队。没有可配对女生时记录 -1。按男生出现顺序输出配对女生的编号。',
    '输入 N 和长度 N 的 01 字符串，1≤N≤100000。',
    '输出每个男生对应的女生编号；无可配对女生时输出 -1，空结果输出空行。',
    '用栈保存尚未配对的女生编号。遇到男生弹出栈顶，没有女生时输出 -1。',
    '离队后仍在队伍中的女生保持原先次序，因此最近的未配对前置女生恰为栈顶。每位女生只入栈、出栈一次，逐男生处理即得到所有配对。',
    '时间 O(N)，空间 O(N)。', prom_encode, prom_oracle,
    '''def solve(raw):
    v=raw.split();n=int(v[0]);s=v[1];girls=[];out=[]
    for i,ch in enumerate(s[:n],1):
        if ch=='0':girls.append(i)
        else:out.append(str(girls.pop() if girls else -1))
    return ' '.join(out)
''', [
        ('错误地选择最早等待的女生','girls.pop()','girls.pop(0)'),
        ('没有女生时错误输出0','out.append(str(girls.pop() if girls else -1))','out.append(str(girls.pop() if girls else 0))')],
    [('011'),('10001111110'),('0000100')], prom_random,
    bound=200010)


def flips_encode(case):
    n,edges,initial,expected=case
    return f'{n}\n'+''.join(f'{a} {b}\n' for a,b in edges)+' '.join(map(str,initial))+'\n'+' '.join(map(str,expected))+'\n'


def flips_oracle(case):
    n,edges,initial,expected=case;adj=[[] for _ in range(n)]
    for a,b in edges:adj[a].append(b);adj[b].append(a)
    parent=[-2]*n;parent[0]=-1;order=[0]
    for u in order:
        for v in adj[u]:
            if parent[v]==-2:parent[v]=u;order.append(v)
    descendants=[]
    for u in range(n):
        sub=[];stack=[u]
        while stack:
            x=stack.pop()
            if x%2==u%2:sub.append(x)
            stack.extend(v for v in adj[x] if parent[v]==x)
        descendants.append(sub)
    best=n+1
    for mask in range(1<<n):
        state=initial[:]
        for u in range(n):
            if mask>>u&1:
                for v in descendants[u]:state[v]^=1
        if state==expected:best=min(best,mask.bit_count())
    return best


def flips_random(r):
    n=r.randint(1,9);edges=[(r.randrange(i),i) for i in range(1,n)];initial=[r.randrange(2) for _ in range(n)]
    expected=initial[:]
    for _ in range(r.randint(0,n)):expected[r.randrange(n)]^=1
    return n,edges,initial,expected


add('ukg', 1, 'Minimum Flips to Match Expected Binary Values in a Tree',
    '给定以0为根的无向树。对节点 u 执行操作会翻转 u 子树中编号奇偶性与 u 相同的所有节点。求最少操作次数，使 initial 全部变成 expected。',
    '输入 N（1..100000）、N−1 条 0-based 边、initial 和 expected 两个二进制数组。',
    '输出最少操作数。',
    '从根开始遍历。记录祖先操作分别对偶数编号、奇数编号节点造成的翻转奇偶数；当前节点仍不匹配时必须在此执行一次操作。',
    '节点 u 的值只会被其祖先中与 u 编号同奇偶的操作影响。遍历到 u 时这些影响已确定；若仍与目标不同，不在 u 操作便无法由任何后代影响 u，因此此操作是必要的。执行后递归更新同奇偶后代状态，得到唯一贪心方案。',
    '时间 O(N)，空间 O(N)。', flips_encode, flips_oracle,
'''def solve(raw):
    v=list(map(int,raw.split()));n=v[0];edges=[(v[1+2*i],v[2+2*i]) for i in range(n-1)];p=1+2*(n-1);initial=v[p:p+n];expected=v[p+n:p+2*n];adj=[[] for _ in range(n)]
    for a,b in edges:adj[a].append(b);adj[b].append(a)
    stack=[(0,-1,0,0)];answer=0
    while stack:
        u,parent,even_flip,odd_flip=stack.pop();parity=u%2;current=even_flip if parity==0 else odd_flip
        if initial[u]^current!=expected[u]:
            if parity==0:even_flip^=1
            else:odd_flip^=1
            answer+=1
        for child in adj[u]:
            if child!=parent:stack.append((child,u,even_flip,odd_flip))
    return str(answer)
''', [
        ('把操作应用到固定奇偶组','parity=u%2','parity=0'),
        ('不在节点值不匹配时执行操作','if initial[u]^current!=expected[u]:','if False:')],
    [(4,[(0,1),(0,2),(1,3)],[1,1,0,1],[0,1,1,0]),(5,[(0,1),(1,2),(0,3),(1,4)],[1,0,1,1,0],[1,1,0,1,1])],
    flips_random, bound=3000000)


def xor_encode(case):
    n,m,x=case;return f'{n} {m} {x}\n'


def xor_oracle(case):
    n,m,target=case;counts=[0]*64
    def visit(i,value):
        if i==n:
            if value==target:counts[0]+=1
            return
        for number in range(m+1):visit(i+1,value^number)
    visit(0,0);return counts[0]%998244353


add('xperi', 1, 'Count Integer Sequences',
    '统计长度 N 的整数序列数量。每个元素可取0..M，所有元素按位异或等于 X。答案对998244353取模。不同下标上的选择视为不同序列。',
    '输入 N M X；本站补充 1≤N≤100，0≤M≤50，0≤X≤63。',
    '输出序列数量模998244353。',
    '维护 0..63 的异或状态 DP。每增加一个元素，就把每个旧状态分别转移到 old XOR value，其中 value∈[0,M]。',
    'DP[i][x] 表示前 i 个位置异或为 x 的序列数。末尾元素取值唯一确定前一状态 x XOR value；逐值求和枚举所有合法末尾数，因此转移不重不漏。答案为 DP[N][X]。',
    '时间 O(N·64·(M+1))，空间 O(64)。', xor_encode, xor_oracle,
    '''def solve(raw):
    n,m,target=map(int,raw.split());mod=998244353;dp=[0]*64;dp[0]=1
    for _ in range(n):
        nxt=[0]*64
        for old,ways in enumerate(dp):
            for value in range(m+1):nxt[old^value]=(nxt[old^value]+ways)%mod
        dp=nxt
    return str(dp[target])
''', [
        ('不允许元素取0','for value in range(m+1):','for value in range(1,m+1):'),
        ('转移误用 OR 替代 XOR','nxt[old^value]','nxt[old|value]')],
    [(1,2,0),(2,1,1),(3,4,6)],
    lambda r:(r.randint(1,5),r.randint(0,5),r.randint(0,15)), bound=10000)


def schedule_encode(case):
    memory,kind,limit=case
    return f'{len(memory)} {limit}\n'+' '.join(map(str,memory))+'\n'+' '.join(map(str,kind))+'\n'


def schedule_oracle(case):
    memory,kind,limit=case;n=len(memory);memo={}
    def best(mask):
        if mask==0:return 0
        if mask in memo:return memo[mask]
        i=(mask&-mask).bit_length()-1;answer=best(mask^(1<<i))
        for j in range(i+1,n):
            if mask>>j&1 and kind[i]==kind[j] and memory[i]+memory[j]<=limit:
                answer=max(answer,1+best(mask^(1<<i)^(1<<j)))
        memo[mask]=answer;return answer
    return n-best((1<<n)-1)


def schedule_random(r):
    n=r.randint(1,9);limit=r.randint(2,16);return [r.randint(1,limit) for _ in range(n)],[r.randint(1,4) for _ in range(n)],limit


add('abaka-ai', 1, 'Task Scheduling (Parallel Same-Type with Memory Limit)',
    '每个任务耗时1。可将两个任务并行处理，当且仅当类型相同且两者内存和≤maxMemory；其余任务单独处理。求最短总处理时间。',
    '输入 N、maxMemory、N 个 taskMemory 和 N 个 taskType。1≤N≤200000，1≤taskMemory[i]≤maxMemory≤10^9，1≤taskType[i]≤10^9。本站限定每个任务可单独运行，即使其内存不适合与其他任务并行。',
    '输出最少时间单位数。',
    '按 taskType 分组。每组内存排序后从最小和最大开始配对；和不超过上限时成对并行，否则最大任务只能单独运行。',
    '若当前最大任务无法与该组最小任务配对，则它也无法与任一更大的任务配对，必须单独处理。若二者可配，最优方案可交换为这对而不减少配对数；反复执行即达到该组最大配对数，各组互不影响。',
    '时间 O(N log N)，空间 O(N)。', schedule_encode, schedule_oracle,
    '''def solve(raw):
    from collections import defaultdict
    v=list(map(int,raw.split()));n,limit=v[:2];memory=v[2:2+n];kind=v[2+n:2+2*n];groups=defaultdict(list)
    for m,t in zip(memory,kind):groups[t].append(m)
    pairs=0
    for values in groups.values():
        values.sort();left=0;right=len(values)-1
        while left<right:
            if values[left]+values[right]<=limit:pairs+=1;left+=1
            right-=1
    return str(n-pairs)
''', [
        ('未按类型分组','for m,t in zip(memory,kind):groups[t].append(m)','groups[0]=memory'),
        ('不检查并行内存上限','if values[left]+values[right]<=limit:pairs+=1;left+=1','pairs+=1;left+=1')],
    [([7,2,3,9],[1,2,1,3],10),([5,5,5],[1,1,1],10),([2,9],[3,3],10)],
    schedule_random, bound=2200000)


def power_encode(case):
    arr,power=case;return f'{len(arr)} {len(power)}\n'+' '.join(map(str,arr))+'\n'+' '.join(map(str,power))+'\n'


def power_oracle(case):
    values,positions=case
    def solve(rem):
        if not rem:return 0
        i=rem[0];best=0
        for k in range(1,len(rem)):
            j=rem[k];left,right=sorted((positions[i],positions[j]));gain=sum(values[left:right+1])
            best=max(best,gain+solve(rem[1:k]+rem[k+1:]))
        return best
    return solve(tuple(range(len(positions))))%1000000007


def power_random(r):
    n=r.randint(2,8);k=r.choice([2,4,6,8]);return [r.randint(0,9) for _ in range(n)],[r.randrange(n) for _ in range(k)]


add('abaka-ai', 2, 'Maximize the Power',
    'power 数组长度为偶数。每次任选其中两个位置值 x、y，获得 arr[min(x,y)..max(x,y)] 的闭区间和，然后删除这两个 power 元素。完成所有操作后最大化总收益并对10^9+7取模。',
    '输入 N、K，N 个非负 arr 值，再输入 K 个位置。本站补充 1≤N≤200000、2≤K≤2000 且 K 为偶数、每个位置在 [0,N−1]，arr[i]≤10^9。',
    '输出最大总收益模10^9+7。',
    '排序 power 位置，用前缀和计算区间贡献；从两端向内配对。',
    '将位置分成任意配对。对任意数组切分点，外侧配对使跨过该切分点的区间数达到每侧较小元素数的上界；由 arr 非负，所有切分点同时采用外侧配对可最大化加权区间和。故排序后首尾配对最优。',
    '时间 O(N+K log K)，空间 O(N+K)。', power_encode, power_oracle,
    '''def solve(raw):
    v=list(map(int,raw.split()));n,k=v[:2];a=v[2:2+n];p=sorted(v[2+n:2+n+k]);prefix=[0]
    for x in a:prefix.append(prefix[-1]+x)
    total=0
    for i in range(k//2):total+=prefix[p[k-1-i]+1]-prefix[p[i]]
    return str(total%1000000007)
''', [
        ('排序后相邻配对','for i in range(k//2):total+=prefix[p[k-1-i]+1]-prefix[p[i]]','for i in range(k//2):total+=prefix[p[2*i+1]+1]-prefix[p[2*i]]'),
        ('区间右端误用半开','prefix[p[k-1-i]+1]-prefix[p[i]]','prefix[p[k-1-i]]-prefix[p[i]]')],
    [([3,5,6,0,7],[3,1,0,2]),([1,2,3],[0,2]),([0,0],[1,0])],
    power_random, bound=5000000)


def beauty_encode(a):return arr(a)


def beauty_oracle(a):
    mod=1000000007;total=0
    for left in range(len(a)):
        for right in range(left+1,len(a)+1):
            ordered=sorted(a[left:right])
            if len(ordered)==1:total+=1
            else:total+=sum(ordered[i+1]-ordered[i]>1 for i in range(len(ordered)-1))
    return total%mod


def beauty_random(r):return [r.randint(1,10) for _ in range(r.randint(1,9))]


add('eat-club', 1, "Newton's Beautiful Sequence",
    '对原数组的每个非空连续子数组单独排序。排序后，每对相邻元素若差大于1，该子数组贡献加1；长度为1的子数组也贡献1。输出所有子数组贡献总和模10^9+7。',
    '输入 N 和 N 个整数。采用题面另列的约束 1≤N≤1000、1≤sequence[i]≤N；主约束行文本粘连，本站按该可读约束整理。',
    '输出总 beauty 模10^9+7。',
    '固定左端点逐步扩展右端，维护已出现值的位集合。插入新值时找到其前驱和后继，更新缺口大于1的相邻值对数；单元素子数组额外计1。',
    '排序后相邻不同值恰是值域有序集合中的相邻出现值。插入一个新值只可能拆开其前驱与后继之间的一个相邻关系，并加入与两侧的关系；位集合确定的前驱后继因此能增量准确维护每个子数组的 gap 贡献。枚举所有连续区间即得到总和。',
    '时间 O(N²) 次值域位运算，空间 O(N)。', beauty_encode, beauty_oracle,
    '''def solve(raw):
    v=list(map(int,raw.split()));n=v[0];a=v[1:1+n];total=0;mod=1000000007
    for left in range(n):
        mask=0;gaps=0
        for right in range(left,n):
            value=a[right];bit=1<<(value-1)
            if not mask&bit:
                below=mask&(bit-1);pred=below.bit_length();above=mask>>(value)
                succ=value+1+((above&-above).bit_length()-1) if above else None
                if pred and succ is not None and succ-pred>1:gaps-=1
                if pred and value-pred>1:gaps+=1
                if succ is not None and succ-value>1:gaps+=1
                mask|=bit
            length=right-left+1;total+=(1 if length==1 else gaps)
    return str(total%mod)
''', [
        ('漏掉长度为1子数组贡献','total+=(1 if length==1 else gaps)','total+=gaps'),
        ('把差大于1误写成差大于2','succ-pred>1','succ-pred>2')],
    [[2,2,2,1,5],[1],[1,3,2,3]], beauty_random, bound=2500000)


def castle_encode(case):
    rows,cols,walls,treasures,start,end=case
    lines=[f'{rows} {cols}',str(len(walls))]+[f'{r} {c}' for r,c in walls]
    lines += [str(len(treasures))]+[f'{r} {c}' for r,c in treasures]
    lines += [f'{start[0]} {start[1]}',f'{end[0]} {end[1]}']
    return '\n'.join(lines)+'\n'


def castle_oracle(case):
    rows,cols,walls,treasures,start,end=case;blocked=set(walls);loot=set(treasures)
    if start in blocked or end in blocked:return '-1 0'
    dist={start:0};q=deque([start]);dirs=((1,0),(-1,0),(0,1),(0,-1))
    while q:
        r,c=q.popleft()
        for dr,dc in dirs:
            nxt=(r+dr,c+dc)
            if not (0<=nxt[0]<rows and 0<=nxt[1]<cols) or nxt in blocked:continue
            if nxt not in dist:dist[nxt]=dist[(r,c)]+1;q.append(nxt)
    if end not in dist:return '-1 0'
    best=0
    def paths(at,seen_treasures):
        nonlocal best
        if at==end:best=max(best,len(seen_treasures));return
        for dr,dc in dirs:
            nxt=(at[0]+dr,at[1]+dc)
            if nxt in dist and dist[nxt]==dist[at]+1:paths(nxt,seen_treasures|({nxt} if nxt in loot else set()))
    paths(start,{start} if start in loot else set())
    return f'{dist[end]} {best}'


def castle_random(r):
    rows=r.randint(1,4);cols=r.randint(1,4);cells=[(i,j) for i in range(rows) for j in range(cols)]
    start,end=r.sample(cells,2) if len(cells)>1 else (cells[0],cells[0])
    other=[p for p in cells if p not in (start,end)];walls=r.sample(other,r.randint(0,min(2,len(other))))
    open_cells=[p for p in other if p not in walls];treasures=r.sample(open_cells,r.randint(0,min(3,len(open_cells))))
    return rows,cols,walls,treasures,start,end


add('persona', 3, 'Escape the Haunted Castle (Part 2)',
    '网格中有墙、起点、出口和宝藏。只能上下左右移动。求到达出口的最少步数；若多条最短路径，返回其中可收集到的最大宝藏数。不可达时返回 -1 0。宝藏到达时拾取一次。',
    '输入 rows cols、墙坐标、宝藏坐标、start 和 end；本站约定坐标为0-based，每个坐标各自一行，网格边长1..200，坐标合法，start/end 不为墙，宝藏坐标不重复。',
    '输出最少步数和最短路径最多可拾取的宝藏数。start 格若有宝藏也计入。',
    '先从 start BFS 得各格最短距离；按距离递增做 DP，只从距离小1的邻格转移，记录到达该格的最短路径中最大宝藏数。',
    'BFS 得到的距离使所有最短路径边从 d 到 d+1，构成有向无环图。按距离递增时，DP 已考虑所有最短前驱，取最大值即是到该格的最短路最大宝藏数。出口的距离和 DP 值正是所求。',
    '时间 O(rows·cols)，空间 O(rows·cols)。', castle_encode, castle_oracle,
    '''def solve(raw):
    from collections import deque
    v=list(map(int,raw.split()));it=iter(v);rows=next(it);cols=next(it);w=set((next(it),next(it)) for _ in range(next(it)));t=set((next(it),next(it)) for _ in range(next(it)));start=(next(it),next(it));end=(next(it),next(it))
    if start in w or end in w:return '-1 0'
    dist={start:0};best={start:int(start in t)};q=deque([start]);dirs=((1,0),(-1,0),(0,1),(0,-1))
    while q:
        r,c=q.popleft()
        for dr,dc in dirs:
            z=(r+dr,c+dc)
            if not(0<=z[0]<rows and 0<=z[1]<cols) or z in w:continue
            if z not in dist:dist[z]=dist[(r,c)]+1;best[z]=best[(r,c)]+int(z in t);q.append(z)
            elif dist[z]==dist[(r,c)]+1:best[z]=max(best[z],best[(r,c)]+int(z in t))
    return f'{dist[end]} {best[end]}' if end in dist else '-1 0'
''', [
        ('选取较晚到达出口的路径','best[z]=max(best[z],best[(r,c)]+int(z in t))','best[z]=best[(r,c)]+int(z in t)'),
        ('不计起点宝藏','best={start:int(start in t)}','best={start:0}')],
    [(3,3,[(1,1)],[(0,1)],(0,0),(2,2)),(2,2,[],[],(0,0),(1,1)),(3,3,[(1,0),(0,1),(1,2),(2,1)],[(0,0)],(0,0),(2,2)),(2,2,[],[(0,0)],(0,0),(1,1))],
    castle_random, bound=1000000)


ALARM_PREVIOUS_REASON = '题面只剩“Given an array of integers coins, where each el…”截断文字；仅凭输出样例无法判断所求目标。'
ALARM_RECOVERY_REASON = '原始 MDX 的题干正文被截断，但同一不可变快照中的标题“Arrange Coins”、示例 `[3,4,6] → [2,2,3]`、三角数公式解法及三语实现共同确定了规则。本站补齐题面，并将输入协议与 N、数值范围明确标为本站约束；不声称其来自原题。120 组独立直接模拟 oracle、32 个正式用例和两个正常退出错误程序均通过用户自有 GoJudge。'


BLOCKED = {
    'oa-harvey-1':'表达式仅说明有整数运算符 +、−、*、/，没有定义优先级、括号/一元符号规则、除法取整方式或除零行为；同一输入可得到不同整数结果。',
    'oa-persona-2':'固定快照的原始题只要求返回一条路径，没有最短路规则，也没有允许任意路径的专用 checker；多条合法路径会产生不同精确输出，普通 token 判题无法唯一验证。',
    'oa-money-forward-1':'道路参数只给出端点 [u,v]，没有边长 d；燃油消耗依赖距离，因此缺少决定可达性的输入。',
    'oa-zalando-1':'固定快照的第二个例子 AA=1、AB=2、BB=1 却给出长度7字符串，不能由所给块数量组成，和题目规则冲突。',
    'oa-wework-1':'“end[i] …”的前后会议兼容条件在题面中被截断，且约束为 N/A；不能确认端点相等时是否重叠，也无法可靠设置规模界。',
    'oa-wework-2':'未定义多个柜台队列长度相同时选哪个柜台；若同一时刻有多个人到达，队列归属会影响按人返回的完成时间。',
    'oa-geico-2':'LRU 操作本身清楚，但快照中首个多步样例漏掉一个 get(1) 的 -1 输出，内嵌样例与后面的修订示例输出长度不一致；需要修正来源题面后再纳入。',
    'oa-teksystems-1':'只定义了 Python Message 类方法，没有给出 stdin/stdout 序列化格式或平台调用约定；把类题自行改造成 JSON 协议会超出本批源语义。',
    'oa-teksystems-2':'SQL 方言未指定；effective_start_date 重复及找不到适用汇率时的处理也未定义，跨方言查询语义可能不同。',
    'oa-juspay-2':'“closest meeting cell”没有定义距离目标（最小化两源距离最大值、距离和或其他指标），也没有同分选择规则。',
    'oa-zolostays-1':'Range Sum 样例2与定义冲突：直接枚举连续子数组得到13个和落在[-2,6]，源样例却输出8；其余样例不能消歧该错误，需修正源样例再做唯一判题。',
    'oa-zolostays-2':'题面在“Given n non-negative integers repres…”处截断，仅有标题和样例不足以确认完整输入、输出与约束。',
    'oa-ukg-2':'没有说明“number of duplicates”是重复键的种类数，还是首次出现之后的重复记录数；这两种常见解释输出不同。',
    'oa-xperi-2':'题干只保留“There are two numbers…”残句，无操作规则；单个样例解释不能恢复完整算法。',
    'oa-alarm-2':'结果定义为相对 today 的天数，但 today 未作为输入固定；同一提交在不同日期会有不同正确输出。',
    'oa-eat-club-2':'目标说最小 chaos score，但第二个样例的说明将 40+60=100 再声称模后为90；n为奇数时最后一战规则也与“最后两人均离场”的状态过程不兼容。'
}


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','candidate-batches','validation','reviews','source-evidence'):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    catalog={item['id']:item for item in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    candidate_ids={f"oa-{s['company']}-{s['number']}" for s in SPECS}
    scoped_ids={f'oa-{company}-{number}' for company,nums in {
        'harvey':(1,2),'persona':(2,3),'money-forward':(1,2),'zalando':(1,2),
        'wework':(1,2),'geico':(1,2),'teksystems':(1,2),'juspay':(1,2),
        'zolostays':(1,2),'hackerearth':(1,2),'ukg':(1,2),'xperi':(1,2),
        'abaka-ai':(1,2),'alarm':(1,2),'eat-club':(1,2)}.items() for number in nums}
    assert candidate_ids.isdisjoint(BLOCKED) and candidate_ids|set(BLOCKED)==scoped_ids
    batch_items=[];reports=[];review_items=[];evidence_items=[]
    pages={}
    for spec in SPECS:
        source_id=f"oa-{spec['company']}-{spec['number']}";source=catalog[source_id]
        code=spec['reference']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
        rng=random.Random(SEED+sum(map(ord,spec['company']))*100+spec['number'])
        inputs=[];seen=set()
        for case in spec['samples']:
            raw=spec['encode'](case)
            if raw not in seen:inputs.append(case);seen.add(raw)
        attempts=0
        while len(inputs)<120 and attempts<10000:
            attempts+=1;case=spec['random'](rng);raw=spec['encode'](case)
            if raw not in seen:inputs.append(case);seen.add(raw)
        if len(inputs)!=120:raise AssertionError((source_id,'unique oracle count',len(inputs)))
        oracle_cases=[dict(input=spec['encode'](case),expectedOutput=str(spec['oracle'](case))+'\n') for case in inputs]
        formal_cases=oracle_cases[:32]
        ref=OUT/'references'/f'{source_id}.py';ref.write_text(code)
        reference_outputs=helper.execute(ref,[case['input'] for case in oracle_cases+formal_cases])
        for i,(actual,expected) in enumerate(zip(reference_outputs,oracle_cases+formal_cases)):
            if actual.split()!=expected['expectedOutput'].split():raise AssertionError((source_id,i,actual,expected))
        mutant_artifacts=[];mutant_results=[]
        for index,(name,old,new) in enumerate(spec['mutants'],1):
            if old not in code:raise AssertionError((source_id,'mutation pattern missing',name,old))
            mutant=code.replace(old,new,1);path=OUT/'negative-controls'/f'{source_id}-{index}.py';path.write_text(mutant)
            output=helper.execute(path,[case['input'] for case in formal_cases])
            killed=[i for i,(actual,expected) in enumerate(zip(output,formal_cases)) if actual.split()!=expected['expectedOutput'].split()]
            if not killed:raise AssertionError((source_id,'mutant survived normally',name))
            mutant_artifacts.append(dict(name=name,code=mutant));mutant_results.append(dict(name=name,rejectedByCases=killed))
        test_cases=[dict(name=f'样例 {i+1}' if i<3 else f'隐藏用例 {i-2}',**case,hidden=i>=3,weight=1) for i,case in enumerate(formal_cases)]
        description=spec['description']+'\n\n本站明确的标准输入输出格式与补充约束属于在线版本定义，不冒充来源原始约束。'
        package=dict(schemaVersion=1,problem=dict(id=source_id,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA',source['companyName']],description=description,input=spec['limits'],output=spec['output'],explanation=spec['idea'],hints=[spec['idea']],timeLimit=8,memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp']),cases=test_cases)
        payload=json.dumps(package,ensure_ascii=False,separators=(',',':'))
        parsed=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=payload,text=True,capture_output=True)
        if parsed.returncode:raise RuntimeError((source_id,parsed.stderr[:2000]))
        normalized=parsed.stdout
        for folder,data in (
            ('packages',json.loads(normalized)),('oracles',oracle_cases),('mutants',mutant_artifacts),
            ('editorials',dict(schemaVersion=1,id=source_id,title=spec['title'],explanation=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}",solutions=[dict(language='python',code=code)],sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork'))):
            (OUT/folder/f'{source_id}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        rationale='固定快照逐条核验；题意与补充输入契约足以离线判题。参考程序与独立 oracle 进行120个唯一输入对照，两个正常退出的错误实现均被正式用例击杀。未运行 GoJudge。'
        if source_id == 'oa-alarm-1':
            rationale=ALARM_RECOVERY_REASON
        batch_items.append(dict(id=source_id,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}",authoredSolutions=[dict(language='python',code=code)]))
        reports.append(dict(id=source_id,oracleCases=len(oracle_cases),uniqueOracleInputs=len(set(x['input'] for x in oracle_cases)),publicCases=3,hiddenCases=len(test_cases)-3,maximumCanonicalInputBytesBound=spec['bound'],negativeControls=mutant_results,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        if source_id == 'oa-alarm-1':
            review_items.append(dict(id=source_id,status='blocked',reason=ALARM_PREVIOUS_REASON))
        else:
            review_items.append(dict(id=source_id,status='authored',reason=rationale))
        source_path=f"web/content/docs/companies/{spec['company']}.mdx"
        source_blob=subprocess.run(['git','rev-parse',f'{SOURCE_COMMIT}:{source_path}'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip()
        evidence_items.append(dict(id=source_id,status='blocked' if source_id == 'oa-alarm-1' else 'authored',sourceCommit=SOURCE_COMMIT,rawPath=source_path,rawGitBlob=source_blob,sourceUrl=source['sourceUrl'],catalogContentHash=source['contentHash'],reason=ALARM_PREVIOUS_REASON if source_id == 'oa-alarm-1' else rationale))
        pages[spec['company']]=source_path
        print(source_id,'120 unique oracle inputs; 2 normal-exit mutants killed',flush=True)
    for source_id,reason in BLOCKED.items():
        source=catalog[source_id];slug=source['companySlug'];raw_path=f'web/content/docs/companies/{slug}.mdx'
        review_items.append(dict(id=source_id,status='blocked',reason=reason))
        evidence_items.append(dict(id=source_id,status='blocked',sourceCommit=SOURCE_COMMIT,rawPath=raw_path,rawGitBlob=subprocess.run(['git','rev-parse',f'{SOURCE_COMMIT}:{raw_path}'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip(),sourceUrl=source['sourceUrl'],catalogContentHash=source['contentHash'],reason=reason))
        pages[slug]=raw_path
    for record in pages.values():
        slug=Path(record).stem
        blob=subprocess.run(['git','rev-parse',f'{SOURCE_COMMIT}:{record}'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip()
        content=subprocess.run(['git','show',f'{SOURCE_COMMIT}:{record}'],cwd=ROOT,capture_output=True,check=True).stdout
        digest=hashlib.sha256(content).hexdigest()
        pages[slug]=dict(path=record,gitBlobSha=blob,sha256=digest)
    batch_items.sort(key=lambda x:x['id']);reports.sort(key=lambda x:x['id']);review_items.sort(key=lambda x:x['id']);evidence_items.sort(key=lambda x:x['id'])
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='本批仅做本地独立 oracle 与正常退出 mutant 对照，未调用 GoJudge；候选状态不等于线上验证。'),ensure_ascii=False,indent=2)+'\n')
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=review_items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'source-evidence'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,repository='https://github.com/RedInn7/OA-Master',commit=SOURCE_COMMIT,reason='固定提交中的源 MDX 作为不可变输入；不执行源仓库代码。',pages=[dict(company=k,**v) for k,v in sorted(pages.items())],items=evidence_items),ensure_ascii=False,indent=2)+'\n')
    # The review batch also contains questions that have since been promoted
    # through other batches. Keep newly recovered Alarm #1 independently
    # verifiable instead of emitting one candidate manifest with duplicate IDs.
    alarm_id='oa-alarm-1'
    alarm_item=next(item for item in batch_items if item['id']==alarm_id)
    alarm_report=next(item for item in reports if item['id']==alarm_id)
    alarm_source=next(item for item in evidence_items if item['id']==alarm_id)
    alarm_candidate_source={**alarm_source,'status':'authored','reason':ALARM_RECOVERY_REASON}
    (OUT/'candidate-batches'/'alarm-1-recovered.json').write_text(json.dumps(dict(schemaVersion=1,items=[alarm_item]),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/'alarm-1-recovered.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=[alarm_report],skipped={},note='本地 oracle/错误程序验证完成；真实 GoJudge 结果见 reports/alarm-1-recovered.json。'),ensure_ascii=False,indent=2)+'\n')
    (OUT/'source-evidence'/'alarm-1-recovered.json').write_text(json.dumps(dict(schemaVersion=1,repository='https://github.com/RedInn7/OA-Master',commit=SOURCE_COMMIT,pages=[dict(company='alarm',**pages['alarm'])],items=[alarm_candidate_source]),ensure_ascii=False,indent=2)+'\n')
    (OUT/'resolutions'/'alarm-1-recovered.json').write_text(json.dumps(dict(schemaVersion=1,items=[dict(id=alarm_id,batch='alarm-1-recovered',sourceContentHash=catalog[alarm_id]['contentHash'],previousReason=ALARM_PREVIOUS_REASON,reason=ALARM_RECOVERY_REASON)]),ensure_ascii=False,indent=2)+'\n')
    print(f"candidate={len(batch_items)} blocked={len(BLOCKED)} scoped={len(scoped_ids)}",flush=True)


if __name__=='__main__':
    main()
