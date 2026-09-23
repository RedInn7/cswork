"""Authored Databricks 3, 5, 6, 7 judge packages; no imported solutions are run."""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys

import amazon_remaining_h as helper

ROOT = helper.ROOT
OUT = helper.OUT
BATCH = 'databricks-next'
SEED = 20260923
RAW_EVIDENCE = {
    3: ('OA LIST/Databricks_OA/007_image.txt', '30eb891ece4addf21fa87e9adfb4382bad9e05d6'),
    5: ('OA LIST/Databricks_OA/011_QQ_1738388130748.txt', '2f0a399f52a3bf4bcab00cf551f35969e079f01e'),
    6: ('OA LIST/Databricks_OA/016_image.txt', 'c4718cd32554183b2a89cf93f3d4ba2fff324591'),
    7: ('OA LIST/Databricks_OA/019_image.txt', '1feeed6d4662cbd7ab31ccec76070c01a6c274a2'),
}


def solve_binary(data):
    it = iter(map(str, data.split()))
    n, q = int(next(it)), int(next(it))
    bits = next(it)
    zero_prefix = [0] * (n + 1)
    for i, bit in enumerate(bits):
        zero_prefix[i + 1] = zero_prefix[i] + (bit == '0')
    flipped = False
    answers = []
    for _ in range(q):
        request = next(it)
        if request == 'flip':
            flipped = not flipped
        else:
            index = int(request)
            zeros = zero_prefix[index + 1]
            answers.append(index + 1 - zeros if flipped else zeros)
    return ' '.join(map(str, answers))


def binary_oracle(case):
    bits, requests = case
    bits = list(bits)
    out = []
    for request in requests:
        if request == 'flip':
            bits = ['1' if bit == '0' else '0' for bit in bits]
        else:
            index = int(request[6:])
            out.append(sum(bit == '0' for bit in bits[:index + 1]))
    return ' '.join(map(str, out))


def binary_encode(case):
    bits, requests = case
    rows = [f'{len(bits)} {len(requests)}', bits]
    rows += ['flip' if r == 'flip' else f'count {r[6:]}' for r in requests]
    return '\n'.join(rows) + '\n'


def random_binary(rng):
    n = rng.randint(1, 15)
    bits = ''.join(rng.choice('01') for _ in range(n))
    requests = []
    for _ in range(rng.randint(0, 20)):
        if rng.random() < .35:
            requests.append('flip')
        else:
            requests.append(f'count:{rng.randrange(n)}')
    return bits, requests


def solve_rectangles(data):
    values = list(map(int, data.split()))
    q, p = values[0], 1
    max_short = max_long = 0
    answers = []
    for _ in range(q):
        kind, a, b = values[p:p + 3]
        p += 3
        short, long = min(a, b), max(a, b)
        if kind == 0:
            max_short = max(max_short, short)
            max_long = max(max_long, long)
        else:
            answers.append('1' if max_short <= short and max_long <= long else '0')
    return '\n'.join(answers)


def rectangles_oracle(ops):
    saved = []
    out = []
    for kind, a, b in ops:
        if kind == 0:
            saved.append((a, b))
        else:
            short, long = min(a, b), max(a, b)
            out.append('1' if all(min(x, y) <= short and max(x, y) <= long for x, y in saved) else '0')
    return '\n'.join(out)


def rectangles_encode(ops):
    return str(len(ops)) + '\n' + ''.join(f'{t} {a} {b}\n' for t, a, b in ops)


def random_rectangles(rng):
    ops = []
    for _ in range(rng.randint(1, 20)):
        if not ops or rng.random() < .56:
            ops.append((0, rng.randint(1, 20), rng.randint(1, 20)))
        else:
            ops.append((1, rng.randint(1, 20), rng.randint(1, 20)))
    ops.append((1, rng.randint(1, 20), rng.randint(1, 20)))
    return ops


def solve_obstacles(data):
    from bisect import bisect_left

    tokens = list(map(int, data.split()))
    q, pos = tokens[0], 1
    ops = []
    coords = []
    for _ in range(q):
        kind = tokens[pos]
        size = 2 if kind == 1 else 3
        op = tuple(tokens[pos:pos + size])
        pos += size
        ops.append(op)
        if kind == 1:
            coords.append(op[1])
    coords.sort()
    bit = [0] * (len(coords) + 1)

    def prefix(index):
        total = 0
        while index:
            total += bit[index]
            index -= index & -index
        return total

    out = []
    for op in ops:
        if op[0] == 1:
            i = bisect_left(coords, op[1]) + 1
            while i < len(bit):
                bit[i] += 1
                i += i & -i
        else:
            x, size = op[1], op[2]
            left = bisect_left(coords, x - size)
            right = bisect_left(coords, x)
            out.append('1' if prefix(right) == prefix(left) else '0')
    return ''.join(out)


def obstacles_oracle(ops):
    obstacles = set()
    out = []
    for op in ops:
        if op[0] == 1:
            obstacles.add(op[1])
        else:
            _, x, size = op
            out.append('0' if any(x - size <= obstacle < x for obstacle in obstacles) else '1')
    return ''.join(out)


def obstacles_encode(ops):
    return str(len(ops)) + '\n' + ''.join(' '.join(map(str, op)) + '\n' for op in ops)


def random_obstacles(rng):
    ops = []
    inserted = set()
    for _ in range(rng.randint(1, 20)):
        if rng.random() < .5:
            x = rng.randint(-15, 15)
            if x not in inserted:
                inserted.add(x)
                ops.append((1, x))
                continue
        ops.append((2, rng.randint(-15, 15), rng.randint(1, 12)))
    ops.append((2, rng.randint(-15, 15), rng.randint(1, 12)))
    return ops


def y_oracle(matrix):
    n = len(matrix)
    mid = n // 2
    best = n * n + 1
    for y_digit in range(3):
        for background in range(3):
            if y_digit == background:
                continue
            changes = 0
            for r in range(n):
                for c in range(n):
                    is_y = (r <= mid and c in (r, n - 1 - r)) or (r > mid and c == mid)
                    target = y_digit if is_y else background
                    changes += matrix[r][c] != target
            best = min(best, changes)
    return best


def solve_y(data):
    vals = list(map(int, data.split()))
    n = vals[0]
    mid = n // 2
    inside = [0, 0, 0]
    outside = [0, 0, 0]
    for r in range(n):
        for c in range(n):
            is_y = (r <= mid and c in (r, n - 1 - r)) or (r > mid and c == mid)
            (inside if is_y else outside)[vals[1 + r * n + c]] += 1
    return str(min(n * n - inside[y] - outside[b] for y in range(3) for b in range(3) if y != b))


def encode_matrix(matrix):
    n = len(matrix)
    return str(n) + '\n' + '\n'.join(' '.join(map(str, row)) for row in matrix) + '\n'


def random_y(rng):
    n = rng.choice([1, 3, 5, 7, 9])
    return [[rng.randrange(3) for _ in range(n)] for _ in range(n)]


def matrix_from_rows(*rows):
    return [[int(value) for value in row] for row in rows]


SPECS = [
    dict(
        number=3,
        title='二进制串翻转与前缀零计数',
        desc='给定一个由 0 和 1 组成的字符串，依次处理操作。`flip` 把整个字符串的 0 与 1 互换；`count i` 查询当前字符串从下标 0 到 i（含 i）中 0 的个数。',
        limits='第一行 n q（1≤n≤200000，0≤q≤8000）；第二行长度为 n 的二进制串；随后 q 行操作：`flip` 或 `count i`，其中 0≤i<n。q 和下标范围是本站补充，用于明确标准输入协议并保证标准输出不超过评测上限。',
        output='按查询出现顺序输出各个计数，以空格分隔；没有 count 操作时输出空行。',
        idea='先计算初始字符串的 0 前缀和。全串翻转只改变一个布尔状态；查询位置 i 时，未翻转答案是原前缀 0 数，已翻转答案是 (i+1) 减原前缀 0 数。',
        proof='初始前缀和准确记录每个位置之前的 0 个数。一次全串翻转会把该前缀内的每个 0 与 1 互换，因此 0 数变为前缀长度减原 0 数。多次翻转只取决于翻转次数的奇偶；逐个操作按此规则输出，正好等价于实际修改整串后重新计数。',
        complexity='时间 O(n+q)，空间 O(n)。',
        samples=[
            ('1111010', ['count:4', 'count:6', 'flip', 'count:4', 'flip', 'count:2']),
            ('0000', ['count:0', 'flip', 'count:3', 'flip', 'count:1']),
            ('1', ['flip', 'count:0', 'flip', 'count:0']),
        ],
        random=random_binary, encode=binary_encode, oracle=binary_oracle,
        edges=[
            (('0' * 200000, ['count:0', 'count:199999']), '1 200000'),
            (('1' * 200000, ['flip'] * 7999 + ['count:199999']), '200000'),
        ],
        code='''def solve(data):
    it=iter(map(str,data.split())); n=int(next(it)); q=int(next(it)); bits=next(it)
    zero=[0]*(n+1)
    for i,ch in enumerate(bits): zero[i+1]=zero[i]+(ch=='0')
    flipped=False; answer=[]
    for _ in range(q):
        op=next(it)
        if op=='flip': flipped=not flipped
        else:
            i=int(next(it)); z=zero[i+1]
            answer.append(str(i+1-z if flipped else z))
    return ' '.join(answer)
''',
        mutants=[
            ('不包含查询下标', "z=zero[i+1]", "z=zero[i]"),
            ('翻转后仍返回原计数', 'i+1-z if flipped else z', 'z'),
        ], bound=310040, time=4, outputLimit=65536,
    ),
    dict(
        number=5,
        title='可旋转矩形逐个装入查询框',
        desc='依次执行两种操作：`0 a b` 保存一个 a×b 矩形；`1 a b` 查询之前保存的每个矩形能否各自放入 a×b 查询框。矩形允许旋转 90 度；每个矩形分别放入，不要求同时装入同一个框。',
        limits='第一行 q（1≤q≤30000）；随后 q 行各含 kind、a、b。kind 为 0 或 1，1≤a,b≤10⁹。以上范围为本站补充，以保证最坏情况下的输出长度不超过评测器限制。',
        output='每个查询操作输出一行：能放入输出 1，否则输出 0。没有已保存矩形时，查询结果为 1。',
        idea='把矩形与查询框的边都按短边、长边规范化。维护所有已存矩形短边最大值和长边最大值；查询框能容纳全部矩形，当且仅当这两个最大值分别不超过查询框的对应边。',
        proof='旋转允许任意矩形以短边对短边、长边对长边比较。每个已存矩形可装入查询框，当且仅当其短边≤查询短边且长边≤查询长边。要让所有已存矩形满足这两个条件，分别等价于保存短边最大值和长边最大值均不超过查询边；保存操作持续维护的最大值正好是全体历史矩形的最大值。',
        complexity='时间 O(q)，额外空间 O(1)。',
        samples=[
            [(0, 1, 3), (0, 4, 2), (1, 3, 4), (1, 3, 2)],
            [(1, 1, 1), (0, 2, 5), (1, 5, 2), (1, 4, 2)],
            [(0, 2, 2), (0, 3, 1), (1, 3, 2), (1, 3, 3)],
        ],
        random=random_rectangles, encode=rectangles_encode, oracle=rectangles_oracle,
        edges=[
            ([(0, 10**9, 1), (1, 1, 10**9), (1, 999999999, 999999999)], '1 0'),
            ([(0, 100, 100)] + [(0, 1, 1)] * 14999 + [(1, 10, 10)] * 15000, '0\n' * 15000),
        ],
        code='''def solve(data):
    v=list(map(int,data.split())); q=v[0]; p=1; short_max=long_max=0; out=[]
    for _ in range(q):
        kind,a,b=v[p:p+3]; p+=3; short,long=sorted((a,b))
        if kind==0: short_max=max(short_max,short); long_max=max(long_max,long)
        else: out.append('1' if short_max<=short and long_max<=long else '0')
    return '\\n'.join(out)
''',
        mutants=[
            ('不允许旋转', "short,long=sorted((a,b))", "short,long=a,b"),
            ('只检查最新矩形', 'short_max=max(short_max,short); long_max=max(long_max,long)', 'short_max=short; long_max=long'),
        ], bound=1500020, time=4, outputLimit=65536,
    ),
    dict(
        number=6,
        title='数轴障碍与区间放置查询',
        desc='在整数数轴上依次放置障碍或查询一个长度为 size 的区间能否放置。`1 x` 在 x 放置障碍（保证该处之前没有障碍）；`2 x size` 检查整数坐标 x-size 到 x-1（含端点），不实际放置区间。',
        limits='第一行 q（1≤q≤60000）；随后 q 行操作 `1 x` 或 `2 x size`。−10⁹≤x≤10⁹，1≤size≤10⁹。插入坐标保证此前未被占用；q 上界是本站补充，以保证输出长度受评测器限制。',
        output='按顺序把每次 `2 x size` 的结果连成一个仅含 0、1 的字符串：区间无障碍为 1，否则为 0。',
        idea='预读全部插入坐标并离散化，用树状数组维护已插入点。对查询区间 [x-size,x)，用二分和前缀和求障碍数量；数量为零时即可放置。',
        proof='离散化保留插入坐标的顺序。对 [x-size,x) 的左右边界分别作 lower_bound，可得其中障碍的树状数组索引区间；前缀和差正好是当前已插入在 [x-size,x-1] 内的障碍数量。只有计数为零时区间可用，查询本身不修改树状数组。',
        complexity='时间 O(q log q)，空间 O(q)。',
        samples=[
            [(1, 2), (1, 5), (2, 5, 2), (2, 6, 3), (2, 2, 1), (2, 3, 2)],
            [(2, 0, 1), (1, 0), (2, 0, 1)],
            [(1, -2), (2, -3, 1), (2, -3, 2)],
        ],
        random=random_obstacles, encode=obstacles_encode, oracle=obstacles_oracle,
        edges=[
            ([(1, -10**9), (2, 0, 10**9), (2, -999999999, 1)], '00'),
            ([(1, 5), (2, 5, 1)], '1'),
            ([(1, i) for i in range(-29999, 30000)] + [(2, 0, 60000)], '0'),
        ],
        code='''def solve(data):
    from bisect import bisect_left
    v=list(map(int,data.split())); q=v[0]; p=1; ops=[]; coords=[]
    for _ in range(q):
        kind=v[p]; size=2 if kind==1 else 3; op=tuple(v[p:p+size]); p+=size; ops.append(op)
        if kind==1: coords.append(op[1])
    coords.sort(); bit=[0]*(len(coords)+1)
    def prefix(i):
        total=0
        while i: total+=bit[i]; i-=i&-i
        return total
    out=[]
    for op in ops:
        if op[0]==1:
            i=bisect_left(coords,op[1])+1
            while i<len(bit): bit[i]+=1; i+=i&-i
        else:
            _,x,size=op; left=bisect_left(coords,x-size); right=bisect_left(coords,x)
            out.append('1' if prefix(right)==prefix(left) else '0')
    return ''.join(out)
''',
        mutants=[
            ('错误地把右端点 x 算入区间', 'right=bisect_left(coords,x)', 'right=bisect_left(coords,x+1)'),
            ('忽略区间左端障碍', 'left=bisect_left(coords,x-size)', 'left=bisect_left(coords,x-size+1)'),
        ], bound=1500020, time=6, outputLimit=65536,
    ),
    dict(
        number=7,
        title='修改最少格子绘制字母 Y',
        desc='给定奇数阶方阵，格子值只会是 0、1、2。选择一个数字作为 Y 的数字：上半部为左上到中心、右上到中心的两条对角线，中心以下为中间列；Y 外所有格子统一为另一个且不同的数字。求最少需要修改多少格。',
        limits='第一行奇数 n（1≤n≤99）；随后 n 行，每行 n 个 0、1 或 2。n 的上界是本站补充。',
        output='输出最少修改格数。',
        idea='逐格判断它是否属于 Y，统计 Y 内和 Y 外各自的 0、1、2 个数。枚举六种不同的 (Y 数字, 背景数字)，计算不匹配格数并取最小。',
        proof='任一合法目标矩阵都由唯一的一对不同数字决定：Y 数字和背景数字。固定这对数字后，每个位置必须变为其所属区域的指定值，修改代价正是当前值与指定值不同的位置数。六种组合覆盖全部合法方案，取最小即为全局最优。',
        complexity='时间 O(6n²)，额外空间 O(1)。',
        samples=[
            matrix_from_rows('101', '212', '212'),
            matrix_from_rows('00000', '00000', '00000', '00000', '00000'),
            matrix_from_rows('012', '120', '201'),
        ],
        random=random_y, encode=encode_matrix, oracle=y_oracle,
        edges=[
            ([[0 if (r <= 49 and c in (r, 98-r)) or (r > 49 and c == 49) else 2 for c in range(99)] for r in range(99)], 0),
            ([[0] * 99 for _ in range(99)], 148),
        ],
        code='''def solve(data):
    v=list(map(int,data.split())); n=v[0]; mid=n//2
    inside=[0]*3; outside=[0]*3
    for r in range(n):
        for c in range(n):
            is_y=(r<=mid and c in (r,n-1-r)) or (r>mid and c==mid)
            group=inside if is_y else outside; group[v[1+r*n+c]]+=1
    return str(min((n*n-inside[y]-outside[b]) for y in range(3) for b in range(3) if y!=b))
''',
        mutants=[
            ('把 Y 两条斜线延伸到下半部', "r<=mid and c in (r,n-1-r)", "c in (r,n-1-r)"),
            ('允许 Y 和背景使用同一数字', 'if y!=b', 'if True'),
        ], bound=20020, time=4,
    ),
]


def main():
    for folder in ('packages', 'references', 'oracles', 'mutants', 'negative-controls', 'editorials', 'candidate-batches', 'validation', 'reviews'):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    sources = {item['id']: item for item in json.loads((ROOT / 'content/oa-master/catalog.json').read_text())['items']}
    batch_items, report_rows, review_rows, skipped = [], [], [], {
        'oa-databricks-1': '原始题面写“不超过两次交换”且含 0，但整理页改成恰好一次、相同位数；交换产生前导零是否去掉未定义，样例也不能判定，暂停。',
        'oa-databricks-2': '原始对角线方向文字、题解轨迹和两个公开样例的权重排序结果互相冲突，无法在不擅自改题的情况下确定答案，暂停。',
        'oa-databricks-4': '动态等差三元组未说明 diff 是否允许为 0，也未定义同值位置三元组的计数方式；现有增量解在 diff=0 时不能直接套用，暂停。',
        'oa-databricks-8': '圈速并列淘汰后若未淘汰人数不足，最终顺序规则缺失；一份原例的圈速与其淘汰解释也不一致，暂停。',
    }
    for spec in SPECS:
        ident = f"oa-databricks-{spec['number']}"
        source = sources[ident]
        if spec['number'] == 3:
            ref = spec['code']
            run_code = ref + "\nif __name__=='__main__':\n import sys\n print(solve(sys.stdin.read()))\n"
            cases = [dict(input=spec['encode'](x), expectedOutput=spec['oracle'](x) + '\n') for x in spec['samples'] + [spec['random'](random.Random(SEED + spec['number'] + i)) for i in range(160)]]
        else:
            ref = spec['code']
            run_code = ref + "\nif __name__=='__main__':\n import sys\n print(solve(sys.stdin.read()))\n"
            cases = [dict(input=spec['encode'](x), expectedOutput=str(spec['oracle'](x)) + '\n') for x in spec['samples'] + [spec['random'](random.Random(SEED + spec['number'] + i)) for i in range(160)]]
        reference = OUT / 'references' / f'{ident}.py'
        reference.write_text(run_code)
        edge_tests = [dict(input=spec['encode'](x), expectedOutput=(y if spec['number'] == 3 else str(y)) + '\n') for x, y in spec['edges']]
        tests = cases[:3] + edge_tests + cases[3:31]
        assert len(cases) == 163 and len(tests) >= 33
        for case in cases + tests:
            assert len(case['input'].encode()) <= spec['bound'], (ident, len(case['input'].encode()), spec['bound'])
        actual = helper.execute(reference, [case['input'] for case in cases + tests])
        for i, (output, case) in enumerate(zip(actual, cases + tests)):
            assert output.split() == case['expectedOutput'].split(), (ident, i, output[:200], case['expectedOutput'][:200])
        package_cases = [dict(name=f'样例 {i+1}' if i < 3 else f'边界与组合 {i-2}', **case, hidden=i >= 3, weight=1) for i, case in enumerate(tests)]
        mutants, killed = [], []
        for j, (name, old, new) in enumerate(spec['mutants'], 1):
            assert old in run_code, (ident, name, old)
            mutant_code = run_code.replace(old, new)
            mutant_path = OUT / 'negative-controls' / f'{ident}-{j}.py'
            mutant_path.write_text(mutant_code)
            outputs = helper.execute(mutant_path, [case['input'] for case in package_cases])
            bad = [i for i, (output, case) in enumerate(zip(outputs, package_cases)) if output.split() != case['expectedOutput'].split()]
            assert bad, (ident, name, 'mutant survived')
            mutants.append(dict(name=name, code=mutant_code))
            killed.append(dict(name=name, rejectedByCases=bad))
        input_description = spec['limits'] + ('操作中的下标按 0 起算。' if spec['number'] == 3 else '')
        problem = dict(id=ident, courseId='gomall', lessonId='00-overview', title=spec['title'], difficulty='中等', tags=['OA', 'Databricks'], description=spec['desc'] + '\n\n标准输入输出、本站补充范围和样例按本题说明执行。', input=input_description, output=spec['output'], explanation=spec['idea'], hints=[spec['idea']], timeLimit=spec.get('time', 5), memoryLimit=262144, outputLimit=spec.get('outputLimit', 4096), checker='tokens', languages=['python', 'go', 'java', 'cpp'])
        normalized_result = subprocess.run(['node', '--max-old-space-size=512', '--import', 'tsx', '-e', "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"], cwd=ROOT, input=json.dumps(dict(schemaVersion=1, problem=problem, cases=package_cases), ensure_ascii=False), text=True, capture_output=True)
        assert normalized_result.returncode == 0, normalized_result.stderr[:3000]
        normalized = normalized_result.stdout
        editorial = f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        authored = [dict(language='python', code=run_code)]
        docs = dict(packages=json.loads(normalized), oracles=cases, mutants=mutants, editorials=dict(schemaVersion=1, id=ident, title=spec['title'], explanation=editorial, solutions=authored, sourceUrl=source['sourceUrl'], sourceContentHash=source['contentHash'], author='CSWork'))
        for folder, document in docs.items():
            (OUT / folder / f'{ident}.json').write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
        batch_items.append(dict(id=ident, sourceContentHash=source['contentHash'], packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(), editorial=editorial, authoredSolutions=authored))
        report_rows.append(dict(id=ident, oracleCases=len(cases), publicCases=3, hiddenCases=len(package_cases)-3, maximumCanonicalInputBytesBound=spec['bound'], negativeControls=killed, referenceSha256=hashlib.sha256(run_code.encode()).hexdigest()))
        raw_path, blob = RAW_EVIDENCE[spec['number']]
        review_rows.append(dict(id=ident, status='authored', reason=f"逐题核对 OA Master 固定提交 e66f809 的 {raw_path}（Git blob {blob}）及 catalog 原题哈希 {source['contentHash']}；题面和标准输入输出经本站整理，{len(cases)} 个独立小输入 oracle、边界测试与两个正常退出错误程序已验证；尚未提交真实评测沙箱。"))
        print(ident, f'{len(cases)} oracle checks;', len(package_cases)-3, 'hidden; both normal-exit mutants rejected', flush=True)
    for ident, reason in skipped.items():
        review_rows.append(dict(id=ident, status='blocked', reason=reason))
    batch_items.sort(key=lambda item: int(item['id'].rsplit('-', 1)[1]))
    report_rows.sort(key=lambda item: int(item['id'].rsplit('-', 1)[1]))
    review_rows.sort(key=lambda item: int(item['id'].rsplit('-', 1)[1]))
    (OUT / 'candidate-batches' / f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1, items=batch_items), ensure_ascii=False, indent=2) + '\n')
    note = '本地作者参考程序与独立 oracle 对照，不代表通过线上真实评测沙箱；未发布，不得标注为线上可提交。'
    (OUT / 'validation' / f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1, seed=SEED, problems=report_rows, skipped=skipped, note=note), ensure_ascii=False, indent=2) + '\n')
    (OUT / 'reviews' / f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1, items=review_rows), ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
