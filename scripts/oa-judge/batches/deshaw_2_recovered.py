#!/usr/bin/env python3
"""Total longest maximum regions: stacks versus intervals and batched DSU."""
from pathlib import Path
from itertools import product
import hashlib
import json
import random
import runpy
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-the-d-e-shaw-group-2'
BATCH='deshaw-2-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCE='fastprep/The D. E. Shaw Group/deshaw-calculate-total-region.md'
BLOB='d12faf619658b1b05edb51f21d7f77a8e73555ad'
RAW_SHA='0d3807aca6edb7948ce9047fca9223ed4f1f7824b8606e74a40ccb8d46bd4764'
HASH='dc919d46c8c40214f5fd15096b443ad9dd02a0ab1256fe6605d3989b837ddd16'
SEED=20261024
REFERENCE='''import sys

def solve(raw):
    values=list(map(int,raw.split()))
    n=values[0]
    a=values[1:]
    left=[-1]*n
    right=[n]*n
    stack=[]
    for i in range(n):
        while stack and a[stack[-1]]<=a[i]:
            stack.pop()
        if stack:
            left[i]=stack[-1]
        stack.append(i)
    stack=[]
    for i in range(n-1,-1,-1):
        while stack and a[stack[-1]]<=a[i]:
            stack.pop()
        if stack:
            right[i]=stack[-1]
        stack.append(i)
    answer=sum(right[i]-left[i]-1 for i in range(n))
    return str(answer)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
    {'name':'左右不对称地阻止越过等高同学','code':REFERENCE.replace('a[stack[-1]]<=a[i]', 'a[stack[-1]]<a[i]',1)},
    {'name':'错误用32位有符号整数保存总和','code':REFERENCE.replace('return str(answer)', 'return str((answer+(1<<31))%(1<<32)-(1<<31))')},
]
EDITORIAL='''## 固定原始来源与说明纠错

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/The D. E. Shaw Group/deshaw-calculate-total-region.md规定：每位同学的region是包含其下标、且其身高等于区间最大值的最长连续子数组长度。返回所有人的region长度之和。这里“等于最大值”允许多人并列最高，不要求唯一最高。题面自身明确1≤n≤100000、1≤heights[i]≤10^9，返回long；不从同公司的其他题号借范围。

第一原例[3,5,6]的正式Output是6，逐人长度1、2、3及求和也为6。说明末尾却附注“源图答案是5，很困惑”；固定快照没有相应可读原图证据，本站披露这条冲突附注，但采用明确定义与可复算的正式输出6，不把附注传闻当作另一个规则。第二原例[1,2,1]正式输出5正确，中间同学最长区间是完整[1,2,1]、长度3；原解释误写[1,2]，本站明确纠正该漏项。

两原例保留6、5；第三公开例[2,2]为本站补充，每个人都能选整个数组，答案4。整理代码左右分别用≤和<弹栈会把一侧等高者当作障碍，在[2,2]错误得到3。本题两侧都只由严格更高者阻断。输入协议为n及n个身高，输出一个精确整数。未执行上游代码。

## 思路

对每个下标i，找到左侧最近严格大于heights[i]的位置L以及右侧最近严格大于它的位置R；不存在时分别设为−1、n。其region长度为R−L−1。用两次单调栈扫描：遇到新身高时弹出所有小于或等于它的旧位置，剩余栈顶就是最近的严格更高者。两边都用≤，不能为重复值分配不同归属。

## 正确性证明

包含i的合法区间不能越过L或R，否则会包含一个严格更高的人，使i的身高不再等于最大值。在L与R之间不存在任何严格更高者，因此整个开区间(L,R)本身合法，且包含i。所以它正是最长区间，长度R−L−1。

从左扫描时，栈内位置递增、身高严格递减。被新位置弹出的旧位置身高不大于新值：对未来位置，如果旧位置足以成为严格更高者，新位置同样足够且更近；如果新位置不够高，被它弹出的旧位置也不会够高。因此弹出不会丢失未来的最近严格更高答案。弹栈后的栈顶恰为当前左侧最近严格更高者；右侧扫描对称成立。逐项求出正确长度并求和，得到全局所求值。

## 复杂度与数值边界

每个下标在每次扫描中入栈和出栈至多一次，时间O(n)，空间O(n)。每个人的region最多n，总和最多n²；所有人等高时达到该上界。n=100000时答案10000000000超过32位，但远小于有符号64位上界，因此必须使用64位或任意精度整数。单调递增/递减时为n(n+1)/2。

## 独立验证

小oracle按左端点依次扩展右端点，维护该区间最大值，对所有等于该最大值的下标记录可得最长长度，最终逐人求和；不寻找最近更高边界。163个唯一输入通过真实参考子进程，并穷举n=1..7、值1/2/3的全部3279个数组核对。

完整n=100000压力使用不同算法：按身高排序，从低到高激活位置，使用并查集合并相邻已激活格子；同一高度先全部激活并合并，再读取这些位置的连通块大小。此时激活格子恰好是身高≤当前值的位置，其连通块就是可选最长区间。必须批量处理等高值，不能先激活一个就取答案。该oracle是O(n log n)排序加近线性并查集，不调用参考单调栈。

正式数据覆盖全等、递增/递减、1与10^9交错、长平台、两端最高、中间唯一最高、重复最大值、锯齿以及固定种子随机。全等与单调另核对闭式，全部大例逐一执行参考子进程。负控为左右不对称处理等高值、32位总和溢出；只有所有正式数据均正常退出后才计击杀。
'''

def sha(x):
    return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()

def put(folder,name,value):
    p=OA/folder/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def encode(a):
    assert 1<=len(a)<=100000 and all(1<=x<=10**9 for x in a)
    return str(len(a))+'\n'+' '.join(map(str,a))+'\n'

def brute(a):
    best=[0]*len(a)
    for left in range(len(a)):
        maximum=0
        for right in range(left,len(a)):
            maximum=max(maximum,a[right])
            for i in range(left,right+1):
                if a[i]==maximum:best[i]=max(best[i],right-left+1)
    return sum(best)

def dsu_oracle(a):
    n=len(a)
    parent=[-1]*n
    size=[1]*n
    def find(x):
        while parent[x]!=x:
            parent[x]=parent[parent[x]]
            x=parent[x]
        return x
    def union(x,y):
        x,y=find(x),find(y)
        if x==y:return
        if size[x]<size[y]:x,y=y,x
        parent[y]=x
        size[x]+=size[y]
    order=sorted(range(n),key=a.__getitem__)
    answer=begin=0
    while begin<n:
        end=begin+1
        while end<n and a[order[end]]==a[order[begin]]:end+=1
        for j in range(begin,end):parent[order[j]]=order[j]
        for j in range(begin,end):
            i=order[j]
            if i and parent[i-1]!=-1:union(i,i-1)
            if i+1<n and parent[i+1]!=-1:union(i,i+1)
        for j in range(begin,end):answer+=size[find(order[j])]
        begin=end
    return answer

def run(path,raw):
    start=time.perf_counter()
    r=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=15)
    assert not r.stderr
    return r.stdout.strip(),time.perf_counter()-start

def main():
    start=time.perf_counter()
    raw=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
    assert sha(raw)==RAW_SHA
    assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==BLOB
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    path=OA/f'references/{PID}.py'
    path.write_text(REFERENCE)
    own=runpy.run_path(str(path))['solve']
    digest=hashlib.sha256()
    count=0
    for n in range(1,8):
        for a in product((1,2,3),repeat=n):
            expected=brute(a)
            assert int(own(encode(a)))==expected==dsu_oracle(a)
            digest.update((encode(a)+str(expected)+'\n').encode())
            count+=1
    assert count==3279
    arrays=[[3,5,6],[1,2,1],[2,2],[1],[10**9],[2,1,2],[3,3,1,3,3]]
    keys={encode(a) for a in arrays}
    rng=random.Random(SEED)
    while len(arrays)<163:
        a=[rng.choice((1,2,3,4,10,10**9)) for _ in range(rng.randint(1,18))]
        if encode(a) not in keys:
            keys.add(encode(a));arrays.append(a)
    oracles=[]
    for a in arrays:
        expected=brute(a)
        assert dsu_oracle(a)==expected
        text=encode(a)
        assert run(path,text)[0]==str(expected)
        oracles.append({'input':text,'expectedOutput':str(expected)+'\n'})
    print(f'{PID}:3279 exhaustive arrays,163 independent subprocess oracles passed',flush=True)
    cases=[{'name':f'原始例{i+1}' if i<2 else ('本站等高补充例' if i==2 else f'区间枚举{i-2}'),**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    n=100000
    stress=[
        ('全等最小值',[1]*n,n*n),('全等最大值',[10**9]*n,n*n),
        ('严格递增',list(range(1,n+1)),n*(n+1)//2),
        ('严格递减',list(range(n,0,-1)),n*(n+1)//2),
        ('极值交错',[1,10**9]*(n//2),None),
        ('反向极值交错',[10**9,1]*(n//2),None),
        ('中间唯一最高',[1]*(n//2)+[10**9]+[1]*(n//2-1),None),
        ('两端最高',[10**9]+[1]*(n-2)+[10**9],None),
        ('等高平台',[(i//1000)%10+1 for i in range(n)],None),
        ('双向阶梯',[min(i,n-1-i)+1 for i in range(n)],None),
        ('反向双向阶梯',[max(i,n-1-i)+1 for i in range(n)],None),
        ('稀疏重复最大值',[10**9 if i%997==0 else i%73+1 for i in range(n)],None),
        ('完整范围固定随机',[rng.randint(1,10**9) for _ in range(n)],None),
        ('小值大量重复随机',[rng.randint(1,7) for _ in range(n)],None),
    ]
    evidence=[]
    for name,a,closed in stress:
        expected=dsu_oracle(a)
        if closed is not None:assert expected==closed
        text=encode(a)
        actual,elapsed=run(path,text)
        assert actual==str(expected),name
        cases.append({'name':name,'input':text,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
        evidence.append({'name':name,'n':len(a),'expected':str(expected),'independentOracle':'sort-and-batch-activate DSU','closedFormChecked':closed is not None,'localSeconds':round(elapsed,5)})
    assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
    for case in cases:assert run(path,case['input'])[0]==case['expectedOutput'].strip()
    killed=[]
    for i,mutant in enumerate(MUTANTS,1):
        p=OA/f'negative-controls/{PID}-{i}.py'
        p.write_text(mutant['code'])
        rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].strip()]
        assert rejected
        killed.append({'name':mutant['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'每位同学为区间最大值时的最长区域总和','difficulty':'中等','tags':['OA','The D. E. Shaw Group','单调栈','区间'],
        'description':'一排同学的身高按站立顺序给出。对每个下标i，考虑包含i的所有连续子数组，要求heights[i]等于该子数组的最大值（允许其他同学与其等高）。i的region定义为这些子数组中最长的长度。返回所有i的region长度之和。不是统计满足条件的子数组个数。',
        'input':'第一行n，第二行n个整数heights[i]。原题自身完整范围：1≤n≤100000，1≤heights[i]≤10^9。',
        'output':'输出精确整数总和。可能达到10000000000，需要64位或任意精度整数，不取模。',
        'explanation':'原例[3,5,6]的region长度1、2、3，总6；原说明附注称缺失源图标5，但正式Output与明确规则均为6，本站披露冲突而保留可复算正式输出。原例[1,2,1]长度1、3、1，总5；原解释中间区间误漏末尾1，应为[1,2,1]。第三例[2,2]为本站补充：两个人都能选整个数组，总4。',
        'hints':['只有严格更高的同学才会阻断区域。','左右寻找最近严格更高下标；相同高度两侧都可以跨过。','总和可能超过32位。'],
        'timeLimit':2,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized))
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'左右最近严格更高者限定最长区域','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':RAW_SHA,'upstreamCodeExecuted':False,'recoveredConstraints':['1<=n<=100000','1<=heights[i]<=10^9','region is maximum length containing i with heights[i] equal to interval maximum; ties allowed','return long integer sum'],'correction':'Keep actual sourceOutput6 and5; disclose unsupported source-image5 aside. Correct second explanation middle interval to[1,2,1]. Both nearest boundaries strictly greater; catalog asymmetrical tie handling is invalid.','siteAdded':'n followed by heights serialization; third public example equal heights. No borrowing numeric bounds or artifacts from problem8.'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'本题固定raw独立给出完整规则/范围，实际Output6/5正确；披露缺失源图5附注与第二解释漏项，以原明确含并列最大值定义恢复。3279穷举、163oracle及满域独立DSU通过，仅候选待沙箱。不改题8。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':killed,'oracleMethod':'Enumerate all intervals and record longest eligible region for every contained maximum; large arrays use sorted batched activation DSU, not nearest-greater stack.','exhaustiveSmallDomain':{'nMin':1,'nMax':7,'values':[1,2,3],'cases':count,'inputExpectedDigest':digest.hexdigest(),'referenceExecution':'in-process own authored reference plus independent interval and DSU oracles;163 separate subprocess checks'},'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
    print(f'{PID}: {len(cases)} formal cases,14 full-domain DSU checks,2 normal-exit mutants; candidate frozen',flush=True)

if __name__=='__main__':main()
