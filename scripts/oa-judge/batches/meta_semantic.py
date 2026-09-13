"""Author Meta 16/17 with independent set-valued oracles and fixed checkers."""
import collections
import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'
BATCH='meta-semantic'


def pair_oracle(x):
    values,target=x
    pairs={(a,b) for a,b in itertools.combinations(values,2)}
    distance=min(abs(a+b-target) for a,b in pairs)
    return {pair for pair in pairs if abs(sum(pair)-target)==distance}


def pair_accepts(actual,x,expected):
    try:pair=tuple(map(int,actual.split()))
    except ValueError:return False
    if len(pair)!=2:return False
    values,target=x; available=collections.Counter(values)
    if any(count>available[value] for value,count in collections.Counter(pair).items()):return False
    return abs(sum(pair)-target)==abs(sum(map(int,expected.split()))-target)


def peaks_oracle(a):
    return {(i,) for i,value in enumerate(a) if (i==0 or value>a[i-1]) and (i+1==len(a) or value>a[i+1])}


def peak_accepts(actual,a,expected):
    try:result=tuple(map(int,actual.split()))
    except ValueError:return False
    if len(result)!=1:return False
    i=result[0]
    return 0<=i<len(a) and (i==0 or a[i]>a[i-1]) and (i+1==len(a) or a[i]>a[i+1])


def random_peak(r):
    result=[]
    for _ in range(r.randint(1,15)):
        options=[v for v in range(-5,6) if not result or v!=result[-1]]
        result.append(r.choice(options))
    return result


SPECS=[dict(id=16,title='最接近目标和的两个数',checker='oa-closest-pair',tags=['双指针'],
desc='给定非递减正整数数组，选择两个不同下标，使对应数值之和与目标k的绝对差最小。输出这两个数值，任意顺序均可；有多组最优答案时任选一组。相同数值只有在数组中至少出现两次时才能同时选择。',
input='本站输入：第一行n k（2≤n≤100000，−2147483648≤k≤2147483647）；第二行n个非递减正整数（1..2147483647）。求和及差值请使用64位整数。',
output='输出两个整数数值，空格分隔。允许交换顺序或输出任意其它最优值对；不要求匹配样例的唯一写法。',
idea='双指针从数组两端开始，维护当前最小绝对差。和小于目标时左指针右移，否则右指针左移，始终保证两个下标不同。',
proof='当当前和小于目标时，固定左指针并减小右指针只会让和更小，无法改善当前差，因此可以舍弃该左端；和不小于目标时，固定右端并增加左端也不会更好，可以舍弃该右端。每次记录当前候选，最终保留全局最优值对。',
complexity='时间O(n)，除输入外空间O(1)。',
samples=[([5,8,14,17,25,40,43],35),([1,2,3,4],5),([2,2,9],4)],
notes=['8与25的和是33，距离35为2，没有更接近的合法数对；25 8也接受。','1 4与2 3的和都为5，任意一组及其逆序都接受。','数组中有两个独立的2，因此可以输出2 2，恰好达到目标4。'],
random=lambda r:(sorted(r.randint(1,20) for _ in range(r.randint(2,12))),r.randint(-5,45)),
encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=pair_oracle,accepts=pair_accepts,
edges=[(([1]*100000,2),'1 1'),(([2147483647]*100000,-2147483648),'2147483647 2147483647'),((list(range(1,100001)),100001),'1 100000'),(([1,2147483647],2147483647),'1 2147483647')],
code='''def solve(data):
    n,target=map(int,data[:2]); a=list(map(int,data[2:])); left=0; right=n-1; distance=None; answer=(a[0],a[-1])
    while left<right:
        total=a[left]+a[right]; delta=abs(total-target)
        if distance is None or delta<distance:distance=delta; answer=(a[left],a[right])
        if total<target:left+=1
        else:right-=1
    return ' '.join(map(str,answer))
''',mutants=[('总取首尾两个值',"return ' '.join(map(str,answer))","return f'{a[0]} {a[-1]}'"),('允许重复使用同一下标',"return ' '.join(map(str,answer))","value=min(a,key=lambda v:abs(2*v-target)); return f'{value} {value}'")],
alternatives=[('保留最后遇到的最优对','delta<distance','delta<=distance'),('颠倒答案值顺序',"return ' '.join(map(str,answer))","return ' '.join(map(str,answer[::-1]))")],
acceptance_input=([1,2,3,4],5),acceptance_outputs=['1 4\n','4 1\n','2 3\n','3 2\n']),
dict(id=17,title='查找任意峰值下标',checker='oa-peak-index',tags=['二分查找'],
desc='峰值严格大于相邻元素，数组两端外视为负无穷。相邻元素保证不相等。返回任意峰值的0起始下标；如果有多个峰，任意一个都正确。要求O(log n)时间。',
input='第一行n（1..1000）；第二行n个整数（−2147483648..2147483647），相邻两数不同。',output='输出任意合法峰值的0起始下标，不要求和样例选择同一个峰。',
idea='二分比较中点与右邻居。中点更小时，右半边存在峰；否则左半边连同中点存在峰。',
proof='沿上升方向前进必然遇到下降位置或数组边界，那里就是峰。二分始终保留一个含峰区间：上升时舍弃中点及左侧，下降时保留中点及左半侧。区间只剩一个下标时该点即为峰。',complexity='时间O(log n)，除输入存储外空间O(1)。',
samples=[[1,2,3,1],[1,3,1,3,1],[-2147483648]],
notes=['下标2的3大于左右邻居2和1，因此输出2。','下标1与3的值都是3，均严格大于两侧1；输出1或3均接受。','唯一元素比两侧视作负无穷的位置大，因此下标0合法，即使该元素是最小32位整数。'],
random=random_peak,encode=lambda a:str(len(a))+'\n'+' '.join(map(str,a))+'\n',oracle=peaks_oracle,accepts=peak_accepts,
edges=[(list(range(1000)),'999'),(list(range(1000,0,-1)),'0'),([0,1]*500,'1'),([-2147483648,2147483647],'1')],
code='''def solve(data):
    n=int(data[0]); a=list(map(int,data[1:])); left=0; right=n-1
    while left<right:
        middle=(left+right)//2
        if a[middle]<a[middle+1]:left=middle+1
        else:right=middle
    return str(left)
''',mutants=[('总返回首个下标','return str(left)',"return '0'"),('返回谷底下标','return str(left)','return str(a.index(min(a)))')],
alternate_code='''def solve(data):
    n=int(data[0]); a=list(map(int,data[1:])); left=0; right=n-1
    while left<right:
        middle=(left+right)//2
        if a[n-1-middle]<a[n-2-middle]:left=middle+1
        else:right=middle
    return str(n-1-left)
''',acceptance_input=[1,3,1,3,1],acceptance_outputs=['1\n','3\n']),
]


def program(code):return code+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'


def execute(path,stdin):
    result=subprocess.run([sys.executable,'-I',str(path)],input=stdin,text=True,capture_output=True,timeout=10)
    assert result.returncode==0,(str(path),result.returncode,result.stderr)
    return result.stdout.strip()


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','resolutions','acceptance'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={item['id']:item for item in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    previous={item['id']:item['reason'] for item in json.loads((OUT/'reviews/meta-first.json').read_text())['items']}
    entries=[]; reports=[]; resolutions=[]; acceptance=[]
    for spec in SPECS:
        identifier=f"oa-meta-{spec['id']}"; rng=random.Random(20260922+spec['id']); code=program(spec['code']); reference=OUT/'references'/f'{identifier}.py'; reference.write_text(code)
        oracles=[]; data=[]
        for value in spec['samples']+[spec['random'](rng) for _ in range(160)]:
            allowed=spec['oracle'](value); answer=' '.join(map(str,min(allowed))); stdin=spec['encode'](value); actual=execute(reference,stdin)
            result=tuple(map(int,actual.split()))
            if spec['id']==16:result=tuple(sorted(result))
            assert result in allowed,(identifier,value,actual,allowed)
            oracles.append(dict(input=stdin,expectedOutput=answer+'\n'))
            data.append((value,answer))
        # Small cases use full enumerated result sets; large structured cases
        # use manually derived optimal pairs/peaks and verify actual semantics.
        formal=data[:3]+spec['edges']+data[3:31]; cases=[]
        for index,(value,answer) in enumerate(formal):
            stdin=spec['encode'](value); assert spec['accepts'](execute(reference,stdin),value,answer),(identifier,index)
            cases.append(dict(name=f'样例 {index+1}' if index<3 else f'边界与组合 {index-2}',input=stdin,expectedOutput=answer+'\n',hidden=index>=3,weight=1))
        mutants=[]; killed=[]
        for index,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code; changed=code.replace(old,new); path=OUT/'negative-controls'/f'{identifier}-{index}.py'; path.write_text(changed); rejected=[]
            for case_index,(value,answer) in enumerate(formal):
                if not spec['accepts'](execute(path,spec['encode'](value)),value,answer):rejected.append(case_index)
            assert rejected,(identifier,name,'survived')
            mutants.append(dict(name=name,code=changed)); killed.append(dict(name=name,rejectedByCases=rejected))
        # These full programs are not displayed as references, but are runnable
        # positive controls for E2E testing of non-identical accepted answers.
        alternatives=[dict(name=name,code=code.replace(old,new)) for name,old,new in spec.get('alternatives',[])]
        if spec.get('alternate_code'):alternatives.append(dict(name='从反向视图二分得到另一个峰',code=program(spec['alternate_code'])))
        for index,alternative in enumerate(alternatives,1):
            path=OUT/'acceptance'/f'{identifier}-{index}.py'; path.write_text(alternative['code'])
            for value,answer in formal+data:
                assert spec['accepts'](execute(path,spec['encode'](value)),value,answer),(identifier,alternative['name'],value)
        sample_input=spec['encode'](spec['acceptance_input']); expected=spec['acceptance_outputs'][0]
        for output in spec['acceptance_outputs']:assert spec['accepts'](output,spec['acceptance_input'],expected)
        acceptance.append(dict(id=identifier,checker=spec['checker'],input=sample_input,expectedOutput=expected,acceptedOutputs=spec['acceptance_outputs'],programs=alternatives))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Meta']+spec['tags'],description=spec['desc']+'\n\n输入格式、约束补充、样例及评测数据由CSWork独立整理。',input=spec['input'],output=spec['output'],explanation='\n\n'.join(f'样例{i+1}：{note}' for i,note in enumerate(spec['notes'])),hints=[spec['idea']],timeLimit=3,memoryLimit=262144,outputLimit=4096,checker=spec['checker'],languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"; solutions=[dict(language='python',code=code)]
        documents={'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}
        for folder,document in documents.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=killed,positiveControls=[dict(name=item['name'],cases=len(formal)+len(data)) for item in alternatives],referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        resolutions.append(dict(id=identifier,batch=BATCH,sourceContentHash=sources[identifier]['contentHash'],previousReason=previous[identifier],reason='新增固定身份语义检查器，接受全部合法最优值对及其逆序。穷举独立小输入最优集合，验证正常错误程序与多答案正控。' if spec['id']==16 else '新增固定身份语义检查器，接受任意合法峰值下标。独立枚举全部峰值集合，验证正常错误程序与反向二分多答案正控。'))
        print(identifier,len(oracles),'set-valued oracle cases;',len(cases)-3,'hidden; 2 semantic negative controls;',len(alternatives),'positive programs passed',flush=True)
    for folder,document in [('batches',dict(schemaVersion=1,items=entries)),('validation',dict(schemaVersion=1,seed=20260922,problems=reports,note='Local semantic validation; requires real sandbox evidence before publication.')),('resolutions',dict(schemaVersion=1,items=resolutions)),('acceptance',dict(schemaVersion=1,items=acceptance))]:(OUT/folder/f'{BATCH}.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
