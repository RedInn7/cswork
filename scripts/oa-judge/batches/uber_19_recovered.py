"""Build Uber19 candidate only. Independently authored iterative DP and oracle."""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-uber-19'
BATCH = 'uber-19-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SOURCE_PATH = 'fastprep/Uber/uber-binary-tree-subtree-sum-maximum-path-and-path-nodes.md'
SOURCE_HASH = '084488a45c37b931cf283834c1eac94aa5ce7cf28afd82a743302c3acbadf638'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    values = [next(it) for _ in range(n)]
    children = [(next(it), next(it)) for _ in range(n)]
    order = [0]
    for u in order:
        left, right = children[u]
        if left != -1:
            order.append(left)
        if right != -1:
            order.append(right)
    gain = [0] * n
    direction = [-1] * n
    best = None
    center = 0
    for u in reversed(order):
        left, right = children[u]
        lg = gain[left] if left != -1 and gain[left] > 0 else 0
        rg = gain[right] if right != -1 and gain[right] > 0 else 0
        through = values[u] + lg + rg
        if best is None or through > best:
            best, center = through, u
        if lg >= rg and lg > 0:
            direction[u] = left
            gain[u] = values[u] + lg
        elif rg > 0:
            direction[u] = right
            gain[u] = values[u] + rg
        else:
            gain[u] = values[u]
    left, right = children[center]
    path = []
    if left != -1 and gain[left] > 0:
        u = left
        while u != -1:
            path.append(u)
            u = direction[u]
    path.reverse()
    path.append(center)
    if right != -1 and gain[right] > 0:
        u = right
        while u != -1:
            path.append(u)
            u = direction[u]
    return (str(sum(values)) + '\\n' + str(best) + '\\n'
            + ' '.join(str(values[u]) for u in path) + '\\n'
            + ' '.join(map(str, path)) + '\\n')

if __name__ == '__main__':
    sys.stdout.write(solve(sys.stdin.buffer.read()))
'''

MUTANTS = [
    {'name': '只考虑经过根节点的路径', 'code': REFERENCE.replace('if best is None or through > best:', 'if u == 0:')},
    {'name': '全负树错误允许空路径', 'code': REFERENCE.replace('    order = [0]', "    if max(values) < 0:\n        return str(sum(values)) + '\\n0\\n\\n\\n'\n    order = [0]")},
]


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, data):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def encode(values, children):
    return f'{len(values)}\n' + ' '.join(map(str, values)) + '\n' + ''.join(f'{a} {b}\n' for a, b in children)


def decode(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    return [next(it) for _ in range(n)], [(next(it), next(it)) for _ in range(n)]


def output(values, score, path):
    return f'{sum(values)}\n{score}\n' + ' '.join(str(values[u]) for u in path) + '\n' + ' '.join(map(str, path)) + '\n'


def adjacency(children):
    graph = [[] for _ in children]
    for u, pair in enumerate(children):
        for v in pair:
            if v != -1:
                graph[u].append(v)
                graph[v].append(u)
    return graph


def oracle(values, children):
    """Independent exhaustive endpoint search with small-tree path copies; no DP."""
    graph = adjacency(children)
    best, best_path = None, None
    for start in range(len(values)):
        stack = [(start, -1, values[start], [start])]
        while stack:
            u, previous, score, path = stack.pop()
            if best is None or score > best:
                best, best_path = score, path
            for v in graph[u]:
                if v != previous:
                    stack.append((v, u, score + values[v], path + [v]))
    return output(values, best, best_path)


def check(values, children, actual, expected):
    """Semantic verification independent of both algorithms; any optimum accepted."""
    lines = actual.splitlines()
    assert len(lines) == 4
    total, score = int(lines[0]), int(lines[1])
    path_values, path = list(map(int, lines[2].split())), list(map(int, lines[3].split()))
    assert total == sum(values) and score == int(expected.splitlines()[1])
    assert path and len(path) == len(set(path)) and len(path_values) == len(path)
    assert all(0 <= u < len(values) for u in path)
    assert path_values == [values[u] for u in path] and sum(path_values) == score
    for u, v in zip(path, path[1:]):
        assert v in children[u] or u in children[v]


def run(code, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-c', code], input=raw, text=True, capture_output=True, timeout=20)
    assert result.returncode == 0, result.stderr
    return result.stdout, round(time.perf_counter() - started, 4)


def random_tree(rng):
    n = rng.randint(1, 24)
    values = [rng.choice([-10**9, -9, -3, -1, 0, 0, 1, 3, 9, 10**9]) for _ in range(n)]
    children = [[-1, -1] for _ in range(n)]
    slots = [(0, 0), (0, 1)]
    for child in range(1, n):
        parent, side = slots.pop(rng.randrange(len(slots)))
        children[parent][side] = child
        slots.extend([(child, 0), (child, 1)])
    labels = list(range(1, n))
    rng.shuffle(labels)
    labels = [0] + labels
    shuffled_values = [0] * n
    shuffled_children = [[-1, -1] for _ in range(n)]
    for u in range(n):
        shuffled_values[labels[u]] = values[u]
        shuffled_children[labels[u]] = [labels[v] if v != -1 else -1 for v in children[u]]
    return shuffled_values, shuffled_children


def diameter_path(children):
    """Independent two-sweep unweighted tree diameter; for all-one large tree."""
    graph = adjacency(children)
    def farthest(start):
        parent = [-1] * len(graph)
        best = (0, start)
        stack = [(start, -1, 0)]
        while stack:
            u, p, depth = stack.pop()
            parent[u] = p
            best = max(best, (depth, u))
            for v in graph[u]:
                if v != p:
                    stack.append((v, u, depth + 1))
        return best[1], parent
    endpoint, _ = farthest(0)
    other, parent = farthest(endpoint)
    path = []
    while other != -1:
        path.append(other)
        other = parent[other]
    return path


def main():
    assert not (OA / 'batches' / f'{BATCH}.json').exists(), 'already promoted'
    catalog = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert catalog['contentHash'] == SOURCE_HASH
    source = subprocess.check_output(['git', 'show', f'{COMMIT}:{SOURCE_PATH}'], cwd='/private/tmp/oa-master-readonly')
    source_text = source.decode()
    for marker in ('1 <= n <= 2 * 10^5', '-10^9 <= values[i] <= 10^9', 'Node <code>0</code> is the root', 'String[]', 'one maximum path'):
        assert marker in source_text
    blob = subprocess.check_output(['git', 'rev-parse', f'{COMMIT}:{SOURCE_PATH}'], cwd='/private/tmp/oa-master-readonly', text=True).strip()
    prior = next(x for x in json.loads((OA / 'reviews/uber-first.json').read_text())['items'] if x['id'] == PID)
    public = [
        ('原题样例并补充ID见证', [1, 2, 3], [(1, 2), (-1, -1), (-1, -1)]),
        ('本站样例：全负且最优不经过根', [-8, -2, -3], [(1, 2), (-1, -1), (-1, -1)]),
        ('本站样例：重复值与多个最优路径', [0, 0, 0], [(1, 2), (-1, -1), (-1, -1)]),
    ]
    small = {}
    cases = []
    for name, values, children in public:
        raw = encode(values, children)
        expected = oracle(values, children)
        small[raw] = expected
        cases.append({'name': name, 'input': raw, 'expectedOutput': expected, 'hidden': False, 'weight': 1})
    fixed = [([-10**9], [(-1, -1)]), ([10**9], [(-1, -1)]), ([0], [(-1, -1)]), ([-100, 5, 6, 7], [(1, -1), (2, 3), (-1, -1), (-1, -1)]), ([5, -100, 5, 5], [(1, 2), (3, -1), (-1, -1), (-1, -1)])]
    for values, children in fixed:
        small[encode(values, children)] = oracle(values, children)
    rng = random.Random(SEED)
    while len(small) < 163:
        values, children = random_tree(rng)
        small[encode(values, children)] = oracle(values, children)
    for i, (raw, expected) in enumerate(list(small.items())[3:31]):
        cases.append({'name': f'独立全端点 {i+1}', 'input': raw, 'expectedOutput': expected, 'hidden': True, 'weight': 1})
    timings = []
    for raw, expected in small.items():
        values, children = decode(raw)
        actual, elapsed = run(REFERENCE, raw)
        check(values, children, actual, expected)
        timings.append(elapsed)
    n = 200000
    chain = [(u+1, -1) if u+1<n else (-1, -1) for u in range(n)]
    complete = [(2*u+1 if 2*u+1<n else -1, 2*u+2 if 2*u+2<n else -1) for u in range(n)]
    diameter = diameter_path(complete)
    boundaries = [
        ('20万节点正上界链和最长输出', [10**9]*n, chain, n*10**9, list(range(n))),
        ('20万节点全负下界链', [-10**9]*n, chain, -10**9, [n-1]),
        ('20万节点全零链', [0]*n, chain, 0, [0]),
        ('20万节点重复正上界完全二叉树', [10**9]*n, complete, len(diameter)*10**9, diameter),
        ('20万节点全负完全二叉树', [-1]*n, complete, -1, [0]),
        ('20万节点全零完全二叉树', [0]*n, complete, 0, [0]),
    ]
    boundary_results = []
    for name, values, children, score, ids in boundaries:
        raw, expected = encode(values, children), output(values, score, ids)
        actual, elapsed = run(REFERENCE, raw)
        check(values, children, actual, expected)
        cases.append({'name': name, 'input': raw, 'expectedOutput': expected, 'hidden': True, 'weight': 1})
        boundary_results.append({'name': name, 'n': n, 'inputBytes': len(raw.encode()), 'outputBytes': len(actual.encode()), 'maximumPathSum': score, 'wallSeconds': elapsed, 'exitCode': 0})
    killed = []
    for mutant in MUTANTS:
        rejects = []
        for case in cases[:31]:
            actual, _ = run(mutant['code'], case['input'])
            try:
                check(*decode(case['input']), actual, case['expectedOutput'])
            except (AssertionError, ValueError):
                rejects.append(case['name'])
                break
        assert rejects, mutant['name']
        killed.append({'name': mutant['name'], 'rejectedByCases': rejects, 'exitCode': 0})
    editorial_text = '''## 来源与本站扩展

固定来源原题要求返回三个结果：全树节点值之和、最大路径和、达到该和的一条值路径。根为 0，输入是有效二叉树，允许负数、零和重复值。本站保留这三个结果，并增加第四行 0-based 节点 ID 路径作为见证；第四行是本站评测协议扩展，不是原题要求。路径至少一个节点，不重复节点；任何最优路径及其反向均接受，不要求与样例逐字相同。零收益分支可选可不选，只要最终路径合法且达到最优。原样例前三项保持不变，其余公开样例为本站补充。

## 迭代树形动态规划

先从根迭代遍历并记录顺序，反向处理即保证孩子先于父节点。gain[u] 表示从 u 出发向下沿一条链可取得的最大和。每个孩子负收益或零收益时都可不选；gain[u] = values[u] + max(0,gain[left],gain[right])。以 u 为最高节点的路径可以同时连接两个正收益分支，候选为 values[u]+max(0,gain[left])+max(0,gain[right])。从所有节点的候选中选择最大值，记录其中心。

每个节点只保存一个最优向下孩子 ID，不保存整条路径。最后从最优中心向两侧分别沿方向走，左侧反转后接中心再接右侧，一次性重建。全负树的最优和初始化为未设定而不是 0，因此不会错误选择空路径。节点编号不保证拓扑排序，不能直接按 ID 倒序代替遍历。

## 正确性证明

叶节点的 gain 是自身值。假定孩子的 gain 正确，从 u 向下的简单路径只能选择最多一个孩子分支，且非正分支不会提高和，因此递推给出正确的最大向下路径。任意非空简单路径有唯一最高节点 u，其两侧分别位于 u 的两个孩子子树，故它的和不超过 u 的候选；反过来两个正收益向下路径与 u 拼接是合法简单路径，恰好实现该候选。取所有中心的最大候选即得到全局最优和。记录的方向实现各 gain，重建在互不相交的两子树与中心间连接，不会重复节点，值路径和 ID 一一对应。

## 复杂度与范围

时间 O(n)，空间 O(n)，输出 O(k)，k≤n。无递归，不会因 20 万节点链导致递归溢出；避免每个节点复制路径所造成的二次复杂度。n≤200000，值在 [-10^9,10^9]，全树和及路径和可达到 ±2×10^14，需要 64 位整数。完整保留原始约束；本站单个测试输入上限 32 MiB，输出预算单独配置。
'''
    package = {'schemaVersion': 1, 'problem': {
        'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '二叉树最大路径和及路径见证', 'difficulty': '困难',
        'tags': ['OA', 'Uber', '树形动态规划', '路径重建'],
        'description': '给定根节点为0的有效二叉树，计算全树所有节点值之和、任意两个节点之间的最大非空简单路径和，并输出一条达到最大和的节点值路径。路径沿父子边，可从任意节点开始或结束，不得重复节点；允许单节点路径。节点值可以为负数、零或重复。本站保留原题三项结果，另增加第四行0-based节点ID路径以验证重复值下的路径合法性；这是本站评测协议扩展，不是原题要求。存在多条最优路径时任选一条，正向或反向均接受。',
        'input': '第一行n；第二行n个整数values[i]；接下来n行，第i行两个整数left right表示节点i的左右孩子，-1表示不存在。完整原约束：1≤n≤200000，-10^9≤values[i]≤10^9。节点0为根，所有节点从根可达且构成有效二叉树；编号不保证拓扑顺序。本站单个测试输入上限32 MiB。',
        'output': '输出恰好四行：第一行全树节点值之和；第二行最大非空路径和；第三行该路径的节点值，以空格分隔；第四行与第三行一一对应的0-based节点ID，以空格分隔。路径至少包含一个节点，ID不得重复，相邻ID须有父子边。接受任意最优路径，不要求与参考输出相同。第四行是本站扩展。',
        'explanation': '原题样例全树和为6，最大路径2→1→3的和为6；本站附加ID路径1→0→2。全负样例最优为单节点-2（ID1），不能选择空路径得到0。全零样例任选一个节点或任意合法路径都最优。',
        'hints': ['每个节点记录最优向下路径和及一个孩子方向。', '遍历逆序可实现无递归树形DP。', '以每个节点为最高节点，组合两条正收益分支；只在最后重建一次路径。'],
        'timeLimit': 3, 'memoryLimit': 262144, 'outputLimit': 8192, 'checker': 'oa-tree-max-path', 'languages': ['python', 'go', 'java', 'cpp'],
    }, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    result = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Schema normalization failed; checker must be integrated first:\n' + result.stderr)
    package = json.loads(result.stdout)
    authored = [{'language': 'python', 'code': REFERENCE}]
    put('packages', f'{PID}.json', package)
    (OA / 'references' / f'{PID}.py').write_text(REFERENCE)
    put('editorials', f'{PID}.json', {'schemaVersion': 1, 'id': PID, 'title': package['problem']['title'], 'explanation': editorial_text, 'solutions': authored, 'sourceUrl': catalog['sourceUrl'], 'sourceContentHash': SOURCE_HASH})
    put('oracles', f'{PID}.json', [{'input': raw, 'expectedOutput': expected} for raw, expected in small.items()])
    put('mutants', f'{PID}.json', MUTANTS)
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA / 'negative-controls' / f'{PID}-{i}.py'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(mutant['code'])
    put('candidate-batches', f'{BATCH}.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': SOURCE_HASH, 'packageChecksum': sha(result.stdout), 'editorial': editorial_text, 'authoredSolutions': authored}]})
    put('source-evidence', f'{BATCH}.json', {'schemaVersion': 1, 'sourceCommit': COMMIT, 'items': [{'id': PID, 'sourcePath': SOURCE_PATH, 'gitBlob': blob, 'sourceSha256': sha(source), 'sourceContentHash': SOURCE_HASH, 'sourceUrl': catalog['sourceUrl'], 'sourceResults': ['sum of all node values', 'maximum nonempty path sum', 'one maximum path as node values'], 'siteAdditions': ['标准输入输出包装', '第四行0-based节点ID见证，原三项结果保留', '明确非空简单路径，任意最优路径及反向均接受', '两个本站公开补充样例', '32 MiB单输入上限与8 MiB输出预算'], 'upstreamCodeExecuted': False}]})
    put('resolutions', f'{BATCH}.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': SOURCE_HASH, 'previousReason': prior['reason'], 'reason': '完整保留n≤200000和值±10^9；单输入32 MiB支持最坏输入，oa-tree-max-path语义checker接受任意最优路径；保留原三个结果并明示本站增加节点ID见证。163个唯一独立全端点oracle、20万节点边界和两个正常退出错误程序本地通过，尚待真实GoJudge验收。'}]})
    put('validation', f'{BATCH}.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': len(small), 'uniqueOracleInputs': len(small), 'publicCases': 3, 'hiddenCases': len(cases)-3, 'formalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': '小树枚举全部起点与终点，在无向邻接表逐条扫描唯一路径；不使用树形DP。大正链使用闭式总和，完全树用独立两次无权最远点搜索，非正边界用最大单节点。', 'oracleMaxWallSeconds': max(timings), 'largeBoundaries': boundary_results}], 'note': '实际Python子进程stdin/stdout验证参考程序，独立检查输出四行、总和、最优和、值与ID对应、节点唯一性和边合法性。仅候选，未连接GoJudge或发布。'})
    print(json.dumps({'id': PID, 'oracleCases': len(small), 'formalCases': len(cases), 'boundaries': boundary_results}, ensure_ascii=False))


if __name__ == '__main__':
    main()
