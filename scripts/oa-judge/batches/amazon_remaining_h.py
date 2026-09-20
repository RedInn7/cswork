"""Independently authored Amazon156–175; raw e66f809, never execute imported solutions."""
from collections import Counter,deque
from functools import lru_cache
from itertools import product,combinations,permutations
from pathlib import Path
import hashlib,json,random,subprocess,sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='amazon-remaining-h';SPECS=[];SEED=20261560
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,random=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def successor_oracle(s):
    # Enumerate valid completions lexicographically, not the reference pivot scan.
    def visit(prefix,greater):
        if len(prefix)==len(s):return prefix if greater else None
        for c in 'abcdefghijklmnopqrstuvwxyz':
            if prefix and c==prefix[-1] or not greater and c<s[len(prefix)]:continue
            result=visit(prefix+c,greater or c>s[len(prefix)])
            if result is not None:return result
        return None
    return visit('',False) or '-1'
add(156,'严格更大的最小无相邻重复字符串','给定小写字符串，求长度相同、字典序严格更大且任意相邻字符不同的最小字符串。原串可能已有相邻重复。不存在则输出-1。','一行非空小写串。原始快照无长度界，本站长度1..100000。','记录每个前缀是否相邻合法。从右向左枚举首次改变位置，尝试比原字符大的最小合法字符，再用a或b贪心填后缀。','严格更大串有唯一首次改变位置，此前前缀必须保留且合法；越晚改变字典序越小。固定位置时选择最小可用字符，剩余每位避开前一字符选最小即可，26字母保证后缀总能补全。因此首次找到的候选即最优。','时间O(26n)，空间O(n)。',['abbcd','az','zz'],'样例1：ab前缀保留，把第三位b升为c，补ab，得到abcab。样例2：第二位z不能升，第一位a升b后补a，得到ba。样例3：zz已是长度2最大字符串，无解-1。',lambda r:''.join(r.choice('abyz') for _ in range(r.randint(1,6))),[('z'*100000,'-1'),('ab'*50000,'ab'*49999+'ac'),('a'*100000,'ab'*50000)],lambda s:s+'\n',successor_oracle,
'''def solve(d):
    s=d[0];n=len(s);valid=[True]*(n+1)
    for i in range(1,n):valid[i+1]=valid[i] and s[i]!=s[i-1]
    for i in range(n-1,-1,-1):
        if not valid[i]:continue
        for v in range(ord(s[i])+1,123):
            c=chr(v)
            if i and c==s[i-1]:continue
            out=list(s[:i])+[c]
            for j in range(i+1,n):out.append('a' if out[-1]!='a' else 'b')
            return ''.join(out)
    return '-1'
''',[('漏查未修改前缀','if not valid[i]:continue','if False:continue'),('错误接受原串','range(ord(s[i])+1,123)','range(ord(s[i]),123)')],100001,output='输出目标字符串；无解输出-1。',outputLimit=128,time=6)
def balance_oracle(x):
    s,kit,ratings=x;best=None
    for mask in range(1<<len(kit)):
        chars=[kit[i] for i in range(len(kit)) if mask>>i&1];score=sum(ratings[i] for i in range(len(kit)) if mask>>i&1)
        # All selected opens can precede s and selected closes can follow it.
        final='('*chars.count('(')+s+')'*chars.count(')');balance=0;ok=True
        for c in final:
            balance+=1 if c=='(' else -1
            if balance<0:ok=False
        if ok and balance==0:best=score if best is None else max(best,score)
    assert best is not None
    return best
def balance_random(r):
    s=''.join(r.choice('()') for _ in range(r.randint(1,6)));kit='('*len(s)+')'*len(s)
    return s,kit,[r.randint(-5,7) for _ in kit]
add(157,'补成平衡括号串的最大评分','原括号串得分为0。kit中的每个括号有独立评分，最多用一次，可选零个；把选中的括号插入原串任意位置，原串顺序保留，得到平衡括号串，最大化所选评分总和。保证可完成。','第一行原串s，第二行kit，第三行kit每个字符的评分。原始快照无数值界，本站1≤|s|,|kit|≤100000，评分−10^9..10^9。','先求必需补的左右括号数，各类评分降序取对应必需个数。此后额外选择必须左右成对，逐对加入正收益。','设原串最小前缀为m、总余额为b，任意方案至少补L=max(0,−m)个左括号，补R=L+b个右括号；把左全放前、右全放后可实现。额外数目两类相同。固定选择数取最高分最优，后续配对收益非增，因此只取正收益配对即可。','时间O(n+m log m)，空间O(n+m)。',[('()','(())',[4,2,-3,-3]),(')','(',[-5]),('()','()',[-1,-2])],'样例1：选评分4的左括号与−3的右括号，收益1；多选一对会降低总分。样例2：必须补唯一左括号，答案−5。样例3：原串已平衡，不选任何括号得0。',balance_random,[(('('*50000,')'*50000,[10**9]*50000),50000000000000),(('()', '('*50000+')'*50000,[10**9]*100000),100000000000000)],lambda x:x[0]+'\n'+x[1]+'\n'+' '.join(map(str,x[2]))+'\n',balance_oracle,
'''def solve(d):
    s,kit=d[:2];ratings=list(map(int,d[2:]));balance=low=0
    for c in s:balance+=1 if c=='(' else -1;low=min(low,balance)
    left=-low;right=left+balance
    opens=sorted((v for c,v in zip(kit,ratings) if c=='('),reverse=True);closes=sorted((v for c,v in zip(kit,ratings) if c==')'),reverse=True)
    answer=sum(opens[:left])+sum(closes[:right])
    for a,b in zip(opens[left:],closes[right:]):
        if a+b<=0:break
        answer+=a+b
    return str(answer)
''',[('必需负收益也跳过','answer=sum(opens[:left])+sum(closes[:right])','answer=0'),('丢弃可选正收益','answer+=a+b','answer+=0')],1400030,time=6)
def maxima_oracle(s):
    totals=Counter()
    for k in range(1,len(s)+1):
        freq=Counter(s[:k]);top=max(freq.values())
        for c,f in freq.items():
            if f==top:totals[c]+=1
    return max(totals.values())
add(159,'字符成为前缀最高频的最多次数','对原串每个非空前缀，将出现次数达到该前缀最高值的所有字符各记1次，并列者都计。求单个字符累计次数的最大值。','一行小写串，1≤长度≤100000。','维护26个频率与累计次数，每加入一个字符，给所有并列最高频字符累加。','循环处理的恰为全部非空前缀，频率等于该前缀真实次数；逐个判断等于最大值正好实现并列计数定义，最终取累计最大值。','时间O(26n)，辅助空间O(26)。',['bccaaacb','zzzz','ab'],'样例1：c在第2、3、4、5、6、8个前缀并列或独占最高，共6次。样例2：z在全部4个前缀最高，答案4。样例3：a在a与ab都最高，b只在ab最高，答案2。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,18))),[('a'*100000,100000),('ab'*50000,100000)],lambda s:s+'\n',maxima_oracle,
'''def solve(d):
    freq=[0]*26;totals=[0]*26
    for c in d[0]:
        freq[ord(c)-97]+=1;top=max(freq)
        for i in range(26):
            if freq[i]==top:totals[i]+=1
    return str(max(totals))
''',[('并列不计数','if freq[i]==top:','if freq[i]==top and freq.count(top)==1:'),('只返回最终出现次数','return str(max(totals))','return str(max(freq))')],100001,time=6)
def subjects_oracle(x):
    a,b,q=x;n=len(a)
    return max(mask.bit_count() for mask in range(1<<n) if sum(max(0,b[i]-a[i]) for i in range(n) if mask>>i&1)<=q)
add(161,'有限补答次数下最多通过科目','每科已经答对answered[i]题，通过要求至少needed[i]题。可再答对总计至多q题并任意分配到各科，最大化通过科目数。','第一行n q，第二行answered，第三行needed。1≤n≤100000；0≤各元素,q≤10^9。','求每科非负缺口并升序排列，从最便宜科目开始支付。','任意选t科的所需题数至少是最小t个缺口的总和，选择它们恰好达到下界。逐科累加直到超过q得到可行科目数的最大值，零缺口自动计入。','时间O(n log n)，空间O(n)。',[([24,27,0],[51,52,100],100),([2,4],[4,5],1),([5,2],[3,2],0)],'样例1：前两科需要27+25=52题，可以通过2科，三科共152题超预算。样例2：给第二科补1题，通过1科。样例3：两科本来都达标，无需补答，答案2。',lambda r:([r.randint(0,10) for _ in range(n)],[r.randint(0,10) for _ in range(n)],r.randint(0,20)) if (n:=r.randint(1,8)) else None,[(([0]*100000,[10**9]*100000,10**9),1),(([10**9]*100000,[0]*100000,0),100000)],lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',subjects_oracle,
'''def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));costs=sorted(max(0,y-x) for x,y in zip(a,b));answer=0
    for cost in costs:
        if cost>q:break
        q-=cost;answer+=1
    return str(answer)
''',[('错误按需求总量排序','costs=sorted(max(0,y-x) for x,y in zip(a,b))','costs=sorted(b)'),('恰好用完预算也拒绝','if cost>q:','if cost>=q:')],2200040,time=6)
def combinations_oracle(a):return sum(max(a[i:j+1])>a[j] for i in range(len(a)) for j in range(i,len(a)))
add(162,'末项不是最大值的连续组合数量','组合按来源列举指非空连续子数组。若末项不是该子数组最大值，即前面存在严格更大的数，则组合平衡。求所有平衡组合总数，组合可以重叠。','第一行n，第二行n个整数。原始快照无数值界，本站1≤n≤200000，元素−10^9..10^9。','维护单调递减下标栈，找到每个末项左边最近的严格更大值位置p，该末项贡献p+1个起点。','只有起点不晚于最近更大位置时，区间才包含比末项大的元素；这些起点恰有p+1个。弹出不大于当前值的元素不会影响以后最近更大查询。按末项分组统计不重不漏。','时间O(n)，空间O(n)。',[[3,6,3],[3,3],[5,4,3]],'样例1：[3,6,3]和[6,3]平衡，共2。样例2：每段末项都是并列最大，没有严格更大元素，答案0。样例3：三个长度≥2的连续段均平衡，答案3。',lambda r:[r.randint(-3,5) for _ in range(r.randint(1,12))],[(list(range(200000,0,-1)),19999900000),([10**9]*200000,0),(list(range(200000)),0)],arr,combinations_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));stack=[];answer=0
    for i,v in enumerate(a):
        while stack and a[stack[-1]]<=v:stack.pop()
        if stack:answer+=stack[-1]+1
        stack.append(i)
    return str(answer)
''',[('把相等当严格更大','a[stack[-1]]<=v','a[stack[-1]]<v'),('只数是否有更大','answer+=stack[-1]+1','answer+=1')],2400030,time=6)
def batches_oracle(a):
    @lru_cache(None)
    def visit(state,k):
        best=k-1
        for ids in combinations([i for i,v in enumerate(state) if v],k):
            nxt=list(state)
            for i in ids:nxt[i]-=1
            best=max(best,visit(tuple(nxt),k+1))
        return best
    return visit(tuple(a),1)
add(163,'品类不重复且数量递增的最多批次','每个品类有给定数量。每批每种品类最多1件，各批件数严格递增，商品不能重复使用，可以剩余。求最多批次数。','第一行n，第二行n个数量。原始快照无数值界，本站1≤n≤100000，数量0..10^9。','数量升序处理，累计可用件数。若能支付下一批的三角总需求，就增加1个批次；每加入一种品类至多增1批。','k批若可行，可把批大小缩成1..k。该阶梯形需求的品类容量匹配条件为：对每个t≤k，容量截断和sum(min(a_i,t))至少为最后t批所需的t(2k−t+1)/2。容量升序扫描时，已处理品类的最优批数只会增加至多1；新容量不小于之前容量，除总件数条件外的截断条件由上一轮可行条件和排序保证。因此累计件数达到(k+1)(k+2)/2时恰可增一批，否则不可能。','时间O(n log n)，空间O(n)。',[[2,3,4,1,2],[100],[1,1,1]],'样例1：可以组成大小1、2、3、4的四批，第五批累计需15件但只有12件。样例2：只有一种品类，每批至多1件，最多1批。样例3：三件不同品类可分成1件和2件两批，答案2。',lambda r:[r.randint(0,3) for _ in range(r.randint(1,6))],[([10**9]*100000,100000),([0]*100000,0),([1]*100000,446)],arr,batches_oracle,
'''def solve(d):
    total=groups=0
    for v in sorted(map(int,d[1:])):
        total+=v
        if total>=(groups+1)*(groups+2)//2:groups+=1
    return str(groups)
''',[('不限制每品类最多新增一批','if total>=(groups+1)*(groups+2)//2:','while total>=(groups+1)*(groups+2)//2:'),('总件数恰好够仍拒绝','if total>=','if total>')],1100030,time=6)
def pairs_oracle(x):
    a,b=x
    return max(sum(x>y for x,y in zip(a,p)) for p in permutations(b))
add(164,'前端性能严格更高的最多配对','两组各n个数，选择前端和后端组成一对，每个元素最多使用一次。只统计前端数值严格大于后端的配对，最大化数量。','第一行n，第二行前端，第三行后端。1≤n≤100000，数值1..10^9。','分别排序，用最小尚未使用且能胜过当前后端的前端配对。','若最小前端不够大，它也不能胜过更大的后端，可跳过；若可配对，某个最优方案可以交换配对使这两个最小可用元素成对而不减少数量。重复交换给出贪心最优性。','时间O(n log n)，空间O(n)。',[([3,1,5],[2,2,4]),([2,2],[2,2]),([10],[1])],'样例1：3配2、5配4，可得2对；1不能胜过任何后端。样例2：相等不满足严格大于，0对。样例3：10>1，1对。',lambda r:([r.randint(1,8) for _ in range(n)],[r.randint(1,8) for _ in range(n)]) if (n:=r.randint(1,7)) else None,[(([10**9]*100000,[1]*100000),100000),(([10**9]*100000,[10**9]*100000),0)],lambda x:str(len(x[0]))+'\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',pairs_oracle,
'''def solve(d):
    n=int(d[0]);a=sorted(map(int,d[1:1+n]));b=sorted(map(int,d[1+n:]));j=0
    for v in a:
        if j<n and v>b[j]:j+=1
    return str(j)
''',[('把相等算胜过','v>b[j]','v>=b[j]'),('不排序原输入','a=sorted(map(int,d[1:1+n]))','a=list(map(int,d[1:1+n]))')],2200030,time=6)
def interval_oracle(x):
    rows,k=x;bags={i:v for l,h,v in rows for i in range(l,h+1)}
    return max(sum(bags.get(i,0) for i in range(start,start+k)) for start in range(1,max(bags)+1))%1000000007
def interval_random(r):
    rows=[];start=r.randint(1,3)
    for _ in range(r.randint(1,5)):
        end=start+r.randint(0,3);rows.append((start,end,r.randint(1,9)));start=end+r.randint(1,3)
    r.shuffle(rows);return rows,r.randint(1,9)
INTERVAL_CODE='''def solve(d):
    from bisect import bisect_right
    n,k=map(int,d[:2]);rows=sorted(tuple(map(int,d[i:i+3])) for i in range(2,len(d),3));starts=[r[0] for r in rows];prefix=[0]
    for l,r,v in rows:prefix.append(prefix[-1]+(r-l+1)*v)
    def integral(x):
        i=bisect_right(starts,x)-1
        if i<0:return 0
        l,r,v=rows[i];return prefix[i]+(min(x,r)-l+1)*v
    answer=0
    for l,r,v in rows:
        for start in (l,max(1,r-k+1)):
            answer=max(answer,integral(start+k-1)-integral(start-1))
    return str(answer%1000000007)
'''
for number in (160,166):
    add(number,'连续袋子窗口的最大金额'+('（区间版）' if number==160 else ''),'袋子编号从1开始。每个互不重叠的闭区间[l,r]内每袋金额为v，没有列出的袋子金额为0。选恰好k个连续袋子，先最大化真实金额，再返回该最大值对1000000007取模。'+('来源样例含违反“不重叠”保证的区间，本站替换为无重叠样例，不采用叠加解释。' if number==160 else ''),'第一行n k，随后n行l r v。原始快照无数值界，本站1≤n≤100000，1≤k,l≤r≤10^9仅要求每行l≤r（k独立1..10^9），1≤v≤10^9；区间互不重叠，输入可无序。','排序后建立区间累计金额，可二分求到任意位置的前缀金额。只需测试窗口左端对齐区间左端、或右端对齐区间右端的候选。','窗口平移一格，金额变化是新进入值减离开值。若窗口两端未触及分段变化点，变化斜率恒定，最大值可移到边界而不降低。上升结束只可能在右端离开正区间或左端进入正区间，因此这些对齐候选覆盖最优点；前缀积分精确计算每个窗口。金额比较在取模前完成。','时间O(n log n)，空间O(n)。',[([(1,4,2),(6,6,5),(7,7,7),(9,10,1)],5),([(2,3,4)],10),([(1,1,1000000008),(3,3,2)],1)],'样例1：选3..7，金额2+2+0+5+7=16。样例2：长度10可覆盖两袋各4元，得到8。样例3：真实最大1000000008大于2，先选它再取模，答案1。',interval_random,[(([(1,10**9,10**9)],10**9),(10**18)%1000000007),(([(2*i+1,2*i+1,10**9) for i in range(100000)],10**9),(100000*10**9)%1000000007),(([(1,1,10**9),(10**9,10**9,10**9)],1),10**9)],lambda x:f'{len(x[0])} {x[1]}\n'+''.join(f'{l} {r} {v}\n' for l,r,v in x[0]),interval_oracle,INTERVAL_CODE,[('漏掉右端对齐','(l,max(1,r-k+1))','(l,)'),('先取模再比较','answer=max(answer,integral(start+k-1)-integral(start-1))','answer=max(answer,(integral(start+k-1)-integral(start-1))%1000000007)')],3300040,time=6)
def score_oracle(s):
    def count(t):return sum(all(abs(ord(t[k])-ord(t[k-1]))<=1 for k in range(i+1,j)) for i in range(len(t)) for j in range(i+1,len(t)+1))
    return max(count(s[:i]+c+s[i+1:]) for i in range(len(s)) for c in 'abcdefghijklmnopqrstuvwxyz')
add(165,'修改一个字母后的最大平滑子串分数','一个非空连续子串中每对相邻字符的字母序号差不超过1，便贡献1分；单字符总贡献1分。最多把原串一个字符改成任意小写字母，求最高总分。条件只约束相邻字符，不要求整段最大最小字母差≤1。','一行小写字符串。原始快照无长度界，本站1≤长度≤100000。','预处理每个位置向左、向右的最大平滑连续长度。修改位置只影响包含它的子串，枚举26个替换，计算新的(左延伸+1)(右延伸+1)减旧贡献。','不含修改位置的子串保持不变；包含它且合法的子串可独立选择左侧和右侧各延伸多少，恰为两侧选择数乘积。相邻边决定能否接入预处理段，枚举全部位置与字符穷尽所有允许修改。','时间O(26n)，空间O(n)。',['aabacfgh','abcb','abez'],'样例1：把c改b成为aababfgh，前段长5贡献15、后段长3贡献6，共21。样例2：整串已平滑，全部10个子串计分。样例3：把e改a得到abaz，前三字符贡献6加z贡献1，总7。',lambda r:''.join(r.choice('abcez') for _ in range(r.randint(1,8))),[('a'*100000,5000050000),('az'*50000,100004)],lambda s:s+'\n',score_oracle,
'''def solve(d):
    a=list(map(ord,d[0]));n=len(a);left=[1]*n;right=[1]*n
    for i in range(1,n):
        if abs(a[i]-a[i-1])<=1:left[i]=left[i-1]+1
    for i in range(n-2,-1,-1):
        if abs(a[i]-a[i+1])<=1:right[i]=right[i+1]+1
    baseline=sum(left);answer=baseline
    for i in range(n):
        old=left[i]*right[i]
        for c in range(97,123):
            l=left[i-1] if i and abs(c-a[i-1])<=1 else 0
            r=right[i+1] if i+1<n and abs(c-a[i+1])<=1 else 0
            answer=max(answer,baseline-old+(l+1)*(r+1))
    return str(answer)
''',[('相邻相差1也拒绝','<=1','<1'),('允许新段但未减旧贡献','baseline-old+(l+1)*(r+1)','baseline+(l+1)*(r+1)')],100001,time=10)
def difference_oracle(x):
    a,k=x
    return min(max([0]+[y-x for x,y in zip(b,b[1:])]) for ids in combinations(range(len(a)),len(a)-k) for b in [sorted(a[i] for i in ids)])
add(167,'删除k个数后的最小最大相邻差','选择保留n−k个原元素，将保留元素排序，求其最大相邻差，最小化该值。仅保留1个时本站约定最大相邻差为0。来源正文截断，本题目标依据其完整样例解释恢复；不是最小化全段最大值减最小值。','第一行n k，第二行n个数。原始快照无数值界，本站1≤n≤200000，0≤k<n，数值−10^9..10^9。','排序后只需考虑连续n−k个元素；在相邻差数组上维护长度n−k−1窗口的最大值，再取最小。','任意选择有跳过的内部元素时，把所选数压缩为排序序列内连续同样多个元素，可让每条新相邻间隙包含在某条旧间隙中，故最大间隙不增。更直接：若某阈值可行，所选数之间不能跨过大于阈值的原相邻间隙，它们位于同一连续连通块，块长至少n−k，因此存在连续选择也可行。单调队列维护每个窗口最大差。','时间O(n log n)，空间O(n)。',[([1,4,3,6,5],2),([1,10,20],2),([1,4,8,9],0)],'样例1：保留3、4、5，最大相邻差1。样例2：只保留一个，答案0。样例3：不能删数，相邻差3、4、1，答案4。',lambda r:([r.randint(-5,15) for _ in range(n)],r.randrange(n)) if (n:=r.randint(1,9)) else None,[((list(range(200000)),100000),1),(([-10**9]*100000+[10**9]*100000,0),2000000000)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',difference_oracle,
'''def solve(d):
    from collections import deque
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));width=n-k-1
    if width==0:return '0'
    gaps=[a[i+1]-a[i] for i in range(n-1)];queue=deque();answer=10**30
    for i,v in enumerate(gaps):
        while queue and gaps[queue[-1]]<=v:queue.pop()
        queue.append(i)
        while queue[0]<=i-width:queue.popleft()
        if i>=width-1:answer=min(answer,gaps[queue[0]])
    return str(answer)
''',[('输出全窗口极差','gaps[queue[0]])','a[i+1]-a[i-width+1])'),('误保留k个而非n减k','width=n-k-1','width=max(0,k-1)')],2400030,time=6)
def drone_oracle(a):
    # Exhaust capacity candidates, selected replaced positions; inequalities, not equality.
    cap=10**9;candidates={1,2,cap,cap-1}|{min(cap,max(1,x)) for x in a};best=len(a)
    for x in candidates:
        for y in candidates:
            if x==y:continue
            for mask in range(1<<len(a)):
                if all(mask>>i&1 or v<=(x if i%2==0 else y) for i,v in enumerate(a)):best=min(best,mask.bit_count())
    return best
add(168,'两架不同容量无人机交替配送的最少换件数','可从容量分别为1..10^9的无人机中任选两架，两架容量必须不同，交替配送包裹（第一架送第1、3、5件）。重量不超过所用无人机容量即可；可替换一些包裹的重量为任意正整数，最小化替换数量。注意不是要求同一架所送包裹重量相同。','第一行n，第二行包裹重量。原始快照只明确无人机容量界，本站1≤n≤100000，包裹重量1..10^9。','两容量取最大10^9和次大10^9−1不会比其他选择差。只有重量恰为10^9的包裹会超过较小容量，选这种包裹较少的奇偶位置给小无人机。','把任一可用容量对按大小增大到最大两容量不会让此前可送包裹变不可送，故存在使用该对的最优方案。大容量可以送全部包裹，小容量仅不能送重量10^9者；两种交替朝向取较少违规数量即可，替换成1实现下界。','时间O(n)，空间O(n)含输入，辅助O(1)。',[[1,2,3,4],[10**9,10**9],[10**9,1,10**9,1]],'样例1：选择最大两个容量，全都足够，无需替换。样例2：两位置都需最大容量，但两机不同，因此替换1件。样例3：大无人机送奇数位置、小无人机送偶数位置，0件。',lambda r:[r.choice([1,2,10**9-1,10**9]) for _ in range(r.randint(1,8))],[([10**9]*100000,50000),([10**9,1]*50000,0)],arr,drone_oracle,
'''def solve(d):
    counts=[0,0]
    for i,v in enumerate(d[1:]):
        if int(v)==10**9:counts[i%2]+=1
    return str(min(counts))
''',[('错误只选固定朝向','min(counts)','counts[0]'),('相邻不同重量就替换',"return str(min(counts))","return str(sum(d[i]!=d[i-1] for i in range(2,len(d))))")],1100030,time=6)
def trips_oracle(a):
    def ways(n):
        if n==0:return 0
        return min([10**9]+[1+ways(n-k) for k in (2,3) if n>=k])
    result=sum(ways(v) for v in Counter(a).values());return result if result<10**9 else -1
add(169,'每趟送两件或三件同重量包裹','每趟必须送恰好2件或3件且重量相同的包裹，所有包裹恰好送一次。求最少趟数，无法完成输出-1。','第一行n，第二行重量。重量1..10^9。原始n上界有多余尾字符5，本站明确1≤n≤100000，不把排版残损当作新数量级。','按重量计数；出现1件则无解，否则每种用ceil(数量/3)趟。','不同重量不能混装，分别求解后相加。每趟最多3件产生ceil(c/3)下界；余数0全用3，余数2加一趟2，余数1且c≥4把一个3和剩余1改成两个2，均达到下界。','时间O(n)，空间O(n)。',[[1,1,1,2,2],[1],[5]*4],'样例1：重量1三件一趟、重量2两件一趟，共2趟。样例2：一件无法组2或3，无解-1。样例3：4件分成两组2，需2趟。',lambda r:[r.randint(1,5) for _ in range(r.randint(1,12))],[([10**9]*100000,33334),(list(range(1,100001)),-1)],arr,trips_oracle,
'''def solve(d):
    from collections import Counter
    counts=Counter(d[1:])
    if 1 in counts.values():return '-1'
    return str(sum((c+2)//3 for c in counts.values()))
''',[('四件误判无解',"if 1 in counts.values():","if 1 in counts.values() or 4 in counts.values():"),('所有批次只装两件','(c+2)//3','(c+1)//2')],1100030,time=6)
def circle_oracle(a):
    n=len(a);avg=sum(a)//n;best=10**30
    # Enumerate the wrap-edge flow, propagate each direction separately.
    for direction in (1,-1):
        for wrap in range(sum(a)+1):
            flow=wrap;cost=0;ok=True
            for i in (range(n) if direction==1 else range(n-1,-1,-1)):
                flow+=a[i]-avg
                if flow<0:ok=False
                cost+=flow
            if ok and flow==wrap:best=min(best,cost)
    return best
def circle_random(r):
    n=r.randint(1,7);a=[r.randint(0,7) for _ in range(n)];a[-1]+=(-sum(a))%n;return a
add(170,'只沿同一方向运输的环形均分最低费用','n个容器构成环，所有产品最终平均分到各容器，保证总量能被n整除。每件产品移动一条相邻边费用1。整个过程只能选顺时针或逆时针中的一个方向，选择哪个方向均可，但不能混用。求最少费用。','第一行n，第二行产品数量。原始快照无数值界，本站1≤n≤200000，数量0..10^9，总和可被n整除。','计算每个容器相对平均值的前缀盈余P。顺时针费用=sum(P)−n min(P)，逆时针=n max(P)−sum(P)，取小者。','顺时针边流量满足相邻边流量差等于该容器盈余，因此所有流量为P加统一常数。非负要求常数至少−min(P)，取下界费用最小。逆时针同理以max(P)平移负前缀。两种单向方案取小者，不允许用双向中位数替代。','时间O(n)，空间O(n)含输入。',[[3,4,6,6,6],[1,1],[0,2]],'样例1：前缀盈余−2、−3、−2、−1、0；顺向7、逆向8，答案7。样例2：本来均分，费用0。样例3：把1件跨一条边送给空容器，费用1。',circle_random,[(([0,10**9]*100000),50000000000000),([10**9]*200000,0)],arr,circle_oracle,
'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:]));average=sum(a)//n;prefix=total=low=high=0
    for v in a:
        prefix+=v-average;total+=prefix;low=min(low,prefix);high=max(high,prefix)
    return str(min(total-n*low,n*high-total))
''',[('强制顺时针','min(total-n*low,n*high-total)','total-n*low'),('忽略回程空缺费用','total-n*low,n*high-total','abs(total),abs(total)')],2200030,time=6)
def days_oracle(x):
    a,k,p=x
    @lru_cache(None)
    def visit(state):
        if not any(state):return 0
        return 1+min(visit(tuple(max(0,v-p) if start<=i<start+k else v for i,v in enumerate(state))) for start in range(len(a)-k+1) if any(state[start:start+k]))
    return visit(tuple(a))
add(171,'每天读连续k章的最少天数','每天选择恰好k个连续章节，每个被选章节分别读至多p页（不足p页读完为止）。章节可以重复选，已读完章节仍可被选。求全部读完的最少天数。','第一行n k p，第二行各章页数。1≤n≤100000，1≤k≤n，1≤p,页数≤10^9。','每章需要ceil(页数/p)次覆盖，从左到右扫描，不足则选择能覆盖它且尽量靠右的合法k章窗口，批量补足。','最左未满足章节的缺口是任何方案必须提供的覆盖次数。把这些覆盖移动到仍包含它的最右合法窗口，不影响已处理章节的完成，也尽可能帮助未处理的章节，故不劣。差分记录覆盖到期时间，批量执行而非逐天模拟。','时间O(n)，空间O(n)。',[([3,1,4],2,2),([3,4],1,2),([1,1,1],3,10)],'样例1：前两章选2次，后两章选2次，共4天。样例2：两章各需2天，不能同天读，答案4。样例3：一次覆盖全部且p足够，答案1。',lambda r:([r.randint(1,4) for _ in range(n)],r.randint(1,n),r.randint(1,3)) if (n:=r.randint(1,6)) else None,[(([10**9]*100000,1,1),100000000000000),(([10**9]*100000,100000,1),10**9),(([1]*100000,99999,1),2)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+' '.join(map(str,x[0]))+'\n',days_oracle,
'''def solve(d):
    n,k,p=map(int,d[:3]);a=list(map(int,d[3:]));ends=[0]*(n+1);active=answer=0
    for i,v in enumerate(a):
        active-=ends[i];need=(v+p-1)//p
        if need>active:
            delta=need-active;answer+=delta;active+=delta;start=min(i,n-k);ends[start+k]+=delta
    return str(answer)
''',[('向下取整页数','need=(v+p-1)//p','need=v//p'),('错当每天可独立跳选章节','return str(answer)','return str(max((v+p-1)//p for v in a))')],1100040,time=6)
def dist_oracle(x):
    a,b=x;return min(sum(abs(v-w) for v,w in zip(a,p)) for p in permutations(b))
add(172,'服务器与中心一对一匹配的最小总距离','直线上有n个服务器和n个数据中心，各用一次组成一对，费用为坐标差绝对值；最小化总费用。一对一语义依据来源配对样例明确，不能重复使用某个服务器。','第一行n，第二行服务器坐标，第三行中心坐标。1≤n≤100000，坐标1..10^9。','两组坐标排序后按同序配对，累加绝对差。','若两组各有x≤y、u≤v，交叉配对费用|x−v|+|y−u|不小于同序费用|x−u|+|y−v|。反复消除交叉得到排序同序方案而费用不增，因此最优。','时间O(n log n)，空间O(n)。',[([1,10],[9,2]),([3,3],[3,3]),([1],[10**9])],'样例1：1配2、10配9，总2。样例2：全部同点，费用0。样例3：唯一配对，距离999999999。',lambda r:([r.randint(1,10) for _ in range(n)],[r.randint(1,10) for _ in range(n)]) if (n:=r.randint(1,7)) else None,[(([1]*100000,[10**9]*100000),99999999900000),((list(range(1,100001)),list(range(100000,0,-1))),0)],lambda x:str(len(x[0]))+'\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',dist_oracle,
'''def solve(d):
    n=int(d[0]);a=sorted(map(int,d[1:n+1]));b=sorted(map(int,d[n+1:]));return str(sum(abs(x-y) for x,y in zip(a,b)))
''',[('不排序直接配对','a=sorted(map(int,d[1:n+1]))','a=list(map(int,d[1:n+1]))'),('忘记绝对值','abs(x-y)','x-y')],2200030,time=6)
def machines_oracle(a):
    target=sum(abs(x-y) for x,y in zip(a,a[1:]));best=len(a)
    for mask in range(1,1<<len(a)):
        b=[v for i,v in enumerate(a) if mask>>i&1]
        if sum(abs(x-y) for x,y in zip(b,b[1:]))==target:best=min(best,len(b))
    return best
add(173,'保持相邻差绝对值总和的最少机器','可删除数组中的若干元素，剩余元素相对顺序不变且至少留1个。要求剩余数组相邻差绝对值总和与原数组相同，求最少保留数量（不是删除数量）。','第一行n，第二行数组。1≤n≤200000，元素0..10^9。','去掉连续相等值。若只剩一个则答案1，否则保留首尾以及严格上升下降切换的转折点。','在单调连续段内，端点差等于全部相邻差和，删除内部点不改变目标。跨过严格转折点会让三角不等式严格，从而损失总和且其他删除不可能补回，因此每个转折必须保留；总变差非零时首尾极值也必须各保留一个。','时间O(n)，空间O(n)。',[[1,2,2,1,1],[3,3,3],[1,2,3,4]],'样例1：保留1、2、1，相邻差总和仍2，至少3个。样例2：总和0，保留任意1个即可。样例3：只留1、4，总差3不变，答案2。',lambda r:[r.randint(0,6) for _ in range(r.randint(1,10))],[([0,10**9]*100000,200000),(list(range(200000)),2),([10**9]*200000,1)],arr,machines_oracle,
'''def solve(d):
    a=[]
    for token in d[1:]:
        v=int(token)
        if not a or v!=a[-1]:a.append(v)
    if len(a)==1:return '1'
    answer=2
    for i in range(1,len(a)-1):
        if (a[i]-a[i-1])*(a[i+1]-a[i])<0:answer+=1
    return str(answer)
''',[('全相同仍保留两个',"if len(a)==1:return '1'","if len(a)==1:return '2'"),('漏计转折点','answer+=1','answer+=0')],2200030,time=6)
def variance_oracle(a):return min(j-i+1-a[i:j+1].count(a[i]) for i in range(len(a)) for j in range(i+1,len(a)) if a[i]==a[j])
def variance_random(r):
    a=[r.randint(1,5) for _ in range(r.randint(1,10))];a.insert(r.randrange(len(a)+1),r.choice(a));return a
add(174,'相同首尾子数组的最小非端点值数量','长度至少2且首尾相同的连续子数组有效。variance为子数组长度减去其中等于首尾值的元素数量。保证至少一个有效子数组，求最小variance。','第一行n，第二行数组。2≤n≤200000，元素1..10^9，至少一种值重复。','每个值只比较相邻两次出现的下标差减1，取最小。','若有效区间内端点值出现多于两次，它的非端点值数量等于相邻同值出现间隙中的其他元素数之和，非负和不小于其中任意最小项。因此某一对相邻出现就能取得不更差答案，只需枚举这些对。','时间O(n)，空间O(n)。',[[1,2,1],[5,5],[1,2,3,1,2]],'样例1：区间1、2、1只有一个非1元素，答案1。样例2：两个5，中间没有其他值，答案0。样例3：两个1或两个2之间都夹2个其他元素，答案2。',variance_random,[(list(range(1,200000))+[1],199998),([10**9]*200000,0)],arr,variance_oracle,
'''def solve(d):
    last={};answer=10**30
    for i,token in enumerate(d[1:]):
        v=int(token)
        if v in last:answer=min(answer,i-last[v]-1)
        last[v]=i
    return str(answer)
''',[('误把端点算入','i-last[v]-1','i-last[v]+1'),('只记首次而非最近出现','last[v]=i','last.setdefault(v,i)')],2200030,time=6)
def cooldown_oracle(x):
    s,gap=x;counts=tuple(Counter(s).values())
    @lru_cache(None)
    def visit(counts,waits):
        if not any(counts):return 0
        eligible=[i for i,c in enumerate(counts) if c and waits[i]==0]
        nxtwait=tuple(max(0,v-1) for v in waits)
        if not eligible:return 1+visit(counts,nxtwait)
        best=10**9
        for i in eligible:
            nxt=list(counts);nxt[i]-=1;w=list(nxtwait);w[i]=gap
            best=min(best,1+visit(tuple(nxt),tuple(w)))
        return best
    return visit(counts,(0,)*len(counts))
add(175,'相同任务间隔限制下的最短执行时间','每个字符是一项耗时1的任务，同字符属于同类。可以任意重排并插入空闲时间；两个同类任务之间至少间隔minGap个完整时间单位。求执行完所有任务的最少时间。','第一行小写任务串，第二行minGap。原始快照无数值界，本站1≤串长≤100000，0≤minGap≤10^9。','令最高出现次数f、达到它的种类数c，答案max(任务总数,(f−1)(minGap+1)+c)。','所有任务数是必需时间下界。最高频任务的前f−1轮各至少相距minGap+1，末轮还有c种，得第二下界。按频率把任务填入f−1个间隔轮，其他任务先填空位；不够用空闲补足，超过容量则扩大轮间任务数，恰能达到两个下界的最大值。','时间O(n)，辅助空间O(26)。',[('aaabbb',2),('aaabbb',0),('abacadaeafag',2)],'样例1：ab_ ab_ ab（空格仅分组）共8单位，同类间有2单位。样例2：无间隔限制，6项直接执行，答案6。样例3：a有6项，从首个到末个至少16单位，其他任务可填空隙，答案16。',lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,8))),r.randint(0,3)),[(('a'*100000,10**9),99999000100000),(('ab'*50000,0),100000)],lambda x:x[0]+'\n'+str(x[1])+'\n',cooldown_oracle,
'''def solve(d):
    from collections import Counter
    s=d[0];gap=int(d[1]);counts=Counter(s);f=max(counts.values());c=sum(v==f for v in counts.values())
    return str(max(len(s),(f-1)*(gap+1)+c))
''',[('误把间隔当起点差','(gap+1)','gap'),('漏计并列最高频','*(gap+1)+c','*(gap+1)+1')],100013,time=6)

def calories_oracle(a):
    n=len(a);dp={(1<<i,i):v*v for i,v in enumerate(a)}
    for mask in range(1,1<<n):
        for last in range(n):
            value=dp.get((mask,last))
            if value is None:continue
            for nxt in range(n):
                if not mask>>nxt&1:
                    key=(mask|1<<nxt,nxt);dp[key]=max(dp.get(key,-1),value+(a[last]-a[nxt])**2)
    return max(dp[((1<<n)-1,i)] for i in range(n))
add(158,'从地面起跳访问全部石头的最大热量','地面高度为0。必须从地面起跳，任意顺序访问每块石头恰好一次，不能再回地面。每次跳跃贡献起终点高度差的平方，最大化总贡献。相同高度的不同石头仍必须各访问一次。','第一行n，第二行石头高度。1≤n≤100000，1≤高度≤46340。','高度排序，从剩余最高、最低、次高、次低依次访问，累加相邻平方差，包含第一次从0起跳。','设当前高度x不大于全部剩余高度，M为剩余最大值。任一后续顺序x,a,…,b,M,c,…可把a到M的子段反转，得到x,M,b,…,a,c,…；内部边因平方差对称而不变，两条边的收益变化为2(M−a)(c−x)≥0。若M本来在末尾，则只把边x到a换成x到M，同样不降。因此存在最优方案下一步选择M。当前不小于全部剩余高度时，对称证明下一步可选剩余最小。起点0满足首个条件，逐步固定前缀得到交替极值贪心最优。','时间O(n log n)，空间O(n)。',[[1,2,3],[5],[2,2,2]],'样例1：顺序0→3→1→2，热量9+4+1=14。样例2：唯一一跳0→5，贡献25。样例3：先从0跳到2贡献4，其余同高跳跃为0，总4。',lambda r:[r.randint(1,20) for _ in range(r.randint(1,9))],[([46340]*100000,46340**2),([1]*50000+[46340]*50000,46340**2+99999*46339**2),([1]*100000,1)],arr,calories_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]));lo=0;hi=len(a)-1;at=answer=0;highest=True
    while lo<=hi:
        if highest:v=a[hi];hi-=1
        else:v=a[lo];lo+=1
        answer+=(v-at)**2;at=v;highest=not highest
    return str(answer)
''',[('遗漏地面起跳热量','at=answer=0','at=a[-1];answer=0'),('只按降序访问','highest=not highest','highest=True')],600030,time=6)

# Final metadata normalization, preserving explicit source-vs-site distinction.
for spec in SPECS:
    if spec['n']==159:spec['explain']=spec['explain'].replace('第2、3、4、5、6、8','第2、3、4、5、7、8')
    if spec['n'] in (160,166):
        spec['limits']=spec['limits'].replace('1≤k,l≤r≤10^9仅要求每行l≤r（k独立1..10^9）','1≤l≤r≤10^9，1≤k≤10^9')
        spec['samples'][2]=([(1,2,500000004),(4,4,2)],2)
        spec['explain']=spec['explain'].replace('真实最大1000000008大于2','选前两袋，真实金额1000000008大于其他窗口')
    if spec['n']==165:spec['edges'][1]=('az'*50000,100003)
    if spec['n']==157:spec['edges'].append((('('*50000+')'*50000,'()',[0,0]),0))
    if spec['n']==170:spec['edges'].append(([0]*100000+[10**9]*100000,5000000000000000000))

def execute(path,inputs):
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300,check=True)
    outputs=json.loads(result.stdout);assert len(outputs)==len(inputs);return outputs
def main():
    for name in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/name).mkdir(parents=True,exist_ok=True)
    sources={v['id']:v for v in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};items=[];reports=[]
    selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        items=[v for v in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(v['id'].split('-')[-1]) not in selected]
        reports=[v for v in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(v['id'].split('-')[-1]) not in selected]
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        identifier=f"oa-amazon-{s['n']}";rng=random.Random(SEED+s['n']);code=s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        values=s['samples']+[s['random'](rng) for _ in range(160)];oracle=[dict(input=s['encode'](x),expectedOutput=str(s['oracle'](x))+'\n') for x in values]
        tests=oracle[:3]+[dict(input=s['encode'](x),expectedOutput=str(y)+'\n') for x,y in s['edges']]+oracle[3:31]
        assert len(tests)<=64 and s['bound']<=32*1024*1024
        for c in oracle+tests:assert len(c['input'].encode())<=s['bound'] and '\ufffd' not in c['input']+c['expectedOutput']
        for i,(actual,c) in enumerate(zip(execute(path,[c['input'] for c in oracle+tests]),oracle+tests)):assert actual.split()==c['expectedOutput'].split(),(identifier,i,actual[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];killed=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(identifier,name);changed=code.replace(old,new);mp=OUT/'negative-controls'/f'{identifier}-{j}.py';mp.write_text(changed)
            outputs=execute(mp,[c['input'] for c in cases]);bad=[i for i,(actual,c) in enumerate(zip(outputs,cases)) if actual.split()!=c['expectedOutput'].split()];assert bad,(identifier,name,'survived')
            mutants.append(dict(name=name,code=changed));killed.append(dict(name=name,rejectedByCases=bad))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Amazon'],description=s['desc']+'\n\n标准I/O、样例和题解由本站独立编写，明确标注本站的范围不是来源原约束。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=s['explain'],hints=[s['idea']],timeLimit=s.get('time',6),memoryLimit=s.get('memory',262144),outputLimit=s.get('outputLimit',4096),checker='tokens',languages=['python','go','java','cpp'])
        raw=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout;assert '\ufffd' not in raw
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)];source=sources[identifier]
        for folder,data in dict(packages=json.loads(raw),oracles=oracle,mutants=mutants,editorials=dict(schemaVersion=1,id=identifier,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        assert (OUT/'packages'/f'{identifier}.json').stat().st_size<=128*1024*1024
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(raw.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracle),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=s['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()));print(identifier,'163 oracle,',len(cases)-3,'hidden, 2 normal mutants rejected',flush=True)
    items.sort(key=lambda v:int(v['id'].split('-')[-1]));reports.sort(key=lambda v:int(v['id'].split('-')[-1]))
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,note='Local batched runpy only; fresh __main__/stdin/stdout per case, not per-case OS isolation. Production sandbox required.'),ensure_ascii=False,indent=2)+'\n')
    reviews=[dict(id=f"oa-amazon-{s['n']}",status='authored',reason=s['desc']+' 原始快照e66f809逐题核对，独立oracle和正常退出语义负控通过。') for s in sorted(SPECS,key=lambda s:s['n'])]
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
