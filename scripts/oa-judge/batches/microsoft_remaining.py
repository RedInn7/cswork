"""Independently authored Microsoft 41–60; never execute imported solutions."""
from collections import Counter, deque
from functools import lru_cache
from itertools import combinations, product
from pathlib import Path
import hashlib,json,random,subprocess,sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='microsoft-remaining';SPECS=[]
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,random=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def gap_oracle(x):
    a,k=x;m=len(a)//3;states={tuple(sorted(a))}
    for _ in range(k):
        nxt=set(states)
        for s in states:
            for i in range(len(a)):
                for delta in (-1,1):b=list(s);b[i]+=delta;nxt.add(tuple(sorted(b)))
        states=nxt
    return max(s[-m]-s[m-1] for s in states)
add(41,'最多K次加减后的三分位最大差','每次给任意一个元素加1或减1，最多做K次。N能被3整除，最大化第N/3大元素减第N/3小元素。','第一行N K；第二行N个整数。N为3..150000的3倍数，K为0..500000000，元素为−300000000..300000000。','排序后只需降低最小N/3个数的最大值，或提高最大N/3个数的最小值。两侧每提高差值1的代价都是当前极值组大小；代价随扩展单调增加，用堆合并两侧的代价段，优先购买便宜的增量。','达到给定较低分位时，选原本最小的一组降低代价最小；上分位同理，两组互不相交。每侧极值跨越下一个数值时组大小增大，边际代价非递减。把两条有序代价序列归并，前缀花费最小，因此预算内购买的差值增量最多。','时间O(N log N)，空间O(N)。',[([6]*6,3),([1,2,3],2),([8,8,8,7,7,7,7,7,7,7,-8,-8],1)],'样例1：需要同时改两个6才能让分位变化1，3步只能增加1。样例2：原差2，再把1降到−1，差4。样例3：把一个7改8，上分位从7变8，下分位仍7，差1。',lambda r:([r.randint(-2,2) for _ in range(r.choice((3,6)))],r.randint(0,3)),[(([0]*150000,500000000),10000),(([-300000000]*50000+[0]*50000+[300000000]*50000,500000000),600010000)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',gap_oracle,
'''def solve(d):
    from bisect import bisect_right
    import heapq
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));m=n//3;answer=a[-m]-a[m-1]
    sides=[sorted(-v for v in a[:m]),a[-m:]];heap=[]
    for side,b in enumerate(sides):heap.append((bisect_right(b,b[0]),side,b[0]))
    heapq.heapify(heap)
    while k and heap:
        count,side,level=heapq.heappop(heap);b=sides[side];distance=b[count]-level if count<m else k+1
        increase=min(distance,k//count);answer+=increase;k-=increase*count
        if increase<distance:break
        level+=increase;heapq.heappush(heap,(bisect_right(b,level),side,level))
    return str(answer)
''',[('忽略分位移动代价','k//count','k'),('漏原始差','answer=a[-m]-a[m-1]','answer=0')],1650030,time=6)

def merge_oracle(a):
    def visit(i):
        if i==len(a):return 0
        return max(a[i]+visit(i+1),int(str(a[i])+str(a[i+1]))+visit(i+2) if i+1<len(a) else -1)
    return visit(0)
add(44,'不重叠相邻数字拼接的最大总和','可以将两个原始相邻元素按十进制拼接，但每个原始元素至多用一次，拼接产物不能再参与拼接。求最后元素总和最大值。','第一行N（1..10000），第二行N个0..200整数。0也占一位，拼接02的数值是2。','前缀DP：最后一个元素单独保留，或者最后两个原始元素拼成一项，取两种总和较大值。','任何合法划分的最后一组只能含1或2个原始元素。去掉它得到更短前缀的合法最优子问题，两种递推穷尽所有可能且保证无重叠。','时间O(N)，除输入外空间O(1)。',[[2,2,3,5,4,0],[3,19,191,91,3],[0,0,1]],'样例1：22+35+40=97。样例2：保留3，拼19191和913，总20107。样例3：可拼01但值仍1，最大总和1。',lambda r:[r.randint(0,200) for _ in range(r.randint(1,9))],[([200]*10000,1001000000),([0]*10000,0)],arr,merge_oracle,
'''def solve(d):
    prev2=prev=0;last=0
    for token in d[1:]:
        value=int(token);current=max(prev+value,prev2+last*(10**len(token))+value);prev2,prev=prev,current;last=value
    return str(prev)
''',[('零位数错误','10**len(token)','10**(0 if value==0 else len(token))'),('错误仅按两位数拼接','10**len(token)','10')],40010)

def domino_oracle(a):
    return len(a)-max([0]+[len(ids) for size in range(1,len(a)+1) for ids in combinations(range(len(a)),size) if all(a[i][1]==a[j][0] for i,j in zip(ids,ids[1:]))])
add(46,'删除最少骨牌形成匹配链','骨牌顺序不能改变，也不能旋转。删除一些骨牌，使相邻保留骨牌的右点数等于下一块左点数，求最少删除数。','第一行N，随后N行left right，点数1..6。源没有N上界，本站1≤N≤200000。','dp[v]保存以点数v结尾的最长合法子序列。遇到(l,r)，用旧dp[l]+1更新dp[r]，其余状态不变。','合法子序列若使用当前骨牌，其前一块必以l结尾；不使用当前骨牌则保留旧状态。所有合法选择都在递推中，最长保留数与最少删除数互补。','时间O(N)，除输入外空间O(1)。',[[(2,4),(1,3),(4,6),(2,4),(1,6)],[(1,1)]*3,[(1,2),(3,4)]],'样例1：保留(2,4),(4,6)两块，删3块。样例2：三块可以全部相接，删0。样例3：无法相接，保留任意一块，删1。',lambda r:[(r.randint(1,3),r.randint(1,3)) for _ in range(r.randint(1,9))],[([(1,1)]*200000,0),([(1,2)]*200000,199999)],lambda a:str(len(a))+'\n'+''.join(f'{l} {r}\n' for l,r in a),domino_oracle,
'''def solve(d):
    n=int(d[0]);dp=[0]*7
    for i in range(1,len(d),2):
        left,right=int(d[i]),int(d[i+1]);candidate=dp[left]+1;dp[right]=max(dp[right],candidate)
    return str(n-max(dp))
''',[('允许旋转','dp[right]=max(dp[right],candidate)','dp[right]=max(dp[right],candidate);dp[left]=max(dp[left],dp[right])'),('忽略匹配','candidate=dp[left]+1','candidate=max(dp)+1')],800010)

def digit_oracle(x):
    s,t=x;best=None
    for mask in range(1<<len(s)):
        a=''.join(t[i] if mask>>i&1 else s[i] for i in range(len(s)));b=''.join(s[i] if mask>>i&1 else t[i] for i in range(len(s)));value=(abs(int(a)-int(b)),mask.bit_count())
        if best is None or value<best:best=value
    return best[1]
add(47,'两整数差值最小时的最少同位交换','两串长度相同且无前导零。一次可交换两串同一个位置的数字。先要求最终数值差绝对值最小，再在这些方案中使交换次数最少。','两行S、T，长度1..100000，字符0..9，无前导零。','首个不同位置决定大小，之后所有不同位置都应反向抵消这一差值。分别计算保持首位不交换、交换首位两种方案的交换次数，取较小。','首个不同位至少贡献一个当前位权，所有后位差值总和严格小于它，无法改变大小关系。固定该位方向后，每个后位独立选择反向贡献才能使绝对差最小。两种首位方向互为整串交换，差相同，比较其最少交换次数即可。','时间O(N)，除输入外空间O(1)。',[('29162','10524'),('123','123'),('19','21')],'样例1：交换第2和4位得20122与19564，差558，共2次。样例2：本来相同，无需交换。样例3：个位已经抵消十位差，原差2最小，0次。',lambda r:(str(r.randint(10**(n-1),10**n-1)),str(r.randint(10**(n-1),10**n-1))) if (n:=r.randint(1,7)) else None,[(('9'*100000,'1'*100000),1),(('1'+'9'*99999,'2'+'0'*99999),0)],lambda x:'\n'.join(x)+'\n',digit_oracle,
'''def solve(d):
    s,t=d;direction=0;same=opposite=0
    for a,b in zip(s,t):
        if a==b:continue
        sign=1 if a>b else -1
        if not direction:direction=sign
        elif sign==direction:same+=1
        else:opposite+=1
    return str(min(same,opposite+1) if direction else 0)
''',[('不考虑首位反转','min(same,opposite+1)','same'),('首位交换不计次数','opposite+1','opposite')],200004)

def bridge_oracle(x):
    a,cap=x
    return len(a)-max([0]+[len(ids) for size in range(1,len(a)+1) for ids in combinations(range(len(a)),size) if all(a[i]<=cap for i in ids) and all(a[i]+a[j]<=cap for i,j in zip(ids,ids[1:]))])
add(48,'双车桥的最少删车数','车辆按原顺序上桥，每辆离开后下一辆进入，桥上最多相邻两辆。可以预先删除车辆，剩余相对顺序不变，求避免总重量超过容量的最少删除数。单车重量也不能超载。','第一行N capacity，第二行N个重量。N为1..100000，重量1..10⁹；源未给容量界，本站1..2×10⁹。','扫描并保留当前最后一辆。单车超载直接删；若与最后一辆合计超载，必须删两者之一，保留较轻者；否则接在后面。','相邻两辆超载时至少删一辆，保留较轻的不会降低未来兼容性。若替换旧尾车，新车更轻，和旧尾之前车辆也仍兼容。交换论证使每步选择可扩展为最优方案。','时间O(N)，除输入外空间O(1)。',[([3,5,2,6,1],8),([3,7,2,6,1],8),([9,2,2],4)],'样例1：所有相邻和≤8，删0。样例2：删7后3、2、6、1均兼容，删1。样例3：9单独就超载，删掉后2+2恰好4，删1。',lambda r:([r.randint(1,12) for _ in range(r.randint(1,9))],r.randint(1,15)),[(([10**9]*100000,10**9),99999),(([10**9]*100000,2*10**9),0)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',bridge_oracle,
'''def solve(d):
    capacity=int(d[1]);last=None;removed=0
    for token in d[2:]:
        weight=int(token)
        if weight>capacity:removed+=1;continue
        if last is not None and last+weight>capacity:removed+=1;last=min(last,weight)
        else:last=weight
    return str(removed)
''',[('冲突保留更重','last=min(last,weight)','last=max(last,weight)'),('不接受刚好容量','last+weight>capacity','last+weight>=capacity')],1100030)

def balance_oracle(rows):
    empty=[(i,j) for i in range(2) for j in range(len(rows[0])) if rows[i][j]=='?'];best=10**9
    for changes in product('?RW',repeat=len(empty)):
        grid=[list(s) for s in rows]
        for (i,j),v in zip(empty,changes):grid[i][j]=v
        if all(row.count('R')==row.count('W') for row in grid) and all(sum(grid[i][j]=='R' for i in range(2))==sum(grid[i][j]=='W' for i in range(2)) for j in range(len(rows[0]))):best=min(best,sum(v!='?' for v in changes))
    return -1 if best==10**9 else best
add(49,'两行红白数量平衡的最少替换','把部分?替成R或W，可保留其余?。要求每一行以及每一列的R数与W数相等，求最少替换次数；无法做到输出−1。','第一行N，随后两行长N的R/W/?字符串。源未给数字范围，本站1≤N≤100000。','单边?必须补成对侧相反颜色，固定同色列直接无解。双?暂留空；完成强制填充后，若上行R比W多d，就用d个双?列填上W下R，反之亦然。','两格列只能为RW、WR或??。单?列的填法唯一。双?列每次花2步让上行差值改变1；因此至少需要|差值|列，并且有足够空列时这样填就达到下界，下行同步平衡。','时间O(N)，除输入外空间O(1)。',[('WR???','R???W'),('R','R'),('??','??')],'样例1：先补两处单?，再用一列双?平衡行计数，共4次。样例2：固定同色列无法平衡，−1。样例3：全?时两种颜色均0，已平衡，0次。',lambda r:tuple(''.join(r.choice('RW?') for _ in range(n)) for _ in range(2)) if (n:=r.randint(1,5)) else None,[(('R'*50000+'?'*50000,'W'*50000+'?'*50000),100000),(('R'*100000,'W'*100000),-1)],lambda x:str(len(x[0]))+'\n'+'\n'.join(x)+'\n',balance_oracle,
'''def solve(d):
    n=int(d[0]);a,b=d[1:];difference=empty=answer=0
    for x,y in zip(a,b):
        if x==y=='?':empty+=1;continue
        if x==y:return '-1'
        if x=='?':x='W' if y=='R' else 'R';answer+=1
        if y=='?':answer+=1
        difference+=1 if x=='R' else -1
    return str(answer+2*abs(difference)) if abs(difference)<=empty else '-1'
''',[('双问号只算一步','answer+2*abs(difference)','answer+abs(difference)'),('忽略空列容量','if abs(difference)<=empty','if True')],200015)

def red_oracle(s):
    q=deque([(s,0)]);seen={s}
    while q:
        t,cost=q.popleft();positions=[i for i,v in enumerate(t) if v=='R']
        if not positions or positions[-1]-positions[0]+1==len(positions):return cost
        for i in range(len(t)-1):
            if t[i]!=t[i+1]:
                u=t[:i]+t[i+1]+t[i]+t[i+2:]
                if u not in seen:seen.add(u);q.append((u,cost+1))
add(51,'相邻交换聚拢全部红球','每步交换相邻两球，使所有R形成一个连续段，W可在两侧。求最少交换次数；超过10⁹时输出−1。来源样例的交换过程改变了球数，本站按明确的相邻交换规则校正。','一行R/W串。源范围写1..100000，但正文明确要求RW重复100000次的测试；本站保留该情形，支持长度1..200000。','红球原位置p[i]保持相对顺序，目标为连续位置start+i；令b[i]=p[i]−i，最小化到同一start的绝对距离和，取中位数。','同色球无需互换，按原顺序匹配目标位置可避免交叉。每次相邻红白交换让一红球移动一步，总代价恰是位移和；绝对距离和在中位数最小。b已非递减，中位数可直接取得。','时间O(N)，空间O(N)。',['WRRWR','WWRWWWWWWWWWRWR','WWW'],'样例1：交换最后的WR即可得到WRRRW，只需1步，源答案2已校正。样例2：红球位于2、12、14，移到11、12、13需9+0+1=10步，源答案4已校正。样例3：没有红球，0步。',lambda r:''.join(r.choice('RW') for _ in range(r.randint(1,9))),[('RW'*100000,-1),('R'*100000+'W'*100000,0)],lambda s:s+'\n',red_oracle,
'''def solve(d):
    positions=[]
    for i,c in enumerate(d[0]):
        if c=='R':positions.append(i-len(positions))
    if not positions:return '0'
    middle=positions[len(positions)//2];answer=sum(abs(v-middle) for v in positions)
    return str(answer if answer<=1000000000 else -1)
''',[('不减目标相对位置','i-len(positions)','i'),('漏掉超限返回','answer if answer<=1000000000 else -1','answer')],200001)

def stacks_oracle(a):return sum(int(c) for c in bin(sum(v*(2**i) for i,v in enumerate(a)))[2:])
add(52,'相邻栈二换一后的最少代币','无限多个从0编号的栈，给出前N个栈高度，其余为空。每次可从一栈拿走2枚，给下一栈增加1枚。求任意次数操作后的最少代币总数。','第一行N，第二行N个高度。源未给数值界，本站1≤N≤200000，高度0..10⁹。','从低位到高位处理carry：当前高度加进位，奇数余1，其余除2送到下一栈；输入结束后继续处理进位的二进制位。','每枚位于i的代币权值2^i，操作不改变总权值并使枚数减1。最终每栈至多1枚，恰为总权值唯一二进制表达；任何非这种状态都还有可减少枚数的操作，因此最优。','时间O(N+log最大高度)，除输入外空间O(1)。',[[2,3],[0,0],[3]],'样例1：总权值2+3×2=8，最终第3栈1枚。样例2：没有代币，0枚。样例3：3枚可变为第0、1栈各1枚，共2枚。',lambda r:[r.randint(0,12) for _ in range(r.randint(1,10))],[([0]*200000,0),([1]*200000,200000)],arr,stacks_oracle,
'''def solve(d):
    carry=answer=0
    for i in range(1,len(d)):
        carry+=int(d[i]);answer+=carry%2;carry//=2
    return str(answer+carry.bit_count())
''',[('漏最后进位','answer+carry.bit_count()','answer'),('每个非空栈直接留一','answer+=carry%2','answer+=int(carry>0)')],2200010)

def chain_oracle(rows):
    from itertools import permutations
    for order in permutations(rows):
        if all(a[1]==b[0] for a,b in zip(order,order[1:])):return ''.join(x[2] for x in order)
def chain_random(r):
    n=r.randint(1,7);rows=[(f'k{i}',f'k{i+1}',r.choice(['a','b',' ',' a '])) for i in range(n)];r.shuffle(rows);return rows
add(53,'按首尾键唯一链接后拼接内容','记录(start,end,payload)组成唯一一条链，前一条end等于后一条start。输入已打乱，按链顺序拼接payload；内容里的空格须原样保留。','第一行N，之后每条记录两行：start end、完整payload。1≤N≤200000；源未限定字符串，本站键为1..12个ASCII字母数字，payload为0..10个可见ASCII字符或空格。保证所有记录恰好构成一条无环、无分支链。','用start映射记录，找不出现在end集合的起始键，从它沿end逐条走并收集payload，最后一次拼接。','唯一链的首键无前驱，其他起始键均有前驱，因此起点唯一。每次按end查下一条正好满足规定顺序，走N步恰覆盖全部记录，拼接即答案。','时间O(输入字节数)，空间O(输入字节数+N)。',[[('aaa','bbb','2'),('bbb','ccc','1'),('ccc','ddd','3')],[('p','q','X')],[('b','c','b '),('a','b',' a')]],'样例1：链aaa→bbb→ccc→ddd，拼成213。样例2：唯一记录输出X。样例3：先a→b再b→c，拼成带首尾空格的“ ab ”。',chain_random,[([(f'k{i+1}',f'k{i+2}','x') for i in range(199999,-1,-1)],'x'*200000),([(f'k{i}',f'k{i+1}','') for i in range(200000)],'')],lambda rows:str(len(rows))+'\n'+''.join(f'{a} {b}\n{c}\n' for a,b,c in rows),chain_oracle,
'''def solve(d):
    lines=d.split('\\n');n=int(lines[0]);records={};ends=set()
    for i in range(n):
        start,end=lines[1+2*i].split();records[start]=(end,lines[2+2*i]);ends.add(end)
    current=next(key for key in records if key not in ends);result=[]
    for _ in range(n):end,payload=records[current];result.append(payload);current=end
    return ''.join(result)
''',[('反转链内容顺序',"''.join(result)","''.join(reversed(result))"),('错误裁去内容空格','result.append(payload)','result.append(payload.strip())')],7400010,raw=True,checker='exact',output='输出完整拼接内容及一个结束换行；内容为空时输出空行。',memory=524288)

def path_oracle(x):
    a,b=x;return min(max(a[:i+1]+b[i:]) for i in range(len(a)))
add(54,'两行路径最大值的最小可能值','从上行首格到下行末格，只能右移或下移，最小化路径经过数字中的最大值。','第一行N，随后两行分别A、B。源未给数值界，本站1≤N≤200000，数字−10⁹..10⁹。','维护上行前缀最大、下行后缀最大。枚举唯一向下移动的列，路径最大值为两者较大值，取所有列中的最小值。','每条合法路径恰有一次向下移动，此前经过上行前缀、此后经过下行后缀。每个下移列都对应唯一合法路径，枚举它们即可不重不漏地取最优。','时间O(N)，空间O(N)。',[([3,4,6],[6,5,4]),([1,2,1,1,1,4],[1,1,1,3,1,1]),([-3],[-5])],'样例1：在中列下移，经过3、4、5、4，最大5。样例2：在下行3的右边下移，避开上行4，最大2。样例3：必须经过−3和−5，最大为−3。',lambda r:([r.randint(-5,9) for _ in range(n)],[r.randint(-5,9) for _ in range(n)]) if (n:=r.randint(1,9)) else None,[(([10**9]*200000,[-10**9]*200000),10**9),(([-10**9]*200000,[-10**9]*200000),-10**9)],lambda x:str(len(x[0]))+'\n'+'\n'.join(' '.join(map(str,a)) for a in x)+'\n',path_oracle,
'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:n+1]));b=list(map(int,d[n+1:]));suffix=[0]*n;suffix[-1]=b[-1]
    for i in range(n-2,-1,-1):suffix[i]=max(b[i],suffix[i+1])
    prefix=a[0];answer=10**30
    for i in range(n):prefix=max(prefix,a[i]);answer=min(answer,max(prefix,suffix[i]))
    return str(answer)
''',[('错误把路径最大改最小','max(prefix,suffix[i])','min(prefix,suffix[i])'),('忽略负数','prefix=a[0]','prefix=0')],4800010)

def notification_oracle(x):
    s,k=x
    if len(s)<=k:return s
    words=s.split();valid=['...']
    for i in range(1,len(words)):
        candidate=' '.join(words[:i])+' ...'
        if len(candidate)<=k:valid.append(candidate)
    return max(valid,key=len)
add(55,'按整词裁剪通知','消息由单空格分隔的英文单词组成。超过K字符时，从末尾删掉若干整词，并添加“ ...”（空格加三个ASCII句点）；无词能保留则只显示“...”。求最长合法通知。源样例的省略号空格存在矛盾，按正文明确的单空格规则校正。','第一行K（3..500），第二行message（1..500字符），仅英文字母与空格，无首尾或连续空格。','先判断整条是否放得下。否则依次保留前缀单词，只要前缀长度加4不超过K就继续，最终补省略号；一个也放不下则返回三个点。','通知必须是原消息的整词前缀加后缀。前缀长度随保留词数严格增加，最长不超限前缀就是最优；整条消息无需后缀时优先完整显示。','时间O(消息长度)，空间O(消息长度)。',[('And now here is my secret',15),('super dog',4),('how are you',20)],'样例1：保留And now后加空格与三个点，输出“And now ...”；再保留here会长16。样例2：任何词加后缀都超4，只能“...”。样例3：整句长11，不超过20，原样返回。',lambda r:(' '.join(''.join(r.choice('abcXYZ') for _ in range(r.randint(1,6))) for _ in range(r.randint(1,8))),r.randint(3,35)),[('a'*500,3),('a '*249+'a',500)],lambda x:f'{x[1]}\n{x[0]}\n',notification_oracle,
'''def solve(d):
    first,message=d.split('\\n',1);k=int(first)
    if len(message)<=k:return message
    chosen=[];length=0
    for word in message.split(' '):
        candidate=length+len(word)+(1 if chosen else 0)
        if candidate+4>k:break
        chosen.append(word);length=candidate
    return ' '.join(chosen)+' ...' if chosen else '...'
''',[('遗漏省略号前空格',"+' ...'","+'...'"),('容量判断漏一个空格','candidate+4>k','candidate+3>k')],505,raw=True,checker='exact',output='输出完整通知及一个结束换行。')

def business_oracle(x):
    rows,k=x;remaining={i for i,v in enumerate(rows) if v[2]};result=[]
    while remaining and len(result)<k:
        chosen=next(i for i in remaining if all((-rows[i][0],rows[i][1],i)<=(-rows[j][0],rows[j][1],j) for j in remaining));remaining.remove(chosen);result.append(chosen)
    return ' '.join(map(str,result))
add(57,'营业商家的前K名','只选营业商家，依次按评分降序、距离升序、原输入下标升序排名。返回前K个下标，营业数不足时全部返回。','第一行N K，随后N行score distance isOpen。源未给范围，本站1≤N≤100000，0≤K≤100000，评分0..10⁹，距离0..10⁹，营业标记0或1。','过滤未营业商家，按三个排名关键字排序，取前K个下标。','过滤恰好排除所有不可选项；排序逐级使用题目规定的比较优先级，所得前缀就是唯一合法的前K名。','时间O(N log N)，空间O(N)。',[([(90,4,1),(95,8,0),(90,2,1),(85,1,1)],2),([(80,3,1),(80,2,1),(90,10,1)],5),([(10,1,0)],1)],'样例1：下标1关闭，2与0同分但2更近，输出2 0。样例2：营业仅3家，全返回2 1 0。样例3：没有营业商家，输出空行。',lambda r:([(r.randint(0,9),r.randint(0,9),r.randrange(2)) for _ in range(r.randint(1,9))],r.randint(0,10)),[(([(10**9,10**9,1)]*100000,100000),' '.join(map(str,range(100000)))),(([(0,0,0)]*100000,100000),'')],lambda x:f'{len(x[0])} {x[1]}\n'+''.join(f'{a} {b} {c}\n' for a,b,c in x[0]),business_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);rows=[tuple(map(int,d[i:i+3])) for i in range(2,len(d),3)];order=sorted((i for i in range(n) if rows[i][2]),key=lambda i:(-rows[i][0],rows[i][1],i))
    return ' '.join(map(str,order[:k]))
''',[('让关闭商家参选','if rows[i][2]','if True'),('距离优先级反向','rows[i][1],i','-rows[i][1],i')],2400020,output='按排名输出至多K个0-based下标；没有结果输出空行。')

def reverse_tree_oracle(x):
    n,edges=x;best=n
    for mask in range(1<<(n-1)):
        graph=[[] for _ in range(n)]
        for i,(a,b) in enumerate(edges):
            if mask>>i&1:a,b=b,a
            graph[a].append(b)
        ok=True
        for start in range(n):
            seen={start};q=[start]
            for v in q:
                for w in graph[v]:
                    if w not in seen:seen.add(w);q.append(w)
            if 0 not in seen:ok=False;break
        if ok:best=min(best,mask.bit_count())
    return best
def tree_random(r):
    n=r.randint(2,8);edges=[]
    for i in range(1,n):
        p=r.randrange(i);edges.append((i,p) if r.randrange(2) else (p,i))
    return n,edges
add(58,'让所有城市到达首都的最少反向道路','无向底图为树，每条边目前单向。允许反转边，使全部城市能到0号首都，求最少反转数。','第一行N（2..50000），随后N−1行a b，代表a→b；0≤a,b<N，a≠b，保证底图是一棵树。','从0沿无向树遍历。父子边若原方向从父到子，就必须反转；子到父则保留。累加前一种边数。','每个非根城市到根只有唯一无向路径，路径上的边都必须朝向父亲；因此每条边最终方向唯一。算法正好统计原方向与所需方向不同的边，既必要又充分。','时间O(N)，空间O(N)。',[(6,[(0,1),(1,3),(2,3),(4,0),(4,5)]),(5,[(1,0),(1,2),(3,2),(3,4)]),(3,[(1,0),(2,0)])],'样例1：0→1、1→3、4→5须反转，共3。样例2：1→2与3→4须反转，共2。样例3：所有边已指向0，0次。',tree_random,[((50000,[(i,i+1) for i in range(49999)]),49999),((50000,[(i,0) for i in range(1,50000)]),0)],lambda x:str(x[0])+'\n'+''.join(f'{a} {b}\n' for a,b in x[1]),reverse_tree_oracle,
'''def solve(d):
    n=int(d[0]);graph=[[] for _ in range(n)]
    for i in range(1,len(d),2):
        a,b=int(d[i]),int(d[i+1]);graph[a].append((b,1));graph[b].append((a,0))
    stack=[(0,-1)];answer=0
    while stack:
        v,parent=stack.pop()
        for w,cost in graph[v]:
            if w!=parent:answer+=cost;stack.append((w,v))
    return str(answer)
''',[('反转方向判断相反','answer+=cost','answer+=1-cost'),('仅判断根的邻边','if w!=parent:','if w!=parent and v==0:')],600010)

def top_oracle(x):
    a,k=x;ids=list(range(len(a)));selected=[]
    for _ in range(k):
        i=max(ids,key=lambda j:(a[j],-j));ids.remove(i);selected.append(i)
    return ' '.join(str(a[i]) for i in sorted(selected))
add(59,'前K大元素按原序返回','选择数组中最大的K个元素并按原始相对顺序输出。相等值跨越截断位置时优先选择最早出现者，保证恰好K个。上述规则在源题两段样例解释中完整写明。','第一行N K，第二行N个整数。源只给0≤K≤N，本站1≤N≤100000，元素−10⁹..10⁹。','按值降序、下标升序挑K个下标，再将这些下标升序排列并输出对应元素。','第一次排序严格遵循大值优先、同值最早规则，选定的集合正确；第二次按原下标排序仅恢复原相对顺序，不改变所选元素。','时间O(N log N)，空间O(N)。',[([5,1,3,5,2],3),([4,4,4,2],2),([1,2],0)],'样例1：选下标0、2、3，按原序输出5 3 5。样例2：三个4中取最早两个，输出4 4。样例3：K为0，输出空行。',lambda r:([r.randint(-4,5) for _ in range(n)],r.randint(0,n)) if (n:=r.randint(1,10)) else None,[((list(range(100000)),100000),' '.join(map(str,range(100000)))),(([10**9]*100000,0),'')],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',top_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));ids=sorted(range(n),key=lambda i:(-a[i],i))[:k]
    return ' '.join(str(a[i]) for i in sorted(ids))
''',[('输出排序后而非原序','for i in sorted(ids)','for i in ids'),('错误选最小K项','(-a[i],i)','(a[i],i)')],1200020,output='按原相对顺序输出恰好K个值，K为0时输出空行。')

BLOCKED={42:'未说明两个区域能否重叠。3×3十字网格 #.# / ... / #.#：允许横纵交叉取并集可用5格；两个区域必须不相交则至多4格，无法确定唯一答案。',43:'正文说最多K次，样例2却因只有3个非5而K=4判IMPOSSIBLE，表示恰好K次；替换目标是否只能5亦未明确，不能用互相矛盾的例子擅选规则。',45:'正文截断于smallest number of lette，仅banana一例暗示删除成有序，缺完整目标与操作定义。',50:'正文仅Giv，三例暗示划分无重复子串，但没有明确完整目标和操作规则。',56:'good pair定义截断于0，缺合法下标条件；也没有模数或精确大整数输出要求，不能从两例确定完整规则。',60:'正文没有定义反转结果超出32位时的输出，样例却明确强调结果在32位内才返回；不能擅自采用返回0或无限宽整数。'}
NOTES={49:'按行列红白计数相等允许保留?；源奇数列样例也需要这一点。原例替换说明错误，本站独立构造4步结果；无解明确为−1。',51:'正文相邻交换规则明确，源WRRWR真实最优1而非2，第二例最优10而非4；正文RW重复100000次要求20万长度，本站不缩为表格10万上界。',55:'正文明确省略号前三个ASCII点与末词之间要一个空格，源例遗漏空格已按此规则纠正。',59:'完整样例解释已给出前K大、原序和同值最早规则，按该明确描述整理标准输入。'}
def xor_oracle(cases):
    answers=[]
    for a in cases:
        result=1
        for i in range(len(a)):
            for j in range(i+1,len(a)):result=result*(a[i]^a[j])%1000000007
        answers.append(str(result))
    return '\n'.join(answers)
add(56,'全部下标对异或值的乘积','对所有0≤i<j<N计算A[i] XOR A[j]，把这些结果相乘，对1000000007取模。每组数据独立。原始快照完整给出下标条件与模数，旧导入器错误删除了含小于号的文字，本站已恢复。','第一行T（1..10）。每组先一行N（2..100000），再一行N个整数（1..3000）。','有重复值时存在异或为0的因子，答案立即为0。否则对长度4096的值频率做整数异或沃尔什变换、逐项平方、再次变换并除4096，得到每种异或值的有序对数；非零异或的无序对数为其一半，按计数做模幂乘积。','异或变换把异或卷积变成逐点乘积，逆变换给出满足x XOR y=v的有序对数。v非零时没有同下标，交换两端恰好形成两个有序对，故除2即i<j计数。对各v分组相乘等价于原全部因子乘积；重复值的0因子分支也准确。','时间O(各组N之和+T·4096 log4096+T·4096 logN)，空间O(4096)，不计输入解析。',[[[1,2,3,7]],[[4,3,7]],[[2,2],[1,2]]],'样例1：六个因子3、2、6、1、5、4相乘为720。样例2：三个因子7、3、4相乘为84。样例3：第一组相同值异或为0，输出0；第二组唯一因子为3，输出3。',lambda r:[[r.randint(1,30) for _ in range(r.randint(2,10))] for _ in range(r.randint(1,4))],[([[3000]*100000]*10,'\n'.join(['0']*10))],lambda cases:str(len(cases))+'\n'+''.join(arr(a) for a in cases),xor_oracle,
'''def solve(d):
    cursor=1;answers=[];mod=1000000007;size=4096
    def transform(a):
        width=1
        while width<size:
            for start in range(0,size,2*width):
                for i in range(start,start+width):
                    x,y=a[i],a[i+width];a[i]=x+y;a[i+width]=x-y
            width*=2
    for _ in range(int(d[0])):
        n=int(d[cursor]);cursor+=1;freq=[0]*size;duplicate=False
        for i in range(cursor,cursor+n):
            v=int(d[i]);duplicate|=freq[v]>0;freq[v]+=1
        cursor+=n
        if duplicate:answers.append('0');continue
        transform(freq)
        for i in range(size):freq[i]*=freq[i]
        transform(freq);answer=1
        for v in range(1,size):answer=answer*pow(v,freq[v]//size//2,mod)%mod
        answers.append(str(answer))
    return '\\n'.join(answers)
''',[('重复元素错误返回一',"if duplicate:answers.append('0')","if duplicate:answers.append('1')"),('有序对未除二','freq[v]//size//2','freq[v]//size')],5000083,time=6,memory=524288,output='每组输出一行模1000000007后的乘积。')
BLOCKED.pop(56)
NOTES[56]='原导入器把含0 <= i < j < N的正文误当HTML删除。已依据不可变原始仓库快照e66f809f4c953bce129f68491726176615db6afc恢复全部i<j与模1000000007规则，保留T≤10、N≤100000、值≤3000完整约束。'
for spec in SPECS:
    if spec['n']==56:
        # Independent explicit pair product, evaluated once; not the transform reference.
        full=list(range(1,3001));expected=xor_oracle([full]);spec['edges'].append(([full]*10,'\n'.join([expected]*10)))
    if spec['n']==41:spec['edges'].append(((list(range(150000)),500000000),94721))
    if spec['n']==52:spec['edges'].append(([10**9]*200000,200000))
    if spec['n']==53:spec['edges'][0]=([(f'k{i+1:011d}',f'k{i+2:011d}','x'*10) for i in range(199999,-1,-1)],'x'*2000000)
    if spec['n']==55:spec['edges']=[(('a'*500,3),'...'),(('a '*249+'a',500),'a '*249+'a')]
def execute_many(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);return json.loads(p.stdout)
def matches(spec,actual,expected):return actual.replace('\r\n','\n')==expected.replace('\r\n','\n') if spec.get('checker')=='exact' else actual.split()==expected.split()
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};selected=set(map(int,sys.argv[1:]));entries=[];reports=[]
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(x['id'].split('-')[-1]) not in selected];reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(x['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['n'] not in selected:continue
        identifier=f"oa-microsoft-{spec['n']}";rng=random.Random(20261300+spec['n']);reader='sys.stdin.read().removesuffix("\\n")' if spec.get('raw') else 'sys.stdin.read().split()';code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)];oracles=[dict(input=spec['encode'](value),expectedOutput=str(spec['oracle'](value))+'\n') for value in values];formal=list(zip(values[:3],[c['expectedOutput'] for c in oracles[:3]]))+[(value,str(answer)+'\n') for value,answer in spec['edges']]+list(zip(values[3:27],[c['expectedOutput'] for c in oracles[3:27]]));cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=spec['encode'](value),expectedOutput=answer,hidden=i>=3,weight=1) for i,(value,answer) in enumerate(formal)]
        assert spec['bound']<=33554432
        for c in cases+oracles:assert len(c['input'].encode())<=spec['bound'],(identifier,'input budget',len(c['input'].encode()))
        for i,(case,actual) in enumerate(zip(oracles+cases,execute_many(path,[c['input'] for c in oracles+cases]))):assert matches(spec,actual,case['expectedOutput']),(identifier,i,actual[:160],case['expectedOutput'][:160])
        controls=[];mutants=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code;changed=code.replace(old,new);negative=OUT/'negative-controls'/f'{identifier}-{index}.py';negative.write_text(changed);outputs=execute_many(negative,[c['input'] for c in cases]);rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if not matches(spec,a,c['expectedOutput'])];assert rejected,(identifier,label,'survived');controls.append(dict(name=label,rejectedByCases=rejected));mutants.append(dict(name=label,code=changed))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Microsoft'],description=spec['desc']+'\n\n本站标准输入输出协议；来源未给出的范围已明确标注。',input=spec['limits'],output=spec.get('output','输出一个整数答案。'),explanation=spec['explain'],hints=[spec['idea']],timeLimit=spec.get('time',4),memoryLimit=spec.get('memory',262144),outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True);assert p.returncode==0,(identifier,p.stderr[:1500]);normalized=p.stdout;assert len(normalized.encode())<=128*1024*1024 and '\ufffd' not in normalized
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=spec['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(identifier,'163 independent checks;',len(cases)-3,'hidden; two normal-exit mutants rejected',flush=True)
    entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20261300,problems=reports,skipped={f'oa-microsoft-{i}':v for i,v in BLOCKED.items()},note='Local runpy batched processes, fresh __main__/streams per case; not per-case OS isolation. Real sandbox required. Independent small oracles and normal-exit semantic mutants. Input bounds assume canonical decimal syntax.'),'reviews':dict(schemaVersion=1,items=[dict(id=f'oa-microsoft-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,NOTES.get(i,'正文规则明确，独立参考、暴力小输入、完整最大范围及正常退出错误程序已验证。'))) for i in range(41,61)])}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
