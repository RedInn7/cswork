"""Independently authored Amazon236–255; immutable raw e66f809 read only."""
from collections import Counter,deque
from functools import lru_cache
from itertools import combinations,permutations,product
from pathlib import Path
import hashlib,json,re
import amazon_remaining_h as base
base.SPECS=[];base.BATCH='amazon-remaining-l';base.SEED=20262360
add=base.add;arr=base.arr
def seq(a):return ' '.join(map(str,a))
def ak(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def two(x):return str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n'
def text(s):return s+'\n'
def segments(s):
    dp=[0]+[len(s)]*len(s)
    for end in range(1,len(s)+1):
        for start in range(end):
            if len(set(s[start:end]))==end-start:dp[end]=min(dp[end],dp[start]+1)
    return dp[-1]
add(236,'每段字符不重复的最少连续分段','将小写字符串切成若干非空连续段，每段每个字符最多出现一次，求最少段数。不能重排字符或跳过字符。','输入一行字符串。1≤长度≤100000，只含小写字母。','维护当前段的字符集合，下一字符若重复则结束当前段并新开一段，否则继续加入。','第一段不能越过第一次重复位置，所以尽可能长的合法前缀不比任何其他第一段短。把任意最优分段的第一段延长到这个前缀，只会删去或缩短后续段而不增加段数。对剩余后缀重复交换论证，贪心达到最少段数。','时间O(n)，辅助空间O(26)。',['abac','aaaa','abcabc'],'答案依次2、4、2；abcabc可分abc和abc。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,12))),[('a'*100000,100000),('abcdefghijklmnopqrstuvwxyz'*3846+'abcd',3847),('ab'*50000,50000)],text,segments,
'''def solve(d):
    s=d[0];seen=set();answer=1
    for c in s:
        if c in seen:answer+=1;seen.clear()
        seen.add(c)
    return str(answer)
''',[('误取最大字符频率','return str(answer)','return str(max(s.count(c) for c in set(s)))'),('不开新段的空集合','seen.clear()','None')],100001)
def operations(a):
    start=tuple(a);target=tuple(sorted(a));q=deque([(start,())]);seen={start}
    while q:
        state,ops=q.popleft()
        if state==target:return seq(ops) if ops else '-1'
        for x in sorted(a):
            nxt=tuple(v for v in state if v<x)+tuple(v for v in state if v>=x)
            if nxt not in seen:seen.add(nxt);q.append((nxt,ops+(x,)))
add(237,'最少稳定阈值划分的字典序最小操作序列','数组值互异。一次选择数组中存在的值x，先放全部小于x的元素，再放全部大于等于x的元素，两组内部各保持当前相对顺序。目标为升序，先最小化操作数，再取阈值序列的字典序最小者；原本有序输出−1。','第一行n，第二行资源值。1≤n≤50，1≤值≤10^9，值互异。','值排序为b，记录原位置pos；输出所有满足pos[b[i−1]]>pos[b[i]]的b[i]，按升序。','两个排序相邻值u<v若原位置逆序，只有阈值u<x≤v能改变两者相对位置；x必须存在，所以必须选择v。相邻值之间不需要阈值的连续值块，其原相对次序已正确。把全部必要阈值升序各执行一次，块间排序而块内保持，足以完成。该集合是任何解的子集，因此操作数最少，升序又是其字典序最小排列。','时间O(n log n)，空间O(n)。',[[6,4,3,5,2,1],[10,5,14,12,13],[1,2,3]],'答案依次2 3 4 6、10 14、−1。来源第二例输出14 15对应另一数组且15不在实际输入中，本站按给定输入纠正为10 14。',lambda r:r.sample(range(1,30),r.randint(1,6)),[(list(range(50,0,-1)),seq(range(2,51))),(list(range(1,51)),'-1'),([10**9]+list(range(1,50)),'1000000000')],arr,operations,
'''def solve(d):
    a=list(map(int,d[1:]));pos={v:i for i,v in enumerate(a)};b=sorted(a);answer=[b[i] for i in range(1,len(b)) if pos[b[i-1]]>pos[b[i]]]
    return ' '.join(map(str,answer)) if answer else '-1'
''',[('阈值取较小相邻值','answer=[b[i]','answer=[b[i-1]'),('操作序列倒序',"map(str,answer)","map(str,answer[::-1])")],560,output='输出阈值序列，以空格分隔；不需操作时仅输出−1。')
def special(s):
    def visit(prefix,greater):
        if len(prefix)==len(s):return prefix if greater else None
        for c in 'abcdefghijklmnopqrstuvwxyz':
            if prefix and prefix[-1]==c:continue
            if not greater and c<s[len(prefix)]:continue
            out=visit(prefix+c,greater or c>s[len(prefix)])
            if out is not None:return out
        return None
    return visit('',False) or '-1'
add(239,'严格更大的最小无相邻重复字符串','输出与s同长度、字典序严格大于s、且相邻字符不同的字符串中最小者；不存在输出−1。原串本身可能已有相邻重复，z不能循环成a。','输入一行小写字符串。1≤长度≤1000000。','预处理每个前缀是否相邻合法。从右向左枚举首次改动位置，尝试更大的最小合法字符，再用a或b贪心填最小后缀。','任何严格更大结果都有唯一首次不同位置，其保留前缀必须合法；该位置越靠右，结果越小。同位置选最小可用增大字符，此后逐位选不同于前一位的最小字母即可完成。遍历顺序精确按可能最优的优先级，首个结果就是答案。','时间O(26n)，空间O(n)。',['abbd','abccde','zzab'],'答案依次abca、abcdab、−1。不能只改尾字母而保留原串内部的重复字符。',lambda r:''.join(r.choice('abyz') for _ in range(r.randint(1,6))),[('z'*1000000,'-1'),('ab'*500000,'ab'*499999+'ac'),('a'*1000000,'ab'*500000)],text,special,
'''def solve(d):
    s=d[0];n=len(s);valid=bytearray(n+1);valid[0]=valid[1]=1
    for i in range(1,n):valid[i+1]=valid[i] and s[i]!=s[i-1]
    for i in range(n-1,-1,-1):
        if not valid[i]:continue
        for value in range(ord(s[i])+1,123):
            c=chr(value)
            if i and c==s[i-1]:continue
            out=list(s[:i])+[c]
            for _ in range(i+1,n):out.append('a' if out[-1]!='a' else 'b')
            return ''.join(out)
    return '-1'
''',[('漏查保留前缀','if not valid[i]:continue','if False:continue'),('错误允许结果等于原串','range(ord(s[i])+1,123)','range(ord(s[i]),123)')],1000001,output='输出目标字符串；不存在输出−1。',outputLimit=2048,time=8)
def stable(x):
    a,k=x;return sum(len(set(a[l:r]))<=k for l in range(len(a)) for r in range(l+1,len(a)+1))%1000000007
add(240,'至多k种收入的稳定连续期间数','收入数组中每个非空连续期间若包含至多k个不同收入值则稳定，统计所有稳定期间，对1000000007取模。不同起止位置分别计数。','第一行n k，第二行收入。1≤n≤100000，1≤k≤n，−10^9≤收入≤10^9。','滑动窗口维护每种值频率，超过k种则缩左端；每个右端贡献窗口长度。','固定右端时，最左合法起点到右端之间的所有起点都合法，更早起点不合法。窗口右移只能令最早合法起点不向左，因此双指针找到该边界，贡献right−left+1恰好按右端不重不漏统计。','时间O(n)，空间O(n)。',[([1,2,1],1),([2,-3,2,-3],2),([5,5,5],1)],'答案依次3、10、6。相同收入的连续区间也可以跨多个日期。',lambda r:([r.randint(-3,4) for _ in range(n)],r.randint(1,n)) if (n:=r.randint(1,12)) else None,[(([10**9]*100000,1),5000050000%1000000007),((list(range(-100000,0)),1),100000),(([-10**9,10**9]*50000,100000),5000050000%1000000007)],ak,stable,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));freq={};left=answer=0
    for right,v in enumerate(a):
        freq[v]=freq.get(v,0)+1
        while len(freq)>k:
            old=a[left];freq[old]-=1;left+=1
            if not freq[old]:del freq[old]
        answer+=right-left+1
    return str(answer%1000000007)
''',[('只算恰好k种','answer+=right-left+1','answer+=(right-left+1) if len(freq)==k else 0'),('只算单日','answer+=right-left+1','answer+=1')],1200040)
def requests(x):
    a,old,new=x;a=list(a);out=[]
    for r,v in zip(old,new):a=[v if z==r else z for z in a];out.append(sum(a))
    return seq(out)
def requests_random(r):
    n=r.randint(1,10);return [r.randint(1,6) for _ in range(n)],[r.randint(1,6) for _ in range(n)],[r.randint(1,6) for _ in range(n)]
add(241,'每天批量替换服务器后的总请求数','初始n台服务器，ID也表示该台处理请求数。随后n天，第j天把全部ID为replaced[j]的服务器ID改为newId[j]，输出每一天操作后的ID总和。替换不存在ID或同ID不改变结果。','第一行n，随后三行各n个整数，依次为初始ID、replaced、newId。raw范围写作105及104而无上标，本站明确采用1≤n≤100000、1≤全部ID≤10000。','保存ID频次和总和，r改v时将c=count[r]迁移，total+=(v−r)*c，输出更新后总和。','频次精确描述全部服务器，操作只影响原ID为r的c台，每台贡献改变v−r。把这c个身份迁移到v，其他频次不变，归纳得到每天状态及总和。r=v时直接保持状态。','时间O(n)，空间O(n)。',[([20,10],[10,20],[20,1]),([3,3],[3,1],[1,5]),([2,5,2],[2,5,3],[3,1,5])],'答案依次40 2、2 10、11 7 11；替换会影响前一天已经改过ID的服务器。',requests_random,[(([10000]*100000,[10000]*100000,[10000]*100000),seq([10**9]*100000)),(([1]*100000,[1]+[10000]*99999,[10000]*100000),seq([10**9]*100000))],lambda x:str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n'+seq(x[2])+'\n',requests,
'''def solve(d):
    from collections import Counter
    n=int(d[0]);a=list(map(int,d[1:1+n]));old=list(map(int,d[1+n:1+2*n]));new=list(map(int,d[1+2*n:]));freq=Counter(a);total=sum(a);out=[]
    for r,v in zip(old,new):
        if r!=v:
            count=freq.pop(r,0);total+=(v-r)*count;freq[v]+=count
        out.append(str(total))
    return ' '.join(out)
''',[('一次只替换一台','count=freq.pop(r,0)','count=min(1,freq.pop(r,0))'),('把原新ID服务器重复加算','total+=(v-r)*count','total+=(v-r)*count+v*freq[v]')],1800030,output='输出n个整数，为每天操作后的总请求数。',outputLimit=2048)
def classes(x):
    a,k=x;n=len(a);valid=[]
    for mask in range(1,1<<n):
        b=[v for i,v in enumerate(a) if mask>>i&1]
        if max(b)-min(b)<=k:valid.append(mask)
    @lru_cache(None)
    def go(mask):
        if not mask:return 0
        first=mask&-mask
        return 1+min(go(mask^part) for part in valid if part&first and part&mask==part)
    return go((1<<n)-1)
add(242,'技能差限制下的最少学生班级','将全部学生划分成班级，每班任意两人的技能差不超过maxSpread，求最少班数。分组不要求保持原下标相邻，同技能不同学生均须安排。','第一行n maxSpread，第二行技能。原文n≤100000、技能上界10^9，下界排版有损且未给maxSpread界；本站明确1≤n≤100000，1≤技能≤10^9，0≤maxSpread≤10^9。','技能排序，每班从最小未分配者开始，吸收所有不超过其技能加maxSpread者。','最小未分配技能v所在班不能含超过v+maxSpread的人。把此区间内其他学生全部移到该班不会破坏班内约束，也不会增加其他班数，所以存在最优方案使用贪心第一班。递归处理剩余学生得到最少班数。','时间O(n log n)，空间O(n)。',[([1,4,7,3,4],2),([1,2,3],1),([7,7,7],0)],'答案依次3、2、1。相邻技能差都≤1不表示1,2,3可同班。',lambda r:([r.randint(1,12) for _ in range(r.randint(1,8))],r.randint(0,6)),[((list(range(1,100001)),0),100000),(([10**9]*100000,0),1),(([1]*50000+[10**9]*50000,10**9),1)],ak,classes,
'''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));answer=0;start=None
    for v in a:
        if start is None or v-start>k:answer+=1;start=v
    return str(answer)
''',[('不允许刚好等于技能差','v-start>k','v-start>=k'),('只检查相邻技能差','return str(answer)','return str(1+sum(y-x>k for x,y in zip(a,a[1:])))')],1100040)
def wins(x):
    a,b=x;return sum(a[i]+a[j]>b[i]+b[j] for i in range(len(a)) for j in range(i+1,len(a)))%1000000007
for number in (243,245):
    add(number,'同下标双人对的第一组获胜场数'+('（另一来源）' if number==245 else ''),'两组各n人。对每个相同下标对i<j，第一组两人技能和严格大于第二组对应两人技能和时获胜，平局不胜。统计获胜场数，对1000000007取模。'+('本页索引排版缺失，由同快照amazon-group1-win-count.md的完整正文和相同样例补回对应下标规则。' if number==245 else ''),'第一行n，第二行第一组技能，第三行第二组技能。2≤n≤100000，两组技能均1..10^9。','先按原下标求两组技能差，再排序差值，双指针统计两数和严格大于0的无序下标对。','原不等式等价于d[i]+d[j]>0。排序仅重排这些完整差值，不改变下标对计数。若最小与最大之和>0，最大与中间所有数也都成功，贡献right−left后移走最大；否则最小不能配当前及更小最大值，可移走最小。两分支不重不漏。','时间O(n log n)，空间O(n)。',[([1,2,3],[3,2,1]),([5,5],[5,5]),([2,2,2],[1,1,1])],'答案依次1、0、3。不能把两组分别排序后再相减。',lambda r:([r.randint(1,12) for _ in range(n)],[r.randint(1,12) for _ in range(n)]) if (n:=r.randint(2,12)) else None,[(([10**9]*100000,[1]*100000),4999950000%1000000007),(([10**9]*100000,[10**9]*100000),0),(([1]*100000,[10**9]*100000),0)],two,wins,
'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:]));delta=sorted(x-y for x,y in zip(a,b));left=0;right=n-1;answer=0
    while left<right:
        if delta[left]+delta[right]>0:answer+=right-left;right-=1
        else:left+=1
    return str(answer%1000000007)
''',[('平局也算赢','delta[left]+delta[right]>0','delta[left]+delta[right]>=0'),('丢失原下标对应关系','zip(a,b)','zip(sorted(a),sorted(b))')],2200030)
def attack(x):
    s,order,m=x
    if m==0:return 1
    a=list(s)
    for time,p in enumerate(order,1):
        a[p-1]='*'
        bad=sum('*' in a[l:r] for l in range(len(a)) for r in range(l+1,len(a)+1))
        if bad>=m:return time
def attack_random(r):
    n=r.randint(1,10);return ''.join(r.choice('abc') for _ in range(n)),r.sample(range(1,n+1),n),r.randint(0,n*(n+1)//2)
add(244,'恶意字符子串数达到阈值的最早时刻','初始小写密码长度n。第t秒将attackOrder[t]位置（1基）改成*，attackOrder是1..n的排列。损坏子串是至少含一个*的非空连续子串，按起止位置分别计数。求数量首次达到或超过m的秒数。m=0时按来源特别规定输出1。来源正文误写阈值n，据参数m和两例更正。','第一行n m，第二行密码，第三行n个attackOrder。1≤n≤800000，0≤m≤n(n+1)/2，密码小写，attackOrder为1..n的排列。','逆序撤销攻击，将所有位置从坏变好。维护每个良好连续段两端的长度；激活位置时读取左右长度L、R，新增加的全好子串恰为(L+1)(R+1)。当坏子串数从≥m变为<m，撤销前的时间就是答案。','每个全好子串只属于一个全好段，坏子串数等于总子串数减全好子串数。激活位置新产生的子串必须经过该位置，左右各有L+1和R+1种延伸选择，所以增量公式精确。左右邻居若良好必为段边界，边界长度可直接合并更新。正向坏子串数单调增加，逆向首次跌破阈值的前一状态正是最早满足时刻。','时间O(n)，空间O(n)，子串计数用64位。',[('bcced',[2,3,1,4,5],10),('abcd',[4,1,3,2],10),('a',[1],0)],'答案依次2、4、1。第一例第1秒8个坏子串，第2秒11个，首次达到10。',attack_random,[(('a'*800000,range(1,800001),1),1),(('b'*800000,range(800000,0,-1),320000400000),800000),(('z'*800000,range(1,800001),0),1)],lambda x:f'{len(x[0])} {x[2]}\n'+x[0]+'\n'+seq(x[1])+'\n',attack,
'''def solve(d):
    from array import array
    n,m=map(int,d[:2]);order=list(map(int,d[3:]))
    if m==0:return '1'
    spans=array('i',[0])*(n+2);bad=n*(n+1)//2
    for t in range(n,0,-1):
        p=order[t-1];left=spans[p-1];right=spans[p+1];length=left+right+1
        spans[p]=1;spans[p-left]=spans[p+right]=length;bad-=(left+1)*(right+1)
        if bad<m:return str(t)
    return '1'
''',[('起始已满足返回0',"if m==0:return '1'","if m==0:return '0'"),('阈值误用严格超过','if bad<m:','if bad<=m:')],6400050,time=8)
def survivors(a):
    @lru_cache(None)
    def go(state):
        if len(state)==1:return frozenset([state[0][0]])
        answer=set()
        for i,j in combinations(range(len(state)),2):
            for winner,loser in ((i,j),(j,i)):
                if state[winner][1]<state[loser][1]:continue
                nxt=[v for k,v in enumerate(state) if k not in (i,j)]+[(state[winner][0],state[i][1]+state[j][1])]
                answer.update(go(tuple(sorted(nxt))))
        return frozenset(answer)
    return seq(sorted(go(tuple(enumerate(a,1)))))
add(246,'可能成为最终幸存者的库存任务下标','每次任选两个当前任务交战，机器人多者赢并吸收对方全部机器人；同数量时任一方都可能赢。持续到只剩一个任务，输出至少存在一种过程能最终存活的全部原1基下标，升序排列。','第一行n，第二行机器人数量。1≤n≤200000，1≤数量≤10^9。任务下标互异，数量可相同。','数量升序，从左向右累加。每遇当前值大于此前全部值之和，就将候选幸存后缀起点设为当前；最后输出数量不小于该起点值的原下标。','若某处前缀总量小于下一数，则前缀任何身份无论先如何合并，都无法击败右边任何任务，因此均不能幸存。最后这样的断点之后，一个候选先吞并比自己小的全部任务，然后按升序吞并更大任务；后续没有断点，当前累计量总足够，等号可选择自己获胜。于是排除的全部不可能、保留的全部可构造。','时间O(n log n)，空间O(n)，累计量用64位。',[[1,6,2,7,2],[1,1],[1,2,3]],'答案依次2 4、1 2、2 3。同量交战允许所选身份胜出。',lambda r:[r.randint(1,12) for _ in range(r.randint(1,6))],[([10**9]*200000,seq(range(1,200001))),([1]*199999+[10**9],'200000'),([1], '1')],arr,survivors,
'''def solve(d):
    a=list(map(int,d[1:]));b=sorted(a);total=0;threshold=b[0]
    for v in b:
        if total<v:threshold=v
        total+=v
    return ' '.join(str(i+1) for i,v in enumerate(a) if v>=threshold)
''',[('等量也视为打不过','if total<v:','if total<=v:'),('误只允许初始最大值幸存','if v>=threshold','if v==b[-1]')],2200030,output='输出全部可能幸存任务的1基下标，升序、空格分隔。',outputLimit=4096)
def regex_oracle(x):
    pattern,words=x;return '\n'.join('YES' if re.fullmatch(pattern,s) is not None else 'NO' for s in words)
def regex_random(r):
    atoms=[]
    for _ in range(r.randint(1,4)):
        if r.randrange(3)==0:atoms.append('('+''.join(r.choice('ab.') for _ in range(r.randint(0,3)))+')*')
        else:atoms.append(r.choice('ab.')+('*' if r.randrange(2) else ''))
    return ''.join(atoms),[''.join(r.choice('ab') for _ in range(r.randint(0,8))) for _ in range(r.randint(1,5))]
add(247,'带分组与星号的完整字符串匹配','对每个查询判断整个字符串是否匹配正则：小写字母匹配自身，.匹配一个任意小写字母，*表示前一原子重复零次或多次。括号内是字母或.的串，无嵌套无*，括号后必有*，允许空括号()*。每次重复中的.独立匹配。依据正式规则及a(b.d)*、ab(e.r)*e示例，纠正来源孤立错误说明：(.)*可以匹配ac、and、bcd，也能匹配空串。','第一行正则，第二行查询数q，随后q行查询。空查询以单独的-表示（-不是正则字符）。来源无数值界，本站正则长度1..200、1≤q≤200、各查询长度0..20000、总查询长度≤20000。保证正则语法合法，*只接原子且不重复出现。','把字母或点、括号内容解析成原子及是否带*。逐原子DP保存可匹配的查询前缀；无*消耗一次，带*可消耗零次或从同层更短前缀再消耗一次。空()*直接跳过。','DP起点仅空前缀可达。无*时每种新前缀唯一来自此前层并匹配一次原子；带*时要么零次继承旧层，要么从同层短一个原子长度的位置继续匹配。按前缀长度递增计算涵盖任意重复次数且没有循环。空原子重复不会改变串，跳过保持语义。最后整个长度可达当且仅当完整匹配。','时间O(正则长度×总查询长度+q×正则长度)，空间O(最大查询长度+正则长度)。',[('ab(e.r)*e',['abbeere','abefretre']),('..()*e*',['code','abeee','cd']),('(.)*',['ac','and','bcd',''])],'输出依次为NO/YES；NO/YES/YES；YES/YES/YES/YES。空()*不会消耗字符，不能无限循环。',regex_random,[(('a*'*100,['a'*20000]),'YES'),(('(.)*',['z'*20000]),'YES'),(('()*'*66,['']*200),'\n'.join(['YES']*200)),(('a'*200,['a'*199+'b']*100),'\n'.join(['NO']*100))],lambda x:x[0]+'\n'+str(len(x[1]))+'\n'+'\n'.join(s or '-' for s in x[1])+'\n',regex_oracle,
'''def solve(d):
    regex=d[0];words=['' if s=='-' else s for s in d[2:]];atoms=[];i=0
    while i<len(regex):
        if regex[i]=='(':
            end=regex.index(')',i);pat=regex[i+1:end];i=end+1
        else:pat=regex[i];i+=1
        star=i<len(regex) and regex[i]=='*'
        if star:i+=1
        atoms.append((pat,star))
    results=[]
    for word in words:
        m=len(word);dp=bytearray(m+1);dp[0]=1
        for pat,star in atoms:
            if not pat:continue
            length=len(pat);nxt=bytearray(dp) if star else bytearray(m+1)
            for end in range(length,m+1):
                if not (nxt[end-length] if star else dp[end-length]):continue
                good=True
                for offset,p in enumerate(pat):
                    c=word[end-length+offset]
                    if not(p=='.' or p==c):good=False;break
                if good:nxt[end]=1
            dp=nxt
        results.append('YES' if dp[m] else 'NO')
    return '\\n'.join(results)
''',[('点错误当普通字符',"p=='.' or p==c","p==c"),('空分组错误消耗a',"if not pat:continue","if not pat:pat='a';star=False")],20420,output='每行输出对应查询的YES或NO。',time=8)
@lru_cache(None)
def near_palindrome(s):
    for removed in range(-1,len(s)):
        t=s if removed<0 else s[:removed]+s[removed+1:]
        for p in set(permutations(t)):
            if p==p[::-1]:return True
    return False
def split_palindrome(s):return 'YES' if any(near_palindrome(s[:i]) and near_palindrome(s[i:]) for i in range(1,len(s))) else 'NO'
add(248,'两段各删至多一字符后可重排回文','把小写字符串切成两个非空连续子串。每一段分别最多删除一个字符，然后可以任意重排；若两段都能组成回文输出YES，否则NO。删除不是必须做；长度1的段可直接保留。','输入一行字符串。1≤长度≤300000，小写字母。','维护全串及切点前缀的26位字符频率奇偶掩码。存在切点使左右奇频字符数都≤2则YES，否则NO。','一个多重集能重排回文恰好至多一个奇频字符。删一个奇频字符最多减少一个奇频，因此删至多一次可行恰好原奇频数≤2。两个段独立选择删除与排列，枚举全部非空切点并检查左右条件就穷尽所有方案。','时间O(n)，辅助空间O(26)不含输入。',['abcad','abcde','a'],'答案依次YES、NO、NO。abcde不论如何分，两侧必有一段至少3种各出现一次的字符，删一次仍不能重排回文。',lambda r:''.join(r.choice('abcde') for _ in range(r.randint(1,7))),[('a'*300000,'YES'),('a'*299995+'bcdef','NO'),('abcdefghijklmnopqrstuvwxyz'*11538+'abcdefghijkl','NO')],text,split_palindrome,
'''def solve(d):
    s=d[0];total=0
    for c in s:total^=1<<(ord(c)-97)
    left=0
    for c in s[:-1]:
        left^=1<<(ord(c)-97)
        if left.bit_count()<=2 and (total^left).bit_count()<=2:return 'YES'
    return 'NO'
''',[('错误放宽为三种奇频','bit_count()<=2','bit_count()<=3'),('错误禁止删除字符','bit_count()<=2','bit_count()<=1')],300001,time=8)
def kth(x):
    a,m,k=x;return seq(sorted(a[i:i+m])[k-1] for i in range(len(a)-m+1))
def kth_random(r):
    a=[r.randint(-8,8) for _ in range(r.randint(1,12))];m=r.randint(1,len(a));return a,m,r.randint(1,m)
add(249,'每个长度m窗口的第k小元素','对数组从左到右的每个长度m连续窗口，输出其中第k小元素，相同数的不同位置分别占一个排序名次。输出顺序按窗口起点递增。原始正文截断，本规则由原始样例明确说明的m=3窗口、第2小及输出顺序恢复。','第一行n m k，第二行数组。原文无数值界，本站1≤k≤m≤n≤100000，−10^9≤元素≤10^9。','离散化数值，树状数组维护当前窗口每个值的频次。二进制提升找到前缀频次首次达到k的位置；滑动时删除旧元素、加入新元素。','树状数组初始恰为第一个窗口频次，每步一次删除加入保持不变式。第k小值的离散坐标就是累计频次首次达到k的坐标，二进制提升找到其前一个累计不足k的最大前缀，因此下一坐标准确。重复元素的频次计入全部身份。','时间O(n log n)，空间O(n)。',[([3,1,4,2],3,2),([2,2,1],2,2),([-5],1,1)],'答案依次3 2、2 2、−5。第二例两个2是两件独立元素。',kth_random,[((list(range(100000,0,-1)),100000,100000),'100000'),(([-10**9]*100000,1,1),seq([-10**9]*100000)),((list(range(100000)),50000,1),seq(range(50001)))],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n',kth,
'''def solve(d):
    n,m,k=map(int,d[:3]);a=list(map(int,d[3:]));values=sorted(set(a));index={v:i+1 for i,v in enumerate(values)};size=len(values);tree=[0]*(size+1)
    def add(value,delta):
        i=index[value]
        while i<=size:tree[i]+=delta;i+=i&-i
    for v in a[:m]:add(v,1)
    out=[]
    for start in range(n-m+1):
        if start:add(a[start-1],-1);add(a[start+m-1],1)
        target=k;at=0;step=1<<(size.bit_length()-1)
        while step:
            nxt=at+step
            if nxt<=size and tree[nxt]<target:target-=tree[nxt];at=nxt
            step//=2
        out.append(str(values[at]))
    return ' '.join(out)
''',[('错误选第k减一小','target=k;','target=max(1,k-1);'),('漏掉最后窗口','range(n-m+1)','range(n-m)')],1200050,output='输出n−m+1个整数，按窗口起点顺序、空格分隔。',outputLimit=2048,time=8)
def lex_result(x):
    a,k=x
    @lru_cache(None)
    def go(i,last):
        if i>=len(a):return ()
        best=go(i+1,last)
        if a[i]<=last:best=max(best,(a[i],)+go(i+k+1,a[i]))
        return best
    return seq(go(0,10**9+1))
add(250,'取一件跳k件后的字典序最大非增数组','可重复任选：丢弃当前最左一件；或将当前最左重量加入结果，并移除它及之后的k件。剩余不足k件时一并移除，仍可选取当前件。要求结果重量非增，并在全部可行结果中按字典序最大：首次不同处更大者优先，另一序列为其前缀时更长者优先。','第一行n k，第二行重量。原文无数值界，本站1≤n≤200000，0≤k≤10^9，1≤重量≤10^9。','预处理每个后缀中最大值的最早下标。每轮取该最大值，跳到其下标+k+1继续。','可任意丢弃，因此任意后缀位置都能成为下一项，字典序最优必须选最大值。多个相同最大值中最早者选后留下的后缀包含较晚者选后留下的后缀，可通过继续丢弃模拟后者，故最早不劣。下一个后缀最大值不会超过当前最大值，自动满足非增。逐项归纳最优。','时间O(n)，空间O(n)。',[([4,3,5,5,3],1),([10,5,9,2,5],2),([3],0)],'答案依次5 3、10 5、3。第一例可丢弃任意多个前缀元素，不限于先看k+1件。',lambda r:([r.randint(1,9) for _ in range(r.randint(1,10))],r.randint(0,12)),[((list(range(200000,0,-1)),0),seq(range(200000,0,-1))),(([10**9]*200000,1),seq([10**9]*100000)),((list(range(1,200001)),10**9),'200000')],ak,lex_result,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));best=[0]*n;at=n-1
    for i in range(n-1,-1,-1):
        if a[i]>=a[at]:at=i
        best[i]=at
    out=[];i=0
    while i<n:
        j=best[i];out.append(str(a[j]));i=j+k+1
    return ' '.join(out)
''',[('相等时选最晚最大值','a[i]>=a[at]','a[i]>a[at]'),('只看前k加一件','j=best[i]','j=max(range(i,min(n,i+k+1)),key=lambda t:a[t])')],2200050,output='输出结果数组，空格分隔。',outputLimit=4096)
def anagrams(s):
    for length in range(len(s)-1,0,-1):
        words=[s[i:i+length] for i in range(len(s)-length+1)]
        for i,x in enumerate(words):
            for y in words[i+1:]:
                if x!=y and Counter(x)==Counter(y):return length
    return -1
add(252,'内容不同但等频的最长子串对','两个字符串各字符出现次数相同，但字符串内容不能完全相同，称为完美异位词对。求原串两个连续子串组成这种对时的最大长度；允许重叠，按内容相同的两个位置不算，若不存在输出−1。','输入一行字符串。1≤长度≤100000，小写字母。','记录每字符首次及最后位置，以及是否出现在两个不同的连续同字符段。对出现于多个段的字符c，候选为last[c]−first[c]，取最大，无候选返回−1。','若首末c之间不是全c，两窗口s[f:l]与s[f+1:l+1]仅移走和加入一个c，故等频；若内容相同则f..l全部为c，矛盾，得到候选下界。反之任一合法A=s[i:i+L],B=s[j:j+L]且i<j，等频相减得s[i:j]与s[i+L:j+L]等频。令c=s[i]，右块必有c在q≥i+L，因此其全局首末距离≥L。A不可能单色，否则B等频就与A相同；c的首末区间包含A，故该c跨不同段，属于候选。所有合法长度都不超过最大候选，下界达到即最优。','时间O(n)，辅助空间O(26)。',['abcacb','cabcab','aabbcc'],'答案依次4、3、−1。第一例bcac与cacb长度4且重叠，合法。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,12))),[('a'*100000,-1),('a'+'b'*99998+'a',99999),('ab'*50000,99998)],text,anagrams,
'''def solve(d):
    s=d[0];first={};last={};first_run={};last_run={};run=0;previous=None
    for i,c in enumerate(s):
        if c!=previous:run+=1;previous=c
        if c not in first:first[c]=i;first_run[c]=run
        last[c]=i;last_run[c]=run
    answer=max([-1]+[last[c]-first[c] for c in first if first_run[c]!=last_run[c]])
    return str(answer)
''',[('错误接受相同内容','if first_run[c]!=last_run[c]','if True'),('错误禁止子串重叠','return str(answer)','return str(min(answer,len(s)//2))')],100001)
def remove_prefix(a):return next(i for i in range(len(a)+1) if len(set(a[i:]))==len(a)-i)
add(253,'只删最左元素使剩余互异的最少次数','每次只能删除当前最左元素，不能从中间删除。求使剩余数组所有元素互异的最少操作次数；原本互异则0。','第一行n，第二行标识符。原文无数值界，本站1≤n≤200000，1≤标识符≤10^9。','从右向左将值加入集合；首次遇到已见值的位置i，必须删除到它为止，答案i+1；一直无重复则0。','第一次从右遇重复时，i+1..末尾已互异，可以保留。任何起点≤i的后缀都包含a[i]和它后面同值位置，必不合法，所以必须至少删除i+1项。这达到最少次数。','时间O(n)，空间O(n)。',[[1,2,3,2],[1,2,3],[5,5,5]],'答案依次2、0、2。第一例必须删1和第一个2，不能只删中间那个2。',lambda r:[r.randint(1,6) for _ in range(r.randint(1,12))],[([10**9]*200000,199999),(list(range(1,200001)),0),(list(range(1,200000))+[199999],199999)],arr,remove_prefix,
'''def solve(d):
    a=list(map(int,d[1:]));seen=set()
    for i in range(len(a)-1,-1,-1):
        if a[i] in seen:return str(i+1)
        seen.add(a[i])
    return '0'
''',[('误允许任意位置删除',"if a[i] in seen:return str(i+1)","if a[i] in seen:return str(len(a)-len(set(a)))"),('删除数差一',"return str(i+1)","return str(i)")],2200030)
def distinct_cost(x):
    a,c=x;best=10**30
    for order in permutations(range(len(a))):
        pos=0;cost=0
        for i in order:pos=max(pos,a[i]);cost+=(pos-a[i])*c[i];pos+=1
        best=min(best,cost)
    return best
add(254,'增加商品尺寸至互异的最低总费用','每件商品只能增加尺寸，每增加1单位付该商品对应cost。要求最终全部尺寸互异，求最小总费用。所有商品都保留，没有上限限制最终尺寸。','第一行n，第二行size，第三行cost。本页无数值界但原文明确链接同题amazon-get-minimal-cost.md，补充该题完整界：1≤n≤200000，1≤size≤10^9，1≤cost≤10000。','按原尺寸排序扫描可用坐标，堆里放已到达原尺寸的商品，每次优先固定单位成本最高者；堆空时跳到下个原尺寸。','若某坐标可放商品而不放，提前一个未来可放商品只会省费。若当前放低成本而高成本可放者稍后才放，交换两者仍不小于其原尺寸，费用变化为间隔乘低成本减高成本，不增。因此存在每步都与贪心一致的最优分配。','时间O(n log n)，空间O(n)，最终费用用64位。',[([1,1],[1,2]),([2,3,3,2],[2,4,5,1]),([1,10],[10000,1])],'答案依次1、7、0。每单位都收费，不能仅将成本总和减去每件出堆的成本。',lambda r:([r.randint(1,7) for _ in range(n)],[r.randint(1,8) for _ in range(n)]) if (n:=r.randint(1,7)) else None,[(([10**9]*200000,[10000]*200000),199999000000000),(([1,10**9],[10000,10000]),0),(([1]*200000,[1]*200000),19999900000)],two,distinct_cost,
'''def solve(d):
    import heapq
    n=int(d[0]);a=list(map(int,d[1:1+n]));costs=list(map(int,d[1+n:]));items=sorted(zip(a,costs));heap=[];i=0;pos=0;answer=0
    while i<n or heap:
        if not heap:pos=max(pos,items[i][0])
        while i<n and items[i][0]<=pos:
            start,cost=items[i];heapq.heappush(heap,(-cost,start,cost));i+=1
        _,start,cost=heapq.heappop(heap);answer+=(pos-start)*cost;pos+=1
    return str(answer)
''',[('优先固定最低单位成本','(-cost,start,cost)','(cost,start,cost)'),('移动多步只收费一次','answer+=(pos-start)*cost','answer+=cost if pos>start else 0')],3600030)
def subtract(a):
    @lru_cache(None)
    def go(state):
        if not any(state):return 0
        return 1+min(go(tuple(max(0,v-x) for v in state)) for x in range(1,min(v for v in state if v)+1))
    return go(tuple(a))
add(255,'统一减去合法正数的最少归零次数','非负数组每次选择正整数x，不超过当前最小非零元素，从每个正元素减去x，原0保持0。求全部归零的最少次数。','第一行n，第二行数组。1≤n≤100，0≤元素≤100。','统计不同正值的数量，0不计。','一次操作对全部正值同时减同一个量，原来不同的正值之间差不变，最多只能把当前最小的一种正值消成0。因此需要至少不同正值种数次。每次取当前最小正值恰消去一种，达到下界。','时间O(n)，空间O(101)。',[[1,5,0,3,5],[0],[2,2,2]],'答案依次3、0、1。重复相同正值会在同一操作归零。',lambda r:[r.randint(0,12) for _ in range(r.randint(1,10))],[(list(range(1,101)),100),([100]*100,1),([0]*100,0)],arr,subtract,
'''def solve(d):
    a=list(map(int,d[1:]));return str(len({v for v in a if v>0}))
''',[('错误将0也计一种','if v>0','if v>=0'),('正值身份不去重','len({v for v in a if v>0})','sum(v>0 for v in a)')],410)

def main():
    base.main()
    path=base.OUT/'reviews'/f'{base.BATCH}.json';data=json.loads(path.read_text())
    data['items'].extend([dict(id='oa-amazon-238',status='blocked',reason='原文定义substring为0 or more characters且没有样例，空串恒满足长度=aV+bC，但未明确不计空串、每边界计空串或只计一种空串；a,a=b=0三种结果0/2/1，核心计数规则未定。'),dict(id='oa-amazon-251',status='blocked',reason='raw正文真的只剩Giv。第三例说明明确允许替换?后重排，足以否定来源镜像法，但缺少完整操作和字符域定义，不用来源代码擅定完整规则。')])
    slugs=['get-number-redundancy-free','get-operations','get-redundant-substrings','get-special-string','get-stable-periods-count','get-total-requests','group-students','group1-win-count','help-amazon-find-min-time-again','how-many-games-did-the-team-win','inventory-processes-survival-possibility','is-regex-matching','is-special-sequence','kth-smallest-in-subarray','lexicographically-maximal-resulting-array','lexicographically-smallest-palindrome-possible','longest-perfect-anagrams','make-all-elements-distinct','make-array-distinct','make-array-zero-by-subtracting-equal-amounts']
    catalog={v['id']:v for v in json.loads((base.ROOT/'content/oa-master/catalog.json').read_text())['items']}
    for item in data['items']:
        n=int(item['id'].split('-')[-1]);paths=['fastprep/Amazon/amazon-'+slugs[n-236]+'.md']
        if n==245:paths.append('fastprep/Amazon/amazon-group1-win-count.md')
        if n==254:paths.append('fastprep/Amazon/amazon-get-minimal-cost.md')
        item['sourceEvidence']=[]
        for relative in paths:
            raw=(Path('/tmp/cswork-oa-source-20260919')/relative).read_bytes()
            item['sourceEvidence'].append(dict(commit='e66f809f4c953bce129f68491726176615db6afc',path=relative,gitBlobSha1=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=catalog[item['id']]['contentHash']))
    data['items'].sort(key=lambda v:int(v['id'].split('-')[-1]));path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
