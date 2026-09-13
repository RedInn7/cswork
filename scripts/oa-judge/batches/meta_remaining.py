"""Independently authored Meta 21..32; no imported source code is executed."""
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys
from decimal import Decimal, localcontext

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'
BATCH = 'meta-remaining'


def nested_oracle(a, depth=1):
    return sum(nested_oracle(v,depth+1) if isinstance(v,list) else v*depth for v in a)


def random_nested(r,depth=1):
    return [random_nested(r,depth+1) if depth<4 and r.random()<.35 else r.randint(-100,100) for _ in range(r.randint(1,4))]


def deep_nested():
    a=[100]
    for _ in range(49):a=[a]
    return a


def consonant_oracle(x):
    s,n=x; alphabet='bcdfghjklmnpqrstvwxyz'; positions=[i for i,c in enumerate(s) if c.lower() in alphabet]; result=list(s)
    for index in positions[n-1::n]:
        original=s[index]; replacement=alphabet[(alphabet.index(original.lower())+1)%len(alphabet)]
        result[index]=replacement.upper() if original.isupper() else replacement
    return ''.join(result)


def average_oracle(x):
    a,w=x; answers=[]
    with localcontext() as context:
        context.prec=50
        for start in range(len(a)-w+1):
            value=Decimal(sum(a[start:start+w]))/Decimal(w)
            answers.append(format(value,'f'))
    return str(len(answers))+('\n'+' '.join(answers) if answers else '')


def time_text(value):return f'{value//60:02d}:{value%60:02d}'


def bus_oracle(x):
    schedule,now=x
    earlier=[t for t in sorted(schedule) if t<now]
    if not earlier:return '-1'
    h,m=map(int,now.split(':')); a,b=map(int,earlier[-1].split(':'))
    return str((h-a)*60+m-b)


def cave_oracle(board):
    rows=len(board); cols=len(board[0]); best=-1
    if board[0][0]=='x':return '-1'
    def visit(i,j,seen):
        nonlocal best
        if (i,j)==(rows-1,cols-1):best=max(best,len(seen)); return
        for a,b in ((i,j-1),(i,j+1),(i+1,j)):
            if 0<=a<rows and 0<=b<cols and board[a][b]=='!' and (a,b) not in seen:visit(a,b,seen|{(a,b)})
    visit(0,0,{(0,0)})
    return str(best)


def interval_oracle(x):
    # Connected components in the interval intersection graph, not a sweep.
    intervals=x[0]+x[1]; remaining=set(range(len(intervals))); merged=[]
    while remaining:
        start=remaining.pop(); component=[start]
        for i in component:
            linked=[j for j in remaining if intervals[i][0]<=intervals[j][1] and intervals[j][0]<=intervals[i][1]]
            for j in linked:remaining.remove(j); component.append(j)
        merged.append((min(intervals[i][0] for i in component),max(intervals[i][1] for i in component)))
    merged.sort()
    return str(len(merged))+''.join(f'\n{a} {b}' for a,b in merged)


def random_intervals(r):
    groups=[]
    for _ in range(2):
        result=[]; end=-15
        for _ in range(r.randint(0,6)):
            start=end+r.randint(1,4); end=start+r.randint(0,4); result.append((start,end))
        r.shuffle(result); groups.append(result)
    return tuple(groups)


def pattern_oracle(x):
    a,p=x
    return str(sum(all((a[i+j+1]>a[i+j])-(a[i+j+1]<a[i+j])==v for j,v in enumerate(p)) for i in range(len(a)-len(p))))


SPECS=[
dict(id=21,title='嵌套列表的深度加权和',tags=['栈','遍历'],
desc='嵌套列表的元素是整数或列表。最外层列表内整数深度为1，每深入一层列表，深度加1。输出每个整数乘以其深度后的总和，允许负数及空子列表。',
input='输入一行合法JSON嵌套列表，最外层元素个数1..50；每个整数在−100..100，整数深度不超过50。本站限制列表及整数节点总数不超过100000，输入不超过2000000字符。',output='输出一个整数。',
idea='解析列表后，用显式栈保存列表及深度；整数贡献数值乘深度，子列表以深度加一入栈。',
proof='每个整数仅由其直接父列表访问一次。栈中深度从最外层1开始，进入子列表恰增加1，等于包含该整数的列表数，因此累加得到定义的加权和。',complexity='时间O(L)，额外空间O(L)，L为输入长度；不依赖深层递归遍历。',
samples=[[[1,1],2,[1,1]],[1,[4,[6]]],[0]],
notes=['四个1深度为2，整数2深度为1，和为4×1×2+2×1=10。','1、4、6的深度分别为1、2、3，和为1+8+18=27。','唯一整数0的贡献是0×1=0。'],random=random_nested,
encode=lambda a:json.dumps(a,separators=(',',':'))+'\n',oracle=lambda a:str(nested_oracle(a)),raw=True,
edges=[(deep_nested(),'5000'),([[[100]*20 for _ in range(50)] for _ in range(50)],'15000000'),([[]]*50,'0')],
code='''def solve(data):
    import json
    stack=[(json.loads(data),1)]; total=0
    while stack:
        values,depth=stack.pop()
        for value in values:
            if isinstance(value,list):stack.append((value,depth+1))
            else:total+=value*depth
    return str(total)
''',mutants=[('不计算深度权重','total+=value*depth','total+=value'),('最外层深度为0','json.loads(data),1','json.loads(data),0')]),
dict(id=22,title='替换每第n个辅音',tags=['字符串'],
desc='按从左到右顺序数英文字母中的辅音，每第n个辅音替换为字母序的下一个辅音，保持大小写；z/Z循环到b/B。辅音顺序为bcdfghjklmnpqrstvwxyz。元音、空格、数字及标点不参与计数，也不改变。',
input='本站输入：第一行n（1..100000），第二行长度0..100000的ASCII可打印文本，可含前后与连续空格。',output='输出替换后的完整文本，保留全部空格和大小写，并以一个换行结束。',checker='exact',raw=True,
idea='维护辅音计数，每逢n的倍数，把字符向后移到下一个非元音英文字母，超过z则从a继续找；最后恢复原大小写。',
proof='只对辅音增加计数，因此被替换位置恰好是第n、2n、3n…个辅音。按字母循环查找并跳过元音正好得到题目给定的下一个辅音，其它字符保持原样。',complexity='时间O(L)，输出空间O(L)。',
samples=[('CodeSignal',3),('z Z!',1),('  a   b  ',2)],notes=['辅音依次C、d、S、g、n、l，第3个S变T、第6个l变m，得到CodeTignam。','每个辅音都替换，z循环到b、Z循环到B，输出b B!。','只有一个辅音b，未达到第2个，因此整行连同全部空格原样输出。'],
random=lambda r:(''.join(r.choice('aeiouAEIOUbcdfXYZz 09!?') for _ in range(r.randint(0,60))),r.randint(1,10)),encode=lambda x:str(x[1])+'\n'+x[0]+'\n',oracle=consonant_oracle,
edges=[(('z'*100000,1),'b'*100000),((' '*100000,1),' '*100000),(('B'*100000,100000),'B'*99999+'C')],
code='''def solve(data):
    first,message=data.split('\\n',1); n=int(first); count=0; result=[]
    for ch in message:
        lower=ch.lower()
        if 'a'<=lower<='z' and lower not in 'aeiou':
            count+=1
            if count%n==0:
                value=(ord(lower)-96)%26
                while chr(97+value) in 'aeiou':value=(value+1)%26
                changed=chr(97+value); ch=changed.upper() if ch.isupper() else changed
        result.append(ch)
    return ''.join(result)
''',mutants=[('所有辅音都替换','count%n==0','True'),('丢掉原大小写','changed.upper() if ch.isupper() else changed','changed'),('压缩空格',"return ''.join(result)","return ' '.join(''.join(result).split())")]),
dict(id=23,title='滑动窗口平均值',tags=['滑动窗口','整数运算'],checker='oa-window-averages',
desc='给定整数数组和正窗口长度，输出每个连续窗口的平均值；窗口长度超过数组长度时结果为空。',
input='本站输入：第一行n和w（0≤n≤50000，1≤w≤100000），第二行n个整数（−10⁹..10⁹）。',output='第一行输出结果数量。若数量大于0，第二行按窗口顺序输出平均值，空格分隔；空结果只输出0。每项允许绝对或相对误差不超过10⁻⁵，不能输出NaN或Infinity。',
idea='用滑动和更新窗口总和。将总和绝对值放大10⁶倍，使用整数除法和余数实现六位小数四舍五入，避免二进制浮点误差。',
proof='第一个窗口直接求和，右移时减去离开的元素、加上进入的元素，保持准确窗口总和。除以w得到平均值，整数倍缩放后按余数是否至少为w/2加一，得到六位小数；舍入误差不超过0.5×10⁻⁶，满足允许绝对误差。',complexity='时间O(n)，除输入和输出外空间O(1)。',
samples=[([1,2,3,4,5,6,7,8,9],7),([1,0,0],3),([1,2],3)],notes=['三个窗口和为28、35、42，除以7得到4.000000、5.000000、6.000000。','唯一窗口平均值是1/3，保留六位小数为0.333333。','窗口长度3超过数组长度2，没有完整窗口，输出数量0。'],
random=lambda r:(lambda a:(a,r.randint(1,len(a)+3)))([r.randint(-30,30) for _ in range(r.randint(0,15))]),encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=average_oracle,
edges=[(([10**9]*50000,50000),'1\n1000000000.000000'),(([-1]+[0]*49999,50000),'1\n-0.000020'),(([1]*50000,1),'50000\n'+' '.join(['1.000000']*50000))],
code='''def solve(data):
    n,w=map(int,data[:2]); a=list(map(int,data[2:])); result=[]
    def rounded(total):
        scaled=(2*abs(total)*1000000+w)//(2*w)
        sign='-' if total<0 and scaled else ''
        return f'{sign}{scaled//1000000}.{scaled%1000000:06d}'
    total=sum(a[:w])
    if w<=n:
        result.append(rounded(total))
        for i in range(w,n):total+=a[i]-a[i-w]; result.append(rounded(total))
    return str(len(result))+('\\n'+' '.join(result) if result else '')
''',mutants=[('遗漏最后窗口','range(w,n)','range(w,n-1)'),('忽略负号',"sign='-' if total<0 and scaled else ''","sign=''")]),
dict(id=25,title='距离上一班公交发车的分钟数',tags=['时间','扫描'],
desc='给出当天公交发车时间与当前时刻，求最近一班已经发车的公交距今多少分钟。恰好等于当前时刻的车尚未发车，必须严格早于当前时间；没有则输出−1，不考虑前一天。',
input='本站输入：第一行n（0..100000），随后n行HH:MM时间，最后一行当前时刻。小时00..23、分钟00..59，时刻均为同一天；时刻表可未排序、可重复。',output='输出分钟数，或−1。',
idea='把时间转成从零点起的分钟数，扫描出严格早于当前时间的最大发车时间。',proof='时间转换保持同一天内先后顺序。最大发车分钟数就是已发车的最后一班，两者相减为经过分钟数；没有候选则无车已发。',complexity='时间O(n)，除输入外空间O(1)。',
samples=[(['12:30','14:00','19:55'],'14:30'),(['00:00','14:00','19:55'],'00:00'),(['12:30','14:00','19:55'],'14:00')],notes=['最后已发车时间14:00，距14:30为30分钟。','00:00这一班恰好等于当前时间，尚未发车，因此输出−1。','14:00尚未发车，上一班是12:30，相差90分钟。'],random=lambda r:([time_text(r.randrange(1440)) for _ in range(r.randint(0,15))],time_text(r.randrange(1440))),encode=lambda x:str(len(x[0]))+'\n'+'\n'.join(x[0])+('\n' if x[0] else '')+x[1]+'\n',oracle=bus_oracle,
edges=[((['00:00']*100000,'23:59'),'1439'),((['23:59']*100000,'23:59'),'-1')],
code='''def solve(data):
    def minutes(s):
        h,m=map(int,s.split(':')); return h*60+m
    now=minutes(data[-1]); latest=-1
    for s in data[1:-1]:
        t=minutes(s)
        if t<now:latest=max(latest,t)
    return str(now-latest if latest>=0 else -1)
''',mutants=[('等于当前时间也算已发车','if t<now:','if t<=now:'),('选择最早班车','latest=max(latest,t)','latest=t if latest<0 else min(latest,t)')]),
dict(id=26,title='洞穴中不可回头的最长路线',tags=['动态规划','网格'],
desc='从网格左上角(0,0)出发，抵达右下角。!为可通行格，x为障碍。每步只能向左、向右或向下移动一格，不能向上，也不能再次进入已访问格。求抵达出口的路径最多包含多少格（起点终点均计数），无法到达输出−1。',
input='本站输入：第一行R C（1..200），随后R行长度C的字符串，只含!和x；入口或出口也可能被阻挡。',output='输出最大访问格数，或−1。',
idea='逐行动态规划。每行从上一行下降进入，分别进行一次从左向右和从右向左的扫描，取每个位置的较大值，作为下一行入口。',proof='路径不向上，因此每行只访问一次；在同一行改变水平移动方向必然重访格子，不合法。因此每行的路径是向左或向右的一段，两次扫描完整覆盖。下一行合并两方向的最大值不会重用本行格子，动态规划恰好枚举全部合法路线。',complexity='时间O(RC)，除输入外空间O(C)。',
samples=[['!!!','!!!','!!!'],['!x','x!'],['!']],notes=['3×3空网格可逐行蛇形经过全部9格并在右下角结束。','入口右侧与下方均为障碍，无法到达出口，输出−1。','起点就是终点且可通行，访问格数为1。'],
random=lambda r:[''.join(r.choice('!!!x') for _ in range(4)) for _ in range(r.randint(1,3))],encode=lambda b:f'{len(b)} {len(b[0])}\n'+'\n'.join(b)+'\n',oracle=cave_oracle,
edges=[(['!'*200]*199,'39800'),(['!'*200]*200,'39801'),(['x'+'!'*199]+['!'*200]*199,'-1')],
code='''def solve(data):
    rows,cols=map(int,data[:2]); board=data[2:]; bad=-10**9; previous=[bad]*cols
    if board[0][0]=='x':return '-1'
    previous[0]=0
    for row in board:
        left=[bad]*cols; right=[bad]*cols
        for j in range(cols):
            if row[j]=='!':
                best=max(previous[j],left[j-1] if j else bad)
                if best!=bad:left[j]=best+1
        for j in range(cols-1,-1,-1):
            if row[j]=='!':
                best=max(previous[j],right[j+1] if j+1<cols else bad)
                if best!=bad:right[j]=best+1
        previous=[max(a,b) for a,b in zip(left,right)]
    return str(previous[-1] if previous[-1]!=bad else -1)
''',mutants=[('不能向左走','previous=[max(a,b) for a,b in zip(left,right)]','previous=left'),('把障碍也当安全格',"if row[j]=='!':","if True:")]),
dict(id=27,title='距离最近的斐波那契数',tags=['数学'],
desc='斐波那契数从0、1开始，之后每项是前两项之和。给定非负整数N，输出到最近的斐波那契数的绝对差，只输出距离而非该数。',input='一行N（0..1000000）。',output='输出最小绝对差。',idea='生成相邻斐波那契数，直到后一项不小于N；比较这两个数到N的距离。',proof='序列非递减，夹住N的相邻两项分别是其左、右最近候选；其它项距离不会更小，因此取两者最小距离。',complexity='时间O(log(N+1))，额外空间O(1)。',
samples=[25,5,0],notes=['25在21与34之间，距离分别4与9，答案4。','5本身是斐波那契数，距离0。','0是序列第一项，距离0。'],random=lambda r:r.randint(0,1000),encode=lambda n:str(n)+'\n',oracle=lambda n:str(min(abs(n-f) for f in [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597])),edges=[(1000000,'167960'),(832040,'0'),(1,'0')],
code='''def solve(data):
    n=int(data[0]); a,b=0,1
    while b<n:a,b=b,a+b
    return str(min(n-a,b-n))
''',mutants=[('只取右侧距离','min(n-a,b-n)','b-n'),('返回地标而非距离','min(n-a,b-n)','a')]),
dict(id=28,title='合并两个互不重叠的区间列表',tags=['排序','区间合并'],
desc='给定两个闭区间列表，各列表内部的区间互不重叠。合并两个列表的区间并合并所有有交集的区间，按起点升序输出。端点相等算重叠，例如[1,2]和[2,3]合并为[1,3]；[1,2]和[3,4]不能合并。',
input='本站输入：第一行n m（0..100000），随后n行是X、再m行是Y，每行l r（−10⁹≤l≤r≤10⁹）。每个列表内部区间互不重叠，但可以未排序。',output='第一行输出合并后的区间数k，随后k行输出l r，按起点升序；全空输出0。',
idea='把所有区间按起点排序，维护当前合并段：新起点不超过当前右端时扩展右端，否则开始新的段。',proof='排序后若新起点大于当前右端，后续区间也不能填补这个缺口，当前段可以确定输出。否则两段相交，其并集是最左端到较大右端，合并不会丢失或增加被覆盖位置。',complexity='时间O((n+m)log(n+m))，空间O(n+m)。',
samples=[([(1,5),(10,14),(16,18)],[(2,6),(8,10),(11,20)]),([(1,2)],[(2,3)]),([],[])],notes=['1..5与2..6合并为1..6；8..10、10..14、11..20、16..18连通合并为8..20。','闭区间在端点2相交，因此输出一个区间1 3。','两个列表都空，合并后数量为0。'],random=random_intervals,encode=lambda x:f'{len(x[0])} {len(x[1])}\n'+''.join(f'{a} {b}\n' for a,b in x[0]+x[1]),oracle=interval_oracle,
edges=[(([(4*i,4*i+2) for i in range(100000)],[(4*i+2,4*i+4) for i in range(100000)]),'1\n0 400000'),(([],[(-10**9,10**9)]),'1\n-1000000000 1000000000')],
code='''def solve(data):
    values=list(map(int,data[2:])); intervals=sorted(zip(values[::2],values[1::2])); result=[]
    for left,right in intervals:
        if result and left<=result[-1][1]:result[-1][1]=max(result[-1][1],right)
        else:result.append([left,right])
    return str(len(result))+''.join(f'\\n{a} {b}' for a,b in result)
''',mutants=[('端点相同不合并','left<=result[-1][1]','left<result[-1][1]'),('缩小右边界','max(result[-1][1],right)','min(result[-1][1],right)')]),
dict(id=31,title='按升降模式匹配连续子数组',tags=['KMP','数组'],
desc='模式中的1表示后一个数比前一个数大，−1表示更小，0表示相等。给定数组与长度m的模式，统计长度m+1且相邻大小关系全部匹配的连续子数组数量，允许重叠。',input='本站输入：第一行n m（2≤n≤100000，1≤m<n），第二行n个整数（−10⁹..10⁹），第三行m个−1、0或1。',output='输出匹配窗口数量。',idea='把数组转换为相邻比较序列，用KMP匹配模式。匹配成功后回退到最长真前后缀，使重叠匹配也被统计。',proof='每个原数组窗口与其相邻比较序列唯一对应。KMP逐个位置维护能匹配的最长模式前缀，失配回退不丢失任何可能匹配，完整匹配对应一个合法窗口。',complexity='时间O(n+m)，空间O(n+m)。',
samples=[([4,1,3,4,4,5,5,1],[1,0,-1]),([2,2,2,2],[0,0]),([1,2],[1])],notes=['只有下标4开始的[4,5,5,1]依次升、平、降，答案1。','下标0与1开始的两个长度3窗口均为全相等，允许重叠，因此答案2。','唯一窗口1,2严格上升，与模式1匹配，答案1。'],
random=lambda r:(lambda a:(a,[r.choice([-1,0,1]) for _ in range(r.randint(1,len(a)-1))]))([r.randint(-5,5) for _ in range(r.randint(2,15))]),encode=lambda x:f'{len(x[0])} {len(x[1])}\n'+' '.join(map(str,x[0]))+'\n'+' '.join(map(str,x[1]))+'\n',oracle=pattern_oracle,
edges=[(([0]*100000,[0]*50000),'50000'),((list(range(100000)),[1]),'99999')],
code='''def solve(data):
    n,m=map(int,data[:2]); a=list(map(int,data[2:2+n])); p=list(map(int,data[2+n:])); prefix=[0]*m
    for i in range(1,m):
        j=prefix[i-1]
        while j and p[i]!=p[j]:j=prefix[j-1]
        if p[i]==p[j]:j+=1
        prefix[i]=j
    matched=answer=0
    for i in range(n-1):
        value=(a[i+1]>a[i])-(a[i+1]<a[i])
        while matched and value!=p[matched]:matched=prefix[matched-1]
        if value==p[matched]:matched+=1
        if matched==m:answer+=1; matched=prefix[matched-1]
    return str(answer)
''',mutants=[('忽略重叠窗口','answer+=1; matched=prefix[matched-1]','answer+=1; matched=0'),('比较方向颠倒','(a[i+1]>a[i])-(a[i+1]<a[i])','(a[i+1]<a[i])-(a[i+1]>a[i])')]),
]

SPECS.append(dict(id=29,title='区间内三位互异的数字',tags=['枚举','数学'],
desc='统计闭区间内百位、十位、个位两两不同的三位整数。原站后附1..10⁹约束与三位数题文冲突，本站遵循明确的三位数定义，输入区间限制为100..999。',input='一行left right（100≤left≤right≤999）。',output='输出符合条件的三位整数数量。',
idea='直接枚举区间中的整数，拆出百位、十位、个位并检查三个两两不等条件。',proof='闭区间枚举每个候选一次，三个不等式成立恰好表示任意两位不同，因此没有遗漏或重复计数。',complexity='时间O(right−left+1)，额外空间O(1)。',
samples=[(876,890),(100,100),(102,102)],notes=['只有876、879、890三位互异，输出3。','100的两个0重复，输出0。','102的三个数字各不相同，输出1。'],random=lambda r:(lambda left:(left,r.randint(left,999)))(r.randint(100,999)),encode=lambda x:f'{x[0]} {x[1]}\n',oracle=lambda x:str(sum(x[0]<=100*a+10*b+c<=x[1] for a in range(1,10) for b in range(10) for c in range(10) if len({a,b,c})==3)),edges=[((100,999),'648'),((999,999),'0')],
code='''def solve(data):
    left,right=map(int,data); count=0
    for value in range(left,right+1):
        a=value//100; b=value//10%10; c=value%10
        if a!=b and a!=c and b!=c:count+=1
    return str(count)
''',mutants=[('漏掉右端点','range(left,right+1)','range(left,right)'),('只检查相邻两位','a!=b and a!=c and b!=c','a!=b and b!=c')]))


BLOCKED={
    24:'未说明返程日j是否必须≥出发日i（或严格>），唯一单调样例对三种解释答案相同。例如去程[100,1]、返程[1,100]，无日期限制答案2、有先后限制答案101，不能自行假定。',
    30:'未明确相等元素对能否共享下标，也未明确一个值出现4次可算几对。给定0,1,0,1,0的样例不能区分按C(freq,2)、floor(freq/2)或重复值种数计数；[1,1,1],k=2等输入答案不同。',
    32:'“改变方向一次”同时描述turn与reversing，无法确定只能右转下/下转右，还是可反向左/上；是否允许重访格子、按不同路径还是每个单词计次也未定义。缺原始图/视频，不能构造唯一oracle。',
}


def execute(path,stdin,exact):
    result=subprocess.run([sys.executable,'-I',str(path)],input=stdin,text=True,capture_output=True,timeout=10)
    assert result.returncode==0,(path,result.stderr)
    return result.stdout.replace('\r\n','\n') if exact else result.stdout.strip()


def matches(actual,expected,checker):
    if checker=='exact':return actual==expected
    if checker=='oa-window-averages':
        import math
        a=actual.split(); b=expected.split()
        if not a or not b or a[0]!=b[0] or len(a)!=len(b) or int(a[0])!=len(a)-1:return False
        for x,y in zip(a[1:],b[1:]):
            x=float(x); y=float(y)
            if not math.isfinite(x) or not math.isfinite(y):return False
            if abs(x-y)>1e-5*max(1,abs(y)):return False
        return True
    return actual.split()==expected.split()


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={item['id']:item for item in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    selected=set(map(int,sys.argv[1:]))
    items=json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if selected else []
    reports=json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if selected else []
    items=[item for item in items if int(item['id'].split('-')[-1]) not in selected]
    reports=[item for item in reports if int(item['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['id'] not in selected:continue
        identifier=f"oa-meta-{spec['id']}"; rng=random.Random(20260921+spec['id']); checker=spec.get('checker','tokens'); exact=checker=='exact'
        reader='sys.stdin.read().removesuffix("\\n")' if spec.get('raw') else 'sys.stdin.read().split()'
        code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n'
        path=OUT/'references'/f'{identifier}.py'; path.write_text(code)
        oracle_cases=[]
        for value in spec['samples']+[spec['random'](rng) for _ in range(160)]:
            stdin=spec['encode'](value); expected=spec['oracle'](value)+'\n'
            assert matches(execute(path,stdin,exact),expected,checker),(identifier,value,expected)
            oracle_cases.append(dict(input=stdin,expectedOutput=expected))
        tests=oracle_cases[:3]+[dict(input=spec['encode'](value),expectedOutput=answer+'\n') for value,answer in spec['edges']]+oracle_cases[3:31]
        cases=[]
        for index,test in enumerate(tests):
            assert matches(execute(path,test['input'],exact),test['expectedOutput'],checker),(identifier,index)
            cases.append(dict(name=f'样例 {index+1}' if index<3 else f'边界与组合 {index-2}',**test,hidden=index>=3,weight=1))
        mutants=[]; kills=[]
        for index,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code
            mutation=code.replace(old,new); control=OUT/'negative-controls'/f'{identifier}-{index}.py'; control.write_text(mutation)
            rejected=[]
            for case_index,test in enumerate(cases):
                actual=execute(control,test['input'],exact)
                if not matches(actual,test['expectedOutput'],checker):rejected.append(case_index)
            assert rejected,(identifier,name,'survived')
            mutants.append(dict(name=name,code=mutation)); kills.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Meta']+spec['tags'],description=spec['desc']+'\n\n标准输入、本站约束、样例与评测数据由CSWork独立整理。',input=spec['input'],output=spec['output'],explanation='\n\n'.join(f'样例{i+1}：{note}' for i,note in enumerate(spec['notes'])),hints=[spec['idea']],timeLimit=4,memoryLimit=262144,outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"; solutions=[dict(language='python',code=code)]
        documents={'packages':json.loads(normalized),'oracles':oracle_cases,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}
        for folder,document in documents.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=identifier,oracleCases=len(oracle_cases),publicCases=3,hiddenCases=len(cases)-3,negativeControls=kills,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracle_cases),'oracle cases;',len(cases)-3,'hidden;',len(mutants),'normally exiting mutants rejected',flush=True)
    items.sort(key=lambda item:int(item['id'].split('-')[-1])); reports.sort(key=lambda item:int(item['id'].split('-')[-1]))
    (OUT/'batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=20260921,problems=reports,skipped={f'oa-meta-{key}':value for key,value in BLOCKED.items()},note='Local differential checks; real sandbox evidence remains mandatory.'),ensure_ascii=False,indent=2)+'\n')
    reviews=[dict(id=f'oa-meta-{number}',status='blocked' if number in BLOCKED else 'authored',reason=BLOCKED.get(number,'规则明确；独立参考程序、暴力oracle、随机及大边界验证，三个样例均有具体说明。')) for number in range(21,33)]
    for review in reviews:
        if review['id']=='oa-meta-23':review['reason']='窗口平均值规则明确；固定身份oa-window-averages检查器按绝对/相对误差10⁻⁵校验，整数缩放参考算法与Decimal高精度独立对照，不沿用查询−1的sentinel规则。'
        if review['id']=='oa-meta-29':review['reason']='按明确的三位数题文限定输入100..999，源站1..10⁹约束不符该题文；原样例876..890恰为3，与本站独立oracle一致。'
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
