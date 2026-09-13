"""Independently authored Uber 41..65; source solutions are never executed."""
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
BATCH='uber-remaining'
SPECS=[]
def add(i,title,description,input,idea,proof,complexity,samples,explanation,random_case,encode,oracle,code,mutants,edges,**extra):
    SPECS.append(dict(id=i,title=title,description=description,input=input,idea=idea,proof=proof,complexity=complexity,samples=samples,explanation=explanation,random=random_case,encode=encode,oracle=oracle,code=code,mutants=mutants,edges=edges,**extra))
def array(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def tree_case(r,cap=8):
    n=r.randint(1,cap);return n,[(i,r.randrange(i)) for i in range(1,n)]

# PROBLEMS
def balanced_oracle(a):return ''.join(str(int(any(set(a[i:i+k])==set(range(1,k+1)) for i in range(len(a)-k+1)))) for k in range(1,len(a)+1))
add(42,'前k个数能否构成连续排列','数组是1..n的排列。对每个k，判断是否存在某个连续子数组，恰好包含1..k各一次，依次输出n个0/1。','第一行n，第二行排列；1≤n≤100000。','按值从1到n加入所在下标，维护最左和最右位置。区间长度等于已加入的k时，这k个位置连续。','排列保证值1..k对应k个不同位置，全部位于最小包围区间中；包围区间长度为k当且仅当没有间隙，此时其元素恰为1..k。','时间O(n)，空间O(n)。',[[4,1,3,2],[1,2,3],[2,3,1]],'样例1：k=1、3、4符合，k=2的1和2被3隔开，输出1011。样例2：所有前缀都符合，输出111。样例3：1和2不相邻，只有k=1、3符合，输出101。',lambda r:r.sample(range(1,(n:=r.randint(1,10))+1),n),array,balanced_oracle,'''def solve(d):
    n=int(d[0]);position=[0]*(n+1)
    for i in range(n):position[int(d[i+1])]=i
    left=n;right=-1;result=[]
    for k in range(1,n+1):
        left=min(left,position[k]);right=max(right,position[k]);result.append('1' if right-left+1==k else '0')
    return ''.join(result)
''',[('只接受前缀','right-left+1==k','right==k-1'),('长度少加一','right-left+1==k','right-left==k')],[(list(range(1,100001)),'1'*100000),(list(range(100000,0,-1)),'1'*100000)],output='输出长n的01串。',maxInputBytes=600007)

def path_oracle(x):
    labels,edges,queries=x;n=len(labels);graph=[[] for _ in labels]
    for a,b in edges:graph[a].append(b);graph[b].append(a)
    answer=[]
    for start,end in queries:
        todo=[(start,-1,labels[start])]
        while todo:
            v,parent,s=todo.pop()
            if v==end:answer.append(str(int(sum(count%2 for count in collections.Counter(s).values())<=1)));break
            todo.extend((w,v,s+labels[w]) for w in graph[v] if w!=parent)
    return '\n'.join(answer)
def path_random(r):
    n=r.randint(1,12);return ''.join(r.choice('abcd') for _ in range(n)),[(i,r.randrange(i)) for i in range(1,n)],[(r.randrange(n),r.randrange(n)) for _ in range(r.randint(1,15))]
def path_encode(x):
    s,e,q=x;return f'{len(s)} {len(q)}\n{s}\n'+''.join(f'{a} {b}\n' for a,b in e+q)
add(43,'树上路径字符能否重排为回文','树的节点带小写字母。每次询问两个节点之间唯一路径上的全部字符（含两端），能否重新排列为回文。','第一行n q，第二行n个小写字母；随后n−1条无向边，再q对查询节点，下标0开始。1≤n,q≤100000。','维护根到每点的字符奇偶位掩码，并用倍增求最近公共祖先LCA。路径掩码为mask[u] xor mask[v] xor 字母位[LCA]，至多一个置位即可。','两个根路径异或会消去共同前缀，也消去应保留一次的LCA，补回该字母得到完整路径奇偶性。回文除中央字符外都成对，至多一个奇数频次是充要条件。','时间O((n+q)log n)，空间O(n log n)。',[('aba',[(0,1),(1,2)],[(0,2),(0,1)]),('aa',[(0,1)],[(0,1)]),('abcd',[(0,1),(0,2),(0,3)],[(1,2)])],'样例1：路径aba可重排，ab有两种奇数频次，输出1、0。样例2：aa的两次a可以配对，输出1。样例3：bac三种字符均奇数，输出0。',path_random,path_encode,path_oracle,'''def solve(d):
    n,q=map(int,d[:2]);labels=d[2];graph=[[] for _ in range(n)];cursor=3
    for _ in range(n-1):
        a,b=map(int,d[cursor:cursor+2]);cursor+=2;graph[a].append(b);graph[b].append(a)
    parent=[0]*n;depth=[0]*n;mask=[0]*n;mask[0]=1<<(ord(labels[0])-97);stack=[0]
    while stack:
        v=stack.pop()
        for w in graph[v]:
            if w==parent[v]:continue
            parent[w]=v;depth[w]=depth[v]+1;mask[w]=mask[v]^(1<<(ord(labels[w])-97));stack.append(w)
    up=[parent]
    for _ in range(1,n.bit_length()):up.append([up[-1][up[-1][i]] for i in range(n)])
    def lca(a,b):
        if depth[a]<depth[b]:a,b=b,a
        delta=depth[a]-depth[b]
        for j in range(len(up)):
            if delta>>j&1:a=up[j][a]
        if a==b:return a
        for j in range(len(up)-1,-1,-1):
            if up[j][a]!=up[j][b]:a,b=up[j][a],up[j][b]
        return parent[a]
    answer=[]
    for _ in range(q):
        a,b=map(int,d[cursor:cursor+2]);cursor+=2;v=lca(a,b);parity=mask[a]^mask[b]^(1<<(ord(labels[v])-97));answer.append(str(int(parity.bit_count()<=1)))
    return '\\n'.join(answer)
''',[('遗漏公共祖先字符',"mask[a]^mask[b]^(1<<(ord(labels[v])-97))",'mask[a]^mask[b]'),('仅接受全偶数频次','parity.bit_count()<=1','parity.bit_count()==0')],[(('a'*100000,[(i-1,i) for i in range(1,100000)],[(i,99999-i) for i in range(100000)]),'\n'.join(['1']*100000)),(('ab'*50000,[(0,i) for i in range(1,100000)],[(1,2)]*100000),'\n'.join(['1']*100000))],output='每次查询输出1或0。',maxInputBytes=2500020,timeLimit=8)

def prime_jump_oracle(a):
    def prime(v):return v>=2 and all(v%d for d in range(2,int(v**0.5)+1))
    reachable={0}
    for i in range(len(a)):
        if i in reachable:
            for j in range(i+1,min(len(a),i+a[i]+1)):
                if prime(j-i):reachable.add(j)
    return str(int(len(a)-1 in reachable))
add(44,'按质数步长向后跳跃','从下标0出发，只能跳到更大的下标j，且j−i必须是质数并不超过nums[i]。判断能否到达最后一个下标。原例[2,3,1,1,0]不能从下标2跳2步，按正文应输出0。','第一行n，第二行n个最大跳长；1≤n≤200000，0≤nums[i]≤10⁹。','筛出小于n的质数，并存成大整数位集。按递增下标处理已达位置，将不超过当前位置跳长的质数位集左移到目标下标，与待处理集合合并。','只有允许的质数步长会产生新位置，所以不会误报。每条边严格向后，递增处理已达位置是拓扑传播；从0可达的所有路径按长度归纳最终都会被标记。','筛法O(n log log n)；位集传播最坏O(n²/W)机器字操作，空间O(n)，W为大整数内部字位数。',[[2,3,1,1,0],[1,1,1,1],[2,0,2,0,0]],'样例1：只能从0到2，nums[2]=1无法继续，正确答案0。样例2：1不是质数，无法移动，输出0。样例3：0→2→4两次步长2都合法，输出1。',lambda r:[r.randint(0,20) for _ in range(r.randint(1,20))],array,prime_jump_oracle,'''def solve(d):
    a=list(map(int,d[1:]));n=len(a)
    if n==1:return '1'
    sieve=bytearray(b'\\1')*n;sieve[0]=sieve[1]=0
    for p in range(2,int(n**0.5)+1):
        if sieve[p]:sieve[p*p:n:p]=b'\\0'*(((n-1-p*p)//p)+1)
    packed=bytearray((n+7)//8)
    for i in range(2,n):
        if sieve[i]:packed[i//8]|=1<<(i%8)
    primes=int.from_bytes(packed,'little');pending=1;i=0
    while pending:
        if pending&1==0:
            gap=(pending&-pending).bit_length()-1;pending>>=gap;i+=gap
        if i==n-1:return '1'
        bound=min(a[i],n-1-i)
        if bound>=2:pending|=primes&((1<<(bound+1))-1)
        if pending.bit_length()==n-i:return '1'
        pending>>=1;i+=1
    return '0'
''',[('把步长1当作质数','sieve[0]=sieve[1]=0','sieve[0]=0'),('允许超过最大步长一格','bound=min(a[i],n-1-i)','bound=min(a[i]+1,n-1-i)')],[(([0]*200000),'0'),(([199998-i for i in range(199999)]+[0]),'0'),(([10**9]*200000),'1')],maxInputBytes=2200008,timeLimit=10)

def pattern_oracle(x):
    a,p=x;return str(sum(all((a[i+j+1]>a[i+j])-(a[i+j+1]<a[i+j])==v for j,v in enumerate(p)) for i in range(len(a)-len(p))))
add(45,'相邻升降模式匹配次数','模式中1表示后一个数大于前一个，0表示相等，−1表示小于。统计长度为模式长度加1、相邻关系逐项匹配的连续子数组数量。','第一行n m，再两行数组与模式。源无数值范围，本站1≤m<n≤200000，数组元素−10⁹..10⁹，模式值−1/0/1。','先将数组相邻比较结果化为−1/0/1序列，再用KMP统计模式出现次数，允许重叠。','长度m+1的原子数组唯一对应长m的比较序列，两者匹配条件逐项等价。KMP失配跳转只跳过不可能的起点，因此不漏、不重。','时间O(n+m)，空间O(n+m)。',[([4,1,3,4,4,5,5,1],[1,0,-1]),([1,2,3,4],[1,1]),([2,2,2],[0])],'样例1：只有4、5、5、1依次升、平、降，答案1。样例2：1、2、3与2、3、4两个重叠窗口符合，答案2。样例3：两个相邻窗口都相等，答案2。',lambda r:([r.randint(-3,3) for _ in range(n)], [r.randint(-1,1) for _ in range(r.randint(1,n-1))]) if (n:=r.randint(2,12)) else None,lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',pattern_oracle,'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:n+2]));pattern=list(map(int,d[n+2:]));failure=[0]*m;j=0
    for i in range(1,m):
        while j and pattern[i]!=pattern[j]:j=failure[j-1]
        if pattern[i]==pattern[j]:j+=1
        failure[i]=j
    j=answer=0
    for i in range(n-1):
        value=(a[i+1]>a[i])-(a[i+1]<a[i])
        while j and value!=pattern[j]:j=failure[j-1]
        if value==pattern[j]:j+=1
        if j==m:answer+=1;j=failure[j-1]
    return str(answer)
''',[('禁止重叠','answer+=1;j=failure[j-1]','answer+=1;j=0'),('把升序误当下降','value=(a[i+1]>a[i])-(a[i+1]<a[i])','value=(a[i+1]<a[i])-(a[i+1]>a[i])')],[(([7]*200000,[0]*99999),'100001'),((list(range(200000)),[1]*199999),'1')],maxInputBytes=3000014)

def transform_oracle(x):
    a,q=x;a=[row.copy() for row in a];n=len(a)
    for kind in q:
        b=[[0]*n for _ in a]
        for i in range(n):
            for j in range(n):
                ni,nj=(j,n-1-i) if kind==0 else (j,i) if kind==1 else (n-1-j,n-1-i);b[ni][nj]=a[i][j]
        a=b
    return '\n'.join(' '.join(map(str,row)) for row in a)
add(46,'组合旋转和对角反射','依次对正方形矩阵执行指定变换。本站操作编号明确为：0顺时针旋转90度，1关于主对角线反射，2关于副对角线反射。','第一行n q，随后n行每行n个整数，最后一行q个操作编号。源无规模界，本站1≤n≤500、0≤q≤200000，元素−10⁹..10⁹。','不反复移动整个矩阵，维护原坐标映射的两个方向向量和原点。每次操作变换原点和向量，最终按得到的坐标映射一次填入结果矩阵。','旋转与反射都是仿射变换，原点与两个单位向量唯一确定整个坐标映射。逐次对映射应用相同变换等价于对所有元素应用变换，最后一次填入恰是全部操作复合结果。','时间O(q+n²)，空间O(n²)。',[([[1,2,3],[4,5,6],[7,8,9]],[0,1,2]),([[1,2],[3,4]],[1]),([[9]],[])],'样例1：按顺序变换后各行为3 6 9、2 5 8、1 4 7。样例2：主对角线转置，得到1 3、2 4。样例3：无操作，仍为9。',lambda r:([[r.randint(-5,5) for _ in range(n)] for _ in range(n)],[r.randrange(3) for _ in range(r.randint(0,12))]) if (n:=r.randint(1,5)) else None,lambda x:f'{len(x[0])} {len(x[1])}\n'+''.join(' '.join(map(str,row))+'\n' for row in x[0])+' '.join(map(str,x[1]))+'\n',transform_oracle,'''def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n*n]));origin=(0,0);dr=(1,0);dc=(0,1)
    for token in d[2+n*n:]:
        kind=int(token)
        if kind==0:origin=(origin[1],n-1-origin[0]);dr=(dr[1],-dr[0]);dc=(dc[1],-dc[0])
        elif kind==1:origin=origin[::-1];dr=dr[::-1];dc=dc[::-1]
        else:origin=(n-1-origin[1],n-1-origin[0]);dr=(-dr[1],-dr[0]);dc=(-dc[1],-dc[0])
    result=[[0]*n for _ in range(n)]
    for i in range(n):
        for j in range(n):result[origin[0]+i*dr[0]+j*dc[0]][origin[1]+i*dr[1]+j*dc[1]]=a[i*n+j]
    return '\\n'.join(' '.join(map(str,row)) for row in result)
''',[('交换两种反射','elif kind==1:','elif kind==2:'),('倒序处理变换','for token in d[2+n*n:]:','for token in reversed(d[2+n*n:]):')],[(([[i*500+j for j in range(500)] for i in range(500)],[0]*200000),'\n'.join(' '.join(str(i*500+j) for j in range(500)) for i in range(500)))],output='输出变换后矩阵，每行n个整数。',maxInputBytes=3400014,timeLimit=6)

def comfort_oracle(rows):return str(max(mask.bit_count() for mask in range(1<<len(rows)) if all(not(mask>>i&1) or low<=mask.bit_count()-1<=high for i,(low,high) in enumerate(rows))))
add(47,'舒适人数区间内的最大同乘人数','乘客i只愿意与low[i]到high[i]名其他乘客同乘。可以任选一个乘客子集同时乘车，要求其中每人都满足自己的区间，求最大人数；空集合法。','第一行n，随后n行low high；1≤n≤100000，0≤low≤high≤n。','人数k可行当且仅当至少k个区间覆盖k−1。差分统计每个其他人数被多少区间覆盖，再找最大的可行k。','组内每人都必须覆盖k−1是必要条件；如果至少k人覆盖它，任选k人就全部舒适，故也是充分条件。差分准确统计闭区间覆盖次数，穷尽所有人数取最大。','时间O(n)，空间O(n)。',[[(1,3),(2,4),(0,2),(1,3)],[(0,2)]*3,[(2,2)]*2],'样例1：3人时可以任选三个覆盖2的乘客；4人时只有3人覆盖3，故最大3。样例2：三人都能接受另两人，答案3。样例3：两人都要求另有2人，但总共仅2人，答案0；同时修正原第三例high=3越过n=2的非法范围。',lambda r:[(min(a,b),max(a,b)) for a,b in [(r.randint(0,n),r.randint(0,n)) for _ in range(n)]] if (n:=r.randint(1,9)) else None,lambda rows:str(len(rows))+'\n'+''.join(f'{a} {b}\n' for a,b in rows),comfort_oracle,'''def solve(d):
    n=int(d[0]);difference=[0]*(n+2)
    for i in range(1,len(d),2):left,right=map(int,d[i:i+2]);difference[left]+=1;difference[right+1]-=1
    count=answer=0
    for others in range(n):
        count+=difference[others]
        if count>=others+1:answer=others+1
    return str(answer)
''',[('把自己算作其他人','if count>=others+1:answer=others+1','if count>=others:answer=others'),('右端误作开区间','difference[right+1]-=1','difference[right]-=1')],[([(0,100000)]*100000,'100000'),([(100000,100000)]*100000,'0')],maxInputBytes=1400008)

def square_oracle(grid):return str(max([0]+[size*size for size in range(1,min(len(grid),len(grid[0]))+1) for i in range(len(grid)-size+1) for j in range(len(grid[0])-size+1) if all(grid[x][y]=='1' for x in range(i,i+size) for y in range(j,j+size))]))
add(48,'全1最大正方形面积','在01矩阵中找到全部为1的轴对齐正方形，返回最大面积。','第一行n m，随后n行长度m的01串。1≤n,m≤300。','按行滚动DP，当前位置为1时，以它为右下角的最大边长是左、上、左上三者最小值加1。','边长s正方形需要上述三个边长至少s−1的正方形与当前1共同覆盖；三者最小值加1可构成正方形，且更大必使至少一侧不足。对全部右下角取最大边长平方。','时间O(nm)，除输入外空间O(m)。',[['10100','10111','11111','10010'],['00','00'],['111','111']],'样例1：中间有边长2的全1正方形，最大面积4。样例2：全部为0，输出0；原站第二段2×2输入缺一行，已补齐。样例3：只有两行，最大边长2，面积4。',lambda r:[''.join(r.choice('01') for _ in range(m)) for _ in range(r.randint(1,6))] if (m:=r.randint(1,6)) else None,lambda g:f'{len(g)} {len(g[0])}\n'+'\n'.join(g)+'\n',square_oracle,'''def solve(d):
    n,m=map(int,d[:2]);previous=[0]*(m+1);best=0
    for row in d[2:]:
        current=[0]*(m+1)
        for j,c in enumerate(row,1):
            if c=='1':current[j]=1+min(previous[j],previous[j-1],current[j-1]);best=max(best,current[j])
        previous=current
    return str(best*best)
''',[('返回边长非面积','str(best*best)','str(best)'),('忽略左上约束','min(previous[j],previous[j-1],current[j-1])','min(previous[j],current[j-1])')],[(['1'*300]*300,'90000'),(['0'*300]*300,'0')],maxInputBytes=90308)

def xor_oracle(x):
    a,queries=x;answers=[]
    for left,right in queries:
        best=0
        for i in range(left,right+1):
            for j in range(i,right+1):
                row=a[i:j+1]
                while len(row)>1:row=[row[k]^row[k+1] for k in range(len(row)-1)]
                best=max(best,row[0])
        answers.append(str(best))
    return '\n'.join(answers)
def xor_random(r):
    a=[r.randint(0,63) for _ in range(r.randint(1,9))];return a,[(min(i,j),max(i,j)) for i,j in [(r.randrange(len(a)),r.randrange(len(a))) for _ in range(r.randint(1,10))]]
add(50,'区间内的最大逐层异或值','f对单元素返回本身；否则把相邻元素两两异或，得到长度少1的数组，再递归直到只剩一个值。每次查询[l,r]，求其中所有非空连续子数组f值的最大值，注意f不是普通区间异或。','第一行n q，第二行n个整数，随后q行0-based的l r，0≤l≤r<n。源无规模范围，本站1≤n≤2000、1≤q≤100000、0≤a[i]≤2³⁰−1。','按长度计算f(l,r)=f(l,r−1) xor f(l+1,r)。同时best(l,r)取f(l,r)、best(l,r−1)、best(l+1,r)的最大值，保留紧凑无符号整数表回答查询。','异或金字塔最后一步正是左右两个长一层子数组的f异或。一个[l,r]内部子区间要么为整段，要么缺左端或右端，故best递推穷尽所有子区间。长度递增保证依赖已知。','预处理时间O(n²)，每次查询O(1)，空间O(n²)。',[([1,2,4,8],[(0,3),(1,2)]),([8,1,8],[(0,2)]),([0],[(0,0)])],'样例1：整段f为15且最大，子区间[2,4]的f为6，输出15、6。样例2：整段f=8 xor 8=0，但相邻[8,1]的f=9，最大9，不是普通三数异或。样例3：单元素f就是0。',xor_random,lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+''.join(f'{a} {b}\n' for a,b in x[1]),xor_oracle,'''from array import array
def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));best=[array('I',[0])*n for _ in range(n)]
    for i,v in enumerate(a):best[i][i]=v
    previous=a
    for size in range(2,n+1):
        current=[]
        for left in range(n-size+1):
            right=left+size-1;value=previous[left]^previous[left+1];current.append(value);best[left][right]=max(value,best[left][right-1],best[left+1][right])
        previous=current
    return '\\n'.join(str(best[int(d[i])][int(d[i+1])]) for i in range(2+n,len(d),2))
''',[('只返回整段f','max(value,best[left][right-1],best[left+1][right])','value'),('漏右侧子区间','max(value,best[left][right-1],best[left+1][right])','max(value,best[left][right-1])')],[(([2**30-1]*2000,[(0,1999)]*100000),'\n'.join([str(2**30-1)]*100000)),(([0]*2000,[(0,1999)]*100000),'\n'.join(['0']*100000))],output='每个查询输出一行最大值。',maxInputBytes=1022015,timeLimit=8)

def reversal_oracle(x):
    n,edges=x;best=n
    for root in range(n):
        dist={root:0};todo=[root]
        while todo:
            v=todo.pop()
            for a,b in edges:
                if a==v and b not in dist:dist[b]=dist[v]+1;todo.append(b)
                if b==v and a not in dist:dist[a]=dist[v]+1;todo.append(a)
        best=min(best,sum(dist[a]>dist[b] for a,b in edges))
    return str(best)
def reversal_random(r):
    n=r.randint(1,10);return n,[(i,p) if r.randrange(2) else (p,i) for i,p in [(i,r.randrange(i)) for i in range(1,n)]]
add(51,'任选根后的最少边反转','给定一棵树，每条边目前有方向。任选一个节点作根，要求所有边最终都指向远离根的一侧，每次反转一条边成本1，求最小总成本。','第一行n，接着n−1行有向边u v，0-based。源无数值上限，本站1≤n≤200000，忽略方向后必须是一棵树。','先以0为根计算反向边数，再换根：沿原本正向父子边把根移向子节点时需多反转1条，原本反向则少1条。','相邻换根只改变它们之间那条边的目标方向，其他边相对于根的方向需求不变，因此代价变化恰为±1。遍历所有节点得到全部根代价，取最小。','时间O(n)，空间O(n)。',[(3,[(0,1),(2,1)]),(3,[(0,1),(1,2)]),(1,[])],'样例1：无论取0还是2作根都只需反转1条，最小1。样例2：以0为根所有边已向外，输出0。样例3：没有边，不必反转。',reversal_random,lambda x:str(x[0])+'\n'+''.join(f'{a} {b}\n' for a,b in x[1]),reversal_oracle,'''def solve(d):
    n=int(d[0]);graph=[[] for _ in range(n)]
    for i in range(1,len(d),2):
        a,b=map(int,d[i:i+2]);graph[a].append((b,0));graph[b].append((a,1))
    parent=[-1]*n;order=[0];cost=[0]*n;initial=0
    for v in order:
        for w,reverse in graph[v]:
            if w==parent[v]:continue
            parent[w]=v;cost[w]=reverse;initial+=reverse;order.append(w)
    answer=[initial]*n
    for v in order[1:]:answer[v]=answer[parent[v]]+1-2*cost[v]
    return str(min(answer))
''',[('固定根0','str(min(answer))','str(answer[0])'),('换根符号错误','+1-2*cost[v]','-1+2*cost[v]')],[((200000,[(i-1,i) for i in range(1,200000)]),'0'),((200000,[(i,0) for i in range(1,200000)]),'199998')],maxInputBytes=2800008,timeLimit=6)

def harmonious_oracle(a):
    best=len(a)
    for mask in range(1<<len(a)):
        sequence=[a[i] for i in range(len(a)) if mask>>i&1];p=0
        while p<len(sequence):p+=sequence[p]+1
        if p==len(sequence):best=min(best,len(a)-len(sequence))
    return str(best)
add(53,'最少删除形成计数分组','一个组的第一个数表示之后恰好跟随多少个组内元素。序列能连续拆成若干这种组就合法，空序列也合法。每次可以删除任意一个元素，求最少删除数。','第一行n，第二行n个整数；1≤n≤200000，1≤a[i]≤100000。','从后向前DP。当前位置可删除，成本1+dp[i+1]；或用它作组头，保留紧随的a[i]个元素，成本dp[i+a[i]+1]，后者需不越界。','任何非空合法剩余序列的首元素都作组头。若保留i作组头，选择紧接着的a[i]个元素不会比跨过一些元素更差：被选为组内内容的数值无要求，改用更早元素可少删除并给后续留下更多可选元素。故最优解可只考虑该完整连续组，和删除i两种情况穷尽最优。','时间O(n)，空间O(n)。',[[3,7,2,6,2,4,4],[3,2,1],[1,8,4,5,2,6,1]],'样例1：可分[3,7,2,6]与[2,4,4]，无需删除。样例2：删掉开头3，剩[2,1]仍不够；删3、2后[1]也不够，最优删除全部3个。样例3：分成[1,8]与[4,5,2,6,1]，答案0。',lambda r:[r.randint(1,8) for _ in range(r.randint(1,12))],array,harmonious_oracle,'''def solve(d):
    a=list(map(int,d[1:]));n=len(a);dp=[0]*(n+1)
    for i in range(n-1,-1,-1):
        dp[i]=1+dp[i+1];end=i+a[i]+1
        if end<=n:dp[i]=min(dp[i],dp[end])
    return str(dp[0])
''',[('组头误计入内容长度','end=i+a[i]+1','end=i+a[i]'),('不接受恰好末尾','if end<=n:','if end<n:')],[(([1]*200000),'0'),(([100000]*200000),'99999'),(([100000]*99999),'99999')],maxInputBytes=1400008)

def shifts_oracle(a):
    for count in range(len(a)):
        candidate=a[-count:]+a[:-count] if count else a
        if candidate==sorted(a):return str(count)
    return '-1'
add(54,'排成升序的最少循环右移','数组含不同正整数。每次把末尾元素移到最前面，其余元素右移一格。求使数组严格升序的最少次数，不能做到则−1。','第一行n，第二行n个不同整数；1≤n≤100，1≤a[i]≤100。','已升序则0，否则在循环相邻关系中检查下降边。恰有一条下降边时，在它之后切开可得到升序，右移n−切点次。','循环右移保留所有循环相邻关系，只改变哪条边成为末尾到开头。严格升序的不同元素循环中恰有一条下降边，因此只有一个下降边是可行的充要条件，切点也唯一。','时间O(n)，空间O(n)保存输入。',[[3,4,5,1,2],[1,3,5],[2,1,4]],'样例1：连续右移两次得到1、2、3、4、5，答案2。样例2：已升序，答案0。样例3：循环上有2→1和4→2两条下降边，不能只靠旋转排好，输出−1。',lambda r:r.sample(range(1,101),r.randint(1,15)),array,shifts_oracle,'''def solve(d):
    a=list(map(int,d[1:]));n=len(a)
    if all(a[i]<a[i+1] for i in range(n-1)):return '0'
    breaks=[i for i in range(n) if a[i]>a[(i+1)%n]]
    return str(n-breaks[0]-1) if len(breaks)==1 else '-1'
''',[('不检查首尾下降','range(n) if a[i]>','range(n-1) if a[i]>'),('左右移动混淆','str(n-breaks[0]-1)','str(breaks[0]+1)')],[(list(range(2,101))+[1],'1'),(list(range(100,0,-1)),'-1')],maxInputBytes=405)

def pipeline_oracle(x):
    base,cost,budget=x;best=0
    def enumerate_scales(i,left,current):
        nonlocal best
        if i==len(base):best=max(best,current);return
        for times in range(left//cost[i]+1):enumerate_scales(i+1,left-times*cost[i],min(current,base[i]*(times+1)))
    enumerate_scales(0,budget,10**30);return str(best)
add(56,'预算内最大串行吞吐量','服务i扩容x次需花x×cost[i]，吞吐量变为base[i]×(1+x)，x为非负整数。串行流水线吞吐量为所有服务的最小值，求总预算内最大吞吐量。','第一行n budget，第二行base，第三行cost。源无数字范围，本站1≤n≤100000，1≤base[i],cost[i]≤10⁹，0≤budget≤10¹⁵。','二分目标吞吐T。服务i至少扩容ceil(T/base[i])−1次，逐项累加最低花费；超过预算则不可行。','为达到流水线目标，所有服务都必须达到T，各服务最低扩容量独立且唯一，花费求和就是必要且充分成本。该成本随T单调不减，因此二分取得最大可行值。','时间O(n log U)，空间O(n)，U=min(base[i]×(1+budget//cost[i]))。',[([5,2,4],[3,10,2],0),([5,2,4],[3,10,2],20),([3],[2],5)],'样例1：没有预算，瓶颈为2。样例2：吞吐4需10预算；吞吐5需22预算，超出20，所以最大4，并非必须花光预算。样例3：最多扩容两次，吞吐3×3=9。',lambda r:([r.randint(1,6) for _ in range(n)],[r.randint(1,5) for _ in range(n)],r.randint(0,12)) if (n:=r.randint(1,4)) else None,lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',pipeline_oracle,'''def solve(d):
    n,budget=map(int,d[:2]);base=list(map(int,d[2:2+n]));cost=list(map(int,d[2+n:]));low=min(base);high=min(v*(1+budget//c) for v,c in zip(base,cost))
    while low<high:
        target=(low+high+1)//2;spent=0
        for v,c in zip(base,cost):
            spent+=max(0,(target-1)//v)*c
            if spent>budget:break
        if spent<=budget:low=target
        else:high=target-1
    return str(low)
''',[('整倍目标也多买一次','(target-1)//v','target//v'),('恰好预算不接受','if spent<=budget:','if spent<budget:')],[(([10**9]*100000,[1]*100000,10**15),'10000000001000000000'),(([1]*100000,[10**9]*100000,10**15),'11')],maxInputBytes=2200025,timeLimit=10)

def region_oracle(grid):
    n=len(grid);m=len(grid[0]);found=[]
    for i in range(n):
        for j in range(m):
            value=grid[i][j]
            if value and all(grid[x][y]<=value for x in range(n) for y in range(m) if abs(x-i)<=value and abs(y-j)<=value and not(abs(x-i)==value and abs(y-j)==value)):found.append((i,j))
    return str(len(found))+'\n'+'\n'.join(f'{i} {j}' for i,j in found)
def region_valid(grid,text,expected_text):
    try:
        values=list(map(int,text.split()));expected=list(map(int,expected_text.split()));coords=list(zip(values[1::2],values[2::2]));target=set(zip(expected[1::2],expected[2::2]))
        return bool(values) and values[0]*2+1==len(values) and len(coords)==len(set(coords)) and set(coords)==target
    except ValueError:return False
add(57,'排除原始角点的区域最大值','非零单元格(i,j)的值v也作为半径，其区域为[i−v,i+v]×[j−v,j+v]，去掉原始四个角点，再忽略越界部分。该单元格值等于区域最大值时即为区域最大点；并列最大全部保留。返回所有这类点，顺序任意。','第一行n m，随后n行m个整数。源无数值范围，本站1≤n,m≤100，0≤值≤10⁹。','建立二维区间最大值树。每个区域去角后拆为中间完整矩形与上下边界两段，至多查询三个矩形；原始边界越界就不查该段，不把裁剪后的角误删。','中间行不含任何原始角，上下原始边界行仅须排除左右端点，这三个区域的并集恰好是定义区域。二维树返回各矩形最大值，与本格比较可精确判断，零格直接排除。','建树O(NM)，每格O(log N log M)查询，空间O(NM)；N、M为行列上取整到2的幂。',[ [[3,0,1],[2,0,0],[0,0,0]],[[1,9],[0,1]],[[2,2],[2,2]] ],'样例1：只有(0,0)的3和(0,2)的1符合。样例2：(0,1)的9最大；两个1的区域都含它且它不是原始角点，因此只有(0,1)。样例3：四格都并列最大，全部输出，任意顺序均可。',lambda r:[[r.randint(0,7) for _ in range(m)] for _ in range(r.randint(1,5))] if (m:=r.randint(1,5)) else None,lambda g:f'{len(g)} {len(g[0])}\n'+''.join(' '.join(map(str,row))+'\n' for row in g),region_oracle,'''def solve(d):
    n,m=map(int,d[:2]);grid=[list(map(int,d[2+i*m:2+(i+1)*m])) for i in range(n)];nr=1;nc=1
    while nr<n:nr*=2
    while nc<m:nc*=2
    tree=[[0]*(2*nc) for _ in range(2*nr)]
    for i,row in enumerate(grid):
        for j,v in enumerate(row):tree[nr+i][nc+j]=v
        for j in range(nc-1,0,-1):tree[nr+i][j]=max(tree[nr+i][j*2],tree[nr+i][j*2+1])
    for i in range(nr-1,0,-1):
        for j in range(1,2*nc):tree[i][j]=max(tree[2*i][j],tree[2*i+1][j])
    def query(top,bottom,left,right):
        if top>bottom or left>right:return 0
        top+=nr;bottom+=nr+1;result=0
        while top<bottom:
            nodes=[]
            if top&1:nodes.append(top);top+=1
            if bottom&1:bottom-=1;nodes.append(bottom)
            for node in nodes:
                a,b=left+nc,right+nc+1
                while a<b:
                    if a&1:result=max(result,tree[node][a]);a+=1
                    if b&1:b-=1;result=max(result,tree[node][b])
                    a//=2;b//=2
            top//=2;bottom//=2
        return result
    found=[]
    for i in range(n):
        for j in range(m):
            v=grid[i][j]
            if v==0:continue
            biggest=query(max(0,i-v+1),min(n-1,i+v-1),max(0,j-v),min(m-1,j+v))
            for row in (i-v,i+v):
                if 0<=row<n:biggest=max(biggest,query(row,row,max(0,j-v+1),min(m-1,j+v-1)))
            if biggest<=v:found.append((i,j))
    return str(len(found))+'\\n'+'\\n'.join(f'{i} {j}' for i,j in found)
''',[('零也视为最大','if v==0:continue','if v<0:continue'),('不接受并列','if biggest<=v:','if biggest<v:')],[(([[10**9]*100]*100),'10000\n'+'\n'.join(f'{i} {j}' for i in range(100) for j in range(100))),(([[0]*100]*100),'0\n')],checker='oa-regional-maxima',valid=region_valid,output='先输出点数k，再输出k对0-based行列坐标，顺序任意且不能重复。',maxInputBytes=110008,timeLimit=6)

def digits_oracle(s):
    while True:
        groups=[list(g) for _,g in itertools.groupby(s)]
        if all(len(g)==1 for g in groups):return s
        s=''.join(str(sum(map(int,g))) for g in groups)
add(58,'重复数字分组求和直到稳定','每轮同时把每个连续相同数字组替换成组内数字之和的十进制表示。不断重复，直到不存在相邻相同数字。输入是字符串，前导0保留；多个0求和后变一个0。','一行非空数字串。源无长度范围，本站长度1..2000。','逐轮扫描相同字符段，用数字值乘段长计算替代串；若所有段长度均1则停止。','每轮分段是唯一的，扫描替换与同步规则一致。长度不会增加；若某重复段替换后长度不减少，则其数字和因十进制进位而减少。因此“串长+各位数字和”严格下降，最多O(n)轮后终止。','时间上界O(n²)，空间O(n)，初始数字和至多9n。',['999433','44488366664','0044886'],'样例1：999→27、33→6，得到2746，已经稳定。样例2：第一轮12163244仍含44，需继续变为1216328，原站停早了。样例3：0044886→08166→08112→0822→084，答案084，前导0保留。',lambda r:''.join(r.choice('0123456789') for _ in range(r.randint(1,25))),lambda s:s+'\n',digits_oracle,'''def solve(d):
    s=d[0]
    while True:
        result=[];changed=False;i=0
        while i<len(s):
            j=i+1
            while j<len(s) and s[j]==s[i]:j+=1
            changed|=j-i>1;result.append(str(int(s[i])*(j-i)));i=j
        if not changed:return s
        s=''.join(result)
''',[('只进行一轮',"s=''.join(result)","return ''.join(result)"),('丢弃前导零','if not changed:return s','if not changed:return str(int(s))')],[('9'*2000,'18000'),('0'*2000,'0'),('12'*1000,'12'*1000)],output='输出最终数字串。',maxInputBytes=2001)

def flood_oracle(x):
    grid,sr,sc=x;n=len(grid);m=len(grid[0]);dist=[[10**9]*m for _ in grid];dist[sr][sc]=0
    for _ in range(n*m):
        new=[row.copy() for row in dist]
        for i in range(n):
            for j in range(m):
                for a,b in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
                    if 0<=a<n and 0<=b<m and grid[a][b]<=grid[i][j]:new[a][b]=min(new[a][b],dist[i][j]+1)
        if new==dist:break
        dist=new
    return '\n'.join(' '.join(str(-1 if v==10**9 else v) for v in row) for row in dist)
add(59,'雨水首次到达各格的时间','水从指定格开始，时间0湿润起点；每一步同时向上下左右高度不超过当前格的相邻格扩散。返回每格首次湿润时间，永远无法到达的格为−1。','第一行n m startRow startCol，再n行m个高度，下标0开始。源无规模界，本站1≤n,m≤500，高度−10⁹..10⁹。','把允许流动方向当作有向边，用广度优先搜索计算从起点到每格的最短边数。','每次扩散耗时1，长度t的合法路径可在时间t使终点湿润，反之首次湿润过程产生同长合法路径。BFS按距离逐层扩展，第一次访问就是最短距离。','时间O(nm)，空间O(nm)。',[([[3,2,1],[6,5,4],[9,8,7]],1,1),([[10]*4 for _ in range(4)],1,2),([[0]],0,0)],'样例1：5先到上方2和右方4，再到1，其他格更高不可达，输出与题面矩阵一致。样例2：等高可流动，所有时间等于到(1,2)的曼哈顿距离。样例3：单格起点时间为0。',lambda r:([[r.randint(-3,5) for _ in range(m)] for _ in range(n)],r.randrange(n),r.randrange(m)) if (n:=r.randint(1,5)) and (m:=r.randint(1,5)) else None,lambda x:f'{len(x[0])} {len(x[0][0])} {x[1]} {x[2]}\n'+''.join(' '.join(map(str,row))+'\n' for row in x[0]),flood_oracle,'''from collections import deque
def solve(d):
    n,m,sr,sc=map(int,d[:4]);grid=[list(map(int,d[4+i*m:4+(i+1)*m])) for i in range(n)];dist=[[-1]*m for _ in range(n)];dist[sr][sc]=0;queue=deque([(sr,sc)])
    while queue:
        i,j=queue.popleft()
        for a,b in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
            if 0<=a<n and 0<=b<m and dist[a][b]<0 and grid[a][b]<=grid[i][j]:dist[a][b]=dist[i][j]+1;queue.append((a,b))
    return '\\n'.join(' '.join(map(str,row)) for row in dist)
''',[('不能流向等高','grid[a][b]<=grid[i][j]','grid[a][b]<grid[i][j]'),('把起点时间记为1','dist[sr][sc]=0','dist[sr][sc]=1')],[(([[10**9]*500 for _ in range(500)],0,0),'\n'.join(' '.join(str(i+j) for j in range(500)) for i in range(500))),(([[0]+[1]*499]+[[1]*500 for _ in range(499)],0,0),'0 '+' '.join(['-1']*499)+'\n'+'\n'.join(' '.join(['-1']*500) for _ in range(499)))],output='输出n行m列的首次湿润时间。',maxInputBytes=3000016,timeLimit=6)

def lamps_oracle(rows):
    left=min(x-r for x,r in rows);right=max(x+r for x,r in rows);return str(max(range(left,right+1),key=lambda p:(sum(x-r<=p<=x+r for x,r in rows),-p)))
add(60,'被最多灯照亮的最左坐标','灯(x,r)照亮闭区间[x−r,x+r]，r>0。返回被最多盏灯同时照亮的位置，若多个位置并列取最小坐标。','第一行n，随后n行x r。源无数值界，本站1≤n≤200000，−10⁹≤x≤10⁹，1≤r≤10⁹。','对整数坐标，在左端加1、右端加1的位置减1，按坐标合并事件并扫描覆盖数；只在严格刷新最大覆盖时记录坐标。','闭区间事件保持右端仍计数。覆盖数仅在这些边界改变，最高覆盖区间的最左端一定是整数事件点；递增扫描且只在严格提高时更新，恰保留并列时最左点。','时间O(n log n)，空间O(n)。',[[(-2,3),(2,3),(2,1)],[(-2,1),(2,1)],[(0,1),(2,1)]],'样例1：三盏灯唯一共同位置是1。样例2：最多被一盏灯照亮，最左位置−3。样例3：两段在闭端点1相接，1被两灯照亮，答案1。',lambda r:[(r.randint(-10,10),r.randint(1,8)) for _ in range(r.randint(1,10))],lambda rows:str(len(rows))+'\n'+''.join(f'{a} {b}\n' for a,b in rows),lamps_oracle,'''def solve(d):
    events={}
    for i in range(1,len(d),2):
        x,r=map(int,d[i:i+2]);events[x-r]=events.get(x-r,0)+1;events[x+r+1]=events.get(x+r+1,0)-1
    count=best=0;answer=0
    for position in sorted(events):
        count+=events[position]
        if count>best:best=count;answer=position
    return str(answer)
''',[('右端误成开区间','x+r+1','x+r'),('并列取最右事件','if count>best:','if count>=best:')],[([(0,10**9)]*200000,'-1000000000'),([(i*3,1) for i in range(200000)],'-1')],maxInputBytes=4600008,timeLimit=6)

def tournament_oracle(a):
    answer=[];size=2
    while size//2<len(a):answer.append([min(a[i:i+size]) for i in range(0,len(a),size)]);size*=2
    return str(len(answer))+'\n'+'\n'.join(str(len(row))+' '+' '.join(map(str,row)) for row in answer)
add(63,'相邻淘汰赛的每轮晋级名单','相邻两名选手比赛，排名数字较小者晋级。每轮人数为奇数时最后一名直接晋级。输出每一轮结束后的名单，保持原比赛顺序，直到只剩一人；不输出初始名单。','第一行n，第二行n个不同排名。源无数字范围，本站1≤n≤200000，1≤rank≤10⁹。','每轮两两取最小值，落单元素直接保留，记录新名单并继续。','每对的最小排名就是该场胜者，按原顺序生成符合下一轮安排。归纳应用各轮规则得到全部正确名单；总人数按约半数递减，处理总量为线性。','时间O(n)，空间O(n)，含全部输出名单。',[[1,2,3,4,5,6,7,8],[3,1,2],[5]],'样例1：三轮分别为1 3 5 7、1 5、1。样例2：第一轮1胜3，2轮空，名单1 2；第二轮1晋级。样例3：一开始只剩一人，没有淘汰轮，输出轮数0。',lambda r:r.sample(range(1,100),r.randint(1,20)),array,tournament_oracle,'''def solve(d):
    a=list(map(int,d[1:]));rounds=[]
    while len(a)>1:
        a=[min(a[i:i+2]) for i in range(0,len(a),2)];rounds.append(str(len(a))+' '+' '.join(map(str,a)))
    return str(len(rounds))+'\\n'+'\\n'.join(rounds)
''',[('强弱排名颠倒','min(a[i:i+2])','max(a[i:i+2])'),('重复输出初始轮','rounds=[]',"rounds=[str(len(a))+' '+' '.join(map(str,a))]")],[(list(range(1,200001)),tournament_oracle(list(range(1,200001)))),(list(range(200000,0,-1)),tournament_oracle(list(range(200000,0,-1))))],output='第一行轮数R；随后每轮一行，先写晋级人数，再写排名名单。',maxInputBytes=2200008,timeLimit=6)

def seven_oracle(s):
    remainder=0
    for c in s:remainder=(remainder*10+int(c))%3
    positions=[i for i,c in enumerate(s) if c=='7'];return str(int(remainder==0 and len(positions)>=2))
add(64,'含至少两个7且能被3整除','判断数字字符串表示的整数是否能被3整除，并且字符7出现至少两次。必须同时满足。','一行非空数字串，可有前导0。源无长度界，本站长度1..1000000。','扫描求各位数字和以及7的次数，检查数位和模3是否为0且计数至少2。','十进制位权10的任意次幂模3都为1，因此整数模3等于数位和模3；另外独立统计7的次数，合取实现两条件。','时间O(n)，额外空间O(1)。',['771','777','171'],'样例1：7+7+1=15且有两个7，输出1。样例2：数位和21，有三个7，输出1。样例3：数位和9虽被3整除，但只有一个7，输出0。',lambda r:''.join(r.choice('0123456789') for _ in range(r.randint(1,40))),lambda s:s+'\n',seven_oracle,'''def solve(d):
    total=count=0
    for c in d[0]:total+=ord(c)-48;count+=c=='7'
    return str(int(total%3==0 and count>=2))
''',[('两条件取或','total%3==0 and count>=2','total%3==0 or count>=2'),('只接受恰好两个7','count>=2','count==2')],[('7'*1000000,'0'),('7'*999999,'1'),('0'*999998+'77','0')],maxInputBytes=1000001)

def prefix_oracle(a):return str(sum(a[i].startswith(a[j]) or a[j].startswith(a[i]) for i in range(len(a)) for j in range(i+1,len(a))))
add(65,'相同或互为前缀的单词对','统计不同下标的无序对i<j，使两个单词相同，或者一个是另一个的前缀。相同文字的不同下标仍分别计数。','第一行n，随后n个单词。源无字符与长度界，本站1≤n≤100000，单词只含小写英文字母，长度1..30。','按字典序排序。以每个词为较前者，所有以它开头的词形成连续区间，可二分word加字符{的插入位置作为区间右端；仅统计当前位置之后的词。','小写字母都小于{，所以以word为前缀的字符串恰好落在[word,word+{)之间。任意合法无序对在排序后较短词或相同词的一次查询中恰好出现一次，不合法对不会进入此前缀区间。','时间O(总字符数·log n)，空间O(总字符数+n)。',[['back','backdoor','gammon','backgammon','comeback','come','door'],['abc','a','a','b','ab','ac'],['x','x','x']],'样例1：back与backdoor、backgammon两对，come与comeback一对，共3。样例2：两个a相互1对，各自与abc、ab、ac组成6对，ab与abc另1对，共8。样例3：三个不同下标两两配对，共3。',lambda r:[''.join(r.choice('abc') for _ in range(r.randint(1,5))) for _ in range(r.randint(1,12))],lambda a:str(len(a))+'\n'+'\n'.join(a)+'\n',prefix_oracle,'''from bisect import bisect_left
def solve(d):
    words=sorted(d[1:]);answer=0
    for i,word in enumerate(words):answer+=bisect_left(words,word+'{')-i-1
    return str(answer)
''',[('同一单词自身也计数','-i-1','-i'),('只数相同词','bisect_left(words,word+\'{\')',"bisect_left(words,word+'a')")],[((['a'*30]*100000),'4999950000'),((['a'*(i%30+1) for i in range(100000)]),'4999950000')],maxInputBytes=3100008,timeLimit=6)

BLOCKED={41:'正文在return the output array in form where截断，仅示例不足以确定生成规则。',49:'核心森林条件在each tree i处截断，没有定义L及K对所求窗口的约束，不能凭与别题相似样例补题。',52:'正文使用|表示形状但例子使用*；更重要的是未说明多个不连通形状作为整体刚体还是独立下落，以及到底部指最低点还是所有块，答案会随规则改变。',55:'正文要求所有可能结果，但示例只列三个并承认为占位；未说明只做一次前缀/后缀反转还是允许任意片段及重复反转，不能据占位例唯一确定结果集合。',61:'题干缺失数组score的正式定义及取模要求，样例2区间[1,1]不含质数却选2，样例3对大范围只列一个选择，与样例1枚举所有组合矛盾。',62:'正文截断为Given an integer array nums and an，缺少k的定义及所求目标，只有一个“两最大值”样例，不能补写一般任务。'}
def prime_scores_oracle(rows):
    choices=[[p for p in range(left,right+1) if p>=2 and all(p%d for d in range(2,int(p**0.5)+1))] for left,right in rows];total=0
    for values in itertools.product(*choices):
        product=1
        for v in values:product*=v
        total+=product
    return str(total%1000000007)
def prime_scores_random(r):
    primes=[2,3,5,7,11,13,17,19];rows=[]
    for _ in range(r.randint(1,5)):
        p=r.choice(primes);rows.append((r.randint(max(1,p-3),p),r.randint(p,min(20,p+3))))
    return rows
add(61,'区间质数数组的乘积分数总和','每个位置i从闭区间[low[i],high[i]]任选一个质数，组成数组。数组分数是全部元素的乘积，求所有不同合法数组的分数总和，模10⁹+7。每个区间保证至少含一个质数。已从原始题面恢复被导入截断的范围和取模规则。','第一行n，随后n行low high；1≤n≤100000，1≤low≤high≤1000000，每区间至少有一个质数。','筛出所有质数并计算质数前缀和。每个区间的质数总和由前缀相减得到，将这些总和相乘取模。','展开各位置质数和的乘积，每个展开项恰好从每位置选一个质数，项值就是该数组分数；所有数组一一对应所有展开项。因此乘法分配律将枚举组合化为区间和的乘积。','时间O(M log log M+n)，空间O(M)，M为最大右端点。',[[(1,3),(3,5)],[(2,2),(2,2),(2,2)],[(1,4),(2,5),(3,30)]],'样例1：(2+3)×(3+5)=40。样例2：三个位置都只能选2，乘积8；原第二例[1,1]没有质数，不符合保证，已改成[2,2]。样例3：三个质数和为5、10、127，乘积6350，原输出30只计算了一个组合。',prime_scores_random,lambda rows:str(len(rows))+'\n'+''.join(f'{a} {b}\n' for a,b in rows),prime_scores_oracle,'''def solve(d):
    rows=[(int(d[i]),int(d[i+1])) for i in range(1,len(d),2)];limit=max(b for a,b in rows);sieve=bytearray(b'\\1')*(limit+1);sieve[0:2]=b'\\0\\0'
    for p in range(2,int(limit**0.5)+1):
        if sieve[p]:sieve[p*p:limit+1:p]=b'\\0'*((limit-p*p)//p+1)
    prefix=[0]*(limit+1)
    for p in range(1,limit+1):prefix[p]=prefix[p-1]+(p if sieve[p] else 0)
    result=1
    for left,right in rows:result=result*(prefix[right]-prefix[left-1])%1000000007
    return str(result)
''',[('把质数和误当质数数量','(p if sieve[p] else 0)','(1 if sieve[p] else 0)'),('左端错误排除','prefix[right]-prefix[left-1]','prefix[right]-prefix[left]')],[(([(999983,1000000)]*100000),str(pow(999983,100000,1000000007))),(([(2,2)]*100000),str(pow(2,100000,1000000007)))],maxInputBytes=1600008,timeLimit=6)
BLOCKED.pop(61)
BLOCKED[49]='原始HTML已恢复正文，但起点保证严格i<N−L会排除最后一个长度L窗口，且L=N时无合法起点。例如[1,100],K=1按通常全部窗口约束无正解，按原严格边界却L=1合法。不能擅自把<改≤或接受空起点集合。'
NOTES={44:'原例错误地让nums[2]=1跳2步，按明确质数步长及最大跳长规则纠正为0。',46:'操作编号作为本站输入协议明确，不改变三种几何变换本身。',47:'原第三例n=2但high=3越界，保留无可行非空组含义并改为合法[2,2]。',48:'原第二段矩阵少一行，补成两行00后答案仍0。',57:'任意顺序坐标由集合语义checker验真，不强制行优先；仅排除原始四角而非裁剪后四角。',58:'源第二例只做一轮仍有44，按正文“直到稳定”继续到1216328；前导0保留。',61:'原始e66f809 HTML恢复闭区间质数、乘积score和mod1e9+7；修复非法第二例及漏算第三例。'}
for spec in SPECS:
    if spec['id']==44:
        spec['mutants'][0]=('错误把1也视为质数',"primes=int.from_bytes(packed,'little')","primes=int.from_bytes(packed,'little')|2")
        spec['idea']='筛出小于n的质数并存成大整数位集。待处理位置使用相对当前下标的位集表示：截取不超过跳长的质数位并合入，随后右移跳过已处理位置；避免每次把整段质数左移到绝对下标。'
    if spec['id']==56:
        spec['input']=spec['input'].replace('10¹⁵','10⁹')
        spec['edges']=[(([10**9]*100000,[1]*100000,10**9),'10001000000000'),(([1]*100000,[10**9]*100000,10**9),'1'),(([10**9],[1],10**9),'1000000001000000000')]
    if spec['id']==58:spec['edges'][0]=('9'*2000,'180')
    if spec['id']==46:
        spec['code']='from itertools import islice\n'+spec['code'].replace('for token in d[2+n*n:]:','for token in islice(d,2+n*n,None):')
        spec['mutants'][1]=('倒序处理变换','for token in islice(d,2+n*n,None):','for token in reversed(d[2+n*n:]):')
def execute_many(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2500:]);return json.loads(p.stdout)
def matches(spec,value,actual,expected):
    if spec['id']==57:return region_valid(value,actual,expected)
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
        identifier=f"oa-uber-{spec['id']}";rng=random.Random(20261300+spec['id']);reader='sys.stdin.read().removesuffix("\\n")' if spec.get('raw') else 'sys.stdin.read().split()';code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)];oracles=[dict(input=spec['encode'](value),expectedOutput=spec['oracle'](value)+'\n') for value in values]
        formal=list(zip(values[:3],[c['expectedOutput'] for c in oracles[:3]]))+[(value,output+'\n') for value,output in spec['edges']]+list(zip(values[3:27],[c['expectedOutput'] for c in oracles[3:27]]));cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=spec['encode'](value),expectedOutput=output,hidden=i>=3,weight=1) for i,(value,output) in enumerate(formal)]
        for c in oracles+cases:assert len(c['input'].encode())<=spec['maxInputBytes'],(identifier,'input byte budget',len(c['input'].encode()))
        outputs=execute_many(path,[c['input'] for c in oracles+cases])
        for i,(value,case,actual) in enumerate(zip(values+[v for v,o in formal],oracles+cases,outputs)):assert matches(spec,value,actual,case['expectedOutput']),(identifier,i,case['expectedOutput'][:120],actual[:120])
        mutants=[];controls=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code,(identifier,old);changed=code.replace(old,new);negative=OUT/'negative-controls'/f'{identifier}-{index}.py';negative.write_text(changed);actuals=execute_many(negative,[c['input'] for c in cases]);rejected=[i for i,((value,expected),actual) in enumerate(zip(formal,actuals)) if not matches(spec,value,actual,expected)]
            assert rejected,(identifier,label,'survived');mutants.append(dict(name=label,code=changed));controls.append(dict(name=label,rejectedByCases=rejected))
        if spec['id']==57:
            positive_code=code.replace("return str(len(found))+'\\n'", "found.reverse();return str(len(found))+'\\n'")
            assert positive_code!=code
            (OUT/'positive-controls').mkdir(parents=True,exist_ok=True);positive=OUT/'positive-controls'/f'{identifier}.py';positive.write_text(positive_code)
            for value,case,actual in zip(values,oracles,execute_many(positive,[c['input'] for c in oracles])):assert matches(spec,value,actual,case['expectedOutput'])
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Uber'],description=spec['description']+'\n\n本站已明确标准输入输出；源未给出的范围均标明为本站协议。',input=spec['input'],output=spec.get('output','输出一个整数答案。'),explanation=spec['explanation'],hints=[spec['idea']],timeLimit=spec.get('timeLimit',4),memoryLimit=spec.get('memoryLimit',262144),outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        process=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert process.returncode==0,(identifier,process.stderr[:1500]);normalized=process.stdout;assert '\ufffd' not in normalized
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=spec['maxInputBytes'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(identifier,'163 independent checks;',len(cases)-3,'hidden; two normal-exit mutants rejected',flush=True)
    entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20261300,problems=reports,skipped={f'oa-uber-{k}':v for k,v in BLOCKED.items()},note='Local runpy batch execution, fresh __main__/streams per case, not per-case OS isolation; real sandbox required. Byte bounds assume canonical decimal syntax and documented input protocol.'),'reviews':dict(schemaVersion=1,items=[dict(id=f'oa-uber-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,NOTES.get(i,'正文明确，已编写独立参考和暴力对照、真实最大规模及两个正常退出错误程序。'))) for i in range(41,66)])}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
