#!/usr/bin/env python3
"""Independently authored, offline Goldman Sachs 19 recovery candidate."""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-goldman-sachs-19'
BATCH = 'goldman-sachs-19-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW_PATH = 'fastprep/Goldman Sachs/goldman-get-minimum-value.md'
BLOB = 'e4945accd1072034e106a1213e3e58ed3a521475'
RAW_SHA = '878994ead628335db5f84cb343cd6fc7d14e4c0282d91603409a13ee290d2caf'
HASH = 'fc75eb32cf15863d53117c21ab1feff5964c61ffc9a09bf8e6bff893bdc290f8'
SEED = 20261007

REFERENCE = '''import sys
from bisect import bisect_left

def solve(raw):
    values = list(map(int, raw.split()))
    n, k = values[:2]
    if k >= 3:
        return '0'
    a = sorted(values[2:])
    answer = a[0]
    for i in range(1, n):
        answer = min(answer, a[i] - a[i - 1])
    if k == 1 or answer == 0:
        return str(answer)
    for i in range(1, n):
        for j in range(i):
            difference = a[i] - a[j]
            position = bisect_left(a, difference)
            if position < n:
                answer = min(answer, a[position] - difference)
            if position:
                answer = min(answer, difference - a[position - 1])
            if answer == 0:
                return '0'
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '忽略第二次新差值与原元素的组合',
     'code': REFERENCE.replace('if k == 1 or answer == 0:', 'if k <= 2 or answer == 0:')},
    {'name': '误以为两次操作就总能生成零',
     'code': REFERENCE.replace('if k >= 3:', 'if k >= 2:')},
]

EDITORIAL = '''## 来源与约定

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Goldman Sachs/goldman-get-minimum-value.md完整定义：任选两个不同下标，将元素绝对差追加到数组；恰好执行k次，最小化数组中的最小值。原范围2≤n≤2000、1≤data[i]≤10^9、1≤k≤10^9全部保留。每次可重用原来的下标，也可选择之前追加的元素；原文不要求所选下标对与先前不同。初始数为正，但追加的差可以为0。本站仅整理标准输入输出，不执行来源代码，也不沿用catalog把答案简化成两数最小差的错误算法。

## 思路

k≥3时答案为0：对同一原下标对操作两次，得到两个相同的新元素，第三次取这两个不同下标的差即可。额外操作不删除已有的0。

k=1时，答案是原最小值和原数组两数最小差的较小者。排序后两数最小差只需检查相邻项。

k=2时，还需枚举第一次得到的每个差d，考察第二次用d与任一原元素相减的结果。对排序数组二分d的位置，仅检查左右最近元素。维护以上所有可能值的最小值。

## 正确性证明

数组元素始终非负，故0是全局下界。k≥3的构造恰好用三步达到它；任意剩余步数都可以重复合法下标对完成，且0一直保留，所以对恰好k步仍最优。

仅一次操作时，最终最小值只可能来自原元素或所选原元素之差，因此枚举这些值既充分又必要。排序后任意非相邻两数差不小于其间某个相邻差，所以相邻差足够。

两次操作时，第一次只能选择原元素并产生d。第二次要么仍选两个原元素，所得最小值已包含在一次操作的候选中；要么选择唯一的新元素d与一个原元素，所得值为|d-a[t]|。不可能选择两个不同的新元素，因为第二步之前只有一个新下标。逐个枚举原数对覆盖全部d，二分两侧邻居给出d到原数组的最短距离。所有候选都由合法操作实现；若最优候选来自较早步骤，补做任何合法操作不会增大已存在的最小值。因此算法恰好覆盖两步最优答案。

## 复杂度

k≥3时读入O(n)；k=1时O(n log n)；k=2时O(n² log n)。存储数组O(n)，不存储全部两数差。n=2000时最多1999000个数对，数值与差均不超过10^9，无大整数增长。

## 独立验证

小规模oracle逐步维护实际数组状态，枚举每一步所有合法下标对，追加差、归并等价排列状态，最终取全部可达状态的最小元素；不使用k≥3捷径、最近邻公式或参考程序。163个唯一输入经过真实子进程对拍。正式大边界使用可证明的结构期望：全部相等时一步即0；在[500000001,999000376]内间距249625的2000项序列，其任意差小于所有原值，最小一步差249625，而两步新差与原值的距离至少999626，所以k=1和k=2答案均249625；k=10^9答案0。这些边界真实运行参考程序。两个语义错误程序正常退出并被正式用例拒绝。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(a, k):
    return f'{len(a)} {k}\n' + ' '.join(map(str, a)) + '\n'


def oracle(a, k):
    states = {tuple(sorted(a))}
    for _ in range(k):
        following = set()
        for state in states:
            for i in range(len(state)):
                for j in range(i):
                    following.add(tuple(sorted(state + (abs(state[i] - state[j]),))))
        states = following
    return min(min(state) for state in states)


def run(path, raw):
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw,
                            text=True, capture_output=True, check=True, timeout=15)
    assert not result.stderr, result.stderr
    return result.stdout.strip()


def main():
    started = time.perf_counter()
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{RAW_PATH}'], cwd=ROOT)
    assert sha(raw) == RAW_SHA
    assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == BLOB
    old = next(x for x in json.loads((OA / 'reviews/goldman-sachs-remaining.json').read_text())['items'] if x['id'] == PID)
    assert old['status'] == 'blocked'
    public = [([42, 47, 50, 54, 62, 79], 2, 3), ([4, 2, 5, 9, 3], 1, 1), ([5, 18, 3, 12, 11], 2, 1)]
    specs = [(a, k) for a, k, _ in public]
    specs += [([10, 16], 2), ([7, 11], 3), ([1, 1000000000], 1),
              ([1000000000, 1000000000], 1), ([1, 2], 2), ([9, 9], 2),
              ([6, 10], 1), ([6, 10], 2), ([6, 10], 3), ([10, 16], 1),
              ([1, 1], 1), ([1, 1], 3), ([9, 17], 2), ([18, 6, 12], 2)]
    keys = {encode(a, k) for a, k in specs}
    rng = random.Random(SEED)
    while len(specs) < 163:
        a = [rng.randint(1, 30) for _ in range(rng.randint(2, 5))]
        k = rng.randint(1, 4)
        key = encode(a, k)
        if key not in keys:
            keys.add(key)
            specs.append((a, k))
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for i, (a, k) in enumerate(specs):
        expected = oracle(a, k)
        if i < 3:
            assert expected == public[i][2]
        text = encode(a, k)
        assert run(refpath, text) == str(expected), (a, k, expected)
        oracles.append({'input': text, 'expectedOutput': str(expected) + '\n'})
    assert len(keys) == len(oracles) == 163
    print(f'{PID}: 163 unique literal-operation oracle subprocess checks passed', flush=True)
    cases = [{'name': f'原始样例{i+1}' if i < 3 else f'独立操作枚举{i-2}', **row, 'hidden': i >= 3, 'weight': 1}
             for i, row in enumerate(oracles[:35])]
    spaced = [500000001 + i * 249625 for i in range(2000)]
    assert spaced[-1] == 999000376
    boundaries = [
        ('满规模两步完整数对扫描', spaced, 2, 249625),
        ('满规模一步相邻差', spaced[::-1], 1, 249625),
        ('满规模十亿步', spaced, 1000000000, 0),
        ('满规模最大值相等', [1000000000] * 2000, 1, 0),
        ('满规模最小值相等', [1] * 2000, 2, 0),
        ('最少元素最大差一步', [999999999, 1000000000], 1, 1),
        ('最少元素最大值两步', [999999999, 1000000000], 2, 1),
        ('最少元素十亿步', [1, 1000000000], 1000000000, 0),
    ]
    evidence = []
    for name, a, k, expected in boundaries:
        text = encode(a, k)
        cases.append({'name': name, 'input': text, 'expectedOutput': str(expected) + '\n', 'hidden': True, 'weight': 1})
        evidence.append({'name': name, 'n': len(a), 'k': k, 'inputBytes': len(text.encode()), 'expectedOutput': str(expected)})
    assert len({x['input'] for x in cases}) == len(cases)
    for case in cases:
        assert run(refpath, case['input']) == case['expectedOutput'].strip(), case['name']
    killed = []
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA / f'negative-controls/{PID}-{i}.py'
        path.write_text(mutant['code'])
        rejected = [j for j, case in enumerate(cases) if run(path, case['input']) != case['expectedOutput'].strip()]
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    package = {'schemaVersion': 1, 'problem': {
        'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '追加绝对差后的最小元素',
        'difficulty': '中等', 'tags': ['OA', 'Goldman Sachs', '枚举', '二分查找'],
        'description': '给定n个正整数组成的数组data。每次选择当前数组的两个不同下标i<j，将|data[i]-data[j]|追加到末尾。原元素保留；后续操作可以选择新元素，也可以重复选择先前使用过的下标对。恰好执行k次操作，求最终数组最小元素能够达到的最小值。追加值允许为0。本站标准输入输出由完整固定原始来源整理，不缩小原范围。',
        'input': '第一行n和k，第二行n个整数data[i]。2≤n≤2000，1≤data[i]≤10^9，1≤k≤10^9。初始数组允许重复值。',
        'output': '输出一个整数：恰好k次操作后，数组最小元素的最小可能值。',
        'explanation': '样例1可重复取47与50，追加两个3，两步后最小值为3，不能用第三步得到0。样例2取4与5追加1。样例3取12与11追加1，再做任意合法操作，最小值仍为1。三个样例均来自原始题面，操作解释由本站补全。',
        'hints': ['新增差值仍可参与后续操作。', '原下标对允许重复使用。', '分别分析一次、两次及至少三次操作。'],
        'timeLimit': 5, 'memoryLimit': 131072, 'outputLimit': 4096, 'checker': 'tokens',
        'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '按操作次数分类并枚举新差值', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': RAW_PATH, 'gitBlobSha': BLOB, 'rawSha256': RAW_SHA, 'upstreamCodeExecuted': False, 'siteAdded': '标准输入输出及独立操作解释；全部原始范围保留。', 'recoveredConstraints': ['2 <= n <= 2000', '1 <= data[i] <= 1000000000', '1 <= maxOperations <= 1000000000']}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old['reason'], 'reason': '完整raw规则与范围可确定；独立证明k>=3答案0及k=2最近原值公式，全部原样例复算一致；163唯一字面操作枚举oracle、完整n=2000/k=10^9边界及两个正常退出负控本地通过。仅候选，待真实沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': 163, 'publicCases': 3, 'hiddenCases': len(cases)-3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Literal exact-depth operation enumeration over complete array states, independent of k>=3 and closest-pair formulas.', 'largeBoundaries': evidence, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter()-started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()
