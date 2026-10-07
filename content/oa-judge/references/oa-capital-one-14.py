import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        raise ValueError("expected n, array, and shift t")
    n = values[0]
    if not 1 <= n <= 200000 or len(values) != n + 2:
        raise ValueError("site input requires 1 <= n <= 200000 and n values plus t")
    nums, t = values[1:n + 1], values[-1]
    if not 0 <= t < n or any(not -(10**9) <= x <= 10**9 for x in nums):
        raise ValueError("input is outside the stated constraints")
    previous = nums[(n - t) % n]
    for i in range(1, n):
        current = nums[(i - t) % n]
        if previous <= current:
            return "false"
        previous = current
    return "true"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
