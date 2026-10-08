#!/usr/bin/env python3
"""Independent, full-domain Zalando block construction recovery. Candidate only."""
from functools import lru_cache
from itertools import product
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-zalando-1'
BATCH = 'zalando-1-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SOURCE = 'web/content/docs/companies/zalando.mdx'
BLOB = '5d3ffafed3f4c7ef24cfa0453595a2445efebba0'
SOURCE_SHA = '16d843d28e892b089d701021c307f9b8b8f251e96b6873746e0b9d9e4b865ba9'
HASH = 'ab0253f7e2ea870b35a45ace6c10ed69a11b33ca300f0e6f913a68a0e4f10d8b'
SEED = 20261014
BLOCKS = ('AA', 'AB', 'BB')

REFERENCE = '''import sys
from functools import lru_cache

def solve(raw):
    a, b, c = map(int, raw.split())
    @lru_cache(None)
    def best(a, b, c, suffix):
        answer = ''
        counts = (a, b, c)
        for i, block in enumerate(('AA', 'AB', 'BB')):
            if not counts[i]:
                continue
            boundary = suffix + block
            if 'AAA' in boundary or 'BBB' in boundary:
                continue
            remaining = list(counts)
            remaining[i] -= 1
            candidate = block + best(*remaining, block)
            if len(candidate) > len(answer) or (len(candidate) == len(answer) and candidate < answer):
                answer = candidate
        return answer
    return best(a, b, c, '')

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''

MUTANTS = [
    {'name': '错误按字符重排而非整块拼接', 'code': '''import sys
a, b, c = map(int, sys.stdin.read().split())
x, y = 2*a+b, 2*c+b
out = ''
while x or y:
    chosen = None
    for ch, left in sorted((('A', x), ('B', y)), key=lambda z: (-z[1], z[0])):
        if left and not out.endswith(ch*2):
            chosen = ch
            break
    if chosen is None: break
    out += chosen
    if chosen == 'A': x -= 1
    else: y -= 1
print(out)
'''},
    {'name': '错误忽略AB块', 'code': REFERENCE.replace('a, b, c = map(int, raw.split())', 'a, b, c = map(int, raw.split())\n    b = 0')},
]

EDITORIAL = '''## 固定来源与样例纠错

唯一固定来源为提交e66f809f4c953bce129f68491726176615db6afc的web/content/docs/companies/zalando.mdx。该快照没有另一本fastprep或OA LIST原件，因此证据明确标为MDX，不伪称有raw交叉佐证。正文完整规定：AA、AB、BB三种二字母块各有0..10个，选择一些完整块连接，不能出现AAA或BBB，求最长字符串，多解可返回任意一个；结果非空。本站据此排除三个数量全零，将三个参数编排为一行，输出不带引号的字符串。不拆块、不翻转块，尤其不能自行使用BA块。

保留四个原输入，但前两例原输出有可确定的笔误。第一例(5,0,2)原文明确列出AA-BB-AA-BB-AA，却错拼为长度9的AABBAABBA；正确拼接为长度10的AABBAABBAA。第二例(1,2,1)原输出BBAABAA长度7，不能由整块构成；解释中的候选也不符合块用量或整块要求。本站给出AABBABAB=AA-BB-AB-AB，恰好用完4块，长度8已达总字符数上界。第三例ABAB和第四例BB保持不变。不是为匹配错例另造操作规则。上游三语言贪心也可能错误使用过量同类块；本题参考程序与对照均独立编写，未执行上游代码。

## 动态规划

状态best(a,b,c,s)记录三种剩余数量，以及已构造串的最后两字符s（初始为空）。枚举下一块AA、AB、BB，数量须充足，且s与该块连接后没有AAA或BBB。消耗这一块，递归得到最佳后缀。也允许停止。比较候选长度，参考实现仅为确定性输出在等长时取字典序较小者；题目和判题不要求这种平局规则。

## 正确性证明

已经构造的前缀合法。新添块本身只有两个字符，不会在块内部产生三连，因此任何新增违规三连只能跨越接缝，而检查旧末两字符加新块足以覆盖所有接缝三连。转移因此恰好枚举所有合法下一块。

按剩余块数归纳。零块时只能停止，空后缀最优。对任意状态，每个合法续接要么停止，要么先取某个合法块，再接该转移状态的合法后缀。归纳假设保证递归返回该状态的最长后缀，枚举所有首块再取最长必然得到当前最优。故初始状态给出全局最长合法字符串，等长字典序选择不影响最优长度。

## 独立长度界与构造

删去最终块序列中的所有AB块，只观察AA和BB。它们必须交替：AA后不能接AB或AA，若仍有下一块只能是BB；BB之后插入若干AB也不能接BB，因为AB-BB含BBB。故AA与BB的使用数量之差至多1，最多使用2*min(AA,BB)+[AA!=BB]块，另有至多AB个AB块。

这个上界总能达到。若AA≥BB，构造(AB)^AB+(AA-BB)^BB，再在AA>BB时添一个AA；若AA<BB，构造(BB-AA)^AA+BB+(AB)^AB。逐接缝检查没有三连且用量合法。因此最优长度恰为2*(AB+2*min(AA,BB)+[AA!=BB])。独立oracle用这一计数界及显式构造，不调用参考DP。

## 复杂度与完整范围验证

设P=(AA+1)(AB+1)(BB+1)，总块数K=AA+AB+BB≤30。后缀只有空串、AA、AB、BB四种，状态至多4P≤5324，每个状态枚举3块。本实现缓存字符串，比较、复制的代价至多O(K)，故时间O(PK)，空间O(PK)，递归深度≤K+1，输出至多60字符。

全部1330个合法输入均由独立计数构造oracle产生见证并逐一运行参考子进程验证。另对总块数≤8的164个输入，独立穷举所有块排列、检查整个字符串并允许在每个前缀停止，不使用DP、后缀状态或长度公式，验证枚举最优值与构造一致。正式数据覆盖四原输入、纯单类、全部边界组合、严重失衡、AB桥接和完整(10,10,10)。专用checker检查完整块用量、三连和最优长度，接受所有等长最优输出；负控分别错误拆块按字符重排、忽略AB块，都必须正常退出才计击杀。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def encode(counts):
    return ' '.join(map(str, counts)) + '\n'


def oracle(counts):
    a, b, c = counts
    if a >= c:
        return 'AB' * b + 'AABB' * c + ('AA' if a > c else '')
    return 'BBAA' * a + 'BB' + 'AB' * b


def exhaustive(counts):
    # Literal enumeration of complete block orders; no DP and no length formula.
    best = ''
    def visit(text, remaining):
        nonlocal best
        if 'AAA' in text or 'BBB' in text:
            return
        if len(text) > len(best) or (len(text) == len(best) and text < best):
            best = text
        for i, block in enumerate(BLOCKS):
            if remaining[i]:
                rest = list(remaining)
                rest[i] -= 1
                visit(text + block, rest)
    visit('', counts)
    return best


def valid(actual, expected, counts):
    tokens = actual.split()
    if len(tokens) != 1:
        return False
    word = tokens[0]
    if len(word) != len(expected.strip()) or len(word) % 2 or 'AAA' in word or 'BBB' in word:
        return False
    blocks = [word[i:i+2] for i in range(0, len(word), 2)]
    return all(block in BLOCKS for block in blocks) and all(blocks.count(block) <= counts[i] for i, block in enumerate(BLOCKS))


def run(path, raw):
    start = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw, text=True, capture_output=True, check=True, timeout=10)
    assert not result.stderr
    return result.stdout, time.perf_counter() - start


def main():
    start = time.perf_counter()
    source = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{SOURCE}'], cwd=ROOT)
    assert sha(raw) == SOURCE_SHA
    assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == BLOB
    old = next(x for x in json.loads((OA / 'coverage.json').read_text())['items'] if x['id'] == PID)
    refpath = OA / f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    all_inputs = [v for v in product(range(11), repeat=3) if sum(v)]
    oracles, small_evidence, outputs = [], [], {}
    maximum_seconds = 0
    for index, counts in enumerate(all_inputs, 1):
        expected = oracle(counts)
        if sum(counts) <= 8:
            enumerated = exhaustive(counts)
            assert len(enumerated) == len(expected)
            small_evidence.append({'input': encode(counts), 'enumeratedOptimalLength': len(enumerated)})
        actual, elapsed = run(refpath, encode(counts))
        maximum_seconds = max(maximum_seconds, elapsed)
        assert valid(actual, expected, counts), counts
        if sum(counts) <= 8:
            assert actual.strip() == enumerated  # Reference deterministic tie, not judging contract.
        outputs[counts] = actual
        oracles.append({'input': encode(counts), 'expectedOutput': expected + '\n'})
        if index % 300 == 0:
            print(f'{PID}: {index}/1330 full-domain independent oracle subprocess checks', flush=True)
    assert len(small_evidence) == 164
    public = [((5, 0, 2), 'AABBAABBAA'), ((1, 2, 1), 'AABBABAB'), ((0, 2, 0), 'ABAB'), ((0, 0, 10), 'BB')]
    formal = [x[0] for x in public]
    for counts in product((0, 1, 10), repeat=3):
        if sum(counts) and counts not in formal:
            formal.append(counts)
    for counts in [(10, 0, 2), (2, 0, 10), (10, 10, 2), (2, 10, 10), (9, 10, 10), (10, 10, 9), (5, 5, 5), (1, 1, 0), (0, 1, 1)]:
        if counts not in formal:
            formal.append(counts)
    rng = random.Random(SEED)
    while len(formal) < 48:
        counts = rng.choice(all_inputs)
        if counts not in formal:
            formal.append(counts)
    cases = []
    for index, counts in enumerate(formal):
        expected = public[index][1] + '\n' if index < 4 else oracle(counts) + '\n'
        assert valid(outputs[counts], expected, counts)
        cases.append({'name': f'原始输入{index+1}' if index < 4 else f'完整块边界{index-3}', 'input': encode(counts), 'expectedOutput': expected, 'hidden': index >= 4, 'weight': 1})
    killed = []
    checker_payload = [{'input': c['input'], 'output': c['expectedOutput'], 'accepted': True} for c in oracles + cases]
    for counts, actual in outputs.items():
        checker_payload.append({'input': encode(counts), 'output': actual, 'accepted': True})
    for index, mutant in enumerate(MUTANTS, 1):
        path = OA / f'negative-controls/{PID}-{index}.py'
        path.write_text(mutant['code'])
        rejected = []
        for case_index, (counts, case) in enumerate(zip(formal, cases)):
            actual, _ = run(path, case['input'])
            accepted = valid(actual, case['expectedOutput'], counts)
            checker_payload.append({'input': case['input'], 'output': actual, 'accepted': accepted})
            if not accepted:
                rejected.append(case_index)
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    checker = "import{zalandoBlocks}from'./lib/oa-zalando-blocks-checker.mjs';let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{for(const c of JSON.parse(s))if(zalandoBlocks(c.output,'',c.input)!==c.accepted)throw Error('semantic mismatch '+JSON.stringify(c));console.log('semantic witnesses and mutants agree')});"
    subprocess.run(['node', '--input-type=module', '-e', checker], cwd=ROOT, input=json.dumps(checker_payload), text=True, check=True)
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '拼接不含AAA或BBB的最长整块字符串', 'difficulty': '中等', 'tags': ['OA', 'Zalando', '动态规划', '构造'],
        'description': '有AA、AB、BB三种不可拆分的二字母块，数量分别为a、b、c。可以选择其中一些块，按任意顺序完整连接，构造不包含连续三个A或连续三个B的最长字符串。块不能拆开或翻转，每个块最多使用一次。返回任意一个最长结果，不要求字典序最小。',
        'input': '一行三个整数a b c，依次表示AA、AB、BB块的数量。0≤a,b,c≤10，a+b+c≥1。对应原题AA、AB、BB三个参数及非空结果保证，完整保留原始数值范围。',
        'output': '输出一行非空字符串，只含A、B，不带引号、空格或块分隔符。必须由可用整块拼成，不含AAA或BBB，且长度最大。多个最优结果均接受。',
        'explanation': '保留四个原输入。样例1原文列出的AA-BB-AA-BB-AA正确拼接是AABBAABBAA，长度10，原输出误少一个A。样例2可用AA-BB-AB-AB得到AABBABAB，长度8且用完全部4块；原长度7输出及解释中的非法候选已纠正。样例3使用两个AB得到ABAB；样例4最多使用一个BB得到BB。规则和完整范围依据唯一固定MDX，不存在额外raw版本。',
        'hints': ['拼接合法性只需要记住当前末尾两字符。', '用剩余三种块数量和末尾字符做状态。', '即使长度最优，拆开块重新排列字符也可能不合法。'],
        'timeLimit': 2, 'memoryLimit': 262144, 'outputLimit': 64, 'checker': 'oa-zalando-blocks', 'languages': ['python', 'go', 'java', 'cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node', '--import', 'tsx', '-e', normalize], cwd=ROOT, input=json.dumps(package, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language': 'python', 'code': REFERENCE}]
    put('packages', PID + '.json', json.loads(normalized))
    put('oracles', PID + '.json', oracles)
    put('mutants', PID + '.json', MUTANTS)
    put('editorials', PID + '.json', {'schemaVersion': 1, 'id': PID, 'title': '剩余整块与后缀状态的最长拼接', 'explanation': EDITORIAL, 'solutions': solutions})
    put('candidate-batches', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'sourceContentHash': HASH, 'packageChecksum': sha(normalized), 'editorial': EDITORIAL, 'authoredSolutions': solutions}]})
    put('source-evidence', BATCH + '.json', {'schemaVersion': 1, 'upstreamCommit': COMMIT, 'upstreamRepository': 'https://github.com/RedInn7/OA-Master', 'items': {PID: {'url': source['sourceUrl'], 'contentHash': HASH, 'catalogContentHash': HASH, 'path': SOURCE, 'gitBlobSha': BLOB, 'rawSha256': SOURCE_SHA, 'sourceKind': 'sole fixed MDX; no separate raw found', 'upstreamCodeExecuted': False, 'recoveredConstraints': ['0 <= AA, AB, BB <= 10', 'AA + AB + BB >= 1', 'whole AA/AB/BB blocks only', 'any maximum-length valid output accepted'], 'siteAdded': '三个参数编排为一行，字符串输出不带引号；不添加字典序平局要求。', 'correction': 'Example1 source explicitly lists AA-BB-AA-BB-AA but misspells its concatenation; correct AABBAABBAA length10. Example2 odd-length BBAABAA cannot comprise complete blocks; AABBABAB uses all four blocks, optimal length8. Remaining two examples unchanged.'}}})
    put('resolutions', BATCH + '.json', {'schemaVersion': 1, 'items': [{'id': PID, 'batch': BATCH, 'sourceContentHash': HASH, 'previousReason': old.get('reason', ''), 'reason': '唯一固定MDX规则与0..10范围完整；明确披露并纠正前两例整块长度错误，以独立排列枚举、计数上界和完整1330输入验证恢复。语义判题接受所有最优串，不以固定token排除多解。仅候选待沙箱。'}]})
    put('validation', BATCH + '.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [{'id': PID, 'oracleCases': len(oracles), 'uniqueOracleInputs': len({c['input'] for c in oracles}), 'publicCases': 4, 'hiddenCases': len(cases)-4, 'referenceFormalCases': len(cases), 'negativeControls': killed, 'referenceSha256': sha(REFERENCE), 'oracleMethod': 'Independent alternating AA/BB counting bound with explicit block construction for all1330 inputs; separately exhaustive literal whole-block permutations for164 inputs of total<=8, no reference DP invoked.', 'exhaustiveSmallChecks': small_evidence, 'fullDomainVerified': True, 'maximumOutputLength': 60, 'maximumLocalReferenceSeconds': round(maximum_seconds, 5), 'semanticValidation': True, 'subprocessValidation': True, 'normalExitChecked': True, 'localValidationOnly': True, 'elapsedSeconds': round(time.perf_counter()-start, 3)}]})
    print(f'{PID}: 1330 full-domain oracles, 164 exhaustive small checks, {len(cases)} formal cases, 2 normal-exit mutants; candidate frozen', flush=True)


if __name__ == '__main__':
    main()
