LEVEL = '简单'
TAGS = ['滑动窗口', '数学']
SAMPLES = 2


def runs(t, shortest=2):
    found = []
    length = shortest
    while length * (length + 1) // 2 <= t:
        rest = t - length * (length - 1) // 2
        if rest % length == 0:
            first = rest // length
            found.append(list(range(first, first + length)))
        length += 1
    return found


def show(found):
    return '\n'.join([str(len(found))] + [' '.join(map(str, q)) for q in found])


def solve(s):
    return show(sorted(runs(int(s))))


def wrong_single_number(s):
    # Counts target alone as a run.
    return show(sorted(runs(int(s), shortest=1)))


def wrong_by_length(s):
    # Lists runs by length, shortest first: the largest first number comes first.
    return show(runs(int(s)))


def cases(r):
    return [f'{t}\n' for t in [9, 4, 15, 1, 2, 3, 5, 8, 1024, 100000, 99999, 65536, 3 * 5 * 7 * 11 * 13]] + [
        f'{r.randint(1, 100000)}\n' for _ in range(4)]
