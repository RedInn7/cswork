"""Original Amazon277–295 authoring; 289/291 held for unresolved rules/budget.
Large edge fixtures are lazy, never all allocated at generator import time.
"""
from collections import Counter
from functools import lru_cache
from itertools import combinations, permutations, product
from pathlib import Path
import hashlib,json
import amazon_remaining_h as base
base.SPECS=[];base.BATCH='amazon-remaining-n';base.SEED=20262760
add=base.add;arr=base.arr
def seq(a):return ' '.join(map(str,a))
def ak(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def two(x):return str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n'

def products_oracle(a):
    best=0
    def visit(i,previous,total):
        nonlocal best
        best=max(best,total)
        if i==len(a):return
        for chosen in range(previous+1,a[i]+1):visit(i+1,chosen,total+chosen)
    for start in range(len(a)):visit(start,0,0)
    return best
def products_edges():
    yield [10**9]*5000,5000*10**9-4999*5000//2
    yield list(range(1,5001)),5000*5001//2
    yield [1]*5000,1
add(277,'连续货架严格递增取货的最大件数','选一个非空连续子数组，从每个选中货架取至少一件、不超过其库存，取件数从左向右严格递增；求总件数最大值。不能跳过所选子数组中间货架。','第一行n，第二行products。1≤n≤5000，1≤products[i]≤10^9。此完整范围来自raw正文Constraints，而非被HTML截断的整理版。','令b[i]=products[i]−i，维护b严格递增的下标栈。弹掉≥当前b的下标；若剩栈顶j，则dp[i]=dp[j]+从products[i]−(i−j)+1到products[i]的等差和；无j时只取最后min(i+1,products[i])个正数。答案max(dp)。','固定末尾取其全部库存总不劣，向左最优取量为j+区间b的最小值。最近的较小b位置j之前不受新末尾影响，j+1..i全部由当前b限制且是正递增等差段；其首值严格大于products[j]，可与dp[j]拼接。若没有较小b，整段被当前b限制，只保留正值后缀。因此递推恰算每个右端的最佳方案，取最大覆盖全部子数组。','时间O(n)，空间O(n)，总件数用64位。',[[2,9,4,7,5,3],[7,5,3],[1,1,1]],'答案依次16、9、1。第二例可只选前两个货架取4和5，得9；取整个三货架只能1+2+3=6。',lambda r:[r.randint(1,7) for _ in range(r.randint(1,8))],products_edges(),arr,products_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));stack=[];dp=[]
    for i,v in enumerate(a):
        while stack and a[stack[-1]]-stack[-1]>=v-i:stack.pop()
        if stack:j=stack[-1];length=i-j;previous=dp[j]
        else:length=min(i+1,v);previous=0
        dp.append(previous+length*(2*v-length+1)//2);stack.append(i)
    return str(max(dp))
''',[('严格递增错误按不减','a[stack[-1]]-stack[-1]>=v-i','a[stack[-1]]>=v'),('错误全数组库存求和','return str(max(dp))','return str(sum(a))')],55020)

def racers_oracle(x):
    a,k=x;best=0
    for mask in range(1<<len(a)):
        if mask.bit_count()>k:continue
        remaining=[v for i,v in enumerate(a) if not mask>>i&1];run=0;previous=None
        for v in remaining:
            run=run+1 if v==previous else 1;previous=v;best=max(best,run)
    return best
def racers_edges():
    yield ([10**9]*200000,0),200000
    yield ([1,2]*100000,99999),100000
    yield (range(1,200001),200000),1
add(278,'删至多k名选手后的最长同速连续队伍','删除至多k名选手，其他选手保持原相对次序；求剩余队伍中某个连续同速段最多有多少人。输出留在该段的人数，不包含被删除者。','第一行n k，第二行speed。原文无数值界，本站1≤n≤200000，0≤k≤n，1≤speed[i]≤10^9。原文0到n的索引笔误按n项统一为0..n−1。','每个速度单独收集出现位置p。在位置数组上双指针，保证p[r]−p[l]−(r−l)≤k，更新同速人数r−l+1。','把p[l]..p[r]之间不同速的人全部删除，费用恰为原长度减同速人数。保留更多该速度者不会增加删除费，故每个最优段对应某个连续出现位置窗口。该费用随右扩不减、左缩不增，双指针枚举每个右端最早合法左端，获得最大人数。','时间O(n)，空间O(n)。',[([1,2,1,2,1],1),([3,3,4,3],0),([1,2,3],3)],'答案依次2、2、1。第一例只删除一个2还不能把三个1连起来。',lambda r:([r.randint(1,4) for _ in range(n)],r.randint(0,n)) if (n:=r.randint(1,10)) else None,racers_edges(),ak,racers_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));positions={}
    for i,v in enumerate(a):positions.setdefault(v,[]).append(i)
    answer=0
    for p in positions.values():
        left=0
        for right in range(len(p)):
            while p[right]-p[left]-(right-left)>k:left+=1
            answer=max(answer,right-left+1)
    return str(answer)
''',[('误把删除前窗口长度当人数','answer=max(answer,right-left+1)','answer=max(answer,p[right]-p[left]+1)'),('错误少用一次删除预算','>k:', '>max(0,k-1):')],2200040)

def quality_oracle(x):
    a,k=x;groups=[];best=0
    def visit(i):
        nonlocal best
        if i==len(a):
            if len(groups)!=k:return
            total=0
            for group in groups:
                b=sorted(group);m=len(b);total+=2*b[m//2] if m%2 else b[m//2-1]+b[m//2]
            best=max(best,total);return
        for group in groups:group.append(a[i]);visit(i+1);group.pop()
        if len(groups)<k:groups.append([a[i]]);visit(i+1);groups.pop()
    visit(0);return (best+1)//2
def quality_edges():
    yield ([10**9]*500000,500000),500000000000000
    yield ([1]*250000+[10**9]*250000,1),500000001
    yield (range(1,500001),2),750000
add(279,'所有数据包分频道后的最大中位数质量和','所有数据包都必须分给恰好channels个非空频道，可任意分组，不要求原序连续。每频道质量为包大小中位数；偶数个取中间两项平均。最大化质量总和，最后统一向上取整为整数。','第一行n channels，第二行packets。1≤n≤500000，1≤packets[i]≤10^9，1≤channels≤n。','排序后把最大的channels−1项各放独立频道，其余放最后一个频道。对所有质量乘2求和，最后以(sum2+1)//2向上取整，避免浮点数。','对任意两组，设合并后的最大值为M，其余元素中位数为q，则两组原中位数之和不超过M+q：按两组中位位置计数，移走M后至少一半剩余数不小于两中位数和减M，偶数情形对两中值取平均同样成立。因此可将M独立、其余合组而不降低总质量。反复对包含当前最大值的频道和另一个非独立频道交换，得到最大channels−1项各自独立的最优形式。直接求剩余中位数即最优，最后统一取整保持目标顺序。','时间O(n log n)，空间O(n)，两倍质量和用64位。',[([1,2,3,4,5],2),([2,2,1,5,3],2),([89,48,14],3)],'答案依次8、7、151。第一例5独立，剩下1,2,3,4中位数2.5，总7.5上取整8。',lambda r:([r.randint(1,15) for _ in range(n)],r.randint(1,n)) if (n:=r.randint(1,8)) else None,quality_edges(),ak,quality_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));remaining=n-k+1;middle=remaining//2;twice=2*sum(a[remaining:])
    twice+=2*a[middle] if remaining%2 else a[middle-1]+a[middle]
    return str((twice+1)//2)
''',[('错误向下取整','(twice+1)//2','twice//2'),('误把最小若干包独立','a=sorted(map(int,d[2:]))','a=sorted(map(int,d[2:]),reverse=True)')],5500040,time=8)

def word_oracle(x):
    s,t=x;target=sorted(t)
    @lru_cache(None)
    def visit(word):
        best=0
        for ids in combinations(range(len(word)),len(t)):
            if sorted(word[i] for i in ids)!=target:continue
            removed=set(ids);nxt=''.join(c for i,c in enumerate(word) if i not in removed);best=max(best,1+visit(nxt))
        return best
    return visit(s)
def word_edges():
    yield ('a'*200000,'a'),200000
    yield ('ab'*100000,'aab'),50000
    yield ('a'*200000,'b'*200000),0
add(280,'可重排取走目标单词的最多次数','每次从s中选择任意若干字符，重排后必须恰好等于目标t，然后删去这些字符；其余字符保留。求最多可取走多少个目标单词。不是连续子串，也不要求原顺序形成t。','两行分别为s、t。原文只明确小写字母，本站1≤|s|,|t|≤200000，目标非空。','分别计数s和t的字符，答案为t中出现的每种字符可供应次数countS//countT的最小值。','取q次必须对每种目标字母提供q倍需求，故各频数比都是上界。若q不超过所有上界，则每种字母都有足够身份可分给q个副本，任意重排允许独立组成目标，因此最小上界恰可达到。','时间O(|s|+|t|)，辅助空间O(26)。',[('abacbc','bca'),('abdadccacd','edac'),('aaaaab','aa')],'答案依次2、0、2。第三例目标每次消耗两个a，只能取两次。',lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,10))),''.join(r.choice('abc') for _ in range(r.randint(1,4)))),word_edges(),lambda x:x[0]+'\n'+x[1]+'\n',word_oracle,
'''def solve(d):
    from collections import Counter
    have=Counter(d[0]);need=Counter(d[1]);return str(min(have[c]//amount for c,amount in need.items()))
''',[('目标重复字符误只用一次','have[c]//amount','have[c]'),('错误取最大可供应次数','str(min(','str(max(')],400002)

def traffic_oracle(x):
    login,logout=x;values=[sum(a<=day<=b for a,b in zip(login,logout)) for day in range(min(login),max(logout)+1)];return values.count(max(values))
def traffic_random(r):
    a=[r.randint(0,15) for _ in range(r.randint(1,12))];return a,[r.randint(v,20) for v in a]
def traffic_edges():
    yield ([0]*100000,[100000]*100000),100001
    yield (range(100000),range(100000)),100000
    yield ([100000]*100000,[100000]*100000),1
add(281,'达到最大在线人数的日期总数','用户i从login[i]到logout[i]每天都在线，两端包含，同日先登录再退出。求有多少个日期的在线人数等于全局最高在线人数；不是返回人数本身。','第一行n，第二行login，第三行logout。1≤n≤100000，0≤login[i]≤logout[i]≤100000。','在login处差分加1、logout+1处减1，扫描0..100000，更新最大人数及达到它的日期计数。','差分前缀和恰计入已开始但未经过退出后一日的用户，即两端包含区间覆盖数。遇更高人数重置天数为1，遇同峰值增加1，较低者忽略，最终不重不漏计所有峰值日。','时间O(n+100001)，空间O(100002)。',[([1,2,7],[3,4,7]),([0],[0]),([1,3],[1,3])],'答案依次2、1、2。第一例日期2和3都有两人在线，第三例两个不相邻日期都达到峰值1。',traffic_random,traffic_edges(),two,traffic_oracle,
'''def solve(d):
    n=int(d[0]);login=list(map(int,d[1:n+1]));logout=list(map(int,d[n+1:]));delta=[0]*100002
    for a,b in zip(login,logout):delta[a]+=1;delta[b+1]-=1
    current=best=count=0
    for day in range(100001):
        current+=delta[day]
        if current>best:best=current;count=1
        elif current==best:count+=1
    return str(count)
''',[('退出日错误不包含','delta[b+1]-=1','delta[b]-=1'),('错误返回最高人数','return str(count)','return str(best)')],1400030)

def interval_components(intervals):
    n=len(intervals);seen=set();groups=[]
    for root in range(n):
        if root in seen:continue
        todo=[root];seen.add(root);members=[]
        while todo:
            i=todo.pop();members.append(i);a,b=intervals[i]
            for j,(c,d) in enumerate(intervals):
                if j not in seen and max(a,c)<=min(b,d):seen.add(j);todo.append(j)
        groups.append((min(intervals[i][0] for i in members),max(intervals[i][1] for i in members)))
    return sorted(groups)
def merge_oracle(iv):
    out=interval_components(iv);return str(len(out))+'\n'+''.join(f'{a} {b}\n' for a,b in out).rstrip()
def intervals_random(r):
    return [(a,r.randint(a,15)) for a in [r.randint(-10,10) for _ in range(r.randint(1,9))]]
def merge_edges():
    yield [(i,i+1) for i in range(200000)],'1\n0 200000'
    yield [(2*i,2*i) for i in range(200000)],'200000\n'+''.join(f'{2*i} {2*i}\n' for i in range(200000)).rstrip()
    yield [(-10**9,10**9)]*200000,'1\n-1000000000 1000000000'
add(282,'合并所有相交闭区间','给若干闭区间[start,end]，合并所有互相重叠或经重叠链相连的区间，返回按起点递增且互不重叠的覆盖区间。共用端点也视为重叠。','第一行n，随后n行各start end。raw约束自身截断于1<，本站明确1≤n≤200000，−10^9≤start≤end≤10^9。','按起点排序；若下一个起点≤当前结束，则把当前结束扩为两者最大，否则输出当前并新开一个区间。','当前区间表示已扫描最后一个连通块的精确覆盖范围。下一区间若起点不超过其结束，确实相交，应并入；否则按排序后续区间也不可能回接该块，所以可安全封口。归纳给出全部且仅有的最大重叠连通块。','时间O(n log n)，空间O(n)。',[[(1,3),(2,6),(8,10),(15,18)],[(1,4),(4,5)],[(2,2),(3,4)]],'结果依次3段[1,6],[8,10],[15,18]；1段[1,5]；2段[2,2],[3,4]。整数相邻不是相交。',intervals_random,merge_edges(),lambda x:str(len(x))+'\n'+''.join(f'{a} {b}\n' for a,b in x),merge_oracle,
'''def solve(d):
    values=list(map(int,d[1:]));intervals=sorted(zip(values[::2],values[1::2]));out=[]
    for a,b in intervals:
        if out and a<=out[-1][1]:out[-1][1]=max(out[-1][1],b)
        else:out.append([a,b])
    return str(len(out))+'\\n'+'\\n'.join(str(a)+' '+str(b) for a,b in out)
''',[('端点相等错误不合并','a<=out[-1][1]','a<out[-1][1]'),('错误把整数相邻也合并','a<=out[-1][1]','a<=out[-1][1]+1')],4800030,output='第一行合并后区间数m，随后m行每行start end，按起点递增。',outputLimit=8192)

def password_oracle(x):
    pwd,target,cost=x;target=sorted(target);best=10**30
    for mask in range(1<<len(pwd)):
        remaining=sorted(c for i,c in enumerate(pwd) if not mask>>i&1);at=0
        for c in remaining:
            if at<len(target) and c==target[at]:at+=1
        if at<len(target):best=min(best,sum(cost[ord(c)-97] for i,c in enumerate(pwd) if mask>>i&1))
    return best
def password_random(r):return ''.join(r.choice('abcd') for _ in range(r.randint(1,10))),''.join(r.choice('abcd') for _ in range(r.randint(1,5))),[r.randint(0,9) for _ in range(26)]
def password_edges():
    yield ('a'*100000,'a',[10**9]*26),100000000000000
    yield ('a'*100000,'a'*100000,[10**9]*26),10**9
    yield ('z'*100000,'a'*100000,[0]*26),0
add(283,'删字符使任何重排都无法包含目标的最低费用','删除密码的若干字符，删除字母a..z的单次费用由26项cost给出。要求剩余密码的任何排列都不能含target作为子序列，最小化费用。不是仅禁止原顺序出现，也不要求删光一种字母。','第一行pwd，第二行target，第三行恰26项cost。原文两串长度1..100000、小写、cost≥0；cost上界原写10°且注明未确认，本站补充0≤cost[i]≤10^9。正文26项明确修正损坏下标251。','计数两串。对每个目标字母c，删掉max(0,countPwd[c]−countTarget[c]+1)个就能让它不足；取各字母所需费用的最小值。','任意重排可包含目标，当且仅当每个目标字母数量都足够。要破坏这一条件，至少一种字母必须少于需求，针对它必须删指定次数；因此每个合法方案费用不低于某一候选。只删最低候选对应字母即足以使目标永远无法形成，达到下界。','时间O(|pwd|+|target|+26)，辅助空间O(26)，费用64位。',[('abcdcbcb','bcb',[2,3,1,4]+[0]*22),('kkkk','k',[5]*26),('adefgh','hf',[1,0,0,2,4,4,3,1]+[0]*18)],'答案依次3、20、1。第一例删三个c各1比删两个b各3便宜；来源费用数组多出的零按正式26项纠正。第二例原说明误称5个k，实际4个各5，总20。',password_random,password_edges(),lambda x:x[0]+'\n'+x[1]+'\n'+seq(x[2])+'\n',password_oracle,
'''def solve(d):
    from collections import Counter
    pwd=Counter(d[0]);target=Counter(d[1]);cost=list(map(int,d[2:]));return str(min(max(0,pwd[c]-amount+1)*cost[ord(c)-97] for c,amount in target.items()))
''',[('错误必须删光选中字母','max(0,pwd[c]-amount+1)','pwd[c]'),('不足判定错误允许保留恰好需求','pwd[c]-amount+1','pwd[c]-amount')],200300)

def parcels_oracle(a):
    @lru_cache(None)
    def visit(state):
        positive=[v for v in state if v]
        if not positive:return 0
        return 1+min(visit(tuple(v-x if v else 0 for v in state)) for x in range(1,min(positive)+1))
    return visit(tuple(a))
def parcels_edges():
    yield range(999000001,1000000001),1000000
    yield [0]*1000000,0
    yield [10**9]*1000000,1
add(284,'所有非空中心每日同量送货的最少天数','每天选择一个正整数x，从每个还有包裹的中心都送出恰好x件；不能超过任何非空中心当前剩余数量，空中心不参与。求把全部包裹送完的最少天数。原本全部为0则0天。','第一行n，第二行parcels。1≤n≤1000000，0≤parcels[i]≤10^9，保留原始百万范围。','答案为不同正库存值的数量；逐token转整数加入集合，不另外保留完整整数数组。','每次所有正值同减x，原有不同正值之间的差保持不变，最多只有当前最小的一种正值能变0，故至少不同正值种数天。每次恰减当前最小正值会消掉一种，达到下界。零值无须送货。','时间O(n)，空间O(不同正值数)，不额外复制完整整数数组。',[[2,3,4,3,3],[3,3,3],[0,0]],'答案依次3、1、0。第一例可依次从各非空中心送2、1、1件。',lambda r:[r.randint(0,9) for _ in range(r.randint(1,8))],parcels_edges(),arr,parcels_oracle,
'''def solve(d):
    positive=set()
    for i in range(1,len(d)):
        value=int(d[i])
        if value:positive.add(value)
    return str(len(positive))
''',[('零库存也计一天','if value:positive.add(value)','positive.add(value)'),('同量不同中心错误分别计天','return str(len(positive))','return str(sum(int(v)>0 for v in d[1:]))')],11000020,time=8)

def zones_encode(x):
    iv,k=x;return f'{len(iv)} {k}\n'+''.join(f'{a} {b}\n' for a,b in iv)
def zones_oracle(x):
    iv,k=x;best=len(iv)
    for start in range(1,max(b for a,b in iv)+1):
        for length in range(k+1):best=min(best,len(interval_components(iv+[(start,start+length)])))
    return best
def zones_random(r):
    starts=[r.randint(1,12) for _ in range(r.randint(1,7))];return [(a,r.randint(a,15)) for a in starts],r.randint(1,5)
def zones_edges():
    yield ([(2*i+1,2*i+1) for i in range(100000)],10**9),1
    yield ([(2*i+1,2*i+1) for i in range(100000)],1),100000
    yield ([(1,10**9)]*100000,1),1
add(285,'加一条限长配送区后的最少连通块','已有闭区间配送区，可重叠。必须新加恰一条闭区间[a,b]，长度定义为b−a，允许为0且不超过k。区间仅在有共同点时相连，不把整数相邻当作相连。求加入后最少连通块数。原文明确[2,2]与[3,4]不相连，据此恢复连续区间语义。','第一行n k，随后n行各a[i] b[i]。1≤n≤100000，1≤a[i]≤b[i]≤10^9，1≤k≤10^9。','先合并已有相交区间，得到m个分离块。双指针找最多连续块l..r满足L[r]−R[l]≤k，答案m−(r−l)。','连接块l至r至少需要跨过R[l]到L[r]这段距离，且直接加该段就连接全部中间块，所以条件充分必要。可连接块必在排序中连续，故双指针枚举全部最佳跨度。连接q块后它们变一块，数量减少q−1；如果只能覆盖原一块，仍可添加其内零长段而不增加块数。','时间O(n log n)，空间O(n)。',[([(1,5),(2,4),(6,6),(7,14),(16,19)],2),([(1,2),(2,4),(5,8),(10,11)],2),([(1,1),(3,3),(5,5)],4)],'答案依次2、2、1。第三例一条[1,5]同时连三个块，不是每次最多连两个。',zones_random,zones_edges(),zones_encode,zones_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);values=list(map(int,d[2:]));merged=[]
    for a,b in sorted(zip(values[::2],values[1::2])):
        if merged and a<=merged[-1][1]:merged[-1][1]=max(merged[-1][1],b)
        else:merged.append([a,b])
    left=0;answer=len(merged)
    for right in range(len(merged)):
        while merged[right][0]-merged[left][1]>k:left+=1
        answer=min(answer,len(merged)-(right-left))
    return str(answer)
''',[('错误只准连接两个块','len(merged)-(right-left)','len(merged)-min(1,right-left)'),('间隔错误减一','merged[right][0]-merged[left][1]>k','merged[right][0]-merged[left][1]-1>k')],2200050)

def errors_oracle(x):
    word,c01,c10=x;ids=[i for i,c in enumerate(word) if c=='!'];best=None
    for replacements in product('01',repeat=len(ids)):
        a=list(word)
        for i,c in zip(ids,replacements):a[i]=c
        total=0
        for i in range(len(a)):
            for j in range(i+1,len(a)):
                if a[i]=='0' and a[j]=='1':total+=c01
                if a[i]=='1' and a[j]=='0':total+=c10
        best=total if best is None else min(best,total)
    return best%1000000007
def errors_edges():
    yield ('0'*50000+'1'*50000,10**9,10**9),(2500000000*10**9)%1000000007
    yield ('1'*50000+'0'*50000,10**9,0),0
    yield ('!'*100000,0,10**9),0
add(286,'替换感叹号后的最少有序二元错误','把每个!替换为0或1。每对下标i<j中，01贡献x、10贡献y；不只看相邻字符。先最小化完整错误总量，最后对1000000007取模。本页只留散文，本站以同快照amazon-get-min-errors.md的同题同例101!1恢复正式子序列与模数规则，并绑定两份raw证据。','第一行errorString，第二行x y。主raw未给数值界，补充raw明确长度1..100000、成本0..100000；本站完整涵盖并扩展成本为0≤x,y≤10^9。字符串只含0、1、!。补充raw的字符l排版笔误由正文和所有样例恢复为!。','反转串并交换x/y可使x≤y。此时存在最优解使通配符先0后1。初始!全1，扫描依次改0，以左右0/1数量计算每次完整代价增量，取全部分界最小，最后取模。','x≤y时，把两个通配符的逆序1、0交换为0、1，区间外成对贡献总量不变；这两位及其间每位的变化都是x−y的非负倍数，所以总代价不增。反复交换得到单分界形式。某位1改0的变化为左1*y−左0*x+右1*x−右0*y，计入且仅计入涉及它的所有对。扫描涵盖全部单分界，因此得到全局最优而非局部最优。','时间O(n)，空间O(n)，先以64位完整比较代价再取模。',[('101!1',2,3),('!1',1,1),('1!0',4,0)],'答案依次9、0、0。第二例应选11，不能只看前缀而把第一位贪心设0。第三例10成本为0，合法。',lambda r:(''.join(r.choice('01!') for _ in range(r.randint(1,10))),r.randint(0,8),r.randint(0,8)),errors_edges(),lambda x:x[0]+'\n'+f'{x[1]} {x[2]}\n',errors_oracle,
'''def solve(d):
    s=d[0];x,y=map(int,d[1:])
    if x>y:s=s[::-1];x,y=y,x
    filled=s.replace('!','1');zero=one=cost=0
    for c in filled:
        if c=='0':cost+=one*y;zero+=1
        else:cost+=zero*x;one+=1
    right0=zero;right1=one;left0=left1=0;best=cost
    for original,c in zip(s,filled):
        if c=='0':right0-=1
        else:right1-=1
        if original=='!':cost+=left1*y-left0*x+right1*x-right0*y;c='0';best=min(best,cost)
        if c=='0':left0+=1
        else:left1+=1
    return str(best%1000000007)
''',[('仅看左边错误忽略右边增量','+right1*x-right0*y',''),('遗漏全1以外的通配分界','best=min(best,cost)','best=best')],100040)

def shipping_oracle(a):
    @lru_cache(None)
    def visit(mask):
        if not mask:return 0
        i=(mask&-mask).bit_length()-1;best=1+visit(mask^(1<<i))
        for j in range(i+1,len(a)):
            if mask>>j&1 and a[j]!=a[i]:best=min(best,1+visit(mask^(1<<i)^(1<<j)))
        return best
    return visit((1<<len(a))-1)
def shipping_edges():
    yield [10**9]*100000,100000
    yield range(1,100001),50000
    yield [1]*50001+[2]*49999,50001
add(287,'异地点可两件同运的最少操作','每次任选一件运走，或任选两件且地点不同，一起运走。两件不要求相邻；余下物品保留相对顺序，但不限制下一次任意选择。求运完全部物品的最少操作数。','第一行n，第二行locations。原文长度在正文写n、约束及starter写m，统一为n：1≤n≤100000，1≤locations[i]≤10^9。','记最高地点频率f，答案max(f,ceil(n/2))。','每次最多两件，至少ceil(n/2)次；同一地点每次最多一件，至少f次。若f超过其他总量，就让该地点逐一与其他地点配对，剩余单运，恰f次。否则总能从当前两个最多地点配对，直到余0或1件；最高频不超过其余数量加1的不变式保证能达到ceil(n/2)次。','时间O(n)，空间O(不同地点数)。',[[1,1,1,2],[1,2,3],[5,5]],'答案依次3、2、2。第一例只有一个2可与一个1配，其余两个1必须单独运。',lambda r:[r.randint(1,5) for _ in range(r.randint(1,10))],shipping_edges(),arr,shipping_oracle,
'''def solve(d):
    from collections import Counter
    a=list(map(int,d[1:]));f=max(Counter(a).values());return str(max(f,(len(a)+1)//2))
''',[('不管地点都两两打包','max(f,(len(a)+1)//2)','(len(a)+1)//2'),('错误返回地点种数','return str(max(f,(len(a)+1)//2))','return str(len(set(a)))')],1100030)

def scans_oracle(a):
    next_value=1;rounds=0
    while next_value<=len(a):
        rounds+=1
        for v in a:
            if v==next_value:next_value+=1
    return rounds
def scans_edges():
    yield range(1,200001),1
    yield range(200000,0,-1),200000
    yield list(range(2,200001,2))+list(range(1,200000,2)),100001
add(288,'重复从左到右收集递增编号的最少扫描轮数','输入1..n的排列。起初下一个要收编号为1，每轮从头到尾扫描，遇下一个编号就收走并将目标加1，其他跳过。求收完1..n需要几轮。依据原文明确公式sortingSequence[i]==arrangedCount+1恢复真正操作，不把引言误读成另一个目标排列。','第一行n，第二行sortingSequence。原文无数值界，本站1≤n≤200000，保证为1..n的排列。','建立每个编号的原位置pos，答案1加上所有pos[v+1]<pos[v]的次数。','收走v时扫描位于pos[v]。若pos[v+1]更右，可在本轮继续收；若更左，本轮已经错过它，必须恰再开一轮。这些必要换轮依次执行也足够，因此计数精确。','时间O(n)，空间O(n)。',[[2,4,1,3],[1,2,3],[3,2,1]],'答案依次3、1、3。第一例三轮分别收1，2和3，4。不能直接数数组相邻下降点。',lambda r:r.sample(range(1,n+1),n) if (n:=r.randint(1,12)) else None,scans_edges(),arr,scans_oracle,
'''def solve(d):
    n=int(d[0]);a=list(map(int,d[1:]));position=[0]*(n+1)
    for i,v in enumerate(a):position[v]=i
    return str(1+sum(position[v+1]<position[v] for v in range(1,n)))
''',[('误数相邻数值下降','sum(position[v+1]<position[v] for v in range(1,n))','sum(a[i+1]<a[i] for i in range(n-1))'),('遗漏首轮','str(1+sum(','str(sum(')],1400030)

def heaviest_oracle(a):
    total=sum(a);best=None;out=None
    for mask in range(1,1<<len(a)):
        chosen=sorted(a[i] for i in range(len(a)) if mask>>i&1);score=sum(chosen)
        if 2*score<=total:continue
        key=(len(chosen),-score)
        if best is None or key<best:best=key;out=chosen
    return seq(out)
def heaviest_edges():
    yield [10000]*100000,seq([10000]*50001)
    yield [1]*100000,seq([1]*50001)
    yield [1]*99999+[10000],seq([1]*45000+[10000])
add(290,'数量最少且重量最大的严格较重物品集','把全部物品按身份分成A和B，每件恰属一组，重量相同的不同物品仍独立。要求sum(A)>sum(B)，先最小化A件数，再在最少件数中最大化A总重量，输出A的重量升序序列。B允许空。','第一行n，第二行重量。1≤n≤100000，1≤arr[i]≤10000。','重量降序依次选取，直到已选重量严格超过未选重量；将选出的前缀反转输出升序。','固定件数q时最大可能总重量就是最大的q件。若这个上界仍不超过其余重量，任何q件方案都不合法；第一次严格超过时q最少，同时该前缀又达到该q的最大总重量，满足第二目标。输出升序只改变展示顺序。','时间O(n log n)，空间O(n)。',[[5,3,2,4,1,2],[4,2,5,1,6],[2,2]],'答案依次4 5、5 6、2 2。第三例选一件仅打平，必须两件都进入A。',lambda r:[r.randint(1,15) for _ in range(r.randint(1,11))],heaviest_edges(),arr,heaviest_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]),reverse=True);total=sum(a);picked=[];weight=0
    for v in a:
        picked.append(v);weight+=v
        if weight>total-weight:break
    return ' '.join(map(str,picked[::-1]))
''',[('错误允许两组重量相等','weight>total-weight','weight>=total-weight'),('错误从最轻物品开始选','reverse=True','reverse=False')],600030,output='输出A的物品重量，升序、空格分隔；重复重量按物品数量重复输出。',outputLimit=2048)

def effort_oracle(a):
    @lru_cache(None)
    def visit(state):
        best=sum(state)
        for i,v in enumerate(state):
            for w in state:
                if v>w and v%w==0:best=min(best,visit(state[:i]+(w,)+state[i+1:]))
        return best
    return visit(tuple(a))
def effort_edges():
    yield [200000]*200000,40000000000
    yield range(1,200001),200000
    yield [2]*100000+[200000]*100000,400000
add(292,'以现有整除值替换后的最小总工作量','每次选两个位置i、j，若当前effort[i]能被当前effort[j]整除，就把effort[i]改为effort[j]，可做任意次也可不做。目标最小化最终数组和。操作不是把i除以j，而是直接替换成j当前值。','第一行n，第二行effort。1≤n≤200000，1≤effort[i]≤200000。','记录出现频次。按d从小到大枚举原数组出现过的数，对其各倍数中尚未赋最小除数者标记为d；最后把每个原值的频次乘它的最小存在除数求和。','复制操作不产生任何原数组未有的新值；整除具有传递性，所以一个原值最后只能变成原数组中整除它的某值，最小者给出下界。每个这样的最小除数本身不存在更小的原数组除数，否则也整除原值，与最小性矛盾。因此可以保留这些支点，把其他元素直接替换到其最小除数，同时达到每项下界。','时间O(n+V log V)，空间O(V)，V=最大值≤200000，和用64位。',[[3,6,2,5,25],[6,10,15],[2,4,8]],'答案依次17、31、6。第二例没有任何一项能被其他更小原值整除，不能擅自变成公共因数1。',lambda r:[r.randint(1,20) for _ in range(r.randint(1,7))],effort_edges(),arr,effort_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));limit=max(a);count=[0]*(limit+1)
    for v in a:count[v]+=1
    smallest=[0]*(limit+1)
    for divisor in range(1,limit+1):
        if count[divisor]:
            for multiple in range(divisor,limit+1,divisor):
                if not smallest[multiple]:smallest[multiple]=divisor
    return str(sum(count[v]*smallest[v] for v in range(1,limit+1)))
''',[('错误让所有元素变为数组最小值','return str(sum(count[v]*smallest[v] for v in range(1,limit+1)))','return str(len(a)*min(a))'),('错误只减一次不使用合法替换','count[v]*smallest[v]','count[v]*v')],1400030,time=8)

def difference_oracle(x):
    a,b=x;return min(sum(abs(v-w) for v,w in zip(a,p)) for p in permutations(b))
def difference_edges():
    yield ([-10**9]*100000,[10**9]*100000),200000000000000
    yield (range(1,100001),range(100000,0,-1)),0
    yield ([0]*100000,[0]*100000),0
add(293,'两个数组一对一配对的最小绝对差和','两个等长数组的元素各使用一次组成n对；不允许同一b位置被不同a位置重复匹配，重复数值的不同位置仍各算一个元素。最小化每对数值差绝对值的总和。','第一行n，第二行a，第三行b。主raw约束明确Unknown；本站补充1≤n≤100000，−10^9≤a[i],b[i]≤10^9。该范围不伪称来源原界。','分别升序排序，两数组同序配对后累加绝对差。','若x≤y且u≤v，则|x−u|+|y−v|≤|x−v|+|y−u|。因此任何交叉配对都可交换为不交叉而费用不增。反复消除交叉得到排序同序配对，恰是算法构造，所以最优。','时间O(n log n)，空间O(n)，总费用最多2×10^14须64位。',[([1,10],[9,2]),([-5,2],[4,-3]),([3,3],[3,3])],'答案依次2、4、0。第二例−5配−3、2配4，每对差2。',lambda r:([r.randint(-10,10) for _ in range(n)],[r.randint(-10,10) for _ in range(n)]) if (n:=r.randint(1,7)) else None,difference_edges(),two,difference_oracle,
'''def solve(d):
    n=int(d[0]);a=sorted(map(int,d[1:n+1]));b=sorted(map(int,d[n+1:]));return str(sum(abs(x-y) for x,y in zip(a,b)))
''',[('错误一组反序匹配','b=sorted(map(int,d[n+1:]))','b=sorted(map(int,d[n+1:]),reverse=True)'),('错误不取绝对值','abs(x-y)','x-y')],2400030)

def fortune_oracle(x):
    a,b,m=x;best=10**30
    for mask in range(1<<len(a)):
        if mask.bit_count()<=m:
            chosen=[b[i] if mask>>i&1 else a[i] for i in range(len(a))];best=min(best,max(chosen)-min(chosen))
    return best
def fortune_random(r):
    n=r.randint(1,10);return [r.randint(1,20) for _ in range(n)],[r.randint(1,20) for _ in range(n)],r.randint(1,n)
def fortune_edges():
    yield ([1]*100000+[10**7]*100000,[1]*200000,100000),0
    yield ([1]*100000+[10**7]*100000,[1]*200000,99999),9999999
    yield (range(1,200001),range(1,200001),200000),199999
add(294,'最多翻m张卡后的最小正面数值范围','n张卡初始显示A[i]，最多翻m张，各翻后显示对应B[i]；每张卡都必须保留并显示一面。求最后最大显示值减最小显示值的最小值。允许少于m次或不翻。','第一行n m，第二行A，第三行B。raw仅给1≤m≤n、数值上界字面107且未给n界；本站明确1≤n≤200000，1≤A[i],B[i]≤10000000，覆盖107与10^7两种排版解释。','把每张卡的正反面作为两条带卡号和面标记的事件，按值排序滑窗。窗口需覆盖每张卡至少一面，且窗口内正面数量≥n−m；在有效时缩左端，更新最小值域宽度。','给定值域，每卡无一面在内则必不可行。若正面在内就可不翻，否则必须且只需翻到在内的反面，所以最少翻面数等于n减区间内正面数。两个条件因此充要。排序事件窗口覆盖的卡面是某个值域可用卡面的子集；满足条件便给出该宽度可行解，而任何最优值域包含的完整连续事件窗都会被扫描支配，故双指针取到最小宽度。同值事件身份不合并。','时间O(n log n)，空间O(n)。',[([1,2,17,16,9],[3,4,5,6,11],2),([1,10],[5,5],1),([7],[100],1)],'答案依次8、4、0。第二例只翻10成5，留下1和5，范围4；不能翻两张得到0。',fortune_random,fortune_edges(),lambda x:f'{len(x[0])} {x[2]}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',fortune_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:n+2]));b=list(map(int,d[n+2:]));events=sorted([(v,i,1) for i,v in enumerate(a)]+[(v,i,2) for i,v in enumerate(b)]);mask=bytearray(n);covered=front=left=0;answer=max(a)-min(a)
    for right,(value,i,side) in enumerate(events):
        covered+=mask[i]==0;mask[i]|=side;front+=side==1
        while covered==n and front>=n-m:
            answer=min(answer,value-events[left][0]);_,j,old=events[left];mask[j]^=old;covered-=mask[j]==0;front-=old==1;left+=1
    return str(answer)
''',[('错误不限翻面次数','front>=n-m','front>=0'),('错误要求所有卡正面都在窗内','front>=n-m','front>=n')],3600050,time=8)

def warehouse_oracle(a):
    average=sum(a)//len(a);best=None
    for order in (list(range(len(a))),list(range(len(a)-1,-1,-1))):
        for initial in range(sum(a)+1):
            flow=initial;total=0;ok=True
            for i in order:
                flow+=a[i]-average
                if flow<0:ok=False;break
                total+=flow
            if ok and flow==initial:best=total if best is None else min(best,total)
    return best
def warehouse_random(r):
    n=r.randint(1,7);a=[r.randint(0,8) for _ in range(n)];a[-1]+=(-sum(a))%n;return a
def warehouse_edges():
    yield [0]*100000+[10**9]*100000,5000000000000000000
    yield [0,10**9]*100000,50000000000000
    yield [10**9]*200000,0
add(295,'环形仓库全程同方向均分的最小运输费','n个仓库成环，每件物品跨相邻边费用1。目标每仓最终物品数相同，保证总量可被n整除。整个方案只能选顺时针或逆时针中的一种，全程不能混用方向；可任选起点。求最小总费用。','第一行n，第二行warehouses。原文无数值界，本站1≤n≤200000，0≤warehouses[i]≤10^9，保证sum%n=0。输出精确整数费用，不取模。','计算每仓相对平均值的前缀盈余P，包含最后0。顺向最小费用sum(P)−n·min(P)，反向n·max(P)−sum(P)，取较小。','顺向流量守恒决定各边流量都为P[i]+c。不能逆运要求所有流量非负，所以c≥−min(P)，取最小c使费用最小。此时至少一边流量0，从该边后开始按顺向传递可实际完成，达到下界。逆向同理为c−P[i]且c≥max(P)。分别取最小后再选方向，不能用允许双向流量的中位数公式。','时间O(n)，辅助空间O(1)不含读取，费用64位。',[[0,4,4,0],[3,4,6,6,6],[1,1]],'答案依次8、7、0。第一例双向混运可以4，但原题全程单方向限制使最少为8。',warehouse_random,warehouse_edges(),arr,warehouse_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));n=len(a);average=sum(a)//n;prefix=total=low=high=0
    for v in a:prefix+=v-average;total+=prefix;low=min(low,prefix);high=max(high,prefix)
    return str(min(total-n*low,n*high-total))
''',[('误允许每件选择各自运输方向','return str(min(total-n*low,n*high-total))','p=[];s=0\n    for v in a:s+=v-average;p.append(s)\n    p.sort();middle=p[n//2]\n    return str(sum(abs(v-middle) for v in p))'),('错误固定只能顺时针','min(total-n*low,n*high-total)','total-n*low')],2200030,time=8)

def main():
    base.main()
    path=base.OUT/'reviews'/f'{base.BATCH}.json';data=json.loads(path.read_text())
    data['items'].extend([dict(id='oa-amazon-289',status='blocked',reason='完整原界n1000且含d1。无解可定义-1，但可行d1仍要求最少转账供需拆分；来源极差公式原例1算2而正确3。[1,1,6,4],k10,d1确需3，单按总搬量或供需点数下界也不够。未有经证明覆盖完整域的算法，不缩n/d。'),dict(id='oa-amazon-291',status='blocked',reason='原文没明确全相等、总变差0时是否允许删空。空数组与必须保留1个的最小输出不同；这不是输出编码，而是可行集不确定，不排除该输入绕过。')])
    slugs=['maximum-number-of-products-you-can-pick','maximum-possible-racers','maximum-quality-sum','maximum-times-word-removed','maximum-user-traffic','merge-intervals','min-cost','min-days-to-deliver-parcels','min-disconnected-sets','min-errors','min-operation','min-operations-to-sort-all-packages','min-operations','minimal-heaviest-set-a','minimize-array-sum-difference','minimize-effort','minimize-sum-of-absolute-differences','minimize-the-range','minimize-warehouse-transfer-cost']
    catalog={v['id']:v for v in json.loads((base.ROOT/'content/oa-master/catalog.json').read_text())['items']}
    for item in data['items']:
        n=int(item['id'].split('-')[-1]);paths=['fastprep/Amazon/amazon-'+slugs[n-277]+'.md']
        if n==286:paths.append('fastprep/Amazon/amazon-get-min-errors.md')
        item['sourceEvidence']=[]
        for relative in paths:
            raw=(Path('/tmp/cswork-oa-source-20260919')/relative).read_bytes();item['sourceEvidence'].append(dict(commit='e66f809f4c953bce129f68491726176615db6afc',path=relative,gitBlobSha1=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=catalog[item['id']]['contentHash']))
    data['items'].sort(key=lambda v:int(v['id'].split('-')[-1]));path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
