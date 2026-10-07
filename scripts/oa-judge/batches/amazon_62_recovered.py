"""Amazon62 local-only candidate with exhaustive actual-swap BFS verification."""

from collections import deque
from itertools import permutations
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-amazon-62'
BATCH = 'amazon-62-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SOURCE_PATH = 'web/content/docs/companies/amazon.mdx'
BLOB = '70650fad830ad60944ae8036fb4f134d9afc3fab'
SOURCE_HASH = 'efd7075ae1aa54ecc5720b5de538157d2a432180d75aabb7ad10e989513115c2'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    n = next(tokens)
    answer = None
    for index in range(n):
        value = next(tokens)
        if index != value:
            answer = value if answer is None else answer & value
    return str(0 if answer is None else answer)

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
'''
MUTANTS = [
    {'name': '将正确位置的零也参与AND', 'code': REFERENCE.replace('if index != value:', 'if True:')},
    {'name': '错将错位值AND写成OR', 'code': REFERENCE.replace('answer & value', 'answer | value')},
]


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def encode(arr):
    return f'{len(arr)}\n' + ' '.join(map(str, arr)) + '\n'


def reachable(n, k):
    """Enumerate actual permutation states reachable by legal position swaps."""
    goal = tuple(range(n))
    seen, queue = {goal}, deque([goal])
    while queue:
        arr = queue.popleft()
        for i in range(n):
            for j in range(i + 1, n):
                if (arr[i] & arr[j]) != k:
                    continue
                nxt = list(arr)
                nxt[i], nxt[j] = nxt[j], nxt[i]
                nxt = tuple(nxt)
                if nxt not in seen:
                    seen.add(nxt)
                    queue.append(nxt)
    return seen


def components(n, k):
    """Independent pairwise value graph; no AND reduction of misplaced values."""
    graph = [[] for _ in range(n)]
    for u in range(n):
        for v in range(u + 1, n):
            if (u & v) == k:
                graph[u].append(v)
                graph[v].append(u)
    labels = [-1] * n
    for start in range(n):
        if labels[start] != -1:
            continue
        labels[start] = start
        stack = [start]
        while stack:
            u = stack.pop()
            for v in graph[u]:
                if labels[v] == -1:
                    labels[v] = start
                    stack.append(v)
    return labels


def construct(arr, k):
    """Actually sort by pivot swaps, checking AND==k and pivot restoration."""
    arr = list(arr)
    positions = [0] * len(arr)
    for i, value in enumerate(arr):
        positions[value] = i
    count = 0
    def exchange(a, b):
        nonlocal count
        assert a != b and (a & b) == k
        i, j = positions[a], positions[b]
        arr[i], arr[j] = arr[j], arr[i]
        positions[a], positions[b] = j, i
        count += 1
    for i in range(len(arr)):
        if arr[i] == i:
            continue
        a, b = arr[i], i
        if a == k or b == k:
            exchange(a, b)
        else:
            old = positions[k]
            exchange(k, a)
            exchange(k, b)
            exchange(k, a)
            assert positions[k] == old
        assert arr[i] == i
    assert arr == list(range(len(arr))) and count <= 3 * len(arr)
    return count


def run(code, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-c', code], input=raw, text=True, capture_output=True, timeout=15)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip(), round(time.perf_counter() - started, 4)


def main():
    assert not (OA / 'batches' / f'{BATCH}.json').exists(), 'already promoted'
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == SOURCE_HASH
    upstream = '/private/tmp/oa-master-readonly'
    snapshot = subprocess.check_output(['git', 'show', f'{COMMIT}:{SOURCE_PATH}'], cwd=upstream)
    blob = subprocess.check_output(['git', 'rev-parse', f'{COMMIT}:{SOURCE_PATH}'], cwd=upstream, text=True).strip()
    assert blob == BLOB
    section = snapshot.decode().split('## 62. Get Sorting Factor K\n', 1)[1].split('\n## 63.', 1)[0]
    for marker in ('permutation of `[0..n-1]`', '(arr[i] & arr[j]) == k', '1 ≤ n ≤ 10⁵', '已有序则返回 0'):
        assert marker in section
    assert {x['language'] for x in source['solutions']} == {'python', 'java', 'cpp'}
    for solution in source['solutions']:
        assert solution['code'].strip() in section
    assert 'return 0' in source['solutions'][0]['code']
    assert all('? 0 : k' in x['code'] for x in source['solutions'][1:])
    previous = next(x for x in json.loads((OA / 'reviews/amazon-remaining-c.json').read_text())['items'] if x['id'] == PID)
    scope = {'__name__': 'candidate'}
    exec(compile(REFERENCE, '<independently-authored-reference>', 'exec'), scope)
    solve = scope['solve']
    expected_by_arr = {}
    exhaustive_rows = []
    for n in range(1, 8):
        sets = [reachable(n, k) for k in range(n)]
        labels = [components(n, k) for k in range(n)]
        checked = 0
        for arr in permutations(range(n)):
            if arr == tuple(range(n)):
                expected = graph_expected = 0
            else:
                expected = max(k for k in range(n) if arr in sets[k])
                graph_expected = max(k for k in range(n) if all(labels[k][i] == labels[k][v] for i, v in enumerate(arr)))
            assert expected == graph_expected == int(solve(encode(arr)))
            construct(arr, expected)
            expected_by_arr[arr] = expected
            checked += 1
        exhaustive_rows.append({'n': n, 'permutations': checked, 'actualSwapBfsStates': sum(map(len, sets)), 'passed': checked})
    assert len(expected_by_arr) == 5913
    public = [('原题样例', (0, 3, 2, 1)), ('本站样例：已有序按约定返回零', (0, 1, 2, 3)), ('本站样例：零值错位', (1, 0, 2))]
    selected = dict((arr, expected_by_arr[arr]) for _, arr in public)
    # Fixed pivot stays in place while values 3 and 5 require bridging via 1.
    for arr in ((0,), (0, 1, 2, 5, 4, 3), (0, 1, 2, 3, 4, 7, 6, 5)):
        if len(arr) <= 7:
            selected[arr] = expected_by_arr[arr]
    pool = list(expected_by_arr)
    random.Random(SEED).shuffle(pool)
    for arr in pool:
        selected.setdefault(arr, expected_by_arr[arr])
        if len(selected) == 163:
            break
    cases = []
    for name, arr in public:
        cases.append({'name': name, 'input': encode(arr), 'expectedOutput': f'{selected[arr]}\n', 'hidden': False, 'weight': 1})
    for i, (arr, expected) in enumerate(list(selected.items())[3:32]):
        cases.append({'name': f'独立BFS对照 {i+1}', 'input': encode(arr), 'expectedOutput': f'{expected}\n', 'hidden': True, 'weight': 1})
    oracle_times = []
    for arr, expected in selected.items():
        actual, elapsed = run(REFERENCE, encode(arr))
        assert actual == str(expected)
        oracle_times.append(elapsed)
    n = 100000
    identity = list(range(n))
    two = identity.copy()
    two[-2], two[-1] = two[-1], two[-2]
    high = identity.copy()
    high[65537:] = high[65538:] + high[65537:65538]
    rng = random.Random(SEED)
    shuffled = identity.copy()
    rng.shuffle(shuffled)
    if shuffled[0] == 0:
        shuffled[0], shuffled[1] = shuffled[1], shuffled[0]
    boundaries = [('最大规模已有序', identity, 0), ('最大规模逆序', identity[::-1], 0), ('最大规模全循环', identity[1:]+identity[:1], 0), ('只交换最大两值', two, 99998), ('高位域循环且pivot固定', high, 65536), ('最大规模随机且零错位', shuffled, 0)]
    large_results = []
    for name, arr, expected in boundaries:
        raw = encode(arr)
        actual, elapsed = run(REFERENCE, raw)
        assert actual == str(expected)
        swaps = construct(arr, expected)
        cases.append({'name': name, 'input': raw, 'expectedOutput': f'{expected}\n', 'hidden': True, 'weight': 1})
        large_results.append({'name': name, 'n': n, 'inputBytes': len(raw), 'expectedOutput': str(expected), 'wallSeconds': elapsed, 'verifiedLegalSwaps': swaps, 'exitCode': 0})
    killed = []
    for mutant in MUTANTS:
        rejected = []
        for case in cases[:32]:
            actual, _ = run(mutant['code'], case['input'])
            if actual != case['expectedOutput'].strip():
                rejected.append(case['name'])
                break
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'exitCode': 0})
    editorial = '''## 已排序输入的明确约定

原题正文要求最大非负 k，但对于已有序排列，零次交换对任意非负 k 都合法，数学上不存在有限最大值。固定来源的解释和 Python、Java、C++ 三种实现均明确返回 0，本站据此采用「已有序时返回 0」约定；不能将其说成由正文自然推出的最大值。以下最大值证明只针对尚未排序的排列。

## 算法

遍历排列，找出所有 arr[i]≠i 的值，逐个按位 AND。无错位值则按约定输出 0。记非空错位集合的 AND 为 A，答案为 A。

## 必要性：任何可行 k 都不超过 A

每个最初错位的值 v 在完成排序前至少要参与一次交换。合法交换满足 v&w=k，所以 k 的所有置位都出现在 v 中。对每个错位值都成立，故 k 是 A 的子掩码，从而 k≤A。

## 充分性：域内 pivot 可桥接并恢复

由 0≤A≤任意错位值<n，A 本身属于 [0,n−1]；排列中必有值为 A 的节点，称为 pivot。对每个错位值 v 都有 v&A=A，因此 v 与 pivot 可合法交换。排序可分解为错位值之间的交换：若交换 a、b 之一是 pivot，直接交换；否则依次交换值对 (A,a)、(A,b)、(A,a)。三步都满足按位 AND 恰为 A，净效果只交换 a、b，并将 pivot 恢复原位置。因此即使 pivot 最初位于正确位置也没有问题；其他已正确位置的值不必参与。逐步修正错位位置即可完成排序，证明 A 可行。结合上界，A 为最大答案。

## 复杂度与独立验证

算法时间 O(n)，除输入解析外额外空间 O(1)。完整保留 n≤100000 和 0..n−1 的排列域。生成器对 n=1..7 的全部5913个排列，针对每个k构造值图并通过实际合法交换的排列状态BFS独立求可达性，同时逐次验证pivot交换构造；独立oracle不使用错位值AND公式。大边界包括有序、逆序、全循环、近上界答案99998及固定pivot65536的高位域循环。值0位于错误位置时，参与交换必使k=0；最大两值只有一个置位不同，最大可行值99998；高位域包含65537和65538，其共同位仅65536，该值可连接域内所有值。
'''
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '按位与交换的最大排序因子', 'difficulty': '中等', 'tags': ['OA', 'Amazon', '位运算', '排列'],
        'description': '给定0到n−1的一个排列arr。选择非负整数k后，只允许交换两个满足(arr[i] & arr[j]) == k的元素，&表示按位与；k在整个排序过程中固定。若排列尚未有序，求可以将其排序为0,1,…,n−1的最大k。本站明确：若输入已经有序则返回0，此约定依据固定来源解释及Python、Java、C++三种实现的一致行为。已有序时零次交换对任意非负k均合法，原字面问题不存在有限最大值；返回0是约定而不是数学最大值。',
        'input': '第一行n；第二行n个整数arr[i]。1≤n≤100000，arr恰好是0到n−1的排列。标准输入输出为本站包装，完整保留原约束。',
        'output': '尚未有序时输出可完成排序的最大非负k；已有序时按明确约定输出0。',
        'explanation': '原题样例[0,3,2,1]中3&1=1，交换这两个值即可排序，答案1。第二例已经有序，按约定输出0；第三例零值错位，必须有涉及0的交换，答案只能为0。后两例为本站补充。',
        'hints': ['每个错位值至少必须参与一次合法交换。', '所有错位值的AND本身也是排列域内的一个值，可作为交换pivot。'],
        'timeLimit': 2, 'memoryLimit': 262144, 'outputLimit': 4096, 'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    authored = [{'language': 'python', 'code': REFERENCE}]
    put('packages', f'{PID}.json', json.loads(normalized))
    (OA / 'references' / f'{PID}.py').write_text(REFERENCE)
    put('editorials', f'{PID}.json', {'schemaVersion': 1, 'id': PID, 'title': package['problem']['title'], 'explanation': editorial, 'solutions': authored, 'sourceUrl': source['sourceUrl'], 'sourceContentHash': SOURCE_HASH})
    put('oracles', f'{PID}.json', [{'input': encode(arr), 'expectedOutput': f'{expected}\n'} for arr, expected in selected.items()])
    put('mutants', f'{PID}.json', MUTANTS)
    for i, mutant in enumerate(MUTANTS, 1):
        (OA / 'negative-controls' / f'{PID}-{i}.py').write_text(mutant['code'])
    put('candidate-batches', f'{BATCH}.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': SOURCE_HASH, 'packageChecksum': sha(normalized), 'editorial': editorial, 'authoredSolutions': authored}]})
    put('source-evidence', f'{BATCH}.json', {'schemaVersion': 1, 'sourceCommit': COMMIT, 'items': [{'id': PID, 'sourcePath': SOURCE_PATH, 'gitBlob': blob, 'sourceSha256': sha(snapshot), 'sectionSha256': sha(section), 'sourceContentHash': SOURCE_HASH, 'sourceUrl': source['sourceUrl'], 'sourceImplementations': [{'language': x['language'], 'sha256': sha(x['code']), 'behavior': 'already sorted returns zero'} for x in source['solutions']], 'siteAdditions': ['已有序返回0：依据来源解释及三语言源码，明示为约定而非数学最大值', '标准输入输出与两个补充公开样例'], 'upstreamCodeExecuted': False}]})
    put('resolutions', f'{BATCH}.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': SOURCE_HASH, 'previousReason': previous['reason'], 'reason': '固定来源解释及Python/Java/C++一致返回0，本站明确补充已有序返回0约定并解释其并非无界最大值。完整保留排列域与n上限。5913全排列实际交换BFS/值图可达性及构造对照、163唯一子进程oracle和两个正常退出错误程序通过，仅候选待沙箱。'}]})
    put('validation', f'{BATCH}.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': len(selected), 'uniqueOracleInputs': len(selected), 'publicCases': 3, 'hiddenCases': len(cases)-3, 'formalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': '对每个k实际交换BFS，另建完整值图验证连通性；不使用错位AND公式计算独立期望值', 'exhaustivePermutationCases': len(expected_by_arr), 'exhaustiveResults': exhaustive_rows, 'oracleMaxWallSeconds': max(oracle_times), 'largeBoundaries': large_results}], 'note': '163唯一输入与6大边界均实际Python子进程stdin/stdout验证，全部5913小排列另做同一参考函数、BFS、值图和逐步合法交换构造对拍。两个mutant正常退出并被拒；未运行GoJudge或发布。'})
    print(json.dumps({'id': PID, 'oracleCases': len(selected), 'exhaustivePermutations': len(expected_by_arr), 'formalCases': len(cases), 'boundaries': large_results}, ensure_ascii=False))


if __name__ == '__main__':
    main()
