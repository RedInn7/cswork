#!/usr/bin/env python3
"""Movie ratings: selection-state DP versus masks and weighted intervals."""
from pathlib import Path
from itertools import product
from bisect import bisect_right
import hashlib
import json
import random
import runpy
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[3]
OA=ROOT/'content/oa-judge'
PID='oa-akuna-capital-21'
BATCH='akuna-21-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCE='fastprep/Akuna Capital/akuna-maximize-ratings.md'
BLOB='1bc555e5375a267d319fc1f7e5f2f6246959bb16'
RAW_SHA='f30fcf3058b454fbee75fdb4ae7acb29f838324e121c773eb55b902f2b1ae2c7'
HASH='051cd18292e10fd405a676a42d30371b36a7a8bf70422f11402dd907c4499800'
SEED=20261026
REFERENCE='''import sys

def solve(raw):
    values=list(map(int,raw.split()))
    take=0
    skip=-10**30
    for rating in values[1:]:
        take,skip=max(take,skip)+rating,take
    return str(max(take,skip))

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
    {'name':'错误允许连续跳过两部电影','code':REFERENCE.replace('take,skip=max(take,skip)+rating,take','take,skip=max(take,skip)+rating,max(take,skip)')},
    {'name':'错误强制选择最后一部电影','code':REFERENCE.replace('return str(max(take,skip))','return str(take)')},
]
EDITORIAL='''## 固定原文与错误解释修正

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Akuna Capital/akuna-maximize-ratings.md规定：按原顺序选择电影子序列，使评分和最大，不能连续跳过两部或更多电影。完整范围1≤n≤100000，−1000≤ratings[i]≤1000，包含0。原文内部例[-1,−3,−2]明确允许只选第二项，也允许选第一和第三项，最优都是−3，证明首部、尾部各跳过一部都允许。

原文没有“必须非空”的额外条件，本题不擅加：n=1时跳过唯一一部并不连续跳过两部，因此单个负评分的最优为0。n≥2时不可能全跳，因为至少会出现相邻两部被跳过。空选的和按0处理，这只会影响单部非正评分等边界，不是将全负数组全部略过。

两原正式输出保留：[-3,2,4,−1,−2,−5]选[2,4,−2]得4；[9,−1,−3,4,5]选[9,−1,4,5]得17。第二原解释漏掉−1，声称9+4+5=17，既算术错误（实际18）又连续跳过−1、−3，违反明确定义；本站明确补回−1而不改变原输出17。第三公开例单个−1000→0为本站补充。stdin用n及n个评分，输出一个整数；未执行上游代码。

## 思路

维护处理完前缀后两种最优值：take表示最后一部被选，skip表示最后一部被跳过。当前评分x若被选，可以从之前任一合法状态转移，newTake=max(take,skip)+x；若被跳过，前一部必须选，所以newSkip=take。初始用take=0作为空前缀可继续的起点，skip为负无穷；处理第一部后两状态自然为x和0。结束取两者最大值。

## 正确性证明

归纳假设take和skip分别为此前缀所有合法方案中对应末位状态的最优和。选择当前部时不会造成新的连续跳过，任何旧合法方案都能加上x，取两旧状态最大值即得到所有选当前部方案的最优。跳过当前部时，旧末位若也跳过就非法，因此只能从旧take转移；从其中最优方案转移即得到所有合法跳当前部方案的最优。这两个集合不重不漏覆盖新前缀合法方案，所以更新保持定义。

初始化使第一部既可选择也可单独跳过，符合首部规则。最终没有必须选择末部的条件，两状态最大值就是全部合法子序列的最优评分和。

## 复杂度与边界

每部只更新两个数，时间O(n)，算法额外空间O(1)，读取数组O(n)。所有合法和绝对值不超过1000n≤10^8，普通有符号32位即可保存最终值；实现可用64位或Python整数并取足够小的不可达哨兵。全正全选，全负仍必须满足不能相邻跳过，不能简单只加正数。n个相同−1000时最少选floor(n/2)部，结果−1000floor(n/2)；单部负数为0。

## 独立验证

小oracle枚举所有选择掩码，逐相邻位置排除同时未选的方案，直接累加保留评分并取最大值，不使用参考状态转移。163个唯一oracle都执行真实参考子进程；另穷举长度1..7、评分−1/0/1的全部3279个数组。

大域独立算法从全选总和出发，考虑跳过负评分所节省的正代价。最优无需跳过正数；跳过0也不会提高值，可去掉这些跳过。跳过下标i代表带权区间[i,i+2)，权值−ratings[i]，两个区间不重叠恰好表示两个跳过位置不相邻。因此用加权区间调度：按右端点排序，二分查找上个兼容区间，得到最大节省，再将全选总和加上节省。比如[-5]的全选和−5加节省5为0。它不调用参考take/skip状态，小域与掩码先交叉验证，大域用此算法生成期望，并为全同值及交错数据附加闭式核验。

正式数据覆盖原例、单部正负零、全负、相邻正数、可跳首尾、隔部跳、零值、±1000极值，以及多种完整100000长度结构。负控为允许连续跳过、强制选最后一部，全部正式输入须正常退出才计错解击杀。
'''

def sha(x):
    return hashlib.sha256(x.encode() if isinstance(x,str) else x).hexdigest()

def put(folder,name,value):
    p=OA/folder/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def encode(a):
    assert 1<=len(a)<=100000 and all(-1000<=x<=1000 for x in a)
    return str(len(a))+'\n'+' '.join(map(str,a))+'\n'

def mask_oracle(a):
    best=-10**30
    for chosen in range(1<<len(a)):
        if any(((chosen>>i)&3)==0 for i in range(len(a)-1)):continue
        best=max(best,sum(x for i,x in enumerate(a) if chosen>>i&1))
    return best

def interval_oracle(a):
    jobs=[(i+2,i,-x) for i,x in enumerate(a) if x<0]
    jobs.sort()
    ends=[]
    profits=[0]
    for end,start,weight in jobs:
        pred=bisect_right(ends,start)
        profits.append(max(profits[-1],profits[pred]+weight))
        ends.append(end)
    return sum(a)+profits[-1]

def run(path,raw):
    start=time.perf_counter()
    p=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=15)
    assert not p.stderr
    return p.stdout.strip(),time.perf_counter()-start

def main():
    started=time.perf_counter()
    raw=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
    assert sha(raw)==RAW_SHA
    assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==BLOB
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    path=OA/f'references/{PID}.py'
    path.write_text(REFERENCE)
    own=runpy.run_path(str(path))['solve']
    count=0
    digest=hashlib.sha256()
    for n in range(1,8):
        for a in product((-1,0,1),repeat=n):
            expected=mask_oracle(a)
            assert int(own(encode(a)))==expected==interval_oracle(a)
            digest.update((encode(a)+str(expected)+'\n').encode())
            count+=1
    assert count==3279
    specs=[[-3,2,4,-1,-2,-5],[9,-1,-3,4,5],[-1000],[-1,-3,-2],[0],[1000],[-1000,-1000],[-1000,1000,-1000],[2,3,-1000]]
    keys={encode(a) for a in specs}
    rng=random.Random(SEED)
    while len(specs)<163:
        a=[rng.choice((-1000,-10,-3,-1,0,1,3,10,1000)) for _ in range(rng.randint(1,12))]
        if encode(a) not in keys:
            keys.add(encode(a));specs.append(a)
    oracles=[]
    for a in specs:
        expected=mask_oracle(a)
        assert interval_oracle(a)==expected
        raw=encode(a)
        assert run(path,raw)[0]==str(expected)
        oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
    assert [o['expectedOutput'] for o in oracles[:3]]==['4\n','17\n','0\n']
    print(f'{PID}:3279 mask enumerations and163 subprocess oracles passed',flush=True)
    cases=[{'name':f'原例{i+1}' if i<2 else ('本站单负值补充例' if i==2 else f'掩码枚举{i-2}'),**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    n=100000
    stress=[
        ('完整全正极值',[1000]*n,n*1000),('完整全负极值',[-1000]*n,-1000*(n//2)),
        ('完整全零',[0]*n,0),('完整全负一',[-1]*n,-n//2),
        ('正负交错',[1000,-1000]*(n//2),1000*(n//2)),
        ('负正交错',[-1000,1000]*(n//2),1000*(n//2)),
        ('可同时跳首尾',[-1000]+[1000]*(n-2)+[-1000],1000*(n-2)),
        ('正负成对',[1000,1000,-1000,-1000]*(n//4),1000*(n//4)),
        ('负零交错',[-1000,0]*(n//2),0),
        ('正数之间两负值',[1000,-1,-1000]*33333+[1000],None),
        ('负数平台与极值',[-1000]*49999+[-1,-1]+[-1000]*49999,None),
        ('中间唯一正值',[-1000]*50000+[1000]+[-1000]*49999,None),
        ('评分全范围循环',[(i%2001)-1000 for i in range(n)],None),
        ('完整随机',[rng.randint(-1000,1000) for _ in range(n)],None),
        ('完整负数随机',[-rng.randint(1,1000) for _ in range(n)],None),
    ]
    evidence=[]
    for name,a,closed in stress:
        expected=interval_oracle(a)
        if closed is not None:assert expected==closed,name
        raw=encode(a)
        actual,elapsed=run(path,raw)
        assert actual==str(expected),name
        cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
        evidence.append({'name':name,'n':len(a),'expected':expected,'independentOracle':'weighted interval scheduling of skipped negative ratings, binary-searched compatibility','closedFormChecked':closed is not None,'localSeconds':round(elapsed,5)})
    assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
    for c in cases:assert run(path,c['input'])[0]==c['expectedOutput'].strip()
    killed=[]
    for i,m in enumerate(MUTANTS,1):
        p=OA/f'negative-controls/{PID}-{i}.py'
        p.write_text(m['code'])
        rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].strip()]
        assert rejected
        killed.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'不能连续跳过两部电影的最大评分和','difficulty':'中等','tags':['OA','Akuna Capital','动态规划','子序列'],
        'description':'按原顺序遍历电影评分数组，选择一个子序列，使所选评分和最大。不能连续跳过两部或更多电影；首部与尾部各跳过一部允许。没有必须选择至少一部的额外条件：n=1时可以跳过唯一一部，空选评分和为0；n≥2时不能全部跳过。',
        'input':'第一行n，第二行n个整数ratings[i]。完整原始范围1≤n≤100000，−1000≤ratings[i]≤1000。',
        'output':'输出满足约束的最大评分和，一个精确整数，不取模。',
        'explanation':'原例1选择[2,4,−2]得到4。原例2选择[9,−1,4,5]得到17，保留原输出；原解释漏掉−1，错误声称9+4+5=17且连续跳过两部，本站明确修正。原文[-1,−3,−2]允许只选第二项，证明首尾单次跳过合法；原无非空要求，第三公开例单个−1000→0为本站补充。',
        'hints':['分别考虑最后一部选择和跳过两种状态。','跳过当前部时，前一部必须选择。','不要强制首尾都选，也不要把全负数组全部跳过。'],
        'timeLimit':2,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized))
    put('oracles',PID+'.json',oracles)
    put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'按末部是否选择维护两个最优状态','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':RAW_SHA,'upstreamCodeExecuted':False,'recoveredConstraints':['1<=n<=100000','-1000<=ratings[i]<=1000','cannot skip two consecutive movies','no explicit nonempty condition'],'correction':'Keep original outputs4/17; second explanation must include-1, selecting9,-1,4,5, not9,4,5. Source internal[-1,-3,-2] permits selecting only middle, proving endpoints may each be skipped.','emptySelectionDisclosure':'No invented nonempty rule. For n1 skipping the only movie is legal and negative rating has optimum0; n>=2 cannot skip all.','siteAdded':'n and array input serialization, scalar integer output; third public single-negative case is supplemental.'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'原始约束与不能连续跳过规则完整，例2仅解释漏-1，正式输出17正确可保留；明确首尾与n1空选边界，不强加非空。独立选择掩码与加权区间调度满域核验通过，仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':killed,'oracleMethod':'Enumerate choice masks, rejecting adjacent skipped bits; independent large-domain weighted interval scheduling of negative-rating skip savings.','exhaustiveSmallDomain':{'cases':count,'nMin':1,'nMax':7,'values':[-1,0,1],'inputExpectedDigest':digest.hexdigest(),'referenceExecution':'in-process own reference versus masks and interval oracle;163 separate subprocess checks'},'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}:{len(cases)} formal cases,15 full-domain interval-oracle cases,2 normal-exit mutants; candidate frozen',flush=True)

if __name__=='__main__':main()
