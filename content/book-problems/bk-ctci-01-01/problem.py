LEVEL = '简单'
TAGS = ['字符串', '哈希表', '位运算']
SAMPLES = 1
MAX_N = (1000, 100)


def strings(s):
    lines = s.split('\n')
    return lines[1:int(lines[0]) + 1]


def solve(s):
    return '\n'.join('true' if len(set(x)) == len(x) else 'false' for x in strings(s))


def wrong_neighbours_only(s):
    # Compares neighbours without sorting first.
    return '\n'.join('false' if any(x[i] == x[i - 1] for i in range(1, len(x))) else 'true' for x in strings(s))


def wrong_int_bitmap(s):
    # A 32-bit int bitmap: Java and Go shift counts wrap at 32, so characters collide.
    out = []
    for x in strings(s):
        mask, ok = 0, True
        for c in x:
            bit = 1 << ((ord(c) - 33) % 32)
            if mask & bit:
                ok = False
                break
            mask |= bit
        out.append('true' if ok else 'false')
    return '\n'.join(out)


def fmt(items):
    return f'{len(items)}\n' + '\n'.join(items) + '\n'


def size(s):
    t, *rest = s.split()
    return int(t), max(map(len, rest))


def cases(r):
    visible = [chr(c) for c in range(33, 127)]
    out = [fmt(['banana', 'xyz', 'aA1!']), fmt(['a', 'aa', 'abca', 'abcdefghijklmnopqrstuvwxyz', 'aA', '!~', 'zyxwz'])]
    for t, n in [(20, 5), (200, 30), (1000, 60)]:
        items = []
        for k in range(t):
            m = r.randint(1, n)
            w = r.sample(visible, m)
            if k % 2:
                w[r.randrange(m)] = r.choice(visible)
            items.append(''.join(w))
        out.append(fmt(items))
    out.append(fmt([''.join(visible[k:k + 50]) for k in range(0, 45)]))
    # The longest strings: all 94 visible characters once, then 100 (a repeat is certain).
    out.append(fmt([''.join(r.sample(visible, 94)), ''.join(r.choices(visible, k=100)), ''.join(r.sample(visible, 94)) + 'abcdef']))
    return out
