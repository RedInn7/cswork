#!/usr/bin/env python3
"""Independent Codeium sequence candidate, with signed-permutation oracle."""
from pathlib import Path
from bisect import bisect_right
from itertools import permutations, product
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-codeium-1'
BATCH = 'codeium-1-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
RAW_PATH = 'fastprep/Codeium/codeium-erics-sequence.md'
BLOB = '794d3121ddbfeae3eb7cd117084b4d88b7ef4708'
RAW_SHA = '4c020b68a90bddffd4d89f1dcbb0bdbccf49fbf1afc4b09bdaa3774a6b371b47'
HASH = '0674d0787138866a14fb3af1a3cc4c99059824771a359723d9a1d06b02b64d88'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    words = raw.split()
    n = int(words[0])
    bound = str(n)
    p = []
    for word in words[1:]:
        digits = word.lstrip('+').lstrip('0') or '0'
        if word.startswith('-'):
            digits = word[1:].lstrip('0') or '0'
        if len(digits) > len(bound) or (len(digits) == len(bound) and digits > bound):
            return 'None'
        p.append(int(digits))
    order = sorted(range(n), key=lambda i: p[i])
    left, right, offset = 0, n - 1, 0
    a = [0] * n
    for remaining in range(n, 0, -1):
        if p[order[left]] < offset or p[order[right]] > offset + remaining:
            return 'None'
        if p[order[left]] == offset:
            a[order[left]] = -remaining
            left += 1
        elif p[order[right]] == offset + remaining:
            a[order[right]] = remaining
            right -= 1
            offset += 1
        else:
            return 'None'
    return ' '.join(map(str, a))

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '错误把全部输入判无解', 'code': "import sys\nsys.stdin.read()\nprint('None')\n"},
    {'name': '合法见证扩大两倍却不再最优', 'code': REFERENCE.replace("return ' '.join(map(str, a))", "return ' '.join(str(2 * x) for x in a)")},
]

EDITORIAL = '''## 来源与约定

固定提交e66f809f4c953bce129f68491726176615db6afc的fastprep/Codeium/codeium-erics-sequence.md完整规定1≤n≤100000、p为非负整数序列，以及p[i]统计所有j中a[i]+a[j]>0的数量。j包含i自身。要求a各项互异，且任意两项（允许同一项）不能和为0；在可行解中最小化最大绝对值，多解返回任意一个，无解返回None。catalog在HTML比较符号处截断，原始规则与n范围并未缺失。

p没有给出数值上界，本站没有补上p≤n的输入限制。p>n是合法输入但必然无解，程序直接通过十进制位数及字典序与n比较，不把超长数字转成机器整数。允许十进制前导零，超长前导零不等于数值超界。本站仅将原函数数组输入输出编排为文本；原文没有样例，公开样例均为本站补充。没有执行上游代码。

## 思路

按p升序排列下标，维护尚未分配的左右端点。设还有k个元素未处理，已分配的正数有offset个。它们绝对值大于以后分配的全部值，所以对每个未处理元素各贡献一次正和。

剩余元素中绝对值最大者如果为负，其剩余正和计数必为0；如果为正，其剩余计数必为k（包括自身）。因此当前最小p等于offset时，可以给该下标赋−k；否则若最大p等于offset+k，则给该下标赋+k并增加offset；两者均不满足时无解。任何p不在[offset,offset+k]也立即无解。每一步将k减一。

## 正确性证明

合法解不能包含0（自身相加为0），也不能同时包含x和−x；加上各项互异，全部绝对值必为n个不同正整数。因此最大绝对值至少n。

任意合法剩余解的最大绝对值项，负时与所有剩余项之和都负，正时与所有剩余项之和都正，所以剩余计数中必须有0或k。已剥离正数统一贡献offset，故原计数必须出现offset或offset+k。这证明算法失败时不存在合法解。

反过来，如果一个剩余计数为0的项存在，它与所有剩余项都应为负和；将该项设为−k并让之后各项绝对值小于k，便同时满足它自己的计数及它对其他项的零贡献。若某项剩余计数为k，将其设为+k，使它与所有剩余项正和，同时对其他项统一贡献1，故offset增加1。移除此项后得到同一种更小问题。所有中间状态的计数界也必须合法。对剩余项数归纳，完成全部剥离就构成满足所有p的真实见证。

每步使用一个不同绝对值k，最终绝对值恰为1到n，满足互异与禁止零和，且最大绝对值恰n，达到先前下界。因此构造既可行又全局最优。排序中相等p对应下标可互换，不要求唯一答案。

## 复杂度与语义判题

设输入字符总量为B。读取并分类超长十进制数O(B)，排序O(n log n)，剥离O(n)，辅助空间O(B+n)。无需对无上界p做任意精度算术。

专用checker不要求与参考排列相同。它检查输出包含恰n个整数、绝对值恰为1..n，再排序输出并二分统计每项的正和数量，包含自身。输出None时独立检查可行性。不同的最优排列均可通过，扩大所有值虽不改变正和计数，却破坏最优性，应拒绝。

## 独立验证

小oracle穷举绝对值1..n的所有排列及全部正负号，并直接双循环计算正和数量，建立每个计数向量的可行见证；不使用排序剥离。163个唯一小输入既有可行、不可行，也有p>n。它们通过真实参考程序子进程和独立见证检查。完整n=100000测试包括全正、全负、打乱混合符号和不可能计数；原合法见证通过排序二分产生输入p。另有十万位p、超长前导零和巨大数在末尾的测试，均不缩数值域。两个负控正常退出，分别错误一律None及将最优见证乘二。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(p):
    return str(len(p)) + '\n' + ' '.join(map(str, p)) + '\n'


def output(a):
    return 'None\n' if a is None else ' '.join(map(str, a)) + '\n'


def degrees(a):
    s = sorted(a)
    return [len(a) - bisect_right(s, -x) for x in a]


def enumeration(n):
    answers = {}
    for perm in permutations(range(1, n + 1)):
        for signs in product((-1, 1), repeat=n):
            a = tuple(x * sign for x, sign in zip(perm, signs))
            p = tuple(sum(x + y > 0 for y in a) for x in a)
            answers.setdefault(p, a)
    return answers


def valid(actual, expected, p):
    # Feasibility of None is taken from independent enumeration/known witnesses.
    words = actual.split()
    if words == ['None']:
        return expected is None
    if expected is None or len(words) != len(p):
        return False
    try:
        a = list(map(int, words))
    except ValueError:
        return False
    return sorted(map(abs, a)) == list(range(1, len(p) + 1)) and degrees(a) == p


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
    all_answers = {n: enumeration(n) for n in range(1, 6)}
    specs = [[0], [1], [1, 1], [2], [0, 0], [2, 2], [0, 2], [1, 2], [0, 1], [3, 1, 1]]
    rng = random.Random(SEED)
    keys = {tuple(p) for p in specs}
    while len(specs) < 163:
        n = rng.randint(2, 5)
        if len(specs) % 2:
            p = list(rng.choice(list(all_answers[n])))
        else:
            p = [rng.randint(0, n + 1) for _ in range(n)]
        if tuple(p) not in keys:
            keys.add(tuple(p))
            specs.append(p)
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    oracles = []
    for p in specs:
        a = all_answers[len(p)].get(tuple(p))
        text = encode(p)
        actual, _ = run(refpath, text)
        assert valid(actual, a, p), p
        oracles.append({'input': text, 'expectedOutput': output(a)})
    print(f'{PID}: 163 unique independent signed-permutation oracle subprocess checks passed', flush=True)
    formal = [(f'本站补充公开样例{i+1}' if i < 3 else f'独立带符号枚举{i-2}', encode(p), p, all_answers[len(p)].get(tuple(p))) for i, p in enumerate(specs[:35])]
    n = 100000
    positive = list(range(1, n + 1))
    negative = [-i for i in positive]
    mixed = [i if i % 3 else -i for i in positive]
    rng.shuffle(mixed)
    formal += [('完整全正', encode([n] * n), [n] * n, positive), ('完整全负', encode([0] * n), [0] * n, negative),
               ('完整乱序混合', encode(degrees(mixed)), degrees(mixed), mixed),
               ('完整无极端计数不可行', encode([1] * n), [1] * n, None),
               ('完整末项超界', encode([0] * (n - 1) + [n + 1]), [0] * (n - 1) + [n + 1], None),
               ('十万位非负p', encode(['9' * 100000]), [2], None),
               ('十万位前导零可行', encode(['0' * 100000 + '1']), [1], [1]),
               ('完整最后超长p', encode(['0'] * (n - 1) + ['9' * 100000]), [0] * (n - 1) + [n + 1], None),
               ('零的超长表示', encode(['0' * 10000]), [0], [-1])]
    cases, evidence = [], []
    for i, (name, text, p, expected) in enumerate(formal):
        actual, elapsed = run(refpath, text)
        assert valid(actual, expected, p), name
        cases.append({'name': name, 'input': text, 'expectedOutput': output(expected), 'hidden': i >= 3, 'weight': 1})
        if i >= 35:
            evidence.append({'name': name, 'n': len(p), 'inputBytes': len(text.encode()), 'feasible': expected is not None, 'localSeconds': round(elapsed, 4)})
    assert len({c['input'] for c in cases}) == len(cases)
    killed = []
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA / f'negative-controls/{PID}-{i}.py'
        path.write_text(mutant['code'])
        rejected = [j for j, (_, text, p, a) in enumerate(formal) if not valid(run(path, text)[0], a, p)]
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    # Verify source-enumerated witnesses against the existing production checker.
    checker = "import{codeiumSequence}from'./lib/oa-codeium-sequence-checker.mjs';let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{for(const c of JSON.parse(s)){if(!codeiumSequence(c.expectedOutput,'',c.input))throw Error('witness rejected')}console.log('semantic witnesses accepted')});"
    subprocess.run(['node', '--input-type=module', '-e', checker], cwd=ROOT, input=json.dumps(oracles + cases), text=True, check=True)
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '构造正和计数指定的最小幅值序列', 'difficulty': '困难', 'tags': ['OA', 'Codeium', '构造', '排序'],
        'description': '给定长度n的非负整数序列p，构造n个互不相同的整数a。对于任意两个下标i、j（允许i=j），必须a[i]+a[j]不等于0；对于每个i，满足a[i]+a[j]>0的下标j数量必须恰为p[i]，其中包括j=i。所有可行构造中，最小化max(|a[i]|)。输出任意一个最优构造；无解输出None。原始题面允许任意最优序列，本站使用语义判题，不要求与样例或参考构造相同。',
        'input': '第一行n，1≤n≤100000。第二行n个非负十进制整数p[i]，允许前导零。原题未给p[i]上界，本站不添加数值上界；p[i]>n的输入自然无解。超长整数也可能出现，按文本读取判断即可。',
        'output': '若无解，输出大小写严格一致的None；否则输出n个空格分隔整数，依次对应a[0]到a[n−1]，并达到最小的最大绝对值。不输出方括号。',
        'explanation': '原始快照没有样例，公开样例均为本站补充。p=[0]可输出[-1]；p=[1]可输出[1]，自身正和计数为1；p=[1,1]无解，因为两个绝对值不同的非零整数中，绝对值较大项的计数只能为0或2。',
        'hints': ['零和限制意味着绝对值互异。', '考虑绝对值最大的项与所有其他项相加的符号。', '依次剥离计数极端项，保留它对尚未处理项的统一贡献。'],
        'timeLimit': 3, 'memoryLimit': 131072, 'outputLimit': 4096, 'checker': 'oa-codeium-sequence', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '剥离最大绝对值项并达到幅值下界', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': RAW_PATH, 'gitBlobSha': BLOB, 'rawSha256': RAW_SHA, 'upstreamCodeExecuted': False, 'siteAdded': '数组的文本输入输出；原无样例，公开样例均本站补充。保留任意最优见证及None无解，不增加p的数值上界。', 'recoveredConstraints': ['1 <= n <= 100000', 'p[i] is a non-negative integer, no explicit numeric upper bound'], 'recovery': '原HTML完整的下标范围及n上界被catalog的<解析误吞。'}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '固定raw恢复完整n界与正和计数，排序剥离达最优幅值n；专用checker接受所有最优见证。163独立带符号排列oracle及完整n100000、超长p通过本地。仅候选，待沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': 163, 'uniqueOracleInputs': len(keys), 'publicCases': 3, 'hiddenCases': len(cases) - 3, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Enumerate all permutations of 1..n and all sign vectors for n<=5; compute all pairwise positive-sum counts directly. No greedy peeling in oracle.', 'largeBoundaries': evidence, 'semanticValidation': True, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter() - started, 3)}]})
    print(f'{PID}: {len(cases)} formal cases, 2 normal-exit mutants; candidate only', flush=True)


if __name__ == '__main__':
    main()
