"""Independent Nvidia 1–8 authoring. Never executes imported solutions."""
from collections import Counter
from itertools import permutations
from pathlib import Path
import hashlib,json,random,subprocess,sys
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'content/oa-judge';BATCH='nvidia-first';SPECS=[]
def arr(a):return str(len(a))+'\n'+' '.join(map(str,a))+'\n'
def add(n,title,desc,limits,idea,proof,cost,samples,explain,rnd,edges,encode,oracle,code,mutants,bound,**extra):
    SPECS.append(dict(n=n,title=title,desc=desc,limits=limits,idea=idea,proof=proof,cost=cost,samples=samples,explain=explain,random=rnd,edges=edges,encode=encode,oracle=oracle,code=code,mutants=mutants,bound=bound,**extra))
def skip_random(r):
    a=[r.randint(-8,8) for _ in range(r.randint(2,7))]
    return [sum(a)-v for v in a]
def skip_oracle(p):
    differences=[p[0]-v for v in p]
    bound=3*max(map(abs,p));answers=[]
    for a0 in range(-bound,bound+1):
        a=[a0+v for v in differences]
        if all(sum(a[:i]+a[i+1:])==p[i] for i in range(len(a))):answers.append(a)
    assert len(answers)==1
    return ' '.join(map(str,answers[0]))
add(1,'由排除自身的元素和还原数组','pref[i]等于原数组中除第i项外所有元素之和，还原原数组。本站保证存在整数解，N至少为2；N=1不能唯一确定，故不纳入本协议。','第一行N，第二行N个pref。源无数字范围，本站2≤N≤100000，−10⁹≤pref[i]≤10⁹，保证存在整数解。','每个原元素被计入N−1次，总和T=sum(pref)/(N−1)，逐项答案T−pref[i]。','所有等式相加唯一确定T，逐项作差唯一还原数组；代回原等式可验证。独立小数据对照从p[0]−p[i]=a[i]−a[0]求首项，再逐项直接求排除自身和核验。','时间O(N)，除输入输出外O(1)。',[[2,6,4],[11,9,8],[-3,5]],'样例1：总和6，答案4、0、2。样例2：总和14，答案3、5、6。样例3：两项时pref是对方元素，答案5、−3。',skip_random,[([999990000]*100000,' '.join(['10000']*100000)),([-999990000]*100000,' '.join(['-10000']*100000)),([10**9,-10**9],'-1000000000 1000000000')],arr,skip_oracle,
'''def solve(d):
    n=int(d[0]);p=list(map(int,d[1:]));total=sum(p)//(n-1)
    return ' '.join(str(total-v) for v in p)
''',[('错误除以N','sum(p)//(n-1)','sum(p)//n'),('作差反向','str(total-v)','str(v-total)')],1200010,output='按原下标输出N个整数。')
def sub_oracle(x):
    a,k=x
    return max(sum(a[i:j]) for i in range(len(a)) for j in range(i+k,len(a)+1))
add(2,'长度至少K的最大连续子数组和','选长度至少K的非空连续子数组，使元素和最大。catalog第二例−5错误，[-2,1]的和−1更大。','第一行N K，第二行N个整数。源无数字范围，本站1≤K≤N≤100000，元素−10⁹..10⁹。','遍历右端点r，用前缀和减去下标≤r−K的最小前缀和。','固定右端点的全部合法左端点恰对应前缀下标0..r−K；减去最小前缀取得该右端点最优，再枚举右端点求全局最优。','时间O(N)，空间O(N)。',[([10,-2,5],2),([-3,-2,1,-6,-30],2),([-8,-2,-7],1)],'样例1：选三项，总13。样例2：选−2、1，总−1，修正源例−5。样例3：选单项−2，空数组不合法。',lambda r:([r.randint(-9,9) for _ in range(n)],r.randint(1,n)) if (n:=r.randint(1,12)) else None,[(([10**9]*100000,1),10**14),(([-10**9]*100000,100000),-10**14),(([-10**9]*100000,1),-10**9)],lambda x:f'{len(x[0])} {x[1]}\n'+' '.join(map(str,x[0]))+'\n',sub_oracle,
'''def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));p=[0]
    for v in a:p.append(p[-1]+v)
    minimum=0;answer=None
    for r in range(k,n+1):
        minimum=min(minimum,p[r-k]);value=p[r]-minimum
        answer=value if answer is None else max(answer,value)
    return str(answer)
''',[('只选恰好K项','minimum=min(minimum,p[r-k])','minimum=p[r-k]'),('允许空数组','answer=None','answer=0')],1200020)
def xor_oracle(p):
    a=[]
    for target in p:
        used=0
        for v in a:used^=v
        a.append(used^target)
    return ' '.join(map(str,a))
add(3,'由前缀异或还原数组','pref[i]是原数组第0项到第i项的异或，返回原数组。','第一行N（1..100000），第二行N个pref[i]（0..10⁹）。还原值可能超过10⁹，但小于2³⁰。','首项等于pref[0]，其余为相邻前缀异或。','共同前缀中的元素各异或两次抵消，仅余当前元素，故每项唯一确定。独立oracle重新遍历已还原全部元素求前缀，而非相邻输入公式。','时间O(N)，除输入输出外O(1)。',[[2,2,5,6],[0],[7,0,7]],'样例1：逐项2、0、7、3。样例2：唯一元素0。样例3：原数组7、7、7的前缀异或为7、0、7。',lambda r:[r.randint(0,31) for _ in range(r.randint(1,12))],[([10**9]*100000,'1000000000 '+' '.join(['0']*99999)),([0,10**9]*50000,'0 '+' '.join(['1000000000']*99999)),([536870911,536870912],'536870911 1073741823')],arr,xor_oracle,
'''from itertools import islice
def solve(d):
    previous=0;answer=[]
    for token in islice(d,1,None):
        value=int(token);answer.append(str(previous^value));previous=value
    return ' '.join(answer)
''',[('异或误写加法','previous^value','previous+value'),('固定与首项异或','previous=value','previous=int(d[1])')],1100010,output='输出N个非负整数。')
def split_oracle(a):return sum(sum(a[:i])>sum(a[i:]) for i in range(1,len(a)))
add(4,'左半和大于右半和的切分数','把整个数组切成两个非空连续部分，统计左和严格大于右和的切分位置。','第一行N（2..100000），第二行N个整数（−10000..10000）。','先求总和，枚举前N−1个切分位置，比较前缀和与剩余和。','合法切分与前N−1个下标一一对应，严格比较即题目要求。','时间O(N)，除输入外O(1)。',[[10,-5,6],[0,0,0],[-1,-2,-3]],'样例1：10|−5,6合法，10,−5|6不合法，答案1。样例2：相等不算，答案0。样例3：−1>−5，−3=−3，仅第一处合法，答案1。',lambda r:[r.randint(-9,9) for _ in range(r.randint(2,14))],[([10000]*100000,49999),([-10000]*100000,49999),([0]*100000,0)],arr,split_oracle,
'''def solve(d):
    a=list(map(int,d[1:]));total=sum(a);left=0;answer=0
    for i in range(len(a)-1):
        left+=a[i]
        if left>total-left:answer+=1
    return str(answer)
''',[('错误接受相等','left>total-left','left>=total-left'),('遗漏最后切分','range(len(a)-1)','range(len(a)-2)')],700010)
def palindrome_random(r):
    half=''.join(r.choice('abc') for _ in range(r.randint(0,4)));middle=r.choice('abc') if not half or r.randrange(2) else ''
    return half+middle+half[::-1]
def break_oracle(s):
    candidates=[]
    for i in range(len(s)):
        for c in 'abcdefghijklmnopqrstuvwxyz':
            t=s[:i]+c+s[i+1:]
            if t<s and t!=t[::-1]:candidates.append(t)
    return min(candidates,default='IMPOSSIBLE')
add(5,'改一个字符得到更小的非回文串','给定小写回文串，恰改一个字符，要求结果不是回文、严格小于原串，且在合法结果中字典序最小；无解输出IMPOSSIBLE。','一行小写回文串，长度1..1000。','把前半首个非a字符改为a；找不到就不可能。不能使用末位改b的常见变体，本题明确要求变小。','最早能降低的位置给出字典序最优修改；改为a制造不对称。若前半全a，对称后半也全a，只有可能较大的中心能降低，但改中心仍为回文，故无解。','时间O(N)，输出空间O(N)。',['aaabbaaa','aba','bb'],'样例1：下标3的b改a，得到aaaabaaa。样例2：中心改动仍回文，其他a不能降低，IMPOSSIBLE。样例3：首位改a得ab，优于ba。',palindrome_random,[('z'*1000,'a'+'z'*999),('a'*1000,'IMPOSSIBLE'),('a'*499+'z'+'a'*499,'IMPOSSIBLE')],lambda s:s+'\n',break_oracle,
'''def solve(d):
    s=d[0]
    for i in range(len(s)//2):
        if s[i]!='a':return s[:i]+'a'+s[i+1:]
    return 'IMPOSSIBLE'
''',[('允许结果变大',"return 'IMPOSSIBLE'","return s[:-1]+'b'"),('错误改变中间字符','range(len(s)//2)','range((len(s)+1)//2)')],1001,output='输出合法字符串或大写IMPOSSIBLE。')
def palset_random(r):
    n=r.randint(1,4);lengths=[1]*n
    for _ in range(r.randint(0,8-n)):lengths[r.randrange(n)]+=1
    return [''.join(r.choice('abc') for _ in range(k)) for k in lengths]
def palset_oracle(a):
    best=0;lengths=list(map(len,a))
    for t in set(permutations(''.join(a))):
        start=0;count=0
        for size in lengths:
            part=t[start:start+size];count+=part==part[::-1];start+=size
        best=max(best,count)
    return best
add(6,'任意交换后最多回文字符串数','可任意多次交换任意两个字符，包括同一串内部交换。各字符串长度不变，最大化最终回文字符串数量。','第一行N，接下来N行非空小写字符串。原始来源无数字范围，本站1≤N≤100000，总字符数≤1000000。','统计全部字符可提供的相同字符对数，按每串floor(长度/2)的需求升序消耗预算。','交换能实现字符池任意排列。每个回文需floor(长度/2)对相同字符，奇数串中心用任意剩余字符。选定对后，剩余字符数一定足以填满所有中心和未选择字符串，必要时拆剩余字符对即可。因此只有对数预算约束。每串收益相同，优先最小需求的交换论证保证最大数量。','时间O(总字符数+N log N)，额外空间O(N+26)。',[['ab','cd'],['ab','ba'],['abc','a']],'样例1：四字符全不同，无相同对，答案0。样例2：重排为aa、bb，答案2。样例3：重排为aba、c，答案2。',palset_random,[(['abcdefghij']*100000,100000),(['a']*99999+['a'*900001],100000),(['abcdefghijklmnopqrstuvwxyz'],0)],lambda a:str(len(a))+'\n'+'\n'.join(a)+'\n',palset_oracle,
'''from collections import Counter
def solve(d):
    words=d[1:];counts=Counter()
    for s in words:counts.update(s)
    pairs=sum(v//2 for v in counts.values());answer=0
    for needed in sorted(len(s)//2 for s in words):
        if needed>pairs:break
        pairs-=needed;answer+=1
    return str(answer)
''',[('先满足最长串','sorted(len(s)//2 for s in words)','sorted((len(s)//2 for s in words),reverse=True)'),('中心也占用字符对','len(s)//2 for s in words','(len(s)+1)//2 for s in words')],1100010)
def dictionary_encode(x):
    document=json.dumps(x[0],ensure_ascii=False,separators=(',',':'));suffix='\n'+x[1]+'\n'
    if len(x)>2:document+=' '*(x[2]-len((document+suffix).encode()))
    return document+suffix
def dictionary_oracle(x):
    obj,path=x[:2];flat={}
    def visit(node,parts):
        if parts:flat['.'.join(parts)]=node
        if isinstance(node,dict):
            for k,v in node.items():visit(v,parts+[k])
    visit(obj,[])
    return json.dumps(flat.get(path),ensure_ascii=False,separators=(',',':'))
def dictionary_random(r):
    scalars=[None,True,False,0,1,-7,'','hello','中文 🌱','two words','a\nb',[1,False,{'x':'value'}]]
    def make(depth):
        return {r.choice('abc')+str(i):(make(depth+1) if depth<3 and r.randrange(3)==0 else r.choice(scalars)) for i in range(r.randint(1,4))}
    obj=make(0);paths=[]
    def collect(v,path):
        if path:paths.append('.'.join(path))
        if isinstance(v,dict):
            for k,w in v.items():collect(w,path+[k])
    collect(obj,[])
    return obj,r.choice(paths)+('.missing' if r.randrange(3)==0 else '')
def json_equal(actual,expected):
    def unique(pairs):
        obj={}
        for k,v in pairs:
            if k in obj:raise ValueError('duplicate')
            obj[k]=v
        return obj
    def typed(v):
        if isinstance(v,dict):return ('object',sorted((k,typed(w)) for k,w in v.items()))
        if isinstance(v,list):return ('array',[typed(w) for w in v])
        return ('number' if type(v) in (int,float) else type(v).__name__,v)
    try:return typed(json.loads(actual,object_pairs_hook=unique))==typed(json.loads(expected,object_pairs_hook=unique))
    except (ValueError,TypeError):return False
deep_value={'leaf':42}
for _ in range(29):deep_value={'a':deep_value}
wide_value={f'k{i}':'界'*1000 for i in range(499)}
add(7,'按点分路径读取嵌套字典','输入JSON字典及点分路径，依次按键访问。键不存在或途中遇到非对象（包括数组）则返回null。可以返回整个子对象或数组；不提供数组下标访问。源平台不支持字典，本站将伪数组示例转换成真正JSON对象。','第一行一个JSON object，第二行非空path，可有末尾换行。键匹配[a-z][a-z0-9_]{0,31}；全树字典键1..500、总节点≤5000、容器深度≤30（根为第1层）。值可为object、array、长度≤1000 Unicode标量的string、数值为整数且在−10⁹..10⁹的JSON number、boolean或null。数组长度≤5000；不允许重复键、孤立代理字符。path由1..31个合法键以点连接。输入UTF-8总大小≤4MiB。除来源的500限制外，以上为本站序列化与范围协议。','从根开始逐段查找字典键；失败立即返回null，成功序列化当前值。','处理前i段后当前值恰为该前缀路径所指值。若无法在对象中访问下一键，完整路径不存在；否则不变式继续成立。最后一段后返回值而非其真假性。独立oracle枚举所有可通过字典键到达的路径及值，再查询路径表。','解析与输出时间O(B)，查询O(路径字符数)期望，空间O(B)，B是输入输出字节数。',[({'car':{'wheels':2,'gears':5}},'car.gears'),({'a':{'z':False,'b':['two words',{'q':1}]}},'a'),({'a':[{'b':3}]},'a.b')],'样例1：car再gears得到整数5。样例2：返回整个a子对象，键顺序不限，保留数组和false。样例3：a是数组，不提供数组索引或键访问，返回null。',dictionary_random,[(({'root':wide_value},'root'),json.dumps(wide_value,ensure_ascii=False)),((deep_value,'.'.join(['a']*29+['leaf'])),'42'),(({'a':{'b':True}},'a.b'),'true'),(({'a':{'b':1}},'a.b'),'1'),(({'a':[False,0,{'z':None}]},'a'),'[false,0,{"z":null}]'),(({'a':[0]*4998},'a'),json.dumps([0]*4998))],dictionary_encode,dictionary_oracle,
r'''import json
def solve(raw):
    document,path=raw.split('\n',1);path=path.rstrip('\r\n');value=json.loads(document)
    for key in path.split('.'):
        if not isinstance(value,dict) or key not in value:
            value=None;break
        value=value[key]
    return json.dumps(value,ensure_ascii=False,separators=(',',':'))
''',[('遗漏最后路径段',"path.split('.'):", "path.split('.')[:-1]:"),('false和零误判缺失',"return json.dumps(value,","return json.dumps(value if value else None,")],4194304,checker='oa-dictionary-path',raw=True,output='输出恰好一个JSON值，接受对象任意键顺序及JSON空白，数字按数值比较，布尔不与数字混同。禁止重复键和尾随内容。',time=6)
BLOCKED={8:'immutable raw正文也停在take the two，只有最高分选择约束，未定义一般转移。不能仅凭两例猜减法淘汰。raw blob 22c56f6b32f74d3f361d80f6d1a8825d8edd2f56。'}
SPECS[5]['edges'].append((['abcd','aa','bb'],2))
SPECS[6]['edges'].append((({'a':None},'a',4194304),'null'))
SPECS[6]['edges'].append((({'a':'line\u2028paragraph\u2029'},'a'),json.dumps('line\u2028paragraph\u2029',ensure_ascii=False)))
SPECS[6]['edges'].append(((deep_value,'.'.join(['a']*29+['leaf','missing'])),'null'))
SPECS[6]['edges'].append((({'a':{'a'+'0'*31:-10**9,'z':10**9}},'a'),json.dumps({'a'+'0'*31:-10**9,'z':10**9})))
SPECS[6]['edges'].append((({'a':['🌱'*1000]*1000},'a'),json.dumps(['🌱'*1000]*1000,ensure_ascii=False)))
SPECS[6]['output_limit']=16384
NOTES={1:'raw没有对应文件，仅使用catalog正文。本站N≥2及整数可还原保证消除未规定退化输入。',2:'raw没有对应文件，仅使用catalog正文，第二例正确答案−1。',3:'raw没有对应文件，保留catalog完整范围，还原值可达1073741823。',4:'raw没有对应文件，保留catalog完整范围。',5:'raw cbbdd5fc4429c2fdcea412e58528925143486cee 明确要求严格变小，前半全a必须IMPOSSIBLE。',6:'raw 066344b4546a15f503d299fb5015ac9ca2bee9d1 定义任意字符交换，无数字范围；使用独立字符对预算算法，拒绝来源错误奇频公式。',7:'raw 3bfc94b268559ff74ec046a019fb35a1f080aee3 说明源平台不支持字典。本站JSON协议与固定语义checker接受等价对象键序及数组值。'}
def execute_many(path,inputs):
    p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/oa-judge/local_batch_runner.py'),str(path)],input=json.dumps(inputs),text=True,capture_output=True,timeout=300)
    assert p.returncode==0,(str(path),p.stderr[-2000:])
    outputs=json.loads(p.stdout);assert len(outputs)==len(inputs);return outputs
def matches(spec,actual,expected):return json_equal(actual,expected) if spec.get('raw') else actual.split()==expected.split()
def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','batches','validation','reviews','positive-controls'):(OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    selected=set(map(int,sys.argv[1:]));entries=[];reports=[]
    if selected and (OUT/'batches'/f'{BATCH}.json').exists():
        entries=[x for x in json.loads((OUT/'batches'/f'{BATCH}.json').read_text())['items'] if int(x['id'].split('-')[-1]) not in selected]
        reports=[x for x in json.loads((OUT/'validation'/f'{BATCH}.json').read_text())['problems'] if int(x['id'].split('-')[-1]) not in selected]
    for spec in SPECS:
        if selected and spec['n'] not in selected:continue
        identifier=f"oa-nvidia-{spec['n']}";rng=random.Random(20261600+spec['n']);reader='sys.stdin.read()' if spec.get('raw') else 'sys.stdin.read().split()'
        code=spec['code']+f'\nif __name__ == "__main__":\n    import sys\n    print(solve({reader}))\n'
        path=OUT/'references'/f'{identifier}.py';path.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)]
        oracles=[dict(input=spec['encode'](v),expectedOutput=str(spec['oracle'](v))+'\n') for v in values]
        formal=list(zip(values[:3],[c['expectedOutput'] for c in oracles[:3]]))+[(v,str(a)+'\n') for v,a in spec['edges']]+list(zip(values[3:31],[c['expectedOutput'] for c in oracles[3:31]]))
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',input=spec['encode'](v),expectedOutput=a,hidden=i>=3,weight=1) for i,(v,a) in enumerate(formal)]
        for c in cases+oracles:assert len(c['input'].encode())<=spec['bound'],(identifier,'input budget')
        for c,a in zip(oracles+cases,execute_many(path,[c['input'] for c in oracles+cases])):assert matches(spec,a,c['expectedOutput']),(identifier,c['input'][:200],a[:200],c['expectedOutput'][:200])
        controls=[];mutants=[]
        for index,(label,old,new) in enumerate(spec['mutants'],1):
            assert old in code;changed=code.replace(old,new);negative=OUT/'negative-controls'/f'{identifier}-{index}.py';negative.write_text(changed)
            outputs=execute_many(negative,[c['input'] for c in cases]);rejected=[i for i,(c,a) in enumerate(zip(cases,outputs)) if not matches(spec,a,c['expectedOutput'])]
            assert rejected,(identifier,label,'survived');controls.append(dict(name=label,rejectedByCases=rejected));mutants.append(dict(name=label,code=changed))
        if spec['n']==7:
            positive_code=code.replace("return json.dumps(value,ensure_ascii=False,separators=(',',':'))","return json.dumps(value,ensure_ascii=True,sort_keys=True,indent=2)")
            positive=OUT/'positive-controls'/f'{identifier}.py';positive.write_text(positive_code)
            for c,a in zip(oracles+cases,execute_many(positive,[c['input'] for c in oracles+cases])):assert matches(spec,a,c['expectedOutput'])
        problem=dict(id=identifier,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Nvidia'],description=spec['desc']+'\n\n本站标准输入输出协议；缺少的数字范围已明确标注。',input=spec['limits'],output=spec.get('output','输出一个整数答案。'),explanation=spec['explain'],hints=[spec['idea']],timeLimit=spec.get('time',4),memoryLimit=262144,outputLimit=spec.get('output_limit',4096),checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        p=subprocess.run(['node','--max-old-space-size=256','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True)
        assert p.returncode==0,(identifier,p.stderr[:1500]);normalized=p.stdout;assert len(normalized.encode())<=128*1024*1024 and '\ufffd' not in normalized
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['cost']}";solutions=[dict(language='python',code=code)]
        for folder,doc in {'packages':json.loads(normalized),'oracles':oracles,'mutants':mutants,'editorials':dict(schemaVersion=1,id=identifier,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=sources[identifier]['sourceUrl'],sourceContentHash=sources[identifier]['contentHash'],author='CSWork')}.items():(OUT/folder/f'{identifier}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        entries.append(dict(id=identifier,sourceContentHash=sources[identifier]['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        reports.append(dict(id=identifier,oracleCases=len(oracles),publicCases=3,hiddenCases=len(cases)-3,negativeControls=controls,referenceSha256=hashlib.sha256(code.encode()).hexdigest(),maxLegalInputBytesUpperBound=spec['bound'],maxTestInputBytes=max(len(c['input'].encode()) for c in cases)))
        print(identifier,'163 independent checks;',len(cases)-3,'hidden; two normal-exit mutants rejected',flush=True)
    entries.sort(key=lambda x:int(x['id'].split('-')[-1]));reports.sort(key=lambda x:int(x['id'].split('-')[-1]))
    for folder,doc in {'batches':dict(schemaVersion=1,items=entries),'validation':dict(schemaVersion=1,seed=20261600,problems=reports,skipped={f'oa-nvidia-{i}':v for i,v in BLOCKED.items()},note='Local runpy batched processes, fresh __main__/streams per case; not per-case OS isolation. Real sandbox required. Independent oracles and normal-exit mutants. Canonical decimal input-size bounds; Nvidia7 explicit 4MiB cap.'),'reviews':dict(schemaVersion=1,items=[dict(id=f'oa-nvidia-{i}',status='blocked' if i in BLOCKED else 'authored',reason=BLOCKED.get(i,NOTES.get(i,''))) for i in range(1,9)])}.items():(OUT/folder/f'{BATCH}.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
