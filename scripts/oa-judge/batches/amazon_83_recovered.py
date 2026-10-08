#!/usr/bin/env python3
"""Author Amazon83 native candidate only; no registry/report/publication writes.

Local subprocess checks compile only the independently authored C++ below.
Formal publication still requires the native GoJudge verifier on this candidate.
"""
from pathlib import Path
from functools import lru_cache
import hashlib
import json
import os
import random
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'
PID = 'oa-amazon-83'
BATCH = 'amazon-83-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
HASH = '689da7d874c96421c7a3b1a57af64729146a314269129f8876afd37556310523'
SOURCES = [
    ('web/content/docs/companies/amazon.mdx', '70650fad830ad60944ae8036fb4f134d9afc3fab', '07d33d58794347890f76b4199a9805d5fac529f0702dea6884e6fce484b69985'),
    ('fastprep/Amazon/amazon-minimize-effort.md', 'c35d99d35233c9b95c88af7f23c39474907fc0ec', '3082fbe70afc2eb1da6a8fd8b1163e1d8205e253ea848c853bb18ef36edf2a90'),
]
SEED = 20261008

REFERENCE = r'''#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <iostream>
#include <utility>
#include <vector>
using namespace std;
struct Node { uint32_t value, count; };

uint64_t minimumCost(vector<uint32_t> values) {
    if (*min_element(values.begin(), values.end()) == 1) return values.size();
    sort(values.begin(), values.end());
    vector<Node> nodes;
    nodes.reserve(values.size());
    uint64_t answer = 0;
    for (uint32_t value : values) {
        answer += value;
        if (!nodes.empty() && nodes.back().value == value) ++nodes.back().count;
        else nodes.push_back({value, 1});
    }
    uint32_t maximum = values.back();
    vector<uint32_t>().swap(values);
    vector<uint64_t> alive((size_t(maximum) + 64) / 64, 0);
    for (auto node : nodes) alive[node.value >> 6] |= uint64_t(1) << (node.value & 63);
    for (auto node : nodes) {
        uint32_t d = node.value;
        uint64_t mask = uint64_t(1) << (d & 63);
        if (!(alive[d >> 6] & mask)) continue;
        alive[d >> 6] &= ~mask;
        for (uint32_t multiple = d + d; multiple <= maximum; multiple += d) {
            uint64_t bit = uint64_t(1) << (multiple & 63);
            auto& word = alive[multiple >> 6];
            if (!(word & bit)) continue;
            word &= ~bit;
            auto found = lower_bound(nodes.begin(), nodes.end(), multiple,
                [](const Node& item, uint32_t value) { return item.value < value; });
            answer += uint64_t(d) * found->count;
            answer -= uint64_t(multiple) * found->count;
        }
    }
    return answer;
}

uint32_t readNumber() {
    int c = getchar_unlocked();
    while (c != EOF && c <= 32) c = getchar_unlocked();
    uint32_t value = 0;
    while (c != EOF && c > 32) { value = value * 10 + (c - '0'); c = getchar_unlocked(); }
    return value;
}
int main() {
    uint32_t n = readNumber();
    vector<uint32_t> values(n);
    for (auto& value : values) value = readNumber();
    cout << minimumCost(std::move(values)) << '\n';
}
'''

# Full-size fixtures are generated sequentially by this independently authored
# builder. Its expected answers use primes, prime-factor counts, or closed forms,
# not the reference's present-divisor bitmap algorithm.
BUILDER = r'''#include <algorithm>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;
vector<uint8_t> primes(uint32_t limit) {
    vector<uint8_t> p(limit+1,1); p[0]=p[1]=0;
    for(uint32_t d=2;uint64_t(d)*d<=limit;++d) if(p[d])
        for(uint32_t m=d*d;m<=limit;m+=d) p[m]=0;
    return p;
}
int main(int argc,char**argv) {
    if(argc!=3) return 2;
    string mode=argv[1]; const uint32_t N=mode=="contains_one"?100000:2000000,V=200000000;
    vector<uint32_t>a; uint64_t expected=0;
    if(mode=="primes") {
        auto p=primes(33000000);
        for(uint32_t x=2;a.size()<N-1;++x) if(p.at(x)){a.push_back(x);expected+=x;}
        a.push_back(V); expected+=2;
    } else if(mode=="semiprimes") {
        const uint32_t L=16000000; auto p=primes(L);
        for(uint32_t x=2;uint64_t(x)*x<=L;++x)if(p[x])
            for(uint32_t y=x;y<=L/x;++y)if(p[y])a.push_back(x*y);
        sort(a.begin(),a.end()); if(a.size()<N-1)throw runtime_error("fixture bound");
        a.resize(N-1); expected=accumulate(a.begin(),a.end(),uint64_t(0))+4; a.push_back(V);
    } else if(mode=="consecutive") {
        vector<uint32_t> least(N+1,0);
        for(uint32_t p=2;p<=N;++p)if(!least[p])
            for(uint32_t m=p;m<=N;m+=p)if(!least[m])least[m]=p;
        for(uint32_t x=2;x<=N;++x){a.push_back(x);expected+=least[x];}
        a.push_back(V);expected+=2;
    } else if(mode=="repeated_small_divisor") {
        a.assign(N/2,2);for(uint32_t x=198000002;x<=V;x+=2)a.push_back(x);expected=uint64_t(2)*N;
    } else if(mode=="high_distinct") {
        for(uint32_t x=V-N+1;x<=V;++x)a.push_back(x);
        expected=uint64_t(N)*(uint64_t(V-N+1)+V)/2;
        // Fixed xorshift Fisher-Yates order, independent of stdlib shuffle.
        uint64_t state=20261008;
        for(size_t i=a.size()-1;i>0;--i){state^=state<<13;state^=state>>7;state^=state<<17;swap(a[i],a[state%(i+1)]);}
    } else if(mode=="contains_one") {
        a.assign(N,V);a[0]=1;expected=N;
    } else if(mode=="all_maximum") {
        a.assign(N,V);expected=uint64_t(N)*V;
    } else return 3;
    if(a.size()!=N || *max_element(a.begin(),a.end())!=V) return 4;
    ofstream out(argv[2]); out<<N<<'\n';
    for(size_t i=0;i<a.size();++i)out<<a[i]<<(i+1==a.size()?'\n':' ');
    out.close(); cout<<expected<<'\n';
}
'''

MUTANTS = [
    {'name': '错误创造不存在的全局gcd', 'language': 'cpp', 'code': r'''#include <iostream>
#include <numeric>
using namespace std;
int main(){long long n,x,g=0;cin>>n;for(long long i=0;i<n;++i){cin>>x;g=gcd(g,x);}cout<<g*n<<'\n';}
'''},
    {'name': '降低重复值时只更新一个副本', 'language': 'cpp',
     'code': REFERENCE.replace('uint64_t(d) * found->count', 'uint64_t(d)').replace('uint64_t(multiple) * found->count', 'uint64_t(multiple)')},
]

EDITORIAL = '''## 来源与样例修正

固定提交e66f809f4c953bce129f68491726176615db6afc的Amazon MDX第83题给出整除替换和完整大范围n≤2000000、cost[i]≤200000000。完整FastPrep原始文件amazon-minimize-effort.md也明确相同操作与最小化总和，但范围较小，为n和值均≤200000。本站保留MDX/catalog的较大范围，不以较小raw范围替换它。

MDX样例[3,6,2,6,25]误标答案17。按其明确操作，两个6均变成2，25没有更小的存在因子，正确结果为3+2+2+2+25=34。完整FastPrep样例是[3,6,2,5,25]，结果17；这两个不同数组均进入公开样例并标明出处。操作只能复制当前已有值，不会创造gcd等新值。允许重复值、一次也不操作；最终求和使用64位整数。

## 思路

每个原值v最终应变成原数组里整除v的最小值。排序并压缩不同值及频次，初始答案为原总和。用一张位图记录尚未找到最小存在因子的不同值；不建立按值域存整数的800MB数组。

按不同值d升序处理。若它已经被较小值覆盖，就跳过；否则d自身保持不变，扫描2d、3d等倍数。遇到位图中仍存在的v，把所有freq[v]个副本贡献从v改为d，并清除此位。频次只在真实命中时通过压缩数组二分，不对每个空倍数做二分。含1时所有元素可直接变成1，立即返回n。

## 正确性证明

每次操作复制已有值，所以任何时刻的数值都来自初始数组。整除关系传递，因此原值v经过任意操作链后仍只能成为v的某个初始存在因子。设其中最小者为d，它给出下界；d不可能有更小的初始存在因子，否则那个值也整除v，违反最小性。保留d并把相应v直接替换为d即可达到所有下界。

升序扫描保证首次覆盖v的存在值就是其最小存在因子。当d已被更小的e覆盖时，e整除d，从而整除d的所有倍数；这些存在倍数此前已被e或更小值覆盖，因此跳过d不会漏解。每个不同值只在首次覆盖时修改答案一次，乘以原频次保留全部副本，故最终总和最优。

## 复杂度与完整范围

设U为不同值个数、V为最大值、P为未被较小存在值覆盖的源值集合。排序O(n log n)，筛的倍数探测总数T=Σ(d∈P)(floor(V/d)−1)，真实命中至多U次，各需O(log U)二分。总时间O(n log n+T+U log U+V/64)，保守上界O(n log n+V log(V+1))。位图用约V/8字节，压缩值频次O(U)，读入及排序O(n)，而不是O(V)个整数。最大答案为2000000×200000000=400000000000000，64位足够。

最大输入约20MB，低于32MiB；正式题设置10秒、256MiB，不依据本地macOS耗时缩减限额。完整Linux GoJudge验证必须在发布前另行完成。不能把小例通过或本地原生性能当成正式沙箱证据。

## 独立验证

163个唯一小输入用记忆化搜索枚举所有实际合法替换，逐步降低数组状态并取最小总和，不使用最小存在因子公式。正式用例还包含六个n=2000000、V=200000000输入：质数反链、半质数反链、低位连续数、重复小因子、固定乱序高位互异数和全最大值；另有100000元素含1的压力测试。所有满规模单测保持完整范围，同时控制题包低于GitHub单文件100MiB和导入128MiB限额。

不同质数间不能替换；不同半质数（含质数平方）均恰有两个计重质因子，互不整除，最大值可降至4。连续2..2000000的每项归为其最小质因子，期望由独立最小质因子筛求和。其他构造按等差求和或直接恒定最优值给出期望。所有满域输入逐个生成和真实执行，不同时积累大数组。两个负控均正常退出，分别覆盖误用全局gcd及丢失重复次数。
'''

def digest(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()

def put(folder, name, value):
    path = OUT / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def encode(values):
    return str(len(values)) + '\n' + ' '.join(map(str, values)) + '\n'

@lru_cache(None)
def operation_oracle(state):
    best = sum(state)
    for i, value in enumerate(state):
        for replacement in state:
            if replacement < value and value % replacement == 0:
                following = list(state)
                following[i] = replacement
                best = min(best, operation_oracle(tuple(sorted(following))))
    return best

def execute(binary, raw=None, path=None):
    start = time.perf_counter()
    if path is None:
        result = subprocess.run([str(binary)], input=raw, text=True, capture_output=True, check=True, timeout=20)
    else:
        with path.open('r') as stream:
            result = subprocess.run([str(binary)], stdin=stream, text=True, capture_output=True, check=True, timeout=20)
    assert not result.stderr, result.stderr
    return result.stdout.strip(), round(time.perf_counter() - start, 4)

def main():
    started = time.perf_counter()
    catalog = next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert catalog['contentHash'] == HASH
    source_evidence = []
    for path, blob, checksum in SOURCES:
        raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{path}'], cwd=ROOT)
        assert digest(raw) == checksum
        assert subprocess.check_output(['git', 'hash-object', '--stdin'], cwd=ROOT, input=raw).decode().strip() == blob
        source_evidence.append({'path': path, 'gitBlobSha': blob, 'rawSha256': checksum})
    previous = next(x for x in json.loads((OUT/'reviews/amazon-remaining-d.json').read_text())['items'] if x['id'] == PID)
    assert previous['status'] == 'blocked'
    compiler = shutil.which('clang++') or shutil.which('g++')
    assert compiler, 'A local C++ compiler is needed for authored-only offline checks'
    for folder in ('references', 'negative-controls', 'packages'):
        (OUT/folder).mkdir(parents=True, exist_ok=True)
    reference_path = OUT/'references'/f'{PID}.cpp'
    reference_path.write_text(REFERENCE)
    for i, mutant in enumerate(MUTANTS, 1):
        (OUT/'negative-controls'/f'{PID}-{i}.cpp').write_text(mutant['code'])
    public = [([3,6,2,6,25],34), ([3,6,2,5,25],17), ([6,10,15],31)]
    specs = [values for values, _ in public] + [
        [1], [2], [200000000], [1,200000000], [200000000,200000000],
        [6,6,2], [12,6,3], [15,10,6,30], [8,4,2], [25,5,5,125],
        [7,11,13], [4,6,9,10,15,25], [64,2,32,8], [100,25,4],
        [10,10,5,5,20], [9,27,81], [199999999,200000000], [200000000,100000000],
    ]
    keys = {encode(a) for a in specs}
    assert len(keys) == len(specs)
    rng = random.Random(SEED)
    while len(specs) < 163:
        values = [rng.randint(1,40) for _ in range(rng.randint(1,6))]
        if encode(values) not in keys:
            keys.add(encode(values)); specs.append(values)
    with tempfile.TemporaryDirectory(prefix='amazon83-candidate-') as temporary:
        tmp = Path(temporary)
        builder_path = tmp/'builder.cpp'; builder_path.write_text(BUILDER)
        programs = [('reference', reference_path), ('builder', builder_path)] + [(f'mutant-{i}', OUT/'negative-controls'/f'{PID}-{i}.cpp') for i in (1,2)]
        for name, source in programs:
            subprocess.run([compiler, '-std=c++20', '-O2', '-pipe', str(source), '-o', str(tmp/name)], check=True, capture_output=True, timeout=60)
        oracles = []
        for i, values in enumerate(specs):
            expected = operation_oracle(tuple(sorted(values)))
            if i < 3: assert expected == public[i][1]
            raw = encode(values)
            assert execute(tmp/'reference', raw=raw)[0] == str(expected)
            oracles.append({'input': raw, 'expectedOutput': str(expected)+'\n'})
        assert len(oracles) == len(keys) == 163
        print(f'{PID}: 163 unique literal-operation oracle subprocess checks passed', flush=True)
        small_cases = [{'name': ['MDX原输入修正答案','完整FastPrep原样例','本站样例：不能创造gcd'][i] if i<3 else f'独立操作枚举{i-2}', **row, 'hidden': i>=3, 'weight': 1} for i,row in enumerate(oracles[:33])]
        kills = []
        for i, mutant in enumerate(MUTANTS, 1):
            rejected = [j for j,c in enumerate(small_cases) if execute(tmp/f'mutant-{i}', raw=c['input'])[0] != c['expectedOutput'].strip()]
            assert rejected
            kills.append({'name': mutant['name'], 'language': 'cpp', 'rejectedByCases': rejected, 'normalExitVerified': True})
        boundaries = []
        for mode in ['primes','semiprimes','consecutive','repeated_small_divisor','high_distinct','contains_one','all_maximum']:
            path = tmp/(mode+'.in')
            expected = subprocess.check_output([str(tmp/'builder'), mode, str(path)], text=True, timeout=60).strip()
            actual, seconds = execute(tmp/'reference', path=path)
            assert actual == expected, (mode,actual,expected)
            assert path.stat().st_size <= 32*1024*1024
            boundaries.append({'name': mode, 'path': path, 'n': 100000 if mode=='contains_one' else 2000000, 'maxValue': 200000000, 'inputBytes': path.stat().st_size, 'expectedOutput': expected+'\n', 'localWallSeconds': seconds})
            print(f'{PID}: full {mode}, {path.stat().st_size} bytes, {seconds}s, expected={expected}', flush=True)
        problem = {'id': PID, 'courseId':'gomall', 'lessonId':'00-overview', 'title':'整除资源替换后的最小总成本', 'difficulty':'困难', 'tags':['OA','Amazon','整除','位图','筛法'],
            'description':'给定正整数数组cost。每次选择两个位置x、y，当当前cost[x]能被当前cost[y]整除时，可令cost[x]=cost[y]。可以做任意次操作，包括零次，求最终元素总和的最小值。数值只能从已有位置复制，不能创造gcd等新数值；重复值按各自位置计入总和。保留固定MDX/catalog完整大范围，未缩至FastPrep同题较小范围。MDX公开输入[3,6,2,6,25]的答案17有误，按明确操作应为34；完整FastPrep输入[3,6,2,5,25]的答案才是17。',
            'input':'第一行n，第二行n个整数cost[i]。1≤n≤2000000，1≤cost[i]≤200000000。标准输入输出为本站整理；保留较大的MDX/catalog范围。',
            'output':'输出最小可能总和，一个64位整数。', 'explanation':'第一例两个6变成2，25无法降低，和为34。第二例6变2、25变5，和为17。第三例6、10、15互不整除，和仍31，不能把它们变成不存在的gcd=1。',
            'hints':['每个原值最终只能变成它的某个初始存在因子。','使用位图表示存在性，不要按两亿值域保存整数答案数组。','重复值贡献必须乘以频次，和使用64位整数。'],
            'timeLimit':10, 'memoryLimit':262144, 'outputLimit':4096, 'checker':'tokens', 'languages':['python','go','java','cpp']}
        # Stream one large input at a time; do not retain seven 20MB strings.
        staging = tmp/'package.json'
        with staging.open('w') as stream:
            stream.write('{"schemaVersion":1,"problem":')
            json.dump(problem,stream,ensure_ascii=False,separators=(',',':'))
            stream.write(',"cases":[')
            for i,case in enumerate(small_cases):
                if i: stream.write(',')
                json.dump(case,stream,ensure_ascii=False,separators=(',',':'))
            for boundary in boundaries:
                stream.write(',')
                case={'name':('完整规模 ' if boundary['n']==2000000 else '压力边界 ')+boundary['name'], 'input':boundary['path'].read_text(), 'expectedOutput':boundary['expectedOutput'], 'hidden':True, 'weight':1}
                json.dump(case,stream,ensure_ascii=False,separators=(',',':'))
                del case
            stream.write(']}\n')
        assert staging.stat().st_size < 100*1024*1024, 'GitHub single-file limit'
        package_path = OUT/'packages'/f'{PID}.json'
        normalize = "const fs=require('fs'),crypto=require('crypto');const {ojImportSchema}=require('./lib/oj-types.ts');const p=ojImportSchema.parse(JSON.parse(fs.readFileSync(process.argv[1],'utf8')));const text=JSON.stringify(p);if(Buffer.byteLength(text)+1>=100*1024*1024)throw Error('package exceeds GitHub budget');fs.writeFileSync(process.argv[2],text+'\\n');console.log(crypto.createHash('sha256').update(text).digest('hex'));"
        checksum = subprocess.check_output(['node','--max-old-space-size=1024','--import','tsx','-e',normalize,str(staging),str(package_path)],cwd=ROOT,text=True,timeout=120).strip()
        solutions=[{'language':'cpp','code':REFERENCE}]
        put('candidate-batches',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':checksum,'editorial':EDITORIAL,'authoredSolutions':solutions}]})
        put('editorials',PID+'.json',{'schemaVersion':1,'id':PID,'title':problem['title'],'explanation':EDITORIAL,'solutions':solutions})
        put('oracles',PID+'.json',oracles)
        put('mutants',PID+'.json',MUTANTS)
        put('source-evidence',BATCH+'.json',{'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':[{ 'id':PID,'sourceContentHash':HASH,'sourceUrl':catalog['sourceUrl'],'rawFiles':source_evidence,'domainDecision':'Preserve MDX/catalog n<=2000000 and value<=200000000; FastPrep same-rule smaller n/value<=200000 is corroboration only, not a replacement domain.','sampleCorrection':{'mdxInput':[3,6,2,6,25],'mdxWrongOutput':17,'correctOutput':34,'fastprepInput':[3,6,2,5,25],'fastprepOutput':17},'upstreamCodeExecuted':False,'siteAdded':'Standard input/output and explicit source-sample correction; algorithm independently authored.'}]})
        put('resolutions',BATCH+'.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':previous['reason'],'reason':'原创C++单个位图筛保留n200万/值2亿大包络；原错误样例修正为34，完整raw的不同输入17亦保留。163独立实际操作oracle、六个完整规模正式用例、含1压力边界和两个正常退出负控本地通过；仅候选，等待真实Linux GoJudge。'}]})
        put('validation',BATCH+'.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':163,'formalCases':len(small_cases)+len(boundaries),'publicCases':3,'hiddenCases':len(small_cases)+len(boundaries)-3,'referenceLanguage':'cpp','referenceSha256':digest(REFERENCE),'negativeControls':kills,'largeBoundaries':[{k:v for k,v in b.items() if k!='path'} for b in boundaries],'packageBytes':package_path.stat().st_size,'oracleMethod':'Memoized enumeration of actual strictly-decreasing legal replacement operations; large structures use independent prime/SPF or closed-form expectations.','localValidationOnly':True,'subprocessValidation':True,'elapsedSeconds':round(time.perf_counter()-started,3)}]})
        print(json.dumps({'candidate':BATCH,'formalCases':40,'oracleCases':163,'packageBytes':package_path.stat().st_size,'checksum':checksum,'registryReportsUntouched':True}),flush=True)

if __name__=='__main__': main()
