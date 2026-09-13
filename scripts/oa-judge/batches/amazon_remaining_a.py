"""Independently authored contracts for reviewed Amazon entries 1..25.

Only this file's programs execute; imported OA solutions are never executed.
"""
from collections import Counter
from functools import lru_cache
from itertools import combinations, product
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'
BATCH = 'amazon-remaining-a'
SPECS = []


def arr(a):
    return f'{len(a)}\n' + ' '.join(map(str, a)) + '\n'


def add(number, title, description, input_format, idea, proof, complexity,
        samples, random_case, oracle, encode, code, mutants, edges, **extra):
    SPECS.append(dict(number=number, title=title, description=description,
        input=input_format, idea=idea, proof=proof, complexity=complexity,
        samples=samples, random=random_case, oracle=oracle, encode=encode,
        code=code, mutants=mutants, edges=edges, **extra))


add(1, '所有连续服务器段的漏洞总值',
    '每个非空连续段的漏洞值为段长乘以段内最大元素。求所有连续段漏洞值之和，对 1000000007 取模。',
    '第一行 n（1..100000）；第二行 n 个漏洞值（1..10⁹）。',
    '单调栈为每个最大值分配左右边界。左边找严格大于、右边找大于等于，重复最大值只归属一个位置。',
    '令左右可扩展数量为 L、R。所有包含该位置且由它负责的段，长度总和为 Σ(a+b−1)=LR(L+R)/2。乘以该元素并累加，每个连续段恰好统计一次。',
    '时间 O(n)，空间 O(n)。', [[3,1,4],[2,2],[1]],
    lambda r:[r.randint(1,20) for _ in range(r.randint(1,10))],
    lambda a:sum((j-i)*max(a[i:j]) for i in range(len(a)) for j in range(i+1,len(a)+1))%1000000007,
    arr, '''def solve(d):
    a=list(map(int,d[1:])); n=len(a); left=[-1]*n; right=[n]*n; stack=[]
    for i,v in enumerate(a):
        while stack and a[stack[-1]]<=v: stack.pop()
        if stack: left[i]=stack[-1]
        stack.append(i)
    stack=[]
    for i in range(n-1,-1,-1):
        while stack and a[stack[-1]]<a[i]: stack.pop()
        if stack: right[i]=stack[-1]
        stack.append(i)
    answer=0
    for i,v in enumerate(a):
        l=i-left[i]; r=right[i]-i
        answer+=v*l*r*(l+r)//2
    return str(answer%1000000007)
''', [('遗漏段长','v*l*r*(l+r)//2','v*l*r'),('重复最大值重复归属','a[stack[-1]]<a[i]','a[stack[-1]]<=a[i]')],
    [([10**9]*100000,(10**9*100000*100001*100002//6)%1000000007)])


def self_oracle(s):
    total=Counter(s); best=0
    for i in range(len(s)):
        for j in range(i+1,len(s)+1):
            count=Counter(s[i:j])
            if j-i<len(s) and all(count[c]==total[c] for c in count): best=max(best,j-i)
    return best


add(3,'最长自足真子串',
    '寻找最长非空连续子串，要求不是整个字符串，且其中出现的每个字符在原串中的全部出现位置都包含在该子串中。不存在则输出 0。',
    '一行小写英文字母字符串，长度 1..100000。',
    '合法左端必为某个字符的首次出现位置，最多26种。分别向右扫描，维护所见字符的最右出现位置；遇到首次出现早于左端的字符就停止。',
    '左端字符若还出现在左边，区间必不自足。扫描时若发现字符出现在左端之前，任何继续扩展都无法修复；否则扫描到当前所有字符的最后出现位置后，区间恰好包含它们全部出现。枚举所有可能左端及右端，并排除整个串，因此不会漏解。',
    '时间 O(26n)，空间 O(26)。', ['abadgdg','aaaaaaa','abac'],
    lambda r:''.join(r.choice('abcd') for _ in range(r.randint(1,10))),self_oracle,lambda s:s+'\n',
    '''def solve(d):
    s=d[0]; first={}; last={}; answer=0
    for i,c in enumerate(s):
        if c not in first: first[c]=i
        last[c]=i
    for start in first.values():
        end=start
        for i in range(start,len(s)):
            c=s[i]
            if first[c]<start: break
            end=max(end,last[c])
            if i==end and i-start+1<len(s): answer=max(answer,i-start+1)
    return str(answer)
''',[('允许完整字符串','i-start+1<len(s)','i-start+1<=len(s)'),('只尝试首个左端','for start in first.values():','for start in [0]:')],
    [('a'*100000,0),('a'*99999+'b',99999)])


def consistency(a):
    best=0
    for i in range(len(a)):
        total=0
        for j in range(i,len(a)):
            total+=a[j]
            if total<0: break
            best=max(best,j-i+1)
    return best


add(5,'所有前缀和非负的最长子段',
    '求最长连续子段，使从该子段左端开始的每一个非空前缀之和都不小于0。没有合法非空子段时输出0。',
    '第一行 n（1..100000），第二行 n 个整数（−10⁹..10⁹）。题面定义不包含额外参数 k。',
    '对前缀和数组找每个位置右侧第一个严格更小的前缀和。它之前的元素均可选，遇到它即失败。',
    '子段从 l 开始时，每个前缀非负等价于之后的前缀和始终≥S[l]。第一个严格小于 S[l] 的位置恰好是第一个不合法的终点。单调栈逐一确定这些位置，计算最长有效长度即可。',
    '时间 O(n)，空间 O(n)。', [[1,1,2,3,1],[-1,-2],[1,-2,3]],
    lambda r:[r.randint(-5,5) for _ in range(r.randint(1,10))],consistency,arr,
    '''def solve(d):
    a=list(map(int,d[1:])); prefix=[0]
    for v in a: prefix.append(prefix[-1]+v)
    stop=[len(prefix)]*len(prefix); stack=[]
    for i,v in enumerate(prefix):
        while stack and prefix[stack[-1]]>v: stop[stack.pop()]=i
        stack.append(i)
    return str(max(stop[i]-i-1 for i in range(len(a))))
''',[('把等于零视为失败','prefix[stack[-1]]>v','prefix[stack[-1]]>=v'),('把失败元素计入','stop[i]-i-1','stop[i]-i')],
    [([0]*100000,100000),([-10**9]*100000,0)])


def password_oracle(pair):
    s,t=pair
    for mask in range(1<<len(s)):
        shifted=''.join(chr((ord(c)-97+((mask>>i)&1))%26+97) for i,c in enumerate(s))
        it=iter(shifted)
        if all(any(v==c for v in it) for c in t): return 'YES'
    return 'NO'


add(14,'循环递增后的密码子序列',
    '给定新密码和旧密码。新密码的每个字符可以保持不变，或至多循环递增一次（z变a）。判断是否能使旧密码成为变换后新密码的子序列。本站每个测试输入一组密码。',
    '第一行新密码，第二行旧密码；均为小写英文字母，1≤旧密码长度≤新密码长度，两串总长度≤200000。',
    '从左到右扫描新密码，当前字符或其后继能匹配旧密码当前字符时立即匹配。',
    '字符选择互相独立。任何可行匹配的第一个位置都不会早于贪心选择的位置，用更早位置替换不会减少剩余可用字符。依次交换可得完整贪心匹配；不能匹配完整旧密码则不存在可行解。',
    '时间 O(n+m)，额外空间 O(1)。',[('baacbab','abdbc'),('accdb','ach'),('z','a')],
    lambda r:(lambda s:(s,''.join(r.choice('abcz') for _ in range(r.randint(1,len(s))))))(''.join(r.choice('abcz') for _ in range(r.randint(1,8)))),
    password_oracle,lambda x:'\n'.join(x)+'\n',
    '''def solve(d):
    s,t=d; j=0
    for c in s:
        if c==t[j] or chr((ord(c)-96)%26+97)==t[j]: j+=1
        if j==len(t): return 'YES'
    return 'NO'
''',[('不允许循环递增',"c==t[j] or chr((ord(c)-96)%26+97)==t[j]","c==t[j]"),('只需匹配一位',"j==len(t)","j>0")],
    [(('z'*100000,'a'*100000),'YES'),(('a'*100000,'z'*100000),'NO')],output='输出 YES 或 NO。')


def orders_encode(x):
    a,intervals,qs=x
    return f'{len(a)} {len(intervals)} {len(qs)}\n'+' '.join(map(str,a))+'\n'+''.join(f'{l} {r}\n' for l,r in intervals)+' '.join(map(str,qs))+'\n'


def orders_random(r):
    n=r.randint(1,8); ranges=[]
    for _ in range(r.randint(1,8)):
        a,b=sorted([r.randrange(n),r.randrange(n)]); ranges.append((a,b))
    return [r.randint(1,10) for _ in range(n)],ranges,[r.randint(1,11) for _ in range(r.randint(1,8))]


add(15,'订单区间中的较小商品数量',
    '每个闭区间订单贡献该区间内的所有商品值到多重集合；同一商品被不同订单覆盖会重复计数。对每个查询值，统计多重集合中严格小于它的元素数。',
    '第一行 n m q（均1..100000）；第二行 n 个商品值；随后 m 行每行 l r（0≤l≤r<n）；最后一行 q 个查询值。商品值、查询值均1..10⁹。',
    '用差分计算每个位置被覆盖次数。按商品值排序并累加覆盖次数，对查询二分寻找第一个不小于查询值的位置。',
    '区间差分的前缀和等于每个位置被贡献的次数。排序不改变多重集合；严格小于查询值的项恰好位于 lower_bound 之前，累加这些位置的权重得到答案。',
    '时间 O((n+q)log n+m)，空间 O(n+q)。',
    [([1,2,5,4,5],[(0,1),(0,2),(1,2)],[2,4]),([1],[(0,0)],[1,2]),([5,5],[(0,1),(1,1)],[5,6])],orders_random,
    lambda x:' '.join(str(sum(v<t for l,r in x[1] for v in x[0][l:r+1])) for t in x[2]),orders_encode,
    '''def solve(d):
    from bisect import bisect_left
    n,m,q=map(int,d[:3]); a=list(map(int,d[3:3+n])); diff=[0]*(n+1); pos=3+n
    for _ in range(m):
        l,r=map(int,d[pos:pos+2]); pos+=2; diff[l]+=1; diff[r+1]-=1
    pairs=[]; count=0
    for i,v in enumerate(a):
        count+=diff[i]; pairs.append((v,count))
    pairs.sort(); values=[v for v,c in pairs]; prefix=[0]
    for v,c in pairs: prefix.append(prefix[-1]+c)
    return ' '.join(str(prefix[bisect_left(values,int(t))]) for t in d[pos:])
''',[('覆盖次数丢失','pairs.append((v,count))','pairs.append((v,min(count,1)))'),('误计相等值','bisect_left','bisect_right')],
    [(([10**9]*100000,[(0,99999)]*100000,[1,10**9]),'0 0'),(([1]*100000,[(0,99999)]*100000,[2]),'10000000000')],output='按查询顺序输出 q 个整数。')


def packages_oracle(a):
    @lru_cache(None)
    def visit(mask,t):
        if not mask: return 0
        bit=mask&-mask; i=bit.bit_length()-1; rest=mask^bit; best=visit(rest,t)
        if a[i]==t: best=max(best,1+visit(rest,t))
        for j in range(i+1,len(a)):
            if (rest>>j)&1 and a[i]+a[j]==t: best=max(best,1+visit(rest^(1<<j),t))
        return best
    return max(visit((1<<len(a))-1,t) for t in range(1,2*max(a)+1))


add(16,'等价商品包的最大数量',
    '选择一个统一目标总价 T。每个商品包包含一个或两个商品且总价为 T，每个商品最多使用一次，允许不使用部分商品。求能组成的最大包数。',
    '第一行 n（1..200000），第二行 n 个价格（1..2000）。',
    '枚举 T=1..2max(cost)，统计单件价格为T的包。对每对不同互补价格取较小频次，相同价格取频次的一半。',
    '固定T后，一个价格只可能与唯一互补价格配对，各对互不共享商品。正价格意味着单件T不能参与双件T包。因此每组独立取最大包数并求和，再枚举T即可。',
    '时间 O(n+V²)，空间 O(V)，V≤2000。',[[4,5,10,3,1,2,2,2,3],[2,2,2],[1]],
    lambda r:[r.randint(1,8) for _ in range(r.randint(1,9))],packages_oracle,arr,
    '''def solve(d):
    a=list(map(int,d[1:])); v=max(a); freq=[0]*(2*v+1)
    for value in a: freq[value]+=1
    answer=0
    for t in range(1,2*v+1):
        count=freq[t]
        for x in range(max(1,t-v),min(v,(t-1)//2)+1): count+=min(freq[x],freq[t-x])
        if t%2==0: count+=freq[t//2]//2
        answer=max(answer,count)
    return str(answer)
''',[('漏掉单件包','count=freq[t]','count=0'),('相同价格重复使用','freq[t//2]//2','freq[t//2]')],
    [([2000]*200000,200000),([1,2000]*100000,100000)])


def drives_oracle(x):
    a,k=x
    @lru_cache(None)
    def search(mask,groups):
        if not mask: return 0 if groups==0 else 10**30
        if groups<=0: return 10**30
        bit=mask&-mask; i=bit.bit_length()-1; rest=mask^bit
        answer=max(a[i],search(rest,groups-1))
        for j in range(i+1,len(a)):
            if rest>>j&1: answer=min(answer,max(a[i]+a[j],search(rest^(1<<j),groups-1)))
        return answer
    return search((1<<len(a))-1,k)


add(17,'分发游戏的最小U盘容量',
    '把所有 n 个游戏分给 k 个孩子，每人必须拿1或2个游戏。每人使用同容量U盘，求最小容量。',
    '第一行 n k（1≤k≤n≤200000 且 n≤2k）；第二行 n 个游戏大小（1..10⁹）。',
    '必须恰好组成 n−k 对。让最大的单独拿，将最小的 2(n−k) 个数首尾配对。容量为所有配对和及最大单件的最大值。',
    '若单独分配的游戏小于某个配对中的游戏，可交换二者，配对和不会增加且最大单件不超过原最大游戏。故可让最大若干项单独分配。对于剩余配对，最小配最大可通过交换不增大最大配对和，递推成立。',
    '时间 O(n log n)，空间 O(n)。',[([9,2,4,6],3),([1,2],1),([4],1)],
    lambda r:(lambda a:(a,r.randint((len(a)+1)//2,len(a))))([r.randint(1,15) for _ in range(r.randint(1,8))]),drives_oracle,
    lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',
    '''def solve(d):
    n,k=map(int,d[:2]); a=sorted(map(int,d[2:])); pairs=n-k; answer=a[-1]
    for i in range(pairs): answer=max(answer,a[i]+a[2*pairs-1-i])
    return str(answer)
''',[('配对错误包含应单独分配的大项','a[2*pairs-1-i]','a[n-1-i]'),('忽略单件容量','answer=a[-1]','answer=0')],
    [(([10**9]*200000,100000),2*10**9),(([10**9]*100000,100000),10**9)])


def health_oracle(x):
    h,t,m=x; types=list(set(t)); best=0
    for mask in range(1<<len(types)):
        if mask.bit_count()<=m:
            chosen={types[i] for i in range(len(types)) if mask>>i&1}
            best=max(best,sum(v for v,k in zip(h,t) if k in chosen))
    return best


add(19,'选择服务器类型的最大健康值',
    '选择至多 m 种服务器类型；一旦选择某种类型，该类型的所有服务器都被选中。求被选服务器健康值总和的最大值。',
    '第一行 n m（1≤m≤n≤100000），第二行 n 个健康值（1..10⁹），第三行 n 个类型编号（1..n）。',
    '按类型累加健康值，对各类总和降序排序并取前m类。',
    '每类要么全选要么全不选，类间无其它限制且健康值为正。若选中的类比未选中的某类总和小，交换不会变差。最终必可取总和最大的至多m类。',
    '时间 O(n log n)，空间 O(n)。',[([4,5,5,6],[1,2,1,2],1),([8],[1],1),([1,2,3],[1,1,2],3)],
    lambda r:(lambda n:([r.randint(1,20) for _ in range(n)],[r.randint(1,n) for _ in range(n)],r.randint(1,n)))(r.randint(1,8)),health_oracle,
    lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',
    '''def solve(d):
    n,m=map(int,d[:2]); h=list(map(int,d[2:2+n])); t=list(map(int,d[2+n:])); totals={}
    for value,kind in zip(h,t): totals[kind]=totals.get(kind,0)+value
    return str(sum(sorted(totals.values(),reverse=True)[:m]))
''',[('同类只保留最大值','totals.get(kind,0)+value','max(totals.get(kind,0),value)'),('选最小健康值类别','reverse=True','reverse=False')],
    [(([10**9]*100000,[1]*100000,1),10**14)])


def throughput_oracle(a):
    @lru_cache(None)
    def visit(mask):
        ids=[i for i in range(len(a)) if mask>>i&1]
        if len(ids)<3:return 0
        first=ids[0]; best=visit(mask^(1<<first))
        for j,k in combinations(ids[1:],2):
            best=max(best,sorted([a[first],a[j],a[k]])[1]+visit(mask^(1<<first)^(1<<j)^(1<<k)))
        return best
    return visit((1<<len(a))-1)


add(20,'三台服务器中位吞吐量之和',
    '将部分服务器分成互不重叠的三元组，每组贡献三个吞吐量的中位数，允许剩余服务器不使用。求贡献之和的最大值。',
    '第一行 n（1..100000），第二行 n 个吞吐量（1..10⁹）。',
    '降序排序。取 floor(n/3) 组，依次选第2、4、6……大的数作中位数，每个更大的配对数作最大值，剩余小数作第三个成员。',
    '第j大的组中位数需要至少2j个数不小于它（每组中位数及最大值），故至多为全局第2j大。所述构造同时达到全部这些上界，且剩余数足够给每组配一个最小值。',
    '时间 O(n log n)，空间 O(n)。',[[2,3,4,5,4],[1,2],[1,2,3,4,5,6]],
    lambda r:[r.randint(1,20) for _ in range(r.randint(1,9))],throughput_oracle,arr,
    '''def solve(d):
    a=sorted(map(int,d[1:]),reverse=True); groups=len(a)//3
    return str(sum(a[2*i+1] for i in range(groups)))
''',[('直接取最大值','a[2*i+1]','a[2*i]'),('相邻三个一组','a[2*i+1]','a[3*i+1]')],
    [([10**9]*100000,33333*10**9)])


def match_oracle(x):
    s,t,p=x
    return sum(sorted(s[i:i+len(t)*p:p])==sorted(t) for i in range(max(0,len(s)-(len(t)-1)*p)))


add(21,'等步长排列匹配',
    '给定两个字符串和正步长p，统计起点i，使第一串中 i、i+p、…、i+(m−1)p 的m个字符构成第二串的排列。必须所有下标均在范围内。',
    '第一行 userID1，第二行 userID2，第三行 p。本站输入为小写英文字母；1≤m≤n≤1000000，1≤p≤1000000。',
    '按下标模p分链，在每条链上维护长度m的滑动窗口及字符频次，与目标频次比较。',
    '每个合法起点恰好对应一条余数链的一个完整窗口，频次相等当且仅当字符可排列成目标串。每个窗口统计一次，所以答案不重不漏。',
    '时间 O(26n)，空间 O(n+26)。',[('acaccaa','aac',2),('abc','a',8),('ab','ab',2)],
    lambda r:(lambda s:(s,''.join(r.choice('abc') for _ in range(r.randint(1,len(s)))),r.randint(1,12)))(''.join(r.choice('abc') for _ in range(r.randint(1,12)))),match_oracle,
    lambda x:f'{x[0]}\n{x[1]}\n{x[2]}\n',
    '''def solve(d):
    s,t=d[:2]; p=int(d[2]); m=len(t); target=[0]*26; answer=0
    for c in t: target[ord(c)-97]+=1
    for r in range(min(p,len(s))):
        chain=s[r::p]; count=[0]*26
        for i,c in enumerate(chain):
            count[ord(c)-97]+=1
            if i>=m: count[ord(chain[i-m])-97]-=1
            if i>=m-1 and count==target: answer+=1
    return str(answer)
''',[('漏掉最后完整窗口','i>=m-1','i>=m'),('忽略步长','p=int(d[2])','p=1')],
    [(('a'*1000000,'a',1000000),1000000),(('a'*1000000,'a'*500000,1),500001)])


def matrix_oracle(x):
    matrix,factors,take=x; n=len(matrix); best=-1
    for chosen in combinations(range(n*n),take):
        counts=Counter(i//n for i in chosen)
        if all(counts[i]<=factors[i] for i in range(n)):
            best=max(best,sum(matrix[i//n][i%n] for i in chosen))
    return best


add(24,'带行数额限制的矩阵选数',
    '从n×n矩阵中恰好选x个元素，第i行最多选factor[i]个，求最大总和。无法选足时输出−1；x=0时输出0。',
    '第一行 n x（1≤n≤1000，0≤x≤n²）；第二行n个factor（0..n）；接下来n行矩阵，值1..10⁹。',
    '每行仅保留最大的factor[i]个元素，再从所有候选中取最大的x个。',
    '若某行选中了较小元素却未选择更大元素，交换后行数额不变且总和不减。因此存在最优解只使用每行前factor[i]项。所有候选总数在每行上都已满足上限，它们的任意子集合法，故选全局最大的x项最优。',
    '时间 O(n² log(n²))，空间 O(n²)。',
    [([[6,8,3],[5,10,6],[1,1,5]],[2,1,3],5),([[3]],[0],1),([[9]],[1],0)],
    lambda r:(lambda n:([[r.randint(1,15) for _ in range(n)] for _ in range(n)],[r.randint(0,n) for _ in range(n)],r.randint(0,n*n)))(r.randint(1,3)),matrix_oracle,
    lambda x:f'{len(x[0])} {x[2]}\n'+' '.join(map(str,x[1]))+'\n'+''.join(' '.join(map(str,row))+'\n' for row in x[0]),
    '''def solve(d):
    n,x=map(int,d[:2]); factor=list(map(int,d[2:2+n])); pos=2+n; candidates=[]
    for limit in factor:
        row=sorted(map(int,d[pos:pos+n]),reverse=True); pos+=n; candidates.extend(row[:limit])
    if len(candidates)<x: return '-1'
    candidates.sort(reverse=True)
    return str(sum(candidates[:x]))
''',[('忽略行上限','row[:limit]','row'),('不足也输出总和',"if len(candidates)<x: return '-1'","if len(candidates)<x: return str(sum(candidates))")],
    [(([[1]*1000 for _ in range(1000)],[1000]*1000,10**6),10**6),
     (([[10**9]*500 for _ in range(500)],[500]*500,250000),250000*10**9)])


def distribution_oracle(x):
    a,extra=x
    @lru_cache(None)
    def visit(i,left):
        if i==len(a)-1: return a[i]+left
        return min(max(a[i]+give,visit(i+1,left-give)) for give in range(left+1))
    return visit(0,extra)


add(25,'追加包裹后的最小最大负载',
    '已有包裹不可转移，将恰好extra个新包裹任意分给n名配送员。包裹不可拆分，求分配后最大负载的最小值。',
    '第一行 n extra（1≤n≤100000，1≤extra≤10¹⁵）；第二行n个初始负载（1..10⁹）。',
    '答案是原最大负载与所有包裹总数除以n向上取整的较大者。',
    '最大值不可能低于原最大负载，也不可能低于平均负载向上取整。取两者较大值M时，所有初始值≤M，剩余容量nM−sum(a)≥extra；逐个填入即可容纳全部新增包裹，因此下界可达。',
    '时间 O(n)，除输入外空间 O(1)。',[([7,5,1,9,1],25),([9,1],1),([1],1)],
    lambda r:([r.randint(1,10) for _ in range(r.randint(1,6))],r.randint(1,8)),distribution_oracle,
    lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',
    '''def solve(d):
    n,extra=map(int,d[:2]); a=list(map(int,d[2:])); total=sum(a)+extra
    return str(max(max(a),(total+n-1)//n))
''',[('平均值向下取整','(total+n-1)//n','total//n'),('忽略初始最大值','max(max(a),(total+n-1)//n)','(total+n-1)//n')],
    [(([10**9],10**15),10**15+10**9),(([1]*100000,10**15),10000000001)])


def encryption_oracle(a):
    while len(a)>2: a=[(a[i]+a[i+1])%10 for i in range(len(a)-1)]
    return ''.join(map(str,a))


add(10,'相邻数位叠加加密',
    '每轮把相邻两位之和对10取模，得到长度减1的新数组。重复直到剩下2位，输出两位数字组成的字符串，保留前导零。',
    '第一行 n（2..100000）；第二行 n 个数字（0..9）。',
    '最终两位分别是相邻两段数字与第n−2行二项式系数的加权和。用Lucas定理分别算模2、模5，再合成为模10。',
    '每次相邻相加符合帕斯卡递推，因此最终权重为C(n−2,i)。素数p下，把生成函数(1+x)^N在模p中按p进制分解，可得Lucas逐位乘积公式。模2和模5确定唯一模10余数，逐项计算即可恢复最终两位。',
    '时间 O(n log n)，空间 O(n)。',[[4,5,6,7],[0,0],[9,1,9]],
    lambda r:[r.randrange(10) for _ in range(r.randint(2,15))],encryption_oracle,arr,
    '''def solve(d):
    a=list(map(int,d[1:])); degree=len(a)-2
    small=[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]
    def coefficient(i):
        n=degree; k=i; mod5=1
        while n or k:
            u=n%5; v=k%5
            if v>u: mod5=0; break
            mod5=mod5*small[u][v]%5; n//=5; k//=5
        mod2=1 if i&degree==i else 0
        return mod5 if mod5%2==mod2 else mod5+5
    first=second=0
    for i in range(degree+1):
        c=coefficient(i); first=(first+c*a[i])%10; second=(second+c*a[i+1])%10
    return str(first)+str(second)
''',[('丢失前导零','return str(first)+str(second)','return str(first*10+second)'),('只看模5系数','return mod5 if mod5%2==mod2 else mod5+5','return mod5')],
    [([0]*100000,'00'),([1]*100000,str(pow(2,99998,10))*2)])


def regex_oracle(x):
    a,b,c=x; alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'; choices=[]
    # Any maximal solution removes exactly one forbidden character. Enumerate
    # every position and every possible missing letter, then check semantics.
    for i in range(len(a)):
        for missing in alphabet:
            groups=[alphabet]*len(a); groups[i]=alphabet.replace(missing,'')
            if all(u in g and v in g for u,v,g in zip(a,b,groups)) and not all(v in g for v,g in zip(c,groups)):
                choices.append(''.join('['+g+']' for g in groups))
    return min(choices) if choices else '-1'


add(11,'最长且字典序最小的正则表达式',
    '正则由大写字母以及方括号字符组组成；每组中字母不得重复，一组匹配一个字符。给定等长x、y、z，求能匹配x与y但不能匹配z的最长正则，长度相同取字典序最小；无解输出−1。',
    '三行分别为x、y、z，仅大写英文字母，长度均为n（1..1000000）。字典序按ASCII字符顺序。',
    '寻找最右侧满足z[i]既不同于x[i]也不同于y[i]的位置。各位置都输出完整26字母组，只在选中位置去掉z[i]。',
    '匹配n个字符最多有n个组，每组最多26字母加括号。排除z必须至少一个位置不包含z[i]，且该字符不能是x[i]或y[i]。只删一个字母达到最长长度。组内升序字典序最小，完整组比删字母组字典序小（包括删Z时Z小于右括号），故唯一缺失应尽量靠右。',
    '时间与输出空间 O(26n)。',[('AB','BD','CD'),('A','B','A'),('AA','AA','BB')],
    lambda r:(lambda n:tuple(''.join(r.choice('ABCZ') for _ in range(n)) for _ in range(3)))(r.randint(1,5)),regex_oracle,
    lambda x:'\n'.join(x)+'\n',
    '''def solve(d):
    a,b,c=d; chosen=-1; alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for i in range(len(a)):
        if c[i]!=a[i] and c[i]!=b[i]: chosen=i
    if chosen<0: return '-1'
    full='['+alphabet+']'; short='['+alphabet.replace(c[chosen],'')+']'
    return full*chosen+short+full*(len(a)-chosen-1)
''',[('选最左可删位置','chosen=i','chosen=i if chosen<0 else chosen'),('没有去掉字符',"alphabet.replace(c[chosen],'')","alphabet")],
    [(('A'*1000000,'B'*1000000,'A'*1000000),'-1'),
     (('A'*10000,'A'*10000,'B'*10000),'[ABCDEFGHIJKLMNOPQRSTUVWXYZ]'*9999+'[ACDEFGHIJKLMNOPQRSTUVWXYZ]')],
    output='输出正则表达式字符串，或者 −1。',output_limit=32768)


def outlier_oracle(a):
    answers=[]
    for i in range(len(a)):
        for j in range(len(a)):
            if i!=j and a[j]==sum(a[k] for k in range(len(a)) if k not in (i,j)): answers.append(a[i])
    return max(answers)


def outlier_random(r):
    normal=[r.randint(1,10) for _ in range(r.randint(1,7))]
    values=normal+[sum(normal),r.randint(1,30)]; r.shuffle(values)
    return values


add(9,'最大的可能离群值',
    '数组中选出n−2个正常数，另外两个不同下标分别存放正常数之和与离群值。求所有合法选择中最大的离群值。和元素与离群值可以数值相同，但下标不同。保证存在合法选择。来源样例[4,1,2,10]不符合定义，本站改用有效样例并独立验证。',
    '第一行n（3..100000），第二行n个正整数（1..10⁹），保证至少存在一种合法选择。',
    '枚举离群元素o，则剩余总和必须为偶数，其中一半s必须作为另一个下标上的元素出现。用频次数组或哈希表检查。',
    '去掉离群数后剩余的是正常数与它们的和，因此剩余总和=2s。反过来，只要s在另一下标存在，移除这两个下标，剩下数的和就等于s，构成合法选择。枚举所有o并取最大值。',
    '期望时间 O(n)，空间 O(n)。',[[4,1,2,3],[1,1,1],[2,3,5,10]],outlier_random,outlier_oracle,arr,
    '''def solve(d):
    from collections import Counter
    a=list(map(int,d[1:])); freq=Counter(a); total=sum(a); best=0
    for value in a:
        rest=total-value
        if rest%2: continue
        half=rest//2
        if freq.get(half,0)>(1 if half==value else 0): best=max(best,value)
    return str(best)
''',[('忽略下标互异','>(1 if half==value else 0)','>0'),('忽略剩余奇偶',"if rest%2: continue","if False: continue")],
    [([1]*99998+[99998,10**9],10**9),([10**9,10**9,10**9],10**9),([1,1,6,8,2],2)])


SKIPPED={
    'oa-amazon-7':'胜负定义同时使用存在排列和对任意排列，量词不明；来源按排序逐位比较的判断与排列博弈不等价。',
    'oa-amazon-12':'重复权重的排序要求以及相同最终位置是否允许未明确，样例也不足以消除歧义。',
    'oa-amazon-22':'允许跳过库存不足d的中心，与不同正值个数解法不等价。例如 [1,2,3] 可先减2得到[1,0,1]，再减1，两天而非三天。',
    'oa-amazon-23':'任意丢弃内部元素与必须连续子数组相矛盾；样例[-2,4,3,-2,1] 的最大连续和7、任意保留正数和8均非给定9。',
}

SAMPLE_EXPLANATIONS={
    1:'样例1：六个连续段的贡献依次为3、6、12、1、8、4，总和34。样例2：两个单元素段各贡献2，整个段贡献2×2=4，总和8。样例3：唯一段贡献1。',
    3:'样例1：子串dgdg包含原串全部的d与g，长度4，且没有更长的自足真子串。样例2：任何包含a的自足子串都必须包含全部7个a，与真子串要求冲突，输出0。样例3：aba包含全部a与b，长度3。',
    5:'样例1：整个数组的前缀和为1、2、4、7、8，全部非负，长度5。样例2：任一子段首项都为负，答案0。样例3：[1,−2]的第二个前缀为−1，[−2,3]的第一个前缀为−2，只能取单元素1或3，答案1。',
    9:'样例1：正常数为1、2，和元素为3，离群值为4。样例2：三个不同下标分别承担正常数、和元素和离群值，虽然数值都是1，仍然合法。样例3：正常数2、3的和是5，剩余10为离群值，也是数组最大值。',
    10:'样例1：[4,5,6,7]先变成[9,1,3]，再变成[0,4]，输出04，不能省略前导零。样例2：已剩两位，直接输出00。样例3：相邻和9+1与1+9对10取模都为0，输出00。',
    11:'样例1：第二位z=D同时也是y的字符，不能删除；第一位删除C，两个字符组其余字母全部保留，仍能匹配AB、BD，却不能匹配CD。样例2：z等于x，任何匹配x的表达式也会匹配z，无解。样例3：任一位置都可删除B；为使字典序最小，只在最右侧字符组删除B。',
    14:'样例1：取原串下标2、3、4、5、7（从1开始），得到a、a、c、b、b；将原串第3、4、7位各递增一次后，所选字符变成a、b、d、b、c，即目标abdbc，输出YES。样例2：原串没有字符能保持或递增为h，输出NO。样例3：z可循环递增为a，输出YES。',
    15:'样例1：多重集合中1出现2次、2出现3次、5出现2次，所以小于2的有2个，小于4的有5个。样例2：唯一元素1不小于1，但小于2，输出0 1。样例3：两个订单共贡献三个5，小于5的为0个，小于6的为3个。',
    16:'样例1：取目标价5，可组成[5]、[4,1]以及两个[3,2]，共4包；枚举其它目标不能得到更多。样例2：取目标价2，每个2各自一包，共3包，而不是强行两两配对。样例3：唯一商品1单独成包，答案1。',
    17:'样例1：把2和4放在一起，6与9各自单独分配，三个U盘负载为6、6、9，容量9即可，也不可能小于游戏9的大小。样例2：只有一个孩子，必须拿两个游戏，总大小3。样例3：一个游戏大小4，容量4。',
    19:'样例1：类型1健康值总和4+5=9，类型2为5+6=11，只选一类时取类型2。样例2：唯一服务器健康值8。样例3：只有两种类型且最多能选3种，因此全选，总和1+2+3=6。',
    20:'样例1：五台服务器最多组成一组，选择吞吐量3、4、5，中位数4。样例2：不足三台，无法组成组，答案0。样例3：可分为[1,5,6]与[2,3,4]，中位数5与3，总和8。',
    21:'样例1：合法起点为0与2（从0开始），分别取得下标0、2、4的a、a、c，以及下标2、4、6的a、c、a，均是aac的排列；另一个可取足三位的起点1得到c、c、a，不匹配，答案2。样例2：目标只有一个字符，步长不会导致第二个下标，唯一起点0匹配a。样例3：两字符目标需要访问起点及起点+2，均会越界，答案0。',
    24:'样例1：第一行选8与6，第二行选10，第三行选5与1，满足每行上限，共5项，总和30。样例2：唯一一行上限为0，不能选出要求的1项，输出−1。样例3：要求选0项，空选择总和为0。',
    25:'样例1：原总量23，追加25后共48，五人最大负载至少为⌈48/5⌉=10；可分配成10、10、10、9、9，故答案10。样例2：把新增1个包裹给负载1的人，变成9、2，最大值仍为9。样例3：唯一配送员负载由1变成2。',
}


def refresh_metadata():
    """Update display metadata/checksum; prove all executable evidence unchanged."""
    batch_path=OUT/'batches'/f'{BATCH}.json'
    batch=json.loads(batch_path.read_text()); entries={x['id']:x for x in batch['items']}
    snapshots={}
    for spec in SPECS:
        identifier=f"oa-amazon-{spec['number']}"
        for folder,extension in [('references','.py'),('oracles','.json'),('mutants','.json')]:
            path=OUT/folder/(identifier+extension); snapshots[path]=path.read_bytes()
        for i in (1,2):
            path=OUT/'negative-controls'/f'{identifier}-{i}.py'; snapshots[path]=path.read_bytes()
        path=OUT/'packages'/f'{identifier}.json'; package=json.loads(path.read_text())
        before=json.loads(json.dumps(package)); entry=entries[identifier]
        code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        assert code==(OUT/'references'/f'{identifier}.py').read_text()==entry['authoredSolutions'][0]['code']
        for sample,value in zip(package['cases'][:3],spec['samples']):
            assert sample['input']==spec['encode'](value)
            assert sample['expectedOutput']==str(spec['oracle'](value))+'\n'
        package['problem']['explanation']=SAMPLE_EXPLANATIONS[spec['number']]
        for index,case in enumerate(package['cases']):
            case['name']=f'样例 {index+1}' if index<3 else f'边界与组合 {index-2}'
        result=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');const {createHash}=require('node:crypto');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const {before,after}=JSON.parse(s);console.log(JSON.stringify({oldHash:createHash('sha256').update(JSON.stringify(before)).digest('hex'),normalized:JSON.stringify(ojImportSchema.parse(after))}))});"],cwd=ROOT,input=json.dumps(dict(before=before,after=package),ensure_ascii=False),text=True,capture_output=True,check=True)
        checked=json.loads(result.stdout); assert checked['oldHash']==entry['packageChecksum'],(identifier,checked['oldHash'],entry['packageChecksum'])
        normalized=checked['normalized']; updated=json.loads(normalized)
        assert len(updated['cases'])==len(before['cases'])
        for current,original in zip(updated['cases'],before['cases']):
            assert {k:v for k,v in current.items() if k!='name'}=={k:v for k,v in original.items() if k!='name'},identifier
        assert '\ufffd' not in normalized,(identifier,'Corrupt metadata remains')
        assert {k:v for k,v in updated['problem'].items() if k!='explanation'}=={k:v for k,v in before['problem'].items() if k!='explanation'}
        path.write_text(json.dumps(updated,ensure_ascii=False,indent=2)+'\n')
        entry['packageChecksum']=hashlib.sha256(normalized.encode()).hexdigest()
        print(identifier,'display metadata refreshed; code and all case fields except name unchanged',flush=True)
    for path,original in snapshots.items(): assert path.read_bytes()==original,path
    batch_path.write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n')


def execute(path, stdin):
    p=subprocess.run([sys.executable,'-I',str(path)],input=stdin,text=True,capture_output=True,timeout=12,check=True)
    return p.stdout.strip()


def main():
    for folder in ('packages','editorials','references','oracles','mutants','negative-controls','batches','validation'):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    items=[]; reports=[]
    for spec in SPECS:
        identifier=f"oa-amazon-{spec['number']}"; rng=random.Random(20260920+spec['number']); source=sources[identifier]
        code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        reference=OUT/'references'/f'{identifier}.py'; reference.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)]; oracles=[]
        for value in values:
            expected=str(spec['oracle'](value)); stdin=spec['encode'](value)
            assert execute(reference,stdin)==expected,(identifier,value,expected)
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        tests=oracles[:3]+[dict(input=spec['encode'](x),expectedOutput=str(y)+'\n') for x,y in spec['edges']]+oracles[3:27]
        cases=[]
        for i,test in enumerate(tests):
            assert execute(reference,test['input'])==test['expectedOutput'].strip(),(identifier,i)
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**test,hidden=i>=3,weight=1))
        mutants=[]; controls=[]
        for index,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code
            changed=code.replace(old,new); path=OUT/'negative-controls'/f'{identifier}-{index}.py'; path.write_text(changed)
            rejected=[i for i,c in enumerate(cases) if execute(path,c['input'])!=c['expectedOutput'].strip()]
            assert rejected,(identifier,name,'mutant survived')
            mutants.append(dict(name=name,code=changed)); controls.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Amazon'],
            description=spec['description']+'\n\n标准输入格式、样例和评测数据由 CSWork 独立编写。',input=spec['input'],output=spec.get('output','输出一个整数，表示题目要求的答案。'),
            explanation=SAMPLE_EXPLANATIONS[spec['number']],hints=[spec['idea']],timeLimit=4,memoryLimit=262144,outputLimit=spec.get('output_limit',4096),checker='tokens',languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        solutions=[dict(language='python',code=code)]
        documents={'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')}
        for folder,document in documents.items(): (OUT/folder/f'{identifier}.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracles),'oracle checks;',len(cases),'judge cases; 2 mutants rejected',flush=True)
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=20260920,problems=reports,skipped=SKIPPED,note='Independent local differential validation; real sandbox report is still required before publication.'),ensure_ascii=False,indent=2)+'\n')
    reviews=[]
    for number in range(1,26):
        if number in (2,4,6,8,13,18): continue
        identifier=f'oa-amazon-{number}'
        reason=SKIPPED.get(identifier,'按原题明确定义独立实现参考解、暴力对照、随机与边界测试及中文题解。')
        if number==9: reason='来源样例不符合正常数之和定义，改为有效样例[4,1,2,3]，保证至少存在一种合法选择，枚举双下标验证。'
        if number==17: reason='来源参考程序错误配对大元素；按题意将最小2(n−k)项首尾配对，以分组枚举核验。'
        if number==3: reason='来源划分块公式不正确；如aba仅有一个划分块，但包含自足子串b。改为枚举首出现左端，并用全部连续区间对照。'
        reviews.append(dict(id=identifier,status='blocked' if identifier in SKIPPED else 'authored',reason=reason))
    (OUT/'reviews').mkdir(exist_ok=True)
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':
    if sys.argv[1:]==['--refresh-metadata']: refresh_metadata()
    else:
        assert not sys.argv[1:],'Use --refresh-metadata or no arguments'
        main()
