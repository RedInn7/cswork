#!/usr/bin/env python3
"""Persistent A updates with transient prefix-minimum B; full-domain candidate."""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-infosys-3'
BATCH = 'infosys-3-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW_PATH = 'fastprep/infosys/infosys-number-of-unique-elements-after-modifications.md'
BLOB = '13312608b30434ce78242c866968c811d42d084a'
RAW_SHA = 'cda8d5affee563168f02562d66c676c43a30e1142a965e5abc009f73e35065f0'
HASH = '4685782bb081609f26cce7fd5cd495021ce251e43fb4e2d2608bd0d37dd93b85'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, m = data[:2]
    a = [0] + data[2:2 + n]
    active = [0] * (n + 1)
    smallest = 10 ** 30
    count = 0
    for i in range(1, n + 1):
        if a[i] < smallest:
            smallest = a[i]
            active[i] = 1
            count += 1
    bit = active.copy()
    for i in range(1, n + 1):
        parent = i + (i & -i)
        if parent <= n:
            bit[parent] += bit[i]
    def add(i, delta):
        while i <= n:
            bit[i] += delta
            i += i & -i
    def prefix(i):
        result = 0
        while i:
            result += bit[i]
            i -= i & -i
        return result
    highest = 1 << (n.bit_length() - 1)
    def kth(k):
        index = 0
        step = highest
        while step:
            nxt = index + step
            if nxt <= n and bit[nxt] < k:
                k -= bit[nxt]
                index = nxt
            step >>= 1
        return index + 1
    answer = []
    offset = 2 + n
    for q in range(m):
        pos, delta = data[offset + 2 * q:offset + 2 * q + 2]
        a[pos] -= delta
        rank = prefix(pos)
        if not active[pos]:
            previous = kth(rank)
            if a[pos] >= a[previous]:
                answer.append(str(count))
                continue
            add(pos, 1)
            active[pos] = 1
            count += 1
            rank += 1
        while rank < count:
            following = kth(rank + 1)
            if a[following] < a[pos]:
                break
            add(following, -1)
            active[following] = 0
            count -= 1
        answer.append(str(count))
    return ' '.join(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '相等的后继错误保留为新纪录', 'code': REFERENCE.replace('if a[following] < a[pos]:', 'if a[following] <= a[pos]:')},
    {'name': '误用前次B值替代原数组A更新', 'code': REFERENCE.replace('a[pos] -= delta', 'a[pos] = a[kth(prefix(pos))] - delta')},
]

EDITORIAL = '''## 固定来源与样例纠正

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/infosys/infosys-number-of-unique-elements-after-modifications.md完整给出n,m≤100000、初始1≤A[i]≤10^9，以及查询字段1≤Q[i][j]≤100000。因此减量x明确为正，不是旧blocked所称未给非负保证。查询位置还必须满足1≤L≤n，这是原操作A[L−1]能够定义的合法下标要求；本站明确披露该隐含条件，不将越界访问设计成额外业务规则。

每次仅永久修改A[L−1]减去x，然后由修改后的A计算独立B：B[0]=A[0]，B[i]=min(B[i−1],A[i])。不能把B覆盖回A。原文未限制修改后非负，本站保留负数结果；最小可至1−100000×100000=−9999999999，应采用64位整数。

原输入[5,7,2,2,4]与查询[(3,5),(5,4)]保留，但原输出[2,3]及解释没有执行第一条查询：按规则第一步A=[5,7,−3,2,4]，B=[5,5,−3,−3,−3]；第二步A=[5,7,−3,2,0]，B仍为[5,5,−3,−3,−3]。正确输出为[2,2]。题包明确纠正而非冒称复现原错误答案。另两个公开样例为本站补充。没有执行上游代码。

## 思路

B单调不增，它的不同值数量等于A的严格前缀最小值位置数：第一个位置总是纪录，后续位置只有严格小于其左侧所有元素才是纪录。按位置排列的纪录值严格递减。

降低A[p]不会改变p左边的纪录。如果p原来不是纪录且新值仍不小于其前驱纪录值，则纪录集合不变；否则插入p（若原已存在则只更新其值）。从p的后继纪录开始，删除所有值大于等于新A[p]的纪录，遇到第一个更小值停止，剩余后继均无需改变。

用树状数组存各位置是否为纪录的0/1标记，前缀和给出纪录排名，按排名二分提升找到前驱和后继位置，支持插入、删除。真实A单独保存，非纪录位置也保留自己原有数值，不能用其前缀最小值代替。

## 正确性证明

纪录与B不同值一一对应：每遇到严格更小的A值，前缀最小值恰好新增一个更小值；否则保持原值。故只需准确维护纪录集合。

一次下降只影响位置p及其右侧。p之前不变；p是否成为纪录，完全由新A[p]与其前驱纪录（即此前前缀最小值）比较决定。若它未成为纪录，所有前缀最小值仍不变。若它成为或保留纪录，后继旧纪录值大于等于A[p]的那些位置不再严格改进最小值，因此必须删除；第一个更小的旧纪录及其后继值严格递减，都仍然是纪录。

原来不是纪录且未被修改的其他位置，不可能因为某个左侧值下降而成为纪录。因此没有任何额外插入位置被遗漏。初始化直接扫描得到准确纪录，以上更新步骤完整、必要且充分；逐次归纳可知所有输出均正确。

## 摊还复杂度与数值

每次查询最多插入被修改位置一次。初始最多n个纪录，总插入最多m次，因此即使一个位置删除后又插入，总删除次数也不超过n+m。每次前驱查询、插入、删除和后继查找O(log n)，每次查询至多一次未触发删除的后继检查。总时间O((n+m)log n)，空间O(n+m)（含输入输出）。不能把内部删除循环误算成每次扫描全部数组。数组实际数值可能降到约−10^10，使用64位；树状数组只保存最多n的计数。

## 独立验证与完整边界

oracle直接复制A，每条查询仅修改指定元素，然后完整扫描重新构造前缀最小值B，并用集合数不同值，不使用纪录集合、树状数组或摊还性质。163个唯一输入经过真实子进程对拍。

满n=m=100000包含严格递减数组逐个删除纪录、尾部不断下降保留全部纪录、首部一次删除全部纪录、同一位置反复降到−10^10附近、首尾交替引起反复插入/删除、逆序位置以相等新值删除旧纪录等。大边界用直接结构规律确定全部十万个期望，非参考程序生成。两个负控分别保留相等后继、按前次B而非真实A减值，要求正常退出后才计为成功拒绝。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(a, queries):
    return f'{len(a)} {len(queries)}\n' + ' '.join(map(str, a)) + '\n' + ''.join(f'{p} {x}\n' for p, x in queries)


def oracle(a, queries):
    a = a.copy()
    answer = []
    for p, x in queries:
        a[p - 1] -= x
        b = []
        for value in a:
            b.append(value if not b else min(b[-1], value))
        answer.append(len(set(b)))
    return answer


def output(values):
    return ' '.join(map(str, values)) + '\n'


def run(path, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw, text=True, capture_output=True, check=True, timeout=20)
    assert not result.stderr
    return result.stdout.split(), time.perf_counter() - started


def main():
    started = time.perf_counter()
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{RAW_PATH}'], cwd=ROOT)
    assert sha(raw) == RAW_SHA
    assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == BLOB
    old = next(x for x in json.loads((OA / 'coverage.json').read_text())['items'] if x['id'] == PID)
    public = [([5, 7, 2, 2, 4], [(3, 5), (5, 4)], [2, 2]),
              ([5, 10], [(2, 1), (2, 5)], [1, 2]),
              ([3, 2, 1], [(1, 1), (1, 1)], [2, 1])]
    specs = [(a, q) for a, q, _ in public]
    specs += [([1], [(1, 100000)] * 3), ([1, 1], [(2, 1), (1, 1), (2, 1), (1, 1)]),
              ([9, 8, 7, 6], [(1, 3)]), ([1, 1000000000], [(2, 100000)]),
              ([4, 4, 4], [(3, 1), (2, 1), (1, 1)]), ([3, 2, 1], [(3, 100000)] * 3)]
    keys = {encode(a, q) for a, q in specs}
    rng = random.Random(SEED)
    while len(specs) < 163:
        n = rng.randint(1, 12)
        a = [rng.randint(1, 30) for _ in range(n)]
        q = [(rng.randint(1, n), rng.randint(1, 40)) for _ in range(rng.randint(1, 20))]
        text = encode(a, q)
        if text not in keys:
            keys.add(text)
            specs.append((a, q))
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for i, (a, q) in enumerate(specs):
        expected = oracle(a, q)
        if i < 3:
            assert expected == public[i][2]
        text = encode(a, q)
        assert run(refpath, text)[0] == output(expected).split(), (a, q, expected)
        oracles.append({'input': text, 'expectedOutput': output(expected)})
    print(f'{PID}: 163 unique full-rescan oracle subprocess checks passed', flush=True)
    cases = [{'name': '原始输入纠正期望' if i == 0 else f'本站补充公开样例{i}' if i < 3 else f'独立逐次全扫描{i-2}', **row, 'hidden': i >= 3, 'weight': 1} for i, row in enumerate(oracles[:35])]
    n = 100000
    descending = list(range(n, 0, -1))
    boundaries = [
        ('满双界逐个相等删除', descending, [(1, 1)] * n, list(range(n - 1, 0, -1)) + [1]),
        ('满双界尾部下降保留全部纪录', descending, [(n, n)] * n, [n] * n),
        ('满双界首部整批删除', descending, [(1, n)] * n, [1] * n),
        ('满双界降到负九十亿', [1000000000] * n, [(1, n)] * n, [1] * n),
        ('满双界首尾反复删插', [1000000000] * n, [(n if i % 2 == 0 else 1, 1) for i in range(n)], [2 if i % 2 == 0 else 1 for i in range(n)]),
        ('满双界逆序插入相等替换', [1000000000] * n, [(i, 1) for i in range(n, 0, -1)], [2] * (n - 1) + [1]),
        ('满双界非纪录原值不可覆盖', list(range(1, n + 1)), [(n, n)] * n, [2] * n),
        ('单元素最大操作次数极负数', [1], [(1, n)] * n, [1] * n),
        ('最大数组单查询末尾相等', descending, [(n - 1, 1)], [n - 1]),
    ]
    evidence = []
    for name, a, q, expected in boundaries:
        text = encode(a, q)
        got, elapsed = run(refpath, text)
        assert got == output(expected).split(), name
        cases.append({'name': name, 'input': text, 'expectedOutput': output(expected), 'hidden': True, 'weight': 1})
        evidence.append({'name': name, 'n': len(a), 'm': len(q), 'inputBytes': len(text.encode()), 'expectedFirst': expected[:3], 'expectedLast': expected[-3:], 'localSeconds': round(elapsed, 4)})
        print(f'{name}: {elapsed:.3f}s', flush=True)
    assert len({c['input'] for c in cases}) == len(cases)
    killed = []
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA / f'negative-controls/{PID}-{i}.py'
        path.write_text(mutant['code'])
        rejected = [j for j, case in enumerate(cases) if run(path, case['input'])[0] != case['expectedOutput'].split()]
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '逐点减值后前缀最小值的不同数量', 'difficulty': '困难', 'tags': ['OA', 'Infosys', '树状数组', '摊还分析'],
        'description': '给定数组A及m条查询(L,x)。每次永久执行A[L−1]=A[L−1]−x，然后独立计算B：B[0]=A[0]，B[i]=min(B[i−1],A[i])。输出这次B中不同整数的数量。后续查询仍修改真实A，不能把B覆盖回A。x为正数；减值后的A可为0或负数。',
        'input': '第一行n和m，第二行n个初始A[i]，随后m行各两个整数L和x。1≤n,m≤100000，1≤初始A[i]≤1000000000，1≤x≤100000，1≤L≤n。位置L是1-based；L≤n由原文A[L−1]的合法下标隐含，本站明确列出。',
        'output': '输出m个空格分隔整数，按查询顺序表示每次独立B的不同值数量。修改后的数值可能低于32位有符号整数下界，应使用64位保存A。',
        'explanation': '样例1保留原始输入，但按正式操作纠正原错误输出[2,3]为[2,2]：第一步A=[5,7,-3,2,4]、B=[5,5,-3,-3,-3]；第二步A=[5,7,-3,2,0]，B不变。原解释未执行(3,5)所定义的减值。样例2、3为本站补充；样例2真实A的第二项从10降至9再降至4，输出1、2；样例3相等前缀值不增加不同数量。',
        'hints': ['B的不同值数量等于严格前缀最小值位置数。', '一次下降可能插入该位置并删除一段后继纪录。', '一个位置可反复删插，但总插入次数不超过查询次数。'],
        'timeLimit': 5, 'memoryLimit': 262144, 'outputLimit': 4096, 'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '维护严格前缀最小值位置并摊还删除', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': RAW_PATH, 'gitBlobSha': BLOB, 'rawSha256': RAW_SHA, 'upstreamCodeExecuted': False, 'siteAdded': '文本I/O；明确L≤n是A[L−1]的隐含有效下标；原样例输入保留但按正式规则输出[2,2]，披露原[2,3]错误。原范围全部保留，修改后允许负数。', 'recoveredConstraints': ['1 <= n,m <= 100000', '1 <= initial A[i] <= 1000000000', '1 <= x <= 100000', '1 <= L <= n (valid A[L-1] index)'], 'originalSampleCorrection': {'sourceOutput': [2, 3], 'correctedOutput': [2, 2], 'reason': '原解释第一步未按L=3,x=5更新A[2]=2-5=-3'}}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': 'raw明确查询字段正数及完整1e5范围；按A[L−1]-=x和独立B严格实现、披露样例错误，Fenwick摊还覆盖全域，163全扫描oracle及双1e5压力通过。仅候选待沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 3, 'hiddenCases': len(cases) - 3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'After each real A point decrement, independently construct full prefix-minimum B and count its set; no record/Fenwick logic.', 'largeBoundaryOracle': 'Closed-form counts for descending, uniform, alternating reinsert/delete and equal-value reverse scans; all 100000 outputs compared.', 'largeBoundaries': evidence, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter() - started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()
