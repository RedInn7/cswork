#!/usr/bin/env python3
"""Recover eBay6 from immutable OCR: stop, do not skip, at a smaller value."""
from pathlib import Path
from itertools import product
import hashlib
import json
import random
import runpy
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / 'content/oa-judge'
PID = 'oa-ebay-6'
BATCH = 'ebay-6-recovered'
COMMIT = 'e66f809f4c953bce129f68491726176615db6afc'
HASH = 'c31b8244810de21a0fd2761d084c95c8bb4119e2800e8adb56b91dd613614bf6'
SOURCES = [
    ('OA LIST/eBay_OA/027_image.txt', '67d3cda39a72e78f9b96d36fd3504d0ae95b9762', '3fd98ed6f8c5b8784e96192dd8cfd09be937026acb4f6b7eb186a342a5480d79'),
    ('OA LIST/eBay_OA/028_image.txt', '576e38fdf182165b1aa6bf11c0a5d1616b8892a4', 'ceee3b95a21812b54de334a29d23e1ea2ad25cdd5a99dec4ce522e2d957d0cb8'),
    ('OA LIST/eBay_OA/029_image.txt', '4f28833ce1099e40b62c0d126bd510b51f2d6d19', 'c4e757249d9c171d2097a220320ef9d5485fe2938c7e69453f02753355263627'),
    ('OA LIST/eBay_OA/030_image.txt', 'f8b6f4955b56a1921d377a64dcb874b5697a590c', '9f5a1393135379a1387533a4385fe99e10a6014c176c99c259d82e22e130e43d'),
    ('OA LIST/eBay_OA/031_image.txt', '9f7ea3e68a9ee7b7fd0b7612884daefb7a044fe5', '230d6cc6cf56edd76a703721148c7e232348caaa91e8856217afbf3e05354124'),
]
SEED = 20261016
REFERENCE = '''import sys

def solve(raw):
    data = list(map(int, raw.split()))
    a = data[1:]
    answer = 0
    for i in range(len(a)):
        x = a[i]
        if x == 0:
            continue
        answer += x
        for j in range(i, len(a)):
            if a[j] < x:
                break
            a[j] -= x
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
'''
MUTANTS = [
    {'name': '遇较小元素错误跳过并继续扫描', 'code': REFERENCE.replace('if a[j] < x:\n                break', 'if a[j] < x:\n                continue')},
    {'name': '错误把等于阈值也当作阻断', 'code': REFERENCE.replace('if a[j] < x:', 'if a[j] <= x:')},
]
EDITORIAL = '''## 固定原始OCR与整理页纠错

来源为固定提交e66f809f4c953bce129f68491726176615db6afc的OA LIST/eBay_OA/027_image.txt至031_image.txt。027明确规定：找到当前最左非零元素x，从其位置向右尝试减x；如果遇到元素严格小于x，立即转到步骤3（累加x），而不是跳过该元素继续向右。相等时可以相减。031给出完整范围1≤n≤100、0≤numbers[i]≤1000000，允许全零；输出步骤3累计的整数。

公司MDX将“move on to step3”误述为skip，附带三语言代码也继续扫描，造成原例被误判矛盾。本站以连续OCR的正式规则、完整运行轨迹及边界为准，只纠正整理页规则，不修改原始样例答案；没有执行上游代码。标准输入采用n及n个数的两行序列化。

原例1为[3,3,5,2,3]，第一轮减3只作用前三项，遇到2立即停止，得到[0,0,2,2,3]，并非[0,0,2,2,0]；第二轮从第三项减2得到[0,0,0,0,1]；第三轮减1，总6。原例2为[5,5,5,5]，一次全部减5，答案5。第三公开例[4,0,4]为本站补充：中间0严格小于4，会阻断第一轮，最终两次各累加4，结果8。原两个样例保留原输入及输出。

## 思路

维护数组副本，从左向右检查位置i。若为0则跳过；否则记录x=a[i]并累加，将从i开始、所有值都至少为x的最长连续区间逐项减x。遇到第一个小于x的值立即结束本轮。

不必每轮重新从头找非零元素：每轮起点本身恰好减成0，先前位置也始终为0，因此下次从其后一位置继续即可。注意不能跳过区间内部的0；它同其他小于x的数一样阻断本轮扫描。

## 正确性证明

外层循环处理位置i前，所有小于i的位置均为0。若a[i]=0，跳过不会漏掉原算法的起点。若a[i]>0，它正是原算法要求的最左非零元素。内层循环固定x，且仅在当前元素至少为x时相减，第一次遇到较小元素立即停止，所以它执行的修改范围与原步骤2完全相同。每轮恰累加一次x，也与步骤3相同。

相减后位置i归零，且所有更左元素保持0，循环不变式继续成立。每个位置最多成为一次非零起点，因此最多n轮，最终所有位置为0。归纳可知每轮状态与累计结果均与原算法一致，输出正确。

## 复杂度与完整范围

最多n轮，每轮向右扫描至多n项，时间O(n²)，副本空间O(n)。n≤100，最多约一万次内层检查，不需要按数值单位反复减1。每輪x至少使起点减少x，所有数组元素只减不增，故累计结果不超过初始元素总和≤100000000，32位有符号整数足够。全零输入不执行任何轮次，返回0；值1000000和相等值均直接处理。

## 独立验证

163个唯一小输入的oracle使用不可变数组状态：找首个非零项，枚举所有从该处开始且每项至少为x的连续前缀，取最长前缀，整体生成新元组后递归。它不调用参考程序、不复用原地扫描，按原状态转移直接求累计值。另穷举长度1..6、值0..3的全部5460个输入，比较原创参考函数与独立状态oracle，并保存验证输入域与摘要；这部分为同进程穷举，163个oracle和全部正式用例另外执行真实子进程。

正式数据包含两个原例、本站零值阻断例、全零、首尾零、严格递增/递减、重复阈值、交替零与1000000、完整100项随机及多层残余。大型边界使用独立状态oracle并额外验证易知闭式，如100个相同最大值只累加1000000，50个最大值被0隔开得到50000000。两个错误程序分别沿用MDX的skip和错误用≤作为阻断，都要求正常退出并确实输出错误答案。
'''


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def put(folder, name, value):
    path = OA/folder/name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def encode(a):
    return str(len(a))+'\n'+' '.join(map(str, a))+'\n'


def state_oracle(state):
    state = tuple(state)
    if not any(state):
        return 0
    left = next(i for i, value in enumerate(state) if value)
    x = state[left]
    # Enumerate valid prefixes of the immutable state, not the author's loop.
    endpoints = [r for r in range(left+1, len(state)+1) if all(v >= x for v in state[left:r])]
    right = max(endpoints)
    following = state[:left] + tuple(v-x for v in state[left:right]) + state[right:]
    return x + state_oracle(following)


def run(path, raw):
    start = time.perf_counter()
    result = subprocess.run([sys.executable, '-I', str(path)], input=raw, text=True, capture_output=True, check=True, timeout=10)
    assert not result.stderr
    assert len(result.stdout.split()) == 1
    return result.stdout.strip(), time.perf_counter()-start


def main():
    start = time.perf_counter()
    source = next(x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items'] if x['id'] == PID)
    assert source['contentHash'] == HASH
    for path, blob, digest in SOURCES:
        raw = subprocess.check_output(['git', 'show', f'{COMMIT}:{path}'], cwd=ROOT)
        assert sha(raw) == digest
        assert subprocess.check_output(['git', 'hash-object', '--stdin'], input=raw, cwd=ROOT).decode().strip() == blob
    old = next(x for x in json.loads((OA/'coverage.json').read_text())['items'] if x['id'] == PID)
    refpath = OA/f'references/{PID}.py'
    refpath.write_text(REFERENCE)
    own_solve = runpy.run_path(str(refpath))['solve']
    exhaustive_digest = hashlib.sha256()
    exhaustive_count = 0
    for n in range(1, 7):
        for a in product(range(4), repeat=n):
            expected = state_oracle(a)
            text = encode(a)
            assert own_solve(text) == str(expected), a
            exhaustive_digest.update((text+'='+str(expected)+'\n').encode())
            exhaustive_count += 1
    assert exhaustive_count == 5460
    rng = random.Random(SEED)
    small = [[3,3,5,2,3], [5,5,5,5], [4,0,4], [0], [1000000], [0,0,0], [5,2,4], [1,2,3,4], [4,3,2,1], [2,2,0,2,2], [0,4,4,0]]
    keys = {encode(a) for a in small}
    while len(small) < 163:
        a = [rng.randint(0, 15) for _ in range(rng.randint(1, 10))]
        if encode(a) not in keys:
            keys.add(encode(a))
            small.append(a)
    oracles = []
    for a in small:
        expected = state_oracle(a)
        text = encode(a)
        assert run(refpath, text)[0] == str(expected)
        oracles.append({'input': text, 'expectedOutput': str(expected)+'\n'})
    assert [c['expectedOutput'] for c in oracles[:3]] == ['6\n', '5\n', '8\n']
    print(f'{PID}: 5460 exhaustive states and 163 subprocess oracles passed', flush=True)
    cases = [{'name': f'原始OCR样例{i+1}' if i < 2 else ('本站零阻断样例' if i == 2 else f'独立状态{i-2}'), **case, 'hidden': i >= 3, 'weight': 1} for i, case in enumerate(oracles[:34])]
    stress = [
        ('100项全零', [0]*100, 0),
        ('100项全最大', [1000000]*100, 1000000),
        ('100项最大值与零交替', [1000000,0]*50, 50000000),
        ('100项零与最大值交替', [0,1000000]*50, 50000000),
        ('100项递增', list(range(1,101)), 100),
        ('100项递减', list(range(100,0,-1)), 5050),
        ('100项接近上界递增', list(range(999901,1000001)), 1000000),
        ('100项接近上界递减', list(range(1000000,999900,-1)), 99995050),
        ('100项大小阈值交替', [1000000,1]*50, None),
        ('100项两端零重复阈值', [0]+[777777]*98+[0], 777777),
        ('100项重复原例', [3,3,5,2,3]*20, None),
        ('100项完整域固定随机', [rng.randint(0,1000000) for _ in range(100)], None),
        ('100项小值密集随机', [rng.randint(0,7) for _ in range(100)], None),
    ]
    evidence = []
    for name, a, closed in stress:
        expected = state_oracle(a)
        if closed is not None:
            assert expected == closed, name
        text = encode(a)
        actual, elapsed = run(refpath, text)
        assert actual == str(expected), name
        cases.append({'name': name, 'input': text, 'expectedOutput': str(expected)+'\n', 'hidden': True, 'weight': 1})
        evidence.append({'name': name, 'n': len(a), 'minValue': min(a), 'maxValue': max(a), 'expectedOutput': str(expected), 'independentStateOracle': True, 'closedFormChecked': closed is not None, 'localSeconds': round(elapsed, 5)})
    assert len(cases) <= 64 and len({c['input'] for c in cases}) == len(cases)
    for case in cases:
        assert run(refpath, case['input'])[0] == case['expectedOutput'].strip()
    killed = []
    for i, mutant in enumerate(MUTANTS, 1):
        path = OA/f'negative-controls/{PID}-{i}.py'
        path.write_text(mutant['code'])
        rejected = [j for j, case in enumerate(cases) if run(path, case['input'])[0] != case['expectedOutput'].strip()]
        assert rejected
        killed.append({'name': mutant['name'], 'rejectedByCases': rejected, 'normalExitVerified': True})
    package = {'schemaVersion': 1, 'problem': {'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '遇较小值即停止的最左非零减法累计', 'difficulty': '简单', 'tags': ['OA', 'eBay', '模拟'],
        'description': '给定非负整数数组numbers和初始为0的累计结果，重复以下操作：找到当前最左非零元素，其下标为i、值为x；若不存在则结束。从i开始向右扫描，若当前元素至少为x，就将它减去x并继续；若当前元素严格小于x，立即结束本轮扫描，不能跳过该元素继续。扫描到数组末尾也结束本轮。每轮将固定的x加入累计结果，然后重新找最左非零元素。输出最终累计结果。相等时可以相减；0同样会阻断正数x的一轮扫描。',
        'input': '第一行整数n，第二行n个整数numbers[i]。1≤n≤100，0≤numbers[i]≤1000000，允许全零。范围完整来自原始OCR031。',
        'output': '输出最终累计结果整数。结果不超过100000000，不取模。全零数组输出0。',
        'explanation': '前两个公开样例原样保留。样例1依次得到[0,0,2,2,3]、[0,0,0,0,1]、全零，累加3+2+1=6。样例2所有项一次减5，输出5。第三例[4,0,4]为本站推导，中间0阻断扫描，输出8。固定原始OCR明确遇较小值立即转到累计步骤；MDX所写skip及其继续扫描代码是整理错误，本站纠正该误述而未修改原样例。',
        'hints': ['最左非零起点本轮后一定归零。', '严格小于x时必须break，不是continue。', '外层指针只需向右，不必每轮重新从数组首部找起点。'],
        'timeLimit': 2, 'memoryLimit': 131072, 'outputLimit': 64, 'checker': 'tokens', 'languages': ['python','go','java','cpp']}, 'cases': cases}
    normalize = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    normalized = subprocess.run(['node','--import','tsx','-e',normalize], cwd=ROOT, input=json.dumps(package,ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    solutions = [{'language':'python','code':REFERENCE}]
    put('packages', PID+'.json', json.loads(normalized))
    put('oracles', PID+'.json', oracles)
    put('mutants', PID+'.json', MUTANTS)
    put('editorials', PID+'.json', {'schemaVersion':1,'id':PID,'title':'按连续区间模拟并单向推进起点','explanation':EDITORIAL,'solutions':solutions})
    put('candidate-batches', BATCH+'.json', {'schemaVersion':1,'items':[{'id':PID,'sourceContentHash':HASH,'packageChecksum':sha(normalized),'editorial':EDITORIAL,'authoredSolutions':solutions}]})
    put('source-evidence', BATCH+'.json', {'schemaVersion':1,'upstreamCommit':COMMIT,'upstreamRepository':'https://github.com/RedInn7/OA-Master','items':{PID:{'url':source['sourceUrl'],'contentHash':HASH,'catalogContentHash':HASH,'path':SOURCES[0][0],'gitBlobSha':SOURCES[0][1],'rawSha256':SOURCES[0][2],'sources':[{'path':p,'gitBlobSha':b,'sha256':h,'role':r} for (p,b,h),r in zip(SOURCES,['complete algorithm; smaller value ends round','first example input/output','first example complete trajectory','second example input/output','complete numeric constraints'])],'upstreamCodeExecuted':False,'siteAdded':'标准两行n及数组输入；第三公开例为本站补充，原两个例子保持原输入输出。','correction':'Fixed OCR says move on to step3 at first element<x: stop current subtraction scan, not skip. MDX and its code misread this; original sample answer6 is correct.','recoveredConstraints':['1 <= n <= 100','0 <= numbers[i] <= 1000000','all-zero input allowed','first smaller value including zero stops current round'],'answerUpperBound':100000000}}})
    put('resolutions', BATCH+'.json', {'schemaVersion':1,'items':[{'id':PID,'batch':BATCH,'sourceContentHash':HASH,'previousReason':old.get('reason',''),'reason':'原始OCR027明确遇较小元素转步骤3，029完整轨迹佐证原例6正确；MDX的skip误述导致旧blocked。恢复原规则和031完整范围，保留两个原例，5460状态穷举及163子进程oracle通过。仅候选待沙箱。'}]})
    put('validation', BATCH+'.json', {'schemaVersion':1,'seed':SEED,'problems':[{'id':PID,'oracleCases':163,'uniqueOracleInputs':len(keys),'publicCases':3,'hiddenCases':len(cases)-3,'referenceFormalCases':len(cases),'negativeControls':killed,'referenceSha256':sha(REFERENCE),'oracleMethod':'Immutable-state recursion: enumerate all eligible contiguous prefixes and reconstruct the longest-prefix subtraction; no reference function or in-place loop reuse.','exhaustiveSmallDomain':{'lengthMin':1,'lengthMax':6,'valueMin':0,'valueMax':3,'cases':exhaustive_count,'inputExpectedDigest':exhaustive_digest.hexdigest(),'referenceExecution':'in-process own authored reference, separate from163 subprocess checks'},'largeBoundaries':evidence,'subprocessValidation':True,'normalExitChecked':True,'localValidationOnly':True,'elapsedSeconds':round(time.perf_counter()-start,3)}]})
    print(f'{PID}: {len(cases)} formal cases, 163 independent oracle subprocesses, 2 normal-exit mutants; candidate frozen',flush=True)


if __name__ == '__main__':
    main()
