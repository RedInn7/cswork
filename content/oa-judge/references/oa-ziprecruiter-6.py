from collections import Counter
import sys

def canonical(value):
    text = str(value)
    return min(text[i:] + text[:i] for i in range(len(text)))

def count_pairs(values):
    counts = Counter(canonical(value) for value in values)
    return sum(count * (count - 1) // 2 for count in counts.values())

def solve(raw):
    tokens = list(map(int, raw.split()))
    if not tokens:
        raise ValueError("missing n")
    n, values = tokens[0], tokens[1:]
    if not 1 <= n <= 100 or len(values) != n:
        raise ValueError("site protocol: 1 <= n <= 100 and n values")
    if any(not 1 <= value <= 10000 for value in values):
        raise ValueError("source constraint: 1 <= a[i] <= 10000")
    return str(count_pairs(values))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
