"""Amazon356–375: original implementations; immutable source is evidence only.
Large fixtures are lazy. --small never calls edges or imports other batches.
"""
from pathlib import Path
from collections import Counter
from functools import lru_cache
from itertools import combinations,product
from math import comb
import hashlib,json,random,subprocess,sys,time,gc
if hasattr(sys,'set_int_max_str_digits'):sys.set_int_max_str_digits(0)
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='amazon-remaining-r';SEED=20263560;SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def line(s):return s+'\n'
def compact(x):return json.dumps(x,ensure_ascii=True,separators=(',',':'))
def jin(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def rental_encode(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def rental_oracle(x):
    a=list(x[0]);answer=0
    for _ in range(x[1]):
        high=max(a);answer+=high+min(v for v in a if v>0);a[a.index(high)]-=1
    return answer
def rental_random(r):
    a=[r.randrange(7) for _ in range(r.randint(1,8))];return a,r.randint(0,sum(a))
def rental_edges():
    n=1000000;h=1000000
    yield ([h]*n,n*h),n*(h*h+1)+h-1
    yield ([0]*(n-1)+[h],h),h*(h+1)
    yield ([1]*n,n),2*n
    yield ([0]*n,0),0
    yield ([h]*n,n*h-1),n*(h*h+1)+h-3
add(356,'最大库存租赁与最小非零库存收费','每次先收取当前最大库存与最小非零库存之和，再从任意一个最大库存类型租走一台。零库存不参与最小值，最大值并列任选，计算全部请求收入。','第一行n m，第二行n个库存。OCR313给n≤10^6、314给10^5且库存≤10^6；Fastprep明确非负、可全部租完。本站覆盖较广有来源域：1≤n≤10^6，0≤stock[i]≤10^6，0≤m≤sum(stock)≤10^12，不强加sum>m。','先降序压平最高平台，到最低正库存之前最小值不变；全部相等后按完整轮与余项收费，降到全1时余下每次均收2。','始终从最高项扣1，故前c个最高项会轮流从h降到下一层，t=cq+r步的最大值之和为cq(2h−q+1)/2+r(h−q)，且未碰最低平台时最小值固定。全部c项同高h≥2时一轮第一笔为2h，余c−1笔为2h−1，合计c(2h−1)+1；等差求和可批量跳q轮。降至1以后删去零类但最小非零仍为1，直至售罄每笔2。分段恰覆盖所有请求且收费发生在扣库存前。','时间O(n log n)，空间O(n)，不逐请求循环；收入≤2×10^18。',[([1,2,4],4),([2,1,1,3],4),([10,10,11],3)],rental_random,rental_edges,rental_encode,rental_oracle,
'''def solve(raw):
    data=iter(map(int,raw.split()));n=next(data);left=next(data);a=sorted((v for v in data if v>0),reverse=True)
    if not a or not left:return '0'
    low=a[-1];answer=0;c=1;h=a[0]
    while c<len(a) and left:
        nxt=a[c];take=min(left,c*(h-nxt));q,r=divmod(take,c)
        answer+=c*q*(2*h-q+1)//2+r*(h-q)+take*low;left-=take
        if take<c*(h-nxt):return str(answer)
        h=nxt;c+=1
    take=min(left,c*(h-1));q,r=divmod(take,c)
    answer+=q*(c*(2*h-q)+1)
    if r:answer+=2*(h-q)+(r-1)*(2*(h-q)-1)
    left-=take;answer+=2*left
    return str(answer)
''',[('错误固定最小值到最后','answer+=q*(c*(2*h-q)+1)','answer+=q*c*2*h'),('错误售罄尾部每次只收1','answer+=2*left','answer+=left')],8000040,timeLimit=10,explanation='样例15、12、60。OCR313表中1+4=6是算术笔误，应为5；316的5种VM与三项输入不符，应为3种。')

def robots_oracle(a):
    n=len(a);answer=0
    for mask in range(1<<n):
        running=mask.bit_count()
        answer+=all(running>=v if mask>>i&1 else n-running<v for i,v in enumerate(a))
    return answer
def robots_random(r):
    n=r.randint(1,9);return [r.randint(1,n) for _ in range(n)]
def robots_edges():
    n=100000
    yield [50001]*n,2**(n-1)-comb(n,n//2)//2
    yield [1]*n,1
    yield [n]*n,1
    yield list(range(1,n+1)),n//2+1
add(357,'运行与等待阈值下的精确配置数量','每台机器人有身份且恰处于运行或等待。运行者要求运行总数r≥自身阈值，等待者要求等待总数n−r严格小于自身阈值。求全部合法身份配置数，不对任何模数取模。','第一行n，第二行n个阈值。原界1≤n≤100000，1≤a[i]≤n。原返回int签名不足以容纳实际结果，本站明确输出任意精度十进制整数，最多约30103位。','频数前缀F(t)计阈值≤t。固定r，r≤n−r时检查中间禁区与强制人数；否则令M=F(r)−F(n−r)、K=r−F(n−r)，贡献C(M,K)。r递增时M,K均不减，使用组合数相邻递推批量更新，避免每个r重算comb。','当r≤w时阈值≤r者只能运行、阈值>w者只能等待，中间阈值两态都不合法，故仅F(r)=F(w)=r贡献1。当r>w时阈值≤w强制运行，阈值>r强制等待，其余M台自由，恰选K台运行有C(M,K)种。不同r配置互斥。沿单调M,K更新组合数：加一行用C(M+1,K)=C(M,K)(M+1)/(M+1−K)，同一行加一列用C(M,K+1)=C(M,K)(M−K)/(K+1)，越界值0在边界K=0或K=M恢复1。由恒等式归纳可得精确计数。','O(n)次大整数乘除和O(n)频数操作，不是O(n)位复杂度；整数最多O(n)位，频数空间O(n)。',[[1,2],[2,2],[2,2,2]],robots_random,robots_edges,arr,robots_oracle,
'''def solve(raw):
    import sys
    from math import comb
    if hasattr(sys,'set_int_max_str_digits'):sys.set_int_max_str_digits(0)
    d=list(map(int,raw.split()));n=d[0];f=[0]*(n+1)
    for v in d[1:]:f[v]+=1
    for i in range(1,n+1):f[i]+=f[i-1]
    answer=sum(f[r]==r and f[n-r]==r for r in range(n//2+1))
    start=n//2+1;M=f[start]-f[n-start];K=start-f[n-start];value=comb(M,K) if 0<=K<=M else 0
    for r in range(start,n+1):
        targetM=f[r]-f[n-r];targetK=r-f[n-r]
        while M<targetM:
            M+=1
            if K==M:value=1
            elif 0<=K<M:value=value*M//(M-K)
            else:value=0
        while K<targetK:
            K+=1
            if K==0:value=1
            elif 0<K<=M:value=value*(M-K+1)//K
            else:value=0
        answer+=value
    return str(answer)
''',[('错误只统计合法运行人数','answer+=value','answer+=int(value>0)'),('运行数严格大于阈值的错误限制','targetM=f[r]-f[n-r]','targetM=f[max(0,r-1)]-f[n-r]')],700020,timeLimit=10,outputLimit=64)

def efficiency_encode(x):return x[0]+'\n'+str(len(x[1]))+'\n'+x[1]+'\n'+seq(x[2])+'\n'
def efficiency_oracle(x):
    s,kit,ratings=x;best=None
    for mask in range(1<<len(kit)):
        chosen=''.join(c for i,c in enumerate(kit) if mask>>i&1);test='('*chosen.count('(')+s+')'*chosen.count(')');balance=0;valid=True
        for c in test:
            balance+=1 if c=='(' else -1
            if balance<0:valid=False
        if valid and balance==0:
            value=sum(v for i,v in enumerate(ratings) if mask>>i&1);best=value if best is None else max(best,value)
    assert best is not None
    return best
def efficiency_random(r):
    s=''.join(r.choices('()',k=r.randint(1,6)));kit='('*s.count(')')+')'*s.count('(')+''.join(r.choices('()',k=r.randint(0,3)))
    return s,kit,[r.randint(-9,9) for _ in kit]
def efficiency_edges():
    yield ('('*199999,')'*199999,[-10**9]*199999),-199999*10**9
    yield (')'*199999,'('*199999,[10**9]*199999),199999*10**9
    yield ('()'*99999,'('*100000+')'*99999,[10**9]*199999),199998*10**9
    yield ('()','',[]),0
add(358,'补齐括号并最大化套件评分','保持原括号串顺序，在任意位置插入套件中尚未用过的括号，使最终串平衡，最大化所用括号评分之和。原串本身分数为0；原文保证存在可行补法，必要负分括号也必须选。','第一行s，第二行m，第三行kit，第四行m个评分；m=0时后两行为空。原严格界1≤|s|≤199999、0≤m≤199999；kit长度m，评分−10^9..10^9，只含左右括号。','计算原串最低前缀余额及最终余额，确定最低必需左右数量。两种括号分别按分数降序取必需项；之后按成对边际评分和仍为正时继续取。','任何负前缀都要求前面补足左括号，至少L=−min(0,最低余额)，最终平衡又要求R=L+最终余额。前置L左、后置R右即可实现。额外选择的左右数必须相等；固定数量时各取最高评分最优，且下一对的边际和非增，所以仅加入正边际即可达到全局最大。','O(|s|+m log m)时间，O(m)空间。',[(')((',')(()))',[3,4,2,-4,-1,-3]),('(',')',[-5]),('()','',[])],efficiency_random,efficiency_edges,efficiency_encode,efficiency_oracle,
'''def solve(raw):
    lines=raw.split('\\n');s=lines[0];kit=lines[2];ratings=list(map(int,lines[3].split()));balance=low=0
    for c in s:balance+=1 if c=='(' else -1;low=min(low,balance)
    left=-low;right=left+balance;a=sorted((v for c,v in zip(kit,ratings) if c=='('),reverse=True);b=sorted((v for c,v in zip(kit,ratings) if c==')'),reverse=True)
    answer=sum(a[:left])+sum(b[:right])
    while left<len(a) and right<len(b) and a[left]+b[right]>0:answer+=a[left]+b[right];left+=1;right+=1
    return str(answer)
''',[('错误不允许负分最优解','return str(answer)','return str(max(0,answer))'),('错误只补必需括号','while left<len(a) and right<len(b) and a[left]+b[right]>0:','while False:')],2800040,explanation='原TODO样例补为6；第二例只能补负5分右括号，答案−5；第三例0。')

def similar_oracle(pairs):
    result=[]
    for new,old in pairs:
        good=False
        for mask in range(1<<len(new)):
            changed=''.join(chr((ord(c)-97+1)%26+97) if mask>>i&1 else c for i,c in enumerate(new));it=iter(changed)
            if all(any(v==c for v in it) for c in old):good=True;break
        result.append('YES' if good else 'NO')
    return '\n'.join(result)
def similar_random(r):
    result=[]
    for _ in range(r.randint(1,4)):
        new=''.join(r.choices('abcz',k=r.randint(0,8)));old=''.join(r.choices('abcdz',k=r.randint(0,len(new))));result.append([new,old])
    return result
def similar_edges():
    yield [['z'*100000,'a'*100000]],'YES'
    yield [['a'*100000,'c'*100000]],'NO'
    yield [['ab'*100000,'']],'YES'
    yield [['z'*10000,'a'*10000] for _ in range(10)],'\n'.join(['YES']*10)
add(359,'至多循环后继一次的密码子序列','对每个请求，从new中任选位置各改为字母循环后继一次，也可不选。问old能否成为改后new的子序列；每个位置不能连续改多次。z的后继为a。','输入JSON二维数组，每项[new,old]。原请求数1..10、全部新旧字符串长度总和≤200000、每项旧长≤新长。字符按原a..z循环定义为小写字母；没有单串非空限制，允许空串。','双指针扫描new，若当前字符或它的一次循环后继等于old下一个字符，就立即匹配。','每个位置独立决定是否修改，能匹配目标字符的最早位置可替换任意可行方案的较晚匹配位置，并为后续保留不更少位置。因此逐字符最早匹配保持存在可行后缀的性质，最终匹配完old当且仅当可行。','时间O(全部密码总长度)，额外空间O(请求数)计输出。',[[['baacbab','abdbc'],['accdb','ach'],['baacba','abb']],[['aaccbbee','bdbf'],['aab','aee']],[['z','a'],['','']]],similar_random,similar_edges,jin,similar_oracle,
'''def solve(raw):
    import json
    out=[]
    for new,old in json.loads(raw):
        j=0
        for c in new:
            if j<len(old) and (c==old[j] or chr((ord(c)-97+1)%26+97)==old[j]):j+=1
        out.append('YES' if j==len(old) else 'NO')
    return '\\n'.join(out)
''',[('错误漏掉z循环','chr((ord(c)-97+1)%26+97)','chr(ord(c)+1)'),('错误不允许不改字符','c==old[j] or ','')],200120,output='每个请求一行YES或NO。',explanation='公开输出依次YES/NO/YES、YES/NO、YES/YES。原文第二段把子序列方向写反，本站按首段、旧长≤新长和全部例子一致的方向恢复。')

def teams_encode(x):return f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n'
def teams_oracle(x):
    a,k,d=x;n=len(a);groups=[sum(1<<i for i in ids) for ids in combinations(range(n),k) if max(a[i] for i in ids)-min(a[i] for i in ids)<=d]
    @lru_cache(None)
    def visit(mask):return max([0]+[1+visit(mask|g) for g in groups if not mask&g])
    return visit(0)
def teams_random(r):
    a=[r.randint(1,20) for _ in range(r.randint(1,9))];return a,r.randint(1,len(a)),r.randint(1,8)
def teams_edges():
    yield ([10**9]*100000,100000,1),1
    yield (list(range(1,100001)),1,10**9),100000
    yield (list(range(1,100001)),3,1),0
    yield ([1]*50000+[10**9]*50000,3,1),33332
add(360,'技能跨度受限的最多互不重叠队伍','每队恰好teamSize人，队内最高技能减最低技能不超过maxDiff；每人至多进一队，可有人不参赛。求最多队数。','第一行n teamSize maxDiff，第二行n个skill。原界1≤teamSize≤n≤100000，1≤maxDiff≤10^9，1≤skill[i]≤10^9。','技能排序，最左连续k人可成队则取走整段，否则丢弃当前最小者。','若最早k人已超跨度，任何包含最小者的k人队都不合法，只能跳过。任意两个交错的合法k人队，可把合并后的较小k人和较大k人分为两队：较小队跨度不超过原先包含全局最小者的队；较大队若最大值在另一队，其跨度不超过该队，否则不超过包含全局最小者的队。因此反复消除交错可得按所选人员排序的连续分组。现在若全体最早k人可成队，用它替换最优方案首队；后续队员下标均在该首队之后，也必在全体最早k人之后，不受替换影响。于是立即取队不损失最优数量，归纳得算法正确。','O(n log n)时间，O(n)空间。',[([3,4,3,1,6,5],3,2),([1,10,20],2,1),([4,4,4],1,1)],teams_random,teams_edges,teams_encode,teams_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,k,limit=d[:3];a=sorted(d[3:]);i=answer=0
    while i+k<=n:
        if a[i+k-1]-a[i]<=limit:answer+=1;i+=k
        else:i+=1
    return str(answer)
''',[('错误按严格跨度','<=limit','<limit'),('错误允许人员复用','answer+=1;i+=k','answer+=1;i+=1')],1100050)

def profitable_oracle(a):return sum(a[l]==max(a[l:r+1]) or a[r]==max(a[l:r+1]) for l in range(len(a)) for r in range(l,len(a)))
def profitable_edges():
    n=500000
    yield [10**8]*n,n*(n+1)//2
    yield list(range(1,n+1)),n*(n+1)//2
    # With alternating low/high, only nonsingleton low-ended intervals fail.
    yield [1,10**8]*(n//2),n*(n+1)//2-(n//2)*(n//2-1)//2
    yield [1]*(n//2)+[10**8]*(n//2),n*(n+1)//2
add(361,'至少一端达到最大值的子数组数量','统计非空连续子数组，其中首元素或末元素等于子数组最大值即可；允许相等和重复值，同时满足两端的区间只算一次。','第一行n，第二行n个价格。原界1≤n≤500000，1≤a[i]≤10^8。','分别用单调栈统计末端为最大和首端为最大，遇相等值也弹出以寻找严格更大边界；再用递减分组栈减去两端都为最大的区间。','固定端点向内延伸直到第一个严格更大值，恰得到此端为最大值的全部区间。两类计数需包含排除：某值v出现时，弹掉更小组，顶部同值此前c次均与当前位置之间没有更大值，贡献c+1个双端最大区间（含单点）；若顶部不同仅单点。更小组一旦越过当前更大值不能跨过当前再贡献，弹出安全。因此减项准确处理全部重复端点，不只减n。','时间O(n)，空间O(n)，计数用64位。',[[3,1,3,5],[1,5,2],[3,1,3]],lambda r:[r.randint(1,6) for _ in range(r.randint(1,12))],profitable_edges,arr,profitable_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:];answer=0
    for values in (a,reversed(a)):
        stack=[]
        for i,v in enumerate(values):
            while stack and stack[-1][1]<=v:stack.pop()
            answer+=i-(stack[-1][0] if stack else -1);stack.append((i,v))
    groups=[];both=0
    for v in a:
        while groups and groups[-1][0]<v:groups.pop()
        if groups and groups[-1][0]==v:groups[-1][1]+=1;both+=groups[-1][1]
        else:groups.append([v,1]);both+=1
    return str(answer-both)
''',[('错误只减去单点','answer-both','answer-len(a)'),('错误相等值也挡住边界','stack[-1][1]<=v','stack[-1][1]<v')],5000020,timeLimit=10)

def reversewindow_oracle(x):
    s,k=x;return sum(s[:i]+s[i:i+k][::-1]+s[i+k:]<s for i in range(len(s)-k+1))
def reversewindow_random(r):
    s=''.join(r.choices('ab😀\x00 \u0085\u2028\u2029',k=r.randint(2,12)));return s,r.randint(1,min(len(s),20))
def reversewindow_edges():
    yield ('😀'*1000000,20),0
    yield ('ba'*500000,2),500000
    yield ('\x00😀'*500000,1),0
    pattern='a'*9+'cb'+'a'*9;n=1000000;k=20;s=pattern*(n//20)
    count=0
    for residue in range(20):
        window=(pattern*2)[residue:residue+k]
        if window[::-1]<window:count+=(n-k-residue)//20+1
    yield (s,k),count
add(362,'反转固定长度窗口使整串变小的次数','对每个长度k连续窗口分别反转一次，统计反转后整个字符串严格小于原串的窗口位置数。相同文本但位置不同分别计数；不改变的窗口不算。','输入JSON数组[s,k]。原界2≤码点长度≤1000000，1≤k≤min(长度,20)。原文未限定字符集，本站明确Unicode标量字符及码点字典序，允许空白、NUL、非BMP及Unicode分隔字符，JSON编码保存原字符。','窗口外不变，只需从窗口两端向中间比较，第一对不同字符若右侧小于左侧则该反转成功。','两字符串在窗口前缀之前完全相同；窗口反转后第j位是原对称位置。当此前配对都相等时，第一个不相等配对正是整串第一个不同位置，其大小唯一决定字典序；全部相等则是回文，反转不严格变小。枚举全部窗口无重漏。','O(nk)时间，k≤20实际每窗至多10对；除输入字符串外O(1)空间。',[('amazon',3),('ababa',2),('😀\u2028\x00',3)],reversewindow_random,reversewindow_edges,jin,reversewindow_oracle,
'''def solve(raw):
    import json
    s,k=json.loads(raw);answer=0
    for start in range(len(s)-k+1):
        left=start;right=start+k-1
        while left<right and s[left]==s[right]:left+=1;right-=1
        if left<right and s[right]<s[left]:answer+=1
    return str(answer)
''',[('错误把回文也计入','if left<right and s[right]<s[left]:','if left>=right or s[right]<s[left]:'),('错误只比较窗口首末字符','while left<right and s[left]==s[right]:','while False:')],12000030,timeLimit=10)

def erase_oracle(s):
    @lru_cache(None)
    def visit(t):
        best=t
        for i in range(len(t)):
            for j in range(i+1,len(t)):
                if t[i]==t[j]:best=min(best,visit(t[:i]+t[i+1:j]+t[j+1:]),key=lambda v:(len(v),v))
        return best
    return compact(visit(s))
def erase_edges():
    s=''.join(chr(0x10000+i) for i in range(200000));yield s,compact(s)
    yield '😀'*200000,'""'
    yield '\x00'*199999,compact('\x00')
    yield 'CBCAAXA'*28571,compact('ABX')
add(364,'任意同字符成对删除后的最短最小串','每次可删掉任意两个相同字符，不要求相邻；未删字符保持原顺序。先使剩余长度最小，再使剩余串按Unicode码点字典序最小。','输入一个JSON字符串。原文没有长度或字符域上界，本站0≤码点长度≤200000，允许所有Unicode标量字符，包括空白、NUL、非BMP、U+0085/U+2028/U+2029。','仅奇数频次字符需要各保留一次；对原串扫描，用剩余频次、已选集合和单调栈选择恰含这些字符一次的最小子序列。','同字符成对删除保持每种频次奇偶性，最短结果恰是每个奇频字符一次。任何保序选择这些字符各一次的方案都能把其余偶数次删除，故只需最小字典序子序列。扫描到新必需字符时，若栈顶更大且之后仍有该顶字符，可推迟顶字符以让当前较小字符提前，不损失可行性；不能弹的字符要么更小要么最后一次，必须保留。由最早差异交换可知所得是字典序最小的可行序列。','时间O(n)，空间O(n)，每次栈操作摊还常数。',['CBCAAXA','ZYXZYZY','ABCBACDDAA'],lambda r:''.join(r.choices('AB \x00😀\u0085\u2028\u2029',k=r.randint(0,8))),erase_edges,jin,erase_oracle,
'''def solve(raw):
    import json
    from collections import Counter
    s=json.loads(raw);remaining=Counter(s);need={c for c,v in remaining.items() if v%2};used=set();stack=[]
    for c in s:
        remaining[c]-=1
        if c not in need or c in used:continue
        while stack and stack[-1]>c and remaining[stack[-1]]>0:used.remove(stack.pop())
        stack.append(c);used.add(c)
    return json.dumps(''.join(stack),ensure_ascii=True,separators=(',',':'))
''',[('错误把奇频字符直接排序',"''.join(stack)","''.join(sorted(stack))"),('错误保留每种字符一次不看奇偶','if v%2','if v>0')],2400010,checker='exact',output='输出一个规范ASCII JSON字符串并换行：双引号及反斜杠用反斜杠转义；控制字符用JSON短转义（退格、制表、换行、换页、回车）或小写四位\\u；非ASCII及DEL用小写四位\\u，非BMP用一对UTF-16代理转义；其余可打印ASCII直接输出。等价Python json.dumps(result, ensure_ascii=True)。空串输出""。采用exact，字符串内空格不能忽略。',explanation='输出"BAX"、"XYZ"、""。原第三例显示一个空格，与明确的空串解释冲突，本站纠正为空JSON字符串。')

def uniqueness_oracle(a):
    values=sorted(len(set(a[l:r+1])) for l in range(len(a)) for r in range(l,len(a)));return values[(len(values)-1)//2]
def uniqueness_random(r):
    n=r.randint(1,12);return [r.randint(1,n) for _ in range(n)]
def uniqueness_edges():
    n=100000;target=(n*(n+1)//2+1)//2;total=0;answer=0
    for size in range(1,n+1):
        total+=n-size+1
        if total>=target:answer=size;break
    yield list(range(1,n+1)),answer
    yield [n]*n,1
    yield [1,2]*(n//2),2
    # Two halves: within-half intervals already exceed the median rank.
    yield [1]*(n//2)+[2]*(n//2),1
add(365,'全部子数组不同值个数的下中位数','对所有非空连续子数组计算不同值个数，将这些数排序；总数偶数时取中间两数中的较小者，求这个下中位数。','第一行n，第二行n个数。原完整界位于正文：1≤n≤100000，1≤a[i]≤n，不受末尾N/A占位覆盖。','目标序号为(T+1)//2，T=n(n+1)/2。二分答案x，滑动窗口累计不同值不超过x的子数组数，达到目标则收缩上界。','固定右端，左端移至不同值≤x后，所有更靠右的起点合法，更靠左的不合法，因此右端贡献恰为窗口长度。累计得到≤x的子数组总数，随x单调；第一个累计达到下中位序号的x正是所求顺序统计量。','O(n log n)时间，O(n)空间，子数组总数用64位。',[[1,1],[1,2,3],[1,2,1]],uniqueness_random,uniqueness_edges,arr,uniqueness_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:];n=len(a);target=(n*(n+1)//2+1)//2;lo=1;hi=n
    while lo<hi:
        mid=(lo+hi)//2;counts=[0]*(n+1);left=distinct=total=0
        for right,v in enumerate(a):
            if not counts[v]:distinct+=1
            counts[v]+=1
            while distinct>mid:
                u=a[left];counts[u]-=1;left+=1
                if not counts[u]:distinct-=1
            total+=right-left+1
        if total>=target:hi=mid
        else:lo=mid+1
    return str(lo)
''',[('错误取上中位数','target=(n*(n+1)//2+1)//2','target=n*(n+1)//4+1'),('错误把每窗口长度当1计数','total+=right-left+1','total+=int(right>=left)')],700020,timeLimit=10)

def inefficiency_oracle(s):
    ids=[i for i,c in enumerate(s) if c=='?'];best=len(s)
    for bits in product('01',repeat=len(ids)):
        a=list(s)
        for i,c in zip(ids,bits):a[i]=c
        best=min(best,sum(x!=y for x,y in zip(a,a[1:])))
    return best
def inefficiency_edges():
    yield '?'*100000,0
    yield '01'*50000,99999
    yield '?'*49999+'0'+'?'*49999+'1',1
    yield '?'*99999+'1',0
add(366,'替换未知服务器后的最少相邻差异','把每个?独立换成0或1，最小化相邻两个字符不同的对数。固定0/1不能改动。','输入一行仅含0、1、?的字符串。原完整界1≤长度≤100000。','忽略?，只统计剩余固定字符序列的相邻变化次数。','相邻固定字符若不同，它们之间无论如何填都至少出现一次变化；若相同可全填该值使变化为0。不同端点间只需在某处切换一次；前后未知段填最近固定值，全未知串任选同值，能同时达到所有独立区间下界。','时间O(n)，额外空间O(1)。',['??011??0','00?10??1?','???'],lambda r:''.join(r.choices('01?',k=r.randint(1,10))),inefficiency_edges,line,inefficiency_oracle,
'''def solve(raw):
    previous=None;answer=0
    for c in raw.strip():
        if c=='?':continue
        if previous is not None and previous!=c:answer+=1
        previous=c
    return str(answer)
''',[('错误把未知项强制填0',"for c in raw.strip():","for c in raw.strip().replace('?','0'):"),('错误每个不同固定字符贡献2','answer+=1','answer+=2')],100001,explanation='答案2、3、0。原第二例解释给出10字符，与9字符输入不符；合法最优填法001101111长9，变化数3。')

def discount_encode(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def discount_oracle(x):return sum((a+b)%x[1]==0 for a,b in combinations(x[0],2))
def discount_edges():
    yield ([10**9]*100000,2*10**9),4999950000
    yield (list(range(1,100001)),1),4999950000
    yield ([1]*100000,2*10**9),0
    yield ([1]*50000+[10**9-1]*50000,10**9),2500000000
add(368,'价格和整除折扣数的下标对数量','统计i<j且prices[i]+prices[j]可被x整除的下标对；商品有身份，重复价格可产生多对，不能把一个商品与自己配对。','第一行n x，第二行n个价格。原界1≤n≤100000，1≤x≤2×10^9，prices[i]≥1；原价格上界只剩上标9而底数缺失，本站明确补价格≤10^9，不宣称为恢复原上界。','扫描时先加此前互补余数频数，再增加当前余数。','和整除x等价于两个余数互补。扫描j时表仅含i<j的商品，加入其互补频数恰统计全部以j为右端的合法对；不同j不重复，因此答案准确且不会统计自身。','期望O(n)时间，O(min(n,x))空间，用稀疏字典而非x长度数组。',[([31,25,85,29,35],60),([1,1,1],2),([1],1)],lambda r:([r.randint(1,30) for _ in range(r.randint(1,14))],r.randint(1,25)),discount_edges,discount_encode,discount_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,x=d[:2];counts={};answer=0
    for value in d[2:]:
        r=value%x;answer+=counts.get((-r)%x,0);counts[r]=counts.get(r,0)+1
    return str(answer)
''',[('错误只看相同余数','counts.get((-r)%x,0)','counts.get(r,0)'),('错误忽略重复商品身份','counts.get(r,0)+1','1')],1100040)

def rewards_oracle(a):
    @lru_cache(None)
    def visit(mask):
        step=mask.bit_count();return max([0]+[max(0,a[i]-step)+visit(mask|1<<i) for i in range(len(a)) if not mask>>i&1])
    return visit(0)
def rewards_edges():
    n=100000
    yield [10**6]*n,n*10**6-n*(n-1)//2
    yield [0]*n,0
    yield [0]*(n-1)+[10**6],10**6
    yield list(range(n)),(n//2)**2
add(369,'购买后其余奖励递减的最大积分','每项商品至多买一次；买某项得到它当前积分，随后其他未买项积分都减1，最低为0。可以选择任意购买顺序和数量，求最多积分。','第一行n，第二行n个初始积分。原界1≤n≤100000，0≤deals[i]≤1000000。','按初始积分降序，第i次购买（从0开始）收益max(0,a[i]−i)，求和。','第i个时刻购买初值v的收益仅依赖v和i。对较早时刻i与较晚j、初值x≥y，有max(0,x−i)+max(0,y−j)≥max(0,y−i)+max(0,x−j)，因为相同时间折损对较大初值保留的增益不更小。交换逆序不降低收益，最终降序最优；收益非负，可把未买项放最后而不减少总收益。','时间O(n log n)，空间O(n)，总积分需64位。',[[5,2,2,3,1],[5,5,5],[0,1,0]],lambda r:[r.randint(0,15) for _ in range(r.randint(1,9))],rewards_edges,arr,rewards_oracle,
'''def solve(raw):
    a=sorted(map(int,raw.split()[1:]),reverse=True)
    return str(sum(max(0,value-i) for i,value in enumerate(a)))
''',[('错误按升序买','reverse=True','reverse=False'),('错误积分可减成负数','max(0,value-i)','value-i')],800020)

def meanrank_oracle(a):
    result=[]
    for x in range(1,len(a)+1):
        counts={0:1};prefix=total=0
        for v in a:prefix+=v-x;total+=counts.get(prefix,0);counts[prefix]=counts.get(prefix,0)+1
        result.append(total)
    return seq(result)
def meanrank_random(r):
    a=list(range(1,r.randint(1,12)+1));r.shuffle(a);return a
def meanrank_edges():
    n=1000;expected=seq(min(x,n+1-x) for x in range(1,n+1))
    yield list(range(1,n+1)),expected
    yield list(range(n,0,-1)),expected
    a=list(range(1,n+1,2))+list(range(2,n+1,2));yield a,meanrank_oracle(a)
add(370,'每个整数均值对应的连续排名组数','数组是1..n的排列；对每个x=1..n，求平均值严格等于x的非空连续子数组数。不同下标区间分别计数。','第一行n，第二行n个互异排名。原界1≤n≤1000，数组恰为1..n排列；不是含重复值的一般数组。','枚举左右端点，递增累加区间和；和能被长度整除时给对应均值计数加1。','枚举每个左端的全部右端，每个非空连续区间恰出现一次，维护的和由逐项累加准确得到。平均值为整数x当且仅当和=长度×x，整除检查无浮点误差；排列值在1..n内保证均值也在该范围。','时间O(n²)，空间O(n)。',[[1,2,3,4,5],[4,3,2,1],[4,7,3,6,5,2,1]],meanrank_random,meanrank_edges,arr,meanrank_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()))[1:];n=len(a);out=[0]*(n+1)
    for left in range(n):
        total=0
        for right in range(left,n):
            total+=a[right];size=right-left+1
            if total%size==0:out[total//size]+=1
    return ' '.join(map(str,out[1:]))
''',[('错误均值向下取整也计入','if total%size==0:','if True:'),('错误漏掉单元素区间','if total%size==0:','if size>1 and total%size==0:')],5020,output='输出n个整数，第x项是均值为x的区间数。')

def mincostdata_oracle(s):
    ids=[i for i,c in enumerate(s) if c=='?'];alphabet='abcdefghijklmnopqrstuvwxyz';best=None
    for choices in product(alphabet,repeat=len(ids)):
        a=list(s)
        for i,c in zip(ids,choices):a[i]=c
        result=''.join(a);cost=sum(a[i]==a[j] for i in range(len(a)) for j in range(i));candidate=cost,result
        if best is None or candidate<best:best=candidate
    return best[1]
def mincostdata_random(r):
    a=r.choices('abcxyz',k=r.randint(1,9))
    for i in r.sample(range(len(a)),r.randint(1,min(2,len(a)))):a[i]='?'
    return ''.join(a)
def mincostdata_edges():
    n=100000;q,rem=divmod(n,26);letters='abcdefghijklmnopqrstuvwxyz'
    yield '?'*n,''.join(c*(q+(i<rem)) for i,c in enumerate(letters))
    yield 'a'*99999+'?','a'*99999+'b'
    yield letters*3846+'????',letters*3846+'abcd'
    yield '?a?cdefghijklmnopqrstuvwxyz','aabcdefghijklmnopqrstuvwxyz'
add(371,'最小重复代价且字典序最小的缺失字符填充','把?全部填为小写字母。每个位置代价是它前面相同字母出现次数，总代价最小优先，再使整个结果字典序最小。','输入一行data。原界1≤长度≤100000，至少一个?，其他字符均a..z。','先统计全部已知字符，用26项最小堆依次选当前频次最小、并列字母最小者；只记各字母的新增数量，最后把新增字母按升序填入各?。','某字母频次f的总代价为C(f,2)，下一份边际代价是f，之后逐一递增。合并26条递增边际序列取最小的q份达到最小总代价；边际并列选字母较小者使新增多重集字典序最小。代价与位置无关，把这个多重集升序放进从左到右的?，任何逆序交换都会使结果变小而不改代价，故二级目标也最优。','时间O(n log26)，空间O(n)含结果，频次/堆O(26)。',['aaaa?aaaa','abcd?','?a?cdefghijklmnopqrstuvwxyz'],mincostdata_random,mincostdata_edges,line,mincostdata_oracle,
'''def solve(raw):
    import heapq
    s=raw.strip();counts=[0]*26;missing=0
    for c in s:
        if c=='?':missing+=1
        else:counts[ord(c)-97]+=1
    heap=[(v,i) for i,v in enumerate(counts)];heapq.heapify(heap);chosen=[0]*26
    for _ in range(missing):
        count,i=heapq.heappop(heap);chosen[i]+=1;heapq.heappush(heap,(count+1,i))
    pool=iter(''.join(chr(i+97)*count for i,count in enumerate(chosen)))
    return ''.join(next(pool) if c=='?' else c for c in s)
''',[('错误忽略未来已知字母','heap=[(v,i) for i,v in enumerate(counts)]','heap=[(0,i) for i,v in enumerate(counts)]'),('错误把较大填充字母放前面',"pool=iter(''.join(chr(i+97)*count for i,count in enumerate(chosen)))","pool=iter(''.join(chr(i+97)*chosen[i] for i in range(25,-1,-1)))")],100001,output='输出填好后的完整小写字符串。',explanation='输出aaaabaaaa、abcde、aabcdefghijklmnopqrstuvwxyz。第三例不能按最小堆选择顺序直接填，必须把所选a、b排序到问号位置。')

def purchase_encode(x):return f'{len(x[0])} {x[2]}\n'+seq(x[0])+'\n'+seq(x[1])+'\n'
def purchase_oracle(x):
    a,b,m=x
    @lru_cache(None)
    def visit(i,left):
        if i==len(a):return 0 if left==0 else 10**30
        return min(t*a[i]+b[i]*t*(t-1)//2+visit(i+1,left-t) for t in range(left+1))
    return visit(0,m)
def purchase_edges():
    yield ([100000]*100000,[100000]*100000,100000),10**10
    yield ([100000],[100000],100000),500005000000000
    yield ([1]*100000,[1]*100000,100000),100000
    yield ([1,100000],[1,100000],100000),5000050000
add(372,'无限等差商品中购买指定数量的最低总价','第i类第j件价格为a[i]+(j−1)b[i]，每类无限件。恰好买m件，最小化总价。','第一行n m，随后一行n个a、一行n个b。原界1≤n,m≤100000，1≤a[i],b[i]≤100000。','最小堆保留每类最便宜未买的一件；每次弹出最小价累加，再放入同类下一价格，共进行m次。','正b保证每类价格严格递增，因此任何选到后面件却不选前面更便宜件的方案都可改进。每类前沿最小值就是全体未买商品的最小值，逐次选取它恰得到合并所有递增序列的前m小项，任何其他m项之和不可能更小。','时间O(n+m log n)，空间O(n)，费用用64位。',[([2,1,1],[1,2,3],4),([5],[2],3),([1,2],[100,1],3)],lambda r:([r.randint(1,9) for _ in range(n)],[r.randint(1,8) for _ in range(n)],r.randint(1,8)) if (n:=r.randint(1,5)) else None,purchase_edges,purchase_encode,purchase_oracle,
'''def solve(raw):
    import heapq
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];b=d[2+n:];heap=list(zip(a,b));heapq.heapify(heap);answer=0
    for _ in range(m):
        price,step=heapq.heappop(heap);answer+=price;heapq.heappush(heap,(price+step,step))
    return str(answer)
''',[('错误忽略同类涨价','price+step,step','price,step'),('错误少买一件','range(m):','range(m-1):')],1400050,timeLimit=10)

def fruits_oracle(a):
    @lru_cache(None)
    def visit(state):
        best=len(state)
        for i in range(len(state)):
            for j in range(i+1,len(state)):
                if state[i]!=state[j]:best=min(best,visit(state[:i]+state[i+1:j]+state[j+1:]))
        return best
    return visit(tuple(sorted(a)))
def fruits_edges():
    yield [10**9]*100000,100000
    yield [1]*50000+[10**9]*50000,0
    yield [1]*50001+[10**9]*49999,2
    yield list(range(1,100000)),1
add(373,'不同水果成对消除后的最少剩余','每步任意选两种不同类型的水果各一个并删除，不要求相邻；不能删除相同类型的一对。求最少剩余个数。','第一行n，第二行n个类型整数。原界1≤n≤100000，1≤类型≤10^9。','设最高频次f，答案max(2f−n,n%2)。','最高频类型最多被其他n−f项抵消，至少余2f−n；每次删2，剩余还须与n同奇偶。若有过半类型，逐一用其他类型抵消它可达到多数下界。否则n为偶数时将同类分组排序，前后各半对应位置配对，各类不超半数保证每对不同；奇数先留下一项使剩余无过半类型，再同样配对。故恰达到两个下界之最大。','期望时间O(n)，空间O(不同类型数)。',[[3,3,1,1,2],[1,2,5,6],[7,7,7,1]],lambda r:[r.randint(1,5) for _ in range(r.randint(1,9))],fruits_edges,arr,fruits_oracle,
'''def solve(raw):
    from collections import Counter
    a=list(map(int,raw.split()))[1:];n=len(a);f=max(Counter(a).values())
    return str(max(2*f-n,n%2))
''',[('错误只看奇偶','max(2*f-n,n%2)','n%2'),('错误允许负剩余','max(2*f-n,n%2)','2*f-n')],1100020)

def roundtrip_encode(x):return arr(x[0])+arr(x[1])
def roundtrip_oracle(x):return min((a+b for i,a in enumerate(x[0]) for j,b in enumerate(x[1]) if i<j),default=-1)
def roundtrip_edges():
    yield ([-10**9]*200000,[-10**9]*200000),-2000000000
    yield ([10**9]*200000,[10**9]*200000),2000000000
    yield ([1],[10**9]*199999+[-10**9]),1-10**9
    yield ([],[1]*200000),-1
    yield ([1]*200000,[]),-1
add(374,'严格晚于出发的最低往返费用','两数组下标各自代表时间，值是航班费用；返程下标j必须严格大于出发下标i。数组长度可以不同，求最低总价；无合法组合时本站补输出−1，不增加总有解保证。','依次输入出发数组长度n、n个整数、返程数组长度m、m个整数。原文无数值界、非负或等长保证；本站0≤n,m≤200000，费用−10^9..10^9。','扫描返程时间j，把存在的出发j−1加入历史最小值；用此前最小出发费用加本次返程更新答案。','处理j时维护的最小值恰覆盖所有存在且i<j的出发航班，固定返程下选择最便宜出发必优。遍历每个实际返程，所有合法组合各落入其返程时刻的比较，故全局最小被覆盖。不同长度时独立检查出发下标，不截短返程列表。','时间O(n+m)，除输入数组外O(1)空间。',[([1,2,3,4],[4,3,2,1]),([1],[0]),([5],[100,100,-2])],lambda r:([r.randint(-10,10) for _ in range(r.randint(0,9))],[r.randint(-10,10) for _ in range(r.randint(0,9))]),roundtrip_edges,roundtrip_encode,roundtrip_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];m=d[n+1];b=d[n+2:];best=None;answer=None
    for j,value in enumerate(b):
        if 0<=j-1<n:best=a[j-1] if best is None else min(best,a[j-1])
        if best is not None:answer=best+value if answer is None else min(answer,best+value)
    return str(-1 if answer is None else answer)
''',[('错误允许同一天出发返回','if 0<=j-1<n:best=a[j-1] if best is None else min(best,a[j-1])','if j<n:best=a[j] if best is None else min(best,a[j])'),('错误截断至两数组公共长度','enumerate(b):','enumerate(b[:n]):')],4800050)

def priorities_oracle(a):
    a=list(a)
    while True:
        counts=Counter(a);p=max((v for v,c in counts.items() if c>=2 and v>0),default=0)
        if not p:break
        i=a.index(p);j=a.index(p,i+1);a[j]=p//2;a.pop(i)
    return str(len(a))+'\n'+seq(a)
def priorities_edges():
    yield [1]*100000,'50000\n'+seq([0]*50000)
    a=list(range(1,100001));yield a,'100000\n'+seq(a)
    yield [4,4,2,1]*25000,'25000\n'+seq([0]*25000)
    yield list(range(10**9-99999,10**9+1)),'100000\n'+seq(range(10**9-99999,10**9+1))
add(375,'按最大重复优先级执行后的剩余队列','每轮找至少出现两次的最大优先级p；不存在或p=0则停止。取该优先级当前队列最前两项，删除前一项，把后一项降为floor(p/2)。其余相对顺序不变，输出最终队列。','第一行n，第二行n个初始优先级。原界1≤n≤100000，1≤初始优先级≤10^9；执行中允许出现0，但不能继续合并0。','每个值维护原始下标最小堆；最大堆调度重复正值。每轮取两个最小下标、标记删除前者，将后者压入减半值组，并更新重复候选。','删除不改变存活项相对顺序，所以比较原下标与当前队列先后完全一致。值分组堆总保存该值全部存活项，取两最小下标恰符合规则；最大候选堆覆盖所有重复正值，懒惰丢弃不足两项的旧记录，不改变最大合法值选择。每步严格按原规则更新，归纳整个执行及最终按原下标过滤的队列一致。','至多n−1次成功操作，时间O(n log n)，空间O(n)。',[[6,6,6,1,2,2],[4,4,2,1],[2,1,5,10,10,1]],lambda r:[r.randint(1,12) for _ in range(r.randint(1,12))],priorities_edges,arr,priorities_oracle,
'''def solve(raw):
    import heapq
    a=list(map(int,raw.split()))[1:];groups={}
    for i,v in enumerate(a):groups.setdefault(v,[]).append(i)
    heap=[-v for v,ids in groups.items() if len(ids)>=2 and v>0];heapq.heapify(heap)
    while heap:
        p=-heapq.heappop(heap);ids=groups[p]
        if len(ids)<2:continue
        first=heapq.heappop(ids);second=heapq.heappop(ids);a[first]=None;a[second]=p//2
        if len(ids)>=2:heapq.heappush(heap,-p)
        q=p//2;target=groups.setdefault(q,[]);heapq.heappush(target,second)
        if q>0 and len(target)>=2:heapq.heappush(heap,-q)
    out=[v for v in a if v is not None]
    return str(len(out))+'\\n'+' '.join(map(str,out))
''',[('错误删除后一项保留前一项','a[first]=None;a[second]=p//2','first,second=second,first;a[first]=None;a[second]=p//2'),('错误上取整优先级','p//2','(p+1)//2')],1100020,output='第一行最终长度，第二行按原相对顺序的最终优先级。',explanation='输出分别3个数3 6 0、1个数0、2个数0 1。原第二例首次中间队列应为2 2 1；第三例演示中的17为笔误，最后原项一直为1。')

BLOCKED={363:'原两条k-spike定义真实截断，单例不能证明完整条件、重复值及k边界；OCR未找到补充，不能照抄catalog猜测。',367:'平局lower id ranked lower含糊且无平局例；重复race/player记录无语义，不能补唯一记录保证规避。'}
SLUGS=['amazon-vm-rental-revenue','amazon-warehouse-robots-with-threshold','calculateEfficiencyScore-amazon-calculate-efficiency-score','check-similar-passwords','count-max-num-teams','count-maximum-profitable-groups','count-num-ways','count-spikes','erase-pairs','find-median-of-subarray-uniqueness','find-minimum-inefficiency','get-average-standing','get-discount-pairs','get-max-reward-points','get-mean-rank-count','get-min-cost-data','get-minimum-cost','get-minimum-fruits','get-minimum-round-trip-cost','get-priorities-after-execution']
EVIDENCE={n:['fastprep/Amazon/'+SLUGS[n-356]+'.md'] for n in range(356,376)}
EVIDENCE[356]+=['OA LIST/Amazon_OA(包括新版AI_Codinig题）/'+str(n)+'_image.txt' for n in (313,314,316)]
def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(a,b,s):
    if s.get('checker')=='exact':return a.rstrip('\n')==b.rstrip('\n')
    if a==b:return True
    import re
    from itertools import zip_longest
    return all(x==y for x,y in zip_longest((m.group() for m in re.finditer(r'\S+',a)),(m.group() for m in re.finditer(r'\S+',b))))
SMALL_RUNNER="""import io,json,sys,contextlib
if hasattr(sys,'set_int_max_str_digits'):sys.set_int_max_str_digits(0)
code,inputs=json.load(sys.stdin);out=[]
for raw in inputs:
    sys.stdin=io.StringIO(raw);buf=io.StringIO()
    with contextlib.redirect_stdout(buf):exec(compile(code,'<authored>','exec'),{'__name__':'__main__'})
    out.append(buf.getvalue())
print(json.dumps(out,ensure_ascii=False))
"""
def small_check():
    selected={int(v) for v in sys.argv[1:] if v!='--small'}
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        rng=random.Random(SEED+s['n']);values=s['samples']+[s['rnd'](rng) for _ in range(160)]
        cases=[(s['encode'](v),str(s['oracle'](v))+'\n') for v in values];code=code_for(s)
        def run(program):
            p=subprocess.run([sys.executable,'-I','-c',SMALL_RUNNER],input=json.dumps([program,[raw for raw,_ in cases]],ensure_ascii=False),text=True,capture_output=True,timeout=120)
            assert p.returncode==0,(s['n'],p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(cases);return out
        actual=run(code)
        for i,(a,(_,expected)) in enumerate(zip(actual,cases)):assert equal(a,expected,s),(s['n'],i,cases[i][0],a,expected)
        for name,old,new in s['mutants']:
            assert old in code,(s['n'],name)
            assert any(not equal(a,expected,s) for a,(_,expected) in zip(run(code.replace(old,new)),cases)),(s['n'],name,'survived')
        print(s['n'],len(cases),'independent small cases; 2 normal-exit WA; real stdin/stdout passed',flush=True)
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
        number=s['n'];ident=f'oa-amazon-{number}'
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(SEED+number)
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=str(s['oracle'](v))+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=str(a)+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:31];assert 31<=len(tests)<=64
        for c in oracles+tests:
            assert len(c['input'].encode())<=s['bound']<=32*1024*1024,(ident,len(c['input'].encode()),s['bound'])
            assert len(c['expectedOutput'].encode())<=s.get('outputLimit',4096)*1024
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert equal(a,c['expectedOutput'],s),(ident,i,a[:200],c['expectedOutput'][:200])
        del actual
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not equal(a,c['expectedOutput'],s)];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected));del outputs
        explanation=s.get('explanation','三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') or '空文本' for c in oracles[:3])+'。独立枚举或直接模拟已核对。')
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Amazon'],description=s['desc']+'\n\n本站独立整理标准I/O与题解；来源缺失界的补充及样例纠错在协议中明示。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        assert len(normalized.encode())<=128*1024*1024,(ident,'package exceeds128MiB')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        assert (OUT/'packages'/f'{ident}.json').stat().st_size<=128*1024*1024
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracle;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del cases,tests,boundary,oracles,normalized,p,doc,c;gc.collect()
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,paths in EVIDENCE.items():
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=f'oa-amazon-{number}';reason=BLOCKED[number] if number in BLOCKED else next(s['desc']+' '+s['limits'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
