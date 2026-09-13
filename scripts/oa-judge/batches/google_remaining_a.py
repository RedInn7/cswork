"""Authored Google 21–40 audit. Never executes imported OA solution code."""
import collections
import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'
SEED = 20260922


def arr(a): return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def integers(r): return [r.randint(-5,5) for _ in range(r.randint(1,10))]
def tree(r):
    n=r.randint(1,10)
    return n,[(r.randrange(i),i) for i in range(1,n)]
def graph(n,edges):
    g=[[] for _ in range(n)]
    for a,b in edges:g[a].append(b);g[b].append(a)
    return g
def encode_tree(x):return str(x[0])+'\n'+''.join(f'{a+1} {b+1}\n' for a,b in x[1])
def last_oracle(x):
    s,k=x; a=list(s*k); left=True
    while len(a)>1:
        if left:a=[c for i,c in enumerate(a) if i%2==1]
        else:a=[c for i,c in enumerate(a) if (len(a)-1-i)%2==1]
        left=not left
    return a[0]
def subseq_oracle(a):
    best=1
    for mask in range(1,1<<len(a)):
        b=[v for i,v in enumerate(a) if mask>>i&1]
        if all(y==x+1 for x,y in zip(b,b[1:])):best=max(best,len(b))
    return str(best)
def segment_oracle(a):
    return str(max(j-i for i in range(len(a)) for j in range(i+1,len(a)+1) if all(a[k]<=a[k+1] for k in range(i,j-1))))
def change_oracle(a):
    candidates=set(a)|{min(a)-1,max(a)+1}
    return str(max(int(segment_oracle(a[:i]+[v]+a[i+1:])) for i in range(len(a)) for v in candidates))
def radius_oracle(x):
    n,edges=x;g=graph(n,edges);ans=n
    for root in range(n):
        d={root:0};q=[root]
        for u in q:
            for v in g[u]:
                if v not in d:d[v]=d[u]+1;q.append(v)
        ans=min(ans,max(d.values()))
    return str(ans)
def palindrome_oracle(x):
    n,edges,chars,queries=x;g=graph(n,edges);ss={}
    def visit(u,p):
        ss[u]=''.join(visit(v,u) for v in sorted(g[u]) if v!=p)+chars[u]
        return ss[u]
    visit(0,-1)
    return ' '.join('1' if ss[u]==ss[u][::-1] else '0' for u in queries)
def pattern_oracle(x):
    pattern,words=x
    # Independent expansion into the full finite language, only for small inputs.
    choices=[];i=0
    while i<len(pattern):
        if pattern[i]=='[':
            end=pattern.index(']',i);choices.append(pattern[i+1:end]);i=end+1
        else:choices.append(pattern[i]);i+=1
    language={''.join(t) for t in itertools.product(*choices)}
    matches=[w for w in words if w in language]
    return ' '.join([str(len(matches))]+matches)
def pattern_random(r):
    parts=[r.choice(['a','b','c','[ab]','[bc]']) for _ in range(r.randint(1,5))]
    words=[''.join(r.choice('abc') for _ in range(r.randint(1,6))) for _ in range(10)]
    words+=[''.join(p[1] if p.startswith('[') else p for p in parts)]
    return ''.join(parts),words
def forest_oracle(x):
    n,edges,cuts=x;parts=[{i} for i in range(n)];cut={frozenset(e) for e in cuts}
    for a,b in edges:
        if frozenset((a,b)) in cut:continue
        pa=next(p for p in parts if a in p);pb=next(p for p in parts if b in p)
        if pa is not pb:pa.update(pb);parts.remove(pb)
    return ' '.join([str(len(parts))]+list(map(str,sorted(map(len,parts)))))
def forest_random(r):
    n=r.randint(1,12);available=[0];edges=[];counts=collections.Counter()
    for i in range(1,n):
        p=r.choice(available);edges.append((p,i));counts[p]+=1
        if counts[p]==2:available.remove(p)
        available.append(i)
    return n,edges,[e for e in edges if r.randrange(2)]
def meetings_oracle(x):
    meetings,(ds,de)=x
    occupied={p for s,e in meetings for p in range(s,e) if not ds<=p<de}
    result=[]
    for p in sorted(occupied):
        if result and result[-1][1]==p:result[-1][1]=p+1
        else:result.append([p,p+1])
    return ' '.join([str(len(result))]+[str(v) for pair in result for v in pair])
def image_oracle(x):
    all_images,favs,q=x;remaining=iter(all_images);result=favs[:]
    result.extend(a for a in remaining if all(a!=f for f in favs))
    return ' '.join(result[:q]+['NULL']*max(0,q-len(result)))
def image_random(r):
    images=['i'+str(i) for i in range(r.randint(1,15))];r.shuffle(images)
    favs=r.sample(images,r.randint(0,len(images)))
    return images,favs,r.randint(1,len(images)+3)
def happy_oracle(x):
    a,m=x
    for day in range(1,len(a)+1):
        occupied=set(a[:day])
        if any(all(v in occupied for v in range(start,start+m)) for start in range(1,len(a)-m+2)):return str(day)
def happy_random(r):
    a=list(range(1,r.randint(1,12)+1));r.shuffle(a);return a,r.randint(1,len(a))
def token_oracle(x):
    text,entries=x;answer=[];i=0
    while i<len(text):
        options=[(len(t),-j,v) for j,(t,v) in enumerate(entries) if text.startswith(t,i)]
        if options:
            size,_,v=max(options);answer.append(v);i+=size
        else:answer.append(text[i]);i+=1
    return ' '.join([str(len(answer))]+answer)
def token_random(r):
    return ''.join(r.choice('abc') for _ in range(r.randint(1,15))),[(''.join(r.choice('abc') for _ in range(r.randint(1,4))),'ID'+str(i)) for i in range(r.randint(0,8))]


SPECS=[
dict(id=22,title='交替删除后的最后字符',tags=['数学','模拟'],desc='把字符串 S 重复 K 次。从左侧开始删除第 1、3、5…个字符；下一轮从右侧开始删除第 1、3、5…个字符。左右交替进行，剩一个字符时停止，输出它。',input='第一行 S（1..100 个英文字母、数字或 $ # & *），第二行 K（1..10000）。',idea='幸存的原下标始终是等差数列。维护首项 head、间隔 step、剩余数量 count；左删必定移动首项，右删仅在数量为奇数时移动首项。',proof='每轮保留等差数列的一半项，因此新间隔翻倍。左删删除原首项；右删时，当且仅当项数为奇数才删掉原首项。按此更新直至仅一项，其原下标对 |S| 取模就是对应字符。',complexity='时间 O(log(|S|K))，额外空间 O(1)。',samples=[('abcd',3),('j#k&h',5),('Z',1)],random=lambda r:(''.join(r.choice('abc12#') for _ in range(r.randint(1,7))),r.randint(1,7)),edges=[(('a'*100,10000),'a'),(('ab',1),'b'),(('abc',1),'b')],encode=lambda x:x[0]+'\n'+str(x[1])+'\n',oracle=last_oracle,code='''def solve(data):
    s=data[0]; count=len(s)*int(data[1]); head=0; step=1; left=True
    while count>1:
        if left or count%2:head+=step
        count//=2; step*=2; left=not left
    return s[head%len(s)]
''',mutants=[('右删时忽略奇数首项','left or count%2','left'),('每轮都从左删','left=not left','left=True')]),
dict(id=23,title='同活动等级最大心率差',tags=['哈希表'],desc='每条记录包含心率和活动等级。分别计算每个活动等级内最大心率减最小心率，输出所有等级中最大的差值。单条记录的等级差值为 0。',input='第一行 n（1..100000），随后 n 行，每行心率（0..300）和非空无空白活动等级标识。',idea='按等级维护最小和最大心率，最后取最大极差。',proof='一次扫描将每条记录只计入自己的等级，更新后的两个极值准确覆盖该组全部记录。对各组 max−min 取最大即为题意。',complexity='期望时间 O(n)，空间 O(g)，g 为等级数。',samples=[[(100,'Normal'),(87,'Normal'),(90,'Normal'),(90,'High'),(125,'Low')],[(0,'A'),(300,'A')],[(12,'A'),(250,'B')]],random=lambda r:[(r.randint(0,300),r.choice('ABC')) for _ in range(r.randint(1,12))],edges=[([(i%301,'A') for i in range(100000)],'300'),([(300,'A')]*100000,'0')],encode=lambda a:str(len(a))+'\n'+''.join(f'{v} {c}\n' for v,c in a),oracle=lambda a:str(max(abs(v-w) for v,c in a for w,d in a if c==d)),code='''def solve(data):
    groups={}
    for i in range(1,len(data),2):
        v=int(data[i]); c=data[i+1]
        lo,hi=groups.get(c,(v,v)); groups[c]=(min(lo,v),max(hi,v))
    return str(max(hi-lo for lo,hi in groups.values()))
''',mutants=[('忽略活动等级','c=data[i+1]',"c='all'"),('丢掉历史最小值','min(lo,v)','v')]),
dict(id=24,title='每步加一的最长子序列',tags=['动态规划','哈希表'],desc='从整数数组中保序选择子序列，要求每个后续元素恰好比前一个大 1。输出最长长度。元素无需连续。',input='第一行 n（1..100000），第二行 n 个整数（−10⁹..10⁹）。',idea='dp[v] 为当前前缀以 v 结尾的最优长度。扫描到 v 时，用 dp[v−1]+1 更新 dp[v]。',proof='任何以本次 v 结尾且长度大于一的合法子序列，其倒数第二项必须是之前出现的 v−1；其最优长度已保存在 dp[v−1]。追加 v 获得最佳候选，和旧值取最大保留前缀不变量。',complexity='期望时间 O(n)，空间 O(n)。',samples=[[1,0,2,3,2,4,9,6,5],[3,2,1],[1,1,2,2,3]],random=integers,edges=[(list(range(100000)),'100000'),([7]*100000,'1'),(list(range(100000,0,-1)),'1')],encode=arr,oracle=subseq_oracle,code='''def solve(data):
    dp={}; answer=0
    for v in map(int,data[1:]):
        dp[v]=max(dp.get(v,0),dp.get(v-1,0)+1); answer=max(answer,dp[v])
    return str(answer)
''',mutants=[('把差一当重复','dp.get(v-1,0)+1','dp.get(v,0)+1'),('错误排序破坏原序','map(int,data[1:])','sorted(map(int,data[1:]))')]),
dict(id=25,title='数组最高出现次数',tags=['哈希表'],desc='给定非空整数数组，输出出现次数最多的值的出现次数。',input='第一行 n（1..100000），第二行 n 个整数（−10⁹..10⁹）。',idea='哈希表累加每个值的出现次数，取最大计数。',proof='每个元素恰好给自己的计数加一，最终每个计数等于该值的真实频率，最大计数就是要求。',complexity='期望时间 O(n)，空间 O(n)。',samples=[[1,2,2,3,3,3,3,4,4,5,6],[-1,-1,-1],[1,2,3]],random=integers,edges=[([1000000000]*100000,'100000'),(list(range(100000)),'1')],encode=arr,oracle=lambda a:str(max(sum(x==v for x in a) for v in a)),code='''def solve(data):
    counts={}
    for v in map(int,data[1:]):counts[v]=counts.get(v,0)+1
    return str(max(counts.values()))
''',mutants=[('把最高次数当不同值数','max(counts.values())','len(counts)'),('取最小频次','max(counts.values())','min(counts.values())')]),
dict(id=26,title='修改一次后的最长非降连续段',tags=['动态规划'],desc='可以把数组至多一个元素改成任意整数，输出修改后最长连续非降子数组的长度。非降允许相等。',input='第一行 n（1..100000），第二行 n 个整数（−10⁹..10⁹）。',idea='计算每点结尾和开头的未修改非降段长度。修改一个点时，分别考虑只接左段、只接右段，以及左右相邻值允许桥接时合并两段。',proof='最优连续段不含修改点时已被原始非降段覆盖；含修改点时，它两侧必须各自非降。两侧都非空时存在可放的中间整数恰当且仅当左邻值不大于右邻值。枚举修改点和这三类情况覆盖全部方案。',complexity='时间 O(n)，空间 O(n)。',samples=[[2,4,6,8,0,9],[3,2,1],[7]],random=integers,edges=[(list(range(100000)),'100000'),([5]*100000,'100000'),([1,2,9,3,4],'5')],encode=arr,oracle=change_oracle,code='''def solve(data):
    a=list(map(int,data[1:])); n=len(a); left=[1]*n; right=[1]*n
    for i in range(1,n):
        if a[i-1]<=a[i]:left[i]=left[i-1]+1
    for i in range(n-2,-1,-1):
        if a[i]<=a[i+1]:right[i]=right[i+1]+1
    answer=max(left)
    for i in range(n):
        l=left[i-1] if i else 0; r=right[i+1] if i+1<n else 0
        answer=max(answer,l+1,r+1)
        if 0<i<n-1 and a[i-1]<=a[i+1]:answer=max(answer,l+r+1)
    return str(answer)
''',mutants=[('忽略桥接条件','a[i-1]<=a[i+1]','True'),('非降误作严格递增','<=','<')]),
dict(id=27,title='最长非降连续段',tags=['数组'],desc='输出整数数组中最长连续非降子数组的长度。每个元素可以等于前一个元素。',input='第一行 n（1..100000），第二行 n 个整数（−10⁹..10⁹）。',idea='维护以当前元素结尾的非降段长度，下降时重置为 1，否则递增。',proof='当前值不小于前值时可以且只能扩展前一非降尾段；发生下降时任何跨越这条边的段都不合法，只能从当前元素重新开始。全程最大尾段长度覆盖所有连续段。',complexity='时间 O(n)，额外空间 O(1)（不计输入）。',samples=[[0,7,3,10,2,4,6,8,0,9,-20,4],[5,5,5],[3,2,1]],random=integers,edges=[([4]*100000,'100000'),(list(range(100000,0,-1)),'1')],encode=arr,oracle=segment_oracle,code='''def solve(data):
    a=list(map(int,data[1:])); current=answer=1
    for i in range(1,len(a)):
        previous,v=a[i-1],a[i]
        current=current+1 if previous<=v else 1; answer=max(answer,current)
    return str(answer)
''',mutants=[('相等错误断开','previous<=v','previous<v'),('下降不重置','else 1','else current')]),
dict(id=28,title='树的最小最远距离',tags=['树','广度优先搜索'],desc='给定无权无向树。对每个节点求它到最远节点的边数，输出这些最远距离中的最小值。单节点树答案为 0。',input='第一行 n（1..100000），随后 n−1 行边 u v（编号 1..n），保证为树。',idea='两次广度优先搜索得到树直径 D，答案为 ⌈D/2⌉。',proof='直径两端距离为 D，任一点到这两端至少一个的距离不小于 ⌈D/2⌉。直径中央节点到任何点的距离不超过该值，否则可以拼出比 D 更长的路径。因此直径中央节点达到此下界。树上从任一点寻找最远点可得到一个直径端点，再次搜索得到直径。',complexity='时间 O(n)，空间 O(n)。',samples=[(6,[(0,3),(1,2),(2,3),(3,4),(4,5)]),(2,[(0,1)]),(1,[])],random=tree,edges=[((100000,[(i-1,i) for i in range(1,100000)]),'50000'),((100000,[(0,i) for i in range(1,100000)]),'1')],encode=encode_tree,oracle=radius_oracle,code='''def solve(data):
    n=int(data[0]); g=[[] for _ in range(n)]
    for i in range(1,len(data),2):
        u=int(data[i])-1;v=int(data[i+1])-1;g[u].append(v);g[v].append(u)
    def farthest(root):
        dist=[-1]*n;dist[root]=0;queue=[root]
        for u in queue:
            for v in g[u]:
                if dist[v]<0:dist[v]=dist[u]+1;queue.append(v)
        return queue[-1],dist[queue[-1]]
    u,_=farthest(0);_,diameter=farthest(u)
    return str((diameter+1)//2)
''',mutants=[('直径奇数向下取整','(diameter+1)//2','diameter//2'),('仅以节点1求最远距离','u,_=farthest(0)','u=0')]),
dict(id=31,title='子树后序字符串回文查询',tags=['树','Manacher'],desc='树根为节点 1。S(u) 是按子节点编号从小到大依次拼接它们的 S(v)，最后追加节点 u 的小写字母。对每个查询节点输出 S(u) 是否回文，是输出 1，否则 0。',input='第一行 n q（均为 1..200000），第二行长度 n 的小写字母串（按节点编号）。随后 n−1 行无向树边，最后 q 个查询节点编号。',idea='迭代后序遍历把每棵子树映射到整串的连续区间；对整串做奇、偶长度 Manacher，直接检查查询区间所需的回文半径。',proof='后序遍历在离开某节点前连续处理完它的所有后代，所以记录的区间恰是题意字符串。Manacher 分别记录每个中心能扩展的最大奇/偶回文；一个区间回文当且仅当其中心的半径覆盖整个区间。全程只做字符相等比较，不依赖哈希碰撞假设。',complexity='排序邻接表 O(n log n)，遍历和 Manacher O(n)，查询 O(q)，空间 O(n+q)。',samples=[(5,[(0,1),(0,2),(1,3),(1,4)],'ababc',[0,1]),(1,[],'z',[0]),(3,[(0,1),(0,2)],'aab',[0,1,2])],random=lambda r:(lambda x:(x[0],x[1],''.join(r.choice('abc') for _ in range(x[0])),list(range(x[0]))))(tree(r)),edges=[((200000,[(i-1,i) for i in range(1,200000)],'a'*200000,[0,99999,199999]),'1 1 1'),((200000,[(0,i) for i in range(1,200000)],'a'+'b'*199999,[0,1]),'0 1')],encode=lambda x:f'{x[0]} {len(x[3])}\n{x[2]}\n'+''.join(f'{a+1} {b+1}\n' for a,b in x[1])+' '.join(str(u+1) for u in x[3])+'\n',oracle=palindrome_oracle,code='''def solve(data):
    n,q=map(int,data[:2]); chars=data[2]; g=[[] for _ in range(n)]; pos=3
    for _ in range(n-1):
        u=int(data[pos])-1;v=int(data[pos+1])-1;pos+=2;g[u].append(v);g[v].append(u)
    start=[0]*n;end=[0]*n;s=[];stack=[(0,-1,False)]
    while stack:
        u,p,exit=stack.pop()
        if exit:s.append(chars[u]);end[u]=len(s);continue
        start[u]=len(s);stack.append((u,p,True))
        for v in sorted(g[u],reverse=True):
            if v!=p:stack.append((v,u,False))
    odd=[0]*n;l=0;r=-1
    for i in range(n):
        k=1 if i>r else min(odd[l+r-i],r-i+1)
        while i-k>=0 and i+k<n and s[i-k]==s[i+k]:k+=1
        odd[i]=k
        if i+k-1>r:l=i-k+1;r=i+k-1
    even=[0]*n;l=0;r=-1
    for i in range(n):
        k=0 if i>r else min(even[l+r-i+1],r-i+1)
        while i-k-1>=0 and i+k<n and s[i-k-1]==s[i+k]:k+=1
        even[i]=k
        if i+k-1>r:l=i-k;r=i+k-1
    answer=[]
    for token in data[pos:]:
        u=int(token)-1;a=start[u];b=end[u];length=b-a;center=(a+b)//2
        ok=odd[center]>=length//2+1 if length%2 else even[center]>=length//2
        answer.append('1' if ok else '0')
    return ' '.join(answer)
''',mutants=[('子节点顺序反转','reverse=True','reverse=False'),('偶数回文一律通过','even[center]>=length//2','True')]),
dict(id=32,title='字符集合模式的完整匹配',tags=['字符串','解析'],desc='模式由普通字符和形如 [abc] 的非空字符集合组成。普通字符只匹配自身，集合匹配其中任意一个字符，其他正则表达式符号没有特殊含义。返回完全匹配的候选串，保持输入顺序和重复项。',input='第一行合法模式（1..100 个无空白 ASCII 字符，方括号仅作为不嵌套字符集合界符），第二行候选数 n（1..1000），随后 n 行非空无空白 ASCII 字符串，长度不超过 100。',idea='解析成逐位置允许的字符集合。只检查长度相同、且每位字符属于对应集合的候选。',proof='每个模式单元恰好消费一个字符，因此匹配串长度必须等于单元数。单元互不依赖，逐位满足集合关系又是完整匹配的充分条件。逐个检查原列表自然保留顺序与重复项。',complexity='时间 O(|pattern|+Σ|word|)，空间 O(|pattern|+输出大小)。',samples=[('tele[op]ho[bnm]e',['cat','dog','telephone','telephonepole','tele','telehoe','teleophobme']),('[ab]a',['aa','ba','ca','aa']),('a.b',['a.b','acb'])],random=pattern_random,edges=[(('a'*100,['a'*100]*1000),'1000 '+' '.join(['a'*100]*1000)),(('a',['b']*1000),'0')],encode=lambda x:x[0]+'\n'+str(len(x[1]))+'\n'+'\n'.join(x[1])+'\n',oracle=pattern_oracle,code='''def solve(data):
    pattern=data[0];slots=[];i=0
    while i<len(pattern):
        if pattern[i]=='[':
            j=pattern.index(']',i);slots.append(set(pattern[i+1:j]));i=j+1
        else:slots.append({pattern[i]});i+=1
    matches=[w for w in data[2:] if len(w)==len(slots) and all(c in allowed for c,allowed in zip(w,slots))]
    return ' '.join([str(len(matches))]+matches)
''',mutants=[('只做前缀匹配','len(w)==len(slots)','len(w)>=len(slots)'),('集合只保留首字母','set(pattern[i+1:j])','set(pattern[i+1:i+2])')]),
dict(id=33,title='删除二叉树边后的分量大小',tags=['并查集','树'],desc='给定节点编号互不相同的二叉树，删除指定的父子边，求剩下每个连通分量的节点数。本站将结果按从小到大输出，以统一原题未要求顺序的分量集合。',input='本站标准输入：第一行 n k（1≤n≤100000，0≤k<n）；随后 n−1 行父子边 u v，根为 1，每节点至多两个子节点；最后 k 行待删除边，保证各边存在且不重复。',idea='忽略被删除的边，用并查集合并其余边，统计各根大小并排序。',proof='未删除的边两端必须在同一分量，并查集把且仅把由这些边可达的节点合并。最终根对应各连通分量，集合大小即节点数。排序仅规定展示顺序，不改变分量结果。',complexity='时间 O(n α(n)+n log n)，空间 O(n)。',samples=[(5,[(0,1),(0,2),(1,3),(1,4)],[(0,1),(1,3)]),(1,[],[]),(3,[(0,1),(0,2)],[(0,1),(0,2)])],random=forest_random,edges=[((100000,[(i-1,i) for i in range(1,100000)],[]),'1 100000'),((100000,[(i-1,i) for i in range(1,100000)],[(49999,50000)]),'2 50000 50000')],encode=lambda x:f'{x[0]} {len(x[2])}\n'+''.join(f'{a+1} {b+1}\n' for a,b in x[1]+x[2]),oracle=forest_oracle,code='''def solve(data):
    n,k=map(int,data[:2]);edges=[(int(data[i])-1,int(data[i+1])-1) for i in range(2,2+2*(n-1),2)]
    deleted={(int(data[i])-1,int(data[i+1])-1) for i in range(2+2*(n-1),len(data),2)}
    parent=list(range(n));size=[1]*n
    def find(x):
        while x!=parent[x]:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for a,b in edges:
        if (a,b) in deleted:continue
        a=find(a);b=find(b)
        if size[a]<size[b]:a,b=b,a
        parent[b]=a;size[a]+=size[b]
    result=sorted(size[i] for i in range(n) if parent[i]==i)
    return ' '.join([str(len(result))]+list(map(str,result)))
''',mutants=[('未删除指定边','if (a,b) in deleted:continue','if False:continue'),('忘记累计分量大小','size[a]+=size[b]','size[a]+=0')]),
dict(id=34,title='扣除免打扰时间的会议区间',tags=['区间','排序'],desc='合并所有会议覆盖的时间，再扣除一段免打扰时间，输出剩余互不重叠的最大会议区间。时间区间采用 [开始,结束)，相接区间合并，空区间不输出。',input='本站标准输入：第一行 n（0..100000），随后 n 行会议起止时间，最后一行免打扰起止时间。时间为 −10⁹..10⁹ 的整数，每段开始小于结束。',idea='先按起点排序合并覆盖区间，再从每段中扣去免打扰区间，保留左、右非空部分。',proof='排序后的区间与当前段相接或相交时，其并集仍是一段，否则必须新开一段。获得完整会议并集后，与免打扰区间求差只可能留下其左侧和右侧两部分；保留全部非空部分恰是要求的时间集合。',complexity='时间 O(n log n)，空间 O(n)。',samples=[([(1,7),(5,10),(12,30),(22,30),(40,50),(60,70)],(18,25)),([(1,10)],(3,7)),([],(0,1))],random=lambda r:([(a,a+r.randint(1,5)) for a in [r.randint(-5,5) for _ in range(r.randint(0,8))]],(lambda a:(a,a+r.randint(1,5)))(r.randint(-5,5))),edges=[(([(i,i+1) for i in range(100000)],(40000,60000)),'2 0 40000 60000 100000'),(([(0,1000000000)]*100000,(-1000000000,1000000000)),'0')],encode=lambda x:str(len(x[0]))+'\n'+''.join(f'{a} {b}\n' for a,b in x[0])+f'{x[1][0]} {x[1][1]}\n',oracle=meetings_oracle,code='''def solve(data):
    n=int(data[0]);intervals=sorted((int(data[1+2*i]),int(data[2+2*i])) for i in range(n));ds,de=map(int,data[1+2*n:]);merged=[]
    for a,b in intervals:
        if merged and a<=merged[-1][1]:merged[-1][1]=max(merged[-1][1],b)
        else:merged.append([a,b])
    result=[]
    for a,b in merged:
        if b<=ds or a>=de:result.append((a,b))
        else:
            if a<ds:result.append((a,ds))
            if b>de:result.append((de,b))
    return ' '.join([str(len(result))]+[str(v) for pair in result for v in pair])
''',mutants=[('相接区间未合并','a<=merged[-1][1]','a<merged[-1][1]'),('丢掉免打扰右侧会议','if b>de:','if False:')]),
dict(id=35,title='优先收藏的图片流',tags=['哈希表','模拟'],desc='图片流先按收藏列表顺序返回全部收藏图片，再按原图片列表顺序返回未收藏图片。连续调用 getNext 共 q 次，耗尽后每次返回 NULL。列表在构造后保持不变。',input='本站标准输入：第一行 n m q（1≤n,q≤100000，0≤m≤n），第二行 n 个互不相同的图片标识，第三行 m 个互不相同的收藏标识，是原列表子集。标识为 1..32 位英文字母数字，不允许 NULL。',idea='构造时仅建收藏集合，保留两个游标。先推进收藏游标，之后扫描原列表并跳过收藏项，耗尽输出 NULL。',proof='第一阶段恰好按收藏次序输出所有收藏。第二阶段按原次序扫描，集合检查排除所有已经输出的收藏，而每个非收藏都被输出一次。游标单向推进保证后续调用不会重复或越界返回图片。',complexity='构造 O(m)，共 q 次调用 O(n+m+q)，额外空间 O(m)（不计输入输出）。',samples=[(['i1','i2','i3','i4'],['i3','i1'],5),(['a'],[],2),(['a','b'],['b','a'],2)],random=image_random,edges=[((['i'+str(i) for i in range(100000)],[],1),'i0'),((['a','b'],['b'],100000),'b a '+' '.join(['NULL']*99998))],encode=lambda x:f'{len(x[0])} {len(x[1])} {x[2]}\n'+' '.join(x[0])+'\n'+' '.join(x[1])+'\n',oracle=image_oracle,code='''def solve(data):
    n,m,q=map(int,data[:3]);images=data[3:3+n];favs=data[3+n:];marked=set(favs);first=0;second=0;answer=[]
    for _ in range(q):
        if first<m:answer.append(favs[first]);first+=1
        else:
            while second<n and images[second] in marked:second+=1
            if second<n:answer.append(images[second]);second+=1
            else:answer.append('NULL')
    return ' '.join(answer)
''',mutants=[('收藏排序破坏给定顺序','favs=data[3+n:]','favs=sorted(data[3+n:])'),('非收藏阶段重复输出收藏','images[second] in marked','False')]),
dict(id=36,title='连续入住的最早一天',tags=['并查集'],desc='N 栋房屋排成一行，每天按排列 house 入住一栋。输出最早存在至少 M 栋连续已入住房屋的天数，从第 1 天计数。',input='第一行 N M（本站测试范围 1≤M≤N≤100000），第二行 1..N 的一个排列，表示每天入住的房屋编号。',idea='用每个已占连续段的两个端点记录段长。新增位置 x 时读取左、右邻居的段长，合成新段并更新两个外端点。',proof='新位置左右若已占用，则相邻位置必然分别为左段的右端点和右段的左端点；保存的段长准确。新占用只会连接这两段和自身，不影响其它段。第一次合成长度至少 M 的段即为最早满足的一天。',complexity='时间 O(N)，空间 O(N)。',samples=[([3,2,1],1),([1,3,2,5,4],3),([2,1,4,3],4)],random=happy_random,edges=[((list(range(1,100001)),100000),'100000'),((list(range(1,100001)),1),'1')],encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=happy_oracle,code='''def solve(data):
    n,m=map(int,data[:2]);length=[0]*(n+2)
    for day,x in enumerate(map(int,data[2:]),1):
        left=length[x-1];right=length[x+1];total=left+right+1
        length[x]=total;length[x-left]=total;length[x+right]=total
        if total>=m:return str(day)
''',mutants=[('漏掉入住当天','enumerate(map(int,data[2:]),1)','enumerate(map(int,data[2:]),0)'),('只计算左边连续段','right=length[x+1]','right=0')]),
dict(id=39,title='最长优先的字典分词',tags=['Trie','字符串'],desc='从文本左侧扫描，每次选择当前位置能匹配的最长字典词并输出其标识。没有匹配词则输出当前字符并前进一位。相同词条重复出现时只使用首次给出的标识。',input='本站标准输入：第一行非空无空白 ASCII 文本（不超过100000字符），第二行字典项数 m（0..100000），随后 m 行词条和标识，均不含空白；词条长度1..100、总长度不超过100000，标识长度1..32。',idea='构建 Trie，每个终止节点只记录第一次标识。从当前位置向下查找，保存最后遇到的终止节点；最长匹配存在则输出并跳过它，否则输出原字符。',proof='Trie 上沿文本的唯一路径完整枚举所有匹配词条，最深终止节点对应最长词条。只初始化空终止标记保留首次映射。每步选择符合题意的唯一输出并正确前进，归纳得到完整贪心分词。',complexity='时间 O(字典总长度+文本长度×最长词长)，空间 O(字典总长度+输出大小)。',samples=[('applepie',[('app','B'),('apple','A'),('pie','P')]),('xabcd',[('ab','1'),('abc','2'),('bc','3')]),('aaa',[('a','X'),('a','Y'),('aa','Z')])],random=token_random,edges=[(('a'*100000,[('a'*100,'X')]),'1000 '+' '.join(['X']*1000)),(('xyz',[]),'3 x y z')],encode=lambda x:x[0]+'\n'+str(len(x[1]))+'\n'+''.join(f'{a} {b}\n' for a,b in x[1]),oracle=token_oracle,code='''def solve(data):
    text=data[0];children=[{}];terminal=[None]
    for j in range(2,len(data),2):
        word,identifier=data[j:j+2];node=0
        for char in word:
            if char not in children[node]:children[node][char]=len(children);children.append({});terminal.append(None)
            node=children[node][char]
        if terminal[node] is None:terminal[node]=identifier
    answer=[];i=0
    while i<len(text):
        node=0;j=i;end=i;found=None
        while j<len(text) and text[j] in children[node]:
            node=children[node][text[j]];j+=1
            if terminal[node] is not None:found=terminal[node];end=j
        if found is None:answer.append(text[i]);i+=1
        else:answer.append(found);i=end
    return ' '.join([str(len(answer))]+answer)
''',mutants=[('重复词覆盖首次映射','if terminal[node] is None:terminal[node]=identifier','terminal[node]=identifier'),('选最短匹配','if terminal[node] is not None:found=terminal[node];end=j','if terminal[node] is not None and found is None:found=terminal[node];end=j')]),
]

BLOCKED={
 'oa-google-21':'约束允许全零、仅最后两位非零等没有合法三位结果的输入，未定义返回值；来源解释承认题意由单例推断，不能擅定无解输出。',
 'oa-google-29':'规则可读，但来源任取叶子的实现错误：边2—3、3—4、4—5、1—3，k=1时删除叶子1仍直径3，删除叶子5则直径2。还缺能支持10⁵节点并经独立验证的正确高效参考解；不能据来源代码发布。',
 'oa-google-30':'未规定允许几位输入、目标时间范围、同成本且同时间差时选哪一输入；不能擅自增加四位限制或第三排序规则。',
 'oa-google-37':'平衡定义把不平衡的 ()) 作为例子，且“仅数量相等”与通常前缀合法性冲突；来源贪心删括号规则也无法从题面确定。',
 'oa-google-38':'题面在 Given two strings A&lt;/co 截断，约束为 Unknown；样例不足以确认合法子串及无解行为。',
 'oa-google-40':'操作 1 和下标范围被截断；样例把右邻 1 变 0 与 a[i]=a[i−1]−1 矛盾，不能据此构造正确标准答案。',
}

SAMPLE_EXPLANATIONS={
22:'样例1：abcd 重复3次，三轮后依次剩 bdbdbd、bbb、b。样例2：按左右交替删除，最终留下 &。样例3：开始时只有 Z，无须删除。',
23:'样例1：Normal 组最高100、最低87，差13；另外两组各只有一条记录，差0，所以输出13。样例2：同组心率0和300，差300。样例3：两条记录不属于同组，每组差都为0。',
24:'样例1：可依次选出1、2、3、4、5，长度5。样例2：数组严格下降，不能保序接出加一的下一项，答案1。样例3：重复数字不能相邻选入，选1、2、3得到3。',
25:'样例1：数字3出现4次，为最高次数。样例2：−1出现3次。样例3：三个值各出现1次，答案1。',
26:'样例1：把0改成8，整个数组非降，长度6。样例2：把首项3改成2，得到长度2的非降段；一次修改不能使3、2、1全部非降。样例3：单个元素自身即为长度1。',
27:'样例1：连续段2、4、6、8最长，长度4。样例2：相等允许，三个5构成长为3的段。样例3：每一步都下降，只能取一个元素。',
28:'样例1：选节点4，到任何节点最多2条边，且存在长度4的直径，因此答案2。样例2：两个节点相距1，答案1。样例3：唯一节点到自身距离0。',
31:'样例1：节点1的后序串为 bcbaa，不回文；节点2为 bcb，是回文，输出0 1。样例2：单字母 z 是回文。样例3：根的串为 aba，是回文，两个叶子单字母也回文，输出1 1 1。',
32:'样例1：只有 telephone 的每一位都匹配，输出数量1和该字符串。样例2：aa、ba、aa匹配，保留重复及顺序，ca不匹配，数量3。样例3：点号仅匹配点号，所以只保留 a.b，不保留 acb。',
33:'样例1：删除1—2和2—4后，分量是{1,3}、{2,5}、{4}，排序后的大小为1、2、2，先输出分量数3。样例2：单节点形成一个大小1的分量。样例3：两条边全删掉，得到三个大小1的分量。',
34:'样例1：合并后会议段为[1,10)、[12,30)、[40,50)、[60,70)；扣掉[18,25)，第二段拆成[12,18)与[25,30)，最终5段。样例2：[1,10)扣掉[3,7)得到[1,3)、[7,10)。样例3：没有会议，结果数量0。',
35:'样例1：先输出收藏顺序 i3、i1，再输出未收藏的 i2、i4；第五次已经耗尽，输出 NULL。样例2：没有收藏，第一次输出 a，第二次 NULL。样例3：全部收藏，按给定收藏顺序输出 b、a。',
36:'样例1：只要求1栋，第1天就满足。样例2：前两天入住1和3尚不连续，第3天补上2后有1、2、3连续入住，答案3。样例3：要求全部4栋连续，必须等到第4天。',
39:'样例1：apple 比 app 长，先输出 A；再匹配 pie 输出 P，共2项。样例2：x无匹配，输出原字符；abc优于ab，输出2；末尾d原样输出，共3项。样例3：先选更长的aa得到Z，剩余a使用首次映射X，输出2 Z X。',
}

# Exercise both independent maximum constraints, not only the maximum tree size.
next(spec for spec in SPECS if spec['id']==31)['edges'].append(((1,[],'z',[0]*200000),' '.join(['1']*200000)))
next(spec for spec in SPECS if spec['id']==39)['edges'].append((('a'*100000,[('a'*99+'b','X')]),'100000 '+' '.join(['a']*100000)))
next(spec for spec in SPECS if spec['id']==39)['timeLimit']=6
next(spec for spec in SPECS if spec['id']==25)['extra_cases']=[dict(input='3\n1 01 +1\n',expectedOutput='3\n'),dict(input='3\n-1 -01 -001\n',expectedOutput='3\n')]


def execute(path,stdin):
    p=subprocess.run([sys.executable,'-I',str(path)],input=stdin,text=True,capture_output=True,timeout=8)
    return p.stdout.strip() if p.returncode==0 else None

def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    selected=set(map(int,sys.argv[1:]))
    items=json.loads((OUT/'batches/google-remaining-a.json').read_text())['items'] if selected else []
    reports=json.loads((OUT/'validation/google-remaining-a.json').read_text())['problems'] if selected else []
    items=[item for item in items if int(item['id'].split('-')[-1]) not in selected]
    reports=[item for item in reports if int(item['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['id'] not in selected:continue
        identifier=f"oa-google-{spec['id']}";rng=random.Random(SEED+spec['id'])
        code=textwrap.dedent(spec['code'])+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        oracles=[]
        for value in spec['samples']+[spec['random'](rng) for _ in range(160)]:
            stdin=spec['encode'](value);expected=spec['oracle'](value)
            assert execute(path,stdin)==expected,(identifier,value,expected,execute(path,stdin))
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        rawcases=oracles[:3]+[dict(input=spec['encode'](x),expectedOutput=y+'\n') for x,y in spec['edges']]+spec.get('extra_cases',[])+oracles[3:27]
        cases=[]
        for i,c in enumerate(rawcases):
            assert execute(path,c['input'])==c['expectedOutput'].strip(),(identifier,'boundary',i)
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**c,hidden=i>=3,weight=1))
        mutants=[];kills=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code,(identifier,old)
            mutation=code.replace(old,new);mp=OUT/'negative-controls'/f'{identifier}-{index}.py';mp.write_text(mutation)
            rejected=[i for i,c in enumerate(cases) if execute(mp,c['input'])!=c['expectedOutput'].strip()]
            assert rejected,(identifier,label,'survived')
            mutants.append(dict(name=label,code=mutation));kills.append(dict(name=label,rejectedByCases=rejected))
        output={32:'先输出匹配字符串数量，随后按输入顺序输出匹配字符串，重复项保留。',33:'先输出分量数，随后按从小到大顺序输出每个分量的节点数。',34:'先输出区间数，随后按开始时间递增输出每段的开始和结束。',39:'先输出分词结果数量，随后依次输出标识或原字符。'}.get(spec['id'],'按题意输出答案，多次查询结果依次以空格分隔。')
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Google']+spec['tags'],description=spec['desc']+'\n\n标准输入输出、样例与测试由 CSWork 编写；标注“本站”的范围为评测约定，不声称是原始面试限制。',input=spec['input'],output=output,explanation=SAMPLE_EXPLANATIONS[spec['id']],hints=[spec['idea']],timeLimit=spec.get('timeLimit',3),memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        raw=dict(schemaVersion=1,problem=problem,cases=cases)
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(raw,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        normalized_package=json.loads(normalized)
        metadata=dict(problem=normalized_package['problem'],caseNames=[case['name'] for case in normalized_package['cases']])
        assert '\ufffd' not in json.dumps(metadata,ensure_ascii=False),(identifier,'Unexpected Unicode replacement character in package metadata')
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}";solutions=[dict(language='python',code=code)]
        documents={'packages':normalized_package,'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}
        for folder,document in documents.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=kills,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracles),'independent oracle checks;',len(cases)-3,'hidden; 2 mutants rejected',flush=True)
    items.sort(key=lambda item:int(item['id'].split('-')[-1]));reports.sort(key=lambda item:int(item['id'].split('-')[-1]))
    (OUT/'batches/google-remaining-a.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation/google-remaining-a.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=reports,skipped=BLOCKED,note='Only local authored-code validation. Real sandbox evidence remains required before publication.'),ensure_ascii=False,indent=2)+'\n')
    notes={33:'原题只要求分量大小集合，本站统一升序输出；显式说明本站标准输入和测试规模。',34:'采用半开时间区间并合并相接会议，显式写明标准输出顺序与本站测试范围。',35:'把 getNext 接口改写为 q 次标准输入输出查询，耗尽标记 NULL 在题面显式定义；使用懒扫描而非来源 O(n) 构造。',36:'题面明确 M 表示所需连续房屋数量；本站范围1≤M≤N，维持至少M栋语义。',39:'重复词条保留首次映射，明确本站非空词条和标准输入输出，Trie参考解替代来源全表扫描。',31:'使用确定性的 Manacher 回文检测，替代不满足20万规模的来源朴素拼接；原样例输出0 1已覆盖。'}
    reviews=[dict(id=f'oa-google-{i}',status='blocked' if f'oa-google-{i}' in BLOCKED else 'authored',reason=BLOCKED.get(f'oa-google-{i}',notes.get(i,'源题规则与首个样例一致；独立编写中文题意、标准I/O、参考解、暴力对照、边界测试与错误程序。'))) for i in range(21,41)]
    (OUT/'reviews/google-remaining-a.json').write_text(json.dumps(dict(schemaVersion=1,items=reviews),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
