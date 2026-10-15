import heapq

LEVEL = '中等'
TAGS = ['快速选择', '堆', '排序']
SAMPLES = 2


def parse(s):
    v = list(map(int, s.split()))
    return v[2:2 + v[0]], v[1]


def solve(s):
    a, k = parse(s)
    return ' '.join(map(str, sorted(a)[:k]))


def wrong_distinct(s):
    a, k = parse(s)
    return ' '.join(map(str, sorted(set(a))[:k]))


def wrong_heap_of_k_plus_one(s):
    # Seeds the heap with one element before checking k, so k = 0 still returns a number.
    a, k = parse(s)
    return ' '.join(map(str, sorted(heapq.nsmallest(max(k, 1), a))))


def fmt(a, k):
    return f'{len(a)} {k}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([1, 3, 5, 7, 2, 4, 6, 8], 4), fmt([9, 1], 0), fmt([5], 1), fmt([2, 2, 2, 1], 3), fmt([0, 10**9], 2)]
    for n, v in [(10, 5), (1000, 10**9), (20000, 10**9), (20000, 100)]:
        a = [r.randint(0, v) for _ in range(n)]
        out.append(fmt(a, r.randint(0, n)))
        if n == 1000:
            out.append(fmt(a, 0))
    return out
