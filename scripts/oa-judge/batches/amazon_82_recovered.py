"""Recover Amazon #82 as a local-only candidate; never execute upstream code."""

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
UPSTREAM = Path('/private/tmp/oa-master-readonly')
PID = 'oa-amazon-82'
BATCH = 'amazon-82-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SOURCE_PATH = 'web/content/docs/companies/amazon.mdx'
SOURCE_HASH = '2dc068f3b3d0b3ff468f1e72e9079916cb30ab20c713131453cffd55ccc43cf4'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    values = map(int, raw.split())
    n, m = next(values), next(values)
    # Source stock bounds allow a compact, standard-library-only frequency table.
    freq = [0] * 1_000_001
    high, low = 0, 1_000_001
    for _ in range(n):
        stock = next(values)
        freq[stock] += 1
        if stock > high:
            high = stock
        if stock < low:
            low = stock
    revenue = 0
    for _ in range(m):
        while high and freq[high] == 0:
            high -= 1
        if high == 0:
            break
        revenue += high + low
        freq[high] -= 1
        if high > 1:
            freq[high - 1] += 1
            if high - 1 < low:
                low = high - 1
    return str(revenue)

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
'''

MUTANTS = [
    {'name': '遗漏最小非零库存收益', 'code': REFERENCE.replace('revenue += high + low', 'revenue += high')},
    {'name': '扣减后才计算当前客户收益', 'code': '''import sys
def solve(raw):
    it=iter(map(int,raw.split())); n,m=next(it),next(it); a=list(it); ans=0
    for _ in range(m):
        positive=[v for v in a if v>0]
        if not positive: break
        i=a.index(max(positive)); a[i]-=1
        positive=[v for v in a if v>0]
        if positive: ans+=min(positive)+max(positive)
    return str(ans)
if __name__ == '__main__': print(solve(sys.stdin.read()))
'''},
]


def sha(data):
    return hashlib.sha256(data.encode() if isinstance(data, str) else data).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def encode(stocks, customers):
    return f'{len(stocks)} {customers}\n' + ' '.join(map(str, stocks)) + '\n'


def oracle(stocks, customers):
    """Independent literal array simulation: scan min/max anew for each customer."""
    stocks = list(stocks)
    answer = 0
    for _ in range(customers):
        positive = [x for x in stocks if x > 0]
        if not positive:
            break
        answer += min(positive) + max(positive)
        stocks[stocks.index(max(positive))] -= 1
    return answer


def run(code, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-c', code], input=raw, text=True, capture_output=True, timeout=20)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip(), round(time.perf_counter() - started, 4)


def main():
    assert not (OA / 'batches' / f'{BATCH}.json').exists(), 'already promoted'
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == SOURCE_HASH
    snapshot = subprocess.check_output(['git', 'show', f'{COMMIT}:{SOURCE_PATH}'], cwd=UPSTREAM)
    blob = subprocess.check_output(['git', 'rev-parse', f'{COMMIT}:{SOURCE_PATH}'], cwd=UPSTREAM, text=True).strip()
    section = snapshot.decode().split('## 82. Maximize Rental Revenue (VM Stock)\n', 1)[1].split('\n## 83.', 1)[0]
    assert '1 ≤ n ≤ 10⁶' in section and '1 ≤ m ≤ 10⁶' in section and '1 ≤ vmStock[i] ≤ 10⁶' in section
    assert len(source['solutions']) == 3
    for solution in source['solutions']:
        assert solution['code'].strip() in section
    for evidence in ('if not stocks:\n            break', 'if (stocks.isEmpty()) break', 'if (stocks.empty()) break'):
        assert evidence in section
    prior = next(x for x in json.loads((OA / 'reviews/amazon-remaining-d.json').read_text())['items'] if x['id'] == PID)
    public = [([2, 3], 3, 12), ([1], 5, 2), ([3], 3, 12)]
    cases = []
    unique = {}
    for i, (a, m, expected) in enumerate(public):
        assert oracle(a, m) == expected
        raw = encode(a, m)
        unique[raw] = expected
        cases.append({'name': f'本站样例 {i + 1}', 'input': raw, 'expectedOutput': f'{expected}\n', 'hidden': False, 'weight': 1})
    rng = random.Random(SEED)
    while len(unique) < 163:
        a = [rng.randint(1, 20) for _ in range(rng.randint(1, 9))]
        m = rng.randint(1, sum(a) + 10)
        unique[encode(a, m)] = oracle(a, m)
    for i, (raw, expected) in enumerate(list(unique.items())[3:31]):
        cases.append({'name': f'独立暴力 {i + 1}', 'input': raw, 'expectedOutput': f'{expected}\n', 'hidden': True, 'weight': 1})
    boundaries = [
        ('单类型最大库存全部耗尽', [10**6], 10**6, 10**6 * (10**6 + 1)),
        ('最大客户数库存提前耗尽', [1], 10**6, 2),
        ('最大类型数均为一', [1] * 10**6, 10**6, 2 * 10**6),
        ('n m stock 同时达到一百万', [10**6] * 10**6, 10**6, 2 * 10**12 - 999999),
        ('巨大稀疏值域且最小值保持一', [1, 10**6], 10**6, 10**6 * (10**6 + 1) // 2 + 10**6),
    ]
    for name, a, m, expected in boundaries:
        cases.append({'name': name, 'input': encode(a, m), 'expectedOutput': f'{expected}\n', 'hidden': True, 'weight': 1})
    oracle_timings = []
    for raw, expected in unique.items():
        output, elapsed = run(REFERENCE, raw)
        assert output == str(expected), (raw, output, expected)
        oracle_timings.append(elapsed)
    boundary_results = []
    for case in cases[-len(boundaries):]:
        output, elapsed = run(REFERENCE, case['input'])
        assert output == case['expectedOutput'].strip(), case['name']
        boundary_results.append({'name': case['name'], 'inputBytes': len(case['input'].encode()), 'expectedOutput': output, 'wallSeconds': elapsed, 'exitCode': 0})
    killed = []
    for mutant in MUTANTS:
        rejected = []
        for case in cases[:31]:
            output, _ = run(mutant['code'], case['input'])
            if output != case['expectedOutput'].strip():
                rejected.append(case['name'])
                break
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'exitCode': 0})
    editorial_text = '''## 来源与本站约定

固定 OAMaster 提交 e66f809f4c953bce129f68491726176615db6afc 的正文给出每位客户收益为当前最大库存与最小非零库存之和。Python、Java、C++ 三份源码均先计收益，再将一种最大库存减一，零库存移除，库存耗尽即停止。本站明确采用这一一致行为：客户多于总库存时返回已服务客户的累计收益，不报错、不继续收费。本站标准输入输出及三个样例为自行补充，不是源题样例。完整保留 n、m、每种初始库存均为 1 到 10^6 的原约束。

## 算法

用 freq[s] 统计库存等于 s 的类型数，high 表示最大库存，low 表示最小正库存。每位客户先累加 high+low，再将一个 high 移到 high-1；为零则删除。high 所在桶空了就向下寻找。若新插入的 high-1 为正且小于 low，则更新 low。

## 正确性证明

初始化时频数与两个端点准确。每次仅改变一种最大库存，因此频数更新与租用一个 VM 完全一致，收益在更新之前累加，符合题意。最大值只能下降，空桶向下扫描找到的值就是下次真实最大值。若最大值严格大于最小值，原最小值仍存在，新的最小值只能是原 low 与插入值的较小者。若最大值等于最小值且大于一，扣减产生的新正值就是最小值；若等于一，则剩余库存仍全为一或全部耗尽。因此 low 始终正确，无须向上扫描。最大端点归零恰好表示耗尽，立即停止。由归纳，每一步收费及停止时机均正确。

## 复杂度与边界

固定值域 U=10^6，时间 O(n+m+U)，频数空间 O(U)，输入分词另需 O(n)。最大端点累计只下降 U 次。收益至多 2×10^12，C++/Java 应用 64 位整数。Python 仅用标准库，无 sortedcontainers 依赖。n=m=stock=10^6 时首客收费 2000000，之后 999999 位各收费 1999999，总收益 1999999000001；对应输入 8000016 字节，采用本站 32 MiB 单例 I/O 上限，不收窄原题约束。
'''
    package = {'schemaVersion': 1, 'problem': {
        'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '虚拟机库存租赁收益', 'difficulty': '中等',
        'tags': ['OA', 'Amazon', '频数统计', '模拟'],
        'description': '有 n 种虚拟机，初始库存为 vmStock[i]。依次服务最多 m 位客户。每位客户先支付当前最大库存与当前最小非零库存之和，再从一种当前最大库存类型租走一台，使其库存减一。零库存不参与最小值计算。本站据固定来源 Python、Java、C++ 三种源码的一致行为明确：所有库存耗尽时立即停止，输出此前累计收益；最大值并列时任选一种不影响结果。标准 I/O 与以下三个样例为本站补充。',
        'input': '第一行两个整数 n m，第二行 n 个整数 vmStock[i]。完整原约束：1≤n≤10^6，1≤m≤10^6，1≤vmStock[i]≤10^6。本站单个测试输入上限为 32 MiB。',
        'output': '输出累计收益，使用足够容纳 2×10^12 的整数类型。库存耗尽后的客户不产生收益。',
        'explanation': '样例一依次收费 5、4、3，总计 12；样例二只能服务第一位，收益 2；样例三依次收费 6、4、2，总计 12。',
        'hints': ['库存数值不超过一百万，可用频次数组。', '每次只减少最大库存，最大值只会下降。'],
        'timeLimit': 3, 'memoryLimit': 262144, 'outputLimit': 4096, 'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp'],
    }, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True)
    package = json.loads(normalized.stdout)
    solution = [{'language': 'python', 'code': REFERENCE}]
    put('packages', f'{PID}.json', package)
    (OA / 'references' / f'{PID}.py').write_text(REFERENCE)
    put('editorials', f'{PID}.json', {'schemaVersion': 1, 'id': PID, 'title': package['problem']['title'], 'explanation': editorial_text, 'solutions': solution, 'sourceUrl': source['sourceUrl'], 'sourceContentHash': SOURCE_HASH})
    put('oracles', f'{PID}.json', [{'input': raw, 'expectedOutput': f'{value}\n'} for raw, value in unique.items()])
    put('mutants', f'{PID}.json', MUTANTS)
    put('candidate-batches', f'{BATCH}.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': SOURCE_HASH, 'packageChecksum': sha(normalized.stdout), 'editorial': editorial_text, 'authoredSolutions': solution}]})
    put('resolutions', f'{BATCH}.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': SOURCE_HASH, 'previousReason': prior['reason'], 'reason': '32 MiB 单例 I/O 支持完整百万级原约束；固定版本 Python/Java/C++ 源码均在库存为空时 break，本站据此明确库存耗尽停止并返回累计收益。163 个独立暴力输入、三个公开和33个隐藏测试、两个正常退出 mutant 本地通过；尚待真实沙箱。'}]})
    put('source-evidence', f'{BATCH}.json', {'schemaVersion': 1, 'sourceCommit': COMMIT, 'items': [{'id': PID, 'sourcePath': SOURCE_PATH, 'gitBlob': blob, 'sourceSha256': sha(snapshot), 'sectionSha256': sha(section), 'sourceContentHash': SOURCE_HASH, 'sourceUrl': source['sourceUrl'], 'sourceImplementations': [{'language': x['language'], 'sha256': sha(x['code']), 'behavior': 'charge current positive min + max, decrement max, remove zero, stop when empty'} for x in source['solutions']], 'siteAdditions': ['标准输入输出与三个公开样例', '依据三语言源码明示库存耗尽立即停止', '32 MiB 单例 I/O 上限，完整保留原数值约束'], 'upstreamCodeExecuted': False}]})
    put('validation', f'{BATCH}.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': len(unique), 'uniqueOracleInputs': len(unique), 'publicCases': 3, 'hiddenCases': len(cases)-3, 'formalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': '逐客户重新扫描普通数组求 min/max，删除一个最大值；不使用频数或端点递减', 'oracleMaxWallSeconds': max(oracle_timings), 'largeBoundaries': boundary_results}], 'note': '全部163个独立输入及五个大边界以真实Python子进程stdin/stdout验证；错误程序正常退出但输出不符。仅离线候选，未运行GoJudge，未发布。'})
    print(json.dumps({'id': PID, 'oracleCases': len(unique), 'formalCases': len(cases), 'boundaries': boundary_results}, ensure_ascii=False))


if __name__ == '__main__':
    main()
