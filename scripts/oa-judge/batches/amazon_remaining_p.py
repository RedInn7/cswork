"""Original Amazon316–335, 15 authored; 321/322/327/332/333 held.
Large boundary fixtures are lazy. Only coordinated remote runs call main().
"""
from collections import deque, Counter
from functools import lru_cache
from itertools import combinations, product
from pathlib import Path
import hashlib,json
import amazon_remaining_h as base
base.SPECS=[];base.BATCH='amazon-remaining-p';base.SEED=20263160
add=base.add;arr=base.arr
def seq(a):return ' '.join(map(str,a))
def compact(x):return json.dumps(x,ensure_ascii=True,separators=(',',':')).replace(' ','\\u0020')
def json_encode(x):return compact(x)+'\n'
def intervals_encode(a):return str(len(a))+'\n'+''.join(f'{l} {r}\n' for l,r in a)

def gap_oracle(a):
    seen=set();groups=[]
    for root in range(len(a)):
        if root in seen:continue
        stack=[root];seen.add(root);members=[]
        while stack:
            i=stack.pop();members.append(a[i])
            for j in range(len(a)):
                if j not in seen and max(a[i][0],a[j][0])<=min(a[i][1],a[j][1]):seen.add(j);stack.append(j)
        groups.append((min(l for l,r in members),max(r for l,r in members)))
    return min((max(l,u)-min(r,v) for (l,r),(u,v) in combinations(groups,2)),default=-1)
def gap_random(r):return [(l,r.randint(l,20)) for l in [r.randint(-20,20) for _ in range(r.randint(1,9))]]
def gap_edges():
    yield [(i,i+1) for i in range(200000)],-1
    yield [(2*i,2*i) for i in range(200000)],2
    yield [(-10**9,-10**9)]*100000+[(10**9,10**9)]*100000,2000000000
add(316,'合并闭区间后的最小间隙','先把全部相交闭区间合并为互不相交的最大段，共用端点也相交。求任意相邻合并段之间的最小间隙，即后段起点减前段终点。若合并后不足两段，没有可比较间隙，按本站协议输出−1。','第一行n，随后n行start end。原文无数值界；本站1≤n≤200000，−10^9≤start≤end≤10^9。没有间隙时仅补−1编码，不排除单段输入。','按起点排序并扫描，维护当前合并段终点；遇起点大于它，记录间隙并新开一段。','排序后下一区间若起点≤当前终点，与当前段相交，合并不会产生间隙；否则后续起点更大不可能回接当前段，所得间隙正是最终相邻两段之间的距离。任意不相邻段的距离不会更小，因此扫描相邻段取最小即为全部段的最小间隙。','时间O(n log n)，空间O(n)。',[[(1,4),(2,5),(8,11)],[(1,5),(5,7)],[(1,1),(3,3),(8,8)]],'答案3、−1、2。原叙述的start[i−1]与end[i]下标写反；本站依7−5=2的原例统一为后段起点减前段终点。',gap_random,gap_edges(),intervals_encode,gap_oracle,
'''def solve(d):
    values=list(map(int,d[1:]));a=sorted(zip(values[::2],values[1::2]));end=a[0][1];answer=None
    for l,r in a[1:]:
        if l<=end:end=max(end,r)
        else:
            gap=l-end;answer=gap if answer is None else min(answer,gap);end=r
    return '-1' if answer is None else str(answer)
''',[('错误共用端点仍产生间隙','if l<=end:','if l<end:'),('错误取最大间隙','min(answer,gap)','max(answer,gap)')],4800050)

def utilization_encode(x):
    cap,fg,bg=x;return f'{cap} {len(fg)} {len(bg)}\n'+''.join(f'{i} {m}\n' for i,m in fg)+''.join(f'{i} {m}\n' for i,m in bg)
def utilization_oracle(x):
    cap,fg,bg=x;candidates=[(fm+bm,fi,bi) for fi,fm in fg for bi,bm in bg if fm+bm<=cap]
    if not candidates:return '[[]]'
    best=max(t for t,i,j in candidates);return compact(sorted([i,j] for t,i,j in candidates if t==best))
def utilization_random(r):return r.randint(0,25),[(i,r.randint(1,15)) for i in r.sample(range(-10,11),r.randint(0,7))],[(i,r.randint(1,15)) for i in r.sample(range(-10,11),r.randint(0,7))]
def utilization_edges():
    ids=list(range(-10**9,-10**9+500));apps=[(i,10**9) for i in ids]
    yield (2*10**9,apps,apps),compact([[i,j] for i in ids for j in ids])
    yield (0,[(i,1) for i in range(500)],[(i,1) for i in range(500)]),'[[]]'
    yield (10**9,[(i,i+1) for i in range(500)],[(i,10**9-i-1) for i in range(500)]),compact([[i,i] for i in range(500)])
add(317,'设备容量内的全部最优前后台应用对','设备同时运行恰好一个前台和一个后台应用，各应用占用正内存，同类应用ID互异，不同类允许相同ID。找总内存不超过容量且尽可能大的全部应用ID对，不遗漏相同内存的不同应用。','第一行capacity n m，随后n行前台ID memory，再m行后台ID memory。原文没有数值界；本站0≤n,m≤500，ID为−10^9..10^9，同类互异，1≤memory≤10^9，0≤capacity≤2×10^9。','后台按内存分组并排序。第一遍对每个前台二分能配的最大后台内存，求最优和；第二遍取恰好达到该和的所有后台ID，枚举全部pair并按两ID字典序排序。','固定前台时最优后台必是容量允许的最大内存，否则可换成更大而改善总和；枚举前台得到全局最优。达到该总和时后台内存被唯一确定，但该内存下每个ID都对应不同合法答案，全部枚举恰好覆盖最优对。排序只规范输出，不丢失任何结果。','时间O((n+m)log m+K log K)，空间O(n+m+K)，K最多nm=250000。',[ (7,[(1,2),(2,4),(3,6)],[(1,2)]),(4,[(2,2),(1,2)],[(9,2),(8,2)]),(16,[(2,7),(3,14)],[(2,10),(3,14)]) ],'输出依次[[2,1]]；[[1,8],[1,9],[2,8],[2,9]]；[[]]。第二例必须保留全部笛卡尔积，不能只返回任一最优对。',utilization_random,utilization_edges(),utilization_encode,utilization_oracle,
'''def solve(d):
    import json
    from bisect import bisect_right
    cap,n,m=map(int,d[:3]);fg=[(int(d[3+2*i]),int(d[4+2*i])) for i in range(n)];groups={};at=3+2*n
    for j in range(m):
        identifier,memory=map(int,d[at+2*j:at+2*j+2]);groups.setdefault(memory,[]).append(identifier)
    memories=sorted(groups);best=-1
    for identifier,memory in fg:
        p=bisect_right(memories,cap-memory)-1
        if p>=0:best=max(best,memory+memories[p])
    answer=[]
    for identifier,memory in fg:
        for other in groups.get(best-memory,[]):answer.append([identifier,other])
    answer.sort();return json.dumps(answer if answer else [[]],separators=(',',':'))
''',[('错误同内存只保留一个后台','groups.get(best-memory,[])','groups.get(best-memory,[])[:1]'),('错误拒绝刚好满容量的对','cap-memory)','cap-memory-1)')],24050,output='输出紧凑JSON二维数组，ID对按字典序升序；无可行对依原题输出[[]]。',outputLimit=8192,time=8)

def identifier_oracle(s):
    @lru_cache(None)
    def visit(t):
        result=len(s)-len(t) if t and t[0]+t[-1]==s[0]+s[-1] else -1
        if t:result=max(result,visit(t[1:]),visit(t[:-1]))
        return result
    return visit(s)
def identifier_edges():
    yield 'a'*200000,199999
    yield 'a'+'b'*199998+'c',0
    yield 'ab'*100000,199998
IDENTIFIER_CODE='''def solve(d):
    s=d[0];last=-1;keep=len(s)
    for j,c in enumerate(s):
        if c==s[0]:last=j
        if c==s[-1] and last>=0:keep=min(keep,j-last+1)
    return str(len(s)-keep)
'''
for number in (318,319):
    add(number,'两端删除后保留原首末类型的最多次数'+('（同题恢复版）' if number==319 else ''),'每次删除当前字符串第一个或最后一个字符。类型是首字符与末字符拼接，单字符a类型为aa，空串类型为空。只要求最终类型等于初始类型，中间过程可暂时不同。求最多删除次数。','输入一行小写字母串s，原界2≤|s|≤200000。','剩余一定是原串的连续子串。扫描每个末位置j，维护最近的原首字符位置i；若当前字符等于原末字符，尝试保留[i,j]并更新最短长度，返回n减最短长度。','两端删除恰好能留下任意连续子串，合法性只取决于其端点。固定末端时，最近的合法首字符使保留长度最短；扫描全部末端覆盖所有合法子串，因此得到最多删除数。首末字符相同时i=j可只留一个字符，按定义仍有同类型；原串类型非空，不能全部删光。','时间O(n)，辅助空间O(1)。',['babdcaac','axxbab','aba'],'答案5、4、2。319原样例babdcaac的输出0与同例解释结论5及318完整同题相冲突，本站公开纠正为5并绑定两份raw；hchc的类型应hc，不是h。318来源只看第一个末字符会错过后面的更短合法区间。',lambda r:''.join(r.choices('abc',k=r.randint(2,10))),identifier_edges(),lambda s:s+'\n',identifier_oracle,IDENTIFIER_CODE,[('错误禁止只保留一个字符','keep=min(keep,j-last+1)','keep=min(keep,max(2,j-last+1))'),('错误只允许删后缀而不删前缀','if c==s[0]:last=j','if j==0:last=j')],200001)

def layout_oracle(s):
    parts=s.split('|');parsed=[]
    for part in parts:
        if len(part)<5 or any(c not in '0123456789' for c in part[:4]) or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' for c in part[4:]):return '["Invalid configuration"]'
        parsed.append((int(part[:4]),part[4:]))
    if sorted(i for i,v in parsed)!=list(range(1,len(parts)+1)):return '["Invalid configuration"]'
    if any(parsed[i][1]==parsed[j][1] for i in range(len(parsed)) for j in range(i)):return '["Invalid configuration"]'
    return compact([v for i,v in sorted(parsed)])
def layout_random(r):
    n=r.randint(1,8);parts=[f'{i:04d}V{i}' for i in range(1,n+1)];r.shuffle(parts);mode=r.randrange(7)
    if mode==1:parts[0]='0000'+parts[0][4:]
    elif mode==2:parts[0]=parts[0][:4]+'!'
    elif mode==3 and n>1:parts[0]=parts[1][:4]+parts[0][4:]
    elif mode==4 and n>1:parts[0]=parts[0][:4]+parts[1][4:]
    elif mode==5:parts[0]='A001x'
    elif mode==6:parts[0]=parts[0][:4]
    return '|'.join(parts)
def layout_edges():
    values=[str(i).rjust(100,'A') for i in range(1,10000)]
    yield '|'.join(f'{i:04d}'+values[i-1] for i in range(9999,0,-1)),compact(values)
    yield '|'.join(f'{i:04d}'+'Z'*100 for i in range(1,10000)),'["Invalid configuration"]'
    yield '0001A||0002B','["Invalid configuration"]'
add(320,'校验并重排条码扫描器配置','配置条目以竖线分隔，每项为四位十进制序号紧接非空配置值。有效布局必须序号恰好1..条目数、无重复/缺失，配置值只含ASCII字母数字且互异。输出序号顺序的配置值；任一校验不满足则输出["Invalid configuration"]。重复值可以出现在待验证输入中，但该输入无效。','输入一行layout。原文orders与序号界1..9999；输入可能缺号或重号。本站为无效输入也允许0..9999个分隔条目、条目长度0..104，字符来自可打印ASCII且不含空白；有效配置值本站补充1..100字符。四位序号必须ASCII数字。空输入也是待验证无效布局。','拆分后逐项校验四位序号、ASCII配置值、序号范围1..n，以及序号和值两类唯一性；数组按序号存值后输出。','全部n个不同序号均位于1..n，当且仅当无缺失且连续。每项格式及字符集独立检查，集合排除两个种类的重复，因而接受当且仅当满足全部正式有效性要求。按序号放入数组保证返回顺序。原constraints允许输入重复只是说明输入可能无效，不取消正文unique校验。','时间O(layout长度+n)，空间O(layout长度+n)。',['0002BB|0001AA','0001A|0002A','0002B|0002C'],'输出依次["AA","BB"]、["Invalid configuration"]、["Invalid configuration"]。第二例公开展示源代码遗漏的配置值唯一性校验，不能因为序号不同就接受重复值。',layout_random,layout_edges(),lambda s:s+'\n',layout_oracle,
'''def solve(d):
    import json
    s=d[0] if d else '';parts=s.split('|');n=len(parts);out=[None]*n;values=set();digits=set('0123456789');letters=set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    for part in parts:
        if len(part)<5 or not set(part[:4])<=digits or not set(part[4:])<=letters:return '["Invalid configuration"]'
        index=int(part[:4]);value=part[4:]
        if not 1<=index<=n or out[index-1] is not None or value in values:return '["Invalid configuration"]'
        out[index-1]=value;values.add(value)
    return json.dumps(out,separators=(',',':'))
''',[('错误不查重复配置值','or value in values','or False'),('错误不按序号返回','return json.dumps(out,separators=', 'return json.dumps([p[4:] for p in parts],separators=')],1050001,output='有效时输出按序号排列的紧凑JSON字符串数组；无效时输出["Invalid configuration"]。',outputLimit=2048)

def strength_oracle(s):
    best=0
    for mask in range(1<<(len(s)-1)):
        ends=[i+1 for i in range(len(s)-1) if mask>>i&1]+[len(s)];left=0;valid=True
        for right in ends:
            part=s[left:right];valid&=any(c in 'aeiou' for c in part) and any(c not in 'aeiou' for c in part);left=right
        if valid:best=max(best,len(ends))
    return best
def strength_edges():
    yield 'ab'*5,5
    yield 'aeiouaeiou',0
    yield 'b'*9+'a',1
add(323,'最多划分多少个兼有元音辅音的密码片段','把整个小写凭据分成若干非空连续片段，每段都必须含至少一个元音aeiou和至少一个其他字母。强度为最多片段数；整个凭据不能满足两类字符时返回0。所有字符必须保留，末尾不能丢弃。','输入一行credential。原界1≤长度≤10，仅小写字母。对应raw为amazon-password-strength.md；不是另一份同标题但统计子串字符数的amazon-find-password-strength.md。','从左扫描，当前段集齐元音和辅音就结束该段并重新计数。最后不够组成合法段的尾部并入最后一个合法段，不增加段数。','任意合法第一段必须至少延伸到首次集齐两类字符的位置。把最优切分的第一段缩到这个最早位置，只会把额外字符移给下一段，不破坏下一段合法性，所以总段数不减少；反复交换得贪心切点。最终尾段可并到前段且保持两类齐全；若从未形成合法段，则整体也不合法，答案0。','时间O(n)，辅助空间O(1)。',['hackerrank','aeiou','abaaa'],'答案3、0、1。最后一例后缀aaa可并入ab所在片段，不是舍弃后缀。',lambda r:''.join(r.choices('abceiouxyz',k=r.randint(1,10))),strength_edges(),lambda s:s+'\n',strength_oracle,
'''def solve(d):
    vowel=consonant=False;answer=0
    for c in d[0]:
        if c in 'aeiou':vowel=True
        else:consonant=True
        if vowel and consonant:answer+=1;vowel=consonant=False
    return str(answer)
''',[('错误每个字符都能作为合法段','if vowel and consonant:','if vowel or consonant:'),('错误只检查整个字符串合法性','return str(answer)','return str(int(answer>0))')],11)

def shipping_oracle(queries):
    queue=[];answer=[]
    for op,value in queries:
        if op=='INSERT':queue.append(value)
        elif len(queue)<3:answer.append(['N/A'])
        else:answer.append(queue[:3]);queue=queue[3:]
    return compact(answer)
def shipping_random(r):return [('INSERT',r.choice(['','a','a  b','A','😀','N/A','x\ty'])) if r.randrange(3) else ('SHIP','-') for _ in range(r.randint(1,18))]
def shipping_edges():
    name='😀'*16
    yield [('INSERT',name),('INSERT',name),('INSERT',name),('SHIP','-')]*12500,compact([[name]*3 for _ in range(12500)])
    yield [('SHIP','-')]*50000,compact([['N/A']]*50000)
    yield [('INSERT','a'*16)]*50000,'[]'
add(324,'按入队顺序每次发送三件包裹','初始队列为空。INSERT将包裹ID追加队尾；SHIP若队列至少3件则发走最早3件并按该顺序返回，否则返回单元素列表["N/A"]且不删除任何包裹。返回每次SHIP的结果列表；没有SHIP时返回空列表。','输入一个紧凑JSON二维数组，每项为["INSERT",ID]或["SHIP","-"]。原文无数值及ID字符界；本站1≤查询数≤50000，ID为0..16个Unicode字符，允许空格、空名、重复、大小写差异。JSON字符串中的空白必须使用JSON转义，例如空格写\\u0020，非ASCII字符使用\\uXXXX或代理对；语义字符串不缩水。','双端队列存所有未发货ID；INSERT追加，SHIP检查长度后取前三个或返回N/A。','循环不变量为队列恰按初次进入顺序存放所有尚未成功发送的包裹。追加保持次序；成功发送取前三个精确实现最早一组；不足时不改变队列，故未来仍能使用这些包裹。每次SHIP恰输出一项，不多不少。','时间O(q+输入输出字符数)，空间O(q+输出字符数)。',[ [('INSERT','A'),('INSERT','B'),('SHIP','-'),('INSERT','C'),('SHIP','-')],[('INSERT','a  b'),('INSERT',''),('INSERT','😀'),('SHIP','-')],[('SHIP','-'),('INSERT','X')] ],'依次输出[["N/A"],["A","B","C"]]；包含双空格ID、空ID和表情的原样三件；[["N/A"]]。原样例N/ A为拼写显示错误，本站按正文统一N/A。',shipping_random,shipping_edges(),json_encode,shipping_oracle,
'''def solve(d):
    import json
    from collections import deque
    queries=json.loads(''.join(d));queue=deque();out=[]
    for op,value in queries:
        if op=='INSERT':queue.append(value)
        elif len(queue)<3:out.append(['N/A'])
        else:out.append([queue.popleft(),queue.popleft(),queue.popleft()])
    return json.dumps(out,ensure_ascii=True,separators=(',',':')).replace(' ','\\\\u0020')
''',[('不足三件错误清空队列',"elif len(queue)<3:out.append(['N/A'])","elif len(queue)<3:out.append(['N/A']);queue.clear()"),('错误倒序发货','[queue.popleft(),queue.popleft(),queue.popleft()]','[queue.popleft(),queue.popleft(),queue.popleft()][::-1]')],11000050,output='输出紧凑JSON二维数组；字符串空白与非ASCII字符用JSON转义，空格编码为\\u0020。',outputLimit=8192,time=8)

def predict_encode(x):
    a,q=x;return f'{len(a)} {len(q)}\n'+seq(a)+'\n'+seq(q)+'\n'
def predict_oracle(x):
    a,q=x;out=[]
    for day in q:
        i=day-1;candidates=[j for j,v in enumerate(a) if v<a[i]];j=min(candidates,key=lambda j:(abs(i-j),j)) if candidates else -2;out.append(j+1)
    return seq(out)
def predict_edges():
    yield ([10**9]*100000,range(1,100001)),seq([-1]*100000)
    yield (range(1,100001),range(1,100001)),seq([-1]+list(range(1,100000)))
    yield ([1,10**9]*50000,range(1,100001)),seq(-1 if i%2==0 else i for i in range(100000))
add(325,'查询最近且价格严格更低的日期','对每个1-based查询日i，在其他日期中找价格严格低于当天的最近日j；距离相同时选较小日期编号。若不存在严格低价日，输出−1。每个查询独立，不改变价格。','第一行n q，第二行n个stockData，第三行q个1-based日期。原界1≤n,q≤100000，1≤stockData[i]≤10^9，1≤query≤n。raw恢复被HTML误吞的stockData[j]<stockData[i]及j≠i条件。','分别从左右扫描单调递增栈，弹出价格≥当前者，得到两侧最近严格较低位置；查询比较二者距离，同距取左。','某个被弹出的更高或等价位置对以后查询不会优于当前更近且不更高的位置，所以安全舍弃；剩栈顶恰为该侧最近严格低价。全局最近必在左右两个最近候选之一，按距离和日期比较实现题意。','时间O(n+q)，空间O(n+q)。',[([5,6,8,4,9,10,8,3,6,4],[6,5,4]),([1,2,1],[2,1]),([3,3],[1,2])],'答案分别5 4 8；1 −1；−1 −1。同价不算更低，同距优先左日期。',lambda r:([r.randint(1,8) for _ in range(n)],[r.randint(1,n) for _ in range(r.randint(1,10))]) if (n:=r.randint(1,12)) else None,predict_edges(),predict_encode,predict_oracle,
'''def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));left=[-1]*n;right=[-1]*n;stack=[]
    for i in range(n):
        while stack and a[stack[-1]]>=a[i]:stack.pop()
        if stack:left[i]=stack[-1]
        stack.append(i)
    stack=[]
    for i in range(n-1,-1,-1):
        while stack and a[stack[-1]]>=a[i]:stack.pop()
        if stack:right[i]=stack[-1]
        stack.append(i)
    out=[]
    for token in d[2+n:]:
        i=int(token)-1;l=left[i];r=right[i]
        if l<0:answer=r
        elif r<0 or i-l<=r-i:answer=l
        else:answer=r
        out.append(str(answer+1 if answer>=0 else -1))
    return ' '.join(out)
''',[('同价错误当更低','a[stack[-1]]>=a[i]','a[stack[-1]]>a[i]'),('平局错误选右边','i-l<=r-i','i-l<r-i')],1800050,output='按查询顺序输出q个答案，以空格分隔。',outputLimit=1024)

def execution_encode(x):
    a,ranges=x;return f'{len(a)} {len(ranges)}\n'+seq(a)+'\n'+''.join(f'{l} {r}\n' for l,r in ranges)
def execution_oracle(x):
    a,ranges=x;return '\n'.join(f'{len(selected)} {sum(selected)}' for l,r in ranges if (selected:=[v for v in a if l<=v<=r]) is not None)
def execution_random(r):
    return [r.randint(1,30) for _ in range(r.randint(1,15))],[(l,r.randint(l,35)) for l in [r.randint(1,35) for _ in range(r.randint(1,10))]]
def execution_edges():
    yield ([10**8]*1200000,[(10**8,10**8)]*200000),'\n'.join(['1200000 120000000000000']*200000)
    yield (range(1,1200001),[(1,10**8)]*200000),'\n'.join(['1200000 720000600000']*200000)
    yield ([1]*1200000,[(2,10**8)]*200000),'\n'.join(['0 0']*200000)
add(326,'每个处理器范围内进程数量及总功耗','每个进程给定功耗power，每个处理器可服务闭区间[minPower,maxPower]内的进程。对每个处理器独立输出符合范围的进程数及这些进程的功耗总和，不是将进程一次性分配给不同处理器。重复功耗对应不同进程，分别计数。','第一行n m，第二行n个power，随后m行minPower maxPower。原界1≤n≤12×10^5=1200000，1≤m≤200000，1≤power,minPower≤maxPower≤10^8（power独立1..10^8）。不把120万误读为12万。','power排序，建立packed无符号64位前缀和。每个闭范围用lower_bound(min)、upper_bound(max)获得下标[l,r)，数量r−l，总和prefix[r]−prefix[l]。读取后释放功耗字符串引用，不保存多份嵌套结果。','排序后的范围内元素恰在第一个≥min与第一个>max之间，包含所有重复值且两端闭合。位置数给出进程数，前缀差精确累加这些元素。处理器查询不修改任何进程，独立计算正确；64位容纳最大总和120000000000000。','时间O(n log n+m log n)，空间O(n+m)，前缀仅8(n+1)字节；输出最多约4.8MB，配置8MiB。',[([7,6,8,10],[(6,10),(3,7),(4,9)]),([11,11,11],[(8,11),(13,100)]),([1,2,3],[(2,2),(1,3)])],'输出分别为4 31 / 2 13 / 3 21；3 33 / 0 0；1 2 / 3 6。第二原例文字误称2个进程，按三项数组应为3。',execution_random,execution_edges(),execution_encode,execution_oracle,
'''def solve(d):
    from array import array
    from bisect import bisect_left,bisect_right
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));d[2:2+n]=[None]*n;a.sort();prefix=array('Q',[0]);total=0
    for v in a:total+=v;prefix.append(total)
    out=[];at=2+n
    for _ in range(m):
        low=int(d[at]);high=int(d[at+1]);at+=2;l=bisect_left(a,low);r=bisect_right(a,high)
        out.append(str(r-l)+' '+str(prefix[r]-prefix[l]))
    return '\\n'.join(out)
''',[('错误不包含右端点','r=bisect_right(a,high)','r=bisect_left(a,high)'),('错误返回所有进程功耗和','str(prefix[r]-prefix[l])','str(prefix[-1])')],16000050,output='按处理器输入顺序输出m行，每行数量与功耗总和。',outputLimit=8192,time=10)

def queue_oracle(wait):
    current=list(wait);out=[];time=0
    while current:
        current=current[1:];current=[v for v in current if v>time];out.append(len(current));time+=1
    return seq(out)
def queue_edges():
    yield [10**9]*200000,seq(range(199999,-1,-1))
    yield [0]*200000,'0'
    yield [10**9]+[1]*199999,'199999 0'
add(328,'处理队首并清除所有到期项后的队列长度','所有进程初始都在队列中，wait[i]是从时间0起可等待的期限。时间t从0开始，每秒先处理并删除当前队首一个进程，再删除所有期限≤t的其余尚存进程，包括队列中间或末尾的过期项。记录该秒结束的剩余数量，直到空队列；不记录处理前初始n。','第一行n，第二行wait。原文无数值界，本站1≤n≤200000、0≤wait[i]≤10^9；期限0合法。输出最后一项必须0。','将索引按期限排序，alive数组标记尚在队列，head只向前寻找未删队首。每秒先删head，再从期限排序指针批量删wait≤t的尚存项。','alive精确表示前面所有处理/过期动作后尚在队列的项；原相对顺序不变，故最小存活索引就是队首。期限排序指针恰找出本秒所有新到期项，已被处理者用alive排除避免重复减数。两指针从不后退，每项最多处理删除一次、到期检查一次，输出数量即规定时刻的真实队长。','时间O(n log n)，空间O(n)，输出长度≤n。',[[2,2,3,1],[4,3,1,2,1],[0,0,9]],'答案3 1 0；4 1 0；1 0。第三例时间0先删首个0，再删另一个到期0，9留到时间1处理。来源只清队首过期项会漏中间和末尾。',lambda r:[r.randint(0,20) for _ in range(r.randint(1,15))],queue_edges(),arr,queue_oracle,
'''def solve(d):
    wait=list(map(int,d[1:]));n=len(wait);order=sorted(range(n),key=wait.__getitem__);alive=bytearray([1])*n;head=at=time=0;remaining=n;out=[]
    while remaining:
        while not alive[head]:head+=1
        alive[head]=0;remaining-=1
        while at<n and wait[order[at]]<=time:
            i=order[at];at+=1
            if alive[i]:alive[i]=0;remaining-=1
        out.append(str(remaining));time+=1
    return ' '.join(out)
''',[('错误超时条件用严格小于','wait[order[at]]<=time','wait[order[at]]<time'),('错误从时间1而非0开始','head=at=time=0','head=at=0;time=1')],2200030,output='输出每秒结束的队列长度，以空格分隔，最后为0。',outputLimit=2048)

def categories_oracle(x):
    names,pairs=x;adj={v:set() for v in names}
    for a,b in pairs:adj[a].add(b);adj[b].add(a)
    seen=set();sizes=[]
    for root in names:
        if root in seen:continue
        todo=[root];seen.add(root);size=0
        while todo:
            v=todo.pop();size+=1
            for w in adj[v]:
                if w not in seen:seen.add(w);todo.append(w)
        sizes.append(size)
    return seq(sorted(sizes)) if sizes else '0'
def categories_encode(x):return json_encode(x)
def categories_random(r):
    names=r.sample(['','a','b','A','a  b','😀','x\ty','c','z'],r.randint(0,9));pairs=[(r.choice(names),r.choice(names)) for _ in range(r.randint(0,15))] if names else [];return names,pairs
def categories_edges():
    names=[chr(0x10000+i)+'😀'*7 for i in range(100000)]
    yield (names,[(names[i],names[i+1]) for i in range(99999)]+[(names[0],names[0])]),'100000'
    yield ([str(i) for i in range(100000)],[]),seq([1]*100000)
    yield (['a','b','c'],[('a','b')]*100000),'1 2'
add(329,'产品等类关系传递后的各组大小','给出全部互异产品标识，及若干表示同一类别的产品对。同类关系具有传递性，求最终每个类别中产品数量，按组大小升序输出；没有出现在任何配对中的产品自成一组。自配对和重复关系不会创造新产品。','输入紧凑JSON：[products,pairs]，pairs每项为两个已有产品标识。原文仅保证products互异及端点有效，无数值/字符界；本站0≤产品数、关系数≤100000，标识为0..8个Unicode字符，JSON字符串空白和非ASCII使用JSON转义，空格写\\u0020。空产品表时关系也为空。','将标识映射为整数，用按大小合并及路径压缩的并查集合并每对；最后收集根的大小并排序。','初始每个产品为独立连通分量，加入一条等类边只会把两端所在分量合并。同一根不重复合并，避免自环或重复关系增加人数。所有边处理完恰为图的连通分量，即关系的最小传递闭包。每个根记录成员数，排序后为要求的类别大小列表。','时间O((n+m)α(n)+n log n)，空间O(n+m+标识字符数)。',[(['A','B','C','D','E'],[('A','B'),('B','C'),('D','E')]),(['','a  b','😀'],[('','a  b'),('','')]),([],[])],'输出2 3；1 2；0。空集合的本站输出协议为单个0；非空时只输出各个正组大小，不加组数。',categories_random,categories_edges(),categories_encode,categories_oracle,
'''def solve(d):
    import json
    names,pairs=json.loads(''.join(d));position={v:i for i,v in enumerate(names)};parent=list(range(len(names)));size=[1]*len(names)
    def find(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for a,b in pairs:
        x=find(position[a]);y=find(position[b])
        if x==y:continue
        if size[x]<size[y]:x,y=y,x
        parent[y]=x;size[x]+=size[y]
    answer=sorted(size[i] for i in range(len(names)) if parent[i]==i)
    return ' '.join(map(str,answer)) if answer else '0'
''',[('错误忽略传递合并只查原根','x=find(position[a]);y=find(position[b])','x=position[a];y=position[b]'),('错误孤立点不算类别','if parent[i]==i)','if parent[i]==i and size[i]>1)')],30100050,output='非空时输出各类别大小升序、空格分隔；没有产品时输出0。',outputLimit=1024,time=10)

def servers_encode(x):
    power,cost,target=x;return f'{len(power)} {target}\n'+seq(power)+'\n'+seq(cost)+'\n'
def servers_oracle(x):
    power,cost,target=x;return min((sum(c for i,c in enumerate(cost) if mask>>i&1) for mask in range(1<<len(power)) if sum(p for i,p in enumerate(power) if mask>>i&1)>=target),default=-1)
def servers_edges():
    yield ([10**9]*200000,[2]*200000,200000000000000),400000
    yield ([-10**9]*200000,[1]*200000,1),-1
    yield ([10**9]*200000,[1]*200000,-100000000000000),0
add(330,'价格仅为一或二时购足服务器能力的最低成本','每台机器最多购买一次，价格为1或2，功率为整数。选择任意机器集合使功率总和至少target，求最低价格总和；可以不选任何机器，无可行集合返回−1。','第一行n target，第二行power，第三行price。原文只限制price为1或2，其余无数值界；本站1≤n≤200000、−10^9≤power[i]≤10^9、−10^14≤target≤2×10^14。不擅自要求功率为正，非正功率机器仍是合法输入。','target≤0直接0。否则丢弃非正功率，按价格分组，各组功率降序并作前缀和。枚举1价组选取个数，用二分找2价组满足剩余需求的最少个数，取总价最小。','价格均正，移除非正功率机器只减成本且不降低可达目标，所以最优不选它们。固定每组选择数量时，选择该组功率最大的若干台是支配其他选择的最优方式。枚举第一组数量后，第二组正前缀和严格增加，二分获得最少台数就是该第一组数量下最低价；再取全局最小穷尽全部可行组合。','时间O(n log n)，空间O(n)，功率和64位。',[([4,4,6,7],[1,1,2,2],7),([-5,0,4],[1,2,2],5),([-5],[1],-1)],'答案2、−1、0。最后一例空集功率0已经不低于−1，不能强制买一台。',lambda r:([r.randint(-3,15) for _ in range(n)],[r.randint(1,2) for _ in range(n)],r.randint(-5,60)) if (n:=r.randint(1,10)) else None,servers_edges(),servers_encode,servers_oracle,
'''def solve(d):
    from bisect import bisect_left
    n,target=map(int,d[:2]);power=list(map(int,d[2:2+n]));cost=list(map(int,d[2+n:]));groups=[[],[],[]]
    if target<=0:return '0'
    for p,c in zip(power,cost):
        if p>0:groups[c].append(p)
    one=sorted(groups[1],reverse=True);two=sorted(groups[2],reverse=True);prefix=[0]
    for p in two:prefix.append(prefix[-1]+p)
    supplied=0;best=10**30
    for i in range(len(one)+1):
        j=bisect_left(prefix,max(0,target-supplied))
        if j<len(prefix):best=min(best,i+2*j)
        if i<len(one):supplied+=one[i]
    return str(best) if best<10**30 else '-1'
''',[('错误把2价机器也按1收费','i+2*j','i+j'),('错误用功率最小机器作前缀','reverse=True','reverse=False')],2900080,time=8)

def rearrange_encode(x):
    s,queries=x;return f'{len(s)} {len(queries)}\n'+s+'\n'+'\n'.join(queries)+'\n'
def rearrange_oracle(x):
    source,queries=x;seen={source};todo=[source];n=len(source)
    for s in todo:
        for mask in range(1,1<<n):
            chosen=iter(sorted(s[i] for i in range(n) if mask>>i&1));t=''.join(next(chosen) if mask>>i&1 else s[i] for i in range(n))
            if t not in seen:seen.add(t);todo.append(t)
    return seq('YES' if any(all(a=='?' or a==b for a,b in zip(query,t)) for t in seen) else 'NO' for query in queries)
def rearrange_random(r):
    n=r.randint(1,6);return ''.join(r.choices('01',k=n)),[''.join(r.choices('01?',k=n)) for _ in range(r.randint(1,5))]
def rearrange_edges():
    yield ('1'*100000+'0'*100000,['?'*200000]*10),seq(['YES']*10)
    yield ('0'*100000+'1'*100000,['1'*100000+'0'*100000]*10),seq(['NO']*10)
    yield ('0',['?']*200000),seq(['YES']*200000)
add(331,'子序列升序操作能否实现通配二进制目标','一次操作可选原串任意子序列，将所选字符升序排序，再放回相同所选位置。对每个含0/1/?且等长的目标串，问能否把?各替为0或1，使原二进制串经零次或多次操作得到它。每个目标独立从原串出发。','第一行长度L及查询数q，第二行binary，随后q行目标。原文无数值界；本站1≤L,q≤200000，所有目标长度为L，目标总字符数L×q≤2000000。只允许排序，不允许任意交换。','目标总0数必须等于原串。先扣掉固定0，把所需的0尽量放在最早的?，其余?填1；若数量不足/超额则NO。再检查目标每个前缀的1数均不超过原前缀，全部成立才YES。','对子序列升序只能将1右移、0左移，故保持总数并不增加任何前缀1数。反过来，前缀条件等价于目标的每个0位置不晚于相应原0，可通过相邻10→01逐个向左移0实现。固定总数时最早?填0使所有前缀1数同时最小，若仍超界则其他替换也不可能，若满足就构成可达见证。','时间O(L+Lq)，空间O(L+q)不计输入字符。',[('101100',['?110?1','111???']),('01',['10','??']),('11',['0?','??'])],'答案YES NO；NO YES；NO YES。原例从101100到011100应排序0-based位置{0,1}，不是原说明的{0,2}。来源只比总1数会误接受111???。',rearrange_random,rearrange_edges(),rearrange_encode,rearrange_oracle,
'''def solve(d):
    length,count=map(int,d[:2]);source=d[2];zeros=source.count('0');prefix=[];ones=0
    for c in source:ones+=c=='1';prefix.append(ones)
    answers=[]
    for query in d[3:]:
        need=zeros-query.count('0');available=query.count('?')
        if not 0<=need<=available:answers.append('NO');continue
        total=0;valid=True
        for i,c in enumerate(query):
            if c=='?':
                c='0' if need else '1'
                if c=='0':need-=1
            total+=c=='1'
            if total>prefix[i]:valid=False;break
        answers.append('YES' if valid else 'NO')
    return ' '.join(answers)
''',[('错误只核对总数不核对前缀','if total>prefix[i]:','if False:'),('错误前缀条件方向写反','total>prefix[i]','total<prefix[i]')],2400080,output='按查询顺序输出YES或NO，以空格分隔。',outputLimit=1024,time=8)

def temperature_oracle(a):
    # Bidirectional BFS in the unbounded integer state graph; no formula or
    # coordinate clipping. Reverse edges undo precisely the three operations.
    start=tuple(a);goal=(0,)*len(a)
    if start==goal:return 0
    fronts=[{start},{goal}];distance=[{start:0},{goal:0}];depth=[0,0]
    while True:
        side=0 if len(fronts[0])<=len(fronts[1]) else 1;delta=-1 if side==0 else 1;new=set();answer=None
        for state in fronts[side]:
            next_states=[tuple(v+delta*int(j<=i) for j,v in enumerate(state)) for i in range(len(a))]+[tuple(v+delta*int(j>=i) for j,v in enumerate(state)) for i in range(len(a))]+[tuple(v-delta for v in state)]
            for nxt in next_states:
                if nxt in distance[side]:continue
                distance[side][nxt]=depth[side]+1;new.add(nxt)
                if nxt in distance[1-side]:
                    candidate=depth[side]+1+distance[1-side][nxt];answer=candidate if answer is None else min(answer,candidate)
        if answer is not None:return answer
        fronts[side]=new;depth[side]+=1
def temperature_edges():
    yield [-10**9,10**9]*100000,599997000000000
    yield [10**9]*200000,1000000000
    yield [-10**9]*200000,1000000000
add(334,'前缀降温后缀降温与整体升温的最少操作','每次恰好选择一种：让某个非空前缀全部减1；让某个非空后缀全部减1；让整个数组全部加1。求把所有温度变为0的最少操作数。不能单次下降多个单位，不能任意内部区间减1。','第一行n，第二行temperature。原文无数值界，本站1≤n≤200000、−10^9≤temperature[i]≤10^9。raw完整恢复了被整理版HTML误吞的前缀/后缀操作范围。','P为相邻下降量总和，Q为相邻上升量总和。先消除各内部差至少需P个对应前缀降温及Q个对应后缀降温，之后全部温度为a[0]−P；答案P+Q+abs(a[0]−P)。','内部差d[i]=a[i]−a[i−1]只能被在i−1结束的前缀减1增加，或从i开始的后缀减1减少。负差必须至少用−d[i]个前缀操作、正差至少d[i]个后缀操作，共P+Q。执行后数组常数为c=a[0]−P，再用|c|个整体升/降操作即可。额外内部操作必须在某边界成对，增加2z次且把常数再减z，总代价≥P+Q+2z+|c−z|≥P+Q+|c|，故构造达到全局下界。','时间O(n)，辅助空间O(1)不含读取，结果64位。',[[2,4,4],[2,-2,-3,1],[0,0]],'答案4、12、0。原例2标10错误，首步把末温度1→−2已违反单次−1。本站公开更正12：全体+1三次得[5,1,0,4]，前缀到0减1四次、前缀到1减1一次、后缀从3减1四次，总12次。独立单位操作图验证该最优值。',lambda r:[r.randint(-2,2) for _ in range(r.randint(1,4))],temperature_edges(),arr,temperature_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));fall=rise=0
    for x,y in zip(a,a[1:]):
        if y<x:fall+=x-y
        else:rise+=y-x
    return str(fall+rise+abs(a[0]-fall))
''',[('错误套用首项绝对值加总变差','abs(a[0]-fall)','abs(a[0])'),('错误省掉整体剩余温度','fall+rise+abs(a[0]-fall)','fall+rise')],2400030)

def deletion_oracle(s):
    @lru_cache(None)
    def visit(t):
        if not t:return 0
        return 1+min(visit(t[:l]+t[r:]) for l in range(len(t)) for r in range(l+1,len(t)+1) if len(set(t[l:r]))==1)
    return visit(s)
def deletion_edges():
    yield 'ab'*100,101
    yield ''.join(chr(0x10000+i) for i in range(200)),200
    yield '😀'*200,1
add(335,'删除当前连续同字符段直到清空的最少次数','每次选择当前字符串一段非空连续子串，只有其中全部字符相同才能删除；删除后左右部分拼接，可能形成新的同字符连续段。求清空的最少删除次数。标题中的频率顺序没有额外操作要求，不按字符频率排序删除。','输入一个JSON字符串。原文无长度和字符域界；本站0≤长度≤200，字符按Unicode字符计，空字符串合法。JSON字符串中的空白和非ASCII须转义，空格写\\u0020。','区间DP。独立删除左字符给出1+dp[l+1][r]；若s[k]=s[l]，先清掉中间，再把左字符与k在同次删除中处理，候选dp[l+1][k−1]+dp[k][r]。空区间0，枚举所有同字符k取最小。','考虑删除左端字符的那次操作。若不与其他原位置同删，代价至少1加剩余最优；否则令k为同次删除的下一个原位置，中间全部必须先清除，之后左字符可附在k的删除操作里而不额外收费。两区间独立最优给出下界，反过来先清中间、执行右段方案并把左字符附在k被删的那次即可达到。因此转移覆盖全部最优方案，长度递增计算正确。','时间O(n³)，空间O(n²)，本站n≤200约800万三重循环量级。',['abaca','aba',''],'答案3、2、0。abaca先删b、c再一次删aaa；来源统计原始同字符段会错给5，不能忽略删除后拼接。',lambda r:''.join(r.choices('abc',k=r.randint(0,8))),deletion_edges(),json_encode,deletion_oracle,
'''def solve(d):
    import json
    s=json.loads(''.join(d));n=len(s)
    if not n:return '0'
    dp=[[0]*n for _ in range(n)]
    for l in range(n-1,-1,-1):
        dp[l][l]=1
        for r in range(l+1,n):
            best=1+dp[l+1][r]
            for k in range(l+1,r+1):
                if s[l]==s[k]:best=min(best,(dp[l+1][k-1] if k>l+1 else 0)+dp[k][r])
            dp[l][r]=best
    return str(dp[0][n-1])
''',[('错误把原有连续段数当答案','return str(dp[0][n-1])','return str(1+sum(a!=b for a,b in zip(s,s[1:])))'),('错误同次合并仍额外收费','best=min(best,(dp[l+1][k-1]','best=min(best,1+(dp[l+1][k-1]')],2405,time=8)

def main():
    base.main()
    path=base.OUT/'reviews'/f'{base.BATCH}.json';data=json.loads(path.read_text())
    data['items'].extend([dict(id='oa-amazon-321',status='blocked',reason='返回具体A但无最小件数平局规则，例3不是最重最小集，例4和例5更不是最小件数。不能直接套其他题最重tie-break或静默改多个例。'),dict(id='oa-amazon-322',status='blocked',reason='原始正文真实截断在list of pa；缺包是否可拆/分配等核心条件，仅单例不能恢复，一般不可拆分装箱不能用来源贪心替代。'),dict(id='oa-amazon-327',status='blocked',reason='原保证句真实截断，缺删除不存在ID的行为或总可删除保证。此为状态转移缺失，不补额外有效删除保证缩域，不把来源忽略缺失ID行为当规范。'),dict(id='oa-amazon-332',status='blocked',reason='原严格N<10^9，即最大999999999项；显式文本至少约2GB，超32MiB输入及128MiB包容量。线性滑窗虽正确也不能解除原完整域传输阻塞，不缩N或换特定压缩数组。'),dict(id='oa-amazon-333',status='blocked',reason='核心API规则表位于缺失的本机绝对路径图片；文字不足以定义注册/注销全部状态转移。不能用来源实现或常识填补核心规则。')])
    slugs=['optimal-interval-difference','optimal-utilization','optimize-identifiers','optimized-identifiers','orda-layout','pack-items','package-delivery-system','password-strength','perform-queries','predict-answer','process-execution','process-queries-on-cart','process-queue','product-category-groups','purchase-servers','rearrange-binary-string','reduce-memory-usage','register-login-logout','regulate-temperatures','remove-characters-in-frequency-order']
    catalog={v['id']:v for v in json.loads((base.ROOT/'content/oa-master/catalog.json').read_text())['items']}
    for item in data['items']:
        n=int(item['id'].split('-')[-1]);paths=['fastprep/Amazon/amazon-'+slugs[n-316]+'.md']
        if n==319:paths.append('fastprep/Amazon/amazon-optimize-identifiers.md')
        item['sourceEvidence']=[]
        for relative in paths:
            raw=(Path('/tmp/cswork-oa-source-20260919')/relative).read_bytes();item['sourceEvidence'].append(dict(commit='e66f809f4c953bce129f68491726176615db6afc',path=relative,gitBlobSha1=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),rawSha256=hashlib.sha256(raw).hexdigest(),catalogContentHash=catalog[item['id']]['contentHash']))
    data['items'].sort(key=lambda v:int(v['id'].split('-')[-1]));path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
