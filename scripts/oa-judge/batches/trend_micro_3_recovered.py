#!/usr/bin/env python3
"""Recover the complete immutable Trend Micro 3 mathematical statement."""
from pathlib import Path
import hashlib
import json
import math
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-trend-micro-3'
BATCH = 'trend-micro-3-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW_PATH = 'fastprep/Trend Micro/trendmicro-find-sequences.md'
BLOB = '949ad285e52b45a222aa7ea3cfc98320479d9458'
RAW_SHA = '225e3b7aa334ace728c1e1001a1df54fecc8083ddaf7c968f439a5149e980c16'
HASH = 'adafa6a3031921b63c7fbbd0872cdfc85e7d58b9efcab1f16f107df39dbb55f1'
SEED = 20261007

REFERENCE = '''import sys
from math import isqrt

def solve(n):
    left = 1
    total = 0
    intervals = []
    for right in range(1, isqrt(n) + 1):
        total += right * right
        while total > n:
            total -= left * left
            left += 1
        if total == n:
            intervals.append((left, right))
    intervals.sort(key=lambda p: p[1] - p[0], reverse=True)
    rows = [str(len(intervals))]
    for left, right in intervals:
        rows.append(str(right - left + 1) + ' ' + ' '.join(map(str, range(left, right + 1))))
    return '\\n'.join(rows)

if __name__ == '__main__':
    print(solve(int(sys.stdin.read())))
'''

MUTANTS = [
    {'name': '错误排除单项平方序列', 'code': REFERENCE.replace('if total == n:', 'if total == n and left < right:')},
    {'name': '错误按长度升序输出', 'code': REFERENCE.replace('reverse=True', 'reverse=False')},
]

EDITORIAL = '''## 来源与输出约定

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Trend Micro/trendmicro-find-sequences.md完整保留1≤n≤10^10，以及寻找所有连续正整数序列、其平方和等于n的规则。原始HTML中的比较符号被catalog文本解析误吞，导致范围与目标缺失；并非原题缺少约束。输出说明先定义c为序列项数，随后用大写C要求降序，本站统一为按项数降序。单项序列对应(p,…,p+m)中的m=0，没有额外要求至少两项。原文没有公开样例，本题所有公开样例明确为本站补充。

原接口返回字符串数组：第一项为解的个数，其余每项为项数及全部序列元素。本站仅将每个字符串序列化为一行；无解输出一行0，不用None或-1，不输出平方后的数。不引入新数值限制，不执行上游代码。

## 思路

序列末项r满足r²≤n，因此只需检查1≤r≤⌊√n⌋。维护连续窗口[l,r]的平方和，每次向右加入r²；只要和大于n，就从左端移除l²。若当前和恰为n，记录整个窗口。将所有命中窗口按长度降序排序，输出每个窗口的全部整数。

## 正确性证明

所有平方项严格为正。固定右端r时，窗口和随左端递增严格减小，因此最多有一个左端使平方和等于n。算法从左端移除元素时，移除前的和大于n，这些左端不能产生当前右端的解；它们对未来更大的右端只会增加正数，也永远不可能产生解，故永久丢弃安全。

收缩结束后，当前左端是尚未排除的最小左端。如果窗口和等于n，得到唯一合法解；如果小于n，继续增大左端只会让和更小，因此该右端没有遗漏的解。枚举所有可能右端覆盖全部非空连续正整数序列；记录的窗口都以实际平方和等式验证，所以既不漏解也不产生伪解。

对于固定长度c，起点p的平方和Σ(p+j)²随p严格递增。因此同一长度最多存在一个解，按长度降序得到唯一规定顺序，无需为并列情况增加规则。

## 复杂度与完整范围

设R=⌊√n⌋、K为解数、L为输出所有序列的总项数。左右指针分别至多移动R次，时间O(R+K log K+L)，含输出存储的空间O(K+L)。本题R≤100000。最短起点1的前3106个平方和不超过10^10，而前3107个平方和超过它，因此任何解最多3106项。每个长度最多一解，故K≤3106且L≤3106×3107/2=4825171，完整输出在64MiB预算内。使用整数平方根与64位整数，避免浮点边界；运行中窗口和至多2n≤2×10^10，64位有符号整数足够。

## 独立验证

oracle按长度c枚举，再利用闭式c·p²+c(c−1)·p+c(c−1)(2c−1)/6对起点p做整数二分。它不滑动窗口、不复用参考程序。163个唯一输入以真实子进程对拍。正式压力保留n=10^10、相邻上界、99999²、长度3106的平方和及相邻值，并包含多解和无解。完整比较每个输出整数，不仅比较解数。两个错误程序分别漏掉单项序列和颠倒长度顺序，须正常退出且被正式案例拒绝。
'''


def sha(data):
    return hashlib.sha256(data.encode() if isinstance(data, str) else data).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def sum_squares(c):
    return c * (c + 1) * (2 * c + 1) // 6


def interval_sum(p, c):
    return c * p * p + c * (c - 1) * p + c * (c - 1) * (2 * c - 1) // 6


def oracle(n):
    found = []
    c = 1
    while sum_squares(c) <= n:
        lo, hi = 1, math.isqrt(n)
        while lo <= hi:
            p = (lo + hi) // 2
            value = interval_sum(p, c)
            if value < n:
                lo = p + 1
            elif value > n:
                hi = p - 1
            else:
                found.append((p, c))
                break
        c += 1
    found.reverse()
    return str(len(found)) + '\n' + ''.join(str(c) + ' ' + ' '.join(map(str, range(p, p + c))) + '\n' for p, c in found)


def run(path, n):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=str(n) + '\n', text=True, capture_output=True, check=True, timeout=10)
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
    public = [(1, '1\n1 1\n'), (2, '0\n'), (25, '2\n2 3 4\n1 5\n')]
    specs = [n for n, _ in public]
    specs += [3, 4, 5, 6, 7, 9, 13, 14, 29, 30, 50, 55, 91, 100, 365, 1000,
              10**10, 10**10 - 1, 10**10 - 2, 99999**2, 99999**2 - 1, 99999**2 + 1,
              sum_squares(3106), sum_squares(3106) - 1, sum_squares(3106) + 1]
    rng = random.Random(SEED)
    keys = set(specs)
    while len(specs) < 163:
        if len(specs) % 3 == 0:
            n = rng.randint(1, 10**10)
        elif len(specs) % 3 == 1:
            n = interval_sum(rng.randint(1, 1000), rng.randint(1, 300))
        else:
            n = rng.randint(1, 100000)
        if n not in keys:
            keys.add(n)
            specs.append(n)
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    durations = []
    for i, n in enumerate(specs):
        expected = oracle(n)
        if i < 3:
            assert expected == public[i][1]
        got, elapsed = run(refpath, n)
        assert got == expected.split(), n
        oracles.append({'input': str(n) + '\n', 'expectedOutput': expected})
        durations.append(elapsed)
    assert len(keys) == 163
    print(f'{PID}: 163 unique length/binary-search oracle subprocess checks passed', flush=True)
    cases = [{'name': f'本站补充公开样例{i+1}' if i < 3 else f'独立完整枚举{i-2}', **row, 'hidden': i >= 3, 'weight': 1} for i, row in enumerate(oracles[:40])]
    evidence = []
    for i, n in enumerate(specs[:40]):
        if n >= 99999**2 or n in [sum_squares(3106) - 1, sum_squares(3106), sum_squares(3106) + 1]:
            lines = oracles[i]['expectedOutput'].splitlines()
            evidence.append({'n': n, 'solutionCount': int(lines[0]), 'maximumSequenceLength': max([int(row.split()[0]) for row in lines[1:]], default=0), 'outputBytes': len(oracles[i]['expectedOutput'].encode()), 'localSeconds': round(durations[i], 4)})
    longest = oracle(sum_squares(3106)).splitlines()[1].split()
    assert int(longest[0]) == 3106 and longest[1] == '1' and longest[-1] == '3106'
    assert oracle(10**10) == '1\n1 100000\n'
    for case in cases:
        assert run(refpath, int(case['input']))[0] == case['expectedOutput'].split()
    killed = []
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA / f'negative-controls/{PID}-{i}.py'
        path.write_text(mutant['code'])
        rejected = [j for j, case in enumerate(cases) if run(path, int(case['input']))[0] != case['expectedOutput'].split()]
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    package = {'schemaVersion': 1, 'problem': {
        'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '枚举平方和指定的连续正整数序列',
        'difficulty': '中等', 'tags': ['OA', 'Trend Micro', '双指针', '枚举'],
        'description': '给定正整数n，找出所有非空连续正整数序列p、p+1、…、p+c−1，使这c个数的平方和等于n。p≥1，c≥1，单项序列也需要输出。将全部序列按项数c从大到小输出。相同长度的序列至多有一个，所以此顺序唯一。固定原题正文完整规定1≤n≤10^10；本站从原始HTML恢复被整理版解析吞掉的规则和范围，并将原返回字符串数组转为逐行输出。',
        'input': '输入一行正整数n，1≤n≤10000000000。',
        'output': '第一行输出序列总数k。随后k行，每行先输出该序列的项数c，再输出它的全部c个连续正整数，相邻整数以空格分隔。按c降序输出。无解时只输出一行0。输出元素本身，不是元素的平方。',
        'explanation': '原始快照没有公开样例，三个样例均为本站补充。n=1只有[1]；n=2没有解；n=25有3²+4²=25和5²=25，先输出较长的[3,4]再输出[5]。',
        'hints': ['最后一项不超过整数平方根。', '正数平方和随右端增加而增大，随左端右移而减小。', '同一长度至多有一个合法起点。'],
        'timeLimit': 2, 'memoryLimit': 131072, 'outputLimit': 65536, 'checker': 'tokens',
        'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '用平方和窗口枚举全部连续序列', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': RAW_PATH, 'gitBlobSha': BLOB, 'rawSha256': RAW_SHA, 'upstreamCodeExecuted': False, 'siteAdded': '原返回字符串数组序列化为逐行输出；原文无样例，三个公开样例全部本站补充；C/c统一指项数。', 'recoveredConstraints': ['1 <= n <= 10000000000'], 'recovery': '原HTML正文含完整比较符号、平方和等式和输入范围；catalog被<错误吞掉，不是原始源缺失。'}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '固定raw完整恢复1<=n<=1e10及连续正整数平方和等式，C即项数c；唯一长度顺序可tokens检查。独立按长度二分oracle及完整边界本地通过。仅候选，待真实沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 3, 'hiddenCases': len(cases) - 3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Enumerate length and binary-search positive start using exact quadratic sum; does not use a sliding window.', 'largeBoundaries': evidence, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'maxLocalReferenceSeconds': round(max(durations), 4), 'elapsedSeconds': round(time.perf_counter() - started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases and 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()
