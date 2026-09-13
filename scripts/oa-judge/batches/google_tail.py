"""Google tail: independently authored algorithms; never execute imported solutions."""
import collections
import functools
import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'
BATCH='google-tail'
SEED=20261011
IDS=[11,12,15,17]+list(range(61,80))
SPECS=[]

def add(number,title,description,limits,idea,proof,complexity,samples,explanation,random_case,edges,encode,oracle,code,mutants,**extra):
    SPECS.append(dict(id=number,title=title,description=description,input=limits,idea=idea,proof=proof,complexity=complexity,samples=samples,explanation=explanation,random=random_case,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,**extra))
def array(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def grid(g):return f'{len(g)} {len(g[0])}\n'+'\n'.join(g)+'\n'
def cover_oracle(x):
    targets,satellites=x;best=len(satellites)+1
    for mask in range(1<<len(satellites)):
        if mask.bit_count()>=best:continue
        chosen=[s for i,s in enumerate(satellites) if mask>>i&1];good=True
        for a,b in targets:
            cuts=sorted({a,b}|{z for s in chosen for z in s if a<z<b})
            for left,right in zip(cuts,cuts[1:]):
                if not any(2*p<=left+right<=2*q for p,q in chosen):good=False;break
            if not good:break
        if good:best=mask.bit_count()
    return str(best if best<=len(satellites) else -1)
def cover_random(r):
    interval=lambda:sorted(r.sample(range(-5,8),2))
    return ([interval() for _ in range(r.randint(1,4))],[interval() for _ in range(r.randint(0,8))])
add(11,'覆盖全部监测区域的最少卫星','目标区域和卫星范围均为连续实数闭区间。选择最少卫星，使每个目标区域的每一点被覆盖；目标区域之间的空隙不要求覆盖。无解输出−1。原首例在9到10之间存在缺口，正确答案为−1，不是3。','第一行 n m；随后 n 行目标区间，再 m 行卫星区间。本站范围1≤n≤100000，0≤m≤100000，−10⁹≤start<end≤10⁹。','目标与卫星分别排序。扫描目标的最左未覆盖点，从起点不晚于该点的卫星中选择终点最远者；已选择范围可以跨过目标之间的空隙。','覆盖当前点且向右延伸的下一颗卫星，必须从该点或更早开始。把任何可行方案的下一颗换为终点最远者不会减少后续覆盖。每步交换保持不劣，逐个消除所有目标的未覆盖部分；无卫星延伸时该点右侧确实无法覆盖。','时间O(n log n+m log m)，空间O(n+m)。',[([[1,5],[6,10],[11,15]],[[1,6],[5,9],[10,15]]),([[1,4],[5,8],[9,12]],[[1,8],[4,10],[9,13]]),([[1,2],[5,6]],[[0,7]])],'样例1：9到10之间没有卫星覆盖，输出−1。样例2：选择[1,8]和[9,13]覆盖三个目标，输出2。样例3：[0,7]一颗覆盖两个目标，输出1。',cover_random,[(([[i,i+1] for i in range(100000)],[[0,100000]]),'1'),(([[0,100000]],[[i,i+1] for i in range(100000)]),'100000'),(([[0,10]],[]),'-1')],lambda x:f'{len(x[0])} {len(x[1])}\n'+'\n'.join(f'{a} {b}' for a,b in x[0]+x[1])+'\n',cover_oracle,'''def solve(data):
    n,m=map(int,data[:2]);v=list(map(int,data[2:]));targets=sorted(zip(v[:2*n:2],v[1:2*n:2]));sat=sorted(zip(v[2*n::2],v[2*n+1::2]));end=-10**30;index=answer=0
    for left,right in targets:
        if end>=right:continue
        point=max(left,end)
        while point<right:
            far=point
            while index<m and sat[index][0]<=point:
                far=max(far,sat[index][1]);index+=1
            if far<=point:return '-1'
            answer+=1;end=far;point=far
    return str(answer)
''',[('相接端点不能延伸','sat[index][0]<=point','sat[index][0]<point'),('把目标数当成所需卫星数','return str(answer)','return str(n)')])

def word_oracle(x):
    g,w=x;h=len(g);width=len(g[0])
    for row in range(h):
        for col in range(width):
            for dr,dc in ((0,1),(1,0)):
                before=(row-dr,col-dc);after=(row+dr*len(w),col+dc*len(w))
                if 0<=before[0]<h and 0<=before[1]<width and g[before[0]][before[1]]!='#':continue
                if 0<=after[0]<h and 0<=after[1]<width and g[after[0]][after[1]]!='#':continue
                if all(0<=row+dr*i<h and 0<=col+dc*i<width and g[row+dr*i][col+dc*i] in ('_',ch) for i,ch in enumerate(w)):return '1'
    return '0'
add(12,'将单词填入完整横向或纵向空位','网格含#（墙）、_（可填空位）与小写字母。只允许从左向右或从上向下填写单词。单词必须占满一个由边界或#分隔的连续段；已有字母必须匹配。原站大写和空格示例不符合其字符约定，本站统一为小写与下划线。','第一行r c，随后r行网格，最后一行单词。本站1≤r,c≤500，单词长度1..500，仅小写字母。','按#拆开每一行及每一列；仅检查与单词等长的段，逐字符确认是空位或目标字母。','合法位置必恰好对应一段被墙或边界包围的行段或列段；反之长度相同且全部字符兼容的段一定能填入。枚举全部这些段既不遗漏也不会接受部分段。','时间O(rc)，空间O(rc)。',[(['####','l_#_','ala_','#x#_'],'ala'),(['####','l_#_','alan','#x#_'],'alan'),(['c#','_#','t#'],'cat')],'样例1：ala所在横段长4，不能只占前三格，其他完整段也不匹配，输出0。样例2：第三行恰为alan，输出1。样例3：第一列c_t完整匹配cat，输出1。',lambda r:(lambda h,w:([''.join(r.choice('#_abc') for _ in range(w)) for _ in range(h)],''.join(r.choice('abc') for _ in range(r.randint(1,5)))))(r.randint(1,5),r.randint(1,5)),[((['_'*500]*500,'a'*500),'1'),((['a'*500]*500,'b'*500),'0'),((['ba'],'ab'),'0')],lambda x:grid(x[0])+x[1]+'\n',word_oracle,'''def solve(data):
    h,w=map(int,data[:2]);g=data[2:2+h];word=data[-1]
    rows=g+[''.join(g[r][c] for r in range(h)) for c in range(w)]
    for row in rows:
        for part in row.split('#'):
            if len(part)==len(word) and all(a=='_' or a==b for a,b in zip(part,word)):return '1'
    return '0'
''',[('允许忽略已有字母',"all(a=='_' or a==b for a,b in zip(part,word))","True"),('允许反向填入',"for part in row.split('#'):","for part in row.split('#')+[p[::-1] for p in row.split('#')]:")])

def bombs_oracle(a):
    best=0
    for start in range(len(a)):
        exploded={start};changed=True
        while changed:
            changed=False
            for j,(x,y,r) in enumerate(a):
                if j not in exploded and any((x-a[i][0])**2+(y-a[i][1])**2<=a[i][2]**2 for i in exploded):exploded.add(j);changed=True
        best=max(best,len(exploded))
    return str(best)
add(15,'引爆一枚炸弹的最大连锁数量','炸弹i的爆炸会引爆与它距离不超过r[i]的炸弹，并继续连锁。选择最初的一枚，求最多引爆数；半径不同，传播关系是有向的。','第一行n（1..1000）；随后n行x y r，−100000≤x,y≤100000，1≤r≤100000。','先计算有向邻接位集（包含自身），用位集版传递闭包合并经每个中间点可到达的所有点，最后求最大位数。','初始位集包含零步和一步可达点。处理中间点k时，对能到k的起点合并k的可达集合，恰好加入以k为新增中间点的路径。逐步覆盖全部中间点后，每一行就是完整连锁集合。','距离建图O(n²)；闭包O(n³/W)位操作，W为机器字长；空间O(n²/W)。',[[(2,1,3),(6,1,4),(4,1,1)],[(0,0,1),(3,0,1)],[(0,0,10),(3,0,1),(6,0,1)]],'样例1：先引爆第二枚，它的半径4能够直接引爆另外两枚，总计3；并非第三枚能够引爆第二枚。样例2：两枚互不影响，最多1。样例3：第一枚覆盖另外两枚，总计3。',lambda r:[(r.randint(-5,5),r.randint(-5,5),r.randint(1,6)) for _ in range(r.randint(1,8))],[(([(0,0,1)]*1000),'1000'),(([(i*200-100000,0,1) for i in range(1000)]),'1'),(([(i,0,1) for i in range(1000)]),'1000')],lambda a:str(len(a))+'\n'+'\n'.join(' '.join(map(str,p)) for p in a)+'\n',bombs_oracle,'''def solve(data):
    n=int(data[0]);v=list(map(int,data[1:]));a=list(zip(v[::3],v[1::3],v[2::3]));reach=[]
    for x,y,r in a:
        bits=0
        for j,(u,v,s) in enumerate(a):
            if (x-u)**2+(y-v)**2<=r*r:bits|=1<<j
        reach.append(bits)
    for k in range(n):
        bit=1<<k;row=reach[k]
        for i in range(n):
            if reach[i]&bit:reach[i]|=row
    return str(max(row.bit_count() for row in reach))
''',[('漏掉爆炸半径边界','<=r*r','<r*r'),('把传播看成无向','<=r*r','<=max(r,s)**2')],timeLimit=6)

def island_oracle(g):
    pending={(i,j) for i,row in enumerate(g) for j,c in enumerate(row) if c=='1'};shapes=[]
    while pending:
        start=min(pending);component={start};pending.remove(start);changed=True
        while changed:
            additions={p for p in pending if any(abs(p[0]-q[0])+abs(p[1]-q[1])==1 for q in component)}
            changed=bool(additions);component|=additions;pending-=additions
        if not any(len(old)==len(component) and any({(x+dx,y+dy) for x,y in old}==component for dx,dy in [(start[0]-q[0],start[1]-q[1]) for q in old]) for old in shapes):shapes.append(component)
    return str(len(shapes))
add(61,'仅平移等价的岛屿种类','1表示陆地、0表示水，陆地按上下左右连接。岛屿形状仅允许平移后重合才视为相同，旋转或镜像不算相同。求不同形状数。','第一行r c，随后r行01串。本站1≤r,c≤500。','遍历连通块，将块内每个坐标减去首次访问坐标并排序，元组作为形状签名。','连通块遍历完整且互不重复。同形状在平移后所有相对坐标相同；反过来签名相同意味着存在同一个平移向量让所有格子一一重合。','时间O(rc log(rc))，空间O(rc)。',[['111100','110001','001101','110000','001111','101100'],['1001','1001'],['1100','0001','0001']],'样例1：有6个连通块，其中两对平移等价，合计4种形状。样例2：两条竖直长度2的岛屿可以平移重合，输出1。样例3：横向两格与竖向两格不能仅靠平移重合，输出2。',lambda r:[ ''.join(r.choice('01') for _ in range(5)) for _ in range(r.randint(1,5))],[((['1'*500]*500),'1'),(([''.join(str((i+j)%2) for j in range(500)) for i in range(500)]),'1'),((['0'*500]*500),'0')],grid,island_oracle,'''def solve(data):
    h,w=map(int,data[:2]);g=data[2:];seen=set();shapes=set()
    for r in range(h):
        for c in range(w):
            if g[r][c]!='1' or (r,c) in seen:continue
            seen.add((r,c));stack=[(r,c)];points=[]
            while stack:
                x,y=stack.pop();points.append((x-r,y-c))
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    a,b=x+dx,y+dy
                    if 0<=a<h and 0<=b<w and g[a][b]=='1' and (a,b) not in seen:seen.add((a,b));stack.append((a,b))
            shapes.add(tuple(sorted(points)))
    return str(len(shapes))
''',[('只按面积判同形','shapes.add(tuple(sorted(points)))','shapes.add(len(points))'),('误将斜对角连通','((1,0),(-1,0),(0,1),(0,-1))','((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1))')],timeLimit=6)

def split_oracle(s):return str(sum(len(set(s[:i]))==len(set(s[i:])) for i in range(1,len(s))))
add(62,'不同字符数相等的切分数','将字符串切成非空前缀和非空后缀，统计两边不同字符数相等的切分位置数量。','一行小写字符串；本站长度1..100000。','右侧频次从整串开始，逐字符移入左侧，同时维护两侧不同字符数。','每个合法切口恰在移入其左侧末字符后检查一次。频次由正变零或由零变正时更新不同字符数，故比较值始终真实。','时间O(n)，空间O(26)。',['aaaa','bac','ababa'],'样例1：三个切口两侧都只有a，输出3。样例2：b|ac和ba|c两侧种类数均不相等，输出0。样例3：ab|aba、aba|ba均为两种字符，输出2。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,12))),[(('a'*100000),'99999'),(('ab'*50000),'99997')],lambda s:s+'\n',split_oracle,'''from collections import Counter
def solve(data):
    s=data[0];right=Counter(s);left=set();answer=0
    for i in range(len(s)-1):
        c=s[i]
        left.add(c);right[c]-=1
        if right[c]==0:del right[c]
        if len(left)==len(right):answer+=1
    return str(answer)
''',[('把大于也算合格','len(left)==len(right)','len(left)>=len(right)'),('漏掉最后合法切口','range(len(s)-1)','range(len(s)-2)')])

def reach_oracle(x):
    g,limit=x;h=len(g);w=len(g[0]);cells=[(i,j) for i in range(h) for j in range(w) if g[i][j]=='.'];n=len(cells);d=[[0 if i==j else 10**9 for j in range(n)] for i in range(n)]
    for i,a in enumerate(cells):
        for j,b in enumerate(cells):
            if abs(a[0]-b[0])+abs(a[1]-b[1])==1:d[i][j]=1
    for k in range(n):
        for i in range(n):
            for j in range(n):d[i][j]=min(d[i][j],d[i][k]+d[k][j])
    return 'Yes' if d[0][-1]<=limit else 'No'
def reach_random(r):
    h=r.randint(1,4);w=r.randint(1,4);g=[[r.choice('.#') for _ in range(w)] for _ in range(h)];g[0][0]=g[-1][-1]='.'
    return ([''.join(row) for row in g],r.randint(1,20))
add(66,'在时限内走到网格终点','从左上角出发，每秒向上下左右相邻的可通行格移动一步，问能否在maxTime秒以内到右下角。#不可通行，.可通行，起终点保证可通行。原首例文字首行少一个#，本站依据同题示意图补成规则矩形。','第一行r c maxTime，随后r行网格。1≤r≤500，1≤maxTime≤100000；本站列数1..500。','广度优先搜索最短距离；抵达终点时比较与时限，超过时限的层无需继续扩展。','每条边费用都为1，BFS按距离递增处理，所以首次抵达终点就是最少用时；存在时限内方案当且仅当该距离不超过时限。','时间O(rc)，空间O(rc)。',[(['..##','#.##','#...'],5),(['..','..'],3),(['.#','#.'],2)],'样例1：沿(0,0)→(0,1)→(1,1)→(2,1)→(2,2)→(2,3)走5步，输出Yes。样例2：最短2步，小于3，输出Yes。样例3：两条出路均堵住，输出No。',reach_random,[((['.'*500]*500,998),'Yes'),((['.'*500]*500,997),'No'),((['.'],1),'Yes')],lambda x:f'{len(x[0])} {len(x[0][0])} {x[1]}\n'+'\n'.join(x[0])+'\n',reach_oracle,'''from collections import deque
def solve(data):
    h,w,limit=map(int,data[:3]);g=data[3:];q=deque([(0,0,0)]);seen={(0,0)}
    while q:
        r,c,d=q.popleft()
        if (r,c)==(h-1,w-1):return 'Yes' if d<=limit else 'No'
        if d>=limit:continue
        for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
            a,b=r+dr,c+dc
            if 0<=a<h and 0<=b<w and g[a][b]=='.' and (a,b) not in seen:seen.add((a,b));q.append((a,b,d+1))
    return 'No'
''',[('拒绝恰好用尽时限','d<=limit','d<limit'),('允许斜向走','((1,0),(-1,0),(0,1),(0,-1))','((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1))')],timeLimit=6)

def score_oracle(x):
    a,s=x;selected=[i for i,c in enumerate(s) if c=='T']
    return str(sum(a[i] for i in selected)+sum(abs(i-j)==1 for i,j in itertools.combinations(selected,2)))
add(68,'棋盘代币与相邻奖励','T表示有代币，E表示空格。有代币格获得对应points分，每对相邻且都有代币的格子额外获得1分，求总分。','第一行n（1..100），第二行n个points（1..1000），第三行长度n的TE串。','累加所有T格子的分数，再统计相邻TT的数量。','基础分按格子独立累计；每个相邻对只在其右端点处计算一次，既不遗漏也不重复。','时间O(n)，空间O(n)（含输入）。',[([3,4,5,2,3],'TEETT'),([3,2,1,2,2],'ETTTE'),([2,2,2,2],'TTTT')],'样例1：有代币格分数3+2+3=8，末两格奖励1，总分9。样例2：分数2+1+2=5，两个相邻对奖励2，总分7。样例3：基础8分加三个相邻奖励，总分11。',lambda r:(lambda n:([r.randint(1,1000) for _ in range(n)],''.join(r.choice('TE') for _ in range(n))))(r.randint(1,10)),[(([1000]*100,'T'*100),'100099'),(([1000]*100,'E'*100),'0')],lambda x:array(x[0])+x[1]+'\n',score_oracle,'''def solve(data):
    n=int(data[0]);a=list(map(int,data[1:n+1]));s=data[-1];answer=0
    for i,c in enumerate(s):
        if c=='T':answer+=a[i]
        if i and s[i-1:i+1]=='TT':answer+=1
    return str(answer)
''',[('遗漏相邻奖励','answer+=1','answer+=0'),('空格也获得基础分',"if c=='T':answer+=a[i]","if True:answer+=a[i]")])

def suggestions_oracle(x):
    a,word,k=x;lines=[]
    for length in range(1,len(word)+1):
        matched=sorted([(name,score) for name,score in a if name.startswith(word[:length])],key=lambda p:(-p[1],p[0]))[:k]
        lines.append(str(len(matched))+(' '+' '.join(name for name,score in matched) if matched else ''))
    return '\n'.join(lines)
def suggestions_random(r):
    names=r.sample([''.join(p) for length in range(1,4) for p in itertools.product('abc',repeat=length)],r.randint(1,12))
    return ([(name,r.randint(0,5)) for name in names],''.join(r.choice('abcd') for _ in range(r.randint(1,4))),r.randint(1,6))
def letters(i):
    result=''
    for _ in range(4):result=chr(97+i%26)+result;i//=26
    return result
add(69,'按热度排序的前缀搜索建议','对searchWord的每个非空前缀，从名称以该前缀开头的产品中选择前k项。先按热度降序，热度相同按名称字典序升序；不足k项全部返回。','第一行n k，接着n行name popularity，最后一行searchWord。n≤100000；本站1≤k≤100，名称互不相同，名称和搜索串是长度1..50的小写字母串，全部名称总长≤1000000，热度整数0..10⁹。','先按统一排名排序产品。对每个产品计算与搜索串的最长公共前缀，向对应各前缀尚未满k项的结果列表追加该产品。','排名顺序扫描时，每个前缀收到的就是所有匹配产品的排名顺序；只保留前k项，故每个列表恰为该前缀的最优建议。','排序比较最坏O(n log n·L)，匹配O(名称总长)，空间O(名称总长+搜索串长度·k)，L是最大名称长度。',[([('apple',80),('appetizer',70),('application',90),('app',90),('apply',85),('banana',60),('appstore',90)],'app',3),([('a',2),('ab',3),('ac',3)],'ab',2),([('cat',1)],'dog',3)],'样例1：三个前缀a、ap、app都选app、application、appstore，热度同为90后按名称排序。样例2：前缀a推荐ab、ac；前缀ab只推荐ab。样例3：d、do、dog均无匹配，每行输出0。',suggestions_random,[(( [('a'+letters(i),0) for i in range(100000)],'a',3),'3 aaaaa aaaab aaaac'),(( [('a'*46+letters(i),i) for i in range(20000)],'a'*46,1),'\n'.join(['1 '+'a'*46+letters(19999)]*46))],lambda x:f'{len(x[0])} {x[2]}\n'+'\n'.join(f'{s} {v}' for s,v in x[0])+'\n'+x[1]+'\n',suggestions_oracle,'''def solve(data):
    n,k=map(int,data[:2]);products=[(data[2+2*i],int(data[3+2*i])) for i in range(n)];word=data[-1];answer=[[] for _ in word]
    for name,score in sorted(products,key=lambda p:(-p[1],p[0])):
        for i in range(min(len(name),len(word))):
            if name[i]!=word[i]:break
            if len(answer[i])<k:answer[i].append(name)
    return '\\n'.join(str(len(row))+(' '+' '.join(row) if row else '') for row in answer)
''',[('热度升序','(-p[1],p[0])','(p[1],p[0])'),('并列名称逆序','sorted(products,key=lambda p:(-p[1],p[0]))','sorted(products,key=lambda p:(p[1],p[0]),reverse=True)')],output='对搜索串的每个非空前缀依次输出一行：先输出推荐数量，再输出对应名称，以空格分隔。',timeLimit=6)

def palindrome_oracle(s):
    total=0
    for i in range(len(s)):
        for j in range(i+1,len(s)+1):total+=sum(v%2 for v in collections.Counter(s[i:j]).values())//2
    return str(total)
add(70,'所有子串重排成回文的修改总数','对每个非空子串，可将字符任意重排，并把一个字符替换为另一字符。求让它能重排为回文的最少替换次数，再对所有子串求和。','一行小写字符串，长度1..200000。','单个子串代价为奇数频次字母数除以2向下取整。对每个字母，前缀奇偶性不同的两前缀数量为zero·one，累计即所有子串奇数频次总数。再减去奇数长度子串数，最后除2。','每次替换最多消去两个奇数频次，因此代价下界floor(odd/2)，把一奇数字母改为另一奇数字母即可达到。子串字母频次奇偶等于两端前缀奇偶异或；odd的奇偶等于子串长度奇偶，所以减去奇数长度子串个数可统一实现向下取整。','时间O(26n)，空间O(26)，答案需64位整数。',['abca','wwwww','acbaed'],'样例1：长度2的三个子串各需1次，长度3的两个各需1次，整串需1次，总计6。样例2：任意子串本身就是回文，总计0。样例3：按长度2、3、4、5、6分组的代价总和分别为5、4、5、3、2，合计19。',lambda r:''.join(r.choice('abcde') for _ in range(r.randint(1,10))),[(('a'*200000),'0'),(('ab'*100000),'5000050000')],lambda s:s+'\n',palindrome_oracle,'''def solve(data):
    s=data[0];n=len(s);parity=[0]*26;ones=[0]*26
    for c in s:
        parity[ord(c)-97]^=1
        for j in range(26):ones[j]+=parity[j]
    odd=sum(v*(n+1-v) for v in ones);odd_lengths=((n+2)//2)*((n+1)//2)
    return str((odd-odd_lengths)//2)
''',[('不扣奇长度子串','(odd-odd_lengths)//2','odd//2'),('错误向上取整','(odd-odd_lengths)//2','(odd+odd_lengths)//2')],timeLimit=6)

def keyboard_oracle(x):
    layout,word=x;current=layout[0];answer=0
    for c in word:answer+=abs(layout.index(c)-layout.index(current));current=c
    return str(answer)
add(72,'单行键盘的输入时间','26个小写字母各在键盘中出现一次。手指初始在下标0，每次移动的时间是下标差的绝对值。依次输入word，求总移动时间。源样例键盘漏了z，本站补齐末尾z，不改变cba的用时。','第一行是26个小写字母的排列；第二行word，本站长度1..100000，仅含小写字母。','预处理每个字母的位置，顺次累加与上个位置的距离。','每个字符的目标位置唯一，当前手指位置由上个字符确定，因此每次必要移动量就是两位置之差，求和即总时间。','时间O(26+n)，空间O(26)。',[('abcdefghijklmnopqrstuvwxyz','cba'),('abcdefghijklmnopqrstuvwxyz','az'),('zyxwvutsrqponmlkjihgfedcba','z')],'样例1：从a到c需2，再到b需1、到a需1，共4。样例2：先输入a无需移动，再到z需25，共25。样例3：z在下标0，无需移动，答案0。',lambda r:(''.join(r.sample('abcdefghijklmnopqrstuvwxyz',26)),''.join(r.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(r.randint(1,12)))),[(('abcdefghijklmnopqrstuvwxyz','az'*50000),'2499975'),(('abcdefghijklmnopqrstuvwxyz','a'*100000),'0')],lambda x:x[0]+'\n'+x[1]+'\n',keyboard_oracle,'''def solve(data):
    layout,word=data;position={c:i for i,c in enumerate(layout)};current=0;answer=0
    for c in word:
        answer+=abs(position[c]-current);current=position[c]
    return str(answer)
''',[('每次从原点出发','current=position[c]','current=0'),('忽略向左移动','abs(position[c]-current)','max(0,position[c]-current)')])

def friends_oracle(x):
    n,edges=x;friends=[set() for _ in range(n)]
    for a,b in edges:friends[a-1].add(b-1);friends[b-1].add(a-1)
    answers=[]
    for i in range(n):
        options=[j for j in range(n) if i!=j and j not in friends[i]]
        answers.append(min(options,key=lambda j:(-len(friends[i]&friends[j]),j))+1 if options else -1)
    return ' '.join(map(str,answers))
def friends_random(r):
    n=r.randint(1,9);return n,[(a,b) for a in range(1,n+1) for b in range(a+1,n+1) if r.randrange(3)==0]
def friends_large():
    edges=[(base+i,base+j) for base in range(1,33329,16) for i in range(16) for j in range(i+1,16)]
    edges += [(33329+2*i,33330+2*i) for i in range(40)]
    assert len(edges)==250000
    return ((100000,edges),' '.join(['17']*16+['1']*(100000-16)))
add(73,'按共同好友数推荐朋友','用户编号1..n。为每个人推荐一个不是自己、也不是现有好友的用户，优先共同好友数最多，其次编号最小；没有候选输出−1。按题面“不是好友”的候选条件，共同好友数为0也可推荐。原例用了0起始编号，本站统一转换为1起始。','第一行n m，随后m行互不重复的无向好友边u v。1≤n≤100000，0≤m≤250000，无自环，每人最多15个好友。','遍历每个人的好友的好友，计数所有非好友候选；有正计数时按数量和编号取最优。若没有正计数，找最小非自己非好友编号即可。','候选与当前用户每个共同好友对应一条二跳路径，枚举准确计数。未出现候选均为0，不能胜过正数；若全部为0，编号最小的合法候选就是答案。','时间O(n+Σ degree²)，上界O(n+30m)；空间O(n+m)，局部计数最多225项。',[(3,[(1,2),(1,3)]),(4,[]),(1,[])],'样例1：用户1没有候选；2与3通过1共同认识，结果−1 3 2。样例2：没有好友，所有候选共同好友数均为0，按最小编号得到2 1 1 1。样例3：只有自己，无候选，输出−1。',friends_random,[friends_large(),((100000,[]),'2 '+' '.join(['1']*99999))],lambda x:f'{x[0]} {len(x[1])}\n'+'\n'.join(f'{a} {b}' for a,b in x[1])+'\n',friends_oracle,'''def solve(data):
    n,m=map(int,data[:2]);friends=[set() for _ in range(n)];v=list(map(int,data[2:]))
    for i in range(0,len(v),2):
        a,b=v[i]-1,v[i+1]-1;friends[a].add(b);friends[b].add(a)
    answer=[]
    for i in range(n):
        counts={};own=friends[i]
        for middle in own:
            for candidate in friends[middle]:
                if candidate!=i and candidate not in own:counts[candidate]=counts.get(candidate,0)+1
        if counts:best=min(counts,key=lambda j:(-counts[j],j))
        else:
            best=0
            while best<n and (best==i or best in own):best+=1
        answer.append(best+1 if best<n else -1)
    return ' '.join(map(str,answer))
''',[('同分选最大编号','(-counts[j],j)','(-counts[j],-j)'),('拒绝零共同好友候选','best=0','best=n')],timeLimit=6)

def ordered_oracle(a):return str(sum(sorted(a[:i])+sorted(a[i:])==sorted(a) for i in range(1,len(a))))
add(74,'分别排序两段后整体有序的切分数','将数组切为非空前后两段，分别升序排序后按原先前后顺序拼接，统计拼接结果非递减的切口数量。','第一行n（2..100000），第二行n个整数（1..10⁹）。','预处理每个后缀的最小值，扫描前缀最大值，满足前缀最大≤后缀最小的切口有效。','两段内部排序后已经非降，唯一可能的逆序发生在段间；前段最大不超过后段最小恰好排除所有段间逆序。','时间O(n)，空间O(n)。',[[1,3,2,4],[3,2,10,9],[5,5,5]],'样例1：切在1后或2后有效，共2。样例2：只在2与10之间切分有效，共1。样例3：两个切口都允许相等边界，共2。',lambda r:[r.randint(1,10) for _ in range(r.randint(2,10))],[(([10**9]*100000),'99999'),((list(range(100000,0,-1))),'0')],array,ordered_oracle,'''def solve(data):
    a=list(map(int,data[1:]));n=len(a);suffix=a.copy()
    for i in range(n-2,-1,-1):suffix[i]=min(suffix[i],suffix[i+1])
    largest=a[0];answer=0
    for i in range(n-1):
        largest=max(largest,a[i])
        if largest<=suffix[i+1]:answer+=1
    return str(answer)
''',[('相等边界被拒绝','largest<=suffix[i+1]','largest<suffix[i+1]'),('只比较相邻两项','largest=max(largest,a[i])','largest=a[i]')])

def decreasing_oracle(a):
    @functools.lru_cache(None)
    def visit(i,tails):
        if i==len(a):return len(tails)
        possibilities=[visit(i+1,tuple(sorted(tails+(a[i],))))]
        for j,last in enumerate(tails):
            if last>a[i]:possibilities.append(visit(i+1,tuple(sorted(tails[:j]+tails[j+1:]+(a[i],)))))
        return min(possibilities)
    return str(visit(0,()))
add(75,'划分为严格递减子序列的最少数量','把每个元素恰好分配到一个子序列，各子序列保留原数组下标顺序且严格递减，求最少子序列数。子序列不要求连续。','第一行n，第二行n个整数；本站1≤n≤100000，−10⁹≤a[i]≤10⁹。','维护各条递减序列的末尾值并排序。新值x接到末尾大于x且最小的一条上；不存在时新建一条。用upper_bound二分更新。','可接入的序列中选择最小的较大末尾，会保留其他更大末尾供未来元素使用，交换论证不劣。等价地维护最长非降子序列的最小末尾：该子序列的元素必须位于不同递减组，贪心使用的组数恰好达到此下界。','时间O(n log n)，空间O(n)。',[[5,2,4,3,1,6],[2,9,12,13,4,7,6,5,10],[1,1,1]],'样例1：可分成[5,4,3,1]、[2]、[6]，且非降子序列[2,4,6]给出至少3组，答案3。样例2：非降子序列[2,9,12,13]需要4组，贪心也能分成4组。样例3：相等不能放入同一严格递减组，答案3。',lambda r:[r.randint(-3,4) for _ in range(r.randint(1,8))],[((list(range(100000))),'100000'),((list(range(100000,0,-1))),'1'),(([10**9]*100000),'100000')],array,decreasing_oracle,'''from bisect import bisect_right
def solve(data):
    tails=[]
    for x in map(int,data[1:]):
        i=bisect_right(tails,x)
        if i==len(tails):tails.append(x)
        else:tails[i]=x
    return str(len(tails))
''',[('允许相等放同组','bisect_right','bisect_left'),('每个元素单独开组','i=bisect_right(tails,x)','i=len(tails)')])

def justify_oracle(x):
    words,width=x;groups=[];position=0
    while position<len(words):
        options=[j for j in range(position+1,len(words)+1) if len(' '.join(words[position:j]))<=width]
        end=max(options);groups.append(words[position:end]);position=end
    lines=[]
    for index,group in enumerate(groups):
        if index==len(groups)-1 or len(group)==1:line=' '.join(group)+' '*(width-len(' '.join(group)))
        else:
            spaces=width-sum(map(len,group));gaps=len(group)-1
            # Exhaustive positive compositions, independent of the quotient/remainder implementation.
            def layouts(total,k,prefix=()):
                if k==0:
                    if total==0:yield prefix
                    return
                for amount in range(1,total-k+2):yield from layouts(total-amount,k-1,prefix+(amount,))
            counts=next(c for c in layouts(spaces,gaps) if max(c)-min(c)<=1 and list(c)==sorted(c,reverse=True))
            line=''.join(word+' '*counts[i] for i,word in enumerate(group[:-1]))+group[-1]
        lines.append(line)
    return str(len(lines))+'\n'+'\n'.join(lines)
def justify_random(r):
    width=r.randint(3,10);return ([''.join(r.choice('abc') for _ in range(r.randint(1,min(3,width)))) for _ in range(r.randint(1,6))],width)
add(76,'单词贪心分行与两端对齐','每行尽可能放多的完整单词，每个词间至少一个空格，不拆词。非最后行且含多个词时，把空格尽量均匀分配，余数优先加在左侧词间。最后行或单词独占行左对齐并在末尾补空格，每行恰好maxWidth字符。','第一行n maxWidth，随后n行各一个单词。1≤n≤300，1≤maxWidth≤100，单词长1..min(20,maxWidth)，由ASCII非空白字符组成。','按最少单空格贪心收集每行单词。非尾行按空格总数除以间隙数分配，最后行使用单空格并右侧补齐。','取最长可容纳前缀严格符合尽可能多单词的规则。均分商保证各间隙相差不超过1，余数给左侧满足偏左规则；末行与单词行按规定补齐，输出唯一。','时间O(输出字符数)，空间O(输出字符数)。',[(['This','is','an','example','of','text','justification.'],16),(['a','b','c','d'],4),(['word'],6)],'样例1：三行为“This    is    an”、“example  of text”、“justification.  ”，引号不输出；各16字符。样例2：首行a后有两个空格再b，末行为“c d ”，各4字符。样例3：word后补两个空格，行宽6。',justify_random,[((['a']*300,100),'6\n'+'\n'.join([' '.join(['a']*50)+' ']*6)),((['a'*20]*300,20),'300\n'+'\n'.join(['a'*20]*300))],lambda x:f'{len(x[0])} {x[1]}\n'+'\n'.join(x[0])+'\n',justify_oracle,'''def solve(data):
    n,width=map(int,data[:2]);words=data[2:];answer=[];i=0
    while i<n:
        end=i;letters=0
        while end<n and letters+len(words[end])+(end-i)<=width:letters+=len(words[end]);end+=1
        count=end-i
        if end==n or count==1:line=' '.join(words[i:end]).ljust(width)
        else:
            base,extra=divmod(width-letters,count-1)
            line=''.join(words[j]+' '*(base+(j-i<extra)) for j in range(i,end-1))+words[end-1]
        answer.append(line);i=end
    return str(len(answer))+'\\n'+'\\n'.join(answer)
''',[('删除右侧必要空格','answer.append(line)','answer.append(line.rstrip())'),('余数空格优先右侧','j-i<extra','j-i>=count-1-extra')],checker='exact',output='第一行输出行数，接着输出排版后的各行，每行必须恰好maxWidth个字符（包含末尾空格）。整个输出最后也须换行。')

def game_oracle(x):
    n,k,moves=x;board={};winner=False;answers=[]
    for player,r,c in moves:
        if winner:answers.append('Game Over');continue
        if (r,c) in board:answers.append('Invalid Move');continue
        board[r,c]=player
        win=any(all(board.get((a+t*dr,b+t*dc))==player for t in range(3)) for a in range(n) for b in range(n) for dr,dc in ((1,0),(0,1),(1,1),(1,-1)))
        if win:winner=True;answers.append(f'Player {player} won')
        else:answers.append('Draw' if len(board)==n*n else 'In Progress')
    return '\n'.join(answers)
def game_random(r):
    n=r.randint(3,5);k=r.randint(1,4)
    return n,k,[(i%k+1,r.randrange(n),r.randrange(n)) for i in range(r.randint(1,n*n+5))]
add(77,'多玩家三连棋逐步状态','处理输入给出的玩家落子，不另外推断轮次。棋盘n×n，但连胜长度始终为3：横、竖或两种斜方向至少三连即胜。已有赢家之后任何操作返回Game Over；此前占用格返回Invalid Move且棋盘不变；成功落子依次判断胜利、满盘Draw、否则In Progress。','第一行n k m；随后m行player row col，行列从0计。3≤n≤1000，1≤k≤10，1≤m≤min(n²+5,100000)，坐标合法、玩家1..k。','用数组存棋盘。新子落下后仅检查经过它的四条方向，每边最多看2格。先判断已有赢家和重复落子。','此前尚无胜者，新增三连一定包含本次新增格。四个方向枚举全部直线，每侧最多2格足够判断是否构成长度3。状态判断顺序与规则一致。','时间O(n²+m)，空间O(n²)，每步胜负检查O(1)。',[(3,2,[(1,0,0),(2,1,0),(1,0,1),(2,1,1),(1,0,2)]),(4,3,[(1,0,0),(2,0,1),(3,3,3),(1,1,1),(2,1,0),(3,2,1),(1,2,2)]),(3,2,[(1,0,0),(2,0,0),(1,0,1),(2,1,0),(1,0,2),(2,2,2)])],'样例1：前四步In Progress，第五步第一行三连，Player 1 won。样例2：前六步未获胜，第七步(0,0)、(1,1)、(2,2)三连获胜，即使棋盘宽4也无需四连。样例3：第二步重复格为Invalid Move，第五步Player 1 won，第六步Game Over，其余为In Progress。',game_random,[((1000,4,[(1+(r+2*c)%4,r,c) for r in range(100) for c in range(1000)]),'\n'.join(['In Progress']*100000)),((3,3,[(1,0,0),(2,0,1),(3,0,2),(1,1,1),(2,1,2),(3,1,0),(1,2,1),(2,2,0),(3,2,2)]),'\n'.join(['In Progress']*8+['Draw']))],lambda x:f'{x[0]} {x[1]} {len(x[2])}\n'+'\n'.join(' '.join(map(str,m)) for m in x[2])+'\n',game_oracle,'''def solve(data):
    n,k,m=map(int,data[:3]);v=list(map(int,data[3:]));board=[0]*(n*n);occupied=0;winner=False;answer=[]
    for i in range(0,len(v),3):
        player,r,c=v[i:i+3];cell=r*n+c
        if winner:answer.append('Game Over');continue
        if board[cell]:answer.append('Invalid Move');continue
        board[cell]=player;occupied+=1
        for dr,dc in ((1,0),(0,1),(1,1),(1,-1)):
            count=1
            for direction in (-1,1):
                for step in (1,2):
                    a,b=r+direction*step*dr,c+direction*step*dc
                    if not(0<=a<n and 0<=b<n) or board[a*n+b]!=player:break
                    count+=1
            if count>=3:winner=True
        answer.append(f'Player {player} won' if winner else ('Draw' if occupied==n*n else 'In Progress'))
    return '\\n'.join(answer)
''',[('要求n连才赢','if count>=3:','if count>=n:'),('覆盖已占用格','if board[cell]:','if False:')],output='每次操作输出一行对应状态，大小写和单词按题面定义。',timeLimit=6)

@functools.lru_cache(None)
def colour_graph(n):
    states=['']
    for _ in range(n):states=[s+c for s in states for c in 'xyz' if not s or s[-1]!=c]
    buckets=collections.defaultdict(list)
    for s in states:
        for i in range(n):buckets[s[:i]+'*'+s[i+1:]].append(s)
    graph={s:set() for s in states}
    for members in buckets.values():
        for a,b in itertools.combinations(members,2):graph[a].add(b);graph[b].add(a)
    return graph
def colour_oracle(x):
    start,target=x;graph=colour_graph(len(start));distance={start:0};q=collections.deque([start])
    while q:
        s=q.popleft()
        if s==target:return str(distance[s])
        for t in graph[s]:
            if t not in distance:distance[t]=distance[s]+1;q.append(t)
    return '-1'
def colour_random(r):
    n=r.randint(1,6);states=list(colour_graph(n));return r.choice(states),r.choice(states)
add(78,'保持相邻不同的三色字符串变换','两个等长字符串只含x、y、z，且相邻字符都不同。每步修改一个位置成另外一种字符，中间字符串也必须相邻不同。求从起点到目标的最少步数，不可达输出−1。源题没有数值范围；本站采用可完整搜索的范围，非法的重复相邻字符示例不作为合法输入。','第一行n，第二行起始串，第三行目标串。本站1≤n≤12，两串长度n，均只含xyz且相邻不同。','从起点BFS。对每个位置尝试另外两种颜色，只要与左右邻居不同就加入下一状态；首次到达目标的距离为答案。','每个合法单字符修改恰好对应状态图的一条边，边权均为1；枚举位置和替代字符得到全部且仅有合法边，BFS得到最少操作数。','合法状态数至多3·2^(n−1)。时间O(n²·2^n)（包含字符串复制），空间O(n·2^n)。',[('zxyz','zyxz'),('xy','yx'),('x','z')],'样例1：最少步数由完整合法状态图求出；每一步都必须保留相邻不同，不能采用含相邻重复字母的捷径。样例2：xy→xz→yz→yx，共3步；两步会经过xx或yy，不合法。样例3：直接把x改成z，1步。',colour_random,[((('xy'*6),('yx'*6)),colour_oracle(('xy'*6,'yx'*6))),((('xyz'*4),('zyx'*4)),colour_oracle(('xyz'*4,'zyx'*4)))],lambda x:f'{len(x[0])}\n{x[0]}\n{x[1]}\n',colour_oracle,'''from collections import deque
def solve(data):
    n=int(data[0]);start,target=data[1:];q=deque([(start,0)]);seen={start}
    while q:
        s,d=q.popleft()
        if s==target:return str(d)
        for i in range(n):
            for c in 'xyz':
                if c==s[i] or (i and s[i-1]==c) or (i+1<n and s[i+1]==c):continue
                t=s[:i]+c+s[i+1:]
                if t not in seen:seen.add(t);q.append((t,d+1))
    return '-1'
''',[('只数不相同位置','n=int(data[0]);start,target=data[1:];','n=int(data[0]);start,target=data[1:];return str(sum(a!=b for a,b in zip(start,target)));'),('忽略右邻约束',' or (i+1<n and s[i+1]==c)','')],timeLimit=6)

MAGIC_CODE='''def odd(n):
    a=[[0]*n for _ in range(n)];r=0;c=n//2
    for value in range(1,n*n+1):
        a[r][c]=value;nr=(r-1)%n;nc=(c+1)%n
        if a[nr][nc]:r=(r+1)%n
        else:r,c=nr,nc
    return a
def construct(n):
    if n%2:return odd(n)
    if n%4==0:
        return [[(n*n+1-(r*n+c+1)) if r%4==c%4 or r%4+c%4==3 else r*n+c+1 for c in range(n)] for r in range(n)]
    m=n//2;k=(n-2)//4;base=odd(m);a=[[base[r%m][c%m]+((0 if c<m else 2) if r<m else (3 if c<m else 1))*m*m for c in range(n)] for r in range(n)]
    for r in range(m):
        for c in list(range(k))+list(range(n-k+1,n)):a[r][c],a[r+m][c]=a[r+m][c],a[r][c]
    for c in (0,k):a[k][c],a[k+m][c]=a[k+m][c],a[k][c]
    return a
def solve(data):
    n=int(data[0])
    if n==2:return 'null'
    a=construct(n)
    return '\\n'.join(' '.join(map(str,row)) for row in a)
'''
def magic_valid(stdin,stdout):
    n=int(stdin);tokens=stdout.split()
    if n==2:return tokens==['null']
    try:v=list(map(int,tokens))
    except ValueError:return False
    if len(v)!=n*n or sorted(v)!=list(range(1,n*n+1)):return False
    target=n*(n*n+1)//2
    return all(sum(v[r*n:(r+1)*n])==target for r in range(n)) and all(sum(v[c::n])==target for c in range(n)) and sum(v[i*n+i] for i in range(n))==target and sum(v[i*n+n-1-i] for i in range(n))==target
def magic_oracle(n):
    # The independent oracle is the full mathematical predicate, not a second construction.
    scope={};exec(MAGIC_CODE,scope);output=scope['solve']([str(n)]);assert magic_valid(str(n),output)
    if n==2:return output
    rows=[row.split() for row in output.splitlines()]
    rotated='\n'.join(' '.join(rows[n-1-c][r] for c in range(n)) for r in range(n));assert magic_valid(str(n),rotated)
    return rotated
add(17,'构造任意合法幻方','输出一个n阶幻方：使用1..n²各一次，每行、每列以及两条主对角线的和全部相同。不存在时输出null。任意合法构造都接受，不要求与样例排列一致。','一行整数n（1..50）。','奇数阶使用上移右移、冲突则下移的Siamese构造；4的倍数阶按4×4位置模式取互补数；其他偶数阶由四个奇数阶块和特定列交换构造。2阶无解。','奇数构造按n个一组循环覆盖所有格子，并平衡各行列与对角线。双偶阶把关于中心互补的数成对选取，保证各线平均数为(n²+1)/2。单偶阶四块分别平移0、2m²、3m²、m²，交换左k列和最右k−1列平衡上下半区，并在中间行调整首列与第k列以平衡对角线；交换不改变数值全集。最终所有线之和为n(n²+1)/2。2阶若四个数互不相同，行列同时等和将强制两个数相等，故无解。','时间O(n²)，空间O(n²)。',[1,2,3],'样例1：只输出1即合法。样例2：2阶不能使用四个不同数满足行列等和，输出null。样例3：例如8 3 4 / 1 5 9 / 6 7 2，各行列和对角线均为15；旋转或其他合法3阶幻方同样接受。',lambda r:r.randint(1,50),[(n,magic_oracle(n)) for n in range(1,51)],lambda n:str(n)+'\n',magic_oracle,MAGIC_CODE,[('重复数字破坏排列',"a=construct(n)","a=construct(n);a[0][0]=0"),('仅输出顺序方阵',"a=construct(n)","a=[[r*n+c+1 for c in range(n)] for r in range(n)]")],checker='oa-magic-square',output='n=2输出null；否则输出n行、每行n个整数，不带方括号或逗号。任意合法幻方均可。')

BLOCKED={63:'未定义操作i究竟交换哪两个位置，声称有n个操作却只举出1..n−1的相邻交换；操作0可能影响最优解，不能自行删除或定义。',64:'距离定义在“长度之和”处截断，示例却减去公共前缀；多字符串时要求何种聚合也没有说明。',65:'正文没有计分规则，前两例长度、代币下标、数值与答案互相矛盾，不能仅凭第三例或另一题推定规则。',67:'会议调整是否保留相对顺序、是否允许重叠没有定义，源约束也未保证初始会议互不重叠，不能自行套用某一调度问题。',71:'无向图第二例从waypoint=2经0可到3，但原答案为−1；需要明确受约束路线能否重复节点（简单路径和可重复路线答案不同）。',79:'没有给出引用循环、缺失键、字面百分号或递归扩展终止约定。仅两个无环例子不能确定一般输入的正确行为，需补齐模板语法和有效输入条件。'}
NOTES={11:'采用题面连续地理区间，原首例9到10未覆盖，3纠正为−1。',12:'源例大写和空格不符合正文字符规则，转成小写及_；保留仅正向、占满完整段规则。',15:'首例答案3正确但解释链路错误，改为先引爆半径4的第二枚；覆盖原n=1000边界。',17:'语义checker接受任意合法幻方；独立数学谓词检查数值全集、所有行列与双对角，完整覆盖1..50阶；163条oracle并非163种不同阶数。',66:'依据源题同页示意图补齐首例矩形第一行缺失的#。',69:'未提供的长度、k与唯一产品名条件明确为本站有效输入范围；保留源n=100000。',73:'按正文编号1..n换算源0起始例子；正文未要求共同好友数大于0，0共同好友仍按编号推荐。',76:'使用exact逐字核验含行尾空格；原网页显示压缩的空格按明确宽度规则补齐。',77:'遵循输入玩家编码和明确返回状态，不增加题面未定义的轮次错误规则；获胜长度始终3。',78:'本站显式n≤12；独立oracle先枚举全部合法串并通过单空位分桶构建完整图，与参考逐位置生成边分别验证；源不合法串例子未导入。'}
next(s for s in SPECS if s['id']==12)['samples'][0]=(['ala_'],'ala')
NOTES[12]='原网格示例使用正文禁止的大写和空格，本站采用符合字符域的自拟例子，不假定空格一定等价于_；仅正向、占满完整段规则不变。'
next(s for s in SPECS if s['id']==12)['description']='网格含#（墙）、_（可填空位）与小写字母。只允许从左向右或从上向下填写单词。单词必须占满一个由边界或#分隔的连续段；已有字母必须匹配。原网格示例不符合正文字符域，本站提供合法自拟样例。'
next(s for s in SPECS if s['id']==78)['explanation']='样例1：zxyz→zxyx→zxzx→zxzy→zyzy→zyxy→zyxz，每步合法，共6步，完整状态图确认无法更少。样例2：xy→xz→yz→yx，共3步；两步会经过xx或yy，不合法。样例3：直接把x改成z，1步。'
# A full non-last line of 50 single-letter words has 50 spaces: the first gap gets two.
next(s for s in SPECS if s['id']==76)['edges'][0]=((['a']*300,100),'6\n'+'\n'.join(['a  '+' '.join(['a']*49)]*5+[' '.join(['a']*50)+' ']))
colour_graph.cache_clear()
next(s for s in SPECS if s['id']==77)['edges'][0]=((1000,4,[(c%4+1,r,(c+2*r)%1000) for r in range(100) for c in range(1000)]),'\n'.join(['In Progress']*100000))
for number,output in {12:'能够填入输出1，否则输出0。',66:'能在时限以内到达输出Yes，否则输出No，注意大小写。',73:'按用户1..n的顺序输出n个整数：各自推荐的用户编号；没有候选则为−1。'}.items():next(s for s in SPECS if s['id']==number)['output']=output

def execute(path,stdin):
    result=subprocess.run([sys.executable,'-I',str(path)],input=stdin,text=True,capture_output=True,timeout=15)
    assert result.returncode==0,(str(path),result.stderr[:1000])
    return result.stdout
def execute_batch(path,inputs):
    process=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert process.returncode==0,(str(path),process.stderr[:1000]);results=json.loads(process.stdout)
    assert len(results)==len(inputs)
    assert all(isinstance(result,str) for result in results)
    return results
def match(spec,stdin,actual,expected):
    if spec.get('checker')=='oa-magic-square':return magic_valid(stdin,actual)
    if spec.get('checker')=='exact':return actual==expected
    return actual.split()==expected.split()
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};selected=set(map(int,sys.argv[1:]));items=[];reports=[]
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        items=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(x['id'].split('-')[-1]) not in selected]
        reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(x['id'].split('-')[-1]) not in selected]
    for spec in sorted(SPECS,key=lambda s:s['id']):
        if selected and spec['id'] not in selected:continue
        identifier=f"oa-google-{spec['id']}";rng=random.Random(SEED+spec['id']);code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';reference=OUT/'references'/f'{identifier}.py';reference.write_text(code);oracles=[]
        for value in spec['samples']+[spec['random'](rng) for _ in range(160)]:
            stdin=spec['encode'](value);expected=spec['oracle'](value)+'\n'
            oracles.append(dict(input=stdin,expectedOutput=expected))
        for i,(case,actual) in enumerate(zip(oracles,execute_batch(reference,[c['input'] for c in oracles]))):
            assert match(spec,case['input'],actual,case['expectedOutput']),(identifier,'oracle',i,case,actual)
        inputs=oracles[:3]+[dict(input=spec['encode'](x),expectedOutput=y+'\n') for x,y in spec['edges']]+oracles[3:3+min(24,61-len(spec['edges']))];cases=[]
        for i,(c,actual) in enumerate(zip(inputs,execute_batch(reference,[c['input'] for c in inputs]))):
            assert match(spec,c['input'],actual,c['expectedOutput']),(identifier,'formal',i,actual[:100],c['expectedOutput'][:100])
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1))
        mutants=[];kills=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code;changed=code.replace(old,new);path=OUT/'negative-controls'/f'{identifier}-{index}.py';path.write_text(changed)
            outputs=execute_batch(path,[c['input'] for c in cases]);rejected=[i for i,(c,actual) in enumerate(zip(cases,outputs)) if not match(spec,c['input'],actual,c['expectedOutput'])]
            assert rejected,(identifier,label,'survived');mutants.append(dict(name=label,code=changed));kills.append(dict(name=label,rejectedByCases=rejected))
        if spec['id']==17:
            rotated=code.replace("a=construct(n)","a=[list(row) for row in zip(*construct(n)[::-1])]");positive=OUT/'references'/'oa-google-17-rotated.py';positive.write_text(rotated)
            for n,actual in zip(range(1,51),execute_batch(positive,[str(n)+'\n' for n in range(1,51)])):assert magic_valid(str(n),actual)
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Google'],description=spec['description']+'\n\n标准输入输出由CSWork整理；标注本站的数值范围属于本站评测约定。',input=spec['input'],output=spec.get('output','输出题目要求的答案。'),explanation=spec['explanation'],hints=[spec['idea']],timeLimit=spec.get('timeLimit',3),memoryLimit=262144,outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        raw=dict(schemaVersion=1,problem=problem,cases=cases)
        normalized=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        assert '\ufffd' not in normalized,(identifier,'Unexpected U+FFFD');pkg=json.loads(normalized)
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        documents={'packages':pkg,'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}
        for folder,value in documents.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=kills,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracles),'independent checks;',len(cases)-3,'hidden; both normally-exiting mutants rejected',flush=True)
    items.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped={f'oa-google-{k}':v for k,v in BLOCKED.items()},note='Local batched execution only: one isolated process per authored program, fresh runpy __main__/stdin/stdout/argv per case, exceptions and nonzero exits rejected. Not per-case OS isolation; real go-judge sandbox evidence still required. Magic-square predicates cover all 50 distinct n values; 163 oracle rows include repeated n.'),ensure_ascii=False,indent=2)+'\n')
    reviews=[dict(id=f'oa-google-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,NOTES.get(i,'规则明确，使用独立参考程序与小输入枚举对照、真实大边界、正常退出的错误程序验证。'))) for i in IDS]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
