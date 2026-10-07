"""Recover Google #64 using the complete statement on primary/reproduction pages."""
from pathlib import Path
import hashlib
import json
import random
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'
CATALOG = json.loads((ROOT / 'content/oa-master/catalog.json').read_text())
PID = 'oa-google-64'
BATCH = 'google-64-recovered'
SEED = 20261006


def encode(strings):
    return f'{len(strings)}\n' + '\n'.join(strings) + '\n'


def oracle(strings):
    best = 0
    for i in range(len(strings)):
        for j in range(i + 1, len(strings)):
            a, b = strings[i], strings[j]
            k = 0
            while k < min(len(a), len(b)) and a[k] == b[k]:
                k += 1
            best = max(best, len(a) + len(b) - 2 * k)
    return best


REFERENCE = '''import sys
def solve(raw):
    data=raw.split(); n=int(data[0]); strings=data[1:]
    # Each trie node has separate groups for termination, child 0, and child 1.
    children=[[-1,-1] for _ in range(1)]
    terminal=[0]
    max_len=[0]
    for s in strings:
        node=0
        for ch in s:
            bit=ord(ch)-48
            nxt=children[node][bit]
            if nxt<0:
                nxt=len(children); children[node][bit]=nxt
                children.append([-1,-1]); terminal.append(0); max_len.append(0)
            node=nxt
        terminal[node]+=1
        max_len[node]=len(s)
    # Trie node indices are created before their descendants, so reverse order is postorder.
    for node in range(len(children)-1,-1,-1):
        for child in children[node]:
            if child>=0:
                max_len[node]=max(max_len[node],max_len[child])
    answer=0
    # A second pass evaluates distinct groups at each trie node.
    depth=[0]*len(children)
    stack=[0]
    while stack:
        node=stack.pop()
        groups=[]
        if terminal[node]: groups.append(depth[node])
        for child in children[node]:
            if child>=0:
                depth[child]=depth[node]+1; stack.append(child)
                groups.append(max_len[child])
        if len(groups)>=2:
            top=sorted(groups,reverse=True)[:2]
            answer=max(answer,top[0]+top[1]-2*depth[node])
    return str(answer)
print(solve(sys.stdin.read()))
'''

# Two plausible but incorrect, normal-exit variants.
MUTANTS = [
    ('不减公共前缀', REFERENCE.replace('top[0]+top[1]-2*depth[node]', 'top[0]+top[1]', 1)),
    ('只比较相邻输入项', '''import sys
def solve(raw):
    data=raw.split(); n=int(data[0]); strings=data[1:]
    best=0
    for a,b in zip(strings,strings[1:]):
        k=0
        while k<min(len(a),len(b)) and a[k]==b[k]: k+=1
        best=max(best,len(a)+len(b)-2*k)
    return str(best)
print(solve(sys.stdin.read()))
'''),
]


def run(code, raw):
    p = subprocess.run(['python3', '-c', code], input=raw, text=True,
                       capture_output=True, timeout=5)
    if p.returncode:
        raise AssertionError((p.returncode, p.stderr[:300], raw[:200]))
    return p.stdout.strip()


def make_cases():
    samples = [
        ['1011000', '1011110'],
        ['0', '1'],
        ['0', '00', '000'],
    ]
    rng = random.Random(SEED)
    values = list(samples)
    seen = {encode(x) for x in values}
    while len(values) < 120:
        n = rng.randint(2, 18)
        strings = [''.join(rng.choice('01') for _ in range(rng.randint(1, 14)))
                   for _ in range(n)]
        raw = encode(strings)
        if raw not in seen:
            seen.add(raw); values.append(strings)
    return values


def main():
    src = next(x for x in CATALOG['items'] if x['id'] == PID)
    values = make_cases()
    oracle_rows = []
    for strings in values:
        raw = encode(strings)
        expected = str(oracle(strings))
        assert run(REFERENCE, raw) == expected
        oracle_rows.append({'input': raw, 'expectedOutput': expected + '\n'})

    # Large documented bound: 100,000 strings and total length 200,000.
    stress = ['0' * 100001] + ['1'] * 99999
    assert len(stress) == 100000 and sum(map(len, stress)) == 200000
    assert oracle(['0' * 100001, '1']) == 100002
    formal_values = values[:30] + [stress]
    cases = []
    for i, strings in enumerate(formal_values):
        raw = encode(strings)
        expected = str(oracle(strings)) if i < 30 else ''
        if i == 30:
            expected = '100002'
        cases.append({'name': f'样例 {i+1}' if i < 3 else ('最大约束验证' if i == 30 else f'隐藏验证 {i-2}'),
                      'input': raw, 'expectedOutput': expected + '\n',
                      'hidden': i >= 3, 'weight': 1})
    # The large case cannot use quadratic oracle; validate its expected result from its construction.
    for i, (name, code) in enumerate(MUTANTS):
        rejects = [j for j, case in enumerate(cases)
                   if run(code, case['input']) != case['expectedOutput'].strip()]
        assert rejects, f'mutant survived: {name}'

    description = (
        '给定至少两个二进制字符串。两串的距离定义为分别删除它们最长公共前缀后，剩余部分的长度之和；'
        '在不同下标组成的所有字符串对中，返回最大距离。即使两个下标对应相同字符串，也仍是一个合法字符串对。'
    )
    limits = '本站输入范围：2≤N≤100000；每个字符串非空且只含 0/1；所有字符串长度总和≤200000。'
    problem = {
        'id': PID, 'courseId': 'gomall', 'lessonId': '00-overview', 'title': '最大二进制串距离',
        'difficulty': '中等', 'tags': ['OA', 'Google', '字典树', '字符串'],
        'description': description + '\n\n' + limits + '\n\n来源：' + src['sourceUrl'] +
                       '（固定题面指纹 ' + src['contentHash'] + '）。完整语义与边界由 LeetCode 讨论原帖及 FastPrep 同题页交叉核对。',
        'input': '第一行 N；接下来 N 行，每行一个非空二进制字符串。',
        'output': '输出所有下标不同的字符串对中的最大距离。',
        'explanation': '两串长度之和减去最长公共前缀长度的两倍；对所有不同下标的字符串对取最大值。',
        'hints': ['把字符串放入二进制字典树。', '一对字符串的最长公共前缀对应它们在字典树中最后共同经过的节点。', '在每个节点取来自不同分支（包含在该节点结束）的最长串，计算剩余长度之和。'],
        'timeLimit': 2, 'memoryLimit': 262144, 'outputLimit': 4096,
        'checker': 'tokens', 'languages': ['python', 'go', 'java', 'cpp'],
    }
    pkg = {'schemaVersion': 1, 'problem': problem, 'cases': cases}
    norm_js = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    parsed = subprocess.run(['node', '--import', 'tsx', '-e', norm_js], cwd=ROOT,
                            input=json.dumps(pkg, ensure_ascii=False), text=True,
                            capture_output=True, check=True).stdout
    parsed = json.loads(parsed)
    package_bytes = json.dumps(parsed, ensure_ascii=False, separators=(',', ':')).encode()
    explanation = (
        '## 思路\n\n'
        '把字符串插入二进制字典树。对每个节点，分组考虑在该节点结束的字符串和分别进入 0/1 子树的字符串。'
        '来自不同组的两串，其最长公共前缀恰为该节点对应的路径，因此候选距离是两组中最长字符串长度之和减去当前深度的两倍。'
        '每组只需保留最长字符串；相同字符串出现在不同下标时按题意仍可配对，距离为 0。\n\n'
        '## 正确性\n\n'
        '任意一对不同下标字符串有唯一的最后公共 trie 节点：如果一串在此结束，它属于结束组；否则二串进入不同子分支。'
        '反过来，节点的两个不同组中的任意字符串具有恰好等于该节点深度的公共前缀。固定节点和分组后，增大任一字符串长度只会增大距离，所以保留每组最长值即可。'
        '遍历所有节点及其不同组，恰好覆盖所有可能字符串对并取最大值。\n\n'
        '## 复杂度\n\n时间 O(S)，空间 O(S)，S 为字符串总长度。\n\n'
        '## 来源与边界\n\n'
        'LeetCode 原帖明确距离是删除公共前缀后剩余长度之和，并要求在字符串列表中选一对得到最大距离；'
        'FastPrep 同题页补充了 N≤100000、总长度≤200000、二进制非空串，以及相同值但不同列表位置仍可成对的边界。'
        '本站将题面转换为 stdin/stdout；公开样例沿用原始首例，并补充前缀关系和不同首位的用例。'
    )
    authored = REFERENCE
    editorial = {'schemaVersion': 1, 'id': PID, 'title': '最大二进制串距离',
                 'explanation': explanation, 'solutions': [{'language': 'python', 'code': authored}],
                 'sourceUrl': src['sourceUrl'], 'sourceContentHash': src['contentHash'],
                 'author': 'Chunyu Sui'}
    report = {'id': PID, 'oracleCases': len(oracle_rows), 'uniqueOracleInputs': len({x['input'] for x in oracle_rows}),
              'publicCases': 3, 'hiddenCases': len(cases)-3,
              'negativeControls': [{'name': name, 'rejectedByCases': [j for j, case in enumerate(cases)
                                      if run(code, case['input']) != case['expectedOutput'].strip()]}
                                   for name, code in MUTANTS],
              'referenceSha256': hashlib.sha256(authored.encode()).hexdigest()}
    item = {'id': PID, 'sourceContentHash': src['contentHash'],
            'packageChecksum': hashlib.sha256(package_bytes).hexdigest(),
            'editorial': explanation, 'authoredSolutions': editorial['solutions']}
    docs = {
        'packages': (f'{PID}.json', parsed),
        'editorials': (f'{PID}.json', editorial),
        'oracles': (f'{PID}.json', oracle_rows),
        'mutants': (f'{PID}.json', [{'name': n, 'code': c} for n, c in MUTANTS]),
        'references': (f'{PID}.py', authored),
        'candidate-batches': (f'{BATCH}.json', {'schemaVersion': 1, 'items': [item]}),
        'validation': (f'{BATCH}.json', {'schemaVersion': 1, 'seed': SEED, 'problems': [report],
             'note': '本地独立暴力 oracle 对照、最大公开约束构造、两个正常退出错误程序；未连接真实 GoJudge。'}),
        'resolutions': (f'{BATCH}.json', {'schemaVersion': 1, 'items': [{'id': PID,
             'previousReason': '距离定义在“长度之和”处截断，示例却减去公共前缀；多字符串时要求何种聚合也没有说明。',
             'sourceContentHash': src['contentHash'], 'batch': BATCH,
             'reason': 'LeetCode 原始讨论题面明确“删除最长公共前缀后的剩余长度之和”，且要求在不同下标组成的字符串对中取最大距离；FastPrep 同题页面补齐规模与重复值边界。两来源语义一致，原快照样例可复算。'}]}),
        'source-evidence': (f'{BATCH}.json', {'schemaVersion': 1,
             'items': [{'id': PID, 'company': 'Google', 'title': src['title'],
                       'catalogSourceUrl': src['sourceUrl'], 'catalogContentHash': src['contentHash'],
                       'status': 'authored',
                       'sources': [
                         {'url': 'https://leetcode.com/discuss/post/350363/google-oa-2018-max-distance/',
                          'observed': '2026-10-06',
                          'evidence': '原始讨论明确定义为两串分别删除最长公共前缀后剩余长度之和，并要求从列表所有可能的 pair 取最大值。'},
                         {'url': 'https://www.fastprep.io/problems/google-pick-max-distance-pair',
                          'observed': '2026-10-06',
                          'evidence': '同题页补充 2≤N≤10^5、每串非空且仅含二进制字符、总长度≤2×10^5；注明不同列表下标可构成一对，即使字符串值相等。'}]}]}),
    }
    for folder, (filename, doc) in docs.items():
        path = OUT / folder / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(doc, str):
            path.write_text(doc)
        else:
            path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
    print(f'{PID}: {len(oracle_rows)} unique oracle inputs; {len(cases)} formal cases; 2 mutants killed')


if __name__ == '__main__':
    main()
