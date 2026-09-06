"""Original graph/bit test designs. No downloaded program is imported or executed."""
from collections import deque, Counter
from itertools import product
import math

PROBLEMS = {}

def scalar_codec(args):
    return ' '.join(map(str, args)) + '\n'

SCALAR_PARSE = 'args=list(map(int,sys.stdin.read().split()))'
GRID_PARSE = "v=list(map(int,sys.stdin.read().split())); m,n=v[:2]; assert len(v)==2+m*n; args=[[v[2+i*n:2+(i+1)*n] for i in range(m)]]"

def grid_codec(args):
    g=args[0]
    return f'{len(g)} {len(g[0])}\n'+'\n'.join(' '.join(map(str,row)) for row in g)+'\n'

def components(g, value=1):
    # Deliberately use equivalence-class merging, independent from DFS/BFS reference solutions.
    groups=[]
    for i,row in enumerate(g):
        for j,x in enumerate(row):
            if x != value: continue
            cell={(i,j)}
            touching=[s for s in groups if (i-1,j) in s or (i,j-1) in s]
            for s in touching: groups.remove(s); cell |= s
            groups.append(cell)
    return groups

def grid_oracle(pid, args):
    g=args[0]; m=len(g); n=len(g[0])
    if pid == 200: return len(components(g,'1'))
    if pid == 463:
        return sum(4-sum(0<=i+di<m and 0<=j+dj<n and g[i+di][j+dj]==1 for di,dj in [(1,0),(-1,0),(0,1),(0,-1)]) for i in range(m) for j in range(n) if g[i][j])
    if pid == 695: return max(map(len,components(g)),default=0)
    if pid == 1020: return sum(len(s) for s in components(g) if all(0<i<m-1 and 0<j<n-1 for i,j in s))
    if pid == 1254: return sum(all(0<i<m-1 and 0<j<n-1 for i,j in s) for s in components(g,0))
    if pid == 1905: return sum(all(g[i][j]==1 for i,j in s) for s in components(args[1]))
    if pid == 994:
        # Synchronous cellular simulation, not multi-source BFS.
        g=[r[:] for r in g]; minutes=0
        while True:
            fresh=[(i,j) for i in range(m) for j in range(n) if g[i][j]==1]
            if not fresh:return minutes
            changed=[(i,j) for i,j in fresh if any(0<=i+di<m and 0<=j+dj<n and g[i+di][j+dj]==2 for di,dj in [(1,0),(-1,0),(0,1),(0,-1)])]
            if not changed:return -1
            for i,j in changed:g[i][j]=2
            minutes+=1
    if pid == 1091:
        if g[0][0] or g[-1][-1]:return -1
        # Repeated global distance relaxation is independent from a queue traversal.
        dist={(0,0):1}
        for _ in range(m*n):
            before=dict(dist)
            for i in range(m):
                for j in range(n):
                    if g[i][j]:continue
                    near=[before[(i+di,j+dj)]+1 for di,dj in product((-1,0,1),repeat=2) if (di or dj) and (i+di,j+dj) in before]
                    if near:dist[(i,j)]=min([dist.get((i,j),10**9)]+near)
            if dist==before:break
        return dist.get((m-1,n-1),-1)
    raise KeyError(pid)

GRID_META = {
200:('numIslands','岛屿数量','Number of Islands','字符网格中，字符 1 为陆地、0 为水。四方向相邻的陆地属于同一岛屿，返回岛屿数量。','In a character grid, 1 is land and 0 is water. Count connected components of land using four-direction adjacency.',300),
463:('islandPerimeter','岛屿的周长','Island Perimeter','0/1 网格中恰好有一座四连通岛屿且没有湖泊。每个格子边长为 1，求陆地和水或网格外相邻的边的总长度。','The binary grid contains exactly one four-connected island and no lakes. Unit cells have side length one. Return the total length of land edges adjacent to water or outside the grid.',100),
695:('maxAreaOfIsland','岛屿的最大面积','Max Area of Island','0/1 网格中 1 为陆地，求四方向连通的最大陆地块格子数；没有陆地返回 0。','In a binary grid, return the largest number of cells in a four-connected component of 1s, or 0 if there is no land.',50),
994:('orangesRotting','腐烂的橘子','Rotting Oranges','0 表示空格、1 表示新鲜橘子、2 表示腐烂橘子。每分钟所有腐烂橘子同时使四方向相邻的新鲜橘子腐烂。求全部腐烂的最少分钟数，无法完成返回 -1，没有新鲜橘子返回 0。','Cells are empty (0), fresh oranges (1), or rotten oranges (2). Every minute, all rotten oranges simultaneously rot fresh four-direction neighbors. Return minutes until no fresh orange remains, -1 if impossible, or 0 if initially none are fresh.',10),
1020:('numEnclaves','飞地的数量','Number of Enclaves','0/1 网格中 1 为陆地。统计无法沿四方向陆地路径走到网格边界的陆地格子数。','Count land cells (1s) that cannot reach the grid boundary by walking only through four-direction adjacent land cells.',500),
1254:('closedIsland','统计封闭岛屿的数目','Number of Closed Islands','网格中 0 为陆地、1 为水。统计不包含任何边界格子的四连通陆地块数量。','Here 0 is land and 1 is water. Count four-connected components of land containing no boundary cell.',100),
1905:('countSubIslands','统计子岛屿','Count Sub Islands','给定同尺寸 0/1 网格 grid1 和 grid2。岛屿为四连通的 1。若 grid2 的一座岛屿每个格子在 grid1 中都是 1，则为子岛屿；返回数量。','Given equally sized binary grids, islands are four-connected components of 1s. Count grid2 islands whose every cell is also 1 in grid1.',500),
1091:('shortestPathBinaryMatrix','二进制矩阵中的最短路径','Shortest Path in Binary Matrix','正方形 0/1 网格中从左上到右下只能经过 0，可沿八方向移动。返回最短路径经过的格子数（包含两端），不存在返回 -1。','In a square binary grid, find a shortest path from top-left to bottom-right through 0s, allowing eight directions. Return its number of cells including both endpoints, or -1 if none exists.',100),
}

def validate_grid(pid, args):
    assert len(args)==(2 if pid==1905 else 1)
    limit=GRID_META[pid][-1]
    g=args[0];m=len(g);n=len(g[0]);assert 1<=m<=limit and 1<=n<=limit
    if pid==1091:assert m==n
    for a in args:
        assert len(a)==m and all(len(row)==n for row in a)
        assert all(x in (('0','1') if pid==200 else (0,1,2) if pid==994 else (0,1)) for row in a for x in row)
    if pid==463:
        assert len(components(g))==1
        assert all(any(i in (0,m-1) or j in (0,n-1) for i,j in s) for s in components(g,0))

def random_grid(pid,r):
    m=r.randint(1,6);n=m if pid==1091 else r.randint(1,6)
    if pid==463:
        # A rectangular island is always connected and has no lakes.
        g=[[0]*n for _ in range(m)]; a=r.randrange(m);b=r.randrange(a,m);c=r.randrange(n);d=r.randrange(c,n)
        for i in range(a,b+1):
            for j in range(c,d+1):g[i][j]=1
    else:g=[[r.randrange(3 if pid==994 else 2) for _ in range(n)] for _ in range(m)]
    if pid==200:g=[[str(x) for x in row] for row in g]
    return [g,[[r.randrange(2) for _ in range(n)] for _ in range(m)]] if pid==1905 else [g]

for pid,(method,zh,en,desc,eng,limit) in GRID_META.items():
    edges=[[[[0]]],[[[1]]],[[[1,0],[0,1]]],[[[1,1],[1,1]]],[[[1,1,1],[1,0,1],[1,1,1]]]]
    if pid==200:edges=[[[[str(x) for x in row] for row in a[0]]] for a in edges]
    if pid==463:edges=[[[[1]]],[[[1,1]]],[[[1,0],[1,1]]],[[[1,1,1],[0,1,0]]]]
    if pid==994:edges=[[[[0]]],[[[1]]],[[[2]]],[[[2,1,1],[1,1,0],[0,1,1]]],[[[2,0,1]]],[[[2,1,1,2]]]]
    if pid==1905:edges=[[[[1]],[[1]]],[[[0]],[[1]]],[[[1,0],[0,1]],[[1,1],[1,1]]],[[[1,1],[1,1]],[[1,0],[0,1]]]]
    if pid==1091:edges=[[[[0]]],[[[1]]],[[[0,1],[1,0]]],[[[0,0],[0,0]]],[[[0,1],[1,1]]]]
    k=limit; ones=[[1]*k for _ in range(k)]; zeros=[[0]*k for _ in range(k)]
    pressure={200:[([[[str(x) for x in row] for row in zeros]],0)],463:[([ones],4*k)],695:[([ones],k*k)],994:[([[[2]+[1]*9]+[[1]*10 for _ in range(9)]],18)],1020:[([ones],0),([[[0]*k]+[[0]+[1]*(k-2)+[0] for _ in range(k-2)]+[[0]*k]],(k-2)**2)],1254:[([zeros],0)],1905:[([zeros,ones],0)],1091:[([zeros],k),([ones],-1)]}[pid]
    parse=GRID_PARSE
    encode=grid_codec
    if pid==200:parse += "; args=[[[str(x) for x in row] for row in args[0]]]"
    if pid==1905:
        parse="v=list(map(int,sys.stdin.read().split())); m,n=v[:2]; assert len(v)==2+2*m*n; args=[ [v[2+g*m*n+i*n:2+g*m*n+(i+1)*n] for i in range(m)] for g in range(2)]"
        encode=lambda a:grid_codec([a[0]])+'\n'.join(' '.join(map(str,row)) for row in a[1])+'\n'
    # Family-specific plausible mistakes, all complete stdin programs.
    mutation={200:'print(sum(x==1 for x in v[2:]))',463:'print(4*sum(v[2:]))',695:'print(sum(v[2:]))',994:'print(0)',1020:'print(sum(v[2:]))',1254:'print(sum(x==0 for x in v[2:]))',1905:'print(sum(x==1 for x in v[2+v[0]*v[1]:]))',1091:'print(v[0]+v[1]-1)'}[pid]
    inp=f'第一行 m n；随后 m 行，每行 n 个空格分隔的格子值。1 ≤ m,n ≤ {limit}。'
    eni=f'First line: m n. Then m rows of n space-separated cell values. 1 ≤ m,n ≤ {limit}.'
    if pid==1905:inp+='先输入 grid1，再输入 grid2 的 m 行。';eni+=' Give grid1 first, followed by m rows of grid2.'
    if pid==1091:inp+='m 必须等于 n。';eni+=' m must equal n.'
    PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh=inp,inputEn=eni,outputZh='输出一个整数。',outputEn='Print one integer.',difficulty='简单' if pid==463 else '中等',edges=edges,pressure=pressure,random_args=lambda r,p=pid:random_grid(p,r),oracle=lambda a,p=pid:grid_oracle(p,a),encode=encode,parse=parse,mutants=[dict(name={200:'counts land cells instead of components',463:'does not subtract shared sides',695:'counts all islands together',994:'forgets elapsed minutes and unreachable fresh oranges',1020:'includes boundary-connected land',1254:'counts zero cells instead of closed components',1905:'counts cells rather than fully contained islands',1091:'assumes a Manhattan path and ignores obstacles'}[pid],source='v=list(map(int,open(0).read().split()))\n'+mutation+'\n')],validate=lambda a,p=pid:validate_grid(p,a))

# Graph oracles use reachability by repeated set expansion, not reference union-find.
def graph_oracle(pid,a):
    if pid==547:
        g=a[0];n=len(g);edges=[(i,j) for i in range(n) for j in range(n) if g[i][j]]
    else:n,edges,s,t=a
    unseen=set(range(n));groups=[]
    while unseen:
        found={min(unseen)}
        while True:
            grown=found|{v for u,v in edges if u in found}|{u for u,v in edges if v in found}
            if grown==found:break
            found=grown
        unseen-=found;groups.append(found)
    return len(groups) if pid==547 else int(any(s in g and t in g for g in groups))

def random_graph(pid,r):
    n=r.randint(1,9);edges=[[i,j] for i in range(n) for j in range(i+1,n) if r.random()<.25]
    if pid==1971:return [n,edges,r.randrange(n),r.randrange(n)]
    g=[[int(i==j) for j in range(n)] for i in range(n)]
    for i,j in edges:g[i][j]=g[j][i]=1
    return [g]

def valid_graph(pid,a):
    if pid==547:
        g=a[0];assert len(a)==1 and 1<=len(g)<=200 and all(len(row)==len(g) for row in g)
        assert all(g[i][i]==1 for i in range(len(g)))
        assert all(g[i][j] in (0,1) and g[i][j]==g[j][i] for i in range(len(g)) for j in range(len(g)))
    else:
        n,e,s,t=a;assert 1<=n<=200000 and len(e)<=200000 and 0<=s<n and 0<=t<n
        assert all(len(x)==2 and 0<=x[0]<n and 0<=x[1]<n and x[0]!=x[1] for x in e)
        assert len({tuple(sorted(x)) for x in e})==len(e)

PROBLEMS[547]=dict(method='findCircleNum',titleZh='省份数量',titleEn='Number of Provinces',descriptionZh='对称 0/1 邻接矩阵表示无向图，对角线为 1。返回连通分量数量。',descriptionEn='A symmetric binary adjacency matrix represents an undirected graph, with diagonal entries 1. Return its number of connected components.',inputZh='第一行 n，随后 n 行各 n 个 0/1 整数。1 ≤ n ≤ 200。',inputEn='First line n, then n rows of n binary integers. 1 ≤ n ≤ 200.',edges=[[[[1]]],[[[1,0],[0,1]]],[[[1,1,0],[1,1,1],[0,1,1]]]],pressure=[([[[1]*200 for _ in range(200)]],1)],encode=lambda a:str(len(a[0]))+'\n'+'\n'.join(' '.join(map(str,row)) for row in a[0])+'\n',parse='v=list(map(int,sys.stdin.read().split())); n=v[0]; assert len(v)==1+n*n; args=[[v[1+i*n:1+(i+1)*n] for i in range(n)]]',mutants=[dict(name='counts cities instead of provinces',source='print(int(input()))\n')])
PROBLEMS[1971]=dict(method='validPath',titleZh='寻找图中是否存在路径',titleEn='Find if Path Exists in Graph',descriptionZh='无向图节点编号为 0 到 n-1，边不重复且没有自环。判断 source 到 destination 是否有路径；节点相同时路径成立。',descriptionEn='An undirected graph has nodes 0 through n-1, no duplicate edges and no self-loops. Determine whether source can reach destination. A node reaches itself.',inputZh='第一行 n m source destination；随后 m 行每行一条边的两个端点。1 ≤ n ≤ 200000，0 ≤ m ≤ 200000。端点和起终点均在 [0,n-1]。',inputEn='First line n m source destination; then m pairs of edge endpoints. 1 ≤ n ≤ 200000; 0 ≤ m ≤ 200000. All endpoints, source and destination lie in [0,n-1].',edges=[[1,[],0,0],[2,[],0,1],[3,[[0,1],[1,2]],0,2],[3,[[0,1]],0,2]],pressure=[([200000,[],0,199999],0),([200000,[],199999,199999],1)],encode=lambda a:f'{a[0]} {len(a[1])} {a[2]} {a[3]}\n'+''.join(f'{u} {v}\n' for u,v in a[1]),parse='v=list(map(int,sys.stdin.read().split())); n,m,s,t=v[:4]; assert len(v)==4+2*m; args=[n,[v[4+2*i:6+2*i] for i in range(m)],s,t]',mutants=[dict(name='checks direct edges only',source='v=list(map(int,open(0).read().split())); n,m,s,t=v[:4]; print(int(s==t or any({v[4+2*i],v[5+2*i]}=={s,t} for i in range(m))))\n')])
for pid in [547,1971]:
    PROBLEMS[pid].update(outputZh='输出一个整数。'+('成立输出 1，否则输出 0。' if pid==1971 else ''),outputEn='Print one integer.'+(' Print 1 for reachable, otherwise 0.' if pid==1971 else ''),difficulty='简单' if pid==1971 else '中等',oracle=lambda a,p=pid:graph_oracle(p,a),random_args=lambda r,p=pid:random_graph(p,r),validate=lambda a,p=pid:valid_graph(p,a))

# Numeric oracles enumerate mathematical definitions on small inputs.
def numeric_oracle(pid,a):
    n=a[0]
    if pid in (231,342,326):
        base={231:2,342:4,326:3}[pid]
        return int(n in [base**k for k in range(32)])
    if pid==191:return sum(int(c) for c in bin(n)[2:])
    if pid==461:return sum(x!=y for x,y in zip(f'{n:031b}',f'{a[1]:031b}'))
    if pid==762:
        def prime(k):return k>=2 and all(k%d for d in range(2,k))
        return sum(prime(bin(x).count('1')) for x in range(n,a[1]+1))
    if pid==693:
        s=bin(n)[2:];return int(all(x!=y for x,y in zip(s,s[1:])))
    if pid==868:
        pos=[i for i,c in enumerate(bin(n)[2:]) if c=='1'];return max([b-a for a,b in zip(pos,pos[1:])],default=0)
    if pid==1342:
        # Definition via dynamic programming over all smaller states.
        dp=[0]*(n+1)
        for x in range(1,n+1):dp[x]=1+dp[x-1 if x%2 else x//2]
        return dp[n]
    if pid==1486:
        # Count parity of every bit independently; do not use XOR accumulation.
        vals=[a[1]+2*i for i in range(n)]
        return sum((sum((x//(2**k))%2 for x in vals)%2)*(2**k) for k in range(16))
    if pid==2169:
        x,y=a;steps=0
        while x and y:
            if x>=y:x-=y
            else:y-=x
            steps+=1
        return steps
    if pid==2413:return next(x for x in range(max(n,2),2*n+1) if x%n==0 and x%2==0)
    if pid==2427:return sum(n%d==0 and a[1]%d==0 for d in range(1,min(a)+1))
    if pid==292:
        win=[False]*(n+1)
        for x in range(1,n+1):win[x]=any(not win[x-k] for k in range(1,min(3,x)+1))
        return int(win[n])
    if pid in (476,1009):return int(''.join('1' if c=='0' else '0' for c in bin(n)[2:]),2)
    if pid==2652:return sum(x for x in range(1,n+1) if any(x%d==0 for d in (3,5,7)))
    if pid==1523:return sum(x%2 for x in range(n,a[1]+1))
    if pid==137:
        counts=Counter(n);return next(x for x in counts if counts[x]==1)
    raise KeyError(pid)

NUM_META={
231:('isPowerOfTwo','2 的幂','Power of Two','判断整数 n 是否等于 2 的某个非负整数次幂。','Determine whether n equals 2 raised to a nonnegative integer power.',[(-2147483648,2147483647)]),
342:('isPowerOfFour','4 的幂','Power of Four','判断整数 n 是否等于 4 的某个非负整数次幂。','Determine whether n equals 4 raised to a nonnegative integer power.',[(-2147483648,2147483647)]),
326:('isPowerOfThree','3 的幂','Power of Three','判断整数 n 是否等于 3 的某个非负整数次幂。','Determine whether n equals 3 raised to a nonnegative integer power.',[(-2147483648,2147483647)]),
191:('hammingWeight','位 1 的个数','Number of 1 Bits','返回 n 的二进制表示中 1 的数量。','Return the number of 1 bits in the binary representation of n.',[(1,2147483647)]),
461:('hammingDistance','汉明距离','Hamming Distance','给定 x,y，返回它们二进制表示中不同位置的数量，较短表示左侧补零。','Return the number of differing bit positions in x and y, padding the shorter representation with leading zeroes.',[(0,2147483647),(0,2147483647)]),
762:('countPrimeSetBits','二进制表示中质数个计算置位','Prime Number of Set Bits in Binary Representation','统计闭区间 [left,right] 中二进制 1 的数量为质数的整数个数。质数必须大于 1。','Count integers in inclusive interval [left,right] whose number of set bits is prime. A prime must be greater than 1.',[(1,1000000),(1,1000000)]),
693:('hasAlternatingBits','交替位二进制数','Binary Number with Alternating Bits','判断正整数 n 的二进制表示中每一对相邻位是否都不相同，不计前导零。','Determine whether every pair of neighboring bits in the binary representation of positive n differs, ignoring leading zeroes.',[(1,2147483647)]),
868:('binaryGap','二进制间距','Binary Gap','返回 n 二进制表示中相邻两次出现的 1 的最大位置差；不足两个 1 返回 0。相邻指这两个 1 之间没有其他 1。','Return the maximum positional distance between consecutive occurrences of 1 in binary n, or 0 if fewer than two 1s occur. Consecutive means no other 1 lies between them.',[(1,1000000000)]),
1342:('numberOfSteps','将数字变成 0 的操作次数','Number of Steps to Reduce a Number to Zero','非负整数 num 为偶数时除以 2，为奇数时减 1。求变为 0 的操作次数。','Starting with nonnegative num, divide by 2 when even or subtract 1 when odd. Count operations required to reach 0.',[(0,1000000)]),
1486:('xorOperation','数组异或操作','XOR Operation in an Array','长度为 n 的数组满足 nums[i]=start+2*i（0≤i<n），返回所有元素的按位异或。','An array of length n has nums[i]=start+2*i for 0≤i<n. Return the bitwise XOR of all elements.',[(1,1000),(0,1000)]),
2169:('countOperations','得到 0 的操作数','Count Operations to Obtain Zero','给定非负 num1,num2。两数非零时，每次从较大数减去较小数，相等时从 num1 减去 num2。任一数变零时停止，返回次数。','While both nonnegative numbers are nonzero, subtract the smaller from the larger; on a tie subtract num2 from num1. Return the number of operations until either number is zero.',[(0,100000),(0,100000)]),
2413:('smallestEvenMultiple','最小偶倍数','Smallest Even Multiple','返回同时为正整数 n 的倍数和 2 的倍数的最小正整数。','Return the least positive integer divisible by both positive n and 2.',[(1,150)]),
2427:('commonFactors','公因子的数目','Number of Common Factors','返回正整数 a,b 的正公因子个数。','Return the number of positive integers dividing both a and b.',[(1,1000),(1,1000)]),
292:('canWinNim','Nim 游戏','Nim Game','有 n 块石头，两人轮流取 1 至 3 块，你先取，取走最后一块的人获胜。双方最优策略时判断你是否必胜。','Two players alternate removing 1 to 3 stones from a pile of n. You move first; taking the last stone wins. Determine whether you can force a win with optimal play.',[(1,2147483647)]),
476:('findComplement','数字的补数','Number Complement','将正整数 num 二进制表示中的每位翻转后返回对应整数，不翻转前导零。','Flip every bit in the binary representation of positive num and return the resulting integer. Do not flip leading zeroes.',[(1,2147483647)]),
1009:('bitwiseComplement','十进制整数的反码','Complement of Base 10 Integer','翻转 n 二进制表示中的每位，不计前导零；0 的表示为单个 0，故补数为 1。','Flip each bit of binary n without leading zeroes. Zero is represented by one 0 bit, so its complement is 1.',[(0,1000000000)]),
2652:('sumOfMultiples','倍数求和','Sum Multiples','求 [1,n] 中能被 3、5、7 中至少一个整除的整数之和，每个整数只计一次。','Sum integers in inclusive range [1,n] divisible by at least one of 3, 5 and 7. Count each integer once.',[(1,1000)]),
1523:('countOdds','在区间范围内统计奇数数目','Count Odd Numbers in an Interval Range','返回闭区间 [low,high] 中奇数个数。','Return the number of odd integers in inclusive range [low,high].',[(0,1000000000),(0,1000000000)]),
137:('singleNumber','只出现一次的数字 II','Single Number II','非空整数数组中，恰有一个数出现一次，其他每个不同的数恰好出现三次。返回只出现一次的数。','In a nonempty integer array, exactly one value appears once and every other distinct value appears exactly three times. Return the value appearing once.',[]),
}

NUM_EDGES={231:[[-1],[0],[1],[2],[3],[4],[8]],342:[[0],[1],[2],[4],[8],[16]],326:[[-3],[0],[1],[3],[9],[27],[45]],191:[[1],[2],[3],[7],[16],[31]],461:[[0,0],[1,4],[3,3],[7,8]],762:[[1,1],[2,3],[6,10],[10,15]],693:[[1],[2],[3],[5],[7],[10]],868:[[1],[2],[5],[9],[22]],1342:[[0],[1],[2],[3],[14]],1486:[[1,0],[1,7],[5,0],[4,3]],2169:[[0,0],[0,1],[1,0],[1,1],[2,3],[10,10]],2413:[[1],[2],[3],[6]],2427:[[1,1],[6,12],[7,11],[12,12]],292:[[1],[2],[3],[4],[5],[8]],476:[[1],[2],[5],[7]],1009:[[0],[1],[2],[5],[7]],2652:[[1],[3],[7],[15],[21],[105]],1523:[[0,0],[0,1],[1,1],[2,2],[3,7]],137:[[[1]],[[-1]],[[2,2,3,2]],[[-2,-2,-2,7]],[[0,0,0,-2147483648]]]}
NUM_PRESSURE={231:[([2147483647],0),([1073741824],1),([-2147483648],0)],342:[([1073741824],1),([2147483647],0)],326:[([1162261467],1),([2147483647],0)],191:[([2147483647],31)],461:[([0,2147483647],31)],762:[([1000000,1000000],1)],693:[([1431655765],1),([2147483647],0)],868:[([536870913],29)],1342:[([1000000],26)],1486:[([1000,0],0)],2169:[([100000,1],100000),([100000,100000],1)],2413:[([150],150),([149],298)],2427:[([1000,1000],16)],292:[([2147483647],1),([2147483644],0)],476:[([2147483647],0)],1009:[([1000000000],73741823)],2652:[([1000],272066)],1523:[([0,1000000000],500000000),([1,999999999],500000000)],137:[([list(range(9999))*3+[-2147483648]],-2147483648)]}

def random_num(pid,r):
    if pid==137:
        pool=r.sample(range(-20,21),r.randint(1,8));a=[pool[0]]+[x for x in pool[1:] for _ in range(3)];r.shuffle(a);return [a]
    if pid in (231,342,326):return [r.choice([r.randint(-32,256),r.choice([2,3,4])**r.randint(0,12)])]
    bounds=NUM_META[pid][-1];a=[r.randint(lo,min(hi,100)) for lo,hi in bounds]
    if pid in (762,1523):a.sort()
    return a

def validate_num(pid,a):
    if pid==137:
        assert len(a)==1 and 1<=len(a[0])<=30000 and all(type(x) is int and -2147483648<=x<=2147483647 for x in a[0])
        c=Counter(a[0]);assert list(c.values()).count(1)==1 and all(v in (1,3) for v in c.values());return
    bounds=NUM_META[pid][-1];assert len(a)==len(bounds)
    assert all(type(x) is int and lo<=x<=hi for x,(lo,hi) in zip(a,bounds))
    if pid in (762,1523):assert a[0]<=a[1]
    if pid==762:assert a[1]-a[0]<=10000

MUT_NUM={231:('accepts every even positive integer','int(a[0]>0 and a[0]%2==0)'),342:('confuses powers of two with powers of four','int(a[0]>0 and a[0]&(a[0]-1)==0)'),326:('confuses multiples of three with powers of three','int(a[0]>0 and a[0]%3==0)'),191:('counts binary digits instead of set bits','len(bin(a[0])[2:])'),461:('compares popcounts rather than bit positions',"abs(bin(a[0]).count('1')-bin(a[1]).count('1'))"),762:('treats one as prime',"sum(bin(x).count('1') in (1,2,3,5,7,11,13,17,19) for x in range(a[0],a[1]+1))"),693:('assumes every odd value alternates','int(a[0]%2==1)'),868:('counts zeroes instead of positional distance',"max([len(s) for s in bin(a[0])[2:].strip('0').split('1')],default=0)"),1342:('counts only halvings','a[0].bit_length()'),1486:('adds instead of XORing','sum(a[1]+2*i for i in range(a[0]))'),2169:('assumes every input pair needs one operation','int(a[0]>0 and a[1]>0)'),2413:('always doubles n','a[0]*2'),2427:('returns gcd instead of divisor count','__import__("math").gcd(*a)'),292:('assumes any pile above three is losing','int(a[0]<=3)'),476:('flips signed leading bits','~a[0]'),1009:('uses a zero-length representation for zero','((1<<a[0].bit_length())-1)^a[0]'),2652:('double-counts common multiples','sum(x for x in range(1,a[0]+1) for d in (3,5,7) if x%d==0)'),1523:('excludes the upper endpoint','sum(x%2 for x in range(a[0],a[1]))'),137:('uses XOR cancellation suitable only for pairs','__import__("functools").reduce(lambda x,y:x^y,a[1:],0)')}
BOOL_IDS={231,342,326,693,292}
for pid,(method,zh,en,desc,eng,bounds) in NUM_META.items():
    inp='一行按题意顺序输入 '+str(len(bounds))+' 个整数。约束：'+'；'.join(f'第 {i+1} 个整数在 [{lo},{hi}]' for i,(lo,hi) in enumerate(bounds))+'。'
    eni=f'One line with {len(bounds)} integer(s) in the order named above. Bounds: '+'; '.join(f'argument {i+1} is in [{lo},{hi}]' for i,(lo,hi) in enumerate(bounds))+'.'
    if pid in (762,1523):inp+='第一个数不得大于第二个。';eni+=' The first value must not exceed the second.'
    if pid==762:inp+='right-left ≤ 10000。';eni+=' right-left ≤ 10000.'
    if pid==137:inp='第一行数组长度 n；第二行 n 个整数。1 ≤ n ≤ 30000，元素在 [-2147483648,2147483647]。出现次数必须满足题意。';eni='First line n; second line n array integers. 1 ≤ n ≤ 30000; values are in [-2147483648,2147483647]. Frequencies must satisfy the statement.'
    name,expr=MUT_NUM[pid]
    PROBLEMS[pid]=dict(method=method,titleZh=zh,titleEn=en,descriptionZh=desc,descriptionEn=eng,inputZh=inp,inputEn=eni,outputZh='成立输出 1，否则输出 0。' if pid in BOOL_IDS else '输出一个整数。',outputEn='Print 1 if true, otherwise 0.' if pid in BOOL_IDS else 'Print one integer.',difficulty='中等' if pid==137 else '简单',edges=NUM_EDGES[pid],pressure=NUM_PRESSURE[pid],random_args=lambda r,p=pid:random_num(p,r),oracle=lambda a,p=pid:numeric_oracle(p,a),encode=(lambda a:str(len(a[0]))+'\n'+' '.join(map(str,a[0]))+'\n') if pid==137 else scalar_codec,parse='v=list(map(int,sys.stdin.read().split())); assert len(v)==v[0]+1; args=[v[1:]]' if pid==137 else SCALAR_PARSE,mutants=[dict(name=name,source='a=list(map(int,open(0).read().split()))\nprint('+expr+')\n')],validate=lambda a,p=pid:validate_num(p,a))

def and_oracle(a):
    left,right=a
    # For each bit, enumerate whether every integer has that bit set.
    return sum(1<<k for k in range(31) if all((x//(1<<k))%2 for x in range(left,right+1)))

def and_valid(a):
    assert len(a)==2 and all(type(x) is int for x in a) and 0<=a[0]<=a[1]<=2147483647

def and_random(r):
    x=r.randrange(100);return [x,x+r.randrange(20)]

PROBLEMS[201]=dict(method='rangeBitwiseAnd',titleZh='数字范围按位与',titleEn='Bitwise AND of Numbers Range',descriptionZh='返回闭区间 [left,right] 中所有整数的按位与。',descriptionEn='Return the bitwise AND of every integer in inclusive range [left,right].',inputZh='一行 left right。0 ≤ left ≤ right ≤ 2147483647。',inputEn='One line: left right. 0 ≤ left ≤ right ≤ 2147483647.',outputZh='输出一个整数。',outputEn='Print one integer.',difficulty='中等',edges=[[0,0],[1,1],[5,7],[8,15],[7,9],[1,3]],pressure=[([0,2147483647],0),([1073741824,2147483647],1073741824),([2147483647,2147483647],2147483647)],random_args=and_random,oracle=and_oracle,encode=scalar_codec,parse=SCALAR_PARSE,mutants=[dict(name='ANDs only the two endpoints',source='a,b=map(int,input().split()); print(a&b)\n')],validate=and_valid)

# Maximum dimensions with many distinct components complement the deep
# connected-component stress cases below.
PROBLEMS[200]['pressure'].append(([[['1' if (i+j)%2==0 else '0' for j in range(300)] for i in range(300)]],45000))
PROBLEMS[695]['pressure']=[([[[int(i%2==0 and j%2==0) for j in range(50)] for i in range(50)]],1),([[[1]*50]+[[0]*50 for _ in range(49)]],50)]
PROBLEMS[1020]['pressure']=[([[[int(0<i<499 and 0<j<499 and (i+j)%2==0) for j in range(500)] for i in range(500)]],124002),([[[0]*500 for _ in range(500)]],0)]
PROBLEMS[1254]['pressure']=[([[[int(not(0<i<99 and 0<j<99 and (i+j)%2==0)) for j in range(100)] for i in range(100)]],4802)]
PROBLEMS[1905]['pressure']=[([[[0]*500 for _ in range(500)],[[int((i+j)%2==0) for j in range(500)] for i in range(500)]],0)]

# Deep connected components are essential complexity/stack-pressure coverage.
# The sandbox-only reference harness supplies an adequate recursion limit.
PROBLEMS[200]['pressure'].append(([[['1']*300 for _ in range(300)]],1))
PROBLEMS[695]['pressure'].append(([[[1]*50 for _ in range(50)]],2500))
PROBLEMS[1020]['pressure'].extend([
    ([[[1]*500 for _ in range(500)]],0),
    ([[[0]*500]+[[0]+[1]*498+[0] for _ in range(498)]+[[0]*500]],248004),
])
PROBLEMS[1254]['pressure'].extend([
    ([[[0]*100 for _ in range(100)]],0),
    ([[[1]*100]+[[1]+[0]*98+[1] for _ in range(98)]+[[1]*100]],1),
])
PROBLEMS[1905]['pressure'].extend([
    ([[[1]*500 for _ in range(500)],[[1]*500 for _ in range(500)]],1),
    ([[[0]*500 for _ in range(500)],[[1]*500 for _ in range(500)]],0),
])
PROBLEMS[1971]['pressure'].append(([200000,[[i,i+1] for i in range(199999)],0,199999],1))
