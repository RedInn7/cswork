LEVEL = '简单'
TAGS = ['数组', '哈希表']
SAMPLES = 2
MAX_N = 100000


def solve(s):
    a = s.split()
    n = int(a[0])
    count = [0] * n
    for x in a[1:n + 1]:
        count[int(x)] += 1
    return ' '.join(str(v) for v in range(n) if count[v] > 1)


def wrong_first_repeat_only(s):
    # Stops at the first repeat, as the one-answer version of the problem does.
    seen = set()
    for x in map(int, s.split()[1:]):
        if x in seen:
            return str(x)
        seen.add(x)


def wrong_neighbours_unsorted(s):
    # Looks for equal neighbours without sorting first.
    a = list(map(int, s.split()[1:]))
    return ' '.join(map(str, sorted({a[i] for i in range(1, len(a)) if a[i] == a[i - 1]})))


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = ['7\n3 4 1 4 0 1 4\n', '2\n1 1\n', '2\n0 0\n', fmt([5] * 6), fmt([0, 1, 2, 3, 4, 5, 6, 0])]
    for n, k in [(10, 1), (10, 4), (1000, 1), (1000, 300), (20000, 8000), (20000, 1)]:
        a = list(range(n))
        r.shuffle(a)
        for i in r.sample(range(n), k):
            a[i] = r.randrange(n)
        if len(set(a)) == n:
            a[0] = a[1]
        out.append(fmt(a))
    return out
