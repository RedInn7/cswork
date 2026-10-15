LEVEL = '中等'
TAGS = ['哈希表', '字符串']
SAMPLES = 1
KEYS = {'2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl', '6': 'mno', '7': 'pqrs', '8': 'tuv', '9': 'wxyz'}
THREE = {'2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl', '6': 'mno', '7': 'pqr', '8': 'stu', '9': 'vwx'}


def parse(s):
    lines = s.split('\n')
    return lines[0].strip(), lines[2].split()


def digits(word, keys):
    table = {c: d for d, letters in keys.items() for c in letters}
    return ''.join(table.get(c, '?') for c in word)


def show(words):
    return f'{len(words)}\n' + ' '.join(words)


def solve(s):
    num, words = parse(s)
    return show([w for w in words if digits(w, KEYS) == num])


def wrong_three_letters_per_key(s):
    # Puts three letters on every key, so s, v, y and z land on the wrong digits.
    num, words = parse(s)
    return show([w for w in words if digits(w, THREE) == num])


def wrong_prefix(s):
    num, words = parse(s)
    return show([w for w in words if digits(w, KEYS).startswith(num)])


def fmt(num, words):
    return f'{num}\n{len(words)}\n{" ".join(words)}\n'


def cases(r):
    table = {c: d for d, letters in KEYS.items() for c in letters}
    out = [fmt('8733', ['tree', 'used', 'tea', 'treed']), fmt('2', ['a', 'b', 'd', 'ab']), fmt('79', ['sz', 'pw', 'qy', 'rx', 'sy']),
           fmt('9999', ['zzzz', 'wxyz', 'wxy', 'zzzzz']), fmt('7777', ['pqrs', 'ssss', 'pppp', 'abcd'])]
    for n, length in [(50, 3), (1000, 5), (10000, 7)]:
        words = [''.join(r.choice('psvyzaemtw') for _ in range(r.randint(1, length + 2))) for _ in range(n)]
        num = digits(r.choice(words), KEYS)
        out.append(fmt(num[:10], words))
    return out
