"""Independently authored Uber 21..40; source solutions are never executed."""
import collections
import functools
import hashlib
import itertools
import json
from fractions import Fraction
from pathlib import Path
import random
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'
BATCH='uber-next'
SPECS=[]
def add(i,title,description,input,idea,proof,complexity,samples,explanation,random_case,encode,oracle,code,mutants,edges,**extra):
    SPECS.append(dict(id=i,title=title,description=description,input=input,idea=idea,proof=proof,complexity=complexity,samples=samples,explanation=explanation,random=random_case,encode=encode,oracle=oracle,code=code,mutants=mutants,edges=edges,**extra))
def array(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def tree_case(r,cap=8):
    n=r.randint(1,cap);return n,[(i,r.randrange(i)) for i in range(1,n)]
def open_oracle(x):
    s,edges=x;n=len(s);restricted=[i for i,c in enumerate(s) if c=='R'];answer=[0]*n
    for mask in range(1<<len(restricted)):
        if mask.bit_count()%2:continue
        opened={i for i,c in enumerate(s) if c=='O'}|{restricted[j] for j in range(len(restricted)) if mask>>j&1}
        for start in opened:
            seen={start};changed=True
            while changed:
                changed=False
                for a,b in edges:
                    if a in opened and b in opened and ((a in seen)!=(b in seen)):seen.update((a,b));changed=True
            answer[start]=max(answer[start],len(seen))
    return str(sum(answer))
def open_random(r):
    n,e=tree_case(r);return ''.join(r.choice('OR') for _ in range(n)),e
def open_encode(x):return f'{len(x[0])}\n{x[0]}\n'+''.join(f'{a} {b}\n' for a,b in x[1])
add(21,'成对开放国家后的可达数总和','树上国家分为开放O与限制R。每次只能将两个不同的R变为O，可做零次或多次。对每个起点分别选择转换方案，最大化从该起点仅经过O国家能访问的国家数，最后将这些最大值相加。各起点的转换方案相互独立；起点无法开放时计0。','第一行n，第二行长n的O/R串，随后n−1行无向树边u v（0开始）。1≤n≤50005。','R数为偶数时可全部开放。为奇数时只需留下一个R。删除每个候选R后，其每个相邻连通块都给块内起点提供一个可达规模；Euler序把这些块表示为子树区间或子树补集，用区间取最大值聚合。','更多开放不会降低可达数，因此偶数R全开、奇数R只留一个必有最优解。删除v后的每个子树分支大小为size[c]，父方向为n−size[v]。覆盖所有候选v的各分支并对每个起点取最大，恰好枚举所有最优方案。','时间O(n log n)，空间O(n)。',[('ROROROO',[(0,1),(0,2),(2,3),(2,4),(4,5),(4,6)]),('R',[]),('OR',[(0,1)])],'样例1：七个起点的最优可达数为4、4、5、5、5、5、5，总和33。样例2：唯一R不能成对开放，输出0。样例3：O起点只能访问自己，R起点不能开放，总和1。',open_random,open_encode,open_oracle,'''def solve(d):
    n=int(d[0]);s=d[1]
    if s.count('R')%2==0:return str(n*n)
    graph=[[] for _ in range(n)]
    for i in range(2,len(d),2):
        a,b=int(d[i]),int(d[i+1]);graph[a].append(b);graph[b].append(a)
    parent=[-1]*n;order=[];stack=[0]
    while stack:
        v=stack.pop();order.append(v)
        for w in graph[v]:
            if w!=parent[v]:parent[w]=v;stack.append(w)
    position=[0]*n;size=[1]*n
    for i,v in enumerate(order):position[v]=i
    for v in reversed(order[1:]):size[parent[v]]+=size[v]
    base=1
    while base<n:base*=2
    lazy=[0]*(2*base)
    def update(left,right,value):
        left+=base;right+=base
        while left<right:
            if left&1:lazy[left]=max(lazy[left],value);left+=1
            if right&1:right-=1;lazy[right]=max(lazy[right],value)
            left//=2;right//=2
    for v in range(n):
        if s[v]!='R':continue
        update(0,position[v],n-size[v]);update(position[v]+size[v],n,n-size[v])
        for w in graph[v]:
            if parent[w]==v:update(position[w],position[w]+size[w],size[w])
    for i in range(1,base):lazy[2*i]=max(lazy[2*i],lazy[i]);lazy[2*i+1]=max(lazy[2*i+1],lazy[i])
    return str(sum(lazy[base:base+n]))
''',[('错误允许奇数R全开放',"if s.count('R')%2==0",'if True'),('把起点本身再次计数','return str(sum(lazy[base:base+n]))','return str(sum(lazy[base:base+n])+n)')],[(('R'*50005,[(i-1,i) for i in range(1,50005)]),str(50005*50004)),(('R'+'O'*50004,[(0,i) for i in range(1,50005)]),'50004'),(('O'*50005,[(i-1,i) for i in range(1,50005)]),str(50005**2))],maxInputBytes=650080,timeLimit=6)

def health_oracle(x):
    health,deltas=x
    for delta in deltas:
        for _ in range(abs(delta)):
            if delta>0 and health<100:health+=1
            if delta<0 and health>0:health-=1
    return str(health)
add(22,'每步截断的生命值','初始生命值在0到100之间。依次加上每个变化量，并在每一步后将结果截断到[0,100]，输出最终值。','第一行n initial，第二行n个变化量。源题无数字范围，本站n为0..100000、initial为0..100、变化量为−10⁹..10⁹。','按顺序模拟，每步先相加再截断。','归纳看，每次更新都与题意完全相同；不能把变化先求和，因为中间截断会丢弃溢出的部分。','时间O(n)，除输入外空间O(1)。',[(12,[-4,-12,6,2]),(95,[20,-10]),(10,[])],'样例1：生命值依次为8、0、6、8，输出8。样例2：先达到上限100，再扣10，输出90。样例3：没有变化，保持10。',lambda r:(r.randint(0,100),[r.randint(-150,150) for _ in range(r.randint(0,12))]),lambda x:f'{len(x[1])} {x[0]}\n'+ ' '.join(map(str,x[1]))+'\n',health_oracle,'''def solve(d):
    health=int(d[1])
    for i in range(2,len(d)):health=max(0,min(100,health+int(d[i])))
    return str(health)
''',[('只在最后截断','health=max(0,min(100,health+int(d[i])))','health+=int(d[i])'),('漏上限','max(0,min(100,health+int(d[i])))','max(0,health+int(d[i]))')],[((0,[10**9,-10**9]*50000),'0'),((100,[-10**9,10**9]*50000),'100')],maxInputBytes=1200020)

def passenger_oracle(x):
    flags,edges=x;n=len(flags);dist=[[n]*n for _ in range(n)]
    for i in range(n):dist[i][i]=0
    for a,b in edges:dist[a][b]=dist[b][a]=1
    for k in range(n):
        for i in range(n):
            for j in range(n):dist[i][j]=min(dist[i][j],dist[i][k]+dist[k][j])
    answer=2*n
    for mask in range(1,1<<n):
        chosen=[i for i in range(n) if mask>>i&1]
        if sum((mask>>a&1) and (mask>>b&1) for a,b in edges)!=len(chosen)-1:continue
        if all(not flags[v] or any(dist[u][v]<=2 for u in chosen) for v in range(n)):answer=min(answer,2*(len(chosen)-1))
    return str(answer)
def passenger_random(r):
    n,e=tree_case(r);return [r.randrange(2) for _ in range(n)],e
add(23,'距离二以内接人并返回起点','在树上任选起点。经过某站时，可免费接走距该站最多2条边的所有乘客。走过一条边耗费1，需接完所有乘客且回到起点，求最少移动次数。','第一行n，第二行n个0/1表示乘客，随后n−1行树边（0开始）。1≤n≤30000。','先不断剥去无乘客叶子，再同时剥去两层叶子。剩余树的每条边必须往返一次，答案为剩余边数的两倍。','无乘客叶子不必访问，也不影响接客。剩余树的外侧乘客可从向内两步处接到，因此剥去两层；再内侧的每条边两侧都有无法在同一侧覆盖的乘客，必须穿越。闭合树上路线对每条使用边至少走两次，遍历剩余树达到该下界；无边时原地即可。','时间O(n)，空间O(n)。',[([1,0,0,0,0,1],[(i,i+1) for i in range(5)]),([0,0,0,1,1,0,0,1],[(0,1),(0,2),(1,3),(1,4),(2,5),(5,6),(5,7)]),([1],[])],'样例1：在链中间两个站点之间往返即可覆盖两端，耗费2。样例2：沿0与2之间往返，分别覆盖3、4和7，耗费2。样例3：起点就是唯一站点，无需移动。',passenger_random,lambda x:array(x[0])+''.join(f'{a} {b}\n' for a,b in x[1]),passenger_oracle,'''from collections import deque
def solve(d):
    n=int(d[0]);flags=list(map(int,d[1:n+1]));graph=[[] for _ in range(n)]
    for i in range(n+1,len(d),2):
        a,b=int(d[i]),int(d[i+1]);graph[a].append(b);graph[b].append(a)
    degree=list(map(len,graph));alive=[True]*n;remaining=n-1;queue=deque(i for i in range(n) if degree[i]<=1 and flags[i]==0)
    while queue:
        v=queue.popleft()
        if not alive[v]:continue
        alive[v]=False
        for w in graph[v]:
            if alive[w]:remaining-=1;degree[w]-=1
            else:continue
            if degree[w]<=1 and flags[w]==0:queue.append(w)
    queue=deque(i for i in range(n) if alive[i] and degree[i]<=1)
    for _ in range(2):
        for _ in range(len(queue)):
            v=queue.popleft();alive[v]=False
            for w in graph[v]:
                if alive[w]:remaining-=1;degree[w]-=1
                else:continue
                if degree[w]==1:queue.append(w)
    return str(2*max(0,remaining))
''',[('只剥一层','range(2):','range(1):'),('忘记返程','2*max(0,remaining)','max(0,remaining)')],[(([1]*30000,[(i-1,i) for i in range(1,30000)]),'59990'),(([0]*30000,[(i-1,i) for i in range(1,30000)]),'0'),(([1]*30000,[(0,i) for i in range(1,30000)]),'0')],maxInputBytes=430010)

def commands_oracle(commands):
    def resolve(i):return resolve(int(commands[i][1:])-1) if commands[i][0]=='!' else int(commands[i][-1])-1
    resolved=[resolve(i) for i in range(len(commands))];return ' '.join(str(resolved.count(k)) for k in range(3))
def commands_random(r):
    n=r.randint(1,12);order=list(range(n));r.shuffle(order);a=['']*n
    for rank,i in enumerate(order):a[i]=f'!{r.choice(order[:rank])+1}' if rank and r.randrange(2) else f'cmd{r.randint(1,3)}'
    return a
add(24,'引用命令的最终执行次数','每个条目为cmd1、cmd2、cmd3之一，或!j，表示执行第j个条目所代表的命令。统计每个条目最终执行的三种命令次数。本站合法输入保证每条引用链最终到达实际命令；允许向前、向后引用，但无引用环。','第一行n，之后n个命令标记，1≤n≤100000（本站范围）；!j中的j为1..n。','沿引用链追踪到已经解析的结果，再把路径中所有位置记为该结果。最终累计每个位置的命令类别。','无环且每条链到达实际命令，追踪必终止。引用不改变最终命令，沿路径回填正确。记忆化使每个位置至多在未解析路径中出现一次。','时间O(n)，空间O(n)。',[['cmd1','cmd2','cmd3','!1','!2','cmd3','cmd1'],['!3','!1','cmd2'],['cmd3']],'样例1：cmd1、cmd2、cmd3分别执行3、2、2次。样例2：前两条最终都引用到第三条cmd2，输出0 3 0。样例3：只有一次cmd3，输出0 0 1。',commands_random,lambda a:str(len(a))+'\n'+'\n'.join(a)+'\n',commands_oracle,'''def solve(d):
    a=d[1:];n=len(a);resolved=[-1]*n
    for i in range(n):
        path=[];v=i
        while resolved[v]<0:
            path.append(v)
            if a[v][0]!='!':resolved[v]=int(a[v][-1])-1;break
            v=int(a[v][1:])-1
        for w in path:resolved[w]=resolved[v]
    counts=[0]*3
    for value in resolved:counts[value]+=1
    return ' '.join(map(str,counts))
''',[('不统计引用条目','for value in resolved:counts[value]+=1',"for i,value in enumerate(resolved):counts[value]+=int(a[i][0]!='!')"),('交换第一二种命令','return \' \'.join(map(str,counts))',"counts[0],counts[1]=counts[1],counts[0]\n    return ' '.join(map(str,counts))")],[(([f'!{i+2}' for i in range(99999)]+['cmd2']),'0 100000 0'),((['cmd1']*100000),'100000 0 0')],output='输出cmd1、cmd2、cmd3的执行次数，以空格分隔。',maxInputBytes=800008)

def quadratic_oracle(rows):
    answers=[]
    for a,b,c,l,h in rows:
        v=max(Fraction(l),min(Fraction(h),Fraction(-b,2*a)));scaled=v*1000000;sign='-' if scaled<0 else '';scaled=abs(scaled);rounded=(2*scaled.numerator+scaled.denominator)//(2*scaled.denominator);answers.append(f'{sign}{rounded//1000000}.{rounded%1000000:06d}')
    return '\n'.join(answers)
def quadratic_valid(rows,text):
    import re
    tokens=text.split()
    if len(tokens)!=len(rows):return False
    for row,t in zip(rows,tokens):
        if not re.fullmatch(r'[+-]?\d+\.\d{6}',t):return False
        a,b,c,l,h=row;v=max(Fraction(l),min(Fraction(h),Fraction(-b,2*a)))
        if abs(Fraction(t)-v)>Fraction(1,2000000):return False
    return True
add(25,'凸二次函数的区间最小点','每个查询给定凸二次函数f(x)=Ax²+Bx+C及闭区间[left,right]，求使函数值最小的x，而不是最小函数值。结果保留六位小数；真值恰在两个六位小数中点时，两种舍入均接受。','第一行q，之后q行A B C left right。本站整数协议：1≤q≤1000，1≤A≤10⁶，B/C/left/right在−10⁶..10⁶，left≤right。','用高精度Decimal三分搜索，仅通过函数求值不断缩小包含最小点的区间，最后四舍五入到六位。','A>0保证严格凸性；两三分点的函数值比较能排除远离最小点的一侧，包含最小点的区间长度每轮缩至2/3。160轮后初始至多2×10⁶的区间远小于10⁻⁶；精确中点舍入两侧都合法，高精度避免浮点相消影响判断。','时间O(q·160)，除输入和输出外空间O(1)；Decimal使用60位固定精度。',[[[1,-4,7,0,10],[1,2,1,0,5],[2,-8,1,3,10]],[[1000000,1,0,-1,1]],[[3,-2,5,0,1]]],'样例1：三个无约束最小点为2、−1、2，限制到对应区间后输出2.000000、0.000000、3.000000。样例2：最小点为−0.0000005，−0.000001与0.000000均合法。样例3：最小点1/3，输出0.333333。',lambda r:[[r.randint(1,100),r.randint(-100,100),r.randint(-100,100),-r.randint(0,20),r.randint(0,20)] for _ in range(r.randint(1,5))],lambda rows:str(len(rows))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in rows),quadratic_oracle,'''from decimal import Decimal,localcontext,ROUND_HALF_UP
def solve(d):
    answers=[]
    with localcontext() as ctx:
        ctx.prec=60
        for i in range(1,len(d),5):
            a,b,c,left,right=map(Decimal,d[i:i+5])
            def f(x):return (a*x+b)*x+c
            for _ in range(160):
                x=left+(right-left)/3;y=right-(right-left)/3
                if f(x)<f(y):right=y
                else:left=x
            point=(left+right)/2;answers.append(format(point.quantize(Decimal('0.000001'),rounding=ROUND_HALF_UP),'f'))
    return '\\n'.join(answers)
''',[('错误返回区间右端','point=(left+right)/2','point=Decimal(d[i+4])'),('把函数值当最小点','point=(left+right)/2','point=f((left+right)/2)')],[([[1,-1000000,1000000,-1000000,1000000]]*1000,'\n'.join(['500000.000000']*1000)),([[1000000,1000000,-1000000,-1000000,1000000]]*1000,'\n'.join(['-0.500000']*1000))],checker='oa-quadratic-minimum',valid=quadratic_valid,output='每查询输出一行最小点x，必须有六位小数。',maxInputBytes=46010,timeLimit=10)

def flowers_oracle(x):
    n,m,magic,mod=x;points=[(i,j) for i in range(n) for j in range(m) if ((i+j*magic)%mod)%2]
    return str(sum(any(a[0]==b[0] and a[1]==c[1] for a,b,c in itertools.permutations(triple)) for triple in itertools.combinations(points,3)))
add(27,'生成花圃中的直角三点','n行m列网格的(i,j)为花，当且仅当((i+j×magic) mod mod) mod 2=1，坐标从0开始。统计三个不同花格组成的L形：某一格与第二格同行、与第三格同列，不要求相邻。每组三个格子只计一次。','一行n m magic mod；1≤n,m≤1000，1≤magic,mod≤10⁶。','先统计每行每列的花数，再以每朵花为唯一拐点，贡献(行花数−1)×(列花数−1)。','固定拐点后，同行和同列另外两点彼此不同，每种选择恰构成一个L。三个非共线直角点唯一确定拐点，因此求和没有重复。','时间O(nm)，额外空间O(n+m)。',[(3,3,2,2),(2,2,1,2),(3,3,1,3)],'样例1：只有中间一行开花，同列没有另一朵，输出0。样例2：两朵花不够组成三点，输出0。样例3：花位于(0,1)、(1,0)、(2,2)，各行各列仅一朵，输出0。',lambda r:(r.randint(1,4),r.randint(1,4),r.randint(1,8),r.randint(1,8)),lambda x:' '.join(map(str,x))+'\n',flowers_oracle,'''def solve(d):
    n,m,magic,mod=map(int,d);rows=[0]*n;cols=[0]*m
    for i in range(n):
        for j in range(m):
            if ((i+j*magic)%mod)%2:rows[i]+=1;cols[j]+=1
    answer=0
    for i in range(n):
        for j in range(m):
            if ((i+j*magic)%mod)%2:answer+=(rows[i]-1)*(cols[j]-1)
    return str(answer)
''',[('包含拐点本身','(rows[i]-1)*(cols[j]-1)','rows[i]*cols[j]'),('错误除以三','return str(answer)','return str(answer//3)')],[((1000,1000,2,2),'249250500000'),((1000,1000,1,2),'124500500000'),((1000,1000,1000000,1),'0')],maxInputBytes=28)

def climb_oracle(x):
    grid,w=x;n=len(grid);m=len(grid[0])
    def visit(row,col,used):
        count=int(row==0)
        if used==1:
            for nxt in range(m):
                if nxt!=col and grid[row][nxt]=='X' and abs(nxt-col)<=w:count+=visit(row,nxt,2)
        if row:
            for nxt in range(m):
                if grid[row-1][nxt]=='X' and (nxt-col)**2+1<=w*w:count+=visit(row-1,nxt,1)
        return count
    return str(sum(visit(n-1,j,1) for j in range(m) if grid[-1][j]=='X')%998244353)
add(28,'每层至多两个抓点的攀墙路线','从最下面一行到最上面一行，必须每行使用至少1个、至多2个不同抓点X；#不能抓。不能向下，相邻使用抓点的欧氏距离不超过w。路线按抓点序列区分，统计路线数模998244353。','第一行n m w，随后从上到下n行长m的X/#串。2≤n≤2000，1≤m,w≤2000。','按行从下到上处理。进入本行的路径数，经半径w的横向窗口求和得到本行最后抓点的路径数（含不横移）。向上换行时横距最多isqrt(w²−1)，再做窗口求和。两类窗口均用前缀和。','每条合法路线在一行内要么只有最后抓点，要么有唯一的第一个和不同的最后抓点；横向窗口把这些情形各计一次。相邻行高差1，距离约束等价于横距平方≤w²−1。逐层转移精确拼接全部且仅合法路线。','时间O(nm)，除输入网格外空间O(m)。',[(['XX#X','#XX#','#X#X'],1),(['X','X'],1),(['##','XX'],2)],'样例1：底行只能从第2列继续，经过中间的第2列，再到顶行第2列；顶行可停下或再到第1列，共2条。样例2：两行各一个抓点，只有1条路线。样例3：顶行无抓点，无法到达，输出0。',lambda r:([''.join(r.choice('X#') for _ in range(m)) for _ in range(r.randint(2,4))],r.randint(1,4)) if (m:=r.randint(1,4)) else None,lambda x:f'{len(x[0])} {len(x[0][0])} {x[1]}\n'+'\n'.join(x[0])+'\n',climb_oracle,'''from math import isqrt
def solve(d):
    n,m,w=map(int,d[:3]);grid=d[3:];mod=998244353;radius=isqrt(w*w-1)
    incoming=[int(c=='X') for c in grid[-1]]
    def transfer(values,row,distance):
        prefix=[0]
        for value in values:prefix.append((prefix[-1]+value)%mod)
        return [(prefix[min(m,j+distance+1)]-prefix[max(0,j-distance)])%mod if row[j]=='X' else 0 for j in range(m)]
    for i in range(n-1,-1,-1):
        finished=transfer(incoming,grid[i],w)
        if i:incoming=transfer(finished,grid[i-1],radius)
    return str(sum(finished)%mod)
''',[('向上错误允许横距w','radius=isqrt(w*w-1)','radius=w'),('不允许同层第二抓点','finished=transfer(incoming,grid[i],w)','finished=incoming')],[((['X'*2000]*2000,2000),str(pow(2000,4000,998244353))),((['#'*2000]*2000,1),'0'),((['X']*2000,2000),'1')],maxInputBytes=4002016,timeLimit=8)

def pairs_oracle(x):
    a,k=x;return str(sum(sum(a[p]==a[q] for p in range(i,j) for q in range(p+1,j))>=k for i in range(len(a)) for j in range(i+1,len(a)+1)))
add(29,'至少k对相同元素的子数组','一对指子数组内两个不同下标i<j且元素相等。统计至少包含k对的非空连续子数组数量。','第一行n k，第二行n个元素；1≤n≤100000，1≤a[i],k≤10⁹。','双指针维护窗口和频次。新元素增加与其原频次相同的配对数；窗口满足k时，该左端对应当前及所有更远右端都有效，计数后移走左端。','向右扩展不会减少配对数。当某左端首次达到k时，所有更长窗口都有效且之前无效，贡献n−right。每个左端只移走一次，贡献之间不重不漏。','时间O(n)，空间O(n)。',[([1,1,1,1,1],10),([3,1,4,3,2,2,4],2),([1,2,3],1)],'样例1：整段恰有10对，任何较短区间都不足，答案1。样例2：有效区间为下标[0,5]、[0,6]、[1,6]、[2,6]，答案4。样例3：元素互异，没有相同对，答案0。',lambda r:([r.randint(1,5) for _ in range(r.randint(1,10))],r.randint(1,15)),lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',pairs_oracle,'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));counts={};pairs=left=answer=0
    for right,v in enumerate(a):
        pairs+=counts.get(v,0);counts[v]=counts.get(v,0)+1
        while pairs>=k:
            answer+=n-right;old=a[left];counts[old]-=1;pairs-=counts[old];left+=1
    return str(answer)
''',[('严格大于k','while pairs>=k:','while pairs>k:'),('错误每次只加一','answer+=n-right','answer+=1')],[(([1]*100000,1),'4999950000'),((list(range(1,100001)),1),'0'),(([1]*100000,1000000000),str((100000-44722+1)*(100000-44722+2)//2))],maxInputBytes=1100019)
def dynamic_oracle(x):
    a,b,ops=x;b=b.copy();result=[]
    for op in ops:
        if op[0]==0:b[op[1]]+=op[2]
        else:result.append(str(sum(v+w==op[1] for v in a for w in b)))
    return '\n'.join(result)
def dynamic_random(r):
    a=r.sample(range(-15,16),r.randint(1,7));b=r.sample(range(-15,16),r.randint(1,8));ops=[(0,r.randrange(len(b)),r.randint(-10,10)) if r.randrange(2) else (1,r.randint(-25,25)) for _ in range(r.randint(1,15))];return a,b,ops
def dynamic_encode(x):
    a,b,ops=x;return f'{len(a)} {len(b)} {len(ops)}\n'+' '.join(map(str,a))+'\n'+' '.join(map(str,b))+'\n'+''.join(' '.join(map(str,op))+'\n' for op in ops)
add(30,'可更新数组的两数和计数','数组a不变。操作0 i x令b[i]增加x；操作1 target询问有多少下标对(i,j)满足a[i]+b[j]=target。初始每个数组内部值互异，更新后允许重复，按下标计数。','第一行na nb q，之后两行数组a、b，再q行操作。源无数字范围，本站1≤na≤100、1≤nb,q≤100000；初始值与增量−10⁹..10⁹，target为−10¹⁴..10¹⁴，下标从0开始。','维护b的频次。更新先减旧值频次再加新值；查询枚举a的每个数，累加target减该数在b中的次数。','固定a下标时，b中所有补数下标都是且仅是合法搭配。不同a下标对应不同对，因此频次数相加准确；更新前后频次与数组保持一致。','时间O(nb+q·na)，空间O(nb+q+na)，其中查询存储属于输入解析。',[([1,2],[2,3],[(1,4),(0,0,1),(1,4)]),([0],[1],[(0,0,-1),(1,0)]),([1],[2],[(1,9)])],'样例1：先有1+3与2+2两对；更新后b为3、3，两种不同下标都与1配对，仍是2。样例2：更新使b为0，查询和0有1对。样例3：没有和为9的搭配，输出0。',dynamic_random,dynamic_encode,dynamic_oracle,'''from collections import Counter
def solve(d):
    na,nb,q=map(int,d[:3]);a=list(map(int,d[3:3+na]));b=list(map(int,d[3+na:3+na+nb]));counts=Counter(b);cursor=3+na+nb;result=[]
    for _ in range(q):
        kind=int(d[cursor]);cursor+=1
        if kind==0:
            index,x=map(int,d[cursor:cursor+2]);cursor+=2;counts[b[index]]-=1;b[index]+=x;counts[b[index]]+=1
        else:
            target=int(d[cursor]);cursor+=1;result.append(str(sum(counts.get(target-v,0) for v in a)))
    return '\\n'.join(result)
''',[('更新不减旧频次','counts[b[index]]-=1;',''),('误按值而非下标计数','counts.get(target-v,0)','int(counts.get(target-v,0)>0)')],[((list(range(100)),list(range(100000)),[(1,99999)]*100000),'\n'.join(['100']*100000)),(([0],[0],[(0,0,10**9)]*99999+[(1,99999000000000)]),'1')],output='每个查询操作输出一行配对数量；没有查询时输出空行。',maxInputBytes=3201250,timeLimit=8)

def houses_oracle(x):
    houses,queries=x;remaining=set(houses);result=[]
    for v in queries:
        remaining.remove(v);ordered=sorted(remaining);result.append(str(sum(i==0 or ordered[i]-ordered[i-1]!=1 for i in range(len(ordered)))))
    return '\n'.join(result)
def houses_random(r):
    a=r.sample(range(-12,13),r.randint(1,12));return a,r.sample(a,r.randint(1,len(a)))
add(31,'拆除房屋后的连续街区数','整数坐标上有互不相同的房屋，坐标相差1的房屋相连。逐个拆除指定房屋，每步输出剩余连续街区数。合法查询保证要拆的房屋尚存在。原站两个例子的中间计数与连续定义冲突，按正文修正。','第一行n q，第二行n个坐标，第三行q个待拆坐标。1≤q≤n≤100000；源未给坐标界，本站坐标为−10⁹..10⁹。','集合判断被删位置左右是否有房屋。两侧都有时一个街区拆成两个，增加1；都没有时孤立街区消失，减1；仅一侧存在时不变。','只有含被删房屋的街区可能变化，其他街区保持。左右是否存在穷尽三类情况，因此按left+right−1更新正确。初始每个无左邻的房屋恰好代表一个街区。','时间O(n+q)期望，空间O(n)。',[([1,2,3,6,7,9],[2,6,9]),([1,5,6,8,10],[5,8,10]),([1],[1])],'样例1：依次拆除2、6、9后，街区为{1},{3},{6,7},{9}共4个；再变为{1},{3},{7},{9}共4个；最后3个。样例2：拆5后剩1、6、8、10共4个；随后为3、2个，原站3、3、2不符合定义。样例3：最后一座拆除后街区为0。',houses_random,lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',houses_oracle,'''def solve(d):
    n,q=map(int,d[:2]);houses=set(map(int,d[2:2+n]));segments=sum(v-1 not in houses for v in houses);result=[]
    for i in range(2+n,len(d)):
        v=int(d[i]);left=v-1 in houses;right=v+1 in houses;segments+=left+right-1;houses.remove(v);result.append(str(segments))
    return '\\n'.join(result)
''',[('每次拆除都减一','segments+=left+right-1','segments-=1'),('两侧存在时不拆分','segments+=left+right-1','segments+=min(0,left+right-1)')],[((list(range(100000)),list(range(100000))),'\n'.join(['1']*99999+['0'])),((list(range(0,200000,2)),list(range(0,200000,2))),'\n'.join(map(str,range(99999,-1,-1))))],output='每次拆除后输出一行街区数量。',maxInputBytes=2400014)

def bombs_oracle(rows):
    for order in itertools.permutations(rows):
        time=0;valid=True
        for duration,deadline in order:
            time+=duration
            if time>deadline:valid=False;break
        if valid:return str(time)
    return '-1'
add(32,'截止时间前拆完全部炸弹','一次只能拆一个炸弹且不能中断。炸弹i耗时X[i]，必须在时间Y[i]或之前完成。时间从0开始，求拆完全部炸弹的最少总时间；无法完成输出−1。','第一行n，随后n行duration deadline。1≤n≤200000；源未给时间界，本站1≤duration≤10⁹，1≤deadline≤10¹⁵。','按截止时间升序处理，累加耗时；任一时刻超过当前截止时间就无解，否则答案为总耗时。','可行安排中若相邻任务截止时间逆序，交换后早截止任务更早完成，晚截止任务在原两者完成时间结束也不违约。反复交换得到截止时间顺序，因此该顺序失败就不存在可行安排。全部任务必须执行，总耗时固定，无空闲安排达到下界。','时间O(n log n)，空间O(n)。',[[(2,4),(1,9),(1,8),(4,9),(3,12)],[(2,2),(1,2)],[(3,3)]],'样例1：按截止时间安排，累计完成时间2、3、4、8、11均未超时，输出11。样例2：总耗时3，但两件都必须在2前完成，输出−1。样例3：恰在截止时间3完成，输出3。',lambda r:[(r.randint(1,6),r.randint(1,25)) for _ in range(r.randint(1,7))],lambda rows:str(len(rows))+'\n'+''.join(f'{x} {y}\n' for x,y in rows),bombs_oracle,'''def solve(d):
    tasks=[(int(d[i+1]),int(d[i])) for i in range(1,len(d),2)];tasks.sort();time=0
    for deadline,duration in tasks:
        time+=duration
        if time>deadline:return '-1'
    return str(time)
''',[('按耗时排序','tasks.sort()','tasks.sort(key=lambda item:item[1])'),('不接受恰好截止','if time>deadline:', 'if time>=deadline:')],[([(10**9,i*10**9) for i in range(200000,0,-1)],'200000000000000'),([(10**9,1)]*200000,'-1')],maxInputBytes=5600010,timeLimit=6,memoryLimit=524288)

def connection_oracle(x):
    users,logs=x
    if len(users)==1:return '0'
    graph={u:set() for u in users}
    for time,a,b in sorted(logs):
        graph[a].add(b);graph[b].add(a);seen={users[0]};todo=[users[0]]
        while todo:
            for v in graph[todo.pop()]:
                if v not in seen:seen.add(v);todo.append(v)
        if len(seen)==len(users):return str(time)
    return '-1'
def connection_random(r):
    users=[f'user{i}' for i in range(r.randint(1,8))];return users,[(r.randint(0,20),r.choice(users),r.choice(users)) for _ in range(r.randint(0,15))]
add(33,'所有用户首次连通的时间','日志time u v表示从该时刻起u和v相连，连接关系可传递。返回所有给定用户首次属于同一连通分量的时间；永远不能全连通输出−1。单个用户在日志发生前就已连通，本站约定输出0。','第一行n m，接着n个不同用户名，再m行time u v。源无规模界，本站1≤n≤100000、0≤m≤200000，用户名为1..20个ASCII字母数字或下划线，0≤time≤10⁹，日志中的用户均存在。','按时间排序日志，用并查集依次合并两端，每成功合并一次分量数减一；首次减到1的时间就是答案。','时刻t的连接恰好由不晚于t的日志生成，并查集等价维护这些边的连通关系。依时间扫描第一次全连通即最早时刻；若扫描结束仍多个分量则无解。','时间O(m log m+(n+m)α(n))，空间O(n+m)。',[(['a','b','c'],[(3,'a','b'),(7,'b','c'),(9,'a','c')]),(['alone'],[]),(['a','b'],[])],'样例1：时间3只有a、b相连，时间7加入c，输出7。样例2：单用户无需建立连接，输出0。样例3：没有日志，两个用户无法连通，输出−1。',connection_random,lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(x[0])+'\n'+''.join(f'{t} {a} {b}\n' for t,a,b in x[1]),connection_oracle,'''def solve(d):
    n,m=map(int,d[:2])
    if n==1:return '0'
    ids={d[i+2]:i for i in range(n)};parent=list(range(n));size=[1]*n;components=n
    def find(v):
        while parent[v]!=v:parent[v]=parent[parent[v]];v=parent[v]
        return v
    logs=[(int(d[i]),ids[d[i+1]],ids[d[i+2]]) for i in range(n+2,len(d),3)];logs.sort()
    for time,u,v in logs:
        a,b=find(u),find(v)
        if a==b:continue
        if size[a]<size[b]:a,b=b,a
        parent[b]=a;size[a]+=size[b];components-=1
        if components==1:return str(time)
    return '-1'
''',[('不按时间处理','logs.sort()','logs.reverse()'),('过早认为连通','if components==1:','if components<=2:')],[(([f'user{i:016d}' for i in range(100000)],[(i,f'user{i-1:016d}',f'user{i:016d}') for i in range(99999,0,-1)]+[(10**9,'user0000000000000000','user0000000000000001')]*100001),'99999'),((['a','b'],[(10**9,'a','a')]*200000),'-1')],maxInputBytes=12700020,timeLimit=6,memoryLimit=524288)

def ride_encode(rows):return str(len(rows))+'\n'+''.join(f'{identifier} {time//60:02d}:{time%60:02d}\n{place}\n' for identifier,place,time in rows)
def rides_oracle(rows):
    n=len(rows)
    @functools.lru_cache(None)
    def partition(mask):
        if not mask:return ()
        first=(mask&-mask).bit_length()-1;others=[i for i in range(first+1,n) if mask>>i&1];best=None
        for size in (0,1,2):
            for rest in itertools.combinations(others,size):
                group=(first,)+rest
                if len({rows[i][1] for i in group})!=1 or max(rows[i][2] for i in group)-min(rows[i][2] for i in group)>10:continue
                candidate=(group,)+partition(mask-sum(1<<i for i in group))
                if best is None or len(candidate)<len(best):best=candidate
        return best
    groups=partition((1<<n)-1);return str(len(groups))+'\n'+'\n'.join(str(len(g))+' '+' '.join(map(str,sorted(rows[i][0] for i in g))) for g in groups)
def rides_valid(rows,text,expected):
    try:
        tokens=list(map(int,text.split()));count=tokens[0];required=int(expected.split()[0]);cursor=1;seen=set();previous=-1;byid={row[0]:(i,row[1],row[2]) for i,row in enumerate(rows)}
        if count!=required:return False
        for _ in range(count):
            size=tokens[cursor];cursor+=1;ids=tokens[cursor:cursor+size];cursor+=size
            if not 1<=size<=3 or len(ids)!=size or ids!=sorted(ids) or len(set(ids))!=size or any(v not in byid or v in seen for v in ids):return False
            data=[byid[v] for v in ids];first=min(v[0] for v in data)
            if first<=previous or len({v[1] for v in data})!=1 or max(v[2] for v in data)-min(v[2] for v in data)>10:return False
            previous=first;seen.update(ids)
        return cursor==len(tokens) and len(seen)==len(rows)
    except (ValueError,IndexError):return False
add(34,'接驾地点和时间兼容的最少分组','将全部请求分到尽可能少的组，每组最多3个请求、接驾地点完全相同、最晚与最早时间相差不超过10分钟。每个请求恰好出现一次。每组ID升序；所有组按组内请求的最小原输入下标升序。存在多个最优方案时均接受。','第一行n，随后每条请求两行：第一行id HH:MM，第二行完整地点名称。1≤n≤10000；本站ID为不同的1..10⁹整数，地点1..100个可见ASCII字符或空格，时间00:00..23:59。','按地点拆分，组内按时间排序。每次从最早尚未分组请求开始，向后拿最多两个且时间差≤10的请求。最后整理组内ID和组间原下标顺序。','在任一地点，最早请求所在组可交换成包含最早可兼容的至多3个请求：把较早请求放到最早组不会超出窗口，被换出的较晚请求放回较晚组也不破坏已有时间跨度。若最早组未满而存在可兼容请求，移入不会增加组数。因而存在以该贪心组开头的最优解，对剩余请求归纳；不同地点不能混组，各自最优相加。','时间O(n log n)，空间O(n)。',[[(4,'Main Gate',600),(1,'Main Gate',610),(3,'Main Gate',620)],[(8,'A',0),(2,'A',0),(5,'A',0),(1,'A',0)],[(10,'A',0),(11,'B',0)]],'样例1：至少2组，可将ID1、4同组，ID3单独；也可ID4单独，ID1、3同组。样例2：四条兼容请求仍因每组最多3条至少用2组，任何符合顺序的两组划分都可。样例3：地点不同不能拼组，需2组，顺序为10再11。',lambda r:[(i+1,r.choice(['A','B']),r.randint(0,30)) for i in range(r.randint(1,8))],ride_encode,rides_oracle,'''from collections import defaultdict
def solve(d):
    lines=d.split('\\n');n=int(lines[0]);locations=defaultdict(list)
    for i in range(n):
        identifier,time=lines[1+2*i].split();hour,minute=map(int,time.split(':'));locations[lines[2+2*i]].append((hour*60+minute,i,int(identifier)))
    groups=[]
    for rides in locations.values():
        rides.sort();i=0
        while i<len(rides):
            start=i;i+=1
            while i<len(rides) and i-start<3 and rides[i][0]-rides[start][0]<=10:i+=1
            selected=rides[start:i];groups.append((min(v[1] for v in selected),sorted(v[2] for v in selected)))
    groups.sort()
    return str(len(groups))+'\\n'+'\\n'.join(str(len(ids))+' '+' '.join(map(str,ids)) for _,ids in groups)
''',[('容量误设为二','i-start<3','i-start<2'),('不接受恰好十分钟','<=10:', '<10:')],[([(i+1,'A',0) for i in range(10000)],'3334\n'+'\n'.join(str(min(3,10000-i))+' '+' '.join(map(str,range(i+1,min(i+4,10001)))) for i in range(0,10000,3))),([(i+1,f'Location {i:090d}',1439) for i in range(10000)],'10000\n'+'\n'.join(f'1 {i+1}' for i in range(10000)))],raw=True,checker='oa-compatible-groups',output='第一行组数B，之后B行先写组内数量，再写该组升序ID。',maxInputBytes=1180010)

def safe_oracle(x):
    a,k=x;return str(max([0]+[size for size in range(1,len(a)+1) if all(sum(a[i:i+size])<k for i in range(len(a)-size+1))]))
add(37,'所有定长窗口都小于阈值的最大长度','给定正整数数组与k，寻找最大长度L，使每一个长度为L的连续子数组之和都严格小于k。没有正长度满足时输出0。','第一行n k，第二行n个正整数。1≤n≤200000，1≤a[i]≤10⁹，1≤k≤10¹⁸。','先找和至少为k的最短子数组长度B，答案B−1；若不存在则答案n。正数让双指针能在线性时间找最短达标窗口。','比最短坏窗口更短的窗口一定都好。任意长度≥B且≤n都能把该坏窗口扩展到此长度，正数保证扩展后仍坏，因此可行长度恰好0..B−1。滑窗右扩并尽量左缩，枚举每个右端最短的达标区间。','时间O(n)，空间O(n)保存输入。',[([3,1,2,4],8),([9],9),([1,1,1],10)],'样例1：两个长度3窗口和为6、7，小于8；长度4和10不行，答案3。样例2：唯一元素和等于9，不是严格小于，答案0。样例3：整段和3小于10，最大长度3。',lambda r:([r.randint(1,10) for _ in range(r.randint(1,10))],r.randint(1,50)),lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',safe_oracle,'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));left=total=0;shortest=n+1
    for right,value in enumerate(a):
        total+=value
        while total>=k:
            shortest=min(shortest,right-left+1);total-=a[left];left+=1
    return str(shortest-1)
''',[('允许窗口和等于阈值','while total>=k:','while total>k:'),('答案少减一','str(shortest-1)','str(shortest)')],[(([1]*200000,100001),'100000'),(([10**9]*200000,10**18),'200000'),(([10**9]*200000,10**9),'0')],maxInputBytes=2200028)

def football_oracle(arrays):
    n=len(arrays[0]);score=[(3*arrays[0][i]+arrays[1][i],arrays[2][i]-arrays[3][i]) for i in range(n)];possible=[(i,j) for i in range(n) for j in range(n) if i!=j and all(score[i]>=score[k] for k in range(n)) and all(k==i or score[j]>=score[k] for k in range(n))];return ' '.join(map(str,possible[-1]))
def football_valid(a,text):
    try:
        p=list(map(int,text.split()));n=len(a[0])
        if len(p)!=2 or p[0]==p[1] or any(v<0 or v>=n for v in p):return False
        scores=[(3*a[0][i]+a[1][i],a[2][i]-a[3][i]) for i in range(n)]
        return scores[p[0]]==max(scores) and scores[p[1]]==max(scores[i] for i in range(n) if i!=p[0])
    except ValueError:return False
add(38,'足球联赛的前两名','球队积分为3×胜场+平局数；积分相同按进球数减失球数的净胜球降序。输出前两名不同球队的下标。如果积分和净胜球完全相同，题意没有进一步顺序要求，接受任意合法并列顺序。','第一行n，接着4行，依次为n个胜场数、平局数、进球数、失球数。源无数值范围，本站2≤n≤100000，各值为0..10⁹。','按积分、净胜球的降序排序球队，下标只用来选出一个确定的合法并列代表，取前两个。','排序关键字就是题目排名规则，因此首位与次位分别不低于所有尚未选中球队；完全相同的关键字之间任意次序都符合题目。','时间O(n log n)，空间O(n)。',[([2,1,2],[0,3,0],[5,5,4],[1,2,0]),([0,0],[0,0],[0,0],[0,0]),([1,0,0],[0,2,1],[0,100,100],[0,0,0])],'样例1：三队均6分，0与2净胜球4并列领先，输出0 2或2 0均可。样例2：两队完全相同，0 1与1 0都正确。样例3：积分3、2、1决定排名，进球再多也不能越过积分，输出0 1。',lambda r:tuple([r.randint(0,5) for _ in range(n)] for _ in range(4)) if (n:=r.randint(2,8)) else None,lambda a:str(len(a[0]))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in a),football_oracle,'''def solve(d):
    n=int(d[0]);a=[list(map(int,d[1+i*n:1+(i+1)*n])) for i in range(4)]
    order=sorted(range(n),key=lambda i:(-3*a[0][i]-a[1][i],-a[2][i]+a[3][i],i))
    return f'{order[0]} {order[1]}'
''',[('平局积分漏算','-3*a[0][i]-a[1][i]','-3*a[0][i]'),('净胜球误按进球数','-a[2][i]+a[3][i]','-a[2][i]')],[((tuple([10**9]*100000 for _ in range(4))),'0 1'),((list(range(100000)),[0]*100000,[0]*100000,[0]*100000),'99999 99998')],checker='oa-football-top-two',valid=football_valid,output='输出两个不同的0起始下标：第一名、第二名。',maxInputBytes=4400008,timeLimit=6)

def logs_oracle(logs):return next((s for s in logs if logs.count(s)==1),'')
add(40,'完整日志中首个只出现一次的条目','按输入顺序返回出现次数恰好为1的第一条完整日志。空格属于日志内容，不能拆词或去除首尾空格；找不到时输出空行。','第一行n，随后恰好n行日志，可以是空行。1≤n≤1000000。源无字符串长度界，本站输入协议为每行至多1MiB、仅ASCII可见字符与空格，整个标准输入不超过32MiB；日志不含换行。','先统计完整字符串频次，再按原顺序寻找首个频次为1的字符串。','频次统计覆盖所有条目，因此频次1恰为最终只出现一次。再次按原顺序检查，首个符合者就是题目要求的最早位置；无符合者输出空行。','时间O(输入总字节数)，空间O(输入总字节数+n)。',[['A','B','A','C','B'],['x','y','x','y'],['a b','a','a b']],'样例1：A、B各两次，C一次，输出C。样例2：所有日志都重复，没有结果，输出空行。样例3：完整日志a b重复，单独的a仅一次，输出a。',lambda r:[r.choice(['','a','b','a b',' a','a ','  ']) for _ in range(r.randint(1,12))],lambda rows:str(len(rows))+'\n'+'\n'.join(rows)+'\n',logs_oracle,'''from collections import Counter
def solve(d):
    lines=d.split('\\n');n=int(lines[0]);logs=lines[1:1+n];counts=Counter(logs)
    return next((line for line in logs if counts[line]==1),'')
''',[('错误去除首尾空格',"logs=lines[1:1+n]","logs=[line.strip() for line in lines[1:1+n]]"),('返回最后唯一项','line for line in logs if','line for line in reversed(logs) if')],[(([f'{i:016x}' for i in range(1000000)]),'0000000000000000'),((['a'*32]*1000000),''),((['x'*(1024*1024),'repeat','repeat']),'x'*(1024*1024))],raw=True,checker='exact',output='输出完整答案日志及换行；没有答案输出一个空行。',maxInputBytes=33554432,timeLimit=8,memoryLimit=524288)

BLOCKED={26:'正文没有可定义的条件，仅给[1,2,3]结果1，无法知道在统计什么。',35:'主体截断于Design assignment behavior row n，两个样例不足以定义一般情况下的最远距离目标和操作规则，不能凭结果补题。',36:'题干截断于Given two arrays of strictly i；仅凭[123,4,5,955]和[12345,63,95,2]输出3不能确定比较规则。',39:'来源允许1000万条命令；即使全部使用最短ADD a换行，每条6字节也达6000万字节，超过32MiB单输入限制，不能擅自缩小源事件上限。'}
NOTES={24:'补全合法引用链最终到达cmd的输入保证，同时支持前向与后向引用，不限制为历史条目。',25:'输出最小点而非函数值；精确半微单位语义检查接受舍入中点两种结果。',31:'按连续整数房屋定义修正源样例，删除不存在房屋不属于本站合法输入。',34:'接受全部最优兼容分组，不能用固定贪心分组作为唯一答案。',38:'完全同积分同净胜球不擅加下标排名规则，语义检查允许所有合法前二。',40:'保留源100万条上限；未定义的字符串长度明确为本站单行1MiB、总输入32MiB协议，保留空格和空日志。'}
for spec in SPECS:
    if spec['id']==27:
        spec['samples'][0]=(4,3,2,2)
        spec['explanation']='样例1：第2、4行各有3朵花。6个拐点各可选同排另外2朵、同列另外1朵，共12组。样例2：只有两朵花，不能组成三点，输出0。样例3：三朵花位于(0,1)、(1,0)、(2,2)，各行各列仅一朵，输出0。'
    if spec['id']==40:
        # Exactly 32 MiB, one million entries, no unique line.
        spec['edges'][0]=([f'{i:032x}' for i in range(1000000)],'0'*32)
        filler=(33554432-8-999998*33-2)//2
        spec['edges'][1]=(['a'*32]*999998+['b'*filler]*2,'')
def execute_many(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2500:]);return json.loads(p.stdout)
def matches(spec,value,actual,expected):
    if spec['id']==34:return rides_valid(value,actual,expected)
    if spec.get('valid'):return spec['valid'](value,actual)
    return actual==expected if spec.get('checker')=='exact' else actual.split()==expected.split()
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};selected=set(map(int,sys.argv[1:]));entries=[];reports=[]
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(x['id'].split('-')[-1]) not in selected];reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(x['id'].split('-')[-1]) not in selected]
    for spec in sorted(SPECS,key=lambda s:s['id']):
        if selected and spec['id'] not in selected:continue
        assert spec['maxInputBytes']<=33554432
        identifier=f"oa-uber-{spec['id']}";rng=random.Random(20261200+spec['id']);reader='sys.stdin.read().removesuffix("\\n")' if spec.get('raw') else 'sys.stdin.read().split()';code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)];oracles=[dict(input=spec['encode'](value),expectedOutput=spec['oracle'](value)+'\n') for value in values]
        formal=list(zip(values[:3],[c['expectedOutput'] for c in oracles[:3]]))+[(value,output+'\n') for value,output in spec['edges']]+list(zip(values[3:27],[c['expectedOutput'] for c in oracles[3:27]]));cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=spec['encode'](value),expectedOutput=output,hidden=i>=3,weight=1) for i,(value,output) in enumerate(formal)]
        for c in oracles+cases:assert len(c['input'].encode())<=spec['maxInputBytes'],(identifier,'input byte budget',len(c['input'].encode()))
        outputs=execute_many(path,[c['input'] for c in oracles+cases])
        for i,(value,case,actual) in enumerate(zip(values+[v for v,o in formal],oracles+cases,outputs)):assert matches(spec,value,actual,case['expectedOutput']),(identifier,i,case['expectedOutput'][:120],actual[:120])
        mutants=[];controls=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code,(identifier,old);changed=code.replace(old,new);negative=OUT/'negative-controls'/f'{identifier}-{index}.py';negative.write_text(changed);actuals=execute_many(negative,[c['input'] for c in cases]);rejected=[i for i,((value,expected),actual) in enumerate(zip(formal,actuals)) if not matches(spec,value,actual,expected)]
            assert rejected,(identifier,label,'survived');mutants.append(dict(name=label,code=changed));controls.append(dict(name=label,rejectedByCases=rejected))
        if spec['id'] in (25,34,38):
            if spec['id']==25:
                positive_code='''from fractions import Fraction
def solve(d):
    result=[]
    for i in range(1,len(d),5):
        a,b,c,l,h=map(int,d[i:i+5]);x=max(Fraction(l),min(Fraction(h),Fraction(-b,2*a)))*1000000
        sign='-' if x<0 else '';x=abs(x);whole,remainder=divmod(x.numerator,x.denominator)
        whole+=2*remainder>x.denominator
        result.append(f'{sign}{whole//1000000}.{whole%1000000:06d}')
    return '\\n'.join(result)
if __name__=='__main__':
    import sys
    print(solve(sys.stdin.read().split()))
'''
            elif spec['id']==34:positive_code=code.replace('rides.sort();i=0','rides.sort(reverse=True);i=0').replace('rides[i][0]-rides[start][0]<=10','rides[start][0]-rides[i][0]<=10')
            else:positive_code=code.replace('-a[2][i]+a[3][i],i))','-a[2][i]+a[3][i],-i))')
            (OUT/'positive-controls').mkdir(parents=True,exist_ok=True)
            positive=OUT/'positive-controls'/f'{identifier}.py';positive.write_text(positive_code)
            for value,case,actual in zip(values,oracles,execute_many(positive,[c['input'] for c in oracles])):assert matches(spec,value,actual,case['expectedOutput']),(identifier,'positive control')
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Uber'],description=spec['description']+'\n\n本站已明确标准输入输出；源未给出的范围均标明为本站协议。',input=spec['input'],output=spec.get('output','输出一个整数答案。'),explanation=spec['explanation'],hints=[spec['idea']],timeLimit=spec.get('timeLimit',4),memoryLimit=spec.get('memoryLimit',262144),outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        process=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert process.returncode==0,(identifier,process.stderr[:1500]);normalized=process.stdout;assert '\ufffd' not in normalized
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=spec['maxInputBytes'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(identifier,'163 independent checks;',len(cases)-3,'hidden; two normal-exit mutants rejected',flush=True)
    entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20261200,problems=reports,skipped={f'oa-uber-{k}':v for k,v in BLOCKED.items()},note='Local runpy batch execution, fresh __main__/streams per case, not per-case OS isolation; real sandbox required. 25 Fraction oracle; 34 subset partition oracle; 38 all ordered pairs oracle. Byte bounds assume canonical decimal syntax and documented input protocol.'),'reviews':dict(schemaVersion=1,items=[dict(id=f'oa-uber-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,NOTES.get(i,'正文明确，已编写独立参考和暴力对照、真实最大规模及两个正常退出错误程序。'))) for i in range(21,41)])}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
