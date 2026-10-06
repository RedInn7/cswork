import sys

def solve(raw):
    tokens = list(map(int, raw.split()))
    if len(tokens) < 2:
        raise ValueError("expected n z and n array values")
    n, z = tokens[:2]
    arr = tokens[2:]
    if not 1 <= n <= 200000 or len(arr) != n:
        raise ValueError("site protocol: 1<=n<=200000, followed by exactly n values")
    if not -100 <= z <= 100 or any(not -10**9 <= x <= 10**9 for x in arr):
        raise ValueError("site protocol: -100<=z<=100 and -1e9<=arr[i]<=1e9")
    neg = -(10**30)
    before, inside, after = 0, neg, neg
    best = 0
    for x in arr:
        before_next = max(0, before + x)
        inside_next = max(before + z * x, inside + z * x)
        after_next = max(inside + x, after + x)
        before, inside, after = before_next, inside_next, after_next
        best = max(best, before, inside, after)
    return str(best)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
