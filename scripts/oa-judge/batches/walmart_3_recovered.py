#!/usr/bin/env python3
"""Independent BFS-verified Walmart candy conversion recovery candidate."""
from pathlib import Path
from collections import deque
from itertools import product
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-walmart-3'
BATCH = 'walmart-3-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW_PATH = 'fastprep/Walmart/walmart-minimum-moves-to-equal-candy-bars.md'
BLOB = '08ace68f56e217deca4656490e9b75ecef58d80e'
RAW_SHA = 'fd6eaf0a06dc3f76b75a08bcafc43f76c4fe0c1e57a17c58e2b4ac758d5aa0b7'
HASH = '8225cddc82ddf05117933c20dc4b3abee89b5abc01d4bd39e2b4bd4041536718'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    a = list(map(int, raw.split()))
    best = None
    for i, j in ((0, 1), (0, 2), (1, 2)):
        if a[i] % 3 == a[j] % 3:
            steps = max(a[i], a[j])
            if best is None or steps < best:
                best = steps
    return str(-1 if best is None else best)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '误将三类数量相等当作目标', 'code': REFERENCE.replace('best = None', "if len(set(a)) == 1:\n        return '0'\n    best = None")},
    {'name': '错误附加两种待清空数量和被3整除', 'code': REFERENCE.replace('if a[i] % 3 == a[j] % 3:', 'if a[i] % 3 == a[j] % 3 and (a[i] + a[j]) % 3 == 0:')},
]

EDITORIAL = '''## 固定来源与目标澄清

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Walmart/walmart-minimum-moves-to-equal-candy-bars.md完整给出1≤A,B,C≤10^8、操作和整数返回值，以及原例(1,2,3)输出−1。旧blocked所称没有输出类型或完整示例不符合这份固定原文。

一次选两颗不同味糖，将这两颗都转换成第三种口味，故两种数量各减1，第三种增加2，总数不变。目标是所有糖同一种口味，即两种数量为0，不是三种数量相等。初始三种数量都为正，操作后的某些数量允许为0。原文的不可达示例亦排除把两颗合并成一颗的解读：若只生成一颗，(1,2,3)可以消除到单味，而原例明确不可达。本站只编排标准输入输出并明确两颗糖的转换；未执行上游代码。

原整理版题解附加了待清空两种数量之和被3整除的错误条件；目标口味的数量会变化，不应要求它保持初值的模3。比如(1,1,1)一步变成(0,0,3)，答案1而不是0或−1。原样例保留，另两个公开样例为本站补充。

## 思路

枚举最终保留哪一种口味。设另外两种需要归零的数量是a、b。若a与b模3不同，则该目标不可达；否则最少步数为max(a,b)。在三对数量中取所有可达候选的最小值；没有候选则输出−1。

## 正确性证明

必要性：每次操作对任意两种数量之差的改变量都是0、3或−3。因此a−b模3不变，最终两者都为0必有a≡b(mod3)。每次操作任一种数量最多减1，要把初始数量a、b清零，至少需要max(a,b)步。

充分性：不妨a≥b且a−b=3d，第三种当前数量记为c。初始b,c≥1。重复以下三步组成的块d次：先各取一颗a与c转换为两颗b，再连续两次各取一颗a与b转换为两颗c。一个块净变化为(a,b,c)→(a−3,b,c+3)。开始任何块时a≥b+3≥4、b≥1、c≥1；三次选择均有足够糖，块内允许c暂时为0。块结束后b保持为正，c增加，故可以继续执行。d块后a=b，再执行b次“a与b转换成两颗c”，两者同时归零。总步数3d+b=a=max(a,b)，达到必要下界。a=b时直接执行b次即可；a<b时对称处理。

任意最终单味状态必对应枚举的某一对归零数量，而上述条件对该目标充要、费用精确，取三个候选最小值即为全局最优。若没有同余的一对，则任何单味目标都不可达。

## 复杂度与整数

仅检查三对数量，时间和额外空间均为O(1)。答案在可达时不超过10^8，糖总数不超过3×10^8；参考程序不模拟最多一亿次操作。完整保留A、B、C≤10^8，不添加初始0或缩小范围。

## 独立验证

小oracle直接对三维数量状态做BFS，每次枚举两种当前均有糖的口味，各减1并给第三种加2；第一次到达仅一个非零分量的状态就是最短路，穷尽可达状态仍没有则返回−1。它不使用模3或max公式。163个唯一输入以真实子进程对拍，覆盖全部27种余数组合。完整边界另覆盖接近10^8的27种余数组合、三种都等于10^8及大小极不平衡情形。最大值组期望由三种操作次数的非负整数平衡方程独立求得，而非运行参考程序。两个负控均正常退出并被正式案例拒绝。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(a):
    return ' '.join(map(str, a)) + '\n'


def oracle(a):
    start = tuple(a)
    queue = deque([(start, 0)])
    seen = {start}
    while queue:
        state, steps = queue.popleft()
        if sum(x != 0 for x in state) == 1:
            return steps
        for i, j, k in ((0, 1, 2), (0, 2, 1), (1, 2, 0)):
            if state[i] and state[j]:
                following = list(state)
                following[i] -= 1
                following[j] -= 1
                following[k] += 2
                following = tuple(following)
                if following not in seen:
                    seen.add(following)
                    queue.append((following, steps + 1))
    return -1


def balance_oracle(a):
    # u conversions consume both eliminated flavors; v/w consume one plus survivor.
    # Equations: x-u-v+2w=0, y-u+2v-w=0.
    # Set v=w+(x-y)/3 and u=x-(x-y)/3+w; minimize u+v+w.
    candidates = []
    for survivor in range(3):
        x, y = [a[i] for i in range(3) if i != survivor]
        delta, remainder = divmod(x - y, 3)
        if remainder:
            continue
        w = max(0, -delta, delta - x)
        v = w + delta
        u = x - delta + w
        assert u >= 0 and v >= 0 and w >= 0
        assert x - u - v + 2 * w == y - u + 2 * v - w == 0
        candidates.append(u + v + w)
    return min(candidates, default=-1)


def run(path, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw, text=True, capture_output=True, check=True, timeout=10)
    assert not result.stderr
    return result.stdout.strip(), time.perf_counter() - started


def main():
    started = time.perf_counter()
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{RAW_PATH}'], cwd=ROOT)
    assert sha(raw) == RAW_SHA
    assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == BLOB
    old = next(x for x in json.loads((OA / 'coverage.json').read_text())['items'] if x['id'] == PID)
    public = [((1, 2, 3), -1), ((1, 1, 1), 1), ((4, 1, 2), 4)]
    specs = [a for a, _ in public]
    keys = set(specs)
    for a in product(range(1, 4), repeat=3):
        if a not in keys:
            keys.add(a)
            specs.append(a)
    rng = random.Random(SEED)
    while len(specs) < 163:
        a = tuple(rng.randint(1, 12) for _ in range(3))
        if a not in keys:
            keys.add(a)
            specs.append(a)
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for i, a in enumerate(specs):
        expected = oracle(a)
        assert balance_oracle(a) == expected
        if i < 3:
            assert expected == public[i][1]
        text = encode(a)
        assert run(refpath, text)[0] == str(expected), (a, expected)
        oracles.append({'input': text, 'expectedOutput': str(expected) + '\n'})
    print(f'{PID}: 163 unique literal state-BFS oracle subprocess checks passed', flush=True)
    cases = [{'name': '原始不可达样例' if i == 0 else f'本站补充公开样例{i}' if i < 3 else f'独立三维状态枚举{i-2}', **row, 'hidden': i >= 3, 'weight': 1} for i, row in enumerate(oracles[:31])]
    evidence = []
    boundaries = [(f'上界余数全组合{i+1}', a) for i, a in enumerate(product([99999999, 100000000, 99999998], repeat=3))]
    boundaries += [('最小两种快速清空', (1, 1, 100000000)), ('长构造且第三种仅两颗', (100000000, 1, 2)),
                   ('最大差对称', (1, 100000000, 2)), ('仅第三种为大值', (1, 2, 100000000)),
                   ('大值清空无需模拟', (99999998, 2, 1)), ('高低混合无解', (99999999, 1, 2))]
    for name, a in boundaries:
        expected = balance_oracle(a)
        text = encode(a)
        got, elapsed = run(refpath, text)
        assert got == str(expected), (name, a, expected)
        cases.append({'name': name, 'input': text, 'expectedOutput': str(expected) + '\n', 'hidden': True, 'weight': 1})
        evidence.append({'name': name, 'values': a, 'expectedOutput': str(expected), 'localSeconds': round(elapsed, 4)})
    assert len({c['input'] for c in cases}) == len(cases)
    for case in cases:
        assert run(refpath, case['input'])[0] == case['expectedOutput'].strip()
    killed = []
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA / f'negative-controls/{PID}-{i}.py'
        path.write_text(mutant['code'])
        rejected = [j for j, case in enumerate(cases) if run(path, case['input'])[0] != case['expectedOutput'].strip()]
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '将全部糖果变成同一口味的最少操作', 'difficulty': '中等', 'tags': ['OA', 'Walmart', '数学', '不变量'],
        'description': '有三种不同口味的糖果，数量分别为A、B、C。每次选择两颗口味不同的糖，将这两颗糖都变成第三种口味，因此被选的两种数量各减1、第三种数量加2，总糖数不变。只有当前仍有糖的口味可以被选。求使所有糖果都为同一种口味的最少操作次数；无法做到时输出−1。目标是两种口味数量为0，不是三种数量相等。',
        'input': '一行三个整数A、B、C，1≤A,B,C≤100000000。初始三种口味都有糖，操作过程中允许某种数量为0。完整保留固定原题范围。',
        'output': '输出最少操作次数；不可达时输出-1。',
        'explanation': '样例1来自固定原题，(1,2,3)无法变成单一口味。样例2、3为本站补充：(1,1,1)一步变成(0,0,3)；(4,1,2)可依次变成(3,3,1)、(2,2,3)、(1,1,5)、(0,0,7)，最少4步。原整理版额外要求待清空数量和被3整除是错误条件，本站按原操作独立求解。',
        'hints': ['观察每对口味数量之差对3取模。', '每一步任一口味最多减少一颗。', '尝试构造三步一组，保持一种数量不变并减少另一种三颗。'],
        'timeLimit': 2, 'memoryLimit': 131072, 'outputLimit': 4096, 'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '同余不变量与三步构造达到下界', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': RAW_PATH, 'gitBlobSha': BLOB, 'rawSha256': RAW_SHA, 'upstreamCodeExecuted': False, 'siteAdded': '标准输入输出；明确两颗糖均转换成第三味，目标单味不是三数量相等；额外两个公开样例为本站补充。', 'recoveredConstraints': ['1 <= A,B,C <= 100000000'], 'correction': '原raw已经给出完整整数返回/不可达-1与原例，旧blocked理由失实；不采用catalog附加的(x+y)%3==0错误条件。'}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '固定raw包含完整范围/样例/返回约定；独立模3必要性与三步块充分性证明，163字面三维BFS及1e8全余数组合通过。仅候选待沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 3, 'hiddenCases': len(cases) - 3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'BFS over literal three-count states, enumerate all legal conversions and detect a single nonzero count; no mod/max formula.', 'largeBoundaryOracle': 'Nonnegative integer counts of the three operation types solved from final zero-balance equations; checked against all small BFS cases.', 'largeBoundaries': evidence, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter() - started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()
