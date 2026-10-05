from bisect import bisect_left
from collections import defaultdict
import sys

def solve(text):
    s = text.strip()
    n = len(s)
    all_pairs = 0
    for j in range(n):
        threshold = n - j
        small = min(j, threshold)
        all_pairs += small * (small + 1) // 2 + (j - small) * threshold
    positions = defaultdict(list)
    for i, ch in enumerate(s): positions[ch].append(i)
    equal_pairs = 0
    for places in positions.values():
        prefix = [0]
        for i in places: prefix.append(prefix[-1] + i + 1)
        for k, j in enumerate(places):
            split = bisect_left(places, n - j, 0, k)
            equal_pairs += prefix[split] + (k - split) * (n - j)
    return str(all_pairs - equal_pairs)

if __name__ == "__main__": print(solve(sys.stdin.read()))
