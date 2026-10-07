import sys
from bisect import bisect_left

def solve(raw):
    values = list(map(int, raw.split()))
    n, k = values[:2]
    if k >= 3:
        return '0'
    a = sorted(values[2:])
    answer = a[0]
    for i in range(1, n):
        answer = min(answer, a[i] - a[i - 1])
    if k == 1 or answer == 0:
        return str(answer)
    for i in range(1, n):
        for j in range(i):
            difference = a[i] - a[j]
            position = bisect_left(a, difference)
            if position < n:
                answer = min(answer, a[position] - difference)
            if position:
                answer = min(answer, difference - a[position - 1])
            if answer == 0:
                return '0'
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
