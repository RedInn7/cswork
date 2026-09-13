"""Final Microsoft batch: independently authored references and enumerative oracles."""
from array import array
from collections import Counter
from itertools import combinations,permutations,product
from pathlib import Path
import hashlib,json,random,subprocess,sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='microsoft-final';SPECS=[]
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,random=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def compression_oracle(x):
    s,k=x;best=len(s)
    from itertools import groupby
    for i in range(len(s)-k+1):
        t=s[:i]+s[i+k:];parts=[]
        for c,g in groupby(t):
            run=list(g);parts.append(c if len(run)==1 else str(len(run))+c)
        best=min(best,len(''.join(parts)))
    return best
add(61,'删除连续K字符后的最短压缩长度','删除恰好K个连续字符，再将每个连续相同字符段压缩成“数量+字符”，单字符段只写字符。返回最短压缩长度，允许K=0或K=N。源样例有字符计数笔误，按该明确压缩规则计算。','第一行K，第二行大写字母串S。保留catalog范围：1≤N≤1000000，0≤K≤min(100000,N)。','预处理每个前缀、后缀的压缩长度以及边界连续段长度。枚举删除窗口，两侧不同字符时直接相加，相同时去掉两段旧成本，再加合并段成本。','删除只能改变左右边界相接的两个连续段，其他压缩段完全不变。记录边界段长度即可精确计算合并差额。枚举全部N−K+1个合法起点，取最小即覆盖全部操作。','时间O(N log N)字符级上界（计算至多7位十进制长度）；固定约束下O(N)。空间O(N)，四个紧凑整数数组。',[('ABBBCCDDCCC',3),('AAAAAAAAAABXXAAAAAAAAAA',3),('ABCDDDEFG',2)],'样例1：删DDC后剩ABBBCCCC，压缩A3B4C长5。样例2：两侧各10个A，删BXX后为20A，长3；原21A计数笔误已校正。样例3：删EF后ABC3DG长6。',lambda r:(''.join(r.choice('ABC') for _ in range(n)),r.randint(0,n)) if (n:=r.randint(1,18)) else None,[(('A'*1000000,100000),7),(('AB'*500000,100000),900000),(('A'*100000,100000),0)],lambda x:f'{x[1]}\n{x[0]}\n',compression_oracle,
'''from array import array
def solve(d):
    k=int(d[0]);s=d[1];n=len(s)
    def cost(v):return v if v<2 else len(str(v))+1
    prefix=array('I',[0])*(n+1);suffix=array('I',[0])*(n+1);left=array('I',[0])*(n+1);right=array('I',[0])*(n+1)
    for i in range(n):
        run=left[i] if i and s[i]==s[i-1] else 0;left[i+1]=run+1;prefix[i+1]=prefix[i]+cost(run+1)-cost(run)
    for i in range(n-1,-1,-1):
        run=right[i+1] if i+1<n and s[i]==s[i+1] else 0;right[i]=run+1;suffix[i]=suffix[i+1]+cost(run+1)-cost(run)
    answer=n
    for l in range(n-k+1):
        r=l+k;value=prefix[l]+suffix[r]
        if l and r<n and s[l-1]==s[r]:value+=cost(left[l]+right[r])-cost(left[l])-cost(right[r])
        answer=min(answer,value)
    return str(answer)
''',[('不合并删除后相邻同字符','if l and r<n and s[l-1]==s[r]:','if False:'),('单字符也写数量','return v if v<2 else len(str(v))+1','return 0 if v==0 else len(str(v))+1')],1000010,time=8)

def square_oracle(x):
    small,big=x
    def fits(side):
        full=(1<<(side*side))-1
        def visit(mask,a,b):
            if mask==full:return True
            pos=next(i for i in range(side*side) if not mask>>i&1);r,c=divmod(pos,side)
            if a and visit(mask|1<<pos,a-1,b):return True
            if b and r+1<side and c+1<side:
                cells=(1<<pos)|(1<<(pos+1))|(1<<(pos+side))|(1<<(pos+side+1))
                if not mask&cells and visit(mask|cells,a,b-1):return True
            return False
        return visit(0,small,big)
    return max(s for s in range(int((small+4*big)**0.5)+1) if fits(s))
add(62,'大小方砖拼出的最大正方形边长','有m块1×1和n块2×2方砖，可选部分方砖在网格上无重叠、无空隙地拼正方形，求最大整数边长。','一行m n，0≤m,n≤10⁹。原范围下界写1，但源例明确包含0，本站同时保留零砖情况。','先取总面积平方根L。偶数边长只受总面积约束；奇数L至少需要2L−1块单位砖，如果不足就降为L−1。','边长L最多容纳floor(L/2)²块大砖，其余格子用单位砖即可。偶数L若大砖不足，总面积约束保证单位砖补足；奇数L除了总面积外，还必须填满2L−1个不能由最大大砖阵列覆盖的边缘格。L不合法时L−1是偶数且面积更小，因此必合法且最优。','时间O(log(m+4n))整数平方根，空间O(1)。',[(8,0),(4,3),(0,18)],'样例1：8块单位砖只能拼边长2，9格不足。样例2：三块大砖加四块小砖填满4×4。样例3：只用大砖，最大偶数边长8，用16块，余2块。',lambda r:(r.randint(0,10),r.randint(0,3)),[((10**9,10**9),70710),((0,10**9),63244),((0,0),0)],lambda x:f'{x[0]} {x[1]}\n',square_oracle,
'''from math import isqrt
def solve(d):
    small,big=map(int,d);side=isqrt(small+4*big)
    if side%2 and small<2*side-1:side-=1
    return str(side)
''',[('只考虑面积','if side%2 and small<2*side-1:','if False:'),('大砖误算面积二','small+4*big','small+2*big')],23)

def skyline_oracle(a):
    best=-1;chosen=None
    def visit(i,used,b,total):
        nonlocal best,chosen
        if i==len(a):
            if total>best:best=total;chosen=b.copy()
            return
        for h in range(1,a[i]+1):
            if h not in used:visit(i+1,used|{h},b+[h],total+h)
    visit(0,set(),[],0);assert chosen is not None
    return ' '.join(map(str,chosen))
def skyline_random(r):
    n=r.randint(1,6);a=[r.randint(i+1,8) for i in range(n)];r.shuffle(a);return a
def skyline_valid(a,actual,expected):
    try:
        b=list(map(int,actual.split()));target=list(map(int,expected.split()))
        return len(b)==len(a) and len(set(b))==len(a) and all(1<=v<=h for v,h in zip(b,a)) and sum(b)==sum(target)
    except ValueError:return False
add(63,'总高度最大的互异摩天楼','给每栋楼分配正整数高度B[i]，不超过对应上限A[i]，所有高度互不相同，且总和最大。保证有解，任意最优赋值均接受。','第一行N（1..50000），第二行N个A[i]（1..10⁹），保证存在合法正整数互异赋值。','按上限从大到小分配，每栋取不超过上限且严格小于已分配高度的最大整数，再放回原下标。','若两个上限按降序排列但分配高度逆序，交换这两个高度仍满足上限。因此存在按上限排序后高度严格递减的最优方案。按序将每项尽量提高到min(上限,前项−1)不会挤占任何已选高度，并逐项支配所有可行递减方案，总和最优。','时间O(N log N)，空间O(N)。',[[1,2,3],[9,4,3,7,7],[2,5,4,5,5]],'样例1：各楼取上限即可，总6。样例2：两个上限7分成7与6，其余9、4、3，总29，两栋7的分配可交换。样例3：只能使用1..5五个不同高度，总15；例如1、2、3、4、5合法。',skyline_random,[([10**9]*50000,' '.join(str(10**9-i) for i in range(50000))),(list(range(1,50001)),' '.join(map(str,range(1,50001))))],arr,skyline_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));order=sorted(range(len(a)),key=lambda i:-a[i]);result=[0]*len(a);previous=10**9+1
    for i in order:previous=min(a[i],previous-1);result[i]=previous
    return ' '.join(map(str,result))
''',[('允许高度重复','previous=min(a[i],previous-1)','previous=a[i]'),('白白降低最高楼','previous=10**9+1','previous=max(a)')],550010,checker='oa-optimal-distinct',valid=skyline_valid,output='输出N个正整数高度B，保持楼的原输入次序。',time=6)

def border_oracle(s):return max(i for i in range(len(s)) if s[:i]==s[len(s)-i:]) if s else 0
add(64,'最长公共真前后缀长度','求字符串最长的既是真前缀也是真后缀的长度；必须短于完整字符串，前后缀允许重叠，空串长度0合法。','一行小写字母串S，长度1..1000000。','计算KMP前缀函数，最后一项就是完整串的最长真边界长度。','前缀函数在每个位置记录以该位置结束的前缀的最长真边界。失配时只能退到已匹配前缀的更短边界，递归候选链穷尽所有可能，最终末项即所求。','时间O(N)，空间O(N)，使用紧凑整数数组。',['abbabba','codility','aaaa'],'样例1：abba同时在首尾，长度4。样例2：无非空公共真前后缀，0。样例3：aaa允许重叠，长度3。',lambda r:''.join(r.choice('abc') for _ in range(r.randint(1,30))),[('a'*1000000,999999),('a'*999999+'b',0),('ab'*500000,999998)],lambda s:s+'\n',border_oracle,
'''from array import array
def solve(d):
    s=d[0];prefix=array('I',[0])*len(s);j=0
    for i in range(1,len(s)):
        while j and s[i]!=s[j]:j=prefix[j-1]
        if s[i]==s[j]:j+=1
        prefix[i]=j
    return str(prefix[-1])
''',[('错误允许整个字符串','return str(prefix[-1])','return str(len(s))'),('错误禁止重叠','return str(prefix[-1])','return str(min(prefix[-1],len(s)//2))')],1000001,time=6)

def tiles_oracle(a):
    best=0
    for k in range(1,4):
        for starts in combinations(range(len(a)-1),k):
            if all(j>=i+2 for i,j in zip(starts,starts[1:])):best=max(best,sum(a[i]+a[i+1] for i in starts))
    return best
add(65,'最多三块双格瓷砖的最大覆盖和','最多放三块瓷砖，每块覆盖原数组中两个相邻元素。不能重叠或越界，可一块也不放，求覆盖元素总和最大值。','第一行N，第二行N个整数。源无数值范围，本站1≤N≤200000，元素−10⁹..10⁹。','前缀DP维护使用至多0、1、2、3块时最大和。最后元素可以不盖；或者用一块覆盖最后两格，并接在两格前、少一块的最优方案后。','合法方案若覆盖最后格，其最后瓷砖必须覆盖末两格，前面不能重叠；否则属于更短前缀。两个分支穷尽所有方案，零初始化允许不使用负收益瓷砖。','时间O(3N)，除输入外空间O(1)。',[[2,3,5,2,3,4,6,4,1],[1,2,3,3,2],[-1,-2]],'样例1：盖3+5、3+4、6+4，总25。样例2：盖2+3和3+2，总10，只需两块。样例3：全部负数，一块不放得0。',lambda r:[r.randint(-8,10) for _ in range(r.randint(1,11))],[([10**9]*200000,6000000000),([-10**9]*200000,0)],arr,tiles_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));before2=[0]*4;before=[0]*4
    for i,value in enumerate(a):
        current=before.copy()
        if i:
            for k in range(1,4):current[k]=max(before[k],before2[k-1]+a[i-1]+value)
        before2,before=before,current
    return str(before[3])
''',[('允许瓷砖重叠','before2[k-1]+','before[k-1]+'),('最多只用两块','return str(before[3])','return str(before[2])')],2400010)

def spike_oracle(a):
    for size in range(len(a),0,-1):
        for ids in combinations(range(len(a)),size):
            for b in set(permutations(a[i] for i in ids)):
                if any(all(b[i]<b[i+1] for i in range(p)) and all(b[i]>b[i+1] for i in range(p,len(b)-1)) for p in range(len(b))):return size
def spike_random(r):return [r.randint(-2,3) for _ in range(r.randint(1,6))]
add(67,'任意重排可得到的最长尖峰','从数组任选一些数并重排，构成先严格上升后严格下降的序列。两段共享峰值，任一段可只有峰值一个元素，所以纯升、纯降、单元素也合法。返回最大长度。','第一行N，第二行N个整数。源未给数值范围，本站1≤N≤200000，元素−10⁹..10⁹。','最高值只能在峰顶使用一次，其他每种值最多在左右各出现一次。因此答案是1加上非最大值的min(频次,2)之和。','同一值在严格单调的一侧至多出现一次，最大值只能当唯一峰顶，给出该上界。选择最大值为峰，把每种较小值的一份升序放左侧，若有第二份就降序放右侧，恰好达到上界。','时间O(N)期望，空间O(不同值个数)。',[[1,2],[2,5,3,2,4,1],[5,5,5]],'样例1：1、2已经是尖峰，长度2。样例2：可排1、2、3、4、5、2，长度6。样例3：严格性禁止重复峰值，只能用一个5。',spike_random,[([10**9]*200000,1),(list(range(100000))*2,199999)],arr,spike_oracle,
'''from collections import Counter
def solve(d):
    counts=Counter(map(int,d[1:]));highest=max(counts)
    return str(1+sum(min(v,2) for key,v in counts.items() if key!=highest))
''',[('重复使用峰值','if key!=highest','if True'),('每种值仅用一次','min(v,2)','min(v,1)')],2400010)

def mixed_oracle(s):
    return sum(bool(low:=[i for i,v in enumerate(s) if v==c]) and bool(high:=[i for i,v in enumerate(s) if v==c.upper()]) and all(i<j for i in low for j in high) for c in 'abcdefghijklmnopqrstuvwxyz')
add(70,'小写全部先于大写的字母种数','统计同时出现大小写、且该字母每个小写位置都早于任何大写位置的不同英文字母个数。只按字母种类计数。','一行英文字母串，长度1..100000，只含a-z与A-Z。','记录每种字母最后一次小写位置和第一次大写位置；两者都存在且前者更小则合格。','全部小写先于全部大写等价于最晚小写先于最早大写。每种字母单独检查这一充要条件，累加即为不同合格字母种数。','时间O(N+26)，空间O(26)。',['aaAbBcC','aAaB','ABC'],'样例1：a、b、c的小写都先出现，计3种。样例2：a在A之后再次小写，不合格；b没有小写，总0。样例3：都只有大写，0。',lambda r:''.join(r.choice('abcABC') for _ in range(r.randint(1,30))),[('a'*50000+'A'*50000,1),('aA'*50000,0),('abcdefghijklmnopqrstuvwxyz'+'ABCDEFGHIJKLMNOPQRSTUVWXYZ'*3845,26)],lambda s:s+'\n',mixed_oracle,
'''def solve(d):
    s=d[0];last=[-1]*26;first=[len(s)]*26
    for i,c in enumerate(s):
        if c.islower():last[ord(c)-97]=i
        else:first[ord(c)-65]=min(first[ord(c)-65],i)
    return str(sum(last[i]>=0 and first[i]<len(s) and last[i]<first[i] for i in range(26)))
''',[('只要两种大小写存在',' and last[i]<first[i]',''),('只统计字母a','for i in range(26)))','for i in range(1)))')],100001)

def pattern_oracle(x):
    p,s=x
    for cuts in combinations(range(1,len(s)),len(p)-1):
        bounds=(0,)+cuts+(len(s),);parts=[s[bounds[i]:bounds[i+1]] for i in range(len(p))];forward={};backward={};ok=True
        for c,word in zip(p,parts):
            if (c in forward and forward[c]!=word) or (word in backward and backward[word]!=c):ok=False;break
            forward[c]=word;backward[word]=c
        if ok:return 1
    return 0
add(71,'字符模式与非空子串的双射匹配','将pattern的每个不同字符映射到一个非空字符串，要求同字符始终同串，不同字符不能同串。按模式依次连接映射串，判断能否恰好得到s。','两行pattern、s，均只含小写字母，长度都为1..20。','回溯处理模式与文本的位置。已有映射时只验证该固定串；未映射时枚举当前位置所有非空前缀，跳过已被其他字符占用的串，再递归。','合法映射对当前字符要么已经确定，要么必须是未消费文本的一段非空前缀。枚举所有这种前缀不漏解，反向集合拒绝多对一；当两串同时结束时匹配完整，其他终止情况均非法。','时间O(|s|²·2^|s|)保守上界，空间O(|s|+|pattern|)，完整长度上限20。',[('abab','redblueredblue'),('aaaa','asdasdasdasd'),('aabb','xyzabcxyzabc')],'样例1：a→red、b→blue可以组成目标，输出1。样例2：a→asd，重复4次正好，输出1。样例3：无法分成两个相同a串后接两个相同b串，输出0。',lambda r:(''.join(r.choice('abc') for _ in range(r.randint(1,5))),''.join(r.choice('ab') for _ in range(r.randint(1,9)))),[(('abcdefghijklmnopqrst','abcdefghijklmnopqrst'),1),(('abcdefghijklmnopqrst','a'*20),0),(('a'*20,'a'*20),1),(('abcdefghij','a'*20),0)],lambda x:'\n'.join(x)+'\n',pattern_oracle,
'''def solve(d):
    pattern,s=d;mapping={};used=set()
    def visit(i,j):
        if i==len(pattern):return j==len(s)
        if len(s)-j<len(pattern)-i:return False
        c=pattern[i]
        if c in mapping:
            word=mapping[c];return s.startswith(word,j) and visit(i+1,j+len(word))
        for end in range(j+1,len(s)-(len(pattern)-i-1)+1):
            word=s[j:end]
            if word in used:continue
            mapping[c]=word;used.add(word)
            if visit(i+1,end):return True
            used.remove(word);del mapping[c]
        return False
    return str(int(visit(0,0)))
''',[('错误禁止字符复用','return s.startswith(word,j) and visit(i+1,j+len(word))','return False'),('只看模式耗尽忽略剩余字符','return j==len(s)','return True')],42,time=6)

BLOCKED={66:'原始正文的unique satisfaction未定义是普通和还是去重和。例2普通和为9、按不同值求和后两块最多5，均不是源10；不能唯一确定评价函数，N=1必须切一边也无定义。',68:'三段划分清晰但附加low在high之前未定义重复端点时是全部先后还是首个先后，low=high亦未定义；需要补全语义后配置任意合法排列checker。',69:'不可变原始正文也未给A[i]取值域，无法定义有限数组计数；小例暗示1..M但未明确一般条件。',72:'数学规则完整，N≤100000和值≤100000下的高维双XOR计数算法尚未完成复杂度与实际资源验证；不是题意缺失，待专项研究。'}
NOTES={61:'保留catalog整理后的样例，按实际字符数计算；catalog的10A+BXX+10A应压成20A，而immutable raw正文为11A+BXX+10A，其21A正确。两版本例子不同，不认定原始21A有误。保留catalog百万长度及K十万界，原始markdown未列数值界。',62:'原范围m,n下界1但源例使用0，允许0以覆盖原例，同时保留10亿上界。',63:'接受任意互异、逐项不超过上限且总和最优赋值；使用固定身份oa-optimal-distinct，不用参考排列作为唯一答案。'}
for spec in SPECS:
    if spec['n']==61:
        spec['desc']=spec['desc'].replace('源样例有字符计数笔误，按该明确压缩规则计算。','本站保留catalog整理后的样例并按实际字符数计算；该版本样例与原始快照的字符串不完全相同。')
        spec['explain']=spec['explain'].replace('原21A计数笔误已校正','catalog此处写21A与其输入不符；原始快照使用11+10个A，原始21A则正确')
def execute_many(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:]);return json.loads(p.stdout)
def matches(spec,actual,expected):return (skyline_valid(spec['current_value'],actual,expected) if spec.get('valid') else actual.replace('\r\n','\n')==expected.replace('\r\n','\n') if spec.get('checker')=='exact' else actual.split()==expected.split())
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']};selected=set(map(int,sys.argv[1:]));entries=[];reports=[]
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(x['id'].split('-')[-1]) not in selected];reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(x['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['n'] not in selected:continue
        identifier=f"oa-microsoft-{spec['n']}";rng=random.Random(20261400+spec['n']);reader='sys.stdin.read().removesuffix("\\n")' if spec.get('raw') else 'sys.stdin.read().split()';code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n';path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)];oracles=[dict(input=spec['encode'](value),expectedOutput=str(spec['oracle'](value))+'\n') for value in values];formal=list(zip(values[:3],[c['expectedOutput'] for c in oracles[:3]]))+[(value,str(answer)+'\n') for value,answer in spec['edges']]+list(zip(values[3:27],[c['expectedOutput'] for c in oracles[3:27]]));cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=spec['encode'](value),expectedOutput=answer,hidden=i>=3,weight=1) for i,(value,answer) in enumerate(formal)]
        assert spec['bound']<=33554432
        for c in cases+oracles:assert len(c['input'].encode())<=spec['bound'],(identifier,'input budget',len(c['input'].encode()))
        for i,(case,actual) in enumerate(zip(oracles+cases,execute_many(path,[c['input'] for c in oracles+cases]))):
            spec['current_value']=values[i] if i<len(values) else formal[i-len(values)][0]
            assert matches(spec,actual,case['expectedOutput']),(identifier,i,actual[:160],case['expectedOutput'][:160])
        controls=[];mutants=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code;changed=code.replace(old,new);negative=OUT/'negative-controls'/f'{identifier}-{index}.py';negative.write_text(changed);outputs=execute_many(negative,[c['input'] for c in cases]);rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if not (skyline_valid(formal[i][0],a,c['expectedOutput']) if spec.get('valid') else matches(spec,a,c['expectedOutput']))];assert rejected,(identifier,label,'survived');controls.append(dict(name=label,rejectedByCases=rejected));mutants.append(dict(name=label,code=changed))
        if spec['n']==63:
            positive_code=code.replace('key=lambda i:-a[i]','key=lambda i:(-a[i],-i)');positive=OUT/'positive-controls'/f'{identifier}.py';positive.parent.mkdir(exist_ok=True);positive.write_text(positive_code)
            for i,(case,actual) in enumerate(zip(oracles+cases,execute_many(positive,[c['input'] for c in oracles+cases]))):
                value=values[i] if i<len(values) else formal[i-len(values)][0]
                assert skyline_valid(value,actual,case['expectedOutput']),(identifier,'positive',i)
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Microsoft'],description=spec['desc']+'\n\n本站标准输入输出协议；来源未给出的范围已明确标注。',input=spec['limits'],output=spec.get('output','输出一个整数答案。'),explanation=spec['explain'],hints=[spec['idea']],timeLimit=spec.get('time',4),memoryLimit=spec.get('memory',262144),outputLimit=4096,checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True);assert p.returncode==0,(identifier,p.stderr[:1500]);normalized=p.stdout;assert len(normalized.encode())<=128*1024*1024 and '\ufffd' not in normalized
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions));reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=spec['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(identifier,'163 independent checks;',len(cases)-3,'hidden; two normal-exit mutants rejected',flush=True)
    entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20261400,problems=reports,skipped={f'oa-microsoft-{i}':v for i,v in BLOCKED.items()},note='Local runpy batched processes, fresh __main__/streams per case; not per-case OS isolation. Real sandbox required. Independent small oracles and normal-exit semantic mutants. Input bounds assume canonical decimal syntax.'),'reviews':dict(schemaVersion=1,items=[dict(id=f'oa-microsoft-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,NOTES.get(i,'正文规则明确，独立参考、暴力小输入、完整最大范围及正常退出错误程序已验证。'))) for i in range(61,73)])}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
