import sys


def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    n = data[0]
    if n < 1 or n > 100_000 or len(data) != n + 1:
        raise ValueError("expected n followed by n integers")
    nums = data[1:]
    if any(not -1_000_000_000 <= x <= 1_000_000_000 for x in nums):
        raise ValueError("nums values must be within the site bounds")
    low, high = min(nums), max(nums)
    return str(sum(low < value < high for value in nums))


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
