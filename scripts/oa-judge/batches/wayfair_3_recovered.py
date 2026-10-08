#!/usr/bin/env python3
"""Wayfair 1 recovery; semantic witnesses from independent subset enumeration."""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-wayfair-3'
BATCH = 'wayfair-3-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW_PATH = 'fastprep/Wayfair/wayfair-smash-the-bricks.md'
BLOB = 'f1aa9967f95e79890b9ff7b6cf209f7fe647d4a6'
RAW_SHA = '49fd70808b7b3ae683a98ef50e9cb896667fd78b312cce1840fea4114db251ad'
HASH = 'edb5392554bedec6665ed3b7ee72f57127afae85f3634cc7057b9f3a2ea18813'
SEED = 20261011

REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, k = data[:2]
    strengths = data[2:]
    selected = sorted((i for i in range(n) if strengths[i] > 1), key=lambda i: strengths[i], reverse=True)[:min(k, n)]
    used = set(selected)
    big = [i + 1 for i in range(n) if i in used]
    small = [i + 1 for i in range(n) if i not in used]
    total = len(big) + sum(strengths[i - 1] for i in small)
    return str(total) + '\\n' + (' '.join(map(str, big)) if big else '-1') + '\\n' + (' '.join(map(str, small)) if small else '-1')

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '大锤错误优先最弱砖块', 'code': REFERENCE.replace('reverse=True', 'reverse=False')},
    {'name': '总击数错误溢出32位', 'code': REFERENCE.replace("return str(total) +", "total = (total + 2147483648) % 4294967296 - 2147483648\n    return str(total) +")},
]

EDITORIAL = '''## 固定来源与约定

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Wayfair/wayfair-smash-the-bricks.md明确：n≤200000，0≤bigHits≤200000，强度为1..10^9的互异整数；大锤使用次数是maximum blows，即至多而非必须用满。位置按1编号，两组索引各自升序，没有使用的锤对应[-1]。原例3中bigHits=9、n=8，明确允许额度大于砖块数。

本站将原返回二维数组[[total],[big indices],[small indices]]编排为严格三行，不添加每行元素个数；未使用组写-1。允许强度1的砖用任一种锤，只要仍最优且不超过额度，不规定额外平局规则。四个原样例全部保留。原文返回描述及starter均明确long二维数组，完整范围的总击数可超过32位，本站按64位处理。旧blocked所称锤子耐久与操作顺序缺失不符合固定raw：这里只有大锤最多使用次数，未定义任何耐久衰减。原例2说明中一处把大锤下标误写为[3,5,7]，但同例正式输出及说明末尾均为[3,5,6,7]且总击数13一致，本站保留正确完整列表并披露这一漏字。算法数学核心复用本站已验证的同规则实现，但本题独立绑定Wayfair来源、使用新种子与新动态规划oracle重新生成全部数据。未执行上游代码。

## 思路

先假设所有砖均用小锤，总击数为Σstrength[i]。把第i块改用大锤，只需1次，节省strength[i]−1次。选至多k个最大正节省即可；参考程序只选择强度大于1的砖，将它们按强度降序排列后取前k块，最后把两组下标分别按原顺序输出。强度1节省0，参考程序不选它，但选择或不选择都可能最优，语义判题接受所有等价分组。

## 正确性证明

任何最优策略不需要先用若干小锤再用大锤击碎同一块砖：删掉先前的小锤击打后，大锤仍然一次击碎，费用更低。重复用大锤击碎同一块砖也没有意义。因此存在最优策略将每块砖完整分配给一种锤。若分给大锤成本为1，否则为其原强度，各块成本相加，最多k块分给大锤。

对任意选中集合，若其中一块节省小于某块未选中的节省，交换两者保持大锤次数且降低总击数。故最大化总节省时应优先选最大节省。有剩余额度时加入任何正节省都会严格改善费用，直到额度用完或正节省全被选择；唯一可能为0的节省则选不选都不改变费用。参考选择因此达到全局最少总击数。输出两组是全部下标的互斥划分，且分别按下标遍历生成，符合升序与1-based要求。

## 复杂度与完整边界

排序O(n log n)，生成分组O(n)，空间O(n)。最大合法互异强度和为200000×(2×10^9−200000+1)/2=199980000100000，应使用64位整数；Python整数安全。算法不逐次模拟击打，所以强度10^9与二十万砖均可直接处理。

## 独立验证与语义判题

小oracle逐砖做额度动态规划，状态是已处理前缀及已用大锤次数，分别转移小锤strength[i]费用与大锤1费用，保留最优分组见证；不使用排序收益公式，也不读取其他题的期望文件。163个唯一输入均经真实参考子进程，结果按总费用及分组合法性检查，不与oracle索引序列逐token比较。

checker要求严格三行，验证升序下标、互斥完整分区、额度与费用，再比较最优总值。特别地n=1,k=1,strength=[1]时，“1 / 1 / -1”与“1 / -1 / 1”均应通过；对完整1..200000且k=200000也覆盖将强度1交给不同锤的两份最优见证。完整大边界包含k=0、k=n、k>n、半额度、乱序及64位总值。两个负控分别选最弱砖和用32位溢出总费用，均须正常退出才计为有效反例。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(k, a):
    return f'{len(a)} {k}\n' + ' '.join(map(str, a)) + '\n'


def witness(a, big):
    big = sorted(big)
    chosen = set(big)
    small = [i for i in range(1, len(a) + 1) if i not in chosen]
    total = len(big) + sum(a[i - 1] for i in small)
    return str(total) + '\n' + (' '.join(map(str, big)) if big else '-1') + '\n' + (' '.join(map(str, small)) if small else '-1') + '\n'


def oracle(k, a):
    limit = min(k, len(a))
    states = {0: (0, ())}
    for index, strength in enumerate(a, 1):
        following = {}
        for used, (cost, selected) in states.items():
            options = [(used, cost + strength, selected)]
            if used < limit:
                options.append((used + 1, cost + 1, selected + (index,)))
            for count, candidate, group in options:
                if count not in following or candidate < following[count][0]:
                    following[count] = (candidate, group)
        states = following
    best, selected = min(states.values(), key=lambda entry: entry[0])
    result = witness(a, selected)
    assert int(result.splitlines()[0]) == best
    return result


def valid(actual, expected, k, a):
    lines = actual.strip('\n').splitlines()
    if len(lines) != 3:
        return False
    try:
        if len(lines[0].split()) != 1:
            return False
        cost = int(lines[0])
        groups = [[int(x) for x in line.split()] for line in lines[1:]]
    except ValueError:
        return False
    for i, group in enumerate(groups):
        if group == [-1]:
            groups[i] = []
        elif not group or any(x < 1 or x > len(a) for x in group) or any(x >= y for x, y in zip(group, group[1:])):
            return False
    big, small = groups
    return (len(big) <= k and sorted(big + small) == list(range(1, len(a) + 1))
            and cost == len(big) + sum(a[i - 1] for i in small)
            and cost == int(expected.splitlines()[0]))


def run(path, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw, text=True, capture_output=True, check=True, timeout=15)
    assert not result.stderr
    return result.stdout, time.perf_counter() - started


def main():
    started = time.perf_counter()
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{RAW_PATH}'], cwd=ROOT)
    assert sha(raw) == RAW_SHA
    assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == BLOB
    old = next(x for x in json.loads((OA / 'coverage.json').read_text())['items'] if x['id'] == PID)
    public = [(0, [2], '2\n-1\n1\n'), (4, [3, 2, 5, 4, 6, 7, 9], '13\n3 5 6 7\n1 2 4\n'),
              (9, [7, 9, 3, 2, 5, 8, 4, 6], '8\n1 2 3 4 5 6 7 8\n-1\n'),
              (0, [10000000, 100000000, 1000000000], '1110000000\n-1\n1 2 3\n')]
    specs = [(k, a) for k, a, _ in public]
    specs += [(1, [1]), (0, [1]), (200000, [1]), (2, [1, 9]), (1, [1, 9]), (0, [1000000000]), (200000, [1000000000])]
    keys = {encode(k, a) for k, a in specs}
    rng = random.Random(SEED)
    while len(specs) < 163:
        n = rng.randint(1, 8)
        a = rng.sample(range(1, 40), n)
        k = rng.randint(0, n + 3)
        text = encode(k, a)
        if text not in keys:
            keys.add(text)
            specs.append((k, a))
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for i, (k, a) in enumerate(specs):
        expected = oracle(k, a)
        if i < 4:
            assert valid(public[i][2], expected, k, a)
            expected = public[i][2]
        text = encode(k, a)
        assert valid(run(refpath, text)[0], expected, k, a)
        oracles.append({'input': text, 'expectedOutput': expected})
    print(f'{PID}: 163 unique quota-DP oracle subprocess checks passed', flush=True)
    formal = [(f'原始样例{i+1}' if i < 4 else f'独立额度动态规划{i-3}', k, a, oracles[i]['expectedOutput']) for i, (k, a) in enumerate(specs[:36])]
    n = 200000
    high = list(range(1000000000 - n + 1, 1000000001))
    shuffled = high.copy()
    rng.shuffle(shuffled)
    low = list(range(1, n + 1))
    additions = [
        ('完整64位总值零额度', 0, high, []),
        ('完整全大锤', n, high, range(1, n + 1)),
        ('完整半额度逆序', n // 2, high[::-1], range(1, n // 2 + 1)),
        ('完整半额度乱序', n // 2, shuffled, [i + 1 for i, x in enumerate(shuffled) if x > 999900000]),
        ('完整低值含一全额度', n, low, range(2, n + 1)),
        ('完整低值含一少一额度', n - 1, low, range(2, n + 1)),
        ('额度大于砖数', n, high[:-1], range(1, n)),
        ('完整仅一次大锤', 1, high, [n]),
    ]
    for name, k, a, big in additions:
        formal.append((name, k, a, witness(a, big)))
    assert int(formal[36][3].splitlines()[0]) == 199980000100000
    # Both allowed zero-saving choices, without changing input or optimum.
    alternate = [{'input': encode(1, [1]), 'expectedOutput': '1\n1\n-1\n'},
                 {'input': encode(1, [1]), 'expectedOutput': '1\n-1\n1\n'},
                 {'input': encode(n, low), 'expectedOutput': witness(low, range(1, n + 1))},
                 {'input': encode(n, low), 'expectedOutput': witness(low, range(2, n + 1))}]
    cases, evidence = [], []
    for i, (name, k, a, expected) in enumerate(formal):
        text = encode(k, a)
        actual, elapsed = run(refpath, text)
        assert valid(actual, expected, k, a), name
        cases.append({'name': name, 'input': text, 'expectedOutput': expected, 'hidden': i >= 4, 'weight': 1})
        if i >= 36:
            evidence.append({'name': name, 'n': len(a), 'k': k, 'inputBytes': len(text.encode()), 'optimalTotal': expected.splitlines()[0], 'localSeconds': round(elapsed, 4)})
    assert len({c['input'] for c in cases}) == len(cases)
    killed = []
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA / f'negative-controls/{PID}-{i}.py'
        path.write_text(mutant['code'])
        rejected = [j for j, (_, k, a, expected) in enumerate(formal) if not valid(run(path, encode(k, a))[0], expected, k, a)]
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    checker = "import{morganBricks}from'./lib/oa-morgan-bricks-checker.mjs';let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{for(const c of JSON.parse(s))if(!morganBricks(c.expectedOutput,'',c.input))throw Error('witness rejected');console.log('semantic witnesses accepted')});"
    subprocess.run(['node', '--input-type=module', '-e', checker], cwd=ROOT, input=json.dumps(oracles + cases + alternate), text=True, check=True)
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '用两种锤子击碎全部砖块的最少击数', 'difficulty': '中等', 'tags': ['OA', 'Wayfair', '贪心', '排序'],
        'description': 'n块砖的下标从1到n，互不相同的正整数strength[i]表示每块砖需承受的击打强度。大锤一次就能击碎任意砖，最多使用k次；小锤每次使所需强度减少1，因此单用小锤击碎该砖需要strength[i]次。求击碎全部砖的最少总击数，并给出分别由两种锤击碎的砖下标。每块砖归入一种锤的组。返回任意最优分组；强度1用哪一种锤都可，只要满足额度且总击数最优。',
        'input': '第一行n和k。第二行n个互不相同的整数strength[i]。1≤n≤200000，0≤k≤200000，1≤strength[i]≤1000000000。k可以大于n。完整保留原题范围和互异保证。',
        'output': '严格输出三行。第一行最少总击数，可能超过32位。第二行大锤组的1-based下标，严格升序；未使用大锤则为-1。第三行小锤组的1-based下标，严格升序；未使用小锤则为-1。两组须互斥并覆盖全部砖，大锤组大小不超过k。不输出方括号或组大小。此为原二维返回数组的逐行序列化。',
        'explanation': '四个公开样例全部来自原题。样例1没有大锤额度，击打2次。样例2用大锤击碎第3、5、6、7块，其余小锤费用3+2+4=9，共13次。样例3额度9大于砖数8，可全部用大锤，总8次。样例4无大锤，总击数1110000000。',
        'hints': ['将一块砖从小锤改为大锤能节省多少次？', '优先使用最大节省。', '强度1的节省为零，不应强制一种平局输出。'],
        'timeLimit': 3, 'memoryLimit': 262144, 'outputLimit': 4096, 'checker': 'oa-wayfair-bricks', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '按每块砖节省的击数选择大锤', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': RAW_PATH, 'gitBlobSha': BLOB, 'rawSha256': RAW_SHA, 'upstreamCodeExecuted': False, 'siteAdded': '原返回二维数组逐行序列化，四原例保留；专用checker接受强度1的全部最优分组，不添加平局规则。总值按原范围及long返回描述用64位。', 'recoveredConstraints': ['1 <= n <= 200000', '0 <= bigHits <= 200000', '1 <= strength[i] <= 1000000000', 'all strengths are distinct'], 'correction': 'raw defines an ordinary maximum-use quota, not hammer durability; explicit distinct values and long[][] return are preserved. Example2 prose omitted index6 once; formal output and final explanation retain it.'}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '固定raw明确大锤使用上限而非耐久衰减、强度互异及4原例；语义checker接受强度1并列最优，独立逐砖额度DP与全新种子、完整20万边界通过。仅候选待沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 4, 'hiddenCases': len(cases) - 4, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Prefix/quota dynamic programming with independent small/big cost transitions and witness reconstruction; no sorting/greedy formula and no imported expected outputs.', 'alternateOptimalWitnessesChecked': len(alternate), 'largeBoundaries': evidence, 'semanticValidation': True, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter() - started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 4 original samples and 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()

