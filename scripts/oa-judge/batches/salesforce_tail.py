"""Original Salesforce21–43:19 ready,4 blocked. Upstream is evidence only.
Only --small is permitted locally; all maximum fixtures are lazy/remote-only.
"""
from pathlib import Path
from itertools import combinations,product
from functools import lru_cache
from collections import deque
import hashlib,json,random,subprocess,sys,time,gc
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='salesforce-tail';SEED=20262000;SPECS=[];MOD=1000000007
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def js(v):return json.dumps(v,ensure_ascii=True,separators=(',',':'))+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def perfect_oracle(a):return str(sum(min(abs(x-y),abs(x+y))<=min(abs(x),abs(y)) and max(abs(x-y),abs(x+y))>=max(abs(x),abs(y)) for x,y in combinations(a,2)))
def perfect_edges():
    yield [0]*200000,'19999900000'
    yield [-10**9,10**9]*100000,'19999900000'
    yield [0]*100000+[10**9]*100000,'9999900000'
    yield [500000000]*100000+[10**9]*100000,'19999900000'
add(21,'同时满足两条绝对值不等式的索引对','统计0≤i<j<n中同时满足min(|x−y|,|x+y|)≤min(|x|,|y|)及max(|x−y|,|x+y|)≥max(|x|,|y|)的索引对，其中x=a[i]、y=a[j]。重复值按索引分别计数。','输入n和n个整数。完整原界2≤n≤200000，−10^9≤a[i]≤10^9；raw恢复catalog被HTML过滤吞掉的i<j条件。','取绝对值排序。设a≤b，则两条式子化为b−a≤a和b+a≥b，所以只需b≤2a；双指针统计窗口中的索引对。','绝对值和差的较小者为b−a，较大者为b+a。第二式恒真，第一式等价b≤2a。排序不改变索引对数量，每个右端点的合法左端点是连续后缀，滑动左端后累加窗口长度恰好计数一次。','时间O(n log n)，空间O(n)，答案最大19999900000，须64位。',[[2,5,-3],[0,0,1],[-2,4,-5]],lambda r:[r.randint(-8,8) for _ in range(r.randint(2,10))],perfect_edges,arr,perfect_oracle,
'''def solve(raw):
    values=list(map(int,raw.split()));a=sorted(abs(x) for x in values[1:]);left=0;answer=0
    for right,value in enumerate(a):
        while value>2*a[left]:left+=1
        answer+=right-left
    return str(answer)
''',[('错误将负数截断到0','sorted(abs(x) for x in values[1:])','sorted(max(0,x) for x in values[1:])'),('错误漏计相同值对','answer+=right-left','answer+=max(0,right-left-1)')],2400020)

def special_encode(v):s,k,bits=v;return s+'\n'+str(k)+'\n'+bits+'\n'
def special_oracle(v):
    s,k,b=v;return str(max([0]+[j-i for i in range(len(s)) for j in range(i+1,len(s)+1) if sum(b[ord(c)-97]=='0' for c in s[i:j])<=k]))
def special_random(r):
    s=''.join(r.choice('abcxyz') for _ in range(r.randint(1,12)));return s,r.randint(1,len(s)),''.join(r.choice('01') for _ in range(26))
def special_edges():
    yield ('a'*100000,1,'0'*26),'1'
    yield ('z'*100000,1,'1'*26),'100000'
    yield ('az'*50000,50000,'0'*26),'50000'
    yield ('a'*100000,100000,'0'*26),'100000'
add(22,'至多含k个普通字符的最长片段','26位charValue依次对应a..z，0为普通字符，1为特殊字符。求s中普通字符出现次数不超过k的最长连续子串长度，重复普通字符按出现次数计数。','输入三行s、k、charValue。原界1≤|s|≤100000，s为a..z，charValue长26且仅0/1；原length of k是整数参数的笔误，明确1≤k≤|s|。','右端递增并累计普通字符数，超过k时移动左端直到合法。','普通字符贡献非负，缩短窗口不会增大总数。每个右端的最小合法左端给出该右端最长合法串；枚举所有右端取最大即全局最优。','时间O(n)，除输入外空间O(1)。',[('giraffe',2,'01111001111111111011111111'),('special',1,'0'*26),('abcde',1,'10101'+'1'*21)],special_random,special_edges,special_encode,special_oracle,
'''def solve(raw):
    s,amount,bits=raw.split();k=int(amount);left=normal=answer=0
    for right,ch in enumerate(s):
        normal+=bits[ord(ch)-97]=='0'
        while normal>k:
            normal-=bits[ord(s[left])-97]=='0';left+=1
        answer=max(answer,right-left+1)
    return str(answer)
''',[('交换普通特殊含义',"=='0'","=='1'"),('错误使用严格小于k','while normal>k:','while normal>=k:')],100050)

def hours_encode(v):a,b=v;return arr(a)+seq(b)+'\n'
def hours_oracle(v):
    a,b=v;n=len(a);return str(min(max(sum(b[i] for i in range(n) if mask>>i&1),max([0]+[a[i] for i in range(n) if not(mask>>i&1)])) for mask in range(1<<n)))
def hours_random(r):n=r.randint(1,9);return [r.randint(0,20) for _ in range(n)],[r.randint(0,20) for _ in range(n)]
def hours_edges():
    yield ([10**9]*200000,[10**9]*200000),'1000000000'
    yield ([10**9]*200000,[1]*200000),'200000'
    yield ([0]*200000,[10**9]*200000),'0'
    yield ([10**9]*200000,[0]*200000),'0'
add(23,'并行开发与串行集成的最短完成时间','每个功能必须选择开发或集成。开发者足够，所有开发同时开始；集成仅由组长依次完成，且与开发并行进行。求全部功能完成的最短时间。','输入n，随后n个developmentTime和n个integrationTime。原无数值界，本站补充1≤n≤200000，所有时间为0..10^9整数。','二分总时间T：开发耗时大于T的功能必须集成，其集成耗时之和不得超过T；其余都开发即可。','若开发时间>T便不能开发，给出必须集成集合。其和>T时任何方案不可能在T完成；反之把该集合交给组长、其余并行开发即可在T完成。判定随T单调，因此二分返回最小可行值。','时间O(n log(1+最大开发时间))，空间O(n)，累加使用64位。',[([3,4,5,9],[3,2,5,5]),([8,10,6,7],[1,2,2,1]),([0,5],[9,0])],hours_random,hours_edges,hours_encode,hours_oracle,
'''def solve(raw):
    v=list(map(int,raw.split()));n=v[0];development=v[1:n+1];integration=v[n+1:];lo=0;hi=max(development)
    while lo<hi:
        mid=(lo+hi)//2;required=sum(b for a,b in zip(development,integration) if a>mid)
        if required<=mid:hi=mid
        else:lo=mid+1
    return str(lo)
''',[('错把并行两类相加','return str(lo)','return str(min(sum(integration),max(development)+min(integration)))'),('错把多个集成同时完成','required=sum(b for a,b in zip(development,integration) if a>mid)','required=max([0]+[b for a,b in zip(development,integration) if a>mid])')],4400020,timeLimit=10)

def graph_encode(v):n,edges,s,t=v;return f'{n} {len(edges)}\n'+''.join(f'{a} {b} {w}\n' for a,b,w in edges)+f'{s}\n{t}\n'
def graph_oracle(v):
    n,edges,s,t=v
    if s==t:return '0'
    adj={}
    for a,b,w in edges:adj.setdefault(a,[]).append((b,w));adj.setdefault(b,[]).append((a,w))
    answer=None
    def search(u,seen,cost):
        nonlocal answer
        if u==t:answer=cost if answer is None else min(answer,cost);return
        for w,c in adj.get(u,[]):
            if w not in seen:search(w,seen|{w},max(cost,c))
    search(s,{s},0);return str(-1 if answer is None else answer)
def graph_random(r):
    n=r.randint(1,7);ids=[10**55-i for i in range(n)] if r.randrange(4)==0 else list(range(1,n+1));edges=[(r.choice(ids),r.choice(ids),r.randint(0,20)) for _ in range(r.randint(1,9))];return max(ids),edges,r.choice(ids),r.choice(ids)
def graph_edges():
    top=10**55
    yield (top,[(top-i,top-i-1,10**9) for i in range(100000)],top,top-100000),'1000000000'
    yield (top,[(top-i,top-i-1,0) for i in range(100000)],top,top-100000),'0'
    yield (top,[(1,2,i%1000) for i in range(100000)],1,top),'-1'
    yield (top,[(top,top,10**9)]*100000,top,top),'0'
add(24,'超大稀疏节点标签图的最小瓶颈路径','无向图路径的代价是路径中最大的边权，求source到destination的最小代价；不连通输出−1。本站补充source=destination的空路径代价为0。自环及平行边均可出现。','输入N M、M行u v weight，再输入source及destination。原M为1..100000，边权0..10^9，标签1..N。原N上界写成10<sup>5</sup>5，存在多余5，本站公开采用宽容上界1≤N≤10^55覆盖该损坏写法的常见解释，不声称这是来源确定原界。大标签按十进制整数读取，只存出现的节点。','按边权递增合并端点，第一次使起终点同属连通块的边权即答案。用字典压缩出现的节点，绝不按N分配数组。','权值不超过W的边组成子图：起终点在该子图连通，当且仅当存在最大边权≤W的路径。按权排序累积连通性，首次连通的W最小；全处理后不连通就没有路径。','时间O(M log M)，空间O(M)，最多200002个实际标签，与N的数值无关。',[(4,[(2,1,100),(2,3,200),(1,4,10),(4,3,20)],1,3),(10**55,[(1,2,7)],1,10**55),(1,[(1,1,9)],1,1)],graph_random,graph_edges,graph_encode,graph_oracle,
'''def solve(raw):
    import re
    from array import array
    values=(int(m.group()) for m in re.finditer(r'\\d+',raw));n=next(values);m=next(values);labels={};parent=array('i');size=array('i');edges=[]
    def index(x):
        if x not in labels:labels[x]=len(parent);parent.append(len(parent));size.append(1)
        return labels[x]
    for _ in range(m):
        u=index(next(values));v=index(next(values));w=next(values);edges.append((w,u,v))
    source=index(next(values));destination=index(next(values))
    if source==destination:return '0'
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for weight,u,v in sorted(edges):
        a=find(u);b=find(v)
        if a!=b:
            if size[a]<size[b]:a,b=b,a
            parent[b]=a;size[a]+=size[b]
        if find(source)==find(destination):return str(weight)
    return '-1'
''',[('按降序合并造成最大瓶颈','sorted(edges)','sorted(edges,reverse=True)'),('不连通错误返回0',"return '-1'","return '0'")],12500200,timeLimit=10)

def substring_oracle(v):
    x,y=v;best=0
    for i in range(len(y)):
        for j in range(i+1,len(y)+1):
            k=0
            for ch in x:
                if k<j-i and ch==y[i+k]:k+=1
            if k==j-i:best=max(best,k)
    return str(best)
def substring_random(r):return tuple(''.join(r.choice('ab A\x00😀') for _ in range(r.randint(0,10))) for _ in range(2))
def substring_edges():
    yield ('😀'*1000,'😀'*1000),'1000'
    yield ('a'*1000,'b'*1000),'0'
    yield ('aX'*500,'a'*1000),'500'
    yield ('','\x00'*1000),'0'
add(25,'X的子序列与Y的连续子串的最大共同长度','找一个字符串，要求它是X的子序列，同时是Y的连续子串，求最长长度。X可以跳过字符，Y不能跳过字符；无共同字符时输出0。','输入JSON数组[X,Y]。原未给数值或字符域，本站补充每串0..1000个Unicode标量值，允许空串、空白、控制字符和非BMP；不含孤立代理项。JSON编码UTF-8总输入≤25000字节。','dp[j]保存已处理X前缀中可作为子序列、且在Y第j个字符结尾的最长连续串。每读X一个字符，按j倒序更新相等位置为max(旧值,dp[j−1]+1)。','不使用当前X字符时保留旧状态；使用时必须匹配Y当前位置，之前匹配必须连续结束于Y前一位置。倒序保证读取上一轮状态，不重复使用同一个X字符，两类转移穷尽合法匹配。','时间O(|X||Y|)，空间O(|Y|)。',[('abcd','abdc'),('hackerranks','hackers'),('','abc')],substring_random,substring_edges,js,substring_oracle,
'''def solve(raw):
    import json
    x,y=json.loads(raw);dp=[0]*(len(y)+1)
    for ch in x:
        for j in range(len(y),0,-1):
            if ch==y[j-1]:dp[j]=max(dp[j],dp[j-1]+1)
    return str(max(dp))
''',[('错误正向原地更新重复使用X字符','range(len(y),0,-1)','range(1,len(y)+1)'),('交换X与Y的连续性','x,y=json.loads(raw)','y,x=json.loads(raw)')],25000,timeLimit=10)

def cores_oracle(a):
    def play(i,holder):
        if i==len(a):return 0,0
        own=list(play(i+1,1-holder));own[holder]+=a[i]
        other=list(play(i+1,holder));other[1-holder]+=a[i]
        return tuple(own if own[holder]>=other[holder] else other)
    return seq(play(0,0))
def cores_edges():
    yield [10**9]*200000,'100000000000000 100000000000000'
    yield [0]*199999+[10**9],'1000000000 0'
    yield [10**9,0]*100000,'50000000000000 50000000000000'
add(27,'双核持锁选择博弈的最优收益','按顺序分配任务，初始第一核持锁。持锁核可把当前任务分给自己并交锁，或分给另一核并留锁。双方都最大化自己最终得到的处理时间总和，输出第一核、第二核最终收益。','输入n和n个任务时间。原无数值界，本站补充1≤n≤200000，0≤time[i]≤10^9。','从后往前维护持锁者相对另一核的最优收益差d，初值0，每项更新为|time−d|。最后由总和S还原两核收益(S+d)/2和(S−d)/2。','自取并交锁产生分差time−d，给对方并留锁产生分差d−time。固定总和下最大化个人收益等价于最大化分差，两者较大值即绝对值。倒序归纳成立；并列时两核收益仍由同一总和与分差唯一确定。','时间O(n)，除输入外空间O(1)，收益使用64位。',[[10,10,10,10],[10,15,20,25,30],[45,25,35,15,45,25]],lambda r:[r.randint(0,20) for _ in range(r.randint(1,10))],cores_edges,arr,cores_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:];difference=0
    for value in reversed(a):difference=abs(value-difference)
    total=sum(a);return f'{(total+difference)//2} {(total-difference)//2}'
''',[('错误从前往后处理博弈','reversed(a)','a'),('错误所有任务都分第一核',"return f'{(total+difference)//2} {(total-difference)//2}'","return f'{total} 0'")],2200020,output='按第一核、第二核顺序输出两个整数收益，以空格分隔。')

def almost_oracle(a):
    best=len(a)
    for mask in range(1<<len(a)):
        keep=[x for i,x in enumerate(a) if mask>>i&1]
        for remove in range(-1,len(keep)):
            final=[x for i,x in enumerate(keep) if i!=remove]
            if all(x<y for x,y in zip(final,final[1:])):best=min(best,len(a)-len(keep));break
    return str(best)
def almost_edges(n):
    yield list(range(1,100001)),'0'
    yield list(range(10**9,10**9-100000,-1)),'99998'
    yield list(range(1,100000))+[0 if n==30 else 10**9],'0'
    if n==30:yield list(range(-10**9,-10**9+100000)),'0'
ALMOST_CODE='''def solve(raw):
    from bisect import bisect_left
    a=list(map(int,raw.split()))[1:];tails=[]
    for x in a:
        i=bisect_left(tails,x)
        if i==len(tails):tails.append(x)
        else:tails[i]=x
    return str(max(0,len(a)-len(tails)-1))
'''
for number in (29,30):
    add(number,'删除最少元素使数组至多再删一次即可升序','数组元素互异。称一个数组几乎升序，当且仅当至多再删一个元素就严格升序。求从给定数组至少删除多少元素，使剩余数组几乎升序。'+('原例解释中的删7应为删1。' if number==29 else '原文误将[13]与[9,2]拼为[13,9,2]并称合法，依完整定义与同题29纠正：三项下降不是几乎升序。'), '输入n和n个互异整数。'+('完整原界1≤n≤100000，1≤a[i]≤10^9。' if number==29 else '原未给数值界，本站补充1≤n≤100000，−10^9≤a[i]≤10^9。'), '求严格最长递增子序列长L，答案max(0,n−L−1)。', '若保留m个元素且再删至多一个就递增，则原数组有长度至少m−1的递增子序列，所以m≤L+1。反过来选一个LIS，再加入任意一个未选元素，就得到删除该额外元素后递增的数组，达到min(n,L+1)。','时间O(n log n)，空间O(n)。',[[3,4,2,5,1],[4,2,1],[13]],lambda r,n=number:r.sample(range(1 if n==29 else -15,30),r.randint(1,9)),lambda n=number:almost_edges(n),arr,almost_oracle,ALMOST_CODE,[('错误要求直接升序','len(a)-len(tails)-1','len(a)-len(tails)'),('错误允许再删两项','len(a)-len(tails)-1','len(a)-len(tails)-2')],1200020)

def words_encode(words):return str(len(words))+'\n'+'\n'.join(words)+'\n'
def replacements_oracle(words):
    # DP over actual replacement characters, not equal-character run lengths.
    result=[]
    for word in words:
        costs=[0]*26
        for ch in word:costs=[min(costs[p] for p in range(26) if p!=q)+(ord(ch)-97!=q) for q in range(26)]
        result.append(min(costs))
    return seq(result)
def replacements_random(r):return [''.join(r.choice('abcz') for _ in range(r.randint(2,10))) for _ in range(r.randint(1,5))]
def replacements_edges():
    yield ['z'*100000]*100,seq([50000]*100)
    yield ['ab'*50000]*100,seq([0]*100)
    yield ['aab'*33333+'c']*100,seq([33333]*100)
add(31,'逐词消除相邻相同字符的最少替换数','对每个小写英文单词，允许将任意字符替换为任意小写字母，求使相邻字符全部不同时最少替换数。每词独立输出。','输入词数n及n行单词。保留完整原界1≤n≤100，每个单词长度2..100000，字符a..z；不加总长缩水约束，总字符数可以达到10000000。','把每个词按连续相同字符分段，长度L的段贡献floor(L/2)。','每段内取不相交的相邻字符对，每对至少改一项，给出floor(L/2)下界。隔一个字符修改一次，并选不同于两侧的字母；26字符足够，恰达到下界且不会破坏段间边界。各段相加。','时间O(全部字符数)，每词扫描O(1)额外状态；最大输入10000104字节。',[['add','boook','break'],['ab','aab','abb','abab','abaaaba'],['zz','zzzzzz']],replacements_random,replacements_edges,words_encode,replacements_oracle,
'''def solve(raw):
    import io
    stream=io.StringIO(raw);n=int(stream.readline());result=[]
    for _ in range(n):
        word=stream.readline().rstrip('\\r\\n');last=None;run=answer=0
        for ch in word:
            if ch==last:run+=1
            else:answer+=run//2;run=1;last=ch
        answer+=run//2;result.append(answer)
    return ' '.join(map(str,result))
''',[('漏计最后一段','answer+=run//2;result.append(answer)','result.append(answer)'),('每个相等相邻对都必须改','run//2','max(0,run-1)')],10000110,timeLimit=10,output='按输入顺序输出每个单词的最少替换数，以空格或换行分隔。')

def run_length(s):
    best=run=0;last=None
    for c in s:run=run+1 if c==last else 1;last=c;best=max(best,run)
    return best
def flips_encode(v):s,k=v;return s+'\n'+str(k)+'\n'
def flips_oracle(v):
    s,k=v;answer=len(s)
    for mask in range(1<<len(s)):
        if mask.bit_count()<=k:answer=min(answer,run_length(''.join(str(int(c)^(mask>>i&1)) for i,c in enumerate(s))))
    return str(answer)
def flips_random(r):s=''.join(r.choice('01') for _ in range(r.randint(1,10)));return s,r.randint(0,len(s))
def flips_edges():
    yield ('0'*100000,0),'100000'
    yield ('0'*100000,50000),'1'
    yield ('01'*50000,0),'1'
    yield ('0'*100000,33333),'2'
add(32,'至多翻转k次后的最短最大同字符段','给定二进制字符串，至多翻转k个位置，使最长连续相同字符片段尽可能短，输出该最小长度。','输入二进制字符串s和k。完整原界位于正文：1≤|s|≤100000、0≤k≤|s|，不能因Constraints栏为空而丢失。','二分最大段长L。L=1时计算变为两种交替串的最少翻转数；L≥2时，每个原段长r至少需要floor(r/(L+1))次，求和判断≤k。','长r的原段每L+1个连续字符必须翻至少一次，给出所需下界。L≥2时可把翻转隔开，并在端部调整位置避免与邻段合并，实现该数目；各段独立达到界。L=1时所有相邻位置都必须相反，只能是两种交替串，需专门比较Hamming距离。可行性随L单调，二分正确。','时间O(n log n)，空间O(n)保存原段。',[('00000',2),('001100',1),('1',0)],flips_random,flips_edges,flips_encode,flips_oracle,
'''def solve(raw):
    s,amount=raw.split();k=int(amount);mismatch=sum(int(ch)!=(i%2) for i,ch in enumerate(s))
    if min(mismatch,len(s)-mismatch)<=k:return '1'
    runs=[];length=0;last=None
    for ch in s:
        if ch==last:length+=1
        else:
            if length:runs.append(length)
            length=1;last=ch
    runs.append(length);lo=2;hi=max(runs)
    while lo<hi:
        mid=(lo+hi)//2
        if sum(r//(mid+1) for r in runs)<=k:hi=mid
        else:lo=mid+1
    return str(lo)
''',[('忽略翻转直接返回原最长段','return str(lo)','return str(max(runs))'),('翻转次数错误多算为除以L','r//(mid+1)','r//mid')],100020)

def partition_encode(v):a,k=v;return f'{len(a)} {k}\n'+seq(a)+'\n'
def partition_oracle(v):
    a,k=v;n=len(a)
    if n==0:return '0' if k==0 else '-1'
    if k<1 or k>n:return '-1'
    answer=None
    for cuts in combinations(range(1,n),k-1):
        borders=(0,)+cuts+(n,);value=sum(max(a[borders[i]:borders[i+1]]) for i in range(k));answer=value if answer is None else min(answer,value)
    return str(answer)
def partition_random(r):return [r.randint(0,30) for _ in range(r.randint(0,9))],r.randint(0,10)
def partition_edges(upper):
    yield ([upper]*300,300),str(upper*300)
    yield ([upper]*300,150),str(upper*150)
    yield (list(range(300)),150),str(299+149*148//2)
    yield ([upper]*300,0),'-1'
    yield ([],300),'-1'
    yield ([],0),'0'
PARTITION_CODE='''def solve(raw):
    values=list(map(int,raw.split()));n,k=values[:2];a=values[2:]
    if n==0:return '0' if k==0 else '-1'
    if k<1 or k>n:return '-1'
    infinity=10**30;previous=[infinity]*(n+1);previous[0]=0
    for groups in range(1,k+1):
        current=[infinity]*(n+1)
        for end in range(groups,n+1):
            largest=0;best=infinity
            for start in range(end-1,groups-2,-1):
                largest=max(largest,a[start]);best=min(best,previous[start]+largest)
            current[end]=best
        previous=current
    return str(previous[n])
'''
for number in (33,39):
    upper=10**9 if number==33 else 100000
    add(number,'按顺序分为恰好k段，最小化各段最大值之和','保持输入顺序，将数组分为恰好k个非空连续段，每段成本为该段最大元素，求所有段成本之和的最小值。'+('每段对应一个星期的活动。' if number==33 else '注意本题并非同名的最小化最大段和问题。')+'本站补充无解时输出−1，空数组分0段输出0。','输入n k和n个非负整数。'+('原没有数值界，本站补充0≤n,k≤300、0≤a[i]≤10^9。' if number==33 else '保留完整原界0≤n,k≤300、0≤a[i]≤100000。')+'不排除k>n、n=0或k=0，按上述协议处理。','按段数动态规划。枚举最后一段的左边界，转移为此前最优成本加最后一段最大值；向左扩展时增量维护最大值。','每个合法分段方案具有唯一最后一段起点，去掉最后一段后是前缀恰好少一段的方案。对所有合法起点取最小，并使用归纳已正确的前缀最优值，恰覆盖全部方案。空前缀0段为0，其余不可能状态为无穷。','时间O(kn²)，滚动空间O(n)，使用64位成本。', [([1000,500,2000,8000,1500],3),([],0),([1,2],3)] if number==33 else [([1,2,3,4,5],2),([],0),([1,2],3)],partition_random,lambda u=upper:partition_edges(u),partition_encode,partition_oracle,PARTITION_CODE,[('错误把段最大值改成段和','largest=max(largest,a[start])','largest+=a[start]'),('错误将无解返回0',"if k<1 or k>n:return '-1'","if k<1 or k>n:return '0'")],3400,timeLimit=10)

def difference_oracle(a):
    pairs=[(abs(x-y),min(x,y),max(x,y)) for x,y in combinations(a,2)];best=min(p[0] for p in pairs)
    return '\n'.join(f'{x} {y}' for d,x,y in sorted(pairs) if d==best)
def difference_edges():
    a=list(range(-10**9,-10**9+100000));yield a,'\n'.join(f'{x} {x+1}' for x in a[:-1])
    a=list(range(10**9-99999,10**9+1));yield a,'\n'.join(f'{x} {x+1}' for x in a[:-1])
    yield [-10**9,10**9],'-1000000000 1000000000'
add(34,'输出全部最小绝对差的数值对','数组元素互异，输出所有绝对差最小的数值对。每对较小值在前，各对按第一项再第二项升序。原例[-1,3,6,-5,0]输出错误：最小差为1，正确唯一数值对是−1与0，不是差3的两对。','输入n和n个互异整数。原没有数值界，本站补充2≤n≤100000，−10^9≤a[i]≤10^9。','排序后求相邻元素差的最小值，再按序输出所有达到该差的相邻对。','若一对之间还有其他数，则它们的差被两个正差分开，必严格大于至少一个相邻差，所以最小差只能来自相邻元素。按排序顺序扫描自然满足全部结果的排序要求。','时间O(n log n)，空间O(n+输出)，最坏输出小于2400000字节。',[[-1,3,6,-5,0],[4,2,1,3],[-7,9]],lambda r:r.sample(range(-20,30),r.randint(2,10)),difference_edges,arr,difference_oracle,
'''def solve(raw):
    a=sorted(map(int,raw.split()[1:]));best=min(y-x for x,y in zip(a,a[1:]))
    pairs=[f'{x} {y}' for x,y in zip(a,a[1:]) if y-x==best]
    return '\\n'.join(pairs)
''',[('只输出一个最优数值对',"return '\\n'.join(pairs)","return '\\n'.join(pairs[:1])"),('错误输出最大差对','best=min(y-x','best=max(y-x')],1200020,output='每行输出一对最小绝对差数值，共输出全部最优对，不输出对数或差值。')

def cuts_encode(v):a,minimum=v;return arr(a)+str(minimum)+'\n'
def cuts_oracle(v):
    a,minimum=v;n=len(a)
    @lru_cache(None)
    def search(pieces):
        if len(pieces)==n:return True
        for p,(left,right) in enumerate(pieces):
            if right-left>1 and sum(a[left:right])>=minimum:
                for cut in range(left+1,right):
                    if search(pieces[:p]+((left,cut),(cut,right))+pieces[p+1:]):return True
        return False
    return 'Possible' if search(((0,n),)) else 'Impossible'
def cuts_random(r):return [r.randint(1,10) for _ in range(r.randint(2,8))],r.randint(1,30)
def cuts_edges():
    yield ([10**9]*200000,2*10**9),'Possible'
    yield ([10**9]*200000,2*10**9+1),'Impossible'
    yield ([10**9]*200000,10**18),'Impossible'
    yield ([1]*200000,2),'Possible'
add(35,'规划杆的切割顺序','一根杆已经依次标出所有最终段的长度。机器只能切长度至少minLength的现有杆，每次在一个尚未切开的标记处分成两根。判断是否存在完成全部标记切割的顺序。','输入n、n个段长度和minLength。原没有数值界，catalog中的附加范围无原文依据；本站补充2≤n≤200000、每段1..10^9、1≤minLength≤10^18。n≥2保证确有最后一刀。','检查是否存在相邻两段的长度和至少minLength。','最后一刀所切的杆一定由相邻两个最终段组成，因此条件必要。若有满足的相邻对，则从原杆两端依次切掉其它最终段，余杆始终包含此对、长度不小于阈值；最后切开此对，构造出合法顺序，条件充分。','时间O(n)，除输入外空间O(1)，长度和及阈值使用64位。',[([3,5,4,3],9),([4,2,3],7),([4,3,2],7)],cuts_random,cuts_edges,cuts_encode,cuts_oracle,
'''def solve(raw):
    values=list(map(int,raw.split()));n=values[0];a=values[1:n+1];minimum=values[-1]
    return 'Possible' if any(x+y>=minimum for x,y in zip(a,a[1:])) else 'Impossible'
''',[('忽略相邻限制改用整杆长度','any(x+y>=minimum for x,y in zip(a,a[1:]))','sum(a)>=minimum'),('错误使用严格大于阈值','x+y>=minimum','x+y>minimum')],2200040,output='可完成输出Possible，否则Impossible。')

def replace_oracle(s):
    positions=[i for i,c in enumerate(s) if c=='?'];count=0;a=list(s)
    for replacements in product('abcdefghijklmnopqrstuvwxyz',repeat=len(positions)):
        for i,c in zip(positions,replacements):a[i]=c
        count+=all(x!=y for x,y in zip(a,a[1:]))
    return str(count%MOD)
def replace_random(r):
    a=[r.choice('abc') for _ in range(r.randint(1,8))]
    for i in r.sample(range(len(a)),r.randint(0,min(2,len(a)))):a[i]='?'
    return ''.join(a)
def replace_edges():
    yield '?'*100000,str(26*pow(25,99999,MOD)%MOD)
    yield 'a'*100000,'0'
    yield 'ab'*50000,'1'
    yield '?a'*50000,str(25*pow(25,49999,MOD)%MOD)
add(36,'替换全部问号且无相邻重复的方案数','字符串由小写字母和问号组成，每个问号可替换为任意小写字母；固定字母不可改。求替换后无相邻相同字符的方案数，对1000000007取模。','一行s，完整原界1≤|s|≤100000，字符仅a..z或?。','用26状态记录最后字母。当前位置可用字母c的新方案数等于前缀总方案数减去以c结尾的方案数。','每个合法新前缀由一个合法旧前缀及不同于其末字母的新字符唯一组成；总数减去同末字母方案恰好排除唯一非法类别。固定字母仅保留对应状态，问号允许全部状态，逐位置归纳。','时间O(26n)，空间O(26)。',['??','a?a','aa'],replace_random,replace_edges,lambda s:s+'\n',replace_oracle,
'''def solve(raw):
    s=raw.strip();mod=1000000007;dp=[int(s[0]=='?' or ord(s[0])-97==c) for c in range(26)]
    for ch in s[1:]:
        total=sum(dp)%mod
        dp=[(total-dp[c])%mod if ch=='?' or ord(ch)-97==c else 0 for c in range(26)]
    return str(sum(dp)%mod)
''',[('未排除相同末字母','(total-dp[c])%mod','total%mod'),('错误问号只允许25种字母','range(26)','range(25)')],100001,timeLimit=10)

def same_oracle(v):
    s,t,k=v;return str(max([0]+[j-i for i in range(len(s)) for j in range(i+1,len(s)+1) if sum(abs(ord(s[p])-ord(t[p])) for p in range(i,j))<=k]))
def same_random(r):n=r.randint(0,12);return ''.join(r.choice('abcz') for _ in range(n)),''.join(r.choice('abcz') for _ in range(n)),r.randint(0,60)
def same_edges():
    yield ('a'*200000,'z'*200000,10**9),'200000'
    yield ('a'*200000,'z'*200000,4999999),'199999'
    yield ('a'*200000,'z'*200000,0),'0'
    yield ('a'*200000,'a'*200000,0),'200000'
add(37,'预算内修改为对应位置字符串的最长片段','s与t等长且仅含小写字母。把s[i]改为t[i]的成本为ASCII差的绝对值。求一个连续区间，使该区间逐位置转换的总成本≤K，返回最大区间长度；找不到非空区间则0。','输入JSON数组[s,t,K]。原无数字界，本站补充0≤|s|=|t|≤200000、0≤K≤10^9；输入编码总字节≤401000。','将位置成本作为非负数组，用双指针维护总成本不超过K的最长窗口。','缩小区间不会增加非负成本，右端增加后仅需移动左端直到重新合法。此时左端最小，得到该右端最长合法区间；逐一比较覆盖全局最优。','时间O(n)，除输入外空间O(1)。',[('abcd','bcdf',3),('az','za',0),('','',0)],same_random,same_edges,js,same_oracle,
'''def solve(raw):
    import json
    s,t,k=json.loads(raw);left=cost=answer=0
    for right in range(len(s)):
        cost+=abs(ord(s[right])-ord(t[right]))
        while cost>k:
            cost-=abs(ord(s[left])-ord(t[left]));left+=1
        answer=max(answer,right-left+1)
    return str(answer)
''',[('错误允许负修改成本','abs(ord(s[right])-ord(t[right]))','ord(s[right])-ord(t[right])'),('错误把ASCII差当不同字符数','abs(ord(s[right])-ord(t[right]))','int(s[right]!=t[right])')],401000)

def forbidden_oracle(v):
    # Equality-pattern enumeration weighted by injections into all26 letters.
    n,k=v;answer=0
    def walk(i,used,last,run):
        nonlocal answer
        if i==n:
            factor=1
            for d in range(used):factor*=26-d
            answer+=factor;return
        for label in range(used+1):
            following=run+1 if label==last else 1
            if following<k:walk(i+1,max(used,label+1),label,following)
    walk(0,0,-1,0);return str(answer%MOD)
def forbidden_random(r):n=r.randint(2,8);return n,r.randint(1,n-1)
def forbidden_edges():
    yield (100000,1),'0'
    yield (100000,2),str(26*pow(25,99999,MOD)%MOD)
    # k=n-1: invalid union of constant first/last(n-1); overlap all equal.
    yield (100000,99999),str((pow(26,100000,MOD)-(26*26*2-26))%MOD)
add(41,'不含k个连续相同字母的字符串计数','统计长度n的小写英文字符串中不含k个或更多连续相同字母的数量，模1000000007。连续最多只能k−1个，不能误读为允许k个。','输入n k。完整原界1≤n≤100000、1≤k<n，故实际合法n≥2；不能把k≤n或禁止长度改成k+1。','令F[i]为长度i的方案数。i<k时为26^i；F[k]=26^k−26；i>k时F[i]=26F[i−1]−25F[i−k]。k=1直接输出0。','任意合法长度i−1后接任意字母共有26F[i−1]。当i>k时，新产生非法串恰为合法长度i−k前缀、接一个不同于此前末字符的字母并连续重复k次，共25F[i−k]；i=k时非法串是26种全同串。相减得到无重无漏的合法数。','时间O(n)，空间O(n)保存模数数组，可进一步循环缓冲至O(k)。',[(3,2),(2,1),(5,4)],forbidden_random,forbidden_edges,lambda v:seq(v)+'\n',forbidden_oracle,
'''def solve(raw):
    n,k=map(int,raw.split());mod=1000000007
    if k==1:return '0'
    counts=[1]*(n+1)
    for i in range(1,n+1):
        counts[i]=26*counts[i-1]%mod
        if i==k:counts[i]=(counts[i]-26)%mod
        elif i>k:counts[i]=(counts[i]-25*counts[i-k])%mod
    return str(counts[n])
''',[('只返回所有字符串数','return str(counts[n])','return str(pow(26,n,mod))'),('把禁用长度错写为k加1','n,k=map(int,raw.split());mod=1000000007','n,k=map(int,raw.split());k+=1;mod=1000000007')],20)

def tool_oracle(v):
    tools,start,target=v;queue=deque([(start,0)]);seen={start}
    while queue:
        u,d=queue.popleft()
        if tools[u]==target:return str(d)
        for w in ((u-1)%len(tools),(u+1)%len(tools)):
            if w not in seen:seen.add(w);queue.append((w,d+1))
    return '-1'
def tool_random(r):
    pool=['','a','A','ab',' ','\x00','\u0085','\u2028','\u2029','😀'];n=r.randint(1,12);return [r.choice(pool) for _ in range(n)],r.randrange(n),r.choice(pool+['not present'])
def tool_edges():
    yield (['😀'*16]*100000,99999,'😀'*16),'0'
    yield (['😀'*16]*99999+['\x00'*16],0,'\x00'*16),'1'
    yield (['a']*50000+['']+['a']*49999,0,''),'50000'
    yield (['\u2028'*16]*100000,0,'\u2029'*16),'-1'
add(42,'环形工具架到目标工具的最少移动','工具名称按环形顺序排列，允许重复。当前位于startIndex，每次向左或右移动一个位置，求到任意一个目标名称位置的最少步数；本站补充找不到目标时输出−1。名称完全相等才匹配，不能忽略大小写或空白。','输入JSON数组[tools,startIndex,target]，下标零基。原无数值或字符界，本站补充1≤n≤100000、每个名称及target长0..16 Unicode标量值，允许空名、空白、NUL与非BMP，不含孤立代理项；0≤startIndex<n。整个JSON编码输入≤20000000字节，ASCII转义编码可覆盖完整最坏名字域。','遍历全部名称匹配位置i，取直线下标距离d与绕环距离n−d中的最小者，再对所有目标位置取最小。','固定目标i，最短路径只能沿环的两个方向之一，不重复边；两条长度分别d和n−d。枚举全部目标出现位置便覆盖所有可能终点，因此全局最小值正确。','时间O(总名称字符数+n)，空间O(输入字节数+n)。最坏ASCII转义名称输入约19.5MB，小于32MiB输入上限。',[(['ballendmill','keywaycutter','slotdrill','facemill'],1,'ballendmill'),(['','a',''],1,''),(['😀','\x00'],0,'absent')],tool_random,tool_edges,js,tool_oracle,
'''def solve(raw):
    import json
    tools,start,target=json.loads(raw);n=len(tools);answer=n
    for i,name in enumerate(tools):
        if name==target:
            distance=abs(i-start);answer=min(answer,distance,n-distance)
    return str(-1 if answer==n else answer)
''',[('错误只允许不绕环距离','answer=min(answer,distance,n-distance)','answer=min(answer,distance)'),('错误忽略名称的大小写','if name==target:','if name.lower()==target.lower():')],20000000,timeLimit=10)

def towers_oracle(a):return seq(sum(all(a[k]<a[j] for k in range(min(i,j)+1,max(i,j))) for j in range(len(a)) if i!=j) for i in range(len(a)))
def towers_edges():
    yield [10**9]*200000,seq([1]+[2]*199998+[1])
    yield list(range(200000)),seq([199999]+[200000-i for i in range(1,200000)])
    yield list(range(199999,-1,-1)),seq([i+1 for i in range(199999)]+[199999])
    yield [0,10**9]*100000,seq(1 if i==0 else 3 if i==1 else 2 if i==199999 or i%2==0 else 4 for i in range(200000))
add(43,'按目标塔高度判定的双向可见数','塔按顺序排列。从塔y看塔x可见，当且仅当二者之间所有塔的高度严格小于目标塔x。观察者y自身高度不构成限制。对每座塔输出左右两边一共能看见的塔数，不计自身。','输入n和n个高度。原无数值界，本站补充1≤n≤200000、0≤height[i]≤10^9。允许重复高度。','从左向右扫描，栈保留已扫描前缀从右往左看的严格纪录高塔；先把栈长加入当前可见数，再弹出高度≤当前塔的旧纪录并入栈。反向再做一次累加。','过去的塔可见恰当其高度严格大于它与当前塔之间所有高度，即该方向的严格纪录高塔。加入当前塔后，所有不高于它的旧纪录被挡住，较高者仍是纪录；单调栈维持这一不变式。左右独立且不相交，结果相加。','时间O(n)，空间O(n)。原例[5,2,10,1]得到[2,2,3,1]；不要套用双端最小高度的另一种可见规则。',[[5,2,10,1],[1,2,3],[7]],lambda r:[r.randint(0,8) for _ in range(r.randint(1,12))],towers_edges,arr,towers_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:];n=len(a);answer=[0]*n
    for order in (range(n),range(n-1,-1,-1)):
        stack=[]
        for i in order:
            answer[i]+=len(stack)
            while stack and stack[-1]<=a[i]:stack.pop()
            stack.append(a[i])
    return ' '.join(map(str,answer))
''',[('相等高度未阻挡远处同高塔','stack[-1]<=a[i]','stack[-1]<a[i]'),('漏掉右侧视线','(range(n),range(n-1,-1,-1))','(range(n),)')],2200020,output='按原位置顺序输出n个可见塔数，以空格或换行分隔。')

BLOCKED={26:'正文在choose3consecut截断，操作条件及行为缺失。',28:'报价数组长度n与项目总数numProjects混淆，原ID<n允许不存在项目；未授权改界或忽略这些报价。',38:'正文缺最大化/最小化/固定分组目标，非官方样例解释不能恢复核心目标。',40:'压缩规则正文截断，单个RLE样例不足以恢复完整编码规则。'}
def fast(name):return 'fastprep/Salesforce/salesforce-'+name+'.md'
SLUGS=['get-perfect-pairs-count','get-special-substring','least-hours','least-stressful-path','longest-subsequence-which-is-a-substring','max-number-of-operations','maximize-sum-of-processed-times','min-cost','min-deletions','min-elements-to-remove-to-make-almost-sorted-array','minimal-operations','minimize-length-of-longest-substring','minimize-total-input-cost','minimum-difference','plan-cuts','replace-question-mark-to-avoid-adjacent-duplicates','same-substring','schedule-batch-difference','split-array-largest-sum','string-compression-problem','strings-with-no-k-consecutive-identical-characters','toolchanger','visible-towers']
EVIDENCE={i+21:[fast(name)] for i,name in enumerate(SLUGS)}
EVIDENCE[21].append(fast('find-number-of-perfect-pairs'));EVIDENCE[23].append(fast('get-minimum-development-time'));EVIDENCE[25].append(fast('find-longest-subsequence-common-to-x-as-substring-in-y'));EVIDENCE[30].append(fast('min-deletions'))
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
def accepted(s,raw,actual,expected):return equal(actual,expected)
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
        number=s['n'];ident=f'oa-salesforce-{number}'
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
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Salesforce'],description=s['desc']+'\n\n缺失范围的本站补充与来源笔误恢复见输入协议。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
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
        ident=f'oa-salesforce-{number}';reason=BLOCKED[number] if number in BLOCKED else next(s['desc']+' '+s['limits'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
