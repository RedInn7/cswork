#!/usr/bin/env python3
"""Exact full-domain length-three subsequence counting recovery."""
from pathlib import Path
from itertools import combinations
from math import comb
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-morgan-stanley-3'
BATCH = 'morgan-3-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
HASH = '5d3edb5d58b507bce023be9b870793c5f907283f49d4ae713011539805960c28'
SOURCES = [
    ('fastprep/Morgan Stanley/stanley-get-subsequence-count.md', '4509e9b5eb1bea89f3d6567b7883337f2571ce30', 'fe6dea8137ce8ff9c8b886964fcb54d7262affeee13072b5c1da8ab022f2a73e'),
    ('web/content/docs/companies/morgan-stanley.mdx', '4fead47532a7a3d9a47396317aded4e93010a625', '6914835046037d31225f2e6401c963a75020c4e10c9900e5e8a238f5ee12e6b6'),
]
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    pattern, text = raw.split()
    one = two = three = 0
    for ch in text:
        if ch == pattern[2]:
            three += two
        if ch == pattern[1]:
            two += one
        if ch == pattern[0]:
            one += 1
    return str(three)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '正序更新导致同一字符重复使用', 'code': REFERENCE.replace('''        if ch == pattern[2]:
            three += two
        if ch == pattern[1]:
            two += one
        if ch == pattern[0]:
            one += 1''', '''        if ch == pattern[0]:
            one += 1
        if ch == pattern[1]:
            two += one
        if ch == pattern[2]:
            three += two''')},
    {'name': '计数截断为32位有符号整数', 'code': REFERENCE.replace('return str(three)', 'return str((three + 2147483648) % 4294967296 - 2147483648)')},
]

EDITORIAL = '''## 固定来源与数值类型披露

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Morgan Stanley/stanley-get-subsequence-count.md完整规定：s1长度恰为3，1≤|s2|≤500000，两串只含A到Z。统计s1作为s2子序列出现的次数，原三个样例都明确列出不同的1-based下标三元组。因此按下标选择计数，不是按不同字符结果去重，也不是只计连续子串。三个原例全部保留。

raw返回说明及starter写int，但原始长度范围允许结果远超32位；同一固定提交的web/content/docs/companies/morgan-stanley.mdx中Java实现明确返回long，C++明确返回long long，Python保存精确整数。本站按数学计数输出精确十进制整数，不取模、不截断、不缩小输入范围。完整双源路径与指纹单独记录。标准输入为两行字符串；没有执行上游代码。

## 思路

从左到右扫描s2，维护one、two、three，分别表示已扫描部分中与s1前1、2、3个字符相同的子序列数量。当前字符等于s1[2]时令three增加two；等于s1[1]时令two增加one；等于s1[0]时令one增加1。三个条件独立，必须从最长前缀向最短前缀更新，避免s1含重复字母时把当前字符在同一子序列中使用多次。

## 正确性证明

处理当前下标之前，设三个计数均正确。对于长度j的目标前缀，全部匹配子序列分成两类：不选择当前字符的，数量是已有计数；选择当前字符作为末项的，仅当其等于目标第j个字符时可行，数量恰为此前已形成的长度j−1前缀匹配数。两类下标集合互斥，且覆盖所有匹配。

按j=3、2、1逆序更新，每次读取的短前缀计数尚未包含当前下标，所以新增子序列所有下标严格递增。初始空文本没有非空匹配，三个计数均为0，符合归纳起点。故完整扫描后three准确统计全部且仅统计合法下标三元组。长度小于3时自然为0，不需要缩小源输入范围。

## 复杂度与64位上界

扫描时间O(|s2|)，计数状态O(1)；标准输入整体读取占O(|s2|)空间。任一匹配对应一个不同的三下标组合，因此答案不超过C(|s2|,3)，完整范围最大C(500000,3)=20833208333500000。此值大于32位上界，也大于JavaScript安全整数上界，但小于有符号64位上界9223372036854775807。one与two分别不超过500000和C(500000,2)，同样安全。Python使用精确整数；其他语言应使用64位，不能在中途把值转为浮点。

## 独立验证与完整边界

小oracle直接枚举i<j<k三个下标并逐字符比较，不使用前缀DP。163个唯一输入以真实参考程序子进程对拍。正式满长案例另按闭式结构计数，并用枚举中间下标、左右匹配数相乘的线性方法交叉检查：AAA与全A得到C(500000,3)；ABC分块得到三段长度乘积；(ABC)^q后补AB得到C(q+2,3)；ABA与(AB)^m得到Σj(m−j)=C(m+1,3)。同时覆盖AAB、ABB重复目标、无匹配、长度1/2、超过32位及超过安全浮点范围的精确结果。期望输出与验证记录中的大计数均存十进制字符串。两个负控正常退出后，分别因正序更新和32位溢出被拒绝。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(pattern, text):
    return pattern + '\n' + text + '\n'


def oracle(pattern, text):
    return sum(text[i] == pattern[0] and text[j] == pattern[1] and text[k] == pattern[2]
               for i, j, k in combinations(range(len(text)), 3))


def middle_oracle(pattern, text):
    right = text.count(pattern[2])
    left = total = 0
    for ch in text:
        if ch == pattern[2]:
            right -= 1
        if ch == pattern[1]:
            total += left * right
        if ch == pattern[0]:
            left += 1
    return total


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
    public = [('HRW', 'HERHRWS', 3), ('ELO', 'HELLOWORLD', 4), ('ABC', 'ABCBABC', 5)]
    specs = [(p, t) for p, t, _ in public]
    specs += [('AAA', 'A'), ('AAA', 'AA'), ('AAA', 'AAA'), ('AAA', 'AAAA'), ('ABA', 'ABABA'),
              ('AAB', 'AABAB'), ('ABB', 'ABABB'), ('ABC', 'CBA'), ('ZZZ', 'ZZZZ'), ('XYZ', 'X'), ('XYZ', 'XY')]
    keys = {encode(p, t) for p, t in specs}
    rng = random.Random(SEED)
    while len(specs) < 163:
        pattern = ''.join(rng.choices('ABCXYZ', k=3))
        text = ''.join(rng.choices('ABCXYZ', k=rng.randint(1, 14)))
        raw = encode(pattern, text)
        if raw not in keys:
            keys.add(raw)
            specs.append((pattern, text))
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for i, (p, t) in enumerate(specs):
        expected = oracle(p, t)
        assert middle_oracle(p, t) == expected
        if i < 3:
            assert expected == public[i][2]
        raw = encode(p, t)
        assert run(refpath, raw)[0] == str(expected), (p, t)
        oracles.append({'input': raw, 'expectedOutput': str(expected) + '\n'})
    print(f'{PID}: 163 unique index-triple oracle subprocess checks passed', flush=True)
    cases = [{'name': f'原始样例{i+1}' if i < 3 else f'独立三下标枚举{i-2}', **row, 'hidden': i >= 3, 'weight': 1} for i, row in enumerate(oracles[:35])]
    n = 500000
    q, m = n // 3, n // 2
    boundaries = [
        ('满域全相同超JS安全整数', 'AAA', 'A' * n, comb(n, 3)),
        ('满域ABC分块', 'ABC', 'A' * q + 'B' * (q + 1) + 'C' * (q + 1), q * (q + 1) ** 2),
        ('满域ABC交错', 'ABC', 'ABC' * q + 'AB', comb(q + 2, 3)),
        ('满域ABA交错同字母', 'ABA', 'AB' * m, comb(m + 1, 3)),
        ('满域AAB分块', 'AAB', 'A' * m + 'B' * m, comb(m, 2) * m),
        ('满域ABB分块', 'ABB', 'A' * m + 'B' * m, m * comb(m, 2)),
        ('满域ABA分块', 'ABA', 'A' * 125000 + 'B' * 250000 + 'A' * 125000, 125000 * 250000 * 125000),
        ('满域无匹配', 'XYZ', 'A' * n, 0),
        ('满域末尾一个无关字符', 'AAA', 'A' * (n - 1) + 'Z', comb(n - 1, 3)),
        ('短压力超32位组合数', 'AAA', 'A' * 3000, comb(3000, 3)),
    ]
    evidence = []
    for name, p, t, expected in boundaries:
        assert len(t) <= n and middle_oracle(p, t) == expected
        raw = encode(p, t)
        got, elapsed = run(refpath, raw)
        assert got == str(expected), name
        cases.append({'name': name, 'input': raw, 'expectedOutput': str(expected) + '\n', 'hidden': True, 'weight': 1})
        evidence.append({'name': name, 'pattern': p, 'textLength': len(t), 'expectedOutput': str(expected), 'inputBytes': len(raw.encode()), 'localSeconds': round(elapsed, 4)})
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
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '三字符字符串作为子序列的精确出现次数', 'difficulty': '中等', 'tags': ['OA', 'Morgan Stanley', '动态规划', '计数'],
        'description': '给定字符串s1和s2，其中s1长度恰为3。统计从s2中选取三个严格递增下标i<j<k，使s2[i]、s2[j]、s2[k]依次等于s1三个字符的方案数。字符不要求连续；不同下标选择分别计数，即使得到的字符相同。输出精确整数，不取模。原starter标注int但完整范围会溢出32位；同固定来源的Java/C++题解使用64位。本站保留完整范围并明确精确整数输出。',
        'input': '第一行s1，长度恰为3。第二行s2，1≤|s2|≤500000。两行都仅含大写英文字母A到Z，允许重复字符。',
        'output': '输出精确非负十进制整数方案数，不取模或截断。结果最大20833208333500000，需要64位整数，不能使用浮点近似。',
        'explanation': '三个公开样例均来自原题。HRW在HERHRWS中对应1-based下标(1,3,6)、(1,5,6)、(4,5,6)，共3种；ELO在HELLOWORLD中共4种；ABC在ABCBABC中共5种。',
        'hints': ['分别维护匹配目标前1、2、3个字符的数量。', '目标含重复字符时，应先更新较长前缀。', '计数可能超过32位及安全浮点整数范围。'],
        'timeLimit': 2, 'memoryLimit': 131072, 'outputLimit': 4096, 'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '逆序更新三个前缀匹配计数', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': SOURCES[0][0], 'gitBlobSha': SOURCES[0][1], 'rawSha256': SOURCES[0][2], 'sources': [{'path': p, 'gitBlobSha': b, 'sha256': h, 'role': 'complete rules/bounds/examples' if i == 0 else 'Java long / C++ long long exact-count evidence'} for i, (p, b, h) in enumerate(SOURCES)], 'upstreamCodeExecuted': False, 'siteAdded': '标准两行字符串输入；精确十进制结果，不取模、不缩域；披露int接口不足和同固定MDX宽整数证据。三个原例全部保留。', 'recoveredConstraints': ['len(s1) = 3', '1 <= len(s2) <= 500000', 'uppercase English A-Z'], 'maximumAnswer': '20833208333500000'}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '数学计数规则与完整范围明确；int接口过窄但同固定MDX Java/C++用64位，本站输出数学精确值；163独立下标oracle与满50万字符闭式边界通过。仅候选待沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 3, 'hiddenCases': len(cases) - 3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Enumerate i<j<k and compare three characters directly; no prefix-count DP.', 'largeBoundaryOracle': 'Closed-form binomial/block/alternating formulas cross-checked by independent middle-index left-count times right-count summation.', 'largeBoundaries': evidence, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter() - started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 3 original samples and 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()
