"""Recover Google #65 from its fixed source implementations and validate it."""
from pathlib import Path
import hashlib
import json
import random
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'
CAT = json.loads((ROOT / 'content/oa-master/catalog.json').read_text())
COMMIT = CAT['source']['commit']
PID = 'oa-google-65'
SEED = 20261008


def encode(points, tokens):
    return f'{len(points)}\n' + ' '.join(map(str, points)) + f'\n{tokens}\n'


def oracle(points, tokens):
    return sum(p for p, token in zip(points, tokens) if token == 'T') + sum(
        tokens[i - 1] == tokens[i] == 'T' for i in range(1, len(tokens))
    )


REFERENCE = '''import sys
def solve(raw):
    data=raw.split(); n=int(data[0]); points=list(map(int,data[1:1+n])); tokens=data[1+n]
    score=0
    for i,token in enumerate(tokens):
        if token=='T':
            score+=points[i]
            if i>0 and tokens[i-1]=='T': score+=1
    return str(score)
print(solve(sys.stdin.read()))
'''

MUTANTS = [
    ('漏算连续棋子奖励', REFERENCE.replace("if i>0 and tokens[i-1]=='T': score+=1", "if False: score+=1", 1)),
    ('把连续棋子对重复计分', REFERENCE.replace("if i>0 and tokens[i-1]=='T': score+=1", "if i>0 and token=='T': score+=1", 1)),
]


def run(code, raw):
    p = subprocess.run(['python3', '-c', code], input=raw, text=True, capture_output=True, timeout=3)
    if p.returncode:
        raise AssertionError((p.returncode, p.stderr[:300], raw[:200]))
    return p.stdout.strip()


def main():
    src = next(x for x in CAT['items'] if x['id'] == PID)
    samples = [
        ([4, 1, 2, 2], 'TEET'),
        ([3, 2, 1, 2, 2], 'TTTE'),
        ([2, 2, 2, 2], 'TTTT'),
    ]
    rng = random.Random(SEED)
    values = list(samples)
    seen = {encode(*x) for x in values}
    while len(values) < 120:
        n = rng.randint(1, 100)
        value = ([rng.randint(1, 1000) for _ in range(n)], ''.join(rng.choice('ET') for _ in range(n)))
        raw = encode(*value)
        if raw not in seen:
            values.append(value)
            seen.add(raw)

    oracle_rows = []
    for points, tokens in values:
        raw = encode(points, tokens)
        expected = str(oracle(points, tokens))
        assert run(REFERENCE, raw) == expected
        oracle_rows.append({'input': raw, 'expectedOutput': expected + '\n'})

    # Include diverse fixed-form inputs as hidden cases; total is 30, 27 hidden.
    formal_values = samples + [values[i] for i in range(3, 30)]
    cases = []
    for i, (points, tokens) in enumerate(formal_values):
        raw = encode(points, tokens)
        expected = str(oracle(points, tokens)) + '\n'
        cases.append({'name': f'样例 {i+1}' if i < 3 else f'隐藏验证 {i-2}',
                      'input': raw, 'expectedOutput': expected,
                      'hidden': i >= 3, 'weight': 1})

    killed = []
    mutant_docs = []
    for index, (name, code) in enumerate(MUTANTS, 1):
        rejects = [i for i, case in enumerate(cases)
                   if run(code, case['input']) != case['expectedOutput'].strip()]
        assert rejects, f'mutant survived: {name}'
        killed.append({'name': name, 'rejectedByCases': rejects})
        mutant_docs.append({'name': name, 'code': code})

    description = ('给定等长数组 points 和字符串 tokens。若 tokens[i] 为 T，则获得 points[i] 分；'
                   '每一对相邻且都为 T 的位置额外获得 1 分。返回总分。'
                   '原题前两个示例的 points/tokens/解释/答案互相矛盾；此处按源题 Python、Java、C++ 三份实现统一计分规则并重写样例。')
    limits = '本站输入：1≤N≤100，1≤points[i]≤1000，tokens 仅含 E/T；points 与 tokens 等长。'
    problem = {
        'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '游戏计分',
        'difficulty': '简单', 'tags': ['OA', 'Google', '数组'],
        'description': description + '\n\n' + limits + '\n\n来源：' + src['sourceUrl'] +
                       '（固定题面指纹 ' + src['contentHash'] + '）。',
        'input': '第一行 N；第二行 N 个正整数 points[i]；第三行长度为 N 的字符串 tokens。',
        'output': '输出总分。',
        'explanation': '总分为所有 T 位置对应的 points 之和，加上相邻 TT 对的数量。',
        'hints': ['一次扫描；遇到 T 时累加该位置分数，并检查前一个字符是否也是 T。'],
        'timeLimit': 2, 'memoryLimit': 262144, 'outputLimit': 4096,
        'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp'],
    }
    pkg = {'schemaVersion': 1, 'problem': problem, 'cases': cases}
    norm_js = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    parsed = subprocess.run(['node', '--import', 'tsx', '-e', norm_js], cwd=ROOT,
                            input=json.dumps(pkg, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    parsed = json.loads(parsed)
    package_bytes = json.dumps(parsed, ensure_ascii=False, separators=(',', ':')).encode()
    explanation = ('## 思路\n\n遍历 tokens；遇到 T 时加入对应 points[i]，如果前一位也是 T，再额外加 1。\n\n'
                   '## 正确性\n\n题目规则将总分拆成两部分：每个 T 位置各计一次 points[i]，每一对相邻 TT 各计 1。遍历时每个 T 恰好计入第一部分；除首位外，若当前与前一位都为 T，恰好计入以当前位置结尾的那一对。每一对相邻位置只在右端被检查一次，因此不重不漏。\n\n'
                   '## 复杂度\n\n时间 O(N)，额外空间 O(1)。\n\n## 来源与样例处理\n\n'
                   f"{src['sourceUrl']}。固定快照中的 Python、Java、C++ 实现均明确采用上述规则。原样例1违反 points 下界，且索引/计分解释不符；样例2输出也与其所述规则和三份实现不符。展示样例改为可由规则唯一计算的输入。本站补充 stdin/stdout 协议。")
    editorial = {'schemaVersion': 1, 'id': PID, 'title': '游戏计分', 'explanation': explanation,
                 'solutions': [{'language': 'python', 'code': REFERENCE}], 'sourceUrl': src['sourceUrl'],
                 'sourceContentHash': src['contentHash'], 'author': 'Chunyu Sui'}
    for folder, doc in [('packages', parsed), ('editorials', editorial), ('oracles', oracle_rows),
                        ('mutants', mutant_docs)]:
        (OUT / folder / f'{PID}.json').write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'references' / f'{PID}.py').write_text(REFERENCE)

    batch_item = {'id': PID, 'sourceContentHash': src['contentHash'],
                  'packageChecksum': hashlib.sha256(package_bytes).hexdigest(),
                  'editorial': explanation, 'authoredSolutions': editorial['solutions']}
    report = {'id': PID, 'oracleCases': len(oracle_rows), 'uniqueOracleInputs': len(seen),
              'publicCases': 3, 'hiddenCases': len(cases) - 3,
              'negativeControls': killed, 'referenceSha256': hashlib.sha256(REFERENCE.encode()).hexdigest()}
    source_evidence = {'schemaVersion': 1, 'repository': 'https://github.com/RedInn7/OA-Master',
        'commit': COMMIT,
        'reason': '固定 OAMaster 页面 Git blob 及其目录快照中的题面实现作为来源；未执行源仓库代码。',
        'pages': [{'path': 'web/content/docs/companies/google.mdx',
                   'gitBlobSha': '300032c24800642c2ecedab9d930e86db3cdb54a',
                   'sha256': '22bfaeeadfa0e3dc25aa2a9c46fd9d81981e26f12cd27527fa772ed2237b90a9'}],
        'items': [{'id': PID, 'company': 'Google', 'title': src['title'], 'sourceUrl': src['sourceUrl'],
                   'catalogContentHash': src['contentHash'], 'status': 'authored',
                   'rawPath': 'web/content/docs/companies/google.mdx',
                   'rawGitBlob': '300032c24800642c2ecedab9d930e86db3cdb54a',
                   'semanticEvidence': '同题页面中的 Python、Java、C++ solution 均明确累加所有 T 位置 points[i]，并在相邻两个 T 时加 1。'}]}
    resolution = {'schemaVersion': 1, 'items': [{'id': PID,
        'previousReason': '正文没有计分规则，前两例长度、代币下标、数值与答案互相矛盾，不能仅凭第三例或另一题推定规则。',
        'sourceContentHash': src['contentHash'], 'batch': 'google-65-recovered',
        'reason': '固定源题同一页面内 Python/Java/C++ 三份独立实现给出完全一致、可执行的完整计分定义；按其明确逻辑订正损坏样例，不从别题类推。'}]}
    docs = {
        f'candidate-batches/google-65-recovered.json': {'schemaVersion': 1, 'items': [batch_item]},
        f'validation/google-65-recovered.json': {'schemaVersion': 1, 'seed': SEED,
             'problems': [report], 'note': '仅本地独立 oracle/reference/mutant 验证；无 GoJudge 报告。'},
        f'resolutions/google-65-recovered.json': resolution,
        f'source-evidence/google-65-recovered.json': source_evidence,
    }
    for rel, doc in docs.items():
        (OUT / rel).write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
    print(f'{PID}: {len(oracle_rows)} unique oracle inputs; {len(cases)} formal cases ({len(cases)-3} hidden); {len(killed)} mutants killed')


if __name__ == '__main__':
    main()
