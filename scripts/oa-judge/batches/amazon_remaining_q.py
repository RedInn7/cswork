"""Original Amazon336–355. No source solutions are imported or executed.

All large fixtures are lazy and reserved for a coordinated remote run.
Local use: python3 amazon_remaining_q.py --small
"""
from collections import Counter, deque
from functools import lru_cache
from itertools import combinations
from pathlib import Path
from math import isqrt
import hashlib, json, random, subprocess, sys, time

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge';BATCH='amazon-remaining-q';SEED=20263360;SPECS=[]
def seq(a):return ' '.join(map(str,a))
def arr(a):return str(len(a))+'\n'+seq(a)+'\n'
def line(s):return str(s)+'\n'
def compact(x):return json.dumps(x,ensure_ascii=True,separators=(',',':'))
def json_input(x):return compact(x)+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,rnd=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))

def reverse_oracle(s):
    goal=s[::-1];q=deque([(s,0)]);seen={s}
    while q:
        state,d=q.popleft()
        if state==goal:return d
        for i in range(len(state)):
            nxt=state[:i]+state[i+1:]+state[i]
            if nxt not in seen:seen.add(nxt);q.append((nxt,d+1))
def reverse_edges():
    yield '0'*100000,0
    yield '0'*50000+'1'*50000,50000
    yield '01'*50000,1
    yield '1'+'0'*99998+'1',0
add(337,'移动字符到末尾得到反转串的最少次数','每次从二进制串任意位置删除一个字符，并将它追加到末尾。目标是原串的反转，求最少操作次数。','输入一行二进制串。原界1≤长度≤100000。','设目标为原串反转，扫描原串，贪心匹配目标从开头起的尽可能长的前缀；答案是未匹配字符数。','从未移动的字符始终保持原有相对顺序，并位于最后被移动的字符之前。因此若执行t次，至少n−t个未移动字符构成目标的前缀，长度不超过最长可匹配前缀L，得到t≥n−L。反过来保留该前缀的原位置，按目标剩余后缀的次序把其他字符各移到末尾一次，即用n−L次完成。匹配前缀时总取最早可用字符，为后续留下最多位置，归纳得贪心求出L。','时间O(n)，空间O(n)存反转串。',['00110101','01','0110'],lambda r:''.join(r.choices('01',k=r.randint(1,8))),reverse_edges,line,reverse_oracle,
'''def solve(raw):
    s=raw.strip();target=s[::-1];matched=0
    for c in s:
        if matched<len(s) and c==target[matched]:matched+=1
    return str(len(s)-matched)
''',[('错误仅数对应位置不同','return str(len(s)-matched)','return str(sum(a!=b for a,b in zip(s,target)))'),('错误只能保留公共连续前缀','if matched<len(s) and c==target[matched]:matched+=1','if matched<len(s) and c==target[matched]:matched+=1\n        else:break')],100001)

def review_encode(x):return x[0]+'\n'+str(len(x[1]))+'\n'+'\n'.join(x[1])+'\n'
def review_oracle(x):
    text,words=x;text=text.lower()
    return max([0]+[j-i for i in range(len(text)) for j in range(i+1,len(text)+1) if all(w not in text[i:j] for w in words)])
def review_random(r):return ''.join(r.choices('aAbBcC',k=r.randint(1,15))),[''.join(r.choices('abc',k=r.randint(1,4))) for _ in range(r.randint(1,5))]
def review_edges():
    yield ('A'*100000,['a']),0
    yield ('a'*100000,['b'*i for i in range(1,11)]),100000
    yield ('a'*100000,['a'*10]),9
    yield ('AB'*50000,['aba','bab']),2
add(338,'不含禁用片段的最长评论长度','在评论中寻找不包含任何禁用词的最长连续子串；匹配忽略大小写，禁用词可出现在任意位置，并非仅匹配完整单词。没有非空合法子串时答案为0。','第一行review，第二行禁用词数，随后每行一个禁用词。原界review长1..100000，只含ASCII大小写字母；词数1..10，每词1..10个小写字母。','把评论转成小写。枚举右端，检查每个禁用词是否在此结束；若起点p命中，将窗口左端至少移到p+1，再统计长度。','合法窗口不能完整包含任何命中区间[p,r]，必须让左端大于p。维护全部历史命中的最大p+1，恰排除所有在当前右端之前结束的禁词，且任何更小左端都会包含某次禁词。故此窗口是每个右端的最长合法窗口，取最大覆盖全局最优。','时间O(n·词数·最长词长)，空间O(n)。',[('GoodProductButScrapAfterWash',['crap','odpro']),('Aa',['a']),('ExtremeValueForMoney',['tuper','douche'])],review_random,review_edges,review_encode,review_oracle,
'''def solve(raw):
    d=raw.split();s=d[0].lower();words=d[2:];left=answer=0
    for right in range(len(s)):
        for word in words:
            start=right-len(word)+1
            if start>=0 and s[start:right+1]==word:left=max(left,start+1)
        answer=max(answer,right-left+1)
    return str(answer)
''',[('错误大小写敏感','s=d[0].lower()','s=d[0]'),('左端少移一位','left=max(left,start+1)','left=max(left,start)')],100115,explanation='原首例正确最长片段为dProductButScra，长度15；来源另列的dProductButScu并非原串片段。其余公开例答案0、20。')

def rook_encode(a):return f'{len(a)} {len(a[0])}\n'+'\n'.join(seq(row) for row in a)+'\n'
def rook_oracle(a):
    rows,cols=len(a),len(a[0]);mask=sum(1<<(i*cols+j) for i in range(rows) for j in range(cols) if a[i][j])
    @lru_cache(None)
    def visit(state):
        best=state.bit_count()
        for p in range(rows*cols):
            if not state>>p&1:continue
            i,j=divmod(p,cols)
            for di,dj in ((1,0),(-1,0),(0,1),(0,-1)):
                x,y=i+di,j+dj
                while 0<=x<rows and 0<=y<cols:
                    if state>>(x*cols+y)&1:
                        best=min(best,visit(state^(1<<p)));break
                    x+=di;y+=dj
        return best
    return visit(mask)
def rook_random(r):return [[r.randrange(2) for _ in range(c)] for _ in range(r.randint(1,3))] if (c:=r.randint(1,3)) else None
def rook_edges():
    yield [[1]*1000 for _ in range(1000)],1
    yield [[0]*1000 for _ in range(1000)],0
    yield [[int(i==j) for j in range(1000)] for i in range(1000)],1000
    yield [[int(i//10==j//10) for j in range(1000)] for i in range(1000)],100
add(339,'只许吃子的车最后最少剩几枚','棋盘1表示车，0表示空位。车仅能沿同行或同列移动并吃掉遇到的另一枚车，不可越过其他车，也不能移到空格。不断吃子，求最终互不攻击时最少剩余数量。','第一行行数n、列数m，随后n行m个0或1。原界1≤n,m≤1000，允许全空棋盘。','行和列分别作为二分图顶点，每枚车为连接其所在行列的边。并查集合并全部有车的位置，统计有边的连通分量。','一次吃子相当于删除出发车的边，目标车位置继续存在，原连通分量不会与其他分量合并，也不可能把一个非空分量全部删光，故每个至少留一枚。反向构造：有环时删环上一条边仍连通；树有多条边时删叶边仍使剩余边连通。所删边都与某条保留边共用行或列，可让它吃该方向最近的车，棋盘上恰删除出发位置，符合不可越子规则。因此每个分量可逐步减至一枚，达到下界。','时间O(nm·α(n+m))，额外空间O(n+m)，参考按行读不保存全部车坐标。',[[[1,0,1],[1,0,0]],[[1,0,0],[0,1,0],[0,0,1]],[[0]]],rook_random,rook_edges,rook_encode,rook_oracle,
'''def solve(raw):
    import io
    stream=io.StringIO(raw);n,m=map(int,stream.readline().split());parent=list(range(n+m));size=[1]*(n+m);active=set()
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for i in range(n):
        for j,value in enumerate(stream.readline().split()):
            if value=='1':
                active.add(i);a,b=find(i),find(n+j)
                if a!=b:
                    if size[a]<size[b]:a,b=b,a
                    parent[b]=a;size[a]+=size[b]
    return str(len({find(i) for i in active}))
''',[('错误只数非空行','len({find(i) for i in active})','len(active)'),('错误空盘也算一个','return str(len({find(i) for i in active}))','return str(max(1,len({find(i) for i in active})))')],2000020)

def secondary_encode(x):return f'{len(x[1])} {x[0]}\n'+seq(x[1])+'\n'+seq(x[2])+'\n'
def secondary_oracle(x):
    limit,primary,secondary=x
    if any(v>limit for v in primary):return -1
    @lru_cache(None)
    def visit(day,used):
        if day==len(primary):return 0
        return max([visit(day+1,used)]+[1+visit(day+1,used|1<<j) for j,v in enumerate(secondary) if not used>>j&1 and v+primary[day]<=limit])
    return visit(0,0)
def secondary_edges():
    yield (10**9,[0]*100000,[10**9]*100000),100000
    yield (0,[0]*100000,[0]*100000),100000
    yield (10**9-1,[10**9]*100000,[0]*100000),-1
    yield (10**9,[10**9]*100000,[1]*100000),0
add(341,'每天一项主任务时最多安排的副任务','有n项主任务和n项副任务，须在n天中每天安排恰好一项主任务；每天至多再安排一项副任务，每项只能使用一次，当天总时长不超过limit。求最多副任务数。若有主任务本身超限，按本站无解输出约定返回−1。零时长也按总时长不超限判定。','第一行n limit，第二行n个primary，第三行n个secondary。原文未给数值界；本站1≤n≤100000，0≤limit及全部时长≤10^9。保留主任务超限输入，只补−1无解编码。','主任务对应剩余容量limit−primary，升序排序；副任务同样升序。逐个容量，如果最小未用副任务能放进去就配对，否则跳过该容量。','超限主任务必使整体无解。否则最小容量若放不下最小副任务，也放不下其余任务；若放得下，任意最优匹配可交换，让这两个最小可用者成对而不损失数量，因为被交换的更大容量仍容纳原来较大的副任务。因此每步可保持最优，最终匹配数最大。','时间O(n log n)，空间O(n)。',[(10,[1,9],[1,9]),(0,[0],[0]),(2,[3],[0])],lambda r:(r.randint(0,10),[r.randint(0,10) for _ in range(n)],[r.randint(0,10) for _ in range(n)]) if (n:=r.randint(1,7)) else None,secondary_edges,secondary_encode,secondary_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,limit=d[:2];primary=d[2:2+n];secondary=sorted(d[2+n:])
    if any(v>limit for v in primary):return '-1'
    answer=0
    for capacity in sorted(limit-v for v in primary):
        if answer<n and secondary[answer]<=capacity:answer+=1
    return str(answer)
''',[('错误从最大容量开始消耗最小副任务','sorted(limit-v for v in primary)','sorted((limit-v for v in primary),reverse=True)'),('错误排除恰好填满','secondary[answer]<=capacity','secondary[answer]<capacity')],2200030)

def circle_oracle(a):
    values=sorted(set(a));counts=tuple(a.count(v) for v in values);best=0
    for first in range(len(values)):
        initial=list(counts);initial[first]-=1
        @lru_cache(None)
        def visit(last,left):
            result=len(a)-sum(left) if abs(values[last]-values[first])<=1 else 0
            for j,v in enumerate(values):
                if left[j] and abs(v-values[last])<=1:
                    nxt=list(left);nxt[j]-=1;result=max(result,visit(j,tuple(nxt)))
            return result
        best=max(best,visit(first,tuple(initial)))
    return best
def circle_edges():
    yield [0]+[v for v in range(1,100000) for _ in range(2)]+[100000],200000
    yield list(range(200000)),2
    yield [-10**9]*100000+[10**9]*100000,100000
    yield [10**9]*200000,200000
add(342,'可重排成相邻差不超过1的最大服务器圆环','从整数数组删去若干元素，剩余元素可任意重排成圆环；每对相邻元素的差绝对值≤1，首尾也必须满足。求最多保留数量。相同值按出现次数使用，不能新增元素。','第一行n，第二行n个整数。原文没有数值界；本站1≤n≤200000，−10^9≤值≤10^9。','统计频数并按值排序。一个合法值区间必须连续，内部各值至少出现两次，端点至少一次。扫描右端；遇数值间隙重开，前一个值频数为1时令它成为左端，维护窗口频数和最大值。','若圆环包含最小值l与最大值r，沿圆环的两条路径都必须逐级经过每个严格中间值，故中间值至少两份且不能缺级。反过来用一份各级从l走到r，再用另一份内部各级走回l，额外同值可相邻插入，所以条件充分；仅一种值也合法。对于固定右端，所有不满足条件的较早左端必须排除，剩余最早左端包含最多元素。扫描枚举所有最优候选。','时间O(n log n)，空间O(n)。',[[4,3,5,1,2,1],[1,2,2,3],[5]],lambda r:[r.randint(-2,3) for _ in range(r.randint(1,8))],circle_edges,arr,circle_oracle,
'''def solve(raw):
    from collections import Counter
    counts=Counter(map(int,raw.split()[1:]));values=sorted(counts);prefix=[0];left=answer=0
    for i,v in enumerate(values):
        prefix.append(prefix[-1]+counts[v])
        if i and v!=values[i-1]+1:left=i
        elif i and counts[values[i-1]]==1:left=max(left,i-1)
        answer=max(answer,prefix[-1]-prefix[left])
    return str(answer)
''',[('错误只允许两个相邻不同值','prefix[-1]-prefix[left]','prefix[-1]-prefix[max(left,i-1)]'),('错误忽略内部单份瓶颈','elif i and counts[values[i-1]]==1:','elif False:')],2400030,explanation='三个答案为3、4、1。来源首例写4，但解释凭空多出一个2；按给定数组只能最多保留3个。第二例1,2,3,2确实构成长度4圆环。')

def similar_oracle(x):
    target,content=x;answer=0
    for start in range(len(content)-len(target)+1):
        word=content[start:start+len(target)];variants={word}
        for j in range(len(word)-1):variants.add(word[:j]+word[j+1]+word[j]+word[j+2:])
        answer+=target in variants
    return answer
def similar_rand(r):
    content=''.join(r.choices('abc',k=r.randint(1,15)));target=''.join(r.choices('abc',k=r.randint(1,len(content))));return target,content
def similar_edges():
    yield ('a','a'*50),50
    yield ('a'*50,'a'*50),1
    yield ('ab','ba'*25),49
    yield ('a'*49+'b','b'+'a'*49),0
add(343,'一次相邻交换可匹配的连续片段数','统计content中长度等于target的连续片段：允许不交换，或交换片段内一对相邻字符后与target相同。起点不同分别计数。','输入两行，依次target、content。原界均为小写字母，1≤|target|≤|content|≤50。','逐个窗口找不同位置；全相同则合法，否则必须恰有两个相邻不同位置，且其字符交换后交叉匹配。','一次相邻交换最多影响两个相邻位置。若窗口原来不等，合法交换必恰好修复那两个不同位置，交叉相等为充分必要条件；零个不同位置由不操作实现。枚举全部起点无遗漏。','时间O(|content|·|target|)，空间O(|target|)。',[('moon','monomon'),('aaa','aaaa'),('abc','acbabc')],similar_rand,similar_edges,lambda x:x[0]+'\n'+x[1]+'\n',similar_oracle,
'''def solve(raw):
    target,content=raw.split();m=len(target);answer=0
    for start in range(len(content)-m+1):
        word=content[start:start+m];bad=[i for i in range(m) if word[i]!=target[i]]
        if not bad:answer+=1
        elif len(bad)==2:
            i,j=bad
            if j==i+1 and word[i]==target[j] and word[j]==target[i]:answer+=1
    return str(answer)
''',[('错误允许非相邻交换','j==i+1 and word[i]','word[i]'),('漏掉无需交换的窗口','if not bad:answer+=1','if not bad:answer+=0')],102,explanation='首例合法窗口是起点0的mono和起点3的omon，分别交换最后两位、最前两位；答案2。来源解释的onom不是相应窗口。')

def frequency_oracle(a):
    out=[]
    for v in a:
        key=(a.count(v),v);i=0
        while i<len(out) and (a.count(out[i]),out[i])<=key:i+=1
        out.insert(i,v)
    return seq(out)
def frequency_edges():
    yield [-10**9]*200000,seq([-10**9]*200000)
    yield list(range(200000,0,-1)),seq(range(1,200001))
    yield [0]*100000+[-1]*99999+[1],seq([1]+[-1]*99999+[0]*100000)
    yield [],''
add(344,'按频数再按数值升序排列错误码','保留数组中的全部元素，优先按总出现次数升序，同频数按数值升序；重复值不能去重。','第一行n，第二行n个整数。原文只有排序规则、无数值界；本站0≤n≤200000，元素−10^9..10^9。','统计频数，以(频数,数值)排序所有不同值，按原频数展开。','每个值的全部副本排序键相同，统计不会混淆其次数；排序键严格对应两级优先级，展开又恰保留原多重集，因此得到目标顺序。','时间O(n log n)，空间O(n)。',[[4,5,6,5,4,3],[2,2,1,1,1,3],[]],lambda r:[r.randint(-5,5) for _ in range(r.randint(0,18))],frequency_edges,arr,frequency_oracle,
'''def solve(raw):
    from collections import Counter
    counts=Counter(map(int,raw.split()[1:]));out=[]
    for v in sorted(counts,key=lambda v:(counts[v],v)):out.extend([str(v)]*counts[v])
    return ' '.join(out)
''',[('错误同频数降序','(counts[v],v)','(counts[v],-v)'),('错误丢弃重复','out.extend([str(v)]*counts[v])','out.append(str(v))')],2400010,output='按目标顺序输出n个整数，以空格分隔；n=0时输出空行。')

def product_oracle(x):
    order,codes=x
    def less(a,b):
        for ac,bc in zip(a,b):
            if ac!=bc:return order.index(ac)<order.index(bc)
        return len(a)<len(b)
    out=[]
    for word in codes:
        pos=0
        while pos<len(out) and not less(word,out[pos]):pos+=1
        out.insert(pos,word)
    return compact(out)
def product_random(r):
    chars=list('aA0 😀\0\n\\"é');r.shuffle(chars);order=''.join(chars);return order,[''.join(r.choices(order,k=r.randint(0,8))) for _ in range(r.randint(1,12))]
def product_edges():
    # Full 256-symbol alphabet, one million non-BMP scalar characters.
    order=''.join(chr(0x10000+i) for i in range(256));codes=[order[-1]*10]*99999+[order[0]*10]
    yield (order,codes),compact([order[0]*10]+[order[-1]*10]*99999)
    yield ('\0a',['\0'*10]*100000),compact(['\0'*10]*100000)
    yield ('a',['']*100000),compact(['']*100000)
    yield ('😀 \nAa',[ 'A','😀',' ','\n','', 'Aa','A']),compact(['','😀',' ','\n','A','A','Aa'])
add(345,'按自定义Unicode字符顺序排列商品编码','order按从小到大列出字符顺序。比较两个商品编码时看第一个不同字符；若一个为另一个前缀，则较短者更小。保留重复编码，返回排序结果。字符按Unicode码点计，不按UTF-16代理单元计。','输入一个JSON数组[order,productCodes]，可含标准JSON空白和转义。原约束截断，未提供完整数量/字符域；本站order含1..256个互异Unicode标量值，1≤编码数≤100000，全部编码总长度≤1000000码点。编码可空，所有字符均出现在order中；保留空格、控制符、NUL和非BMP字符，不允许孤立代理项。UTF-8输入总预算16MiB（标准紧凑最坏少于12303100字节）。','建立字符到0..255的顺序映射，把每个字符串变成同长字节排序键，按字节串字典序排序原字符串。','映射严格保留order顺序，且每个原字符对应恰一个字节。首个不同码点的比较与首个不同字节完全一致；键长等于码点数，也保留前缀短者优先。因此键排序与目标次序等价，返回原串保留全部字符与重复。','设总码点数M、编码数n、最大编码长度L。构键O(M)，比较排序最坏O(M+nL log n)，空间O(M+n)。',[('abcdefghijklmnopqrstuvwxyz',['adc','abc']),('ba',['a','b','ba','b','']),('😀\0 a',['a',' ','\0','😀','😀a',''])],product_random,product_edges,json_input,product_oracle,
'''def solve(raw):
    import json
    order,codes=json.loads(raw);rank={c:i for i,c in enumerate(order)}
    codes.sort(key=lambda word:bytes(rank[c] for c in word))
    return json.dumps(codes,ensure_ascii=True,separators=(',',':'))
''',[('错误使用默认Unicode顺序','codes.sort(key=lambda word:bytes(rank[c] for c in word))','codes.sort()'),('错误去掉重复编码','json.dumps(codes,ensure_ascii=True','json.dumps(list(dict.fromkeys(codes)),ensure_ascii=True')],16777216,checker='exact',outputLimit=16384,timeLimit=10,output='输出规范的紧凑ASCII JSON字符串数组，元素间仅逗号，无额外结构空白。引号、反斜杠用\\"、\\\\；退格/制表/换行/换页/回车用\\b/\\t/\\n/\\f/\\r，其余U+0000..001F及全部U+007F以上码点用小写十六进制\\uXXXX，非BMP拆为UTF-16代理对；U+0020..007E除引号反斜杠外直接输出，包括空格和/。行尾一个换行。该输出约定仅规范编码，不删除任何字符。')

def split_oracle(x):
    s,k=x;return sum(len(set(s[:i])&set(s[i:]))>k for i in range(1,len(s)))
def split_edges():
    yield ('a'*100000,0),99999
    yield ('a'*100000,1),0
    yield ('abcdefghijklmnopqrstuvwxyz'*3846+'abcd',25),99949
    yield ('abcdefghijklmnopqrstuvwxyz'*3846+'abcd',26),0
add(346,'前后缀公共不同字母数严格超阈值的切法','把整个字符串切成两个非空连续部分，要求两部分都出现的不同字母种数严格大于k。求合法切分位置数，不是统计公共字符的重复次数。','输入字符串和k，以空白分隔。原界小写字母串长度1..100000，0≤k≤26。','维护左右26个频数及同时出现的字母数。每次把一个字符从右移左，先扣除其旧交集贡献，再加入新贡献；只检查前n−1个切口。','移动一个字符只改变该字母在左右的出现状态，其他字母的交集贡献不变，因此维护值始终等于两个部分字符集合交集大小。每个非空切口恰检查一次，严格比较>k给出准确计数。','时间O(n)，空间O(26)。',[('abbcac',1),('a',0),('aaaa',1)],lambda r:(''.join(r.choices('abcd',k=r.randint(1,18))),r.randint(0,5)),split_edges,lambda x:x[0]+'\n'+str(x[1])+'\n',split_oracle,
'''def solve(raw):
    s,k=raw.split();k=int(k);left=[0]*26;right=[0]*26;common=answer=0
    for c in s:right[ord(c)-97]+=1
    for c in s[:-1]:
        i=ord(c)-97;common-=int(left[i]>0 and right[i]>0);left[i]+=1;right[i]-=1;common+=int(left[i]>0 and right[i]>0)
        if common>k:answer+=1
    return str(answer)
''',[('错误把严格大于改成至少','if common>k:','if common>=k:'),('错误只检查有无公共字母','if common>k:','if common>0:')],100006)

def query_encode(x):return f'{len(x[0])} {len(x[1])}\n'+seq(x[0])+'\n'+''.join(f'{a} {b}\n' for a,b in x[1])
def update_oracle(x):
    a,queries=x;a=list(a);out=[]
    for old,new in queries:a=[new if v==old else v for v in a];out.append(str(sum(a)))
    return '\n'.join(out)
def update_edges():
    yield ([-10**9]*200000,[(10**9,10**9)]*200000),'\n'.join(['-200000000000000']*200000)
    yield ([0]*200000,[(i,i+1) for i in range(200000)]),'\n'.join(str(200000*(i+1)) for i in range(200000))
    yield ([],[(-10**9,10**9)]*200000),'\n'.join(['0']*200000)
    yield ([10**9]*200000,[]),''
add(347,'全部同值替换后逐次报告总和','每个查询old new把当前数组中所有等于old的元素替换为new，并输出修改后的总和。查询连续生效；old=new或old当前不存在时不改变数组。','第一行n q，第二行n个整数，随后q行old new。原文没有数值界；本站0≤n,q≤200000，数组和查询值均在−10^9..10^9。','用频数表与当前总和。old≠new时取出old频数c，将总和增加(new−old)c，再把c合并到new频数；相同值直接保留状态。','每次恰有c项改变，每项总和变化new−old，故总和更新精确。频数从old全部移到new，其他值不变，因此频数表仍与当前数组一致。归纳所有查询及不存在旧值的零变化均正确。','期望时间O(n+q)，空间O(n+q)。',[([1,1,2],[(1,2),(2,2),(2,-1)]),([0],[(3,4),(0,0),(0,2)]),([],[])],lambda r:([r.randint(-3,3) for _ in range(r.randint(0,10))],[(r.randint(-3,3),r.randint(-3,3)) for _ in range(r.randint(0,10))]),update_edges,query_encode,update_oracle,
'''def solve(raw):
    from collections import Counter
    d=list(map(int,raw.split()));n,q=d[:2];counts=Counter(d[2:2+n]);total=sum(d[2:2+n]);out=[]
    for old,new in zip(d[2+n::2],d[3+n::2]):
        if old!=new:
            c=counts.pop(old,0);total+=(new-old)*c;counts[new]+=c
        out.append(str(total))
    return '\\n'.join(out)
''',[('错误只替换一项','total+=(new-old)*c','total+=(new-old)*int(c>0)'),('错误覆盖目标已有频数','counts[new]+=c','counts[new]=c')],7200040,output='按查询顺序每行输出一次修改后的总和，共q行；q=0输出空行。')

def decrease_encode(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def decrease_oracle(x):
    a,t=x;a=list(a);answer=0
    for _ in range(t):
        high=max(a);answer+=high+min(a);a[a.index(high)]-=1
    return answer
def equal_decrease_expected(n,v,t):
    # Independent closed form from post-step total/max/min periodicity.
    # Sum floor(j/n) and count nonzero residues among j=0..t-1.
    q,r=divmod(t,n);floors=n*q*(q-1)//2+q*r;nonmultiples=t-(q+int(r>0))
    return 2*v*t-2*floors-nonmultiples
def decrease_edges():
    yield ([10**9],10**12),2*10**9*10**12-10**12*(10**12-1)
    yield ([-10**9]*200000,10**12),equal_decrease_expected(200000,-10**9,10**12)
    # Wide plateau never reaches bottom: max+min is -j in round j.
    count=199999;t=10**12;q,r=divmod(t,count)
    yield ([10**9]*count+[-10**9],t),-(count*q*(q-1)//2+r*q)
    yield ([0]*200000,0),0
def decrease_boundaries():
    yield from decrease_edges()
    for n in (1,2,3,4):
        for t in (n-1,n,n+1,3*n+1):
            case=([-2]*n,t);yield case,decrease_oracle(case)
add(348,'逐次累加最大最小值并降低最大值','恰好做requests次操作：先把当前最大值与最小值之和计入答案，再将其中一个当前最大值减1。求最终精确整数总和。原数组及操作后的值都可以为负数；并列最大任选一个不影响后续多重集。','第一行n requests，第二行n个整数。来源仅给requests≥0、整数数组及使用足够宽整数；本站1≤n≤200000、初始值−10^9..10^9、0≤requests≤10^12。答案不取模，可能超出64位有符号范围。','从高到低合并相同高度。当前顶部c项在高度h，下一高度l，至多批量处理c(h−l)次；除全部相等后的阶段外最小值固定。用整轮与余数的等差和累加最大值。全部相等时，单独计入每轮第一步后最小值下降的影响。','到下一层前，每c次使全部顶部降低1，其他元素不变，因而q整轮和r次的最大值和为c·q(2h−q+1)/2+r(h−q)。此前最小值恒为初始最小值m，另加m倍操作数。全部n项同为v时，一轮第一步贡献2v，余下n−1步为2v−1；q整轮贡献2n[qv−q(q−1)/2]−q(n−1)。剩r>0步贡献2r(v−q)−(r−1)。逐层与尾部恰分割所有操作，含n=1、负数和跨越原最小值的情形。','时间O(n log n)，空间O(n)，使用任意精度整数或足够宽整数。',[([1,2],2),([-1,-1],5),([3,3,3],1)],lambda r:([r.randint(-5,5) for _ in range(r.randint(1,8))],r.randint(0,60)),decrease_boundaries,decrease_encode,decrease_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,remaining=d[:2];a=sorted(d[2:],reverse=True);minimum=a[-1];answer=0;h=a[0]
    for count in range(1,n):
        lower=a[count];take=min(remaining,count*(h-lower));q,r=divmod(take,count)
        answer+=count*q*(2*h-q+1)//2+r*(h-q)+minimum*take;remaining-=take
        if remaining==0:return str(answer)
        h=lower
    q,r=divmod(remaining,n)
    answer+=2*n*(q*h-q*(q-1)//2)-q*(n-1)
    if r:answer+=2*r*(h-q)-(r-1)
    return str(answer)
''',[('错误全部相等后最小值不在首步后下降','-q*(n-1)','-0'),('错误尾部不足一轮忽略最小值下降','-(r-1)','-0')],2400040)

def quotient_oracle(n):return sum({n//k for k in range(1,n+2)})
def quotient_sqrt(n):
    root=isqrt(n)
    return root*(root+1)//2+sum(n//i for i in range(1,root+1))-(root if root and n//root==root else 0)
def quotient_edges():
    for n in (10**12,10**12-1,999999000000,0):yield n,quotient_sqrt(n)
add(349,'所有不同整除商的和','给定n，若存在正整数k使floor(n/k)=x，则x属于依赖编号集合。求该集合全部不同x之和，每个值只计一次，0也属于集合但贡献0。','输入整数n。来源未给数值界；本站0≤n≤10^12。','从k=1开始，当前商q=n//k相同的最后除数为n//q；累加一次q，然后跳到该区间之后。','整除商随k不增，商q的连续区间终点满足floor(n/k)=q的最大k=n//q。跳过整段只累加一次，不遗漏其他正商；k>n后均为0不必枚举。因此精确得到不同商之和。小除数≤√n只有√n个，大除数对应商≤√n也至多√n种。','时间O(√n)，额外空间O(1)。',[5,0,16],lambda r:r.randint(0,300),quotient_edges,line,quotient_oracle,
'''def solve(raw):
    n=int(raw);k=1;answer=0
    while k<=n:
        q=n//k;answer+=q;k=n//q+1
    return str(answer)
''',[('错误按商出现次数重复累加','answer+=q','answer+=q*(n//q-k+1)'),('错误漏掉n本身','k=1;answer=0','k=2;answer=0')],14,timeLimit=10)

def weighted_max_oracle(a):return sum(max(a[i:j])*(j-i) for i in range(len(a)) for j in range(i+1,len(a)+1))
def weighted_max_edges():
    n=200000;total=n*(n+1)*(n+2)//6
    yield [10**9]*n,10**9*total
    yield [-10**9]*n,-10**9*total
    # Increasing array: right endpoint j is maximum; lengths 1..j sum j(j+1)/2.
    yield list(range(1,n+1)),sum(j*j*(j+1)//2 for j in range(1,n+1))
    yield [],0
add(350,'所有子数组的最大值乘长度之和','每个非空连续子数组贡献其最大值乘以长度，求全部贡献之和。允许负数，答案精确输出、不取模；要求线性算法。','第一行n，第二行n个整数。来源没有数值界；本站0≤n≤200000，元素−10^9..10^9。','单调栈为每个元素找到左边严格更大、右边大于等于的位置，令到边界距离为L、R。它负责L·R个子数组，长度总和为L·R·(L+R)/2，乘本元素累加。','每段由其中最靠右的最大元素负责。左界不能跨越严格更大者，右界不能包含下一个相等或更大者，恰好给出唯一归属，既不漏计也不重计。左延伸选择1..L、右延伸1..R时长度为l+r−1，双重求和等于LR(L+R)/2。单调栈中每个位置只入栈出栈一次。','时间O(n)，空间O(n)，总和可能超64位。',[[4,2,1,2],[-3,-1,-1],[]],lambda r:[r.randint(-8,8) for _ in range(r.randint(0,12))],weighted_max_edges,arr,weighted_max_oracle,
'''def solve(raw):
    a=list(map(int,raw.split()[1:]));stack=[];answer=0;n=len(a)
    for i in range(n+1):
        while stack and (i==n or a[stack[-1]]<=a[i]):
            j=stack.pop();left=j-(stack[-1] if stack else -1);right=i-j
            answer+=a[j]*left*right*(left+right)//2
        stack.append(i)
    return str(answer)
''',[('错误只加最大值不乘长度','a[j]*left*right*(left+right)//2','a[j]*left*right'),('错误把负最大值当0','answer+=a[j]*','answer+=max(0,a[j])*')],2400010)

def scheduler_oracle(x):
    tasks,cool=x;letters=sorted(set(tasks));start=(tuple(tasks.count(c) for c in letters),(0,)*len(letters));queue=deque([(start,0)]);seen={start}
    while queue:
        (counts,waits),distance=queue.popleft()
        if not any(counts):return distance
        choices=[i for i in range(len(counts)) if counts[i] and waits[i]==0]
        if any(waits):choices.append(-1)
        for i in choices:
            new=list(counts);wait=[max(0,v-1) for v in waits]
            if i>=0:new[i]-=1;wait[i]=cool
            state=tuple(new),tuple(wait)
            if state not in seen:seen.add(state);queue.append((state,distance+1))
def scheduler_edges():
    yield ('A'*10000,100),1009900
    yield ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'*384+'ABCDEFGHIJKLMNOP',0),10000
    yield ('AB'*5000,100),504901
    yield ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'*384+'ABCDEFGHIJKLMNOP',100),38800
add(351,'带相同任务冷却间隔的最短排程','每个时隙执行一项任务或空闲，可重排所有任务；两次相同字母任务之间至少隔cooldown个其他时隙。求全部完成最短时隙数。','第一行任务字符串，第二行cooldown。原界任务数1..10000，字母A..Z，0≤cooldown≤100。原页混入的合并区间介绍与本题无关，不作为任务规则。','记最高频数f及达到f的字母种数c，答案max(任务总数,(f−1)(cooldown+1)+c)。','任务总数是必要下界。选频数f的c种任务，任意两轮同字母必须间隔cooldown+1，最后一轮至少c个位置，得到第二下界。以最高频任务构造f−1个长度至少cooldown+1的块及最后c项，将其余各类均匀放入前面块的空位；因其频数不超过f，能避免同块重复。空位不足时扩大块、不再空闲，全部任务可连续铺满；空位足够时补空闲。因此总长度正好为两个下界的最大值。','时间O(n+26)，空间O(26)。',[('AAABBB',2),('ACABDB',1),('AAABBB',3)],lambda r:(''.join(r.choices('ABC',k=r.randint(1,7))),r.randint(0,3)),scheduler_edges,lambda x:x[0]+'\n'+str(x[1])+'\n',scheduler_oracle,
'''def solve(raw):
    from collections import Counter
    tasks,cool=raw.split();cool=int(cool);freq=Counter(tasks);f=max(freq.values());c=sum(v==f for v in freq.values())
    return str(max(len(tasks),(f-1)*(cool+1)+c))
''',[('错误忽略多个最高频种类','(cool+1)+c','(cool+1)+1'),('错误把冷却当相同任务间距','(cool+1)','cool')],100006)

def rewards_encode(x):return f'{len(x[0])} {x[2]}\n'+x[0]+'\n'+seq(x[1])+'\n'
def rewards_oracle(x):
    s,a,k=x;best=0
    for mask in range(1<<len(s)):
        last=None;run=score=0;valid=True
        for i,c in enumerate(s):
            if mask>>i&1:
                run=run+1 if c==last else 1;last=c;score+=a[i]
                if run>k:valid=False;break
        if valid:best=max(best,score)
    return best
def rewards_edges():
    yield ('A'*2000,[10**9]*2000,10**9),2000000000000
    yield ('A'*2000,[10**9]*2000,1000),1000000000000
    yield ('AB'*1000,[10**9,-1]*1000,1),1000000000000-999
    yield ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'*76+'ABCDEFGHIJKLMNOPQRSTUVWX',[-10**9]*2000,10**9),0
    yield ('A'*2000,[10**9]*2000,0),0
add(352,'可跳过交易且限制连续同类次数的最大收益','交易顺序固定，每项类型A..Z、收益为整数，可跳过任意项。实际选中的序列里相同类型连续次数不得超过k，最大化收益；允许全部不选，收益为0。负收益项也可能作为分隔有价值，不能一律删除。','第一行n k，第二行n个交易类型连成的字符串，第三行n个收益；n=0时后两行为空。来源未给数值界及收益正数保证；本站0≤n≤2000，−10^9≤收益≤10^9，0≤k≤10^9。','dp[c][r]存已处理前缀中以c连续r次结束的最佳收益。遇类型c收益v时，保留跳过状态；其他类型结尾的最佳收益或空序列可接成r=1，同类r−1可接成r。r降序更新，不能在同一轮复用本项。','任意合法非空选中序列有唯一末类型和末尾连续次数。选择当前项时，前一选中项或不存在、或为不同类型，此时新连续次数为1；或为同类型且次数少1。这些互斥情形恰为全部转移，跳过维持旧状态。读旧的其他类型最优值并降序更新同类型，保证每个原项最多使用一次。由前缀归纳所有合法子序列都被覆盖，取0及全部状态最大即最优，负分分隔亦保留。','时间O(n·min(n,k)+26n)，空间O(26·min(n,k))。',[('BAAAB',[1,4,2,10,3],2),('ABA',[100,-1,100],1),('ABA',[10,-100,10],1)],lambda r:(''.join(r.choices('ABC',k=n)),[r.randint(-9,12) for _ in range(n)],r.randint(0,5)) if (n:=r.randint(0,11))>=0 else None,rewards_edges,rewards_encode,rewards_oracle,
'''def solve(raw):
    lines=raw.splitlines();n,k=map(int,lines[0].split());s=lines[1] if n else '';rewards=list(map(int,' '.join(lines[2:]).split()));k=min(k,n)
    if not k:return '0'
    negative=-10**30;dp=[[negative]*(k+1) for _ in range(26)];best=[negative]*26
    for c,value in zip(s,rewards):
        index=ord(c)-65;other=max([0]+[best[j] for j in range(26) if j!=index]);row=dp[index]
        for run in range(k,1,-1):row[run]=max(row[run],row[run-1]+value)
        row[1]=max(row[1],other+value);best[index]=max(row)
    return str(max(0,max(best)))
''',[('错误跳过全部非正收益','index=ord(c)-65;other=', 'if value<=0:continue\n        index=ord(c)-65;other='),('错误升序更新复用同一交易','range(k,1,-1)','range(2,k+1)')],30050,timeLimit=10)

def pairs_encode(x):return f'{len(x[0])} {x[1]}\n'+seq(x[0])+'\n'
def pairs_oracle(x):
    a,target=x;answer=sorted({tuple(sorted((a[i],a[j]))) for i in range(len(a)) for j in range(i+1,len(a)) if a[i]+a[j]==target})
    return '\n'.join(f'{a},{b}' for a,b in answer) if answer else 'None'
def pairs_edges():
    yield (list(range(-100000,0))+list(range(1,100001)),0),'\n'.join(f'{a},{-a}' for a in range(-100000,0))
    yield ([10**9]*200000,-10**9),'None'
    yield ([-500000000]*200000,-10**9),'-500000000,-500000000'
    yield ([],0),'None'
add(354,'按数值字典序输出所有不同目标和数对','选两个不同下标，其数值和等于target；将每对内部按数值升序，仅输出不同的值对，再按第一项、第二项的数值升序排序。相同值配对需要至少两次出现，输入重复不产生重复输出。','第一行n target，第二行n个整数。来源未给数值界；本站0≤n≤200000，元素与target均−10^9..10^9。','排序后双指针，小于目标则左移进，大于目标则右退；相等记录数对并跳过两端全部重复值。','固定左值时若当前和小于目标，与更小右值仍不可能达标，故安全舍弃左端；大于目标对称。相等时该值对已全部表示，跳过重复只消除重复输出，保留所有不同值对。左右下标始终不同保证不能重复使用单个元素，左值递增自然给出数值字典序。','时间O(n log n)，空间O(n)。',[([1,4,2,3,3,2,0,5],5),([1,2,3,4],10),([2,2,2],4)],lambda r:([r.randint(-8,8) for _ in range(r.randint(0,15))],r.randint(-10,10)),pairs_edges,pairs_encode,pairs_oracle,
'''def solve(raw):
    d=list(map(int,raw.split()));n,target=d[:2];a=sorted(d[2:]);l=0;r=n-1;out=[]
    while l<r:
        value=a[l]+a[r]
        if value<target:l+=1
        elif value>target:r-=1
        else:
            low,high=a[l],a[r];out.append(f'{low},{high}')
            while l<r and a[l]==low:l+=1
            while l<r and a[r]==high:r-=1
    return '\\n'.join(out) if out else 'None'
''',[('错误丢弃相同值合法数对',"out.append(f'{low},{high}')","out.extend([f'{low},{high}'] if low!=high else [])"),('错误按文本而非数值排序',"'\\n'.join(out)","'\\n'.join(sorted(out))")],2400040,output='每个不同值对输出一行a,b（无括号、无空格），数值字典序升序；无答案输出一行None。')

def warehouse_oracle(x):
    a,queries=x;return '\n'.join(str(min(max(0,need-v)+max(0,backup-sum(a[:i]+a[i+1:])) for i,v in enumerate(a))) for need,backup in queries)
def warehouse_edges():
    yield ([10**9]*100000,[(10**9,10**15)]*100000),'\n'.join(['900001000000000']*100000)
    yield ([1]*100000,[(10**9,10**15)]*100000),'\n'.join([str(10**9-1+10**15-99999)]*100000)
    yield (list(range(1,100001)),[(i,1) for i in range(1,100001)]),'\n'.join(['0']*100000)
    yield ([1,10**9],[(1,10**15),(10**9,1)]),f'{10**15-10**9}\n0'
add(355,'每次仓储请求的最少扩容代币','每次请求a b选择一个仓库，要求它容量至少a，其余仓库容量总和至少b；花1代币可把任一仓库容量增加1。选中仓库的富余容量不能用于备份。每次请求独立，从原始容量重新计算，返回最小代币数。','第一行n q，第二行n个仓库容量，随后q行a b。原完整界2≤n≤100000，1≤q≤100000，容量与a在1..10^9，b在1..10^15。','排序容量并求总和S。固定选择w时费用max(0,a−w)+max(0,b−(S−w))。二分第一个w≥a，仅比较它和前一个容量。','当w<a时第一项斜率−1，第二项斜率0或1，总费用随w不增；当w≥a时第一项0、第二项随w不减。因此a以下只需最大容量，a以上只需最小容量。二分邻居涵盖两个区域最优，取最小得整体最优；查询互不修改S或容量。','时间O(n log n+q log n)，空间O(n+q)。',[([2,4,1,3],[(5,7)]),([5,1,1,4],[(5,7),(4,10),(7,9)]),([1,10,20],[(1,30)])],lambda r:([r.randint(1,20) for _ in range(r.randint(2,9))],[(r.randint(1,25),r.randint(1,80)) for _ in range(r.randint(1,8))]),warehouse_edges,query_encode,warehouse_oracle,
'''def solve(raw):
    from bisect import bisect_left
    d=list(map(int,raw.split()));n,q=d[:2];a=sorted(d[2:2+n]);total=sum(a);out=[]
    for need,backup in zip(d[2+n::2],d[3+n::2]):
        p=bisect_left(a,need);answer=10**30
        for i in (p-1,p):
            if 0<=i<n:
                w=a[i];answer=min(answer,max(0,need-w)+max(0,backup-(total-w)))
        out.append(str(answer))
    return '\\n'.join(out)
''',[('错误只比较最大两个仓库','for i in (p-1,p):','for i in (n-2,n-1):'),('错误选中仓库也能算备份','backup-(total-w)','backup-total')],3900040,output='按请求顺序每行输出最少代币数，共q行。',explanation='三个公开输入对应输出2；1、3、5；0。来源第一例输出仍为TO-DO，依据逐仓费用独立补为2。')

BLOCKED={336:'核心API规则表为缺失本机图片；重复注册、未知用户及未登录注销等状态转移和精确文案无法恢复。',340:'原文真实截断于servers, wh，仅单例且解释声明未知，无法恢复调度规则。',353:'未保证查询节点不同，未定义节点与自身、尤其根与自身的关系；不擅加不同节点保证或父节点哨兵规则。'}
SLUGS=['return-records','reverse-binary-string','review-score','rooks-left','schedule-requests-to-servers','maximize-secondary-tasks-scheduled','server-selection','similar-text-substring-count','sort-error-codes-by-frequency','sort-product-codes','split-prefix-suffix','sum-after-query-update','sum-max-plus-min-after-decrement-operations','sum-of-all-days-numbers-on-which-the-data-of-the-xth-will-be-dependent','sum-of-max-subarrays','task-scheduler','trader-joe-trades','tree-node-relationship','unique-pairs-with-target-sum','use-minimum-tokens']
def code_for(s):return s['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
def equal(a,b,s):return a.rstrip('\n')==b.rstrip('\n') if s.get('checker')=='exact' else a.split()==b.split()
def small_check():
    for s in sorted(SPECS,key=lambda v:v['n']):
        rng=random.Random(SEED+s['n']);values=s['samples']+[s['rnd'](rng) for _ in range(160)];scope={};exec(s['code'],scope)
        cases=[(s['encode'](v),str(s['oracle'](v))) for v in values]
        for raw,expected in cases:
            actual=scope['solve'](raw);assert equal(actual,expected,s),(s['n'],raw,actual,expected)
        for name,old,new in s['mutants']:
            assert old in s['code'],(s['n'],name);mut={};exec(s['code'].replace(old,new),mut)
            outputs=[mut['solve'](raw) for raw,expected in cases]
            assert any(not equal(actual,expected,s) for actual,(_,expected) in zip(outputs,cases)),(s['n'],name,'survived')
        print(s['n'],'163 independent oracle cases; 2 normal-return WA rejected',flush=True)
def execute(path,inputs):
    start=time.monotonic();p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs,ensure_ascii=False),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);out=json.loads(p.stdout);assert len(out)==len(inputs)
    return out,time.monotonic()-start
def main():
    if '--small' in sys.argv:small_check();return
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={s['id']:s for s in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};entries=[];reports=[];selected=set(map(int,sys.argv[1:]))
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'];reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems']
    for s in sorted(SPECS,key=lambda v:v['n']):
        number=s['n'];ident=f'oa-amazon-{number}'
        if selected and number not in selected:continue
        assert ident in sources,ident
        entries=[x for x in entries if x['id']!=ident];reports=[x for x in reports if x['id']!=ident];rng=random.Random(SEED+number)
        code=code_for(s);path=OUT/'references'/f'{ident}.py';path.write_text(code)
        values=s['samples']+[s['rnd'](rng) for _ in range(160)];oracles=[dict(input=s['encode'](v),expectedOutput=str(s['oracle'](v))+'\n') for v in values]
        boundary=[dict(input=s['encode'](v),expectedOutput=str(a)+'\n') for v,a in s['edges']()];tests=oracles[:3]+boundary+oracles[3:27];assert 31<=len(tests)<=64
        for c in oracles+tests:
            assert len(c['input'].encode())<=s['bound']<=32*1024*1024,(ident,len(c['input'].encode()),s['bound'])
            assert len(c['expectedOutput'].encode())<=s.get('outputLimit',4096)*1024
        actual,elapsed=execute(path,[c['input'] for c in oracles+tests])
        for i,(a,c) in enumerate(zip(actual,oracles+tests)):assert equal(a,c['expectedOutput'],s),(ident,i,a[:200],c['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1) for i,c in enumerate(tests)];mutants=[];controls=[]
        for j,(name,old,new) in enumerate(s['mutants'],1):
            assert old in code,(ident,name);changed=code.replace(old,new);p=OUT/'negative-controls'/f'{ident}-{j}.py';p.write_text(changed)
            outputs,_=execute(p,[c['input'] for c in tests]);rejected=[i for i,(a,c) in enumerate(zip(outputs,tests)) if not equal(a,c['expectedOutput'],s)];assert rejected,(ident,name)
            mutants.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        explanation=s.get('explanation','三个公开样例的输出依次为：'+'；'.join(c['expectedOutput'].strip().replace('\n',' / ') or '空行' for c in oracles[:3])+'。独立枚举或直接模拟已核对。')
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=s['title'],difficulty='中等',tags=['OA','Amazon'],description=s['desc']+'\n\n本站独立编写标准I/O、题解与测试；缺失原界及样例纠错均在题面明示。',input=s['limits'],output=s.get('output','输出一个整数答案。'),explanation=explanation,hints=[s['idea']],timeLimit=s.get('timeLimit',6),memoryLimit=262144,outputLimit=s.get('outputLimit',4096),checker=s.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=768','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(ident,p.stderr[:2000]);normalized=p.stdout;assert len(normalized.encode())<=128*1024*1024,(ident,'package too large')
        editorial=f"## 思路\n\n{s['idea']}\n\n## 正确性证明\n\n{s['proof']}\n\n## 复杂度\n\n{s['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=ident,title=s['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[ident]['sourceUrl'],sourceContentHash=sources[ident]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{ident}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        assert (OUT/'packages'/f'{ident}.json').stat().st_size<=128*1024*1024
        entries.append(dict(id=ident,sourceContentHash=sources[ident]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=ident,oracleCases=163,publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),localBatchSeconds=round(elapsed,3),maxLegalInputBytesUpperBound=s['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in tests),maxTestOutputBytes=max(len(c['expectedOutput'].encode()) for c in tests)))
        print(ident,'163 oracle;',len(cases)-3,'hidden; 2 normal-exit WA rejected;',round(elapsed,3),'seconds',flush=True)
        entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
        for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Authored reference batched subprocess only; production sandbox required.')}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        del actual,outputs,cases,tests,boundary,oracles,normalized,p
    snapshot=Path('/tmp/cswork-oa-source-20260919');reviews=[]
    for number in range(336,356):
        ident=f'oa-amazon-{number}';relative='fastprep/Amazon/amazon-'+SLUGS[number-336]+'.md';raw=(snapshot/relative).read_bytes();reason=BLOCKED[number] if number in BLOCKED else next(s['desc'] for s in SPECS if s['n']==number)
        reviews.append(dict(id=ident,status='blocked' if number in BLOCKED else 'authored',reason=reason,sourceCommit='e66f809f4c953bce129f68491726176615db6afc',rawPath=relative,rawGitBlob=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=sources[ident]['contentHash']))
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
