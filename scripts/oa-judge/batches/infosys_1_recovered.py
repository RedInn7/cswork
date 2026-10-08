#!/usr/bin/env python3
"""Offline Infosys 1 candidate; never execute imported upstream programs."""
from pathlib import Path
import hashlib
import heapq
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-infosys-1'
BATCH = 'infosys-1-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW_PATH = 'fastprep/infosys/infosys-extract-cards.md'
BLOB = '71f2c2e6361447004467a7409736276b9db72c23'
RAW_SHA = '33e060820cfe9addf6d96b1623f7f1ee0c9bd905452334ddc9fd4f0608bb0a73'
HASH = 'd7c4495ae6323965cdd0d039107ead9b7bfa9a6b2485f276d0d323795823ef91'
SEED = 20261007
MOD = 1000000007

REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n = data[0]
    a = data[1:]
    position = [0] * (n + 1)
    bit = [0] + a
    for i in range(1, n + 1):
        position[a[i - 1]] = i
        parent = i + (i & -i)
        if parent <= n:
            bit[parent] += bit[i]
    def prefix(i):
        value = 0
        while i:
            value += bit[i]
            i -= i & -i
        return value
    total = n * (n + 1) // 2
    head = 1
    answer = 0
    for target in range(1, n + 1):
        p = position[target]
        left = prefix(p - 1) - prefix(head - 1)
        if p < head:
            left += total
        right = total - left
        answer += min(left, right)
        i = p
        while i <= n:
            bit[i] -= target
            i += i & -i
        total -= target
        head = p + 1
        if head > n:
            head = 1
    return str(answer % 1000000007)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '只允许首卡移到末尾', 'code': REFERENCE.replace('answer += min(left, right)', 'answer += left')},
    {'name': '逆向旋转漏掉目标卡费用', 'code': REFERENCE.replace('right = total - left', 'right = total - left - target')},
]

EDITORIAL = '''## 来源与约定

固定提交e66f809f4c953bce129f68491726176615db6afc中的fastprep/infosys/infosys-extract-cards.md给出完整原界：1≤n≤100000，cards为1到n的排列。可以把首卡移到末尾或末卡移到首部，费用都是移动的卡面值，依次免费提取1、2、…、n。第三操作的简写没有重复“首部”二字，但完整原样例明确写出“remove the 1st card”，且逐步先将目标移到首部再提取。本站据这一完整操作解释明确只能提取当前首卡，不允许直接删除中间或末尾的目标。若允许从任意位置免费提取，原样例无需旋转，费用为0；若只放宽为允许从首尾两端免费提取，则沿原样例操作花费11并提取1、2、3后，剩余[5,4]可从末尾免费提取4，再免费提取5，总费用至多11。两种放宽规则都与原样例答案15不符。这是来源重建，不是根据整理版代码猜测规则。标准输入输出由本站编排；只保留一个原始样例，另外两个公开样例明确为本站补充。没有执行上游代码。

## 思路

删除只会减少圆环上的卡，不改变其相对循环顺序。处理目标k时，设顺时针从当前首部走到k之前的卡面值和为L，当前总和为T。把首卡逐个移到末尾，费用为L；从末尾逐个移到首部直到k到达首部，费用为T−L，这一方向包含目标k自己的费用。选择两者较小值，然后删除k。无论选哪个方向，删除后首卡都是k的循环后继。

用原下标上的树状数组维护尚未删除的卡面值和。环形区间拆成至多两个前缀和；删除k就是在其原下标减去k。不必真的寻找下一个存活下标：把首部游标放在k的原下标加一，已删除位置在树状数组里为0，仍正确表示后续循环顺序。

## 正确性证明

固定一次提取之前的剩余卡集合。所有旋转状态构成一个环，每次合法旋转沿相邻状态移动，费用为被移动卡的正面值。将k移至首部的最短路线不含重复状态：删除重复状态间的正费用闭路只会降低费用。因此最短路线必是两个简单方向之一。正向路线移动k之前的卡，费用L；反向路线移动另一段并包含k，费用T−L。若k已在首部，正向费用0，仍被公式覆盖。

两条路线最终得到完全相同的线性序列，其首部均为k，余下循环顺序不变。提取k之后，后续问题因此与选择的方向无关。每个阶段取min(L,T−L)既可实现，也不大于任何合法方案的该阶段费用。对依次提取的各阶段归纳，所得总费用是全局最小值。

树状数组初值为原卡面值，删除时仅将该下标减为0，故所有区间和始终精确等于尚存卡面值之和。首部游标跳过的空位置权值为0，不改变L。因而实现计算的正是上述最优费用。

## 复杂度与整数

建立树状数组O(n)，n次查询和删除共O(n log n)，空间O(n)。所有费用先用未取模整数比较并相加，最后才模1000000007；不能对两条路线先取模再比较。总费用不超过n·n(n+1)/2<5.1×10^14，64位有符号整数足够，Python整数也安全。

## 独立验证与边界

小规模oracle在完整线性卡序列上做Dijkstra：枚举一次首移末、一次末移首及仅当首卡为下一目标时的免费提取，直到空序列。它不使用环形区间公式或树状数组。163个唯一输入均通过真实参考程序子进程。

完整n=100000压力包含升序、逆序和多个升序圆环切点。升序费用0。逆序每次把末尾目标移到首部，最后一张不需移动，精确未取模费用n(n−1)/2。对升序旋转[k+1,…,n,1,…,k]，只有提取1前需要移动，费用为min(k(k+1)/2,n(n+1)/2−k(k+1)/2)，之后全程免费。最大域随机排列另用分块列表维护真实序列，从两端遍历块的卡面值和，移除目标并重设首部；它不用Fenwick实现。两个错误算法须正常退出并被正式用例拒绝。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(a):
    return str(len(a)) + '\n' + ' '.join(map(str, a)) + '\n'


def oracle(a):
    n = len(a)
    start = tuple(a)
    best = {start: 0}
    queue = [(0, start)]
    while queue:
        cost, state = heapq.heappop(queue)
        if cost != best[state]:
            continue
        if not state:
            return cost
        choices = [(state[1:] + state[:1], state[0]),
                   (state[-1:] + state[:-1], state[-1])]
        if state[0] == n - len(state) + 1:
            choices.append((state[1:], 0))
        for following, weight in choices:
            candidate = cost + weight
            if candidate < best.get(following, float('inf')):
                best[following] = candidate
                heapq.heappush(queue, (candidate, following))
    raise AssertionError('A permutation must be feasible')


def block_oracle(a):
    # Independent sqrt-decomposition: no prefix tree or reference imports.
    blocks = [a[i:i + 320] for i in range(0, len(a), 320)]
    sums = [sum(b) for b in blocks]
    location = {v: j for j, b in enumerate(blocks) for v in b}
    head_block, head_value = 0, a[0]
    total, answer = sum(a), 0
    for target in range(1, len(a) + 1):
        j = location[target]
        b = blocks[j]
        ix = b.index(target)
        h = blocks[head_block].index(head_value)
        if j == head_block:
            forward = sum(b[h:ix]) if h <= ix else total - sum(b[ix:h])
        else:
            forward = sum(blocks[head_block][h:]) + sum(b[:ix])
            q = (head_block + 1) % len(blocks)
            while q != j:
                forward += sums[q]
                q = (q + 1) % len(blocks)
        answer += min(forward, total - forward)
        b.pop(ix)
        sums[j] -= target
        total -= target
        if total:
            if ix < len(b):
                head_block, head_value = j, b[ix]
            else:
                q = (j + 1) % len(blocks)
                while not blocks[q]:
                    q = (q + 1) % len(blocks)
                head_block, head_value = q, blocks[q][0]
    return answer


def run(path, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw,
                            text=True, capture_output=True, check=True, timeout=15)
    assert not result.stderr, result.stderr
    return result.stdout.strip(), time.perf_counter() - started


def main():
    started = time.perf_counter()
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{RAW_PATH}'], cwd=ROOT)
    assert sha(raw) == RAW_SHA
    assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == BLOB
    old = next(x for x in json.loads((OA / 'coverage.json').read_text())['items'] if x['id'] == PID)
    public = [([3, 5, 1, 4, 2], 15), ([1], 0), ([3, 2, 1], 3)]
    specs = [a for a, _ in public]
    specs += [[1, 2], [2, 1], [2, 3, 1], [3, 1, 2], [1, 3, 2],
              list(range(8, 0, -1)), list(range(1, 9)), [4, 1, 7, 2, 6, 3, 8, 5]]
    keys = {encode(a) for a in specs}
    rng = random.Random(SEED)
    while len(specs) < 163:
        a = list(range(1, rng.randint(3, 9) + 1))
        rng.shuffle(a)
        key = encode(a)
        if key not in keys:
            keys.add(key)
            specs.append(a)
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for i, a in enumerate(specs):
        expected = oracle(a)
        assert block_oracle(a) == expected
        if i < 3:
            assert expected == public[i][1]
        text = encode(a)
        assert run(refpath, text)[0] == str(expected)
        oracles.append({'input': text, 'expectedOutput': str(expected) + '\n'})
    print(f'{PID}: 163 unique Dijkstra operation-oracle subprocess checks passed', flush=True)
    cases = [{'name': '原始样例' if i == 0 else f'本站补充样例{i}' if i < 3 else f'独立最短路枚举{i-2}',
              **row, 'hidden': i >= 3, 'weight': 1} for i, row in enumerate(oracles[:35])]
    n = 100000
    boundaries = [('完整升序', list(range(1, n + 1)), 0),
                  ('完整逆序最终取模', list(range(n, 0, -1)), n * (n - 1) // 2)]
    for k in [1, 50000, 70710, 70711, 99999]:
        s = k * (k + 1) // 2
        boundaries.append((f'完整升序环切点{k}', list(range(k + 1, n + 1)) + list(range(1, k + 1)), min(s, n * (n + 1) // 2 - s)))
    shuffled = list(range(1, n + 1))
    rng.shuffle(shuffled)
    shuffle_expected = block_oracle(shuffled)
    boundaries.append(('完整乱序独立分块对照', shuffled, shuffle_expected))
    evidence = []
    for name, a, expected in boundaries:
        text = encode(a)
        got, elapsed = run(refpath, text)
        assert got == str(expected % MOD), (name, got, expected)
        cases.append({'name': name, 'input': text, 'expectedOutput': str(expected % MOD) + '\n', 'hidden': True, 'weight': 1})
        evidence.append({'name': name, 'n': len(a), 'inputBytes': len(text.encode()), 'exactUnmoddedCost': str(expected), 'expectedOutput': str(expected % MOD), 'localSeconds': round(elapsed, 4)})
        print(f'{name}: cost={expected}, reference {elapsed:.3f}s', flush=True)
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
    package = {'schemaVersion': 1, 'problem': {
        'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '按顺序提取卡牌的最小旋转费用',
        'difficulty': '中等', 'tags': ['OA', 'Infosys', '树状数组', '贪心'],
        'description': '给定由1到n组成的排列cards，表示从首部到末尾的一列卡牌。可以任意次执行：①把首卡移到末尾，付出该卡面值的费用；②把末卡移到首部，付出该卡面值的费用；③若首卡恰为下一张需要提取的卡，则免费提取它。必须按1、2、…、n的顺序提取全部卡牌。求最小总费用对1000000007取模的结果。必须先最小化真实总费用，不能先取模再比较。仅从首部提取由固定原题完整样例中的“remove the 1st card”及其逐步操作恢复；本站明确该规则，不允许直接提取中间或末尾的卡。',
        'input': '第一行一个整数n。第二行n个整数cards[i]，是1到n的排列。1≤n≤100000，1≤cards[i]≤n，所有元素互不相同。完整保留原题范围。',
        'output': '输出最小总费用对1000000007取模的非负整数。',
        'explanation': '样例1为原始样例：依次将末尾2、4、1移到首部花费7，提取1；将4从首移末花费4，提取2、3；将4从末移首花费4，提取4、5，总费用15。样例2、3为本站补充：单张卡无需旋转；逆序3、2、1依次付1、2后剩余3可免费提取。',
        'hints': ['旋转不改变卡牌的循环相对顺序。', '把目标卡移到首部后，后续状态是否依赖旋转方向？', '维护尚未提取卡牌的区间面值和。'],
        'timeLimit': 3, 'memoryLimit': 131072, 'outputLimit': 4096, 'checker': 'tokens',
        'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '相同后继状态下独立选择旋转方向', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': RAW_PATH, 'gitBlobSha': BLOB, 'rawSha256': RAW_SHA, 'upstreamCodeExecuted': False, 'siteAdded': '标准输入输出；根据原始逐步解释的remove the 1st card明确仅首部提取；补充两个公开样例。未缩域。', 'recoveredConstraints': ['1 <= n <= 100000', 'cards is a permutation of 1..n'], 'originalSample': {'input': public[0][0], 'expected': 15}}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '完整原样例明确首部提取；独立证明每阶段最短两方向选择与后继状态无关，Fenwick覆盖原n100000；163唯一操作Dijkstra及8个满规模压力、两个正常退出负控本地通过。仅候选，待真实沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 3, 'hiddenCases': len(cases) - 3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Dijkstra on literal linear sequence states with both one-step rotations and a free legal first-card extraction; independent of Fenwick and greedy directional sums.', 'largeBoundaries': evidence, 'largeRandomOracle': 'Independent square-root blocks with list removal and circular block traversal; checked against all 163 operation-Dijkstra cases.', 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter() - started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()
