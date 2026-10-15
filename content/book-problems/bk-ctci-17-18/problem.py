LEVEL = '中等'
TAGS = ['滑动窗口', '哈希表']
SAMPLES = 2
MAX_N = (100000, 100000)


def parse(s):
    v = list(map(int, s.split()))
    n, m = v[0], v[1]
    return v[2:2 + n], v[2 + n:2 + n + m]


def window(big, small, stop_early=False, rightmost=False):
    need = set(small)
    have, inside = {}, 0
    best = None
    left = 0
    for right, x in enumerate(big):
        if x in need:
            have[x] = have.get(x, 0) + 1
            inside += have[x] == 1
        while inside == len(need):
            if best is None or right - left < best[1] - best[0] or (rightmost and right - left == best[1] - best[0]):
                best = (left, right)
            y = big[left]
            if y in need:
                have[y] -= 1
                inside -= have[y] == 0
            left += 1
        if stop_early and best:
            break
    return f'{best[0]} {best[1]}' if best else '-1'


def solve(s):
    return window(*parse(s))


def wrong_first_window(s):
    return window(*parse(s), stop_early=True)


def wrong_rightmost_tie(s):
    return window(*parse(s), rightmost=True)


def fmt(big, small):
    return f'{len(big)} {len(small)}\n{" ".join(map(str, big))}\n{" ".join(map(str, small))}\n'


def cases(r):
    out = [fmt([4, 2, 8, 4, 6, 2, 9, 8], [2, 4, 8]), fmt([1, 2, 3], [5]), fmt([7], [7]), fmt([1, 2, 1, 2], [1, 2]),
           fmt([3, 3, 3], [3]), fmt([1, 2, 3, 4, 5], [5, 1])]
    for n, m, v in [(20, 3, 6), (1000, 10, 30), (15000, 50, 200), (15000, 3, 10**9)]:
        big = [r.randint(1, v) for _ in range(n)]
        small = r.sample(sorted(set(big)), min(m, len(set(big))))
        if v == 10**9:
            small = [big[5], big[n // 2], big[-5]]
            small = list(dict.fromkeys(small))
        out.append(fmt(big, small))
    return out
