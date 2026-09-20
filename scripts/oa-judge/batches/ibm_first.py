"""Independent IBM authoring, immutable e66f809 statements only; never runs source code."""
from pathlib import Path
from collections import Counter,deque
from itertools import combinations,product
from functools import lru_cache
from math import comb
import json,random,hashlib,subprocess,sys
import amazon_remaining_h as helper
ROOT=helper.ROOT;OUT=helper.OUT;SPECS=[];MOD=1000000007
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def scalar(x):return str(x)+'\n'
add(1,'可选边组成的不同图数量','n个有编号顶点构成无向简单图，无自环、无重边，可不连通，求不同图数量模1000000007。','一行n。来源未给数值界，本站1≤n≤10^9。','每个不同顶点对对应一条独立可选边，快速幂计算2的n(n−1)/2次方。','共有n(n−1)/2个顶点对，每对选有边或无边，所有选择与图一一对应，乘法原理得结论。','时间O(log n)，额外空间O(1)。',[4,1,3],'分别64、1、8；一个顶点只有无边图。',lambda r:r.randint(1,6),[(10**9,pow(2,10**9*(10**9-1)//2,MOD)),(2,2)],scalar,lambda n:sum(1 for _ in product([0,1],repeat=n*(n-1)//2)),"def solve(d):\n    n=int(d[0]);return str(pow(2,n*(n-1)//2,1000000007))\n",[('误算有向边','n*(n-1)//2','n*(n-1)'),('遗漏无边图','str(pow(2,n*(n-1)//2,1000000007))','str((pow(2,n*(n-1)//2,1000000007)-1)%1000000007)')],11)
def team_oracle(a):
    best=0
    for mask in range(1,1<<len(a)):
        b=sorted(a[i] for i in range(len(a)) if mask>>i&1)
        if all(y-x<=1 for x,y in zip(b,b[1:])):best=max(best,len(b))
    return best
add(3,'相邻技能连续的最大团队','选取尽可能多的学生，技能排序后相邻两人差为0或1。可以跨越多个连续技能值，不要求团队最大值减最小值≤1。','第一行n，第二行技能；来源无数值界，本站1≤n≤200000，−10^9≤技能≤10^9。','排序后累计相邻差≤1的整段长度，遇更大间隙重新开始。','跨越大于1的缺失技能间隙无法形成合法团队；同一无间隙段中的所有人同时选入仍合法，且删去任何人都不能增加人数。因此最长整段最优。','时间O(n log n)，空间O(n)。',[[10,12,13,9,14],[1,2,3,4],[5,5,7]],'分别3、4、2。来源题解只统计两个相邻值，和正文及第一例冲突，本站按正文修正。',lambda r:[r.randint(-3,6) for _ in range(r.randint(1,10))],[(list(range(200000)),200000),([10**9]*200000,200000)],arr,team_oracle,"def solve(d):\n    a=sorted(map(int,d[1:]));best=run=1\n    for i in range(1,len(a)):\n        run=run+1 if a[i]-a[i-1]<=1 else 1;best=max(best,run)\n    return str(best)\n",[('重复技能断开','a[i]-a[i-1]<=1','a[i]-a[i-1]==1'),('只数不同技能','return str(best)','return str(len(set(a)))')],2400020)
def parity_oracle(a):
    start=tuple(a);seen={start};q=deque([start])
    while q:
        v=q.popleft()
        for i in range(len(v)-1):
            if (v[i]+v[i+1])%2:
                w=v[:i]+(v[i+1],v[i])+v[i+2:]
                if w not in seen:seen.add(w);q.append(w)
    return seq(min(seen))
add(4,'异奇偶相邻交换后的最小优先级序列','每次只能交换相邻且奇偶不同的两项，求可达到的字典序最小序列。每项为单个数字。','第一行n，第二行数字。来源无长度界，本站1≤n≤200000，0≤数字≤9。','分别取奇数、偶数的原序子序列，每步取两队首中较小者。','同奇偶相对顺序无法变化，任意两子序列的交错都可通过合法交换实现。两队首奇偶不同故不相等，选择较小头使当前首个差异最小，归纳得到全局字典序最小。','时间O(n)，空间O(n)。',[[2,4,6,4,3,2],[9,7,2],[0]],'分别2 3 4 6 4 2；2 9 7；0。',lambda r:[r.randrange(10) for _ in range(r.randint(1,8))],[([9,0]*100000,seq([0]*100000+[9]*100000)),([8,6]*100000,seq([8,6]*100000))],arr,parity_oracle,"def solve(d):\n    a=list(map(int,d[1:]));odd=[v for v in a if v%2];even=[v for v in a if not v%2];i=j=0;out=[]\n    while i<len(odd) and j<len(even):\n        if odd[i]<even[j]:out.append(odd[i]);i+=1\n        else:out.append(even[j]);j+=1\n    out+=odd[i:]+even[j:];return ' '.join(map(str,out))\n",[('内部也排序','odd=[v for v in a if v%2]','odd=sorted(v for v in a if v%2)'),('优先取更大头','odd[i]<even[j]','odd[i]>even[j]')],400020,output='输出完整最小序列。')
def interleave(x):
    a,b=x;out=[]
    while a or b:
        if a:out.append(a[0]);a=a[1:]
        if b:out.append(b[0]);b=b[1:]
    return ''.join(out)
add(5,'交替合并两个密码字符串','依次取a第一个字符、b第一个字符、a第二个字符、b第二个字符，某串用完后追加另一串余下部分。','两行分别为a与b；来源无数值界，本站每串0至100000个ASCII可打印字符（可含空格，但不含换行）。','按下标遍历较长长度，依次检查并追加两串对应字符。','每轮恰好追加尚未处理的下一字符，先a后b，缺项跳过；因此既保持各自顺序，又满足交错和余段规则。','时间O(|a|+|b|)，输出空间O(|a|+|b|)。',[('hackerrank','mountain'),('','abc'),('ab','XYZ')],'正确输出hmaocuknetrariannk；abc；aXbYZ。原站第一例拼写错误已更正。',lambda r:(''.join(r.choice('abc XYZ') for _ in range(r.randint(0,15))),''.join(r.choice('abc XYZ') for _ in range(r.randint(0,15)))),[(('a'*100000,'b'*100000),'ab'*100000),(('',''),'')],lambda x:x[0]+'\n'+x[1]+'\n',interleave,"def solve(d):\n    a,b=d.split('\\n')[:2];out=[]\n    for i in range(max(len(a),len(b))):\n        if i<len(a):out.append(a[i])\n        if i<len(b):out.append(b[i])\n    return ''.join(out)\n",[('丢失较长尾部','max(len(a),len(b))','min(len(a),len(b))'),('颠倒两串','a,b=d.split','b,a=d.split')],200002,raw=True,checker='exact',output='输出合并后的整行字符串，保留空格。')
add(6,'合并两个有序数组','将两个非递减数组合并为非递减数组，保留全部重复元素。','第一行n，第二行a的n项，第三行b的n项。同题raw补充完整范围2≤n≤100000，0≤元素≤10^9。','双指针每次输出两个未处理头部较小值，某数组用完后追加另一数组。','每个未处理数组的头部是该数组最小剩余值，两头较小者就是全部剩余元素最小值；逐项取出不遗漏重复值，归纳得排序合并。','时间O(n)，输出空间O(n)。',[([1,3,5],[2,4,6]),([1,1],[1,1]),([0,9],[0,3])],'分别1 2 3 4 5 6；四个1；0 0 3 9。',lambda r:(lambda n:(sorted(r.randint(0,20) for _ in range(n)),sorted(r.randint(0,20) for _ in range(n))))(r.randint(2,12)),[(([10**9]*100000,[10**9]*100000),seq([10**9]*200000)),((list(range(100000)),list(range(100000))),seq(v for i in range(100000) for v in (i,i)))],lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n',lambda x:seq(sorted(x[0]+x[1])),"def solve(d):\n    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));i=j=0;out=[]\n    while i<n and j<n:\n        if a[i]<=b[j]:out.append(a[i]);i+=1\n        else:out.append(b[j]);j+=1\n    out+=a[i:]+b[j:];return ' '.join(map(str,out))\n",[('去重','map(str,out)','map(str,sorted(set(out)))'),('丢掉剩余元素','out+=a[i:]+b[j:]','out+=[]')],2200030,output='输出合并后的2n项。')
def vowel_encode(x):
    words,queries=x;return f'{len(words)} {len(queries)}\n'+'\n'.join(words)+'\n'+''.join(f'{l}-{h}\n' for l,h in queries)
def vowel_rand(r):
    a=[''.join(r.choice('abceiou') for _ in range(r.randint(1,10))) for _ in range(r.randint(1,12))];q=[]
    for _ in range(r.randint(1,10)):
        l=r.randint(1,len(a));q.append((l,r.randint(l,len(a))))
    return a,q
add(7,'首尾元音字符串的区间计数','每次给1起始闭区间l-r，数其中首字符和末字符都是小写元音aeiou的字符串。单字符元音符合条件。','第一行n q，随后n行非空小写串，再q行l-r。来源无数值界，本站n,q≤100000，总字符≤10^6，1≤l≤r≤n。','给每串标0/1并建前缀和，查询区间做差。','单串标记与定义等价，前缀计数减去l之前的计数，恰好留下闭区间内符合项。','时间O(总输入字符+q)，空间O(n+q)。',[(['aba','bcb','ece','aa','e'],[(1,3),(2,5)]),(['a'],[(1,1)]),(['ab','ba'],[(1,2)])],'分别2 3；1；0。',vowel_rand,[((['a']*100000,[(1,100000)]*100000),seq([100000]*100000)),((['a'*1000000],[(1,1)]),'1')],vowel_encode,lambda x:seq(sum(w[0] in 'aeiou' and w[-1] in 'aeiou' for w in x[0][l-1:h]) for l,h in x[1]),"def solve(d):\n    n,q=map(int,d[:2]);pre=[0]\n    for s in d[2:2+n]:pre.append(pre[-1]+(s[0] in 'aeiou' and s[-1] in 'aeiou'))\n    out=[]\n    for token in d[2+n:]:\n        l,h=map(int,token.split('-'));out.append(pre[h]-pre[l-1])\n    return ' '.join(map(str,out))\n",[('首尾只需一个','and s[-1]','or s[-1]'),('漏左端点','pre[h]-pre[l-1]','pre[h]-pre[l]')],2500030,output='按查询顺序输出q个整数。')
def cache_encode(x):
    entries,queries=x;return f'{len(entries)} {len(queries)}\n'+''.join(f'{t} {k} {v}\n' for t,k,v in entries)+''.join(f'{k} {t}\n' for k,t in queries)
def cache_rand(r):
    pairs=r.sample([(f'00:00:{i:02d}',k) for i in range(20) for k in ['a','b','c']],r.randint(1,15))
    entries=[(t,k,str(r.randint(1,100))) for t,k in pairs];return entries,[(k,t) for t,k in r.choices(pairs,k=r.randint(1,15))]
add(11,'按键和精确时间查询缓存','每条缓存含时间、键、字符串形式的整数值；查询给键和精确时间。每个查询保证存在，同一时间没有重复键。返回对应原值字符串，不是查询最近时间。','第一行n q，随后n行时间key value，最后q行key 时间。1≤n,q≤100000；时间hh:mm:ss合法；值表示1..10^8。来源未限制键/值文本长度，本站键1..64个小写字母数字、值1..64个十进制数字（允许前导0），总输入≤16MiB。','用(时间,键)二元组建立哈希表，查询直接取值。','给定二元组唯一识别缓存记录，哈希表保存每个合法二元组对应原字符串；查询存在的保证使每次读取恰为指定数据。','期望时间O(输入字符数)，空间O(n)。',[([('12:30:22','a','125'),('09:07:47','b','341'),('01:23:09','a','764')],[('a','01:23:09'),('b','09:07:47')]),([('00:00:00','a','0007')],[('a','00:00:00')]),([('00:00:00','a','1'),('00:00:01','a','2')],[('a','00:00:00')])],'分别764 341；0007；1，保留值字符串的前导零。',cache_rand,[(([('00:00:00','k'+str(i),'100000000') for i in range(100000)],[('k'+str(i),'00:00:00') for i in range(100000)]),seq(['100000000']*100000)),(([('23:59:59','a'*64,'0'*63+'1')],[('a'*64,'23:59:59')]*100000),seq(['0'*63+'1']*100000))],cache_encode,lambda x:seq(next(v for t,k,v in x[0] if k==qk and t==qt) for qk,qt in x[1]),"def solve(d):\n    n,q=map(int,d[:2]);table={};pos=2\n    for _ in range(n):\n        t,k,v=d[pos:pos+3];pos+=3;table[(t,k)]=v\n    out=[]\n    for _ in range(q):\n        k,t=d[pos:pos+2];pos+=2;out.append(table[(t,k)])\n    return ' '.join(out)\n",[('丢掉前导零','out.append(table[(t,k)])','out.append(str(int(table[(t,k)])))'),('错误返回固定值','out.append(table[(t,k)])',"out.append('0')")],16777216,output='依查询顺序输出原值字符串。',outputLimit=8192)
def cards_oracle(a):
    return min(sum(next(extra for extra in range(p) if (v+extra)%p==0) for v in a) for p in range(2,max(a)+2))
add(12,'均匀卡包需要补充的最少卡片','有多种卡片，每种给定数量。选择至少2个卡包，通过只增加卡片，使每种卡片能平均分入所有卡包，求最少增加总数。','第一行n，第二行n个数量。1≤n≤100000，1≤数量≤500。','按数量统计频次，枚举包数2至max(2,最大数量)，成本为Σ频次×((包数−数量%包数)%包数)。','固定包数时每类最少补至下个倍数，类之间独立。包数大于最大数量时成本至少n；包数2每类至多补1，总成本不超过n，故无需枚举更大包数。取最小即最优。','时间O(n+500²)，空间O(500)。',[[1,1],[2,4,6],[3,4]],'分别2、0、1。',lambda r:[r.randint(1,12) for _ in range(r.randint(1,8))],[([1]*100000,100000),([500]*100000,0)],arr,cards_oracle,"def solve(d):\n    from collections import Counter\n    counts=Counter(map(int,d[1:]));return str(min(sum(count*((-v)%p) for v,count in counts.items()) for p in range(2,max(2,max(counts))+1)))\n",[('禁止补卡','return str(min(', 'return str(1+min('),('允许单包','range(2,max(2,max(counts))+1)','range(1,max(2,max(counts))+1)')],400020)
def circle_oracle(rows):
    out=[]
    for x,y,r,a,b,s in rows:
        distance=abs((x+y)-(a+b))
        if distance==0:out.append('Concentric')
        elif distance==r+s or distance==abs(r-s):out.append('Touching')
        elif distance>r+s:out.append('Disjoint-Outside')
        elif distance<abs(r-s):out.append('Disjoint-Inside')
        else:out.append('Intersecting')
    return '\n'.join(out)
def circle_rand(r):
    out=[]
    for _ in range(r.randint(1,8)):
        a,b=r.randint(0,20),r.randint(1,20);x,y=(a,0) if r.randrange(2) else (0,a)
        out.append((x,y,r.randint(0,12),b if y==0 and x else 0,0 if y==0 and x else b,r.randint(0,12)))
    return out
add(13,'同轴圆的五种关系','两个圆的圆心同在X轴或同在Y轴（不同时满足两轴），分类输出。同心优先；非同心时一个交点为Touching，两个为Intersecting，外部分离为Disjoint-Outside，内部包含不相交为Disjoint-Inside。半径0合法。','第一行n，随后n行六整数x y R x2 y2 R2。1≤n≤5000，坐标和半径0..5000，同轴保证。','先判圆心相等；否则比较圆心距离平方与半径和平方、半径差平方。','圆周相交的距离条件为|R−r|≤d≤R+r，两端等号恰为相切，中间为两交点；超出范围分别外离或内含。平方对非负数保持大小，同心单独处理避免重合和退化混淆。','时间O(n)，空间O(n)保存输出。',[[(1,0,2,1,0,0)],[(0,1,1,0,3,1),(0,1,2,0,2,2)],[(1,0,0,3,0,1),(1,0,5,2,0,1)]],'分别Concentric；Touching/Intersecting；Disjoint-Outside/Disjoint-Inside。',circle_rand,[([(0,1,5000,0,5000,0)]*5000,'\n'.join(['Disjoint-Inside']*5000)),([(1,0,0,2,0,0)]*5000,'\n'.join(['Disjoint-Outside']*5000))],lambda rows:str(len(rows))+'\n'+''.join(seq(row)+'\n' for row in rows),circle_oracle,"def solve(d):\n    out=[]\n    for i in range(1,len(d),6):\n        x,y,r,a,b,s=map(int,d[i:i+6]);v=(x-a)**2+(y-b)**2\n        if v==0:out.append('Concentric')\n        elif v==(r+s)**2 or v==(r-s)**2:out.append('Touching')\n        elif v>(r+s)**2:out.append('Disjoint-Outside')\n        elif v<(r-s)**2:out.append('Disjoint-Inside')\n        else:out.append('Intersecting')\n    return '\\n'.join(out)\n",[('忽略内切',' or v==(r-s)**2',''),('同心当相交',"if v==0:out.append('Concentric')","if v==0:out.append('Intersecting')")],150010,output='每行一个英文关系名称。')
add(14,'每步下降1的连续子数组数量','只计长度至少2且每相邻元素恰好下降1的连续子数组。','第一行n，第二行整数。来源仅给n≥1，本站n≤200000，−10^9≤元素≤10^9。','维护以当前位置结束的连续下降段长L，新增L−1个合法子数组。','结束于当前位置的合法起点恰为本下降段中当前项之前的位置，共L−1个；不同右端点的区间不重复，累加覆盖全部答案。','时间O(n)，额外空间O(1)。',[[7,6,5,5,4],[4,3,2,1],[9]],'分别4、6、0。',lambda r:[r.randint(-4,5) for _ in range(r.randint(1,15))],[(list(range(200000,0,-1)),19999900000),([1]*200000,0)],arr,lambda a:sum(all(a[k+1]==a[k]-1 for k in range(i,j-1)) for i in range(len(a)) for j in range(i+2,len(a)+1)),"def solve(d):\n    a=list(map(int,d[1:]));run=1;answer=0\n    for i in range(1,len(a)):\n        run=run+1 if a[i]==a[i-1]-1 else 1;answer+=run-1\n    return str(answer)\n",[('所有严格下降都算','a[i]==a[i-1]-1','a[i]<a[i-1]'),('计入单元素','answer=0','answer=len(a)')],2400020)
def powers_oracle(x):
    lo,hi=x;answer=0
    for v in range(lo,hi+1):
        if v<1:continue
        for p in (3,5):
            while v%p==0:v//=p
        answer+=v==1
    return answer
def power_big(lo,hi):return sum(lo<=3**a*5**b<=hi for a in range(41) for b in range(29))
add(15,'区间内3与5的幂乘积数量','统计闭区间[low,high]中能写为3^x×5^y的整数，x,y均非负，1合法，每值只计一次。','一行low high。来源未给数值界，本站−2^63≤low≤high≤2^63−1。','逐层生成不超过high的3的幂与乘5后的值，统计不小于low的值；乘前用除法检查上界。','质因数分解唯一，不同指数对给不同值。循环覆盖所有满足上界的指数组合，没有遗漏和重复，随后下界筛选恰为区间答案。','时间O(log high·log high)，空间O(1)。',[(1,20),(2,2),(-10,1)],'分别5（1、3、5、9、15）、0、1。',lambda r:(a:=r.randint(-10,250),a+r.randint(0,100)),[((-2**63,2**63-1),power_big(-2**63,2**63-1)),((2**63-1,2**63-1),0)],lambda x:seq(x)+'\n',powers_oracle,"def solve(d):\n    lo,hi=map(int,d);answer=0;a=1\n    while a<=hi:\n        v=a\n        while v<=hi:\n            if v>=lo:answer+=1\n            if v>hi//5:break\n            v*=5\n        if a>hi//3:break\n        a*=3\n    return str(answer)\n",[('漏掉1','if v>=lo:','if v>=lo and v!=1:'),('排除右端点','if v>=lo:','if lo<=v<hi:')],42)
def words_encode(a):return str(len(a))+'\n'+'\n'.join(a)+'\n'
add(16,'字母集合相同的字符串对','两个字符串含有的字母集合相同即相似，出现次数不重要；不同下标的相同字符串仍可成对，(i,j)与(j,i)只算一次。','第一行n，随后n行小写字符串。1≤n≤100000，总长度≤10^6。原文未排除空串，本站协议支持空行代表空串。','用26位掩码表示字母集合，逐串累加此前同掩码个数。','每位精确记录该字母是否出现，掩码相等当且仅当集合相同；每个下标对在后出现者被扫描时计数一次。','时间O(总长度+n)，空间O(n)。',[['xyz','foo','of'],['',''],['ab','aab','b','ba']],'分别1、1、3。',lambda r:[''.join(r.choice('abcd') for _ in range(r.randint(0,10))) for _ in range(r.randint(1,12))],[(['a']*100000,4999950000),(['a'*1000000],0)],words_encode,lambda a:sum(set(a[i])==set(a[j]) for i in range(len(a)) for j in range(i+1,len(a))),"def solve(d):\n    lines=d.split('\\n');n=int(lines[0]);freq={};answer=0\n    for s in lines[1:n+1]:\n        mask=0\n        for c in s:mask|=1<<(ord(c)-97)\n        answer+=freq.get(mask,0);freq[mask]=freq.get(mask,0)+1\n    return str(answer)\n",[('按完整单词比较','mask=0\n        for c in s:mask|=1<<(ord(c)-97)','mask=s'),('有序对重复计数','return str(answer)','return str(answer*2)')],1100010,raw=True)
def teams_encode(x):
    a,m,l,h=x;return f'{len(a)} {m} {l} {h}\n'+seq(a)+'\n'
def teams_oracle(x):
    a,m,l,h=x;return sum(len(c)>=m and all(l<=a[i]<=h for i in c) for k in range(len(a)+1) for c in combinations(range(len(a)),k))
add(17,'技能范围内的团队组合总数','从给定玩家中选择至少minPlayers人，每位技能均在[minLevel,maxLevel]内，求不同下标集合的团队数。不取模。','第一行n minPlayers minLevel maxLevel，第二行技能。原文无数值界，本站1≤n≤10000，1≤minPlayers≤n，−10^9≤技能及上下界≤10^9，minLevel≤maxLevel。','先数合格人数m，再递推组合数C(m,k)，累加k≥minPlayers。采用任意精度整数。','有效团队完全是合格下标的子集，大小k有C(m,k)种，不同大小互斥；组合数递推保持精确整除，和即答案。','O(n+m)次整数运算，整数最多O(m)位；空间O(m)位。',[([1,2,3],2,1,3),([5,5,5],1,5,5),([1,2],2,3,4)],'分别4、7、0。相同技能的不同玩家按不同身份计数。',lambda r:(lambda n:([r.randint(-3,5) for _ in range(n)],r.randint(1,n),-1,r.randint(0,5)))(r.randint(1,10)),[(([1]*10000,1,1,1),2**10000-1),(([1]*10000,5000,1,1),(2**10000+comb(10000,5000))//2)],teams_encode,teams_oracle,"def solve(d):\n    n,minimum,lo,hi=map(int,d[:4]);m=sum(lo<=int(v)<=hi for v in d[4:]);choose=1;answer=0\n    for k in range(m+1):\n        if k>=minimum:answer+=choose\n        if k<m:choose=choose*(m-k)//(k+1)\n    return str(answer)\n",[('只计恰好人数','if k>=minimum:','if k==minimum:'),('擅自取模','return str(answer)','return str(answer%1000000007)')],120060)
def moves_oracle(s):
    target=len(set(s));q=deque([(s,0)]);seen={s}
    while q:
        word,step=q.popleft()
        if len(word)==target:return step
        for i,c in enumerate(word):
            left=word.rfind(c,0,i);right=word.find(c,i+1);nxt=''.join(ch for j,ch in enumerate(word) if j not in (left,right))
            if nxt not in seen:seen.add(nxt);q.append((nxt,step+1))
add(18,'删除左右同字母到最短串的最少操作','一次选某字符，删除其左侧最近同字符和右侧最近同字符，某侧不存在则只删另一侧；选中字符自身保留。求达到最短可能字符串的最少操作。','一行非空小写串，长度1..100000。','每个字母至少留一个，频次f需删f−1个，一次最多删2个；选中间出现即可连续两侧删，因此贡献floor(f/2)。','任何操作不影响其他字母且保留选中字母，最短串每字母一个。至少ceil((f−1)/2)步；f≥3时选择非两端出现删2个，剩2时删1个，可达到该下界，各字母相加。','时间O(n)，空间O(26)。',['adabacaea','aaaa','abc'],'分别2、2、0。原文示例索引8/4混写，选择原索引4会删除2和6得到adbacea。',lambda r:''.join(r.choice('abc') for _ in range(r.randint(1,10))),[('a'*100000,50000),('ab'*50000,50000)],scalar,moves_oracle,"def solve(d):\n    from collections import Counter\n    return str(sum(f//2 for f in Counter(d[0]).values()))\n",[('奇数向上取整','f//2','(f+1)//2'),('每次只删一项','f//2','f-1')],100001)
def equal_oracle(x):
    a,k=x;best=0
    for target in range(1,max(a)+1):
        for mask in range(1<<len(a)):
            if mask.bit_count()>k:continue
            if any(mask>>i&1 and a[i]<target for i in range(len(a))):continue
            b=[target if mask>>i&1 else v for i,v in enumerate(a)];best=max(best,b.count(target))
    return best
add(19,'最多修改k队后的等规模队伍数','最多选择k支队伍把人数减少，不能增加，也不能拆出新队。求最终人数相等的队伍数量最大值。','第一行n k，第二行队伍人数。1≤n≤200000，人数1..10^9，0≤k≤10^9。','排序按相同人数v分组，候选为本组人数频次加min(k,严格更大的队伍数)。','固定目标v，小于v者无法加入，本来等于v者免费加入，大于v者每个花一次修改。若最优目标不是现有值，提高到最小已入选原人数不会减少可加入者且可省修改，故仅需枚举现有v。','时间O(n log n)，空间O(n)。',[([1,2,2,3,4],2),([3,3,1],0),([1,2,3],99)],'分别4、2、3。',lambda r:([r.randint(1,7) for _ in range(r.randint(1,8))],r.randint(0,10)),[((list(range(1,200001)),10**9),200000),(([1]*100000+[2]*100000,0),100000)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',equal_oracle,"def solve(d):\n    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));i=0;answer=0\n    while i<n:\n        j=i+1\n        while j<n and a[j]==a[i]:j+=1\n        answer=max(answer,j-i+min(k,n-j));i=j\n    return str(answer)\n",[('把更小队也算可减少','min(k,n-j)','min(k,i)'),('不限制修改数','min(k,n-j)','n-j')],2200040)

from decimal import Decimal
def json_encode(x):
    return (x if isinstance(x,str) else json.dumps(x[0],ensure_ascii=False,separators=(',',':'))+'\n'+json.dumps(x[1],ensure_ascii=False,separators=(',',':')))+'\n'
def json_oracle(x):
    left,right=json_encode(x).split('\n')[:2];a=json.loads(left,parse_float=Decimal,parse_int=Decimal);b=json.loads(right,parse_float=Decimal,parse_int=Decimal)
    def freeze(v):
        if isinstance(v,dict):return ('object',tuple(sorted((k,freeze(w)) for k,w in v.items())))
        if isinstance(v,list):return ('array',tuple(map(freeze,v)))
        return (type(v).__name__,v)
    return json.dumps(sorted(k for k in set(a)|set(b) if k not in a or k not in b or freeze(a[k])!=freeze(b[k])),ensure_ascii=False)
def json_rand(r):
    def value(depth=0):
        kind=r.randrange(7 if depth<3 else 5)
        if kind==0:return None
        if kind==1:return bool(r.randrange(2))
        if kind==2:return r.randint(-10**9,10**9)
        if kind==3:return r.randint(-1000000,1000000)/1000000
        if kind==4:return r.choice(['','a b','中文','😀','\u2028','quote"'])
        if kind==5:return [value(depth+1) for _ in range(r.randrange(4))]
        return {k:value(depth+1) for k in r.sample(['','a','😀','\ue000'],r.randrange(5))}
    a={k:value() for k in r.sample(['a','b','c','','😀','\ue000'],r.randrange(7))};b={k:value() for k in r.sample(['a','b','c','','😀','\ue000'],r.randrange(7))};return a,b
JSON_REF='''def solve(d):
    import json
    from decimal import Decimal
    a,b=[json.loads(line,parse_int=Decimal,parse_float=Decimal) for line in d.split('\\n')[:2]]
    def equal(x,y):
        if type(x) is not type(y):return False
        if isinstance(x,dict):return x.keys()==y.keys() and all(equal(x[k],y[k]) for k in x)
        if isinstance(x,list):return len(x)==len(y) and all(equal(u,v) for u,v in zip(x,y))
        return x==y
    keys=[]
    for k in a.keys()|b.keys():
        if k not in a or k not in b or not equal(a[k],b[k]):keys.append(k)
    return json.dumps(sorted(keys),ensure_ascii=False)
'''
add(10,'两个JSON推荐结果的差异键','比较两个JSON对象，返回仅存在于一侧或两侧值不相同的顶层键，按Unicode码点字典序升序输出。对象键序不影响相等，数组有序，bool不同于数值，缺键不同于null；数值按精确十进制值比较。','输入严格两行JSON对象，可有一个最终换行，兼容CRLF。本站总UTF-8≤4MiB；每个根≤1000键，每棵树≤10000值节点，容器深度≤20（根为1）；所有键≤64码点，字符串值≤256码点，可为空；合法Unicode标量，拒绝重复键。完整JSON值支持对象/数组/字符串/数值/bool/null。数值绝对值≤10^9且是10^-6整数倍，数字token≤64字符，指数绝对值≤12，支持等价的小数、指数及−0。','解析数字为精确Decimal，逐个比较键并集；递归保持类型、数组顺序及对象键集合，最后排序差异键。','递归在叶上按值及类型判断，在数组上对应所有下标，在对象上对应全部键，因此结构相等判定精确。顶层并集中的每个键在且仅在缺失或值不等时加入，排序得到指定唯一顺序。','时间O(输入长度+K log K·最大键长)，空间O(输入长度)。',[({'hacker':'rank','input':'output'},{'hacker':'ranked','input':'wrong'}),({'a':None,'b':True},{'b':1}),('{"a":1e-6,"b":-0,"c":{"x":1,"y":2}}\n{"a":0.000001,"b":0.0,"c":{"y":2.0,"x":1}}')],'分别["hacker","input"]、["a","b"]、[]；数值格式不同不算差异。',json_rand,[],json_encode,json_oracle,JSON_REF,[('缺键null混淆','k not in a or k not in b or not equal(a[k],b[k])','not equal(a.get(k),b.get(k))'),('布尔与数值混淆','if type(x) is not type(y):return False','if type(x) is not type(y) and not isinstance(x,(bool,Decimal)):return False')],4194304,raw=True,checker='oa-json-diff',output='输出JSON字符串数组，升序且不重复；允许空白和合法转义的等价编码。')
json_spec=SPECS[-1]
deep=0
for _ in range(19):deep=[deep]
maxkeys1={f'{i:04d}'+'😀'*60:None for i in range(1000)};maxkeys2={f'{i:04d}'+'界'*60:True for i in range(1000)}
json_edges=[({'😀':1,'\ue000':2,'':False},{'😀':2,'\ue000':3,'':0}),({'deep':deep},{'deep':None}),({'nodes':[None]*9998},{'nodes':[False]*9998}),(maxkeys1,maxkeys2),('{"x":1000000000,"y":-1000000000,"z":1e-6}\n{"x":1e9,"y":-1e9,"z":0.000002}')]
padding='{}'+' '*(4194304-6)+'\n{}'
assert len(json_encode(padding).encode())==4194304
json_edges.append(padding)
json_edges.append('{"x":1.'+'0'*62+'}\n{"x":1e0}')
json_spec['edges']=[(x,json_oracle(x)) for x in json_edges]

def arrangements_oracle(rows):
    out=[]
    for p,c,n in rows:
        @lru_cache(None)
        def visit(p,c,last,run):
            if not p and not c:return 1
            answer=0
            if p and (last!=0 or run<n):answer+=visit(p-1,c,0,run+1 if last==0 else 1)
            if c and (last!=1 or run<n):answer+=visit(p,c-1,1,run+1 if last==1 else 1)
            return answer
        out.append(visit(p,c,-1,0)%MOD)
    return '\n'.join(map(str,out))
def arrange_large_dp(p,c,n,queries=None):
    # Independent sliding-sum DP over counts; no run composition/inclusion-exclusion.
    b_rows=deque();columns=[0]*(c+1);initial=[0]+[int(j<=n) for j in range(1,c+1)];b_rows.append(initial)
    columns=initial[:];last=[];collected={};wanted=set(queries or [])
    for i in range(1,p+1):
        a=[int(i<=n)]+[0]*c;b=[0]*(c+1);window=a[0]
        for j in range(1,c+1):
            a[j]=columns[j];b[j]=window;window=(window+a[j]-(a[j-n] if j>=n else 0))%MOD
        if len(b_rows)==n:
            old=b_rows.popleft();columns=[(x-y)%MOD for x,y in zip(columns,old)]
        columns=[(x+y)%MOD for x,y in zip(columns,b)];b_rows.append(b);last=[(x+y)%MOD for x,y in zip(a,b)]
        for pi,cj in wanted:
            if pi==i:collected[pi,cj]=last[cj]
    return collected if queries is not None else last
ARRANGEMENTS='''def solve(d):
    mod=1000000007;fact=[1]*2001
    for i in range(1,2001):fact[i]=fact[i-1]*i%mod
    inv=[1]*2001;inv[-1]=pow(fact[-1],mod-2,mod)
    for i in range(2000,0,-1):inv[i-1]=inv[i]*i%mod
    def choose(a,b):return fact[a]*inv[b]%mod*inv[a-b]%mod if 0<=b<=a else 0
    def parts(s,n):
        out=[0]*(s+2)
        for k in range((s+n-1)//n,s+1):
            if n==1:out[k]=1
            elif n==2:out[k]=choose(k,s-k)
            else:
                value=0
                for j in range((s-k)//n+1):
                    term=choose(k,j)*choose(s-j*n-1,k-1)%mod
                    value+=term if j%2==0 else -term
                out[k]=value%mod
        return out
    cases=[tuple(map(int,d[i:i+3])) for i in range(1,len(d),3)]
    needs={};cache={};answers=[]
    for p,c,n in cases:
        if p>n*(c+1) or c>n*(p+1) or n>=max(p,c):continue
        needs.setdefault(n,set()).update((p,c))
    for n,totals in needs.items():
        maximum=max(totals)
        # Count both algorithms' work before choosing; shared DP handles many
        # distinct totals with the same run limit without repeated binomial sums.
        inclusion=sum((s-k)//n+1 for s in totals for k in range((s+n-1)//n,s+1))
        cells=sum(min(maximum,n*k)-k+1 for k in range(1,maximum+1))
        if n<=2 or 5*inclusion<cells:
            for s in totals:cache[s,n]=parts(s,n)
            continue
        for s in totals:cache[s,n]=[0]*(s+2)
        previous=[0]*(maximum+1);previous[0]=1
        for k in range(1,maximum+1):
            current=[0]*(maximum+1);window=0;upper=min(maximum,n*k)
            for s in range(k,upper+1):
                window+=previous[s-1]
                if s>n:window-=previous[s-n-1]
                window%=mod;current[s]=window
            for s in totals:
                if k<=s<=upper:cache[s,n][k]=current[s]
            previous=current
    for p,c,n in cases:
        if p>n*(c+1) or c>n*(p+1):answers.append(0);continue
        if n>=max(p,c):answers.append(choose(p+c,p));continue
        a=cache[p,n];b=cache[c,n];answer=0
        for k in range(1,min(p,c)+1):answer=(answer+2*a[k]*b[k]+a[k+1]*b[k]+a[k]*b[k+1])%mod
        answers.append(answer)
    return '\\n'.join(map(str,answers))
'''
add(20,'限制连续课时的课程排列数','安排恰好P节物理和C节化学，相同科目不能连续超过N节，求不同科目序列数模1000000007。每行独立测试，不给相同科目课时单独身份。','第一行T，随后T行P C N。完整来源范围1≤T≤100，1≤P,C,N≤1000。','把课表按连续同科目分段。F(s,k)表示s分为k个1..N的正整数，容斥求F；交替段的两科段数相等或相差1，据此求和。','减去每段必有的一课后，用隔板计数并容斥排除长度超过N的段，得到F(s,k)=Σ(−1)^j C(k,j)C(s−jN−1,k−1)。相同段数k有两种开头，贡献2F(P,k)F(C,k)；相差1分别贡献F(P,k+1)F(C,k)和F(P,k)F(C,k+1)。任何课表唯一对应这些最大连续段，不重不漏。','预处理O(2000)，单组最坏O((P²+C²)/N+P+C)，N=1/2有直接公式；相同(s,N)缓存。空间O(2000+缓存大小)。',[[(1,1,2)],[(1,2,1)],[(3,1,1),(2,2,1)]],'分别2、1；0 2。',lambda r:[(r.randint(1,7),r.randint(1,7),r.randint(1,7)) for _ in range(r.randint(1,4))],[],lambda rows:str(len(rows))+'\n'+''.join(seq(row)+'\n' for row in rows),arrangements_oracle,ARRANGEMENTS,[('只保留一种开头','2*a[k]*b[k]','a[k]*b[k]'),('遗漏段数差一','+a[k+1]*b[k]+a[k]*b[k+1]','')],1520,time=10)
arr_spec=SPECS[-1]
arr_spec['idea']='按连续同科目段计数，F(s,k)表示s分成k个1..N的正整数。将全部测试按N分组，根据预计运算量，在容斥公式和共享滑窗DP之间选择；相同N的所有s共用DP过程，不逐组重复计算。最后组合两科段数相等或差1的情况。'
arr_spec['proof']+=' 共享DP使用F(s,k)=Σ_{v=1..N}F(s−v,k−1)，按最后一段长度分类不重不漏，初始F(0,0)=1。固定k时前后两个和式仅多一项、少一项，滑动和得到完全相同的F。两条计算路径只改变计算顺序，选择哪条不影响计数。'
arr_spec['cost']='设同N组需计算的总课时集合为S，M=max(S)，R=|S|。容斥成本A=Σ_{s∈S}Σ_{k=ceil(s/N)..s}(floor((s−k)/N)+1)，共享DP成本B=Σ_{k=1..M}(min(M,Nk)−k+1)+RM，按估计选路径；N=1/2直接公式。每组最多O(M²+RM)，结果组合O(Σmin(P,C))；存储O(2000+Σ已请求s)，没有逐测试重复构造二维表。'
arr_spec['output']='按输入顺序输出T个整数，每组结果一行，均对1000000007取模。'
arr_rows=[(p,p-100,3) for p in range(901,1001)];arr_dp=arrange_large_dp(1000,1000,3,[(p,c) for p,c,_ in arr_rows])
arr_spec['edges']=[(arr_rows,seq(arr_dp[p,c] for p,c,_ in arr_rows)),([(1000,1000,1000)]*100,seq([comb(2000,1000)%MOD]*100)),([(1000,1000,1)]*100,seq([2]*100)),([(1000,1000,2)]*100,seq([arrange_large_dp(1000,1000,2)[1000]]*100))]
arr_spec['edges']=[(rows,answer.replace(' ','\n')) for rows,answer in arr_spec['edges']]

def sessions_oracle(x):
    events,t=x;visited=set();answer=0
    for i in range(len(events)):
        if i in visited:continue
        answer+=1;visited.add(i);q=[i]
        while q:
            j=q.pop()
            for k in range(len(events)):
                if k not in visited and events[j][0]==events[k][0] and abs(events[j][1]-events[k][1])<=t:visited.add(k);q.append(k)
    return answer
add(8,'按用户超时划分会话','同用户事件按时间排序，连续相邻时间差不超过t属于同会话，否则开启新会话，求所有用户会话总数。不同用户互不合并。','第一行n t，随后n行用户ID和时间。来源无数值界，本站1≤n≤200000，0≤时间,t≤10^12；ID为1至32个ASCII字母数字；事件可能乱序、重复。','按用户和时间排序，数用户变化或相邻间隔大于t的位置。','同用户排序后，间隔大于t将会话分断，其余相邻事件连接成恰好的极大连续段，每段首事件贡献1；不同用户首事件分别计数。','时间O(n log n)，空间O(n)。',[([('a',1),('b',2),('a',5),('a',100),('b',3)],10),([('a',0),('a',10),('a',20)],10),([('a',1),('a',1),('b',1)],0)],'分别3、1、2，恰好超时长度仍同会话。',lambda r:([(r.choice('abc'),r.randint(0,30)) for _ in range(r.randint(1,12))],r.randint(0,10)),[(([('u',i) for i in range(200000)],1),1),(([('u',i) for i in range(200000)],0),200000)],lambda x:f'{len(x[0])} {x[1]}\n'+''.join(f'{u} {t}\n' for u,t in x[0]),sessions_oracle,"def solve(d):\n    n,t=map(int,d[:2]);events=sorted((d[i],int(d[i+1])) for i in range(2,len(d),2));last=None;answer=0\n    for u,time in events:\n        if last is None or u!=last[0] or time-last[1]>t:answer+=1\n        last=(u,time)\n    return str(answer)\n",[('等号也超时','time-last[1]>t','time-last[1]>=t'),('忽略用户','u!=last[0] or ','')],9400030)
add(9,'移除链表中的偶数节点','删除单链表中所有值为偶数的节点，保留剩余节点原顺序，返回完整链表。','第一行n，第二行n个节点值。来源无数值界，本站0≤n≤200000，−10^9≤值≤10^9。','用哨兵节点和前驱指针，遇偶节点接到其后继，遇奇节点前移。','前驱之前保留的节点都为奇数且顺序不变。每次仅跳过一个不应保留的偶节点或确认一个奇节点，不遗漏任何节点，结束时恰为目标链表。','时间O(n)，构建输入链表空间O(n)，删除过程额外O(1)。',[[1,2,3,4,5,6,7],[2,4],[-2,-3,0,5]],'输出个数及序列：4和1 3 5 7；0；2和−3 5。',lambda r:[r.randint(-10,10) for _ in range(r.randint(0,20))],[([1]*200000,'200000\n'+seq([1]*200000)),([0]*200000,'0\n')],arr,lambda a:str(sum(v%2!=0 for v in a))+'\n'+seq(v for v in a if v%2),"def solve(d):\n    class Node:\n        def __init__(self,v=0):self.v=v;self.next=None\n    head=Node();tail=head\n    for v in map(int,d[1:]):tail.next=Node(v);tail=tail.next\n    prev=head\n    while prev.next:\n        if prev.next.v%2==0:prev.next=prev.next.next\n        else:prev=prev.next\n    out=[];cur=head.next\n    while cur:out.append(cur.v);cur=cur.next\n    return str(len(out))+'\\n'+' '.join(map(str,out))\n",[('删奇留偶','prev.next.v%2==0','prev.next.v%2!=0'),('反转输出','map(str,out)','map(str,reversed(out))')],2400020,output='第一行剩余节点数，第二行按链表顺序输出节点值，空链表第二行可为空。')

def main():
    batch='ibm-first';seed=20261980
    for name in ('packages','references','oracles','mutants','negative-controls','positive-controls','editorials','batches','validation','reviews'):(OUT/name).mkdir(parents=True,exist_ok=True)
    sources={v['id']:v for v in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[]
    selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{batch}.json').exists():
        items=[v for v in json.loads((OUT/'batches'/f'{batch}.json').read_text())['items'] if int(v['id'].split('-')[-1]) not in selected]
        reports=[v for v in json.loads((OUT/'validation'/f'{batch}.json').read_text())['problems'] if int(v['id'].split('-')[-1]) not in selected]
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        ident=f"oa-ibm-{s['n']}";rng=random.Random(seed+s['n']);input_expr="sys.stdin.read()" if s.get('raw') else "sys.stdin.read().split()"
        code=s['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({input_expr}))\n';path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](x),expectedOutput=str(s['oracle'](x))+'\n') for x in values]
        tests=oracles[:3]+[dict(input=s['encode'](x),expectedOutput=str(y)+'\n') for x,y in s['edges']]+oracles[3:31]
        for c in oracles+tests:assert len(c['input'].encode())<=s['bound'],(ident,len(c['input'].encode()),s['bound'])
        def matches(a,b):
            if s.get('checker')=='exact':return a==b
            if s.get('checker')=='oa-json-diff':
                try:return json.loads(a)==json.loads(b)
                except (ValueError,TypeError):return False
            return a.split()==b.split()
        actual=helper.execute(path,[c['input'] for c in oracles+tests])
        for i,(v,c) in enumerate(zip(actual,oracles+tests)):assert matches(v,c['expectedOutput']),(ident,i,v[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];killed=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{ident}-{j}.py';mp.write_text(changed)
            outputs=helper.execute(mp,[c['input'] for c in cases]);bad=[i for i,(v,c) in enumerate(zip(outputs,cases)) if not matches(v,c['expectedOutput'])];assert bad,(ident,name,'survived')
            mutants.append(dict(name=name,code=changed));killed.append(dict(name=name,rejectedByCases=bad))
        if s['n']==10:
            positive=code.replace('json.dumps(sorted(keys),ensure_ascii=False)','json.dumps(sorted(keys),ensure_ascii=True,indent=2)')
            pc=OUT/'positive-controls'/f'{ident}.py';pc.write_text(positive)
            for v,c in zip(helper.execute(pc,[c['input'] for c in cases]),cases):assert matches(v,c['expectedOutput'])
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','IBM'],description=s['desc']+'\n\n标准输入输出与样例由本站整理；明示本站范围不是来源原约束。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('time',6),memoryLimit=s.get('memory',262144),outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        result=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert result.returncode==0,(ident,result.stderr[:3000]);normalized=result.stdout;assert len(normalized.encode())<=128*1024*1024
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)];source=sources[ident]
        for folder,data in dict(packages=json.loads(normalized),oracles=oracles,mutants=mutants,editorials=dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():(OUT/folder/f'{ident}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=ident,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=ident,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=s['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()));print(ident,'163 oracle;',len(cases)-3,'hidden; 2 normal-exit wrong programs rejected',flush=True)
    items.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    for folder,data in {'batches':dict(schemaVersion=1,items=items),'validation':dict(schemaVersion=1,seed=seed,problems=reports,note='Local batched runpy only; real sandbox still required. Complete raw or immutable MDX reviewed; no source solution executed.'),'reviews':dict(schemaVersion=1,items=[dict(id=f"oa-ibm-{s['n']}",status='authored',reason=s['desc']+' 原始e66f809快照逐条审阅；1至10主要为MDX，6另核对同题raw补足范围；11至20为fastprep原文。') for s in sorted(SPECS,key=lambda s:s['n'])]+[dict(id='oa-ibm-2',status='blocked',reason='原始MDX同样缺少三元组索引顺序、计重及负数角色定义。[4,1,2],t=8按索引递增与无序选值结果不同；不能用来源排序解补充核心规则。')])}.items():(OUT/folder/f'{batch}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
