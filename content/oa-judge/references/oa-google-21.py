import sys


def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        return ""
    n = values[0]
    digits = values[1:]
    if not 3 <= n <= 50 or len(digits) != n:
        raise ValueError("expected N in [3, 50], followed by N digits")
    if any(digit < 0 or digit > 9 for digit in digits):
        raise ValueError("each value must be a decimal digit")

    best = -1
    for i in range(n - 2):
        if digits[i] == 0:
            continue
        for j in range(i + 1, n - 1):
            for k in range(j + 1, n):
                best = max(best, digits[i] * 100 + digits[j] * 10 + digits[k])
    # The source OA does not define this edge case. This site returns -1 when
    # no valid three-digit subsequence exists.
    return str(best)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
