#!/usr/bin/env python3
"""Full-domain exact good-subsequence counts, without an invented modulus."""
from collections import Counter
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

if hasattr(sys, 'set_int_max_str_digits'):
    sys.set_int_max_str_digits(0)
ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-flexport-1'
BATCH = 'flexport-1-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
HASH = '18c37051f94d2ab06dd8e28d5d1ee2d8854bb1c570e37d9447d95d54ab9ee0c2'
SOURCES = [
    ('fastprep/Flexport/flexport-count-good-subsequences.md', '4e9de6fc729e828b45be54931f499905c092ba97', 'd02ba347dc48cd52e9658a7a9b3ee14a2992c8251169c22372c8db3a382f349c'),
    ('web/content/docs/companies/flexport.mdx', '71ef7fe7b879adca275af31baf51e090fd70be0c', '73b4c8118bf670dcb261e095ff832d71161cf6d6677450568696c9dd955c5a07'),
]
SEED = 20261015
REFERENCE = '''import sys

if hasattr(sys, 'set_int_max_str_digits'):
    sys.set_int_max_str_digits(0)

def solve(raw):
    data = list(map(int, raw.split()))
    n = data[0]
    frequency = [0] * 100001
    for value in data[1:]:
        frequency[value] += 1
    ending = answer = 0
    for count in frequency[1:]:
        ending = count * (ending + 1)
        answer += ending
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS = [
    {'name': '擅自按1000000007取模', 'code': REFERENCE.replace('return str(answer)', 'return str(answer % 1000000007)')},
    {'name': '按不同值而非下标去重', 'code': REFERENCE.replace('frequency[value] += 1', 'frequency[value] = 1')},
]
EDITORIAL = '''## 固定来源与精确整数约定

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Flexport/flexport-count-good-subsequences.md完整规定：1≤n≤100000，1≤arr[i]≤100000；好子序列中的值互异，而且最小值到最大值之间的每个整数都出现。按所选下标区分，不同下标即使得到相同值序列也分别计数。子序列保持原下标顺序，但值不必升序。好序列需要最小值和最大值，因此不计空序列。

raw返回描述和starter写long，但完整范围不能保证64位：1到64每个值出现两次，仅128个元素的答案就是73786976294838206332。同固定MDX的三语言代码另加模1000000007，正文及raw均未规定这个模数。本站保留完整数学计数规则，明确输出精确十进制整数，不取模、不截断、不为适配long缩小输入域。这是对过窄接口及整理代码的显式纠正，不声称原平台保证任意精度。未执行上游代码。

原始快照没有正式输入输出样例。三个公开样例均标为本站推导：数组[2,2,1]的三个单元素下标方案，加两个包含1和2的方案，共5；[1,3]只能选单个元素，共2；[3,1,2]的三个单元素、值区间[1,2]、[2,3]各一种和全部三元素，共6。本站标准输入为n及n个数，输出精确整数。

## 思路

令f[v]为值v的出现次数。一个好子序列的值集合必定是某个整数区间[l,r]，并且每个值恰选一个下标。对固定区间，各值的下标选择独立，因此共有f[l]*...*f[r]种。选中的下标排序后自动给出唯一保持原顺序的子序列，无须要求所选值升序。

令end[v]为所有以v为最大值的好子序列数。单元素值集合{v}有f[v]种；其他集合都由最大值v−1的好子序列增加一个值v的下标获得，因此end[v]=f[v]*(1+end[v−1])。按值从小到大扫描，累加end。缺失值f[v]=0会使end归零，自然切断不连续的区间。

## 正确性证明

每个好子序列具有唯一的最小值l与最大值r。值互异与区间覆盖共同保证它从[l,r]每个值恰取一个下标。反过来，任意这样的下标选择按下标排序都形成好子序列，而且不同选择至少有一个下标不同。因此固定区间的乘积计数不重不漏。

最大值为v的合法集合分成单值{v}和长度至少2的区间。前者贡献f[v]；后者删去唯一的v后，得到最大值v−1的合法下标集合。向这个集合添加任意一个值v的下标并按下标顺序排列，正好逆转删除过程，一一对应。故递推式正确。不同最大值的集合互斥，累加所有end得到全部非空好子序列，参考程序因此输出精确答案。

## 复杂度与大整数

令V=100000。频次统计O(n)，扫描执行O(V)次整数加法与乘以至多n的小整数；不能把大整数算术无条件视为常数时间。答案最多为所有非空索引子集数2^n−1，因此每个累加值至多n位二进制，至多30103位十进制。按位运算计，保守上界为O(n+V*n*log(n+1))，空间O(n+V)个输入/频次数值加O(n)位大整数；实际乘数在本域只占一个机器字，远小于通用大整数乘法。十进制转换另计，多精度库可能采用超线性算法，但完整域输出仅约30KB。

Python使用任意精度整数，并通过sys.set_int_max_str_digits(0)解除较新版本默认4300位十进制转换限制；这是必须处理的合法数据，不是异常输入。Java可使用BigInteger，Go可使用math/big，C++可使用boost::multiprecision::cpp_int，均不能用浮点数替代计数。

## 独立验证

163个唯一小输入直接枚举全部非空索引子集，逐个检查值互异及max−min+1等于子集长度，不使用频次递推。中规模采用显式枚举所有值区间并逐项相乘的独立oracle。完整规模覆盖全部同值、全部互异、反序、带缺口、每值重复2/3/4次、乱序以及非均匀频次。

连续r个值各出现q次时，按区间长度L分组，答案为Σ(r−L+1)*q^L。q=1时是r(r+1)/2；q>1时闭式为(q^(r+2)−(r+1)*q^2+r*q)/(q−1)^2。33333个连续值各出现3次，再添下一个值一次，答案为该闭式加1+3*(3^33333−1)/2，共15905位。正式期望以十进制字符串保存，避免JSON数值舍入。两个负控分别擅加模数与错误按值去重，均在全部正式输入正常退出后才记有效击杀。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(a):
    return str(len(a)) + '\n' + ' '.join(map(str, a)) + '\n'


def subset_oracle(a):
    answer = 0
    for mask in range(1, 1 << len(a)):
        chosen = [a[i] for i in range(len(a)) if mask >> i & 1]
        answer += len(set(chosen)) == len(chosen) and max(chosen)-min(chosen)+1 == len(chosen)
    return answer


def interval_oracle(a):
    frequency = Counter(a)
    answer = 0
    for low in frequency:
        value, term = low, 1
        while value in frequency:
            term *= frequency[value]
            answer += term
            value += 1
    return answer


def uniform(r, q):
    return r*(r+1)//2 if q == 1 else (q**(r+2)-(r+1)*q*q+r*q)//((q-1)**2)


def run(path, raw):
    start = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw, text=True, capture_output=True, check=True, timeout=15)
    assert not result.stderr
    assert len(result.stdout.split()) == 1
    return result.stdout.strip(), time.perf_counter()-start


def main():
    start = time.perf_counter()
    source = next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    for path, blob, digest in SOURCES:
        raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{path}'], cwd=ROOT)
        assert sha(raw) == digest
        assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == blob
    old = next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id'] == PID)
    rng = random.Random(SEED)
    small = [[2, 2, 1], [1, 3], [3, 1, 2], [1], [100000], [100000, 99999], [1, 1, 1], [1, 2, 2, 3], [1, 2, 4, 5]]
    keys = {encode(a) for a in small}
    while len(small) < 163:
        a = [rng.randint(1, 9) for _ in range(rng.randint(1, 10))]
        raw = encode(a)
        if raw not in keys:
            keys.add(raw)
            small.append(a)
    refpath = OA/f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for a in small:
        expected = subset_oracle(a)
        assert expected == interval_oracle(a)
        raw = encode(a)
        assert run(refpath, raw)[0] == str(expected)
        oracles.append({'input': raw, 'expectedOutput': str(expected)+'\n'})
    print(f'{PID}: 163 independent index-subset subprocess checks passed', flush=True)
    cases = [{'name': f'本站推导样例{i+1}' if i < 3 else f'独立索引子集{i-2}', **case, 'hidden': i >= 3, 'weight': 1} for i, case in enumerate(oracles[:34])]
    additions = []
    for r in [31, 64]:
        a = [v for v in range(1, r+1) for _ in range(2)]
        expected = uniform(r, 2)
        assert interval_oracle(a) == expected
        additions.append((f'每值两次长度{2*r}溢出边界', a, expected, 'uniform closed form, cross-checked interval products'))
    mixed = [v for v in range(1, 61) for _ in range(rng.randint(1, 20))]
    rng.shuffle(mixed)
    additions.append(('中规模非均匀随机区间', mixed, interval_oracle(mixed), 'explicit interval product enumeration'))
    additions += [
        ('十万全同最大值', [100000]*100000, 100000, 'only singleton index subsets'),
        ('十万全互异升序', list(range(1, 100001)), 5000050000, '100000*100001/2'),
        ('十万全互异反序', list(range(100000, 0, -1)), 5000050000, 'same intervals independent of input order'),
        ('十万缺口各值两次', [v for v in range(1, 100000, 2) for _ in range(2)], 100000, 'no consecutive distinct values, only singletons'),
        ('十万两值均分', [100000, 99999]*50000, 2500100000, '50000+50000+50000*50000'),
        ('十万连续每值两次', [v for v in range(1, 50001) for _ in range(2)], uniform(50000, 2), 'uniform interval-length closed form'),
        ('十万连续每值四次', [v for v in range(1, 25001) for _ in range(4)], uniform(25000, 4), 'uniform interval-length closed form'),
    ]
    thirds = [v for v in range(1, 33334) for _ in range(3)] + [33334]
    thirds_answer = uniform(33333, 3) + 1 + 3*(3**33333-1)//2
    assert len(str(thirds_answer)) == 15905
    additions.append(('十万15905位三重频次', thirds, thirds_answer, 'uniform closed form plus all intervals ending at final singleton'))
    shuffled = thirds.copy()
    rng.shuffle(shuffled)
    additions.append(('十万15905位固定乱序', shuffled, thirds_answer, 'permutation-invariant index choices; same closed form'))
    uneven = [1]*50000 + [2]*25000 + [3]*12500 + [4]*6250 + [5]*6250
    rng.shuffle(uneven)
    additions.append(('十万非均匀完整频次', uneven, interval_oracle(uneven), 'explicit products of all 15 value intervals'))
    evidence = []
    for name, a, expected, method in additions:
        raw = encode(a)
        actual, elapsed = run(refpath, raw)
        assert actual == str(expected), name
        cases.append({'name': name, 'input': raw, 'expectedOutput': str(expected)+'\n', 'hidden': True, 'weight': 1})
        evidence.append({'name': name, 'n': len(a), 'minValue': min(a), 'maxValue': max(a), 'inputBytes': len(raw.encode()), 'expectedDigits': len(str(expected)), 'expectedSha256': sha(str(expected)), 'oracle': method, 'localSeconds': round(elapsed, 4)})
    assert len(cases) <= 64 and len({c['input'] for c in cases}) == len(cases)
    for case in cases:
        assert run(refpath, case['input'])[0] == case['expectedOutput'].strip()
    killed = []
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA/f'negative-controls/{PID}-{i}.py'
        path.write_text(mutant['code'])
        rejected = [j for j, case in enumerate(cases) if run(path, case['input'])[0] != case['expectedOutput'].strip()]
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '互异连续值好子序列的精确数量', 'difficulty': '中等', 'tags': ['OA', 'Flexport', '计数', '大整数'],
        'description': '给定整数数组arr。非空子序列是从数组选择一些严格递增下标得到的序列，不要求值升序。若子序列所有值互异，且其最小值a到最大值b之间的每个整数均出现，则称它为好子序列。求好子序列的数量。不同下标选择分别计数，即使值序列相同。输出数学精确整数，不取模。原始接口写long但完整范围可超64位；整理页代码另加的模数没有正文依据，本站明确纠正这两点并保留全部原始范围。',
        'input': '第一行整数n，第二行n个整数arr[i]。1≤n≤100000，1≤arr[i]≤100000，允许重复值及任意原顺序。',
        'output': '输出精确十进制非负整数，不取模、不截断、不使用科学计数法。结果可能超过64位以及Python默认4300位十进制转换限制；请使用任意精度整数。答案至多30103位十进制。',
        'explanation': '原始题面没有正式I/O样例，三个公开样例均为本站按定义推导。[2,2,1]有3个单元素子序列及2个值集合为{1,2}的子序列，共5。[1,3]只能取单个元素，共2。[3,1,2]有3个单元素、2个相邻值区间和1个完整区间，共6；原值顺序不影响区间覆盖合法性。',
        'hints': ['固定值区间后，每个值选择一个下标有多少种方式？', '统计以当前值为最大值的好子序列。', '缺失值应切断连续区间，重复值对应不同下标选择。'],
        'timeLimit': 5, 'memoryLimit': 262144, 'outputLimit': 128, 'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID+'.json', json.loads(normalized))
    put('oracles', PID+'.json', oracles)
    put('mutants', PID+'.json', MUTANTS)
    put('editorials', PID+'.json', {'schemaVersion': 1, 'id': PID, 'title': '频次乘积与连续值区间递推', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH+'.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH+'.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': SOURCES[0][0], 'gitBlobSha': SOURCES[0][1], 'rawSha256': SOURCES[0][2], 'sources': [{'path': p, 'gitBlobSha': b, 'sha256': h, 'role': 'complete rules and numeric bounds; no modulus' if i == 0 else 'same statement but code invents modulus; explicitly not adopted'} for i, (p, b, h) in enumerate(SOURCES)], 'upstreamCodeExecuted': False, 'recoveredConstraints': ['1 <= n <= 100000', '1 <= arr[i] <= 100000', 'distinct indices define different subsequences', 'nonempty selected values unique and consecutive'], 'siteAdded': '标准n+数组输入，精确十进制整数输出；没有原始正式I/O样例，公开3例为本站推导。', 'correction': 'Raw long return overflows on legal inputs; MDX code adds an unspecified modulus. Preserve exact mathematical counting, disclose interface correction, do not shrink the domain.', 'overflowWitness': {'n': 128, 'arrayDescription': 'each value1..64 repeated twice', 'answer': '73786976294838206332'}, 'maximumDecimalDigitsUpperBound': 30103}}})
    put('resolutions', BATCH+'.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '完整raw规则及十万范围明确，旧long溢出事实通过显式精确整数协议纠正，不沿用MDX无根据取模。163独立索引子集oracle及完整规模闭式边界通过。仅候选待沙箱。'}]})
    put('validation', BATCH+'.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 3, 'hiddenCases': len(cases)-3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Enumerate every nonempty index subset; check uniqueness and max-min+1==size. Separately explicit interval product enumeration.', 'largeBoundaryOracle': 'Weighted geometric closed forms for uniform frequency runs, singleton extension identity, and explicit interval products for mixed frequencies; never use reference ending-count recurrence.', 'largeBoundaries': evidence, 'maximumExpectedDigits': max(len(c['expectedOutput'].strip()) for c in cases), 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter()-start, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 163 oracles, 2 normal-exit mutants; candidate frozen', flush=True)


if __name__ == '__main__':
    main()
