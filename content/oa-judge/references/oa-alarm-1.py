def solve(raw):
    values = list(map(int, raw.split()))
    n, coins = values[0], values[1:]
    if len(coins) != n:
        raise ValueError("expected N coin counts")
    result = []
    for coins_count in coins:
        lo, hi = 0, 1
        while hi * (hi + 1) // 2 <= coins_count:
            hi *= 2
        while lo + 1 < hi:
            mid = (lo + hi) // 2
            if mid * (mid + 1) // 2 <= coins_count:
                lo = mid
            else:
                hi = mid
        result.append(str(lo))
    return " ".join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
