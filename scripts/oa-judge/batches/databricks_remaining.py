"""Offline Databricks candidates #9-#26; never execute imported upstream code."""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys

import amazon_remaining_h as helper

ROOT, OUT = helper.ROOT, helper.OUT
BATCH = 'databricks-remaining-next'
SEED = 20261005


def encode_values(values):
    return str(len(values)) + '\n' + ' '.join(map(str, values)) + '\n'


def left_oracle(a):
    a = list(a)
    answer = 0
    while any(a):
        i = next(i for i, value in enumerate(a) if value)
        amount = a[i]
        answer += amount
        a[i:] = [value - amount if value >= amount else value for value in a[i:]]
    return str(answer)


def left_random(rng):
    return [rng.randint(0, 15) for _ in range(rng.randint(1, 10))]


def star_oracle(n):
    return '\n'.join(' '.join(['*'] * n) for _ in range(n))


def star_random(rng):
    return rng.randint(1, 12)


def pattern_encode(value):
    panel, codes = value
    return panel + '\n' + str(len(codes)) + '\n' + '\n'.join(codes) + '\n'


def pattern_oracle(value):
    panel, codes = value
    output = []
    for code in codes:
        for split_at in range(1, len(code)):
            start = int(code[:split_at])
            word = code[split_at:]
            output.append(word if panel.startswith(word, start) else 'not found')
    return '\n'.join(output)


def pattern_random(rng):
    panel = ''.join(rng.choice('0123456789') for _ in range(rng.randint(1, 20)))
    codes = []
    for _ in range(rng.randint(1, 8)):
        codes.append(''.join(rng.choice('0123456789') for _ in range(rng.randint(2, 8))))
    return panel, codes


def position_encode(values):
    return encode_values(values)


def position_oracle(values):
    even = sum(v for i, v in enumerate(values) if i % 2 == 0 and -100 <= v <= 100)
    odd = sum(v for i, v in enumerate(values) if i % 2 and -100 <= v <= 100)
    return str(even - odd)


def position_random(rng):
    return [rng.randint(-1000, 1000) for _ in range(rng.randint(1, 30))]


def anagram_encode(pair):
    s, pattern = pair
    return s + '\n' + pattern + '\n'


def anagram_oracle(pair):
    s, pattern = pair
    target = sorted(pattern)
    return str(next((i for i in range(len(s) - len(pattern) + 1)
                     if sorted(s[i:i + len(pattern)]) == target), -1))


def anagram_random(rng):
    s = ''.join(rng.choice('abcd') for _ in range(rng.randint(1, 24)))
    pattern = ''.join(rng.choice('abcd') for _ in range(rng.randint(1, 10)))
    return s, pattern


def bucket_encode(commands):
    return str(len(commands)) + '\n' + '\n'.join(commands) + '\n'


def bucket_oracle(commands):
    buckets, current = {}, None
    for command in commands:
        op, name = command.split()
        if op == 'goto':
            current = name
            buckets.setdefault(name, set())
        else:
            buckets[current].add(name)
    return max(buckets, key=lambda name: len(buckets[name]))


def bucket_random(rng):
    commands = ['goto a', 'goto b', 'goto c']
    for _ in range(rng.randint(1, 20)):
        bucket = rng.choice('abc')
        commands.append('goto ' + bucket)
        commands.extend('create f' + str(rng.randrange(8)) for _ in range(rng.randint(0, 3)))
    commands += ['goto winner'] + ['create x' + str(i) for i in range(30)]
    return commands


def lamps_encode(value):
    lamps, points = value
    return (f'{len(lamps)} {len(points)}\n' +
            ''.join(f'{left} {right}\n' for left, right in lamps) +
            ' '.join(map(str, points)) + '\n')


def lamps_oracle(value):
    lamps, points = value
    return ' '.join(str(sum(left <= point <= right for left, right in lamps)) for point in points)


def lamps_random(rng):
    lamps = []
    for _ in range(rng.randint(0, 12)):
        a, b = rng.randint(-15, 15), rng.randint(-15, 15)
        lamps.append((min(a, b), max(a, b)))
    points = [rng.randint(-18, 18) for _ in range(rng.randint(1, 12))]
    return lamps, points


def prefix_encode(value):
    first, second = value
    return f'{len(first)} {len(second)}\n' + ' '.join(map(str, first)) + '\n' + ' '.join(map(str, second)) + '\n'


def prefix_oracle(value):
    first, second = value
    return str(max((next((k for k in range(min(len(str(a)), len(str(b))), 0, -1)
                          if str(a)[:k] == str(b)[:k]), 0)
                    for a in first for b in second), default=0))


def prefix_random(rng):
    return ([rng.randint(1, 99999) for _ in range(rng.randint(1, 12))],
            [rng.randint(1, 99999) for _ in range(rng.randint(1, 12))])


def binary_encode(value):
    bits, requests = value
    return f'{len(bits)} {len(requests)}\n{bits}\n' + ''.join(
        ('flip\n' if request == 'flip' else f'count {request[6:]}\n') for request in requests)


def binary_oracle(value):
    bits, requests = value
    current = list(bits)
    answers = []
    for request in requests:
        if request == 'flip':
            current = ['1' if bit == '0' else '0' for bit in current]
        else:
            answers.append(str(current[:int(request[6:]) + 1].count('0')))
    return ' '.join(answers)


def binary_random(rng):
    n = rng.randint(1, 24)
    bits = ''.join(rng.choice('01') for _ in range(n))
    requests = [('flip' if rng.random() < .35 else f'count:{rng.randrange(n)}')
                for _ in range(rng.randint(1, 30))]
    return bits, requests


def subarray_encode(value):
    numbers, pattern = value
    return (f'{len(numbers)} {len(pattern)}\n' + ' '.join(map(str, numbers)) + '\n' +
            ' '.join(map(str, pattern)) + '\n')


def signs(numbers):
    return [(b > a) - (b < a) for a, b in zip(numbers, numbers[1:])]


def subarray_oracle(value):
    numbers, pattern = value
    changes = signs(numbers)
    return str(sum(changes[i:i + len(pattern)] == pattern
                   for i in range(max(0, len(changes) - len(pattern) + 1))))


def subarray_random(rng):
    numbers = [rng.randint(-5, 5) for _ in range(rng.randint(2, 18))]
    pattern = [rng.choice([-1, 0, 1]) for _ in range(rng.randint(1, 8))]
    return numbers, pattern


SPECS = [
    dict(number=9, title='最左非零值的后缀减法总和',
         desc='给定非负整数数组。反复找到最左侧非零元素，其值 x 从该位置起向右逐项处理：仅当元素当前值至少为 x 时，才减去 x；每轮把 x 加入总和。直到数组全为零后输出总和。',
         limits='第一行 n，第二行 n 个整数。来源给出的值范围为 0≤a[i]≤10000；因直接模拟为 O(n²)，本站将 n 收窄为 1≤n≤1000，以保证时限内完成。',
         output='输出过程累计总和，一个整数。',
         idea='按题意直接模拟每一轮：定位最左非零值 x，将 x 累加，并只对后缀中当前值不小于 x 的元素减 x。',
         proof='模拟始终选择与题目相同的最左非零元素，并对同一后缀逐个应用题目规定的条件减法，因此每轮结束后数组状态和累计值均与过程定义一致。题目保证该过程结束，模拟终止时累计值就是所求。',
         complexity='最多处理 n 轮（每轮至少把当前最左非零元素归零），每轮扫描至多 n 项；时间 O(n²)，额外空间 O(n)。',
         samples=[[0, 2, 2, 0, 3], [4, 4, 0], [1, 2, 3]],
         edges=[([0] * 1000, '0'), ([10000] * 1000, '10000')],
         encode=position_encode, oracle=left_oracle, random=left_random,
         code='''def solve(data):
    v=list(map(int,data.split())); n=v[0]; a=v[1:1+n]; total=0; i=0
    while i<n:
        if a[i]==0: i+=1; continue
        x=a[i]; total+=x
        for j in range(i,n):
            if a[j]>=x: a[j]-=x
    return str(total)
''',
         mutants=[('把小于 x 的值也减 x','if a[j]>=x: a[j]-=x','a[j]-=x'),
                  ('只处理当前元素','for j in range(i,n):','for j in range(i,i+1):')], bound=7000),
    dict(number=10, title='n×n 星号方阵',
         desc='给定正整数 n，输出 n 行完全相同的字符串；每行有 n 个星号，相邻星号之间恰有一个空格。',
         limits='一行整数 n，1≤n≤100。',
         output='精确输出 n 行；每行 n 个星号，相邻星号之间一个空格。', checker='exact',
         idea='构造一行 n 个星号并以单个空格连接，再输出该行 n 次。',
         proof='每行包含 n 个星号且相邻之间只有一个空格，共重复 n 次，逐字符合输出定义。',
         complexity='时间和输出空间均为 O(n²)。', samples=[2, 5, 8],
         edges=[(1, '*'), (100, '\n'.join([' '.join(['*']*100)]*100))],
         encode=lambda n: f'{n}\n', oracle=star_oracle, random=star_random,
         code='''def solve(data):
    n=int(data); row=' '.join(['*']*n); return '\\n'.join([row]*n)
''',
         mutants=[('漏掉星号之间空格',"row=' '.join(['*']*n)","row=''.join(['*']*n)"),
                  ('少输出一行','[row]*n','[row]*(n-1)')], bound=5),
    dict(number=13, title='数字串代码的所有拆分匹配',
         desc='给定数字串 panel 和若干 code。对每个 code 按 index 部分长度从 1 到 len(code)-1 依次拆成 index 与 pattern；把 index 按十进制整数解析（前导零不影响值）。若 panel 从该 0-based 下标开始的连续片段恰好等于 pattern，则该拆分结果为 pattern，否则为 not found。结果按 code 顺序、再按拆分长度顺序输出。',
         limits='第一行 panel（1..1000 个 ASCII 数字）；第二行 c（1≤c≤100），随后 c 行各一个 ASCII 数字串 code，2≤len(code)≤100，总 code 字符数≤5000。以上 c 与 code 上限为本站补充，避免结果过大。每个 index 和 pattern 均至少一位。',
         output='对每个拆分单独输出一行：匹配时输出 pattern，否则输出 not found。顺序为 code 输入顺序、每个 code 的拆分长度递增顺序。', checker='exact',
         idea='逐个 code 枚举所有非空且 pattern 非空的切分位置，把左段转成整数，比较 panel 中相同长度的切片。',
         proof='每个合法拆分的 index 位数必为 1 到 len(code)-1，循环恰好覆盖这些切分且顺序递增。对每种切分只在下标合法且片段完全相等时输出 pattern，因此逐项结果与定义一致。',
         complexity='时间 O(ΣL²)，空间 O(ΣL)，其中 L 为 code 长度。',
         samples=[('2311453915',['0211','639']), ('00000',['000','101']), ('7',['07'])],
         edges=[(('0',['000']), 'not found\n0'), (('12345',['12345']), '2345\nnot found\nnot found\nnot found')],
         encode=pattern_encode, oracle=pattern_oracle, random=pattern_random,
         code='''def solve(data):
    lines=data.split(); panel=lines[0]; q=int(lines[1]); out=[]
    for code in lines[2:2+q]:
        for cut in range(1,len(code)):
            start=int(code[:cut]); pat=code[cut:]
            out.append(pat if start+len(pat)<=len(panel) and panel[start:start+len(pat)]==pat else 'not found')
    return '\\n'.join(out)
''',
         mutants=[('漏掉最后一种拆分','range(1,len(code))','range(1,len(code)-1)'),
                  ('把 0-based 下标当成 1-based','start=int(code[:cut])','start=int(code[:cut])+1')], bound=10000, outputLimit=4096),
    dict(number=16, title='位置奇偶和的范围差',
         desc='给定数组 numbers。只考虑值位于闭区间 [-100,100] 的元素，分别求 0-based 偶数下标元素之和与奇数下标元素之和，输出前者减后者。',
         limits='第一行 n（1≤n≤1000），第二行 n 个整数，−1000≤numbers[i]≤1000。',
         output='输出偶数下标过滤和减去奇数下标过滤和的结果，一个整数。',
         idea='一次扫描数组；仅将落在 [-100,100] 的值加到其下标奇偶对应的总和，最后作差。',
         proof='每个元素只在且仅在其值落入闭区间时计入，并按其真实下标奇偶放入对应总和；扫描结束所得两和恰为题目定义，输出其差即正确。',
         complexity='时间 O(n)，额外空间 O(1)。',
         samples=[[101,3,4,359,2,5],[-2,234,100,99,540,-1],[-9]],
         edges=[([100,-100,101,-101], '200'), ([1000]*1000, '0')],
         encode=position_encode, oracle=position_oracle, random=position_random,
         code='''def solve(data):
    v=list(map(int,data.split())); n=v[0]; even=odd=0
    for i,x in enumerate(v[1:1+n]):
        if -100<=x<=100:
            if i%2==0: even+=x
            else: odd+=x
    return str(even-odd)
''',
         mutants=[('把区间端点排除','-100<=x<=100','-100<x<100'),
                  ('奇偶位置方向颠倒','if i%2==0: even+=x','if i%2==1: even+=x')], bound=12000),
    dict(number=18, title='首个字母异位子串下标',
         desc='给定小写英文字母串 s 和 pattern，返回 s 中与 pattern 字符频次完全相同的最早连续子串起始下标；若不存在返回 -1。',
         limits='两行分别为 s 与 pattern。本站字符集限制为 ASCII 小写字母；1≤|s|,|pattern|≤200000。',
         output='输出最早起始下标（0-based）；不存在时输出 -1。',
         idea='使用长度为 |pattern| 的滑动窗口维护 26 个字母频数。逐个检查窗口，首次与 pattern 的频数相同的位置即答案。',
         proof='每个长度固定为 |pattern| 的连续子串恰对应一个滑动窗口；频次向量相同当且仅当两串互为字母异位词。窗口按起点递增检查，故首次命中为最小下标；若均未命中则无解。',
         complexity='时间 O(|s|+|pattern|)，空间 O(1)。',
         samples=[('cbaebabacd','abc'),('abab','ab'),('abc','cba')],
         edges=[(('zzabc','abc'), '2'), (('a'*200000,'b'), '-1')],
         encode=anagram_encode, oracle=anagram_oracle, random=anagram_random,
         code='''def solve(data):
    s,p=data.split(); m=len(p); n=len(s)
    if m>n: return '-1'
    want=[0]*26; have=[0]*26
    for c in p: want[ord(c)-97]+=1
    for c in s[:m]: have[ord(c)-97]+=1
    for i in range(n-m+1):
        if have==want: return str(i)
        if i+m<n:
            have[ord(s[i])-97]-=1; have[ord(s[i+m])-97]+=1
    return '-1'
''',
         mutants=[('不检查最后一个窗口','range(n-m+1)','range(n-m)'),
                  ('完全相等长度时提前判无解','if m>n: return \'-1\'','if m>=n: return \'-1\'')], bound=410000),
    dict(number=19, title='文件数最多的 bucket',
         desc='按顺序处理命令：`goto name` 切换到该 bucket（bucket 不存在时创建空 bucket）；`create name` 在当前 bucket 中创建该名字的文件。相同 bucket 内文件名不重复，重复创建不增加文件数。返回文件数最多的 bucket 名，题目保证不会并列。',
         limits='第一行命令数 q（2≤q≤50000），随后 q 行命令。name 为 1..40 个 ASCII 字母、数字、下划线或连字符组成的单个 token。第一条为 goto；至少一条 create。',
         output='输出文件数唯一最多的 bucket 名称。',
         idea='为每个 bucket 维护文件名集合，并维护当前 bucket。处理完所有命令后取集合大小唯一最大的 bucket。',
         proof='集合大小与题意中的不同文件数完全一致：重复文件名在集合中只保留一次，且 goto 会确保 bucket 存在。遍历最终各集合的大小，因题目保证唯一最大者，所得 bucket 正是所求。',
         complexity='时间 O(q) 期望，空间 O(q)。',
         samples=[['goto bucketA','create fileA','create fileB','create fileA','goto bucketB','goto bucketC','create fileA','create fileB','create fileC'],
                  ['goto a','create x','goto b','create x','create y','goto c','create z'],
                  ['goto solo','create a']],
         edges=[(['goto a','create x','create x','goto b','create y','create z'], 'b'),
                (['goto first']+['create f'+str(i) for i in range(1000)], 'first')],
         encode=bucket_encode, oracle=bucket_oracle, random=bucket_random,
         code='''def solve(data):
    lines=data.splitlines(); q=int(lines[0]); buckets={}; current=None
    for line in lines[1:1+q]:
        op,name=line.split()
        if op=='goto': current=name; buckets.setdefault(name,set())
        else: buckets[current].add(name)
    return max(buckets,key=lambda name:len(buckets[name]))
''',
         mutants=[('重复创建文件仍增加计数','buckets[current].add(name)','buckets[current].add(name+str(len(buckets[current])))'),
                  ('返回文件数最少的 bucket','return max(buckets,key=lambda name:len(buckets[name]))','return min(buckets,key=lambda name:len(buckets[name]))')], bound=3000000),
    dict(number=20, title='闭区间灯光覆盖点计数',
         desc='每盏灯覆盖整数轴上的闭区间 [left,right]。给定若干查询点，输出每个点被多少盏灯照亮。',
         limits='第一行 m q（0≤m≤50000，1≤q≤50000），随后 m 行给出 left right（−10⁹≤left≤right≤10⁹），最后一行给出 q 个查询点（−10⁹≤point≤10⁹）。本站补充长度限制。',
         output='一行 q 个整数，按查询点输入顺序给出覆盖灯数，空格分隔。',
         idea='分别排序所有左端点和右端点。点 p 的覆盖数等于 left≤p 的区间数减去 right<p 的区间数。',
         proof='每个闭区间在左端点不大于 p 时计入；其中右端点严格小于 p 的区间不覆盖 p，应扣除。其余区间满足 left≤p≤right，故两项之差恰为覆盖 p 的灯数。',
         complexity='时间 O((m+q)log(m+q))，空间 O(m+q)。',
         samples=[([(1,7),(3,5),(4,6)],[1,3,4,5,6,7,8]), ([],[-1,0,1]), ([(-2,2),(-2,-2),(2,2)],[-3,-2,0,2,3])],
         edges=[(([(0,0)],[0]), '1'), (([(-10**9,10**9)]*50000, [-10**9,0,10**9]), '50000 50000 50000')],
         encode=lamps_encode, oracle=lamps_oracle, random=lamps_random,
         code='''def solve(data):
    from bisect import bisect_left,bisect_right
    v=list(map(int,data.split())); m,q=v[:2]; p=2; left=[]; right=[]
    for _ in range(m): left.append(v[p]); right.append(v[p+1]); p+=2
    points=v[p:p+q]; left.sort(); right.sort()
    return ' '.join(str(bisect_right(left,x)-bisect_left(right,x)) for x in points)
''',
         mutants=[('把右端点等于 p 的灯排除','bisect_left(right,x)','bisect_right(right,x)'),
                  ('把左端点等于 p 的灯排除','bisect_right(left,x)','bisect_left(left,x)')], bound=1800000),
    dict(number=21, title='两数组数字最长公共前缀长度',
         desc='给定两个正整数数组，求分别取一个数后，十进制表示的最长公共前缀长度在所有数对中的最大值；若没有公共首位则输出 0。',
         limits='第一行 n m（1≤n,m≤50000），随后两行分别给出 n 个、m 个整数，值均在 [1,10⁹]。m 的范围是本站补充，参照原题对第一数组给出的限制。',
         output='输出最长公共前缀的最大长度，一个整数。',
         idea='把第二数组的所有十进制前缀插入 Trie。逐个查询第一数组，沿 Trie 尽可能向下走，最大深度就是答案。',
         proof='Trie 中深度 k 的路径存在，当且仅当第二数组中至少一个数以查询数的前 k 位开头。因此对每个第一数组元素，成功走到的最深深度等于它与第二数组某数的最长公共前缀最大值；再对第一数组取最大即所求。',
         complexity='时间 O((n+m)·D)，空间 O(m·D)，D≤10。',
         samples=[([25,288,2655,54546,54,555],[2,255,266,244,26,5,54547]),
                  ([25,288,2655,544,54,555],[2,255,266,244,26,5,5444444]),
                  ([817,99],[1999,1909])],
         edges=[(([1],[1]), '1'), (([987654321]*50000,[987654320]*50000), '8')],
         encode=prefix_encode, oracle=prefix_oracle, random=prefix_random,
         code='''def solve(data):
    v=list(map(int,data.split())); n,m=v[:2]; a=v[2:2+n]; b=v[2+n:2+n+m]; root={}
    for x in b:
        node=root
        for c in str(x): node=node.setdefault(c,{})
    best=0
    for x in a:
        node=root; depth=0
        for c in str(x):
            if c not in node: break
            node=node[c]; depth+=1
        best=max(best,depth)
    return str(best)
''',
         mutants=[('漏掉完整数字前缀','for c in str(x): node=node.setdefault(c,{})','for c in str(x)[:-1]: node=node.setdefault(c,{})'),
                  ('只检查第一组第一个数','for x in a:','for x in a[:1]:')], bound=1800000),
    dict(number=23, title='二进制串翻转与前缀计数',
         desc='给定二进制串和操作序列。`flip` 将串中所有 0/1 互换；`count i` 查询当前串从 0 到 i（含 i）的 0 的个数。',
         limits='第一行 n q（1≤n≤200000，1≤q≤8000），第二行长度 n 的 0/1 字符串，随后 q 行操作 `flip` 或 `count i`（0≤i<n）。本站补充 q 上限。',
         output='将所有 count 查询的答案按顺序以空格分隔输出一行；若没有 count 查询则输出空行。',
         idea='预计算初始 0 前缀和，以布尔标记维护翻转次数奇偶；查询时根据状态返回原前缀零数或前缀长度减原零数。',
         proof='每次全串翻转后，一个前缀中的 0 数变成该前缀长度减原本的 0 数；连续翻转仅由奇偶性决定。按顺序逐操作应用这一等式，因此每次查询答案与当前实际字符串一致。',
         complexity='时间 O(n+q)，额外空间 O(n)。',
         samples=[('1111010',['count:4','count:6','flip','count:4','flip','count:2']),
                  ('0000',['count:0','flip','count:3','flip','count:1']),
                  ('1',['flip','count:0'])],
         edges=[(('0'*200000,['count:0','count:199999']), '1 200000'),
                (('1'*200000,['flip']*7999+['count:199999']), '200000')],
         encode=binary_encode, oracle=binary_oracle, random=binary_random,
         code='''def solve(data):
    it=iter(data.split()); n=int(next(it)); q=int(next(it)); bits=next(it); pref=[0]*(n+1)
    for i,c in enumerate(bits): pref[i+1]=pref[i]+(c=='0')
    flipped=False; out=[]
    for _ in range(q):
        op=next(it)
        if op=='flip': flipped=not flipped
        else:
            i=int(next(it)); z=pref[i+1]; out.append(str(i+1-z if flipped else z))
    return ' '.join(out)
''',
         mutants=[('查询漏算下标 i','z=pref[i+1]','z=pref[i]'),
                  ('翻转后仍返回原零数','i+1-z if flipped else z','z')], bound=430000, outputLimit=4096),
    dict(number=24, title='满足变化模式的连续子数组数',
         desc='给定 numbers 和只含 -1、0、1 的 pattern。对连续元素段，逐对比较相邻值：下一项较大记 1，相等记 0，较小记 -1。统计其变化序列恰好等于 pattern 的连续段数量。',
         limits='第一行 n m（2≤n≤200000，1≤m≤200000），第二行 n 个整数（−10⁹..10⁹），第三行 m 个 −1、0 或 1。本站补充 m 上限。一个匹配段包含 m+1 个 numbers 元素。',
         output='输出匹配的连续子数组数量，一个整数。',
         idea='先把 numbers 转成相邻比较符号序列，再用 KMP 统计 pattern 在该符号序列中的出现次数，包含重叠匹配。',
         proof='numbers 的每个长度 m+1 连续段唯一对应符号序列中的一个长度 m 子段，且定义要求逐位相等。KMP 恰好计数符号序列中 pattern 的所有起点，包括重叠起点，因此计数与题意一致。',
         complexity='时间 O(n+m)，额外空间 O(n+m)。',
         samples=[([4,1,3,4,4,5,5,1],[1,0,-1]), ([1,2,2,1],[1,0,-1]), ([3,3],[0])],
         edges=[(([0,1,2,3,4],[1,1]), '3'), (([1,2,1,2,1],[1,-1]), '2')],
         encode=subarray_encode, oracle=subarray_oracle, random=subarray_random,
         code='''def solve(data):
    v=list(map(int,data.split())); n,m=v[:2]; a=v[2:2+n]; pat=v[2+n:2+n+m]
    text=[(b>x)-(b<x) for x,b in zip(a,a[1:])]; pi=[0]*m
    for i in range(1,m):
        j=pi[i-1]
        while j and pat[i]!=pat[j]: j=pi[j-1]
        if pat[i]==pat[j]: j+=1
        pi[i]=j
    count=j=0
    for value in text:
        while j and value!=pat[j]: j=pi[j-1]
        if value==pat[j]: j+=1
        if j==m: count+=1; j=pi[j-1]
    return str(count)
''',
         mutants=[('把相等也判成递增','(b>x)-(b<x)','int(b>=x)-int(b<x)'),
                  ('匹配后不回退以统计重叠','j=pi[j-1]','j=0')], bound=3000000),
]

RAW = {
    9: ('OA LIST/Databricks_OA/014_image.txt', '7db88bf7a293aa923432b3c673f0c2921c691d62'),
    10: ('OA LIST/Databricks_OA/015_image.txt', 'f936be251b5ae42bde6d28d3ea9c36a40cd82db5'),
    13: ('fastprep/Databricks/databricks-check-pattern-presence.md', '2a888b4da51c6de0bca8ec7976f4bd89a22973be'),
    16: ('fastprep/Databricks/databricks-diff-between-sums-of-positions.md', '16e06349d1d21c3aefb96728140b1a77f8afd1db'),
    18: ('fastprep/Databricks/databricks-find-first-anagram-index.md', '42f099f07ef514a0e0f2621b6823037b9e87cb88'),
    19: ('fastprep/Databricks/databricks-goto-largest-bucket.md', 'e5dc8799639ed9ca42f38f35f877b2641eda6f4a'),
    20: ('fastprep/Databricks/databricks-lamps.md', '8032bab14fb5fd52037b37276320cc012e48da99'),
    21: ('fastprep/Databricks/databricks-longest-common-prefix-of-number-pairs.md', 'ea54b3c67b1b3fad353f786e66a209a77a6ca2ec'),
    23: ('fastprep/Databricks/databricks-string-requests.md', '7dced74e010626745b51f8a25a7fef563e62e173'),
    24: ('fastprep/Databricks/databricks-subarray-counting.md', '48647c37ef94a41566e53d130f42015d4a299596'),
}
ALL_RAW = {
    **RAW,
    11: ('fastprep/Databricks/databricks-advanture-to-count-moves.md', 'ae4cab2648f69003d037786daa0b55c5a61d462f'),
    12: ('fastprep/Databricks/databricks-array-manipulation.md', '30499f351545779ff13a1c0e9f25429c385c877f'),
    14: ('fastprep/Databricks/databricks-count-triples-with-diff.md', 'a6deb2532090f83c878de330f32fd768056e0558'),
    15: ('fastprep/Databricks/databricks-cyclic-pairs.md', 'd292f4aca83940522bddc3b25c75e75ed885b9eb'),
    17: ('fastprep/Databricks/databricks-fastest-sf-commute.md', '6b806d6d1b355b1f1fb1cd1b8704889a767bd7ba'),
    22: ('fastprep/Databricks/databricks-push-boxes.md', '0308c65b1fe3fd5f029bfa6d6ce527623a5bd292'),
    25: ('fastprep/Databricks/databricks-write-l-matrix.md', 'd5d7c3d33316c3bdb739e71aa221572817c49d80'),
    26: ('fastprep/Databricks/dd-count-pairs.md', '55d7a4beb0f1c67ac8cd8a60b1dd4399a8eac703'),
}
MDX_PATH = 'web/content/docs/companies/databricks.mdx'
MDX_BLOB = '7fd09106d12e021e873ef086e882682d8dbdda76'

BLOCKED = {
    11: '来源只给机器人和激光的叙述及一个样例，没有定义激光所在整行/整列对起点或越界的精确影响；移动步数不唯一，暂缓。',
    12: '原始题面截断在“origina”，约束为占位符且原示例没有解释；相邻差计数与同值重复项如何计数不能确定，暂缓。',
    14: '题目签名明确带固定 diff 参数，正文却定义任意三个数满足等差关系且没有 diff；无法确定是固定差还是任意公差，暂缓。',
    15: '只有循环移位的叙述，没有输入/输出定义、样例、数值范围，也未说明零位移是否算合法变换；暂缓。',
    17: '模式选择先按总时间、再按总成本，但二者仍并列时没有指定输出哪个模式；固定标准输出不唯一，暂缓。',
    22: '题面字符说明使用“.”空格、“*”障碍，而示例改用“-”；示例解释还出现尺寸和内容不同的另一棋盘，结果来源不一致，暂缓。',
    25: '标题要求写 L，整理题面例子解释却写 Y；同一固定源中的附件又称 X，图案定义相互冲突，暂缓。',
    26: '规则说最多交换两位数字，但整理页解法按数字重排后分组；对四位以上数字该解法不等价，且前导零处理没有定义，暂缓。',
}


def main():
    for folder in ('packages','references','oracles','mutants','negative-controls','editorials','candidate-batches','validation','reviews','source-evidence'):
        (OUT/folder).mkdir(parents=True,exist_ok=True)
    sources={x['id']:x for x in json.loads((ROOT/'content/oa-master/catalog.json').read_text())['items']}
    batch_items=[]; report=[]; review=[]; evidence=[]
    for spec in SPECS:
        number=spec['number']; ident=f'oa-databricks-{number}'; rng=random.Random(SEED+number)
        code=spec['code']+'\nif __name__ == "__main__":\n    import sys\n    print(solve(sys.stdin.read()))\n'
        ref=OUT/'references'/f'{ident}.py'; ref.write_text(code)
        values=spec['samples']+[spec['random'](rng) for _ in range(160)]
        oracle=[dict(input=spec['encode'](value),expectedOutput=str(spec['oracle'](value))+'\n') for value in values]
        tests=oracle[:3]+[dict(input=spec['encode'](value),expectedOutput=str(expected)+'\n') for value,expected in spec['edges']]+oracle[3:31]
        assert len(oracle)==163 and len(tests)>=33
        for case in oracle+tests: assert len(case['input'].encode())<=spec['bound']
        exact=spec.get('checker')=='exact'
        matches=lambda actual,expected: actual==expected if exact else actual.split()==expected.split()
        for idx,(actual,case) in enumerate(zip(helper.execute(ref,[case['input'] for case in oracle+tests]),oracle+tests)):
            assert matches(actual,case['expectedOutput']),(ident,idx,actual[:200],case['expectedOutput'][:200])
        cases=[dict(name=f'样例 {i+1}' if i<3 else f'边界与组合 {i-2}',**case,hidden=i>=3,weight=1) for i,case in enumerate(tests)]
        mutants=[]; killed=[]
        for j,(name,old,new) in enumerate(spec['mutants'],1):
            assert old in code,(ident,name,old)
            mutant=code.replace(old,new); path=OUT/'negative-controls'/f'{ident}-{j}.py'; path.write_text(mutant)
            outputs=helper.execute(path,[case['input'] for case in cases])
            bad=[i for i,(actual,case) in enumerate(zip(outputs,cases)) if not matches(actual,case['expectedOutput'])]
            assert bad,(ident,name,'mutant survived')
            mutants.append(dict(name=name,code=mutant)); killed.append(dict(name=name,rejectedByCases=bad))
        source=sources[ident]; raw_path,blob=ALL_RAW[number]
        problem=dict(id=ident,courseId='gomall',lessonId='00-overview',title=spec['title'],difficulty='中等',tags=['OA','Databricks'],description=spec['desc']+'\n\n标准输入输出及本站补充范围按本题说明执行。',input=spec['limits'],output=spec['output'],explanation=spec['idea'],hints=[spec['idea']],timeLimit=spec.get('time',5),memoryLimit=262144,outputLimit=spec.get('outputLimit',4096),checker=spec.get('checker','tokens'),languages=['python','go','java','cpp'])
        normalized=subprocess.run(['node','--max-old-space-size=512','--import','tsx','-e',"const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"],cwd=ROOT,input=json.dumps(dict(schemaVersion=1,problem=problem,cases=cases),ensure_ascii=False),text=True,capture_output=True,check=True).stdout
        editorial=f"## 思路\n\n{spec['idea']}\n\n## 正确性证明\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        solutions=[dict(language='python',code=code)]
        for folder,value in dict(packages=json.loads(normalized),oracles=oracle,mutants=mutants,editorials=dict(schemaVersion=1,id=ident,title=spec['title'],explanation=editorial,solutions=solutions,sourceUrl=source['sourceUrl'],sourceContentHash=source['contentHash'],author='CSWork')).items():
            (OUT/folder/f'{ident}.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
        batch_items.append(dict(id=ident,sourceContentHash=source['contentHash'],packageChecksum=hashlib.sha256(normalized.encode()).hexdigest(),editorial=editorial,authoredSolutions=solutions))
        report.append(dict(id=ident,oracleCases=len(oracle),publicCases=3,hiddenCases=len(cases)-3,maximumCanonicalInputBytesBound=spec['bound'],negativeControls=killed,referenceSha256=hashlib.sha256(code.encode()).hexdigest()))
        review.append(dict(id=ident,status='authored',reason=f"逐题核对 OA Master 固定提交 e66f809 的 {raw_path}（Git blob {blob}）及 {MDX_PATH}（blob {MDX_BLOB}），并记录 catalog 题面哈希 {source['contentHash']}；163 个独立 oracle 输入、边界测试及两个正常退出 mutant 已通过本地验证，未运行 GoJudge。"))
        evidence.append(dict(id=ident,status='authored',sourceUrl=source['sourceUrl'],sourceFiles=[dict(path=raw_path,gitBlobSha=blob),dict(path=MDX_PATH,gitBlobSha=MDX_BLOB)],catalogContentHash=source['contentHash']))
        print(f"{ident}: {len(oracle)} oracle inputs, {len(cases)} package cases; both mutants killed",flush=True)
    for number,reason in BLOCKED.items():
        ident=f'oa-databricks-{number}'; source=sources[ident]
        raw_path,blob=ALL_RAW[number]
        review.append(dict(id=ident,status='blocked',reason=reason))
        evidence.append(dict(id=ident,status='blocked',sourceUrl=source['sourceUrl'],sourceFiles=[dict(path=raw_path,gitBlobSha=blob),dict(path=MDX_PATH,gitBlobSha=MDX_BLOB)],catalogContentHash=source['contentHash'],reason=reason))
    batch_items.sort(key=lambda x:int(x['id'].rsplit('-',1)[1])); report.sort(key=lambda x:int(x['id'].rsplit('-',1)[1])); review.sort(key=lambda x:int(x['id'].rsplit('-',1)[1])); evidence.sort(key=lambda x:int(x['id'].rsplit('-',1)[1]))
    (OUT/'candidate-batches'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=batch_items),ensure_ascii=False,indent=2)+'\n')
    (OUT/'validation'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,seed=SEED,problems=report,blocked={f'oa-databricks-{n}':r for n,r in BLOCKED.items()},note='离线参考与 oracle 验证，不代表通过线上 GoJudge。'),ensure_ascii=False,indent=2)+'\n')
    (OUT/'reviews'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,items=review),ensure_ascii=False,indent=2)+'\n')
    (OUT/'source-evidence'/f'{BATCH}.json').write_text(json.dumps(dict(schemaVersion=1,repository='https://github.com/RedInn7/OA-Master',commit='e66f809f4c953bce129f68491726176615db6afc',reason='Read-only review of the fixed source snapshot; no imported solution code was executed.',items=evidence),ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__': main()
