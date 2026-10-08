#!/usr/bin/env python3
"""Optional trading-window modification, full SIG domain and fixed OCR."""
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
PID='oa-sig-1'
BATCH='sig-1-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
HASH='bea0b8df1d3fbdee64eadfe8b09c2ecc50d80267c7996d23ea44af8d03349c6a'
SOURCES=[
 ('OA LIST/SIG_OA/001_image.txt','59b1a8e590709133eab76240c0b1faaf9bff836f','b9d4c912303d177e91828796f89ded157e34ef044747690def7d67c858353963'),
 ('OA LIST/SIG_OA/002_image.txt','e47911564f429de6f4cae4186da8bc5b937f6e03','8a1a3d8317e2f05efae5b3d3891397f3277ef119b96c9f2228c000fa160a3445'),
 ('OA LIST/SIG_OA/003_image.txt','79fb0f8382175de6613f3b5d7b7885a0489f7260','bd2d60f8798528bb40a49724c826f1edac00c196b0f4ea1a81b0a54a2b780320'),
 ('OA LIST/eBay_OA/019_image.txt','f8d41eb7d869c84cd27d51e7104af6da20b696aa','48912d7d0d09fcb43f7092a9a387569f1ff0b5cfccd214f27415a478b5f41272'),
 ('OA LIST/eBay_OA/020_image.txt','f8d5e03c95131725fd569def165407d08792696d','522753eaf68e7e0dded44a59f8f07ca5db67daf3ce4ba1d105248c99c7a7d55f'),
 ('OA LIST/eBay_OA/023_image.txt','196f04f1591749ddee54e6869d34f865afdcb61c','246cab9a3b940735baeef4d20ef0dad6534e34a5e99bd69b544e297da713da4f'),
]
SEED=20261028
REFERENCE='''import sys

def solve(raw):
    data=list(map(int,raw.split()))
    n,k=data[:2]
    rates=data[2:2+n]
    strategy=data[2+n:]
    contribution=[rates[i]*strategy[i] for i in range(n)]
    baseline=sum(contribution)
    half=k//2
    old=sum(contribution[:k])
    replacement=sum(rates[half:k])
    best=max(0,replacement-old)
    for left in range(n-k):
        old+=contribution[left+k]-contribution[left]
        replacement+=rates[left+k]-rates[left+half]
        best=max(best,replacement-old)
    return str(baseline+best)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
 {'name':'错误强制修改一次不能保留原策略','code':REFERENCE.replace('best=max(0,replacement-old)','best=replacement-old')},
 {'name':'错误把卖出半区放在窗口前半','code':REFERENCE.replace('sum(rates[half:k])','sum(rates[:half])').replace('rates[left+k]-rates[left+half]','rates[left+half]-rates[left]')},
]
EDITORIAL='''## 固定来源、可选修改与同题补页

固定提交e66f809f4c953bce129f68491726176615db6afc的OA LIST/SIG_OA/001_image.txt明确：strategy中−1买入、0不操作、1卖出；利润为全部卖出价格之和减全部买入价格之和，可能为负。原NOTE保证始终有足够货币和资金，因此不模拟库存或预算，也不限制先买后卖。

001使用may change：可以不修改；如果修改，选择一个恰好k长的连续窗口，将前k/2项设0、后k/2项设1，其他位置不变。这里可选一次修改，不能误读成强制修改或反复修改。为明确可选性的实际区别，本站补充rates=[1,1]、strategy=[1,1]、k=2：不修改得2，强制修改只能得1。原文“choose the range optimally”说明选用修改时选择最优窗口，不取消may的含义。

SIG003自身给完整n范围2..100000、rates[i]范围1..1000、strategy等长且值−1/0/1，k仅标题处截断。k范围由固定同题eBay_OA/023_image.txt补齐：偶数且2≤k≤nums.length。其nums是页内变量名笔误，该任务唯一数组长度是rates/strategy的共同长度n；本题公开归一化为2≤k≤n。对应关系不只凭标题：eBay019/020与SIG001/002的规则、无预算NOTE、完整样例数组/策略/k=4及答案18一致。仅补缺失k范围，不将另一公司页面的价格上界替换SIG自身明确的1000。

原例rates=[2,4,1,5,10,6]、strategy=[−1,1,0,1,−1,0]、k=4，原利润−3，三个修改窗口分别得−4、13、18，答案18保持。另两公开例为本站补充。输入为n k、价格数组、策略数组，输出一个整数；未执行上游代码。

## 思路

原利润记为B。修改窗口[l,l+k)时，移除窗口原贡献old，再加入后半段价格和replacement，净增益为replacement−old。可不修改对应增益0。枚举所有窗口，最大利润就是B加上0和所有增益的最大值。

参考实现维护窗口原贡献和、后半段价格和。窗口右移1，原贡献去掉左端、加入新右端；后半段去掉原l+k/2、加入新l+k，两和均O(1)更新。k=n时只有首窗口，循环自然为空。

## 正确性证明

利润按每一天独立相加，原NOTE排除了资金/库存对操作可行性的额外影响。修改窗口之外各项不变；窗口前半设0贡献0，后半设1贡献对应价格，所以移除old再加replacement恰好给出该窗口修改后的真实利润。

初始化准确覆盖第一个窗口。每次滑动只移除离开的元素、加入进入的元素，两个维护和始终等于当前窗口原贡献及后半价格之和。遍历的起点0..n−k恰好覆盖所有合法窗口，无遗漏。合法策略是保持原状或修改这些窗口之一，取增益0与全部窗口增益最大值因此得到最优利润。

## 复杂度与数值边界

计算原贡献及窗口扫描共O(n)时间，保存输入和贡献O(n)空间，滑窗额外O(1)。最终策略每项仍为−1/0/1，利润绝对值≤1000n≤10^8；中间计算使用Python整数或64位即可。不能把负最优利润钳为0：不修改提供的是原利润，而非零利润。

## 独立验证

小域oracle复制策略数组，逐窗口实际写入前半0/后半1，然后从头逐日求利润，同时比较未修改方案；不使用增益/滑动递推。163个唯一oracle通过真实子进程，另穷举n=2..5、价格1/2、策略−1/0/1及全部合法偶数k，共18396组。

大域另建价格与原贡献两个前缀数组，对每个窗口独立算区间差，不使用参考的相邻窗口递推。完整n=100000覆盖全买/全卖/全保持、价格端点、k=2与k=n、最大奇数n的最大偶数k、首尾最优、窗口半区极不均衡及固定随机。部分大例同时用闭式确认。负控分别强制修改、把卖出半区错放到前半，所有正式输入正常退出后才计击杀。
'''

def sha(v):return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()

def put(folder,name,value):
    p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def encode(r,s,k):
    assert 2<=len(r)<=100000 and len(r)==len(s) and 2<=k<=len(r) and k%2==0
    assert all(1<=v<=1000 for v in r) and all(v in (-1,0,1) for v in s)
    return f'{len(r)} {k}\n'+' '.join(map(str,r))+'\n'+' '.join(map(str,s))+'\n'

def brute(r,s,k):
    answer=sum(a*b for a,b in zip(r,s))
    for left in range(len(r)-k+1):
        changed=list(s)
        changed[left:left+k]=[0]*(k//2)+[1]*(k//2)
        answer=max(answer,sum(a*b for a,b in zip(r,changed)))
    return answer

def prefix_oracle(r,s,k):
    price=[0];profit=[0]
    for a,b in zip(r,s):price.append(price[-1]+a);profit.append(profit[-1]+a*b)
    answer=profit[-1]
    for left in range(len(r)-k+1):
        total=profit[left]+profit[-1]-profit[left+k]+price[left+k]-price[left+k//2]
        answer=max(answer,total)
    return answer

def run(path,raw):
    start=time.perf_counter()
    p=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=15)
    assert not p.stderr
    return p.stdout.strip(),time.perf_counter()-start

def main():
    started=time.perf_counter()
    for p,b,h in SOURCES:
        raw=subprocess.check_output(['git','show',f'{COMMIT}:{p}'],cwd=ROOT)
        assert sha(raw)==h
        assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==b
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    path=OA/f'references/{PID}.py';path.write_text(REFERENCE)
    own=runpy.run_path(str(path))['solve'];count=0;digest=hashlib.sha256()
    for n in range(2,6):
        for r in product((1,2),repeat=n):
            for s in product((-1,0,1),repeat=n):
                for k in range(2,n+1,2):
                    expected=brute(r,s,k);raw=encode(r,s,k)
                    assert int(own(raw))==prefix_oracle(r,s,k)==expected
                    digest.update((raw+str(expected)+'\n').encode());count+=1
    assert count==18396
    specs=[([2,4,1,5,10,6],[-1,1,0,1,-1,0],4),([1,1],[1,1],2),([1,1000],[0,0],2)]
    keys={encode(*q) for q in specs};rng=random.Random(SEED)
    while len(specs)<163:
        n=rng.randint(2,24);k=2*rng.randint(1,n//2)
        q=([rng.choice((1,2,100,999,1000)) for _ in range(n)],[rng.choice((-1,0,1)) for _ in range(n)],k)
        if encode(*q) not in keys:keys.add(encode(*q));specs.append(q)
    oracles=[]
    for q in specs:
        expected=brute(*q);assert prefix_oracle(*q)==expected
        raw=encode(*q);assert run(path,raw)[0]==str(expected)
        oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
    assert [o['expectedOutput'] for o in oracles[:3]]==['18\n','2\n','1000\n']
    print(f'{PID}:18396 exhaustive checks and163 direct-modification subprocess oracles passed',flush=True)
    cases=[{'name':'原OCR样例' if i==0 else (f'本站补充例{i}' if i<3 else f'直接改数组{i-2}'),**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    n=100000
    stress=[
        ('全卖保持原状',[1000]*n,[1]*n,2,1000*n),
        ('全卖全窗仍不改',[1000]*n,[1]*n,n,1000*n),
        ('全买小窗答案仍负',[1000]*n,[-1]*n,2,-1000*n+3000),
        ('全买全窗',[1000]*n,[-1]*n,n,500*n),
        ('全保持最小价格',[1]*n,[0]*n,n,n//2),
        ('全保持最小窗口',[1000]*n,[0]*n,2,1000),
        ('最大奇数长度偶数窗口',[1000]*(n-1),[-1]*(n-1),n-2,1000*((n-2)//2)-1000),
        ('首窗口最佳',[1000]*n,[-1]*100+[1]*(n-100),100,None),
        ('尾窗口最佳',[1000]*n,[1]*(n-100)+[-1]*100,100,None),
        ('全窗后半价格高',[1]*(n//2)+[1000]*(n//2),[0]*n,n,500*n),
        ('全窗前半价格高',[1000]*(n//2)+[1]*(n//2),[0]*n,n,n//2),
        ('买卖交错',[1,1000]*(n//2),[-1,1]*(n//2),50000,None),
        ('策略三值循环',[(i%1000)+1 for i in range(n)],[(-1,0,1)[i%3] for i in range(n)],99998,None),
        ('满域固定随机',[rng.randint(1,1000) for _ in range(n)],[rng.randint(-1,1) for _ in range(n)],2*rng.randint(1,n//2),None),
    ]
    evidence=[]
    for name,r,s,k,closed in stress:
        expected=prefix_oracle(r,s,k)
        if closed is not None:assert expected==closed,name
        raw=encode(r,s,k);actual,elapsed=run(path,raw);assert actual==str(expected),name
        cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
        evidence.append({'name':name,'n':len(r),'k':k,'expected':expected,'oracle':'independent prefix sums, no sliding recurrence','closedFormChecked':closed is not None,'localSeconds':round(elapsed,5)})
    assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
    for c in cases:assert run(path,c['input'])[0]==c['expectedOutput'].strip()
    killed=[]
    for i,m in enumerate(MUTANTS,1):
        p=OA/f'negative-controls/{PID}-{i}.py';p.write_text(m['code'])
        rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].strip()]
        assert rejected;killed.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'可选一次半保持半卖出的交易策略修改','difficulty':'中等','tags':['OA','SIG','滑动窗口','前缀和'],
        'description':'每天价格rates[i]>0，策略−1买入一单位、0不操作、1卖出一单位。保证资金和持仓始终足够，利润为Σrates[i]×strategy[i]，可为负。可以保持原策略，或修改一次：选择恰长k的连续窗口，将前k/2项设0、后k/2项设1，窗口外不变。求最大利润。',
        'input':'第一行n k，第二行n个rates，第三行n个strategy。SIG原始范围2≤n≤100000、1≤rates[i]≤1000、strategy[i]∈{−1,0,1}。k为偶数且2≤k≤n，来自完全同题eBay023对SIG截断处的补充；该页nums.length归一化为共同数组长度n。',
        'output':'输出最大利润，一个整数；可以不改，但不能把负利润当成0，也不能多次修改。',
        'explanation':'原例原利润−3，三个修改窗口利润−4、13、18，所以18。第二例为本站补充：全卖[1,1]不修改得2，强制修改只得1；第三补充例价格[1,1000]、策略[0,0]、k2后半卖出得1000。原文may change支持可选一次修改，NOTE排除库存与资金约束。SIG自身价格上界1000保留，不用同题其他公司更大上界替代。',
        'hints':['原利润加最大修改增益，增益也可以选0。','新窗口只保留后半价格贡献。','两个窗口和均可常数时间滑动更新。'],
        'timeLimit':2,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'维护原窗口利润与后半卖出价格和','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCES[0][0],'gitBlobSha':SOURCES[0][1],'rawSha256':SOURCES[0][2],'sources':[{'path':p,'gitBlobSha':b,'sha256':h,'role':r} for (p,b,h),r in zip(SOURCES,['SIG complete operation/profit/unlimited budget/may change','SIG original example18','SIG own numeric n/rate/strategy bounds,k truncated','identical operation for same-task linkage','identical full sample and budget note','same-task missing k range;nums naming typo'])],'upstreamCodeExecuted':False,'recoveredConstraints':['2<=n<=100000','1<=rates[i]<=1000 from SIG003','strategy in-1,0,1 and same length','k even,2<=k<=n from same-task eBay023'],'interpretationDisclosure':'May change means zero or one operation. If used, exactlyk consecutive entries become half0/half1. Profit defined without budget/inventory restrictions. eBay nums.length normalized to the common array length; do not replace SIG price bound by another variant.','sameProblemEvidence':'Same operation text,profit definition,budget note and complete rates/strategy/k4 example with output18.','siteAdded':'n k and two array lines; two supplemental public examples distinguish optional modification and half orientation.'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'SIG001明确利润/充足预算/可选修改，SIG003自身完整价格与n范围；同例同规则eBay023补齐偶数k2..n并披露变量笔误。原18保留，18396穷举与163oracle/满域前缀核验通过，仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':killed,'oracleMethod':'Copy and modify strategy per window, fully sum all days; large cases independent price/profit prefix sums rather than sliding recurrence.','exhaustiveSmallDomain':{'cases':count,'nMin':2,'nMax':5,'rates':[1,2],'strategy':[-1,0,1],'allEvenK':True,'inputExpectedDigest':digest.hexdigest()},'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}:{len(cases)} formal cases,14 large-prefix checks,2 normal-exit mutants; candidate frozen',flush=True)

if __name__=='__main__':main()
