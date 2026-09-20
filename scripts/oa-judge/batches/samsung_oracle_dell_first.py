#!/usr/bin/env python3
"""Independent Samsung / Oracle / Dell batch; large cases are lazy, --small is bounded."""
import gc, hashlib, json, random, subprocess, sys, time
from collections import deque
from fractions import Fraction
from functools import lru_cache
from itertools import permutations
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'
BATCH='samsung-oracle-dell-first';SEED=20260920;SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def add(company,n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=f'oa-{company}-{n}',company={'samsung':'Samsung','oracle':'Oracle','dell':'Dell'}[company],title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def reach_one(a,b):
    todo=deque([(0,0,1,0)]);seen={(0,0,1)}
    while todo:
        x,y,k,d=todo.popleft()
        if (x,y)==(a,b):return d
        for u,v,w in ((x+k,y,k),(x,y+k,k),(x,y,k+1)):
            if u<=a and v<=b and w<=max(a,b) and (u,v,w) not in seen:
                seen.add((u,v,w));todo.append((u,v,w,d+1))
def reach_oracle(a):return '\n'.join(str(reach_one(x,y)) for x,y in a)
def reach_encode(a):return str(len(a))+'\n'+''.join(f'{x} {y}\n' for x,y in a)
def reach_edges():
    yield [(1,1)]*1000,'\n'.join(['2']*1000)
    # Independent exhaustive k scan for moderate pairs, not reference narrowing.
    pairs=[(997+i,1499+2*i) for i in range(1000)]
    answers=[min(k-1+(a+k-1)//k+(b+k-1)//k for k in range(1,250)) for a,b in pairs]
    # k>=250 costs>=249, while these pairs have a candidate strictly below249.
    assert max(answers)<249
    yield pairs,'\n'.join(map(str,answers))
    # t=1000, distinct maximum-scale pairs, independent quotient-interval enumeration.
    pairs=[(10**9-37*i,10**9-73*i) for i in range(1000)]
    def by_quotient(a,b):
        # ceil(a/k)=floor((a-1)/k)+1. Both floors constant until next breakpoint;
        # f grows inside that interval, so only its left endpoint matters.
        a-=1;b-=1;k=1;best=a+b+2
        while k<=max(a,b)+1:
            qa=a//k;qb=b//k;best=min(best,k+1+qa+qb)
            end=min(a//qa if qa else max(a,b)+1,b//qb if qb else max(a,b)+1)
            k=end+1
        return best
    yield pairs,'\n'.join(str(by_quotient(a,b)) for a,b in pairs)
    yield [(10**9,1),(1,10**9)],'63246\n63246'
add('samsung',2,'增加步长到达指定坐标','从(0,0)出发，初始强度K=1。一次操作可令x增加K、y增加K，或令K增加1。求恰到(a,b)的最少操作数，每组独立。','第一行t，之后t行a b。完整原界1≤t≤1000，1≤a,b≤10^9。','固定最终强度k的最少操作为k−1+ceil(a/k)+ceil(b/k)。先在sqrt(a+b)附近找上界，再用二次不等式缩小可能更优的整数k范围。','最终强度k需k−1次升级，每坐标至少ceil(坐标/k)步。升级途经各坐标除k的余数时走一次，再于k走商次，就达到下界。令S=a+b、B为已找到可达值，任何不差于B的k满足k−1+S/k≤B，即k²−(B+1)k+S≤0。整数平方根配合外扩端点包含全部可行候选，逐一取最小不会遗漏。','每组O((a+b)^(1/4))次整数计算、O(1)额外空间；输入输出O(t)。', [[(1,6)],[(1,1)],[(2,3),(6,6)]],lambda r:[(r.randint(1,10),r.randint(1,10)) for _ in range(r.randint(1,4))],reach_edges,reach_encode,reach_oracle,
'''def solve(raw):
    from math import isqrt
    d=list(map(int,raw.split()));out=[]
    for i in range(d[0]):
        a,b=d[1+2*i:3+2*i];s=a+b;r=isqrt(s)
        def f(k):return k-1+(a+k-1)//k+(b+k-1)//k
        best=min(f(r),f(r+1));q=isqrt((best+1)**2-4*s)
        for k in range(max(1,(best+1-q)//2-1),(best+1+q)//2+2):best=min(best,f(k))
        out.append(str(best))
    return '\\n'.join(out)
''',[('错误完全不升级强度','out.append(str(best))','out.append(str(a+b))'),('错误多计一次初始强度升级','out.append(str(best))','out.append(str(best+1))')],22020,output='每组输出一行最少操作数，共t行。',timeLimit=10)

def decimals_oracle(p):return (Fraction(p[0])+Fraction(p[1])).__floor__()
def decimals_edges():
    for p,v in [(('999999.99999999','999999.99999999'),1999999),(('0.10000001','0.89999998'),0),(('0.10000001','0.89999999'),1),(('999999.99999999','0.10000001'),1000000),(('1.99999999','1.99999999'),3)]:yield p,v
add('oracle',1,'精确求两个小数之和的下取整','给两个有限十进制数，返回它们和的向下取整。','一行两个正十进制数a b。完整原界0.1<a,b<1000000，最多8位小数；本站编码要求有整数部分，不用指数形式。','把每个小数补齐8位后转换为整数，整数相加再除以10^8。','乘10^8后每个合法输入都是精确整数；整数相加再向下除10^8恰为原和的下取整，不存在浮点靠近整数时的舍入问题。','O(输入长度)时间、O(1)数值空间。',[('1.1','3.89'),('0.10000001','0.89999998'),('2.5','2.5')],lambda r:(f'{r.randint(11,9999)/100:.2f}',f'{r.randint(11,9999)/100:.2f}'),decimals_edges,lambda p:' '.join(p)+'\n',decimals_oracle,
'''def solve(raw):
    def scaled(s):
        a,_,b=s.partition('.');return int(a)*100000000+int((b+'00000000')[:8])
    a,b=map(scaled,raw.split());return str((a+b)//100000000)
''',[('错误先分别下取整','(a+b)//100000000','a//100000000+b//100000000'),('错误向上取整','(a+b)//100000000','(a+b+99999999)//100000000')],64)

def paren_oracle(s):
    # Minimum insertion DP over substrings, independently of prefix balance.
    @lru_cache(None)
    def f(i,j):
        if i>=j:return 0
        best=1+f(i+1,j)
        if s[i]=='(':
            for k in range(i+1,j):
                if s[k]==')':best=min(best,f(i+1,k)+f(k+1,j))
        return best
    return f(0,len(s))
def paren_edges():
    for s,a in [('('*100000,100000),(')'*100000,100000),('()'*50000,0),(')'*50000+'('*50000,100000),('('*50000+')'*50000,0)]:yield s,a
add('oracle',2,'使括号串合法的最少插入','只允许插入括号，求使原串成为合法括号串的最少插入数量。','一行只含(和)的字符串，完整原界1≤长度≤100000。','扫描时用余额记录尚未匹配的左括号。遇到右括号而余额为0，就必须补一个左括号；结束后给剩余左括号补右括号。','右括号前没有可用左括号时，任何合法结果都必须新增一个左括号。其余右括号可直接匹配已有左括号而无需增加操作。结束时每个未匹配左括号至少需要一个右括号，构造恰使用这些必需插入，因此最优。','O(n)时间、O(1)空间。',['()))','))((','()()'],lambda r:''.join(r.choice('()') for _ in range(r.randint(1,12))),paren_edges,lambda s:s+'\n',paren_oracle,
'''def solve(raw):
    s=raw.strip();balance=missing=0
    for c in s:
        if c=='(':balance+=1
        elif balance:balance-=1
        else:missing+=1
    return str(missing+balance)
''',[('错误忽略前面缺左括号','missing+balance','balance'),('错误只看括号数量差','return str(missing+balance)',"return str(abs(s.count('(')-s.count(')')))")],100001,explanation='三个样例分别需2、4、0次插入。第二例可变成(())(())；来源给出的(()))(())长度和合法性都不正确，已纠正。')

def cardinal_oracle(a):
    def ones(v):
        count=0
        while v:count+=v%2;v//=2
        return count
    out=[]
    for v in a:
        j=0
        while j<len(out) and (ones(out[j]),out[j])<=(ones(v),v):j+=1
        out.insert(j,v)
    return seq(out)
def cardinal_edges():
    yield [1000000]*100000,seq([1000000]*100000)
    yield [31,16]*50000,seq([16]*50000+[31]*50000)
    yield [1]*100000,seq([1]*100000)
    yield [8,4,2,1]*25000,seq([1]*25000+[2]*25000+[4]*25000+[8]*25000)
add('oracle',3,'按二进制一的数量排序','先按二进制表示中的1数量升序，同数量按整数值升序；重复元素全部保留。','第一行n，第二行n个整数。完整原界1≤n≤100000，1≤a[i]≤1000000。','以(二进制1数,整数值)为排序键。','该二元键正好按题目优先级比较；排序保留所有输入元素，包括重复值，故输出唯一要求顺序。','O(n log n)时间、O(n)空间。',[[31,15,7,3,2],[1,2,3,4,5],[3,3,1]],lambda r:[r.randint(1,100) for _ in range(r.randint(1,12))],cardinal_edges,arr,cardinal_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()[1:]));a.sort(key=lambda v:(v.bit_count(),v));return ' '.join(map(str,a))
''',[('错误仅按数值排序','(v.bit_count(),v)','(v,)'),('错误同基数降序','(v.bit_count(),v)','(v.bit_count(),-v)')],800020,output='输出排序后的n个整数，空格分隔。')

def powers_oracle(a):
    good={2**i for i in range(26)}
    return seq([int(v in good) for v in a])
def powers_edges():
    yield [0]*100,seq([0]*100)
    yield [50000000]*100,seq([0]*100)
    yield [33554432]*100,seq([1]*100)
    yield [0,1,2,3]*25,seq([0,1,1,0]*25)
add('oracle',7,'逐个判断是否二的幂','判断数组各数是否等于2的某个非负整数次幂，返回1或0。','第一行n，第二行n个整数。完整原界1≤n≤100，0≤a[i]≤50000000。','正整数只有一个二进制1当且仅当v&(v−1)=0；先排除0。','2^k的二进制恰好一位1，减1后所有低位为1，按位与为0。若有至少两位1，减1只清最低1，高位1保留，按位与非0。0不是2的幂，需单独排除。','O(n)时间、O(n)输出空间。',[[1,2,3,4,0],[0],[33554432,50000000]],lambda r:[r.randint(0,40) for _ in range(r.randint(1,12))],powers_edges,arr,powers_oracle,
'''def solve(raw):
    a=map(int,raw.split()[1:]);return ' '.join(str(int(v>0 and (v&(v-1))==0)) for v in a)
''',[('错误把0判为幂','v>0 and (v&(v-1))==0','(v&(v-1))==0'),('错误遗漏2的0次幂','v>0 and','v>1 and')],920,output='按输入顺序输出n个0或1，空格分隔。')

def letters_encode(s):return json.dumps(s,ensure_ascii=True)+'\n'
def letters_oracle(s):return json.dumps(' '.join(list(reversed(s))[:2]),ensure_ascii=True)
def letters_edges():
    for s in ['a'*100,'\0'*100,'😀'*100,'中'*98+'\n\t',' '*100,'x'*98+'"\\']:
        yield s,letters_oracle(s)
add('oracle',8,'倒序返回最后两个字符','返回字符串最后一个字符、一个普通空格、倒数第二个字符组成的新字符串。','输入一个JSON字符串，按Unicode码点计数长度2..100（原长度界）。来源未限定字符集，本站允许所有Unicode标量，包括空白、NUL和非BMP字符；不得含孤立代理码点。以JSON编码保留字符，输入≤1230字节。','取末字符与倒数第二字符，以空格连接，并输出唯一ASCII JSON编码。','Python字符串下标按Unicode码点，−1和−2恰是要求的两个字符。插入一个空格后，JSON转义只改变表示不改变结果字符串。','O(n)输入时间及空间，输出长度O(1)。',['APPLE','bat','\0😀'],lambda r:''.join(r.choice(['a','Z',' ','\n','\0','😀','中','"','\\','\t','\x7f']) for _ in range(r.randint(2,12))),letters_edges,letters_encode,letters_oracle,
'''def solve(raw):
    import json
    s=json.loads(raw);return json.dumps(s[-1]+' '+s[-2],ensure_ascii=True)
''',[('错误保留原先后顺序',"s[-1]+' '+s[-2]","s[-2]+' '+s[-1]"),('错误遗漏中间空格',"s[-1]+' '+s[-2]","s[-1]+s[-2]")],1230,checker='exact',output='输出一个规范ASCII JSON字符串，无额外空白，末尾换行可选。可打印ASCII除双引号与反斜线外原样输出（包括/）；双引号和反斜线分别转义；退格、换页、换行、回车、制表分别用\\b、\\f、\\n、\\r、\\t；其他控制字符、DEL和非ASCII用小写四位\\uXXXX，非BMP用小写UTF-16代理对。两侧双引号必须保留，等价Python json.dumps(value,ensure_ascii=True)。')

def merge_encode(x):return str(len(x[0]))+'\n'+seq(x[0])+'\n'+seq(x[1])+'\n'
def merge_oracle(x):return seq(sorted(x[0]+x[1]))
def merge_edges():
    yield ([0]*100000,[10**9]*100000),seq([0]*100000+[10**9]*100000)
    yield ([10**9]*100000,[10**9]*100000),seq([10**9]*200000)
    yield (list(range(0,200000,2)),list(range(1,200000,2))),seq(range(200000))
    yield ([0,0],[0,0]),'0 0 0 0'
def merge_random(r):
    n=r.randint(2,12);return (sorted(r.randint(0,20) for _ in range(n)),sorted(r.randint(0,20) for _ in range(n)))
add('oracle',9,'合并两个等长有序数组','把两个非递减数组合并为一个非递减数组，保留全部重复值。','第一行共同长度n，随后两行各n个整数。完整原界1<n≤100000，0≤元素≤10^9，两个数组分别非递减。','两个指针比较尚未输出的最小值，取较小者；一边耗尽后输出另一边余项。','每个数组未输出部分的首项是该部分最小值，两首项较小者即全体未输出值的最小值。依次输出维持有序且每项恰输出一次。','O(n)时间、O(n)输入输出空间。',[([1,2,3],[2,5,5]),([0,0],[0,1]),([4,5],[1,3])],merge_random,merge_edges,merge_encode,merge_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];b=d[n+1:];i=j=0;out=[]
    while i<n and j<n:
        if a[i]<=b[j]:out.append(a[i]);i+=1
        else:out.append(b[j]);j+=1
    out.extend(a[i:]);out.extend(b[j:]);return ' '.join(map(str,out))
''',[('错误去重','map(str,out)','map(str,dict.fromkeys(out))'),('错误按降序比较首项','a[i]<=b[j]','a[i]>=b[j]')],2200020,output='输出合并后的2n个整数，空格分隔。原返回签名int[n]与正文不符，此处按正文保留全部2n项。')

def diff_oracle(a):return min(sum(abs(p[i]-p[i-1]) for i in range(1,len(p))) for p in permutations(a))
def diff_edges():
    yield [0]*100000,0
    yield [10**9]*100000,0
    yield [0,10**9]*50000,10**9
    yield list(range(100000)),99999
add('oracle',10,'重排后相邻绝对差之和最小值','可任意重排数组，求相邻元素绝对差之和的最小值；只输出代价，不输出排列。','第一行n，第二行n个整数。完整原界2≤n≤100000，0≤a[i]≤10^9。','答案是最大值减最小值，只需一遍扫描。','任何排列中，最小值到最大值之间的路径绝对差之和至少是二者差，因此总和不小于max−min。按非递减顺序排列，各差望远镜相消恰为max−min，达到下界。','O(n)时间；参考读取输入O(n)空间，可流式降至O(1)。',[[1,3,2],[5,5],[0,10,0]],lambda r:[r.randint(0,12) for _ in range(r.randint(2,7))],diff_edges,arr,diff_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()[1:]));return str(max(a)-min(a))
''',[('错误直接采用原顺序','max(a)-min(a)','sum(abs(a[i]-a[i-1]) for i in range(1,len(a)))'),('错误答案为最大值','max(a)-min(a)','max(a)')],1100020)

@lru_cache(None)
def reduce_tuple(a):
    if len(a)==1:return 0
    return min(a[i]+a[j]+reduce_tuple(tuple(sorted(a[:i]+a[i+1:j]+a[j+1:]+(a[i]+a[j],)))) for i in range(len(a)) for j in range(i+1,len(a)))
def reduce_oracle(a):
    reduce_tuple.cache_clear()
    return reduce_tuple(tuple(sorted(a)))
def reduce_edges():
    yield [0]*10000,0
    # Equal leaf weights: a full optimal binary tree has depths h and h+1.
    n=10000;h=n.bit_length()-1
    yield [100000]*n,100000*(n*h+2*(n-2**h))
    yield [0]*9999+[100000],100000
    yield [100000,100000],200000
add('oracle',11,'反复合并两数的最小总代价','每次选择两个不同位置的元素，支付它们的和，并用该和替换这两个元素。直到只剩一个元素，求最小总代价。','第一行n，第二行n个整数。完整原界2≤n≤10000，0≤a[i]≤100000。答案可能超过32位整数。','最小堆每次取出最小的两个数合并，累加合并值并放回堆。','把归并过程看成二叉树，每个初值的总代价是其值乘叶深。最深的兄弟叶可交换为最小两个权重而不增加总代价；收缩它们得到规模减一的同型问题。因此存在最优解先合并最小两项，归纳得贪心最优；零权重也满足交换不等式。','O(n log n)时间、O(n)空间。',[[4,6,8],[1,2,3],[0,0,9]],lambda r:[r.randint(0,9) for _ in range(r.randint(2,6))],reduce_edges,arr,reduce_oracle,
'''def solve(raw):
    import heapq
    a=list(map(int,raw.split()[1:]));heapq.heapify(a);answer=0
    while len(a)>1:
        total=heapq.heappop(a)+heapq.heappop(a);answer+=total;heapq.heappush(a,total)
    return str(answer)
''',[('错误只报告最终元素和','return str(answer)','return str(a[0])'),('错误每次合并最大两项','a=list(map(int,raw.split()[1:]));heapq.heapify(a)','a=[-int(v) for v in raw.split()[1:]];heapq.heapify(a)')],70020)

SPECS[-1]['mutants'][1]=('错误每次合并最大两项',SPECS[-1]['code'],SPECS[-1]['code'].replace('a=list(map(int,raw.split()[1:]))','a=[-int(v) for v in raw.split()[1:]]').replace('return str(answer)','return str(-answer)'))

def window_encode(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def window_oracle(x):
    a,k=x;good=[sum(a[i:i+k]) for i in range(len(a)-k+1) if len(set(a[i:i+k]))==k]
    return max(good) if good else -1
def window_edges():
    yield ([10**9]*200000,2),-1
    yield ([-10**9]*200000,1),-10**9
    yield (list(range(200000)),200000),19999900000
    yield ([],200000),-1
    yield ([1,2],3),-1
add('dell',1,'互异固定长度窗口的最大和','在数组中选择恰长k且内部元素互不相同的连续窗口，使元素和最大。没有合法窗口输出−1。','第一行n k，第二行n个整数；n=0时第二行可为空。来源没有规模和值域，本站补充0≤n≤200000、1≤k≤200000、−10^9≤a[i]≤10^9；k可大于n，负数不排除。','维护长k滑窗的和及值频次；频次表大小为k时元素互异，用独立的未找到标记更新最大值。','加入新元素、移出超过k的最旧元素后，频次表和总和精确对应当前窗口。窗口内元素互异当且仅当不同值数量为k。逐一检查所有长k窗口，取其最大和；不能把负数合法答案误判无解。','O(n)期望时间、O(min(n,k))辅助空间。',[([1,2,3,7,3,5],3),([-5,-2,-3],2),([1,1],2)],lambda r:([r.randint(-8,8) for _ in range(r.randint(0,12))],r.randint(1,14)),window_edges,window_encode,window_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];counts={};total=0;best=None
    for i,v in enumerate(a):
        total+=v;counts[v]=counts.get(v,0)+1
        if i>=k:
            old=a[i-k];total-=old;counts[old]-=1
            if counts[old]==0:del counts[old]
        if i+1>=k and len(counts)==k:best=total if best is None else max(best,total)
    return str(-1 if best is None else best)
''',[('错误排除负答案','best=None','best=0'),('错误忽略互异限制','and len(counts)==k','')],2400050)

def binary_oracle(s):
    total=0
    for i in range(len(s)):
        for j in range(i+1,len(s)+1):
            t=s[i:j]
            total+=t.count('0')==t.count('1') and sum(t[k]!=t[k-1] for k in range(1,len(t)))==1
    return total
def binary_edges():
    yield '0'*100000,0
    yield '01'*50000,99999
    yield '0'*50000+'1'*50000,50000
    yield '',0
    yield '0011'*25000,99998
add('dell',2,'计数两个连续块组成的平衡二进制子串','计数连续子串：0和1数量相等，且每种字符各自连续成一个块。相同文本位于不同位置分别计数。','输入一行二进制字符串，只含0和1。原上界长度100000，未给下界，本站保留空串（空行）合法。','把字符串分成同字符连续段，相邻两段贡献其长度的较小值；累加全部相邻段。','合法子串只有一次字符转换，因此唯一跨越一对相邻段的边界。若取两侧各j个字符，可行j恰为1..min(两段长度)，且不同边界不会计数同一子串。累加即完整且无重计。','O(n)时间、O(1)辅助空间。',['011001','00110011',''],lambda r:''.join(r.choice('01') for _ in range(r.randint(0,15))),binary_edges,lambda s:s+'\n',binary_oracle,
'''def solve(raw):
    s=raw.rstrip('\\r\\n');previous=0;current=0;last='';answer=0
    for c in s:
        if c==last:current+=1
        else:answer+=min(previous,current);previous=current;current=1;last=c
    return str(answer+min(previous,current))
''',[('错误只计每对相邻块一次','min(previous,current)','int(previous>0 and current>0)'),('错误忽略最后两块贡献','answer+min(previous,current)','answer')],100001)

BLOCKED={'oa-samsung-1':'逐元素评分函数与D取值域缺失，不能用样例推定。','oa-oracle-4':'A含重复而B删重与排列定义矛盾，重复遍历长度不明。','oa-oracle-5':'同组Total与多个Total的返回语义未确认，单int接口与查询数组不一致。','oa-oracle-6':'依赖外部实时REST API，缺离线响应协议及最近整数中点舍入定义。'}
EVIDENCE={}
for n,slug in enumerate(['find-hidden-benchmark-value','reach-the-point'],1):EVIDENCE[f'oa-samsung-{n}']=['fastprep/Samsung/samsung-'+slug+'.md']
for n,slug in enumerate(['add-numbers','balance-parentheses','cardinality-sort','create-lexicographically-largest-permutation','find-circle-num','get-discounted-price','is-power','last-letters','merge-arrays','min-diff','reduction-cost'],1):EVIDENCE[f'oa-oracle-{n}']=['fastprep/Oracle/oracle-'+slug+'.md']
for n,slug in enumerate(['find-optimal-resources','get-substring-count'],1):EVIDENCE[f'oa-dell-{n}']=['fastprep/Dell/dell-'+slug+'.md']
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
    selected={v for v in sys.argv[1:] if v!='--small'}
    for s in sorted(SPECS,key=lambda s:s['n']):
        if selected and s['n'] not in selected:continue
        rng=random.Random(SEED+sum(s['n'].encode()));values=s['samples']+[s['rnd'](rng) for _ in range(160)]
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
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(sys.argv[1:])
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in sorted(SPECS,key=lambda s:s['n']):
        number=s['n'];ident=number
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(SEED+sum(number.encode()))
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=str(s['oracle'](v))+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=str(a)+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:31];assert 34<=len(tests)<=64
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
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA',s['company']],description=s['desc']+'\n\n本站独立整理标准I/O与题解；来源缺失界的补充及样例纠错在协议中明示。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout
        assert len(normalized.encode())<=128*1024*1024,(ident,'package exceeds128MiB')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        assert (OUT/'packages'/f'{ident}.json').stat().st_size<=128*1024*1024
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 independent oracle;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds/reference batch',flush=True)
        entries.sort(key=lambda x:x['id']);reports.sort(key=lambda x:x['id'])
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Authored-program subprocess verification; production sandbox still required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del cases,tests,boundary,oracles,normalized,p,doc,c;gc.collect()
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number,paths in EVIDENCE.items():
        evidence=[]
        for rel in paths:
            raw=(snapshot/rel).read_bytes();evidence.append(dict(rawPath=rel,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest()))
        ident=number;reason=BLOCKED[number] if number in BLOCKED else next(s['desc']+' '+s['limits'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',**evidence[0],additionalRawEvidence=evidence[1:],catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
