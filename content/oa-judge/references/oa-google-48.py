import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        raise ValueError("expected array length and values")
    n = values[0]
    arr = values[1:]
    if not 1 <= n <= 200_000 or len(arr) != n:
        raise ValueError("expected 1 <= n <= 200000 and exactly n values")
    if any(value < -1_000_000_000 or value > 1_000_000_000 for value in arr):
        raise ValueError("array value outside the site-supported range")
    if n <= 4:
        return "0"
    arr.sort()
    return str(min(arr[n - 4 + i] - arr[i] for i in range(4)))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
