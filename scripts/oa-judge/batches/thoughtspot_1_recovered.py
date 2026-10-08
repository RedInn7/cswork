#!/usr/bin/env python3
"""Thoughtspot 1: complete raw semantics plus immutable MDX input envelope."""
from pathlib import Path
from itertools import product
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-thoughtspot-1'
BATCH = 'thoughtspot-1-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
HASH = 'a885384adb945bf4b9810ea02ec6d6241228f512ffff995012dc0f960edd9ebe'
SOURCES = [
    ('fastprep/Thoughtspot/thoughtspot-get-min-time.md', '0ac1632999e8b2db34f953088baf136e216bac37', '03b886fb2fba58088be0d7ed52a21ab8db369263023f0a6a6813aa28978562d5'),
    ('web/content/docs/companies/thoughtspot.mdx', '9078bd2248f35463d5dea525b3835e1f73b09de5', '715276f7c95696c26f963480a811aefba909565a91f585f258e9b6bb16e0e005'),
]
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, m = data[:2]
    counts = [0] * n
    for service in data[2:]:
        counts[service - 1] += 1
    low, high = 0, max(counts)
    while low < high:
        mid = (low + high) // 2
        excess = 0
        capacity = 0
        for count in counts:
            if count > mid:
                excess += count - mid
            else:
                capacity += (mid - count) // 2
        if capacity >= excess:
            high = mid
        else:
            low = mid + 1
    return str(low)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '忽略向其他服务分配请求', 'code': REFERENCE.replace('while low < high:', 'low = high\n    while low < high:')},
    {'name': '错误向上取整空闲时间容量', 'code': REFERENCE.replace('(mid - count) // 2', '(mid - count + 1) // 2')},
]

EDITORIAL = '''## 固定来源与修正披露

原始规则来自固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Thoughtspot/thoughtspot-get-min-time.md：每个请求在其缓存服务处理耗时1，在任意其他服务耗时2；不同服务并行，同一服务每次只能处理一个请求；自由分配全部请求以最小化全部完成的时间。catalog在HTML中的1<=i<=m处误截断，把关键1/2耗时与并行规则吞掉。原文没有额外到达时间、依赖关系或必须保持输入顺序的约束。

raw的Constraints栏确实写Unknown，并未提供数值界。完整输入包络来自同一固定提交的web/content/docs/companies/thoughtspot.mdx：1≤n,m≤100000，1≤cache[i]≤n。本站分别记录两份来源，不伪称这些上界出自raw，不缩小MDX范围。标准输入输出由本站整理；原始样例保留，另外两个公开样例由本站补充。未执行上游代码。

原始样例n=3、cache=[1,1,3,1,1]的答案3正确，但说明把第3请求写成分配给服务2并称耗时1，与其缓存服务3不一致。正确实现同一答案的分配是：服务1处理第1、2、4请求，服务3处理第3请求，服务2处理第5请求，各服务耗时3、1、2。整理版题解仅返回最大缓存频次4，忽略了非缓存服务也能执行，本站不采用该错误算法。

## 思路

统计每个服务的缓存请求数c[i]。二分候选完成时间T：缓存请求多于T的服务至少需要外包c[i]−T个；少于T的服务可以先完成自己的c[i]个请求，再接收⌊(T−c[i])/2⌋个其他请求。计算总外包量E和总接收容量C，C≥E就可行。区间上界为max(c)，因为全部在缓存服务执行一定可行。注意每个服务的剩余时间必须分别向下取整，不能合并不同服务的零碎时间。

## 正确性证明

必要性：考虑一个在T内完成的任意分配。服务i处理了x[i]个本地缓存请求和y[i]个非本地请求，因此x[i]+2y[i]≤T且x[i]≤min(c[i],T)。它最多处理x[i]+⌊(T−x[i])/2⌋个请求。函数x+⌊(T−x)/2⌋对整数x单调不减，所以该服务总处理数不超过min(c[i],T)+⌊(T−min(c[i],T))/2⌋。对所有服务求和，全部m个请求能够完成要求m≤Σmin(c[i],T)+C，等价于E≤C。

充分性：让每个服务先处理min(c[i],T)个自己的请求，超出部分正好有E个。只有c[i]>T的服务产生外包请求，只有c[i]<T的服务具有接收容量，所以接收服务不可能是这些请求的原缓存服务，每个外包请求确实耗时2。所有外包请求都可交给任何有容量的服务，若C≥E就能全部分配，且每个服务不超过T。因此容量判据充要。

若T可行，增加时间不会使原分配失效，故可行性单调。二分搜索返回最小可行整数T，即最小完成时间。所有任务耗时为整数且没有到达约束，固定分配按任意顺序连续执行的完成时间就是该服务任务耗时之和，整数时间模型没有遗漏更优安排。

## 复杂度

统计O(m+n)，二分O(n log(m+1))，空间O(n+m)（包含解析输入）。完整n=m=100000可直接运行，不需要原生语言特例；答案不超过m。即使中间容量累计达到n·m，也应使用64位整数，Python整数安全。

## 独立验证

小oracle直接枚举每个请求被分配到哪一台服务，按缓存相等耗时1、不同耗时2累加各服务负载，取所有分配中最大负载的最小值；不使用容量判据或二分。163个唯一输入经过真实子进程对拍。正式案例覆盖奇数空闲时间、空闲服务、全部请求集中以及完整n/m边界。满规模单服务答案100000；100000个服务各一请求答案1；100000个服务且请求全在一个缓存时答案2；仅两个服务且100000请求集中时答案66667，分别独立从处理速率和整数容量推得。两个错误程序正常退出并被正式案例拒绝。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(n, cache):
    return f'{n} {len(cache)}\n' + ' '.join(map(str, cache)) + '\n'


def oracle(n, cache):
    answer = 2 * len(cache)
    for assignment in product(range(1, n + 1), repeat=len(cache)):
        loads = [0] * n
        for home, service in zip(cache, assignment):
            loads[service - 1] += 1 if home == service else 2
        answer = min(answer, max(loads))
    return answer


def run(path, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw, text=True, capture_output=True, check=True, timeout=10)
    assert not result.stderr
    return result.stdout.strip(), time.perf_counter() - started


def main():
    started = time.perf_counter()
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    for path, blob, fingerprint in SOURCES:
        raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{path}'], cwd=ROOT)
        assert sha(raw) == fingerprint
        assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == blob
    old = next(x for x in json.loads((OA / 'coverage.json').read_text())['items'] if x['id'] == PID)
    public = [(3, [1, 1, 3, 1, 1], 3), (3, [2], 1), (2, [1, 1, 1, 1], 3)]
    specs = [(n, a) for n, a, _ in public]
    specs += [(1, [1]), (2, [1, 1]), (3, [1, 1, 1]), (4, [1] * 5), (3, [1, 1, 2, 2, 2]),
              (2, [1, 2]), (2, [2] * 6), (3, [1, 1, 1, 1, 2, 3]), (4, [4] * 7), (3, [1, 2, 3] * 2)]
    keys = {encode(n, a) for n, a in specs}
    rng = random.Random(SEED)
    while len(specs) < 163:
        n = rng.randint(1, 4)
        a = [rng.randint(1, n) for _ in range(rng.randint(1, 7))]
        key = encode(n, a)
        if key not in keys:
            keys.add(key)
            specs.append((n, a))
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for i, (n, a) in enumerate(specs):
        expected = oracle(n, a)
        if i < 3:
            assert expected == public[i][2]
        text = encode(n, a)
        assert run(refpath, text)[0] == str(expected), (n, a, expected)
        oracles.append({'input': text, 'expectedOutput': str(expected) + '\n'})
    print(f'{PID}: 163 unique assignment-enumeration oracle subprocess checks passed', flush=True)
    cases = [{'name': '原始样例纠正操作说明' if i == 0 else f'本站补充公开样例{i}' if i < 3 else f'独立分配枚举{i-2}', **row, 'hidden': i >= 3, 'weight': 1} for i, row in enumerate(oracles[:35])]
    size = 100000
    balanced = list(range(1, size + 1))
    rng.shuffle(balanced)
    boundaries = [('最大服务数一个请求', size, [size], 1), ('最大请求数单服务', 1, [1] * size, size),
                  ('满双界全部集中且空闲服务', size, [size] * size, 2), ('满双界一服务一请求乱序', size, balanced, 1),
                  ('双服务集中奇数时间', 2, [1] * size, 66667), ('三服务集中整除', 3, [3] * size, 50000),
                  ('两请求每服务', size // 2, [i for i in range(1, size // 2 + 1) for _ in range(2)], 2),
                  ('奇数剩余时间不能拼接', size, [1] * 99999, 2)]
    evidence = []
    for name, n, a, expected in boundaries:
        text = encode(n, a)
        got, elapsed = run(refpath, text)
        assert got == str(expected), name
        cases.append({'name': name, 'input': text, 'expectedOutput': str(expected) + '\n', 'hidden': True, 'weight': 1})
        evidence.append({'name': name, 'n': n, 'm': len(a), 'expectedOutput': str(expected), 'inputBytes': len(text.encode()), 'localSeconds': round(elapsed, 4)})
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
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '缓存与非缓存服务分配的最短完成时间', 'difficulty': '中等', 'tags': ['OA', 'Thoughtspot', '二分答案', '调度'],
        'description': '系统有编号1到n的服务，需要处理m个请求。第i个请求缓存在服务cache[i]。可把每个请求分配给任意一个服务：若分配给其缓存服务，处理耗时1；否则处理耗时2。不同服务可以并行工作，但同一服务一次只能处理一个请求。所有请求均可从时间0开始安排，没有到达时间或任务依赖。求处理完全部请求所需的最短时间。完整操作规则从固定原始HTML恢复，完整数值范围来自同一提交的MDX；不采用整理版仅统计最大缓存频次的错误算法。',
        'input': '第一行n和m。第二行m个整数cache[i]。1≤n,m≤100000，1≤cache[i]≤n。标准输入格式由本站整理；数值范围来自固定提交的Thoughtspot MDX，raw Constraints栏未给数值界。',
        'output': '输出一个整数，表示全部请求的最短完成时间。',
        'explanation': '样例1保留原输入输出，纠正原说明的服务编号笔误：服务1处理第1、2、4请求耗时3；服务3处理第3请求耗时1；服务2处理第5请求耗时2，全部在3内完成。样例2、3是本站补充：单请求在缓存服务上耗时1；四个请求都缓存在服务1时可让服务1处理三个、服务2处理一个，总时间3。',
        'hints': ['先统计每个服务的缓存请求数量。', '固定一个完成时间，多余请求必须交给有空闲时间的服务。', '每个非缓存请求耗时2，分别对每台服务剩余时间向下取整。'],
        'timeLimit': 3, 'memoryLimit': 131072, 'outputLimit': 4096, 'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '二分完成时间并核对外包接收容量', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': SOURCES[0][0], 'gitBlobSha': SOURCES[0][1], 'rawSha256': SOURCES[0][2], 'sources': [{'path': p, 'gitBlobSha': b, 'sha256': h, 'role': 'complete rules; Constraints Unknown' if i == 0 else 'explicit n/m/cache input bounds'} for i, (p, b, h) in enumerate(SOURCES)], 'upstreamCodeExecuted': False, 'siteAdded': '标准输入输出；保留原例答案3并修正请求3应分给缓存服务3的说明笔误；公开另两例本站补充。', 'recoveredConstraints': ['1 <= n,m <= 100000 (immutable MDX)', '1 <= cache[i] <= n (immutable MDX)'], 'correction': 'MDX max-frequency solution returns4 for original example; raw explicitly allows non-cache workers with cost2, optimum3.'}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '完整raw恢复缓存1/非缓存2及并行规则，固定MDX补足完整n,m1e5界；独立assignment枚举与结构边界通过，未采用错误max-frequency。仅候选待沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 3, 'hiddenCases': len(cases) - 3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Enumerate every request-to-service assignment, calculate actual 1/2 durations and minimize maximum load; no binary search or capacity predicate.', 'largeBoundaries': evidence, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter() - started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()
