"""Six independently authored Amazon OA contracts. No imported code is executed."""
from collections import deque
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'content/oa-judge'


def array_input(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'


def grouping_oracle(x):
    a,spread=x; full=(1<<len(a))-1
    @lru_cache(None)
    def search(mask):
        if mask==0:return 0
        first=mask & -mask; best=len(a); subset=mask
        while subset:
            if subset & first:
                values=[a[i] for i in range(len(a)) if subset>>i & 1]
                if max(values)-min(values)<=spread:best=min(best,1+search(mask^subset))
            subset=(subset-1)&mask
        return best
    return str(search(full))


def prefix_oracle(a):
    start=tuple(a); target=(0,)*len(a); queue=deque([(start,0)]); seen={start}
    while queue:
        state,distance=queue.popleft()
        if state==target:return str(distance)
        for length in range(1,len(a)+1):
            for delta in (-1,1):
                changed=tuple(v+delta if i<length else v for i,v in enumerate(state))
                if all(-3<=v<=3 for v in changed) and changed not in seen:
                    seen.add(changed);queue.append((changed,distance+1))
    raise AssertionError('zero must be reachable within small-state bounds')


def game_oracle(a):
    @lru_cache(None)
    def search(state):
        if not state:return 0
        return max(value-search(state[:i]+state[i+1:]) for i,value in enumerate(state))
    return str(abs(search(tuple(a))))


def floor_oracle(n):return str(sum({n//k for k in range(1,n+2)}))


def balanced_oracle(a):
    return str(sum(a[left]==a[right]==sum(a[left+1:right])
                   for left in range(len(a)) for right in range(left+2,len(a))))


def pair_oracle(x):
    a,m=x
    return str(sum(abs(a[i]-a[j])<=m for i in range(len(a)) for j in range(i+1,len(a))))


SPECS=[
dict(number=2,title='技能水平分班',tags=['排序','贪心'],
 description='给定每位学员的技能值，将所有学员分到若干个非空班级。每个班级内最高技能值与最低技能值的差不能超过 maxSpread。求最少班级数；可以任意选择同班学员，不要求原数组中连续。',
 input='第一行 n maxSpread（1≤n≤100000，0≤maxSpread≤10⁹），第二行 n 个技能值（1..10⁹）。',
 idea='将技能值排序。每次取还未分配的最低值作为新班起点，将所有不超过起点+maxSpread 的后续学员放入这个班。',
 proof='最低未分配技能值必须进入一个班，该班不能包含超过它加 maxSpread 的值。把允许范围内的所有学员都放入同一班不会增加班数：从其它班移走这些学员不会使它们失效。故存在最优解采用当前贪心班级，对剩余学员递推即可。',
 complexity='时间 O(n log n)，额外空间 O(n)（包括排序后的数组）。',
 explanation='样例1可分为 [1,4] 与 [7,8] 两班，组内跨度分别为3和1。',
 samples=[([4,8,1,7],3),([5,5,5],0),([1,3,5],1)],random=lambda r:([r.randint(1,12) for _ in range(r.randint(1,8))],r.randint(0,6)),
 edges=[(([1]*100000,0),'1'),((list(range(1,100001)),0),'100000'),(([1,10**9],10**9),'1')],
 encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=grouping_oracle,
 code='''def solve(data):
    n,spread=map(int,data[:2]); levels=sorted(map(int,data[2:])); classes=0; start=None
    for level in levels:
        if start is None or level-start>spread:classes+=1; start=level
    return str(classes)
''',mutants=[('错把边界相等拆班','level-start>spread','level-start>=spread'),('只比较相邻技能','return str(classes)',"return str(1+sum(levels[i]-levels[i-1]>spread for i in range(1,n)))")]),
dict(number=4,title='前缀加减归零',tags=['差分'],
 description='一次操作选择数组的一个非空前缀，将其中所有元素同时加1或同时减1。求把整个整数数组变成0所需的最少操作次数。数组可以包含负数。',
 input='第一行 n（1..100000），第二行 n 个整数（−10⁹..10⁹）。答案可能超过32位有符号整数范围。',
 idea='从右向左考虑：最后一位需要 |arr[n−1]| 次整段操作；之后相邻值差的绝对值决定还需多少次更短前缀操作。答案为 |arr[n−1]|+Σ|arr[i]−arr[i+1]|。',
 proof='设末尾补一个0，差分 d[i]=arr[i]−arr[i+1]。对长度 i+1 的前缀加减1，只改变 d[i]，其它差分不变。因此每个差分必须至少操作 |d[i]| 次，且逐一消去每个差分能达到这个下界。',
 complexity='时间 O(n)，除输入外额外空间 O(1)。',explanation='样例1的差分为1、2、0、1、−1，绝对值之和为5。',
 samples=[[3,2,0,0,-1],[0],[-2,2]],random=lambda r:[r.randint(-2,2) for _ in range(r.randint(1,3))],
 edges=[([10**9,-10**9]*50000,str(199999*10**9)),([0]*100000,'0'),([-10**9]*100000,str(10**9))],encode=array_input,oracle=prefix_oracle,
 code='''def solve(data):
    a=list(map(int,data[1:])); answer=abs(a[-1])
    for i in range(len(a)-1):answer+=abs(a[i]-a[i+1])
    return str(answer)
''',mutants=[('漏掉最后一位归零','answer=abs(a[-1])','answer=0'),('把负差分忽略','abs(a[i]-a[i+1])','max(0,a[i]-a[i+1])')]),
dict(number=6,title='最优取数游戏的分差',tags=['排序','博弈'],
 description='两名玩家轮流从剩余数组中任选一个正整数，加到自己的分数并移除。玩家1先手，直到数组为空。双方都希望自己的最终分数最大，求最优对弈下两人分数差的绝对值。',
 input='第一行 n（1..100000），第二行 n 个分值（1..10⁹）。',
 idea='所有分值之和固定，因此最大化自己得分等价于最小化对手得分。按分值降序排列，两名玩家交替取数，计算交替和。',
 proof='对剩余数字个数归纳。在降序排列 a 中，先取最大值的分差是 a0−a1+a2−…；先取其它位置 j 后，按归纳假设剩余数字同样交替取。将两个表达式相减，可按相邻降序项配对，所得差非负。因此总存在先取最大值的最优选择，归纳成立。',
 complexity='时间 O(n log n)，额外空间 O(n)（排序和输入存储）。',explanation='样例1依次取4、3、2、1，玩家1得6，玩家2得4，分差为2。',
 samples=[[4,1,2,3],[9],[1,1,1]],random=lambda r:[r.randint(1,12) for _ in range(r.randint(1,8))],
 edges=[([10**9]*100000,'0'),([10**9]*99999,str(10**9)),([9,1,1,1],'8')],encode=array_input,oracle=game_oracle,
 code='''def solve(data):
    points=sorted(map(int,data[1:]),reverse=True); difference=0
    for i,value in enumerate(points):difference+=value if i%2==0 else -value
    return str(abs(difference))
''',mutants=[('不按最优次序取数','sorted(map(int,data[1:]),reverse=True)','list(map(int,data[1:]))'),('只计算最大最小差','return str(abs(difference))','return str(max(points)-min(points))')]),
dict(number=8,title='不同整除商的总和',tags=['整除分块','数学'],
 description='给定正整数 n，考虑所有正整数 k 产生的 floor(n/k)。对出现过的不同商值求和。k 可以大于 n，此时商为0，但不会影响总和。每个商值只计一次。',
 input='输入 n（1..10¹⁰），使用64位整数保存结果。',
 idea='从 k=1 开始。当前商 q=n//k 在整个区间 [k,n//q] 内不变，加一次q后直接跳到 n//q+1。',
 proof='floor(n/k)=q 等价于 n/(q+1)<k≤n/q，所以给出的右端点正好是当前商连续区间的末尾。各区间无重叠、无遗漏，且商值严格递减，累加一次即可去重。',
 complexity='时间 O(√n)，额外空间 O(1)。',explanation='n=5时不同商为5、2、1、0，总和为8。',
 samples=[5,1,10],random=lambda r:r.randint(1,200),
 edges=[(10**10,str(100000*100001//2+sum(10**10//i for i in range(1,100000)))),(1,'1'),(100,'336')],
 encode=lambda n:str(n)+'\n',oracle=floor_oracle,
 code='''def solve(data):
    n=int(data[0]); k=1; answer=0
    while k<=n:
        quotient=n//k; answer+=quotient; k=n//quotient+1
    return str(answer)
''',mutants=[('漏掉商1','while k<=n:','while k<n:'),('错误乘以区间长度','answer+=quotient','answer+=quotient*(n//quotient-k+1)')]),
dict(number=13,title='平衡服务器子段',tags=['前缀和','哈希表'],
 description='给定正整数容量数组。长度至少为3的连续子段是平衡的，当且仅当它的左端容量、右端容量、两端之间全部容量之和三者相等。求平衡子段数量。',
 input='第一行 n（1..100000），第二行 n 个容量（1..10⁹）。',
 idea='设 prefix[i] 是前 i 项和。对子段[l,r]，条件是 arr[l]=arr[r] 且 prefix[l]+2×arr[l]=prefix[r]。遍历右端r时，先把l=r−2加入哈希表，再查询(arr[r],prefix[r])。',
 proof='内部和为 prefix[r]−prefix[l+1]，而 prefix[l+1]=prefix[l]+arr[l]，移项得到哈希键条件。查询前恰好插入所有 l≤r−2 的左端，保证长度至少3。每个合法左右端组合被统计一次。',
 complexity='期望时间 O(n)，额外空间 O(n)。使用64位整数保存前缀和和答案。',explanation='样例1包含整个[9,3,3,3,9]和中间[3,3,3]两个平衡子段。',
 samples=[[9,3,3,3,9],[1,1],[2,2,2]],random=lambda r:[r.randint(1,5) for _ in range(r.randint(1,10))],
 edges=[([1]*100000,'99998'),([10**9]*100000,'99998'),([2,1,1,2],'1')],encode=array_input,oracle=balanced_oracle,
 code='''def solve(data):
    a=list(map(int,data[1:])); prefix=[0]
    for value in a:prefix.append(prefix[-1]+value)
    counts={}; answer=0
    for right in range(2,len(a)):
        left=right-2; key=(a[left],prefix[left]+2*a[left]); counts[key]=counts.get(key,0)+1
        answer+=counts.get((a[right],prefix[right]),0)
    return str(answer)
''',mutants=[('前缀公式少一个端点','prefix[left]+2*a[left]','prefix[left]+a[left]'),('不检查两端值相同','key=(a[left],prefix[left]+2*a[left])','key=(0,prefix[left]+2*a[left])')]),
dict(number=18,title='近似负载的进程对数',tags=['排序','双指针'],
 description='给定进程负载数组和阈值 m。统计不同下标的无序对(i,j)，满足两个负载的差的绝对值不超过m。每对只计一次；数值相同但下标不同也要计数。',
 input='第一行 n m（1≤n≤200000，0≤m≤10⁸），第二行 n 个负载（1..10⁸）。答案可能超过32位整数。',
 idea='排序负载，用左指针维护与当前右端负载相差不超过m的范围。对每个右端，新增 right−left 对。',
 proof='排序后，右端与区间[left,right)内每项的差都不超过m，更左侧的项都不合法。因此 right−left 正好是以当前项作为较右下标的合法对数，每对只在其右端被统计一次。',
 complexity='时间 O(n log n)，额外空间 O(n)（排序后的数组）。',explanation='样例1的合法负载对为(7,10)、(10,13)、(10,11)、(13,11)，共4对。',
 samples=[([7,10,13,11],3),([5,5,5],0),([1],0)],random=lambda r:([r.randint(1,20) for _ in range(r.randint(1,10))],r.randint(0,10)),
 edges=[(([1]*200000,0),str(200000*199999//2)),((list(range(1,200001)),0),'0'),(([1,10**8],10**8),'1')],encode=lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',oracle=pair_oracle,
 code='''def solve(data):
    n,threshold=map(int,data[:2]); values=sorted(map(int,data[2:])); left=0; answer=0
    for right in range(n):
        while left<right and values[right]-values[left]>threshold:left+=1
        answer+=right-left
    return str(answer)
''',mutants=[('排除恰好等于阈值','values[right]-values[left]>threshold','values[right]-values[left]>=threshold'),('把自己也计入','answer+=right-left','answer+=right-left+1')]),
]


def execute(path,stdin):
    result=subprocess.run([sys.executable,'-I',str(path)],input=stdin,text=True,capture_output=True,timeout=8,check=True)
    return result.stdout.strip()


def main():
    for folder in ('packages','editorials','references','oracles','mutants','batches','validation'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    catalog=json.loads((ROOT/'content/oa-master/catalog.json').read_text()); sources={x['id']:x for x in catalog['items']}; items=[]; reports=[]
    for spec in SPECS:
        identifier=f"oa-amazon-{spec['number']}"; rng=random.Random(20260915+spec['number']); source=sources[identifier]
        code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read().split()))\n'
        reference=OUT/'references'/f'{identifier}.py'; reference.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)]; oracles=[]
        for value in values:
            expected=spec['oracle'](value); stdin=spec['encode'](value)
            assert execute(reference,stdin)==expected,(identifier,value,expected)
            oracles.append(dict(input=stdin,expectedOutput=expected+'\n'))
        tests=oracles[:3]+[dict(input=spec['encode'](value),expectedOutput=expected+'\n') for value,expected in spec['edges']]+oracles[3:27]
        cases=[]
        for i,test in enumerate(tests):
            assert execute(reference,test['input'])==test['expectedOutput'].strip(),(identifier,i,test['expectedOutput'])
            cases.append(dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**test,hidden=i>=3,weight=1))
        mutations=[]; controls=[]
        for name,old,new in spec['mutants']:
            assert old in code
            changed=code.replace(old,new)
            if identifier=='oa-amazon-13' and name=='不检查两端值相同':
                changed=changed.replace('counts.get((a[right],prefix[right]),0)', 'counts.get((0,prefix[right]),0)')
            temporary=OUT/'references'/f'{identifier}-mutation.py'; temporary.write_text(changed)
            rejected=[i for i,test in enumerate(cases) if execute(temporary,test['input'])!=test['expectedOutput'].strip()]
            temporary.unlink();assert rejected,(identifier,name,'survived')
            mutations.append(dict(name=name,code=changed));controls.append(dict(name=name,rejectedByCases=rejected))
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Amazon']+spec['tags'],description=spec['description']+'\n\n标准输入格式、样例和评测数据由 CSWork 编写。',input=spec['input'],output='输出一个整数，表示题目要求的答案。',explanation=spec['explanation'],hints=[spec['idea']],timeLimit=3,memoryLimit=262144,outputLimit=4096,checker='tokens',languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 为什么正确\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"; solutions=[dict(language='python',code=code)]
        documents={'packages':json.loads(normalized),'oracles':oracles,'mutants':mutations,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')}
        for folder,document in documents.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
        items.append(dict(id=identifier,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(identifier,len(oracles),'oracle checks;',len(cases),'judge cases; 2 mutants rejected',flush=True)
    (OUT/'batches/amazon-first.json').write_text(json.dumps(dict(schemaVersion=1,items=items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation/amazon-first.json').write_text(json.dumps(dict(schemaVersion=1,seed=20260915,problems=reports,skipped={'oa-amazon-9':'样例[4,1,2,10]不存在符合普通数之和定义的合法和元素，却给出离群值4。','oa-amazon-12':'重复权重和最终相同位置的排序规则未明确。','oa-amazon-7':'某种排列与对任意排列的量词约定需要进一步核实。'},note='Local authored reference/oracle/mutant validation only. Real sandbox acceptance remains a separate release gate.'),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':main()
