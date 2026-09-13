"""Uber 1..20. Only independently authored Python is executed."""
import collections
import itertools
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'
BATCH='uber-first'
SPECS=[]
def array(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def add(i,title,description,input,idea,proof,complexity,samples,explanation,random_case,encode,oracle,code,mutants,edges,**extra):
    SPECS.append(dict(id=i,title=title,description=description,input=input,idea=idea,proof=proof,complexity=complexity,samples=samples,explanation=explanation,random=random_case,encode=encode,oracle=oracle,code=code,mutants=mutants,edges=edges,**extra))

def divisible_oracle(x):
    a,k=x;return str(max([0]+[j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if sum(a[i:j])%k==0]))
add(1,'总和被k整除的最长连续区间','给定非负整数数组，求元素和能被k整除的最长非空连续子数组长度，没有则输出0。','第一行n k，第二行n个整数。1≤n≤100000，0≤a[i]≤10⁹，1≤k≤10⁹。','记录每种前缀和余数首次出现的位置；相同余数的两个前缀之间就是合法区间。','两前缀之差被k整除当且仅当余数相同。固定右端时最早的相同余数给出最长长度；扫描全部右端取最大即最优。','时间O(n)，空间O(n)。',[([2,7,6,1,4,5],3),([1],2),([0,0],7)],'样例1：7、6、1、4总和18，长度4；没有更长合法区间。样例2：唯一元素1不能被2整除，输出0。样例3：整段和0能被7整除，输出2。',lambda r:([r.randint(0,20) for _ in range(r.randint(1,10))],r.randint(1,10)),lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',divisible_oracle,'''def solve(d):
    n,k=map(int,d[:2]);first={0:0};remainder=answer=0
    for i,value in enumerate(map(int,d[2:]),1):
        remainder=(remainder+value)%k
        if remainder in first:answer=max(answer,i-first[remainder])
        else:first[remainder]=i
    return str(answer)
''',[('覆盖最早余数位置','else:first[remainder]=i','first[remainder]=i'),('不加入空前缀','first={0:0}','first={}')],[(([10**9]*100000,10**9),'100000'),(([1]*99999,100000),'0'),(([0]*100000,10**9),'100000')],maxInputBytes=1100024)

def obstacle_oracle(operations):
    occupied=[];answer=''
    for op in operations:
        if op[0]==1:occupied.append(op[1])
        else:answer+='0' if any(op[1]-op[2]<=x<op[1] for x in occupied) else '1'
    return answer
def obstacle_random(r):return [(1,r.randint(-9,9)) if r.randrange(2) else (2,r.randint(-9,9),r.randint(1,12)) for _ in range(r.randint(1,20))]
add(2,'动态障碍与右端开区间查询','操作1 x在坐标x设置障碍，重复设置没有额外影响。操作2 x size检查半开区间[x−size,x)内是否没有障碍；空则记录1，否则0。查询只检查，不放置障碍，最终连接所有查询结果。','第一行q，随后q行操作。1≤q≤100000。源题未给坐标范围，本站约定−10⁹≤x≤10⁹，1≤size≤10⁹。','预读所有插入坐标并离散化，用树状数组维护是否已插入。用二分得到左右边界对应排名，查询区间障碍数量。','树状数组前缀和统计指定排名以前的已设置坐标，右端用lower_bound排除x，左端同样用lower_bound包含x−size；两者差为0恰好无障碍。','时间O(q log q)，空间O(q)。',[[(1,2),(1,5),(2,5,2),(2,6,3),(2,2,1),(2,3,2)],[(1,0),(2,0,1),(2,1,1)],[(2,-5,3)]],'样例1：查询[3,5)、[3,6)、[1,2)、[1,3)分别无、有、无、有障碍，输出1010。样例2：右端0不属于[−1,0)，但属于[0,1)，输出10。样例3：没有设置障碍，输出1。',obstacle_random,lambda ops:str(len(ops))+'\n'+'\n'.join(' '.join(map(str,op)) for op in ops)+'\n',obstacle_oracle,'''from bisect import bisect_left
def solve(d):
    q=int(d[0]);ops=[];i=1
    for _ in range(q):
        kind=int(d[i]);length=2 if kind==1 else 3;ops.append(tuple(map(int,d[i:i+length])));i+=length
    coordinates=sorted({op[1] for op in ops if op[0]==1});tree=[0]*(len(coordinates)+1);seen=set();answer=[]
    def prefix(end):
        result=0
        while end:result+=tree[end];end-=end&-end
        return result
    for op in ops:
        if op[0]==1:
            if op[1] in seen:continue
            seen.add(op[1]);index=bisect_left(coordinates,op[1])+1
            while index<len(tree):tree[index]+=1;index+=index&-index
        else:
            left=bisect_left(coordinates,op[1]-op[2]);right=bisect_left(coordinates,op[1]);answer.append('1' if prefix(right)==prefix(left) else '0')
    return ''.join(answer)
''',[('错误包含右端','right=bisect_left(coordinates,op[1])','right=bisect_left(coordinates,op[1]+1)'),('错误排除左端','left=bisect_left(coordinates,op[1]-op[2])','left=bisect_left(coordinates,op[1]-op[2]+1)')],[( ([(1,i) for i in range(50000)]+[(2,i+1,1) for i in range(50000)]),'0'*50000),(([(2,-10**9,10**9)]*100000),'1'*100000),(([(1,0)]*100000),'')],output='输出查询结果组成的01串；没有查询时输出一个空行。',maxInputBytes=2500007)

def recording_oracle(s):
    groups=[]
    for c in s:
        if not groups or groups[-1][-1].lower()!=c.lower():groups.append([c])
        else:groups[-1].append(c)
    return str(max(0,len(groups)-1))
add(3,'忽略大小写的按键变化次数','忽略大小写，统计相邻录入字符对应的字母发生变化的次数。','一行英文字母组成的字符串，长度1..1000（本站将字符序列以连续ASCII英文字母串输入）。','扫描相邻字符的小写形式，不同就累计1。','每次按键字母变化对应且仅对应一个相邻不同位置，逐位置计数不重不漏。','时间O(n)，额外空间O(1)。',['WwaAbb','wWaWa','aAAa'],'样例1：w变a、a变b，共2次。样例2：w、w、a、w、a中变化3次。样例3：全部都是字母a，变化0次。',lambda r:''.join(r.choice('aAbBcC') for _ in range(r.randint(1,30))),lambda s:s+'\n',recording_oracle,'''def solve(d):
    s=d[0];answer=0
    for i in range(1,len(s)):
        if s[i].lower()!=s[i-1].lower():answer+=1
    return str(answer)
''',[('区分大小写','s[i].lower()!=s[i-1].lower()','s[i]!=s[i-1]'),('遗漏第一次比较','range(1,len(s))','range(2,len(s))')],[('aB'*500,'999'),('aA'*500,'0')],maxInputBytes=1001)

def resource_oracle(x):
    items,rate=x;items=list(items);cycles=0
    while True:
        if items.count('P')>=rate:
            for _ in range(rate):items.remove('P')
            items.append('A')
        elif 'A' in items:items.remove('A')
        else:return str(cycles)
        cycles+=1
add(5,'按优先级兑换和消耗资源的周期数','每周期优先消耗conversionRate个P兑换一个A；不足时若有A则消耗一个A；两者都不能做就结束，结束动作不计周期。严格按正文操作，消耗A不会额外产生P。原前两例13、4与正文冲突，分别纠正为5、2。','第一行n conversionRate，第二行n个A/P字符组成的连续字符串。2≤n≤500，2≤conversionRate≤500。','每次兑换消耗固定数量P，故可兑换floor(P/rate)次。每次兑换还产生一个需要消耗的A，总周期为初始A数加两倍兑换次数。','P只会减少且仅在兑换时减少，不存在其他产生P的动作，因此兑换总数固定。所有初始与新生A最终各被消耗一次，两类动作相加即得周期数。','时间O(n)，额外空间O(1)。',[('AAAPPP',2),('AA',2),('PPP',3)],'样例1：先兑换一次，剩4个A和1个P，再消耗4个A，共5周期。样例2：消耗两个A后结束，共2周期。样例3：兑换一次得到A，再消耗它，共2周期。',lambda r:(''.join(r.choice('AP') for _ in range(r.randint(2,15))),r.randint(2,8)),lambda x:f'{len(x[0])} {x[1]}\n{x[0]}\n',resource_oracle,'''def solve(d):
    rate=int(d[1]);items=d[2]
    return str(items.count('A')+2*(items.count('P')//rate))
''',[('只算兑换不算新生A','2*(items.count(\'P\')//rate)',"(items.count('P')//rate)"),('把终止判断也计周期',"items.count('A')+2*","1+items.count('A')+2*")],[(('P'*500,2),'500'),(('A'*500,500),'500'),(('P'*499,500),'0')],maxInputBytes=509)

def stairs_oracle(a):
    answers=[]
    for direction in (-1,1):
        for start in range(min(a)-len(a),max(a)+len(a)+1):
            target=[start+direction*i for i in range(len(a))]
            if all(x>=y for x,y in zip(target,a)):answers.append(sum(target)-sum(a))
    return str(min(answers))
add(7,'只增加高度的最少阶梯改造','每次将某座建筑高度加1。最终须严格形成公差+1或−1的等差阶梯，求两种方向中最少增加次数。','第一行n，第二行n个高度；2≤n≤100000，1≤height[i]≤10⁹。','升序起始高度至少是max(height[i]−i)，降序起始高度至少是max(height[i]+i)；取各自最小可行起点并计算总差。','每座建筑只能增加，给出起点的独立下界；取最大下界即可同时满足全部位置。总操作数随起点单调增加，因此最小可行起点最优，两方向取较小值。','时间O(n)，空间O(n)（输入数组）。',[[1,4,3,2],[5,7,9,4,11],[2,1]],'样例1：升高第一座到5，形成5、4、3、2，共4次。样例2：形成7、8、9、10、11，总增加9。样例3：已经是下降阶梯，0次。',lambda r:[r.randint(1,12) for _ in range(r.randint(2,8))],array,stairs_oracle,'''def solve(d):
    a=list(map(int,d[1:]));n=len(a);ascending=max(v-i for i,v in enumerate(a));descending=max(v+i for i,v in enumerate(a));total=sum(a);offset=n*(n-1)//2
    return str(min(n*ascending+offset-total,n*descending-offset-total))
''',[('只考虑升序','min(n*ascending+offset-total,n*descending-offset-total)','n*ascending+offset-total'),('允许降低取最小起点','ascending=max(v-i','ascending=min(v-i')],[([10**9]*100000,'4999950000'),(list(range(1,100001)),'0'),(list(range(100000,0,-1)),'0')],maxInputBytes=1100007)

def vowels_oracle(s):return str(sum(sum(c in 'aeiou' for c in s[i:i+3])==2 for i in range(len(s)-2)))
add(8,'恰有两个元音的三字符子串','统计长度恰为3、其中恰有两个元音的连续子串数量；元音为a、e、i、o、u，允许子串重叠。','输入一行长度0..1000的小写字符串，可为空行。','维护最近三个字符的元音数，窗口长度达到3后若计数为2就累加。','每个长度3窗口在右端扫描到达时恰好检查一次；加入新字符并移除三格之前字符保持窗口元音数准确。','时间O(n)，额外空间O(1)。',['welcome','','banana'],'样例1：elc只有1元音、lco只有1，wel也只有1，com也只有1；ome有2，正确结果为1，原站2有误。样例2：没有长度3子串，输出0。样例3：两个ana窗口各有两个a，输出2。',lambda r:''.join(r.choice('aeioubcdf') for _ in range(r.randint(0,20))),lambda s:s+'\n',vowels_oracle,'''def solve(d):
    s=d;count=answer=0
    for i,c in enumerate(s):
        count+=c in 'aeiou'
        if i>=3:count-=s[i-3] in 'aeiou'
        if i>=2 and count==2:answer+=1
    return str(answer)
''',[('三个元音也计数','count==2','count>=2'),('遗漏首个窗口','i>=2 and','i>=3 and')],[('a'*1000,'0'),('aba'*333+'a','998')],raw=True,maxInputBytes=1001)

def concat_oracle(x):
    a,target=x;return str(sum(str(v)+str(w)==str(target) for i,v in enumerate(a) for j,w in enumerate(a) if i!=j))
add(10,'拼接成访问码的有序下标对','统计不同下标(i,j)的有序对，使两个正整数的标准十进制表示依次拼接后恰等于accessCode。相同数值的不同下标仍是不同选择。','第一行n，第二行n个正整数fragments，第三行正整数accessCode。2≤n≤30000，1≤fragments[i]≤10⁹。源目标无上界，本站目标为最多20位的正整数；超过20位不可能由两个合法片段拼成。','统计每个整数标准十进制串的频次，枚举目标串的每个分割点，乘两部分频次；两部分相同时扣除同一个下标。','每个合法拼接有唯一分割点，两个部分必须分别在片段中。不同值时任意两个下标可配，相同值时有c(c−1)种有序对，所以分割计数完整且不重复。','时间O(n+目标长度²)，空间O(n)。',[([12,12,13,12,12],1212),([22,8,22,110],1108),([777,7,777,77,77],7777)],'样例1：四个12选不同下标有4×3=12对。样例2：只有110后接8，1对。样例3：777接7有2对，7接777有2对，两个77互相拼接有2对，合计6。',lambda r:([r.randint(1,40) for _ in range(r.randint(2,9))],int(''.join(str(r.randint(1,40)) for _ in range(2)))),lambda x:array(x[0])+str(x[1])+'\n',concat_oracle,'''from collections import Counter
def solve(d):
    n=int(d[0]);counts=Counter(str(int(v)) for v in d[1:n+1]);target=str(int(d[-1]));answer=0
    for i in range(1,len(target)):
        a,b=target[:i],target[i:];left=counts[a];right=counts[b]
        answer+=left*(right-(a==b))
    return str(answer)
''',[('允许同下标使用两次','right-(a==b)','right'),('错误把有序对除2','return str(answer)','return str(answer//2)')],[(([10**9]*30000,int(str(10**9)*2)),'899970000'),(([1,10],110),'1')],maxInputBytes=330027)

def zeros_oracle(a):
    result=0
    for value in a:
        digits=[]
        if value==0:digits=[0]
        while value:digits.append(value%10);value//=10
        if sum(d==0 for d in digits)%2:result+=1
    return str(result)
add(11,'含奇数个数字零的整数数目','按标准十进制表示，统计数字0出现奇数次的元素数量；整数0本身表示为一个0，符合条件。','第一行n，第二行n个整数；1≤n≤1000，0≤a[i]≤10⁹。','转为标准十进制字符串，数0并判断奇偶。','标准表示中的每个字符对应一位，计数为奇数的元素恰好满足定义，逐元素相加。','时间O(n·D)，D≤10；额外空间O(D)。',[[20,11,10,10070,7],[0,100],[1010,10100]],'样例1：20、10、10070分别含1、1、3个0，答案3。样例2：0含一个0合格，100含两个不合格，答案1。样例3：1010有两个0不合格，10100有三个0合格，答案1。',lambda r:[r.randint(0,10000) for _ in range(r.randint(1,15))],array,zeros_oracle,'''def solve(d):
    from itertools import islice
    return str(sum(str(int(v)).count('0')%2 for v in islice(d,1,None)))
''',[('任意含零都算',"str(int(v)).count('0')%2","int('0' in str(int(v)))"),('遗漏整数零',"str(int(v)).count('0')%2","str(int(v)).count('0')%2 if int(v)!=0 else 0")],[([10**9]*1000,'1000'),([0]*1000,'1000')],maxInputBytes=11006)

def digital_oracle(a):
    reduced=[]
    for value in a:
        while value>=10:value=sum(int(c) for c in str(value))
        reduced.append(value)
    return str(max(range(10),key=lambda digit:(reduced.count(digit),digit)))
add(12,'数根众数与最大数位优先','反复将每个整数替换为各位数字之和，直到全部为单个数字。返回出现最多的数字，次数并列取较大数字。','第一行n，第二行n个非负整数；1≤n≤100，0≤a[i]≤1000000。','正整数数根为1+(x−1)%9，0单独映射为0。统计十种结果频次，再比较次数与数字。','十进制数与各位数字和模9同余，反复化简保持同余；正数最终在1..9中，唯一对应上述公式，0仍为0。最大频次及最大数字的二级比较实现要求。','时间O(n)，额外空间O(10)。',[[123,456,789,101],[1,2],[0,9,18]],'样例1：数根为6、6、6、2，返回6。样例2：1和2各一次，并列取2。样例3：数根0、9、9，返回9；正的9倍数不是数根0。',lambda r:[r.randint(0,1000000) for _ in range(r.randint(1,20))],array,digital_oracle,'''def solve(d):
    from itertools import islice
    counts=[0]*10
    for value in map(int,islice(d,1,None)):counts[0 if value==0 else 1+(value-1)%9]+=1
    return str(max(range(10),key=lambda x:(counts[x],x)))
''',[('并列取较小数字','(counts[x],x)','(counts[x],-x)'),('正九倍数误映射为零','0 if value==0 else 1+(value-1)%9','value%9')],[([1000000]*100,'1'),([0]*100,'0')],maxInputBytes=805)

def aligned_oracle(x):
    width,paragraphs=x;lines=['*'*(width+2)]
    for align,words in paragraphs:
        consumed=0
        while consumed<len(words):
            possible=[end for end in range(consumed+1,len(words)+1) if len(' '.join(words[consumed:end]))<=width];end=max(possible);text=' '.join(words[consumed:end]);padding=' '*(width-len(text));lines.append('*'+(text+padding if align=='LEFT' else padding+text)+'*');consumed=end
    return '\n'.join(lines+['*'*(width+2)])
def aligned_random(r):
    width=r.randint(5,12);paragraphs=[]
    for _ in range(r.randint(1,4)):
        words=[''.join(r.choice('abc') for _ in range(r.randint(1,5))) for _ in range(r.randint(1,5))];paragraphs.append((r.choice(['LEFT','RIGHT']),words))
    return width,paragraphs
add(13,'分段左右对齐的星号文本框','每段有LEFT或RIGHT对齐标记。按原顺序贪心装入尽可能多的条目，条目之间添加一个空格，不拆开条目。行末剩余空间放在右侧(LEFT)或左侧(RIGHT)。外框每行宽width+2，上下全为*，内容行两端各一个*，不额外添加内边距。原例中的“Please look”等含空格条目按完整条目保留。','第一行width P；每段先一行align wordCount，再wordCount行，每行一个条目。5≤width≤100，1≤P≤50。源题未给条目数/字符范围，本站每段1..100个条目，条目长1..width，由ASCII可见字符及内部空格组成，无首尾空格。','逐段累积当前行字符串，放不下下一条目时输出当前行，再开始新行。按标记补齐一侧空格并加边框。','每次仅在加入下一条目会超宽时换行，因此恰为规定贪心分行；每行原始字符顺序不变，所缺空格全部放入指定侧，得到唯一排版。','时间O(输入与输出字符数)，空间O(输入与输出字符数)。',[(16,[('LEFT',['hello','world']),('RIGHT',['How','areYou','doing']),('RIGHT',['Please look','and align','to right'])]),(5,[('LEFT',['a','b','c'])]),(5,[('RIGHT',['a b','cc'])])],'样例1：输出7行、每行18字符；hello world右补5空格，How areYou doing恰满16，最后三条各占一行并分别左补5、7、8空格。样例2：a b c恰好占满内容5列，不需要补空格。样例3：a b和cc放一起需6列，必须分两行，分别左补2和3个空格。',aligned_random,lambda x:f'{x[0]} {len(x[1])}\n'+''.join(f'{align} {len(words)}\n'+'\n'.join(words)+'\n' for align,words in x[1]),aligned_oracle,'''def solve(d):
    lines=d.splitlines();width,p=map(int,lines[0].split());index=1;result=['*'*(width+2)]
    for _ in range(p):
        align,count=lines[index].split();count=int(count);index+=1;current=''
        def render(text):return '*'+(text.ljust(width) if align=='LEFT' else text.rjust(width))+'*'
        for word in lines[index:index+count]:
            candidate=word if not current else current+' '+word
            if len(candidate)>width:result.append(render(current));current=word
            else:current=candidate
        result.append(render(current));index+=count
    result.append('*'*(width+2));return '\\n'.join(result)
''',[('左右对齐颠倒',"align=='LEFT'","align=='RIGHT'"),('删除必要的行内空格',"text.ljust(width)","text")],[((100,[('LEFT',['a'*100]*100)]*50),'\n'.join(['*'*102]+['*'+'a'*100+'*']*5000+['*'*102]))],raw=True,checker='exact',output='输出完整星号文本框，不加行数；每行恰好width+2字符，保留所有空格，最后一行后换行。',maxInputBytes=505609)

def peak_oracle(x):
    a,gap=x;return str(min(abs(a[i]-a[j]) for i in range(len(a)) for j in range(i+gap,len(a))))
add(14,'相隔至少指定位置的最小高度差','选择下标距离至少viewingGap的一对山峰，最小化两者高度差绝对值。距离等于viewingGap允许；gap=1时任意两个不同下标都允许，原第二例文字“非相邻”不准确。','第一行n viewingGap，第二行n个高度。2≤n≤100000，1≤viewingGap<n，1≤height[i]≤10⁹。','按高度排序，双指针窗口内用两个单调队列维护原下标的最小值和最大值。当两下标之差达到gap时，记录高度跨度并缩小左边界。','一个高度区间含有合法位置对，当且仅当其中最大与最小原下标相差至少gap。排序窗口跨度是其中所有高度差的上界；任何最优对的高度区间一定被双指针检查到或被更窄可行窗口替代，因此最小可行窗口宽度就是最优差。','时间O(n log n)，空间O(n)。',[([1,5,4,10,9],3),([3,10,5,8],1),([7,2,7],2)],'样例1：允许的三对高度差为9、8、4，最小4。样例2：3与5、10与8都相差2且下标距离至少1，答案2。样例3：首尾位置相距2且高度相同，答案0。',lambda r:(lambda a:(a,r.randint(1,len(a)-1)))([r.randint(1,20) for _ in range(r.randint(2,10))]),lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',peak_oracle,'''from collections import deque
def solve(d):
    n,gap=map(int,d[:2]);a=list(map(int,d[2:]));ranked=sorted((v,i) for i,v in enumerate(a));minimum=deque();maximum=deque();left=0;answer=10**30
    for right,(_,index) in enumerate(ranked):
        while minimum and ranked[minimum[-1]][1]>=index:minimum.pop()
        while maximum and ranked[maximum[-1]][1]<=index:maximum.pop()
        minimum.append(right);maximum.append(right)
        while ranked[maximum[0]][1]-ranked[minimum[0]][1]>=gap:
            answer=min(answer,ranked[right][0]-ranked[left][0])
            if minimum[0]==left:minimum.popleft()
            if maximum[0]==left:maximum.popleft()
            left+=1
    return str(answer)
''',[('仅考虑相邻下标高度','answer=min(answer,ranked[right][0]-ranked[left][0])','answer=min(answer,ranked[right][0]-ranked[left][0]+1)'),('忽略要求的距离','n,gap=map(int,d[:2]);','n,gap=map(int,d[:2]);gap=1;')],[(([10**9]*100000,99999),'0'),((list(range(1,100001)),99999),'99999'),((list(range(100000,0,-1)),50000),'50000')],maxInputBytes=1100014)

def prime_score_oracle(a):
    steps=[1]+[p for p in range(2,len(a)) if p%10==3 and all(p%d for d in range(2,p))]
    def visit(position,total):
        if position==len(a)-1:return total
        return max(visit(position+p,total+a[position+p]) for p in steps if position+p<len(a))
    return str(visit(0,0))
add(15,'末位为3的质数跳跃最高得分','从0号格、分数0出发。每次向右跳1格，或跳末位十进制数字为3的质数格。落点数值加入得分，最终必须到n−1，求最高得分。','第一行n，第二行n个格值。1≤n≤10000，−10000≤cell[i]≤10000，cell[0]=0。','用筛法求小于n且末位为3的质数，和步长1一起作为合法转移。动态规划dp[i]=cell[i]+max(dp[i−step])。','每条到达i的路线都来自某个合法步长的前一格，且前缀最优可替换任何次优前缀。下标严格增加，按顺序递推覆盖所有路线，dp[n−1]即最优。','时间O(n log log n+n·π₃(n))，空间O(n)，π₃(n)为小于n且末位3的质数数量。',[[0,-10,-20,-30,50],[0],[0,1,1,1]],'样例1：0→1→4得−10+50=40，优于先跳3的20。样例2：起点就是终点，分数0。样例3：逐格前进得到3，跳过正分格不会更好。',lambda r:[0]+[r.randint(-8,8) for _ in range(r.randint(0,10))],array,prime_score_oracle,'''def solve(d):
    a=list(map(int,d[1:]));n=len(a);prime=bytearray(b'\\1')*n
    for p in range(2,n):
        if prime[p]:
            for multiple in range(p*p,n,p):prime[multiple]=0
    steps=[1]+[p for p in range(3,n,10) if prime[p]];dp=[-10**30]*n;dp[0]=0
    for i in range(1,n):dp[i]=a[i]+max(dp[i-p] for p in steps if p<=i)
    return str(dp[-1])
''',[('允许任意末位3的合数','if prime[p]]','if True]'),('允许不走到终点','return str(dp[-1])','return str(max(dp))')],[([0]+[10000]*9999,'99990000'),([0]+[0]*9999,'0'),([0]+[-10000]*33,'-30000')],timeLimit=6,maxInputBytes=70006)

def ancestor_oracle(x):
    letters,edges,queries=x;n=len(letters);g=[[] for _ in range(n)]
    for a,b in edges:g[a].append(b);g[b].append(a)
    parent=[-1]*n;order=[0]
    for node in order:
        for other in g[node]:
            if other!=parent[node]:parent[other]=node;order.append(other)
    result=[]
    for q in queries:
        counts=collections.Counter();total=0
        while q!=-1:counts[letters[q]]+=1;total+=sum(value%2 for value in counts.values())<=1;q=parent[q]
        result.append(total)
    return ' '.join(map(str,result))
def ancestor_random(r):
    n=r.randint(1,12);return ''.join(r.choice('abcd') for _ in range(n)),[(i,r.randrange(i)) for i in range(1,n)],[r.randrange(n) for _ in range(r.randint(1,12))]
add(16,'到祖先路径能重排成回文的数量','树根为0。对每个查询节点q，统计其祖先v（包括q自己）中，q到v的整段节点字母可以重排为回文的数量。回文重排等价于奇数次字母至多一种。','第一行n m，第二行n个小写字母组成的串，接着n−1行无向边u v，最后一行m个查询节点。1≤n,m≤100000，节点编号0..n−1，保证树合法。','DFS维护根路径字母的异或掩码，以及当前路径各祖先的父节点前缀掩码频次。当前前缀与候选掩码异或为0或某个单比特时计数，共查27种；回溯时移除当前掩码。','q到v的字符奇偶掩码恰等于根到q前缀异或根到parent(v)前缀。频次表仅含当前祖先链上的这些父前缀，查0与26种单比特差异准确枚举所有回文重排路径。回溯删除保证不会混入兄弟子树。','时间O(26n+m)，空间O(n+m)。',[('abcacbc',[(0,1),(1,2),(2,3),(2,4),(4,5),(4,6)],[6,5,3]),('aaa',[(0,1),(1,2)],[2,0]),('ab',[(0,1)],[1])],'样例1：按正文逐条祖先路径检查，结果为3 4 1。样例2：所有同字母路径都能回文重排，节点2有3位祖先、根有1位，输出3 1。样例3：节点1自身b有效，ba不能重排回文，输出1。',ancestor_random,lambda x:f'{len(x[0])} {len(x[2])}\n{x[0]}\n'+''.join(f'{a} {b}\n' for a,b in x[1])+' '.join(map(str,x[2]))+'\n',ancestor_oracle,'''def solve(d):
    n,m=map(int,d[:2]);letters=d[2];g=[[] for _ in range(n)];offset=3
    for _ in range(n-1):
        a,b=map(int,d[offset:offset+2]);offset+=2;g[a].append(b);g[b].append(a)
    answers=[0]*n;counts={0:1};stack=[(0,-1,0,False)]
    while stack:
        node,parent,mask,exit=stack.pop()
        if exit:
            counts[mask]-=1
            if counts[mask]==0:del counts[mask]
            continue
        mask^=1<<(ord(letters[node])-97);answers[node]=counts.get(mask,0)+sum(counts.get(mask^(1<<bit),0) for bit in range(26));counts[mask]=counts.get(mask,0)+1;stack.append((node,parent,mask,True))
        for child in g[node]:
            if child!=parent:stack.append((child,node,mask,False))
    return ' '.join(str(answers[int(q)]) for q in d[offset:])
''',[('只允许全偶数掩码','counts.get(mask,0)+sum(counts.get(mask^(1<<bit),0) for bit in range(26))','counts.get(mask,0)'),('计入兄弟路径的前缀','counts[mask]-=1','counts[mask]-=0')],[(('a'*100000,[(i-1,i) for i in range(1,100000)],list(range(100000))),' '.join(map(str,range(1,100001)))), (('a'*100000,[(0,i) for i in range(1,100000)],[99999]*100000),' '.join(['2']*100000))],timeLimit=6,maxInputBytes=1900020)

def sets_oracle(a):return ''.join('1' if any(set(a[i:i+k])==set(range(1,k+1)) for i in range(len(a)-k+1)) else '0' for k in range(1,len(a)+1))
def permutation_random(r):
    a=list(range(1,r.randint(1,10)+1));r.shuffle(a);return a
add(18,'排列的连续前缀集合掩码','对排列1..n的每个k，判断是否存在连续子数组，其值集合恰为{1..k}，依次输出n位01串。','第一行n，第二行1..n的一个排列。源题未提供数值上界，本站范围1≤n≤100000。','求每个值的位置，依次加入1..k并维护最左、最右位置；两位置跨度恰好为k即连续。','排列没有重复，已有k个不同位置，若最大与最小位置之间恰容纳k格，则中间没有缺失位置；反过来任何连续k格的跨度必为k，故条件充要。','时间O(n)，空间O(n)。',[[2,1,4,3],[3,1,2,5,4],[1]],'样例1：k为1、2、4时位置连续，输出1101。样例2：k为1、2、3、5时连续，输出11101。样例3：唯一元素自己组成集合{1}，输出1。',permutation_random,array,sets_oracle,'''def solve(d):
    n=int(d[0]);position=[0]*(n+1)
    for i,value in enumerate(map(int,d[1:])):position[value]=i
    left=n;right=-1;answer=[]
    for k in range(1,n+1):left=min(left,position[k]);right=max(right,position[k]);answer.append('1' if right-left+1==k else '0')
    return ''.join(answer)
''',[('把跨度多算一格','right-left+1==k','right-left==k'),('忽略区间中间缺口','right-left+1==k','True')],[(list(range(1,100001)),'1'*100000),(list(range(100000,0,-1)),'1'*100000)],output='输出长度n的01字符串，第k位表示是否存在值集合{1..k}的连续子数组。',maxInputBytes=700007)

def minute(s):return int(s[:2])*60+int(s[3:])
def bus_oracle(x):
    times,now=x;candidates=[minute(now)-minute(t) for t in times if minute(t)<minute(now)]
    return str(min(candidates) if candidates else -1)
def clock(r):
    t=r.randrange(1440);return f'{t//60:02}:{t%60:02}'
add(20,'距当天上一班已发车公交的分钟数','给定当天发车时刻和当前时刻，求距离最近一班已经发出的公交过了多少分钟。恰好当前时刻发车的公交不算已发出；当天还没有车发出时返回−1，不跨到昨天。','第一行n，随后n行HH:MM格式的发车时刻，最后一行当前时刻。源题无上界，本站0≤n≤100000，时间范围00:00..23:59。列表按非递减时间给出，可重复。','转换为从午夜开始的分钟数，取严格小于当前分钟的最大发车分钟，再相减。','严格小于条件准确排除尚未发出班次。在已发出班次中，发车时间最大对应经过时间最小，即最近一班。','时间O(n)，额外空间O(1)（除输入）。',[(['12:30','14:00','19:55'],'14:30'),(['12:30','14:00'],'14:00'),(['00:00'],'00:00')],'样例1：最近已发车时间14:00，已经30分钟。样例2：14:00班次尚未算发出，只能看12:30，过去90分钟。样例3：恰好00:00的车不计已发出，没有更早当天班次，输出−1。',lambda r:(sorted(clock(r) for _ in range(r.randint(0,15))),clock(r)),lambda x:str(len(x[0]))+'\n'+'\n'.join(x[0])+('\n' if x[0] else '')+x[1]+'\n',bus_oracle,'''def solve(d):
    def minutes(t):return int(t[:2])*60+int(t[3:])
    current=minutes(d[-1]);last=-1
    for i in range(1,int(d[0])+1):
        t=minutes(d[i])
        if t<current:last=max(last,t)
    return str(current-last if last>=0 else -1)
''',[('恰好发车也计入','if t<current:','if t<=current:'),('取最早而不是最近班次','last=max(last,t)','last=t if last<0 else min(last,t)')],[((['00:00']*100000,'23:59'),'1439'),((['23:59']*100000,'23:59'),'-1'),(([],'12:00'),'-1')],maxInputBytes=600013)

def newspaper_valid(value,output):
    width,paragraphs=value;lines=output.replace('\r\n','\n').split('\n')
    if lines and lines[-1]=='':lines.pop()
    if len(lines)<3 or lines[0]!='*'*(width+4) or lines[-1]!=lines[0]:return False
    paragraph=offset=0
    for line in lines[1:-1]:
        if paragraph>=len(paragraphs) or len(line)!=width+4 or not line.startswith('* ') or not line.endswith(' *'):return False
        content=line[2:-2];words=content.split(' ');words=[word for word in words if word];expected=paragraphs[paragraph]
        if not words or words!=expected[offset:offset+len(words)]:return False
        offset+=len(words);last=offset==len(expected)
        if last or len(words)==1:
            left=len(content)-len(content.lstrip(' '));right=len(content)-len(content.rstrip(' '))
            if right not in (left,left+1) or content.strip(' ')!=' '.join(words):return False
        else:
            if content[0]==' ' or content[-1]==' ':return False
            gaps=[];position=len(words[0])
            for word in words[1:]:
                start=position
                while position<len(content) and content[position]==' ':position+=1
                gaps.append(position-start);position+=len(word)
            if not gaps or min(gaps)<1 or max(gaps)-min(gaps)>1 or gaps!=sorted(gaps,reverse=True):return False
        if last:paragraph+=1;offset=0
    return paragraph==len(paragraphs) and offset==0
def newspaper_oracle(value):
    width,paragraphs=value;lines=['*'*(width+4)]
    for words in paragraphs:
        for word in words:
            padding=width-len(word);lines.append('* '+' '*(padding//2)+word+' '*(padding-padding//2)+' *')
    output='\n'.join(lines+[lines[0]]);assert newspaper_valid(value,output)
    return output
def newspaper_random(r):
    width=r.randint(5,15)
    return width,[[''.join(r.choice('abc*09') for _ in range(r.randint(1,width))) for _ in range(r.randint(1,10))] for _ in range(r.randint(1,5))]
add(6,'任意合法分行的段落星框排版','按顺序将各段单词排入文本框，不拆词、不跨段落，每行内容宽width。非段末且有多个词的行须两端对齐：空格均分，余数先给左侧间隙。段末行及任何单词独占行须居中，奇数剩余空格多出的一个放右侧。外侧各加一个空格及星号，上下为星号边框。不要求贪心或最少行数，任意满足规则的分行均接受；段落之间不插空行。原站样例显示省略了对齐空格，本站补齐。','第一行width P；随后P行，每行先词数再该段各词。5≤width≤50，1≤P≤20，每段1..10词，每词长1..width。本站词使用可见ASCII非空白字符（含*也允许）。','参考方案选择每行贪心放尽可能多的词；一般非段末行用商与余数均分空格，段末或单词行计算左右居中空格。其他合法分行同样正确。','词序与段落边界在依次处理时保持不变；每行长度受放入条件保证。空格商余数分配满足均匀且左侧优先；居中用左右差不超过1、右侧不短于左侧。加外边距及星框后得到满足全部要求的合法输出。','时间O(输出长度)，空间O(输出长度)。',[(16,[['Hello','world'],['How','areYou','doing'],['Please','look','and','align','to','the','center']]),(5,[['a','b','c']]),(6,[['abc']])],'样例1：参考贪心输出5个内容行；首行Hello world内容左右分别补2、3空格，Please/look/and的两间隙分别为2、1空格，最后center两侧各补5空格；每行连边框20列。样例2：可整段a b c一行，也可分别居中三行，均接受。样例3：abc内容宽3，剩3空格左1右2；加两侧外边距和星号后总宽10。',newspaper_random,lambda x:f'{x[0]} {len(x[1])}\n'+''.join(str(len(words))+' '+' '.join(words)+'\n' for words in x[1]),newspaper_oracle,'''def solve(d):
    width,p=map(int,d[:2]);index=2;result=['*'*(width+4)]
    for _ in range(p):
        count=int(d[index]);words=d[index+1:index+1+count];index+=count+1;start=0
        while start<count:
            end=start;letters=0
            while end<count and letters+len(words[end])+end-start<=width:letters+=len(words[end]);end+=1
            row=words[start:end]
            if end==count or len(row)==1:
                content=' '.join(row);padding=width-len(content);left=padding//2;content=' '*left+content+' '*(padding-left)
            else:
                gaps=len(row)-1;base,extra=divmod(width-letters,gaps);content=''.join(word+(' '*(base+(i<extra)) if i<gaps else '') for i,word in enumerate(row))
            result.append('* '+content+' *');start=end
    result.append(result[0]);return '\\n'.join(result)
''',[('居中奇数空格多给左侧','left=padding//2','left=(padding+1)//2'),('两端对齐余数优先右侧','i<extra','i>=gaps-extra')],[((50,[['a'*50]*10 for _ in range(20)]),newspaper_oracle((50,[['a'*50]*10 for _ in range(20)])))],checker='oa-newspaper',output='输出完整纯文本星号框，不带行数；每行width+4列。允许任意满足排版规则的换行，不要求与样例相同。',maxInputBytes=10270)

next(s for s in SPECS if s['id']==15)['edges'][-1]=([0]+[-10000]*33,'-50000')
next(s for s in SPECS if s['id']==14)['mutants'][0]=('高度差多算1','answer=min(answer,ranked[right][0]-ranked[left][0])','answer=min(answer,ranked[right][0]-ranked[left][0]+1)')
next(s for s in SPECS if s['id']==6)['explanation']='样例1：展示每词单独居中的合法方案，共12个内容行；Hello长5，在16列内容区左补5、右补6空格，每行连外边距与星框共20列。也可按参考程序贪心分为5个内容行，两种都接受。样例2：样例将a、b、c各放一行并在内容区左右各补2格；整段a b c一行同样合法。样例3：abc内容宽3，剩3空格左1右2；加两侧外边距和星号后总宽10。'
BLOCKED={4:'基础利润明确sum(strategy[i]*rates[i])，却又说卖出−1贡献+rates[i]，符号规则矛盾；无法判断窗口内外的收益应如何统一。',9:'未指定电池选择顺序或优化目标、无可用电池时如何处理；t=8两块容量5却称完全耗尽2块，与完全耗尽定义冲突。',17:'源题主动提示记忆不准确；每行横向最多2节点究竟是每跳、连续或累计，以及向上能否跨行不清楚，无法唯一确定最短路状态。',19:'原n=200000允许全−10⁹值，孩子数组含索引1..199999及200001个−1。标准整数输入最坏4288898字节，超过现有4194304字节单用例门禁；本批不缩小原n或提高输入上限，待容量单独升级及任意最优路径语义checker后接入。'}
NOTES={5:'严格按正文消耗/兑换规则，前两例周期数由13/4纠正为5/2，不添加消耗A产生P等源题未给规则。',6:'源题未限定贪心分行，oa-newspaper接受所有合法排版；独立性质oracle和每词单独居中的非贪心正控，不强制唯一结果。',8:'welcome仅ome一个长度3窗口恰有两元音，原答案2纠正为1。',12:'123/456/789数根均6，0和9倍数单独区分。',13:'带内部空格条目按原示例作为不可拆项，每条一行输入；源缺条目数上界明确为本站每段最多100项。',14:'gap=1允许相邻对，按明确|a−b|≥gap判定，纠正示例文字“非相邻”。',16:'使用路径前缀奇偶统计与逐祖先频次计数独立对照，含100000链与星树和100000查询。'}

def execute_many(path,inputs):
    result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert result.returncode==0,(str(path),result.stderr[:1500]);outputs=json.loads(result.stdout);assert len(outputs)==len(inputs)
    return outputs
def matches(spec,value,actual,expected):
    if spec.get('checker')=='oa-newspaper':return newspaper_valid(value,actual) and newspaper_valid(value,expected)
    if spec.get('checker')=='exact':return actual==expected
    return actual.split()==expected.split()
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};selected=set(map(int,sys.argv[1:]));entries=[];reports=[]
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(x['id'].split('-')[-1]) not in selected];reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(x['id'].split('-')[-1]) not in selected]
    for spec in sorted(SPECS,key=lambda s:s['id']):
        if selected and spec['id'] not in selected:continue
        assert spec['maxInputBytes']<=4194304
        identifier=f"oa-uber-{spec['id']}";rng=random.Random(20261100+spec['id']);reader='sys.stdin.read().removesuffix("\\n")' if spec.get('raw') else 'sys.stdin.read().split()';code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)];oracles=[dict(input=spec['encode'](value),expectedOutput=spec['oracle'](value)+'\n') for value in values]
        formal=list(zip(values[:3],[c['expectedOutput'] for c in oracles[:3]]))+[(value,output+'\n') for value,output in spec['edges']]+list(zip(values[3:27],[c['expectedOutput'] for c in oracles[3:27]]));cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=spec['encode'](value),expectedOutput=output,hidden=i>=3,weight=1) for i,(value,output) in enumerate(formal)]
        for c in oracles+cases:assert len(c['input'].encode())<=spec['maxInputBytes'],(identifier,'input byte budget',len(c['input'].encode()))
        outputs=execute_many(path,[c['input'] for c in oracles+cases])
        for i,(value,case,actual) in enumerate(zip(values+[v for v,o in formal],oracles+cases,outputs)):assert matches(spec,value,actual,case['expectedOutput']),(identifier,i,case['expectedOutput'][:120],actual[:120])
        mutants=[];controls=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code,(identifier,old);changed=code.replace(old,new);negative=OUT/'negative-controls'/f'{identifier}-{index}.py';negative.write_text(changed);actuals=execute_many(negative,[c['input'] for c in cases]);rejected=[i for i,((value,expected),actual) in enumerate(zip(formal,actuals)) if not matches(spec,value,actual,expected)]
            assert rejected,(identifier,label,'survived');mutants.append(dict(name=label,code=changed));controls.append(dict(name=label,rejectedByCases=rejected))
        if spec['id']==6:
            positive_code='''def solve(d):
    width,p=map(int,d[:2]);index=2;lines=['*'*(width+4)]
    for _ in range(p):
        count=int(d[index]);index+=1
        for word in d[index:index+count]:
            padding=width-len(word);lines.append('* '+' '*(padding//2)+word+' '*(padding-padding//2)+' *')
        index+=count
    return '\\n'.join(lines+[lines[0]])
if __name__=='__main__':
    import sys
    print(solve(sys.stdin.read().split()))
''';positive=OUT/'references'/f'{identifier}-non-greedy.py';positive.write_text(positive_code)
            for value,actual in zip(values,execute_many(positive,[c['input'] for c in oracles])):assert newspaper_valid(value,actual)
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Uber'],description=spec['description']+'\n\n本站标准输入输出已明确；源题未给的范围会标注为本站约定。',input=spec['input'],output=spec.get('output','输出一个整数答案。'),explanation=spec['explanation'],hints=[spec['idea']],timeLimit=spec.get('timeLimit',4),memoryLimit=262144,outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        process=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert process.returncode==0,(identifier,process.stderr[:1500]);normalized=process.stdout;assert '\ufffd' not in normalized
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=spec['maxInputBytes'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(identifier,'163 independent checks;',len(cases)-3,'hidden; two normal-exit mutants rejected',flush=True)
    entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20261100,problems=reports,skipped={f'oa-uber-{k}':v for k,v in BLOCKED.items()},note='Local runpy batch execution, fresh __main__/streams per case, not per-case OS isolation; real sandbox required. Newspaper oracle independently validates formatting properties and permits non-greedy line breaks. Byte budgets assume documented standard decimal serialization, not adversarial whitespace inflation.'),'reviews':dict(schemaVersion=1,items=[dict(id=f'oa-uber-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,NOTES.get(i,'正文定义明确，独立参考与暴力对照、大边界及两错误程序验证；标准输入字节上界已审计。'))) for i in range(1,21)])}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
