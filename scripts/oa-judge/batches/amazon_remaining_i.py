"""Independent Amazon 176..195 authoring; never executes source solutions."""
from collections import Counter, deque
from itertools import combinations, permutations
from functools import lru_cache
from math import comb, factorial, isqrt
import json, random
import amazon_remaining_h as base
base.SPECS=[];base.BATCH='amazon-remaining-i';base.SEED=20261760
add=base.add;arr=base.arr
def seq(a):return ' '.join(map(str,a))
def canvas_oracle(x):
    n,m,k,p=x;black=set()
    for t,cell in enumerate(p,1):
        black.add(tuple(cell))
        if any(all((i+a,j+b) in black for a in range(k) for b in range(k)) for i in range(1,n-k+2) for j in range(1,m-k+2)):return t
def canvas_random(r):
    n=r.randint(1,5);m=r.randint(1,5);p=[(i,j) for i in range(1,n+1) for j in range(1,m+1)];r.shuffle(p);return n,m,r.randint(1,min(n,m)),p
add(176,'首次出现完整黑色正方形的时间','白色n×m画布每分钟将给定一个格子涂黑，每格恰出现一次。求首次存在全部涂黑的k×k正方形的分钟数。','第一行n m k，随后n×m行1起始坐标，互不重复。1≤n,m≤750；1≤k≤min(n,m)。','每格填入涂黑时间，一个正方形完成时间是格内最大时间。先逐行、再逐列用单调队列求二维k窗口最大值，最后取最小。','格子在且仅在当前时间不小于自身涂黑时间时为黑，故正方形完成时间等于最大值。两次一维窗口最大合成精确二维最大；单调队列删除过期和被后来更大值支配的候选，保留正确最大值。枚举全部窗口取最小即首次成功时刻。','时间O(nm)，空间O(nm)。',[(1,1,1,[(1,1)]),(2,2,2,[(1,1),(2,2),(1,2),(2,1)]),(2,3,2,[(1,1),(1,2),(2,1),(2,2),(1,3),(2,3)])],'三例答案依次1、4、4；第三例左侧正方形先完成。',canvas_random,[((750,750,750,[(i,j) for i in range(1,751) for j in range(1,751)]),562500),((750,750,375,[(i,j) for i in range(1,751) for j in range(1,751)]),374*750+375)],lambda x:f'{x[0]} {x[1]} {x[2]}\n'+''.join(f'{i} {j}\n' for i,j in x[3]),canvas_oracle,
'''def solve(d):
    from collections import deque
    n,m,k=map(int,d[:3]);g=[[0]*m for _ in range(n)]
    for t in range(n*m):g[int(d[3+2*t])-1][int(d[4+2*t])-1]=t+1
    rows=[]
    for row in g:
        q=deque();out=[]
        for j,v in enumerate(row):
            while q and row[q[-1]]<=v:q.pop()
            q.append(j)
            while q[0]<=j-k:q.popleft()
            if j>=k-1:out.append(row[q[0]])
        rows.append(out)
    answer=n*m
    for j in range(m-k+1):
        q=deque()
        for i in range(n):
            while q and rows[q[-1]][j]<=rows[i][j]:q.pop()
            q.append(i)
            while q[0]<=i-k:q.popleft()
            if i>=k-1:answer=min(answer,rows[q[0]][j])
    return str(answer)
''',[('把最早涂色当完成','row[q[-1]]<=v','row[q[-1]]>=v'),('遗漏起始分钟','t+1','t')],4600000,time=8,memory=524288)
def apple_oracle(x):
    a,k=x
    return min(sum(abs(y-z) for z,y in zip((0,)+p,p)) for p in permutations(a,k))
add(177,'从原点吃到k个苹果的最短时间','不同整数坐标上各有一个苹果。从0出发每秒移动1单位，可任意转向，到达苹果立即吃掉，求至少吃k个的最短时间。','第一行n k，第二行坐标。1≤n≤100000；1≤k≤n；坐标−10^8..10^8且互异。','排序枚举连续k个坐标的两端，成本是两端距离加从0先到较近端点的距离。','任何走过的坐标范围是区间，若吃到至少k个，其中包含排序后连续k个。访问该窗口必须走过两端，最短访问路线是从0到较近端点再到另一端；若同侧，这一公式同样等于远端距离。故取所有窗口成本最小值。','时间O(n log n)，空间O(n)。',[([-20,5,10],3),([0,5],1),([-9,-3,4],2)],'答案依次40、0、9。',lambda r:(r.sample(range(-8,9),n:=r.randint(1,6)),r.randint(1,n)),[((list(range(100000)),100000),99999),(([-10**8,10**8],2),300000000)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',apple_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]))
    return str(min(a[i+k-1]-a[i]+min(abs(a[i]),abs(a[i+k-1])) for i in range(n-k+1)))
''',[('遗漏返程','+min(abs(a[i]),abs(a[i+k-1]))','+0'),('只检查首窗口','range(n-k+1)','range(1)')],1200030)
add(178,'统一反馈数量的调用次数','每次调用只能将一个商品的反馈数加1或减1。每个目标独立从原数组开始，输出把所有反馈数变成该目标的最少调用数。来源首例输出与题意冲突，本站按逐项绝对差更正为9。','第一行n q，第二行n个反馈数，第三行q个目标。1≤n,q≤100000，数值1..1000000。','排序建立前缀和；二分目标分隔点，左右两段分别计算增加和减少的总代价。','每项至少需要其与目标的绝对差次调用，分别调整可以达到。排序后二分划分不大于目标与大于目标两组，前缀和公式精确求出绝对差总和，查询互不影响。','时间O(n log n+q log n)，空间O(n+q)。',[([4,6,5,2,1],[3]),([3,6,6],[5,6]),([1],[1,2])],'三例输出依次9；4 3；0 1。',lambda r:([r.randint(1,20) for _ in range(r.randint(1,9))],[r.randint(1,20) for _ in range(r.randint(1,8))]),[(([1]*100000,[1000000]*100000),seq([99999900000]*100000))],lambda x:f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+seq(x[1])+'\n',lambda x:seq([sum(abs(v-t) for v in x[0]) for t in x[1]]),
'''def solve(d):
    from bisect import bisect_right
    n,q=map(int,d[:2]);a=sorted(map(int,d[2:2+n]));pre=[0]
    for v in a:pre.append(pre[-1]+v)
    out=[]
    for t in map(int,d[2+n:]):
        c=bisect_right(a,t);out.append(c*t-pre[c]+pre[n]-pre[c]-(n-c)*t)
    return ' '.join(map(str,out))
''',[('只统计增加','pre[n]-pre[c]-(n-c)*t','0'),('把绝对值总和取模','map(str,out)','map(lambda v:str(v%1000000007),out)')],1500030,output='依查询顺序输出q个整数。',outputLimit=2048)
def compatible_oracle(x):
    s,words=x;targets={''.join(p) for p in permutations(words)};length=sum(map(len,words));return sum(s[i:i+length] in targets for i in range(max(0,len(s)-length+1)))
def compatible_random(r):
    size=r.randint(1,3);return ''.join(r.choice('ab') for _ in range(r.randint(1,18))),[''.join(r.choice('ab') for _ in range(size)) for _ in range(r.randint(1,5))]
add(179,'全部商品串拼接成的历史子串数量','给定历史串和若干等长商品串，统计能由全部商品串各使用一次、任意顺序拼接得到的连续子串位置数。重复商品按出现次数使用，重叠位置分别计数。','第一行history，第二行商品数p，随后p行商品串。来源未给数值界，本站小写串；1≤|history|≤100000，1≤p≤10000，商品长度1..30且全部等长，商品总长度≤100000。','对每种长度余数维护按整词移动的滑窗，遇到无关词重置，某词过多则缩左端，窗口词数为p时计数。','按起点对词长取余划分覆盖所有可能位置。窗口始终只含目标词且各词次数不超目标，故词数达到p时必恰好等于目标多重集。缩窗只删除不能成为合法完整窗口的多余前缀；每个合法起点均被计入一次。','时间O(|history|·词长+商品总长度)，空间O(商品总长度+|history|)。',[('abcdefdefabcghidefabcxyz',['abc','def','ghi']),('aaaa',['a','a']),('abb',['ab','ab'])],'答案依次3、3、0。',compatible_random,[(('a'*100000,['a']*10000),90001),(('a'*100000,['a'*30]*3000),10001)],lambda x:x[0]+'\n'+str(len(x[1]))+'\n'+'\n'.join(x[1])+'\n',compatible_oracle,
'''def solve(d):
    from collections import Counter
    s=d[0];p=int(d[1]);words=d[2:];width=len(words[0]);target=Counter(words);answer=0
    for offset in range(width):
        left=offset;count=0;freq=Counter()
        for right in range(offset,len(s)-width+1,width):
            word=s[right:right+width]
            if word not in target:freq.clear();count=0;left=right+width;continue
            freq[word]+=1;count+=1
            while freq[word]>target[word]:
                old=s[left:left+width];freq[old]-=1;count-=1;left+=width
            if count==p:answer+=1
    return str(answer)
''',[('只检查零偏移','range(width)','range(1)'),('重复词按集合处理','target=Counter(words)','target=Counter(set(words))')],2200030)
add(180,'反转一次子串可得的不同字符串数','选择任意非空连续子串并反转一次，求能得到多少种不同字符串。长度1反转允许，因此包含原串。','一行小写串，长度1..100000。','答案为1加两端字符不同的下标对数。扫描每个字符，以此前总长度减此前相同字符数累计。','若反转区间两端相同，可去掉这两个端点而不改变结果，直到区间端点不同或操作等同不变。对端点不同的区间，结果相对原串的第一个和最后一个变化位置恰好是这两个端点，故不同区间不能产生相同结果。每个不变操作仅对应原串，结论成立。','时间O(n)，辅助空间O(26)。',['abc','aaa','aba'],'答案依次4、1、3。',lambda r:''.join(r.choice('abc') for _ in range(r.randint(1,10))),[('a'*100000,1),('a'*50000+'b'*50000,2500000001)],lambda x:x+'\n',lambda s:len({s[:i]+s[i:j][::-1]+s[j:] for i in range(len(s)) for j in range(i+1,len(s)+1)}),
'''def solve(d):
    seen={};answer=1
    for i,c in enumerate(d[0]):answer+=i-seen.get(c,0);seen[c]=seen.get(c,0)+1
    return str(answer)
''',[('遗漏原串','answer=1','answer=0'),('同端点也算新串','i-seen.get(c,0)','i')],100001)
def parcels_oracle(x):
    a,w=x
    def dfs(ids):
        if not ids:return 1
        i=ids[0];return sum(dfs(ids[1:j]+ids[j+1:]) for j in range(1,len(ids)) if abs(a[i]-a[ids[j]])==w)
    return dfs(tuple(range(len(a))))%1000000007
add(181,'全部包裹分成平衡对的方案数','每个包裹有独立身份，即使重量相同也不同。将全部包裹不重不漏分成无序对，每对重量绝对差必须为wt，求完整分组数模1000000007。不能完整分组返回0。原文中“单个配对数”的附句与主体及输出6的完整分组例矛盾；本站明确采用主体和该例的全部包裹配对含义。','第一行n wt，第二行重量。原始快照未给数值界，本站1≤n≤100000，0≤wt≤10^9，重量1..10^9。','wt为0时同重组各自完美匹配，乘奇数双阶乘。wt>0时重量按递增处理：当前尚未配对者只能匹配下一重量v+wt，从其剩余身份中选并排列，乘下降阶乘，再扣去被用人数。','最小尚未配对重量不可能再匹配更小重量，因此其所有身份必须匹配v+wt。若剩余人数不足则无解；否则选有序不同对象的方案数为P(c,r)，每个完整匹配唯一决定这些对象，递归处理余量不重不漏。wt=0时选定首个身份有c−1个伙伴，递归得(c−1)!!，各重量互不影响。','时间O(n log n)，空间O(n)。',[([4,5,5,4,4,5,2,3],1),([1,1,1,1],0),([1,2,3],1)],'答案依次6、3、0。',lambda r:([r.randint(1,6) for _ in range(r.randint(1,10))],r.randint(0,3)),[((([1]*50000+[2]*50000),1),factorial(50000)%1000000007),(([10**9]*100000,0),__import__('functools').reduce(lambda a,b:a*b%1000000007,range(1,100000,2),1))],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',parcels_oracle,
'''def solve(d):
    from collections import Counter
    n,w=map(int,d[:2]);counts=Counter(map(int,d[2:]));mod=1000000007;answer=1
    if n%2:return '0'
    if w==0:
        for c in counts.values():
            if c%2:return '0'
            for k in range(1,c,2):answer=answer*k%mod
    else:
        for value in sorted(counts):
            need=counts[value]
            if not need:continue
            available=counts.get(value+w,0)
            if available<need:return '0'
            for k in range(available-need+1,available+1):answer=answer*k%mod
            counts[value+w]=available-need
    return str(answer)
''',[('相同重量误算阶乘','range(1,c,2)','range(1,c)'),('身份配对顺序忽略','answer=answer*k%mod','answer=answer*1%mod')],1200030)
add(182,'相邻求和取个位的两位密文','反复将相邻数字之和的个位组成下一行，直到仅剩2个数字，输出两位字符串，保留前导0。','第一行n，第二行n个数字；2≤n≤5000，每项0..9。','原地向前更新相邻和模10，每轮减少有效长度，直到2。','第r轮每项按定义等于上一轮相邻两项之和模10。向前写入只覆盖已经用完的左项，不改变下一次读取的右项，因此归纳得到全部正确行。','时间O(n²)，空间O(n)。',[[4,5,6,7],[0,4],[9,9,9]],'答案依次04、04、66。',lambda r:[r.randrange(10) for _ in range(r.randint(2,16))],[([0]*5000,'00'),([1]*5000,str(pow(2,4998,10))*2),([9]*5000,str(9*pow(2,4998,10)%10)*2)],arr,lambda a:''.join(str(sum(comb(len(a)-2,j)*a[i+j] for j in range(len(a)-1))%10) for i in range(2)),
'''def solve(d):
    a=list(map(int,d[1:]));n=len(a)
    while n>2:
        for i in range(n-1):a[i]=(a[i]+a[i+1])%10
        n-=1
    return str(a[0])+str(a[1])
''',[('继续缩成一位','while n>2:','while n>1:'),('未保留前导零','return str(a[0])+str(a[1])','return str(10*a[0]+a[1])')],10010,time=8)
def obfuscate_oracle(s):return min(s[:i]+s[j-1]+s[i:j-1]+s[j:] for i in range(len(s)) for j in range(i+1,len(s)+1))
add(183,'右旋一个子串后的字典序最小消息','恰好选择一个非空子串右旋1位，即将该子串最后一个字符移到开头，其他字符右移。求所得整个字符串的字典序最小值。允许选单字符保持原串。','一行小写串，长度1..100000。','从右维护后缀最小字符及其最右位置，找到最早能用后方更小字符改进的位置，把该后缀最小字符最右一次出现移到这里。','最优改变必须尽早使字符减小；之前没有更小后缀字符的位置不值得改变。该位置选择最小后缀字符最优。若最小字符出现多次，把更右一次移来，比选较左一次仅在两次出现之间多右移一段；该段字符均不小于最小字符，首次差异使更右选择更小或相同。因此最右最小字符给出最优结果。无可改进处则原串最优。','时间O(n)，空间O(n)。',['aahhab','abc','cbaba'],'答案依次aaahhb、abc、acbab。',lambda r:''.join(r.choice('abc') for _ in range(r.randint(1,12))),[('z'*99999+'a','a'+'z'*99999),('a'*100000,'a'*100000)],lambda s:s+'\n',obfuscate_oracle,
'''def solve(d):
    s=d[0];best=len(s)-1;left=right=-1
    for i in range(len(s)-2,-1,-1):
        if s[i]>s[best]:left=i;right=best
        elif s[i]<s[best]:best=i
    if left<0:return s
    return s[:left]+s[right]+s[left:right]+s[right+1:]
''',[('同最小字符取最左','s[i]<s[best]','s[i]<=s[best]'),('仅旋转到原串开头','s[:left]+s[right]+s[left:right]+s[right+1:]','s[right]+s[:right]+s[right+1:]')],100001,output='输出最小字符串。',outputLimit=128)
def stock_oracle(x):
    a,inc,dec=x;seen={tuple(a)};q=deque(seen);best=min(a)
    while q:
        state=q.popleft();best=max(best,min(state))
        for i in range(len(a)):
            for j in range(len(a)):
                if i==j or state[j]<=dec:continue
                out=list(state);out[i]+=inc;out[j]-=dec;t=tuple(out)
                if t not in seen:seen.add(t);q.append(t)
    return best
def stock_random(r):
    inc=r.randint(1,3);return [r.randint(1,6) for _ in range(r.randint(2,3))],inc,r.randint(inc,3)
add(184,'库存调整后可达到的最大最低库存','一次选择不同位置，将一个库存加incVal、另一个减decVal；incVal≤decVal。可做任意次，最终所有库存严格为正（中间允许负数），最大化最终最小库存。','第一行n incVal decVal，第二行库存。2≤n≤200000；库存1..10^9；1≤incVal≤decVal≤10^9。','二分目标最低库存T。低于T的项需要ceil((T−a)/inc)次接收；高于T的项可提供floor((a−T)/dec)次，若总供给不少于需求则可行。','任意最终方案中若某项同时接收和提供，取消一对不会降低该项最终值，因为dec≥inc，并使全局接收提供次数同时减少。因此可消除交叉角色，只需由高于T者直接给不足者。需求向上取整、供给向下取整分别为必要界，且任取足够供给直接传给缺项即可构造方案。可行性对T单调，二分得到最大值。','时间O(n log 10^9)，空间O(n)。',[([1,9],2,3),([5,5],1,1),([1,2,3],1,2)],'答案依次3、5、1。',lambda r:([r.randint(1,4) for _ in range(r.randint(2,3))],1,r.randint(1,3)),[((([1]*100000+[10**9]*100000),1,1),500000000),(([10**9]*200000,10**9,10**9),10**9)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n',stock_oracle,
'''def solve(d):
    n,inc,dec=map(int,d[:3]);a=list(map(int,d[3:]));lo=min(a);hi=sum(a)//n
    while lo<hi:
        mid=(lo+hi+1)//2;need=supply=0
        for v in a:
            if v<mid:need+=(mid-v+inc-1)//inc
            else:supply+=(v-mid)//dec
        if supply>=need:lo=mid
        else:hi=mid-1
    return str(lo)
''',[('需求错误向下取整','(mid-v+inc-1)//inc','(mid-v)//inc'),('供给误用增加步长','(v-mid)//dec','(v-mid)//inc')],2300040,time=10)
def partition_oracle(x):
    a,k=x;values=[]
    for cuts in combinations(range(1,len(a)),k-1):
        points=(0,)+cuts+(len(a),);values.append(sum(a[l]+a[r-1] for l,r in zip(points,points[1:])))
    return f'{min(values)} {max(values)}'
def partition_random(r):
    n=r.randint(1,9);return [r.randint(1,9) for _ in range(n)],r.randint(1,n)
add(185,'恰分p段的最小和最大端点费用','把整个数组分成恰好p个非空连续段，一段费用为首元素加末元素，单元素段计算该元素两次。按最小、最大顺序输出总费用。来源第二例倒序，本站更正为8 12。','第一行n p，第二行费用。来源未给数值界，本站1≤n≤200000，1≤p≤n，费用1..10^9。','全部方案都有首尾费用，每切在i与i+1之间增加a[i]+a[i+1]；选最小或最大p−1个相邻和。','每段首末贡献可拆为原数组首尾及每个切口左右元素，切口选择相互独立且恰有p−1个。最小化及最大化独立加和分别选择最小和最大相邻和，构造有效分段达到界。','时间O(n log n)，空间O(n)。',[([1,2,3,2,5],3),([1,2,3,4],2),([5],1)],'答案依次14 18、8 12、10 10。',partition_random,[(([10**9]*200000,200000),'400000000000000 400000000000000')],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',partition_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));cuts=sorted(a[i]+a[i+1] for i in range(n-1));base=a[0]+a[-1]
    low=base+sum(cuts[:k-1]);high=base+sum(cuts[len(cuts)-(k-1):])
    return f'{low} {high}'
''',[('最大最小反转','return f\'{low} {high}\'','return f\'{high} {low}\''),('漏计原数组端点','base=a[0]+a[-1]','base=0')],2300040,output='输出最小费用和最大费用，空格分隔。')
add(186,'所有子串的不同字符数总和','对每个非空连续子串计算不同字符个数，再将全部位置对应子串的计数相加。来源aa样例漏计aa本身，本站更正为3，不采用“只出现一次的字符数”定义。','一行小写密码串。来源未给范围，本站长度1..100000。','维护以当前位置结尾的全部子串的不同字符数总和。新字符上次在j出现，则新增i−j个贡献，累计每步总和。','加入字符c时，只有起点在上次c出现位置之后的子串此前没有c，恰有i−j个；更早起点已经含c，贡献不变。由此维护结尾总和正确，再按不同右端点求和覆盖全部子串。','时间O(n)，辅助空间O(26)。',['good','aa','abc'],'答案依次16、3、10。',lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,14))),[('a'*100000,5000050000),('a'*50000+'b'*50000,7500050000)],lambda s:s+'\n',lambda s:sum(len(set(s[i:j])) for i in range(len(s)) for j in range(i+1,len(s)+1)),
'''def solve(d):
    last={};tail=answer=0
    for i,c in enumerate(d[0]):tail+=i-last.get(c,-1);last[c]=i;answer+=tail
    return str(answer)
''',[('首次出现忽略单字串','last.get(c,-1)','last.get(c,0)'),('只输出最长前缀贡献','return str(answer)','return str(tail)')],100001)
def names_oracle(x):
    real,allnames=x
    return ' '.join(sorted(name for name in real if sum(Counter(name)==Counter(alias) for alias in allnames)>1)) or 'None'
def names_random(r):
    real=r.sample(['a','ab','abc','abb','b','cc','acc'],r.randint(1,7));aliases=[''.join(r.sample(name,len(name))) for name in r.choices(real,k=r.randint(1,15))];r.shuffle(real);return real,aliases
def many_names():
    from itertools import combinations_with_replacement, islice
    return [''.join(v) for v in islice(combinations_with_replacement('abcdefghijklmnopqrstuvwxyz',6),100000)]
NAME_EDGE=many_names()
add(187,'识别使用字母重排重复注册的姓名','真实姓名互不为字母异位词，每个注册名是某个真实姓名的字母重排。找注册次数超过1的真实姓名，按字典序输出；没有则输出None。重复相同注册名也分别算账户。','第一行n m，随后n行真实名和m行注册名。1≤n,m≤100000，每名长度1..10，仅小写字母；真实姓名不同且不互为重排。','将姓名字符排序作为签名，统计所有注册签名频率，再筛选频率大于1的真实姓名并排序。','两个串可重排当且仅当各字符频次相同，排序后签名恰好刻画该等价类；真实姓名签名互异，统计签名得到各人全部账户数，筛选和排序满足输出条件。','时间O((n+m)L log L+n log n·L)，空间O((n+m)L)，L≤10。',[(['rohn','henry','daisy'],['ryhen','aisyd','henry']),(['tom','jerry'],['reyjr','mot','tom','jerry','mto']),(['abc'],['bca'])],'答案依次henry；jerry tom；None。',names_random,[((NAME_EDGE,NAME_EDGE),'None'),((NAME_EDGE,NAME_EDGE[:50000]*2),' '.join(NAME_EDGE[:50000]))],lambda x:f'{len(x[0])} {len(x[1])}\n'+'\n'.join(x[0]+x[1])+'\n',names_oracle,
'''def solve(d):
    from collections import Counter
    n,m=map(int,d[:2]);real=d[2:2+n];counts=Counter(''.join(sorted(s)) for s in d[2+n:]);out=sorted(s for s in real if counts[''.join(sorted(s))]>1)
    return ' '.join(out) if out else 'None'
''',[('只查完全同名','Counter(\'\'.join(sorted(s)) for s in d[2+n:])','Counter(d[2+n:])'),('一个账户也算重复','>1)', '>0)')],2200030,output='一行按字典序输出重复注册的真实姓名，空格分隔；无结果输出None。',outputLimit=1024)
def queue_oracle(a):
    queue=list(enumerate(a));t=0;out=[]
    while queue:
        out.append(len(queue));queue=queue[1:];t+=1;queue=[p for p in queue if p[1]>t]
    return seq(out+[0])
add(188,'每秒FIFO队列的请求数量','时刻0全部请求入队。每秒处理队首，该请求仍计入本秒数量，下一秒移除；其余请求在t=wait[i]时立即过期并移除，只能在t<wait[i]时开始服务。输出从0时刻到队列为空的每秒队长，包含末尾0。','第一行n，第二行n个等待期限。1≤n≤100000，1≤wait[i]≤100000。','按期限建立下标桶，以存活标记和前向指针维护队首。每秒移除已服务请求，再移除到期桶中的仍存活请求。','标记始终等于当前队列成员。已处理者和恰到期者按规则删除，重复命中通过标记避免二次扣数；前向指针跳过已删除项后即原顺序中第一个存活者，所以FIFO和每时刻数量都正确。每个请求至多删除一次。','时间O(n+最大期限)，空间O(n+最大期限)。',[[2,2,3,1],[4,4,4],[3,1,2,1]],'三例依次4 2 1 0、3 2 1 0、4 1 0。',lambda r:[r.randint(1,12) for _ in range(r.randint(1,15))],[([100000]*100000,seq(range(100000,-1,-1))),([1]*100000,'100000 0')],arr,queue_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));n=len(a);buckets=[[] for _ in range(max(a)+1)]
    for i,v in enumerate(a):buckets[v].append(i)
    alive=[True]*n;left=0;count=n;t=0;out=[]
    while count:
        out.append(count)
        while not alive[left]:left+=1
        alive[left]=False;count-=1;t+=1
        if t<len(buckets):
            for i in buckets[t]:
                if alive[i]:alive[i]=False;count-=1
    out.append(0)
    return ' '.join(map(str,out))
''',[('遗漏空队列终点','out.append(0)','out.append(1)'),('当前服务请求过早排除','out.append(count)','out.append(max(0,count-1))')],700020,output='输出各时刻队长，空格分隔，最后一项为0。',outputLimit=1024)
add(189,'余数等于子数组长度的区间数量','统计非空连续子数组，使其元素和除以k的非负余数恰好等于该子数组长度。按原始数值约束，元素允许相同，身份不影响求和。','第一行n k，第二行元素。1≤n≤200000；1≤元素,k≤10^9。','前缀和S定义键(S[i]−i) mod k。合法区间须两端键相等，并且长度严格小于k；用长度受限的历史前缀频率表计数。','区间和模k等于长度，当且仅当长度<k且S[r]−r与S[l]−l模k相等。遍历r时移除r−k及更早前缀，查询同键数量便精确统计所有合法左端点；按右端分组不重不漏。','时间O(n)，空间O(n)。',[([1,3,2,4],4),([1,1,1],2),([1],1)],'答案依次2、3、0。',lambda r:([r.randint(1,15) for _ in range(r.randint(1,14))],r.randint(1,10)),[(([1]*200000,10**9),20000100000),(([1]*200000,2),200000),(([10**9]*200000,1),0)],lambda x:f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n',lambda x:sum(sum(x[0][i:j])%x[1]==j-i for i in range(len(x[0])) for j in range(i+1,len(x[0])+1)),
'''def solve(d):
    from collections import Counter
    n,k=map(int,d[:2]);keys=[0];value=answer=0;freq=Counter({0:1})
    for r,v in enumerate(map(int,d[2:]),1):
        value=(value+v-1)%k;keys.append(value)
        if r>=k:freq[keys[r-k]]-=1
        answer+=freq[value];freq[value]+=1
    return str(answer)
''',[('不限制长度','if r>=k:freq[keys[r-k]]-=1','if False:freq[keys[r-k]]-=1'),('漏减下标','value+v-1','value+v')],2300030)
def distinct_oracle(x):
    a,u,v=x;values=[len(set(a[i:j])) for i in range(len(a)) for j in range(i+1,len(a)+1) if u in a[i:j] and v in a[i:j]];return min(values) if values else 0
add(190,'包含两个指定值的最少不同数','求同时含两个目标值的非空连续子数组的最少不同数；目标相同则存在输出1，否则0。本站补充无可行区间统一输出0。','第一行n u v，第二行数组。来源未给数值界，本站1≤n≤200000，数组值与目标−10^9..10^9。','双指针维护窗口频次；每当同时含两目标，就记录不同数并不断缩左端，直至不再同时包含。','加入右端后，逐个检查所有尚未检查且可行的左端。较短同右端窗口的不同数不会更多；一旦不可行，更往右的左端也不可行。被先前删除的左端再扩右端只可能增加或保持不同数，不会优于此前已记录值，因此取记录最小值即全局最优。','时间O(n)，空间O(n)。',[([1,2,2,2,5,2],1,5),([1,3,2,1,4],1,2),([2,4,9],1,1)],'答案依次3、2、0。',lambda r:([r.randint(-2,4) for _ in range(r.randint(1,12))],r.randint(-2,5),r.randint(-2,5)),[((list(range(200000)),0,199999),200000),(([1]*200000,1,1),1),(([1]*200000,1,2),0)],lambda x:f'{len(x[0])} {x[1]} {x[2]}\n'+seq(x[0])+'\n',distinct_oracle,
'''def solve(d):
    n,u,v=map(int,d[:3]);a=list(map(int,d[3:]));freq={};left=0;answer=n+1
    for value in a:
        freq[value]=freq.get(value,0)+1
        while u in freq and v in freq:
            answer=min(answer,len(freq));old=a[left];left+=1;freq[old]-=1
            if not freq[old]:del freq[old]
    return str(answer if answer<=n else 0)
''',[('只要求任一目标','u in freq and v in freq','u in freq or v in freq'),('误算重复频次总数','answer=min(answer,len(freq))','answer=min(answer,sum(freq.values()))')],2300050)
def beauty_oracle(x):
    a,pairs=x;selected=set();expanded=[]
    for l,r in pairs:expanded.extend(a[l:r+1]);selected.update(range(l,r+1))
    return sum(sum(v<a[i] for v in expanded) for i in range(len(a)) if i not in selected)
def beauty_random(r):
    a=[r.randint(-3,7) for _ in range(r.randint(1,9))];pairs=[]
    for _ in range(r.randint(1,8)):
        l=r.randrange(len(a));pairs.append((l,r.randrange(l,len(a))))
    return a,pairs
add(191,'重复区间拼接后的美丽度总和','每个闭区间都按原数组取出并拼接，重复和重叠区间重复贡献元素。曾被任一区间覆盖的原下标美丽度为0；未覆盖下标的美丽度为拼接数组中严格小于其值的元素个数。求总和。来源例错算重复元素，本站更正为12。','第一行n m，第二行数组，随后m行0起始闭区间l r。来源无数值界，本站1≤n,m≤200000，−10^9≤元素≤10^9，0≤l≤r<n。','差分求各下标覆盖次数，以次数作为元素权重。按元素值排序并分组，未覆盖元素贡献所有严格更小值的累计权重。','每次区间出现都贡献一次其内部每个下标，差分次数恰好等于拼接数组重数；次数为0正是需要计分的下标。按值分组先查询再增加权重，排除了相等值，所以计算精确且无需展开巨大拼接数组。','时间O(n log n+m)，空间O(n)。',[([1,2,3,2,4,5],[(0,1),(3,4),(0,0),(3,4)]),([2,2],[(0,0)]),([1,3,5],[(0,0),(0,0)])],'首例未覆盖的3有5个更小元素，5有7个，共12；后两例0、4。',beauty_random,[(([1]*100000+[2]*100000,[(0,99999)]*200000),2000000000000000),(([10**9]*200000,[(0,199999)]*200000),0)],lambda x:f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+''.join(f'{l} {r}\n' for l,r in x[1]),beauty_oracle,
'''def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));diff=[0]*(n+1)
    for i in range(2+n,len(d),2):l=int(d[i]);r=int(d[i+1]);diff[l]+=1;diff[r+1]-=1
    weights=[];cur=0
    for i in range(n):cur+=diff[i];weights.append(cur)
    order=sorted(range(n),key=lambda i:a[i]);left=0;total=answer=0
    while left<n:
        right=left;extra=0
        while right<n and a[order[right]]==a[order[left]]:
            weight=weights[order[right]]
            if weight==0:answer+=total
            extra+=weight;right+=1
        total+=extra;left=right
    return str(answer)
''',[('重复区间去重','extra+=weight','extra+=min(1,weight)'),('已覆盖下标也计分','if weight==0:answer+=total','if True:answer+=total')],5300050,time=8)
def averages_oracle(a):
    remaining=list(a);values=set()
    while remaining:
        low=min(remaining);remaining.remove(low);high=max(remaining);remaining.remove(high);values.add((low+high)/2)
    return len(values)
add(192,'两端经验值配对后的不同平均数','反复将剩余经验值最小和最大的人配为一组，删除两人，直到配完。求所有组经验值平均数的不同取值数量。','第一行偶数n，第二行经验值。2≤n≤100000且为偶数；1≤经验值≤10^9。','排序将首尾向中间配对，把每组两数和放集合。平均数是否相等与两数和是否相等完全等价，不需要浮点。','排序后的两端分别是当前最小最大，移走后内层仍有序，归纳实现题定配对过程。除以同一非零常量2保持相等关系，因此和集合大小即平均数集合大小。','时间O(n log n)，空间O(n)。',[[1,4,1,3,5,6],[1,1,1,1,1,1],[1,100,10,1000]],'答案依次2、1、2。',lambda r:[r.randint(1,20) for _ in range(2*r.randint(1,7))],[([10**9]*100000,1),(list(range(1,100001)),1)],arr,averages_oracle,
'''def solve(d):
    a=sorted(map(int,d[1:]));n=len(a)
    return str(len({a[i]+a[n-1-i] for i in range(n//2)}))
''',[('错误整数平均截断','a[i]+a[n-1-i]','(a[i]+a[n-1-i])//2'),('不排序直接配对','a=sorted(map(int,d[1:]))','a=list(map(int,d[1:]))')],1100030)
def quotient_large_oracle(n):
    # Split by quotient size at sqrt(n), rather than grouping denominator intervals.
    root=isqrt(n);values=set(range(1,root+1));values.update(n//k for k in range(1,root+1));values.discard(n);return sum(values)
add(194,'小于n的不同整除商之和','给定n，收集所有满足存在正整数k使floor(n/k)=x且0≤x<n的不同x，求其和。原始快照明确x<n，故必须排除k=1产生的n；0虽然属于集合但不影响和。','一行整数n，1≤n≤10^10。','从分母k=2开始整除分块。当前商q=n//k在分母k..n//q保持相同，累加一次q并跳到下一块。','商q对应分母区间上界为floor(n/q)，所以跳过区间恰好避开重复商且不遗漏后续较小商。从2开始排除唯一产生n的分母1，超过n后的商全为0无须累加。不同正商只有O(√n)种。','时间O(√n)，辅助空间O(1)。',[1,5,10],'答案依次0；1+2=3；1+2+3+5=11。',lambda r:r.randint(1,500),[(10**10,quotient_large_oracle(10**10)),(9999999999,quotient_large_oracle(9999999999)),(9999800001,quotient_large_oracle(9999800001))],lambda n:str(n)+'\n',lambda n:sum(set(n//k for k in range(2,n+2))),
'''def solve(d):
    n=int(d[0]);k=2;answer=0
    while k<=n:
        q=n//k;answer+=q;k=n//q+1
    return str(answer)
''',[('错误包含n自身','k=2','k=1'),('漏计商1','while k<=n:','while k<=n//2:')],12)

# Additional full-protocol edges, independent of random small oracles.
for spec in base.SPECS:
    if spec['n']==187:spec['edges'].append(((['abcdefghij'],['jihgfedcba']*100000),'abcdefghij'))
    if spec['n']==190:spec['edges'].append((([-10**9,0,10**9],-10**9,10**9),3))
    if spec['n']==190:spec['bound']=2400050
    if spec['n']==184:spec['random']=stock_random
    if spec['n']==182:
        spec['output']='输出恰好两个数字字符，必须保留前导0。'
        spec['explain']='答案依次04、04、88；第三例只有一轮，两次9+9的个位都为8。'

def main():
    base.main()
    path=base.OUT/'reviews'/f'{base.BATCH}.json';data=json.loads(path.read_text())
    data['items'] += [dict(id='oa-amazon-193',status='blocked',reason='已核对e66f809原文：每秒移除一个服务请求却给出6,4,2,2,1,0，非空队列连续两秒不减少与规则矛盾，且过期端点未明确，不借用188替代。'),dict(id='oa-amazon-195',status='blocked',reason='已核对e66f809原文：unique pairs混用位置与值，重复元素按身份或按数值去重会给不同答案，无样例消除歧义，暂不臆定。')]
    data['items'].sort(key=lambda x:int(x['id'].split('-')[-1]));path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
