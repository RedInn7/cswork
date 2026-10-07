"""Recover Rubrik9 raw semantics as exact-count local-only candidate."""

from fractions import Fraction
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
PID = 'oa-rubrik-9'
BATCH = 'rubrik-9-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
SOURCE_PATH = 'fastprep/Rubrik/rubrik-bitonic-partitioning.md'
BLOB = '42b13b54b11b3fa05a9fffbc7f3413ff7fbcd3ee'
SOURCE_HASH = '5bf6b2a5663023323a71a7a300747b532fa99341f1f6840535edeb33b65c4e52'
SEED = 20261007

REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, arr = data[0], data[1:]
    prefix = [0]
    for value in arr:
        prefix.append(prefix[-1] + value)
    rise = [[0] * (n + 1) for _ in range(n)]
    fall = [[0] * (n + 1) for _ in range(n)]
    for i in range(1, n):
        for j in range(i + 1, n + 1):
            new_sum = prefix[j] - prefix[i]
            new_size = j - i
            up = down = 0
            for h in range(i):
                previous_cross = (prefix[i] - prefix[h]) * new_size
                new_cross = new_sum * (i - h)
                if previous_cross < new_cross:
                    up += rise[h][i] + (h == 0)
                elif previous_cross > new_cross:
                    down += rise[h][i] + fall[h][i]
            rise[i][j], fall[i][j] = up, down
    answer = sum(fall[i][n] for i in range(n))
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
'''
MUTANTS = [
    {'name': '误将单调划分也算作双坡', 'code': REFERENCE.replace('down += rise[h][i] + fall[h][i]', 'down += rise[h][i] + fall[h][i] + (h == 0)').replace('answer = sum(fall[i][n] for i in range(n))', 'answer = 1 + sum(fall[i][n] + rise[i][n] for i in range(n))')},
    {'name': '擅自对精确计数取模', 'code': REFERENCE.replace('return str(answer)', 'return str(answer % 1000000007)')},
]


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def encode(arr):
    return f'{len(arr)}\n' + ' '.join(map(str, arr)) + '\n'


def cut_oracle(arr):
    """Enumerate cut masks and all interior peaks; exact Fraction comparisons."""
    n, answer = len(arr), 0
    for cuts in range(1 << (n - 1)):
        if cuts.bit_count() < 2:
            continue
        means, start = [], 0
        for end in range(1, n + 1):
            if end == n or cuts & (1 << (end - 1)):
                means.append(Fraction(sum(arr[start:end]), end - start))
                start = end
        for peak in range(1, len(means)-1):
            if all(means[i] < means[i+1] for i in range(peak)) and all(means[i] > means[i+1] for i in range(peak, len(means)-1)):
                answer += 1
                break
    return answer


def peak_oracle(arr):
    """Independent large oracle: enumerate unique peak block, combine two sides.

    No rising/falling-phase states, no manual integer cross-product comparisons.
    Prefix/suffix monotone partitions counted separately using Fraction means.
    """
    n = len(arr)
    mean = {(i,j): Fraction(sum(arr[i:j]), j-i) for i in range(n) for j in range(i+1,n+1)}
    increasing, decreasing = {}, {}
    for end in range(1, n+1):
        for start in range(end):
            increasing[start,end] = 1 if start == 0 else sum(increasing[before,start] for before in range(start) if mean[before,start] < mean[start,end])
    for start in range(n-1, -1, -1):
        for end in range(start+1, n+1):
            decreasing[start,end] = 1 if end == n else sum(decreasing[end,after] for after in range(end+1,n+1) if mean[end,after] < mean[start,end])
    answer = 0
    # Peak strictly internal => at least one block on each side, at least 3 total.
    for start in range(1,n-1):
        for end in range(start+1,n):
            left = sum(increasing[before,start] for before in range(start) if mean[before,start] < mean[start,end])
            right = sum(decreasing[end,after] for after in range(end+1,n+1) if mean[end,after] < mean[start,end])
            answer += left * right
    return answer


def run(code, raw):
    started = time.perf_counter()
    result = subprocess.run([sys.executable, '-c', code], input=raw, text=True, capture_output=True, timeout=15)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip(), round(time.perf_counter()-started, 4)


def main():
    assert not (OA / 'batches' / f'{BATCH}.json').exists(), 'already promoted'
    catalog = next(x for x in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert catalog['contentHash'] == SOURCE_HASH
    upstream = '/private/tmp/oa-master-readonly'
    source = subprocess.check_output(['git', 'show', f'{COMMIT}:{SOURCE_PATH}'], cwd=upstream)
    blob = subprocess.check_output(['git', 'rev-parse', f'{COMMIT}:{SOURCE_PATH}'], cwd=upstream, text=True).strip()
    assert blob == BLOB
    raw = source.decode()
    for marker in ('1 < n <= 100', '-10^9 <= arr[i] <= 10^9', 'at least 3 partitions', 'strictly increasing and then strictly decreasing', 'public int bitonicPartitioning'):
        assert marker in raw
    assert 'mod' not in raw.lower()
    previous = next(x for x in json.loads((OA / 'reviews/rubrik-capital-remaining.json').read_text())['items'] if x['id'] == PID)
    public = [('原题样例一', (1,3,2,1), 3), ('原题样例二', (1,2,3,4,3,2,1), 49), ('本站样例：只有上坡不合法', (1,2,3), 0)]
    selected = {}
    cases = []
    for name, arr, expected in public:
        assert cut_oracle(arr) == peak_oracle(arr) == expected
        selected[arr] = expected
        cases.append({'name': name, 'input': encode(arr), 'expectedOutput': f'{expected}\n', 'hidden': False, 'weight': 1})
    fixed = [(1,2), (2,1), (0,0,0), (3,2,1), (-3,-1,-3), (1,1,2,1), (1,2,2,1), (-10**9,10**9,-10**9), (10**9,-10**9,10**9), (-1,0,-1,0,-1)]
    for arr in fixed:
        selected[arr] = cut_oracle(arr)
    rng = random.Random(SEED)
    while len(selected) < 163:
        arr = tuple(rng.choice([-10**9,-7,-1,0,1,7,10**9]) for _ in range(rng.randint(2,10)))
        selected[arr] = cut_oracle(arr)
    for i, (arr, expected) in enumerate(list(selected.items())[3:33]):
        cases.append({'name': f'独立切点枚举 {i+1}', 'input': encode(arr), 'expectedOutput': f'{expected}\n', 'hidden': True, 'weight': 1})
    times = []
    for arr, expected in selected.items():
        assert peak_oracle(arr) == expected
        actual, elapsed = run(REFERENCE, encode(arr))
        assert actual == str(expected), (arr,actual,expected)
        times.append(elapsed)
    # Extra exhaustive input family supplements 163 portable oracle records.
    scope = {'__name__': 'candidate'}
    exec(compile(REFERENCE, '<independently-authored-reference>', 'exec'), scope)
    exhaustive = 0
    for n in range(2,7):
        for arr in product((-1,0,1), repeat=n):
            expected = cut_oracle(arr)
            assert int(scope['solve'](encode(arr))) == expected == peak_oracle(arr)
            exhaustive += 1
    mountain = tuple(range(1,51)) + tuple(range(50,0,-1))
    mountain_count = 526947368435520933960755133783
    boundaries = [
        ('100个相等最大值', (10**9,)*100, 0),
        ('100个相等最小值', (-10**9,)*100, 0),
        ('100个严格递增值', tuple(range(100)), 0),
        ('100个严格递减值', tuple(range(100,0,-1)), 0),
        ('100项对称山峰99位精确计数', mountain, mountain_count),
        ('平移至负数的山峰计数不变', tuple(x-101 for x in mountain), mountain_count),
        ('上下界交替', (-10**9,10**9)*50, 20825),
    ]
    large_results = []
    for name, arr, expected in boundaries:
        independently_counted = peak_oracle(arr)
        assert independently_counted == expected
        actual, elapsed = run(REFERENCE, encode(arr))
        assert actual == str(expected)
        cases.append({'name': name, 'input': encode(arr), 'expectedOutput': f'{expected}\n', 'hidden': True, 'weight': 1})
        large_results.append({'name': name, 'n': len(arr), 'expectedOutput': str(expected), 'countBitLength': expected.bit_length(), 'wallSeconds': elapsed, 'independentMethod': 'unique peak block + Fraction increasing-prefix/decreasing-suffix counts', 'exitCode': 0})
    killed = []
    for mutant in MUTANTS:
        rejects = []
        for case in cases:
            actual, _ = run(mutant['code'], case['input'])
            if actual != case['expectedOutput'].strip():
                rejects.append(case['name'])
                break
        assert rejects
        killed.append({'name': mutant['name'], 'rejectedByCases': rejects, 'exitCode': 0})
    editorial = '''## 来源恢复与计数协议

固定 raw 题面明确：2≤n≤100，元素在[-10^9,10^9]，至少3个分段，每段以平均值代表，代表序列先严格上升再严格下降。峰必须在内部，两侧各至少发生一次严格变化；相等平均值不合法，纯递增或纯递减都不计。分段为保持原顺序的非空连续段，覆盖整个数组，不同切点集合视为不同方案。

raw 没有取模要求，但 starter 使用 int 返回类型，无法覆盖完整范围。本站明确输出精确非负整数，不取模、不溢出；这是本站输出协议，不能据此推断原平台 int 的溢出或取模规则。整理版题解自称简版，擅加 mod 10^9+7 且允许单调，因此不作为本题规则依据。两个原样例分别为3和49；第三个公开例为本站补充。

## 动态规划

用前缀和计算段和，比较两段平均值时交叉乘长度，不使用浮点数。rise[i][j] 表示覆盖前j个元素、末段为[i,j)、已经至少上升一次且尚未下降的方案数；fall[i][j] 表示同样末段、已经有上升也有下降并处于下降阶段的方案数。枚举前一段[h,i)：若它的均值严格小于当前段，则只能从rise[h][i]转移；当h=0时可由第一段启动一次上升，额外加1。若前段均值严格大于当前段，可以从rise或fall转入fall。均值相等不转移。最终只累加fall[i][n]。

## 正确性证明

任意划分有唯一的末段和前一段。比较这两段均值后，上升阶段只能接严格更大的均值；首次下降由已有上升状态进入fall，之后只能继续严格下降。首段只能在接上第二个更大均值段时进入rise，因此rise至少有2段，fall至少有3段且两坡均非空。反之，每条转移都产生合法的对应阶段划分，不会允许回升或相等。末段前驱唯一，所以不重计；所有合法划分最终都在某个fall[i][n]中，求和即精确方案数。

## 大整数、复杂度与验证

时间O(n^3)，空间O(n^2)。总切点集合最多2^(n−1)，n=100时计数最多需要100位无符号二进制容量；Python整数、Java BigInteger、C++ boost::multiprecision::cpp_int或Go math/big可直接表示。交叉积绝对值至多10^13，64位足够，但计数不能用64位。

独立小规模oracle枚举全部切点，用Fraction求平均值并枚举内部峰。大边界另用「唯一峰段」分解：分别计算严格递增前缀和严格递减后缀，枚举峰段，两侧必须各至少一个段，组合计数。这与参考的上升/下降阶段递推不同，并使用有理数比较。

严格单调原数组的任意连续段均值也严格单调，所以答案0；全相等亦为0。数组[1,2,…,50,50,…,2,1]的精确答案是526947368435520933960755133783，需要99位，已由两种独立实现一致确认。整体加同一常数不改变任何均值比较，因此其全负平移版本计数相同。
'''
    package = {'schemaVersion': 1, 'problem': {
        'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '分段平均值的严格双坡计数', 'difficulty': '困难', 'tags': ['OA','Rubrik','动态规划','精确计数'],
        'description': '将数组按原顺序切分成至少3个非空连续段，所有段恰好覆盖整个数组。每段以其元素平均值代表。统计代表序列先严格递增、再严格递减的切分方案数：峰必须是内部段，两侧各至少一次严格变化；平均值相等不合法，纯单调序列不合法。不同切点集合视为不同方案。本站明确输出精确整数，不取模、不溢出。原始题面未给取模规则，其starter虽然返回int，但无法覆盖完整计数范围；本站不能据此推断原平台int溢出或取模行为。',
        'input': '第一行n；第二行n个整数arr[i]。完整原约束：2≤n≤100，-10^9≤arr[i]≤10^9。标准输入输出为本站包装。',
        'output': '输出满足要求的划分方案总数，使用精确十进制非负整数。不取模，不按32位或64位溢出处理。n<3时输出0。',
        'explanation': '第一原例有效切分为1|3 2|1、1|3|2 1、1|3|2|1，共3种。第二原例为49。本站第三例[1,2,3]的分段均值只能递增，没有下降，因此为0。',
        'hints': ['以末段左右端点和当前处于上升/下降阶段作为状态。', '平均值比较可交叉相乘；计数需要大整数。', '必须先有严格上升再有严格下降，不能允许空坡。'],
        'timeLimit': 3, 'memoryLimit': 262144, 'outputLimit': 4096, 'checker': 'tokens', 'languages': ['python','go','java','cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node','--import','tsx','-e',normalize], cwd=ROOT, input=json.dumps(package,ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    authored = [{'language':'python','code':REFERENCE}]
    put('packages',f'{PID}.json',json.loads(normalized))
    (OA/'references'/f'{PID}.py').write_text(REFERENCE)
    put('editorials',f'{PID}.json',{'schemaVersion':1,'id':PID,'title':package['problem']['title'],'explanation':editorial,'solutions':authored,'sourceUrl':catalog['sourceUrl'],'sourceContentHash':SOURCE_HASH})
    put('oracles',f'{PID}.json',[{'input':encode(arr),'expectedOutput':f'{expected}\n'} for arr,expected in selected.items()])
    put('mutants',f'{PID}.json',MUTANTS)
    for i,mutant in enumerate(MUTANTS,1):
        (OA/'negative-controls'/f'{PID}-{i}.py').write_text(mutant['code'])
    put('candidate-batches',f'{BATCH}.json',{'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':SOURCE_HASH,'packageChecksum':sha(normalized),'editorial':editorial,'authoredSolutions':authored}]})
    put('source-evidence',f'{BATCH}.json',{'schemaVersion':1,'sourceCommit':COMMIT,'items':[{'id':PID,'sourcePath':SOURCE_PATH,'gitBlob':blob,'sourceSha256':sha(source),'sourceContentHash':SOURCE_HASH,'sourceUrl':catalog['sourceUrl'],'restoredRules':['2≤n≤100，元素±10^9','至少3段，严格先增后减且两坡都非空','两个原始答案3、49'],'siteAdditions':['标准输入输出与第三个公开样例','精确整数、不取模、不溢出；不推断原平台int行为'],'excludedEvidence':'整理版解法明确自称简版，擅加mod并允许单调，与raw不同，不采用。','upstreamCodeExecuted':False}]})
    put('resolutions',f'{BATCH}.json',{'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':SOURCE_HASH,'previousReason':previous['reason'],'reason':'raw完整恢复n≤100、至少3段与严格双坡；本站明示精确不取模计数，不推断starter int行为，不使用整理版简化题解。163唯一Fraction切点oracle、完整小字母枚举、独立峰段大规模oracle与两个正常退出mutant通过，仅候选待沙箱。'}]})
    put('validation',f'{BATCH}.json',{'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':len(selected),'uniqueOracleInputs':len(selected),'publicCases':3,'hiddenCases':len(cases)-3,'formalCases':len(cases),'negativeControls':killed,'referenceSha256':sha(REFERENCE),'oracleMethod':'Fraction全切点枚举并检查内部峰；大规模独立峰段分解与Fraction递增前缀/递减后缀组合','additionalExhaustiveAlphabetCases':exhaustive,'oracleMaxWallSeconds':max(times),'largeBoundaries':large_results}],'note':'163唯一输入与7大边界均真实Python子进程stdin/stdout通过；独立峰段算法与所有小oracle一致；两个mutant正常退出并被拒。仅候选，未运行GoJudge或发布。'})
    print(json.dumps({'id':PID,'oracleCases':len(selected),'formalCases':len(cases),'exhaustiveCases':exhaustive,'largeBoundaries':large_results},ensure_ascii=False))


if __name__ == '__main__':
    main()
