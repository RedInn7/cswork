LEVEL = '简单'
TAGS = ['数组', '双指针']
SAMPLES = 2


def parse(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def solve(s):
    a = parse(s)
    return ' '.join(map(str, [x for x in a if x % 2] + [x for x in a if not x % 2]))


def wrong_c_remainder(s):
    # x % 2 == 1 in C, Java or Go is false for negative odd numbers.
    a = parse(s)
    odd = lambda x: x > 0 and x % 2 == 1
    return ' '.join(map(str, [x for x in a if odd(x)] + [x for x in a if not odd(x)]))


def wrong_two_pointers(s):
    # The swapping two-pointer partition is fast but does not keep the order.
    a = parse(s)
    i, j = 0, len(a) - 1
    while i < j:
        while i < j and a[i] % 2:
            i += 1
        while i < j and not a[j] % 2:
            j -= 1
        a[i], a[j] = a[j], a[i]
    return ' '.join(map(str, a))


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([1, 2, 3, 4, 5]), fmt([-4, -3, 8, -1, 0]), fmt([2, 4, 6]), fmt([7]), fmt([1, 3, 5, 0]),
           fmt([2, 1]), fmt([-1, -2, -3, -4, -5, -6])]
    for n, v in [(10, 10), (100, 10**9), (2000, 5), (20000, 10**9)]:
        out.append(fmt([r.randint(-v, v) for _ in range(n)]))
    return out
