#!/usr/bin/env python3
"""Distinct bounded walks: forward subtraction versus canonical-next DAG."""
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
PID='oa-flexport-2'
BATCH='flexport-2-recovered'
COMMIT='e66f809f4c953bce129f68491726176615db6afc'
SOURCE='fastprep/Flexport/flexport-distinct-moves.md'
BLOB='3fb7f08fba5d35a4366400f7fcf618a2813a6615'
RAW_SHA='77f1bee6ed88e653133fae52a6b0a2413359ed7fae43c1318b1ef28d8a5fe865'
HASH='2274148cf5c0ba2cfb5eea1720bba25621f3dc5d286805bf68232e633cfb0235'
MOD=1000000007
SEED=20261103
REFERENCE='''import sys

MOD=1000000007

def solve(raw):
    s,n,x,y=raw.split()
    n,x,y=int(n),int(x),int(y)
    if x>n or y>n:
        return '0'
    f=[0]*(n+1)
    f[x]=1
    last=[[0]*(n+1),[0]*(n+1)]
    for ch in s:
        direction=int(ch=='r')
        added=([0]+f[:-1]) if direction else (f[1:]+[0])
        f=[(f[j]+added[j]-last[direction][j])%MOD for j in range(n+1)]
        last[direction]=added
    return str(f[y])

if __name__=='__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS=[
    {'name':'错误按下标选择方案计数而不去重','code':REFERENCE.replace('-last[direction][j]','')},
    {'name':'错误排除合法空子序列','code':REFERENCE.replace('return str(f[y])','return str((f[y]-int(x==y))%MOD)')},
]
EDITORIAL='''## 固定来源、有限数轴及空子序列

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Flexport/flexport-distinct-moves.md明确：数轴位置为0..n，n是数轴上界；l将j变为j−1，r将j变为j+1，返回distinct subsequences数量模1000000007。本站按不同字符序列计数，同一字符串来自不同下标也只计一次；这一解释由同题Meesho详注佐证，并非声称Flexport正文逐字写有详注。Flexport自身给出完整范围1≤|s|≤1000，0≤x,y,n≤2500，不能暗缩成x,y≤n。

本站明确展开有限数轴的含义：路径初始位置、每步位置和终点都须属于0..n；走出域的字符串不构成这条数轴上的路径。不是反射、停留或越界后再回来的规则，因为这些会改变原文明确的j±1转移。若原允许的宽参数范围中x>n或y>n，则合法路径集合为空，返回0；这是对原域的明确解释，不伪称原文额外保证x,y≤n。

Flexport原文要求distinct subsequences，没有要求非空。固定同题Meesho原文进一步明确按字符序列去重、可删除零个或更多元素；这是跨来源佐证，不伪称Flexport自己写有这段详注。因此删除全部字符得到的空子序列计入：当x=y且属于域内时贡献1。n=0时只有位置0，任何非空动作都越界，所以x=y=0结果1，否则0。s本身仍须非空，不能把输入长度下界改成0。

Flexport原例s=rrlrr,n=6,x=1,y=4写答案3，本站纠正为2并保留原输入。枚举全部32个索引掩码，只有两种有效字符序列rrr与rrlrr；若按索引计数是5，也不是3。原文图片指向作者本机/Users/Eric/.../distinctMoves.png，无法读取，不作为纠正依据。另两个公开例为本站推导：rr从0到1只计r一次；rl在0..1从0回0有空串与rl两种。MDX三语言代码仅按索引选择/跳过，rr从0到1会错误得到2，未执行上游代码。

## 思路

f[p]统计已处理前缀能产生、从x出发且始终在域内、结束于p的不同字符串数，包含空串。当前字符c的位移为±1，移动旧f得到added[p]，越界贡献不加入。新答案本应旧集合并上所有追加c的字符串，但上一次处理相同字符时已能生成的字符串被重复加入。维护last[c][p]记录上次追加c得到的贡献，更新f[p]=f[p]+added[p]−last[c][p]，再令last[c]=added；每步取非负模。

## 正确性证明

初始只有空字符串，从合法x结束于x，因此f[x]=1正确；域外起止不可能组成路径，直接0正确。假设旧f表示准确的不同有效字符串集合。追加当前字符是单射：不同前缀字符串追加同一字母仍不同；相同字符串有唯一运动轨迹和终点，所以按位移平移计数，排除越界后恰好得到全部新追加集合。

若此前从未出现c，追加集合与旧集合不交。否则，旧集合中以c结尾的每个字符串，都可以在c的上一次出现位置结束其嵌入：其此前嵌入的最后c不晚于该位置，移到上次c不改变字符序列或路径。因此旧集合与新追加集合的交集，恰好是上次处理c时记录的全部追加集合。旧前缀集合只增不减，交集没有漏计；last[c]按终点记录正确重叠。减去该交集一次得到不重不漏的并集。归纳成立，最终f[y]即答案。

## 复杂度与完整边界

每个字符处理n+1个位置，时间O(|s|(n+1))、空间O(n+1)，完整1000×2501可直接执行。计数可指数增长，所有状态和减法按1000000007归一化。负模语言需额外加模数。越界起止不能直接用作数组下标。

## 独立验证

小域暴力枚举全部选择掩码，再把得到的字符序列放入集合去重，逐步模拟路径并检查域。穷举长度1..7的全部lr串、n=0..3、x/y=0..4，包含越界端点，总25400组。

163个oracle使用独立canonical-next DAG：从剩余输入中分别选择最早的l或最早的r作为下一个字符，递归语义是在对应后缀继续计数；相同字符序列只使用唯一最早嵌入。每个状态另可在当前位置等于y时终止，贡献空后缀1。实现自右向左，保留两个下一字符分支的后继行，不使用参考的上次贡献减法。短输入与掩码去重暴力交叉，大数据全用该独立DAG；另外以不取模大整数DAG检查取模结果。

正式数据覆盖完整|s|=1000与n=2500、x/y=2500、域外起止、n=0、空串贡献、边界不可越过、重复字符去重、重复交替、多种模回绕及随机。两个负控分别不减重复贡献、错误排除空串，全部正式输入须正常退出后才计击杀。
'''

def sha(v):return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()

def put(folder,name,value):
    p=OA/folder/name;p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def encode(s,n,x,y):
    assert 1<=len(s)<=1000 and set(s)<=set('lr') and all(0<=v<=2500 for v in (n,x,y))
    return f'{s}\n{n} {x} {y}\n'

def canonical(s,n,x,y,mod=MOD):
    if x>n or y>n:return 0
    after=[int(p==y) for p in range(n+1)]
    left=right=None
    for ch in reversed(s):
        if ch=='l':left=after
        else:right=after
        row=[int(p==y) for p in range(n+1)]
        if left is not None:
            for p in range(1,n+1):row[p]+=left[p-1]
        if right is not None:
            for p in range(n):row[p]+=right[p+1]
        after=[v%mod for v in row] if mod else row
    return after[x]

def brute_all(s,n,x):
    result=[0]*(n+1)
    if x>n:return result
    strings={''.join(s[i] for i in range(len(s)) if mask>>i&1) for mask in range(1<<len(s))}
    for word in strings:
        pos=x
        for ch in word:
            pos+=1 if ch=='r' else -1
            if pos<0 or pos>n:break
        else:result[pos]+=1
    return result

def run(path,raw):
    start=time.perf_counter()
    p=subprocess.run([sys.executable,'-I',str(path)],input=raw,text=True,capture_output=True,check=True,timeout=20)
    assert not p.stderr
    return p.stdout.strip(),time.perf_counter()-start

def main():
    started=time.perf_counter()
    raw=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE}'],cwd=ROOT)
    assert sha(raw)==RAW_SHA
    assert subprocess.check_output(['git','hash-object','--stdin'],input=raw,cwd=ROOT).decode().strip()==BLOB
    source=next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert source['contentHash']==HASH
    corroborating='fastprep/Meesho/meesho-distinct-moves.md'
    witness=subprocess.check_output(['git','show',f'{COMMIT}:{corroborating}'],cwd=ROOT)
    assert sha(witness)=='482c27d22175589f08e79cb9f7e59127a85b76705010433593158316683e2632'
    assert subprocess.check_output(['git','hash-object','--stdin'],input=witness,cwd=ROOT).decode().strip()=='95bc775ba41d6bd80e3644ff9d5b605bc02d137c'
    original_strings=[]
    for mask in range(32):
        word=''.join(c for i,c in enumerate('rrlrr') if mask>>i&1)
        pos=1
        for c in word:
            pos+=1 if c=='r' else -1
            if not 0<=pos<=6:break
        else:
            if pos==4:original_strings.append(word)
    assert len(original_strings)==5 and sorted(set(original_strings))==['rrlrr','rrr']
    old=next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id']==PID)
    path=OA/f'references/{PID}.py';path.write_text(REFERENCE)
    own=runpy.run_path(str(path))['solve'];count=0;digest=hashlib.sha256()
    for length in range(1,8):
        for chars in product('lr',repeat=length):
            s=''.join(chars)
            for n in range(4):
                for x in range(5):
                    outcomes=brute_all(s,n,x)
                    for y in range(5):
                        expected=outcomes[y] if y<=n else 0
                        raw=encode(s,n,x,y)
                        assert int(own(raw))==canonical(s,n,x,y)==expected
                        digest.update((raw+str(expected)+'\n').encode());count+=1
    assert count==25400
    specs=[('rrlrr',6,1,4),('rr',2,0,1),('rl',1,0,0),('l',0,0,0),('l',0,1,1),('l',1,2,1)]
    keys={encode(*q) for q in specs};rng=random.Random(SEED)
    while len(specs)<163:
        q=(''.join(rng.choice('lr') for _ in range(rng.randint(1,12))),rng.randint(0,9),rng.randint(0,10),rng.randint(0,10))
        if encode(*q) not in keys:keys.add(encode(*q));specs.append(q)
    oracles=[]
    for q in specs:
        expected=canonical(*q);s,n,x,y=q
        assert expected==(brute_all(s,n,x)[y] if y<=n else 0)
        raw=encode(*q);assert run(path,raw)[0]==str(expected)
        oracles.append({'input':raw,'expectedOutput':str(expected)+'\n'})
    assert [q['expectedOutput'] for q in oracles[:3]]==['2\n','1\n','2\n']
    print(f'{PID}:25400 exhaustive checks and163 canonical-DAG subprocess oracles passed',flush=True)
    cases=[{'name':('原来源例纠正3为2' if i==0 else f'本站推导公开例{i+1}') if i<3 else f'独立规范嵌入{i-2}',**c,'hidden':i>=3,'weight':1} for i,c in enumerate(oracles[:34])]
    stress=[
        ('全右可达1000',('r'*1000,2500,1500,2500),1),
        ('全左可达1000',('l'*1000,2500,2500,1500),1),
        ('全右不可达1001',('r'*1000,2500,0,1001),0),
        ('上边界全右仅空',('r'*1000,2500,2500,2500),1),
        ('下边界全左仅空',('l'*1000,2500,0,0),1),
        ('零域仅空',('lr'*500,0,0,0),1),
        ('零域起终点越界',('lr'*500,0,2500,2500),0),
        ('起点超域',('l'*1000,2499,2500,2499),0),
        ('终点超域',('r'*1000,2499,2499,2500),0),
        ('大域中心交替模回绕',('lr'*500,2500,1250,1250),None),
        ('大域左边界交替',('rl'*500,2500,0,0),None),
        ('大域右边界交替',('lr'*500,2500,2500,2500),None),
        ('一步域交替',('rl'*500,1,0,0),501),
        ('先左后右',('l'*500+'r'*500,2500,500,500),501),
        ('长块交替',('lllrrr'*166+'llrr',2500,1250,1250),None),
        ('满域随机',(''.join(rng.choice('lr') for _ in range(1000)),2500,1000,999),None),
    ]
    evidence=[]
    for name,q,closed in stress:
        expected=canonical(*q)
        if closed is not None:assert expected==closed,name
        raw=encode(*q);actual,elapsed=run(path,raw);assert actual==str(expected),name
        cases.append({'name':name,'input':raw,'expectedOutput':str(expected)+'\n','hidden':True,'weight':1})
        evidence.append({'name':name,'length':len(q[0]),'n':q[1],'x':q[2],'y':q[3],'expected':expected,'oracle':'canonical-next DAG','closedFormChecked':closed is not None,'localSeconds':round(elapsed,5)})
    q=('lr'*50,100,50,50);exact=canonical(*q,mod=None)
    assert exact>MOD and canonical(*q)==exact%MOD
    cases.append({'name':'精确大整数再取模交叉核验','input':encode(*q),'expectedOutput':str(exact%MOD)+'\n','hidden':True,'weight':1})
    assert len(cases)<=64 and len({c['input'] for c in cases})==len(cases)
    for c in cases:assert run(path,c['input'])[0]==c['expectedOutput'].strip()
    killed=[]
    for i,m in enumerate(MUTANTS,1):
        p=OA/f'negative-controls/{PID}-{i}.py';p.write_text(m['code'])
        rejected=[j for j,c in enumerate(cases) if run(p,c['input'])[0]!=c['expectedOutput'].strip()]
        assert rejected;killed.append({'name':m['name'],'rejectedByCases':rejected,'normalExitVerified':True})
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'有限数轴上的不同移动子序列','difficulty':'困难','tags':['OA','Flexport','动态规划','子序列去重'],
        'description':'给定只含l/r的字符串s，选择其子序列。从x开始，l使位置减1，r使位置加1，要求起点、每步位置和终点都在有限数轴0..n内，且最后到达y。按字符序列不同计数，同一字符序列来自不同下标只计一次。返回计数对1000000007取模。不可反射、越界停留或离开域后再回来。',
        'input':'第一行s，第二行n x y。完整原范围1≤|s|≤1000，s仅l/r，0≤n,x,y≤2500。原文没有保证x,y≤n，本站保留这些输入：若起点或终点不在0..n，没有合法路径，答案为0。',
        'output':'输出0..1000000006内的整数。可删除全部字符，因此合法x=y时空子序列贡献1；n=0,x=y=0答案1，其余域外端点答案0。有限域来自Flexport原文；空子序列采用子序列通常定义，并由同题Meesho明确删除定义佐证，不额外要求非空。',
        'explanation':'第一例保留Flexport原输入rrlrr,6,1,4，但原答3纠正为2：只有rrr和rrlrr，32个索引子集枚举证明；本机图片不可访问，不作为证据。后两例为本站推导：rr从0到1只计r一次；rl从0回0计空串和rl。Flexport自身给出完整数值约束；同题Meesho的字符去重及删除定义作为解释佐证，不称为Flexport正文详注。',
        'hints':['只按位置进行普通选择/跳过会重复计数相同字符串。','追加当前字母时，减掉上次追加同一字母已产生的集合。','必须保留空串，并排除每一步越出0..n的移动。'],
        'timeLimit':3,'memoryLimit':131072,'outputLimit':64,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    script="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',script],cwd=ROOT,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    solutions=[{'language':'python','code':REFERENCE}]
    put('packages',PID+'.json',json.loads(normalized));put('oracles',PID+'.json',oracles);put('mutants',PID+'.json',MUTANTS)
    put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':'按末字符减去重复贡献的有界路径DP','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCE,'gitBlobSha':BLOB,'rawSha256':RAW_SHA,'upstreamCodeExecuted':False,'corroboratingSource':{'path':'fastprep/Meesho/meesho-distinct-moves.md','gitBlobSha':'95bc775ba41d6bd80e3644ff9d5b605bc02d137c','rawSha256':'482c27d22175589f08e79cb9f7e59127a85b76705010433593158316683e2632','role':'Same interface, movement rules, modulus and bounds; explicit character-string deduplication and deleting zero or more elements. Not needed to supply numeric bounds.'},'recoveredConstraints':['1<=length(s)<=1000','0<=n,x,y<=2500','s in l/r','distinct by characters, not indices','mod1000000007'],'interpretationDisclosure':'Finite positions0..n and n upper bound require entire path inside domain; no reflection/clamping. Wide source domain retained: outside start/end means no valid paths. Deleting all characters allowed, so empty sequence contributes1 exactly at valid x=y. Source does not separately assert x/y<=n or nonempty selection.','correction':'Original rrlrr,n6,x1,y4 says3; exhaustive32 masks produce only rrr and rrlrr (2 distinct strings,5 index choices). Catalog ordinary indexed-subsequence DP also overcounts rr from0to1 as2 rather than1. Local author-image path inaccessible and not used.','siteAdded':'s and n x y serialization; first public example preserves original input and corrects3to2, remaining two are authored. Empty-sequence explanation corroborated by same-problem Meesho explicit subsequence definition, not attributed to Flexport wording.'}}})
    put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'原文有限数轴0..n及明确j±1转移排除反射/停留，保留全部宽参数域并披露域外起止0与空串规则。不同字符序列用减重复贡献DP，独立规范嵌入DAG/25400去重暴力及完整边界通过，仅候选待沙箱。'}]})
    put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'referenceSha256':sha(REFERENCE),'negativeControls':killed,'oracleMethod':'Canonical earliest-next-character embedding DAG computed backward; independent bitmask->string-set enumeration with explicit bounded simulation.','exhaustiveSmallDomain':{'cases':count,'lengthMin':1,'lengthMax':7,'alphabet':'lr','nMax':3,'xyMax':4,'inputExpectedDigest':digest.hexdigest()},'exactModuloCrossCheck':{'input':encode(*q),'exactCount':str(exact),'modulo':exact%MOD},'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
    print(f'{PID}:{len(cases)} formal cases,16 full-length cases,2 normal-exit mutants; candidate frozen',flush=True)

if __name__=='__main__':main()
