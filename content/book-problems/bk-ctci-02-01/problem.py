LEVEL = '简单'
TAGS = ['链表', '哈希表']
SAMPLES = 2
MAX_N = 20000


def values(s):
    a = s.split()
    return a[1:int(a[0]) + 1]


def solve(s):
    return ' '.join(dict.fromkeys(values(s)))


def wrong_adjacent_only(s):
    # Removes only repeats that sit next to each other.
    a = values(s)
    return ' '.join(x for i, x in enumerate(a) if i == 0 or a[i - 1] != x)


def wrong_keeps_last(s):
    # Keeps the last node of each value instead of the first.
    a = values(s)
    return ' '.join(reversed(list(dict.fromkeys(reversed(a)))))


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([4, 7, 4, 9, 7, 4]), fmt([5, 5, 5]), fmt([5]), fmt([1, 2, 1, 2]), fmt([3, 3, 4]), fmt([-1, 0, -1, 7])]
    for n, v in [(10, 5), (1000, 100), (8000, 10**9), (20000, 3000)]:
        out.append(fmt([r.randint(-v, v) for _ in range(n)]))
    return out
