import sys
from bisect import bisect_right

def solve(raw):
    data = list(map(int, raw.split()))
    if len(data) < 1:
        raise ValueError("expected N and three arrays")
    n = data[0]
    if not 1 <= n <= 100_000 or len(data) != 1 + 3 * n:
        raise ValueError("N is outside the supported range or array lengths differ")
    starts = data[1:1 + n]
    durations = data[1 + n:1 + 2 * n]
    volumes = data[1 + 2 * n:]
    if any(not 1 <= x <= 1_000_000_000 for x in starts + durations + volumes):
        raise ValueError("start, duration and volume must be in [1, 10^9]")
    intervals = sorted((s, s + d, v) for s, d, v in zip(starts, durations, volumes))
    intervals.sort(key=lambda item: item[1])
    ends = [end for _, end, _ in intervals]
    best = [0] * (n + 1)
    for i, (start, _, volume) in enumerate(intervals, 1):
        previous = bisect_right(ends, start, 0, i - 1)
        best[i] = max(best[i - 1], best[previous] + volume)
    return str(best[n])

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
