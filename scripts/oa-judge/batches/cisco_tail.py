"""Cisco 19–33: 13 authored, 2 genuinely ambiguous; no upstream execution.
Only --small is intended for local use. Large fixtures are lazy, remote-only.
"""
from pathlib import Path
from collections import Counter,deque
from itertools import combinations,permutations
import heapq,hashlib,json,random,subprocess,sys,time,gc
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='cisco-tail';SEED=20261900;SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def matrix(a):return f'{len(a)} {len(a[0])}\n'+'\n'.join(seq(row) for row in a)+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def sum_oracle(a):return str(max(sum(a[i:j]) for i in range(len(a)) for j in range(i+1,len(a)+1)))
def sum_edges():
    yield [-10**9]*200000,str(-10**9)
    yield [10**9]*200000,str(2*10**14)
    yield [-10**9]+[1]*199998+[-10**9],'199998'
add(19,'非空连续片段的最大和','从整数数组中选择一个非空连续片段，输出元素和的最大值。全负数组也不能选择空片段。','先输入n，随后n个整数。原文未给数值界；本站公开补充1≤n≤200000，−10^9≤a[i]≤10^9。','维护以当前元素结尾的最优非空片段和，再维护所有结尾中的最大值。','以i结尾的片段或仅含a[i]，或由以i−1结尾的最优片段接上a[i]。这两类穷尽所有非空片段；首项初始化保证全负情况仍选非空片段。','时间O(n)，除输入存储外辅助空间O(1)，和使用64位整数。',[[2,-8,3,-2,4,-10],[-7,-2,-8],[0]],lambda r:[r.randint(-9,9) for _ in range(r.randint(1,10))],sum_edges,arr,sum_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:];ending=answer=a[0]
    for value in a[1:]:
        ending=max(value,ending+value);answer=max(answer,ending)
    return str(answer)
''',[('错误允许空片段','return str(answer)','return str(max(0,answer))'),('错误只看单个元素','return str(answer)','return str(max(a))')],2400020)

def spiral_oracle(a):
    n=len(a);m=len(a[0]);seen=set();r=c=direction=0;directions=((1,0),(0,1),(-1,0),(0,-1));path=[]
    for _ in range(n*m):
        seen.add((r,c));path.append(a[r][c]);dr,dc=directions[direction];nr,nc=r+dr,c+dc
        if not(0<=nr<n and 0<=nc<m) or (nr,nc) in seen:
            direction=(direction+1)%4;dr,dc=directions[direction];nr,nc=r+dr,c+dc
        r,c=nr,nc
    return str(path[(len(path)-1)//2*2])
def spiral_edges():
    yield [[i*1000+j for j in range(1000)] for i in range(1000)],'500500'
    yield [[i*999+j for j in range(999)] for i in range(999)],'499000'
    yield [[-10**9]*1000 for _ in range(1000)],str(-10**9)
    yield [list(range(1000))],'998'
    yield [[i] for i in range(1000)],'998'
add(20,'逆时针螺旋隔格跳跃的最后落点','从左上角开始，按向下、向右、向上、向左的逆时针单位格螺旋依次遍历矩阵。起点落地，之后隔过一个路径格再落地；转弯时也连续计数，不重置奇偶。输出最后落地格子的值。','输入N M及N行每行M个整数。原文N/M行列措辞有笔误，本站明确N行M列；原无数值界，补充1≤N,M≤1000、元素−10^9..10^9。','按四条边依次收缩边界，给访问的格子一个全局从0开始的序号；仅偶数序号更新答案。','每轮恰遍历当前外圈且各格只出现一次，删除外圈后的矩形继续遵循同一螺旋方向。单行、单列条件避免重复；全局偶数序号恰对应题意的每隔一个格子落地。最后更新值因此就是最终落点。','时间O(NM)，除矩阵输入外辅助空间O(1)。',[[[29,8,37],[15,41,3],[1,10,14]],[[1,2],[3,4]],[[9,8,7,6]]],lambda r:[[r.randint(-9,9) for _ in range(m)] for _ in range(n)] if (n:=r.randint(1,6)) and (m:=r.randint(1,6)) else None,spiral_edges,matrix,spiral_oracle,
'''def solve(raw):
    values=list(map(int,raw.split()));n,m=values[:2];a=values[2:];top=left=0;bottom=n-1;right=m-1;index=0;answer=a[0]
    def visit(r,c):
        nonlocal index,answer
        if index%2==0:answer=a[r*m+c]
        index+=1
    while top<=bottom and left<=right:
        for r in range(top,bottom+1):visit(r,left)
        left+=1
        for c in range(left,right+1):visit(bottom,c)
        bottom-=1
        if left<=right:
            for r in range(bottom,top-1,-1):visit(r,right)
            right-=1
        if top<=bottom:
            for c in range(right,left-1,-1):visit(top,c)
            top+=1
    return str(answer)
''',[('错误每格都落地','if index%2==0:','if True:'),('错误落在奇数编号路径格','if index%2==0:','if index%2==1:')],12000020)

def pal_oracle(s,minimum=2):
    valid=[s[i:j] for i in range(len(s)) for j in range(i+minimum,len(s)+1) if s[i:j]==s[i:j][::-1]]
    return min(valid,key=lambda x:(-len(x),x)) if valid else 'None'
PAL_CODE='''def solve(raw):
    s=raw.strip();answer=''
    for middle in range(2*len(s)-1):
        left=middle//2;right=left+middle%2
        while left>=0 and right<len(s) and s[left]==s[right]:left-=1;right+=1
        candidate=s[left+1:right]
        if len(candidate)>=MINIMUM and (len(candidate)>len(answer) or len(candidate)==len(answer) and candidate<answer):answer=candidate
    return answer or 'None'
'''
def pal_edges():
    yield 'A'*1000,'A'*1000
    yield 'AB'*500,('AB'*500)[:-1]
    yield ('ABC'*334)[:1000],'None'
add(21,'至少两个字符的最长回文及字典序选择','字符串仅含大写英文字母。寻找长度至少2的最长连续回文子串；若有多个最长结果，输出字典序最小的字符串；不存在则输出None。','一行大写字母字符串。原文没有长度界，本站补充1≤长度≤1000。','枚举奇偶两类回文中心，扩展到不能继续，仅比较该中心的最长候选。','每个回文有唯一中心。非最长的同中心回文不可能优于该中心最长者，因此只比较各中心的最长候选不会遗漏全局最优；长度相同时显式取字典序较小者。','时间O(n²)，候选切片最多O(n)辅助空间。',['YABCCBAZ','ABC','ZZXAA'],lambda r:''.join(r.choice('ABCD') for _ in range(r.randint(1,12))),pal_edges,lambda s:s+'\n',pal_oracle,PAL_CODE.replace('MINIMUM','2'),[('错误允许单字符','len(candidate)>=2','len(candidate)>=1'),('并列错误选字典序大者','candidate<answer','candidate>answer')],1001,output='输出所选回文字符串或None。')

def diff_oracle(a):return str(max([0]+[a[j]-a[i] for i in range(len(a)) for j in range(i+1,len(a))]))
def diff_edges():
    yield [-10**9]+[0]*199998+[10**9],str(2*10**9)
    yield list(range(200000,0,-1)),'0'
    yield [10**9]*200000,'0'
add(22,'较晚元素减较早元素的最大正差','在i<j且a[j]>a[i]的元素对中求a[j]−a[i]最大值；没有合法对则输出0。','输入n以及n个整数。原无数值界，本站补充0≤n≤200000，元素−10^9..10^9，空数组也输出0。','从左到右维护此前最小值，每个元素只与此前最小值尝试配对。','固定右端j时，最小左端元素产生最大的差。遍历所有右端覆盖所有可能最优对；答案从0开始，使没有严格正差时按约定输出0。','时间O(n)，除输入外辅助空间O(1)。',[[7,1,5,3,6,4],[9,7,4],[]],lambda r:[r.randint(-9,9) for _ in range(r.randint(0,10))],diff_edges,arr,diff_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:];lowest=None;answer=0
    for value in a:
        if lowest is not None:answer=max(answer,value-lowest)
        lowest=value if lowest is None else min(lowest,value)
    return str(answer)
''',[('忽略先后顺序','return str(answer)','return str(max(a)-min(a) if a else 0)'),('只比较相邻元素','min(lowest,value)','value')],2400020)

def points_encode(p):return str(len(p))+'\n'+seq(x for x,y in p)+'\n'+seq(y for x,y in p)+'\n'
def points_oracle(p):
    best=max(max(sum(x==a for a,b in p),sum(y==b for a,b in p)) for x,y in p)
    return str(best if best>=2 else 0)
def points_edges():
    yield [(10**9,i) for i in range(700)],'700'
    yield [(i,i) for i in range(700)],'0'
    yield [(-10**9,10**9)]*700,'700'
    yield [(i,-10**9) for i in range(700)],'700'
add(23,'一条水平或竖直航线覆盖的最多投放点','选择一条水平或竖直直线，不能混合方向或选择斜线；要求覆盖至少两个输入点，输出最多覆盖数，做不到则输出0。重复坐标按输入记录的数量计数。','输入n，再输入n个横坐标与n个纵坐标。恢复完整补充raw中的原界2≤n≤700；坐标无原数值界，本站补充−10^9..10^9。截断主raw以完整同题raw恢复；斜线样例5的另一版本与其自身规则冲突，不采纳。','分别统计每个横坐标和纵坐标出现次数，取最大值，并处理至少两个点的条件。','竖线完全由固定横坐标确定，横线完全由固定纵坐标确定；两组频数恰遍历所有可能航线覆盖的记录数。','时间O(n)，空间O(n)。',[[(2,2),(3,2),(2,6),(4,5),(2,8)],[(1,1),(2,2)],[(1,2),(3,2)]],lambda r:[(r.randint(-3,3),r.randint(-3,3)) for _ in range(r.randint(2,10))],points_edges,points_encode,points_oracle,
'''def solve(raw):
    from collections import Counter
    values=list(map(int,raw.split()));n=values[0];x=values[1:1+n];y=values[1+n:];best=max(max(Counter(x).values()),max(Counter(y).values()))
    return str(best if best>=2 else 0)
''',[('遗漏水平线','max(max(Counter(x).values()),max(Counter(y).values()))','max(Counter(x).values())'),('错误允许单点航线','best if best>=2 else 0','best')],16820)

def machines_encode(v):
    a,b,c=v;return str(len(a))+'\n'+seq(a)+'\n'+seq(b)+'\n'+str(c)+'\n'
def machines_oracle(v):
    # Direct positive-count state Dijkstra: neither subset sums nor assignments.
    a,target,shift=v;initial=tuple(sorted(a));target=sorted(target)
    upper=min(sum(abs(a[i]-b) for i,b in zip(ids,target)) for ids in permutations(range(len(a)),3))
    def goal(state):
        remaining=list(state)
        for value in target:
            if value not in remaining:return False
            remaining.remove(value)
        return True
    queue=[(0,initial)];distance={initial:0}
    while queue:
        cost,state=heapq.heappop(queue)
        if cost!=distance[state]:continue
        if goal(state):return str(cost)
        moves=[]
        for i,value in enumerate(state):
            for delta in (-1,1):
                if value+delta>0:moves.append((1,tuple(sorted(state[:i]+(value+delta,)+state[i+1:]))))
        if len(state)>3:
            for i in range(len(state)):
                for j in range(i+1,len(state)):
                    moves.append((shift,tuple(sorted(tuple(state[k] for k in range(len(state)) if k not in (i,j))+(state[i]+state[j],)))))
        for weight,nxt in moves:
            nc=cost+weight
            if nc<=upper and nc<distance.get(nxt,upper+1):distance[nxt]=nc;heapq.heappush(queue,(nc,nxt))
    raise AssertionError('positive adjustment witness must be reachable')
def machines_edges():
    yield ([10**6]*10,[1,1,1],10**6),'2999997'
    yield ([1]*10,[10**6]*3,0),'2999990'
    yield ([100000]*10,[300000,300000,400000],1),'7'
    yield ([1]*10,[10**6]*3,10**6),'2999997'
    yield ([10**6]*10,[10**6]*3,10**6),'0'
add(24,'通过增减与整区迁移匹配三个区域','每个区域有正数机器。增加或减少一台成本1，但区域不能减到0；将一个区域全部机器迁到另一区域成本c，源区域消失。最终只需有三个区域的机器数与三个目标一一对应，其他区域可以保留。求最小成本。原样例2输出2是笔误，其步骤和完整补充来源均得到5。','输入n、n个初始数量、3个目标数量、迁移成本c。保留主raw完整原界3≤n≤10、初始和目标1..10^6。原c未给范围，本站补充0≤c≤10^6。辅助raw仅佐证样例5，不将其不同n界混入本题。','枚举每个初始区域属于目标组0/1/2或不使用。三个目标组非空，组成本为(区域数−1)c+|机器总和−目标|。递归只维护三个和及计数。','任一最终选中区域由若干原区域合并而来，三个来源组互不相交且非空。组内至少合并k−1次，净增减至少为总量与目标的绝对差。反过来先合并各组再增减至正目标，恰好达到该下界，且不影响未选区域；枚举因此包含且实现最优操作方案。','时间O(4^n)，递归辅助空间O(n)，不保留所有分组。', [([2,4,5,3],[4,4,4],5),([2,3,5,7],[5,10,5],2),([1,1,1],[1,1,1],0)],lambda r:([r.randint(1,4) for _ in range(r.randint(3,5))],[r.randint(1,5) for _ in range(3)],r.randint(0,3)),machines_edges,machines_encode,machines_oracle,
'''def solve(raw):
    values=list(map(int,raw.split()));n=values[0];a=values[1:n+1];target=values[n+1:n+4];shift=values[-1];totals=[0]*3;counts=[0]*3;answer=10**30
    def search(i):
        nonlocal answer
        if sum(k==0 for k in counts)>n-i:return
        if i==n:
            if all(counts):answer=min(answer,sum((counts[g]-1)*shift+abs(totals[g]-target[g]) for g in range(3)))
            return
        search(i+1)
        for g in range(3):
            totals[g]+=a[i];counts[g]+=1;search(i+1);counts[g]-=1;totals[g]-=a[i]
    search(0);return str(answer)
''',[('强制所有区域都被使用','        search(i+1)\n','        pass\n'),('错误额外收取每组一次迁移费','(counts[g]-1)*shift','counts[g]*shift')],130,timeLimit=10)

def saddle_oracle(a):
    candidates=[a[i][j] for i in range(len(a)) for j in range(len(a[0])) if all(a[i][j]>=v for v in a[i]) and all(a[i][j]<=row[j] for row in a)]
    return str(candidates[0] if candidates else -1)
def saddle_edges():
    yield [[10**9]*1000 for _ in range(1000)],str(10**9)
    yield [[(i+j)%2 for j in range(1000)] for i in range(1000)],'-1'
    yield [[1]*1000]+[[0]*999+[1] for _ in range(999)],'1'
add(25,'矩阵中同行最大且同列最小的数','寻找一个元素，允许并列地大于等于同行所有元素，且小于等于同列所有元素；存在则输出其值，否则−1。多个合法位置的值必相同。','输入N M，随后N行每行M个整数。保留原界1≤N,M≤1000及非负整数；原元素上界缺失，本站补充0..10^9。','逐行扫描维护行最大值的最小值R和各列最小值；最终令C为列最小值的最大值，R=C时输出共同值。','每个列最小值不大于每个行最大值，因此C≤R。鞍点存在时其行最大值和列最小值夹在R与C之间，迫使两者相等；反过来取达到R的行和达到C的列，交点夹在同一个值之间，便是合法鞍点。','时间O(NM)，流式解析额外空间O(M)，不会因一行重复最大值漏解。',[[[3,4,5],[1,2,6]],[[1,1],[0,1]],[[0,1],[1,0]]],lambda r:[[r.randint(0,5) for _ in range(m)] for _ in range(n)] if (n:=r.randint(1,5)) and (m:=r.randint(1,5)) else None,saddle_edges,matrix,saddle_oracle,
'''def solve(raw):
    import re
    values=(int(m.group()) for m in re.finditer(r'-?\\d+',raw));n=next(values);m=next(values);columns=[10**30]*m;row_bound=10**30
    for _ in range(n):
        largest=0
        for j in range(m):
            value=next(values);largest=max(largest,value);columns[j]=min(columns[j],value)
        row_bound=min(row_bound,largest)
    candidate=max(columns)
    return str(candidate if candidate==row_bound else -1)
''',[('将列最小值取最小而非最大','candidate=max(columns)','candidate=min(columns)'),('不检查行列兼容性','candidate if candidate==row_bound else -1','candidate')],11000020)

def grid_encode(v):return json.dumps(v,ensure_ascii=True,separators=(',',':'))+'\n'
def grid_oracle(v):
    a,words=v;n=len(a);m=len(a[0]);answer=[]
    for word in words:
        found=False
        for i in range(n):
            for j in range(m):
                for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
                    if all(0<=i+k*di<n and 0<=j+k*dj<m and a[i+k*di][j+k*dj]==ch for k,ch in enumerate(word)):found=True
        answer.append('Yes' if found else 'No')
    return ' '.join(answer)
def grid_random(r):
    n=r.randint(1,5);m=r.randint(1,5);alphabet='aA b\x00\u2028😀';a=[''.join(r.choice(alphabet) for _ in range(m)) for _ in range(n)]
    words=[''.join(r.choice(alphabet) for _ in range(r.randint(1,6))) for _ in range(r.randint(0,7))]
    if r.randrange(2):words.append(a[r.randrange(n)][::-1])
    return a,words
def grid_edges():
    yield (['😀'*200]*200,['😀'*k for k in range(1,201)]),' '.join(['Yes']*200)
    yield (['😀'*200]*200,['😀'*200]*200),' '.join(['Yes']*200)
    yield (['a'*200]*200,['b'*200]*200),' '.join(['No']*200)
    yield (['a'*200]*200,['a'*(k-1)+'b' for k in range(1,201)]),' '.join(['No']*200)
    yield (['a'*200]*200,[]),''
    yield (['a\x00\u0085\u2028\u2029😀'],['😀\u2029\u2028\u0085\x00a','A','\x00']),'Yes No Yes'
add(26,'沿一行或一列寻找给定单词','对每个单词分别判断它能否作为网格中某一行或某一列的连续片段出现，可以正向或反向。不能拐弯或斜走，区分大小写。','输入一个JSON数组[gridRows,words]。原无数值界，本站补充1≤行数、列数≤200，所有行按Unicode码点等长；0≤单词数≤200，每词1..200码点，总词长≤40000。字符为任意Unicode标量值，含空白、NUL和非BMP；不允许孤立代理项。JSON总UTF-8字节≤1000000，生成器使用ASCII转义以完整承载控制字符。','预先建立所有行、列及它们的反向字符串。每个单词构建KMP前缀表，在这些字符串上逐一寻找；同词重复查询缓存结果。','所有合法方向恰对应行、列及反向四类，且每条搜索线的连续匹配恰是题意中的不拐弯片段。KMP只跳过已证明不可能成为匹配起点的位置，不改变匹配存在性。','时间O(KNM+所有词长)，空间O(NM+所有词长)。', [(['abc','def'],['cba','ad','ae']),(['A a'],['A','a',' ']),(['😀\x00'],[])],grid_random,grid_edges,grid_encode,grid_oracle,
'''def solve(raw):
    import json
    rows,words=json.loads(raw);columns=[''.join(row[j] for row in rows) for j in range(len(rows[0]))];lines=rows+columns;lines=lines+[line[::-1] for line in lines];cache={}
    def contains(line,word,pi):
        matched=0
        for ch in line:
            while matched and ch!=word[matched]:matched=pi[matched-1]
            if ch==word[matched]:matched+=1
            if matched==len(word):return True
        return False
    output=[]
    for word in words:
        if word not in cache:
            pi=[0]*len(word)
            for i in range(1,len(word)):
                k=pi[i-1]
                while k and word[i]!=word[k]:k=pi[k-1]
                if word[i]==word[k]:k+=1
                pi[i]=k
            cache[word]=any(contains(line,word,pi) for line in lines)
        output.append('Yes' if cache[word] else 'No')
    return ' '.join(output)
''',[('遗漏反向搜索','lines=lines+[line[::-1] for line in lines]','lines=lines'),('错误忽略大小写','rows,words=json.loads(raw);','rows,words=json.loads(raw);rows=[s.lower() for s in rows];words=[s.lower() for s in words];')],1000000,timeLimit=10,output='按查询顺序输出Yes或No，以空格或换行分隔；没有查询则输出空行。')

def servers_encode(v):
    thresholds,edges=v;return str(len(thresholds))+'\n'+seq(thresholds)+'\n'+''.join(f'{u+1} {w+1} {cost}\n' for u,w,cost in edges)
def servers_oracle(v):
    thresholds,edges=v;n=len(thresholds);adj=[[] for _ in range(n)]
    for u,w,c in edges:adj[u].append((w,c));adj[w].append((u,c))
    parent=[-1]*n;weight=[0]*n;order=[0]
    for u in order:
        for w,c in adj[u]:
            if w!=parent[u]:parent[w]=u;weight[w]=c;order.append(w)
    best=n
    for mask in range(1<<n):
        if not(mask&1):continue
        valid=True
        for u in range(1,n):
            if not(mask>>u&1):continue
            if not(mask>>parent[u]&1):valid=False;break
            x=u;distance=0
            while parent[x]!=-1:
                distance+=weight[x]
                if distance>thresholds[u]:valid=False;break
                x=parent[x]
            if not valid:break
        if valid:best=min(best,n-mask.bit_count())
    return str(best)
def servers_random(r):
    n=r.randint(3,9);return [r.randint(-8,8) for _ in range(n)],[(r.randrange(i),i,r.randint(-7,7)) for i in range(1,n)]
def servers_edges():
    n=200000
    yield ([0]*n,[(i-1,i,0) for i in range(1,n)]),'0'
    yield ([10**9]*n,[(i-1,i,10**9) for i in range(1,n)]),str(n-2)
    yield ([-10**9]*n,[(i-1,i,-10**9) for i in range(1,n)]),'0'
    yield ([0]*n,[(0,1,1)]+[(i-1,i,-10**9) for i in range(2,n)]),str(n-1)
    yield ([-10**9]*n,[(0,i,10**9) for i in range(1,n)]),str(n-1)
add(27,'删除叶子使所有保留服务器满足祖先限制','服务器组成以1为根的树，边权可负。非根服务器v若到某个严格祖先的路径权值和大于threshold[v]，则不安全。每次只能删除一个非根叶子；求至少删除多少个服务器，使所有保留节点安全。根没有严格祖先，不能删除。','输入n、n个threshold，随后n−1行u v weight。保留完整原界3≤n≤200000，节点1..n，边权和threshold均为−10^9..10^9。输入保证是树。来源第二例含环、缺边权且节点孤立，不用于样例。','遍历时维护根路径和D及严格祖先的最小根路径和M。v安全当且仅当D[v]−M≤threshold[v]。节点不安全或父节点已确定删除，则其整个子树必须删除；迭代遍历同时计数。','到严格祖先u的路径和为D[v]−D[u]，其最大值为D[v]−M。保留任一节点必须保留所有祖先，故不安全节点以及全部后代不得保留。删去这些子树可由叶到根完成，剩余各点恰满足判定，因此删除数既必要又可实现。负边和负threshold原样参与比较，不截断到0。','时间O(n)，空间O(n)。邻接表使用紧凑数组、词法流式解析，不递归，路径和使用64位或任意精度整数。', [([0,-10,5,-5,5],[(0,1,-2),(0,2,5),(2,3,-5),(2,4,-3)]),([-1,-1,-1],[(0,1,-5),(1,2,-5)]),([0,0,0],[(0,1,2),(1,2,-10)])],servers_random,servers_edges,servers_encode,servers_oracle,
'''def solve(raw):
    import re
    from array import array
    values=(int(m.group()) for m in re.finditer(r'-?\\d+',raw));n=next(values);threshold=array('i',(next(values) for _ in range(n)));head=array('i',[-1])*n;to=array('I');weight=array('i');following=array('i')
    def edge(u,v,w):
        to.append(v);weight.append(w);following.append(head[u]);head[u]=len(to)-1
    for _ in range(n-1):
        u=next(values)-1;v=next(values)-1;w=next(values);edge(u,v,w);edge(v,u,w)
    answer=0;stack=[(0,-1,0,0,False)]
    while stack:
        u,parent,distance,minimum,removed=stack.pop()
        removed=removed or (u!=0 and distance-minimum>threshold[u])
        answer+=removed;minimum=min(minimum,distance);e=head[u]
        while e!=-1:
            v=to[e]
            if v!=parent:stack.append((v,u,distance+weight[e],minimum,removed))
            e=following[e]
    return str(answer)
''',[('遗漏不安全祖先导致的整棵子树删除','removed=removed or (u!=0','removed=False or (u!=0'),('错误禁止负限制并截断为0','distance-minimum>threshold[u]','distance-minimum>max(0,threshold[u])')],8000020,timeLimit=10)

def any_pal_oracle(s):return pal_oracle(s,1)
def any_pal_edges():
    yield 'a'*1000,'a'*1000
    yield 'aB'*500,('aB'*500)[:-1]
    yield ('abc'*334)[:1000],'a'
    yield '123454321','123454321'
add(29,'返回任意一个最长回文连续子串','返回原字符串中长度最大的回文连续子串。若存在多个最长答案，任选一个，不能额外要求字典序最小或最早出现；单字符也是回文。','输入一行ASCII英文字母或数字构成的字符串s。保留原界1≤|s|≤1000，区分大小写。','枚举奇偶中心并向两边扩展。每个中心保留能达到的最长子串，最终输出长度最大的一个。参考程序的内部并列选择不属于输出要求，语义checker接受所有最优结果。','任一回文有一个奇数或偶数中心。枚举并最大扩展所有中心必覆盖全局最长回文；返回的候选属于原串且左右字符逐对相等，因而合法且最优。','时间O(n²)，候选字符串辅助空间O(n)。',['babad','cbbd','7'],lambda r:''.join(r.choice('abAB019') for _ in range(r.randint(1,12))),any_pal_edges,lambda s:s+'\n',any_pal_oracle,PAL_CODE.replace('MINIMUM','1'),[('错误始终只返回单字符',"return answer or 'None'","return s[0]"),('错误把原串整体当回文',"return answer or 'None'","return s")],1001,checker='oa-longest-palindrome',output='输出任意一个最长回文子串，可以带一个终结换行；不得输出引号或说明文字。')

def chocolate_oracle(a):
    return str(max(sum(a[i] for i in range(len(a)) if mask>>i&1) for mask in range(1<<len(a)) if not(mask&(mask<<1))))
def chocolate_edges():
    yield [10**9]*1000,str(500*10**9)
    yield [0]*1000,'0'
    yield [10**9]+[0]*998+[10**9],str(2*10**9)
add(30,'不取相邻罐子的最多巧克力','每个罐子有非负整数颗巧克力，从一排罐子中取若干罐，不能取相邻两罐，求最多颗数。可以不取任何罐子。','先输入n，再输入n个非负数量。保留原界1≤n≤1000。原值上界缺失，本站补充0..10^9；不采用catalog中无来源的10000上限。','滚动维护前i−2罐与前i−1罐的最优值；当前罐可不取，或加上前i−2罐最优值。','最优方案是否取最后一罐形成互斥且穷尽的两类：不取时等于前一位置最优；取时前一罐不能取，故可与前两位置最优相加。归纳得全局最优。','时间O(n)，除输入外辅助空间O(1)，最大答案5×10^11。',[[5,1,1,5],[1],[0,0,0]],lambda r:[r.randint(0,15) for _ in range(r.randint(1,12))],chocolate_edges,arr,chocolate_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:];older=previous=0
    for value in a:older,previous=previous,max(previous,older+value)
    return str(previous)
''',[('错误允许相邻罐子','older+value','previous+value'),('错误只取一罐','return str(previous)','return str(max(a))')],11020)

def filter_encode(v):a,x=v;return f'{len(a)} {x}\n'+seq(a)+'\n'
def filter_oracle(v):
    a,x=v;head=None
    for value in reversed(a):head=[value,head]
    dummy=[None,head];previous=dummy
    while previous[1] is not None:
        if previous[1][0]>x:previous[1]=previous[1][1]
        else:previous=previous[1]
    answer=[];node=dummy[1]
    while node is not None:answer.append(node[0]);node=node[1]
    return seq(answer)
def filter_edges():
    yield ([100000]*100000,100000),seq([100000]*100000)
    yield ([100000]*100000,1),''
    yield ([1,100000]*50000,1),seq([1]*50000)
add(31,'删除链表中大于阈值的节点','按原顺序给出单链表节点值，删除所有值大于x的节点，输出剩余节点，顺序不得改变；等于x的节点保留。','输入n x，随后n个节点值。保留原界1≤n≤100000，1≤x≤100000，节点值1..100000。','顺序读取每个节点，仅输出值不超过x的节点；在链表实现中等价于将被删节点的前驱指向其后继。','每个值大于x的节点恰被跳过，其余节点恰输出一次；从头到尾顺序不变，因此正是删除目标节点后的链表。','时间O(n)，输出缓冲O(n)。', [([1,5,3,4],3),([5,5],5),([2,3],1)],lambda r:([r.randint(1,15) for _ in range(r.randint(1,12))],r.randint(1,15)),filter_edges,filter_encode,filter_oracle,
'''def solve(raw):
    values=list(map(int,raw.split()));n,x=values[:2];kept=[v for v in values[2:] if v<=x]
    return ' '.join(map(str,kept))
''',[('错误删除等于阈值的节点','v<=x','v<x'),('错误排序破坏原链表顺序','map(str,kept)','map(str,sorted(kept))')],700020,output='按原顺序输出剩余节点值，以空格分隔；全被删除时输出空行，不输出节点个数。')

def rotate_oracle(a):
    n=len(a);result=[[None]*n for _ in range(n)]
    for row in range(n):
        for col in range(n):result[col][n-1-row]=a[row][col]
    return '\n'.join(seq(row) for row in result)
def rotate_edges():
    yield [[-10**9]*1000 for _ in range(1000)],'\n'.join([seq([-10**9]*1000)]*1000)
    yield [[10**9]*1000 for _ in range(1000)],'\n'.join([seq([10**9]*1000)]*1000)
    yield [[i]*1000 for i in range(1000)],'\n'.join([seq(range(999,-1,-1))]*1000)
add(32,'方阵顺时针旋转九十度','将给定方阵顺时针旋转90度，输出旋转后的矩阵；方向由原样例确定，不能转为逆时针。','输入N M，要求N=M，随后N行每行M个整数。原界只有方阵要求，没有数值界；本站公开补充1≤N=M≤1000、元素−10^9..10^9。','新矩阵的第c行，就是原矩阵第c列从下到上。紧凑存储原矩阵，逐行生成输出。','旋转将原坐标(r,c)映射到(c,N−1−r)，因此固定新行c并按新列递增，恰等价于原行从N−1递减到0。该坐标映射是一一对应，输出每个元素一次且位置正确。','时间O(N²)，输入及输出存储O(N²)；最坏输出12000000字节，输出上限16MiB。',[[[1,2],[3,4]],[[7]],[[1,2,3],[4,5,6],[7,8,9]]],lambda r:[[r.randint(-9,9) for _ in range(n)] for _ in range(n)] if (n:=r.randint(1,6)) else None,rotate_edges,matrix,rotate_oracle,
'''def solve(raw):
    import re
    from array import array
    values=(int(m.group()) for m in re.finditer(r'-?\\d+',raw));n=next(values);m=next(values);a=array('i',values)
    return '\\n'.join(' '.join(str(a[r*n+c]) for r in range(n-1,-1,-1)) for c in range(n))
''',[('仅转置没有旋转','range(n-1,-1,-1)','range(n)'),('错误旋转半圈','a[r*n+c]','a[(n-1-c)*n+r]')],12000020,outputLimit=16384,output='输出旋转后的N行矩阵，每行N个以空格分隔的整数，不重复输出维度。')

BLOCKED={28:'频数为3/4/5时non-twin究竟指单次、奇数次或非2次没有定义，不能额外限制频数仅1/2。',33:'缺少每次倾倒是最大可能量还是任意整数的核心规则；正数Fi/Si与零样例矛盾，原容量≤500不能改成100硬接。'}
def fast(name):return 'fastprep/Cisco/cisco-'+name+'.md'
EVIDENCE={19:[fast('find-largest-sum-contiguous-subarray'),fast('find-largest-sum-of-continuous-sequence')],20:[fast('find-last-cell')],21:[fast('find-longest-palindromic-substring')],22:[fast('find-maximum-difference')],23:[fast('find-maximum-number-drop-points-connected'),fast('find-maximum-number-of-drop-points-covered'),fast('maximum-drop-points-cover')],24:[fast('find-minimum-cost-to-shift-machines'),fast('get-minimum-cost')],25:[fast('find-number'),'OA LIST/Cisco_OA/004_image.txt'],26:[fast('find-words-in-grid')],27:[fast('get-min-servers')],28:[fast('identify-the-non-twin-person')],29:[fast('longest-palindromic-substring')],30:[fast('maximum-chocolates-from-jars'),'OA LIST/Cisco_OA/003_image.txt'],31:[fast('remove-nodes')],32:[fast('rotate-matrix')],33:[fast('water-jug-problem')]}
def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(a,b):
    if a==b:return True
    # Compare large matrix answers without millions of split token objects.
    import re
    from itertools import zip_longest
    return all(x==y for x,y in zip_longest((m.group() for m in re.finditer(r'\S+',a)),(m.group() for m in re.finditer(r'\S+',b))))
SMALL_RUNNER="""import io,json,sys,contextlib
code,inputs=json.load(sys.stdin);out=[]
for raw in inputs:
    sys.stdin=io.StringIO(raw);buf=io.StringIO()
    with contextlib.redirect_stdout(buf):exec(compile(code,'<authored>','exec'),{'__name__':'__main__'})
    out.append(buf.getvalue())
print(json.dumps(out,ensure_ascii=False))
"""
def accepted(s,raw,actual,expected):
    if s.get('checker')!='oa-longest-palindrome':return equal(actual,expected)
    # Independent specification predicate: no chosen tie-break requirement.
    source=raw.rstrip('\r\n')
    answer=actual[:-2] if actual.endswith('\r\n') else actual[:-1] if actual.endswith('\n') else actual
    optimum=len(expected.rstrip('\r\n'))
    return bool(answer) and answer in source and answer==answer[::-1] and len(answer)==optimum
def small_check():
    for s in sorted(SPECS,key=lambda s:s['n']):
        rng=random.Random(SEED+s['n']);values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        cases=[(s['encode'](v),s['oracle'](v)+'\n') for v in values];code=code_for(s)
        def run(program):
            p=subprocess.run([sys.executable,'-I','-c',SMALL_RUNNER],input=json.dumps([program,[raw for raw,_ in cases]],ensure_ascii=False),text=True,capture_output=True,timeout=120)
            assert p.returncode==0,(s['n'],p.stderr[-2000:]);return json.loads(p.stdout)
        actual=run(code)
        for i,(a,(_,expected)) in enumerate(zip(actual,cases)):assert accepted(s,cases[i][0],a,expected),(s['n'],i,a,expected)
        for name,old,new in s['mutants']:
            assert old in code,(s['n'],name)
            assert any(not accepted(s,raw,a,expected) for a,(raw,expected) in zip(run(code.replace(old,new)),cases)),(s['n'],name)
        print(s['n'],len(cases),'independent small/regression cases; 2 normal-exit WA; real stdin/stdout passed',flush=True)
def execute(path,inputs):
    begin=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(inputs)
    return out,time.monotonic()-begin
def main():
    if '--small' in sys.argv:small_check();return
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in sorted(SPECS,key=lambda s:s['n']):
        number=s['n'];ident=f'oa-cisco-{number}'
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(SEED+number)
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=s['oracle'](v)+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=a+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:31];assert len(tests)>=31
        for c in oracles+tests:
            assert len(c['input'].encode())<=s['bound']<=32*1024*1024,(ident,len(c['input'].encode()),s['bound'])
            assert len(c['expectedOutput'].encode())<=s.get('outputLimit',4096)*1024
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert accepted(s,c['input'],a,c['expectedOutput']),(ident,i,a[:200],c['expectedOutput'][:200])
        del actual
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not accepted(s,c['input'],a,c['expectedOutput'])];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected));del outputs
        explanation='三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') or '空文本' for c in oracles[:3])+'。独立枚举或直接模拟已核对。'
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Cisco'],description=s['desc']+'\n\n缺失范围的本站补充与来源笔误恢复见输入协议。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        assert len(normalized.encode())<=128*1024*1024,(ident,'package exceeds128MiB')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracles;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del cases,tests,boundary,oracles,normalized,p,doc,c;gc.collect()
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,paths in EVIDENCE.items():
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=f'oa-cisco-{number}';reason=BLOCKED[number] if number in BLOCKED else next(s['desc']+' '+s['limits'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
