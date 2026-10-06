def maximize_niceness(ramu, sonu):
    n = len(ramu)
    if len(sonu) != n or n == 0 or n > 14:
        raise ValueError("site limit: 1 <= n <= 14")
    full = (1 << n) - 1
    # dp[mask][last] is the best sum for a valid prefix using mask and ending
    # with sonu[last]. A position's direction is fixed by adjacent Ramu values.
    dp = [[None] * n for _ in range(1 << n)]
    for j in range(n):
        dp[1 << j][j] = 0
    for mask in range(1 << n):
        position = mask.bit_count() - 1
        if position < 0 or position == n - 1:
            continue
        for last in range(n):
            score = dp[mask][last]
            if score is None:
                continue
            for nxt in range(n):
                bit = 1 << nxt
                if mask & bit:
                    continue
                should_rise = ramu[position] < ramu[position + 1]
                if (sonu[last] < sonu[nxt]) != should_rise:
                    continue
                new_mask = mask | bit
                value = score + abs(sonu[last] - sonu[nxt])
                old = dp[new_mask][nxt]
                if old is None or value > old:
                    dp[new_mask][nxt] = value
    result = [x for x in dp[full] if x is not None]
    if not result:
        raise ValueError("no valid arrangement")
    return max(result)

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        raise ValueError("expected n and two arrays")
    n = data[0]
    if n < 1 or n > 14 or len(data) != 1 + 2 * n:
        raise ValueError("expected n, then n Ramu lengths and n Sonu lengths")
    ramu, sonu = data[1:1+n], data[1+n:]
    if len(set(ramu)) != n or len(set(sonu)) != n:
        raise ValueError("each student's chalk lengths are distinct")
    return str(maximize_niceness(ramu, sonu))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
