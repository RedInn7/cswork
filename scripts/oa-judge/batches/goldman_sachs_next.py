"""Author and locally validate a focused Goldman Sachs OA batch."""
import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'content/oa-judge'


def words_oracle(case):
    words, queries = case
    answers = []
    for query in queries:
        signature = sorted(query)
        answers.append(' '.join(sorted(word for word in words if sorted(word) == signature)))
    return '\n'.join(answers)


def palindrome_oracle(s):
    count = 0
    for left in range(len(s)):
        for right in range(left + 1, len(s) + 1):
            piece = s[left:right]
            count += piece == piece[::-1]
    return str(count)


def robot_oracle(commands):
    # Simulate four complete repetitions using explicit coordinate vectors.
    # After four repetitions the heading is always restored; a nonzero offset
    # then proves unbounded translation, while zero means the orbit repeats.
    x = y = 0
    dx, dy = 0, 1
    for _ in range(4):
        for command in commands:
            for instruction in command:
                if instruction == 'G':
                    x += dx
                    y += dy
                elif instruction == 'L':
                    dx, dy = -dy, dx
                else:
                    dx, dy = dy, -dx
    return '\n'.join('YES' if x == 0 and y == 0 else 'NO' for _ in [0])


def words_encode(case):
    words, queries = case
    return f'{len(words)}\n' + '\n'.join(words) + f'\n{len(queries)}\n' + '\n'.join(queries) + '\n'


def command_encode(commands):
    return f'{len(commands)}\n' + '\n'.join(commands) + '\n'


def words_batch_oracle(case):
    return words_oracle(case)


def robot_batch_oracle(commands):
    # A single input contains n commands; each output is independently bounded.
    return '\n'.join(robot_oracle([command]) for command in commands)


SPECS = [
    dict(
        id=1,
        title='字母异位词搜索',
        tags=['字符串', '哈希表', '排序'],
        desc='给定单词列表和多个查询词。对每个查询词，找出列表中由相同字母组成的所有单词，并按字典序升序输出。列表中重复出现的单词按出现次数保留。',
        input='第一行 n（1..5000），接下来 n 行为单词；随后一行 q（1..5000），接下来 q 行为查询词。每个单词和查询词长度为 1..100，且只包含小写英文字母。保证每个查询至少有一个匹配单词。',
        idea='将每个单词按字母排序作为异位词签名，建立签名到单词列表的索引。查询时取对应列表并按字典序排序。',
        proof='两个词互为异位词当且仅当排序后的字符序列相同。索引因此恰好收集所有且仅有匹配词；对结果排序满足题意。',
        complexity='令 L 为所有输入字符串的总长度。预处理时间 O(L log 100)，结果排序总计 O(n log n)，空间 O(L)。',
        samples=[
            # Source example's ``dpede`` cannot be an anagram of ``speed``;
            # use the listed intended spelling ``spede`` for the repaired sample.
            (['duel', 'speed', 'dule', 'cars'], ['spede', 'deul']),
            (['tone', 'note', 'enot', 'stone'], ['eont']),
            (['a', 'a', 'b'], ['a']),
        ],
        random=lambda r: (
            [ ''.join(r.choice('abcde') for _ in range(r.randint(1, 7))) for _ in range(r.randint(1, 12)) ],
            [ ''.join(r.choice('abcde') for _ in range(r.randint(1, 7))) for _ in range(r.randint(1, 6)) ],
        ),
        # Random queries need not match; the reference supports an empty line,
        # while published constraints guarantee a match. Keep generated cases valid.
        generate=lambda r: _matching_words_case(r),
        edges=[
            ((['speed', 'spped', 'deeps'], ['speed']), 'deeps speed'),
            ((['bca', 'abc', 'cab'], ['abc']), 'abc bca cab'),
            ((['x'], ['x']), 'x'),
            ((['a'] * 1000, ['a']), ' '.join(['a'] * 1000)),
        ],
        encode=words_encode,
        oracle=words_batch_oracle,
        code='''def solve(raw):
    import sys
    data=raw.split();i=0;n=int(data[i]);i+=1;words=data[i:i+n];i+=n;q=int(data[i]);i+=1;queries=data[i:i+q]
    groups={}
    for word in words:groups.setdefault(''.join(sorted(word)),[]).append(word)
    return '\\n'.join(' '.join(sorted(groups[''.join(sorted(query))])) for query in queries)
''',
        mutants=[
            ('忽略字符出现次数', '''def solve(raw):
    data=raw.split();i=0;n=int(data[i]);i+=1;words=data[i:i+n];i+=n;q=int(data[i]);i+=1;queries=data[i:i+q]
    groups={}
    for word in words:groups.setdefault(''.join(sorted(set(word))),[]).append(word)
    return '\\n'.join(' '.join(sorted(groups.get(''.join(sorted(set(query))),[]))) for query in queries)
'''),
            ('结果未按字典序排序', '''def solve(raw):
    data=raw.split();i=0;n=int(data[i]);i+=1;words=data[i:i+n];i+=n;q=int(data[i]);i+=1;queries=data[i:i+q]
    groups={}
    for word in words:groups.setdefault(''.join(sorted(word)),[]).append(word)
    return '\\n'.join(' '.join(groups[''.join(sorted(query))]) for query in queries)
'''),
        ],
        input_encode=words_encode,
    ),
    dict(
        id=5,
        title='回文子串计数',
        tags=['字符串', '中心扩展'],
        desc='给定仅由小写英文字母组成的字符串，统计其中回文子串的出现次数。相同内容出现在不同位置时分别计数。',
        input='输入一行字符串 s，长度为 1..5000，仅包含小写英文字母。',
        idea='把每个字符位置和相邻字符间隙分别作为回文中心，向两侧扩展；每次左右字符相同就找到一个回文子串。',
        proof='任意回文子串的中心要么是某个字符，要么是两个相邻字符之间的间隙。对所有这两类中心扩展会且只会枚举每个回文子串一次。',
        complexity='时间 O(n²)，额外空间 O(1)（不计输入）。',
        samples=['tacocat', 'aaa', 'abccba'],
        random=lambda r: ''.join(r.choice('abcd') for _ in range(r.randint(1, 15))),
        edges=[('a', '1'), ('a' * 5000, str(5000 * 5001 // 2)), ('ab' * 2500, '6252500'), ('abccba', '9')],
        encode=lambda s: s + '\n',
        oracle=palindrome_oracle,
        code='''def solve(raw):
    s=raw.strip();n=len(s);answer=0
    for center in range(n):
        left=right=center
        while left>=0 and right<n and s[left]==s[right]:answer+=1;left-=1;right+=1
        left=center;right=center+1
        while left>=0 and right<n and s[left]==s[right]:answer+=1;left-=1;right+=1
    return str(answer)
''',
        mutants=[
            ('只统计不同的回文内容', '''def solve(raw):
    s=raw.strip();found=set()
    for left in range(len(s)):
        for right in range(left+1,len(s)+1):
            part=s[left:right]
            if part==part[::-1]:found.add(part)
    return str(len(found))
'''),
            ('遗漏偶数长度中心', '''def solve(raw):
    s=raw.strip();n=len(s);answer=0
    for center in range(n):
        left=right=center
        while left>=0 and right<n and s[left]==s[right]:answer+=1;left-=1;right+=1
    return str(answer)
'''),
        ],
        mutantInputLimit=80,
    ),
    dict(
        id=8,
        title='机器人是否被环绕',
        tags=['模拟', '数学'],
        desc='机器人从坐标 (0,0) 朝北出发，按命令 G（前进一步）、L（原地左转）、R（原地右转）执行。命令串会无限重复。判断机器人轨迹是否始终有界；有界输出 YES，否则输出 NO。',
        input='第一行 n（1..10），接下来 n 行各为一个命令串，长度为 1..2500，只包含 G、L、R。',
        idea='模拟一遍命令，记录位移和最终朝向。如果回到起点，或者最终朝向与初始朝向不同，则重复执行后的位移会周期性抵消，轨迹有界；否则每轮沿同方向累积位移，轨迹无界。',
        proof='每轮结束后的朝向只可能有四种。若朝向改变，至多四轮后朝向复原，且这四轮的位移按旋转对称相加为零；之后状态重复。若朝向未变，非零位移会在每轮同向累积而无界，零位移则位置始终不变。',
        complexity='每个命令串时间 O(L)，额外空间 O(1)。',
        samples=[['G', 'GL', 'GRGRGRGR'], ['R'], ['GLGLGLGL']],
        random=lambda r: [ ''.join(r.choice('GLR') for _ in range(r.randint(1, 24))) for _ in range(r.randint(1, 6)) ],
        edges=[(['G'], 'NO'), (['GL'], 'YES'), (['GGGG' + 'R'], 'YES'), (['R' * 2500], 'YES')],
        encode=command_encode,
        oracle=robot_batch_oracle,
        code='''def solve(raw):
    data=raw.split();n=int(data[0]);commands=data[1:1+n];answers=[]
    dx=[0,1,0,-1];dy=[1,0,-1,0]
    for command in commands:
        x=y=direction=0
        for step in command:
            if step=='G':x+=dx[direction];y+=dy[direction]
            elif step=='L':direction=(direction+3)%4
            else:direction=(direction+1)%4
        answers.append('YES' if (x==0 and y==0) or direction!=0 else 'NO')
    return '\\n'.join(answers)
''',
        mutants=[
            ('忽略转向指令', '''def solve(raw):
    data=raw.split();n=int(data[0]);answers=[]
    for command in data[1:1+n]:answers.append('YES' if command.count('G')==0 else 'NO')
    return '\\n'.join(answers)
'''),
            ('只检查是否改变朝向', '''def solve(raw):
    data=raw.split();n=int(data[0]);answers=[]
    for command in data[1:1+n]:
        direction=0
        for step in command:
            if step=='L':direction=(direction+3)%4
            elif step=='R':direction=(direction+1)%4
        answers.append('YES' if direction!=0 else 'NO')
    return '\\n'.join(answers)
'''),
        ],
    ),
]

# Keep the first public batch inside the current judge's hard output cap.
# Goldman #1 allows up to 5,000 queries over 5,000 words of length 100, so an
# otherwise legal output can exceed 2 GB while this runner caps output at 64 MB.
SPECS = [spec for spec in SPECS if spec['id'] in (5, 8)]


def _matching_words_case(rng):
    alphabet = 'abcde'
    words = [''.join(rng.choice(alphabet) for _ in range(rng.randint(1, 7))) for _ in range(rng.randint(1, 12))]
    queries = []
    for _ in range(rng.randint(1, 6)):
        chosen = rng.choice(words)
        chars = list(chosen)
        rng.shuffle(chars)
        queries.append(''.join(chars))
    return words, queries


def execute(file, stdin):
    result = subprocess.run([sys.executable, '-I', str(file)], input=stdin, text=True,
                            capture_output=True, timeout=8, check=True)
    return result.stdout.rstrip('\n')


def main():
    for folder in ('packages', 'editorials', 'references', 'oracles', 'mutants',
                   'negative-controls', 'reviews', 'candidate-batches', 'validation'):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    catalog = json.loads((ROOT / 'content/oa-master/catalog.json').read_text())
    sources = {item['id']: item for item in catalog['items']}
    batch_items, validations = [], []
    for spec in SPECS:
        identifier = f"oa-goldman-sachs-{spec['id']}"
        rng = random.Random(20260923 + spec['id'])
        code = textwrap.dedent(spec['code']) + '\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
        reference = OUT / 'references' / f'{identifier}.py'
        reference.write_text(code)
        sample_values = spec['samples']
        random_values = [spec['generate'](rng) if 'generate' in spec else spec['random'](rng) for _ in range(160)]
        oracle_values = sample_values + random_values
        oracle_cases = []
        for value in oracle_values:
            expected = spec['oracle'](value)
            stdin = spec['input_encode'](value) if 'input_encode' in spec else spec['encode'](value)
            actual = execute(reference, stdin)
            assert actual == expected, (identifier, value, expected, actual)
            oracle_cases.append(dict(input=stdin, expectedOutput=expected + '\n'))
        cases = list(oracle_cases[:3])
        for value, expected in spec['edges']:
            stdin = spec['input_encode'](value) if 'input_encode' in spec else spec['encode'](value)
            actual = execute(reference, stdin)
            assert actual == expected, (identifier, value, expected, actual)
            cases.append(dict(input=stdin, expectedOutput=expected + '\n'))
        cases.extend(oracle_cases[3:27])
        cases = [dict(name=f'样例 {i + 1}' if i < 3 else f'隐藏验证 {i - 2}', **case, hidden=i >= 3, weight=1)
                 for i, case in enumerate(cases)]
        mutant_documents, kills = [], []
        for mutation_index, (label, mutant_source) in enumerate(spec['mutants'], 1):
            full_mutant = textwrap.dedent(mutant_source) + '\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
            mutant_path = OUT / 'negative-controls' / f'{identifier}-{mutation_index}.py'
            mutant_path.write_text(full_mutant)
            rejected = [index for index, case in enumerate(cases)
                        if len(case['input']) <= spec.get('mutantInputLimit', 100000)
                        and execute(mutant_path, case['input']) != case['expectedOutput'].rstrip('\n')]
            assert rejected, (identifier, label, 'negative control survived')
            mutant_documents.append(dict(name=label, code=full_mutant))
            kills.append(dict(name=label, rejectedByCases=rejected))

        problem = dict(
            id=identifier, courseId='gomall', lessonId='00-overview', title=spec['title'],
            difficulty='简单' if spec['id'] != 5 else '中等',
            tags=['OA', 'Goldman Sachs'] + spec['tags'],
            description=spec['desc'] + '\n\n输入协议、样例与评测数据由 CSWork 按原函数题意整理。',
            input=spec['input'],
            output=('每个查询一行，输出该查询对应的匹配单词，按字典序排列并以空格分隔。' if spec['id'] == 1 else
                    '输出回文子串出现次数。' if spec['id'] == 5 else
                    '对每个命令串按输入顺序输出 YES 或 NO，每行一个结果。'),
            explanation='输出按题目规则计算的结果；完整算法说明见题解。',
            hints=[spec['idea']], timeLimit=3, memoryLimit=262144, outputLimit=4096,
            checker='tokens', languages=['python', 'go', 'java', 'cpp'])
        raw = dict(schemaVersion=1, problem=problem, cases=cases)
        normalized = subprocess.run(
            ['node', '--import', 'tsx', '-e',
             "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],
            cwd=ROOT, input=json.dumps(raw, ensure_ascii=False), text=True,
            capture_output=True, check=True).stdout
        editorial = f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        authored = [dict(language='python', code=code)]
        output_docs = [
            ('packages', json.loads(normalized)),
            ('oracles', oracle_cases),
            ('mutants', mutant_documents),
            ('editorials', dict(schemaVersion=1, id=identifier, title=spec['title'], explanation=editorial,
                                solutions=authored, sourceUrl=sources[identifier]['sourceUrl'],
                                sourceContentHash=sources[identifier]['contentHash'], author='CSWork')),
        ]
        for folder, document in output_docs:
            (OUT / folder / f'{identifier}.json').write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
        batch_items.append(dict(id=identifier, sourceContentHash=sources[identifier]['contentHash'],
                                packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),
                                editorial=editorial, authoredSolutions=authored))
        validations.append(dict(id=identifier, oracleCases=len(oracle_cases), publicCases=3,
                                hiddenCases=len(cases) - 3, negativeControls=kills,
                                referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        print(f'{identifier}: {len(oracle_cases)} reference/oracle checks; {len(cases)} judge cases; mutants rejected', flush=True)

    batch = dict(schemaVersion=1, items=batch_items)
    (OUT / 'candidate-batches/goldman-sachs-next.json').write_text(json.dumps(batch, ensure_ascii=False, indent=2) + '\n')
    skipped = {
        'oa-goldman-sachs-1': '源站查询词示例存在笔误；且原 n/q 上界允许输出超过当前判题器 64MB 上限，不能缩窄原约束或宣称全域可判，暂缓。',
        'oa-goldman-sachs-2': '约束文本损坏（字符/频次约束无法可靠恢复），不擅自补全原始输入范围。',
        'oa-goldman-sachs-3': '最大长度约束原文损坏为“1 5”，无法据此确认输入上限。',
        'oa-goldman-sachs-4': '约束中的 n、p 与源函数输入结构关系不清，避免擅自定义原题范围。',
        'oa-goldman-sachs-6': '本次首批最多四题，按编号优先级暂缓；题面本身未发现阻断性歧义。',
        'oa-goldman-sachs-7': '输入字符约束损坏，且原文未给可复现的编码样例/输入协议，暂不猜编码规则。',
    }
    review_items = []
    for number in range(1, 9):
        key = f'oa-goldman-sachs-{number}'
        source = sources[key]
        if number in (5, 8):
            reason = {
                1: '题意、字符域、字符串长度与 n/q 上限明确。原样例查询 dpede 与 speed 并非异位词，与题面保证及输出冲突；按解释中意图将本站样例更正为 spede。本站补充标准输入输出：n 行 words、q 行 queries，每条结果一行，匹配词按字典序空格分隔；重复词按列表出现次数保留。',
                5: '题意与 n≤5000、小写字母域明确。原文约束的“5000each”仅排版缺空格，结合变量 s 可无歧义恢复为长度上限与字符域；本站补充为单行字符串输入及整数输出。',
                8: '命令语义、字符域与数量/长度上限明确。本站补充 n 行命令串输入和按顺序逐行 YES/NO 输出。',
            }[number]
            status = 'authored'
        else:
            reason = skipped[key]
            status = 'blocked'
        review_items.append(dict(id=key, status=status, reason=reason,
                                 catalogContentHash=source['contentHash']))
    (OUT / 'reviews/goldman-sachs-next.json').write_text(json.dumps(dict(schemaVersion=1, items=review_items), ensure_ascii=False, indent=2) + '\n')
    validation = dict(schemaVersion=1, seed=20260923, problems=validations, skipped=skipped,
                      note='Local authored-code/oracle checks only; this is not sandbox acceptance and does not enable online submission.')
    (OUT / 'validation/goldman-sachs-next.json').write_text(json.dumps(validation, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
