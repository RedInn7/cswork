"""Reproducible Unknown11 recovery from fixed raw and static source evidence."""

from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / 'content/oa-judge'
PID = 'oa-unknown-11'
BATCH = 'unknown-11-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SOURCE_PATH = 'fastprep/Unknown/qa-disposable-two-sum-copy-20260430.md'
SOURCE_BLOB = '80e880307efa89cb694714ea7c253feec7c90188'
SOURCE_HASH = 'd73141198eb7f314d12b514179cfe838a4e24964dc37c0edd69139a703b0349e'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, target = data[:2]
    numbers = data[2:]
    seen = {}
    for j, value in enumerate(numbers):
        complement = target - value
        if complement in seen:
            return f'{seen[complement]} {j}'
        seen[value] = j
    raise ValueError('input must have one distinct-index solution')

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
'''
MUTANTS = [
    {'name': '先插入当前元素导致复用自身索引', 'code': REFERENCE.replace('        complement = target - value', '        seen[value] = j\n        complement = target - value')},
    {'name': '返回两个数值而不是索引', 'code': REFERENCE.replace("return f'{seen[complement]} {j}'", "return f'{complement} {value}'")},
]


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()


def put(folder,name,value):
    path=OUT/folder/name
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8')


def encode(numbers,target):
    return f'{len(numbers)} {target}\n'+' '.join(map(str,numbers))+'\n'


def all_pairs_oracle(numbers,target):
    # Independent quadratic search over distinct index pairs, no hash table.
    pairs=[]
    for i in range(len(numbers)):
        for j in range(i+1,len(numbers)):
            if numbers[i]+numbers[j]==target:
                pairs.append((i,j))
    return pairs


def legal_case(numbers,target):
    assert 2<=len(numbers)<=10
    assert -10<=target<=10 and all(-10<=value<=10 for value in numbers)
    pairs=all_pairs_oracle(numbers,target)
    assert len(pairs)==1,(numbers,target,pairs)
    return f'{pairs[0][0]} {pairs[0][1]}\n'


def run(code,raw):
    started=time.perf_counter()
    result=subprocess.run([sys.executable,'-c',code],input=raw,text=True,capture_output=True,timeout=10)
    assert result.returncode==0,result.stderr
    return result.stdout.strip(),round(time.perf_counter()-started,4)


def main():
    catalog=next(x for x in json.loads((REPO/'content/oa-master/catalog.json').read_text())['items'] if x['id']==PID)
    assert catalog['contentHash']==SOURCE_HASH
    upstream=REPO
    raw=subprocess.check_output(['git','show',f'{COMMIT}:{SOURCE_PATH}'],cwd=upstream)
    blob=subprocess.check_output(['git','rev-parse',f'{COMMIT}:{SOURCE_PATH}'],cwd=upstream,text=True).strip()
    assert blob==SOURCE_BLOB
    for marker in (b'2 <= nums.length <= 10',b'-10 <= nums[i] <= 10',b'-10 <= target <= 10',b'Only one valid answer exists.',b'nums[0] + nums[1] == 9'):
        assert marker in raw
    mdx_path='web/content/docs/companies/unknown.mdx'
    mdx=subprocess.check_output(['git','show',f'{COMMIT}:{mdx_path}'],cwd=upstream)
    mdx_blob=subprocess.check_output(['git','rev-parse',f'{COMMIT}:{mdx_path}'],cwd=upstream,text=True).strip()
    section=mdx.decode().split('## 11. Two Sum\n',1)[1].split('\n## 12.',1)[0]
    assert {x['language'] for x in catalog['solutions']}=={'python','java','cpp'}
    for solution in catalog['solutions']:
        assert solution['code'].strip() in section
    # Static evidence only: all three implementations look up earlier entries
    # before inserting current i, hence any returned first index is less than i.
    snippets={x['language']:x['code'] for x in catalog['solutions']}
    assert snippets['python'].index('if target - x in seen')<snippets['python'].index('seen[x] = i')
    assert snippets['java'].index('if (seen.containsKey')<snippets['java'].index('seen.put')
    assert snippets['cpp'].index('if (seen.count')<snippets['cpp'].index('seen[nums[i]] = i')
    coverage=next(x for x in json.loads((REPO/'content/oa-judge/reviews/unknown-company-review.json').read_text())['items'] if x['id']==PID)
    public=[('合法原始样例二',[2,7],9),('本站样例：重复值来自不同位置',[3,3],6),('本站样例：禁止复用同一个零',[-3,0,3],0)]
    boundaries=[
        ('最大长度和值域两端',[-10,10]+[5]*8,0),
        ('最大长度目标上界',[0,10]+[-10]*8,10),
        ('最大长度目标下界',[-10,0]+[10]*8,-10),
        ('最大长度重复正值',[3,3]+[10]*8,6),
        ('最大长度重复负值',[-5,-5]+[10]*8,-10),
        ('最大合法答案索引',[10]*8+[-1,1],0),
        ('最小长度负数',[-10,1],-9),
        ('重复零不同索引',[0,0],0),
    ]
    selected={}
    cases=[]
    for index,(name,numbers,target) in enumerate(public+boundaries):
        expected=legal_case(numbers,target)
        text=encode(numbers,target)
        assert text not in selected
        selected[text]=expected
        cases.append({'name':name,'input':text,'expectedOutput':expected,'hidden':index>=3,'weight':1})
    rng=random.Random(SEED)
    attempts=0
    while len(selected)<163:
        attempts+=1
        numbers=[rng.randint(-10,10) for _ in range(rng.randint(2,10))]
        target=rng.randint(-10,10)
        if len(all_pairs_oracle(numbers,target))!=1:
            continue
        text=encode(numbers,target)
        selected.setdefault(text,legal_case(numbers,target))
    for i,(text,expected) in enumerate(list(selected.items())[11:35]):
        cases.append({'name':f'独立唯一解枚举 {i+1}','input':text,'expectedOutput':expected,'hidden':True,'weight':1})
    assert len(cases)==35 and sum(c['hidden'] for c in cases)==32
    times=[]
    for text,expected in selected.items():
        actual,elapsed=run(REFERENCE,text)
        assert actual==expected.strip(),(text,actual,expected)
        times.append(elapsed)
    killed=[]
    for mutant in MUTANTS:
        rejected=[]
        for case in cases:
            actual,_=run(mutant['code'],case['input'])
            if actual!=case['expectedOutput'].strip():
                rejected.append(case['name'])
        assert rejected
        killed.append({'name':mutant['name'],'rejectedByCases':rejected,'exitCode':0})
    editorial='''## 来源与本站补明

固定raw的正文在return后截断，但完整约束保留2≤n≤10、nums和target均在[-10,10]、Only one valid answer exists。两个原样例的解释直接写nums[0]+nums[1]==target并返回[0,1]，表明需要返回两数和的索引，而不是元素值。固定版本Python、Java、C++三份来源实现都先查询先前下标，再插入当前下标，明确一致采用两个不同索引。本站据此补明唯一解指唯一无序索引对，并统一按升序输出0-based索引i<j；这不是将缺失原文伪装成完整原文，也不只是格式转换。

原始样例一[2,7,11,15],target=9含11和15，违反raw给出的值域；不扩大或缩小约束，不将该例用于正式测试。保留合法原样例二[2,7],target=9。其余公开例为本站补充。重复数值合法，但同一索引不可使用两次；[3,3]的两个3分别位于不同位置，构成一个合法索引对；[-3,0,3]且target=0只能返回0和2，不能返回1和1。

## 思路

从左到右扫描，哈希表只记录已扫描元素的值及其索引。当前值为x时，先查target−x是否已经出现；找到即输出其索引与当前索引。否则再记录当前元素。输入保证唯一合法无序索引对，无需定义无解或多解时的返回值。

## 正确性证明

在处理索引j之前，表中只有严格小于j的索引。找到补数时，返回i<j且nums[i]+nums[j]=target，因此索引不同、顺序规范、求和正确。设唯一解为(i,j)，i<j；处理j时补数已经出现。如果该补数有另一个不同的先前索引，则会产生第二个合法索引对，与唯一解保证矛盾，所以记录的索引必为i。算法一定找到且返回唯一解。先查询后插入确保无法把当前元素与自身配对。

## 复杂度与完整边界

期望时间O(n)，额外空间O(n)。完整范围n=2..10，元素和target均为-10..10。两个元素和在[-20,20]内，但target仍限于[-10,10]。所有测试经独立双循环枚举i<j过滤，保证恰好一个解；最大长度、最大/最小值、目标端点、重复正负值、重复零及答案索引8/9均有正式用例。
'''
    package={'schemaVersion':1,'problem':{'id':PID,'courseId':'gomall','lessonId':'00-overview','title':'两数之和的唯一索引对','difficulty':'简单','tags':['OA','Unknown','哈希表'],
        'description':'给定整数数组nums与整数target，返回两个不同索引i、j，使nums[i]+nums[j]=target。输入保证恰好存在一个合法无序索引对。本站固定输出升序0-based索引i<j；允许相同数值来自不同位置，但不允许重复使用同一索引。来源raw正文返回描述残缺，两个样例解释明确返回两数和索引；固定版本三语言源码均先查询先前索引再加入当前索引，本站据此明示不同索引及输出次序。原样例一含11、15超出原值域，不用于正式测试，不能据此扩张约束。',
        'input':'第一行n target；第二行n个nums[i]。完整原约束：2≤n≤10，-10≤nums[i]≤10，-10≤target≤10，且恰有一个i<j满足nums[i]+nums[j]=target。标准输入及升序索引输出为本站协议。',
        'output':'输出两个空格分隔的整数i j，满足0≤i<j<n且nums[i]+nums[j]=target。返回索引，不返回元素值。不包含无解或多解输入。',
        'explanation':'第一例来自合法原样例二，2+7=9，输出0 1。第二例两个3来自不同位置，输出0 1。第三例-3+3=0，输出0 2；不能把位置1的零使用两次。',
        'hints':['先查找此前的补数索引，再记录当前位置。','也可以直接枚举所有i<j，n至多10。'],
        'timeLimit':2,'memoryLimit':131072,'outputLimit':4096,'checker':'tokens','languages':['python','go','java','cpp']},'cases':cases}
    normalize="const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized=subprocess.run(['node','--import','tsx','-e',normalize],cwd=REPO,input=json.dumps(package,ensure_ascii=False),text=True,capture_output=True,check=True).stdout
    authored=[{'language':'python','code':REFERENCE}]
    put('packages',f'{PID}.json',json.loads(normalized))
    (OUT/'references').mkdir(parents=True,exist_ok=True)
    (OUT/'references'/f'{PID}.py').write_text(REFERENCE)
    put('editorials',f'{PID}.json',{'schemaVersion':1,'id':PID,'title':package['problem']['title'],'explanation':editorial,'solutions':authored,'sourceUrl':catalog['sourceUrl'],'sourceContentHash':SOURCE_HASH})
    put('oracles',f'{PID}.json',[{'input':text,'expectedOutput':expected} for text,expected in selected.items()])
    put('mutants',f'{PID}.json',MUTANTS)
    (OUT/'negative-controls').mkdir(parents=True,exist_ok=True)
    for i,mutant in enumerate(MUTANTS,1):
        (OUT/'negative-controls'/f'{PID}-{i}.py').write_text(mutant['code'])
    put('candidate-batches',f'{BATCH}.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':SOURCE_HASH,'packageChecksum':sha(normalized),'editorial':editorial,'authoredSolutions':authored}]})
    put('source-evidence',f'{BATCH}.json',{'schemaVersion':1,'sourceCommit':COMMIT,'items':[{'id':PID,'sourcePath':SOURCE_PATH,'gitBlob':blob,'sourceSha256':sha(raw),'sourceContentHash':SOURCE_HASH,'sourceUrl':catalog['sourceUrl'],'rawFacts':['2≤n≤10','nums/target均在[-10,10]','Only one valid answer exists','两个例子以nums[0]+nums[1]==9解释索引输出'],'supplementalMdxPath':mdx_path,'supplementalMdxBlob':mdx_blob,'sourceImplementations':[{'language':x['language'],'sha256':sha(x['code']),'behavior':'lookup previous indices before insertion of current index; returned indices are distinct and ascending'} for x in catalog['solutions']],'siteAdditions':['明确唯一解按无序不同索引对计数，依据raw唯一性及三语言先查后插语义','标准输入输出固定升序0-based索引','两个补充公开样例'],'excludedSourceExample':{'numbers':[2,7,11,15],'target':9,'reason':'11与15超出raw明确上界10；未用于正式测试，不扩大原值域'},'upstreamCodeExecuted':False}]})
    put('resolutions',f'{BATCH}.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':SOURCE_HASH,'previousReason':coverage['reason'],'reason':'raw完整恢复小范围及唯一解保证；原样例解释确定索引两数和，固定三语言均先查先前索引后插当前，本站公开据此补明不同索引与升序0-based协议。原越界样例不使用，不扩大/缩小原范围。163唯一合法双循环oracle与两个正常退出负控验证通过；仅候选，待真实沙箱验证。'}]})
    put('validation',f'{BATCH}.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(selected),'publicCases':3,'hiddenCases':32,'formalCases':35,'negativeControls':killed,'referenceSha256':sha(REFERENCE),'oracleMethod':'双循环枚举所有i<j，过滤恰一个解；独立于参考哈希表','candidateAttempts':attempts,'maxSubprocessSeconds':max(times),'formalBoundaryCases':[{'name':name,'n':len(numbers),'numbers':numbers,'target':target,'expectedOutput':legal_case(numbers,target).strip()} for name,numbers,target in boundaries],'sourceOutOfRangeExampleExcluded':True}],'note':'163不同合法输入全部真实Python子进程对拍；全部35正式输入属于oracle集合。负控正常退出，复用自身与返回数值错误均被拒。离线生成，未运行GoJudge。'})
    print(json.dumps({'outputDirectory':str(OUT),'uniqueLegalOracleInputs':len(selected),'formalCases':len(cases),'normalExitMutantsKilled':len(killed),'maxSubprocessSeconds':max(times)},ensure_ascii=False))


if __name__=='__main__':
    main()
