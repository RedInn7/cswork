import sys
from math import isqrt

def solve(n):
    left = 1
    total = 0
    intervals = []
    for right in range(1, isqrt(n) + 1):
        total += right * right
        while total > n:
            total -= left * left
            left += 1
        if total == n:
            intervals.append((left, right))
    intervals.sort(key=lambda p: p[1] - p[0], reverse=False)
    rows = [str(len(intervals))]
    for left, right in intervals:
        rows.append(str(right - left + 1) + ' ' + ' '.join(map(str, range(left, right + 1))))
    return '\n'.join(rows)

if __name__ == '__main__':
    print(solve(int(sys.stdin.read())))
