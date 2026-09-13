"""Authored Meta tasks; never execute imported source solutions."""
import collections
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'


def array(a):
    return str(len(a)) + '\n' + ' '.join(map(str, a)) + '\n'


def pattern_oracle(x):
    a, p = x
    return str(sum(all((a[i+j+1] > a[i+j]) - (a[i+j+1] < a[i+j]) == v for j, v in enumerate(p)) for i in range(len(a)-len(p))))


def houses_oracle(a):
    occupied = set(); answers = []
    for value in a:
        occupied.add(value); best = 0
        for start in occupied:
            length = 0
            while start + length in occupied:
                length += 1
            best = max(best, length)
        answers.append(best)
    return ' '.join(map(str, answers))


def obstacles_oracle(ops):
    occupied = set(); result = []
    for op in ops:
        if op[0] == 1:
            occupied.add(op[1])
        else:
            result.append('0' if any(op[1] <= v < op[1]+op[2] for v in occupied) else '1')
    return ''.join(result)


def random_ops(r):
    ops = []; occupied = set()
    for _ in range(r.randint(1, 18)):
        x = r.randint(-12, 12)
        if x not in occupied and r.random() < .45:
            ops.append((1, x)); occupied.add(x)
        else:
            ops.append((2, x, r.randint(1, 8)))
    ops.append((2, r.randint(-12, 12), r.randint(1, 8)))
    return ops


def kth_oracle(x):
    a, k = x; missing = 0; value = 0
    while missing < k:
        value += 1
        if value not in a:
            missing += 1
    return str(value)


def ones_oracle(x):
    a, k = x
    return str(max([0] + [j-i for i in range(len(a)) for j in range(i+1, len(a)+1) if a[i:j].count(0) <= k]))


def merge_oracle(arrays):
    combined = [x for a in arrays for x in a]
    return ' '.join(map(str, sorted(set(combined))))


SPECS = [
dict(id=3, title='匹配相邻大小关系的子数组', tags=['KMP', '数组'],
desc='给定整数数组 a 和长度为 m 的模式 p。p 的值为 1、0、−1，分别要求后一个元素比前一个大、相等或小。求长度恰为 m+1 且全部相邻比较匹配模式的连续子数组数量，允许重叠。',
input='第一行 n m（2≤n≤10000，1≤m<n）；第二行 n 个整数（−10⁹..10⁹）；第三行 m 个模式值。',
idea='将相邻比较转换成 −1、0、1 序列，用 KMP 匹配整个模式，成功后按前缀函数回退以保留重叠匹配。',
proof='长度 m+1 的原数组窗口与长度 m 的相邻符号窗口一一对应。KMP 的状态是已扫描序列后缀与模式前缀的最大匹配长度；失配回退保留所有可能的前缀，达到 m 恰好对应一个合法窗口。',
complexity='时间 O(n+m)，额外空间 O(m)。',
samples=[([1,4,4,1,3,5,5,3],[1,0,-1]), ([2,2,2,2],[0,0]), ([3,2,1],[1])],
random=lambda r:(lambda a:(a,[r.choice([-1,0,1]) for _ in range(r.randint(1,len(a)-1))]))([r.randint(-3,3) for _ in range(r.randint(2,12))]),
edges=[(([0]*10000,[0]*5000),'5000'), ((list(range(10000)),[1]),'9999'), (([-10**9,10**9],[-1]),'0')],
encode=lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n', oracle=pattern_oracle,
code='''def solve(data):
    n,m=map(int,data[:2]); a=list(map(int,data[2:2+n])); p=list(map(int,data[2+n:])); pi=[0]*m
    for i in range(1,m):
        j=pi[i-1]
        while j and p[i]!=p[j]:j=pi[j-1]
        if p[i]==p[j]:j+=1
        pi[i]=j
    answer=j=0
    for i in range(n-1):
        v=(a[i+1]>a[i])-(a[i+1]<a[i])
        while j and v!=p[j]:j=pi[j-1]
        if v==p[j]:j+=1
        if j==m:answer+=1; j=pi[j-1]
    return str(answer)
''', mutants=[('漏掉重叠匹配','answer+=1; j=pi[j-1]','answer+=1; j=0'), ('比较方向相反','(a[i+1]>a[i])-(a[i+1]<a[i])','(a[i+1]<a[i])-(a[i+1]>a[i])')]),
dict(id=6, title='切比雪夫距离内的碰撞对象对', tags=['哈希表','坐标'],
desc='给定 n 个对象的整数中心坐标。按原题明确给出的判定式，两个不同对象碰撞当且仅当 |x₁−x₂|≤1 且 |y₁−y₂|≤1。求无序碰撞对数；同坐标的不同对象也组成一对。以此距离判定为准，不使用图形边长推导。',
input='第一行 n（1..1000），随后 n 行 x y（−10000..10000）。',
idea='依次读入坐标，查找九个相邻整数坐标已有的对象数量并累加，再记录当前对象。',
proof='整数坐标下，合法的横纵差值只能分别是 −1、0、1。九个坐标查找恰好包含所有此前与当前对象碰撞的对象。每对仅在较晚对象加入时计数一次，重复坐标通过频次计数。',
complexity='时间 O(n)，额外空间 O(n)。',
samples=[[(0,0),(1,1),(2,0),(0,2)], [(0,0),(0,0),(0,0)], [(0,0),(2,0)]],
random=lambda r:[(r.randint(-3,3),r.randint(-3,3)) for _ in range(r.randint(1,20))],
edges=[([(10000,-10000)]*1000,'499500'), ([(i*2,0) for i in range(1000)],'0')],
encode=lambda a:str(len(a))+'\n'+''.join(f'{x} {y}\n' for x,y in a),
oracle=lambda a:str(sum(abs(a[i][0]-a[j][0])<=1 and abs(a[i][1]-a[j][1])<=1 for i in range(len(a)) for j in range(i))),
code='''def solve(data):
    n=int(data[0]); values=list(map(int,data[1:])); seen={}; answer=0
    for i in range(n):
        x,y=values[2*i:2*i+2]
        for dx in (-1,0,1):
            for dy in (-1,0,1):answer+=seen.get((x+dx,y+dy),0)
        seen[x,y]=seen.get((x,y),0)+1
    return str(answer)
''', mutants=[('漏掉边界距离1','(-1,0,1)','(0,)'), ('重复坐标只算一个','seen.get((x,y),0)+1','1')]),
dict(id=8, title='每次建房后的最长连续房屋', tags=['哈希表','区间合并'],
desc='依次在整数坐标上建房，每次操作后输出当前已占用位置中最长连续整数段的长度。重复给出已建位置时状态不变。',
input='第一行 n（1..100000），第二行 n 个位置（0..10⁹）。重复位置按集合插入处理，不增加房屋数量。',
idea='哈希表保存已占用位置和每段两端的长度。新位置将左右相邻段合并，并更新新段两端及全局最大值。',
proof='新位置尚未占用时，相邻已占用位置必是对应段的端点，记录的长度可直接使用。合并长度是左段长度+1+右段长度；只需修改新段端点供之后查找。重复插入不改变集合。',
complexity='期望时间 O(n)，额外空间 O(n)。',
samples=[[2,1,4],[1,3,0,4],[2,2,1,3]],random=lambda r:[r.randint(0,15) for _ in range(r.randint(1,20))],
edges=[(list(range(100000)),' '.join(map(str,range(1,100001)))), ([10**9]*100000,' '.join(['1']*100000)), ([0,2,4,1,3],'1 1 1 3 5')],
encode=array,oracle=houses_oracle,
code='''def solve(data):
    lengths={}; best=0; answers=[]
    for x in map(int,data[1:]):
        if x not in lengths:
            left=lengths.get(x-1,0); right=lengths.get(x+1,0); total=left+right+1
            lengths[x]=total; lengths[x-left]=total; lengths[x+right]=total; best=max(best,total)
        answers.append(best)
    return ' '.join(map(str,answers))
''',mutants=[('漏掉右侧合并','right=lengths.get(x+1,0)','right=0'), ('重复建房也合并','if x not in lengths:','if True:')]),
dict(id=12,title='数轴障碍与区间可用性',tags=['树状数组','离散化'],
desc='依次执行操作：1 x 在空坐标 x 放置障碍；2 x size 检查半开区间 [x,x+size) 内是否没有障碍，是则输出字符 1，否则输出 0。检查操作不放置任何物体。将所有检查结果连成一串。',
input='本站标准输入规模：第一行 q（1..100000）；随后 q 行操作 1 x 或 2 x size，x 在 −10⁹..10⁹，size 在 1..10⁹。保证放障碍时该坐标为空，至少有一次检查。',
idea='预读所有放置坐标并离散化，用树状数组记录已放置数量。两个二分下标之间的区间计数为零时可放置。',
proof='离散化只保留可能有障碍的坐标，不改变大小关系。左边界使用 lower_bound(x)，右边界使用 lower_bound(x+size)，其差分恰好统计半开区间内已执行的放置操作，不会包含未来的障碍或右端点。',
complexity='时间 O(q log q)，额外空间 O(q)。',
samples=[[(1,2),(1,5),(2,3,2),(2,3,3),(2,1,1),(2,1,2)],[(2,0,1),(1,0),(2,0,1)],[(1,-2),(2,-3,1),(2,-3,2)]],random=random_ops,
edges=[([(1,i) for i in range(99999)]+[(2,0,10**9)],'0'), ([(2,-10**9,10**9)]*100000,'1'*100000)],
encode=lambda ops:str(len(ops))+'\n'+''.join(' '.join(map(str,o))+'\n' for o in ops),oracle=obstacles_oracle,
code='''def solve(data):
    from bisect import bisect_left
    q=int(data[0]); cursor=1; ops=[]
    for _ in range(q):
        t=int(data[cursor]); size=2 if t==1 else 3; ops.append(tuple(map(int,data[cursor:cursor+size]))); cursor+=size
    coords=sorted(o[1] for o in ops if o[0]==1); bit=[0]*(len(coords)+1); result=[]
    def prefix(i):
        total=0
        while i:total+=bit[i]; i-=i&-i
        return total
    for op in ops:
        if op[0]==1:
            i=bisect_left(coords,op[1])+1
            while i<len(bit):bit[i]+=1; i+=i&-i
        else:
            left=bisect_left(coords,op[1]); right=bisect_left(coords,op[1]+op[2])
            result.append('1' if prefix(right)==prefix(left) else '0')
    return ''.join(result)
''', mutants=[('错误包括右端点','op[1]+op[2])','op[1]+op[2]+1)'), ('检查结果颠倒',"'1' if prefix(right)==prefix(left) else '0'","'0' if prefix(right)==prefix(left) else '1'")]),
dict(id=13,title='大写与小写字母数量之差',tags=['字符串'],
desc='统计文本的大写英文字母数量减去小写英文字母数量。数字、空格和标点忽略。空字符串的结果为 0。',
input='一行长度 0..100 的 ASCII 可打印字符（可含空格）；保留整行，不对内容去首尾空格。',
idea='扫描字符，大写加一，小写减一，其他字符不改变累计值。',
proof='每个大写字符贡献 +1，每个小写字符贡献 −1，其他字符贡献零。逐个相加就是两个计数之差。',
complexity='时间 O(n)，额外空间 O(1)。',
samples=['CodeSignal','a',''],random=lambda r:''.join(r.choice('abcXYZ 019!?') for _ in range(r.randint(0,100))),
edges=[('A'*100,'100'), ('z'*100,'-100'), (' '*100,'0')],encode=lambda s:s+'\n',oracle=lambda s:str(sum(s.count(c) for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')-sum(s.count(c) for c in 'abcdefghijklmnopqrstuvwxyz')),
code='''def solve(data):
    answer=0
    for ch in data:
        if 'A'<=ch<='Z':answer+=1
        elif 'a'<=ch<='z':answer-=1
    return str(answer)
''',raw=True,mutants=[('把差取绝对值','return str(answer)','return str(abs(answer))'), ('忽略小写字母','answer-=1','answer+=0')]),
dict(id=18,title='第 k 个缺失的正整数',tags=['二分查找'],
desc='给定严格递增的正整数数组 a 和正整数 k，输出没有出现在数组中的第 k 个正整数。',
input='本站标准输入规模：第一行 n k（1..100000，1..10⁹），第二行 n 个严格递增正整数（1..10⁹）。',
idea='在下标 i 处，缺失个数是 a[i]−i−1。二分第一个缺失个数达到 k 的位置，结果为 k 加该下标；不存在时下标取 n。',
proof='严格递增保证缺失计数单调。插入点左侧的数组元素都在答案之前，右侧都在答案之后；若左侧共有 i 个已存在数字，答案之前及自身共有 k 个缺失数字，故答案为 k+i。',
complexity='二分时间 O(log n)，输入存储 O(n)。',
samples=[([2,3,4,7,11],5),([1,2,3,4],2),([3],1)],random=lambda r:(sorted(r.sample(range(1,35),r.randint(1,12))),r.randint(1,20)),
edges=[((list(range(1,100001)),10**9),'1000100000'), (([10**9],10**9),'1000000001'), (([2],1),'1')],
encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=kth_oracle,
code='''def solve(data):
    n,k=map(int,data[:2]); a=list(map(int,data[2:])); lo=0; hi=n
    while lo<hi:
        mid=(lo+hi)//2
        if a[mid]-mid-1<k:lo=mid+1
        else:hi=mid
    return str(k+lo)
''',mutants=[('缺失计数差一','a[mid]-mid-1<k','a[mid]-mid<k'), ('越过恰好第k个','a[mid]-mid-1<k','a[mid]-mid-1<=k')]),
dict(id=19,title='最多翻转 k 个零后的连续一',tags=['滑动窗口'],
desc='给定二进制数组，可将至多 k 个 0 翻成 1。求操作后最长连续 1 段的长度，不要求用完翻转次数。',
input='第一行 n k（1≤n≤100000，0≤k≤n）；第二行 n 个 0 或 1。',
idea='滑动窗口维护其中零的数量，超过 k 时收缩左端，记录所有合法窗口的最大长度。',
proof='一段区间可全部变成 1 当且仅当零数量不超过 k。对于每个右端，收缩后的左端给出以该右端结尾的最长合法窗口；扫描全部右端便包含全局最优段。',
complexity='时间 O(n)，除输入外额外空间 O(1)。',
samples=[([1,1,1,0,0,0,1,1,1,1,0],2),([0],0),([1,0,1],3)],random=lambda r:(lambda a:(a,r.randint(0,len(a))))([r.randint(0,1) for _ in range(r.randint(1,16))]),
edges=[(([0]*100000,50000),'50000'), (([1]*100000,0),'100000'), (([0,1]*50000,1),'3')],
encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=ones_oracle,
code='''def solve(data):
    n,k=map(int,data[:2]); a=list(map(int,data[2:])); left=zeros=best=0
    for right,x in enumerate(a):
        if x==0:zeros+=1
        while zeros>k:
            if a[left]==0:zeros-=1
            left+=1
        best=max(best,right-left+1)
    return str(best)
''',mutants=[('把1当作翻转目标','==0','==1'), ('窗口长度少一','right-left+1','right-left')]),
dict(id=20,title='合并三个有序数组并去重',tags=['归并','双指针'],
desc='将三个非递减整数数组合并为一个严格递增数组，相同的值只保留一次。输入数组可以为空。',
input='本站标准输入规模：先输入 n m k（每个为 0..100000）；随后三行分别为三个数组（空数组对应空行），值为 −10⁹..10⁹，每个数组非递减。',
idea='维护三个指针，每次取尚未消费的最小值，只有不同于输出末尾时才追加，之后推进提供此值的指针。',
proof='每个输入已有序，因此未消费元素的最小值必在三个指针处。不断取最小值保证输出非递减，相等值在归并顺序中相邻，跳过重复尾值恰好保留每个不同整数一次。',
complexity='时间 O(n+m+k)，额外空间为输出 O(n+m+k)。',
samples=[([1,3,5],[1,2,5,6],[2,4,6]),([],[0,0,1],[1,2]),([],[],[])],
random=lambda r:tuple(sorted(r.randint(-10,10) for _ in range(r.randint(0,12))) for _ in range(3)),
edges=[(([7]*100000,[7]*100000,[7]*100000),'7'), ((list(range(100000)),[],[]),' '.join(map(str,range(100000)))), (([-10**9],[],[10**9]),'-1000000000 1000000000')],
encode=lambda arrays:' '.join(str(len(a)) for a in arrays)+'\n'+''.join(' '.join(map(str,a))+'\n' for a in arrays),oracle=merge_oracle,
code='''def solve(data):
    sizes=list(map(int,data[:3])); arrays=[]; offset=3
    for size in sizes:arrays.append(list(map(int,data[offset:offset+size]))); offset+=size
    indices=[0,0,0]; answer=[]
    while True:
        candidates=[(arrays[i][indices[i]],i) for i in range(3) if indices[i]<sizes[i]]
        if not candidates:break
        value,source=min(candidates)
        if not answer or answer[-1]!=value:answer.append(value)
        indices[source]+=1
    return ' '.join(map(str,answer))
''',mutants=[('不去重','if not answer or answer[-1]!=value:','if True:'), ('漏掉第三个数组','for i in range(3) if','for i in range(2) if')]),
]

def falling_oracle(board):
    import itertools
    stars=[(i,j) for i,row in enumerate(board) for j,v in enumerate(row) if v=='*']
    obstacles=[(i,j) for i,row in enumerate(board) for j,v in enumerate(row) if v=='#']
    distance=len(board)-1-max(i for i,j in stars)
    for count in range(len(obstacles)+1):
        for removed in itertools.combinations(obstacles,count):
            remaining=set(obstacles)-set(removed)
            if all((i+d,j) not in remaining for d in range(1,distance+1) for i,j in stars):return str(count)


def random_board(r):
    rows=r.randint(1,3); cols=r.randint(1,3); stars={(r.randrange(rows),r.randrange(cols))}
    for _ in range(r.randint(0,4)):
        i,j=r.choice(sorted(stars)); di,dj=r.choice([(1,0),(-1,0),(0,1),(0,-1)])
        if 0<=i+di<rows and 0<=j+dj<cols:stars.add((i+di,j+dj))
    return [''.join('*' if (i,j) in stars else r.choice('-#') for j in range(cols)) for i in range(rows)]


def meeting_oracle(x):
    intervals,length=x; busy=set()
    for a,b in intervals:busy.update(range(a,b))
    return str(next((start for start in range(1441-length) if all(t not in busy for t in range(start,start+length))),-1))


def frequent_oracle(x):
    a,k=x
    return str(max([0]+[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if max(collections.Counter(a[i:j]).values())>k]))


def vowels_oracle(s):
    positions=[i for i,c in enumerate(s) if c in 'aeiou']; result=list(s)
    for index,pos in enumerate(positions):result[positions[(index+1)%len(positions)]]=s[pos]
    return ''.join(result)


def matrix_input(a):return f'{len(a)} {len(a[0])}\n'+''.join(' '.join(map(str,row))+'\n' for row in a)


def diagonal_oracle(a):
    cells=[(i,j) for i in range(len(a)) for j in range(len(a[0]))]
    cells.sort(key=lambda p:(sum(p),-p[0] if sum(p)%2==0 else p[0]))
    return ' '.join(str(a[i][j]) for i,j in cells)


def local_oracle(a):
    found=[]
    for i,row in enumerate(a):
        for j,v in enumerate(row):
            if v and not any((x,y)!=(i,j) and abs(x-i)<=v and abs(y-j)<=v and not(abs(x-i)==v and abs(y-j)==v) and a[x][y]>=v for x in range(len(a)) for y in range(len(a[0]))):found.append((i,j))
    return str(len(found))+''.join(f'\n{i} {j}' for i,j in found)


def robot_oracle(x):
    a,ops=x; rows=len(a); cols=len(a[0]); cells={(i,j):a[i][j] for i in range(rows) for j in range(cols)}
    for op in ops:
        t=op[0]; changed={}
        for (i,j),v in cells.items():
            ni,nj=i,j
            if t=='swapRows':ni=op[2] if i==op[1] else op[1] if i==op[2] else i
            elif t=='swapColumns':nj=op[2] if j==op[1] else op[1] if j==op[2] else j
            elif t=='reverseRow' and i==op[1]:nj=cols-1-j
            elif t=='reverseColumn' and j==op[1]:ni=rows-1-i
            elif t=='rotate90Clockwise':ni,nj=j,rows-1-i
            changed[ni,nj]=v
        cells=changed
        if t=='rotate90Clockwise':rows,cols=cols,rows
    return f'{rows} {cols}\n'+'\n'.join(' '.join(str(cells[i,j]) for j in range(cols)) for i in range(rows))


def random_robot(r):
    rows=r.randint(1,5); cols=r.randint(1,5); a=[[r.randint(0,99) for _ in range(cols)] for _ in range(rows)]; ops=[]
    for _ in range(r.randint(1,12)):
        t=r.choice(['swapRows','swapColumns','reverseRow','reverseColumn','rotate90Clockwise'])
        if t=='swapRows':op=(t,r.randrange(rows),r.randrange(rows))
        elif t=='swapColumns':op=(t,r.randrange(cols),r.randrange(cols))
        elif t=='reverseRow':op=(t,r.randrange(rows))
        elif t=='reverseColumn':op=(t,r.randrange(cols))
        else:op=(t,); rows,cols=cols,rows
        ops.append(op)
    return a,ops


SPECS.extend([
dict(id=1,title='刚性图形下落需要移除的障碍',tags=['网格','差分'],desc='网格中 * 是一个非空四邻接连通图形，# 是障碍，- 是空格。图形不旋转、不变形，只整体逐格向下移动，直到至少一个格子到达底行。求必须移除的最少不同障碍数量。原站样例不满足连通约束，本站重新编写符合规则的样例。',input='第一行行数 R 和列数 C（1..100）；随后 R 行长度 C 的字符串，只含 *、#、-，保证图形非空且四邻接连通。',idea='下移距离由图形最底格确定。每个星号沿本列扫过一个行区间，用列差分合并区间，再数被覆盖的障碍。',proof='最底格抵达底行前必须恰好经过每个中间位移；任何扫过位置的障碍都必须删。删去扫过位置的所有障碍后每一步都无碰撞，因此统计这些不同障碍既必要又充分。',complexity='时间和空间 O(RC)。',samples=[['**','-#','--'],['*'],['***','###','###']],random=random_board,edges=[(['*'*100]+['#'*100]*99,'9900'),(['-'*100]*99+['*'*100],'0')],encode=lambda b:f'{len(b)} {len(b[0])}\n'+'\n'.join(b)+'\n',oracle=falling_oracle,
code='''def solve(data):
    rows,cols=map(int,data[:2]); board=data[2:]; bottom=max(i for i in range(rows) if '*' in board[i]); distance=rows-1-bottom; answer=0
    for j in range(cols):
        diff=[0]*(rows+1)
        for i in range(rows):
            if board[i][j]=='*':diff[i+1]+=1; diff[i+distance+1]-=1
        active=0
        for i in range(rows):
            active+=diff[i]
            if active and board[i][j]=='#':answer+=1
    return str(answer)
''',mutants=[('忽略下落距离','distance=rows-1-bottom','distance=0'),('把没有扫过的障碍也删除',"if active and board[i][j]=='#':","if board[i][j]=='#':")]),
dict(id=2,title='统计 k 的非负整数次幂',tags=['数学'],desc='给定正整数数组及 k，统计其中等于 k⁰、k¹、k² 等非负整数次幂的元素个数，重复项分别计数。原站首例答案有误，本站已校正。',input='第一行 n k（1≤n≤100000，2≤k≤10⁹），第二行 n 个正整数（1..10⁹）。',idea='对每个数反复除去因子 k，最终等于 1 时计数。',proof='k≥2，因此每次整除严格减小数值。能恰好除到 1 等价于原数为 k 的非负整数次幂；1 无需除法，是 k⁰。',complexity='时间 O(n logₖ M)，额外空间 O(1)。',samples=[([1,2,3,8,16,10,120],2),([10000,100,1000000,101,1010,1010000],10),([1,1,3],3)],random=lambda r:([r.randint(1,150) for _ in range(r.randint(1,18))],r.randint(2,10)),edges=[(([1]*100000,10**9),'100000'),(([10**9]*100000,10),'100000'),(([999999999]*100000,10),'0')],encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=lambda x:str(sum(v in {x[1]**p for p in range(31)} for v in x[0])),code='''def solve(data):
    n,k=map(int,data[:2]); answer=0
    for value in map(int,data[2:]):
        while value>1 and value%k==0:value//=k
        if value==1:answer+=1
    return str(answer)
''',mutants=[('排除k的0次幂','while value>1','if value==1:continue\n        while value>1'),('只检验一次整除','while value>1','if value>1')]),
dict(id=4,title='最早的共同空闲会议时间',tags=['区间合并'],desc='一天为 [0,1440) 分钟。给出所有员工的忙碌半开区间，寻找所有员工都空闲且能容纳指定长度会议的最早整数开始时间，不存在输出 −1。原站样例答案240与忙碌区间冲突，本站校正为60。',input='本站将各员工忙碌区间合并输入：第一行区间总数 b（0..100000）和会议长度 L（1..1440）；随后 b 行 start finish（0≤start<finish≤1440）。区间可重叠、未排序。',idea='按区间起点排序，维护已扫过忙碌时间的最右端；每个区间前的空隙足够长便返回其起点。',proof='所有员工共同空闲等价于不属于任一忙碌区间。排序扫描不断合并重叠忙时，检查到的空隙按时间递增；第一个长度足够的空隙必然最早。',complexity='时间 O(b log b)，空间 O(b)。',samples=[([(180,240),(720,900),(0,60),(540,600),(330,360),(540,600)],120),([],1440),([(0,1440)],1)],random=lambda r:([(lambda a:(a,r.randint(a+1,1440)))(r.randint(0,1439)) for _ in range(r.randint(0,8))],r.randint(1,1440)),edges=[(([(0,1)]*100000,1439),'1'),(([(1,1440)],1),'0')],encode=lambda x:f'{len(x[0])} {x[1]}\n'+''.join(f'{a} {b}\n' for a,b in x[0]),oracle=meeting_oracle,code='''def solve(data):
    count,length=map(int,data[:2]); values=list(map(int,data[2:])); intervals=sorted(zip(values[::2],values[1::2])); end=0
    for start,finish in intervals:
        if start-end>=length:return str(end)
        end=max(end,finish)
    return str(end if 1440-end>=length else -1)
''',mutants=[('空隙恰好够也拒绝','start-end>=length','start-end>length'),('忽略最后空隙','end if 1440-end>=length else -1','-1')]),
dict(id=5,title='含高频值的最长连续子数组',tags=['哈希表'],desc='寻找最长连续子数组，要求其中至少一个值出现次数严格大于阈值 k。不存在输出0。这里按题面“严格大于”判定；原站两例都应取完整数组长度7，本站已校正。',input='第一行 n k（1≤k≤n≤100000），第二行 n 个值（0..10⁹）。',idea='统计整个数组的频次。只要存在频次大于k，整个数组就是最优；否则任何子数组都不可能满足。',proof='扩展区间不会降低已有值的出现次数，因此存在合法子数组就必然有合法的完整数组。反之，全数组所有值都不超过k时，更短区间也不可能超过k。',complexity='期望时间 O(n)，额外空间 O(n)。',samples=[([1,1,1,2,3,1,1],3),([1,2,3,2,3,4,1],1),([1,1],2)],random=lambda r:(lambda a:(a,r.randint(1,len(a))))([r.randint(0,5) for _ in range(r.randint(1,12))]),edges=[(([0]*100000,99999),'100000'),(([0]*100000,100000),'0')],encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=frequent_oracle,code='''def solve(data):
    from collections import Counter
    n,k=map(int,data[:2]); counts=Counter(data[2:])
    return str(n if max(counts.values())>k else 0)
''',mutants=[('把严格大于当大于等于','max(counts.values())>k','max(counts.values())>=k'),('输出最大频次而非区间长度','n if max','max(counts.values()) if max')]),
dict(id=7,title='元音位置循环右移',tags=['字符串'],desc='将字符串中小写元音 a、e、i、o、u 的字符按出现顺序循环右移一位：每个元音移到下一个元音位置，最后一个移到第一个位置。其它字符位置不变。没有元音时原样输出。',input='一行长度1..1000的ASCII可打印文本，可含空格；仅小写aeiou视作元音。',idea='提取元音字符并右旋一位，再依次填回原来的元音位置。',proof='旋转后的第一个元音来自原末尾，第i个来自原i−1个，恰好实现每个原元音移到下一位置。仅替换元音位置，其他字符不变。',complexity='时间和额外空间 O(n)。',samples=['codesignal','plain text','xyz'],random=lambda r:''.join(r.choice('aeioubc 019!?A') for _ in range(r.randint(1,60))),edges=[('a'*999+'e','e'+'a'*999),(' '*1000,' '*1000)],encode=lambda s:s+'\n',oracle=vowels_oracle,raw=True,code='''def solve(data):
    vowels=[c for c in data if c in 'aeiou']
    if not vowels:return data
    rotated=iter(vowels[-1:]+vowels[:-1])
    return ''.join(next(rotated) if c in 'aeiou' else c for c in data)
''',mutants=[('循环方向反了','vowels[-1:]+vowels[:-1]','vowels[1:]+vowels[:1]'),('完全不移动元音','vowels[-1:]+vowels[:-1]','vowels')]),
dict(id=9,output='第一行输出最终矩阵的行数和列数；随后逐行输出矩阵，各行元素空格分隔。',title='矩阵机器人的变换命令',tags=['矩阵','模拟'],desc='执行swapRows r1 r2、swapColumns c1 c2、reverseRow r、reverseColumn c、rotate90Clockwise命令。下标从0开始，旋转为顺时针90度，可改变行列数。所有命令下标对当时矩阵合法。原站组合样例答案不符合命令，本站重新计算。',input='本站输入：R C（1..100），随后R行各C个0..10⁹整数，然后q（1..100），随后q行命令。',idea='交换操作直接交换对应元素，反转操作倒序对应行或列，旋转将第j列自下向上变成新第j行。',proof='逐个操作应用其定义的坐标置换。顺时针旋转把旧(i,j)映到(j,R−1−i)，列从底到顶恰好构成新行。按顺序组合全部置换得到最终矩阵。',complexity='时间 O(qRC)，额外空间 O(RC)。',samples=[([[1,2,3],[4,5,6]], [('rotate90Clockwise',)]),([[1,2],[3,4]],[('swapRows',0,1),('reverseColumn',1)]),([[1]],[('reverseRow',0)])],random=random_robot,edges=[(([[7]*100 for _ in range(100)],[('rotate90Clockwise',)]*100),'100 100\n'+'\n'.join(' '.join(['7']*100) for _ in range(100)))],encode=lambda x:matrix_input(x[0])+str(len(x[1]))+'\n'+''.join(' '.join(map(str,o))+'\n' for o in x[1]),oracle=robot_oracle,code='''def solve(data):
    rows,cols=map(int,data[:2]); offset=2; a=[]
    for _ in range(rows):a.append(list(map(int,data[offset:offset+cols]))); offset+=cols
    q=int(data[offset]); offset+=1
    for _ in range(q):
        t=data[offset]; offset+=1
        if t=='rotate90Clockwise':a=[list(row) for row in zip(*a[::-1])]
        elif t=='swapRows':
            i,j=map(int,data[offset:offset+2]); offset+=2; a[i],a[j]=a[j],a[i]
        elif t=='swapColumns':
            i,j=map(int,data[offset:offset+2]); offset+=2
            for row in a:row[i],row[j]=row[j],row[i]
        elif t=='reverseRow':
            i=int(data[offset]); offset+=1; a[i].reverse()
        else:
            j=int(data[offset]); offset+=1
            for i in range(len(a)//2):a[i][j],a[-1-i][j]=a[-1-i][j],a[i][j]
    return f'{len(a)} {len(a[0])}\\n'+'\\n'.join(' '.join(map(str,row)) for row in a)
''',mutants=[('旋转时只转置','zip(*a[::-1])','zip(*a)'),('行反转无效','a[i].reverse()','a[i].sort()')]),
dict(id=10,title='三位数的三个数字互不相同',tags=['枚举'],desc='给定闭区间[left,right]，统计其中百位、十位、个位两两不同的三位整数。原站476..979给出5有误，本站使用按定义重新计算的样例。',input='一行left right（100≤left≤right≤999）。',idea='遍历区间，将每个数字转为三位字符，集合大小为3则计数。',proof='集合恰好包含不同的数字字符，大小为3当且仅当三位两两不同；闭区间枚举每个整数一次。',complexity='时间 O(right−left+1)，额外空间 O(1)。',samples=[(476,979),(100,100),(102,102)],random=lambda r:(lambda a:(a,r.randint(a,999)))(r.randint(100,999)),edges=[((100,999),'648'),((987,987),'1')],encode=lambda x:f'{x[0]} {x[1]}\n',oracle=lambda x:str(sum(x[0]<=100*a+10*b+c<=x[1] for a in range(1,10) for b in range(10) for c in range(10) if a!=b and a!=c and b!=c)),code='''def solve(data):
    left,right=map(int,data)
    return str(sum(len(set(str(v)))==3 for v in range(left,right+1)))
''',mutants=[('漏掉右端点','range(left,right+1)','range(left,right)'),('要求只有两种数字','==3','==2')]),
dict(id=14,title='矩阵交替对角线遍历',tags=['矩阵'],desc='从左上角开始，按行列下标和递增的顺序遍历对角线。偶数下标和沿左下到右上，奇数下标和沿右上到左下。输出遍历序列。原站3×3样例顺序错误，本站按标准交替规则校正。',input='本站输入规模：R C（1..100），随后R行各C个整数（−10⁹..10⁹）。',idea='枚举行列下标和d，确定该对角线合法的行下标范围。偶数d逆序行下标，奇数d正序。',proof='每格属于唯一的对角线d=i+j，合法行范围保证不越界且完整覆盖。按d递增并交替行方向，恰好符合给定遍历规则。',complexity='时间和输出空间 O(RC)。',samples=[[[1,2,3],[4,5,6],[7,8,9]],[[1,2],[3,4]],[[5]]],random=lambda r:[[r.randint(-20,20) for _ in range(4)] for _ in range(r.randint(1,6))],edges=[([[3]*100 for _ in range(100)],' '.join(['3']*10000)),([list(range(100))],' '.join(map(str,range(100))))],encode=matrix_input,oracle=diagonal_oracle,code='''def solve(data):
    rows,cols=map(int,data[:2]); a=list(map(int,data[2:])); answer=[]
    for d in range(rows+cols-1):
        low=max(0,d-cols+1); high=min(rows-1,d); indices=range(high,low-1,-1) if d%2==0 else range(low,high+1)
        for i in indices:answer.append(a[i*cols+d-i])
    return ' '.join(map(str,answer))
''',mutants=[('对角线方向颠倒','d%2==0','d%2==1'),('遗漏最后一条对角线','range(rows+cols-1)','range(rows+cols-2)')]),
dict(id=15,output='第一行输出局部极大值数量 t；随后 t 行输出 row col（从0开始），按行、列升序；没有极大值时只输出0。',title='排除角落的局部极大值',tags=['矩阵','枚举'],desc='对非零格(i,j)值v，检查以它为中心、半径v的正方形区域，忽略中心自身以及原完整正方形的四个角，只比较矩阵内格子。若没有其它值≥v，则为局部极大值。按行、列升序输出坐标。原站样例包含不合法点，本站重新计算。',input='本站输入规模：R C（1..30），随后R行各C个非负整数（0..10⁹）。下标从0开始，四角按完整正方形定义，不能把裁剪后区域的四角排除。',idea='枚举每个非零格，将检查范围裁剪到矩阵内，逐格判断，跳过中心和原正方形角点。',proof='范围裁剪只去掉不存在的格子。循环恰好覆盖所有按规则应比较的格子，出现≥v则不满足严格极大，否则满足。按行列顺序扫描使输出有序。',complexity='时间 O((RC)²)，除输出外空间 O(RC)。',samples=[[[3,0,0,0,0],[0,0,1,0,0],[0,0,2,0,0],[0,0,0,0,0],[0,3,0,0,3]],[[1,0],[0,1]],[[0]]],random=lambda r:[[r.randint(0,5) for _ in range(4)] for _ in range(r.randint(1,5))],edges=[([[10**9]*30 for _ in range(30)],'0'),([[0]*30 for _ in range(30)],'0'),([[10**9]],'1\n0 0')],encode=matrix_input,oracle=local_oracle,code='''def solve(data):
    rows,cols=map(int,data[:2]); vals=list(map(int,data[2:])); result=[]
    for i in range(rows):
        for j in range(cols):
            v=vals[i*cols+j]
            if not v:continue
            ok=True
            for x in range(max(0,i-v),min(rows,i+v+1)):
                for y in range(max(0,j-v),min(cols,j+v+1)):
                    if (x==i and y==j) or (abs(x-i)==v and abs(y-j)==v):continue
                    if vals[x*cols+y]>=v:ok=False; break
                if not ok:break
            if ok:result.append((i,j))
    return str(len(result))+''.join(f'\\n{i} {j}' for i,j in result)
''',mutants=[('相等值也当严格最大','vals[x*cols+y]>=v','vals[x*cols+y]>v'),('没有排除原正方形角落','or (abs(x-i)==v and abs(y-j)==v)','or False')]),
])

SKIPPED = {
    'oa-meta-1': '原样例的星号并非一个四邻接连通块；刚性竖直下落扫过 (1,0)、(1,2)、(4,1) 三个障碍，与给定答案 2 不同。',
    'oa-meta-2': '首例 2 的幂只有 1、2、8、16 四项，原答案 5 错误，需核对原始题。',
    'oa-meta-4': '原答案 240 对应会议 [240,360)，与员工忙碌 [330,360) 冲突；按题意最早可行为 60（空闲区间 [60,180)）。',
    'oa-meta-5': '按“某值出现次数严格超过阈值”，首例整段长度 7 已满足，原答案 6；原解实际上使用恰好阈值，语义冲突。',
    'oa-meta-7': 'codesignal 的元音依次 o,e,i,a，按所述右循环应得到 cadosegnil；但 plain text 的 a,i,e 右循环应为 plean tixt。长句原例需独立完整核对字符位置，暂不发布未验清的循环规则实例。',
    'oa-meta-9': '按原操作逐步执行，给定例子最后矩阵为 [[1,4,8],[3,6,9],[7,5,2]]，与源答案 [[3,4,1],[5,6,2],[9,8,7]] 冲突。',
    'oa-meta-10': '476..979 的两两不同数字远多于 5 个；仅 476、478、479、480、481、482 已有 6 个。',
    'oa-meta-11': 'Level 4 同时规定已合并账户历史不存在及历史转移至存活账户，未定义两个账户在合并前同时间余额如何查询；暂不杜撰历史合并/重建账户语义。',
    'oa-meta-14': '3×3 标准交替对角序应为 1 2 4 7 5 3 6 8 9，源例 1 2 4 7 3 5 8 6 9 冲突，且约束截断。',
    'oa-meta-15': '源例把 (2,2) 值2列为局部极大值，但其半径2范围内非角格 (4,1) 的值为3，应排除；本站按明确的完整正方形减角规则修正。',
    'oa-meta-16': '最近和可能有多组，原题没有等距时固定输出规则；当前 tokens 检查器会错判其它合法对，需要专用 checker。',
    'oa-meta-17': '原题明确允许任意峰值，当前 tokens 检查器会错判其它合法峰值，需要专用 checker；不能擅自改为最左峰值。',
}


next(spec for spec in SPECS if spec['id']==7).update(checker='exact')
next(spec for spec in SPECS if spec['id']==7)['edges'].append(('  a   e  ','  e   a  '))
next(spec for spec in SPECS if spec['id']==7)['mutants'].append(('删除或压缩空格',"return ''.join(next(rotated) if c in 'aeiou' else c for c in data)","return ' '.join(''.join(next(rotated) if c in 'aeiou' else c for c in data).split())"))

SAMPLE_EXPLANATIONS = {
    1: '样例1：图形下移两行，右上方星号必经右侧障碍；删除这一个障碍后两个星号均可到达底行，所以答案为1。',
    2: '样例1：属于2的非负整数次幂的是1、2、8、16，共4项；3、10和120都不是。',
    3: '样例1：起点0的[1,4,4,1]及起点4的[3,5,5,3]都依次上升、相等、下降，其它窗口不符，共2个。',
    4: '样例1：所有人都在[60,180)空闲，长度恰好120；此前[0,60)有人忙碌，所以最早开始时刻为60。',
    5: '样例1：完整数组中1出现5次，严格大于阈值3，因此完整长度7合法且最优。',
    6: '样例1：(1,1)与其余三个对象均满足两个坐标差不超过1，其余任意一对不满足，共3对。',
    7: '样例1：codesignal的元音按顺序为o、e、i、a，右移后是a、o、e、i，填回原元音位置得到cadosegnil。输出须完整保留原有空格，并以换行结尾。',
    8: '样例1：依次建在2、1、4。最长连续段依次是[2]、[1,2]、[1,2]，长度为1、2、2。',
    9: '样例1：2×3矩阵顺时针旋转成为3×2矩阵，三行依次为4 1、5 2、6 3；先输出新尺寸3 2。',
    10: '样例1：逐一检查476至979的三位数字，符合两两不同的整数共有371个；例如476合法，477不合法。',
    12: '样例1：障碍在2与5；四次查询[3,5)、[3,6)、[1,2)、[1,3)依次为空、不空、空、不空，得到1010。',
    13: '样例1：CodeSignal有2个大写字母C、S和8个小写字母，因此输出2−8=−6。',
    14: '样例1：各条对角线依次输出[1]、[2,4]、[7,5,3]、[6,8]、[9]，连接即为结果。',
    15: '样例1：仅(0,0)合法。(2,2)附近非角格(4,1)的3大于2；底行两个3互相落在对方比较区域内，因此都不合法。先输出数量1，再输出0 0。',
    18: '样例1：依次缺少1、5、6、8、9，因此第5个缺失正整数为9。',
    19: '样例1：翻转下标4、5处的两个0，可将区间[4,9]变为6个连续1；不存在更长且只含两个0的区间。',
    20: '样例1：三个数组中的不同值为1、2、3、4、5、6，每个仅输出一次并按升序排列。',
}


def execute(path, stdin, exact=False):
    result = subprocess.run([sys.executable,str(path)], input=stdin, text=True, capture_output=True, timeout=8)
    assert result.returncode == 0, (str(path), result.returncode, result.stderr)
    return result.stdout.replace('\r\n','\n') if exact else result.stdout.strip()


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):
        (OUT/folder).mkdir(parents=True, exist_ok=True)
    sources = {x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    metadata_only='--metadata-only' in sys.argv
    selected=set(int(arg) for arg in sys.argv[1:] if arg!='--metadata-only')
    registry=json.loads((OUT/'batches/meta-first.json').read_text())['items'] if selected or metadata_only else []
    reports=json.loads((OUT/'validation/meta-first.json').read_text())['problems'] if selected or metadata_only else []
    if not metadata_only:
        registry=[item for item in registry if int(item['id'].split('-')[-1]) not in selected]
        reports=[item for item in reports if int(item['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['id'] not in selected:continue
        identifier=f"oa-meta-{spec['id']}"; rng=random.Random(20260912+spec['id'])
        reader='sys.stdin.read().rstrip("\\n")' if spec.get('raw') else 'sys.stdin.read().split()'
        code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n'
        reference=OUT/'references'/f'{identifier}.py'
        if metadata_only:
            assert reference.read_text()==code, 'Metadata refresh must not change authored programs'
            path=OUT/'packages'/f'{identifier}.json'; package=json.loads(path.read_text())
            package['problem'].update(description=spec['desc']+'\n\n输入格式、样例与评测数据由 CSWork 整理编写。',output=spec.get('output','按题意输出答案；多项结果按顺序空格分隔，空数组输出空行。'),explanation=SAMPLE_EXPLANATIONS[spec['id']])
            normalized=json.dumps(package,ensure_ascii=False,separators=(',',':'))
            path.write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n')
            next(item for item in registry if item['id']==identifier)['packageChecksum']=hashlib.sha256(normalized.encode()).hexdigest()
            continue
        reference.write_text(code)
        exact=spec.get('checker')=='exact'
        values=spec['samples']+[spec['random'](rng) for _ in range(160)]
        oracles=[]
        for value in values:
            stdin=spec['encode'](value); expected=spec['oracle'](value)
            assert execute(reference,stdin,exact)==(expected+'\n' if exact else expected.strip()),(identifier,value,expected)
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        tests=oracles[:3]+[dict(input=spec['encode'](x),expectedOutput=y+'\n') for x,y in spec['edges']]+oracles[3:27]
        cases=[]
        for i,test in enumerate(tests):
            assert execute(reference,test['input'],exact)==(test['expectedOutput'] if exact else test['expectedOutput'].strip()),(identifier,i)
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**test,hidden=i>=3,weight=1))
        mutants=[]; kills=[]
        for index,(label,old,new) in enumerate(spec['mutants']):
            assert old in code
            mutation=code.replace(old,new); path=OUT/'negative-controls'/f'{identifier}-{index+1}.py'; path.write_text(mutation)
            rejected=[i for i,c in enumerate(cases) if execute(path,c['input'],exact)!=(c['expectedOutput'] if exact else c['expectedOutput'].strip())]
            assert rejected,(identifier,label,'survived')
            mutants.append(dict(name=label,code=mutation)); kills.append(dict(name=label,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Meta']+spec['tags'],description=spec['desc']+'\n\n输入格式、样例与评测数据由 CSWork 整理编写。',input=spec['input'],output=spec.get('output','按题意输出答案；多项结果按顺序空格分隔，空数组输出空行。'),explanation=SAMPLE_EXPLANATIONS[spec['id']],hints=[spec['idea']],timeLimit=3,memoryLimit=262144,outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 为什么正确\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        authored=[dict(language='python',code=code)]
        for folder,document in [('packages',json.loads(normalized)),('oracles',oracles),('mutants',mutants),('editorials',dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=authored,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork'))]:
            (OUT/folder/f'{identifier}.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
        registry.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=authored))
        reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=kills,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracles),'oracle cases;',len(cases)-3,'hidden;',len(mutants),'mutants rejected',flush=True)
    registry.sort(key=lambda item:int(item['id'].split('-')[-1]))
    reports.sort(key=lambda item:int(item['id'].split('-')[-1]))
    (OUT/'batches/meta-first.json').write_text(json.dumps(dict(schemaVersion=1,items=registry),ensure_ascii=False,indent=2)+'\n')
    authored_ids={item['id'] for item in registry}
    blocked={key:value for key,value in SKIPPED.items() if key not in authored_ids}
    (OUT/'validation/meta-first.json').write_text(json.dumps(dict(schemaVersion=1,seed=20260912,problems=reports,skipped=blocked,note='Local authored-code differential checks only; production publication still requires real sandbox evidence.'),ensure_ascii=False,indent=2)+'\n')
    reviews=[]
    for number in range(1,21):
        identifier=f'oa-meta-{number}'
        reason=SKIPPED.get(identifier,'题意明确，独立编写参考解与暴力对照数据，通过本地差分验证。')
        if identifier in authored_ids and identifier in SKIPPED:reason+=' 本站按明确的题面规则重写样例与独立题解，不采用原站错误答案。'
        if number==7:reason='按明确定义的元音循环右移独立实现，短例与160个随机输入通过对照，本站使用自行验证的样例。'
        if number==6:reason='按原题明确的切比雪夫距离≤1判定，不采用与该判定不一致的边长2碰撞盒描述。'
        reviews.append(dict(id=identifier,status='authored' if identifier in authored_ids else 'blocked',reason=reason))
    (OUT/'reviews/meta-first.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':
    main()
