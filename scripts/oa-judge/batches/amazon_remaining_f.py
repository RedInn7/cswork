"""Independently authored Amazon 116–135; imported source solutions never run."""
from collections import Counter
from functools import lru_cache, cmp_to_key
from itertools import combinations, product
from pathlib import Path
import hashlib,json,random,subprocess,sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='amazon-remaining-f';SEED=20261201;SPECS=[]
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,random=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def graph_oracle(x):
    n,edges=x;adj=[[] for _ in range(n)]
    for u,v in edges:adj[u].append(v);adj[v].append(u)
    seen=set();answer=0
    for i in range(n):
        if i in seen:continue
        answer+=1;stack=[i];seen.add(i)
        while stack:
            for j in adj[stack.pop()]:
                if j not in seen:seen.add(j);stack.append(j)
    return answer
add(117,'无向图的连通分量数','给出0..n−1编号的无向图，求连通分量数量。重边和自环不改变连通关系，孤立点也算一个分量。','第一行n m；随后m行u v。来源无规模上限，本站1≤n≤200000、0≤m≤200000，0≤u,v<n。','并查集合并每条边的两个端点；初始有n个分量，每次合并不同根减少一个。','初始每点独立，加入边只会把其端点所在的两个分量连通。根不同则恰好减少一个，根相同不变；所有边处理完就是图的连通关系。','时间O((n+m)α(n))，空间O(n+m)含输入。',[(5,[(0,1),(1,2),(3,4)]),(4,[]),(3,[(0,0),(0,1),(0,1)])],'样例1：{0,1,2}和{3,4}共2组。样例2：四个点都孤立，答案4。样例3：0、1连通，2孤立；自环与重复边不额外减少分量，答案2。',lambda r:(lambda n:(n,[(r.randrange(n),r.randrange(n)) for _ in range(r.randint(0,15))]))(r.randint(1,8)),[((200000,[(i,i+1) for i in range(199999)]+[(0,199999)]),1),((200000,[(199999,199999)]*200000),200000)],lambda x:f'{x[0]} {len(x[1])}\n'+''.join(f'{u} {v}\n' for u,v in x[1]),graph_oracle,
'''def solve(d):
    n=int(d[0]);p=list(range(n));size=[1]*n;answer=n
    def root(a):
        while p[a]!=a:p[a]=p[p[a]];a=p[a]
        return a
    for i in range(2,len(d),2):
        a,b=root(int(d[i])),root(int(d[i+1]))
        if a!=b:
            if size[a]<size[b]:a,b=b,a
            p[b]=a;size[a]+=size[b];answer-=1
    return str(answer)
''',[('每条边都扣一','return str(answer)','return str(n-int(d[1]))'),('遗漏孤立点','return str(answer)','return str(answer-sum(size[i]==1 and p[i]==i for i in range(n)))')],2800100,time=6)
def reversal_oracle(s):return len({s[:i]+s[i:j][::-1]+s[j:] for i in range(len(s)) for j in range(i+1,len(s)+1)})
add(118,'反转一个子串后的不同密码数','必须反转一个非空连续子串，统计能得到多少种不同字符串。长度1的反转允许保留原串。','一行小写字符串，长度1..100000。','从总端点对数中去掉两端相同的对，最后加上原字符串；扫描时每个字符贡献此前不同字符的数量。','对任意反转区间，可同时向内删除相同的首尾字符而不改变结果。非原串结果因此唯一对应首尾不同的区间，其端点就是结果与原串最早和最晚不同的位置；不同端点区间不会产生同一结果。再计入原串恰好得到全部结果。','时间O(n)，辅助空间O(26)。',['abc','aaa','aba'],'样例1：原串、bac、acb、cba，共4种。样例2：任何反转都不改变aaa，答案1。样例3：原串以及baa、aab，共3种。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,8))),[('a'*100000,1),('a'*50000+'b'*50000,2500000001)],lambda s:s+'\n',reversal_oracle,
'''def solve(d):
    count={};answer=1
    for i,c in enumerate(d[0]):answer+=i-count.get(c,0);count[c]=count.get(c,0)+1
    return str(answer)
''',[('忘计原字符串','answer=1','answer=0'),('相同端点也计','i-count.get(c,0)','i')],100100)
def dominant_oracle(s):
    answer=0
    for i in range(len(s)):
        for j in range(i+2,len(s)+1,2):answer+=((j-i)//2 in Counter(s[i:j]).values())
    return answer
add(119,'恰有字符占一半的子串数','按下标统计偶数长度子串：至少一种字符的次数恰好等于长度的一半就计一次。两种字符同时占一半也只能计一次。','一行字符串。来源无长度与字符集限制，本站长度1..100000且仅小写字母。','对每种字符，把它记为+1、其他记为−1，相等前缀和对数统计它恰占一半。唯一重计情形是仅两种字符且数量相同；对每个字符对合并出现位置，在不含其他字符的连续段内做平衡计数并扣除。','单字符平衡与它的频次等于长度一半等价。非空子串不可能有三种字符都占一半；有两种时必定不含其他字符。逐字符对恰扣除这些多算一次的子串，得到每个合法子串一次。每个位置在字符对合并中最多参与25次。','时间O(26n)，空间O(n)。',['aaaaid','abab','aa'],'样例1：合法的是ai、id、aaid，共3个；来源解释中的aa不满足定义。样例2：三个长度2子串与整个abab，共4个。样例3：aa中a出现2次而不是长度的一半1，答案0。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,10))),[('ab'*50000,2500000000),(('abcdefghijklmnopqrstuvwxyz'*3847)[:100000],99999)],lambda s:s+'\n',dominant_oracle,
'''def solve(d):
    s=d[0];positions={}
    for i,c in enumerate(s):positions.setdefault(c,[]).append(i)
    answer=0
    for c in positions:
        balance=0;seen={0:1}
        for v in s:
            balance+=1 if v==c else -1;answer+=seen.get(balance,0);seen[balance]=seen.get(balance,0)+1
    keys=list(positions)
    for a in range(len(keys)):
        for b in range(a):
            x,y=positions[keys[a]],positions[keys[b]];i=j=0;previous=-2;balance=0;seen={0:1}
            while i<len(x) or j<len(y):
                if j==len(y) or i<len(x) and x[i]<y[j]:p=x[i];i+=1;step=1
                else:p=y[j];j+=1;step=-1
                if p!=previous+1:balance=0;seen={0:1}
                balance+=step;answer-=seen.get(balance,0);seen[balance]=seen.get(balance,0)+1;previous=p
    return str(answer)
''',[('不扣双字符重复','answer-=seen.get(balance,0)','answer-=0'),('重计部分扣两次','answer-=seen.get(balance,0)','answer-=2*seen.get(balance,0)')],100100,time=10)
def failure_oracle(x):
    required,actual=x;seen=set();failed=0
    for v in actual:
        failed+=not set(required[:required.index(v)]).issubset(seen);seen.add(v)
    return failed
def failure_random(r):
    n=r.randint(1,8);return r.sample(range(1,n+1),n),r.sample(range(1,n+1),n)
for number in (120,123):
    add(number,'前置流程尚未执行的失败数量','两数组是1..n排列，分别给出规定顺序和实际执行顺序。某流程执行时，只要规定排在它前面的任一流程尚未执行，它就失败。已经执行但失败的流程不再视为尚未执行，不传播失败。','第一行n（1..200000），随后两行分别规定排列与实际排列。','记录每个流程实际位置，按规定顺序扫描；若当前位置小于此前实际位置最大值，则至少一项前置任务在它之后执行。','此前位置的最大值大于当前值，当且仅当存在前置流程晚于当前流程。每个流程按这个充要条件独立统计，等价于题目“已执行”的要求；来源例子也明确不会递归传播错误结果。','时间O(n)，空间O(n)。',[([4,2,3,5,1,6],[2,3,5,1,6,4]),([3,2,1],[3,2,1]),([2,3,5,1,4],[5,2,3,4,1])],'样例1：4最后才运行，其他五个流程都缺前置4，答案5。样例2：顺序一致，答案0。样例3：5运行时缺2、3，4运行时缺1，只有这两个失败，答案2。',failure_random,[((list(range(1,200001)),list(range(200000,0,-1))),199999),((list(range(1,200001)),list(range(1,200001))),0)],lambda x:arr(x[0])+' '.join(map(str,x[1]))+'\n',failure_oracle,
'''def solve(d):
    n=int(d[0]);required=list(map(int,d[1:n+1]));position=[0]*(n+1)
    for i in range(n):position[int(d[n+1+i])]=i
    maximum=-1;answer=0
    for v in required:
        answer+=position[v]<maximum;maximum=max(maximum,position[v])
    return str(answer)
''',[('只检查紧邻前置','maximum=max(maximum,position[v])','maximum=position[v]'),('错误统计位置不一致','return str(answer)','return str(sum(position[v]!=i for i,v in enumerate(required)))')],2800100,time=6)
def faults_oracle(x):
    n,logs=x;hist=[[] for _ in range(n)];answer=0
    for i,ok in logs:
        hist[i].append(ok)
        if len(hist[i])>=3 and hist[i][-3:]==[False]*3:answer+=1;hist[i]=[]
    return answer
add(121,'连续三次错误后的服务器更换次数','分别观察每台服务器自己的请求；连续三个error后更换服务器并将错误连续计数清零，success也清零。其他服务器的日志不打断它的连续请求。','第一行n m；随后m行服务器编号（1-based）与success/error。1≤n≤200，1≤m≤20000；m上限依来源模糊图片的文字转录，未声称核过原图。','每台服务器保存连续错误次数，success归零，错误加一达到3就换机并归零。','计数不变量是当前新服务器在最近success之后连续失败次数。替换后使用全新服务器，因此也从零开始。每次恰在第三个错误时计一次，完整模拟所有替换。','时间O(n+m)，空间O(n+m)含输入。',[(2,[(0,False),(0,False),(1,False),(0,False),(0,False),(1,True)]),(1,[(0,False)]*6),(1,[(0,False),(0,True),(0,False),(0,False)])],'样例1：s1第三次错误发生时换机一次，随后仅一次错误，答案1。样例2：六连错，每三次换一次，答案2。样例3：success打断连续错误，答案0。',lambda r:(lambda n:(n,[(r.randrange(n),bool(r.randrange(2))) for _ in range(r.randint(1,20))]))(r.randint(1,4)),[((200,[(199,False)]*20000),6666),((200,[(i%200,False) for i in range(20000)]),6600)],lambda x:f'{x[0]} {len(x[1])}\n'+''.join(f'{i+1} {"success" if ok else "error"}\n' for i,ok in x[1]),faults_oracle,
'''def solve(d):
    streak=[0]*int(d[0]);answer=0
    for j in range(2,len(d),2):
        i=int(d[j])-1;streak[i]=streak[i]+1 if d[j+1]=='error' else 0
        if streak[i]==3:answer+=1;streak[i]=0
    return str(answer)
''',[('成功不清零',"if d[j+1]=='error' else 0","if d[j+1]=='error' else streak[i]"),('换机后不重置','answer+=1;streak[i]=0','answer+=1;streak[i]=3')],250100)
def pairs_oracle(x):
    a,k=x;return len({(u,v) for u in a for v in a if u+k==v})
add(122,'差为k的不同数值对','统计数组中不同的有序数值对(a,b)，满足a+k=b。允许同一个下标同时充当a和b，因此k=0时每个不同数值都能自配。','第一行n k（2≤n≤200000，0≤k≤10⁹），第二行n个数（0..10⁹）。','去重后对每个a查询a+k是否存在。','k固定后a唯一确定b，集合中每个满足条件的a恰好对应一个不同数值对。自配不要求两个下标，所以k=0也直接适用。','期望时间O(n)，空间O(n)。',[([1,1,1,2],1),([1,2],0),([1,3,5,7],2)],'样例1：只有(1,2)，重复1不增加答案，结果1。样例2：(1,1)、(2,2)均合法，结果2。样例3：(1,3)、(3,5)、(5,7)，结果3。',lambda r:([r.randint(0,10) for _ in range(r.randint(2,9))],r.randint(0,5)),[((list(range(200000)),0),200000),(([10**9]*200000,0),1)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',pairs_oracle,
'''def solve(d):
    k=int(d[1]);values=set(map(int,d[2:]));return str(sum(a+k in values for a in values))
''',[('按数组重复计数','for a in values))','for a in map(int,d[2:])))'),('不允许自配','sum(a+k in values for a in values)','sum(a+k in values and k!=0 for a in values)')],2200100)
def secured_oracle(x):
    s,t=x;return sum(''.join(s[i] for i in range(len(s)) if mask>>i&1)>t for mask in range(1<<len(s)))
def secured_max():
    import math
    return (pow(2,100000,1000000007)-sum(math.comb(100000,k) for k in range(101)))%1000000007
add(124,'比系统密码大的子序列数量','从客户密码s按下标选择子序列，统计字典序严格大于t的选择方案数，模1000000007。相同结果字符串由不同下标选择得到时分别计数。','两行分别s、t；1≤|s|≤100000，1≤|t|≤100，均小写。','dp[j]统计当前恰好等于t前j个字符的子序列，greater统计已经严格更大的方案。新字符可延续更大状态，或在首次差异处变大；从后往前更新匹配长度避免重复使用位置。','任一子序列按当前与t的首次差异分为已经大、仍与某前缀相等、已小。已小不能恢复而忽略；已大追加或不追加都大。前缀相等状态取当前字符后只有匹配、首次变大、首次变小三种情况，转移互斥且完备。','时间O(|s||t|)，空间O(|s|+|t|)含输入。',[('aba','ab'),('bab','ab'),('aaa','aa')],'样例1：b、ba、aba三种选择严格更大，答案3。样例2：两个不同位置的b以及ba、bb、bab，共5。样例3：只有完整aaa比aa大，答案1。',lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,9))),''.join(r.choice('abc') for _ in range(r.randint(1,4)))),[(('a'*100000,'a'*100),secured_max()),(('z'*100000,'a'*100),pow(2,100000,1000000007)-1)],lambda x:'\n'.join(x)+'\n',secured_oracle,
'''def solve(d):
    s,t=d;mod=1000000007;m=len(t);dp=[0]*(m+1);dp[0]=1;greater=0
    for c in s:
        greater=(greater*2+dp[m])%mod
        for j in range(m-1,-1,-1):
            if c>t[j]:greater=(greater+dp[j])%mod
            elif c==t[j]:dp[j+1]=(dp[j+1]+dp[j])%mod
    return str(greater)
''',[('把相等也算大','return str(greater)','return str((greater+dp[m])%mod)'),('重复使用当前字符','range(m-1,-1,-1)','range(m)')],100200,time=10)
def dna_oracle(s):
    return sum((j-i==2 and s[i]==s[j-1]) or (j-i>2 and s[i]==s[j-1] and len(set(s[i+1:j-1]))==1) for i in range(len(s)) for j in range(i+2,len(s)+1))
add(125,'中段单一字符的特殊DNA子串','长度2时两个字符必须相同；长度大于2时首尾相同且中间恰好有一种字符。统计所有符合条件的下标子串。','一行小写字符串，长度1..300000。','游程编码。一个长度L的同字符段内部贡献L(L−1)/2。不同首尾与中间字符的情形，恰好对应三个连续游程且两侧字符相同，每个中间段贡献1。','完全同字符子串全由段内计数得到。其他合法子串的中间必须是完整的单一游程，首尾只能各取相邻段靠近它的一个字符；两侧相同才成立且没有其他选择。两类不相交，覆盖全部合法子串。','时间O(n)，空间O(n)。',['xyyx','aaaa','aabaa'],'样例1：yy和xyyx合法，共2。样例2：长度2有3个、长度3有2个、长度4有1个，共6。样例3：两侧各一个aa以及中间aba，共3。',lambda r:''.join(r.choice('abc') for _ in range(r.randint(1,10))),[('a'*300000,44999850000),('ab'*150000,299998)],lambda s:s+'\n',dna_oracle,
'''def solve(d):
    runs=[]
    for c in d[0]:
        if runs and runs[-1][0]==c:runs[-1][1]+=1
        else:runs.append([c,1])
    answer=sum(n*(n-1)//2 for c,n in runs)
    answer+=sum(runs[i-1][0]==runs[i+1][0] for i in range(1,len(runs)-1))
    return str(answer)
''',[('遗漏长度2','n*(n-1)//2','(n-1)*(n-2)//2'),('错乘两侧长度','runs[i-1][0]==runs[i+1][0] for i','(min(runs[i-1][1],runs[i+1][1]) if runs[i-1][0]==runs[i+1][0] else 0) for i')],300100,time=6)
def squared_oracle(s):
    return sum(s[i:j].count('0')==s[i:j].count('1')**2 for i in range(len(s)) for j in range(i+1,len(s)+1))
add(126,'零数量等于一数量平方的子串数','统计非空二进制子串，使0的数量等于1的数量的平方。按不同下标区间分别计数。','一行01字符串，长度1..100000。','若有k个1，子串长度必为k²+k且k≥1。因此枚举至多√n个k，对这一固定长度使用1数量前缀和，检查每个起点。','任何合法非空子串不能k=0，否则零个0也要求长度0。对k≥1，条件等价于长度k²+k且含k个1；枚举这些长度和全部起点，既不漏又不重。','时间O(n√n)，空间O(n)。',['010001','10010','0'],'样例1：01、01、10三个长度2区间及整个010001，共4。样例2：三个相邻01或10区间，共3。样例3：单个0不满足1=0²，答案0。',lambda r:''.join(r.choice('01') for _ in range(r.randint(1,14))),[('01'*50000,99999),('1'*100000,0)],lambda s:s+'\n',squared_oracle,
'''def solve(d):
    s=d[0];n=len(s);prefix=[0]
    for c in s:prefix.append(prefix[-1]+(c=='1'))
    answer=0;k=1
    while k*k+k<=n:
        length=k*k+k
        answer+=sum(prefix[i+length]-prefix[i]==k for i in range(n-length+1));k+=1
    return str(answer)
''',[('把平方错成原数','length=k*k+k','length=k+k'),('遗漏最后起点','range(n-length+1)','range(n-length)')],100100,time=10)
def palindrome_oracle(s):return sum(s[i:j]==s[i:j][::-1] for i in range(len(s)) for j in range(i+1,len(s)+1))
add(127,'按位置计数的回文子串','统计所有回文子串，字符内容相同但起止位置不同也分别计算。来源首句截断，此定义由标题及aaa列出六个位置子串的样例明确。','一行小写字符串，长度1..1000。','枚举奇数与偶数中心，向两侧扩展直到字符不同；每次成功扩展计一个回文。','每个回文唯一对应其中心和半径。中心扩展恰好访问该中心的全部合法半径，不同中心或半径的下标区间不同，因此无遗漏和重复。','时间O(n²)，辅助空间O(1)。',['abc','aaa','abba'],'样例1：三个单字符，共3。样例2：三个a、两个aa、一个aaa，共6。样例3：四个单字符加bb和abba，共6。',lambda r:''.join(r.choice('abc') for _ in range(r.randint(1,12))),[('a'*1000,500500),('ab'*500,250500)],lambda s:s+'\n',palindrome_oracle,
'''def solve(d):
    s=d[0];n=len(s);answer=0
    for center in range(2*n-1):
        left=center//2;right=(center+1)//2
        while left>=0 and right<n and s[left]==s[right]:answer+=1;left-=1;right+=1
    return str(answer)
''',[('只算奇数中心','range(2*n-1)','range(0,2*n-1,2)'),('遗漏单字符','return str(answer)','return str(answer-n)')],1100,time=4)
def fleet_oracle(a):return ' '.join(str(sum(2*x+4*y==w for x in range(w//2+1) for y in range(w//4+1))) for w in a)
add(128,'用两轮四轮车组成车队的方法数','无限提供两轮与四轮车。对每个总轮数，统计两种车数量的不同组合。','第一行n（1..100000），第二行n个总轮数（1..10⁹）。','奇数无解；偶数时四轮车可取0到w//4，余轮数唯一确定两轮车数量。','两种车总轮数必为偶数。固定四轮车数后两轮车数被方程唯一确定，取值区间恰保证其非负，故偶数答案为w//4+1。','时间O(n)，空间O(n)含输出。',[[6,3,2],[4,5,6],[1,8]],'样例1：6有(3,0)、(1,1)两种，3无解，2仅(1,0)，输出2 0 1。样例2：4、6各两种，5无解。样例3：1无解；8有四轮车0、1、2三种，输出0 3。',lambda r:[r.randint(1,30) for _ in range(r.randint(1,8))],[([10**9]*100000,' '.join(['250000001']*100000)),([999999999]*100000,' '.join(['0']*100000))],arr,fleet_oracle,
'''def solve(d):return ' '.join(str(w//4+1 if w%2==0 else 0) for w in map(int,d[1:]))
''',[('奇数也按整除计数','if w%2==0 else 0','if True else 0'),('漏四轮车零辆','w//4+1','w//4')],1100100,output='按输入顺序输出n个整数。')
def availability_oracle(x):
    a,state,m=x
    @lru_cache(None)
    def visit(state,left):
        if not left:return ()
        enabled=[i for i,c in enumerate(state) if c=='1']
        if not enabled:return None
        after=''.join('1' if c=='1' or i>0 and state[i-1]=='1' else '0' for i,c in enumerate(state));tail=visit(after,left-1)
        return max((a[i],)+tail for i in enabled)
    result=visit(state,m);return '-1' if result is None else ' '.join(map(str,result))
add(129,'同步向右解锁后的最大字典序序列','每步从当前可用元素任选一个，允许重复选择，追加到结果；随后所有0且左邻原本为1的位置同时变1。解锁与选择谁无关，只向右传播一格。做m步，最大化结果字典序。全0无法选择时，本站标准I/O约定输出-1。','第一行n m，第二行n个正整数，第三行01可用串。来源无数值界，本站1≤n,m≤100000，元素1..10⁹，串长n。','扫描计算每个元素距离左侧最近初始1的距离，即解锁轮次；按轮次记录最大值，再对每一轮维护已经解锁值的最大值。','每轮可用集合的变化完全由初始状态和时间决定，不受选择影响。故当前选择最大值不会损害任何后续选择，按字典序逐位贪心最优。距离恰是同步向右传播所需轮数，初始首个1左侧永远不可用。','时间O(n+m)，空间O(n+m)。',[([10,5,7,6],'0101',2),([4,9,1,2,10],'10010',4),([2,9],'00',3)],'样例1：开始可选5、6，先取6；解锁7后取7。样例2：先取4，一轮后9和10均解锁，后续都取10，输出4 10 10 10；修正来源4 9 10 10。样例3：没有初始可用元素，无解输出-1。',lambda r:(lambda n:([r.randint(1,9) for _ in range(n)],''.join(r.choice('01') for _ in range(n)),r.randint(1,5)))(r.randint(1,7)),[((list(range(1,100001)),'1'+'0'*99999,100000),' '.join(map(str,range(1,100001)))),(([10**9]*100000,'0'*99999+'1',100000),' '.join(['1000000000']*100000))],lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+x[1]+'\n',availability_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));state=d[2+n];unlock=[0]*n;distance=n
    for i,c in enumerate(state):
        distance=0 if c=='1' else distance+1
        if distance<n:unlock[distance]=max(unlock[distance],a[i])
    if not unlock[0]:return '-1'
    current=0;answer=[]
    for step in range(m):
        if step<n:current=max(current,unlock[step])
        answer.append(current)
    return ' '.join(map(str,answer))
''',[('提前一轮解锁','unlock[distance]=max(unlock[distance],a[i])','unlock[max(0,distance-1)]=max(unlock[max(0,distance-1)],a[i])'),('永远只用初始集合','if step<n:current=max(current,unlock[step])','if step==0:current=max(current,unlock[step])')],1200100,time=6,output='无解输出-1；否则输出m个所选值。')
def custom_oracle(x):
    order,values=x;rank={c:i for i,c in enumerate(order)}
    def compare(a,b):
        for u,v in zip(a,b):
            if u!=v:return rank[u]-rank[v]
        return len(a)-len(b)
    return ' '.join(s or '-' for s in sorted(values,key=cmp_to_key(compare)))
def custom_random(r):
    order=''.join(r.sample('abAZ09',r.randint(1,6)));return order,[''.join(r.choice(order) for _ in range(r.randint(0,6))) for _ in range(r.randint(1,8))]
add(130,'按自定义字符表排序字符串','字符表给出不同字符的从小到大顺序。按此字典序排序全部字符串；前缀较短者在先，相同字符串保留全部副本。标准I/O以-表示空串，-不属于允许字符表。','第一行order，第二行n，接着n个字符串（空串写-）。order由大小写字母与数字构成，1≤|order|≤62，1≤n≤100000，原字符串长度总和≤1000000。','将每个字符映射到其0..61排名，得到字节串排序键；Python字节串比较自然实现自定义字典序。','在首次不同位置，字节排名的大小与自定义字符顺序相同；没有不同位置则短键在先，满足前缀规则。因此键排序与要求完全等价，并且排序不会删除重复项。','时间O((L+n) log n)，包含空串比较开销，空间O(L+n)，L为总长度。',[('9AacB',['BBBBa','BBBB9','B9ca','Aa999','B9A','B','B9A']),('yYaAbBl',['Yay','yaY','lyab','lyab','b','bay']),('ba',['','a','b','ba',''])],'样例1：顺序Aa999、B、B9A、B9A、B9ca、BBBB9、BBBBa；来源BBB89是擅改字符的笔误。样例2：yaY、Yay、b、bay、lyab、lyab，重复lyab不能改成lyaB。样例3：两个空串在前，其后b、ba、a，空串各用-输出。',custom_random,[(('BA'+''.join(c for c in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' if c not in 'BA'),['A'*10]*50000+['B'*10]*50000),' '.join(['B'*10]*50000+['A'*10]*50000)),(('ba',['a'*499999+'b','a'*500000]),'a'*499999+'b '+'a'*500000)],lambda x:x[0]+'\n'+str(len(x[1]))+'\n'+'\n'.join(s or '-' for s in x[1])+'\n',custom_oracle,
'''def solve(d):
    rank={c:i for i,c in enumerate(d[0])};values=['' if s=='-' else s for s in d[2:]]
    values.sort(key=lambda s:bytes(rank[c] for c in s))
    return ' '.join(s or '-' for s in values)
''',[('直接自然排序','key=lambda s:bytes(rank[c] for c in s)','key=lambda s:s'),('删除重复项',"values.sort(key=", "values=list(set(values));values.sort(key=")],1100100,time=6,output='按排序结果输出n个字符串，空串用-表示，保留重复。')
def shift_oracle(x):
    tasks,shifts=x;left=tasks[:];answer=[]
    for budget in shifts:
        for i in range(len(left)):
            used=min(left[i],budget);left[i]-=used;budget-=used
            if not budget:break
        remaining=sum(v>0 for v in left);answer.append(remaining)
        if not remaining:left=tasks[:]
    return ' '.join(map(str,answer))
add(132,'每个班次结束后剩余的任务数','任务按顺序执行，未完成的任务跨班继续。依来源前两个样例补足规则：某班完成全部任务时输出0、丢弃该班超额时间，下一班重新从整批首任务开始；不在同一班内重启。','第一行n m（1..200000），随后两行分别n个任务时长和m个班次时长，均1..10⁹。','任务时长前缀和记录完成时间。累加当前批已经用时，二分已完成任务数；达到总时长则输出0并清零，为下班重启准备。','批内顺序且任务时长为正，累计时间达到某前缀当且仅当前若干任务完成。二分统计不大于当前时间的前缀得到完成数。达到全批后按来源样例丢弃超额并重置，其余班次则继续累计，保持进度不变量。','时间O(n+m log n)，空间O(n+m)。',[([1,4,4],[9,1,4]),([1,2,4,1,2],[3,10,1,1,1]),([2,4,5,1,1],[1,5,1,5,2])],'样例1：第一班恰完输出0；重启后完成第一项剩2，再完成第二项剩1。样例2：首班完成前两项剩3；第二班完成剩余并丢弃超额；新批后三班分别剩4、4、3。样例3：累计用时1、6、7、12、14，对应剩5、3、3、1、0。',lambda r:([r.randint(1,8) for _ in range(r.randint(1,7))],[r.randint(1,20) for _ in range(r.randint(1,8))]),[(([10**9]*200000,[10**9]*200000),' '.join(map(str,range(199999,-1,-1)))),(([1],[10**9]*200000),' '.join(['0']*200000))],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',shift_oracle,
'''def solve(d):
    from bisect import bisect_right
    n,m=map(int,d[:2]);prefix=[];total=0
    for v in d[2:2+n]:total+=int(v);prefix.append(total)
    elapsed=0;answer=[]
    for v in d[2+n:]:
        elapsed+=int(v)
        if elapsed>=total:answer.append(0);elapsed=0
        else:answer.append(n-bisect_right(prefix,elapsed))
    return ' '.join(map(str,answer))
''',[('同班保留超额给新批','answer.append(0);elapsed=0','answer.append(0);elapsed%=total'),('完成后永不重启','answer.append(0);elapsed=0','answer.append(0);elapsed=total')],4400100,time=6,output='依班次顺序输出m个剩余任务数。')
def skips_oracle(x):
    inventory,a,b,budget=x
    @lru_cache(None)
    def visit(index,stock,turn,left):
        if index==len(inventory):return 0
        if turn==0:
            if stock<=a:return 1+visit(index+1,inventory[index+1] if index+1<len(inventory) else 0,0,left)
            return visit(index,stock-a,1,left)
        if stock<=b:best=visit(index+1,inventory[index+1] if index+1<len(inventory) else 0,0,left)
        else:best=visit(index,stock-b,0,left)
        if left:best=max(best,visit(index,stock,0,left-1))
        return best
    return visit(0,inventory[0],0,budget)
add(133,'同事有限跳过次数下最多拿分','每仓都由你先出货a件，再轮到同事出货b件；同事可跳过，总跳过次数至多skips。反复轮流至库存≤0，你完成最后一次出货才得1分。求最多得分。','第一行n a b skips，第二行n个库存。来源n≤100000且库存正；缺失上界采用本站库存、a、b≤10⁹且为正，0≤skips≤10⁹。','无跳过完整轮次每次消耗a+b。将库存余数r变为1..a+b，每仓拿分最少需要(r−1)//a次跳过。将这些成本排序，尽量购买低成本的1分。','跳过可以推迟到决定最后出货者的末段而不增加所需次数。余数r若大于a，你每多出货一次需要同事跳过一次，最少ceil(r/a)−1次。每仓独立提供价值相同的1分，交换任一较贵已选仓与较便宜未选仓不降分且不增总成本，故按成本排序最优。','时间O(n log n)，空间O(n)。',[([10,6,12,8,15,1],2,3,3),([4],2,2,0),([4],2,2,1)],'样例1：六仓最低跳过成本2、0、0、1、2、0，用3次拿5分。样例2：你先出2，同事再出2清空，你不得分。样例3：同事跳过一次，让你再出2清空，得1分。',lambda r:([r.randint(1,15) for _ in range(r.randint(1,5))],r.randint(1,5),r.randint(1,5),r.randint(0,5)),[(([10**9]*100000,1,10**9,10**9),1),(([10**9]*100000,10**9,10**9,0),100000)],lambda x:f'{len(x[0])} {x[1]} {x[2]} {x[3]}\n'+' '.join(map(str,x[0]))+'\n',skips_oracle,
'''def solve(d):
    n,a,b,budget=map(int,d[:4]);cost=sorted(((int(v)-1)%(a+b))//a for v in d[4:]);answer=0
    for value in cost:
        if value>budget:break
        budget-=value;answer+=1
    return str(answer)
''',[('余数0错当免费','((int(v)-1)%(a+b))//a','max(0,(int(v)%(a+b)-1)//a)'),('优先昂贵仓','for value in cost:','for value in reversed(cost):')],1100100,time=6)
def prices_oracle(x):
    a,queries=x;a=a[:]
    for typ,i,v in queries:
        if typ==1:a[i-1]=v
        else:a=[max(z,v) for z in a]
    return ' '.join(map(str,a))
def prices_random(r):
    n=r.randint(1,7);return [r.randint(1,15) for _ in range(n)],[(1,r.randint(1,n),r.randint(1,15)) if r.randrange(2) else (2,v,v) for v in [r.randint(1,15) for _ in range(r.randint(1,10))]]
add(134,'单点改价与全局保底后的最终价格','操作1 x v将编号x价格直接设v（可降低）；操作2 v v把所有低于v的价格抬至v。按给定顺序执行后输出最终数组。','第一行n q，第二行n个价格，随后q行操作。编号1-based，类型2后两项相同。来源未给数值界，本站1≤n,q≤100000，所有价格与v为1..10⁹。','倒序处理，记录后续全局保底的最大值；第一次遇到某下标单点赋值就确定其最终值=max(赋值,后续保底)，忽略更早赋值。未遇赋值者用初始价格。','最后一次单点赋值覆盖该点此前的全部操作，而它之后的保底操作等价于取所有下限最大值。倒序第一次赋值正是最后赋值，维护的最大值恰为后续保底，所以每点结果正确。','时间O(n+q)，空间O(n+q)。',[([1,9],[(2,5,5),(1,2,2)]),([10,1],[(1,1,3),(2,7,7)]),([5],[(1,1,2),(1,1,9),(2,6,6)])],'样例1：保底后5、9，再把第二项降到2，最终5 2。样例2：先3、1，再统一保底为7 7。样例3：最后单点赋值9不会被保底6降低，答案9。',prices_random,[(([1]*100000,[(1,i,10**9) for i in range(1,100001)]),' '.join(['1000000000']*100000)),(([10**9]*100000,[(2,10**9,10**9)]*99999+[(1,100000,1)]),' '.join(['1000000000']*99999+['1']))],lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+''.join(f'{a} {b} {c}\n' for a,b,c in x[1]),prices_oracle,
'''def solve(d):
    n,q=map(int,d[:2]);initial=list(map(int,d[2:2+n]));answer=[None]*n;floor=0
    for j in range(len(d)-3,1+n,-3):
        typ,x,v=map(int,d[j:j+3])
        if typ==2:floor=max(floor,v)
        elif answer[x-1] is None:answer[x-1]=max(v,floor)
    for i in range(n):
        if answer[i] is None:answer[i]=max(initial[i],floor)
    return ' '.join(map(str,answer))
''',[('后续单点也被较早保底覆盖','if answer[i] is None:answer[i]=max(initial[i],floor)','answer[i]=max(initial[i] if answer[i] is None else answer[i],floor)'),('倒序覆盖最后赋值','elif answer[x-1] is None:','elif True:')],3500100,time=6,output='输出n个最终价格。')
def drives_oracle(x):
    games,children=x;loads=[];best=sum(games)
    def assign(i):
        nonlocal best
        if i==len(games):
            if len(loads)==children:best=min(best,max(loads))
            return
        seen=set()
        for j in range(len(loads)):
            if loads[j] in seen:continue
            seen.add(loads[j]);loads[j]+=games[i];assign(i+1);loads[j]-=games[i]
        if len(loads)<children:loads.append(games[i]);assign(i+1);loads.pop()
    assign(0);return best
add(135,'任意分配游戏所需的最小统一硬盘容量','把全部游戏分给N个孩子，每个游戏不可拆分，每个孩子至少一个。允许任意分组，不要求原数组连续。所有硬盘容量相同，求能容纳分配的最小容量。来源无规模，本站采用可精确求解的小规模，不以连续划分替代任意分配。','第一行m N，第二行m个游戏大小。本站1≤N≤m≤15，1≤大小≤10⁹；这些上界不是来源提供的约束。','二分容量，用子集DP判断能否装入至多N个箱子。状态保存装完该子集的最少箱数，以及此箱数下最后一箱最小用量；枚举最后加入哪个游戏。','相同已选集合中，较少箱数优先，箱数相同时最后箱更空不劣，这个字典序最小状态足以支配其他安排。枚举最后加入项构造全部装箱顺序，得到最少箱数。若少于N，因为m≥N且每项独立，可拆分非空箱至恰N箱而不增容量。可行性随容量单调，二分得最优。','时间O(m·2^m·log S)，空间O(2^m)，S为总大小。',[([6,7,10,12,1],3),([8,8,8],2),([3,9,2],3)],'样例1：分为6+7、12+1、10，最大13；容量12时12独占，10最多配1，6与7又不能同盘，至少需要4盘，最优13。样例2：必有一个孩子拿两个8，容量16。样例3：每人一个，容量取最大9。',lambda r:(lambda m:([r.randint(1,12) for _ in range(m)],r.randint(1,m)))(r.randint(1,7)),[(([10**9]*15,8),2000000000),((list(range(1,16)),3),40),(([10**9]*15,15),1000000000),(([10**9]*15,1),15000000000)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',drives_oracle,
'''def solve(d):
    m,children=map(int,d[:2]);games=list(map(int,d[2:]));total=sum(games);lo=max(max(games),(total+children-1)//children);hi=total
    def feasible(capacity):
        dp=[(m+1,0)]*(1<<m);dp[0]=(1,0)
        for mask in range(1,1<<m):
            best=(m+1,0);bits=mask
            while bits:
                bit=bits&-bits;i=bit.bit_length()-1;rides,load=dp[mask^bit]
                candidate=(rides,load+games[i]) if load+games[i]<=capacity else (rides+1,games[i])
                if candidate<best:best=candidate
                bits-=bit
            dp[mask]=best
        return dp[-1][0]<=children
    while lo<hi:
        middle=(lo+hi)//2
        if feasible(middle):hi=middle
        else:lo=middle+1
    return str(lo)
''',[('只看总和平均与最大项','return str(lo)','return str(max(max(games),(total+children-1)//children))'),('容量只取最大单项','return str(lo)','return str(max(games))')],400,time=10)
BLOCKED={116:'关键句在不允许的子序列定义处截断，缺少禁用模式及允许操作，单个样例不能恢复。',131:'正文反复要求追加到resultWord使其成为searchWord子序列，但abcz/azdb样例追加db不可能；不能未经依据改成向searchWord追加的另一题。'}
def execute(path,inputs):
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300,check=True)
    values=json.loads(result.stdout);assert len(values)==len(inputs);return [v.rstrip('\n') for v in values]
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[]
    for s in SPECS:
        assert s['bound']<=32*1024*1024
        identifier=f"oa-amazon-{s['n']}";rng=random.Random(SEED+s['n']);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        oracle=[dict(input=s['encode'](x),expectedOutput=str(s['oracle'](x))+'\n') for x in s['samples']+[s['random'](rng) for _ in range(160)]];tests=oracle[:3]+[dict(input=s['encode'](x),expectedOutput=str(y)+'\n') for x,y in s['edges']]+oracle[3:27]
        for c in tests+oracle:assert len(c['input'].encode())<=s['bound'] and '\ufffd' not in c['input']+c['expectedOutput']
        for i,(actual,c) in enumerate(zip(execute(path,[c['input'] for c in oracle+tests]),oracle+tests)):assert actual==c['expectedOutput'].rstrip('\n'),(identifier,i,actual[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];killed=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(identifier,name);changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{identifier}-{j}.py';mp.write_text(changed);outputs=execute(mp,[c['input'] for c in cases]);bad=[i for i,(actual,c) in enumerate(zip(outputs,cases)) if actual!=c['expectedOutput'].rstrip('\n')];assert bad,(identifier,name,'survived');mutants.append(dict(name=name,code=changed));killed.append(dict(name=name,rejectedByCases=bad))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Amazon'],description=s['desc']+'\n\n标准I/O与题解由本站独立编写；注明本站的范围不是来源原约束。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('time',4),memoryLimit=s.get('memory',262144),outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        raw=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout;assert '\ufffd' not in raw
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)];source=sources[identifier]
        for folder,data in dict(packages=json.loads(raw),oracles=oracle,mutants=mutants,editorials=dict(schemaVersion=1,id=identifier,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        assert len(cases)<=64 and s.get('time',4)<=10 and (OUT/'packages'/f'{identifier}.json').stat().st_size<128*1024*1024
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(raw.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracle),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=s['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()));print(identifier,'163 oracle,',len(cases)-3,'hidden, 2 normal mutants rejected',flush=True)
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped={f'oa-amazon-{k}':v for k,v in BLOCKED.items()},note='Local batched runpy only, fresh __main__/stdin/stdout per case, not per-case OS isolation; production sandbox required.'),ensure_ascii=False,indent=2)+'\n')
    # Historical recovery reviews are owned by root through resolutions, never duplicated here.
    notes={119:'源例解释aa不满足定义，修正为ai；双字符平衡只计一次。',129:'依同步向右规则修正样例2；全0输出-1为本站I/O约定。',130:'保留重复和空串；修正源例凭空改字符。',132:'依据前两例明确全批结束后下班重启、丢弃超额。',135:'来源未给规模，本站m≤15精确任意分配，不限定连续分组。'}
    reviews=[dict(id=f'oa-amazon-{n}',status='blocked' if n in BLOCKED else 'authored',reason=BLOCKED.get(n,notes.get(n,'独立算法/样例/暴力oracle/最大范围/语义负控验证；未执行来源题解。'))) for n in range(116,136)]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
