"""Independently authored Microsoft 1..20. Never executes imported solutions."""
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
BATCH='microsoft-first'
SPECS=[]


def array(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def arrays(x):return str(len(x[0]))+'\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n'
def add(number,title,desc,input,idea,proof,complexity,samples,notes,random,encode,oracle,code,mutants,edges,**extra):
    SPECS.append(dict(id=number,title=title,desc=desc,input=input,idea=idea,proof=proof,complexity=complexity,samples=samples,notes=notes,random=random,encode=encode,oracle=oracle,code=code,mutants=mutants,edges=edges,**extra))


def tree_oracle(x):
    letters,parents=x; graph=[[] for _ in parents]
    for i,p in enumerate(parents):
        if p>=0 and letters[i]!=letters[p]:graph[i].append(p);graph[p].append(i)
    best=1
    for start in range(len(parents)):
        queue=[(start,-1,1)]
        for u,p,d in queue:
            best=max(best,d)
            queue.extend((v,u,d+1) for v in graph[u] if v!=p)
    return str(best)


def random_tree(r):
    n=r.randint(1,12); parents=[-1]+[r.randrange(i) for i in range(1,n)]; order=list(range(n));r.shuffle(order)
    out=[0]*n
    for old,new in enumerate(order):out[new]=-1 if parents[old]<0 else order[parents[old]]
    return ''.join(r.choice('ab') for _ in range(n)),out


add(1,'树上相邻字母不同的最长路径','树的每个节点带a或b。求一条简单路径最多包含多少节点，要求路径相邻节点字母不同。路径可以不经过根。',
'本站输入：第一行N（1..100000），第二行N个a/b字符，第三行N个父节点编号（0起始），根父节点为−1；保证恰是一棵树，根可为任意编号。',
'按逆遍历序处理子树，维护每个节点向下的最长合法链。取可连接的两个最长子链组成经过该点的路径。',
'任意简单路径存在唯一最高节点，在该节点处最多由两个不同子树的向下链组成。排除相同字母边后，选择两条最长链恰好最优；枚举所有最高节点即可覆盖全部路径。',
'时间O(N)，空间O(N)。',[('ab',[-1,0]),('abbab',[-1,0,0,0,2]),('a',[-1])],['两个节点字母不同，可以一起访问，答案2。','路径1—0—2的字母为b、a、b，长度3；没有更长合法路径。','只有根节点，最长路径包含1个节点。'],random_tree,
lambda x:str(len(x[1]))+'\n'+x[0]+'\n'+' '.join(map(str,x[1]))+'\n',tree_oracle,
'''def solve(d):
    n=int(d[0]); s=d[1]; parent=list(map(int,d[2:])); children=[[] for _ in range(n)]; root=parent.index(-1)
    for i,p in enumerate(parent):
        if p>=0:children[p].append(i)
    order=[root]
    for u in order:order.extend(children[u])
    down=[1]*n; best=1
    for u in reversed(order):
        first=second=0
        for v in children[u]:
            if s[v]==s[u]:continue
            length=down[v]
            if length>first:first,second=length,first
            elif length>second:second=length
        down[u]=first+1; best=max(best,first+second+1)
    return str(best)
''',[('允许同字母边','if s[v]==s[u]:continue','if False:continue'),('只统计单链','first+second+1','first+1')],[(('ab'*50000,[-1]+list(range(99999))),'100000'),(('a'*100000,[-1]+[0]*99999),'1')])


def mex_oracle(x):
    best=len(x[0])+1
    for chosen in itertools.product(*zip(*x)):
        missing=1
        while missing in chosen:missing+=1
        best=min(best,missing)
    return str(best)


add(2,'逐位二选一后的最小缺失正整数','每个位置从A[i]或B[i]选一个组成C，使C的最小缺失正整数尽量小。本站按“最小化缺失值”判定；原站把它描述为不能出现在任何C中的数，这句话与例子不符。',
'第一行N（1..100000），第二行A，第三行B，各含N个1..100000的整数。',
'只有A[i]=B[i]的位置强迫某值一定出现。收集这些被强迫的值，输出最小的不在集合中的正整数。',
'被强迫的值在所有C中出现，不能缺失。若x没有被强迫，则每个位置至少有一个选项不是x，逐位选它就得到不含x的C。故最小可缺失正数等于强迫集合的最小缺失值。',
'时间O(N)，空间O(N)。',[([1,2,4,3],[1,3,2,3]),([3,2,1,6,5],[4,2,1,3,3]),([1,2],[1,2])],['1和3被固定位置强迫出现，2可避开，答案2。','1和2被强迫出现，3可以逐位避开，答案3。','两个位置只能选1和2，因此最小缺失数是3。'],lambda r:([r.randint(1,8) for _ in range(7)],[r.randint(1,8) for _ in range(7)]),arrays,mex_oracle,
'''def solve(d):
    n=int(d[0]); a=list(map(int,d[1:1+n])); b=list(map(int,d[1+n:])); forced={x for x,y in zip(a,b) if x==y}; answer=1
    while answer in forced:answer+=1
    return str(answer)
''',[('把所有候选都当强迫','forced={x for x,y in zip(a,b) if x==y}','forced=set(a)|set(b)'),('只检查A数组','forced={x for x,y in zip(a,b) if x==y}','forced=set(a)')],[((list(range(1,100001)),list(range(1,100001))),'100001'),(([1]*100000,[2]*100000),'1')])


def erase_oracle(s):
    needed={c for c,n in collections.Counter(s).items() if n%2}; answers=[]
    for indices in itertools.combinations(range(len(s)),len(needed)):
        candidate=''.join(s[i] for i in indices)
        if len(set(candidate))==len(needed) and set(candidate)==needed:answers.append(candidate)
    return min(answers)


add(3,'删除相同字母对后的最小字符串','每次可删除任意两个相同字母，不要求相邻，剩余字符保持原相对顺序。先使长度最短，再求其中字典序最小的字符串。原站部分样例删错字符，本站按此明确定义重新计算。',
'一行1..100000个大写英文字母。','只有出现奇数次的字母需要各保留一个。过滤其他字母后，用单调栈选字典序最小的不重复子序列。',
'删除一对不改变频次奇偶，所以最短结果中每个奇频字母恰保留一次、偶频字母不保留。只要较大的栈顶字母未来还会出现，就可以先让更小字母进入并推迟该字母；贪心选择最小可行前缀，得到最小字典序。',
'时间O(N)，字符辅助空间O(26)。',['CBCAAXA','ZYXZYZYV','ABCBACDDAB'],['C为偶频删除全部，B、A、X各保留一次；能保持顺序的最小结果为BAX。','Z、Y、X、V均为奇频，选择最小可行子序列XYZV。','A、B各出现3次，C、D各2次，最短结果是AB而不是原站的空串。'],lambda r:''.join(r.choice('ABCD') for _ in range(r.randint(1,10))),lambda s:s+'\n',erase_oracle,
'''def solve(d):
    from collections import Counter
    s=d[0]; remaining=Counter(s); required={c for c,n in remaining.items() if n%2}; stack=[]; used=set()
    for c in s:
        remaining[c]-=1
        if c not in required or c in used:continue
        while stack and stack[-1]>c and remaining[stack[-1]]>0:used.remove(stack.pop())
        stack.append(c);used.add(c)
    return ''.join(stack)
''',[('直接排序而不保留顺序',"return ''.join(stack)","return ''.join(sorted(required))"),('保留偶频字符','if n%2','if True')],[('A'*100000,''),('Z'*99999+'A','ZA')],output='输出最终字符串；若为空，输出一个空行。')


def roll_oracle(x):
    s,rolls=x; a=list(s)
    for k in rolls:
        for i in range(k):a[i]=chr(97+(ord(a[i])-96)%26)
    return ''.join(a)


add(4,'前缀字母循环递增','每个操作把前k个小写字母循环递增一次，z变a；按顺序执行所有操作后输出字符串。',
'第一行字符串s（1..100000个小写字母）；第二行操作数m（1..100000）；第三行m个k，1≤k≤|s|。',
'用差分数组记录每次前缀加1，扫描前缀和得到每个位置总递增次数，再对26取模。',
'各位置的递增是可交换的模26加法。每次在0加1、在k减1，前缀和恰统计覆盖该位置的操作次数，因此一次扫描等价于全部操作。',
'时间O(|s|+m)，空间O(|s|)。',[('abz',[3,2,1]),('z',[1]),('abc',[1,1])],['三次前缀操作依次得到bca、cda、dda。','z循环递增为a。','只有首字符递增两次，abc变为cbc。'],lambda r:(''.join(r.choice('abxyz') for _ in range(8)),[r.randint(1,8) for _ in range(r.randint(1,12))]),lambda x:x[0]+'\n'+str(len(x[1]))+'\n'+' '.join(map(str,x[1]))+'\n',roll_oracle,
'''def solve(d):
    s=d[0]; diff=[0]*(len(s)+1)
    for k in map(int,d[2:]):diff[0]+=1;diff[k]-=1
    count=0;result=[]
    for i,c in enumerate(s):count+=diff[i];result.append(chr(97+(ord(c)-97+count)%26))
    return ''.join(result)
''',[('少滚动前缀最后一位','diff[k]-=1','diff[k-1]-=1'),('多递增一次','ord(c)-97+count','ord(c)-96+count')],[(('a'*100000,[100000]*100000),'e'*100000),(('z'*100000,[1]),'a'+'z'*99999)],output='输出最终小写字符串。')


add(5,'两名实习生的最大总奖励','任务必须全部分配，第一人恰做k个，第二人做其余任务；每个任务做且只做一次，求最大奖励总和。',
'第一行n k（1≤n≤100000，0≤k≤n），第二行第一人n个奖励，第三行第二人n个奖励，每项1..10000。',
'先把全部任务给第二人，再选第一人相对第二人的收益差最大的k项。','任意分配都等于第二人全做的总和加上k项收益差。若选了较小差却漏了更大差，交换必不变差，因此选前k大最优。',
'时间O(n log n)，空间O(n)。',[([5,4,3,2,1],[1,2,3,4,5],3),([1],[9],0),([1],[9],1)],['第二人全做得15，最大的3个差为4、2、0，合计21。','k=0，任务给第二人，得9。','k=1必须第一人做，奖励1，不能因较低而不分给他。'],lambda r:([r.randint(1,20) for _ in range(8)],[r.randint(1,20) for _ in range(8)],r.randint(0,8)),lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',lambda x:str(max(sum(x[0][i] if i in choice else x[1][i] for i in range(len(x[0]))) for choice in itertools.combinations(range(len(x[0])),x[2]))),
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));gain=sorted((x-y for x,y in zip(a,b)),reverse=True)
    return str(sum(b)+sum(gain[:k]))
''',[('选最小收益差','reverse=True','reverse=False'),('允许少于k个','sum(gain[:k])','sum(max(0,g) for g in gain[:k])')],[(([10000]*100000,[1]*100000,100000),'1000000000')])


@functools.lru_cache(None)
def replace_oracle(s):
    return max([0]+[1+replace_oracle(s[:i+2]+s[i]+s[i+3:]) for i in range(len(s)-2) if s[i]==s[i+1] and s[i+1]!=s[i+2]])


add(6,'三连字符替换的最多操作','选择连续三个字符，前两个相同且第三个不同，将第三个替换为前两个字符。每次只替换、不删除，求最多能执行多少次操作。原站过程写短了字符串，本站保持原长度。',
'一行3..200000个小写英文字母。','从右向左扫描，遇到相邻相同字符，就可把其右侧后缀中所有不同字符逐个改成它；累计差异数并重置后缀频次。',
'较左的相同字符对可以依次传播到整个右侧后缀。先完成右边能产生的操作，再让较左字符传播，不会失去较左传播能力，且保留了所有较右机会；交换操作顺序可得到这种右到左最优顺序。每次后缀中不同字符都恰需并能贡献一次操作。',
'时间O(N)，字母计数空间O(26)。',['aabaab','abc','aab'],['aabaab先把末尾b改a，再把第三位b改a，变成aaaaaa，共2次。','不存在相邻相同字符对，不能操作，答案0。','唯一三元组aa b把b改a，答案1。'],lambda r:''.join(r.choice('abc') for _ in range(r.randint(3,8))),lambda s:s+'\n',lambda s:str(replace_oracle(s)),
'''def solve(d):
    s=d[0];counts={s[-1]:1};answer=0
    for i in range(len(s)-2,-1,-1):
        c=s[i]
        if c==s[i+1]:answer+=len(s)-i-1-counts.get(c,0);counts={c:len(s)-i-1}
        counts[c]=counts.get(c,0)+1
    return str(answer)
''',[('把已经相同的也计操作','len(s)-i-1-counts.get(c,0)','len(s)-i-1'),('只替换紧邻的一个字符','answer+=len(s)-i-1-counts.get(c,0)','answer+=int(len(s)-i-1>counts.get(c,0))')],[('a'*200000,'0'),('aabb'*50000,'9999900000')])


def price_oracle(a):
    total=0;full=[]
    for i,v in enumerate(a):
        discount=next((w for w in a[i+1:] if w<=v),None)
        if discount is None:total+=v;full.append(i)
        else:total+=v-discount
    return str(total)+'\n'+str(len(full))+(' '+' '.join(map(str,full)) if full else '')


add(7,'右侧首个不高于原价的折扣','每件商品减去其右侧第一个价格不高于自己的商品价格；若不存在，则按原价卖。输出总售价及原价售出商品的0起始下标，升序。',
'第一行n（1..100000），第二行n个价格（1..10⁸）。','从右向左维护单调栈，弹掉比当前价高的元素后，栈顶就是右侧第一个不高于当前价的价格。','弹出的更贵商品不可能给当前商品折扣；同时被更靠左且不更贵的商品遮挡，未来也不再需要。栈顶因此恰为最近合法折扣，逐件统计即得总价。',
'时间O(n)，空间O(n)。',[[2,3,1,2,4,2],[5,5],[1,2,3]],['各售价为1、2、1、0、2、2，总和8；下标2和5原价售出。','第一件被第二件完全抵扣，只剩第二件原价5，下标1。','右边都更贵，三件均原价，总和6，下标0、1、2。'],lambda r:[r.randint(1,20) for _ in range(r.randint(1,15))],array,price_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));stack=[];total=0;full=[]
    for i in range(len(a)-1,-1,-1):
        while stack and stack[-1]>a[i]:stack.pop()
        if stack:total+=a[i]-stack[-1]
        else:total+=a[i];full.append(i)
        stack.append(a[i])
    full.reverse()
    return str(total)+'\\n'+str(len(full))+(' '+' '.join(map(str,full)) if full else '')
''',[('严格小于才折扣','stack[-1]>a[i]','stack[-1]>=a[i]'),('全部原价出售','total+=a[i]-stack[-1]','total+=a[i]')],[([10**8]*100000,'100000000\n1 99999')],output='第一行输出总售价。第二行先输出原价商品数量，再按升序输出对应下标。')


def locations_oracle(x):
    board,k=x;houses=[(i,j) for i,row in enumerate(board) for j,v in enumerate(row) if v]
    return str(sum(v==0 and all(abs(i-a)+abs(j-b)<=k for a,b in houses) for i,row in enumerate(board) for j,v in enumerate(row)))


add(8,'距离所有房屋都足够近的空地','网格0为空地，1为房屋。可在空地建店，要求与每所房屋的曼哈顿距离都不超过K。求合适空地数；没有房屋时所有空地都满足。',
'本站输入：第一行R C K（1≤R,C≤500，0≤K≤1000），随后R行各C个0或1。','对所有房屋维护x+y和x−y的最小、最大值；检查每块空地与四个极值的差是否均≤K。','曼哈顿距离等于x+y和x−y两种变换坐标差绝对值的最大值。与所有房屋的最大距离只由这四个极值决定，因此检查四个不等式充要。',
'时间O(RC)，空间O(RC)。',[([[1,0],[0,0]],1),([[0]],0),([[1]],2)],['只有房屋右方和下方两块空地距离1，右下角距离2不符，答案2。','没有房屋，唯一空地满足所有限制，答案1。','只有房屋没有空地，答案0。'],lambda r:([[r.randint(0,1) for _ in range(4)] for _ in range(3)],r.randint(0,7)),lambda x:f'{len(x[0])} {len(x[0][0])} {x[1]}\n'+''.join(' '.join(map(str,row))+'\n' for row in x[0]),locations_oracle,
'''def solve(d):
    rows,cols,k=map(int,d[:3]);a=list(map(int,d[3:]));houses=[(i//cols+i%cols,i//cols-i%cols) for i,v in enumerate(a) if v]
    if not houses:return str(rows*cols)
    minp=min(p for p,q in houses);maxp=max(p for p,q in houses);minq=min(q for p,q in houses);maxq=max(q for p,q in houses);answer=0
    for index,v in enumerate(a):
        i,j=divmod(index,cols);p=i+j;q=i-j
        if v==0 and max(p-minp,maxp-p,q-minq,maxq-q)<=k:answer+=1
    return str(answer)
''',[('把房屋也当可建空地','if v==0 and','if True and'),('漏掉距离边界','<=k','<k')],[(([[0]*500 for _ in range(500)],0),'250000'),(([[1]*500 for _ in range(500)],1000),'0')])


def graph_input(x):
    n,edges=x;return f'{n} {len(edges)}\n'+''.join(f'{a+1} {b+1}\n' for a,b in edges)
def random_graph(r):
    n=r.randint(1,7);return n,[edge for edge in itertools.combinations(range(n),2) if r.random()<.35]


add(9,'给图节点赋值后的最大边和','把1..N分别赋给N个顶点，每个值恰用一次。求所有边两端点值之和的最大总和。原站样例边数组长度不符，本站按文字中的四条边重新给出输入。',
'本站输入：第一行N M（1≤N≤100000，0≤M≤200000），随后M行无向边u v，编号1..N，保证简单图。',
'每个节点赋值会在总和里出现度数次，把较大的值分配给较大的度数即可。','若度数d1<d2却给前者更大值v1>v2，交换后总和增加(d2−d1)(v1−v2)≥0。不断交换得到度数与值同序配对最优。',
'时间O(N log N+M)，空间O(N)。',[(5,[(1,2),(1,0),(0,3),(1,3)]),(1,[]),(3,[(0,1),(1,2)])],['度数排序为0、1、2、2、3，依次乘1、2、3、4、5，总和31。','没有边，任何赋值总和都是0。','中心赋3，两端赋1、2，边和4+5=9。'],random_graph,graph_input,lambda x:str(max(sum(values[a]+values[b] for a,b in x[1]) for values in itertools.permutations(range(1,x[0]+1)))),
'''def solve(d):
    n,m=map(int,d[:2]);degree=[0]*n;edges=list(map(int,d[2:]))
    for v in edges:degree[v-1]+=1
    degree.sort()
    return str(sum((i+1)*v for i,v in enumerate(degree)))
''',[('把最大值给最小度数','degree.sort()','degree.sort(reverse=True)'),('赋值从0开始','(i+1)*v','i*v')],[((100000,[(0,i) for i in range(1,100000)]),'14999850000')])


def balance_oracle(x):
    s,start=x;n=len(s);mask=sum((c=='a')<<i for i,c in enumerate(s));queue=[(start,mask,0)];seen={(start,mask)}
    for p,bits,d in queue:
        if bits.bit_count()*2==n:return str(d)
        for dest,edge in ((p-1,p-1),(p+1,p)):
            if 0<=dest<=n:
                state=(dest,bits^(1<<edge))
                if state not in seen:seen.add(state);queue.append((*state,d+1))
    return '-1'


add(10,'移动棋子让a与b数量相同','棋子位于0..N中的一个位置，字母在相邻位置之间。每走一步翻转跨过的a/b，求让两种字母数量相同的最少步数，不可能则−1。',
'第一行字母串L（1..100，只含a/b），第二行start（0..N）。','一条边最终是否翻转仅由终点与起点是否在它两侧决定；枚举向左和向右直走的每个终点并检查字母数平衡。','回走同一条边两次抵消，任何走法最终翻转的边恰是起点到终点之间的连续段。直达终点的距离最小，所以枚举所有直线路径已覆盖全部可能最终状态。奇数长度不可能平分。',
'时间O(N)，额外空间O(1)。',[('aaabab',0),('aaabab',6),('ababa',1)],['向右跨第一条a，变为baabab，两种各3个，答案1。','向左5步翻转下标1..5，得到abbaba，两种各3个；更短无法平衡，答案5。','字母总数5是奇数，无法分成相同数量，输出−1。'],lambda r:(''.join(r.choice('ab') for _ in range(8)),r.randint(0,8)),lambda x:x[0]+'\n'+str(x[1])+'\n',balance_oracle,
'''def solve(d):
    s=d[0];start=int(d[1]);difference=s.count('a')-s.count('b');answer=10**9
    if difference==0:return '0'
    for direction in (-1,1):
        delta=difference;pos=start;steps=0
        while 0<=pos+direction<=len(s):
            edge=pos if direction==1 else pos-1;delta+=-2 if s[edge]=='a' else 2;pos+=direction;steps+=1
            if delta==0:answer=min(answer,steps)
    return str(answer if answer<10**9 else -1)
''',[('只允许右移','(-1,1)','(1,)'),('将a翻转方向算反',"-2 if s[edge]=='a' else 2","2 if s[edge]=='a' else -2")],[(('a'*100,0),'50'),(('a'*99,50),'-1'),(('ab'*50,50),'0')])


add(11,'相邻进位后的剩余单块数','从左到右处理各堆，每两块合成一块加入右邻堆，当前堆最多留下一个。超出原数组时继续进位，直到不能合并。求最后有一块的堆数。',
'本站输入：第一行n（1..100000），第二行n个块数（0..10⁹）。','维护进位carry，当前总数v+carry的奇偶决定是否留一块，一半进位到下一堆，最后继续处理carry的二进制位。','当前堆的两两合并结果唯一：余数为模2、进位为整除2。逐堆处理不影响已经确定的左边，因此等价完成所有操作；末尾进位的每个1位对应一堆剩余块。',
'时间O(n+log M)，不计标准输入解析时额外空间O(1)，M为最大输入块数。',[[5,3,1],[0],[2]],['总数逐堆为5、5、3，均留1，最后carry=1再留1，共4。','没有块，答案0。','两块向右合成一块，只留下1堆。'],lambda r:[r.randint(0,20) for _ in range(r.randint(1,12))],array,lambda a:str(sum(v<<i for i,v in enumerate(a)).bit_count()),
'''def solve(d):
    from itertools import islice
    carry=answer=0
    for value in map(int,islice(d,1,None)):total=value+carry;answer+=total%2;carry=total//2
    return str(answer+carry.bit_count())
''',[('忽略末尾进位','answer+carry.bit_count()','answer'),('不接受上一堆进位','total=value+carry','total=value')],[([1]*100000,'100000'),([2]*100000,'100000'),([536870912],'1')])


def ordered_oracle(x):
    n,edges=x;graph=[[] for _ in range(n)]
    for a,b in edges:graph[a].append(b);graph[b].append(a)
    current=0
    while current<n-1:
        if current+1 not in graph[current]:return '0'
        current+=1
    return '1'


add(12,'是否存在按编号逐个经过的路径','判断图中是否存在直接边构成的路径1—2—…—N，必须按升序经过所有顶点，不能用中间绕路替代相邻编号的直接边。',
'本站输入：第一行N M（1≤N≤100000，0≤M≤200000），随后M行简单无向边u v，编号1..N。','收集端点差为1的边，检查是否齐全覆盖N−1对相邻编号。','规定路径的每一条边必然是(i,i+1)，所以这些边都存在是必要条件；全部存在时按编号走就是可行路径，也是充分条件。',
'时间O(N+M)，空间O(N+M)。',[(4,[(0,1),(1,2),(3,0),(3,2),(2,0)]),(3,[(0,2),(2,1)]),(1,[])],['1—2、2—3、3—4均存在，输出1。','缺少直接边1—2，尽管图连通也不能按规定走，输出0。','单个顶点已构成路径，不需要边，输出1。'],random_graph,graph_input,ordered_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);edges=list(map(int,d[2:]));adjacent=set()
    for i in range(0,len(edges),2):
        a,b=edges[i:i+2]
        if abs(a-b)==1:adjacent.add(min(a,b))
    return str(int(len(adjacent)==n-1))
''',[('只检查边数是否足够','len(adjacent)==n-1','m>=n-1'),('要求多一条相邻边','len(adjacent)==n-1','len(adjacent)==n')],[((100000,[(i,i+1) for i in range(99999)]),'1')])


def robot_oracle(board):
    rows=len(board);cols=len(board[0]);directions=[(0,1),(1,0),(0,-1),(-1,0)];edges={}
    for i in range(rows):
        for j in range(cols):
            for d,(di,dj) in enumerate(directions):
                a,b=i+di,j+dj;edges[i,j,d]=(a,b,d) if 0<=a<rows and 0<=b<cols and board[a][b]=='.' else (i,j,(d+1)%4)
    current=(0,0,0);visited=set();cells=set()
    while current not in visited:visited.add(current);cells.add(current[:2]);current=edges[current]
    return str(len(cells))


add(13,'清洁机器人最终清扫格数','机器人从左上角朝右出发，前方空格则前进，否则原地顺时针转90度，持续重复。经过的空格算已清洁，可重复经过。求无限运行后不同清洁格数。',
'第一行N M（1..1000），随后N行长度M的字符串，.为空格、X为障碍；保证起点(0,0)为空格。','记录位置和方向组成的状态，遇到重复状态时停止；用单独标记记录不同访问格。','运动完全由当前位置、方向和固定地图决定，重复状态之后会循环，不会再发现新格。总状态只有4NM个，因此在有限模拟后即可得到全部清洁格。',
'时间O(NM)，空间O(NM)，使用紧凑字节数组。',[['...X..','....XX','..X...'],['.'],['....']],['机器人在可达的两行三列边界循环，共清洁6个不同格。','四周都阻挡，只原地转向，清洁唯一格，答案1。','可反复沿同一行往返，4格均被清洁。'],lambda r:['.'+''.join(r.choice('.X') for _ in range(3))]+[''.join(r.choice('.X') for _ in range(4)) for _ in range(2)],lambda b:f'{len(b)} {len(b[0])}\n'+'\n'.join(b)+'\n',robot_oracle,
'''def solve(d):
    rows,cols=map(int,d[:2]);board=d[2:];seen=bytearray(rows*cols*4);clean=bytearray(rows*cols);i=j=direction=answer=0;moves=((0,1),(1,0),(0,-1),(-1,0))
    while not seen[(i*cols+j)*4+direction]:
        seen[(i*cols+j)*4+direction]=1
        if not clean[i*cols+j]:clean[i*cols+j]=1;answer+=1
        di,dj=moves[direction];a,b=i+di,j+dj
        if 0<=a<rows and 0<=b<cols and board[a][b]=='.':i,j=a,b
        else:direction=(direction+1)%4
    return str(answer)
''',[('原地转向也重复计清洁','if not clean[i*cols+j]:','if True:'),('逆时针转向','(direction+1)%4','(direction-1)%4')],[(['.'*1000 for _ in range(1000)],'3996'),(['.'*1000],'1000')])


def compressed(s):
    lengths=[sum(1 for _ in group) for _,group in itertools.groupby(s)]
    return sum(1 if n==1 else len(str(n))+1 for n in lengths)
def compression_oracle(x):
    s,k=x;return str(min(compressed(s[:i]+s[i+k:]) for i in range(len(s)-k+1)))


add(14,'删除连续片段后的最短游程编码','恰好删除K个连续字符，然后将每段重复字符编码为次数加字符；长度1的段只写字符。求编码最短长度。原站第二例计算不符，本站独立重算。',
'本站输入：第一行1..100000个大写字母，第二行K（0..N）。','预计算所有前缀、后缀编码长度和边界连续段长度。枚举删除位置，若两侧边界字符相同，就将它们的两个段合并后更新编码长度。','删除后只有接缝处的段可能合并，其他段保持不变。因此前后缀长度相加，再扣掉边界两段、加上合并段长度，恰等于该次删除的完整编码长度。枚举所有位置取最小即可。',
'时间O(N log N)（计算十进制位数），空间O(N)。',[('ABBBCCDDCCC',3),('ABCDDDCEFG',2),('AAAA',4)],['删除DDC，得到ABBBCCCC，编码A3B4C长度5。','最短长度为7，例如删除BC得到ADDDCEFG，编码A3DCEFG；原站的6少计了字符。','删掉全部字符，编码为空，长度0。'],lambda r:(''.join(r.choice('ABC') for _ in range(12)),r.randint(0,12)),lambda x:x[0]+'\n'+str(x[1])+'\n',compression_oracle,
'''def solve(d):
    s=d[0];k=int(d[1]);n=len(s);left=[0]*n;right=[0]*n;prefix=[0]*(n+1);suffix=[0]*(n+1)
    def cost(v):return 0 if v==0 else 1 if v==1 else len(str(v))+1
    for i,c in enumerate(s):
        left[i]=left[i-1]+1 if i and s[i-1]==c else 1;prefix[i+1]=prefix[i]+cost(left[i])-cost(left[i]-1)
    for i in range(n-1,-1,-1):
        right[i]=right[i+1]+1 if i+1<n and s[i+1]==s[i] else 1;suffix[i]=suffix[i+1]+cost(right[i])-cost(right[i]-1)
    answer=n
    for start in range(n-k+1):
        end=start+k;length=prefix[start]+suffix[end]
        if start and end<n and s[start-1]==s[end]:length+=cost(left[start-1]+right[end])-cost(left[start-1])-cost(right[end])
        answer=min(answer,length)
    return str(answer)
''',[('不合并删除接缝','if start and end<n and s[start-1]==s[end]:','if False:'),('把单字母也带次数','else 1 if v==1 else','else 2 if v==1 else')],[(('A'*100000,50000),'6'),(('A'*100000,100000),'0'),(('AB'*50000,2),'99998')])


def circle_oracle(a):
    best=()
    for start in range(len(a)):
        @functools.lru_cache(None)
        def visit(mask,last):
            result=(last,) if abs(a[last]-a[start])<=1 else ()
            for j in range(len(a)):
                if not(mask>>j&1) and abs(a[last]-a[j])<=1:
                    suffix=visit(mask|(1<<j),j)
                    if suffix and len(suffix)+1>len(result):result=(last,)+suffix
            return result
        candidate=visit(1<<start,start)
        if len(candidate)>len(best):best=candidate
    values=[a[i] for i in best];return str(len(values))+'\n'+' '.join(map(str,values))


add(15,'构造最大平衡圆','选择尽可能多的人，把他们围成一个环，相邻身高差不能超过1，首尾也算相邻。输出任意一个最大人数的合法环，允许任意旋转和方向。',
'第一行n（1..200000），第二行n个身高（1..200000）。','一个可选的连续身高区间，其内部每个身高必须至少有两人，两个端点可只有一人。用前缀频次和、下一个频次≤1的位置找最大区间，再升序各取一个、降序输出剩余人。','环若包含最小与最大身高，中间每种身高必须沿环的两条不同路径各出现一次，否则无法从低走到高再返回。反过来，内部频次至少2时，升序一遍再沿剩余人降序返回可以构造合法环。对每个左端，最远合法右端由首个频次≤1的位置确定，正频次使取最远最优；枚举左端得到最大人数。',
'时间O(n+V)，空间O(n+V)，V为最大身高。',[[4,3,5,1,2,2,1],[3,7,5,1,5],[5,1,4]],['可以选1、1、2、2、3共5人，排列为1 2 3 2 1；更高的身高3只有一人，不能作为更大环的内部连接。','两个5组成合法环，其他高度相隔至少2，最大人数2。','4与5相邻，构成2人环；1不能加入，答案人数2。'],lambda r:[r.randint(1,6) for _ in range(r.randint(1,8))],array,circle_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));v=max(a);freq=[0]*(v+2)
    for x in a:freq[x]+=1
    prefix=[0]*(v+2)
    for x in range(1,v+1):prefix[x]=prefix[x-1]+freq[x]
    following=[v+1]*(v+2);last=v+1
    for x in range(v,0,-1):
        following[x]=last
        if freq[x]<=1:last=x
    best=0;lo=hi=1
    for left in range(1,v+1):
        if not freq[left]:continue
        stop=following[left];right=stop if stop<=v and freq[stop]==1 else stop-1;count=prefix[right]-prefix[left-1]
        if count>best:best=count;lo=left;hi=right
    result=list(range(lo,hi+1))
    for x in range(hi,lo-1,-1):result.extend([x]*(freq[x]-1))
    return str(len(result))+'\\n'+' '.join(map(str,result))
''',[('总只选择一个人',"return str(len(result))+'\\n'+' '.join(map(str,result))","return '1\\n'+str(a[0])"),('排序后忽略首尾差',"' '.join(map(str,result))","' '.join(map(str,sorted(result)))")],[([1]*200000,'200000\n'+' '.join(['1']*200000)),(list(range(1,200001)),'2\n1 2'),([1]+[x for x in range(2,100001) for _ in range(2)]+[100001],'200000\n'+' '.join(map(str,list(range(1,100002))+list(range(100000,1,-1)))))],checker='oa-balanced-circle',output='第一行人数k；第二行k个身高。必须使用输入中实际拥有的人数，任意最大合法环均接受。')


add(16,'首个大写字母之前的小写种类数','只考虑严格位于第一个大写英文字母之前的文本，统计其中不同小写英文字母数；没有大写字母就考虑全文。原站aaAbcCABBc的例子按此定义应为1，本站已校正。',
'本站输入：一行长度0..100000的ASCII可打印文本，可含空格；只把A..Z与a..z视为字母。','扫描遇到首个大写就停止，之前的小写加入集合。','扫描范围恰好是定义的前缀，集合去掉重复，因此集合大小就是不同小写字母种数。','时间O(N)，空间O(26)。',['aaAbcCABBc','abca','XYZ'],['首个大写A之前只有aa，不同小写只有a，答案1。','没有大写，全文不同小写为a、b、c，答案3。','首字符已是大写，前缀为空，答案0。'],lambda r:''.join(r.choice('abcXYZ 09') for _ in range(r.randint(0,50))),lambda s:s+'\n',lambda s:str(len(set(c for c in s[:next((i for i,c in enumerate(s) if 'A'<=c<='Z'),len(s))] if 'a'<=c<='z'))),
'''def solve(d):
    seen=set()
    for c in d:
        if 'A'<=c<='Z':break
        if 'a'<=c<='z':seen.add(c)
    return str(len(seen))
''',[('遇到大写后继续统计',"if 'A'<=c<='Z':break","if False:break"),('重复小写也计数','return str(len(seen))',"return str(sum('a'<=c<='z' for c in d))")],[('a'*100000,'1'),('abcdefghijklmnopqrstuvwxyz'*3846+'abcd','26')],raw=True)


def similar_oracle(x):
    key,text=x;answer=0
    for i in range(len(text)-len(key)+1):
        sub=text[i:i+len(key)];possible=[sub]+[sub[:j]+sub[j+1]+sub[j]+sub[j+2:] for j in range(len(sub)-1)]
        if key in possible:answer+=1
    return str(answer)


add(17,'最多一次相邻交换的相似子串','若两个字符串相等，或交换其中一对相邻字符后相等，则相似。统计text中与key相似的连续子串数量，允许重叠，每个起点仅计一次。',
'第一行key，第二行text，均为小写英文字母，1≤|key|≤|text|≤50。','生成key本身与所有一次相邻交换后的不同字符串，再枚举text中等长窗口查询集合。','相邻交换可逆，因此窗口能一次交换成为key等价于它属于key的一次交换集合。集合避免重复方案导致同一起点重复计数，窗口枚举覆盖全部起点。','时间O(|key|²+|text|·|key|)，空间O(|key|²)。',[('moon','monomon'),('aaa','aaaa'),('xxy','zxxyxyx')],['mono交换末尾两字母、omon交换开头两字母均得到moon，共2个起点。','两个长度3窗口都等于aaa，无需交换，各计一次，答案2。','起点1的xxy和起点2、4的xyx都相似，共3个。'],lambda r:(lambda s:(''.join(r.choice('abc') for _ in range(r.randint(1,len(s)))),s))(''.join(r.choice('abc') for _ in range(r.randint(1,12)))),lambda x:x[0]+'\n'+x[1]+'\n',similar_oracle,
'''def solve(d):
    key,text=d;variants={key}
    for i in range(len(key)-1):variants.add(key[:i]+key[i+1]+key[i]+key[i+2:])
    return str(sum(text[i:i+len(key)] in variants for i in range(len(text)-len(key)+1)))
''',[('只接受完全相等','in variants','==key'),('遗漏最后窗口','range(len(text)-len(key)+1)','range(len(text)-len(key))')],[(( 'a'*25,'a'*50),'26'),(('z','z'*50),'50')])


def or_oracle(a):
    answer=0
    for i in range(len(a)):
        value=0
        for j in range(i,len(a)):value|=a[j];answer+=value in a
    return str(answer)


add(18,'按位或结果出现在原数组的子数组','统计非空连续子数组，其所有元素按位或的结果必须等于原数组中某个元素（该元素不必在当前子数组内）。原站[1,6,7]漏算，按定义答案为6。',
'本站输入：第一行n（1..100000），第二行n个正整数（1..10⁹）。','维护所有以当前位置结尾的不同OR及其出现次数。新增元素与上一轮各OR再或一次，合并相同状态后统计结果在全局值集合中的次数。','每个结束于当前位置的子数组，要么是单元素，要么在上一个结尾子数组后追加当前值。转移一一覆盖并按计数合并，不重不漏。OR只会增添二进制位，因此每轮不同状态至多约31种。','时间O(30n)，空间O(n+30)。',[[1,6,7],[2,4,7],[1]],['三段单元素、两段长度2及整段的OR都在{1,6,7}中，因此共6段。','只有[2,4]的OR=6不在原数组，其余5段合法。','唯一子数组的OR为1，答案1。'],lambda r:[r.randint(1,31) for _ in range(r.randint(1,12))],array,or_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));allowed=set(a);previous={};answer=0
    for value in a:
        current={value:1}
        for old,count in previous.items():key=old|value;current[key]=current.get(key,0)+count
        answer+=sum(count for key,count in current.items() if key in allowed);previous=current
    return str(answer)
''',[('丢失同OR的子数组次数','sum(count for key,count in current.items() if key in allowed)','sum(1 for key in current if key in allowed)'),('把或误写成与','old|value','old&value')],[([1]*100000,'5000050000'),([1<<(i%30) for i in range(100000)],'100000')])


def boards_oracle(a):
    for length in range(1,max(a)-min(a)+2):
        if any(all(x<=v<=x+length or y<=v<=y+length for v in a) for x in a for y in a):return str(length)


add(19,'两块等长木板覆盖孔洞','两块木板必须具有相同的正整数长度L，放在X时覆盖闭区间[X,X+L]。求覆盖全部不同孔洞坐标所需的最小L，允许木板重叠或其中一块不覆盖孔。',
'第一行N（1..100000），第二行N个不同坐标（0..10⁹），可未排序。','排序后枚举两块木板覆盖的左右分组边界，长度至少是两组跨度的较大值，并至少为1。','一块木板覆盖连续坐标区间，因此任意可行方案都能按排序顺序分为由两板各覆盖的一段。固定分界时每段两端跨度就是所需最小长度；枚举全部分界即得全局最优。','时间O(N log N)，空间O(N)。',[[11,20,15],[15,20,9,11],[9]],['一板覆盖11..15，另一板覆盖20，最短长度4。','分为9..11和15..20，较大跨度5，答案5。','即使只有一个孔，长度也必须为正，答案1。'],lambda r:r.sample(range(21),r.randint(1,7)),array,boards_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]));answer=max(1,a[-1]-a[0])
    for i in range(1,len(a)):answer=min(answer,max(1,a[i-1]-a[0],a[-1]-a[i]))
    return str(answer)
''',[('允许长度0','max(1,','max(0,'),('按格数多算1','a[i-1]-a[0],a[-1]-a[i]','a[i-1]-a[0]+1,a[-1]-a[i]+1')],[(list(range(100000)),'49999'),([0,500000000,1000000000],'500000000')])


add(20,'两个数组的公平分割数','公平下标K把A和B分别切成两个非空段，要求四个段的和全部相等。统计公平下标数量，K范围1..N−1。原站部分说明把下标写错，本站逐例校正。',
'本站输入：第一行N（1..100000），第二行A，第三行B，各N个整数（−10⁹..10⁹）。','先比较两个数组总和，必须相等且为偶数；再同步累计两个前缀，统计两者都等于总和一半的位置。','四段全相等必使两总和相等且每个前缀占其一半。反之两个前缀都达到同一半值时，两个后缀也等于该值，因此条件充要。只检查非空切分。','时间O(N)，额外空间O(1)。',[([4,-1,0,3],[-2,5,0,3]),([2,-2,-3,3],[0,0,4,-4]),([4,-1,0,3],[-2,6,0,4])],['K=2和K=3时四段和均为3，因此数量2。','仅K=2合法，四段和全为0；原站写K=1不正确，数量仍为1。','两数组总和分别6与8，无法让四段相等，答案0。'],lambda r:([r.randint(-4,4) for _ in range(8)],[r.randint(-4,4) for _ in range(8)]),arrays,lambda x:str(sum(sum(x[0][:i])==sum(x[0][i:])==sum(x[1][:i])==sum(x[1][i:]) for i in range(1,len(x[0])))),
'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));total=sum(a)
    if total!=sum(b) or total%2:return '0'
    left=right=answer=0
    for i in range(n-1):
        left+=a[i];right+=b[i]
        if left==right==total//2:answer+=1
    return str(answer)
''',[('只检查前缀相等','left==right==total//2','left==right'),('错误计入空后缀','range(n-1)','range(n)')],[(([0]*100000,[0]*100000),'99999'),(([10**9]*100000,[10**9]*100000),'1'),(([1,1,2],[1,1,2]),'1')])


next(spec for spec in SPECS if spec['id']==7)['edges'].append((list(range(99900001,100000001)),'9995000050000\n100000 '+' '.join(map(str,range(100000)))))
next(spec for spec in SPECS if spec['id']==8)['edges'].append((([[(i+j)%2 for j in range(500)] for i in range(500)],1000),'125000'))
next(spec for spec in SPECS if spec['id']==9)['edges'].append(((100000,[(i,(i+delta)%100000) for delta in (1,2) for i in range(100000)]),'20000200000'))
next(spec for spec in SPECS if spec['id']==12)['edges'].append(((100000,[(i,(i+delta)%100000) for delta in (1,2) for i in range(100000)]),'1'))


def clockwise_spiral(size):
    # Carve a non-touching clockwise path; every carved cell is reached on the first inward pass.
    board=[bytearray(b'X'*size) for _ in range(size)]
    row=col=direction=0;board[0][0]=46;count=1
    directions=((0,1),(1,0),(0,-1),(-1,0))
    def legal(a,b):
        return 0<=a<size and 0<=b<size and board[a][b]==88 and all(
            not(0<=a+dr<size and 0<=b+dc<size) or (a+dr,b+dc)==(row,col) or board[a+dr][b+dc]==88
            for dr,dc in directions)
    while True:
        a,b=row+directions[direction][0],col+directions[direction][1]
        if not legal(a,b):
            direction=(direction+1)%4
            a,b=row+directions[direction][0],col+directions[direction][1]
            if not legal(a,b):break
        row,col=a,b;board[row][col]=46;count+=1
    return [line.decode() for line in board],count


spiral_board,spiral_cells=clockwise_spiral(999)
assert spiral_cells==499999
next(spec for spec in SPECS if spec['id']==13)['edges'].append((spiral_board,str(spiral_cells)))


def execute_many(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(path,p.stderr)
    outputs=json.loads(p.stdout)
    assert len(outputs)==len(inputs),(path,'missing batch output')
    return outputs


def matches(spec,actual,expected,value):
    if spec.get('checker')!='oa-balanced-circle':return actual.split()==expected.split()
    try:tokens=list(map(int,actual.split()));truth=int(expected.split()[0])
    except (ValueError,IndexError):return False
    if not tokens or tokens[0]!=truth or len(tokens)!=truth+1:return False
    circle=tokens[1:]
    return bool(circle) and not(collections.Counter(circle)-collections.Counter(value)) and all(abs(circle[i]-circle[(i+1)%len(circle)])<=1 for i in range(len(circle)))


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[]
    selected=set(map(int,sys.argv[1:]))
    if selected:
        entries=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(x['id'].split('-')[-1]) not in selected]
        reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(x['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['id'] not in selected:continue
        identifier=f"oa-microsoft-{spec['id']}";rng=random.Random(20260925+spec['id']);reader='sys.stdin.read().removesuffix("\\n")' if spec.get('raw') else 'sys.stdin.read().split()'
        code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code);oracles=[];values=spec['samples']+[spec['random'](rng) for _ in range(160)]
        for value in values:
            stdin=spec['encode'](value);expected=spec['oracle'](value)
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        formal=list(zip(values[:3],[x['expectedOutput'].strip() for x in oracles[:3]]))+spec['edges']+list(zip(values[3:31],[x['expectedOutput'].strip() for x in oracles[3:31]]));cases=[]
        for index,(value,expected) in enumerate(formal):
            stdin=spec['encode'](value)
            cases.append(dict(name=f'样例 {index+1}' if index<3 else f'边界与组合 {index-2}',input=stdin,expectedOutput=expected+'\n',hidden=index>=3,weight=1))
        outputs=execute_many(path,[x['input'] for x in oracles+cases])
        for index,(actual,test,value) in enumerate(zip(outputs,oracles+cases,values+[x[0] for x in formal])):
            assert matches(spec,actual,test['expectedOutput'],value),(identifier,index,test['expectedOutput'],actual[:200])
        mutants=[];controls=[]
        for index,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code;changed=code.replace(old,new);control=OUT/'negative-controls'/f'{identifier}-{index}.py';control.write_text(changed);rejected=[]
            mutant_outputs=execute_many(control,[x['input'] for x in cases])
            for i,((value,expected),actual) in enumerate(zip(formal,mutant_outputs)):
                if not matches(spec,actual,expected,value):rejected.append(i)
            assert rejected,(identifier,name,'survived');mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Microsoft'],description=spec['desc']+'\n\n输入协议、本站补充范围、样例及测试由CSWork独立编写。',input=spec['input'],output=spec.get('output','输出一个整数答案。'),explanation='\n\n'.join(f'样例{i+1}：{note}' for i,note in enumerate(spec['notes'])),hints=[spec['idea']],timeLimit=4,memoryLimit=262144,outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracles),'oracle;',len(cases)-3,'hidden; all negative controls exit normally and are rejected',flush=True)
    entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=entries),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=20260925,problems=reports,note='Independent local batch checks: one isolated subprocess per authored program; fresh runpy __main__ globals and stdin/stdout per input, not per-input OS isolation. Every negative control exits normally. Per-input real sandbox evidence is still required.'),ensure_ascii=False,indent=2)+'\n')
    reviews=[]
    for spec in SPECS:
        reviews.append(dict(id=f"oa-microsoft-{spec['id']}",status='authored',reason=spec['desc'] if spec['id'] in (2,3,6,9,14,16,18,20) else '按明确题意独立编写参考解、证明、暴力oracle和正常退出负控；未给范围的题明确标注本站输入约束。'))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
